# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Reglas de Testing 
Para realizar las pruebas debes considerar que todo el sistema está dockerizado.  En la ruta scripts está docker-env.sh que te permite levantar entornos y ejecutar comandos de manera rápida. 

Los usuarios de referencia los **crea el bootstrap** (`/setup` → "usar datos de
ejemplo"); no hay ningún seed SQL alternativo. Ojo: la contraseña del gestor NO es `Demo1234!`.

    admin   -> cédula 1234567897  /  Demo1234!
    gestor  -> cédula 0927654327  /  Gestor1234!   (de momento tiene rol de usuario también)
    usuario -> cédula 1122334459  /  Demo1234!

⚠️ **Las tres cambiaron el 2026-08-27** y no es capricho: desde que el modelo admite pasaportes,
`DocumentoIdentidadService` comprueba el **dígito verificador** de la cédula ecuatoriana, y las tres
de antes (`1234567890`, `0987654321`, `1122334455`) eran secuencias inventadas que no lo cumplían.
Con el validador activo **no se pueden ni insertar**. Las nuevas son las más parecidas que sí valen:
al admin y al usuario les cambia **el último dígito**; al gestor, además, el tercero — un `8` ahí
marca sector público, no persona natural.

La cédula ya **no es una columna de `persons`**: vive en `documentos_identidad`, con su tipo
(`cedula_ec` · `pasaporte` · `documento_extranjero`) y su país emisor. Se entra por **cualquiera**
de los documentos de la persona, no sólo el principal.

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

### ⛔ Regla de salida: cómo se ENTREGA lo que acabas de hacer

Está aquí, y no solo en el `CLAUDE.md` de su carpeta, por un motivo **medido**: los `CLAUDE.md` de
carpeta se inyectan **una sola vez, al primer acceso**, y **una compactación se los lleva sin volver
a inyectarlos**. En la sesión del 14 al 17 de agosto de 2026 hubo **2 inyecciones, ambas en la línea
248 de 13 712**; después, tres compactaciones. **199 de los 332 accesos a `frontend/` ocurrieron sin
`frontend/CLAUDE.md` en contexto**, y `docs/planes/CLAUDE.md` **no se inyectó ni una vez**. Las dos
reglas de abajo se incumplieron varias veces por eso, no por criterio.

Y no basta con un puntero: la del avance **ya estuvo aquí entera**, se mudó a su carpeta dejando un
enlace, y **con ese enlace presente en todo momento se incumplió cuatro veces seguidas**. Un enlace
dice *que hay una norma*; no dice *qué hacer*. Por eso lo que sigue es el disparador accionable —el
porqué, los precedentes y los ejemplos siguen siendo normativos y viven en su carpeta.

**1 · Cerraste una tarea de un plan → enseña el avance EN ESE TURNO.** No al cerrar la fase, no
cuando lo pidan. Son **dos tablas**: el mapa completo (una fila por fase, con sus tareas en la
segunda columna y el estado pegado a cada nombre) y el detalle de la fase en curso (una fila por
tarea, con qué entrega). Di siempre **de qué nivel hablas** —frente, fase o tarea—, **recuenta el
denominador** antes de enseñarlo, y no colapses varias tareas en una fila.
→ Formato exacto y por qué es fijo: **§6 de [`docs/planes/CLAUDE.md`](docs/planes/CLAUDE.md)**.

**2 · Entregaste un cambio visual → van CUATRO cosas, aunque parezca trivial.**
**(a)** la auditoría que lo motivó, **con cifras** —cuántos hay, cuántos no conformaban, cuántos
quedan—; **(b)** el antes/después **MEDIDO y no descrito**: valores computados, diff del CSS
construido o `scripts/css-huella.mjs`; **(c)** **la ruta exacta**: la URL **más profunda a la que el
router llegue solo**, con protocolo y puerto de tu pila, **con qué usuario y contraseña**, y **solo**
los clics que la URL no puede sustituir (abrir un modal, elegir una fila); **(d)** **lo que no
pudiste verificar, y por qué**.

⚠️ «Mira los campos», «revisa el admin» y **«la raíz más cuatro clics»** no son rutas: las pestañas
de admin son segmentos de ruta, no estado interno. Si el cambio toca varias pantallas, se dan las
rutas de **todas**.
→ Ejemplos de lo que sí vale y trampas del instrumental: **§4 de [`frontend/CLAUDE.md`](frontend/CLAUDE.md)**.

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
  base y `node_modules`; `start` la devuelve en segundos. Cuatro pilas son 32 contenedores, así que
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
| `titles.css` | Los encabezados de página y de sección |
| `misc.css` | Lo que aún no tiene familia. **Si crece, es que falta un módulo** |

⚠️ **Aquí ponía `overrides.css`, y ese fichero NO EXISTE** (comprobado el 2026-08-26: son estos 18,
ni uno más). Sigue habiendo un `frontend/scripts/check-overrides.mjs`, que es lo que despistaba: ese
gate vigila que no se repinten utilidades de Tailwind, no un módulo que se llame así. Si vas a
«mover el import de `overrides.css`», no hay nada que mover.

⚠️ **El orden de los `@import` de `index.css` es parte del diseño, no es alfabético.** En CSS dos
reglas de la misma especificidad se resuelven por orden de aparición. Está explicado en el propio
fichero; si mueves un import, verifícalo en el navegador.

**Un solo juego de tokens.** `--deasy-*` se colapsó sobre `--brand-*` el 2026-08-09, y `--brand-*`
sobre `--color-*` el 2026-08-12 — **`--color-` no es prefijo, es el NAMESPACE de Tailwind**, y lo que
va detrás es literalmente el nombre de la utilidad (`--color-line` → `border-line`). **Y no queda ni
un color suelto en el CSS**: si necesitas uno, usa el token; si no existe, decláralo en `tokens.css`
**con su familia**, no en el sitio donde lo gastas.

Seis cosas que cuestan caro y no son evidentes (decía «cuatro» y ya listaba cinco):

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

6. **Quién tapa a quién tiene escala, y un modal NO lleva altura.** `z-index` se escribe siempre con
   nombre (`z-(--z-…)`, nunca un número) y hay dos ejes: 1-2 cifras es dentro de un contenedor, 4
   cifras es toda la página, con la banda 1000-1999 reservada a librerías. **Un modal no declara
   nada**: `AppModalShell` se coloca solo al abrirse y se libera al cerrarse. Hubo cinco niveles
   declarados y duraron dos días — `openProcessWizard()` se llama desde siete sitios a dos
   profundidades, así que cualquier número fijo está mal en algún camino.
   **Y sí hay gate que lo vigila**: `frontend/scripts/check-z-index.mjs`, que corre dentro de
   `pnpm run lint` — el eslabón 25 de los 27 que encadena. Lo único que no tiene es alias propio en
   `package.json`, así que `pnpm run check:z-index` no existe: se ejecuta con `pnpm run lint` o con
   `node scripts/check-z-index.mjs`.
   ⚠️ La auditoría del 2026-08-24 dijo que «se documentó tres veces y nunca existió». **Se
   equivocaba**, y de la peor manera: por buscar el alias de npm en vez del fichero. Comprobado el
   2026-08-26. Detalle en `frontend/CLAUDE.md` §5.5.

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

Cuatro cosas que ya costaron un arranque fallido:

1. **`lang` no es clave de primer nivel de Starlight.** Va dentro de `locales`; suelto, el contenedor
   arranca y muere con `Invalid config passed to starlight integration`.
2. **Un grupo de `sidebar` cuyo directorio no existe rompe el build.** Los grupos se añaden según se
   crean las carpetas, no antes. Hoy existen `guias/` y `referencia/`; el cuarto cajón de Diátaxis
   (`empezar/`) todavía no.
   La **explicación no es una carpeta**: sus once capítulos cuelgan de la raíz (`/backend/auth/`,
   `/modelo/vinculo/`, `/panorama/`…). Se quitó el segmento `explicacion/` el **2026-08-26** porque
   metía un nivel de menú y un segmento de ruta que el índice del `.tex` no tiene — el original va
   `\chapter` → `\section` y ya está. Diátaxis clasifica el contenido; no obliga a que la
   clasificación sea una carpeta.
3. **`site` está sin poner a propósito** — fija canónicas y sitemap, y el dominio de publicación aún
   no está decidido. El aviso del build es esperado.
4. **Los enlaces internos del sitio no los valida el build.** Astro solo comprueba los `slug` del
   `sidebar`; un `[x](/no/existe/)` dentro de un `.md` construye **en verde** y da 404 al hacer clic.
   Y lychee excluye `docs/src/**` a propósito (sus enlaces son rutas de página, no ficheros). Lo
   cubre **`node scripts/docs/check-enlaces-internos.mjs`**, que corre en `docs-links.yml`.

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
bash scripts/docker-env.sh dev exec -T backend npm run check:sql-comments # OBLIGATORIO tras tocar SQL
bash scripts/docker-env.sh dev exec -T backend npm run check:sql-aliases  # OBLIGATORIO tras tocar SQL
bash scripts/docker-env.sh dev exec -T backend npm run test:unit:coverage # lcov para SonarQube
```
El backend **no tiene lint**, pero **sí tiene tests** — ejecútalos, no valides "a mano".

**Los tres `check:` marcados OBLIGATORIO corren desde el 2026-08-26 en CI**, en el job
`backend-checks` de `cd-multienv.yml`, y en `pull_request` además de en `push`: si te los saltas en
local, te para el PR. Antes solo corría `check:imports`, y las otras dos dependían de que alguien se
acordara. `check:params` **no** está en CI: es una decisión pendiente, no un olvido.

⚠️ **Nunca escribas un backtick dentro de un comentario `--` de SQL**: el SQL vive en plantillas de
JavaScript y el backtick las **cierra**. Citar la columna que estás documentando es lo natural y por
eso muerde — seis veces en una sola tanda. Con suerte lo caza `node --check`, apuntando a la primera
línea de la plantilla en vez de a la del backtick; sin suerte el fichero compila y el SQL sale
truncado en ejecución. Lo vigila **`npm run check:sql-comments`**, a techo cero.

⚠️ **Y nunca dejes un alias de SQL sin su tabla.** Es el mismo tipo de fallo por el otro lado: un
`ti.id` cuyo `JOIN` ya no está es sintaxis perfecta para todo el mundo menos para PostgreSQL, que
responde `missing FROM-clause entry for table "ti"` **en tiempo de llamada**. No lo ve `node
--check`, no lo ve `check:imports`, y el backend arranca igual. Muerde sobre todo al reemplazar en
bloque: retirando la tabla `documents` (2026-08-23) un reemplazo global de una línea de `JOIN` se
llevó **tres joins legítimos** a `task_items` en consultas que no tenían nada que ver, y el diff era
de 91 sitios — leerlo no servía. Lo vigila **`npm run check:sql-aliases`**, a techo cero (**442
consultas en 200 ficheros**, medido el 2026-08-26; decía 428). Sólo mira sentencias completas y, en las que se componen con `${…}`, sólo los usos
anteriores al primer hueco: lo de después puede apoyarse en tablas que trae el fragmento.
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

Autoría de flujo (plantilla *official*): solo **`task_assignee`** ("Responsable del entregable") y **`cargo_in_scope`** ("Por cargo") — *ad_hoc* añade `specific_person`. **RETIRADOS (la base los rechaza):** `document_owner`/"Responsable del documento", `position`, `manual_pick`. Ya no es deprecación blanda: el `CHECK` de `fill_flow_steps.resolver_type` y `signature_flow_steps.resolver_type` admite **solo esos tres valores** (`task_assignee`, `specific_person`, `cargo_in_scope`). Lo mismo con los ámbitos `context_subtree` y `context_ancestor_type`, retirados de `unit_scope_type`, que hoy admite cinco: `unit_exact`, `unit_subtree`, `unit_type`, `all_units` y `context_exact`.

⚠️ **Aquí ponía «y el `ALTER` valida las filas existentes, así que un arranque contra una base con un valor retirado falla». Ya no es verdad**: desde TD7-s (2026-08-24) **no queda ni un `ALTER TABLE` en `postgres_schema.sql`** — comprobado el 2026-08-26, son cero. Todo es `CREATE TABLE IF NOT EXISTS` con los `CHECK` en línea, así que sobre una base que ya existe **el `CHECK` nuevo ni se aplica ni falla**: la fila con el valor retirado sigue ahí, en silencio. Un esquema recreado desde cero sí lo rechaza; uno vivo, no. **routed no autora flujo** (es de runtime). **Estado: los tres modos están hechos** — el editor de flujo en runtime existe (`useFlowBuilder.js` + `GeneralTaskModal.vue`, materializado por `materializeRuntimeFlowForTaskItem`).

⚠️ **Lo que sí queda vivo del `document_owner`: sus `case` en el camino de ejecución.** No los des
por retirados al leer el código. Y ojo, porque **NO son ramas muertas del todo**: el `CHECK` cubre la
columna `resolver_type`, pero el JSONB `signature_flow_steps.signers` **no lo valida nadie** y manda
sobre ella, así que un paso legado puede traer ese valor por ahí. Borrar los `case` dejaría el paso
resolviéndose por el `default` sin cargo: **no firmaría nadie, y en silencio**. Está registrado como
**defecto 1.19** con su plan de cierre —filtrar Y migrar, en ese orden—. El criterio que los mató
sigue vigente: **lo que la web no autora, no existe**.

## El entregable: qué se debe, quién lo debe, qué se produjo

**Reordenado el 2026-08-23** (frente 9, fase D7). Si vas a tocar entregables, tareas o documentos,
esto es lo que hay — y lo que ya **no** hay:

| Pregunta | Dónde vive |
|---|---|
| **Qué se debe** | `task_items`. Su identidad es *(tarea, plantilla, **puesto que lo produce**)* |
| **Quién lo debe** | `task_item_tenures` — una fila por turno, con quién, en calidad de qué puesto, desde y hasta cuándo |
| **Qué se produjo** | `document_versions` (la **ronda**: llenar → firmar) + `document_version_uploads` (cada **corrección** del archivo, con su autor) |

**Tres tablas murieron y no vuelven:** `task_assignments` (una foto del reparto que ningún relevo
refrescaba), `task_item_handovers` (los mismos hechos como eventos; ahora son periodos) y `documents`
(una cáscara 1:1 sobre `task_items` **sin ni una columna propia**).

Cinco cosas que no son evidentes y que cuestan si se ignoran:

1. **`task_items.assigned_person_id` es una CACHÉ**, no el dato. Su único escritor es el trigger
   `trg_task_item_tenures_sync`, y en el editor genérico es de solo lectura. Para mover el
   responsable está el traspaso, no un `UPDATE`.
2. **`responsible_position_id` es obligatorio.** Es el ancla —el puesto, no la persona— y el punto
   por el que enganchan los cuatro caminos de relevo. Si el lanzamiento no encuentra a nadie, **no
   crea el entregable**: antes lo creaba huérfano y avisaba en la misma respuesta de que no había
   nadie.
3. **El relevo automático llega hasta ANTES de la fase de firma**, y esa lista de estados está
   **duplicada** en JavaScript (`DOCUMENT_RELAYABLE_STATUSES`) y en el SQL de los triggers. La
   vigila `DocumentStateService.test.js`, que **lee el fichero del esquema** y compara.
4. **Las solicitudes pendientes siguen al responsable**, pero sólo las resueltas por `task_assignee`.
   La regla es *alinear al vigente*, no *mover de X a Y*: un relevo pasa por un estado intermedio sin
   persona, y con la segunda formulación la solicitud se quedaba huérfana.
5. **El «Para:» no existe.** El destinatario se deriva del flujo de firma. Un envío sin flujo se
   rechaza, así que el dato siempre está.

El diseño y las decisiones del dueño, con sus mediciones, en
[`docs/planes/plan_data/asignacion-y-relevo.md`](docs/planes/plan_data/asignacion-y-relevo.md).

## Environments & ports
`dev` proxy: HTTP `8088` / HTTPS `8443` (API under `/api/deasy/v1`). Direct backend dev port is `3030`. Per-env infra ports (PostgreSQL/RabbitMQ/MinIO/Signer) are listed in `docs/07-despliegue/COMANDOS_PROYECTO.md`.

Env config: `docker/.env` + per-env `docker/.env.<env>`; reference model is `docker/.env_model`. Frontend uses `VITE_API_BASE_URL` (`/api` behind the Nginx proxy in Docker).

## CI/CD
`.github/workflows/cd-multienv.yml`: push to `develop` publishes `dev`-tagged images (no deploy); `qa` and `main` publish `qa`/`prod` images and deploy when `DEPLOY_DELIVERY_MODE=gh-actions`. Published images: `deasy-backend`, `deasy-frontend`, `deasy-signer`, `deasy-analytics`.

Branching: work happens on `develop`; `main` is the production branch.
