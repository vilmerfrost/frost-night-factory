#!/bin/zsh

# ----------------------------------------
# ❄️ FROST REMOTE CLI v2
# ----------------------------------------

# Auto-detect script directory (works with alias, ./, or ~/)
SCRIPT_DIR="$(cd "$(dirname "${0}")" && pwd)"

# Search up the folder tree to find project root
PROJECT_ROOT="$SCRIPT_DIR"
while [[ "$PROJECT_ROOT" != "/" && ! -f "$PROJECT_ROOT/package.json" ]]; do
  PROJECT_ROOT="$(dirname "$PROJECT_ROOT")"
done

# If package.json wasn't found, fallback to script dir
if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
  PROJECT_ROOT="$SCRIPT_DIR"
fi

# Read .env or fail gracefully
ENV_FILE="$PROJECT_ROOT/.env"
if [[ -f "$ENV_FILE" ]]; then
  export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

# Validate jq
if ! command -v jq &> /dev/null; then
  echo "❌ jq is not installed. Install with: brew install jq"
  exit 1
fi

# Validate WEBHOOK_SECRET
if [[ -z "$WEBHOOK_SECRET" ]]; then
  echo "❌ Missing WEBHOOK_SECRET in .env"
  exit 1
fi

# Detect API host (for your current setup)
if [[ -z "$TAILSCALE_IP" ]]; then
  echo "⚠️  No TAILSCALE_IP found in .env. Using localhost fallback."
  API="http://localhost:8080"
else
  API="http://$TAILSCALE_IP:8080"
fi

# Pretty output
ok() { echo "✅ $1"; }
err() { echo "❌ $1"; }
info() { echo "🔷 $1"; }

COMMAND=$1

case "$COMMAND" in

  status)
    info "Checking Frost pipeline status..."
    curl -s "$API/status" | jq
    ;;

  trigger)
    info "Triggering Frost Night Factory pipeline..."
    curl -s -X POST "$API/trigger" \
      -H "Authorization: Bearer $WEBHOOK_SECRET" \
      -H "Content-Type: application/json" \
      -d "{\"branch\":\"main\",\"commit\":\"$(git rev-parse HEAD)\"}" \
      | jq
    ok "Pipeline triggered!"
    ;;

  logs)
    info "Fetching logs..."
    curl -s "$API/logs" | jq -r ".logs[]"
    ;;

  stream)
    info "Streaming live logs... (CTRL+C to stop)"
    curl -sN "$API/logs/stream"
    ;;

  stop)
    info "Stopping remote pipeline..."
    curl -s -X POST "$API/stop" \
      -H "Authorization: Bearer $WEBHOOK_SECRET" | jq
    ok "Pipeline stopped."
    ;;

  *)
    echo "❄️ Frost Remote CLI v2"
    echo ""
    echo "Usage:"
    echo "  $0 status      # Check server"
    echo "  $0 trigger     # Trigger pipeline"
    echo "  $0 logs        # Show logs"
    echo "  $0 stream      # Live log stream"
    echo "  $0 stop        # Stop pipeline"
    exit 1
    ;;
esac
