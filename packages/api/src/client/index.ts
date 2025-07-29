import { ApiClient, ApiClientConfig } from './base';
import { AuthApiClient } from './auth';
import { UsersApiClient } from './users';
import { SessionManagerConfig } from '../adapters/session-manager';
import { FallbackConfig } from '../adapters/fallback-service';

export interface AgenticWorkflowApiClientConfig extends ApiClientConfig {
  sessionManagerConfig?: Partial<SessionManagerConfig>;
  fallbackConfig?: Partial<FallbackConfig>;
}

export class AgenticWorkflowApiClient {
  private baseClient: ApiClient;
  public auth: AuthApiClient;
  public users: UsersApiClient;

  constructor(config: AgenticWorkflowApiClientConfig) {
    this.baseClient = new ApiClient(config);
    this.auth = new AuthApiClient(
      this.baseClient,
      undefined,
      config.sessionManagerConfig,
      config.fallbackConfig
    );
    this.users = new UsersApiClient(this.baseClient);
  }

  setAuthToken(token: string | null) {
    this.baseClient.setAuthToken(token);
  }

  getAuthToken(): string | null {
    return this.baseClient.getAuthToken();
  }

  // Direct access to base client for custom endpoints
  get client(): ApiClient {
    return this.baseClient;
  }

  /**
   * Initialize session restoration on app startup
   * Should be called when the app starts to restore any existing session
   */
  async initializeSession(): Promise<boolean> {
    return this.auth.initializeSession();
  }

  /**
   * Check if there's a valid active session
   */
  hasValidSession(): boolean {
    return this.auth.hasValidSession();
  }

  /**
   * Get current session data
   */
  getCurrentSession() {
    return this.auth.getCurrentSession();
  }

  /**
   * Cleanup session monitoring and resources
   * Should be called when the app is shutting down or the client is no longer needed
   */
  cleanup(): void {
    this.auth.cleanup();
  }
}

// Factory function for easier usage
export function createApiClient(config: AgenticWorkflowApiClientConfig): AgenticWorkflowApiClient {
  return new AgenticWorkflowApiClient(config);
}

// Default client instance (can be configured later)
let defaultClient: AgenticWorkflowApiClient | null = null;

export function setDefaultApiClient(config: AgenticWorkflowApiClientConfig) {
  defaultClient = createApiClient(config);
}

export function getDefaultApiClient(): AgenticWorkflowApiClient {
  if (!defaultClient) {
    throw new Error('Default API client not configured. Call setDefaultApiClient() first.');
  }
  return defaultClient;
}

// Re-export types and classes
export * from './base';
export * from './auth';
export * from './users';
