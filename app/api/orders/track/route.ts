import { getPrisma } from "@/lib/prisma";
import { validateTrackingInput } from "@/lib/order-tracking-validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const body = {
      orderRef: searchParams.get("orderRef") || "",
      phoneLast4: searchParams.get("phoneLast4") || undefined,
    };

    const parsed = validateTrackingInput(body);
    if (!parsed.success) {
      return Response.json(
        { error: "VALIDATION_ERROR", message: "Tracking request is invalid.", details: parsed.errors },
        { status: 400 }
      );
    }

    const { orderId, phoneLast4 } = parsed.data;

    const prisma = getPrisma();

    // Build the where clause: find by order ID prefix
    const orders = await prisma.order.findMany({
      where: {
        id: { startsWith: orderId },
      },
      take: 2,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        items: {
          select: {
            id: true,
            productName: true,
            unitPriceInPaise: true,
            quantity: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (orders.length === 0) {
      return Response.json(
        { error: "NOT_FOUND", message: "No order found with that reference. Please check and try again." },
        { status: 404 }
      );
    }

    // Use the first (most recent) match
    const order = orders[0];

    // Phone verification: if phoneLast4 provided, verify last 4 digits of customer phone
    if (phoneLast4) {
      const customerPhone = order.customer.phone;
      if (!customerPhone) {
        return Response.json(
          { error: "PHONE_MISMATCH", message: "This order has no phone number on file." },
          { status: 403 }
        );
      }

      const phoneDigits = customerPhone.replace(/\D/g, "");
      if (!phoneDigits.endsWith(phoneLast4)) {
        return Response.json(
          { error: "PHONE_MISMATCH", message: "Phone number does not match our records." },
          { status: 403 }
        );
      }
    }

    // Format the order reference using the same format as the orders route
    const cleanId = order.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();
    const orderReference = `NC-${cleanId}`;

    return Response.json(
      {
        order: {
          id: order.id,
          orderReference,
          status: order.status,
          customer: {
            name: order.customer.name,
            phone: order.customer.phone,
          },
          tableNumber: order.tableNumber,
          notes: order.notes,
          subtotalInPaise: order.subtotalInPaise,
          taxInPaise: order.taxInPaise,
          totalInPaise: order.totalInPaise,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          items: order.items,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to track order:", error);
    return Response.json(
      { error: "INTERNAL_ERROR", message: "Unable to look up your order." },
      { status: 500 }
    );
  }
}
