/**
 * Session Management System for Supabase Authentication Integration
 *
 * This module provides comprehensive session management capabilities including
 * persistence logic, automatic token refresh, session restoration from local storage,
 * and session cleanup and expiration handling.
 */

import { Session } from '@supabase/supabase-js';
import { SupabaseAdapter } from './supabase';
import { ProfileResponse } from '../types/auth';
import {
  mapSupabaseUserToProfile,
  mapSupabaseErrorToApiError,
  mapGenericErrorToApiError,
  ExtendedApiError,
} from './transformers';
import { PerformanceCache, getPerformanceCache } from './performance-cache';

/**
 * Interface for session data stored locally
 */
export interface StoredSessionData {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: ProfileResponse;
  last_refreshed: number;
  session_id: string;
}

/**
 * Configuration for session management
 */
export interface SessionManagerConfig {
  refreshThreshold: number; // Seconds before expiration to refresh
  maxRetryAttempts: number;
  retryDelayMs: number;
  backoffMultiplier: number;
  maxRetryDelayMs: number;
  storageKey: string;
  enablePersistence: boolean;
}

/**
 * Interface for session monitoring callbacks
 */
export interface SessionEventCallbacks {
  onSessionRestored?: (session: StoredSessionData) => void;
  onSessionRefreshed?: (session: StoredSessionData) => void;
  onSessionExpired?: () => void;
  onSessionCleared?: () => void;
  onRefreshError?: (error: ExtendedApiError) => void;
}

/**
 * Result interface for session operations
 */
export interface SessionOperationResult {
  success: boolean;
  session?: StoredSessionData;
  error?: ExtendedApiError;
  requiresLogin?: boolean;
}

/**
 * SessionManager class handles all session-related operations
 */
export class SessionManager {
  private adapter: SupabaseAdapter;
  private config: SessionManagerConfig;
  private callbacks: SessionEventCallbacks;
  private refreshTimer: NodeJS.Timeout | null = null;
  private currentSession: StoredSessionData | null = null;
  private isRefreshing = false;
  private logger: SessionLogger;
  private performanceCache: PerformanceCache;

  constructor(
    adapter: SupabaseAdapter,
    config?: Partial<SessionManagerConfig>,
    callbacks?: SessionEventCallbacks
  ) {
    this.adapter = adapter;
    this.callbacks = callbacks || {};
    this.logger = new SessionLogger('SessionManager');
    this.performanceCache = getPerformanceCache();

    // Set default configuration
    this.config = {
      refreshThreshold: 300, // 5 minutes
      maxRetryAttempts: 3,
      retryDelayMs: 1000,
      backoffMultiplier: 2,
      maxRetryDelayMs: 30000,
      storageKey: 'agentic_workflow_session',
      enablePersistence: true,
      ...config,
    };

    this.logger.info('SessionManager initialized', {
      refreshThreshold: this.config.refreshThreshold,
      enablePersistence: this.config.enablePersistence,
    });
  }

  /**
   * Start monitoring session and automatic refresh
   */
  startSessionMonitoring(): void {
    this.logger.debug('Starting session monitoring');

    try {
      // Attempt to restore existing session on startup
      this.restoreSession();
    } catch (error) {
      this.logger.error('Failed to restore session on startup', error);
    }
  }

  /**
   * Stop session monitoring and cleanup
   */
  stopSessionMonitoring(): void {
    this.logger.debug('Stopping session monitoring');

    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    this.isRefreshing = false;
  }

  /**
   * Persist session data after successful authentication
   */
  async persistSession(session: Session): Promise<SessionOperationResult> {
    this.logger.debug('Persisting session data');

    try {
      if (!session.user || !session.access_token || !session.refresh_token) {
        throw new SessionManagerError(
          'Invalid session data - missing required fields',
          'INVALID_SESSION_DATA'
        );
      }

      const sessionData: StoredSessionData = {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: this.calculateExpirationTime(session.expires_in),
        user: mapSupabaseUserToProfile(session.user),
        last_refreshed: Date.now(),
        session_id: this.generateSessionId(),
      };

      // Store in memory
      this.currentSession = sessionData;

      // Store in local storage if enabled
      if (this.config.enablePersistence) {
        this.storeSessionLocally(sessionData);
      }

      // Schedule automatic refresh
      this.scheduleTokenRefresh();

      this.logger.info('Session persisted successfully', {
        userId: sessionData.user.id,
        expiresAt: new Date(sessionData.expires_at).toISOString(),
        sessionId: sessionData.session_id,
      });

      return { success: true, session: sessionData };
    } catch (error) {
      this.logger.error('Failed to persist session', error);

      const apiError =
        error instanceof SessionManagerError
          ? this.mapSessionErrorToApiError(error)
          : mapGenericErrorToApiError(
              error instanceof Error ? error : new Error(String(error)),
              'persistSession'
            );

      return { success: false, error: apiError };
    }
  }

