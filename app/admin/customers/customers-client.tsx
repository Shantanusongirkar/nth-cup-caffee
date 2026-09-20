'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Users, AlertTriangle, ChevronLeft, ChevronRight, Coffee, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatInr, formatDate, formatTimeAgo } from '@/lib/format';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  orderCount: number;
  lifetimeSpendInPaise: number;
  lastOrderAt: string | null;
  isDuplicatePhone: boolean;
  createdAt: string;
}

interface CustomerOrderItem {
  productName: string;
  quantity: number;
  unitPriceInPaise: number;
}

interface CustomerOrder {
  id: string;
  status: string;
  paymentStatus: string;
  tableNumber: string | null;
  totalInPaise: number;
  subtotalInPaise: number;
  taxInPaise: number;
  notes: string | null;
  items: CustomerOrderItem[];
  createdAt: string;
}

const STATUS_BG: Record<string, string> = {
  PENDING:   'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
  CONFIRMED: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
  COMPLETED: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  CANCELLED: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30',
};

interface Props {
  initialSearch: string;
  initialPage: number;
  isOwner: boolean;
}

export function CustomersClient({ initialSearch, initialPage, isOwner }: Props) {
  const router = useRouter();
  const [search, setSearch] = React.useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = React.useState(initialSearch);
  const [page, setPage] = React.useState(initialPage);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Detail sheet state
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detailCustomer, setDetailCustomer] = React.useState<{ name: string; phone: string | null; email: string | null; createdAt: string } | null>(null);
  const [detailOrders, setDetailOrders] = React.useState<CustomerOrder[]>([]);
  const [detailLoading, setDetailLoading] = React.useState(false);

  const limit = 40;

  // Debounce search
  React.useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch customers
  React.useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (debouncedSearch) params.set('search', debouncedSearch);
    fetch(`/api/admin/customers?${params}`, { cache: 'no-store' })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => { if (active) { setCustomers(d.customers); setTotal(d.total); setError(null); } })
      .catch((e) => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [debouncedSearch, page]);

  // Fetch customer detail
  React.useEffect(() => {
    if (!selectedId) return;
    let active = true;
    setDetailLoading(true);
    fetch(`/api/admin/customers/${selectedId}/orders`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (active) {
          setDetailCustomer(d.customer);
          setDetailOrders(d.orders ?? []);
        }
      })
      .finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [selectedId]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="animate-fade-in-up flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Customers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? '…' : `${total.toLocaleString('en-IN')} customers`}
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone…"
            className="pl-9 pr-8 rounded-xl text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm">{error}</div>
      )}

      {/* Table */}
      <div className="animate-fade-in-up stagger-1 rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Phone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Email</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Orders</th>
                {isOwner && <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Lifetime Spend</th>}
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Last Order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading
                ? [...Array(8)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(isOwner ? 6 : 5)].map((__, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>
                      ))}
                    </tr>
                  ))
                : customers.length === 0
                  ? (
                    <tr>
                      <td colSpan={isOwner ? 6 : 5} className="text-center py-12 text-sm text-muted-foreground">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        No customers found
                      </td>
                    </tr>
                  )
                  : customers.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className="hover:bg-muted/30 cursor-pointer transition-colors group"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-primary font-heading">
                              {c.name.slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-semibold text-foreground truncate">{c.name}</p>
                              {c.isDuplicatePhone && (
                                <span title="Possible duplicate: another customer shares this phone number">
                                  <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              Since {formatDate(c.createdAt)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                        {c.phone ?? <span className="opacity-40">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell truncate max-w-[160px]">
                        {c.email ?? <span className="opacity-40">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-xs font-bold text-foreground font-heading">{c.orderCount}</span>
                      </td>
                      {isOwner && (
                        <td className="px-4 py-3 text-right text-xs font-heading font-bold text-foreground hidden lg:table-cell">
                          {formatInr(c.lifetimeSpendInPaise)}
                        </td>
                      )}
                      <td className="px-4 py-3 text-right text-[11px] text-muted-foreground hidden lg:table-cell">
                        {c.lastOrderAt ? formatTimeAgo(c.lastOrderAt) : <span className="opacity-40">Never</span>}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
            <p className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="h-7 w-7 p-0 rounded-lg"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="h-7 w-7 p-0 rounded-lg"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Customer Detail Slide-over */}
      {selectedId && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/40" onClick={() => setSelectedId(null)} />
          <aside className="relative z-50 flex flex-col w-full max-w-md h-full bg-card border-l border-border shadow-2xl animate-fade-in overflow-y-auto">
            <div className="sticky top-0 bg-card/90 backdrop-blur-md border-b border-border px-5 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-base font-heading font-bold text-foreground">
                  {detailCustomer?.name ?? '…'}
                </h2>
                <p className="text-xs text-muted-foreground">Order history</p>
              </div>
              <button
                onClick={() => setSelectedId(null)}
                className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {detailCustomer && (
              <div className="px-5 py-3 bg-muted/20 border-b border-border text-xs space-y-1">
                {detailCustomer.phone && <p className="text-muted-foreground"><span className="font-semibold text-foreground">Phone:</span> {detailCustomer.phone}</p>}
                {detailCustomer.email && <p className="text-muted-foreground"><span className="font-semibold text-foreground">Email:</span> {detailCustomer.email}</p>}
                <p className="text-muted-foreground"><span className="font-semibold text-foreground">Customer since:</span> {formatDate(detailCustomer.createdAt)}</p>
              </div>
            )}

            <div className="flex-1 px-5 py-4">
              {detailLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />
                  ))}
                </div>
              ) : detailOrders.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  <Coffee className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No orders yet
                </div>
              ) : (
                <div className="space-y-3">
                  {detailOrders.map((o) => (
                    <div key={o.id} className="rounded-xl border border-border p-3.5 space-y-2 hover:border-primary/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] text-muted-foreground">#{o.id.slice(0, 8).toUpperCase()}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-semibold ${STATUS_BG[o.status] ?? STATUS_BG.PENDING}`}>
                          {o.status}
                        </span>
                      </div>
                      <div className="space-y-0.5 text-xs">
                        {o.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-muted-foreground">
                            <span><strong className="text-foreground">{item.quantity}×</strong> {item.productName}</span>
                            {isOwner && <span>{formatInr(item.unitPriceInPaise * item.quantity)}</span>}
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-border/60">
                        <span className="text-[11px] text-muted-foreground">{formatDate(o.createdAt)}</span>
                        {isOwner && <span className="text-sm font-heading font-bold text-foreground">{formatInr(o.totalInPaise)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
