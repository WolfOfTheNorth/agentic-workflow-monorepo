/**
 * Analytics and Monitoring System for Supabase Authentication
 *
 * This module provides comprehensive monitoring, analytics, error tracking,
 * and debugging capabilities for authentication operations to meet
 * performance and reliability requirements.
 */

// import { ProfileResponse } from '../types/auth';

/**
 * Authentication event types for tracking
 */
export type AuthEventType =
  | 'login_attempt'
  | 'login_success'
  | 'login_failure'
  | 'registration_attempt'
  | 'registration_success'
  | 'registration_failure'
  | 'logout'
  | 'token_refresh'
  | 'token_refresh_failure'
  | 'session_restored'
  | 'session_expired'
  | 'password_reset_request'
  | 'password_reset_success'
  | 'email_verification_sent'
  | 'email_verification_success'
  | 'profile_update'
  | 'auth_error'
  | 'network_error'
  | 'performance_warning';

/**
 * Error severity levels
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Authentication event data structure
 */
export interface AuthEvent {
  id: string;
  type: AuthEventType;
  timestamp: number;
  userId?: string;
  email?: string;
  metadata: Record<string, any>;
  duration?: number;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  userAgent?: string;
  ipAddress?: string;
  sessionId?: string;
}

/**
 * Error tracking data structure
 */
export interface ErrorReport {
  id: string;
  type: 'auth_error' | 'network_error' | 'validation_error' | 'system_error';
  severity: ErrorSeverity;
  timestamp: number;
  message: string;
  code?: string;
  stack?: string;
  context: {
    operation: string;
    userId?: string;
    email?: string;
    sessionId?: string;
    metadata?: Record<string, any>;
  };
  resolved: boolean;
  resolvedAt?: number;
  frequency: number;
  firstOccurrence: number;
  lastOccurrence: number;
}

/**
 * Performance metrics for monitoring
 */
export interface PerformanceMetrics {
  operation: string;
  timestamp: number;
  duration: number;
  success: boolean;
  errorCode?: string;
  cacheHit?: boolean;
  retryCount?: number;
  metadata?: Record<string, any>;
}

/**
 * System health metrics
 */
export interface SystemHealthMetrics {
  timestamp: number;
  authOperations: {
    total: number;
    successful: number;
    failed: number;
    averageResponseTime: number;
    last24Hours: {
      total: number;
      successful: number;
      failed: number;
    };
  };
  errors: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    recentErrors: ErrorReport[];
  };
  performance: {
    averageLoginTime: number;
    averageRegistrationTime: number;
    averageTokenRefreshTime: number;
    cacheHitRate: number;
    slowestOperations: PerformanceMetrics[];
  };
  sessions: {
    activeSessions: number;
    expiredSessions: number;
    refreshedSessions: number;
  };
}

/**
 * Analytics configuration
 */
export interface AnalyticsConfig {
  enableEventTracking: boolean;
  enableErrorTracking: boolean;
  enablePerformanceMonitoring: boolean;
  enableDebugMode: boolean;
  maxEventsInMemory: number;
  maxErrorsInMemory: number;
  maxPerformanceMetricsInMemory: number;
  eventRetentionTime: number; // milliseconds
  errorRetentionTime: number; // milliseconds
  performanceRetentionTime: number; // milliseconds
  performanceWarningThreshold: number; // milliseconds
  enableAutoReporting: boolean;
  reportingInterval: number; // milliseconds
}

/**
 * Analytics and monitoring system
 */
export class AnalyticsMonitor {
  private config: AnalyticsConfig;
  private events: Map<string, AuthEvent> = new Map();
  private errors: Map<string, ErrorReport> = new Map();
  private performanceMetrics: PerformanceMetrics[] = [];
  private logger: AnalyticsLogger;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private reportingTimer: NodeJS.Timeout | null = null;
  private activeOperations: Map<string, { startTime: number; metadata: any }> = new Map();

