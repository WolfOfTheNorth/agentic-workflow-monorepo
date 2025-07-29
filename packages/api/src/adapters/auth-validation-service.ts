/**
 * Authentication Validation Service
 *
 * Task 19: Implement authentication validation and security measures
 * - Create AuthValidationService with comprehensive input validation
 * - Add rate limiting and security checks
 * - Implement secure token storage and handling
 * - Add CSRF protection and security headers
 */

import {
  validatePassword,
  PasswordValidationConfig,
  DEFAULT_PASSWORD_CONFIG,
} from './password-validator';

/**
 * Configuration for authentication validation
 */
export interface AuthValidationConfig {
  email: {
    maxLength: number;
    allowedDomains: string[]; // Empty array means all domains allowed
    blockDisposableEmails: boolean;
  };
  password: PasswordValidationConfig;
  rateLimiting: {
    enabled: boolean;
    maxAttempts: number;
    windowMs: number; // Time window in milliseconds
    blockDurationMs: number; // How long to block after exceeding limit
  };
  security: {
    enableCSRFProtection: boolean;
    secureHeaders: boolean;
    validateUserAgent: boolean;
    allowedOrigins: string[];
    requireHTTPS: boolean;
  };
  input: {
    maxNameLength: number;
    allowedNameCharacters: RegExp;
    sanitizeInput: boolean;
    preventXSS: boolean;
  };
}

/**
 * Default validation configuration
 */
export const DEFAULT_AUTH_VALIDATION_CONFIG: AuthValidationConfig = {
  email: {
    maxLength: 254, // RFC 5321 standard
    allowedDomains: [], // Allow all domains by default
    blockDisposableEmails: true,
  },
  password: DEFAULT_PASSWORD_CONFIG,
  rateLimiting: {
    enabled: true,
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    blockDurationMs: 30 * 60 * 1000, // 30 minutes
  },
  security: {
    enableCSRFProtection: true,
    secureHeaders: true,
    validateUserAgent: true,
    allowedOrigins: ['http://localhost:3000', 'https://app.example.com'],
    requireHTTPS: process.env.NODE_ENV === 'production',
  },
  input: {
    maxNameLength: 100,
    allowedNameCharacters: /^[a-zA-Z0-9\s\-_.'"àáâãäåçèéêëìíîïñòóôõöùúûüýÿ]+$/u,
    sanitizeInput: true,
    preventXSS: true,
  },
};

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedData?: any;
}

/**
 * Rate limiting tracking interface
 */
export interface RateLimitAttempt {
  ip: string;
  email?: string;
  attempts: number;
  firstAttempt: number;
  lastAttempt: number;
  blocked: boolean;
  blockExpiry?: number;
}

/**
 * Known disposable email domains (subset for demonstration)
 */
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  '10minutemail.com',
  'tempmail.org',
  'guerrillamail.com',
  'mailinator.com',
  'temp-mail.org',
  'throwaway.email',
  'fakemailgenerator.com',
  'mailcatch.com',
  '7.ly',
  'yopmail.com',
  'dispostable.com',
  'maildrop.cc',
  'tempail.com',
  'getairmail.com',
  'tmpmail.net',
]);

/**
 * XSS patterns for detection
 */
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
  /<embed[^>]*>/gi,
  /<link[^>]*>/gi,
  /<meta[^>]*>/gi,
  /javascript:/gi,
  /vbscript:/gi,
  /data:text\/html/gi,
  /on\w+\s*=/gi, // Event handlers like onclick, onload, etc.
];

/**
 * SQL injection patterns for detection
 */
