/**
 * Tests for Performance Cache functionality
 */

import {
  PerformanceCache,
  createPerformanceCache,
  CacheConfig,
  PerformanceMetrics,
} from '../performance-cache';
import { ProfileResponse } from '../../types/auth';
import { StoredSessionData } from '../session-manager';

describe('PerformanceCache', () => {
  let cache: PerformanceCache;
  const mockProfile: ProfileResponse = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
  };

  const mockSessionData: StoredSessionData = {
    access_token: 'access-token-123',
    refresh_token: 'refresh-token-123',
    expires_at: Date.now() + 3600000,
    user: mockProfile,
    last_refreshed: Date.now(),
    session_id: 'session-123',
  };

  beforeEach(() => {
    cache = createPerformanceCache({
      profileCacheTTL: 300000, // 5 minutes
      maxProfileCacheSize: 10,
      enableProfileCache: true,
      deduplicationWindow: 5000,
      enableRequestDeduplication: true,
      enableMetrics: true,
    });
  });

  afterEach(() => {
    cache.shutdown();
  });

  describe('Profile Caching', () => {
    it('should cache and retrieve user profiles', () => {
      // Initially no cache
      expect(cache.getCachedProfile('user-123')).toBeNull();

      // Cache a profile
      cache.cacheProfile('user-123', mockProfile);

      // Should retrieve from cache
      const cached = cache.getCachedProfile('user-123');
      expect(cached).toEqual(mockProfile);
      expect(cached).not.toBe(mockProfile); // Should be a clone
    });

    it('should return null for expired cache entries', done => {
      const shortTTLCache = createPerformanceCache({
        profileCacheTTL: 100, // 100ms
        enableProfileCache: true,
      });

      shortTTLCache.cacheProfile('user-123', mockProfile);

      // Should be cached initially
      expect(shortTTLCache.getCachedProfile('user-123')).toEqual(mockProfile);

      // Wait for expiration
      setTimeout(() => {
        expect(shortTTLCache.getCachedProfile('user-123')).toBeNull();
        shortTTLCache.shutdown();
        done();
      }, 150);
    });

    it('should invalidate cached profiles', () => {
      cache.cacheProfile('user-123', mockProfile);
      expect(cache.getCachedProfile('user-123')).toEqual(mockProfile);

      const invalidated = cache.invalidateProfile('user-123');
      expect(invalidated).toBe(true);
      expect(cache.getCachedProfile('user-123')).toBeNull();
    });

    it('should implement LRU eviction when cache is full', () => {
      const smallCache = createPerformanceCache({
        maxProfileCacheSize: 2,
        enableProfileCache: true,
      });

      // Fill cache to capacity
      smallCache.cacheProfile('user-1', { ...mockProfile, id: 'user-1' });
      smallCache.cacheProfile('user-2', { ...mockProfile, id: 'user-2' });

      // Access user-1 to make it more recently used
      smallCache.getCachedProfile('user-1');

      // Add third profile, should evict user-2 (least recently used)
      smallCache.cacheProfile('user-3', { ...mockProfile, id: 'user-3' });

      expect(smallCache.getCachedProfile('user-1')).toBeTruthy();
      expect(smallCache.getCachedProfile('user-2')).toBeNull();
      expect(smallCache.getCachedProfile('user-3')).toBeTruthy();

      smallCache.shutdown();
    });

    it('should clear all cached profiles', () => {
      cache.cacheProfile('user-1', { ...mockProfile, id: 'user-1' });
      cache.cacheProfile('user-2', { ...mockProfile, id: 'user-2' });

      cache.clearProfileCache();

      expect(cache.getCachedProfile('user-1')).toBeNull();
      expect(cache.getCachedProfile('user-2')).toBeNull();
    });
  });

  describe('Request Deduplication', () => {
    it('should deduplicate concurrent requests', async () => {
      let callCount = 0;
      const mockOperation = jest.fn(async () => {
        callCount++;
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'result';
      });

      // Start multiple concurrent requests
      const promises = [
        cache.deduplicateRequest('test-key', mockOperation),
        cache.deduplicateRequest('test-key', mockOperation),
        cache.deduplicateRequest('test-key', mockOperation),
      ];

      const results = await Promise.all(promises);

      // All should return the same result
      expect(results).toEqual(['result', 'result', 'result']);

      // But operation should only be called once
      expect(mockOperation).toHaveBeenCalledTimes(1);
      expect(callCount).toBe(1);
    });

    it('should not deduplicate requests outside the window', async () => {
      const mockOperation = jest.fn().mockResolvedValue('result');

      // Create cache with short deduplication window
      const shortWindowCache = createPerformanceCache({
        deduplicationWindow: 100,
        enableRequestDeduplication: true,
      });

      await shortWindowCache.deduplicateRequest('test-key', mockOperation);

      // Wait for deduplication window to pass
      await new Promise(resolve => setTimeout(resolve, 150));

      await shortWindowCache.deduplicateRequest('test-key', mockOperation);

      expect(mockOperation).toHaveBeenCalledTimes(2);
      shortWindowCache.shutdown();
    });

    it('should generate correct request keys', () => {
      expect(PerformanceCache.generateAuthRequestKey('user@example.com')).toBe(
        'auth:user@example.com'
      );

      expect(PerformanceCache.generateProfileRequestKey('user-123')).toBe('profile:user-123');

      expect(PerformanceCache.generateSessionRefreshKey('refresh-token-123456789')).toBe(
        'session_refresh:56789'
      );
    });
  });

  describe('Session Optimization', () => {
    it('should optimize and restore session data', () => {
      const optimized = cache.optimizeSessionData(mockSessionData);
      const restored = cache.restoreSessionData(optimized);

      expect(restored).toEqual(mockSessionData);
      expect(optimized.length).toBeLessThan(JSON.stringify(mockSessionData).length);
    });

    it('should handle malformed session data gracefully', () => {
      const malformed = '{"invalid": "data"}';
      const restored = cache.restoreSessionData(malformed);

      expect(restored).toBeNull();
    });

    it('should fallback to regular format for non-optimized data', () => {
      const regularFormat = JSON.stringify(mockSessionData);
      const restored = cache.restoreSessionData(regularFormat);

      expect(restored).toEqual(mockSessionData);
    });
  });

  describe('Batch Operations', () => {
    it('should batch profile requests efficiently', async () => {
      const userIds = ['user-1', 'user-2', 'user-3'];
      const mockProfiles = userIds.map(id => ({ ...mockProfile, id }));

      // Pre-cache one profile
      cache.cacheProfile('user-1', mockProfiles[0]);

      const mockFetchFunction = jest.fn().mockResolvedValue([
        mockProfiles[1], // user-2
        mockProfiles[2], // user-3
      ]);

      const results = await cache.batchProfileRequests(userIds, mockFetchFunction);

      expect(results.size).toBe(3);
      expect(results.get('user-1')).toEqual(mockProfiles[0]);
      expect(results.get('user-2')).toEqual(mockProfiles[1]);
      expect(results.get('user-3')).toEqual(mockProfiles[2]);

      // Should only fetch uncached profiles
      expect(mockFetchFunction).toHaveBeenCalledWith(['user-2', 'user-3']);
    });
  });

  describe('Performance Metrics', () => {
    it('should track cache hits and misses', () => {
      cache.cacheProfile('user-123', mockProfile);

      // Cache hit
      cache.getCachedProfile('user-123');

      // Cache miss
      cache.getCachedProfile('non-existent');

      const metrics = cache.getMetrics();
      expect(metrics.cacheHits).toBe(1);
      expect(metrics.cacheMisses).toBe(1);
      expect(metrics.cacheStats.hitRate).toBe(50);
    });

    it('should track request types', async () => {
      const mockOperation = jest.fn().mockResolvedValue('result');

      await cache.optimizedExecute(mockOperation, 'authentication');
      await cache.optimizedExecute(mockOperation, 'profile');
      await cache.optimizedExecute(mockOperation, 'session');

      const metrics = cache.getMetrics();
      expect(metrics.requestCounts.authentication).toBe(1);
      expect(metrics.requestCounts.profileFetch).toBe(1);
      expect(metrics.requestCounts.sessionRefresh).toBe(1);
    });

    it('should calculate average response time', async () => {
      const mockOperation = jest.fn().mockResolvedValue('result');

      await cache.optimizedExecute(mockOperation, 'authentication');
      await cache.optimizedExecute(mockOperation, 'profile');

      const metrics = cache.getMetrics();
      expect(metrics.averageResponseTime).toBeGreaterThan(0);
    });

    it('should reset metrics', () => {
      cache.cacheProfile('user-123', mockProfile);
      cache.getCachedProfile('user-123');

      let metrics = cache.getMetrics();
      expect(metrics.cacheHits).toBe(1);

      cache.resetMetrics();

      metrics = cache.getMetrics();
      expect(metrics.cacheHits).toBe(0);
      expect(metrics.cacheMisses).toBe(0);
    });
  });

  describe('Cleanup and Maintenance', () => {
    it('should perform periodic cleanup', done => {
      const cleanupCache = createPerformanceCache({
        profileCacheTTL: 100, // 100ms
        enableProfileCache: true,
      });

      // Add some profiles
      cleanupCache.cacheProfile('user-1', { ...mockProfile, id: 'user-1' });
      cleanupCache.cacheProfile('user-2', { ...mockProfile, id: 'user-2' });

      // Wait for cleanup to run
      setTimeout(() => {
        const metrics = cleanupCache.getMetrics();
        expect(metrics.cacheEvictions).toBeGreaterThan(0);
        cleanupCache.shutdown();
        done();
      }, 350); // Wait for cleanup cycle
    });

    it('should shutdown cleanly', () => {
      cache.cacheProfile('user-123', mockProfile);

      cache.shutdown();

      // Should clear cache
      expect(cache.getCachedProfile('user-123')).toBeNull();
    });
  });

  describe('Configuration Options', () => {
    it('should respect disabled caching', () => {
      const disabledCache = createPerformanceCache({
        enableProfileCache: false,
      });

      disabledCache.cacheProfile('user-123', mockProfile);
      expect(disabledCache.getCachedProfile('user-123')).toBeNull();

      disabledCache.shutdown();
    });

    it('should respect disabled deduplication', async () => {
      const disabledDedupeCache = createPerformanceCache({
        enableRequestDeduplication: false,
      });

      const mockOperation = jest.fn().mockResolvedValue('result');

      await Promise.all([
        disabledDedupeCache.deduplicateRequest('test-key', mockOperation),
        disabledDedupeCache.deduplicateRequest('test-key', mockOperation),
      ]);

      expect(mockOperation).toHaveBeenCalledTimes(2);
      disabledDedupeCache.shutdown();
    });

    it('should respect disabled metrics', async () => {
      const disabledMetricsCache = createPerformanceCache({
        enableMetrics: false,
      });

      disabledMetricsCache.cacheProfile('user-123', mockProfile);
      disabledMetricsCache.getCachedProfile('user-123');

      const metrics = disabledMetricsCache.getMetrics();
      expect(metrics.cacheHits).toBe(0);
      expect(metrics.cacheMisses).toBe(0);

      disabledMetricsCache.shutdown();
    });
  });
});
