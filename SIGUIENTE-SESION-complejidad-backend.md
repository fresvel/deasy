# Handoff — bajar complejidad en el backend (post cuts #1–#9 y re-escaneo Sonar)

> Copia el bloque "PROMPT" como primer mensaje de una sesión nueva. Todo lo necesario está aquí o en
> `docs/auditoria-god-objects-2026-07.md` (§1.b tiene los números del re-escaneo).
>
> Estado: `develop @64411c4`, árbol limpio. God Object #1 CERRADO.

---

## PROMPT (pégalo como primer mensaje)

```
Continúo bajando la complejidad del backend de Deasy. El God Object #1
(backend/services/admin/SqlAdminService.js) está CERRADO: nueve cuts lo llevaron de 5924 a 897 L
(-85%) y el re-escaneo de SonarQube confirma que `update()` pasó de CC 218 (la peor función del
repositorio) a CC 16.

Lee primero docs/auditoria-god-objects-2026-07.md, sobre todo §1.b (re-escaneo tras los cuts) y
§3.1/§3.1.b. Luego este handoff.

Quiero el CUT #10: convertir `validateTableRules` (backend/services/admin/SqlAdminService.validation.js:52)
en entradas del registro de hooks que ya existe. Es un `switch (tableName)` de 187 líneas sobre 22
tablas con CC 99 — literalmente el mismo olor que los cuts #7/#7b eliminaron de create/update/remove,
solo que en forma de switch, y por eso la auditoría original lo pasó por alto ("no es un switch"
decía, mirando el otro fichero). Su densidad (0,49 CC/ncloc) es el pico de toda la familia.

Por qué es el mejor siguiente movimiento:
  - el registro YA existe (SqlAdminService.tableHooks.js) y ya despacha por tabla en los tres verbos;
  - la red YA está puesta: los goldens create_error_* / update_error_* fijan literalmente esos
    mensajes, y los round-trips de éxito pasan por esas validaciones;
  - los 22 `case` son independientes entre sí — la misma propiedad que permitió migrar tabla por
    tabla sin big-bang en el cut #7.

HAZLO TABLA POR TABLA, con la disciplina de los cuts anteriores. Antes de escribir código MIDE el
estado real y proponme el plan de la primera tanda.
```

---

## Estado exacto (`develop @64411c4`)

- **`SqlAdminService.js`: 897 L.** Contiene el motor CRUD (`list`/`getByKeys`/`create`/`update`/`remove`,
  ~460 L), los tres guards de activación, seis lecturas cortas que usan los hooks, y **68 delegadores
  de una línea** a los servicios extraídos.
- **Cero injertos `if (tableName === X)`** en `create`/`update`/`remove`. Los 8 que quedan en el fichero
  están **solo en el motor de LECTURA** (`list` ×6, `getByKeys` ×1 + `sanitizePersonRow`): son fragmentos
  de SELECT/JOIN y overrides de orden — otra forma, necesitarían hooks distintos.
- **Familia** (24 módulos `SqlAdminService.*`): 6 538 ncloc, **CC 1 444**.
- **Tests: char 148, unit 194.** Ambos verdes. Más `npm run check:imports`.

### Los nueve cuts, para ubicarte

| # | Módulo | Qué se llevó |
|---|---|---|
| 1 | `.storage.js` | MinIO + fs + zip (módulo hermano, no clase) |
| 2 | `.orgStructure.js` | unidades, puestos, grafo de unidades |
| 3 | `.templateArtifact.js` | ciclo de vida del artifact |
| 4 | `.processDefinitionVersion.js` | series, versionado, clonado |
| 5 | `.workflowSync.js` | sync de flujos fill/firma |
| 6 | `.taskAssignment.js` | asignación/handover de task items |
| **7 / 7b** | **`.tableHooks.js`** | **los ~45 injertos por tabla de create/update/remove → registro** |
| 8 | `.templateLifecycle.js` | plantillas/entregables (el cluster de integración) |
| 9 | `.processGraph.js` | jerarquía y grafo de procesos |

