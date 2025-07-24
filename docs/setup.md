# Setup Guide

This guide will help you set up the AI-First Modular Monorepo for development.

## Prerequisites

### Required Software

- **Node.js** 20+ (check with `node --version`)
- **Python** 3.11+ (check with `python --version`)
- **pnpm** 9.15+ (install with `npm install -g pnpm`)
- **Git** (check with `git --version`)

### Recommended Tools

- **VS Code** with recommended extensions (see `.vscode/extensions.json`)
- **Docker** for containerized development
- **GitHub CLI** for repository management

## Quick Start

### 1. Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd agentic-workflow-monorepo

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration
```

### 2. Development Setup

```bash
# Start all development servers
pnpm dev

# Or start individual services
pnpm dev:frontend  # React app on http://localhost:3000
pnpm dev:backend   # Django API on http://localhost:8000
```

### 3. Verify Installation

```bash
# Run tests
pnpm test

# Check linting
pnpm lint

# Type check
pnpm type-check

# Build all packages
pnpm build
```

## Environment Setup

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Development
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=sqlite:///db.sqlite3

# API
API_BASE_URL=http://localhost:8000

# Optional: Third-party services
# OPENAI_API_KEY=your_key_here
# ANTHROPIC_API_KEY=your_key_here
```

### Python Backend Setup

```bash
# Navigate to backend
cd apps/backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Run Django migrations
python manage.py migrate

# Create superuser (optional)
python manage.py createsuperuser
```

## Development Workflow

### Daily Development

1. **Start development servers**

   ```bash
   pnpm dev
   ```

2. **Make changes** to your code

3. **Run tests** as you develop

   ```bash
   pnpm test
   ```

4. **Commit changes** (pre-commit hooks will run automatically)
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

### Working with Packages

#### Adding Dependencies

```bash
# Add to root (for tools, scripts)
pnpm add -w <package>

# Add to specific package
pnpm add <package> --filter frontend
pnpm add <package> --filter backend
pnpm add <package> --filter shared
```

#### Running Package Scripts

```bash
# Run script in specific package
pnpm --filter frontend dev
pnpm --filter backend test
pnpm --filter shared build

# Run script in all packages
pnpm -r test
pnpm -r build
```

### Creating New Packages

1. **Create package directory**

   ```bash
   mkdir packages/new-package
   cd packages/new-package
   ```

2. **Initialize package.json**

   ```bash
   pnpm init
   ```

3. **Update package.json**

   ```json
   {
     "name": "@monorepo/new-package",
     "version": "0.1.0",
     "main": "dist/index.js",
     "types": "dist/index.d.ts",
     "scripts": {
       "build": "tsc",
       "dev": "tsc --watch",
       "test": "jest",
       "lint": "eslint src --ext .ts,.tsx",
       "type-check": "tsc --noEmit"
     }
   }
   ```

4. **Add TypeScript config**
   ```json
   {
     "extends": "../../configs/typescript/library.json",
     "compilerOptions": {
       "outDir": "dist",
       "rootDir": "src"
     },
     "include": ["src/**/*"],
     "exclude": ["dist", "node_modules"]
   }
   ```

## Troubleshooting

### Common Issues

#### "Module not found" errors

```bash
# Clear all node_modules and reinstall
pnpm clean
pnpm install
```

#### TypeScript path mapping issues

```bash
# Rebuild TypeScript project references
pnpm build
```

#### Pre-commit hooks failing

```bash
# Fix linting issues
pnpm lint --fix

# Fix formatting
pnpm format
```

#### Port conflicts

```bash
# Kill processes on specific ports
kill -9 $(lsof -ti:3000)  # Frontend
kill -9 $(lsof -ti:8000)  # Backend
```

### Getting Help

1. **Check documentation** in the `docs/` directory
2. **Review package README files** for specific setup instructions
3. **Check GitHub Issues** for known problems
4. **Run with verbose logging**
   ```bash
   DEBUG=* pnpm dev
   ```

## IDE Configuration

### VS Code Setup

1. **Install recommended extensions**
   - Open VS Code
   - Press `Cmd/Ctrl + Shift + P`
   - Type "Extensions: Show Recommended Extensions"
   - Install all workspace recommendations

2. **Configure settings**
   - Settings are automatically applied from `.vscode/settings.json`
   - Restart VS Code if needed

3. **Debugging setup**
   - Use the provided debug configurations in `.vscode/launch.json`
   - Set breakpoints and debug with F5

### Other IDEs

For other IDEs, ensure:

- TypeScript language server is configured
- ESLint and Prettier extensions are installed
- Path mapping is configured for `@shared/*`, `@ui/*`, `@api/*`

## Next Steps

After completing setup:

1. Review the [Contributing Guide](contributing.md)
2. Understand the [Architecture](architecture.md)
3. Check out [Deployment Guide](deployment.md)
4. Explore the [API Documentation](api/)

## Performance Tips

### Faster Development

- Use `pnpm dev:frontend` or `pnpm dev:backend` to start individual services
- Leverage TypeScript project references for faster builds
- Use VS Code's TypeScript language server for fast feedback

### Faster Builds

- Enable caching: `pnpm config set store-dir ~/.pnpm-store`
- Use parallel builds: `pnpm -r --parallel build`
- Leverage CI caching for dependencies

### Memory Usage

- Increase Node.js memory limit: `export NODE_OPTIONS="--max-old-space-size=4096"`
- Use `pnpm clean` regularly to clear build artifacts
- Configure VS Code to exclude large directories from file watching