  /**
   * Restore session from local storage
   */
  restoreSession(): SessionOperationResult {
    this.logger.debug('Attempting to restore session from storage');

    try {
      if (!this.config.enablePersistence) {
        this.logger.debug('Session persistence disabled, skipping restoration');
        return { success: false, requiresLogin: true };
      }

      const storedData = this.getStoredSession();
      if (!storedData) {
        this.logger.debug('No stored session found');
        return { success: false, requiresLogin: true };
      }

      // Validate session data integrity
      if (!this.validateStoredSession(storedData)) {
        this.logger.warn('Stored session data is invalid, clearing');
        this.clearSession();
        return { success: false, requiresLogin: true };
      }

      // Check if session is expired
      const now = Date.now();
      if (storedData.expires_at <= now) {
        this.logger.info('Stored session has expired', {
          expiredAt: new Date(storedData.expires_at).toISOString(),
          now: new Date(now).toISOString(),
        });

        this.clearSession();
        return { success: false, requiresLogin: true };
      }

      // Check if session needs refresh
      const timeUntilExpiry = storedData.expires_at - now;
      const refreshThresholdMs = this.config.refreshThreshold * 1000;

      if (timeUntilExpiry <= refreshThresholdMs) {
        this.logger.info('Session needs refresh, attempting automatic refresh');
        // Don't block restoration on refresh attempt
        this.attemptTokenRefresh();
      }

      // Restore session to memory
      this.currentSession = storedData;
      this.scheduleTokenRefresh();

      this.logger.info('Session restored successfully', {
        userId: storedData.user.id,
        expiresAt: new Date(storedData.expires_at).toISOString(),
        sessionId: storedData.session_id,
      });

      // Notify callback
      if (this.callbacks.onSessionRestored) {
        this.callbacks.onSessionRestored(storedData);
      }

      return { success: true, session: storedData };
    } catch (error) {
      this.logger.error('Failed to restore session', error);
      this.clearSession();

      const apiError = mapGenericErrorToApiError(
        error instanceof Error ? error : new Error(String(error)),
        'restoreSession'
      );

      return { success: false, error: apiError, requiresLogin: true };
    }
  }

  /**
   * Clear session data and cleanup
   */
  clearSession(): void {
    this.logger.debug('Clearing session data');

    try {
      // Clear memory
      this.currentSession = null;

      // Clear timers
      if (this.refreshTimer) {
        clearTimeout(this.refreshTimer);
        this.refreshTimer = null;
      }

      // Clear local storage
      if (this.config.enablePersistence && typeof localStorage !== 'undefined') {
        localStorage.removeItem(this.config.storageKey);
      }

      this.isRefreshing = false;

      this.logger.info('Session cleared successfully');

      // Notify callback
      if (this.callbacks.onSessionCleared) {
        this.callbacks.onSessionCleared();
      }
    } catch (error) {
      this.logger.error('Error while clearing session', error);
    }
  }

  /**
   * Get current active session
   */
  getCurrentSession(): StoredSessionData | null {
    return this.currentSession;
  }

  /**
   * Check if there's an active valid session
   */
  hasValidSession(): boolean {
    if (!this.currentSession) {
      return false;
    }

    const now = Date.now();
    return this.currentSession.expires_at > now;
  }

  /**
   * Get access token from current session
   */
  getAccessToken(): string | null {
    return this.currentSession?.access_token || null;
  }

  /**
   * Schedule automatic token refresh
   */
  private scheduleTokenRefresh(): void {
    if (!this.currentSession) {
      return;
    }

    // Clear existing timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    const now = Date.now();
    const timeUntilExpiry = this.currentSession.expires_at - now;
    const refreshThresholdMs = this.config.refreshThreshold * 1000;
    const timeUntilRefresh = Math.max(0, timeUntilExpiry - refreshThresholdMs);

    this.logger.debug('Scheduling token refresh', {
      timeUntilRefresh: timeUntilRefresh / 1000,
      expiresAt: new Date(this.currentSession.expires_at).toISOString(),
    });

    this.refreshTimer = setTimeout(() => {
      this.attemptTokenRefresh();
    }, timeUntilRefresh);
  }

