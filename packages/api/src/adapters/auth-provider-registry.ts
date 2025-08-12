/**
 * Authentication Provider Registry
 *
 * Provides a flexible, extensible system for managing multiple authentication
 * providers including OAuth, 2FA, biometric authentication, and future methods.
 */

import { AuthUser, AuthSession } from '@agentic-workflow/shared';

export interface AuthProviderCapabilities {
  supportsLogin: boolean;
  supportsSignup: boolean;
  supportsPasswordReset: boolean;
  supportsProfileUpdate: boolean;
  supportsSessionRefresh: boolean;
  requiresRedirect: boolean;
  supportsMFA: boolean;
  supportsPasswordless: boolean;
}

export interface AuthProviderMetadata {
  id: string;
  name: string;
  displayName: string;
  description: string;
  iconUrl?: string;
  documentationUrl?: string;
  capabilities: AuthProviderCapabilities;
  priority: number; // Higher priority providers are preferred
  enabled: boolean;
  featureFlags: string[];
  configuration: Record<string, any>;
}

export interface AuthProviderContext {
  ip?: string;
  userAgent?: string;
  origin?: string;
  sessionId?: string;
  userId?: string;
  deviceId?: string;
  [key: string]: any;
}

export interface AuthProviderResult {
  success: boolean;
  user?: AuthUser;
  session?: AuthSession;
  tokens?: {
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
  };
  redirectUrl?: string;
  requiresVerification?: boolean;
  verificationMethod?: 'email' | 'sms' | 'app' | 'hardware';
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  metadata?: Record<string, any>;
}

export interface AuthProvider {
  readonly metadata: AuthProviderMetadata;

  // Core authentication methods
  login?(
    credentials: Record<string, any>,
    context?: AuthProviderContext
  ): Promise<AuthProviderResult>;
  signup?(
    userData: Record<string, any>,
    context?: AuthProviderContext
  ): Promise<AuthProviderResult>;
  logout?(context?: AuthProviderContext): Promise<AuthProviderResult>;

  // Session management
  refreshSession?(refreshToken: string, context?: AuthProviderContext): Promise<AuthProviderResult>;
  validateSession?(
    sessionToken: string,
    context?: AuthProviderContext
  ): Promise<AuthProviderResult>;

  // Password management
  resetPassword?(email: string, context?: AuthProviderContext): Promise<AuthProviderResult>;
  updatePassword?(newPassword: string, context?: AuthProviderContext): Promise<AuthProviderResult>;

  // Profile management
  getProfile?(context?: AuthProviderContext): Promise<AuthProviderResult>;
  updateProfile?(
    updates: Partial<AuthUser>,
    context?: AuthProviderContext
  ): Promise<AuthProviderResult>;

  // Multi-factor authentication
  setupMFA?(method: string, context?: AuthProviderContext): Promise<AuthProviderResult>;
  verifyMFA?(
    code: string,
    method: string,
    context?: AuthProviderContext
  ): Promise<AuthProviderResult>;
  disableMFA?(method: string, context?: AuthProviderContext): Promise<AuthProviderResult>;

  // OAuth/Social login
  initiateOAuth?(redirectUri: string, context?: AuthProviderContext): Promise<AuthProviderResult>;
  handleOAuthCallback?(
    code: string,
    state: string,
    context?: AuthProviderContext
  ): Promise<AuthProviderResult>;

  // Lifecycle methods
  initialize?(): Promise<void>;
  dispose?(): Promise<void>;

  // Health check
  healthCheck?(): Promise<{ healthy: boolean; details?: Record<string, any> }>;
}

export interface ProviderRegistryConfig {
  enabledProviders: string[];
  defaultProvider: string;
  featureFlags: Record<string, boolean>;
  providerConfigs: Record<string, Record<string, any>>;
  fallbackBehavior: 'fail' | 'retry' | 'skip';
  maxRetries: number;
  retryDelay: number;
}

export const DEFAULT_PROVIDER_REGISTRY_CONFIG: ProviderRegistryConfig = {
  enabledProviders: ['supabase'],
  defaultProvider: 'supabase',
  featureFlags: {
    oauth_providers: false,
    mfa_providers: false,
    biometric_auth: false,
    passwordless_auth: false,
  },
  providerConfigs: {},
  fallbackBehavior: 'fail',
  maxRetries: 3,
  retryDelay: 1000,
};

export class AuthProviderRegistry {
  private providers = new Map<string, AuthProvider>();
  private config: ProviderRegistryConfig;
  private initializationPromises = new Map<string, Promise<void>>();

  constructor(config: Partial<ProviderRegistryConfig> = {}) {
    this.config = { ...DEFAULT_PROVIDER_REGISTRY_CONFIG, ...config };
  }

