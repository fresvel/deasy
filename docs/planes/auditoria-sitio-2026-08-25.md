# Auditoría del sitio de documentación — 2026-08-25

> **Qué es esto.** El sitio (`docs/src/content/docs/`) se escribió cuando `develop` estaba en
> `427ecd5`. Hoy va **333 commits por delante**, con el modelo de datos reordenado y una tanda
> entera de sistema de diseño en el frontend. Esta es la lista **medida** de lo que el sitio
> afirma y ya no es cierto.
>
> Hecha por tres auditorías en paralelo, cada afirmación contrastada contra el código de hoy.
> **No propone redacciones: diagnostica.** Se cierra tachando filas, no reescribiéndola.

## Resumen

| Página | Falsedades | Alcance |
|---|---|---|
| `explicacion/frontend-estructura.md` | 11 + falta todo el sistema de diseño | **Página entera** |
| `explicacion/testing.md` | 9 (toda la cuantificación) + faltan 3 gates | **Página entera** |
| `explicacion/frontend-composables-y-deuda.md` | 11 (8 son la tabla de God Objects) | Tabla + retoques |
| `explicacion/datos-vocabulario.md` | Documenta `documents`, tabla **borrada**, como eslabón central | Cierre entero |
| `explicacion/backend-scripts.md` | Lista 6 scripts de 9; faltan los 3 gates | Tabla entera |
| `explicacion/confusiones.md` | 3 de 17 trampas ya resueltas | Sección |
| `explicacion/backend-arranque.md` | 1 falsa (MinIO) + falta un paso del arranque | Sección |
| `explicacion/backend-auth.md` | 1 falsa (el bootstrap no resiembra al arrancar) | Retoque |
| `explicacion/backend-acceso-a-datos.md` | 1 falsa + 4 cifras | Retoques |
| `explicacion/infra-docker.md` | 1 falsa + 2 omisiones grandes | Sección ×2 |
| `explicacion/infra-cicd-sonar.md` | 0 falsas, falta la mitad de los workflows | Sección nueva |
| `guias/entorno-dev.md` | 1 cifra + tabla incompleta (3 columnas) | Sección |
| `explicacion/datos-modos-y-plantillas.md` | 1 falsa + omite el defecto 1.19 | Sección |
| `explicacion/datos-firmas-y-dominios.md` | 1 columna inexistente citada como real | Retoques |
| `explicacion/backend-capas.md` | 8 cifras | Retoques |
| `referencia/modelo-datos.md` | 4 cifras | Retoques |
| `explicacion/index.md` | 1 cifra + 3 punteros muertos («Capítulo N») | Retoques |
| `explicacion/backend-crud-generico.md` | 3 cifras | Retoques |
| `explicacion/panorama.md` | 0 falsas, 1 desfase de alcance | Retoques |
| `explicacion/infra-nginx.md` | 1 matiz + 1 omisión | Retoques |
| `explicacion/backend-errores-e-integraciones.md` | 1 nombre de fichero | Retoque |
| `explicacion/modelo-proceso-documento.md` | 1 cifra | Retoque |
| `explicacion/datos-motor-de-procesos.md` | **0** | Nada |
| `explicacion/signer.md` | **0** | **Nada** |

`signer.md` es la única intacta, y **es la única que documenta su propia deriva** en un aviso.

---

## Lo que no son las páginas

### `CLAUDE.md` tiene al menos cuatro afirmaciones falsas

Y varias páginas las copiaron de ahí. Arreglar solo las páginas las deja volver.

1. **Dice que `check:z-index` «se documentó tres veces y nunca existió»** (auditoría del 2026-08-24).
   **Existe**: `frontend/scripts/check-z-index.mjs`, creado el 2026-08-17 (`164e456d`), y **corre
   dentro de `pnpm run lint`**, que sí está en CI. Lo único que falta es el alias npm. La auditoría
   se equivocó, y como `index.md` designa `CLAUDE.md` como «lo más actualizado», el error se propaga.
2. **Lista `overrides.css`** en la tabla de módulos de estilos. **No existe.** Y falta `titles.css`
   (3,7 KB), que sí está en la cadena de `index.css`.
3. Dice **«428 consultas»** en `check:sql-aliases`. Son **442**.
4. Arrastra la frase del **`ALTER` que valida las filas al arrancar**. No queda un solo
   `ALTER TABLE` en el esquema desde TD7-s (2026-08-24): los `CHECK` son inline y todo es
   `CREATE TABLE IF NOT EXISTS`, así que sobre una base vieja **no valida ni falla**.

### `check:params` está en rojo, y sus 4 desajustes son falsos positivos

Sale con código 1. Pero:

- **Tres** están en `backend/scripts/docs/gen-campos-md.mjs`, que usa `pool.query()` con `$1`
  nativo de PostgreSQL en vez del adaptador de `?`. El gate cuenta «0 placeholders / 1 parámetro».
  El código es correcto.
- **El cuarto**, `services/admin/generation/documents.js:312`, dice «4 placeholders / 5 parámetros».
  Son **cuatro**. Lo que sobra es un **comentario de tres líneas con comas dentro del array**, que
  el gate cuenta como parámetros.

**Un gate con falsos positivos es peor que no tener gate**: enseña a ignorarlo.

### ~~Dos gates obligatorios no corren en CI~~ — CERRADO el 2026-08-26

