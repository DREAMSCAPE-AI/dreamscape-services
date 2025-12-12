# Script pour démarrer tous les services DreamScape
# Usage: .\start-all-services.ps1

Write-Host "🚀 Démarrage de tous les services DreamScape..." -ForegroundColor Green

$services = @(
    @{Name="Auth"; Port=3001; Path="auth"},
    @{Name="User"; Port=3002; Path="user"},
    @{Name="Voyage"; Port=3003; Path="voyage"},
    @{Name="AI"; Port=3004; Path="ai"}
)

foreach ($service in $services) {
    Write-Host "🔄 Démarrage du service $($service.Name) sur le port $($service.Port)..." -ForegroundColor Cyan

    $path = Join-Path $PSScriptRoot $service.Path

    # Démarrer dans une nouvelle fenêtre PowerShell
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$path'; npm run dev" -WindowStyle Normal

    Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "✅ Tous les services sont en cours de démarrage !" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Services démarrés :" -ForegroundColor Yellow
foreach ($service in $services) {
    Write-Host "  - $($service.Name): http://localhost:$($service.Port)" -ForegroundColor White
}
Write-Host ""
Write-Host "🧪 Pour tester tous les services :" -ForegroundColor Yellow
Write-Host "  cd ..\dreamscape-tests" -ForegroundColor White
Write-Host "  npx jest --config=jest.config.realdb.js integration/health/" -ForegroundColor White
