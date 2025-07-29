/**
 * Performance Optimization and Caching System for Supabase Authentication
 *
 * This module implements user profile caching, request deduplication,
 * connection optimization, and efficient session storage to meet
 * performance requirements of < 2 seconds for auth operations.
 */

import { ProfileResponse } from '../types/auth';
import { StoredSessionData } from './session-manager';

/**
 * Cache configuration interface
 */
export interface CacheConfig {
  // Profile cache settings
  profileCacheTTL: number; // Time to live in milliseconds
  maxProfileCacheSize: number; // Maximum number of profiles to cache
  enableProfileCache: boolean;

  // Request deduplication settings
  deduplicationWindow: number; // Time window for deduplication in ms
  maxPendingRequests: number; // Maximum concurrent requests to track
  enableRequestDeduplication: boolean;

  // Performance metrics
  enableMetrics: boolean;
  metricsRetentionTime: number; // How long to keep metrics in ms
}

/**
 * Cache entry interface for profiles
 */
interface ProfileCacheEntry {
  profile: ProfileResponse;
  cachedAt: number;
  accessCount: number;
  lastAccessed: number;
}

/**
 * Request deduplication entry
 */
interface PendingRequest<T> {
  promise: Promise<T>;
  createdAt: number;
  requestKey: string;
}

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
  cacheHits: number;
  cacheMisses: number;
  cacheEvictions: number;
  deduplicatedRequests: number;
  averageResponseTime: number;
  requestCounts: {
    authentication: number;
    profileFetch: number;
    sessionRefresh: number;
  };
  cacheStats: {
    currentSize: number;
    maxSize: number;
    hitRate: number;
  };
}

/**
 * Performance and caching manager
 */
