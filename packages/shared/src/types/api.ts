export interface ApiResponse<T> {
  data: T;
  message?: string;
  error?: string;
  status: number;
  success: boolean;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Authentication-specific types
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  role?: string;
  metadata?: Record<string, unknown>;
  // Backward compatibility fields
  banned_until?: string | null;
  last_sign_in_at?: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface SignupData {
  email: string;
  password: string;
  name: string;
  confirmPassword?: string;
  termsAccepted?: boolean;
  newsletterOptIn?: boolean;
}

export interface AuthResponse {
  success: boolean;
  user?: AuthUser;
  tokens?: AuthTokens;
  session?: AuthSession;
  message?: string;
  error?: AuthError;
}

export interface AuthSession {
  id: string;
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  createdAt: string;
  lastActivityAt: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthError {
  code: string;
  message: string;
  field?: string;
  details?: Record<string, unknown>;
  timestamp?: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetResponse {
  success: boolean;
  message: string;
  error?: AuthError;
}

export interface PasswordResetConfirm {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface EmailVerificationRequest {
  token: string;
}

export interface EmailVerificationResponse {
  success: boolean;
  message: string;
  user?: AuthUser;
  error?: AuthError;
}

export interface SessionValidation {
  isValid: boolean;
  user?: AuthUser;
  session?: AuthSession;
  error?: AuthError;
  expiresAt?: number;
}

export interface TokenRefreshRequest {
  refreshToken: string;
}

export interface TokenRefreshResponse {
  success: boolean;
  tokens?: AuthTokens;
  error?: AuthError;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  session: AuthSession | null;
  error: AuthError | null;
  lastChecked?: number;
}

// Authentication validation schemas
export interface AuthValidationSchema {
  email: {
    required: boolean;
    pattern: RegExp;
    maxLength: number;
  };
  password: {
    required: boolean;
    minLength: number;
    maxLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSymbols: boolean;
    forbiddenPatterns: RegExp[];
  };
  name: {
    required: boolean;
    minLength: number;
    maxLength: number;
    pattern: RegExp;
  };
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings?: string[];
}

export interface ValidationError {
  field: string;
  code: string;
  message: string;
  value?: Record<string, unknown>;
}

// Authentication provider types
export type AuthProvider = 'email' | 'google' | 'github' | 'apple' | 'facebook';

export interface AuthProviderConfig {
  provider: AuthProvider;
  enabled: boolean;
  clientId?: string;
  clientSecret?: string;
  redirectUrl?: string;
  scopes?: string[];
}

export interface SocialAuthRequest {
  provider: AuthProvider;
  code?: string;
  state?: string;
  redirectUrl?: string;
}

export interface SocialAuthResponse {
  success: boolean;
  user?: AuthUser;
  tokens?: AuthTokens;
  isNewUser?: boolean;
  error?: AuthError;
}

// Security and audit types
export interface SecuritySettings {
  twoFactorEnabled: boolean;
  sessionTimeout: number;
  allowedIpRanges?: string[];
  requireEmailVerification: boolean;
  passwordPolicy: AuthValidationSchema['password'];
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface LoginAttempt {
  id: string;
  email: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  timestamp: string;
  error?: string;
  blockedUntil?: string;
}

// Rate limiting types
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: number;
  blocked: boolean;
}

export interface RateLimitResponse {
  allowed: boolean;
  rateLimit: RateLimitInfo;
  error?: AuthError;
}

// Permission and role types
export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];
  createdAt: string;
  updatedAt: string;
}

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  description?: string;
}

export interface UserRole {
  userId: string;
  roleId: string;
  assignedAt: string;
  assignedBy: string;
  expiresAt?: string;
}
