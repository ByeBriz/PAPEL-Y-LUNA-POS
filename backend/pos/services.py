"""
Capa de Servicio (backend/pos/services.py)
Contiene toda la lógica de negocio transaccional para:
- Ventas (cerradas y abiertas)
- Corrección de ventas cerradas
- Reembolsos (parciales y totales con ajuste de inventario y descuentos proporcionales)
- Compras y actualización de inventario
- Faltantes y normalización
- Reportes administrativos por rango de fechas
"""
from datetime import datetime, time
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Sum, Count, F, Q
from django.utils import timezone

from pos.models import (
    Categoria,
    Cliente,
    Proveedor,
    Producto,
    Descuento,
    Venta,
    DetalleVenta,
    Reembolso,
    DetalleReembolso,
    Compra,
    DetalleCompra,
    Faltante,
    normalizar_texto_producto,
)


class PosBusinessService:
    IVA_RATE = 0.19

    @staticmethod
    def _parse_int(val, default=0):
        try:
            if val is None or val == '':
                return default
            return int(round(float(val)))
        except (ValueError, TypeError):
            return default

    @classmethod
    def calcular_totales_venta(cls, items, descuento_obj=None, descuento_historico=None):
        """
        Calcula subtotal, descuento_monto, IVA (19%) y total.
        No permite totales negativos ni más de un descuento por venta.
        """
        subtotal = 0
        for item in items:
            cantidad = cls._parse_int(item.get('cantidad'), 0)
            precio = cls._parse_int(item.get('precio'), 0)
            if cantidad <= 0:
                raise ValidationError({'items': ['Todas las cantidades deben ser mayores a 0.']})
            if precio < 0:
                raise ValidationError({'items': ['El precio de venta no puede ser negativo.']})
            subtotal += cantidad * precio

        desc_nombre = ''
        desc_tipo = ''
        desc_valor = 0
        desc_monto = 0

        if descuento_obj:
            desc_nombre = descuento_obj.nombre
            desc_tipo = descuento_obj.tipo
            desc_valor = descuento_obj.valor
        elif descuento_historico and descuento_historico.get('tipo'):
            desc_nombre = descuento_historico.get('nombre', '')
            desc_tipo = descuento_historico.get('tipo', '')
            desc_valor = cls._parse_int(descuento_historico.get('valor'), 0)

        if desc_tipo == 'porcentual' and desc_valor > 0:
            desc_monto = int(round(subtotal * (desc_valor / 100.0)))
        elif desc_tipo == 'fijo' and desc_valor > 0:
            desc_monto = desc_valor

        if desc_monto > subtotal:
            raise ValidationError({
                'descuentoId': [
                    f'El descuento aplicado (${desc_monto:,}) supera el subtotal de la venta (${subtotal:,}). No se permiten totales negativos.'
                ]
            })

        base_gravable = max(0, subtotal - desc_monto)
        iva = int(round(base_gravable * cls.IVA_RATE))
        total = base_gravable + iva

        return {
            'subtotal': subtotal,
            'descuento_nombre': desc_nombre,
            'descuento_tipo': desc_tipo,
            'descuento_valor': desc_valor,
            'descuento_monto': desc_monto,
            'iva': iva,
            'total': total,
        }

    @classmethod
    @transaction.atomic
    def crear_o_actualizar_venta(cls, data, user=None, venta_instance: Venta = None):
        """
        Crea una venta nueva (abierta o cerrada) o actualiza/cierra una venta abierta existente.
        Si estado == 'cerrada', descuenta el inventario dentro de una transacción atómica.
        """
        items_raw = data.get('items', [])
        if not items_raw:
            raise ValidationError({'items': ['La venta debe incluir al menos un producto.']})
        if len(items_raw) > 50:
            raise ValidationError({'items': ['Una sola factura no puede superar 50 líneas de productos.']})

        estado_destino = data.get('estado', 'cerrada')
        if estado_destino not in ('abierta', 'cerrada'):
            raise ValidationError({'estado': ['Estado de venta inválido.']})

        if venta_instance and venta_instance.estado != 'abierta':
            raise ValidationError({
                'estado': ['Esta venta ya fue cerrada. Usa la función de corrección de ventas para modificarla.']
            })

        metodo_pago = data.get('metodoPago') or 'Efectivo'
        if metodo_pago not in ('Efectivo', 'Nequi', 'Debe'):
            raise ValidationError({'metodoPago': ['Método de pago inválido. Usa Efectivo, Nequi o Debe.']})

        cliente = None
        cliente_id = data.get('clienteId')
        if cliente_id not in (None, ''):
            cliente = Cliente.objects.filter(id=cliente_id).first()
            if not cliente:
                raise ValidationError({'clienteId': ['El cliente seleccionado no existe.']})

        if estado_destino == 'cerrada' and metodo_pago == 'Debe' and not cliente:
            raise ValidationError({'clienteId': ['Para ventas a crédito (Debe) es obligatorio seleccionar un cliente.']})

        descuento_obj = None
        descuento_id = data.get('descuentoId')
        if descuento_id not in (None, ''):
            descuento_obj = Descuento.objects.filter(id=descuento_id, activo=True).first()
            if not descuento_obj:
                raise ValidationError({'descuentoId': ['El descuento seleccionado no existe o está inactivo.']})

        # Agrupar líneas del mismo producto si vinieran repetidas
        lineas_preparadas = []
        cantidades_por_producto = {}
        for idx, item in enumerate(items_raw):
            prod_id = item.get('productoId') or item.get('id')
            cantidad = cls._parse_int(item.get('cantidad'), 0)
            if cantidad <= 0:
                raise ValidationError({'items': [f'La cantidad en la línea {idx + 1} debe ser mayor a 0.']})
            producto = Producto.objects.select_for_update().filter(id=prod_id).first()
            if not producto:
                raise ValidationError({'items': [f'El producto con ID {prod_id} no existe en el catálogo.']})

            precio_unitario = cls._parse_int(item.get('precio'), producto.precio)
            if precio_unitario < 100:
                raise ValidationError({'items': [f"El precio de '{producto.nombre}' debe ser mínimo $100 COP."]})

            cantidades_por_producto[producto.id] = cantidades_por_producto.get(producto.id, 0) + cantidad
            lineas_preparadas.append({
                'producto': producto,
                'productoId': producto.id,
                'codigo': producto.codigo,
                'nombre': producto.nombre,
                'cantidad': cantidad,
                'precio': precio_unitario,
            })

        # Validar existencias
        for prod_id, cant_total in cantidades_por_producto.items():
            prod_obj = next(l['producto'] for l in lineas_preparadas if l['productoId'] == prod_id)
            if prod_obj.stock < cant_total:
                raise ValidationError({
                    'stock': [
                        f"Stock insuficiente para '{prod_obj.nombre}' (solicitado: {cant_total}, disponible: {prod_obj.stock})."
                    ]
                })

        totales = cls.calcular_totales_venta(lineas_preparadas, descuento_obj=descuento_obj)

        valor_recibido = cls._parse_int(data.get('recibido'), totales['total'])
        if estado_destino == 'cerrada':
            if metodo_pago == 'Efectivo':
                if data.get('recibido') in (None, ''):
                    valor_recibido = totales['total']
                if valor_recibido < totales['total']:
                    raise ValidationError({
                        'recibido': ['El dinero recibido en efectivo es menor que el total a pagar.']
                    })
                cambio = valor_recibido - totales['total']
            elif metodo_pago == 'Nequi':
                valor_recibido = totales['total']
                cambio = 0
            else:  # Debe
                valor_recibido = 0
                cambio = 0
        else:
            valor_recibido = cls._parse_int(data.get('recibido'), 0)
            cambio = 0

        # Si se cierra la venta, descontar el inventario de cada producto
        if estado_destino == 'cerrada':
            for prod_id, cant_total in cantidades_por_producto.items():
                prod_obj = Producto.objects.select_for_update().get(id=prod_id)
                if prod_obj.stock - cant_total < 0:
                    raise ValidationError({
                        'stock': [f"Operación cancelada: '{prod_obj.nombre}' quedaría con inventario negativo."]
                    })
                prod_obj.stock -= cant_total
                prod_obj.save(update_fields=['stock'])

        items_snapshot = [
            {
                'productoId': l['productoId'],
                'codigo': l['codigo'],
                'nombre': l['nombre'],
                'cantidad': l['cantidad'],
                'precio': l['precio'],
                'subtotal': l['cantidad'] * l['precio'],
            }
            for l in lineas_preparadas
        ]

        if venta_instance is None:
            venta = Venta.objects.create(
                cliente=cliente,
                usuario=user if (user and user.is_authenticated) else None,
                descuento=descuento_obj,
                descuento_nombre=totales['descuento_nombre'],
                descuento_tipo=totales['descuento_tipo'],
                descuento_valor=totales['descuento_valor'],
                descuento_monto=totales['descuento_monto'],
                subtotal=totales['subtotal'],
                iva=totales['iva'],
                total=totales['total'],
                metodo_pago=metodo_pago,
                valor_recibido=valor_recibido,
                cambio=cambio,
                estado=estado_destino,
                items_json=items_snapshot,
            )
        else:
            venta = venta_instance
            venta.cliente = cliente
            if user and user.is_authenticated and not venta.usuario:
                venta.usuario = user
            venta.descuento = descuento_obj
            venta.descuento_nombre = totales['descuento_nombre']
            venta.descuento_tipo = totales['descuento_tipo']
            venta.descuento_valor = totales['descuento_valor']
            venta.descuento_monto = totales['descuento_monto']
            venta.subtotal = totales['subtotal']
            venta.iva = totales['iva']
            venta.total = totales['total']
            venta.metodo_pago = metodo_pago
            venta.valor_recibido = valor_recibido
            venta.cambio = cambio
            venta.estado = estado_destino
            venta.items_json = items_snapshot
            venta.save()
            venta.detalles.all().delete()

        for l in lineas_preparadas:
            DetalleVenta.objects.create(
                venta=venta,
                producto=l['producto'],
                producto_codigo=l['codigo'],
                producto_nombre=l['nombre'],
                cantidad=l['cantidad'],
                precio_unitario=l['precio'],
                subtotal=l['cantidad'] * l['precio'],
            )

        return venta

    @classmethod
    def registrar_venta(cls, data, user=None):
        """Alias compatible con llamadas existentes."""
        return cls.crear_o_actualizar_venta(data, user=user)

    @classmethod
    @transaction.atomic
    def corregir_venta_cerrada(cls, venta: Venta, data, user=None):
        """
        Corrige una venta cerrada conservando su identificador original:
        - Modifica productos, cantidades, precios, cliente, método de pago y descuento.
        - Recalcula subtotal, IVA y total.
        - Ajusta el inventario según la diferencia entre la venta original y la corregida.
        - No permite correcciones que generen inventarios negativos.
        - Registra usuario que corrigió, fecha de corrección y estado 'corregida'.
        """
        if venta.estado == 'abierta':
            raise ValidationError({
                'estado': ['Solo se pueden corregir ventas cerradas. Para una venta abierta usa la opción Retomar.']
            })

        items_raw = data.get('items', [])
        if not items_raw:
            raise ValidationError({'items': ['La venta corregida debe conservar al menos un producto.']})

        metodo_pago = data.get('metodoPago') or venta.metodo_pago
        if metodo_pago not in ('Efectivo', 'Nequi', 'Debe'):
            raise ValidationError({'metodoPago': ['Método de pago inválido.']})

        cliente = None
        cliente_id = data.get('clienteId')
        if cliente_id not in (None, ''):
            cliente = Cliente.objects.filter(id=cliente_id).first()
            if not cliente:
                raise ValidationError({'clienteId': ['El cliente seleccionado no existe.']})

        if metodo_pago == 'Debe' and not cliente:
            raise ValidationError({'clienteId': ['Si el método de pago es Debe, el cliente es obligatorio.']})

        # Cantidades anteriores en la venta
        detalles_previos = list(venta.detalles.all())
        cantidades_anteriores = {}
        if detalles_previos:
            for d in detalles_previos:
                cantidades_anteriores[d.producto_id] = cantidades_anteriores.get(d.producto_id, 0) + d.cantidad
        else:
            for item_ant in (venta.items_json or []):
                pid = cls._parse_int(item_ant.get('productoId'), 0)
                if pid:
                    cantidades_anteriores[pid] = cantidades_anteriores.get(pid, 0) + cls._parse_int(item_ant.get('cantidad'), 0)

        # Cantidades ya reembolsadas en esta venta (no se puede corregir a menos de lo ya reembolsado)
        reembolsadas = {}
        for r in venta.reembolsos.prefetch_related('detalles').all():
            for dr in r.detalles.all():
                reembolsadas[dr.producto_id] = reembolsadas.get(dr.producto_id, 0) + dr.cantidad

        # Nuevas líneas
        lineas_nuevas = []
        cantidades_nuevas = {}
        for item in items_raw:
            prod_id = cls._parse_int(item.get('productoId') or item.get('id'), 0)
            cantidad = cls._parse_int(item.get('cantidad'), 0)
            if cantidad <= 0:
                raise ValidationError({'items': ['Todas las cantidades deben ser mayores a 0.']})
            producto = Producto.objects.select_for_update().filter(id=prod_id).first()
            if not producto:
                raise ValidationError({'items': [f'Producto con ID {prod_id} no encontrado.']})
            precio_unitario = cls._parse_int(item.get('precio'), producto.precio)
            if precio_unitario < 100:
                raise ValidationError({'items': [f"El precio de '{producto.nombre}' debe ser mínimo $100 COP."]})

            cantidades_nuevas[producto.id] = cantidades_nuevas.get(producto.id, 0) + cantidad
            lineas_nuevas.append({
                'producto': producto,
                'productoId': producto.id,
                'codigo': producto.codigo,
                'nombre': producto.nombre,
                'cantidad': cantidad,
                'precio': precio_unitario,
            })

        for pid, cant_reemb in reembolsadas.items():
            nueva_cant = cantidades_nuevas.get(pid, 0)
            if nueva_cant < cant_reemb:
                prod_nom = Producto.objects.filter(id=pid).values_list('nombre', flat=True).first() or f'ID {pid}'
                raise ValidationError({
                    'items': [
                        f"El producto '{prod_nom}' ya tiene {cant_reemb} unidad(es) reembolsada(s); no puedes reducir su cantidad por debajo de {cant_reemb}."
                    ]
                })

        # Calcular diferencias de inventario y verificar que ningún producto quede en negativo
        todos_productos_ids = set(cantidades_anteriores.keys()) | set(cantidades_nuevas.keys())
        for pid in todos_productos_ids:
            prod_obj = Producto.objects.select_for_update().get(id=pid)
            cant_ant = cantidades_anteriores.get(pid, 0)
            cant_nva = cantidades_nuevas.get(pid, 0)
            diferencia = cant_nva - cant_ant  # > 0 consume más stock, < 0 devuelve stock al inventario
            nuevo_stock = prod_obj.stock - diferencia
            if nuevo_stock < 0:
                raise ValidationError({
                    'stock': [
                        f"Stock insuficiente para incrementar '{prod_obj.nombre}' en {diferencia} uds (stock actual: {prod_obj.stock})."
                    ]
                })
            if diferencia != 0:
                prod_obj.stock = nuevo_stock
                prod_obj.save(update_fields=['stock'])

        # Resolver descuento
        descuento_obj = None
        descuento_historico = None
        if 'descuentoId' in data:
            desc_id = data.get('descuentoId')
            if desc_id not in (None, ''):
                descuento_obj = Descuento.objects.filter(id=desc_id).first()
                if not descuento_obj and int(desc_id) == (venta.descuento_id or -1):
                    descuento_historico = {
                        'nombre': venta.descuento_nombre,
                        'tipo': venta.descuento_tipo,
                        'valor': venta.descuento_valor,
                    }
                elif not descuento_obj:
                    raise ValidationError({'descuentoId': ['El descuento seleccionado no existe.']})
        elif venta.descuento_tipo:
            descuento_obj = venta.descuento
            descuento_historico = {
                'nombre': venta.descuento_nombre,
                'tipo': venta.descuento_tipo,
                'valor': venta.descuento_valor,
            }

        totales = cls.calcular_totales_venta(
            lineas_nuevas,
            descuento_obj=descuento_obj,
            descuento_historico=descuento_historico,
        )

        valor_recibido = cls._parse_int(data.get('recibido'), totales['total'])
        if metodo_pago == 'Efectivo':
            if valor_recibido < totales['total']:
                valor_recibido = totales['total']
            cambio = valor_recibido - totales['total']
        elif metodo_pago == 'Nequi':
            valor_recibido = totales['total']
            cambio = 0
        else:
            valor_recibido = 0
            cambio = 0

        items_snapshot = [
            {
                'productoId': l['productoId'],
                'codigo': l['codigo'],
                'nombre': l['nombre'],
                'cantidad': l['cantidad'],
                'precio': l['precio'],
                'subtotal': l['cantidad'] * l['precio'],
            }
            for l in lineas_nuevas
        ]

        venta.cliente = cliente
        venta.metodo_pago = metodo_pago
        venta.descuento = descuento_obj
        venta.descuento_nombre = totales['descuento_nombre']
        venta.descuento_tipo = totales['descuento_tipo']
        venta.descuento_valor = totales['descuento_valor']
        venta.descuento_monto = totales['descuento_monto']
        venta.subtotal = totales['subtotal']
        venta.iva = totales['iva']
        venta.total = totales['total']
        venta.valor_recibido = valor_recibido
        venta.cambio = cambio
        venta.estado = 'corregida'
        venta.fue_corregida = True
        if user and user.is_authenticated:
            venta.corregida_por = user
        venta.fecha_correccion = timezone.now()
        venta.motivo_correccion = (data.get('motivo') or 'Corrección administrativa').strip()
        venta.items_json = items_snapshot
        venta.save()

        venta.detalles.all().delete()
        for l in lineas_nuevas:
            DetalleVenta.objects.create(
                venta=venta,
                producto=l['producto'],
                producto_codigo=l['codigo'],
                producto_nombre=l['nombre'],
                cantidad=l['cantidad'],
                precio_unitario=l['precio'],
                subtotal=l['cantidad'] * l['precio'],
            )

        return venta

    @classmethod
    @transaction.atomic
    def registrar_reembolso(cls, venta: Venta, data, user=None):
        """
        Procesa un reembolso parcial o total sobre una venta cerrada o corregida:
        - Solo permite reembolsar ventas cerradas/corregidas.
        - No permite devolver más cantidad de la vendida menos reembolsos previos.
        - Respeta proporcionalmente el descuento original y el IVA (19%).
        - Si devolverInventario es True, reintegra las unidades al stock del producto.
        """
        if venta.estado == 'abierta':
            raise ValidationError({
                'venta': ['No se puede reembolsar una venta abierta. Solo se permiten reembolsos de ventas cerradas.']
            })

        items_req = data.get('items', [])
        devolver_inventario = bool(data.get('devolverInventario', True))
        motivo = (data.get('motivo') or '').strip()

        detalles_venta = {d.producto_id: d for d in venta.detalles.all()}
        if not detalles_venta:
            raise ValidationError({'venta': ['La venta no tiene líneas de detalle registradas para reembolsar.']})

        # Calcular cantidades ya reembolsadas previamente por producto
        ya_reembolsado_por_prod = {}
        reembolsos_previos = list(venta.reembolsos.prefetch_related('detalles').all())
        monto_ya_reembolsado = sum(r.total_reembolsado for r in reembolsos_previos)
        for r in reembolsos_previos:
            for dr in r.detalles.all():
                ya_reembolsado_por_prod[dr.producto_id] = (
                    ya_reembolsado_por_prod.get(dr.producto_id, 0) + dr.cantidad
                )

        # Si piden reembolso total automático sin desglose, tomar todo lo disponible
        if data.get('tipo') == 'total' and not items_req:
            items_req = [
                {
                    'productoId': pid,
                    'cantidad': det.cantidad - ya_reembolsado_por_prod.get(pid, 0),
                }
                for pid, det in detalles_venta.items()
                if (det.cantidad - ya_reembolsado_por_prod.get(pid, 0)) > 0
            ]

        lineas_a_reembolsar = []
        for item in items_req:
            pid = cls._parse_int(item.get('productoId'), 0)
            cant = cls._parse_int(item.get('cantidad'), 0)
            if cant <= 0:
                continue
            if pid not in detalles_venta:
                raise ValidationError({
                    'items': [f'El producto con ID {pid} no pertenece a la factura V-{venta.id}.']
                })
            det_v = detalles_venta[pid]
            disponible = det_v.cantidad - ya_reembolsado_por_prod.get(pid, 0)
            if cant > disponible:
                raise ValidationError({
                    'items': [
                        f"No puedes reembolsar {cant} uds de '{det_v.producto_nombre}'. Cantidad disponible para reembolso: {disponible} uds."
                    ]
                })
            lineas_a_reembolsar.append((det_v, cant))

        if not lineas_a_reembolsar:
            raise ValidationError({'items': ['Selecciona al menos un producto con cantidad mayor a 0 para reembolsar.']})

        # Factor proporcional de descuento e IVA respecto al subtotal original
        if venta.subtotal > 0:
            factor_total = venta.total / float(venta.subtotal)
        else:
            factor_total = 1.0

        # Verificar si tras este reembolso quedan 0 unidades pendientes en toda la factura
        unidades_totales_venta = sum(d.cantidad for d in detalles_venta.values())
        unidades_previas_reemb = sum(ya_reembolsado_por_prod.values())
        unidades_actual_reemb = sum(cant for _, cant in lineas_a_reembolsar)
        completa_toda_la_venta = (unidades_previas_reemb + unidades_actual_reemb) == unidades_totales_venta

        es_reembolso_total = (unidades_previas_reemb == 0 and completa_toda_la_venta)
        tipo_reembolso = 'total' if es_reembolso_total else 'parcial'

        detalles_preparados = []
        suma_importe = 0
        for idx, (det_v, cant) in enumerate(lineas_a_reembolsar):
            importe_linea = int(round(cant * det_v.precio_unitario * factor_total))
            suma_importe += importe_linea
            detalles_preparados.append({
                'det_v': det_v,
                'cantidad': cant,
                'precio_unitario': det_v.precio_unitario,
                'importe': importe_linea,
            })

        # Ajuste exacto de redondeo cuando se completa el 100% de la venta para no exceder ni quedar corto por 1 peso
        if completa_toda_la_venta and detalles_preparados:
            restante_exacto = max(0, venta.total - monto_ya_reembolsado)
            diferencia_redondeo = restante_exacto - suma_importe
            if abs(diferencia_redondeo) <= 50:
                detalles_preparados[-1]['importe'] += diferencia_redondeo
                suma_importe = restante_exacto

        reembolso = Reembolso.objects.create(
            venta=venta,
            usuario=user if (user and user.is_authenticated) else None,
            tipo=tipo_reembolso,
            devolver_inventario=devolver_inventario,
            total_reembolsado=suma_importe,
            motivo=motivo,
        )

        for dp in detalles_preparados:
            det_v = dp['det_v']
            DetalleReembolso.objects.create(
                reembolso=reembolso,
                producto=det_v.producto,
                producto_nombre=det_v.producto_nombre,
                cantidad=dp['cantidad'],
                precio_unitario=dp['precio_unitario'],
                importe=dp['importe'],
            )
            if devolver_inventario:
                prod_obj = Producto.objects.select_for_update().get(id=det_v.producto_id)
                prod_obj.stock += dp['cantidad']
                prod_obj.save(update_fields=['stock'])

        return reembolso

    @classmethod
    @transaction.atomic
    def registrar_compra(cls, data, user=None):
        """
        Registra una compra a proveedor con sus líneas en DetalleCompra
        e incrementa automáticamente el inventario de los productos.
        """
        items = data.get('items', [])
        if not items:
            raise ValidationError({'items': ['Debes agregar al menos un producto a la compra.']})

        proveedor_id = data.get('proveedorId')
        proveedor = Proveedor.objects.filter(id=proveedor_id).first() if proveedor_id else None
        if not proveedor:
            raise ValidationError({'proveedorId': ['Debes seleccionar un proveedor válido.']})

        lineas_preparadas = []
        total = 0
        for idx, item in enumerate(items):
            prod_id = item.get('productoId') or item.get('id')
            cantidad = cls._parse_int(item.get('cantidad'), 0)
            if cantidad <= 0:
                raise ValidationError({'items': [f'La cantidad en la línea {idx + 1} debe ser mayor a 0.']})

            producto = Producto.objects.select_for_update().filter(id=prod_id).first()
            if not producto:
                raise ValidationError({'items': [f'El producto con ID {prod_id} no existe.']})

            costo_unitario = cls._parse_int(item.get('costo'), producto.costo)
            if costo_unitario < 0:
                raise ValidationError({'items': ['El costo de compra no puede ser negativo.']})

            producto.stock += cantidad
            if costo_unitario > 0:
                producto.costo = costo_unitario
            producto.save(update_fields=['stock', 'costo'])

            subtotal = cantidad * costo_unitario
            total += subtotal
            lineas_preparadas.append({
                'producto': producto,
                'productoId': producto.id,
                'codigo': producto.codigo,
                'nombre': producto.nombre,
                'cantidad': cantidad,
                'costo': costo_unitario,
                'subtotal': subtotal,
            })

        items_snapshot = [
            {
                'productoId': l['productoId'],
                'codigo': l['codigo'],
                'nombre': l['nombre'],
                'cantidad': l['cantidad'],
                'costo': l['costo'],
                'subtotal': l['subtotal'],
            }
            for l in lineas_preparadas
        ]

        compra = Compra.objects.create(
            proveedor=proveedor,
            proveedor_nombre=proveedor.nombre,
            usuario=user if (user and user.is_authenticated) else None,
            total=total,
            items_json=items_snapshot,
        )

        for l in lineas_preparadas:
            DetalleCompra.objects.create(
                compra=compra,
                producto=l['producto'],
                producto_codigo=l['codigo'],
                producto_nombre=l['nombre'],
                cantidad=l['cantidad'],
                costo_unitario=l['costo'],
                subtotal=l['subtotal'],
            )

        return compra

    @classmethod
    def obtener_reporte(cls, fecha_inicio_str: str, fecha_fin_str: str):
        """
        Genera el reporte administrativo consultando la base de datos real:
        1. Ventas totales por rango de fechas
        2. Productos más vendidos por rango de fechas
        3. Compras por rango de fechas
        4. Productos con mayor cantidad de faltantes (normalizados)
        El rango mínimo de consulta es de 1 día (00:00:00 a 23:59:59).
        """
        try:
            f_ini = datetime.strptime(fecha_inicio_str, '%Y-%m-%d').date()
            f_fin = datetime.strptime(fecha_fin_str, '%Y-%m-%d').date()
        except (ValueError, TypeError):
            raise ValidationError({
                'fechas': ['Formato de fecha inválido. Usa YYYY-MM-DD en fecha de inicio y fin.']
            })

        if f_fin < f_ini:
            raise ValidationError({
                'fechas': ['La fecha final no puede ser anterior a la fecha inicial (rango mínimo de 1 día).']
            })

        tz = timezone.get_current_timezone()
        dt_inicio = timezone.make_aware(datetime.combine(f_ini, time.min), tz)
        dt_fin = timezone.make_aware(datetime.combine(f_fin, time.max), tz)

        # 1. Ventas cerradas/corregidas en el rango
        ventas_qs = Venta.objects.filter(
            estado__in=['cerrada', 'corregida'],
            fecha__gte=dt_inicio,
            fecha__lte=dt_fin,
        )
        total_bruto_ventas = ventas_qs.aggregate(s=Sum('total'))['s'] or 0
        cantidad_ventas = ventas_qs.count()

        reembolsos_en_rango = (
            Reembolso.objects.filter(venta__in=ventas_qs).aggregate(s=Sum('total_reembolsado'))['s'] or 0
        )
        total_neto_ventas = max(0, total_bruto_ventas - reembolsos_en_rango)

        por_metodo = []
        for metodo in ('Efectivo', 'Nequi', 'Debe'):
            sub_qs = ventas_qs.filter(metodo_pago=metodo)
            por_metodo.append({
                'metodoPago': metodo,
                'cantidadFacturas': sub_qs.count(),
                'total': sub_qs.aggregate(s=Sum('total'))['s'] or 0,
            })

        # 2. Productos más vendidos en el rango
        mas_vendidos_qs = (
            DetalleVenta.objects.filter(
                venta__estado__in=['cerrada', 'corregida'],
                venta__fecha__gte=dt_inicio,
                venta__fecha__lte=dt_fin,
            )
            .values('producto_id', 'producto_codigo', 'producto_nombre')
            .annotate(
                unidadesVendidas=Sum('cantidad'),
                ingresosGenerados=Sum('subtotal'),
            )
            .order_by('-unidadesVendidas', '-ingresosGenerados')[:20]
        )
        productos_mas_vendidos = [
            {
                'productoId': row['producto_id'],
                'codigo': row['producto_codigo'] or f"P-{row['producto_id']}",
                'nombre': row['producto_nombre'],
                'unidadesVendidas': row['unidadesVendidas'] or 0,
                'ingresosGenerados': row['ingresosGenerados'] or 0,
            }
            for row in mas_vendidos_qs
        ]

        # 3. Compras en el rango
        compras_qs = Compra.objects.filter(fecha__gte=dt_inicio, fecha__lte=dt_fin)
        total_compras = compras_qs.aggregate(s=Sum('total'))['s'] or 0
        cantidad_compras = compras_qs.count()
        compras_por_proveedor_qs = (
            compras_qs.values('proveedor_nombre')
            .annotate(
                cantidadCompras=Count('id'),
                totalComprado=Sum('total'),
            )
            .order_by('-totalComprado')
        )
        compras_por_proveedor = [
            {
                'proveedor': row['proveedor_nombre'],
                'cantidadCompras': row['cantidadCompras'],
                'totalComprado': row['totalComprado'] or 0,
            }
            for row in compras_por_proveedor_qs
        ]

        # 4. Productos con mayor cantidad de faltantes (normalizados) en el rango
        faltantes_qs = Faltante.objects.filter(fecha__gte=dt_inicio, fecha__lte=dt_fin)
        faltantes_agrupados_qs = (
            faltantes_qs.values('nombre_normalizado', 'tipo')
            .annotate(
                totalSolicitado=Sum('cantidad_solicitada'),
                registros=Count('id'),
            )
            .order_by('-totalSolicitado', '-registros')[:20]
        )
        productos_mas_faltantes = [
            {
                'nombreNormalizado': row['nombre_normalizado'],
                'tipo': row['tipo'],
                'totalSolicitado': row['totalSolicitado'] or 0,
                'registros': row['registros'] or 0,
            }
            for row in faltantes_agrupados_qs
        ]

        return {
            'rango': {
                'fechaInicio': fecha_inicio_str,
                'fechaFin': fecha_fin_str,
                'dias': (f_fin - f_ini).days + 1,
            },
            'ventas': {
                'cantidadFacturas': cantidad_ventas,
                'totalBruto': total_bruto_ventas,
                'totalReembolsado': reembolsos_en_rango,
                'totalNeto': total_neto_ventas,
                'porMetodoPago': por_metodo,
            },
            'productosMasVendidos': productos_mas_vendidos,
            'compras': {
                'cantidadCompras': cantidad_compras,
                'totalInvertido': total_compras,
                'porProveedor': compras_por_proveedor,
            },
            'productosConMasFaltantes': productos_mas_faltantes,
        }
