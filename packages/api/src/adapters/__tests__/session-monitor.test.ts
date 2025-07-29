/**
 * Tests for SessionMonitor
 */

import {
  SessionMonitor,
  SessionMonitorConfig,
  SessionMonitorEvents,
  createSessionMonitor,
  getSessionMonitor,
  resetSessionMonitor,
} from '../session-monitor';
import { SessionManager, StoredSessionData } from '../session-manager';
import { SupabaseAdapter } from '../supabase';

// Mock DOM APIs
Object.defineProperty(window, 'navigator', {
  value: {
    onLine: true,
    connection: {
      effectiveType: '4g',
    },
  },
  writable: true,
});

Object.defineProperty(document, 'visibilityState', {
  value: 'visible',
  writable: true,
});

// Mock event listeners
const mockAddEventListener = jest.fn();
const mockRemoveEventListener = jest.fn();
Object.defineProperty(window, 'addEventListener', { value: mockAddEventListener });
Object.defineProperty(window, 'removeEventListener', { value: mockRemoveEventListener });
Object.defineProperty(document, 'addEventListener', { value: mockAddEventListener });
Object.defineProperty(document, 'removeEventListener', { value: mockRemoveEventListener });

// Mock timers
jest.useFakeTimers();

describe('SessionMonitor', () => {
  let mockSessionManager: jest.Mocked<SessionManager>;
  let mockAdapter: jest.Mocked<SupabaseAdapter>;
  let mockSupabaseClient: any;
  let sessionMonitor: SessionMonitor;
  let mockCallbacks: jest.Mocked<SessionMonitorEvents>;

  const mockStoredSession: StoredSessionData = {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_at: Date.now() + 3600000, // 1 hour from now
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
    },
    last_refreshed: Date.now(),
    session_id: 'test-session-id',
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    jest.clearAllTimers();

    // Mock Supabase client
    mockSupabaseClient = {
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: { session: { access_token: 'test-token' } },
          error: null,
        }),
      },
    };

    // Mock SupabaseAdapter
    mockAdapter = {
      getClient: jest.fn().mockReturnValue(mockSupabaseClient),
    } as any;

    // Mock SessionManager
    mockSessionManager = {
      getCurrentSession: jest.fn().mockReturnValue(mockStoredSession),
      hasValidSession: jest.fn().mockReturnValue(true),
      clearSession: jest.fn(),
    } as any;

    // Mock callbacks
    mockCallbacks = {
      onSessionRestored: jest.fn(),
      onSessionRefreshed: jest.fn(),
      onSessionExpired: jest.fn(),
      onSessionCleared: jest.fn(),
      onRefreshError: jest.fn(),
      onNetworkOffline: jest.fn(),
      onNetworkOnline: jest.fn(),
      onSessionConflict: jest.fn(),
      onSessionHeartbeat: jest.fn(),
      onMonitoringStarted: jest.fn(),
      onMonitoringStopped: jest.fn(),
      onValidityCheckFailed: jest.fn(),
    };

    // Create session monitor
    sessionMonitor = new SessionMonitor(
      mockSessionManager,
      mockAdapter,
      {
        validityCheckInterval: 1000,
        networkCheckInterval: 500,
        heartbeatInterval: 2000,
        enableNetworkMonitoring: true,
        enableVisibilityMonitoring: true,
        enableStorageMonitoring: true,
        enableHeartbeat: true,
      },
      mockCallbacks
    );
  });

  afterEach(() => {
    sessionMonitor.stopMonitoring();
    resetSessionMonitor();
  });

  describe('Constructor and Configuration', () => {
    it('should create session monitor with default configuration', () => {
      const monitor = new SessionMonitor(mockSessionManager, mockAdapter);
      expect(monitor).toBeInstanceOf(SessionMonitor);
    });

    it('should create session monitor with custom configuration', () => {
      const customConfig: Partial<SessionMonitorConfig> = {
        validityCheckInterval: 5000,
        enableHeartbeat: false,
      };

      const monitor = new SessionMonitor(mockSessionManager, mockAdapter, customConfig);
      expect(monitor).toBeInstanceOf(SessionMonitor);
    });

    it('should initialize with correct network status', () => {
      const status = sessionMonitor.getMonitoringStatus();
      expect(status.networkStatus.isOnline).toBe(true);
      expect(status.networkStatus.connectionType).toBe('4g');
    });
  });

  describe('Monitoring Lifecycle', () => {
    it('should start monitoring successfully', () => {
      sessionMonitor.startMonitoring();

      const status = sessionMonitor.getMonitoringStatus();
      expect(status.isActive).toBe(true);
      expect(mockCallbacks.onMonitoringStarted).toHaveBeenCalled();

      // Check that event listeners were added
      expect(mockAddEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('storage', expect.any(Function));
    });

    it('should stop monitoring successfully', () => {
      sessionMonitor.startMonitoring();
      sessionMonitor.stopMonitoring();

      const status = sessionMonitor.getMonitoringStatus();
      expect(status.isActive).toBe(false);
      expect(mockCallbacks.onMonitoringStopped).toHaveBeenCalled();

      // Check that event listeners were removed
      expect(mockRemoveEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(mockRemoveEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });

    it('should not start monitoring if already active', () => {
      sessionMonitor.startMonitoring();
      sessionMonitor.startMonitoring(); // Second call

      expect(mockCallbacks.onMonitoringStarted).toHaveBeenCalledTimes(1);
    });

    it('should handle stop monitoring when not active', () => {
      expect(() => sessionMonitor.stopMonitoring()).not.toThrow();
    });
  });

  describe('Session Validity Checking', () => {
    it('should perform validity check successfully', async () => {
      const isValid = await sessionMonitor.checkSessionValidity();

      expect(isValid).toBe(true);
      expect(mockAdapter.getClient).toHaveBeenCalled();
      expect(mockSupabaseClient.auth.getSession).toHaveBeenCalled();
    });

    it('should handle expired session during validity check', async () => {
      const expiredSession = {
        ...mockStoredSession,
        expires_at: Date.now() - 1000, // Expired 1 second ago
      };

      mockSessionManager.getCurrentSession.mockReturnValue(expiredSession);

      const isValid = await sessionMonitor.checkSessionValidity();

      expect(isValid).toBe(false);
    });

    it('should handle no active session during validity check', async () => {
      mockSessionManager.getCurrentSession.mockReturnValue(null);

      const isValid = await sessionMonitor.checkSessionValidity();

      expect(isValid).toBe(false);
    });

    it('should handle Supabase error during validity check', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Auth error' },
      });

      const isValid = await sessionMonitor.checkSessionValidity();

      expect(isValid).toBe(false);
      expect(mockCallbacks.onValidityCheckFailed).toHaveBeenCalled();
    });

    it('should perform periodic validity checks when monitoring', async () => {
      sessionMonitor.startMonitoring();

      // Fast forward time to trigger validity checks
      jest.advanceTimersByTime(2000); // 2 seconds
      await jest.runAllTimersAsync();

      expect(mockSupabaseClient.auth.getSession).toHaveBeenCalledTimes(2);
    });
  });

  describe('Network Monitoring', () => {
    it('should detect network offline event', () => {
      sessionMonitor.startMonitoring();

      // Simulate network going offline
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });

      // Find and call the offline event listener
      const offlineCall = mockAddEventListener.mock.calls.find(call => call[0] === 'offline');
      if (offlineCall) {
        offlineCall[1](); // Call the offline listener
      }

      expect(mockCallbacks.onNetworkOffline).toHaveBeenCalled();
    });

    it('should detect network online event', () => {
      sessionMonitor.startMonitoring();

      // Simulate network coming online
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true });

      // Find and call the online event listener
      const onlineCall = mockAddEventListener.mock.calls.find(call => call[0] === 'online');
      if (onlineCall) {
        onlineCall[1](); // Call the online listener
      }

      expect(mockCallbacks.onNetworkOnline).toHaveBeenCalled();
    });

    it('should perform periodic network checks', () => {
      sessionMonitor.startMonitoring();

      // Initially online
      expect(sessionMonitor.getMonitoringStatus().networkStatus.isOnline).toBe(true);

      // Change network status
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });

      // Fast forward time to trigger network check
      jest.advanceTimersByTime(1000);

      expect(mockCallbacks.onNetworkOffline).toHaveBeenCalled();
    });
  });

  describe('Visibility Monitoring', () => {
    it('should handle page visibility change to visible', () => {
      sessionMonitor.startMonitoring();

      // Find and call the visibility change listener
      const visibilityCall = mockAddEventListener.mock.calls.find(
        call => call[0] === 'visibilitychange'
      );
      if (visibilityCall) {
        Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true });
        visibilityCall[1](); // Call the visibility listener
      }

      // Should trigger a validity check
      expect(mockSupabaseClient.auth.getSession).toHaveBeenCalled();
    });

    it('should handle page visibility change to hidden', () => {
      sessionMonitor.startMonitoring();

      // Find and call the visibility change listener
      const visibilityCall = mockAddEventListener.mock.calls.find(
        call => call[0] === 'visibilitychange'
      );
      if (visibilityCall) {
        Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true });
        visibilityCall[1](); // Call the visibility listener
      }

      // Should not trigger additional actions for hidden state
    });
  });

  describe('Storage Monitoring', () => {
    it('should handle storage change events', () => {
      sessionMonitor.startMonitoring();

      const newSessionData = {
        ...mockStoredSession,
        session_id: 'new-session-id',
        access_token: 'new-access-token',
      };

      // Find and call the storage change listener
      const storageCall = mockAddEventListener.mock.calls.find(call => call[0] === 'storage');
      if (storageCall) {
        const mockStorageEvent = {
          key: 'agentic_workflow_session',
          newValue: JSON.stringify(newSessionData),
        } as StorageEvent;

        storageCall[1](mockStorageEvent); // Call the storage listener
      }

      // Should detect session conflict
      expect(mockCallbacks.onSessionConflict).toHaveBeenCalled();
    });

    it('should ignore non-session storage changes', () => {
      sessionMonitor.startMonitoring();

      // Find and call the storage change listener
      const storageCall = mockAddEventListener.mock.calls.find(call => call[0] === 'storage');
      if (storageCall) {
        const mockStorageEvent = {
          key: 'other_storage_key',
          newValue: 'some value',
        } as StorageEvent;

        storageCall[1](mockStorageEvent); // Call the storage listener
      }

      // Should not trigger session conflict
      expect(mockCallbacks.onSessionConflict).not.toHaveBeenCalled();
    });
  });

  describe('Session Heartbeat', () => {
    it('should send heartbeat when active session exists', () => {
      sessionMonitor.startMonitoring();

      // Fast forward time to trigger heartbeat
      jest.advanceTimersByTime(2500); // 2.5 seconds

      expect(mockCallbacks.onSessionHeartbeat).toHaveBeenCalledWith(mockStoredSession);
    });

    it('should not send heartbeat when no active session', () => {
      mockSessionManager.getCurrentSession.mockReturnValue(null);
      sessionMonitor.startMonitoring();

      // Fast forward time to trigger heartbeat
      jest.advanceTimersByTime(2500);

      expect(mockCallbacks.onSessionHeartbeat).not.toHaveBeenCalled();
    });

    it('should track heartbeat statistics', () => {
      sessionMonitor.startMonitoring();

      // Fast forward time to trigger multiple heartbeats
      jest.advanceTimersByTime(5000); // 5 seconds

      const status = sessionMonitor.getMonitoringStatus();
      expect(status.stats.heartbeats).toBeGreaterThan(0);
    });
  });

  describe('Session Conflict Resolution', () => {
    it('should detect and resolve duplicate session conflict', () => {
      sessionMonitor.startMonitoring();

      const conflictingSession = {
        ...mockStoredSession,
        session_id: 'conflicting-session-id',
        last_refreshed: Date.now() + 1000, // Newer
      };

      // Simulate storage change with conflicting session
      const storageCall = mockAddEventListener.mock.calls.find(call => call[0] === 'storage');
      if (storageCall) {
        const mockStorageEvent = {
          key: 'agentic_workflow_session',
          newValue: JSON.stringify(conflictingSession),
        } as StorageEvent;

        storageCall[1](mockStorageEvent);
      }

      expect(mockCallbacks.onSessionConflict).toHaveBeenCalledWith(
        expect.objectContaining({
          conflictType: 'duplicate_session',
          resolution: 'use_newer',
        })
      );
    });

    it('should detect user mismatch conflict', () => {
      sessionMonitor.startMonitoring();

      const conflictingSession = {
        ...mockStoredSession,
        user: {
          ...mockStoredSession.user,
          id: 'different-user-id',
        },
      };

      // Simulate storage change with different user
      const storageCall = mockAddEventListener.mock.calls.find(call => call[0] === 'storage');
      if (storageCall) {
        const mockStorageEvent = {
          key: 'agentic_workflow_session',
          newValue: JSON.stringify(conflictingSession),
        } as StorageEvent;

        storageCall[1](mockStorageEvent);
      }

      expect(mockCallbacks.onSessionConflict).toHaveBeenCalledWith(
        expect.objectContaining({
          conflictType: 'user_mismatch',
          resolution: 'logout_all',
        })
      );
    });

    it('should apply logout_all resolution', () => {
      sessionMonitor.startMonitoring();

      const conflictingSession = {
        ...mockStoredSession,
        user: { ...mockStoredSession.user, id: 'different-user-id' },
      };

      // Simulate conflict that requires logout_all
      const storageCall = mockAddEventListener.mock.calls.find(call => call[0] === 'storage');
      if (storageCall) {
        const mockStorageEvent = {
          key: 'agentic_workflow_session',
          newValue: JSON.stringify(conflictingSession),
        } as StorageEvent;

        storageCall[1](mockStorageEvent);
      }

      expect(mockSessionManager.clearSession).toHaveBeenCalled();
    });
  });

  describe('Statistics and Status', () => {
    it('should track monitoring statistics', async () => {
      sessionMonitor.startMonitoring();

      // Trigger some activities
      await sessionMonitor.checkSessionValidity();
      jest.advanceTimersByTime(2500); // Trigger heartbeat

      const status = sessionMonitor.getMonitoringStatus();

      expect(status.stats.validityChecks).toBeGreaterThan(0);
      expect(status.stats.heartbeats).toBeGreaterThan(0);
      expect(status.stats.startTime).toBeDefined();
      expect(status.stats.lastActivity).toBeDefined();
    });

    it('should return current monitoring status', () => {
      const status = sessionMonitor.getMonitoringStatus();

      expect(status).toHaveProperty('isActive');
      expect(status).toHaveProperty('networkStatus');
      expect(status).toHaveProperty('stats');
      expect(status).toHaveProperty('currentSession');
    });

    it('should update statistics on network disconnections', () => {
      sessionMonitor.startMonitoring();

      // Simulate network disconnection
      const offlineCall = mockAddEventListener.mock.calls.find(call => call[0] === 'offline');
      if (offlineCall) {
        offlineCall[1]();
      }

      const status = sessionMonitor.getMonitoringStatus();
      expect(status.stats.networkDisconnections).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors during validity check gracefully', async () => {
      mockSupabaseClient.auth.getSession.mockRejectedValue(new Error('Network error'));

      const isValid = await sessionMonitor.checkSessionValidity();

      expect(isValid).toBe(false);
      expect(mockCallbacks.onValidityCheckFailed).toHaveBeenCalled();
    });

    it('should handle malformed storage data', () => {
      sessionMonitor.startMonitoring();

      // Find and call the storage change listener with invalid JSON
      const storageCall = mockAddEventListener.mock.calls.find(call => call[0] === 'storage');
      if (storageCall) {
        const mockStorageEvent = {
          key: 'agentic_workflow_session',
          newValue: 'invalid-json',
        } as StorageEvent;

        expect(() => storageCall[1](mockStorageEvent)).not.toThrow();
      }
    });
  });

  describe('Factory Functions', () => {
    it('should create session monitor using factory function', () => {
      const monitor = createSessionMonitor(mockSessionManager, mockAdapter);
      expect(monitor).toBeInstanceOf(SessionMonitor);
    });

    it('should return singleton instance', () => {
      const monitor1 = getSessionMonitor(mockSessionManager, mockAdapter);
      const monitor2 = getSessionMonitor(mockSessionManager, mockAdapter);

      expect(monitor1).toBe(monitor2);
      expect(monitor1).toBeInstanceOf(SessionMonitor);
    });

    it('should create new instance after reset', () => {
      const monitor1 = getSessionMonitor(mockSessionManager, mockAdapter);
      resetSessionMonitor();
      const monitor2 = getSessionMonitor(mockSessionManager, mockAdapter);

      expect(monitor1).not.toBe(monitor2);
      expect(monitor2).toBeInstanceOf(SessionMonitor);
    });
  });

  describe('Configuration Options', () => {
    it('should respect disabled monitoring options', () => {
      const monitorWithDisabledFeatures = new SessionMonitor(mockSessionManager, mockAdapter, {
        enableNetworkMonitoring: false,
        enableVisibilityMonitoring: false,
        enableStorageMonitoring: false,
        enableHeartbeat: false,
      });

      monitorWithDisabledFeatures.startMonitoring();

      // Should not add event listeners for disabled features
      const onlineCalls = mockAddEventListener.mock.calls.filter(call => call[0] === 'online');
      const visibilityCalls = mockAddEventListener.mock.calls.filter(
        call => call[0] === 'visibilitychange'
      );
      const storageCalls = mockAddEventListener.mock.calls.filter(call => call[0] === 'storage');

      expect(onlineCalls.length).toBe(0);
      expect(visibilityCalls.length).toBe(0);
      expect(storageCalls.length).toBe(0);
    });
  });
});
