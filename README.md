# Papel y Luna POS — Sistema de Punto de Venta e Inventario (MVP 3)

## 1. Descripción del Proyecto

**Papel y Luna POS** es una aplicación web Full Stack de Punto de Venta (POS) y gestión de inventario diseñada para la papelería y tienda de variedades **Papel y Luna**. El sistema permite administrar de extremo a extremo el catálogo de productos, categorías, clientes, proveedores, ventas en caja, ventas abiertas, facturación (con impresión y exportación a PDF), corrección administrativa de ventas cerradas, reembolsos parciales y totales, catálogo de descuentos, control de productos faltantes y reportes gerenciales por rango de fechas.

La interfaz fue diseñada priorizando la claridad, accesibilidad y facilidad de uso para usuarios con poca experiencia tecnológica, empleando botones grandes con etiquetas explícitas, confirmaciones en operaciones críticas, atajos de teclado y diseño adaptable (*responsive*).

## 2. Arquitectura del Sistema

El proyecto implementa una arquitectura desacoplada Cliente-Servidor:

* **Frontend (React + Vite):** Responsable de la interfaz de usuario, navegación por rutas protegidas, validación preventiva de formularios, manejo de estado de la sesión y del carrito activo, e invocación de la API mediante una capa centralizada de servicios HTTP (`src/services/api.js`).
* **Backend (Django + API REST):** Responsable de la lógica de negocio transaccional (`atomic`), autenticación JWT Bearer con access y refresh tokens, control estricto de permisos por rol (`ADMINISTRADOR` y `CAJERO`), validaciones de integridad y exposición de endpoints REST en formato JSON.
* **Base de Datos Relacional (PostgreSQL):** Almacena todas las entidades y tablas de detalle (`DetalleVenta`, `DetalleCompra`, `DetalleReembolso`) con integridad referencial (`PROTECT` / `CASCADE` / `SET_NULL`). Incluye respaldo automático a SQLite en entorno local si aún no se han definido las variables de conexión a PostgreSQL.

## 3. Tecnologías Utilizadas

* **Frontend:** React 19, React Router DOM 7, JavaScript (ES6+), CSS3 (Variables CSS y Media Queries para diseño responsive e impresión de facturas), Vite 7.
* **Backend:** Python 3, Django 5.2, Django REST Framework, Gunicorn, WhiteNoise.
* **Base de Datos:** PostgreSQL (`psycopg` / `dj-database-url`).

## 4. Estructura de Carpetas

```text
Papel_y_Luna_Frontend_React/
├── index.html                      # Punto de entrada HTML del frontend
├── package.json                    # Dependencias y scripts de React + Vite
├── vercel.json                     # Configuración de despliegue para Vercel
├── render.yaml                     # Blueprint de despliegue para Render + PostgreSQL
├── .env.example                    # Plantilla de variables de entorno del frontend
├── public/
│   └── Imagenes/                   # Catálogo de imágenes de productos
├── src/
│   ├── main.jsx                    # Aplicación principal, rutas protegidas, Login, Ventas, Productos, Compras, Historial
│   ├── components/
│   │   └── CommonUI.jsx            # Componentes reutilizables (Modal, ConfirmModal, FacturaModal, ProductModal, Field)
│   ├── pages/
│   │   ├── OperacionesModal.jsx    # Modales de Corrección de Ventas Cerradas y Reembolsos
│   │   └── AdminModules.jsx        # Páginas de Descuentos, Faltantes y Reportes Administrativos
│   ├── services/
│   │   └── api.js                  # Capa centralizada de comunicación HTTP con Django
│   ├── validators/
│   │   └── posValidators.js        # Validaciones de formularios en el cliente
│   └── styles/
│       └── global.css              # Identidad visual de Papel y Luna, estilos responsive y de impresión
└── backend/
    ├── manage.py                   # Utilidad de administración de Django
    ├── init_db.py                  # Script directo para migrar e inicializar usuarios y datos semilla
    ├── build.sh                    # Script de construcción para Render
    ├── requirements.txt            # Dependencias de Python / Django / PostgreSQL
    ├── .env.example                # Plantilla de variables de entorno del backend
    ├── config/
    │   ├── settings.py             # Configuración de Django, PostgreSQL, CORS y archivos estáticos
    │   ├── urls.py                 # Enrutador raíz del proyecto
    │   ├── wsgi.py                 # Punto de entrada WSGI para producción (Gunicorn)
    │   └── asgi.py                 # Punto de entrada ASGI
    └── pos/
        ├── models.py               # Modelos relacionales (Producto, Categoria, Cliente, Proveedor, Venta, DetalleVenta, Compra, DetalleCompra, Reembolso, DetalleReembolso, Descuento, Faltante, PerfilUsuario, SesionToken)
        ├── serializers.py          # Serialización de modelos a JSON para la API REST
        ├── permissions.py          # Autenticación por Token y autorización por Rol (ADMINISTRADOR / CAJERO)
        ├── services.py             # Lógica de negocio y transacciones de inventario, ventas, correcciones, reembolsos y reportes
        ├── forms.py                # Validadores de datos de entrada
        ├── middleware.py           # Middlewares de CORS, auditoría (RequestLog) y sanitización
        ├── urls.py                 # Definición de rutas REST bajo /api/
        ├── tests.py                # Suite de pruebas automatizadas de extremo a extremo
        ├── management/commands/
        │   └── init_pos.py         # Comando manage.py init_pos para precargar usuarios y catálogo
        └── views/
            ├── auth.py             # Vistas de inicio/cierre de sesión y perfil actual
            ├── productos.py        # CRUD de productos con protección de integridad
            ├── entidades.py        # CRUD de categorías, clientes, proveedores, descuentos y faltantes
            └── operaciones.py      # Vistas de ventas, ventas abiertas, correcciones, reembolsos, compras y reportes
```

