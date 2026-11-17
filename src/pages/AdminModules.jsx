import React, { useState, useEffect } from 'react';
import { PageHeader, Field, Modal, ConfirmModal, money } from '../components/CommonUI';
import { validateDescuento, validateFaltante } from '../validators/posValidators';
import { descuentosApi, faltantesApi, reportesApi } from '../services/api';

/**
 * 5.12. Módulo de Catálogo de Descuentos (Solo Administradores)
 */
export function DescuentosPage({ descuentos, onRefresh, notify, runWithLoading }) {
  const [editing, setEditing] = useState(null);
  const [errors, setErrors] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);

  const save = (form) => {
    const validation = validateDescuento(form);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return notify('Revisa los datos del descuento.', 'warning');
    }

    runWithLoading(async () => {
      if (editing.id) {
        await descuentosApi.update(editing.id, validation.cleanedData);
        notify('Descuento actualizado correctamente.', 'success');
      } else {
        await descuentosApi.create(validation.cleanedData);
        notify('Descuento creado en el catálogo.', 'success');
      }
      setEditing(null);
      setErrors({});
      await onRefresh();
    });
  };

  const executeDelete = () => {
    if (!confirmDelete) return;
    const target = confirmDelete;
    setConfirmDelete(null);
    runWithLoading(async () => {
      await descuentosApi.remove(target.id);
      notify('Descuento eliminado del catálogo. Las ventas históricas no se ven afectadas.', 'success');
      await onRefresh();
    });
  };

  return (
    <main className="page">
      <PageHeader
        title="Catálogo de descuentos"
        eyebrow="PROMOCIONES Y BENEFICIOS"
        text="Administra los descuentos porcentuales y de valor fijo disponibles al cobrar una venta."
        action="Nuevo descuento"
        onAction={() => {
          setErrors({});
          setEditing({ nombre: '', tipo: 'porcentual', valor: '', activo: true });
        }}
      />

      <section className="panel table-panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre del descuento</th>
                <th>Tipo</th>
                <th>Valor</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {descuentos.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: 28, color: '#64748b' }}>
                    No hay descuentos registrados en el catálogo.
                  </td>
                </tr>
              ) : (
                descuentos.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <strong>{d.nombre}</strong>
                    </td>
                    <td>{d.tipo === 'porcentual' ? 'Porcentual (%)' : 'Valor fijo ($)'}</td>
                    <td>
                      <strong>{d.tipo === 'porcentual' ? `${d.valor}%` : money(d.valor)}</strong>
                    </td>
                    <td>
                      <span className={`status ${d.activo ? 'cerrada' : 'pendiente'}`}>
                        {d.activo ? 'ACTIVO' : 'INACTIVO'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="table-btn edit"
                        onClick={() => {
                          setErrors({});
                          setEditing(d);
                        }}
                      >
                        Editar
                      </button>
                      <button className="table-btn danger" onClick={() => setConfirmDelete(d)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <Modal
          title={editing.id ? 'Editar descuento' : 'Nuevo descuento'}
          onClose={() => setEditing(null)}
        >
          <Field label="Nombre del descuento" error={errors.nombre?.[0]}>
            <input
              className={`big-input ${errors.nombre ? 'input-error' : ''}`}
              value={editing.nombre || ''}
              onChange={(e) => setEditing({ ...editing, nombre: e.target.value })}
              placeholder="Ej. Descuento Estudiante 10%"
            />
          </Field>

          <div className="form-grid">
            <Field label="Tipo de descuento" error={errors.tipo?.[0]}>
              <select
                className="big-input"
                value={editing.tipo || 'porcentual'}
                onChange={(e) => setEditing({ ...editing, tipo: e.target.value })}
              >
                <option value="porcentual">Porcentual (%)</option>
                <option value="fijo">Valor fijo ($ COP)</option>
              </select>
            </Field>

            <Field
              label={editing.tipo === 'porcentual' ? 'Porcentaje (1 - 100%)' : 'Valor fijo en COP'}
              error={errors.valor?.[0]}
            >
              <input
                className={`big-input ${errors.valor ? 'input-error' : ''}`}
                type="number"
                min="1"
                max={editing.tipo === 'porcentual' ? '100' : '10000000'}
                value={editing.valor ?? ''}
                onChange={(e) => setEditing({ ...editing, valor: e.target.value })}
                placeholder={editing.tipo === 'porcentual' ? 'Ej. 10' : 'Ej. 2000'}
              />
            </Field>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 750, marginTop: 6 }}>
            <input
              type="checkbox"
              checked={editing.activo !== false}
              onChange={(e) => setEditing({ ...editing, activo: e.target.checked })}
              style={{ width: 18, height: 18 }}
            />
            Disponible para aplicar en nuevas ventas
          </label>

          <div className="modal-actions">
            <button className="btn btn-outline" onClick={() => setEditing(null)}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={() => save(editing)}>
              Guardar descuento
            </button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Eliminar descuento"
          message={`¿Confirmas eliminar el descuento "${confirmDelete.nombre}"? Las ventas históricas que lo utilizaron conservarán sus valores intactos.`}
          confirmLabel="Eliminar descuento"
          danger
          onCancel={() => setConfirmDelete(null)}
          onConfirm={executeDelete}
        />
      )}
    </main>
  );
}

