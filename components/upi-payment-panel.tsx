'use client';

import * as React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { ServerOrder } from '@/types';
import { useUpiPayment } from '@/hooks/use-upi-payment';
import { useMounted } from '@/hooks/use-mounted';
import {
  UPI_APPS,
  buildAppLink,
  detectPlatform,
  isMobileUpiDevice,
  type UpiApp,
} from '@/lib/upi';
import {
  loadRazorpayScript,
  openRazorpayCheckout,
} from '@/lib/razorpay-checkout';
import { formatPaiseToRupees } from '@/utils/whatsapp';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  QrCode,
  RefreshCw,
  ArrowLeft,
  Wallet,
  BadgeCheck,
  WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';

interface UpiPaymentPanelProps {
  order: ServerOrder;
  onChangeMethod: () => void;
  onPayAtCounter: () => void;
  onPaid: (order: ServerOrder) => void;
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const mm = Math.floor(total / 60).toString().padStart(2, '0');
  const ss = (total % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

function ProgressRing({ fraction }: { fraction: number }) {
  const r = 11;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, fraction));
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" className="-rotate-90">
      <circle cx="14" cy="14" r={r} fill="none" strokeWidth="3" className="stroke-muted" />
      <circle
        cx="14"
        cy="14"
        r={r}
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        className="stroke-primary transition-[stroke-dashoffset] duration-1000"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - clamped)}
      />
    </svg>
  );
}

