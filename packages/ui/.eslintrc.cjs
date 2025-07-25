module.exports = {
  extends: ['../../configs/eslint/react.js'],
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
