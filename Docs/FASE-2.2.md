# Fase 2.2: fundación administrativa

## Cierre definitivo de validación PostgreSQL — 2026-10-30

El usuario confirmó que las dos suites autorizadas pasaron completamente después de corregir 012:

- Etapa 1: todas las pruebas aprobadas.
- Fase 2.2: todas las pruebas aprobadas, incluidos los nuevos casos de integridad y la reproducción diagnóstica.
- Mensaje final confirmado: **«TODAS LAS PRUEBAS POSTGRESQL PASARON.»**

La ejecución fue realizada personalmente por el usuario, con contraseña introducida de forma segura, exclusivamente sobre `127.0.0.1:5432/cneb_stage1_test_20261029`, usuario limitado `cneb_stage1_runner`. Las suites operan en esquemas temporales `cneb_stage1_...` y `cneb_stage2_...`; no utilizan una base de producción. Este registro se basa en su confirmación, no en una nueva ejecución o conexión del agente.

La corrección de 012 queda validada dentro de los casos cubiertos por ambas suites. Las fases 2.3 y 3 no se iniciaron. Commit y push siguen pendientes de autorización explícita.

Única funcionalidad nueva: `POST /api/v1/admin/teachers`. No se implementan consultas administrativas, edición, estado, restablecimiento, revocación, suscripciones, dashboard o frontend.

La ruta anterior `PATCH /api/v1/admin/users/:id/subscription` se retira (404). Su caso de uso interno se conserva, pero no queda expuesto por HTTP. La futura administración de suscripciones deberá incorporar todas las reglas y auditoría de la Etapa 2.

## Contrato HTTP

Exige un access token vigente de SUPERADMIN, cuenta activa y cambio obligatorio de contraseña ya completado. El actor y su sesión se vuelven a comprobar dentro de la transacción, con bloqueos compartidos. El cuerpo no controla rol, propietario, versión de tokens ni saldo absoluto.

```json
{
  "email": "docente@example.invalid",
  "profile": {
    "teacherFullName": "Docente de prueba",
    "specialty": "Comunicación",
    "schoolName": "Institución de prueba",
    "ugel": "UGEL de prueba",
    "dre": "DRE de prueba",
    "principalName": null,
    "badgeUrl": null,
    "signatureUrl": null
  },
  "subscription": {
    "planType": "MONTHLY",
    "isUnlimited": false,
    "expiresAt": "2030-11-01T00:00:00-05:00"
  },
  "initialCredits": 0,
  "reason": "Alta administrativa revisada"
}
```

- `email`: obligatorio, trim y minúsculas antes de validar, máximo 255 caracteres.
- `temporaryPassword`: opcional, 12–256 caracteres, sin recortar ni transformar. Por defecto se generan 24 bytes aleatorios codificados como base64url (32 caracteres) y se almacenan con Argon2id.
- `profile`: los cinco campos principales son obligatorios; límites 150/100/200/50/100 para nombre/especialidad/institución/UGEL/DRE. Director opcional y anulable, máximo 150. URLs opcionales y anulables, máximo 2048; HTTP/HTTPS sin credenciales de URL. No se descargan recursos.
- `subscription`: objeto completo obligatorio. TRIAL/MONTHLY/QUARTERLY/ANNUAL exigen `false` y fecha ISO con zona horaria. LIFETIME_FREE exige `true` y `null`. No se calculan fechas; las fechas vencidas son estados válidos, sin capacidad de generación.
- `initialCredits`: obligatorio, entero entre 0 y 2147483647. No hay paquetes predeterminados.
- `reason`: obligatorio, 3–255 caracteres después de trim. Se rechazan patrones de credenciales y copias de la contraseña temporal conocida en datos públicos/auditoría.
- Todos los objetos rechazan campos desconocidos. BIMONTHLY y TRIMONTHLY no son entradas válidas.

Respuesta 201, `Cache-Control: no-store`:

```ts
{
  user: { id, email, role: "TEACHER", isActive: true, mustChangePassword: true },
  profile: { id, userId, teacherFullName, specialty, schoolName, ugel, dre,
    principalName, badgeUrl, signatureUrl },
  wallet: { id, userId, balance, planType, isUnlimited, expiresAt },
  temporaryPassword
}
```

