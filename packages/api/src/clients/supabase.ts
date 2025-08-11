/**
 * Supabase Client Initialization
 *
 * This module provides a centralized Supabase client initialization with
 * configuration management, validation, and error handling.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseClientConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
  options?: {
    auth?: {
      autoRefreshToken?: boolean;
      persistSession?: boolean;
      detectSessionInUrl?: boolean;
      flowType?: 'implicit' | 'pkce';
    };
    global?: {
      headers?: Record<string, string>;
    };
    db?: {
      schema?: string;
    };
  };
}

export class SupabaseClientError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'SupabaseClientError';
  }
}

/**
 * Supabase Client Manager
 * Handles client initialization, validation, and configuration
 */
export class SupabaseClientManager {
  private static instance: SupabaseClientManager | null = null;
  private client: SupabaseClient<any, 'public', any> | null = null;
  private config: SupabaseClientConfig | null = null;

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): SupabaseClientManager {
    if (!SupabaseClientManager.instance) {
      SupabaseClientManager.instance = new SupabaseClientManager();
    }
    return SupabaseClientManager.instance;
  }

  /**
   * Initialize the Supabase client with configuration validation
   */
  async initialize(
    customConfig?: Partial<SupabaseClientConfig>
  ): Promise<SupabaseClient<any, 'public', any>> {
    try {
      // Load and validate configuration
      this.config = this.loadConfiguration(customConfig);
      this.validateConfiguration(this.config);

      // Create Supabase client
      this.client = createClient(
        this.config.url,
        this.config.anonKey,
        this.config.options
      ) as SupabaseClient<any, 'public', any>;

      // Test connection
      await this.testConnection();

      return this.client;
    } catch (error) {
      throw new SupabaseClientError(
        `Failed to initialize Supabase client: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'INITIALIZATION_ERROR',
        error
      );
    }
  }

  /**
   * Get the initialized Supabase client
   */
  getClient(): SupabaseClient<any, 'public', any> {
    if (!this.client) {
      throw new SupabaseClientError(
        'Supabase client not initialized. Call initialize() first.',
        'CLIENT_NOT_INITIALIZED'
      );
    }
    return this.client;
  }

  /**
   * Get client configuration
   */
  getConfig(): SupabaseClientConfig {
    if (!this.config) {
      throw new SupabaseClientError(
        'Supabase client not initialized. Call initialize() first.',
        'CONFIG_NOT_AVAILABLE'
      );
    }
    return this.config;
  }

  /**
   * Check if client is initialized
   */
  isInitialized(): boolean {
    return this.client !== null;
  }

  /**
   * Reset the client instance (useful for testing or reconfiguration)
   */
  reset(): void {
    this.client = null;
    this.config = null;
  }

  /**
   * Load configuration from environment and merge with custom config
   */
  private loadConfiguration(customConfig?: Partial<SupabaseClientConfig>): SupabaseClientConfig {
    const envConfig: SupabaseClientConfig = {
      url: process.env.SUPABASE_URL || '',
      anonKey: process.env.SUPABASE_ANON_KEY || '',
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      options: {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
        },
        global: {
          headers: {
            'X-Client-Name': 'agentic-workflow',
            'X-Client-Version': '1.0.0',
          },
        },
      },
    };

    // Merge with custom configuration
    if (customConfig) {
      return {
        ...envConfig,
        ...customConfig,
        options: {
          ...envConfig.options,
          ...customConfig.options,
          auth: {
            ...envConfig.options?.auth,
            ...customConfig.options?.auth,
          },
          global: {
            ...envConfig.options?.global,
            ...customConfig.options?.global,
            headers: {
              ...envConfig.options?.global?.headers,
              ...customConfig.options?.global?.headers,
            },
          },
        },
      };
    }

    return envConfig;
  }

  /**
   * Validate the configuration
   */
  private validateConfiguration(config: SupabaseClientConfig): void {
    // Check required fields
    if (!config.url) {
      throw new SupabaseClientError('SUPABASE_URL is required but not provided', 'MISSING_URL');
    }

    if (!config.anonKey) {
      throw new SupabaseClientError(
        'SUPABASE_ANON_KEY is required but not provided',
        'MISSING_ANON_KEY'
      );
    }

    // Validate URL format
    try {
      const url = new URL(config.url);
      if (!url.hostname.includes('supabase.co') && !url.hostname.includes('localhost')) {
        console.warn('Warning: Supabase URL does not appear to be a standard Supabase URL');
      }
    } catch (error) {
      throw new SupabaseClientError('Invalid SUPABASE_URL format', 'INVALID_URL', error);
    }

    // Check for placeholder values
    if (config.url === 'https://your-project.supabase.co') {
      throw new SupabaseClientError(
        'SUPABASE_URL is still using placeholder value. Please update with your actual Supabase project URL.',
        'PLACEHOLDER_URL'
      );
    }

    if (config.anonKey === 'your-anon-key-here') {
      throw new SupabaseClientError(
        'SUPABASE_ANON_KEY is still using placeholder value. Please update with your actual anonymous key.',
        'PLACEHOLDER_ANON_KEY'
      );
    }

    if (config.serviceRoleKey === 'your-service-role-key-here') {
      throw new SupabaseClientError(
        'SUPABASE_SERVICE_ROLE_KEY is still using placeholder value. Please update with your actual service role key.',
        'PLACEHOLDER_SERVICE_KEY'
      );
    }

    // Validate key lengths (Supabase keys are typically JWT tokens)
    if (config.anonKey.length < 100) {
      throw new SupabaseClientError(
        'SUPABASE_ANON_KEY appears to be invalid (too short)',
        'INVALID_ANON_KEY'
      );
    }

    if (config.serviceRoleKey && config.serviceRoleKey.length < 100) {
      throw new SupabaseClientError(
        'SUPABASE_SERVICE_ROLE_KEY appears to be invalid (too short)',
        'INVALID_SERVICE_KEY'
      );
    }
  }

  /**
   * Test the connection to Supabase
   */
  private async testConnection(): Promise<void> {
    if (!this.client) {
      throw new SupabaseClientError(
        'Client not available for connection test',
        'CLIENT_UNAVAILABLE'
      );
    }

    try {
      // Test connection by making a simple query
      const { error } = await this.client.auth.getSession();

      if (error && error.message !== 'Auth session missing!') {
        throw new SupabaseClientError(
          `Connection test failed: ${error.message}`,
          'CONNECTION_TEST_FAILED',
          error
        );
      }

      // Connection successful (session missing is expected for new clients)
    } catch (error) {
      if (error instanceof SupabaseClientError) {
        throw error;
      }

      throw new SupabaseClientError(
        `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CONNECTION_TEST_ERROR',
        error
      );
    }
  }
}

