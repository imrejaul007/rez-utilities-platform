#!/bin/bash
# Start all Utility services concurrently

echo "Starting REZ Utilities Platform..."

# Automation Service (4014)
cd "$(dirname "$0")/services/automation-service" && ./start.sh &
sleep 2

# Scheduler Service (4016 - fixed port)
cd "$(dirname "$0")/services/scheduler-service" && ./start.sh &
sleep 2

# Insights Service
cd "$(dirname "$0")/services/insights-service" && ./start.sh &
sleep 2

# Worker
cd "$(dirname "$0")/services/worker" && ./start.sh &

echo "All Utilities services started"
wait
