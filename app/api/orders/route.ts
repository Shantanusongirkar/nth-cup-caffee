import { validateCreateOrderInput } from "@/lib/order-validation";
import { getPrisma } from "@/lib/prisma";
import { OrderStatus } from "@/types";

export const runtime = "nodejs";

// Standard 5% tax rate for cafe dining items.
const TAX_RATE = 0.05;

class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

/** Formats a clean customer-facing order reference like #NC-A1B2C3D4 */
export function formatOrderReference(orderId: string): string {
  const cleanId = orderId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();
  return `NC-${cleanId}`;
}

export async function POST(request: Request) {
  try {
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

    const prisma = getPrisma();
    const order = await prisma.$transaction(async (tx) => {
      const cafe = await tx.cafe.findUnique({
        where: { slug: parsed.data.cafeSlug },
        select: { id: true, name: true, phone: true },
      });

      if (!cafe) {
        throw new ApiError(404, `Cafe '${parsed.data.cafeSlug}' not found.`);
      }

      // Fetch products strictly from database to prevent price manipulation
      const requestedSkus = parsed.data.items.map((item) => item.productSku);
      const products = await tx.product.findMany({
        where: {
          cafeId: cafe.id,
          sku: { in: requestedSkus },
          isAvailable: true,
        },
        select: { id: true, sku: true, name: true, priceInPaise: true },
      });

      if (products.length !== parsed.data.items.length) {
        throw new ApiError(
          422,
          "One or more products are unavailable or do not belong to this cafe."
        );
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

      // Calculate totals in integer paise
      const subtotalInPaise = orderItems.reduce(
        (sum, item) => sum + item.unitPriceInPaise * item.quantity,
        0
      );
      const taxInPaise = Math.round(subtotalInPaise * TAX_RATE);
      const totalInPaise = subtotalInPaise + taxInPaise;

      // Upsert or create customer
      const customer = parsed.data.customer.phone
        ? await tx.customer.upsert({
            where: { cafeId_phone: { cafeId: cafe.id, phone: parsed.data.customer.phone } },
            update: {
              name: parsed.data.customer.name,
              email: parsed.data.customer.email,
            },
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

      // Create Order with OrderItems
      const createdOrder = await tx.order.create({
        data: {
          cafeId: cafe.id,
          customerId: customer.id,
          status: "PENDING",
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

      return createdOrder;
    });

    const orderResponse = {
      ...order,
      orderReference: formatOrderReference(order.id),
    };

    return Response.json({ order: orderResponse }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) {
      return Response.json(
        { error: "ORDER_CREATION_FAILED", message: error.message },
        { status: error.status }
      );
    }

    console.error("Failed to create order:", error);
    const message =
      error instanceof Error ? error.message : "Unable to create the order in the database.";
    return Response.json(
      { error: "INTERNAL_ERROR", message },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cafeSlug = searchParams.get("cafeSlug") || "nth-cup-demo";
    const statusParam = searchParams.get("status")?.toUpperCase();
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10), 1), 100);
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const skip = (page - 1) * limit;

    const prisma = getPrisma();
    const cafe = await prisma.cafe.findUnique({
      where: { slug: cafeSlug },
      select: { id: true },
    });

    if (!cafe) {
      return Response.json(
        { error: "NOT_FOUND", message: `Cafe '${cafeSlug}' not found.` },
        { status: 404 }
      );
    }

    const whereClause: {
      cafeId: string;
      status?: OrderStatus;
    } = { cafeId: cafe.id };

    if (
      statusParam &&
      ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"].includes(statusParam)
    ) {
      whereClause.status = statusParam as OrderStatus;
    }

    const [orders, totalCount] = await Promise.all([
      prisma.order.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
        include: {
          customer: {
            select: { id: true, name: true, phone: true, email: true },
          },
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
      }),
      prisma.order.count({ where: whereClause }),
    ]);

    // Calculate Today's Stats
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayOrders = await prisma.order.findMany({
      where: {
        cafeId: cafe.id,
        createdAt: { gte: todayStart },
      },
      select: {
        status: true,
        totalInPaise: true,
      },
    });

    const stats = {
      todayOrders: todayOrders.length,
      pendingOrders: todayOrders.filter((o) => o.status === "PENDING").length,
      completedOrders: todayOrders.filter((o) => o.status === "COMPLETED").length,
      todayRevenueInPaise: todayOrders
        .filter((o) => o.status === "COMPLETED" || o.status === "CONFIRMED")
        .reduce((sum, o) => sum + o.totalInPaise, 0),
    };

    const formattedOrders = orders.map((order) => ({
      ...order,
      orderReference: formatOrderReference(order.id),
    }));

    return Response.json(
      {
        orders: formattedOrders,
        stats,
        totalCount,
        page,
        limit,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to retrieve orders:", error);
    return Response.json(
      { error: "INTERNAL_ERROR", message: "Failed to retrieve orders." },
      { status: 500 }
    );
  }
}
