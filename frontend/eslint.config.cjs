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
            // Entraron en "warn" con 6 infracciones; se arreglaron las 6 en el mismo
            // commit (5 con --fix, y el `style="display: none"` de DossierSectionCrud
            // a mano), asi que van en "error": el contador esta a CERO y lo que importa
            // es que no vuelva a subir.
            //
            // `allowBinding: true` deja pasar `:style` con valor calculado, que es
            // legitimo — posiciones de firma sobre el PDF, anchos de barra de progreso.
            // Lo que prohibe es el `style="..."` estatico, que siempre es una clase
            // disfrazada.
            //
            // Lo que estas reglas NO ven: los 221 strings de clase de mas de 120
            // caracteres. Para eso no hay regla; esta el contador de `lint:css` y la
            // fase 6 del frente 4.
            "vue/no-static-inline-styles": ["error", { allowBinding: true }],
            "vue/prefer-separate-static-class": "error",
        },
    },
];
