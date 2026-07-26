'use client';

import { useState, useEffect } from 'react';
import { MenuItem } from '@/types';
import { getMenuItems } from '@/data/menu';

interface UseMenuReturn {
  items: MenuItem[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Client-side hook that fetches menu items via the getMenuItems() seam.
 * Components should use this hook, never import menu data directly.
 */
export function useMenu(): UseMenuReturn {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchMenu() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getMenuItems();
        if (!cancelled) {
          setItems(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load menu');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchMenu();

    return () => {
      cancelled = true;
    };
  }, []);

  return { items, isLoading, error };
}
