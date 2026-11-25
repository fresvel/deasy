> ⚠️ **ARCHIVADO — no es fuente de verdad.**
> Este documento describe el sistema tal como era antes de la reorganizacion de `docs/`.
> Puede citar MariaDB, MongoDB, EMQX/MQTT o rutas que ya no existen. Se conserva por su
> valor historico. Para el estado actual, ver el `README.md` de la raiz.

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

---

## Archivados el 2026-08-08 — los dos handoffs de sesión

Ambos quedaron sin objeto porque el trabajo que pedían está hecho. Se conservan por el detalle
histórico, **no como guía**: lo vigente está en `docs/plan-calidad-2026-08.md`.

| Documento | Por qué ya no vale |
|---|---|
| `SIGUIENTE-SESION-fase5-y-X.md` | Pedía las fases 5 y X del frontend. **Hechas**: `useProcessPanels` pasó a poseer su estado (28 asignaciones a refs ajenos → 0), la fase 3.5 de `AdminView` se cerró (la URL es la única fuente de verdad) y la parte BLOQUEANTE de la fase X también (los dos `@layer components` fusionados, 42 colisiones resueltas, tokens colapsados). Lo que queda de la fase E —los dos forks y la migración de ~1 269 hardcodes de color, ya desbloqueada— vive en §5-E del plan maestro |
| `SIGUIENTE-SESION-saveTemplateArtifactDraft.md` | Su fase 1 (la red) ya estaba cerrada, y su fase 2 (el corte) está **hecha a medias y medida**: `saveTemplateArtifactDraft` bajó de CC 164 a 76 con cinco extracciones. Lo que falta —el `try` con su rollback manual, que exige decidir quién posee la compensación— está descrito en §5-C del plan maestro, con el motivo de por qué no se siguió |

Además, sus dos avisos sobre SonarQube **ya no son ciertos**: el basic auth con `admin:admin` funcionó
mientras la contraseña fue la de por defecto y hoy **toda la API exige token** (§1.1 del plan maestro).

