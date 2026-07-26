'use client';

import * as React from 'react';
import { Plus, Minus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuantitySelectorProps {
  quantity: number;
  onIncrease: () => void;
  onDecrease: () => void;
  min?: number;
  size?: 'sm' | 'md';
}

export function QuantitySelector({
  quantity,
  onIncrease,
  onDecrease,
  min = 1,
  size = 'md',
}: QuantitySelectorProps) {
  const isSm = size === 'sm';

  return (
    <div className="flex items-center gap-1.5 bg-muted/80 p-1 rounded-full border border-border/50">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onDecrease}
        className={`${
          isSm ? 'w-6 h-6' : 'w-7 h-7'
        } rounded-full hover:bg-background text-foreground hover:text-primary transition-colors`}
      >
        {quantity <= min ? (
          <Trash2 className={`${isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-destructive`} />
        ) : (
          <Minus className={`${isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} />
        )}
      </Button>

      <span className={`${isSm ? 'w-5 text-xs' : 'w-6 text-sm'} font-semibold text-center text-foreground`}>
        {quantity}
      </span>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onIncrease}
        className={`${
          isSm ? 'w-6 h-6' : 'w-7 h-7'
        } rounded-full hover:bg-background text-foreground hover:text-primary transition-colors`}
      >
        <Plus className={`${isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} />
      </Button>
    </div>
  );
}
