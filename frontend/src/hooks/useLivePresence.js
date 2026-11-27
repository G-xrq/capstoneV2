import { useEffect, useRef } from 'react';
import { API_URL } from '../config';

const SESSION_KEY = 'bbdrts_live_session_id';
const USER_IDLE_AFTER_MS = 2 * 60 * 1000; // Mark idle after 2 minutes without user input

function generateSessionId() {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '')
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
  return `sess_${rand}`;
}

export function getLiveSessionId() {
  if (typeof window === 'undefined') return 'sess_ssr';
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id || !/^[a-zA-Z0-9_-]{8,96}$/.test(id)) {
      id = generateSessionId();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch (_) {
    return `sess_${Date.now().toString(36)}`;
  }
}

/**
 * Real-time client presence heartbeat hook.
 * Accurately tracks real user activity (active vs idle/background tab),
 * clean session boundaries on account switch/reopen, and immediate leave beacons.
 */
export function useLivePresence({
  dbUser,
  currentView = 'Public Landing Page',
  currentSubpage = 'Overview',
  walletAddress = '',
  eventHint = null,
  onEventHintConsumed = null
}) {
  const sessionIdRef = useRef(null);
  if (!sessionIdRef.current) {
    sessionIdRef.current = getLiveSessionId();
  }
  const hasLeftRef = useRef(false);
  const lastActivityMsRef = useRef(Date.now());
  const lastStatusSentRef = useRef('active');

  const latestRef = useRef({
    dbUser,
    currentView,
    currentSubpage,
    walletAddress
  });

  latestRef.current = {
    dbUser,
    currentView,
    currentSubpage,
    walletAddress
  };

  const computeTabState = (overrideTabState = null) => {
    if (overrideTabState) return overrideTabState;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return 'idle';
    }
    if (Date.now() - lastActivityMsRef.current >= USER_IDLE_AFTER_MS) {
      return 'idle';
    }
    return 'active';
  };

  const sendHeartbeat = async (overrideEventType = null, overrideTabState = null) => {
    if (typeof window === 'undefined' || hasLeftRef.current) return;
    const sessionId = sessionIdRef.current;
    const { currentView: view, currentSubpage: subpage, walletAddress: wallet, dbUser: user } = latestRef.current;
    const token = user ? (localStorage.getItem('bbdrts_token') || localStorage.getItem('token') || '') : '';
    const tabState = computeTabState(overrideTabState);
    lastStatusSentRef.current = tabState;
    const path = `${window.location.pathname || '/'}${window.location.hash || ''}`.slice(0, 240);

    try {
      await fetch(`${API_URL}/api/presence/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          sessionId,
          currentView: view,
          currentSubpage: subpage,
          currentPath: path,
          walletAddress: wallet || null,
          tabState,
          eventType: overrideEventType || null
        }),
        keepalive: true
      });
    } catch (_) {
      // Silently ignore transient network hiccups during background presence ping
    }
  };

  // Trigger immediate heartbeat whenever identity, screen, subpage, wallet, or auth event changes
  useEffect(() => {
    lastActivityMsRef.current = Date.now();
    const hint = eventHint;
    sendHeartbeat(hint);
    if (hint && typeof onEventHintConsumed === 'function') {
      onEventHintConsumed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    dbUser?.id,
    dbUser?.email,
    dbUser?.role,
    dbUser?.name,
    currentView,
    currentSubpage,
    walletAddress,
    eventHint
  ]);

  // Real user interaction tracker + periodic heartbeat + visibility + clean disconnect beacon
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let activityThrottleMs = 0;
    const markUserActive = () => {
      const now = Date.now();
      if (now - activityThrottleMs < 1500) return;
      activityThrottleMs = now;
      const wasIdle = lastStatusSentRef.current === 'idle';
      lastActivityMsRef.current = now;
      if (wasIdle && document.visibilityState === 'visible') {
        sendHeartbeat(null, 'active');
      }
    };

    const intervalId = window.setInterval(() => {
      sendHeartbeat();
    }, 45000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        hasLeftRef.current = false;
        lastActivityMsRef.current = Date.now();
        sendHeartbeat(null, 'active');
      } else {
        sendHeartbeat(null, 'idle');
      }
    };

    const handlePageShow = () => {
      hasLeftRef.current = false;
      lastActivityMsRef.current = Date.now();
      sendHeartbeat(null, 'active');
    };

    const handleLeave = () => {
      if (hasLeftRef.current) return;
      hasLeftRef.current = true;
      const payload = JSON.stringify({ sessionId: sessionIdRef.current });
      const url = `${API_URL}/api/presence/leave`;
      try {
        if (navigator.sendBeacon) {
          const blob = new Blob([payload], { type: 'text/plain;charset=UTF-8' });
          if (navigator.sendBeacon(url, blob)) return;
        }
      } catch (_) {}
      try {
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          body: payload,
          keepalive: true
        }).catch(() => {});
      } catch (_) {}
    };

    const activityEvents = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    activityEvents.forEach((evt) => window.addEventListener(evt, markUserActive, { passive: true }));
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('pagehide', handleLeave);
    window.addEventListener('beforeunload', handleLeave);

    return () => {
      window.clearInterval(intervalId);
      activityEvents.forEach((evt) => window.removeEventListener(evt, markUserActive));
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('pagehide', handleLeave);
      window.removeEventListener('beforeunload', handleLeave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return sessionIdRef.current;
}
