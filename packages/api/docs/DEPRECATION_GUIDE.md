# Authentication Deprecation Guide

This guide helps developers migrate from Django authentication to Supabase authentication by providing clear migration paths for deprecated functionality.

## Overview

The authentication system is transitioning from Django to Supabase. This document outlines:

- What's being deprecated and when
- How to migrate existing code
- Backwards compatibility options
- Timeline and support commitments

## Deprecation Timeline

### Phase 1: Dual System (Current - 6 months)

- **Status**: Both Django and Supabase authentication supported
- **Action Required**: Begin migrating new code to Supabase
- **Legacy Support**: Full backwards compatibility maintained

### Phase 2: Deprecation Warnings (6-12 months)

- **Status**: Django methods show deprecation warnings
- **Action Required**: Migrate existing code to Supabase
- **Legacy Support**: Backwards compatibility maintained with warnings

### Phase 3: Legacy Maintenance (12-18 months)

- **Status**: Django authentication marked as legacy
- **Action Required**: Complete migration to Supabase
- **Legacy Support**: Critical bug fixes only

### Phase 4: End of Life (18+ months)

- **Status**: Django authentication removed
- **Action Required**: Must use Supabase authentication
- **Legacy Support**: None

## Deprecated Components

### 1. Django User Model Access

#### Deprecated

```python
# Django User model direct access
from django.contrib.auth.models import User

user = User.objects.get(email='user@example.com')
```

#### Migration Path

```typescript
// Use Supabase AuthClient
import { AuthClient } from '@agentic-workflow/api';

const authClient = new AuthClient(config);
const user = authClient.getCurrentUser();
```

#### Compatibility Layer

```typescript
// Use backwards compatibility adapter
import { createLegacyAuthService } from '@agentic-workflow/api';

const legacyAuth = createLegacyAuthService(authClient);
const user = legacyAuth.getCurrentUser(); // Returns Django-like user object
```

### 2. Django Authentication Views

#### Deprecated

```python
# Django authentication views
from django.contrib.auth.views import LoginView, LogoutView
from django.contrib.auth import authenticate, login, logout

def login_view(request):
    user = authenticate(username=username, password=password)
    if user:
        login(request, user)
```

#### Migration Path

```typescript
// Use Supabase authentication
import { AuthClient } from '@agentic-workflow/api';

const authClient = new AuthClient(config);

async function loginUser(email: string, password: string) {
  const result = await authClient.login({ email, password });
  return result;
}
```

#### Compatibility Layer

```typescript
// Use compatibility middleware
import { createAuthCompatibilityMiddleware } from '@agentic-workflow/api';

const middleware = createAuthCompatibilityMiddleware(legacyAuth);
app.use(middleware.expressMiddleware());

// Routes continue to work with req.user
app.get('/profile', middleware.requiresAuth(), (req, res) => {
  res.json({ user: req.user });
});
```

### 3. Django Permission System

#### Deprecated

```python
# Django permissions
from django.contrib.auth.decorators import permission_required

@permission_required('auth.add_user')
def admin_view(request):
    pass

# In templates
{% if user.has_perm 'auth.change_user' %}
  <a href="/admin/">Admin</a>
{% endif %}
```

#### Migration Path

```typescript
// Use Supabase RLS and custom permissions
import { AuthClient } from '@agentic-workflow/api';

const authClient = new AuthClient(config);
const user = authClient.getCurrentUser();

// Check user metadata or role-based permissions
const hasPermission = user?.app_metadata?.permissions?.includes('admin');
```

#### Compatibility Layer

```typescript
// Use permission compatibility
const middleware = createAuthCompatibilityMiddleware(legacyAuth);

app.get('/admin', middleware.requiresAuth('auth.add_user'), (req, res) => {
  // Route handler
});

// In templates (if using server-side rendering)
res.locals.user = legacyAuth.getCurrentUser();
```

### 4. Django Session Management

#### Deprecated

```python
# Django sessions
def view(request):
    request.session['key'] = 'value'
    value = request.session.get('key')
    request.session.flush()
```

#### Migration Path

```typescript
// Use Supabase session management
import { AuthClient } from '@agentic-workflow/api';

const authClient = new AuthClient(config);
const session = authClient.getCurrentSession();

// Store additional data in user metadata or separate storage
const result = await authClient.updateProfile({
  metadata: { customData: 'value' },
});
```

