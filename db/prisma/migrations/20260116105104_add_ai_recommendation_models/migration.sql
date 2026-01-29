-- ========================================================
-- Migration: AI Recommendation System - IA-001.1
-- Description: Add models for personalized destination recommendations
-- Date: 2026-01-16
-- ========================================================

-- CreateEnum
-- Status tracking for recommendation lifecycle
CREATE TYPE "RecommendationStatus" AS ENUM ('GENERATED', 'VIEWED', 'CLICKED', 'BOOKED', 'REJECTED', 'EXPIRED');

-- CreateTable
-- UserVector: Stores user preference vectors for ML-based scoring
-- Each user has one vector representing their travel preferences
CREATE TABLE "user_vectors" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vector" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "source" TEXT NOT NULL DEFAULT 'onboarding',
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_vectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- ItemVector: Pre-computed destination feature vectors
-- Stores characteristics of destinations for fast similarity matching
CREATE TABLE "item_vectors" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "destinationType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "coordinates" JSONB,
    "vector" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "popularityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bookingCount" INTEGER NOT NULL DEFAULT 0,
    "searchCount" INTEGER NOT NULL DEFAULT 0,
    "seasonalityData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_vectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- Recommendation: Historical record and cache of generated recommendations
-- Tracks user interactions, scoring, and feedback for continuous improvement
CREATE TABLE "recommendations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userVectorId" TEXT,
    "itemVectorId" TEXT,
    "destinationId" TEXT NOT NULL,
    "destinationName" TEXT NOT NULL,
    "destinationType" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION,
    "reasons" JSONB,
    "contextType" TEXT NOT NULL DEFAULT 'general',
    "contextData" JSONB,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'GENERATED',
    "viewedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "bookedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "userRating" INTEGER,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_vectors_userId_key" ON "user_vectors"("userId");

-- CreateIndex
CREATE INDEX "user_vectors_userId_idx" ON "user_vectors"("userId");

-- CreateIndex
CREATE INDEX "user_vectors_updatedAt_idx" ON "user_vectors"("updatedAt");

-- CreateIndex
CREATE INDEX "item_vectors_destinationType_idx" ON "item_vectors"("destinationType");

-- CreateIndex
CREATE INDEX "item_vectors_popularityScore_idx" ON "item_vectors"("popularityScore");

-- CreateIndex
CREATE INDEX "item_vectors_updatedAt_idx" ON "item_vectors"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "item_vectors_destinationId_destinationType_key" ON "item_vectors"("destinationId", "destinationType");

-- CreateIndex
CREATE INDEX "recommendations_userId_isActive_idx" ON "recommendations"("userId", "isActive");

-- CreateIndex
CREATE INDEX "recommendations_userId_status_idx" ON "recommendations"("userId", "status");

-- CreateIndex
CREATE INDEX "recommendations_destinationId_idx" ON "recommendations"("destinationId");

-- CreateIndex
CREATE INDEX "recommendations_expiresAt_idx" ON "recommendations"("expiresAt");

-- CreateIndex
CREATE INDEX "recommendations_score_idx" ON "recommendations"("score" DESC);

-- CreateIndex
CREATE INDEX "recommendations_createdAt_idx" ON "recommendations"("createdAt");

-- AddForeignKey
ALTER TABLE "user_vectors" ADD CONSTRAINT "user_vectors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_userVectorId_fkey" FOREIGN KEY ("userVectorId") REFERENCES "user_vectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_itemVectorId_fkey" FOREIGN KEY ("itemVectorId") REFERENCES "item_vectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
