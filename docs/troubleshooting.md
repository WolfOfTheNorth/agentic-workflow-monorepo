# Troubleshooting Guide

This guide covers common issues and their solutions when working with the AI-First Modular Monorepo.

## Quick Diagnostics

Run these commands to quickly diagnose issues:

```bash
# Check system requirements
node --version    # Should be 20+
python --version  # Should be 3.11+
pnpm --version   # Should be 9.15+

# Check workspace health
pnpm list --depth=0
pnpm audit
pnpm outdated
```

## Installation Issues

### pnpm Installation Fails

**Problem**: `pnpm install` fails or hangs

**Solutions**:

```bash
# Clear pnpm cache
pnpm store prune

# Remove lockfile and node_modules
rm -rf node_modules pnpm-lock.yaml
rm -rf apps/*/node_modules packages/*/node_modules

# Reinstall with verbose logging
pnpm install --verbose

# If still failing, try with --shamefully-hoist
pnpm install --shamefully-hoist
```

### Python/Django Setup Issues

**Problem**: Django backend fails to start

**Solutions**:

```bash
# Check Python version
python --version  # Must be 3.11+

# Recreate virtual environment
cd apps/backend
rm -rf .venv
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install requirements
pip install --upgrade pip
pip install -r requirements.txt

# Check for missing system dependencies (Ubuntu/Debian)
sudo apt-get install python3-dev libpq-dev

# Check for missing system dependencies (macOS)
brew install postgresql
```

### Node Version Issues

**Problem**: Node version conflicts or TypeScript errors

**Solutions**:

```bash
# Use correct Node version
nvm use  # Uses version from .nvmrc

# If .nvmrc version not installed
nvm install $(cat .nvmrc)
nvm use $(cat .nvmrc)

# Clear Node modules and reinstall
rm -rf node_modules
pnpm install
```

## Development Server Issues

### Port Conflicts

**Problem**: "Port already in use" errors

**Solutions**:

```bash
# Find what's using the port
lsof -i :3000  # Frontend
lsof -i :8000  # Backend

# Kill processes on ports
kill -9 $(lsof -ti:3000)
kill -9 $(lsof -ti:8000)

# Use different ports in .env.local
FRONTEND_PORT=3001
BACKEND_PORT=8001
```

### Frontend Not Connecting to Backend

**Problem**: API calls fail or CORS errors

**Solutions**:

1. **Check environment variables**:

   ```bash
   # In .env.local
   VITE_API_BASE_URL=http://localhost:8000
   ```

2. **Verify backend is running**:

   ```bash
   curl http://localhost:8000/api/health
   ```

3. **Check Django CORS settings**:
   ```python
   # apps/backend/settings.py
   CORS_ALLOWED_ORIGINS = [
       "http://localhost:3000",
       "http://127.0.0.1:3000",
   ]
   ```

### Hot Reload Not Working

**Problem**: Changes not reflected in browser

**Solutions**:

```bash
# Increase file watching limits (Linux)
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p

# Clear browser cache
# Hard refresh: Ctrl+F5 (Windows/Linux) or Cmd+Shift+R (Mac)

# Restart development servers
pnpm dev:frontend
pnpm dev:backend
```

## Build Issues

### TypeScript Compilation Errors

**Problem**: TypeScript build fails or path resolution issues

**Solutions**:

```bash
# Clear TypeScript cache
rm -rf apps/*/dist packages/*/dist
rm -rf apps/*/.tsbuildinfo packages/*/.tsbuildinfo

# Rebuild project references
pnpm build

# Check TypeScript configuration
pnpm type-check --verbose

# Verify path mapping
cat tsconfig.json | grep -A 10 "paths"
```

### ESLint/Prettier Conflicts

**Problem**: Linting errors or formatting conflicts

**Solutions**:

```bash
# Fix auto-fixable issues
pnpm lint --fix

# Check for conflicting rules
pnpm eslint --print-config apps/frontend/src/App.tsx

# Reset formatting
pnpm format

# Check for conflicting configurations
find . -name ".eslintrc*" -o -name ".prettierrc*" | head -10
```

### Package Resolution Issues

**Problem**: "Module not found" or workspace dependency issues

**Solutions**:

```bash
# Check workspace configuration
cat pnpm-workspace.yaml

# Verify package locations
pnpm list --depth=0

# Rebuild workspace links
pnpm install --force

# Check specific package
pnpm --filter @agentic-workflow/shared list
```

## Environment Issues

### Environment Variables Not Loading

**Problem**: Environment variables undefined in application

**Solutions**:

1. **Check file naming**:

   ```bash
   # Correct files
   .env.local        # Local development (highest priority)
   .env.development  # Development environment
   .env.example      # Template (committed)

   # Incorrect files (won't be loaded)
   .env.development.local
   .env.dev
   ```

2. **Frontend environment variables**:

   ```bash
   # Must start with VITE_ prefix
   VITE_API_BASE_URL=http://localhost:8000
   VITE_APP_NAME=My App
   ```

3. **Backend environment variables**:

   ```bash
   # Django settings
   DJANGO_SECRET_KEY=your-secret-key
   DJANGO_DEBUG=true
   DATABASE_URL=sqlite:///db.sqlite3
   ```

4. **Restart servers after changes**:
   ```bash
   # Restart all development servers
   pnpm dev
   ```

### Database Issues

**Problem**: Django database errors

**Solutions**:

