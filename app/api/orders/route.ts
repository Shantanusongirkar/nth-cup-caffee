
import { validateCreateOrderInput } from "@/lib/order-validation";
import { getPrisma } from "@/lib/prisma";
import { OrderStatus } from "@/types";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { Session } from "next-auth";
import { createRazorpayOrder, isRazorpayConfigured } from "@/lib/payments/razorpay";
// CHANGED: India-time "start of today" helper (see lib/dates.ts)
import { startOfTodayIST } from "@/lib/dates";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

interface SessionUser {
  id?: string;
  role?: string;
  cafeId?: string;
}

function getSessionCafeId(session: Session | null | undefined): string | null {
  const user = session?.user as SessionUser | undefined;
  return user?.cafeId ?? null;
}

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
  const ip = getClientIp(request);
  const orderRl = checkRateLimit(`orders:create:${ip}`, 30, 60 * 1000);
  if (!orderRl.allowed) {
    return rateLimitResponse(orderRl.retryAfterSec);
  }

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
          paymentMethod: parsed.data.paymentMethod,
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

    // Try to create a Razorpay order for online payment. This must never block
    // or fail order creation: if it fails (or Razorpay is unconfigured) the
    // order still exists as UNPAID and the customer can pay at the counter.
    // Skipped entirely for CASH orders — no online payment is expected.
    let payment: { keyId: string | null; orderId: string | null } = {
      keyId: null,
      orderId: null,
    };

    if (order.paymentMethod !== "CASH" && isRazorpayConfigured() && order.totalInPaise > 0) {
      try {
        const receipt = formatOrderReference(order.id);
        const rzpOrder = await createRazorpayOrder({
          amountInPaise: order.totalInPaise,
          receipt,
          notes: { orderReference: receipt, cafeId: order.cafeId },
        });

        await prisma.order.update({
          where: { id: order.id },
          data: { razorpayOrderId: rzpOrder.id },
        });

        payment = {
          keyId: process.env.RAZORPAY_KEY_ID ?? null,
          orderId: rzpOrder.id,
        };
      } catch (error) {
        console.error(`Failed to create Razorpay order for ${order.id}:`, error);
      }
    }

    const orderResponse = {
      ...order,
      razorpayOrderId: payment.orderId ?? order.razorpayOrderId,
      orderReference: formatOrderReference(order.id),
      payment,
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

// CHANGED: "today" is now strict (only orders placed today).
// New range "open" = older orders that are still active in the kitchen.
// New field openOlderCount tells the page how many such orders exist.
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const cafeId = getSessionCafeId(session);
    if (!cafeId) {
      return Response.json(
        { error: "UNAUTHORIZED", message: "Authentication required." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status")?.toUpperCase();
    const range = (searchParams.get("range") ?? "today").toLowerCase();
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10), 1), 100);
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const skip = (page - 1) * limit;

    const prisma = getPrisma();
    const todayStart = startOfTodayIST();
    const DAY_MS = 24 * 60 * 60 * 1000;

    const whereClause: {
      cafeId: string;
      status?: OrderStatus;
      createdAt?: { gte?: Date; lt?: Date };
      OR?: Array<{
        status?: OrderStatus;
        paymentStatus?: "PAID";
      }>;
    } = { cafeId };

    if (
      statusParam &&
      ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"].includes(statusParam)
    ) {
      whereClause.status = statusParam as OrderStatus;
    }

    if (range === "today") {
      whereClause.createdAt = { gte: todayStart };
    } else if (range === "open") {
      // Older orders that are still active: brewing, or paid but not accepted
      whereClause.createdAt = { lt: todayStart };
      whereClause.OR = [
        { status: "CONFIRMED" },
        { status: "PENDING", paymentStatus: "PAID" },
      ];
    } else if (range === "yesterday") {
      whereClause.createdAt = {
        gte: new Date(todayStart.getTime() - DAY_MS),
        lt: todayStart,
      };
    } else if (range === "week") {
      whereClause.createdAt = { gte: new Date(todayStart.getTime() - 6 * DAY_MS) };
    }
    // range === "all": no date filter

    const [orders, totalCount, todayOrders, staleCount, openOlderCount] =
      await Promise.all([
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
        prisma.order.findMany({
          where: { cafeId, createdAt: { gte: todayStart } },
          select: { status: true, totalInPaise: true },
        }),
        // Old, unpaid, never-accepted orders (for the "Clear" button)
        prisma.order.count({
          where: {
            cafeId,
            status: "PENDING",
            paymentStatus: "UNPAID",
            createdAt: { lt: todayStart },
          },
        }),
        // CHANGED: older orders still open in the kitchen (for the notice button)
        prisma.order.count({
          where: {
            cafeId,
            createdAt: { lt: todayStart },
            OR: [
              { status: "CONFIRMED" },
              { status: "PENDING", paymentStatus: "PAID" },
            ],
          },
        }),
      ]);

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
        staleCount,
        openOlderCount, // CHANGED: new field
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