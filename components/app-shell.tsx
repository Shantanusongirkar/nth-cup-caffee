'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { StickyCartButton } from '@/components/sticky-cart-button';
import { WhatsAppFab } from '@/components/whatsapp-fab';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Admin and Staff views have their own dedicated full-width dashboard layouts
  const isAdminOrStaff = pathname?.startsWith('/admin') || pathname?.startsWith('/staff');

  if (isAdminOrStaff) {
    return <div className="min-h-screen w-full flex flex-col">{children}</div>;
  }

  return (
    <>
      <Navbar />
      <main className="flex-1 container max-w-5xl mx-auto px-4 py-6">
        {children}
      </main>
      <Footer />
      <StickyCartButton />
      <WhatsAppFab />
    </>
  );
}
