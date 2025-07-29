/**
 * Enhanced Session Monitoring System
 *
 * This module provides advanced session monitoring capabilities including
 * background session validity checking, session conflict resolution,
 * network status monitoring, and enhanced error recovery mechanisms.
 */

import { SessionManager, StoredSessionData, SessionEventCallbacks } from './session-manager';
import { SupabaseAdapter } from './supabase';
import { ExtendedApiError, mapGenericErrorToApiError } from './transformers';

/**
 * Configuration for session monitoring
 */
export interface SessionMonitorConfig {
  validityCheckInterval: number; // Milliseconds between validity checks
  networkCheckInterval: number; // Milliseconds between network checks
  sessionConflictThreshold: number; // Milliseconds to consider session conflict
  maxConcurrentSessions: number; // Maximum allowed concurrent sessions
  enableNetworkMonitoring: boolean;
  enableVisibilityMonitoring: boolean;
  enableStorageMonitoring: boolean;
  enableHeartbeat: boolean;
  heartbeatInterval: number; // Milliseconds between heartbeats
}

/**
 * Session monitoring events
 */
export interface SessionMonitorEvents extends SessionEventCallbacks {
  onNetworkOffline?: () => void;
  onNetworkOnline?: () => void;
  onSessionConflict?: (conflictInfo: SessionConflictInfo) => void;
  onSessionHeartbeat?: (sessionData: StoredSessionData) => void;
  onMonitoringStarted?: () => void;
  onMonitoringStopped?: () => void;
  onValidityCheckFailed?: (error: ExtendedApiError) => void;
}

/**
 * Session conflict information
 */
export interface SessionConflictInfo {
  currentSession: StoredSessionData;
  conflictingSession: StoredSessionData;
  conflictType: 'duplicate_session' | 'token_mismatch' | 'user_mismatch';
  timestamp: number;
  resolution: 'keep_current' | 'use_newer' | 'logout_all';
}

/**
 * Network status information
 */
export interface NetworkStatus {
  isOnline: boolean;
  lastOnlineCheck: number;
  connectionType: string | null;
  lastOfflineAt?: number;
  lastOnlineAt?: number;
}

/**
 * Session monitoring statistics
 */
export interface SessionMonitorStats {
  validityChecks: number;
  successfulRefreshes: number;
  failedRefreshes: number;
  sessionConflicts: number;
  networkDisconnections: number;
  heartbeats: number;
  startTime: number;
  lastActivity: number;
}

/**
 * Enhanced Session Monitor class
 */
export class SessionMonitor {
  private sessionManager: SessionManager;
  private adapter: SupabaseAdapter;
  private config: SessionMonitorConfig;
  private callbacks: SessionMonitorEvents;
  private logger: SessionMonitorLogger;

  // Monitoring intervals
  private validityCheckInterval: NodeJS.Timeout | null = null;
  private networkCheckInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  // State tracking
  private isMonitoring = false;
  private networkStatus: NetworkStatus;
  private stats: SessionMonitorStats;

  // Event listeners
  private visibilityChangeListener?: () => void;
  private storageChangeListener?: (event: StorageEvent) => void;
  private onlineListener?: () => void;
  private offlineListener?: () => void;

  constructor(
    sessionManager: SessionManager,
    adapter: SupabaseAdapter,
    config?: Partial<SessionMonitorConfig>,
    callbacks?: SessionMonitorEvents
  ) {
    this.sessionManager = sessionManager;
    this.adapter = adapter;
    this.callbacks = callbacks || {};
    this.logger = new SessionMonitorLogger('SessionMonitor');

    // Set default configuration
    this.config = {
      validityCheckInterval: 30000, // 30 seconds
      networkCheckInterval: 10000, // 10 seconds
      sessionConflictThreshold: 5000, // 5 seconds
      maxConcurrentSessions: 1,
      enableNetworkMonitoring: true,
      enableVisibilityMonitoring: true,
      enableStorageMonitoring: true,
      enableHeartbeat: true,
      heartbeatInterval: 60000, // 1 minute
      ...config,
    };

    // Initialize state
    this.networkStatus = {
      isOnline: navigator.onLine,
      lastOnlineCheck: Date.now(),
      connectionType: this.getConnectionType(),
      lastOnlineAt: navigator.onLine ? Date.now() : undefined,
    };

    this.stats = {
      validityChecks: 0,
      successfulRefreshes: 0,
      failedRefreshes: 0,
      sessionConflicts: 0,
      networkDisconnections: 0,
      heartbeats: 0,
      startTime: Date.now(),
      lastActivity: Date.now(),
    };

    this.logger.info('SessionMonitor initialized', {
      validityCheckInterval: this.config.validityCheckInterval,
      networkMonitoring: this.config.enableNetworkMonitoring,
      heartbeat: this.config.enableHeartbeat,
    });
  }

