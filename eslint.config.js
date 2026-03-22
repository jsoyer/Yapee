export default [
  {
    // Global ignores — standalone object with only `ignores` applies to all files
    ignores: [
      'js/lib/**',
      'css/**',
      'webfonts/**',
      'node_modules/**',
      '.claude/**'
    ]
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        chrome: 'readonly',
        document: 'readonly',
        window: 'readonly',
        fetch: 'readonly',
        crypto: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        console: 'readonly',
        FormData: 'readonly',
        Uint8Array: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        URL: 'readonly',
        AbortController: 'readonly',
        bootstrap: 'readonly',
        alert: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-var': 'error',
      'prefer-const': 'warn',
      'eqeqeq': ['error', 'always'],
      'no-eval': 'error',
      'no-implied-eval': 'error'
    }
  },
  {
    files: ['yape-companion.user.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        GM_xmlhttpRequest: 'readonly',
        GM_info: 'readonly',
        unsafeWindow: 'readonly'
      }
    }
  }
];
