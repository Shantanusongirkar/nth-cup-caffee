'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/store/cart-store';
import { buildWhatsAppUrl } from '@/utils/whatsapp';
import { OrderDetails } from '@/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { MessageSquare, Sparkles, Send } from 'lucide-react';
import { toast } from 'sonner';

export function CheckoutForm() {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const getTotal = useCartStore((state) => state.getTotal);
  const clearCart = useCartStore((state) => state.clearCart);

  const [customerName, setCustomerName] = React.useState('');
  const [tableNumber, setTableNumber] = React.useState('');
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [specialInstructions, setSpecialInstructions] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const total = getTotal();
  const isValid = customerName.trim().length > 0 && items.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setIsSubmitting(true);

    const orderDetails: OrderDetails = {
      customerName: customerName.trim(),
      tableNumber: tableNumber.trim() || undefined,
      phoneNumber: phoneNumber.trim() || undefined,
      specialInstructions: specialInstructions.trim() || undefined,
    };

    const { url, message, isTruncated } = buildWhatsAppUrl(items, orderDetails, total);

    // Save order data to sessionStorage for the success page
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(
        'latestOrder',
        JSON.stringify({
          orderDetails,
          items,
          total,
          fullMessage: message,
          isTruncated,
          whatsappUrl: url,
        })
      );
    }

    toast.success('Order generated! Opening WhatsApp...', { duration: 2500 });

    // Open WhatsApp in new tab or direct location
    setTimeout(() => {
      window.open(url, '_blank');
      // Redirect local page to success screen
      router.push('/success');
    }, 500);
  };

  const presetNotes = ['Extra Sugar', 'No Ice', 'Less Milk', 'Extra Hot', 'Strong Coffee'];

  const addPresetNote = (note: string) => {
    setSpecialInstructions((prev) => {
      if (!prev) return note;
      if (prev.includes(note)) return prev;
      return `${prev}, ${note}`;
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
        <h3 className="font-heading font-bold text-base text-foreground border-b border-border/40 pb-2 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span>Customer & Table Details</span>
        </h3>

        {/* Customer Name */}
        <div className="space-y-1.5">
          <Label htmlFor="customerName" className="text-xs font-semibold text-foreground">
            Customer Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="customerName"
            type="text"
            required
            placeholder="e.g. John Doe"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="rounded-xl border-border bg-background"
          />
        </div>

        {/* Table Number & Phone Number grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="tableNumber" className="text-xs font-semibold text-foreground">
              Table Number <span className="text-muted-foreground font-normal">(Optional)</span>
            </Label>
            <Input
              id="tableNumber"
              type="text"
              placeholder="e.g. Table 5"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              className="rounded-xl border-border bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phoneNumber" className="text-xs font-semibold text-foreground">
              Your Phone <span className="text-muted-foreground font-normal">(Optional)</span>
            </Label>
            <Input
              id="phoneNumber"
              type="tel"
              placeholder="e.g. +91 98765 43210"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="rounded-xl border-border bg-background"
            />
          </div>
        </div>

        {/* Special Instructions */}
        <div className="space-y-1.5">
          <Label htmlFor="specialInstructions" className="text-xs font-semibold text-foreground">
            Special Instructions <span className="text-muted-foreground font-normal">(Optional)</span>
          </Label>
          <Textarea
            id="specialInstructions"
            rows={3}
            placeholder="Add any customization notes here..."
            value={specialInstructions}
            onChange={(e) => setSpecialInstructions(e.target.value)}
            className="rounded-xl border-border bg-background resize-none text-xs"
          />

          {/* Quick presets */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="text-[11px] text-muted-foreground self-center mr-1">Quick add:</span>
            {presetNotes.map((note) => (
              <button
                key={note}
                type="button"
                onClick={() => addPresetNote(note)}
                className="text-[11px] bg-muted hover:bg-primary/10 hover:text-primary text-muted-foreground px-2.5 py-0.5 rounded-full border border-border/50 transition-colors"
              >
                + {note}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Place Order Button */}
      <Button
        type="submit"
        disabled={!isValid || isSubmitting}
        className="w-full py-6 rounded-full text-base font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition-all active:scale-[0.99] disabled:opacity-50"
      >
        <Send className="w-5 h-5" />
        <span>{isSubmitting ? 'Opening WhatsApp...' : 'Place Order via WhatsApp'}</span>
      </Button>
    </form>
  );
}
