import unicodedata
from django.db import models
from django.contrib.auth.models import User


PALABRAS_SINGULARES_EN_S = {'compas', 'sacapuntas', 'atlas', 'virus', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes'}


def _singularizar_palabra(palabra: str) -> str:
    if len(palabra) <= 3 or palabra in PALABRAS_SINGULARES_EN_S:
        return palabra
    if palabra.endswith('ces') and len(palabra) > 4:
        return palabra[:-3] + 'z'
    if palabra.endswith('es') and len(palabra) > 4 and palabra[-3] in 'drlnjzs':
        return palabra[:-2]
    if palabra.endswith('s') and not palabra.endswith(('ss', 'is', 'us')):
        return palabra[:-1]
    return palabra


def normalizar_texto_producto(texto: str) -> str:
    """
    Normaliza nombres de productos descritos en texto para agrupar faltantes y reportes:
    minúsculas, sin tildes, espacios simples y reducción de plural simple a singular.
    """
    if not texto:
        return ''
    limpio = ' '.join(str(texto).strip().split()).lower()
    sin_tildes = ''.join(
        c for c in unicodedata.normalize('NFD', limpio)
        if unicodedata.category(c) != 'Mn'
    )
    palabras = [_singularizar_palabra(p) for p in sin_tildes.split()]
    resultado = ' '.join(palabras)
    return resultado.capitalize()


class PerfilUsuario(models.Model):
    ROLES = [
        ('ADMINISTRADOR', 'Administrador'),
        ('CAJERO', 'Cajero'),
    ]
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='perfil')
    rol = models.CharField(max_length=20, choices=ROLES, default='CAJERO')
    nombre_completo = models.CharField(max_length=150, blank=True, default='')

    def __str__(self):
        return f"{self.user.username} ({self.rol})"


class SesionToken(models.Model):
    key = models.CharField(max_length=64, unique=True, db_index=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tokens_pos')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Token {self.user.username}"


class Categoria(models.Model):
    nombre = models.CharField(max_length=100, unique=True)

    class Meta:
        ordering = ['nombre']

    def __str__(self):
        return self.nombre


class Cliente(models.Model):
    nombre = models.CharField(max_length=150)
    telefono = models.CharField(max_length=30, blank=True, default='')
    correo = models.EmailField(blank=True, default='')

    class Meta:
        ordering = ['nombre']

    def __str__(self):
        return self.nombre


class Proveedor(models.Model):
    nombre = models.CharField(max_length=150)
    telefono = models.CharField(max_length=30, blank=True, default='')
    correo = models.EmailField(blank=True, default='')

    class Meta:
        ordering = ['nombre']

    def __str__(self):
        return self.nombre


class Producto(models.Model):
    codigo = models.CharField(max_length=50, unique=True)
    nombre = models.CharField(max_length=150)
    categoria_rel = models.ForeignKey(
        Categoria,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name='productos',
    )
    categoria = models.CharField(max_length=100)
    categoria_interna_id = models.CharField(max_length=50, default='CAT_REF_01')
    precio = models.IntegerField()
    costo = models.IntegerField()
    stock = models.IntegerField(default=0)
    imagen = models.CharField(max_length=255, blank=True, default='')

    class Meta:
        ordering = ['nombre']

    def save(self, *args, **kwargs):
        if self.categoria_rel and not self.categoria:
            self.categoria = self.categoria_rel.nombre
        elif self.categoria and not self.categoria_rel_id:
            cat_obj = Categoria.objects.filter(nombre__iexact=self.categoria.strip()).first()
            if cat_obj:
                self.categoria_rel = cat_obj
                self.categoria = cat_obj.nombre
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.codigo} - {self.nombre}"


class Descuento(models.Model):
    TIPOS = [
        ('porcentual', 'Porcentual (%)'),
        ('fijo', 'Valor fijo ($)'),
    ]
    nombre = models.CharField(max_length=120)
    tipo = models.CharField(max_length=20, choices=TIPOS, default='porcentual')
    valor = models.IntegerField()
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-creado_en']

    def __str__(self):
        simbolo = f"{self.valor}%" if self.tipo == 'porcentual' else f"${self.valor}"
        return f"{self.nombre} ({simbolo})"


class Venta(models.Model):
    METODOS_PAGO = [
        ('Efectivo', 'Efectivo'),
        ('Nequi', 'Nequi'),
        ('Debe', 'Debe'),
    ]
    ESTADOS = [
        ('abierta', 'Abierta'),
        ('cerrada', 'Cerrada'),
        ('corregida', 'Corregida'),
    ]
    cliente = models.ForeignKey(
        Cliente,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name='ventas',
    )
    usuario = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='ventas_registradas',
    )
    descuento = models.ForeignKey(
        Descuento,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='ventas',
    )
    descuento_nombre = models.CharField(max_length=120, blank=True, default='')
    descuento_tipo = models.CharField(max_length=20, blank=True, default='')
    descuento_valor = models.IntegerField(default=0)
    descuento_monto = models.IntegerField(default=0)

    subtotal = models.IntegerField(default=0)
    iva = models.IntegerField(default=0)
    total = models.IntegerField(default=0)
    metodo_pago = models.CharField(max_length=20, choices=METODOS_PAGO, default='Efectivo')
    valor_recibido = models.IntegerField(default=0)
    cambio = models.IntegerField(default=0)
    estado = models.CharField(max_length=20, choices=ESTADOS, default='cerrada')

    # Campos de auditoría para corrección de ventas cerradas
    fue_corregida = models.BooleanField(default=False)
    corregida_por = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='ventas_corregidas',
    )
    fecha_correccion = models.DateTimeField(null=True, blank=True)
    motivo_correccion = models.CharField(max_length=255, blank=True, default='')

    fecha = models.DateTimeField(auto_now_add=True)
    actualizada_en = models.DateTimeField(auto_now=True)
    # Se mantiene items_json solo por retrocompatibilidad con talleres previos,
    # pero la fuente principal de verdad es la tabla relacional DetalleVenta.
    items_json = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ['-fecha', '-id']

    def __str__(self):
        return f"V-{self.id} ({self.estado}) - ${self.total}"


