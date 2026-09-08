import { MenuCategory } from "@/types";

export interface CreateProductInput {
  sku: string;
  name: string;
  description: string;
  priceInPaise: number;
  imageUrl?: string;
  category: string;
  isAvailable: boolean;
}

export interface UpdateProductInput {
  sku?: string;
  name?: string;
  description?: string;
  priceInPaise?: number;
  imageUrl?: string;
  category?: string;
  isAvailable?: boolean;
}

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

const VALID_CATEGORIES: readonly MenuCategory[] = ["coffee", "tea", "snacks", "desserts"];

/** Parses untrusted JSON for product creation. */
export function validateCreateProductInput(value: unknown): { success: true; data: CreateProductInput } | { success: false; errors: string[] } {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { success: false, errors: ["Request body must be a JSON object."] };
  }

  const sku = requiredString(value.sku, "sku", errors, 100);
  const name = requiredString(value.name, "name", errors, 200);
  const description = requiredString(value.description, "description", errors, 2000);
  const imageUrl = optionalString(value.imageUrl, "imageUrl", errors, 2000);

  if (typeof value.priceInPaise !== "number" || !Number.isInteger(value.priceInPaise) || value.priceInPaise < 1) {
    errors.push("priceInPaise must be a positive integer (minimum 1 paise).");
  }

  if (typeof value.category !== "string" || !VALID_CATEGORIES.includes(value.category as MenuCategory)) {
    errors.push(`category must be one of: ${VALID_CATEGORIES.join(", ")}.`);
  }

  const isAvailable = typeof value.isAvailable === "boolean" ? value.isAvailable : true;

  if (errors.length > 0 || !sku || !name || !description) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      sku,
      name,
      description,
      priceInPaise: value.priceInPaise as number,
      imageUrl,
      category: value.category as string,
      isAvailable,
    },
  };
}

/** Parses untrusted JSON for product update (all fields optional). */
export function validateUpdateProductInput(value: unknown): { success: true; data: UpdateProductInput } | { success: false; errors: string[] } {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { success: false, errors: ["Request body must be a JSON object."] };
  }

  const hasAnyField =
    value.sku !== undefined ||
    value.name !== undefined ||
    value.description !== undefined ||
    value.priceInPaise !== undefined ||
    value.imageUrl !== undefined ||
    value.category !== undefined ||
    value.isAvailable !== undefined;

  if (!hasAnyField) {
    return { success: false, errors: ["At least one field must be provided for update."] };
  }

  const data: UpdateProductInput = {};

  if (value.sku !== undefined) {
    const sku = requiredString(value.sku, "sku", errors, 100);
    if (sku) data.sku = sku;
  }

  if (value.name !== undefined) {
    const name = requiredString(value.name, "name", errors, 200);
    if (name) data.name = name;
  }

  if (value.description !== undefined) {
    const description = requiredString(value.description, "description", errors, 2000);
    if (description) data.description = description;
  }

  if (value.priceInPaise !== undefined) {
    if (typeof value.priceInPaise !== "number" || !Number.isInteger(value.priceInPaise) || value.priceInPaise < 1) {
      errors.push("priceInPaise must be a positive integer (minimum 1 paise).");
    } else {
      data.priceInPaise = value.priceInPaise;
    }
  }

  if (value.imageUrl !== undefined) {
    data.imageUrl = optionalString(value.imageUrl, "imageUrl", errors, 2000);
  }

  if (value.category !== undefined) {
    if (typeof value.category !== "string" || !VALID_CATEGORIES.includes(value.category as MenuCategory)) {
      errors.push(`category must be one of: ${VALID_CATEGORIES.join(", ")}.`);
    } else {
      data.category = value.category;
    }
  }

  if (value.isAvailable !== undefined) {
    if (typeof value.isAvailable !== "boolean") {
      errors.push("isAvailable must be a boolean.");
    } else {
      data.isAvailable = value.isAvailable;
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data };
}
