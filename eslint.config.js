export default [
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-debugger': 'error',
      'no-duplicate-imports': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