La contraseña aparece únicamente después de confirmar la transacción. No se persiste el texto plano ni existe recuperación posterior: una respuesta perdida requiere un restablecimiento nuevo, cuyo endpoint queda para la fase posterior.

Errores: 400 validación; 401 autenticación inválida; 403 permisos/cambio obligatorio; 409 correo duplicado; 422 credenciales incluidas en datos administrativos; 500 fallo interno saneado. No se devuelven mensajes/filas/parámetros de PostgreSQL. El logger de fallos solo recibe un evento fijo y el identificador de solicitud, nunca Error, cuerpo, cabeceras, stack o mensaje original.

## Transacción y auditoría

Una sola unidad de trabajo inserta usuario, perfil, billetera y evento `TEACHER_CREATED`. Si los créditos iniciales son positivos, también inserta `ADMIN_MANUAL_ADJUSTMENT` con actor, motivo, saldos 0/inicial, configuración de plan antes/después y enlace al evento administrativo. Con saldo inicial cero no crea movimiento financiero.

El evento registra actor SUPERADMIN, entidad/ID, motivo, antes nulo, después construido por lista blanca, fecha PostgreSQL y request ID. No copia contraseñas, hashes, JWT, cookies o sid. Un fallo de auditoría o movimiento antes del commit revierte la operación. Los dobles verifican esa coordinación y un fallo lógico al confirmar. La primera ejecución PostgreSQL de Fase 2.2 tuvo seis fallos de integridad (28/34); tras corregir 012, el usuario confirmó ambas suites completamente aprobadas. Si el servidor confirma pero se pierde la respuesta o el acuse de commit, el resultado puede haber persistido: la contraseña no se recupera y requiere un nuevo restablecimiento.

## Migraciones y estado de validación

El usuario ejecutó la cadena, incluida la corrección actual de 012, en esquemas temporales de la base de pruebas autorizada y confirmó todas las pruebas aprobadas. El agente no ejecutó migraciones ni se conectó a ninguna base durante este cierre documental.

1. [008_admin_audit.sql](../cneb-backend/src/infrastructure/database/migrations/008_admin_audit.sql): tabla, índice por entidad, actor SUPERADMIN, protección de UPDATE/DELETE/TRUNCATE, rechazo recursivo de campos de credenciales y vínculo opcional desde movimientos existentes.
2. [009_normalized_email.sql](../cneb-backend/src/infrastructure/database/migrations/009_normalized_email.sql): comprobación de datos existentes, índice único normalizado, trigger de normalización y rechazo de espacios residuales/caracteres incompatibles con correo ASCII. No normaliza filas antiguas automáticamente.
3. [010_quarterly_plan.sql](../cneb-backend/src/infrastructure/database/migrations/010_quarterly_plan.sql): renombra TRIMONTHLY a QUARTERLY sin añadir un sinónimo. PostgreSQL refleja el nuevo nombre también en columnas enum históricas; conserva importes y fechas. Etiqueta futura: «Trimestral».
4. [011_plan_invariants.sql](../cneb-backend/src/infrastructure/database/migrations/011_plan_invariants.sql): validación previa y CHECK de configuración. BIMONTHLY histórico permanece legible, con vencimiento finito o nulo y sin ilimitado; se rechazan nuevas asignaciones y reasignaciones de propietario de esas billeteras.
5. [012_teacher_integrity.sql](../cneb-backend/src/infrastructure/database/migrations/012_teacher_integrity.sql): corregida tras los seis fallos reales y validada por las suites autorizadas según confirmación del usuario. Conserva la comprobación previa y la protección TRUNCATE; utiliza un validador por usuario con `v_user_role`, bloqueo ordenado de propietarios y tres funciones trigger explícitas.

Se reutilizan los índices y restricciones únicas de 001–007. Solo se añaden el índice único normalizado y el índice de auditoría necesarios para esta entrega. El preflight ahora detiene la ejecución ante docentes incompletos, dependencias de SUPERADMIN, planes incompatibles y correos incompatibles/duplicados; informa identificadores sin reparar registros.

## Archivos creados

