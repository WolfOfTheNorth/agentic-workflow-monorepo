# Supabase Authentication Migration Guide

This guide provides comprehensive instructions for migrating from Django-based authentication to Supabase authentication while maintaining full compatibility with your existing React frontend and TypeScript API layer.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Pre-Migration Planning](#pre-migration-planning)
4. [Environment Setup](#environment-setup)
5. [Step-by-Step Migration](#step-by-step-migration)
6. [Data Migration](#data-migration)
7. [Testing and Validation](#testing-and-validation)
8. [Production Deployment](#production-deployment)
9. [Post-Migration Tasks](#post-migration-tasks)
10. [Rollback Procedures](#rollback-procedures)

## Overview

The Supabase authentication integration replaces Django's authentication backend while preserving all existing API interfaces, data structures, and user experience. The migration is designed to be backward-compatible and can be performed with zero downtime.

### Key Benefits

- **Zero Interface Changes**: Existing React components continue to work unchanged
- **Enhanced Security**: Built-in email verification, password reset, and session management
- **Better Performance**: Optimized token refresh and session handling
- **Modern Features**: Social logins, MFA, and advanced security policies
- **Monitoring**: Comprehensive analytics and error tracking

### Migration Strategy

The migration follows a **blue-green deployment** approach:

1. Set up Supabase alongside existing Django auth
2. Gradually migrate users and test functionality
3. Switch traffic to Supabase when ready
4. Maintain Django as fallback during transition period

## Prerequisites

### Technical Requirements

- **Node.js**: Version 18 or higher
- **pnpm**: Version 8 or higher
- **Supabase Account**: Pro plan recommended for production
- **Database Access**: Admin access to current user database
- **Environment Access**: Ability to set environment variables

### Team Requirements

- **Developer Access**: At least one developer familiar with TypeScript/React
- **DevOps Access**: Team member who can manage deployments
- **Testing Resources**: QA team or testing protocol in place
- **Rollback Authority**: Decision maker for rollback scenarios

### Current System Audit

Before starting migration, audit your current authentication system:

```bash
# Check current Django auth usage
grep -r "django.contrib.auth" --include="*.py" .
grep -r "User.objects" --include="*.py" .
grep -r "@login_required" --include="*.py" .

# Check frontend auth usage
grep -r "useAuth" --include="*.tsx" --include="*.ts" .
grep -r "authApi" --include="*.tsx" --include="*.ts" .
```

Document all authentication touchpoints before proceeding.

## Pre-Migration Planning

### 1. User Data Analysis

Analyze your current user data structure:

```sql
-- Get user count and data structure
SELECT COUNT(*) as total_users FROM auth_user;
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'auth_user';

-- Check for custom user fields
SELECT COUNT(*) as users_with_custom_data FROM your_user_profile_table;
```

### 2. Authentication Flow Mapping

Document your current authentication flows:

- Login process
- Registration process
- Password reset flow
- Session management
- User profile updates
- Logout process

### 3. Integration Points Inventory

List all systems that integrate with authentication:

- Frontend applications
- API endpoints
- Third-party services
- Background jobs
- Admin interfaces

### 4. Migration Timeline

Recommended timeline for migration:

| Phase             | Duration | Activities                                   |
| ----------------- | -------- | -------------------------------------------- |
| Planning          | 1-2 days | System audit, documentation, team briefing   |
| Setup             | 1 day    | Supabase project creation, environment setup |
| Development       | 3-5 days | Code changes, testing, validation            |
| Staging Testing   | 2-3 days | End-to-end testing, performance validation   |
| Production Deploy | 1 day    | Deployment, monitoring, validation           |
| Stabilization     | 3-7 days | Monitoring, issue resolution, optimization   |

## Environment Setup

### 1. Supabase Project Creation

1. **Create Supabase Project**:

   ```bash
   # Visit https://supabase.com/dashboard
   # Click "New Project"
   # Choose organization and region
   # Set project name: "agentic-workflow-auth"
   # Generate strong database password
   ```

2. **Configure Authentication Settings**:

   ```sql
   -- In Supabase SQL Editor
   -- Enable email confirmations
   UPDATE auth.config SET enable_confirmations = true;

   -- Set email templates (optional)
   -- Configure in Supabase Dashboard > Authentication > Email Templates
   ```

3. **Set Up Row Level Security** (if using Supabase database):

   ```sql
   -- Enable RLS on auth tables
   ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

   -- Create policies as needed for your use case
   ```

### 2. Environment Variables Configuration

Create environment configuration for all environments:

#### Development Environment (.env.local)

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Authentication Configuration
AUTH_TOKEN_EXPIRATION=3600
AUTH_REFRESH_THRESHOLD=300
AUTH_MAX_LOGIN_ATTEMPTS=5
AUTH_RATE_LIMIT_WINDOW=300

# Performance Configuration
CACHE_PROFILE_TTL=300000
CACHE_MAX_SIZE=100
ENABLE_REQUEST_DEDUPLICATION=true
PERFORMANCE_WARNING_THRESHOLD=2000

# Analytics Configuration
ENABLE_ANALYTICS=true
ENABLE_ERROR_TRACKING=true
ANALYTICS_RETENTION_DAYS=30
ENABLE_DEBUG_MODE=true

# Migration Configuration (temporary)
ENABLE_MIGRATION_MODE=true
DJANGO_AUTH_FALLBACK=true
MIGRATION_BATCH_SIZE=100
```

#### Staging Environment

```bash
# Copy development config and adjust:
ENABLE_DEBUG_MODE=false
ANALYTICS_RETENTION_DAYS=7
MIGRATION_BATCH_SIZE=500
```

#### Production Environment

```bash
# Use production Supabase project
SUPABASE_URL=https://your-prod-project.supabase.co
SUPABASE_ANON_KEY=your-prod-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-prod-service-key

# Production optimizations
ENABLE_DEBUG_MODE=false
ANALYTICS_RETENTION_DAYS=90
ENABLE_AUTO_REPORTING=true
CACHE_MAX_SIZE=1000
MIGRATION_BATCH_SIZE=1000

# Security hardening
AUTH_MAX_LOGIN_ATTEMPTS=3
AUTH_RATE_LIMIT_WINDOW=600
```

### 3. Security Configuration

#### Supabase Dashboard Security Settings

1. **Authentication Settings**:
   - Enable email confirmations
   - Set secure password requirements
   - Configure session timeout
   - Enable account lockout after failed attempts

2. **API Settings**:
   - Configure CORS origins
   - Set up API rate limiting
   - Enable request logging

3. **Database Security**:
   - Enable Row Level Security
   - Configure access policies
   - Set up database backups

#### Network Security

```bash
# Configure firewall rules (if applicable)
# Allow only necessary IPs to access Supabase
# Use VPN or private networks when possible
```

## Step-by-Step Migration

### Phase 1: Code Integration (No User Impact)

#### 1. Install Dependencies

```bash
# In packages/api directory
pnpm add @supabase/supabase-js

# Verify installation
pnpm list @supabase/supabase-js
```

#### 2. Initialize Supabase Configuration

The configuration system is already implemented. Verify it's working:

```bash
# Test configuration loading
pnpm test config/supabase.test.ts
```

#### 3. Set Up Adapters

The Supabase adapter is already implemented. Test the integration:

```bash
# Test adapter functionality
pnpm test adapters/supabase.test.ts
```

#### 4. Configure Analytics and Monitoring

```bash
# Test analytics integration
pnpm test adapters/analytics-monitor.test.ts
```

#### 5. Update API Client Integration

Verify the AuthApiClient integration:

```bash
# Test API client with Supabase backend
pnpm test AuthApiClient.test.ts
```

### Phase 2: User Data Migration

#### 1. Export User Data from Django

Create a Django management command to export users:

```python
# In your Django project: management/commands/export_users.py
import json
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from your_app.models import UserProfile

class Command(BaseCommand):
    def handle(self, *args, **options):
        users_data = []

        for user in User.objects.all():
            try:
                profile = user.userprofile
            except UserProfile.DoesNotExist:
                profile = None

            user_data = {
                'id': user.id,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'is_active': user.is_active,
                'date_joined': user.date_joined.isoformat(),
                'last_login': user.last_login.isoformat() if user.last_login else None,
                'profile': {
                    'name': profile.name if profile else f"{user.first_name} {user.last_name}".strip(),
                    # Add other profile fields as needed
                } if profile else None
            }
            users_data.append(user_data)

        with open('exported_users.json', 'w') as f:
            json.dump(users_data, f, indent=2)

        self.stdout.write(f"Exported {len(users_data)} users to exported_users.json")
```

Run the export:

```bash
python manage.py export_users
```

#### 2. Create User Migration Script

Create a Node.js script to migrate users to Supabase:

```typescript
// scripts/migrate-users.ts
import { createSupabaseAdapter } from '../src/adapters/supabase';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

interface ExportedUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  date_joined: string;
  last_login?: string;
  profile?: {
    name: string;
  };
}

async function migrateUsers() {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // Use service role key for admin operations
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const exportedUsers: ExportedUser[] = JSON.parse(fs.readFileSync('exported_users.json', 'utf8'));

  console.log(`Starting migration of ${exportedUsers.length} users...`);

  let migrated = 0;
  let errors = 0;

  for (const user of exportedUsers) {
    try {
      // Create user in Supabase auth
      const { data, error } = await adminClient.auth.admin.createUser({
        email: user.email,
        email_confirm: true, // Skip email confirmation for migrated users
        user_metadata: {
          name: user.profile?.name || `${user.first_name} ${user.last_name}`.trim(),
          migrated_from_django: true,
          original_django_id: user.id,
          date_joined: user.date_joined,
          last_login: user.last_login,
        },
      });

      if (error) {
        console.error(`Failed to migrate user ${user.email}:`, error.message);
        errors++;
        continue;
      }

      // Store mapping of Django ID to Supabase ID for reference
      // You might want to store this in a temporary table

      migrated++;
      if (migrated % 100 === 0) {
        console.log(`Migrated ${migrated} users...`);
      }
    } catch (error) {
      console.error(`Error migrating user ${user.email}:`, error);
      errors++;
    }
  }

  console.log(`Migration completed: ${migrated} successful, ${errors} errors`);
}

migrateUsers().catch(console.error);
```

Run the migration:

```bash
# Set environment variables
export SUPABASE_URL="your-supabase-url"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Run migration
npx tsx scripts/migrate-users.ts
```

#### 3. Create User Mapping Table

Store the relationship between Django and Supabase user IDs:

```sql
-- In Supabase SQL Editor
CREATE TABLE IF NOT EXISTS user_migration_mapping (
  django_user_id INTEGER PRIMARY KEY,
  supabase_user_id UUID REFERENCES auth.users(id),
  migrated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  migration_status TEXT DEFAULT 'completed'
);

-- Enable RLS
ALTER TABLE user_migration_mapping ENABLE ROW LEVEL SECURITY;

-- Create index for lookups
CREATE INDEX idx_user_mapping_supabase_id ON user_migration_mapping(supabase_user_id);
```

### Phase 3: Gradual Rollout

#### 1. Feature Flag Implementation

Add feature flags to control the rollout:

```typescript
// src/config/feature-flags.ts
export interface FeatureFlags {
  useSupabaseAuth: boolean;
  supabaseAuthPercentage: number; // 0-100
  enableDjangoFallback: boolean;
}

export function getFeatureFlags(): FeatureFlags {
  return {
    useSupabaseAuth: process.env.USE_SUPABASE_AUTH === 'true',
    supabaseAuthPercentage: parseInt(process.env.SUPABASE_AUTH_PERCENTAGE || '0'),
    enableDjangoFallback: process.env.DJANGO_AUTH_FALLBACK === 'true',
  };
}

export function shouldUseSupabaseAuth(userId?: string): boolean {
  const flags = getFeatureFlags();

  if (!flags.useSupabaseAuth) {
    return false;
  }

  if (flags.supabaseAuthPercentage === 100) {
    return true;
  }

  if (flags.supabaseAuthPercentage === 0) {
    return false;
  }

  // Use userId hash to determine consistent user assignment
  if (userId) {
    const hash = hashUserId(userId);
    return hash % 100 < flags.supabaseAuthPercentage;
  }

  return Math.random() * 100 < flags.supabaseAuthPercentage;
}

function hashUserId(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}
```

#### 2. Gradual Rollout Schedule

| Week | Percentage | User Group                | Monitoring Focus                 |
| ---- | ---------- | ------------------------- | -------------------------------- |
| 1    | 5%         | Internal team, beta users | Basic functionality, error rates |
| 2    | 10%        | Early adopters            | Performance, user experience     |
| 3    | 25%        | Active users              | Session management, edge cases   |
| 4    | 50%        | General population        | Load testing, scalability        |
| 5    | 75%        | Majority users            | Stability, long-term sessions    |
| 6    | 100%       | All users                 | Full migration complete          |

#### 3. Monitoring During Rollout

Set up comprehensive monitoring:

```typescript
// Monitor key metrics during rollout
const rolloutMetrics = {
  // Authentication success rates
  supabaseAuthSuccessRate: 0,
  djangoAuthSuccessRate: 0,

  // Response times
  supabaseAvgResponseTime: 0,
  djangoAvgResponseTime: 0,

  // Error rates
  supabaseErrorRate: 0,
  djangoErrorRate: 0,

  // User experience
  sessionRestoreSuccessRate: 0,
  tokenRefreshSuccessRate: 0,
};
```

## Data Migration

### User Session Migration

For existing logged-in users, implement session transition:

```typescript
// src/utils/session-migration.ts
export async function migrateUserSession(djangoSessionToken: string): Promise<boolean> {
  try {
    // 1. Validate Django session
    const djangoUser = await validateDjangoSession(djangoSessionToken);
    if (!djangoUser) return false;

    // 2. Find corresponding Supabase user
    const supabaseUser = await findSupabaseUserByEmail(djangoUser.email);
    if (!supabaseUser) return false;

    // 3. Create Supabase session
    const { data, error } = await supabaseClient.auth.admin.generateLink({
      type: 'magiclink',
      email: djangoUser.email,
      options: {
        redirectTo: window.location.href,
      },
    });

    if (error) return false;

    // 4. Automatically sign in user
    const { error: signInError } = await supabaseClient.auth.signInWithOtp({
      email: djangoUser.email,
      token: data.properties.email_otp,
      type: 'email',
    });

    return !signInError;
  } catch (error) {
    console.error('Session migration failed:', error);
    return false;
  }
}
```

### Profile Data Migration

Ensure all user profile data is transferred:

```typescript
// src/utils/profile-migration.ts
export async function migrateUserProfile(
  supabaseUserId: string,
  djangoUserId: number
): Promise<boolean> {
  try {
    // 1. Fetch Django profile data
    const djangoProfile = await fetchDjangoProfile(djangoUserId);

    // 2. Update Supabase user metadata
    const { error } = await supabaseClient.auth.admin.updateUserById(supabaseUserId, {
      user_metadata: {
        ...djangoProfile,
        migrated_from_django: true,
        migration_date: new Date().toISOString(),
      },
    });

    return !error;
  } catch (error) {
    console.error('Profile migration failed:', error);
    return false;
  }
}
```

## Testing and Validation

### 1. Pre-Migration Testing

```bash
# Run all authentication tests
pnpm test src/adapters/
pnpm test src/client/
pnpm test src/hooks/

# Run integration tests
pnpm test:integration

# Run end-to-end tests
pnpm test:e2e
```

### 2. Migration Validation Tests

Create specific tests for migration scenarios:

```typescript
// tests/migration.test.ts
describe('Migration Validation', () => {
  it('should migrate user data correctly', async () => {
    // Test user data migration
  });

  it('should maintain session continuity', async () => {
    // Test session migration
  });

  it('should handle authentication with both systems', async () => {
    // Test hybrid operation
  });

  it('should fallback to Django when needed', async () => {
    // Test fallback mechanisms
  });
});
```

### 3. Performance Testing

```bash
# Load testing with existing user base
k6 run tests/load/auth-migration-load.js

# Memory usage monitoring
node --inspect tests/memory/auth-memory-test.js
```

### 4. Security Testing

```bash
# Test authentication security
npm run test:security

# Check for vulnerabilities
npm audit
pnpm audit
```

## Production Deployment

### 1. Pre-Deployment Checklist

- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Supabase project configured
- [ ] User data migrated
- [ ] Monitoring dashboards set up
- [ ] Rollback procedures documented
- [ ] Team trained on new system
- [ ] Documentation updated

### 2. Deployment Process

#### Blue-Green Deployment

1. **Deploy to Green Environment**:

   ```bash
   # Deploy new version with Supabase integration
   pnpm build
   pnpm deploy:staging

   # Run smoke tests
   pnpm test:smoke
   ```

2. **Traffic Shifting**:

   ```bash
   # Start with 5% traffic
   ./scripts/set-traffic-split.sh 5

   # Monitor for 30 minutes
   ./scripts/monitor-deployment.sh

   # Gradually increase traffic
   ./scripts/set-traffic-split.sh 25
   ./scripts/set-traffic-split.sh 50
   ./scripts/set-traffic-split.sh 100
   ```

3. **Full Cutover**:

   ```bash
   # Switch all traffic to green
   ./scripts/complete-deployment.sh

   # Verify all systems operational
   ./scripts/health-check.sh
   ```

### 3. Monitoring Post-Deployment

Set up alerts for:

- Authentication success rate < 95%
- Response time > 2 seconds
- Error rate > 1%
- Session failures > 0.5%

```bash
# Set up monitoring
./scripts/setup-monitoring.sh

# Configure alerts
./scripts/configure-alerts.sh
```

## Post-Migration Tasks

### 1. Performance Optimization

After migration is stable:

```typescript
// Optimize cache settings
export const optimizedCacheConfig = {
  profileCacheTTL: 600000, // 10 minutes
  maxProfileCacheSize: 1000,
  enableRequestDeduplication: true,
  deduplicationWindow: 30000, // 30 seconds
};

// Update analytics retention
export const productionAnalyticsConfig = {
  eventRetentionTime: 2592000000, // 30 days
  errorRetentionTime: 7776000000, // 90 days
  enableAutoReporting: true,
  reportingInterval: 300000, // 5 minutes
};
```

### 2. Clean Up Django Authentication

After successful migration and stabilization period:

1. **Remove Django Auth Dependencies**:

   ```python
   # Comment out or remove Django auth URLs
   # Comment out Django auth middleware
   # Remove unused Django auth models
   ```

2. **Clean Up Migration Code**:

   ```bash
   # Remove migration scripts
   rm scripts/migrate-users.ts

   # Remove feature flags
   # Remove fallback code paths
   ```

3. **Database Cleanup**:

   ```sql
   -- Archive Django user tables (don't delete immediately)
   ALTER TABLE auth_user RENAME TO auth_user_archived;
   ALTER TABLE auth_user_groups RENAME TO auth_user_groups_archived;

   -- Drop migration mapping table after validation period
   -- DROP TABLE user_migration_mapping;
   ```

### 3. Documentation Updates

Update all documentation to reflect new authentication system:

- API documentation
- Developer onboarding guides
- Operations runbooks
- Security policies
- Backup and recovery procedures

## Rollback Procedures

### Emergency Rollback

If critical issues occur during migration:

#### 1. Immediate Rollback (< 5 minutes)

```bash
# Revert traffic to Django authentication
./scripts/emergency-rollback.sh

# This script should:
# 1. Set feature flags to disable Supabase auth
# 2. Route all traffic back to Django
# 3. Alert the team
# 4. Create incident ticket
```

#### 2. Rollback Script

```bash
#!/bin/bash
# scripts/emergency-rollback.sh

echo "EMERGENCY ROLLBACK INITIATED"
echo "Timestamp: $(date)"

# 1. Disable Supabase authentication
kubectl set env deployment/api USE_SUPABASE_AUTH=false
kubectl set env deployment/api SUPABASE_AUTH_PERCENTAGE=0
kubectl set env deployment/api DJANGO_AUTH_FALLBACK=true

# 2. Restart services to pick up config changes
kubectl rollout restart deployment/api
kubectl rollout restart deployment/frontend

# 3. Wait for rollout
kubectl rollout status deployment/api
kubectl rollout status deployment/frontend

# 4. Verify Django auth is working
curl -f http://api/health/auth || exit 1

# 5. Send notifications
./scripts/send-alert.sh "ROLLBACK COMPLETE: Reverted to Django authentication"

echo "ROLLBACK COMPLETED SUCCESSFULLY"
```

#### 3. Partial Rollback

For less critical issues, reduce traffic percentage:

```bash
# Reduce Supabase traffic to 10%
kubectl set env deployment/api SUPABASE_AUTH_PERCENTAGE=10

# Monitor for 30 minutes
sleep 1800

# If stable, gradually increase again
# If issues persist, complete rollback
```

### Post-Rollback Actions

1. **Incident Analysis**:
   - Gather logs and metrics
   - Identify root cause
   - Document lessons learned
   - Update rollback procedures

2. **Communication**:
   - Notify stakeholders
   - Update status page
   - Internal postmortem
   - Plan remediation

3. **Recovery Planning**:
   - Fix identified issues
   - Enhanced testing
   - Gradual re-migration
   - Additional monitoring

## Common Issues and Solutions

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for detailed troubleshooting information.

## Success Criteria

Migration is considered successful when:

- [ ] 100% of users migrated to Supabase
- [ ] Authentication success rate > 99%
- [ ] Average response time < 1 second
- [ ] Error rate < 0.1%
- [ ] Zero security incidents
- [ ] No user-reported authentication issues
- [ ] All monitoring systems operational
- [ ] Documentation complete and accurate

## Support and Maintenance

### Team Responsibilities

- **Development Team**: Code maintenance, feature development, bug fixes
- **DevOps Team**: Infrastructure, deployments, monitoring, scaling
- **Security Team**: Security audits, vulnerability management, compliance
- **Product Team**: User experience, feature requirements, analytics

### Ongoing Maintenance

- **Weekly**: Review error reports and analytics
- **Monthly**: Performance optimization and capacity planning
- **Quarterly**: Security audit and configuration review
- **Annually**: Architecture review and technology updates

For additional support, refer to:

- [Security Best Practices](./SECURITY.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
- [API Documentation](./API_REFERENCE.md)
- [Deployment Guide](./DEPLOYMENT.md)
