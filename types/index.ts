

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image?: string;
  category: MenuCategory;
  available: boolean;
}

export type MenuCategory = 'coffee' | 'tea' | 'snacks' | 'desserts';
export type PaymentMethod = 'UPI' | 'CARD' | 'CASH';



export interface CartItem {
  item: MenuItem;
  quantity: number;
}

export interface OrderDetails {
  customerName: string;
  tableNumber?: string;
  phoneNumber?: string;
  email?: string;
  specialInstructions?: string;
}

export interface CartStore {
  items: CartItem[];
  addItem: (item: MenuItem) => void;
  removeItem: (itemId: string) => void;
  increaseQuantity: (itemId: string) => void;
  decreaseQuantity: (itemId: string) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getTax: () => number;
  getTotal: () => number;
  getItemCount: () => number;
}

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

export type OrderPaymentStatus = 'UNPAID' | 'PAID' | 'FAILED' | 'REFUNDED';

export interface ServerCustomer {
  id?: string;
  name: string;
  phone?: string | null;
  email?: string | null;
}

export interface ServerOrderItem {
  id?: string;
  productId?: string;
  productName: string;
  unitPriceInPaise: number;
  quantity: number;
}

export interface ServerOrder {
  id: string;
  orderReference: string;
  cafeId?: string;
  customerId?: string;
  customer: ServerCustomer;
  status: OrderStatus;
  paymentStatus?: OrderPaymentStatus;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  payment?: { keyId?: string | null; orderId?: string | null };
  tableNumber?: string | null;
  notes?: string | null;
  subtotalInPaise: number;
  taxInPaise: number;
  totalInPaise: number;
  createdAt: string | Date;
  updatedAt?: string | Date;
  items: ServerOrderItem[];
}

export interface AdminOrderStats {
  todayOrders: number;
  pendingOrders: number;
  completedOrders: number;
  todayRevenueInPaise: number;
}

export interface AdminProduct {
  id: string;
  cafeId: string;
  sku: string;
  name: string;
  description: string;
  priceInPaise: number;
  imageUrl: string | null;
  category: string;
  isAvailable: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  _count?: { orderItems: number };
}

export interface AdminProductStats {
  totalProducts: number;
  availableProducts: number;
  unavailableProducts: number;
  categories: number;
}
