#!/bin/bash
# Start all Utility services - builds first then runs compiled JS

echo "Starting REZ Utilities Platform..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Install dependencies and build each service
cd "$SCRIPT_DIR/services/automation-service" && npm install && npm run build &
sleep 1
cd "$SCRIPT_DIR/services/scheduler-service" && npm install && npm run build &
sleep 1
cd "$SCRIPT_DIR/services/insights-service" && npm install && npm run build &
sleep 1
cd "$SCRIPT_DIR/services/worker" && npm install && npm run build &
wait

# Start compiled services
cd "$SCRIPT_DIR/services/automation-service" && PORT=4014 node dist/index.js &
sleep 1
cd "$SCRIPT_DIR/services/scheduler-service" && PORT=4016 node dist/index.js &
sleep 1
cd "$SCRIPT_DIR/services/insights-service" && PORT=4015 node dist/index.js &
sleep 1
cd "$SCRIPT_DIR/services/worker" && node dist/index.js &

echo "All Utilities services started"
wait
