module.exports = {
  extends: ['../../configs/eslint/react.js'],
  env: {
    browser: true,
    es2022: true,
  },
  ignorePatterns: [
    '**/*.py',
    '**/__pycache__/',
    '**/venv/',
    '**/.venv/',
    '**/env/',
    '**/migrations/',
    '**/site-packages/',
    '**/.venv/lib/**',
  ],
};
