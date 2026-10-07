// api.js - único punto de acceso al servicio Google Apps Script
const API_URL = "https://script.google.com/macros/s/AKfycbx2LB9uP8Y6SSVa6cBL0skXXhOBms6Foc_Q8K_splfGTirQaX2BI7PX4pGrJkPdp3rf/exec";

let solicitudesActivas = 0;
let temporizadorCarga = null;

function textoSolicitud(resource, action = 'get') {
    const mapa = {
        productos: { get: 'Cargando productos...', create: 'Guardando producto...', update: 'Actualizando producto...', delete: 'Eliminando producto...' },
        ventas: { get: 'Cargando ventas...', create: 'Guardando venta...', update: 'Actualizando venta...', confirm: 'Procesando venta y actualizando inventario...' },
        compras: { get: 'Cargando compras...', create: 'Registrando compra...', update: 'Actualizando compra...', delete: 'Eliminando compra...' },
        categorias: { get: 'Cargando categorías...', create: 'Guardando categoría...', update: 'Actualizando categoría...', delete: 'Eliminando categoría...' },
        clientes: { get: 'Cargando clientes...', create: 'Guardando cliente...', update: 'Actualizando cliente...', delete: 'Eliminando cliente...' },
        proveedores: { get: 'Cargando proveedores...', create: 'Guardando proveedor...', update: 'Actualizando proveedor...', delete: 'Eliminando proveedor...' }
    };
    return mapa[resource]?.[action] || 'Procesando solicitud...';
}

function iniciarCargaGlobal(texto) {
    solicitudesActivas += 1;
    clearTimeout(temporizadorCarga);
    if (typeof window.mostrarCarga === 'function') window.mostrarCarga(true, texto);
}

function terminarCargaGlobal() {
    solicitudesActivas = Math.max(0, solicitudesActivas - 1);
    if (solicitudesActivas === 0) {
        temporizadorCarga = setTimeout(() => {
            if (typeof window.mostrarCarga === 'function') window.mostrarCarga(false);
        }, 150);
    }
}

async function apiRequest(url, options = {}, meta = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const resource = meta.resource || 'servicio';
    const action = meta.action || 'get';
    iniciarCargaGlobal(textoSolicitud(resource, action));
    try {
        const response = await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' });
        const text = await response.text();
        let json;
        try { json = JSON.parse(text); } catch { throw new Error('El servicio devolvió una respuesta que no es JSON.'); }
        if (!response.ok || json.success === false) throw new Error(json.message || `HTTP ${response.status}`);
        return json.data;
    } catch (error) {
        if (error.name === 'AbortError') throw new Error('La solicitud tardó demasiado. Verifica la conexión con Google Sheets.');
        throw error;
    } finally {
        clearTimeout(timeout);
        terminarCargaGlobal();
    }
}

async function apiGet(resource) {
    return apiRequest(`${API_URL}?resource=${encodeURIComponent(resource)}`, {}, { resource, action: 'get' });
}

async function apiPost(resource, action, data) {
    return apiRequest(`${API_URL}?resource=${encodeURIComponent(resource)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, data })
    }, { resource, action });
}
