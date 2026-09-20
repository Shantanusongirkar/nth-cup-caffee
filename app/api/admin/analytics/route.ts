import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getPrisma } from '@/lib/prisma';

function periodBounds(period: string): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (period === 'week') {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }
  if (period === 'month') {
    const start = new Date(now);
    start.setDate(now.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }
  // year
  const start = new Date(now);
  start.setFullYear(now.getFullYear() - 1);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as { cafeId?: string };
  const cafeId = user.cafeId;
  if (!cafeId) return NextResponse.json({ error: 'No cafeId' }, { status: 403 });

  const period = req.nextUrl.searchParams.get('period') ?? 'month';
  const { start, end } = periodBounds(period);

  const prisma = getPrisma();

  const [completedOrders, allPeriodOrders, categoryItems] = await Promise.all([
    // Completed orders for revenue charts
    prisma.order.findMany({
      where: { cafeId, status: 'COMPLETED', createdAt: { gte: start, lte: end } },
      select: { totalInPaise: true, createdAt: true },
    }),
    // All orders for status breakdown + peak hours
    prisma.order.findMany({
      where: { cafeId, createdAt: { gte: start, lte: end } },
      select: { status: true, createdAt: true },
    }),
    // Category breakdown via order items
    prisma.orderItem.findMany({
      where: { order: { cafeId, status: 'COMPLETED', createdAt: { gte: start, lte: end } } },
      select: { quantity: true, unitPriceInPaise: true, product: { select: { category: true } } },
    }),
  ]);

  // Daily revenue chart
  const dailyMap = new Map<string, { revenueInPaise: number; orderCount: number }>();
  for (const o of completedOrders) {
    const key = o.createdAt.toISOString().slice(0, 10);
    const prev = dailyMap.get(key) ?? { revenueInPaise: 0, orderCount: 0 };
    dailyMap.set(key, { revenueInPaise: prev.revenueInPaise + o.totalInPaise, orderCount: prev.orderCount + 1 });
  }
  const dailyChart: { date: string; revenueInPaise: number; orderCount: number }[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    dailyChart.push({ date: key, ...(dailyMap.get(key) ?? { revenueInPaise: 0, orderCount: 0 }) });
    cursor.setDate(cursor.getDate() + 1);
  }

  // Status breakdown
  const statusMap = new Map<string, number>();
  for (const o of allPeriodOrders) {
    statusMap.set(o.status, (statusMap.get(o.status) ?? 0) + 1);
  }
  const statusBreakdown = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'].map((s) => ({
    status: s,
    count: statusMap.get(s) ?? 0,
  }));

  // Peak hours
  const hourMap = new Map<number, number>();
  for (const o of allPeriodOrders) {
    const hour = new Date(o.createdAt).getHours();
    hourMap.set(hour, (hourMap.get(hour) ?? 0) + 1);
  }
  const peakHours = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    orderCount: hourMap.get(h) ?? 0,
  }));

  // Category breakdown
  const catMap = new Map<string, { revenueInPaise: number; unitsSold: number }>();
  for (const item of categoryItems) {
    const cat = item.product?.category ?? 'other';
    const prev = catMap.get(cat) ?? { revenueInPaise: 0, unitsSold: 0 };
    catMap.set(cat, {
      revenueInPaise: prev.revenueInPaise + item.unitPriceInPaise * item.quantity,
      unitsSold: prev.unitsSold + item.quantity,
    });
  }
  const categoryBreakdown = Array.from(catMap.entries()).map(([category, data]) => ({
    category,
    ...data,
  }));

  return NextResponse.json({ dailyChart, statusBreakdown, peakHours, categoryBreakdown });
}
