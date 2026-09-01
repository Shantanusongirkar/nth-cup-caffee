'use client';

import * as React from 'react';
import Link from 'next/link';
import { ServerOrder } from '@/types';
import { useMounted } from '@/hooks/use-mounted';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  MessageCircle,
  Copy,
  Check,
  Coffee,
  Receipt,
  User,
  MapPin,
  FileText,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatPaiseToRupees } from '@/utils/whatsapp';

interface StoredOrderSession {
  serverOrder: ServerOrder;
  fullMessage: string;
  isTruncated: boolean;
  whatsappUrl: string;
}

function getStoredOrderSession(): StoredOrderSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem('latestOrder');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function SuccessPage() {
  const [copied, setCopied] = React.useState(false);
  const mounted = useMounted();

  const sessionData = React.useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener('storage', onStoreChange);
      return () => window.removeEventListener('storage', onStoreChange);
    },
    getStoredOrderSession,
    () => null
  );

  if (!mounted) return null;

  const order = sessionData?.serverOrder;

  const copyOrderText = () => {
    if (!sessionData?.fullMessage) return;
    navigator.clipboard.writeText(sessionData.fullMessage);
    setCopied(true);
    toast.success('Order details copied to clipboard!');
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-6 pb-16">
      {/* Animated Success Badge */}
      <div className="text-center space-y-3 py-7 px-4 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 animate-fade-in-up">
        <div className="w-16 h-16 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-600/20 animate-bounce-in">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div className="space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-3 py-1 rounded-full inline-block">
            Order Saved in Database
          </span>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-foreground">
            Order Placed Successfully!
          </h1>
        </div>

        <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          Your order has been recorded in our system and prepared for WhatsApp notification.
        </p>
      </div>

      {/* If Order Exists */}
      {order ? (
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-5 shadow-sm">
          {/* Order Header Summary */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm bg-primary/10 text-primary px-2.5 py-0.5 rounded-md">
                  #{order.orderReference || order.id.slice(0, 8).toUpperCase()}
                </span>
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <h3 className="font-heading font-bold text-lg text-foreground mt-1.5">
                Order for {order.customer.name}
              </h3>
            </div>

            <div className="sm:text-right">
              <span className="text-xs text-muted-foreground block">Verified Total</span>
              <span className="font-extrabold text-2xl text-primary">
                {formatPaiseToRupees(order.totalInPaise)}
              </span>
            </div>
          </div>

          {/* Customer & Table Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-muted/30 p-3.5 rounded-xl border border-border/40">
            <div className="space-y-1">
              <span className="text-muted-foreground flex items-center gap-1 font-semibold">
                <User className="w-3.5 h-3.5 text-primary" /> Customer Info
              </span>
              <p className="text-foreground font-medium">{order.customer.name}</p>
              {order.customer.phone && (
                <p className="text-muted-foreground">{order.customer.phone}</p>
              )}
              {order.customer.email && (
                <p className="text-muted-foreground">{order.customer.email}</p>
              )}
            </div>

            <div className="space-y-1">
              <span className="text-muted-foreground flex items-center gap-1 font-semibold">
                <MapPin className="w-3.5 h-3.5 text-primary" /> Dining Location
              </span>
              <p className="text-foreground font-medium">
                {order.tableNumber ? `Table: ${order.tableNumber}` : 'Takeaway / Counter'}
              </p>
              <p className="text-emerald-600 dark:text-emerald-400 font-semibold">
                Status: {order.status}
              </p>
            </div>
          </div>

          {/* Item Breakdown */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Receipt className="w-3.5 h-3.5 text-primary" />
              <span>Item Breakdown</span>
            </div>

            <div className="space-y-2 divide-y divide-border/40 border border-border/40 rounded-xl p-3 bg-background">
              {order.items.map((item, idx) => {
                const lineTotalPaise = item.unitPriceInPaise * item.quantity;
                return (
                  <div
                    key={item.id || idx}
                    className={`flex items-center justify-between text-xs text-foreground ${idx > 0 ? 'pt-2' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[11px]">
                        {item.quantity}×
                      </span>
                      <span className="font-medium">{item.productName}</span>
                      <span className="text-muted-foreground text-[11px]">
                        ({formatPaiseToRupees(item.unitPriceInPaise)} each)
                      </span>
                    </div>
                    <span className="font-semibold">{formatPaiseToRupees(lineTotalPaise)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pricing Totals */}
          <div className="space-y-1.5 text-xs border-t border-border/40 pt-3">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="font-semibold text-foreground">
                {formatPaiseToRupees(order.subtotalInPaise)}
              </span>
            </div>

            <div className="flex justify-between text-muted-foreground">
              <span>GST / Taxes (5%)</span>
              <span className="font-semibold text-foreground">
                {formatPaiseToRupees(order.taxInPaise)}
              </span>
            </div>

            <div className="flex justify-between items-center text-sm font-bold text-foreground pt-2 border-t border-border/30">
              <span className="font-heading">Total Amount (Paid at counter)</span>
              <span className="font-extrabold text-lg text-primary">
                {formatPaiseToRupees(order.totalInPaise)}
              </span>
            </div>
          </div>

          {/* Special notes */}
          {order.notes && (
            <div className="text-xs space-y-1">
              <span className="font-semibold text-muted-foreground flex items-center gap-1 uppercase tracking-wider text-[10px]">
                <FileText className="w-3 h-3 text-amber-500" />
                <span>Special Instructions</span>
              </span>
              <p className="p-3 rounded-xl bg-amber-500/10 text-amber-900 dark:text-amber-200 border border-amber-500/20 italic">
                &ldquo;{order.notes}&rdquo;
              </p>
            </div>
          )}

          {/* Truncation notice */}
          {sessionData?.isTruncated && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <p className="font-semibold">Long Order Summary:</p>
              <p className="text-[11px] opacity-90">
                Your order is large, so WhatsApp opened with a quick summary. Please click &ldquo;Copy Order Details&rdquo; below to send the full item list to the barista.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 space-y-2.5">
            {sessionData?.whatsappUrl && (
              <a
                href={sessionData.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full block"
              >
                <Button className="w-full py-6 rounded-full font-bold text-base gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 active:scale-[0.99] transition-all">
                  <MessageCircle className="w-5 h-5 fill-current" />
                  <span>Open WhatsApp to Send Order</span>
                </Button>
              </a>
            )}

            <Button
              variant="outline"
              onClick={copyOrderText}
              className="w-full py-5 rounded-full gap-2 border-border text-foreground hover:bg-muted text-xs font-semibold"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Copied Order Receipt to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Order Details (Fallback)</span>
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        /* Fallback if visited directly without session */
        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Coffee className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-heading font-bold text-lg text-foreground">
              No Active Order Found
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              If you placed an order earlier, our baristas have received it. Would you like to explore our menu?
            </p>
          </div>
          <Link href="/" className="inline-block pt-2">
            <Button className="rounded-full px-6 gap-2">
              <Coffee className="w-4 h-4" />
              <span>Back to Menu</span>
            </Button>
          </Link>
        </div>
      )}

      {/* Return to Menu button */}
      <div className="text-center pt-2">
        <Link href="/">
          <Button variant="ghost" className="rounded-full gap-2 text-muted-foreground hover:text-foreground">
            <Coffee className="w-4 h-4" />
            <span>Place Another Order</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}
