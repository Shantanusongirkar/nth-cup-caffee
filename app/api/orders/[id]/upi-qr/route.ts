import { getPrisma } from "@/lib/prisma";
import {
  closeQr,
  createRazorpayOrder,
  createUpiQr,
  isRazorpayConfigured,
} from "@/lib/payments/razorpay";
import {
  MOCK_QR_ID_PREFIX,
  buildMockUpiUri,
  isDevMockEnabled,
} from "@/lib/payments/dev-mock";

export const runtime = "nodejs";

const MAX_QR_PER_ORDER = 5;
/** Razorpay requires `close_by` >= ~15 min ahead; visible TTL is shorter. */
const RAZORPAY_CLOSE_BY_SECONDS = 16 * 60;

function getVisibleTtlSeconds(): number {
  const raw = Number.parseInt(process.env.UPI_QR_TTL_SECONDS ?? "", 10);
  if (Number.isFinite(raw) && raw >= 60 && raw <= 3600) return raw;
  return 300;
}

function formatOrderReference(orderId: string): string {
  const cleanId = orderId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();
  return `NC-${cleanId}`;
}

type Fallback =
  | { kind: "popup"; keyId: string; razorpayOrderId: string }
  | { kind: "counter" };

async function buildFallback(orderId: string): Promise<Fallback> {
  if (isRazorpayConfigured()) {
    try {
      const prisma = getPrisma();
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, totalInPaise: true, cafeId: true, razorpayOrderId: true },
      });
      if (order && order.totalInPaise > 0) {
        if (order.razorpayOrderId) {
          return {
            kind: "popup",
            keyId: process.env.RAZORPAY_KEY_ID ?? "",
            razorpayOrderId: order.razorpayOrderId,
          };
        }
        const receipt = formatOrderReference(order.id);
        const rzpOrder = await createRazorpayOrder({
          amountInPaise: order.totalInPaise,
          receipt,
          notes: { orderReference: receipt, cafeId: order.cafeId },
        });
        await prisma.order.update({
          where: { id: order.id },
          data: { razorpayOrderId: rzpOrder.id },
        });
        return {
          kind: "popup",
          keyId: process.env.RAZORPAY_KEY_ID ?? "",
          razorpayOrderId: rzpOrder.id,
        };
      }
    } catch (error) {
      console.error(`QR fallback popup creation failed for ${orderId}:`, error);
    }
  }
  return { kind: "counter" };
}

