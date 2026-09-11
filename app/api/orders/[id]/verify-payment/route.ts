import { verifyPaymentSignature } from "@/lib/payments/razorpay";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";

interface VerifyPaymentBody {
  razorpayPaymentId: string;
  razorpaySignature?: string;
}

function parseVerifyBody(body: unknown): VerifyPaymentBody | null {
  if (typeof body !== "object" || body === null) return null;
  const { razorpayPaymentId, razorpaySignature } = body as VerifyPaymentBody;
  if (typeof razorpayPaymentId !== "string" || razorpayPaymentId.length === 0) {
    return null;
  }
  if (razorpaySignature !== undefined && typeof razorpaySignature !== "string") {
    return null;
  }
  return { razorpayPaymentId, razorpaySignature };
}

/**
 * Server-side verification of a Razorpay payment.
 *
 * The client is NEVER trusted on its own: paymentStatus can only become PAID
 * when the HMAC-SHA256 signature computed over
 *   `<razorpayOrderId>|<razorpayPaymentId>`
 * matches the signature Razorpay returned to the checkout callback.
 *
 * TODO: Add a Razorpay webhook handler (e.g. POST /api/webhooks/razorpay) to
 * catch the case where a payment succeeds on Razorpay's side but the
 * client-side verify call never completes (e.g. browser closed mid-flow, or
 * the callback handler fails). Currently the order would stay UNPAID even
 * though money was captured — the admin can reconcile manually, but a webhook
 * keyed on the payment.<id> event is the robust fix. For now this is an
 * accepted limitation.
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "INVALID_JSON", message: "Request body must contain valid JSON." },
      { status: 400 }
    );
  }

  const parsed = parseVerifyBody(body);
  if (!parsed) {
    return Response.json(
      { error: "VALIDATION_ERROR", message: "Payment verification payload is invalid." },
      { status: 400 }
    );
  }

  try {
    const prisma = getPrisma();

    const order = await prisma.order.findUnique({
      where: { id },
      select: { id: true, razorpayOrderId: true, paymentStatus: true },
    });

    if (!order || !order.razorpayOrderId) {
      return Response.json(
        { error: "NOT_FOUND", message: "Order or its Razorpay order was not found." },
        { status: 404 }
      );
    }

    // Idempotent: a payment already verified as PAID stays PAID.
    if (order.paymentStatus === "PAID") {
      return Response.json(
        { success: true, paymentStatus: "PAID" },
        { status: 200 }
      );
    }

    // No signature means the checkout reported a payment failure (the
    // `payment.failed` event). We record it so staff can follow up, but never
    // mark PAID.
    if (!parsed.razorpaySignature) {
      await prisma.order.update({
        where: { id },
        data: {
          paymentStatus: "FAILED",
          razorpayPaymentId: parsed.razorpayPaymentId,
        },
      });
      return Response.json(
        { success: false, paymentStatus: "FAILED" },
        { status: 200 }
      );
    }

    const isValid = verifyPaymentSignature({
      razorpayOrderId: order.razorpayOrderId,
      razorpayPaymentId: parsed.razorpayPaymentId,
      signature: parsed.razorpaySignature,
    });

    if (isValid) {
      await prisma.order.update({
        where: { id },
        data: {
          paymentStatus: "PAID",
          razorpayPaymentId: parsed.razorpayPaymentId,
        },
      });
      return Response.json(
        { success: true, paymentStatus: "PAID" },
        { status: 200 }
      );
    }

    // Signature mismatch — the payment did not originate from Razorpay for
    // this order. Mark FAILED so the order surfaces to staff.
    await prisma.order.update({
      where: { id },
      data: {
        paymentStatus: "FAILED",
        razorpayPaymentId: parsed.razorpayPaymentId,
      },
    });
    return Response.json(
      { success: false, error: "INVALID_SIGNATURE", paymentStatus: "FAILED" },
      { status: 403 }
    );
  } catch (error) {
    console.error(`Failed to verify payment for order ${id}:`, error);
    return Response.json(
      { error: "INTERNAL_ERROR", message: "Failed to verify payment." },
      { status: 500 }
    );
  }
}