  constructor(config?: Partial<AnalyticsConfig>) {
    this.config = {
      enableEventTracking: true,
      enableErrorTracking: true,
      enablePerformanceMonitoring: true,
      enableDebugMode: false,
      maxEventsInMemory: 1000,
      maxErrorsInMemory: 500,
      maxPerformanceMetricsInMemory: 1000,
      eventRetentionTime: 86400000, // 24 hours
      errorRetentionTime: 604800000, // 7 days
      performanceRetentionTime: 86400000, // 24 hours
      performanceWarningThreshold: 2000, // 2 seconds
      enableAutoReporting: true,
      reportingInterval: 300000, // 5 minutes
      ...config,
    };

    this.logger = new AnalyticsLogger('AnalyticsMonitor', this.config.enableDebugMode);
    this.startCleanupTimer();

    if (this.config.enableAutoReporting) {
      this.startReportingTimer();
    }

    this.logger.info('AnalyticsMonitor initialized', {
      enableEventTracking: this.config.enableEventTracking,
      enableErrorTracking: this.config.enableErrorTracking,
      enablePerformanceMonitoring: this.config.enablePerformanceMonitoring,
      maxEventsInMemory: this.config.maxEventsInMemory,
    });
  }

  // ===== EVENT TRACKING =====

  /**
   * Track authentication events
   */
  trackEvent(
    type: AuthEventType,
    metadata: Record<string, any> = {},
    success: boolean = true,
    userId?: string,
    email?: string,
    duration?: number,
    errorCode?: string,
    errorMessage?: string
  ): void {
    if (!this.config.enableEventTracking) {
      return;
    }

    const event: AuthEvent = {
      id: this.generateEventId(),
      type,
      timestamp: Date.now(),
      userId,
      email: this.sanitizeEmail(email),
      metadata: this.sanitizeMetadata(metadata),
      duration,
      success,
      errorCode,
      errorMessage,
      userAgent: this.getUserAgent(),
      ipAddress: this.getClientIP(),
      sessionId: this.getCurrentSessionId(),
    };

    this.events.set(event.id, event);
    this.ensureEventMemoryLimit();

    this.logger.debug('Event tracked', {
      type,
      success,
      duration,
      userId,
      eventId: event.id,
    });

    // Check for performance warnings
    if (duration && duration > this.config.performanceWarningThreshold) {
      this.trackPerformanceWarning(type, duration, metadata);
    }
  }

  /**
   * Track login attempts and results
   */
  trackLoginAttempt(email: string, metadata: Record<string, any> = {}): string {
    const operationId = this.generateOperationId();
    this.startOperation(operationId, { operation: 'login', email, ...metadata });

    this.trackEvent(
      'login_attempt',
      {
        operationId,
        ...metadata,
      },
      true,
      undefined,
      email
    );

    return operationId;
  }

  /**
   * Track login success
   */
  trackLoginSuccess(
    operationId: string,
    userId: string,
    email: string,
    metadata: Record<string, any> = {}
  ): void {
    const duration = this.endOperation(operationId);

    this.trackEvent(
      'login_success',
      {
        operationId,
        ...metadata,
      },
      true,
      userId,
      email,
      duration
    );
  }

  /**
   * Track login failure
   */
  trackLoginFailure(
    operationId: string,
    email: string,
    errorCode: string,
    errorMessage: string,
    metadata: Record<string, any> = {}
  ): void {
    const duration = this.endOperation(operationId);

    this.trackEvent(
      'login_failure',
      {
        operationId,
        ...metadata,
      },
      false,
      undefined,
      email,
      duration,
      errorCode,
      errorMessage
    );
  }

  /**
   * Track registration events
   */
  trackRegistrationAttempt(email: string, metadata: Record<string, any> = {}): string {
    const operationId = this.generateOperationId();
    this.startOperation(operationId, { operation: 'registration', email, ...metadata });

    this.trackEvent(
      'registration_attempt',
      {
        operationId,
        ...metadata,
      },
      true,
      undefined,
      email
    );

    return operationId;
  }

  trackRegistrationSuccess(
    operationId: string,
    userId: string,
    email: string,
    metadata: Record<string, any> = {}
  ): void {
    const duration = this.endOperation(operationId);

    this.trackEvent(
      'registration_success',
      {
        operationId,
        ...metadata,
      },
      true,
      userId,
      email,
      duration
    );
  }