export class PerformanceCache {
  private config: CacheConfig;
  private profileCache = new Map<string, ProfileCacheEntry>();
  private pendingRequests = new Map<string, PendingRequest<any>>();
  private metrics: PerformanceMetrics;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private logger: PerformanceLogger;

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      profileCacheTTL: 300000, // 5 minutes
      maxProfileCacheSize: 100,
      enableProfileCache: true,
      deduplicationWindow: 5000, // 5 seconds
      maxPendingRequests: 50,
      enableRequestDeduplication: true,
      enableMetrics: true,
      metricsRetentionTime: 3600000, // 1 hour
      ...config,
    };

    this.logger = new PerformanceLogger('PerformanceCache');
    this.metrics = this.initializeMetrics();
    this.startCleanupTimer();

    this.logger.info('PerformanceCache initialized', {
      profileCacheTTL: this.config.profileCacheTTL,
      maxProfileCacheSize: this.config.maxProfileCacheSize,
      enableRequestDeduplication: this.config.enableRequestDeduplication,
    });
  }

  // ===== PROFILE CACHING =====

  /**
   * Get cached profile or return null if not found/expired
   */
  getCachedProfile(userId: string): ProfileResponse | null {
    if (!this.config.enableProfileCache) {
      return null;
    }

    const entry = this.profileCache.get(userId);
    if (!entry) {
      this.recordCacheMiss();
      return null;
    }

    const now = Date.now();
    const isExpired = now - entry.cachedAt > this.config.profileCacheTTL;

    if (isExpired) {
      this.profileCache.delete(userId);
      this.recordCacheMiss();
      this.recordCacheEviction();
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = now;

    this.recordCacheHit();
    this.logger.debug('Profile cache hit', { userId, accessCount: entry.accessCount });

    return entry.profile;
  }

  /**
   * Cache a user profile
   */
  cacheProfile(userId: string, profile: ProfileResponse): void {
    if (!this.config.enableProfileCache) {
      return;
    }

    const now = Date.now();

    // Check if cache is at capacity and evict LRU entry
    if (this.profileCache.size >= this.config.maxProfileCacheSize) {
      this.evictLeastRecentlyUsed();
    }

    const entry: ProfileCacheEntry = {
      profile: { ...profile }, // Clone to avoid mutations
      cachedAt: now,
      accessCount: 1,
      lastAccessed: now,
    };

    this.profileCache.set(userId, entry);

    this.logger.debug('Profile cached', {
      userId,
      cacheSize: this.profileCache.size,
      maxSize: this.config.maxProfileCacheSize,
    });
  }

  /**
   * Invalidate cached profile (e.g., after profile update)
   */
  invalidateProfile(userId: string): boolean {
    const deleted = this.profileCache.delete(userId);
    if (deleted) {
      this.logger.debug('Profile cache invalidated', { userId });
    }
    return deleted;
  }

  /**
   * Clear all cached profiles
   */
  clearProfileCache(): void {
    const size = this.profileCache.size;
    this.profileCache.clear();
    this.logger.info('Profile cache cleared', { clearedEntries: size });
  }

  // ===== REQUEST DEDUPLICATION =====

  /**
   * Execute operation with request deduplication
   */
  async deduplicateRequest<T>(requestKey: string, operation: () => Promise<T>): Promise<T> {
    if (!this.config.enableRequestDeduplication) {
      return operation();
    }

    // Check if there's already a pending request for this key
    const existing = this.pendingRequests.get(requestKey);
    if (existing) {
      const now = Date.now();
      const age = now - existing.createdAt;

      // If request is within deduplication window, return existing promise
      if (age < this.config.deduplicationWindow) {
        this.recordDeduplicatedRequest();
        this.logger.debug('Request deduplicated', {
          requestKey,
          age,
          deduplicationWindow: this.config.deduplicationWindow,
        });
        return existing.promise;
      } else {
        // Remove expired pending request
        this.pendingRequests.delete(requestKey);
      }
    }

    // Create new request
    const startTime = Date.now();
    const promise = operation().finally(() => {
      // Clean up completed request
      this.pendingRequests.delete(requestKey);

      // Record response time
      const responseTime = Date.now() - startTime;
      this.recordResponseTime(responseTime);
    });

    // Store pending request if we haven't hit the limit
    if (this.pendingRequests.size < this.config.maxPendingRequests) {
      this.pendingRequests.set(requestKey, {
        promise,
        createdAt: Date.now(),
        requestKey,
      });
    }

    return promise;
  }

  /**
   * Generate request key for authentication operations
   */
  static generateAuthRequestKey(email: string): string {
    return `auth:${email}`;
  }

  /**
   * Generate request key for profile operations
   */
  static generateProfileRequestKey(userId: string): string {
    return `profile:${userId}`;
  }

  /**
   * Generate request key for session refresh
   */
  static generateSessionRefreshKey(refreshToken: string): string {
    // Use last 5 characters of refresh token for key
    const tokenSuffix = refreshToken.slice(-5);
    return `session_refresh:${tokenSuffix}`;
  }

  // ===== SESSION OPTIMIZATION =====

  /**
   * Optimize session storage by compressing data
   */
  optimizeSessionData(sessionData: StoredSessionData): string {
    try {
      // Create optimized session object with shorter keys
      const optimized = {
        at: sessionData.access_token,
        rt: sessionData.refresh_token,
        exp: sessionData.expires_at,
        lr: sessionData.last_refreshed,
        sid: sessionData.session_id,
        u: {
          i: sessionData.user.id,
          e: sessionData.user.email,
          n: sessionData.user.name,
          ca: sessionData.user.created_at,
          ua: sessionData.user.updated_at,
        },
      };

      return JSON.stringify(optimized);
    } catch (error) {
      this.logger.error('Failed to optimize session data', error);
      // Fallback to regular serialization
      return JSON.stringify(sessionData);
    }
  }

  /**
   * Restore session data from optimized format
   */
  restoreSessionData(optimizedData: string): StoredSessionData | null {
    try {
      const parsed = JSON.parse(optimizedData);

      // Check if data is in optimized format
      if (parsed.at && parsed.rt && parsed.u?.i) {
        return {
          access_token: parsed.at,
          refresh_token: parsed.rt,
          expires_at: parsed.exp,
          last_refreshed: parsed.lr,
          session_id: parsed.sid,
          user: {
            id: parsed.u.i,
            email: parsed.u.e,
            name: parsed.u.n,
            created_at: parsed.u.ca,
            updated_at: parsed.u.ua,
          },
        };
      } else if (parsed.access_token && parsed.refresh_token && parsed.user?.id) {
        // Data is in regular StoredSessionData format
        return parsed as StoredSessionData;
      } else {
        // Invalid format
        this.logger.warn('Invalid session data format', { parsed });
        return null;
      }
    } catch (error) {
      this.logger.error('Failed to restore session data', error);
      return null;
    }
  }

  // ===== CONNECTION OPTIMIZATION =====

  /**
   * Batch multiple profile requests into a single operation
   */
  async batchProfileRequests(
    userIds: string[],
    fetchFunction: (userIds: string[]) => Promise<ProfileResponse[]>
  ): Promise<Map<string, ProfileResponse>> {
    const results = new Map<string, ProfileResponse>();
    const uncachedIds: string[] = [];

    // First, try to get profiles from cache
    for (const userId of userIds) {
      const cached = this.getCachedProfile(userId);
      if (cached) {
        results.set(userId, cached);
      } else {
        uncachedIds.push(userId);
      }
    }

    // Fetch uncached profiles in batch
    if (uncachedIds.length > 0) {
      try {
        const requestKey = `batch_profiles:${uncachedIds.join(',')}`;
        const profiles = await this.deduplicateRequest(requestKey, () =>
          fetchFunction(uncachedIds)
        );

        // Cache the fetched profiles
        profiles.forEach((profile, index) => {
          const userId = uncachedIds[index];
          if (userId && profile) {
            this.cacheProfile(userId, profile);
            results.set(userId, profile);
          }
        });

        this.logger.debug('Batch profile request completed', {
          requestedIds: userIds.length,
          cachedHits: userIds.length - uncachedIds.length,
          fetchedProfiles: profiles.length,
        });
      } catch (error) {
        this.logger.error('Batch profile request failed', error);
        throw error;
      }
    }

    return results;
  }

  /**
   * Optimize network requests by adding intelligent delays
   */
  async optimizedExecute<T>(
    operation: () => Promise<T>,
    operationType: 'authentication' | 'profile' | 'session'
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await operation();

      // Record successful operation
      this.recordRequest(operationType);

      return result;
    } catch (error) {
      this.logger.warn(`Optimized ${operationType} operation failed`, error);
      throw error;
    } finally {
      const responseTime = Date.now() - startTime;
      this.recordResponseTime(responseTime);
    }
  }

  // ===== METRICS AND MONITORING =====

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return {
      ...this.metrics,
      cacheStats: {
        currentSize: this.profileCache.size,
        maxSize: this.config.maxProfileCacheSize,
        hitRate: this.calculateHitRate(),
      },
    };
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
    this.logger.info('Performance metrics reset');
  }

  // ===== CLEANUP AND MAINTENANCE =====

  /**
   * Start periodic cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // Run cleanup every 5 minutes
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, 300000);
  }

  /**
   * Stop cleanup timer
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Perform periodic cleanup
   */
  private performCleanup(): void {
    const startTime = Date.now();

    // Clean expired cache entries
    const expiredKeys: string[] = [];
    const now = Date.now();

    for (const [userId, entry] of this.profileCache) {
      if (now - entry.cachedAt > this.config.profileCacheTTL) {
        expiredKeys.push(userId);
      }
    }

    expiredKeys.forEach(key => {
      this.profileCache.delete(key);
      this.recordCacheEviction();
    });

    // Clean expired pending requests
    const expiredRequestKeys: string[] = [];
    for (const [key, request] of this.pendingRequests) {
      if (now - request.createdAt > this.config.deduplicationWindow) {
        expiredRequestKeys.push(key);
      }
    }

    expiredRequestKeys.forEach(key => {
      this.pendingRequests.delete(key);
    });

    const cleanupTime = Date.now() - startTime;
    this.logger.debug('Periodic cleanup completed', {
      expiredCacheEntries: expiredKeys.length,
      expiredRequests: expiredRequestKeys.length,
      cleanupTime,
      currentCacheSize: this.profileCache.size,
      currentPendingRequests: this.pendingRequests.size,
    });
  }

  /**
   * Shutdown cache and cleanup resources
   */
  shutdown(): void {
    this.stopCleanupTimer();
    this.clearProfileCache();
    this.pendingRequests.clear();
    this.logger.info('PerformanceCache shutdown completed');
  }

  // ===== PRIVATE HELPER METHODS =====

  private initializeMetrics(): PerformanceMetrics {
    return {
      cacheHits: 0,
      cacheMisses: 0,
      cacheEvictions: 0,
      deduplicatedRequests: 0,
      averageResponseTime: 0,
      requestCounts: {
        authentication: 0,
        profileFetch: 0,
        sessionRefresh: 0,
      },
      cacheStats: {
        currentSize: 0,
        maxSize: this.config.maxProfileCacheSize,
        hitRate: 0,
      },
    };
  }

  private recordCacheHit(): void {
    if (this.config.enableMetrics) {
      this.metrics.cacheHits++;
    }
  }

  private recordCacheMiss(): void {
    if (this.config.enableMetrics) {
      this.metrics.cacheMisses++;
    }
  }

  private recordCacheEviction(): void {
    if (this.config.enableMetrics) {
      this.metrics.cacheEvictions++;
    }
  }

  private recordDeduplicatedRequest(): void {
    if (this.config.enableMetrics) {
      this.metrics.deduplicatedRequests++;
    }
  }

  private recordRequest(type: 'authentication' | 'profile' | 'session'): void {
    if (this.config.enableMetrics) {
      if (type === 'authentication') {
        this.metrics.requestCounts.authentication++;
      } else if (type === 'profile') {
        this.metrics.requestCounts.profileFetch++;
      } else if (type === 'session') {
        this.metrics.requestCounts.sessionRefresh++;
      }
    }
  }

  private recordResponseTime(responseTime: number): void {
    if (this.config.enableMetrics) {
      // Update running average
      const totalRequests = Object.values(this.metrics.requestCounts).reduce(
        (sum, count) => sum + count,
        0
      );

      if (totalRequests > 0) {
        this.metrics.averageResponseTime =
          (this.metrics.averageResponseTime * (totalRequests - 1) + responseTime) / totalRequests;
      } else {
        this.metrics.averageResponseTime = responseTime;
      }
    }
  }

  private calculateHitRate(): number {
    const total = this.metrics.cacheHits + this.metrics.cacheMisses;
    return total > 0 ? (this.metrics.cacheHits / total) * 100 : 0;
  }

  private evictLeastRecentlyUsed(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [userId, entry] of this.profileCache) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = userId;
      }
    }

    if (oldestKey) {
      this.profileCache.delete(oldestKey);
      this.recordCacheEviction();
      this.logger.debug('LRU cache eviction', {
        evictedUserId: oldestKey,
        lastAccessed: new Date(oldestTime).toISOString(),
      });
    }
  }
}

