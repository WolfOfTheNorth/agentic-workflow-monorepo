/**
 * Data Transformation Utilities for Supabase Integration
 *
 * This module provides transformation functions to convert between
 * Supabase data structures and application-expected interfaces,
 * maintaining backward compatibility with existing API contracts.
 */

import { User, Session, AuthError } from '@supabase/supabase-js';
import { ApiError } from '@agentic-workflow/shared';
import {
  LoginResponse,
  RegisterResponse,
  ProfileResponse,
  RefreshTokenResponse,
} from '../types/auth';

/**
 * Transform Supabase User to ProfileResponse
 */
export function mapSupabaseUserToProfile(supabaseUser: User): ProfileResponse {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email ? supabaseUser.email : '',
    name: supabaseUser.user_metadata?.name || supabaseUser.user_metadata?.full_name || '',
    created_at: supabaseUser.created_at,
    updated_at: supabaseUser.updated_at || supabaseUser.created_at,
  };
}

/**
 * Transform Supabase Session to LoginResponse
 */
export function mapSupabaseSessionToLogin(session: Session): LoginResponse {
  if (!session.user) {
    throw new TransformationError('Invalid session: missing user data', 'MISSING_USER_DATA');
  }

  if (!session.access_token || !session.refresh_token) {
    throw new TransformationError('Invalid session: missing tokens', 'MISSING_TOKENS');
  }

  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in || 3600, // Default to 1 hour if not provided
    user: mapSupabaseUserToProfile(session.user),
  };
}

/**
 * Transform Supabase Session to RegisterResponse
 */
export function mapSupabaseSessionToRegister(session: Session): RegisterResponse {
  // RegisterResponse extends LoginResponse, so we can reuse the transformation
  return mapSupabaseSessionToLogin(session);
}

/**
 * Transform Supabase Session to RefreshTokenResponse
 */
export function mapSupabaseSessionToRefresh(session: Session): RefreshTokenResponse {
  if (!session.access_token) {
    throw new TransformationError('Invalid session: missing access token', 'MISSING_ACCESS_TOKEN');
  }

  return {
    access_token: session.access_token,
    expires_in: session.expires_in || 3600,
  };
}

/**
 * Transform Supabase AuthError to Extended ApiError
 */
export interface ExtendedApiError extends ApiError {
  status: number;
}

export function mapSupabaseErrorToApiError(error: AuthError): ExtendedApiError {
  const errorMap: Record<string, { message: string; status: number }> = {
    invalid_credentials: {
      message: 'Invalid email or password',
      status: 401,
    },
    signup_disabled: {
      message: 'User registration is currently disabled',
      status: 403,
    },
    email_address_invalid: {
      message: 'Please enter a valid email address',
      status: 400,
    },
    password_too_short: {
      message: 'Password must be at least 8 characters long',
      status: 400,
    },
    weak_password: {
      message: 'Password is too weak. Please choose a stronger password',
      status: 400,
    },
    user_not_found: {
      message: 'No account found with this email address',
      status: 404,
    },
    email_not_confirmed: {
      message: 'Please verify your email address before logging in',
      status: 403,
    },
    email_address_not_authorized: {
      message: 'This email address is not authorized to access the application',
      status: 403,
    },
    user_already_registered: {
      message: 'An account with this email address already exists',
      status: 409,
    },
    invalid_request: {
      message: 'Invalid request. Please check your input and try again',
      status: 400,
    },
    token_expired: {
      message: 'Your session has expired. Please log in again',
      status: 401,
    },
    refresh_token_not_found: {
      message: 'Invalid refresh token. Please log in again',
      status: 401,
    },
    invalid_refresh_token: {
      message: 'Invalid refresh token. Please log in again',
      status: 401,
    },
    network_error: {
      message: 'Network error. Please check your connection and try again',
      status: 503,
    },
    server_error: {
      message: 'Server error. Please try again later',
      status: 500,
    },
    rate_limit_exceeded: {
      message: 'Too many requests. Please wait a moment and try again',
      status: 429,
    },
  };

  // Get mapped error or use generic error
  const mapped = errorMap[error.message] || {
    message: error.message || 'An authentication error occurred',
    status: 500,
  };

  return {
    message: mapped.message,
    status: mapped.status,
    code: error.message || 'AUTH_ERROR',
    details: {
      supabaseError: error.message,
      originalStatus: error.status || mapped.status,
    },
  };
}

/**
 * Transform generic Error to ExtendedApiError
 */
