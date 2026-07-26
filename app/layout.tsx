import type { Metadata } from 'next';
import { Inter, Outfit } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { StickyCartButton } from '@/components/sticky-cart-button';
import { WhatsAppFab } from '@/components/whatsapp-fab';
import { Toaster } from '@/components/ui/sonner';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Nth Cup Caffee — Order Coffee & Bites Online',
  description: 'Scan QR code, browse artisanal coffee & snacks menu, place instant table orders via WhatsApp.',
  keywords: ['coffee', 'cafe', 'order online', 'table ordering', 'whatsapp order', 'caffee', 'nth cup'],
  openGraph: {
    title: 'Nth Cup Caffee — Order Coffee Online',
    description: 'Scan QR code, browse menu, place instant table orders via WhatsApp.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${outfit.variable}`}>
      <body className="min-h-screen flex flex-col bg-background text-foreground antialiased font-sans transition-colors duration-300">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <Navbar />
          <main className="flex-1 container max-w-5xl mx-auto px-4 py-6">
            {children}
          </main>
          <Footer />
          <StickyCartButton />
          <WhatsAppFab />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
