// entidades.js - Categorías, clientes y proveedores
const modalEntidad = document.getElementById('modal-entidad');
const btnGuardarEntidad = document.getElementById('btn-guardar-entidad');

const configuracionEntidades = {
    categorias: { singular: 'categoría', coleccion: () => categorias, extras: false, tabla: 'tabla-categorias' },
    clientes: { singular: 'cliente', coleccion: () => clientes, extras: true, tabla: 'tabla-clientes' },
    proveedores: { singular: 'proveedor', coleccion: () => proveedores, extras: true, tabla: 'tabla-proveedores' }
};

function escaparHTML(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

window.llenarSelect = function(idSelect, datos, opcionPorDefecto = 'Seleccione una opción') {
    const select = document.getElementById(idSelect);
    if (!select) return;
    select.innerHTML = `<option value="">${escaparHTML(opcionPorDefecto)}</option>`;
    datos.forEach(item => {
        select.insertAdjacentHTML('beforeend', `<option value="${escaparHTML(item.id)}">${escaparHTML(item.nombre)}</option>`);
    });
};

function refrescarSelectoresRelacionados() {
    llenarSelect('prod-categoria', categorias, 'Seleccione una categoría');
    llenarSelect('select-cliente-venta', clientes, 'Público general / sin cliente');
    llenarSelect('select-proveedor-compra', proveedores, 'Seleccione un proveedor');
    if (typeof window.actualizarBotonesFormulario === 'function') window.actualizarBotonesFormulario();
}

window.renderizarEntidades = function() {
    renderizarTabla('categorias', categorias, ['id', 'nombre'], 'tabla-categorias');
    renderizarTabla('clientes', clientes, ['id', 'nombre', 'telefono', 'correo'], 'tabla-clientes');
    renderizarTabla('proveedores', proveedores, ['id', 'nombre', 'telefono', 'correo'], 'tabla-proveedores');
    refrescarSelectoresRelacionados();
};

document.querySelectorAll('.busqueda-entidad').forEach(input => {
    input.addEventListener('input', () => {
        const tipo = input.dataset.tipo;
        const termino = input.value.trim().toLowerCase();
        const config = configuracionEntidades[tipo];
        if (!config) return;
        const datos = config.coleccion().filter(item => `${item.nombre ?? ''} ${item.telefono ?? ''} ${item.correo ?? ''}`.toLowerCase().includes(termino));
        const columnas = tipo === 'categorias' ? ['id', 'nombre'] : ['id', 'nombre', 'telefono', 'correo'];
        renderizarTabla(tipo, datos, columnas, config.tabla);
    });
});

function renderizarTabla(tipo, datos, columnas, idTabla) {
    const tbody = document.getElementById(idTabla);
    if (!tbody) return;
    tbody.innerHTML = '';
    datos.forEach(item => {
        const tr = document.createElement('tr');
        columnas.forEach(col => {
            const td = document.createElement('td');
            td.textContent = item[col] ?? '';
            tr.appendChild(td);
        });
        const tdAcciones = document.createElement('td');
        tdAcciones.innerHTML = `
            <button class="btn-icon btn-editar-entidad" data-tipo="${tipo}" data-id="${escaparHTML(item.id)}" title="Editar">✏️</button>
            <button class="btn-icon btn-eliminar-entidad" data-tipo="${tipo}" data-id="${escaparHTML(item.id)}" title="Eliminar">🗑️</button>`;
        tr.appendChild(tdAcciones);
        tbody.appendChild(tr);
    });
}

document.getElementById('vista-entidades').addEventListener('click', evento => {
    const btnNueva = evento.target.closest('.btn-nueva-entidad');
    const btnEditar = evento.target.closest('.btn-editar-entidad');
    const btnEliminar = evento.target.closest('.btn-eliminar-entidad');
    if (btnNueva) {
        const tiposPlurales = {
            categoria: 'categorias',
            cliente: 'clientes',
            proveedor: 'proveedores'
        };
        const tipo = tiposPlurales[btnNueva.dataset.tipo];
        if (tipo) abrirModalEntidad(tipo);
    }
    if (btnEditar) abrirModalEntidad(btnEditar.dataset.tipo, btnEditar.dataset.id);
    if (btnEliminar) eliminarEntidad(btnEliminar.dataset.tipo, btnEliminar.dataset.id);
});

function abrirModalEntidad(tipo, id = null) {
    const config = configuracionEntidades[tipo];
    if (!config) return;
    document.getElementById('entidad-tipo').value = tipo;
    document.getElementById('entidad-id').value = id || '';
    document.getElementById('titulo-modal-entidad').textContent = id ? `Editar ${config.singular}` : `Nueva ${config.singular}`;
    document.querySelectorAll('.extra-entidad').forEach(c => c.style.display = config.extras ? 'block' : 'none');

    const item = id ? config.coleccion().find(i => String(i.id) === String(id)) : null;
    document.getElementById('entidad-nombre').value = item?.nombre ?? '';
    document.getElementById('entidad-telefono').value = item?.telefono ?? '';
    document.getElementById('entidad-correo').value = item?.correo ?? '';
    btnGuardarEntidad.disabled = false;
    modalEntidad.style.display = 'flex';
}

window.abrirModalEntidad = abrirModalEntidad;
document.getElementById('btn-cancelar-entidad').addEventListener('click', () => modalEntidad.style.display = 'none');

btnGuardarEntidad.addEventListener('click', async () => {
    const tipo = document.getElementById('entidad-tipo').value;
    const id = document.getElementById('entidad-id').value;
    const nombre = document.getElementById('entidad-nombre').value.trim();
    const config = configuracionEntidades[tipo];
    if (!config || !nombre) return alert('El nombre es obligatorio.');

    const datos = { nombre };
    if (config.extras) {
        datos.telefono = document.getElementById('entidad-telefono').value.trim();
        datos.correo = document.getElementById('entidad-correo').value.trim();
        if (datos.correo && !/^\S+@\S+\.\S+$/.test(datos.correo)) return alert('El correo no tiene un formato válido.');
    }
    if (id) datos.id = id;

    btnGuardarEntidad.disabled = true;
    btnGuardarEntidad.textContent = 'Guardando...';
    try {
        const respuesta = await apiPost(tipo, id ? 'update' : 'create', id ? datos : { ...datos, id: generarId() });
        const datosGuardados = respuesta && typeof respuesta === 'object' && !Array.isArray(respuesta) ? respuesta : (id ? datos : { ...datos });
        if (!id && !datosGuardados.id) datosGuardados.id = datos.id || generarId();

        const coleccion = config.coleccion();
        if (id) {
            const index = coleccion.findIndex(i => String(i.id) === String(id));
            if (index >= 0) coleccion[index] = { ...coleccion[index], ...datosGuardados };
        } else {
            coleccion.push(datosGuardados);
        }
        modalEntidad.style.display = 'none';
        window.renderizarEntidades();
        if (typeof window.renderizarTablaProductos === 'function') window.renderizarTablaProductos();
        if (typeof window.renderizarCatalogo === 'function') window.renderizarCatalogo(productos);
    } catch (error) {
        alert(`No se pudo guardar el ${config.singular}: ${error.message}`);
    } finally {
        btnGuardarEntidad.disabled = false;
        btnGuardarEntidad.textContent = 'Guardar';
    }
});

async function eliminarEntidad(tipo, id) {
    const config = configuracionEntidades[tipo];
    if (!config) return;
    if (tipo === 'categorias' && productos.some(p => String(p.categoriaId) === String(id))) return alert('No puedes eliminar esta categoría porque hay productos asociados.');
    if (tipo === 'clientes' && ventasCerradas.some(v => String(v.clienteId) === String(id))) return alert('No puedes eliminar este cliente porque tiene ventas asociadas.');
    if (tipo === 'proveedores' && comprasRegistradas.some(c => String(c.proveedorId) === String(id))) return alert('No puedes eliminar este proveedor porque tiene compras asociadas.');
    if (!confirm(`¿Seguro que deseas eliminar este ${config.singular}?`)) return;

    try {
        mostrarCarga(true);
        await apiPost(tipo, 'delete', { id });
        const coleccion = config.coleccion();
        const nuevaColeccion = coleccion.filter(i => String(i.id) !== String(id));
        if (tipo === 'categorias') categorias = nuevaColeccion;
        if (tipo === 'clientes') clientes = nuevaColeccion;
        if (tipo === 'proveedores') proveedores = nuevaColeccion;
        window.renderizarEntidades();
    } catch (error) {
        alert(`No se pudo eliminar el ${config.singular}: ${error.message}`);
    } finally {
        mostrarCarga(false);
    }
}