  /**
   * Attempt automatic token refresh with retry logic
   */
  private async attemptTokenRefresh(): Promise<void> {
    if (this.isRefreshing || !this.currentSession) {
      return;
    }

    this.isRefreshing = true;
    this.logger.debug('Attempting automatic token refresh');

    try {
      const refreshResult = await this.executeWithRetry(() => this.performTokenRefresh(), {
        maxAttempts: this.config.maxRetryAttempts,
        baseDelay: this.config.retryDelayMs,
        maxDelay: this.config.maxRetryDelayMs,
        backoffMultiplier: this.config.backoffMultiplier,
      });

      if (refreshResult.success && refreshResult.session) {
        this.logger.info('Token refresh successful');

        // Notify callback
        if (this.callbacks.onSessionRefreshed) {
          this.callbacks.onSessionRefreshed(refreshResult.session);
        }
      } else {
        throw new Error('Token refresh failed');
      }
    } catch (error) {
      this.logger.error('Token refresh failed after retries', error);

      const apiError = this.isExtendedApiError(error)
        ? error
        : mapGenericErrorToApiError(
            error instanceof Error ? error : new Error(String(error)),
            'attemptTokenRefresh'
          );

      // Notify callback
      if (this.callbacks.onRefreshError) {
        this.callbacks.onRefreshError(apiError);
      }

      // Clear expired session
      this.handleSessionExpiration();
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Perform the actual token refresh operation
   */
  private async performTokenRefresh(): Promise<SessionOperationResult> {
    if (!this.currentSession) {
      throw new SessionManagerError('No active session to refresh', 'NO_ACTIVE_SESSION');
    }

    // Use request deduplication for token refresh
    const requestKey = PerformanceCache.generateSessionRefreshKey(
      this.currentSession.refresh_token
    );

    return this.performanceCache.deduplicateRequest(requestKey, async () => {
      return this.performanceCache.optimizedExecute(async () => {
        try {
          // Use Supabase adapter to refresh session
          const client = this.adapter.getClient();
          const { data, error } = await client.auth.refreshSession({
            refresh_token: this.currentSession!.refresh_token,
          });

          if (error) {
            throw mapSupabaseErrorToApiError(error);
          }

          if (!data.session) {
            throw new SessionManagerError(
              'Refresh succeeded but no session returned',
              'NO_SESSION_RETURNED'
            );
          }

          // Update stored session with new tokens
          const updatedSession: StoredSessionData = {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_at: this.calculateExpirationTime(data.session.expires_in),
            last_refreshed: Date.now(),
            user: this.currentSession?.user || mapSupabaseUserToProfile(data.session.user) || ({} as ProfileResponse),
            session_id:
              this.currentSession?.session_id ||
              `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          };

          // Update memory and storage
          this.currentSession = updatedSession;

          if (this.config.enablePersistence) {
            this.storeSessionLocally(updatedSession);
          }

          // Schedule next refresh
          this.scheduleTokenRefresh();

          return { success: true, session: updatedSession };
        } catch (error) {
          this.logger.error('Token refresh operation failed', error);

          const apiError = this.isExtendedApiError(error)
            ? error
            : mapGenericErrorToApiError(
                error instanceof Error ? error : new Error(String(error)),
                'performTokenRefresh'
              );

          return { success: false, error: apiError };
        }
      }, 'session');
    });
  }

  /**
   * Execute operation with exponential backoff retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: {
      maxAttempts: number;
      baseDelay: number;
      maxDelay: number;
      backoffMultiplier: number;
    }
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === config.maxAttempts) {
          throw lastError;
        }

        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
          config.maxDelay
        );

        this.logger.debug(`Retry attempt ${attempt} failed, waiting ${delay}ms`, {
          error: lastError.message,
          attempt,
          maxAttempts: config.maxAttempts,
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  /**
   * Handle session expiration
   */
  private handleSessionExpiration(): void {
    this.logger.info('Handling session expiration');

    this.clearSession();

    // Notify callback
    if (this.callbacks.onSessionExpired) {
      this.callbacks.onSessionExpired();
    }
  }

  /**
   * Store session data in local storage with optimization
   */
  private storeSessionLocally(sessionData: StoredSessionData): void {
    try {
      if (typeof localStorage === 'undefined') {
        this.logger.warn('localStorage is not available, session will not persist');
        return;
      }

      // Use optimized storage format to reduce storage size
      const optimizedData = this.performanceCache.optimizeSessionData(sessionData);
      localStorage.setItem(this.config.storageKey, optimizedData);

      this.logger.debug('Session stored in localStorage (optimized)', {
        sessionId: sessionData.session_id,
        originalSize: JSON.stringify(sessionData).length,
        optimizedSize: optimizedData.length,
      });
    } catch (error) {
      this.logger.error('Failed to store session in localStorage', error);
    }
  }

  /**
   * Get session data from local storage with optimization support
   */
  private getStoredSession(): StoredSessionData | null {
    try {
      if (typeof localStorage === 'undefined') {
        return null;
      }

      const serializedData = localStorage.getItem(this.config.storageKey);
      if (!serializedData) {
        return null;
      }

      // Try to restore from optimized format, fallback to regular format
      return this.performanceCache.restoreSessionData(serializedData);
    } catch (error) {
      this.logger.error('Failed to parse stored session data', error);
      return null;
    }
  }

  /**
   * Validate stored session data integrity
   */
  private validateStoredSession(sessionData: any): sessionData is StoredSessionData {
    return (
      sessionData &&
      typeof sessionData === 'object' &&
      typeof sessionData.access_token === 'string' &&
      typeof sessionData.refresh_token === 'string' &&
      typeof sessionData.expires_at === 'number' &&
      typeof sessionData.last_refreshed === 'number' &&
      typeof sessionData.session_id === 'string' &&
      sessionData.user &&
      typeof sessionData.user.id === 'string' &&
      typeof sessionData.user.email === 'string'
    );
  }

  /**
   * Calculate expiration timestamp from expires_in seconds
   */
  private calculateExpirationTime(expiresIn: number = 3600): number {
    return Date.now() + expiresIn * 1000;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if error is an ExtendedApiError
   */
  private isExtendedApiError(error: unknown): error is ExtendedApiError {
    return (
      error !== null &&
      typeof error === 'object' &&
      'message' in error &&
      'status' in error &&
      'code' in error
    );
  }

  /**
   * Map SessionManagerError to ExtendedApiError
   */
  private mapSessionErrorToApiError(error: SessionManagerError): ExtendedApiError {
    const errorMap: Record<string, { message: string; status: number }> = {
      INVALID_SESSION_DATA: {
        message: 'Invalid session data provided',
        status: 400,
      },
      NO_ACTIVE_SESSION: {
        message: 'No active session found',
        status: 401,
      },
      NO_SESSION_RETURNED: {
        message: 'Session refresh failed - no session returned',
        status: 500,
      },
    };

    const mapped = errorMap[error.code] || {
      message: error.message || 'Session management error',
      status: 500,
    };

    return {
      message: mapped.message,
      status: mapped.status,
      code: error.code,
      details: {
        context: 'SessionManager',
        originalError: error.message,
      },
    };
  }
}

/**
 * Session manager specific error class
 */
export class SessionManagerError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'SessionManagerError';
  }
}

/**
 * Session logger for consistent logging
 */
class SessionLogger {
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
 * Factory function to create SessionManager instance
 */
export function createSessionManager(
  adapter: SupabaseAdapter,
  config?: Partial<SessionManagerConfig>,
  callbacks?: SessionEventCallbacks
): SessionManager {
  return new SessionManager(adapter, config, callbacks);
}

/**
 * Default session manager instance (singleton pattern)
 */
let defaultSessionManager: SessionManager | null = null;

export function getSessionManager(
  adapter: SupabaseAdapter,
  config?: Partial<SessionManagerConfig>,
  callbacks?: SessionEventCallbacks
): SessionManager {
  if (!defaultSessionManager) {
    defaultSessionManager = createSessionManager(adapter, config, callbacks);
  }
  return defaultSessionManager;
}

/**
 * Reset session manager instance (useful for testing)
 */
export function resetSessionManager(): void {
  if (defaultSessionManager) {
    defaultSessionManager.stopSessionMonitoring();
    defaultSessionManager = null;
  }
}