  /**
   * Register an authentication provider
   */
  registerProvider(provider: AuthProvider): void {
    const { id } = provider.metadata;

    // Validate provider metadata
    this.validateProvider(provider);

    // Check if provider is enabled
    if (!this.isProviderEnabled(id)) {
      console.warn(`Provider ${id} is registered but not enabled`);
      return;
    }

    this.providers.set(id, provider);

    // Initialize provider if it supports initialization
    if (provider.initialize) {
      const initPromise = provider.initialize().catch(error => {
        console.error(`Failed to initialize provider ${id}:`, error);
        throw error;
      });

      this.initializationPromises.set(id, initPromise);
    }
  }

  /**
   * Unregister a provider
   */
  async unregisterProvider(providerId: string): Promise<void> {
    const provider = this.providers.get(providerId);
    if (!provider) return;

    // Dispose provider if it supports disposal
    if (provider.dispose) {
      await provider.dispose();
    }

    this.providers.delete(providerId);
    this.initializationPromises.delete(providerId);
  }

  /**
   * Get a specific provider
   */
  getProvider(providerId: string): AuthProvider | null {
    return this.providers.get(providerId) || null;
  }

  /**
   * Get the default provider
   */
  getDefaultProvider(): AuthProvider | null {
    return this.getProvider(this.config.defaultProvider);
  }

  /**
   * Get all registered providers
   */
  getAllProviders(): AuthProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get providers that support a specific capability
   */
  getProvidersByCapability(capability: keyof AuthProviderCapabilities): AuthProvider[] {
    return this.getAllProviders()
      .filter(provider => provider.metadata.capabilities[capability])
      .sort((a, b) => b.metadata.priority - a.metadata.priority);
  }

  /**
   * Get providers for OAuth authentication
   */
  getOAuthProviders(): AuthProvider[] {
    return this.getAllProviders()
      .filter(
        provider =>
          provider.metadata.capabilities.requiresRedirect &&
          provider.initiateOAuth &&
          this.config.featureFlags.oauth_providers
      )
      .sort((a, b) => b.metadata.priority - a.metadata.priority);
  }

  /**
   * Get providers for MFA
   */
  getMFAProviders(): AuthProvider[] {
    return this.getAllProviders()
      .filter(
        provider =>
          provider.metadata.capabilities.supportsMFA &&
          provider.setupMFA &&
          this.config.featureFlags.mfa_providers
      )
      .sort((a, b) => b.metadata.priority - a.metadata.priority);
  }

  /**
   * Execute operation with provider fallback
   */
  async executeWithFallback<T>(
    operation: (provider: AuthProvider) => Promise<T>,
    providerIds?: string[]
  ): Promise<T> {
    const providers = providerIds
      ? (providerIds.map(id => this.getProvider(id)).filter(Boolean) as AuthProvider[])
      : ([this.getDefaultProvider()].filter(Boolean) as AuthProvider[]);

    if (providers.length === 0) {
      throw new Error('No providers available for operation');
    }

    let lastError: Error | null = null;

    for (const provider of providers) {
      // Wait for provider initialization
      const initPromise = this.initializationPromises.get(provider.metadata.id);
      if (initPromise) {
        await initPromise;
      }

      let attempts = 0;
      while (attempts < this.config.maxRetries) {
        try {
          return await operation(provider);
        } catch (error) {
          lastError = error as Error;
          attempts++;

          if (attempts < this.config.maxRetries) {
            await this.delay(this.config.retryDelay * Math.pow(2, attempts - 1));
          }
        }
      }

      // If fallback behavior is 'fail', don't try other providers
      if (this.config.fallbackBehavior === 'fail') {
        break;
      }
    }

    throw lastError || new Error('All providers failed');
  }

  /**
   * Login with automatic provider selection
   */
  async login(
    credentials: Record<string, any>,
    context?: AuthProviderContext,
    preferredProviderId?: string
  ): Promise<AuthProviderResult> {
    const providerIds = preferredProviderId
      ? [preferredProviderId, this.config.defaultProvider]
      : [this.config.defaultProvider];

    return this.executeWithFallback(async provider => {
      if (!provider.login) {
        throw new Error(`Provider ${provider.metadata.id} does not support login`);
      }
      return provider.login(credentials, context);
    }, providerIds);
  }

  /**
   * Signup with automatic provider selection
   */
  async signup(
    userData: Record<string, any>,
    context?: AuthProviderContext,
    preferredProviderId?: string
  ): Promise<AuthProviderResult> {
    const providerIds = preferredProviderId
      ? [preferredProviderId, this.config.defaultProvider]
      : [this.config.defaultProvider];

    return this.executeWithFallback(async provider => {
      if (!provider.signup) {
        throw new Error(`Provider ${provider.metadata.id} does not support signup`);
      }
      return provider.signup(userData, context);
    }, providerIds);
  }

