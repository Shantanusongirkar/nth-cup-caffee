import { validateCreateOrderInput } from "@/lib/order-validation";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Matches the current 5% placeholder tax used by the existing cart UI.
const TAX_RATE = 0.05;

class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "INVALID_JSON", message: "Request body must contain valid JSON." },
      { status: 400 }
    );
  }

  const parsed = validateCreateOrderInput(body);
  if (!parsed.success) {
    return Response.json(
      { error: "VALIDATION_ERROR", message: "Order request is invalid.", details: parsed.errors },
      { status: 400 }
    );
  }

  try {
    const prisma = getPrisma();
    const order = await prisma.$transaction(async (tx) => {
      const cafe = await tx.cafe.findUnique({
        where: { slug: parsed.data.cafeSlug },
        select: { id: true },
      });

      if (!cafe) {
        throw new ApiError(404, "Cafe not found.");
      }

      const products = await tx.product.findMany({
        where: {
          cafeId: cafe.id,
          sku: { in: parsed.data.items.map((item) => item.productSku) },
          isAvailable: true,
        },
        select: { id: true, sku: true, name: true, priceInPaise: true },
      });

      if (products.length !== parsed.data.items.length) {
        throw new ApiError(422, "One or more products are unavailable or do not belong to this cafe.");
      }

      const productsBySku = new Map(products.map((product) => [product.sku, product]));
      const orderItems = parsed.data.items.map((item) => {
        const product = productsBySku.get(item.productSku);
        if (!product) {
          throw new ApiError(422, `Product ${item.productSku} is unavailable.`);
        }

        return {
          productId: product.id,
          productName: product.name,
          unitPriceInPaise: product.priceInPaise,
          quantity: item.quantity,
        };
      });

      const subtotalInPaise = orderItems.reduce(
        (sum, item) => sum + item.unitPriceInPaise * item.quantity,
        0
      );
      const taxInPaise = Math.round(subtotalInPaise * TAX_RATE);
      const totalInPaise = subtotalInPaise + taxInPaise;

      const customer = parsed.data.customer.phone
        ? await tx.customer.upsert({
            where: { cafeId_phone: { cafeId: cafe.id, phone: parsed.data.customer.phone } },
            update: { name: parsed.data.customer.name, email: parsed.data.customer.email },
            create: {
              cafeId: cafe.id,
              name: parsed.data.customer.name,
              phone: parsed.data.customer.phone,
              email: parsed.data.customer.email,
            },
          })
        : await tx.customer.create({
            data: {
              cafeId: cafe.id,
              name: parsed.data.customer.name,
              email: parsed.data.customer.email,
            },
          });

      return tx.order.create({
        data: {
          cafeId: cafe.id,
          customerId: customer.id,
          tableNumber: parsed.data.tableNumber,
          notes: parsed.data.notes,
          subtotalInPaise,
          taxInPaise,
          totalInPaise,
          items: { create: orderItems },
        },
        include: {
          customer: { select: { id: true, name: true, phone: true, email: true } },
          items: {
            select: {
              id: true,
              productId: true,
              productName: true,
              unitPriceInPaise: true,
              quantity: true,
            },
          },
        },
      });
    });

    return Response.json({ order }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) {
      return Response.json(
        { error: "ORDER_CREATION_FAILED", message: error.message },
        { status: error.status }
      );
    }

    console.error("Failed to create order", error);
    return Response.json(
      { error: "INTERNAL_ERROR", message: "Unable to create the order." },
      { status: 500 }
    );
  }
}
