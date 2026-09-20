import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getPrisma } from '@/lib/prisma';

function periodBounds(period: string): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (period === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }
  if (period === 'week') {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }
  // month (default)
  const start = new Date(now);
  start.setDate(now.getDate() - 29);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const user = session.user as { cafeId?: string; role?: string };
  const cafeId = user.cafeId;
  if (!cafeId) return NextResponse.json({ error: 'No cafeId' }, { status: 403 });

  const period = req.nextUrl.searchParams.get('period') ?? 'month';
  const { start, end } = periodBounds(period);

  const prisma = getPrisma();

  // Run queries in parallel
  const [
    totalOrders,
    completedOrders,
    newCustomers,
    recentOrders,
    topProducts,
    dailyRevenue,
  ] = await Promise.all([
    // Total orders in period
    prisma.order.count({
      where: { cafeId, createdAt: { gte: start, lte: end } },
    }),
    // Completed orders in period (for revenue)
    prisma.order.aggregate({
      where: { cafeId, status: 'COMPLETED', createdAt: { gte: start, lte: end } },
      _sum: { totalInPaise: true },
      _count: { id: true },
    }),
    // New customers in period
    prisma.customer.count({
      where: { cafeId, createdAt: { gte: start, lte: end } },
    }),
    // Recent 10 orders (any status)
    prisma.order.findMany({
      where: { cafeId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        customer: { select: { name: true } },
        items: { select: { quantity: true } },
      },
    }),
    // Top products by quantity sold (all time scoped to cafe)
    prisma.orderItem.groupBy({
      by: ['productId', 'productName'],
      where: { order: { cafeId, status: 'COMPLETED' } },
      _sum: { quantity: true, unitPriceInPaise: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 6,
    }),
    // Daily revenue for chart
    prisma.order.findMany({
      where: { cafeId, status: 'COMPLETED', createdAt: { gte: start, lte: end } },
      select: { totalInPaise: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const revenueInPaise = completedOrders._sum.totalInPaise ?? 0;
  const completedCount = completedOrders._count.id ?? 0;
  const avgOrderValueInPaise = completedCount > 0 ? Math.floor(revenueInPaise / completedCount) : 0;

  // Group daily revenue by date
  const dailyMap = new Map<string, { revenueInPaise: number; orderCount: number }>();
  for (const o of dailyRevenue) {
    const dateKey = o.createdAt.toISOString().slice(0, 10);
    const existing = dailyMap.get(dateKey) ?? { revenueInPaise: 0, orderCount: 0 };
    dailyMap.set(dateKey, {
      revenueInPaise: existing.revenueInPaise + o.totalInPaise,
      orderCount: existing.orderCount + 1,
    });
  }
  // Fill in zero-revenue days
  const dailyChart: { date: string; revenueInPaise: number; orderCount: number }[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    dailyChart.push({ date: key, ...(dailyMap.get(key) ?? { revenueInPaise: 0, orderCount: 0 }) });
    cursor.setDate(cursor.getDate() + 1);
  }

  // Enrich top products with image from product table
  const productIds = topProducts.map((p) => p.productId);
  const productDetails = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, imageUrl: true, category: true },
  });
  const productDetailMap = new Map(productDetails.map((p) => [p.id, p]));

  const topProductsEnriched = topProducts.map((p) => ({
    productId: p.productId,
    productName: p.productName,
    imageUrl: productDetailMap.get(p.productId)?.imageUrl ?? null,
    category: productDetailMap.get(p.productId)?.category ?? '',
    unitsSold: p._sum.quantity ?? 0,
    revenueInPaise: (p._sum.unitPriceInPaise ?? 0) * (p._sum.quantity ?? 0),
  }));

  const recentOrdersSerialized = recentOrders.map((o) => ({
    id: o.id,
    customerName: o.customer.name,
    itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
    tableNumber: o.tableNumber,
    totalInPaise: o.totalInPaise,
    status: o.status,
    paymentStatus: o.paymentStatus,
    createdAt: o.createdAt.toISOString(),
  }));

  return NextResponse.json({
    kpis: { totalOrders, revenueInPaise, newCustomers, avgOrderValueInPaise },
    dailyChart,
    topProducts: topProductsEnriched,
    recentOrders: recentOrdersSerialized,
  });
}
