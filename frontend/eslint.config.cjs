const vuePlugin = require("eslint-plugin-vue");
const globals = require("globals");

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
            // `globals.browser` en vez de una lista a mano, y no es comodidad: `no-undef`
            // sin el juego completo de globales del navegador no avisa de un símbolo
            // inexistente, MIENTE sobre los que sí existen. La sonda con la que se midió
            // esto daba 5 infracciones y 3 eran `HTMLElement` y `URLSearchParams` — o sea,
            // codigo correcto. Una lista escrita a mano se queda corta sola y cada hueco
            // es un falso positivo que empuja a desactivar la regla.
            globals: {
                ...globals.browser,
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

            // [2026-09-03] `no-undef` y `no-unused-vars`, las dos en "error".
            //
            // POR QUE NO ESTABAN: esta configuracion nunca cargo `eslint:recommended`.
            // Solo `vue/flat/essential` mas las reglas de arriba, escritas a mano. O sea
            // que en un frontend con 27 puertas de lint, un identificador que NO EXISTE
            // pasaba en verde. No es una laguna teorica: costo dos defectos entregados y
            // los dos los encontro una persona mirando la pantalla, no una herramienta.
            //
            // 1) `AdminView.vue` usaba `IconMessage2` SIN IMPORTARLO. En `<script setup>`
            //    eso no es un error de compilacion: el identificador vale `undefined`, Vue
            //    renderiza el hueco sin quejarse y la tarjeta de canales sale SIN ICONO.
            //    Verde en el build, verde en el lint, verde en las 27 puertas.
            //
            // 2) `AdminTableManager.vue` llamaba a `processDefinitionActivationInstance?.hide()`
            //    y a `definitionArtifactsPromptInstance?.hide()`. Esas dos instancias son
            //    `let` PRIVADOS de `useAdminModalRegistry` y no se exportan: al componente
            //    solo llegan sus captadores. Y el `?.` NO PROTEGE de esto —
            //    `noDeclarado?.hide()` lanza `ReferenceError`, solo `typeof` es seguro—, asi
            //    que las dos funciones reventaban EN TIEMPO DE LLAMADA. Es exactamente el
            //    fallo que describe el `CLAUDE.md` de la raiz: «un simbolo movido sin su
            //    import es sintaxis valida, el modulo carga, y revienta al LLAMARLO».
            //    Se arreglaron el 2026-09-03 y las cubre `AdminTableManager.test.js`.
            //
            // `no-unused-vars` entra a la vez porque es la otra mitad del mismo agujero:
            // eran 71 al encenderla —53 los conto la primera sonda, que no miraba
            // parametros ni `catch`, y 1 solo aparecio al quitar el que lo consumia—,
            // entre ellas seis iconos importados que ya no se pintan, 50 lineas de un
            // `computed` de cabecera que nadie llama y dos mapas de iconos de la epoca de
            // FontAwesome. Entraron las dos en "error" con el contador a CERO, que es lo
            // que importa: lo que no puede es volver a subir.
            //
            // `argsIgnorePattern` / `caughtErrorsIgnorePattern`: un parametro que la firma
            // exige y el cuerpo no gasta no es codigo muerto —quitarlo cambia la aridad—,
            // y un `catch (_)` que solo quiere tragarse el fallo tampoco. El subrayado es
            // como se dice «ya se que no lo uso».
            "no-undef": "error",
            "no-unused-vars": ["error", {
                args: "after-used",
                argsIgnorePattern: "^_",
                caughtErrors: "all",
                caughtErrorsIgnorePattern: "^_",
                varsIgnorePattern: "^_",
                ignoreRestSiblings: true,
            }],
        },
    },

    // Los gates del sistema de diseño son scripts de Node, no codigo de navegador: leen
    // ficheros, miden el CSS construido y salen con 1. Sin `globals.node` aqui, `no-undef`
    // se pone rojo en cada `process.exit` de los 28 scripts que hay ahi.
    {
        files: ["scripts/**/*.{js,mjs,cjs}", "*.config.{js,mjs,cjs}", "eslint.config.cjs"],
        languageOptions: {
            globals: { ...globals.node },
        },
    },

    // Los tests traen `describe`/`it`/`expect`/`vi` del runner, no del modulo. Van aparte
    // porque el resto de `src/` NO debe poder nombrarlos: un `vi.fn()` que se cuela en
    // codigo de produccion tiene que salir rojo.
    {
        files: ["**/*.test.{js,mjs}", "**/*.test-d.{js,mjs}"],
        languageOptions: {
            globals: { ...globals.vitest, ...globals.node },
        },
    },
];
