"""
Controladores de Ventas, Ventas Abiertas, Correcciones, Reembolsos, Compras y Reportes
(backend/pos/views/operaciones.py)
"""
import json
from datetime import timedelta
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt

from pos.forms import VentaValidatorForm
from pos.models import Venta, Compra, Reembolso
from pos.permissions import require_roles
from pos.serializers import (
    serialize_venta,
    serialize_reembolso,
    serialize_compra,
)
from pos.services import PosBusinessService


def _parse_sale_pk(raw_pk):
    s = str(raw_pk).strip().upper()
    if s.startswith('V-'):
        s = s[2:]
    return int(s)


def _parse_purchase_pk(raw_pk):
    s = str(raw_pk).strip().upper()
    if s.startswith('C-'):
        s = s[2:]
    return int(s)


@method_decorator(csrf_exempt, name='dispatch')
class VentaListView(View):
    @require_roles('ADMINISTRADOR', 'CAJERO')
    def get(self, request):
        estado = request.GET.get('estado')
        qs = (
            Venta.objects.select_related('cliente', 'usuario', 'descuento', 'corregida_por')
            .prefetch_related('detalles', 'reembolsos__detalles')
            .all()
        )
        if estado == 'abierta':
            qs = qs.filter(estado='abierta')
        elif estado == 'cerrada':
            qs = qs.filter(estado__in=['cerrada', 'corregida'])
        return JsonResponse([serialize_venta(v) for v in qs], safe=False)

    @require_roles('ADMINISTRADOR', 'CAJERO')
    def post(self, request):
        try:
            data = json.loads(request.body or '{}')
        except json.JSONDecodeError:
            return JsonResponse({'errors': {'body': ['JSON inválido.']}}, status=400)

        form = VentaValidatorForm(data)
        if not form.is_valid():
            return JsonResponse({'errors': form.errors}, status=400)

        try:
            venta = PosBusinessService.crear_o_actualizar_venta(data, user=request.pos_user)
        except ValidationError as exc:
            return JsonResponse({'errors': exc.message_dict}, status=400)

        venta_refrescada = (
            Venta.objects.select_related('cliente', 'usuario', 'descuento', 'corregida_por')
            .prefetch_related('detalles', 'reembolsos__detalles')
            .get(pk=venta.pk)
        )
        return JsonResponse(serialize_venta(venta_refrescada), status=201)


@method_decorator(csrf_exempt, name='dispatch')
class VentaDetailView(View):
    @require_roles('ADMINISTRADOR', 'CAJERO')
    def get(self, request, pk):
        num_pk = _parse_sale_pk(pk)
        venta = get_object_or_404(
            Venta.objects.select_related('cliente', 'usuario', 'descuento', 'corregida_por')
            .prefetch_related('detalles', 'reembolsos__detalles'),
            pk=num_pk,
        )
        return JsonResponse(serialize_venta(venta))

    @require_roles('ADMINISTRADOR', 'CAJERO')
    def put(self, request, pk):
        """Actualiza o cierra una venta abierta existente."""
        num_pk = _parse_sale_pk(pk)
        venta = get_object_or_404(Venta, pk=num_pk)
        try:
            data = json.loads(request.body or '{}')
        except json.JSONDecodeError:
            return JsonResponse({'errors': {'body': ['JSON inválido.']}}, status=400)

        form = VentaValidatorForm(data)
        if not form.is_valid():
            return JsonResponse({'errors': form.errors}, status=400)

        try:
            venta = PosBusinessService.crear_o_actualizar_venta(
                data,
                user=request.pos_user,
                venta_instance=venta,
            )
        except ValidationError as exc:
            return JsonResponse({'errors': exc.message_dict}, status=400)

        venta_refrescada = (
            Venta.objects.select_related('cliente', 'usuario', 'descuento', 'corregida_por')
            .prefetch_related('detalles', 'reembolsos__detalles')
            .get(pk=venta.pk)
        )
        return JsonResponse(serialize_venta(venta_refrescada))

    @require_roles('ADMINISTRADOR', 'CAJERO')
    def delete(self, request, pk):
        """Permite descartar únicamente ventas abiertas que no se hayan cerrado."""
        num_pk = _parse_sale_pk(pk)
        venta = get_object_or_404(Venta, pk=num_pk)
        if venta.estado != 'abierta':
            return JsonResponse(
                {'detail': 'No se puede eliminar una venta cerrada del historial.'},
                status=400,
            )
        venta.delete()
        return JsonResponse({'deleted': True, 'id': f'V-{num_pk}'})


