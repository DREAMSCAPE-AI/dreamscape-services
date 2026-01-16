# 🧪 Test E2E Repository Dispatch Flow

## 🎯 Objectif

Valider le flux complet Repository Dispatch de bout en bout :

```
auth service change → CI workflow → Repository Dispatch → dreamscape-tests
```

## 🔧 Modification Apportée

### Enhanced Health Check Endpoint

**Fichier**: `auth/src/server.ts`
**Endpoint**: `GET /health`

#### Avant
```json
{
  "status": "ok",
  "service": "auth-service",
  "timestamp": "2025-10-28T10:00:00.000Z"
}
```

#### Après
```json
{
  "status": "ok",
  "service": "auth-service",
  "version": "1.0.0",
  "timestamp": "2025-10-28T10:00:00.000Z",
  "uptime": 3600,
  "environment": "development",
  "database": {
    "postgresql": true,
    "mongodb": false
  },
  "memory": {
    "used": 45,
    "total": 128
  }
}
```

### Nouvelles Informations

1. **version**: Version du service
2. **uptime**: Temps de fonctionnement en secondes
3. **environment**: Environnement d'exécution
4. **database**: État de connectivité des bases de données
   - PostgreSQL status
   - MongoDB status
5. **memory**: Utilisation mémoire
   - Used memory (MB)
   - Total heap (MB)

### Gestion des Erreurs

En cas d'échec du health check de la base de données :
```json
{
  "status": "degraded",
  "service": "auth-service",
  "timestamp": "2025-10-28T10:00:00.000Z",
  "error": "Database health check failed"
}
```
HTTP Status: **503 Service Unavailable**

## 📋 Flux Attendu

### 1. **Push de la branche**
```bash
git push origin test/e2e-repository-dispatch-flow
```

### 2. **Déclenchement CI** (dreamscape-services)
- ✅ **detect-changes**: Détecte que `auth/` a changé
- ✅ **lint-and-build**:
  - Setup Node.js 20
  - `npm ci` dans auth/
  - `npm run lint` (si présent)
  - `npm run build` (si présent)
  - `npm test` (si présent)

### 3. **Repository Dispatch** (services → tests)
Payload envoyé à dreamscape-tests:
```json
{
  "repository": "dreamscape-services",
  "branch": "test/e2e-repository-dispatch-flow",
  "sha": "abc123...",
  "services": ["auth"],
  "trigger": "ci",
  "pr_number": ""
}
```

### 4. **Tests Complets** (dreamscape-tests)
- Unit tests avec coverage
- Integration tests
- E2E tests
- Cross-service tests

### 5. **Résultat Attendu**
- ✅ CI services: PASS
- ✅ Repository Dispatch: SUCCESS
- ✅ Tests complets: PASS

## 🔍 Points de Validation

### CI Workflow (dreamscape-services)
- [ ] Service `auth` détecté comme modifié
- [ ] Lint passe (ou skip si pas de script lint)
- [ ] Build passe (ou skip si pas de script build)
- [ ] Tests locaux passent (ou skip)
- [ ] Secret `CI_CLONE_TOKEN` validé
- [ ] Repository Dispatch déclenché
- [ ] Commentaire PR créé (si applicable)

### Tests (dreamscape-tests)
- [ ] Workflow `branch-testing.yml` déclenché
- [ ] Context parsé correctement
- [ ] Tests appropriés exécutés
- [ ] Coverage reporté
- [ ] Status remonté

### Monitoring
- [ ] Aucune erreur dans les logs
- [ ] Temps d'exécution acceptable
- [ ] Toutes les étapes complétées

## 📊 Métriques Attendues

| Métrique | Valeur Attendue |
|----------|-----------------|
| **CI Duration** | < 5 minutes |
| **Test Duration** | < 10 minutes |
| **Total E2E** | < 15 minutes |
| **Success Rate** | 100% |

## 🐛 Troubleshooting

### Workflow ne se déclenche pas
- Vérifier que le fichier `.github/workflows/ci.yml` existe
- Vérifier les permissions GitHub Actions

### Repository Dispatch échoue
- Vérifier le secret `CI_CLONE_TOKEN`
- Vérifier les permissions du token

### Tests ne se lancent pas
- Vérifier le workflow dans dreamscape-tests
- Vérifier le payload du Repository Dispatch

## ✅ Critères de Succès

1. ✅ Workflow CI se déclenche automatiquement
2. ✅ Service `auth` correctement détecté
3. ✅ Lint et build passent (ou skip si absent)
4. ✅ Repository Dispatch réussit
5. ✅ Tests complets s'exécutent dans dreamscape-tests
6. ✅ Tous les checks sont verts
7. ✅ Pas d'erreurs dans les logs

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
