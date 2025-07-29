/**
 * Supabase Configuration Management
 *
 * This module handles Supabase configuration validation and management
 * for the authentication system integration.
 */

/**
 * Supabase configuration interface
 */
export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
  options?: {
    db?: {
      schema?: string;
    };
    auth?: {
      autoRefreshToken?: boolean;
      persistSession?: boolean;
      detectSessionInUrl?: boolean;
    };
  };
}

/**
 * Security configuration interface
 */
export interface AuthSecurityConfig {
  tokenExpiration: number;
  refreshThreshold: number;
  maxLoginAttempts: number;
  rateLimitWindow: number;
}

/**
 * Complete configuration interface
 */
export interface AuthConfig {
  supabase: SupabaseConfig;
  security: AuthSecurityConfig;
}

/**
 * Configuration validation error
 */
export class ConfigurationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  isValid: boolean;
  errors: ConfigurationError[];
  warnings: string[];
}

/**
 * Environment configuration status
 */
export interface EnvironmentStatus {
  isConfigured: boolean;
  missingVariables: string[];
  invalidVariables: string[];
  warnings: string[];
}

/**
 * Configuration Manager for Supabase authentication
 */
export class ConfigurationManager {
  private config: AuthConfig;

  constructor() {
    this.config = this.loadConfiguration();
    this.validateConfiguration();
  }

  /**
   * Get the current configuration
   */
  getConfig(): AuthConfig {
    return this.config;
  }

  /**
   * Get Supabase configuration
   */
  getSupabaseConfig(): SupabaseConfig {
    return this.config.supabase;
  }

  /**
   * Get security configuration
   */
  getSecurityConfig(): AuthSecurityConfig {
    return this.config.security;
  }

