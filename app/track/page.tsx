'use client';

import * as React from 'react';
import { Fragment, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Search,
  Coffee,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  Receipt,
  MapPin,
  User,
  ArrowLeft,
  ClipboardList,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatPaiseToRupees } from '@/utils/whatsapp';
import { OrderStatus } from '@/types';
import { isValidOrderReference } from '@/lib/order-tracking-validation';

const POLL_INTERVAL_MS = 7000;

const TERMINAL_STATUSES: OrderStatus[] = ['COMPLETED', 'CANCELLED'];

const STEPS: Array<{
  status: OrderStatus;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    status: 'PENDING',
    label: 'Placed',
    hint: 'We received your order.',
    icon: ClipboardList,
  },
  {
    status: 'CONFIRMED',
    label: 'Preparing',
    hint: 'Our barista is making it now.',
    icon: Coffee,
  },
  {
    status: 'COMPLETED',
    label: 'Ready/Served',
    hint: 'Enjoy your order!',
    icon: CheckCircle2,
  },
];

const CANCELLED_HINTS: Record<OrderStatus, string> = {
  PENDING: 'We received your order. Hang tight!',
  CONFIRMED: 'Our barista is preparing your order now.',
  COMPLETED: 'Your order is ready. Enjoy!',
  CANCELLED: 'We were unable to fulfil this order. Please talk to the counter.',
};

interface TrackedOrder {
  id: string;
  orderReference: string;
  status: OrderStatus;
  customer: { name: string };
  tableNumber?: string | null;
  notes?: string | null;
  subtotalInPaise: number;
  taxInPaise: number;
  totalInPaise: number;
  createdAt: string;
  updatedAt?: string;
  items: Array<{
    id: string;
    productName: string;
    unitPriceInPaise: number;
    quantity: number;
  }>;
}

function getStepperIndex(status: OrderStatus): number {
  if (status === 'CANCELLED') return -1;
  return STEPS.findIndex((step) => step.status === status);
}

