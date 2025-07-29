/**
 * Tests for PasswordValidator and PasswordUtils
 */

import {
  PasswordValidator,
  PasswordUtils,
  PasswordValidationConfig,
  DEFAULT_PASSWORD_CONFIG,
  getPasswordValidator,
  resetPasswordValidator,
} from '../password-validator';

describe('PasswordValidator', () => {
  let validator: PasswordValidator;

  beforeEach(() => {
    validator = new PasswordValidator();
    resetPasswordValidator();
  });

  describe('Constructor and Configuration', () => {
    it('should create validator with default configuration', () => {
      const validator = new PasswordValidator();
      expect(validator.getConfig()).toEqual(DEFAULT_PASSWORD_CONFIG);
    });

    it('should create validator with custom configuration', () => {
      const customConfig: Partial<PasswordValidationConfig> = {
        minLength: 12,
        requireUppercase: false,
        minScore: 2,
      };

      const validator = new PasswordValidator(customConfig);
      const config = validator.getConfig();

      expect(config.minLength).toBe(12);
      expect(config.requireUppercase).toBe(false);
      expect(config.minScore).toBe(2);
    });

    it('should update configuration', () => {
      validator.updateConfig({ minLength: 10, minScore: 2 });
      const config = validator.getConfig();

      expect(config.minLength).toBe(10);
      expect(config.minScore).toBe(2);
    });
  });

  describe('Password Validation', () => {
    it('should validate strong password', () => {
      const strongPassword = 'MySecure123!Password';
      const result = validator.validatePassword(strongPassword);

      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(3);
      expect(result.requirements.minLength).toBe(true);
      expect(result.requirements.hasUppercase).toBe(true);
      expect(result.requirements.hasLowercase).toBe(true);
      expect(result.requirements.hasNumbers).toBe(true);
      expect(result.requirements.hasSpecialChars).toBe(true);
      expect(result.requirements.notCommon).toBe(true);
    });

    it('should reject weak password', () => {
      const weakPassword = 'password';
      const result = validator.validatePassword(weakPassword);

      expect(result.isValid).toBe(false);
      expect(result.score).toBeLessThan(3);
      expect(result.requirements.notCommon).toBe(false);
      expect(result.feedback).toContain(
        'This password is too common. Please choose a more unique password'
      );
    });

    it('should reject empty password', () => {
      const result = validator.validatePassword('');

      expect(result.isValid).toBe(false);
      expect(result.score).toBe(0);
      expect(result.feedback).toContain('Password is required');
    });

    it('should reject short password', () => {
      const shortPassword = 'Abc1!';
      const result = validator.validatePassword(shortPassword);

      expect(result.isValid).toBe(false);
      expect(result.requirements.minLength).toBe(false);
      expect(result.feedback).toContain('Password must be at least 8 characters long');
    });

    it('should reject password without uppercase', () => {
      const noUppercase = 'mysecure123!password';
      const result = validator.validatePassword(noUppercase);

      expect(result.requirements.hasUppercase).toBe(false);
      expect(result.feedback).toContain('Add at least one uppercase letter (A-Z)');
    });

    it('should reject password without lowercase', () => {
      const noLowercase = 'MYSECURE123!PASSWORD';
      const result = validator.validatePassword(noLowercase);

      expect(result.requirements.hasLowercase).toBe(false);
      expect(result.feedback).toContain('Add at least one lowercase letter (a-z)');
    });

    it('should reject password without numbers', () => {
      const noNumbers = 'MySecure!Password';
      const result = validator.validatePassword(noNumbers);

      expect(result.requirements.hasNumbers).toBe(false);
      expect(result.feedback).toContain('Add at least one number (0-9)');
    });

    it('should reject password without special characters', () => {
      const noSpecial = 'MySecure123Password';
      const result = validator.validatePassword(noSpecial);

      expect(result.requirements.hasSpecialChars).toBe(false);
      expect(result.feedback).toContain('Add at least one special character (!@#$%^&* etc.)');
    });

    it('should detect excessive repetition', () => {
      const repetitive = 'MyPassword111!';
      const result = validator.validatePassword(repetitive);

      expect(result.feedback).toContain('Avoid repeating the same character multiple times');
    });

    it('should detect simple sequences', () => {
      const sequential = 'MyPassword123!';
      const result = validator.validatePassword(sequential);

      expect(result.feedback).toContain('Avoid simple sequences like "123" or "abc"');
    });

    it('should provide positive feedback for excellent passwords', () => {
      const excellentPassword = 'MyVerySecure$Password2023';
      const result = validator.validatePassword(excellentPassword);

      expect(result.isValid).toBe(true);
      expect(result.score).toBe(4);
      expect(result.feedback).toContain('Excellent! Your password is very strong');
    });

    it('should suggest longer password for better security', () => {
      const shortButValid = 'MyPass1!';
      const result = validator.validatePassword(shortButValid);

      expect(result.feedback).toContain('Consider using a longer password for better security');
    });
  });

  describe('Common Password Detection', () => {
    it('should detect common passwords', () => {
      const commonPasswords = ['password', '123456', 'qwerty', 'admin'];

      commonPasswords.forEach(password => {
        const result = validator.validatePassword(password);
        expect(result.requirements.notCommon).toBe(false);
      });
    });

    it('should detect common passwords with numbers', () => {
      const commonWithNumbers = ['password123', 'admin123', 'qwerty123'];

      commonWithNumbers.forEach(password => {
        const result = validator.validatePassword(password);
        expect(result.requirements.notCommon).toBe(false);
      });
    });

    it('should detect keyboard patterns', () => {
      const keyboardPatterns = ['qwerty123!', 'Asdf1234!', '1234abcd!'];

      keyboardPatterns.forEach(password => {
        const result = validator.validatePassword(password);
        expect(result.requirements.notCommon).toBe(false);
      });
    });
  });

  describe('Configuration Options', () => {
    it('should respect disabled uppercase requirement', () => {
      const validator = new PasswordValidator({ requireUppercase: false });
      const password = 'mysecure123!password';
      const result = validator.validatePassword(password);

      expect(result.requirements.hasUppercase).toBe(true);
    });

    it('should respect custom minimum length', () => {
      const validator = new PasswordValidator({ minLength: 12 });
      const shortPassword = 'MyPass123!';
      const result = validator.validatePassword(shortPassword);

      expect(result.requirements.minLength).toBe(false);
      expect(result.feedback).toContain('Password must be at least 12 characters long');
    });

    it('should respect custom minimum score', () => {
      const validator = new PasswordValidator({ minScore: 2 });
      const mediumPassword = 'MyPassword1';
      const result = validator.validatePassword(mediumPassword);

      // This password might have score 2-3, should be valid with minScore 2
      if (result.score >= 2) {
        expect(result.isValid).toBe(true);
      }
    });

    it('should respect disabled common password checking', () => {
      const validator = new PasswordValidator({ checkCommonPasswords: false });
      const commonPassword = 'Password123!';
      const result = validator.validatePassword(commonPassword);

      expect(result.requirements.notCommon).toBe(true);
    });
  });

  describe('Factory Functions', () => {
    it('should return singleton instance', () => {
      const validator1 = getPasswordValidator();
      const validator2 = getPasswordValidator();

      expect(validator1).toBe(validator2);
    });

    it('should create new instance after reset', () => {
      const validator1 = getPasswordValidator();
      resetPasswordValidator();
      const validator2 = getPasswordValidator();

      expect(validator1).not.toBe(validator2);
    });
  });
});

