import { getPrisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { startOfTodayIST } from "@/lib/dates";

export const runtime = "nodejs";

// Cancels unpaid orders from before today that were never accepted.
export async function POST() {
  const session = await getServerSession(authOptions);
  const cafeId = (session?.user as { cafeId?: string } | undefined)?.cafeId;

  if (!cafeId) {
    return Response.json(
      { error: "UNAUTHORIZED", message: "Authentication required." },
      { status: 401 }
    );
  }

  try {
    const prisma = getPrisma();
    const result = await prisma.order.updateMany({
      where: {
        cafeId,
        status: "PENDING",
        paymentStatus: "UNPAID",
        createdAt: { lt: startOfTodayIST() },
      },
      data: { status: "CANCELLED" },
    });

    return Response.json({ cancelled: result.count });
  } catch (error) {
    console.error("Failed to clear old orders:", error);
    return Response.json(
      { error: "INTERNAL_ERROR", message: "Failed to clear old orders." },
      { status: 500 }
    );
  }
}