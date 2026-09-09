import { getPrisma } from "@/lib/prisma";
import { validateUpdateOrderStatusInput } from "@/lib/order-validation";
import { formatOrderReference } from "../route";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { Session } from "next-auth";

export const runtime = "nodejs";

interface SessionUser {
  id?: string;
  role?: string;
  cafeId?: string;
}

function getSessionCafeId(session: Session | null | undefined): string | null {
  const user = session?.user as SessionUser | undefined;
  return user?.cafeId ?? null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  if (!id || typeof id !== "string") {
    return Response.json(
      { error: "INVALID_ID", message: "Order ID parameter is required." },
      { status: 400 }
    );
  }

  // Authenticated — staff only
  const session = await getServerSession(authOptions);
  const cafeId = getSessionCafeId(session);
  if (!cafeId) {
    return Response.json(
      { error: "UNAUTHORIZED", message: "Authentication required." },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "INVALID_JSON", message: "Request body must contain valid JSON." },
      { status: 400 }
    );
  }

  const parsed = validateUpdateOrderStatusInput(body);
  if (!parsed.success) {
    return Response.json(
      { error: "VALIDATION_ERROR", message: "Invalid status update payload.", details: parsed.errors },
      { status: 400 }
    );
  }

  try {
    const prisma = getPrisma();

    // Check the order exists AND belongs to the logged-in user's cafe.
    // Return 404 (not 403) so we don't leak existence of orders in other cafes.
    const existingOrder = await prisma.order.findFirst({
      where: { id, cafeId },
      select: { id: true },
    });

    if (!existingOrder) {
      return Response.json(
        { error: "NOT_FOUND", message: `Order with ID '${id}' was not found.` },
        { status: 404 }
      );
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status: parsed.data.status },
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        items: {
          select: {
            id: true,
            productId: true,
            productName: true,
            unitPriceInPaise: true,
            quantity: true,
          },
        },
      },
    });

    return Response.json(
      {
        success: true,
        order: {
          ...updatedOrder,
          orderReference: formatOrderReference(updatedOrder.id),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`Failed to update order ${id}:`, error);
    return Response.json(
      { error: "INTERNAL_ERROR", message: "Failed to update order status." },
      { status: 500 }
    );
  }
}
