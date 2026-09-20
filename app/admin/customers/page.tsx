import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { CustomersClient } from './customers-client';

export const metadata = { title: 'Customers — Nth Cup Admin' };

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/staff/login');
  const user = session.user as { role?: string };
  const isOwner = user.role === 'OWNER';
  const { search = '', page = '1' } = await searchParams;

  return <CustomersClient initialSearch={search} initialPage={parseInt(page, 10)} isOwner={isOwner} />;
}
