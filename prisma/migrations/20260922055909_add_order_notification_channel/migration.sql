-- CreateEnum
CREATE TYPE "OrderNotificationChannel" AS ENUM ('STAFF_PORTAL', 'WHATSAPP', 'BOTH');

-- AlterTable
ALTER TABLE "Cafe" ADD COLUMN     "orderNotificationChannel" "OrderNotificationChannel" NOT NULL DEFAULT 'BOTH';
