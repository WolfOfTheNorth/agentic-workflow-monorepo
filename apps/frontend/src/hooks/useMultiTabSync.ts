import { useCallback, useEffect, useRef } from 'react';

export interface TabSyncEvent {
  type: string;
  data?: unknown;
  timestamp: number;
  tabId: string;
  origin?: string;
}

export interface UseMultiTabSyncOptions {
  eventKey?: string;
  debounceMs?: number;
  ignoreOwnEvents?: boolean;
}

export interface UseMultiTabSyncReturn {
  broadcast: (type: string, data?: unknown) => void;
  isOnline: boolean;
  activeTabCount: number;
}

/**
 * Custom hook for multi-tab synchronization using localStorage events
 *
 * @param onEvent - Callback function to handle incoming events from other tabs
 * @param options - Configuration options
 * @returns Object with broadcast function and tab state information
 */
export function useMultiTabSync(
  onEvent: (event: TabSyncEvent) => void | Promise<void>,
  options: UseMultiTabSyncOptions = {}
): UseMultiTabSyncReturn {
  const { eventKey = 'multi_tab_sync', debounceMs = 100, ignoreOwnEvents = true } = options;

  const lastBroadcastRef = useRef(0);
  const tabIdRef = useRef(`${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const pendingEventRef = useRef<number | null>(null);
  const isOnlineRef = useRef(navigator.onLine);
  const activeTabCountRef = useRef(1);

  // Broadcast event to other tabs
  const broadcast = useCallback(
    (type: string, data?: unknown) => {
      try {
        const timestamp = Date.now();
        const event: TabSyncEvent = {
          type,
          data,
          timestamp,
          tabId: tabIdRef.current,
          origin: window.location.origin,
        };

        lastBroadcastRef.current = timestamp;
        localStorage.setItem(eventKey, JSON.stringify(event));

        // Clean up after other tabs have had time to read
        setTimeout(() => {
          try {
            const currentEvent = localStorage.getItem(eventKey);
            if (currentEvent) {
              const parsedEvent: TabSyncEvent = JSON.parse(currentEvent);
              if (parsedEvent.tabId === event.tabId) {
                localStorage.removeItem(eventKey);
              }
            }
          } catch {
            // Silently handle cleanup errors
          }
        }, debounceMs * 2);
      } catch (error) {
        console.warn('Failed to broadcast tab sync event:', error);
      }
    },
    [eventKey, debounceMs]
  );

  // Handle storage events from other tabs
  useEffect(() => {
    const handleStorageEvent = async (storageEvent: StorageEvent) => {
      if (storageEvent.key !== eventKey || !storageEvent.newValue) {
        return;
      }

      try {
        const event: TabSyncEvent = JSON.parse(storageEvent.newValue);

        // Ignore events that are too recent (debouncing)
        if (Date.now() - event.timestamp < debounceMs / 2) {
          return;
        }

        // Ignore our own events if configured to do so
        if (ignoreOwnEvents && event.tabId === tabIdRef.current) {
          return;
        }

        // Ignore events from our own recent broadcasts
        if (Math.abs(event.timestamp - lastBroadcastRef.current) < debounceMs) {
          return;
        }

        // Clear any pending event handling
        if (pendingEventRef.current) {
          clearTimeout(pendingEventRef.current);
        }

        // Debounce event handling
        pendingEventRef.current = Number(
          setTimeout(async () => {
            try {
              await onEvent(event);
            } catch (error) {
              console.warn('Error handling tab sync event:', error);
            }
          }, debounceMs / 4)
        );
      } catch (error) {
        console.warn('Failed to parse tab sync event:', error);
      }
    };

    window.addEventListener('storage', handleStorageEvent);

    return () => {
      window.removeEventListener('storage', handleStorageEvent);
      if (pendingEventRef.current) {
        clearTimeout(pendingEventRef.current);
      }
    };
  }, [eventKey, onEvent, debounceMs, ignoreOwnEvents]);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => {
      isOnlineRef.current = true;
      broadcast('tab_online', { tabId: tabIdRef.current });
    };

    const handleOffline = () => {
      isOnlineRef.current = false;
      broadcast('tab_offline', { tabId: tabIdRef.current });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [broadcast]);

  // Tab lifecycle management
  useEffect(() => {
    // Capture tabId at effect setup time to avoid stale closure reference
    const currentTabId = tabIdRef.current;

    // Announce tab opening
    broadcast('tab_opened', { tabId: currentTabId });

    const handleBeforeUnload = () => {
      broadcast('tab_closing', { tabId: currentTabId });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        broadcast('tab_hidden', { tabId: currentTabId });
      } else {
        broadcast('tab_visible', { tabId: currentTabId });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      broadcast('tab_closing', { tabId: currentTabId });
    };
  }, [broadcast]);

  // Periodic tab count update
  useEffect(() => {
    const updateTabCount = () => {
      broadcast('tab_heartbeat', {
        tabId: tabIdRef.current,
        timestamp: Date.now(),
      });
    };

    // Send heartbeat every 10 seconds
    const interval = setInterval(updateTabCount, 10000);
    updateTabCount(); // Send initial heartbeat

    return () => {
      clearInterval(interval);
    };
  }, [broadcast]);

  return {
    broadcast,
    isOnline: isOnlineRef.current,
    activeTabCount: activeTabCountRef.current,
  };
}

/**
 * Specialized hook for authentication-specific multi-tab synchronization
 */
export function useAuthMultiTabSync(onAuthEvent: (event: TabSyncEvent) => void | Promise<void>) {
  return useMultiTabSync(onAuthEvent, {
    eventKey: 'auth_multi_tab_sync',
    debounceMs: 50,
    ignoreOwnEvents: true,
  });
}
