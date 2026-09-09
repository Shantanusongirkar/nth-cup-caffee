'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Search,
  Coffee,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  Receipt,
  MapPin,
  User,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { formatPaiseToRupees } from '@/utils/whatsapp';
import { OrderStatus } from '@/types';

const STATUS_TIMELINE: {
  status: OrderStatus;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
  ringColor: string;
}[] = [
  {
    status: 'PENDING',
    label: 'Order Placed',
    icon: Clock,
    color: 'text-amber-700 dark:text-amber-300',
    bgColor: 'bg-amber-500/10 dark:bg-amber-500/20',
    borderColor: 'border-amber-500/30',
    ringColor: 'ring-amber-500/20',
  },
  {
    status: 'CONFIRMED',
    label: 'Confirmed / Brewing',
    icon: Coffee,
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-500/10 dark:bg-blue-500/20',
    borderColor: 'border-blue-500/30',
    ringColor: 'ring-blue-500/20',
  },
  {
    status: 'COMPLETED',
    label: 'Ready for Pickup',
    icon: CheckCircle2,
    color: 'text-emerald-700 dark:text-emerald-300',
    bgColor: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    borderColor: 'border-emerald-500/30',
    ringColor: 'ring-emerald-500/20',
  },
];

const CANCELLED_STATUS = {
  status: 'CANCELLED' as OrderStatus,
  label: 'Cancelled',
  icon: XCircle,
  color: 'text-rose-700 dark:text-rose-300',
  bgColor: 'bg-rose-500/10 dark:bg-rose-500/20',
  borderColor: 'border-rose-500/30',
  ringColor: 'ring-rose-500/20',
};

interface TrackedOrder {
  id: string;
  orderReference: string;
  status: OrderStatus;
  customer: { name: string; phone?: string | null };
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

export default function TrackOrderPage() {
  const [orderRef, setOrderRef] = React.useState('');
  const [phoneLast4, setPhoneLast4] = React.useState('');
  const [isLooking, setIsLooking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [order, setOrder] = React.useState<TrackedOrder | null>(null);

  const isValid = orderRef.trim().length >= 4;

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isLooking) return;

    setIsLooking(true);
    setError(null);
    setOrder(null);

    try {
      const params = new URLSearchParams({
        orderRef: orderRef.trim().toUpperCase(),
      });
      if (phoneLast4.trim()) {
        params.set('phoneLast4', phoneLast4.trim());
      }

      const res = await fetch(`/api/orders/track?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Unable to find your order.');
      }

      setOrder(data.order);
      toast.success('Order found!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to look up your order.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLooking(false);
    }
  };

  const getTimelineIndex = (status: OrderStatus): number => {
    if (status === 'CANCELLED') return -1;
    return STATUS_TIMELINE.findIndex((s) => s.status === status);
  };

  const currentIndex = order ? getTimelineIndex(order.status) : -1;

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
              onChange={(e) => setOrderRef(e.target.value)}
              className="rounded-xl border-border bg-background font-mono"
              disabled={isLooking}
            />
            <p className="text-[11px] text-muted-foreground">
              Found on your order confirmation or WhatsApp message.
            </p>
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
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-3">
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
          {/* Status Timeline */}
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
            <h2 className="font-heading font-bold text-sm text-foreground mb-4">Order Status</h2>

            {order.status === 'CANCELLED' ? (
              <div className={`flex items-center gap-3 p-3 rounded-xl ${CANCELLED_STATUS.bgColor} border ${CANCELLED_STATUS.borderColor}`}>
                <div className={`w-10 h-10 rounded-full ${CANCELLED_STATUS.bgColor} ${CANCELLED_STATUS.color} flex items-center justify-center ring-2 ${CANCELLED_STATUS.ringColor}`}>
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className={`text-sm font-bold ${CANCELLED_STATUS.color}`}>Order Cancelled</p>
                  <p className="text-[11px] text-muted-foreground">This order has been cancelled.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-0">
                {STATUS_TIMELINE.map((step, idx) => {
                  const isPast = currentIndex > idx;
                  const isCurrent = currentIndex === idx;
                  const StepIcon = step.icon;

                  return (
                    <div key={step.status} className="flex gap-3">
                      {/* Icon column */}
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                            isCurrent
                              ? `${step.bgColor} ${step.color} ring-2 ${step.ringColor}`
                              : isPast
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {isPast ? <CheckCircle2 className="w-5 h-5" /> : <StepIcon className="w-5 h-5" />}
                        </div>
                        {idx < STATUS_TIMELINE.length - 1 && (
                          <div className={`w-0.5 h-6 my-0.5 rounded-full ${isPast || isCurrent ? 'bg-emerald-400 dark:bg-emerald-500' : 'bg-muted'}`} />
                        )}
                      </div>

                      {/* Label */}
                      <div className={`pb-4 ${idx === STATUS_TIMELINE.length - 1 ? 'pb-0' : ''}`}>
                        <p className={`text-sm font-semibold ${isCurrent ? step.color : isPast ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'}`}>
                          {step.label}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {isCurrent ? 'Current status' : isPast ? 'Completed' : 'Pending'}
                        </p>
                      </div>
                    </div>
                  );
                })}
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

          {/* Back button */}
          <div className="text-center">
            <Button
              variant="outline"
              onClick={() => { setOrder(null); setOrderRef(''); setPhoneLast4(''); setError(null); }}
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
