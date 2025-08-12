/**
 * Supabase Authentication Adapter
 *
 * This adapter provides a clean interface for authentication operations
 * using Supabase, with standardized data transformation and error handling.
 */

import { createClient, SupabaseClient, AuthError, User, Session } from '@supabase/supabase-js';
import {
  AuthUser,
  LoginCredentials,
  SignupData,
  AuthResponse,
  AuthSession,
  AuthError as AppAuthError,
  PasswordResetRequest,
  PasswordResetResponse,
  EmailVerificationRequest,
  EmailVerificationResponse,
  SessionValidation,
  TokenRefreshRequest,
  TokenRefreshResponse,
} from '@agentic-workflow/shared';

// Enhanced error handling types and utilities
export interface SupabaseRetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrorCodes: string[];
}

export interface ErrorClassification {
  type: 'network' | 'auth' | 'validation' | 'server' | 'client' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  retryable: boolean;
  userMessage: string;
  developerMessage: string;
}

export interface EnhancedAuthError extends AppAuthError {
  classification: ErrorClassification;
  timestamp: string;
  requestId?: string;
  context?: Record<string, any>;
}

// Session management types and utilities
export interface SessionConfig {
  autoRefresh: boolean;
  refreshThreshold: number; // Time in seconds before expiry to refresh
  maxRefreshAttempts: number;
  sessionTimeout: number; // Session timeout in seconds
  enableMultiTabSync: boolean;
  storageType: 'localStorage' | 'sessionStorage' | 'memory';
}

export interface SessionMetadata {
  createdAt: string;
  lastRefreshedAt: string;
  deviceInfo?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId: string;
}

export interface EnhancedAuthSession extends AuthSession {
  metadata: SessionMetadata;
  isExpired: boolean;
  needsRefresh: boolean;
  timeUntilExpiry: number;
}

export interface SessionStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  clear(): void;
}

export interface SupabaseAdapterConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
  retryConfig?: Partial<SupabaseRetryConfig>;
  enableDetailedErrorLogging?: boolean;
  sessionConfig?: Partial<SessionConfig>;
}

// Default retry configuration
const DEFAULT_RETRY_CONFIG: SupabaseRetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryableErrorCodes: [
    'NETWORK_ERROR',
    'SERVER_ERROR',
    'TIMEOUT',
    'RATE_LIMIT_EXCEEDED',
    'TEMPORARY_UNAVAILABLE',
  ],
};

// Default session configuration
const DEFAULT_SESSION_CONFIG: SessionConfig = {
  autoRefresh: true,
  refreshThreshold: 300, // 5 minutes before expiry
  maxRefreshAttempts: 3,
  sessionTimeout: 3600, // 1 hour
  enableMultiTabSync: true,
  storageType: 'localStorage',
};

export class SupabaseAuthAdapter {
  private client: SupabaseClient;
  private config: SupabaseAdapterConfig;
  private retryConfig: SupabaseRetryConfig;
  private sessionConfig: SessionConfig;
  private sessionStorage: SessionStorage;
  private currentSession: EnhancedAuthSession | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private eventListeners: Array<{ event: string; callback: (...args: any[]) => void }> = [];

  constructor(config: SupabaseAdapterConfig) {
    this.config = config;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config.retryConfig };
    this.sessionConfig = { ...DEFAULT_SESSION_CONFIG, ...config.sessionConfig };
    this.sessionStorage = this.createSessionStorage();

    this.client = createClient(config.url, config.anonKey, {
      auth: {
        autoRefreshToken: this.sessionConfig.autoRefresh,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
      global: {
        headers: {
          'X-Client-Name': 'agentic-workflow-auth-adapter',
          'X-Client-Version': '1.0.0',
        },
      },
    });

    this.setupSessionManagement();
  }

