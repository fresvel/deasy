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
            // Lo que estas reglas NO ven: los strings de clase de mas de 120 caracteres.
            // Son **164** el 2026-08-14 (este comentario decia 221, de una medicion
            // anterior). Para eso no hay regla ni contador: `lint:css` no los mira —solo
            // abre los `.css`— y decia lo contrario. Bajarlos es dar nombre a la receta
            // repetida, o sea las fases 2 y 3 del frente 4.
            "vue/no-static-inline-styles": ["error", { allowBinding: true }],
            "vue/prefer-separate-static-class": "error",

            // [2026-08-11] Deasy es una app EN CLARO y no se contempla modo oscuro.
            //
            // Esta regla existe porque las recetas de TailAdmin —de donde salen los
            // componentes nuevos— vienen con 1024 clases `dark:`, y pegar una tal cual
            // mete codigo muerto en el mejor caso. `tokens.css` declara un
            // `@custom-variant dark` que las deja inertes, pero eso es el seguro: esto
            // es la puerta. Al adaptar una receta, los `dark:` se QUITAN.
            //
            // Si algun dia se implementa modo oscuro, esta regla se retira — pero
            // entonces habra que revisar uno a uno los `dark:` que se hubieran colado,
            // porque apuntan a la paleta de TailAdmin (gray-900, gray-800...) y no a la
            // de Deasy.
            "vue/no-restricted-class": ["error", "/^dark:/"],
        },
    },
];
