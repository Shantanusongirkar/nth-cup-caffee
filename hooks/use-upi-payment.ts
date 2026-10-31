'use client';

import * as React from 'react';

export type UpiPhase = 'creating' | 'awaiting' | 'paid' | 'expired' | 'unavailable';

export interface UpiQr {
  qrId: string;
  upiUri: string;
  amountInPaise: number;
  expiresAt: string;
  serverNow: string;
  orderReference: string;
  devMock: boolean;
}

export type UpiFallback =
  | { kind: 'popup'; keyId: string; razorpayOrderId: string }
  | { kind: 'counter' };

interface UpiState {
  phase: UpiPhase;
  qr: UpiQr | null;
  fallback: UpiFallback | null;
  error: string | null;
  /** Consecutive poll network failures; `reconnecting` past 3 (keeps retrying). */
  failCount: number;
  /** Client clock skew correction: serverNow - clientNow at QR receipt (ms). */
  clockOffsetMs: number;
  nowMs: number;
}

type UpiAction =
  | { type: 'QR_REQUEST' }
  | { type: 'QR_OK'; qr: UpiQr }
  | { type: 'QR_FAIL'; fallback: UpiFallback; error: string | null }
  | { type: 'PAID' }
  | { type: 'EXPIRED' }
  | { type: 'POLL_OK' }
  | { type: 'POLL_ERROR' }
  | { type: 'TICK' }
  | { type: 'RESET' };

const initialState: UpiState = {
  phase: 'creating',
  qr: null,
  fallback: null,
  error: null,
  failCount: 0,
  clockOffsetMs: 0,
  nowMs: 0,
};

function reducer(state: UpiState, action: UpiAction): UpiState {
  switch (action.type) {
    case 'QR_REQUEST':
      return { ...initialState, phase: 'creating' };
    case 'QR_OK': {
      const clientNow = Date.now();
      return {
        ...state,
        phase: 'awaiting',
        qr: action.qr,
        fallback: null,
        error: null,
        failCount: 0,
        clockOffsetMs: Date.parse(action.qr.serverNow) - clientNow,
        nowMs: clientNow,
      };
    }
    case 'QR_FAIL':
      return {
        ...state,
        phase: 'unavailable',
        qr: null,
        fallback: action.fallback,
        error: action.error,
      };
    case 'PAID':
      return { ...state, phase: 'paid', failCount: 0 };
    case 'EXPIRED':
      return { ...state, phase: 'expired' };
    case 'POLL_OK':
      return { ...state, failCount: 0 };
    case 'POLL_ERROR':
      return { ...state, failCount: state.failCount + 1 };
    case 'TICK':
      return state.phase === 'awaiting' ? { ...state, nowMs: Date.now() } : state;
    case 'RESET':
      return { ...initialState };
    default:
      return state;
  }
}

interface PaymentStatusResponse {
  paymentStatus?: string;
  qrStatus?: 'active' | 'expired' | 'closed';
  expiresAt?: string | null;
  serverNow?: string;
}

/**
 * State machine + polling for one embedded UPI payment.
 * Single page, no redirect: `creating -> awaiting -> paid | expired | unavailable`.
 *
 * Polling is a `setTimeout` chain (never `setInterval`): 2s for the first
 * minute, then 3s (capped at 5s). It stops on paid/expired/unmount, survives
 * network blips (subtle "Reconnecting..." after 3 consecutive failures, keeps
 * retrying), and fires immediately when the tab becomes visible again
 * (customer returning from their UPI app).
 */
