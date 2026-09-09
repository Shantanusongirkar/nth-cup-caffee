import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { validateCreateProductInput } from "@/lib/product-validation";

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

export async function GET() {
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

    const [products, stats] = await Promise.all([
      prisma.product.findMany({
        where: { cafeId },
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
          _count: { select: { orderItems: true } },
        },
        orderBy: [{ category: "asc" }, { name: "asc" }],
      }),
      prisma.product.aggregate({
        where: { cafeId },
        _count: { id: true },
      }),
    ]);

    const availableCount = await prisma.product.count({
      where: { cafeId, isAvailable: true },
    });

    const categories = await prisma.product.findMany({
      where: { cafeId },
      select: { category: true },
      distinct: ["category"],
    });

    return Response.json(
      {
        products,
        stats: {
          totalProducts: stats._count.id,
          availableProducts: availableCount,
          unavailableProducts: stats._count.id - availableCount,
          categories: categories.length,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to fetch products:", error);
    return Response.json(
      { error: "INTERNAL_ERROR", message: "Failed to retrieve products." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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

    const parsed = validateCreateProductInput(body);
    if (!parsed.success) {
      return Response.json(
        { error: "VALIDATION_ERROR", message: "Product data is invalid.", details: parsed.errors },
        { status: 400 }
      );
    }

    const prisma = getPrisma();

    // Check SKU uniqueness within this cafe
    const existing = await prisma.product.findUnique({
      where: { cafeId_sku: { cafeId, sku: parsed.data.sku } },
      select: { id: true },
    });

    if (existing) {
      return Response.json(
        { error: "SKU_CONFLICT", message: `A product with SKU '${parsed.data.sku}' already exists in your cafe.` },
        { status: 409 }
      );
    }

    const product = await prisma.product.create({
      data: {
        cafeId,
        sku: parsed.data.sku,
        name: parsed.data.name,
        description: parsed.data.description,
        priceInPaise: parsed.data.priceInPaise,
        imageUrl: parsed.data.imageUrl,
        category: parsed.data.category,
        isAvailable: parsed.data.isAvailable,
      },
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

    return Response.json({ product }, { status: 201 });
  } catch (error) {
    console.error("Failed to create product:", error);
    return Response.json(
      { error: "INTERNAL_ERROR", message: "Failed to create product." },
      { status: 500 }
    );
  }
}