describe('PasswordUtils', () => {
  describe('Password Generation', () => {
    it('should generate password with default length', () => {
      const password = PasswordUtils.generateSecurePassword();

      expect(password).toHaveLength(16);
      expect(password).toMatch(/[A-Z]/); // Has uppercase
      expect(password).toMatch(/[a-z]/); // Has lowercase
      expect(password).toMatch(/[0-9]/); // Has numbers
      expect(password).toMatch(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/); // Has special chars
    });

    it('should generate password with custom length', () => {
      const password = PasswordUtils.generateSecurePassword(24);

      expect(password).toHaveLength(24);
    });

    it('should generate unique passwords', () => {
      const password1 = PasswordUtils.generateSecurePassword();
      const password2 = PasswordUtils.generateSecurePassword();

      expect(password1).not.toBe(password2);
    });

    it('should generate valid passwords according to validator', () => {
      const validator = new PasswordValidator();

      for (let i = 0; i < 10; i++) {
        const password = PasswordUtils.generateSecurePassword();
        const result = validator.validatePassword(password);

        expect(result.isValid).toBe(true);
        expect(result.score).toBeGreaterThanOrEqual(3);
      }
    });
  });

  describe('Password Breach Checking', () => {
    it('should detect breached common passwords', async () => {
      const commonPassword = 'password';
      const result = await PasswordUtils.checkPasswordBreach(commonPassword);

      expect(result.isBreached).toBe(true);
      expect(result.count).toBeGreaterThan(0);
    });

    it('should not detect breach for unique passwords', async () => {
      const uniquePassword = 'MyVeryUniquePassword123!@';
      const result = await PasswordUtils.checkPasswordBreach(uniquePassword);

      expect(result.isBreached).toBe(false);
      expect(result.count).toBe(0);
    });
  });

  describe('Crack Time Estimation', () => {
    it('should estimate crack time for weak password', () => {
      const weakPassword = 'abc123';
      const result = PasswordUtils.estimateCrackTime(weakPassword);

      expect(result.seconds).toBeLessThan(86400); // Less than a day
      expect(result.display).toBeDefined();
      expect(result.assumptions).toContain('brute force');
    });

    it('should estimate crack time for strong password', () => {
      const strongPassword = 'MyVerySecure$Password2023!';
      const result = PasswordUtils.estimateCrackTime(strongPassword);

      expect(result.seconds).toBeGreaterThan(31536000); // More than a year
      expect(result.display).toBeDefined();
    });

    it('should handle different character sets', () => {
      const numbersOnly = '12345678';
      const numbersResult = PasswordUtils.estimateCrackTime(numbersOnly);

      const mixed = 'AbC123!@';
      const mixedResult = PasswordUtils.estimateCrackTime(mixed);

      expect(mixedResult.seconds).toBeGreaterThan(numbersResult.seconds);
    });

    it('should provide display formats', () => {
      const testCases = [
        { password: '123', expectedUnit: 'seconds' },
        { password: '123456', expectedUnit: 'minutes' },
        { password: 'MyPass1!', expectedUnit: 'years' },
      ];

      testCases.forEach(testCase => {
        const result = PasswordUtils.estimateCrackTime(testCase.password);
        expect(result.display).toContain(testCase.expectedUnit);
      });
    });
  });
});

