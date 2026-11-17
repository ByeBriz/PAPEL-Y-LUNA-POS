import React, { useState } from 'react';
import { Modal, Field, money } from '../components/CommonUI';

/**
 * Modal de Corrección de Ventas Cerradas (5.10)
 * Permite modificar productos, cantidades, precios, cliente, método de pago y descuento,
 * recalculando totales y ajustando el inventario según las diferencias.
 */
export function CorregirVentaModal({
  venta,
  productos,
  clientes,
  descuentos,
  onClose,
  onConfirm,
}) {
  const [items, setItems] = useState(() =>
    (venta.items || []).map((i) => ({
      productoId: i.productoId,
      codigo: i.codigo || '',
      nombre: i.nombre,
      cantidad: Number(i.cantidad),
      precio: Number(i.precio),
      cantidadReembolsada: Number(i.cantidadReembolsada || 0),
    }))
  );
  const [clienteId, setClienteId] = useState(venta.clienteId ? String(venta.clienteId) : '');
  const [metodoPago, setMetodoPago] = useState(venta.metodoPago || 'Efectivo');
  const [descuentoId, setDescuentoId] = useState(venta.descuentoId ? String(venta.descuentoId) : '');
  const [motivo, setMotivo] = useState(venta.motivoCorreccion || '');
  const [newProdId, setNewProdId] = useState('');
  const [errors, setErrors] = useState({});

  const addProductLine = () => {
    const prod = productos.find((p) => String(p.id) === String(newProdId));
    if (!prod) return;
    const existing = items.find((i) => String(i.productoId) === String(prod.id));
    if (existing) {
      setItems(
        items.map((i) =>
          String(i.productoId) === String(prod.id) ? { ...i, cantidad: i.cantidad + 1 } : i
        )
      );
    } else {
      setItems([
        ...items,
        {
          productoId: prod.id,
          codigo: prod.codigo,
          nombre: prod.nombre,
          cantidad: 1,
          precio: prod.precio,
          cantidadReembolsada: 0,
        },
      ]);
    }
    setNewProdId('');
  };

  const updateQty = (productoId, nextQty) => {
    const qty = Math.max(1, Number(nextQty) || 1);
    setItems(
      items.map((i) => (String(i.productoId) === String(productoId) ? { ...i, cantidad: qty } : i))
    );
  };

  const updatePrice = (productoId, nextPrice) => {
    const price = Math.max(100, Number(nextPrice) || 100);
    setItems(
      items.map((i) => (String(i.productoId) === String(productoId) ? { ...i, precio: price } : i))
    );
  };

  const removeLine = (productoId) => {
    const line = items.find((i) => String(i.productoId) === String(productoId));
    if (line && line.cantidadReembolsada > 0) {
      setErrors({
        items: [`No puedes eliminar "${line.nombre}" porque ya tiene ${line.cantidadReembolsada} unidad(es) reembolsada(s).`],
      });
      return;
    }
    setItems(items.filter((i) => String(i.productoId) !== String(productoId)));
  };

  const subtotal = items.reduce((s, i) => s + i.cantidad * i.precio, 0);
  const selectedDesc = descuentos.find((d) => String(d.id) === String(descuentoId));
  let descuentoMonto = 0;
  if (selectedDesc) {
    descuentoMonto =
      selectedDesc.tipo === 'porcentual'
        ? Math.round(subtotal * (selectedDesc.valor / 100))
        : selectedDesc.valor;
  } else if (
    descuentoId &&
    String(descuentoId) === String(venta.descuentoId) &&
    venta.descuentoTipo
  ) {
    descuentoMonto =
      venta.descuentoTipo === 'porcentual'
        ? Math.round(subtotal * (venta.descuentoValor / 100))
        : venta.descuentoValor;
  }

  const baseGravable = Math.max(0, subtotal - descuentoMonto);
  const iva = Math.round(baseGravable * 0.19);
  const total = baseGravable + iva;

  const handleSubmit = () => {
    const errs = {};
    if (items.length === 0) {
      errs.items = ['La venta corregida debe tener al menos un producto.'];
    }
    if (metodoPago === 'Debe' && !clienteId) {
      errs.clienteId = ['Si el método de pago es Debe, es obligatorio seleccionar un cliente.'];
    }
    if (descuentoMonto > subtotal) {
      errs.descuentoId = ['El descuento supera el subtotal y generaría un total negativo.'];
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    onConfirm({
      clienteId: clienteId || '',
      metodoPago,
      descuentoId: descuentoId || '',
      motivo: motivo.trim() || 'Corrección administrativa de venta cerrada',
      recibido: total,
      items: items.map((i) => ({
        productoId: i.productoId,
        cantidad: i.cantidad,
        precio: i.precio,
      })),
    });
  };

  return (
    <Modal title={`Corregir venta cerrada ${venta.id}`} onClose={onClose} large>
      <p style={{ marginTop: 0, color: '#405468', fontSize: 14.5 }}>
        La factura conservará su identificador original (<strong>{venta.id}</strong>) y el inventario
        se ajustará automáticamente según la diferencia de unidades.
      </p>

      <div className="form-grid">
        <Field label="Cliente" error={errors.clienteId?.[0]}>
          <select
            className={`big-input ${errors.clienteId ? 'input-error' : ''}`}
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
          >
            <option value="">Público general</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Método de pago" error={errors.metodoPago?.[0]}>
          <select
            className="big-input"
            value={metodoPago}
            onChange={(e) => setMetodoPago(e.target.value)}
          >
            <option value="Efectivo">Efectivo</option>
            <option value="Nequi">Nequi</option>
            <option value="Debe">Debe (Crédito)</option>
          </select>
        </Field>
      </div>

      <div className="form-grid">
        <Field label="Descuento aplicado" error={errors.descuentoId?.[0]}>
          <select
            className="big-input"
            value={descuentoId}
            onChange={(e) => setDescuentoId(e.target.value)}
          >
            <option value="">Sin descuento</option>
            {descuentos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre} ({d.tipo === 'porcentual' ? `${d.valor}%` : money(d.valor)})
              </option>
            ))}
          </select>
        </Field>

        <Field label="Motivo de la corrección">
          <input
            className="big-input"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej. Ajuste de cantidad o cambio de producto"
          />
        </Field>
      </div>

      <Field label="Agregar producto a la factura" error={errors.items?.[0]}>
        <div style={{ display: 'flex', gap: 10 }}>
          <select
            className="big-input"
            value={newProdId}
            onChange={(e) => setNewProdId(e.target.value)}
          >
            <option value="">Selecciona un producto para añadir...</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.codigo} - {p.nombre} ({money(p.precio)} · Stock actual: {p.stock})
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-outline" onClick={addProductLine}>
            Agregar línea
          </button>
        </div>
      </Field>

      <div className="table-wrap" style={{ marginTop: 10 }}>
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cantidad</th>
              <th>Precio unitario</th>
              <th>Subtotal</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.productoId}>
                <td>
                  <strong>{it.nombre}</strong>
                  {it.cantidadReembolsada > 0 && (
                    <small>Mínimo por reembolso previo: {it.cantidadReembolsada}</small>
                  )}
                </td>
                <td>
                  <input
                    className="big-input"
                    style={{ width: 95, minHeight: 38, padding: '6px 8px' }}
                    type="number"
                    min={Math.max(1, it.cantidadReembolsada || 1)}
                    value={it.cantidad}
                    onChange={(e) => updateQty(it.productoId, e.target.value)}
                  />
                </td>
                <td>
                  <input
                    className="big-input"
                    style={{ width: 130, minHeight: 38, padding: '6px 8px' }}
                    type="number"
                    min="100"
                    value={it.precio}
                    onChange={(e) => updatePrice(it.productoId, e.target.value)}
                  />
                </td>
                <td>
                  <strong>{money(it.cantidad * it.precio)}</strong>
                </td>
                <td>
                  <button
                    type="button"
                    className="table-btn danger"
                    onClick={() => removeLine(it.productoId)}
                  >
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="invoice-totals">
        <div>
          <span>Subtotal recalculado</span>
          <strong>{money(subtotal)}</strong>
        </div>
        {descuentoMonto > 0 && (
          <div style={{ color: '#168a59' }}>
            <span>Descuento</span>
            <strong>- {money(descuentoMonto)}</strong>
          </div>
        )}
        <div>
          <span>IVA (19%)</span>
          <strong>{money(iva)}</strong>
        </div>
        <div className="grand-total">
          <span>Nuevo Total Factura</span>
          <span>{money(total)}</span>
        </div>
      </div>

      <div className="modal-actions">
        <button className="btn btn-outline" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn btn-primary" onClick={handleSubmit}>
          Guardar corrección de venta
        </button>
      </div>
    </Modal>
  );
}

