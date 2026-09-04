This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Test order creation locally

Start PostgreSQL and prepare the seeded development data:

```powershell
docker compose up -d postgres
npm run db:migrate
npm run db:seed
npm run dev
```

Then send a `POST` request to `http://localhost:3000/api/orders`. Product SKUs
come from the seeded menu; the demo cafe slug is `nth-cup-demo`.

```powershell
curl.exe -X POST http://localhost:3000/api/orders `
  -H "Content-Type: application/json" `
  -d '{"cafeSlug":"nth-cup-demo","customer":{"name":"Asha Patel","phone":"+919876543210"},"items":[{"productSku":"coffee-001","quantity":2},{"productSku":"snack-003","quantity":1}],"tableNumber":"5"}'
```

The server calculates all prices and taxes from the database; do not send a
client-provided total.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details and updates.
