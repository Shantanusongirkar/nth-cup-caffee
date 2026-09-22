import { getPrisma } from "@/lib/prisma";
import { closeQr, fetchQrPayments } from "@/lib/payments/razorpay";
import { markOrderPaid } from "@/lib/payments/mark-paid";
import { isMockQrId } from "@/lib/payments/dev-mock";

export const runtime = "nodejs";

/**
 * Minimum gap between Razorpay reconciliation calls for the same order.
 * NOTE: this throttle is per server instance (module-scope Map) and therefore
 * best-effort on serverless — each concurrent/lambda instance keeps its own
 * map. That is acceptable here: extra calls only cost a Razorpay API hit, and
 * correctness never depends on the throttle (markOrderPaid is race-safe).
 */
const RECONCILE_THROTTLE_MS = 2000;
const lastReconcileAt = new Map<string, number>();

type QrStatus = "active" | "expired" | "closed";

function noStore(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/** Reconciles one order against Razorpay; returns true if now PAID. */
async function reconcileWithRazorpay(opts: {
  orderId: string;
  qrId: string;
  totalInPaise: number;
}): Promise<boolean> {
  if (isMockQrId(opts.qrId)) return false;
  try {
    const payments = await fetchQrPayments(opts.qrId);
    const captured = payments.find(
      (p) =>
        (p.status === "captured" || p.captured === true) &&
        p.amount === opts.totalInPaise
    );
    if (!captured) return false;
    const result = await markOrderPaid({
      orderId: opts.orderId,
      razorpayPaymentId: captured.id,
      amountInPaise: captured.amount,
    });
    return result.ok;
  } catch (error) {
    console.error(`QR reconcile failed for order ${opts.orderId}:`, error);
    return false;
  }
}

/**
 * Minimal poll endpoint for the embedded UPI flow. Returns no PII —
 * only `{ paymentStatus, qrStatus, expiresAt, serverNow }`.
 *
 * While the order is unpaid with an active QR it reconciles against the
 * Razorpay QR-payments API, so payments land even if the webhook never fires
 * (local dev, missed delivery). Past `qrExpiresAt` it reconciles once more
 * and, if still unpaid, closes the QR so late scans cannot succeed.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  if (!id || typeof id !== "string") {
    return noStore(
      { error: "INVALID_ID", message: "Order ID parameter is required." },
      400
    );
  }

  try {
    const prisma = getPrisma();
    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        paymentStatus: true,
        totalInPaise: true,
        razorpayQrId: true,
        qrExpiresAt: true,
      },
    });

    if (!order) {
      return noStore(
        { error: "NOT_FOUND", message: "Order was not found." },
        404
      );
    }

    const serverNow = new Date();
    const expiresAt = order.qrExpiresAt ? new Date(order.qrExpiresAt) : null;

    if (order.paymentStatus === "PAID") {
      return noStore({
        paymentStatus: "PAID",
        qrStatus: "closed" as QrStatus,
        expiresAt: expiresAt?.toISOString() ?? null,
        serverNow: serverNow.toISOString(),
      });
    }

    const hasQr = Boolean(order.razorpayQrId);
    const isExpired = expiresAt ? serverNow.getTime() > expiresAt.getTime() : true;

    // Reconcile unpaid orders that have a QR. Throttled while active; the
    // expiry transition always reconciles once more before closing.
    if (hasQr && order.razorpayQrId) {
      const qrId = order.razorpayQrId;
      const last = lastReconcileAt.get(order.id) ?? 0;
      const shouldReconcile =
        isExpired || serverNow.getTime() - last >= RECONCILE_THROTTLE_MS;

      if (shouldReconcile) {
        lastReconcileAt.set(order.id, serverNow.getTime());
        const paid = await reconcileWithRazorpay({
          orderId: order.id,
          qrId,
          totalInPaise: order.totalInPaise,
        });
        if (paid) {
          return noStore({
            paymentStatus: "PAID",
            qrStatus: "closed" as QrStatus,
            expiresAt: expiresAt?.toISOString() ?? null,
            serverNow: new Date().toISOString(),
          });
        }
      }

      if (isExpired) {
        // Visible countdown lapsed with no captured payment: close the QR so
        // a late scan cannot succeed after the customer saw "expired".
        // The stored qrId is kept so a payment captured inside the window
        // (or its webhook) can still credit the order via markOrderPaid.
        if (!isMockQrId(qrId)) {
          try {
            await closeQr(qrId);
          } catch (error) {
            console.error(`Failed to close expired QR ${qrId}:`, error);
          }
        }
        return noStore({
          paymentStatus: order.paymentStatus,
          qrStatus: "expired" as QrStatus,
          expiresAt: expiresAt?.toISOString() ?? null,
          serverNow: new Date().toISOString(),
        });
      }

      return noStore({
        paymentStatus: order.paymentStatus,
        qrStatus: "active" as QrStatus,
        expiresAt: expiresAt?.toISOString() ?? null,
        serverNow: serverNow.toISOString(),
      });
    }

    return noStore({
      paymentStatus: order.paymentStatus,
      qrStatus: "closed" as QrStatus,
      expiresAt: expiresAt?.toISOString() ?? null,
      serverNow: serverNow.toISOString(),
    });
  } catch (error) {
    console.error(`Failed to read payment status for order ${id}:`, error);
    return noStore(
      { error: "INTERNAL_ERROR", message: "Failed to read payment status." },
      500
    );
  }
}
