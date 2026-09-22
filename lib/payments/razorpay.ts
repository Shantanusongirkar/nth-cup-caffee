import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Zero-dependency Razorpay helpers.
 *
 * Operations:
 *   1. Create a payment Order server-side (so the amount is server-controlled).
 *   2. Verify the payment signature with the webhook/checkout callback.
 *   3. Create / fetch-payments / close UPI QR codes (`POST /v1/payments/qr_codes`).
 *   4. Verify webhook signatures (HMAC-SHA256 over the RAW body).
 * All done with built-in `fetch` + `node:crypto` — no npm package required.
 *
 * Endpoint paths, event names and payload shapes verified against the current
 * Razorpay docs (docs/api/qr-codes/*, docs/webhooks/*, Sept 2026):
 *   POST /v1/payments/qr_codes
 *   POST /v1/payments/qr_codes/:id/close
 *   GET  /v1/payments/qr_codes/:id/payments
 *   events: qr_code.credited, qr_code.closed, payment.captured
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

/* ---------- UPI QR Codes ---------- */

export interface RazorpayQrCode {
  id: string;
  entity: string;
  status: string;
  type?: string;
  usage?: string;
  image_url?: string;
  /** Raw `upi://pay?...` string. Only present when the `qr_image_content`
   *  feature is enabled on the Razorpay account (on-demand). */
  image_content?: string;
  payment_amount?: number;
  fixed_amount?: boolean;
  close_by?: number | null;
  closed_at?: number | null;
  close_reason?: string | null;
  notes?: Record<string, string>;
}

export interface RazorpayQrPayment {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  status: string;
  method?: string;
  captured?: boolean;
  created_at?: number;
}

/**
 * Creates a single-use fixed-amount UPI QR for the given amount (paise).
 * `closeByUnix` must be >= ~15 min in the future per Razorpay (the visible
 * countdown is shorter and enforced separately via `qrExpiresAt`).
 * Throws on failure — callers degrade to popup/counter. When the account
 * lacks the QR feature Razorpay returns 4xx; callers treat that as
 * "unavailable" rather than a hard error.
 */
export async function createUpiQr(opts: {
  amountInPaise: number;
  closeByUnix: number;
  notes: Record<string, string | undefined>;
  description?: string;
  name?: string;
}): Promise<RazorpayQrCode> {
  const body = {
    type: "upi_qr",
    usage: "single_use",
    fixed_amount: true,
    payment_amount: opts.amountInPaise,
    description: opts.description ?? "Nth Cup Caffee order payment",
    name: opts.name ?? "Nth Cup Caffee",
    close_by: opts.closeByUnix,
    notes: opts.notes,
  };

  const res = await fetch(`${RAZORPAY_API_BASE}/payments/qr_codes`, {
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
    throw new Error(`Razorpay create-qr failed (${res.status}): ${text}`);
  }

  return (await res.json()) as RazorpayQrCode;
}

/** Fetches captured/attempted payments for a QR code. */
export async function fetchQrPayments(
  qrId: string,
  count = 100
): Promise<RazorpayQrPayment[]> {
  const url = `${RAZORPAY_API_BASE}/payments/qr_codes/${encodeURIComponent(qrId)}/payments?count=${count}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: basicAuthHeader() },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Razorpay fetch-qr-payments failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    entity: string;
    count: number;
    items: RazorpayQrPayment[];
  };
  return Array.isArray(data.items) ? data.items : [];
}

/**
 * Closes a QR code so late scans cannot succeed. Idempotent: an already
 * closed QR (Razorpay 400) is treated as success.
 */
export async function closeQr(qrId: string): Promise<void> {
  const res = await fetch(
    `${RAZORPAY_API_BASE}/payments/qr_codes/${encodeURIComponent(qrId)}/close`,
    {
      method: "POST",
      headers: { Authorization: basicAuthHeader() },
      cache: "no-store",
    }
  );

  if (res.ok) return;
  const text = await res.text().catch(() => "");
  // Already closed / not found — nothing left to do.
  if (res.status === 400 || res.status === 404) return;
  throw new Error(`Razorpay close-qr failed (${res.status}): ${text}`);
}

/**
 * Verifies a Razorpay webhook signature: HMAC-SHA256 of the RAW request body
 * with `RAZORPAY_WEBHOOK_SECRET` as key, compared against the
 * `X-Razorpay-Signature` header. Length-check first, then `timingSafeEqual`.
 * `rawBody` must be the untouched body (`await request.text()` — never
 * re-stringified JSON, whose encoding may differ from Razorpay's).
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null | undefined
): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";
  if (!secret || !signature) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}