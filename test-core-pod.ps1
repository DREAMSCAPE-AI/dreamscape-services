# Script de test pour Core Pod (auth + user + PostgreSQL)
param(
    [switch]$BuildOnly,
    [switch]$Clean
)

$ErrorActionPreference = "Stop"

Write-Host "=== CORE POD BUILD & TEST ===" -ForegroundColor Cyan
Write-Host "Services: auth + user + PostgreSQL`n" -ForegroundColor Gray

# Nettoyer si demandé
if ($Clean) {
    Write-Host "Cleaning up existing containers and images..." -ForegroundColor Yellow
    docker-compose -f docker-compose.core.prod.yml down -v 2>$null
    docker rmi dreamscape-auth-service dreamscape-user-service 2>$null
    Write-Host "✅ Cleanup complete`n" -ForegroundColor Green
}

# Build des images
Write-Host "Building Core Pod images..." -ForegroundColor Yellow
docker-compose -f docker-compose.core.prod.yml build --no-cache

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ BUILD FAILED!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build successful!`n" -ForegroundColor Green

if ($BuildOnly) {
    Write-Host "Build-only mode - skipping container tests" -ForegroundColor Gray
    exit 0
}

# Démarrer les services
Write-Host "Starting Core Pod services..." -ForegroundColor Yellow
docker-compose -f docker-compose.core.prod.yml up -d

# Attendre que les services soient prêts
Write-Host "Waiting for services to be healthy..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# Vérifier les healthchecks
Write-Host "`nChecking service health..." -ForegroundColor Yellow
$authHealth = docker inspect --format='{{.State.Health.Status}}' dreamscape-auth-service 2>$null
$userHealth = docker inspect --format='{{.State.Health.Status}}' dreamscape-user-service 2>$null
$dbHealth = docker inspect --format='{{.State.Health.Status}}' dreamscape-core-db 2>$null

Write-Host "- Database: $dbHealth" -ForegroundColor $(if ($dbHealth -eq "healthy") {"Green"} else {"Red"})
Write-Host "- Auth Service: $authHealth" -ForegroundColor $(if ($authHealth -eq "healthy") {"Green"} else {"Yellow"})
Write-Host "- User Service: $userHealth" -ForegroundColor $(if ($userHealth -eq "healthy") {"Green"} else {"Yellow"})

# Test HTTP endpoints
Write-Host "`nTesting HTTP endpoints..." -ForegroundColor Yellow

try {
    $authResponse = Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing -TimeoutSec 5
    Write-Host "✅ Auth Service responds (Status: $($authResponse.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Auth Service not responding" -ForegroundColor Yellow
}

try {
    $userResponse = Invoke-WebRequest -Uri "http://localhost:3002/health" -UseBasicParsing -TimeoutSec 5
    Write-Host "✅ User Service responds (Status: $($userResponse.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "⚠️ User Service not responding" -ForegroundColor Yellow
}

# Afficher les logs si erreur
if ($authHealth -ne "healthy" -or $userHealth -ne "healthy") {
    Write-Host "`n=== LOGS ===" -ForegroundColor Yellow
    docker-compose -f docker-compose.core.prod.yml logs --tail=50
}

Write-Host "`n=== CORE POD TEST COMPLETE ===" -ForegroundColor Cyan
Write-Host "Use 'docker-compose -f docker-compose.core.prod.yml down' to stop" -ForegroundColor Gray