  trackRegistrationFailure(
    operationId: string,
    email: string,
    errorCode: string,
    errorMessage: string,
    metadata: Record<string, any> = {}
  ): void {
    const duration = this.endOperation(operationId);

    this.trackEvent(
      'registration_failure',
      {
        operationId,
        ...metadata,
      },
      false,
      undefined,
      email,
      duration,
      errorCode,
      errorMessage
    );
  }

  /**
   * Track logout events
   */
  trackLogout(userId: string, sessionId?: string, metadata: Record<string, any> = {}): void {
    this.trackEvent(
      'logout',
      {
        sessionId,
        ...metadata,
      },
      true,
      userId
    );
  }

  /**
   * Track token refresh events
   */
  trackTokenRefresh(
    userId: string,
    success: boolean,
    duration: number,
    errorCode?: string,
    metadata: Record<string, any> = {}
  ): void {
    this.trackEvent(
      success ? 'token_refresh' : 'token_refresh_failure',
      {
        ...metadata,
      },
      success,
      userId,
      undefined,
      duration,
      errorCode
    );
  }

  /**
   * Track session events
   */
  trackSessionRestored(
    userId: string,
    sessionId: string,
    metadata: Record<string, any> = {}
  ): void {
    this.trackEvent(
      'session_restored',
      {
        sessionId,
        ...metadata,
      },
      true,
      userId
    );
  }

  trackSessionExpired(userId: string, sessionId: string, metadata: Record<string, any> = {}): void {
    this.trackEvent(
      'session_expired',
      {
        sessionId,
        ...metadata,
      },
      true,
      userId
    );
  }

  // ===== ERROR TRACKING =====

  /**
   * Track and report errors
   */
  trackError(
    type: ErrorReport['type'],
    severity: ErrorSeverity,
    message: string,
    context: Partial<ErrorReport['context']>,
    code?: string,
    stack?: string
  ): string {
    if (!this.config.enableErrorTracking) {
      return '';
    }

    // Create error hash for deduplication
    const errorHash = this.generateErrorHash(type, message, code, context.operation);
    const existingError = this.errors.get(errorHash);

    const now = Date.now();

    if (existingError) {
      // Update existing error
      existingError.frequency++;
      existingError.lastOccurrence = now;
      existingError.resolved = false; // Mark as unresolved if it occurred again
    } else {
      // Create new error report
      const errorReport: ErrorReport = {
        id: errorHash,
        type,
        severity,
        timestamp: now,
        message,
        code,
        stack,
        context: {
          operation: context.operation || 'unknown',
          userId: context.userId,
          email: this.sanitizeEmail(context.email),
          sessionId: context.sessionId,
          metadata: this.sanitizeMetadata(context.metadata || {}),
        },
        resolved: false,
        frequency: 1,
        firstOccurrence: now,
        lastOccurrence: now,
      };

      this.errors.set(errorHash, errorReport);
      this.ensureErrorMemoryLimit();
    }

    // Also track as event
    this.trackEvent(
      'auth_error',
      {
        errorType: type,
        severity,
        errorHash,
        operation: context.operation,
        ...context.metadata,
      },
      false,
      context.userId,
      context.email,
      undefined,
      code,
      message
    );

    this.logger.error('Error tracked', {
      type,
      severity,
      message,
      code,
      operation: context.operation,
      errorHash,
    });

    return errorHash;
  }

  /**
   * Mark error as resolved
   */
  resolveError(errorId: string): boolean {
    const error = this.errors.get(errorId);
    if (error && !error.resolved) {
      error.resolved = true;
      error.resolvedAt = Date.now();
      this.logger.info('Error marked as resolved', { errorId, resolvedAt: error.resolvedAt });
      return true;
    }
    return false;
  }

  /**
   * Get error reports with filtering
   */
  getErrorReports(
    options: {
      severity?: ErrorSeverity;
      type?: ErrorReport['type'];
      resolved?: boolean;
      limit?: number;
      since?: number;
    } = {}
  ): ErrorReport[] {
    const { severity, type, resolved, limit = 50, since } = options;

    let reports = Array.from(this.errors.values());

    // Apply filters
    if (severity) {
      reports = reports.filter(r => r.severity === severity);
    }

    if (type) {
      reports = reports.filter(r => r.type === type);
    }

    if (resolved !== undefined) {
      reports = reports.filter(r => r.resolved === resolved);
    }

    if (since) {
      reports = reports.filter(r => r.lastOccurrence >= since);
    }

    // Sort by last occurrence (most recent first)
    reports.sort((a, b) => b.lastOccurrence - a.lastOccurrence);

    return reports.slice(0, limit);
  }

