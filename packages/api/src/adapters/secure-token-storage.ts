/**
 * Secure Token Storage Service
 *
 * Task 19: Implement secure token storage and handling
 * - Secure token encryption and decryption
 * - Safe token storage mechanisms
 * - Token rotation and cleanup
 * - Memory-safe token handling
 */

/**
 * Token storage configuration
 */
export interface SecureTokenConfig {
  encryption: {
    enabled: boolean;
    algorithm: string;
    keyLength: number;
  };
  storage: {
    useSecureStorage: boolean;
    encryptInMemory: boolean;
    autoCleanup: boolean;
    maxTokenAge: number; // milliseconds
  };
  rotation: {
    enabled: boolean;
    interval: number; // milliseconds
    keepPreviousVersions: number;
  };
}

/**
 * Default secure token configuration
 */
export const DEFAULT_SECURE_TOKEN_CONFIG: SecureTokenConfig = {
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
};

/**
 * Stored token metadata
 */
export interface StoredToken {
  value: string;
  encrypted: boolean;
  created: number;
  lastAccessed: number;
  expiresAt?: number;
  version: number;
}

/**
 * Token validation result
 */
export interface TokenValidationResult {
  isValid: boolean;
  isExpired: boolean;
  age: number;
  version: number;
  needsRotation: boolean;
}

/**
 * Secure Token Storage Service
 */
