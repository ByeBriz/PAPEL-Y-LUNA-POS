from django.conf import settings
from django.http import JsonResponse
from django.urls import path, include
from pos.views.hola import hola_mundo, saludo_parametro


def authors(request):
    return JsonResponse(settings.AUTHORS, safe=False)


urlpatterns = [
    path('authors', authors, name='authors'),
    path('hola/', hola_mundo),
    path('mi_app/hola/', hola_mundo),
    path('pos/hola/', hola_mundo),
    path('mi_app/saludo/<str:nombre>/', saludo_parametro),
    path('api/', include('pos.urls')),
]
