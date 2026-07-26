'use client';

import * as React from 'react';
import Link from 'next/link';
import { Coffee, ShoppingBag } from 'lucide-react';
import { useCartStore } from '@/store/cart-store';
import { ThemeToggle } from '@/components/theme-toggle';
import { CartDrawer } from '@/components/cart-drawer';
import { Button } from '@/components/ui/button';

export function Navbar() {
  const getItemCount = useCartStore((state) => state.getItemCount);
  const [mounted, setMounted] = React.useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const itemCount = mounted ? getItemCount() : 0;

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border/40 glass bg-background/85 backdrop-blur-md transition-all">
        <div className="container max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2.5 group transition-transform active:scale-95"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 shadow-sm">
              <Coffee className="w-5 h-5 transition-transform group-hover:rotate-12" />
            </div>
            <div>
              <span className="font-heading font-bold text-lg leading-tight block text-foreground tracking-tight">
                Nth Cup <span className="text-primary font-normal">Caffee</span>
              </span>
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider block">
                Artisanal Brews
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle />

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDrawerOpen(true)}
              className="relative rounded-full px-3.5 gap-2 border-primary/20 hover:bg-primary/10 hover:border-primary/40 text-foreground"
            >
              <ShoppingBag className="w-4 h-4 text-primary" />
              <span className="font-medium text-xs hidden sm:inline">Cart</span>
              {itemCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center animate-scale-in">
                  {itemCount}
                </span>
              )}
            </Button>
          </div>
        </div>
      </header>

      <CartDrawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen} />
    </>
  );
}
