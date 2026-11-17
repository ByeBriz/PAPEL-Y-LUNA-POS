#!/usr/bin/env bash
# Script de construcción para Render (Backend Django + PostgreSQL)
set -o errexit

pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py migrate
python manage.py init_pos
