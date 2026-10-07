// ventas.js - catálogo, carrito, ventas abiertas y cierre de venta
const cuadriculaProductos = document.getElementById('cuadricula-productos');
const contenedorItemsFactura = document.getElementById('items-factura');
let idVentaAbiertaActual = null;

function productoPorId(id) { return productos.find(p => String(p.id) === String(id)); }

window.renderizarCatalogo = function(catalogoAMostrar = productos) {
    cuadriculaProductos.innerHTML = '';
    catalogoAMostrar.forEach(producto => {
        const tarjeta = document.createElement('div');
        tarjeta.className = 'tarjeta-producto';
        const cat = categorias.find(c => String(c.id) === String(producto.categoriaId));
        const stockTexto = esSeguimientoInventario(producto) ? `Stock: ${Number(producto.stock) || 0}` : 'Sin seguimiento de inventario';
        tarjeta.innerHTML = `
            <div class="texto-info">
                <p class="categoria-producto"></p>
                <h3 class="nombre-producto"></h3>
            </div>
            <p class="precio-producto">${formatearMoneda(producto.precio)}</p>
            <p class="stock-producto">${stockTexto}</p>
            <div class="controles-agregar">
                <button class="btn-accion btn-accion-editar-venta btn-accion-editar" data-id="${producto.id}" title="Editar producto">Editar</button>
                <input type="number" id="cant-${producto.id}" class="entrada-cantidad" value="1" min="1" step="1">
                <button class="btn btn-verde btn-agregar" data-id="${producto.id}">Añadir</button>
            </div>`;
        tarjeta.querySelector('.categoria-producto').textContent = cat?.nombre || 'Sin categoría';
        tarjeta.querySelector('.nombre-producto').textContent = producto.nombre;
        cuadriculaProductos.appendChild(tarjeta);
    });
};

cuadriculaProductos.addEventListener('click', evento => {
    const agregar = evento.target.closest('.btn-agregar');
    const editar = evento.target.closest('.btn-editar-venta');
    if (agregar) agregarAFactura(agregar.dataset.id);
    if (editar) abrirModalProducto(editar.dataset.id);
});

document.getElementById('entrada-busqueda').addEventListener('input', e => {
    const termino = e.target.value.trim().toLowerCase();
    renderizarCatalogo(!termino ? productos : productos.filter(p => `${p.nombre} ${p.codigo}`.toLowerCase().includes(termino)));
});

function cantidadEnCarrito(idProducto, excluirIndice = -1) {
    return carritoFactura.reduce((total, item, index) => index === excluirIndice ? total : total + Number(item.cantidad), 0);
}

function validarCantidadStock(producto, cantidadDeseada, excluirIndice = -1) {
    if (!esSeguimientoInventario(producto)) return true;
    const disponible = Number(producto.stock) || 0;
    if (cantidadDeseada < 0 || cantidadDeseada > disponible) {
        alert(`Stock insuficiente para ${producto.nombre}. Disponible: ${disponible}.`);
        return false;
    }
    return true;
}

function agregarAFactura(idProducto) {
    const producto = productoPorId(idProducto);
    if (!producto) return alert('Producto no encontrado.');
    const input = document.getElementById(`cant-${idProducto}`);
    const cantidad = Number(input?.value);
    if (!Number.isInteger(cantidad) || cantidad <= 0) return alert('La cantidad debe ser un entero mayor que 0.');

    const indice = carritoFactura.findIndex(item => String(item.productoId) === String(idProducto));
    const nuevaCantidad = (indice >= 0 ? Number(carritoFactura[indice].cantidad) : 0) + cantidad;
    if (!validarCantidadStock(producto, nuevaCantidad, indice)) return;

    if (indice >= 0) carritoFactura[indice].cantidad = nuevaCantidad;
    else carritoFactura.push({ productoId: producto.id, nombre: producto.nombre, precio: Number(producto.precio), costo: Number(producto.costo), cantidad });
    if (input) input.value = 1;
    actualizarInterfazFactura();
}

function cambiarCantidadCarrito(indice, delta) {
    const item = carritoFactura[indice];
    if (!item) return;
    const producto = productoPorId(item.productoId);
    const nueva = Number(item.cantidad) + delta;
    if (nueva <= 0) { carritoFactura.splice(indice, 1); actualizarInterfazFactura(); return; }
    if (!validarCantidadStock(producto, nueva, indice)) return;
    item.cantidad = nueva;
    actualizarInterfazFactura();
}
window.cambiarCantidadCarrito = cambiarCantidadCarrito;
window.eliminarItemCarrito = indice => { carritoFactura.splice(indice, 1); actualizarInterfazFactura(); };

