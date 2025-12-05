-- CreateEnum
CREATE TYPE "TravelType" AS ENUM ('ADVENTURE', 'CULTURAL', 'RELAXATION', 'BUSINESS', 'FAMILY', 'ROMANTIC', 'WELLNESS', 'EDUCATIONAL', 'CULINARY', 'SHOPPING', 'NIGHTLIFE', 'NATURE', 'URBAN', 'BEACH', 'MOUNTAIN', 'HISTORICAL');

-- CreateEnum
CREATE TYPE "TravelStyle" AS ENUM ('PLANNED', 'SPONTANEOUS', 'MIXED');

-- CreateEnum
CREATE TYPE "ComfortLevel" AS ENUM ('BASIC', 'STANDARD', 'PREMIUM', 'LUXURY');

-- CreateEnum
CREATE TYPE "BudgetFlexibility" AS ENUM ('STRICT', 'FLEXIBLE', 'VERY_FLEXIBLE');

-- CreateEnum
CREATE TYPE "DateFlexibility" AS ENUM ('FLEXIBLE', 'SEMI_FLEXIBLE', 'FIXED');

-- CreateEnum
CREATE TYPE "ActivityLevel" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'VERY_HIGH');

-- CreateEnum
CREATE TYPE "RiskTolerance" AS ENUM ('CONSERVATIVE', 'MODERATE', 'ADVENTUROUS');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "user_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'English',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "dealAlerts" BOOLEAN NOT NULL DEFAULT true,
    "tripReminders" BOOLEAN NOT NULL DEFAULT true,
    "priceAlerts" BOOLEAN NOT NULL DEFAULT true,
    "newsletter" BOOLEAN NOT NULL DEFAULT false,
    "profileVisibility" TEXT NOT NULL DEFAULT 'public',
    "dataSharing" BOOLEAN NOT NULL DEFAULT false,
    "marketing" BOOLEAN NOT NULL DEFAULT true,
    "preferredDestinations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "accommodationType" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "activities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dietary" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "travel_onboarding_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedSteps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "completedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "preferredDestinations" JSONB,
    "travelStyle" "TravelStyle",
    "globalBudgetRange" JSONB,
    "budgetByCategory" JSONB,
    "budgetFlexibility" "BudgetFlexibility",
    "travelTypes" "TravelType"[] DEFAULT ARRAY[]::"TravelType"[],
    "travelPurposes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredSeasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredTripDuration" JSONB,
    "dateFlexibility" "DateFlexibility",
    "accommodationTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "accommodationLevel" "ComfortLevel",
    "roomPreferences" JSONB,
    "preferredAirlines" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cabinClassPreference" TEXT,
    "transportModes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "transportBudgetShare" DOUBLE PRECISION,
    "activityTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "interestCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "activityLevel" "ActivityLevel",
    "travelGroupTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "groupSize" JSONB,
    "travelWithChildren" BOOLEAN NOT NULL DEFAULT false,
    "childrenAges" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "dietaryRequirements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "accessibilityNeeds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "healthConsiderations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "languageBarriers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "culturalConsiderations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "comfortLevel" "ComfortLevel",
    "serviceLevel" TEXT,
    "privacyPreference" TEXT,
    "climatePreferences" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "weatherTolerances" JSONB,
    "experienceLevel" TEXT,
    "riskTolerance" "RiskTolerance",
    "culturalImmersion" TEXT,
    "loyaltyPrograms" JSONB,
    "paymentPreferences" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "travel_onboarding_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_userId_key" ON "user_settings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "travel_onboarding_profiles_userId_key" ON "travel_onboarding_profiles"("userId");

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_onboarding_profiles" ADD CONSTRAINT "travel_onboarding_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
