/**
 * Dev-only mock UPI provider. Lets the full QR panel, intent buttons,
 * countdown and success animation be tested locally without real money.
 *
 * Reachability guard: every caller MUST check `isDevMockEnabled()` first —
 * mock QRs are impossible in production (`NODE_ENV === 'development'` AND
 * `ENABLE_DEV_PAYMENT_SIMULATOR === 'true'`, otherwise the simulator and
 * mock branches 404 / never run).
 *
 * Mock URIs are obviously non-payable: test VPA `nthcup-dev-mock@invalid`
 * and `tr` starting with `MOCKTR`.
 */

export const MOCK_QR_ID_PREFIX = "mock_";

export function isDevMockEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.ENABLE_DEV_PAYMENT_SIMULATOR === "true"
  );
}

export function isMockQrId(qrId: string | null | undefined): boolean {
  return typeof qrId === "string" && qrId.startsWith(MOCK_QR_ID_PREFIX);
}

function formatRupees(amountInPaise: number): string {
  return (amountInPaise / 100).toFixed(2);
}

/** Deterministic, clearly-fake `upi://pay?...` URI for local testing. */
export function buildMockUpiUri(opts: {
  orderReference: string;
  amountInPaise: number;
  issueCount: number;
}): string {
  const params = new URLSearchParams({
    pa: "nthcup-dev-mock@invalid",
    pn: "Nth Cup Caffee (TEST - NOT PAYABLE)",
    tr: `MOCKTR-${opts.orderReference}-${opts.issueCount}`,
    tn: `${opts.orderReference} test payment - DO NOT PAY`,
    am: formatRupees(opts.amountInPaise),
    cu: "INR",
    mc: "5411",
  });
  return `upi://pay?${params.toString()}`;
}
