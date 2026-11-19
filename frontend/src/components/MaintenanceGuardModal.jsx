import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { API_URL, apiFetch } from '../config';
import './MaintenanceGuardModal.css';

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
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [manualRechecking, setManualRechecking] = useState(false);
  const [showAdminGateModal, setShowAdminGateModal] = useState(false);

  // Live ticking system clock state (ticks every 1000ms)
  const [liveClock, setLiveClock] = useState(() => new Date());

  useEffect(() => {
    const clockTimer = setInterval(() => {
      setLiveClock(new Date());
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  const getRemainingInfo = () => {
    if (!maintenance?.endTime) return null;
    const end = new Date(maintenance.endTime);
    if (isNaN(end.getTime())) return null;
    const diff = end.getTime() - liveClock.getTime();
    if (diff <= 0) {
      return { isPast: true, text: 'Scheduled window reached • Verification in progress' };
    }
    const totalSecs = Math.floor(diff / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    if (hours > 0) {
      return { isPast: false, text: `~${hours}h ${mins}m ${secs}s remaining` };
    }
    return { isPast: false, text: `~${mins}m ${secs}s remaining` };
  };

  const remainingInfo = getRemainingInfo();

  // Admin Login Form State inside Gate
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoginLoading, setAdminLoginLoading] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState('');
  const [unlockLoading, setUnlockLoading] = useState(false);

  // Status fetcher with clean separation between background polling and manual user click
  const fetchStatus = async (isManual = false) => {
    if (isManual) setManualRechecking(true);
    try {
      const res = await fetch(`${API_URL}/api/system/maintenance`);
      if (res.ok) {
        const data = await res.json();
        setMaintenance(data);
        try {
          localStorage.setItem('bbdrts_maintenance', JSON.stringify(data));
        } catch (_) {}
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

    // Listen for real-time local updates when Admin saves settings
    const handleMaintEvent = (e) => {
      if (e.detail) {
        setMaintenance(e.detail);
      } else {
        fetchStatus(false);
      }
    };
    window.addEventListener('bbdrts_maintenance_changed', handleMaintEvent);

    // Listen for preview requests from Admin Maintenance Panel
    const handlePreviewEvent = (e) => {
      if (e.detail?.open) {
        if (e.detail.config) setMaintenance(e.detail.config);
        setIsPreviewMode(true);
      } else {
        setIsPreviewMode(false);
      }
    };
    window.addEventListener('bbdrts_toggle_preview_maintenance', handlePreviewEvent);

    // Background polling runs silently WITHOUT triggering manual button spin or text flip
    const interval = setInterval(() => {
      fetchStatus(false);
    }, 4000);

    return () => {
      window.removeEventListener('bbdrts_maintenance_changed', handleMaintEvent);
      window.removeEventListener('bbdrts_toggle_preview_maintenance', handlePreviewEvent);
      clearInterval(interval);
    };
  }, []);

  // Emergency Platform Unlock Handler (Deactivates maintenance mode in DB and restores all access)
  const handleEmergencyUnlock = async () => {
    setUnlockLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/system/maintenance/emergency-unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to unlock platform.');

      localStorage.setItem('bbdrts_token', 'direct_admin_access_token');
      localStorage.setItem('bbdrts_role', 'admin');
      localStorage.setItem('bbdrts_maintenance', JSON.stringify(data.config || { enabled: false }));

      window.dispatchEvent(new CustomEvent('bbdrts_maintenance_changed', { detail: data.config || { enabled: false } }));

      window.location.reload();
    } catch (err) {
      setAdminLoginError('Emergency unlock failed: ' + err.message);
    } finally {
      setUnlockLoading(false);
    }
  };

  // Direct Admin Access Handler (Bypasses barrier into Admin Console without disabling maintenance)
  const handleDirectAdminBypass = () => {
    localStorage.setItem('bbdrts_token', 'direct_admin_access_token');
    localStorage.setItem('bbdrts_role', 'admin');
    window.location.reload();
  };

  // Standard Admin Login with Email / Password
  const handleAdminCredentialsLogin = async (e) => {
    e.preventDefault();
    setAdminLoginLoading(true);
    setAdminLoginError('');
    try {
      const res = await apiFetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail, password: adminPassword, role: 'admin' })
      });
      const data = await res.json();
      if (!res.ok || !data.token) {
        throw new Error(data.error || 'Invalid administrator credentials.');
      }

      localStorage.setItem('bbdrts_token', data.token);
      localStorage.setItem('bbdrts_role', 'admin');
      window.location.reload();
    } catch (err) {
      setAdminLoginError(err.message || 'Login failed.');
    } finally {
      setAdminLoginLoading(false);
    }
  };

  if (!maintenance || (!maintenance.enabled && !isPreviewMode)) return null;

  const currentRole = (userRole || dbUser?.role || 'donor').toLowerCase();
  const isAdmin = (currentRole === 'admin' || dbUser?.role === 'admin') && !isPreviewMode;

  const scopes = Array.isArray(maintenance.scope) ? maintenance.scope : [];
  const isFullPlatform = scopes.length === 0 || scopes.includes('FULL_PLATFORM');

  // Check if current user / view is restricted
  const isViewBlocked = isPreviewMode
    || isFullPlatform
    || (activeView === 'landing' && (scopes.includes('PUBLIC_LANDING') || isFullPlatform))
    || (activeView === 'auth' && (scopes.includes('PUBLIC_LANDING') || isFullPlatform))
    || (activeView === 'donor' && scopes.includes('DONOR_PORTAL'))
    || (activeView === 'ngo' && scopes.includes('NGO_PORTAL'))
    || (currentRole === 'donor' && scopes.includes('DONOR_PORTAL'))
    || ((currentRole === 'organization' || currentRole === 'ngo') && scopes.includes('NGO_PORTAL'));

  // If user is Admin and NOT previewing: Render the persistent bottom Admin Bypass indicator
  if (isAdmin) {
    if (dismissBypass || activeView === 'admin' || userRole === 'admin' || currentRole === 'admin' || dbUser?.role === 'admin') return null;
    return createPortal(
      <div className="bbdrts-maint-admin-bypass" role="status">
        <div className="bypass-content">
          <span className="bypass-pulse-dot" />
          <span className="material-symbols-outlined icon">shield</span>
          <div className="bypass-text">
            <strong>Admin Bypass: Maintenance Active</strong>
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

  // Non-Admin (or Admin in Preview Mode): If not impacted, don't show the fullscreen modal
  if (!isViewBlocked) return null;

  return createPortal(
    <div className="bbdrts-maint-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="bbdrts-maint-heading">
      <div className="bbdrts-maint-shell">

        {/* ── Top Utility Header Bar (Flows cleanly above card on all screens) ── */}
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
              onClick={() => setShowAdminGateModal(true)}
              title="Administrator Verification & Emergency Unlock Desk"
            >
              <span className="material-symbols-outlined">admin_panel_settings</span>
              <span>Administrator Access</span>
            </button>
          )}
        </div>

        {/* ── Main Vercel Geist Maintenance Surface ── */}
        <div className="bbdrts-maint-modal-card">

          {/* Hero Icon + Status Tag */}
          <div className="bbdrts-maint-hero">
            <div className="bbdrts-maint-icon-box" aria-hidden="true">
              <span className="material-symbols-outlined maint-floating-tool">construction</span>
            </div>

            <div className="bbdrts-maint-status-pill">
              <span className="bbdrts-maint-status-dot" aria-hidden="true" />
              <span>Scheduled Maintenance</span>
            </div>

            <h2 id="bbdrts-maint-heading" className="bbdrts-maint-title">
              {maintenance.title || 'System Under Scheduled Maintenance'}
            </h2>

            <p className="bbdrts-maint-desc">
              {maintenance.message || 'Our platform services are currently undergoing maintenance to improve reliability and smart contract security. Relief ledgers remain safe on-chain.'}
            </p>
          </div>

          {/* Unified Geist Bento Telemetry Box */}
          <div className="bbdrts-maint-bento">
            <div className="bbdrts-maint-grid-2">
              <div className="bbdrts-maint-time-cell">
                <div className="bbdrts-maint-cell-head">
                  <span className="material-symbols-outlined">schedule</span>
                  <span>Maintenance Started</span>
                </div>
                <strong className="bbdrts-maint-cell-val">
                  {maintenance.startTime || 'In Progress'}
                </strong>
              </div>

              <div className="bbdrts-maint-time-cell highlight">
                <div className="bbdrts-maint-cell-head">
                  <span className="material-symbols-outlined">event_available</span>
                  <span>Expected Completion</span>
                </div>
                <strong className="bbdrts-maint-cell-val">
                  {maintenance.endTime || 'Expected Shortly'}
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

            <div className="bbdrts-maint-integrity-strip">
              <span className="bbdrts-maint-node-chip">
                <span className="node-dot ok" />
                <span>Sepolia Ledger: Active</span>
              </span>
              <span className="bbdrts-maint-node-chip">
                <span className="node-dot ok" />
                <span>Escrow Vaults: Secured</span>
              </span>
              {!isFullPlatform && scopes.length > 0 ? (
                scopes.map((s) => (
                  <span key={s} className="bbdrts-maint-node-chip warn">
                    <span className="node-dot warn" />
                    <span>Paused: {s.replace(/_/g, ' ')}</span>
                  </span>
                ))
              ) : (
                <span className="bbdrts-maint-node-chip warn">
                  <span className="node-dot warn" />
                  <span>Portal Access: Paused</span>
                </span>
              )}
            </div>
          </div>

          {/* Primary Recheck Action */}
          <div className="bbdrts-maint-recheck-strip">
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

            {(maintenance.contactPerson || maintenance.contactEmail || maintenance.contactPhone) && (
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

      {/* ── Emergency Admin Unlock & Bypass Modal ── */}
      {showAdminGateModal && (
        <div
          className="bbdrts-maint-admin-dialog-overlay"
          onClick={() => setShowAdminGateModal(false)}
        >
          <div
            className="bbdrts-maint-admin-dialog-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-dialog-head">
              <div className="dialog-title-wrap">
                <div className="dialog-icon-box">
                  <span className="material-symbols-outlined">admin_panel_settings</span>
                </div>
                <div>
                  <h3 className="dialog-title">Administrator Verification</h3>
                  <p className="dialog-sub">
                    Emergency management console for platform operators.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="dialog-close-btn"
                onClick={() => setShowAdminGateModal(false)}
                aria-label="Close"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {adminLoginError && (
              <div className="admin-dialog-error">
                <span className="material-symbols-outlined">error</span>
                <span>{adminLoginError}</span>
              </div>
            )}

            {/* Quick Actions (1-Click Instant Resolution) */}
            <div className="admin-dialog-actions-stack">
              <div className="admin-action-card unlock">
                <div className="action-card-text">
                  <div className="action-card-title-line">
                    <span className="material-symbols-outlined icon">lock_open</span>
                    <strong>1-Click Emergency Platform Unlock</strong>
                  </div>
                  <p>
                    Deactivates maintenance mode across the system and restores public access immediately.
                  </p>
                </div>
                <button
                  type="button"
                  className="bbdrts-btn-emergency-unlock"
                  onClick={handleEmergencyUnlock}
                  disabled={unlockLoading}
                >
                  <span className="material-symbols-outlined">lock_open</span>
                  <span>{unlockLoading ? 'Restoring...' : 'Unlock Platform'}</span>
                </button>
              </div>

              <div className="admin-action-card bypass">
                <div className="action-card-text">
                  <div className="action-card-title-line">
                    <span className="material-symbols-outlined icon">shield</span>
                    <strong>Direct Admin Access</strong>
                  </div>
                  <p>
                    Enter the Administrator Console while keeping maintenance active for non-admins.
                  </p>
                </div>
                <button
                  type="button"
                  className="bbdrts-btn-direct-bypass"
                  onClick={handleDirectAdminBypass}
                >
                  <span className="material-symbols-outlined">login</span>
                  <span>Enter Admin Console</span>
                </button>
              </div>
            </div>

            {/* Option 3: Manual Admin Login Form */}
            <div className="admin-dialog-manual-login">
              <span className="manual-login-divider">Or sign in with administrator credentials</span>
              <form onSubmit={handleAdminCredentialsLogin} className="admin-login-form">
                <div className="admin-input-group">
                  <label htmlFor="gate-admin-email">Admin Email</label>
                  <input
                    id="gate-admin-email"
                    type="email"
                    placeholder="admin@bbdrts.gov.ph"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="admin-input-group">
                  <label htmlFor="gate-admin-pass">Password</label>
                  <input
                    id="gate-admin-pass"
                    type="password"
                    placeholder="••••••••••••"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="bbdrts-btn-gate-login"
                  disabled={adminLoginLoading}
                >
                  <span className="material-symbols-outlined">vpn_key</span>
                  <span>{adminLoginLoading ? 'Verifying...' : 'Authenticate & Enter'}</span>
                </button>
              </form>
            </div>

          </div>
        </div>
      )}

    </div>,
    document.body
  );
}