  /**
   * Create session storage based on configuration
   */
  private createSessionStorage(): SessionStorage {
    if (typeof window === 'undefined') {
      // Server-side or Node.js environment - use memory storage
      const memoryStorage = new Map<string, string>();
      return {
        get: (key: string) => memoryStorage.get(key) || null,
        set: (key: string, value: string) => memoryStorage.set(key, value),
        remove: (key: string) => memoryStorage.delete(key),
        clear: () => memoryStorage.clear(),
      };
    }

    // Browser environment
    const storage =
      this.sessionConfig.storageType === 'sessionStorage' ? sessionStorage : localStorage;
    return {
      get: (key: string) => {
        try {
          return storage.getItem(key);
        } catch {
          return null;
        }
      },
      set: (key: string, value: string) => {
        try {
          storage.setItem(key, value);
        } catch {
          // Handle storage quota exceeded or other errors
        }
      },
      remove: (key: string) => {
        try {
          storage.removeItem(key);
        } catch {
          // Handle errors silently
        }
      },
      clear: () => {
        try {
          storage.clear();
        } catch {
          // Handle errors silently
        }
      },
    };
  }

  /**
   * Setup session management functionality
   */
  private setupSessionManagement(): void {
    // Set up multi-tab synchronization if enabled
    if (this.sessionConfig.enableMultiTabSync && typeof window !== 'undefined') {
      window.addEventListener('storage', this.handleStorageChange.bind(this));
    }

    // Set up automatic session refresh
    if (this.sessionConfig.autoRefresh) {
      this.setupAutoRefresh();
    }

    // Listen for authentication state changes
    this.client.auth.onAuthStateChange((event, session) => {
      this.handleAuthStateChange(event, session);
    });
  }

  /**
   * Handle storage changes for multi-tab synchronization
   */
  private handleStorageChange(event: StorageEvent): void {
    if (event.key === 'supabase-auth-session' && event.newValue !== event.oldValue) {
      // Session changed in another tab
      if (event.newValue === null) {
        // Session was cleared in another tab
        this.clearCurrentSession();
        this.emitEvent('session_cleared_external', null);
      } else {
        // Session was updated in another tab
        try {
          const sessionData = JSON.parse(event.newValue);
          this.loadSessionFromStorage(sessionData);
          this.emitEvent('session_updated_external', this.currentSession);
        } catch {
          // Invalid session data
        }
      }
    }
  }

  /**
   * Handle authentication state changes
   */
  private handleAuthStateChange(event: string, session: Session | null): void {
    if (event === 'SIGNED_IN' && session) {
      const enhancedSession = this.createEnhancedSession(session);
      this.setCurrentSession(enhancedSession);
      this.scheduleRefresh(enhancedSession);
    } else if (event === 'SIGNED_OUT') {
      this.clearCurrentSession();
      this.clearRefreshTimer();
    } else if (event === 'TOKEN_REFRESHED' && session) {
      const enhancedSession = this.createEnhancedSession(session);
      this.setCurrentSession(enhancedSession);
      this.scheduleRefresh(enhancedSession);
    }

    this.emitEvent('auth_state_changed', { event, session: this.currentSession });
  }

  /**
   * Create enhanced session with metadata
   */
  private createEnhancedSession(session: Session): EnhancedAuthSession {
    const now = new Date().toISOString();
    const sessionId =
      crypto.randomUUID?.() || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const authSession = this.mapSupabaseSessionToAuthSession(session);
    const expiresAt = session.expires_at
      ? session.expires_at * 1000
      : Date.now() + this.sessionConfig.sessionTimeout * 1000;
    const timeUntilExpiry = Math.max(0, expiresAt - Date.now());
    const needsRefresh = timeUntilExpiry < this.sessionConfig.refreshThreshold * 1000;

    return {
      ...authSession,
      expiresAt,
      metadata: {
        createdAt: now,
        lastRefreshedAt: now,
        sessionId,
        deviceInfo: this.getDeviceInfo(),
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
      },
      isExpired: timeUntilExpiry <= 0,
      needsRefresh,
      timeUntilExpiry,
    };
  }

  /**
   * Get device information for session metadata
   */
  private getDeviceInfo(): string {
    if (typeof window === 'undefined') return 'server';

    const { userAgent } = window.navigator;
    if (userAgent.includes('Mobile')) return 'mobile';
    if (userAgent.includes('Tablet')) return 'tablet';
    return 'desktop';
  }

  /**
   * Set current session and persist to storage
   */
  private setCurrentSession(session: EnhancedAuthSession): void {
    this.currentSession = session;

    // Persist to storage
    const sessionData = {
      session,
      timestamp: Date.now(),
    };
    this.sessionStorage.set('supabase-auth-session', JSON.stringify(sessionData));
  }

