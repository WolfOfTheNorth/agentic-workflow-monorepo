/**
 * Comprehensive Error Mapping System for Supabase Authentication Integration
 *
 * This module provides detailed error translation, retry handling, and user-friendly
 * error messages for common authentication failures, enhancing the overall user
 * experience and system reliability.
 */

import { AuthError } from '@supabase/supabase-js';
import { ExtendedApiError } from './transformers';

/**
 * Authentication error types for better error categorization
 */
export enum AuthErrorTypes {
  INVALID_CREDENTIALS = 'invalid_credentials',
  NETWORK_ERROR = 'network_error',
  SESSION_EXPIRED = 'session_expired',
  EMAIL_NOT_VERIFIED = 'email_not_verified',
  USER_NOT_FOUND = 'user_not_found',
  EMAIL_ALREADY_EXISTS = 'email_already_exists',
  WEAK_PASSWORD = 'weak_password',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  SUPABASE_SERVICE_ERROR = 'supabase_service_error',
  INVALID_EMAIL = 'invalid_email',
  SIGNUP_DISABLED = 'signup_disabled',
  EMAIL_NOT_AUTHORIZED = 'email_not_authorized',
  TOKEN_EXPIRED = 'token_expired',
  INVALID_TOKEN = 'invalid_token',
  PASSWORD_RESET_FAILED = 'password_reset_failed',
  EMAIL_VERIFICATION_FAILED = 'email_verification_failed',
  PROFILE_UPDATE_FAILED = 'profile_update_failed',
  PERMISSION_DENIED = 'permission_denied',
  VALIDATION_ERROR = 'validation_error',
  INTERNAL_ERROR = 'internal_error',
}

/**
 * Error severity levels for better error handling
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Enhanced error interface with additional context
 */
export interface EnhancedApiError extends ExtendedApiError {
  errorType: AuthErrorTypes;
  severity: ErrorSeverity;
  retryable: boolean;
  userAction?: string;
  technicalDetails?: Record<string, any>;
}

/**
 * Error mapping configuration
 */
interface ErrorMappingConfig {
  message: string;
  status: number;
  errorType: AuthErrorTypes;
  severity: ErrorSeverity;
  retryable: boolean;
  userAction?: string;
}

/**
 * Interface for error mapping strategies
 */
export interface ErrorMapper {
  mapSupabaseError(error: AuthError): EnhancedApiError;
  mapNetworkError(error: Error): EnhancedApiError;
  mapValidationError(error: ValidationError): EnhancedApiError;
  mapGenericError(error: Error, context?: string): EnhancedApiError;
}

/**
 * Validation error interface
 */
export interface ValidationError extends Error {
  field?: string;
  value?: any;
  code?: string;
}

/**
 * Comprehensive Supabase error mapper implementation
 */
