/**
 * Authentication Metrics Tracking
 *
 * Provides comprehensive metrics collection for authentication events,
 * login/signup success rates, session management, and performance monitoring.
 */

export interface AuthMetricEvent {
  type: string;
  userId?: string;
  email?: string;
  timestamp: number;
  metadata?: Record<string, any>;
  duration?: number;
  success: boolean;
  errorCode?: string;
  clientInfo?: {
    ip?: string;
    userAgent?: string;
    origin?: string;
  };
}

export interface AuthMetricsSummary {
  totalEvents: number;
  successfulLogins: number;
  failedLogins: number;
  successfulSignups: number;
  failedSignups: number;
  sessionRefreshes: number;
  passwordResets: number;
  averageLoginDuration: number;
  averageSignupDuration: number;
  errorRates: Record<string, number>;
  userAgentDistribution: Record<string, number>;
  timeRange: {
    from: number;
    to: number;
  };
}

export interface AuthMetricsConfig {
  enabledEvents: string[];
  retentionDays: number;
  batchSize: number;
  flushInterval: number; // milliseconds
  enablePerformanceTracking: boolean;
  enableClientTracking: boolean;
  enableErrorDetails: boolean;
  maxEventsInMemory: number;
}

export const DEFAULT_AUTH_METRICS_CONFIG: AuthMetricsConfig = {
  enabledEvents: [
    'login_attempt',
    'login_success',
    'login_failure',
    'signup_attempt',
    'signup_success',
    'signup_failure',
    'session_refresh',
    'session_expired',
    'logout',
    'password_reset_request',
    'password_reset_success',
    'email_verification',
    'profile_update',
  ],
  retentionDays: 30,
  batchSize: 100,
  flushInterval: 5000, // 5 seconds
  enablePerformanceTracking: true,
  enableClientTracking: true,
  enableErrorDetails: true,
  maxEventsInMemory: 1000,
};

export class AuthMetrics {
  private events: AuthMetricEvent[] = [];
  private config: AuthMetricsConfig;
  private flushTimer: NodeJS.Timeout | null = null;
  private eventHandlers: Map<string, Array<(event: AuthMetricEvent) => void>> = new Map();

  constructor(config: Partial<AuthMetricsConfig> = {}) {
    this.config = { ...DEFAULT_AUTH_METRICS_CONFIG, ...config };
    this.startFlushTimer();
  }

  /**
   * Track an authentication event
   */
  trackEvent(event: Omit<AuthMetricEvent, 'timestamp'>): void {
    if (!this.config.enabledEvents.includes(event.type)) {
      return;
    }

    const fullEvent: AuthMetricEvent = {
      ...event,
      timestamp: Date.now(),
    };

    // Add to memory
    this.events.push(fullEvent);

    // Enforce memory limits
    if (this.events.length > this.config.maxEventsInMemory) {
      this.events = this.events.slice(-this.config.maxEventsInMemory);
    }

    // Trigger event handlers
    const handlers = this.eventHandlers.get(event.type) || [];
    handlers.forEach(handler => {
      try {
        handler(fullEvent);
      } catch (error) {
        console.warn('Auth metrics event handler error:', error);
      }
    });

    // Auto-flush if batch size reached
    if (this.events.length >= this.config.batchSize) {
      this.flush();
    }
  }

  /**
   * Track login attempt
   */
  trackLoginAttempt(email: string, clientInfo?: AuthMetricEvent['clientInfo']): number {
    const startTime = Date.now();
    this.trackEvent({
      type: 'login_attempt',
      email,
      success: true, // Attempt itself is successful
      clientInfo,
    });
    return startTime;
  }

  /**
   * Track login success
   */
  trackLoginSuccess(
    email: string,
    userId: string,
    startTime: number,
    clientInfo?: AuthMetricEvent['clientInfo']
  ): void {
    this.trackEvent({
      type: 'login_success',
      userId,
      email,
      success: true,
      duration: Date.now() - startTime,
      clientInfo,
    });
  }

  /**
   * Track login failure
   */
  trackLoginFailure(
    email: string,
    errorCode: string,
    startTime: number,
    clientInfo?: AuthMetricEvent['clientInfo']
  ): void {
    this.trackEvent({
      type: 'login_failure',
      email,
      success: false,
      errorCode,
      duration: Date.now() - startTime,
      clientInfo,
    });
  }

