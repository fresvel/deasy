# Plan de limpieza de `backend/scripts/` — agosto 2026

> **Premisa habilitante: no existe ningún dato en producción.** Todo artefacto cuya única razón de
> ser sea transformar, restaurar o retro-parchear datos preexistentes es descartable sin pérdida.
>
> **Alcance:** los 14 artefactos de `backend/scripts/` (12 `.mjs` + 2 snapshots `.json`) y el wrapper
> `scripts/seed-db.sh`. **Se eliminan 8**; se conservan 7 scripts.
>
> **Rama base:** `develop`. **Ancla de medición:** inventario levantado sobre `514b67e`.
>
> Documento maestro de deuda técnica: `docs/plan-calidad-2026-08.md`. Este plan cierra tres de sus
> ítems **por eliminación**, no por refactor (§6.7).

---

## 1. Inventario y veredictos

| Artefacto | Veredicto | Razón |
|---|---|---|
| `backend/scripts/migrate_task_item_operational_dates.mjs` | **ELIMINAR** | Migración huérfana e inejecutable; su estado final ya está en el esquema |
| `backend/scripts/apply_rbac_patch.mjs` | **ELIMINAR** | Duplica `seedBaseRbacCatalog`; colisión de cédula con el seed |
| `backend/scripts/seed_pucese.mjs` | **ELIMINAR** | `--full` roto; `--baseline` redundante y corruptor |
| `backend/scripts/seeds/pucese.seed.json` | **ELIMINAR** | Volcado pre-PostgreSQL; contenido absorbido en código |
| `backend/scripts/seeds/pucese.seed.backup.json` | **ELIMINAR** | Esquema de abril 2026, sin referencias vivas |
| `backend/scripts/seed_demo_accounts.mjs` | **ELIMINAR** | Sustituido por `seed_dev_rich.mjs`; apunta a assets inexistentes |
| `backend/scripts/generate_person1_demo_certificate.mjs` | **ELIMINAR** | Subconjunto de su hermano, cableado a la persona equivocada |
| `scripts/seed-db.sh` | **ELIMINAR** | Wrapper puro de dos scripts condenados; sin modo superviviente |
| `backend/scripts/reset_postgres.mjs` | conservar | Invocado por `reset-db.sh` y `test:char:fixture` |
| `backend/scripts/reset_storage.mjs` | conservar | Única implementación de purga de MinIO |
| `backend/scripts/reset_system.mjs` | conservar | Invocado por `reset-system.sh` |
| `backend/scripts/bootstrap_admin_recovery.mjs` | conservar | Única salida del estado `recovery_required` |
| `backend/scripts/check_missing_imports.mjs` | conservar | Puerta de `npm run check:imports` |
| `backend/scripts/seed_dev_rich.mjs` | conservar | Fixture del contrato vivo de HomeView |
| `backend/scripts/generate_demo_certificates.mjs` | conservar | La UI solo sube `.p12`, no los genera |

**Balance:** −2 167 líneas de código, −380 KB de snapshots, −105 líneas de wrapper.

### 1.1 Por qué se van los de migración

`migrate_task_item_operational_dates.mjs` es el **último superviviente de una familia de nueve**
(`docs/docs-md-antiguos/02-dominio-datos/migraciones.md` lista los otros ocho, todos ya borrados). Su
wrapper `scripts/migrate-db.sh` tampoco existe. Nadie lo invoca, y si lo hicieran moriría en la
primera consulta: el commit `f707cbb` le cambió el import a PostgreSQL pero le dejó el SQL en MySQL.
El adaptador `config/postgres.js` traduce mucho, pero **no** `DATABASE()`,
`information_schema.STATISTICS`, `ADD INDEX`, `MODIFY COLUMN`, `AFTER <col>` ni `UPDATE … INNER JOIN`.
Y es un no-op de todos modos: `start_date`, `end_date`, `user_started_at` y los dos índices ya nacen
en `postgres_schema.sql`, con el `NOT NULL` que el script perseguía.

Los otros dos retro-parches van disfrazados de seed:

- `migrateLegacyRoles` renombra `Admin`→`AdminSistema` y `Gestor`→`GestorProcesos`. Esos nombres ya
  no existen en `ROLE_CATALOG`: los tres bucles hacen `continue`. No-op garantizado.
