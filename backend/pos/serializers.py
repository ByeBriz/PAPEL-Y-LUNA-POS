"""
Capa de Serialización (backend/pos/serializers.py)
Transforma los modelos relacionales de Django/PostgreSQL a representaciones JSON
limpias y consistentes para el frontend en React, y viceversa.
"""
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
)
from pos.permissions import get_user_role


def serialize_user(user):
    if not user:
        return None
    role = get_user_role(user)
    nombre = ''
    if hasattr(user, 'perfil') and user.perfil and user.perfil.nombre_completo:
        nombre = user.perfil.nombre_completo
    else:
        nombre = f"{user.first_name} {user.last_name}".strip() or user.username
    return {
        'id': user.id,
        'username': user.username,
        'nombre': nombre,
        'correo': user.email or '',
        'rol': role,
    }


def serialize_categoria(cat: Categoria):
    return {
        'id': cat.id,
        'nombre': cat.nombre,
        'productosCount': cat.productos.count() if hasattr(cat, 'productos') else 0,
    }


def serialize_cliente(cli: Cliente):
    return {
        'id': cli.id,
        'nombre': cli.nombre,
        'telefono': cli.telefono or '',
        'correo': cli.correo or '',
    }


def serialize_proveedor(prov: Proveedor):
    return {
        'id': prov.id,
        'nombre': prov.nombre,
        'telefono': prov.telefono or '',
        'correo': prov.correo or '',
    }


def serialize_producto(prod: Producto):
    cat_nombre = prod.categoria_rel.nombre if prod.categoria_rel else prod.categoria
    return {
        'id': prod.id,
        'codigo': prod.codigo,
        'nombre': prod.nombre,
        'categoria': cat_nombre,
        'categoriaId': prod.categoria_rel_id,
        'categoria_interna_id': prod.categoria_interna_id,
        'precio': prod.precio,
        'costo': prod.costo,
        'stock': prod.stock,
        'imagen': prod.imagen or '',
    }


def serialize_descuento(desc: Descuento):
    return {
        'id': desc.id,
        'nombre': desc.nombre,
        'tipo': desc.tipo,
        'valor': desc.valor,
        'activo': desc.activo,
        'creadoEn': desc.creado_en.isoformat() if desc.creado_en else None,
    }


def serialize_detalle_reembolso(det: DetalleReembolso):
    return {
        'id': det.id,
        'productoId': det.producto_id,
        'nombre': det.producto_nombre,
        'cantidad': det.cantidad,
        'precioUnitario': det.precio_unitario,
        'importe': det.importe,
    }


def serialize_reembolso(reemb: Reembolso):
    detalles = [serialize_detalle_reembolso(d) for d in reemb.detalles.all()]
    usuario_nombre = ''
    if reemb.usuario:
        usuario_nombre = serialize_user(reemb.usuario)['nombre']
    return {
        'id': reemb.id,
        'codigo': f"R-{reemb.id}",
        'ventaId': reemb.venta_id,
        'ventaCodigo': f"V-{reemb.venta_id}",
        'fecha': reemb.fecha.isoformat() if reemb.fecha else None,
        'tipo': reemb.tipo,
        'devolverInventario': reemb.devolver_inventario,
        'totalReembolsado': reemb.total_reembolsado,
        'motivo': reemb.motivo or '',
        'usuario': usuario_nombre or 'Administrador',
        'items': detalles,
    }


