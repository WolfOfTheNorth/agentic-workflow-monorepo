import { API_ENDPOINTS, ApiResponse } from '@agentic-workflow/shared';
import { ApiClient } from './base';
import { SupabaseAdapter, getSupabaseAdapter } from '../adapters/supabase';
import {
  SessionManager,
  getSessionManager,
  SessionEventCallbacks,
  SessionManagerConfig,
  StoredSessionData,
} from '../adapters/session-manager';
import {
  FallbackServiceManager,
  createFallbackServiceManager,
  FallbackConfig,
} from '../adapters/fallback-service';
import {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  ProfileResponse,
  UpdateProfileRequest,
  ChangePasswordRequest,
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

export class AuthApiClient {
  private supabaseAdapter?: SupabaseAdapter;
  private sessionManager?: SessionManager;
  private fallbackService: FallbackServiceManager;

  constructor(
    private apiClient: ApiClient,
    supabaseAdapter?: SupabaseAdapter,
    sessionManagerConfig?: Partial<SessionManagerConfig>,
    fallbackConfig?: Partial<FallbackConfig>
  ) {
    // Use provided SupabaseAdapter or get singleton instance
    this.supabaseAdapter = supabaseAdapter || getSupabaseAdapter();

    // Initialize SessionManager if SupabaseAdapter is available
    if (this.supabaseAdapter) {
      this.setupSessionManager(sessionManagerConfig);
    }

    // Initialize fallback service
    this.fallbackService = createFallbackServiceManager(this.apiClient, fallbackConfig);
  }

  /**
   * Set up session manager with callbacks
   */
  private setupSessionManager(config?: Partial<SessionManagerConfig>): void {
    if (!this.supabaseAdapter) {
      return;
    }

    const callbacks: SessionEventCallbacks = {
      onSessionRestored: (session: StoredSessionData) => {
        // Update API client with restored token
        this.apiClient.setAuthToken(session.access_token);
      },
      onSessionRefreshed: (session: StoredSessionData) => {
        // Update API client with refreshed token
        this.apiClient.setAuthToken(session.access_token);
      },
      onSessionExpired: () => {
        // Clear token from API client when session expires
        this.apiClient.setAuthToken(null);
      },
      onSessionCleared: () => {
        // Clear token from API client when session is cleared
        this.apiClient.setAuthToken(null);
      },
    };

    // Create or get SessionManager instance
    this.sessionManager = getSessionManager(this.supabaseAdapter, config, callbacks);

    // Start session monitoring and attempt to restore existing session
    this.sessionManager.startSessionMonitoring();
  }

  /**
   * Check if Supabase integration is enabled
   */
  private isSupabaseEnabled(): boolean {
    return !!this.supabaseAdapter;
  }

  /**
   * Get current session manager instance
   */
  getSessionManager(): SessionManager | undefined {
    return this.sessionManager;
  }

  /**
   * Check if there's an active valid session
   */
  hasValidSession(): boolean {
    return this.sessionManager?.hasValidSession() || false;
  }

  /**
   * Get current session data
   */
  getCurrentSession(): StoredSessionData | null {
    return this.sessionManager?.getCurrentSession() || null;
  }

  /**
   * Transform adapter result to API response format
   */
  private wrapResponse<T>(data: T, message?: string): ApiResponse<T> {
    return {
      data,
      status: 200,
      success: true,
      message,
    };
  }

  async login(credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    if (this.isSupabaseEnabled() && this.supabaseAdapter) {
      try {
        const result = await this.supabaseAdapter.authenticateUser(credentials);

        // Get the raw Supabase session for persistence
        const supabaseClient = this.supabaseAdapter.getClient();
        const { data: sessionData } = await supabaseClient.auth.getSession();

        if (sessionData.session && this.sessionManager) {
          // Persist session through SessionManager
          await this.sessionManager.persistSession(sessionData.session);
        } else {
          // Fallback: set token directly if session manager is not available
          this.apiClient.setAuthToken(result.access_token);
        }

        return this.wrapResponse(result, 'Login successful');
      } catch (error) {
        // If Supabase fails, try fallback mechanisms
        console.warn('[AuthApiClient] Supabase login failed, attempting fallback', error);
        return this.fallbackService.loginWithFallback(credentials);
      }
    }

    // Fallback to HTTP API if Supabase is not available
    return this.fallbackService.loginWithFallback(credentials);
  }

  async register(userData: RegisterRequest): Promise<ApiResponse<RegisterResponse>> {
    if (this.isSupabaseEnabled() && this.supabaseAdapter) {
      try {
        const result = await this.supabaseAdapter.registerUser(userData);

        // Update API client with new auth token if session was created
        if (result.access_token) {
          // Get the raw Supabase session for persistence
          const supabaseClient = this.supabaseAdapter.getClient();
          const { data: sessionData } = await supabaseClient.auth.getSession();

          if (sessionData.session && this.sessionManager) {
            // Persist session through SessionManager
            await this.sessionManager.persistSession(sessionData.session);
          } else {
            // Fallback: set token directly if session manager is not available
            this.apiClient.setAuthToken(result.access_token);
          }
        }

        return this.wrapResponse(result, 'Registration successful');
      } catch (error) {
        // If Supabase fails, try fallback mechanisms
        console.warn('[AuthApiClient] Supabase registration failed, attempting fallback', error);
        return this.fallbackService.registerWithFallback(userData);
      }
    }

    // Fallback to HTTP API if Supabase is not available
    return this.fallbackService.registerWithFallback(userData);
  }

  async logout(): Promise<ApiResponse<void>> {
    if (this.isSupabaseEnabled() && this.supabaseAdapter) {
      try {
        await this.supabaseAdapter.signOut();

        // Clear session through SessionManager (which will clear API client token via callback)
        if (this.sessionManager) {
          this.sessionManager.clearSession();
        } else {
          // Fallback: clear token directly if session manager is not available
          this.apiClient.setAuthToken(null);
        }

        return this.wrapResponse(undefined, 'Logout successful');
      } catch (error) {
        // Even if Supabase logout fails, clear local session
        if (this.sessionManager) {
          this.sessionManager.clearSession();
        } else {
          this.apiClient.setAuthToken(null);
        }
        throw error;
      }
    }

    // Fallback to HTTP API if Supabase is not available
    const result = await this.apiClient.post<void>(API_ENDPOINTS.AUTH.LOGOUT);
    this.apiClient.setAuthToken(null);
    return result;
  }

  async refreshToken(refreshData: RefreshTokenRequest): Promise<ApiResponse<RefreshTokenResponse>> {
    if (this.isSupabaseEnabled() && this.sessionManager) {
      // For Supabase integration, token refresh is handled automatically by SessionManager
      // This method can be used to force a manual refresh if needed
      const currentSession = this.sessionManager.getCurrentSession();
      if (currentSession) {
        // Return the current token data as a compatible response
        const refreshResponse: RefreshTokenResponse = {
          access_token: currentSession.access_token,
          expires_in: Math.floor((currentSession.expires_at - Date.now()) / 1000),
        };

        return this.wrapResponse(refreshResponse, 'Token refresh data retrieved');
      }

      throw new Error('No active session available for token refresh');
    }

    // Fallback to HTTP API if Supabase is not available
    return this.fallbackService.refreshTokenWithFallback(refreshData);
  }

  async getProfile(): Promise<ApiResponse<ProfileResponse>> {
    if (this.isSupabaseEnabled() && this.supabaseAdapter) {
      try {
        const result = await this.supabaseAdapter.getUserProfile();
        return this.wrapResponse(result, 'Profile retrieved successfully');
      } catch (error) {
        // If Supabase fails, try fallback mechanisms
        console.warn('[AuthApiClient] Supabase profile fetch failed, attempting fallback', error);
        return this.fallbackService.getProfileWithFallback();
      }
    }

    // Fallback to HTTP API if Supabase is not available
    return this.fallbackService.getProfileWithFallback();
  }

  async updateProfile(profileData: UpdateProfileRequest): Promise<ApiResponse<ProfileResponse>> {
    if (this.isSupabaseEnabled() && this.supabaseAdapter) {
      try {
        const result = await this.supabaseAdapter.updateUserProfile(profileData);
        return this.wrapResponse(result, 'Profile updated successfully');
      } catch (error) {
        // If Supabase fails, try fallback mechanisms
        console.warn('[AuthApiClient] Supabase profile update failed, attempting fallback', error);
        return this.fallbackService.updateProfileWithFallback(profileData);
      }
    }

    // Fallback to HTTP API if Supabase is not available
    return this.fallbackService.updateProfileWithFallback(profileData);
  }

  async changePassword(
    passwordData: ChangePasswordRequest
  ): Promise<ApiResponse<UpdatePasswordResponse>> {
    if (this.isSupabaseEnabled() && this.supabaseAdapter) {
      // Map ChangePasswordRequest to UpdatePasswordRequest
      const updateRequest: UpdatePasswordRequest = {
        new_password: passwordData.new_password,
        current_password: passwordData.current_password,
      };

      const result = await this.supabaseAdapter.updatePassword(updateRequest);
      return this.wrapResponse(result, 'Password changed successfully');
    }

    // Fallback to HTTP API if Supabase is not available
    return this.apiClient.post('/api/auth/change-password', passwordData);
  }

  async forgotPassword(email: string): Promise<ApiResponse<ForgotPasswordResponse>> {
    if (this.isSupabaseEnabled() && this.supabaseAdapter) {
      const request: ForgotPasswordRequest = { email };
      const result = await this.supabaseAdapter.forgotPassword(request);
      return this.wrapResponse(result, 'Password reset email sent');
    }

    // Fallback to HTTP API if Supabase is not available
    return this.apiClient.post('/api/auth/forgot-password', { email });
  }

  async resetPassword(
    token: string,
    newPassword: string
  ): Promise<ApiResponse<ResetPasswordResponse>> {
    if (this.isSupabaseEnabled() && this.supabaseAdapter) {
      const request: ResetPasswordRequest = {
        token,
        new_password: newPassword,
      };

      const result = await this.supabaseAdapter.resetPassword(request);
      return this.wrapResponse(result, 'Password reset successfully');
    }

    // Fallback to HTTP API if Supabase is not available
    return this.apiClient.post('/api/auth/reset-password', {
      token,
      new_password: newPassword,
    });
  }

  async verifyEmail(
    token: string,
    type?: 'signup' | 'email_change' | 'recovery'
  ): Promise<ApiResponse<VerifyEmailResponse>> {
    if (this.isSupabaseEnabled() && this.supabaseAdapter) {
      const request: VerifyEmailRequest = { token, type };
      const result = await this.supabaseAdapter.verifyEmail(request);
      return this.wrapResponse(result, 'Email verified successfully');
    }

    // Fallback to HTTP API if Supabase is not available
    return this.apiClient.post('/api/auth/verify-email', { token });
  }

  async resendVerificationEmail(
    email: string,
    type?: 'signup' | 'email_change'
  ): Promise<ApiResponse<ResendVerificationEmailResponse>> {
    if (this.isSupabaseEnabled() && this.supabaseAdapter) {
      const request: ResendVerificationEmailRequest = { email, type };
      const result = await this.supabaseAdapter.resendVerificationEmail(request);
      return this.wrapResponse(result, 'Verification email resent successfully');
    }

    // Fallback to HTTP API if Supabase is not available
    return this.apiClient.post('/api/auth/resend-verification');
  }

  /**
   * Get email verification status for the current user
   */
  async getEmailVerificationStatus(
    userId?: string,
    email?: string
  ): Promise<ApiResponse<EmailVerificationStatusResponse>> {
    if (this.isSupabaseEnabled() && this.supabaseAdapter) {
      const request: EmailVerificationStatusRequest = { userId, email };
      const result = await this.supabaseAdapter.getEmailVerificationStatus(request);
      return this.wrapResponse(result, 'Email verification status retrieved');
    }

    // Fallback: return basic status for HTTP API compatibility
    throw new Error('Email verification status not available without Supabase integration');
  }

  /**
   * Change user's email address (requires verification)
   */
  async changeEmail(
    newEmail: string,
    currentPassword?: string
  ): Promise<ApiResponse<EmailChangeResponse>> {
    if (this.isSupabaseEnabled() && this.supabaseAdapter) {
      const request: EmailChangeRequest = { newEmail, currentPassword };
      const result = await this.supabaseAdapter.changeEmail(request);
      return this.wrapResponse(result, 'Email change initiated');
    }

    // Fallback: use profile update for HTTP API
    await this.updateProfile({ email: newEmail });

    // Transform ProfileResponse to EmailChangeResponse for compatibility
    const emailChangeResult: EmailChangeResponse = {
      message: 'Email change initiated (via profile update)',
      success: true,
      newEmail,
      requiresVerification: false, // HTTP API may not require verification
    };

    return this.wrapResponse(emailChangeResult, 'Email change initiated');
  }

  /**
   * Initialize session restoration (useful for app startup)
   */
  async initializeSession(): Promise<boolean> {
    if (!this.sessionManager) {
      return false;
    }

    const restoreResult = this.sessionManager.restoreSession();
    return restoreResult.success;
  }

  /**
   * Stop session monitoring and cleanup
   * Should be called when the AuthApiClient is no longer needed
   */
  cleanup(): void {
    if (this.sessionManager) {
      this.sessionManager.stopSessionMonitoring();
    }
  }

  /**
   * Force a manual token refresh
   * This can be useful for testing or when you need to ensure the token is fresh
   */
  async forceTokenRefresh(): Promise<boolean> {
    if (!this.sessionManager || !this.sessionManager.hasValidSession()) {
      return false;
    }

    // Note: This would require exposing a manual refresh method in SessionManager
    // For now, the refresh is handled automatically by the SessionManager
    return this.sessionManager.hasValidSession();
  }

  /**
   * Get fallback service manager instance
   */
  getFallbackService(): FallbackServiceManager {
    return this.fallbackService;
  }

  /**
   * Check service availability and get recommended fallback strategy
   */
  async checkServiceHealth(): Promise<{
    available: boolean;
    recommendedStrategy: string;
    reason: string;
  }> {
    return this.fallbackService.checkServiceAvailability();
  }

  /**
   * Get circuit breaker statistics (if available)
   */
  getCircuitBreakerStats() {
    return this.supabaseAdapter?.getCircuitBreaker().getStats();
  }
}
