/**
 * Monitoring Dashboard for Supabase Authentication Analytics
 *
 * This module provides a comprehensive dashboard for monitoring authentication
 * system health, performance metrics, error tracking, and debugging tools.
 */

import {
  AnalyticsMonitor,
  SystemHealthMetrics,
  ErrorReport,
  PerformanceMetrics,
} from './analytics-monitor';
import { SupabaseAdapter } from './supabase';

/**
 * Dashboard configuration options
 */
export interface DashboardConfig {
  refreshInterval: number; // milliseconds
  enableRealTimeUpdates: boolean;
  maxDisplayItems: number;
  enableAlerts: boolean;
  alertThresholds: {
    errorRate: number; // percentage
    responseTime: number; // milliseconds
    failureRate: number; // percentage
  };
}

/**
 * Alert severity levels
 */
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * System alert interface
 */
export interface SystemAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  timestamp: number;
  acknowledged: boolean;
  data?: Record<string, any>;
}

/**
 * Dashboard summary interface
 */
export interface DashboardSummary {
  systemHealth: SystemHealthMetrics;
  alerts: SystemAlert[];
  trends: {
    authSuccessRate: number;
    averageResponseTime: number;
    errorFrequency: number;
    activeUsers: number;
  };
  topErrors: ErrorReport[];
  slowestOperations: PerformanceMetrics[];
  recentActivity: {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    newErrors: number;
  };
}

/**
 * Monitoring dashboard class
 */
export class MonitoringDashboard {
  private adapter: SupabaseAdapter;
  private monitor: AnalyticsMonitor;
  private config: DashboardConfig;
  private alerts: Map<string, SystemAlert> = new Map();
  private refreshTimer: NodeJS.Timeout | null = null;
  private logger: DashboardLogger;

  constructor(adapter: SupabaseAdapter, config?: Partial<DashboardConfig>) {
    this.adapter = adapter;
    this.monitor = adapter.getAnalyticsMonitor();
    this.config = {
      refreshInterval: 60000, // 1 minute
      enableRealTimeUpdates: true,
      maxDisplayItems: 50,
      enableAlerts: true,
      alertThresholds: {
        errorRate: 5, // 5%
        responseTime: 3000, // 3 seconds
        failureRate: 10, // 10%
      },
      ...config,
    };

    this.logger = new DashboardLogger('MonitoringDashboard');

    if (this.config.enableRealTimeUpdates) {
      this.startRealTimeUpdates();
    }

    this.logger.info('Monitoring dashboard initialized', {
      refreshInterval: this.config.refreshInterval,
      enableRealTimeUpdates: this.config.enableRealTimeUpdates,
      enableAlerts: this.config.enableAlerts,
    });
  }

  // ===== DASHBOARD SUMMARY =====

  /**
   * Get comprehensive dashboard summary
   */
  getDashboardSummary(): DashboardSummary {
    const systemHealth = this.monitor.getSystemHealth();
    const currentAlerts = this.getCurrentAlerts();

    // Calculate trends
    const trends = this.calculateTrends(systemHealth);

    // Get top errors and slowest operations
    const topErrors = this.monitor.getErrorReports({
      limit: 5,
      resolved: false,
    });

    const slowestOperations = this.monitor.getPerformanceMetrics({
      slowest: true,
      limit: 5,
    });

    // Calculate recent activity (last hour)
    const lastHour = Date.now() - 3600000;
    const recentActivity = this.calculateRecentActivity(lastHour);

    return {
      systemHealth,
      alerts: currentAlerts,
      trends,
      topErrors,
      slowestOperations,
      recentActivity,
    };
  }

