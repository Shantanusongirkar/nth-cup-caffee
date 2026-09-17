'use client';

import * as React from 'react';
import Link from 'next/link';
import { ServerOrder, OrderStatus, AdminOrderStats, OrderPaymentStatus } from '@/types';
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
  Volume2,
  VolumeX,
  FileText,
  Filter,
  ArrowUpDown,
  Utensils,
  X,
  Flame,
} from 'lucide-react';
import { toast } from 'sonner';

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; badgeBg: string; badgeText: string; badgeBorder: string; cardAccent: string; icon: React.ComponentType<{ className?: string }> }
> = {
  PENDING: {
    label: 'Pending',
    badgeBg: 'bg-amber-500/15 dark:bg-amber-500/20',
    badgeText: 'text-amber-700 dark:text-amber-300',
    badgeBorder: 'border-amber-500/40',
    cardAccent: 'border-amber-500/50 shadow-amber-500/5 ring-1 ring-amber-500/25',
    icon: Clock,
  },
  CONFIRMED: {
    label: 'Brewing',
    badgeBg: 'bg-primary/15 dark:bg-primary/25',
    badgeText: 'text-primary dark:text-primary',
    badgeBorder: 'border-primary/40',
    cardAccent: 'border-primary/40 shadow-primary/5 ring-1 ring-primary/20',
    icon: Coffee,
  },
  COMPLETED: {
    label: 'Completed',
    badgeBg: 'bg-emerald-500/15 dark:bg-emerald-500/20',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    badgeBorder: 'border-emerald-500/40',
    cardAccent: 'border-emerald-500/30',
    icon: CheckCircle2,
  },
  CANCELLED: {
    label: 'Cancelled',
    badgeBg: 'bg-rose-500/10 dark:bg-rose-500/20',
    badgeText: 'text-rose-700 dark:text-rose-400',
    badgeBorder: 'border-rose-500/30',
    cardAccent: 'border-border/60 opacity-80',
    icon: XCircle,
  },
};

const PAYMENT_CONFIG: Record<
  OrderPaymentStatus,
  { label: string; bg: string; text: string; border: string; icon: React.ComponentType<{ className?: string }> }
