import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getPrisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as { cafeId?: string };
  const cafeId = user.cafeId;
  if (!cafeId) return NextResponse.json({ error: 'No cafeId' }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const search = searchParams.get('search') ?? '';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '40', 10));

  const prisma = getPrisma();

  const where = {
    cafeId,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        _count: { select: { orders: true } },
        orders: {
          select: { totalInPaise: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    }),
    prisma.customer.count({ where }),
  ]);

  // Detect duplicate phones within this cafe
  const phoneGroups = new Map<string, number>();
  for (const c of customers) {
    if (c.phone) phoneGroups.set(c.phone, (phoneGroups.get(c.phone) ?? 0) + 1);
  }

  // Also detect across the whole cafe (not just this page)
  const allPhonesWithDupes = search
    ? new Set<string>()
    : await prisma.customer
        .groupBy({
          by: ['phone'],
          where: { cafeId, phone: { not: null } },
          having: { phone: { _count: { gt: 1 } } },
          _count: { phone: true },
        })
        .then((rows) => new Set(rows.map((r) => r.phone as string)));

  const rows = customers.map((c) => {
    const lifetimeSpendInPaise = c.orders.reduce((s, o) => s + o.totalInPaise, 0);
    const lastOrderAt = c.orders[0]?.createdAt?.toISOString() ?? null;
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      orderCount: c._count.orders,
      lifetimeSpendInPaise,
      lastOrderAt,
      isDuplicatePhone: c.phone ? allPhonesWithDupes.has(c.phone) : false,
      createdAt: c.createdAt.toISOString(),
    };
  });

  return NextResponse.json({ customers: rows, total, page, limit });
}
