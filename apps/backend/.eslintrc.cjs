module.exports = {
  extends: ['../../configs/eslint/node.js'],
  env: {
    node: true,
    browser: false,
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
