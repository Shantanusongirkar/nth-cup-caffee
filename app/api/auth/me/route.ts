import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ role: null, authenticated: false }, { status: 401 });
  }
  const user = session.user as { role?: string };
  return NextResponse.json({ role: user.role, authenticated: true });
}