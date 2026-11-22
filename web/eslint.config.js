import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // FR-26: the browser reaches the service only through src/solver (a test enforces it too).
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/solver/**', 'src/**/*.test.{ts,tsx}'],
    rules: { 'no-restricted-globals': ['error', 'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'] },
  },
)
