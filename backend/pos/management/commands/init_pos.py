"""
Comando de inicialización de Papel y Luna POS (MVP 3).
Uso: python manage.py init_pos
Precarga usuarios (admin y cajero), categorías, clientes, proveedores,
productos y descuentos iniciales conservando los datos existentes.
"""
import os

from django.conf import settings
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from pos.models import (
    PerfilUsuario,
    Categoria,
    Cliente,
    Proveedor,
    Producto,
    Descuento,
)


class Command(BaseCommand):
    help = 'Inicializa usuarios por rol (ADMINISTRADOR y CAJERO) y datos base de Papel y Luna POS.'

    @transaction.atomic
    def handle(self, *args, **options):
        # 1. Usuarios obligatorios: Administrador y Cajero
        admin_user, created_admin = User.objects.get_or_create(
            username='admin',
            defaults={
                'first_name': 'Laura',
                'last_name': 'Gómez',
                'email': 'admin@papelyluna.com',
                'is_staff': True,
                'is_superuser': True,
            },
        )
        if created_admin or not admin_user.has_usable_password():
            admin_user.set_password(self._initial_password('DJANGO_ADMIN_INITIAL_PASSWORD', 'admin123'))
            admin_user.is_staff = True
            admin_user.is_superuser = True
            admin_user.save()

        PerfilUsuario.objects.update_or_create(
            user=admin_user,
            defaults={
                'rol': 'ADMINISTRADOR',
                'nombre_completo': 'Laura Gómez (Administradora)',
            },
        )

        cajero_user, created_cajero = User.objects.get_or_create(
            username='cajero',
            defaults={
                'first_name': 'Andrés',
                'last_name': 'Morales',
                'email': 'caja@papelyluna.com',
                'is_staff': False,
                'is_superuser': False,
            },
        )
        if created_cajero or not cajero_user.has_usable_password():
            cajero_user.set_password(self._initial_password('DJANGO_CASHIER_INITIAL_PASSWORD', 'cajero123'))
            cajero_user.save()

        PerfilUsuario.objects.update_or_create(
            user=cajero_user,
            defaults={
                'rol': 'CAJERO',
                'nombre_completo': 'Andrés Morales (Cajero)',
            },
        )

        # 2. Categorías base
        categorias_nombres = ['Cuadernos', 'Escritura', 'Oficina', 'Papeles', 'Arte']
        cat_map = {}
        for nombre in categorias_nombres:
            cat_obj = Categoria.objects.filter(nombre__iexact=nombre).first()
            if not cat_obj:
                cat_obj = Categoria.objects.create(nombre=nombre)
            cat_map[nombre] = cat_obj

        # Vincular productos existentes con su objeto Categoria y asignar imagen si está vacía
        imagenes_por_codigo = {
            'P001': '/Imagenes/CadernoArgollado.jpg',
            'P002': '/Imagenes/esferobic.webp',
            'P003': '/Imagenes/carpeta.jpeg',
            'P004': '/Imagenes/tijeras.jpeg',
            'P005': '/Imagenes/colores.png',
            'P006': '/Imagenes/calculadora.jpeg',
        }
        for prod in Producto.objects.all():
            changed = False
            if not prod.categoria_rel_id and prod.categoria:
                cat_obj = Categoria.objects.filter(nombre__iexact=prod.categoria.strip()).first()
                if not cat_obj:
                    cat_obj = Categoria.objects.create(nombre=prod.categoria.strip())
                prod.categoria_rel = cat_obj
                prod.categoria = cat_obj.nombre
                changed = True
            if not prod.imagen and prod.codigo in imagenes_por_codigo:
                prod.imagen = imagenes_por_codigo[prod.codigo]
                changed = True
            if changed:
                prod.save()

        # 3. Productos iniciales adicionales (solo si no existen por código)
        productos_seed = [
            {
                'codigo': 'P001',
                'nombre': 'Cuaderno Argollado 100 Hojas',
                'categoria': 'Cuadernos',
                'precio': 12000,
                'costo': 7500,
                'stock': 18,
                'imagen': '/Imagenes/CadernoArgollado.jpg',
            },
            {
                'codigo': 'P002',
                'nombre': 'Esfero Azul Cristal',
                'categoria': 'Escritura',
                'precio': 2500,
                'costo': 1200,
                'stock': 45,
                'imagen': '/Imagenes/esferobic.webp',
            },
            {
                'codigo': 'P003',
                'nombre': 'Resma Papel Carta 75g',
                'categoria': 'Papeles',
                'precio': 18500,
                'costo': 13000,
                'stock': 15,
                'imagen': '/Imagenes/carpeta.jpeg',
            },
            {
                'codigo': 'P004',
                'nombre': 'Tijeras Escolares Punta Roma',
                'categoria': 'Oficina',
                'precio': 7000,
                'costo': 4200,
                'stock': 10,
                'imagen': '/Imagenes/tijeras.jpeg',
            },
            {
                'codigo': 'P005',
                'nombre': 'Caja de Colores x12 Unidades',
                'categoria': 'Arte',
                'precio': 9500,
                'costo': 6000,
                'stock': 12,
                'imagen': '/Imagenes/colores.png',
            },
            {
                'codigo': 'P006',
                'nombre': 'Calculadora Científica Escolar',
                'categoria': 'Oficina',
                'precio': 28000,
                'costo': 19500,
                'stock': 8,
                'imagen': '/Imagenes/calculadora.jpeg',
            },
        ]
        for p_data in productos_seed:
            if not Producto.objects.filter(codigo__iexact=p_data['codigo']).exists():
                cat_obj = cat_map.get(p_data['categoria'])
                Producto.objects.create(
                    codigo=p_data['codigo'],
                    nombre=p_data['nombre'],
                    categoria_rel=cat_obj,
                    categoria=p_data['categoria'],
                    precio=p_data['precio'],
                    costo=p_data['costo'],
                    stock=p_data['stock'],
                    imagen=p_data['imagen'],
                )

        # 4. Clientes iniciales
        clientes_seed = [
            {'nombre': 'María López', 'telefono': '3001112233', 'correo': 'maria@papelyluna.com'},
            {'nombre': 'Carlos Pérez', 'telefono': '3102223344', 'correo': 'carlos@papelyluna.com'},
            {'nombre': 'Colegio San José', 'telefono': '6014445566', 'correo': 'compras@colegiosanjose.edu.co'},
        ]
        for c_data in clientes_seed:
            if not Cliente.objects.filter(nombre__iexact=c_data['nombre']).exists():
                Cliente.objects.create(**c_data)

        # 5. Proveedores iniciales
        proveedores_seed = [
            {'nombre': 'Distribuciones Ramo Escolar', 'telefono': '6015551111', 'correo': 'ventas@ramoescolar.com'},
            {'nombre': 'Papeles Andinos S.A.S.', 'telefono': '6015552222', 'correo': 'contacto@papelesandinos.com'},
        ]
        for pr_data in proveedores_seed:
            if not Proveedor.objects.filter(nombre__iexact=pr_data['nombre']).exists():
                Proveedor.objects.create(**pr_data)

        # 6. Descuentos iniciales
        descuentos_seed = [
            {'nombre': 'Descuento Estudiante 10%', 'tipo': 'porcentual', 'valor': 10, 'activo': True},
            {'nombre': 'Bono Escolar $2.000', 'tipo': 'fijo', 'valor': 2000, 'activo': True},
            {'nombre': 'Mayorista Docentes 15%', 'tipo': 'porcentual', 'valor': 15, 'activo': True},
        ]
        for d_data in descuentos_seed:
            if not Descuento.objects.filter(nombre__iexact=d_data['nombre']).exists():
                Descuento.objects.create(**d_data)

        self.stdout.write(
            self.style.SUCCESS(
                'Inicialización completada: perfiles de administrador y cajero listos.'
            )
        )

    @staticmethod
    def _initial_password(variable, local_default):
        password = os.environ.get(variable, '').strip()
        if password:
            return password
        if settings.DEBUG:
            return local_default
        raise CommandError(f'Configura {variable} para crear la cuenta inicial en producción.')
