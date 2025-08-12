# Environment Setup Guide

This document provides detailed instructions for setting up environment variables and configuration for the authentication system.

## Required Environment Variables

### Frontend Environment Variables (Vite)

#### `.env.local` (Development)

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-dev-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-dev-anon-key

# Authentication Configuration
VITE_AUTH_REDIRECT_URL=http://localhost:3000/auth/callback
VITE_AUTH_SESSION_TIMEOUT=3600000

# Application Configuration
VITE_APP_BASE_URL=http://localhost:3000
VITE_APP_ENVIRONMENT=development

# Security (Development only)
VITE_ENABLE_DEBUG_MODE=true
VITE_BYPASS_CSRF=false
```

#### `.env.production` (Production)

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-prod-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-prod-anon-key

# Authentication Configuration
VITE_AUTH_REDIRECT_URL=https://your-domain.com/auth/callback
VITE_AUTH_SESSION_TIMEOUT=1800000

# Application Configuration
VITE_APP_BASE_URL=https://your-domain.com
VITE_APP_ENVIRONMENT=production

# Security
VITE_ENABLE_DEBUG_MODE=false
VITE_BYPASS_CSRF=false

# Optional: Analytics and Monitoring
VITE_ANALYTICS_ID=your-analytics-id
VITE_SENTRY_DSN=your-sentry-dsn
```

### Backend Environment Variables (Django)

#### `.env` (Development)

```bash
# Django Configuration
DEBUG=True
SECRET_KEY=your-super-secret-development-key
ALLOWED_HOSTS=localhost,127.0.0.1

# Database Configuration
DATABASE_URL=sqlite:///db.sqlite3

# Supabase Configuration (if needed for server-side operations)
SUPABASE_URL=https://your-dev-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-dev-service-role-key

# Security
CORS_ALLOWED_ORIGINS=http://localhost:3000
CSRF_TRUSTED_ORIGINS=http://localhost:3000

# Email Configuration (Development)
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
```

#### `.env.production` (Production)

```bash
# Django Configuration
DEBUG=False
SECRET_KEY=your-super-secret-production-key
ALLOWED_HOSTS=your-domain.com,www.your-domain.com

# Database Configuration
DATABASE_URL=postgresql://user:password@host:port/database

# Supabase Configuration
SUPABASE_URL=https://your-prod-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-prod-service-role-key

# Security
CORS_ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
CSRF_TRUSTED_ORIGINS=https://your-domain.com,https://www.your-domain.com

# SSL Configuration
SECURE_SSL_REDIRECT=True
SECURE_HSTS_SECONDS=31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS=True
SECURE_HSTS_PRELOAD=True

# Email Configuration (Production)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.your-provider.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@domain.com
EMAIL_HOST_PASSWORD=your-email-password
```

## Environment Validation

### Frontend Validation

Add this to your Vite config to validate required environment variables:

```typescript
// vite.config.ts
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Validate required environment variables
  const requiredEnvVars = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];

  const missingVars = requiredEnvVars.filter(varName => !env[varName]);

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  return {
    // Your Vite config
  };
});
```

### Backend Validation

Add this to your Django settings:

```python
# settings.py
import os
from django.core.exceptions import ImproperlyConfigured

def get_env_variable(var_name, default=None):
    """Get the environment variable or return exception."""
    try:
        return os.environ[var_name]
    except KeyError:
        if default is not None:
            return default
        error_msg = f"Set the {var_name} environment variable"
        raise ImproperlyConfigured(error_msg)

# Required environment variables
SUPABASE_URL = get_env_variable('SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = get_env_variable('SUPABASE_SERVICE_ROLE_KEY')
```

## Configuration Management

### Using python-dotenv (Backend)

Install and configure python-dotenv:

```bash
pip install python-dotenv
```

```python
# settings.py
from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_env = load_dotenv()

# Now you can access environment variables
SECRET_KEY = os.getenv('SECRET_KEY')
```

### Using cross-env (Frontend)

For consistent environment variables across platforms:

```bash
npm install --save-dev cross-env
```

```json
{
  "scripts": {
    "dev": "cross-env NODE_ENV=development vite",
    "build": "cross-env NODE_ENV=production vite build"
  }
}
```

## Security Best Practices

### Environment Variable Security

1. **Never commit `.env` files to version control**:

   ```gitignore
   # .gitignore
   .env
   .env.local
   .env.production
   .env.staging
   ```

2. **Use different keys for different environments**:
   - Development: Use development Supabase project
   - Staging: Use staging Supabase project
   - Production: Use production Supabase project

3. **Rotate secrets regularly**:
   - Service role keys should be rotated quarterly
   - Database passwords should be rotated monthly
   - API keys should be monitored and rotated as needed

4. **Use secret management services for production**:
   - AWS Secrets Manager
   - Azure Key Vault
   - Google Secret Manager
   - HashiCorp Vault

### Example Secret Management (AWS)

