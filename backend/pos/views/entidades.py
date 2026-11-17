"""
Controladores de Entidades, Descuentos, Faltantes y Auditoría (backend/pos/views/entidades.py)
"""
import json
from django.db.models import Q, Sum, Count
from django.db.models.deletion import ProtectedError
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt

from pos.forms import (
    CategoriaForm,
    ClienteForm,
    ProveedorForm,
    DescuentoForm,
    FaltanteForm,
)
from pos.models import (
    Categoria,
    Cliente,
    Proveedor,
    Producto,
    Descuento,
    Venta,
    Compra,
    Faltante,
    RequestLog,
)
from pos.permissions import require_roles
from pos.serializers import (
    serialize_categoria,
    serialize_cliente,
    serialize_proveedor,
    serialize_descuento,
    serialize_faltante,
)


@method_decorator(csrf_exempt, name='dispatch')
class CategoriaListView(View):
    @require_roles('ADMINISTRADOR', 'CAJERO')
    def get(self, request):
        categorias = Categoria.objects.prefetch_related('productos').all()
        return JsonResponse([serialize_categoria(c) for c in categorias], safe=False)

    @require_roles('ADMINISTRADOR')
    def post(self, request):
        try:
            data = json.loads(request.body or '{}')
        except json.JSONDecodeError:
            return JsonResponse({'errors': {'body': ['JSON inválido.']}}, status=400)
        form = CategoriaForm(data)
        if not form.is_valid():
            return JsonResponse({'errors': form.errors}, status=400)
        instance = form.save()
        return JsonResponse(serialize_categoria(instance), status=201)


@method_decorator(csrf_exempt, name='dispatch')
class CategoriaDetailView(View):
    @require_roles('ADMINISTRADOR')
    def put(self, request, pk):
        instance = get_object_or_404(Categoria, pk=pk)
        nombre_anterior = instance.nombre
        try:
            data = json.loads(request.body or '{}')
        except json.JSONDecodeError:
            return JsonResponse({'errors': {'body': ['JSON inválido.']}}, status=400)
        form = CategoriaForm(data, instance=instance)
        if not form.is_valid():
            return JsonResponse({'errors': form.errors}, status=400)
        instance = form.save()
        # Mantener sincronizado el nombre en productos asociados
        Producto.objects.filter(
            Q(categoria_rel=instance) | Q(categoria__iexact=nombre_anterior)
        ).update(categoria=instance.nombre, categoria_rel=instance)
        return JsonResponse(serialize_categoria(instance))

    @require_roles('ADMINISTRADOR')
    def delete(self, request, pk):
        instance = get_object_or_404(Categoria, pk=pk)
        tiene_productos = Producto.objects.filter(
            Q(categoria_rel=instance) | Q(categoria__iexact=instance.nombre)
        ).exists()
        if tiene_productos:
            return JsonResponse(
                {
                    'detail': f"No se puede eliminar la categoría '{instance.nombre}' porque tiene productos asociados."
                },
                status=400,
            )
        try:
            instance.delete()
        except ProtectedError:
            return JsonResponse(
                {
                    'detail': f"No se puede eliminar la categoría '{instance.nombre}' porque tiene productos asociados."
                },
                status=400,
            )
        return JsonResponse({'deleted': True, 'id': pk, 'deleted_record_id': pk})


@method_decorator(csrf_exempt, name='dispatch')
class ClienteListView(View):
    @require_roles('ADMINISTRADOR', 'CAJERO')
    def get(self, request):
        clientes = Cliente.objects.all()
        return JsonResponse([serialize_cliente(c) for c in clientes], safe=False)

    @require_roles('ADMINISTRADOR', 'CAJERO')
    def post(self, request):
        try:
            data = json.loads(request.body or '{}')
        except json.JSONDecodeError:
            return JsonResponse({'errors': {'body': ['JSON inválido.']}}, status=400)
        form = ClienteForm(data)
        if not form.is_valid():
            return JsonResponse({'errors': form.errors}, status=400)
        instance = form.save()
        return JsonResponse(serialize_cliente(instance), status=201)


