#!/usr/bin/env bash
set -euo pipefail

COMPOSE="docker-compose"
command -v docker-compose &>/dev/null || COMPOSE="docker compose"

cd "$(dirname "$0")"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║     🇱🇰  SL Tax Calculator — Start            ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── Build option ──────────────────────────────────────────────────────────────
echo "⚙️  Choose build option:"
echo "  1) Build with cache"
echo "  2) Build without cache"
echo "  3) Skip build          ← default"
echo ""
read -rp "   Enter choice [1/2/3] (default: 3): " BUILD_CHOICE
BUILD_CHOICE="${BUILD_CHOICE:-3}"

case "$BUILD_CHOICE" in
  1)
    echo "  → Building with cache …"
    $COMPOSE build
    ;;
  2)
    echo "  → Building without cache …"
    $COMPOSE build --no-cache
    ;;
  3)
    echo "  → Skipping build."
    ;;
  *)
    echo "  Invalid choice. Skipping build."
    ;;
esac

echo ""

# ── Cleanup option ────────────────────────────────────────────────────────────
echo "🧹 Choose cleanup option before starting:"
echo "  1) Clean start (remove containers + volumes — fresh DB)"
echo "  2) Keep existing data  ← default"
echo "  3) Exit"
echo ""
read -rp "   Enter choice [1/2/3] (default: 2): " CLEAN_CHOICE
CLEAN_CHOICE="${CLEAN_CHOICE:-2}"

case "$CLEAN_CHOICE" in
  1)
    echo "  → Removing existing containers and volumes …"
    $COMPOSE down -v --remove-orphans 2>/dev/null || true
    ;;
  2)
    echo "  → Keeping existing data."
    ;;
  3)
    echo "  Exiting."
    exit 0
    ;;
  *)
    echo "  Invalid choice. Keeping existing data."
    ;;
esac

echo ""

# ── Seed option ───────────────────────────────────────────────────────────────
HAS_USER_DATA="no"
if [ -f "user_data/users.json" ]; then
  HAS_USER_DATA="yes"
elif ls user_data/*_income.csv &>/dev/null 2>&1; then
  # CSVs exist but no manifest — offer to generate it
  echo "📄 Found CSV files in user_data/ but no users.json manifest."
  read -rp "   Auto-generate users.json from CSV filenames? [Y/n]: " GEN_CONFIRM
  if [[ "${GEN_CONFIRM:-y}" =~ ^[Yy]$ ]]; then
    bash user_data/setup.sh
    if [ -f "user_data/users.json" ]; then
      HAS_USER_DATA="yes"
      echo ""
    fi
  fi
fi

echo "🌱 Seed data option (applies on fresh DB or clean start):"
echo "  1) Sample data only    ← demo users (Alice, Bob) — default"
if [ "$HAS_USER_DATA" = "yes" ]; then
  echo "  2) My data only       ← from user_data/users.json"
  echo "  3) Both               ← sample + your data"
else
  echo "  2) My data only       ← ⚠ no user_data/users.json found"
  echo "  3) Both               ← ⚠ no user_data/users.json found"
fi
echo "  4) Skip seeding        ← empty database"
echo ""
read -rp "   Enter choice [1/2/3/4] (default: 1): " SEED_CHOICE
SEED_CHOICE="${SEED_CHOICE:-1}"

case "$SEED_CHOICE" in
  1) SEED_MODE="sample" ;;
  2)
    if [ "$HAS_USER_DATA" = "no" ]; then
      echo ""
      echo "  ⚠  No user_data/users.json found!"
      echo "     See user_data/README.md for setup instructions."
      echo "     Falling back to sample data."
      echo ""
      SEED_MODE="sample"
    else
      SEED_MODE="user"
    fi
    ;;
  3)
    if [ "$HAS_USER_DATA" = "no" ]; then
      echo ""
      echo "  ⚠  No user_data/users.json found — loading sample data only."
      echo ""
      SEED_MODE="sample"
    else
      SEED_MODE="both"
    fi
    ;;
  4) SEED_MODE="none" ;;
  *) SEED_MODE="sample" ;;
esac

export SEED_MODE
echo "  → Seed mode: $SEED_MODE"

echo ""
echo "🚀 Starting SL Tax Calculator …"
echo ""

$COMPOSE up -d

echo ""
echo "⏳ Waiting for services to be ready …"

# Wait for backend to respond
MAX_WAIT=60
ELAPSED=0
while ! curl -sf http://localhost:8100/ >/dev/null 2>&1; do
  if [ "$ELAPSED" -ge "$MAX_WAIT" ]; then
    echo ""
    echo "  ⚠️  Backend not ready after ${MAX_WAIT}s. Check logs:"
    echo "     $COMPOSE logs backend"
    break
  fi
  sleep 2
  ELAPSED=$((ELAPSED + 2))
  printf "."
done

echo ""
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  ✔  SL Tax Calculator is ready                              ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║                                                              ║"
echo "║  🌐 Frontend       http://localhost:3100                     ║"
echo "║  🔌 Backend API    http://localhost:8100                     ║"
echo "║  📚 API Docs       http://localhost:8100/docs                ║"
echo "║  🐘 PostgreSQL     localhost:5433                            ║"
echo "║                                                              ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Seed Mode: $(printf '%-47s' "$SEED_MODE") ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Tax Configs: FY 23/24, 24/25, 25/26, 26/27                 ║"
echo "║  • 23/24 & 24/25 — Old system (no foreign income tax)       ║"
echo "║  • 25/26 & 26/27 — New system (separate foreign tax)        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  Run ./stop.sh to stop the stack."
echo "  To reload data: ./stop.sh (option 2) then ./start.sh"
echo ""
