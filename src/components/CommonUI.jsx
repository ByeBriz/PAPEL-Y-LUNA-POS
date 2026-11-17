import React, { useState } from 'react';

export const money = (value) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

export function PageHeader({ title, eyebrow, text, action, onAction, secondaryAction, onSecondaryAction }) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p className="lead">{text}</p>
      </div>
      {(action || secondaryAction) && (
        <div className="heading-actions">
          {secondaryAction && (
            <button className="btn btn-outline" onClick={onSecondaryAction}>
              {secondaryAction}
            </button>
          )}
          {action && (
            <button className="btn btn-primary" onClick={onAction}>
              {action}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function Field({ label, error, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}

export function Modal({ title, onClose, large = false, children }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className={`modal ${large ? 'modal-lg' : ''}`}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="close-btn" onClick={onClose} aria-label="Cerrar">
            Cerrar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmModal({ title, message, confirmLabel = 'Confirmar', danger = false, onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p style={{ fontSize: 16, lineHeight: 1.5, color: '#29475e', margin: '4px 0 18px' }}>
        {message}
      </p>
      <div className="modal-actions">
        <button className="btn btn-outline" onClick={onCancel}>
          Cancelar
        </button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function Loading({ message = 'Procesando operación...' }) {
  return (
    <div className="loading-backdrop">
      <div className="loading-card">
        <div className="spinner" />
        <h3>Un momento por favor</h3>
        <p>{message}</p>
      </div>
    </div>
  );
}

export function Notification({ message, type, onClose }) {
  return (
    <div className={`notification ${type}`} role="status">
      <strong>
        {type === 'success' ? 'Operación exitosa' : type === 'warning' ? 'Atención' : 'Error'}
      </strong>
      <span>{message}</span>
      <button onClick={onClose}>Cerrar</button>
    </div>
  );
}

export function ProductModal({ initial, categorias, errors, onClose, onSave }) {
  const [f, setF] = useState({
    codigo: '',
    nombre: '',
    categoria: categorias[0]?.nombre || '',
    precio: '',
    costo: '',
    stock: 0,
    imagen: '',
    ...initial,
  });
  const update = (k, v) => setF({ ...f, [k]: v });

  return (
    <Modal title={initial.id ? 'Editar producto' : 'Nuevo producto'} onClose={onClose}>
      <Field label="Nombre del producto" error={errors.nombre?.[0]}>
        <input
          className={`big-input ${errors.nombre ? 'input-error' : ''}`}
          value={f.nombre}
          onChange={(e) => update('nombre', e.target.value)}
          placeholder="Ej. Cuaderno cuadriculado 100 hojas"
        />
      </Field>
      <div className="form-grid">
        <Field label="Código SKU" error={errors.codigo?.[0]}>
          <input
            className={`big-input ${errors.codigo ? 'input-error' : ''}`}
            value={f.codigo}
            onChange={(e) => update('codigo', e.target.value)}
            placeholder="Ej. P005"
          />
        </Field>
        <Field label="Categoría" error={errors.categoria?.[0]}>
          <select
            className={`big-input ${errors.categoria ? 'input-error' : ''}`}
            value={f.categoria}
            onChange={(e) => update('categoria', e.target.value)}
          >
            <option value="">Selecciona una categoría</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.nombre}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="form-grid">
        <Field label="Costo unitario (COP)" error={errors.costo?.[0]}>
          <input
            className={`big-input ${errors.costo ? 'input-error' : ''}`}
            type="number"
            min="0"
            value={f.costo}
            onChange={(e) => update('costo', e.target.value)}
            placeholder="Ej. 4500"
          />
        </Field>
        <Field label="Precio de venta (COP)" error={errors.precio?.[0]}>
          <input
            className={`big-input ${errors.precio ? 'input-error' : ''}`}
            type="number"
            min="100"
            value={f.precio}
            onChange={(e) => update('precio', e.target.value)}
            placeholder="Ej. 7500"
          />
        </Field>
      </div>
      <div className="form-grid">
        <Field label="Existencias disponibles (Stock)" error={errors.stock?.[0]}>
          <input
            className={`big-input ${errors.stock ? 'input-error' : ''}`}
            type="number"
            min="0"
            value={f.stock}
            onChange={(e) => update('stock', e.target.value)}
          />
        </Field>
        <Field label="Ruta de imagen (opcional)" error={errors.imagen?.[0]}>
          <input
            className="big-input"
            value={f.imagen || ''}
            onChange={(e) => update('imagen', e.target.value)}
            placeholder="/Imagenes/CadernoArgollado.jpg"
          />
        </Field>
      </div>
      <div className="modal-actions">
        <button className="btn btn-outline" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn btn-primary" onClick={() => onSave(f)}>
          Guardar producto
        </button>
      </div>
    </Modal>
  );
}

export function FacturaModal({ venta, onClose }) {
  if (!venta) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleExportPdf = () => {
    const win = window.open('', '_blank', 'width=820,height=900');
    if (!win) {
      window.print();
      return;
    }
    const rowsHtml = (venta.items || [])
      .map(
        (it) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #d8e0e7;">${it.codigo ? `${it.codigo} - ` : ''}${it.nombre}</td>
          <td style="padding:8px;border-bottom:1px solid #d8e0e7;text-align:center;">${it.cantidad}</td>
          <td style="padding:8px;border-bottom:1px solid #d8e0e7;text-align:right;">${money(it.precio)}</td>
          <td style="padding:8px;border-bottom:1px solid #d8e0e7;text-align:right;"><strong>${money(it.cantidad * it.precio)}</strong></td>
        </tr>`
      )
      .join('');

    const html = `<!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>Factura ${venta.id} - Papel y Luna POS</title>
        <style>
          body { font-family: Arial, sans-serif; color: #183044; margin: 32px; }
          .head { display: flex; justify-content: space-between; border-bottom: 2px solid #123b5d; padding-bottom: 12px; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th { background: #eef4f7; text-align: left; padding: 8px; border-bottom: 1px solid #d8e0e7; font-size: 12px; }
          .totals { margin-top: 18px; width: 320px; margin-left: auto; }
          .totals div { display: flex; justify-content: space-between; padding: 5px 0; }
          .grand { font-size: 18px; font-weight: bold; border-top: 2px solid #123b5d; padding-top: 8px; }
        </style>
      </head>
      <body>
        <div class="head">
          <div>
            <h1 style="margin:0;color:#123b5d;">PAPEL Y LUNA</h1>
            <p style="margin:4px 0 0;">Papelería y variedades · Comprobante de Venta</p>
          </div>
          <div style="text-align:right;">
            <h2 style="margin:0;">Factura ${venta.id}</h2>
            <p style="margin:4px 0 0;">Fecha: ${new Date(venta.fecha).toLocaleString('es-CO')}</p>
            <p style="margin:2px 0 0;">Estado: ${String(venta.estado || '').toUpperCase()}</p>
          </div>
        </div>
        <p><strong>Cliente:</strong> ${venta.clienteNombre || 'Público general'} ${venta.clienteTelefono ? `· Tel: ${venta.clienteTelefono}` : ''}</p>
        <p><strong>Atendido por:</strong> ${venta.usuarioNombre || 'Cajero'} · <strong>Método de pago:</strong> ${venta.metodoPago}</p>
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th style="text-align:center;">Cant.</th>
              <th style="text-align:right;">Precio Unit.</th>
              <th style="text-align:right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div class="totals">
          <div><span>Subtotal:</span><strong>${money(venta.subtotal || venta.total)}</strong></div>
          ${venta.descuentoMonto > 0 ? `<div><span>Descuento (${venta.descuentoNombre || 'Aplicado'}):</span><strong>- ${money(venta.descuentoMonto)}</strong></div>` : ''}
          <div><span>IVA (19%):</span><strong>${money(venta.iva || 0)}</strong></div>
          <div class="grand"><span>Total Facturado:</span><span>${money(venta.total)}</span></div>
          ${venta.metodoPago === 'Efectivo' ? `<div><span>Efectivo recibido:</span><span>${money(venta.recibido || venta.total)}</span></div><div><span>Cambio:</span><span>${money(venta.cambio || 0)}</span></div>` : ''}
          ${venta.tieneReembolsos ? `<div><span>Total reembolsado:</span><span>- ${money(venta.totalReembolsado)}</span></div>` : ''}
        </div>
        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
    </html>`;
    win.document.write(html);
    win.document.close();
  };

  return (
    <Modal title={`Factura de Venta ${venta.id}`} onClose={onClose} large>
      <div className="invoice-sheet">
        <div className="invoice-header">
          <div>
            <h3>PAPEL Y LUNA POS</h3>
            <p style={{ margin: '4px 0 0', color: '#64748b' }}>
              Papelería y variedades · Factura de venta
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <strong style={{ fontSize: 18 }}>N.º {venta.id}</strong>
            <div style={{ marginTop: 4 }}>
              <span className={`status ${venta.estado}`}>
                {venta.estado.toUpperCase()}
              </span>
              {venta.tieneReembolsos && (
                <span className="status reembolso">
                  REEMBOLSO {(venta.estadoReembolso || 'PARCIAL').toUpperCase()}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="invoice-meta">
          <div>
            <strong>Fecha:</strong> {new Date(venta.fecha).toLocaleString('es-CO')}
          </div>
          <div>
            <strong>Cliente:</strong> {venta.clienteNombre || 'Público general'}
          </div>
          <div>
            <strong>Método de pago:</strong> {venta.metodoPago}
          </div>
          <div>
            <strong>Atendido por:</strong> {venta.usuarioNombre || 'Cajero'}
          </div>
          {venta.fueCorregida && (
            <div style={{ gridColumn: '1 / -1', color: '#b45309', background: '#fef3c7', padding: '8px 10px', borderRadius: 8 }}>
              <strong>Venta corregida por:</strong> {venta.corregidaPor || 'Administrador'} el{' '}
              {venta.fechaCorreccion ? new Date(venta.fechaCorreccion).toLocaleString('es-CO') : ''}
              {venta.motivoCorreccion ? ` · Motivo: ${venta.motivoCorreccion}` : ''}
            </div>
          )}
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Precio unitario</th>
                <th>Subtotal línea</th>
              </tr>
            </thead>
            <tbody>
              {(venta.items || []).map((item, idx) => (
                <tr key={idx}>
                  <td>
                    <strong>{item.nombre}</strong>
                    {item.codigo && <small>Código: {item.codigo}</small>}
                  </td>
                  <td>
                    {item.cantidad} uds
                    {item.cantidadReembolsada > 0 && (
                      <small style={{ color: '#6d28d9' }}>
                        Reembolsadas: {item.cantidadReembolsada} uds
                      </small>
                    )}
                  </td>
                  <td>{money(item.precio)}</td>
                  <td>
                    <strong>{money(item.cantidad * item.precio)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="invoice-totals">
          <div>
            <span>Subtotal artículos</span>
            <strong>{money(venta.subtotal ?? venta.total)}</strong>
          </div>
          {venta.descuentoMonto > 0 && (
            <div style={{ color: '#168a59' }}>
              <span>Descuento ({venta.descuentoNombre || 'Catálogo'})</span>
              <strong>- {money(venta.descuentoMonto)}</strong>
            </div>
          )}
          <div>
            <span>IVA (19%)</span>
            <strong>{money(venta.iva ?? 0)}</strong>
          </div>
          <div className="grand-total">
            <span>Total facturado</span>
            <span>{money(venta.total)}</span>
          </div>
          {venta.metodoPago === 'Efectivo' && (
            <>
              <div>
                <span>Dinero recibido</span>
                <strong>{money(venta.recibido || venta.total)}</strong>
              </div>
              <div>
                <span>Cambio entregado</span>
                <strong>{money(venta.cambio || 0)}</strong>
              </div>
            </>
          )}
          {venta.tieneReembolsos && (
            <div style={{ color: '#6d28d9', fontWeight: 800, marginTop: 6 }}>
              <span>Total reembolsado al cliente</span>
              <span>- {money(venta.totalReembolsado)}</span>
            </div>
          )}
        </div>

        {venta.reembolsos && venta.reembolsos.length > 0 && (
          <div style={{ marginTop: 16, borderTop: '1px solid #d8e0e7', paddingTop: 12 }}>
            <strong style={{ display: 'block', marginBottom: 8, color: '#6d28d9' }}>
              Historial de reembolsos de esta factura:
            </strong>
            {venta.reembolsos.map((r) => (
              <div
                key={r.id}
                style={{
                  background: '#faf5ff',
                  border: '1px solid #e9d5ff',
                  borderRadius: 8,
                  padding: '8px 12px',
                  marginBottom: 8,
                  fontSize: 13.5,
                }}
              >
                <div>
                  <strong>{r.codigo}</strong> ({r.tipo.toUpperCase()}) ·{' '}
                  {new Date(r.fecha).toLocaleString('es-CO')} · Usuario: {r.usuario} · Importe:{' '}
                  <strong>{money(r.totalReembolsado)}</strong>{' '}
                  ({r.devolverInventario ? 'Devuelto al inventario' : 'Sin retorno a inventario'})
                </div>
                {r.motivo && <div>Motivo: {r.motivo}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="modal-actions">
        <button className="btn btn-outline" onClick={onClose}>
          Cerrar
        </button>
        <button className="btn btn-outline" onClick={handlePrint}>
          Imprimir factura
        </button>
        <button className="btn btn-primary" onClick={handleExportPdf}>
          Exportar factura a PDF
        </button>
      </div>
    </Modal>
  );
}