def serialize_venta(venta: Venta):
    detalles_qs = list(venta.detalles.all())
    reembolsos_qs = list(venta.reembolsos.prefetch_related('detalles').all())

    reembolsados_por_prod = {}
    for r in reembolsos_qs:
        for dr in r.detalles.all():
            reembolsados_por_prod[dr.producto_id] = (
                reembolsados_por_prod.get(dr.producto_id, 0) + dr.cantidad
            )

    if detalles_qs:
        items = [
            {
                'id': d.id,
                'productoId': d.producto_id,
                'codigo': d.producto_codigo or (d.producto.codigo if d.producto else ''),
                'nombre': d.producto_nombre,
                'cantidad': d.cantidad,
                'precio': d.precio_unitario,
                'subtotal': d.subtotal,
                'cantidadReembolsada': reembolsados_por_prod.get(d.producto_id, 0),
                'cantidadDisponibleReembolso': max(
                    0, d.cantidad - reembolsados_por_prod.get(d.producto_id, 0)
                ),
            }
            for d in detalles_qs
        ]
    else:
        items = venta.items_json or []

    reembolsos_data = [serialize_reembolso(r) for r in reembolsos_qs]
    total_reembolsado = sum(r.total_reembolsado for r in reembolsos_qs)
    unidades_vendidas_total = sum(d.cantidad for d in detalles_qs) if detalles_qs else 0
    unidades_reembolsadas_total = sum(reembolsados_por_prod.values())
    if len(reembolsos_data) == 0:
        estado_reembolso = ''
    elif unidades_vendidas_total > 0 and unidades_reembolsadas_total >= unidades_vendidas_total:
        estado_reembolso = 'total'
    else:
        estado_reembolso = 'parcial'

    cajero_nombre = serialize_user(venta.usuario)['nombre'] if venta.usuario else 'Cajero Principal'
    corregida_por_nombre = (
        serialize_user(venta.corregida_por)['nombre'] if venta.corregida_por else ''
    )

    return {
        'id': f"V-{venta.id}",
        'numericId': venta.id,
        'fecha': venta.fecha.isoformat() if venta.fecha else None,
        'actualizadaEn': venta.actualizada_en.isoformat() if venta.actualizada_en else None,
        'clienteId': venta.cliente_id or '',
        'clienteNombre': venta.cliente.nombre if venta.cliente else 'Público general',
        'clienteTelefono': venta.cliente.telefono if venta.cliente else '',
        'clienteCorreo': venta.cliente.correo if venta.cliente else '',
        'usuarioNombre': cajero_nombre,
        'descuentoId': venta.descuento_id or '',
        'descuentoNombre': venta.descuento_nombre or '',
        'descuentoTipo': venta.descuento_tipo or '',
        'descuentoValor': venta.descuento_valor or 0,
        'descuentoMonto': venta.descuento_monto or 0,
        'subtotal': venta.subtotal,
        'iva': venta.iva,
        'total': venta.total,
        'metodoPago': venta.metodo_pago,
        'recibido': venta.valor_recibido,
        'cambio': venta.cambio,
        'estado': venta.estado,
        'fueCorregida': venta.fue_corregida or (venta.estado == 'corregida'),
        'corregidaPor': corregida_por_nombre,
        'fechaCorreccion': venta.fecha_correccion.isoformat() if venta.fecha_correccion else None,
        'motivoCorreccion': venta.motivo_correccion or '',
        'tieneReembolsos': len(reembolsos_data) > 0,
        'estadoReembolso': estado_reembolso,
        'totalReembolsado': total_reembolsado,
        'reembolsos': reembolsos_data,
        'items': items,
    }


def serialize_compra(compra: Compra):
    detalles_qs = list(compra.detalles.all())
    if detalles_qs:
        items = [
            {
                'id': d.id,
                'productoId': d.producto_id,
                'codigo': d.producto_codigo or (d.producto.codigo if d.producto else ''),
                'nombre': d.producto_nombre,
                'cantidad': d.cantidad,
                'costo': d.costo_unitario,
                'subtotal': d.subtotal,
            }
            for d in detalles_qs
        ]
    else:
        items = compra.items_json or []

    usuario_nombre = serialize_user(compra.usuario)['nombre'] if compra.usuario else 'Administrador'

    return {
        'id': f"C-{compra.id}",
        'numericId': compra.id,
        'fecha': compra.fecha.isoformat() if compra.fecha else None,
        'proveedorId': compra.proveedor_id or '',
        'proveedor': compra.proveedor.nombre if compra.proveedor else compra.proveedor_nombre,
        'usuarioNombre': usuario_nombre,
        'total': compra.total,
        'items': items,
    }


def serialize_faltante(faltante: Faltante):
    usuario_nombre = (
        serialize_user(faltante.registrado_por)['nombre']
        if faltante.registrado_por
        else 'Cajero'
    )
    return {
        'id': faltante.id,
        'productoId': faltante.producto_id or '',
        'productoCodigo': faltante.producto.codigo if faltante.producto else '',
        'descripcion': faltante.descripcion_texto,
        'nombreNormalizado': faltante.nombre_normalizado,
        'cantidadSolicitada': faltante.cantidad_solicitada,
        'fecha': faltante.fecha.isoformat() if faltante.fecha else None,
        'tipo': faltante.tipo,
        'proveedorId': faltante.proveedor_id or '',
        'proveedorNombre': faltante.proveedor.nombre if faltante.proveedor else 'Sin asignar',
        'estado': faltante.estado,
        'registradoPor': usuario_nombre,
    }
