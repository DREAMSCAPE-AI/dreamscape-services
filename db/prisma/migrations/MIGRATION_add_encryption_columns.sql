-- Migration: add_encryption_columns
-- Description: Ajout des colonnes chiffrées pour US-CORE-009
-- Date: 2025-01-15
-- Conformité: PCI-DSS, RGPD

-- =================================================================
-- TABLE: users - Ajout colonnes chiffrées
-- =================================================================
ALTER TABLE "users" ADD COLUMN "firstNameEncrypted" TEXT;
ALTER TABLE "users" ADD COLUMN "lastNameEncrypted" TEXT;
ALTER TABLE "users" ADD COLUMN "emailEncrypted" TEXT;
ALTER TABLE "users" ADD COLUMN "phoneEncrypted" TEXT;
ALTER TABLE "users" ADD COLUMN "dateOfBirthEncrypted" TEXT;
ALTER TABLE "users" ADD COLUMN "addressEncrypted" TEXT;
ALTER TABLE "users" ADD COLUMN "ssnEncrypted" TEXT;

-- Commentaires pour documentation
COMMENT ON COLUMN "users"."firstNameEncrypted" IS 'Prénom chiffré (AES-256-CBC)';
COMMENT ON COLUMN "users"."lastNameEncrypted" IS 'Nom chiffré (AES-256-CBC)';
COMMENT ON COLUMN "users"."emailEncrypted" IS 'Email chiffré pour conformité RGPD';
COMMENT ON COLUMN "users"."phoneEncrypted" IS 'Téléphone chiffré (AES-256-CBC)';
COMMENT ON COLUMN "users"."dateOfBirthEncrypted" IS 'Date de naissance chiffrée';
COMMENT ON COLUMN "users"."addressEncrypted" IS 'Adresse chiffrée';
COMMENT ON COLUMN "users"."ssnEncrypted" IS 'Numéro de sécurité sociale chiffré';

-- =================================================================
-- TABLE: booking_data - Ajout colonnes chiffrées
-- =================================================================
ALTER TABLE "booking_data" ADD COLUMN "passengerNotesEncrypted" TEXT;
ALTER TABLE "booking_data" ADD COLUMN "specialRequestsEncrypted" TEXT;

COMMENT ON COLUMN "booking_data"."passengerNotesEncrypted" IS 'Notes passagers chiffrées';
COMMENT ON COLUMN "booking_data"."specialRequestsEncrypted" IS 'Demandes spéciales chiffrées';

-- =================================================================
-- TABLE: payments - Création nouvelle table (PCI-DSS)
-- =================================================================
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookingId" TEXT,

    -- Métadonnées non-sensibles
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "method" TEXT,

    -- Données sensibles PCI-DSS (chiffrées AES-256-CBC)
    "cardNumberEncrypted" TEXT,
    "cardCVCEncrypted" TEXT,
    "cardHolderEncrypted" TEXT,
    "expiryDateEncrypted" TEXT,
    "bankAccountEncrypted" TEXT,

    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- Commentaires pour la table payments
COMMENT ON TABLE "payments" IS 'Table de paiements conforme PCI-DSS avec chiffrement AES-256';
COMMENT ON COLUMN "payments"."cardNumberEncrypted" IS 'Numéro de carte chiffré (AES-256-CBC) - PCI-DSS';
COMMENT ON COLUMN "payments"."cardCVCEncrypted" IS 'CVV/CVC chiffré (AES-256-CBC) - PCI-DSS';
COMMENT ON COLUMN "payments"."cardHolderEncrypted" IS 'Nom du titulaire chiffré';
COMMENT ON COLUMN "payments"."expiryDateEncrypted" IS 'Date d\'expiration chiffrée';
COMMENT ON COLUMN "payments"."bankAccountEncrypted" IS 'Compte bancaire chiffré';

-- =================================================================
-- INDEX pour performance
-- =================================================================
CREATE INDEX "payments_userId_idx" ON "payments"("userId");
CREATE INDEX "payments_bookingId_idx" ON "payments"("bookingId");
CREATE INDEX "payments_status_idx" ON "payments"("status");
CREATE INDEX "payments_createdAt_idx" ON "payments"("createdAt");

-- =================================================================
-- Notes de migration
-- =================================================================
-- IMPORTANT: Cette migration ajoute des colonnes chiffrées mais ne migre PAS
-- automatiquement les données existantes. Pour migrer les données:
-- 1. Déployer cette migration
-- 2. Exécuter le script de migration de données (migrate_existing_data.ts)
-- 3. Vérifier l'intégrité des données
-- 4. Optionnel: Supprimer les anciennes colonnes non-chiffrées une fois validé

-- =================================================================
-- Rollback instructions (si nécessaire)
-- =================================================================
-- DROP TABLE IF EXISTS "payments";
-- ALTER TABLE "booking_data" DROP COLUMN IF EXISTS "passengerNotesEncrypted";
-- ALTER TABLE "booking_data" DROP COLUMN IF EXISTS "specialRequestsEncrypted";
-- ALTER TABLE "users" DROP COLUMN IF EXISTS "firstNameEncrypted";
-- ALTER TABLE "users" DROP COLUMN IF EXISTS "lastNameEncrypted";
-- ALTER TABLE "users" DROP COLUMN IF EXISTS "emailEncrypted";
-- ALTER TABLE "users" DROP COLUMN IF EXISTS "phoneEncrypted";
-- ALTER TABLE "users" DROP COLUMN IF EXISTS "dateOfBirthEncrypted";
-- ALTER TABLE "users" DROP COLUMN IF EXISTS "addressEncrypted";
-- ALTER TABLE "users" DROP COLUMN IF EXISTS "ssnEncrypted";
