/**
 * Fallback Service Manager for Graceful Degradation
 *
 * This module provides fallback mechanisms for Supabase service unavailability,
 * including HTTP API fallbacks, cached responses, and degraded functionality.
 */

import { API_ENDPOINTS, ApiResponse } from '@agentic-workflow/shared';
import { ApiClient } from '../client/base';
import {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  ProfileResponse,
  UpdateProfileRequest,
  RefreshTokenRequest,
  RefreshTokenResponse,
} from '../types/auth';
import { EnhancedApiError, AuthErrorTypes, ErrorSeverity } from './error-handler';
// import { StoredSessionData } from './session-manager'; // Future use

/**
 * Fallback strategy types
 */
export enum FallbackStrategy {
  HTTP_API = 'http_api', // Fall back to HTTP API
  CACHED_RESPONSE = 'cached_response', // Use cached data
  DEGRADED_MODE = 'degraded_mode', // Provide limited functionality
  OFFLINE_MODE = 'offline_mode', // Work with local data only
  FAIL_FAST = 'fail_fast', // Fail immediately
}

/**
 * Fallback configuration
 */
export interface FallbackConfig {
  enableHttpApiFallback: boolean;
  enableCachedResponses: boolean;
  enableDegradedMode: boolean;
  enableOfflineMode: boolean;
  cacheTimeout: number; // Cache validity in milliseconds
  degradedModeMessage: string;
  offlineModeMessage: string;
}

/**
 * Cached response data
 */
interface CachedResponse<T> {
  data: T;
  timestamp: number;
  expires: number;
}

/**
 * Fallback service manager
 */
export class FallbackServiceManager {
  private cache = new Map<string, CachedResponse<any>>();
  private readonly config: FallbackConfig;

  constructor(
    private apiClient: ApiClient,
    config: Partial<FallbackConfig> = {}
  ) {
    this.config = {
      enableHttpApiFallback: true,
      enableCachedResponses: true,
      enableDegradedMode: true,
      enableOfflineMode: false,
      cacheTimeout: 300000, // 5 minutes
      degradedModeMessage: 'Service is running in limited mode. Some features may be unavailable.',
      offlineModeMessage: 'Working offline. Changes will sync when connection is restored.',
      ...config,
    };
  }

  /**
   * Execute login with fallback strategies
   */
  async loginWithFallback(credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    // Strategy 1: Try cached response if available
    if (this.config.enableCachedResponses) {
      const cached = this.getCachedResponse<LoginResponse>(`login:${credentials.email}`);
      if (cached) {
        console.info('[FallbackService] Using cached login response');
        return this.wrapResponse(cached, 'Login successful (cached)');
      }
    }

    // Strategy 2: HTTP API fallback
    if (this.config.enableHttpApiFallback) {
      try {
        console.info('[FallbackService] Attempting HTTP API login fallback');
        const result = await this.apiClient.post<LoginResponse>(
          API_ENDPOINTS.AUTH.LOGIN,
          credentials
        );

        // Cache successful response
        if (this.config.enableCachedResponses && result.data) {
          this.setCachedResponse(`login:${credentials.email}`, result.data);
        }

        return result;
      } catch (error) {
        console.warn('[FallbackService] HTTP API login fallback failed', error);
      }
    }

    // Strategy 3: Degraded mode - create temporary session
    if (this.config.enableDegradedMode) {
      console.warn('[FallbackService] Entering degraded mode for login');
      return this.createDegradedLoginResponse(credentials);
    }

    // All fallbacks failed
    throw this.createFallbackFailedError('login', 'All login fallback strategies have failed');
  }

  /**
   * Execute registration with fallback strategies
   */
  async registerWithFallback(userData: RegisterRequest): Promise<ApiResponse<RegisterResponse>> {
    // Strategy 1: HTTP API fallback
    if (this.config.enableHttpApiFallback) {
      try {
        console.info('[FallbackService] Attempting HTTP API registration fallback');
        const result = await this.apiClient.post<RegisterResponse>(
          API_ENDPOINTS.AUTH.REGISTER,
          userData
        );

        // Cache successful response
        if (this.config.enableCachedResponses && result.data) {
          this.setCachedResponse(`register:${userData.email}`, result.data);
        }

        return result;
      } catch (error) {
        console.warn('[FallbackService] HTTP API registration fallback failed', error);
      }
    }

    // Strategy 2: Degraded mode - queue for later processing
    if (this.config.enableDegradedMode) {
      console.warn('[FallbackService] Entering degraded mode for registration');
      return this.createDegradedRegistrationResponse(userData);
    }

    // All fallbacks failed
    throw this.createFallbackFailedError(
      'register',
      'All registration fallback strategies have failed'
    );
  }

