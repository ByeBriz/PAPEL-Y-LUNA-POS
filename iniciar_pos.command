#!/usr/bin/env bash
# Script de inicio automático en 1 clic para Papel y Luna POS (macOS)
cd "$(dirname "$0")"

export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node 2>/dev/null | tail -n 1)/bin:$PATH"

echo "=================================================="
echo "   Iniciando PAPEL Y LUNA POS (Backend + React)   "
echo "=================================================="

cd backend
./venv/bin/python manage.py migrate
./venv/bin/python manage.py init_pos
./venv/bin/python manage.py runserver 127.0.0.1:8000 &
BACKEND_PID=$!
cd ..

trap "echo 'Cerrando servidores...'; kill $BACKEND_PID 2>/dev/null; exit" INT TERM EXIT

sleep 1
open "http://localhost:5173" 2>/dev/null || true

./node_modules/.bin/vite --port 5173
