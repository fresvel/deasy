import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import swc from 'unplugin-swc'
import path from 'node:path'

export default defineConfig({
    plugins: [
        vue(),
        swc.vite({
            include: /\.[jt]sx?$/,
            exclude: /node_modules/
        }),
        tailwindcss()
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src')
        }
    },
    // Vitest. Las utilidades puras (accessControl, etc.) reciben su input por parámetro,
    // así que no necesitan DOM: environment node basta. Los tests viven junto al código
    // que prueban, como *.test.js.
    test: {
        environment: 'node',
        include: ['src/**/*.{test,spec}.{js,mjs}']
    }
})
