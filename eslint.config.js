const js = require('@eslint/js');

const nodeGlobals = {
  require: 'readonly',
  module: 'readonly',
  exports: 'readonly',
  process: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  Buffer: 'readonly',
  console: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
};

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'coverage/**',
      'lib/**',
      'typechain-types/**',
      'generated/**',
      'build/**',
      '.graphclient/**',
      'snap/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: nodeGlobals,
    },
    rules: {
      // This codebase intentionally allows unused vars in many handlers (destructuring request bodies, etc.).
      'no-unused-vars': 'off',
      // Some helper patterns include intentionally-empty catch blocks.
      'no-empty': 'off',
    },
  },
];
