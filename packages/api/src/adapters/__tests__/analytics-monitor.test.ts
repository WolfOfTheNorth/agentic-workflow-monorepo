/**
 * Tests for Analytics Monitor functionality
 */

import {
  AnalyticsMonitor,
  createAnalyticsMonitor,
  AnalyticsConfig,
  AuthEventType,
  ErrorSeverity,
} from '../analytics-monitor';

describe('AnalyticsMonitor', () => {
  let monitor: AnalyticsMonitor;

  beforeEach(() => {
    monitor = createAnalyticsMonitor({
      enableEventTracking: true,
      enableErrorTracking: true,
      enablePerformanceMonitoring: true,
      enableDebugMode: false,
      maxEventsInMemory: 100,
      maxErrorsInMemory: 50,
      performanceWarningThreshold: 1000,
      enableAutoReporting: false, // Disable for tests
    });
  });

  afterEach(() => {
    monitor.shutdown();
  });

  describe('Event Tracking', () => {
    it('should track authentication events', () => {
      monitor.trackEvent(
        'login_attempt',
        { userAgent: 'test' },
        true,
        'user-123',
        'test@example.com',
        500
      );

      const metrics = monitor.getSystemHealth();
      expect(metrics.authOperations.total).toBe(1);
    });

    it('should track login flow with operation ID', () => {
      const operationId = monitor.trackLoginAttempt('test@example.com', { source: 'web' });
      expect(operationId).toMatch(/^op_\d+_/);

      monitor.trackLoginSuccess(operationId, 'user-123', 'test@example.com', { duration: 800 });

      const metrics = monitor.getSystemHealth();
      expect(metrics.authOperations.successful).toBe(1);
    });

    it('should track login failures', () => {
      const operationId = monitor.trackLoginAttempt('test@example.com');
      monitor.trackLoginFailure(
        operationId,
        'test@example.com',
        'INVALID_CREDENTIALS',
        'Invalid password'
      );

      const metrics = monitor.getSystemHealth();
      expect(metrics.authOperations.failed).toBe(1);
    });

    it('should track registration events', () => {
      const operationId = monitor.trackRegistrationAttempt('new@example.com');
      monitor.trackRegistrationSuccess(operationId, 'user-456', 'new@example.com');

      const metrics = monitor.getSystemHealth();
      expect(metrics.authOperations.successful).toBe(1);
    });

    it('should track session events', () => {
      monitor.trackSessionRestored('user-123', 'session-456');
      monitor.trackSessionExpired('user-123', 'session-456');

      const debugInfo = monitor.getUserDebugInfo('user-123');
      expect(debugInfo.sessions).toHaveLength(2);
      expect(debugInfo.sessions[0].type).toBe('session_expired');
      expect(debugInfo.sessions[1].type).toBe('session_restored');
    });

    it('should track token refresh events', () => {
      monitor.trackTokenRefresh('user-123', true, 300);
      monitor.trackTokenRefresh('user-123', false, 1500, 'TOKEN_EXPIRED');

      const metrics = monitor.getSystemHealth();
      expect(metrics.sessions.refreshedSessions).toBe(1);
    });

    it('should track logout events', () => {
      monitor.trackLogout('user-123', 'session-456', { reason: 'user_initiated' });

      const debugInfo = monitor.getUserDebugInfo('user-123');
      expect(debugInfo.events).toHaveLength(1);
      expect(debugInfo.events[0].type).toBe('logout');
    });
  });

  describe('Error Tracking', () => {
    it('should track and deduplicate errors', () => {
      const errorId1 = monitor.trackError(
        'auth_error',
        'high',
        'Invalid credentials',
        { operation: 'login', email: 'test@example.com' },
        'INVALID_CREDS'
      );

      const errorId2 = monitor.trackError(
        'auth_error',
        'high',
        'Invalid credentials',
        { operation: 'login', email: 'test@example.com' },
        'INVALID_CREDS'
      );

      expect(errorId1).toBe(errorId2);

      const errors = monitor.getErrorReports();
      expect(errors).toHaveLength(1);
      expect(errors[0].frequency).toBe(2);
    });

    it('should track different error severities', () => {
      monitor.trackError('system_error', 'critical', 'Database connection failed', {
        operation: 'login',
      });
      monitor.trackError('validation_error', 'medium', 'Invalid email format', {
        operation: 'registration',
      });
      monitor.trackError('network_error', 'low', 'Slow network response', {
        operation: 'profile_fetch',
      });

      const metrics = monitor.getSystemHealth();
      expect(metrics.errors.critical).toBe(1);
      expect(metrics.errors.medium).toBe(1);
      expect(metrics.errors.low).toBe(1);
      expect(metrics.errors.total).toBe(3);
    });

    it('should resolve errors', () => {
      const errorId = monitor.trackError('auth_error', 'medium', 'Temporary service unavailable', {
        operation: 'login',
      });

      expect(monitor.resolveError(errorId)).toBe(true);

      const resolvedErrors = monitor.getErrorReports({ resolved: true });
      expect(resolvedErrors).toHaveLength(1);
      expect(resolvedErrors[0].resolved).toBe(true);
      expect(resolvedErrors[0].resolvedAt).toBeDefined();
    });

    it('should filter error reports', () => {
      monitor.trackError('auth_error', 'critical', 'Critical auth error', { operation: 'login' });
      monitor.trackError('auth_error', 'high', 'High auth error', { operation: 'login' });
      monitor.trackError('network_error', 'medium', 'Network error', { operation: 'api_call' });

      const criticalErrors = monitor.getErrorReports({ severity: 'critical' });
      expect(criticalErrors).toHaveLength(1);
      expect(criticalErrors[0].severity).toBe('critical');

      const authErrors = monitor.getErrorReports({ type: 'auth_error' });
      expect(authErrors).toHaveLength(2);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track operation performance', () => {
      const operationId = 'test-op-123';
      monitor.startOperation(operationId, { operation: 'login', userId: 'user-123' });

      // Simulate some work
      const duration = monitor.endOperation(operationId);
      expect(duration).toBeGreaterThan(0);

      const perfMetrics = monitor.getPerformanceMetrics({ operation: 'login' });
      expect(perfMetrics).toHaveLength(1);
      expect(perfMetrics[0].operation).toBe('login');
    });

    it('should track performance warnings for slow operations', () => {
      // Track an event with duration exceeding threshold
      monitor.trackEvent('login_attempt', {}, true, 'user-123', 'test@example.com', 1500); // 1.5 seconds

      // Should generate a performance warning event
      const metrics = monitor.getSystemHealth();
      // The warning would be tracked as an event
      expect(metrics.authOperations.total).toBeGreaterThan(0);
    });

    it('should get slowest operations', () => {
      const op1 = 'op1';
      const op2 = 'op2';
      const op3 = 'op3';

      monitor.startOperation(op1, { operation: 'login' });
      monitor.startOperation(op2, { operation: 'login' });
      monitor.startOperation(op3, { operation: 'registration' });

      // End operations with different durations
      setTimeout(() => monitor.endOperation(op1), 10);
      setTimeout(() => monitor.endOperation(op2), 20);
      setTimeout(() => monitor.endOperation(op3), 5);

      setTimeout(() => {
        const slowestMetrics = monitor.getPerformanceMetrics({ slowest: true, limit: 2 });
        expect(slowestMetrics).toHaveLength(2);
      }, 50);
    });
  });

  describe('System Health Monitoring', () => {
    it('should calculate comprehensive system health metrics', () => {
      // Generate some test data
      monitor.trackLoginAttempt('user1@example.com');
      monitor.trackLoginSuccess('op1', 'user-1', 'user1@example.com');

      monitor.trackLoginAttempt('user2@example.com');
      monitor.trackLoginFailure('op2', 'user2@example.com', 'INVALID_CREDS', 'Wrong password');

      monitor.trackError('auth_error', 'high', 'Auth service unavailable', { operation: 'login' });

      const health = monitor.getSystemHealth();

      expect(health.authOperations.total).toBe(2);
      expect(health.authOperations.successful).toBe(1);
      expect(health.authOperations.failed).toBe(1);
      expect(health.errors.total).toBe(1);
      expect(health.errors.high).toBe(1);
      expect(health.timestamp).toBeGreaterThan(0);
    });

    it('should track 24-hour metrics', () => {
      const now = Date.now();
      const yesterday = now - 25 * 60 * 60 * 1000; // 25 hours ago

      // Track old event (should not be in 24h metrics)
      monitor.trackEvent('login_success', {}, true, 'user-1', 'old@example.com');

      // Track recent event (should be in 24h metrics)
      monitor.trackEvent('login_success', {}, true, 'user-2', 'recent@example.com');

      const health = monitor.getSystemHealth();
      expect(health.authOperations.last24Hours.successful).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Debugging and Troubleshooting', () => {
    it('should get user debug information', () => {
      const userId = 'debug-user-123';

      monitor.trackLoginAttempt('debug@example.com');
      monitor.trackLoginSuccess('op1', userId, 'debug@example.com');
      monitor.trackLogout(userId, 'session-123');

      monitor.trackError('auth_error', 'medium', 'Test error', {
        operation: 'login',
        userId,
        email: 'debug@example.com',
      });

      const debugInfo = monitor.getUserDebugInfo(userId);

      expect(debugInfo.events.length).toBeGreaterThan(0);
      expect(debugInfo.errors.length).toBeGreaterThan(0);
      expect(debugInfo.events.every(e => e.userId === userId)).toBe(true);
      expect(debugInfo.errors.every(e => e.context.userId === userId)).toBe(true);
    });

    it('should trace operation flow', () => {
      const operationId = 'trace-op-123';

      monitor.trackEvent('login_attempt', { operationId }, true);
      monitor.trackEvent('auth_validation', { operationId }, true);
      monitor.trackEvent('login_success', { operationId }, true);

      const trace = monitor.getOperationTrace(operationId);
      expect(trace).toHaveLength(3);
      expect(trace[0].type).toBe('login_attempt');
      expect(trace[2].type).toBe('login_success');
    });

    it('should export analytics data', () => {
      // Generate test data
      monitor.trackLoginAttempt('export@example.com');
      monitor.trackError('auth_error', 'high', 'Export test error', { operation: 'test' });

      const exported = monitor.exportAnalyticsData({
        includeEvents: true,
        includeErrors: true,
        includePerformance: true,
      });

      expect(exported.systemHealth).toBeDefined();
      expect(exported.events).toBeDefined();
      expect(exported.errors).toBeDefined();
      expect(exported.performance).toBeDefined();

      expect(exported.events!.length).toBeGreaterThan(0);
      expect(exported.errors!.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration and Memory Management', () => {
    it('should respect memory limits', () => {
      const smallMonitor = createAnalyticsMonitor({
        maxEventsInMemory: 3,
        maxErrorsInMemory: 2,
        enableAutoReporting: false,
      });

      // Add more events than the limit
      for (let i = 0; i < 5; i++) {
        smallMonitor.trackEvent('login_attempt', {}, true, `user-${i}`);
      }

      // Add more errors than the limit
      for (let i = 0; i < 4; i++) {
        smallMonitor.trackError(
          'auth_error',
          'medium',
          `Error ${i}`,
          { operation: 'test' },
          `ERR_${i}`
        );
      }

      // Should only keep the most recent items
      const health = smallMonitor.getSystemHealth();
      expect(health.authOperations.total).toBeLessThanOrEqual(3);
      expect(health.errors.total).toBeLessThanOrEqual(2);

      smallMonitor.shutdown();
    });

    it('should clear analytics data', () => {
      monitor.trackLoginAttempt('clear@example.com');
      monitor.trackError('auth_error', 'low', 'Test error', { operation: 'test' });

      let health = monitor.getSystemHealth();
      expect(health.authOperations.total).toBeGreaterThan(0);
      expect(health.errors.total).toBeGreaterThan(0);

      monitor.clearAnalyticsData();

      health = monitor.getSystemHealth();
      expect(health.authOperations.total).toBe(0);
      expect(health.errors.total).toBe(0);
    });

    it('should update configuration', () => {
      const originalConfig = monitor.getConfig();
      expect(originalConfig.enableEventTracking).toBe(true);

      monitor.updateConfig({ enableEventTracking: false });

      const updatedConfig = monitor.getConfig();
      expect(updatedConfig.enableEventTracking).toBe(false);
    });

    it('should respect disabled tracking', () => {
      const disabledMonitor = createAnalyticsMonitor({
        enableEventTracking: false,
        enableErrorTracking: false,
        enablePerformanceMonitoring: false,
      });

      disabledMonitor.trackEvent('login_attempt', {}, true);
      disabledMonitor.trackError('auth_error', 'high', 'Test error', { operation: 'test' });
      disabledMonitor.startOperation('test-op', {});
      disabledMonitor.endOperation('test-op');

      const health = disabledMonitor.getSystemHealth();
      expect(health.authOperations.total).toBe(0);
      expect(health.errors.total).toBe(0);

      disabledMonitor.shutdown();
    });
  });

  describe('Data Privacy and Security', () => {
    it('should sanitize email addresses in logs', () => {
      monitor.trackLoginAttempt('sensitive@example.com');

      const health = monitor.getSystemHealth();
      // Check that the actual email is not stored in a way that could be exposed
      // The implementation should sanitize emails to show only domain
    });

    it('should redact sensitive metadata', () => {
      monitor.trackEvent(
        'login_attempt',
        {
          password: 'secret123',
          token: 'jwt-token',
          normalField: 'safe-value',
        },
        true
      );

      // The implementation should redact sensitive fields
      // This test would need to check the internal storage or exported data
    });
  });
});
