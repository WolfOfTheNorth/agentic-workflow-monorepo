# API Package CLAUDE.md

This file provides guidance for working with the authentication system and API client functionality.

## Authentication System Overview

The `@agentic-workflow/api` package provides a comprehensive authentication system with Supabase integration, OAuth providers, 2FA support, and secure session management.

## Architecture

### Core Components

```
packages/api/src/
├── adapters/              # Authentication adapters and services
│   ├── providers/         # OAuth and 2FA providers
│   │   ├── google-oauth-provider.ts
│   │   ├── totp-2fa-provider.ts
│   │   └── webauthn-provider.ts
│   ├── supabase-adapter.ts       # Main Supabase integration
│   ├── session-manager.ts        # Session management
│   ├── auth-cache.ts            # Authentication caching
│   ├── secure-token-storage.ts  # Secure token storage
│   ├── auth-security-monitor.ts # Security monitoring
│   └── backwards-compatibility.ts # Django compatibility
├── clients/               # API client implementations
│   ├── auth-client.ts     # Authentication client
│   ├── supabase.ts       # Supabase client wrapper
│   └── index.ts
├── hooks/                # React hooks for easy integration
│   ├── useAuth.ts        # Main authentication hook
│   └── useUsers.ts       # User management hook
├── types/                # TypeScript type definitions
│   ├── auth.ts           # Authentication types
│   └── user.ts           # User types
└── utils/                # Utility functions
    ├── auth-capability-detector.ts
    └── migration-utils.ts
```

## Key Features

### 1. Supabase Integration

Full integration with Supabase for authentication, including:

- **User Registration & Login**: Email/password authentication
- **Social Login**: OAuth providers (Google, GitHub, etc.)
- **Email Verification**: Automated email verification flows
- **Password Reset**: Secure password reset functionality
- **Session Management**: Automatic token refresh and persistence

### 2. OAuth Providers

Support for multiple OAuth providers:

```typescript
// Google OAuth Provider
import { GoogleOAuthProvider } from '@agentic-workflow/api';

const googleProvider = new GoogleOAuthProvider({
  clientId: 'your-google-client-id',
  clientSecret: 'your-google-client-secret',
  redirectUri: 'http://localhost:3000/auth/callback/google',
});

// Initiate OAuth flow
const authUrl = await googleProvider.generateAuthorizationUrl();
```

### 3. Two-Factor Authentication (2FA)

Comprehensive 2FA support:

**TOTP (Time-based One-Time Password):**

```typescript
import { TOTPProvider } from '@agentic-workflow/api';

const totpProvider = new TOTPProvider();

// Generate TOTP secret for user
const { secret, qrCode } = await totpProvider.generateSecret(user.email);

// Verify TOTP token
const isValid = await totpProvider.verifyToken(token, secret);
```

**WebAuthn (Hardware Security Keys):**

```typescript
import { WebAuthnProvider } from '@agentic-workflow/api';

const webauthnProvider = new WebAuthnProvider();

// Generate registration options
const registrationOptions = await webauthnProvider.generateRegistrationOptions();

// Verify registration
const verification = await webauthnProvider.verifyRegistration(credential);
```

### 4. Secure Session Management

Advanced session management with:

- **Token Storage**: Secure token storage with encryption
- **Auto Refresh**: Automatic token refresh before expiration
- **Multi-tab Sync**: Session synchronization across browser tabs
- **Session Monitoring**: Real-time session health monitoring

```typescript
import { SessionManager } from '@agentic-workflow/api';

const sessionManager = new SessionManager({
  refreshThreshold: 300, // Refresh 5 minutes before expiration
  enablePersistence: true,
  storageKey: 'auth_session',
});

// Start session monitoring
await sessionManager.startMonitoring();
```

## React Integration

### useAuth Hook

Primary hook for authentication in React components:

```typescript
import { useAuth } from '@agentic-workflow/api';

function LoginComponent() {
  const {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    register,
    resetPassword
  } = useAuth();

  const handleLogin = async (email: string, password: string) => {
    try {
      await login(email, password);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      {isAuthenticated ? (
        <div>
          <p>Welcome, {user?.name}!</p>
          <button onClick={logout}>Logout</button>
        </div>
      ) : (
        <LoginForm onSubmit={handleLogin} />
      )}
    </div>
  );
}
```

### Hook Features

The `useAuth` hook provides:

- **Authentication State**: Current user, loading states, error handling
- **Authentication Methods**: Login, logout, register, password reset
- **Session Management**: Automatic session handling and refresh
- **2FA Integration**: Built-in 2FA verification flows
- **OAuth Support**: Social login integration
- **Multi-tab Sync**: Session synchronization across tabs

## API Clients

### AuthClient

Main client for authentication operations:

```typescript
import { AuthClient } from '@agentic-workflow/api';

const authClient = new AuthClient({
  supabaseUrl: 'your-supabase-url',
  supabaseKey: 'your-supabase-anon-key',
});

// Login user
const { user, session } = await authClient.login({
  email: 'user@example.com',
  password: 'password123',
});

// Register user
const { user } = await authClient.register({
  email: 'user@example.com',
  password: 'password123',
  name: 'John Doe',
});

// Enable 2FA
await authClient.enable2FA('totp');
```

### SupabaseClient

Wrapper around Supabase client with enhanced features:

```typescript
import { getSupabaseClient } from '@agentic-workflow/api';

const supabase = getSupabaseClient();

// Listen to auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth event:', event, session);
});
```

## Security Features

### 1. Security Monitoring

Real-time security monitoring and alerting:

```typescript
import { AuthSecurityMonitor } from '@agentic-workflow/api';

const securityMonitor = new AuthSecurityMonitor({
  enableRealTimeMonitoring: true,
  enableAlerts: true,
  maxFailedAttempts: 5,
});

// Monitor authentication events
securityMonitor.startMonitoring();
```

### 2. Penetration Testing

Built-in security testing tools:

```typescript
import { PenetrationTestingService } from '@agentic-workflow/api';

const pentestService = new PenetrationTestingService();

// Run security audit
const auditResults = await pentestService.runSecurityAudit({
  testBruteForce: true,
  testSessionHijacking: true,
  testTokenManipulation: true,
});
```

### 3. Security Audit

Comprehensive security auditing:

```typescript
import { SecurityAuditService } from '@agentic-workflow/api';

const auditService = new SecurityAuditService();

// Generate security report
const report = await auditService.generateSecurityReport();
console.log('Security Score:', report.overallScore);
```

## Configuration

### Environment Variables

Required environment variables:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# OAuth Providers
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_GITHUB_CLIENT_ID=your_github_client_id

# 2FA Configuration
VITE_TOTP_ISSUER=YourAppName
VITE_WEBAUTHN_RP_ID=localhost
```

### Application Configuration

```typescript
import { AuthConfig } from '@agentic-workflow/api';

const authConfig: AuthConfig = {
  supabase: {
    url: process.env.VITE_SUPABASE_URL!,
    anonKey: process.env.VITE_SUPABASE_ANON_KEY!,
  },
  oauth: {
    google: {
      clientId: process.env.VITE_GOOGLE_CLIENT_ID!,
      scopes: ['email', 'profile'],
    },
  },
  twoFactor: {
    totp: {
      issuer: 'YourApp',
      digits: 6,
      period: 30,
    },
    webauthn: {
      rpId: 'localhost',
      rpName: 'Your App',
    },
  },
  session: {
    refreshThreshold: 300,
    enablePersistence: true,
    enableMultiTabSync: true,
  },
};
```

## Error Handling

### Error Types

The authentication system provides specific error types:

```typescript
import { AuthError, AuthErrorType } from '@agentic-workflow/api';

