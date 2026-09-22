import { getPrisma } from "@/lib/prisma";
import { markOrderPaid } from "@/lib/payments/mark-paid";
import { isDevMockEnabled } from "@/lib/payments/dev-mock";

export const runtime = "nodejs";

/**
 * Dev-only UPI payment simulator — drives the paid animation + `/success`
 * transition without real money.
 *
 * Razorpay docs offer no test-mode API to simulate a QR payment (QR Codes is
 * on-demand; webhooks are only testable via real test-mode transactions), so
 * this endpoint calls the same shared `markOrderPaid` the webhook and the
 * poll reconciler use. Guarded to be unreachable outside local dev:
 * anything else gets a 404 as if the route did not exist.
 */
export async function POST(request: Request) {
  if (!isDevMockEnabled()) {
    return Response.json(
      { error: "NOT_FOUND", message: "Not found." },
      { status: 404 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "INVALID_JSON", message: "Request body must contain valid JSON." },
      { status: 400 }
    );
  }

  const orderId =
    typeof body === "object" && body !== null
      ? (body as { orderId?: unknown }).orderId
      : undefined;

  if (typeof orderId !== "string" || orderId.length === 0) {
    return Response.json(
      { error: "VALIDATION_ERROR", message: "orderId is required." },
      { status: 400 }
    );
  }

  try {
    const prisma = getPrisma();
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, totalInPaise: true, paymentStatus: true },
    });

    if (!order) {
      return Response.json(
        { error: "NOT_FOUND", message: "Order was not found." },
        { status: 404 }
      );
    }

    const result = await markOrderPaid({
      orderId: order.id,
      razorpayPaymentId: `pay_mock_${Date.now().toString(36)}`,
      amountInPaise: order.totalInPaise,
    });

    if (!result.ok && result.reason === "AMOUNT_MISMATCH") {
      return Response.json(
        { error: "AMOUNT_MISMATCH", message: "Amount mismatch." },
        { status: 422 }
      );
    }

    return Response.json(
      { success: true, paymentStatus: "PAID", alreadyPaid: result.alreadyPaid },
      { status: 200 }
    );
  } catch (error) {
    console.error(`Dev payment simulation failed for ${orderId}:`, error);
    return Response.json(
      { error: "INTERNAL_ERROR", message: "Simulation failed." },
      { status: 500 }
    );
  }
}