  // ===== PERFORMANCE MONITORING =====

  /**
   * Start tracking an operation's performance
   */
  startOperation(operationId: string, metadata: Record<string, any> = {}): void {
    if (!this.config.enablePerformanceMonitoring) {
      return;
    }

    this.activeOperations.set(operationId, {
      startTime: Date.now(),
      metadata,
    });
  }

  /**
   * End tracking an operation and record performance metrics
   */
  endOperation(operationId: string): number {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      return 0;
    }

    const duration = Date.now() - operation.startTime;
    this.activeOperations.delete(operationId);

    if (this.config.enablePerformanceMonitoring) {
      const metric: PerformanceMetrics = {
        operation: operation.metadata.operation || 'unknown',
        timestamp: Date.now(),
        duration,
        success: true, // Will be updated by caller if needed
        metadata: operation.metadata,
      };

      this.performanceMetrics.push(metric);
      this.ensurePerformanceMemoryLimit();

      this.logger.debug('Operation performance recorded', {
        operationId,
        operation: metric.operation,
        duration,
      });
    }

    return duration;
  }

  /**
   * Track performance warning for slow operations
   */
  private trackPerformanceWarning(
    operation: string,
    duration: number,
    metadata: Record<string, any>
  ): void {
    this.trackEvent(
      'performance_warning',
      {
        operation,
        duration,
        threshold: this.config.performanceWarningThreshold,
        ...metadata,
      },
      false
    );

    this.logger.warn('Performance warning', {
      operation,
      duration,
      threshold: this.config.performanceWarningThreshold,
    });
  }

  /**
   * Get performance metrics with filtering
   */
  getPerformanceMetrics(
    options: {
      operation?: string;
      limit?: number;
      since?: number;
      slowest?: boolean;
    } = {}
  ): PerformanceMetrics[] {
    const { operation, limit = 100, since, slowest = false } = options;

    let metrics = [...this.performanceMetrics];

    // Apply filters
    if (operation) {
      metrics = metrics.filter(m => m.operation === operation);
    }

    if (since) {
      metrics = metrics.filter(m => m.timestamp >= since);
    }

    // Sort by duration (slowest first) or timestamp (most recent first)
    if (slowest) {
      metrics.sort((a, b) => b.duration - a.duration);
    } else {
      metrics.sort((a, b) => b.timestamp - a.timestamp);
    }

    return metrics.slice(0, limit);
  }

  // ===== SYSTEM HEALTH MONITORING =====

  /**
   * Get comprehensive system health metrics
   */
  getSystemHealth(): SystemHealthMetrics {
    const now = Date.now();
    const last24Hours = now - 86400000; // 24 hours ago

    // Calculate auth operation metrics
    const allEvents = Array.from(this.events.values());
    const authEvents = allEvents.filter(e =>
      [
        'login_attempt',
        'login_success',
        'login_failure',
        'registration_attempt',
        'registration_success',
        'registration_failure',
      ].includes(e.type)
    );
    const recent24HourEvents = authEvents.filter(e => e.timestamp >= last24Hours);

    const totalAuthOps = authEvents.length;
    const successfulAuthOps = authEvents.filter(e => e.success).length;
    const failedAuthOps = totalAuthOps - successfulAuthOps;

    const total24H = recent24HourEvents.length;
    const successful24H = recent24HourEvents.filter(e => e.success).length;
    const failed24H = total24H - successful24H;

    // Calculate average response times
    const authEventsWithDuration = authEvents.filter(e => e.duration);
    const avgResponseTime =
      authEventsWithDuration.length > 0
        ? authEventsWithDuration.reduce((sum, e) => sum + (e.duration || 0), 0) /
          authEventsWithDuration.length
        : 0;

    // Error metrics
    const allErrors = Array.from(this.errors.values());
    const criticalErrors = allErrors.filter(e => e.severity === 'critical').length;
    const highErrors = allErrors.filter(e => e.severity === 'high').length;
    const mediumErrors = allErrors.filter(e => e.severity === 'medium').length;
    const lowErrors = allErrors.filter(e => e.severity === 'low').length;
    const recentErrors = this.getErrorReports({ limit: 10, since: now - 3600000 }); // Last hour

    // Performance metrics
    const loginMetrics = this.getPerformanceMetrics({ operation: 'login' });
    const registrationMetrics = this.getPerformanceMetrics({ operation: 'registration' });
    const tokenRefreshMetrics = this.getPerformanceMetrics({ operation: 'token_refresh' });

    const avgLoginTime =
      loginMetrics.length > 0
        ? loginMetrics.reduce((sum, m) => sum + m.duration, 0) / loginMetrics.length
        : 0;
    const avgRegistrationTime =
      registrationMetrics.length > 0
        ? registrationMetrics.reduce((sum, m) => sum + m.duration, 0) / registrationMetrics.length
        : 0;
    const avgTokenRefreshTime =
      tokenRefreshMetrics.length > 0
        ? tokenRefreshMetrics.reduce((sum, m) => sum + m.duration, 0) / tokenRefreshMetrics.length
        : 0;

    // Session metrics
    const sessionEvents = allEvents.filter(e =>
      ['session_restored', 'session_expired', 'token_refresh'].includes(e.type)
    );
    const activeSessions = sessionEvents.filter(e => e.type === 'session_restored').length;
    const expiredSessions = sessionEvents.filter(e => e.type === 'session_expired').length;
    const refreshedSessions = sessionEvents.filter(
      e => e.type === 'token_refresh' && e.success
    ).length;

    return {
      timestamp: now,
      authOperations: {
        total: totalAuthOps,
        successful: successfulAuthOps,
        failed: failedAuthOps,
        averageResponseTime: avgResponseTime,
        last24Hours: {
          total: total24H,
          successful: successful24H,
          failed: failed24H,
        },
      },
      errors: {
        total: allErrors.length,
        critical: criticalErrors,
        high: highErrors,
        medium: mediumErrors,
        low: lowErrors,
        recentErrors,
      },
      performance: {
        averageLoginTime: avgLoginTime,
        averageRegistrationTime: avgRegistrationTime,
        averageTokenRefreshTime: avgTokenRefreshTime,
        cacheHitRate: this.calculateCacheHitRate(),
        slowestOperations: this.getPerformanceMetrics({ slowest: true, limit: 5 }),
      },
      sessions: {
        activeSessions,
        expiredSessions,
        refreshedSessions,
      },
    };
  }

  // ===== DEBUGGING AND TROUBLESHOOTING =====

  /**
   * Get debug information for a specific user
   */
  getUserDebugInfo(userId: string): {
    events: AuthEvent[];
    errors: ErrorReport[];
    performance: PerformanceMetrics[];
    sessions: AuthEvent[];
  } {
    const userEvents = Array.from(this.events.values()).filter(e => e.userId === userId);
    const userErrors = Array.from(this.errors.values()).filter(e => e.context.userId === userId);
    const userPerformance = this.performanceMetrics.filter(m => m.metadata?.userId === userId);
    const userSessions = userEvents.filter(e =>
      ['session_restored', 'session_expired', 'token_refresh', 'logout'].includes(e.type)
    );

    return {
      events: userEvents.sort((a, b) => b.timestamp - a.timestamp),
      errors: userErrors.sort((a, b) => b.lastOccurrence - a.lastOccurrence),
      performance: userPerformance.sort((a, b) => b.timestamp - a.timestamp),
      sessions: userSessions.sort((a, b) => b.timestamp - a.timestamp),
    };
  }

  /**
   * Get events for troubleshooting a specific operation
   */
  getOperationTrace(operationId: string): AuthEvent[] {
    return Array.from(this.events.values())
      .filter(e => e.metadata.operationId === operationId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Export analytics data for external analysis
   */
  exportAnalyticsData(
    options: {
      since?: number;
      includeEvents?: boolean;
      includeErrors?: boolean;
      includePerformance?: boolean;
    } = {}
  ): {
    events?: AuthEvent[];
    errors?: ErrorReport[];
    performance?: PerformanceMetrics[];
    systemHealth: SystemHealthMetrics;
  } {
    const {
      since,
      includeEvents = true,
      includeErrors = true,
      includePerformance = true,
    } = options;

    const result: any = {
      systemHealth: this.getSystemHealth(),
    };

    if (includeEvents) {
      let events = Array.from(this.events.values());
      if (since) {
        events = events.filter(e => e.timestamp >= since);
      }
      result.events = events.sort((a, b) => b.timestamp - a.timestamp);
    }

    if (includeErrors) {
      let errors = Array.from(this.errors.values());
      if (since) {
        errors = errors.filter(e => e.lastOccurrence >= since);
      }
      result.errors = errors.sort((a, b) => b.lastOccurrence - a.lastOccurrence);
    }

    if (includePerformance) {
      let performance = [...this.performanceMetrics];
      if (since) {
        performance = performance.filter(p => p.timestamp >= since);
      }
      result.performance = performance.sort((a, b) => b.timestamp - a.timestamp);
    }

    return result;
  }

  // ===== UTILITY METHODS =====

  /**
   * Clear all analytics data
   */
  clearAnalyticsData(): void {
    this.events.clear();
    this.errors.clear();
    this.performanceMetrics.length = 0;
    this.activeOperations.clear();

    this.logger.info('Analytics data cleared');
  }

  /**
   * Get analytics configuration
   */
  getConfig(): AnalyticsConfig {
    return { ...this.config };
  }

  /**
   * Update analytics configuration
   */
  updateConfig(newConfig: Partial<AnalyticsConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Analytics configuration updated', newConfig);
  }

  /**
   * Shutdown analytics monitor
   */
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (this.reportingTimer) {
      clearInterval(this.reportingTimer);
      this.reportingTimer = null;
    }

    this.logger.info('AnalyticsMonitor shutdown completed');
  }

  // ===== PRIVATE HELPER METHODS =====

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateErrorHash(
    type: string,
    message: string,
    code?: string,
    operation?: string
  ): string {
    const hashInput = `${type}:${message}:${code || ''}:${operation || ''}`;
    // Simple hash function (in production, use a proper crypto hash)
    let hash = 0;
    for (let i = 0; i < hashInput.length; i++) {
      const char = hashInput.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `err_${Math.abs(hash).toString(36)}`;
  }

  private sanitizeEmail(email?: string): string | undefined {
    if (!email) return undefined;
    // Only log domain part for privacy
    const parts = email.split('@');
    return parts.length === 2 ? `***@${parts[1]}` : '***@***';
  }

  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized = { ...metadata };

    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  private getUserAgent(): string {
    return (typeof navigator !== 'undefined' && navigator.userAgent) || 'Unknown';
  }

  private getClientIP(): string {
    // In a real implementation, this would extract the client IP from request headers
    return '0.0.0.0';
  }

  private getCurrentSessionId(): string | undefined {
    // This would be provided by the session manager
    return undefined;
  }

  private calculateCacheHitRate(): number {
    // This would integrate with the performance cache
    return 0;
  }

  private ensureEventMemoryLimit(): void {
    if (this.events.size > this.config.maxEventsInMemory) {
      const sortedEvents = Array.from(this.events.entries()).sort(
        ([, a], [, b]) => a.timestamp - b.timestamp
      );

      const toRemove = sortedEvents.slice(0, this.events.size - this.config.maxEventsInMemory);
      toRemove.forEach(([id]) => this.events.delete(id));
    }
  }

  private ensureErrorMemoryLimit(): void {
    if (this.errors.size > this.config.maxErrorsInMemory) {
      const sortedErrors = Array.from(this.errors.entries()).sort(
        ([, a], [, b]) => a.lastOccurrence - b.lastOccurrence
      );

      const toRemove = sortedErrors.slice(0, this.errors.size - this.config.maxErrorsInMemory);
      toRemove.forEach(([id]) => this.errors.delete(id));
    }
  }

  private ensurePerformanceMemoryLimit(): void {
    if (this.performanceMetrics.length > this.config.maxPerformanceMetricsInMemory) {
      this.performanceMetrics.sort((a, b) => a.timestamp - b.timestamp);
      this.performanceMetrics.splice(
        0,
        this.performanceMetrics.length - this.config.maxPerformanceMetricsInMemory
      );
    }
  }

  private startCleanupTimer(): void {
    // Run cleanup every 10 minutes
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, 600000);
  }

  private startReportingTimer(): void {
    // Generate reports at configured interval
    this.reportingTimer = setInterval(() => {
      this.generatePeriodicReport();
    }, this.config.reportingInterval);
  }

  private performCleanup(): void {
    const now = Date.now();

    // Clean old events
    const eventsToRemove: string[] = [];
    for (const [id, event] of this.events) {
      if (now - event.timestamp > this.config.eventRetentionTime) {
        eventsToRemove.push(id);
      }
    }
    eventsToRemove.forEach(id => this.events.delete(id));

    // Clean old errors
    const errorsToRemove: string[] = [];
    for (const [id, error] of this.errors) {
      if (now - error.lastOccurrence > this.config.errorRetentionTime) {
        errorsToRemove.push(id);
      }
    }
    errorsToRemove.forEach(id => this.errors.delete(id));

    // Clean old performance metrics
    this.performanceMetrics = this.performanceMetrics.filter(
      m => now - m.timestamp <= this.config.performanceRetentionTime
    );

    this.logger.debug('Analytics cleanup completed', {
      eventsRemoved: eventsToRemove.length,
      errorsRemoved: errorsToRemove.length,
      currentEvents: this.events.size,
      currentErrors: this.errors.size,
      currentMetrics: this.performanceMetrics.length,
    });
  }

  private generatePeriodicReport(): void {
    const systemHealth = this.getSystemHealth();

    this.logger.info('Periodic system health report', {
      timestamp: systemHealth.timestamp,
      totalAuthOps: systemHealth.authOperations.total,
      successRate:
        systemHealth.authOperations.total > 0
          ? (
              (systemHealth.authOperations.successful / systemHealth.authOperations.total) *
              100
            ).toFixed(2) + '%'
          : '0%',
      averageResponseTime: systemHealth.authOperations.averageResponseTime.toFixed(2) + 'ms',
      totalErrors: systemHealth.errors.total,
      criticalErrors: systemHealth.errors.critical,
      activeSessions: systemHealth.sessions.activeSessions,
    });
  }
}

