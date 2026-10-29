# Etapa 1: seguridad y créditos de generación

Implementación en la rama actual, sin commit. No se ejecutaron migraciones, scripts administrativos, revisión de cuentas ni pruebas sobre una base PostgreSQL real.

## Alcance

- Cada TEACHER tiene como máximo un perfil institucional. Solo puede consultarlo.
- El registro público y el guardado arbitrario desde el navegador fueron eliminados.
- Un crédito representa una generación validada y persistida. Descargar no consume créditos.
- No se modifican los prompts de Gemini, el catálogo curricular ni la composición del DOCX.
- Las etapas 2, 3 y 4 siguen pendientes: API/panel administrativo, navegación por roles, pantalla de cambio de contraseña y carga completa de secundaria. Primaria queda fuera del MVP 1.0.

## Migraciones preparadas

Se conserva [001_initial_schema.sql](../cneb-backend/src/infrastructure/database/migrations/001_initial_schema.sql).

1. [002_identity_security.sql](../cneb-backend/src/infrastructure/database/migrations/002_identity_security.sql): flags de contraseña, versión de tokens, sesiones por dispositivo y trigger de invalidación ante desactivación, cambio de contraseña o rol.
2. [003_institutional_profile_unique.sql](../cneb-backend/src/infrastructure/database/migrations/003_institutional_profile_unique.sql): detiene la migración con todos los user_id duplicados; UNIQUE(user_id); índices de docentes/sesiones.
3. [004_wallet_audit.sql](../cneb-backend/src/infrastructure/database/migrations/004_wallet_audit.sql): responsable, saldos, plan, vigencia y condición ilimitada anteriores/posteriores; auditoría obligatoria para nuevos ajustes.
4. [005_generation_idempotency.sql](../cneb-backend/src/infrastructure/database/migrations/005_generation_idempotency.sql): solicitudes PROCESSING/COMPLETED/FAILED, clave por usuario, hash del contenido, resultado persistido y vínculo único con movimiento.
5. [006_generation_accounting.sql](../cneb-backend/src/infrastructure/database/migrations/006_generation_accounting.sql): nuevo tipo SESSION_GENERATION_DEBIT; los movimientos anteriores mantienen SESSION_EXPORT_DEBIT.
6. [007_session_institutional_snapshot.sql](../cneb-backend/src/infrastructure/database/migrations/007_session_institutional_snapshot.sql): copia institucional JSONB y protección de titularidad/identidad registrada.

El ejecutor [migrate.ts](../cneb-backend/src/infrastructure/database/scripts/migrate.ts) registra nombre/checksum/fecha en schema_migrations, aplica pendientes en transacciones separadas y utiliza un bloqueo asesor para serializar ejecuciones. En bases existentes exige establecer explícitamente la línea base. No carga semillas. Por defecto solo consulta comprobaciones y muestra el plan; las escrituras requieren --apply.

El preflight también consulta las billeteras, con las mismas reglas de configuración que la entidad: rechaza ilimitadas fuera de LIFETIME_FREE, LIFETIME_FREE sin is_unlimited o con vencimiento, saldos inválidos y fechas no finitas. Informa todos los wallet_id/user_id incompatibles y detiene la aplicación antes de escribir migraciones. No modifica datos. Un plan ordinario vencido o un saldo cero son estados válidos y no bloquean la migración.

Los saldos y movimientos históricos no se recalculan. Los nuevos campos de auditoría conservan NULL donde nunca existió esa información. No se borran ni combinan perfiles.

## Autenticación

Access y refresh JWT incluyen sid y token_version. Cada petición protegida consulta usuario, rol y estado actuales, versión y sesión de dispositivo vigente.

El logout revoca únicamente sid y elimina la refresh cookie; no incrementa token_version. Desactivar la cuenta o cambiar su contraseña incrementa la versión mediante trigger. Reactivar no restaura tokens anteriores.

Con must_change_password activo solo se permiten GET /auth/me y POST /auth/change-password, /auth/refresh, /auth/logout. Refresh emite un token que conserva las restricciones actuales. El cambio exige la contraseña actual y una nueva de 12 a 256 caracteres, almacena Argon2, incrementa versión, revoca sesiones anteriores y emite una sesión nueva con cookie HttpOnly.

Los JWT emitidos antes de la migración no contienen sid/token_version y dejan de ser válidos: es necesario iniciar sesión de nuevo.