---

## Lo que dice el re-escaneo (2026-08-06), y por qué importa para el cut #10

**Bajó de verdad lo que se atacó con el registro:**

| | Jul | Hoy |
|---|---:|---:|
| `update()` | **CC 218** | **CC 16** (−93 %) |
| `create()` | CC 163 | **CC 16** |
| `remove()` | — | bajo umbral |
| fichero `SqlAdminService.js` | CC 1 305 | **CC 153** |

**No bajó tanto a nivel de familia: 1 712 → 1 444 (−16 %)**, densidad 0,275 → 0,221 (−20 %). Parte de
la complejidad se **movió** en vez de desaparecer.

> **La conclusión de método que hay que retener** (corrige la lectura de §1 de la auditoría): no es
> que "el refactor mueva tamaño y no complejidad" en general — **depende de la técnica**.
> *Extract Class* mueve. ***Replace Conditional with Registry* simplifica** (218→16). Por eso el cut
> #10 es un registro y no otra extracción.

**Por qué se espera que el cut #10 reduzca de verdad:** la CC es **superlineal en anidamiento**. Los
`if` dentro de un `case` cuentan con recargo por estar a dos niveles; como funciones sueltas arrancan
de cero. El precedente medido es `create`+`update`: 381 → 224 contando los hooks (**−41 %**).
Extrapolando, un `switch` de CC 99 debería aterrizar en **55–65**. Es estimación por analogía — hay
que medirla al terminar, no darla por buena.

---

## Objetivos por complejidad, hoy

| CC | Dónde | Nota |
|---:|---|---|
| **158** | `SqlAdminService.templateLifecycle.js:966` → `saveTemplateArtifactDraft` | **Necesita caracterización ANTES.** Ver abajo. |
| **99** | `SqlAdminService.validation.js:52` → `validateTableRules` | ← **el cut #10**, red ya puesta |
| 75 | `user_controler.js:1868` → `createGeneralTask` | God #2; sin red propia |
| 67 | `frontend/.../useAdminSubmitFlow.js:30` | |
| 59 / 49 | `backend/config/postgres.js` | reescrituras de dialecto |
| 36 | `SqlAdminService.js:261` → `list()` | el motor de lectura, con sus 6 injertos |

### Sobre `saveTemplateArtifactDraft` (542 L, CC 158)

Se movió **literal** en el cut #8, **no descompuesto**, y el commit lo dice. Sonar mide exactamente
eso. Antes de partirlo hace falta su red, y ahí está la dificultad: su ruta es
`POST/PUT /admin/sql/template_artifacts/draft[/:id]`, **multipart con subida de ficheros**, y crea
objetos en MinIO. Un round-trip autolimpiante tendría que borrar también el artifact y su prefijo, o
vivir en un flow `zz_` que muta (como `zz_template_lifecycle`).

Está **verificado por smoke** en sus dos ramas (POST con PDF de referencia → 200 con el artifact en
MinIO; PUT con `isEdit` → 200), así que funciona; lo que no tiene es golden.

---

## Reglas NO negociables (lecciones acumuladas de los nueve cuts)

1. **Extraer por SCRIPT** (python), no a mano, y **verificando `count == 1`** antes de borrar cada
   bloque: "extracción literal" exige cero errores de transcripción.
2. **`node --check` valida SINTAXIS, no imports. Y verificar el ARRANQUE tampoco basta.** Un símbolo
   movido sin su `import` es sintaxis válida, el módulo **carga**, y revienta en tiempo de LLAMADA.
   Así vivieron rotos tres semanas cuatro `ReferenceError` de los cuts #2/#3/#6. Por eso existe
   **`npm run check:imports`** — **córrelo siempre después de mover código**.
3. **char verde ANTES y DESPUÉS, con los goldens IDÉNTICOS.** Si un golden cambia en un refactor puro,
   o rompiste algo o el test estaba mal. En un *fix* sí cambian — y entonces el diff del golden **es**
   la prueba del arreglo (patrón: fijar primero el comportamiento roto, luego arreglar).