## 5. Configuración de PostgreSQL y Variables de Entorno

### 5.1. Crear la base de datos en PostgreSQL

En tu servidor PostgreSQL local o remoto, ejecuta:

```sql
CREATE DATABASE papel_y_luna_pos;
```

### 5.2. Variables de entorno del Backend (`backend/.env`)

Copia el archivo `backend/.env.example` a `backend/.env` y configura tus credenciales reales:

```env
DJANGO_SECRET_KEY=clave-secreta-segura
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOW_ALL_ORIGINS=False
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
DJANGO_AUTHORS_JSON=[]

# Para usar PostgreSQL local, configura DATABASE_URL o las variables POSTGRES_*.
# Si no se configuran, el backend usa SQLite para desarrollo.
# DATABASE_URL=postgresql://postgres:tu_password@localhost:5432/papel_y_luna_pos
```

### 5.3. Variables de entorno del Frontend (`.env`)

Copia `.env.example` a `.env` en la raíz del proyecto:

```env
VITE_API_URL=http://127.0.0.1:8000/api
```

## 6. Instalación y Ejecución Local

### 6.1. Instalación y ejecución del Backend (Django)

```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt

# Ejecutar migraciones en la base de datos
python manage.py migrate

# Inicializar usuarios precargados (admin y cajero) y catálogo inicial
python manage.py init_pos

# Iniciar el servidor de desarrollo en http://127.0.0.1:8000
python manage.py runserver
```

También puedes ejecutar `python init_db.py` dentro de `backend/` para correr automáticamente las migraciones y la precarga de usuarios.

### 6.2. Instalación y ejecución del Frontend (React)

En otra terminal, ubicada en la raíz del proyecto:

```bash
npm install
npm run dev
```

Abre en el navegador la dirección indicada por Vite (por defecto `http://localhost:5173`).

## 7. Credenciales de Prueba Precargadas

En desarrollo local, `python manage.py init_pos` crea los perfiles de prueba. En Render, las contraseñas iniciales se generan como variables privadas del servicio; consulta `DJANGO_ADMIN_INITIAL_PASSWORD` y `DJANGO_CASHIER_INITIAL_PASSWORD` en el panel de Render.

| Rol | Usuario | Contraseña | Permisos principales |
| :--- | :--- | :--- | :--- |
| **ADMINISTRADOR** | `admin` | `admin123` | Acceso total: CRUD de productos, categorías, proveedores, clientes y descuentos; compras; ventas; corrección de ventas cerradas; reembolsos; faltantes; reportes por fechas. |
| **CAJERO** | `cajero` | `cajero123` | Crear ventas, guardar y retomar ventas abiertas, cerrar ventas, aplicar descuentos existentes, imprimir/exportar facturas a PDF, editar productos desde el flujo de venta, gestionar clientes y registrar faltantes. |

## 8. Endpoints Disponibles en la API REST (`/api/`)