@method_decorator(csrf_exempt, name='dispatch')
class ClienteDetailView(View):
    @require_roles('ADMINISTRADOR', 'CAJERO')
    def put(self, request, pk):
        instance = get_object_or_404(Cliente, pk=pk)
        try:
            data = json.loads(request.body or '{}')
        except json.JSONDecodeError:
            return JsonResponse({'errors': {'body': ['JSON inválido.']}}, status=400)
        form = ClienteForm(data, instance=instance)
        if not form.is_valid():
            return JsonResponse({'errors': form.errors}, status=400)
        instance = form.save()
        return JsonResponse(serialize_cliente(instance))

    @require_roles('ADMINISTRADOR', 'CAJERO')
    def delete(self, request, pk):
        instance = get_object_or_404(Cliente, pk=pk)
        if Venta.objects.filter(cliente=instance).exists():
            return JsonResponse(
                {
                    'detail': f"No se puede eliminar al cliente '{instance.nombre}' porque tiene ventas asociadas."
                },
                status=400,
            )
        try:
            instance.delete()
        except ProtectedError:
            return JsonResponse(
                {
                    'detail': f"No se puede eliminar al cliente '{instance.nombre}' porque tiene registros asociados."
                },
                status=400,
            )
        return JsonResponse({'deleted': True, 'id': pk, 'deleted_record_id': pk})


@method_decorator(csrf_exempt, name='dispatch')
class ProveedorListView(View):
    @require_roles('ADMINISTRADOR', 'CAJERO')
    def get(self, request):
        proveedores = Proveedor.objects.all()
        return JsonResponse([serialize_proveedor(p) for p in proveedores], safe=False)

    @require_roles('ADMINISTRADOR')
    def post(self, request):
        try:
            data = json.loads(request.body or '{}')
        except json.JSONDecodeError:
            return JsonResponse({'errors': {'body': ['JSON inválido.']}}, status=400)
        form = ProveedorForm(data)
        if not form.is_valid():
            return JsonResponse({'errors': form.errors}, status=400)
        instance = form.save()
        return JsonResponse(serialize_proveedor(instance), status=201)


@method_decorator(csrf_exempt, name='dispatch')
class ProveedorDetailView(View):
    @require_roles('ADMINISTRADOR')
    def put(self, request, pk):
        instance = get_object_or_404(Proveedor, pk=pk)
        try:
            data = json.loads(request.body or '{}')
        except json.JSONDecodeError:
            return JsonResponse({'errors': {'body': ['JSON inválido.']}}, status=400)
        form = ProveedorForm(data, instance=instance)
        if not form.is_valid():
            return JsonResponse({'errors': form.errors}, status=400)
        instance = form.save()
        # Actualizar nombre en compras existentes
        Compra.objects.filter(proveedor=instance).update(proveedor_nombre=instance.nombre)
        return JsonResponse(serialize_proveedor(instance))

    @require_roles('ADMINISTRADOR')
    def delete(self, request, pk):
        instance = get_object_or_404(Proveedor, pk=pk)
        if Compra.objects.filter(proveedor=instance).exists() or Faltante.objects.filter(proveedor=instance).exists():
            return JsonResponse(
                {
                    'detail': f"No se puede eliminar al proveedor '{instance.nombre}' porque tiene compras o faltantes asociados."
                },
                status=400,
            )
        try:
            instance.delete()
        except ProtectedError:
            return JsonResponse(
                {
                    'detail': f"No se puede eliminar al proveedor '{instance.nombre}' porque tiene registros asociados."
                },
                status=400,
            )
        return JsonResponse({'deleted': True, 'id': pk, 'deleted_record_id': pk})


