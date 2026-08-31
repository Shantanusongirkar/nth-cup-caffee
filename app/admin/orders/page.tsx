'use client';

import * as React from 'react';
import Link from 'next/link';
import { ServerOrder, OrderStatus, AdminOrderStats } from '@/types';
import { formatPaiseToRupees } from '@/utils/whatsapp';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Coffee,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  IndianRupee,
  Search,
  MapPin,
  Phone,
  User,
  ShoppingBag,
  ExternalLink,
  Check,
  Ban,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; bg: string; text: string; border: string; icon: React.ComponentType<{ className?: string }> }
> = {
  PENDING: {
    label: 'Pending',
    bg: 'bg-amber-500/10 dark:bg-amber-500/20',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-500/30',
    icon: Clock,
  },
  CONFIRMED: {
    label: 'Confirmed / Brewing',
    bg: 'bg-blue-500/10 dark:bg-blue-500/20',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-500/30',
    icon: Coffee,
  },
  COMPLETED: {
    label: 'Completed',
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-500/30',
    icon: CheckCircle2,
  },
  CANCELLED: {
    label: 'Cancelled',
    bg: 'bg-rose-500/10 dark:bg-rose-500/20',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-500/30',
    icon: XCircle,
  },
};

function formatTimeAgo(dateInput: string | Date): string {
  const date = new Date(dateInput);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = React.useState<ServerOrder[]>([]);
  const [stats, setStats] = React.useState<AdminOrderStats>({
    todayOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    todayRevenueInPaise: 0,
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<OrderStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [autoRefresh, setAutoRefresh] = React.useState(true);
  const [lastRefreshedAt, setLastRefreshedAt] = React.useState<Date | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = React.useState<string | null>(null);

  const fetchOrders = React.useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    }

    try {
      const response = await fetch('/api/orders?cafeSlug=nth-cup-demo', {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch orders (status ${response.status})`);
      }

      const data = await response.json();
      setOrders(data.orders || []);
      if (data.stats) {
        setStats(data.stats);
      }
      setError(null);
      setLastRefreshedAt(new Date());
    } catch (err) {
      console.error('Failed to load admin orders:', err);
      const msg = err instanceof Error ? err.message : 'Unable to connect to order server.';
      setError(msg);
      if (isManualRefresh) {
        toast.error('Failed to refresh orders.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial load
  React.useEffect(() => {
    let active = true;
    async function loadInitial() {
      try {
        const response = await fetch('/api/orders?cafeSlug=nth-cup-demo', {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (active) {
          setOrders(data.orders || []);
          if (data.stats) setStats(data.stats);
          setError(null);
          setLastRefreshedAt(new Date());
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load orders.');
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    loadInitial();
    return () => {
      active = false;
    };
  }, []);

  // Auto-refresh interval (15 seconds)
  React.useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchOrders(false);
    }, 15000);

    return () => clearInterval(interval);
  }, [autoRefresh, fetchOrders]);

  // Status update handler
  const handleStatusUpdate = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingOrderId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update order status.');
      }

      // Optimistic update
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );

      // Refresh full stats
      fetchOrders(false);

      toast.success(`Order status updated to ${newStatus}`);
    } catch (err) {
      console.error('Error updating order:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update status.');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Filter orders by tab and search
  const filteredOrders = React.useMemo(() => {
    return orders.filter((order) => {
      const matchesTab = activeTab === 'ALL' || order.status === activeTab;

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (order.orderReference && order.orderReference.toLowerCase().includes(q)) ||
        order.id.toLowerCase().includes(q) ||
        order.customer.name.toLowerCase().includes(q) ||
        (order.customer.phone && order.customer.phone.toLowerCase().includes(q)) ||
        (order.tableNumber && order.tableNumber.toLowerCase().includes(q));

      return matchesTab && matchesSearch;
    });
  }, [orders, activeTab, searchQuery]);

  return (
    <div className="space-y-6 pb-16">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full w-9 h-9" title="Back to Customer Menu">
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-foreground tracking-tight">
                Staff Order Dashboard
              </h1>
              <span className="text-xs bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-semibold">
                Live Neon DB
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Monitor incoming customer table orders, verify items, and update preparation status.
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <label className="text-xs text-muted-foreground flex items-center gap-1.5 cursor-pointer select-none bg-card border border-border px-3 py-1.5 rounded-full">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="accent-primary w-3.5 h-3.5"
            />
            <span>Auto-refresh (15s)</span>
          </label>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchOrders(true)}
            disabled={isRefreshing}
            className="rounded-full gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
          </Button>

          <Link href="/" target="_blank">
            <Button size="sm" variant="ghost" className="rounded-full gap-1 text-xs text-muted-foreground hover:text-foreground">
              <span>View Menu</span>
              <ExternalLink className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Today's Orders */}
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Today&apos;s Orders</span>
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <p className="font-heading font-extrabold text-2xl sm:text-3xl text-foreground">
            {stats.todayOrders}
          </p>
          <span className="text-[11px] text-muted-foreground block">Placed since midnight</span>
        </div>

        {/* Pending Orders */}
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-300">
            <span className="text-xs font-medium uppercase tracking-wider">Pending Action</span>
            <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="font-heading font-extrabold text-2xl sm:text-3xl text-amber-800 dark:text-amber-200">
            {stats.pendingOrders}
          </p>
          <span className="text-[11px] text-amber-700/80 dark:text-amber-300/80 block">Requires confirmation</span>
        </div>

        {/* Completed Orders */}
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:p-5 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300">
            <span className="text-xs font-medium uppercase tracking-wider">Completed</span>
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="font-heading font-extrabold text-2xl sm:text-3xl text-emerald-800 dark:text-emerald-200">
            {stats.completedOrders}
          </p>
          <span className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 block">Fulfilled today</span>
        </div>

        {/* Today's Revenue */}
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Today&apos;s Revenue</span>
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <p className="font-heading font-extrabold text-2xl sm:text-3xl text-foreground">
            {formatPaiseToRupees(stats.todayRevenueInPaise)}
          </p>
          <span className="text-[11px] text-muted-foreground block">Confirmed & completed orders</span>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Filter Tabs */}
          <div className="flex flex-wrap gap-1.5 bg-muted/60 p-1 rounded-2xl border border-border/50">
            {(
              [
                { id: 'ALL', label: 'All Orders', count: orders.length },
                { id: 'PENDING', label: 'Pending', count: orders.filter((o) => o.status === 'PENDING').length },
                { id: 'CONFIRMED', label: 'Brewing', count: orders.filter((o) => o.status === 'CONFIRMED').length },
                { id: 'COMPLETED', label: 'Completed', count: orders.filter((o) => o.status === 'COMPLETED').length },
                { id: 'CANCELLED', label: 'Cancelled', count: orders.filter((o) => o.status === 'CANCELLED').length },
              ] as const
            ).map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as OrderStatus | 'ALL')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isActive ? 'bg-primary text-primary-foreground font-bold' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search reference, customer, table..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-full text-xs bg-background border-border"
            />
          </div>
        </div>

        {lastRefreshedAt && (
          <div className="text-[11px] text-muted-foreground flex items-center justify-between px-1">
            <span>
              Showing {filteredOrders.length} of {orders.length} orders
            </span>
            <span>Last synchronized: {lastRefreshedAt.toLocaleTimeString()}</span>
          </div>
        )}
      </div>

      {/* Orders List / Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-5 space-y-3 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-6 bg-muted rounded w-2/3" />
              <div className="h-16 bg-muted rounded w-full" />
              <div className="h-8 bg-muted rounded w-full" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
          <h3 className="font-heading font-bold text-lg text-foreground">Failed to Load Orders</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">{error}</p>
          <Button onClick={() => fetchOrders(true)} className="rounded-full px-6 text-xs">
            Try Again
          </Button>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/50 p-12 text-center space-y-3 my-4">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-muted-foreground mx-auto">
            <Coffee className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="font-heading font-bold text-lg text-foreground">No Orders Found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {searchQuery
                ? `No orders match "${searchQuery}". Try clearing your search.`
                : activeTab !== 'ALL'
                ? `No orders with status "${activeTab}".`
                : 'No orders recorded in the system yet.'}
            </p>
          </div>
          {searchQuery && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchQuery('')}
              className="rounded-full text-xs"
            >
              Clear Search
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map((order) => {
            const statusStyle = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
            const StatusIcon = statusStyle.icon;
            const isUpdating = updatingOrderId === order.id;

            return (
              <div
                key={order.id}
                className={`rounded-2xl border bg-card p-5 flex flex-col justify-between space-y-4 shadow-sm transition-all hover:shadow-md ${
                  order.status === 'PENDING'
                    ? 'border-amber-500/40 ring-1 ring-amber-500/20'
                    : 'border-border'
                }`}
              >
                {/* Card Header */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2.5">
                    <div className="space-y-0.5">
                      <span className="font-mono font-bold text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                        #{order.orderReference || order.id.slice(0, 8).toUpperCase()}
                      </span>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatTimeAgo(order.createdAt)}</span>
                        <span>•</span>
                        <span>{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
                    >
                      <StatusIcon className="w-3.5 h-3.5" />
                      <span>{statusStyle.label}</span>
                    </span>
                  </div>

                  {/* Customer & Location */}
                  <div className="space-y-1 bg-muted/30 p-2.5 rounded-xl text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-primary" />
                        {order.customer.name}
                      </span>
                      <span className="font-bold text-primary flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {order.tableNumber ? order.tableNumber : 'Takeaway'}
                      </span>
                    </div>

                    {order.customer.phone && (
                      <div className="text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        <a
                          href={`tel:${order.customer.phone}`}
                          className="hover:text-foreground transition-colors hover:underline"
                        >
                          {order.customer.phone}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Item List */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Ordered Items ({order.items.reduce((s, i) => s + i.quantity, 0)})
                    </span>
                    <div className="space-y-1 bg-background border border-border/40 p-2.5 rounded-xl text-xs divide-y divide-border/30 max-h-36 overflow-y-auto">
                      {order.items.map((item, idx) => (
                        <div key={item.id || idx} className={`flex justify-between items-center ${idx > 0 ? 'pt-1.5' : ''}`}>
                          <span className="text-foreground">
                            <strong className="text-primary font-bold">{item.quantity}×</strong> {item.productName}
                          </span>
                          <span className="font-medium text-muted-foreground text-[11px]">
                            {formatPaiseToRupees(item.unitPriceInPaise * item.quantity)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Notes Callout */}
                  {order.notes && (
                    <div className="text-xs p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200">
                      <span className="font-bold text-[10px] uppercase tracking-wider block text-amber-700 dark:text-amber-300">
                        Notes:
                      </span>
                      <p className="italic text-[11px]">&ldquo;{order.notes}&rdquo;</p>
                    </div>
                  )}
                </div>

                {/* Card Footer: Totals & Action Buttons */}
                <div className="space-y-3 pt-2 border-t border-border/40">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Order Total</span>
                    <span className="font-extrabold text-base text-foreground font-heading">
                      {formatPaiseToRupees(order.totalInPaise)}
                    </span>
                  </div>

                  {/* Action Buttons based on status */}
                  <div className="grid grid-cols-2 gap-2">
                    {order.status === 'PENDING' && (
                      <>
                        <Button
                          size="sm"
                          disabled={isUpdating}
                          onClick={() => handleStatusUpdate(order.id, 'CONFIRMED')}
                          className="w-full rounded-xl text-xs font-semibold gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Coffee className="w-3.5 h-3.5" />
                          <span>Accept & Brew</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isUpdating}
                          onClick={() => handleStatusUpdate(order.id, 'CANCELLED')}
                          className="w-full rounded-xl text-xs font-semibold gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Cancel</span>
                        </Button>
                      </>
                    )}

                    {order.status === 'CONFIRMED' && (
                      <>
                        <Button
                          size="sm"
                          disabled={isUpdating}
                          onClick={() => handleStatusUpdate(order.id, 'COMPLETED')}
                          className="w-full rounded-xl text-xs font-semibold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white col-span-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Mark Served</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isUpdating}
                          onClick={() => handleStatusUpdate(order.id, 'CANCELLED')}
                          className="w-full rounded-xl text-xs font-semibold gap-1 text-muted-foreground hover:text-destructive"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Cancel</span>
                        </Button>
                      </>
                    )}

                    {(order.status === 'COMPLETED' || order.status === 'CANCELLED') && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isUpdating}
                        onClick={() => handleStatusUpdate(order.id, 'PENDING')}
                        className="w-full rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground col-span-2"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Reopen as Pending</span>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
