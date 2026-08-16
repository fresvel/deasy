# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Reglas de Testing 
Para realizar las pruebas debes considerar que todo el sistema está dockerizado.  En la ruta scripts está docker-env.sh que te permite levantar entornos y ejecutar comandos de manera rápida. 

Los usuarios de referencia los **crea el bootstrap** (`/setup` → "usar datos de
ejemplo"); no hay ningún seed SQL alternativo. Ojo: la contraseña del gestor NO es `Demo1234!`.

    admin   -> cédula 1234567890  /  Demo1234!
    gestor  -> cédula 0987654321  /  Gestor1234!   (de momento tiene rol de usuario también)
    usuario -> cédula 1122334455  /  Demo1234!

El router bloquea el espacio de usuario para el admin con `meta: { blockedForAdmin: true }` (el
guard lo redirige a `/admin`): `/home`, `/home/documentos`, `/home/firmas` y `/perfil` con todas
sus hijas, porque vue-router hereda el `meta`. Así que para probar el dossier o las firmas hay que
entrar como gestor o usuario.

### Dónde va cada test (y cómo se llama)

Hay **dos niveles** y no se mezclan. La ubicación no es estética: `sonar-project.properties` los
distingue por patrón, y un fichero mal colocado o mal nombrado se analiza **como código de producción**
(así es como las contraseñas de fixture acabaron contando como vulnerabilidades del sistema).

| Nivel | Dónde | Nombre | Qué prueba |
|---|---|---|---|
| **Unitario** | **junto al módulo** que prueba | `<modulo>.test.js` (`.test.mjs` si el módulo es ESM `.mjs`) | Una unidad, sin red ni base de datos |
| **Caracterización** | `backend/tests/characterization/flows/` | `<flujo>.test.mjs` | Contrato HTTP extremo a extremo contra goldens |

Reglas:

- **`*.test.js` / `*.test.mjs` son los únicos sufijos válidos. No uses `*.spec.js`** — no hay ni uno
  en el repo y añadirlo obliga a mantener un patrón muerto en la config de Sonar y en los globs de
  `test:unit`.
- Un test unitario nuevo tiene que **caer dentro de los globs de `backend/package.json → test:unit`**
  (`config/`, `services/**`, `utils/**`, `middlewares/**`, `controllers/**`, `errors/**`). Si lo pones
  fuera, no lo ejecuta nadie y no te vas a enterar. Si el módulo vive en otra carpeta, **amplía el glob
  en el mismo commit — y en los DOS sitios**: `test:unit` y `test:unit:coverage` llevan la misma lista
  duplicada (el segundo con prefijo `backend/`, porque corre desde la raíz del repo para que las rutas
  del lcov le valgan a Sonar). Si solo tocas uno, el test corre pero no cuenta para la cobertura.
- No metas tests unitarios en `backend/tests/`: esa carpeta es del harness de caracterización
  (`config.mjs`, `lib/`, `setup/`, `__snapshots__/`).
- Los tests del frontend van junto al componente/composable (`vitest` los descubre solo).
- **Un refactor no cambia un golden.** Si un snapshot se mueve durante un refactor puro, o rompiste
  algo o el test estaba mal. En un *fix*, el diff del golden **es** la prueba del arreglo.
- **Una suite que no arranca cuenta como fallo, no como "0 tests".** Vitest marca *Failed Suite* con
  0 casos cuando el error ocurre al importar (un `vi.mock` incompleto de un módulo que ahora tira de
  otro, típicamente). Mira la línea `Test Files`, no solo la de `Tests`.

## Monorepo layout

Each module has its own toolchain and package manager — do not mix them.

- `frontend/` — Vue 3 + Vite + TailwindCSS web app. Uses **pnpm**. `@` aliases `frontend/src`.
- `backend/` — Express 5 (ESM) API served under `/deasy/v1`. Uses **npm**. No build step; runs `node index.js`.
- `docs/` — Astro Starlight documentation site. Uses **pnpm**.
- `signer/` — Python (`pyhanko`) PDF signing microservice with a Node helper in `sigmaker/`; talks to the backend over RabbitMQ + MinIO.
- `docker/` — multi-environment Compose stacks (`compose.base.yml` + overlays per env).
- `scripts/` — operational wrappers for startup, deploy, reset and migrations.

## Common commands

### Run the full stack (preferred — Docker)
```bash
bash scripts/docker-env.sh dev up -d --build      # dev environment
bash scripts/docker-env.sh dev logs -f backend    # tail a service
bash scripts/docker-env.sh dev ps
bash scripts/docker-env.sh dev down
```
`qa`/`prod`/`ingress` pull published GHCR images; local work happens in `dev`.

**Builds/tests must run inside the containers via `scripts/docker-env.sh`, not with npm/npx on the host.**

### ⛔ Regla de entrada: si vas a cambiar código, primero tu worktree

**Una sesión nueva que vaya a modificar el repositorio NO trabaja en el worktree principal**
(`~/Documentos/Pucese/deasy`, que está en `develop`). Lo primero que hace, **antes de tocar un
fichero**, es crearse el suyo con rama propia salida de `develop`:

```bash
git worktree list                                            # ¿qué hay ya, y en qué rama?
git worktree add -b <rama> ../deasy-<algo> develop           # el tuyo, desde develop
cd ../deasy-<algo> && bash scripts/stack.sh <letra> up -d    # y su pila, desde ESE worktree
```

Al terminar: commit en la rama → `merge --ff-only` en `develop` → `stack.sh <letra> down` →
`git worktree remove` + `git branch -d`. **El push lo hace el usuario.**

**Por qué es obligatorio y no una costumbre:** aquí trabajan varias sesiones a la vez. Dos que editen
el mismo árbol se pisan los ficheros sin conflicto de git —simplemente la última escritura gana— y,
peor, **comparten la pila**: un `test:char:run` **resetea la base que la otra está usando**. Ya se
midieron pruebas contra código ajeno tres veces. La rama separada además hace que el trabajo se pueda
descartar entero si sale mal, que es lo que permite el experimento desechable de la regla 14 del
método.

**Lo único que puede quedarse en el principal** es lo que no cambia el árbol: leer, medir, consultar
la base, y responder preguntas. **En cuanto vayas a escribir —código o documentación—, worktree.**
Y si el usuario te asigna uno («trabaja en `deasy-defectos`»), ése, y no toques los demás.

### Pilas paralelas: A, B, C y D — `scripts/stack.sh`

**Si hay varias sesiones trabajando a la vez, cada una necesita su pila.** Los montajes de código son
**relativos** (`../backend:/app/backend`), así que levantar `dev` desde otro worktree **no crea una
pila nueva: recrea los mismos contenedores apuntando al código nuevo**. Pasó tres veces, y las dos
primeras se midieron pruebas contra código ajeno sin que nadie se enterara.

```bash
bash scripts/stack.sh status                              # qué pila hay y qué worktree monta cada una
bash scripts/stack.sh b up -d --build                     # levanta la pila B con ESTE worktree
bash scripts/stack.sh b exec -T backend npm run test:unit
bash scripts/stack.sh b stop                              # te vas por hoy y el worktree sigue
bash scripts/stack.sh b down                              # SOLO al retirar el worktree que monta
```

| Pila | Proyecto | proxy | https | postgres | minio | signer | rabbit | docs | azimutt |
|---|---|---|---|---|---|---|---|---|---|
| **A** | `deasy-dev` | 8088 | 8443 | 5432 | 9000 | 4000 | 5672 | 4321 | 4700 |
| **B** | `deasy-b` | 8188 | 8543 | 5532 | 9100 | 4100 | 5772 | 4421 | 4800 |
| **C** | `deasy-c` | 8288 | 8643 | 5632 | 9200 | 4200 | 5872 | 4521 | 4900 |
| **D** | `deasy-d` | 8388 | 8743 | 5732 | 9300 | 4300 | 5972 | 4621 | 5000 |

- **La pila A ES la `dev` de siempre.** Mismo proyecto, mismos volúmenes, mismos puertos:
  `docker-env.sh dev` y `stack.sh a` son la misma. **No hay una quinta pila.**
- Cada pila tiene **base, MinIO, RabbitMQ, `node_modules` y red propios**. Compartirlos era el fallo:
  con el mismo volumen de postgres, un `test:char:run` **resetea la base de la otra sesión**.
- **Regla: la pila vive con su WORKTREE, no con la sesión.** No se baja al terminar una tanda de
  trabajo: **se baja el día que se retira el worktree que monta** (`stack.sh <letra> down`, y entonces
  sí, obligatorio — si no, la letra queda ocupada por código que ya no existe).
  Antes la regla era «quien la levanta la baja al terminar», y se cambió el **2026-08-14** porque
  costaba más de lo que ahorraba: el primer `up --build` de cada pila es un `npm install` completo, y
  bajarla al acabar el día obligaba a pagarlo otra vez a la mañana siguiente. **Lo que la regla vieja
  protegía —medir contra código ajeno— ya lo impide el guard**, que se niega si la pila monta otro
  worktree.
  Si te vas y tu worktree sigue vivo: **`stack.sh <letra> stop`**. Libera la RAM y conserva volúmenes,
  base y `node_modules`; `start` la devuelve en segundos. Cuatro pilas son 28 contenedores, así que
  dejar corriendo la que no estás usando sigue sin tener sentido — pero **`stop` no es `down`**.
- El primer `up --build` de cada pila cuesta un `npm install` completo, porque el volumen de
  `node_modules` es suyo. A partir de ahí es rápido — y ése es justo el motivo de la regla anterior.
- **`stack.sh` comprueba solo** que la pila que vas a usar monta el worktree desde el que la llamas, y
  **se niega si no coincide**, salvo en `down`/`status`/`ps`/`config`. Para saltárselo a sabiendas,
  `DEASY_STACK_FORCE=1`.
- Cómo funciona por dentro: `docker/compose.dev.yml` parametriza puertos y nombres de volumen con
  `${…:-dev}`, así que **sin variables se comporta exactamente igual que siempre**.

**Al encargar trabajo a un subagente, dile qué pila usar** («usa la pila B») y que anteponga
`bash scripts/stack.sh b` a todo. Si no se lo dices, usará la A y chocará con quien la tenga.

### Frontend
```bash
bash scripts/docker-env.sh dev exec -T frontend pnpm run lint       # eslint .
bash scripts/docker-env.sh dev exec -T frontend pnpm run lint:css   # stylelint src/**/*.css
bash scripts/docker-env.sh dev exec -T frontend pnpm run test:unit  # vitest run
bash scripts/docker-env.sh dev exec -T frontend pnpm run test:unit:coverage  # lcov para SonarQube
bash scripts/docker-env.sh dev exec -T frontend pnpm run build
```
Para cambios de FE: **lint + `test:unit`**, y además verificar aspecto/comportamiento en el navegador.
Lint solo no es la puerta de validación: hay vitest + `@vue/test-utils` y hay que usarlos.

Al **añadir dependencias** al frontend hay que instalar **dentro del contenedor** — el volumen de
`node_modules` sombrea el de la imagen y un `pnpm install` en el host no se ve dentro.

### Estilos — dónde va cada cosa

Los estilos viven en `frontend/src/shared/styles/` (no en `frontend/src/styles/`, que no existe) y
son **18 módulos por familia**. `main.js` importa **sólo `index.css`**, que los encadena.

| Módulo | Qué va aquí |
|---|---|
| `tokens.css` | La **paleta** (`--color-*` en `@theme`, que es lo que genera las utilidades) y las escalas sin registrar (`--elev-*`, `--focus-ring`, `--typeface`) |
| `base.css` | Reset, tipografía, `html`/`body`/`#app` |
| `layout.css` · `nav.css` · `surfaces.css` | Armazón, navegación, tarjetas |
| `buttons.css` · `forms.css` · `tables.css` · `dialogs.css` · `tags.css` · `auth.css` · `admin.css` · `graph.css` · `deliverables.css` · `signatures.css` | Un fichero por familia de componente |
| `misc.css` | Lo que aún no tiene familia. **Si crece, es que falta un módulo** |
| `overrides.css` | El repintado de utilidades de Tailwind a la marca. **Va el último a propósito** |

⚠️ **El orden de los `@import` de `index.css` es parte del diseño, no es alfabético.** En CSS dos
reglas de la misma especificidad se resuelven por orden de aparición. Está explicado en el propio
fichero; si mueves un import, verifícalo en el navegador.

**Un solo juego de tokens.** `--deasy-*` se colapsó sobre `--brand-*` el 2026-08-09, y `--brand-*`
sobre `--color-*` el 2026-08-12 — **`--color-` no es prefijo, es el NAMESPACE de Tailwind**, y lo que
va detrás es literalmente el nombre de la utilidad (`--color-line` → `border-line`). **Y no queda ni
un color suelto en el CSS**: si necesitas uno, usa el token; si no existe, decláralo en `tokens.css`
**con su familia**, no en el sitio donde lo gastas.

Cuatro cosas que cuestan caro y no son evidentes:

1. **`pnpm run lint:css` está en CERO errores y ahí se queda.** Si tu cambio lo sube, has metido un
   color suelto. Ojo: la regla `color-no-hex` **no ve** los hex dentro de `@apply` ni los
   `rgb()/rgba()` con triplete numérico — el contador en verde no significa que no haya deuda.
2. **Antes de declarar un token, comprueba que su nombre no sea un namespace de Tailwind v4**
   (`--color-*`, `--radius-*`, `--font-*`, `--spacing-*`, `--shadow-*`, `--text-*`, `--breakpoint-*`).
   `--radius-lg` hizo durante meses que `rounded-lg` valiera 16px en toda la app, con la escala
   invertida. El fallo es **silencioso y global**.
3. **La tipografía se carga desde `index.html`, no desde el CSS.** Un `@import` remoto anidado
   dentro de un módulo lo descarta Vite en silencio y la app entera se queda con la fuente de
   reserva. Ya pasó.
4. **Ni el build, ni el lint, ni los tests ven que rompiste un estilo.** Está demostrado cuatro
   veces: borrar dos clases dejó los 304 tests en verde y la barra lateral sin color. Para un cambio
   de CSS la verificación es el navegador — y si es amplio, una **huella de `getComputedStyle` +
   `getBoundingClientRect` de cada nodo**, comparada antes/después. Espera a `document.fonts.ready`
   antes de medir o los anchos mienten.

5. **No hay modo oscuro y `dark:` está prohibido.** Deasy es una app en claro; sus zonas oscuras
   son color explícito, no un tema. Importa porque las recetas de TailAdmin traen 1024 clases
   `dark:` y sin protección se activarían solas en un sistema en oscuro. Hay tres capas:
   `@custom-variant` en `tokens.css`, `vue/no-restricted-class` y `pnpm run check:no-dark`.

**Las reglas completas están en `frontend/CLAUDE.md`**, que se carga solo al trabajar ahí. El plan,
la bitácora y la auditoría, en **`docs/planes/sistema-diseno-componentes/`**. La primera vuelta
(el CSS) está cerrada y archivada en `docs/docs-md-antiguos/planes-cerrados-2026-08/sistema-diseno/`.

### Documentación — el sitio Astro Starlight

```bash
bash scripts/docker-env.sh dev up -d docs                        # levanta el sitio -> http://localhost:4321
bash scripts/docker-env.sh dev exec -T docs pnpm run build       # 24 paginas de contenido (el build dice 25: suma el 404)
bash scripts/docker-env.sh dev exec docs pnpm add <paquete>      # dependencias: DENTRO del contenedor
```

**La carpeta es la URL.** `docs/src/content/docs/guias/entorno-dev.md` se publica en
`/guias/entorno-dev`; no hay que registrar la página en ningún sitio. El menú lateral se llena solo:
los grupos de `astro.config.mjs` usan `autogenerate` por carpeta, y el orden dentro de un grupo se
controla con `sidebar: { order: N }` en el frontmatter. `title` en el frontmatter es **obligatorio**.

El bucle es el mismo que el del código: editas el `.md` en el host con tu editor, guardas, y el
navegador se recarga solo — el contenedor monta `../docs`, no hay que reconstruir nada. Como en el
frontend, el volumen de `node_modules` **sombrea** el de la imagen: una dependencia nueva se instala
dentro del contenedor o no se ve.

Tres cosas que ya costaron un arranque fallido:

1. **`lang` no es clave de primer nivel de Starlight.** Va dentro de `locales`; suelto, el contenedor
   arranca y muere con `Invalid config passed to starlight integration`.
2. **Un grupo de `sidebar` cuyo directorio no existe rompe el build.** Los grupos se añaden según se
   crean las carpetas, no antes. Hoy existen `guias/`, `referencia/` y `explicacion/` — los tres con
   su grupo en `astro.config.mjs`; el cuarto de Diátaxis (`empezar/`) todavía no.
3. **`site` está sin poner a propósito** — fija canónicas y sitemap, y el dominio de publicación aún
   no está decidido. El aviso del build es esperado.

El servicio vive **solo en `compose.dev.yml`**: qa y prod todavía no despliegan documentación.
Existía desde marzo en el `docker-compose.yml` monolítico y se perdió al partirlo en base+overlays;
el `Dockerfile` y `DOCS_PORT` sobrevivieron en los cuatro `.env`.

### Modelo de datos — GENERADO, no se escribe

```bash
bash scripts/docs/gen-dbml.sh            # regenera DBML + los 8 diagramas
bash scripts/docs/gen-dbml.sh --check    # y falla si hay deriva (lo que corre en CI)
```

⚠️ **`docs/02-dominio-datos/consolidado.dbml`, `dominios/*.dbml` y `docs/public/diagramas/*.svg`
son ARTEFACTOS.** Editarlos a mano no sirve de nada: la siguiente regeneración los pisa y
`.github/workflows/docs-dbml.yml` lo detecta. Antes decían "generado por introspección" y **no
había generador**: se generó una vez en julio y se mantuvo a mano hasta que derivó.

**Si cambias `postgres_schema.sql`, regenera en el mismo commit.** Si añades una tabla, además
tienes que darle dominio en `scripts/docs/dominios.json` — el generador falla a propósito si una
tabla no está en ninguno o está en dos, para que no se quede fuera de los diagramas en silencio.

Lo único que se escribe a mano es **`docs/02-dominio-datos/anotaciones.json`**: qué *significa*
una tabla o una columna. Se inyecta como nota en el DBML, y el generador falla si nombras algo que
no existe.

### Azimutt — el explorador interactivo (perfil `explorer`)

**Aquí van las credenciales de conexión a propósito: `CLAUDE.md` NO se publica.** El sitio de
`docs/` sí va a ser público, así que ahí solo se nombran las variables, nunca sus valores.
(Estas son las de dev, que ya viven en `docker/.env.dev`; no valen para nada más.)

```bash
bash scripts/stack.sh c --profile explorer up -d azimutt   # la app -> http://localhost:4900
npx -y azimutt@latest gateway                              # la PASARELA, en el host -> :4177
```

Luego, en Azimutt: **«From database connection»** y pegar la cadena de la pila que uses:

| Pila | Azimutt | Cadena de conexión |
|---|---|---|
| **A** | `:4700` | `postgresql://deasy:deasy@localhost:5432/deasy` |
| **B** | `:4800` | `postgresql://deasy:deasy@localhost:5532/deasy` |
| **C** | `:4900` | `postgresql://deasy:deasy@localhost:5632/deasy` |
| **D** | `:5000` | `postgresql://deasy:deasy@localhost:5732/deasy` |

Cinco cosas que costaron una tarde averiguar:

1. **Sin la pasarela no hay conexión viva.** El navegador no puede hablar con una base; Azimutt
   extrae por una pasarela. Si no levantas la tuya **usa la ALOJADA de ellos**, y entonces tu
   cadena de conexión sale de tu máquina. La local lo evita.
2. **La pasarela va en el host, no en contenedor.** No hay imagen publicada y el proceso **se ata
   a `127.0.0.1`**, así que el `-p` de Docker no la alcanza (comprobado: 200 desde dentro, 000
   desde fuera). Es un ayudante de cliente, no parte de la pila. Se apaga con Ctrl-C.
3. **`localhost:<puerto publicado>`, no `postgres:5432`.** Quien conecta es la pasarela, que corre
   en el host. El nombre de servicio de compose no le resuelve.
4. **Importar el `.sql` NO sirve para esto.** Da una foto que hay que reimportar a mano, y además
   su parser se traga los `CREATE INDEX` y los triggers (164 avisos). La conexión viva no.
5. **El plan `free` no puede guardar proyectos.** Por eso el compose fija
   `ORGANIZATION_DEFAULT_PLAN`. Si creas una organización nueva y no guarda, es esto.

Son **dos** contenedores (la app y **su propia base**, separada de la del proyecto porque
`test:char:run` resetea la de dev y se llevaría los diagramas). Por eso va tras un perfil y no
arranca por defecto.

⚠️ **Azimutt NO garantiza estar al día**: lee en vivo cuando refrescas la fuente, que es un clic.
Un layout guardado tampoco incorpora tablas nuevas solo. **La garantía la da la puerta del DBML**,
no esto: si cambias el esquema y no regeneras, CI se pone rojo. Azimutt es para explorar; los
diagramas generados son la documentación.

El generador levanta **su propio PostgreSQL desechable** (no toca ninguna pila, no publica
puertos). Efecto secundario que vale tanto como los diagramas: **aplica el esquema con
`ON_ERROR_STOP=1`, así que por fin algo valida `postgres_schema.sql`** — antes nadie lo hacía.

### Backend
```bash
bash scripts/docker-env.sh dev exec -T backend npm run test:unit          # unitarios, junto a su módulo
bash scripts/docker-env.sh dev exec -T backend npm run test:char:run      # contrato HTTP contra goldens
bash scripts/docker-env.sh dev exec -T backend npm run check:imports      # OBLIGATORIO tras mover código
bash scripts/docker-env.sh dev exec -T backend npm run test:unit:coverage # lcov para SonarQube
```
El backend **no tiene lint**, pero **sí tiene tests** — ejecútalos, no valides "a mano".
`npm run start` (`node index.js`) sirve la API en `/deasy/v1`, Swagger en `/deasy/docs`.

⚠️ **`test:char:run` RESETEA la base de dev** (reset + bootstrap + seed). Es lo normal para char, pero
no lo lances si tienes datos que quieras conservar. Para actualizar los goldens: `test:char:capture`.

## Architecture

### Capas del backend — regla no negociable

**Los controllers son transporte, no lógica.** Un controller valida la entrada, llama a **un** servicio
y traduce el resultado a HTTP. La lógica de negocio, las transacciones de varios pasos, las máquinas de
estados y cualquier bucle de trabajo viven en `backend/services/`.

`backend/services/documents/DocumentWorkflowResetService.js` es el estilo objetivo: **una sola
responsabilidad**, y se lee de una sentada. Los infractores conocidos están listados en `docs/planes/referencia/calidad-y-medicion.md` §5-D; no añadas
más — si un controller tuyo pasa de ~40 líneas o abre una transacción, extrae un servicio.

### Reglas al mover código

1. **Refactor = mover código, NO reescribir comportamiento.** Si cambias qué hace algo, no es un refactor.
2. **`node --check` valida SINTAXIS, no imports.** Un símbolo movido sin su `import` es sintaxis válida,
   el módulo **carga**, y revienta en tiempo de LLAMADA. Así estuvieron rotos tres semanas cuatro
   `ReferenceError`. Por eso **`npm run check:imports` es obligatorio tras mover código**, y comprobar
   que el backend arranca **no** sustituye a ejecutarlo.
3. **No injertes casos especiales en el camino genérico.** Es el olor que hizo God a `AdminTableManager`.
4. **Extrae por script, no a mano**, y verifica `count == 1` antes de borrar cada bloque.
5. **El SQL no lo valida NADIE hasta que se ejecuta esa rama.** `node --check` no lo mira,
   `check:imports` tampoco, y el backend arranca igual: es una cadena de texto. Así sobrevivieron
   meses **cuatro** `UPDATE ... INNER JOIN ... SET` (sintaxis multi-tabla de MySQL que PostgreSQL
   rechaza) y dejaron `POST /sign/fill-requests/:id/return` **roto para todo el mundo**.
   PostgreSQL quiere `UPDATE tabla alias SET col = ... FROM otra WHERE union AND filtros`, con las
   columnas del `SET` **sin cualificar**. Al escribir SQL nuevo: pruébalo con `PREPARE` en psql, y
   recuerda que **`grep "UPDATE.*JOIN"` no encuentra nada** porque el SQL ocupa varias líneas.

### ⛔ Si trabajas sobre algo de `docs/planes/`, el avance se MUESTRA

**Cada vez que cierres una tarea de un plan, enseña el estado actualizado antes de terminar el
turno.** No al final de la fase, no cuando lo pidan: en el mismo turno en que la cerraste.

**Y di siempre de QUÉ tabla hablas**, porque los planes están anidados y cada nivel tiene la suya:

```
plan-maestro-2026-08.md      FRENTES  (0…11)     ← el mapa de todo el repo
  └─ <plan del frente>/      FASES / TAREAS      ← p. ej. sistema-diseno-componentes/
       └─ <fichero de fase>  la unidad del plan  ← p. ej. los 11 GRUPOS de botones
```

Un `✅` en un nivel **no cierra el de arriba**: cerrar una tarea no cierra su fase, y cerrar una
fase no cierra el frente. Decir «7 de 11» sin decir *de qué* es lo que hace perder el hilo — pasó el
2026-08-15, y costó dos respuestas contradictorias seguidas.

Tres obligaciones concretas:

1. **Actualiza la tabla de control en el MISMO commit** que la tarea que cierra, con evidencia y
   fecha. Un `✅` con la evidencia vacía no vale (es la norma de
   `feedback_planes_control_ejecucion`, y esto solo dice dónde se enseña).
2. **Enseña la tabla del nivel que el dueño sigue**, no la que a ti te resulte cómoda. Si no sabes
   cuál es, es la más concreta: la del fichero donde estás trabajando.
3. **Si al medir descubres que el plan estaba mal —un conteo, un estado, una fila obsoleta—,
   corrígelo y dilo.** No lo arregles en silencio: el desfase entre plan y realidad es información,
   y esconderlo es cómo un plan deja de servir. El paso 4 del Frente 4 estuvo marcado ⬜ un día
   entero describiendo un fichero que ya no existía, y su denominador dijo «22» tres días después
   de pasar a 25.

#### El formato: DOS tablas, siempre las mismas

**Se enseña así, para cualquier plan.** El formato es fijo a propósito: cuando cambia de un turno a
otro, el dueño tiene que releer la estructura antes de leer el avance, y ahí es donde se pierde el
hilo.

**Tabla 1 — el mapa completo.** Una fila por fase, y **las tareas de cada una en la segunda
columna**, con su estado individual pegado a cada nombre. Así se ve de un vistazo dónde está el
trabajo sin abrir nada:

```markdown
## Estado general — **13 de 25**

| Fase | Tareas | Estado |
|---|---|---|
| **F0** · Cerrar los gates | F0.1 · F0.2 · F0.3 · F0.4 · F0.5 · F0.6 | ✅ **6 de 6** |
| **F1** · Borrar lo que no pelea | F1.1 ✅ · F1.2 ✅ · F1.3a ✅ · F1.3b ✅ · F1.3c ⬜ · F1.3d ✅ · F1.3e ⛔ | 🟡 5 de 7 |
| **F3** · Las extracciones que faltan | F3.1 ✅ · F3.2 ✅ · F3.3 ⬜ · F3.4 ⬜ | 🟡 **2 de 4** |
| **F4** · Seguir adoptando TailAdmin | — | ⬜ |
```

- Una fase **cerrada entera** o **sin empezar** no necesita desglose: `✅ 6 de 6` o un `—`.
- Una fase **en curso** sí lo lleva, para que se vea qué queda dentro.
- El numerador y el denominador son de **tareas**, no de fases, y se recuentan al enseñarlos.

**Tabla 2 — el detalle de la fase que se está atacando.** Sus tareas en filas, con lo que entrega
cada una. Es la que dice *qué sigue*:

```markdown
## F3 · Las extracciones que faltan — 2 de 4

| Tarea | Qué entrega | Estado |
|---|---|:--:|
| **F3.1** | `deasy-icon-box` — la caja de icono | ✅ |
| **F3.2** | El botón — 11 grupos, 11 gates | ✅ |
| **F3.3** | El estado de grafo — 73 colores en 8 ficheros | ⬜ |
| **F3.4** | Los dos colapsos de plantilla | ⬜ |
```

**Y el tercer nivel solo si lo piden.** Si la tarea en curso tiene su propio desglose —los 11 grupos
de botones dentro de `F3.2`, por ejemplo— **no se enseña por defecto**: se menciona en una línea que
existe y dónde está. Enseñar tres tablas a la vez es lo que produjo el «7 de 11» sin decir de qué.

⚠️ **Nunca colapses varias tareas en una fila de la tabla 2**, ni mezcles dos numeraciones en el
mismo mensaje. Las dos cosas pasaron el 2026-08-15 y las dos hicieron perder el hilo: la primera
rompe el patrón visual justo donde el ojo busca el detalle, y la segunda obliga a adivinar si «5 de
6» y «F0 a F10» hablan de lo mismo (no hablaban).

### Plan de calidad

`docs/planes/referencia/calidad-y-medicion.md` es el **documento maestro** de deuda técnica y complejidad: **mapa de
fases con su estado (§5.0)**, línea base de SonarQube, ranking de ficheros/funciones y la lista de
**lo que NO hay que tocar** (§7 — `sqlTables.js` y los falsos positivos de Sonar entran ahí). Léelo
antes de proponer un refactor. Aviso: las fases se llaman A…I por **el orden en que se descubrieron**,
no por prioridad ni por tema.

Dos documentos satélite, cada uno con su problema:

- `docs/planes/referencia/cobertura.md` — **la cobertura**. Y lo primero que dice: el gate **no pide 80 %
  global** (eso sería trabajo de años), pide 80 % de lo nuevo.
- `docs/planes/referencia/patrones-diseno.md` — **cuándo usar un patrón de diseño y cuándo no**. En este repo la
  complejidad se cura con tablas y extracción, no con jerarquías; hay tres sitios donde un patrón GoF
  sí se gana el sueldo y una lista de dónde sería sobreingeniería. Léelo antes de proponer uno.

### SonarQube — cómo está montado

**Aquí va solo lo que no cambia.** Las cifras (complejidad, incidencias, cobertura, ranking) viven en
`docs/planes/referencia/calidad-y-medicion.md` y **cambian con cada escaneo**: no las repliques en este fichero.

| Pieza | Dónde |
|---|---|
| Stack | `scripts/sonar/compose.yml` — SonarQube **community** + PostgreSQL 16, proyecto compose `deasy-sonar`, puerto **9002 → 9000** |
| Lanzador | `scripts/sonar/scan.sh` — `sonar-scanner-cli` dockerizado |
| Config | `sonar-project.properties` — `projectKey=deasy`; `sources=backend,frontend/src,signer,scripts`, con los tests **declarados aparte** |
| CI | `.github/workflows/sonar.yml` — `workflow_dispatch` |

```bash
docker compose -f scripts/sonar/compose.yml up -d           # levanta el servidor en :9002
SONAR_TOKEN=<token> bash scripts/sonar/scan.sh              # escanea (~1,5 min)
```

**Credenciales:** usuario `admin`, contraseña `Demo1234!Demo`.

**Pero la API NO acepta esa contraseña por basic auth** — desde que dejó de ser la de por defecto,
`-u admin:<pass>` devuelve 401 contra `/api/measures/*` y `/api/authentication/validate` responde
`{"valid":false}` incluso siendo correcta. **Todo va por token.** Para emitir uno sin abrir la UI:

```bash
curl -s -c cj.txt -X POST "http://localhost:9002/api/authentication/login" \
     -d "login=admin" --data-urlencode "password=Demo1234!Demo"
XSRF=$(awk '/XSRF-TOKEN/{print $7}' cj.txt)
curl -s -b cj.txt -H "X-XSRF-TOKEN: $XSRF" -X POST \
     "http://localhost:9002/api/user_tokens/generate" -d "name=deasy-scan-$(git rev-parse --short HEAD)"
```
El `X-XSRF-TOKEN` no es opcional: sin él el `POST` da 401 aunque la cookie sea válida.

**Cuatro cosas que se olvidan y cuestan una medición entera:**

1. **Regenera los DOS informes de cobertura ANTES de escanear** (`test:unit:coverage` en backend y
   frontend). Si no, Sonar lee los de la corrida anterior **sin quejarse**. Y si las rutas `SF:` del
   lcov no son relativas a la raíz del repo, los descarta **en silencio** y la cobertura vuelve a 0.
2. **Al consultar la API, filtra con `resolved=false`.** Por defecto `/api/issues/search` incluye las
   cerradas y las *won't fix*, y los conteos salen inflados.
3. **El escaneo se PROCESA después de subirse.** Consultar métricas justo al terminar devuelve las
   viejas: espera a que `/api/ce/task?id=<id>` diga `SUCCESS`.
4. **No toques `sonar.projectVersion`.** Mueve el New Code period y tira la serie histórica, que es el
   único termómetro fiable que hay.

**El servidor es solo local.** No es alcanzable desde un runner de GitHub, así que Sonar en CI está
pendiente de una decisión de infraestructura (publicarlo con TLS o migrar a SonarCloud), no de código.
El workflow ya está escrito y hace *skip* en verde mientras falten los secrets `SONAR_HOST_URL` y
`SONAR_TOKEN`.

**Marcar no es arreglar.** Los falsos positivos se marcan en Sonar con justificación; hay varios que
**no** hay que "corregir" (§7 del plan). Sonar rastrea la incidencia por el **hash de la línea**: un
rename puro conserva la marca, reescribir la línea la pierde.

### Process engine (core domain)
Processes are modeled as `processes` + `process_definition_versions` + `process_target_rules` in PostgreSQL. The series → rule → flow model governs assignment: a series names the process, a rule distributes the process scope, and the flow distributes the steps. Templates (Jinja2) linked to a process determine whether it is document-producing.

### Modos de emisión de entregables (single / replicated / routed) — LEER `docs/arquitecturas/modelo-emision-entregables.md`
Cada plantilla ligada declara su modo en `process_definition_templates.item_mode`:
- **single**: entregable + flujo (entrega/firma) **predefinidos en la plantilla**; 1 instancia al lanzar.
- **replicated**: flujo **predefinido**; el responsable crea N réplicas etiquetadas que **heredan** ese flujo.
- **routed**: **sin flujo predefinido** — el usuario **define entrega + firma AL INSTANCIAR** (runtime).

El **"Proceso por defecto"** es un routed para **tareas ad‑hoc que no pertenecen a ningún proceso** (cualquier usuario, en cualquier momento; p. ej. "haz el informe de este evento"). **NO es "memorandums".**

Autoría de flujo (plantilla *official*): solo **`task_assignee`** ("Responsable del entregable") y **`cargo_in_scope`** ("Por cargo") — *ad_hoc* añade `specific_person`. **RETIRADOS (la base los rechaza):** `document_owner`/"Responsable del documento", `position`, `manual_pick`. Ya no es deprecación blanda: el `CHECK` de `fill_flow_steps.resolver_type` y `signature_flow_steps.resolver_type` admite **solo esos tres valores**, y el `ALTER` valida las filas existentes, así que un arranque contra una base con un valor retirado **falla**. Lo mismo con los ámbitos `context_subtree` y `context_ancestor_type`. **routed no autora flujo** (es de runtime). **Estado: los tres modos están hechos** — el editor de flujo en runtime existe (`useFlowBuilder.js` + `GeneralTaskModal.vue`, materializado por `materializeRuntimeFlowForTaskItem`).

⚠️ **Lo que sí queda vivo del `document_owner`: sus `case` en el camino de ejecución.**
`admin/generation/assignees.js:147`, `users/user_controler.primitives.js:181` y
`DocumentSignatureWorkflowService.js:518` siguen teniendo su rama. Son **ramas muertas por el `CHECK`**
—ninguna fila puede llevar ese valor— pero no las des por retiradas al leer el código: el censo de
fósiles es el §0.6 del frente 0 de `docs/planes/plan-maestro-2026-08.md`. El criterio que las mató
sigue vigente y vale para lo próximo: **lo que la web no autora, no existe**.

## Environments & ports
`dev` proxy: HTTP `8088` / HTTPS `8443` (API under `/api/deasy/v1`). Direct backend dev port is `3030`. Per-env infra ports (PostgreSQL/RabbitMQ/MinIO/Signer) are listed in `docs/07-despliegue/COMANDOS_PROYECTO.md`.

Env config: `docker/.env` + per-env `docker/.env.<env>`; reference model is `docker/.env_model`. Frontend uses `VITE_API_BASE_URL` (`/api` behind the Nginx proxy in Docker).

## CI/CD
`.github/workflows/cd-multienv.yml`: push to `develop` publishes `dev`-tagged images (no deploy); `qa` and `main` publish `qa`/`prod` images and deploy when `DEPLOY_DELIVERY_MODE=gh-actions`. Published images: `deasy-backend`, `deasy-frontend`, `deasy-signer`, `deasy-analytics`.

Branching: work happens on `develop`; `main` is the production branch.
