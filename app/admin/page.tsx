import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { OverviewClient } from './overview-client';

export const metadata = { title: 'Overview — Nth Cup Admin' };

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/staff/login');

  const user = session.user as { cafeId?: string; role?: string };
  if (user.role !== 'OWNER') {
    // Owner-only page — staff get redirected to the staff orders dashboard.
    redirect('/admin/orders');
  }
  const isOwner = user.role === 'OWNER';
  const { period = 'month' } = await searchParams;

  return <OverviewClient period={period as 'today' | 'week' | 'month'} isOwner={isOwner} />;
}
