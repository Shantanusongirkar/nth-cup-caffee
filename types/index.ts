export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: MenuCategory;
  available: boolean;
}

export type MenuCategory = 'coffee' | 'tea' | 'snacks' | 'desserts';

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
