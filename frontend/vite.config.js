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
        include: ['src/**/*.{test,spec}.{js,mjs}'],
        // La cobertura la consume SonarQube (sonar.javascript.lcov.reportPaths). `all: true`
        // es lo que hace que el informe cuente TODO src/, y no solo los ficheros que algún
        // test llegó a importar: sin eso, la cobertura sale inflada y no mide nada.
        coverage: {
            provider: 'v8',
            reporter: ['text-summary', 'lcov'],
            reportsDirectory: 'coverage',
            all: true,
            include: ['src/**/*.{js,vue}'],
            exclude: ['src/**/*.{test,spec}.{js,mjs}']
        }
    }
})
