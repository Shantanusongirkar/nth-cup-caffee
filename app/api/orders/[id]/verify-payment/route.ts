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
 * When the signature is missing entirely the request is rejected (400) with
 * no write, and a mismatched signature is rejected (403) with no write —
 * only a valid signature may change state (to PAID). Nothing in this route
 * can confirm, fail, or otherwise mutate an order on an unauthenticated
 * claim.
 *
 * QR-code payments are confirmed separately via the signature-verified webhook
 * (POST /api/webhooks/razorpay) and the polling reconciler
 * (GET /api/orders/[id]/payment-status), which cover the case where a payment
 * succeeds on Razorpay's side but this client-side verify call never
 * completes (e.g. browser closed mid-flow).
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

    // Missing signature: never mutate on an unauthenticated claim. The
    // checkout `payment.failed` path settles client-side and never calls this
    // endpoint, so there is no legitimate caller without a signature.
    if (!parsed.razorpaySignature) {
      return Response.json(
        {
          error: "VALIDATION_ERROR",
          message: "razorpaySignature is required to verify a payment.",
        },
        { status: 400 }
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

    // Signature mismatch: the payment did not originate from Razorpay for
    // this order. Record nothing — only a valid signature may change state.
    return Response.json(
      { success: false, error: "INVALID_SIGNATURE", paymentStatus: order.paymentStatus },
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