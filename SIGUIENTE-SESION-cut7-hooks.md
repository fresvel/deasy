# Handoff — Cut #7 de `SqlAdminService`: injertos → registro de hooks

> Contexto compacto para trabajar **solo el cut #7** con cuidado. Copia el bloque de "PROMPT" como primer
> mensaje de una sesión nueva. Todo lo necesario está aquí o en los dos docs de referencia.

---

## PROMPT (pégalo como primer mensaje)

```
Continúo el refactor del God Object #1 del backend, `backend/services/admin/SqlAdminService.js`. Los cuts
#1-#6 (Extract Class de 6 subsistemas) están hechos y commiteados en `develop`: el fichero pasó de 5924 a
3440 líneas (-42%). Ahora quiero el CUT #7, el último y de mayor valor/riesgo, siguiendo EXACTAMENTE la
disciplina de los anteriores.

Lee primero, en este orden:
1. docs/auditoria-god-objects-2026-07.md  (auditoría + progreso de cuts + §"Preparación del cut #7" con el
   MAPA DE COBERTURA de los grafts y la estrategia tabla-por-tabla).
2. SIGUIENTE-SESION-cut7-hooks.md  (este handoff: estado exacto, payloads válidos, comandos, reglas).

CUT #7 = convertir los ~20 injertos `if (tableName === X)` de `create()` y los ~22 de `update()` en un
REGISTRO DE HOOKS POR TABLA (el equivalente backend de `FK_TABLE_MAP`, que el audit bendice como buen
diseño). Cada entrada declara before/after Create/Update para su tabla; `create()`/`update()` quedan como:
pickPayload → validateTableRules → hook.beforeCreate?.() → insert → hook.afterCreate?.().

HAZLO TABLA POR TABLA, no todo de golpe. Para CADA tabla grafted, en su propio commit (o lote pequeño):
  (1) añade su round-trip de ÉXITO a backend/tests/characterization/flows/admin_crud.test.mjs (crear →
      matchSnapshot(respuesta normalizada) → borrar; AUTOLIMPIANTE para no alterar los conteos list_*),
      captura el golden con `npm run test:char:capture`;
  (2) extrae su(s) rama(s) del if de create()/update() a un hook del registro;
  (3) VERIFICA: node --check + el backend ARRANCA (logs "Servidor iniciado", sin SyntaxError) + char 121+
      verde en modo compare + el golden nuevo idéntico.
Orden sugerido: primero payloads simples, luego los de estado complejo, luego valorar las runtime.

Antes de escribir código, MIDE el estado real (los números de línea han cambiado; usa el snippet de abajo)
y proponme el plan de ataque de la primera tanda.
```

---

## Estado exacto en el handoff (HEAD `5068bfa`, rama `develop`)

- `SqlAdminService.js`: **3440 L**. Lo que queda dentro es el **motor CRUD genérico** (`list`, `getByKeys`,
  `create` [L~1073], `update` [L~1579], `remove` [L~3343]) + **los grafts** + varios getters de lectura +
  los **delegadores** a los 6 servicios extraídos.