- `backfillDerivedRoleAssignments` replica lo que hace el trigger
  `trg_position_assignments_after_insert` desde el propio esquema.
- `pucese.seed.json` es un volcado **anterior** a la migración a PostgreSQL; lo delatan sus
  `column_types` (`int(11)`, `tinyint(1)`, `enum(...)`).

### 1.2 Tres bugs latentes que desaparecen con el borrado

1. **`apply_rbac_patch.mjs` secuestra al Prorrector.** Su admin demo usa la cédula `9000000001`, la
   misma que el usuario de ejemplo de `genericCatalog.js:135` —cuyo comentario afirma que "no
   colisionan"—. Ejecutado sobre un sistema bootstrapeado, o le cambia nombre/email/token/contraseña
   a esa persona, o viola unicidad y hace rollback de todo el patch.
2. **`seed_demo_accounts.mjs` mapea los 4 cargos demo a los 13 roles**, `AdminSistema` incluido
   (líneas 424-432). No se materializa solo porque el trigger ya disparó antes, pero deja
   `cargo_role_map` contaminado: quien corriera después el patch RBAC convertía a `usuario.demo` y
   `auditor.demo` en administradores.
3. **`seed_pucese.mjs apply --baseline` deja la base inconsistente.** Vacía `template_seeds` y
   `template_artifacts` con `session_replication_role = replica`, pero `deliverables`, `dossiers`,
   `dossier_items` y las 6 tablas `chat_*` no figuran en el snapshot, así que no se vacían y quedan
   colgando de filas borradas.

### 1.3 Verificación adversarial

Se intentó **refutar** el borrado por siete líneas de ataque —¿hay algún camino único? ¿rompe el
harness de caracterización? ¿depende algo de los `.json` en runtime? ¿se pierde la puerta de
aprobación de `prod`?— y todas se cayeron:

- El bootstrap es un **superset** del seed: `example_units` contiene todas las unidades del snapshot
  (mismos slugs y padres) **más cuatro escuelas** que el seed nunca tuvo. El sentinela `PERM` viene
  de `postgres_schema.sql:571`, no del seed.
- El harness está desacoplado a propósito: `bootstrap_system.mjs` y `seed_execution.mjs` no importan
  nada de `backend/scripts/` salvo `reset_postgres.mjs`, que se conserva. Sus comentarios documentan
  que migraron **fuera** del seed precisamente por el `--full` roto.
- `genericCatalog.js` menciona `pucese.seed.json` **solo en un comentario**: se inspiró en él, no lo
  lee. Ningún `readFile`, `createRequire` ni import assertion apunta a los `.json`.
- La puerta de aprobación de `prod` (`DEASY_PROD_DB_APPROVAL_FILE`) vive en
  `scripts/_backend_db_exec.sh:19-47`, no en `seed-db.sh`, y la siguen usando `reset-db.sh` y
  `reset-system.sh`. La cadena de despliegue nunca siembra.

Único delta real no reproducible por el bootstrap: el árbol de procesos demo de investigación
(`RTIN`, `inft`, `inpr` + serie `carrera` + 2 reglas), del que **2 de 3 versiones están en `draft`**.
Se recrea desde el wizard en minutos, y git lo preserva.

---

## 2. Fases de ejecución

Tres commits, en este orden. Cada uno deja el repo coherente.

| Commit | Contenido | Puertas antes de avanzar |
|---|---|---|
| **C1** | Borrado de los 8 artefactos + `rbacCatalog.js` + comentarios colgantes | §5 fases 1 y 2 |
| **C2** | Documentación (§4) | ninguna (prosa) |
| **C3** | Higiene: `.claude/settings.local.json` | ninguna (cosmético) |

C1 y C2 **pueden fusionarse**, y hay un argumento para hacerlo: separarlos deja una ventana en la
que la documentación instruye comandos inexistentes. Si se fusionan, el mensaje debe cubrir ambos.

---

## 3. Ediciones de código y configuración (commit C1)

### 3.1 Borrados

```bash
git rm backend/scripts/migrate_task_item_operational_dates.mjs \
       backend/scripts/apply_rbac_patch.mjs \
       backend/scripts/seed_pucese.mjs \
       backend/scripts/seed_demo_accounts.mjs \
       backend/scripts/generate_person1_demo_certificate.mjs \
       backend/scripts/seeds/pucese.seed.json \
       backend/scripts/seeds/pucese.seed.backup.json \
       scripts/seed-db.sh
```