El servicio de credenciales temporales queda preparado para las futuras operaciones administrativas. No se implementan endpoints de creación docente, restablecimiento o revocación administrativa en esta etapa.

## Generación y persistencia

POST /api/v1/sessions/generate exige Idempotency-Key y recibe datos pedagógicos, competencias/desempeños e instrumento. El esquema rechaza campos de identidad o titularidad enviados por el cliente.

Antes de Gemini comprueba cuenta, sesión de autenticación, perfil, plan y saldo. Gemini conserva su adaptador y validaciones. Se ejecuta fuera de una transacción larga.

La transacción final bloquea solicitud, usuario, sesión de autenticación, perfil y billetera; vuelve a comprobar los requisitos y guarda sesión/relaciones/copia institucional, débito y movimiento, y respuesta idempotente. Un fallo revierte todo. Las cuentas LIFETIME_FREE coherentes generan con saldo cero: se auditan en generation_requests y learning_sessions, sin movimiento de débito.

Una clave completada devuelve la respuesta persistida incluso si ya no queda saldo. Una clave con distinto contenido devuelve 409. En progreso devuelve 409 para reintentar con la misma clave. Los intentos fallidos/interrumpidos requieren una clave nueva y nunca vuelven a invocar Gemini bajo la clave anterior. La vigencia del intento es de tres minutos; ningún proceso puede completar un intento vencido.

El planificador conserva toda respuesta exitosa con su sessionId y los datos del formulario que originó la generación. Los campos y el botón de restablecimiento quedan deshabilitados durante la espera. Si aun así ocurre una actualización externa del formulario, la respuesta cobrada se muestra y permanece descargable. Un aviso indica que corresponde al estado anterior y que una nueva generación aplicará los cambios actuales. Cambiar o invalidar el formulario tampoco bloquea la descarga de la sesión ya persistida.

El planificador bloquea el doble envío inmediato y usa una clave nueva para una regeneración intencional. La descarga usa exclusivamente el sessionId persistido; no envía contenido para guardarlo.

La idempotencia pendiente se guarda en sessionStorage mediante [pending-generation.ts](../cneb-frontend/src/features/sessions/application/pending-generation.ts): idempotencyKey, huella SHA-256 del formulario, fecha de creación y estado. La clave de almacenamiento incluye una huella del usuario; otro usuario o formulario obtiene otra clave. No se guardan el formulario, nombres institucionales, contraseñas ni respuestas.

Al recrear el hook o recargar la página, generar con el mismo usuario y formulario reutiliza el intento. COMPLETED elimina el registro; los fallos definitivos también. Timeout, errores de conexión, respuestas 5xx inciertas y solicitudes todavía en progreso conservan la clave. Si sessionStorage no admite la escritura, la generación se bloquea antes de llamar al backend.

La vigencia local es de tres minutos, igual que la del intento del backend. Al vencer, el registro pasa a EXPIRED y se usa únicamente para reconciliar el intento con la misma clave: no se desecha automáticamente porque una respuesta perdida podría corresponder a un commit completado, cuyo resultado sigue siendo recuperable en el servidor. Tras esa respuesta, COMPLETED limpia el registro; FAILED/interrupción sin cobro lo limpia y permite una clave nueva. Nunca se inicia automáticamente otra generación por el simple vencimiento local.

## Identidad histórica y limitación de datos antiguos

Las generaciones nuevas guardan los ocho campos institucionales desde PostgreSQL. Vista previa y DOCX usan esa copia, aunque el administrador corrija después el perfil.

Las sesiones anteriores no registraban una copia histórica. No podrán exportarse: la API mantiene 409 hasta completar una regularización manual verificable de institutional_snapshot a partir de una fuente original, comprobando docente, sesión y datos históricos. El perfil actual nunca se usa para reconstruirla. Si no existe evidencia fiable, la exportación permanece bloqueada. Se conservan las filas y movimientos sin cobros ni devoluciones retroactivas. También se exige que el docente mantenga un perfil configurado para exportar.

## Endpoints

