'use client';

import * as React from 'react';
import { MenuCategory } from '@/types';
import { Coffee, CupSoda, Cookie, CakeSlice, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CategoryTabsProps {
  selectedCategory: MenuCategory | 'all';
  onSelectCategory: (category: MenuCategory | 'all') => void;
}

const categories: { id: MenuCategory | 'all'; label: string; icon: React.ElementType }[] = [
  { id: 'all', label: 'All Items', icon: Sparkles },
  { id: 'coffee', label: 'Coffee', icon: Coffee },
  { id: 'tea', label: 'Tea', icon: CupSoda },
  { id: 'snacks', label: 'Snacks', icon: Cookie },
  { id: 'desserts', label: 'Desserts', icon: CakeSlice },
];

export function CategoryTabs({ selectedCategory, onSelectCategory }: CategoryTabsProps) {
  return (
    <div className="w-full overflow-x-auto scrollbar-none py-2 px-1">
      <div className="flex items-center gap-2 min-w-max">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = selectedCategory === cat.id;

          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer select-none',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-105'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95'
              )}
            >
              <Icon className={cn('w-4 h-4', isActive ? 'text-primary-foreground' : 'text-muted-foreground')} />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
