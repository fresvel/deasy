# Handoff — `saveTemplateArtifactDraft`: la red primero, el corte después

> Copia el bloque "PROMPT" como primer mensaje de una sesión nueva. Todo lo necesario está aquí o en
> `docs/auditoria-god-objects-2026-07.md` (§3.1 cuts #1–#9, el cut #10 y §3.1.b los dos defectos).
>
> Estado: `develop @039ecfb`, árbol limpio. God Object #1 CERRADO. Cut #10 CERRADO.

---

## PROMPT (pégalo como primer mensaje)

```
Continúo bajando la complejidad del backend de Deasy. Diez cuts cerraron el God Object #1
(SqlAdminService.js: 5924 -> 897 L) y el cut #10 convirtió `validateTableRules` de un switch
CC 99 en un registro: su S3776 cerró como FIXED.

Queda un solo objetivo grande y es el peor del backend por un factor de dos:
`saveTemplateArtifactDraft` (backend/services/admin/SqlAdminService.templateLifecycle.js:966),
541 líneas y CC 158. Se movió LITERAL en el cut #8 y el commit lo dijo; Sonar mide exactamente eso.

Lee primero docs/auditoria-god-objects-2026-07.md (§1.b y el cut #10) y luego este handoff.

LA DIFICULTAD NO ES PARTIRLO, ES LA RED. Su ruta es multipart con subida de ficheros, escribe en
cinco sitios (incluido MinIO) y NO tiene golden. Además el harness de caracterización no sabe
mandar multipart: `lib/http.mjs` fuerza Content-Type: application/json en toda petición.

Por eso el trabajo va en dos fases, y la FASE 1 es la entrega de verdad:
  FASE 1  multipart en el harness + un flow `zz_artifact_draft` autolimpiante que fije las dos
          ramas (POST crear / PUT editar) y sus contratos de error. SIN tocar el servicio.
  FASE 2  descomponer la función, con la fase 1 en verde y los goldens IDÉNTICOS.

Empieza por la FASE 1. Antes de escribir código MIDE el estado real y proponme el plan.
```

---

## Por qué esta función y no otra

Tras el cut #10, el top de complejidad del backend (Sonar `@9e91711`):

| CC | Dónde |
|---:|---|
| **158** | `SqlAdminService.templateLifecycle.js:966` → `saveTemplateArtifactDraft` |
| 75 | `controllers/users/user_controler.js:1868` → `createGeneralTask` (God #2) |
| 59 / 49 | `backend/config/postgres.js:111` / `:47` — reescrituras de dialecto |
| 36 | `SqlAdminService.js:261` → `list()` |

Tiene **el doble** que la siguiente. Y en su propio fichero hay dos más pequeñas del mismo cluster
(`:508` CC 18, `:643` CC 23) que probablemente caigan de rebote.

---

## Anatomía: 541 L en ocho fases

Se lee de arriba abajo y las fronteras son limpias — es un *Compose Method* de manual, no una maraña.

| # | Líneas | Qué hace |
|---|---|---|
| 1 | 969–1050 | **Validación de entrada.** displayName, cédula, `isEdit`, guard de inmutabilidad (solo se edita en borrador), proceso obligatorio, semilla por defecto, documento de referencia obligatorio, flujo de entrega obligatorio salvo `routed` |
| 2 | 1052–1078 | **Resolución del propietario** (`ownerRef` / `ownerPersonId`) |
| 3 | 1079–1102 | **Identidad y rutas**: `templateCode`, `storageVersion`, `baseObjectPrefix`, `draftDir` temporal |
| 4 | 1105–1163 | **Materialización de la semilla** en `draftDir` (descarga de MinIO, rama LaTeX, preservación de formatos existentes) |
| 5 | 1170–1203 | **Escritura de los ficheros subidos** y cálculo de `availableFormats` |
| 6 | 1209–1240 | **Parseo** de `schema_fields`, meta y los dos workflows (JSON que puede venir como string) |
| 7 | 1249–1310 | **Validación de los flujos personalizados**: cargos, ámbito del proceso, `workflowErrors`, avisos de autoría |
| 8 | 1311–1505 | **Escritura**: meta.yaml + manifiesto, upload a MinIO, INSERT/UPDATE, vínculo a proceso, sync de flujos, y la compensación del `catch` |

---

## Lo que ESCRIBE (esto define la limpieza del round-trip)

Rama de creación, en orden:

1. `deliverables` — INSERT, **o reutiliza** la fila existente con el mismo `code`
2. `template_artifacts` — INSERT (`lifecycle_state = 'draft'`)
3. `process_definition_templates` — INSERT del vínculo (o UPDATE del `item_mode` si ya existía)
4. plantillas y pasos de flujo fill/firma, vía `_syncArtifactWorkflowsForTemplateArtifactId`
5. **objetos en MinIO** bajo `baseObjectPrefix`, y un directorio temporal en `BACKEND_STORAGE_ROOT`
   (este sí se borra siempre, en el `finally`)

### Tres cosas que hay que saber antes de diseñar el test

**`templateCode` es determinista**: `draft_<slugify(display_name)>`. Dos corridas con el mismo
`display_name` reutilizan la MISMA fila de `deliverables` (se busca por `code`), pero
`_getNextStorageVersionForTemplateCode` **sube la versión** en cada corrida — así que el
`baseObjectPrefix` cambia (`.../draft_x/1.0.0/`, `1.1.0/`…). Sin limpieza completa, cada corrida deja
un artifact más y un prefijo más en MinIO, y cualquier golden que capture la versión deriva.

**No hay transacción de base de datos.** El bloque de la fase 8 usa `this.pool.query` directo, no
`runInTransaction`. El `try/catch` es compensación manual, no atomicidad.

**La compensación está incompleta — verifícalo antes de tocar nada.** El `catch` de creación borra
la fila de `template_artifacts` y el prefijo de MinIO, pero **no** el `deliverables` que acaba de
insertar, ni el vínculo, ni los flujos sincronizados. Si falla después del INSERT del deliverable —
p. ej. por "El proceso destino seleccionado no existe." — queda un `deliverables` huérfano que la
siguiente corrida reutilizará por `code`. **No lo doy por defecto confirmado: pruébalo.** Si lo es,
el patrón de §3.1.b aplica — fijar primero el comportamiento roto con un golden, y luego arreglarlo,
de modo que el diff del golden **sea** la prueba del arreglo.

---

## Fase 1 — la red (la entrega de esta sesión)

### 1.a Multipart en el harness

`backend/tests/characterization/lib/http.mjs` pone `Content-Type: application/json` en cuanto hay
`body`. Hace falta una vía nueva que mande `FormData`. Node 18+ ya trae `FormData`, `Blob` y `File`
nativos y `fetch` los serializa solo.

> **La trampa**: NO pongas `Content-Type` a mano cuando el body es `FormData`. Si lo haces, falta el
> `boundary` y multer rechaza la petición. Hay que dejar que `fetch` lo ponga.

Toca añadir una opción (`form`) que conviva con la actual sin cambiar el comportamiento de las 148
pruebas que ya pasan — `request()` debe seguir haciendo exactamente lo mismo cuando recibe `body`.

### 1.b El flow `zz_artifact_draft`

**Prefijo `zz_` obligatorio.** Los flows corren en orden alfabético con `--test-concurrency=1`
(`npm run test:char`) y este MUTA la base. `zz_template_lifecycle` existe por lo mismo; ordénalos
entre ellos con cuidado (`artifact` < `task` < `template`, así que `zz_artifact_draft` correría
ANTES que los otros dos — decide si eso te conviene o si necesitas otro nombre).

Rutas y permisos:

```
POST /admin/sql/template_artifacts/draft        templates:create
PUT  /admin/sql/template_artifacts/draft/:id    templates:update
```

Ambas con `draftArtifactUpload.fields([pdf_file, docx_file, xlsx_file, pptx_file])`, `maxCount 1`
cada una (`backend/routes/sql_admin_router.js:98-119`).

Qué fijar, como mínimo:

- **POST feliz** con un PDF de referencia y un `fill_workflow` de un paso → 200, y el contrato de la
  respuesta (`id`, `template_code`, `storage_version`, `available_formats`, `content_hash`,
  `__notice`). Enmascara ids y hashes: `content_hash` cambia si cambia el contenido, y el
  `storage_version` depende de cuántas veces se haya corrido.
- **PUT feliz** (`isEdit`) sobre ese borrador → 200.
- Los **contratos de error** de la fase 1, que son baratos y cubren la mitad de las ramas: sin
  nombre, sin proceso, sin documento de referencia, sin paso de flujo (y que `routed` **no** lo
  exige), y el guard de inmutabilidad sobre una plantilla publicada.
- **Limpieza al final**: borra flujos → vínculo → artifact → deliverable → prefijo de MinIO. El
  propio `catch` de la función (L1491-1502) es la receta de referencia, pero **le falta el
  deliverable**. La señal de que salió bien es la de siempre: el diff del golden es **puramente
  aditivo**, 0 borrados, y los conteos `list_*` de `admin_crud` no se mueven.

> El `DELETE` genérico del CRUD borra la fila de `template_artifacts` pero **no toca MinIO**
> (`template_artifacts` no tiene `beforeRemove` en `tableHooks.js`). La limpieza del prefijo hay que
> hacerla por otra vía; decide cuál y déjalo dicho en el commit.

Ya hay smoke verificado de las dos ramas (POST con PDF → 200 con el artifact en MinIO; PUT con
`isEdit` → 200), así que **la función funciona**: si tu primer intento da error, sospecha del test
antes que del servicio.

---

## Fase 2 — el corte (solo con la fase 1 en verde)

Las ocho fases de arriba son las candidatas naturales a *Extract Method*. Dos avisos:

- **No es un registro.** El cut #10 dejó claro que *Replace Conditional with Registry* simplifica y
  *Extract* mueve. Aquí no hay despacho por clave que registrar: es una secuencia. Espera que la
  complejidad **baje menos en proporción** que en el cut #10 y no te engañes con la analogía.
- Lo que sí baja de verdad es el anidamiento: buena parte de los 158 son `if` a dos y tres niveles
  dentro del `try` gigante. Como funciones sueltas arrancan de cero.

Las fases 1–3 son puras o casi (validación, resolución de propietario, cálculo de rutas): salen
primero, son testeables sin pool y no tocan MinIO. La fase 8 es la que hay que dejar para el final.

---

## Reglas NO negociables (lecciones acumuladas de los diez cuts)

1. **Extraer por SCRIPT** (python), no a mano, y **verificando `count == 1`** antes de borrar cada
   bloque. Si el script trocea código, dale un **invariante de reconstrucción** (que las piezas
   reproduzcan el original línea a línea): en el cut #10 eso cazó un troceador que contaba llaves
   pero no paréntesis y partía un `if` multilínea por la mitad.
2. **`node --check` valida SINTAXIS, no imports. Y verificar el ARRANQUE tampoco basta.** Un símbolo
   movido sin su `import` es sintaxis válida, el módulo **carga**, y revienta en tiempo de LLAMADA.
   Así vivieron rotos tres semanas cuatro `ReferenceError` de los cuts #2/#3/#6. Por eso existe
   **`npm run check:imports`** — **córrelo siempre después de mover código**.
3. **char verde ANTES y DESPUÉS, con los goldens IDÉNTICOS.** Si un golden cambia en un refactor puro,
   o rompiste algo o el test estaba mal. En un *fix* sí cambian — y entonces el diff del golden **es**
   la prueba del arreglo.
4. **Round-trips autolimpiantes**, para no mover los conteos `list_*`.
5. **Preservar el ORDEN de los guards**: los contratos de error caracterizados lo fijan.
6. **La red unitaria ve lo que char no ve.** En el cut #10 dos validaciones de fecha quedaron mudas
   por un helper sin generalizar; char pasó igual, porque ninguna ruta caracterizada mandaba
   vigencias invertidas. Si extraes una función pura, ponle su unit test.
7. **No inyectar casos especiales en el camino genérico.**
8. **Commits pequeños**, en `develop`, diciendo qué se verificó y **lo que NO se hizo**.
9. El usuario tiene **commits propios intercalados en `develop`** (docs/skills) — normal.

---

## Comandos (todo dentro de los contenedores)

```bash
bash scripts/docker-env.sh dev exec -T backend npm run check:imports     # tras mover código
bash scripts/docker-env.sh dev exec -T backend npm run test:char:run     # 148 (compare)
bash scripts/docker-env.sh dev exec -T backend npm run test:char:capture # actualiza golden
bash scripts/docker-env.sh dev exec -T backend npm run test:unit         # 209

# arranque (imprescindible, regla 2)
bash scripts/docker-env.sh dev restart backend
bash scripts/docker-env.sh dev logs --tail 15 backend | grep -E "Servidor iniciado|SyntaxError|does not provide"
```

`test:char:run` **RESETEA la BD dev** (reset+bootstrap+seed): normal para char, deja el fixture sembrado.

### Sonar — LEE ESTO ANTES DE INTENTARLO

```bash
docker compose -f scripts/sonar/compose.yml up -d          # :9002, ~30 s en levantar
SONAR_TOKEN=<token> bash scripts/sonar/scan.sh             # ~1,5 min
```

- **`admin:admin` NO funciona por basic-auth**: SonarQube 26 lo retiró de la API. La contraseña se
  reseteó por base de datos el 2026-08-06 y **hoy es `admin`** otra vez.
- **Los tokens se sacan por sesión**, no por basic-auth:
  ```bash
  curl -s -c cj.txt -X POST "http://localhost:9002/api/authentication/login" -d "login=admin&password=admin"
  XSRF=$(grep XSRF-TOKEN cj.txt | awk '{print $7}')
  curl -s -b cj.txt -H "X-XSRF-TOKEN: $XSRF" -X POST "http://localhost:9002/api/user_tokens/generate" -d "name=x"
  ```
  Con el token ya vale `-u "$TOKEN:"` en el resto de llamadas.
- Si hay que volver a resetear la contraseña: **el snippet canónico que circula por internet NO vale
  en esta versión**. El hash es PBKDF2-HMAC-SHA512, 100 000 iteraciones, 64 bytes, con el salt
  **base64-DECODIFICADO a bytes** (no el string), y `crypted_password = "100000$<base64>"`.
- **El historial por FICHERO está purgado** (Sonar solo conserva el de proyecto). Para comparar hay
  que usar los valores documentados en la auditoría.
- **Las marcas manuales *won't fix* NO sobreviven a que el código cambie de fichero.** Revisa los
  BLOCKER tras cada refactor antes de leer las notas. Baseline hoy: **0 BLOCKER**, 46
  vulnerabilidades, fiabilidad C / seguridad D, complejidad cognitiva del proyecto **8 781**.

---

## Referencias

- `docs/auditoria-god-objects-2026-07.md` — §1.b re-escaneo, §3.1 los diez cuts, §3.1.b los dos
  defectos de producción. **Actualízalo al cerrar esto.**
- `backend/tests/characterization/flows/zz_template_lifecycle.test.mjs` — el precedente más cercano:
  flow `zz_` que muta, con estado compartido entre pasos. Es el modelo a seguir.
- Harness char: `backend/tests/characterization/` (`lib/http.mjs` ← el que hay que tocar,
  `lib/snapshot.mjs`, `normalize.mjs`, `auth.mjs`; `config.mjs` con `FIXTURE` y usuarios).
- `backend/services/admin/SqlAdminService.tableHooks.js` — contrato de hooks del CRUD.
- `backend/services/admin/SqlAdminService.validation.js` — el registro del cut #10, por si sirve de
  modelo de "condicional a datos".
- **Otro track, no lo mezcles**: `SIGUIENTE-SESION-fase5-y-X.md` es el refactor del FRONTEND.