4. **Round-trips autolimpiantes** (crear + borrar) para no mover los conteos `list_*`. La señal de que
   salió bien: el diff del golden es **puramente aditivo** (0 borrados).
5. **Preservar el ORDEN de los guards.** Los contratos de error caracterizados lo fijan. Ojo: el orden
   RELATIVO entre tablas distintas es irrelevante (las ramas son mutuamente excluyentes) — eso es lo
   que permite migrar tabla por tabla; pero el orden respecto al código COMPARTIDO sí es contrato.
6. **No inyectar casos especiales en el camino genérico** (es el olor de `AdminTableManager`).
7. **Commits pequeños**, en `develop`, diciendo qué se verificó. Y decir explícitamente **lo que NO se
   hizo** (ver el commit del cut #8).
8. El usuario tiene **commits propios intercalados en `develop`** (docs/skills) — normal, no colisionan.

---

## Comandos (todo dentro de los contenedores)

```bash
bash scripts/docker-env.sh dev exec -T backend npm run check:imports    # tras mover código
bash scripts/docker-env.sh dev exec -T backend npm run test:char:run    # 148 (compare)
bash scripts/docker-env.sh dev exec -T backend npm run test:char:capture # actualiza golden
bash scripts/docker-env.sh dev exec -T backend npm run test:unit        # 194

# arranque (imprescindible, regla 2)
bash scripts/docker-env.sh dev restart backend
bash scripts/docker-env.sh dev logs --tail 15 backend | grep -E "Servidor iniciado|SyntaxError|does not provide"
```

`test:char:run` **RESETEA la BD dev** (reset+bootstrap+seed): normal para char, deja el fixture sembrado.

### Sonar

```bash
docker compose -f scripts/sonar/compose.yml up -d          # :9002, tarda ~1 min en levantar
curl -s -u admin:admin -X POST "http://localhost:9002/api/user_tokens/generate" -d "name=deasy-<algo>"
SONAR_TOKEN=<token> bash scripts/sonar/scan.sh             # ~1,5 min
```

- Credenciales `admin`/`admin` (pendiente cambiarlas). Si la API empieza a devolver **401**, es el
  limitador de intentos por ráfaga de basic-auth, no un bloqueo: **usa el token** (`-u "$TOKEN:"`) o
  espera un poco.
- **El historial por FICHERO está purgado** (Sonar solo conserva el de proyecto). Para comparar con
  julio hay que usar los valores documentados en la auditoría + `git rev-list --count` para saber qué
  ficheros no se han tocado (su CC de hoy *es* la de entonces). Así se verificó el 1 712 → 1 444.
- **Las marcas manuales *won't fix* NO sobreviven a que el código cambie de fichero.** Al mover
  `PERSON_TOKEN_CHARS` su `S6418` se cerró y reapareció sin marcar, tumbando la nota de seguridad de
  D a E sin ningún defecto nuevo. **Revisa los BLOCKER tras cada refactor** antes de leer las notas.

---

## Referencias

- `docs/auditoria-god-objects-2026-07.md` — §1.b re-escaneo, §3.1 progreso de los nueve cuts,
  §3.1.b los dos defectos de producción hallados al revisar la deuda. **Actualízalo al cerrar el #10.**
- `backend/services/admin/SqlAdminService.tableHooks.js` — la cabecera explica el contrato de hooks
  y el `ctx`; es el modelo a seguir para el cut #10.
- `backend/errors/sqlErrors.js` — traducción de violaciones de restricción de PostgreSQL.
- Harness char: `backend/tests/characterization/` (`lib/snapshot.mjs`, `normalize.mjs`, `http.mjs`,
  `auth.mjs`; `config.mjs` con `FIXTURE` y usuarios).
- **Otro track, no lo mezcles**: `SIGUIENTE-SESION-fase5-y-X.md` es el refactor del FRONTEND.