export class SupabaseErrorMapper implements ErrorMapper {
  private static readonly ERROR_MAP: Record<string, ErrorMappingConfig> = {
    // Authentication Errors
    invalid_credentials: {
      message:
        'The email or password you entered is incorrect. Please check your credentials and try again.',
      status: 401,
      errorType: AuthErrorTypes.INVALID_CREDENTIALS,
      severity: ErrorSeverity.MEDIUM,
      retryable: true,
      userAction:
        'Please verify your email and password, or use the "Forgot Password" link if needed.',
    },
    'Invalid login credentials': {
      message:
        'The email or password you entered is incorrect. Please check your credentials and try again.',
      status: 401,
      errorType: AuthErrorTypes.INVALID_CREDENTIALS,
      severity: ErrorSeverity.MEDIUM,
      retryable: true,
      userAction:
        'Please verify your email and password, or use the "Forgot Password" link if needed.',
    },
    email_not_confirmed: {
      message: 'Please verify your email address before logging in.',
      status: 403,
      errorType: AuthErrorTypes.EMAIL_NOT_VERIFIED,
      severity: ErrorSeverity.MEDIUM,
      retryable: true,
      userAction: 'Check your email for a verification link, or request a new verification email.',
    },
    'Email not confirmed': {
      message: 'Please verify your email address before logging in.',
      status: 403,
      errorType: AuthErrorTypes.EMAIL_NOT_VERIFIED,
      severity: ErrorSeverity.MEDIUM,
      retryable: true,
      userAction: 'Check your email for a verification link, or request a new verification email.',
    },

    // Registration Errors
    signup_disabled: {
      message:
        'New user registration is currently disabled. Please contact support for assistance.',
      status: 403,
      errorType: AuthErrorTypes.SIGNUP_DISABLED,
      severity: ErrorSeverity.HIGH,
      retryable: false,
      userAction: 'Contact support to request access or try again later.',
    },
    user_already_registered: {
      message: 'An account with this email address already exists.',
      status: 409,
      errorType: AuthErrorTypes.EMAIL_ALREADY_EXISTS,
      severity: ErrorSeverity.MEDIUM,
      retryable: false,
      userAction: 'Try logging in instead, or use a different email address.',
    },
    'User already registered': {
      message: 'An account with this email address already exists.',
      status: 409,
      errorType: AuthErrorTypes.EMAIL_ALREADY_EXISTS,
      severity: ErrorSeverity.MEDIUM,
      retryable: false,
      userAction: 'Try logging in instead, or use a different email address.',
    },

    // Email and Password Validation
    email_address_invalid: {
      message: 'Please enter a valid email address.',
      status: 400,
      errorType: AuthErrorTypes.INVALID_EMAIL,
      severity: ErrorSeverity.LOW,
      retryable: true,
      userAction: 'Check the email format and ensure it includes @ and a valid domain.',
    },
    password_too_short: {
      message: 'Password must be at least 8 characters long.',
      status: 400,
      errorType: AuthErrorTypes.WEAK_PASSWORD,
      severity: ErrorSeverity.LOW,
      retryable: true,
      userAction: 'Choose a password with at least 8 characters.',
    },
    weak_password: {
      message:
        'Password is too weak. Please choose a stronger password with a mix of letters, numbers, and symbols.',
      status: 400,
      errorType: AuthErrorTypes.WEAK_PASSWORD,
      severity: ErrorSeverity.LOW,
      retryable: true,
      userAction: 'Use a combination of uppercase, lowercase, numbers, and special characters.',
    },

    // User Management
    user_not_found: {
      message: 'No account found with this email address.',
      status: 404,
      errorType: AuthErrorTypes.USER_NOT_FOUND,
      severity: ErrorSeverity.MEDIUM,
      retryable: false,
      userAction: 'Check the email address or create a new account.',
    },
    email_address_not_authorized: {
      message: 'This email address is not authorized to access the application.',
      status: 403,
      errorType: AuthErrorTypes.EMAIL_NOT_AUTHORIZED,
      severity: ErrorSeverity.HIGH,
      retryable: false,
      userAction: 'Contact support to request access.',
    },

    // Session and Token Errors
    token_expired: {
      message: 'Your session has expired. Please log in again.',
      status: 401,
      errorType: AuthErrorTypes.SESSION_EXPIRED,
      severity: ErrorSeverity.MEDIUM,
      retryable: true,
      userAction: 'Please log in again to continue.',
    },
    refresh_token_not_found: {
      message: 'Your session is invalid. Please log in again.',
      status: 401,
      errorType: AuthErrorTypes.INVALID_TOKEN,
      severity: ErrorSeverity.MEDIUM,
      retryable: true,
      userAction: 'Please log in again to continue.',
    },
    invalid_refresh_token: {
      message: 'Your session is invalid. Please log in again.',
      status: 401,
      errorType: AuthErrorTypes.INVALID_TOKEN,
      severity: ErrorSeverity.MEDIUM,
      retryable: true,
      userAction: 'Please log in again to continue.',
    },

    // Rate Limiting
    rate_limit_exceeded: {
      message: 'Too many requests. Please wait a few minutes before trying again.',
      status: 429,
      errorType: AuthErrorTypes.RATE_LIMIT_EXCEEDED,
      severity: ErrorSeverity.MEDIUM,
      retryable: true,
      userAction: 'Please wait a few minutes and try again.',
    },
    'Too many requests': {
      message: 'Too many requests. Please wait a few minutes before trying again.',
      status: 429,
      errorType: AuthErrorTypes.RATE_LIMIT_EXCEEDED,
      severity: ErrorSeverity.MEDIUM,
      retryable: true,
      userAction: 'Please wait a few minutes and try again.',
    },

    // Network and Service Errors
    network_error: {
      message: 'Network connection error. Please check your internet connection and try again.',
      status: 503,
      errorType: AuthErrorTypes.NETWORK_ERROR,
      severity: ErrorSeverity.HIGH,
      retryable: true,
      userAction: 'Check your internet connection and try again.',
    },
    server_error: {
      message: 'Service temporarily unavailable. Please try again in a few minutes.',
      status: 500,
      errorType: AuthErrorTypes.SUPABASE_SERVICE_ERROR,
      severity: ErrorSeverity.HIGH,
      retryable: true,
      userAction: 'Please try again in a few minutes. If the problem persists, contact support.',
    },
  };

