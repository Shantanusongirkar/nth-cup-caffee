'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  ShoppingBag,
  IndianRupee,
  Users,
  TrendingUp,
  Coffee,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { formatInr, formatTimeAgo, shortId } from '@/lib/format';

type Period = 'today' | 'week' | 'month';

interface KPIs {
  totalOrders: number;
  revenueInPaise: number;
  newCustomers: number;
  avgOrderValueInPaise: number;
}

interface DailyPoint {
  date: string;
  revenueInPaise: number;
  orderCount: number;
}

interface TopProduct {
  productId: string;
  productName: string;
  imageUrl: string | null;
  category: string;
  unitsSold: number;
  revenueInPaise: number;
}

interface RecentOrder {
  id: string;
  customerName: string;
  itemCount: number;
  tableNumber: string | null;
  totalInPaise: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
}

const STATUS_STYLE: Record<string, { label: string; bg: string; text: string; border: string; icon: React.ComponentType<{ className?: string }> }> = {
  PENDING:   { label: 'Pending',   bg: 'bg-amber-500/10',   text: 'text-amber-700 dark:text-amber-300',   border: 'border-amber-500/30',   icon: Clock },
  CONFIRMED: { label: 'Brewing',   bg: 'bg-blue-500/10',    text: 'text-blue-700 dark:text-blue-300',     border: 'border-blue-500/30',    icon: Coffee },
  COMPLETED: { label: 'Served',    bg: 'bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-500/30', icon: CheckCircle2 },
  CANCELLED: { label: 'Cancelled', bg: 'bg-rose-500/10',    text: 'text-rose-700 dark:text-rose-300',     border: 'border-rose-500/30',    icon: XCircle },
};