function StepCircle({
  state,
  Icon,
}: {
  state: 'done' | 'current' | 'upcoming';
  Icon: React.ComponentType<{ className?: string }>;
}) {
  const styles: Record<string, string> = {
    done: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    current: 'bg-primary/10 text-primary border-primary/20 ring-2 ring-primary/20 animate-scale-in',
    upcoming: 'bg-muted text-muted-foreground border-border/40',
  };
  return (
    <div
      className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full border flex items-center justify-center flex-none transition-all ${styles[state]}`}
    >
      {state === 'done' ? (
        <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
      ) : (
        <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
      )}
    </div>
  );
}

function TrackOrderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refFromUrl = (searchParams.get('ref') || '').trim();

  const [orderRef, setOrderRef] = React.useState(refFromUrl);
  const [phoneLast4, setPhoneLast4] = React.useState('');
  const [isLooking, setIsLooking] = React.useState(false);
  const [isPolling, setIsPolling] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [order, setOrder] = React.useState<TrackedOrder | null>(null);

  const lastQueryRef = React.useRef<{ orderRef: string; phoneLast4: string } | null>(null);
  const pollTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const autoLookedUpRef = React.useRef(false);
  const requestSeqRef = React.useRef(0);

  const clearPollTimer = React.useCallback(() => {
    if (pollTimerRef.current !== null) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const fetchOrder = React.useCallback(
    async (ref: string, last4: string, opts: { silent?: boolean; manual?: boolean } = {}) => {
      const params = new URLSearchParams({ orderRef: ref });
      if (last4.trim()) {
        params.set('phoneLast4', last4.trim());
      }

      const seq = ++requestSeqRef.current;

      try {
        const res = await fetch(`/api/orders/track?${params.toString()}`);
        const data = await res.json();

        if (seq !== requestSeqRef.current) return;

        if (!res.ok) {
          if (opts.silent || opts.manual) {
            clearPollTimer();
          }
          throw new Error(data.message || 'Unable to find your order.');
        }

        setOrder(data.order);
        lastQueryRef.current = { orderRef: ref, phoneLast4: last4 };
        setError(null);
        if (!opts.silent && !opts.manual) {
          toast.success('Order found!');
        }
      } catch (err) {
        if (seq !== requestSeqRef.current) return;
        if (!opts.silent) {
          const msg = err instanceof Error ? err.message : 'Unable to look up your order.';
          setError(msg);
          toast.error(msg);
        }
      }
    },
    [clearPollTimer]
  );

  // Auto-lookup: only fires when the ?ref= param matches NC-XXXXXXXX.
  // Invalid formats never hit the API — a render-derived notice is shown instead.
  React.useEffect(() => {
    if (autoLookedUpRef.current) return;
    autoLookedUpRef.current = true;

    if (!refFromUrl || !isValidOrderReference(refFromUrl)) return;

    const frame = requestAnimationFrame(() => {
      setOrderRef(refFromUrl);
      void fetchOrder(refFromUrl, '');
    });
    return () => cancelAnimationFrame(frame);
  }, [refFromUrl, fetchOrder]);

  // Polling: run while order is active AND the tab is visible. Stop on terminal states.
  React.useEffect(() => {
    const orderStatus = order?.status;
    const query = lastQueryRef.current;

    if (!orderStatus || TERMINAL_STATUSES.includes(orderStatus) || !query) {
      clearPollTimer();
      return;
    }

    const tick = () => {
      if (document.visibilityState === 'hidden') return;
      void fetchOrder(query.orderRef, query.phoneLast4, { silent: true });
    };

    const startPolling = () => {
      clearPollTimer();
      pollTimerRef.current = setInterval(tick, POLL_INTERVAL_MS);
      setIsPolling(true);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearPollTimer();
      } else if (orderStatus && !TERMINAL_STATUSES.includes(orderStatus)) {
        tick();
        startPolling();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    startPolling();

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearPollTimer();
    };
  }, [order?.status, order?.orderReference, fetchOrder, clearPollTimer]);

  const isValid = isValidOrderReference(orderRef);

  const refFormatHint =
    refFromUrl && !isValidOrderReference(refFromUrl)
      ? 'Invalid order reference format — expected something like NC-A1B2C3D4. You can retry below.'
      : null;

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isLooking) return;
    setIsLooking(true);
    setError(null);
    await fetchOrder(orderRef, phoneLast4);
    setIsLooking(false);
  };

  const handleManualRefresh = async () => {
    const q = lastQueryRef.current;
    if (!q || isRefreshing) return;
    setIsRefreshing(true);
    await fetchOrder(q.orderRef, q.phoneLast4, { manual: true });
    setIsRefreshing(false);
  };

  const currentIndex = order ? getStepperIndex(order.status) : -1;

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-6 pb-16">
      {/* Header */}
      <div className="space-y-3 py-6 px-4 rounded-3xl bg-primary/5 border border-primary/15 text-center">
        <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
          <Search className="w-7 h-7" />
        </div>
        <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-foreground">
          Track Your Order
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
          Enter your order reference to check the current status. For privacy, you may also enter the last 4 digits of the phone number used at checkout.
        </p>
      </div>

      {/* Lookup Form */}
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4 shadow-sm">
        <form onSubmit={handleTrack} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="orderRef" className="text-xs font-semibold text-foreground">
              Order Reference
            </Label>
            <Input
              id="orderRef"
              type="text"
              required
              placeholder="e.g. NC-A1B2C3D4"
              value={orderRef}
              onChange={(e) => setOrderRef(e.target.value.toUpperCase())}
              className="rounded-xl border-border bg-background font-mono"
              disabled={isLooking}
            />
            <p className="text-[11px] text-muted-foreground">
              Found on your order confirmation or WhatsApp message.
            </p>
            {refFormatHint && (
              <p className="text-[11px] text-destructive font-medium">{refFormatHint}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phoneLast4" className="text-xs font-semibold text-foreground">
              Last 4 digits of phone <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="phoneLast4"
              type="tel"
              maxLength={4}
              placeholder="e.g. 3210"
              value={phoneLast4}
              onChange={(e) => setPhoneLast4(e.target.value.replace(/\D/g, ''))}
              className="rounded-xl border-border bg-background font-mono"
              disabled={isLooking}
            />
            <p className="text-[11px] text-muted-foreground">
              Adds an extra layer of verification to protect your order data.
            </p>
          </div>

          <Button
            type="submit"
            disabled={!isValid || isLooking}
            className="w-full py-5 rounded-full font-bold gap-2"
          >
            {isLooking ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Looking up order...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Track Order</span>
              </>
            )}
          </Button>
        </form>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-3 animate-fade-in">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
          <p className="text-sm text-foreground font-medium">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setError(null); setOrder(null); }}
            className="rounded-full text-xs"
          >
            Try Again
          </Button>
        </div>
      )}

      {/* Order Result */}
      {order && (
        <div className="space-y-5">
          {/* Status Card */}
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-heading font-bold text-sm text-foreground">Order Status</h2>

              {order.status === 'CANCELLED' ? (
                <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 bg-rose-500/10 border border-rose-500/30 px-2.5 py-1 rounded-full">
                  Cancelled
                </span>
              ) : TERMINAL_STATUSES.includes(order.status) ? (
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                  Final Status
                </span>
              ) : isPolling ? (
                <span className="text-[11px] font-semibold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full flex items-center gap-1.5 animate-fade-in">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Live · updates every 7s
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full flex items-center gap-1.5">
                  <span className="relative flex w-2 h-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-muted-foreground opacity-60" />
                    <span className="relative inline-flex rounded-full w-2 h-2 bg-muted-foreground" />
                  </span>
                  Paused
                </span>
              )}
            </div>

            {order.status === 'CANCELLED' ? (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center space-y-2 animate-fade-in">
                <div className="w-12 h-12 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
                  <XCircle className="w-6 h-6" />
                </div>
                <p className="font-heading font-bold text-lg text-rose-700 dark:text-rose-300">
                  Order Cancelled
                </p>
                <p className="text-xs text-muted-foreground">
                  {CANCELLED_HINTS.CANCELLED}
                </p>
              </div>
            ) : (
              <div className="animate-fade-in">
                {/* Horizontal Stepper */}
                <div className="w-full">
                  <div className="flex items-center w-full">
                    {STEPS.map((step, idx) => {
                      const isDone = currentIndex > idx || order.status === 'COMPLETED';
                      const isCurrent = order.status !== 'COMPLETED' && currentIndex === idx;
                      return (
                        <Fragment key={step.status}>
                          {idx > 0 && (
                            <div
                              className={`flex-1 h-[3px] rounded-full mx-1.5 sm:mx-2 ${
                                currentIndex >= idx ? 'bg-emerald-400 dark:bg-emerald-500' : 'bg-muted'
                              }`}
                            />
                          )}
                          <StepCircle
                            state={isDone ? 'done' : isCurrent ? 'current' : 'upcoming'}
                            Icon={step.icon}
                          />
                        </Fragment>
                      );
                    })}
                  </div>
                  <div className="flex items-start w-full mt-2">
                    {STEPS.map((step, idx) => {
                      const isDone = currentIndex > idx || order.status === 'COMPLETED';
                      const isCurrent = order.status !== 'COMPLETED' && currentIndex === idx;
                      return (
                        <Fragment key={step.status}>
                          {idx > 0 && <div className="flex-1" />}
                          <div className="w-12 sm:w-14 flex-none text-center">
                            <span
                              className={`block text-[11px] sm:text-xs font-semibold leading-tight ${
                                isDone
                                  ? 'text-emerald-700 dark:text-emerald-300'
                                  : isCurrent
                                  ? 'text-primary'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              {step.label}
                            </span>
                          </div>
                        </Fragment>
                      );
                    })}
                  </div>
                </div>

                {/* Current status hint */}
                <div className="mt-4 pt-4 border-t border-border/40 flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {STEPS[currentIndex] ? STEPS[currentIndex].hint : CANCELLED_HINTS.PENDING}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isRefreshing}
                    onClick={handleManualRefresh}
                    className="rounded-full gap-1.5 text-xs text-muted-foreground hover:text-foreground flex-none"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Order Details */}
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4 shadow-sm">
            {/* Order header */}
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div>
                <span className="font-mono font-bold text-sm bg-primary/10 text-primary px-2.5 py-0.5 rounded-md">
                  #{order.orderReference}
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(order.createdAt).toLocaleDateString('en-IN', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}{' '}
                  at{' '}
                  {new Date(order.createdAt).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <span className="font-extrabold text-xl text-primary">
                {formatPaiseToRupees(order.totalInPaise)}
              </span>
            </div>

            {/* Customer / Table */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-muted/30 p-3 rounded-xl border border-border/40">
              <div className="space-y-1">
                <span className="text-muted-foreground flex items-center gap-1 font-semibold">
                  <User className="w-3.5 h-3.5 text-primary" /> Customer
                </span>
                <p className="text-foreground font-medium">{order.customer.name}</p>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground flex items-center gap-1 font-semibold">
                  <MapPin className="w-3.5 h-3.5 text-primary" /> Location
                </span>
                <p className="text-foreground font-medium">
                  {order.tableNumber || 'Takeaway'}
                </p>
              </div>
            </div>

            {/* Items */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Receipt className="w-3.5 h-3.5 text-primary" />
                <span>Items Ordered</span>
              </div>
              <div className="space-y-1.5 border border-border/40 rounded-xl p-3 bg-background">
                {order.items.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className={`flex items-center justify-between text-xs ${idx > 0 ? 'pt-1.5 border-t border-border/30' : ''}`}
                  >
                    <span className="text-foreground">
                      <strong className="text-primary font-bold">{item.quantity}x</strong>{' '}
                      {item.productName}
                    </span>
                    <span className="font-medium text-muted-foreground">
                      {formatPaiseToRupees(item.unitPriceInPaise * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="space-y-1 text-xs border-t border-border/40 pt-3">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="font-semibold text-foreground">{formatPaiseToRupees(order.subtotalInPaise)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>GST (5%)</span>
                <span className="font-semibold text-foreground">{formatPaiseToRupees(order.taxInPaise)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-foreground pt-2 border-t border-border/30">
                <span>Total</span>
                <span className="text-primary">{formatPaiseToRupees(order.totalInPaise)}</span>
              </div>
            </div>

            {/* Notes */}
            {order.notes && (
              <div className="text-xs p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 italic">
                &ldquo;{order.notes}&rdquo;
              </div>
            )}
          </div>

          {/* Track another button */}
          <div className="text-center">
            <Button
              variant="outline"
              onClick={() => {
                setOrder(null);
                setError(null);
                setOrderRef('');
                lastQueryRef.current = null;
                requestSeqRef.current++;
                clearPollTimer();
                router.replace('/track');
              }}
              className="rounded-full gap-2 text-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Track Another Order
            </Button>
          </div>
        </div>
      )}

      {/* Bottom link */}
      <div className="text-center pt-2">
        <Link href="/">
          <Button variant="ghost" className="rounded-full gap-2 text-muted-foreground hover:text-foreground text-xs">
            <Coffee className="w-4 h-4" />
            <span>Browse Menu</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function TrackOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto py-6 flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-xs">Loading tracking...</p>
        </div>
      }
    >
      <TrackOrderContent />
    </Suspense>
  );
}