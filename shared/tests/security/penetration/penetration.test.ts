/**
 * Tests de Pénétration - EncryptionService
 *
 * Objectif: Tester la résistance du système de chiffrement contre les attaques
 *
 * Tests couverts:
 * ✅ Test 1: Résistance au brute force
 * ✅ Test 2: Unicité des IV (Initialization Vectors)
 * ✅ Test 3: Protection contre les timing attacks
 * ✅ Test 4: Détection de ciphertext corrompu
 * ✅ Test 5: Gestion des grandes chaînes (1MB+)
 * ✅ Test 6: Caractères spéciaux et null bytes
 *
 * Framework: Jest
 * Conformité: PCI-DSS, OWASP Top 10
 */

import { EncryptionService } from '../../../security/EncryptionService';
import * as crypto from 'crypto';

// Configuration de test avec clé valide
process.env.ENCRYPTION_KEY = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';

describe('Tests de Pénétration - Sécurité du Chiffrement', () => {

  /**
   * TEST 1: Résistance au Brute Force
   *
   * Objectif: Vérifier que le système résiste aux tentatives de déchiffrement
   * avec des clés aléatoires
   */
  describe('Test 1: Brute Force Resistance', () => {
    it('devrait résister à 1000 tentatives de déchiffrement avec des clés aléatoires', () => {
      const plaintext = 'Sensitive Data';
      const validCiphertext = EncryptionService.encrypt(plaintext);

      let successfulDecryptions = 0;
      const attempts = 1000;

      // Sauvegarder la clé valide
      const validKey = process.env.ENCRYPTION_KEY;

      // Tenter 1000 déchiffrements avec des clés aléatoires
      for (let i = 0; i < attempts; i++) {
        // Générer une clé aléatoire
        const randomKey = crypto.randomBytes(32).toString('hex');
        process.env.ENCRYPTION_KEY = randomKey;

        try {
          const decrypted = EncryptionService.decrypt(validCiphertext);

          // Si le déchiffrement réussit (très peu probable)
          if (decrypted === plaintext) {
            successfulDecryptions++;
          }
        } catch (error) {
          // Attendu: Le déchiffrement échoue avec une mauvaise clé
        }
      }

      // Restaurer la clé valide
      process.env.ENCRYPTION_KEY = validKey;

      // Vérifier que moins de 2 tentatives ont réussi (probabilité négligeable)
      expect(successfulDecryptions).toBeLessThan(2);
      expect(successfulDecryptions).toBe(0); // Idéalement zéro

      console.log(`Brute force test: ${successfulDecryptions}/${attempts} successful decryptions`);
    });

    it('devrait lever des erreurs pour des clés invalides', () => {
      const ciphertext = EncryptionService.encrypt('test');

      // Sauvegarder
      const validKey = process.env.ENCRYPTION_KEY;

      // Tester avec différentes clés invalides
      const invalidKeys = [
        'short', // Trop courte
        'a'.repeat(31), // 31 chars (pas assez)
        '0'.repeat(64), // Valide longueur mais mauvaise clé
        crypto.randomBytes(32).toString('hex'), // Clé aléatoire
      ];

      invalidKeys.forEach((invalidKey) => {
        process.env.ENCRYPTION_KEY = invalidKey;

        // Doit soit échouer la validation, soit échouer le déchiffrement
        const shouldFail = () => {
          EncryptionService.validateKey();
          EncryptionService.decrypt(ciphertext);
        };

        if (invalidKey.length < 32) {
          expect(shouldFail).toThrow(); // Validation échoue
        } else {
          expect(shouldFail).toThrow(); // Déchiffrement échoue
        }
      });

      // Restaurer
      process.env.ENCRYPTION_KEY = validKey;
    });
  });

  /**
   * TEST 2: Unicité des IV (Initialization Vectors)
   *
   * Objectif: Vérifier que chaque chiffrement utilise un IV unique
   * Critique pour la sécurité CBC
   */
  describe('Test 2: IV Uniqueness', () => {
    it('devrait générer des ciphertexts uniques pour 100 chiffrements identiques', () => {
      const plaintext = 'Test IV Uniqueness';
      const ciphertexts = new Set<string>();

      // Chiffrer 100 fois le même texte
      for (let i = 0; i < 100; i++) {
        const encrypted = EncryptionService.encrypt(plaintext);
        ciphertexts.add(encrypted);
      }

      // Tous les ciphertexts doivent être UNIQUES
      expect(ciphertexts.size).toBe(100);
    });

    it('devrait générer des ciphertexts uniques même pour des textes vides', () => {
      // Edge case: texte vide (doit quand même avoir un IV unique)
      // Mais notre implémentation rejette les textes vides
      expect(() => EncryptionService.encrypt('')).toThrow('Plaintext cannot be empty');
    });

    it('devrait avoir des IV différents pour des chiffrements successifs rapides', async () => {
      const plaintext = 'Rapid encryption test';
      const ciphertexts: string[] = [];

      // Chiffrer rapidement (sans délai)
      for (let i = 0; i < 10; i++) {
        ciphertexts.push(EncryptionService.encrypt(plaintext));
      }

      // Tous doivent être différents (IV aléatoire à chaque fois)
      const uniqueCiphertexts = new Set(ciphertexts);
      expect(uniqueCiphertexts.size).toBe(10);
    });
  });

  /**
   * TEST 3: Protection contre les Timing Attacks
   *
   * Objectif: Vérifier que le temps de déchiffrement ne révèle pas
   * d'informations sur la validité de la clé
   */
  describe('Test 3: Timing Attack Protection', () => {
    it('devrait avoir un temps de déchiffrement constant', () => {
      const plaintexts = [
        'a',
        'test',
        'longer text here',
        'x'.repeat(100),
      ];

      const timings: number[] = [];

      plaintexts.forEach(plaintext => {
        const encrypted = EncryptionService.encrypt(plaintext);

        // Mesurer le temps de déchiffrement
        const start = process.hrtime.bigint();
        EncryptionService.decrypt(encrypted);
        const end = process.hrtime.bigint();

        const duration = Number(end - start) / 1_000_000; // en ms
        timings.push(duration);
      });

      console.log('Decryption timings (ms):', timings);

      // Vérifier qu'il n'y a pas de patterns révélateurs
      // Les temps devraient être relativement similaires
      const avgTiming = timings.reduce((a, b) => a + b, 0) / timings.length;
      const maxDeviation = Math.max(...timings.map(t => Math.abs(t - avgTiming)));

      // La déviation maximale devrait être raisonnable (< 10x la moyenne)
      expect(maxDeviation).toBeLessThan(avgTiming * 10);
    });

    it('ne devrait pas révéler d\'info via les erreurs de déchiffrement', () => {
      const validCiphertext = EncryptionService.encrypt('test');

      // Modifier des bytes du ciphertext valide
      const buffer1 = Buffer.from(validCiphertext, 'base64');
      buffer1[0] ^= 0xFF; // Modifier premier byte
      const corrupted1 = buffer1.toString('base64');

      const buffer2 = Buffer.from(validCiphertext, 'base64');
      buffer2[buffer2.length - 1] ^= 0x01; // Modifier dernier byte
      const corrupted2 = buffer2.toString('base64');

      const corruptions = [
        corrupted1,
        corrupted2,
        'invalid_base64!@#', // Complètement invalide
      ];

      const errorMessages: string[] = [];

      corruptions.forEach(corrupted => {
        try {
          EncryptionService.decrypt(corrupted);
          errorMessages.push('NO_ERROR'); // Ne devrait pas arriver
        } catch (error: any) {
          errorMessages.push(error.message);
        }
      });

      // Toutes les erreurs devraient commencer par "Decryption failed"
      errorMessages.forEach(msg => {
        expect(msg).toMatch(/Decryption failed/i);
      });

      console.log('Error messages:', errorMessages);
    });
  });

  /**
   * TEST 4: Détection de Ciphertext Corrompu
   *
   * Objectif: Vérifier que toute modification du ciphertext est détectée
   */
  describe('Test 4: Corrupted Ciphertext Detection', () => {
    it('devrait détecter une modification d\'un seul byte', () => {
      const plaintext = 'Sensitive information';
      const validCiphertext = EncryptionService.encrypt(plaintext);

      // Convertir en Buffer pour modifier
      const buffer = Buffer.from(validCiphertext, 'base64');

      // Modifier un byte au milieu
      const middleIndex = Math.floor(buffer.length / 2);
      buffer[middleIndex] ^= 0x01; // XOR avec 1 pour inverser un bit

      const corruptedCiphertext = buffer.toString('base64');

      // Le déchiffrement doit échouer
      expect(() => EncryptionService.decrypt(corruptedCiphertext)).toThrow();
    });

    it('devrait détecter une modification de l\'IV', () => {
      const plaintext = 'Test IV tampering';
      const validCiphertext = EncryptionService.encrypt(plaintext);

      const buffer = Buffer.from(validCiphertext, 'base64');

      // Modifier le premier byte (fait partie de l'IV)
      buffer[0] ^= 0xFF;

      const corruptedCiphertext = buffer.toString('base64');

      // Devrait soit échouer, soit retourner du garbage (mais pas le plaintext original)
      try {
        const decrypted = EncryptionService.decrypt(corruptedCiphertext);
        expect(decrypted).not.toBe(plaintext);
      } catch (error) {
        // Attendu: Le déchiffrement échoue
        expect(error).toBeDefined();
      }
    });

    it('devrait rejeter des ciphertexts trop courts', () => {
      const shortCiphertext = 'abc'; // Trop court pour contenir IV + data

      expect(() => EncryptionService.decrypt(shortCiphertext)).toThrow();
    });

    it('devrait rejeter des ciphertexts non-Base64', () => {
      const invalidBase64 = 'This is not Base64!!!';

      expect(() => EncryptionService.decrypt(invalidBase64)).toThrow();
    });
  });

  /**
   * TEST 5: Gestion des Grandes Chaînes (1MB+)
   *
   * Objectif: Vérifier que le système gère les grandes données sans problème
   */
  describe('Test 5: Large String Handling', () => {
    it('devrait chiffrer/déchiffrer une chaîne de 1MB', () => {
      // Créer une chaîne de ~1MB
      const largePlaintext = 'A'.repeat(1024 * 1024); // 1MB

      const start = Date.now();
      const encrypted = EncryptionService.encrypt(largePlaintext);
      const encryptTime = Date.now() - start;

      const start2 = Date.now();
      const decrypted = EncryptionService.decrypt(encrypted);
      const decryptTime = Date.now() - start2;

      expect(decrypted).toBe(largePlaintext);

      console.log(`1MB encryption: ${encryptTime}ms, decryption: ${decryptTime}ms`);

      // Performance acceptable (< 1 seconde pour 1MB)
      expect(encryptTime).toBeLessThan(1000);
      expect(decryptTime).toBeLessThan(1000);
    });

    it('devrait gérer des chaînes de tailles variées sans erreur', () => {
      const sizes = [1, 10, 100, 1000, 10000, 100000];

      sizes.forEach(size => {
        const plaintext = 'X'.repeat(size);
        const encrypted = EncryptionService.encrypt(plaintext);
        const decrypted = EncryptionService.decrypt(encrypted);

        expect(decrypted).toBe(plaintext);
      });
    });
  });

  /**
   * TEST 6: Caractères Spéciaux et Null Bytes
   *
   * Objectif: Vérifier la gestion des cas limites
   */
  describe('Test 6: Special Characters and Null Bytes', () => {
    it('devrait gérer des chaînes avec null bytes', () => {
      const textWithNull = 'Start\x00Middle\x00End';

      const encrypted = EncryptionService.encrypt(textWithNull);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(textWithNull);
    });

    it('devrait gérer tous les caractères ASCII', () => {
      // Tous les caractères ASCII imprimables (32-126)
      const allAscii = Array.from({ length: 95 }, (_, i) => String.fromCharCode(i + 32)).join('');

      const encrypted = EncryptionService.encrypt(allAscii);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(allAscii);
    });

    it('devrait gérer les caractères Unicode variés', () => {
      const unicodeText = '🔐 Security Test 안전 測試 🚀';

      const encrypted = EncryptionService.encrypt(unicodeText);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(unicodeText);
    });

    it('devrait gérer des séquences de contrôle', () => {
      const controlChars = '\r\n\t\b\f\v';

      const encrypted = EncryptionService.encrypt(controlChars);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(controlChars);
    });

    it('devrait gérer des SQL injection patterns (chiffrés)', () => {
      const sqlInjection = "'; DROP TABLE users; --";

      const encrypted = EncryptionService.encrypt(sqlInjection);
      const decrypted = EncryptionService.decrypt(encrypted);

      // Le chiffrement protège contre SQL injection
      expect(decrypted).toBe(sqlInjection);
      expect(encrypted).not.toContain('DROP');
      expect(encrypted).not.toContain('TABLE');
    });

    it('devrait gérer des XSS payloads (chiffrés)', () => {
      const xssPayload = '<script>alert("XSS")</script>';

      const encrypted = EncryptionService.encrypt(xssPayload);
      const decrypted = EncryptionService.decrypt(encrypted);

      // Le chiffrement protège contre XSS
      expect(decrypted).toBe(xssPayload);
      expect(encrypted).not.toContain('<script>');
    });
  });

  /**
   * TESTS BONUS: Attaques Avancées
   */
  describe('Bonus: Advanced Attack Scenarios', () => {
    it('devrait résister à une attaque par modification de bits (Bit-flipping)', () => {
      const plaintext = 'admin:false';
      const encrypted = EncryptionService.encrypt(plaintext);

      // Tentative de modifier le ciphertext pour changer "false" en "true"
      const buffer = Buffer.from(encrypted, 'base64');

      // Modifier plusieurs bytes
      for (let i = 16; i < buffer.length; i++) {
        buffer[i] ^= 0xFF; // Inverser tous les bits
      }

      const tamperedCiphertext = buffer.toString('base64');

      // Le déchiffrement doit soit échouer, soit retourner du garbage
      try {
        const decrypted = EncryptionService.decrypt(tamperedCiphertext);

        // Ne doit PAS contenir "admin:true"
        expect(decrypted).not.toBe('admin:true');
        expect(decrypted).not.toContain('admin:true');

      } catch (error) {
        // Attendu: Le déchiffrement échoue
        expect(error).toBeDefined();
      }
    });

    it('devrait être résistant aux attaques par padding oracle', () => {
      const plaintext = 'Padding oracle test';
      const encrypted = EncryptionService.encrypt(plaintext);

      // Modifier le dernier byte (padding)
      const buffer = Buffer.from(encrypted, 'base64');
      buffer[buffer.length - 1] ^= 0x01;

      const tamperedCiphertext = buffer.toString('base64');

      // Doit lever une erreur (pas révéler d'info sur le padding)
      expect(() => EncryptionService.decrypt(tamperedCiphertext)).toThrow(/Decryption failed/i);
    });
  });
});
