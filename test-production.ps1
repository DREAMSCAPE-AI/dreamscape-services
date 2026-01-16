# Script de test complet pour Docker Compose Production
# Teste les 2 pods : Core + Business

param(
    [ValidateSet("all", "core", "business")]
    [string]$Pod = "all",
    [switch]$BuildOnly,
    [switch]$Clean,
    [switch]$SkipTests
)

$ErrorActionPreference = "Stop"

Write-Host "╔═══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   DREAMSCAPE PRODUCTION BUILD & TEST             ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Vérifier que .env existe (copier depuis .env.example si nécessaire)
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  No .env file found. Creating from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "✅ .env created. Please edit it with your credentials.`n" -ForegroundColor Green
}

# Fonction pour tester un pod
function Test-Pod {
    param(
        [string]$PodName,
        [string]$ComposeFile
    )

    Write-Host "`n═══ $PodName POD ═══" -ForegroundColor Cyan

    # Nettoyer si demandé
    if ($Clean) {
        Write-Host "Cleaning up $PodName..." -ForegroundColor Yellow
        docker-compose -f $ComposeFile down -v 2>$null
        Write-Host "✅ Cleanup complete" -ForegroundColor Green
    }

    # Build
    Write-Host "Building $PodName images..." -ForegroundColor Yellow
    docker-compose -f $ComposeFile build --no-cache

    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ $PodName BUILD FAILED!" -ForegroundColor Red
        return $false
    }

    Write-Host "✅ $PodName build successful!" -ForegroundColor Green

    if ($BuildOnly) {
        return $true
    }

    if ($SkipTests) {
        Write-Host "⏭️  Skipping tests" -ForegroundColor Gray
        return $true
    }

    # Start services
    Write-Host "Starting $PodName services..." -ForegroundColor Yellow
    docker-compose -f $ComposeFile up -d

    # Wait for health
    Write-Host "Waiting for services to be healthy..." -ForegroundColor Yellow
    $maxWait = 60
    $waited = 0
    while ($waited -lt $maxWait) {
        Start-Sleep -Seconds 3
        $waited += 3
        Write-Host "." -NoNewline -ForegroundColor Gray
    }
    Write-Host ""

    # Show status
    Write-Host "`n$PodName Services Status:" -ForegroundColor Cyan
    docker-compose -f $ComposeFile ps

    # Logs en cas d'erreur
    $unhealthy = docker-compose -f $ComposeFile ps --filter "health=unhealthy" -q
    if ($unhealthy) {
        Write-Host "`n⚠️  Some services are unhealthy. Showing logs:" -ForegroundColor Yellow
        docker-compose -f $ComposeFile logs --tail=50
    }

    # Cleanup
    Write-Host "`nStopping $PodName services..." -ForegroundColor Yellow
    docker-compose -f $ComposeFile down

    return $true
}

# Tester les pods selon le paramètre
$success = $true

if ($Pod -eq "all" -or $Pod -eq "core") {
    $success = Test-Pod -PodName "CORE" -ComposeFile "docker-compose.core.prod.yml"
    if (-not $success) { exit 1 }
}

if ($Pod -eq "all" -or $Pod -eq "business") {
    $success = Test-Pod -PodName "BUSINESS" -ComposeFile "docker-compose.business.prod.yml"
    if (-not $success) { exit 1 }
}

# Test global
if ($Pod -eq "all" -and -not $BuildOnly -and -not $SkipTests) {
    Write-Host "`n═══ GLOBAL INTEGRATION TEST ═══" -ForegroundColor Cyan
    Write-Host "Testing full stack with docker-compose.prod.yml..." -ForegroundColor Yellow

    if ($Clean) {
        docker-compose -f docker-compose.prod.yml down -v 2>$null
    }

    docker-compose -f docker-compose.prod.yml build --no-cache
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Global build successful!" -ForegroundColor Green
    } else {
        Write-Host "❌ Global build failed!" -ForegroundColor Red
        exit 1
    }
}

Write-Host "`n╔═══════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   ✅ ALL TESTS PASSED!                            ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  - To start all services: docker-compose -f docker-compose.prod.yml up -d" -ForegroundColor Gray
Write-Host "  - To stop all services:  docker-compose -f docker-compose.prod.yml down" -ForegroundColor Gray
Write-Host ""
