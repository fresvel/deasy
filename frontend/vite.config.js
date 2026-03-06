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
    }
})
