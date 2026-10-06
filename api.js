
const API_URL = "https://script.google.com/macros/s/AKfycbwcIkftzTAB1U6lzXMS7BT7O5BbBjrugk4v8QwtKb2gT3dT_xdoc4bsO1w0xht4mjOmlA/exec"
async function apiRequest(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
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
    } finally { clearTimeout(timeout); }
}

async function apiGet(resource) {
    return apiRequest(`${API_URL}?resource=${encodeURIComponent(resource)}`);
}

async function apiPost(resource, action, data) {
    return apiRequest(`${API_URL}?resource=${encodeURIComponent(resource)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, data })
    });
}
