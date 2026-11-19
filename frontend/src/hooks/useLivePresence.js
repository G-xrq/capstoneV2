import { useEffect, useRef } from 'react';
import { API_URL } from '../config';

const SESSION_KEY = 'bbdrts_live_session_id';

export function getLiveSessionId() {
  if (typeof window === 'undefined') return 'sess_ssr';
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id || !/^[a-zA-Z0-9_-]{8,96}$/.test(id)) {
      const rand =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID().replace(/-/g, '')
          : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
      id = `sess_${rand}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch (_) {
    return `sess_${Date.now().toString(36)}`;
  }
}

/**
 * Real-time client presence heartbeat hook.
 * Tracks guest visitors, authenticated donors/NGOs/admins, guest-to-account
 * conversions, current active view/subpage, and clean disconnect beacons.
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

  const sendHeartbeat = async (overrideEventType = null, overrideTabState = null) => {
    if (typeof window === 'undefined' || hasLeftRef.current) return;
    const sessionId = sessionIdRef.current;
    const { currentView: view, currentSubpage: subpage, walletAddress: wallet, dbUser: user } = latestRef.current;
    const token = user ? (localStorage.getItem('bbdrts_token') || localStorage.getItem('token') || '') : '';
    const tabState = overrideTabState || (document.visibilityState === 'hidden' ? 'idle' : 'active');
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

  // Periodic heartbeat + visibility + clean disconnect beacon
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const intervalId = window.setInterval(() => {
      sendHeartbeat();
    }, 15000);

    const handleVisibility = () => {
      sendHeartbeat(null, document.visibilityState === 'hidden' ? 'idle' : 'active');
    };

    const handleLeave = () => {
      if (hasLeftRef.current) return;
      hasLeftRef.current = true;
      const payload = JSON.stringify({ sessionId: sessionIdRef.current });
      const url = `${API_URL}/api/presence/leave`;
      try {
        if (navigator.sendBeacon) {
          // Use CORS-safelisted text/plain so cross-origin beacons (Vercel -> Render) never trigger preflight rejection
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

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handleLeave);
    window.addEventListener('beforeunload', handleLeave);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handleLeave);
      window.removeEventListener('beforeunload', handleLeave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return sessionIdRef.current;
}