  /**
   * Load configuration from environment variables
   */
  private loadConfiguration(): AuthConfig {
    return {
      supabase: {
        url: this.getRequiredEnvVar('SUPABASE_URL'),
        anonKey: this.getRequiredEnvVar('SUPABASE_ANON_KEY'),
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        options: {
          auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
          },
        },
      },
      security: {
        tokenExpiration: parseInt(process.env.AUTH_TOKEN_EXPIRATION || '3600'),
        refreshThreshold: parseInt(process.env.AUTH_REFRESH_THRESHOLD || '300'),
        maxLoginAttempts: parseInt(process.env.AUTH_MAX_LOGIN_ATTEMPTS || '5'),
        rateLimitWindow: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW || '300'),
      },
    };
  }

  /**
   * Get required environment variable with validation
   */
  private getRequiredEnvVar(name: string): string {
    const value = process.env[name];
    if (!value || value.trim() === '') {
      throw new ConfigurationError(
        `Required environment variable ${name} is not set`,
        name,
        'MISSING_REQUIRED_VAR'
      );
    }
    return value.trim();
  }

  /**
   * Validate the complete configuration
   */
  private validateConfiguration(): void {
    this.validateSupabaseConfig();
    this.validateSecurityConfig();
  }

  /**
   * Validate Supabase configuration
   */
  private validateSupabaseConfig(): void {
    const { supabase } = this.config;

    // Validate Supabase URL
    if (!supabase.url.includes('supabase.co')) {
      throw new ConfigurationError(
        'Invalid Supabase URL format. Must be a valid Supabase project URL',
        'SUPABASE_URL',
        'INVALID_SUPABASE_URL'
      );
    }

    try {
      new URL(supabase.url);
    } catch {
      throw new ConfigurationError(
        'Invalid Supabase URL format. Must be a valid URL',
        'SUPABASE_URL',
        'MALFORMED_URL'
      );
    }

    // Check for placeholder values first
    if (
      supabase.anonKey === 'your-anon-key-here' ||
      supabase.serviceRoleKey === 'your-service-role-key-here'
    ) {
      throw new ConfigurationError(
        'Supabase keys are still using placeholder values. Please update with actual keys.',
        supabase.anonKey === 'your-anon-key-here'
          ? 'SUPABASE_ANON_KEY'
          : 'SUPABASE_SERVICE_ROLE_KEY',
        'PLACEHOLDER_VALUE'
      );
    }

    // Validate anonymous key
    if (supabase.anonKey.length < 32) {
      throw new ConfigurationError(
        'Invalid Supabase anonymous key. Key appears to be too short',
        'SUPABASE_ANON_KEY',
        'INVALID_ANON_KEY'
      );
    }

    // Validate service role key if provided
    if (supabase.serviceRoleKey && supabase.serviceRoleKey.length < 32) {
      throw new ConfigurationError(
        'Invalid Supabase service role key. Key appears to be too short',
        'SUPABASE_SERVICE_ROLE_KEY',
        'INVALID_SERVICE_KEY'
      );
    }

    // Check for common configuration mistakes
    if (supabase.url.includes('localhost') || supabase.url.includes('127.0.0.1')) {
      console.warn(
        'Warning: Supabase URL appears to be pointing to localhost. ' +
          'Make sure this is intended for development.'
      );
    }
  }

  /**
   * Validate security configuration
   */
  private validateSecurityConfig(): void {
    const { security } = this.config;

    // Validate token expiration
    if (security.tokenExpiration < 300 || security.tokenExpiration > 86400) {
      throw new ConfigurationError(
        'Token expiration must be between 300 seconds (5 minutes) and 86400 seconds (24 hours)',
        'AUTH_TOKEN_EXPIRATION',
        'INVALID_TOKEN_EXPIRATION'
      );
    }

    // Validate refresh threshold
    if (security.refreshThreshold < 60 || security.refreshThreshold >= security.tokenExpiration) {
      throw new ConfigurationError(
        'Refresh threshold must be at least 60 seconds and less than token expiration time',
        'AUTH_REFRESH_THRESHOLD',
        'INVALID_REFRESH_THRESHOLD'
      );
    }

    // Validate max login attempts
    if (security.maxLoginAttempts < 3 || security.maxLoginAttempts > 20) {
      throw new ConfigurationError(
        'Max login attempts must be between 3 and 20',
        'AUTH_MAX_LOGIN_ATTEMPTS',
        'INVALID_MAX_ATTEMPTS'
      );
    }

    // Validate rate limit window
    if (security.rateLimitWindow < 60 || security.rateLimitWindow > 3600) {
      throw new ConfigurationError(
        'Rate limit window must be between 60 seconds (1 minute) and 3600 seconds (1 hour)',
        'AUTH_RATE_LIMIT_WINDOW',
        'INVALID_RATE_LIMIT_WINDOW'
      );
    }
  }

  /**
   * Create a configuration instance with validation
   */
  static create(): ConfigurationManager {
    return new ConfigurationManager();
  }

  /**
   * Validate environment without creating a full configuration instance
   */
  static validateEnvironment(): boolean {
    try {
      new ConfigurationManager();
      return true;
    } catch (error) {
      if (error instanceof ConfigurationError) {
        console.error(`Configuration Error: ${error.message}`);
        if (error.field) {
          console.error(`Field: ${error.field}`);
        }
      } else {
        console.error('Unexpected configuration error:', error);
      }
      return false;
    }
  }

  /**
   * Get detailed environment validation status
   */
  static getEnvironmentStatus(): EnvironmentStatus {
    const requiredVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
    const optionalVars = ['SUPABASE_SERVICE_ROLE_KEY'];
    const configVars = [
      'AUTH_TOKEN_EXPIRATION',
      'AUTH_REFRESH_THRESHOLD',
      'AUTH_MAX_LOGIN_ATTEMPTS',
      'AUTH_RATE_LIMIT_WINDOW',
    ];

    const missingVariables: string[] = [];
    const invalidVariables: string[] = [];
    const warnings: string[] = [];

    // Check required variables
    for (const varName of requiredVars) {
      const value = process.env[varName];
      if (!value || value.trim() === '') {
        missingVariables.push(varName);
      } else if (value === 'your-anon-key-here' || value === 'https://your-project.supabase.co') {
        invalidVariables.push(varName);
        warnings.push(`${varName} appears to be using placeholder value`);
      }
    }

    // Check optional variables for placeholder values
    for (const varName of optionalVars) {
      const value = process.env[varName];
      if (value === 'your-service-role-key-here') {
        warnings.push(`${varName} appears to be using placeholder value`);
      }
    }

    // Validate configuration variables
    for (const varName of configVars) {
      const value = process.env[varName];
      if (value && isNaN(parseInt(value))) {
        invalidVariables.push(varName);
        warnings.push(`${varName} must be a valid number`);
      }
    }

    // Additional URL validation
    const supabaseUrl = process.env.SUPABASE_URL;
    if (supabaseUrl && !supabaseUrl.includes('supabase.co')) {
      invalidVariables.push('SUPABASE_URL');
      warnings.push('SUPABASE_URL does not appear to be a valid Supabase URL');
    }

    return {
      isConfigured: missingVariables.length === 0 && invalidVariables.length === 0,
      missingVariables,
      invalidVariables,
      warnings,
    };
  }

  /**
   * Perform comprehensive configuration validation
   */
  static validateConfiguration(): ConfigValidationResult {
    const errors: ConfigurationError[] = [];
    const warnings: string[] = [];

    try {
      new ConfigurationManager();

      // If we got here, basic validation passed
      // Add any warnings from environment status
      const envStatus = this.getEnvironmentStatus();
      warnings.push(...envStatus.warnings);

      return {
        isValid: true,
        errors: [],
        warnings,
      };
    } catch (error) {
      if (error instanceof ConfigurationError) {
        errors.push(error);
      } else {
        errors.push(
          new ConfigurationError(
            'Unexpected configuration validation error',
            undefined,
            'UNKNOWN_ERROR'
          )
        );
      }

      return {
        isValid: false,
        errors,
        warnings,
      };
    }
  }

  /**
   * Validate configuration and provide detailed feedback
   */
  static diagnoseConfiguration(): void {
    console.log('🔍 Diagnosing Supabase configuration...\n');

    const status = this.getEnvironmentStatus();
    const validation = this.validateConfiguration();

    // Report missing variables
    if (status.missingVariables.length > 0) {
      console.error('❌ Missing required environment variables:');
      status.missingVariables.forEach(variable => {
        console.error(`  - ${variable}`);
      });
      console.log('');
    }

    // Report invalid variables
    if (status.invalidVariables.length > 0) {
      console.error('⚠️  Invalid environment variables:');
      status.invalidVariables.forEach(variable => {
        console.error(`  - ${variable}`);
      });
      console.log('');
    }

    // Report validation errors
    if (validation.errors.length > 0) {
      console.error('❌ Configuration validation errors:');
      validation.errors.forEach(error => {
        console.error(`  - ${error.message}`);
        if (error.field) {
          console.error(`    Field: ${error.field}`);
        }
      });
      console.log('');
    }

    // Report warnings
    if (status.warnings.length > 0 || validation.warnings.length > 0) {
      console.warn('⚠️  Configuration warnings:');
      [...status.warnings, ...validation.warnings].forEach(warning => {
        console.warn(`  - ${warning}`);
      });
      console.log('');
    }

    // Final status
    if (status.isConfigured && validation.isValid) {
      console.log('✅ Configuration is valid and ready to use!');
    } else {
      console.error('❌ Configuration issues found. Please fix the above errors.');
    }
  }
}

/**
 * Default export for configuration manager singleton
 */
let configInstance: ConfigurationManager | null = null;

export function getConfigurationManager(): ConfigurationManager {
  if (!configInstance) {
    configInstance = ConfigurationManager.create();
  }
  return configInstance;
}

/**
 * Reset configuration instance (useful for testing)
 */
export function resetConfigurationManager(): void {
  configInstance = null;
}
