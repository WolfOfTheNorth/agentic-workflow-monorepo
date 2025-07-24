# Agentic Workflow Monorepo

> 🚀 AI-First Modular Monorepo for rapid prototyping and real-world system design

A scalable, modular monorepo architecture that supports multiple apps (frontend, backend), shared code, and infrastructure with AI-first workflows, best-in-class free tools, and seamless developer experience.

## 📁 Project Structure

```
├── apps/                       # Applications
│   ├── frontend/              # React + Vite frontend app
│   └── backend/               # Django backend API
│
├── packages/                   # Shared packages
│   ├── shared/                # Shared types, utils, constants
│   ├── ui/                    # React component library
│   └── api/                   # API client & types
│
├── configs/                    # Shared configurations
│   ├── eslint/                # ESLint configurations
│   ├── prettier/              # Prettier configurations
│   └── typescript/            # TypeScript configurations
│
├── infra/                      # Infrastructure & deployment (future)
├── tools/                      # Build tools & scripts (future)
├── docs/                       # Documentation (future)
└── .claude/                    # Claude Code spec workflow
```

## 🚀 Quick Start

### Prerequisites

- **Node.js**: v20+ (see `.nvmrc`)
- **pnpm**: v9.15.0+ (package manager)
- **Python**: 3.11+ (for Django backend)
- **Git**: Latest version

### 1. Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd agentic-workflow

# Use correct Node.js version
nvm use

# Install all dependencies
pnpm install
```

### 2. Environment Configuration

```bash
# Copy environment template
cp .env.example .env.local

# Edit environment variables
# Update the values in .env.local according to your setup
```

### 3. Start Development

```bash
# Start all development servers (frontend + backend)
pnpm dev

# Or start individually
pnpm dev:frontend    # Start frontend only (http://localhost:3000)
pnpm dev:backend     # Start backend only (http://localhost:8000)
```

### 4. Verify Setup

- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:8000
- **Backend Admin**: http://localhost:8000/admin

## 🔧 Environment Configuration

The monorepo uses a hierarchical environment configuration system:

### Environment Files Priority

1. `.env.local` - Local development (highest priority, gitignored)
2. `.env.development` - Development environment (gitignored)
3. `.env.staging` - Staging environment (gitignored)
4. `.env.production` - Production environment (gitignored)
5. `.env.example` - Template file (committed to git)

### Setting Up Environment Variables

1. **Copy the template**:

   ```bash
   cp .env.example .env.local
   ```

2. **Configure required variables**:

   ```bash
   # Required for Django
   DJANGO_SECRET_KEY=your-secret-key-here
   DJANGO_DEBUG=true
   DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1

   # Required for frontend API communication
   VITE_API_BASE_URL=http://localhost:8000

   # Database (SQLite for development)
   DATABASE_URL=sqlite:///db.sqlite3
   ```

3. **Environment-specific setup**:
   - **Development**: Use `.env.development` for dev-specific overrides
   - **Staging**: Use `.env.staging` for staging environment
   - **Production**: Use `.env.production` for production settings

### Key Environment Variables

| Variable            | Description         | Default                 | Required |
| ------------------- | ------------------- | ----------------------- | -------- |
| `NODE_ENV`          | Node environment    | `development`           | ✅       |
| `DJANGO_SECRET_KEY` | Django secret key   | -                       | ✅       |
| `DJANGO_DEBUG`      | Django debug mode   | `true`                  | ✅       |
| `DATABASE_URL`      | Database connection | `sqlite:///db.sqlite3`  | ✅       |
| `VITE_API_BASE_URL` | Frontend API URL    | `http://localhost:8000` | ✅       |
| `FRONTEND_PORT`     | Frontend port       | `3000`                  | ❌       |
| `BACKEND_PORT`      | Backend port        | `8000`                  | ❌       |

### Security Best Practices

- ✅ Never commit `.env*` files (except `.env.example`)
- ✅ Use strong, unique secrets for production
- ✅ Rotate secrets regularly
- ✅ Use environment-specific values
- ✅ Validate environment variables on startup

## 📦 Package Management

This monorepo uses **pnpm** for efficient package management with workspace support.

### Available Scripts

```bash
# Development
pnpm dev                 # Start all apps in development mode
pnpm dev:frontend        # Start frontend only
pnpm dev:backend         # Start backend only

# Building
pnpm build               # Build all packages and apps
pnpm build:frontend      # Build frontend only
pnpm build:backend       # Build backend only
pnpm build:packages      # Build shared packages only

# Testing
pnpm test                # Run all tests
pnpm test:frontend       # Run frontend tests
pnpm test:backend        # Run backend tests
pnpm test:packages       # Run package tests

# Code Quality
pnpm lint                # Lint all code
pnpm lint:fix            # Fix linting issues
pnpm format              # Format all code
pnpm type-check          # TypeScript type checking

# Utilities
pnpm clean               # Clean all build artifacts
pnpm check               # Run lint, type-check, and format check
pnpm check:fix           # Fix all code quality issues
```

### Adding Dependencies

```bash
# Add to root (for build tools, linting, etc.)
pnpm add -D -w <package>

# Add to specific app/package
pnpm add --filter @agentic-workflow/frontend <package>
pnpm add --filter @agentic-workflow/backend <package>
pnpm add --filter @agentic-workflow/shared <package>

# Add to all packages
pnpm add -r <package>
```

## 🏗️ Development Workflow

### 1. Pre-commit Hooks

The project uses Husky and lint-staged for code quality:

- **ESLint**: Automatically fixes JavaScript/TypeScript issues
- **Prettier**: Formats code consistently
- **Commitlint**: Enforces conventional commit messages

### 2. Commit Message Format

