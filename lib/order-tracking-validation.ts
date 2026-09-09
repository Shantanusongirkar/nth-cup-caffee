type TrackingResult =
  | { success: true; data: { orderRef: string; orderId: string; phoneLast4?: string } }
  | { success: false; errors: string[] };

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Strips the NC- prefix and any non-alphanumeric characters from an order reference,
 * returning the raw ID portion (first 8 chars, uppercased).
 */
export function parseOrderReference(ref: string): string | null {
  const cleaned = ref.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (cleaned.length < 1) return null;
  return cleaned.slice(0, 8);
}

/**
 * Parses untrusted JSON at the HTTP boundary into a typed tracking request.
 * Requires orderRef; optionally accepts phoneLast4 for lightweight auth.
 */
export function validateTrackingInput(value: unknown): TrackingResult {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { success: false, errors: ["Request body must be a JSON object."] };
  }

  if (typeof value.orderRef !== "string" || value.orderRef.trim().length === 0) {
    errors.push("orderRef is required.");
    return { success: false, errors };
  }

  const orderRef = value.orderRef.trim().toUpperCase();

  // Validate format: NC-XXXXXXXX (NC- prefix followed by alphanumeric)
  if (!/^NC-[A-Z0-9]{4,}$/.test(orderRef)) {
    errors.push("orderRef must be in the format NC-XXXXXXXX (e.g. NC-A1B2C3D4).");
    return { success: false, errors };
  }

  const orderId = parseOrderReference(orderRef);
  if (!orderId) {
    errors.push("Could not parse order reference.");
    return { success: false, errors };
  }

  let phoneLast4: string | undefined;
  if (value.phoneLast4 !== undefined && value.phoneLast4 !== null) {
    if (typeof value.phoneLast4 !== "string") {
      errors.push("phoneLast4 must be a string.");
      return { success: false, errors };
    }
    const digits = value.phoneLast4.replace(/\D/g, "");
    if (digits.length !== 4) {
      errors.push("phoneLast4 must be exactly 4 digits.");
      return { success: false, errors };
    }
    phoneLast4 = digits;
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: { orderRef, orderId, phoneLast4 } };
}
