# Authentication System Deployment Guide

This document provides comprehensive deployment instructions for the authentication system across different environments, including Supabase setup and configuration.

## Table of Contents

1. [Environment Setup](#environment-setup)
2. [Supabase Configuration](#supabase-configuration)
3. [Development Setup](#development-setup)
4. [Production Deployment](#production-deployment)
5. [Security Checklist](#security-checklist)
6. [Monitoring and Maintenance](#monitoring-and-maintenance)
7. [Troubleshooting](#troubleshooting)

## Environment Setup

### Required Environment Variables

Create the following environment files for different deployment stages:

#### Core Supabase Configuration

```bash
# Supabase Connection
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database Connection (if using custom database)
DATABASE_URL=postgresql://user:pass@host:port/db
```

#### Authentication Configuration

```bash
# Token Settings
AUTH_TOKEN_EXPIRATION=3600          # 1 hour in seconds
AUTH_REFRESH_THRESHOLD=300          # 5 minutes in seconds
AUTH_MAX_LOGIN_ATTEMPTS=5           # Maximum login attempts
AUTH_RATE_LIMIT_WINDOW=300          # 5 minutes in seconds

# Session Management
SESSION_COOKIE_SECURE=true          # Use secure cookies in production
SESSION_COOKIE_HTTPONLY=true        # Prevent XSS attacks
SESSION_COOKIE_SAMESITE=strict      # CSRF protection
```

#### Performance Configuration

```bash
# Caching
CACHE_PROFILE_TTL=300000            # 5 minutes in milliseconds
CACHE_MAX_SIZE=1000                 # Maximum cached profiles
ENABLE_REQUEST_DEDUPLICATION=true   # Enable request deduplication
PERFORMANCE_WARNING_THRESHOLD=2000  # 2 seconds in milliseconds

# Connection Pooling
DATABASE_POOL_SIZE=20               # Database connection pool size
DATABASE_POOL_TIMEOUT=30000         # Pool timeout in milliseconds
```

#### Analytics and Monitoring

```bash
# Analytics Configuration
ENABLE_ANALYTICS=true               # Enable analytics tracking
ENABLE_ERROR_TRACKING=true          # Enable error tracking
ANALYTICS_RETENTION_DAYS=30         # Data retention period
ENABLE_AUTO_REPORTING=true          # Enable automatic reporting

# Monitoring
ENABLE_HEALTH_CHECKS=true           # Enable health check endpoints
HEALTH_CHECK_INTERVAL=30000         # Health check interval
MONITORING_ENDPOINT=/health         # Health check endpoint path
```

#### Security Configuration

```bash
# CORS Settings
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
CORS_CREDENTIALS=true               # Allow credentials in CORS

# Rate Limiting
RATE_LIMIT_ENABLED=true             # Enable rate limiting
RATE_LIMIT_WINDOW=900000            # 15 minutes in milliseconds
RATE_LIMIT_MAX_REQUESTS=100         # Maximum requests per window

# Security Headers
ENABLE_SECURITY_HEADERS=true        # Enable security headers
HSTS_MAX_AGE=31536000              # HSTS max age (1 year)
```

#### Logging Configuration

```bash
# Log Levels
LOG_LEVEL=info                      # info, debug, warn, error
ENABLE_STRUCTURED_LOGGING=true      # Enable structured JSON logging
LOG_ANALYTICS_EVENTS=false          # Log analytics events (development only)

# Log Destinations
LOG_TO_CONSOLE=true                 # Log to console
LOG_TO_FILE=false                   # Log to file (not recommended in containers)
LOG_FILE_PATH=/var/log/app.log      # Log file path if enabled
```

### Environment-Specific Configurations

#### Development (.env.local)

```bash
# Development-specific settings
NODE_ENV=development
ENABLE_DEBUG_MODE=true
LOG_LEVEL=debug
LOG_ANALYTICS_EVENTS=true
CACHE_MAX_SIZE=100
ENABLE_AUTO_REPORTING=false

# Development Supabase project
SUPABASE_URL=https://dev-project.supabase.co
SUPABASE_ANON_KEY=dev-anon-key
```

#### Staging (.env.staging)

```bash
# Staging environment
NODE_ENV=staging
ENABLE_DEBUG_MODE=false
LOG_LEVEL=info
CACHE_MAX_SIZE=500
ANALYTICS_RETENTION_DAYS=7

# Staging Supabase project
SUPABASE_URL=https://staging-project.supabase.co
SUPABASE_ANON_KEY=staging-anon-key
```

#### Production (.env.production)

```bash
# Production environment
NODE_ENV=production
ENABLE_DEBUG_MODE=false
LOG_LEVEL=warn
CACHE_MAX_SIZE=1000
ANALYTICS_RETENTION_DAYS=90
ENABLE_AUTO_REPORTING=true

# Production Supabase project
SUPABASE_URL=https://prod-project.supabase.co
SUPABASE_ANON_KEY=prod-anon-key
```

## Development Setup

### Local Development

1. **Install Dependencies**:

   ```bash
   # Install all dependencies
   pnpm install

   # Verify installation
   pnpm list @supabase/supabase-js
   ```

2. **Environment Setup**:

   ```bash
   # Copy environment template
   cp .env.example .env.local

   # Edit environment variables
   vim .env.local
   ```

3. **Start Development Server**:

   ```bash
   # Start all services
   pnpm dev

   # Or start API only
   pnpm dev:backend
   ```

4. **Verify Setup**:

   ```bash
   # Check health endpoint
   curl http://localhost:8000/health

   # Test authentication
   curl -X POST http://localhost:8000/api/auth/test \
     -H "Content-Type: application/json"
   ```

### Development Tools

#### Health Check Script

```bash
#!/bin/bash
# scripts/dev-health-check.sh

echo "Running development health checks..."

# Check API server
if curl -f http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ API server is running"
else
    echo "❌ API server is not responding"
    exit 1
fi

# Check Supabase connection
if curl -f http://localhost:8000/api/auth/health > /dev/null 2>&1; then
    echo "✅ Supabase connection is working"
else
    echo "❌ Supabase connection failed"
    exit 1
fi

# Check database connection (if applicable)
if pnpm run db:ping > /dev/null 2>&1; then
    echo "✅ Database connection is working"
else
    echo "⚠️  Database connection check skipped or failed"
fi

echo "Development environment is ready!"
```

## Staging Deployment

### Docker Setup for Staging

#### Dockerfile

```dockerfile
# Use official Node.js runtime
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY packages/api/package.json ./packages/api/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/api ./packages/api
COPY packages/shared ./packages/shared

# Build the application
RUN pnpm build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Change ownership of the app directory
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Start the application
CMD ["pnpm", "start"]
```

#### Docker Compose for Staging

```yaml
# docker-compose.staging.yml
version: '3.8'

services:
  api:
    build: .
    ports:
      - '8000:8000'
    environment:
      - NODE_ENV=staging
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
    env_file:
      - .env.staging
    restart: unless-stopped
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:8000/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  nginx:
    image: nginx:alpine
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl/certs
    depends_on:
      - api
    restart: unless-stopped
```

### Staging Deployment Process

1. **Build and Test**:

   ```bash
   # Build application
   pnpm build

   # Run tests
   pnpm test
   pnpm test:integration

   # Build Docker image
   docker build -t agentic-workflow-api:staging .
   ```

2. **Deploy to Staging**:

   ```bash
   # Deploy with Docker Compose
   docker-compose -f docker-compose.staging.yml up -d

   # Wait for services to be ready
   ./scripts/wait-for-services.sh

   # Run smoke tests
   ./scripts/staging-smoke-tests.sh
   ```

3. **Verify Deployment**:

   ```bash
   # Check service health
   curl https://staging.yourdomain.com/health

   # Test authentication flow
   ./scripts/test-auth-flow.sh staging
   ```

## Production Deployment

### Kubernetes Deployment

#### Deployment Configuration

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agentic-workflow-api
  labels:
    app: agentic-workflow-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: agentic-workflow-api
  template:
    metadata:
      labels:
        app: agentic-workflow-api
    spec:
      containers:
        - name: api
          image: your-registry/agentic-workflow-api:latest
          ports:
            - containerPort: 8000
          env:
            - name: NODE_ENV
              value: 'production'
            - name: SUPABASE_URL
              valueFrom:
                secretKeyRef:
                  name: supabase-secrets
                  key: url
            - name: SUPABASE_ANON_KEY
              valueFrom:
                secretKeyRef:
                  name: supabase-secrets
                  key: anon-key
            - name: SUPABASE_SERVICE_ROLE_KEY
              valueFrom:
                secretKeyRef:
                  name: supabase-secrets
                  key: service-role-key
          resources:
            requests:
              memory: '256Mi'
              cpu: '250m'
            limits:
              memory: '512Mi'
              cpu: '500m'
          livenessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 8000
            initialDelaySeconds: 5
            periodSeconds: 5
          lifecycle:
            preStop:
              exec:
                command: ['/bin/sh', '-c', 'sleep 15']
---
apiVersion: v1
kind: Service
metadata:
  name: agentic-workflow-api-service
spec:
  selector:
    app: agentic-workflow-api
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8000
  type: ClusterIP
```

#### Secret Management

```yaml
# k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: supabase-secrets
type: Opaque
stringData:
  url: 'https://your-project.supabase.co'
  anon-key: 'your-anon-key'
  service-role-key: 'your-service-role-key'
```

#### ConfigMap for Configuration

```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  AUTH_TOKEN_EXPIRATION: '3600'
  AUTH_REFRESH_THRESHOLD: '300'
  CACHE_MAX_SIZE: '1000'
  ENABLE_ANALYTICS: 'true'
  LOG_LEVEL: 'info'
```

### Production Deployment Process

1. **Pre-Deployment Checks**:

   ```bash
   # Run all tests
   pnpm test
   pnpm test:integration
   pnpm test:e2e

   # Security scan
   pnpm audit
   npm audit

   # Build and push Docker image
   docker build -t your-registry/agentic-workflow-api:v1.0.0 .
   docker push your-registry/agentic-workflow-api:v1.0.0
   ```

2. **Deploy to Production**:

   ```bash
   # Apply Kubernetes configurations
   kubectl apply -f k8s/secrets.yaml
   kubectl apply -f k8s/configmap.yaml
   kubectl apply -f k8s/deployment.yaml

   # Wait for rollout to complete
   kubectl rollout status deployment/agentic-workflow-api

   # Verify pods are running
   kubectl get pods -l app=agentic-workflow-api
   ```

3. **Post-Deployment Verification**:

   ```bash
   # Check service health
   kubectl exec -it deployment/agentic-workflow-api -- curl http://localhost:8000/health

   # Test external access
   curl https://yourdomain.com/health

   # Run production smoke tests
   ./scripts/production-smoke-tests.sh
   ```

## Container Deployment

### Optimized Production Dockerfile

```dockerfile
# Multi-stage build for production
FROM node:18-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY packages/api/package.json ./packages/api/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/api ./packages/api
COPY packages/shared ./packages/shared

# Build application
RUN pnpm build

# Production stage
FROM node:18-alpine AS production

# Install pnpm
RUN npm install -g pnpm

# Create app directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY packages/api/package.json ./packages/api/

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy built application from builder stage
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership and switch to non-root user
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 8000

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8000/health || exit 1

# Start application
CMD ["pnpm", "start"]
```

### Container Security

#### Security Best Practices

```dockerfile
# Use specific version tags
FROM node:18.17.0-alpine

# Update packages for security
RUN apk update && apk upgrade

# Don't run as root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

# Use non-writable filesystem
COPY --chown=nodejs:nodejs . .

# Minimize attack surface
RUN rm -rf /usr/local/lib/node_modules/npm
```

#### Docker Security Scan

```bash
# Scan image for vulnerabilities
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  -v $HOME/Library/Caches:/root/.cache/ \
  aquasec/trivy image your-registry/agentic-workflow-api:latest

# Check for best practices
docker run --rm -i hadolint/hadolint < Dockerfile
```

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install pnpm
        run: npm install -g pnpm

      - name: Install dependencies
        run: pnpm install

      - name: Run tests
        run: |
          pnpm test
          pnpm test:integration
        env:
          SUPABASE_URL: ${{ secrets.TEST_SUPABASE_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.TEST_SUPABASE_ANON_KEY }}

      - name: Run security audit
        run: pnpm audit

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v2
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v4
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=sha,prefix={{branch}}-

      - name: Build and push Docker image
        uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production
    steps:
      - uses: actions/checkout@v3

      - name: Configure kubectl
        run: |
          echo "${{ secrets.KUBE_CONFIG }}" | base64 -d > kubeconfig
          export KUBECONFIG=kubeconfig

      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/agentic-workflow-api \
            api=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:main-${{ github.sha }}
          kubectl rollout status deployment/agentic-workflow-api

      - name: Verify deployment
        run: |
          kubectl get pods -l app=agentic-workflow-api
          ./scripts/production-smoke-tests.sh
```

### Deployment Scripts

#### Production Smoke Tests

```bash
#!/bin/bash
# scripts/production-smoke-tests.sh

set -e

echo "Running production smoke tests..."

BASE_URL="${1:-https://yourdomain.com}"

# Test health endpoint
echo "Testing health endpoint..."
curl -f "$BASE_URL/health" || exit 1

# Test authentication endpoints
echo "Testing authentication..."
curl -f "$BASE_URL/api/auth/health" || exit 1

# Test basic functionality
echo "Testing basic API functionality..."
response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/health")
if [ "$response" != "200" ]; then
    echo "API health check failed with status $response"
    exit 1
fi

echo "All smoke tests passed!"
```

## Health Checks

### Health Check Endpoints

Implement comprehensive health checks:

```typescript
// src/routes/health.ts
import { Router } from 'express';
import { getSupabaseAdapter } from '../adapters/supabase';

const router = Router();

// Basic health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

// Detailed readiness check
router.get('/health/ready', async (req, res) => {
  try {
    const adapter = getSupabaseAdapter();

    // Test Supabase connection
    const connectionTest = await adapter.testConnection();

    // Test analytics monitor
    const healthMetrics = adapter.getSystemHealthMetrics();

    res.json({
      status: 'ready',
      checks: {
        supabase: connectionTest.success,
        analytics: !!healthMetrics,
        memory: process.memoryUsage(),
        uptime: process.uptime(),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// Liveness probe
router.get('/health/live', (req, res) => {
  const memUsage = process.memoryUsage();
  const isHealthy = memUsage.heapUsed < memUsage.heapTotal * 0.9;

  if (isHealthy) {
    res.json({ status: 'alive', timestamp: new Date().toISOString() });
  } else {
    res.status(503).json({
      status: 'unhealthy',
      reason: 'high memory usage',
      memory: memUsage,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
```

### Kubernetes Health Check Configuration

```yaml
# Health check configuration in deployment
livenessProbe:
  httpGet:
    path: /health/live
    port: 8000
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /health/ready
    port: 8000
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3
```

## Monitoring Setup

### Application Metrics

Set up application-level monitoring:

```typescript
// src/middleware/metrics.ts
import prometheus from 'prom-client';

// Create metrics
const httpRequests = new prometheus.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

const httpDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
});

const authMetrics = new prometheus.Counter({
  name: 'auth_operations_total',
  help: 'Total authentication operations',
  labelNames: ['operation', 'success'],
});

// Middleware to collect metrics
export function metricsMiddleware(req: any, res: any, next: any) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;

    httpRequests.inc({
      method: req.method,
      route: req.route?.path || req.path,
      status: res.statusCode,
    });

    httpDuration.observe(
      {
        method: req.method,
        route: req.route?.path || req.path,
        status: res.statusCode,
      },
      duration
    );
  });

  next();
}

// Metrics endpoint
export function setupMetricsEndpoint(app: any) {
  app.get('/metrics', async (req: any, res: any) => {
    res.set('Content-Type', prometheus.register.contentType);
    res.end(await prometheus.register.metrics());
  });
}
```

### Logging Configuration

```typescript
// src/utils/logger.ts
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'agentic-workflow-api',
    version: process.env.npm_package_version || '1.0.0',
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  ],
});

// Add file transport for production
if (process.env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'error.log',
      level: 'error',
    })
  );

  logger.add(
    new winston.transports.File({
      filename: 'combined.log',
    })
  );
}

export default logger;
```

## Scaling Considerations

### Horizontal Scaling

Configure horizontal pod autoscaling:

```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: agentic-workflow-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: agentic-workflow-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

### Load Balancing

Configure load balancer for high availability:

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: agentic-workflow-api-ingress
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: '100'
    nginx.ingress.kubernetes.io/rate-limit-window: '1m'
spec:
  tls:
    - hosts:
        - yourdomain.com
      secretName: api-tls
  rules:
    - host: yourdomain.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: agentic-workflow-api-service
                port:
                  number: 80
```

### Performance Optimization

Configure performance settings:

```bash
# Environment variables for performance
NODE_OPTIONS="--max-old-space-size=512"
UV_THREADPOOL_SIZE=128
CACHE_MAX_SIZE=1000
ENABLE_REQUEST_DEDUPLICATION=true
DATABASE_POOL_SIZE=20
```

### Database Scaling

Configure Supabase for high load:

```sql
-- Optimize Supabase settings
ALTER SYSTEM SET max_connections = 100;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET work_mem = '4MB';
```

## Security Configuration

### SSL/TLS Configuration

```yaml
# SSL certificate configuration
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: api-tls
spec:
  secretName: api-tls
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
    - yourdomain.com
    - api.yourdomain.com
```

### Security Headers

```typescript
// src/middleware/security.ts
import helmet from 'helmet';

export function setupSecurity(app: any) {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'https://*.supabase.co'],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    })
  );
}
```

For additional deployment information, refer to:

- [Migration Guide](./MIGRATION_GUIDE.md)
- [Security Best Practices](./SECURITY.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
