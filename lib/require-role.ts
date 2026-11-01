import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";

export type AdminRole = "OWNER" | "STAFF";

export const ADMIN_ALLOWED_ROLES: AdminRole[] = ["OWNER", "STAFF"];

interface RequireAdminSessionOptions {
  /**
   * Required admin role. `OWNER` restricts access to the cafe owner;
   * when omitted, both OWNER and STAFF are allowed.
   */
  requireRole?: AdminRole;
  /** Custom 403 message (e.g. owner-only settings PATCH). */
  forbiddenMessage?: string;
}

/**
 * Shared admin authorization gate for app/api/admin/** routes.
 *
 * Returns the NextAuth session on success, or a 401/403 NextResponse on failure.
 * Callers stay responsible for their own cafeId scoping on the session user.
 */
export async function requireAdminSession(
  options: RequireAdminSessionOptions = {}
): Promise<Session | NextResponse> {
  const allowedRoles: AdminRole[] = options.requireRole
    ? [options.requireRole]
    : ADMIN_ALLOWED_ROLES;

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Authentication required." },
      { status: 401 }
    );
  }

  const user = session.user as { role?: string | null };
  const role = (user?.role ?? "STAFF") as AdminRole;

  if (!allowedRoles.includes(role)) {
    return NextResponse.json(
      {
        error: "FORBIDDEN",
        message:
          options.forbiddenMessage ??
          (options.requireRole === "OWNER"
            ? "Only the owner can perform this action."
            : "Insufficient permissions."),
      },
      { status: 403 }
    );
  }

  return session;
}