  /**
   * Start comprehensive session monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      this.logger.warn('Session monitoring is already active');
      return;
    }

    this.logger.info('Starting enhanced session monitoring');
    this.isMonitoring = true;
    this.stats.startTime = Date.now();

    // Start validity checking
    this.startValidityChecking();

    // Start network monitoring
    if (this.config.enableNetworkMonitoring) {
      this.startNetworkMonitoring();
    }

    // Start visibility monitoring
    if (this.config.enableVisibilityMonitoring) {
      this.startVisibilityMonitoring();
    }

    // Start storage monitoring
    if (this.config.enableStorageMonitoring) {
      this.startStorageMonitoring();
    }

    // Start heartbeat
    if (this.config.enableHeartbeat) {
      this.startHeartbeat();
    }

    // Notify callback
    if (this.callbacks.onMonitoringStarted) {
      this.callbacks.onMonitoringStarted();
    }
  }

  /**
   * Stop all session monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.logger.info('Stopping session monitoring');
    this.isMonitoring = false;

    // Clear all intervals
    if (this.validityCheckInterval) {
      clearInterval(this.validityCheckInterval);
      this.validityCheckInterval = null;
    }

    if (this.networkCheckInterval) {
      clearInterval(this.networkCheckInterval);
      this.networkCheckInterval = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Remove event listeners
    this.removeEventListeners();

    // Notify callback
    if (this.callbacks.onMonitoringStopped) {
      this.callbacks.onMonitoringStopped();
    }
  }

  /**
   * Get current monitoring status
   */
  getMonitoringStatus(): {
    isActive: boolean;
    networkStatus: NetworkStatus;
    stats: SessionMonitorStats;
    currentSession: StoredSessionData | null;
  } {
    return {
      isActive: this.isMonitoring,
      networkStatus: { ...this.networkStatus },
      stats: { ...this.stats },
      currentSession: this.sessionManager.getCurrentSession(),
    };
  }

  /**
   * Force immediate session validity check
   */
  async checkSessionValidity(): Promise<boolean> {
    this.logger.debug('Performing manual session validity check');

    try {
      const currentSession = this.sessionManager.getCurrentSession();
      if (!currentSession) {
        this.logger.debug('No active session to validate');
        return false;
      }

      // Check if session is expired
      const now = Date.now();
      if (currentSession.expires_at <= now) {
        this.logger.info('Session has expired', {
          expiresAt: new Date(currentSession.expires_at).toISOString(),
          now: new Date(now).toISOString(),
        });

        // Attempt refresh
        return await this.handleSessionExpiration();
      }

      // Check with Supabase
      const client = this.adapter.getClient();
      const { data, error } = await client.auth.getSession();

      if (error) {
        this.logger.warn('Session validity check failed', { error: error.message });

        const apiError = mapGenericErrorToApiError(
          new Error(error.message),
          'checkSessionValidity'
        );

        if (this.callbacks.onValidityCheckFailed) {
          this.callbacks.onValidityCheckFailed(apiError);
        }

        return false;
      }

      // Check for session conflicts
      if (data.session) {
        await this.checkForSessionConflicts(data.session, currentSession);
      }

      this.stats.validityChecks++;
      this.stats.lastActivity = Date.now();

      return !!data.session;
    } catch (error) {
      this.logger.error('Session validity check error', error);

      const apiError = mapGenericErrorToApiError(
        error instanceof Error ? error : new Error(String(error)),
        'checkSessionValidity'
      );

      if (this.callbacks.onValidityCheckFailed) {
        this.callbacks.onValidityCheckFailed(apiError);
      }

      return false;
    }
  }

  /**
   * Start periodic session validity checking
   */
  private startValidityChecking(): void {
    this.validityCheckInterval = setInterval(async () => {
      if (!this.isMonitoring) return;

      await this.checkSessionValidity();
    }, this.config.validityCheckInterval);

    this.logger.debug('Started validity checking', {
      interval: this.config.validityCheckInterval,
    });
  }

  /**
   * Start network status monitoring
   */
  private startNetworkMonitoring(): void {
    // Set up online/offline event listeners
    this.onlineListener = () => {
      this.handleNetworkOnline();
    };

    this.offlineListener = () => {
      this.handleNetworkOffline();
    };

    window.addEventListener('online', this.onlineListener);
    window.addEventListener('offline', this.offlineListener);

    // Periodic network checks
    this.networkCheckInterval = setInterval(() => {
      this.checkNetworkStatus();
    }, this.config.networkCheckInterval);

    this.logger.debug('Started network monitoring');
  }

