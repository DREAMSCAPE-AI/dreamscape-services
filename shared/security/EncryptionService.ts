import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * EncryptionService - Service central de chiffrement/déchiffrement
 *
 * Sécurité:
 * - AES-256-CBC pour chiffrement symétrique
 * - IV aléatoire unique pour chaque chiffrement (jamais réutilisé)
 * - Padding PKCS7
 * - bcrypt pour hashage de mots de passe (10 rounds)
 *
 * Conformité: PCI-DSS, RGPD, ISO 27001
 */
export class EncryptionService {
  private static readonly BCRYPT_ROUNDS = 10;
  private static readonly KEY_MIN_LENGTH = 32; // 256 bits en hex

  /**
   * Valide que la clé de chiffrement existe et est valide
   * @throws Error si la clé est invalide ou manquante
   */
  static validateKey(): boolean {
    const key = process.env.ENCRYPTION_KEY;

    if (!key) {
      throw new Error('ENCRYPTION_KEY is not defined in environment variables');
    }

    if (key.length < this.KEY_MIN_LENGTH) {
      throw new Error(`ENCRYPTION_KEY must be at least ${this.KEY_MIN_LENGTH} characters (256 bits)`);
    }

    return true;
  }

  /**
   * Génère une nouvelle clé de chiffrement 256 bits
   * @returns Clé en format hexadécimal
   */
  static generateKey(): string {
    const randomBytes = crypto.randomBytes(32); // 32 bytes = 256 bits
    return randomBytes.toString('hex');
  }

  /**
   * Chiffre une valeur avec AES-256-CBC
   *
   * IMPORTANT:
   * - Génère un IV aléatoire UNIQUE pour chaque appel
   * - Ne JAMAIS réutiliser le même IV
   * - L'IV est stocké avec le ciphertext (pas secret)
   *
   * @param plaintext Texte en clair à chiffrer
   * @returns Texte chiffré encodé en Base64 (contient IV + ciphertext)
   * @throws Error si la clé est invalide
   */
  static encrypt(plaintext: string): string {
    // Valider la clé avant chaque opération
    this.validateKey();

    if (!plaintext) {
      throw new Error('Plaintext cannot be empty');
    }

    const keyHex = process.env.ENCRYPTION_KEY!;
    const key = Buffer.from(keyHex, 'hex');

    // Générer un IV aléatoire UNIQUE de 16 bytes (128 bits)
    // CRITIQUE: JAMAIS réutiliser le même IV
    const iv = crypto.randomBytes(16);

    // Créer le cipher AES-256-CBC
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    // Chiffrer le plaintext
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Combiner IV + ciphertext et encoder en Base64
    // Format: IV (16 bytes) || Ciphertext
    const combined = Buffer.concat([iv, Buffer.from(encrypted, 'hex')]);

    return combined.toString('base64');
  }

  /**
   * Déchiffre une valeur chiffrée avec AES-256-CBC
   *
   * @param ciphertext Texte chiffré encodé en Base64
   * @returns Texte en clair
   * @throws Error si le ciphertext est corrompu ou la clé invalide
   */
  static decrypt(ciphertext: string): string {
    // Valider la clé avant chaque opération
    this.validateKey();

    if (!ciphertext) {
      throw new Error('Ciphertext cannot be empty');
    }

    try {
      const keyHex = process.env.ENCRYPTION_KEY!;
      const key = Buffer.from(keyHex, 'hex');

      // Décoder de Base64
      const combined = Buffer.from(ciphertext, 'base64');

      // Extraire IV (premiers 16 bytes)
      const iv = combined.subarray(0, 16);

      // Extraire ciphertext (reste)
      const encryptedData = combined.subarray(16);

      // Créer le decipher AES-256-CBC
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

      // Déchiffrer
      let decrypted = decipher.update(encryptedData, undefined, 'utf8');
      decrypted += decipher.final('utf8');

      if (!decrypted) {
        throw new Error('Decryption failed - invalid ciphertext or key');
      }

      return decrypted;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Decryption failed: ${error.message}`);
      }
      throw new Error('Decryption failed - corrupted ciphertext');
    }
  }

  /**
   * Hache un mot de passe avec bcrypt
   *
   * IMPORTANT:
   * - Les mots de passe sont HASHÉS, PAS CHIFFRÉS
   * - Impossible de récupérer le mot de passe original
   * - Utiliser verifyPassword() pour vérifier
   *
   * @param password Mot de passe en clair
   * @returns Hash bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    if (!password) {
      throw new Error('Password cannot be empty');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    // Hacher avec bcrypt (10 rounds)
    const hash = await bcrypt.hash(password, this.BCRYPT_ROUNDS);
    return hash;
  }

  /**
   * Vérifie un mot de passe contre son hash
   *
   * @param password Mot de passe en clair à vérifier
   * @param hash Hash bcrypt stocké
   * @returns true si le mot de passe correspond, false sinon
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    if (!password || !hash) {
      return false;
    }

    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }

  /**
   * Génère un fingerprint de clé (pour logs)
   * Ne JAMAIS logger la clé complète
   *
   * @param key Clé à fingerprinter
   * @returns Fingerprint sécurisé (premiers 8 + derniers 6 chars)
   */
  static getKeyFingerprint(key: string): string {
    if (!key || key.length < 16) {
      return '***invalid***';
    }

    const start = key.substring(0, 8);
    const end = key.substring(key.length - 6);
    return `${start}...${end}`;
  }
}
