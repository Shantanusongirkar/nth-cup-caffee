'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/store/cart-store';
import { buildWhatsAppUrlFromOrder } from '@/utils/whatsapp';
import { ServerOrder } from '@/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Sparkles, Send, Loader2, Mail, Phone, MapPin, User, FileText } from 'lucide-react';
import { toast } from 'sonner';

export function CheckoutForm() {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);

  const [customerName, setCustomerName] = React.useState('');
  const [tableNumber, setTableNumber] = React.useState('');
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [specialInstructions, setSpecialInstructions] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const isValid = customerName.trim().length > 0 && items.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);

    const payload = {
      cafeSlug: 'nth-cup-demo',
      customer: {
        name: customerName.trim(),
        phone: phoneNumber.trim() || undefined,
        email: email.trim() || undefined,
      },
      items: items.map((cartItem) => ({
        productSku: cartItem.item.id,
        quantity: cartItem.quantity,
      })),
      tableNumber: tableNumber.trim() || undefined,
      notes: specialInstructions.trim() || undefined,
    };

    try {
      // Create the order on the server. Server computes verified prices and saves to Neon.
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMsg =
          result.details && Array.isArray(result.details)
            ? result.details.join(', ')
            : result.message || 'Failed to place order. Please try again.';
        throw new Error(errorMsg);
      }

      const serverOrder: ServerOrder = result.order;

      // Generate WhatsApp message directly from the server-created order
      const { url, message, isTruncated } = buildWhatsAppUrlFromOrder(serverOrder);

      // Save verified server order to session storage for the confirmation page
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(
          'latestOrder',
          JSON.stringify({
            serverOrder,
            fullMessage: message,
            isTruncated,
            whatsappUrl: url,
          })
        );
      }

      // Clear the client cart now that database order is created
      clearCart();

      toast.success('Order placed successfully! Connecting to WhatsApp...', {
        duration: 2500,
      });

      // Attempt to open WhatsApp directly
      try {
        window.open(url, '_blank');
      } catch {
        // Ignored if blocked by browser popup blocker
      }

      router.push('/success');
    } catch (error) {
      console.error('Order creation failed:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Unable to place your order. Please try again.'
      );
      setIsSubmitting(false);
    }
  };

  const presetNotes = [
    'Extra Sugar',
    'No Ice',
    'Less Milk',
    'Extra Hot',
    'Strong Coffee',
    'Oat Milk',
  ];

  const addPresetNote = (note: string) => {
    setSpecialInstructions((prev) => {
      if (!prev) return note;
      if (prev.includes(note)) return prev;
      return `${prev}, ${note}`;
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4 shadow-sm">
        <h3 className="font-heading font-bold text-base text-foreground border-b border-border/40 pb-2.5 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span>Customer & Table Details</span>
        </h3>

        {/* Customer Name */}
        <div className="space-y-1.5">
          <Label htmlFor="customerName" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-primary" />
            <span>Customer Name</span> <span className="text-destructive">*</span>
          </Label>
          <Input
            id="customerName"
            type="text"
            required
            disabled={isSubmitting}
            placeholder="e.g. John Doe"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="rounded-xl border-border bg-background"
          />
        </div>

        {/* Table Number & Phone Number grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="tableNumber" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              <span>Table Number</span> <span className="text-muted-foreground font-normal text-[11px]">(Optional)</span>
            </Label>
            <Input
              id="tableNumber"
              type="text"
              disabled={isSubmitting}
              placeholder="e.g. Table 5 / Takeaway"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              className="rounded-xl border-border bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phoneNumber" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-primary" />
              <span>Phone Number</span> <span className="text-muted-foreground font-normal text-[11px]">(Optional)</span>
            </Label>
            <Input
              id="phoneNumber"
              type="tel"
              disabled={isSubmitting}
              placeholder="e.g. +91 98765 43210"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="rounded-xl border-border bg-background"
            />
          </div>
        </div>

        {/* Email Address */}
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-primary" />
            <span>Email Address</span> <span className="text-muted-foreground font-normal text-[11px]">(Optional, for e-receipt)</span>
          </Label>
          <Input
            id="email"
            type="email"
            disabled={isSubmitting}
            placeholder="e.g. john@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border-border bg-background"
          />
        </div>

        {/* Special Instructions */}
        <div className="space-y-1.5">
          <Label htmlFor="specialInstructions" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-primary" />
            <span>Special Instructions / Dietary Notes</span> <span className="text-muted-foreground font-normal text-[11px]">(Optional)</span>
          </Label>
          <Textarea
            id="specialInstructions"
            rows={3}
            disabled={isSubmitting}
            placeholder="Add any customization notes, ice preference, or sugar level here..."
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
                disabled={isSubmitting}
                onClick={() => addPresetNote(note)}
                className="text-[11px] bg-muted hover:bg-primary/10 hover:text-primary text-muted-foreground px-2.5 py-0.5 rounded-full border border-border/50 transition-colors disabled:opacity-50"
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
        {isSubmitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Creating Order in System...</span>
          </>
        ) : (
          <>
            <Send className="w-5 h-5" />
            <span>Confirm & Send via WhatsApp</span>
          </>
        )}
      </Button>
    </form>
  );
}
