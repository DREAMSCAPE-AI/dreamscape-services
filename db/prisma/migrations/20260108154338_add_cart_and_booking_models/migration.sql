-- CreateEnum
CREATE TYPE "CartItemType" AS ENUM ('FLIGHT', 'HOTEL', 'ACTIVITY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BookingStatus" ADD VALUE 'DRAFT';
ALTER TYPE "BookingStatus" ADD VALUE 'PENDING_PAYMENT';
ALTER TYPE "BookingStatus" ADD VALUE 'FAILED';

-- AlterTable
ALTER TABLE "booking_data" ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "paymentIntentId" TEXT;

-- CreateTable
CREATE TABLE "cart_data" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "type" "CartItemType" NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemData" JSONB NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "cart_data"("id") ON DELETE CASCADE ON UPDATE CASCADE;