export function useUpiPayment() {
  const [state, dispatch] = React.useReducer(reducer, initialState);
  const stateRef = React.useRef(state);
  React.useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const orderIdRef = React.useRef<string | null>(null);
  const pollTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollAbortRef = React.useRef<AbortController | null>(null);
  const awaitingSinceRef = React.useRef<number>(0);
  const tickerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const clearPoll = React.useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (pollAbortRef.current) {
      pollAbortRef.current.abort();
      pollAbortRef.current = null;
    }
  }, []);

  const stopTicker = React.useCallback(() => {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  }, []);

  const pollOnceRef = React.useRef<() => Promise<void>>(async () => {});

  const pollOnce = React.useCallback(async () => {
    const orderId = orderIdRef.current;
    if (!orderId || stateRef.current.phase !== 'awaiting') return;

    pollAbortRef.current?.abort();
    const controller = new AbortController();
    pollAbortRef.current = controller;

    try {
      const res = await fetch(`/api/orders/${orderId}/payment-status`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as PaymentStatusResponse;
      if (stateRef.current.phase !== 'awaiting') return;

      if (data.paymentStatus === 'PAID') {
        clearPoll();
        stopTicker();
        dispatch({ type: 'PAID' });
        return;
      }
      if (data.qrStatus === 'expired') {
        clearPoll();
        stopTicker();
        dispatch({ type: 'EXPIRED' });
        return;
      }
      dispatch({ type: 'POLL_OK' });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (stateRef.current.phase !== 'awaiting') return;
      dispatch({ type: 'POLL_ERROR' });
    }

    if (stateRef.current.phase !== 'awaiting') return;
    const elapsed = Date.now() - awaitingSinceRef.current;
    const delay = Math.min(elapsed < 60_000 ? 2000 : 3000, 5000);
    pollTimerRef.current = setTimeout(() => {
      void pollOnceRef.current();
    }, delay);
  }, [clearPoll, stopTicker]);

  React.useEffect(() => {
    pollOnceRef.current = pollOnce;
  }, [pollOnce]);

  // Poll immediately when the customer returns from their UPI app.
  React.useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (stateRef.current.phase !== 'awaiting') return;
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      void pollOnce();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [pollOnce]);

  // Cleanup on unmount.
  React.useEffect(() => {
    return () => {
      clearPoll();
      stopTicker();
    };
  }, [clearPoll, stopTicker]);

  const requestQr = React.useCallback(
    async (orderId: string) => {
      orderIdRef.current = orderId;
      clearPoll();
      stopTicker();
      dispatch({ type: 'QR_REQUEST' });

      try {
        const res = await fetch(`/api/orders/${orderId}/upi-qr`, {
          method: 'POST',
          headers: { Accept: 'application/json' },
        });
        const data = (await res.json().catch(() => ({}))) as {
          qrId?: string;
          upiUri?: string;
          amountInPaise?: number;
          expiresAt?: string;
          serverNow?: string;
          orderReference?: string;
          devMock?: boolean;
          paymentStatus?: string;
          fallback?: UpiFallback;
          message?: string;
          error?: string;
        };

        if (res.ok && data.qrId && data.upiUri && data.expiresAt) {
          awaitingSinceRef.current = Date.now();
          dispatch({
            type: 'QR_OK',
            qr: {
              qrId: data.qrId,
              upiUri: data.upiUri,
              amountInPaise: data.amountInPaise ?? 0,
              expiresAt: data.expiresAt,
              serverNow: data.serverNow ?? new Date().toISOString(),
              orderReference: data.orderReference ?? '',
              devMock: data.devMock === true,
            },
          });
          tickerRef.current = setInterval(() => dispatch({ type: 'TICK' }), 1000);
          pollTimerRef.current = setTimeout(() => {
            void pollOnce();
          }, 2000);
          return;
        }

        if (res.status === 409 || data.paymentStatus === 'PAID') {
          dispatch({ type: 'PAID' });
          return;
        }

        dispatch({
          type: 'QR_FAIL',
          fallback: data.fallback ?? { kind: 'counter' },
          error: data.message ?? null,
        });
      } catch {
        dispatch({
          type: 'QR_FAIL',
          fallback: { kind: 'counter' },
          error: 'Could not reach the payment server. Please try again.',
        });
      }
    },
    [clearPoll, pollOnce, stopTicker]
  );

  const regenerate = React.useCallback(() => {
    const orderId = orderIdRef.current;
    if (orderId) void requestQr(orderId);
  }, [requestQr]);

  const reset = React.useCallback(() => {
    orderIdRef.current = null;
    clearPoll();
    stopTicker();
    dispatch({ type: 'RESET' });
  }, [clearPoll, stopTicker]);

  const remainingMs = React.useMemo(() => {
    if (!state.qr || state.phase !== 'awaiting') return 0;
    const adjustedNow = state.nowMs + state.clockOffsetMs;
    return Date.parse(state.qr.expiresAt) - adjustedNow;
  }, [state.qr, state.phase, state.nowMs, state.clockOffsetMs]);

  return {
    phase: state.phase,
    qr: state.qr,
    fallback: state.fallback,
    error: state.error,
    reconnecting: state.failCount >= 3,
    remainingMs,
    requestQr,
    regenerate,
    reset,
  };
}
