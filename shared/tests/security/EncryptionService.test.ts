/**
 * Tests Unitaires - EncryptionService
 *
 * Framework: Jest
 * Coverage: Chiffrement AES-256, hashage bcrypt, sécurité
 *
 * Tests requis (minimum 6):
 * ✅ Test 1: encrypt/decrypt round-trip
 * ✅ Test 2: IV aléatoire à chaque chiffrement
 * ✅ Test 3: Caractères spéciaux et accents
 * ✅ Test 4: Hash password
 * ✅ Test 5: Verify password
 * ✅ Test 6: Invalid ciphertext
 */

import { EncryptionService } from '../../security/EncryptionService';

// Mock de l'environnement avec une clé de test
// Clé 256 bits (32 bytes) = 64 caractères hexadécimaux (0-9, a-f)
process.env.ENCRYPTION_KEY = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';

describe('EncryptionService - Tests Unitaires', () => {

  describe('Validation de clé', () => {
    it('devrait valider une clé correcte', () => {
      expect(() => EncryptionService.validateKey()).not.toThrow();
      expect(EncryptionService.validateKey()).toBe(true);
    });

    it('devrait lever une erreur si ENCRYPTION_KEY est absente', () => {
      const originalKey = process.env.ENCRYPTION_KEY;
      delete process.env.ENCRYPTION_KEY;

      expect(() => EncryptionService.validateKey()).toThrow('ENCRYPTION_KEY is not defined');

      process.env.ENCRYPTION_KEY = originalKey;
    });

    it('devrait lever une erreur si la clé est trop courte', () => {
      const originalKey = process.env.ENCRYPTION_KEY;
      process.env.ENCRYPTION_KEY = 'toocourt';

      expect(() => EncryptionService.validateKey()).toThrow('must be at least 32 characters');

      process.env.ENCRYPTION_KEY = originalKey;
    });
  });

  describe('Génération de clé', () => {
    it('devrait générer une clé de 64 caractères hex (256 bits)', () => {
      const key = EncryptionService.generateKey();

      expect(key).toBeDefined();
      expect(key.length).toBe(64); // 32 bytes = 64 hex chars
      expect(/^[0-9a-f]{64}$/i.test(key)).toBe(true);
    });

    it('devrait générer des clés uniques', () => {
      const key1 = EncryptionService.generateKey();
      const key2 = EncryptionService.generateKey();
      const key3 = EncryptionService.generateKey();

      expect(key1).not.toBe(key2);
      expect(key2).not.toBe(key3);
      expect(key1).not.toBe(key3);
    });
  });

  describe('Test 1: Chiffrement/Déchiffrement Round-Trip', () => {
    it('devrait chiffrer puis déchiffrer pour récupérer le texte original', () => {
      const originalText = 'Jean Dupont';

      const encrypted = EncryptionService.encrypt(originalText);
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(originalText);

      const decrypted = EncryptionService.decrypt(encrypted);
      expect(decrypted).toBe(originalText);
    });

    it('devrait fonctionner avec des textes longs', () => {
      const longText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(100);

      const encrypted = EncryptionService.encrypt(longText);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(longText);
    });

    it('devrait lever une erreur si le plaintext est vide', () => {
      expect(() => EncryptionService.encrypt('')).toThrow('Plaintext cannot be empty');
    });
  });

  describe('Test 2: IV Aléatoire à Chaque Chiffrement', () => {
    it('devrait générer des ciphertexts différents pour le même plaintext (100 fois)', () => {
      const plaintext = 'Texte de test pour IV aléatoire';
      const ciphertexts = new Set<string>();

      // Chiffrer 100 fois le même texte
      for (let i = 0; i < 100; i++) {
        const encrypted = EncryptionService.encrypt(plaintext);
        ciphertexts.add(encrypted);
      }

      // Tous les ciphertexts doivent être UNIQUES (IV différent à chaque fois)
      expect(ciphertexts.size).toBe(100);
    });

    it('devrait déchiffrer correctement tous les ciphertexts avec IV différents', () => {
      const plaintext = 'Test IV unique';

      for (let i = 0; i < 10; i++) {
        const encrypted = EncryptionService.encrypt(plaintext);
        const decrypted = EncryptionService.decrypt(encrypted);
        expect(decrypted).toBe(plaintext);
      }
    });
  });

  describe('Test 3: Caractères Spéciaux et Accents', () => {
    it('devrait gérer les accents et caractères spéciaux', () => {
      const specialText = 'François Müller-Noël 🎉';

      const encrypted = EncryptionService.encrypt(specialText);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(specialText);
    });

    it('devrait gérer les caractères Unicode variés', () => {
      const unicodeText = 'Héllo Wørld! 你好 مرحبا 🌍🚀✨';

      const encrypted = EncryptionService.encrypt(unicodeText);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(unicodeText);
    });

    it('devrait gérer les retours à la ligne et tabulations', () => {
      const formattedText = 'Line 1\nLine 2\tTabbed\rCarriage Return';

      const encrypted = EncryptionService.encrypt(formattedText);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(formattedText);
    });

    it('devrait gérer les caractères JSON', () => {
      const jsonText = '{"name": "Jean", "age": 30, "city": "Paris"}';

      const encrypted = EncryptionService.encrypt(jsonText);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(jsonText);
    });
  });

  describe('Test 4: Hash Password', () => {
    it('devrait hacher un mot de passe avec bcrypt', async () => {
      const password = 'MyPassword123!';

      const hash = await EncryptionService.hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50); // bcrypt hash ~60 chars
      expect(hash.startsWith('$2a$') || hash.startsWith('$2b$')).toBe(true); // bcrypt format
    });

    it('devrait générer des hashes différents pour le même mot de passe (salt aléatoire)', async () => {
      const password = 'TestPassword456';

      const hash1 = await EncryptionService.hashPassword(password);
      const hash2 = await EncryptionService.hashPassword(password);

      expect(hash1).not.toBe(hash2); // Salt différent
    });

    it('devrait lever une erreur si le mot de passe est vide', async () => {
      await expect(EncryptionService.hashPassword('')).rejects.toThrow('Password cannot be empty');
    });

    it('devrait lever une erreur si le mot de passe est trop court', async () => {
      await expect(EncryptionService.hashPassword('short')).rejects.toThrow('at least 8 characters');
    });
  });

  describe('Test 5: Verify Password', () => {
    it('devrait vérifier correctement un mot de passe valide', async () => {
      const password = 'CorrectPassword789!';
      const hash = await EncryptionService.hashPassword(password);

      const isValid = await EncryptionService.verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('devrait rejeter un mot de passe incorrect', async () => {
      const correctPassword = 'CorrectPassword789!';
      const wrongPassword = 'WrongPassword123!';
      const hash = await EncryptionService.hashPassword(correctPassword);

      const isValid = await EncryptionService.verifyPassword(wrongPassword, hash);

      expect(isValid).toBe(false);
    });

    it('devrait retourner false si le password est vide', async () => {
      const hash = await EncryptionService.hashPassword('ValidPassword123!');

      const isValid = await EncryptionService.verifyPassword('', hash);

      expect(isValid).toBe(false);
    });

    it('devrait retourner false si le hash est vide', async () => {
      const isValid = await EncryptionService.verifyPassword('Password123!', '');

      expect(isValid).toBe(false);
    });
  });

  describe('Test 6: Invalid Ciphertext', () => {
    it('devrait lever une erreur avec un ciphertext corrompu', () => {
      const validCiphertext = EncryptionService.encrypt('Valid text');
      const corruptedCiphertext = validCiphertext.substring(0, validCiphertext.length - 5) + 'XXXXX';

      expect(() => EncryptionService.decrypt(corruptedCiphertext)).toThrow('Decryption failed');
    });

    it('devrait lever une erreur avec un ciphertext invalide (non-Base64)', () => {
      const invalidCiphertext = 'This is not a valid base64 encrypted string!!!';

      expect(() => EncryptionService.decrypt(invalidCiphertext)).toThrow();
    });

    it('devrait lever une erreur avec un ciphertext vide', () => {
      expect(() => EncryptionService.decrypt('')).toThrow('Ciphertext cannot be empty');
    });

    it('devrait lever une erreur si le ciphertext est trop court', () => {
      const shortCiphertext = 'abc';

      expect(() => EncryptionService.decrypt(shortCiphertext)).toThrow();
    });
  });

  describe('Key Fingerprint', () => {
    it('devrait générer un fingerprint sécurisé (premiers 8 + derniers 6 chars)', () => {
      const key = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';

      const fingerprint = EncryptionService.getKeyFingerprint(key);

      expect(fingerprint).toBe('a1b2c3d4...f0a1b2');
      expect(fingerprint.length).toBe(17); // 8 + 3 + 6 = 17
    });

    it('devrait retourner "***invalid***" pour une clé invalide', () => {
      expect(EncryptionService.getKeyFingerprint('')).toBe('***invalid***');
      expect(EncryptionService.getKeyFingerprint('short')).toBe('***invalid***');
    });
  });

  describe('Sécurité - Tests Additionnels', () => {
    it('devrait résister aux attaques par modification de ciphertext', () => {
      const plaintext = 'Sensitive Data';
      const encrypted = EncryptionService.encrypt(plaintext);

      // Modifier un byte du ciphertext
      const bytes = Buffer.from(encrypted, 'base64');
      bytes[bytes.length - 1] ^= 0x01; // XOR avec 1 pour modifier
      const modifiedCiphertext = bytes.toString('base64');

      expect(() => EncryptionService.decrypt(modifiedCiphertext)).toThrow();
    });

    it('devrait gérer des chaînes avec null bytes', () => {
      const textWithNull = 'Text\x00With\x00Null\x00Bytes';

      const encrypted = EncryptionService.encrypt(textWithNull);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(textWithNull);
    });
  });
});
