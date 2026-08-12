> ⚠️ **ARCHIVADO — no es fuente de verdad.**
> Este documento describe el sistema tal como era antes de la reorganizacion de `docs/`.
> Puede citar MariaDB, MongoDB, EMQX/MQTT o rutas que ya no existen. Se conserva por su
> valor historico. Para el estado actual, ver el `README.md` de la raiz.

# Planes cerrados — agosto 2026

Planes **ejecutados por completo**. Se archivan aquí en vez de borrarlos porque documentan *por qué*
se tomaron ciertas decisiones, y esa parte no caduca. **No hay nada que hacer en ellos.**

| Documento | Qué pedía | Cómo acabó |
|---|---|---|
| `plan-limpieza-scripts-2026-08.md` | Reducir `backend/scripts/` de 14 artefactos a 5 + `lib/`, eliminar el seed SQL paralelo y los retro-parches de migración | ✅ **Ejecutado** (`fc44559` y siguientes). Hoy quedan exactamente los 5 previstos: `bootstrap_admin_recovery`, `check_missing_imports`, `generate_demo_certificates`, `reset` y `seed_dev_rich`, más `lib/` |
| [`sistema-diseno/`](./sistema-diseno/) | Frente 4, primera vuelta: podar el CSS muerto, colapsar los dos juegos de tokens, deshacer el secuestro de `--radius-*`, poner linters y empezar a migrar color | ✅ **Ejecutado** en 21 commits (`298ab96`…`b617c62`). CSS 3 997 → ~2 100 líneas en **16 módulos**, un solo juego de tokens, **0 hex y 0 `rgba()`** en los `.css`, **0 `<style scoped>`**, `!important` 80 → 6, y **dev = prod**. Continúa en [`planes/sistema-diseno-plantillas/`](../../planes/sistema-diseno-plantillas/) |

Lo que sobrevive de este plan y **sí sigue vigente** está recogido en los documentos vivos:

- Los efectos sobre las métricas de Sonar (−2 `S2068`, −1 marca, −95 líneas duplicadas) → `docs/plan-calidad-2026-08.md`.
- Las credenciales y el procedimiento de arranque en limpio → `CLAUDE.md` y `docs/03-backend/seed-users-dev.md`.