- Este documento.
- Las cinco migraciones enlazadas arriba.
- [admin.contracts.ts](../cneb-backend/src/modules/admin/domain/admin.contracts.ts)
- [create-teacher.use-case.ts](../cneb-backend/src/modules/admin/application/create-teacher.use-case.ts)
- [admin-test.fixture.ts](../cneb-backend/src/modules/admin/application/admin-test.fixture.ts)
- [create-teacher.use-case.spec.ts](../cneb-backend/src/modules/admin/application/create-teacher.use-case.spec.ts)
- [admin.controller.ts](../cneb-backend/src/modules/admin/infrastructure/admin.controller.ts)
- [admin.controller.spec.ts](../cneb-backend/src/modules/admin/infrastructure/admin.controller.spec.ts)
- [kysely-admin-unit-of-work.ts](../cneb-backend/src/modules/admin/infrastructure/kysely-admin-unit-of-work.ts)
- [kysely-admin-unit-of-work.spec.ts](../cneb-backend/src/modules/admin/infrastructure/kysely-admin-unit-of-work.spec.ts)
- [migration-runner.ts](../cneb-backend/src/infrastructure/database/scripts/migration-runner.ts)
- [migration-runner.spec.ts](../cneb-backend/src/infrastructure/database/scripts/migration-runner.spec.ts)
- [admin-postgres-test-support.ts](../cneb-backend/src/modules/admin/infrastructure/admin-postgres-test-support.ts)
- [admin-postgres-test-support.spec.ts](../cneb-backend/src/modules/admin/infrastructure/admin-postgres-test-support.spec.ts)
- [create-teacher.postgres.spec.ts](../cneb-backend/src/modules/admin/application/create-teacher.postgres.spec.ts)

## Archivos modificados

- [migrate.ts](../cneb-backend/src/infrastructure/database/scripts/migrate.ts)
- [migrate.spec.ts](../cneb-backend/src/infrastructure/database/scripts/migrate.spec.ts)
- [types.ts](../cneb-backend/src/infrastructure/database/types.ts)
- [adjust-user-subscription.use-case.spec.ts](../cneb-backend/src/modules/billing/application/adjust-user-subscription.use-case.spec.ts)
- [credit-wallet.entity.ts](../cneb-backend/src/modules/billing/domain/credit-wallet.entity.ts)
- [credit-wallet.entity.spec.ts](../cneb-backend/src/modules/billing/domain/credit-wallet.entity.spec.ts)
- [billing.controller.ts](../cneb-backend/src/modules/billing/infrastructure/controllers/billing.controller.ts)
- [billing.schemas.ts](../cneb-backend/src/modules/billing/infrastructure/controllers/billing.schemas.ts)
- [temporary-credential.service.ts](../cneb-backend/src/modules/identity/application/temporary-credential.service.ts)
- [temporary-credential.service.spec.ts](../cneb-backend/src/modules/identity/application/temporary-credential.service.spec.ts)
- [app.ts](../cneb-backend/src/presentation/app.ts)
- [app.spec.ts](../cneb-backend/src/presentation/app.spec.ts)
- [error-handler.ts](../cneb-backend/src/presentation/middlewares/error-handler.ts)
- [generate-session.postgres.spec.ts](../cneb-backend/src/modules/pedagogical-session/application/generate-session.postgres.spec.ts)

## Validación sin PostgreSQL

- `pnpm --dir cneb-backend run typecheck`: código 0, sin errores.
- ESLint con la configuración ya instalada del frontend, aplicada exclusivamente a los 27 archivos TypeScript afectados del backend: código 0, sin errores ni advertencias de lint. Incluye el análisis estático de ambas suites PostgreSQL. No se modificó frontend ni se instalaron dependencias.
- `pnpm --dir cneb-backend test` (`vitest run`): código 0, sin excluir archivos. Resultado final: **20 archivos aprobados y 2 omitidos, 22 en total; 149 pruebas aprobadas y 57 omitidas por opt-in, 206 en total**. Duración: 1.97 s.
- El proceso de esta última ejecución recibió `CNEB_PG_TEST_APPLY=NO`, sin editar el archivo de entorno. Se recogieron todos los archivos; únicamente se omitieron las dos suites PostgreSQL. Su aprobación real queda registrada mediante la confirmación del usuario, sin repetir operaciones sobre la base.
- La colección actual contiene 6 casos PostgreSQL de Etapa 1 y 51 de Fase 2.2. El usuario confirmó ambas suites completamente aprobadas tras corregir 012; estos 57 casos no se contabilizan como ejecutados nuevamente por el agente.