`backend/scripts/seeds/` queda vacío y desaparece solo. Ojo: **no confundir** con
`backend/services/system/seeds/informe-general/`, que es la plantilla semilla del bootstrap y **se
conserva**.

### 3.2 `backend/config/rbacCatalog.js` — borrar líneas 145-158

`LEGACY_ROLE_RENAMES` y `CARGO_ROLE_MAP` quedan huérfanas al 100 %: fuera de su definición, su único
consumidor en todo el repo era `apply_rbac_patch.mjs` (líneas 6, 7, 149, 168). Cero usos en frontend,
tests o config.

```js
export const LEGACY_ROLE_RENAMES = {
  Admin: "AdminSistema",
  Gestor: "GestorProcesos"
};

export const CARGO_ROLE_MAP = {
  coordinador: ["GestorProcesos"],
  director: ["GestorProcesos"],
  prorrector: ["GestorProcesos"],
  jefe: ["GestorTalentoHumano"],
  responsable: ["GestorProcesos"],
  docente: ["Usuario"]
};
```

Borrarlas elimina de paso una **divergencia activa**: `CARGO_ROLE_MAP` mapeaba *docente* → `Usuario`
mientras `GENERIC_CATALOG.cargo_role_map` lo mapea a `GestorEjecucionProcesos`. Eran dos verdades
enfrentadas sobre la misma tabla.

**Dos trampas — no tocar:**

- `TABLE_RESOURCE_MAP.cargo_role_map: "security"` (línea 191) se refiere a la **tabla SQL**, que sigue
  viva y declarada en `config/sqlTables.js:465`.
- `GENERIC_CATALOG.cargo_role_map` en `services/system/genericCatalog.js` es otra cosa: el bloque de
  datos del wizard de bootstrap. Sin relación con la constante.

El resto de exports del fichero tiene consumidores vivos (`ADMIN_ROLE_NAME`, `ROLE_CATALOG`,
`RESOURCE_CATALOG`, `ACTION_CATALOG`, `ROLE_PERMISSION_MATRIX` → `SystemBootstrapService.js`; de
`ADMIN_ROLES` en adelante → `config/rbacPolicy.js`).

### 3.3 Comentarios que quedan colgando

`backend/services/system/genericCatalog.js:1` — cita un fichero que deja de existir:

```js
// Catálogos GENÉRICOS reutilizables, curados a partir de la semilla histórica de BD.
```

`backend/tests/characterization/setup/bootstrap_system.mjs:3-7` — reescribir en pretérito:

```js
// Antes el golden-master se capturaba contra un seed SQL paralelo (ya eliminado) en vez de
// contra lo que produce una instalación de verdad. Aquel seed dejaba vacía la capa de
// plantillas, así que el setup tenía que inyectarla escribiendo directo al pool y saltándose
// el guard del endpoint.
```

### 3.4 Sin cambios — verificado uno por uno

`scripts/_backend_db_exec.sh` (lo siguen sourceando `reset-db.sh` y `reset-system.sh`; ninguna de sus
4 funciones queda huérfana) · `backend/package.json` (sus dos referencias a `scripts/` son
`reset_postgres.mjs` y `check_missing_imports.mjs`, ambos conservados) · `docker/**` (los Dockerfiles
hacen `COPY backend ./` entero, sin copia selectiva de `scripts/seeds/`) · `.github/**` (cero
referencias; CI solo rsyncea `docker-env.sh`, `deploy-env.sh`, `apply-env.sh` y
`bootstrap-ingress-cert.sh`) · `sonar-project.properties` (no nombra ficheros individuales) ·
`backend/tests/**` (cero imports).

### 3.5 `.claude/settings.local.json` (commit C3)

Cuatro permisos huérfanos en `permissions.allow`. Borrar **de mayor a menor** para no desplazar
índices: líneas **180**, **177**, **158**, **103**. Ninguna es el último elemento del array, así que
no queda coma colgante.

No tocar las líneas 101, 102, 111, 172, 173, 174 — apuntan a ficheros conservados.

---

## 4. Documentación (commit C2)

### 4.1 `docs/03-backend/seed-users-dev.md` — reescribir entero

