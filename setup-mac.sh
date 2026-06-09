#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Ella Edge EMS – Mac Setup Script
# Voraussetzung: Docker Desktop for Mac läuft
# Aufruf: chmod +x setup-mac.sh && ./setup-mac.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

info()    { echo -e "${CYAN}▶ $1${NC}"; }
success() { echo -e "${GREEN}✓ $1${NC}"; }
warn()    { echo -e "${YELLOW}⚠ $1${NC}"; }
error()   { echo -e "${RED}✗ $1${NC}"; exit 1; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════════╗"
echo -e "║     Ella Edge EMS – Setup für Mac    ║"
echo -e "╚══════════════════════════════════════╝${NC}"
echo ""

# ── Docker prüfen ────────────────────────────────────────────────────────────
info "Prüfe Docker..."
docker info > /dev/null 2>&1 || error "Docker Desktop läuft nicht. Bitte starten und erneut versuchen."
success "Docker läuft"

# ── .env erstellen falls nicht vorhanden ─────────────────────────────────────
if [ ! -f .env ]; then
  info "Erstelle .env Konfiguration..."
  cat > .env <<'ENVEOF'
ELLA_DB_PATH=/data/ella-edge.db
ELLA_CONFIG_DIR=/config
API_PORT=3000
JWT_SECRET=demo-secret-change-in-production
SIMULATION_MODE=true
SIMULATION_SCENARIO=summer_high_pv
LOG_LEVEL=info
ENVEOF
  success ".env erstellt"
else
  success ".env bereits vorhanden"
fi

# ── Verzeichnisse anlegen ────────────────────────────────────────────────────
info "Verzeichnisse vorbereiten..."
mkdir -p data logs/nginx logs/backend-api logs/meter-collector \
         logs/inverter-controller logs/settlement-worker logs/reporting-worker \
         reports frontend/dist
touch data/.gitkeep logs/.gitkeep reports/.gitkeep 2>/dev/null || true
success "Verzeichnisse bereit"

# ── Frontend bauen ───────────────────────────────────────────────────────────
info "Frontend bauen (kann 2–3 Minuten dauern)..."
docker compose build frontend
docker compose --profile build up frontend
success "Frontend gebaut und deployed"

# ── Alle Services starten ────────────────────────────────────────────────────
info "Services starten..."
docker compose up -d
success "Services gestartet"

# ── Warten bis Backend bereit ────────────────────────────────────────────────
info "Warte auf Backend (Health Check)..."
MAX=30; COUNT=0
until curl -sf http://localhost/api/health > /dev/null 2>&1; do
  COUNT=$((COUNT + 1))
  [ $COUNT -ge $MAX ] && error "Backend antwortet nicht nach ${MAX} Versuchen. Logs: docker compose logs backend-api"
  printf "."
  sleep 2
done
echo ""
success "Backend ist bereit"

# ── Demo-Daten laden (aktueller Monat) ───────────────────────────────────────
MONTH=$(date +%Y-%m)
info "Demo-Daten für $MONTH generieren..."
docker exec ella-reporting-worker python backfill_month.py "$MONTH" 2>/dev/null \
  && success "Demo-Daten geladen" \
  || warn "Demo-Daten konnten nicht geladen werden (nicht kritisch)"

# ── Browser öffnen ───────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗"
echo -e "║   ✓  Ella Edge EMS ist bereit!               ║"
echo -e "╠══════════════════════════════════════════════╣"
echo -e "║   Dashboard:   http://localhost              ║"
echo -e "║   API Docs:    http://localhost/api/docs     ║"
echo -e "║   Simulation:  http://localhost/simulation   ║"
echo -e "╚══════════════════════════════════════════════╝${NC}"
echo ""

open http://localhost 2>/dev/null || true
