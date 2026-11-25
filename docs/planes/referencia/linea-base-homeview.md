# Línea base de HomeView — ANTES de refactorizar


> 📌 **Contrato observable — VIVO.** Es la red de regresión de `HomeView.vue` antes de partirlo: si
> algo de aquí cambia tras un refactor, es una regresión. Plan vigente:
> **[`docs/planes/referencia/calidad-y-medicion.md`](./calidad-y-medicion.md)**.
>
> ⚠️ El fichero medía 7 445 L cuando se escribió esto; hoy son **5 233 L**.

**Fecha:** 2026-07-14 · **Usuario:** persona 3 (`1122334455` / `Demo1234!`) · **Datos:** `backend/scripts/seed_dev_rich.mjs`

Recorrido en el navegador (Chrome DevTools), no a mano. Esto es el **contrato observable** de
HomeView.vue (7445 L) antes de partirlo: si algo de aquí cambia tras el refactor, es una regresión.

> ⚠️ **Los tests de characterization RESETEAN la base de dev.** Tras cualquier `test:char:run` o
> `test:char:fixture` hay que volver a correr `node scripts/seed_dev_rich.mjs`, o la persona 3 se
> queda con una sola unidad y la mitad de esto no se puede verificar.

---

## ✅ Verificado que FUNCIONA (no debe cambiar)

| # | Comportamiento |
|---|---|
| 1 | **Aside**: unidad → cargo → procesos. El "Proceso por defecto" se muestra como **"Tareas"** |
| 2 | **"Mis procesos"**: pestañas **por unidad** (Sistemas / Tecnologías) |
| 3 | **Encabezados de grupo** por proceso: aparecen con 2+ procesos, **no** con uno solo |
| 4 | **Colapsar/expandir todo** a nivel de proceso |
| 5 | **Modal de detalle** con 4 pestañas: GENERAL / ENTREGA / FIRMAS / ANEXOS |
| 6 | **ENTREGA**: muestra la secuencia del flujo (paso, responsable, estado) |
| 7 | **Observaciones**: añadir y **marcar resuelta** (payload `{message, phase:"review"}`) |
| 8 | **Iniciar** un entregable pendiente → modal de confirmación y la tarjeta pasa a **"Subir archivo" / "Descargar plantilla"** |
| 9 | **IDOR cerrado** (commit `895b6ef`): el panel entrega **solo los entregables propios** (antes 9, ahora 1); Centro Documental 18 → 4 |

## ✅ Bugs B1–B4: TODOS CERRADOS (antes de refactorizar)

| | Bug | Estado |
|---|---|---|
| **B1** | Excepciones de negocio como 500 | ✅ `da542ac` — `errors/HttpError.js`; 404/403/409 correctos |
| **B2** | La pestaña FIRMAS mentía | ✅ `638eec1` — texto corregido |
| **B3** | Aside fijo en la primera unidad | ✅ `638eec1` — selector de unidad restaurado |
| **B4** | Tarjeta con "Iniciar" ya iniciada | ✅ **falsa alarma**: era el usuario probando en su propia sesión |
| **B5** | El aside **flotaba sobre** el contenido y lo hacía inaccesible | ✅ `be2867f` — ahora es una columna que **desplaza** el contenido |
| **B6** | `IconInfoCircle` usado sin importar en `MultiSignerPanel` | ✅ `b5c6fbf` — Vue no podía resolver el componente |

Detalle histórico de cada uno, abajo.

## 🔴 Bugs encontrados (PRE-EXISTENTES, no los causó el refactor)

### B1 — Re-iniciar un entregable ya iniciado devuelve **500**
```
POST /sign/fill-requests/18/start   (ya está in_progress)
-> HTTP 500  {"error":"La solicitud no puede pasar de in_progress usando la acción start."}
```
Debería ser **409 Conflict** (o 400), no un error de servidor con el mensaje interno en crudo.
**Misma familia de defecto** que los endpoints de lanzamiento (`/launch-info`, `/launch-status`,
`/generate-tasks` devuelven 500 ante "no encontrado" en vez de 404) y que el guard de autorización
(*"No puedes operar una solicitud asignada a otro usuario"* también sale como 500 en vez de 403).
**Es un patrón sistémico: las excepciones de negocio caen en el catch genérico.**
**→ CORREGIDO** en `da542ac`: `errors/HttpError.js` formaliza la convención (que ya existía a
medias en `sql_admin_controller`) y los controllers respetan `error.statusCode`. Un error SIN
statusCode sigue siendo 500 — y eso está bien: significa que es un fallo de verdad.