export function mapGenericErrorToApiError(error: Error, context?: string): ExtendedApiError {
  return {
    message: error.message || 'An unexpected error occurred',
    status: 500,
    code: 'INTERNAL_ERROR',
    details: {
      context: context || 'unknown',
      errorName: error.name,
      ...(error.stack && { stack: error.stack }),
    },
  };
}

/**
 * Validate and transform user metadata for registration
 */
export function transformRegistrationMetadata(userData: {
  name: string;
  email: string;
  [key: string]: any;
}): Record<string, any> {
  const metadata: Record<string, any> = {
    name: userData.name,
    full_name: userData.name,
  };

  // Add any additional metadata while filtering sensitive information
  const allowedFields = ['name', 'display_name', 'avatar_url', 'website'];
  const dangerousFields = ['__proto__', 'constructor', 'password', 'api_key', 'secret', 'token'];

  Object.keys(userData).forEach(key => {
    // Skip dangerous fields that could cause security issues
    if (dangerousFields.includes(key) || key.startsWith('__') || key.includes('prototype')) {
      return;
    }

    if (allowedFields.includes(key) && userData[key] !== undefined) {
      metadata[key] = userData[key];
    }
  });

  return metadata;
}

/**
 * Transform profile update data for Supabase
 */
export function transformProfileUpdateData(updateData: {
  name?: string;
  email?: string;
  [key: string]: any;
}): { email?: string; data?: Record<string, any> } {
  const result: { email?: string; data?: Record<string, any> } = {};

  // Handle email update separately (requires special handling in Supabase)
  if (updateData.email) {
    result.email = updateData.email;
  }

  // Handle user metadata updates
  const metadataUpdates: Record<string, any> = {};
  if (updateData.name) {
    metadataUpdates.name = updateData.name;
    metadataUpdates.full_name = updateData.name;
  }

  // Add other allowed metadata fields
  const allowedMetadataFields = ['display_name', 'avatar_url', 'website'];
  allowedMetadataFields.forEach(field => {
    if (updateData[field] !== undefined) {
      metadataUpdates[field] = updateData[field];
    }
  });

  if (Object.keys(metadataUpdates).length > 0) {
    result.data = metadataUpdates;
  }

  return result;
}

/**
 * Validate session data completeness
 */
export function validateSessionData(session: Session | null): session is Session {
  if (!session) {
    return false;
  }

  return !!(
    session.access_token &&
    session.refresh_token &&
    session.user &&
    session.user.id &&
    session.user.email
  );
}

/**
 * Validate user data completeness
 */
export function validateUserData(user: User | null): user is User {
  if (!user || typeof user !== 'object') {
    return false;
  }

  return !!(
    user.id &&
    typeof user.id === 'string' &&
    user.email &&
    typeof user.email === 'string' &&
    user.created_at &&
    typeof user.created_at === 'string'
  );
}

/**
 * Extract error message from various error types
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof AuthError) {
    return error.message || 'Authentication error';
  }

  if (error instanceof Error) {
    return error.message || 'Unknown error';
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as any).message);
    return message.trim() || 'Unknown error occurred';
  }

  return 'Unknown error occurred';
}

/**
 * Check if error is a network/connectivity error
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();
    return (
      errorMessage.includes('network') ||
      errorMessage.includes('fetch') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('cors')
    );
  }
  return false;
}

/**
 * Check if error is a rate limiting error
 */
export function isRateLimitError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'message' in error && 'status' in error) {
    const authError = error as any;
    return authError.message === 'rate_limit_exceeded' || authError.status === 429;
  }
  return false;
}

/**
 * Custom transformation error class
 */
export class TransformationError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'TransformationError';
  }
}

/**
 * Utility type guards
 */
export const TypeGuards = {
  isSession: (value: unknown): value is Session => {
    return (
      value !== null && typeof value === 'object' && 'access_token' in value && 'user' in value
    );
  },

  isUser: (value: unknown): value is User => {
    return value !== null && typeof value === 'object' && 'id' in value && 'email' in value;
  },

  isAuthError: (value: unknown): value is AuthError => {
    return (
      value instanceof AuthError ||
      (value !== null && typeof value === 'object' && 'message' in value && 'status' in value)
    );
  },
};

/**
 * Constants for transformation
 */
export const TransformationConstants = {
  DEFAULT_TOKEN_EXPIRY: 3600, // 1 hour in seconds
  MAX_NAME_LENGTH: 100,
  MIN_PASSWORD_LENGTH: 8,
  ALLOWED_EMAIL_DOMAINS: [], // Empty means all domains allowed
  METADATA_SIZE_LIMIT: 1024, // 1KB limit for user metadata
} as const;
