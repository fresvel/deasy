# Planes cerrados — agosto 2026

Planes **ejecutados por completo**. Se archivan aquí en vez de borrarlos porque documentan *por qué*
se tomaron ciertas decisiones, y esa parte no caduca. **No hay nada que hacer en ellos.**

| Documento | Qué pedía | Cómo acabó |
|---|---|---|
| `plan-limpieza-scripts-2026-08.md` | Reducir `backend/scripts/` de 14 artefactos a 5 + `lib/`, eliminar el seed SQL paralelo y los retro-parches de migración | ✅ **Ejecutado** (`fc44559` y siguientes). Hoy quedan exactamente los 5 previstos: `bootstrap_admin_recovery`, `check_missing_imports`, `generate_demo_certificates`, `reset` y `seed_dev_rich`, más `lib/` |

Lo que sobrevive de este plan y **sí sigue vigente** está recogido en los documentos vivos:

- Los efectos sobre las métricas de Sonar (−2 `S2068`, −1 marca, −95 líneas duplicadas) → `docs/plan-calidad-2026-08.md`.
- Las credenciales y el procedimiento de arranque en limpio → `CLAUDE.md` y `docs/03-backend/seed-users-dev.md`.
