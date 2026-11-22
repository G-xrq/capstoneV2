import { useEffect, useRef, useState } from 'react';
import { realtimeSync } from '../utils/realtimeSync';

/**
 * Subscribe a dashboard view or panel to instant, zero-flicker real-time updates.
 *
 * - Debounces rapid event bursts into a single clean silent refresh.
 * - Defers background refetches while the browser tab is hidden, then fires ONCE
 *   immediately the moment the user switches back to the tab.
 *
 * @param {string|string[]} scopes - Affected scopes (e.g., ['campaigns', 'donations'])
 * @param {Function} onSync - Callback to silently re-fetch view state
 * @param {object} options - { enabled?: boolean, debounceMs?: number }
 */
export function useRealtimeSync(scopes, onSync, { enabled = true, debounceMs = 280 } = {}) {
  const callbackRef = useRef(onSync);
  callbackRef.current = onSync;

  const scopesKey = Array.isArray(scopes) ? scopes.slice().sort().join(',') : String(scopes || 'all');

  useEffect(() => {
    if (!enabled) return;

    let debounceTimer = null;
    let pendingWhileHidden = false;
    let lastPayload = null;

    const execute = (payload) => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        pendingWhileHidden = true;
        lastPayload = payload;
        return;
      }
      pendingWhileHidden = false;
      try {
        callbackRef.current?.(payload);
      } catch (err) {
        console.warn('[useRealtimeSync] Callback error:', err);
      }
    };

    const schedule = (payload) => {
      lastPayload = payload;
      if (debounceTimer) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null;
        execute(lastPayload);
      }, debounceMs);
    };

    const handleVisible = () => {
      if (document.visibilityState === 'visible' && pendingWhileHidden) {
        pendingWhileHidden = false;
        schedule(lastPayload || { scopes: scopesKey.split(','), source: 'visibility-catchup' });
      }
    };

    const scopeList = scopesKey.split(',').filter(Boolean);
    const unsubscribe = realtimeSync.subscribe(scopeList, schedule);
    document.addEventListener('visibilitychange', handleVisible);

    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', handleVisible);
      if (debounceTimer) window.clearTimeout(debounceTimer);
    };
  }, [scopesKey, enabled, debounceMs]);
}

/**
 * Observe live SSE / fallback connection status (optional UI indicator hook).
 */
export function useRealtimeStatus() {
  const [status, setStatus] = useState(() => realtimeSync.getStatus());
  useEffect(() => realtimeSync.subscribeStatus(setStatus), []);
  return status;
}
