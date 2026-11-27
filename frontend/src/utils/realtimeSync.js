/**
 * BBDRTS Centralized Real-Time Dashboard Synchronization Engine
 *
 * Keeps every dashboard (Donor, NGO/Organization, Admin, Public Landing) live
 * without manual page refreshes using a 3-layer resilient architecture:
 *   1. Persistent Server-Sent Events (SSE) push from GET /api/realtime/stream (<100ms)
 *   2. Lightweight monotonic version check via GET /api/realtime/version on tab focus,
 *      reconnect, and silent safety interval (detects any missed events with zero DB load)
 *   3. Cross-tab BroadcastChannel + localStorage bridge for instant sibling-tab updates
 */

import { API_URL } from '../config';

const CHANNEL_NAME = 'bbdrts_realtime_v1';
const STORAGE_PING_KEY = 'bbdrts_realtime_ping_v1';

class RealtimeSyncEngine {
  constructor() {
    this.started = false;
    this.eventSource = null;
    this.channel = null;
    this.subscribers = new Set(); // { scopes: Set<string>, fn: Function }
    this.statusListeners = new Set();

    this.connected = false;
    this.mode = 'connecting'; // 'sse' | 'polling' | 'connecting'
    this.lastVersion = 0;
    this.scopeVersions = {};
    this.lastEventAt = null;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.fallbackPollTimer = null;
    this.safetyPollTimer = null;
    this.lastVersionCheckAt = 0;
    this.versionEndpointMissing = false;
    this.tabId = `tab_${Math.random().toString(36).slice(2, 10)}`;
  }

