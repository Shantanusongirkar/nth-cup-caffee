'use client';

import * as React from 'react';
import { MenuItem } from '@/types';
import { MenuCard } from '@/components/menu-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Coffee, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MenuGridProps {
  items: MenuItem[];
  isLoading: boolean;
  onClearFilters?: () => void;
}

export function MenuGrid({ items, isLoading, onClearFilters }: MenuGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 w-full">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border/60 p-3.5 space-y-3 bg-card">
            <Skeleton className="aspect-4/3 w-full rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-2/3 rounded" />
              <Skeleton className="h-3.5 w-full rounded" />
              <Skeleton className="h-3.5 w-4/5 rounded" />
            </div>
            <div className="flex justify-between items-center pt-2">
              <Skeleton className="h-6 w-16 rounded" />
              <Skeleton className="h-8 w-20 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-16 px-4 space-y-4 rounded-3xl border border-dashed border-border bg-card/50 my-6">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <SearchX className="w-8 h-8" />
        </div>
        <div className="space-y-1.5 max-w-sm">
          <h3 className="font-heading font-bold text-lg text-foreground">No menu items found</h3>
          <p className="text-xs text-muted-foreground">
            We couldn't find anything matching your search or category filter. Try clearing filters.
          </p>
        </div>
        {onClearFilters && (
          <Button onClick={onClearFilters} variant="outline" size="sm" className="rounded-full gap-2">
            <Coffee className="w-4 h-4 text-primary" />
            <span>Show All Items</span>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 w-full">
      {items.map((item) => (
        <MenuCard key={item.id} item={item} />
      ))}
    </div>
  );
}
