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
# Revisar destino y migraciones antes de aplicar la etapa 1:
pnpm --dir cneb-backend run db:migrate
pnpm --dir cneb-backend run db:migrate --apply --baseline-existing
pnpm --dir cneb-backend dev
```

En otra terminal:

```sh
pnpm --dir cneb-frontend dev
```

Abre `http://localhost:5173`. El proxy de Vite envía `/api` al backend en el puerto 3000.

`db:setup` crea el esquema inicial y carga datos de muestra; **se ejecuta una sola vez sobre una base vacía**. No es un gestor de migraciones incrementales y no debe repetirse sobre una base ya inicializada.

## Primer uso y etapa 1

El registro público está eliminado. Solo SUPERADMIN administrará cuentas y perfiles institucionales mediante la API de la etapa 2. El docente consulta su perfil; una cuenta sin perfil no puede generar ni exportar.

Un crédito equivale a una generación validada y persistida. El backend guarda sesión, identidad institucional histórica y débito de forma atómica. Las descargas repetidas no cobran ni guardan contenido del navegador. Regenerar con IA consume otro crédito cuando termina correctamente. Las cuentas LIFETIME_FREE coherentes no consumen saldo.

Para una base existente, usar el nuevo ejecutor incremental después de revisar destino y migraciones; no repetir db:setup. Los comandos de migración y creación del primer SUPERADMIN, limitaciones históricas y pruebas están en [la entrega de etapa 1](Docs/ETAPA-1.md). No se implementó todavía el panel administrativo ni la pantalla de cambio de contraseña.

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
- `GET /api/v1/profile/institutional`: consulta institucional del usuario autenticado; no existe PUT docente.
- `GET /api/v1/wallets/me`: `balance`, `isUnlimited`, `planType`, `expiresAt`, `canGenerate`.
- `GET /api/v1/curriculum/areas/:areaId/tree?grade_level=THIRD`: catálogo por área y grado.
- `POST /api/v1/sessions/generate`: exige Idempotency-Key; genera, valida, persiste y descuenta un crédito. Devuelve id, contenido e identidad institucional del backend.
- `GET /api/v1/sessions/:id/export-docx`: verifica propiedad, perfil y copia institucional histórica; descarga sin débito.
- `POST /api/v1/auth/change-password`: cambia la contraseña e invalida sesiones anteriores, emitiendo una nueva.

## Alcance y despliegue

La rúbrica exportada es una **plantilla editable por niveles**: el docente debe completar los descriptores antes de aplicarla. Los otros instrumentos tienen sus columnas específicas. Desactivar el anexo o seleccionar `NONE` evita incluirlo.

Los documentos y sugerencias IA requieren revisión pedagógica; el repositorio no certifica conformidad normativa. En producción usa HTTPS y una configuración de frontend/API del mismo sitio compatible con cookies `SameSite=Strict`. Configura `/api` en el proxy o `VITE_API_URL`, así como `CORS_ORIGIN` en el servidor.
