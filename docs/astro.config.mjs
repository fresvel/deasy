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
			// Los cuatro grupos son los de Diataxis, y responden a preguntas distintas:
			//   empezar     -> "ensename"            (tutorial, se lee una vez)
			//   guias       -> "necesito hacer X"    (receta, se consulta)
			//   referencia  -> "como es exactamente" (GENERADA: esquema y API. No se escribe a mano)
			//   explicacion -> "por que asi"         (aqui aterrizara arquitectura-deasy.tex)
			//
			// Un grupo cuya carpeta no existe todavia hace fallar el build, asi que se añaden
			// segun se creen. Hoy existen tres —`guias/`, `referencia/` y `explicacion/`—, que
			// son los tres grupos de abajo. Falta `empezar/`: por eso no tiene grupo.
			sidebar: [
				{ label: 'Guías', autogenerate: { directory: 'guias' } },
				{ label: 'Referencia', autogenerate: { directory: 'referencia' } },
				{ label: 'Explicación', autogenerate: { directory: 'explicacion' } },
			],
			customCss: ['./src/styles/global.css'],
		}),
	],
	vite: {
		plugins: [tailwindcss()],
	},
});
