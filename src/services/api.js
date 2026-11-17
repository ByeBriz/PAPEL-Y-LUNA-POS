/**
 * Capa de Servicios HTTP (src/services/api.js)
 * Centraliza toda la comunicación entre React y la API REST de Django.
 */

export const API_URL =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) ||
  'http://127.0.0.1:8000/api';

const TOKEN_STORAGE_KEY = 'pyl_auth_token';
const REFRESH_STORAGE_KEY = 'pyl_auth_refresh';
const USER_STORAGE_KEY = 'pyl_auth_user';

export function getStoredToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY) || '';
}

export function getStoredRefreshToken() {
  return localStorage.getItem(REFRESH_STORAGE_KEY) || '';
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export function setStoredSession(token, user, refreshToken) {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
  if (user) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_STORAGE_KEY);
  }
  if (refreshToken !== undefined) {
    if (refreshToken) localStorage.setItem(REFRESH_STORAGE_KEY, refreshToken);
    else localStorage.removeItem(REFRESH_STORAGE_KEY);
  }
}

export function clearStoredSession() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(REFRESH_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
}

export class ApiError extends Error {
  constructor(message, status, data = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.errors = data.errors || null;
  }
}

export async function fetchApi(endpoint, options = {}) {
  const token = getStoredToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (networkErr) {
    throw new ApiError(
      'No fue posible conectar con el servidor de Papel y Luna. Verifica que el backend en Django esté en ejecución.',
      0
    );
  }

  let data = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch (_) {
      data = null;
    }
  }

  if (!response.ok) {
    if (response.status === 401 && endpoint !== '/auth/login/') {
      clearStoredSession();
      window.dispatchEvent(new CustomEvent('pyl:unauthorized'));
    }
    let msg = data?.detail || '';
    if (!msg && data?.errors) {
      const firstField = Object.keys(data.errors)[0];
      const firstErr = data.errors[firstField];
      msg = Array.isArray(firstErr) ? firstErr[0] : String(firstErr);
    }
    if (!msg) {
      msg = `Error en la operación (código HTTP ${response.status}).`;
    }
    throw new ApiError(msg, response.status, data || {});
  }

  return data;
}

export const authApi = {
  login: (username, password) =>
    fetchApi('/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () =>
    fetchApi('/auth/logout/', {
      method: 'POST',
      body: JSON.stringify({ refresh: getStoredRefreshToken() }),
    }),
  me: () => fetchApi('/auth/me/'),
};

export const productosApi = {
  list: () => fetchApi('/productos/'),
  create: (payload) =>
    fetchApi('/productos/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  update: (id, payload) =>
    fetchApi(`/productos/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  remove: (id) =>
    fetchApi(`/productos/${id}/`, {
      method: 'DELETE',
    }),
};

export const categoriasApi = {
  list: () => fetchApi('/categorias/'),
  create: (payload) =>
    fetchApi('/categorias/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  update: (id, payload) =>
    fetchApi(`/categorias/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  remove: (id) =>
    fetchApi(`/categorias/${id}/`, {
      method: 'DELETE',
    }),
};

export const clientesApi = {
  list: () => fetchApi('/clientes/'),
  create: (payload) =>
    fetchApi('/clientes/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  update: (id, payload) =>
    fetchApi(`/clientes/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  remove: (id) =>
    fetchApi(`/clientes/${id}/`, {
      method: 'DELETE',
    }),
};

export const proveedoresApi = {
  list: () => fetchApi('/proveedores/'),
  create: (payload) =>
    fetchApi('/proveedores/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  update: (id, payload) =>
    fetchApi(`/proveedores/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  remove: (id) =>
    fetchApi(`/proveedores/${id}/`, {
      method: 'DELETE',
    }),
};

export const descuentosApi = {
  list: (soloActivos = false) =>
    fetchApi(`/descuentos/${soloActivos ? '?activos=true' : ''}`),
  create: (payload) =>
    fetchApi('/descuentos/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  update: (id, payload) =>
    fetchApi(`/descuentos/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  remove: (id) =>
    fetchApi(`/descuentos/${id}/`, {
      method: 'DELETE',
    }),
};

export const ventasApi = {
  list: (estado = '') =>
    fetchApi(`/ventas/${estado ? `?estado=${encodeURIComponent(estado)}` : ''}`),
  get: (id) => fetchApi(`/ventas/${id}/`),
  create: (payload) =>
    fetchApi('/ventas/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  update: (id, payload) =>
    fetchApi(`/ventas/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  remove: (id) =>
    fetchApi(`/ventas/${id}/`, {
      method: 'DELETE',
    }),
  corregir: (id, payload) =>
    fetchApi(`/ventas/${id}/corregir/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  reembolsar: (id, payload) =>
    fetchApi(`/ventas/${id}/reembolsar/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export const comprasApi = {
  list: () => fetchApi('/compras/'),
  get: (id) => fetchApi(`/compras/${id}/`),
  create: (payload) =>
    fetchApi('/compras/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export const faltantesApi = {
  list: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.tipo) params.set('tipo', filters.tipo);
    if (filters.proveedorId) params.set('proveedorId', filters.proveedorId);
    if (filters.estado) params.set('estado', filters.estado);
    const qs = params.toString();
    return fetchApi(`/faltantes/${qs ? `?${qs}` : ''}`);
  },
  agrupados: (estado = 'pendiente') =>
    fetchApi(`/faltantes/agrupados/?estado=${encodeURIComponent(estado)}`),
  create: (payload) =>
    fetchApi('/faltantes/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  update: (id, payload) =>
    fetchApi(`/faltantes/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  remove: (id) =>
    fetchApi(`/faltantes/${id}/`, {
      method: 'DELETE',
    }),
};

export const reportesApi = {
  consultar: (fechaInicio, fechaFin) =>
    fetchApi(
      `/reportes/?fecha_inicio=${encodeURIComponent(fechaInicio)}&fecha_fin=${encodeURIComponent(fechaFin)}`
    ),
};
