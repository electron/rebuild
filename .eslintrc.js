module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2025,
    sourceType: 'module',
  },
  plugins: ['mocha', '@typescript-eslint'],
  env: {
    es6: true,
    mocha: true,
    node: true,
  },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    'mocha/no-exclusive-tests': 'error',
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        args: 'after-used',
        argsIgnorePattern: '^_',
        ignoreRestSiblings: true,
        vars: 'all',
      },
    ],
    semi: 'off',
    '@typescript-eslint/semi': 'error',
    'no-unexpected-multiline': 'error',
  },
};