  /**
   * Clear current session and storage
   */
  private clearCurrentSession(): void {
    this.currentSession = null;
    this.sessionStorage.remove('supabase-auth-session');
    this.clearRefreshTimer();
  }

  /**
   * Load session from storage
   */
  private loadSessionFromStorage(sessionData?: any): EnhancedAuthSession | null {
    try {
      const data =
        sessionData || JSON.parse(this.sessionStorage.get('supabase-auth-session') || '{}');
      if (data.session && data.timestamp) {
        // Check if session is still valid
        const age = Date.now() - data.timestamp;
        if (age < this.sessionConfig.sessionTimeout * 1000) {
          this.currentSession = data.session;
          return data.session;
        }
      }
    } catch {
      // Invalid session data
    }

    this.clearCurrentSession();
    return null;
  }

  /**
   * Setup automatic session refresh
   */
  private setupAutoRefresh(): void {
    // Check for existing session on startup
    const existingSession = this.loadSessionFromStorage();
    if (existingSession && !existingSession.isExpired) {
      this.scheduleRefresh(existingSession);
    }
  }

  /**
   * Schedule session refresh
   */
  private scheduleRefresh(session: EnhancedAuthSession): void {
    this.clearRefreshTimer();

    if (!this.sessionConfig.autoRefresh) return;

    const refreshTime = Math.max(
      1000,
      session.timeUntilExpiry - this.sessionConfig.refreshThreshold * 1000
    );

    this.refreshTimer = setTimeout(async () => {
      await this.performSessionRefresh();
    }, refreshTime);
  }

