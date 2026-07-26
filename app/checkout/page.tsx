'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/store/cart-store';
import { CheckoutForm } from '@/components/checkout-form';
import { OrderSummary } from '@/components/order-summary';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ShoppingBag } from 'lucide-react';

export default function CheckoutPage() {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="py-12 text-center text-muted-foreground">Loading checkout...</div>;
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-20 px-4 space-y-4 rounded-3xl border border-dashed border-border bg-card/60 my-6">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h2 className="font-heading font-bold text-xl text-foreground">Your cart is empty</h2>
          <p className="text-xs text-muted-foreground">Please add items to your cart before checking out.</p>
        </div>
        <Link href="/">
          <Button className="rounded-full px-6">Return to Menu</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/40 pb-4">
        <Link href="/cart">
          <Button variant="ghost" size="icon" className="rounded-full w-9 h-9">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </Button>
        </Link>
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground">Checkout</h1>
          <p className="text-xs text-muted-foreground">Enter your table details to place order on WhatsApp</p>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Form area */}
        <div className="lg:col-span-2">
          <CheckoutForm />
        </div>

        {/* Order Summary sidebar */}
        <div className="space-y-4">
          <OrderSummary />
        </div>
      </div>
    </div>
  );
}
