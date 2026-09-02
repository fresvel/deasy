# Inventario de código muerto — 2026-09-02

> Insumo de la tarea **L10** del [frente 17](./lopdp-consentimiento-2026-09.md). Es un **inventario**,
> no una lista de tareas: nada de lo de aquí se borra sin mirarlo.

**Método:** para cada candidato se buscó el símbolo en todo el árbol (`backend/`, `frontend/src`,
`channels/src`, `docs/`, `scripts/`, `docker/`). **Confianza ALTA sólo si se comprobó que nadie lo
referencia**, y con qué búsqueda. Un test **cuenta** como referencia: donde lo único que usa un
símbolo es su prueba, se dice así.

---

## §1 · Lo que sobra, con confianza ALTA

| Qué | Dónde | Cómo se comprobó | Riesgo |
|---|---|---|---|
| `deleteFile` (fichero entero) | `backend/utils/files.js` | 0 apariciones fuera de su definición; `utils/files` no se importa. **Y está roto**: `fs.unlinkSync(path, cb)` no acepta callback | Nulo |
| Controlador `verifyEmail` | `backend/controllers/users/verify_email.js` | Ningún router lo importa. Lo sustituyó `POST /users/me/verificacion/correo` en `C8`; el propio `user_router.js:135-138` documenta la retirada | Nulo |
| `frontend/public/terms.md` | fichero | Único lector: `fetch("/terms.md")` en `TermsView.vue`. Su contenido está **duplicado** como semilla `terminos_de_uso` v1 en `postgres_schema.sql` | Bajo |
| `TermsView.vue` + ruta `/terminos` | vista + `core/router/index.js` | **Sin un solo enlace entrante.** El que había (`/register?terms=accepted`) se quitó a propósito. Superado por `DocumentoLegalModal.vue`. Lo único que lo referencia es **su propio test** | **Medio** — sigue alcanzable tecleando la URL, y **tres documentos la describen como ruta pública** |
| `canAccessManagement` | `frontend/src/core/utils/accessControl.js:168` | 1 aparición en todo el repo: su definición | Nulo |
| `resolveWorkspaceCargoIcon` · `resolveWorkspaceUnitGroupIcon` | `frontend/src/shared/utils/workspaceNavIcons.js` | 1 aparición cada una. Existe `workspaceNavIcons.test.js` y **no las cubre** | Nulo |
| `getPostgresDatabaseName` | `backend/config/postgres.js:523` | 1 aparición | Nulo |
| `collectSignatureWorkflowNormalizationIssues` | `backend/services/admin/templates/workflows.js:414` | 0 importadores, y sus vecinos sí se usan dentro del módulo | Bajo |
| Rótulo huérfano del SMS | `docker/.env.dev.runtime:21-22` · `.example:28-29` | Cabecera de sección + comentario de `SMS_NUMERO`, **pero la variable ya no está**. Y dice *«C6, bloqueada»*, que es el estado **anterior** al descarte | Nulo |
| `channels/README.md:4` | *«WhatsApp y un receptor de SMS»* | Contradice el descarte del 2026-09-01. No hay dependencia ni módulo de SMS | Nulo |
| `FRONTEND_PORT` | los cuatro `.env*` | **La única variable que nadie lee**, barridas las 100+ contra todo el árbol. Los compose usan `frontend:8080` fijo | Nulo |
| `backend/scripts/migrate_storage_keys.mjs` | fichero | Migración de un solo uso (2026-08-27). No está en `package.json`, ni en CI, ni en docs | Bajo |
| `frontend/scripts/clases-gemelas.mjs` | fichero | **El único** `.mjs` de esa carpeta que no está en ningún script de `package.json`; los otros 27 sí. Su fase (F11) cerró el 2026-08-20 | Bajo — se pierde el instrumento de medición |
| `GET /admin/sql/positions/:id/immediate-boss` | `sql_admin_router.js:103` | Sin cliente y **sin test** | Medio — la cadena es larga |
| `channels/backend/` | directorio vacío sin seguimiento | No está en `git ls-files` ni en `.gitignore` | Nulo |

### Vivas, pero sólo para su test

