import { ApiError, ApiResponse } from '@agentic-workflow/shared';

export interface ApiClientConfig {
  baseUrl: string;
  timeout?: number;
  defaultHeaders?: Record<string, string>;
  enableTokenRefresh?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

export interface RequestConfig {
  headers?: Record<string, string>;
  timeout?: number;
  signal?: AbortSignal;
  skipAuth?: boolean;
  skipRetry?: boolean;
}

export interface TokenRefreshHandler {
  refreshToken(): Promise<string | null>;
  isTokenExpired(token: string): boolean;
}

export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  retryableStatuses: number[];
}

export class ApiClient {
  private baseUrl: string;
  private timeout: number;
  private defaultHeaders: Record<string, string>;
  private authToken: string | null = null;
  private tokenRefreshHandler: TokenRefreshHandler | null = null;
  private isRefreshing: boolean = false;
  private refreshPromise: Promise<string | null> | null = null;
  private retryConfig: RetryConfig;
  private enableTokenRefresh: boolean;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.timeout = config.timeout || 30000;
    this.defaultHeaders = config.defaultHeaders || {};
    this.enableTokenRefresh = config.enableTokenRefresh ?? true;

    this.retryConfig = {
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      retryableStatuses: [401, 500, 502, 503, 504, 429],
    };
  }

  setAuthToken(token: string | null) {
    this.authToken = token;
  }

  getAuthToken(): string | null {
    return this.authToken;
  }

  setTokenRefreshHandler(handler: TokenRefreshHandler | null) {
    this.tokenRefreshHandler = handler;
  }

  getTokenRefreshHandler(): TokenRefreshHandler | null {
    return this.tokenRefreshHandler;
  }

  setRetryConfig(config: Partial<RetryConfig>) {
    this.retryConfig = { ...this.retryConfig, ...config };
  }

  private async refreshTokenIfNeeded(): Promise<string | null> {
    if (!this.enableTokenRefresh || !this.tokenRefreshHandler || !this.authToken) {
      return this.authToken;
    }

    // Check if token is expired
    if (this.tokenRefreshHandler.isTokenExpired(this.authToken)) {
      return await this.performTokenRefresh();
    }

    return this.authToken;
  }

  private async performTokenRefresh(): Promise<string | null> {
    // Prevent multiple simultaneous refresh attempts
    if (this.isRefreshing && this.refreshPromise) {
      return await this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.tokenRefreshHandler!.refreshToken();

    try {
      const newToken = await this.refreshPromise;
      this.authToken = newToken;
      return newToken;
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.authToken = null;
      return null;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  private async makeRequestWithRetry<T>(
    requestFn: () => Promise<Response>,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    const maxRetries = config?.skipRetry ? 0 : this.retryConfig.maxRetries;
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Refresh token if needed before the request (but not on retries after 401)
        if (attempt === 0 && !config?.skipAuth) {
          await this.refreshTokenIfNeeded();
        }

        const response = await requestFn();

        // Handle 401 specifically for token refresh
        if (
          response.status === 401 &&
          this.enableTokenRefresh &&
          this.tokenRefreshHandler &&
          !config?.skipAuth
        ) {
          // Try to refresh token and retry once
          const newToken = await this.performTokenRefresh();
          if (newToken && attempt < maxRetries) {
            continue; // Retry with new token
          }
        }

        return await this.handleResponse<T>(response);
      } catch (error) {
        lastError = error;

        // Don't retry if it's the last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Check if error is retryable
        if (this.shouldRetry(error)) {
          await this.delay(this.retryConfig.retryDelay * Math.pow(2, attempt));
          continue;
        }

        // If not retryable, throw immediately
        break;
      }
    }

    throw lastError;
  }

  private shouldRetry(error: any): boolean {
    // Retry on network errors
    if (error.name === 'NetworkError' || error.name === 'TypeError') {
      return true;
    }

    // Retry on specific HTTP status codes
    if (error.status && this.retryConfig.retryableStatuses.includes(error.status)) {
      return true;
    }

    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private buildUrl(endpoint: string): string {
    return `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  }

  private buildHeaders(
    headers?: Record<string, string>,
    skipAuth?: boolean
  ): Record<string, string> {
    const allHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.defaultHeaders,
      ...headers,
    };

    if (this.authToken && !skipAuth) {
      allHeaders.Authorization = `Bearer ${this.authToken}`;
    }

    return allHeaders;
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    let data: unknown;

    try {
      const text = await response.text();
      data = text ? JSON.parse(text) : null;
    } catch {
      throw new Error('Invalid JSON response');
    }

    // Type guard for object with string keys
    const isObj = (val: unknown): val is Record<string, unknown> =>
      typeof val === 'object' && val !== null;

    let message: string | undefined = undefined;
    let code: string | undefined = undefined;
    if (isObj(data)) {
      message =
        typeof data.message === 'string'
          ? data.message
          : typeof data.detail === 'string'
            ? data.detail
            : undefined;
      code = typeof data.code === 'string' ? data.code : undefined;
    }

    if (!response.ok) {
      const apiError: ApiError = {
        message: message || `HTTP ${response.status}`,
        code: code || response.status.toString(),
        details: isObj(data) ? data : undefined,
      };
      throw apiError;
    }

    return {
      data: data as T,
      status: response.status,
      success: true,
      message,
    };
  }

  async get<T>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config?.timeout || this.timeout);

    try {
      return await this.makeRequestWithRetry<T>(
        () =>
          fetch(this.buildUrl(endpoint), {
            method: 'GET',
            headers: this.buildHeaders(config?.headers, config?.skipAuth),
            signal: config?.signal || controller.signal,
          }),
        config
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async post<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config?.timeout || this.timeout);

    try {
      return await this.makeRequestWithRetry<T>(
        () =>
          fetch(this.buildUrl(endpoint), {
            method: 'POST',
            headers: this.buildHeaders(config?.headers, config?.skipAuth),
            body: data ? JSON.stringify(data) : undefined,
            signal: config?.signal || controller.signal,
          }),
        config
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async put<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config?.timeout || this.timeout);

    try {
      return await this.makeRequestWithRetry<T>(
        () =>
          fetch(this.buildUrl(endpoint), {
            method: 'PUT',
            headers: this.buildHeaders(config?.headers, config?.skipAuth),
            body: data ? JSON.stringify(data) : undefined,
            signal: config?.signal || controller.signal,
          }),
        config
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async patch<T>(
    endpoint: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config?.timeout || this.timeout);

    try {
      return await this.makeRequestWithRetry<T>(
        () =>
          fetch(this.buildUrl(endpoint), {
            method: 'PATCH',
            headers: this.buildHeaders(config?.headers, config?.skipAuth),
            body: data ? JSON.stringify(data) : undefined,
            signal: config?.signal || controller.signal,
          }),
        config
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async delete<T>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config?.timeout || this.timeout);

    try {
      return await this.makeRequestWithRetry<T>(
        () =>
          fetch(this.buildUrl(endpoint), {
            method: 'DELETE',
            headers: this.buildHeaders(config?.headers, config?.skipAuth),
            signal: config?.signal || controller.signal,
          }),
        config
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