| Operación | Estado |
|---|---|
| POST /api/v1/sessions/generate | Nuevo: generación persistida, identidad del backend, crédito e idempotencia |
| POST /api/v1/auth/change-password | Nuevo: cambio y sesión nueva |
| POST /api/v1/auth/login | Sesión individual y flags actuales |
| GET /api/v1/auth/me | Identidad/rol/flags actuales |
| POST /api/v1/auth/refresh | Verifica dispositivo/versión y conserva restricciones |
| POST /api/v1/auth/logout | Revoca solo el dispositivo actual |
| GET /api/v1/profile/institutional | Sigue siendo exclusivamente de consulta propia |
| GET /api/v1/wallets/me | Informa canGenerate; no condiciona la descarga |
| GET /api/v1/sessions/:id/export-docx | Sin débito; verifica propietario, perfil y copia histórica |
| PATCH /api/v1/admin/users/:id/subscription | Ruta preexistente: motivo y auditoría reforzados, retiro excesivo rechazado |
| POST /api/v1/auth/register | Eliminado |
| POST /api/v1/sessions/preview | Eliminado como vía de generación gratuita |
| POST /api/v1/sessions | Eliminado como guardado de contenido del navegador |

## Frontend

Login sin credenciales ni registro demo. Control reutilizable mostrar/ocultar con botón real, ojo, aria-label dinámico, teclado, valor conservado y autocomplete=current-password. No se guardan contraseñas en localStorage.

Login comprobado en navegador a 360, 390, 768, 1024 y 1440 px: sin desbordamiento horizontal; controles de al menos 44 px. El resto del planificador conserva su diseño; no se implementó todavía un rediseño responsive general.

Para la etapa 3: aplicar el mismo control a contraseña nueva/confirmación y operaciones administrativas; autocomplete=new-password donde corresponda. Panel, navegación, tarjetas/tablas desplazables, modales y A4 deberán verificarse en todos esos anchos.

## Validación y límites

Resultado de la revisión anterior: 67 pruebas backend y 43 frontend aprobadas (110 en total). TypeScript backend/frontend y lint de los 11 archivos TypeScript afectados sin errores. La suite backend excluyó explícitamente *.postgres.spec.ts: no se ejecutó ninguna prueba PostgreSQL. Las pruebas de preflight y opciones del SUPERADMIN utilizan dobles y funciones importadas sin ejecutar los scripts. Se verifican recuperación de la clave al recrear el hook, aislamiento por usuario/huella, vencimiento y reconciliación, fallos definitivos/inciertos y resultado cobrado visible/descargable pese a cambios del formulario durante la espera.

La suite [generate-session.postgres.spec.ts](../cneb-backend/src/modules/pedagogical-session/application/generate-session.postgres.spec.ts) está preparada pero no ejecutada. Comprueba concurrencia con el último crédito, idempotencia, rollback SQL, identidad inmutable, ilimitadas e invalidación al desactivar/reactivar. En esta revisión se excluyó expresamente por instrucción del usuario; no se comprobó Docker ni se conectó a PostgreSQL. Los tests unitarios de orquestación no prueban el bloqueo real de PostgreSQL.

La etapa 1 queda cerrada a nivel de código con la corrección final descrita abajo. La validación PostgreSQL real continúa pendiente y debe completarse antes de ejecutar migraciones en una base importante o dar por verificados los bloqueos reales. La pantalla de cambio obligatorio y el acceso visual del SUPERADMIN pertenecen a etapa 3; los endpoints de etapa 1 pueden probarse con cliente HTTP.

### Cierre definitivo: clasificación de errores de generación

[isDefinitiveGenerationFailure](../cneb-frontend/src/features/sessions/application/pending-generation.ts) consulta ahora `error.problem.status` y `error.problem.detail`, compatibles con `ApiProblemException` y con el envoltorio del cliente HTTP. Los campos directos `status`/`message` se conservan únicamente como alternativa defensiva si no existe un objeto `problem`; nunca prevalecen sobre él.

Se elimina el intento de sessionStorage ante 400, 402, 404 y 422, o un 409 que confirme fallo/interrupción sin cobro o reutilización de Idempotency-Key con contenido diferente. Se conserva ante errores de red, timeout, 5xx, 409 en proceso y conflictos inciertos. Un título o mensaje externo al detalle no demuestra que no hubo cobro.

Las pruebas usan instancias reales de `ApiProblemException` construidas con `ProblemDetails` y verifican la eliminación o conservación efectiva de sessionStorage mediante el hook. También comprueban la prioridad del problema frente a campos directos contradictorios y que un 409 genérico sobre otro contenido no elimine el intento.

Validación final ejecutada desde `cneb-frontend` (todos los comandos finalizaron con código 0):

