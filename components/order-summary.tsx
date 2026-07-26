'use client';

import * as React from 'react';
import { useCartStore } from '@/store/cart-store';
import { Separator } from '@/components/ui/separator';
import { Receipt, Info } from 'lucide-react';

export function OrderSummary() {
  const items = useCartStore((state) => state.items);
  const getSubtotal = useCartStore((state) => state.getSubtotal);
  const getTax = useCartStore((state) => state.getTax);
  const getTotal = useCartStore((state) => state.getTotal);

  const subtotal = getSubtotal();
  const tax = getTax();
  const total = getTotal();

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
      <div className="flex items-center gap-2 font-heading font-bold text-base text-foreground pb-2 border-b border-border/40">
        <Receipt className="w-4 h-4 text-primary" />
        <span>Order Summary</span>
      </div>

      {/* Item List Brief */}
      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
        {items.map(({ item, quantity }) => (
          <div key={item.id} className="flex justify-between text-xs text-muted-foreground">
            <span className="truncate pr-2">
              <strong className="text-foreground font-semibold">{quantity}x</strong> {item.name}
            </span>
            <span className="font-medium text-foreground shrink-0">₹{item.price * quantity}</span>
          </div>
        ))}
      </div>

      <Separator />

      {/* Breakdown */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span className="font-semibold text-foreground">₹{subtotal}</span>
        </div>

        <div className="flex justify-between text-muted-foreground items-center">
          <span className="flex items-center gap-1">
            Tax (5%)
            <span className="text-[10px] text-muted-foreground/80 bg-muted px-1.5 py-0.5 rounded flex items-center gap-0.5" title="Flat 5% rate placeholder">
              <Info className="w-2.5 h-2.5" /> placeholder
            </span>
          </span>
          <span className="font-semibold text-foreground">₹{tax}</span>
        </div>
      </div>

      <Separator />

      {/* Total */}
      <div className="flex justify-between items-center text-base pt-1">
        <span className="font-bold text-foreground font-heading">Total Amount</span>
        <span className="font-extrabold text-lg text-primary">₹{total}</span>
      </div>
    </div>
  );
}
