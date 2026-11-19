import { useState, useEffect } from 'react';
import { API_URL } from '../config';
import './GlobalBroadcastBanner.css';

export default function GlobalBroadcastBanner({ userRole = 'donor' }) {
  const [announcements, setAnnouncements] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return sessionStorage.getItem('bbdrts_broadcast_collapsed') === 'true';
    } catch (_) {
      return false;
    }
  });
  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('bbdrts_dismissed_announcements') || '[]');
    } catch (_) {
      return [];
    }
  });

  const fetchActiveAnnouncements = async () => {
    try {
      const res = await fetch(`${API_URL}/api/announcements/active?role=${userRole || 'ALL'}`);
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.warn('Could not load broadcast announcements:', err.message);
    }
  };

  useEffect(() => {
    fetchActiveAnnouncements();
    // Poll every 60s for new high-priority broadcasts
    const timer = setInterval(fetchActiveAnnouncements, 60000);
    return () => clearInterval(timer);
  }, [userRole]);

  // Active visible announcements (excluding dismissed)
  const visibleAnnouncements = announcements.filter(a => !dismissedIds.includes(a.id));
  const current = visibleAnnouncements[currentIndex] || visibleAnnouncements[0] || null;

  // Auto-rotate between multiple active announcements over time (every 24 seconds, pause on hover)
  useEffect(() => {
    if (visibleAnnouncements.length <= 1 || isPaused || isCollapsed) return;
    const rotateInterval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % visibleAnnouncements.length);
    }, 24000);
    return () => clearInterval(rotateInterval);
  }, [visibleAnnouncements.length, isPaused, isCollapsed]);

  // Synchronize broadcast status with Header so it can display a clean Show Announcement pill when hidden
  useEffect(() => {
    if (visibleAnnouncements.length === 0 || !current) {
      window.dispatchEvent(new CustomEvent('bbdrts_broadcast_status', {
        detail: { isCollapsed: false, activeAnnouncement: null }
      }));
      return;
    }

    window.dispatchEvent(new CustomEvent('bbdrts_broadcast_status', {
      detail: { isCollapsed: Boolean(isCollapsed), activeAnnouncement: current }
    }));
  }, [isCollapsed, current, visibleAnnouncements.length]);

  // Global listener to expand / collapse from Header
  useEffect(() => {
    const handleToggle = (e) => {
      const targetState = e?.detail?.collapsed !== undefined ? Boolean(e.detail.collapsed) : false;
      setIsCollapsed(targetState);
      try {
        sessionStorage.setItem('bbdrts_broadcast_collapsed', String(targetState));
      } catch (_) {}
    };
    window.addEventListener('bbdrts_toggle_broadcast', handleToggle);
    return () => window.removeEventListener('bbdrts_toggle_broadcast', handleToggle);
  }, []);

  if (visibleAnnouncements.length === 0 || !current) return null;

  const toggleCollapse = (collapsed) => {
    setIsCollapsed(collapsed);
    try {
      sessionStorage.setItem('bbdrts_broadcast_collapsed', String(collapsed));
    } catch (_) {}
  };

  const handleDismiss = (id) => {
    const updated = [...dismissedIds, id];
    setDismissedIds(updated);
    try {
      sessionStorage.setItem('bbdrts_dismissed_announcements', JSON.stringify(updated));
    } catch (_) {}
    if (currentIndex >= visibleAnnouncements.length - 1) {
      setCurrentIndex(Math.max(0, visibleAnnouncements.length - 2));
    }
  };

  // When hidden, take up strictly 0 vertical space above Header (Header will house the Show Announcement pill)
  if (isCollapsed) {
    return null;
  }

  const severityClass = current.severity ? current.severity.toLowerCase() : 'general';

  const severityIcon = current.severity === 'EMERGENCY'
    ? 'warning'
    : (current.severity === 'OPERATIONAL' ? 'info' : 'podcasts');

  const severityLabel = current.severity === 'EMERGENCY'
    ? 'EMERGENCY ALERT'
    : (current.severity === 'OPERATIONAL' ? 'OPERATIONAL NOTICE' : 'PLATFORM ADVISORY');

  return (
    <div
      className={`bbdrts-broadcast-banner severity-${severityClass}`}
      role="alert"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="bbdrts-broadcast-inner">
        <div className="bbdrts-broadcast-left">
          <div className="bbdrts-broadcast-tag">
            <span className="bbdrts-live-beacon" />
            <span className="material-symbols-outlined icon">{severityIcon}</span>
            <span>{severityLabel}</span>
          </div>

          <div className="bbdrts-broadcast-content" title={`${current.title} • ${current.message}`}>
            <div className="bbdrts-broadcast-ticker-track">
              <div className="bbdrts-ticker-item">
                <strong className="bbdrts-broadcast-title">{current.title}</strong>
                <span className="bbdrts-broadcast-divider">•</span>
                <span className="bbdrts-broadcast-msg">{current.message}</span>
              </div>
              <div className="bbdrts-ticker-item" aria-hidden="true">
                <strong className="bbdrts-broadcast-title">{current.title}</strong>
                <span className="bbdrts-broadcast-divider">•</span>
                <span className="bbdrts-broadcast-msg">{current.message}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bbdrts-broadcast-right">
          {visibleAnnouncements.length > 1 && (
            <div className="bbdrts-broadcast-pagination">
              <button
                type="button"
                className="bbdrts-broadcast-nav-btn"
                onClick={() => setCurrentIndex(prev => (prev - 1 + visibleAnnouncements.length) % visibleAnnouncements.length)}
                aria-label="Previous announcement"
              >
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <span className="bbdrts-broadcast-page-indicator">
                {currentIndex + 1} / {visibleAnnouncements.length}
              </span>
              <button
                type="button"
                className="bbdrts-broadcast-nav-btn"
                onClick={() => setCurrentIndex(prev => (prev + 1) % visibleAnnouncements.length)}
                aria-label="Next announcement"
              >
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          )}

          {/* Hide/Minimize Toggle (Preserves announcement for re-opening anytime from Header pill) */}
          <button
            type="button"
            className="bbdrts-broadcast-hide-btn"
            onClick={() => toggleCollapse(true)}
            title="Hide announcement banner (can re-open anytime from Header)"
            aria-label="Hide announcement"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>visibility_off</span>
            <span>Hide</span>
          </button>

          {/* Dismiss from Session */}
          <button
            type="button"
            className="bbdrts-broadcast-dismiss-btn"
            onClick={() => handleDismiss(current.id)}
            title="Close and dismiss from queue"
            aria-label="Dismiss notification"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>close</span>
          </button>
        </div>
      </div>
    </div>
  );
}