| Recurso | Método | Endpoint | Rol Requerido | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/auth/login/` | Público | Valida credenciales y devuelve `token`/`access`, `refresh` y los datos del usuario. El `token` es alias del access JWT. |
| **Auth** | `POST` | `/api/auth/refresh/` | Público con refresh válido | Devuelve un nuevo access JWT. |
| **Auth** | `POST` | `/api/auth/logout/` | Autenticado | Revoca el refresh token enviado y cierra la sesión del cliente. |
| **Auth** | `GET` | `/api/auth/me/` | Admin / Cajero | Retorna los datos y rol del usuario autenticado. Sin JWT válido responde `401`. |
| **Auth** | `GET` | `/api/auth/admin-check/` | Solo Admin | Ruta de verificación de autorización: `200` admin, `401` sin token y `403` cajero. |
| **Productos** | `GET` | `/api/productos/` | Admin / Cajero | Lista el catálogo de productos y existencias. |
| **Productos** | `POST` | `/api/productos/` | Admin | Crea un nuevo producto validando precio >= costo y stock >= 0. |
| **Productos** | `PUT / PATCH` | `/api/productos/<id>/` | Admin / Cajero | Actualiza un producto (permite edición desde el flujo de venta). |
| **Productos** | `DELETE` | `/api/productos/<id>/` | Admin | Elimina un producto si no tiene ventas, compras ni faltantes asociados. |
| **Categorías** | `GET` | `/api/categorias/` | Admin / Cajero | Lista todas las categorías. |
| **Categorías** | `POST / PUT / DELETE` | `/api/categorias/` y `<id>/` | Admin | Crea, edita o elimina categorías (impide borrar si tiene productos). |
| **Clientes** | `GET / POST / PUT / DELETE` | `/api/clientes/` y `<id>/` | Admin / Cajero | CRUD completo de clientes (impide borrar si tiene ventas asociadas). |
| **Proveedores** | `GET` | `/api/proveedores/` | Admin / Cajero | Lista proveedores disponibles. |
| **Proveedores** | `POST / PUT / DELETE` | `/api/proveedores/` y `<id>/` | Admin | CRUD de proveedores (impide borrar si tiene compras o faltantes). |
| **Descuentos** | `GET` | `/api/descuentos/` | Admin / Cajero | Consulta el catálogo de descuentos porcentuales y fijos. |
| **Descuentos** | `POST / PUT / DELETE` | `/api/descuentos/` y `<id>/` | Admin | Gestiona descuentos sin alterar las ventas históricas. |
| **Ventas** | `GET` | `/api/ventas/` | Admin / Cajero | Lista ventas cerradas, corregidas y abiertas (`?estado=abierta`). |
| **Ventas** | `POST` | `/api/ventas/` | Admin / Cajero | Crea una venta abierta o cierra una venta descontando inventario. |
| **Ventas** | `GET / PUT / DELETE` | `/api/ventas/<id>/` | Admin / Cajero | Consulta detalle, actualiza/cierra una venta abierta o descarta abierta. |
| **Correcciones** | `POST / PUT` | `/api/ventas/<id>/corregir/` | Admin | Corrige una venta cerrada conservando su ID y ajustando el inventario. |
| **Reembolsos** | `POST` | `/api/ventas/<id>/reembolsar/` | Admin | Registra reembolso parcial o total con opción de retorno a inventario. |
| **Compras** | `GET / POST` | `/api/compras/` | Admin | Lista y registra compras a proveedores incrementando el stock. |
| **Faltantes** | `GET / POST / PUT` | `/api/faltantes/` y `<id>/` | Admin / Cajero | Registra, filtra y marca como resueltos los productos faltantes. |
| **Faltantes** | `GET` | `/api/faltantes/agrupados/` | Admin / Cajero | Agrupa faltantes con nombres normalizados por proveedor. |
| **Reportes** | `GET` | `/api/reportes/?fecha_inicio=YYYY-MM-DD&fecha_fin=YYYY-MM-DD` | Admin | Reporte real de ventas, más vendidos, compras y faltantes por fechas. |

Para probar JWT en Postman, importa `postman/Papel_y_Luna_JWT.postman_collection.json` y ejecuta las solicitudes en orden. El login incluye el access y refresh token en el JSON; la colección guarda los tokens y comprueba respuestas `200`, `401` y `403`.

La ruta pública `GET /authors` devuelve los integrantes y sus códigos en JSON, sin autenticación. Configura `DJANGO_AUTHORS_JSON` como una lista JSON de objetos `nombre` y `codigo` antes de entregar el despliegue.

## 9. Ejecución de Pruebas Automatizadas

Para ejecutar las pruebas de integración del backend (que verifican roles, inventario, ventas abiertas/cerradas, correcciones, reembolsos, descuentos, faltantes y reportes):

```bash
cd backend
./venv/bin/python manage.py test pos
```

## 10. Guía de Despliegue del Backend (Render + PostgreSQL)

1. Publica el proyecto en un repositorio GitHub y confirma que `.env`, `backend/.env`, `backend/db.sqlite3` y `backend/venv/` estén excluidos por `.gitignore`.
2. En Render, crea un Blueprint a partir del repositorio. El `render.yaml` declara una base PostgreSQL y un servicio Django con `Root Directory: backend`.
3. El servicio ejecuta `./build.sh` para instalar dependencias, recopilar archivos estáticos, aplicar migraciones y cargar los datos iniciales. Gunicorn inicia `config.wsgi:application`.
4. Render genera `DJANGO_SECRET_KEY` y las contraseñas iniciales del administrador y cajero. Configura `DJANGO_AUTHORS_JSON` con los nombres y códigos reales del equipo.
5. Cuando termine el despliegue, abre `https://<servicio>.onrender.com/authors` y comprueba que muestre el JSON del equipo.

Esta actividad despliega solo el backend y su base de datos. El frontend se mantiene como aplicación local para probar la API. En el plan gratuito, Render suspende el servicio tras 15 minutos sin tráfico y su PostgreSQL expira a los 30 días; úsalo para la actividad y respalda los datos que necesites conservar.
