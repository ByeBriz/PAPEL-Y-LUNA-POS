import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import {
  HashRouter,
  Routes,
  Route,
  NavLink,
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import './styles/global.css';

import {
  authApi,
  productosApi,
  categoriasApi,
  clientesApi,
  proveedoresApi,
  descuentosApi,
  ventasApi,
  comprasApi,
  faltantesApi,
  getStoredToken,
  getStoredUser,
  setStoredSession,
  clearStoredSession,
} from './services/api';

import {
  validateProducto,
  validateEntidad,
  validateVenta,
  validateCompra,
  validateFaltante,
} from './validators/posValidators';

import {
  money,
  PageHeader,
  Field,
  Modal,
  ConfirmModal,
  Loading,
  Notification,
  ProductModal,
  FacturaModal,
} from './components/CommonUI';

import { CorregirVentaModal, ReembolsarVentaModal } from './pages/OperacionesModal';
import { DescuentosPage, FaltantesPage, ReportesPage } from './pages/AdminModules';

function App() {
  const [user, setUser] = useState(() => getStoredUser());
  const [authChecking, setAuthChecking] = useState(() => Boolean(getStoredToken()));

  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [descuentos, setDescuentos] = useState([]);
  const [compras, setCompras] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [faltantes, setFaltantes] = useState([]);

  // Estado persistente de la venta activa mientras el usuario navega entre módulos
  const [cart, setCart] = useState([]);
  const [activeOpenSaleId, setActiveOpenSaleId] = useState(null);
  const [saleClient, setSaleClient] = useState('');
  const [saleMethod, setSaleMethod] = useState('Efectivo');
  const [saleDiscountId, setSaleDiscountId] = useState('');

  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const notify = useCallback((message, type = 'success') => {
    setNotice({ message, type });
    window.clearTimeout(window.__pylNotice);
    window.__pylNotice = window.setTimeout(() => setNotice(null), 4000);
  }, []);

  const loadAllData = useCallback(async (currentUser) => {
    if (!currentUser) return;
    try {
      const isAdmin = currentUser.rol === 'ADMINISTRADOR';
      const promises = [
        productosApi.list(),
        categoriasApi.list(),
        clientesApi.list(),
        proveedoresApi.list(),
        descuentosApi.list(false),
        ventasApi.list(),
        faltantesApi.list(),
      ];
      if (isAdmin) {
        promises.push(comprasApi.list());
      }
      const results = await Promise.all(promises);
      setProductos(results[0] || []);
      setCategorias(results[1] || []);
      setClientes(results[2] || []);
      setProveedores(results[3] || []);
      setDescuentos(results[4] || []);
      setVentas(results[5] || []);
      setFaltantes(results[6] || []);
      if (isAdmin && results[7]) {
        setCompras(results[7] || []);
      }
    } catch (err) {
      notify(err.message || 'Error al sincronizar con la base de datos.', 'error');
    }
  }, [notify]);

  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
      notify('Tu sesión ha expirado. Inicia sesión nuevamente.', 'warning');
    };
    window.addEventListener('pyl:unauthorized', onUnauthorized);
    return () => window.removeEventListener('pyl:unauthorized', onUnauthorized);
  }, [notify]);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setAuthChecking(false);
      return;
    }
    authApi
      .me()
      .then((res) => {
        setStoredSession(token, res.user);
        setUser(res.user);
        return loadAllData(res.user);
      })
      .catch(() => {
        clearStoredSession();
        setUser(null);
      })
      .finally(() => setAuthChecking(false));
  }, [loadAllData]);

  const runWithLoading = async (asyncFn) => {
    setLoading(true);
    try {
      await asyncFn();
    } catch (err) {
      notify(err.message || 'Ocurrió un error al comunicarse con el servidor.', 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = async (token, loggedUser, refreshToken) => {
    setStoredSession(token, loggedUser, refreshToken);
    setUser(loggedUser);
    setLoading(true);
    try {
      await loadAllData(loggedUser);
      notify(`Bienvenido(a), ${loggedUser.nombre}.`, 'success');
    } finally {
      setLoading(false);
    }
  };

  const executeLogout = async () => {
    setConfirmLogout(false);
    try {
      await authApi.logout();
    } catch (_) {
      // Ignorar si el token ya había expirado
    }
    clearStoredSession();
    setUser(null);
    setCart([]);
    setActiveOpenSaleId(null);
    setSaleClient('');
    setSaleDiscountId('');
    notify('Has cerrado sesión correctamente.', 'success');
  };

  if (authChecking) {
    return <Loading message="Verificando sesión..." />;
  }

  if (!user) {
    return (
      <>
        <LoginScreen onLoginSuccess={handleLoginSuccess} notify={notify} />
        {loading && <Loading />}
        {notice && <Notification {...notice} onClose={() => setNotice(null)} />}
      </>
    );
  }

  const isAdmin = user.rol === 'ADMINISTRADOR';
  const ventasAbiertasCount = ventas.filter((v) => v.estado === 'abierta').length;

  return (
    <>
      <AppShell
        user={user}
        cartCount={cart.reduce((s, i) => s + i.cantidad, 0)}
        openSalesCount={ventasAbiertasCount}
        faltantesCount={faltantes.filter((f) => f.estado === 'pendiente').length}
        onLogoutRequest={() => setConfirmLogout(true)}
      />
      <Routes>
        <Route
          path="/"
          element={
            <Home
              user={user}
              productos={productos}
              ventas={ventas}
              compras={compras}
              faltantes={faltantes}
            />
          }
        />
        <Route
          path="/ventas"
          element={
            <Ventas
              user={user}
              productos={productos}
              categorias={categorias}
              clientes={clientes}
              proveedores={proveedores}
              descuentos={descuentos.filter((d) => d.activo)}
              ventas={ventas}
              cart={cart}
              setCart={setCart}
              activeOpenSaleId={activeOpenSaleId}
              setActiveOpenSaleId={setActiveOpenSaleId}
              client={saleClient}
              setClient={setSaleClient}
              method={saleMethod}
              setMethod={setSaleMethod}
              discountId={saleDiscountId}
              setDiscountId={setSaleDiscountId}
              onRefresh={() => loadAllData(user)}
              notify={notify}
              runWithLoading={runWithLoading}
            />
          }
        />
        <Route
          path="/productos"
          element={
            <Productos
              user={user}
              productos={productos}
              categorias={categorias}
              onRefresh={() => loadAllData(user)}
              notify={notify}
              runWithLoading={runWithLoading}
            />
          }
        />
        <Route
          path="/clientes"
          element={
            <Entidades
              titulo="Clientes"
              tipo="cliente"
              items={clientes}
              apiService={clientesApi}
              canManage={true}
              onRefresh={() => loadAllData(user)}
              notify={notify}
              runWithLoading={runWithLoading}
            />
          }
        />
        <Route
          path="/faltantes"
          element={
            <FaltantesPage
              productos={productos}
              proveedores={proveedores}
              faltantes={faltantes}
              onRefresh={() => loadAllData(user)}
              notify={notify}
              runWithLoading={runWithLoading}
            />
          }
        />
        <Route
          path="/historial"
          element={
            <Historial
              user={user}
              ventas={ventas}
              productos={productos}
              clientes={clientes}
              descuentos={descuentos}
              onResumeOpenSale={(openSale, navigateFn) => {
                setCart(
                  (openSale.items || []).map((i) => ({
                    id: i.productoId,
                    codigo: i.codigo || '',
                    nombre: i.nombre,
                    precio: i.precio,
                    cantidad: i.cantidad,
                  }))
                );
                setActiveOpenSaleId(openSale.id);
                setSaleClient(openSale.clienteId ? String(openSale.clienteId) : '');
                setSaleMethod(openSale.metodoPago || 'Efectivo');
                setSaleDiscountId(openSale.descuentoId ? String(openSale.descuentoId) : '');
                notify(`Venta abierta ${openSale.id} retomada en caja.`, 'success');
                navigateFn('/ventas');
              }}
              onRefresh={() => loadAllData(user)}
              notify={notify}
              runWithLoading={runWithLoading}
            />
          }
        />

        {/* Rutas exclusivas de ADMINISTRADOR con protección en frontend y backend */}
        <Route
          path="/compras"
          element={
            isAdmin ? (
              <Compras
                productos={productos}
                proveedores={proveedores}
                compras={compras}
                onRefresh={() => loadAllData(user)}
                notify={notify}
                runWithLoading={runWithLoading}
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/proveedores"
          element={
            isAdmin ? (
              <Entidades
                titulo="Proveedores"
                tipo="proveedor"
                items={proveedores}
                apiService={proveedoresApi}
                canManage={isAdmin}
                onRefresh={() => loadAllData(user)}
                notify={notify}
                runWithLoading={runWithLoading}
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/categorias"
          element={
            isAdmin ? (
              <Entidades
                titulo="Categorías"
                tipo="categoria"
                items={categorias}
                apiService={categoriasApi}
                canManage={isAdmin}
                onRefresh={() => loadAllData(user)}
                notify={notify}
                runWithLoading={runWithLoading}
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/descuentos"
          element={
            isAdmin ? (
              <DescuentosPage
                descuentos={descuentos}
                onRefresh={() => loadAllData(user)}
                notify={notify}
                runWithLoading={runWithLoading}
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/reportes"
          element={
            isAdmin ? (
              <ReportesPage notify={notify} runWithLoading={runWithLoading} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {confirmLogout && (
        <ConfirmModal
          title="Cerrar sesión"
          message="¿Deseas cerrar tu sesión actual en Papel y Luna POS?"
          confirmLabel="Cerrar sesión"
          onCancel={() => setConfirmLogout(false)}
          onConfirm={executeLogout}
        />
      )}
      {loading && <Loading />}
      {notice && <Notification {...notice} onClose={() => setNotice(null)} />}
    </>
  );
}

function LoginScreen({ onLoginSuccess, notify }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError('Ingresa tu usuario y contraseña para continuar.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await authApi.login(username.trim(), password);
      await onLoginSuccess(res.token, res.user, res.refresh);
    } catch (err) {
      setError(err.message || 'Credenciales inválidas.');
      notify(err.message || 'Credenciales inválidas.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-mark">P</div>
          <div>
            <h1>Papel y Luna POS</h1>
            <p>Papelería y variedades · Sistema de Punto de Venta</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <Field label="Nombre de usuario">
            <input
              className="big-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ej. admin o cajero"
              autoFocus
            />
          </Field>

          <Field label="Contraseña">
            <input
              className="big-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingresa tu contraseña"
            />
          </Field>

          {error && (
            <div
              style={{
                color: '#b91c1c',
                background: '#fee2e2',
                padding: '10px 12px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 700,
                marginBottom: 14,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={submitting}
          >
            {submitting ? 'Verificando credenciales...' : 'Iniciar sesión'}
          </button>
        </form>

      </div>
    </div>
  );
}

function AppShell({ user, cartCount, openSalesCount, faltantesCount, onLogoutRequest }) {
  const location = useLocation();
  const isAdmin = user.rol === 'ADMINISTRADOR';

  const primaryNav = [
    ['/', 'Inicio'],
    [
      '/ventas',
      `Ventas${cartCount ? ` (${cartCount})` : openSalesCount ? ` · ${openSalesCount} abierta(s)` : ''}`,
    ],
    ['/productos', 'Productos'],
    ['/historial', 'Historial y Facturas'],
    ['/clientes', 'Clientes'],
    ['/faltantes', `Faltantes${faltantesCount ? ` (${faltantesCount})` : ''}`],
  ];

  const adminNav = isAdmin
    ? [
        ['/compras', 'Compras'],
        ['/categorias', 'Categorías'],
        ['/proveedores', 'Proveedores'],
        ['/descuentos', 'Descuentos'],
        ['/reportes', 'Reportes'],
      ]
    : [];

  return (
    <>
      <header className="topbar">
        <div className="brand-mark">P</div>
        <div>
          <h1>Papel y Luna</h1>
          <p>Papelería y variedades · Punto de venta</p>
        </div>
        <div className="topbar-spacer" />
        <div className="user-session-bar">
          <span className="role-pill">
            <span className="status-dot" />
            {user.nombre} · {user.rol}
          </span>
          <button className="btn-logout" onClick={onLogoutRequest}>
            Cerrar sesión
          </button>
        </div>
      </header>
      <nav className="main-nav" aria-label="Navegación principal">
        {primaryNav.map(([to, label]) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            {label}
          </NavLink>
        ))}
        {adminNav.length > 0 && <div className="nav-divider" />}
        {adminNav.map(([to, label]) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-item secondary ${isActive ? 'active' : ''}`}
          >
            {label}
          </NavLink>
        ))}
      </nav>
      {location.pathname !== '/' && (
        <div className="breadcrumb">
          Papel y Luna <span>/</span> {pageName(location.pathname)}
        </div>
      )}
    </>
  );
}

const pageName = (p) =>
  ({
    '/ventas': 'Punto de venta y Ventas abiertas',
    '/productos': 'Catálogo de productos e inventario',
    '/compras': 'Compras a proveedores',
    '/historial': 'Historial de ventas, Facturas, Correcciones y Reembolsos',
    '/clientes': 'Directorio de clientes',
    '/proveedores': 'Directorio de proveedores',
    '/categorias': 'Categorías de productos',
    '/descuentos': 'Catálogo de descuentos',
    '/faltantes': 'Productos faltantes',
    '/reportes': 'Reportes administrativos',
  }[p] || '');

function Home({ user, productos, ventas, compras, faltantes }) {
  const navigate = useNavigate();
  const isAdmin = user.rol === 'ADMINISTRADOR';
  const ventasCerradas = ventas.filter((v) => v.estado !== 'abierta');
  const ventasAbiertas = ventas.filter((v) => v.estado === 'abierta');
  const totalVendido = ventasCerradas.reduce(
    (s, v) => s + Math.max(0, Number(v.total || 0) - Number(v.totalReembolsado || 0)),
    0
  );
  const stockBajo = productos.filter((p) => p.stock <= 10).length;
  const faltantesPendientes = faltantes.filter((f) => f.estado === 'pendiente').length;

  return (
    <main className="page home-page">
      <section className="welcome">
        <div>
          <p className="eyebrow">PANEL PRINCIPAL · ROL {user.rol}</p>
          <h2>Hola, {user.nombre}</h2>
          <p className="lead">
            Selecciona un módulo para gestionar las ventas, las facturas, los clientes o el inventario de la papelería.
          </p>
        </div>
        <div className="welcome-note">
          Atajo rápido: En Ventas puedes presionar <span className="kbd-hint">/</span> para buscar productos y <span className="kbd-hint">F4</span> para abrir la ventana de cobro.
        </div>
      </section>

      <div className="kpi-grid">
        <div className="kpi-card">
          <span>Ventas netas registradas</span>
          <strong>{money(totalVendido)}</strong>
        </div>
        <div className="kpi-card">
          <span>Ventas abiertas en espera</span>
          <strong>{ventasAbiertas.length} pedido(s)</strong>
        </div>
        <div className="kpi-card">
          <span>Stock por reponer (≤ 10 uds)</span>
          <strong>{stockBajo} productos</strong>
        </div>
        <div className="kpi-card">
          <span>Faltantes pendientes</span>
          <strong>{faltantesPendientes} solicitudes</strong>
        </div>
      </div>

      <div className="home-grid">
        <HomeCard
          title="Nueva venta y Ventas abiertas"
          text="Agrega productos al carrito, aplica descuentos, guarda ventas abiertas o cobra en Efectivo, Nequi o Debe."
          action="Ir a caja"
          primary
          onClick={() => navigate('/ventas')}
        />
        <HomeCard
          title="Historial y Facturación"
          text={
            isAdmin
              ? 'Consulta facturas, imprímelas o expórtalas a PDF, corrige ventas cerradas y gestiona reembolsos.'
              : 'Consulta el historial de ventas cerradas y abiertas, imprime facturas o expórtalas a PDF.'
          }
          action="Ver historial"
          onClick={() => navigate('/historial')}
        />
        <HomeCard
          title="Productos e Inventario"
          text="Consulta las existencias en tiempo real, precios de venta y categorías del catálogo."
          action="Ver productos"
          onClick={() => navigate('/productos')}
        />
        <HomeCard
          title="Registro de Faltantes"
          text="Anota productos agotados o inexistentes que solicitan los clientes para futuras compras."
          action="Ver faltantes"
          onClick={() => navigate('/faltantes')}
        />
        {isAdmin && (
          <>
            <HomeCard
              title="Compras a Proveedores"
              text="Registra facturas de compra de mercancía para incrementar automáticamente el inventario."
              action="Registrar compras"
              onClick={() => navigate('/compras')}
            />
            <HomeCard
              title="Reportes Administrativos"
              text="Analiza ventas totales, productos más vendidos, compras y faltantes por rango de fechas."
              action="Abrir reportes"
              onClick={() => navigate('/reportes')}
            />
          </>
        )}
      </div>
    </main>
  );
}

function HomeCard({ title, text, action, onClick, primary }) {
  return (
    <article className={`home-card ${primary ? 'primary' : ''}`}>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
      <button className={`btn ${primary ? 'btn-primary' : 'btn-outline'}`} onClick={onClick}>
        {action}
      </button>
    </article>
  );
}

function Ventas({
  productos,
  categorias,
  clientes,
  proveedores,
  descuentos,
  ventas,
  cart,
  setCart,
  activeOpenSaleId,
  setActiveOpenSaleId,
  client,
  setClient,
  method,
  setMethod,
  discountId,
  setDiscountId,
  onRefresh,
  notify,
  runWithLoading,
}) {
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('Todas');
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [received, setReceived] = useState('');
  const [priceEdit, setPriceEdit] = useState(null);
  const [addedId, setAddedId] = useState(null);
  const [cartBump, setCartBump] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Modales auxiliares desde el flujo de venta (Editar producto, Registrar faltante, Nuevo cliente, Factura emitida, Confirmar descartar abierta)
  const [editingProduct, setEditingProduct] = useState(null);
  const [prodErrors, setProdErrors] = useState({});
  const [faltanteModal, setFaltanteModal] = useState(null);
  const [faltanteErrors, setFaltanteErrors] = useState({});
  const [quickClientModal, setQuickClientModal] = useState(false);
  const [quickClientForm, setQuickClientForm] = useState({ nombre: '', telefono: '', correo: '' });
  const [quickClientErrors, setQuickClientErrors] = useState({});
  const [completedInvoice, setCompletedInvoice] = useState(null);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(null);

  const searchInputRef = useRef(null);

  const openSales = ventas.filter((v) => v.estado === 'abierta');

  const subtotal = cart.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const selectedDiscount = descuentos.find((d) => String(d.id) === String(discountId));
  let descuentoMonto = 0;
  if (selectedDiscount && subtotal > 0) {
    descuentoMonto =
      selectedDiscount.tipo === 'porcentual'
        ? Math.round(subtotal * (selectedDiscount.valor / 100))
        : selectedDiscount.valor;
  }
  const baseGravable = Math.max(0, subtotal - descuentoMonto);
  const iva = Math.round(baseGravable * 0.19);
  const total = baseGravable + iva;
  const change = Math.max(0, (Number(received) || 0) - total);

  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = document.activeElement?.tagName;
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag);
      if (e.key === '/' && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length > 0) {
          setFormErrors({});
          setPaymentOpen(true);
        }
      } else if (e.key === 'Escape' && paymentOpen) {
        setPaymentOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cart.length, paymentOpen]);

  const filtered = productos.filter((p) => {
    const matchesSearch =
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      String(p.codigo).toLowerCase().includes(search.toLowerCase());
    const matchesCat = selectedCat === 'Todas' || p.categoria === selectedCat;
    return matchesSearch && matchesCat;
  });

  const add = (p) => {
    if (p.stock <= 0) {
      return notify(`"${p.nombre}" está agotado. Puedes registrarlo como faltante.`, 'warning');
    }
    const existing = cart.find((i) => i.id === p.id);
    if (existing && existing.cantidad + 1 > p.stock) {
      return notify(`Solo hay ${p.stock} unidades disponibles de "${p.nombre}".`, 'warning');
    }
    if (existing) {
      setCart(cart.map((i) => (i.id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i)));
    } else {
      setCart([...cart, { ...p, cantidad: 1 }]);
    }
    setAddedId(p.id);
    setCartBump(true);
    window.setTimeout(() => setAddedId(null), 350);
    window.setTimeout(() => setCartBump(false), 300);
  };

  const changeQty = (id, d) => {
    const item = cart.find((i) => i.id === id);
    const prod = productos.find((p) => p.id === id);
    if (d > 0 && prod && item && item.cantidad + d > prod.stock) {
      return notify(`Stock máximo alcanzado (${prod.stock} uds).`, 'warning');
    }
    setCart(cart.map((i) => (i.id === id ? { ...i, cantidad: Math.max(1, i.cantidad + d) } : i)));
  };

  const resetCurrentSaleDraft = () => {
    setCart([]);
    setActiveOpenSaleId(null);
    setClient('');
    setMethod('Efectivo');
    setDiscountId('');
    setReceived('');
    setFormErrors({});
  };

  // Guardar como venta abierta en PostgreSQL/Django (5.7)
  const saveOpenSale = () => {
    if (cart.length === 0) {
      return notify('Agrega al menos un producto antes de guardar una venta abierta.', 'warning');
    }
    if (descuentoMonto > subtotal) {
      return notify('El descuento seleccionado supera el subtotal de la venta.', 'warning');
    }

    const payload = {
      estado: 'abierta',
      clienteId: client || '',
      metodoPago: method || 'Efectivo',
      descuentoId: discountId || '',
      total,
      items: cart.map((i) => ({
        productoId: i.id,
        nombre: i.nombre,
        cantidad: i.cantidad,
        precio: i.precio,
      })),
    };

    runWithLoading(async () => {
      if (activeOpenSaleId) {
        await ventasApi.update(activeOpenSaleId, payload);
        notify(`Venta abierta ${activeOpenSaleId} actualizada correctamente.`, 'success');
      } else {
        const created = await ventasApi.create(payload);
        notify(`Venta abierta ${created.id} guardada. Puedes retomarla cuando el cliente esté listo.`, 'success');
      }
      resetCurrentSaleDraft();
      await onRefresh();
    });
  };

  const resumeOpenSale = (openSale) => {
    setCart(
      (openSale.items || []).map((i) => ({
        id: i.productoId,
        codigo: i.codigo || '',
        nombre: i.nombre,
        precio: i.precio,
        cantidad: i.cantidad,
      }))
    );
    setActiveOpenSaleId(openSale.id);
    setClient(openSale.clienteId ? String(openSale.clienteId) : '');
    setMethod(openSale.metodoPago || 'Efectivo');
    setDiscountId(openSale.descuentoId ? String(openSale.descuentoId) : '');
    notify(`Venta ${openSale.id} cargada en el pedido actual.`, 'success');
  };

  const discardOpenSale = () => {
    if (!confirmDiscardOpen) return;
    const target = confirmDiscardOpen;
    setConfirmDiscardOpen(null);
    runWithLoading(async () => {
      await ventasApi.remove(target.id);
      if (activeOpenSaleId === target.id) {
        resetCurrentSaleDraft();
      }
      notify(`Venta abierta ${target.id} descartada.`, 'success');
      await onRefresh();
    });
  };

  // Cerrar venta y persistir en base de datos (5.6)
  const closeSale = () => {
    if (descuentoMonto > subtotal) {
      setFormErrors({
        descuentoId: ['El descuento supera el subtotal de la venta. No se permiten totales negativos.'],
      });
      return notify('El descuento aplicado genera un total negativo.', 'warning');
    }

    const payload = {
      estado: 'cerrada',
      clienteId: client || '',
      metodoPago: method,
      descuentoId: discountId || '',
      total,
      recibido: method === 'Efectivo' ? Number(received || 0) : total,
      items: cart.map((i) => ({
        productoId: i.id,
        nombre: i.nombre,
        cantidad: i.cantidad,
        precio: i.precio,
      })),
    };

    const validation = validateVenta(payload);
    if (!validation.isValid) {
      setFormErrors(validation.errors);
      return notify('Revisa los datos del cobro antes de confirmar.', 'warning');
    }

    runWithLoading(async () => {
      let savedSale;
      if (activeOpenSaleId) {
        savedSale = await ventasApi.update(activeOpenSaleId, payload);
      } else {
        savedSale = await ventasApi.create(payload);
      }
      setPaymentOpen(false);
      resetCurrentSaleDraft();
      await onRefresh();
      setCompletedInvoice(savedSale);
      notify(`Venta ${savedSale.id} cerrada y registrada en la base de datos.`, 'success');
    });
  };

  // Editar producto desde el flujo de venta (permitido para Cajero y Administrador)
  const handleSaveProductFromSale = (form) => {
    const validation = validateProducto(form);
    if (!validation.isValid) {
      setProdErrors(validation.errors);
      return notify('Revisa los datos del producto.', 'warning');
    }

    runWithLoading(async () => {
      const updated = await productosApi.update(editingProduct.id, validation.cleanedData);
      // Sincronizar también en el carrito si ya estaba agregado
      setCart(
        cart.map((c) =>
          c.id === updated.id
            ? { ...c, nombre: updated.nombre, codigo: updated.codigo, precio: updated.precio }
            : c
        )
      );
      setEditingProduct(null);
      setProdErrors({});
      notify('Producto actualizado desde el punto de venta.', 'success');
      await onRefresh();
    });
  };

  // Registrar faltante rápido desde Ventas
  const handleSaveQuickFaltante = () => {
    const validation = validateFaltante(faltanteModal);
    if (!validation.isValid) {
      setFaltanteErrors(validation.errors);
      return notify('Revisa los campos del faltante.', 'warning');
    }
    runWithLoading(async () => {
      await faltantesApi.create(validation.cleanedData);
      setFaltanteModal(null);
      setFaltanteErrors({});
      notify('Faltante registrado para futuras compras.', 'success');
      await onRefresh();
    });
  };

  // Crear cliente rápido desde el modal de cobro
  const handleSaveQuickClient = () => {
    const validation = validateEntidad('cliente', quickClientForm);
    if (!validation.isValid) {
      setQuickClientErrors(validation.errors);
      return;
    }
    runWithLoading(async () => {
      const created = await clientesApi.create(validation.cleanedData);
      await onRefresh();
      setClient(String(created.id));
      setQuickClientModal(false);
      setQuickClientForm({ nombre: '', telefono: '', correo: '' });
      setQuickClientErrors({});
      notify(`Cliente "${created.nombre}" creado y seleccionado.`, 'success');
    });
  };

  const allCategories = ['Todas', ...categorias.map((c) => c.nombre)];

  return (
    <main className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">PUNTO DE VENTA</p>
          <h2>{activeOpenSaleId ? `Retomando venta ${activeOpenSaleId}` : 'Nueva venta'}</h2>
          <p className="lead">
            Selecciona los productos del catálogo, aplica descuentos, guarda ventas abiertas o registra el cobro.
          </p>
        </div>
        <div className="heading-actions">
          <button
            className="btn btn-outline"
            onClick={() => {
              setFaltanteErrors({});
              setFaltanteModal({
                productoId: '',
                descripcion: '',
                cantidadSolicitada: 1,
                tipo: 'inexistente',
                proveedorId: '',
              });
            }}
          >
            Registrar faltante
          </button>
          {cart.length > 0 && (
            <button className="btn btn-outline" onClick={resetCurrentSaleDraft}>
              {activeOpenSaleId ? 'Liberar venta retomada' : 'Vaciar pedido'}
            </button>
          )}
        </div>
      </div>

      {openSales.length > 0 && (
        <section className="open-sales-strip">
          <h3>Ventas abiertas guardadas ({openSales.length})</h3>
          <div className="open-sales-grid">
            {openSales.map((os) => (
              <div className="open-sale-card" key={os.id}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{os.id}</strong>
                    <span className="status abierta">ABIERTA</span>
                  </div>
                  <div style={{ fontSize: 13.5, color: '#405468', marginTop: 4 }}>
                    Cliente: <strong>{os.clienteNombre || 'Público general'}</strong>
                  </div>
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                    {(os.items || []).reduce((s, i) => s + i.cantidad, 0)} uds · Total:{' '}
                    <strong>{money(os.total)}</strong>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => resumeOpenSale(os)}
                  >
                    Retomar venta
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => setConfirmDiscardOpen(os)}
                  >
                    Descartar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="sale-layout">
        <section className="panel catalog-panel">
          <div className="search-row">
            <label htmlFor="product-search">
              Buscar producto <span className="kbd-hint">/</span>
            </label>
            <input
              ref={searchInputRef}
              id="product-search"
              className="big-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Escribe el nombre o código (ej. P001)..."
            />
          </div>

          <div className="category-chips" role="tablist" aria-label="Filtrar por categoría">
            {allCategories.map((cat) => (
              <button
                key={cat}
                className={`chip ${selectedCat === cat ? 'active' : ''}`}
                onClick={() => setSelectedCat(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="product-grid">
            {filtered.map((p) => {
              const stockClass = p.stock <= 0 ? 'out' : p.stock <= 5 ? 'low' : 'ok';
              const stockLabel =
                p.stock <= 0 ? 'Agotado' : p.stock <= 5 ? `Quedan ${p.stock}` : `Stock: ${p.stock}`;
              return (
                <article className="product-card" key={p.id}>
                  <div className="product-image">
                    {p.imagen ? (
                      <img src={p.imagen} alt={p.nombre} />
                    ) : (
                      <span>{p.nombre.slice(0, 1)}</span>
                    )}
                  </div>
                  <div className="product-info">
                    <h3>{p.nombre}</h3>
                    <p>
                      Código: {p.codigo} · {p.categoria}
                    </p>
                    <div className="product-meta-row">
                      <strong>{money(p.precio)}</strong>
                      <span className={`stock-badge ${stockClass}`}>{stockLabel}</span>
                    </div>
                  </div>
                  <div className="product-card-actions">
                    <button
                      className={`btn btn-add ${addedId === p.id ? 'added' : ''}`}
                      disabled={p.stock <= 0}
                      onClick={() => add(p)}
                    >
                      {addedId === p.id
                        ? 'Agregado al pedido'
                        : p.stock <= 0
                        ? 'Sin existencias'
                        : 'Agregar al pedido'}
                    </button>
                    <div className="product-sub-actions">
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => {
                          setProdErrors({});
                          setEditingProduct(p);
                        }}
                      >
                        Editar producto
                      </button>
                      {p.stock <= 5 && (
                        <button
                          type="button"
                          className="link-button"
                          style={{ color: '#b86a00' }}
                          onClick={() => {
                            setFaltanteErrors({});
                            setFaltanteModal({
                              productoId: p.id,
                              descripcion: p.nombre,
                              cantidadSolicitada: 1,
                              tipo: 'agotado',
                              proveedorId: '',
                            });
                          }}
                        >
                          Reportar faltante
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="panel cart-panel">
          {activeOpenSaleId && (
            <div className="open-sale-banner">
              <span>
                Editando venta abierta <strong>{activeOpenSaleId}</strong>
              </span>
              <button className="link-button" onClick={resetCurrentSaleDraft}>
                Nueva venta limpia
              </button>
            </div>
          )}

          <div className="panel-title">
            <div>
              <p className="eyebrow">PEDIDO EN CURSO</p>
              <h2>Venta actual</h2>
            </div>
            <span className={`count-pill ${cartBump ? 'bump' : ''}`}>
              {cart.reduce((s, i) => s + i.cantidad, 0)} unidades
            </span>
          </div>

          {!cart.length ? (
            <div className="empty-state">
              <h3>No hay productos en el pedido</h3>
              <p>Usa el buscador o haz clic en "Agregar al pedido" en cualquier producto.</p>
            </div>
          ) : (
            <div className="cart-list">
              {cart.map((i) => (
                <div className="cart-row" key={i.id}>
                  <div className="cart-main">
                    <strong>{i.nombre}</strong>
                    <span>
                      {i.cantidad} × {money(i.precio)} ={' '}
                      <strong>{money(i.cantidad * i.precio)}</strong>
                    </span>
                  </div>
                  <div className="cart-actions">
                    <button
                      className="qty-btn"
                      onClick={() => changeQty(i.id, -1)}
                      aria-label="Disminuir cantidad"
                    >
                      −
                    </button>
                    <span>{i.cantidad}</span>
                    <button
                      className="qty-btn"
                      onClick={() => changeQty(i.id, 1)}
                      aria-label="Aumentar cantidad"
                    >
                      +
                    </button>
                    <button
                      className="remove-btn"
                      onClick={() => setCart(cart.filter((x) => x.id !== i.id))}
                    >
                      Quitar
                    </button>
                  </div>
                  <div className="price-edit">
                    {priceEdit === i.id ? (
                      <input
                        autoFocus
                        type="number"
                        min="100"
                        value={i.precio}
                        onChange={(e) =>
                          setCart(
                            cart.map((x) =>
                              x.id === i.id
                                ? { ...x, precio: Math.max(0, Number(e.target.value)) }
                                : x
                            )
                          )
                        }
                        onBlur={() => setPriceEdit(null)}
                      />
                    ) : (
                      <button className="link-button" onClick={() => setPriceEdit(i.id)}>
                        Cambiar precio de venta ({money(i.precio)})
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {cart.length > 0 && (
            <div className="totals">
              <Field label="Descuento aplicable (máximo 1 por venta)">
                <select
                  className="big-input"
                  style={{ minHeight: 40, padding: '6px 10px', fontSize: 14 }}
                  value={discountId}
                  onChange={(e) => setDiscountId(e.target.value)}
                >
                  <option value="">Sin descuento</option>
                  {descuentos.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre} ({d.tipo === 'porcentual' ? `${d.valor}%` : money(d.valor)})
                    </option>
                  ))}
                </select>
              </Field>

              <div>
                <span>Subtotal</span>
                <strong>{money(subtotal)}</strong>
              </div>
              {descuentoMonto > 0 && (
                <div className="discount-line">
                  <span>Descuento ({selectedDiscount?.nombre})</span>
                  <strong>- {money(descuentoMonto)}</strong>
                </div>
              )}
              <div>
                <span>IVA (19%)</span>
                <strong>{money(iva)}</strong>
              </div>
              <div className="total-line">
                <span>Total</span>
                <strong>{money(total)}</strong>
              </div>

              <div className="cart-btn-group">
                <button className="btn btn-outline" onClick={saveOpenSale}>
                  {activeOpenSaleId ? 'Actualizar abierta' : 'Guardar abierta'}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setFormErrors({});
                    setPaymentOpen(true);
                  }}
                >
                  Cobrar venta
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>

      {paymentOpen && (
        <Modal title="Finalizar y cobrar venta" onClose={() => setPaymentOpen(false)}>
          <div className="pay-total">
            Total a cobrar <strong>{money(total)}</strong>
          </div>

          <Field
            label={
              method === 'Debe'
                ? 'Cliente (Obligatorio para método Debe)'
                : 'Cliente (Opcional en Efectivo/Nequi)'
            }
            error={formErrors.clienteId?.[0]}
          >
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                className={`big-input ${formErrors.clienteId ? 'input-error' : ''}`}
                value={client}
                onChange={(e) => setClient(e.target.value)}
              >
                <option value="">Público general</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setQuickClientErrors({});
                  setQuickClientModal(true);
                }}
              >
                Nuevo cliente
              </button>
            </div>
          </Field>

          <Field label="Descuento" error={formErrors.descuentoId?.[0]}>
            <select
              className={`big-input ${formErrors.descuentoId ? 'input-error' : ''}`}
              value={discountId}
              onChange={(e) => setDiscountId(e.target.value)}
            >
              <option value="">Sin descuento</option>
              {descuentos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre} ({d.tipo === 'porcentual' ? `${d.valor}%` : money(d.valor)})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Método de pago" error={formErrors.metodoPago?.[0]}>
            <div className="choice-grid">
              {['Efectivo', 'Nequi', 'Debe'].map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`choice ${method === m ? 'selected' : ''}`}
                  onClick={() => setMethod(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          </Field>

          {method === 'Efectivo' && (
            <Field label="Dinero recibido" error={formErrors.recibido?.[0]}>
              <input
                className={`big-input ${formErrors.recibido ? 'input-error' : ''}`}
                type="number"
                value={received}
                onChange={(e) => setReceived(e.target.value)}
                placeholder={`Mínimo ${total}`}
              />
              <div className="quick-cash-row">
                {[total, 10000, 20000, 50000, 100000].map((val, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="cash-chip"
                    onClick={() => setReceived(String(val))}
                  >
                    {idx === 0 ? `Exacto (${money(val)})` : money(val)}
                  </button>
                ))}
              </div>
              <div className="change-box">
                Cambio a devolver: <strong>{money(change)}</strong>
              </div>
            </Field>
          )}

          <div className="modal-actions">
            <button className="btn btn-outline" onClick={() => setPaymentOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-outline" onClick={() => { setPaymentOpen(false); saveOpenSale(); }}>
              Guardar como abierta
            </button>
            <button className="btn btn-primary" onClick={closeSale}>
              Confirmar y cerrar venta
            </button>
          </div>
        </Modal>
      )}

      {editingProduct && (
        <ProductModal
          initial={editingProduct}
          categorias={categorias}
          errors={prodErrors}
          onClose={() => setEditingProduct(null)}
          onSave={handleSaveProductFromSale}
        />
      )}

      {faltanteModal && (
        <Modal
          title="Registrar producto faltante desde caja"
          onClose={() => setFaltanteModal(null)}
        >
          <Field label="Tipo de faltante">
            <div className="choice-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <button
                type="button"
                className={`choice ${faltanteModal.tipo === 'agotado' ? 'selected' : ''}`}
                onClick={() => setFaltanteModal({ ...faltanteModal, tipo: 'agotado' })}
              >
                Producto agotado
              </button>
              <button
                type="button"
                className={`choice ${faltanteModal.tipo === 'inexistente' ? 'selected' : ''}`}
                onClick={() =>
                  setFaltanteModal({ ...faltanteModal, tipo: 'inexistente', productoId: '' })
                }
              >
                Producto inexistente
              </button>
            </div>
          </Field>

          <Field
            label="Nombre o descripción del producto"
            error={faltanteErrors.descripcion?.[0]}
          >
            <input
              className={`big-input ${faltanteErrors.descripcion ? 'input-error' : ''}`}
              value={faltanteModal.descripcion}
              onChange={(e) =>
                setFaltanteModal({ ...faltanteModal, descripcion: e.target.value })
              }
              placeholder="Ej. Marcador permanente punta fina"
            />
          </Field>

          <div className="form-grid">
            <Field label="Cantidad solicitada" error={faltanteErrors.cantidadSolicitada?.[0]}>
              <input
                className="big-input"
                type="number"
                min="1"
                value={faltanteModal.cantidadSolicitada}
                onChange={(e) =>
                  setFaltanteModal({ ...faltanteModal, cantidadSolicitada: e.target.value })
                }
              />
            </Field>
            <Field label="Proveedor sugerido (opcional)">
              <select
                className="big-input"
                value={faltanteModal.proveedorId}
                onChange={(e) =>
                  setFaltanteModal({ ...faltanteModal, proveedorId: e.target.value })
                }
              >
                <option value="">Sin proveedor</option>
                {proveedores.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.nombre}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="modal-actions">
            <button className="btn btn-outline" onClick={() => setFaltanteModal(null)}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleSaveQuickFaltante}>
              Guardar faltante
            </button>
          </div>
        </Modal>
      )}

      {quickClientModal && (
        <Modal title="Nuevo cliente" onClose={() => setQuickClientModal(false)}>
          <Field label="Nombre completo" error={quickClientErrors.nombre?.[0]}>
            <input
              className={`big-input ${quickClientErrors.nombre ? 'input-error' : ''}`}
              value={quickClientForm.nombre}
              onChange={(e) =>
                setQuickClientForm({ ...quickClientForm, nombre: e.target.value })
              }
              placeholder="Ej. Ana María Rodríguez"
            />
          </Field>
          <Field label="Teléfono" error={quickClientErrors.telefono?.[0]}>
            <input
              className="big-input"
              value={quickClientForm.telefono}
              onChange={(e) =>
                setQuickClientForm({ ...quickClientForm, telefono: e.target.value })
              }
              placeholder="Ej. 3001234567"
            />
          </Field>
          <Field label="Correo electrónico" error={quickClientErrors.correo?.[0]}>
            <input
              className="big-input"
              type="email"
              value={quickClientForm.correo}
              onChange={(e) =>
                setQuickClientForm({ ...quickClientForm, correo: e.target.value })
              }
              placeholder="cliente@correo.com"
            />
          </Field>
          <div className="modal-actions">
            <button className="btn btn-outline" onClick={() => setQuickClientModal(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleSaveQuickClient}>
              Guardar cliente
            </button>
          </div>
        </Modal>
      )}

      {completedInvoice && (
        <FacturaModal
          venta={completedInvoice}
          onClose={() => setCompletedInvoice(null)}
        />
      )}

      {confirmDiscardOpen && (
        <ConfirmModal
          title="Descartar venta abierta"
          message={`¿Confirmas descartar la venta abierta ${confirmDiscardOpen.id}?`}
          confirmLabel="Descartar venta abierta"
          danger
          onCancel={() => setConfirmDiscardOpen(null)}
          onConfirm={discardOpenSale}
        />
      )}
    </main>
  );
}

function Productos({ user, productos, categorias, onRefresh, notify, runWithLoading }) {
  const isAdmin = user.rol === 'ADMINISTRADOR';
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [editing, setEditing] = useState(null);
  const [errors, setErrors] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);

  const list = productos.filter((p) => {
    const matchText =
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      String(p.codigo).toLowerCase().includes(search.toLowerCase());
    const matchCat = !catFilter || p.categoria === catFilter;
    return matchText && matchCat;
  });

  const openEditor = (prod) => {
    setErrors({});
    setEditing(prod);
  };

  const save = (form) => {
    const isEdit = Boolean(editing?.id);
    const validation = validateProducto(form);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return notify('Revisa los campos marcados en el formulario.', 'warning');
    }

    runWithLoading(async () => {
      if (isEdit) {
        await productosApi.update(editing.id, validation.cleanedData);
        notify('Producto actualizado correctamente.', 'success');
      } else {
        await productosApi.create(validation.cleanedData);
        notify('Producto creado en el catálogo.', 'success');
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
      await productosApi.remove(target.id);
      notify(`Producto "${target.nombre}" eliminado.`, 'success');
      await onRefresh();
    });
  };

  return (
    <main className="page">
      <PageHeader
        title="Catálogo de productos e inventario"
        eyebrow="INVENTARIO"
        text="Consulta las existencias actuales, precios de venta, costos y categorías asociadas."
        action={isAdmin ? 'Nuevo producto' : null}
        onAction={isAdmin ? () => openEditor({}) : null}
      />
      <div className="toolbar">
        <input
          className="big-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o código SKU..."
        />
        <select
          className="big-input"
          style={{ maxWidth: 260 }}
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.nombre}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>
      <section className="panel table-panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Costo compra</th>
                <th>Precio venta</th>
                <th>Existencias</th>
                {isAdmin && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.nombre}</strong>
                    <small>Código: {p.codigo}</small>
                  </td>
                  <td>{p.categoria}</td>
                  <td>{money(p.costo)}</td>
                  <td>
                    <strong>{money(p.precio)}</strong>
                  </td>
                  <td>
                    <span
                      className={`stock-badge ${
                        p.stock <= 0 ? 'out' : p.stock <= 5 ? 'low' : 'ok'
                      }`}
                    >
                      {p.stock} uds
                    </span>
                  </td>
                  {isAdmin && (
                    <td>
                      <button className="table-btn edit" onClick={() => openEditor(p)}>
                        Editar
                      </button>
                      <button
                        className="table-btn danger"
                        onClick={() => setConfirmDelete(p)}
                      >
                        Eliminar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {editing !== null && (
        <ProductModal
          initial={editing}
          categorias={categorias}
          errors={errors}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
      {confirmDelete && (
        <ConfirmModal
          title="Eliminar producto"
          message={`¿Confirmas eliminar el producto "${confirmDelete.nombre}" (${confirmDelete.codigo})?`}
          confirmLabel="Eliminar producto"
          danger
          onCancel={() => setConfirmDelete(null)}
          onConfirm={executeDelete}
        />
      )}
    </main>
  );
}

function Compras({ productos, proveedores, compras, onRefresh, notify, runWithLoading }) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState('');
  const [items, setItems] = useState([]);
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState(1);
  const [cost, setCost] = useState('');
  const [errors, setErrors] = useState({});
  const [detailCompra, setDetailCompra] = useState(null);

  const add = () => {
    const p = productos.find((x) => String(x.id) === String(productId));
    if (!p) return notify('Selecciona un producto de la lista.', 'warning');
    if (Number(qty) <= 0) return notify('La cantidad debe ser mayor a 0.', 'warning');
    const unitCost = Number(cost !== '' ? cost : p.costo);
    if (unitCost < 0) return notify('El costo de compra no puede ser negativo.', 'warning');

    const existing = items.find((i) => String(i.productoId) === String(p.id));
    if (existing) {
      setItems(
        items.map((i) =>
          String(i.productoId) === String(p.id)
            ? { ...i, cantidad: i.cantidad + Number(qty), costo: unitCost }
            : i
        )
      );
    } else {
      setItems([
        ...items,
        {
          productoId: p.id,
          codigo: p.codigo,
          nombre: p.nombre,
          cantidad: Number(qty),
          costo: unitCost,
        },
      ]);
    }
    setProductId('');
    setQty(1);
    setCost('');
  };

  const updateItemQty = (pid, nextQty) => {
    const q = Math.max(1, Number(nextQty) || 1);
    setItems(items.map((i) => (String(i.productoId) === String(pid) ? { ...i, cantidad: q } : i)));
  };

  const updateItemCost = (pid, nextCost) => {
    const c = Math.max(0, Number(nextCost) || 0);
    setItems(items.map((i) => (String(i.productoId) === String(pid) ? { ...i, costo: c } : i)));
  };

  const removeItem = (pid) => {
    setItems(items.filter((i) => String(i.productoId) !== String(pid)));
  };

  const total = items.reduce((s, i) => s + i.cantidad * i.costo, 0);

  const save = () => {
    const payload = { proveedorId: provider, items };
    const validation = validateCompra(payload);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return notify('Selecciona un proveedor y agrega al menos un producto.', 'warning');
    }

    runWithLoading(async () => {
      const created = await comprasApi.create(payload);
      setOpen(false);
      setItems([]);
      setProvider('');
      setErrors({});
      notify(
        `Compra ${created.id} registrada. El inventario se incrementó automáticamente.`,
        'success'
      );
      await onRefresh();
    });
  };

  return (
    <main className="page">
      <PageHeader
        title="Compras a proveedores"
        eyebrow="ENTRADA DE MERCANCÍA"
        text="Registra las facturas de compra a proveedores para incrementar automáticamente las existencias."
        action="Registrar compra"
        onAction={() => {
          setErrors({});
          setOpen(true);
        }}
      />
      <section className="panel table-panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Compra</th>
                <th>Fecha</th>
                <th>Proveedor</th>
                <th>Registrado por</th>
                <th>Total</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {compras.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: 28, color: '#64748b' }}>
                    No hay compras registradas todavía.
                  </td>
                </tr>
              ) : (
                compras.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.id}</strong>
                    </td>
                    <td>{new Date(c.fecha).toLocaleString('es-CO')}</td>
                    <td>{c.proveedor}</td>
                    <td>{c.usuarioNombre || 'Administrador'}</td>
                    <td>
                      <strong>{money(c.total)}</strong>
                    </td>
                    <td>
                      <button className="table-btn" onClick={() => setDetailCompra(c)}>
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {open && (
        <Modal title="Registrar compra a proveedor" onClose={() => setOpen(false)} large>
          <Field label="Proveedor" error={errors.proveedorId?.[0]}>
            <select
              className={`big-input ${errors.proveedorId ? 'input-error' : ''}`}
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              <option value="">Selecciona un proveedor</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Agregar productos a la compra" error={errors.items?.[0]}>
            <div className="purchase-add">
              <select
                className="big-input"
                value={productId}
                onChange={(e) => {
                  const pid = e.target.value;
                  setProductId(pid);
                  const prod = productos.find((x) => String(x.id) === String(pid));
                  if (prod) setCost(String(prod.costo));
                }}
              >
                <option value="">Selecciona producto...</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.codigo} - {p.nombre} (Stock actual: {p.stock})
                  </option>
                ))}
              </select>
              <input
                className="big-input"
                type="number"
                min="1"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="Cantidad"
              />
              <input
                className="big-input"
                type="number"
                min="0"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="Costo compra"
              />
              <button type="button" className="btn btn-outline" onClick={add}>
                Añadir línea
              </button>
            </div>
          </Field>

          {items.length > 0 && (
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Costo unitario</th>
                    <th>Subtotal</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.productoId}>
                      <td>
                        <strong>{i.nombre}</strong>
                      </td>
                      <td>
                        <input
                          className="big-input"
                          style={{ width: 90, minHeight: 36, padding: '4px 8px' }}
                          type="number"
                          min="1"
                          value={i.cantidad}
                          onChange={(e) => updateItemQty(i.productoId, e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="big-input"
                          style={{ width: 120, minHeight: 36, padding: '4px 8px' }}
                          type="number"
                          min="0"
                          value={i.costo}
                          onChange={(e) => updateItemCost(i.productoId, e.target.value)}
                        />
                      </td>
                      <td>
                        <strong>{money(i.cantidad * i.costo)}</strong>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="table-btn danger"
                          onClick={() => removeItem(i.productoId)}
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="pay-total" style={{ marginTop: 16 }}>
            Total compra <strong>{money(total)}</strong>
          </div>
          <div className="modal-actions">
            <button className="btn btn-outline" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={save}>
              Guardar compra y sumar inventario
            </button>
          </div>
        </Modal>
      )}

      {detailCompra && (
        <Modal
          title={`Detalle de compra ${detailCompra.id}`}
          onClose={() => setDetailCompra(null)}
        >
          <p>
            <strong>Proveedor:</strong> {detailCompra.proveedor}
          </p>
          <p>
            <strong>Fecha:</strong> {new Date(detailCompra.fecha).toLocaleString('es-CO')}
          </p>
          <p>
            <strong>Registrado por:</strong> {detailCompra.usuarioNombre || 'Administrador'}
          </p>
          <div className="mini-list">
            {(detailCompra.items || []).map((it, idx) => (
              <div key={idx}>
                <span>
                  {it.nombre} × {it.cantidad} uds ({money(it.costo)} c/u)
                </span>
                <strong>{money(it.cantidad * it.costo)}</strong>
              </div>
            ))}
          </div>
          <div className="pay-total" style={{ marginTop: 16 }}>
            Total pagado <strong>{money(detailCompra.total)}</strong>
          </div>
        </Modal>
      )}
    </main>
  );
}

function Entidades({
  titulo,
  tipo,
  items,
  apiService,
  canManage,
  onRefresh,
  notify,
  runWithLoading,
}) {
  const [search, setSearch] = useState('');
  const [edit, setEdit] = useState(null);
  const [errors, setErrors] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);

  const filtered = items.filter((i) =>
    i.nombre.toLowerCase().includes(search.toLowerCase())
  );

  const save = (form) => {
    const isEdit = Boolean(edit?.id);
    const validation = validateEntidad(tipo, form);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return notify('Revisa los datos del formulario.', 'warning');
    }

    runWithLoading(async () => {
      if (isEdit) {
        await apiService.update(edit.id, validation.cleanedData);
        notify('Registro actualizado correctamente.', 'success');
      } else {
        await apiService.create(validation.cleanedData);
        notify('Registro creado correctamente.', 'success');
      }
      setEdit(null);
      setErrors({});
      await onRefresh();
    });
  };

  const executeDelete = () => {
    if (!confirmDelete) return;
    const target = confirmDelete;
    setConfirmDelete(null);
    runWithLoading(async () => {
      await apiService.remove(target.id);
      notify(`"${target.nombre}" eliminado correctamente.`, 'success');
      await onRefresh();
    });
  };

  return (
    <main className="page">
      <PageHeader
        title={titulo}
        eyebrow="DIRECTORIO"
        text={`Administra el listado de ${titulo.toLowerCase()} de Papel y Luna.`}
        action={canManage ? `Nuevo ${tipo}` : null}
        onAction={
          canManage
            ? () => {
                setErrors({});
                setEdit({});
              }
            : null
        }
      />
      <div className="toolbar">
        <input
          className="big-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Buscar ${tipo} por nombre...`}
        />
      </div>
      <section className="panel table-panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                {tipo !== 'categoria' && (
                  <>
                    <th>Teléfono</th>
                    <th>Correo electrónico</th>
                  </>
                )}
                {canManage && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.id}>
                  <td>
                    <strong>{i.nombre}</strong>
                  </td>
                  {tipo !== 'categoria' && (
                    <>
                      <td>{i.telefono || '—'}</td>
                      <td>{i.correo || '—'}</td>
                    </>
                  )}
                  {canManage && (
                    <td>
                      <button
                        className="table-btn edit"
                        onClick={() => {
                          setErrors({});
                          setEdit(i);
                        }}
                      >
                        Editar
                      </button>
                      <button
                        className="table-btn danger"
                        onClick={() => setConfirmDelete(i)}
                      >
                        Eliminar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {edit !== null && (
        <Modal
          title={edit.id ? `Editar ${tipo}` : `Nuevo ${tipo}`}
          onClose={() => setEdit(null)}
        >
          <Field label="Nombre" error={errors.nombre?.[0]}>
            <input
              className={`big-input ${errors.nombre ? 'input-error' : ''}`}
              value={edit.nombre || ''}
              onChange={(e) => setEdit({ ...edit, nombre: e.target.value })}
            />
          </Field>
          {tipo !== 'categoria' && (
            <>
              <Field label="Teléfono" error={errors.telefono?.[0]}>
                <input
                  className={`big-input ${errors.telefono ? 'input-error' : ''}`}
                  value={edit.telefono || ''}
                  onChange={(e) => setEdit({ ...edit, telefono: e.target.value })}
                  placeholder="Ej. 3001234567"
                />
              </Field>
              <Field label="Correo electrónico" error={errors.correo?.[0]}>
                <input
                  className={`big-input ${errors.correo ? 'input-error' : ''}`}
                  type="email"
                  value={edit.correo || ''}
                  onChange={(e) => setEdit({ ...edit, correo: e.target.value })}
                  placeholder="usuario@ejemplo.com"
                />
              </Field>
            </>
          )}
          <div className="modal-actions">
            <button className="btn btn-outline" onClick={() => setEdit(null)}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={() => save(edit)}>
              Guardar
            </button>
          </div>
        </Modal>
      )}
      {confirmDelete && (
        <ConfirmModal
          title={`Eliminar ${tipo}`}
          message={`¿Confirmas eliminar "${confirmDelete.nombre}"? Si tiene registros asociados, el sistema impedirá el borrado para proteger la integridad de los datos.`}
          confirmLabel="Eliminar"
          danger
          onCancel={() => setConfirmDelete(null)}
          onConfirm={executeDelete}
        />
      )}
    </main>
  );
}

function Historial({
  user,
  ventas,
  productos,
  clientes,
  descuentos,
  onResumeOpenSale,
  onRefresh,
  notify,
  runWithLoading,
}) {
  const navigate = useNavigate();
  const isAdmin = user.rol === 'ADMINISTRADOR';

  const [filtroEstado, setFiltroEstado] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [selectedSale, setSelectedSale] = useState(null);
  const [corrigiendoSale, setCorrigiendoSale] = useState(null);
  const [reembolsandoSale, setReembolsandoSale] = useState(null);

  const ventasFiltradas = ventas.filter((v) => {
    if (filtroEstado === 'abierta' && v.estado !== 'abierta') return false;
    if (filtroEstado === 'cerrada' && v.estado === 'abierta') return false;
    if (filtroEstado === 'corregida' && !v.fueCorregida) return false;
    if (filtroEstado === 'reembolso' && !v.tieneReembolsos) return false;
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      const matchId = String(v.id).toLowerCase().includes(q);
      const matchCli = String(v.clienteNombre || '').toLowerCase().includes(q);
      return matchId || matchCli;
    }
    return true;
  });

  const handleConfirmCorreccion = (payload) => {
    const target = corrigiendoSale;
    runWithLoading(async () => {
      const updated = await ventasApi.corregir(target.id, payload);
      setCorrigiendoSale(null);
      notify(
        `Factura ${updated.id} corregida exitosamente. El inventario fue ajustado.`,
        'success'
      );
      await onRefresh();
      setSelectedSale(updated);
    });
  };

  const handleConfirmReembolso = (payload) => {
    const target = reembolsandoSale;
    runWithLoading(async () => {
      const res = await ventasApi.reembolsar(target.id, payload);
      setReembolsandoSale(null);
      notify(
        `Reembolso ${res.reembolso.codigo} registrado por ${money(res.reembolso.totalReembolsado)}.`,
        'success'
      );
      await onRefresh();
      setSelectedSale(res.venta);
    });
  };

  return (
    <main className="page">
      <PageHeader
        title="Historial de ventas y Facturación"
        eyebrow="FACTURACIÓN Y OPERACIONES"
        text={
          isAdmin
            ? 'Consulta facturas, imprímelas o expórtalas a PDF, corrige ventas cerradas y gestiona reembolsos.'
            : 'Consulta las ventas cerradas y abiertas, retoma pedidos o imprime facturas.'
        }
      />

      <div className="toolbar">
        <input
          className="big-input"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por número de factura (ej. V-1) o cliente..."
        />
        <select
          className="big-input"
          style={{ maxWidth: 260 }}
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="cerrada">Ventas cerradas y corregidas</option>
          <option value="abierta">Ventas abiertas</option>
          <option value="corregida">Solo ventas corregidas</option>
          <option value="reembolso">Con reembolsos</option>
        </select>
      </div>

      <section className="panel table-panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Factura</th>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Estado</th>
                <th>Método</th>
                <th>Total</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ventasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: 28, color: '#64748b' }}>
                    No se encontraron ventas con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                ventasFiltradas.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <strong>{v.id}</strong>
                      <small>Cajero: {v.usuarioNombre || 'Cajero'}</small>
                    </td>
                    <td>{new Date(v.fecha).toLocaleString('es-CO')}</td>
                    <td>{v.clienteNombre || 'Público general'}</td>
                    <td>
                      <span className={`status ${v.estado}`}>
                        {v.estado.toUpperCase()}
                      </span>
                      {v.tieneReembolsos && (
                        <span className="status reembolso">
                          REEMBOLSO {(v.estadoReembolso || 'PARCIAL').toUpperCase()} (-{money(v.totalReembolsado)})
                        </span>
                      )}
                      {v.fueCorregida && (
                        <small style={{ color: '#b45309' }}>
                          Corregida por {v.corregidaPor || 'Admin'}{' '}
                          {v.fechaCorreccion ? `(${new Date(v.fechaCorreccion).toLocaleDateString('es-CO')})` : ''}
                        </small>
                      )}
                    </td>
                    <td>{v.metodoPago || '—'}</td>
                    <td>
                      <strong>{money(v.total)}</strong>
                      {v.descuentoMonto > 0 && (
                        <small style={{ color: '#168a59' }}>
                          Desc: -{money(v.descuentoMonto)}
                        </small>
                      )}
                    </td>
                    <td>
                      <button
                        className="table-btn"
                        onClick={() => setSelectedSale(v)}
                      >
                        Factura / PDF
                      </button>
                      {v.estado === 'abierta' && (
                        <button
                          className="table-btn edit"
                          onClick={() => onResumeOpenSale(v, navigate)}
                        >
                          Retomar
                        </button>
                      )}
                      {isAdmin && v.estado !== 'abierta' && (
                        <>
                          <button
                            className="table-btn warning"
                            onClick={() => setCorrigiendoSale(v)}
                          >
                            Corregir
                          </button>
                          <button
                            className="table-btn edit"
                            onClick={() => setReembolsandoSale(v)}
                          >
                            Reembolsar
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedSale && (
        <FacturaModal
          venta={selectedSale}
          onClose={() => setSelectedSale(null)}
        />
      )}

      {corrigiendoSale && (
        <CorregirVentaModal
          venta={corrigiendoSale}
          productos={productos}
          clientes={clientes}
          descuentos={descuentos}
          onClose={() => setCorrigiendoSale(null)}
          onConfirm={handleConfirmCorreccion}
        />
      )}

      {reembolsandoSale && (
        <ReembolsarVentaModal
          venta={reembolsandoSale}
          onClose={() => setReembolsandoSale(null)}
          onConfirm={handleConfirmReembolso}
        />
      )}
    </main>
  );
}

createRoot(document.getElementById('root')).render(
  <HashRouter>
    <App />
  </HashRouter>
);
