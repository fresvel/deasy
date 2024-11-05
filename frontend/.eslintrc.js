module.exports = {
  env: {
    browser: true,
    es2021: true, // Asegúrate de que sea al menos 2020
  },
  extends: [
    'eslint:recommended',
    //'plugin:vue/essential',
    'plugin:vue/vue3-essential',
  ],
  parserOptions: {
    ecmaVersion: 2020, // Asegúrate de que sea al menos 2020
    sourceType: 'module',
  },
  globals: {
    jQuery: 'readonly',
    $: 'readonly',
  },
  rules: {
    // Tus reglas personalizadas aquí
  },
};
