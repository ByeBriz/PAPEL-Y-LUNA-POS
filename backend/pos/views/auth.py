"""
Controladores de Autenticación y Sesión (backend/pos/views/auth.py)
"""
import json
from django.contrib.auth import authenticate
from django.http import JsonResponse
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from pos.models import SesionToken
from pos.permissions import authenticate_request, get_user_role, require_roles
from pos.serializers import serialize_user


@method_decorator(csrf_exempt, name='dispatch')
class LoginView(View):
    def post(self, request):
        try:
            data = json.loads(request.body or '{}')
        except json.JSONDecodeError:
            return JsonResponse({'errors': {'body': ['JSON inválido.']}}, status=400)

        username = (data.get('username') or '').strip()
        password = data.get('password') or ''

        if not username or not password:
            return JsonResponse(
                {'detail': 'Ingresa tu nombre de usuario y contraseña.', 'errors': {'username': ['Campo obligatorio.']}},
                status=400,
            )

        user = authenticate(username=username, password=password)
        if not user or not user.is_active:
            return JsonResponse(
                {'detail': 'Usuario o contraseña incorrectos. Verifica tus credenciales.'},
                status=401,
            )

        refresh = RefreshToken.for_user(user)
        refresh['rol'] = get_user_role(user)
        access = refresh.access_token
        access['rol'] = get_user_role(user)

        return JsonResponse({
            'token': str(access),
            'access': str(access),
            'refresh': str(refresh),
            'user': serialize_user(user),
        })


@method_decorator(csrf_exempt, name='dispatch')
class LogoutView(View):
    def post(self, request):
        authenticate_request(request)
        token_key = getattr(request, 'pos_token', '')
        if token_key:
            SesionToken.objects.filter(key=token_key).delete()
        try:
            data = json.loads(request.body or '{}')
            refresh_token = data.get('refresh')
            if refresh_token:
                RefreshToken(refresh_token).blacklist()
        except (json.JSONDecodeError, TokenError, TypeError, AttributeError):
            pass
        return JsonResponse({'detail': 'Sesión cerrada correctamente.'})


@method_decorator(csrf_exempt, name='dispatch')
class MeView(View):
    @require_roles('ADMINISTRADOR', 'CAJERO')
    def get(self, request):
        return JsonResponse({'user': serialize_user(request.pos_user)})


@method_decorator(csrf_exempt, name='dispatch')
class AdminCheckView(View):
    @require_roles('ADMINISTRADOR')
    def get(self, request):
        return JsonResponse({
            'detail': 'Acceso de administrador confirmado.',
            'user': serialize_user(request.pos_user),
        })
