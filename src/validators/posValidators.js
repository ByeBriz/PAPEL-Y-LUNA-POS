/**
 * Capa de Validación en Frontend (src/validators/posValidators.js)
 * Verifica que los datos de los formularios cumplan con las reglas de negocio
 * antes de enviarlos a la API REST en Django.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const METODOS_VALIDOS = ['Efectivo', 'Nequi', 'Debe'];

export function validateProducto(data = {}) {
  const errors = {};
  const nombre = String(data.nombre || '').trim();
  const codigo = String(data.codigo || '').trim();
  const categoria = String(data.categoria || '').trim();
  const precio = Number(data.precio);
  const costo = Number(data.costo);
  const stock = Number(data.stock);

  if (!nombre) {
    errors.nombre = ['El nombre del producto es obligatorio.'];
  } else if (nombre.length < 3) {
    errors.nombre = ['El nombre debe tener al menos 3 caracteres.'];
  }

  if (!codigo) {
    errors.codigo = ['El código SKU del producto es obligatorio.'];
  } else if (codigo.length < 2) {
    errors.codigo = ['El código debe tener al menos 2 caracteres (ej. P005).'];
  }

  if (!categoria) {
    errors.categoria = ['Debes seleccionar una categoría válida.'];
  }

  if (data.precio === '' || data.precio === undefined || Number.isNaN(precio)) {
    errors.precio = ['El precio de venta es obligatorio y debe ser numérico.'];
  } else if (precio < 100 || precio > 10000000) {
    errors.precio = ['El precio debe estar entre $100 y $10.000.000 COP.'];
  }

  if (data.costo === '' || data.costo === undefined || Number.isNaN(costo)) {
    errors.costo = ['El costo es obligatorio y debe ser numérico.'];
  } else if (costo < 0 || costo > 10000000) {
    errors.costo = ['El costo debe estar entre $0 y $10.000.000 COP.'];
  }

  if (!errors.precio && !errors.costo && precio < costo) {
    errors.precio = ['El precio de venta no puede ser menor que el costo del producto.'];
  }

  if (data.stock === '' || data.stock === undefined || Number.isNaN(stock) || !Number.isInteger(stock)) {
    errors.stock = ['El stock debe ser un número entero válido.'];
  } else if (stock < 0 || stock > 100000) {
    errors.stock = ['El stock debe estar entre 0 y 100.000 unidades.'];
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    cleanedData: {
      ...data,
      nombre,
      codigo: codigo.toUpperCase(),
      categoria,
      precio: Math.round(precio || 0),
      costo: Math.round(costo || 0),
      stock: Math.round(stock || 0),
    },
  };
}

export function validateEntidad(tipo, data = {}) {
  const errors = {};
  const nombre = String(data.nombre || '').trim();
  const telefono = String(data.telefono || '').trim();
  const correo = String(data.correo || '').trim();

  if (!nombre) {
    errors.nombre = [`El nombre de ${tipo} es obligatorio.`];
  } else if (nombre.length < 3) {
    errors.nombre = ['El nombre debe tener al menos 3 caracteres.'];
  }

  if (tipo !== 'categoria') {
    if (telefono && (telefono.length < 7 || telefono.length > 20)) {
      errors.telefono = ['El teléfono debe tener entre 7 y 20 dígitos.'];
    }
    if (correo && !EMAIL_REGEX.test(correo)) {
      errors.correo = ['Ingresa un formato de correo electrónico válido (ej. usuario@dominio.com).'];
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    cleanedData: { ...data, nombre, telefono, correo },
  };
}

export function validateVenta(data = {}) {
  const errors = {};
  const items = Array.isArray(data.items) ? data.items : [];
  const metodoPago = data.metodoPago;
  const clienteId = data.clienteId;
  const total = Number(data.total || 0);
  const recibido = Number(data.recibido || 0);
  const estado = data.estado || 'cerrada';

  if (items.length === 0) {
    errors.items = ['Agrega al menos un producto al pedido antes de continuar.'];
  } else if (items.length > 50) {
    errors.items = ['Una venta no puede superar 50 líneas de productos.'];
  }

  if (estado === 'cerrada') {
    if (!METODOS_VALIDOS.includes(metodoPago)) {
      errors.metodoPago = ['Método de pago no válido. Elige Efectivo, Nequi o Debe.'];
    }

    if (metodoPago === 'Debe' && !clienteId) {
      errors.clienteId = ['Para una venta a crédito (Debe) es obligatorio seleccionar un cliente.'];
    }

    if (metodoPago === 'Efectivo' && recibido < total) {
      errors.recibido = ['El dinero recibido es menor que el total a pagar.'];
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    cleanedData: data,
  };
}

export function validateCompra(data = {}) {
  const errors = {};
  const proveedorId = String(data.proveedorId || '').trim();
  const items = Array.isArray(data.items) ? data.items : [];

  if (!proveedorId) {
    errors.proveedorId = ['Debes seleccionar un proveedor para registrar la compra.'];
  }
  if (items.length === 0) {
    errors.items = ['Debes agregar al menos un producto con su cantidad y costo.'];
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    cleanedData: data,
  };
}

export function validateDescuento(data = {}) {
  const errors = {};
  const nombre = String(data.nombre || '').trim();
  const tipo = data.tipo || 'porcentual';
  const valor = Number(data.valor);

  if (!nombre || nombre.length < 3) {
    errors.nombre = ['El nombre del descuento debe tener al menos 3 caracteres.'];
  }
  if (!['porcentual', 'fijo'].includes(tipo)) {
    errors.tipo = ['Selecciona un tipo de descuento válido.'];
  }
  if (data.valor === '' || data.valor === undefined || Number.isNaN(valor) || valor <= 0) {
    errors.valor = ['El valor del descuento debe ser mayor a 0.'];
  } else if (tipo === 'porcentual' && (valor < 1 || valor > 100)) {
    errors.valor = ['El porcentaje de descuento debe estar entre 1% y 100%.'];
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    cleanedData: {
      nombre,
      tipo,
      valor: Math.round(valor || 0),
      activo: data.activo !== undefined ? Boolean(data.activo) : true,
    },
  };
}

export function validateFaltante(data = {}) {
  const errors = {};
  const productoId = data.productoId ? Number(data.productoId) : '';
  const descripcion = String(data.descripcion || '').trim();
  const cantidadSolicitada = Number(data.cantidadSolicitada);
  const tipo = data.tipo || 'agotado';

  if (!productoId && descripcion.length < 2) {
    errors.descripcion = ['Selecciona un producto existente o escribe el nombre del producto solicitado.'];
  }
  if (!cantidadSolicitada || Number.isNaN(cantidadSolicitada) || cantidadSolicitada < 1) {
    errors.cantidadSolicitada = ['La cantidad solicitada debe ser al menos 1 unidad.'];
  }
  if (!['agotado', 'inexistente'].includes(tipo)) {
    errors.tipo = ['Selecciona el tipo de faltante.'];
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    cleanedData: {
      productoId: productoId || null,
      descripcion,
      cantidadSolicitada: Math.round(cantidadSolicitada || 1),
      tipo,
      proveedorId: data.proveedorId ? Number(data.proveedorId) : null,
      estado: data.estado || 'pendiente',
    },
  };
}
