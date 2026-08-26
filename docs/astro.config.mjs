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