function actualizarInterfazFactura() {
    const vacio = document.getElementById('estado-vacio');
    const resumen = document.getElementById('resumen-factura');
    if (!carritoFactura.length) {
        vacio.style.display = 'block'; resumen.style.display = 'none'; contenedorItemsFactura.innerHTML = '';
        totalVentaActual = 0;
        return;
    }
    vacio.style.display = 'none'; resumen.style.display = 'block'; contenedorItemsFactura.innerHTML = '';
    let subtotal = 0;
    carritoFactura.forEach((item, index) => {
        const linea = Number(item.precio) * Number(item.cantidad);
        subtotal += linea;
        const fila = document.createElement('div');
        fila.className = 'item-factura';
        fila.innerHTML = `
            <div class="info-item"><p class="nombre-item"></p><p class="subtotal-item">${formatearMoneda(item.precio)} c/u</p></div>
            <div class="controles-item">
                <button class="btn-accion btn-accion-cantidad" onclick="cambiarCantidadCarrito(${index}, -1)" title="Disminuir cantidad">−</button>
                <span style="font-weight:bold; min-width:25px; text-align:center;">${item.cantidad}</span>
                <button class="btn-accion btn-accion-cantidad" onclick="cambiarCantidadCarrito(${index}, 1)" title="Aumentar cantidad">+</button>
                <input class="precio-editable-venta" type="number" min="0" step="1" value="${Number(item.precio)}" data-indice-precio="${index}" aria-label="Precio de ${String(item.nombre).replace(/"/g, '&quot;')}" title="Precio de esta venta">
                <p class="nombre-item" style="width:90px;text-align:right;color:var(--action-blue);">${formatearMoneda(linea)}</p>
                <button class="btn-accion btn-accion-eliminar btn-accion-cantidad" onclick="eliminarItemCarrito(${index})" title="Eliminar producto">Eliminar</button>
            </div>`;
        fila.querySelector('.nombre-item').textContent = item.nombre;
        contenedorItemsFactura.appendChild(fila);
    });
    const iva = Math.round(subtotal * TASA_IVA);
    totalVentaActual = subtotal + iva;
    document.getElementById('subtotal-val').textContent = formatearMoneda(subtotal);
    document.getElementById('iva-val').textContent = formatearMoneda(iva);
    document.getElementById('total-val').textContent = formatearMoneda(totalVentaActual);
}
window.actualizarInterfazFactura = actualizarInterfazFactura;

contenedorItemsFactura.addEventListener('change', evento => {
    const entrada = evento.target.closest('.precio-editable-venta');
    if (!entrada) return;
    const indice = Number(entrada.dataset.indicePrecio);
    const item = carritoFactura[indice];
    if (!item) return;
    const precio = Number(entrada.value);
    if (!Number.isFinite(precio) || precio < 0) {
        entrada.value = Number(item.precio) || 0;
        return notificar('El precio debe ser un número mayor o igual a 0.', 'advertencia');
    }
    item.precio = Math.round(precio);
    actualizarInterfazFactura();
    notificar(`Precio de ${item.nombre} actualizado para esta venta.`, 'exito', 2600);
});

function construirVenta(estado, clienteId = '', metodoPago = '', valorRecibido = 0, cambio = 0) {
    const subtotal = carritoFactura.reduce((s, i) => s + Number(i.precio) * Number(i.cantidad), 0);
    return {
        id: idVentaAbiertaActual || generarId(), fecha: new Date().toISOString(), estado, clienteId,
        metodoPago, subtotal, total: subtotal + Math.round(subtotal * TASA_IVA), valorRecibido, cambio,
        itemsJson: JSON.stringify(carritoFactura.map(i => ({ ...i }))), actualizadoEn: new Date().toISOString()
    };
}

function actualizarVentaLocal(venta) {
    venta.items = JSON.parse(venta.itemsJson);
    const idx = ventasCerradas.findIndex(v => String(v.id) === String(venta.id));
    if (idx >= 0) ventasCerradas[idx] = venta; else ventasCerradas.push(venta);
}

