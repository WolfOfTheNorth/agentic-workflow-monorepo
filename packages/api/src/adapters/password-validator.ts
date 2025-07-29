/**
 * Password Strength Validation Utilities
 *
 * This module provides comprehensive password validation including strength assessment,
 * requirement checking, common password detection, and detailed feedback for users.
 */

import { PasswordStrengthResult } from '../types/auth';

/**
 * Configuration for password validation
 */
export interface PasswordValidationConfig {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  minScore: number; // Minimum score (0-4) to be considered valid
  checkCommonPasswords: boolean;
  allowRepetition: boolean;
  maxRepetition: number;
}

/**
 * Default password validation configuration
 */
export const DEFAULT_PASSWORD_CONFIG: PasswordValidationConfig = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  minScore: 3,
  checkCommonPasswords: true,
  allowRepetition: true,
  maxRepetition: 3,
};

/**
 * Common weak passwords (subset for demonstration)
 */
const COMMON_PASSWORDS = new Set([
  'password',
  '123456',
  '123456789',
  'qwerty',
  'abc123',
  'password123',
  'admin',
  'letmein',
  'welcome',
  'monkey',
  '1234567890',
  'password1',
  'qwerty123',
  'welcome123',
  'admin123',
  'root',
  'toor',
  'pass',
  'test',
  'guest',
  'user',
  'demo',
  'sample',
  '000000',
  '111111',
  '123123',
  '654321',
  'dragon',
  'mustang',
  'master',
  'shadow',
  'baseball',
  'football',
  'basketball',
  'superman',
  'batman',
  'princess',
  'sunshine',
  'iloveyou',
  'lovely',
  'family',
  'michael',
  'jennifer',
  'jessica',
  'ashley',
  'amanda',
]);

/**
 * Special characters for password validation
 */
const SPECIAL_CHARS = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/;

/**
 * Password validation patterns
 */
