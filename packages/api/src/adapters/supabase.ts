/**
 * Supabase Adapter for Authentication Integration
 *
 * This adapter provides a bridge between the existing authentication API
 * interfaces and Supabase's authentication services, maintaining backward
 * compatibility while leveraging Supabase's powerful features.
 */

import { createClient, SupabaseClient, AuthError, User } from '@supabase/supabase-js';
import { ConfigurationManager, getConfigurationManager } from '../config';
import {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  ProfileResponse,
  UpdateProfileRequest,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  UpdatePasswordRequest,
  UpdatePasswordResponse,
  VerifyEmailRequest,
  VerifyEmailResponse,
  ResendVerificationEmailRequest,
  ResendVerificationEmailResponse,
  EmailVerificationStatusRequest,
  EmailVerificationStatusResponse,
  EmailChangeRequest,
  EmailChangeResponse,
} from '../types/auth';
import {
  mapSupabaseSessionToLogin,
  mapSupabaseSessionToRegister,
  mapSupabaseUserToProfile,
  mapSupabaseErrorToApiError,
  mapGenericErrorToApiError,
  transformRegistrationMetadata,
  transformProfileUpdateData,
  validateSessionData,
} from './transformers';
import {
  SupabaseErrorMapper,
  AuthRetryHandler,
  getErrorMapper,
  getRetryHandler,
  EnhancedApiError,
  RetryConfig,
} from './error-handler';
import {
  CircuitBreaker,
  getSupabaseCircuitBreaker,
  CircuitBreakerConfig,
  FallbackOperation,
} from './circuit-breaker';
import { getPasswordValidator } from './password-validator';
import {
  PerformanceCache,
  getPerformanceCache,
  CacheConfig,
  PerformanceMetrics,
} from './performance-cache';
import {
  AnalyticsMonitor,
  getAnalyticsMonitor,
  AnalyticsConfig,
  ErrorSeverity,
} from './analytics-monitor';

/**
 * Supabase session data interface
 */
export interface SupabaseSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: User;
  expires_at?: number;
}

/**
 * Supabase authentication adapter
 */
export class SupabaseAdapter {
  private client: SupabaseClient;
  private configManager: ConfigurationManager;
  private logger: AdapterLogger;
  private errorMapper: SupabaseErrorMapper;
  private retryHandler: AuthRetryHandler;
  private circuitBreaker: CircuitBreaker;
  private performanceCache: PerformanceCache;
  private analyticsMonitor: AnalyticsMonitor;

  constructor(
    configManager?: ConfigurationManager,
    retryConfig?: Partial<RetryConfig>,
    circuitBreakerConfig?: Partial<CircuitBreakerConfig>,
    cacheConfig?: Partial<CacheConfig>,
    analyticsConfig?: Partial<AnalyticsConfig>
  ) {
    this.configManager = configManager || getConfigurationManager();
    this.logger = new AdapterLogger('SupabaseAdapter');

    // Initialize error handling components
    this.errorMapper = getErrorMapper();
    this.retryHandler = retryConfig ? new AuthRetryHandler(retryConfig) : getRetryHandler();
    this.circuitBreaker = getSupabaseCircuitBreaker(circuitBreakerConfig);
    this.performanceCache = getPerformanceCache(cacheConfig);
    this.analyticsMonitor = getAnalyticsMonitor(analyticsConfig);

    try {
      this.client = this.initializeSupabaseClient();
      this.logger.info('Supabase adapter initialized successfully', {
        url: this.configManager.getSupabaseConfig().url,
      });
    } catch (error) {
      this.logger.error('Failed to initialize Supabase adapter', error);
      throw error;
    }
  }

