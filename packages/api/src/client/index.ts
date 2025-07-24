import { ApiClient, ApiClientConfig } from './base';
import { AuthApiClient } from './auth';
import { UsersApiClient } from './users';

export class AgenticWorkflowApiClient {
  private baseClient: ApiClient;
  public auth: AuthApiClient;
  public users: UsersApiClient;

  constructor(config: ApiClientConfig) {
    this.baseClient = new ApiClient(config);
    this.auth = new AuthApiClient(this.baseClient);
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
}

// Factory function for easier usage
export function createApiClient(config: ApiClientConfig): AgenticWorkflowApiClient {
  return new AgenticWorkflowApiClient(config);
}

// Default client instance (can be configured later)
let defaultClient: AgenticWorkflowApiClient | null = null;

export function setDefaultApiClient(config: ApiClientConfig) {
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