const VALIDATION_PATTERNS = {
  uppercase: /[A-Z]/,
  lowercase: /[a-z]/,
  numbers: /[0-9]/,
  specialChars: SPECIAL_CHARS,
  repetition: /(.)\1{2,}/g, // 3+ consecutive identical characters
  sequence:
    /(012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i,
};

/**
 * PasswordValidator class for comprehensive password validation
 */
export class PasswordValidator {
  private config: PasswordValidationConfig;
  private logger: PasswordValidationLogger;

  constructor(config?: Partial<PasswordValidationConfig>) {
    this.config = { ...DEFAULT_PASSWORD_CONFIG, ...config };
    this.logger = new PasswordValidationLogger('PasswordValidator');
  }

  /**
   * Validate password strength and requirements
   */
  validatePassword(password: string): PasswordStrengthResult {
    this.logger.debug('Validating password strength', {
      length: password.length,
      hasContent: password.length > 0,
    });

    if (!password) {
      return this.createFailedResult('Password is required', {});
    }

    const requirements = this.checkRequirements(password);
    const score = this.calculateScore(password, requirements);
    const feedback = this.generateFeedback(password, requirements, score);
    const isValid = this.isPasswordValid(score, requirements);

    const result: PasswordStrengthResult = {
      isValid,
      score,
      feedback,
      requirements,
    };

    this.logger.debug('Password validation completed', {
      isValid,
      score,
      feedbackCount: feedback.length,
    });

    return result;
  }

  /**
   * Check if password meets all requirements
   */
  private checkRequirements(password: string): PasswordStrengthResult['requirements'] {
    const requirements = {
      minLength: password.length >= this.config.minLength,
      hasUppercase: !this.config.requireUppercase || VALIDATION_PATTERNS.uppercase.test(password),
      hasLowercase: !this.config.requireLowercase || VALIDATION_PATTERNS.lowercase.test(password),
      hasNumbers: !this.config.requireNumbers || VALIDATION_PATTERNS.numbers.test(password),
      hasSpecialChars:
        !this.config.requireSpecialChars || VALIDATION_PATTERNS.specialChars.test(password),
      notCommon: !this.config.checkCommonPasswords || !this.isCommonPassword(password),
    };

    return requirements;
  }

  /**
   * Calculate password strength score (0-4)
   */
  private calculateScore(
    password: string,
    requirements: PasswordStrengthResult['requirements']
  ): number {
    let score = 0;

    // Base score for length
    if (password.length >= this.config.minLength) score += 1;
    if (password.length >= 12) score += 1;

    // Character variety
    if (requirements.hasUppercase && requirements.hasLowercase) score += 1;
    if (requirements.hasNumbers) score += 1;
    if (requirements.hasSpecialChars) score += 1;

    // Deduct points for common issues
    if (!requirements.notCommon) score -= 2;
    if (this.hasExcessiveRepetition(password)) score -= 1;
    if (this.hasSimpleSequences(password)) score -= 1;

    // Ensure score is within bounds
    return Math.max(0, Math.min(4, score));
  }

  /**
   * Generate user-friendly feedback
   */
  private generateFeedback(
    password: string,
    requirements: PasswordStrengthResult['requirements'],
    score: number
  ): string[] {
    const feedback: string[] = [];

    // Length feedback
    if (!requirements.minLength) {
      feedback.push(`Password must be at least ${this.config.minLength} characters long`);
    } else if (password.length < 12) {
      feedback.push('Consider using a longer password for better security');
    }

    // Character requirements
    if (!requirements.hasUppercase) {
      feedback.push('Add at least one uppercase letter (A-Z)');
    }

    if (!requirements.hasLowercase) {
      feedback.push('Add at least one lowercase letter (a-z)');
    }

    if (!requirements.hasNumbers) {
      feedback.push('Add at least one number (0-9)');
    }

    if (!requirements.hasSpecialChars) {
      feedback.push('Add at least one special character (!@#$%^&* etc.)');
    }

    // Common password warning
    if (!requirements.notCommon) {
      feedback.push('This password is too common. Please choose a more unique password');
    }

    // Pattern issues
    if (this.hasExcessiveRepetition(password)) {
      feedback.push('Avoid repeating the same character multiple times');
    }

    if (this.hasSimpleSequences(password)) {
      feedback.push('Avoid simple sequences like "123" or "abc"');
    }

    // Positive feedback for strong passwords
    if (score === 4 && feedback.length === 0) {
      feedback.push('Excellent! Your password is very strong');
    } else if (score >= 3 && feedback.length <= 1) {
      feedback.push('Good password strength');
    }

    return feedback;
  }

  /**
   * Check if password is valid based on score and requirements
   */
  private isPasswordValid(
    score: number,
    requirements: PasswordStrengthResult['requirements']
  ): boolean {
    const meetsMinScore = score >= this.config.minScore;
    const meetsAllRequirements = Object.values(requirements).every(req => req === true);

    return meetsMinScore && meetsAllRequirements;
  }

  /**
   * Check if password is in common passwords list
   */
  private isCommonPassword(password: string): boolean {
    const lowerPassword = password.toLowerCase();

    // Check exact match
    if (COMMON_PASSWORDS.has(lowerPassword)) {
      return true;
    }

    // Check with common variations (numbers at the end)
    const withoutNumbers = lowerPassword.replace(/\d+$/, '');
    if (COMMON_PASSWORDS.has(withoutNumbers)) {
      return true;
    }

    // Check simple keyboard patterns
    const keyboardPatterns = ['qwerty', 'asdf', 'zxcv', '1234', 'abcd'];
    return keyboardPatterns.some(pattern => lowerPassword.includes(pattern));
  }

  /**
   * Check for excessive character repetition
   */
  private hasExcessiveRepetition(password: string): boolean {
    if (!this.config.allowRepetition) {
      return VALIDATION_PATTERNS.repetition.test(password);
    }

    const matches = password.match(VALIDATION_PATTERNS.repetition);
    if (!matches) return false;

    return matches.some(match => match.length > this.config.maxRepetition);
  }

  /**
   * Check for simple character sequences
   */
  private hasSimpleSequences(password: string): boolean {
    return VALIDATION_PATTERNS.sequence.test(password);
  }

  /**
   * Create a failed validation result
   */
  private createFailedResult(
    message: string,
    requirements: Partial<PasswordStrengthResult['requirements']>
  ): PasswordStrengthResult {
    return {
      isValid: false,
      score: 0,
      feedback: [message],
      requirements: {
        minLength: false,
        hasUppercase: false,
        hasLowercase: false,
        hasNumbers: false,
        hasSpecialChars: false,
        notCommon: false,
        ...requirements,
      },
    };
  }

  /**
   * Get password validation configuration
   */
  getConfig(): PasswordValidationConfig {
    return { ...this.config };
  }

  /**
   * Update password validation configuration
   */
  updateConfig(newConfig: Partial<PasswordValidationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Password validation configuration updated', {
      minLength: this.config.minLength,
      minScore: this.config.minScore,
    });
  }
}