function formatChartDate(dateStr: string, period: Period) {
  const d = new Date(dateStr + 'T00:00:00');
  if (period === 'today') return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  if (period === 'week') return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

interface Props { period: Period; isOwner: boolean; }

export function OverviewClient({ period, isOwner }: Props) {
  const router = useRouter();
  const [data, setData] = React.useState<{
    kpis: KPIs;
    dailyChart: DailyPoint[];
    topProducts: TopProduct[];
    recentOrders: RecentOrder[];
  } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/admin/overview?period=${period}`, { cache: 'no-store' })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => { if (active) { setData(d); setError(null); } })
      .catch((e) => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [period]);

  function setPeriod(p: Period) {
    router.push(`/admin?period=${p}`, { scroll: false });
  }

  const kpis = data?.kpis;

  return (
    <div className="p-6 space-y-7 max-w-7xl mx-auto">
      {/* Header */}
      <div className="animate-fade-in-up flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your café at a glance</p>
        </div>
        {/* Period Toggle */}
        <div className="flex items-center gap-1 bg-muted/60 rounded-xl p-1 self-start sm:self-auto">
          {(['today', 'week', 'month'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                period === p
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Orders',
            value: loading ? '—' : (kpis?.totalOrders ?? 0).toLocaleString('en-IN'),
            icon: ShoppingBag,
            delay: 'stagger-1',
          },
          {
            label: 'Revenue',
            value: loading ? '—' : isOwner ? formatInr(kpis?.revenueInPaise ?? 0) : '••••',
            icon: IndianRupee,
            delay: 'stagger-2',
            ownerOnly: true,
          },
          {
            label: 'New Customers',
            value: loading ? '—' : (kpis?.newCustomers ?? 0).toLocaleString('en-IN'),
            icon: Users,
            delay: 'stagger-3',
          },
          {
            label: 'Avg Order Value',
            value: loading ? '—' : isOwner ? formatInr(kpis?.avgOrderValueInPaise ?? 0) : '••••',
            icon: TrendingUp,
            delay: 'stagger-4',
            ownerOnly: true,
          },
        ].map(({ label, value, icon: Icon, delay }) => (
          <div
            key={label}
            className={`animate-fade-in-up ${delay} relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm`}
            style={{ boxShadow: '0 0 0 1px oklch(0.72 0.10 60 / 0.15), 0 4px 16px oklch(0.45 0.08 55 / 0.06)' }}
          >
            {/* Warm gradient accent */}
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[var(--caramel)] to-transparent opacity-60" />
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
                {loading ? (
                  <div className="h-7 w-20 bg-muted animate-pulse rounded-lg" />
                ) : (
                  <p className="text-2xl font-heading font-bold text-foreground">{value}</p>
                )}
              </div>
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="w-4.5 h-4.5 text-primary" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue Chart */}
      {isOwner && (
        <div className="animate-fade-in-up stagger-2 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-heading font-semibold text-foreground mb-4">Revenue Trend</h2>
          {loading ? (
            <div className="h-48 bg-muted/40 animate-pulse rounded-xl" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data?.dailyChart ?? []} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => formatChartDate(v, period)}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={(v) => `₹${(v / 100).toLocaleString('en-IN')}`}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '0.75rem',
                    fontSize: '12px',
                    color: 'var(--card-foreground)',
                  }}
                  formatter={(v) => [formatInr(Number(v ?? 0)), 'Revenue']}
                  labelFormatter={(l) => formatChartDate(l as string, period)}
                />
                <Area
                  type="monotone"
                  dataKey="revenueInPaise"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="url(#revenueGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: 'var(--chart-1)', strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Top Products */}
        <div className="animate-fade-in-up stagger-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-heading font-semibold text-foreground mb-4">Top Products</h2>
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-muted animate-pulse rounded-xl shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-muted animate-pulse rounded w-3/4" />
                    <div className="h-2.5 bg-muted animate-pulse rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : !data?.topProducts?.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">No completed orders yet</p>
          ) : (
            <div className="space-y-2">
              {data.topProducts.map((p, idx) => (
                <div key={p.productId} className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/40 transition-colors">
                  <span className="text-xs font-bold text-muted-foreground w-5 text-center shrink-0">{idx + 1}</span>
                  {p.imageUrl ? (
                    <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-border/60">
                      <Image src={p.imageUrl} alt={p.productName} width={40} height={40} className="object-cover w-full h-full" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      <Coffee className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{p.productName}</p>
                    <p className="text-[11px] text-muted-foreground">{p.unitsSold} sold</p>
                  </div>
                  {isOwner && (
                    <p className="text-xs font-bold text-foreground shrink-0 font-heading">{formatInr(p.revenueInPaise)}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Orders */}
        <div className="animate-fade-in-up stagger-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-heading font-semibold text-foreground">Recent Orders</h2>
            <Link href="/admin/orders" className="text-xs font-medium text-primary hover:underline">
              View all →
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 bg-muted/40 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : !data?.recentOrders?.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">No orders yet</p>
          ) : (
            <div className="space-y-1.5">
              {data.recentOrders.map((o) => {
                const s = STATUS_STYLE[o.status] ?? STATUS_STYLE.PENDING;
                const Icon = s.icon;
                return (
                  <div key={o.id} className="flex items-center gap-2.5 py-2 px-2.5 rounded-xl hover:bg-muted/40 transition-colors text-xs">
                    <span className="font-mono text-[10px] text-muted-foreground shrink-0 w-16">
                      #{shortId(o.id)}
                    </span>
                    <span className="font-medium text-foreground flex-1 truncate">{o.customerName}</span>
                    <span className="text-muted-foreground shrink-0">
                      {o.tableNumber ? `T${o.tableNumber}` : 'TW'}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-semibold shrink-0 ${s.bg} ${s.text} ${s.border}`}
                    >
                      <Icon className="w-2.5 h-2.5" />
                      {s.label}
                    </span>
                    <span className="font-heading font-bold text-foreground shrink-0">
                      {isOwner ? formatInr(o.totalInPaise) : '••'}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:block">
                      {formatTimeAgo(o.createdAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
