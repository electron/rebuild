const typescriptEslint = require('@typescript-eslint/eslint-plugin');
const typescriptParser = require('@typescript-eslint/parser');
const mochaPlugin = require("eslint-plugin-mocha");

module.exports = [
  mochaPlugin.configs.flat.recommended,
  {
    ignores: [
      "**/*.js",
      "**/*.d.ts",
      "node_modules",
    ],
  },
  {
    files: ['**/*.ts'],
    plugins: {
      '@typescript-eslint': typescriptEslint,
    },
    languageOptions: {
      ecmaVersion: 2019,
      sourceType: 'module',
      parser: typescriptParser,
      parserOptions: {
        project: './tsconfig.json',
      },
      globals: {
        "es6": true,
        "mocha": true,
        "node": true
      }
    },
    rules: {
      "mocha/no-exclusive-tests": "error",
      "mocha/max-top-level-suites": "off",
      "mocha/no-setup-in-describe": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          "args": "after-used",
          "caughtErrorsIgnorePattern": "^_",
          "destructuredArrayIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "ignoreRestSiblings": true,
          "vars": "all"
        }
      ]
    }
  }
];