/**
 * Utility functions for password validation
 */
export class PasswordUtils {
  /**
   * Generate a secure random password
   */
  static generateSecurePassword(length: number = 16): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    const allChars = uppercase + lowercase + numbers + special;
    let password = '';

    // Ensure at least one character from each category
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];

    // Fill the rest with random characters
    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the password to avoid predictable patterns
    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
  }

  /**
   * Check if a password has been breached (mock implementation)
   */
  static async checkPasswordBreach(
    password: string
  ): Promise<{ isBreached: boolean; count?: number }> {
    // In a real implementation, this would check against a service like HaveIBeenPwned
    // For now, we'll just check against our common passwords list
    const isCommon = COMMON_PASSWORDS.has(password.toLowerCase());

    return {
      isBreached: isCommon,
      count: isCommon ? 100000 : 0, // Mock breach count
    };
  }

  /**
   * Estimate time to crack password
   */
  static estimateCrackTime(password: string): {
    seconds: number;
    display: string;
    assumptions: string;
  } {
    // Character set size calculation
    let charsetSize = 0;
    if (/[a-z]/.test(password)) charsetSize += 26;
    if (/[A-Z]/.test(password)) charsetSize += 26;
    if (/[0-9]/.test(password)) charsetSize += 10;
    if (SPECIAL_CHARS.test(password)) charsetSize += 32;

    // Entropy calculation: log2(charsetSize^length)
    const entropy = password.length * Math.log2(charsetSize);

    // Assume 1 billion guesses per second (modern hardware)
    const guessesPerSecond = 1e9;
    const secondsToCrack = Math.pow(2, entropy) / (2 * guessesPerSecond);

    let display: string;
    if (secondsToCrack < 60) {
      display = `${Math.round(secondsToCrack)} seconds`;
    } else if (secondsToCrack < 3600) {
      display = `${Math.round(secondsToCrack / 60)} minutes`;
    } else if (secondsToCrack < 86400) {
      display = `${Math.round(secondsToCrack / 3600)} hours`;
    } else if (secondsToCrack < 31536000) {
      display = `${Math.round(secondsToCrack / 86400)} days`;
    } else if (secondsToCrack < 31536000000) {
      display = `${Math.round(secondsToCrack / 31536000)} years`;
    } else {
      display = 'centuries';
    }

    return {
      seconds: secondsToCrack,
      display,
      assumptions: 'Assumes brute force attack at 1 billion guesses/second',
    };
  }
}

/**
 * Password validation logger
 */
class PasswordValidationLogger {
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
 * Default password validator instance
 */
let defaultValidator: PasswordValidator | null = null;

export function getPasswordValidator(
  config?: Partial<PasswordValidationConfig>
): PasswordValidator {
  if (!defaultValidator) {
    defaultValidator = new PasswordValidator(config);
  }
  return defaultValidator;
}

/**
 * Validate password using default validator instance
 */
export function validatePassword(
  password: string,
  config?: Partial<PasswordValidationConfig>
): PasswordStrengthResult {
  const validator = getPasswordValidator(config);
  return validator.validatePassword(password);
}

/**
 * Reset password validator instance
 */
export function resetPasswordValidator(): void {
  defaultValidator = null;
}