  /**
   * Get real-time system status
   */
  getSystemStatus(): {
    status: 'healthy' | 'warning' | 'error' | 'critical';
    message: string;
    details: {
      authSuccess: boolean;
      responseTime: boolean;
      errorRate: boolean;
      criticalErrors: boolean;
    };
  } {
    const health = this.monitor.getSystemHealth();
    const alerts = this.getCurrentAlerts();

    // Check various health indicators
    const authSuccessRate =
      health.authOperations.total > 0
        ? (health.authOperations.successful / health.authOperations.total) * 100
        : 100;

    const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
    const errorAlerts = alerts.filter(a => a.severity === 'error').length;

    const details = {
      authSuccess: authSuccessRate >= 100 - this.config.alertThresholds.failureRate,
      responseTime:
        health.authOperations.averageResponseTime <= this.config.alertThresholds.responseTime,
      errorRate: health.errors.critical === 0 && health.errors.high <= 5,
      criticalErrors: criticalAlerts === 0,
    };

    // Determine overall status
    let status: 'healthy' | 'warning' | 'error' | 'critical' = 'healthy';
    let message = 'All systems operational';

    if (criticalAlerts > 0 || !details.criticalErrors) {
      status = 'critical';
      message = 'Critical issues detected requiring immediate attention';
    } else if (errorAlerts > 0 || !details.authSuccess || !details.responseTime) {
      status = 'error';
      message = 'System errors detected requiring attention';
    } else if (alerts.length > 0 || !details.errorRate) {
      status = 'warning';
      message = 'System warnings detected, monitoring required';
    }

    return {
      status,
      message,
      details,
    };
  }

  // ===== ALERT MANAGEMENT =====