#### Compatibility Layer

```typescript
// Use session compatibility adapter
import { SessionCompatibilityAdapter } from '@agentic-workflow/api';

const sessionAdapter = new SessionCompatibilityAdapter();
const session = sessionAdapter.createSessionInterface(sessionId);

session.set('key', 'value');
const value = session.get('key');
session.clear();
```

### 5. Django Middleware

#### Deprecated

```python
# Django auth middleware
from django.contrib.auth.middleware import AuthenticationMiddleware

MIDDLEWARE = [
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    # ...
]
```

#### Migration Path

```typescript
// Use Supabase middleware
import { supabaseAuthMiddleware } from '@agentic-workflow/api';

app.use(supabaseAuthMiddleware(supabaseClient));
```

#### Compatibility Layer

```typescript
// Use compatibility middleware
import { createAuthCompatibilityMiddleware } from '@agentic-workflow/api';

const middleware = createAuthCompatibilityMiddleware(legacyAuth);
app.use(middleware.expressMiddleware());
```

## Migration Strategies

### Strategy 1: Big Bang Migration

- **Best For**: Small applications with limited authentication usage
- **Timeline**: 1-2 weeks
- **Process**: Replace all Django auth at once with Supabase

### Strategy 2: Gradual Migration

- **Best For**: Large applications with extensive authentication integration
- **Timeline**: 3-6 months
- **Process**: Migrate components incrementally using compatibility layer

### Strategy 3: Feature Flag Migration

- **Best For**: Applications needing zero-downtime migration
- **Timeline**: 2-4 months
- **Process**: Use feature flags to control which auth system is used

## Code Migration Examples

### Example 1: User Registration

#### Before (Django)

```python
# Django user registration
from django.contrib.auth.models import User
from django.contrib.auth import login

def register_user(request):
    if request.method == 'POST':
        username = request.POST['username']
        email = request.POST['email']
        password = request.POST['password']

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password
        )

        login(request, user)
        return redirect('dashboard')
```

#### After (Supabase)

```typescript
// Supabase user registration
import { AuthClient } from '@agentic-workflow/api';

const authClient = new AuthClient(config);

async function registerUser(userData: SignupData) {
  const result = await authClient.signup(userData);

  if (result.success) {
    // User is automatically logged in after signup
    return { success: true, user: result.user };
  }

  return { success: false, error: result.error };
}
```

### Example 2: Protected Routes

#### Before (Django)

```python
# Django protected view
from django.contrib.auth.decorators import login_required

@login_required
def protected_view(request):
    return render(request, 'protected.html', {
        'user': request.user
    })
```

#### After (Supabase)

```typescript
// Supabase protected route
import { AuthGuard } from '@agentic-workflow/frontend';

function ProtectedComponent() {
  return (
    <AuthGuard>
      <div>Protected content</div>
    </AuthGuard>
  );
}
```

### Example 3: Admin Interface

#### Before (Django)

```python
# Django admin check
from django.contrib.auth.decorators import user_passes_test

@user_passes_test(lambda u: u.is_staff)
def admin_view(request):
    users = User.objects.all()
    return render(request, 'admin.html', {'users': users})
```

#### After (Supabase)

```typescript
// Supabase admin check
import { useAuth } from '@agentic-workflow/api';

function AdminPanel() {
  const { user } = useAuth();

  if (!user?.app_metadata?.is_staff) {
    return <div>Access denied</div>;
  }

  return <AdminInterface />;
}
```

## Testing Migration

### Unit Tests

#### Before (Django)

```python
# Django test
from django.test import TestCase
from django.contrib.auth.models import User

class AuthTestCase(TestCase):
    def test_user_creation(self):
        user = User.objects.create_user(
            username='test',
            email='test@example.com',
            password='testpass'
        )
        self.assertTrue(user.is_authenticated)
```

#### After (Supabase)

```typescript
// Supabase test
import { AuthClient } from '@agentic-workflow/api';
import { createMockSupabaseClient } from '@agentic-workflow/test-utils';

describe('Auth Tests', () => {
  it('should create user', async () => {
    const mockClient = createMockSupabaseClient();
    const authClient = new AuthClient({ supabaseClient: mockClient });

    const result = await authClient.signup({
      email: 'test@example.com',
      password: 'testpass',
      name: 'Test User',
    });

    expect(result.success).toBe(true);
  });
});
```