/**
 * Analytics logger for consistent logging
 */
class AnalyticsLogger {
  constructor(
    private context: string,
    private debugMode: boolean = false
  ) {}

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    const timestamp = new Date().toISOString();

    // Skip debug logs if not in debug mode
    if (level === 'debug' && !this.debugMode) {
      return;
    }

    switch (level) {
      case 'debug':
        console.debug(`[${timestamp}] DEBUG [${this.context}] ${message}`, data || '');
        break;
      case 'info':
        console.info(`[${timestamp}] INFO [${this.context}] ${message}`, data || '');
        break;
      case 'warn':
        console.warn(`[${timestamp}] WARN [${this.context}] ${message}`, data || '');
        break;
      case 'error':
        console.error(`[${timestamp}] ERROR [${this.context}] ${message}`, data || '');
        break;
    }
  }

  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  error(message: string, error?: any): void {
    const errorData =
      error instanceof Error ? { message: error.message, stack: error.stack } : error;
    this.log('error', message, errorData);
  }
}

/**
 * Factory function to create AnalyticsMonitor instance
 */
export function createAnalyticsMonitor(config?: Partial<AnalyticsConfig>): AnalyticsMonitor {
  return new AnalyticsMonitor(config);
}

/**
 * Default analytics monitor instance (singleton)
 */
let defaultMonitor: AnalyticsMonitor | null = null;

export function getAnalyticsMonitor(config?: Partial<AnalyticsConfig>): AnalyticsMonitor {
  if (!defaultMonitor) {
    defaultMonitor = createAnalyticsMonitor(config);
  }
  return defaultMonitor;
}

/**
 * Reset analytics monitor instance (useful for testing)
 */
export function resetAnalyticsMonitor(): void {
  if (defaultMonitor) {
    defaultMonitor.shutdown();
    defaultMonitor = null;
  }
}
