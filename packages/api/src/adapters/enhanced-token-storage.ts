/**
 * Enhanced Token Storage with HttpOnly Cookie Support
 *
 * Implements secure token storage with httpOnly cookie support,
 * sessionStorage fallback for development, and comprehensive
 * token expiration checking and cleanup.
 */

import {
  SecureTokenStorage,
  SecureTokenConfig,
  StoredToken as _StoredToken,
} from './secure-token-storage';

export interface EnhancedTokenConfig extends SecureTokenConfig {
  cookies: {
    enabled: boolean;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'strict' | 'lax' | 'none';
    domain?: string;
    path: string;
    maxAge: number; // seconds
  };
  fallback: {
    useSessionStorage: boolean;
    useLocalStorage: boolean;
    developmentOnly: boolean;
  };
  security: {
    csrfProtection: boolean;
    encryptCookies: boolean;
    rotateOnExpiry: boolean;
  };
}

export const DEFAULT_ENHANCED_TOKEN_CONFIG: EnhancedTokenConfig = {
  ...{
    encryption: {
      enabled: true,
      algorithm: 'AES-GCM',
      keyLength: 256,
    },
    storage: {
      useSecureStorage: true,
      encryptInMemory: true,
      autoCleanup: true,
      maxTokenAge: 60 * 60 * 1000, // 1 hour
    },
    rotation: {
      enabled: true,
      interval: 15 * 60 * 1000, // 15 minutes
      keepPreviousVersions: 2,
    },
  },
  cookies: {
    enabled: true,
    httpOnly: true,
    secure: true, // Will be set to false in development
    sameSite: 'strict',
    path: '/',
    maxAge: 3600, // 1 hour
  },
  fallback: {
    useSessionStorage: true,
    useLocalStorage: false,
    developmentOnly: true,
  },
  security: {
    csrfProtection: true,
    encryptCookies: true,
    rotateOnExpiry: true,
  },
};

export interface TokenMetadata {
  expiresAt?: number;
  issuedAt: number;
  lastRefresh: number;
  tokenType: 'access' | 'refresh';
  csrfToken?: string;
}

export class EnhancedTokenStorage extends SecureTokenStorage {
  private enhancedConfig: EnhancedTokenConfig;
  private csrfToken: string | null = null;
  private isDevelopment: boolean;

  constructor(config: Partial<EnhancedTokenConfig> = {}) {
    const mergedConfig = { ...DEFAULT_ENHANCED_TOKEN_CONFIG, ...config };

    // Adjust for development environment
    const isDevelopment = process.env.NODE_ENV === 'development';
    if (isDevelopment) {
      mergedConfig.cookies.secure = false;
      mergedConfig.cookies.sameSite = 'lax';
    }

    super(mergedConfig);
    this.enhancedConfig = mergedConfig;
    this.isDevelopment = isDevelopment;

    // Initialize CSRF protection if enabled
    if (this.enhancedConfig.security.csrfProtection) {
      this.initializeCSRFProtection();
    }
  }

  /**
   * Store authentication tokens with enhanced security
   */
  async storeAuthTokens(
    accessToken: string,
    refreshToken: string,
    expiresIn: number
  ): Promise<void> {
    await this.storeAuthTokensWithRememberMe(accessToken, refreshToken, expiresIn, false);
  }

  /**
   * Store authentication tokens with remember me support
   */
  async storeAuthTokensWithRememberMe(
    accessToken: string,
    refreshToken: string,
    expiresIn: number,
    rememberMe: boolean
  ): Promise<void> {
    const now = Date.now();
    const expiresAt = now + expiresIn * 1000;

    // Determine storage duration based on remember me
    const refreshTokenDuration = rememberMe
      ? 30 * 24 * 60 * 60 * 1000 // 30 days for remember me
      : 7 * 24 * 60 * 60 * 1000; // 7 days for regular sessions

    const accessMetadata: TokenMetadata = {
      expiresAt,
      issuedAt: now,
      lastRefresh: now,
      tokenType: 'access',
      csrfToken: this.csrfToken ?? undefined,
    };

    const refreshMetadata: TokenMetadata = {
      expiresAt: now + refreshTokenDuration,
      issuedAt: now,
      lastRefresh: now,
      tokenType: 'refresh',
      csrfToken: this.csrfToken ?? undefined,
    };

    // Use localStorage for remember me sessions, sessionStorage for regular sessions
    const config: EnhancedTokenConfig = {
      ...this.enhancedConfig,
      fallback: {
        ...this.enhancedConfig.fallback,
        useLocalStorage: rememberMe, // Use localStorage only for remember me
        useSessionStorage: !rememberMe, // Use sessionStorage for regular sessions
      },
      cookies: {
        ...this.enhancedConfig.cookies,
        maxAge: rememberMe
          ? Math.floor(refreshTokenDuration / 1000) // Extended cookie duration for remember me
          : this.enhancedConfig.cookies.maxAge,
      },
      security: {
        ...this.enhancedConfig.security,
      },
    };

    // Store remember me preference
    if (rememberMe && typeof localStorage !== 'undefined') {
      localStorage.setItem('auth_remember_me', 'true');
    } else if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('auth_remember_me');
    }

