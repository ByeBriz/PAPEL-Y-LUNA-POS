// compras.js - registro, listado y detalle de compras
const modalCompra = document.getElementById('modal-compra');
const btnGuardarCompra = document.getElementById('btn-guardar-compra');
let itemsCompraTemporal = [];

window.renderizarCompras = function() {
    const tbody = document.getElementById('tabla-compras');
    if (!tbody) return;
    tbody.innerHTML = '';
    llenarSelect('select-producto-compra', productos, 'Seleccione un producto');
    llenarSelect('select-proveedor-compra', proveedores, 'Seleccione un proveedor');
    [...comprasRegistradas].reverse().forEach(compra => {
        const proveedor = proveedores.find(p => String(p.id) === String(compra.proveedorId));
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${String(compra.id).slice(0, 8)}</td><td>${new Date(compra.fecha).toLocaleDateString('es-CO')}</td><td></td><td>${formatearMoneda(compra.total)}</td><td><button class="btn-icon btn-detalle-compra" data-id="${compra.id}" title="Ver detalle">📄</button></td>`;
        tr.children[2].textContent = proveedor?.nombre || 'Desconocido';
        tbody.appendChild(tr);
    });
};

document.getElementById('tabla-compras').addEventListener('click', e => {
    const btn = e.target.closest('.btn-detalle-compra');
    if (!btn) return;
    const compra = comprasRegistradas.find(c => String(c.id) === String(btn.dataset.id));
    if (!compra) return;
    const proveedor = proveedores.find(p => String(p.id) === String(compra.proveedorId));
    const detalle = (compra.items || []).map(i => `• ${i.cantidad} × ${i.nombre} — ${formatearMoneda(i.costo)} c/u`).join('\n');
    alert(`Compra ${String(compra.id).slice(0, 8)}\nProveedor: ${proveedor?.nombre || 'Desconocido'}\nFecha: ${new Date(compra.fecha).toLocaleString('es-CO')}\n\n${detalle}\n\nTotal: ${formatearMoneda(compra.total)}`);
});

document.getElementById('btn-nueva-compra').addEventListener('click', () => {
    if (!proveedores.length) return alert('Primero debes registrar al menos un proveedor.');
    if (!productos.length) return alert('Primero debes registrar al menos un producto.');
    itemsCompraTemporal = [];
    actualizarTablaItemsCompra();
    llenarSelect('select-producto-compra', productos, 'Seleccione un producto');
    llenarSelect('select-proveedor-compra', proveedores, 'Seleccione un proveedor');
    btnGuardarCompra.disabled = true;
    modalCompra.style.display = 'flex';
});
document.getElementById('btn-cancelar-compra').addEventListener('click', () => modalCompra.style.display = 'none');

document.getElementById('btn-add-item-compra').addEventListener('click', () => {
    const idProd = document.getElementById('select-producto-compra').value;
    const prod = productos.find(p => String(p.id) === String(idProd));
    if (!prod) return alert('Seleccione un producto.');
    const cantidad = Number(prompt(`¿Cuántas unidades de ${prod.nombre} ingresan?`, '1'));
    const costo = Number(prompt(`¿Cuál es el costo unitario de ${prod.nombre}?`, prod.costo));
    if (!Number.isInteger(cantidad) || cantidad <= 0 || !Number.isFinite(costo) || costo < 0) return alert('Cantidad o costo inválidos.');
    const existente = itemsCompraTemporal.find(i => String(i.productoId) === String(prod.id));
    if (existente) { existente.cantidad += cantidad; existente.costo = costo; }
    else itemsCompraTemporal.push({ productoId: prod.id, nombre: prod.nombre, cantidad, costo });
    actualizarTablaItemsCompra();
});

function actualizarTablaItemsCompra() {
    const tbody = document.getElementById('items-compra-tabla');
    tbody.innerHTML = '';
    let total = 0;
    itemsCompraTemporal.forEach((item, index) => {
        const subtotal = Number(item.cantidad) * Number(item.costo); total += subtotal;
        const tr = document.createElement('tr');
        tr.innerHTML = `<td></td><td>${formatearMoneda(item.costo)}</td><td>${item.cantidad}</td><td>${formatearMoneda(subtotal)}</td><td><button class="btn-quitar" onclick="quitarItemCompra(${index})">X</button></td>`;
        tr.children[0].textContent = item.nombre;
        tbody.appendChild(tr);
    });
    document.getElementById('total-compra-val').textContent = formatearMoneda(total);
    btnGuardarCompra.disabled = itemsCompraTemporal.length === 0 || !document.getElementById('select-proveedor-compra').value;
}
window.quitarItemCompra = index => { itemsCompraTemporal.splice(index, 1); actualizarTablaItemsCompra(); };
document.getElementById('select-proveedor-compra').addEventListener('change', actualizarTablaItemsCompra);

btnGuardarCompra.addEventListener('click', async () => {
    const proveedorId = document.getElementById('select-proveedor-compra').value;
    if (!proveedorId) return alert('Seleccione un proveedor.');
    if (!itemsCompraTemporal.length) return alert('La compra debe tener al menos un producto.');

    const total = itemsCompraTemporal.reduce((sum, item) => sum + Number(item.cantidad) * Number(item.costo), 0);
    const compra = { id: generarId(), fecha: new Date().toISOString(), proveedorId, total, itemsJson: JSON.stringify(itemsCompraTemporal.map(i => ({ ...i }))) };
    btnGuardarCompra.disabled = true; btnGuardarCompra.textContent = 'Procesando...'; mostrarCarga(true, 'Registrando compra y actualizando inventario...');
    try {
        await apiPost('compras', 'confirm', {
            compra,
            items: itemsCompraTemporal.map(i => ({ ...i }))
        });

        itemsCompraTemporal.forEach(item => {
            const idx = productos.findIndex(p => String(p.id) === String(item.productoId));
            if (idx < 0) return;
            const p = productos[idx];
            productos[idx] = {
                ...p,
                costo: Number(item.costo),
                stock: esSeguimientoInventario(p) ? Number(p.stock) + Number(item.cantidad) : Number(p.stock)
            };
        });

        compra.items = JSON.parse(compra.itemsJson);
        comprasRegistradas.push(compra);
        modalCompra.style.display = 'none';
        window.renderizarCompras(); window.renderizarTablaProductos(); window.renderizarCatalogo(productos);
        alert('Compra registrada e inventario actualizado correctamente.');
    } catch (error) { alert(`No se pudo registrar la compra: ${error.message}`); }
    finally { mostrarCarga(false); btnGuardarCompra.disabled = false; btnGuardarCompra.textContent = 'Guardar y Afectar Stock'; }
});
