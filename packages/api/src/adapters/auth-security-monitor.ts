/**
 * Authentication Security Monitoring
 *
 * Provides real-time security monitoring for authentication events including
 * brute force detection, suspicious activity tracking, and security audit logging.
 */

export interface SecurityEvent {
  type: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  ip?: string;
  userAgent?: string;
  email?: string;
  userId?: string;
  details: Record<string, any>;
  riskScore: number; // 0-100
}

export interface SecurityAlert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  description: string;
  affectedEntities: {
    ips: string[];
    emails: string[];
    userIds: string[];
  };
  recommendations: string[];
  status: 'active' | 'acknowledged' | 'resolved';
}

export interface SecurityStats {
  totalEvents: number;
  alertsGenerated: number;
  activeThreats: number;
  blockedIPs: number;
  suspiciousActivities: number;
  lastAnalysis: number;
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

export interface SecurityMonitorConfig {
  bruteForceThreshold: number;
  bruteForceWindowMinutes: number;
  suspiciousActivityThreshold: number;
  anomalyDetectionEnabled: boolean;
  geoLocationTracking: boolean;
  deviceFingerprintingEnabled: boolean;
  alertingEnabled: boolean;
  auditLoggingEnabled: boolean;
  maxEventsInMemory: number;
  retentionDays: number;
}

export const DEFAULT_SECURITY_MONITOR_CONFIG: SecurityMonitorConfig = {
  bruteForceThreshold: 5,
  bruteForceWindowMinutes: 15,
  suspiciousActivityThreshold: 10,
  anomalyDetectionEnabled: true,
  geoLocationTracking: false, // Disabled by default for privacy
  deviceFingerprintingEnabled: true,
  alertingEnabled: true,
  auditLoggingEnabled: true,
  maxEventsInMemory: 5000,
  retentionDays: 30,
};

export class AuthSecurityMonitor {
  private events: SecurityEvent[] = [];
  private alerts: SecurityAlert[] = [];
  private blockedIPs = new Set<string>();
  private suspiciousIPs = new Map<string, number>(); // IP -> risk score
  private config: SecurityMonitorConfig;
  private alertHandlers: Array<(alert: SecurityAlert) => void> = [];

  constructor(config: Partial<SecurityMonitorConfig> = {}) {
    this.config = { ...DEFAULT_SECURITY_MONITOR_CONFIG, ...config };
  }

  /**
   * Track a security event
   */
  trackSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
    const fullEvent: SecurityEvent = {
      ...event,
      timestamp: Date.now(),
    };

    this.events.push(fullEvent);

    // Enforce memory limits
    if (this.events.length > this.config.maxEventsInMemory) {
      this.events = this.events.slice(-this.config.maxEventsInMemory);
    }

    // Analyze event for security threats
    this.analyzeEvent(fullEvent);

    // Log audit event
    if (this.config.auditLoggingEnabled) {
      this.logAuditEvent(fullEvent);
    }
  }

  /**
   * Track failed login attempt
   */
  trackFailedLogin(
    ip: string,
    email: string,
    userAgent?: string,
    details?: Record<string, any>
  ): void {
    this.trackSecurityEvent({
      type: 'failed_login',
      severity: 'medium',
      ip,
      email,
      userAgent,
      details: details || {},
      riskScore: this.calculateLoginFailureRisk(ip, email),
    });
  }

  /**
   * Track successful login with anomaly detection
   */
  trackSuccessfulLogin(
    ip: string,
    email: string,
    userId: string,
    userAgent?: string,
    details?: Record<string, any>
  ): void {
    const riskScore = this.calculateLoginRisk(ip, email, userAgent);

    this.trackSecurityEvent({
      type: 'successful_login',
      severity: riskScore > 70 ? 'high' : riskScore > 40 ? 'medium' : 'low',
      ip,
      email,
      userId,
      userAgent,
      details: details || {},
      riskScore,
    });
  }

  /**
   * Track suspicious activity
   */
  trackSuspiciousActivity(type: string, ip: string, details: Record<string, any>): void {
    this.trackSecurityEvent({
      type: `suspicious_${type}`,
      severity: 'high',
      ip,
      details,
      riskScore: 80,
    });
  }

  /**
   * Track password reset attempts
   */
  trackPasswordResetAttempt(ip: string, email: string, success: boolean): void {
    this.trackSecurityEvent({
      type: 'password_reset_attempt',
      severity: success ? 'low' : 'medium',
      ip,
      email,
      details: { success },
      riskScore: success ? 20 : 50,
    });
  }