**Ya miente hoy, antes de esta limpieza.** Dice listar "las cuentas incluidas en `pucese.seed.json`"
con 11 usuarios `*.demo@pucese.edu.ec` y clave `Deasy1234!`; el snapshot real tiene **3 personas** con
correos `@institucion.edu.ec`. Es documentación de una tercera generación del seed que ya no existe.

Se reescribe en lugar de borrarse: es el único sitio del repo donde un humano busca "usuarios de
dev", y `CLAUDE.md` es instrucción de agente, no documentación.

```markdown
# Usuarios de desarrollo

Las cuentas de dev no vienen de un seed SQL: las crea el **bootstrap** del sistema. Sobre una
instalación vacía, `/setup` en el navegador → "usar datos de ejemplo"
(`POST /deasy/v1/system/bootstrap/initialize`).

Estas credenciales son solo para entornos locales o de desarrollo.

## Credenciales

El login es por **cédula**, no por correo.

| Rol | Cédula | Contraseña |
| --- | --- | --- |
| Admin | `1234567890` | `Demo1234!` |
| Gestor | `0987654321` | `Gestor1234!` |
| Usuario | `1122334455` | `Demo1234!` |

Ojo: la contraseña del gestor **no** es `Demo1234!`. El gestor conserva además el rol de usuario,
así que sirve para probar el dossier.

El router bloquea el espacio de usuario para el admin con `meta: { blockedForAdmin: true }`: para probar el
dossier o las firmas hay que entrar como gestor o usuario.

## Reinstalar desde cero

Vacía PostgreSQL y los buckets de MinIO y deja el backend en modo bootstrap:

    bash scripts/reset-system.sh dev

Después, `/setup` en el navegador y elegir "usar datos de ejemplo".

## Datos de ejecución para probar HomeView

El bootstrap deja el sistema configurado pero con poca carga operativa. Para poblar unidades,
tareas y entregables de la persona 3 (`1122334455`):

    bash scripts/docker-env.sh dev exec -T backend node /app/backend/scripts/seed_dev_rich.mjs

Los tests de caracterización resetean la base de dev; tras correrlos hay que volver a ejecutarlo.
```

### 4.2 `docs/07-despliegue/COMANDOS_PROYECTO.md`

Sustituir el título de la línea **199** (`## Seeds, reset y migraciones` → `## Reset y estado
inicial`) y todo el bloque **201-262** por el texto de abajo. Se conservan `reset-db.sh`, la nota de
migraciones retiradas y la política de `prod`; se documenta `reset-system.sh`, que hoy no aparece en
este fichero.

```markdown
### Estado inicial del sistema

Ya no hay seed SQL. El estado inicial lo produce el **bootstrap**: `/setup` en el navegador, o
`POST /deasy/v1/system/bootstrap/initialize`. Los comandos de esta sección solo vacían el sistema
para poder volver a arrancarlo desde ahí.

Las credenciales que crea el bootstrap con "usar datos de ejemplo" están en
`docs/03-backend/seed-users-dev.md`.

El mecanismo de migraciones incrementales fue retirado con la migración a PostgreSQL:
`backend/database/postgres_schema.sql` es la única fuente de verdad del esquema (se aplica al
arrancar vía `ensurePostgresSchema`).

Reset de PostgreSQL:

    bash scripts/reset-db.sh dev

Reset completo (dropea las tablas de PostgreSQL, vacía los buckets de MinIO y recicla `backend` y
`signer`) para volver al bootstrap:

    bash scripts/reset-system.sh dev

Flags de `reset-system.sh`: `--keep-db`, `--keep-minio`, `--rebuild`, `--no-restart`.

Datos de desarrollo con carga operativa sobre un sistema ya bootstrapeado:

    bash scripts/docker-env.sh dev exec -T backend node /app/backend/scripts/seed_dev_rich.mjs

Notas de seguridad:

- `qa` y `prod` también son soportados por estos scripts.
- `prod` exige `DEASY_PROD_DB_APPROVAL_FILE` apuntando a un archivo dentro del repo e ignorado por git.
```

Línea **266-267**, que contrasta con un script que deja de existir:

```markdown
Estos comandos son los que publican archivos de plantillas en MinIO. No tocan la base de datos.
```

### 4.3 `docker/README.md`

