// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mermaid from "astro-mermaid";
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
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
			title: 'Docs with Tailwind',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/withastro/starlight' }],
			// Sin sidebar: las paginas de ejemplo de la plantilla se retiraron el 2026-08-08.
			// OJO: la documentacion real de este repositorio (03-backend/, 07-despliegue/,
			// arquitecturas/, los planes...) vive FUERA de src/content/docs/, asi que este sitio
			// NO la publica. Hoy es andamiaje: nadie lo construye ni en CI ni en ningun script.
			// Antes de añadir entradas aqui hay que decidir si se mueve la documentacion dentro o
			// si el sitio se retira.
			sidebar: [],
			customCss: ['./src/styles/global.css'],
		}),
	],
	vite: {
		plugins: [tailwindcss()],
	},
});
