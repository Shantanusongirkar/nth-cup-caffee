import { getPrisma } from "@/lib/prisma";
import { MenuItem, MenuCategory } from "@/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cafeSlug = searchParams.get("cafeSlug") || "nth-cup-demo";

    const prisma = getPrisma();
    const cafe = await prisma.cafe.findUnique({
      where: { slug: cafeSlug },
      select: { id: true, name: true },
    });

    if (!cafe) {
      return Response.json(
        { error: "NOT_FOUND", message: `Cafe '${cafeSlug}' not found.` },
        { status: 404 }
      );
    }

    const products = await prisma.product.findMany({
      where: { cafeId: cafe.id },
      select: {
        id: true,
        sku: true,
        name: true,
        description: true,
        priceInPaise: true,
        imageUrl: true,
        category: true,
        isAvailable: true,
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    const items: MenuItem[] = products.map((product) => ({
      id: product.sku,
      name: product.name,
      description: product.description,
      price: Math.round(product.priceInPaise / 100),
      image: product.imageUrl || "/menu/cappuccino.png",
      category: product.category as MenuCategory,
      available: product.isAvailable,
    }));

    return Response.json({ items, cafeName: cafe.name }, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch menu items:", error);
    return Response.json(
      { error: "INTERNAL_ERROR", message: "Failed to retrieve menu." },
      { status: 500 }
    );
  }
}
