# Deployment Guide

This guide covers deployment strategies, environments, and automation for the AI-First Modular Monorepo.

## Overview

Our deployment strategy supports:

- **Multiple environments** (development, staging, production)
- **Independent service deployment** (frontend, backend, packages)
- **Automated CI/CD pipelines** with GitHub Actions
- **Rollback capabilities** for failed deployments
- **Environment-specific configurations**

## Deployment Environments

### Development

- **Purpose**: Local development and testing
- **Access**: Developer machines only
- **Database**: SQLite or local PostgreSQL
- **Services**: All services run locally

### Staging

- **Purpose**: Pre-production testing and QA
- **Access**: Internal team and stakeholders
- **Database**: Hosted PostgreSQL (separate from production)
- **Services**: Deployed to cloud platforms
- **URL**: `https://staging.example.com`

### Production

- **Purpose**: Live application for end users
- **Access**: Public users
- **Database**: Production PostgreSQL with backups
- **Services**: High-availability cloud deployment
- **URL**: `https://app.example.com`

## Platform Configuration

### Frontend Deployment (Vercel)

#### Automatic Deployments

```yaml
# vercel.json
{
  'name': 'monorepo-frontend',
  'version': 2,
  'builds':
    [
      {
        'src': 'apps/frontend/package.json',
        'use': '@vercel/static-build',
        'config': { 'distDir': 'dist' },
      },
    ],
  'routes': [{ 'src': '/(.*)', 'dest': '/apps/frontend/dist/$1' }],
  'env': { 'NODE_ENV': 'production', 'API_BASE_URL': 'https://api.example.com' },
}
```

#### Manual Deployment

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy to staging
cd apps/frontend
vercel --target staging

# Deploy to production
vercel --prod
```

### Backend Deployment (Railway)

#### Railway Configuration

```toml
# railway.toml
[build]
builder = "nixpacks"
watchPatterns = ["apps/backend/**"]

[deploy]
startCommand = "python manage.py migrate && python manage.py collectstatic --noinput && gunicorn backend.wsgi:application"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

[environments.staging]
variables = { DJANGO_SETTINGS_MODULE = "backend.settings.staging" }

[environments.production]
variables = { DJANGO_SETTINGS_MODULE = "backend.settings.production" }
```

#### Manual Deployment

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Deploy to staging
railway deploy --service backend-staging

# Deploy to production
railway deploy --service backend-production
```

## Docker Deployment

### Multi-stage Frontend Dockerfile

```dockerfile
# apps/frontend/Dockerfile
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/*/package.json ./packages/*/

# Install pnpm and dependencies
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm --filter frontend build

# Production stage
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html

# Copy nginx configuration
COPY apps/frontend/nginx.conf /etc/nginx/nginx.conf

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

### Backend Dockerfile

```dockerfile
# apps/backend/Dockerfile
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=backend.settings.production

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        postgresql-client \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY apps/backend/requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy project
COPY apps/backend/ /app/
COPY packages/shared/ /app/shared/

# Collect static files
RUN python manage.py collectstatic --noinput

# Expose port
EXPOSE 8000

# Run migrations and start server
CMD ["sh", "-c", "python manage.py migrate && gunicorn backend.wsgi:application --bind 0.0.0.0:8000"]
```

### Docker Compose for Local Development

```yaml
# docker-compose.yml
version: '3.8'

services:
  frontend:
    build:
      context: .
      dockerfile: apps/frontend/Dockerfile
      target: builder
    ports:
      - '3000:3000'
    volumes:
      - ./apps/frontend/src:/app/apps/frontend/src
    environment:
      - NODE_ENV=development
      - API_BASE_URL=http://backend:8000
    command: pnpm --filter frontend dev

  backend:
    build:
      context: .
      dockerfile: apps/backend/Dockerfile
    ports:
      - '8000:8000'
    volumes:
      - ./apps/backend:/app
    environment:
      - DJANGO_SETTINGS_MODULE=backend.settings.development
      - DATABASE_URL=postgresql://postgres:password@db:5432/monorepo
    depends_on:
      - db
    command: python manage.py runserver 0.0.0.0:8000

  db:
    image: postgres:15
    volumes:
      - postgres_data:/var/lib/postgresql/data/
    environment:
      - POSTGRES_DB=monorepo
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    ports:
      - '5432:5432'

volumes:
  postgres_data:
```

## Environment Configuration

### Environment Variables

#### Frontend (.env)

```bash
# Development
VITE_API_BASE_URL=http://localhost:8000
VITE_APP_ENV=development

# Staging
VITE_API_BASE_URL=https://api-staging.railway.app
VITE_APP_ENV=staging

# Production
VITE_API_BASE_URL=https://api.railway.app
VITE_APP_ENV=production
```

#### Backend (.env)

```bash
# Development
DJANGO_SETTINGS_MODULE=backend.settings.development
DEBUG=True
DATABASE_URL=sqlite:///db.sqlite3
SECRET_KEY=your-dev-secret-key

# Staging
DJANGO_SETTINGS_MODULE=backend.settings.staging
DEBUG=False
DATABASE_URL=postgresql://user:pass@host:port/db
SECRET_KEY=your-staging-secret-key
ALLOWED_HOSTS=api-staging.railway.app

# Production
DJANGO_SETTINGS_MODULE=backend.settings.production
DEBUG=False
DATABASE_URL=postgresql://user:pass@host:port/db
SECRET_KEY=your-production-secret-key
ALLOWED_HOSTS=api.railway.app
```

### Django Settings Structure

```python
# backend/settings/base.py
from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = os.environ.get('SECRET_KEY')
DEBUG = os.environ.get('DEBUG', 'False').lower() == 'true'
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', '').split(',')

# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME'),
        'USER': os.environ.get('DB_USER'),
        'PASSWORD': os.environ.get('DB_PASSWORD'),
        'HOST': os.environ.get('DB_HOST'),
        'PORT': os.environ.get('DB_PORT', '5432'),
    }
}

# Static files
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# CORS settings
CORS_ALLOWED_ORIGINS = [
    "https://app.example.com",
    "https://staging.example.com",
]

if DEBUG:
    CORS_ALLOWED_ORIGINS.append("http://localhost:3000")
```

```python
# backend/settings/production.py
from .base import *

DEBUG = False

# Security settings
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_SECONDS = 31536000
SECURE_REDIRECT_EXEMPT = []
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': '/var/log/django.log',
        },
    },
    'root': {
        'handlers': ['file'],
    },
}
```

## CI/CD Automation

### GitHub Actions Deployment

Our CI/CD pipeline automatically:

1. **Detects changes** in packages
2. **Runs tests** for affected packages
3. **Builds artifacts** for deployment
4. **Deploys to staging** on main branch push
5. **Deploys to production** on release tag

### Manual Deployment Triggers

```bash
# Trigger deployment via GitHub CLI
gh workflow run deploy.yml \
  -f environment=production \
  -f force_deploy=true

# Create release and deploy
gh release create v1.0.0 \
  --title "Release v1.0.0" \
  --notes "Release notes here"
```

### Deployment Verification

```bash
# Health check endpoints
curl -f https://app.example.com/health
curl -f https://api.example.com/health

# Verify deployment
gh run list --workflow=deploy.yml
gh run view <run-id>
```

## Database Management

### Migrations

```bash
# Create migration
python manage.py makemigrations

# Apply migrations (automatic in deployment)
python manage.py migrate

# Rollback migration
python manage.py migrate app_name 0001
```

### Backups

```bash
# Create backup
pg_dump $DATABASE_URL > backup.sql

# Restore backup
psql $DATABASE_URL < backup.sql

# Automated backups (Railway)
railway run pg_dump $DATABASE_URL | gzip > backup-$(date +%Y%m%d).sql.gz
```

## Monitoring and Logging

### Health Checks

```python
# backend/health/views.py
from django.http import JsonResponse
from django.db import connection

def health_check(request):
    try:
        # Test database connection
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")

        return JsonResponse({
            'status': 'healthy',
            'database': 'connected',
            'version': '1.0.0'
        })
    except Exception as e:
        return JsonResponse({
            'status': 'unhealthy',
            'error': str(e)
        }, status=500)
```

### Logging Configuration

```python
# Django logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose'
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
}
```

## Rollback Procedures

### Application Rollback

```bash
# Rollback to previous Vercel deployment
vercel rollback <deployment-url>

# Rollback Railway deployment
railway rollback --service backend-production

# Manual rollback using GitHub
gh workflow run deploy.yml \
  -f environment=production \
  -f version=v1.0.0
```

### Database Rollback

```bash
# Rollback Django migration
python manage.py migrate app_name 0001

# Restore from backup
psql $DATABASE_URL < backup-20231201.sql
```

### Emergency Procedures

1. **Identify the issue** and impact
2. **Communicate** with the team
3. **Rollback** application if needed
4. **Restore database** from backup if necessary
5. **Investigate** root cause
6. **Document** incident and resolution

## Performance Optimization

### Frontend Optimization

- **Code splitting** for reduced bundle sizes
- **CDN delivery** via Vercel Edge Network
- **Image optimization** with Vercel Image API
- **Caching headers** for static assets

### Backend Optimization

- **Database indexing** for query performance
- **Connection pooling** for database efficiency
- **Redis caching** for frequently accessed data
- **API rate limiting** for stability

### Infrastructure Scaling

- **Horizontal scaling** with multiple instances
- **Load balancing** for traffic distribution
- **Auto-scaling** based on metrics
- **Resource monitoring** and alerting

## Security Considerations

### Secrets Management

- Use platform-specific secret management
- Never commit secrets to repository
- Rotate secrets regularly
- Use different secrets per environment

### HTTPS and SSL

- Always use HTTPS in production
- Automatic SSL certificates via platforms
- HSTS headers for security
- CSP headers for XSS protection

### Access Control

- Principle of least privilege
- Environment-specific access controls
- Audit logs for deployment activities
- Multi-factor authentication for deployments

## Troubleshooting

### Common Deployment Issues

#### Build Failures

```bash
# Check build logs
vercel logs <deployment-url>
railway logs --service backend-production

# Local reproduction
pnpm build
python manage.py collectstatic
```

#### Runtime Errors

```bash
# Check application logs
vercel logs --follow
railway logs --follow --service backend-production

# Health check debugging
curl -v https://api.example.com/health
```

#### Database Issues

```bash
# Test database connection
psql $DATABASE_URL -c "SELECT version();"

# Check migration status
python manage.py showmigrations
```

### Support Resources

1. **Platform Documentation**
   - [Vercel Docs](https://vercel.com/docs)
   - [Railway Docs](https://docs.railway.app)

2. **Internal Resources**
   - Check GitHub Actions logs
   - Review deployment history
   - Consult team members

3. **Emergency Contacts**
   - On-call engineer
   - Platform support
   - Infrastructure team

This deployment guide ensures reliable, scalable, and secure deployment of the AI-First Modular Monorepo across all environments.