/**
 * 5.13. Módulo de Faltantes (Administradores y Cajeros)
 */
export function FaltantesPage({
  productos,
  proveedores,
  faltantes,
  onRefresh,
  notify,
  runWithLoading,
}) {
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroProveedor, setFiltroProveedor] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [vistaAgrupada, setVistaAgrupada] = useState(false);
  const [agrupados, setAgrupados] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    productoId: '',
    descripcion: '',
    cantidadSolicitada: 1,
    tipo: 'agotado',
    proveedorId: '',
  });

  useEffect(() => {
    if (vistaAgrupada) {
      faltantesApi
        .agrupados(filtroEstado || 'pendiente')
        .then(setAgrupados)
        .catch(() => {});
    }
  }, [vistaAgrupada, filtroEstado, faltantes]);

  const filtrados = faltantes.filter((f) => {
    if (filtroTipo && f.tipo !== filtroTipo) return false;
    if (filtroProveedor && String(f.proveedorId) !== String(filtroProveedor)) return false;
    if (filtroEstado && f.estado !== filtroEstado) return false;
    return true;
  });

  const handleSave = () => {
    const validation = validateFaltante(form);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return notify('Completa los datos obligatorios del faltante.', 'warning');
    }

    runWithLoading(async () => {
      await faltantesApi.create(validation.cleanedData);
      setModalOpen(false);
      setForm({
        productoId: '',
        descripcion: '',
        cantidadSolicitada: 1,
        tipo: 'agotado',
        proveedorId: '',
      });
      setErrors({});
      notify('Faltante registrado correctamente.', 'success');
      await onRefresh();
    });
  };

  const cambiarEstado = (f) => {
    const nuevoEstado = f.estado === 'pendiente' ? 'resuelto' : 'pendiente';
    runWithLoading(async () => {
      await faltantesApi.update(f.id, { estado: nuevoEstado });
      notify(
        nuevoEstado === 'resuelto'
          ? 'Faltante marcado como resuelto.'
          : 'Faltante reabierto como pendiente.',
        'success'
      );
      await onRefresh();
    });
  };

  return (
    <main className="page">
      <PageHeader
        title="Registro de faltantes"
        eyebrow="DEMANDA INSATISFECHA"
        text="Registra productos agotados o inexistentes que solicitan los clientes para planificar compras."
        secondaryAction={vistaAgrupada ? 'Ver lista detallada' : 'Agrupar para compras'}
        onSecondaryAction={() => setVistaAgrupada(!vistaAgrupada)}
        action="Registrar faltante"
        onAction={() => {
          setErrors({});
          setModalOpen(true);
        }}
      />

      <div className="toolbar">
        <select
          className="big-input"
          style={{ maxWidth: 240 }}
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
        >
          <option value="">Todos los tipos</option>
          <option value="agotado">Producto agotado</option>
          <option value="inexistente">Producto inexistente</option>
        </select>

        <select
          className="big-input"
          style={{ maxWidth: 260 }}
          value={filtroProveedor}
          onChange={(e) => setFiltroProveedor(e.target.value)}
        >
          <option value="">Todos los proveedores</option>
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>

        <select
          className="big-input"
          style={{ maxWidth: 220 }}
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendientes</option>
          <option value="resuelto">Resueltos</option>
        </select>
      </div>

      {vistaAgrupada ? (
        <section className="panel table-panel">
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #d8e0e7' }}>
            <strong>Agrupación de faltantes normalizados para futuras compras</strong>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Producto (Nombre normalizado)</th>
                  <th>Tipo</th>
                  <th>Proveedor sugerido</th>
                  <th>Veces solicitado</th>
                  <th>Cantidad total requerida</th>
                </tr>
              </thead>
              <tbody>
                {agrupados.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: 28, color: '#64748b' }}>
                      No hay faltantes pendientes para agrupar.
                    </td>
                  </tr>
                ) : (
                  agrupados.map((g, idx) => (
                    <tr key={idx}>
                      <td>
                        <strong>{g.nombreNormalizado}</strong>
                      </td>
                      <td>
                        {g.tipo === 'agotado' ? 'Producto agotado' : 'Producto inexistente'}
                      </td>
                      <td>{g.proveedorNombre}</td>
                      <td>{g.solicitudes} solicitudes</td>
                      <td>
                        <strong style={{ color: '#123b5d', fontSize: 16 }}>
                          {g.totalCantidad} uds
                        </strong>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="panel table-panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Producto / Descripción</th>
                  <th>Cantidad</th>
                  <th>Tipo</th>
                  <th>Proveedor</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: 28, color: '#64748b' }}>
                      No hay registros de faltantes con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filtrados.map((f) => (
                    <tr key={f.id}>
                      <td>
                        <strong>{f.descripcion}</strong>
                        <small>Normalizado: {f.nombreNormalizado}</small>
                      </td>
                      <td>
                        <strong>{f.cantidadSolicitada} uds</strong>
                      </td>
                      <td>
                        {f.tipo === 'agotado' ? 'Producto agotado' : 'Producto inexistente'}
                      </td>
                      <td>{f.proveedorNombre}</td>
                      <td>{new Date(f.fecha).toLocaleDateString('es-CO')}</td>
                      <td>
                        <span className={`status ${f.estado}`}>
                          {f.estado.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <button
                          className={`table-btn ${f.estado === 'pendiente' ? 'edit' : ''}`}
                          onClick={() => cambiarEstado(f)}
                        >
                          {f.estado === 'pendiente' ? 'Marcar resuelto' : 'Reabrir pendiente'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {modalOpen && (
        <Modal title="Registrar producto faltante" onClose={() => setModalOpen(false)}>
          <Field label="Tipo de faltante" error={errors.tipo?.[0]}>
            <div className="choice-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <button
                type="button"
                className={`choice ${form.tipo === 'agotado' ? 'selected' : ''}`}
                onClick={() => setForm({ ...form, tipo: 'agotado' })}
              >
                Producto agotado
              </button>
              <button
                type="button"
                className={`choice ${form.tipo === 'inexistente' ? 'selected' : ''}`}
                onClick={() => setForm({ ...form, tipo: 'inexistente', productoId: '' })}
              >
                Producto inexistente
              </button>
            </div>
          </Field>

          {form.tipo === 'agotado' && (
            <Field label="Seleccionar producto del catálogo (opcional)">
              <select
                className="big-input"
                value={form.productoId}
                onChange={(e) => {
                  const pid = e.target.value;
                  const pObj = productos.find((x) => String(x.id) === String(pid));
                  setForm({
                    ...form,
                    productoId: pid,
                    descripcion: pObj ? pObj.nombre : form.descripcion,
                  });
                }}
              >
                <option value="">Escribir nombre manualmente...</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.codigo} - {p.nombre} (Stock: {p.stock})
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Nombre o descripción del producto solicitado" error={errors.descripcion?.[0]}>
            <input
              className={`big-input ${errors.descripcion ? 'input-error' : ''}`}
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Ej. Compás metálico escolar"
            />
          </Field>

          <div className="form-grid">
            <Field label="Cantidad solicitada" error={errors.cantidadSolicitada?.[0]}>
              <input
                className={`big-input ${errors.cantidadSolicitada ? 'input-error' : ''}`}
                type="number"
                min="1"
                value={form.cantidadSolicitada}
                onChange={(e) => setForm({ ...form, cantidadSolicitada: e.target.value })}
              />
            </Field>

            <Field label="Proveedor sugerido (opcional)">
              <select
                className="big-input"
                value={form.proveedorId}
                onChange={(e) => setForm({ ...form, proveedorId: e.target.value })}
              >
                <option value="">Sin proveedor asignado</option>
                {proveedores.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.nombre}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="modal-actions">
            <button className="btn btn-outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleSave}>
              Guardar faltante
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}

/**
 * 5.14. Módulo de Reportes Administrativos (Solo Administradores)
 */
export function ReportesPage({ notify, runWithLoading }) {
  const hoyStr = new Date().toISOString().slice(0, 10);
  const hace30Str = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);

  const [fechaInicio, setFechaInicio] = useState(hace30Str);
  const [fechaFin, setFechaFin] = useState(hoyStr);
  const [reporte, setReporte] = useState(null);

  const cargarReporte = (ini = fechaInicio, fin = fechaFin) => {
    if (!ini || !fin) {
      return notify('Selecciona una fecha inicial y una fecha final.', 'warning');
    }
    if (fin < ini) {
      return notify('La fecha final no puede ser menor que la fecha inicial (rango mínimo 1 día).', 'warning');
    }
    runWithLoading(async () => {
      const data = await reportesApi.consultar(ini, fin);
      setReporte(data);
    });
  };

  useEffect(() => {
    cargarReporte(hace30Str, hoyStr);
  }, []);

  const aplicarRangoRapido = (dias) => {
    const fin = new Date().toISOString().slice(0, 10);
    const ini = new Date(Date.now() - (dias - 1) * 86400000).toISOString().slice(0, 10);
    setFechaInicio(ini);
    setFechaFin(fin);
    cargarReporte(ini, fin);
  };

  return (
    <main className="page">
      <PageHeader
        title="Reportes administrativos"
        eyebrow="ESTADÍSTICAS EN TIEMPO REAL"
        text="Consulta las ventas, los productos más vendidos, las compras y los faltantes por rango de fechas."
      />

      <section className="panel" style={{ padding: 20, marginBottom: 22 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Field label="Fecha inicial">
            <input
              type="date"
              className="big-input"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          </Field>
          <Field label="Fecha final">
            <input
              type="date"
              className="big-input"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
            />
          </Field>
          <div style={{ marginBottom: 15, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => cargarReporte(fechaInicio, fechaFin)}>
              Consultar rango
            </button>
            <button className="btn btn-outline" onClick={() => aplicarRangoRapido(1)}>
              Hoy (1 día)
            </button>
            <button className="btn btn-outline" onClick={() => aplicarRangoRapido(7)}>
              Últimos 7 días
            </button>
            <button className="btn btn-outline" onClick={() => aplicarRangoRapido(30)}>
              Últimos 30 días
            </button>
          </div>
        </div>
      </section>

      {reporte && (
        <>
          <div className="kpi-grid">
            <div className="kpi-card">
              <span>Ventas brutas ({reporte.ventas.cantidadFacturas} facturas)</span>
              <strong>{money(reporte.ventas.totalBruto)}</strong>
            </div>
            <div className="kpi-card">
              <span>Ventas netas (tras reembolsos)</span>
              <strong>{money(reporte.ventas.totalNeto)}</strong>
            </div>
            <div className="kpi-card">
              <span>Compras en el periodo ({reporte.compras.cantidadCompras})</span>
              <strong>{money(reporte.compras.totalInvertido)}</strong>
            </div>
            <div className="kpi-card">
              <span>Rango consultado</span>
              <strong>{reporte.rango.dias} día(s)</strong>
            </div>
          </div>

          <div className="reports-grid">
            <div className="report-section">
              <h3>1. Ventas totales por método de pago</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Método de pago</th>
                      <th>Facturas</th>
                      <th>Total recaudado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(reporte.ventas.porMetodoPago || []).map((m) => (
                      <tr key={m.metodoPago}>
                        <td>
                          <strong>{m.metodoPago}</strong>
                        </td>
                        <td>{m.cantidadFacturas}</td>
                        <td>
                          <strong>{money(m.total)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="report-section">
              <h3>2. Productos más vendidos en el rango</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Unidades</th>
                      <th>Ingresos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(reporte.productosMasVendidos || []).length === 0 ? (
                      <tr>
                        <td colSpan="3" style={{ textAlign: 'center', color: '#64748b' }}>
                          Sin ventas registradas en este rango de fechas.
                        </td>
                      </tr>
                    ) : (
                      reporte.productosMasVendidos.map((p) => (
                        <tr key={p.productoId}>
                          <td>
                            <strong>{p.nombre}</strong>
                            <small>Código: {p.codigo}</small>
                          </td>
                          <td>
                            <strong>{p.unidadesVendidas} uds</strong>
                          </td>
                          <td>{money(p.ingresosGenerados)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="report-section">
              <h3>3. Compras a proveedores por rango de fechas</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Proveedor</th>
                      <th>Facturas compra</th>
                      <th>Total invertido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(reporte.compras.porProveedor || []).length === 0 ? (
                      <tr>
                        <td colSpan="3" style={{ textAlign: 'center', color: '#64748b' }}>
                          Sin compras registradas en este rango de fechas.
                        </td>
                      </tr>
                    ) : (
                      reporte.compras.porProveedor.map((cp, i) => (
                        <tr key={i}>
                          <td>
                            <strong>{cp.proveedor}</strong>
                          </td>
                          <td>{cp.cantidadCompras}</td>
                          <td>
                            <strong>{money(cp.totalComprado)}</strong>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="report-section">
              <h3>4. Productos con mayor cantidad de faltantes</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Producto (Normalizado)</th>
                      <th>Tipo</th>
                      <th>Cant. solicitada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(reporte.productosConMasFaltantes || []).length === 0 ? (
                      <tr>
                        <td colSpan="3" style={{ textAlign: 'center', color: '#64748b' }}>
                          Sin faltantes registrados en este rango de fechas.
                        </td>
                      </tr>
                    ) : (
                      reporte.productosConMasFaltantes.map((f, idx) => (
                        <tr key={idx}>
                          <td>
                            <strong>{f.nombreNormalizado}</strong>
                            <small>{f.registros} solicitud(es)</small>
                          </td>
                          <td>
                            {f.tipo === 'agotado' ? 'Agotado' : 'Inexistente'}
                          </td>
                          <td>
                            <strong>{f.totalSolicitado} uds</strong>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
