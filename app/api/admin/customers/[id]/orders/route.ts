import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/require-role';
import { getPrisma } from '@/lib/prisma';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession({ requireRole: 'OWNER' });
  if (auth instanceof NextResponse) {
    return auth;
  }
  const session = auth;
  const user = session.user as { cafeId?: string };
  const cafeId = user.cafeId;
  if (!cafeId) return NextResponse.json({ error: 'No cafeId' }, { status: 403 });

  const { id: customerId } = await params;

  const prisma = getPrisma();

  // Verify customer belongs to this cafe
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, cafeId },
    select: { id: true, name: true, phone: true, email: true, createdAt: true },
  });
  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const orders = await prisma.order.findMany({
    where: { customerId, cafeId },
    orderBy: { createdAt: 'desc' },
    include: {
      items: {
        select: { productName: true, quantity: true, unitPriceInPaise: true },
      },
    },
  });

  const serialized = orders.map((o) => ({
    id: o.id,
    status: o.status,
    paymentStatus: o.paymentStatus,
    tableNumber: o.tableNumber,
    totalInPaise: o.totalInPaise,
    subtotalInPaise: o.subtotalInPaise,
    taxInPaise: o.taxInPaise,
    notes: o.notes,
    items: o.items,
    createdAt: o.createdAt.toISOString(),
  }));

  return NextResponse.json({
    customer: { ...customer, createdAt: customer.createdAt.toISOString() },
    orders: serialized,
  });
}
