// ============================================================================
// PASTE INTO:  app/api/orders/[id]/route.ts       (REPLACE the whole file)
// ----------------------------------------------------------------------------
// WHAT CHANGED (search for "CHANGED"):
//   When staff mark a CASH order as COMPLETED, its payment status is now set to
//   PAID automatically. Before, completed cash orders stayed "Unpaid".
// ============================================================================
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
      // CHANGED: also read paymentMethod and paymentStatus (needed below)
      select: { id: true, paymentMethod: true, paymentStatus: true },
    });

    if (!existingOrder) {
      return Response.json(
        { error: "NOT_FOUND", message: `Order with ID '${id}' was not found.` },
        { status: 404 }
      );
    }

    // CHANGED: a CASH order that is marked COMPLETED has been paid at the table,
    // so mark it PAID too. UPI and card orders are marked paid by Razorpay, not here.
    const shouldMarkCashPaid =
      parsed.data.status === "COMPLETED" &&
      existingOrder.paymentMethod === "CASH" &&
      existingOrder.paymentStatus !== "PAID";

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        status: parsed.data.status,
        // CHANGED: only adds paymentStatus when the rule above is true
        ...(shouldMarkCashPaid ? { paymentStatus: "PAID" as const } : {}),
      },
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