Las pruebas HTTP capturan logs con logger habilitado. Cubren autorización, rol TEACHER, cambio obligatorio, revalidación transaccional, normalización, duplicados, contraseñas, planes, créditos, auditoría, fallos de cada paso/commit y no-store. Las pruebas de adaptador usan consultas falsas; no conectan a PostgreSQL.

## Preparación de las suites PostgreSQL

Se adaptó exclusivamente la fixture de [generate-session.postgres.spec.ts](../cneb-backend/src/modules/pedagogical-session/application/generate-session.postgres.spec.ts): usuario, sesión de acceso, perfil y billetera se insertan ahora en una sola transacción. Las seis pruebas y todas sus aserciones permanecen intactas.

La suite [create-teacher.postgres.spec.ts](../cneb-backend/src/modules/admin/application/create-teacher.postgres.spec.ts) exige opt-in y se limita al destino `127.0.0.1:5432/cneb_stage1_test_20261029`. Antes de construir un pool comprueba URL, confirmación exacta y `CNEB_PG_TEST_APPLY=YES`; rechaza otros hosts, puertos, bases y opciones de URL que pudieran sobrescribir la conexión. No importa el archivo de entorno, el singleton de aplicación ni utiliza `DATABASE_URL` como alternativa.

Cada ejecución genera su esquema `cneb_stage2_<32 caracteres hexadecimales>` y solo elimina ese esquema al finalizar, incluso si falla la preparación. No limpia ni migra el esquema público. Las pruebas Etapa 1 conservan su esquema independiente `cneb_stage1_...`.

Cobertura PostgreSQL de las suites confirmadas como aprobadas por el usuario:

| Grupo | Comprobaciones cubiertas |
|---|---|
| Migraciones | Cadena 001–012; historial SHA-256; 001–007 cotejadas con hashes fijados del commit aprobado 069f77e; fixture histórica TRIMONTHLY renombrada; enum sin sinónimos; segunda ejecución sin reaplicación ni cambios de fechas/OID; rechazo de checksum alterado |
| Integridad | Alta completa; perfil/billetera ausentes rechazados al commit y rollback; SUPERADMIN con dependencias rechazado al commit; unicidad; eliminación y TRUNCATE de dependencias bloqueados; BIMONTHLY anterior a 011 legible y no asignable; planes temporales e ilimitado coherentes |
| Creación | Caso de uso y adaptadores reales, Argon2id real; cinco registros coordinados; cero créditos sin movimiento y saldo positivo con ADMIN_MANUAL_ADJUSTMENT vinculado; fallos SQL inyectados en auditoría/movimiento revierten todo |
| Concurrencia | Dos conexiones con correos equivalentes; barrera que espera a observar `pg_blocking_pids` antes de liberar el primer INSERT; una cuenta y conflicto 409 saneado |
| Auditoría | Actor SUPERADMIN activo y habilitado; ausencia de contraseña/hash/sid/tokens/cookie; protección UPDATE/DELETE/TRUNCATE; claves de credenciales anidadas rechazadas tanto en before_data como en after_data |

Para probar el mismo algoritmo utilizado por el CLI sin cargar su configuración, se extrajo [migration-runner.ts](../cneb-backend/src/infrastructure/database/scripts/migration-runner.ts). [migrate.ts](../cneb-backend/src/infrastructure/database/scripts/migrate.ts) delega en él manteniendo preflight, línea base explícita, conexión reservada, bloqueo asesor, transacción por migración y comprobación de checksums. La extracción cuenta con cuatro pruebas de dobles sin PostgreSQL. Las salvaguardas y hashes tienen catorce pruebas adicionales sin conexiones; se exige puerto explícito para evitar heredar PGPORT.

En la revisión estática anterior, 008–012 coincidían con el diff aprobado. En esta corrección solo cambia 012. Se verifican hashes para mantener 001–011 intactas; no se relajan restricciones.

## Fallo real detectado y corregido de 012 — cerrado

La primera ejecución real tuvo estos resultados, conservados como antecedente del defecto:

- Etapa 1: 6/6 pruebas aprobadas.
- Fase 2.2: 28/34 aprobadas y seis fallidas. Las transacciones confirmaban cuando debían rechazarse: TEACHER sin perfil, TEACHER sin billetera, SUPERADMIN con perfil, SUPERADMIN con billetera y eliminación de cada dependencia de un TEACHER.
- Mensaje común: `promise resolved "undefined" instead of rejecting`.