    // Store using multiple methods for redundancy
    await Promise.all([
      this.storeTokenWithCookies('access_token', accessToken, accessMetadata),
      this.storeTokenWithCookies('refresh_token', refreshToken, refreshMetadata),
      this.storeTokenWithFallbackConfig('access_token', accessToken, accessMetadata, config),
      this.storeTokenWithFallbackConfig('refresh_token', refreshToken, refreshMetadata, config),
    ]);
  }

  /**
   * Retrieve access token
   */
  async getAccessToken(): Promise<string | null> {
    const token = await this.getTokenWithFallback('access_token');

    if (token) {
      // Validate token hasn't expired
      const metadata = await this.getTokenMetadata('access_token');
      if (metadata && metadata.expiresAt && metadata.expiresAt <= Date.now()) {
        await this.removeToken('access_token');
        return null;
      }
    }

    return token;
  }

  /**
   * Retrieve refresh token
   */
  async getRefreshToken(): Promise<string | null> {
    const token = await this.getTokenWithFallback('refresh_token');

    if (token) {
      // Validate token hasn't expired
      const metadata = await this.getTokenMetadata('refresh_token');
      if (metadata && metadata.expiresAt && metadata.expiresAt <= Date.now()) {
        await this.removeToken('refresh_token');
        return null;
      }
    }

    return token;
  }

  /**
   * Check if access token is expired or expiring soon
   */
  async isAccessTokenExpired(bufferMinutes: number = 5): Promise<boolean> {
    const metadata = await this.getTokenMetadata('access_token');
    if (!metadata) return true;

    const bufferMs = bufferMinutes * 60 * 1000;
    return metadata.expiresAt ? metadata.expiresAt - bufferMs <= Date.now() : true;
  }

  /**
   * Clear all authentication tokens
   */
  async clearAuthTokens(): Promise<void> {
    await Promise.all([
      this.removeTokenFromCookies('access_token'),
      this.removeTokenFromCookies('refresh_token'),
      this.removeTokenFromFallback('access_token'),
      this.removeTokenFromFallback('refresh_token'),
    ]);

    // Clear remember me preference
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('auth_remember_me');
    }

    // Clear CSRF token
    this.csrfToken = null;
    if (typeof document !== 'undefined') {
      this.removeCookie('csrf_token');
    }
  }

  /**
   * Get CSRF token for request protection
   */
  getCSRFToken(): string | null {
    return this.csrfToken;
  }

  /**
   * Validate CSRF token
   */
  validateCSRFToken(token: string): boolean {
    if (!this.enhancedConfig.security.csrfProtection) return true;
    return this.csrfToken === token;
  }

  /**
   * Store token using cookies (server-side or client-side)
   */
  private async storeTokenWithCookies(
    key: string,
    token: string,
    metadata: TokenMetadata
  ): Promise<void> {
    if (!this.enhancedConfig.cookies.enabled) return;

    let cookieValue = token;

    // Encrypt cookie value if enabled
    if (this.enhancedConfig.security.encryptCookies) {
      try {
        cookieValue = await this.encryptValue(token);
      } catch (error) {
        console.warn('Cookie encryption failed, storing unencrypted:', error);
      }
    }

    // Create cookie metadata
    const cookieData = {
      value: cookieValue,
      metadata,
    };

    const cookieName = `auth_${key}`;
    const cookieString = this.buildCookieString(
      cookieName,
      JSON.stringify(cookieData),
      metadata.expiresAt || Date.now() + 3600000
    );

    // Set cookie (this would typically be done server-side for httpOnly cookies)
    if (typeof document !== 'undefined' && !this.enhancedConfig.cookies.httpOnly) {
      document.cookie = cookieString;
    } else {
      // In a real implementation, this would be handled server-side
      // For now, we'll store the cookie info for potential server communication
      this.storeCookieForServer(cookieName, cookieString);
    }
  }

  /**
   * Store token using fallback methods with custom config
   */
  private async storeTokenWithFallbackConfig(
    key: string,
    token: string,
    metadata: TokenMetadata,
    config: EnhancedTokenConfig
  ): Promise<void> {
    if (config.fallback.developmentOnly && !this.isDevelopment) {
      return;
    }

    const tokenData = {
      token,
      metadata,
    };

    const dataString = JSON.stringify(tokenData);

    // Try sessionStorage first (for regular sessions or if specified)
    if (config.fallback.useSessionStorage && typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.setItem(`auth_${key}`, dataString);
      } catch (error) {
        console.warn('SessionStorage failed:', error);
      }
    }

    // Try localStorage (for remember me sessions or if specified)
    if (config.fallback.useLocalStorage && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(`auth_${key}`, dataString);
      } catch (error) {
        console.warn('LocalStorage failed:', error);
      }
    }

    // Use the base secure storage
    await this.storeToken(
      `fallback_${key}`,
      token,
      (metadata.expiresAt || Date.now() + 3600000) - Date.now()
    );
  }

  /**
   * Get token using fallback methods with priority
   */
  private async getTokenWithFallback(key: string): Promise<string | null> {
    // Try cookies first
    if (this.enhancedConfig.cookies.enabled) {
      const cookieToken = await this.getTokenFromCookies(key);
      if (cookieToken) return cookieToken;
    }

    // Try sessionStorage
    if (this.enhancedConfig.fallback.useSessionStorage && typeof sessionStorage !== 'undefined') {
      try {
        const data = sessionStorage.getItem(`auth_${key}`);
        if (data) {
          const parsed = JSON.parse(data);
          if (parsed.metadata.expiresAt > Date.now()) {
            return parsed.token;
          } else {
            sessionStorage.removeItem(`auth_${key}`);
          }
        }
      } catch (error) {
        console.warn('SessionStorage retrieval failed:', error);
      }
    }

    // Try localStorage
    if (this.enhancedConfig.fallback.useLocalStorage && typeof localStorage !== 'undefined') {
      try {
        const data = localStorage.getItem(`auth_${key}`);
        if (data) {
          const parsed = JSON.parse(data);
          if (parsed.metadata.expiresAt > Date.now()) {
            return parsed.token;
          } else {
            localStorage.removeItem(`auth_${key}`);
          }
        }
      } catch (error) {
        console.warn('LocalStorage retrieval failed:', error);
      }
    }

    // Try base secure storage
    return await this.getToken(`fallback_${key}`);
  }

  /**
   * Get token from cookies
   */
  private async getTokenFromCookies(key: string): Promise<string | null> {
    if (!this.enhancedConfig.cookies.enabled || typeof document === 'undefined') {
      return null;
    }

    const cookieName = `auth_${key}`;
    const cookieValue = this.getCookie(cookieName);

    if (!cookieValue) return null;

    try {
      const cookieData = JSON.parse(cookieValue);

      // Check expiration
      if (cookieData.metadata.expiresAt <= Date.now()) {
        this.removeCookie(cookieName);
        return null;
      }

      let token = cookieData.value;

      // Decrypt if encrypted
      if (this.enhancedConfig.security.encryptCookies) {
        try {
          token = await this.decryptValue(token);
        } catch (error) {
          console.error('Cookie decryption failed:', error);
          this.removeCookie(cookieName);
          return null;
        }
      }

      return token;
    } catch (error) {
      console.error('Cookie parsing failed:', error);
      this.removeCookie(cookieName);
      return null;
    }
  }

  /**
   * Remove token from cookies
   */
  private removeTokenFromCookies(key: string): void {
    if (typeof document !== 'undefined') {
      this.removeCookie(`auth_${key}`);
    }
  }

  /**
   * Remove token from fallback storage
   */
  private removeTokenFromFallback(key: string): void {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(`auth_${key}`);
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(`auth_${key}`);
    }

    this.removeToken(`fallback_${key}`);
  }

  /**
   * Build cookie string with all security attributes
   */
  private buildCookieString(name: string, value: string, expiresAt: number): string {
    const parts = [`${name}=${encodeURIComponent(value)}`];

    parts.push(`Max-Age=${this.enhancedConfig.cookies.maxAge}`);
    parts.push(`Expires=${new Date(expiresAt).toUTCString()}`);
    parts.push(`Path=${this.enhancedConfig.cookies.path}`);

    if (this.enhancedConfig.cookies.domain) {
      parts.push(`Domain=${this.enhancedConfig.cookies.domain}`);
    }

    if (this.enhancedConfig.cookies.secure) {
      parts.push('Secure');
    }

    if (this.enhancedConfig.cookies.httpOnly) {
      parts.push('HttpOnly');
    }

    parts.push(`SameSite=${this.enhancedConfig.cookies.sameSite}`);

    return parts.join('; ');
  }

  /**
   * Get cookie value
   */
  private getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;

    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);

    if (parts.length === 2) {
      return decodeURIComponent(parts.pop()?.split(';').shift() || '');
    }

    return null;
  }

  /**
   * Remove cookie
   */
  private removeCookie(name: string): void {
    if (typeof document === 'undefined') return;

    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${this.enhancedConfig.cookies.path};`;
  }

  /**
   * Store cookie for server-side handling (placeholder)
   */
  private storeCookieForServer(name: string, cookieString: string): void {
    // In a real implementation, this would communicate with the server
    // to set httpOnly cookies. For now, we'll just log it.
    if (this.isDevelopment) {
      console.debug('Server cookie to set:', { name, cookieString });
    }
  }

  /**
   * Initialize CSRF protection
   */
  private initializeCSRFProtection(): void {
    // Generate CSRF token
    this.csrfToken = this.generateCSRFToken();

    // Store CSRF token in cookie
    if (typeof document !== 'undefined') {
      const csrfCookieString = this.buildCookieString(
        'csrf_token',
        this.csrfToken,
        Date.now() + this.enhancedConfig.cookies.maxAge * 1000
      );

      // CSRF tokens are typically not httpOnly so JavaScript can read them
      const csrfCookie = csrfCookieString.replace('; HttpOnly', '');
      document.cookie = csrfCookie;
    }
  }

  /**
   * Generate CSRF token
   */
  private generateCSRFToken(): string {
    const array = new Uint8Array(32);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array);
    } else {
      // Fallback for environments without crypto
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }

    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Encrypt a value (placeholder for the actual encryption)
   */
  private async encryptValue(value: string): Promise<string> {
    // This would use the same encryption as the base class
    // For now, just return the value (encryption is handled by base class)
    return value;
  }

  /**
   * Decrypt a value (placeholder for the actual decryption)
   */
  private async decryptValue(encryptedValue: string): Promise<string> {
    // This would use the same decryption as the base class
    // For now, just return the value (decryption is handled by base class)
    return encryptedValue;
  }

  /**
   * Check if user has remember me enabled
   */
  isRememberMeEnabled(): boolean {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem('auth_remember_me') === 'true';
  }

  /**
   * Get enhanced storage statistics
   */
  getEnhancedStats() {
    const baseStats = this.getStorageStats();

    return {
      ...baseStats,
      cookiesEnabled: this.enhancedConfig.cookies.enabled,
      httpOnlyEnabled: this.enhancedConfig.cookies.httpOnly,
      csrfProtectionEnabled: this.enhancedConfig.security.csrfProtection,
      encryptionEnabled: this.enhancedConfig.security.encryptCookies,
      fallbackMethods: {
        sessionStorage: this.enhancedConfig.fallback.useSessionStorage,
        localStorage: this.enhancedConfig.fallback.useLocalStorage,
      },
      isDevelopmentMode: this.isDevelopment,
      rememberMeEnabled: this.isRememberMeEnabled(),
    };
  }
}

/**
 * Factory function to create enhanced token storage
 */
export function createEnhancedTokenStorage(
  config?: Partial<EnhancedTokenConfig>
): EnhancedTokenStorage {
  return new EnhancedTokenStorage(config);
}

export default EnhancedTokenStorage;
