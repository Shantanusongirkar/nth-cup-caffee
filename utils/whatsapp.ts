import { CartItem, OrderDetails } from '@/types';

const WHATSAPP_URL_CHAR_LIMIT = 1800;

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

/**
 * Generates a formatted WhatsApp order message.
 */
export function generateWhatsAppMessage(
  items: CartItem[],
  order: OrderDetails,
  total: number
): string {
  const lines: string[] = [];

  lines.push('Hello! ☕');
  lines.push('');
  lines.push('*New Order*');
  lines.push('');

  lines.push(`*Customer:*`);
  lines.push(order.customerName);
  lines.push('');

  if (order.tableNumber) {
    lines.push(`*Table:*`);
    lines.push(order.tableNumber);
    lines.push('');
  }

  if (order.phoneNumber) {
    lines.push(`*Phone:*`);
    lines.push(order.phoneNumber);
    lines.push('');
  }

  lines.push('*Items:*');
  for (const cartItem of items) {
    lines.push(`${cartItem.quantity} × ${cartItem.item.name} — ${formatCurrency(cartItem.item.price * cartItem.quantity)}`);
  }
  lines.push('');

  lines.push(`*Total: ${formatCurrency(total)}*`);
  lines.push('');

  if (order.specialInstructions) {
    lines.push('*Notes:*');
    lines.push(order.specialInstructions);
    lines.push('');
  }

  lines.push('Thank you! 🙏');

  return lines.join('\n');
}

/**
 * Generates a truncated message when the full message exceeds URL limits.
 */
function generateTruncatedMessage(
  items: CartItem[],
  order: OrderDetails,
  total: number
): string {
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const lines: string[] = [];

  lines.push('Hello! ☕');
  lines.push('');
  lines.push('*New Order*');
  lines.push('');
  lines.push(`*Customer:* ${order.customerName}`);
  if (order.tableNumber) lines.push(`*Table:* ${order.tableNumber}`);
  if (order.phoneNumber) lines.push(`*Phone:* ${order.phoneNumber}`);
  lines.push('');
  lines.push(`*${totalItems} items — ${formatCurrency(total)}*`);
  lines.push('(Full details shared separately)');
  lines.push('');
  lines.push('Thank you! 🙏');

  return lines.join('\n');
}

/**
 * Builds the WhatsApp URL with the order message.
 * Returns { url, message, isTruncated } so the UI can offer
 * a "Copy full details" fallback when truncated.
 */
export function buildWhatsAppUrl(
  items: CartItem[],
  order: OrderDetails,
  total: number
): { url: string; message: string; isTruncated: boolean } {
  const fullMessage = generateWhatsAppMessage(items, order, total);
  const phone = process.env.NEXT_PUBLIC_CAFE_WHATSAPP_NUMBER ?? '';

  const fullEncoded = encodeURIComponent(fullMessage);
  const fullUrl = `https://wa.me/${phone}?text=${fullEncoded}`;

  if (fullUrl.length <= WHATSAPP_URL_CHAR_LIMIT) {
    return { url: fullUrl, message: fullMessage, isTruncated: false };
  }

  // Truncated fallback
  const truncatedMessage = generateTruncatedMessage(items, order, total);
  const truncatedEncoded = encodeURIComponent(truncatedMessage);
  const truncatedUrl = `https://wa.me/${phone}?text=${truncatedEncoded}`;

  return { url: truncatedUrl, message: fullMessage, isTruncated: true };
}
