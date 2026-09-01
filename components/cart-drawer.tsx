'use client';

import * as React from 'react';
import Link from 'next/link';
import { useCartStore } from '@/store/cart-store';
import { CartItem } from '@/components/cart-item';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ShoppingBag, ArrowRight, ShoppingCart } from 'lucide-react';

interface CartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CartDrawer({ open, onOpenChange }: CartDrawerProps) {
  const items = useCartStore((state) => state.items);
  const getSubtotal = useCartStore((state) => state.getSubtotal);
  const getItemCount = useCartStore((state) => state.getItemCount);

  const itemCount = getItemCount();
  const subtotal = getSubtotal();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col justify-between p-0 bg-card border-l border-border">
        {/* Header */}
        <SheetHeader className="p-4 border-b border-border/40 flex flex-row items-center justify-between space-y-0">
          <SheetTitle className="font-heading font-bold text-lg flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-primary" />
            <span>Your Cart</span>
            {itemCount > 0 && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
                {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {/* Content Body */}
        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <ShoppingCart className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-base text-foreground">Your cart is empty</h4>
              <p className="text-xs text-muted-foreground max-w-xs">
                Looks like you haven&apos;t added any coffee or treats yet.
              </p>
            </div>
            <Button
              onClick={() => onOpenChange(false)}
              className="rounded-full px-6 bg-primary hover:bg-primary/90"
            >
              Browse Menu
            </Button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 divide-y divide-border/40">
            {items.map((cartItem) => (
              <CartItem key={cartItem.item.id} cartItem={cartItem} compact />
            ))}
          </div>
        )}

        {/* Footer */}
        {items.length > 0 && (
          <SheetFooter className="p-4 border-t border-border/40 bg-muted/30 flex flex-col gap-3 sm:flex-col">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground font-medium">Subtotal</span>
              <span className="font-bold text-base text-foreground">₹{subtotal}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Link href="/cart" onClick={() => onOpenChange(false)}>
                <Button variant="outline" className="w-full rounded-full text-xs font-semibold border-border">
                  View Full Cart
                </Button>
              </Link>
              <Link href="/checkout" onClick={() => onOpenChange(false)}>
                <Button className="w-full rounded-full text-xs font-semibold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
                  <span>Checkout</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