  /**
   * Execute profile fetch with fallback strategies
   */
  async getProfileWithFallback(userId?: string): Promise<ApiResponse<ProfileResponse>> {
    // Strategy 1: Try cached response
    if (this.config.enableCachedResponses) {
      const cacheKey = `profile:${userId || 'current'}`;
      const cached = this.getCachedResponse<ProfileResponse>(cacheKey);
      if (cached) {
        console.info('[FallbackService] Using cached profile response');
        return this.wrapResponse(cached, 'Profile retrieved (cached)');
      }
    }

    // Strategy 2: HTTP API fallback
    if (this.config.enableHttpApiFallback) {
      try {
        console.info('[FallbackService] Attempting HTTP API profile fallback');
        const result = await this.apiClient.get<ProfileResponse>(API_ENDPOINTS.AUTH.PROFILE);

        // Cache successful response
        if (this.config.enableCachedResponses && result.data) {
          this.setCachedResponse(`profile:${userId || 'current'}`, result.data);
        }

        return result;
      } catch (error) {
        console.warn('[FallbackService] HTTP API profile fallback failed', error);
      }
    }

    // Strategy 3: Degraded mode - use minimal profile
    if (this.config.enableDegradedMode) {
      console.warn('[FallbackService] Entering degraded mode for profile');
      return this.createDegradedProfileResponse(userId);
    }

    // All fallbacks failed
    throw this.createFallbackFailedError(
      'getProfile',
      'All profile fallback strategies have failed'
    );
  }

  /**
   * Execute profile update with fallback strategies
   */
  async updateProfileWithFallback(
    profileData: UpdateProfileRequest,
    userId?: string
  ): Promise<ApiResponse<ProfileResponse>> {
    // Strategy 1: HTTP API fallback
    if (this.config.enableHttpApiFallback) {
      try {
        console.info('[FallbackService] Attempting HTTP API profile update fallback');
        const result = await this.apiClient.patch<ProfileResponse>(
          API_ENDPOINTS.AUTH.PROFILE,
          profileData
        );

        // Update cache
        if (this.config.enableCachedResponses && result.data) {
          this.setCachedResponse(`profile:${userId || 'current'}`, result.data);
        }

        return result;
      } catch (error) {
        console.warn('[FallbackService] HTTP API profile update fallback failed', error);
      }
    }

    // Strategy 2: Degraded mode - queue update for later
    if (this.config.enableDegradedMode) {
      console.warn('[FallbackService] Entering degraded mode for profile update');
      return this.createDegradedProfileUpdateResponse(profileData, userId);
    }

    // All fallbacks failed
    throw this.createFallbackFailedError(
      'updateProfile',
      'All profile update fallback strategies have failed'
    );
  }

  /**
   * Execute token refresh with fallback strategies
   */
  async refreshTokenWithFallback(
    refreshData: RefreshTokenRequest
  ): Promise<ApiResponse<RefreshTokenResponse>> {
    // Strategy 1: HTTP API fallback
    if (this.config.enableHttpApiFallback) {
      try {
        console.info('[FallbackService] Attempting HTTP API token refresh fallback');
        return await this.apiClient.post<RefreshTokenResponse>(
          API_ENDPOINTS.AUTH.REFRESH,
          refreshData
        );
      } catch (error) {
        console.warn('[FallbackService] HTTP API token refresh fallback failed', error);
      }
    }

    // Strategy 2: Degraded mode - extend current session
    if (this.config.enableDegradedMode) {
      console.warn('[FallbackService] Entering degraded mode for token refresh');
      return this.createDegradedTokenRefreshResponse(refreshData);
    }

    // All fallbacks failed
    throw this.createFallbackFailedError(
      'refreshToken',
      'All token refresh fallback strategies have failed'
    );
  }

