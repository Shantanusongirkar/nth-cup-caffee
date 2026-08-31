'use client';

import * as React from 'react';
import Link from 'next/link';
import { useCartStore } from '@/store/cart-store';
import { useMounted } from '@/hooks/use-mounted';
import { CartItem } from '@/components/cart-item';
import { OrderSummary } from '@/components/order-summary';
import { Button } from '@/components/ui/button';
import { ShoppingBag, ArrowLeft, ArrowRight, Trash2, Coffee } from 'lucide-react';

export default function CartPage() {
  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);
  const mounted = useMounted();

  if (!mounted) {
    return (
      <div className="py-12 text-center text-muted-foreground">Loading cart...</div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-20 px-4 space-y-5 rounded-3xl border border-dashed border-border bg-card/60 my-6">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <ShoppingBag className="w-10 h-10" />
        </div>
        <div className="space-y-2 max-w-sm">
          <h2 className="font-heading font-bold text-2xl text-foreground">Your Cart is Empty</h2>
          <p className="text-sm text-muted-foreground">
            Looks like you haven&apos;t added any coffee or snacks yet. Browse our menu and pick something delicious!
          </p>
        </div>
        <Link href="/">
          <Button className="rounded-full px-6 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md">
            <Coffee className="w-4 h-4" />
            <span>Browse Menu</span>
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-4">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full w-9 h-9">
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </Button>
          </Link>
          <div>
            <h1 className="font-heading font-bold text-2xl text-foreground">Your Order Cart</h1>
            <p className="text-xs text-muted-foreground">Review your items before proceeding to checkout</p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={clearCart}
          className="rounded-full text-xs gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Clear Cart</span>
        </Button>
      </div>

      {/* Grid layout for cart items and order summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Cart Item list */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-4 sm:p-5 divide-y divide-border/40 shadow-sm">
          {items.map((cartItem) => (
            <CartItem key={cartItem.item.id} cartItem={cartItem} />
          ))}
        </div>

        {/* Order summary sidebar */}
        <div className="space-y-4">
          <OrderSummary />

          <div className="space-y-2">
            <Link href="/checkout" className="w-full block">
              <Button className="w-full py-6 rounded-full font-bold text-base gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20">
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>

            <Link href="/" className="w-full block">
              <Button variant="ghost" className="w-full rounded-full text-xs text-muted-foreground hover:text-foreground">
                Continue Shopping
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