### Integration Tests

#### Before (Django)

```python
# Django integration test
from django.test import Client

class IntegrationTest(TestCase):
    def test_login_flow(self):
        client = Client()
        response = client.post('/login/', {
            'username': 'test@example.com',
            'password': 'testpass'
        })
        self.assertEqual(response.status_code, 302)
```

#### After (Supabase)

```typescript
// Supabase integration test
import { render, screen } from '@testing-library/react';
import { AuthProvider } from '@agentic-workflow/frontend';

test('login flow', async () => {
  render(
    <AuthProvider>
      <LoginForm />
    </AuthProvider>
  );

  // Test login flow
  fireEvent.click(screen.getByText('Login'));
  await waitFor(() => {
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });
});
```

## Configuration Changes

### Environment Variables

#### Before (Django)

```bash
# Django settings
SECRET_KEY=your-secret-key
DATABASE_URL=postgresql://...
SESSION_COOKIE_AGE=3600
```

#### After (Supabase)

```bash
# Supabase settings
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiI...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiI...
```

### Application Configuration

#### Before (Django)

```python
# Django settings.py
INSTALLED_APPS = [
    'django.contrib.auth',
    'django.contrib.sessions',
    # ...
]

AUTHENTICATION_BACKENDS = [
    'django.contrib.auth.backends.ModelBackend',
]
```

#### After (Supabase)

```typescript
// Supabase config
import { createAuthClient } from '@agentic-workflow/api';

const authClient = createAuthClient({
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_ANON_KEY,
  enableCaching: true,
  enableMetrics: true,
  enableSecurityMonitoring: true,
});
```

## Troubleshooting

### Common Migration Issues

#### Issue 1: User ID Mismatches

**Problem**: Django integer IDs vs Supabase UUID IDs

**Solution**: Use compatibility adapter or maintain ID mapping

```typescript
// Store Django ID in user metadata
const userData = {
  email: 'user@example.com',
  user_metadata: {
    django_user_id: 123,
  },
};
```

#### Issue 2: Permission System Differences

**Problem**: Django's permission system doesn't map directly to Supabase

**Solution**: Use RLS policies and user metadata

```sql
-- Supabase RLS policy
CREATE POLICY "Staff can view all users" ON users
  FOR SELECT USING (
    auth.jwt() ->> 'app_metadata' ->> 'is_staff' = 'true'
  );
```

#### Issue 3: Session Data Migration

**Problem**: Django session data needs to be preserved

**Solution**: Export/import session data or use compatibility layer

```typescript
// Migrate session data
const sessionData = await exportDjangoSessions();
await importToSupabaseUserMetadata(sessionData);
```

### Performance Considerations

#### Database Queries

- Supabase uses PostgreSQL RLS instead of Django ORM
- Optimize queries for new authentication patterns
- Consider caching strategies for user data

#### API Calls

- Supabase authentication is API-based vs Django's server-side sessions
- Implement request deduplication and caching
- Handle network failures gracefully

## Support and Resources

### Getting Help

- **Documentation**: [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- **Migration Guide**: This document and migration strategy
- **Team Support**: Contact the development team for migration assistance

### Tools and Utilities

- **Migration Scripts**: Automated user data migration
- **Compatibility Layer**: Backwards compatibility adapters
- **Testing Utilities**: Migration testing helpers

### Timeline for Support

- **Immediate**: Full support for migration questions
- **6 months**: Deprecation warnings begin
- **12 months**: Legacy maintenance mode only
- **18 months**: End of life for Django authentication

## Checklist for Migration

### Pre-Migration

- [ ] Audit current Django authentication usage
- [ ] Identify all integration points
- [ ] Plan migration strategy (big bang vs gradual)
- [ ] Set up Supabase project and configuration
- [ ] Create development/staging environments

### During Migration

- [ ] Implement backwards compatibility where needed
- [ ] Migrate user data to Supabase
- [ ] Update authentication code incrementally
- [ ] Test each migrated component thoroughly
- [ ] Monitor for performance and security issues

### Post-Migration

- [ ] Remove Django authentication dependencies
- [ ] Clean up compatibility layer code
- [ ] Update documentation and team training
- [ ] Monitor system performance and user feedback
- [ ] Plan for future authentication enhancements

This deprecation guide provides a clear path forward for migrating from Django to Supabase authentication while maintaining system stability and user experience throughout the transition.