@method_decorator(csrf_exempt, name='dispatch')
class DescuentoListView(View):
    @require_roles('ADMINISTRADOR', 'CAJERO')
    def get(self, request):
        solo_activos = request.GET.get('activos') == 'true'
        qs = Descuento.objects.all()
        if solo_activos:
            qs = qs.filter(activo=True)
        return JsonResponse([serialize_descuento(d) for d in qs], safe=False)

    @require_roles('ADMINISTRADOR')
    def post(self, request):
        try:
            data = json.loads(request.body or '{}')
        except json.JSONDecodeError:
            return JsonResponse({'errors': {'body': ['JSON inválido.']}}, status=400)
        if 'activo' not in data:
            data['activo'] = True
        form = DescuentoForm(data)
        if not form.is_valid():
            return JsonResponse({'errors': form.errors}, status=400)
        instance = form.save()
        return JsonResponse(serialize_descuento(instance), status=201)


@method_decorator(csrf_exempt, name='dispatch')
class DescuentoDetailView(View):
    @require_roles('ADMINISTRADOR')
    def put(self, request, pk):
        instance = get_object_or_404(Descuento, pk=pk)
        try:
            data = json.loads(request.body or '{}')
        except json.JSONDecodeError:
            return JsonResponse({'errors': {'body': ['JSON inválido.']}}, status=400)
        if 'activo' not in data:
            data['activo'] = instance.activo
        form = DescuentoForm(data, instance=instance)
        if not form.is_valid():
            return JsonResponse({'errors': form.errors}, status=400)
        instance = form.save()
        return JsonResponse(serialize_descuento(instance))

    @require_roles('ADMINISTRADOR')
    def delete(self, request, pk):
        instance = get_object_or_404(Descuento, pk=pk)
        # Venta tiene on_delete=SET_NULL y guarda copia inmutable de descuento_nombre, descuento_tipo,
        # descuento_valor y descuento_monto, por lo que eliminar el descuento del catálogo
        # no modifica jamás las ventas históricas.
        instance.delete()
        return JsonResponse({'deleted': True, 'id': pk})


@method_decorator(csrf_exempt, name='dispatch')
class FaltanteListView(View):
    @require_roles('ADMINISTRADOR', 'CAJERO')
    def get(self, request):
        qs = Faltante.objects.select_related('producto', 'proveedor', 'registrado_por').all()
        tipo = request.GET.get('tipo')
        proveedor_id = request.GET.get('proveedorId')
        estado = request.GET.get('estado')
        if tipo in ('inexistente', 'agotado'):
            qs = qs.filter(tipo=tipo)
        if proveedor_id:
            qs = qs.filter(proveedor_id=proveedor_id)
        if estado in ('pendiente', 'resuelto'):
            qs = qs.filter(estado=estado)
        return JsonResponse([serialize_faltante(f) for f in qs], safe=False)

    @require_roles('ADMINISTRADOR', 'CAJERO')
    def post(self, request):
        try:
            data = json.loads(request.body or '{}')
        except json.JSONDecodeError:
            return JsonResponse({'errors': {'body': ['JSON inválido.']}}, status=400)

        form = FaltanteForm(data)
        if not form.is_valid():
            return JsonResponse({'errors': form.errors}, status=400)

        cleaned = form.cleaned_data
        producto = None
        if cleaned.get('productoId'):
            producto = Producto.objects.filter(id=cleaned['productoId']).first()
            if not producto:
                return JsonResponse({'errors': {'productoId': ['El producto seleccionado no existe.']}}, status=400)

        proveedor = None
        if cleaned.get('proveedorId'):
            proveedor = Proveedor.objects.filter(id=cleaned['proveedorId']).first()
            if not proveedor:
                return JsonResponse({'errors': {'proveedorId': ['El proveedor seleccionado no existe.']}}, status=400)

        descripcion = (cleaned.get('descripcion') or '').strip()
        if producto and not descripcion:
            descripcion = producto.nombre

        faltante = Faltante.objects.create(
            producto=producto,
            descripcion_texto=descripcion,
            cantidad_solicitada=cleaned['cantidadSolicitada'],
            tipo=cleaned['tipo'],
            proveedor=proveedor,
            estado=cleaned.get('estado') or 'pendiente',
            registrado_por=request.pos_user,
        )
        return JsonResponse(serialize_faltante(faltante), status=201)


