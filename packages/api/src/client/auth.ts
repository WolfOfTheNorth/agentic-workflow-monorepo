import { API_ENDPOINTS } from '@agentic-workflow/shared';
import { ApiClient } from './base';
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
} from '../types/auth';

export class AuthApiClient {
  constructor(private apiClient: ApiClient) {}

  async login(credentials: LoginRequest) {
    return this.apiClient.post<LoginResponse>(API_ENDPOINTS.AUTH.LOGIN, credentials);
  }

  async register(userData: RegisterRequest) {
    return this.apiClient.post<RegisterResponse>(API_ENDPOINTS.AUTH.REGISTER, userData);
  }

  async logout() {
    return this.apiClient.post(API_ENDPOINTS.AUTH.LOGOUT);
  }

  async refreshToken(refreshData: RefreshTokenRequest) {
    return this.apiClient.post<RefreshTokenResponse>(API_ENDPOINTS.AUTH.REFRESH, refreshData);
  }

  async getProfile() {
    return this.apiClient.get<ProfileResponse>(API_ENDPOINTS.AUTH.PROFILE);
  }

  async updateProfile(profileData: UpdateProfileRequest) {
    return this.apiClient.patch<ProfileResponse>(API_ENDPOINTS.AUTH.PROFILE, profileData);
  }

  async changePassword(passwordData: ChangePasswordRequest) {
    return this.apiClient.post('/api/auth/change-password', passwordData);
  }

  async forgotPassword(email: string) {
    return this.apiClient.post('/api/auth/forgot-password', { email });
  }

  async resetPassword(token: string, newPassword: string) {
    return this.apiClient.post('/api/auth/reset-password', {
      token,
      new_password: newPassword,
    });
  }

  async verifyEmail(token: string) {
    return this.apiClient.post('/api/auth/verify-email', { token });
  }

  async resendVerificationEmail() {
    return this.apiClient.post('/api/auth/resend-verification');
  }
}