- Módulos hermanos ya creados (NO tocar en el cut #7): `.storage.js`, `.orgStructure.js`,
  `.templateArtifact.js`, `.processDefinitionVersion.js`, `.workflowSync.js`, `.taskAssignment.js`
  (clase-con-estado + delegadores), y los puros `.validation.js`/`.versioning.js`/`.primitives.js`/
  `.artifacts.js`/`.workflows.js`/`processDefinitionSeries.js`.
- Tests: **char 121** (`test:char:run`), **unit 177** (`test:unit`). Todos verdes.
- El motor genérico **NO se toca**: el audit dice que es buen diseño; el problema son los injertos.

## Los grafts a convertir (localízalos, los nº de línea cambian)

`create()` toca **20 tablas**, `update()` **22**. Enumera y ubica con esto (dentro de `backend/`):

```python
python3 - <<'PY'
import re
lines=open('services/admin/SqlAdminService.js').read().split('\n')
def mr(name):
    s=next(i for i,l in enumerate(lines) if re.match(rf'  async {name}\(',l))
    e=next(i for i in range(s+1,len(lines)) if re.match(r'  (async )?[a-zA-Z_]+\(',lines[i]))
    return s,e
for meth in ['create','update']:
    s,e=mr(meth); seen={}
    for i in range(s,e):
        for t in re.findall(r'tableName === "([a-z_]+)"',lines[i]): seen.setdefault(t,[]).append(i+1)
    print(f'{meth}() [{s+1}-{e}]:', {t:v for t,v in seen.items()})
PY
```

**Grupos (del mapa de cobertura):**
- **Éxito YA caracterizado** (usa como patrón): `persons`, `unit_positions`.
- **Payloads simples, falta éxito**: `unit_relations`, `process_definition_series`, `vacancies`, `cargos`,
  `unit_types`, `processes`.
- **Estado complejo (contexto de borrador de definición, cascada)**: `process_definition_versions`,
  `process_definition_templates`, `process_target_rules`, `process_definition_period_types`,
  `template_artifacts`.
- **Runtime (solo CRUD admin; los flujos NO los tocan)**: `tasks`, `task_items`, `documents`,
  `document_versions`, `fill_flow_templates`, `fill_flow_steps`, `signature_flow_templates`,
  `fill_requests`, `signature_requests`, `document_signatures`.

## EL HALLAZGO QUE FIJA LA ESTRATEGIA

Los grafts se alcanzan **SOLO por el CRUD admin** (`POST`/`PUT` `/admin/sql/:table`). Los flujos de la app
(launch/ejecución/firma) **NO** pasan por `create()`/`update()`: `TaskGenerationService` y compañía hacen
`INSERT INTO ...` **directo** (verificado). ⇒ caracterizar un graft = **round-trip admin**, no un flujo.

## Payloads válidos ya descubiertos (para los round-trips)

- `persons` (200): `{cedula:"9999999999", first_name, last_name, email, password:"Demo1234!", cargo_id:1, role_id:1}`
  → graft hashea la contraseña (**NO la devuelve**) y **genera token**. En el golden se enmascaran `id` y `token`.
- `unit_positions` (200): `{unit_id:8, cargo_id:1, slot_no:99, is_unit_head:0, position_type:"real"}`.
- `process_definition_series`: `source_type` ∈ `{default, unit_type(+unit_type_id), cargo(+cargo_id)}`;
  `"manual"` es inválido. Necesita `process_definition_id` válido **y estado** (probado 400 con id=1 default).
- `unit_relations`: `{parent_unit_id, child_unit_id, relation_type_id}` a secas da 400 → necesita más campos
  (name/slug/effective_from…); revisa el graft y `sqlTables.js`.
- ids de referencia en el fixture: cargo 1, role 1, relation_unit_type 1, unit 8 (=`FIXTURE.unitId`),
  process/definition 1. Personas admin/gestor/usuario = ids 1/2/3.

## Patrón del round-trip de éxito (ya en `admin_crud.test.mjs`, sección 7)

```js
test("POST /admin/sql/<tabla> -> graft: <qué hace>", async () => {
  const token = await tokenFor("admin");
  const created = await post("/admin/sql/<tabla>", { token, body: { /* payload válido */ } });
  matchSnapshot(SUITE, "graft_<tabla>_create", { status: created.status, body: normalize(created.body, { maskIdKeys: true }) });
  const id = created.body?.id;
  assert.ok(id, "create debe devolver id");
  // asserts DUROS de la transformación observable del graft (p.ej. persons: !("password" in body) && body.token)
  await del("/admin/sql/<tabla>", { token, body: { keys: { id } } });   // AUTOLIMPIANTE
});
```

## Reglas NO negociables (lecciones de los cuts #1-#6)

1. **Extraer por SCRIPT** (python/awk), no a mano: "extracción literal" exige cero errores de transcripción.
2. **`node --check` valida SINTAXIS, NO resolución de imports.** Un import del módulo equivocado PASA
   `node --check` pero CRASHEA el backend al arrancar (`does not provide an export named X`). **Verifica
   SIEMPRE que el backend arranca ("Servidor iniciado", sin SyntaxError) ANTES de correr char.**
3. **char verde ANTES y DESPUÉS; los golden deben quedar IDÉNTICOS** (es refactor puro, no cambia
   comportamiento). Si un golden cambia, o rompiste algo o el test estaba mal.
4. **Round-trips autolimpiantes** (crear+borrar) para no alterar los conteos `list_*` de la sección 5.
5. **Preservar el ORDEN de los guards** de create()/update(): campos requeridos ANTES de
   `validateTableRules`, y varias tablas tienen guards propios aún antes. Los contratos de ERROR ya
   caracterizados (sección 1-2 de `admin_crud`) fijan ese orden — no lo cambies.
6. **No tocar el motor genérico** (`list`/`getByKeys`) ni inyectar casos especiales en el camino genérico
   (ese es el olor de `AdminTableManager`). El registro de hooks separa lo por-tabla de lo genérico.
7. **Commits pequeños** (por tabla o lote pequeño) en `develop`, con el detalle de qué se verificó.
8. El usuario tiene **commits propios intercalados en `develop`** (docs/skills) — normal, no colisionan.

## Comandos de verificación (todo dentro del contenedor)

```bash
# tests
bash scripts/docker-env.sh dev exec -T backend npm run test:char:run      # 121 (compare)
bash scripts/docker-env.sh dev exec -T backend npm run test:char:capture  # actualiza golden (update)
bash scripts/docker-env.sh dev exec -T backend npm run test:unit          # 177

# tras editar: arranque (imprescindible — regla 2)
bash scripts/docker-env.sh dev restart backend
bash scripts/docker-env.sh dev logs --tail 15 backend | grep -E "Servidor iniciado|SyntaxError|does not provide"

# smoke por API (login + Bearer), dentro del contenedor. admin: cédula 1234567890 / Demo1234!
# POST /users/login {cedula,password} -> {token}; luego Authorization: Bearer <token>
```

`test:char:run` RESETEA la BD dev (reset+bootstrap+seed) — normal para char; deja el fixture sembrado.

## Diseño objetivo (el registro de hooks)

Un objeto keyed por tabla, p.ej. en un módulo hermano `SqlAdminService.tableHooks.js`:

```js
export const TABLE_HOOKS = {
  persons: { beforeCreate: async (ctx) => { /* hash pw + token */ }, ... },
  unit_positions: { beforeCreate: async (ctx) => { /* assertUnitHeadAllowed + normalizeProfile */ } },
  unit_relations: { beforeCreate: async (ctx) => { /* wouldCreateUnitCycle (ya delegador) + derivados */ } },
  // ... una entrada por tabla grafted
};
```

`create(tableName, data)` queda ≈: `getConfig → pickPayload → validateTableRules → hook?.beforeCreate → INSERT → hook?.afterCreate → return`.
El `ctx` que reciben los hooks debe darles lo que hoy usan las ramas (this.pool/connection, payload, el propio
service para llamar delegadores como `wouldCreateUnitCycle`, `resolveProcessDefinitionSeries`, etc.). Como
las ramas ya llaman métodos que HOY son delegadores a los servicios extraídos, el hook puede recibir `this`
(el service) o las funciones que necesite por inyección — mismo criterio que los cuts anteriores.

**Cuidado con las tablas de estado complejo**: sus ramas encadenan versionado/clonado/artifacts (ya en
servicios). Caracteriza su éxito con el setup de borrador antes de mover su rama, o déjalas para el final.
Las **runtime** quizá no merezcan hook (su create admin es de borde): valóralo — si su rama es trivial,
puede quedar en el catch-all; si transforma, hook.

## Referencias
- `docs/auditoria-god-objects-2026-07.md` — auditoría, progreso de los 6 cuts, y §"Preparación del cut #7"
  (mapa de cobertura + estrategia). **Actualízalo al cerrar el cut #7.**
- Memoria: `project_sonarqube_refactor_plan.md` (plan Sonar + progreso + lecciones).
- Harness char: `backend/tests/characterization/` (`lib/snapshot.mjs`, `normalize.mjs`, `http.mjs`,
  `auth.mjs`; `config.mjs` con `FIXTURE` y usuarios).
```
