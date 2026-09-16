import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { AnalyticsClient } from './analytics-client';

export const metadata = { title: 'Analytics — Nth Cup Admin' };

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/staff/login');
  const user = session.user as { role?: string };
  const isOwner = user.role === 'OWNER';
  const { period = 'month' } = await searchParams;

  return <AnalyticsClient period={period as 'week' | 'month' | 'year'} isOwner={isOwner} />;
}
