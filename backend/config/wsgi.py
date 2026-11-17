"""
WSGI config for Papel y Luna POS backend.
Expone el callable WSGI como variable a nivel de módulo llamada ``application``.
Necesario para el despliegue en producción con Gunicorn en Render.
"""
import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

application = get_wsgi_application()
