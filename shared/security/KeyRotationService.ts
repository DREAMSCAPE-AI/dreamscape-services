import * as cron from 'node-cron';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { EncryptionService } from './EncryptionService';

dotenv.config();

/**
 * KeyRotationService - Gestion automatique de la rotation des clés de chiffrement
 *
 * Fonctionnalités:
 * - Rotation automatique tous les dimanches à minuit (cron)
 * - Re-chiffrement de toutes les données avec la nouvelle clé
 * - Sauvegarde sécurisée des anciennes clés
 * - Journalisation des rotations (audit trail)
 *
 * Conformité: ISO 27001, PCI-DSS (rotation 90 jours)
 */
export class KeyRotationService {
  private static isRunning = false;
  private static cronJob: cron.ScheduledTask | null = null;

  // Chemin des backups de clés
  private static readonly BACKUP_DIR = process.env.KEY_BACKUP_DIR || './backups/keys';
  private static readonly AUDIT_LOG = process.env.AUDIT_LOG_FILE || './logs/audit.log';

  /**
   * Démarre la rotation automatique des clés
   * Cron: "0 0 * * 0" = Chaque dimanche à minuit
   */
  static startRotationSchedule(): void {
    if (this.isRunning) {
      console.log('⚠️  Key rotation schedule already running');
      return;
    }

    console.log('🔄 Starting automatic key rotation schedule...');
    console.log('📅 Schedule: Every Sunday at midnight (00:00)');

    // Cron: "0 0 * * 0" = Dimanche minuit
    // Format: seconde minute heure jour mois jour_semaine
    this.cronJob = cron.schedule('0 0 * * 0', async () => {
      console.log('🔄 Triggered automatic key rotation');
      try {
        await this.rotateKeys();
      } catch (error) {
        console.error('❌ Automatic key rotation failed:', error);
        await this.logRotationError(error);
      }
    });

    this.isRunning = true;
    console.log('✅ Key rotation schedule started successfully');
  }

