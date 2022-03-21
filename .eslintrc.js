const path = require('path');
module.exports = {
    env: {
        browser: true,
        node: true
    },
    plugins: ['@typescript-eslint'],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/eslint-recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:prettier/recommended',
        'prettier'
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2018,
        sourceType: 'module',
        project: path.resolve(__dirname, './tsconfig.json'),
        tsconfigRootDir: __dirname
    },
    rules: {}
};
