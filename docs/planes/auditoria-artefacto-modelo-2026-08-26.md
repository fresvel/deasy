# Auditoría del artefacto «Del proceso al documento firmado» contra el código — 2026-08-26

> **Qué es esto.** El artefacto `b51be421` se publicó como la sección
> [`/modelo/`](/modelo/) del sitio, pero **no se trasladó: se reescribió**. Medido con cobertura
> de bigramas párrafo a párrafo: **95 de 95 párrafos por debajo del 50 %**.
>
> El dueño eligió no restaurar el texto original, sino **auditar afirmación por afirmación** que
> nada se haya perdido — y con una regla que manda sobre todo lo demás:
>
> ⚠️ **Cada afirmación se contrasta contra el CÓDIGO.** No contra el artefacto, no contra las
> páginas, no contra `docs/planes/`. El artefacto puede mentir, y en esta auditoría ya se
> comprobó que las páginas aciertan donde él falla y al revés.
>
> **Inventario:** 126 unidades de texto en 18 secciones.

## Cómo se lee la tabla

| Veredicto | Significa |
|---|---|
| **OK** | La afirmación es cierta en el código Y está dicha en las páginas |
| **CORRIGE** | Las páginas ya corregían al artefacto. Se conserva la corrección |
| **FALSO** | La afirmación es falsa en el código. Hay que arreglarla donde esté |
| **FALTA** | Es cierta pero no está en ninguna página. Hay que añadirla |

---

## Las afirmaciones con cifra o garantía, una por una

| # | Afirmación del artefacto | Contra el código | Veredicto |
|---|---|---|---|
| 001 | «Treinta y ocho tablas» | El diagrama de `mapa-completo` dibuja **38** tablas reales del esquema. La cadena entera son **40**: las 38 más `relation_unit_types` y `role_assignments`, que se nombran en prosa pero no se dibujan | **OK** |
| 021 | «Solo una ocupación vigente por silla, y lo impone la base» | `position_assignments.current_flag` (generada) + `uq_position_current (position_id, current_flag)` | **OK** |
| 022 | «Deasy usa **cuatro veces** el mismo truco» | **Diez.** Nueve de la variante bandera —`uq_unit_head`, `uq_position_current`, `uq_one_open_vacancy_per_position`, `uq_one_selected_per_vacancy`, `uq_one_active_offer_per_application`, `uq_role_assignment_current`, `uq_process_definition_one_active_series`, `uq_task_items_defined_target`, `uq_task_item_tenure_current`— más `uq_tasks_definition_term_scope`, que usa `normalized_scope_unit_id` (`COALESCE`, nunca nula) | **CORRIGE** — `organizacion.md` ya dice «nueve, no cuatro» y separa la décima por ser de otra variante. Es exacto |
| 026 | «Una sola configuración activa por proceso y variación, garantizado por índice» | `active_series_flag` + `uq_process_definition_one_active_series (process_id, variation_key, active_series_flag)` | **OK** |
| 044 | «De los **siete** índices de unicidad de este tipo, ninguno cubre las ediciones» | Son **diez**, no siete. Pero la segunda mitad es cierta: `template_artifacts` solo tiene `CHECK (lifecycle_state IN ('draft','published','retired'))`, un `uq_template_artifacts_storage (deliverable_id, storage_version)` y dos índices no únicos. **Sin columna generada y sin trigger** | **CORRIGE** — `entregable-y-ediciones.md` no repite el «siete» y además nombra al responsable real: `retirePriorPublishedSiblings()` en `services/admin/templates/templateArtifact.js` |
| 060 | «La silla responsable es obligatoria; si no hay a quién dirigirse, el entregable no se crea» | `task_items.responsible_position_id INT NOT NULL` + `fk_task_items_responsible_position` | **OK** — `entregable-concreto.md:16` lo dice |
| 064 | «`assigned_person_id` es una caché, la escribe el sistema» | `assigned_person_id INT NULL`, y el escritor es `trg_task_item_tenures_sync` (`postgres_schema.sql:1858`) | **OK** |
| 066 | «Las columnas `_key` son generadas, no copias» | `process_definition_template_key` y `responsible_position_key`, ambas `GENERATED ALWAYS AS (CASE WHEN origin_kind = 'process_defined' …)`, sosteniendo `uq_task_items_defined_target` | **OK** |
| 068 | «Un solo turno abierto por entregable, garantizado por la base» | `current_flag` + `uq_task_item_tenure_current (task_item_id, current_flag)` | **OK** |
| 069‑074 | Lista **cinco** causas de turno: `original`, `occupancy_start`, `occupancy_end`, `reconcile`, `manual` | El `CHECK` tiene **seis**. Falta **`position_deactivated`** | **CORRIGE** — `tenencias-y-relevo.md` y `vocabularios-de-estado.md` listan las seis |
| 080 | «La etiqueta la calcula la base sola» | `version_label TEXT GENERATED ALWAYS AS (version::text \|\| '.' \|\| version_minor::text)` | **OK** |
| 095 | «El ámbito puede ser unidad exacta, subárbol, tipo, todas, o la del propio documento» | Cierto **para los pasos de flujo**: `fill_flow_steps` y `signature_flow_steps` admiten los cinco, con `context_exact`. Ojo, `process_target_rules.unit_scope_type` solo admite **cuatro** — no lleva `context_exact` | **OK**, con el matiz de las dos listas |
| 096 | «Persona concreta solo en entregables personales» | El `CHECK` admite los tres (`task_assignee`, `specific_person`, `cargo_in_scope`) en ambos flujos: **la restricción a lo oficial es del código, no de la base** | **OK** |
| 101‑102 | Lista **dos** modos de aprobación: `or` y `at_least` | El `CHECK` tiene **tres**: `and`, `or`, `at_least` — y **`and` es el valor por defecto**, justo el que se omite | **CORRIGE** — `flujo-de-firma.md:37` lista los tres y marca `and` como el predeterminado |
| 108 | «Dos catálogos de firma, en tablas propias» | `signature_statuses` y `signature_request_statuses`, ambas sembradas en el esquema (`:1077` y `:1088`) | **OK** |
| 117 | «Once estados del documento» | `DOCUMENT_STATUSES` tiene exactamente **11**. Y `DOCUMENT_VERSION_STATUSES`, **12** — son listas distintas | **OK** — `vocabularios-de-estado.md` distingue las dos |
| 123 | «**382 columnas y 147 referencias**» | Consultado el catálogo vivo: las 38 tablas del mapa tienen **375 columnas y 97 claves foráneas**. Las **147** son las del **esquema entero** (67 tablas), no las de la cadena. Y 382 = 375 + las 7 de `relation_unit_types`, o sea **39 tablas**: el artefacto mezcla dos alcances en la misma frase | **FALSO** — corregido en `index.md`, ahora con una tabla que dice el alcance de cada cifra |
| 124 | «33 restricciones declaradas en la base» | `SELECT count(*) … contype='c'` → **33** | **OK** |
| 053 | «Comprobado en la base actual: el mismo entregable vinculado dos veces con modos distintos» | Es una afirmación sobre **datos de fixture**, no sobre el modelo | **Bien omitida** — las páginas no la repiten, y no deben: los datos de dev no son fuente de verdad |

