import { getPrisma } from "@/lib/prisma";
import { verifyWebhookSignature } from "@/lib/payments/razorpay";
import { markOrderPaid } from "@/lib/payments/mark-paid";

export const runtime = "nodejs";

interface WebhookPaymentEntity {
  id?: string;
  amount?: number;
  status?: string;
  captured?: boolean;
}

interface WebhookQrEntity {
  id?: string;
}

/**
 * Razorpay webhook endpoint (public — `proxy.ts` only matches `/admin` and
 * `/api/admin`, so nothing blocks this route).
 *
 * Verified against current Razorpay docs (docs/webhooks/*, docs/api/qr-codes):
 * - Signature: HMAC-SHA256 of the RAW body with the webhook secret, sent as
 *   `X-Razorpay-Signature`. We read `await request.text()` and never
 *   re-stringify (JSON re-encoding can differ from Razorpay's bytes).
 * - `qr_code.credited` payload: `{ payload: { payment: { entity },
 *   qr_code: { entity } } }`.
 * - `payment.captured` payload: `{ payload: { payment: { entity } } }` — it
 *   only carries QR info when a `qr_code` object is present; otherwise it is
 *   ignored here (the checkout `verify-payment` route owns Order payments).
 */
export async function POST(request: Request) {
  const rawBody = await request.text().catch(() => "");
  const signature = request.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return Response.json(
      { error: "INVALID_SIGNATURE", message: "Webhook signature mismatch." },
      { status: 400 }
    );
  }

  let event: unknown;
  try {
    event = JSON.parse(rawBody) as unknown;
  } catch {
    return Response.json(
      { error: "INVALID_JSON", message: "Webhook body must be valid JSON." },
      { status: 400 }
    );
  }

  if (typeof event !== "object" || event === null) {
    return Response.json({ received: true }, { status: 200 });
  }

  const { event: eventName, payload } = event as {
    event?: string;
    payload?: {
      payment?: { entity?: WebhookPaymentEntity };
      qr_code?: { entity?: WebhookQrEntity };
    };
  };

  try {
    if (eventName === "qr_code.credited") {
      const qrId = payload?.qr_code?.entity?.id;
      const payment = payload?.payment?.entity;
      if (!qrId || !payment?.id || typeof payment.amount !== "number") {
        return Response.json({ received: true }, { status: 200 });
      }
      if (payment.status !== "captured" && payment.captured !== true) {
        return Response.json({ received: true }, { status: 200 });
      }

      const prisma = getPrisma();
      const order = await prisma.order.findUnique({
        where: { razorpayQrId: qrId },
        select: { id: true },
      });
      if (!order) {
        return Response.json({ received: true }, { status: 200 });
      }

      // Amount-guarded + idempotent inside markOrderPaid.
      await markOrderPaid({
        orderId: order.id,
        razorpayPaymentId: payment.id,
        amountInPaise: payment.amount,
      });
      return Response.json({ received: true }, { status: 200 });
    }

    if (eventName === "payment.captured") {
      // Only QR-linked captures belong here; anything without QR info is the
      // checkout Order flow's business and is ignored (200).
      const qrId = payload?.qr_code?.entity?.id;
      const payment = payload?.payment?.entity;
      if (!qrId || !payment?.id || typeof payment.amount !== "number") {
        return Response.json({ received: true }, { status: 200 });
      }

      const prisma = getPrisma();
      const order = await prisma.order.findUnique({
        where: { razorpayQrId: qrId },
        select: { id: true },
      });
      if (!order) {
        return Response.json({ received: true }, { status: 200 });
      }

      await markOrderPaid({
        orderId: order.id,
        razorpayPaymentId: payment.id,
        amountInPaise: payment.amount,
      });
      return Response.json({ received: true }, { status: 200 });
    }

    // qr_code.closed, qr_code.created, order.paid, refund.*, etc. — the
    // polling reconciler owns expiry; nothing to do.
    return Response.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("Razorpay webhook handling failed:", error);
    // Return 200 so Razorpay does not retry a poison event forever; the
    // poller reconciles unpaid orders independently.
    return Response.json({ received: true }, { status: 200 });
  }
}
