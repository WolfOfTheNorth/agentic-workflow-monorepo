/**
 * Tests for Supabase Configuration Management
 */

import {
  ConfigurationManager,
  ConfigurationError,
  getConfigurationManager,
  resetConfigurationManager,
} from '../supabase';

// Mock environment variables
const mockEnv = {
  SUPABASE_URL: 'https://test-project.supabase.co',
  SUPABASE_ANON_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3QtcHJvamVjdCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE5MTU2MjA4MDB9.test',
  SUPABASE_SERVICE_ROLE_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3QtcHJvamVjdCIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTkxNTM2MDgwMH0.test',
  AUTH_TOKEN_EXPIRATION: '3600',
  AUTH_REFRESH_THRESHOLD: '300',
  AUTH_MAX_LOGIN_ATTEMPTS: '5',
  AUTH_RATE_LIMIT_WINDOW: '300',
};

describe('ConfigurationManager', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original env
    originalEnv = { ...process.env };

    // Clear environment
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.AUTH_TOKEN_EXPIRATION;
    delete process.env.AUTH_REFRESH_THRESHOLD;
    delete process.env.AUTH_MAX_LOGIN_ATTEMPTS;
    delete process.env.AUTH_RATE_LIMIT_WINDOW;

    // Reset singleton
    resetConfigurationManager();
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
    resetConfigurationManager();
  });

  describe('Constructor and Basic Validation', () => {
    it('should create configuration with valid environment variables', () => {
      // Set valid environment
      Object.assign(process.env, mockEnv);

      expect(() => new ConfigurationManager()).not.toThrow();
    });

    it('should throw error when SUPABASE_URL is missing', () => {
      Object.assign(process.env, { ...mockEnv, SUPABASE_URL: undefined });

      expect(() => new ConfigurationManager()).toThrow(ConfigurationError);
      expect(() => new ConfigurationManager()).toThrow('SUPABASE_URL is not set');
    });

    it('should throw error when SUPABASE_ANON_KEY is missing', () => {
      Object.assign(process.env, { ...mockEnv, SUPABASE_ANON_KEY: undefined });

      expect(() => new ConfigurationManager()).toThrow(ConfigurationError);
      expect(() => new ConfigurationManager()).toThrow('SUPABASE_ANON_KEY is not set');
    });

    it('should work without SUPABASE_SERVICE_ROLE_KEY (optional)', () => {
      Object.assign(process.env, { ...mockEnv, SUPABASE_SERVICE_ROLE_KEY: undefined });

      expect(() => new ConfigurationManager()).not.toThrow();
    });
  });

  describe('URL Validation', () => {
    it('should throw error for invalid Supabase URL', () => {
      Object.assign(process.env, {
        ...mockEnv,
        SUPABASE_URL: 'https://invalid-domain.com',
      });

      expect(() => new ConfigurationManager()).toThrow(ConfigurationError);
      expect(() => new ConfigurationManager()).toThrow('Invalid Supabase URL format');
    });

    it('should throw error for malformed URL', () => {
      Object.assign(process.env, {
        ...mockEnv,
        SUPABASE_URL: 'not-a-url',
      });

      expect(() => new ConfigurationManager()).toThrow(ConfigurationError);
    });
  });

  describe('Key Validation', () => {
    it('should throw error for short anonymous key', () => {
      Object.assign(process.env, {
        ...mockEnv,
        SUPABASE_ANON_KEY: 'short-key',
      });

      expect(() => new ConfigurationManager()).toThrow(ConfigurationError);
      expect(() => new ConfigurationManager()).toThrow('Key appears to be too short');
    });

    it('should throw error for placeholder values', () => {
      Object.assign(process.env, {
        ...mockEnv,
        SUPABASE_ANON_KEY: 'your-anon-key-here',
      });

      expect(() => new ConfigurationManager()).toThrow(ConfigurationError);
      expect(() => new ConfigurationManager()).toThrow('placeholder values');
    });
  });

  describe('Security Configuration Validation', () => {
    it('should use default values when config vars are not set', () => {
      Object.assign(process.env, {
        SUPABASE_URL: mockEnv.SUPABASE_URL,
        SUPABASE_ANON_KEY: mockEnv.SUPABASE_ANON_KEY,
      });

      const manager = new ConfigurationManager();
      const config = manager.getSecurityConfig();

      expect(config.tokenExpiration).toBe(3600);
      expect(config.refreshThreshold).toBe(300);
      expect(config.maxLoginAttempts).toBe(5);
      expect(config.rateLimitWindow).toBe(300);
    });

    it('should throw error for invalid token expiration', () => {
      Object.assign(process.env, {
        ...mockEnv,
        AUTH_TOKEN_EXPIRATION: '100', // Too short
      });

      expect(() => new ConfigurationManager()).toThrow(ConfigurationError);
      expect(() => new ConfigurationManager()).toThrow('Token expiration must be between');
    });

    it('should throw error when refresh threshold >= token expiration', () => {
      Object.assign(process.env, {
        ...mockEnv,
        AUTH_TOKEN_EXPIRATION: '300',
        AUTH_REFRESH_THRESHOLD: '300', // Same as expiration
      });

      expect(() => new ConfigurationManager()).toThrow(ConfigurationError);
    });
  });

  describe('Configuration Access Methods', () => {
    beforeEach(() => {
      Object.assign(process.env, mockEnv);
    });

    it('should return complete configuration', () => {
      const manager = new ConfigurationManager();
      const config = manager.getConfig();

      expect(config).toHaveProperty('supabase');
      expect(config).toHaveProperty('security');
      expect(config.supabase).toHaveProperty('url');
      expect(config.supabase).toHaveProperty('anonKey');
    });

    it('should return Supabase-specific configuration', () => {
      const manager = new ConfigurationManager();
      const supabaseConfig = manager.getSupabaseConfig();

      expect(supabaseConfig.url).toBe(mockEnv.SUPABASE_URL);
      expect(supabaseConfig.anonKey).toBe(mockEnv.SUPABASE_ANON_KEY);
      expect(supabaseConfig.serviceRoleKey).toBe(mockEnv.SUPABASE_SERVICE_ROLE_KEY);
    });

    it('should return security configuration', () => {
      const manager = new ConfigurationManager();
      const securityConfig = manager.getSecurityConfig();

      expect(securityConfig.tokenExpiration).toBe(3600);
      expect(securityConfig.refreshThreshold).toBe(300);
    });
  });

  describe('Static Validation Methods', () => {
    it('should validate environment successfully', () => {
      Object.assign(process.env, mockEnv);

      expect(ConfigurationManager.validateEnvironment()).toBe(true);
    });

    it('should return false for invalid environment', () => {
      Object.assign(process.env, { SUPABASE_URL: 'invalid' });

      expect(ConfigurationManager.validateEnvironment()).toBe(false);
    });

    it('should provide detailed environment status', () => {
      Object.assign(process.env, {
        SUPABASE_URL: mockEnv.SUPABASE_URL,
        // Missing SUPABASE_ANON_KEY
      });

      const status = ConfigurationManager.getEnvironmentStatus();

      expect(status.isConfigured).toBe(false);
      expect(status.missingVariables).toContain('SUPABASE_ANON_KEY');
    });

    it('should detect placeholder values in environment status', () => {
      Object.assign(process.env, {
        SUPABASE_URL: 'https://your-project.supabase.co',
        SUPABASE_ANON_KEY: mockEnv.SUPABASE_ANON_KEY,
      });

      const status = ConfigurationManager.getEnvironmentStatus();

      expect(status.warnings).toContain('SUPABASE_URL appears to be using placeholder value');
    });
  });

  describe('Singleton Pattern', () => {
    beforeEach(() => {
      Object.assign(process.env, mockEnv);
    });

    it('should return same instance on multiple calls', () => {
      const manager1 = getConfigurationManager();
      const manager2 = getConfigurationManager();

      expect(manager1).toBe(manager2);
    });

    it('should create new instance after reset', () => {
      const manager1 = getConfigurationManager();
      resetConfigurationManager();
      const manager2 = getConfigurationManager();

      expect(manager1).not.toBe(manager2);
    });
  });
});

describe('ConfigurationError', () => {
  it('should create error with message only', () => {
    const error = new ConfigurationError('Test message');

    expect(error.message).toBe('Test message');
    expect(error.name).toBe('ConfigurationError');
    expect(error.field).toBeUndefined();
    expect(error.code).toBeUndefined();
  });

  it('should create error with field and code', () => {
    const error = new ConfigurationError('Test message', 'TEST_FIELD', 'TEST_CODE');

    expect(error.message).toBe('Test message');
    expect(error.field).toBe('TEST_FIELD');
    expect(error.code).toBe('TEST_CODE');
  });
});
