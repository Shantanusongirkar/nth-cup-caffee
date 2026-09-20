import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Zero-dependency Razorpay helpers.
 *
 * We only need two operations from Razorpay:
 *   1. Create a payment Order server-side (so the amount is server-controlled).
 *   2. Verify the payment signature with the webhook/checkout callback.
 * Both are done with built-in `fetch` + `node:crypto` — no npm package required.
 */

const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

export function isRazorpayConfigured(): boolean {
  return Boolean(
    process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
  );
}

function basicAuthHeader(): string {
  const keyId = process.env.RAZORPAY_KEY_ID ?? "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET ?? "";
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

export interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  attempts: number;
  created_at: number;
}

/**
 * Creates a Razorpay Order for the given amount (in paise).
 * Throws on failure so callers can degrade gracefully to "pay at counter".
 */
export async function createRazorpayOrder(opts: {
  amountInPaise: number;
  receipt: string;
  notes?: Record<string, string | undefined>;
}): Promise<RazorpayOrder> {
  const body = {
    amount: opts.amountInPaise,
    currency: "INR",
    receipt: opts.receipt,
    notes: opts.notes,
  };

  const res = await fetch(`${RAZORPAY_API_BASE}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: basicAuthHeader(),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Razorpay create-order failed (${res.status}): ${text}`);
  }

  return (await res.json()) as RazorpayOrder;
}

/**
 * Verifies a Razorpay payment signature (HMAC-SHA256).
 * Returns true only if the signature matches the server-known order + payment IDs.
 * This is the ONLY way a payment should be marked PAID — never trust the client alone.
 */
export function verifyPaymentSignature(opts: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  signature: string;
}): boolean {
  const keySecret = process.env.RAZORPAY_KEY_SECRET ?? "";
  if (!keySecret) return false;

  const payload = `${opts.razorpayOrderId}|${opts.razorpayPaymentId}`;
  const expected = createHmac("sha256", keySecret).update(payload).digest("hex");

  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(opts.signature);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}