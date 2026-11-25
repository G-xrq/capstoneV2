import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { API_URL } from '../config';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { PRE_MAINT_FREEZE_MS } from '../utils/maintenanceWindow';
import './MaintenanceGuardModal.css';

function parseTimeMs(isoVal, displayVal) {
  for (const v of [isoVal, displayVal]) {
    if (!v || typeof v !== 'string' || !v.trim()) continue;
    const ms = Date.parse(v.trim());
    if (!isNaN(ms)) return ms;
  }
  return null;
}

function formatCountdown(ms) {
  const totalSecs = Math.max(0, Math.ceil(ms / 1000));
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  return `${mins}m ${secs}s`;
}

export default function MaintenanceGuardModal({
  userRole = 'donor',
  activeView = 'landing',
  dbUser = null
}) {
  const [maintenance, setMaintenance] = useState(() => {
    try {
      const cached = localStorage.getItem('bbdrts_maintenance');
      return cached ? JSON.parse(cached) : null;
    } catch (_) {
      return null;
    }
  });

  const [dismissBypass, setDismissBypass] = useState(false);
  const [dismissUpcoming, setDismissUpcoming] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [manualRechecking, setManualRechecking] = useState(false);
  const [restoringAccess, setRestoringAccess] = useState(false);

  // Live ticking system clock state (ticks every 1000ms) + server clock skew compensation
  const [liveClock, setLiveClock] = useState(() => new Date());
  const clockOffsetRef = useRef(0);
  const wasActivelyBlockedRef = useRef(false);
  const reloadScheduledRef = useRef(false);
  const startTriggerFetchedRef = useRef(false);
  const endTriggerFetchedRef = useRef(false);

  useEffect(() => {
    const clockTimer = setInterval(() => {
      setLiveClock(new Date());
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  const triggerAutoRestoreReload = () => {
    if (reloadScheduledRef.current || isPreviewMode) return;
    reloadScheduledRef.current = true;
    setRestoringAccess(true);
    try {
      localStorage.removeItem('bbdrts_maintenance');
    } catch (_) {}
    setTimeout(() => {
      window.location.reload();
    }, 1200);
  };

  // Status fetcher with clean separation between background polling and manual user click
  const fetchStatus = async (isManual = false) => {
    if (isManual) setManualRechecking(true);
    try {
      const res = await fetch(`${API_URL}/api/system/maintenance?_t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.serverNow === 'number' && !isNaN(data.serverNow)) {
          clockOffsetRef.current = data.serverNow - Date.now();
        }
        setMaintenance(data);
        try {
          localStorage.setItem('bbdrts_maintenance', JSON.stringify(data));
          window.dispatchEvent(new CustomEvent('bbdrts_maintenance_sync', { detail: data }));
        } catch (_) {}

        // If user was actively viewing the live maintenance screen and server now says maintenance ended -> auto-refresh!
        const serverActive = Boolean(data.enabled && data.isActiveNow !== false && !data.isScheduled);
        if (wasActivelyBlockedRef.current && !serverActive && !isPreviewMode) {
          triggerAutoRestoreReload();
        }
      }
    } catch (err) {
      console.warn('Could not check system maintenance status:', err.message);
    } finally {
      if (isManual) {
        setTimeout(() => setManualRechecking(false), 600);
      }
    }
  };

  useEffect(() => {
    fetchStatus(false);

    const handleMaintEvent = (e) => {
      if (e.detail) {
        startTriggerFetchedRef.current = false;
        endTriggerFetchedRef.current = false;
        setDismissUpcoming(false);
        setMaintenance(e.detail);
      } else {
        fetchStatus(false);
      }
    };
    window.addEventListener('bbdrts_maintenance_changed', handleMaintEvent);

    const handlePreviewEvent = (e) => {
      if (e.detail?.open) {
        if (e.detail.config) setMaintenance(e.detail.config);
        setIsPreviewMode(true);
      } else {
        setIsPreviewMode(false);
      }
    };
    window.addEventListener('bbdrts_toggle_preview_maintenance', handlePreviewEvent);

    const interval = setInterval(() => {
      fetchStatus(false);
    }, 10000);

    return () => {
      window.removeEventListener('bbdrts_maintenance_changed', handleMaintEvent);
      window.removeEventListener('bbdrts_toggle_preview_maintenance', handlePreviewEvent);
      clearInterval(interval);
    };
  }, []);

  useRealtimeSync(
    ['maintenance'],
    () => fetchStatus(false),
    { debounceMs: 120 }
  );

  // 1-Tap Direct Admin Access Handler (Bypasses barrier directly into Admin Console)
  const handleDirectAdminBypass = () => {
    localStorage.setItem('bbdrts_token', 'direct_admin_access_token');
    localStorage.setItem('bbdrts_role', 'admin');
    window.location.reload();
  };

  const nowMs = liveClock.getTime() + clockOffsetRef.current;
  const startMs = parseTimeMs(maintenance?.startTimeIso, maintenance?.startTime);
  const endMs = parseTimeMs(maintenance?.endTimeIso, maintenance?.endTime);

  const isEnabled = Boolean(maintenance?.enabled);
  const autoDeactivate = maintenance?.autoDeactivate !== false;
  const isEndReached = Boolean(isEnabled && autoDeactivate && endMs && nowMs >= endMs);
  const isScheduledFuture = Boolean(isEnabled && !isEndReached && startMs && nowMs < startMs);
  const startsInMs = isScheduledFuture && startMs ? Math.max(0, startMs - nowMs) : null;
  const isPreFreeze = Boolean(isScheduledFuture && startsInMs !== null && startsInMs <= PRE_MAINT_FREEZE_MS);
  const isActiveNow = Boolean(isEnabled && !isEndReached && (!startMs || nowMs >= startMs));

  const currentRole = (userRole || dbUser?.role || 'donor').toLowerCase();
  const isAdmin = (currentRole === 'admin' || dbUser?.role === 'admin') && !isPreviewMode;
  const scopes = Array.isArray(maintenance?.scope) ? maintenance.scope : [];
  const isFullPlatform = scopes.length === 0 || scopes.includes('FULL_PLATFORM');

  const isViewTargeted =
    isPreviewMode
    || isFullPlatform
    || (activeView === 'landing' && (scopes.includes('PUBLIC_LANDING') || isFullPlatform))
    || (activeView === 'auth' && (scopes.includes('PUBLIC_LANDING') || isFullPlatform))
    || (activeView === 'donor' && scopes.includes('DONOR_PORTAL'))
    || (activeView === 'ngo' && scopes.includes('NGO_PORTAL'))
    || (currentRole === 'donor' && scopes.includes('DONOR_PORTAL'))
    || ((currentRole === 'organization' || currentRole === 'ngo') && scopes.includes('NGO_PORTAL'));

  // Keep the overlay continuously mounted on completion (prevents any flash of the underlying page before reload)
  const isRestoringNow = Boolean(
    restoringAccess || (!isAdmin && !isPreviewMode && wasActivelyBlockedRef.current && isEndReached)
  );

  const isFullscreenVisible = Boolean(
    !isAdmin &&
    (isRestoringNow || isPreviewMode || (isActiveNow && isViewTargeted))
  );

  // Track whether this visitor has actually been placed on the live maintenance screen
  useEffect(() => {
    if (isActiveNow && isViewTargeted && !isAdmin && !isPreviewMode) {
      wasActivelyBlockedRef.current = true;
    }
  }, [isActiveNow, isViewTargeted, isAdmin, isPreviewMode]);

  // Exact-second Schedule Start & Completion triggers
  useEffect(() => {
    if (!maintenance?.enabled || isPreviewMode) return;

    // 1. When scheduled Effective From arrives -> sync immediately with backend
    if (startMs && nowMs >= startMs && !startTriggerFetchedRef.current && maintenance.isScheduled) {
      startTriggerFetchedRef.current = true;
      fetchStatus(false);
    }

    // 2. When Expected Completion Time arrives & autoDeactivate is enabled -> stay on restoring screen & reload seamlessly
    if (autoDeactivate && endMs && nowMs >= endMs && !endTriggerFetchedRef.current) {
      endTriggerFetchedRef.current = true;
      if (wasActivelyBlockedRef.current && !isAdmin) {
        setRestoringAccess(true);
        fetchStatus(false);
        triggerAutoRestoreReload();
      } else {
        fetchStatus(false);
      }
    }
  }, [nowMs, startMs, endMs, autoDeactivate, maintenance?.enabled, maintenance?.isScheduled, isAdmin, isPreviewMode]);

  // Lock background html/body scroll whenever the fullscreen maintenance screen is visible
  useEffect(() => {
    if (!isFullscreenVisible) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, [isFullscreenVisible]);

  const remainingInfo = (() => {
    if (!endMs) return null;
    const diff = endMs - nowMs;
    if (diff <= 0) {
      return {
        isPast: true,
        text: autoDeactivate ? 'Completion reached • Restoring access…' : 'Window reached • Verifying'
      };
    }
    return { isPast: false, text: `${formatCountdown(diff)} remaining` };
  })();

  if (!maintenance && !isPreviewMode && !restoringAccess) return null;

  // Non-blocking Upcoming Maintenance Countdown Banner (upgrades to non-dismissible Pre-Maintenance Freeze in final 60s)
  if (!isAdmin && !isPreviewMode && !isRestoringNow && isScheduledFuture && isViewTargeted) {
    if (dismissUpcoming && !isPreFreeze) return null;
    const startsInText = formatCountdown(startMs - nowMs);
    return (
      <div className={`bbdrts-maint-upcoming-bar ${isPreFreeze ? 'is-freezing' : ''}`} role="status" aria-live="polite">
        <div className="upcoming-bar-inner">
          <div className="upcoming-bar-left">
            <span className="upcoming-pulse-dot" aria-hidden="true" />
            <span className="material-symbols-outlined upcoming-ico">
              {isPreFreeze ? 'pause_circle' : 'schedule'}
            </span>
            <span className="upcoming-copy">
              <strong>
                {isPreFreeze
                  ? `Maintenance starting in ${startsInText}`
                  : `Scheduled Maintenance in ${startsInText}`}
              </strong>
              <span className="upcoming-sep">·</span>
              {isPreFreeze ? (
                <span>Donations, disbursements &amp; campaign launches are paused to prevent interrupted transactions</span>
              ) : (
                <>
                  <span>
                    Window: {maintenance.startTime || 'Soon'}
                    {maintenance.endTime ? ` – ${maintenance.endTime}` : ''}
                  </span>
                  <span className="upcoming-sep">·</span>
                  <span>Please finish active forms soon</span>
                </>
              )}
            </span>
          </div>
          {!isPreFreeze && (
            <button
              type="button"
              className="upcoming-close-btn"
              onClick={() => setDismissUpcoming(true)}
              aria-label="Dismiss upcoming maintenance notice"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>close</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // If user is Admin and NOT previewing: Render persistent Admin Bypass banner (only outside admin dashboard)
  if (isAdmin && (isActiveNow || isScheduledFuture)) {
    if (dismissBypass || activeView === 'admin' || userRole === 'admin' || currentRole === 'admin' || dbUser?.role === 'admin') return null;
    return createPortal(
      <div className="bbdrts-maint-admin-bypass" role="status">
        <div className="bypass-content">
          <span className="bypass-pulse-dot" />
          <span className="material-symbols-outlined icon">shield</span>
          <div className="bypass-text">
            <strong>
              {isScheduledFuture
                ? `Admin Notice: Maintenance Scheduled (in ${formatCountdown(startMs - nowMs)})`
                : 'Admin Bypass: Maintenance Active'}
            </strong>
            <span className="scope-tag">
              {isFullPlatform ? 'Full System Lockdown' : (scopes.join(', ') || 'Custom')}
            </span>
          </div>
        </div>

        <div className="bypass-actions">
          <button
            type="button"
            className="bbdrts-btn-sim-preview"
            onClick={() => setIsPreviewMode(true)}
            title="Preview how non-admin visitors and donors see the maintenance screen"
          >
            <span className="material-symbols-outlined">visibility</span>
            <span>Preview Screen</span>
          </button>
          <button
            type="button"
            className="bypass-close"
            onClick={() => setDismissBypass(true)}
            title="Dismiss admin banner"
            aria-label="Dismiss admin banner"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      </div>,
      document.body
    );
  }

  if (!isFullscreenVisible) return null;

  return createPortal(
    <div className="bbdrts-maint-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="bbdrts-maint-heading">
      <div className="bbdrts-maint-shell">

        {/* ── Top Utility Header Bar ── */}
        <div className="bbdrts-maint-top-utility-bar">
          <div className="bbdrts-maint-brand-pill">
            <img src="/logo.png" alt="BBDRTS" className="bbdrts-maint-brand-logo" />
            <span>BBDRTS</span>
            <span className="bbdrts-maint-brand-divider" aria-hidden="true">/</span>
            <span className="bbdrts-maint-brand-sub">Status</span>
          </div>

          {isPreviewMode ? (
            <div className="bbdrts-maint-preview-pill">
              <span className="bbdrts-maint-preview-status">
                <span className="material-symbols-outlined">visibility</span>
                <strong>Simulation</strong>
              </span>
              <button
                type="button"
                className="bbdrts-btn-exit-preview"
                onClick={() => setIsPreviewMode(false)}
              >
                <span className="material-symbols-outlined">close</span>
                <span>Exit Preview</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="bbdrts-btn-maint-top-admin"
              onClick={handleDirectAdminBypass}
              title="1-Tap Administrator Access"
            >
              <span className="material-symbols-outlined">admin_panel_settings</span>
              <span>Administrator Access</span>
            </button>
          )}
        </div>

        {/* ── Main Vercel Geist Maintenance Surface ── */}
        <div className={`bbdrts-maint-modal-card ${isRestoringNow ? 'is-restoring' : ''}`}>

          <div className="bbdrts-maint-hero">
            <div className={`bbdrts-maint-icon-box ${isRestoringNow ? 'is-restoring' : ''}`} aria-hidden="true">
              <span className="material-symbols-outlined maint-floating-tool">
                {isRestoringNow ? 'check_circle' : 'construction'}
              </span>
            </div>

            <div className={`bbdrts-maint-status-pill ${isRestoringNow ? 'is-restoring' : ''}`}>
              <span className="bbdrts-maint-status-dot" aria-hidden="true" />
              <span>{isRestoringNow ? 'Maintenance Complete' : 'Scheduled Maintenance'}</span>
            </div>

            <h2 id="bbdrts-maint-heading" className="bbdrts-maint-title">
              {isRestoringNow
                ? 'Platform Access Restored'
                : (maintenance?.title || 'System Under Scheduled Maintenance')}
            </h2>

            <p className="bbdrts-maint-desc">
              {isRestoringNow
                ? 'Scheduled maintenance has concluded. Refreshing your workspace automatically so you can continue using BBDRTS…'
                : (maintenance?.message || 'Our platform services are currently undergoing maintenance to improve reliability and smart contract security. Essential relief records remain safe on-chain.')}
            </p>
          </div>

          {/* Unified Geist Bento Telemetry Box */}
          {!isRestoringNow && (
            <div className="bbdrts-maint-bento">
              <div className="bbdrts-maint-grid-2">
                <div className="bbdrts-maint-time-cell">
                  <div className="bbdrts-maint-cell-head">
                    <span className="material-symbols-outlined">schedule</span>
                    <span>Maintenance Started</span>
                  </div>
                  <strong className="bbdrts-maint-cell-val">
                    {maintenance?.startTime || 'In Progress'}
                  </strong>
                </div>

                <div className="bbdrts-maint-time-cell highlight">
                  <div className="bbdrts-maint-cell-head">
                    <span className="material-symbols-outlined">event_available</span>
                    <span>Expected Completion</span>
                  </div>
                  <strong className="bbdrts-maint-cell-val">
                    {maintenance?.endTime || 'Expected Shortly'}
                  </strong>
                </div>
              </div>

              {remainingInfo && (
                <div className={`bbdrts-maint-countdown-strip ${remainingInfo.isPast ? 'concluded' : ''}`}>
                  <span className="bbdrts-maint-countdown-left">
                    <span className="material-symbols-outlined">
                      {remainingInfo.isPast ? 'hourglass_bottom' : 'hourglass_top'}
                    </span>
                    <span className="countdown-label">
                      {remainingInfo.isPast ? 'Scheduled window' : 'Estimated remaining'}
                    </span>
                  </span>
                  <strong className="countdown-val">{remainingInfo.text}</strong>
                </div>
              )}
            </div>
          )}

          {/* Primary Recheck Action */}
          <div className="bbdrts-maint-recheck-strip">
            {isRestoringNow ? (
              <div className="bbdrts-maint-restoring-pill">
                <span className="material-symbols-outlined spin" style={{ fontSize: '16px' }}>sync</span>
                <span>Refreshing platform automatically…</span>
              </div>
            ) : (
              <button
                type="button"
                className="bbdrts-btn-maint-recheck"
                onClick={() => fetchStatus(true)}
                disabled={manualRechecking}
              >
                <span className={`material-symbols-outlined ${manualRechecking ? 'spin' : ''}`}>
                  sync
                </span>
                <span>{manualRechecking ? 'Checking Status...' : 'Check Platform Status'}</span>
              </button>
            )}
          </div>

          {/* Support Footer & Live Timestamp */}
          <div className="bbdrts-maint-support-strip">
            <div className="bbdrts-maint-support-top">
              <div className="support-left">
                <span className="material-symbols-outlined">headset_mic</span>
                <span className="support-label">Operations Support</span>
              </div>

              <div className="bbdrts-maint-telemetry-status">
                <span className="live-clock-pulse-dot" />
                <span>
                  {liveClock.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • {liveClock.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} PHT
                </span>
              </div>
            </div>

            {(maintenance?.contactPerson || maintenance?.contactEmail || maintenance?.contactPhone) && (
              <div className="support-links-row">
                {maintenance.contactPerson && (
                  <span className="contact-item" title="Support Coordinator">
                    <span className="material-symbols-outlined">badge</span>
                    <span>{maintenance.contactPerson}</span>
                  </span>
                )}
                {maintenance.contactEmail && (
                  <a href={`mailto:${maintenance.contactEmail}`} className="contact-item interactive" title="Support Email">
                    <span className="material-symbols-outlined">mail</span>
                    <span>{maintenance.contactEmail}</span>
                  </a>
                )}
                {maintenance.contactPhone && (
                  <a href={`tel:${maintenance.contactPhone}`} className="contact-item interactive" title="Emergency Hotline">
                    <span className="material-symbols-outlined">call</span>
                    <span>{maintenance.contactPhone}</span>
                  </a>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>,
    document.body
  );
}
