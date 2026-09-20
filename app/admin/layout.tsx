import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/admin-shell';

export const metadata = {
  title: 'Admin — Nth Cup Caffee',
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/staff/login');
  }

  const user = session.user as { name?: string | null; email?: string | null; role?: string; cafeId?: string };

  return (
    <AdminShell
      userName={user.name ?? 'Admin'}
      userEmail={user.email ?? ''}
      userRole={(user.role ?? 'STAFF') as 'OWNER' | 'STAFF'}
    >
      {children}
    </AdminShell>
  );
}
