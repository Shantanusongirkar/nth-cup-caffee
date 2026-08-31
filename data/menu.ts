import { MenuItem } from '@/types';

export const menuItems: MenuItem[] = [
  // ==================== COFFEE ====================
  {
    id: 'coffee-001',
    name: 'Classic Cappuccino',
    description: 'Rich espresso topped with velvety steamed milk foam and a dusting of cocoa',
    price: 180,
    image: '/menu/cappuccino.png',
    category: 'coffee',
    available: true,
  },
  {
    id: 'coffee-002',
    name: 'Café Latte',
    description: 'Smooth espresso blended with creamy steamed milk, lightly frothed',
    price: 190,
    image: '/menu/latte.png',
    category: 'coffee',
    available: true,
  },
  {
    id: 'coffee-003',
    name: 'Double Espresso',
    description: 'Intense double shot of our signature espresso with a golden crema',
    price: 120,
    image: '/menu/espresso.png',
    category: 'coffee',
    available: true,
  },
  {
    id: 'coffee-004',
    name: 'Hazelnut Mocha',
    description: 'Espresso with rich chocolate, hazelnut syrup, steamed milk and whipped cream',
    price: 250,
    image: '/menu/mocha.png',
    category: 'coffee',
    available: true,
  },
  {
    id: 'coffee-005',
    name: 'Cold Brew',
    description: 'Slow-steeped for 18 hours, served over ice for a smooth, bold flavor',
    price: 200,
    image: '/menu/cold-brew.png',
    category: 'coffee',
    available: true,
  },
  {
    id: 'coffee-006',
    name: 'Caramel Macchiato',
    description: 'Espresso drizzled with buttery caramel over steamed milk and vanilla',
    price: 230,
    image: '/menu/caramel-macchiato.svg',
    category: 'coffee',
    available: false,
  },

  // ==================== TEA ====================
  {
    id: 'tea-001',
    name: 'Masala Chai',
    description: 'Traditional Indian spiced tea brewed with cardamom, ginger, and cinnamon',
    price: 100,
    image: '/menu/masala-chai.svg',
    category: 'tea',
    available: true,
  },
  {
    id: 'tea-002',
    name: 'Matcha Latte',
    description: 'Premium ceremonial grade matcha whisked with creamy oat milk',
    price: 220,
    image: '/menu/matcha-latte.svg',
    category: 'tea',
    available: true,
  },
  {
    id: 'tea-003',
    name: 'Iced Peach Tea',
    description: 'Refreshing black tea infused with peach, served chilled with ice',
    price: 150,
    image: '/menu/iced-peach-tea.svg',
    category: 'tea',
    available: true,
  },
  {
    id: 'tea-004',
    name: 'Green Tea',
    description: 'Delicate Japanese sencha green tea, light and antioxidant-rich',
    price: 110,
    image: '/menu/green-tea.svg',
    category: 'tea',
    available: true,
  },

  // ==================== SNACKS ====================
  {
    id: 'snack-001',
    name: 'Butter Croissant',
    description: 'Flaky, golden French croissant made with pure butter, baked fresh daily',
    price: 120,
    image: '/menu/croissant.svg',
    category: 'snacks',
    available: true,
  },
  {
    id: 'snack-002',
    name: 'Grilled Panini',
    description: 'Crispy ciabatta with mozzarella, sun-dried tomatoes, pesto, and arugula',
    price: 250,
    image: '/menu/panini.svg',
    category: 'snacks',
    available: true,
  },
  {
    id: 'snack-003',
    name: 'Samosa Platter',
    description: 'Crispy hand-folded samosas with spiced potato filling, served with chutney',
    price: 80,
    image: '/menu/samosa.svg',
    category: 'snacks',
    available: true,
  },
  {
    id: 'snack-004',
    name: 'Garlic Bread',
    description: 'Warm toasted baguette with herb butter, roasted garlic, and mozzarella',
    price: 140,
    image: '/menu/garlic-bread.svg',
    category: 'snacks',
    available: false,
  },
  {
    id: 'snack-005',
    name: 'Bruschetta',
    description: 'Toasted sourdough topped with fresh tomatoes, basil, and balsamic glaze',
    price: 160,
    image: '/menu/bruschetta.svg',
    category: 'snacks',
    available: true,
  },

  // ==================== DESSERTS ====================
  {
    id: 'dessert-001',
    name: 'Dark Chocolate Brownie',
    description: 'Dense, fudgy brownie with 70% dark chocolate, topped with sea salt flakes',
    price: 150,
    image: '/menu/brownie.svg',
    category: 'desserts',
    available: true,
  },
  {
    id: 'dessert-002',
    name: 'New York Cheesecake',
    description: 'Creamy baked cheesecake with a buttery graham cracker crust and berry compote',
    price: 280,
    image: '/menu/cheesecake.svg',
    category: 'desserts',
    available: true,
  },
  {
    id: 'dessert-003',
    name: 'Classic Tiramisu',
    description: 'Layers of espresso-soaked ladyfingers with mascarpone cream and cocoa',
    price: 300,
    image: '/menu/tiramisu.svg',
    category: 'desserts',
    available: true,
  },
  {
    id: 'dessert-004',
    name: 'Blueberry Muffin',
    description: 'Soft, moist muffin bursting with fresh blueberries and a crumb topping',
    price: 130,
    image: '/menu/muffin.svg',
    category: 'desserts',
    available: true,
  },
  {
    id: 'dessert-005',
    name: 'Cookie Skillet',
    description: 'Warm chocolate chip cookie baked in a skillet, served with vanilla ice cream',
    price: 220,
    image: '/menu/cookie-skillet.svg',
    category: 'desserts',
    available: false,
  },
];

/**
 * Fetches menu items from Neon PostgreSQL via /api/menu with fallback to local seed data.
 */
export async function getMenuItems(cafeSlug: string = 'nth-cup-demo'): Promise<MenuItem[]> {
  try {
    const res = await fetch(`/api/menu?cafeSlug=${encodeURIComponent(cafeSlug)}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!res.ok) {
      console.warn(`Menu API returned ${res.status}, falling back to static menu data.`);
      return menuItems;
    }

    const data = await res.json();
    if (Array.isArray(data.items) && data.items.length > 0) {
      return data.items;
    }
    if (Array.isArray(data) && data.length > 0) {
      return data;
    }

    return menuItems;
  } catch (error) {
    console.warn('Network error fetching menu, falling back to static data:', error);
    return menuItems;
  }
}