  /**
   * Track session hijacking indicators
   */
  trackSessionAnomaly(userId: string, ip: string, previousIP: string, userAgent?: string): void {
    this.trackSecurityEvent({
      type: 'session_anomaly',
      severity: 'high',
      ip,
      userId,
      userAgent,
      details: { previousIP, type: 'ip_change' },
      riskScore: 85,
    });
  }

  /**
   * Analyze event for security threats
   */
  private analyzeEvent(event: SecurityEvent): void {
    // Brute force detection
    if (event.type === 'failed_login' && event.ip && event.email) {
      this.checkBruteForce(event.ip, event.email);
    }

    // Anomaly detection
    if (this.config.anomalyDetectionEnabled) {
      this.detectAnomalies(event);
    }

    // Update suspicious IP tracking
    if (event.ip && event.riskScore > 50) {
      this.updateSuspiciousIP(event.ip, event.riskScore);
    }

    // Check for immediate threats
    if (event.riskScore > 90) {
      this.generateCriticalAlert(event);
    }
  }

  /**
   * Check for brute force attacks
   */
  private checkBruteForce(ip: string, email: string): void {
    const windowStart = Date.now() - this.config.bruteForceWindowMinutes * 60 * 1000;

    // Count failed attempts for this IP/email combination
    const recentFailures = this.events.filter(
      event =>
        event.type === 'failed_login' &&
        event.ip === ip &&
        event.email === email &&
        event.timestamp >= windowStart
    );

    if (recentFailures.length >= this.config.bruteForceThreshold) {
      this.generateBruteForceAlert(ip, email, recentFailures.length);
      this.blockIP(ip, 'brute_force');
    }
  }

  /**
   * Detect anomalies in authentication patterns
   */
  private detectAnomalies(event: SecurityEvent): void {
    if (event.type !== 'successful_login' || !event.userId) return;

    // Check for unusual login times
    const hour = new Date(event.timestamp).getHours();
    const isUnusualTime = hour < 6 || hour > 22;

    // Check for rapid location changes (if geo tracking enabled)
    if (this.config.geoLocationTracking && event.ip) {
      // Implementation would check geographical distance from previous login
    }

    // Check for unusual user agent
    if (event.userAgent && this.isUnusualUserAgent(event.userId, event.userAgent)) {
      this.trackSecurityEvent({
        type: 'unusual_user_agent',
        severity: 'medium',
        userId: event.userId,
        ip: event.ip,
        userAgent: event.userAgent,
        details: { originalEvent: event },
        riskScore: 60,
      });
    }

    // Generate anomaly alert if multiple indicators present
    if (isUnusualTime && event.riskScore > 50) {
      this.generateAnomalyAlert(event);
    }
  }

  /**
   * Calculate risk score for login failure
   */
  private calculateLoginFailureRisk(ip: string, email: string): number {
    let riskScore = 30; // Base risk for failed login

    // Check if IP is already suspicious
    if (this.suspiciousIPs.has(ip)) {
      riskScore += this.suspiciousIPs.get(ip)! * 0.5;
    }

    // Check recent failure count
    const recentFailures = this.getRecentFailedAttempts(ip, email);
    riskScore += Math.min(recentFailures * 15, 60);

    // Check if IP is trying multiple accounts
    const uniqueEmailsAttempted = this.getUniqueEmailAttemptsFromIP(ip);
    if (uniqueEmailsAttempted > 3) {
      riskScore += 20;
    }

    return Math.min(riskScore, 100);
  }

  /**
   * Calculate risk score for successful login
   */
  private calculateLoginRisk(ip: string, email: string, _userAgent?: string): number {
    let riskScore = 10; // Base risk for successful login

    // Check if IP is suspicious
    if (this.suspiciousIPs.has(ip)) {
      riskScore += this.suspiciousIPs.get(ip)! * 0.3;
    }

    // Check if IP is blocked
    if (this.blockedIPs.has(ip)) {
      riskScore += 50;
    }

    // Check for recent failed attempts from different IPs for this email
    const recentFailuresFromOtherIPs = this.getRecentFailedAttemptsForEmail(email, ip);
    if (recentFailuresFromOtherIPs > 2) {
      riskScore += 30;
    }

    return Math.min(riskScore, 100);
  }

