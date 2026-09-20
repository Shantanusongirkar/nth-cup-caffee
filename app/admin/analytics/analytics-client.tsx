'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { TrendingUp, ShoppingBag, Clock, BarChart2, AlertCircle } from 'lucide-react';
import { formatInr } from '@/lib/format';

type Period = 'week' | 'month' | 'year';

interface DailyPoint { date: string; revenueInPaise: number; orderCount: number; }
interface StatusBreak { status: string; count: number; }
interface HourlyBucket { hour: number; orderCount: number; }
interface CategoryRev { category: string; revenueInPaise: number; unitsSold: number; }

// Chart colors pulled from CSS vars at render time
const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Brewing',
  COMPLETED: 'Served',
  CANCELLED: 'Cancelled',
};

function formatChartDate(dateStr: string, period: Period) {
  const d = new Date(dateStr + 'T00:00:00');
  if (period === 'week') return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
  if (period === 'year') return d.toLocaleDateString('en-IN', { month: 'short' });
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

function hourLabel(h: number) {
  if (h === 0) return '12am';
  if (h === 12) return '12pm';
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

const tooltipStyle = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '0.75rem',
  fontSize: '12px',
  color: 'var(--card-foreground)',
};

interface Props { period: Period; isOwner: boolean; }

export function AnalyticsClient({ period, isOwner }: Props) {
  const router = useRouter();
  const [data, setData] = React.useState<{
    dailyChart: DailyPoint[];
    statusBreakdown: StatusBreak[];
    peakHours: HourlyBucket[];
    categoryBreakdown: CategoryRev[];
  } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/admin/analytics?period=${period}`, { cache: 'no-store' })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => { if (active) { setData(d); setError(null); } })
      .catch((e) => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [period]);

  function setPeriod(p: Period) {
    router.push(`/admin/analytics?period=${p}`, { scroll: false });
  }

  const ChartSkeleton = ({ h = 220 }: { h?: number }) => (
    <div className={`bg-muted/40 animate-pulse rounded-xl`} style={{ height: h }} />
  );

  return (
    <div className="p-6 space-y-7 max-w-7xl mx-auto">
      {/* Header */}
      <div className="animate-fade-in-up flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Performance insights for your café</p>
        </div>
        <div className="flex items-center gap-1 bg-muted/60 rounded-xl p-1 self-start sm:self-auto">
          {(['week', 'month', 'year'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                period === p ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
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

      {/* Revenue trend */}
      {isOwner && (
        <div className="animate-fade-in-up stagger-1 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-heading font-semibold text-foreground">Revenue Trend</h2>
          </div>
          {loading ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data?.dailyChart ?? []} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="aGrad1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(v) => formatChartDate(v, period)} tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tickFormatter={(v) => `₹${(v / 100).toLocaleString('en-IN')}`} tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} axisLine={false} tickLine={false} width={60} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [formatInr(Number(v ?? 0)), 'Revenue']} labelFormatter={(l) => formatChartDate(l as string, period)} />
                <Area type="monotone" dataKey="revenueInPaise" stroke="var(--chart-1)" strokeWidth={2} fill="url(#aGrad1)" dot={false} activeDot={{ r: 4, fill: 'var(--chart-1)', strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Order volume trend */}
      <div className="animate-fade-in-up stagger-2 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <ShoppingBag className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-heading font-semibold text-foreground">Order Volume</h2>
        </div>
        {loading ? <ChartSkeleton /> : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data?.dailyChart ?? []} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(v) => formatChartDate(v, period)} tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [Number(v ?? 0), 'Orders']} labelFormatter={(l) => formatChartDate(l as string, period)} />
              <Bar dataKey="orderCount" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Order Status Breakdown */}
        <div className="animate-fade-in-up stagger-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-heading font-semibold text-foreground">Order Status</h2>
          </div>
          {loading ? <ChartSkeleton h={180} /> : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie
                    data={(data?.statusBreakdown ?? []).filter((s) => s.count > 0)}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={72}
                    paddingAngle={3}
                  >
                    {(data?.statusBreakdown ?? []).filter((s) => s.count > 0).map((_, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => [Number(v ?? 0), STATUS_LABELS[String(name)] ?? String(name)]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1">
                {(data?.statusBreakdown ?? []).map((s, idx) => (
                  <div key={s.status} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CHART_COLORS[idx % CHART_COLORS.length] }} />
                      <span className="text-muted-foreground">{STATUS_LABELS[s.status] ?? s.status}</span>
                    </div>
                    <span className="font-heading font-bold text-foreground">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Category Breakdown */}
        <div className="animate-fade-in-up stagger-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-heading font-semibold text-foreground">By Category</h2>
          </div>
          {loading ? <ChartSkeleton h={180} /> : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data?.categoryBreakdown ?? []} layout="vertical" margin={{ left: 4, right: 12, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis
                  dataKey="category"
                  type="category"
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                  tickFormatter={(v) => v.charAt(0).toUpperCase() + v.slice(1)}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v, name) => [
                    name === 'revenueInPaise' ? formatInr(Number(v ?? 0)) : Number(v ?? 0),
                    name === 'revenueInPaise' ? 'Revenue' : 'Units sold',
                  ]}
                />
                <Bar dataKey="unitsSold" fill="var(--chart-3)" radius={[0, 4, 4, 0]} name="unitsSold" />
                {isOwner && <Bar dataKey="revenueInPaise" fill="var(--chart-1)" radius={[0, 4, 4, 0]} name="revenueInPaise" />}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Peak Hours */}
      <div className="animate-fade-in-up stagger-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-heading font-semibold text-foreground">Peak Ordering Hours</h2>
        </div>
        {loading ? <ChartSkeleton h={160} /> : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={data?.peakHours ?? []} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="hour"
                tickFormatter={hourLabel}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                interval={2}
              />
              <YAxis allowDecimals={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} axisLine={false} tickLine={false} width={24} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v) => [Number(v ?? 0), 'Orders']}
                labelFormatter={(h) => hourLabel(Number(h) ?? 0)}
              />
              <Bar dataKey="orderCount" fill="var(--chart-2)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
