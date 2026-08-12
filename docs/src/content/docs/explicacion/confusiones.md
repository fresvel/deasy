---
title: "Cosas que te van a confundir"
description: "Lo que parece un fallo y no lo es. La página que ahorra más tiempo del repositorio."
sidebar:
  order: 20
---
Esta lista ahorra horas. Son incoherencias reales del repositorio, verificadas.

1.  **`backend/README.md` esta obsoleto.** Habla de MongoDB (`URI_MONGO`), MariaDB y puerto 3000. El código usa PostgreSQL y el puerto 3030. **El `CLAUDE.md` es la fuente fiable**, no los README.

2.  **El `README.md` raiz enlaza documentos que ya no existen** (`docs/02-dominio-datos/modelo-datos.md`, `MER_SQL.sql`, `docs/01-arquitectura/`). Están en `docs/docs-md-antiguos/`. Lo único que hay hoy en `docs/02-dominio-datos/` es `consolidado.dbml` (31 KB, con unas 205 relaciones).

3.  **`amqplib` esta en `package.json` pero no se importa en ningun sitio.** Es una dependencia muerta: la integración real con RabbitMQ es por su API HTTP de gestion.

4.  **`sqlTables.js` declara campos de `template_artifacts` que ya no son columnas de esa tabla** (`template_code`, `display_name`, `description`, `template_scope`, `template_seed_id`, `owner_person_id`). **No es un bug**: `SqlAdminService` los rutea por JOIN a `deliverables`, exponiendolos con los mismos nombres (`d.code AS template_code`). Es una fachada deliberada.

5.  **“Entregable” significa dos cosas** según el contexto: `task_items` (la instancia) y `deliverables` (la identidad de la plantilla).

6.  **Las fases del plan de calidad se llaman A, B, C... por el orden en que se descubrieron**, no por prioridad ni por tema.

7.  **`test:char:run` resetea la base de dev.**

8.  **`rounded-lg` vale 16px** en este frontend, no lo que dice la documentación de Tailwind: `theme.css` pisa el espacio de nombres de radios de Tailwind. La escala esta efectivamente invertida.

9.  **La contraseña del gestor no sigue el patrón de las otras dos.** Está en `CLAUDE.md`, que no se publica.

10. **No existe `artifact_stage`** pese a estar descrito en la documentación de arquitectura. La realidad es `template_artifacts.lifecycle_state` con tres valores.

11. **No hay tabla de auditoria transversal.** Solo bitacoras especificas por dominio.

12. **`docker/docs/Dockerfile` es una imagen huerfana**: no la referencia ningun compose ni el workflow.

13. **`docker/README.md` documenta puertos de RabbitMQ en qa y prod que los overlays ya no publican.**

14. **`program_router.js` y `unit_router.js` son literalmente el mismo router duplicado**, y `notification_router.js` duplica dos endpoints de `chat_router.js`.

15. **`backend/public/` esta vacia** pese a montarse con `express.static`.

16. **Coexisten dos configuraciones de ESLint en el frontend**: `eslint.config.cjs` (flat config, la efectiva con ESLint 10) y `.eslintrc.js` (legacy, residual e inerte).

17. **No hay `.env` dentro de `frontend/` ni de `backend/`**: viven en `docker/`, y el modelo de referencia es `docker/.env_model`.

## Usuarios y accesos de referencia

Los crea el **bootstrap** (`/setup` → «usar datos de ejemplo»). **No hay ningún seed SQL
alternativo.** Son tres perfiles: **admin**, **gestor** y **usuario**.

Las cédulas y contraseñas están en `CLAUDE.md`, en la raíz del repositorio — **no aquí, porque
esta página es pública**. Dos avisos que sí conviene tener a mano:

- La contraseña del **gestor no sigue el patrón** de las otras dos. Es la única excepción y se
  pierde mucho tiempo con ella.
- El **gestor tiene además rol de usuario**, de momento.

:::caution[El admin no puede probar el dossier ni las firmas]

El router bloquea el espacio de usuario para el administrador con `meta: { blockedForAdmin: true }`
(el guard lo redirige a `/admin`): `/home`, `/home/documentos`, `/home/firmas` y `/perfil` con todas
sus hijas, porque vue-router hereda el `meta`. **Para probar el dossier o las firmas hay que entrar
como gestor o como usuario.**

:::

Puertos de `dev`: proxy HTTP **8088** y HTTPS **8443** (la API bajo `/api/deasy/v1`); el puerto
directo del backend es **3030**. SonarQube corre en el **9002** y sus credenciales están también en
`CLAUDE.md`; ojo, porque **su API no acepta la contraseña por basic auth**: todo va por token.
