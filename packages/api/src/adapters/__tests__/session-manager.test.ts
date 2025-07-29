/**
 * Tests for SessionManager
 */

import { Session, AuthError } from '@supabase/supabase-js';
import {
  SessionManager,
  SessionManagerError,
  StoredSessionData,
  SessionManagerConfig,
  SessionEventCallbacks,
  createSessionManager,
  getSessionManager,
  resetSessionManager,
} from '../session-manager';
import { SupabaseAdapter } from '../supabase';

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock setTimeout and clearTimeout
jest.useFakeTimers();

describe('SessionManager', () => {
  let mockAdapter: jest.Mocked<SupabaseAdapter>;
  let mockSupabaseClient: any;
  let sessionManager: SessionManager;
  let mockCallbacks: jest.Mocked<SessionEventCallbacks>;

  const mockSession: Session = {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      user_metadata: { name: 'Test User' },
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
      aud: 'authenticated',
      app_metadata: {},
      role: 'authenticated',
    },
  };

  const mockStoredSession: StoredSessionData = {
    access_token: 'stored-access-token',
    refresh_token: 'stored-refresh-token',
    expires_at: Date.now() + 3600000, // 1 hour from now
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
    },
    last_refreshed: Date.now() - 1000,
    session_id: 'test-session-id',
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    jest.clearAllTimers();
    mockLocalStorage.getItem.mockReturnValue(null);
    mockLocalStorage.setItem.mockImplementation(() => {});
    mockLocalStorage.removeItem.mockImplementation(() => {});

    // Mock Supabase client
    mockSupabaseClient = {
      auth: {
        refreshSession: jest.fn(),
      },
    };

    // Mock SupabaseAdapter
    mockAdapter = {
      getClient: jest.fn().mockReturnValue(mockSupabaseClient),
    } as any;

    // Mock callbacks
    mockCallbacks = {
      onSessionRestored: jest.fn(),
      onSessionRefreshed: jest.fn(),
      onSessionExpired: jest.fn(),
      onSessionCleared: jest.fn(),
      onRefreshError: jest.fn(),
    };

    // Create session manager
    sessionManager = new SessionManager(
      mockAdapter,
      {
        refreshThreshold: 300,
        maxRetryAttempts: 2,
        retryDelayMs: 100,
        enablePersistence: true,
      },
      mockCallbacks
    );
  });

  afterEach(() => {
    sessionManager.stopSessionMonitoring();
    resetSessionManager();
  });

  describe('Constructor and Configuration', () => {
    it('should create session manager with default configuration', () => {
      const manager = new SessionManager(mockAdapter);
      expect(manager).toBeInstanceOf(SessionManager);
    });

    it('should create session manager with custom configuration', () => {
      const customConfig: Partial<SessionManagerConfig> = {
        refreshThreshold: 600,
        maxRetryAttempts: 5,
        enablePersistence: false,
      };

      const manager = new SessionManager(mockAdapter, customConfig);
      expect(manager).toBeInstanceOf(SessionManager);
    });

    it('should create session manager with callbacks', () => {
      const manager = new SessionManager(mockAdapter, {}, mockCallbacks);
      expect(manager).toBeInstanceOf(SessionManager);
    });
  });

  describe('Session Persistence', () => {
    it('should persist session successfully', async () => {
      const result = await sessionManager.persistSession(mockSession);

      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(result.session?.access_token).toBe(mockSession.access_token);
      expect(result.session?.refresh_token).toBe(mockSession.refresh_token);
      expect(result.session?.user.id).toBe(mockSession.user.id);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'agentic_workflow_session',
        expect.any(String)
      );
    });

    it('should handle invalid session data during persistence', async () => {
      const invalidSession = {
        access_token: '',
        refresh_token: '',
        user: null,
      } as any;

      const result = await sessionManager.persistSession(invalidSession);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Invalid session data - missing required fields');
    });

    it('should not persist to localStorage when persistence is disabled', async () => {
      const managerWithoutPersistence = new SessionManager(mockAdapter, {
        enablePersistence: false,
      });

      await managerWithoutPersistence.persistSession(mockSession);

      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('Session Restoration', () => {
    it('should restore valid session from localStorage', () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockStoredSession));

      const result = sessionManager.restoreSession();

      expect(result.success).toBe(true);
      expect(result.session).toEqual(mockStoredSession);
      expect(mockCallbacks.onSessionRestored).toHaveBeenCalledWith(mockStoredSession);
    });

    it('should return requiresLogin when no stored session exists', () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const result = sessionManager.restoreSession();

      expect(result.success).toBe(false);
      expect(result.requiresLogin).toBe(true);
    });

    it('should handle expired stored session', () => {
      const expiredSession = {
        ...mockStoredSession,
        expires_at: Date.now() - 1000, // Expired 1 second ago
      };

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(expiredSession));

      const result = sessionManager.restoreSession();

      expect(result.success).toBe(false);
      expect(result.requiresLogin).toBe(true);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('agentic_workflow_session');
    });

    it('should handle invalid stored session data', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid-json');

      const result = sessionManager.restoreSession();

      expect(result.success).toBe(false);
      expect(result.requiresLogin).toBe(true);
    });

    it('should not restore when persistence is disabled', () => {
      const managerWithoutPersistence = new SessionManager(mockAdapter, {
        enablePersistence: false,
      });

      const result = managerWithoutPersistence.restoreSession();

      expect(result.success).toBe(false);
      expect(result.requiresLogin).toBe(true);
      expect(mockLocalStorage.getItem).not.toHaveBeenCalled();
    });
  });

  describe('Session Cleanup', () => {
    it('should clear session data successfully', async () => {
      // First persist a session
      await sessionManager.persistSession(mockSession);

      // Then clear it
      sessionManager.clearSession();

      expect(sessionManager.getCurrentSession()).toBeNull();
      expect(sessionManager.hasValidSession()).toBe(false);
      expect(sessionManager.getAccessToken()).toBeNull();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('agentic_workflow_session');
      expect(mockCallbacks.onSessionCleared).toHaveBeenCalled();
    });

    it('should handle localStorage errors during cleanup gracefully', () => {
      mockLocalStorage.removeItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });

      expect(() => sessionManager.clearSession()).not.toThrow();
    });
  });

  describe('Token Refresh', () => {
    it('should refresh token successfully', async () => {
      const refreshedSession = {
        ...mockSession,
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
      };

      mockSupabaseClient.auth.refreshSession.mockResolvedValue({
        data: { session: refreshedSession },
        error: null,
      });

      // Persist initial session
      await sessionManager.persistSession(mockSession);

      // Trigger refresh manually by advancing time
      jest.advanceTimersByTime(3300000); // Advance by 55 minutes (3300 seconds)

      // Wait for async operations
      await jest.runAllTimersAsync();

      expect(mockSupabaseClient.auth.refreshSession).toHaveBeenCalledWith({
        refresh_token: mockSession.refresh_token,
      });
    });

    it('should handle refresh failure and clear session', async () => {
      const refreshError = new AuthError('token_expired', 401);
      mockSupabaseClient.auth.refreshSession.mockResolvedValue({
        data: { session: null },
        error: refreshError,
      });

      // Persist initial session
      await sessionManager.persistSession(mockSession);

      // Trigger refresh
      jest.advanceTimersByTime(3300000);
      await jest.runAllTimersAsync();

      expect(mockCallbacks.onRefreshError).toHaveBeenCalled();
      expect(mockCallbacks.onSessionExpired).toHaveBeenCalled();
    });

    it('should retry refresh on failure with exponential backoff', async () => {
      mockSupabaseClient.auth.refreshSession
        .mockResolvedValueOnce({
          data: { session: null },
          error: new Error('Network error'),
        })
        .mockResolvedValueOnce({
          data: { session: mockSession },
          error: null,
        });

      // Persist initial session
      await sessionManager.persistSession(mockSession);

      // Trigger refresh
      jest.advanceTimersByTime(3300000);
      await jest.runAllTimersAsync();

      expect(mockSupabaseClient.auth.refreshSession).toHaveBeenCalledTimes(2);
    });

    it('should not refresh when already refreshing', async () => {
      mockSupabaseClient.auth.refreshSession.mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(
              () =>
                resolve({
                  data: { session: mockSession },
                  error: null,
                }),
              1000
            )
          )
      );

      // Persist initial session
      await sessionManager.persistSession(mockSession);

      // Trigger multiple refreshes quickly
      jest.advanceTimersByTime(3300000);
      jest.advanceTimersByTime(3300000);

      await jest.runAllTimersAsync();

      // Should only call once despite multiple triggers
      expect(mockSupabaseClient.auth.refreshSession).toHaveBeenCalledTimes(1);
    });
  });

  describe('Session State Management', () => {
    it('should return current session', async () => {
      await sessionManager.persistSession(mockSession);

      const currentSession = sessionManager.getCurrentSession();
      expect(currentSession).toBeDefined();
      expect(currentSession?.access_token).toBe(mockSession.access_token);
    });

    it('should check valid session status', async () => {
      await sessionManager.persistSession(mockSession);

      expect(sessionManager.hasValidSession()).toBe(true);

      sessionManager.clearSession();
      expect(sessionManager.hasValidSession()).toBe(false);
    });

    it('should return access token', async () => {
      await sessionManager.persistSession(mockSession);

      const token = sessionManager.getAccessToken();
      expect(token).toBe(mockSession.access_token);

      sessionManager.clearSession();
      expect(sessionManager.getAccessToken()).toBeNull();
    });

    it('should detect expired session', async () => {
      const expiredSession = {
        ...mockSession,
        expires_in: -1, // Already expired
      };

      await sessionManager.persistSession(expiredSession);

      // The session should be considered invalid immediately
      expect(sessionManager.hasValidSession()).toBe(false);
    });
  });

  describe('Session Monitoring', () => {
    it('should start and stop session monitoring', () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockStoredSession));

      sessionManager.startSessionMonitoring();
      expect(mockCallbacks.onSessionRestored).toHaveBeenCalled();

      sessionManager.stopSessionMonitoring();
      // Should not throw
    });

    it('should handle restoration errors during monitoring start', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid-json');

      expect(() => sessionManager.startSessionMonitoring()).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should create SessionManagerError with proper properties', () => {
      const originalError = new Error('Original error');
      const error = new SessionManagerError('Session error', 'TEST_CODE', originalError);

      expect(error.message).toBe('Session error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.originalError).toBe(originalError);
      expect(error.name).toBe('SessionManagerError');
    });
  });

  describe('Factory Functions', () => {
    it('should create session manager using factory function', () => {
      const manager = createSessionManager(mockAdapter);
      expect(manager).toBeInstanceOf(SessionManager);
    });

    it('should return singleton instance', () => {
      const manager1 = getSessionManager(mockAdapter);
      const manager2 = getSessionManager(mockAdapter);

      expect(manager1).toBe(manager2);
      expect(manager1).toBeInstanceOf(SessionManager);
    });

    it('should create new instance after reset', () => {
      const manager1 = getSessionManager(mockAdapter);
      resetSessionManager();
      const manager2 = getSessionManager(mockAdapter);

      expect(manager1).not.toBe(manager2);
      expect(manager2).toBeInstanceOf(SessionManager);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing localStorage gracefully', () => {
      const originalLocalStorage = window.localStorage;
      // @ts-ignore
      delete window.localStorage;

      const manager = new SessionManager(mockAdapter, {
        enablePersistence: true,
      });

      expect(() => manager.restoreSession()).not.toThrow();

      // Restore localStorage
      window.localStorage = originalLocalStorage;
    });

    it('should handle session persistence without user', async () => {
      const sessionWithoutUser = {
        ...mockSession,
        user: null,
      } as any;

      const result = await sessionManager.persistSession(sessionWithoutUser);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_SESSION_DATA');
    });

    it('should handle refresh without active session', async () => {
      // Try to refresh without any active session
      sessionManager['attemptTokenRefresh']();

      // Should not crash or throw
      await jest.runAllTimersAsync();
    });

    it('should handle malformed stored session data', () => {
      const malformedSession = {
        access_token: 'test',
        // Missing required fields
      };

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(malformedSession));

      const result = sessionManager.restoreSession();

      expect(result.success).toBe(false);
      expect(result.requiresLogin).toBe(true);
      expect(mockLocalStorage.removeItem).toHaveBeenCalled();
    });
  });
});
