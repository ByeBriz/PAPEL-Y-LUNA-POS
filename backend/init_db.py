#!/usr/bin/env python
"""
Script de inicialización directa para Papel y Luna POS.
Ejecuta migraciones y precarga usuarios (admin y cajero) y catálogo base.
Uso: python init_db.py
"""
import os
import sys
import django


def main():
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    django.setup()
    from django.core.management import call_command

    call_command('migrate', interactive=False)
    call_command('init_pos')


if __name__ == '__main__':
    main()
