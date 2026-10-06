// navegacion.js
const vistas = ['ventas', 'productos', 'compras', 'entidades', 'historial'];

document.getElementById('nav-principal').addEventListener('click', evento => {
    const boton = evento.target.closest('.btn-nav');
    if (!boton) return;
    const nombreVista = boton.dataset.vista;
    if (!vistas.includes(nombreVista)) return;
    vistas.forEach(v => { const el = document.getElementById(`vista-${v}`); if (el) el.style.display = v === nombreVista ? (v === 'ventas' ? 'flex' : 'block') : 'none'; });
    document.querySelectorAll('.btn-nav').forEach(btn => btn.classList.toggle('activo', btn === boton));
    if (nombreVista === 'entidades') window.renderizarEntidades();
    if (nombreVista === 'productos') window.renderizarTablaProductos();
    if (nombreVista === 'compras') window.renderizarCompras();
    if (nombreVista === 'historial') window.renderizarHistorialVentas();
});
