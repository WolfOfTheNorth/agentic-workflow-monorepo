export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: {
    id: string;
    email: string;
    name: string;
    created_at: string;
    updated_at: string;
  };
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export type RegisterResponse = LoginResponse;

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface RefreshTokenResponse {
  access_token: string;
  expires_in: number;
}

export interface ProfileResponse {
  id: string;
  email: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface UpdateProfileRequest {
  name?: string;
  email?: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  message: string;
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  new_password: string;
}

export interface ResetPasswordResponse {
  message: string;
  success: boolean;
}

export interface UpdatePasswordRequest {
  new_password: string;
  current_password?: string; // Optional for admin updates
}

export interface UpdatePasswordResponse {
  message: string;
  success: boolean;
}

export interface PasswordStrengthResult {
  isValid: boolean;
  score: number; // 0-4 scale
  feedback: string[];
  requirements: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumbers: boolean;
    hasSpecialChars: boolean;
    notCommon: boolean;
  };
}

export interface VerifyEmailRequest {
  token: string;
  type?: 'signup' | 'email_change' | 'recovery';
}

export interface VerifyEmailResponse {
  message: string;
  success: boolean;
  user?: {
    id: string;
    email: string;
    email_verified: boolean;
  };
}

export interface ResendVerificationEmailRequest {
  email: string;
  type?: 'signup' | 'email_change';
}

export interface ResendVerificationEmailResponse {
  message: string;
  success: boolean;
  email: string;
}

export interface EmailVerificationStatusRequest {
  userId?: string;
  email?: string;
}

export interface EmailVerificationStatusResponse {
  isVerified: boolean;
  email: string;
  verifiedAt?: string;
  needsVerification: boolean;
  canResend: boolean;
  lastSentAt?: string;
}

export interface EmailChangeRequest {
  newEmail: string;
  currentPassword?: string; // For additional security
}

export interface EmailChangeResponse {
  message: string;
  success: boolean;
  newEmail: string;
  requiresVerification: boolean;
}