const SQL_INJECTION_PATTERNS = [
  /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/gi,
  /(;|\||&|&&|\|\||<|>|'|"|=|\*|%|_|\+|-)/g,
  /(\b(or|and)\b.*\b(=|<|>|like)\b)/gi,
  /(\/\*.*\*\/)/g,
  /(--)|(#)/g,
];

/**
 * Authentication Validation Service
 */
export class AuthValidationService {
  private config: AuthValidationConfig;
  private rateLimitStore: Map<string, RateLimitAttempt> = new Map();
  private csrfTokens: Set<string> = new Set();

  constructor(config: Partial<AuthValidationConfig> = {}) {
    this.config = { ...DEFAULT_AUTH_VALIDATION_CONFIG, ...config };

    // Start cleanup interval for rate limiting
    if (this.config.rateLimiting.enabled) {
      setInterval(() => this.cleanupExpiredAttempts(), 60000); // Cleanup every minute
    }
  }

  /**
   * Validate email address
   */
  validateEmail(email: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push('Please enter a valid email address');
    }

    // Length validation
    if (email.length > this.config.email.maxLength) {
      errors.push(`Email address is too long (maximum ${this.config.email.maxLength} characters)`);
    }

    // Domain validation
    if (this.config.email.allowedDomains.length > 0) {
      const domain = email.split('@')[1]?.toLowerCase();
      if (domain && !this.config.email.allowedDomains.includes(domain)) {
        errors.push('Email domain is not allowed');
      }
    }

    // Disposable email check
    if (this.config.email.blockDisposableEmails) {
      const domain = email.split('@')[1]?.toLowerCase();
      if (domain && DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
        errors.push('Temporary or disposable email addresses are not allowed');
      }
    }

    // Security checks
    if (this.containsXSS(email)) {
      errors.push('Email contains invalid characters');
    }

    if (this.containsSQLInjection(email)) {
      errors.push('Email contains invalid characters');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitizedData: this.config.input.sanitizeInput ? this.sanitizeInput(email) : email,
    };
  }

  /**
   * Validate user name
   */
  validateName(name: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Length validation
    if (name.length === 0) {
      errors.push('Name is required');
    }

    if (name.length > this.config.input.maxNameLength) {
      errors.push(`Name is too long (maximum ${this.config.input.maxNameLength} characters)`);
    }

    // Character validation
    if (!this.config.input.allowedNameCharacters.test(name)) {
      errors.push('Name contains invalid characters');
    }

    // Security checks
    if (this.containsXSS(name)) {
      errors.push('Name contains invalid characters');
    }

    if (this.containsSQLInjection(name)) {
      errors.push('Name contains invalid characters');
    }

    // Check for excessive whitespace
    if (name.trim() !== name) {
      warnings.push('Name has leading or trailing whitespace');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitizedData: this.config.input.sanitizeInput
        ? this.sanitizeInput(name.trim())
        : name.trim(),
    };
  }

  /**
   * Validate password using existing password validator
   */
  validatePassword(password: string): ValidationResult {
    const result = validatePassword(password, this.config.password);

    return {
      isValid: result.isValid,
      errors: (result as any).errors || [],
      warnings: (result as any).suggestions || [],
      sanitizedData: password, // Don't sanitize passwords
    };
  }

  /**
   * Validate registration data
   */
  validateRegistrationData(data: {
    email: string;
    password: string;
    name: string;
    [key: string]: any;
  }): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const sanitizedData: any = {};

    // Validate email
    const emailResult = this.validateEmail(data.email);
    if (!emailResult.isValid) {
      errors.push(...emailResult.errors);
    }
    warnings.push(...emailResult.warnings);
    sanitizedData.email = emailResult.sanitizedData;

    // Validate password
    const passwordResult = this.validatePassword(data.password);
    if (!passwordResult.isValid) {
      errors.push(...passwordResult.errors);
    }
    warnings.push(...passwordResult.warnings);
    sanitizedData.password = data.password; // Don't expose password in sanitized data

    // Validate name
    const nameResult = this.validateName(data.name);
    if (!nameResult.isValid) {
      errors.push(...nameResult.errors);
    }
    warnings.push(...nameResult.warnings);
    sanitizedData.name = nameResult.sanitizedData;

    // Validate additional fields
    Object.keys(data).forEach(key => {
      if (!['email', 'password', 'name'].includes(key)) {
        const value = data[key];
        if (typeof value === 'string') {
          if (this.containsXSS(value) || this.containsSQLInjection(value)) {
            errors.push(`Field "${key}" contains invalid characters`);
          } else {
            sanitizedData[key] = this.config.input.sanitizeInput
              ? this.sanitizeInput(value)
              : value;
          }
        } else {
          sanitizedData[key] = value;
        }
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitizedData,
    };
  }

  /**
   * Validate login data
   */
  validateLoginData(data: {
    email: string;
    password: string;
    [key: string]: any;
  }): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const sanitizedData: any = {};

    // Basic email format validation (less strict for login)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      errors.push('Please enter a valid email address');
    }

    // Security checks
    if (this.containsXSS(data.email) || this.containsSQLInjection(data.email)) {
      errors.push('Email contains invalid characters');
    }

    if (this.containsXSS(data.password) || this.containsSQLInjection(data.password)) {
      errors.push('Password contains invalid characters');
    }

    // Basic password check (not empty)
    if (!data.password || data.password.length === 0) {
      errors.push('Password is required');
    }

    sanitizedData.email = this.config.input.sanitizeInput
      ? this.sanitizeInput(data.email)
      : data.email;
    sanitizedData.password = data.password; // Don't expose password

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitizedData,
    };
  }

  /**
   * Check rate limiting
   */
  checkRateLimit(
    identifier: string,
    email?: string
  ): {
    allowed: boolean;
    remainingAttempts: number;
    resetTime: number;
    blocked: boolean;
  } {
    if (!this.config.rateLimiting.enabled) {
      return {
        allowed: true,
        remainingAttempts: this.config.rateLimiting.maxAttempts,
        resetTime: 0,
        blocked: false,
      };
    }

    const now = Date.now();
    const key = email ? `${identifier}:${email}` : identifier;
    let attempt = this.rateLimitStore.get(key);

    if (!attempt) {
      attempt = {
        ip: identifier,
        email,
        attempts: 0,
        firstAttempt: now,
        lastAttempt: now,
        blocked: false,
      };
    }

    // Check if block has expired
    if (attempt.blocked && attempt.blockExpiry && now > attempt.blockExpiry) {
      attempt.blocked = false;
      attempt.attempts = 0;
      attempt.firstAttempt = now;
      delete attempt.blockExpiry;
    }

    // Check if still blocked
    if (attempt.blocked) {
      return {
        allowed: false,
        remainingAttempts: 0,
        resetTime: attempt.blockExpiry || now + this.config.rateLimiting.blockDurationMs,
        blocked: true,
      };
    }

    // Check if window has expired
    if (now - attempt.firstAttempt > this.config.rateLimiting.windowMs) {
      attempt.attempts = 0;
      attempt.firstAttempt = now;
    }

    const remainingAttempts = Math.max(0, this.config.rateLimiting.maxAttempts - attempt.attempts);
    const allowed = attempt.attempts < this.config.rateLimiting.maxAttempts;

    return {
      allowed,
      remainingAttempts,
      resetTime: attempt.firstAttempt + this.config.rateLimiting.windowMs,
      blocked: false,
    };
  }

  /**
   * Record a failed authentication attempt
   */
  recordFailedAttempt(identifier: string, email?: string): void {
    if (!this.config.rateLimiting.enabled) {
      return;
    }

    const now = Date.now();
    const key = email ? `${identifier}:${email}` : identifier;
    let attempt = this.rateLimitStore.get(key);

    if (!attempt) {
      attempt = {
        ip: identifier,
        email,
        attempts: 0,
        firstAttempt: now,
        lastAttempt: now,
        blocked: false,
      };
    }

    // Check if window has expired
    if (now - attempt.firstAttempt > this.config.rateLimiting.windowMs) {
      attempt.attempts = 0;
      attempt.firstAttempt = now;
    }

    attempt.attempts++;
    attempt.lastAttempt = now;

    // Block if exceeded limit
    if (attempt.attempts >= this.config.rateLimiting.maxAttempts) {
      attempt.blocked = true;
      attempt.blockExpiry = now + this.config.rateLimiting.blockDurationMs;
    }

    this.rateLimitStore.set(key, attempt);
  }

  /**
   * Record a successful authentication attempt
   */
  recordSuccessfulAttempt(identifier: string, email?: string): void {
    if (!this.config.rateLimiting.enabled) {
      return;
    }

    const key = email ? `${identifier}:${email}` : identifier;
    this.rateLimitStore.delete(key); // Clear attempts on success
  }

  /**
   * Generate CSRF token
   */
  generateCSRFToken(): string {
    if (!this.config.security.enableCSRFProtection) {
      return '';
    }

    const token = this.generateSecureToken(32);
    this.csrfTokens.add(token);

    // Set expiry for token (remove after 1 hour)
    setTimeout(
      () => {
        this.csrfTokens.delete(token);
      },
      60 * 60 * 1000
    );

    return token;
  }

  /**
   * Validate CSRF token
   */
  validateCSRFToken(token: string): boolean {
    if (!this.config.security.enableCSRFProtection) {
      return true;
    }

    return this.csrfTokens.has(token);
  }

  /**
   * Get security headers
   */
  getSecurityHeaders(): Record<string, string> {
    if (!this.config.security.secureHeaders) {
      return {};
    }

    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': "default-src 'self'",
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    };
  }

  /**
   * Validate origin
   */
  validateOrigin(origin: string): boolean {
    if (this.config.security.allowedOrigins.length === 0) {
      return true; // Allow all origins if none specified
    }

    return this.config.security.allowedOrigins.includes(origin);
  }

  /**
   * Validate user agent (basic check for automated requests)
   */
  validateUserAgent(userAgent: string): boolean {
    if (!this.config.security.validateUserAgent) {
      return true;
    }

    // Block empty or suspicious user agents
    if (!userAgent || userAgent.length < 10) {
      return false;
    }

    // Block known bot patterns
    const botPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python-requests/i,
    ];

    return !botPatterns.some(pattern => pattern.test(userAgent));
  }

  /**
   * Validate HTTPS requirement
   */
  validateHTTPS(protocol: string, host: string): boolean {
    if (!this.config.security.requireHTTPS) {
      return true;
    }

    // Allow localhost for development
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      return true;
    }

    return protocol === 'https:';
  }

  /**
   * Check for XSS patterns
   */
  private containsXSS(input: string): boolean {
    if (!this.config.input.preventXSS) {
      return false;
    }

    return XSS_PATTERNS.some(pattern => pattern.test(input));
  }

  /**
   * Check for SQL injection patterns
   */
  private containsSQLInjection(input: string): boolean {
    return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(input));
  }

  /**
   * Sanitize input string
   */
  private sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/vbscript:/gi, '') // Remove vbscript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  }

  /**
   * Generate secure random token
   */
  private generateSecureToken(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const array = new Uint8Array(length);

    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array);
    } else {
      // Fallback for environments without crypto
      for (let i = 0; i < length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }

    for (let i = 0; i < length; i++) {
      result += chars[array[i] % chars.length];
    }

    return result;
  }

  /**
   * Clean up expired rate limit attempts
   */
  private cleanupExpiredAttempts(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [key, attempt] of this.rateLimitStore.entries()) {
      // Remove expired blocks
      if (attempt.blocked && attempt.blockExpiry && now > attempt.blockExpiry) {
        expired.push(key);
      }
      // Remove old attempts outside the window
      else if (
        !attempt.blocked &&
        now - attempt.firstAttempt > this.config.rateLimiting.windowMs * 2
      ) {
        expired.push(key);
      }
    }

    expired.forEach(key => this.rateLimitStore.delete(key));
  }

  /**
   * Get current configuration
   */
  getConfig(): AuthValidationConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AuthValidationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get rate limiting statistics
   */
  getRateLimitStats(): {
    totalTrackedIPs: number;
    blockedIPs: number;
    totalAttempts: number;
  } {
    let blockedCount = 0;
    let totalAttempts = 0;

    for (const attempt of this.rateLimitStore.values()) {
      if (attempt.blocked) {
        blockedCount++;
      }
      totalAttempts += attempt.attempts;
    }

    return {
      totalTrackedIPs: this.rateLimitStore.size,
      blockedIPs: blockedCount,
      totalAttempts,
    };
  }

  /**
   * Clear all rate limiting data
   */
  clearRateLimitData(): void {
    this.rateLimitStore.clear();
  }

  /**
   * Clear all CSRF tokens
   */
  clearCSRFTokens(): void {
    this.csrfTokens.clear();
  }
}