> = {
  UNPAID: {
    label: 'Unpaid',
    bg: 'bg-amber-500/10 dark:bg-amber-500/20',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-500/30',
    icon: IndianRupee,
  },
  PAID: {
    label: 'Paid',
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-500/30',
    icon: Check,
  },
  FAILED: {
    label: 'Failed',
    bg: 'bg-rose-500/10 dark:bg-rose-500/20',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-500/30',
    icon: XCircle,
  },
  REFUNDED: {
    label: 'Refunded',
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    border: 'border-border',
    icon: ArrowLeft,
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

function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Pleasant dual-note chime: D5 (587Hz) to A5 (880Hz)
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    // Ignore audio permission/autoplay constraints
  }
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
  const [typeFilter, setTypeFilter] = React.useState<'ALL' | 'DINE_IN' | 'TAKEAWAY'>('ALL');
  const [sortOrder, setSortOrder] = React.useState<'NEWEST' | 'OLDEST'>('NEWEST');
  const [autoRefresh, setAutoRefresh] = React.useState(true);
  const [soundEnabled, setSoundEnabled] = React.useState(true);
  const [lastRefreshedAt, setLastRefreshedAt] = React.useState<Date | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = React.useState<string | null>(null);

  // Track known order IDs for sound notification on new pending order arrival
  const knownOrderIdsRef = React.useRef<Set<string>>(new Set());

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
      const incomingOrders: ServerOrder[] = data.orders || [];

      // Check for newly arrived pending orders
      if (knownOrderIdsRef.current.size > 0 && soundEnabled) {
        const hasNewPending = incomingOrders.some(
          (o) => o.status === 'PENDING' && !knownOrderIdsRef.current.has(o.id)
        );
        if (hasNewPending) {
          playNotificationChime();
          toast.info('New incoming order received!', {
            description: 'A customer just placed an order.',
          });
        }
      }

      // Update known IDs
      knownOrderIdsRef.current = new Set(incomingOrders.map((o) => o.id));

      setOrders(incomingOrders);
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
  }, [soundEnabled]);

  // Initial load
  React.useEffect(() => {
    fetchOrders(false);
  }, [fetchOrders]);

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

      const statusLabels: Record<OrderStatus, string> = {
        PENDING: 'Reopened as Pending',
        CONFIRMED: 'Accepted for Brewing',
        COMPLETED: 'Marked as Completed & Served',
        CANCELLED: 'Order Cancelled',
      };

      toast.success(statusLabels[newStatus] || `Order status updated to ${newStatus}`);
    } catch (err) {
      console.error('Error updating order:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update status.');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Filter and sort orders
  const filteredOrders = React.useMemo(() => {
    let result = orders.filter((order) => {
      // Status tab filter
      const matchesTab = activeTab === 'ALL' || order.status === activeTab;

      // Type filter (Dine-in vs Takeaway)
      const isTakeaway = !order.tableNumber || order.tableNumber.toLowerCase().includes('takeaway');
      const matchesType =
        typeFilter === 'ALL' ||
        (typeFilter === 'TAKEAWAY' && isTakeaway) ||
        (typeFilter === 'DINE_IN' && !isTakeaway);

      // Search query filter
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (order.orderReference && order.orderReference.toLowerCase().includes(q)) ||
        order.id.toLowerCase().includes(q) ||
        order.customer.name.toLowerCase().includes(q) ||
        (order.customer.phone && order.customer.phone.toLowerCase().includes(q)) ||
        (order.tableNumber && order.tableNumber.toLowerCase().includes(q)) ||
        order.items.some((i) => i.productName.toLowerCase().includes(q));

      return matchesTab && matchesType && matchesSearch;
    });

    // Sort order
    result.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortOrder === 'NEWEST' ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [orders, activeTab, typeFilter, searchQuery, sortOrder]);

  const brewingCount = React.useMemo(
    () => orders.filter((o) => o.status === 'CONFIRMED').length,
    [orders]
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1650px] mx-auto pb-16">
      {/* ── Top Header Bar ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-border/60">
        <div className="flex items-center gap-3.5">
          <Link href="/">
            <Button
              variant="outline"
              size="icon"
              className="rounded-xl w-10 h-10 shrink-0 border-border/80 hover:bg-muted"
              title="Return to Customer Menu"
            >
              <ArrowLeft className="w-4 h-4 text-foreground" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-foreground tracking-tight">
                Staff Order Dashboard
              </h1>
              {/* Live indicator badge */}
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Live Kitchen Queue</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Monitor customer table orders, brew artisanal items, and track live fulfillment.
            </p>
          </div>
        </div>

        {/* Action Controls & Toggles */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Sound Alert Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              if (next) playNotificationChime();
              toast(next ? 'Sound notifications enabled' : 'Sound notifications muted');
            }}
            className={`rounded-xl text-xs font-medium gap-1.5 h-9 border-border/80 ${
              soundEnabled ? 'text-primary border-primary/40 bg-primary/5' : 'text-muted-foreground'
            }`}
            title={soundEnabled ? 'Mute order chimes' : 'Enable order chimes'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{soundEnabled ? 'Chime On' : 'Chime Off'}</span>
          </Button>

          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 h-9 rounded-xl border transition-colors select-none ${
              autoRefresh
                ? 'bg-card border-primary/40 text-primary'
                : 'bg-card border-border/80 text-muted-foreground hover:text-foreground'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                autoRefresh ? 'bg-primary animate-pulse' : 'bg-muted-foreground'
              }`}
            />
            <span>Auto-refresh (15s)</span>
          </button>

          {/* Manual Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchOrders(true)}
            disabled={isRefreshing}
            className="rounded-xl gap-1.5 text-xs font-semibold h-9 border-border/80"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
          </Button>

          {/* Customer Menu Link */}
          <Link href="/" target="_blank">
            <Button
              size="sm"
              variant="ghost"
              className="rounded-xl gap-1.5 text-xs text-muted-foreground hover:text-foreground h-9"
            >
              <span>View Customer Menu</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* ── KPI Stats Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {/* Card 1: Today's Orders */}
        <div
          onClick={() => setActiveTab('ALL')}
          className={`cursor-pointer rounded-2xl border p-4 sm:p-5 space-y-1.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
            activeTab === 'ALL'
              ? 'border-primary/50 bg-card ring-1 ring-primary/20 shadow-sm'
              : 'border-border/80 bg-card hover:border-border'
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-bold uppercase tracking-wider">Today&apos;s Orders</span>
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <p className="font-heading font-extrabold text-2xl sm:text-3xl text-foreground">
            {stats.todayOrders}
          </p>
          <span className="text-[11px] text-muted-foreground block">Placed since midnight</span>
        </div>

        {/* Card 2: Pending Action */}
        <div
          onClick={() => setActiveTab('PENDING')}
          className={`cursor-pointer rounded-2xl border p-4 sm:p-5 space-y-1.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
            activeTab === 'PENDING'
              ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/30 shadow-sm'
              : 'border-amber-500/40 bg-amber-500/5 hover:border-amber-500/60'
          }`}
        >
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-300">
            <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
              Pending Action
              {stats.pendingOrders > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              )}
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-300 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="font-heading font-extrabold text-2xl sm:text-3xl text-amber-800 dark:text-amber-200">
            {stats.pendingOrders}
          </p>
          <span className="text-[11px] text-amber-700/80 dark:text-amber-300/80 block">
            Requires barista confirmation
          </span>
        </div>

        {/* Card 3: Brewing / In Kitchen */}
        <div
          onClick={() => setActiveTab('CONFIRMED')}
          className={`cursor-pointer rounded-2xl border p-4 sm:p-5 space-y-1.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
            activeTab === 'CONFIRMED'
              ? 'border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm'
              : 'border-primary/40 bg-primary/5 hover:border-primary/60'
          }`}
        >
          <div className="flex items-center justify-between text-primary">
            <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
              Currently Brewing
            </span>
            <div className="w-8 h-8 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
              <Coffee className="w-4 h-4" />
            </div>
          </div>
          <p className="font-heading font-extrabold text-2xl sm:text-3xl text-foreground">
            {brewingCount}
          </p>
          <span className="text-[11px] text-muted-foreground block">
            Items in preparation
          </span>
        </div>

        {/* Card 4: Completed Today */}
        <div
          onClick={() => setActiveTab('COMPLETED')}
          className={`cursor-pointer rounded-2xl border p-4 sm:p-5 space-y-1.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
            activeTab === 'COMPLETED'
              ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/30 shadow-sm'
              : 'border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500/60'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300">
            <span className="text-[11px] font-bold uppercase tracking-wider">Completed</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="font-heading font-extrabold text-2xl sm:text-3xl text-emerald-800 dark:text-emerald-200">
            {stats.completedOrders}
          </p>
          <span className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 block">Fulfilled today</span>
        </div>

        {/* Card 5: Today's Revenue */}
        <div className="col-span-2 sm:col-span-2 lg:col-span-1 rounded-2xl border border-border/80 bg-card p-4 sm:p-5 space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-bold uppercase tracking-wider">Today&apos;s Revenue</span>
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <p className="font-heading font-extrabold text-2xl sm:text-3xl text-foreground">
            {formatPaiseToRupees(stats.todayRevenueInPaise)}
          </p>
          <span className="text-[11px] text-muted-foreground block">Confirmed & completed</span>
        </div>
      </div>

      {/* ── Filters, Search & View Controls ── */}
      <div className="space-y-3 pt-1">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex flex-wrap gap-1.5 bg-muted/50 p-1.5 rounded-2xl border border-border/60">
            {(
              [
                { id: 'ALL', label: 'All Orders', count: orders.length, color: 'bg-muted' },
                { id: 'PENDING', label: 'Pending', count: orders.filter((o) => o.status === 'PENDING').length, color: 'bg-amber-500' },
                { id: 'CONFIRMED', label: 'Brewing', count: brewingCount, color: 'bg-primary' },
                { id: 'COMPLETED', label: 'Completed', count: orders.filter((o) => o.status === 'COMPLETED').length, color: 'bg-emerald-500' },
                { id: 'CANCELLED', label: 'Cancelled', count: orders.filter((o) => o.status === 'CANCELLED').length, color: 'bg-rose-500' },
              ] as const
            ).map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as OrderStatus | 'ALL')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all select-none ${
                    isActive
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${tab.color}`} />
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Secondary Controls: Search, Order Type, and Sort */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            {/* Search Input */}
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                placeholder="Search reference, customer, table, item..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 h-10 rounded-xl text-xs bg-background border-border/80"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded-lg"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Dine-In / Takeaway Filter */}
            <div className="flex items-center bg-muted/50 p-1 rounded-xl border border-border/60 shrink-0">
              {(
                [
                  { id: 'ALL', label: 'All' },
                  { id: 'DINE_IN', label: 'Dine-In' },
                  { id: 'TAKEAWAY', label: 'Takeaway' },
                ] as const
              ).map((type) => (
                <button
                  key={type.id}
                  onClick={() => setTypeFilter(type.id)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                    typeFilter === type.id
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>

            {/* Sort Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === 'NEWEST' ? 'OLDEST' : 'NEWEST')}
              className="h-10 rounded-xl text-xs font-semibold gap-1.5 border-border/80 shrink-0"
              title={sortOrder === 'NEWEST' ? 'Sorting by newest first' : 'Sorting by oldest first (queue order)'}
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">{sortOrder === 'NEWEST' ? 'Newest' : 'Oldest'}</span>
            </Button>
          </div>
        </div>

        {/* Sync status & count line */}
        <div className="text-[11px] text-muted-foreground flex items-center justify-between px-1">
          <span>
            Showing <strong className="text-foreground">{filteredOrders.length}</strong> of {orders.length} orders
            {activeTab !== 'ALL' && ` in ${STATUS_CONFIG[activeTab]?.label || activeTab}`}
            {typeFilter !== 'ALL' && ` (${typeFilter === 'DINE_IN' ? 'Dine-In only' : 'Takeaway only'})`}
          </span>
          {lastRefreshedAt && (
            <span>Last synchronized: {lastRefreshedAt.toLocaleTimeString()}</span>
          )}
        </div>
      </div>

      {/* ── Orders Grid / List ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-5">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="rounded-2xl border border-border/70 bg-card p-5 space-y-4 animate-pulse">
              <div className="flex justify-between items-center pb-3 border-b border-border/40">
                <div className="h-5 bg-muted rounded w-28" />
                <div className="h-6 bg-muted rounded-full w-20" />
              </div>
              <div className="h-12 bg-muted/60 rounded-xl" />
              <div className="h-24 bg-muted/40 rounded-xl" />
              <div className="flex justify-between items-center pt-2">
                <div className="h-4 bg-muted rounded w-20" />
                <div className="h-6 bg-muted rounded w-16" />
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="h-9 bg-muted rounded-xl" />
                <div className="h-9 bg-muted rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-12 text-center space-y-4 max-w-md mx-auto my-8">
          <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-heading font-bold text-lg text-foreground">Failed to Load Orders</h3>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
          <Button onClick={() => fetchOrders(true)} className="rounded-xl px-6 text-xs font-semibold">
            Try Again
          </Button>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/80 bg-card/40 p-16 text-center space-y-4 my-6 max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-muted/80 flex items-center justify-center text-muted-foreground mx-auto shadow-inner">
            <Coffee className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h3 className="font-heading font-bold text-lg text-foreground">No Orders Found</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {searchQuery
                ? `No orders match "${searchQuery}". Try searching by customer name, order number, or clear your query.`
                : activeTab !== 'ALL'
                ? `No orders currently marked as "${STATUS_CONFIG[activeTab]?.label || activeTab}".`
                : typeFilter !== 'ALL'
                ? `No ${typeFilter === 'DINE_IN' ? 'Dine-In' : 'Takeaway'} orders found.`
                : 'No orders recorded in the system yet.'}
            </p>
          </div>
          {(searchQuery || activeTab !== 'ALL' || typeFilter !== 'ALL') && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setActiveTab('ALL');
                  setTypeFilter('ALL');
                }}
                className="rounded-xl text-xs font-semibold"
              >
                Reset All Filters
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-5">
          {filteredOrders.map((order) => {
            const statusStyle = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
            const StatusIcon = statusStyle.icon;
            const isUpdating = updatingOrderId === order.id;
            const totalItemsCount = order.items.reduce((s, i) => s + i.quantity, 0);

            const isTakeaway = !order.tableNumber || order.tableNumber.toLowerCase().includes('takeaway');
            const tableDisplayName = order.tableNumber ? order.tableNumber.replace(/^Table\s*/i, 'Table ') : null;

            return (
              <div
                key={order.id}
                className={`rounded-2xl border bg-card p-5 flex flex-col justify-between space-y-4 transition-all duration-200 hover:shadow-xl ${
                  statusStyle.cardAccent
                } ${order.status === 'PENDING' ? 'bg-amber-500/[0.02]' : ''}`}
              >
                {/* ── Top Header of Card ── */}
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-3">
                    {/* Order Reference & Time */}
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-extrabold text-xs px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 whitespace-nowrap tracking-wide select-all">
                          #{order.orderReference || order.id.slice(0, 8).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground whitespace-nowrap">
                        <Clock className="w-3 h-3 text-muted-foreground/80 shrink-0" />
                        <span className="font-medium whitespace-nowrap">{formatTimeAgo(order.createdAt)}</span>
                        <span className="opacity-40">•</span>
                        <span className="whitespace-nowrap">
                          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border shadow-xs shrink-0 whitespace-nowrap ${statusStyle.badgeBg} ${statusStyle.badgeText} ${statusStyle.badgeBorder}`}
                    >
                      <StatusIcon className="w-3.5 h-3.5" />
                      <span>{statusStyle.label}</span>
                    </span>
                  </div>

                  {/* ── Customer Info & Order Location Strip ── */}
                  <div className="space-y-1.5 bg-muted/40 p-3 rounded-xl text-xs border border-border/40">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-foreground flex items-center gap-1.5 truncate">
                        <User className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="truncate">{order.customer.name}</span>
                      </span>

                      {/* Location Badge */}
                      {isTakeaway ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-secondary text-secondary-foreground border border-border/80 whitespace-nowrap shrink-0">
                          <ShoppingBag className="w-3 h-3 text-primary" />
                          <span>Takeaway</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary/15 text-primary border border-primary/30 whitespace-nowrap shrink-0">
                          <MapPin className="w-3 h-3" />
                          <span>{tableDisplayName}</span>
                        </span>
                      )}
                    </div>

                    {order.customer.phone && (
                      <div className="text-muted-foreground flex items-center gap-1.5 pt-0.5">
                        <Phone className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                        <a
                          href={`tel:${order.customer.phone}`}
                          className="hover:text-foreground font-mono transition-colors hover:underline"
                        >
                          {order.customer.phone}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* ── Item Receipt Breakdown ── */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-0.5">
                      <span>Ordered Items ({totalItemsCount})</span>
                      <Utensils className="w-3 h-3 text-muted-foreground/60" />
                    </div>

                    <div className="space-y-1.5 bg-background border border-border/60 p-3 rounded-xl text-xs divide-y divide-border/30 max-h-44 overflow-y-auto">
                      {order.items.map((item, idx) => (
                        <div
                          key={item.id || idx}
                          className={`flex justify-between items-start gap-2 ${idx > 0 ? 'pt-1.5' : ''}`}
                        >
                          <div className="flex items-start gap-2 min-w-0">
                            <span className="font-bold text-xs bg-primary/15 text-primary px-1.5 py-0.5 rounded shrink-0 leading-tight">
                              {item.quantity}×
                            </span>
                            <span className="text-foreground font-medium text-xs leading-snug">
                              {item.productName}
                            </span>
                          </div>
                          <span className="font-semibold text-foreground/80 text-xs shrink-0 whitespace-nowrap">
                            {formatPaiseToRupees(item.unitPriceInPaise * item.quantity)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── Kitchen Notes Callout ── */}
                  {order.notes && (
                    <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-200">
                      <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-[10px] uppercase tracking-wider block text-amber-700 dark:text-amber-400">
                          Customer Preparation Note:
                        </span>
                        <p className="italic text-xs mt-0.5 leading-snug">&ldquo;{order.notes}&rdquo;</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Card Footer: Totals & Status Action Buttons ── */}
                <div className="space-y-3 pt-3 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    {/* Payment Status Pill */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-medium">Payment</span>
                      {(() => {
                        const paymentStyle =
                          PAYMENT_CONFIG[order.paymentStatus || 'UNPAID'] || PAYMENT_CONFIG.UNPAID;
                        const PaymentIcon = paymentStyle.icon;
                        return (
                          <span
                            title={order.razorpayPaymentId ? `Razorpay: ${order.razorpayPaymentId}` : undefined}
                            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${paymentStyle.bg} ${paymentStyle.text} ${paymentStyle.border}`}
                          >
                            <PaymentIcon className="w-3 h-3" />
                            <span>{paymentStyle.label}</span>
                          </span>
                        );
                      })()}
                    </div>

                    {/* Total Amount */}
                    <div className="text-right">
                      <span className="font-heading font-extrabold text-lg text-foreground tracking-tight">
                        {formatPaiseToRupees(order.totalInPaise)}
                      </span>
                    </div>
                  </div>

                  {/* ── Action Buttons based on order workflow ── */}
                  <div className="grid grid-cols-2 gap-2">
                    {order.status === 'PENDING' && (
                      <>
                        <Button
                          size="sm"
                          disabled={isUpdating}
                          onClick={() => handleStatusUpdate(order.id, 'CONFIRMED')}
                          className="w-full rounded-xl text-xs font-bold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 h-9 transition-all active:scale-[0.98]"
                        >
                          <Coffee className="w-3.5 h-3.5" />
                          <span>Accept & Brew</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isUpdating}
                          onClick={() => handleStatusUpdate(order.id, 'CANCELLED')}
                          className="w-full rounded-xl text-xs font-semibold gap-1.5 text-muted-foreground hover:text-destructive border-border/80 hover:border-destructive/40 hover:bg-destructive/10 h-9"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Decline</span>
                        </Button>
                      </>
                    )}

                    {order.status === 'CONFIRMED' && (
                      <>
                        <Button
                          size="sm"
                          disabled={isUpdating}
                          onClick={() => handleStatusUpdate(order.id, 'COMPLETED')}
                          className="w-full rounded-xl text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 h-9 transition-all active:scale-[0.98]"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Mark Served</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isUpdating}
                          onClick={() => handleStatusUpdate(order.id, 'CANCELLED')}
                          className="w-full rounded-xl text-xs font-semibold gap-1.5 text-muted-foreground hover:text-destructive border-border/80 hover:bg-destructive/10 h-9"
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
                        className="w-full rounded-xl text-xs font-semibold gap-1.5 text-muted-foreground hover:text-foreground border-border/80 col-span-2 h-9"
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
