-- CreateTable
CREATE TABLE "popular_destinations" (
    "id" SERIAL NOT NULL,
    "iataCode" TEXT NOT NULL,
    "cityName" TEXT NOT NULL,
    "countryName" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "searchCount" INTEGER NOT NULL DEFAULT 0,
    "bookingCount" INTEGER NOT NULL DEFAULT 0,
    "averagePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "peakSeason" INTEGER[],
    "offSeason" INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "popular_destinations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "popular_destinations_iataCode_key" ON "popular_destinations"("iataCode");