  /**
   * Perform session refresh
   */
  private async performSessionRefresh(): Promise<void> {
    if (!this.currentSession?.refreshToken) return;

    let attempts = 0;
    while (attempts < this.sessionConfig.maxRefreshAttempts) {
      try {
        const refreshResult = await this.refreshToken({
          refreshToken: this.currentSession.refreshToken,
        });

        if (refreshResult.success && refreshResult.tokens) {
          // Update current session with new tokens
          this.currentSession.accessToken = refreshResult.tokens.accessToken;
          this.currentSession.refreshToken = refreshResult.tokens.refreshToken;
          this.currentSession.expiresAt = Date.now() + refreshResult.tokens.expiresIn * 1000;
          this.currentSession.metadata.lastRefreshedAt = new Date().toISOString();
          this.currentSession.timeUntilExpiry = this.currentSession.expiresAt - Date.now();
          this.currentSession.needsRefresh = false;
          this.currentSession.isExpired = false;

          this.setCurrentSession(this.currentSession);
          this.scheduleRefresh(this.currentSession);
          this.emitEvent('session_refreshed', this.currentSession);
          return;
        }
      } catch (error) {
        attempts++;
        if (attempts >= this.sessionConfig.maxRefreshAttempts) {
          // Refresh failed - clear session
          this.clearCurrentSession();
          this.emitEvent('session_refresh_failed', error);
          break;
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }
  }

  /**
   * Clear refresh timer
   */
  private clearRefreshTimer(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Emit events to listeners
   */
  private emitEvent(event: string, data: any): void {
    this.eventListeners
      .filter(listener => listener.event === event)
      .forEach(listener => {
        try {
          listener.callback(data);
        } catch (error) {
          console.error(`Error in session event listener for ${event}:`, error);
        }
      });
  }

  /**
   * Add event listener
   */
  addSessionEventListener(event: string, callback: (...args: any[]) => void): () => void {
    const listener = { event, callback };
    this.eventListeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.eventListeners.indexOf(listener);
      if (index > -1) {
        this.eventListeners.splice(index, 1);
      }
    };
  }

  /**
   * Get current enhanced session
   */
  getCurrentEnhancedSession(): EnhancedAuthSession | null {
    if (this.currentSession) {
      // Update dynamic properties
      const now = Date.now();
      this.currentSession.timeUntilExpiry = Math.max(0, this.currentSession.expiresAt - now);
      this.currentSession.isExpired = this.currentSession.timeUntilExpiry <= 0;
      this.currentSession.needsRefresh =
        this.currentSession.timeUntilExpiry < this.sessionConfig.refreshThreshold * 1000;
    }

    return this.currentSession;
  }

  /**
   * Validate current session
   */
  async validateSession(): Promise<{
    isValid: boolean;
    session?: EnhancedAuthSession;
    error?: EnhancedAuthError;
  }> {
    try {
      const currentSession = this.getCurrentEnhancedSession();

      if (!currentSession) {
        return { isValid: false };
      }

      if (currentSession.isExpired) {
        this.clearCurrentSession();
        return {
          isValid: false,
          error: this.createEnhancedError(
            { code: 'SESSION_EXPIRED', message: 'Session has expired' },
            { operation: 'validateSession' }
          ),
        };
      }

      // Validate with server if needed
      const serverValidation = await this.getCurrentSession();
      if (!serverValidation.isValid) {
        this.clearCurrentSession();
        return {
          isValid: false,
          error: serverValidation.error
            ? this.createEnhancedError(serverValidation.error, { operation: 'validateSession' })
            : undefined,
        };
      }

      return {
        isValid: true,
        session: currentSession,
      };
    } catch (error) {
      return {
        isValid: false,
        error: this.createEnhancedError(error, { operation: 'validateSession' }),
      };
    }
  }

  /**
   * Force session cleanup
   */
  async cleanupSession(): Promise<void> {
    this.clearCurrentSession();
    this.clearRefreshTimer();

    // Clear from Supabase
    try {
      await this.client.auth.signOut();
    } catch {
      // Ignore errors during cleanup
    }

    this.emitEvent('session_cleaned_up', null);
  }

  /**
   * Get session statistics
   */
  getSessionStatistics(): {
    hasActiveSession: boolean;
    sessionAge: number;
    timeUntilExpiry: number;
    refreshCount: number;
    deviceInfo?: string;
  } {
    const session = this.getCurrentEnhancedSession();

    if (!session) {
      return {
        hasActiveSession: false,
        sessionAge: 0,
        timeUntilExpiry: 0,
        refreshCount: 0,
      };
    }

    const sessionAge = Date.now() - new Date(session.metadata.createdAt).getTime();

    return {
      hasActiveSession: true,
      sessionAge,
      timeUntilExpiry: session.timeUntilExpiry,
      refreshCount: 0, // This would be tracked in a real implementation
      deviceInfo: session.metadata.deviceInfo,
    };
  }

  /**
   * Enhanced error classification system
   */
  private classifyError(error: any, _context?: Record<string, any>): ErrorClassification {
    // Network-related errors
    if (
      error.name === 'NetworkError' ||
      error.code === 'NETWORK_ERROR' ||
      error.message?.includes('fetch')
    ) {
      return {
        type: 'network',
        severity: 'high',
        retryable: true,
        userMessage:
          'Unable to connect to the server. Please check your internet connection and try again.',
        developerMessage: `Network error: ${error.message}`,
      };
    }

    // Rate limiting
    if (error.status === 429 || error.message?.includes('rate limit')) {
      return {
        type: 'server',
        severity: 'medium',
        retryable: true,
        userMessage: 'Too many requests. Please wait a moment and try again.',
        developerMessage: `Rate limit exceeded: ${error.message}`,
      };
    }

    // Server errors (5xx)
    if (error.status >= 500) {
      return {
        type: 'server',
        severity: 'high',
        retryable: true,
        userMessage: 'Server is temporarily unavailable. Please try again in a few moments.',
        developerMessage: `Server error ${error.status}: ${error.message}`,
      };
    }

    // Authentication errors
    if (error.status === 401 || error.message?.includes('Invalid login credentials')) {
      return {
        type: 'auth',
        severity: 'low',
        retryable: false,
        userMessage: 'Invalid email or password. Please check your credentials and try again.',
        developerMessage: `Authentication failed: ${error.message}`,
      };
    }

    // Validation errors (4xx)
    if (error.status >= 400 && error.status < 500) {
      return {
        type: 'validation',
        severity: 'low',
        retryable: false,
        userMessage: 'Please check your input and try again.',
        developerMessage: `Validation error ${error.status}: ${error.message}`,
      };
    }

    // Default classification
    return {
      type: 'unknown',
      severity: 'medium',
      retryable: false,
      userMessage: 'An unexpected error occurred. Please try again.',
      developerMessage: `Unknown error: ${error.message || 'No error message available'}`,
    };
  }

  /**
   * Create enhanced error with classification
   */
  private createEnhancedError(error: any, context?: Record<string, any>): EnhancedAuthError {
    const classification = this.classifyError(error, context);
    const requestId =
      crypto.randomUUID?.() || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const enhancedError: EnhancedAuthError = {
      code: error.code || classification.type.toUpperCase(),
      message: classification.userMessage,
      details: {
        originalError: error.message,
        status: error.status,
        ...(context || {}),
      },
      classification,
      timestamp: new Date().toISOString(),
      requestId,
      context,
    };

    if (this.config.enableDetailedErrorLogging) {
      console.error('SupabaseAuthAdapter Error:', {
        requestId,
        error: enhancedError,
        originalError: error,
        context,
      });
    }

    return enhancedError;
  }

  /**
   * Retry mechanism with exponential backoff
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const enhancedError = this.createEnhancedError(error, context);

        // Don't retry if error is not retryable
        if (!enhancedError.classification.retryable) {
          throw enhancedError;
        }

        // Don't retry on last attempt
        if (attempt === this.retryConfig.maxAttempts) {
          throw enhancedError;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1),
          this.retryConfig.maxDelay
        );

        if (this.config.enableDetailedErrorLogging) {
          console.warn(
            `SupabaseAuthAdapter: Retry attempt ${attempt}/${this.retryConfig.maxAttempts} after ${delay}ms`,
            {
              error: enhancedError,
              context,
            }
          );
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw this.createEnhancedError(lastError, context);
  }

  /**
   * Check if the error is retryable based on configuration
   */
  // private isRetryableError(_error: EnhancedAuthError): boolean {
  //   return (
  //     this.retryConfig.retryableErrorCodes.includes(_error.code) || _error.classification.retryable
  //   );
  // }

  /**
   * Initialize the adapter and test connection
   */
  async initialize(): Promise<void> {
    try {
      const { error } = await this.client.auth.getSession();
      if (error && error.message !== 'Auth session missing!') {
        throw new Error(`Failed to initialize Supabase adapter: ${error.message}`);
      }
    } catch (error) {
      throw new Error(
        `Failed to initialize Supabase adapter: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * User login with email and password
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    return this.withRetry(
      async () => {
        const { data, error } = await this.client.auth.signInWithPassword({
          email: credentials.email,
          password: credentials.password,
        });

        if (error) {
          throw this.createEnhancedError(error, { operation: 'login', email: credentials.email });
        }

        if (!data.user || !data.session) {
          throw this.createEnhancedError(
            {
              code: 'AUTH_FAILED',
              message: 'Authentication failed - no user or session data returned',
            },
            { operation: 'login', email: credentials.email }
          );
        }

        return {
          success: true,
          user: this.mapSupabaseUserToAuthUser(data.user),
          session: this.mapSupabaseSessionToAuthSession(data.session),
        };
      },
      { operation: 'login', email: credentials.email }
    ).catch(error => ({
      success: false,
      error: this.createEnhancedError(error, { operation: 'login' }),
    }));
  }

  /**
   * User signup with email, password, and profile data
   */
  async signup(signupData: SignupData): Promise<AuthResponse> {
    try {
      const { data, error } = await this.client.auth.signUp({
        email: signupData.email,
        password: signupData.password,
        options: {
          data: {
            name: signupData.name,
            newsletter_opt_in: signupData.newsletterOptIn || false,
          },
        },
      });

      if (error) {
        return {
          success: false,
          error: this.mapSupabaseError(error),
        };
      }

      if (!data.user) {
        return {
          success: false,
          error: {
            code: 'SIGNUP_FAILED',
            message: 'Signup failed - no user data returned',
          },
        };
      }

      const authUser = this.mapSupabaseUserToAuthUser(data.user);
      const authSession = data.session
        ? this.mapSupabaseSessionToAuthSession(data.session)
        : undefined;

      return {
        success: true,
        user: authUser,
        session: authSession,
        message: data.user.email_confirmed_at
          ? 'Account created successfully'
          : 'Account created successfully. Please check your email to verify your account.',
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network error during signup',
        },
      };
    }
  }

  /**
   * User logout
   */
  async logout(): Promise<AuthResponse> {
    try {
      const { error } = await this.client.auth.signOut();

      if (error) {
        return {
          success: false,
          error: this.mapSupabaseError(error),
        };
      }

      return {
        success: true,
        message: 'Logged out successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network error during logout',
        },
      };
    }
  }

  /**
   * Get current session
   */
  async getCurrentSession(): Promise<SessionValidation> {
    try {
      const { data, error } = await this.client.auth.getSession();

      if (error) {
        return {
          isValid: false,
          error: this.mapSupabaseError(error),
        };
      }

      if (!data.session || !data.session.user) {
        return {
          isValid: false,
          error: {
            code: 'NO_SESSION',
            message: 'No active session found',
          },
        };
      }

      return {
        isValid: true,
        user: this.mapSupabaseUserToAuthUser(data.session.user),
        session: this.mapSupabaseSessionToAuthSession(data.session),
      };
    } catch (error) {
      return {
        isValid: false,
        error: {
          code: 'NETWORK_ERROR',
          message:
            error instanceof Error ? error.message : 'Network error during session validation',
        },
      };
    }
  }

  /**
   * Refresh authentication tokens
   */
  async refreshToken(refreshRequest: TokenRefreshRequest): Promise<TokenRefreshResponse> {
    try {
      const { data, error } = await this.client.auth.refreshSession({
        refresh_token: refreshRequest.refreshToken,
      });

      if (error) {
        return {
          success: false,
          error: this.mapSupabaseError(error),
        };
      }

      if (!data.session) {
        return {
          success: false,
          error: {
            code: 'REFRESH_FAILED',
            message: 'Token refresh failed - no session data returned',
          },
        };
      }

      return {
        success: true,
        tokens: {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresIn: data.session.expires_in || 3600,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network error during token refresh',
        },
      };
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(request: PasswordResetRequest): Promise<PasswordResetResponse> {
    try {
      const { error } = await this.client.auth.resetPasswordForEmail(request.email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) {
        return {
          success: false,
          message: 'Failed to send password reset email',
          error: this.mapSupabaseError(error),
        };
      }

      return {
        success: true,
        message: 'Password reset email sent successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Network error occurred',
        error: {
          code: 'NETWORK_ERROR',
          message:
            error instanceof Error ? error.message : 'Network error during password reset request',
        },
      };
    }
  }

  /**
   * Verify email with token
   */
  async verifyEmail(request: EmailVerificationRequest): Promise<EmailVerificationResponse> {
    try {
      const { error } = await this.client.auth.verifyOtp({
        token_hash: request.token,
        type: 'email',
      });

      if (error) {
        return {
          success: false,
          message: 'Email verification failed',
          error: this.mapSupabaseError(error),
        };
      }

      return {
        success: true,
        message: 'Email verified successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Network error occurred',
        error: {
          code: 'NETWORK_ERROR',
          message:
            error instanceof Error ? error.message : 'Network error during email verification',
        },
      };
    }
  }

  /**
   * Update user password
   */
  async updatePassword(newPassword: string): Promise<AuthResponse> {
    try {
      const { data, error } = await this.client.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        return {
          success: false,
          error: this.mapSupabaseError(error),
        };
      }

      if (!data.user) {
        return {
          success: false,
          error: {
            code: 'UPDATE_FAILED',
            message: 'Password update failed - no user data returned',
          },
        };
      }

      return {
        success: true,
        user: this.mapSupabaseUserToAuthUser(data.user),
        message: 'Password updated successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network error during password update',
        },
      };
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(updates: Partial<AuthUser>): Promise<AuthResponse> {
    try {
      const { data, error } = await this.client.auth.updateUser({
        data: {
          name: updates.name,
          avatar: updates.avatar,
          ...updates.metadata,
        },
      });

      if (error) {
        return {
          success: false,
          error: this.mapSupabaseError(error),
        };
      }

      if (!data.user) {
        return {
          success: false,
          error: {
            code: 'UPDATE_FAILED',
            message: 'Profile update failed - no user data returned',
          },
        };
      }

      return {
        success: true,
        user: this.mapSupabaseUserToAuthUser(data.user),
        message: 'Profile updated successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network error during profile update',
        },
      };
    }
  }

  /**
   * Map Supabase User to AuthUser
   */
  private mapSupabaseUserToAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email || '',
      name: user.user_metadata?.name || user.email?.split('@')[0] || '',
      avatar: user.user_metadata?.avatar || undefined,
      emailVerified: !!user.email_confirmed_at,
      createdAt: user.created_at || new Date().toISOString(),
      updatedAt: user.updated_at || new Date().toISOString(),
      lastLoginAt: user.last_sign_in_at || undefined,
      role: user.role || 'user',
      metadata: user.user_metadata || {},
    };
  }

  /**
   * Map Supabase Session to AuthSession
   */
  private mapSupabaseSessionToAuthSession(session: Session): AuthSession {
    return {
      id: `session_${session.user.id}_${Date.now()}`,
      user: this.mapSupabaseUserToAuthUser(session.user),
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at ? session.expires_at * 1000 : Date.now() + 3600000,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
    };
  }

  /**
   * Enhanced Supabase error mapping with classification
   */
  private mapSupabaseError(error: AuthError): EnhancedAuthError {
    const errorMap: Record<
      string,
      { code: string; message: string; classification: Partial<ErrorClassification> }
    > = {
      'Invalid login credentials': {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
        classification: { type: 'auth', severity: 'low', retryable: false },
      },
      'User already registered': {
        code: 'USER_EXISTS',
        message: 'An account with this email already exists',
        classification: { type: 'validation', severity: 'low', retryable: false },
      },
      'Email not confirmed': {
        code: 'EMAIL_NOT_CONFIRMED',
        message: 'Please verify your email before signing in',
        classification: { type: 'auth', severity: 'medium', retryable: false },
      },
      'Invalid email': {
        code: 'INVALID_EMAIL',
        message: 'Please enter a valid email address',
        classification: { type: 'validation', severity: 'low', retryable: false },
      },
      'Password should be at least 6 characters': {
        code: 'WEAK_PASSWORD',
        message: 'Password must be at least 6 characters long',
        classification: { type: 'validation', severity: 'low', retryable: false },
      },
      'Auth session missing!': {
        code: 'NO_SESSION',
        message: 'No active session found',
        classification: { type: 'auth', severity: 'medium', retryable: false },
      },
      'JWT expired': {
        code: 'TOKEN_EXPIRED',
        message: 'Your session has expired. Please sign in again.',
        classification: { type: 'auth', severity: 'medium', retryable: false },
      },
      'Invalid token': {
        code: 'INVALID_TOKEN',
        message: 'Invalid authentication token',
        classification: { type: 'auth', severity: 'medium', retryable: false },
      },
      'Too many requests': {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please wait a moment and try again.',
        classification: { type: 'server', severity: 'medium', retryable: true },
      },
      'Network request failed': {
        code: 'NETWORK_ERROR',
        message: 'Unable to connect to the server. Please check your connection.',
        classification: { type: 'network', severity: 'high', retryable: true },
      },
    };

    const mapped = errorMap[error.message];
    const classification: ErrorClassification = {
      type: mapped?.classification.type || 'unknown',
      severity: mapped?.classification.severity || 'medium',
      retryable: mapped?.classification.retryable || false,
      userMessage: mapped?.message || error.message || 'An unknown error occurred',
      developerMessage: `Supabase error: ${error.message}`,
    };

    const enhancedError: EnhancedAuthError = {
      code: mapped?.code || 'UNKNOWN_ERROR',
      message: classification.userMessage,
      details: {
        originalError: error.message,
        supabaseError: error,
        status: error.status,
      },
      classification,
      timestamp: new Date().toISOString(),
      requestId:
        crypto.randomUUID?.() || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    return enhancedError;
  }

  /**
   * Get error statistics for monitoring
   */
  getErrorStatistics(): {
    errorCounts: Record<string, number>;
    severityCounts: Record<string, number>;
    typeCounts: Record<string, number>;
  } {
    // This would be implemented with actual error tracking in a real application
    return {
      errorCounts: {},
      severityCounts: {},
      typeCounts: {},
    };
  }

  /**
   * Check connection health
   */
  async checkHealth(): Promise<{
    healthy: boolean;
    latency: number;
    error?: EnhancedAuthError;
  }> {
    const startTime = Date.now();

    try {
      await this.withRetry(
        async () => {
          const { error } = await this.client.auth.getSession();
          if (error && error.message !== 'Auth session missing!') {
            throw error;
          }
        },
        { operation: 'healthCheck' }
      );

      return {
        healthy: true,
        latency: Date.now() - startTime,
      };
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - startTime,
        error: this.createEnhancedError(error, { operation: 'healthCheck' }),
      };
    }
  }

  /**
   * Listen for authentication state changes
   */
  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    return this.client.auth.onAuthStateChange(callback);
  }

  /**
   * Get the underlying Supabase client for advanced operations
   */
  getClient(): SupabaseClient {
    return this.client;
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    // Clear refresh timer
    this.clearRefreshTimer();

    // Clear session
    this.clearCurrentSession();

    // Remove storage event listener
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.handleStorageChange.bind(this));
    }

    // Clear event listeners
    this.eventListeners = [];

    // Sign out from Supabase
    try {
      await this.client.auth.signOut();
    } catch {
      // Ignore errors during cleanup
    }
  }
}

/**
 * Error reporting utility for external monitoring systems
 */
export class AuthErrorReporter {
  private static instance: AuthErrorReporter;
  private errorQueue: EnhancedAuthError[] = [];
  private maxQueueSize = 100;

  static getInstance(): AuthErrorReporter {
    if (!this.instance) {
      this.instance = new AuthErrorReporter();
    }
    return this.instance;
  }

  reportError(error: EnhancedAuthError): void {
    this.errorQueue.push(error);

    // Keep queue size manageable
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue.shift();
    }

    // In a real application, this would send to monitoring services
    if (error.classification.severity === 'critical' || error.classification.severity === 'high') {
      console.error('Critical Auth Error:', error);
    }
  }

  getRecentErrors(count = 10): EnhancedAuthError[] {
    return this.errorQueue.slice(-count);
  }

  clearErrors(): void {
    this.errorQueue = [];
  }

  getErrorsByType(type: ErrorClassification['type']): EnhancedAuthError[] {
    return this.errorQueue.filter(error => error.classification.type === type);
  }
}

/**
 * Circuit breaker pattern for handling repeated failures
 */
export class AuthCircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private maxFailures = 5,
    private resetTimeout = 60000 // 1 minute
    // private checkInterval = 30000 // 30 seconds - reserved for future use
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open - service unavailable');
      }
    }

    try {
      const result = await operation();

      if (this.state === 'half-open') {
        this.reset();
      }

      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.maxFailures) {
      this.state = 'open';
    }
  }

  private reset(): void {
    this.failures = 0;
    this.state = 'closed';
    this.lastFailureTime = 0;
  }

  getState(): { state: string; failures: number; lastFailureTime: number } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

// Factory function for creating adapter instances
export function createSupabaseAuthAdapter(config: SupabaseAdapterConfig): SupabaseAuthAdapter {
  return new SupabaseAuthAdapter(config);
}

// Factory function with enhanced error handling
export function createEnhancedSupabaseAuthAdapter(
  config: SupabaseAdapterConfig,
  options?: {
    useCircuitBreaker?: boolean;
    enableErrorReporting?: boolean;
  }
): SupabaseAuthAdapter {
  const enhancedConfig = {
    ...config,
    enableDetailedErrorLogging: options?.enableErrorReporting ?? true,
  };

  const adapter = new SupabaseAuthAdapter(enhancedConfig);

  // Add circuit breaker if requested
  if (options?.useCircuitBreaker) {
    const circuitBreaker = new AuthCircuitBreaker();

    // Wrap critical methods with circuit breaker
    const originalLogin = adapter.login.bind(adapter);
    adapter.login = async credentials => {
      return circuitBreaker.execute(() => originalLogin(credentials));
    };
  }

  return adapter;
}

// Default export
export default SupabaseAuthAdapter;