  /**
   * Logout from all providers
   */
  async logout(context?: AuthProviderContext): Promise<AuthProviderResult[]> {
    const results: AuthProviderResult[] = [];

    for (const provider of this.getAllProviders()) {
      if (provider.logout) {
        try {
          const result = await provider.logout(context);
          results.push(result);
        } catch (error) {
          results.push({
            success: false,
            error: {
              code: 'LOGOUT_FAILED',
              message: `Failed to logout from ${provider.metadata.id}: ${error}`,
            },
          });
        }
      }
    }

    return results;
  }

  /**
   * Health check for all providers
   */
  async healthCheck(): Promise<
    Record<string, { healthy: boolean; details?: Record<string, any> }>
  > {
    const results: Record<string, { healthy: boolean; details?: Record<string, any> }> = {};

    for (const [id, provider] of this.providers) {
      try {
        if (provider.healthCheck) {
          results[id] = await provider.healthCheck();
        } else {
          results[id] = { healthy: true, details: { message: 'No health check implemented' } };
        }
      } catch (error) {
        results[id] = {
          healthy: false,
          details: { error: error instanceof Error ? error.message : String(error) },
        };
      }
    }

    return results;
  }

  /**
   * Configure the registry
   */
  configure(config: Partial<ProviderRegistryConfig>): void {
    this.config = { ...this.config, ...config };

    // Re-validate enabled providers
    for (const [id, _provider] of this.providers) {
      if (!this.isProviderEnabled(id)) {
        console.warn(`Provider ${id} was disabled by configuration change`);
      }
    }
  }

  /**
   * Get registry statistics
   */
  getStatistics(): {
    totalProviders: number;
    enabledProviders: number;
    capabilityDistribution: Record<string, number>;
    featureFlags: Record<string, boolean>;
  } {
    const providers = this.getAllProviders();
    const capabilities = Object.keys(
      providers[0]?.metadata.capabilities || {}
    ) as (keyof AuthProviderCapabilities)[];

    const capabilityDistribution: Record<string, number> = {};
    for (const capability of capabilities) {
      capabilityDistribution[capability] = providers.filter(
        p => p.metadata.capabilities[capability]
      ).length;
    }

    return {
      totalProviders: this.providers.size,
      enabledProviders: providers.length,
      capabilityDistribution,
      featureFlags: { ...this.config.featureFlags },
    };
  }

  /**
   * Export provider configuration
   */
  exportConfiguration(): {
    providers: Array<{
      id: string;
      enabled: boolean;
      configuration: Record<string, any>;
    }>;
    config: ProviderRegistryConfig;
  } {
    const providers = Array.from(this.providers.values()).map(provider => ({
      id: provider.metadata.id,
      enabled: this.isProviderEnabled(provider.metadata.id),
      configuration: this.config.providerConfigs[provider.metadata.id] || {},
    }));

    return {
      providers,
      config: { ...this.config },
    };
  }

  /**
   * Validate provider implementation
   */
  private validateProvider(provider: AuthProvider): void {
    const { metadata } = provider;

    if (!metadata.id || typeof metadata.id !== 'string') {
      throw new Error('Provider must have a valid string ID');
    }

    if (!metadata.name || typeof metadata.name !== 'string') {
      throw new Error('Provider must have a valid name');
    }

    if (!metadata.capabilities || typeof metadata.capabilities !== 'object') {
      throw new Error('Provider must define capabilities');
    }

    // Validate that required methods are implemented based on capabilities
    if (metadata.capabilities.supportsLogin && !provider.login) {
      throw new Error(
        `Provider ${metadata.id} claims to support login but doesn't implement login method`
      );
    }

    if (metadata.capabilities.supportsSignup && !provider.signup) {
      throw new Error(
        `Provider ${metadata.id} claims to support signup but doesn't implement signup method`
      );
    }

    if (metadata.capabilities.supportsMFA && !provider.setupMFA) {
      throw new Error(
        `Provider ${metadata.id} claims to support MFA but doesn't implement setupMFA method`
      );
    }
  }

  /**
   * Check if provider is enabled
   */
  private isProviderEnabled(providerId: string): boolean {
    return this.config.enabledProviders.includes(providerId);
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Dispose all providers
   */
  async dispose(): Promise<void> {
    const disposePromises = Array.from(this.providers.values())
      .filter(provider => provider.dispose)
      .map(provider => provider.dispose!());

    await Promise.allSettled(disposePromises);

    this.providers.clear();
    this.initializationPromises.clear();
  }
}

/**
 * Create provider registry instance
 */
export function createAuthProviderRegistry(
  config?: Partial<ProviderRegistryConfig>
): AuthProviderRegistry {
  return new AuthProviderRegistry(config);
}

export default AuthProviderRegistry;
