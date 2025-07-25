import { ApiError, ApiResponse } from '@agentic-workflow/shared';

export interface ApiClientConfig {
  baseUrl: string;
  timeout?: number;
  defaultHeaders?: Record<string, string>;
}

export interface RequestConfig {
  headers?: Record<string, string>;
  timeout?: number;
  signal?: AbortSignal;
}

export class ApiClient {
  private baseUrl: string;
  private timeout: number;
  private defaultHeaders: Record<string, string>;
  private authToken: string | null = null;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.timeout = config.timeout || 30000;
    this.defaultHeaders = config.defaultHeaders || {};
  }

  setAuthToken(token: string | null) {
    this.authToken = token;
  }

  getAuthToken(): string | null {
    return this.authToken;
  }

  private buildUrl(endpoint: string): string {
    return `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  }

  private buildHeaders(headers?: Record<string, string>): Record<string, string> {
    const allHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.defaultHeaders,
      ...headers,
    };

    if (this.authToken) {
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
      const response = await fetch(this.buildUrl(endpoint), {
        method: 'GET',
        headers: this.buildHeaders(config?.headers),
        signal: config?.signal || controller.signal,
      });

      return await this.handleResponse<T>(response);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async post<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config?.timeout || this.timeout);

    try {
      const response = await fetch(this.buildUrl(endpoint), {
        method: 'POST',
        headers: this.buildHeaders(config?.headers),
        body: data ? JSON.stringify(data) : undefined,
        signal: config?.signal || controller.signal,
      });

      return await this.handleResponse<T>(response);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async put<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config?.timeout || this.timeout);

    try {
      const response = await fetch(this.buildUrl(endpoint), {
        method: 'PUT',
        headers: this.buildHeaders(config?.headers),
        body: data ? JSON.stringify(data) : undefined,
        signal: config?.signal || controller.signal,
      });

      return await this.handleResponse<T>(response);
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
      const response = await fetch(this.buildUrl(endpoint), {
        method: 'PATCH',
        headers: this.buildHeaders(config?.headers),
        body: data ? JSON.stringify(data) : undefined,
        signal: config?.signal || controller.signal,
      });

      return await this.handleResponse<T>(response);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async delete<T>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config?.timeout || this.timeout);

    try {
      const response = await fetch(this.buildUrl(endpoint), {
        method: 'DELETE',
        headers: this.buildHeaders(config?.headers),
        signal: config?.signal || controller.signal,
      });

      return await this.handleResponse<T>(response);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
