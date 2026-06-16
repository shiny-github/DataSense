#!/bin/bash
echo "=== DataSense ==="
echo ""

echo "Starting API server on http://localhost:8000 ..."
uvicorn api.main:app --reload --port 8000 &
API_PID=$!

echo "Starting dashboard on http://localhost:5173 ..."
(cd dashboard && npm run dev) &
DASH_PID=$!

echo ""
echo "  API:       http://localhost:8000"
echo "  Docs:      http://localhost:8000/docs"
echo "  Dashboard: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop."

trap 'kill $API_PID $DASH_PID 2>/dev/null; exit 0' INT TERM
wait
