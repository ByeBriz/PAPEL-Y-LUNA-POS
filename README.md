# Papelería Papel y Luna — MVP 2 corregido

POS desarrollado con HTML, CSS y JavaScript vanilla, integrado con Google Sheets mediante Google Apps Script.

## Alcance implementado

Esta versión está alineada con el documento **Entrega Parcial POS Papel y Luna – MVP 2**:

- Productos cargados dinámicamente desde Google Sheets.
- CRUD de productos con código, nombre, categoría, costo, precio, seguimiento de inventario y stock.
- Categorías, clientes y proveedores: listar, buscar, crear, editar y eliminar.
- Relaciones producto → categoría, compra → proveedor y venta → cliente.
- Bloqueo de eliminación de entidades con registros asociados.
- Venta completa: búsqueda, carrito, cantidades, eliminación, subtotal, IVA 19 %, total y pago.
- Métodos de pago: Efectivo, Nequi y Debe.
- Efectivo: valor recibido y cambio.
- Debe: exige cliente.
- Ventas abiertas: guardar, retomar, continuar editando y cerrar posteriormente.
- Edición de producto desde el flujo de venta.
- Compras con proveedor, fecha, productos, cantidades y costos.
- Listado y detalle de compras.
- Inventario: venta cerrada descuenta stock; compra suma stock y actualiza costo.
- Productos sin seguimiento de inventario no alteran stock.
- No se permite cerrar una venta con stock insuficiente.
- Confirmación de venta/compra e inventario protegida en Apps Script con `LockService`.
- Historial de ventas, detalle y factura imprimible/PDF mediante la impresión del navegador.
- Estados de carga, errores y bloqueo de botones durante operaciones de escritura.
- Sin `localStorage` como fuente de datos.
- Diseño responsive.

## Fuera del alcance del MVP 2

No se agregaron funcionalidades que el documento ubica en MVP 3: descuentos, reembolsos, corrección de ventas cerradas, reportes/faltantes, autenticación, roles, backend propio o base de datos propia.

## Estructura

```text
/
├── index.html
├── style.css
├── api.js
├── datos.js
├── navegacion.js
├── entidades.js
├── productos.js
├── ventas.js
├── compras.js
├── historial.js
├── Imagenes/
└── GoogleAppsScript/
    └── Code.gs
```

## Configurar Google Apps Script

1. Abre el proyecto de Google Apps Script vinculado al Google Sheet.
2. Reemplaza el código actual por `GoogleAppsScript/Code.gs`.
3. Verifica que el proyecto esté vinculado al mismo Spreadsheet que contiene las pestañas.
4. Comprueba las pestañas y encabezados usando `ESTRUCTURA_GOOGLE_SHEETS.md`.
5. En **Implementar → Administrar implementaciones**, crea o actualiza una implementación como **Aplicación web**.
6. Ejecutar como: **tú / propietario del proyecto**.
7. Acceso: la opción que permita a la aplicación desplegada recibir las peticiones de tu frontend, según la configuración de la cuenta/curso.
8. Copia la URL `/exec` de la implementación y colócala en `API_URL` dentro de `api.js`.
9. Si actualizas el código de una implementación existente, asegúrate de crear/actualizar la versión desplegada antes de probar.

## API

### GET

```text
GET <API_URL>?resource=productos
GET <API_URL>?resource=ventas
GET <API_URL>?resource=compras
GET <API_URL>?resource=clientes
GET <API_URL>?resource=proveedores
GET <API_URL>?resource=categorias
```

### CRUD POST

```json
{
  "action": "create|update|delete",
  "data": { "id": "..." }
}
```

### Confirmar venta

El frontend utiliza una operación `confirm` para que Apps Script valide stock y registre la venta cerrada junto con el descuento de inventario bajo el mismo bloqueo de escritura.

```json
{
  "action": "confirm",
  "data": {
    "venta": { "id": "...", "estado": "cerrada", "...": "..." },
    "items": [
      { "productoId": "...", "cantidad": 2, "precio": 1000, "costo": 500 }
    ]
  }
}
```

### Registrar compra

```json
{
  "action": "confirm",
  "data": {
    "compra": { "id": "...", "proveedorId": "..." },
    "items": [
      { "productoId": "...", "cantidad": 5, "costo": 700 }
    ]
  }
}
```

## Ejecución del frontend

Se puede abrir mediante un servidor estático o desplegarlo en GitHub Pages/u otra plataforma compatible. No requiere `npm install` ni dependencias instaladas.

## Importante para la sustentación

La aplicación consume los datos desde Google Sheets. El frontend mantiene solamente el estado de la interfaz en memoria; Google Sheets es la fuente de datos.

El código del backend incluido en `GoogleAppsScript/Code.gs` valida relaciones, evita stock negativo y protege las operaciones críticas con `LockService`.
# PAPEL-Y-LUNA-POS