try {
  await authClient.login(email, password);
} catch (error) {
  if (error instanceof AuthError) {
    switch (error.type) {
      case AuthErrorType.INVALID_CREDENTIALS:
        console.error('Invalid email or password');
        break;
      case AuthErrorType.EMAIL_NOT_VERIFIED:
        console.error('Please verify your email');
        break;
      case AuthErrorType.ACCOUNT_LOCKED:
        console.error('Account is temporarily locked');
        break;
      case AuthErrorType.RATE_LIMIT_EXCEEDED:
        console.error('Too many attempts. Please try again later');
        break;
      default:
        console.error('Authentication error:', error.message);
    }
  }
}
```

### Error Boundary

Use the provided error boundary for React applications:

```typescript
import { AuthErrorBoundary } from '@agentic-workflow/api';

function App() {
  return (
    <AuthErrorBoundary>
      <YourApp />
    </AuthErrorBoundary>
  );
}
```

## Testing

### Unit Testing

```typescript
import { AuthClient } from '@agentic-workflow/api';
import { jest } from '@jest/globals';

describe('AuthClient', () => {
  let authClient: AuthClient;

  beforeEach(() => {
    authClient = new AuthClient({
      supabaseUrl: 'test-url',
      supabaseKey: 'test-key',
    });
  });

  it('should login successfully', async () => {
    const mockUser = { id: '1', email: 'test@example.com' };
    jest.spyOn(authClient, 'login').mockResolvedValue({
      user: mockUser,
      session: { access_token: 'token' },
    });

    const result = await authClient.login('test@example.com', 'password');
    expect(result.user).toEqual(mockUser);
  });
});
```

### Integration Testing

```typescript
import { renderHook, act } from '@testing-library/react';
import { useAuth } from '@agentic-workflow/api';

describe('useAuth Hook', () => {
  it('should handle login flow', async () => {
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login('test@example.com', 'password');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toBeDefined();
  });
});
```

## Performance Optimization

### Caching

The authentication system includes intelligent caching:

```typescript
import { AuthCache } from '@agentic-workflow/api';

const cache = new AuthCache({
  maxSize: 1000,
  ttl: 300000, // 5 minutes
});

// Cache user profile
cache.set('user:profile', userProfile);

// Retrieve cached data
const cachedProfile = cache.get('user:profile');
```

### Performance Monitoring

```typescript
import { PerformanceMonitor } from '@agentic-workflow/api';

const monitor = new PerformanceMonitor();

// Monitor authentication performance
monitor.startTiming('auth:login');
await authClient.login(email, password);
monitor.endTiming('auth:login');

// Get performance metrics
const metrics = monitor.getMetrics();
```

## Development Guidelines

### Adding New Features

1. **Design First**: Plan the feature architecture
2. **Types**: Define TypeScript interfaces
3. **Implementation**: Create core functionality
4. **Testing**: Write comprehensive tests
5. **Documentation**: Update this guide
6. **Integration**: Add to useAuth hook if needed

### Security Considerations

1. **Input Validation**: Validate all user inputs
2. **Sanitization**: Sanitize data before processing
3. **Rate Limiting**: Implement rate limiting
4. **Audit Logging**: Log security events
5. **Encryption**: Encrypt sensitive data

### Code Quality

1. **TypeScript**: Use strict TypeScript configuration
2. **ESLint**: Follow ESLint rules
3. **Testing**: Maintain high test coverage
4. **Documentation**: Keep documentation updated
5. **Code Review**: Review all changes

## Troubleshooting

### Common Issues

1. **Token Refresh Failures**: Check token expiration and refresh logic
2. **CORS Errors**: Verify Supabase CORS configuration
3. **OAuth Redirects**: Ensure correct redirect URLs
4. **2FA Issues**: Verify TOTP/WebAuthn configuration

### Debugging

1. **Enable Debug Logging**: Set `DEBUG=true` in environment
2. **Network Inspection**: Check browser network tab
3. **Supabase Dashboard**: Monitor auth events in Supabase
4. **Error Boundaries**: Use error boundaries to catch errors

### Performance Issues

1. **Bundle Size**: Monitor authentication bundle size
2. **Token Storage**: Optimize token storage performance
3. **Network Requests**: Minimize unnecessary requests
4. **Memory Usage**: Profile memory usage patterns
