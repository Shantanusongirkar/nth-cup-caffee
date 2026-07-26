'use client';

import * as React from 'react';
import Image from 'next/image';
import { CartItem as CartItemType } from '@/types';
import { useCartStore } from '@/store/cart-store';
import { QuantitySelector } from '@/components/quantity-selector';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CartItemProps {
  cartItem: CartItemType;
  compact?: boolean;
}

export function CartItem({ cartItem, compact = false }: CartItemProps) {
  const increaseQuantity = useCartStore((state) => state.increaseQuantity);
  const decreaseQuantity = useCartStore((state) => state.decreaseQuantity);
  const removeItem = useCartStore((state) => state.removeItem);

  const { item, quantity } = cartItem;
  const lineTotal = item.price * quantity;

  return (
    <div className="flex items-center gap-3 py-3 border-b border-border/40 last:border-0">
      {/* Thumbnail */}
      <div className="relative h-14 w-14 shrink-0 rounded-xl overflow-hidden bg-muted">
        <Image
          src={item.image}
          alt={item.name}
          fill
          sizes="56px"
          className="object-cover"
          unoptimized={item.image.endsWith('.svg')}
        />
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-sm text-foreground truncate">{item.name}</h4>
        <p className="text-xs text-muted-foreground">₹{item.price} each</p>
      </div>

      {/* Controls & Total */}
      <div className="flex items-center gap-3">
        <QuantitySelector
          quantity={quantity}
          onIncrease={() => increaseQuantity(item.id)}
          onDecrease={() => decreaseQuantity(item.id)}
          size="sm"
        />

        <div className="text-right min-w-[50px]">
          <span className="font-bold text-sm text-foreground block">₹{lineTotal}</span>
        </div>

        {!compact && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => removeItem(item.id)}
            className="w-7 h-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
            title="Remove item"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
