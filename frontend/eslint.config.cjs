const vuePlugin = require("eslint-plugin-vue");

module.exports = [
    {
        ignores: ["dist/**", "node_modules/**"],
    },
    ...vuePlugin.configs["flat/essential"],
    {
        files: ["**/*.{js,mjs,cjs,vue}"],
        languageOptions: {
            ecmaVersion: 2020,
            sourceType: "module",
            globals: {
                jQuery: "readonly",
                $: "readonly",
            },
        },
        rules: {},
    },
];