| Comando | Resultado exacto |
|---|---|
| `pnpm exec tsc --noEmit -p tsconfig.app.json` | Sin errores TypeScript |
| `pnpm exec eslint src/features/sessions/application/pending-generation.ts src/features/sessions/application/useSessionPreview.test.tsx` | 2 archivos comprobados, sin errores ni advertencias |
| `pnpm exec vitest run src/features/sessions/application/useSessionPreview.test.tsx` | 1 archivo aprobado; 28 pruebas aprobadas; duración 2,70 s |
| `pnpm exec vitest run` | 11 archivos aprobados; 56 pruebas aprobadas; duración 7,25 s |

En este cierre solo se modificaron [pending-generation.ts](../cneb-frontend/src/features/sessions/application/pending-generation.ts), [useSessionPreview.test.tsx](../cneb-frontend/src/features/sessions/application/useSessionPreview.test.tsx) y este documento. No se repitieron validaciones backend. No se ejecutaron migraciones, conexiones/pruebas PostgreSQL reales ni scripts administrativos; no se crearon usuarios o credenciales, no se modificaron secretos ni archivos .env y no se hizo commit ni push. No se iniciaron las etapas 2 o 3 ni se modificaron Gemini o el catálogo MINEDU.

## Comandos locales sin base de datos

Desde la raíz:

```powershell
pnpm --dir cneb-backend run typecheck
pnpm --dir cneb-backend exec vitest run --exclude '**/*.postgres.spec.ts'
pnpm --dir cneb-frontend exec tsc --noEmit -p tsconfig.app.json
pnpm --dir cneb-frontend test
```

Las pruebas PostgreSQL permanecen omitidas por defecto.

## Operaciones preparadas, NO ejecutadas: requieren revisión del destino y autorización

Primero revisar los archivos SQL anteriores y obtener host/puerto/base sin imprimir contraseña. No reutilizar db:setup en una base inicializada. El destino real no fue inspeccionado ni autorizado durante esta implementación.

Comprobaciones previas: esquema inicial completo, perfiles duplicados, docentes sin perfil, compatibilidad de billeteras, historial/checksums de migraciones y respaldo de la base. El ejecutor no modifica registros docentes ni billeteras para regularizarlos.

Después de mostrar y confirmar el destino:

```powershell
# Solo comprobaciones; lee DATABASE_URL del entorno/.env del backend.
pnpm --dir cneb-backend run db:migrate

# Base ya inicializada, después de revisar la línea base:
pnpm --dir cneb-backend run db:migrate --apply --baseline-existing

# Ejecuciones posteriores:
pnpm --dir cneb-backend run db:migrate --apply
```

Primer SUPERADMIN: indicar correo real y recibir la contraseña fuera del historial de comandos. La contraseña se recibe exclusivamente en SUPERADMIN_PASSWORD: ya no existe una opción CLI de contraseña y los errores de opciones nunca repiten los argumentos. El ejemplo usa Read-Host seguro y transmite el secreto mediante el entorno. El script no cambia un SUPERADMIN existente ni eleva un TEACHER.

```powershell
$env:SUPERADMIN_EMAIL = Read-Host 'Correo del primer SUPERADMIN'
$adminSecret = Read-Host 'Contraseña segura (mínimo 12 caracteres)' -AsSecureString
$env:SUPERADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $adminSecret).Password
try {
  pnpm --dir cneb-backend run db:create-superadmin --apply
} finally {
  Remove-Item Env:SUPERADMIN_PASSWORD
  Remove-Variable adminSecret
}
```

Revisión docente.demo: [consultas manuales](../cneb-backend/src/infrastructure/database/scripts/review-demo.sql) y [script seguro](../cneb-backend/src/infrastructure/database/scripts/review-demo.ts). Sin --apply el script no consulta ni modifica. Una revisión real debe confirmar antes el correo exacto y la base.

```powershell
pnpm --dir cneb-backend run db:review-demo --email CORREO_LOCAL_CONFIRMADO --action review --apply
# Tras revisar el UUID:
pnpm --dir cneb-backend run db:review-demo --email CORREO_LOCAL_CONFIRMADO --action deactivate --confirm UUID_REVISADO --apply
# Solo si no tiene sesiones, movimientos ni generaciones, en development y host local:
pnpm --dir cneb-backend run db:review-demo --email CORREO_LOCAL_CONFIRMADO --action delete --confirm UUID_REVISADO --apply
```

Se recomienda desactivar la cuenta cuando tenga historial. Ninguno de esos comandos se ejecutó.

