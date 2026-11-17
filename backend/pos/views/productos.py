"""
Controladores de Productos (backend/pos/views/productos.py)
Permite:
- Consultar productos (ADMINISTRADOR y CAJERO)
- Crear productos (solo ADMINISTRADOR)
- Editar productos (ADMINISTRADOR y CAJERO para permitir edición desde el flujo de venta)
- Eliminar productos (solo ADMINISTRADOR, bloqueando eliminación si tiene ventas/compras/faltantes asociados)
"""
import json
from django.db.models.deletion import ProtectedError
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt

from pos.forms import ProductoForm
from pos.models import Producto, Categoria, DetalleVenta, DetalleCompra, Faltante
from pos.permissions import require_roles
from pos.serializers import serialize_producto


def _resolve_categoria(data):
    cat_id = data.get('categoriaId')
    cat_nombre = (data.get('categoria') or '').strip()
    if cat_id:
        cat_obj = Categoria.objects.filter(id=cat_id).first()
        if cat_obj:
            return cat_obj
    if cat_nombre:
        cat_obj = Categoria.objects.filter(nombre__iexact=cat_nombre).first()
        if cat_obj:
            return cat_obj
    return None


@method_decorator(csrf_exempt, name='dispatch')
class ProductoListView(View):
    @require_roles('ADMINISTRADOR', 'CAJERO')
    def get(self, request):
        productos = Producto.objects.select_related('categoria_rel').all()
        return JsonResponse([serialize_producto(p) for p in productos], safe=False)

    @require_roles('ADMINISTRADOR')
    def post(self, request):
        try:
            data = json.loads(request.body or '{}')
        except json.JSONDecodeError:
            return JsonResponse({'errors': {'body': ['JSON inválido en la petición.']}}, status=400)

        cat_obj = _resolve_categoria(data)
        if cat_obj:
            data['categoria'] = cat_obj.nombre

        form = ProductoForm(data)
        if not form.is_valid():
            return JsonResponse({'errors': form.errors}, status=400)

        if not cat_obj:
            return JsonResponse(
                {'errors': {'categoria': ['La categoría seleccionada no existe en el sistema.']}},
                status=400,
            )

        producto = form.save(commit=False)
        producto.categoria_rel = cat_obj
        producto.categoria = cat_obj.nombre
        producto.save()
        return JsonResponse(serialize_producto(producto), status=201)


@method_decorator(csrf_exempt, name='dispatch')
class ProductoDetailView(View):
    @require_roles('ADMINISTRADOR', 'CAJERO')
    def get(self, request, pk):
        producto = get_object_or_404(Producto.objects.select_related('categoria_rel'), pk=pk)
        return JsonResponse(serialize_producto(producto))

    @require_roles('ADMINISTRADOR', 'CAJERO')
    def put(self, request, pk):
        return self._update(request, pk, partial=False)

    @require_roles('ADMINISTRADOR', 'CAJERO')
    def patch(self, request, pk):
        return self._update(request, pk, partial=True)

    def _update(self, request, pk, partial=False):
        producto = get_object_or_404(Producto.objects.select_related('categoria_rel'), pk=pk)
        try:
            incoming = json.loads(request.body or '{}')
        except json.JSONDecodeError:
            return JsonResponse({'errors': {'body': ['JSON inválido en la petición.']}}, status=400)

        base_data = {
            'codigo': producto.codigo,
            'nombre': producto.nombre,
            'categoria': producto.categoria_rel.nombre if producto.categoria_rel else producto.categoria,
            'precio': producto.precio,
            'costo': producto.costo,
            'stock': producto.stock,
            'imagen': producto.imagen,
        }
        if partial:
            base_data.update(incoming)
            data = base_data
        else:
            base_data.update(incoming)
            data = base_data

        cat_obj = _resolve_categoria(data)
        if cat_obj:
            data['categoria'] = cat_obj.nombre

        form = ProductoForm(data, instance=producto)
        if not form.is_valid():
            return JsonResponse({'errors': form.errors}, status=400)

        if not cat_obj:
            return JsonResponse(
                {'errors': {'categoria': ['La categoría seleccionada no existe en el sistema.']}},
                status=400,
            )

        producto = form.save(commit=False)
        producto.categoria_rel = cat_obj
        producto.categoria = cat_obj.nombre
        producto.save()
        return JsonResponse(serialize_producto(producto))

    @require_roles('ADMINISTRADOR')
    def delete(self, request, pk):
        producto = get_object_or_404(Producto, pk=pk)
        tiene_ventas = DetalleVenta.objects.filter(producto=producto).exists()
        tiene_compras = DetalleCompra.objects.filter(producto=producto).exists()
        tiene_faltantes = Faltante.objects.filter(producto=producto).exists()

        if tiene_ventas or tiene_compras or tiene_faltantes:
            return JsonResponse(
                {
                    'detail': f"No se puede eliminar el producto '{producto.nombre}' porque tiene registros históricos asociados (ventas, compras o faltantes)."
                },
                status=400,
            )

        try:
            producto.delete()
        except ProtectedError:
            return JsonResponse(
                {
                    'detail': f"No se puede eliminar el producto '{producto.nombre}' porque está asociado a operaciones registradas."
                },
                status=400,
            )
        return JsonResponse({'deleted': True, 'id': pk, 'internal_audit_id': f'AUD-{pk}'})