/**
 * Convenience function to get a configured Supabase client
 */
export async function createSupabaseClient(
  config?: Partial<SupabaseClientConfig>
): Promise<SupabaseClient<any, 'public', any>> {
  const manager = SupabaseClientManager.getInstance();
  return await manager.initialize(config);
}

/**
 * Get the existing Supabase client (must be initialized first)
 */
export function getSupabaseClient(): SupabaseClient<any, 'public', any> {
  const manager = SupabaseClientManager.getInstance();
  return manager.getClient();
}

/**
 * Check if Supabase client is initialized
 */
export function isSupabaseClientInitialized(): boolean {
  const manager = SupabaseClientManager.getInstance();
  return manager.isInitialized();
}

/**
 * Validate Supabase configuration without initializing client
 */
export function validateSupabaseConfig(config?: Partial<SupabaseClientConfig>): boolean {
  try {
    const manager = SupabaseClientManager.getInstance();
    const fullConfig = manager['loadConfiguration'](config);
    manager['validateConfiguration'](fullConfig);
    return true;
  } catch (error) {
    if (error instanceof SupabaseClientError) {
      console.error(`Supabase configuration error: ${error.message}`);
      if (error.code) {
        console.error(`Error code: ${error.code}`);
      }
    } else {
      console.error('Unexpected error during configuration validation:', error);
    }
    return false;
  }
}

/**
 * Reset Supabase client (useful for testing or reconfiguration)
 */
export function resetSupabaseClient(): void {
  const manager = SupabaseClientManager.getInstance();
  manager.reset();
}

// Default export
export default SupabaseClientManager;