La causa identificada en la función original es el identificador local `current_role`. PostgreSQL define `CURRENT_ROLE` como una expresión SQL especial que devuelve el rol de la conexión, sin distinguir mayúsculas/minúsculas. `SELECT role INTO current_role` asignaba el rol de aplicación a la variable local, pero las condiciones no calificadas `IF current_role = 'TEACHER'` y `current_role = 'SUPERADMIN'` se interpretaban como comparaciones del rol PostgreSQL. Con la conexión `cneb_stage1_runner`, ambas eran falsas y no se lanzaba el error de composición. Véanse [las funciones de información del sistema](https://www.postgresql.org/docs/current/functions-info.html) y [las palabras reservadas](https://www.postgresql.org/docs/18/sql-keywords-appendix.html).

La corrección no cambia la regla ni desactiva triggers:

1. `enforce_teacher_composition(p_user_id UUID)` usa `v_user_role`, bloquea la fila de usuario y exige exactamente un perfil y una billetera para TEACHER, o cero de ambos para SUPERADMIN. Si el padre ya fue eliminado, retorna para permitir sus cascadas legítimas.
2. `enforce_teacher_composition_owners(old_id, new_id)` descarta NULL/duplicados y obtiene los bloqueos `FOR UPDATE` por UUID ascendente antes de validar ambos propietarios.
3. Tres funciones trigger específicas manejan INSERT/UPDATE/DELETE de usuarios, perfiles y billeteras. Las de dependencias pasan OLD.user_id y NEW.user_id cuando corresponde.
4. Se conservan los tres constraint triggers `DEFERRABLE INITIALLY DEFERRED`, las restricciones únicas previas y los bloqueos de TRUNCATE.

Las seis pruebas fallidas originales permanecen intactas. Se añaden casos opt-in en la misma suite para:

- Consultar `pg_trigger`, `pg_constraint`, `pg_proc`, `pg_get_triggerdef` y `pg_get_functiondef`: tres triggers existentes, habilitados (`O`), de fila y AFTER INSERT/UPDATE/DELETE, sin condición WHEN, diferibles e inicialmente diferidos, unidos a la función y esquema correctos; sesión en modo `origin`.
- Reproducir la colisión en una tabla y un constraint trigger diagnósticos, dentro de una transacción del esquema temporal. La instrumentación compara `current_role` con `probe.current_role` y fuerza `SET CONSTRAINTS ALL IMMEDIATE`. Nunca reemplaza ni desactiva los triggers de aplicación; elimina los objetos diagnósticos antes del commit.
- Forzar las seis condiciones inválidas con `SET CONSTRAINTS ALL IMMEDIATE`: comprobar que el código llegó a ese punto, que la sentencia falla antes del commit y que todo se revierte.
- Confirmar una creación completa con validación inmediata, y eliminar un docente sin referencias históricas mediante sus cascadas, incluida su sesión de acceso.
- Reasignar perfil/billetera: rechazo cuando solo el propietario anterior queda incompleto; rechazo cuando solo el nuevo propietario (SUPERADMIN) queda inválido y el anterior ya fue eliminado; aceptación cuando ambos docentes terminan completos.
- Rechazar cambios de rol incompatibles y conservar rol/token_version después del rollback.

La revisión anterior preparó la reproducción mínima y las consultas de catálogo sin ejecutarlas. Posteriormente el usuario ejecutó las suites autorizadas sobre esquemas temporales nuevos y confirmó que ambas aprobaron completamente, con el mensaje «TODAS LAS PRUEBAS POSTGRESQL PASARON.». El defecto queda cerrado dentro de esa cobertura. Este cierre no repite conexiones ni migraciones; una eventual nueva ejecución requerirá autorización. No se debe reaplicar una 012 modificada sobre un historial con el checksum anterior.

### Comandos de referencia: ejecutar SOLO después de autorización

Desde la raíz del repositorio, introducir personalmente la contraseña del usuario limitado. No reutilizar una URL de desarrollo ni cargar el archivo de entorno. Se conserva el bloque para una eventual repetición: el agente no lo ejecutó en este cierre y cualquier repetición requiere autorización nueva.

```powershell
$pgTestUser = 'cneb_stage1_runner'
$pgTestSecret = Read-Host 'Contraseña de ese usuario' -AsSecureString
$pgTestCredential = [System.Net.NetworkCredential]::new($pgTestUser, $pgTestSecret)
try {
  $env:CNEB_PG_TEST_DATABASE_URL = 'postgresql://' + [Uri]::EscapeDataString($pgTestUser) + ':' + [Uri]::EscapeDataString($pgTestCredential.Password) + '@127.0.0.1:5432/cneb_stage1_test_20261029'
  $env:CNEB_PG_TEST_CONFIRMED_TARGET = 'postgresql://127.0.0.1:5432/cneb_stage1_test_20261029'
  $env:CNEB_PG_TEST_APPLY = 'YES'

  # Ejecución secuencial: no comparte esquema ni modifica tablas públicas.
  pnpm --dir cneb-backend exec vitest run src/modules/pedagogical-session/application/generate-session.postgres.spec.ts
  if ($LASTEXITCODE -ne 0) { throw 'La suite Etapa 1 falló; no continuar.' }
  pnpm --dir cneb-backend exec vitest run src/modules/admin/application/create-teacher.postgres.spec.ts
  if ($LASTEXITCODE -ne 0) { throw 'La suite Fase 2.2 falló.' }
} finally {
  Remove-Item Env:CNEB_PG_TEST_DATABASE_URL, Env:CNEB_PG_TEST_CONFIRMED_TARGET, Env:CNEB_PG_TEST_APPLY -ErrorAction SilentlyContinue
  $pgTestSecret.Dispose()
  Remove-Variable pgTestUser, pgTestSecret, pgTestCredential -ErrorAction SilentlyContinue
}
```

No imprimir las variables ni la URL con credenciales. La cuenta de pruebas debe poder crear/eliminar su propio esquema; no se crean usuarios ni bases desde las suites. El comportamiento de `uuid-ossp` se conserva de 001: el destino dedicado ya cuenta con la extensión validada en Etapa 1.

## Revisión final de archivos antes del commit

- Conjunto pendiente: 33 archivos, 14 modificados y 19 nuevos, todos enumerados en este informe. No hay archivos en staging.
- No se detectaron credenciales reales, claves privadas, tokens completos, hashes Argon2 reales, URLs con credenciales reales, correos personales ni artefactos temporales en los cambios. Las credenciales literales de las pruebas son sintéticas y están identificadas como tales; se conservan porque verifican precisamente el saneamiento de secretos.
- Las referencias `DATABASE_URL`/`CNEB_PG_TEST_DATABASE_URL` son identificadores de configuración, URLs ficticias de pruebas o construcción en memoria del comando documentado. No contienen una URL real con contraseña.
- No hay archivos de entorno versionados ni pendientes de agregar. El archivo local del backend continúa ignorado por Git; no se leyó su contenido ni se modificó o eliminó como parte de esta revisión.
- Los scripts de inspección y los diffs de revisión permanecen fuera del repositorio, en el directorio temporal del agente. No forman parte del conjunto a confirmar.
- Se verificaron hashes de 001–011 contra la línea base previa a la corrección: todas permanecen intactas. 001–007 ya están confirmadas en HEAD; 008–011 son archivos nuevos pendientes del commit, sin cambios desde su revisión aprobada.
- 012 y la suite PostgreSQL mantienen exactamente la corrección y las regresiones del diff que el usuario validó. No se alteró código después de esa confirmación; este cierre modifica únicamente el documento.
- No se ejecutaron comandos contra producción, scripts administrativos, nuevas migraciones o nuevas conexiones PostgreSQL desde este cierre. Tampoco se modificó frontend ni se iniciaron las fases 2.3 o 3.

Commit sugerido, todavía NO creado: `feat(admin): add atomic teacher creation and audit`.

## Límites y revisión pendiente

- Durante este cierre el agente no ejecutó migraciones, PostgreSQL, scripts administrativos, altas reales, commit ni push. No modificó frontend, archivo de entorno ni migraciones 001–011. No se realizaron operaciones en producción desde esta sesión.
- El usuario confirmó la aprobación completa de Etapa 1 y Fase 2.2 después de la corrección de 012, incluida su reproducción mínima y los nuevos casos de integridad. No queda pendiente otra ejecución PostgreSQL para registrar este resultado.
- Las suites PostgreSQL mantienen opt-in y no se vuelven a ejecutar como parte de las validaciones finales locales; la suite completa normal se ejecuta con el opt-in desactivado, sin excluir archivos de pruebas.
- Las nuevas invariantes pueden bloquear una migración ante datos antiguos incompletos o planes sin fecha. Cualquier regularización exige revisión separada; no se inventan datos institucionales ni se elimina el docente demo.
- Las migraciones se confirman individualmente; el renombre de enum modifica su etiqueta visible histórica y requiere coordinar despliegue de código/esquema en una etapa posterior.
- Los cambios del manejador de errores son globales: los errores inesperados dejan de exponer detalles incluso en desarrollo, y los errores administrativos conservan estado HTTP con texto genérico.
- Dashboard, suscripciones y demás escrituras quedan pendientes. Se mantienen las decisiones aprobadas de umbrales 3 créditos/7 días, zona America/Lima y separación del historial verificable para su futura implementación.

La continuación a 2.3 o posteriores queda pendiente de revisión del usuario.

## git status --short al finalizar

```text
 M cneb-backend/src/infrastructure/database/scripts/migrate.spec.ts
 M cneb-backend/src/infrastructure/database/scripts/migrate.ts
 M cneb-backend/src/infrastructure/database/types.ts
 M cneb-backend/src/modules/billing/application/adjust-user-subscription.use-case.spec.ts
 M cneb-backend/src/modules/billing/domain/credit-wallet.entity.spec.ts
 M cneb-backend/src/modules/billing/domain/credit-wallet.entity.ts
 M cneb-backend/src/modules/billing/infrastructure/controllers/billing.controller.ts
 M cneb-backend/src/modules/billing/infrastructure/controllers/billing.schemas.ts
 M cneb-backend/src/modules/identity/application/temporary-credential.service.spec.ts
 M cneb-backend/src/modules/identity/application/temporary-credential.service.ts
 M cneb-backend/src/modules/pedagogical-session/application/generate-session.postgres.spec.ts
 M cneb-backend/src/presentation/app.spec.ts
 M cneb-backend/src/presentation/app.ts
 M cneb-backend/src/presentation/middlewares/error-handler.ts
?? Docs/FASE-2.2.md
?? cneb-backend/src/infrastructure/database/migrations/008_admin_audit.sql
?? cneb-backend/src/infrastructure/database/migrations/009_normalized_email.sql
?? cneb-backend/src/infrastructure/database/migrations/010_quarterly_plan.sql
?? cneb-backend/src/infrastructure/database/migrations/011_plan_invariants.sql
?? cneb-backend/src/infrastructure/database/migrations/012_teacher_integrity.sql
?? cneb-backend/src/infrastructure/database/scripts/migration-runner.spec.ts
?? cneb-backend/src/infrastructure/database/scripts/migration-runner.ts
?? cneb-backend/src/modules/admin/
```

## git diff --stat al finalizar

```text
 .../database/scripts/migrate.spec.ts               | 17 ++++++--
 .../src/infrastructure/database/scripts/migrate.ts | 48 +++++++++++-----------
 cneb-backend/src/infrastructure/database/types.ts  | 18 +++++++-
 .../adjust-user-subscription.use-case.spec.ts      |  4 +-
 .../billing/domain/credit-wallet.entity.spec.ts    |  9 +++-
 .../modules/billing/domain/credit-wallet.entity.ts |  5 ++-
 .../controllers/billing.controller.ts              | 33 +--------------
 .../infrastructure/controllers/billing.schemas.ts  |  3 +-
 .../temporary-credential.service.spec.ts           | 10 +++++
 .../application/temporary-credential.service.ts    |  9 ++--
 .../application/generate-session.postgres.spec.ts  | 24 ++++++-----
 cneb-backend/src/presentation/app.spec.ts          |  5 ++-
 cneb-backend/src/presentation/app.ts               |  2 +
 .../src/presentation/middlewares/error-handler.ts  | 32 ++++++++-------
 14 files changed, 124 insertions(+), 95 deletions(-)
```

La salida literal de git diff --stat omite los 19 archivos nuevos sin seguimiento. El inventario de este documento incluye los 33 archivos que compondrían el commit; no se agregó ninguno al índice para generar estas estadísticas.