class DetalleVenta(models.Model):
    venta = models.ForeignKey(Venta, on_delete=models.CASCADE, related_name='detalles')
    producto = models.ForeignKey(
        Producto,
        on_delete=models.PROTECT,
        related_name='detalles_venta',
    )
    producto_codigo = models.CharField(max_length=50, blank=True, default='')
    producto_nombre = models.CharField(max_length=150)
    cantidad = models.IntegerField()
    precio_unitario = models.IntegerField()
    subtotal = models.IntegerField()

    def save(self, *args, **kwargs):
        if self.producto and not self.producto_nombre:
            self.producto_nombre = self.producto.nombre
        if self.producto and not self.producto_codigo:
            self.producto_codigo = self.producto.codigo
        self.subtotal = int(self.cantidad) * int(self.precio_unitario)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"V-{self.venta_id}: {self.producto_nombre} x {self.cantidad}"


class Reembolso(models.Model):
    TIPOS = [
        ('parcial', 'Parcial'),
        ('total', 'Total'),
    ]
    venta = models.ForeignKey(Venta, on_delete=models.CASCADE, related_name='reembolsos')
    usuario = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='reembolsos_registrados',
    )
    fecha = models.DateTimeField(auto_now_add=True)
    tipo = models.CharField(max_length=20, choices=TIPOS, default='parcial')
    devolver_inventario = models.BooleanField(default=True)
    total_reembolsado = models.IntegerField(default=0)
    motivo = models.CharField(max_length=255, blank=True, default='')

    class Meta:
        ordering = ['-fecha', '-id']

    def __str__(self):
        return f"R-{self.id} (V-{self.venta_id}) - ${self.total_reembolsado}"


class DetalleReembolso(models.Model):
    reembolso = models.ForeignKey(Reembolso, on_delete=models.CASCADE, related_name='detalles')
    producto = models.ForeignKey(
        Producto,
        on_delete=models.PROTECT,
        related_name='detalles_reembolso',
    )
    producto_nombre = models.CharField(max_length=150)
    cantidad = models.IntegerField()
    precio_unitario = models.IntegerField()
    importe = models.IntegerField()

    def __str__(self):
        return f"R-{self.reembolso_id}: {self.producto_nombre} x {self.cantidad}"


class Compra(models.Model):
    proveedor = models.ForeignKey(
        Proveedor,
        null=True,
        on_delete=models.PROTECT,
        related_name='compras',
    )
    proveedor_nombre = models.CharField(max_length=150)
    usuario = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='compras_registradas',
    )
    fecha = models.DateTimeField(auto_now_add=True)
    total = models.IntegerField(default=0)
    items_json = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ['-fecha', '-id']

    def __str__(self):
        return f"C-{self.id} - {self.proveedor_nombre} (${self.total})"


class DetalleCompra(models.Model):
    compra = models.ForeignKey(Compra, on_delete=models.CASCADE, related_name='detalles')
    producto = models.ForeignKey(
        Producto,
        on_delete=models.PROTECT,
        related_name='detalles_compra',
    )
    producto_codigo = models.CharField(max_length=50, blank=True, default='')
    producto_nombre = models.CharField(max_length=150)
    cantidad = models.IntegerField()
    costo_unitario = models.IntegerField()
    subtotal = models.IntegerField()

    def save(self, *args, **kwargs):
        if self.producto and not self.producto_nombre:
            self.producto_nombre = self.producto.nombre
        if self.producto and not self.producto_codigo:
            self.producto_codigo = self.producto.codigo
        self.subtotal = int(self.cantidad) * int(self.costo_unitario)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"C-{self.compra_id}: {self.producto_nombre} x {self.cantidad}"


class Faltante(models.Model):
    TIPOS = [
        ('inexistente', 'Producto inexistente'),
        ('agotado', 'Producto agotado'),
    ]
    ESTADOS = [
        ('pendiente', 'Pendiente'),
        ('resuelto', 'Resuelto'),
    ]
    producto = models.ForeignKey(
        Producto,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name='faltantes',
    )
    descripcion_texto = models.CharField(max_length=200)
    nombre_normalizado = models.CharField(max_length=200, db_index=True)
    cantidad_solicitada = models.IntegerField(default=1)
    fecha = models.DateTimeField(auto_now_add=True)
    tipo = models.CharField(max_length=20, choices=TIPOS, default='agotado')
    proveedor = models.ForeignKey(
        Proveedor,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name='faltantes',
    )
    estado = models.CharField(max_length=20, choices=ESTADOS, default='pendiente')
    registrado_por = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='faltantes_registrados',
    )

    class Meta:
        ordering = ['-fecha', '-id']

    def save(self, *args, **kwargs):
        if self.producto and not self.descripcion_texto:
            self.descripcion_texto = self.producto.nombre
        self.nombre_normalizado = normalizar_texto_producto(
            self.producto.nombre if self.producto else self.descripcion_texto
        )
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.nombre_normalizado} ({self.cantidad_solicitada}) - {self.estado}"


# Ejercicio 3 — Modelo RequestLog para el Middleware de Pre-procesamiento
class RequestLog(models.Model):
    method = models.CharField(max_length=10)
    path = models.CharField(max_length=255)
    ip = models.GenericIPAddressField(null=True, blank=True)
    called_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-called_at']
