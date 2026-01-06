# Procédure de Récupération d'Urgence des Clés de Chiffrement

**Document:** EMERGENCY_KEY_RECOVERY
**Version:** 1.0
**Date:** 2025-01-15
**Classification:** 🔴 CONFIDENTIEL - ACCÈS RESTREINT

---

## ⚠️ ATTENTION

Cette procédure doit être utilisée **UNIQUEMENT** dans les situations suivantes :
- ✅ Clé de chiffrement compromise
- ✅ Clé de chiffrement perdue
- ✅ Suspicion d'accès non autorisé
- ✅ Audit de sécurité nécessitant une rotation immédiate

**Ne PAS utiliser cette procédure pour des rotations planifiées** (utiliser KeyRotationService)

---

## Table des Matières

1. [Scénarios d'urgence](#scénarios-durgence)
2. [Procédure Étape par Étape](#procédure-étape-par-étape)
3. [Rollback](#rollback)
4. [Vérification Post-Récupération](#vérification-post-récupération)
5. [Communication](#communication)
6. [Contacts d'Urgence](#contacts-durgence)

---

## Scénarios d'urgence

### Scénario 1: Clé Compromise

**Indicateurs:**
- Accès non autorisé détecté dans les logs
- Fuite de la clé dans les logs ou le code source
- Attaque par force brute suspectée

**Gravité:** 🔴 CRITIQUE
**Action:** Rotation IMMÉDIATE

---

### Scénario 2: Clé Perdue

**Indicateurs:**
- Fichier .env supprimé accidentellement
- Variable ENCRYPTION_KEY vide ou invalide
- Backup de clé introuvable

**Gravité:** 🟠 HAUTE
**Action:** Restauration depuis backup

---

### Scénario 3: Corruption de Données

**Indicateurs:**
- Déchiffrement échoue pour plusieurs enregistrements
- Erreur "Decryption failed" répétée
- Données corrompues en base

**Gravité:** 🟡 MOYENNE
**Action:** Investigation puis restauration

---

## Procédure Étape par Étape

### PHASE 1: ARRÊT D'URGENCE (0-5 min)

#### Étape 1.1: Arrêter les Services Immédiatement

```bash
# Production (avec Docker)
docker-compose down

# ou si services individuels
systemctl stop dreamscape-auth
systemctl stop dreamscape-user
systemctl stop dreamscape-payment
systemctl stop dreamscape-voyage
```

**✅ Vérification:**
```bash
docker ps | grep dreamscape
# Résultat attendu: Aucun conteneur en cours d'exécution
```

#### Étape 1.2: Isoler la Base de Données

```bash
# Bloquer les connexions externes
sudo ufw deny from any to any port 5432

# Créer un snapshot immédiat
pg_dump dreamscape_prod > /backup/emergency_$(date +%Y%m%d_%H%M%S).sql
```

**⏱️ Temps estimé:** 2-5 minutes

---

### PHASE 2: DIAGNOSTIC (5-15 min)

#### Étape 2.1: Identifier la Cause

```bash
# Vérifier les logs système
tail -n 100 /var/log/dreamscape/app.log | grep -i "encryption\|decrypt\|error"

# Vérifier les logs d'audit
tail -n 100 /var/log/dreamscape/audit.log

# Vérifier l'intégrité de .env
cat .env | grep ENCRYPTION_KEY
```

#### Étape 2.2: Vérifier les Backups de Clés

```bash
# Lister les backups disponibles
ls -lah /secure/backups/keys/

# Exemple de sortie:
# -rw------- 1 root root  64 Jan 15 00:00 old_key_2025-01-15T00-00-00.backup
# -rw------- 1 root root  64 Jan 08 00:00 old_key_2025-01-08T00-00-00.backup
```

**📝 Noter:**
- Date du dernier backup
- Taille des fichiers (doit être 64 bytes = 64 chars hex)
- Permissions (doit être 600)

---

### PHASE 3: RESTAURATION (15-30 min)

#### Scénario A: Restaurer depuis Backup

**Situation:** La clé est perdue mais un backup existe

```bash
# 1. Copier le backup le plus récent
sudo cp /secure/backups/keys/old_key_LATEST.backup /tmp/key_restore.txt
sudo chmod 600 /tmp/key_restore.txt

# 2. Lire la clé
BACKUP_KEY=$(cat /tmp/key_restore.txt)
echo "Key fingerprint: ${BACKUP_KEY:0:8}...${BACKUP_KEY: -6}"

# 3. Mettre à jour .env
cd /app/dreamscape-services
sed -i "s/ENCRYPTION_KEY=.*/ENCRYPTION_KEY=\"$BACKUP_KEY\"/" .env

# 4. Nettoyer
sudo rm /tmp/key_restore.txt
```

**✅ Vérification:**
```bash
# Tester le déchiffrement avec un enregistrement
node -e "
  require('dotenv').config();
  const { EncryptionService } = require('./shared/security/EncryptionService');

  // Récupérer un ciphertext de test depuis la DB
  const testCiphertext = 'SGVsbG8gV29ybGQh...'; // À remplacer

  try {
    const decrypted = EncryptionService.decrypt(testCiphertext);
    console.log('✅ Decryption successful');
  } catch (error) {
    console.error('❌ Decryption failed:', error.message);
  }
"
```

---

#### Scénario B: Rotation d'Urgence (Clé Compromise)

**Situation:** La clé actuelle est compromise et doit être changée

```bash
# 1. Générer une nouvelle clé
NEW_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo "New key fingerprint: ${NEW_KEY:0:8}...${NEW_KEY: -6}"

# 2. Sauvegarder l'ancienne clé
CURRENT_KEY=$(grep ENCRYPTION_KEY .env | cut -d'=' -f2 | tr -d '"')
echo "$CURRENT_KEY" > /secure/backups/keys/compromised_key_$(date +%Y%m%d_%H%M%S).backup
chmod 600 /secure/backups/keys/compromised_key_*.backup

# 3. Mettre à jour .env
sed -i "s/ENCRYPTION_KEY=.*/ENCRYPTION_KEY=\"$NEW_KEY\"/" .env
sed -i "s/OLD_ENCRYPTION_KEY=.*/OLD_ENCRYPTION_KEY=\"$CURRENT_KEY\"/" .env
sed -i "s/ENCRYPTION_KEY_CREATED_AT=.*/ENCRYPTION_KEY_CREATED_AT=\"$(date +%Y-%m-%d)\"/" .env

# 4. Re-chiffrer TOUTES les données (CRITIQUE)
cd /app/dreamscape-services/shared
npm run rotate-keys-emergency
```

**⚠️ IMPORTANT:** Le re-chiffrement peut prendre plusieurs heures selon le volume de données

---

### PHASE 4: REDÉMARRAGE (30-40 min)

#### Étape 4.1: Tests de Validation

```bash
# Test 1: Valider la configuration
node -e "
  require('dotenv').config();
  const { EncryptionService } = require('./shared/security/EncryptionService');

  try {
    EncryptionService.validateKey();
    console.log('✅ Key validation passed');
  } catch (error) {
    console.error('❌ Key validation failed:', error.message);
    process.exit(1);
  }
"

# Test 2: Test de chiffrement/déchiffrement
node -e "
  const { EncryptionService } = require('./shared/security/EncryptionService');

  const plaintext = 'Test Emergency Recovery';
  const encrypted = EncryptionService.encrypt(plaintext);
  const decrypted = EncryptionService.decrypt(encrypted);

  if (decrypted === plaintext) {
    console.log('✅ Encryption/Decryption test passed');
  } else {
    console.error('❌ Test failed');
    process.exit(1);
  }
"

# Test 3: Test de connexion DB
npx prisma migrate status
```

#### Étape 4.2: Redémarrer les Services en Mode Sécurisé

```bash
# 1. Redémarrer en staging d'abord (validation)
docker-compose -f docker-compose.staging.yml up -d

# 2. Vérifier les logs
docker-compose logs -f --tail=100 | grep -i "error\|encryption"

# 3. Tester les endpoints critiques
curl -X POST http://localhost:3001/health
curl -X POST http://localhost:3001/api/auth/test-encryption

# 4. Si OK, redémarrer en production
docker-compose -f docker-compose.prod.yml up -d
```

#### Étape 4.3: Réactiver l'Accès Base de Données

```bash
# Retirer le blocage réseau
sudo ufw delete deny from any to any port 5432
sudo ufw allow from 10.0.0.0/8 to any port 5432
```

---

## Rollback

### Si la Restauration Échoue

#### Option 1: Restaurer le Backup Complet

```bash
# 1. Arrêter les services
docker-compose down

# 2. Restaurer la DB depuis le backup d'urgence
psql dreamscape_prod < /backup/emergency_TIMESTAMP.sql

# 3. Restaurer le .env
cp /backup/.env.backup .env

# 4. Redémarrer
docker-compose up -d
```

#### Option 2: Utiliser OLD_ENCRYPTION_KEY

```bash
# Si vous avez OLD_ENCRYPTION_KEY dans .env
ENCRYPTION_KEY="$OLD_ENCRYPTION_KEY"

# Mettre à jour et redémarrer
sed -i "s/ENCRYPTION_KEY=.*/ENCRYPTION_KEY=\"$OLD_ENCRYPTION_KEY\"/" .env
docker-compose restart
```

---

## Vérification Post-Récupération

### Checklist de Vérification

```bash
# ✅ 1. Services démarrés
docker ps | grep dreamscape
# Attendu: Tous les services running

# ✅ 2. Health checks OK
curl http://localhost:3001/health
# Attendu: {"status": "ok"}

# ✅ 3. Chiffrement fonctionne
curl -X POST http://localhost:3001/api/test/encrypt \
  -H "Content-Type: application/json" \
  -d '{"data":"test"}'
# Attendu: {"encrypted":"..."}

# ✅ 4. Login fonctionne
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'
# Attendu: 200 OK

# ✅ 5. Logs sans erreurs
docker-compose logs --tail=100 | grep -i error
# Attendu: Aucune erreur de déchiffrement

# ✅ 6. Audit trail
tail -20 /var/log/dreamscape/audit.log
# Vérifier: Entry KEY_ROTATION avec status SUCCESS
```

---

## Communication

### Notification Interne

**Email Template:**

```
Subject: [URGENT] Rotation d'urgence des clés de chiffrement - Dreamscape

Équipe,

Une rotation d'urgence des clés de chiffrement a été effectuée.

Raison: [Clé compromise / Clé perdue / Audit de sécurité]
Date/Heure: [TIMESTAMP]
Durée d'indisponibilité: [X minutes]
Status: [SUCCÈS / ÉCHEC / EN COURS]

Actions requises:
- Aucune action requise pour les développeurs
- Les applications ont été redémarrées automatiquement
- Vérifier les tests E2E après récupération

Si vous rencontrez des problèmes, contactez:
- Security Lead: security@dreamscape.com
- DevOps On-Call: +33 X XX XX XX XX

Merci,
Security Team
```

### Notification Clients (si nécessaire)

**Uniquement si:** Compromission confirmée avec fuite de données

```
Cher Client,

Par mesure de précaution, nous avons procédé à une mise à jour
de sécurité sur notre plateforme. Aucune action n'est requise
de votre part.

Pour plus d'informations: support@dreamscape.com

Cordialement,
L'équipe DreamScape
```

---

## Contacts d'Urgence

| Rôle | Nom | Contact | Disponibilité |
|------|-----|---------|--------------|
| **CTO** | [Nom] | [Email] / [Tél] | 24/7 |
| **Security Lead** | [Nom] | security@dreamscape.com | 24/7 |
| **DevOps Lead** | [Nom] | devops@dreamscape.com | On-call |
| **DBA** | [Nom] | dba@dreamscape.com | Business hours |

**Escalation:**
1. Security Lead (0-15 min)
2. DevOps Lead (15-30 min)
3. CTO (30+ min ou décision critique requise)

---

## Logs et Historique

### Enregistrer la Récupération

```bash
# Créer un rapport de récupération
cat > /secure/recovery_reports/recovery_$(date +%Y%m%d_%H%M%S).txt <<EOF
========================================
EMERGENCY KEY RECOVERY REPORT
========================================
Date: $(date)
Operator: $(whoami)
Reason: [À REMPLIR]

Phase 1 - Arrêt: [TIMESTAMP]
Phase 2 - Diagnostic: [TIMESTAMP]
Phase 3 - Restauration: [TIMESTAMP]
Phase 4 - Redémarrage: [TIMESTAMP]

Old Key Fingerprint: [À REMPLIR]
New Key Fingerprint: [À REMPLIR]

Re-encrypted Records:
- Users: [COUNT]
- Payments: [COUNT]
- Bookings: [COUNT]

Status: [SUCCESS / PARTIAL / FAILED]
Notes: [À REMPLIR]
========================================
EOF
```

---

## Annexes

### A. Script de Test d'Urgence

Fichier: `test-emergency-recovery.sh`

```bash
#!/bin/bash
# Test script for emergency recovery

echo "🔍 Testing emergency recovery..."

# Test 1: Key validation
echo "Test 1: Key validation"
node -e "require('dotenv').config(); require('./shared/security/EncryptionService').EncryptionService.validateKey();"
if [ $? -eq 0 ]; then
  echo "✅ PASS"
else
  echo "❌ FAIL"
  exit 1
fi

# Test 2: Encryption/Decryption
echo "Test 2: Encryption/Decryption"
node -e "const {EncryptionService} = require('./shared/security/EncryptionService'); const e = EncryptionService.encrypt('test'); console.log(EncryptionService.decrypt(e) === 'test' ? '✅ PASS' : '❌ FAIL');"

# Test 3: Services health
echo "Test 3: Services health"
curl -f http://localhost:3001/health || exit 1
echo "✅ PASS"

echo "✅ All tests passed"
```

---

**FIN DU DOCUMENT**

*Ce document doit être mis à jour après chaque récupération d'urgence.*
*Dernière révision: 2025-01-15*
