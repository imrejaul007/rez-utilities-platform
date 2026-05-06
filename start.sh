#!/bin/bash
# Start all Utility services concurrently using tsx

echo "Starting REZ Utilities Platform..."

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Install tsx globally for fast TypeScript execution
npm install -g tsx

# Automation Service (4014)
cd "$SCRIPT_DIR/services/automation-service" && npx tsx src/index.ts &
sleep 2

# Scheduler Service (4016)
cd "$SCRIPT_DIR/services/scheduler-service" && npx tsx src/index.ts &
sleep 2

# Insights Service
cd "$SCRIPT_DIR/services/insights-service" && npx tsx src/index.ts &
sleep 2

# Worker
cd "$SCRIPT_DIR/services/worker" && npx tsx src/index.ts &

echo "All Utilities services started"
wait
