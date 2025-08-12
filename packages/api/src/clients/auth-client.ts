/**
 * Authentication Client
 *
 * Provides a high-level interface for authentication operations,
 * integrating with the existing Supabase adapter and API client patterns.
 */

import {
  AuthUser,
  LoginCredentials,
  SignupData,
  AuthResponse,
  AuthSession,
  AuthError,
  PasswordResetRequest,
  PasswordResetResponse,
} from '@agentic-workflow/shared';
import { ApiClient, TokenRefreshHandler } from '../client/base';
import { AgenticWorkflowApiClient } from '../client';
import { SupabaseAuthAdapter } from '../adapters/supabase-adapter';
// import { getSupabaseClient } from './supabase';
import {
  EnhancedTokenStorage,
  createEnhancedTokenStorage,
} from '../adapters/enhanced-token-storage';
import {
  AuthValidationService,
  DEFAULT_AUTH_VALIDATION_CONFIG,
} from '../adapters/auth-validation-service';
import {
  AuthCache,
  AuthRequestDeduplicator,
  createAuthCache,
  createAuthRequestDeduplicator,
  DEFAULT_AUTH_CACHE_CONFIG,
} from '../adapters/auth-cache';
import {
  AuthMetrics,
  createAuthMetrics,
  DEFAULT_AUTH_METRICS_CONFIG,
} from '../adapters/auth-metrics';
import {
  AuthSecurityMonitor,
  createAuthSecurityMonitor,
  DEFAULT_SECURITY_MONITOR_CONFIG,
} from '../adapters/auth-security-monitor';

export interface AuthClientConfig {
  supabaseUrl: string;
  supabaseKey: string;
  apiClient: ApiClient;
  enableDetailedLogging?: boolean;
  enableCaching?: boolean;
  cacheConfig?: Partial<typeof DEFAULT_AUTH_CACHE_CONFIG>;
  enableMetrics?: boolean;
  metricsConfig?: Partial<typeof DEFAULT_AUTH_METRICS_CONFIG>;
  enableSecurityMonitoring?: boolean;
  securityConfig?: Partial<typeof DEFAULT_SECURITY_MONITOR_CONFIG>;
}

export class AuthClient implements TokenRefreshHandler {
  private supabaseAdapter: SupabaseAuthAdapter;
  private apiClient: ApiClient;
  private currentUser: AuthUser | null = null;
  private currentSession: AuthSession | null = null;
  private config: AuthClientConfig;
  private tokenStorage: EnhancedTokenStorage;
  private validationService: AuthValidationService;
  private cache: AuthCache | null = null;
  private deduplicator: AuthRequestDeduplicator | null = null;
  private metrics: AuthMetrics | null = null;
  private securityMonitor: AuthSecurityMonitor | null = null;

  constructor(config: AuthClientConfig) {
    this.config = config;
    this.apiClient = config.apiClient;

    // Initialize Supabase adapter
    this.supabaseAdapter = new SupabaseAuthAdapter({
      url: config.supabaseUrl,
      anonKey: config.supabaseKey,
      enableDetailedErrorLogging: config.enableDetailedLogging ?? true,
      sessionConfig: {
        autoRefresh: true,
        refreshThreshold: 300, // 5 minutes
        enableMultiTabSync: true,
        storageType: 'localStorage',
      },
    });

    // Initialize enhanced token storage
    this.tokenStorage = createEnhancedTokenStorage({
      cookies: {
        enabled: true,
        httpOnly: process.env.NODE_ENV === 'production',
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        path: '/',
        maxAge: 3600, // 1 hour
      },
      fallback: {
        useSessionStorage: true,
        useLocalStorage: false,
        developmentOnly: process.env.NODE_ENV === 'development',
      },
      security: {
        csrfProtection: true,
        encryptCookies: true,
        rotateOnExpiry: true,
      },
    });

    // Initialize validation service
    this.validationService = new AuthValidationService({
      ...DEFAULT_AUTH_VALIDATION_CONFIG,
      security: {
        ...DEFAULT_AUTH_VALIDATION_CONFIG.security,
        requireHTTPS: process.env.NODE_ENV === 'production',
        allowedOrigins:
          process.env.NODE_ENV === 'development'
            ? ['http://localhost:3000', 'http://localhost:8000']
            : ['https://app.example.com'], // Update with actual production origins
      },
    });

    // Initialize caching if enabled
    if (config.enableCaching !== false) {
      this.cache = createAuthCache(config.cacheConfig);
      this.deduplicator = createAuthRequestDeduplicator(this.cache);
    }

    // Initialize metrics tracking if enabled
    if (config.enableMetrics !== false) {
      this.metrics = createAuthMetrics(config.metricsConfig);
    }

    // Initialize security monitoring if enabled
    if (config.enableSecurityMonitoring !== false) {
      this.securityMonitor = createAuthSecurityMonitor(config.securityConfig);
    }

    // Set up session event listeners
    this.setupSessionEventListeners();

    // Set this AuthClient as the token refresh handler for the API client
    this.apiClient.setTokenRefreshHandler(this);
  }

