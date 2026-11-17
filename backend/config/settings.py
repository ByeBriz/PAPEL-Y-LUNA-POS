"""
Django settings for Papel y Luna POS backend — MVP 3.
Configurado para desarrollo local y despliegue en Render + PostgreSQL.
"""
import importlib.util
import json
import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent


def _load_dotenv(dotenv_path: Path):
    if not dotenv_path.exists():
        return
    for raw_line in dotenv_path.read_text(encoding='utf-8').splitlines():
        line = raw_line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, val = line.split('=', 1)
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        os.environ.setdefault(key, val)


_load_dotenv(BASE_DIR / '.env')

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'django-insecure-papel-y-luna-dev-key-2026')
_default_debug = 'False' if os.environ.get('RENDER') else 'True'
DEBUG = os.environ.get('DJANGO_DEBUG', _default_debug).lower() in ('true', '1', 'yes')

if not DEBUG and SECRET_KEY.startswith('django-insecure-'):
    raise ImproperlyConfigured('Configura DJANGO_SECRET_KEY con un valor seguro para producción.')

ALLOWED_HOSTS = [
    h.strip()
    for h in os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')
    if h.strip()
]
render_hostname = os.environ.get('RENDER_EXTERNAL_HOSTNAME', '').strip()
if render_hostname and render_hostname not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(render_hostname)

try:
    AUTHORS = json.loads(os.environ.get('DJANGO_AUTHORS_JSON', '[]'))
except json.JSONDecodeError as exc:
    raise ImproperlyConfigured('DJANGO_AUTHORS_JSON debe contener una lista JSON válida.') from exc

if not isinstance(AUTHORS, list) or any(
    not isinstance(author, dict)
    or not isinstance(author.get('nombre'), str)
    or not isinstance(author.get('codigo'), str)
    for author in AUTHORS
):
    raise ImproperlyConfigured(
        'DJANGO_AUTHORS_JSON debe ser una lista de objetos con nombre y codigo de texto.'
    )

INSTALLED_APPS = [
    'django.contrib.contenttypes',
    'django.contrib.auth',
    'django.contrib.staticfiles',
    'pos',
]

if importlib.util.find_spec('rest_framework') is not None:
    INSTALLED_APPS.append('rest_framework')
    INSTALLED_APPS.extend([
        'rest_framework_simplejwt',
        'rest_framework_simplejwt.token_blacklist',
    ])

if importlib.util.find_spec('corsheaders') is not None:
    INSTALLED_APPS.insert(0, 'corsheaders')

MIDDLEWARE = ['django.middleware.security.SecurityMiddleware']

if importlib.util.find_spec('whitenoise') is not None:
    MIDDLEWARE.append('whitenoise.middleware.WhiteNoiseMiddleware')

if importlib.util.find_spec('corsheaders') is not None:
    MIDDLEWARE.append('corsheaders.middleware.CorsMiddleware')

MIDDLEWARE.extend([
    'django.middleware.common.CommonMiddleware',
    'pos.middleware.RequestLoggingMiddleware',
    'pos.middleware.SanitizeIdsMiddleware',
])

CORS_ALLOW_ALL_ORIGINS = os.environ.get('CORS_ALLOW_ALL_ORIGINS', 'False').lower() in ('true', '1', 'yes')
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get('CORS_ALLOWED_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173').split(',')
    if origin.strip()
]

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https') if os.environ.get('RENDER') else None
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG

ROOT_URLCONF = 'config.urls'


def _build_database_config():
    database_url = os.environ.get('DATABASE_URL', '').strip()
    if database_url:
        import dj_database_url
        return dj_database_url.parse(
            database_url,
            conn_max_age=600,
            conn_health_checks=True,
        )

    pg_db = os.environ.get('POSTGRES_DB', '').strip()
    if pg_db:
        return {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': pg_db,
            'USER': os.environ.get('POSTGRES_USER', 'postgres'),
            'PASSWORD': os.environ.get('POSTGRES_PASSWORD', ''),
            'HOST': os.environ.get('POSTGRES_HOST', 'localhost'),
            'PORT': os.environ.get('POSTGRES_PORT', '5432'),
            'CONN_MAX_AGE': 600,
        }

    # Respaldo automático local cuando no se ha levantado el servidor PostgreSQL en la máquina
    return {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }


DATABASES = {
    'default': _build_database_config()
}

REST_FRAMEWORK = {
    'UNAUTHENTICATED_USER': None,
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}

from datetime import timedelta

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'AUTH_HEADER_TYPES': ('Bearer',),
}

LANGUAGE_CODE = 'es-co'
TIME_ZONE = 'America/Bogota'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STORAGES = {
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
    },
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
    },
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
