'use client';

import * as React from 'react';
import { MessageCircle } from 'lucide-react';

export function WhatsAppFab() {
  const rawPhone = process.env.NEXT_PUBLIC_CAFE_WHATSAPP_NUMBER || '919876543210';
  const phone = rawPhone.replace(/\D/g, '');

  if (!phone) return null;

  const handleFabClick = () => {
    const defaultMsg = encodeURIComponent('Hello Nth Cup Caffee! I have a question about your menu.');
    window.open(`https://wa.me/${phone}?text=${defaultMsg}`, '_blank');
  };

  return (
    <button
      onClick={handleFabClick}
      title="Contact Cafe on WhatsApp"
      className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-30 w-12 h-12 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 hover:scale-110 active:scale-95 transition-all duration-300 group"
    >
      <MessageCircle className="w-6 h-6 fill-current transition-transform group-hover:rotate-12" />
      <span className="sr-only">Chat on WhatsApp</span>
    </button>
  );
}