```python
# utils/secrets.py
import boto3
import json
from django.conf import settings

def get_secret(secret_name):
    """Retrieve secret from AWS Secrets Manager."""
    session = boto3.session.Session()
    client = session.client(
        service_name='secretsmanager',
        region_name=settings.AWS_REGION
    )

    try:
        response = client.get_secret_value(SecretId=secret_name)
        secret = json.loads(response['SecretString'])
        return secret
    except Exception as e:
        raise Exception(f"Failed to retrieve secret {secret_name}: {str(e)}")

# Usage in settings.py
if settings.ENVIRONMENT == 'production':
    secrets = get_secret('agentic-workflow/production')
    SUPABASE_SERVICE_ROLE_KEY = secrets['supabase_service_role_key']
```

## Platform-Specific Setup

### Vercel Deployment

1. **Environment Variables in Vercel Dashboard**:
   - Go to Project Settings → Environment Variables
   - Add all `VITE_*` variables
   - Set different values for Preview and Production

2. **Vercel Configuration**:
   ```json
   {
     "buildCommand": "pnpm build:frontend",
     "outputDirectory": "apps/frontend/dist",
     "installCommand": "pnpm install",
     "env": {
       "VITE_SUPABASE_URL": "@supabase-url",
       "VITE_SUPABASE_ANON_KEY": "@supabase-anon-key"
     }
   }
   ```

### Netlify Deployment

1. **netlify.toml Configuration**:

   ```toml
   [build]
   command = "pnpm build:frontend"
   publish = "apps/frontend/dist"

   [build.environment]
   NODE_VERSION = "20"
   VITE_SUPABASE_URL = "https://your-project.supabase.co"

   [context.production.environment]
   VITE_APP_ENVIRONMENT = "production"

   [context.deploy-preview.environment]
   VITE_APP_ENVIRONMENT = "preview"
   ```

### Railway Deployment

1. **Railway Environment Variables**:

   ```bash
   # Set via Railway CLI
   railway variables set SUPABASE_URL=https://your-project.supabase.co
   railway variables set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

2. **Railway Configuration**:

   ```toml
   # railway.toml
   [build]
   builder = "NIXPACKS"

   [deploy]
   startCommand = "python manage.py migrate && python manage.py runserver 0.0.0.0:$PORT"
   healthcheckPath = "/health/"
   healthcheckTimeout = 300
   restartPolicyType = "ON_FAILURE"
   ```

### Docker Deployment

1. **Environment File for Docker**:

   ```bash
   # .env.docker
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

2. **Docker Compose with Environment**:

   ```yaml
   # docker-compose.yml
   version: '3.8'
   services:
     frontend:
       build: ./apps/frontend
       environment:
         - VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
         - VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
       env_file:
         - .env.docker

     backend:
       build: ./apps/backend
       environment:
         - SUPABASE_URL=${SUPABASE_URL}
         - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
       env_file:
         - .env.docker
   ```

## Environment Debugging

### Frontend Debugging

```typescript
// utils/env-debug.ts
export function debugEnvironment() {
  if (import.meta.env.DEV) {
    console.log('Environment Variables:');
    console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);
    console.log('VITE_APP_ENVIRONMENT:', import.meta.env.VITE_APP_ENVIRONMENT);

    // Never log sensitive keys in production
    if (import.meta.env.VITE_ENABLE_DEBUG_MODE === 'true') {
      console.log(
        'VITE_SUPABASE_ANON_KEY:',
        import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 10) + '...'
      );
    }
  }
}
```

### Backend Debugging

```python
# utils/env_debug.py
import os
from django.conf import settings

def debug_environment():
    """Debug environment variables (development only)."""
    if settings.DEBUG:
        print("Environment Variables:")
        print(f"SUPABASE_URL: {os.getenv('SUPABASE_URL', 'Not set')}")
        print(f"DATABASE_URL: {os.getenv('DATABASE_URL', 'Not set')}")

        # Never log sensitive keys
        service_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')
        if service_key:
            print(f"SUPABASE_SERVICE_ROLE_KEY: {service_key[:10]}...")
        else:
            print("SUPABASE_SERVICE_ROLE_KEY: Not set")
```

## Troubleshooting

### Common Issues

1. **Environment variables not loading**:

   ```bash
   # Check if .env file exists
   ls -la .env*

   # Check file permissions
   chmod 644 .env.local

   # Verify variables are exported
   echo $VITE_SUPABASE_URL
   ```

2. **Vite not picking up environment variables**:
   - Ensure variables start with `VITE_`
   - Restart the development server
   - Check that .env.local is in the root directory

3. **Django not loading environment variables**:

   ```python
   # Add this to manage.py to debug
   import os
   print("Current working directory:", os.getcwd())
   print("Environment file exists:", os.path.exists('.env'))
   ```

4. **Production environment variables not working**:
   - Verify deployment platform has the variables set
   - Check for typos in variable names
   - Ensure production values are different from development

### Validation Script

Create a script to validate your environment setup:

```bash
#!/bin/bash
# scripts/validate-env.sh

echo "Validating environment setup..."

# Check required files
if [ ! -f ".env.local" ]; then
    echo "❌ .env.local file not found"
    exit 1
fi

# Check required variables
required_vars=("VITE_SUPABASE_URL" "VITE_SUPABASE_ANON_KEY")

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ $var is not set"
        exit 1
    else
        echo "✅ $var is set"
    fi
done

echo "✅ Environment setup is valid!"
```

This environment setup guide ensures your authentication system is properly configured across all deployment environments.