/**
 * Modal de Reembolsos Parciales y Totales (5.11)
 * Calcula el importe respetando proporcionalmente los descuentos originales y el IVA (19%),
 * descuenta reembolsos anteriores y permite elegir si los productos regresan al inventario.
 */
export function ReembolsarVentaModal({ venta, onClose, onConfirm }) {
  const disponibles = (venta.items || []).map((it) => {
    const yaReemb = Number(it.cantidadReembolsada || 0);
    const maxDisp = Math.max(0, Number(it.cantidad) - yaReemb);
    return {
      productoId: it.productoId,
      nombre: it.nombre,
      precio: Number(it.precio),
      vendido: Number(it.cantidad),
      yaReembolsado: yaReemb,
      disponible: maxDisp,
    };
  });

  const [cantidades, setCantidades] = useState(() => {
    const init = {};
    disponibles.forEach((d) => {
      init[d.productoId] = 0;
    });
    return init;
  });
  const [devolverInventario, setDevolverInventario] = useState(true);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');

  const factorTotal = venta.subtotal > 0 ? venta.total / venta.subtotal : 1;

  const seleccionarReembolsoTotal = () => {
    const next = {};
    disponibles.forEach((d) => {
      next[d.productoId] = d.disponible;
    });
    setCantidades(next);
    setError('');
  };

  const limpiarSeleccion = () => {
    const next = {};
    disponibles.forEach((d) => {
      next[d.productoId] = 0;
    });
    setCantidades(next);
  };

  const importeEstimado = disponibles.reduce((sum, d) => {
    const cant = Number(cantidades[d.productoId] || 0);
    return sum + Math.round(cant * d.precio * factorTotal);
  }, 0);

  const totalUnidadesSeleccionadas = Object.values(cantidades).reduce(
    (s, v) => s + Number(v || 0),
    0
  );

  const handleSubmit = () => {
    if (totalUnidadesSeleccionadas <= 0) {
      setError('Selecciona al menos 1 unidad para reembolsar.');
      return;
    }
    const items = disponibles
      .filter((d) => Number(cantidades[d.productoId] || 0) > 0)
      .map((d) => ({
        productoId: d.productoId,
        cantidad: Number(cantidades[d.productoId]),
      }));

    onConfirm({
      devolverInventario,
      motivo: motivo.trim() || 'Reembolso a cliente',
      items,
    });
  };

  const totalDisponibleGlobal = disponibles.reduce((s, d) => s + d.disponible, 0);

  return (
    <Modal title={`Reembolso de Factura ${venta.id}`} onClose={onClose} large>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <p style={{ margin: 0, color: '#405468', fontSize: 14.5 }}>
          Selecciona las unidades a devolver. El importe incluye el IVA (19%) y respeta proporcionalmente el descuento original de la venta.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={seleccionarReembolsoTotal}
            disabled={totalDisponibleGlobal === 0}
          >
            Seleccionar reembolso total
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={limpiarSeleccion}>
            Limpiar selección
          </button>
        </div>
      </div>

      {error && (
        <div style={{ color: '#b91c1c', background: '#fee2e2', padding: '10px 12px', borderRadius: 8, marginBottom: 12, fontWeight: 700 }}>
          {error}
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Vendido</th>
              <th>Ya reembolsado</th>
              <th>Disponible</th>
              <th>Cant. a reembolsar</th>
              <th>Importe proporcional</th>
            </tr>
          </thead>
          <tbody>
            {disponibles.map((d) => {
              const cant = Number(cantidades[d.productoId] || 0);
              const importeLinea = Math.round(cant * d.precio * factorTotal);
              return (
                <tr key={d.productoId}>
                  <td>
                    <strong>{d.nombre}</strong>
                    <small>Precio base: {money(d.precio)}</small>
                  </td>
                  <td>{d.vendido} uds</td>
                  <td>{d.yaReembolsado} uds</td>
                  <td>
                    <span className={`stock-badge ${d.disponible > 0 ? 'ok' : 'out'}`}>
                      {d.disponible} uds
                    </span>
                  </td>
                  <td>
                    <input
                      className="big-input"
                      style={{ width: 95, minHeight: 38, padding: '6px 8px' }}
                      type="number"
                      min="0"
                      max={d.disponible}
                      disabled={d.disponible === 0}
                      value={cant}
                      onChange={(e) => {
                        const val = Math.min(
                          d.disponible,
                          Math.max(0, Number(e.target.value) || 0)
                        );
                        setCantidades({ ...cantidades, [d.productoId]: val });
                        setError('');
                      }}
                    />
                  </td>
                  <td>
                    <strong>{money(importeLinea)}</strong>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 750, cursor: 'pointer', marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={devolverInventario}
            onChange={(e) => setDevolverInventario(e.target.checked)}
            style={{ width: 18, height: 18 }}
          />
          Devolver las unidades reembolsadas al inventario disponible
        </label>

        <Field label="Motivo del reembolso (opcional)">
          <input
            className="big-input"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej. Producto con defecto o cambio de opinión del cliente"
          />
        </Field>
      </div>

      <div className="pay-total" style={{ marginTop: 12 }}>
        Importe total a reembolsar <strong>{money(importeEstimado)}</strong>
      </div>

      <div className="modal-actions">
        <button className="btn btn-outline" onClick={onClose}>
          Cancelar
        </button>
        <button
          className="btn btn-primary"
          disabled={totalDisponibleGlobal === 0}
          onClick={handleSubmit}
        >
          Confirmar reembolso
        </button>
      </div>
    </Modal>
  );
}