Pruebas PostgreSQL: usar únicamente una base de pruebas dedicada, con permiso para crear esquemas y uuid-ossp. Mostrar primero el destino aprobado. La suite nunca usa DATABASE_URL como alternativa y crea/elimina exclusivamente su propio esquema con prefijo cneb_stage1_.

```powershell
$env:CNEB_PG_TEST_DATABASE_URL = 'URL_DE_LA_BASE_DE_PRUEBAS_AUTORIZADA'
$env:CNEB_PG_TEST_CONFIRMED_TARGET = 'postgresql://HOST:PUERTO/BASE'
$env:CNEB_PG_TEST_APPLY = 'YES'
pnpm --dir cneb-backend exec vitest run src/modules/pedagogical-session/application/generate-session.postgres.spec.ts
```

CONFIRMED_TARGET debe coincidir exactamente con la URL de destino sin usuario ni contraseña (incluido el protocolo). Al finalizar, retirar esas variables del entorno.

## Siguientes etapas

- Etapa 2: alta atómica docente/perfil/billetera, edición institucional, estado, planes, créditos, reset-password, revoke-sessions, movimientos y sesiones por docente.
- Etapa 3: /login, /, /admin, /change-password; navegación por rol, panel visual y responsive completo.
- Etapa 4 independiente: cargar todas las áreas oficiales de secundaria, revisar competencias/capacidades/desempeños por grado y documentar fuentes. Primaria excluida del MVP 1.0.

## Inventario de archivos de esta entrega

### Creados

- [Docs/ETAPA-1.md](../Docs/ETAPA-1.md)
- [cneb-backend/src/infrastructure/database/migrations/002_identity_security.sql](../cneb-backend/src/infrastructure/database/migrations/002_identity_security.sql)
- [cneb-backend/src/infrastructure/database/migrations/003_institutional_profile_unique.sql](../cneb-backend/src/infrastructure/database/migrations/003_institutional_profile_unique.sql)
- [cneb-backend/src/infrastructure/database/migrations/004_wallet_audit.sql](../cneb-backend/src/infrastructure/database/migrations/004_wallet_audit.sql)
- [cneb-backend/src/infrastructure/database/migrations/005_generation_idempotency.sql](../cneb-backend/src/infrastructure/database/migrations/005_generation_idempotency.sql)
- [cneb-backend/src/infrastructure/database/migrations/006_generation_accounting.sql](../cneb-backend/src/infrastructure/database/migrations/006_generation_accounting.sql)
- [cneb-backend/src/infrastructure/database/migrations/007_session_institutional_snapshot.sql](../cneb-backend/src/infrastructure/database/migrations/007_session_institutional_snapshot.sql)
- [cneb-backend/src/infrastructure/database/scripts/create-superadmin.ts](../cneb-backend/src/infrastructure/database/scripts/create-superadmin.ts)
- [cneb-backend/src/infrastructure/database/scripts/migrate.ts](../cneb-backend/src/infrastructure/database/scripts/migrate.ts)
- [cneb-backend/src/infrastructure/database/scripts/review-demo.sql](../cneb-backend/src/infrastructure/database/scripts/review-demo.sql)
- [cneb-backend/src/infrastructure/database/scripts/review-demo.ts](../cneb-backend/src/infrastructure/database/scripts/review-demo.ts)
- [cneb-backend/src/infrastructure/database/scripts/script-database.ts](../cneb-backend/src/infrastructure/database/scripts/script-database.ts)
- [cneb-backend/src/modules/billing/domain/credit-wallet.entity.spec.ts](../cneb-backend/src/modules/billing/domain/credit-wallet.entity.spec.ts)
- [cneb-backend/src/modules/identity/application/auth-session.service.spec.ts](../cneb-backend/src/modules/identity/application/auth-session.service.spec.ts)
- [cneb-backend/src/modules/identity/application/auth-session.service.ts](../cneb-backend/src/modules/identity/application/auth-session.service.ts)
- [cneb-backend/src/modules/identity/application/temporary-credential.service.spec.ts](../cneb-backend/src/modules/identity/application/temporary-credential.service.spec.ts)
- [cneb-backend/src/modules/identity/application/temporary-credential.service.ts](../cneb-backend/src/modules/identity/application/temporary-credential.service.ts)
- [cneb-backend/src/modules/identity/domain/institutional-snapshot.ts](../cneb-backend/src/modules/identity/domain/institutional-snapshot.ts)
- [cneb-backend/src/modules/identity/infrastructure/security/auth-session.instance.ts](../cneb-backend/src/modules/identity/infrastructure/security/auth-session.instance.ts)
- [cneb-backend/src/modules/pedagogical-session/application/generate-session.postgres.spec.ts](../cneb-backend/src/modules/pedagogical-session/application/generate-session.postgres.spec.ts)
- [cneb-backend/src/modules/pedagogical-session/application/generate-session.use-case.spec.ts](../cneb-backend/src/modules/pedagogical-session/application/generate-session.use-case.spec.ts)
- [cneb-backend/src/modules/pedagogical-session/application/generate-session.use-case.ts](../cneb-backend/src/modules/pedagogical-session/application/generate-session.use-case.ts)
- [cneb-backend/src/modules/pedagogical-session/application/generation-test.fixture.ts](../cneb-backend/src/modules/pedagogical-session/application/generation-test.fixture.ts)
- [cneb-frontend/src/features/auth/presentation/components/LoginForm.test.tsx](../cneb-frontend/src/features/auth/presentation/components/LoginForm.test.tsx)
- [cneb-frontend/src/shared/components/ui/password-input.tsx](../cneb-frontend/src/shared/components/ui/password-input.tsx)

