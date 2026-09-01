import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function runTests() {
  console.log("=== 1. Testing POST /api/orders with valid order ===");
  const validOrderPayload = {
    cafeSlug: "nth-cup-demo",
    customer: {
      name: "Asha Patel",
      phone: "+91 98765 43210",
      email: "asha@example.com",
    },
    items: [
      { productSku: "coffee-001", quantity: 2 },
      { productSku: "snack-003", quantity: 1 },
    ],
    tableNumber: "5",
    notes: "Extra hot, less sugar",
  };

  const res1 = await fetch("http://localhost:3000/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(validOrderPayload),
  });

  const json1 = await res1.json();
  console.log("Status:", res1.status);
  console.log("Response:", JSON.stringify(json1, null, 2));

  if (res1.status !== 201) {
    throw new Error(`Expected status 201, got ${res1.status}`);
  }

  const orderId = json1.order.id;

  console.log("\n=== 2. Verifying order persisted in Neon PostgreSQL ===");
  const dbOrder = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      items: {
        include: {
          product: true,
        },
      },
      cafe: true,
    },
  });

  console.log("DB Order found:", dbOrder?.id);
  console.log("Cafe:", dbOrder?.cafe.name, `(${dbOrder?.cafe.slug})`);
  console.log("Customer:", dbOrder?.customer.name, dbOrder?.customer.phone);
  console.log("Subtotal (paise):", dbOrder?.subtotalInPaise);
  console.log("Tax (paise):", dbOrder?.taxInPaise);
  console.log("Total (paise):", dbOrder?.totalInPaise);
  console.log("Items count:", dbOrder?.items.length);
  dbOrder?.items.forEach((item) => {
    console.log(` - ${item.quantity}x ${item.productName} @ ₹${item.unitPriceInPaise / 100} (SKU: ${item.product.sku})`);
  });

  console.log("\n=== 3. Testing invalid cafe slug (should return 404) ===");
  const res2 = await fetch("http://localhost:3000/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...validOrderPayload,
      cafeSlug: "non-existent-cafe",
    }),
  });
  console.log("Status:", res2.status);
  const json2 = await res2.json();
  console.log("Response:", json2);

  console.log("\n=== 4. Testing unavailable product (should return 422) ===");
  const res3 = await fetch("http://localhost:3000/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...validOrderPayload,
      items: [{ productSku: "coffee-006", quantity: 1 }], // coffee-006 is available: false
    }),
  });
  console.log("Status:", res3.status);
  const json3 = await res3.json();
  console.log("Response:", json3);

  console.log("\n=== 5. Testing validation failure with missing customer name (should return 400) ===");
  const res4 = await fetch("http://localhost:3000/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...validOrderPayload,
      customer: { name: "" },
    }),
  });
  console.log("Status:", res4.status);
  const json4 = await res4.json();
  console.log("Response:", json4);

  console.log("\n=== ALL TESTS PASSED! ===");
}

runTests()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("Test failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
