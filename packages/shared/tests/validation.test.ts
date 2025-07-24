import {
  validateEmail,
  validatePassword,
  validateUsername,
  validateRequired,
  sanitizeString,
} from '../src/utils/validation';

describe('Validation utilities', () => {
  describe('validateEmail', () => {
    it('should return true for valid emails', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name@domain.co.uk')).toBe(true);
    });

    it('should return false for invalid emails', () => {
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should return true for passwords with 8 or more characters', () => {
      expect(validatePassword('password123')).toBe(true);
      expect(validatePassword('12345678')).toBe(true);
    });

    it('should return false for passwords with less than 8 characters', () => {
      expect(validatePassword('1234567')).toBe(false);
      expect(validatePassword('pass')).toBe(false);
    });
  });

  describe('validateUsername', () => {
    it('should return true for valid usernames', () => {
      expect(validateUsername('user')).toBe(true);
      expect(validateUsername('username123')).toBe(true);
    });

    it('should return false for usernames that are too short or too long', () => {
      expect(validateUsername('ab')).toBe(false);
      expect(validateUsername('a'.repeat(31))).toBe(false);
    });
  });

  describe('validateRequired', () => {
    it('should return true for non-empty values', () => {
      expect(validateRequired('test')).toBe(true);
      expect(validateRequired(['item'])).toBe(true);
      expect(validateRequired(0)).toBe(true);
    });

    it('should return false for empty values', () => {
      expect(validateRequired('')).toBe(false);
      expect(validateRequired('   ')).toBe(false);
      expect(validateRequired(null)).toBe(false);
      expect(validateRequired(undefined)).toBe(false);
      expect(validateRequired([])).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('should trim and normalize whitespace', () => {
      expect(sanitizeString('  hello   world  ')).toBe('hello world');
      expect(sanitizeString('test\n\nvalue')).toBe('test value');
    });
  });
});
