import { OrderStatus } from "@/types";

export interface CreateOrderInput {
  cafeSlug: string;
  customer: { name: string; phone?: string; email?: string };
  items: Array<{ productSku: string; quantity: number }>;
  tableNumber?: string;
  notes?: string;
}

type ValidationResult =
  | { success: true; data: CreateOrderInput }
  | { success: false; errors: string[] };

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string, errors: string[], maxLength: number) {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${field} is required.`);
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    errors.push(`${field} must be at most ${maxLength} characters.`);
    return undefined;
  }

  return trimmed;
}

function optionalString(value: unknown, field: string, errors: string[], maxLength: number) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    errors.push(`${field} must be a string.`);
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    errors.push(`${field} must be at most ${maxLength} characters.`);
    return undefined;
  }

  return trimmed || undefined;
}

/** Parses untrusted JSON at the HTTP boundary into a typed order request. */
export function validateCreateOrderInput(value: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { success: false, errors: ["Request body must be a JSON object."] };
  }

  const cafeSlug = requiredString(value.cafeSlug, "cafeSlug", errors, 100);
  const tableNumber = optionalString(value.tableNumber, "tableNumber", errors, 30);
  const notes = optionalString(value.notes, "notes", errors, 1_000);

  let customer: CreateOrderInput["customer"] | undefined;
  if (!isRecord(value.customer)) {
    errors.push("customer must be an object.");
  } else {
    const name = requiredString(value.customer.name, "customer.name", errors, 120);
    const phone = optionalString(value.customer.phone, "customer.phone", errors, 30);
    const email = optionalString(value.customer.email, "customer.email", errors, 254);

    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      errors.push("customer.email must be a valid email address.");
    }

    if (name) customer = { name, phone, email };
  }

  const items: CreateOrderInput["items"] = [];
  if (!Array.isArray(value.items) || value.items.length === 0) {
    errors.push("items must contain at least one item.");
  } else if (value.items.length > 20) {
    errors.push("items must contain at most 20 items.");
  } else {
    const productSkus = new Set<string>();

    value.items.forEach((item, index) => {
      if (!isRecord(item)) {
        errors.push(`items[${index}] must be an object.`);
        return;
      }

      const productSku = requiredString(item.productSku, `items[${index}].productSku`, errors, 100);
      if (typeof item.quantity !== "number" || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 50) {
        errors.push(`items[${index}].quantity must be an integer between 1 and 50.`);
        return;
      }

      if (!productSku) return;
      if (productSkus.has(productSku)) {
        errors.push(`items[${index}].productSku must not be duplicated.`);
        return;
      }

      productSkus.add(productSku);
      items.push({ productSku, quantity: item.quantity });
    });
  }

  if (errors.length > 0 || !cafeSlug || !customer) {
    return { success: false, errors };
  }

  return { success: true, data: { cafeSlug, customer, items, tableNumber, notes } };
}

const VALID_STATUSES: readonly OrderStatus[] = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"] as const;

export function validateUpdateOrderStatusInput(value: unknown): { success: true; data: { status: OrderStatus } } | { success: false; errors: string[] } {
  if (!isRecord(value)) {
    return { success: false, errors: ["Request body must be a JSON object."] };
  }

  if (typeof value.status !== "string" || !VALID_STATUSES.includes(value.status as OrderStatus)) {
    return {
      success: false,
      errors: [`status must be one of: ${VALID_STATUSES.join(", ")}`],
    };
  }

  return { success: true, data: { status: value.status as OrderStatus } };
}
