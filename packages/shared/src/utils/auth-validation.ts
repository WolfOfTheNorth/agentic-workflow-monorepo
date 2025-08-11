/**
 * Authentication Validation Utilities
 *
 * Comprehensive validation functions for authentication forms and data
 * with security requirements and detailed error reporting.
 */

import type {
  ValidationResult,
  ValidationError,
  AuthValidationSchema,
  LoginCredentials,
  SignupData,
} from '../types/api';

// Security-focused validation constants
export const AUTH_VALIDATION_RULES = {
  EMAIL: {
    MAX_LENGTH: 254, // RFC 5321 standard
    MIN_LENGTH: 3,
    PATTERN:
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
    FORBIDDEN_DOMAINS: ['tempmail.org', '10minutemail.com', 'guerrillamail.com'] as string[],
    DISPOSABLE_PATTERNS: [/temp/i, /fake/i, /test/i, /spam/i],
  },
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBERS: true,
    REQUIRE_SYMBOLS: true,
    FORBIDDEN_PATTERNS: [
      /password/i,
      /123456/,
      /qwerty/i,
      /admin/i,
      /letmein/i,
      /welcome/i,
      /monkey/i,
      /dragon/i,
    ] as RegExp[],
    SYMBOL_PATTERN: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/,
    UPPERCASE_PATTERN: /[A-Z]/,
    LOWERCASE_PATTERN: /[a-z]/,
    NUMBER_PATTERN: /[0-9]/,
    SEQUENTIAL_PATTERN:
      /(012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i,
    REPEATED_PATTERN: /(.)\1{2,}/,
  },
  NAME: {
    MIN_LENGTH: 2,
    MAX_LENGTH: 50,
    PATTERN: /^[a-zA-Z\s'-]+$/,
    FORBIDDEN_WORDS: ['admin', 'root', 'system', 'test', 'null', 'undefined'] as string[],
  },
} as const;

/**
 * Validate email address with comprehensive security checks
 */
export function validateAuthEmail(email: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  // Basic presence check
  if (!email || typeof email !== 'string') {
    errors.push({
      field: 'email',
      code: 'REQUIRED',
      message: 'Email address is required',
    });
    return { isValid: false, errors, warnings };
  }

  const trimmedEmail = email.trim().toLowerCase();

  // Length checks
  if (trimmedEmail.length < AUTH_VALIDATION_RULES.EMAIL.MIN_LENGTH) {
    errors.push({
      field: 'email',
      code: 'TOO_SHORT',
      message: `Email must be at least ${AUTH_VALIDATION_RULES.EMAIL.MIN_LENGTH} characters long`,
    });
  }

  if (trimmedEmail.length > AUTH_VALIDATION_RULES.EMAIL.MAX_LENGTH) {
    errors.push({
      field: 'email',
      code: 'TOO_LONG',
      message: `Email must not exceed ${AUTH_VALIDATION_RULES.EMAIL.MAX_LENGTH} characters`,
    });
  }

  // Format validation
  if (!AUTH_VALIDATION_RULES.EMAIL.PATTERN.test(trimmedEmail)) {
    errors.push({
      field: 'email',
      code: 'INVALID_FORMAT',
      message: 'Please enter a valid email address',
    });
  }

  // Check for forbidden domains
  const domain = trimmedEmail.split('@')[1];
  if (domain && AUTH_VALIDATION_RULES.EMAIL.FORBIDDEN_DOMAINS.includes(domain)) {
    errors.push({
      field: 'email',
      code: 'FORBIDDEN_DOMAIN',
      message: 'This email domain is not allowed',
    });
  }

  // Check for disposable email patterns
  if (domain) {
    const hasDisposablePattern = AUTH_VALIDATION_RULES.EMAIL.DISPOSABLE_PATTERNS.some(pattern =>
      pattern.test(domain)
    );
    if (hasDisposablePattern) {
      warnings.push('This appears to be a disposable email address');
    }
  }

  // Additional security checks
  if (trimmedEmail.includes('..')) {
    errors.push({
      field: 'email',
      code: 'INVALID_FORMAT',
      message: 'Email address contains consecutive dots',
    });
  }

  if (trimmedEmail.startsWith('.') || trimmedEmail.endsWith('.')) {
    errors.push({
      field: 'email',
      code: 'INVALID_FORMAT',
      message: 'Email address cannot start or end with a dot',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate password with comprehensive security requirements
 */
export function validateAuthPassword(password: string, confirmPassword?: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  // Basic presence check
  if (!password || typeof password !== 'string') {
    errors.push({
      field: 'password',
      code: 'REQUIRED',
      message: 'Password is required',
    });
    return { isValid: false, errors, warnings };
  }

  // Length checks
  if (password.length < AUTH_VALIDATION_RULES.PASSWORD.MIN_LENGTH) {
    errors.push({
      field: 'password',
      code: 'TOO_SHORT',
      message: `Password must be at least ${AUTH_VALIDATION_RULES.PASSWORD.MIN_LENGTH} characters long`,
    });
  }

  if (password.length > AUTH_VALIDATION_RULES.PASSWORD.MAX_LENGTH) {
    errors.push({
      field: 'password',
      code: 'TOO_LONG',
      message: `Password must not exceed ${AUTH_VALIDATION_RULES.PASSWORD.MAX_LENGTH} characters`,
    });
  }

  // Character requirements
  if (
    AUTH_VALIDATION_RULES.PASSWORD.REQUIRE_UPPERCASE &&
    !AUTH_VALIDATION_RULES.PASSWORD.UPPERCASE_PATTERN.test(password)
  ) {
    errors.push({
      field: 'password',
      code: 'MISSING_UPPERCASE',
      message: 'Password must contain at least one uppercase letter',
    });
  }

  if (
    AUTH_VALIDATION_RULES.PASSWORD.REQUIRE_LOWERCASE &&
    !AUTH_VALIDATION_RULES.PASSWORD.LOWERCASE_PATTERN.test(password)
  ) {
    errors.push({
      field: 'password',
      code: 'MISSING_LOWERCASE',
      message: 'Password must contain at least one lowercase letter',
    });
  }

  if (
    AUTH_VALIDATION_RULES.PASSWORD.REQUIRE_NUMBERS &&
    !AUTH_VALIDATION_RULES.PASSWORD.NUMBER_PATTERN.test(password)
  ) {
    errors.push({
      field: 'password',
      code: 'MISSING_NUMBER',
      message: 'Password must contain at least one number',
    });
  }

  if (
    AUTH_VALIDATION_RULES.PASSWORD.REQUIRE_SYMBOLS &&
    !AUTH_VALIDATION_RULES.PASSWORD.SYMBOL_PATTERN.test(password)
  ) {
    errors.push({
      field: 'password',
      code: 'MISSING_SYMBOL',
      message: 'Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)',
    });
  }

  // Security pattern checks
  AUTH_VALIDATION_RULES.PASSWORD.FORBIDDEN_PATTERNS.forEach(pattern => {
    if (pattern.test(password)) {
      errors.push({
        field: 'password',
        code: 'COMMON_PASSWORD',
        message: 'Password contains common words and is not secure',
      });
    }
  });

  // Check for sequential characters
  if (AUTH_VALIDATION_RULES.PASSWORD.SEQUENTIAL_PATTERN.test(password.toLowerCase())) {
    warnings.push('Password contains sequential characters which may be less secure');
  }

  // Check for repeated characters
  if (AUTH_VALIDATION_RULES.PASSWORD.REPEATED_PATTERN.test(password)) {
    warnings.push('Password contains repeated characters which may be less secure');
  }

  // Confirm password validation
  if (confirmPassword !== undefined) {
    if (password !== confirmPassword) {
      errors.push({
        field: 'confirmPassword',
        code: 'PASSWORDS_MISMATCH',
        message: 'Passwords do not match',
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate name with security and format requirements
 */
export function validateName(name: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  // Basic presence check
  if (!name || typeof name !== 'string') {
    errors.push({
      field: 'name',
      code: 'REQUIRED',
      message: 'Name is required',
    });
    return { isValid: false, errors, warnings };
  }

  const trimmedName = name.trim();

  // Length checks
  if (trimmedName.length < AUTH_VALIDATION_RULES.NAME.MIN_LENGTH) {
    errors.push({
      field: 'name',
      code: 'TOO_SHORT',
      message: `Name must be at least ${AUTH_VALIDATION_RULES.NAME.MIN_LENGTH} characters long`,
    });
  }

  if (trimmedName.length > AUTH_VALIDATION_RULES.NAME.MAX_LENGTH) {
    errors.push({
      field: 'name',
      code: 'TOO_LONG',
      message: `Name must not exceed ${AUTH_VALIDATION_RULES.NAME.MAX_LENGTH} characters`,
    });
  }

  // Format validation
  if (!AUTH_VALIDATION_RULES.NAME.PATTERN.test(trimmedName)) {
    errors.push({
      field: 'name',
      code: 'INVALID_FORMAT',
      message: 'Name can only contain letters, spaces, hyphens, and apostrophes',
    });
  }

  // Check for forbidden words
  const lowerName = trimmedName.toLowerCase();
  AUTH_VALIDATION_RULES.NAME.FORBIDDEN_WORDS.forEach(word => {
    if (lowerName.includes(word)) {
      errors.push({
        field: 'name',
        code: 'FORBIDDEN_WORD',
        message: 'Name contains forbidden words',
      });
    }
  });

  // Check for suspicious patterns
  if (/^\s+|\s+$/.test(name)) {
    warnings.push('Name has leading or trailing whitespace');
  }

  if (/\s{2,}/.test(trimmedName)) {
    warnings.push('Name contains multiple consecutive spaces');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Calculate password strength score (0-100)
 */
export function calculatePasswordStrength(password: string): number {
  if (!password) return 0;

  let score = 0;
  const length = password.length;

  // Length scoring
  if (length >= 8) score += 20;
  if (length >= 12) score += 10;
  if (length >= 16) score += 10;

  // Character variety scoring
  if (AUTH_VALIDATION_RULES.PASSWORD.LOWERCASE_PATTERN.test(password)) score += 10;
  if (AUTH_VALIDATION_RULES.PASSWORD.UPPERCASE_PATTERN.test(password)) score += 10;
  if (AUTH_VALIDATION_RULES.PASSWORD.NUMBER_PATTERN.test(password)) score += 10;
  if (AUTH_VALIDATION_RULES.PASSWORD.SYMBOL_PATTERN.test(password)) score += 15;

  // Complexity bonuses
  const uniqueChars = new Set(password).size;
  if (uniqueChars >= password.length * 0.7) score += 10;

  // Penalties for common patterns
  if (AUTH_VALIDATION_RULES.PASSWORD.SEQUENTIAL_PATTERN.test(password.toLowerCase())) score -= 10;
  if (AUTH_VALIDATION_RULES.PASSWORD.REPEATED_PATTERN.test(password)) score -= 15;

  AUTH_VALIDATION_RULES.PASSWORD.FORBIDDEN_PATTERNS.forEach(pattern => {
    if (pattern.test(password)) score -= 20;
  });

  return Math.max(0, Math.min(100, score));
}

/**
 * Get password strength description
 */
export function getPasswordStrengthText(score: number): string {
  if (score >= 80) return 'Very Strong';
  if (score >= 60) return 'Strong';
  if (score >= 40) return 'Moderate';
  if (score >= 20) return 'Weak';
  return 'Very Weak';
}

/**
 * Validate login form data
 */
export function validateLoginForm(data: LoginCredentials): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  // Validate email
  const emailValidation = validateAuthEmail(data.email);
  errors.push(...emailValidation.errors);
  warnings.push(...(emailValidation.warnings || []));

  // Basic password presence check (don't apply full validation for login)
  if (!data.password || typeof data.password !== 'string' || data.password.trim().length === 0) {
    errors.push({
      field: 'password',
      code: 'REQUIRED',
      message: 'Password is required',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate signup form data
 */
export function validateSignupForm(data: SignupData): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  // Validate email
  const emailValidation = validateAuthEmail(data.email);
  errors.push(...emailValidation.errors);
  warnings.push(...(emailValidation.warnings || []));

  // Validate password with confirmation
  const passwordValidation = validateAuthPassword(data.password, data.confirmPassword);
  errors.push(...passwordValidation.errors);
  warnings.push(...(passwordValidation.warnings || []));

  // Validate name
  const nameValidation = validateName(data.name);
  errors.push(...nameValidation.errors);
  warnings.push(...(nameValidation.warnings || []));

  // Additional signup-specific validations
  if (data.termsAccepted === false) {
    errors.push({
      field: 'termsAccepted',
      code: 'REQUIRED',
      message: 'You must accept the terms and conditions',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Sanitize input data for security
 */
export function sanitizeAuthInput(input: string): string {
  if (typeof input !== 'string') return '';

  // Remove control characters by filtering printable characters only
  const printableChars = input
    .trim()
    .replace(/\0/g, '') // Remove null bytes
    .split('')
    .filter(char => {
      const code = char.charCodeAt(0);
      return code >= 32 && code !== 127 && (code < 128 || code > 159);
    })
    .join('');

  return printableChars.substring(0, 1000); // Limit length for security
}

/**
 * Generate validation schema for forms
 */
export function getAuthValidationSchema(): AuthValidationSchema {
  return {
    email: {
      required: true,
      pattern: AUTH_VALIDATION_RULES.EMAIL.PATTERN,
      maxLength: AUTH_VALIDATION_RULES.EMAIL.MAX_LENGTH,
    },
    password: {
      required: true,
      minLength: AUTH_VALIDATION_RULES.PASSWORD.MIN_LENGTH,
      maxLength: AUTH_VALIDATION_RULES.PASSWORD.MAX_LENGTH,
      requireUppercase: AUTH_VALIDATION_RULES.PASSWORD.REQUIRE_UPPERCASE,
      requireLowercase: AUTH_VALIDATION_RULES.PASSWORD.REQUIRE_LOWERCASE,
      requireNumbers: AUTH_VALIDATION_RULES.PASSWORD.REQUIRE_NUMBERS,
      requireSymbols: AUTH_VALIDATION_RULES.PASSWORD.REQUIRE_SYMBOLS,
      forbiddenPatterns: AUTH_VALIDATION_RULES.PASSWORD.FORBIDDEN_PATTERNS,
    },
    name: {
      required: true,
      minLength: AUTH_VALIDATION_RULES.NAME.MIN_LENGTH,
      maxLength: AUTH_VALIDATION_RULES.NAME.MAX_LENGTH,
      pattern: AUTH_VALIDATION_RULES.NAME.PATTERN,
    },
  };
}

/**
 * Validate field by name with dynamic validation
 */
export function validateField(fieldName: string, value: any, confirmValue?: any): ValidationResult {
  switch (fieldName) {
    case 'email':
      return validateAuthEmail(value);
    case 'password':
      return validateAuthPassword(value, confirmValue);
    case 'name':
      return validateName(value);
    default:
      return {
        isValid: true,
        errors: [],
        warnings: [],
      };
  }
}

/**
 * Check if email domain is from a major provider (for enhanced security)
 */
export function isMajorEmailProvider(email: string): boolean {
  const majorProviders = [
    'gmail.com',
    'outlook.com',
    'hotmail.com',
    'yahoo.com',
    'icloud.com',
    'protonmail.com',
    'aol.com',
    'live.com',
    'msn.com',
    'yandex.com',
  ];

  const domain = email.toLowerCase().split('@')[1];
  return majorProviders.includes(domain);
}

/**
 * Generate password requirements text for UI
 */
export function getPasswordRequirementsText(): string[] {
  const requirements = [];

  requirements.push(`At least ${AUTH_VALIDATION_RULES.PASSWORD.MIN_LENGTH} characters long`);

  if (AUTH_VALIDATION_RULES.PASSWORD.REQUIRE_UPPERCASE) {
    requirements.push('At least one uppercase letter (A-Z)');
  }

  if (AUTH_VALIDATION_RULES.PASSWORD.REQUIRE_LOWERCASE) {
    requirements.push('At least one lowercase letter (a-z)');
  }

  if (AUTH_VALIDATION_RULES.PASSWORD.REQUIRE_NUMBERS) {
    requirements.push('At least one number (0-9)');
  }

  if (AUTH_VALIDATION_RULES.PASSWORD.REQUIRE_SYMBOLS) {
    requirements.push('At least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)');
  }

  requirements.push('Cannot contain common words or patterns');

  return requirements;
}