/**
 * Issues (or reissues) an embedded UPI QR for an UNPAID order.
 * Reissue closes the previous QR first and is capped at 5 per order.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  if (!id || typeof id !== "string") {
    return Response.json(
      { error: "INVALID_ID", message: "Order ID parameter is required." },
      { status: 400 }
    );
  }

  try {
    const prisma = getPrisma();
    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        cafeId: true,
        paymentMethod: true,
        paymentStatus: true,
        totalInPaise: true,
        razorpayQrId: true,
        qrExpiresAt: true,
        qrIssueCount: true,
      },
    });

    if (!order) {
      return Response.json(
        { error: "NOT_FOUND", message: "Order was not found." },
        { status: 404 }
      );
    }

    if (order.paymentStatus === "PAID") {
      return Response.json(
        { error: "ALREADY_PAID", paymentStatus: "PAID" },
        { status: 409 }
      );
    }

    if (order.qrIssueCount >= MAX_QR_PER_ORDER) {
      const fallback = await buildFallback(order.id);
      return Response.json(
        {
          error: "QR_LIMIT",
          message: "Too many QR codes issued for this order.",
          fallback,
        },
        { status: 429 }
      );
    }

    // Sync the stored choice to UPI: the customer picked UPI on this page and
    // the same order is reused across "change method" trips (no duplicates).
    if (order.paymentMethod !== "UPI") {
      await prisma.order.update({
        where: { id: order.id },
        data: { paymentMethod: "UPI" },
      });
    }

    // Close any previous QR before issuing a new one so a late scan of the
    // old code cannot succeed. Best-effort: creation must still proceed if
    // the close fails (Razorpay `single_use` QRs also auto-close on payment).
    const previousQrId = order.razorpayQrId;
    if (previousQrId && !previousQrId.startsWith(MOCK_QR_ID_PREFIX)) {
      try {
        await closeQr(previousQrId);
      } catch (error) {
        console.error(`Failed to close previous QR ${previousQrId}:`, error);
      }
    }

    const ttlSeconds = getVisibleTtlSeconds();
    const serverNow = new Date();
    const expiresAt = new Date(serverNow.getTime() + ttlSeconds * 1000);
    const orderReference = formatOrderReference(order.id);
    const issueCount = order.qrIssueCount + 1;

    // --- Real Razorpay QR ---
    if (isRazorpayConfigured()) {
      try {
        const closeByUnix =
          Math.floor(serverNow.getTime() / 1000) + RAZORPAY_CLOSE_BY_SECONDS;
        const qr = await createUpiQr({
          amountInPaise: order.totalInPaise,
          closeByUnix,
          notes: {
            orderId: order.id,
            orderReference,
            cafeId: order.cafeId,
          },
          description: `Nth Cup Caffee order ${orderReference}`,
        });

        if (!qr.image_content) {
          // No `upi://` payload (the `qr_image_content` feature is not enabled
          // on this account) — close the orphaned QR immediately so it can
          // never be paid against, then fall back.
          try {
            await closeQr(qr.id);
          } catch (closeError) {
            console.error(`Failed to close imageless QR ${qr.id}:`, closeError);
          }
          throw new Error(
            "Razorpay QR created without image_content (feature not enabled)."
          );
        }

        await prisma.order.update({
          where: { id: order.id },
          data: {
            razorpayQrId: qr.id,
            qrExpiresAt: expiresAt,
            qrIssueCount: issueCount,
          },
        });

        return Response.json(
          {
            qrId: qr.id,
            upiUri: qr.image_content,
            amountInPaise: order.totalInPaise,
            expiresAt: expiresAt.toISOString(),
            serverNow: serverNow.toISOString(),
            orderReference,
            devMock: false,
          },
          { status: 200 }
        );
      } catch (error) {
        console.error(`Real UPI QR creation failed for ${order.id}:`, error);
        if (!isDevMockEnabled()) {
          const fallback = await buildFallback(order.id);
          return Response.json(
            {
              error: "QR_UNAVAILABLE",
              message:
                "UPI QR is unavailable right now. You can pay with the popup or at the counter.",
              fallback,
            },
            { status: 503 }
          );
        }
        // else fall through to the dev mock below
      }
    }

    // --- Dev-only mock QR (local testing without real money) ---
    if (isDevMockEnabled()) {
      const mockQrId = `${MOCK_QR_ID_PREFIX}${order.id}`;
      const upiUri = buildMockUpiUri({
        orderReference,
        amountInPaise: order.totalInPaise,
        issueCount,
      });

      await prisma.order.update({
        where: { id: order.id },
        data: {
          razorpayQrId: mockQrId,
          qrExpiresAt: expiresAt,
          qrIssueCount: issueCount,
        },
      });

      return Response.json(
        {
          qrId: mockQrId,
          upiUri,
          amountInPaise: order.totalInPaise,
          expiresAt: expiresAt.toISOString(),
          serverNow: serverNow.toISOString(),
          orderReference,
          devMock: true,
        },
        { status: 200 }
      );
    }

    const fallback = await buildFallback(order.id);
    return Response.json(
      {
        error: "QR_UNAVAILABLE",
        message:
          "UPI QR is unavailable right now. You can pay with the popup or at the counter.",
        fallback,
      },
      { status: 503 }
    );
  } catch (error) {
    console.error(`Failed to issue UPI QR for order ${id}:`, error);
    return Response.json(
      { error: "INTERNAL_ERROR", message: "Failed to issue UPI QR." },
      { status: 500 }
    );
  }
}