  /**
   * Initialize the auth client and restore any existing session
   */
  async initialize(): Promise<void> {
    await this.supabaseAdapter.initialize();
    await this.restoreSession();
  }

  /**
   * Set up event listeners for session changes
   */
  private setupSessionEventListeners(): void {
    // Listen for auth state changes from Supabase adapter
    this.supabaseAdapter.addSessionEventListener('session_restored', (session: any) => {
      this.handleSessionUpdate(session);
    });

    this.supabaseAdapter.addSessionEventListener('session_refreshed', (session: any) => {
      this.handleSessionUpdate(session);
    });

    this.supabaseAdapter.addSessionEventListener('session_cleared', () => {
      this.handleSessionCleared();
    });

    this.supabaseAdapter.addSessionEventListener('session_expired', () => {
      this.handleSessionCleared();
    });
  }

  /**
   * Handle session updates
   */
  private async handleSessionUpdate(session: any, rememberMe?: boolean): Promise<void> {
    if (session && session.user) {
      this.currentUser = session.user;
      this.currentSession = session;

      // Cache user profile and session data
      if (this.cache && session.user) {
        this.cache.cacheUserProfile(session.user.id, session.user);
        if (session.id) {
          this.cache.cacheSession(session.id, session);
        }
      }

      // Update API client with new token
      if (session.accessToken) {
        this.apiClient.setAuthToken(session.accessToken);

        // Store tokens securely with extended duration for remember me
        if (session.accessToken && session.refreshToken) {
          let expiresIn = session.expiresAt
            ? Math.floor((session.expiresAt - Date.now()) / 1000)
            : 3600;

          // Extend session duration for remember me
          if (rememberMe) {
            // Set longer expiration for remember me (30 days)
            const rememberMeDuration = 30 * 24 * 60 * 60; // 30 days in seconds
            expiresIn = Math.max(expiresIn, rememberMeDuration);

            // Update the session object to reflect extended duration
            if (session.expiresAt) {
              session.expiresAt = Date.now() + rememberMeDuration * 1000;
              this.currentSession = session;
            }
          }

          await this.tokenStorage.storeAuthTokensWithRememberMe(
            session.accessToken,
            session.refreshToken,
            expiresIn,
            rememberMe || false
          );
        }
      }
    }
  }

  /**
   * Handle session cleared
   */
  private async handleSessionCleared(): Promise<void> {
    const userId = this.currentUser?.id;

    this.currentUser = null;
    this.currentSession = null;
    this.apiClient.setAuthToken(null);

    // Clear stored tokens
    await this.tokenStorage.clearAuthTokens();

    // Clear cached data for this user
    if (this.cache && userId) {
      this.cache.invalidateUser(userId);
      this.cache.invalidateSession();
    }
  }

