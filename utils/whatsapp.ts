import { ServerOrder } from "@/types";

const WHATSAPP_URL_CHAR_LIMIT = 1800;

export function formatPaiseToRupees(paise: number): string {
  const rupees = Math.round(paise / 100);
  return `₹${rupees.toLocaleString("en-IN")}`;
}

/**
 * Generates a structured WhatsApp order message from a verified server order.
 */
export function generateWhatsAppMessageFromOrder(order: ServerOrder): string {
  const lines: string[] = [];

  lines.push("☕ *Nth Cup Caffee — Order Confirmation*");
  lines.push("");
  lines.push(`*Order Reference:* #${order.orderReference || order.id.slice(0, 8).toUpperCase()}`);
  lines.push(`*Status:* ${order.status}`);
  lines.push("");

  lines.push("*Customer Details:*");
  lines.push(`• Name: ${order.customer.name}`);
  if (order.tableNumber) {
    lines.push(`• Table: ${order.tableNumber}`);
  }
  if (order.customer.phone) {
    lines.push(`• Phone: ${order.customer.phone}`);
  }
  lines.push("");

  lines.push("*Order Items:*");
  for (const item of order.items) {
    const itemTotalPaise = item.unitPriceInPaise * item.quantity;
    lines.push(
      `• ${item.quantity}× ${item.productName} (${formatPaiseToRupees(item.unitPriceInPaise)}) — ${formatPaiseToRupees(itemTotalPaise)}`
    );
  }
  lines.push("");

  lines.push(`*Subtotal:* ${formatPaiseToRupees(order.subtotalInPaise)}`);
  if (order.taxInPaise > 0) {
    lines.push(`*Tax (5%):* ${formatPaiseToRupees(order.taxInPaise)}`);
  }
  lines.push(`*Total Amount: ${formatPaiseToRupees(order.totalInPaise)}*`);
  lines.push("");

  if (order.notes) {
    lines.push("*Special Instructions:*");
    lines.push(`"${order.notes}"`);
    lines.push("");
  }

  lines.push("Thank you for ordering with Nth Cup Caffee! 🙏");

  return lines.join("\n");
}

/**
 * Generates a concise fallback message when full details exceed URL limit.
 */
function generateTruncatedOrderMessage(order: ServerOrder): string {
  const totalItemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const lines: string[] = [];

  lines.push("☕ *Nth Cup Caffee — Order*");
  lines.push("");
  lines.push(`*Order Reference:* #${order.orderReference || order.id.slice(0, 8).toUpperCase()}`);
  lines.push(`*Customer:* ${order.customer.name}`);
  if (order.tableNumber) lines.push(`*Table:* ${order.tableNumber}`);
  if (order.customer.phone) lines.push(`*Phone:* ${order.customer.phone}`);
  lines.push("");
  lines.push(`*${totalItemCount} items — Total: ${formatPaiseToRupees(order.totalInPaise)}*`);
  lines.push("(Full line-by-line breakdown sent via receipt)");
  lines.push("");
  lines.push("Thank you! 🙏");

  return lines.join("\n");
}

/**
 * Builds the WhatsApp direct chat URL using the configured phone number and server order.
 */
export function buildWhatsAppUrlFromOrder(order: ServerOrder): {
  url: string;
  message: string;
  isTruncated: boolean;
} {
  const fullMessage = generateWhatsAppMessageFromOrder(order);
  const rawPhone = process.env.NEXT_PUBLIC_CAFE_WHATSAPP_NUMBER || "919876543210";
  const phone = rawPhone.replace(/\D/g, "");

  const fullEncoded = encodeURIComponent(fullMessage);
  const fullUrl = `https://wa.me/${phone}?text=${fullEncoded}`;

  if (fullUrl.length <= WHATSAPP_URL_CHAR_LIMIT) {
    return { url: fullUrl, message: fullMessage, isTruncated: false };
  }

  const truncatedMessage = generateTruncatedOrderMessage(order);
  const truncatedEncoded = encodeURIComponent(truncatedMessage);
  const truncatedUrl = `https://wa.me/${phone}?text=${truncatedEncoded}`;

  return { url: truncatedUrl, message: fullMessage, isTruncated: true };
}
