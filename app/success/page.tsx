'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/store/cart-store';
import { CartItem, OrderDetails } from '@/types';
import { Button } from '@/components/ui/button';
import { CheckCircle2, MessageCircle, Copy, Check, Coffee, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

interface SavedOrder {
  orderDetails: OrderDetails;
  items: CartItem[];
  total: number;
  fullMessage: string;
  isTruncated: boolean;
  whatsappUrl: string;
}

export default function SuccessPage() {
  const router = useRouter();
  const clearCart = useCartStore((state) => state.clearCart);

  const [order, setOrder] = React.useState<SavedOrder | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);

    // Retrieve order saved from CheckoutForm submit
    if (typeof window !== 'undefined') {
      const raw = sessionStorage.getItem('latestOrder');
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          setOrder(parsed);
          // Clear cart now that order is finalized
          clearCart();
        } catch {
          // ignore error
        }
      }
    }
  }, [clearCart]);

  if (!mounted) return null;

  const copyOrderText = () => {
    if (!order) return;
    navigator.clipboard.writeText(order.fullMessage);
    setCopied(true);
    toast.success('Order details copied to clipboard!');
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 py-6 pb-16">
      {/* Animated Success Badge */}
      <div className="text-center space-y-3 py-6 px-4 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 animate-fade-in-up">
        <div className="w-16 h-16 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-600/20 animate-bounce-in">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-foreground">
          Order Ready to Send!
        </h1>

        <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
          Your order has been formatted for WhatsApp. If WhatsApp did not open automatically, click the button below.
        </p>
      </div>

      {/* Order Details Card */}
      {order && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <div>
              <h3 className="font-heading font-bold text-base text-foreground">
                Order for {order.orderDetails.customerName}
              </h3>
              {order.orderDetails.tableNumber && (
                <p className="text-xs text-primary font-semibold">
                  Table #{order.orderDetails.tableNumber}
                </p>
              )}
            </div>
            <span className="font-extrabold text-lg text-primary">₹{order.total}</span>
          </div>

          {/* Items Preview */}
          <div className="space-y-2 text-xs">
            <span className="font-semibold text-muted-foreground uppercase tracking-wider block text-[10px]">
              Order Items
            </span>
            <div className="space-y-1 bg-muted/40 p-3 rounded-xl">
              {order.items.map(({ item, quantity }) => (
                <div key={item.id} className="flex justify-between text-foreground">
                  <span>
                    <strong className="text-primary">{quantity}x</strong> {item.name}
                  </span>
                  <span className="font-medium">₹{item.price * quantity}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Notes if any */}
          {order.orderDetails.specialInstructions && (
            <div className="text-xs space-y-1">
              <span className="font-semibold text-muted-foreground uppercase tracking-wider block text-[10px]">
                Special Notes
              </span>
              <p className="p-2.5 rounded-xl bg-amber-500/10 text-amber-900 dark:text-amber-200 border border-amber-500/20 italic">
                "{order.orderDetails.specialInstructions}"
              </p>
            </div>
          )}

          {/* Truncation warning fallback */}
          {order.isTruncated && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <p className="font-semibold">Note regarding long message:</p>
              <p className="text-[11px] opacity-90">
                Your order is large, so WhatsApp opens with a summary. Please click "Copy Order Details" below and paste it into the WhatsApp chat.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 space-y-2">
            <a
              href={order.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full block"
            >
              <Button className="w-full py-6 rounded-full font-bold text-base gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20">
                <MessageCircle className="w-5 h-5 fill-current" />
                <span>Open WhatsApp Now</span>
              </Button>
            </a>

            <Button
              variant="outline"
              onClick={copyOrderText}
              className="w-full rounded-full gap-2 border-border text-foreground hover:bg-muted text-xs font-semibold"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Copied to Clipboard!</span>
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
      )}

      {/* Return to Menu button */}
      <div className="text-center">
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