@method_decorator(csrf_exempt, name='dispatch')
class FaltanteDetailView(View):
    @require_roles('ADMINISTRADOR', 'CAJERO')
    def put(self, request, pk):
        return self._update(request, pk)

    @require_roles('ADMINISTRADOR', 'CAJERO')
    def patch(self, request, pk):
        return self._update(request, pk)

    def _update(self, request, pk):
        faltante = get_object_or_404(Faltante, pk=pk)
        try:
            data = json.loads(request.body or '{}')
        except json.JSONDecodeError:
            return JsonResponse({'errors': {'body': ['JSON inválido.']}}, status=400)

        if 'estado' in data and data['estado'] in ('pendiente', 'resuelto'):
            faltante.estado = data['estado']
        if 'cantidadSolicitada' in data:
            cant = int(data['cantidadSolicitada'] or 0)
            if cant < 1:
                return JsonResponse({'errors': {'cantidadSolicitada': ['La cantidad debe ser mayor a 0.']}}, status=400)
            faltante.cantidad_solicitada = cant
        if 'tipo' in data and data['tipo'] in ('inexistente', 'agotado'):
            faltante.tipo = data['tipo']
        if 'proveedorId' in data:
            prov_id = data['proveedorId']
            faltante.proveedor = Proveedor.objects.filter(id=prov_id).first() if prov_id else None
        if 'descripcion' in data and data['descripcion']:
            faltante.descripcion_texto = str(data['descripcion']).strip()

        faltante.save()
        return JsonResponse(serialize_faltante(faltante))

    @require_roles('ADMINISTRADOR')
    def delete(self, request, pk):
        faltante = get_object_or_404(Faltante, pk=pk)
        faltante.delete()
        return JsonResponse({'deleted': True, 'id': pk})


@method_decorator(csrf_exempt, name='dispatch')
class FaltanteAgrupadoView(View):
    """
    Agrupa faltantes por nombre normalizado y proveedor para facilitar futuras compras.
    """
    @require_roles('ADMINISTRADOR', 'CAJERO')
    def get(self, request):
        solo_pendientes = request.GET.get('estado', 'pendiente')
        qs = Faltante.objects.all()
        if solo_pendientes in ('pendiente', 'resuelto'):
            qs = qs.filter(estado=solo_pendientes)

        agrupados = (
            qs.values(
                'nombre_normalizado',
                'tipo',
                'producto_id',
                'proveedor_id',
                'proveedor__nombre',
            )
            .annotate(
                totalCantidad=Sum('cantidad_solicitada'),
                solicitudes=Count('id'),
            )
            .order_by('-totalCantidad', 'nombre_normalizado')
        )
        resultado = [
            {
                'nombreNormalizado': row['nombre_normalizado'],
                'tipo': row['tipo'],
                'productoId': row['producto_id'] or '',
                'proveedorId': row['proveedor_id'] or '',
                'proveedorNombre': row['proveedor__nombre'] or 'Sin proveedor asignado',
                'totalCantidad': row['totalCantidad'] or 0,
                'solicitudes': row['solicitudes'] or 0,
            }
            for row in agrupados
        ]
        return JsonResponse(resultado, safe=False)


@method_decorator(csrf_exempt, name='dispatch')
class RequestLogListView(View):
    """Permite consultar la tabla request_log generada por RequestLoggingMiddleware."""
    @require_roles('ADMINISTRADOR')
    def get(self, request):
        logs = list(RequestLog.objects.values('id', 'method', 'path', 'ip', 'called_at')[:100])
        return JsonResponse(logs, safe=False)
