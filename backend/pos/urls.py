from django.urls import path
from pos.views.hola import hola_mundo, saludo_parametro
from pos.views.auth import LoginView, LogoutView, MeView, AdminCheckView
from rest_framework_simplejwt.views import TokenRefreshView
from pos.views.productos import ProductoListView, ProductoDetailView
from pos.views.operaciones import (
    VentaListView,
    VentaDetailView,
    VentaCorregirView,
    VentaReembolsarView,
    ReembolsoListView,
    CompraListView,
    CompraDetailView,
    ReporteView,
)
from pos.views.entidades import (
    ClienteListView,
    ClienteDetailView,
    ProveedorListView,
    ProveedorDetailView,
    CategoriaListView,
    CategoriaDetailView,
    DescuentoListView,
    DescuentoDetailView,
    FaltanteListView,
    FaltanteDetailView,
    FaltanteAgrupadoView,
    RequestLogListView,
)

urlpatterns = [
    path('hola/', hola_mundo),
    path('saludo/<str:nombre>/', saludo_parametro),

    # Autenticación y sesión
    path('auth/login/', LoginView.as_view()),
    path('auth/logout/', LogoutView.as_view()),
    path('auth/me/', MeView.as_view()),
    path('auth/admin-check/', AdminCheckView.as_view()),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Catálogo y directorio
    path('productos/', ProductoListView.as_view()),
    path('productos/<int:pk>/', ProductoDetailView.as_view()),
    path('categorias/', CategoriaListView.as_view()),
    path('categorias/<int:pk>/', CategoriaDetailView.as_view()),
    path('clientes/', ClienteListView.as_view()),
    path('clientes/<int:pk>/', ClienteDetailView.as_view()),
    path('proveedores/', ProveedorListView.as_view()),
    path('proveedores/<int:pk>/', ProveedorDetailView.as_view()),

    # Descuentos
    path('descuentos/', DescuentoListView.as_view()),
    path('descuentos/<int:pk>/', DescuentoDetailView.as_view()),

    # Ventas, Ventas Abiertas, Correcciones y Reembolsos
    path('ventas/', VentaListView.as_view()),
    path('ventas/<str:pk>/', VentaDetailView.as_view()),
    path('ventas/<str:pk>/corregir/', VentaCorregirView.as_view()),
    path('ventas/<str:pk>/reembolsar/', VentaReembolsarView.as_view()),
    path('reembolsos/', ReembolsoListView.as_view()),

    # Compras
    path('compras/', CompraListView.as_view()),
    path('compras/<str:pk>/', CompraDetailView.as_view()),

    # Faltantes
    path('faltantes/', FaltanteListView.as_view()),
    path('faltantes/agrupados/', FaltanteAgrupadoView.as_view()),
    path('faltantes/<int:pk>/', FaltanteDetailView.as_view()),

    # Reportes y Auditoría
    path('reportes/', ReporteView.as_view()),
    path('logs/', RequestLogListView.as_view()),
]