  /**
   * Initialize Supabase client with configuration
   */
  private initializeSupabaseClient(): SupabaseClient {
    const config = this.configManager.getSupabaseConfig();

    this.logger.debug('Initializing Supabase client', {
      url: config.url,
      hasAnonKey: !!config.anonKey,
      hasServiceRoleKey: !!config.serviceRoleKey,
    });

    try {
      const client = createClient(config.url, config.anonKey, config.options) as SupabaseClient;

      // Verify client initialization
      if (!client) {
        throw new SupabaseAdapterError(
          'Failed to create Supabase client',
          'CLIENT_CREATION_FAILED'
        );
      }

      return client;
    } catch (error) {
      this.logger.error('Supabase client creation failed', error);
      throw new SupabaseAdapterError(
        `Failed to initialize Supabase client: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CLIENT_INIT_ERROR'
      );
    }
  }

  /**
   * Get the initialized Supabase client
   */
  getClient(): SupabaseClient {
    return this.client;
  }

  /**
   * Check if adapter is properly initialized
   */
  isInitialized(): boolean {
    return !!this.client;
  }

  /**
   * Get adapter health status
   */
  getHealthStatus(): AdapterHealthStatus {
    try {
      // Verify configuration is accessible
      this.configManager.getConfig();
      const isClientReady = this.isInitialized();

      return {
        isHealthy: isClientReady,
        status: isClientReady ? 'ready' : 'error',
        checks: {
          clientInitialized: isClientReady,
          configurationValid: true,
          connectionReady: isClientReady,
        },
        timestamp: new Date().toISOString(),
        version: this.getAdapterVersion(),
      };
    } catch (error) {
      this.logger.error('Health check failed', error);
      return {
        isHealthy: false,
        status: 'error',
        checks: {
          clientInitialized: false,
          configurationValid: false,
          connectionReady: false,
        },
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        version: this.getAdapterVersion(),
      };
    }
  }

  /**
   * Get adapter version
   */
  private getAdapterVersion(): string {
    return '1.0.0'; // This would typically come from package.json
  }

  /**
   * Reinitialize the adapter (useful for configuration changes)
   */
  async reinitialize(): Promise<void> {
    this.logger.info('Reinitializing Supabase adapter');

    try {
      // Clear existing client
      if (this.client) {
        // Perform any cleanup if needed
        this.logger.debug('Cleaning up existing client');
      }

      // Reinitialize configuration manager
      this.configManager = getConfigurationManager();

      // Create new client
      this.client = this.initializeSupabaseClient();

      this.logger.info('Supabase adapter reinitialized successfully');
    } catch (error) {
      this.logger.error('Failed to reinitialize adapter', error);
      throw error;
    }
  }

  /**
   * Test connection to Supabase
   */
  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();

    try {
      this.logger.debug('Testing Supabase connection');

      // Use retry logic for connection test
      const data = await this.executeWithRetry(async () => {
        const { data, error } = await this.client.auth.getSession();
        if (error) {
          throw this.errorMapper.mapSupabaseError(error);
        }
        return data;
      }, 'testConnection');

      const responseTime = Date.now() - startTime;

      this.logger.debug('Connection test successful', { responseTime });
      return {
        success: true,
        responseTime,
        timestamp: new Date().toISOString(),
        sessionExists: !!data.session,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.logger.error('Connection test failed', error);

      const enhancedError = this.isEnhancedApiError(error)
        ? error
        : this.errorMapper.mapGenericError(
            error instanceof Error ? error : new Error(String(error)),
            'testConnection'
          );

      return {
        success: false,
        error: enhancedError.message,
        responseTime,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // ===== AUTHENTICATION METHODS =====

  /**
   * Authenticate user with email and password
   */
  async authenticateUser(credentials: LoginRequest): Promise<LoginResponse> {
    const requestKey = PerformanceCache.generateAuthRequestKey(credentials.email);

    // Start analytics tracking
    const operationId = this.analyticsMonitor.trackLoginAttempt(credentials.email, {
      userAgent: this.getUserAgent(),
      timestamp: Date.now(),
    });

    return this.performanceCache.deduplicateRequest(requestKey, async () => {
      return this.performanceCache.optimizedExecute(async () => {
        const startTime = Date.now();

        this.logger.debug('Authenticating user', { email: credentials.email, operationId });

        try {
          // Validate input
          if (!credentials.email || !credentials.password) {
            const error = new SupabaseAdapterError(
              'Email and password are required',
              'INVALID_CREDENTIALS'
            );

            // Track validation failure
            this.analyticsMonitor.trackLoginFailure(
              operationId,
              credentials.email,
              'INVALID_CREDENTIALS',
              error.message,
              { validationError: true }
            );

            // Track error for monitoring
            this.analyticsMonitor.trackError(
              'validation_error',
              'medium',
              error.message,
              { operation: 'authenticateUser', email: credentials.email },
              'INVALID_CREDENTIALS'
            );

            throw error;
          }

          // Attempt authentication with Supabase
          const { data, error } = await this.client.auth.signInWithPassword({
            email: credentials.email,
            password: credentials.password,
          });

          if (error) {
            const responseTime = Date.now() - startTime;
            this.logger.warn('Authentication failed', {
              email: credentials.email,
              error: error.message,
              responseTime,
              operationId,
            });

            // Track authentication failure
            this.analyticsMonitor.trackLoginFailure(
              operationId,
              credentials.email,
              error.message.includes('Invalid') ? 'INVALID_CREDENTIALS' : 'AUTH_ERROR',
              error.message,
              { supabaseError: true, responseTime }
            );

            // Track error for monitoring
            this.analyticsMonitor.trackError(
              'auth_error',
              error.message.includes('Invalid') ? 'medium' : 'high',
              error.message,
              { operation: 'authenticateUser', email: credentials.email },
              error.message
            );

            throw mapSupabaseErrorToApiError(error);
          }

          if (!data.session) {
            throw new SupabaseAdapterError(
              'Authentication succeeded but no session was returned',
              'NO_SESSION_RETURNED'
            );
          }

          // Check if email verification is required and not completed
          if (data.session.user && !data.session.user.email_confirmed_at) {
            this.logger.warn('Login attempt with unverified email', {
              email: credentials.email,
              userId: data.session.user.id,
              responseTime: Date.now() - startTime,
            });

            throw new SupabaseAdapterError(
              'Please verify your email address before logging in. Check your inbox for a verification link.',
              'EMAIL_NOT_VERIFIED'
            );
          }

          // Validate session data
          if (!validateSessionData(data.session)) {
            throw new SupabaseAdapterError(
              'Invalid session data returned from Supabase',
              'INVALID_SESSION_DATA'
            );
          }

          const loginResponse = mapSupabaseSessionToLogin(data.session);
          const responseTime = Date.now() - startTime;

          // Track successful authentication
          this.analyticsMonitor.trackLoginSuccess(
            operationId,
            data.session.user.id,
            credentials.email,
            {
              responseTime,
              emailVerified: !!data.session.user.email_confirmed_at,
            }
          );

          this.logger.info('User authenticated successfully', {
            userId: data.session.user.id,
            email: credentials.email,
            responseTime,
            operationId,
          });

          return loginResponse;
        } catch (error) {
          const responseTime = Date.now() - startTime;

          if (error instanceof AuthError) {
            this.logger.warn('Supabase authentication error', {
              email: credentials.email,
              error: error.message,
              responseTime,
              operationId,
            });

            // Track authentication failure if not already tracked
            this.analyticsMonitor.trackLoginFailure(
              operationId,
              credentials.email,
              error.message,
              error.message,
              { supabaseError: true, responseTime }
            );

            throw this.errorMapper.mapSupabaseError(error);
          }

          if (this.isEnhancedApiError(error)) {
            // Already a mapped error, but still track for analytics
            this.analyticsMonitor.trackLoginFailure(
              operationId,
              credentials.email,
              (error as any).code || 'UNKNOWN_ERROR',
              (error as any).message || 'Unknown error',
              { enhancedApiError: true, responseTime }
            );

            throw error;
          }

          this.logger.error('Unexpected authentication error', {
            email: credentials.email,
            error: error instanceof Error ? error.message : String(error),
            responseTime,
            operationId,
          });

          // Track unexpected error
          this.analyticsMonitor.trackLoginFailure(
            operationId,
            credentials.email,
            'UNEXPECTED_ERROR',
            error instanceof Error ? error.message : String(error),
            { unexpectedError: true, responseTime }
          );

          // Track error for monitoring
          this.analyticsMonitor.trackError(
            'system_error',
            'high',
            error instanceof Error ? error.message : String(error),
            { operation: 'authenticateUser', email: credentials.email },
            'UNEXPECTED_ERROR',
            error instanceof Error ? error.stack : undefined
          );

          throw this.errorMapper.mapGenericError(
            error instanceof Error ? error : new Error(String(error)),
            'authenticateUser'
          );
        }
      }, 'authentication');
    });
  }

  /**
   * Register new user with email and password
   */
  async registerUser(userData: RegisterRequest): Promise<RegisterResponse> {
    const startTime = Date.now();

    this.logger.debug('Registering new user', { email: userData.email });

    try {
      // Validate input
      if (!userData.email || !userData.password || !userData.name) {
        throw new SupabaseAdapterError(
          'Email, password, and name are required',
          'INVALID_REGISTRATION_DATA'
        );
      }

      // Transform user metadata for Supabase
      const userMetadata = transformRegistrationMetadata(userData);

      // Attempt registration with Supabase
      const { data, error } = await this.client.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: userMetadata,
        },
      });

      if (error) {
        this.logger.warn('Registration failed', {
          email: userData.email,
          error: error.message,
          responseTime: Date.now() - startTime,
        });
        throw mapSupabaseErrorToApiError(error);
      }

      if (!data.session) {
        // Registration succeeded but requires email confirmation
        this.logger.info('User registered successfully, email confirmation required', {
          email: userData.email,
          userId: data.user?.id,
          emailConfirmed: data.user?.email_confirmed_at ? true : false,
          responseTime: Date.now() - startTime,
        });

        // For registration without immediate session (email confirmation required)
        // we need to return a response indicating success but no immediate login
        if (data.user) {
          // Add helpful logging about email verification requirement
          this.logger.info('Registration requires email verification', {
            email: userData.email,
            userId: data.user.id,
            message: 'User must verify email before login',
          });

          return {
            access_token: '', // Empty token indicates email confirmation needed
            refresh_token: '',
            expires_in: 0,
            user: mapSupabaseUserToProfile(data.user),
          };
        } else {
          throw new SupabaseAdapterError(
            'Registration completed but no user data returned',
            'NO_USER_RETURNED'
          );
        }
      }

      // Registration with immediate session (email confirmation disabled)
      if (!validateSessionData(data.session)) {
        throw new SupabaseAdapterError(
          'Invalid session data returned from registration',
          'INVALID_SESSION_DATA'
        );
      }

      const registerResponse = mapSupabaseSessionToRegister(data.session);
      const responseTime = Date.now() - startTime;

      this.logger.info('User registered and authenticated successfully', {
        userId: data.session.user.id,
        email: userData.email,
        responseTime,
      });

      return registerResponse;
    } catch (error) {
      const responseTime = Date.now() - startTime;

      if (error instanceof AuthError) {
        this.logger.warn('Supabase registration error', {
          email: userData.email,
          error: error.message,
          responseTime,
        });
        throw mapSupabaseErrorToApiError(error);
      }

      if ((error as any).name === 'ExtendedApiError' || (error as any).status) {
        // Already a mapped error, re-throw
        throw error;
      }

      this.logger.error('Unexpected registration error', {
        email: userData.email,
        error: error instanceof Error ? error.message : String(error),
        responseTime,
      });

      throw mapGenericErrorToApiError(
        error instanceof Error ? error : new Error(String(error)),
        'registerUser'
      );
    }
  }

  /**
   * Get current active session
   */
  async getActiveSession(): Promise<SupabaseSession | null> {
    try {
      const { data, error } = await this.client.auth.getSession();

      if (error) {
        this.logger.debug('No active session found', { error: error.message });
        return null;
      }

      if (!data.session) {
        this.logger.debug('No active session available');
        return null;
      }

      // Validate session data
      if (!validateSessionData(data.session)) {
        this.logger.warn('Active session data is invalid');
        return null;
      }

      this.logger.debug('Active session retrieved', {
        userId: data.session.user.id,
        expiresAt: new Date(data.session.expires_at! * 1000).toISOString(),
      });

      // Return the session in our expected format
      return {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in || 3600,
        user: data.session.user,
        expires_at: data.session.expires_at,
      };
    } catch (error) {
      this.logger.error('Failed to get active session', error);
      throw mapSupabaseErrorToApiError(error as AuthError);
    }
  }

  /**
   * Sign out current user and clear session
   */
  async signOut(): Promise<void> {
    const startTime = Date.now();

    // Get current user info before signing out
    let userId: string | undefined;
    let sessionId: string | undefined;
    try {
      const { data } = await this.client.auth.getUser();
      userId = data.user?.id;
      sessionId = this.getCurrentSessionId();
    } catch (error) {
      // Ignore errors when getting user info for logout
    }

    this.logger.debug('Signing out user', { userId, sessionId });

    try {
      const { error } = await this.client.auth.signOut();

      if (error) {
        this.logger.warn('Sign out error from Supabase', {
          error: error.message,
          responseTime: Date.now() - startTime,
        });

        // For sign out, we may want to continue even if Supabase returns an error
        // since the goal is to clear the local session
        throw mapSupabaseErrorToApiError(error);
      }

      const responseTime = Date.now() - startTime;

      // Track successful logout
      if (userId) {
        this.analyticsMonitor.trackLogout(userId, sessionId, { responseTime });
      }

      this.logger.info('User signed out successfully', { responseTime, userId, sessionId });
    } catch (error) {
      const responseTime = Date.now() - startTime;

      if (error instanceof AuthError) {
        this.logger.warn('Supabase sign out error', {
          error: error.message,
          responseTime,
        });
        throw mapSupabaseErrorToApiError(error);
      }

      if ((error as any).name === 'ExtendedApiError' || (error as any).status) {
        // Already a mapped error, re-throw
        throw error;
      }

      this.logger.error('Unexpected sign out error', {
        error: error instanceof Error ? error.message : String(error),
        responseTime,
      });

      throw mapGenericErrorToApiError(
        error instanceof Error ? error : new Error(String(error)),
        'signOut'
      );
    }
  }

  /**
   * Get current user profile
   */
  async getUserProfile(): Promise<ProfileResponse> {
    return this.performanceCache.optimizedExecute(async () => {
      const startTime = Date.now();

      this.logger.debug('Getting user profile');

      try {
        const {
          data: { user },
          error,
        } = await this.client.auth.getUser();

        if (error) {
          this.logger.warn('Failed to get user profile', {
            error: error.message,
            responseTime: Date.now() - startTime,
          });
          throw mapSupabaseErrorToApiError(error);
        }

        if (!user) {
          throw new SupabaseAdapterError('No authenticated user found', 'NO_USER_FOUND');
        }

        // Check cache first
        const cached = this.performanceCache.getCachedProfile(user.id);
        if (cached) {
          this.logger.debug('Profile retrieved from cache', { userId: user.id });
          return cached;
        }

        const profile = mapSupabaseUserToProfile(user);
        const responseTime = Date.now() - startTime;

        // Cache the profile
        this.performanceCache.cacheProfile(user.id, profile);

        this.logger.debug('User profile retrieved successfully', {
          userId: user.id,
          responseTime,
        });

        return profile;
      } catch (error) {
        const responseTime = Date.now() - startTime;

        if (error instanceof AuthError) {
          this.logger.warn('Supabase get user error', {
            error: error.message,
            responseTime,
          });
          throw mapSupabaseErrorToApiError(error);
        }

        if ((error as any).name === 'ExtendedApiError' || (error as any).status) {
          // Already a mapped error, re-throw
          throw error;
        }

        this.logger.error('Unexpected get user profile error', {
          error: error instanceof Error ? error.message : String(error),
          responseTime,
        });

        throw mapGenericErrorToApiError(
          error instanceof Error ? error : new Error(String(error)),
          'getUserProfile'
        );
      }
    }, 'profile');
  }

  /**
   * Update user profile information
   */
  async updateUserProfile(profileData: UpdateProfileRequest): Promise<ProfileResponse> {
    const startTime = Date.now();

    this.logger.debug('Updating user profile', {
      hasEmailUpdate: !!profileData.email,
      hasMetadataUpdate: !!profileData.name,
    });

    try {
      // Transform profile update data for Supabase
      const updateData = transformProfileUpdateData(profileData);

      // Perform the update
      const {
        data: { user },
        error,
      } = await this.client.auth.updateUser(updateData);

      if (error) {
        this.logger.warn('Failed to update user profile', {
          error: error.message,
          responseTime: Date.now() - startTime,
        });
        throw mapSupabaseErrorToApiError(error);
      }

      if (!user) {
        throw new SupabaseAdapterError(
          'Profile update succeeded but no user data returned',
          'NO_USER_RETURNED'
        );
      }

      const updatedProfile = mapSupabaseUserToProfile(user);
      const responseTime = Date.now() - startTime;

      // Invalidate cached profile since it was updated
      this.performanceCache.invalidateProfile(user.id);

      // Cache the updated profile
      this.performanceCache.cacheProfile(user.id, updatedProfile);

      this.logger.info('User profile updated successfully', {
        userId: user.id,
        responseTime,
      });

      return updatedProfile;
    } catch (error) {
      const responseTime = Date.now() - startTime;

      if (error instanceof AuthError) {
        this.logger.warn('Supabase update user error', {
          error: error.message,
          responseTime,
        });
        throw mapSupabaseErrorToApiError(error);
      }

      if ((error as any).name === 'ExtendedApiError' || (error as any).status) {
        // Already a mapped error, re-throw
        throw error;
      }

      this.logger.error('Unexpected update user profile error', {
        error: error instanceof Error ? error.message : String(error),
        responseTime,
      });

      throw mapGenericErrorToApiError(
        error instanceof Error ? error : new Error(String(error)),
        'updateUserProfile'
      );
    }
  }

  // ===== PASSWORD MANAGEMENT METHODS =====

  /**
   * Send password reset email
   */
  async forgotPassword(request: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
    const startTime = Date.now();

    this.logger.debug('Sending password reset email', { email: request.email });

    try {
      // Validate email format
      if (!request.email || !this.isValidEmail(request.email)) {
        throw new SupabaseAdapterError('Please provide a valid email address', 'INVALID_EMAIL');
      }

      // Send password reset email via Supabase
      const redirectUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}/reset-password`
          : 'http://localhost:3000/reset-password'; // Fallback for server-side

      const { error } = await this.client.auth.resetPasswordForEmail(request.email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        this.logger.warn('Password reset email failed', {
          email: request.email,
          error: error.message,
          responseTime: Date.now() - startTime,
        });
        throw mapSupabaseErrorToApiError(error);
      }

      const responseTime = Date.now() - startTime;
      this.logger.info('Password reset email sent successfully', {
        email: request.email,
        responseTime,
      });

      return {
        message: 'If an account with this email exists, a password reset link has been sent.',
        email: request.email,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      if (error instanceof AuthError) {
        this.logger.warn('Supabase password reset error', {
          email: request.email,
          error: error.message,
          responseTime,
        });
        throw mapSupabaseErrorToApiError(error);
      }

      if ((error as any).name === 'ExtendedApiError' || (error as any).status) {
        // Already a mapped error, re-throw
        throw error;
      }

      this.logger.error('Unexpected password reset error', {
        email: request.email,
        error: error instanceof Error ? error.message : String(error),
        responseTime,
      });

      throw mapGenericErrorToApiError(
        error instanceof Error ? error : new Error(String(error)),
        'forgotPassword'
      );
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(request: ResetPasswordRequest): Promise<ResetPasswordResponse> {
    const startTime = Date.now();

    this.logger.debug('Resetting password with token');

    try {
      // Validate input
      if (!request.token || !request.new_password) {
        throw new SupabaseAdapterError(
          'Reset token and new password are required',
          'INVALID_RESET_DATA'
        );
      }

      // Validate password strength
      const passwordValidator = getPasswordValidator();
      const passwordResult = passwordValidator.validatePassword(request.new_password);

      if (!passwordResult.isValid) {
        throw new SupabaseAdapterError(
          `Password does not meet requirements: ${passwordResult.feedback.join(', ')}`,
          'WEAK_PASSWORD'
        );
      }

      // The token is typically handled by Supabase's session management
      // In practice, this method would be called from a reset page where the user is already authenticated
      // via the reset link, so we update the password directly
      const { error } = await this.client.auth.updateUser({
        password: request.new_password,
      });

      if (error) {
        this.logger.warn('Password reset failed', {
          error: error.message,
          responseTime: Date.now() - startTime,
        });
        throw mapSupabaseErrorToApiError(error);
      }

      const responseTime = Date.now() - startTime;
      this.logger.info('Password reset successful', { responseTime });

      return {
        message: 'Password has been reset successfully. You can now log in with your new password.',
        success: true,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      if (error instanceof AuthError) {
        this.logger.warn('Supabase password reset error', {
          error: error.message,
          responseTime,
        });
        throw mapSupabaseErrorToApiError(error);
      }

      if ((error as any).name === 'ExtendedApiError' || (error as any).status) {
        // Already a mapped error, re-throw
        throw error;
      }

      this.logger.error('Unexpected password reset error', {
        error: error instanceof Error ? error.message : String(error),
        responseTime,
      });

      throw mapGenericErrorToApiError(
        error instanceof Error ? error : new Error(String(error)),
        'resetPassword'
      );
    }
  }

  /**
   * Update user password (when authenticated)
   */
  async updatePassword(request: UpdatePasswordRequest): Promise<UpdatePasswordResponse> {
    const startTime = Date.now();

    this.logger.debug('Updating user password');

    try {
      // Validate new password
      if (!request.new_password) {
        throw new SupabaseAdapterError('New password is required', 'INVALID_PASSWORD_DATA');
      }

      // Validate password strength
      const passwordValidator = getPasswordValidator();
      const passwordResult = passwordValidator.validatePassword(request.new_password);

      if (!passwordResult.isValid) {
        throw new SupabaseAdapterError(
          `Password does not meet requirements: ${passwordResult.feedback.join(', ')}`,
          'WEAK_PASSWORD'
        );
      }

      // If current password is provided, verify it first (additional security)
      if (request.current_password) {
        const {
          data: { user },
        } = await this.client.auth.getUser();
        if (!user) {
          throw new SupabaseAdapterError('No authenticated user found', 'NO_USER_FOUND');
        }

        // Verify current password by attempting to sign in
        const { error: verifyError } = await this.client.auth.signInWithPassword({
          email: user.email!,
          password: request.current_password,
        });

        if (verifyError) {
          throw new SupabaseAdapterError(
            'Current password is incorrect',
            'INVALID_CURRENT_PASSWORD'
          );
        }
      }

      // Update password
      const { error } = await this.client.auth.updateUser({
        password: request.new_password,
      });

      if (error) {
        this.logger.warn('Password update failed', {
          error: error.message,
          responseTime: Date.now() - startTime,
        });
        throw mapSupabaseErrorToApiError(error);
      }

      const responseTime = Date.now() - startTime;
      this.logger.info('Password updated successfully', { responseTime });

      return {
        message: 'Password has been updated successfully.',
        success: true,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      if (error instanceof AuthError) {
        this.logger.warn('Supabase password update error', {
          error: error.message,
          responseTime,
        });
        throw mapSupabaseErrorToApiError(error);
      }

      if ((error as any).name === 'ExtendedApiError' || (error as any).status) {
        // Already a mapped error, re-throw
        throw error;
      }

      this.logger.error('Unexpected password update error', {
        error: error instanceof Error ? error.message : String(error),
        responseTime,
      });

      throw mapGenericErrorToApiError(
        error instanceof Error ? error : new Error(String(error)),
        'updatePassword'
      );
    }
  }

  // ===== EMAIL VERIFICATION METHODS =====

  /**
   * Verify email with token
   */
  async verifyEmail(request: VerifyEmailRequest): Promise<VerifyEmailResponse> {
    const startTime = Date.now();

    this.logger.debug('Verifying email with token', {
      hasToken: !!request.token,
      type: request.type,
    });

    try {
      // Validate input
      if (!request.token) {
        throw new SupabaseAdapterError('Verification token is required', 'INVALID_TOKEN');
      }

      // The token verification in Supabase is typically handled through the auth flow
      // When a user clicks the verification link, they are redirected with the token
      // and the session is automatically established. We verify the current session state.
      const {
        data: { user },
        error,
      } = await this.client.auth.getUser();

      if (error) {
        this.logger.warn('Email verification failed', {
          error: error.message,
          responseTime: Date.now() - startTime,
        });

        // Check if it's a token-related error
        if (error.message.includes('token') || error.message.includes('expired')) {
          throw new SupabaseAdapterError(
            'Verification token is invalid or has expired. Please request a new verification email.',
            'INVALID_OR_EXPIRED_TOKEN'
          );
        }

        throw mapSupabaseErrorToApiError(error);
      }

      if (!user) {
        throw new SupabaseAdapterError('No user found for verification token', 'NO_USER_FOUND');
      }

      // Check if email is verified
      const isVerified = user.email_confirmed_at !== null;

      if (!isVerified) {
        throw new SupabaseAdapterError(
          'Email verification is still pending. Please check your email and click the verification link.',
          'VERIFICATION_PENDING'
        );
      }

      const responseTime = Date.now() - startTime;
      this.logger.info('Email verification successful', {
        userId: user.id,
        email: user.email,
        verifiedAt: user.email_confirmed_at,
        responseTime,
      });

      return {
        message: 'Email has been verified successfully. You can now access all features.',
        success: true,
        user: {
          id: user.id,
          email: user.email || '',
          email_verified: true,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      if (error instanceof AuthError) {
        this.logger.warn('Supabase email verification error', {
          error: error.message,
          responseTime,
        });
        throw mapSupabaseErrorToApiError(error);
      }

      if ((error as any).name === 'ExtendedApiError' || (error as any).status) {
        // Already a mapped error, re-throw
        throw error;
      }

      this.logger.error('Unexpected email verification error', {
        error: error instanceof Error ? error.message : String(error),
        responseTime,
      });

      throw mapGenericErrorToApiError(
        error instanceof Error ? error : new Error(String(error)),
        'verifyEmail'
      );
    }
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(
    request: ResendVerificationEmailRequest
  ): Promise<ResendVerificationEmailResponse> {
    const startTime = Date.now();

    this.logger.debug('Resending verification email', {
      email: request.email,
      type: request.type,
    });

    try {
      // Validate email format
      if (!request.email || !this.isValidEmail(request.email)) {
        throw new SupabaseAdapterError('Please provide a valid email address', 'INVALID_EMAIL');
      }

      // Use Supabase's resend functionality
      const { error } = await this.client.auth.resend({
        type: request.type === 'email_change' ? 'email_change' : 'signup',
        email: request.email,
      });

      if (error) {
        this.logger.warn('Failed to resend verification email', {
          email: request.email,
          error: error.message,
          responseTime: Date.now() - startTime,
        });

        // Handle specific Supabase errors
        if (error.message.includes('already confirmed')) {
          throw new SupabaseAdapterError(
            'This email address is already verified. No verification email is needed.',
            'EMAIL_ALREADY_VERIFIED'
          );
        }

        if (error.message.includes('too many requests')) {
          throw new SupabaseAdapterError(
            'Too many verification emails sent. Please wait a few minutes before requesting another.',
            'RATE_LIMITED'
          );
        }

        throw mapSupabaseErrorToApiError(error);
      }

      const responseTime = Date.now() - startTime;
      this.logger.info('Verification email resent successfully', {
        email: request.email,
        type: request.type,
        responseTime,
      });

      return {
        message:
          'A new verification email has been sent. Please check your inbox and click the verification link.',
        success: true,
        email: request.email,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      if (error instanceof AuthError) {
        this.logger.warn('Supabase resend verification error', {
          email: request.email,
          error: error.message,
          responseTime,
        });
        throw mapSupabaseErrorToApiError(error);
      }

      if ((error as any).name === 'ExtendedApiError' || (error as any).status) {
        // Already a mapped error, re-throw
        throw error;
      }

      this.logger.error('Unexpected resend verification error', {
        email: request.email,
        error: error instanceof Error ? error.message : String(error),
        responseTime,
      });

      throw mapGenericErrorToApiError(
        error instanceof Error ? error : new Error(String(error)),
        'resendVerificationEmail'
      );
    }
  }

  /**
   * Check email verification status
   */
  async getEmailVerificationStatus(
    request: EmailVerificationStatusRequest
  ): Promise<EmailVerificationStatusResponse> {
    const startTime = Date.now();

    this.logger.debug('Checking email verification status', {
      hasUserId: !!request.userId,
      hasEmail: !!request.email,
    });

    try {
      let user;

      if (request.userId || request.email) {
        // If specific user ID or email provided, we need to get that user
        // For now, we'll get the current authenticated user
        const {
          data: { user: currentUser },
          error,
        } = await this.client.auth.getUser();

        if (error) {
          throw mapSupabaseErrorToApiError(error);
        }

        user = currentUser;
      } else {
        // Get current authenticated user
        const {
          data: { user: currentUser },
          error,
        } = await this.client.auth.getUser();

        if (error) {
          throw mapSupabaseErrorToApiError(error);
        }

        user = currentUser;
      }

      if (!user) {
        throw new SupabaseAdapterError('No authenticated user found', 'NO_USER_FOUND');
      }

      // Filter by email if specified
      if (request.email && user.email !== request.email) {
        throw new SupabaseAdapterError('Email does not match authenticated user', 'EMAIL_MISMATCH');
      }

      const isVerified = user.email_confirmed_at !== null;
      const verifiedAt = user.email_confirmed_at;

      // Calculate if user can resend (simple time-based check)
      const lastSentAt = user.created_at; // Approximate last sent time
      const canResend =
        !isVerified && (!lastSentAt || Date.now() - new Date(lastSentAt).getTime() > 60000); // 1 minute cooldown

      const responseTime = Date.now() - startTime;
      this.logger.debug('Email verification status retrieved', {
        userId: user.id,
        email: user.email,
        isVerified,
        responseTime,
      });

      return {
        isVerified,
        email: user.email || '',
        verifiedAt: verifiedAt || undefined,
        needsVerification: !isVerified,
        canResend,
        lastSentAt: lastSentAt || undefined,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      if (error instanceof AuthError) {
        this.logger.warn('Supabase verification status error', {
          error: error.message,
          responseTime,
        });
        throw mapSupabaseErrorToApiError(error);
      }

      if ((error as any).name === 'ExtendedApiError' || (error as any).status) {
        // Already a mapped error, re-throw
        throw error;
      }

      this.logger.error('Unexpected verification status error', {
        error: error instanceof Error ? error.message : String(error),
        responseTime,
      });

      throw mapGenericErrorToApiError(
        error instanceof Error ? error : new Error(String(error)),
        'getEmailVerificationStatus'
      );
    }
  }

  /**
   * Change user email address (requires verification)
   */
  async changeEmail(request: EmailChangeRequest): Promise<EmailChangeResponse> {
    const startTime = Date.now();

    this.logger.debug('Changing user email', {
      newEmail: request.newEmail,
      hasCurrentPassword: !!request.currentPassword,
    });

    try {
      // Validate new email format
      if (!request.newEmail || !this.isValidEmail(request.newEmail)) {
        throw new SupabaseAdapterError('Please provide a valid email address', 'INVALID_EMAIL');
      }

      // If current password is provided, verify it first
      if (request.currentPassword) {
        const {
          data: { user },
        } = await this.client.auth.getUser();
        if (!user) {
          throw new SupabaseAdapterError('No authenticated user found', 'NO_USER_FOUND');
        }

        // Verify current password
        const { error: verifyError } = await this.client.auth.signInWithPassword({
          email: user.email!,
          password: request.currentPassword,
        });

        if (verifyError) {
          throw new SupabaseAdapterError(
            'Current password is incorrect',
            'INVALID_CURRENT_PASSWORD'
          );
        }
      }

      // Update email - this will trigger verification for the new email
      const { error } = await this.client.auth.updateUser({
        email: request.newEmail,
      });

      if (error) {
        this.logger.warn('Email change failed', {
          newEmail: request.newEmail,
          error: error.message,
          responseTime: Date.now() - startTime,
        });

        if (error.message.includes('already registered')) {
          throw new SupabaseAdapterError(
            'This email address is already registered to another account',
            'EMAIL_ALREADY_EXISTS'
          );
        }

        throw mapSupabaseErrorToApiError(error);
      }

      const responseTime = Date.now() - startTime;
      this.logger.info('Email change initiated successfully', {
        newEmail: request.newEmail,
        responseTime,
      });

      return {
        message:
          'Email change initiated. Please check your new email address for a verification link.',
        success: true,
        newEmail: request.newEmail,
        requiresVerification: true,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      if (error instanceof AuthError) {
        this.logger.warn('Supabase email change error', {
          newEmail: request.newEmail,
          error: error.message,
          responseTime,
        });
        throw mapSupabaseErrorToApiError(error);
      }

      if ((error as any).name === 'ExtendedApiError' || (error as any).status) {
        // Already a mapped error, re-throw
        throw error;
      }

      this.logger.error('Unexpected email change error', {
        newEmail: request.newEmail,
        error: error instanceof Error ? error.message : String(error),
        responseTime,
      });

      throw mapGenericErrorToApiError(
        error instanceof Error ? error : new Error(String(error)),
        'changeEmail'
      );
    }
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Type guard for EnhancedApiError
   */
  private isEnhancedApiError(error: unknown): error is EnhancedApiError {
    return (
      error !== null &&
      typeof error === 'object' &&
      'errorType' in error &&
      'severity' in error &&
      'retryable' in error
    );
  }

  /**
   * Execute operation with retry logic and circuit breaker protection
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    fallbackOperations?: FallbackOperation<T>[]
  ): Promise<T> {
    return this.circuitBreaker.execute(
      () => this.retryHandler.executeWithRetry(operation, operationName),
      operationName,
      { fallbackOperations }
    );
  }

  /**
   * Get error mapper instance
   */
  getErrorMapper(): SupabaseErrorMapper {
    return this.errorMapper;
  }

  /**
   * Get retry handler instance
   */
  getRetryHandler(): AuthRetryHandler {
    return this.retryHandler;
  }

  /**
   * Get circuit breaker instance
   */
  getCircuitBreaker(): CircuitBreaker {
    return this.circuitBreaker;
  }

  /**
   * Register fallback operations for specific operations
   */
  registerFallbackOperation<T>(operationName: string, fallback: FallbackOperation<T>): void {
    this.circuitBreaker.registerFallback(operationName, fallback);
  }

  /**
   * Get performance metrics for monitoring
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return this.performanceCache.getMetrics();
  }

  /**
   * Reset performance metrics
   */
  resetPerformanceMetrics(): void {
    this.performanceCache.resetMetrics();
  }

  /**
   * Get performance cache instance
   */
  getPerformanceCache(): PerformanceCache {
    return this.performanceCache;
  }

  /**
   * Get analytics monitor instance
   */
  getAnalyticsMonitor(): AnalyticsMonitor {
    return this.analyticsMonitor;
  }

  /**
   * Get system health metrics
   */
  getSystemHealthMetrics() {
    return this.analyticsMonitor.getSystemHealth();
  }

  /**
   * Get error reports for troubleshooting
   */
  getErrorReports(options?: {
    severity?: ErrorSeverity;
    resolved?: boolean;
    limit?: number;
    since?: number;
  }) {
    return this.analyticsMonitor.getErrorReports(options);
  }

  /**
   * Get user debug information for troubleshooting
   */
  getUserDebugInfo(userId: string) {
    return this.analyticsMonitor.getUserDebugInfo(userId);
  }

  /**
   * Export analytics data for external analysis
   */
  exportAnalyticsData(options?: {
    since?: number;
    includeEvents?: boolean;
    includeErrors?: boolean;
    includePerformance?: boolean;
  }) {
    return this.analyticsMonitor.exportAnalyticsData(options);
  }

  /**
   * Get user agent string
   */
  private getUserAgent(): string {
    return (typeof navigator !== 'undefined' && navigator.userAgent) || 'Server/Node.js';
  }

  /**
   * Get current session ID
   */
  private getCurrentSessionId(): string | undefined {
    // This would typically be provided by the session manager
    // For now, we'll generate a simple session identifier
    return `session_${Date.now()}`;
  }
}

/**
 * Supabase adapter specific error class
 */
export class SupabaseAdapterError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: Error | AuthError
  ) {
    super(message);
    this.name = 'SupabaseAdapterError';
  }
}

/**
 * Adapter logger for consistent logging
 */
class AdapterLogger {
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
 * Health status interface
 */
export interface AdapterHealthStatus {
  isHealthy: boolean;
  status: 'ready' | 'initializing' | 'error';
  checks: {
    clientInitialized: boolean;
    configurationValid: boolean;
    connectionReady: boolean;
  };
  error?: string;
  timestamp: string;
  version: string;
}

/**
 * Connection test result interface
 */
export interface ConnectionTestResult {
  success: boolean;
  error?: string;
  responseTime: number;
  timestamp: string;
  sessionExists?: boolean;
}

/**
 * Adapter factory function
 */
export function createSupabaseAdapter(
  configManager?: ConfigurationManager,
  retryConfig?: Partial<RetryConfig>,
  circuitBreakerConfig?: Partial<CircuitBreakerConfig>,
  cacheConfig?: Partial<CacheConfig>,
  analyticsConfig?: Partial<AnalyticsConfig>
): SupabaseAdapter {
  return new SupabaseAdapter(
    configManager,
    retryConfig,
    circuitBreakerConfig,
    cacheConfig,
    analyticsConfig
  );
}

/**
 * Default adapter instance (singleton)
 */
let defaultAdapter: SupabaseAdapter | null = null;

export function getSupabaseAdapter(
  configManager?: ConfigurationManager,
  retryConfig?: Partial<RetryConfig>,
  circuitBreakerConfig?: Partial<CircuitBreakerConfig>,
  cacheConfig?: Partial<CacheConfig>,
  analyticsConfig?: Partial<AnalyticsConfig>
): SupabaseAdapter {
  if (!defaultAdapter) {
    defaultAdapter = createSupabaseAdapter(
      configManager,
      retryConfig,
      circuitBreakerConfig,
      cacheConfig,
      analyticsConfig
    );
  }
  return defaultAdapter;
}

/**
 * Reset adapter instance (useful for testing)
 */
export function resetSupabaseAdapter(): void {
  defaultAdapter = null;
}
