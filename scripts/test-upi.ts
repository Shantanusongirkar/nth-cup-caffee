/**
 * Asserts that every UPI deep-link builder preserves Razorpay's query string
 * byte-for-byte (Razorpay attributes payments via `tr`).
 * Run with: `npx tsx scripts/test-upi.ts`
 */
import assert from "node:assert";
import {
  UPI_APPS,
  buildAndroidIntentLink,
  buildAppLink,
  buildIosAppLink,
  getUpiQuery,
} from "../lib/upi";

const SAMPLE =
  "upi://pay?pa=qmart.razorpay@hdfcbank&pn=TestAccount&tr=RZPGT5viB4WHeoUuuqrv2&tn=TestAccountRaftarSoft&am=100&cu=INR&mc=5411";
const EXPECTED_QUERY =
  "pa=qmart.razorpay@hdfcbank&pn=TestAccount&tr=RZPGT5viB4WHeoUuuqrv2&tn=TestAccountRaftarSoft&am=100&cu=INR&mc=5411";

function queryOf(link: string): string {
  // Android intent links wrap the query: intent://pay?<q>#Intent;...;end
  if (link.startsWith("intent://pay?")) {
    const end = link.indexOf("#Intent;");
    assert.ok(end > 0, `intent link missing #Intent marker: ${link}`);
    assert.ok(link.endsWith(";end"), `intent link missing ;end: ${link}`);
    return link.slice("intent://pay?".length, end);
  }
  return link.slice(link.indexOf("?") + 1);
}

// getUpiQuery keeps the query byte-for-byte
assert.strictEqual(getUpiQuery(SAMPLE), EXPECTED_QUERY);

// Android intents preserve the query for every app package
for (const app of UPI_APPS) {
  const link = buildAndroidIntentLink(SAMPLE, app.androidPackage);
  assert.ok(
    link.includes(`package=${app.androidPackage}`),
    `${app.id} intent missing package`
  );
  assert.strictEqual(
    queryOf(link),
    EXPECTED_QUERY,
    `${app.id} android query changed`
  );
}

// iOS schemes preserve the query for every app
const iosPrefixes = {
  gpay: "gpay://upi/pay?",
  phonepe: "phonepe://pay?",
  paytm: "paytmmp://pay?",
  cred: "credpay://upi/pay?",
} as const;
for (const app of UPI_APPS) {
  const link = buildIosAppLink(SAMPLE, app.id);
  assert.ok(
    link.startsWith(iosPrefixes[app.id]),
    `${app.id} ios scheme wrong: ${link}`
  );
  assert.strictEqual(
    queryOf(link),
    EXPECTED_QUERY,
    `${app.id} ios query changed`
  );
}

// buildAppLink dispatches per platform and keeps the raw URI for "other"
for (const app of UPI_APPS) {
  assert.strictEqual(
    queryOf(buildAppLink(SAMPLE, app, "android")),
    EXPECTED_QUERY
  );
  assert.strictEqual(queryOf(buildAppLink(SAMPLE, app, "ios")), EXPECTED_QUERY);
  assert.strictEqual(buildAppLink(SAMPLE, app, "other"), SAMPLE);
}

// Encoded characters must survive untouched (byte-for-byte, no re-encoding)
const ENCODED =
  "upi://pay?pa=test%40upi&pn=Acme%20Caf%C3%A9&tr=RZPabc123&tn=Order%20%231&am=299.00&cu=INR&mc=5411";
const encodedQuery = getUpiQuery(ENCODED);
for (const app of UPI_APPS) {
  assert.strictEqual(
    queryOf(buildAndroidIntentLink(ENCODED, app.androidPackage)),
    encodedQuery
  );
  assert.strictEqual(
    queryOf(buildIosAppLink(ENCODED, app.id)),
    encodedQuery
  );
}

console.log("test-upi: all assertions passed");
