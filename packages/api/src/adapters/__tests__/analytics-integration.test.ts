/**
 * Integration tests for Analytics Monitor with Supabase Adapter
 */

import { createSupabaseAdapter } from '../supabase';
import { createAnalyticsMonitor } from '../analytics-monitor';
import { createMonitoringDashboard } from '../monitoring-dashboard';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      getUser: jest.fn(),
      getSession: jest.fn(),
      refreshSession: jest.fn(),
      updateUser: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      resend: jest.fn(),
    },
  })),
}));

describe('Analytics Integration', () => {
  let adapter: any;
  let monitor: any;
  let dashboard: any;

  beforeEach(() => {
    // Create adapter with analytics enabled
    adapter = createSupabaseAdapter(
      undefined, // config manager
      undefined, // retry config
      undefined, // circuit breaker config
      undefined, // cache config
      {
        enableEventTracking: true,
        enableErrorTracking: true,
        enablePerformanceMonitoring: true,
        enableAutoReporting: false,
      }
    );

    monitor = adapter.getAnalyticsMonitor();
    dashboard = createMonitoringDashboard(adapter, {
      enableRealTimeUpdates: false,
      enableAlerts: true,
    });
  });

  afterEach(() => {
    monitor?.shutdown();
    dashboard?.shutdown();
  });

  describe('Analytics Integration with Adapter', () => {
    it('should provide analytics monitor instance', () => {
      expect(adapter.getAnalyticsMonitor()).toBeDefined();
      expect(typeof adapter.getSystemHealthMetrics).toBe('function');
      expect(typeof adapter.getErrorReports).toBe('function');
    });

    it('should track authentication metrics through adapter', () => {
      // Track some events through the monitor
      const operationId = monitor.trackLoginAttempt('test@example.com');
      monitor.trackLoginSuccess(operationId, 'user-123', 'test@example.com', { duration: 800 });

      // Get metrics through adapter
      const healthMetrics = adapter.getSystemHealthMetrics();
      expect(healthMetrics.authOperations.total).toBeGreaterThan(0);
      expect(healthMetrics.authOperations.successful).toBeGreaterThan(0);
    });

    it('should track errors through adapter', () => {
      monitor.trackError(
        'auth_error',
        'high',
        'Test authentication error',
        { operation: 'login', email: 'test@example.com' },
        'AUTH_FAILED'
      );

      const errorReports = adapter.getErrorReports({ severity: 'high' });
      expect(errorReports.length).toBeGreaterThan(0);
      expect(errorReports[0].severity).toBe('high');
    });

    it('should provide user debug information', () => {
      const userId = 'debug-user-123';

      monitor.trackLoginAttempt('debug@example.com');
      monitor.trackLoginSuccess('op1', userId, 'debug@example.com');

      const debugInfo = adapter.getUserDebugInfo(userId);
      expect(debugInfo.events.length).toBeGreaterThan(0);
      expect(debugInfo.events.some((e: any) => e.userId === userId)).toBe(true);
    });

    it('should export analytics data', () => {
      monitor.trackLoginAttempt('export@example.com');

      const exportData = adapter.exportAnalyticsData({
        includeEvents: true,
        includeErrors: true,
        includePerformance: true,
      });

      expect(exportData.systemHealth).toBeDefined();
      expect(exportData.events).toBeDefined();
      expect(Array.isArray(exportData.events)).toBe(true);
    });
  });

  describe('Monitoring Dashboard Integration', () => {
    it('should create dashboard with adapter', () => {
      expect(dashboard).toBeDefined();
      expect(typeof dashboard.getDashboardSummary).toBe('function');
      expect(typeof dashboard.getSystemStatus).toBe('function');
    });

    it('should provide dashboard summary', () => {
      // Add some test data
      monitor.trackLoginAttempt('dashboard@example.com');
      monitor.trackLoginSuccess('op1', 'user-456', 'dashboard@example.com');

      const summary = dashboard.getDashboardSummary();
      expect(summary.systemHealth).toBeDefined();
      expect(summary.trends).toBeDefined();
      expect(summary.recentActivity).toBeDefined();
      expect(Array.isArray(summary.alerts)).toBe(true);
    });

    it('should determine system status', () => {
      const status = dashboard.getSystemStatus();
      expect(status.status).toMatch(/^(healthy|warning|error|critical)$/);
      expect(typeof status.message).toBe('string');
      expect(status.details).toBeDefined();
      expect(typeof status.details.authSuccess).toBe('boolean');
    });

    it('should handle error analysis', () => {
      monitor.trackError('auth_error', 'critical', 'Critical test error', { operation: 'login' });
      monitor.trackError('network_error', 'medium', 'Network timeout', { operation: 'api_call' });

      const errorAnalysis = dashboard.getErrorAnalysis();
      expect(errorAnalysis.errorsByType).toBeDefined();
      expect(errorAnalysis.errorsBySeverity).toBeDefined();
      expect(Array.isArray(errorAnalysis.topErrorMessages)).toBe(true);
    });

    it('should provide user insights', () => {
      const insights = dashboard.getUserInsights();
      expect(typeof insights.totalUsers).toBe('number');
      expect(typeof insights.activeUsers).toBe('number');
      expect(Array.isArray(insights.topUsersByActivity)).toBe(true);
      expect(typeof insights.usersByStatus).toBe('object');
    });

    it('should support search functionality', () => {
      const userId = 'search-user-123';
      monitor.trackLoginAttempt('search@example.com');
      monitor.trackLoginSuccess('op1', userId, 'search@example.com');

      const searchResults = dashboard.searchEvents({
        userId,
        limit: 10,
      });

      expect(searchResults.events).toBeDefined();
      expect(searchResults.errors).toBeDefined();
      expect(typeof searchResults.totalFound).toBe('number');
    });

    it('should generate troubleshooting reports', () => {
      const userId = 'troubleshoot-user-123';

      monitor.trackLoginAttempt('trouble@example.com');
      monitor.trackLoginFailure('op1', 'trouble@example.com', 'AUTH_FAILED', 'Invalid credentials');
      monitor.trackError('auth_error', 'high', 'Repeated auth failures', {
        operation: 'login',
        userId,
        email: 'trouble@example.com',
      });

      const report = dashboard.generateTroubleshootingReport(userId);
      expect(report.userInfo).toBeDefined();
      expect(report.userInfo.userId).toBe(userId);
      expect(Array.isArray(report.recentEvents)).toBe(true);
      expect(Array.isArray(report.errors)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);
    });
  });

  describe('Configuration and Control', () => {
    it('should allow configuration updates', () => {
      const originalConfig = monitor.getConfig();
      expect(originalConfig.enableEventTracking).toBe(true);

      monitor.updateConfig({ enableEventTracking: false });

      const updatedConfig = monitor.getConfig();
      expect(updatedConfig.enableEventTracking).toBe(false);
    });

    it('should update dashboard configuration', () => {
      dashboard.updateConfig({
        refreshInterval: 30000,
        enableAlerts: false,
      });

      // Configuration update should be successful (no errors thrown)
      expect(true).toBe(true);
    });

    it('should clear analytics data', () => {
      // Add some data
      monitor.trackLoginAttempt('clear@example.com');
      monitor.trackError('auth_error', 'low', 'Test error', { operation: 'test' });

      let health = monitor.getSystemHealth();
      expect(health.authOperations.total).toBeGreaterThan(0);

      // Clear data
      monitor.clearAnalyticsData();

      health = monitor.getSystemHealth();
      expect(health.authOperations.total).toBe(0);
      expect(health.errors.total).toBe(0);
    });

    it('should export dashboard data', () => {
      monitor.trackLoginAttempt('export@example.com');

      const exportData = dashboard.exportDashboardData();
      expect(exportData.summary).toBeDefined();
      expect(exportData.fullAnalytics).toBeDefined();
      expect(typeof exportData.exportTimestamp).toBe('number');
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle high-volume event tracking', () => {
      const startTime = Date.now();

      // Track many events quickly
      for (let i = 0; i < 100; i++) {
        monitor.trackEvent('login_attempt', { iteration: i }, true, `user-${i}`);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete quickly

      const health = monitor.getSystemHealth();
      expect(health.authOperations.total).toBe(100);
    });

    it('should maintain performance with error tracking', () => {
      const startTime = Date.now();

      // Track many errors
      for (let i = 0; i < 50; i++) {
        monitor.trackError('auth_error', 'medium', `Error ${i}`, { operation: 'test' }, `ERR_${i}`);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(500);

      const errorReports = monitor.getErrorReports();
      expect(errorReports.length).toBe(50);
    });
  });
});
