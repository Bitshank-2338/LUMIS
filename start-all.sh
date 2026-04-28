#!/usr/bin/env bash
# LUMIS — start everything for the demo.
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "[LUMIS] Starting Audit backend (port 5002)..."
(cd "$ROOT/backend" && python run.py) &
PID_AUDIT=$!

echo "[LUMIS] Starting mock biased model (port 6001)..."
(cd "$ROOT/backend" && python -m demo.mock_biased_model) &
PID_MOCK=$!

echo "[LUMIS] Starting Crisis backend (port 5003)..."
(cd "$ROOT/crisis/backend" && python run.py) &
PID_CRISIS=$!

echo "[LUMIS] Starting frontend (port 3001)..."
(cd "$ROOT/frontend" && npm run dev) &
PID_FRONTEND=$!

echo ""
echo "==========================================================="
echo " LUMIS up and running"
echo "==========================================================="
echo " Frontend:        http://localhost:3001"
echo " Audit Dashboard: http://localhost:3001/dashboard"
echo " Crisis Center:   http://localhost:3001/crisis"
echo " Audit API:       http://localhost:5002"
echo " Crisis API:      http://localhost:5003"
echo " Mock model:      http://localhost:6001"
echo "==========================================================="
echo "Ctrl-C to stop all services."

trap "kill $PID_AUDIT $PID_MOCK $PID_CRISIS $PID_FRONTEND 2>/dev/null" EXIT INT TERM
wait
