/**
 * Authentication Caching Layer
 *
 * Provides request deduplication, session caching, and performance optimization
 * for authentication operations to reduce API calls and improve user experience.
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  key: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

export interface AuthCacheConfig {
  maxSize: number;
  defaultTTL: number; // milliseconds
  sessionTTL: number;
  userProfileTTL: number;
  requestDeduplicationTTL: number;
  enableMetrics: boolean;
}

export const DEFAULT_AUTH_CACHE_CONFIG: AuthCacheConfig = {
  maxSize: 100,
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  sessionTTL: 30 * 60 * 1000, // 30 minutes
  userProfileTTL: 15 * 60 * 1000, // 15 minutes
  requestDeduplicationTTL: 30 * 1000, // 30 seconds
  enableMetrics: true,
};

export class AuthCache {
  private cache = new Map<string, CacheEntry<any>>();
  private pendingRequests = new Map<string, Promise<any>>();
  private stats = { hits: 0, misses: 0 };
  private config: AuthCacheConfig;

  constructor(config: Partial<AuthCacheConfig> = {}) {
    this.config = { ...DEFAULT_AUTH_CACHE_CONFIG, ...config };
  }

  /**
   * Get cached data or return null if not found/expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      if (this.config.enableMetrics) this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      if (this.config.enableMetrics) this.stats.misses++;
      return null;
    }

    if (this.config.enableMetrics) this.stats.hits++;
    return entry.data;
  }

  /**
   * Set cached data with TTL
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const finalTTL = ttl || this.config.defaultTTL;
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + finalTTL,
      key,
    };

    // Enforce max size by removing oldest entries
    if (this.cache.size >= this.config.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, entry);
  }

  /**
   * Delete cached entry
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear();
    this.pendingRequests.clear();
    if (this.config.enableMetrics) {
      this.stats = { hits: 0, misses: 0 };
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const size = this.cache.size;
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size,
      hitRate,
    };
  }

  /**
   * Request deduplication - prevents multiple identical requests
   */
  async deduplicate<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    // Check if request is already pending
    const pendingRequest = this.pendingRequests.get(key);
    if (pendingRequest) {
      return pendingRequest;
    }

    // Create new request and cache the promise
    const request = requestFn().finally(() => {
      // Remove from pending requests when complete
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, request);
    return request;
  }

  /**
   * Cache session data with extended TTL
   */
  cacheSession(sessionId: string, sessionData: any): void {
    this.set(`session:${sessionId}`, sessionData, this.config.sessionTTL);
  }

  /**
   * Get cached session data
   */
  getSession(sessionId: string): any | null {
    return this.get(`session:${sessionId}`);
  }

  /**
   * Cache user profile data
   */
  cacheUserProfile(userId: string, profileData: any): void {
    this.set(`profile:${userId}`, profileData, this.config.userProfileTTL);
  }

  /**
   * Get cached user profile
   */
  getUserProfile(userId: string): any | null {
    return this.get(`profile:${userId}`);
  }

  /**
   * Cache validation results
   */
  cacheValidation(key: string, result: any): void {
    this.set(`validation:${key}`, result, this.config.requestDeduplicationTTL);
  }

  /**
   * Get cached validation result
   */
  getValidation(key: string): any | null {
    return this.get(`validation:${key}`);
  }

  /**
   * Invalidate related caches when user data changes
   */
  invalidateUser(userId: string): void {
    const keysToDelete: string[] = [];

    for (const [key] of this.cache) {
      if (
        key.includes(userId) ||
        key.startsWith(`profile:${userId}`) ||
        key.startsWith(`session:${userId}`)
      ) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.delete(key));
  }

  /**
   * Invalidate session-related caches
   */
  invalidateSession(sessionId?: string): void {
    if (sessionId) {
      this.delete(`session:${sessionId}`);
    } else {
      // Clear all session caches
      const keysToDelete: string[] = [];
      for (const [key] of this.cache) {
        if (key.startsWith('session:')) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => this.delete(key));
    }
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.cache.delete(key));
  }

  /**
   * Evict oldest entry to make room
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Date.now();

    for (const [key, entry] of this.cache) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Preload commonly accessed data
   */
  async preload(
    preloadFn: () => Promise<Array<{ key: string; data: any; ttl?: number }>>
  ): Promise<void> {
    try {
      const items = await preloadFn();
      items.forEach(({ key, data, ttl }) => {
        this.set(key, data, ttl);
      });
    } catch (error) {
      console.warn('Auth cache preload failed:', error);
    }
  }

  /**
   * Get cache size in bytes (approximate)
   */
  getSize(): number {
    let size = 0;
    for (const [key, entry] of this.cache) {
      size += key.length * 2; // Approximate string size
      size += JSON.stringify(entry.data).length * 2; // Approximate data size
    }
    return size;
  }

  /**
   * Configure cache settings
   */
  configure(config: Partial<AuthCacheConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Request deduplication utility for auth operations
 */
export class AuthRequestDeduplicator {
  private cache: AuthCache;

  constructor(cache: AuthCache) {
    this.cache = cache;
  }

  /**
   * Deduplicate login requests
   */
  async deduplicateLogin(email: string, requestFn: () => Promise<any>): Promise<any> {
    const key = `login:${email}`;
    return this.cache.deduplicate(key, requestFn);
  }

  /**
   * Deduplicate session validation requests
   */
  async deduplicateSessionValidation(
    sessionId: string,
    requestFn: () => Promise<any>
  ): Promise<any> {
    const key = `validate:${sessionId}`;
    return this.cache.deduplicate(key, requestFn);
  }

  /**
   * Deduplicate user profile requests
   */
  async deduplicateUserProfile(userId: string, requestFn: () => Promise<any>): Promise<any> {
    const key = `user:${userId}`;
    return this.cache.deduplicate(key, requestFn);
  }

  /**
   * Deduplicate token refresh requests
   */
  async deduplicateTokenRefresh(refreshToken: string, requestFn: () => Promise<any>): Promise<any> {
    const key = `refresh:${refreshToken.slice(0, 10)}`;
    return this.cache.deduplicate(key, requestFn);
  }
}

/**
 * Create optimized auth cache instance
 */
export function createAuthCache(config?: Partial<AuthCacheConfig>): AuthCache {
  return new AuthCache(config);
}

/**
 * Create request deduplicator
 */
export function createAuthRequestDeduplicator(cache: AuthCache): AuthRequestDeduplicator {
  return new AuthRequestDeduplicator(cache);
}

export default AuthCache;