  /**
   * Attempt to restore existing session
   */
  private async restoreSession(): Promise<boolean> {
    try {
      // First try to restore from secure token storage
      const accessToken = await this.tokenStorage.getAccessToken();
      if (accessToken) {
        // Check if token is still valid
        const isExpired = await this.tokenStorage.isAccessTokenExpired();
        if (!isExpired) {
          this.apiClient.setAuthToken(accessToken);

          // Try to validate with Supabase
          const validation = await this.supabaseAdapter.validateSession();
          if (validation.isValid && validation.session) {
            await this.handleSessionUpdate(validation.session);
            return true;
          }
        }
      }

      // Fallback to Supabase session validation
      const validation = await this.supabaseAdapter.validateSession();
      if (validation.isValid && validation.session) {
        await this.handleSessionUpdate(validation.session);
        return true;
      }

      return false;
    } catch (error) {
      if (this.config.enableDetailedLogging) {
        console.warn('Failed to restore session:', error);
      }
      return false;
    }
  }

  /**
   * Login with email and password
   */
  async login(
    credentials: LoginCredentials,
    clientInfo?: { ip?: string; userAgent?: string; origin?: string }
  ): Promise<AuthResponse> {
    // Check if IP is blocked
    if (clientInfo?.ip && this.securityMonitor?.isIPBlocked(clientInfo.ip)) {
      this.securityMonitor?.trackSuspiciousActivity('blocked_ip_attempt', clientInfo.ip, {
        email: credentials.email,
        userAgent: clientInfo.userAgent,
      });

      return {
        success: false,
        error: {
          code: 'IP_BLOCKED',
          message: 'Access denied from this IP address',
        },
      };
    }

    // Start metrics tracking
    const startTime = this.metrics?.trackLoginAttempt(credentials.email, clientInfo) || Date.now();

    try {
      // Input validation and sanitization
      const validationResult = this.validationService.validateLoginData({
        email: credentials.email,
        password: credentials.password,
      });

      if (!validationResult.isValid) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validationResult.errors.join(', '),
          },
        };
      }

      // Rate limiting check
      const rateLimitResult = this.validationService.checkRateLimit(
        clientInfo?.ip || 'unknown',
        credentials.email
      );

      if (!rateLimitResult.allowed) {
        return {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: rateLimitResult.blocked
              ? `Too many failed attempts. Try again after ${new Date(rateLimitResult.resetTime).toLocaleTimeString()}`
              : `Too many attempts. ${rateLimitResult.remainingAttempts} attempts remaining.`,
          },
        };
      }

      // Security checks
      if (clientInfo?.origin && !this.validationService.validateOrigin(clientInfo.origin)) {
        return {
          success: false,
          error: {
            code: 'INVALID_ORIGIN',
            message: 'Request from unauthorized origin',
          },
        };
      }

      if (
        clientInfo?.userAgent &&
        !this.validationService.validateUserAgent(clientInfo.userAgent)
      ) {
        return {
          success: false,
          error: {
            code: 'INVALID_USER_AGENT',
            message: 'Invalid user agent',
          },
        };
      }

      // Use sanitized data for authentication
      const sanitizedCredentials = {
        email: validationResult.sanitizedData?.email || credentials.email,
        password: credentials.password, // Don't sanitize password
        rememberMe: credentials.rememberMe,
      };

      // Use request deduplication to prevent multiple login attempts
      const performLogin = async () => this.supabaseAdapter.login(sanitizedCredentials);
      const result = this.deduplicator
        ? await this.deduplicator.deduplicateLogin(sanitizedCredentials.email, performLogin)
        : await performLogin();

      if (result.success && result.user && result.session) {
        // Record successful attempt
        this.validationService.recordSuccessfulAttempt(
          clientInfo?.ip || 'unknown',
          credentials.email
        );

        // Track metrics
        this.metrics?.trackLoginSuccess(credentials.email, result.user.id, startTime, clientInfo);

        // Track successful login for security monitoring
        if (clientInfo?.ip) {
          this.securityMonitor?.trackSuccessfulLogin(
            clientInfo.ip,
            credentials.email,
            result.user.id,
            clientInfo.userAgent
          );
        }

        await this.handleSessionUpdate(result.session, credentials.rememberMe);

        return {
          success: true,
          user: result.user,
          session: result.session,
          message: 'Login successful',
        };
      } else {
        // Record failed attempt
        this.validationService.recordFailedAttempt(clientInfo?.ip || 'unknown', credentials.email);

        // Track metrics
        this.metrics?.trackLoginFailure(
          credentials.email,
          result.error?.code || 'UNKNOWN_ERROR',
          startTime,
          clientInfo
        );

        // Track failed login for security monitoring
        if (clientInfo?.ip) {
          this.securityMonitor?.trackFailedLogin(
            clientInfo.ip,
            credentials.email,
            clientInfo.userAgent,
            { errorCode: result.error?.code }
          );
        }
      }

      // Return the error from Supabase adapter
      return result;
    } catch (error) {
      // Record failed attempt on exception
      if (clientInfo?.ip) {
        this.validationService.recordFailedAttempt(clientInfo.ip, credentials.email);
      }

      // Track metrics
      const authError = this.mapErrorToAuthError(error);
      this.metrics?.trackLoginFailure(credentials.email, authError.code, startTime, clientInfo);

      // Track failed login for security monitoring
      if (clientInfo?.ip) {
        this.securityMonitor?.trackFailedLogin(
          clientInfo.ip,
          credentials.email,
          clientInfo.userAgent,
          { errorCode: authError.code, exception: true }
        );
      }

      return {
        success: false,
        error: authError,
      };
    }
  }

  /**
   * Sign up new user
   */
  async signup(
    userData: SignupData,
    clientInfo?: { ip?: string; userAgent?: string; origin?: string }
  ): Promise<AuthResponse> {
    // Start metrics tracking
    const startTime = this.metrics?.trackSignupAttempt(userData.email, clientInfo) || Date.now();

    try {
      // Input validation and sanitization
      const validationResult = this.validationService.validateRegistrationData({
        email: userData.email,
        password: userData.password,
        name: userData.name,
        confirmPassword: userData.confirmPassword,
        termsAccepted: userData.termsAccepted,
        newsletterOptIn: userData.newsletterOptIn,
      });

      if (!validationResult.isValid) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validationResult.errors.join(', '),
          },
        };
      }

      // Rate limiting check (less strict for signup)
      const rateLimitResult = this.validationService.checkRateLimit(clientInfo?.ip || 'unknown');

      if (!rateLimitResult.allowed) {
        return {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: rateLimitResult.blocked
              ? `Too many signup attempts. Try again after ${new Date(rateLimitResult.resetTime).toLocaleTimeString()}`
              : `Too many attempts. ${rateLimitResult.remainingAttempts} attempts remaining.`,
          },
        };
      }

      // Security checks
      if (clientInfo?.origin && !this.validationService.validateOrigin(clientInfo.origin)) {
        return {
          success: false,
          error: {
            code: 'INVALID_ORIGIN',
            message: 'Request from unauthorized origin',
          },
        };
      }

      if (
        clientInfo?.userAgent &&
        !this.validationService.validateUserAgent(clientInfo.userAgent)
      ) {
        return {
          success: false,
          error: {
            code: 'INVALID_USER_AGENT',
            message: 'Invalid user agent',
          },
        };
      }

      // Password confirmation check
      if (userData.confirmPassword && userData.password !== userData.confirmPassword) {
        return {
          success: false,
          error: {
            code: 'PASSWORD_MISMATCH',
            message: 'Passwords do not match',
          },
        };
      }

      // Terms acceptance check (if required)
      if (userData.termsAccepted === false) {
        return {
          success: false,
          error: {
            code: 'TERMS_NOT_ACCEPTED',
            message: 'You must accept the terms and conditions',
          },
        };
      }

      // Use sanitized data for registration
      const sanitizedUserData: SignupData = {
        email: validationResult.sanitizedData?.email || userData.email,
        password: userData.password, // Don't sanitize password
        name: validationResult.sanitizedData?.name || userData.name,
        confirmPassword: userData.confirmPassword,
        termsAccepted: userData.termsAccepted,
        newsletterOptIn: userData.newsletterOptIn,
      };

      const result = await this.supabaseAdapter.signup(sanitizedUserData);

      if (result.success) {
        // Record successful attempt
        this.validationService.recordSuccessfulAttempt(clientInfo?.ip || 'unknown', userData.email);

        // Track metrics
        if (result.user) {
          this.metrics?.trackSignupSuccess(userData.email, result.user.id, startTime, clientInfo);
        }

        // If session was created (email verification not required)
        if (result.user && result.session) {
          await this.handleSessionUpdate(result.session);
        }

        return result;
      } else {
        // Record failed attempt
        this.validationService.recordFailedAttempt(clientInfo?.ip || 'unknown', userData.email);

        // Track metrics
        this.metrics?.trackSignupFailure(
          userData.email,
          result.error?.code || 'UNKNOWN_ERROR',
          startTime,
          clientInfo
        );
      }

      return result;
    } catch (error) {
      // Record failed attempt on exception
      if (clientInfo?.ip) {
        this.validationService.recordFailedAttempt(clientInfo.ip, userData.email);
      }

      return {
        success: false,
        error: this.mapErrorToAuthError(error),
      };
    }
  }

  /**
   * Logout current user
   */
  async logout(): Promise<AuthResponse> {
    const userId = this.currentUser?.id;

    try {
      await this.supabaseAdapter.logout();

      // Track metrics
      if (userId) {
        this.metrics?.trackLogout(userId, true); // voluntary logout
      }

      // Clear local session regardless of Supabase result
      await this.handleSessionCleared();

      return {
        success: true,
        message: 'Logout successful',
      };
    } catch (error) {
      // Track metrics
      if (userId) {
        this.metrics?.trackLogout(userId, true);
      }

      // Still clear local session even if logout fails
      await this.handleSessionCleared();

      return {
        success: false,
        error: this.mapErrorToAuthError(error),
      };
    }
  }

  /**
   * Get current authenticated user
   */
  getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  /**
   * Get current session
   */
  getCurrentSession(): AuthSession | null {
    return this.currentSession;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.currentUser !== null && this.currentSession !== null;
  }

  /**
   * Request password reset
   */
  async resetPassword(
    email: string,
    clientInfo?: { ip?: string; userAgent?: string }
  ): Promise<PasswordResetResponse> {
    try {
      const request: PasswordResetRequest = { email };
      const result = await this.supabaseAdapter.requestPasswordReset(request);

      // Track metrics
      this.metrics?.trackPasswordResetRequest(email, result.success, result.error?.code);

      // Track security event
      if (clientInfo?.ip) {
        this.securityMonitor?.trackPasswordResetAttempt(clientInfo.ip, email, result.success);
      }

      return result;
    } catch (error) {
      const authError = this.mapErrorToAuthError(error);

      // Track metrics
      this.metrics?.trackPasswordResetRequest(email, false, authError.code);

      // Track security event
      if (clientInfo?.ip) {
        this.securityMonitor?.trackPasswordResetAttempt(clientInfo.ip, email, false);
      }

      return {
        success: false,
        message: 'Failed to send password reset email',
        error: authError,
      };
    }
  }

  /**
   * Refresh session tokens
   */
  async refreshSession(): Promise<AuthResponse> {
    try {
      const currentSession = this.supabaseAdapter.getCurrentEnhancedSession();

      if (!currentSession?.refreshToken) {
        return {
          success: false,
          error: {
            code: 'NO_REFRESH_TOKEN',
            message: 'No refresh token available',
          },
        };
      }

      // Use request deduplication for token refresh
      const performRefresh = async () =>
        this.supabaseAdapter.refreshToken({
          refreshToken: currentSession.refreshToken,
        });
      const result = this.deduplicator
        ? await this.deduplicator.deduplicateTokenRefresh(
            currentSession.refreshToken,
            performRefresh
          )
        : await performRefresh();

      if (result.success && result.tokens) {
        // Track metrics
        if (this.currentUser?.id) {
          this.metrics?.trackSessionRefresh(this.currentUser.id, true);
        }

        // Update current session with new tokens
        if (this.currentSession) {
          this.currentSession.accessToken = result.tokens.accessToken;
          this.currentSession.refreshToken = result.tokens.refreshToken;
          this.currentSession.expiresAt = Date.now() + result.tokens.expiresIn * 1000;

          this.apiClient.setAuthToken(result.tokens.accessToken);
        }

        return {
          success: true,
          session: this.currentSession || undefined,
          message: 'Session refreshed successfully',
        };
      }

      // Track failed refresh
      if (this.currentUser?.id) {
        this.metrics?.trackSessionRefresh(this.currentUser.id, false, result.error?.code);
      }

      return {
        success: false,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: this.mapErrorToAuthError(error),
      };
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(updates: Partial<AuthUser>): Promise<AuthResponse> {
    try {
      const result = await this.supabaseAdapter.updateProfile(updates);

      if (result.success && result.user) {
        // Update current user data
        this.currentUser = result.user;

        return {
          success: true,
          user: result.user,
          message: 'Profile updated successfully',
        };
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: this.mapErrorToAuthError(error),
      };
    }
  }

  /**
   * Update user password
   */
  async updatePassword(newPassword: string): Promise<AuthResponse> {
    try {
      const result = await this.supabaseAdapter.updatePassword(newPassword);

      return result;
    } catch (error) {
      return {
        success: false,
        error: this.mapErrorToAuthError(error),
      };
    }
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<AuthResponse> {
    try {
      const result = await this.supabaseAdapter.verifyEmail({ token });

      return {
        success: result.success,
        message: result.message,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: this.mapErrorToAuthError(error),
      };
    }
  }

  /**
   * Get session validation info
   */
  async validateSession(): Promise<{ isValid: boolean; user?: AuthUser; error?: any }> {
    try {
      // Check cache first
      if (this.cache && this.currentSession?.id) {
        const cachedValidation = this.cache.getValidation(this.currentSession.id);
        if (cachedValidation) {
          return cachedValidation;
        }
      }

      // Use request deduplication for session validation
      const performValidation = async () => this.supabaseAdapter.validateSession();
      const result =
        this.deduplicator && this.currentSession?.id
          ? await this.deduplicator.deduplicateSessionValidation(
              this.currentSession.id,
              performValidation
            )
          : await performValidation();

      const validationResult = {
        isValid: result.isValid,
        user: result.session?.user,
        error: result.error,
      };

      // Cache the validation result
      if (this.cache && this.currentSession?.id) {
        this.cache.cacheValidation(this.currentSession.id, validationResult);
      }

      return validationResult;
    } catch (error) {
      return {
        isValid: false,
        error: this.mapErrorToAuthError(error),
      };
    }
  }

  /**
   * Get session statistics
   */
  getSessionStatistics() {
    return this.supabaseAdapter.getSessionStatistics();
  }

  /**
   * Check service health
   */
  async checkHealth() {
    return this.supabaseAdapter.checkHealth();
  }

  /**
   * Add event listener for auth state changes
   */
  addAuthStateListener(event: string, callback: (data: any) => void): () => void {
    return this.supabaseAdapter.addSessionEventListener(event, callback);
  }

  /**
   * Map generic errors to AuthError format
   */
  private mapErrorToAuthError(error: any): AuthError {
    if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
      return {
        code: error.code || 'UNKNOWN_ERROR',
        message: error.message,
        field: error.field,
        details: error.details,
        timestamp: error.timestamp || new Date().toISOString(),
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: error instanceof Error ? error.message : 'An unknown error occurred',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * TokenRefreshHandler implementation - refresh token
   */
  async refreshToken(): Promise<string | null> {
    try {
      const result = await this.refreshSession();

      if (result.success && result.session) {
        return result.session.accessToken;
      }

      return null;
    } catch (error) {
      if (this.config.enableDetailedLogging) {
        console.error('Token refresh failed in AuthClient:', error);
      }
      return null;
    }
  }

  /**
   * TokenRefreshHandler implementation - check if token is expired
   */
  isTokenExpired(token: string): boolean {
    try {
      // Parse JWT token to get expiration
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp;

      if (!exp) {
        return false; // If no expiration, assume it's valid
      }

      // Check if token expires within 5 minutes (300 seconds)
      const now = Math.floor(Date.now() / 1000);
      const buffer = 300; // 5 minutes buffer

      return exp - buffer <= now;
    } catch {
      // If we can't parse the token, assume it's expired
      return true;
    }
  }

  /**
   * Get CSRF token for request protection
   */
  getCSRFToken(): string | null {
    return this.tokenStorage.getCSRFToken();
  }

  /**
   * Validate CSRF token
   */
  validateCSRFToken(token: string): boolean {
    return this.tokenStorage.validateCSRFToken(token);
  }

  /**
   * Check if access token is expired or expiring soon
   */
  async isAccessTokenExpired(bufferMinutes: number = 5): Promise<boolean> {
    return await this.tokenStorage.isAccessTokenExpired(bufferMinutes);
  }

  /**
   * Get token storage statistics
   */
  getTokenStorageStats() {
    return this.tokenStorage.getEnhancedStats();
  }

  /**
   * Validate email format and security
   */
  validateEmail(email: string) {
    return this.validationService.validateEmail(email);
  }

  /**
   * Validate password strength and requirements
   */
  validatePassword(password: string) {
    return this.validationService.validatePassword(password);
  }

  /**
   * Validate user name
   */
  validateName(name: string) {
    return this.validationService.validateName(name);
  }

  /**
   * Generate CSRF token for form protection
   */
  generateCSRFToken(): string {
    return this.validationService.generateCSRFToken();
  }

  /**
   * Validate CSRF token
   */
  validateCSRFTokenFromService(token: string): boolean {
    return this.validationService.validateCSRFToken(token);
  }

  /**
   * Get security headers for requests
   */
  getSecurityHeaders(): Record<string, string> {
    return this.validationService.getSecurityHeaders();
  }

  /**
   * Check rate limiting status
   */
  checkRateLimit(ip: string, email?: string) {
    return this.validationService.checkRateLimit(ip, email);
  }

  /**
   * Get rate limiting statistics
   */
  getRateLimitStats() {
    return this.validationService.getRateLimitStats();
  }

  /**
   * Validate request origin
   */
  validateOrigin(origin: string): boolean {
    return this.validationService.validateOrigin(origin);
  }

  /**
   * Validate user agent
   */
  validateUserAgent(userAgent: string): boolean {
    return this.validationService.validateUserAgent(userAgent);
  }

  /**
   * Validate HTTPS requirement
   */
  validateHTTPS(protocol: string, host: string): boolean {
    return this.validationService.validateHTTPS(protocol, host);
  }

  /**
   * Get cache statistics (if caching is enabled)
   */
  getCacheStats() {
    return this.cache?.getStats() || null;
  }

  /**
   * Clear authentication cache
   */
  clearCache(): void {
    this.cache?.clear();
  }

  /**
   * Cleanup expired cache entries
   */
  cleanupCache(): void {
    this.cache?.cleanup();
  }

  /**
   * Configure cache settings
   */
  configureCaching(config: Partial<typeof DEFAULT_AUTH_CACHE_CONFIG>): void {
    this.cache?.configure(config);
  }

  /**
   * Get authentication metrics summary
   */
  getMetricsSummary(fromTimestamp?: number, toTimestamp?: number) {
    return this.metrics?.getSummary(fromTimestamp, toTimestamp) || null;
  }

  /**
   * Get recent authentication events
   */
  getRecentAuthEvents(limit: number = 100, type?: string) {
    return this.metrics?.getRecentEvents(limit, type) || [];
  }

  /**
   * Get authentication error rate
   */
  getAuthErrorRate(type: 'login' | 'signup', hours: number = 24): number {
    return this.metrics?.getErrorRate(type, hours) || 0;
  }

  /**
   * Get authentication performance metrics
   */
  getAuthPerformanceMetrics() {
    return this.metrics?.getPerformanceMetrics() || null;
  }

  /**
   * Add authentication event listener
   */
  addEventListener(eventType: string, handler: (event: any) => void): (() => void) | null {
    return this.metrics?.addEventListener(eventType, handler) || null;
  }

  /**
   * Configure metrics tracking
   */
  configureMetrics(config: Partial<typeof DEFAULT_AUTH_METRICS_CONFIG>): void {
    this.metrics?.configure(config);
  }

  /**
   * Get security statistics
   */
  getSecurityStats() {
    return this.securityMonitor?.getSecurityStats() || null;
  }

  /**
   * Get recent security events
   */
  getRecentSecurityEvents(limit: number = 100, severity?: 'low' | 'medium' | 'high' | 'critical') {
    return this.securityMonitor?.getRecentEvents(limit, severity) || [];
  }

  /**
   * Get active security alerts
   */
  getActiveSecurityAlerts() {
    return this.securityMonitor?.getActiveAlerts() || [];
  }

  /**
   * Check if IP is blocked
   */
  isIPBlocked(ip: string): boolean {
    return this.securityMonitor?.isIPBlocked(ip) || false;
  }

  /**
   * Block an IP address
   */
  blockIP(ip: string, reason: string): void {
    this.securityMonitor?.blockIP(ip, reason);
  }

  /**
   * Unblock an IP address
   */
  unblockIP(ip: string): void {
    this.securityMonitor?.unblockIP(ip);
  }

  /**
   * Acknowledge security alert
   */
  acknowledgeSecurityAlert(alertId: string): boolean {
    return this.securityMonitor?.acknowledgeAlert(alertId) || false;
  }

  /**
   * Resolve security alert
   */
  resolveSecurityAlert(alertId: string): boolean {
    return this.securityMonitor?.resolveAlert(alertId) || false;
  }

  /**
   * Add security alert handler
   */
  addSecurityAlertHandler(handler: (alert: any) => void): (() => void) | null {
    return this.securityMonitor?.addAlertHandler(handler) || null;
  }

  /**
   * Configure security monitoring
   */
  configureSecurityMonitoring(config: Partial<typeof DEFAULT_SECURITY_MONITOR_CONFIG>): void {
    this.securityMonitor?.configure(config);
  }

  /**
   * Export security report
   */
  exportSecurityReport(fromTimestamp?: number, toTimestamp?: number) {
    return this.securityMonitor?.exportSecurityReport(fromTimestamp, toTimestamp) || null;
  }

  /**
   * Preload commonly accessed data
   */
  async preloadCache(): Promise<void> {
    if (!this.cache || !this.currentUser) return;

    await this.cache.preload(async () => {
      const items = [];

      // Preload current user profile
      if (this.currentUser) {
        items.push({
          key: `profile:${this.currentUser.id}`,
          data: this.currentUser,
        });
      }

      // Preload current session
      if (this.currentSession?.id) {
        items.push({
          key: `session:${this.currentSession.id}`,
          data: this.currentSession,
        });
      }

      return items;
    });
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    // Remove token refresh handler from API client
    this.apiClient.setTokenRefreshHandler(null);

    // Clear cache
    this.cache?.clear();

    // Dispose metrics
    this.metrics?.dispose();

    // Dispose security monitor
    this.securityMonitor?.dispose();

    await this.supabaseAdapter.dispose();
    await this.handleSessionCleared();
  }
}

/**
 * Factory function to create AuthClient instance
 */
export function createAuthClient(config: AuthClientConfig): AuthClient {
  return new AuthClient(config);
}

/**
 * Factory function with default configuration
 */
export async function createAuthClientWithDefaults(
  apiClient: AgenticWorkflowApiClient
): Promise<AuthClient> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase configuration not found in environment variables');
  }

  const authClient = new AuthClient({
    supabaseUrl,
    supabaseKey,
    apiClient: (apiClient as any).baseClient || apiClient,
    enableDetailedLogging: process.env.NODE_ENV === 'development',
    enableCaching: true,
    cacheConfig: {
      maxSize: 50,
      enableMetrics: true,
    },
    enableMetrics: true,
    metricsConfig: {
      retentionDays: 7, // Keep metrics for a week
      enablePerformanceTracking: true,
      enableClientTracking: process.env.NODE_ENV === 'development',
    },
    enableSecurityMonitoring: true,
    securityConfig: {
      bruteForceThreshold: 5,
      bruteForceWindowMinutes: 15,
      anomalyDetectionEnabled: true,
      alertingEnabled: process.env.NODE_ENV === 'production',
      auditLoggingEnabled: true,
    },
  });

  await authClient.initialize();
  return authClient;
}

export default AuthClient;
