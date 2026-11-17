"""
Capa de Autenticación y Permisos por Rol (backend/pos/permissions.py)
Verifica tokens de sesión y roles (ADMINISTRADOR vs CAJERO) en el backend.
Compatible con Django REST Framework y vistas estándar de Django.
"""
from functools import wraps
from django.http import JsonResponse
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed, InvalidToken, TokenError
from pos.models import SesionToken, PerfilUsuario


def get_user_role(user) -> str:
    if not user or not getattr(user, 'is_authenticated', False):
        return ''
    try:
        if hasattr(user, 'perfil') and user.perfil:
            return user.perfil.rol
    except PerfilUsuario.DoesNotExist:
        pass
    return 'ADMINISTRADOR' if (user.is_superuser or user.is_staff) else 'CAJERO'


def authenticate_request(request):
    """
    Obtiene el usuario autenticado a partir del header Authorization: Bearer <token>
    (o Token <token>). Asigna request.pos_user y request.pos_role.
    """
    auth_header = request.META.get('HTTP_AUTHORIZATION', '').strip()
    token_key = ''
    if auth_header.lower().startswith('bearer '):
        token_key = auth_header[7:].strip()
    elif auth_header.lower().startswith('token '):
        token_key = auth_header[6:].strip()

    if token_key:
        try:
            jwt_auth = JWTAuthentication()
            validated_token = jwt_auth.get_validated_token(token_key.encode('utf-8'))
            jwt_user = jwt_auth.get_user(validated_token)
            request.user = jwt_user
            request.pos_user = jwt_user
            request.pos_role = get_user_role(jwt_user)
            request.pos_token = ''
            request.pos_jwt = True
            return jwt_user, request.pos_role
        except (InvalidToken, AuthenticationFailed, TokenError, TypeError, UnicodeEncodeError):
            # Si no es un JWT, se conserva compatibilidad con tokens opacos previos.
            pass

        token_obj = (
            SesionToken.objects.select_related('user', 'user__perfil')
            .filter(key=token_key, user__is_active=True)
            .first()
        )
        if token_obj:
            request.user = token_obj.user
            request.pos_user = token_obj.user
            request.pos_role = get_user_role(token_obj.user)
            request.pos_token = token_obj.key
            request.pos_jwt = False
            return token_obj.user, request.pos_role

    request.pos_user = None
    request.pos_role = ''
    request.pos_token = ''
    request.pos_jwt = False
    return None, ''


def require_roles(*allowed_roles):
    """
    Decorador para métodos de vistas que exige autenticación y pertenencia
    a uno de los roles permitidos ('ADMINISTRADOR', 'CAJERO').
    """
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped(self_or_request, *args, **kwargs):
            # Soporta tanto métodos de clase (self, request, ...) como funciones (request, ...)
            if hasattr(self_or_request, 'META'):
                request = self_or_request
            else:
                request = args[0]

            user, role = authenticate_request(request)
            if not user:
                return JsonResponse(
                    {'detail': 'Debes iniciar sesión para realizar esta operación.', 'code': 'not_authenticated'},
                    status=401,
                )
            if allowed_roles and role not in allowed_roles:
                return JsonResponse(
                    {
                        'detail': f'No tienes permisos para ejecutar esta acción. Se requiere rol: {", ".join(allowed_roles)}.',
                        'code': 'permission_denied',
                    },
                    status=403,
                )
            return view_func(self_or_request, *args, **kwargs)
        return _wrapped
    return decorator


# Clases de permisos compatibles con Django REST Framework
class BasePosPermission:
    allowed_roles = ()

    def has_permission(self, request, view):
        user, role = authenticate_request(request)
        if not user:
            return False
        if not self.allowed_roles:
            return True
        return role in self.allowed_roles


class IsAuthenticatedPos(BasePosPermission):
    allowed_roles = ('ADMINISTRADOR', 'CAJERO')


class IsAdminPos(BasePosPermission):
    allowed_roles = ('ADMINISTRADOR',)
