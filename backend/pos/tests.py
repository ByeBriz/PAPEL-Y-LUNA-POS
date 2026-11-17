"""
Pruebas integrales del Backend — Papel y Luna POS (MVP 3).
Verifica todos los módulos, permisos por rol, transacciones de inventario,
ventas abiertas y cerradas, correcciones, reembolsos, descuentos, faltantes y reportes.
"""
import json
from django.test import TestCase, Client
from django.core.management import call_command
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
    Compra,
    Faltante,
)


class PapelYLunaPosTests(TestCase):
    def setUp(self):
        call_command('init_pos')
        self.client = Client()

        # Login como administrador
        res_admin = self.client.post(
            '/api/auth/login/',
            data=json.dumps({'username': 'admin', 'password': 'admin123'}),
            content_type='application/json',
        )
        self.assertEqual(res_admin.status_code, 200)
        self.admin_token = res_admin.json()['token']
        self.admin_headers = {'HTTP_AUTHORIZATION': f'Bearer {self.admin_token}'}

        # Login como cajero
        res_cajero = self.client.post(
            '/api/auth/login/',
            data=json.dumps({'username': 'cajero', 'password': 'cajero123'}),
            content_type='application/json',
        )
        self.assertEqual(res_cajero.status_code, 200)
        self.cajero_token = res_cajero.json()['token']
        self.cajero_headers = {'HTTP_AUTHORIZATION': f'Bearer {self.cajero_token}'}

    def test_01_autenticacion_y_permisos_roles(self):
        # Credenciales inválidas
        bad = self.client.post(
            '/api/auth/login/',
            data=json.dumps({'username': 'admin', 'password': 'wrong'}),
            content_type='application/json',
        )
        self.assertEqual(bad.status_code, 401)

        # Endpoint sin token debe rechazar con 401
        no_auth = self.client.get('/api/productos/')
        self.assertEqual(no_auth.status_code, 401)

        # Cajero NO puede crear categorías, proveedores, compras, descuentos ni ver reportes
        self.assertEqual(
            self.client.post(
                '/api/categorias/',
                data=json.dumps({'nombre': 'NuevaCat'}),
                content_type='application/json',
                **self.cajero_headers,
            ).status_code,
            403,
        )
        self.assertEqual(
            self.client.get('/api/reportes/', **self.cajero_headers).status_code,
            403,
        )
        self.assertEqual(
            self.client.get('/api/compras/', **self.cajero_headers).status_code,
            403,
        )

        # Cajero SÍ puede editar un producto desde el flujo de venta y gestionar clientes
        prod = Producto.objects.first()
        res_edit_prod = self.client.put(
            f'/api/productos/{prod.id}/',
            data=json.dumps({
                'codigo': prod.codigo,
                'nombre': prod.nombre,
                'categoria': prod.categoria,
                'precio': prod.precio + 500,
                'costo': prod.costo,
                'stock': prod.stock,
            }),
            content_type='application/json',
            **self.cajero_headers,
        )
        self.assertEqual(res_edit_prod.status_code, 200)

    def test_02_crud_categorias_clientes_proveedores_y_proteccion_borrado(self):
        # No permitir eliminar categoría con productos asociados
        cat_con_prod = Categoria.objects.filter(nombre='Cuadernos').first()
        res_del_cat = self.client.delete(
            f'/api/categorias/{cat_con_prod.id}/',
            **self.admin_headers,
        )
        self.assertEqual(res_del_cat.status_code, 400)

        # Crear y eliminar categoría vacía sí debe funcionar
        res_new_cat = self.client.post(
            '/api/categorias/',
            data=json.dumps({'nombre': 'Temporada Escolar'}),
            content_type='application/json',
            **self.admin_headers,
        )
        self.assertEqual(res_new_cat.status_code, 201)
        new_cat_id = res_new_cat.json()['id']
        self.assertEqual(
            self.client.delete(f'/api/categorias/{new_cat_id}/', **self.admin_headers).status_code,
            200,
        )

    def test_03_compras_e_incremento_inventario(self):
        prod = Producto.objects.first()
        prov = Proveedor.objects.first()
        stock_inicial = prod.stock

        res_compra = self.client.post(
            '/api/compras/',
            data=json.dumps({
                'proveedorId': prov.id,
                'items': [
                    {'productoId': prod.id, 'cantidad': 10, 'costo': prod.costo + 100}
                ],
            }),
            content_type='application/json',
            **self.admin_headers,
        )
        self.assertEqual(res_compra.status_code, 201)
        prod.refresh_from_db()
        self.assertEqual(prod.stock, stock_inicial + 10)

    def test_04_ventas_abiertas_cerradas_descuentos_y_debe(self):
        prod = Producto.objects.first()
        cli = Cliente.objects.first()
        desc = Descuento.objects.filter(tipo='porcentual', valor=10).first()
        stock_inicial = prod.stock

        # 1. Guardar venta abierta (no descuenta stock)
        res_abierta = self.client.post(
            '/api/ventas/',
            data=json.dumps({
                'estado': 'abierta',
                'clienteId': cli.id,
                'metodoPago': 'Efectivo',
                'descuentoId': desc.id,
                'items': [
                    {'productoId': prod.id, 'cantidad': 2, 'precio': 10000}
                ],
            }),
            content_type='application/json',
            **self.cajero_headers,
        )
        self.assertEqual(res_abierta.status_code, 201)
        venta_data = res_abierta.json()
        self.assertEqual(venta_data['estado'], 'abierta')
        prod.refresh_from_db()
        self.assertEqual(prod.stock, stock_inicial)

        # 2. Validar que método Debe sin cliente falle al cerrar
        res_debe_sin_cli = self.client.put(
            f"/api/ventas/{venta_data['id']}/",
            data=json.dumps({
                'estado': 'cerrada',
                'clienteId': '',
                'metodoPago': 'Debe',
                'items': [
                    {'productoId': prod.id, 'cantidad': 2, 'precio': 10000}
                ],
            }),
            content_type='application/json',
            **self.cajero_headers,
        )
        self.assertEqual(res_debe_sin_cli.status_code, 400)

        # 3. Retomar y cerrar la venta abierta con descuento del 10% e IVA 19%
        # Subtotal: 2 * 10000 = 20000
        # Descuento 10%: 2000 -> Base: 18000
        # IVA 19% de 18000: 3420 -> Total: 21420
        res_cerrar = self.client.put(
            f"/api/ventas/{venta_data['id']}/",
            data=json.dumps({
                'estado': 'cerrada',
                'clienteId': cli.id,
                'metodoPago': 'Efectivo',
                'descuentoId': desc.id,
                'recibido': 25000,
                'items': [
                    {'productoId': prod.id, 'cantidad': 2, 'precio': 10000}
                ],
            }),
            content_type='application/json',
            **self.cajero_headers,
        )
        self.assertEqual(res_cerrar.status_code, 200)
        cerrada = res_cerrar.json()
        self.assertEqual(cerrada['estado'], 'cerrada')
        self.assertEqual(cerrada['subtotal'], 20000)
        self.assertEqual(cerrada['descuentoMonto'], 2000)
        self.assertEqual(cerrada['iva'], 3420)
        self.assertEqual(cerrada['total'], 21420)
        self.assertEqual(cerrada['cambio'], 3580)

        prod.refresh_from_db()
        self.assertEqual(prod.stock, stock_inicial - 2)

        # 4. Eliminar descuento del catálogo NO debe modificar la venta histórica
        self.client.delete(f'/api/descuentos/{desc.id}/', **self.admin_headers)
        res_hist = self.client.get(f"/api/ventas/{cerrada['id']}/", **self.cajero_headers)
        self.assertEqual(res_hist.json()['total'], 21420)
        self.assertEqual(res_hist.json()['descuentoMonto'], 2000)

    def test_05_correccion_ventas_y_reembolsos(self):
        p1, p2 = list(Producto.objects.all()[:2])
        s1_ini, s2_ini = p1.stock, p2.stock
        cli = Cliente.objects.first()

        # Crear venta cerrada: 3 unidades de p1 a $10.000
        res_venta = self.client.post(
            '/api/ventas/',
            data=json.dumps({
                'estado': 'cerrada',
                'clienteId': cli.id,
                'metodoPago': 'Nequi',
                'items': [
                    {'productoId': p1.id, 'cantidad': 3, 'precio': 10000}
                ],
            }),
            content_type='application/json',
            **self.cajero_headers,
        )
        self.assertEqual(res_venta.status_code, 201)
        venta_id = res_venta.json()['id']
        p1.refresh_from_db()
        self.assertEqual(p1.stock, s1_ini - 3)

        # Corregir venta (solo Admin): cambiar a 2 unidades de p1 y 1 unidad de p2
        res_corr = self.client.post(
            f'/api/ventas/{venta_id}/corregir/',
            data=json.dumps({
                'clienteId': cli.id,
                'metodoPago': 'Efectivo',
                'recibido': 50000,
                'motivo': 'Cambio de artículo solicitado por cliente',
                'items': [
                    {'productoId': p1.id, 'cantidad': 2, 'precio': 10000},
                    {'productoId': p2.id, 'cantidad': 1, 'precio': 5000},
                ],
            }),
            content_type='application/json',
            **self.admin_headers,
        )
        self.assertEqual(res_corr.status_code, 200)
        corr_data = res_corr.json()
        self.assertEqual(corr_data['id'], venta_id)  # Conserva ID original
        self.assertEqual(corr_data['estado'], 'corregida')
        self.assertTrue(corr_data['fueCorregida'])

        p1.refresh_from_db()
        p2.refresh_from_db()
        self.assertEqual(p1.stock, s1_ini - 2)  # Se devolvió 1 unidad de p1
        self.assertEqual(p2.stock, s2_ini - 1)  # Se descontó 1 unidad de p2

        # Reembolso parcial de 1 unidad de p1 devolviendo al inventario
        res_reemb = self.client.post(
            f'/api/ventas/{venta_id}/reembolsar/',
            data=json.dumps({
                'devolverInventario': True,
                'motivo': 'Devolución parcial',
                'items': [{'productoId': p1.id, 'cantidad': 1}],
            }),
            content_type='application/json',
            **self.admin_headers,
        )
        self.assertEqual(res_reemb.status_code, 201)
        reemb_json = res_reemb.json()
        self.assertEqual(reemb_json['reembolso']['totalReembolsado'], 11900)  # 10000 + 19% IVA
        self.assertTrue(reemb_json['venta']['tieneReembolsos'])

        p1.refresh_from_db()
        self.assertEqual(p1.stock, s1_ini - 1)

        # Intentar reembolsar 2 unidades más de p1 (cuando solo queda 1 disponible) debe fallar
        res_exceso = self.client.post(
            f'/api/ventas/{venta_id}/reembolsar/',
            data=json.dumps({
                'devolverInventario': True,
                'items': [{'productoId': p1.id, 'cantidad': 2}],
            }),
            content_type='application/json',
            **self.admin_headers,
        )
        self.assertEqual(res_exceso.status_code, 400)

    def test_06_faltantes_y_reportes(self):
        prov = Proveedor.objects.first()
        # Registrar dos faltantes en texto con mayúsculas/tildes distintas para verificar normalización
        self.client.post(
            '/api/faltantes/',
            data=json.dumps({
                'descripcion': 'Compás Metálico Escolar',
                'cantidadSolicitada': 3,
                'tipo': 'inexistente',
                'proveedorId': prov.id,
            }),
            content_type='application/json',
            **self.cajero_headers,
        )
        self.client.post(
            '/api/faltantes/',
            data=json.dumps({
                'descripcion': '  compas   metalico escolar ',
                'cantidadSolicitada': 4,
                'tipo': 'inexistente',
                'proveedorId': prov.id,
            }),
            content_type='application/json',
            **self.cajero_headers,
        )

        res_agr = self.client.get('/api/faltantes/agrupados/', **self.cajero_headers)
        self.assertEqual(res_agr.status_code, 200)
        agrupados = res_agr.json()
        self.assertEqual(len(agrupados), 1)
        self.assertEqual(agrupados[0]['nombreNormalizado'], 'Compas metalico escolar')
        self.assertEqual(agrupados[0]['totalCantidad'], 7)

        # Consultar reporte administrativo del día de hoy
        hoy = timezone.localdate().strftime('%Y-%m-%d')
        res_rep = self.client.get(
            f'/api/reportes/?fecha_inicio={hoy}&fecha_fin={hoy}',
            **self.admin_headers,
        )
        self.assertEqual(res_rep.status_code, 200)
        rep = res_rep.json()
        self.assertIn('ventas', rep)
        self.assertIn('productosMasVendidos', rep)
        self.assertIn('compras', rep)
        self.assertIn('productosConMasFaltantes', rep)
        self.assertEqual(rep['productosConMasFaltantes'][0]['totalSolicitado'], 7)