  /**
   * Generate brute force alert
   */
  private generateBruteForceAlert(ip: string, email: string, attemptCount: number): void {
    const alert: SecurityAlert = {
      id: `brute_force_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'brute_force_attack',
      severity: 'high',
      timestamp: Date.now(),
      description: `Brute force attack detected: ${attemptCount} failed login attempts for ${email} from IP ${ip}`,
      affectedEntities: {
        ips: [ip],
        emails: [email],
        userIds: [],
      },
      recommendations: [
        'Block the attacking IP address',
        'Monitor for additional attempts from related IPs',
        'Consider implementing rate limiting',
        'Notify the affected user if account exists',
      ],
      status: 'active',
    };

    this.addAlert(alert);
  }

  /**
   * Generate anomaly alert
   */
  private generateAnomalyAlert(event: SecurityEvent): void {
    const alert: SecurityAlert = {
      id: `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'login_anomaly',
      severity: 'medium',
      timestamp: Date.now(),
      description: `Anomalous login detected for user ${event.userId} from IP ${event.ip}`,
      affectedEntities: {
        ips: event.ip ? [event.ip] : [],
        emails: event.email ? [event.email] : [],
        userIds: event.userId ? [event.userId] : [],
      },
      recommendations: [
        'Verify login with user through secondary channel',
        'Monitor user activity for additional anomalies',
        'Consider requiring additional authentication',
      ],
      status: 'active',
    };

    this.addAlert(alert);
  }