  start() {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;

    this._setupCrossTabBridge();
    this._connectSse();
    this._setupLifecycleListeners();

    // Quiet safety-net check every 60s while tab is visible (SSE handles real-time push)
    this.safetyPollTimer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      this.checkVersionNow(false);
    }, 60000);
  }

  _emitStatus() {
    const snapshot = this.getStatus();
    for (const listener of this.statusListeners) {
      try {
        listener(snapshot);
      } catch (_) {}
    }
  }

  getStatus() {
    return {
      connected: this.connected,
      mode: this.mode,
      lastVersion: this.lastVersion,
      lastEventAt: this.lastEventAt,
    };
  }

  subscribeStatus(listener) {
    this.start();
    this.statusListeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  subscribe(scopes, callback) {
    this.start();
    const list = Array.isArray(scopes) ? scopes : [scopes];
    const scopeSet = new Set(list.filter(Boolean));
    const entry = { scopes: scopeSet, fn: callback };
    this.subscribers.add(entry);
    return () => {
      this.subscribers.delete(entry);
    };
  }

  /**
   * Dispatch matching scopes to all active subscribers.
   */
  _dispatch(changedScopes, meta = {}) {
    const scopeList = Array.isArray(changedScopes) ? changedScopes : [changedScopes];
    const valid = scopeList.filter(Boolean);
    if (valid.length === 0) return;

    this.lastEventAt = Date.now();
    this._emitStatus();

    const isWildcard = valid.includes('all') || valid.includes('*');

    for (const sub of this.subscribers) {
      let matched = isWildcard || sub.scopes.has('all') || sub.scopes.has('*');
      if (!matched) {
        for (const sc of valid) {
          if (sub.scopes.has(sc)) {
            matched = true;
            break;
          }
        }
      }
      if (matched) {
        try {
          sub.fn({ scopes: valid, ...meta });
        } catch (err) {
          console.warn('[RealtimeSync] Subscriber error:', err);
        }
      }
    }
  }

  /**
   * Apply a new scopeVersions map from server and dispatch ONLY scopes that changed.
   */
  _applyVersionMap(nextVersion, nextScopeVersions, source = 'server') {
    if (!nextScopeVersions || typeof nextScopeVersions !== 'object') {
      if (nextVersion && this.lastVersion > 0 && nextVersion !== this.lastVersion) {
        this.lastVersion = nextVersion;
        this._dispatch(['all'], { version: nextVersion, source });
      } else if (nextVersion) {
        this.lastVersion = nextVersion;
      }
      return;
    }

    const isFirstHydration = this.lastVersion === 0;
    const changed = [];

    if (!isFirstHydration) {
      // Detect server restart (version reset lower than lastVersion)
      if (nextVersion && nextVersion < this.lastVersion) {
        changed.push('all');
      } else {
        for (const [scope, ver] of Object.entries(nextScopeVersions)) {
          const prev = this.scopeVersions[scope] || 0;
          if (ver > prev) {
            changed.push(scope);
          }
        }
      }
    }

    this.lastVersion = Number(nextVersion || this.lastVersion || 1);
    this.scopeVersions = { ...this.scopeVersions, ...nextScopeVersions };

    if (changed.length > 0) {
      this._dispatch(changed, { version: this.lastVersion, source });
    }
  }

  _connectSse() {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      this._startFallbackPolling();
      return;
    }

    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch (_) {}
      this.eventSource = null;
    }

    try {
      const es = new EventSource(`${API_URL}/api/realtime/stream`);
      this.eventSource = es;

      es.addEventListener('connected', (ev) => {
        this.connected = true;
        this.mode = 'sse';
        this.reconnectAttempts = 0;
        this.versionEndpointMissing = false;
        this._stopFallbackPolling();

        try {
          const data = JSON.parse(ev.data || '{}');
          this._applyVersionMap(data.version, data.scopeVersions, 'sse-handshake');
        } catch (_) {}
        this._emitStatus();
      });

      es.addEventListener('update', (ev) => {
        try {
          const data = JSON.parse(ev.data || '{}');
          if (data.version) this.lastVersion = Math.max(this.lastVersion, Number(data.version));
          if (data.scopeVersions) {
            this.scopeVersions = { ...this.scopeVersions, ...data.scopeVersions };
          }
          const scopes = Array.isArray(data.scopes) && data.scopes.length > 0 ? data.scopes : ['all'];
          this._dispatch(scopes, { version: data.version, reason: data.reason, source: 'sse' });
          this._broadcastToSiblingTabs(scopes, data.version);
        } catch (_) {}
      });

      es.onerror = () => {
        this.connected = false;
        this.mode = 'polling';
        this._emitStatus();

        try {
          es.close();
        } catch (_) {}
        this.eventSource = null;

        this._startFallbackPolling();

        if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
        this.reconnectAttempts = Math.min(this.reconnectAttempts + 1, 6);
        const delayMs = Math.min(2000 * Math.pow(1.6, this.reconnectAttempts - 1), 15000);
        this.reconnectTimer = window.setTimeout(() => {
          this._connectSse();
        }, delayMs);
      };
    } catch (_) {
      this._startFallbackPolling();
    }
  }

  _startFallbackPolling() {
    if (this.fallbackPollTimer) return;
    this.mode = 'polling';
    this._emitStatus();
    this.fallbackPollTimer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      this.checkVersionNow(true);
    }, 20000);
  }

  _stopFallbackPolling() {
    if (this.fallbackPollTimer) {
      window.clearInterval(this.fallbackPollTimer);
      this.fallbackPollTimer = null;
    }
  }

  async checkVersionNow(allowLegacyFallback = false) {
    const now = Date.now();
    if (now - this.lastVersionCheckAt < 1500) return;
    this.lastVersionCheckAt = now;

    // If backend has not yet rolled out /api/realtime/version (404 during deploy), quietly refresh on fallback ticks
    if (this.versionEndpointMissing) {
      if (allowLegacyFallback) {
        this._dispatch(['all'], { source: 'legacy-poll' });
      }
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/realtime/version?_t=${now}`, {
        cache: 'no-store',
      });
      if (res.status === 404) {
        this.versionEndpointMissing = true;
        if (allowLegacyFallback) {
          this._dispatch(['all'], { source: 'legacy-poll' });
        }
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      this._applyVersionMap(data.version, data.scopeVersions, 'version-poll');
    } catch (_) {
      // Transient offline or Render wake-up; will automatically recover on next tick
    }
  }

  _setupCrossTabBridge() {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = (ev) => {
          const msg = ev.data;
          if (!msg || msg.tabId === this.tabId) return;
          if (Array.isArray(msg.scopes) && msg.scopes.length > 0) {
            this._dispatch(msg.scopes, { version: msg.version, source: 'cross-tab' });
          }
        };
      }
    } catch (_) {}

    window.addEventListener('storage', (ev) => {
      if (ev.key !== STORAGE_PING_KEY || !ev.newValue) return;
      try {
        const msg = JSON.parse(ev.newValue);
        if (!msg || msg.tabId === this.tabId) return;
        if (Array.isArray(msg.scopes) && msg.scopes.length > 0) {
          this._dispatch(msg.scopes, { version: msg.version, source: 'storage-tab' });
        }
      } catch (_) {}
    });
  }

  _broadcastToSiblingTabs(scopes, version = this.lastVersion) {
    const payload = { tabId: this.tabId, scopes, version, ts: Date.now() };
    try {
      if (this.channel) {
        this.channel.postMessage(payload);
      }
    } catch (_) {}
    try {
      localStorage.setItem(STORAGE_PING_KEY, JSON.stringify(payload));
    } catch (_) {}
  }

  /**
   * Manually nudge local & sibling tabs after a client-side mutation.
   */
  notifyLocal(scopes) {
    const list = Array.isArray(scopes) ? scopes : [scopes];
    this._dispatch(list, { source: 'local' });
    this._broadcastToSiblingTabs(list);
  }

  _setupLifecycleListeners() {
    const handleResume = () => {
      if (document.visibilityState === 'hidden') return;
      this.checkVersionNow(false);
      if (!this.connected && !this.eventSource) {
        this._connectSse();
      }
    };

    document.addEventListener('visibilitychange', handleResume);
    window.addEventListener('focus', handleResume);
    window.addEventListener('online', () => {
      this.versionEndpointMissing = false;
      this.checkVersionNow(false);
      if (!this.connected) this._connectSse();
    });
  }
}

export const realtimeSync = new RealtimeSyncEngine();

export function notifyLocalMutation(scopes) {
  realtimeSync.notifyLocal(scopes);
}
