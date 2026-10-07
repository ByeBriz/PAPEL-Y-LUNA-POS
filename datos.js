// datos.js - estado en memoria. La fuente de verdad es Google Sheets.
let productos = [];
let ventasCerradas = [];
let comprasRegistradas = [];
let categorias = [];
let clientes = [];
let proveedores = [];

let carritoFactura = [];
const TASA_IVA = 0.19;
let totalVentaActual = 0;

function formatearMoneda(valor) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(Number(valor) || 0);
}

function generarId() {
    return typeof crypto?.randomUUID === 'function'
        ? crypto.randomUUID()
        : `id-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function mostrarCarga(mostrar, texto = 'Procesando solicitud...') {
    const overlay = document.getElementById('cargando-overlay');
    if (!overlay) return;
    const textoEl = document.getElementById('texto-carga');
    if (textoEl) textoEl.textContent = texto;
    overlay.style.display = mostrar ? 'flex' : 'none';
}
window.mostrarCarga = mostrarCarga;

function notificar(mensaje, tipo = 'info', duracion = 4200, tituloPersonalizado = null) {
    const contenedor = document.getElementById('contenedor-notificaciones');
    if (!contenedor) return;
    const iconos = { exito: '✓', error: '!', advertencia: '⚠', info: 'i' };
    const titulo = { exito: 'Éxito', error: 'Error', advertencia: 'Atención', info: 'Información' };
    const tituloFinal = tituloPersonalizado || titulo[tipo] || 'Información';
    const aviso = document.createElement('div');
    aviso.className = `notificacion notificacion-${tipo}`;
    aviso.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
    aviso.innerHTML = `<span class="notificacion-icono">${iconos[tipo] || 'i'}</span><div class="notificacion-contenido"><strong>${tituloFinal}</strong><span></span></div><button type="button" class="notificacion-cerrar" aria-label="Cerrar notificación">×</button>`;
    aviso.querySelector('.notificacion-contenido span').textContent = String(mensaje);
    aviso.querySelector('.notificacion-cerrar').addEventListener('click', () => aviso.remove());
    contenedor.appendChild(aviso);
    if (duracion > 0) setTimeout(() => aviso.remove(), duracion);
}
window.notificar = notificar;
window.alert = (mensaje) => notificar(mensaje, 'error', 6000);
function esSeguimientoInventario(producto) {
    return producto?.seguimientoInventario === true || String(producto?.seguimientoInventario).toLowerCase() === 'true';
}

function normalizarDatos() {
    productos = productos.map(p => ({ ...p, precio: Number(p.precio) || 0, costo: Number(p.costo) || 0, stock: Number(p.stock) || 0 }));
    ventasCerradas = ventasCerradas.map(v => ({ ...v, total: Number(v.total) || 0, subtotal: Number(v.subtotal) || 0, valorRecibido: Number(v.valorRecibido) || 0, cambio: Number(v.cambio) || 0, items: parseItems(v.itemsJson, v.items) }));
    comprasRegistradas = comprasRegistradas.map(c => ({ ...c, total: Number(c.total) || 0, items: parseItems(c.itemsJson, c.items) }));
}

function parseItems(itemsJson, items = []) {
    if (Array.isArray(items)) return items;
    if (typeof itemsJson !== 'string' || !itemsJson.trim()) return [];
    try { return JSON.parse(itemsJson); } catch { return []; }
}

async function inicializarSistema() {
    try {
        [productos, ventasCerradas, categorias, clientes, proveedores, comprasRegistradas] = await Promise.all([
            apiGet('productos'),
            apiGet('ventas'),
            apiGet('categorias'),
            apiGet('clientes'),
            apiGet('proveedores'),
            apiGet('compras')
        ]);
        normalizarDatos();
        window.renderizarEntidades();
        window.renderizarTablaProductos();
        window.renderizarCatalogo(productos);
        window.renderizarCompras();
        window.renderizarHistorialVentas();
    } catch (error) {
        console.error(error);
        alert(`No se pudo sincronizar el sistema con Google Sheets.\n\n${error.message}`);
    } finally {
        // El indicador global es controlado por api.js para todas las solicitudes.
    }
}

window.addEventListener('DOMContentLoaded', inicializarSistema);
