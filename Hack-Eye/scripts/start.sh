#!/usr/bin/env bash
echo "========================================================"
echo "  SAHAYI - AI Construction Safety Intelligence Platform"
echo "  Starting Backend & Frontend Servers..."
echo "========================================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

export PYTHONPATH="$BACKEND_DIR"

echo "[1/3] Initializing Database & Seed Data..."
python3 -c "from app.database.database import init_db; from app.database.seed import seed_database; init_db(); seed_database()"

echo "[2/3] Starting FastAPI Backend on http://localhost:8001..."
cd "$BACKEND_DIR" && python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload &
BACKEND_PID=$!

echo "[3/3] Starting React Vite Frontend on http://localhost:3000..."
cd "$FRONTEND_DIR" && npm run dev &
FRONTEND_PID=$!

echo ""
echo ">>> SAHAYI SYSTEM IS ONLINE! <<<"
echo "Dashboard:         http://localhost:3000/"
echo "Worker Kiosk:      http://localhost:3000/kiosk"
echo "Supervisor Mobile: http://localhost:3000/mobile"
echo "Demo Controller:   http://localhost:3000/demo"
echo "API Docs:          http://localhost:8001/docs"
echo ""

trap "kill $BACKEND_PID $FRONTEND_PID" EXIT
wait