`GET /admin/sql/task-items/stuck` y `POST …/reconcile-assignments` (`sql_admin_router.js:97-98`) no
tienen cliente en el frontend —el panel usa otra ruta—, y **lo único que las ejerce son dos pruebas
de caracterización**. Borrarlas mueve dos goldens. Decisión aparte.

### Sólo sobra el `export`, el código está VIVO

Veintitantos símbolos exportados con uso **dentro de su propio módulo** y cero importadores fuera:
`TRACEABILITY_TABLES`, `PROCESS_WIZARD_STEPS`, `etiquetaCorrida`, `SQL_TABLES`, `rewriteDialect`,
`TABLE_HOOKS`, `mapMessage`, `transitionDocumentState`, `resolvePersonId`, `PG_UNIQUE_VIOLATION`…
No se borran: se les quita el `export`.

---

## §2 · ⛔ Parece muerto y NO lo está

| Qué | Por qué no se toca |
|---|---|
| `case "document_owner"` del motor de firmas | **Defecto 1.19.** Salió del `CHECK`, pero el JSONB `signature_flow_steps.signers` todavía puede traerlo; borrarlo deja pasos **sin firmante, en silencio**. `assignees.test.js` existe para custodiarlo |
| Las **lápidas** del SMS en los seis `.env`, en `Canal.js` y en el esquema | Son comentarios deliberados de *«no lo reintroduzcas»*, con su cita y su DOI. **Cumplen su función precisamente por seguir ahí** |
| Claves «huérfanas» de `estadoTono.js` | El diccionario se indexa por `tabla.columna` **construido en ejecución** con valores que vienen de la base. Una clave sin acierto puede ser un estado que hoy no está en los datos de prueba |
| `backend/config/rbacCatalog.js` | Los permisos se resuelven por concatenación `recurso.acción` y **se siembran en la base**. Un `grep` textual no prueba nada |
| `channels/.wwebjs_auth/` y el volumen | Ahí vive la sesión de WhatsApp. Borrarlo deja el canal caído hasta que alguien escanee un QR **con el teléfono en la mano** |
| `docs/docs-md-antiguos/` | Archivo histórico deliberado; `docs-links.yml` lo excluye de lychee **a propósito** |
| `scripts/css-modularizar.mjs` | Un solo uso, pero el plan maestro dice literal *«archivar el script, conservar el comentario»*: su cabecera documenta por qué el orden de `index.css` es el que es |
| `docs/legal/BORRADOR-*.md` | **Pendientes de revisión jurídica.** Dejarán de vivir ahí cuando se aprueben, no antes |

---

## §3 · Tres cosas que yo daba por ciertas y **estaban mal**

1. ⚠️ **`storage-init` NO es configuración muerta.** Yo afirmé *«nada lo lanza, lo comprobé»*. Es un
   **perfil manual documentado** en `docs/07-despliegue/COMANDOS_PROYECTO.md:292`. Mi búsqueda cubrió
   `scripts/` y `docker/` y **no miré la documentación de despliegue**. Que un perfil de compose se
   lance a mano es para lo que existen los perfiles.
   *(El riesgo de fondo sigue en pie: como sólo corre a mano, el bucket legal podría acabar creándolo
   el código sin bloqueo. Pero eso se ataja en el arranque del backend, no forzando el bootstrap.)*

2. **Del «sello» no quedó nada en el código.** `pepper` → 0 aciertos. `verificaciones_historicas` →
   **0**, no existe en el esquema. Ningún `*_HMAC` en los `.env`. Lo único que quedó es
   `docs/arquitecturas/evidencia-de-verificacion.md`, **huérfano de enlaces** — y ése **se conserva**:
   es el archivo de una decisión, no basura.

3. **No hay i18n en el frontend.** 0 aciertos de `$t(`. No había claves huérfanas que buscar.

---

## §4 · Documentos de diseño sin indexar

Tres ficheros de `docs/arquitecturas/` tienen **cero enlaces entrantes**, frente a los 13 vecinos que
tienen entre 1 y 9: `evidencia-de-verificacion.md`, `vigilante-de-canales.md` y
`roles-permisos-qa-demo.md`. **No sobran: falta indexarlos.**