## Resumen

| Veredicto | Unidades |
|---|---|
| **OK** — cierto y presente | 12 |
| **CORRIGE** — la página ya arreglaba al artefacto | 4 |
| **FALSO** — corregido en esta pasada | 1 (`123`) |
| **Bien omitida** | 1 (`053`) |

**Ninguna afirmación verificable del artefacto se perdió.** En cuatro casos las páginas ya decían
algo **más exacto** que el original, y esas correcciones se conservan:

- las **seis** causas de turno, no cinco (falta `position_deactivated` en el artefacto);
- los **tres** modos de aprobación, no dos (falta `and`, que es el valor por defecto);
- el idioma de la columna generada se usa **diez** veces, no cuatro ni siete;
- `retirePriorPublishedSiblings()` nombrado como el responsable real de «una sola edición
  publicada», en vez de dejarlo en «lo sostiene el código».

El resto del artefacto —las 100 unidades no listadas— son prosa explicativa, metáforas y
descripciones de estructura sin cifra ni garantía que contrastar. Su contenido está en las páginas;
lo que no está es su redacción, y eso fue una decisión consciente al reescribir.

### Tres errores míos durante esta misma auditoría

Los dejo escritos porque son la razón de que la regla sea «contra el código»:

1. **Conté 67 tablas y di el «38» por falso.** 67 son *todas* las del esquema, incluidos chat,
   empleo y dossier. El artefacto habla de la cadena, no del esquema entero.
2. **Volví a darlo por falso con un filtro roto.** Mi expresión exigía un guion bajo en el nombre,
   así que `persons`, `units`, `tasks`, `terms`, `cargos` y `processes` **no podían aparecer**.
   Con el filtro bueno, el mapa dibuja 38. Estuve a punto de «corregir» un número correcto.

Y un tercero, que es el que justifica haber levantado la base: **conté 145 claves foráneas leyendo
el fichero** cuando son **147**. Dos se declaran con `REFERENCES` en línea, sin la palabra
`FOREIGN KEY`. Contra el catálogo vivo salen bien; contra un `grep`, no.
