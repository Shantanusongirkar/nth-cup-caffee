'use client';

import * as React from 'react';
import Image from 'next/image';
import { MenuItem } from '@/types';
import { useCartStore } from '@/store/cart-store';
import { Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QuantitySelector } from '@/components/quantity-selector';
import { toast } from 'sonner';

interface MenuCardProps {
  item: MenuItem;
}

export function MenuCard({ item }: MenuCardProps) {
  const items = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const increaseQuantity = useCartStore((state) => state.increaseQuantity);
  const decreaseQuantity = useCartStore((state) => state.decreaseQuantity);

  const cartItem = items.find((ci) => ci.item.id === item.id);
  const inCart = !!cartItem;
  const quantity = cartItem?.quantity || 0;

  const handleAdd = () => {
    if (!item.available) return;
    addItem(item);
    toast.success(`Added ${item.name} to cart`, {
      duration: 2000,
      position: 'bottom-center',
    });
  };

  return (
    <div
      className={`group relative flex flex-col justify-between rounded-2xl border border-border/60 bg-card p-3.5 shadow-sm transition-all duration-300 hover:shadow-md hover:border-primary/30 ${
        !item.available ? 'opacity-70 grayscale-[30%]' : ''
      }`}
    >
      <div>
        {/* Image Container */}
        <div className="relative aspect-4/3 w-full overflow-hidden rounded-xl bg-muted/50 mb-3">
          <Image
            src={item.image}
            alt={item.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            unoptimized={item.image.endsWith('.svg')}
          />

          {!item.available && (
            <div className="absolute inset-0 bg-background/70 backdrop-blur-[2px] flex items-center justify-center">
              <Badge variant="destructive" className="font-semibold text-xs px-3 py-1 shadow-sm">
                Sold Out
              </Badge>
            </div>
          )}

          <div className="absolute top-2 right-2">
            <span className="bg-background/90 backdrop-blur-md text-foreground font-bold text-xs px-2.5 py-1 rounded-full shadow-sm border border-border/40">
              ₹{item.price}
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-heading font-bold text-base text-foreground line-clamp-1 group-hover:text-primary transition-colors">
              {item.name}
            </h3>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-4 pt-2 flex items-center justify-between border-t border-border/40">
        <span className="font-bold text-base text-foreground">
          ₹{item.price}
        </span>

        {!item.available ? (
          <Button disabled size="sm" variant="secondary" className="rounded-full text-xs opacity-60">
            Unavailable
          </Button>
        ) : inCart ? (
          <QuantitySelector
            quantity={quantity}
            onIncrease={() => increaseQuantity(item.id)}
            onDecrease={() => decreaseQuantity(item.id)}
            size="sm"
          />
        ) : (
          <Button
            size="sm"
            onClick={handleAdd}
            className="rounded-full gap-1 px-3.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add</span>
          </Button>
        )}
      </div>
    </div>
  );
}