describe('Password Validation Edge Cases', () => {
  let validator: PasswordValidator;

  beforeEach(() => {
    validator = new PasswordValidator();
  });

  it('should handle null password gracefully', () => {
    const result = validator.validatePassword(null as any);

    expect(result.isValid).toBe(false);
    expect(result.feedback).toContain('Password is required');
  });

  it('should handle undefined password gracefully', () => {
    const result = validator.validatePassword(undefined as any);

    expect(result.isValid).toBe(false);
    expect(result.feedback).toContain('Password is required');
  });

  it('should handle very long passwords', () => {
    const veryLongPassword = 'MyVeryLongSecure123!'.repeat(10);
    const result = validator.validatePassword(veryLongPassword);

    expect(result.isValid).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(3);
  });

  it('should handle passwords with unicode characters', () => {
    const unicodePassword = 'MyPässwörd123!';
    const result = validator.validatePassword(unicodePassword);

    expect(result.requirements.minLength).toBe(true);
    expect(result.requirements.hasUppercase).toBe(true);
    expect(result.requirements.hasLowercase).toBe(true);
  });

  it('should handle passwords with whitespace', () => {
    const passwordWithSpaces = 'My Secure 123! Password';
    const result = validator.validatePassword(passwordWithSpaces);

    expect(result.requirements.minLength).toBe(true);
    expect(result.requirements.hasUppercase).toBe(true);
    expect(result.requirements.hasLowercase).toBe(true);
    expect(result.requirements.hasNumbers).toBe(true);
    expect(result.requirements.hasSpecialChars).toBe(true);
  });
});