  /**
   * Get current active alerts
   */
  getCurrentAlerts(): SystemAlert[] {
    return Array.from(this.alerts.values())
      .filter(alert => !alert.acknowledged)
      .sort((a, b) => {
        // Sort by severity first, then by timestamp
        const severityOrder = { critical: 4, error: 3, warning: 2, info: 1 };
        const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
        return severityDiff !== 0 ? severityDiff : b.timestamp - a.timestamp;
      })
      .slice(0, this.config.maxDisplayItems);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      this.logger.info('Alert acknowledged', { alertId, title: alert.title });
      return true;
    }
    return false;
  }

  /**
   * Clear acknowledged alerts
   */
  clearAcknowledgedAlerts(): number {
    const toRemove: string[] = [];

    for (const [id, alert] of this.alerts) {
      if (alert.acknowledged) {
        toRemove.push(id);
      }
    }

    toRemove.forEach(id => this.alerts.delete(id));

    this.logger.info('Acknowledged alerts cleared', { count: toRemove.length });
    return toRemove.length;
  }

  // ===== PERFORMANCE ANALYSIS =====

  /**
   * Get performance trends over time
   */
  getPerformanceTrends(_timeRange: { start: number; end: number }): {
    authOperations: Array<{ timestamp: number; count: number; successRate: number }>;
    responseTime: Array<{ timestamp: number; averageTime: number }>;
    errorRate: Array<{ timestamp: number; errorCount: number }>;
  } {
    // This would implement time-series analysis of performance data
    // For now, returning a basic structure
    return {
      authOperations: [],
      responseTime: [],
      errorRate: [],
    };
  }

  /**
   * Get detailed error analysis
   */
  getErrorAnalysis(): {
    errorsByType: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    topErrorMessages: Array<{ message: string; count: number; lastOccurrence: number }>;
    errorTrends: Array<{ timestamp: number; count: number }>;
  } {
    const errors = this.monitor.getErrorReports({ limit: 1000 });

    const errorsByType: Record<string, number> = {};
    const errorsBySeverity: Record<string, number> = {};
    const messageFrequency: Record<string, { count: number; lastOccurrence: number }> = {};

    errors.forEach(error => {
      // Count by type
      errorsByType[error.type] = (errorsByType[error.type] || 0) + error.frequency;

      // Count by severity
      errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + error.frequency;

      // Track message frequency
      const key = error.message.substring(0, 100); // Limit length
      if (!messageFrequency[key]) {
        messageFrequency[key] = { count: 0, lastOccurrence: 0 };
      }
      messageFrequency[key].count += error.frequency;
      messageFrequency[key].lastOccurrence = Math.max(
        messageFrequency[key].lastOccurrence,
        error.lastOccurrence
      );
    });

    const topErrorMessages = Object.entries(messageFrequency)
      .map(([message, data]) => ({ message, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      errorsByType,
      errorsBySeverity,
      topErrorMessages,
      errorTrends: [], // Would implement time-series analysis
    };
  }

  // ===== USER ANALYTICS =====

  /**
   * Get user activity insights
   */
  getUserInsights(): {
    totalUsers: number;
    activeUsers: number;
    newRegistrations: number;
    topUsersByActivity: Array<{ userId: string; activityCount: number }>;
    usersByStatus: Record<string, number>;
  } {
    // This would analyze user activity patterns
    // For now, returning basic structure with placeholder data
    const health = this.monitor.getSystemHealth();

    return {
      totalUsers: health.sessions.activeSessions,
      activeUsers: health.sessions.activeSessions,
      newRegistrations: 0, // Would track from registration events
      topUsersByActivity: [],
      usersByStatus: {
        active: health.sessions.activeSessions,
        expired: health.sessions.expiredSessions,
      },
    };
  }

  // ===== DEBUGGING TOOLS =====

  /**
   * Search events and errors by criteria
   */
  searchEvents(criteria: {
    userId?: string;
    email?: string;
    eventType?: string;
    errorSeverity?: string;
    timeRange?: { start: number; end: number };
    limit?: number;
  }): {
    events: any[];
    errors: ErrorReport[];
    totalFound: number;
  } {
    const { userId, eventType, errorSeverity, timeRange, limit = 100 } = criteria;

    let events: any[] = [];
    let errors: ErrorReport[] = [];

    if (userId) {
      const userDebug = this.monitor.getUserDebugInfo(userId);
      events = userDebug.events;
      errors = userDebug.errors;
    } else {
      errors = this.monitor.getErrorReports({
        severity: errorSeverity as any,
        limit: limit,
      });
    }

    // Apply time range filter
    if (timeRange) {
      events = events.filter(e => e.timestamp >= timeRange.start && e.timestamp <= timeRange.end);
      errors = errors.filter(
        e => e.lastOccurrence >= timeRange.start && e.lastOccurrence <= timeRange.end
      );
    }

    // Apply event type filter
    if (eventType) {
      events = events.filter(e => e.type === eventType);
    }

    return {
      events: events.slice(0, limit),
      errors: errors.slice(0, limit),
      totalFound: events.length + errors.length,
    };
  }

  /**
   * Generate troubleshooting report for a user
   */
  generateTroubleshootingReport(userId: string): {
    userInfo: {
      userId: string;
      lastActivity: number;
      totalEvents: number;
      errorCount: number;
    };
    recentEvents: any[];
    errors: ErrorReport[];
    recommendations: string[];
  } {
    const debugInfo = this.monitor.getUserDebugInfo(userId);

    const recommendations: string[] = [];

    // Analyze patterns and generate recommendations
    if (debugInfo.errors.length > 5) {
      recommendations.push('User experiencing frequent errors - investigate account status');
    }

    if (debugInfo.sessions.length === 0) {
      recommendations.push('No recent session activity - user may need assistance logging in');
    }

    const recentFailures = debugInfo.events.filter(
      e => !e.success && Date.now() - e.timestamp < 3600000 // Last hour
    );

    if (recentFailures.length > 3) {
      recommendations.push('Multiple recent failures - check for potential security issues');
    }

    return {
      userInfo: {
        userId,
        lastActivity: debugInfo.events.length > 0 ? debugInfo.events[0].timestamp : 0,
        totalEvents: debugInfo.events.length,
        errorCount: debugInfo.errors.length,
      },
      recentEvents: debugInfo.events.slice(0, 20),
      errors: debugInfo.errors.slice(0, 10),
      recommendations,
    };
  }

  // ===== CONFIGURATION AND CONTROL =====

  /**
   * Update dashboard configuration
   */
  updateConfig(newConfig: Partial<DashboardConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Restart real-time updates if interval changed
    if (newConfig.refreshInterval || newConfig.enableRealTimeUpdates !== undefined) {
      this.stopRealTimeUpdates();
      if (this.config.enableRealTimeUpdates) {
        this.startRealTimeUpdates();
      }
    }

    this.logger.info('Dashboard configuration updated', newConfig);
  }

  /**
   * Export dashboard data for external analysis
   */
  exportDashboardData(): {
    summary: DashboardSummary;
    fullAnalytics: any;
    exportTimestamp: number;
  } {
    return {
      summary: this.getDashboardSummary(),
      fullAnalytics: this.monitor.exportAnalyticsData({
        includeEvents: true,
        includeErrors: true,
        includePerformance: true,
      }),
      exportTimestamp: Date.now(),
    };
  }

  /**
   * Shutdown dashboard
   */
  shutdown(): void {
    this.stopRealTimeUpdates();
    this.logger.info('Monitoring dashboard shutdown completed');
  }

  // ===== PRIVATE HELPER METHODS =====

  private startRealTimeUpdates(): void {
    this.refreshTimer = setInterval(() => {
      this.checkForAlerts();
    }, this.config.refreshInterval);

    this.logger.debug('Real-time updates started', {
      interval: this.config.refreshInterval,
    });
  }

  private stopRealTimeUpdates(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private checkForAlerts(): void {
    if (!this.config.enableAlerts) {
      return;
    }

    const health = this.monitor.getSystemHealth();
    this.checkResponseTimeAlerts(health);
    this.checkErrorRateAlerts(health);
    this.checkFailureRateAlerts(health);
  }

  private checkResponseTimeAlerts(health: SystemHealthMetrics): void {
    if (health.authOperations.averageResponseTime > this.config.alertThresholds.responseTime) {
      this.createAlert(
        'warning',
        'High Response Time',
        `Average response time (${health.authOperations.averageResponseTime.toFixed(0)}ms) exceeds threshold`,
        { averageResponseTime: health.authOperations.averageResponseTime }
      );
    }
  }

  private checkErrorRateAlerts(health: SystemHealthMetrics): void {
    if (health.errors.critical > 0) {
      this.createAlert(
        'critical',
        'Critical Errors Detected',
        `${health.errors.critical} critical errors require immediate attention`,
        { criticalErrorCount: health.errors.critical }
      );
    }

    if (health.errors.high > 10) {
      this.createAlert(
        'error',
        'High Error Count',
        `${health.errors.high} high-severity errors detected`,
        { highErrorCount: health.errors.high }
      );
    }
  }

  private checkFailureRateAlerts(health: SystemHealthMetrics): void {
    if (health.authOperations.total > 0) {
      const failureRate = (health.authOperations.failed / health.authOperations.total) * 100;

      if (failureRate > this.config.alertThresholds.failureRate) {
        this.createAlert(
          'warning',
          'High Failure Rate',
          `Authentication failure rate (${failureRate.toFixed(1)}%) exceeds threshold`,
          { failureRate }
        );
      }
    }
  }

  private createAlert(
    severity: AlertSeverity,
    title: string,
    message: string,
    data?: Record<string, any>
  ): void {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const alert: SystemAlert = {
      id: alertId,
      severity,
      title,
      message,
      timestamp: Date.now(),
      acknowledged: false,
      data,
    };

    // Check if similar alert already exists to avoid spam
    const existingSimilar = Array.from(this.alerts.values()).find(
      a => a.title === title && !a.acknowledged && Date.now() - a.timestamp < 300000 // 5 minutes
    );

    if (!existingSimilar) {
      this.alerts.set(alertId, alert);
      this.logger.warn('Alert created', { alertId, severity, title });
    }
  }

  private calculateTrends(health: SystemHealthMetrics): DashboardSummary['trends'] {
    return {
      authSuccessRate:
        health.authOperations.total > 0
          ? (health.authOperations.successful / health.authOperations.total) * 100
          : 100,
      averageResponseTime: health.authOperations.averageResponseTime,
      errorFrequency: health.errors.total,
      activeUsers: health.sessions.activeSessions,
    };
  }

  private calculateRecentActivity(_since: number): DashboardSummary['recentActivity'] {
    // This would filter events by timestamp and calculate recent activity
    // For now, using current health metrics as approximation
    const health = this.monitor.getSystemHealth();

    return {
      totalOperations: health.authOperations.last24Hours.total,
      successfulOperations: health.authOperations.last24Hours.successful,
      failedOperations: health.authOperations.last24Hours.failed,
      newErrors: health.errors.recentErrors.length,
    };
  }
}

/**
 * Dashboard logger for consistent logging
 */
class DashboardLogger {
  constructor(private context: string) {}

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    const timestamp = new Date().toISOString();

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
 * Factory function to create MonitoringDashboard instance
 */
export function createMonitoringDashboard(
  adapter: SupabaseAdapter,
  config?: Partial<DashboardConfig>
): MonitoringDashboard {
  return new MonitoringDashboard(adapter, config);
}