  /**
   * Start visibility change monitoring
   */
  private startVisibilityMonitoring(): void {
    this.visibilityChangeListener = () => {
      if (document.visibilityState === 'visible') {
        this.handleVisibilityChange(true);
      } else {
        this.handleVisibilityChange(false);
      }
    };

    document.addEventListener('visibilitychange', this.visibilityChangeListener);
    this.logger.debug('Started visibility monitoring');
  }

  /**
   * Start storage change monitoring
   */
  private startStorageMonitoring(): void {
    this.storageChangeListener = (event: StorageEvent) => {
      if (event.key === 'agentic_workflow_session') {
        this.handleStorageChange(event);
      }
    };

    window.addEventListener('storage', this.storageChangeListener);
    this.logger.debug('Started storage monitoring');
  }

  /**
   * Start session heartbeat
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);

    this.logger.debug('Started session heartbeat', {
      interval: this.config.heartbeatInterval,
    });
  }

  /**
   * Handle network coming online
   */
  private handleNetworkOnline(): void {
    this.logger.info('Network connection restored');

    this.networkStatus.isOnline = true;
    this.networkStatus.lastOnlineAt = Date.now();
    this.networkStatus.connectionType = this.getConnectionType();

    // Trigger immediate validity check
    this.checkSessionValidity();

    if (this.callbacks.onNetworkOnline) {
      this.callbacks.onNetworkOnline();
    }
  }

  /**
   * Handle network going offline
   */
  private handleNetworkOffline(): void {
    this.logger.warn('Network connection lost');

    this.networkStatus.isOnline = false;
    this.networkStatus.lastOfflineAt = Date.now();
    this.stats.networkDisconnections++;

    if (this.callbacks.onNetworkOffline) {
      this.callbacks.onNetworkOffline();
    }
  }

  /**
   * Check network status
   */
  private checkNetworkStatus(): void {
    const wasOnline = this.networkStatus.isOnline;
    const isOnline = navigator.onLine;

    this.networkStatus.lastOnlineCheck = Date.now();

    if (wasOnline !== isOnline) {
      if (isOnline) {
        this.handleNetworkOnline();
      } else {
        this.handleNetworkOffline();
      }
    }
  }

  /**
   * Handle visibility change
   */
  private handleVisibilityChange(isVisible: boolean): void {
    this.logger.debug('Page visibility changed', { isVisible });

    if (isVisible) {
      // Page became visible - check session validity
      this.checkSessionValidity();
    }
  }

  /**
   * Handle storage changes (potential session conflicts)
   */
  private handleStorageChange(event: StorageEvent): void {
    this.logger.debug('Session storage changed in another tab/window');

    if (event.newValue) {
      try {
        const newSessionData = JSON.parse(event.newValue) as StoredSessionData;
        const currentSession = this.sessionManager.getCurrentSession();

        if (currentSession) {
          this.checkForSessionConflicts(newSessionData, currentSession);
        }
      } catch (error) {
        this.logger.error('Failed to parse session data from storage event', error);
      }
    }
  }

  /**
   * Send session heartbeat
   */
  private sendHeartbeat(): void {
    const currentSession = this.sessionManager.getCurrentSession();

    if (currentSession) {
      this.stats.heartbeats++;
      this.stats.lastActivity = Date.now();

      this.logger.debug('Session heartbeat', {
        sessionId: currentSession.session_id,
        heartbeat: this.stats.heartbeats,
      });

      if (this.callbacks.onSessionHeartbeat) {
        this.callbacks.onSessionHeartbeat(currentSession);
      }
    }
  }

  /**
   * Check for session conflicts
   */
  private async checkForSessionConflicts(
    newSession: any,
    currentSession: StoredSessionData
  ): Promise<void> {
    let conflictType: SessionConflictInfo['conflictType'] | null = null;

    // Check for duplicate sessions
    if (newSession.session_id && newSession.session_id !== currentSession.session_id) {
      const timeDiff = Math.abs(newSession.last_refreshed - currentSession.last_refreshed);
      if (timeDiff < this.config.sessionConflictThreshold) {
        conflictType = 'duplicate_session';
      }
    }

    // Check for token mismatch
    if (newSession.access_token && newSession.access_token !== currentSession.access_token) {
      conflictType = 'token_mismatch';
    }

    // Check for user mismatch
    if (newSession.user?.id && newSession.user.id !== currentSession.user.id) {
      conflictType = 'user_mismatch';
    }

    if (conflictType) {
      this.logger.warn('Session conflict detected', {
        conflictType,
        currentSessionId: currentSession.session_id,
        newSessionId: newSession.session_id,
      });

      this.stats.sessionConflicts++;

      const conflictInfo: SessionConflictInfo = {
        currentSession,
        conflictingSession: newSession,
        conflictType,
        timestamp: Date.now(),
        resolution: this.resolveSessionConflict(conflictType, newSession, currentSession),
      };

      if (this.callbacks.onSessionConflict) {
        this.callbacks.onSessionConflict(conflictInfo);
      }

      await this.applyConflictResolution(conflictInfo);
    }
  }