  /**
   * Map Supabase AuthError to enhanced API error
   */
  mapSupabaseError(error: AuthError): EnhancedApiError {
    const errorKey = this.findErrorKey(error.message);
    const config = SupabaseErrorMapper.ERROR_MAP[errorKey];

    if (config) {
      return this.createEnhancedError(config, {
        supabaseError: error.message,
        supabaseStatus: error.status,
        originalError: error,
      });
    }

    // Fallback for unmapped Supabase errors
    return this.createEnhancedError(
      {
        message: error.message || 'An authentication error occurred. Please try again.',
        status: error.status || 500,
        errorType: AuthErrorTypes.SUPABASE_SERVICE_ERROR,
        severity: ErrorSeverity.MEDIUM,
        retryable: true,
        userAction: 'Please try again. If the problem persists, contact support.',
      },
      {
        supabaseError: error.message,
        supabaseStatus: error.status,
        originalError: error,
      }
    );
  }

  /**
   * Map network errors to enhanced API error
   */
  mapNetworkError(error: Error): EnhancedApiError {
    const isConnectionError =
      error.message.toLowerCase().includes('network') ||
      error.message.toLowerCase().includes('connection') ||
      error.message.toLowerCase().includes('timeout') ||
      error.name === 'NetworkError';

    if (isConnectionError) {
      return this.createEnhancedError(
        {
          message: 'Network connection error. Please check your internet connection and try again.',
          status: 503,
          errorType: AuthErrorTypes.NETWORK_ERROR,
          severity: ErrorSeverity.HIGH,
          retryable: true,
          userAction: 'Check your internet connection and try again.',
        },
        {
          originalError: error.message,
          errorName: error.name,
          networkError: true,
        }
      );
    }

    return this.mapGenericError(error, 'network');
  }

  /**
   * Map validation errors to enhanced API error
   */
  mapValidationError(error: ValidationError): EnhancedApiError {
    const fieldContext = error.field ? ` (${error.field})` : '';

    return this.createEnhancedError(
      {
        message:
          error.message ||
          `Validation error${fieldContext}. Please check your input and try again.`,
        status: 400,
        errorType: AuthErrorTypes.VALIDATION_ERROR,
        severity: ErrorSeverity.LOW,
        retryable: true,
        userAction: 'Please correct the input and try again.',
      },
      {
        field: error.field,
        value: error.value,
        validationCode: error.code,
        originalError: error.message,
      }
    );
  }