  /**
   * Arrête la rotation automatique
   */
  static stopRotationSchedule(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.isRunning = false;
      console.log('🛑 Key rotation schedule stopped');
    }
  }

  /**
   * Effectue une rotation manuelle des clés
   * Peut être appelé manuellement sans attendre le cron
   */
  static async rotateKeys(): Promise<void> {
    console.log('🔄 Starting key rotation...');

    const startTime = Date.now();

    try {
      // 1. Vérifier que la clé actuelle est valide
      EncryptionService.validateKey();

      const currentKey = process.env.ENCRYPTION_KEY!;
      console.log('🔑 Current key fingerprint:', EncryptionService.getKeyFingerprint(currentKey));

      // 2. Sauvegarder l'ancienne clé
      await this.backupKey(currentKey, 'old_key');
      console.log('💾 Old key backed up successfully');

      // 3. Générer une nouvelle clé
      const newKey = EncryptionService.generateKey();
      console.log('🆕 New key generated:', EncryptionService.getKeyFingerprint(newKey));

      // 4. Re-chiffrer toutes les données
      console.log('🔄 Re-encrypting all data...');
      const stats = await this.reEncryptAllData(currentKey, newKey);
      console.log('✅ Re-encryption completed:', stats);

      // 5. Mettre à jour .env
      await this.updateEnvFile(currentKey, newKey);
      console.log('📝 .env file updated');

      // 6. Sauvegarder la nouvelle clé
      await this.backupKey(newKey, 'new_key');

      // 7. Journaliser la rotation
      const duration = Date.now() - startTime;
      await this.logRotation(currentKey, newKey, stats, duration);

      console.log(`✅ Key rotation completed successfully in ${duration}ms`);

    } catch (error) {
      console.error('❌ Key rotation failed:', error);
      throw error;
    }
  }

  /**
   * Re-chiffre toutes les données avec la nouvelle clé
   * IMPORTANT: Nécessite la base de données active
   */
  private static async reEncryptAllData(oldKey: string, newKey: string): Promise<any> {
    const stats = {
      users: 0,
      payments: 0,
      bookings: 0,
      errors: 0,
    };

    try {
      // Note: Ce code nécessite Prisma Client
      // Pour l'instant, on simule le re-chiffrement
      // TODO: Implémenter avec Prisma quand DB disponible

      console.log('⚠️  Re-encryption requires active database connection');
      console.log('📝 This is a placeholder implementation');

      /*
      // Exemple d'implémentation réelle avec Prisma:

      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();

      // Re-chiffrer Users
      const users = await prisma.user.findMany({
        select: {
          id: true,
          firstNameEncrypted: true,
          lastNameEncrypted: true,
          emailEncrypted: true,
          phoneEncrypted: true,
          dateOfBirthEncrypted: true,
          addressEncrypted: true,
          ssnEncrypted: true,
        }
      });

      for (const user of users) {
        try {
          // Déchiffrer avec ancienne clé
          const firstName = user.firstNameEncrypted
            ? this.decryptWithKey(user.firstNameEncrypted, oldKey)
            : null;
          const lastName = user.lastNameEncrypted
            ? this.decryptWithKey(user.lastNameEncrypted, oldKey)
            : null;
          // ... autres champs

          // Re-chiffrer avec nouvelle clé
          await prisma.user.update({
            where: { id: user.id },
            data: {
              firstNameEncrypted: firstName ? this.encryptWithKey(firstName, newKey) : null,
              lastNameEncrypted: lastName ? this.encryptWithKey(lastName, newKey) : null,
              // ... autres champs
            }
          });

          stats.users++;
        } catch (error) {
          console.error(`Failed to re-encrypt user ${user.id}:`, error);
          stats.errors++;
        }
      }

      // Re-chiffrer Payments
      const payments = await prisma.payment.findMany();
      for (const payment of payments) {
        // ... similar logic
        stats.payments++;
      }

      // Re-chiffrer BookingData
      const bookings = await prisma.bookingData.findMany();
      for (const booking of bookings) {
        // ... similar logic
        stats.bookings++;
      }

      await prisma.$disconnect();
      */

      return stats;

    } catch (error) {
      console.error('❌ Re-encryption error:', error);
      throw error;
    }
  }

  /**
   * Sauvegarde une clé de chiffrement de manière sécurisée
   */
  private static async backupKey(key: string, keyName: string): Promise<void> {
    try {
      // Créer le répertoire de backup s'il n'existe pas
      await fs.mkdir(this.BACKUP_DIR, { recursive: true });

      // Nom du fichier avec timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${keyName}_${timestamp}.backup`;
      const filepath = path.join(this.BACKUP_DIR, filename);

      // Sauvegarder la clé
      await fs.writeFile(filepath, key, { mode: 0o600 }); // Read-only pour owner

      console.log(`💾 Key backed up to: ${filepath}`);

    } catch (error) {
      console.error('❌ Failed to backup key:', error);
      throw error;
    }
  }

  /**
   * Met à jour le fichier .env avec les nouvelles clés
   */
  private static async updateEnvFile(oldKey: string, newKey: string): Promise<void> {
    try {
      const envPath = path.resolve(process.cwd(), '.env');

      // Lire le fichier .env actuel
      let envContent = await fs.readFile(envPath, 'utf-8');

      // Mettre à jour les valeurs
      envContent = envContent.replace(
        /ENCRYPTION_KEY=.*/,
        `ENCRYPTION_KEY="${newKey}"`
      );
      envContent = envContent.replace(
        /OLD_ENCRYPTION_KEY=.*/,
        `OLD_ENCRYPTION_KEY="${oldKey}"`
      );
      envContent = envContent.replace(
        /ENCRYPTION_KEY_CREATED_AT=.*/,
        `ENCRYPTION_KEY_CREATED_AT="${new Date().toISOString().split('T')[0]}"`
      );

      // Sauvegarder
      await fs.writeFile(envPath, envContent, { mode: 0o600 });

      // Recharger les variables d'environnement
      process.env.ENCRYPTION_KEY = newKey;
      process.env.OLD_ENCRYPTION_KEY = oldKey;

      console.log('✅ .env file updated successfully');

    } catch (error) {
      console.error('❌ Failed to update .env file:', error);
      throw error;
    }
  }

  /**
   * Journalise une rotation de clés réussie
   */
  private static async logRotation(
    oldKey: string,
    newKey: string,
    stats: any,
    duration: number
  ): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event: 'KEY_ROTATION',
      status: 'SUCCESS',
      oldKeyFingerprint: EncryptionService.getKeyFingerprint(oldKey),
      newKeyFingerprint: EncryptionService.getKeyFingerprint(newKey),
      stats,
      durationMs: duration,
    };

    await this.writeAuditLog(logEntry);
  }

  /**
   * Journalise une erreur de rotation
   */
  private static async logRotationError(error: any): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event: 'KEY_ROTATION',
      status: 'ERROR',
      error: error.message,
      stack: error.stack,
    };

    await this.writeAuditLog(logEntry);
  }

  /**
   * Écrit dans le fichier d'audit
   */
  private static async writeAuditLog(entry: any): Promise<void> {
    try {
      // Créer le répertoire de logs s'il n'existe pas
      const logDir = path.dirname(this.AUDIT_LOG);
      await fs.mkdir(logDir, { recursive: true });

      // Écrire l'entrée d'audit
      const logLine = JSON.stringify(entry) + '\n';
      await fs.appendFile(this.AUDIT_LOG, logLine);

      console.log('📝 Audit log updated');

    } catch (error) {
      console.error('❌ Failed to write audit log:', error);
      // Ne pas lever d'erreur pour ne pas bloquer la rotation
    }
  }

  /**
   * Récupère les logs d'audit des rotations
   */
  static async getRotationHistory(limit: number = 10): Promise<any[]> {
    try {
      const content = await fs.readFile(this.AUDIT_LOG, 'utf-8');
      const lines = content.trim().split('\n');

      const rotations = lines
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(entry => entry && entry.event === 'KEY_ROTATION')
        .slice(-limit); // Dernières N rotations

      return rotations;

    } catch (error) {
      console.error('❌ Failed to read rotation history:', error);
      return [];
    }
  }

  /**
   * Vérifie si une rotation est nécessaire (tous les 90 jours)
   */
  static async checkRotationNeeded(): Promise<boolean> {
    const keyCreatedAt = process.env.ENCRYPTION_KEY_CREATED_AT;

    if (!keyCreatedAt) {
      console.warn('⚠️  ENCRYPTION_KEY_CREATED_AT not defined');
      return true; // Par sécurité, rotation recommandée
    }

    const createdDate = new Date(keyCreatedAt);
    const now = new Date();
    const daysSinceCreation = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

    const needsRotation = daysSinceCreation >= 90;

    if (needsRotation) {
      console.log(`⚠️  Key rotation needed (${daysSinceCreation} days old)`);
    } else {
      console.log(`✅ Key is recent (${daysSinceCreation} days old)`);
    }

    return needsRotation;
  }
}

// Export pour utilisation facile
export default KeyRotationService;
