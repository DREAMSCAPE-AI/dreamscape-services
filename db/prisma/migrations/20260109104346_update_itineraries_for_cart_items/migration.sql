/*
  Warnings:

  - You are about to drop the column `details` on the `itinerary_items` table. All the data in the column will be lost.
  - Added the required column `itemData` to the `itinerary_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `price` to the `itinerary_items` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "itinerary_items" DROP COLUMN "details",
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "itemData" JSONB NOT NULL,
ADD COLUMN     "itemId" TEXT,
ADD COLUMN     "price" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1;
