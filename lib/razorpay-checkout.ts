import type { ServerOrder } from '@/types';

/* ---------- Razorpay popup (CARD + UPI fallback only) ---------- */

export interface RazorpayResponse {
  razorpay_payment_id?: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, handler: (response: unknown) => void) => void;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  handler?: (response: RazorpayResponse) => void;
  modal?: { ondismiss?: () => void };
  config?: unknown;
}
interface RazorpayConstructor {
  new (options: RazorpayOptions): RazorpayInstance;
}

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

let razorpayScriptPromise: Promise<boolean> | null = null;

export function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (typeof window.Razorpay !== 'undefined') return Promise.resolve(true);
  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }
  return razorpayScriptPromise;
}

export type PaymentOutcome = 'paid' | 'failed' | 'unpaid';

export function openRazorpayCheckout(opts: {
  order: ServerOrder;
  keyId: string;
  razorpayOrderId: string;
  preferredMethod: 'upi' | 'card';
}) {
  return new Promise<PaymentOutcome>((resolve) => {
    const Razorpay = window.Razorpay;
    if (!Razorpay) {
      resolve('unpaid');
      return;
    }

    let settled = false;
    const settle = (outcome: PaymentOutcome) => {
      if (!settled) {
        settled = true;
        resolve(outcome);
      }
    };

    const handlePaymentResponse = async (response: RazorpayResponse) => {
      // Only the server can confirm a payment, via signature verification.
      if (!response.razorpay_payment_id) {
        settle('failed');
        return;
      }

      try {
        const res = await fetch(`/api/orders/${opts.order.id}/verify-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          paymentStatus?: string;
        };
        settle(res.ok && data.success === true && data.paymentStatus === 'PAID' ? 'paid' : 'failed');
      } catch {
        settle('failed');
      }
    };

    const rzp = new Razorpay({
      key: opts.keyId,
      amount: opts.order.totalInPaise,
      currency: 'INR',
      name: 'Nth Cup Caffee',
      description: `Order ${opts.order.orderReference}`,
      order_id: opts.razorpayOrderId,
      prefill: {
        name: opts.order.customer.name,
        email: opts.order.customer.email ?? undefined,
        contact: opts.order.customer.phone ?? undefined,
      },
      config: {
        display: {
          blocks: {
            preferred: {
              name: 'Recommended',
              instruments: [{ method: opts.preferredMethod }],
            },
          },
          sequence: ['block.preferred'],
          preferences: { show_default_blocks: true },
        },
      },
      handler: handlePaymentResponse,
      modal: {
        ondismiss: () => settle('unpaid'),
      },
    } as RazorpayOptions);

    rzp.on('payment.failed', () => settle('failed'));
    rzp.open();
  });
}