  /**
   * Map generic errors to enhanced API error
   */
  mapGenericError(error: Error, context?: string): EnhancedApiError {
    return this.createEnhancedError(
      {
        message: error.message || 'An unexpected error occurred. Please try again.',
        status: 500,
        errorType: AuthErrorTypes.INTERNAL_ERROR,
        severity: ErrorSeverity.HIGH,
        retryable: true,
        userAction: 'Please try again. If the problem persists, contact support.',
      },
      {
        context: context || 'unknown',
        errorName: error.name,
        originalError: error.message,
        ...(error.stack && { stack: error.stack }),
      }
    );
  }

  /**
   * Find the best matching error key for a given error message
   */
  private findErrorKey(message: string): string {
    if (!message) return 'server_error';

    // Direct match first
    if (SupabaseErrorMapper.ERROR_MAP[message]) {
      return message;
    }

    // Fuzzy matching for common variations
    const lowercaseMessage = message.toLowerCase();

    for (const key of Object.keys(SupabaseErrorMapper.ERROR_MAP)) {
      if (
        lowercaseMessage.includes(key.toLowerCase()) ||
        key.toLowerCase().includes(lowercaseMessage)
      ) {
        return key;
      }
    }

    // Pattern matching for common error types
    if (lowercaseMessage.includes('credential') || lowercaseMessage.includes('password')) {
      return 'invalid_credentials';
    }
    if (lowercaseMessage.includes('email') && lowercaseMessage.includes('confirm')) {
      return 'email_not_confirmed';
    }
    if (lowercaseMessage.includes('rate') || lowercaseMessage.includes('too many')) {
      return 'rate_limit_exceeded';
    }
    if (lowercaseMessage.includes('network') || lowercaseMessage.includes('connection')) {
      return 'network_error';
    }

    return 'server_error';
  }

  /**
   * Create an enhanced API error with all required fields
   */
  private createEnhancedError(
    config: ErrorMappingConfig,
    technicalDetails: Record<string, any>
  ): EnhancedApiError {
    return {
      message: config.message,
      status: config.status,
      code: config.errorType,
      errorType: config.errorType,
      severity: config.severity,
      retryable: config.retryable,
      userAction: config.userAction,
      details: technicalDetails,
      technicalDetails,
    };
  }
}

/**
 * Retry configuration interface
 */
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors?: AuthErrorTypes[];
  shouldRetry?: (error: EnhancedApiError, attempt: number) => boolean;
}

/**
 * Auth retry handler for network resilience
 */
