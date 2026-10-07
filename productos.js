// productos.js - CRUD de productos
const tablaProductos = document.getElementById('tabla-productos');
const modalProducto = document.getElementById('modal-producto');
const btnGuardarProducto = document.getElementById('btn-guardar-producto');

function abrirModalProducto(id = null) {
    document.getElementById('prod-id').value = id || '';
    document.getElementById('prod-categoria').innerHTML = '<option value="">Cargando categorías...</option>';
    llenarSelect('prod-categoria', categorias, 'Seleccione una categoría');

    const prod = id ? productos.find(p => String(p.id) === String(id)) : null;
    if (id && !prod) return alert('No se encontró el producto.');
    document.getElementById('titulo-modal-producto').textContent = prod ? 'Editar Producto' : 'Nuevo Producto';
    document.getElementById('prod-codigo').value = prod?.codigo ?? '';
    document.getElementById('prod-nombre').value = prod?.nombre ?? '';
    document.getElementById('prod-categoria').value = prod?.categoriaId ?? '';
    document.getElementById('prod-costo').value = prod?.costo ?? '';
    document.getElementById('prod-precio').value = prod?.precio ?? '';
    document.getElementById('prod-seguimiento').value = String(prod?.seguimientoInventario ?? true);
    document.getElementById('prod-stock').value = prod?.stock ?? 0;
    alternarCampoStock();
    btnGuardarProducto.disabled = false;
    btnGuardarProducto.textContent = 'Guardar';
    modalProducto.style.display = 'flex';
}
window.abrirModalProducto = abrirModalProducto;

window.renderizarTablaProductos = function() {
    tablaProductos.innerHTML = '';
    productos.forEach(prod => {
        const categoria = categorias.find(c => String(c.id) === String(prod.categoriaId));
        const tr = document.createElement('tr');
        const valores = [prod.codigo, prod.nombre, categoria?.nombre || 'Sin categoría', formatearMoneda(prod.precio), formatearMoneda(prod.costo), esSeguimientoInventario(prod) ? prod.stock : 'N/A'];
        valores.forEach(valor => { const td = document.createElement('td'); td.textContent = valor; tr.appendChild(td); });
        const acciones = document.createElement('td');
        acciones.innerHTML = `<button class="btn-accion btn-accion-editar" data-id="${prod.id}" title="Editar producto">Editar</button><button class="btn-accion btn-accion-eliminar" data-id="${prod.id}" title="Eliminar producto">Eliminar</button>`;
        tr.appendChild(acciones);
        tablaProductos.appendChild(tr);
    });
};

tablaProductos.addEventListener('click', evento => {
    const btn = evento.target.closest('.btn-accion');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.classList.contains('btn-editar')) abrirModalProducto(id);
    if (btn.classList.contains('btn-eliminar')) eliminarProducto(id);
});

function alternarCampoStock() {
    const seguimiento = document.getElementById('prod-seguimiento').value === 'true';
    document.getElementById('prod-stock').disabled = !seguimiento;
}
document.getElementById('prod-seguimiento').addEventListener('change', alternarCampoStock);
document.getElementById('btn-nuevo-producto').addEventListener('click', () => abrirModalProducto());
document.getElementById('btn-cancelar-producto').addEventListener('click', () => modalProducto.style.display = 'none');

btnGuardarProducto.addEventListener('click', async () => {
    const id = document.getElementById('prod-id').value;
    const codigo = document.getElementById('prod-codigo').value.trim();
    const nombre = document.getElementById('prod-nombre').value.trim();
    const categoriaId = document.getElementById('prod-categoria').value;
    const costo = Number(document.getElementById('prod-costo').value);
    const precio = Number(document.getElementById('prod-precio').value);
    const seguimientoInventario = document.getElementById('prod-seguimiento').value === 'true';
    const stock = seguimientoInventario ? Number(document.getElementById('prod-stock').value) : 0;

    if (!codigo || !nombre || !categoriaId) return alert('Código, nombre y categoría son obligatorios.');
    if (!Number.isFinite(costo) || costo < 0 || !Number.isFinite(precio) || precio < 0) return alert('Costo y precio deben ser números mayores o iguales a 0.');
    if (!Number.isInteger(stock) || stock < 0) return alert('El stock debe ser un número entero mayor o igual a 0.');
    if (productos.some(p => String(p.codigo).trim().toLowerCase() === codigo.toLowerCase() && String(p.id) !== String(id))) return alert('Ya existe otro producto con ese código.');
    if (!categorias.some(c => String(c.id) === String(categoriaId))) return alert('La categoría seleccionada no existe en el servicio.');

    const datos = { id: id || generarId(), codigo, nombre, categoriaId, costo, precio, seguimientoInventario, stock };
    btnGuardarProducto.disabled = true;
    btnGuardarProducto.textContent = 'Sincronizando...';
    try {
        await apiPost('productos', id ? 'update' : 'create', datos);
        const index = productos.findIndex(p => String(p.id) === String(datos.id));
        if (index >= 0) productos[index] = { ...productos[index], ...datos };
        else productos.push(datos);

        // Si el producto está en una venta abierta/en curso, sus datos visibles se actualizan inmediatamente.
        carritoFactura.forEach(item => {
            if (String(item.productoId) === String(datos.id)) {
                item.nombre = datos.nombre;
                item.precio = datos.precio;
                item.costo = datos.costo;
            }
        });
        modalProducto.style.display = 'none';
        window.renderizarTablaProductos();
        window.renderizarCatalogo(productos);
        actualizarInterfazFactura();
        notificar(id ? 'Producto actualizado correctamente.' : 'Producto creado correctamente.', 'exito');
    } catch (error) {
        alert(`No se pudo guardar el producto: ${error.message}`);
    } finally {
        btnGuardarProducto.disabled = false;
        btnGuardarProducto.textContent = 'Guardar';
    }
});

async function eliminarProducto(id) {
    const tieneCompras = comprasRegistradas.some(c => c.items.some(i => String(i.productoId) === String(id)));
    const tieneVentas = ventasCerradas.some(v => v.items.some(i => String(i.productoId) === String(id)));
    if (tieneCompras || tieneVentas) return alert('No puedes eliminar un producto que ya tiene registros asociados.');
    if (carritoFactura.some(i => String(i.productoId) === String(id))) return alert('No puedes eliminar un producto que está en la venta actual.');
    if (!confirm('¿Estás seguro de eliminar este producto?')) return;

    try {
        await apiPost('productos', 'delete', { id });
        productos = productos.filter(p => String(p.id) !== String(id));
        window.renderizarTablaProductos();
        window.renderizarCatalogo(productos);
        notificar('Producto eliminado correctamente.', 'exito');
    } catch (error) {
        alert(`No se pudo eliminar el producto: ${error.message}`);
    } finally { }
}
