import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { validateUpdateProductInput } from "@/lib/product-validation";

export const runtime = "nodejs";

import type { Session } from "next-auth";

interface SessionUser {
  id?: string;
  role?: string;
  cafeId?: string;
}

function getSessionCafeId(session: Session | null | undefined): string | null {
  const user = session?.user as SessionUser | undefined;
  return user?.cafeId ?? null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  if (!id || typeof id !== "string") {
    return Response.json(
      { error: "INVALID_ID", message: "Product ID parameter is required." },
      { status: 400 }
    );
  }

  try {
    const session = await getServerSession(authOptions);
    const cafeId = getSessionCafeId(session);
    if (!cafeId) {
      return Response.json(
        { error: "UNAUTHORIZED", message: "Authentication required." },
        { status: 401 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: "INVALID_JSON", message: "Request body must contain valid JSON." },
        { status: 400 }
      );
    }

    const parsed = validateUpdateProductInput(body);
    if (!parsed.success) {
      return Response.json(
        { error: "VALIDATION_ERROR", message: "Product update is invalid.", details: parsed.errors },
        { status: 400 }
      );
    }

    const prisma = getPrisma();

    // Verify the product belongs to this cafe
    const existing = await prisma.product.findFirst({
      where: { id, cafeId },
      select: { id: true, sku: true },
    });

    if (!existing) {
      return Response.json(
        { error: "NOT_FOUND", message: "Product not found in your cafe." },
        { status: 404 }
      );
    }

    // If SKU is changing, check uniqueness
    if (parsed.data.sku && parsed.data.sku !== existing.sku) {
      const skuConflict = await prisma.product.findUnique({
        where: { cafeId_sku: { cafeId, sku: parsed.data.sku } },
        select: { id: true },
      });

      if (skuConflict) {
        return Response.json(
          { error: "SKU_CONFLICT", message: `A product with SKU '${parsed.data.sku}' already exists in your cafe.` },
          { status: 409 }
        );
      }
    }

    const product = await prisma.product.update({
      where: { id },
      data: parsed.data,
      select: {
        id: true,
        cafeId: true,
        sku: true,
        name: true,
        description: true,
        priceInPaise: true,
        imageUrl: true,
        category: true,
        isAvailable: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return Response.json({ product }, { status: 200 });
  } catch (error) {
    console.error(`Failed to update product ${id}:`, error);
    return Response.json(
      { error: "INTERNAL_ERROR", message: "Failed to update product." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  if (!id || typeof id !== "string") {
    return Response.json(
      { error: "INVALID_ID", message: "Product ID parameter is required." },
      { status: 400 }
    );
  }

  try {
    const session = await getServerSession(authOptions);
    const cafeId = getSessionCafeId(session);
    if (!cafeId) {
      return Response.json(
        { error: "UNAUTHORIZED", message: "Authentication required." },
        { status: 401 }
      );
    }

    const prisma = getPrisma();

    // Verify the product belongs to this cafe
    const existing = await prisma.product.findFirst({
      where: { id, cafeId },
      select: { id: true },
    });

    if (!existing) {
      return Response.json(
        { error: "NOT_FOUND", message: "Product not found in your cafe." },
        { status: 404 }
      );
    }

    // Soft-delete: set isAvailable to false (hard-delete would break OrderItem FK)
    await prisma.product.update({
      where: { id },
      data: { isAvailable: false },
    });

    return Response.json(
      { success: true, message: "Product has been marked as unavailable." },
      { status: 200 }
    );
  } catch (error) {
    console.error(`Failed to delete product ${id}:`, error);
    return Response.json(
      { error: "INTERNAL_ERROR", message: "Failed to delete product." },
      { status: 500 }
    );
  }
}
