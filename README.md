# Nth Cup Caffee

**QR-code table ordering for cafés — customers scan, order, and pay from their phone.**

A full-stack web application where cafe customers browse a menu, build a cart, and place orders from their table. Orders are saved to the database, optionally paid via Razorpay, and forwarded to staff via WhatsApp. Staff get a protected admin dashboard to manage orders and menu items in real time.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript 5
- **UI:** React 19, Tailwind CSS v4, shadcn/ui (Base UI style), Lucide icons
- **State:** Zustand (persisted to localStorage)
- **Database:** PostgreSQL (Neon) via Prisma 7
- **Auth:** NextAuth v4 (Credentials provider, bcryptjs)
- **Payments:** Razorpay (zero-dependency integration)
- **File Storage:** Vercel Blob
- **Theming:** next-themes (light/dark)
- **Toasts:** Sonner
- **Deployment:** Vercel

## Features

- Browse menu with category tabs, search, and product cards
- Cart drawer with quantity controls and sticky checkout button
- Razorpay payment integration (test and live modes)
- WhatsApp order forwarding to staff
- Live order tracking at `/track`
- Staff login with role-based access (Owner / Staff)
- Admin dashboard: order management with payment badges, menu CRUD with image uploads
- Dark/light theme toggle
- Responsive mobile-first design
- All prices computed server-side in integer paise

## Demo

<!-- Add a screenshot or GIF here -->
<!-- ![Menu Screenshot](public/screenshots/menu.png) -->

## Installation

### Prerequisites

- Node.js 18+
- PostgreSQL database (e.g. [Neon](https://neon.tech))
- Razorpay account (for payment keys)
- Vercel account (for Blob storage, optional for local dev)

### Setup

1. Clone the repository:

```bash
git clone https://github.com/<your-org>/nth-cup-caffee.git
cd nth-cup-caffee
```

2. Install dependencies:

```bash
npm install
```

3. Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

4. Run database migrations and seed the database:

```bash
npm run db:migrate
npm run db:seed
```

5. Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### As a customer

1. Open the app on your phone (or scan the cafe's QR code).
2. Browse the menu, search, or filter by category.
3. Add items to your cart and proceed to checkout.
4. Optionally pay via Razorpay, or place the order without payment.
5. Track your order status at `/track`.

### As staff

1. Log in at `/staff/login`.
2. View incoming orders on the admin dashboard at `/admin/orders`.
3. Manage menu items (add, edit, remove) at `/admin/menu`.

### Testing orders via API

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "cafeSlug": "nth-cup-demo",
    "customer": { "name": "Asha Patel", "phone": "+919876543210" },
    "items": [
      { "productSku": "coffee-001", "quantity": 2 },
      { "productSku": "snack-003", "quantity": 1 }
    ],
    "tableNumber": "5"
  }'
```

> Prices and taxes are always calculated server-side from the database. Do not send a client-provided total.

## Project Structure

```
nth-cup-caffee/
├── app/
│   ├── api/              # REST API routes (menu, orders, admin, auth)
│   ├── admin/            # Staff dashboard (orders, menu management)
│   ├── cart/             # Cart page
│   ├── checkout/         # Checkout with Razorpay
│   ├── success/          # Order confirmation
│   ├── staff/login/      # Staff authentication
│   ├── track/            # Live order tracking
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Home / menu page
│   └── globals.css       # Tailwind v4 theme config
├── components/           # React components
│   └── ui/               # shadcn/ui primitives
├── data/
│   └── menu.ts           # Seed data (20 menu items)
├── hooks/                # Custom React hooks
├── lib/
│   ├── auth.ts           # NextAuth config
│   ├── payments/         # Razorpay helpers
│   ├── prisma.ts         # Prisma client singleton
│   └── utils.ts          # cn() utility
├── prisma/
│   ├── schema.prisma     # Database schema
│   ├── seed.ts           # Seed script
│   └── migrations/       # SQL migrations
├── public/
│   └── menu/             # Product images
├── scripts/              # Dev/test scripts
├── store/
│   └── cart-store.ts     # Zustand cart store
├── types/                # Shared TypeScript types
├── utils/
│   └── whatsapp.ts       # WhatsApp message builders
├── proxy.ts              # Route protection middleware
└── next.config.ts        # Next.js config
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (e.g. Neon) |
| `NEXTAUTH_SECRET` | Secret for NextAuth session encryption |
| `NEXTAUTH_URL` | App base URL (`http://localhost:3000` for dev) |
| `RAZORPAY_KEY_ID` | Razorpay API key (test or live) |
| `RAZORPAY_KEY_SECRET` | Razorpay API secret |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token (required for admin image uploads) |

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Generate Prisma client and build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:migrate` | Run database migrations |
| `npm run db:seed` | Seed the database with sample data |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:validate` | Validate Prisma schema |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m "feat: add my feature"`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

Run `npm run lint` before committing to ensure code quality.