@method_decorator(csrf_exempt, name='dispatch')
class VentaCorregirView(View):
    """
    Endpoint exclusivo para ADMINISTRADOR:
    Permite corregir una venta cerrada conservando su ID original y ajustando inventario.
    """
    @require_roles('ADMINISTRADOR')
    def post(self, request, pk):
        return self._corregir(request, pk)

    @require_roles('ADMINISTRADOR')
    def put(self, request, pk):
        return self._corregir(request, pk)

    def _corregir(self, request, pk):
        num_pk = _parse_sale_pk(pk)
        venta = get_object_or_404(
            Venta.objects.prefetch_related('detalles', 'reembolsos__detalles'),
            pk=num_pk,
        )
        try:
            data = json.loads(request.body or '{}')
        except json.JSONDecodeError:
            return JsonResponse({'errors': {'body': ['JSON inválido.']}}, status=400)

        try:
            venta = PosBusinessService.corregir_venta_cerrada(
                venta,
                data,
                user=request.pos_user,
            )
        except ValidationError as exc:
            return JsonResponse({'errors': exc.message_dict}, status=400)

        venta_refrescada = (
            Venta.objects.select_related('cliente', 'usuario', 'descuento', 'corregida_por')
            .prefetch_related('detalles', 'reembolsos__detalles')
            .get(pk=venta.pk)
        )
        return JsonResponse(serialize_venta(venta_refrescada))


@method_decorator(csrf_exempt, name='dispatch')
class VentaReembolsarView(View):
    """
    Endpoint exclusivo para ADMINISTRADOR:
    Registra un reembolso parcial o total de una venta cerrada/corregida.
    """
    @require_roles('ADMINISTRADOR')
    def post(self, request, pk):
        num_pk = _parse_sale_pk(pk)
        venta = get_object_or_404(
            Venta.objects.prefetch_related('detalles', 'reembolsos__detalles'),
            pk=num_pk,
        )
        try:
            data = json.loads(request.body or '{}')
        except json.JSONDecodeError:
            return JsonResponse({'errors': {'body': ['JSON inválido.']}}, status=400)

        try:
            reembolso = PosBusinessService.registrar_reembolso(
                venta,
                data,
                user=request.pos_user,
            )
        except ValidationError as exc:
            return JsonResponse({'errors': exc.message_dict}, status=400)

        venta_refrescada = (
            Venta.objects.select_related('cliente', 'usuario', 'descuento', 'corregida_por')
            .prefetch_related('detalles', 'reembolsos__detalles')
            .get(pk=venta.pk)
        )
        return JsonResponse({
            'reembolso': serialize_reembolso(reembolso),
            'venta': serialize_venta(venta_refrescada),
        }, status=201)


@method_decorator(csrf_exempt, name='dispatch')
class ReembolsoListView(View):
    @require_roles('ADMINISTRADOR', 'CAJERO')
    def get(self, request):
        reembolsos = Reembolso.objects.select_related('usuario', 'venta').prefetch_related('detalles').all()
        return JsonResponse([serialize_reembolso(r) for r in reembolsos], safe=False)


@method_decorator(csrf_exempt, name='dispatch')
class CompraListView(View):
    @require_roles('ADMINISTRADOR')
    def get(self, request):
        compras = Compra.objects.select_related('proveedor', 'usuario').prefetch_related('detalles').all()
        return JsonResponse([serialize_compra(c) for c in compras], safe=False)

    @require_roles('ADMINISTRADOR')
    def post(self, request):
        try:
            data = json.loads(request.body or '{}')
        except json.JSONDecodeError:
            return JsonResponse({'errors': {'body': ['JSON inválido.']}}, status=400)

        try:
            compra = PosBusinessService.registrar_compra(data, user=request.pos_user)
        except ValidationError as exc:
            return JsonResponse({'errors': exc.message_dict}, status=400)

        compra_refrescada = (
            Compra.objects.select_related('proveedor', 'usuario')
            .prefetch_related('detalles')
            .get(pk=compra.pk)
        )
        return JsonResponse(serialize_compra(compra_refrescada), status=201)


@method_decorator(csrf_exempt, name='dispatch')
class CompraDetailView(View):
    @require_roles('ADMINISTRADOR')
    def get(self, request, pk):
        num_pk = _parse_purchase_pk(pk)
        compra = get_object_or_404(
            Compra.objects.select_related('proveedor', 'usuario').prefetch_related('detalles'),
            pk=num_pk,
        )
        return JsonResponse(serialize_compra(compra))


@method_decorator(csrf_exempt, name='dispatch')
class ReporteView(View):
    """
    Módulo de reportes accesible únicamente para ADMINISTRADOR.
    Consulta la base de datos real por rango de fechas (mínimo 1 día).
    """
    @require_roles('ADMINISTRADOR')
    def get(self, request):
        hoy = timezone.localdate()
        hace_30 = hoy - timedelta(days=29)
        fecha_inicio = request.GET.get('fecha_inicio') or hace_30.strftime('%Y-%m-%d')
        fecha_fin = request.GET.get('fecha_fin') or hoy.strftime('%Y-%m-%d')

        try:
            reporte = PosBusinessService.obtener_reporte(fecha_inicio, fecha_fin)
        except ValidationError as exc:
            return JsonResponse({'errors': exc.message_dict}, status=400)

        return JsonResponse(reporte)