document.getElementById('btn-guardar-abierta').addEventListener('click', async () => {
    if (!carritoFactura.length) return alert('No hay productos en la venta.');
    const venta = construirVenta('abierta');
    const boton = document.getElementById('btn-guardar-abierta');
    boton.disabled = true;
    try {
        await apiPost('ventas', idVentaAbiertaActual ? 'update' : 'create', venta);
        actualizarVentaLocal(venta);
        notificar('Venta guardada en estado ABIERTO.', 'exito');
        limpiarCaja();
        window.renderizarHistorialVentas();
    } catch (error) { alert(`No se pudo guardar la venta abierta: ${error.message}`); }
    finally { boton.disabled = false; }
});

document.getElementById('btn-cobrar').addEventListener('click', () => {
    if (!carritoFactura.length) return;
    llenarSelect('select-cliente-venta', clientes, 'Público general / sin cliente');
    document.getElementById('modal-total-pagar').textContent = formatearMoneda(totalVentaActual);
    document.getElementById('modal-pago').style.display = 'flex';
    document.getElementById('valor-recibido').value = '';
    document.getElementById('valor-cambio').textContent = formatearMoneda(0);
});
document.getElementById('btn-cancelar-pago').addEventListener('click', () => document.getElementById('modal-pago').style.display = 'none');
document.getElementById('metodo-pago').addEventListener('change', e => {
    document.getElementById('grupo-efectivo').style.display = e.target.value === 'Efectivo' ? 'block' : 'none';
});
document.getElementById('valor-recibido').addEventListener('input', e => {
    const cambio = Number(e.target.value) - totalVentaActual;
    const el = document.getElementById('valor-cambio');
    el.textContent = cambio < 0 ? 'Faltan fondos' : formatearMoneda(cambio);
});

document.getElementById('btn-confirmar-venta').addEventListener('click', async () => {
    const metodo = document.getElementById('metodo-pago').value;
    const clienteId = document.getElementById('select-cliente-venta').value;
    const recibido = Number(document.getElementById('valor-recibido').value) || 0;
    if (metodo === 'Efectivo' && recibido < totalVentaActual) return alert('El valor recibido es insuficiente.');
    if (metodo === 'Debe' && !clienteId) return alert('El método Debe requiere seleccionar un cliente.');

    for (const item of carritoFactura) {
        const p = productoPorId(item.productoId);
        if (!p) return alert(`El producto ${item.nombre} ya no existe en el catálogo.`);
        if (esSeguimientoInventario(p) && Number(p.stock) < Number(item.cantidad)) return alert(`Stock insuficiente: ${p.nombre}. Disponible: ${p.stock}.`);
    }

    const ventaFinal = construirVenta('cerrada', clienteId, metodo, metodo === 'Efectivo' ? recibido : 0, metodo === 'Efectivo' ? recibido - totalVentaActual : 0);
    const eraVentaAbierta = Boolean(idVentaAbiertaActual);
    const boton = document.getElementById('btn-confirmar-venta');
    boton.disabled = true;

    try {
        await apiPost('ventas', 'confirm', {
            venta: ventaFinal,
            items: carritoFactura.map(i => ({ ...i }))
        });

        carritoFactura.forEach(item => {
            const p = productoPorId(item.productoId);
            if (p && esSeguimientoInventario(p)) p.stock = Number(p.stock) - Number(item.cantidad);
        });

        actualizarVentaLocal(ventaFinal);
        document.getElementById('modal-pago').style.display = 'none';
        notificar('Venta CERRADA exitosamente.', 'exito');
        limpiarCaja();
        window.renderizarTablaProductos();
        window.renderizarCatalogo(productos);
        window.renderizarHistorialVentas();
    } catch (error) { alert(`No se pudo cerrar la venta: ${error.message}`); }
    finally { boton.disabled = false; }
});

function limpiarCaja() { carritoFactura = []; idVentaAbiertaActual = null; actualizarInterfazFactura(); }

window.retomarVentaAbierta = function(idVenta) {
    const venta = ventasCerradas.find(v => String(v.id) === String(idVenta));
    if (!venta || venta.estado !== 'abierta') return alert('La venta ya no está abierta.');
    carritoFactura = (venta.items || []).map(i => ({ ...i, cantidad: Number(i.cantidad) || 0, precio: Number(i.precio) || 0, costo: Number(i.costo) || 0 }));
    idVentaAbiertaActual = venta.id;
    actualizarInterfazFactura();
    document.querySelector('[data-vista="ventas"]').click();
};
