import NextAuth from "next-auth";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

const handler = NextAuth(authOptions);

type AuthContext = { params: Promise<{ nextauth: string[] }> };

const LOGIN_RATE_LIMIT = 5;
const LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000;

async function withLoginRateLimit(req: NextRequest, context: AuthContext) {
  const { pathname } = req.nextUrl;
  const isCredentialsCallback =
    req.method === "POST" && pathname.endsWith("/callback/credentials");

  if (!isCredentialsCallback) {
    return handler(req, context);
  }

  // Read the email from a CLONE so the original body stays readable for NextAuth.
  let email: string | undefined;
  try {
    const raw = await req.clone().text();
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const rawEmail = new URLSearchParams(raw).get("email");
      if (rawEmail) email = rawEmail.trim().toLowerCase();
    } else {
      const parsed = JSON.parse(raw) as { email?: unknown };
      if (typeof parsed?.email === "string") email = parsed.email.trim().toLowerCase();
    }
  } catch {
    // ignore parse errors; fall back to IP-only key
  }

  const ip = getClientIp(req);
  const result = checkRateLimit(
    `login:${ip}:${email ?? "unknown"}`,
    LOGIN_RATE_LIMIT,
    LOGIN_RATE_WINDOW_MS
  );
  if (!result.allowed) return rateLimitResponse(result.retryAfterSec);

  return handler(req, context);
}

export async function GET(req: NextRequest, context: AuthContext) {
  return handler(req, context);
}

export async function POST(req: NextRequest, context: AuthContext) {
  return withLoginRateLimit(req, context);
}