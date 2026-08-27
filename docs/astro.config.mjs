// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mermaid from "astro-mermaid";
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
	// `site` va DELIBERADAMENTE sin poner: fija las URL canonicas y el sitemap, y todavia no
	// esta decidido bajo que dominio y que ruta se publica esto (va con el despliegue del
	// servicio en qa/prod). Ponerlo mal es peor que no ponerlo: genera canonicas incorrectas.
	// Mientras tanto el build avisa "Sitemap integration requires the `site` option" y lo salta.
	integrations: [
		mermaid({
			theme: "forest",
			autoTheme: true,
			mermaidConfig: {
				// ── El motor de trazado ────────────────────────────────────────────────
				// `elk` estaba en `package.json` desde el principio y NO se usaba: la
				// integracion lo registra sola si encuentra el paquete, pero mermaid
				// sigue con `dagre` mientras nadie pida lo contrario.
				//
				// Medido el 2026-08-26 sobre los 14 diagramas de `/modelo/`, a la letra
				// efectiva que sale en una columna de 1317 px. Mejora SIETE y no empeora
				// NINGUNO (los que ya estaban a 16 px siguen a 16, y ademas mas estrechos):
				//
				//   mapa-completo       3538x1191 ->  1731x1607     6,0 px -> 12,2 px
				//   flujo-de-firma      2362x2599 ->  1558x2639     8,9 px -> 13,5 px
				//   proceso             1920x1600 ->  1468x1600    11,0 px -> 14,4 px
				//   entregable-concreto 1597x1385 ->  1233x1324    13,2 px -> 16,0 px
				//   organizacion        1864x2371 ->  1620x2371    11,3 px -> 13,0 px
				//   flujo-de-entrega    1467x1985 ->  1267x1985    14,4 px -> 16,0 px
				//   vocabularios        1754x 222 ->  1593x 178    12,0 px -> 13,2 px
				//
				// El caso que lo destapo es el mapa: `flowchart TB` con dagre colocaba los
				// seis subgrafos EN FILA (proporcion 2,97:1) y lo dejaba al 37 % de su
				// tamaño. Con elk queda casi cuadrado (1,08:1). Se probo tambien `LR`, con
				// dagre y con elk, y las dos son PEORES que esto: 6,9 px y 5,6 px.
				layout: "elk",
				flowchart: {
					curve: "basis",
				},
				theme: "forest",
			},
			iconPacks: [
				{
					name: 'logos',
					loader: () => fetch('https://unpkg.com/@iconify-json/logos@1/icons.json').then(res => res.json())
				},
				{
					name: 'iconoir',
					loader: () => fetch('https://unpkg.com/@iconify-json/iconoir@1/icons.json').then(res => res.json())
				}
			]
		}),
		starlight({
			title: 'Deasy — Documentación',
			// El idioma va DENTRO de `locales`, no como clave de primer nivel: `lang` suelto
			// hace fallar el arranque con "Unrecognized key".
			defaultLocale: 'root',
			locales: { root: { label: 'Español', lang: 'es' } },
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/fresvel/deasy' }],
			// El visor de diagramas (zoom, arrastre y pantalla completa). Va como fichero
			// de `public/` y no como componente de Astro a proposito: `astro-mermaid`
			// pinta los SVG en el CLIENTE y no emite ningun evento al terminar, asi que
			// lo unico que sirve es un script que observe el documento. Uno suelto no
			// necesita hidratacion ni entra en el grafo de islas.
			// El porque, con las cifras que lo motivaron, esta en el propio fichero.
			head: [
				{ tag: 'script', attrs: { src: '/visor-diagramas.js', defer: true } },
			],
			// La carpeta ES la URL: `src/content/docs/guias/entorno-dev.md` -> `/guias/entorno-dev`.
			// Con `autogenerate` no hay que registrar cada pagina aqui: crear el fichero en la
			// carpeta lo mete en el menu. El orden dentro de un grupo se controla con
			// `sidebar: { order: N }` en el frontmatter de cada pagina.
			//
			// Diataxis dice que hay cuatro tipos de documento, que responden a preguntas
			// distintas, y aqui se reparten asi:
			//   empezar     -> "ensename"            (tutorial, se lee una vez). Aun no existe.
			//   guias       -> "necesito hacer X"    (receta, se consulta)
			//   referencia  -> "como es exactamente" (GENERADA: esquema y API. No se escribe a mano)
			//   explicacion -> "por que asi"         (los capitulos de `arquitectura-deasy.tex`)
			//
			// Ojo: las tres primeras SI son carpetas; la explicacion NO. Sus capitulos cuelgan
			// de la raiz, porque el `.tex` los tiene de primer nivel y un cajon intermedio
			// añadia un nivel al menu y un segmento a la URL que el original no tiene.
			// Diataxis clasifica el contenido; no obliga a que la clasificacion sea una carpeta.
			//
			// Un grupo cuya carpeta no existe todavia hace fallar el build, asi que se añaden
			// segun se creen. Hoy existen `guias/` y `referencia/`; falta `empezar/`, por eso
			// no tiene grupo. `explicacion/` ya NO existe: ver el aviso de abajo.
			sidebar: [
				{ label: 'Guías', autogenerate: { directory: 'guias' } },
				{ label: 'Referencia', autogenerate: { directory: 'referencia' } },
				// Los capitulos van EXPLICITOS, no `autogenerate`, y es a proposito: reproducen
				// la jerarquia del documento original, que `autogenerate` no puede ordenar entre
				// grupos. Dentro de cada grupo si se autogenera, asi que añadir una pagina
				// sigue siendo crear el fichero.
				//
				// ⚠️ Y NO cuelgan de un cajon «Explicacion», ni en el menu ni en la URL. El
				// indice del `.tex` tiene DOS niveles —`\chapter` → `\section`—, y las
				// `\subsection` son encabezados dentro de la seccion, no entradas del indice.
				// La carpeta `explicacion/` metia un tercer nivel que el original no tiene
				// (Explicacion › El backend › Acceso a datos) y un segmento de mas en la ruta
				// (`/explicacion/backend/auth/`). Se retiro el 2026-08-26: los capitulos son de
				// primer nivel, como en el LaTeX, y la URL es `/backend/auth/`.
				//
				// El capitulo 11 del `.tex` («Por donde empezar a leer») era `explicacion/index`
				// y en la raiz habria chocado con `index.mdx`, la portada del sitio. Por eso es
				// el unico que ademas cambia de nombre: `por-donde-empezar`.
				{ slug: 'por-donde-empezar' },
				{ slug: 'panorama' },
				{ slug: 'arquitectura-y-patrones' },
				{ label: 'El modelo, de punta a punta', autogenerate: { directory: 'modelo' } },
				// El COMPLEMENTO: las 39 tablas que no estan en la cadena proceso -> documento.
				// Va como seccion hermana y no como paginas dentro de `modelo/` porque aquello es
				// una cadena que se lee EN ORDEN y esto son familias independientes; meterlas en el
				// mismo cajon romperia el recorrido numerado, que es lo que lo hace legible.
				// Dos de las seis familias -identidad y RBAC- NO tienen pagina aqui: ya estaban
				// escritas en `modelo/organizacion` y en `backend/auth`, y la entrada las enruta en
				// vez de repetirlas.
				{ label: 'El complemento del modelo', autogenerate: { directory: 'complemento' } },
				{ label: 'La base de datos', autogenerate: { directory: 'datos' } },
				{ label: 'El backend', autogenerate: { directory: 'backend' } },
				{ label: 'El frontend', autogenerate: { directory: 'frontend' } },
				{ slug: 'signer' },
				{ label: 'Infraestructura', autogenerate: { directory: 'infraestructura' } },
				{ slug: 'testing' },
				{ slug: 'confusiones' },
			],
			customCss: ['./src/styles/global.css'],
		}),
	],
	vite: {
		plugins: [tailwindcss()],
	},
});
