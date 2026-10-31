/**
 * UPI deep-link builders + device detection for the embedded UPI flow.
 *
 * Rule: every query param of Razorpay's `image_content` URI (`pa`, `pn`,
 * `tr`, `tn`, `am`, `cu`, `mc`) is preserved byte-for-byte — Razorpay
 * attributes payments via `tr`. Only the scheme/host/prefix changes per app.
 *
 * NOTE: per-app schemes/packages below are commonly-used patterns, not
 * official guarantees — UPI apps do not publish stable deep-link contracts.
 * The raw `upi://` URI ("Other UPI app") is always offered as the fallback,
 * and `scripts/test-upi.ts` asserts the query string survives every builder.
 */

export type UpiAppId = "gpay" | "phonepe" | "paytm" | "cred";
export type UpiPlatform = "android" | "ios" | "other";

export interface UpiApp {
  id: UpiAppId;
  name: string;
  androidPackage: string;
}

export const UPI_APPS: UpiApp[] = [
  {
    id: "gpay",
    name: "Google Pay",
    androidPackage: "com.google.android.apps.nbu.paisa.user",
  },
  { id: "phonepe", name: "PhonePe", androidPackage: "com.phonepe.app" },
  { id: "paytm", name: "Paytm", androidPackage: "net.one97.paytm" },
  { id: "cred", name: "CRED", androidPackage: "com.dreamplug.androidapp" },
];

const IOS_SCHEMES: Record<UpiAppId, string> = {
  gpay: "gpay://upi/pay",
  phonepe: "phonepe://pay",
  paytm: "paytmmp://pay",
  cred: "credpay://upi/pay",
};

/** Returns the raw query string (after the first `?`), byte-for-byte. */
export function getUpiQuery(upiUri: string): string {
  const idx = upiUri.indexOf("?");
  return idx >= 0 ? upiUri.slice(idx + 1) : "";
}

/** Android: `intent://pay?<same query>#Intent;scheme=upi;package=<pkg>;end` */
export function buildAndroidIntentLink(
  upiUri: string,
  androidPackage: string
): string {
  return `intent://pay?${getUpiQuery(upiUri)}#Intent;scheme=upi;package=${androidPackage};end`;
}

/** iOS: per-app custom scheme with the same query string. */
export function buildIosAppLink(upiUri: string, appId: UpiAppId): string {
  return `${IOS_SCHEMES[appId]}?${getUpiQuery(upiUri)}`;
}

/** Picks the right per-app link for the platform; `other` → raw `upi://`. */
export function buildAppLink(
  upiUri: string,
  app: UpiApp,
  platform: UpiPlatform
): string {
  if (platform === "android") {
    return buildAndroidIntentLink(upiUri, app.androidPackage);
  }
  if (platform === "ios") {
    return buildIosAppLink(upiUri, app.id);
  }
  return upiUri;
}

/** SSR-safe: returns `"other"` when `window`/`navigator` are unavailable. */
export function detectPlatform(): UpiPlatform {
  if (typeof navigator === "undefined" || typeof window === "undefined") {
    return "other";
  }
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "android";
  if (/iPad|iPhone|iPod/i.test(ua)) return "ios";
  return "other";
}

/**
 * SSR-safe coarse-pointer check for showing the one-tap app buttons.
 * True for phones/tablets (`(pointer: coarse)`) or when the UA is mobile.
 */
export function isMobileUpiDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  const coarse =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;
  const ua = navigator.userAgent || "";
  const mobileUa = /android|iPad|iPhone|iPod|mobile/i.test(ua);
  return coarse || mobileUa;
}