`CLAUDE.md` declara `check:sql-comments` y `check:sql-aliases` como OBLIGATORIOS, pero
`cd-multienv.yml` solo ejecutaba `check:imports` en el job `backend-checks`. **Ya están los
tres**: se añadieron `check:sql-comments` y `check:sql-aliases` como pasos propios, y el job
corre en `push` y en `pull_request` a `develop`, `qa` y `main`, así que bloquean.

---

## Detalle por página

### `datos-vocabulario.md` — lo más grave

| Línea | Afirmación | Realidad |
|---|---|---|
| 46 | La cadena `task_item → documents → document_version` | **`documents` no existe.** `document_versions.task_item_id` cuelga del entregable (`postgres_schema.sql:957-968`) |
| 48-53 | Aviso entero: «`documents` es el expediente y nace vacía al lanzar» | La tabla se retiró el 2026-08-23. El esquema deja epitafio en `:941-955` |
| 50 | «El PDF vive en la fila hija `document_versions`» | Ya es hija directa de `task_items` |
| 52 | «los tres relevos automáticos» | Hoy son **cuatro** caminos de relevo |
| 7 | «1998 líneas» | **2068** |

Falta en el glosario: `task_item_tenures` y `document_version_uploads`, hoy dos de las cuatro
tablas centrales. Y `task_items.assigned_person_id` es **caché** de un trigger, no el dato.

### `frontend-estructura.md` — página entera

11 falsedades. Las tres peores: **`overrides.css` no existe**; `main.js` no hace tres de las cosas
que se le atribuyen (son 10 líneas: createApp, un icono, un CSS, mount); y los conteos de ficheros,
servicios y rutas están todos desfasados.

**El hueco es mayor que los errores**: no menciona nada del sistema de diseño — el colapso a
`--color-*` (que es el *namespace* de Tailwind, no un prefijo), que no queda un color suelto, que
`dark:` está prohibido con tres capas, la escala de `z-index`, ni que `pnpm run lint` es hoy una
**cadena de 27 gates**.

### `testing.md` — página entera

Toda la cuantificación cayó: backend **32→38 ficheros / 523→588 casos**; frontend **18→23 / 304→333**;
caracterización **19→25 suites / 204→227 tests**; las suites con prefijo `z` son **15, no 9**, y la
escalera llega a **doce** `z`, no siete. `test:char:fixture` ahora resetea **también el
almacenamiento**, y el aviso no lo dice.

Y el bloque «Comandos de validación» solo lista `check:imports` de los tres obligatorios.

### `confusiones.md` — tres trampas ya resueltas

Los ítems **2** (enlaces muertos del README — los arregló `docs-links.yml`), **12** (`docker/docs/Dockerfile`
huérfano — hoy es un servicio de primera clase en `compose.dev.yml:54`) y **16** (`.eslintrc.js`
legacy — ya no existe).

**Una página titulada «Cosas que te van a confundir» que confunde con trampas resueltas es peor que
no tenerla.**

### El resto

- **`backend-arranque`**: dice que MinIO **no crea buckets al arrancar**. Sí lo hace:
  `publishSeedsOnBoot()` crea el bucket y hace ~48 PUT en cada arranque. Y el diagrama del arranque
  omite ese paso.
- **`backend-auth`**: dice que el bootstrap reescribe `role_permissions` **en cada arranque**. Solo
  desde `/system/bootstrap/initialize` (409 si ya está instalado) y `recover:admin`. Editar
  `rbacCatalog.js` y reiniciar **no propaga nada**.
- **`backend-acceso-a-datos`**: «las 484 llamadas están equilibradas» — hoy el gate falla.
- **`infra-docker`**: «`docker-env.sh` es la única forma correcta de tocar el stack» — hoy es
  `stack.sh` para B/C/D. Y no menciona que `compose.dev.yml` añade `docs`, `azimutt` y `azimutt-db`.
- **`entorno-dev`**: la tabla de pilas tiene 8 columnas; `stack.sh` publica **10** (faltan consola
  de MinIO, rabbit-ui y azimutt). «28 contenedores» son **32**.
- **`infra-cicd-sonar`**: solo habla de dos workflows. Hay **cuatro**: faltan `docs-dbml.yml` y
  `docs-links.yml`.
- **`referencia/modelo-datos`**: 139→**147** relaciones, plantillas 7→**8**, tareas 9→**8**,
  salientes 34→**28**. Irónico: la página se autodescribe como «no se escribe: se genera», pero
  **estas cifras están escritas a mano y por eso derivaron**.
- **`index.md`**: tres punteros «Capítulo 5», «Capítulos 4 y 7» — se escribió como documento único
  numerado; hoy es un sitio de 27 páginas sin capítulos.

---

## Lo estructural

El `.tex` tiene **11 capítulos → 43 secciones → 35 subsecciones**. El sitio quedó **plano**: 21
páginas hermanas con el nivel fingido en el nombre (`backend-capas`, `backend-arranque`). **Un
prefijo no es un padre**: Starlight construye el árbol por carpetas.

## El artefacto «Del proceso al documento firmado»

Publicado como `explicacion/modelo-proceso-documento.md`, pero **al 28 %**: 2.214 palabras de
7.968, 10 secciones de 18, y **ninguna** de las 18 subsecciones.