Borrar el bullet **294-295** (`scripts/seed-db.sh: ejecuta seed_pucese.mjs …`); los de `reset-db.sh`
y `reset-system.sh` quedan intactos. En el bloque de ejemplos **311-314**:

```bash
bash scripts/reset-db.sh qa
bash scripts/reset-system.sh dev
```

### 4.4 `README.md` raíz, líneas 36-39

```markdown
Operaciones DB con Docker por ambiente:

- `bash scripts/reset-db.sh qa`
- `bash scripts/reset-system.sh dev` (vacía PostgreSQL + MinIO y deja el backend en modo bootstrap)
```

### 4.5 `backend/tests/characterization/README.md`, líneas 49-59

El bloque explica **por qué** el harness no usa seed, y esa justificación sigue siendo válida. Pasa a
pretérito y se invierte el cierre:

```markdown
Antes se construía contra `scripts/seed-db.sh dev apply`, un snapshot SQL paralelo. Eran dos
fuentes de verdad, y el seed era la peor de las dos:

- Dejaba vacía la capa de plantillas, así que el setup tenía que inyectarla **escribiendo directo
  al pool**, saltándose el guard del endpoint.
- Su modo `--full` estaba roto por drift de esquema.
- Congelaba valores rancios: el golden guardaba `definition_name = "Proceso por defecto por
  General"`, un nombre que la aplicación **ya no genera**.