  /**
   * Generate critical threat alert
   */
  private generateCriticalAlert(event: SecurityEvent): void {
    const alert: SecurityAlert = {
      id: `critical_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'critical_threat',
      severity: 'critical',
      timestamp: Date.now(),
      description: `Critical security threat detected: ${event.type}`,
      affectedEntities: {
        ips: event.ip ? [event.ip] : [],
        emails: event.email ? [event.email] : [],
        userIds: event.userId ? [event.userId] : [],
      },
      recommendations: [
        'Immediate investigation required',
        'Consider blocking affected entities',
        'Review related security events',
      ],
      status: 'active',
    };

    this.addAlert(alert);
  }

  /**
   * Block an IP address
   */
  blockIP(ip: string, reason: string): void {
    this.blockedIPs.add(ip);

    this.trackSecurityEvent({
      type: 'ip_blocked',
      severity: 'high',
      ip,
      details: { reason },
      riskScore: 90,
    });
  }

  /**
   * Unblock an IP address
   */
  unblockIP(ip: string): void {
    this.blockedIPs.delete(ip);
    this.suspiciousIPs.delete(ip);
  }

  /**
   * Check if IP is blocked
   */
  isIPBlocked(ip: string): boolean {
    return this.blockedIPs.has(ip);
  }

  /**
   * Get security statistics
   */
  getSecurityStats(): SecurityStats {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const recentEvents = this.events.filter(event => event.timestamp >= oneDayAgo);
    const activeAlerts = this.alerts.filter(alert => alert.status === 'active');

    const riskDistribution = {
      low: recentEvents.filter(e => e.riskScore <= 25).length,
      medium: recentEvents.filter(e => e.riskScore > 25 && e.riskScore <= 50).length,
      high: recentEvents.filter(e => e.riskScore > 50 && e.riskScore <= 75).length,
      critical: recentEvents.filter(e => e.riskScore > 75).length,
    };

    return {
      totalEvents: recentEvents.length,
      alertsGenerated: this.alerts.length,
      activeThreats: activeAlerts.length,
      blockedIPs: this.blockedIPs.size,
      suspiciousActivities: recentEvents.filter(e => e.riskScore > 60).length,
      lastAnalysis: now,
      riskDistribution,
    };
  }

  /**
   * Get recent security events
   */
  getRecentEvents(limit: number = 100, severity?: SecurityEvent['severity']): SecurityEvent[] {
    let events = [...this.events];

    if (severity) {
      events = events.filter(event => event.severity === severity);
    }

    return events.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): SecurityAlert[] {
    return this.alerts.filter(alert => alert.status === 'active');
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.status = 'acknowledged';
      return true;
    }
    return false;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.status = 'resolved';
      return true;
    }
    return false;
  }

  /**
   * Add alert handler
   */
  addAlertHandler(handler: (alert: SecurityAlert) => void): () => void {
    this.alertHandlers.push(handler);

    return () => {
      const index = this.alertHandlers.indexOf(handler);
      if (index > -1) {
        this.alertHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Configure security monitoring
   */
  configure(config: Partial<SecurityMonitorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Clean up old events and alerts
   */
  cleanup(): void {
    const cutoff = Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000;

    this.events = this.events.filter(event => event.timestamp >= cutoff);
    this.alerts = this.alerts.filter(alert => alert.timestamp >= cutoff);

    // Clean up old suspicious IPs that haven't had recent activity
    for (const [ip, score] of this.suspiciousIPs.entries()) {
      const hasRecentActivity = this.events.some(
        event => event.ip === ip && event.timestamp >= cutoff
      );

      if (!hasRecentActivity && score < 70) {
        this.suspiciousIPs.delete(ip);
      }
    }
  }

  /**
   * Export security report
   */
  exportSecurityReport(
    fromTimestamp?: number,
    toTimestamp?: number
  ): {
    summary: SecurityStats;
    events: SecurityEvent[];
    alerts: SecurityAlert[];
    blockedIPs: string[];
    suspiciousIPs: Array<{ ip: string; riskScore: number }>;
  } {
    const from = fromTimestamp || Date.now() - 7 * 24 * 60 * 60 * 1000; // Last 7 days
    const to = toTimestamp || Date.now();

    const filteredEvents = this.events.filter(
      event => event.timestamp >= from && event.timestamp <= to
    );

    const filteredAlerts = this.alerts.filter(
      alert => alert.timestamp >= from && alert.timestamp <= to
    );

    return {
      summary: this.getSecurityStats(),
      events: filteredEvents,
      alerts: filteredAlerts,
      blockedIPs: Array.from(this.blockedIPs),
      suspiciousIPs: Array.from(this.suspiciousIPs.entries()).map(([ip, riskScore]) => ({
        ip,
        riskScore,
      })),
    };
  }

  // Helper methods
  private addAlert(alert: SecurityAlert): void {
    this.alerts.push(alert);

    if (this.config.alertingEnabled) {
      this.alertHandlers.forEach(handler => {
        try {
          handler(alert);
        } catch (error) {
          console.warn('Security alert handler error:', error);
        }
      });
    }
  }

  private updateSuspiciousIP(ip: string, riskScore: number): void {
    const currentScore = this.suspiciousIPs.get(ip) || 0;
    const newScore = Math.min(Math.max(currentScore, riskScore), 100);
    this.suspiciousIPs.set(ip, newScore);
  }

  private getRecentFailedAttempts(ip: string, email: string): number {
    const windowStart = Date.now() - this.config.bruteForceWindowMinutes * 60 * 1000;
    return this.events.filter(
      event =>
        event.type === 'failed_login' &&
        event.ip === ip &&
        event.email === email &&
        event.timestamp >= windowStart
    ).length;
  }

  private getUniqueEmailAttemptsFromIP(ip: string): number {
    const windowStart = Date.now() - this.config.bruteForceWindowMinutes * 60 * 1000;
    const emails = new Set(
      this.events
        .filter(
          event =>
            event.type === 'failed_login' && event.ip === ip && event.timestamp >= windowStart
        )
        .map(event => event.email)
        .filter(Boolean)
    );
    return emails.size;
  }

  private getRecentFailedAttemptsForEmail(email: string, excludeIP?: string): number {
    const windowStart = Date.now() - 60 * 60 * 1000; // Last hour
    return this.events.filter(
      event =>
        event.type === 'failed_login' &&
        event.email === email &&
        event.ip !== excludeIP &&
        event.timestamp >= windowStart
    ).length;
  }

  private isUnusualUserAgent(userId: string, userAgent: string): boolean {
    // Get historical user agents for this user
    const historicalUAs = this.events
      .filter(event => event.userId === userId && event.userAgent)
      .map(event => event.userAgent)
      .filter(Boolean) as string[];

    // If we have no history, consider it unusual
    if (historicalUAs.length === 0) return true;

    // Check if this user agent has been seen before
    return !historicalUAs.includes(userAgent);
  }

  private logAuditEvent(event: SecurityEvent): void {
    // In a real implementation, this would log to your audit system
    if (process.env.NODE_ENV === 'development') {
      console.log('[Security Audit]', {
        timestamp: new Date(event.timestamp).toISOString(),
        type: event.type,
        severity: event.severity,
        riskScore: event.riskScore,
        details: event.details,
      });
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.events = [];
    this.alerts = [];
    this.alertHandlers = [];
    this.blockedIPs.clear();
    this.suspiciousIPs.clear();
  }
}

/**
 * Create security monitor instance
 */
export function createAuthSecurityMonitor(
  config?: Partial<SecurityMonitorConfig>
): AuthSecurityMonitor {
  return new AuthSecurityMonitor(config);
}

export default AuthSecurityMonitor;
