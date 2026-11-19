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

  const formatLiveClock = (d) => {
    if (!d) return '';
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
    return `${dayName}, ${dateStr} • ${timeStr}`;
  };

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

      // Save admin credentials so admin is logged in immediately
      localStorage.setItem('bbdrts_token', 'direct_admin_access_token');
      localStorage.setItem('bbdrts_role', 'admin');
      localStorage.setItem('bbdrts_maintenance', JSON.stringify(data.config || { enabled: false }));
      
      window.dispatchEvent(new CustomEvent('bbdrts_maintenance_changed', { detail: data.config || { enabled: false } }));
      
      // Reload immediately to enter Admin view
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

  // If user is Admin and NOT previewing: Render the persistent top-right Admin Bypass indicator
  // Note: Suppressed inside admin console (activeView === 'admin' or admin role) so it doesn't collide with controls
  if (isAdmin) {
    if (dismissBypass || activeView === 'admin' || userRole === 'admin' || currentRole === 'admin' || dbUser?.role === 'admin') return null;
    return createPortal(
      <div className="bbdrts-maint-admin-bypass" role="status">
        <div className="bypass-content">
          <span className="bypass-pulse-dot" />
          <span className="material-symbols-outlined icon">shield</span>
          <div className="bypass-text">
            <strong>ADMIN BYPASS: Maintenance Active</strong>
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
    <div className="bbdrts-maint-modal-overlay" role="dialog" aria-modal="true">
      
      {/* ── Top Bar: Admin Access Button & Simulation Notice ── */}
      <div className="bbdrts-maint-top-utility-bar">
        {isPreviewMode ? (
          <div className="bbdrts-maint-preview-pill">
            <span className="material-symbols-outlined">visibility</span>
            <strong>ADMIN SIMULATION MODE</strong>
            <span>(Viewing as restricted non-admin)</span>
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

      <div className="bbdrts-maint-modal-card">
        {/* 4 Corner Industrial Screws (Hardware Rivet Style from Reference) */}
        <span className="maint-corner-rivet tl" aria-hidden="true" />
        <span className="maint-corner-rivet tr" aria-hidden="true" />
        <span className="maint-corner-rivet bl" aria-hidden="true" />
        <span className="maint-corner-rivet br" aria-hidden="true" />
        
        {/* Top Construction Icon with Smooth Ambient Glow (No Glitchy Scaling) */}
        <div className="bbdrts-maint-top-icon-wrap">
          <div className="bbdrts-maint-icon-box">
            <span className="material-symbols-outlined maint-floating-tool">construction</span>
          </div>
        </div>

        {/* Title & Status Badge */}
        <h2 className="bbdrts-maint-title">
          {maintenance.title || 'SYSTEM UNDER SCHEDULED MAINTENANCE'}
        </h2>
        
        <div className="bbdrts-maint-badge">
          <span className="material-symbols-outlined">warning</span>
          <span>SERVICE TEMPORARILY UNAVAILABLE</span>
        </div>

        {/* What's Happening Explanation */}
        <div className="bbdrts-maint-section">
          <div className="bbdrts-maint-section-header">
            <span className="material-symbols-outlined">info</span>
            <span>What&apos;s Happening?</span>
          </div>
          <p className="bbdrts-maint-desc">
            {maintenance.message || 'Our platform services are currently undergoing maintenance to enhance reliability and smart contract security. Essential relief tracking remains recorded on-chain.'}
          </p>
        </div>

        {/* Timeline Cards (Started vs Expected Completion) */}
        <div className="bbdrts-maint-grid-2">
          <div className="bbdrts-maint-time-card">
            <div className="card-icon-wrap">
              <span className="material-symbols-outlined">event_upcoming</span>
            </div>
            <span className="card-label">MAINTENANCE STARTED</span>
            <strong className="card-val">{maintenance.startTime || 'In Progress'}</strong>
          </div>

          <div className="bbdrts-maint-time-card highlight">
            <div className="card-icon-wrap">
              <span className="material-symbols-outlined">event_available</span>
            </div>
            <span className="card-label">EXPECTED COMPLETION</span>
            <strong className="card-val">{maintenance.endTime || 'Expected Shortly'}</strong>
          </div>
        </div>

        {/* Dynamic Live Countdown Banner */}
        {remainingInfo && (
          <div className={`bbdrts-maint-countdown-strip ${remainingInfo.isPast ? 'concluded' : ''}`}>
            <span className="material-symbols-outlined">
              {remainingInfo.isPast ? 'hourglass_bottom' : 'hourglass_top'}
            </span>
            <span className="countdown-label">
              {remainingInfo.isPast ? 'SCHEDULED WINDOW:' : 'ESTIMATED REMAINING:'}
            </span>
            <strong className="countdown-val">{remainingInfo.text}</strong>
          </div>
        )}

        {/* Vercel Clean SVG Humanitarian Infrastructure Graphic */}
        <div className="bbdrts-maint-graphic-wrap" aria-hidden="true">
          <svg className="maint-svg-graphic" viewBox="0 0 400 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <line x1="0" y1="90" x2="400" y2="90" stroke="#222222" strokeWidth="1" strokeDasharray="4 4" />
            <line x1="0" y1="50" x2="400" y2="50" stroke="#1c1c1c" strokeWidth="1" strokeDasharray="6 6" />
            
            <circle cx="200" cy="50" r="28" fill="#111111" stroke="#f59e0b" strokeWidth="1.5" />
            <circle cx="200" cy="50" r="20" fill="rgba(245, 158, 11, 0.08)" />
            <path d="M192 50 L198 56 L208 44" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

            <line x1="100" y1="50" x2="172" y2="50" stroke="#2c2c2c" strokeWidth="1.5" />
            <circle cx="90" cy="50" r="10" fill="#181818" stroke="#52525b" strokeWidth="1.5" />
            
            <line x1="228" y1="50" x2="300" y2="50" stroke="#2c2c2c" strokeWidth="1.5" />
            <circle cx="310" cy="50" r="10" fill="#181818" stroke="#52525b" strokeWidth="1.5" />
          </svg>
        </div>

        {/* Scope Note */}
        {!isFullPlatform && scopes.length > 0 && (
          <div className="bbdrts-maint-scope-note">
            <span className="label">RESTRICTED SECTORS:</span>
            <span className="tags">
              {scopes.map(s => (
                <span key={s} className="tag">{s.replace(/_/g, ' ')}</span>
              ))}
            </span>
          </div>
        )}

        {/* Steady, Glitch-Free Recheck Button */}
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
            <span>{manualRechecking ? 'Verifying Platform...' : 'Check Platform Status'}</span>
          </button>
        </div>

        {/* Support Contact Footer (From Reference) */}
        <div className="bbdrts-maint-support-strip">
          <div className="support-left">
            <span className="material-symbols-outlined">headset_mic</span>
            <span className="support-label">Need Help? Contact Operations Support</span>
          </div>
          <div className="support-right">
            {maintenance.contactPerson && (
              <span className="contact-item" title="Support Coordinator">
                <span className="material-symbols-outlined">badge</span>
                <span>{maintenance.contactPerson}</span>
              </span>
            )}
            {maintenance.contactEmail && (
              <a href={`mailto:${maintenance.contactEmail}`} className="contact-item" title="Support Email">
                <span className="material-symbols-outlined">mail</span>
                <span>{maintenance.contactEmail}</span>
              </a>
            )}
            {maintenance.contactPhone && (
              <a href={`tel:${maintenance.contactPhone}`} className="contact-item" title="Emergency Hotline">
                <span className="material-symbols-outlined">call</span>
                <span>{maintenance.contactPhone}</span>
              </a>
            )}
          </div>

          {/* Discreet Live Telemetry Timestamp */}
          <div className="bbdrts-maint-telemetry-status">
            <span className="live-clock-pulse-dot" />
            <span>Live telemetry • {liveClock.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, {liveClock.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} PHT</span>
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
                  <h3 className="dialog-title">Administrator Verification &amp; Unlock Gate</h3>
                  <p className="dialog-sub">
                    Emergency management console for platform operators.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="dialog-close-btn"
                onClick={() => setShowAdminGateModal(false)}
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
              
              {/* Option 1: Complete Emergency System Unlock */}
              <div className="admin-action-card unlock">
                <div className="action-card-text">
                  <div className="action-card-title-line">
                    <span className="material-symbols-outlined icon">lock_open</span>
                    <strong>1-Click Emergency Platform Unlock</strong>
                  </div>
                  <p>
                    Instantly deactivates maintenance mode across the entire system and restores full public access for all visitors, donors, and NGOs.
                  </p>
                </div>
                <button
                  type="button"
                  className="bbdrts-btn-emergency-unlock"
                  onClick={handleEmergencyUnlock}
                  disabled={unlockLoading}
                >
                  <span className="material-symbols-outlined">lock_open</span>
                  <span>{unlockLoading ? 'Restoring System...' : 'Unlock Platform Now'}</span>
                </button>
              </div>

              {/* Option 2: Direct Admin Access (Bypass without disabling maintenance) */}
              <div className="admin-action-card bypass">
                <div className="action-card-text">
                  <div className="action-card-title-line">
                    <span className="material-symbols-outlined icon">shield</span>
                    <strong>Direct Admin Access (Keep Maintenance Active)</strong>
                  </div>
                  <p>
                    Bypass the barrier and log in to the Administrator Console while keeping maintenance mode enabled for non-admins.
                  </p>
                </div>
                <button
                  type="button"
                  className="bbdrts-btn-direct-bypass"
                  onClick={handleDirectAdminBypass}
                >
                  <span className="material-symbols-outlined">login</span>
                  <span>Enter Admin Dashboard</span>
                </button>
              </div>

            </div>

            {/* Option 3: Manual Admin Login Form */}
            <div className="admin-dialog-manual-login">
              <span className="manual-login-divider">Or Sign In with Administrator Credentials</span>
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
