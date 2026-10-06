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

function mostrarCarga(mostrar, texto = 'Sincronizando con Google Sheets...') {
    const overlay = document.getElementById('cargando-overlay');
    if (!overlay) return;
    document.getElementById('texto-carga').textContent = texto;
    overlay.style.display = mostrar ? 'flex' : 'none';
}
window.mostrarCarga = mostrarCarga;

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
    mostrarCarga(true, 'Cargando información desde Google Sheets...');
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
        mostrarCarga(false);
    }
}

window.addEventListener('DOMContentLoaded', inicializarSistema);
