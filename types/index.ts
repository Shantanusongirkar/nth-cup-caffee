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
