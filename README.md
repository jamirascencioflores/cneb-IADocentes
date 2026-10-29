# CNEB IA Docentes

Aplicación para preparar sesiones de aprendizaje de secundaria con asistencia de Gemini, catálogo curricular en PostgreSQL y exportación a Word.

## Requisitos

- Node.js 24 y pnpm (la versión del backend está indicada en `package.json`).
- PostgreSQL con permisos para crear tablas y la extensión `uuid-ossp`.
- Credenciales de Gemini y un modelo disponible en tu cuenta.

## Instalación local

```sh
git clone https://github.com/jamirascencioflores/cneb-IADocentes.git
cd cneb-IADocentes
cp cneb-backend/.env.example cneb-backend/.env
cp cneb-frontend/.env.example cneb-frontend/.env
pnpm --dir cneb-backend install --frozen-lockfile
pnpm --dir cneb-frontend install --frozen-lockfile
```

Edita `cneb-backend/.env`: configura una base de datos **vacía**, tu API key y modelo de Gemini. Sustituye los tres secretos JWT/cookie por valores aleatorios independientes (por ejemplo, ejecutando `openssl rand -base64 48` para cada uno). No publiques `.env`.

`REDIS_URL` todavía es requerido por la configuración, aunque los flujos actuales no usan Redis.

```sh
pnpm --dir cneb-backend db:setup
pnpm --dir cneb-backend dev
```

En otra terminal:

```sh
pnpm --dir cneb-frontend dev
```

Abre `http://localhost:5173`. El proxy de Vite envía `/api` al backend en el puerto 3000.

`db:setup` crea el esquema inicial y carga datos de muestra; **se ejecuta una sola vez sobre una base vacía**. No es un gestor de migraciones incrementales y no debe repetirse sobre una base ya inicializada.

## Primer uso

Crea un docente con `POST /api/v1/auth/register`, usando un cuerpo JSON como:

```json
{ "email": "docente@example.com", "password": "UnaClaveLargaYUnica123!" }
```

Inicia sesión desde la interfaz y completa el perfil institucional. Selecciona área, grado y competencias, genera la sesión y descarga el Word. Cada exportación válida descuenta un crédito, excepto en planes ilimitados. Si cambias el formulario debes generar nuevamente; el contenido modificado se guarda como una nueva versión antes de exportarlo. Una descarga repetida sin cambios reutiliza la misma sesión, pero sigue consumiendo un crédito.

El catálogo inicial es parcial: incluye Comunicación, EPT y Matemática y desempeños de algunos grados. La interfaz muestra únicamente desempeños disponibles para el grado elegido. Completa el catálogo con contenido verificado antes de ofrecer otros grados; la aplicación no inventa desempeños faltantes.

## Validación

```sh
pnpm --dir cneb-backend test
pnpm --dir cneb-backend build
pnpm --dir cneb-frontend test
pnpm --dir cneb-frontend build
pnpm --dir cneb-frontend lint
```

Las pruebas cubren contratos de API, validación de contenido generado, perfil, renovación de sesión, selección curricular, persistencia de versiones y exportación. Las pruebas HTTP usan Fastify `inject`; no hacen llamadas reales a Gemini ni necesitan una base externa. La comprobación final del flujo con PostgreSQL y Gemini requiere configurar las credenciales locales.

## Estructura

- `cneb-backend/src/modules`: identidad, créditos, currículo y sesiones.
- `cneb-backend/src/presentation/app.ts`: construcción de la API para servidor y pruebas.
- `cneb-frontend/src/features`: autenticación, perfil, currículo y planificador.
- `Docs`: especificación y listas de avance originales; no sustituyen las pruebas.

## Contratos relevantes

- `GET /api/v1/auth/me`: `{ "user": { "sub", "email", "role" } }`.
- `POST /api/v1/auth/refresh`: usa la cookie HttpOnly y devuelve `{ "accessToken" }`.
- `POST /api/v1/auth/logout`: elimina la cookie; un JWT ya emitido expira naturalmente.
- `GET/PUT /api/v1/profile/institutional`: datos institucionales del usuario autenticado.
- `GET /api/v1/wallets/me`: `balance`, `isUnlimited`, `planType`, `expiresAt`, `canExport`.
- `GET /api/v1/curriculum/areas/:areaId/tree?grade_level=THIRD`: catálogo por área y grado.
- `POST /api/v1/sessions/preview`: contenido IA con `moments` y `evaluationCriteria`; los datos del formulario permanecen en el cliente.
- `POST /api/v1/sessions`: guarda una sesión validada y devuelve su `id`.
- `GET /api/v1/sessions/:id/export-docx`: verifica propiedad y saldo, genera el documento y debita el crédito.

## Alcance y despliegue

La rúbrica exportada es una **plantilla editable por niveles**: el docente debe completar los descriptores antes de aplicarla. Los otros instrumentos tienen sus columnas específicas. Desactivar el anexo o seleccionar `NONE` evita incluirlo.

Los documentos y sugerencias IA requieren revisión pedagógica; el repositorio no certifica conformidad normativa. En producción usa HTTPS y una configuración de frontend/API del mismo sitio compatible con cookies `SameSite=Strict`. Configura `/api` en el proxy o `VITE_API_URL`, así como `CORS_ORIGIN` en el servidor.
