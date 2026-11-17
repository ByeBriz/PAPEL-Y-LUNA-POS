"""
Validadores con Django Forms (backend/pos/forms.py)
Separa la validación de entrada del controlador (views) usando ModelForm y Form.
"""
from django import forms
from pos.models import Producto, Cliente, Proveedor, Categoria, Descuento, Faltante

METODOS_PAGO_VALIDOS = [
    ('Efectivo', 'Efectivo'),
    ('Nequi', 'Nequi'),
    ('Debe', 'Debe'),
]


class ProductoForm(forms.ModelForm):
    nombre = forms.CharField(
        min_length=3,
        max_length=150,
        error_messages={
            'required': 'El nombre del producto es obligatorio.',
            'min_length': 'El nombre debe tener al menos 3 caracteres.',
        }
    )
    codigo = forms.CharField(
        min_length=2,
        max_length=50,
        error_messages={
            'required': 'El código SKU del producto es obligatorio.',
            'min_length': 'El código debe tener al menos 2 caracteres.',
            'unique': 'Ya existe un producto con este código SKU.',
        }
    )
    categoria = forms.CharField(
        required=True,
        error_messages={'required': 'Debes seleccionar una categoría válida.'}
    )
    precio = forms.IntegerField(
        min_value=100,
        max_value=10000000,
        error_messages={
            'required': 'El precio de venta es obligatorio.',
            'min_value': 'El precio de venta debe ser mínimo $100 COP.',
            'invalid': 'El precio debe ser un número entero válido.',
        }
    )
    costo = forms.IntegerField(
        min_value=0,
        max_value=10000000,
        error_messages={
            'required': 'El costo es obligatorio.',
            'min_value': 'El costo no puede ser negativo.',
            'invalid': 'El costo debe ser un número entero válido.',
        }
    )
    stock = forms.IntegerField(
        min_value=0,
        max_value=100000,
        error_messages={
            'required': 'El stock es obligatorio.',
            'min_value': 'El stock no puede ser menor que 0 (no se permite inventario negativo).',
            'invalid': 'El stock debe ser un número entero.',
        }
    )

    class Meta:
        model = Producto
        fields = ['codigo', 'nombre', 'categoria', 'precio', 'costo', 'stock', 'imagen']

    def clean_codigo(self):
        return (self.cleaned_data.get('codigo') or '').strip().upper()

    def clean(self):
        cleaned_data = super().clean()
        precio = cleaned_data.get('precio')
        costo = cleaned_data.get('costo')
        if precio is not None and costo is not None and precio < costo:
            self.add_error('precio', 'El precio de venta no puede ser menor que el costo del producto.')
        return cleaned_data


class ClienteForm(forms.ModelForm):
    nombre = forms.CharField(
        min_length=3,
        max_length=150,
        error_messages={
            'required': 'El nombre del cliente es obligatorio.',
            'min_length': 'El nombre debe tener al menos 3 caracteres.',
        }
    )
    telefono = forms.CharField(min_length=7, max_length=20, required=False)
    correo = forms.EmailField(required=False)

    class Meta:
        model = Cliente
        fields = ['nombre', 'telefono', 'correo']


class ProveedorForm(forms.ModelForm):
    nombre = forms.CharField(
        min_length=3,
        max_length=150,
        error_messages={
            'required': 'El nombre del proveedor es obligatorio.',
            'min_length': 'El nombre debe tener al menos 3 caracteres.',
        }
    )
    telefono = forms.CharField(min_length=7, max_length=20, required=False)
    correo = forms.EmailField(required=False)

    class Meta:
        model = Proveedor
        fields = ['nombre', 'telefono', 'correo']


class CategoriaForm(forms.ModelForm):
    nombre = forms.CharField(
        min_length=3,
        max_length=100,
        error_messages={
            'required': 'El nombre de la categoría es obligatorio.',
            'min_length': 'El nombre debe tener al menos 3 caracteres.',
            'unique': 'Ya existe una categoría con ese nombre.',
        }
    )

    class Meta:
        model = Categoria
        fields = ['nombre']


class DescuentoForm(forms.ModelForm):
    nombre = forms.CharField(
        min_length=3,
        max_length=120,
        error_messages={
            'required': 'El nombre del descuento es obligatorio.',
            'min_length': 'El nombre debe tener al menos 3 caracteres.',
        }
    )
    tipo = forms.ChoiceField(
        choices=[('porcentual', 'Porcentual'), ('fijo', 'Valor fijo')],
        error_messages={'invalid_choice': 'El tipo debe ser porcentual o fijo.'}
    )
    valor = forms.IntegerField(
        min_value=1,
        error_messages={
            'required': 'El valor del descuento es obligatorio.',
            'min_value': 'El valor del descuento debe ser mayor a 0.',
        }
    )

    class Meta:
        model = Descuento
        fields = ['nombre', 'tipo', 'valor', 'activo']

    def clean(self):
        cleaned = super().clean()
        tipo = cleaned.get('tipo')
        valor = cleaned.get('valor')
        if tipo == 'porcentual' and valor is not None and (valor < 1 or valor > 100):
            self.add_error('valor', 'El descuento porcentual debe estar entre 1% y 100%.')
        return cleaned


class FaltanteForm(forms.Form):
    productoId = forms.IntegerField(required=False)
    descripcion = forms.CharField(required=False, max_length=200)
    cantidadSolicitada = forms.IntegerField(
        min_value=1,
        error_messages={
            'required': 'La cantidad solicitada es obligatoria.',
            'min_value': 'La cantidad solicitada debe ser al menos 1.',
        }
    )
    tipo = forms.ChoiceField(
        choices=[('inexistente', 'Producto inexistente'), ('agotado', 'Producto agotado')],
        error_messages={'invalid_choice': 'Selecciona un tipo de faltante válido.'}
    )
    proveedorId = forms.IntegerField(required=False)
    estado = forms.ChoiceField(
        required=False,
        choices=[('pendiente', 'Pendiente'), ('resuelto', 'Resuelto')],
    )

    def clean(self):
        cleaned = super().clean()
        prod_id = cleaned.get('productoId')
        desc = (cleaned.get('descripcion') or '').strip()
        if not prod_id and len(desc) < 2:
            self.add_error('descripcion', 'Selecciona un producto existente o escribe la descripción del producto.')
        return cleaned


class VentaValidatorForm(forms.Form):
    metodoPago = forms.ChoiceField(
        required=False,
        choices=METODOS_PAGO_VALIDOS,
        error_messages={'invalid_choice': 'Método de pago inválido. Usa Efectivo, Nequi o Debe.'}
    )
    clienteId = forms.CharField(required=False)
    estado = forms.ChoiceField(
        required=False,
        choices=[('abierta', 'Abierta'), ('cerrada', 'Cerrada')],
    )

    def clean(self):
        cleaned = super().clean()
        estado = cleaned.get('estado') or 'cerrada'
        metodo = cleaned.get('metodoPago') or 'Efectivo'
        if estado == 'cerrada' and metodo == 'Debe' and not cleaned.get('clienteId'):
            self.add_error('clienteId', 'Para ventas a crédito (Debe) es obligatorio seleccionar un cliente.')
        return cleaned
