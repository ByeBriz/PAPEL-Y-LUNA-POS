// historial.js - historial de ventas cargado desde Google Sheets
const tablaHistorial = document.getElementById('tabla-historial');

window.renderizarHistorialVentas = function() {
    tablaHistorial.innerHTML = '';
    [...ventasCerradas].sort((a,b) => new Date(b.fecha) - new Date(a.fecha)).forEach(venta => {
        const cliente = clientes.find(c => String(c.id) === String(venta.clienteId));
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${String(venta.id).slice(0,8)}</td><td>${new Date(venta.fecha).toLocaleString('es-CO')}</td><td></td><td>${venta.estado}</td><td>${venta.metodoPago || '-'}</td><td>${formatearMoneda(venta.total)}</td><td><button class="btn-accion btn-accion-detalle btn-detalle-venta" data-id="${venta.id}" title="Ver detalle de venta">Detalle</button>${venta.estado === 'cerrada' ? `<button class="btn-accion btn-accion-imprimir btn-imprimir-venta" data-id="${venta.id}" title="Imprimir / guardar PDF">Imprimir</button>` : ''}${venta.estado === 'abierta' ? `<button class="btn-accion btn-accion-abierta btn-retomar-venta" data-id="${venta.id}" title="Retomar venta abierta">ABIERTA</button>` : ''}</td>`;
        tr.children[2].textContent = cliente?.nombre || 'Público General';
        tr.children[3].style.color = venta.estado === 'cerrada' ? 'var(--success-green)' : 'var(--action-blue)';
        tablaHistorial.appendChild(tr);
    });
};

tablaHistorial.addEventListener('click', e => {
    const detalle = e.target.closest('.btn-detalle-venta');
    const retomar = e.target.closest('.btn-retomar-venta');
    const imprimir = e.target.closest('.btn-imprimir-venta');
    if (detalle) {
        const venta = ventasCerradas.find(v => String(v.id) === String(detalle.dataset.id));
        if (!venta) return;
        const cliente = clientes.find(c => String(c.id) === String(venta.clienteId));
        const items = (venta.items || []).map(i => `• ${i.cantidad} × ${i.nombre} — ${formatearMoneda(i.precio)} c/u`).join('\n');
        notificar(`Factura ${String(venta.id).slice(0,8)}\nEstado: ${venta.estado}\nCliente: ${cliente?.nombre || 'Público General'}\nMétodo: ${venta.metodoPago || '-'}\nFecha: ${new Date(venta.fecha).toLocaleString('es-CO')}\n\n${items}\n\nTOTAL: ${formatearMoneda(venta.total)}`);
    }
    if (retomar) window.retomarVentaAbierta(retomar.dataset.id);
    if (imprimir) imprimirFactura(imprimir.dataset.id);
});

function imprimirFactura(id) {
    const venta = ventasCerradas.find(v => String(v.id) === String(id));
    if (!venta) return alert('No se encontró la venta.');
    const cliente = clientes.find(c => String(c.id) === String(venta.clienteId));
    const filas = (venta.items || []).map(i => `<tr><td>${escapePrint(i.nombre)}</td><td>${i.cantidad}</td><td>${formatearMoneda(i.precio)}</td><td>${formatearMoneda(Number(i.precio) * Number(i.cantidad))}</td></tr>`).join('');
    const ventana = window.open('', '_blank', 'width=800,height=900');
    if (!ventana) return alert('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para este sitio.');
    ventana.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Factura ${String(venta.id).slice(0,8)}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#111}h1{margin-bottom:4px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left}.total{text-align:right;font-size:20px;font-weight:bold;margin-top:20px}</style></head><body><h1>Papelería Papel y Luna</h1><p>Factura: ${String(venta.id).slice(0,8)}<br>Fecha: ${new Date(venta.fecha).toLocaleString('es-CO')}<br>Cliente: ${escapePrint(cliente?.nombre || 'Público General')}<br>Método de pago: ${escapePrint(venta.metodoPago || '-')}</p><table><thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead><tbody>${filas}</tbody></table><p class="total">TOTAL: ${formatearMoneda(venta.total)}</p><script>window.onload=()=>window.print();<\/script></body></html>`);
    ventana.document.close();
}

function escapePrint(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
