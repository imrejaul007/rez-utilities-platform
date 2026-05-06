#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORT_DIR="$ROOT_DIR/docs/reports/runtime-health"
mkdir -p "$REPORT_DIR"

TIMESTAMP_UTC="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
STAMP_DATE="$(date -u +"%Y-%m-%d")"
REPORT_FILE="$REPORT_DIR/${STAMP_DATE}-runtime-probe.md"
LATEST_FILE="$REPORT_DIR/latest-runtime-probe.md"

probe() {
  local name="$1"
  local url="$2"
  local code body
  body="$(mktemp)"
  code="$(curl -sS -o "$body" -w "%{http_code}" "$url" || true)"
  echo "### ${name}" >> "$REPORT_FILE"
  echo "- URL: \`${url}\`" >> "$REPORT_FILE"
  echo "- HTTP: \`${code}\`" >> "$REPORT_FILE"
  echo "- Body:" >> "$REPORT_FILE"
  echo '```json' >> "$REPORT_FILE"
  cat "$body" >> "$REPORT_FILE"
  echo >> "$REPORT_FILE"
  echo '```' >> "$REPORT_FILE"
  echo >> "$REPORT_FILE"
  rm -f "$body"
}

{
  echo "# Runtime Health Probe Report"
  echo
  echo "- Generated (UTC): \`${TIMESTAMP_UTC}\`"
  echo "- Runner: \`scripts/runtime-health-probe.sh\`"
  echo
  echo "## Probes"
  echo
} > "$REPORT_FILE"

probe "rez-backend health (Render URL)" "https://rez-backend-8dfu.onrender.com/health"
probe "rez-finance live" "https://rez-finance-service.onrender.com/health/live"
probe "rez-finance ready" "https://rez-finance-service.onrender.com/health/ready"
probe "rez-finance health" "https://rez-finance-service.onrender.com/health"

cp "$REPORT_FILE" "$LATEST_FILE"
echo "Saved: $REPORT_FILE"
echo "Updated: $LATEST_FILE"