```bash
# Check database connection
cd apps/backend
python manage.py dbshell

# Reset database (development only)
rm db.sqlite3
python manage.py migrate

# Create new migrations
python manage.py makemigrations
python manage.py migrate

# Check migration status
python manage.py showmigrations
```

## Testing Issues

### Tests Failing

**Problem**: Unit tests or integration tests fail

**Solutions**:

```bash
# Run tests with verbose output
pnpm test --verbose

# Run specific test file
pnpm --filter frontend test Button.test.tsx

# Clear test cache
pnpm --filter frontend test --clearCache

# Check for conflicting global packages
npm list -g --depth=0
```

### E2E Tests Failing

**Problem**: Playwright end-to-end tests fail

**Solutions**:

```bash
# Install Playwright browsers
npx playwright install

# Run tests in headed mode for debugging
npx playwright test --headed

# Generate test traces
npx playwright test --trace on

# Check if applications are running
curl http://localhost:3000
curl http://localhost:8000
```

## Performance Issues

### Slow Build Times

**Problem**: Build process takes too long

**Solutions**:

```bash
# Enable build caching
pnpm config set store-dir ~/.pnpm-store

# Use parallel builds
pnpm -r --parallel build

# Increase Node.js memory
export NODE_OPTIONS="--max-old-space-size=4096"

# Profile build performance
time pnpm build
```

### High Memory Usage

**Problem**: Development servers consume excessive memory

**Solutions**:

```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Clear build artifacts
pnpm clean

# Restart development servers
pkill -f "node.*vite"
pkill -f "python.*manage.py"
pnpm dev
```

## IDE Issues

### VS Code Performance

**Problem**: VS Code slow or unresponsive

**Solutions**:

1. **Exclude large directories**:

   ```json
   // .vscode/settings.json
   {
     "files.watcherExclude": {
       "**/node_modules/**": true,
       "**/.git/**": true,
       "**/dist/**": true,
       "**/.venv/**": true
     }
   }
   ```

2. **Disable unnecessary extensions** for this workspace

3. **Restart TypeScript server**:
   - Cmd/Ctrl + Shift + P
   - "TypeScript: Restart TS Server"

### TypeScript Language Server Issues

**Problem**: IntelliSense not working or showing wrong errors

**Solutions**:

```bash
# Restart TypeScript server in VS Code
# Cmd/Ctrl + Shift + P -> "TypeScript: Restart TS Server"

# Check TypeScript version
npx tsc --version

# Verify workspace configuration
cat .vscode/settings.json
```

## Git and Version Control

### Pre-commit Hooks Failing

**Problem**: Git commits rejected by hooks

**Solutions**:

```bash
# Fix linting issues
pnpm lint --fix

# Fix formatting
pnpm format

# Run type checking
pnpm type-check

# Check commit message format
# Use: feat: add new feature
# Not: Added new feature

# Skip hooks temporarily (emergency only)
git commit --no-verify -m "fix: emergency commit"
```

### Merge Conflicts in Lockfiles

**Problem**: pnpm-lock.yaml merge conflicts

**Solutions**:

```bash
# Delete lockfile and reinstall
rm pnpm-lock.yaml
pnpm install

# Commit the new lockfile
git add pnpm-lock.yaml
git commit -m "fix: resolve lockfile conflicts"
```

## Advanced Debugging

### Enable Debug Logging

```bash
# Enable debug logging for all tools
DEBUG=* pnpm dev

# Enable specific debug namespaces
DEBUG=vite:* pnpm dev:frontend
DEBUG=pnpm* pnpm install
```

### Network Issues

```bash
# Check network connectivity
ping 8.8.8.8

# Check DNS resolution
nslookup localhost

# Test API endpoints
curl -v http://localhost:8000/api/health
```

### File Permission Issues

```bash
# Fix file permissions (Unix/Linux/Mac)
sudo chown -R $USER:$USER .
chmod -R 755 .

# Fix script permissions
chmod +x scripts/*.sh
```

## Getting Additional Help

### Diagnostic Information

When reporting issues, please include:

```bash
# System information
uname -a
node --version
python --version
pnpm --version

# Project information
cat package.json | grep version
pnpm list --depth=0

# Error logs
pnpm dev 2>&1 | tee debug.log
```

### Resources

1. **Documentation**: Check other files in `docs/` directory
2. **GitHub Issues**: Search existing issues
3. **Package Documentation**: Check individual package READMEs
4. **Community**: Join discussions for questions

### Creating Support Requests

When creating an issue:

1. **Use the issue template**
2. **Provide reproducible steps**
3. **Include system information**
4. **Attach relevant logs**
5. **Describe expected vs actual behavior**

## Emergency Procedures

### Complete Reset

If all else fails:

```bash
# Back up your changes
git stash

# Clean everything
rm -rf node_modules pnpm-lock.yaml
rm -rf apps/*/node_modules packages/*/node_modules
rm -rf apps/*/dist packages/*/dist
rm -rf apps/*/.next apps/*/.vite

# Reinstall
pnpm install

# Restore changes
git stash pop
```

### Rollback to Working State

```bash
# Find last working commit
git log --oneline

# Create backup branch
git checkout -b backup-$(date +%Y%m%d)

# Reset to working commit
git checkout main
git reset --hard <working-commit-hash>

# Force push (only if necessary and safe)
git push --force-with-lease origin main
```

Remember: When in doubt, create a backup branch before making major changes!
