export interface AuthConfig {
  readonly SESSION_TIMEOUT: number;
  readonly REFRESH_THRESHOLD: number;
  readonly MAX_LOGIN_ATTEMPTS: number;
  readonly RATE_LIMIT_WINDOW: number;
  readonly REMEMBER_ME_DURATION: number;
  readonly TOKEN_REFRESH_BUFFER: number;
}

export interface SupabaseConfig {
  readonly URL: string;
  readonly ANON_KEY: string;
  readonly SERVICE_ROLE_KEY: string;
}

export interface ApiConfig {
  readonly BASE_URL: string;
  readonly VERSION: string;
  readonly TIMEOUT: number;
  readonly RETRY_ATTEMPTS: number;
}

export type AuthStatus = 'unauthenticated' | 'authenticated' | 'loading' | 'error';

export interface MultiFactor {
  enabled: boolean;
  methods: ('sms' | 'totp' | 'email')[];
  required: boolean;
}

export interface SessionValidationResult {
  isValid: boolean;
  user?: Record<string, unknown>;
  session?: Record<string, unknown>;
  error?: Error | Record<string, unknown>;
}

export interface TokenRefreshResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  error?: Error | Record<string, unknown>;
}
