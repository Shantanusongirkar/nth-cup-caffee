import { getPrisma } from "@/lib/prisma";

export interface MarkPaidResult {
  ok: boolean;
  alreadyPaid: boolean;
  reason?: "NOT_FOUND" | "AMOUNT_MISMATCH" | "NOT_UNPAID";
}

/**
 * Single shared path to PAID for UPI QR payments (polling reconciliation,
 * webhook handler, dev simulator).
 *
 * Rules:
 * - The amount always comes from the DB order, never the client: the caller's
 *   `amountInPaise` (captured amount from Razorpay) must equal
 *   `order.totalInPaise` or the transition is refused.
 * - Idempotent and race-safe: a single `updateMany` guarded by
 *   `paymentStatus != PAID` (and expected UNPAID-ish states), so concurrent
 *   webhook + poll + simulator calls can only ever flip UNPAID -> PAID once.
 * - Never downgrades PAID: once PAID, further calls are no-ops returning
 *   `alreadyPaid: true`.
 */
export async function markOrderPaid(opts: {
  orderId: string;
  razorpayPaymentId: string;
  amountInPaise: number;
}): Promise<MarkPaidResult> {
  const prisma = getPrisma();

  const order = await prisma.order.findUnique({
    where: { id: opts.orderId },
    select: { id: true, totalInPaise: true, paymentStatus: true },
  });

  if (!order) return { ok: false, alreadyPaid: false, reason: "NOT_FOUND" };
  if (order.paymentStatus === "PAID") {
    return { ok: true, alreadyPaid: true };
  }
  if (opts.amountInPaise !== order.totalInPaise) {
    return { ok: false, alreadyPaid: false, reason: "AMOUNT_MISMATCH" };
  }

  const updated = await prisma.order.updateMany({
    where: {
      id: opts.orderId,
      paymentStatus: { not: "PAID" },
    },
    data: {
      paymentStatus: "PAID",
      razorpayPaymentId: opts.razorpayPaymentId,
    },
  });

  if (updated.count === 0) {
    // Lost a race with another marker — re-read to confirm PAID.
    const reread = await prisma.order.findUnique({
      where: { id: opts.orderId },
      select: { paymentStatus: true },
    });
    if (reread?.paymentStatus === "PAID") {
      return { ok: true, alreadyPaid: true };
    }
    return { ok: false, alreadyPaid: false, reason: "NOT_UNPAID" };
  }

  return { ok: true, alreadyPaid: false };
}
