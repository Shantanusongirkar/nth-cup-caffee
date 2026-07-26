'use client';

import * as React from 'react';
import { useMenu } from '@/hooks/use-menu';
import { MenuCategory } from '@/types';
import { SearchBar } from '@/components/search-bar';
import { CategoryTabs } from '@/components/category-tabs';
import { MenuGrid } from '@/components/menu-grid';
import { Coffee, Sparkles } from 'lucide-react';

export default function HomePage() {
  const { items, isLoading } = useMenu();
  const [selectedCategory, setSelectedCategory] = React.useState<MenuCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = React.useState('');

  // Filter menu items by search query and category
  const filteredItems = React.useMemo(() => {
    return items.filter((item) => {
      const matchesCategory =
        selectedCategory === 'all' || item.category === selectedCategory;

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q);

      return matchesCategory && matchesSearch;
    });
  }, [items, selectedCategory, searchQuery]);

  const clearFilters = () => {
    setSelectedCategory('all');
    setSearchQuery('');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Hero Banner */}
      <section className="text-center space-y-3 py-6 px-4 rounded-3xl bg-gradient-to-b from-primary/10 via-primary/5 to-transparent border border-primary/10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Table Digital Menu</span>
        </div>

        <h1 className="font-heading font-extrabold text-3xl sm:text-4xl text-foreground tracking-tight">
          Welcome to <span className="text-primary">Nth Cup Caffee</span>
        </h1>

        <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          Artisanal coffee, comforting teas, & freshly baked delights. Select your items and send your order straight to our baristas via WhatsApp.
        </p>

        {/* Search Bar */}
        <div className="pt-2">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>
      </section>

      {/* Category Tabs */}
      <section className="space-y-4">
        <CategoryTabs
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />
      </section>

      {/* Menu Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-bold text-xl text-foreground capitalize flex items-center gap-2">
            <Coffee className="w-5 h-5 text-primary" />
            <span>
              {selectedCategory === 'all' ? 'All Menu Items' : selectedCategory}
            </span>
          </h2>
          {!isLoading && (
            <span className="text-xs text-muted-foreground font-medium">
              {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
            </span>
          )}
        </div>

        <MenuGrid
          items={filteredItems}
          isLoading={isLoading}
          onClearFilters={clearFilters}
        />
      </section>
    </div>
  );
}
