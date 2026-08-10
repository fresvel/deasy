const vuePlugin = require("eslint-plugin-vue");

module.exports = [
    {
        ignores: ["dist/**", "node_modules/**", "coverage/**"],
    },
    ...vuePlugin.configs["flat/essential"],
    {
        files: ["**/*.{js,mjs,cjs,vue}"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                jQuery: "readonly",
                $: "readonly",
            },
        },
        rules: {
            // [fase-5 2026-08-09] Barandilla del sistema de diseño. Hasta hoy NADA vigilaba
            // los estilos: ni stylelint, ni una sola regla aqui. Sin esto, cada hex que la
            // fase 6 quita puede volver mañana sin que se entere nadie.
            //
            // Van en "warn" A PROPOSITO: hay 221 strings de clase de mas de 120 caracteres
            // y el gate de CI (.github/workflows/cd-multienv.yml) no puede ponerse rojo en
            // el mismo commit que introduce la regla. Se suben a "error" cuando el contador
            // llegue a cero — la cifra de partida esta en docs/planes/sistema-diseno/.
            "vue/no-static-inline-styles": ["warn", { allowBinding: true }],
            "vue/prefer-separate-static-class": "warn",
        },
    },
];