  /**
   * Track signup attempt
   */
  trackSignupAttempt(email: string, clientInfo?: AuthMetricEvent['clientInfo']): number {
    const startTime = Date.now();
    this.trackEvent({
      type: 'signup_attempt',
      email,
      success: true,
      clientInfo,
    });
    return startTime;
  }

  /**
   * Track signup success
   */
  trackSignupSuccess(
    email: string,
    userId: string,
    startTime: number,
    clientInfo?: AuthMetricEvent['clientInfo']
  ): void {
    this.trackEvent({
      type: 'signup_success',
      userId,
      email,
      success: true,
      duration: Date.now() - startTime,
      clientInfo,
    });
  }

  /**
   * Track signup failure
   */
  trackSignupFailure(
    email: string,
    errorCode: string,
    startTime: number,
    clientInfo?: AuthMetricEvent['clientInfo']
  ): void {
    this.trackEvent({
      type: 'signup_failure',
      email,
      success: false,
      errorCode,
      duration: Date.now() - startTime,
      clientInfo,
    });
  }

  /**
   * Track session refresh
   */
  trackSessionRefresh(userId: string, success: boolean, errorCode?: string): void {
    this.trackEvent({
      type: 'session_refresh',
      userId,
      success,
      errorCode,
    });
  }

  /**
   * Track session expiration
   */
  trackSessionExpired(userId: string, reason?: string): void {
    this.trackEvent({
      type: 'session_expired',
      userId,
      success: false,
      metadata: { reason },
    });
  }

  /**
   * Track logout
   */
  trackLogout(userId: string, voluntary: boolean = true): void {
    this.trackEvent({
      type: 'logout',
      userId,
      success: true,
      metadata: { voluntary },
    });
  }

  /**
   * Track password reset request
   */
  trackPasswordResetRequest(email: string, success: boolean, errorCode?: string): void {
    this.trackEvent({
      type: 'password_reset_request',
      email,
      success,
      errorCode,
    });
  }

  /**
   * Track password reset success
   */
  trackPasswordResetSuccess(userId: string): void {
    this.trackEvent({
      type: 'password_reset_success',
      userId,
      success: true,
    });
  }

  /**
   * Track email verification
   */
  trackEmailVerification(userId: string, success: boolean, errorCode?: string): void {
    this.trackEvent({
      type: 'email_verification',
      userId,
      success,
      errorCode,
    });
  }

  /**
   * Track profile update
   */
  trackProfileUpdate(userId: string, success: boolean, fields: string[], errorCode?: string): void {
    this.trackEvent({
      type: 'profile_update',
      userId,
      success,
      errorCode,
      metadata: { fields },
    });
  }

  /**
   * Get metrics summary for a time range
   */
  getSummary(fromTimestamp?: number, toTimestamp?: number): AuthMetricsSummary {
    const from = fromTimestamp || Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000;
    const to = toTimestamp || Date.now();

    const filteredEvents = this.events.filter(
      event => event.timestamp >= from && event.timestamp <= to
    );

    const summary: AuthMetricsSummary = {
      totalEvents: filteredEvents.length,
      successfulLogins: 0,
      failedLogins: 0,
      successfulSignups: 0,
      failedSignups: 0,
      sessionRefreshes: 0,
      passwordResets: 0,
      averageLoginDuration: 0,
      averageSignupDuration: 0,
      errorRates: {},
      userAgentDistribution: {},
      timeRange: { from, to },
    };

    let totalLoginDuration = 0;
    let loginDurationCount = 0;
    let totalSignupDuration = 0;
    let signupDurationCount = 0;

    filteredEvents.forEach(event => {
      switch (event.type) {
        case 'login_success':
          summary.successfulLogins++;
          if (event.duration) {
            totalLoginDuration += event.duration;
            loginDurationCount++;
          }
          break;
        case 'login_failure':
          summary.failedLogins++;
          if (event.errorCode) {
            summary.errorRates[event.errorCode] = (summary.errorRates[event.errorCode] || 0) + 1;
          }
          break;
        case 'signup_success':
          summary.successfulSignups++;
          if (event.duration) {
            totalSignupDuration += event.duration;
            signupDurationCount++;
          }
          break;
        case 'signup_failure':
          summary.failedSignups++;
          if (event.errorCode) {
            summary.errorRates[event.errorCode] = (summary.errorRates[event.errorCode] || 0) + 1;
          }
          break;
        case 'session_refresh':
          summary.sessionRefreshes++;
          break;
        case 'password_reset_request':
          summary.passwordResets++;
          break;
      }

      // Track user agent distribution
      if (event.clientInfo?.userAgent) {
        const ua = this.simplifyUserAgent(event.clientInfo.userAgent);
        summary.userAgentDistribution[ua] = (summary.userAgentDistribution[ua] || 0) + 1;
      }
    });

    // Calculate averages
    summary.averageLoginDuration =
      loginDurationCount > 0 ? totalLoginDuration / loginDurationCount : 0;
    summary.averageSignupDuration =
      signupDurationCount > 0 ? totalSignupDuration / signupDurationCount : 0;

    return summary;
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit: number = 100, type?: string): AuthMetricEvent[] {
    let events = [...this.events];

    if (type) {
      events = events.filter(event => event.type === type);
    }

    return events.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }

  /**
   * Get error rate for a specific period
   */
  getErrorRate(type: 'login' | 'signup', hours: number = 24): number {
    const since = Date.now() - hours * 60 * 60 * 1000;
    const events = this.events.filter(event => event.timestamp >= since);

    const successEvents = events.filter(event => event.type === `${type}_success` && event.success);
    const failureEvents = events.filter(
      event => event.type === `${type}_failure` && !event.success
    );

    const total = successEvents.length + failureEvents.length;
    return total > 0 ? failureEvents.length / total : 0;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): {
    averageResponseTimes: Record<string, number>;
    p95ResponseTimes: Record<string, number>;
    p99ResponseTimes: Record<string, number>;
  } {
    const metrics = {
      averageResponseTimes: {} as Record<string, number>,
      p95ResponseTimes: {} as Record<string, number>,
      p99ResponseTimes: {} as Record<string, number>,
    };

    const eventTypes = ['login_success', 'signup_success', 'session_refresh'];

    eventTypes.forEach(type => {
      const durations = this.events
        .filter(event => event.type === type && event.duration)
        .map(event => event.duration!)
        .sort((a, b) => a - b);

      if (durations.length > 0) {
        metrics.averageResponseTimes[type] =
          durations.reduce((a, b) => a + b, 0) / durations.length;
        metrics.p95ResponseTimes[type] = durations[Math.floor(durations.length * 0.95)] || 0;
        metrics.p99ResponseTimes[type] = durations[Math.floor(durations.length * 0.99)] || 0;
      }
    });

    return metrics;
  }

  /**
   * Add event listener
   */
  addEventListener(eventType: string, handler: (event: AuthMetricEvent) => void): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }

    this.eventHandlers.get(eventType)!.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.eventHandlers.get(eventType);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  /**
   * Flush events (implement your own persistence logic)
   */
  flush(): void {
    if (this.events.length === 0) return;

    // Here you would implement actual persistence to your metrics backend
    // For now, we'll just log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[AuthMetrics] Flushing ${this.events.length} events`, this.events);
    }

    // Clear events after flushing
    this.events = [];
  }

  /**
   * Configure metrics collection
   */
  configure(config: Partial<AuthMetricsConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart flush timer if interval changed
    if (config.flushInterval) {
      this.stopFlushTimer();
      this.startFlushTimer();
    }
  }

  /**
   * Clean up old events
   */
  cleanup(): void {
    const cutoff = Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000;
    this.events = this.events.filter(event => event.timestamp >= cutoff);
  }

  /**
   * Start automatic flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
      this.cleanup();
    }, this.config.flushInterval);
  }

  /**
   * Stop flush timer
   */
  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Simplify user agent for grouping
   */
  private simplifyUserAgent(userAgent: string): string {
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    if (userAgent.includes('Opera')) return 'Opera';
    return 'Other';
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.stopFlushTimer();
    this.flush();
    this.events = [];
    this.eventHandlers.clear();
  }
}

/**
 * Create auth metrics instance
 */
export function createAuthMetrics(config?: Partial<AuthMetricsConfig>): AuthMetrics {
  return new AuthMetrics(config);
}

export default AuthMetrics;
