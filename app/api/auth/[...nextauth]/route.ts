import NextAuth from "next-auth";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

const handler = NextAuth(authOptions);

const LOGIN_RATE_LIMIT = 5;
const LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000;

async function withLoginRateLimit(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isCredentialsCallback =
    req.method === "POST" && pathname.endsWith("/callback/credentials");

  // Only credential sign-ins are rate limited; other auth POSTs pass through.
  if (!isCredentialsCallback) {
    return handler(req);
  }

  const ip = getClientIp(req);
  let email: string | undefined;
  let body: string | undefined;

  try {
    body = await req.text();
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const params = new URLSearchParams(body);
      const rawEmail = params.get("email");
      if (rawEmail) {
        email = rawEmail.trim().toLowerCase();
      }
    } else {
      const parsed = JSON.parse(body) as { email?: unknown };
      if (typeof parsed?.email === "string") {
        email = parsed.email.trim().toLowerCase();
      }
    }
  } catch {
    body = undefined;
  }

  const result = checkRateLimit(`login:${ip}:${email ?? "unknown"}`, LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW_MS);
  if (!result.allowed) {
    return rateLimitResponse(result.retryAfterSec);
  }

  const nextReq =
    body !== undefined
      ? new NextRequest(req.url, { method: "POST", headers: req.headers, body })
      : req;
  return handler(nextReq);
}

export async function GET(req: NextRequest) {
  // GET is used for CSRF token / session checks — no login attempts, no limit.
  return handler(req);
}

export async function POST(req: NextRequest) {
  return withLoginRateLimit(req);
}