/**
 * Performance logger for consistent logging
 */
class PerformanceLogger {
  constructor(private context: string) {}

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    const timestamp = new Date().toISOString();

    switch (level) {
      case 'debug':
        console.debug(`[${timestamp}] DEBUG [${this.context}] ${message}`, data || '');
        break;
      case 'info':
        console.info(`[${timestamp}] INFO [${this.context}] ${message}`, data || '');
        break;
      case 'warn':
        console.warn(`[${timestamp}] WARN [${this.context}] ${message}`, data || '');
        break;
      case 'error':
        console.error(`[${timestamp}] ERROR [${this.context}] ${message}`, data || '');
        break;
    }
  }

  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  error(message: string, error?: any): void {
    const errorData =
      error instanceof Error ? { message: error.message, stack: error.stack } : error;
    this.log('error', message, errorData);
  }
}

/**
 * Factory function to create PerformanceCache instance
 */
export function createPerformanceCache(config?: Partial<CacheConfig>): PerformanceCache {
  return new PerformanceCache(config);
}

/**
 * Default performance cache instance (singleton)
 */
let defaultCache: PerformanceCache | null = null;

export function getPerformanceCache(config?: Partial<CacheConfig>): PerformanceCache {
  if (!defaultCache) {
    defaultCache = createPerformanceCache(config);
  }
  return defaultCache;
}

/**
 * Reset performance cache instance (useful for testing)
 */
export function resetPerformanceCache(): void {
  if (defaultCache) {
    defaultCache.shutdown();
    defaultCache = null;
  }
}
