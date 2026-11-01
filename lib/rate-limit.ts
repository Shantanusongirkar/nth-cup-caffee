import { NextResponse } from "next/server";

/**
 * Small in-memory rate limiter (dependency-free).
 *
 * WARNING: this store is **per server instance**. On serverless platforms
 * (e.g. Vercel AWS Lambda) each instance keeps its own in-memory store, so
 * counters are not shared across instances and reset on cold start. This is
 * acceptable for low-traffic pilots; for multi-instance / multi-region
 * deployments swap this for a shared store (e.g. Upstash Redis + @upstash/ratelimit).
 */

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSec: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

const MAX_TRACKED_BUCKETS = 1000;

function resolveWindowMs(windowMs?: number): number {
  return windowMs && windowMs > 0 ? windowMs : 15 * 60 * 1000;
}

export function checkRateLimit(key: string, limit: number, windowMs?: number): RateLimitResult {
  const now = Date.now();
  const window = resolveWindowMs(windowMs);

  if (buckets.size > MAX_TRACKED_BUCKETS) {
    for (const [k, bucket] of buckets) {
      if (bucket.resetAt <= now) {
        buckets.delete(k);
      }
    }
  }

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + window });
    return { allowed: true, limit, remaining: Math.max(0, limit - 1), retryAfterSec: 0 };
  }

  if (bucket.count >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return { allowed: false, limit, remaining: 0, retryAfterSec };
  }

  bucket.count += 1;
  return { allowed: true, limit, remaining: Math.max(0, limit - bucket.count), retryAfterSec: 0 };
}

export function rateLimitResponse(retryAfterSec: number) {
  return NextResponse.json(
    { error: "RATE_LIMITED", message: "Too many requests. Please try again later." },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  );
}

export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const ip = forwardedFor.split(",")[0]?.trim();
    if (ip) return ip;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}
