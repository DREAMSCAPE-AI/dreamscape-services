-- CreateEnum
CREATE TYPE "FavoriteType" AS ENUM ('FLIGHT', 'HOTEL', 'ACTIVITY', 'DESTINATION', 'BOOKING');

-- AlterTable
ALTER TABLE "user_vectors" ADD COLUMN     "lastSegmentUpdate" TIMESTAMP(3),
ADD COLUMN     "primarySegment" TEXT,
ADD COLUMN     "segmentConfidence" DOUBLE PRECISION,
ADD COLUMN     "segments" JSONB;

-- CreateTable
CREATE TABLE "favorites" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" "FavoriteType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityData" JSONB,
    "category" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "favorites_userId_created_at_idx" ON "favorites"("userId", "created_at" DESC);

-- CreateIndex
CREATE INDEX "favorites_userId_entityType_idx" ON "favorites"("userId", "entityType");

-- CreateIndex
CREATE INDEX "favorites_userId_entityId_idx" ON "favorites"("userId", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_userId_entityType_entityId_key" ON "favorites"("userId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "user_vectors_primarySegment_idx" ON "user_vectors"("primarySegment");

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
