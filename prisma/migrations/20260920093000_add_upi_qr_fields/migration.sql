-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "razorpayQrId" TEXT,
ADD COLUMN     "qrExpiresAt" TIMESTAMP(3),
ADD COLUMN     "qrIssueCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Order_razorpayQrId_key" ON "Order"("razorpayQrId");