### Añadidos durante la revisión

Además, en esta revisión se añadieron:

- [pending-generation.ts](../cneb-frontend/src/features/sessions/application/pending-generation.ts)
- [useSessionPreview.test.tsx](../cneb-frontend/src/features/sessions/application/useSessionPreview.test.tsx)
- [SessionPlannerPage.test.tsx](../cneb-frontend/src/features/sessions/presentation/pages/SessionPlannerPage.test.tsx)
- [migrate.spec.ts](../cneb-backend/src/infrastructure/database/scripts/migrate.spec.ts)
- [create-superadmin.spec.ts](../cneb-backend/src/infrastructure/database/scripts/create-superadmin.spec.ts)

La corrección de revisión modifica el planificador, su hook/prueba de flujo, la entidad de billetera, el preflight, el script SUPERADMIN y este documento. No cambia las migraciones SQL ni el tratamiento 409 de sesiones históricas.

### Modificados

- [README.md](../README.md)
- [cneb-backend/package.json](../cneb-backend/package.json)
- [cneb-backend/src/infrastructure/database/types.ts](../cneb-backend/src/infrastructure/database/types.ts)
- [cneb-backend/src/modules/billing/application/adjust-user-subscription.use-case.spec.ts](../cneb-backend/src/modules/billing/application/adjust-user-subscription.use-case.spec.ts)
- [cneb-backend/src/modules/billing/application/adjust-user-subscription.use-case.ts](../cneb-backend/src/modules/billing/application/adjust-user-subscription.use-case.ts)
- [cneb-backend/src/modules/billing/application/get-wallet-balance.use-case.ts](../cneb-backend/src/modules/billing/application/get-wallet-balance.use-case.ts)
- [cneb-backend/src/modules/billing/domain/credit-wallet.entity.ts](../cneb-backend/src/modules/billing/domain/credit-wallet.entity.ts)
- [cneb-backend/src/modules/billing/domain/wallet.repository.interface.ts](../cneb-backend/src/modules/billing/domain/wallet.repository.interface.ts)
- [cneb-backend/src/modules/billing/infrastructure/controllers/billing.controller.ts](../cneb-backend/src/modules/billing/infrastructure/controllers/billing.controller.ts)
- [cneb-backend/src/modules/billing/infrastructure/controllers/billing.schemas.ts](../cneb-backend/src/modules/billing/infrastructure/controllers/billing.schemas.ts)
- [cneb-backend/src/modules/billing/infrastructure/repositories/kysely-wallet.repository.ts](../cneb-backend/src/modules/billing/infrastructure/repositories/kysely-wallet.repository.ts)
- [cneb-backend/src/modules/identity/application/login.use-case.spec.ts](../cneb-backend/src/modules/identity/application/login.use-case.spec.ts)
- [cneb-backend/src/modules/identity/application/login.use-case.ts](../cneb-backend/src/modules/identity/application/login.use-case.ts)
- [cneb-backend/src/modules/identity/domain/user.entity.ts](../cneb-backend/src/modules/identity/domain/user.entity.ts)
- [cneb-backend/src/modules/identity/infrastructure/controllers/auth.controller.ts](../cneb-backend/src/modules/identity/infrastructure/controllers/auth.controller.ts)
- [cneb-backend/src/modules/identity/infrastructure/controllers/auth.schemas.ts](../cneb-backend/src/modules/identity/infrastructure/controllers/auth.schemas.ts)
- [cneb-backend/src/modules/identity/infrastructure/repositories/kysely-institutional-profile.repository.ts](../cneb-backend/src/modules/identity/infrastructure/repositories/kysely-institutional-profile.repository.ts)
- [cneb-backend/src/modules/identity/infrastructure/repositories/kysely-user.repository.ts](../cneb-backend/src/modules/identity/infrastructure/repositories/kysely-user.repository.ts)
- [cneb-backend/src/modules/identity/infrastructure/security/token.service.ts](../cneb-backend/src/modules/identity/infrastructure/security/token.service.ts)
- [cneb-backend/src/modules/pedagogical-session/application/export-session-docx.use-case.spec.ts](../cneb-backend/src/modules/pedagogical-session/application/export-session-docx.use-case.spec.ts)
- [cneb-backend/src/modules/pedagogical-session/application/export-session-docx.use-case.ts](../cneb-backend/src/modules/pedagogical-session/application/export-session-docx.use-case.ts)
- [cneb-backend/src/modules/pedagogical-session/application/save-session.use-case.ts](../cneb-backend/src/modules/pedagogical-session/application/save-session.use-case.ts)
- [cneb-backend/src/modules/pedagogical-session/controllers/session.controller.ts](../cneb-backend/src/modules/pedagogical-session/controllers/session.controller.ts)
- [cneb-backend/src/modules/pedagogical-session/controllers/session.schemas.ts](../cneb-backend/src/modules/pedagogical-session/controllers/session.schemas.ts)
- [cneb-backend/src/presentation/app.spec.ts](../cneb-backend/src/presentation/app.spec.ts)
- [cneb-backend/src/presentation/app.ts](../cneb-backend/src/presentation/app.ts)
- [cneb-backend/src/presentation/middlewares/auth-guard.ts](../cneb-backend/src/presentation/middlewares/auth-guard.ts)
- [cneb-frontend/src/features/auth/presentation/components/LoginForm.tsx](../cneb-frontend/src/features/auth/presentation/components/LoginForm.tsx)
- [cneb-frontend/src/features/sessions/application/useExportDocx.ts](../cneb-frontend/src/features/sessions/application/useExportDocx.ts)
- [cneb-frontend/src/features/sessions/application/useSessionPreview.ts](../cneb-frontend/src/features/sessions/application/useSessionPreview.ts)
- [cneb-frontend/src/features/sessions/domain/session.repository.ts](../cneb-frontend/src/features/sessions/domain/session.repository.ts)
- [cneb-frontend/src/features/sessions/domain/session.types.ts](../cneb-frontend/src/features/sessions/domain/session.types.ts)
- [cneb-frontend/src/features/sessions/infrastructure/http-session.repository.test.ts](../cneb-frontend/src/features/sessions/infrastructure/http-session.repository.test.ts)
- [cneb-frontend/src/features/sessions/infrastructure/http-session.repository.ts](../cneb-frontend/src/features/sessions/infrastructure/http-session.repository.ts)
- [cneb-frontend/src/features/sessions/infrastructure/session.dto.ts](../cneb-frontend/src/features/sessions/infrastructure/session.dto.ts)
- [cneb-frontend/src/features/sessions/infrastructure/session.mapper.ts](../cneb-frontend/src/features/sessions/infrastructure/session.mapper.ts)
- [cneb-frontend/src/features/sessions/presentation/pages/SessionPlannerPage.tsx](../cneb-frontend/src/features/sessions/presentation/pages/SessionPlannerPage.tsx)
- [cneb-frontend/src/shared/lib/http-client.test.ts](../cneb-frontend/src/shared/lib/http-client.test.ts)
- [cneb-frontend/src/shared/lib/http-client.ts](../cneb-frontend/src/shared/lib/http-client.ts)
- [cneb-frontend/src/test/planner-flow.test.tsx](../cneb-frontend/src/test/planner-flow.test.tsx)

### Eliminados

- cneb-backend/src/modules/identity/application/register-teacher.use-case.ts
- cneb-frontend/src/features/sessions/application/session-snapshot.test.ts
- cneb-frontend/src/features/sessions/application/session-snapshot.ts
