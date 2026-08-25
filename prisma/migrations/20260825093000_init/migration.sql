-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'STAFF');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Cafe" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Cafe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'OWNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priceInPaise" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "category" TEXT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "tableNumber" TEXT,
    "notes" TEXT,
    "subtotalInPaise" INTEGER NOT NULL,
    "taxInPaise" INTEGER NOT NULL DEFAULT 0,
    "totalInPaise" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "unitPriceInPaise" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    "customerId" TEXT,
    "orderId" TEXT,
    "rating" INTEGER,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cafe_slug_key" ON "Cafe"("slug");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_cafeId_idx" ON "User"("cafeId");
CREATE INDEX "Customer_cafeId_createdAt_idx" ON "Customer"("cafeId", "createdAt");
CREATE UNIQUE INDEX "Customer_cafeId_phone_key" ON "Customer"("cafeId", "phone");
CREATE INDEX "Product_cafeId_isAvailable_idx" ON "Product"("cafeId", "isAvailable");
CREATE UNIQUE INDEX "Product_cafeId_sku_key" ON "Product"("cafeId", "sku");
CREATE INDEX "Order_cafeId_createdAt_idx" ON "Order"("cafeId", "createdAt");
CREATE INDEX "Order_customerId_createdAt_idx" ON "Order"("customerId", "createdAt");
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");
CREATE INDEX "Feedback_cafeId_createdAt_idx" ON "Feedback"("cafeId", "createdAt");
CREATE INDEX "Feedback_customerId_idx" ON "Feedback"("customerId");
CREATE INDEX "Feedback_orderId_idx" ON "Feedback"("orderId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