  /**
   * Resolve session conflict
   */
  private resolveSessionConflict(
    conflictType: SessionConflictInfo['conflictType'],
    newSession: any,
    currentSession: StoredSessionData
  ): SessionConflictInfo['resolution'] {
    switch (conflictType) {
      case 'user_mismatch':
        // Different users - logout all sessions
        return 'logout_all';

      case 'duplicate_session':
        // Use the newer session
        return newSession.last_refreshed > currentSession.last_refreshed
          ? 'use_newer'
          : 'keep_current';

      case 'token_mismatch':
        // Use the newer session
        return newSession.last_refreshed > currentSession.last_refreshed
          ? 'use_newer'
          : 'keep_current';

      default:
        return 'keep_current';
    }
  }

  /**
   * Apply conflict resolution
   */
  private async applyConflictResolution(conflictInfo: SessionConflictInfo): Promise<void> {
    switch (conflictInfo.resolution) {
      case 'logout_all':
        this.logger.info('Resolving conflict by logging out all sessions');
        this.sessionManager.clearSession();
        break;

      case 'use_newer':
        this.logger.info('Resolving conflict by using newer session');
        // The SessionManager will automatically pick up the new session from storage
        break;

      case 'keep_current':
        this.logger.info('Resolving conflict by keeping current session');
        // No action needed
        break;
    }
  }

  /**
   * Handle session expiration
   */
  private async handleSessionExpiration(): Promise<boolean> {
    this.logger.info('Handling session expiration');

    try {
      // The SessionManager will handle the refresh automatically
      // We just need to check if it was successful
      const currentSession = this.sessionManager.getCurrentSession();

      if (currentSession && currentSession.expires_at > Date.now()) {
        this.stats.successfulRefreshes++;
        return true;
      } else {
        this.stats.failedRefreshes++;
        return false;
      }
    } catch (error) {
      this.logger.error('Failed to handle session expiration', error);
      this.stats.failedRefreshes++;
      return false;
    }
  }

  /**
   * Get network connection type
   */
  private getConnectionType(): string | null {
    // @ts-ignore - navigator.connection is not in TypeScript definitions
    const connection =
      navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return connection?.effectiveType || null;
  }

  /**
   * Remove all event listeners
   */
  private removeEventListeners(): void {
    if (this.onlineListener) {
      window.removeEventListener('online', this.onlineListener);
    }

    if (this.offlineListener) {
      window.removeEventListener('offline', this.offlineListener);
    }

    if (this.visibilityChangeListener) {
      document.removeEventListener('visibilitychange', this.visibilityChangeListener);
    }

    if (this.storageChangeListener) {
      window.removeEventListener('storage', this.storageChangeListener);
    }
  }
}

/**
 * Session monitor logger
 */
class SessionMonitorLogger {
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
 * Factory function to create SessionMonitor
 */
export function createSessionMonitor(
  sessionManager: SessionManager,
  adapter: SupabaseAdapter,
  config?: Partial<SessionMonitorConfig>,
  callbacks?: SessionMonitorEvents
): SessionMonitor {
  return new SessionMonitor(sessionManager, adapter, config, callbacks);
}

/**
 * Default session monitor instance
 */
let defaultSessionMonitor: SessionMonitor | null = null;

export function getSessionMonitor(
  sessionManager: SessionManager,
  adapter: SupabaseAdapter,
  config?: Partial<SessionMonitorConfig>,
  callbacks?: SessionMonitorEvents
): SessionMonitor {
  if (!defaultSessionMonitor) {
    defaultSessionMonitor = createSessionMonitor(sessionManager, adapter, config, callbacks);
  }
  return defaultSessionMonitor;
}

/**
 * Reset session monitor instance
 */
export function resetSessionMonitor(): void {
  if (defaultSessionMonitor) {
    defaultSessionMonitor.stopMonitoring();
    defaultSessionMonitor = null;
  }
}
