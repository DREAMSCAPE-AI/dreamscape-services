#!/bin/bash
# US-IA-010 - Ollama Deployment Script for Oracle ARM VM
#
# Usage:
#   ssh dev 'bash -s' < deploy_ollama.sh
#
# Or connect to VM first:
#   ssh dev
#   bash deploy_ollama.sh

set -e  # Exit on error

echo "🚀 Déploiement Ollama + Qwen2.5:7b sur Oracle ARM VM"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if running on ARM
ARCH=$(uname -m)
echo "Architecture détectée: $ARCH"

if [[ "$ARCH" != "aarch64" ]]; then
    echo "⚠️  WARNING: Cette VM n'est pas ARM64 (aarch64)"
    echo "   Ollama fonctionnera mais sans accélération optimale"
fi

# Install Ollama (if not already installed)
if ! command -v ollama &> /dev/null; then
    echo "📦 Installation d'Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh
else
    echo "✅ Ollama déjà installé: $(ollama --version)"
fi

# Start Ollama service
echo "🔧 Démarrage du service Ollama..."
sudo systemctl enable ollama
sudo systemctl start ollama

# Wait for service to be ready
echo "⏳ Attente du service Ollama..."
for i in {1..10}; do
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "✅ Service Ollama prêt"
        break
    fi
    if [ $i -eq 10 ]; then
        echo "❌ Service Ollama ne répond pas après 10s"
        exit 1
    fi
    sleep 1
done

# Pull Qwen2.5:7b model (quantized for ARM efficiency)
echo "📥 Téléchargement du modèle Qwen2.5:7b (Q4_K_M ~4.5GB)..."
echo "   (Cela peut prendre 5-10 minutes selon la connexion)"

if ollama list | grep -q "qwen2.5:7b"; then
    echo "✅ Modèle qwen2.5:7b déjà présent"
else
    ollama pull qwen2.5:7b
    echo "✅ Modèle qwen2.5:7b téléchargé"
fi

# Test inference
echo "🧪 Test d'inférence..."
TEST_RESPONSE=$(ollama run qwen2.5:7b --format json "Output JSON only: {\"test\": \"ok\"}" 2>/dev/null || echo "{\"error\": \"failed\"}")

if echo "$TEST_RESPONSE" | grep -q "\"test\""; then
    echo "✅ Inférence fonctionne correctement"
else
    echo "⚠️  Test d'inférence échoué (non-critique, le modèle est chargé)"
fi

# Display model info
echo ""
echo "📊 Informations du modèle:"
ollama list | grep qwen2.5

# System info
echo ""
echo "💻 Informations système:"
echo "   CPU: $(nproc) cores"
echo "   RAM: $(free -h | awk '/^Mem:/ {print $2}')"
echo "   Disk: $(df -h / | awk 'NR==2 {print $4}') disponible"

# Firewall (si nécessaire pour accès distant)
if command -v ufw &> /dev/null; then
    echo ""
    echo "🔥 Configuration firewall (optionnel):"
    echo "   Pour accès distant, exécuter: sudo ufw allow 11434/tcp"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Déploiement terminé !"
echo ""
echo "📝 Prochaines étapes:"
echo "   1. Tester: curl http://localhost:11434/api/tags"
echo "   2. Configurer .env: OLLAMA_URL=http://dev-vm:11434"
echo "   3. Démarrer AI service avec OllamaEnricherConsumer"
echo ""
echo "📌 Commandes utiles:"
echo "   - Lister modèles: ollama list"
echo "   - Test inference: ollama run qwen2.5:7b 'Hello'"
echo "   - Logs: journalctl -u ollama -f"
echo "   - Arrêter: sudo systemctl stop ollama"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