function PaidCheck() {
  return (
    <div className="upi-pop mx-auto w-fit" aria-hidden="true">
      <svg width="88" height="88" viewBox="0 0 56 56" fill="none">
        <circle
          className="upi-check-circle stroke-emerald-500"
          cx="28"
          cy="28"
          r="26.5"
          strokeWidth="3"
        />
        <path
          className="upi-check-mark stroke-emerald-500"
          d="M17 29.5 24.5 37 39 21"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function UpiPaymentPanel({
  order,
  onChangeMethod,
  onPayAtCounter,
  onPaid,
}: UpiPaymentPanelProps) {
  const mounted = useMounted();
  const { phase, qr, fallback, error, reconnecting, remainingMs, requestQr, regenerate } =
    useUpiPayment();
  // Derived during render (SSR-safe: guards return defaults on the server, and
  // `mounted` flips after hydration). No setState-in-effect needed.
  const platform = mounted ? detectPlatform() : 'other';
  const mobile = mounted ? isMobileUpiDevice() : false;
  const [qrExpanded, setQrExpanded] = React.useState(false);
  const showQr = !mobile || qrExpanded;
  const [appHint, setAppHint] = React.useState(false);
  const [popupBusy, setPopupBusy] = React.useState(false);
  const requestedRef = React.useRef(false);
  const paidTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Request the QR once per mounted order (StrictMode-safe via ref guard).
  React.useEffect(() => {
    if (!requestedRef.current) {
      requestedRef.current = true;
      void requestQr(order.id);
    }
  }, [order.id, requestQr]);

  // Auto-continue ~1.6s after PAID.
  React.useEffect(() => {
    if (phase !== 'paid') return;
    paidTimerRef.current = setTimeout(() => {
      onPaid({ ...order, paymentStatus: 'PAID' });
    }, 1600);
    return () => {
      if (paidTimerRef.current) clearTimeout(paidTimerRef.current);
    };
  }, [phase, onPaid, order]);

  React.useEffect(() => {
    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    };
  }, []);

  const openApp = React.useCallback(
    (app: UpiApp | null) => {
      if (!qr) return;
      const link =
        app === null ? qr.upiUri : buildAppLink(qr.upiUri, app, platform === 'other' ? 'android' : platform);
      setAppHint(false);
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      window.location.href = link;
      // If we are still here after ~1.5s, the app likely did not open.
      hintTimerRef.current = setTimeout(() => {
        if (document.visibilityState === 'visible') setAppHint(true);
      }, 1500);
    },
    [qr, platform]
  );

  const simulateDevPayment = React.useCallback(async () => {
    try {
      const res = await fetch('/api/dev/simulate-upi-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      });
      if (res.ok) {
        toast.success('Simulated payment sent — confirming…', { duration: 2000 });
      } else {
        toast.error('Simulator rejected the request.');
      }
    } catch {
      toast.error('Simulator unreachable.');
    }
  }, [order.id]);

  const payWithPopup = React.useCallback(async () => {
    if (fallback?.kind !== 'popup' || popupBusy) return;
    setPopupBusy(true);
    const loaded = await loadRazorpayScript();
    if (!loaded) {
      toast.error('Could not load the payment popup. Please pay at the counter.');
      setPopupBusy(false);
      return;
    }
    const outcome = await openRazorpayCheckout({
      order,
      keyId: fallback.keyId,
      razorpayOrderId: fallback.razorpayOrderId,
      preferredMethod: 'upi',
    });
    setPopupBusy(false);
    if (outcome === 'paid') {
      onPaid({ ...order, paymentStatus: 'PAID' });
    } else if (outcome === 'failed') {
      toast.error('Payment failed. You can retry or pay at the counter.', { duration: 4000 });
    } else {
      toast('Payment pending — you can pay at the counter.', { duration: 3000 });
    }
  }, [fallback, popupBusy, order, onPaid]);

  const totalSeconds = React.useMemo(() => {
    if (!qr) return 1;
    const ttl = Date.parse(qr.expiresAt) - Date.parse(qr.serverNow);
    return Math.max(1, Math.round(ttl / 1000));
  }, [qr]);
  const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const urgent = remainingSeconds <= 30;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-5 shadow-sm" aria-live="polite">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-3">
        <h3 className="font-heading font-bold text-base text-foreground flex items-center gap-2">
          <QrCode className="w-4 h-4 text-primary" />
          <span>Pay with UPI</span>
        </h3>
        {qr?.devMock && (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
            Dev mock
          </span>
        )}
      </div>

      {phase === 'creating' && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Generating your secure UPI QR…</p>
        </div>
      )}

      {phase === 'awaiting' && qr && (
        <div className="space-y-5">
          {/* QR card */}
          {(showQr || !mobile) && (
            <div className="flex flex-col items-center gap-3">
              <div className="relative rounded-3xl p-[3px] bg-gradient-to-br from-[var(--caramel)] to-[var(--coffee)] upi-shimmer overflow-hidden">
                <div className="rounded-[calc(1.5rem-3px)] bg-white p-4">
                  <QRCodeSVG
                    value={qr.upiUri}
                    size={224}
                    level="H"
                    bgColor="#FFFFFF"
                    fgColor="#1A120B"
                    role="img"
                    aria-label={`UPI QR for order ${qr.orderReference}, amount ${formatPaiseToRupees(qr.amountInPaise)}`}
                    imageSettings={{
                      src: '/brand/nth-cup-mark.svg',
                      width: 44,
                      height: 44,
                      excavate: true,
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm font-semibold">
                <ProgressRing fraction={remainingSeconds / totalSeconds} />
                <span className={urgent ? 'text-red-600 dark:text-red-400' : 'text-foreground'}>
                  {formatCountdown(remainingMs)}
                </span>
                <span className="text-xs font-normal text-muted-foreground">left to pay</span>
              </div>

              <div className="text-center space-y-0.5">
                <p className="font-extrabold text-xl text-foreground">
                  {formatPaiseToRupees(qr.amountInPaise)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Order <span className="font-mono font-bold text-foreground">#{qr.orderReference}</span>
                </p>
                <p className="text-[11px] text-muted-foreground pt-1">
                  Scan with any UPI app - GPay, PhonePe, Paytm, CRED
                </p>
              </div>
            </div>
          )}

          {/* Mobile one-tap buttons */}
          {mobile && platform !== 'other' && (
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                {UPI_APPS.map((app) => (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => openApp(app)}
                    className="min-h-[48px] rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold text-foreground hover:bg-muted/60 active:scale-[0.98] transition-all"
                  >
                    {app.name}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => openApp(null)}
                className="w-full min-h-[48px] rounded-xl border border-dashed border-border px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/40 active:scale-[0.99] transition-all"
              >
                Other UPI app
              </button>
              {appHint && (
                <p className="text-xs text-muted-foreground text-center">
                  Didn&apos;t open? Try another app or scan the QR from another device.
                </p>
              )}
              <button
                type="button"
                onClick={() => setQrExpanded((v) => !v)}
                className="w-full text-xs font-semibold text-primary hover:underline"
              >
                {showQr ? 'Hide QR' : 'Show QR'}
              </button>
            </div>
          )}

          {/* Status */}
          <div className="flex items-center justify-center gap-2.5 py-1">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
            </span>
            <span className="text-sm font-medium text-muted-foreground">Awaiting payment…</span>
          </div>
          {reconnecting && (
            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <WifiOff className="w-3.5 h-3.5" />
              <span>Reconnecting… still watching for your payment.</span>
            </p>
          )}

          {qr.devMock && (
            <Button
              type="button"
              variant="outline"
              onClick={simulateDevPayment}
              className="w-full rounded-full text-xs"
            >
              <BadgeCheck className="w-4 h-4" />
              <span>Simulate payment (dev only)</span>
            </Button>
          )}

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onChangeMethod} className="rounded-full text-xs">
              <ArrowLeft className="w-4 h-4" />
              <span>Change method</span>
            </Button>
            <Button type="button" variant="outline" onClick={onPayAtCounter} className="rounded-full text-xs">
              <Wallet className="w-4 h-4" />
              <span>Pay at counter</span>
            </Button>
          </div>
        </div>
      )}

      {phase === 'paid' && qr && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <PaidCheck />
          <div className="space-y-1">
            <p className="font-heading font-bold text-lg text-foreground">Payment received!</p>
            <p className="text-sm text-muted-foreground">
              {formatPaiseToRupees(qr.amountInPaise)} · Order #{qr.orderReference}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">Taking you to confirmation…</p>
        </div>
      )}

      {phase === 'expired' && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          {qr && (
            <div className="rounded-2xl bg-white p-4 blur-[3px] select-none pointer-events-none" aria-hidden="true">
              <QRCodeSVG value={qr.upiUri} size={160} level="H" bgColor="#FFFFFF" fgColor="#1A120B" />
            </div>
          )}
          <div className="space-y-1">
            <p className="font-heading font-bold text-base text-foreground">QR expired</p>
            <p className="text-xs text-muted-foreground">Generate a new QR to continue.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 w-full pt-1">
            <Button type="button" onClick={regenerate} className="rounded-full text-xs">
              <RefreshCw className="w-4 h-4" />
              <span>Generate new QR</span>
            </Button>
            <Button type="button" variant="outline" onClick={onPayAtCounter} className="rounded-full text-xs">
              <Wallet className="w-4 h-4" />
              <span>Pay at counter</span>
            </Button>
          </div>
          <Button type="button" variant="ghost" onClick={onChangeMethod} className="rounded-full text-xs">
            <ArrowLeft className="w-4 h-4" />
            <span>Change payment method</span>
          </Button>
        </div>
      )}

      {phase === 'unavailable' && (
        <div className="flex flex-col items-center gap-3 py-6 text-center space-y-1">
          <p className="font-heading font-bold text-base text-foreground">UPI QR unavailable</p>
          <p className="text-xs text-muted-foreground max-w-sm">
            {error ?? 'The instant QR could not be created right now.'}
          </p>
          <div className="flex flex-col gap-2 w-full pt-2">
            {fallback?.kind === 'popup' && (
              <Button
                type="button"
                onClick={payWithPopup}
                disabled={popupBusy}
                className="w-full rounded-full text-sm"
              >
                {popupBusy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Opening…</span>
                  </>
                ) : (
                  <span>Pay with Razorpay popup</span>
                )}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={regenerate} className="w-full rounded-full text-xs">
              <RefreshCw className="w-4 h-4" />
              <span>Try QR again</span>
            </Button>
            <Button type="button" variant="outline" onClick={onPayAtCounter} className="w-full rounded-full text-xs">
              <Wallet className="w-4 h-4" />
              <span>Pay at counter instead</span>
            </Button>
            <Button type="button" variant="ghost" onClick={onChangeMethod} className="rounded-full text-xs">
              <ArrowLeft className="w-4 h-4" />
              <span>Change payment method</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
