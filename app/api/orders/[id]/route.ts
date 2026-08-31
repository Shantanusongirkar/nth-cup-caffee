import { getPrisma } from "@/lib/prisma";
import { validateUpdateOrderStatusInput } from "@/lib/order-validation";
import { formatOrderReference } from "../route";

export const runtime = "nodejs";

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

    // Check if order exists
    const existingOrder = await prisma.order.findUnique({
      where: { id },
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
