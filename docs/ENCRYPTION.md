# Documentation - Chiffrement des Données Sensibles

**Ticket:** US-CORE-009
**Version:** 1.0
**Date:** 2025-01-15
**Conformité:** PCI-DSS Level 1, RGPD, ISO 27001

---

## Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture du chiffrement](#architecture-du-chiffrement)
3. [EncryptionService - API](#encryptionservice---api)
4. [Flux de données](#flux-de-données)
5. [Intégration dans les contrôleurs](#intégration-dans-les-contrôleurs)
6. [Gestion des clés](#gestion-des-clés)
7. [Sécurité et bonnes pratiques](#sécurité-et-bonnes-pratiques)
8. [Troubleshooting](#troubleshooting)

---

## Vue d'ensemble

### Objectif

Protéger les données personnelles et financières des utilisateurs conformément aux standards :
- **PCI-DSS Level 1** : Données de paiement (cartes bancaires)
- **RGPD** : Données personnelles identifiables (PII)
- **ISO 27001** : Gestion sécurisée des clés

### Algorithmes utilisés

| Type de données | Algorithme | Clé | Utilisation |
|----------------|-----------|-----|-------------|
| **Données personnelles** | AES-256-CBC | 256 bits | Chiffrement réversible |
| **Mots de passe** | bcrypt | 10 rounds | Hashage irréversible |

### Données chiffrées

**User (RGPD)**
- ✅ Prénom/Nom
- ✅ Email (chiffré)
- ✅ Téléphone
- ✅ Date de naissance
- ✅ Adresse
- ✅ Numéro de sécurité sociale

**Payment (PCI-DSS)**
- ✅ Numéro de carte
- ✅ CVV/CVC
- ✅ Nom du titulaire
- ✅ Date d'expiration
- ✅ Compte bancaire

**Booking**
- ✅ Notes passagers sensibles
- ✅ Demandes spéciales

---

## Architecture du chiffrement

```
┌─────────────────────────────────────────────────────────────┐
│                    Client (Frontend)                         │
│                 Données en clair (plaintext)                 │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  API Gateway / Controller                    │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │        EncryptionService.encrypt(plaintext)            │ │
│  │                                                        │ │
│  │  1. Valider ENCRYPTION_KEY                            │ │
│  │  2. Générer IV aléatoire (16 bytes)                   │ │
│  │  3. Chiffrer avec AES-256-CBC                         │ │
│  │  4. Combiner IV + Ciphertext                          │ │
│  │  5. Encoder en Base64                                 │ │
│  └────────────────────────────────────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Database (PostgreSQL)                       │
│            Données chiffrées stockées en Base64              │
│         (Impossible à lire sans la clé de chiffrement)       │
└─────────────────────────────────────────────────────────────┘
```

### Format de stockage

```
Ciphertext stocké en DB (Base64):
┌──────────────────┬──────────────────────────┐
│   IV (16 bytes)  │   Encrypted Data         │
│   Aléatoire      │   Variable length        │
└──────────────────┴──────────────────────────┘
         ↓
  Base64 Encode
         ↓
  "SGVsbG8gV29ybGQh..." (stocké en DB)
```

---

## EncryptionService - API

### Import

```typescript
import { EncryptionService } from '@dreamscape/shared/security';
```

### Méthodes principales

#### 1. `encrypt(plaintext: string): string`

Chiffre une donnée sensible.

```typescript
const encrypted = EncryptionService.encrypt("Jean Dupont");
// → "SGVsbG8gV29ybGQh..." (Base64)
```

**Caractéristiques:**
- ✅ IV aléatoire unique à chaque appel
- ✅ AES-256-CBC
- ✅ Padding PKCS7
- ✅ Output: Base64

#### 2. `decrypt(ciphertext: string): string`

Déchiffre une donnée chiffrée.

```typescript
const decrypted = EncryptionService.decrypt("SGVsbG8gV29ybGQh...");
// → "Jean Dupont"
```

**Gestion d'erreurs:**
- ❌ Lève une exception si le ciphertext est corrompu
- ❌ Lève une exception si la clé est invalide

#### 3. `hashPassword(password: string): Promise<string>`

Hache un mot de passe avec bcrypt.

```typescript
const hash = await EncryptionService.hashPassword("MyPassword123!");
// → "$2b$10$..." (hash bcrypt)
```

**⚠️ IMPORTANT:**
- Les mots de passe sont **HASHÉS**, PAS chiffrés
- Impossible de récupérer le mot de passe original
- Utiliser `verifyPassword()` pour vérifier

#### 4. `verifyPassword(password: string, hash: string): Promise<boolean>`

Vérifie un mot de passe contre son hash.

```typescript
const isValid = await EncryptionService.verifyPassword("MyPassword123!", hash);
// → true ou false
```

#### 5. `generateKey(): string`

Génère une nouvelle clé 256 bits.

```typescript
const newKey = EncryptionService.generateKey();
// → "a1b2c3d4e5f6..." (64 caractères hex)
```

#### 6. `validateKey(): boolean`

Valide la clé de chiffrement.

```typescript
EncryptionService.validateKey(); // Lève une erreur si invalide
```

---

## Flux de données

### CRÉATION (CREATE)

```typescript
// 1. Recevoir les données du client
const { firstName, lastName, email, password } = req.body;

// 2. Hacher le mot de passe
const passwordHash = await EncryptionService.hashPassword(password);

// 3. Chiffrer les données sensibles
const firstNameEncrypted = EncryptionService.encrypt(firstName);
const lastNameEncrypted = EncryptionService.encrypt(lastName);
const emailEncrypted = EncryptionService.encrypt(email);

// 4. Sauvegarder en DB
await prisma.user.create({
  data: {
    email,
    password: passwordHash,
    firstNameEncrypted,
    lastNameEncrypted,
    emailEncrypted,
  }
});

// 5. Retourner les données déchiffrées au client
res.json({
  firstName: EncryptionService.decrypt(firstNameEncrypted),
  lastName: EncryptionService.decrypt(lastNameEncrypted),
  email: EncryptionService.decrypt(emailEncrypted),
});
```

### LECTURE (READ)

```typescript
// 1. Récupérer de la DB
const user = await prisma.user.findUnique({
  where: { id },
  select: {
    id: true,
    firstNameEncrypted: true,
    lastNameEncrypted: true,
    emailEncrypted: true,
  }
});

// 2. Déchiffrer avant de retourner
res.json({
  id: user.id,
  firstName: EncryptionService.decrypt(user.firstNameEncrypted),
  lastName: EncryptionService.decrypt(user.lastNameEncrypted),
  email: EncryptionService.decrypt(user.emailEncrypted),
});
```

### MISE À JOUR (UPDATE)

```typescript
// 1. Chiffrer les nouvelles données
const phoneEncrypted = EncryptionService.encrypt(newPhone);

// 2. Mettre à jour en DB
await prisma.user.update({
  where: { id },
  data: { phoneEncrypted }
});
```

### CONNEXION (LOGIN)

```typescript
// 1. Récupérer l'utilisateur
const user = await prisma.user.findUnique({
  where: { email },
  select: { password: true }
});

// 2. Vérifier le mot de passe
const isValid = await EncryptionService.verifyPassword(
  inputPassword,
  user.password
);

if (!isValid) {
  return res.status(401).json({ error: 'Invalid credentials' });
}
```

---

## Intégration dans les contrôleurs

### UserController (auth/user services)

```typescript
import { EncryptionService } from '@dreamscape/shared/security';

export class UserController {
  async create(req: Request, res: Response) {
    const { firstName, password } = req.body;

    // Hash password
    const passwordHash = await EncryptionService.hashPassword(password);

    // Encrypt PII
    const firstNameEncrypted = EncryptionService.encrypt(firstName);

    // Save to DB...
  }
}
```

### PaymentController (payment service)

```typescript
import { EncryptionService } from '@dreamscape/shared/security';

export class PaymentController {
  async create(req: Request, res: Response) {
    const { cardNumber, cardCVC } = req.body;

    // Encrypt PCI-DSS data
    const cardNumberEncrypted = EncryptionService.encrypt(cardNumber);
    const cardCVCEncrypted = EncryptionService.encrypt(cardCVC);

    // Save to DB...

    // ⚠️ NE JAMAIS retourner les données de carte déchiffrées
    res.json({
      cardLast4: cardNumber.slice(-4) // Seulement les 4 derniers chiffres
    });
  }
}
```

---

## Gestion des clés

### Configuration initiale

**Fichier `.env`:**
```bash
# Clé de chiffrement 256 bits (64 caractères hex)
ENCRYPTION_KEY="a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2"

# Ancienne clé (pour rotation)
OLD_ENCRYPTION_KEY=""

# Date de création de la clé
ENCRYPTION_KEY_CREATED_AT="2025-01-15"
```

### Générer une nouvelle clé

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Ou en TypeScript:
```typescript
const newKey = EncryptionService.generateKey();
console.log(newKey);
```

### Rotation des clés

**Fréquence:** Tous les 90 jours (automatique avec KeyRotationService)

**Processus:**
1. Sauvegarder `ENCRYPTION_KEY` → `OLD_ENCRYPTION_KEY`
2. Générer nouvelle clé → `ENCRYPTION_KEY`
3. Re-chiffrer toutes les données avec la nouvelle clé
4. Supprimer `OLD_ENCRYPTION_KEY` après validation

---

## Sécurité et bonnes pratiques

### ✅ À FAIRE

1. **Toujours valider la clé** avant chaque opération
   ```typescript
   EncryptionService.validateKey(); // Au démarrage de l'app
   ```

2. **Ne JAMAIS logger les données sensibles**
   ```typescript
   // ❌ BAD
   console.log('User data:', firstName);

   // ✅ GOOD
   console.log('User created:', userId);
   ```

3. **Ne JAMAIS logger la clé de chiffrement**
   ```typescript
   // ❌ BAD
   console.log('Key:', process.env.ENCRYPTION_KEY);

   // ✅ GOOD
   const fingerprint = EncryptionService.getKeyFingerprint(key);
   console.log('Key fingerprint:', fingerprint); // "a1b2c3d4...f0a1b2"
   ```

4. **Toujours chiffrer AVANT d'enregistrer**
   ```typescript
   // ✅ GOOD
   const encrypted = EncryptionService.encrypt(data);
   await prisma.user.create({ data: { encrypted } });
   ```

5. **Toujours déchiffrer AVANT de retourner**
   ```typescript
   // ✅ GOOD
   const decrypted = EncryptionService.decrypt(user.encrypted);
   res.json({ data: decrypted });
   ```

### ❌ À NE PAS FAIRE

1. **Ne PAS chiffrer les mots de passe** (les hacher uniquement)
   ```typescript
   // ❌ BAD
   const encrypted = EncryptionService.encrypt(password);

   // ✅ GOOD
   const hash = await EncryptionService.hashPassword(password);
   ```

2. **Ne PAS stocker la clé dans le code**
   ```typescript
   // ❌ BAD
   const key = "a1b2c3d4..."; // Hard-coded

   // ✅ GOOD
   const key = process.env.ENCRYPTION_KEY; // Environment variable
   ```

3. **Ne PAS réutiliser le même IV**
   ```typescript
   // ✅ EncryptionService génère automatiquement un IV unique
   ```

4. **Ne PAS retourner les données de paiement déchiffrées**
   ```typescript
   // ❌ BAD
   res.json({ cardNumber: decrypted });

   // ✅ GOOD
   res.json({ cardLast4: cardNumber.slice(-4) });
   ```

---

## Troubleshooting

### Erreur: "ENCRYPTION_KEY is not defined"

**Solution:**
```bash
# Créer le fichier .env
ENCRYPTION_KEY="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
```

### Erreur: "Decryption failed"

**Causes possibles:**
1. Ciphertext corrompu
2. Mauvaise clé de chiffrement
3. Données migrées avec une ancienne clé

**Solution:**
```typescript
try {
  const decrypted = EncryptionService.decrypt(ciphertext);
} catch (error) {
  console.error('Decryption failed:', error.message);
  // Essayer avec OLD_ENCRYPTION_KEY si disponible
}
```

### Erreur: "Password must be at least 8 characters"

**Solution:**
Valider le mot de passe côté client avant d'envoyer à l'API.

### Performance: Déchiffrement lent pour de grandes listes

**Solution:**
Utiliser la pagination et déchiffrer seulement les champs nécessaires.

```typescript
// ✅ GOOD
const users = await prisma.user.findMany({
  select: {
    id: true,
    emailEncrypted: true, // Seulement les champs nécessaires
  },
  take: 10, // Pagination
});
```

---

## Conformité

### PCI-DSS Level 1

✅ Chiffrement AES-256 des données de carte
✅ Clés de 256 bits minimum
✅ Rotation des clés tous les 90 jours
✅ Logs d'audit des opérations sensibles
✅ Pas de stockage du CVV en clair

### RGPD

✅ Chiffrement des données personnelles
✅ Pseudonymisation possible
✅ Droit à l'effacement (suppression des données chiffrées)
✅ Journalisation des accès

### ISO 27001

✅ Gestion sécurisée des clés
✅ Procédures de rotation
✅ Backups sécurisés
✅ Plan de récupération d'urgence

---

## Support

**Documentation complète:** `/docs`
**Tests:** `npm run test:security`
**Issues:** [GitHub Issues](https://github.com/dreamscape/issues)

**Contact sécurité:** security@dreamscape.com
