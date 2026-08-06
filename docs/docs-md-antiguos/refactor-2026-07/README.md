# Archivo — auditorías de refactorización, julio 2026

Estos cuatro documentos están **archivados**. Su contenido vivo se revalidó y se recogió en
**[`docs/plan-calidad-2026-08.md`](../../plan-calidad-2026-08.md)**, que es la entrada única.

Se conservan porque documentan *cómo se hizo* y *qué se aprendió*, no *qué hacer ahora*.

| Documento | Por qué se archiva |
|---|---|
| `auditoria-refactor-2026-07.md` | Línea base Sonar de julio 2026 y plan de fases 0-5. Las fases 0-2 se ejecutaron; el resto quedó absorbido por `auditoria-god-objects-2026-07.md`. Sus cifras son de julio: usar las de §2 del plan nuevo. Dos de sus God Objects ya no lo son (`backend/index.js` 467 → 233 L; `HomeView.vue` 7 709 → 5 233 L) |
| `auditoria-refactor-user-controler-2026-07.md` | Plan de partición de `user_controler.js`. **Los cuatro módulos M1-M4 están hechos** (`.primitives`, `.storage`, `.queries`, `.panel`). Lo que queda del fichero (God #2, cogn. 345) se ataca en la fase D del plan nuevo, con otro enfoque: extraer *servicios*, no módulos hermanos |
| `auditoria-tests-unitarios.md` | Auditoría de cobertura unitaria. Su premisa la sustituye el hallazgo H2 del plan nuevo: **Sonar nunca ha tenido un informe de cobertura enchufado**, así que la cobertura hay que medirla de verdad antes de volver a planificarla |
| `admin-table-manager-refactor.md` | De **marzo 2026**, anterior a la reorganización a `modules/`. Referencia la ruta `frontend/src/views/admin/components/AdminTableManager.vue`, **que ya no existe**. El veredicto actual sobre ese fichero (motor legítimo, no God) está en §7 del plan nuevo |

**Qué NO está aquí:** `auditoria-god-objects-2026-07.md`, `plan-refactor-frontend.md` y
`linea-base-homeview-2026-07.md` siguen vivos en `docs/` — son bitácora y contrato de regresión, no
planes supersedidos.
