import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import i18nextPlugin from 'eslint-plugin-i18next';

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'i18next': i18nextPlugin,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'i18next/no-literal-string': ['error', {
        markupOnly: true,
        onlyAttribute: ['title', 'placeholder', 'alt', 'aria-label'],
        ignoreAttribute: ['className', 'id', 'name', 'type', 'stroke', 'fill', 'd', 'href', 'target', 'rel', 'viewBox']
      }],
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  }
);
