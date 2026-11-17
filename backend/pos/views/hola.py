from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json


def hola_mundo(request):
    return HttpResponse('¡Hola Mundo desde Django!')


@csrf_exempt
def saludo_parametro(request, nombre='Estudiante'):
    """Nivel 2: Parámetros de ruta y query strings (?rol=...)"""
    rol = request.GET.get('rol', 'visitante')
    return JsonResponse({
        'mensaje': f'¡Hola {nombre} desde Papel y Luna!',
        'rol': rol,
        'metodo': request.method,
    })