export class AuthRetryHandler {
  private defaultConfig: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 10000, // 10 seconds
    backoffMultiplier: 2,
    retryableErrors: [
      AuthErrorTypes.NETWORK_ERROR,
      AuthErrorTypes.SUPABASE_SERVICE_ERROR,
      AuthErrorTypes.RATE_LIMIT_EXCEEDED,
      AuthErrorTypes.SESSION_EXPIRED,
    ],
  };

  constructor(private config: Partial<RetryConfig> = {}) {
    this.config = { ...this.defaultConfig, ...config };
  }

  /**
   * Execute operation with retry logic
   */
  async executeWithRetry<T>(operation: () => Promise<T>, operationName?: string): Promise<T> {
    let lastError: EnhancedApiError | null = null;
    const effectiveConfig = { ...this.defaultConfig, ...this.config };

    for (let attempt = 1; attempt <= effectiveConfig.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = this.normalizeError(error);

        // Check if we should retry
        if (attempt === effectiveConfig.maxAttempts || !this.shouldRetryError(lastError, attempt)) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = this.calculateDelay(attempt, effectiveConfig);

        console.warn(
          `[AuthRetryHandler] ${operationName || 'Operation'} failed (attempt ${attempt}/${effectiveConfig.maxAttempts}). Retrying in ${delay}ms...`,
          {
            error: lastError.message,
            errorType: lastError.errorType,
            severity: lastError.severity,
          }
        );

        await this.sleep(delay);
      }
    }

    // At this point, lastError should always be set, but add a safety check
    if (!lastError) {
      lastError = this.normalizeError(new Error('Unknown error during retry operation'));
    }

    // Enhance the final error with retry information
    lastError.technicalDetails = {
      ...lastError.technicalDetails,
      retryAttempts: effectiveConfig.maxAttempts,
      finalAttempt: true,
      operationName: operationName || 'unknown',
    };

    throw lastError;
  }

  /**
   * Determine if an error should be retried
   */
  private shouldRetryError(error: EnhancedApiError, attempt: number): boolean {
    const effectiveConfig = { ...this.defaultConfig, ...this.config };

    // Use custom retry logic if provided
    if (effectiveConfig.shouldRetry) {
      return effectiveConfig.shouldRetry(error, attempt);
    }

    // Don't retry if explicitly marked as non-retryable
    if (!error.retryable) {
      return false;
    }

    // Check if error type is in retryable list
    if (effectiveConfig.retryableErrors && effectiveConfig.retryableErrors.length > 0) {
      return effectiveConfig.retryableErrors.includes(error.errorType);
    }

    // Default retry logic based on error characteristics
    return (
      error.retryable &&
      (error.errorType === AuthErrorTypes.NETWORK_ERROR ||
        error.errorType === AuthErrorTypes.SUPABASE_SERVICE_ERROR ||
        error.errorType === AuthErrorTypes.RATE_LIMIT_EXCEEDED ||
        error.status >= 500)
    );
  }

  /**
   * Calculate delay with exponential backoff
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    const delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    return Math.min(delay, config.maxDelay);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Normalize any error to EnhancedApiError
   */
  private normalizeError(error: unknown): EnhancedApiError {
    if (this.isEnhancedApiError(error)) {
      return error;
    }

    const errorMapper = new SupabaseErrorMapper();

    if (error instanceof AuthError) {
      return errorMapper.mapSupabaseError(error);
    }

    if (error instanceof Error) {
      return errorMapper.mapGenericError(error);
    }

    return errorMapper.mapGenericError(new Error(String(error)));
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
}

/**
 * Factory function to create error mapper instance
 */
export function createErrorMapper(): SupabaseErrorMapper {
  return new SupabaseErrorMapper();
}

/**
 * Factory function to create retry handler instance
 */
export function createRetryHandler(config?: Partial<RetryConfig>): AuthRetryHandler {
  return new AuthRetryHandler(config);
}

/**
 * Utility function to categorize error severity
 */
export function categorizeErrorSeverity(error: EnhancedApiError): ErrorSeverity {
  // Override with explicit severity if available
  if (error.severity) {
    return error.severity;
  }

  // Categorize based on status code
  if (error.status >= 500) {
    return ErrorSeverity.HIGH;
  } else if (error.status >= 400) {
    return ErrorSeverity.MEDIUM;
  } else {
    return ErrorSeverity.LOW;
  }
}

/**
 * Utility function to determine if error should be reported to monitoring
 */
export function shouldReportError(error: EnhancedApiError): boolean {
  return (
    error.severity === ErrorSeverity.HIGH ||
    error.severity === ErrorSeverity.CRITICAL ||
    error.status >= 500
  );
}

// Default singleton instances
let defaultErrorMapper: SupabaseErrorMapper | null = null;
let defaultRetryHandler: AuthRetryHandler | null = null;

/**
 * Get default error mapper instance
 */
export function getErrorMapper(): SupabaseErrorMapper {
  if (!defaultErrorMapper) {
    defaultErrorMapper = createErrorMapper();
  }
  return defaultErrorMapper;
}

/**
 * Get default retry handler instance
 */
export function getRetryHandler(): AuthRetryHandler {
  if (!defaultRetryHandler) {
    defaultRetryHandler = createRetryHandler();
  }
  return defaultRetryHandler;
}

/**
 * Reset singleton instances (useful for testing)
 */
export function resetErrorMapper(): void {
  defaultErrorMapper = null;
}

export function resetRetryHandler(): void {
  defaultRetryHandler = null;
}

export function resetErrorHandlers(): void {
  defaultErrorMapper = null;
  defaultRetryHandler = null;
}