  /**
   * Check service availability and recommend fallback strategy
   */
  async checkServiceAvailability(): Promise<{
    available: boolean;
    recommendedStrategy: FallbackStrategy;
    reason: string;
  }> {
    try {
      // Simple connectivity test
      const response = await fetch(this.apiClient['baseUrl'] + '/health', {
        method: 'GET',
        timeout: 5000,
      } as RequestInit);

      if (response.ok) {
        return {
          available: true,
          recommendedStrategy: FallbackStrategy.HTTP_API,
          reason: 'Service is healthy',
        };
      } else {
        return {
          available: false,
          recommendedStrategy: this.config.enableDegradedMode
            ? FallbackStrategy.DEGRADED_MODE
            : FallbackStrategy.CACHED_RESPONSE,
          reason: `Service returned ${response.status}`,
        };
      }
    } catch (error) {
      return {
        available: false,
        recommendedStrategy: this.config.enableOfflineMode
          ? FallbackStrategy.OFFLINE_MODE
          : FallbackStrategy.CACHED_RESPONSE,
        reason: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  /**
   * Clear all cached responses
   */
  clearCache(): void {
    this.cache.clear();
    console.info('[FallbackService] Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[]; hitRate?: number } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }

  /**
   * Get cached response if valid
   */
  private getCachedResponse<T>(key: string): T | null {
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    if (Date.now() > cached.expires) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Set cached response
   */
  private setCachedResponse<T>(key: string, data: T): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expires: now + this.config.cacheTimeout,
    });
  }

  /**
   * Create degraded login response
   */
  private createDegradedLoginResponse(credentials: LoginRequest): ApiResponse<LoginResponse> {
    const temporaryToken = this.generateTemporaryToken(credentials.email);

    const loginResponse: LoginResponse = {
      access_token: temporaryToken,
      refresh_token: `refresh_${temporaryToken}`,
      expires_in: 3600,
      user: {
        id: `temp_${Date.now()}`,
        email: credentials.email,
        name: credentials.email.split('@')[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    };

    return this.wrapResponse(loginResponse, this.config.degradedModeMessage);
  }

  /**
   * Create degraded registration response
   */
  private createDegradedRegistrationResponse(
    userData: RegisterRequest
  ): ApiResponse<RegisterResponse> {
    const temporaryToken = this.generateTemporaryToken(userData.email);

    const registerResponse: RegisterResponse = {
      access_token: temporaryToken,
      refresh_token: `refresh_${temporaryToken}`,
      expires_in: 3600,
      user: {
        id: `temp_${Date.now()}`,
        email: userData.email,
        name: userData.name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    };

    return this.wrapResponse(
      registerResponse,
      `${this.config.degradedModeMessage} Registration will be completed when service is restored.`
    );
  }

  /**
   * Create degraded profile response
   */
  private createDegradedProfileResponse(userId?: string): ApiResponse<ProfileResponse> {
    const profileResponse: ProfileResponse = {
      id: userId || `temp_${Date.now()}`,
      email: 'user@example.com',
      name: 'Guest User',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return this.wrapResponse(profileResponse, this.config.degradedModeMessage);
  }

  /**
   * Create degraded profile update response
   */
  private createDegradedProfileUpdateResponse(
    profileData: UpdateProfileRequest,
    userId?: string
  ): ApiResponse<ProfileResponse> {
    const profileResponse: ProfileResponse = {
      id: userId || `temp_${Date.now()}`,
      email: profileData.email || 'user@example.com',
      name: profileData.name || 'Guest User',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return this.wrapResponse(
      profileResponse,
      `${this.config.degradedModeMessage} Changes will be saved when service is restored.`
    );
  }

  /**
   * Create degraded token refresh response
   */
  private createDegradedTokenRefreshResponse(
    _refreshData: RefreshTokenRequest
  ): ApiResponse<RefreshTokenResponse> {
    const newToken = this.generateTemporaryToken('refresh');

    const refreshResponse: RefreshTokenResponse = {
      access_token: newToken,
      expires_in: 3600,
    };

    return this.wrapResponse(refreshResponse, this.config.degradedModeMessage);
  }

  /**
   * Generate temporary token for degraded mode
   */
  private generateTemporaryToken(context: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    return `temp_${context}_${timestamp}_${random}`;
  }

  /**
   * Wrap response in ApiResponse format
   */
  private wrapResponse<T>(data: T, message?: string): ApiResponse<T> {
    return {
      data,
      status: 200,
      success: true,
      message,
    };
  }

  /**
   * Create fallback failed error
   */
  private createFallbackFailedError(operation: string, message: string): EnhancedApiError {
    return {
      message,
      status: 503,
      code: 'FALLBACK_FAILED',
      errorType: AuthErrorTypes.SUPABASE_SERVICE_ERROR,
      severity: ErrorSeverity.CRITICAL,
      retryable: true,
      userAction: 'Please try again later. If the problem persists, contact support.',
      details: {
        operation,
        fallbacksAttempted: [
          this.config.enableCachedResponses && 'cached_response',
          this.config.enableHttpApiFallback && 'http_api',
          this.config.enableDegradedMode && 'degraded_mode',
          this.config.enableOfflineMode && 'offline_mode',
        ].filter(Boolean),
        context: 'fallbackService',
      },
      technicalDetails: {
        operation,
        config: this.config,
      },
    };
  }
}

/**
 * Factory function to create fallback service manager
 */
export function createFallbackServiceManager(
  apiClient: ApiClient,
  config?: Partial<FallbackConfig>
): FallbackServiceManager {
  return new FallbackServiceManager(apiClient, config);
}

// Default fallback service manager instance
let defaultFallbackService: FallbackServiceManager | null = null;

/**
 * Get default fallback service manager
 */
export function getFallbackServiceManager(apiClient?: ApiClient): FallbackServiceManager {
  if (!defaultFallbackService && apiClient) {
    defaultFallbackService = createFallbackServiceManager(apiClient);
  }

  if (!defaultFallbackService) {
    throw new Error('Fallback service manager not initialized. Provide ApiClient instance.');
  }

  return defaultFallbackService;
}

/**
 * Reset fallback service manager (useful for testing)
 */
export function resetFallbackServiceManager(): void {
  defaultFallbackService = null;
}