Use conventional commits:

```bash
feat: add user authentication
fix: resolve API timeout issue
docs: update environment setup guide
chore: update dependencies
```

### 3. Code Quality Checks

Before committing, the following checks run automatically:

- ESLint with automatic fixes
- Prettier formatting
- TypeScript type checking
- Conventional commit message validation

### 4. IDE Setup

Recommended VS Code extensions:

- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- Python (for Django backend)
- GitLens

VS Code settings are pre-configured in `.vscode/settings.json`.

## 🧪 Testing

### Frontend Testing

```bash
# Run frontend tests
pnpm test:frontend

# Run in watch mode
pnpm --filter @agentic-workflow/frontend test:watch

# Run with coverage
pnpm --filter @agentic-workflow/frontend test:coverage
```

### Backend Testing

```bash
# Run backend tests
pnpm test:backend

# Run Django tests
cd apps/backend && python manage.py test
```

### Package Testing

```bash
# Test shared packages
pnpm test:packages

# Test specific package
pnpm --filter @agentic-workflow/shared test
```

## 🔄 Database Management

### Django Backend Database

```bash
# Create migrations
pnpm makemigrations

# Apply migrations
pnpm migrate

# Create superuser
cd apps/backend && python manage.py createsuperuser
```

### Database Configuration

- **Development**: SQLite (default)
- **Production**: PostgreSQL (recommended)

Update `DATABASE_URL` in your environment file:

```bash
# SQLite (development)
DATABASE_URL=sqlite:///db.sqlite3

# PostgreSQL (production)
DATABASE_URL=postgresql://username:password@host:port/database
```

## 🚢 Deployment

### Environment-Specific Deployment

1. **Development**: Local development environment
2. **Staging**: Preview deployments and testing
3. **Production**: Live application

### Build Process

```bash
# Build for production
NODE_ENV=production pnpm build

# Build specific app
pnpm build:frontend
pnpm build:backend
```

### Deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Static files collected (Django)
- [ ] Build artifacts generated
- [ ] Health checks passing

## 🔧 Troubleshooting

### Common Issues

#### pnpm installation fails

```bash
# Clear cache and reinstall
pnpm store prune
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

#### Port conflicts

```bash
# Check what's using the port
lsof -i :3000
lsof -i :8000

# Kill processes or change ports in .env.local
```

#### Environment variables not loading

```bash
# Check file naming (.env.local, not .env.development.local for development)
# Verify variable names start with VITE_ for frontend
# Restart development servers after changes
```

#### TypeScript errors

```bash
# Clear TypeScript cache
pnpm --filter <package> clean
pnpm type-check
```

### Development Server Issues

#### Frontend not connecting to backend

1. Check `VITE_API_BASE_URL` in `.env.local`
2. Verify backend is running on correct port
3. Check CORS configuration in Django settings

#### Hot reload not working

1. Check `VITE_HMR_PORT` in environment
2. Verify file watching limits (increase if needed)
3. Restart development server

### Getting Help

1. Check existing issues in the repository
2. Review environment configuration
3. Verify all dependencies are installed
4. Check development server logs for errors

## 📚 Documentation

### Core Documentation

- **[Setup Guide](docs/setup.md)**: Detailed setup instructions
- **[Contributing Guide](docs/contributing.md)**: Development workflow and standards
- **[Troubleshooting Guide](docs/troubleshooting.md)**: Common issues and solutions
- **[Adding Packages Guide](docs/adding-packages.md)**: Best practices for creating new packages

### Technical Documentation

- **[Architecture](docs/architecture.md)**: System design and structure
- **[API Documentation](docs/api/)**: Backend API reference
- **[Testing Guide](docs/testing-guide.md)**: Testing strategies and tools
- **[Deployment Guide](docs/deployment.md)**: Production deployment instructions

### Application Documentation

- **[Frontend Documentation](apps/frontend/README.md)**: React frontend app
- **[Backend Documentation](apps/backend/README.md)**: Django backend API
- **Package Documentation**: Individual package READMEs in `packages/`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Set up your environment (copy `.env.example` to `.env.local`)
4. Make your changes
5. Run tests and quality checks: `pnpm check`
6. Commit using conventional commit format
7. Submit a pull request

See the detailed [Contributing Guide](docs/contributing.md) for more information.

## 🚀 Quick Reference

### Essential Commands

```bash
# Setup and installation
pnpm install                 # Install all dependencies
cp .env.example .env.local   # Set up environment

# Development
pnpm dev                     # Start all development servers
pnpm dev:frontend            # Start frontend only
pnpm dev:backend             # Start backend only

# Code Quality
pnpm check                   # Run all quality checks
pnpm lint --fix              # Fix linting issues
pnpm format                  # Format all code
pnpm type-check              # TypeScript checking

# Testing
pnpm test                    # Run all tests
pnpm test:frontend           # Frontend tests only
pnpm test:backend            # Backend tests only

# Building
pnpm build                   # Build all packages/apps
pnpm clean                   # Clean build artifacts
```

### Adding New Code

```bash
# Add new package dependency
pnpm add <package> --filter <workspace-name>

# Create new package
mkdir packages/new-package
# See docs/adding-packages.md for complete guide

# Run workspace-specific commands
pnpm --filter <workspace-name> <command>
```

### Troubleshooting

```bash
# Reset environment
pnpm clean && pnpm install

# Check port usage
lsof -i :3000  # Frontend
lsof -i :8000  # Backend

# Debug with verbose logging
DEBUG=* pnpm dev
```

For more help, see the [Troubleshooting Guide](docs/troubleshooting.md).

## 📄 License

[Add your license information here]

---

**Built with ❤️ using AI-first development practices**
