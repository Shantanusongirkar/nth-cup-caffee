'use client';

import * as React from 'react';
import Link from 'next/link';
import { useCartStore } from '@/store/cart-store';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function StickyCartButton() {
  const items = useCartStore((state) => state.items);
  const getTotal = useCartStore((state) => state.getTotal);
  const getItemCount = useCartStore((state) => state.getItemCount);

  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const itemCount = getItemCount();
  const total = getTotal();

  if (itemCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-30 sm:hidden animate-fade-in-up">
      <Link href="/cart">
        <Button className="w-full h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 flex items-center justify-between px-5 font-bold text-sm border border-primary-foreground/10 active:scale-95 transition-all">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center text-primary-foreground">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <span>
              {itemCount} {itemCount === 1 ? 'Item' : 'Items'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span>₹{total}</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Button>
      </Link>
    </div>
  );
}
