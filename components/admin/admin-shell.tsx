'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  LayoutDashboard,
  Receipt,
  Coffee,
  Users,
  TrendingUp,
  Menu,
  X,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/admin/orders', label: 'Orders', icon: Receipt },
  { href: '/admin/menu', label: 'Menu', icon: Coffee },
  { href: '/admin/customers', label: 'Customers', icon: Users },
  { href: '/admin/analytics', label: 'Analytics', icon: TrendingUp },
];

interface AdminShellProps {
  children: React.ReactNode;
  userName: string;
  userEmail: string;
  userRole: 'OWNER' | 'STAFF';
}

export function AdminShell({ children, userName, userEmail, userRole }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);

  function isActive(item: NavItem) {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  async function handleSignOut() {
    setSigningOut(true);
    await signOut({ callbackUrl: '/staff/login' });
  }

  // Close mobile menu on route change
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 border-r border-border bg-sidebar h-screen sticky top-0">
        {/* Logo / Brand */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-sidebar-border">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0">
            <Coffee className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-heading font-bold text-sidebar-foreground leading-tight truncate">
              Nth Cup Caffee
            </p>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
              {userRole === 'OWNER' ? 'Owner Portal' : 'Staff Portal'}
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  active
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? '' : 'text-muted-foreground group-hover:text-sidebar-accent-foreground'}`} />
                <span>{item.label}</span>
                {active && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-60" />}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="border-t border-sidebar-border px-3 py-3 space-y-2">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-primary font-heading">{initials}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-sidebar-foreground truncate">{userName}</p>
              <p className="text-[10px] text-muted-foreground truncate">{userEmail}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-1">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              disabled={signingOut}
              onClick={handleSignOut}
              className="flex-1 justify-start gap-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl h-8"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </Button>
          </div>
        </div>
      </aside>

      {/* ── Mobile Header ── */}
      <div className="flex flex-col flex-1 min-w-0 h-screen overflow-hidden">
        <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b border-border bg-sidebar/90 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Coffee className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="text-sm font-heading font-bold text-foreground">Nth Cup Admin</span>
          </div>
          <button
            onClick={() => setMobileOpen((o) => !o)}
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-border hover:bg-muted transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </header>

        {/* Mobile Nav Drawer */}
        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-30 flex">
            <div className="fixed inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
            <aside className="relative z-40 flex flex-col w-64 h-full bg-sidebar border-r border-sidebar-border shadow-xl animate-fade-in">
              <div className="flex items-center justify-between px-4 py-4 border-b border-sidebar-border">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                    <Coffee className="w-3.5 h-3.5 text-primary-foreground" />
                  </div>
                  <span className="text-sm font-heading font-bold">Nth Cup Admin</span>
                </div>
                <button onClick={() => setMobileOpen(false)} className="p-1 rounded-lg hover:bg-muted">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        active
                          ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="border-t border-sidebar-border px-3 py-3">
                <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
                  <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">{initials}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{userName}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{userEmail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={signingOut}
                    onClick={handleSignOut}
                    className="flex-1 justify-start gap-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl h-8"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign out
                  </Button>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* ── Main Content ── */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
