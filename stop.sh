#!/usr/bin/env bash
set -euo pipefail

COMPOSE="docker-compose"
command -v docker-compose &>/dev/null || COMPOSE="docker compose"

cd "$(dirname "$0")"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║     🇱🇰  SL Tax Calculator — Stop             ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "  1) Graceful stop only        ← preserves all data  ← default"
echo "  2) Stop and remove volumes   ← wipes DB (fresh on next start)"
echo "  3) Full cleanup              ← removes images too"
echo "  4) Exit"
echo ""
read -rp "   Enter choice [1/2/3/4] (default: 1): " CHOICE
CHOICE="${CHOICE:-1}"

echo ""

case "$CHOICE" in
  1)
    echo "⏹  Stopping containers (data preserved) …"
    $COMPOSE down --remove-orphans
    echo ""
    echo "✅ Stopped. Database volume is intact."
    echo "   Run ./start.sh to resume."
    ;;
  2)
    echo "⚠️  Stopping and removing volumes …"
    read -rp "   Are you sure? This wipes the database. [y/N]: " CONFIRM
    if [[ "${CONFIRM:-n}" =~ ^[Yy]$ ]]; then
      $COMPOSE down -v --remove-orphans
      echo ""
      echo "✅ Stopped and volumes removed."
      echo "   Next ./start.sh will re-seed the database from scratch."
    else
      echo "   Cancelled."
    fi
    ;;
  3)
    echo "⚠️  Full cleanup: containers, volumes and images …"
    read -rp "   Are you sure? This removes everything including built images. [y/N]: " CONFIRM
    if [[ "${CONFIRM:-n}" =~ ^[Yy]$ ]]; then
      $COMPOSE down -v --remove-orphans --rmi local
      echo ""
      echo "✅ Full cleanup complete."
      echo "   Run ./start.sh (option 1 or 2) to rebuild from scratch."
    else
      echo "   Cancelled."
    fi
    ;;
  4)
    echo "  Exiting."
    exit 0
    ;;
  *)
    echo "  Invalid choice. Exiting without changes."
    exit 1
    ;;
esac

echo ""