### B2 — La pestaña FIRMAS miente cuando el flujo aún no se ha instanciado
Dice *"La configuración todavía no tiene pasos de firma visibles"* — pero la configuración **sí** los
tiene (verificado en BD: `signature_flow_steps` con `cargo_in_scope` → Coordinador). Lo que no existe
todavía es la **instancia**, que se crea al completarse la entrega. El texto confunde una cosa con la
otra: debería previsualizar los pasos configurados ("se firmará por: Coordinador").

### B3 — El aside se queda fijo en la primera unidad
Ya diagnosticado: `loadUserMenu()` hace `selectUnitOption(userUnits[0])` y **no hay forma de cambiar de
unidad** (el control se borró del template; su lógica quedó muerta y se limpió en `963aa3b`). Con 2+
unidades, los procesos de la segunda son **inalcanzables desde el aside**. La salida es la página
consolidada, si el usuario sabe que existe. → **Va con el rediseño del aside, después del refactor.**

### B4 — Estado obsoleto de la tarjeta → ✅ FALSA ALARMA
Encontré un entregable con la tarjeta ofreciendo **"Iniciar"** mientras en BD ya estaba `in_progress`
(`user_started_at` puesto). Al pulsarlo → el 500 de B1.
No conseguí determinar qué lo inició — y resultó que **era el propio usuario probando en su sesión del
navegador**, en paralelo a la mía. No es un bug. Se deja anotado como recordatorio de que en un entorno
de dev compartido, el estado puede cambiar por debajo. Cuando la tarjeta se inicia por la vía normal, la
UI **sí** actualiza el botón correctamente (verificado).

## 🔶 No es un bug (falsa alarma retirada)

**"Descargar plantilla" da 404.** Es una limitación de la fixture, no del código: el artefacto solo
tiene formato `jinja2`, que está **excluido a propósito** de las descargas (es el código fuente de la
plantilla). No hay PDF/DOCX generado que servir. Pasaría igual con la plantilla original del bootstrap.

## ✅ Cadena completa entrega → firma (verificada end-to-end)

| # | Comportamiento | Evidencia |
|---|---|---|
| 10 | **Subir un PDF real** | Objeto en MinIO con la ruta canónica `9/PROCESOS/2/ANIOS/1900/.../v0001/working/pdf/...` — la que construyen `buildCanonicalDocumentVersionBasePath` + `buildWorkingObjectPathForUpload`, **las primitivas extraídas en M1** |
| 11 | **Enviar** (completar la entrega) | *"El envío del entregable se completó correctamente"*; la tarjeta pasa a "Descargar PDF"/"Ver PDF" |
| 12 | **El flujo de firma se materializa al enviar** | Documento → "Pendiente de firma"; 1 instancia + 1 solicitud |
| 13 | **El firmante se resuelve por la regla** | La solicitud llega a **Coordinador E055**, resuelto por `cargo_in_scope` → Coordinador. Confirma que B2 era solo un texto engañoso: la config **sí** tenía pasos |
| 14 | **Centro de firmas del firmante** | "1 firma(s) pendiente(s)"; la bandeja lista el documento con proceso/unidad/periodo/paso correctos |
| 15 | **Subida de certificado .p12** | Certificado autofirmado cargado y listado |
| 16 | **Multifirmador** | Abre y renderiza **el PDF subido** ("Informe de Gestión Docente"), 1 documento en cola |

**Nota de alcance:** la firma criptográfica final (`Firmar lote masivo`) no llegó a ejecutarse — requiere
colocar campos de firma y depende del microservicio Python + RabbitMQ. Eso es territorio de
`FirmarPdf.vue` (2939 L), **otro God Object con su propio refactor**, no de HomeView. La cadena que
alimenta HomeView está verificada hasta la bandeja del firmante.

**El Coordinador NO ve el entregable en el panel del proceso** (0 tareas): no está asignado a la
*tarea*, solo es firmante del *entregable*. Su vía es el Centro de firmas, y ahí sí aparece. Es el
comportamiento de `getUserAccessibleTasksForDefinition` (nivel tarea), que **no** se tocó en el fix del
IDOR.

## ⬜ Sin verificar

Flujo *routed* completo (flow-builder, destinatarios, envío) · bandejas "Mis envíos" / "Recibidos" ·
firma criptográfica real.
