import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { menuItems } from "../data/menu";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const cafe = await prisma.cafe.upsert({
    where: { slug: "nth-cup-demo" },
    update: {
      name: "Nth Cup Caffee",
      phone: "+91 98765 43210",
      address: "123 Artisanal Brews Street, Bangalore",
    },
    create: {
      name: "Nth Cup Caffee",
      slug: "nth-cup-demo",
      phone: "+91 98765 43210",
      address: "123 Artisanal Brews Street, Bangalore",
    },
  });

  await prisma.user.upsert({
    where: { email: "owner@nthcup.demo" },
    update: { cafeId: cafe.id, name: "Nth Cup Owner", role: "OWNER" },
    create: {
      cafeId: cafe.id,
      name: "Nth Cup Owner",
      email: "owner@nthcup.demo",
      role: "OWNER",
    },
  });

  await Promise.all(
    menuItems.map((item) =>
      prisma.product.upsert({
        where: { cafeId_sku: { cafeId: cafe.id, sku: item.id } },
        update: {
          name: item.name,
          description: item.description,
          priceInPaise: Math.round(item.price * 100),
          imageUrl: item.image,
          category: item.category,
          isAvailable: item.available,
        },
        create: {
          cafeId: cafe.id,
          sku: item.id,
          name: item.name,
          description: item.description,
          priceInPaise: Math.round(item.price * 100),
          imageUrl: item.image,
          category: item.category,
          isAvailable: item.available,
        },
      })
    )
  );

  console.log(`Seeded ${menuItems.length} products for ${cafe.name}.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
