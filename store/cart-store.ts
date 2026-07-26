'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CartItem, CartStore, MenuItem } from '@/types';

const TAX_RATE = 0.05; // 5% flat tax — placeholder to be replaced later

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item: MenuItem) => {
        set((state) => {
          const existing = state.items.find((ci) => ci.item.id === item.id);
          if (existing) {
            return {
              items: state.items.map((ci) =>
                ci.item.id === item.id
                  ? { ...ci, quantity: ci.quantity + 1 }
                  : ci
              ),
            };
          }
          return { items: [...state.items, { item, quantity: 1 }] };
        });
      },

      removeItem: (itemId: string) => {
        set((state) => ({
          items: state.items.filter((ci) => ci.item.id !== itemId),
        }));
      },

      increaseQuantity: (itemId: string) => {
        set((state) => ({
          items: state.items.map((ci) =>
            ci.item.id === itemId
              ? { ...ci, quantity: ci.quantity + 1 }
              : ci
          ),
        }));
      },

      decreaseQuantity: (itemId: string) => {
        set((state) => {
          const existing = state.items.find((ci) => ci.item.id === itemId);
          if (existing && existing.quantity <= 1) {
            return { items: state.items.filter((ci) => ci.item.id !== itemId) };
          }
          return {
            items: state.items.map((ci) =>
              ci.item.id === itemId
                ? { ...ci, quantity: ci.quantity - 1 }
                : ci
            ),
          };
        });
      },

      clearCart: () => {
        set({ items: [] });
      },

      getSubtotal: () => {
        return get().items.reduce(
          (sum, ci) => sum + ci.item.price * ci.quantity,
          0
        );
      },

      getTax: () => {
        return Math.round(get().getSubtotal() * TAX_RATE);
      },

      getTotal: () => {
        return get().getSubtotal() + get().getTax();
      },

      getItemCount: () => {
        return get().items.reduce((sum, ci) => sum + ci.quantity, 0);
      },
    }),
    {
      name: 'nth-cup-cart',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
