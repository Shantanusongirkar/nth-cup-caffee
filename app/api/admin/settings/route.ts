import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/require-role";
import type { Session } from "next-auth";

export const runtime = "nodejs";

interface SessionUser {
  role?: string;
  cafeId?: string;
}

function getSession(session: Session | null | undefined) {
  const user = session?.user as SessionUser | undefined;
  return { role: user?.role ?? null, cafeId: user?.cafeId ?? null };
}

const VALID_CHANNELS = ["STAFF_PORTAL", "WHATSAPP", "BOTH"] as const;

export async function GET() {
  const auth = await requireAdminSession({ requireRole: "OWNER" });
  if (auth instanceof NextResponse) {
    return auth;
  }
  const session = auth;
  const { cafeId } = getSession(session);

  if (!cafeId) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const prisma = getPrisma();
  const cafe = await prisma.cafe.findUnique({
    where: { id: cafeId },
    select: { orderNotificationChannel: true },
  });

  if (!cafe) {
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return Response.json({ orderNotificationChannel: cafe.orderNotificationChannel });
}

export async function PATCH(request: Request) {
  const auth = await requireAdminSession({
    requireRole: "OWNER",
    forbiddenMessage: "Only the owner can change this setting.",
  });
  if (auth instanceof NextResponse) {
    return auth;
  }
  const session = auth;
  const { cafeId } = getSession(session);

  if (!cafeId) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const channel = body?.orderNotificationChannel;

  if (typeof channel !== "string" || !VALID_CHANNELS.includes(channel as typeof VALID_CHANNELS[number])) {
    return Response.json(
      { error: "VALIDATION_ERROR", message: `orderNotificationChannel must be one of: ${VALID_CHANNELS.join(", ")}` },
      { status: 400 }
    );
  }

  const prisma = getPrisma();
  const updated = await prisma.cafe.update({
    where: { id: cafeId },
    data: { orderNotificationChannel: channel as typeof VALID_CHANNELS[number] },
    select: { orderNotificationChannel: true },
  });

  return Response.json({ orderNotificationChannel: updated.orderNotificationChannel });
}