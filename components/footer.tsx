import React from 'react';
import Link from 'next/link';
import { Coffee, MapPin, Clock, Heart, Shield } from 'lucide-react';

export function Footer() {
  return (
    <footer className="w-full border-t border-border/40 bg-card mt-auto py-8 transition-colors">
      <div className="container max-w-5xl mx-auto px-4 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Coffee className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-base text-foreground">Nth Cup Caffee</h3>
              <p className="text-xs text-muted-foreground">Scan. Select. Savor.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-primary" /> Table Ordering System
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-primary" /> Open 8 AM – 10 PM
            </span>
            <Link
              href="/admin/orders"
              className="flex items-center gap-1 hover:text-primary transition-colors font-medium"
            >
              <Shield className="w-3.5 h-3.5 text-primary" /> Staff Portal
            </Link>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Nth Cup Caffee. All rights reserved.</p>
          <p className="flex items-center gap-1">
            Crafted with <Heart className="w-3 h-3 text-red-500 fill-red-500" /> for coffee lovers
          </p>
        </div>
      </div>
    </footer>
  );
}