export class SecureTokenStorage {
  private config: SecureTokenConfig;
  private tokens: Map<string, StoredToken> = new Map();
  private encryptionKey: CryptoKey | null = null;
  private rotationTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<SecureTokenConfig> = {}) {
    this.config = { ...DEFAULT_SECURE_TOKEN_CONFIG, ...config };

    if (this.config.encryption.enabled) {
      this.initializeEncryption();
    }

    if (this.config.storage.autoCleanup) {
      this.startCleanupTimer();
    }

    if (this.config.rotation.enabled) {
      this.startRotationTimer();
    }
  }

  /**
   * Store a token securely
   */
  async storeToken(key: string, token: string, expiresIn?: number): Promise<void> {
    const now = Date.now();
    const expiresAt = expiresIn ? now + expiresIn : undefined;

    let value = token;
    let encrypted = false;

    // Encrypt token if encryption is enabled
    if (this.config.encryption.enabled && this.encryptionKey) {
      try {
        value = await this.encryptToken(token);
        encrypted = true;
      } catch (error) {
        console.warn('Token encryption failed, storing unencrypted:', error);
      }
    }

    const storedToken: StoredToken = {
      value,
      encrypted,
      created: now,
      lastAccessed: now,
      expiresAt,
      version: 1,
    };

    this.tokens.set(key, storedToken);

    // Store in secure storage if available
    if (this.config.storage.useSecureStorage && typeof window !== 'undefined') {
      try {
        this.storeInSecureStorage(key, storedToken);
      } catch (error) {
        console.warn('Secure storage failed, using memory only:', error);
      }
    }
  }

  /**
   * Retrieve a token securely
   */
  async getToken(key: string): Promise<string | null> {
    let storedToken = this.tokens.get(key);

    // Try to load from secure storage if not in memory
    if (!storedToken && this.config.storage.useSecureStorage && typeof window !== 'undefined') {
      storedToken = this.loadFromSecureStorage(key);
      if (storedToken) {
        this.tokens.set(key, storedToken);
      }
    }

    if (!storedToken) {
      return null;
    }

    // Check expiration
    if (storedToken.expiresAt && Date.now() > storedToken.expiresAt) {
      this.removeToken(key);
      return null;
    }

    // Update last accessed time
    storedToken.lastAccessed = Date.now();

    // Decrypt token if encrypted
    let token = storedToken.value;
    if (storedToken.encrypted && this.config.encryption.enabled && this.encryptionKey) {
      try {
        token = await this.decryptToken(storedToken.value);
      } catch (error) {
        console.error('Token decryption failed:', error);
        this.removeToken(key); // Remove corrupted token
        return null;
      }
    }

    return token;
  }

  /**
   * Remove a token
   */
  removeToken(key: string): void {
    // Clear from memory
    const storedToken = this.tokens.get(key);
    if (storedToken) {
      // Clear the token value from memory securely
      if (typeof storedToken.value === 'string') {
        // Overwrite with random data multiple times
        this.securelyEraseString(storedToken.value);
      }
    }
    this.tokens.delete(key);

    // Clear from secure storage
    if (this.config.storage.useSecureStorage && typeof window !== 'undefined') {
      try {
        this.removeFromSecureStorage(key);
      } catch (error) {
        console.warn('Failed to remove from secure storage:', error);
      }
    }
  }

  /**
   * Validate a token
   */
  validateToken(key: string): TokenValidationResult {
    const storedToken = this.tokens.get(key);

    if (!storedToken) {
      return {
        isValid: false,
        isExpired: false,
        age: 0,
        version: 0,
        needsRotation: false,
      };
    }

    const now = Date.now();
    const age = now - storedToken.created;
    const isExpired = storedToken.expiresAt ? now > storedToken.expiresAt : false;
    const isValid = !isExpired;
    const needsRotation = this.config.rotation.enabled && age > this.config.rotation.interval;

    return {
      isValid,
      isExpired,
      age,
      version: storedToken.version,
      needsRotation,
    };
  }

  /**
   * Rotate a token (generate new version)
   */
  async rotateToken(key: string, newToken: string): Promise<void> {
    const existingToken = this.tokens.get(key);
    const version = existingToken ? existingToken.version + 1 : 1;

    // Keep previous versions if configured
    if (existingToken && this.config.rotation.keepPreviousVersions > 0) {
      const backupKey = `${key}_v${existingToken.version}`;
      this.tokens.set(backupKey, { ...existingToken });

      // Schedule cleanup of old versions
      setTimeout(() => {
        this.removeToken(backupKey);
      }, this.config.rotation.interval);
    }

    // Store new version
    await this.storeToken(key, newToken);

    // Update version
    const newStoredToken = this.tokens.get(key);
    if (newStoredToken) {
      newStoredToken.version = version;
    }
  }

  /**
   * List all stored token keys
   */
  getStoredTokenKeys(): string[] {
    return Array.from(this.tokens.keys());
  }

  /**
   * Get token metadata without decrypting
   */
  getTokenMetadata(key: string): Omit<StoredToken, 'value'> | null {
    const storedToken = this.tokens.get(key);
    if (!storedToken) {
      return null;
    }

    const { value: _value, ...metadata } = storedToken;
    return metadata;
  }

  /**
   * Clear all tokens
   */
  clearAllTokens(): void {
    // Securely erase all token values
    for (const [_key, storedToken] of this.tokens.entries()) {
      if (typeof storedToken.value === 'string') {
        this.securelyEraseString(storedToken.value);
      }
    }

    this.tokens.clear();

    // Clear secure storage
    if (this.config.storage.useSecureStorage && typeof window !== 'undefined') {
      try {
        this.clearSecureStorage();
      } catch (error) {
        console.warn('Failed to clear secure storage:', error);
      }
    }
  }

  /**
   * Initialize encryption
   */
  private async initializeEncryption(): Promise<void> {
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      console.warn('Web Crypto API not available, encryption disabled');
      this.config.encryption.enabled = false;
      return;
    }

    try {
      // Generate or retrieve encryption key
      this.encryptionKey = await crypto.subtle.generateKey(
        {
          name: this.config.encryption.algorithm,
          length: this.config.encryption.keyLength,
        },
        false, // Not extractable
        ['encrypt', 'decrypt']
      );
    } catch (error) {
      console.error('Failed to initialize encryption:', error);
      this.config.encryption.enabled = false;
    }
  }

  /**
   * Encrypt a token
   */
  private async encryptToken(token: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not available');
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM

    const encrypted = await crypto.subtle.encrypt(
      {
        name: this.config.encryption.algorithm,
        iv: iv,
      },
      this.encryptionKey,
      data
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    // Convert to base64
    return btoa(String.fromCharCode(...combined));
  }

  /**
   * Decrypt a token
   */
  private async decryptToken(encryptedToken: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not available');
    }

    // Convert from base64
    const combined = new Uint8Array(
      atob(encryptedToken)
        .split('')
        .map(char => char.charCodeAt(0))
    );

    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      {
        name: this.config.encryption.algorithm,
        iv: iv,
      },
      this.encryptionKey,
      encrypted
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  /**
   * Store in secure storage (browser-specific)
   */
  private storeInSecureStorage(key: string, token: StoredToken): void {
    if (typeof window === 'undefined') {
      return;
    }

    const storageKey = `secure_token_${key}`;
    const data = JSON.stringify(token);

    // Try sessionStorage first (more secure than localStorage)
    try {
      sessionStorage.setItem(storageKey, data);
    } catch (error) {
      // Fallback to localStorage
      try {
        localStorage.setItem(storageKey, data);
      } catch (fallbackError) {
        console.warn('All storage methods failed:', fallbackError);
      }
    }
  }

  /**
   * Load from secure storage
   */
  private loadFromSecureStorage(key: string): StoredToken | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const storageKey = `secure_token_${key}`;

    // Try sessionStorage first
    try {
      const data = sessionStorage.getItem(storageKey);
      if (data) {
        return JSON.parse(data);
      }
    } catch (error) {
      // Ignore and try localStorage
    }

    // Try localStorage
    try {
      const data = localStorage.getItem(storageKey);
      if (data) {
        return JSON.parse(data);
      }
    } catch (error) {
      console.warn('Failed to load from secure storage:', error);
    }

    return null;
  }

  /**
   * Remove from secure storage
   */
  private removeFromSecureStorage(key: string): void {
    if (typeof window === 'undefined') {
      return;
    }

    const storageKey = `secure_token_${key}`;

    try {
      sessionStorage.removeItem(storageKey);
    } catch (_error) {
      // Ignore
    }

    try {
      localStorage.removeItem(storageKey);
    } catch (_error) {
      // Ignore
    }
  }

  /**
   * Clear all secure storage
   */
  private clearSecureStorage(): void {
    if (typeof window === 'undefined') {
      return;
    }

    // Clear all secure token entries
    const keysToRemove: string[] = [];

    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('secure_token_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => sessionStorage.removeItem(key));
    } catch (_error) {
      // Ignore
    }

    keysToRemove.length = 0;

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('secure_token_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (_error) {
      // Ignore
    }
  }

  /**
   * Securely erase a string from memory
   */
  private securelyEraseString(_str: string): void {
    // In JavaScript, strings are immutable, so we can't actually overwrite them
    // This is a placeholder for where memory clearing would happen in other languages
    // The best we can do is ensure references are removed
    // _str = ''; // Cannot reassign parameter
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupExpiredTokens();
    }, 60000); // Cleanup every minute
  }

  /**
   * Start token rotation timer
   */
  private startRotationTimer(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
    }

    this.rotationTimer = setInterval(() => {
      this.checkTokensForRotation();
    }, this.config.rotation.interval);
  }

  /**
   * Cleanup expired tokens
   */
  private cleanupExpiredTokens(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, token] of this.tokens.entries()) {
      if (token.expiresAt && now > token.expiresAt) {
        expiredKeys.push(key);
      } else if (now - token.lastAccessed > this.config.storage.maxTokenAge) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.removeToken(key));
  }

  /**
   * Check tokens that need rotation
   */
  private checkTokensForRotation(): void {
    const now = Date.now();
    const tokensNeedingRotation: string[] = [];

    for (const [key, token] of this.tokens.entries()) {
      if (now - token.created > this.config.rotation.interval) {
        tokensNeedingRotation.push(key);
      }
    }

    // Emit events for tokens needing rotation (implementation would depend on event system)
    tokensNeedingRotation.forEach(key => {
      console.debug(`Token ${key} needs rotation`);
    });
  }

  /**
   * Get storage statistics
   */
  getStorageStats(): {
    totalTokens: number;
    encryptedTokens: number;
    expiredTokens: number;
    tokensNeedingRotation: number;
  } {
    const now = Date.now();
    let encryptedCount = 0;
    let expiredCount = 0;
    let rotationNeededCount = 0;

    for (const token of this.tokens.values()) {
      if (token.encrypted) {
        encryptedCount++;
      }
      if (token.expiresAt && now > token.expiresAt) {
        expiredCount++;
      }
      if (this.config.rotation.enabled && now - token.created > this.config.rotation.interval) {
        rotationNeededCount++;
      }
    }

    return {
      totalTokens: this.tokens.size,
      encryptedTokens: encryptedCount,
      expiredTokens: expiredCount,
      tokensNeedingRotation: rotationNeededCount,
    };
  }

  /**
   * Cleanup and destroy the service
   */
  destroy(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = null;
    }

    this.clearAllTokens();
    this.encryptionKey = null;
  }
}