Ese snapshot y su wrapper `seed-db.sh` **ya no existen**. El bootstrap es la única fixture del
sistema. Para cargar datos de ejecución a mano en dev queda `backend/scripts/seed_dev_rich.mjs`,
que corre **sobre** un sistema ya bootstrapeado en vez de sustituirlo.
```

### 4.6 `CLAUDE.md` — dos ediciones

Líneas **8-9**, que contrastan el bootstrap con un script que desaparece:

```markdown
Los usuarios de referencia los **crea el bootstrap** (`/setup` → "usar datos de ejemplo"); no hay
ningún seed SQL alternativo. Ojo: la contraseña del gestor NO es `Demo1234!`.
```

Línea **56**, el layout del monorepo. Tras esta limpieza **no queda ni un wrapper de siembra ni de
migración** en `scripts/` (verificado: solo restan `_backend_db_exec.sh`, `apply-env.sh`,
`bootstrap-ingress-cert.sh`, `deploy-env.sh`, `docker-env.sh`, `reset-db.sh`, `reset-system.sh`,
`server-pull-deploy.sh`):

```markdown
- `scripts/` — operational wrappers for startup, deploy and reset.
```

### 4.7 `docs/plan-calidad-2026-08.md` — anotar, no reescribir

Las tablas de §2 y §3 son una **medición fechada**; su valor está en ser comparables con el próximo
escaneo. Se marcan las filas como *cerradas por eliminación*, en el estilo que el propio documento ya
usa (`~~tachado~~` → **hecho**).

Nota de cabecera, tras la línea 22:

```markdown
>
> **Ocho artefactos de `backend/scripts/` eliminados DESPUÉS de esta medición** (ver
> `docs/plan-limpieza-scripts-2026-08.md`). Las cifras de §2, §3 y §4.4 son **anteriores** al
> borrado. Los ítems que vivían en esos ficheros quedan marcados «cerrado por eliminación»: **no son
> trabajo pendiente**, el próximo escaneo los descontará solo. Efecto agregado esperado: −1 `S3776`
> (71 → 70), −1 `S6418 WONTFIX` (7 → 6), −2 `S2068` de producción (11 → 9) y −95 líneas duplicadas.
```

Filas a tachar: **§2.3 línea 192** (`apply_rbac_patch.mjs`, 95 líneas / 18,1 % de duplicación),
**§3.2 línea 247** (`seed_pucese.mjs:367`, complejidad cognitiva 32) y **§4.4 línea 331**
(`S6418 WONTFIX` en `seed_pucese.mjs:256`). Ajustar los conteos de cabecera de §3.2 (línea 232) y
§4.4 (línea 324), y la mención de las 11 `S2068` en §1.2 (líneas 68-70) y §5 Fase A (línea 374).

En §4.4 conviene ser explícito: la marca `S6418` se cierra **por eliminación del fichero**, no por
reescritura de la línea — la regla de R1 se mantiene.

### 4.8 No tocar — registro histórico

`docs/docs-md-antiguos/**` y `docs/arquitecturas/decisiones-modelo-entregables-2026-06.md` (cuya
cabecera ya avisa: *"Registro histórico fechado… Se conserva el texto original"*). Sus menciones a los
scripts borrados son correctas **para su fecha**.

`docs/linea-base-homeview-2026-07.md` no requiere cambios: sus dos menciones apuntan a
`seed_dev_rich.mjs`, que se conserva.

---

## 5. Protocolo de validación

Todo se ejecuta **dentro de los contenedores** vía `scripts/docker-env.sh` (`CLAUDE.md`). El bind
mount `../backend:/app/backend` de `compose.dev.yml` hace que los borrados se vean al instante: no
hace falta `--build`, pero sí `restart backend` tras tocar `rbacCatalog.js`.

### Fase 0 — Congelar la línea base (obligatorio, ANTES de borrar)

```bash
cd /home/fresvel/Documentos/Pucese/deasy
git status --porcelain          # debe salir vacío
git rev-parse HEAD              # ANOTAR: ancla de rollback
git switch -c chore/limpieza-scripts-backend
bash scripts/docker-env.sh dev up -d
bash scripts/docker-env.sh dev exec -T backend npm run test:unit     2>&1 | tail -12
bash scripts/docker-env.sh dev exec -T backend npm run check:imports 2>&1 | tail -3
```

Baseline medido: **218 pass / 0 fail** y **`check:imports OK — 121 ficheros`**. Si ya sale rojo, para
y arréglalo antes: después no podrás distinguir causa de efecto.

### Fase 1 — Puertas estáticas (obligatorio, no tocan la BD)

**1.1 — Constantes borradas sin consumidores.** Esta es *la* puerta de `rbacCatalog.js`:

```bash
grep -rn --include='*.js' --include='*.mjs' --include='*.vue' \
  -E '\b(LEGACY_ROLE_RENAMES|CARGO_ROLE_MAP)\b' backend/ frontend/src/
```

Éxito: **cero líneas**. Hoy salen 6 (2 definiciones + 4 usos en el script condenado).

> ⚠️ **`check:imports` NO cubre este riesgo**, y conviene saber por qué antes de confiarse: su
> `SKIP_DIRS` incluye `scripts`, solo recorre ficheros `.js` (los 7 borrados son `.mjs`) y solo
> detecta **uso como llamada** — `CARGO_ROLE_MAP[...]` y `Object.entries(LEGACY_ROLE_RENAMES)` nunca
> se invocan. Un consumidor superviviente pasaría verde. El grep es la puerta real.

**1.2 — Ningún import apunta a un fichero borrado.** `node --check` valida sintaxis, no imports
(`CLAUDE.md`, "Reglas al mover código" punto 2). Comprobador puntual que recorre **todo** `backend/`
incluyendo `scripts/` y `.mjs`:

```bash
bash scripts/docker-env.sh dev exec -T backend sh -c 'cat > /tmp/check_resolve.mjs' <<'JS'
import fs from "node:fs"; import path from "node:path";
const ROOT="/app/backend", SKIP=new Set(["node_modules",".git","storage"]), files=[];
(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){
 if(e.isDirectory()){if(!SKIP.has(e.name))walk(path.join(d,e.name));}
 else if(/\.(js|mjs)$/.test(e.name))files.push(path.join(d,e.name));}})(ROOT);
let bad=0;
for(const f of files){const src=fs.readFileSync(f,"utf8");
 const specs=[...src.matchAll(/import\s[^;]*?from\s*["'](\.[^"']+)["']/g),
              ...src.matchAll(/import\s*\(\s*["'](\.[^"']+)["']\s*\)/g),
              ...src.matchAll(/(?:^|\n)\s*import\s+["'](\.[^"']+)["']/g)].map(m=>m[1]);
 for(const s of specs){const t=path.resolve(path.dirname(f),s);
  if(!fs.existsSync(t)){console.error(`ROTO ${path.relative(ROOT,f)} -> ${s}`);bad++;}}}
console.log(bad?`check:resolve FALLA - ${bad} import(s) rotos`:`check:resolve OK - ${files.length} ficheros`);
process.exit(bad?1:0);
JS
bash scripts/docker-env.sh dev exec -T backend node /tmp/check_resolve.mjs
```

Éxito: `check:resolve OK`. Hoy: 170 ficheros, verde.

**1.3 — Sin referencias operativas colgando:**

```bash
grep -rn --exclude-dir={node_modules,.git,docs-md-antiguos} \
  -E 'seed_pucese|apply_rbac_patch|seed_demo_accounts|generate_person1_demo_certificate|migrate_task_item_operational_dates|pucese\.seed|seed-db\.sh' \
  scripts/ backend/ docker/ frontend/src/ .github/ README.md CLAUDE.md
```

Éxito: ninguna línea **ejecutable**. Las de prosa se resuelven en C2.

**1.4 — Puertas estándar:**

```bash
bash scripts/docker-env.sh dev restart backend
bash scripts/docker-env.sh dev exec -T backend npm run check:imports 2>&1 | tail -3
bash scripts/docker-env.sh dev exec -T backend npm run test:unit     2>&1 | tail -12
```

Éxito: idéntico al baseline. `check:imports` **no debe bajar de 121** (los borrados son `.mjs` y
nunca contaron).

**1.5 — Sanidad de los 7 conservados:**

```bash
bash scripts/docker-env.sh dev exec -T backend sh -c \
  'for f in /app/backend/scripts/*.mjs; do node --check "$f" || echo "SYNTAX FAIL: $f"; done; echo "sintaxis OK"'
bash scripts/docker-env.sh dev exec -T backend node /app/backend/scripts/bootstrap_admin_recovery.mjs 2>&1 | head -3
```

Deben quedar exactamente 7 ficheros. El segundo comando debe imprimir
`Error: Falta el argumento requerido: --password`: ese mensaje **prueba** que
`SystemBootstrapService.js` y `config/postgres.js` se importaron bien. Cualquier
`ERR_MODULE_NOT_FOUND` es rollback inmediato — el bootstrap es lo que sustituye a todo lo borrado.

Los demás (`reset_postgres`, `reset_system`, `seed_dev_rich`, `generate_demo_certificates`) ejecutan
`main()` al importarse, así que no se pueden cargar en seco; los cubren 1.2 y la fase 2.

### Fase 2 — Caracterización (obligatorio)

> 🔴 **`npm run test:char:run` DESTRUYE la base de dev.** Encadena
> `reset_postgres.mjs && test:char:bootstrap && test:char:seed`: es un `DROP` + recreación. Si tienes
> datos manuales en dev, vuélcalos ahora.

```bash
bash scripts/docker-env.sh dev exec -T backend npm run test:char:run 2>&1 | tail -30
```

Éxito: **115 pass / 0 fail**, 13 flows, **cero diffs de golden**.

**Regla de oro:** un borrado puro no puede cambiar el contrato HTTP. Cualquier golden que se mueva es
una regresión, no una actualización — **está prohibido ejecutar `test:char:capture` para
"arreglarlo"**. Mira la línea `Test Files`, no solo `Tests`: una suite que no arranca cuenta como
fallo, no como "0 casos".

Esta puerta ya cubre la verificación funcional del camino sustituto, así que **no hace falta un
`/setup` manual como paso obligatorio**: `bootstrap_system.mjs` postea las 3 cuentas de referencia y
exige `201`, `buildPreconfig()` siembra el catálogo genérico completo, los goldens de
`admin_crud.json` fijan `list_cargos`/`list_roles`/`list_cargo_role_map`, y
`assertFixtureOrgMatches()` falla si el organigrama de ejemplo no cuadra.

**Restaurar dev (obligatorio tras el reset)** — y a la vez validar `seed_dev_rich.mjs` en ejecución
real, no solo compilando:

```bash
bash scripts/docker-env.sh dev exec -T backend node /app/backend/scripts/seed_dev_rich.mjs
```

Éxito: código 0 y la persona 3 (`1122334455`) con **2 unidades**, no una
(`docs/linea-base-homeview-2026-07.md:15-17`).

### Fase 3 — Frontend (opcional)

La limpieza no toca `frontend/` y el paso 1.3 ya lo confirma por grep. Si se corre para dejar
constancia, el criterio es **igualdad con el baseline**, no verde:

> ⚠️ **`frontend/src/modules/perfil/views/PerfilView.test.js` está ROJO HOY**, antes de tocar nada:
> `TypeError: Cannot read properties of undefined (reading 'request')` en `httpClient.js:3` (mock de
> `axios` incompleto vía `userPhotoService.js`). `pnpm run test:unit` sale con código 1 y reporta
> `Test Files 1 failed | 11 passed`, `Tests 208 passed`. **Ese rojo es preexistente y no bloquea esta
> limpieza.** Un fallo *distinto* sí sería nuevo.

---

## 6. Criterio de rollback

Cualquiera de estas señales obliga a revertir, sin discusión:

| # | Señal | Por qué es terminal |
|---|---|---|
| R1 | Cualquier diff de golden en `test:char:run` | Un borrado puro no puede cambiar el contrato HTTP |
| R2 | `test:unit` baja de 218 pass / 0 fail | La limpieza tocó producción |
| R3 | `check:resolve` imprime `ROTO` | Un superviviente importa algo borrado |
| R4 | El grep de 1.1 devuelve algo tras borrar las constantes | Consumidor vivo; ninguna otra puerta lo ve |
| R5 | `bootstrap_admin_recovery.mjs` no falla con `Falta el argumento requerido: --password` | El grafo del bootstrap está roto |
| R6 | `check:imports` baja de 121 ficheros | Se borró un `.js` de producción |

**No son rollback:** el rojo preexistente de `PerfilView.test.js`, ni las menciones en
`docs/docs-md-antiguos/`.

```bash
# Antes de commitear:
git checkout -- . && git clean -fd
# Ya commiteado en la rama:
git reset --hard <HASH_ANOTADO_EN_FASE_0>
# Rescate de un solo fichero:
git checkout <HASH_ANOTADO_EN_FASE_0> -- backend/scripts/<fichero>
```

Tras cualquier rollback hay que reconstruir dev, porque la fase 2 ya reseteó la base:

```bash
bash scripts/docker-env.sh dev restart backend
bash scripts/docker-env.sh dev exec -T backend npm run test:char:fixture
bash scripts/docker-env.sh dev exec -T backend node /app/backend/scripts/seed_dev_rich.mjs
```

---

## 7. Deuda que este plan NO cierra

Detectada durante el inventario, fuera de alcance por diseño:

1. **`loadEnv()` triplicado** — copiado byte a byte en `reset_postgres.mjs`, `reset_storage.mjs` y
   `reset_system.mjs` (líneas 13-34 en los tres), con una cuarta variante en `seed_pucese.mjs` que se
   va con el borrado. Y es un **no-op**: ni `backend/.env` ni `docker/.env` existen (los reales son
   `.env.dev`/`.env.qa`/…, y `docker/` ni siquiera entra en la imagen). Lo natural es sustituirlo por
   `import "dotenv/config"`, que ya usan `index.js`, `bootstrap_admin_recovery.mjs` y otros.
2. **`main()` muerto en `reset_storage.mjs`** (líneas 132-150) — cascarón del CLI de la era Mongo, con
   un flag `--keep-minio` que le pide al script que no haga lo único que hace. Nadie lo invoca
   directamente. Podarlo lo deja como librería pura.
3. **`reset_postgres.mjs` ≡ `reset_system.mjs --keep-minio`** — funcionalmente idénticos. Colapsarlos
   son 2 líneas, pero convierte una garantía **estructural** ("reset-db no sabe purgar MinIO") en una
   garantía por flag. Siendo la herramienta de trabajo diaria, el riesgo no compensa los ~15 líneas.
4. **`check_missing_imports.mjs` no está en CI** — su cabecera dice "sale con código 1 para poder
   usarlo como puerta en CI"; esa puerta nunca se instaló. Hoy depende de disciplina manual, que es
   justo el modo de fallo que la herramienta nació para eliminar.
5. **`generate_demo_certificates.mjs` no es descubrible** — sin wrapper ni entrada en `package.json`.
   Y tiene una trampa operativa: `reset_storage.mjs` vacía el bucket `deasy-certificates` pero no las
   filas, y el `HAVING COUNT = 0` del script considera "atendidas" a esas personas, así que no
   regenera. Un `--force` lo resolvería.
6. **`bootstrap_admin_recovery.mjs` es poco descubrible** — `SystemBootstrapView.vue:293` lo cita por
   nombre pero termina en `...` sin enumerar los flags, y no dice que hay que entrar al contenedor.
   El arreglo barato es documentar los flags en el mensaje, no tocar el script.
