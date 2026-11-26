import { useState, useEffect } from 'react';
import OtpPinBoxes from '../components/OtpPinBoxes';
import { API_URL, apiFetch } from '../config';
import './AuthView.css';
import './AdminPortalView.css';

export default function AdminPortalView({
  onLoginSuccess,
  onBack,
  theme = 'dark',
  onToggleTheme,
  currentUser = null
}) {
  const [viewMode, setViewMode] = useState('login'); // 'login' | '2fa' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 2FA state
  const [twoFactorTempToken, setTwoFactorTempToken] = useState('');
  const [twoFactorEmail, setTwoFactorEmail] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorRecoveryCode, setTwoFactorRecoveryCode] = useState('');
  const [twoFactorUseBackup, setTwoFactorUseBackup] = useState(false);
  const [twoFactorTrustDevice, setTwoFactorTrustDevice] = useState(false);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotDevUrl, setForgotDevUrl] = useState('');

  // Live stats matching AuthView brand panel
  const [stats, setStats] = useState({ donors: '--', orgs: '--', campaigns: '--' });

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/api/public-stats`)
      .then(async (res) => {
        const text = await res.text();
        try { return JSON.parse(text); } catch { return null; }
      })
      .then((data) => {
        if (!active || !data || typeof data !== 'object') return;
        setStats({
          donors: String(data.donors ?? '0'),
          orgs: String(data.orgs ?? '0'),
          campaigns: String(data.campaigns ?? '0')
        });
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const parseApiResponse = async (response) => {
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      if (text && (text.includes('<!DOCTYPE') || text.includes('<html'))) {
        throw new Error('Backend server is unreachable. Please verify the API service is running.');
      }
      throw new Error('Invalid response received from server.');
    }
    if (!response.ok) {
      throw new Error(data?.error || 'Authentication failed.');
    }
    return data;
  };

  const finalizeAdminLogin = async (data) => {
    if (!data?.token || !data?.user || String(data.user.role).toLowerCase() !== 'admin') {
      throw new Error('Access denied. Administrator credentials are required for this portal.');
    }
    localStorage.setItem('bbdrts_token', data.token);
    localStorage.setItem('bbdrts_role', 'admin');
    localStorage.removeItem('bbdrts_tour_force_launch');
    localStorage.removeItem('bbdrts_is_new_registration');
    localStorage.removeItem('bbdrts_needs_onboarding');
    await new Promise((r) => setTimeout(r, 320));
    onLoginSuccess?.(data.user, data.token);
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError('Please enter both administrator email and password.');
      return;
    }

    setLoading(true);
    try {
      const trustKeys = [
        `bbdrts_trusted_device_admin_${cleanEmail}`,
        `bbdrts_trusted_device_${cleanEmail}`
      ];
      const trustedDeviceToken = trustKeys.map((k) => localStorage.getItem(k)).find(Boolean) || null;

      const response = await apiFetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          role: 'admin',
          trustedDeviceToken
        })
      });
      const data = await parseApiResponse(response);

      if (data.requires2FA) {
        if (trustedDeviceToken) {
          trustKeys.forEach((k) => localStorage.removeItem(k));
        }
        setTwoFactorTempToken(data.tempToken);
        setTwoFactorEmail(data.email || cleanEmail);
        setTwoFactorCode('');
        setTwoFactorRecoveryCode('');
        setTwoFactorUseBackup(false);
        setTwoFactorTrustDevice(false);
        setViewMode('2fa');
        return;
      }

      await finalizeAdminLogin(data);
    } catch (err) {
      setError(err.message || 'Unable to authenticate administrator credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e, directCode = null) => {
    if (e?.preventDefault) e.preventDefault();
    setError('');

    const effectiveCode = (typeof directCode === 'string' ? directCode : twoFactorCode).replace(/\D/g, '');
    if (!twoFactorUseBackup && effectiveCode.length !== 6) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    if (twoFactorUseBackup && twoFactorRecoveryCode.trim().length < 8) {
      setError('Enter a valid backup recovery code.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        tempToken: twoFactorTempToken,
        trustDevice: twoFactorTrustDevice,
        ...(twoFactorUseBackup
          ? { recoveryCode: twoFactorRecoveryCode.trim() }
          : { code: effectiveCode })
      };

      const response = await apiFetch(`${API_URL}/api/auth/login-2fa-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await parseApiResponse(response);

      if (data.trustedDeviceToken) {
        const resolvedEmail = String(data.user?.email || twoFactorEmail || email).trim().toLowerCase();
        localStorage.setItem(`bbdrts_trusted_device_admin_${resolvedEmail}`, data.trustedDeviceToken);
      }

      await finalizeAdminLogin(data);
    } catch (err) {
      setError(err.message || 'Two-factor verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const cleanEmail = forgotEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter your registered administrator email address.');
      return;
    }

    setLoading(true);
    try {
      const response = await apiFetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail })
      });
      const data = await parseApiResponse(response);
      setForgotDevUrl(data.resetUrl || data.devResetUrl || '');
      setForgotSent(true);
    } catch (err) {
      setError(err.message || 'Unable to dispatch password reset link.');
    } finally {
      setLoading(false);
    }
  };

  const isNonAdminSession = Boolean(currentUser && String(currentUser.role).toLowerCase() !== 'admin');

  return (
    <div className="login-split-container">
      {/* Exact same ambient mesh backdrop as AuthView */}
      <div className="login-ambient-mesh"></div>

      {/* Exact same minimal top navigation controls as AuthView */}
      <div className="auth-topbar-controls">
        {onBack ? (
          <button
            type="button"
            className="auth-corner-pill"
            onClick={onBack}
            aria-label="Back to landing page"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            <span>Back to Home</span>
          </button>
        ) : <span />}

        <div className="auth-topbar-right">
          {onToggleTheme && (
            <button
              type="button"
              className="auth-corner-pill icon-only"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <span className="material-symbols-outlined">
                {theme === 'dark' ? 'light_mode' : 'dark_mode'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Exact same split glass card layout as AuthView */}
      <div className="login-form-side fade-in">
        <div className="login-glass-card">

          {/* ===== RIGHT PANEL: ADMIN SIGN IN / 2FA / RECOVERY ===== */}
          <div className="form-panel sign-in-panel">
            <div className="panel-inner">
              <div className="login-header-modern">
                <h2>
                  {viewMode === '2fa'
                    ? 'Two-Factor Check'
                    : viewMode === 'forgot'
                      ? 'Reset Admin Password'
                      : 'Admin Sign In'}
                </h2>
                <p className="login-header-subtitle">
                  {viewMode === '2fa'
                    ? `Enter the security code for ${twoFactorEmail}`
                    : viewMode === 'forgot'
                      ? 'Receive a 60-minute single-use password reset link'
                      : 'Log in to the BBDRTS Administrator Governance Console'}
                </p>
              </div>

              {isNonAdminSession && viewMode === 'login' && (
                <div className="admin-portal-inline-notice" role="status">
                  <span className="material-symbols-outlined">info</span>
                  <span>
                    Signed in as <strong>{currentUser.email || currentUser.name}</strong> ({currentUser.role}). Authenticate below to switch to Admin.
                  </span>
                </div>
              )}

              {error && (
                <div className="alert-modern error" style={{ marginBottom: '14px' }}>
                  <span className="material-symbols-outlined">warning</span>
                  <span>{error}</span>
                </div>
              )}

              {/* MODE 1: CREDENTIAL LOGIN */}
              {viewMode === 'login' && (
                <form className="modern-login-form" onSubmit={handleLoginSubmit}>
                  <div className="input-group-modern">
                    <label htmlFor="admin-login-email">ADMINISTRATOR EMAIL</label>
                    <div className="input-container">
                      <span className="material-symbols-outlined input-icon">mail</span>
                      <input
                        id="admin-login-email"
                        type="email"
                        placeholder="bbdrts@gmail.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="username"
                        autoFocus
                        required
                      />
                    </div>
                  </div>

                  <div className="input-group-modern">
                    <label htmlFor="admin-login-password">PASSWORD</label>
                    <div className="input-container">
                      <span className="material-symbols-outlined input-icon">lock</span>
                      <input
                        id="admin-login-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        required
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setShowPassword((prev) => !prev)}
                        tabIndex="-1"
                        aria-label="Toggle password visibility"
                      >
                        <span className="material-symbols-outlined">
                          {showPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="login-options">
                    <label className="custom-checkbox">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                      />
                      <span className="checkbox-mark"></span>
                      <span className="checkbox-label">Remember me</span>
                    </label>
                    <button
                      type="button"
                      className="link-modern-btn"
                      onClick={() => {
                        setError('');
                        setForgotEmail(email || 'bbdrts@gmail.com');
                        setForgotSent(false);
                        setForgotDevUrl('');
                        setViewMode('forgot');
                      }}
                    >
                      Forgot Password?
                    </button>
                  </div>

                  <button
                    type="submit"
                    className={`btn-modern-primary ${loading ? 'loading' : ''}`}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-before"></span>
                        <span>Authenticating...</span>
                      </>
                    ) : (
                      <>
                        <span>Log In to Admin Console</span>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_forward</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* MODE 2: TWO-FACTOR AUTHENTICATION */}
              {viewMode === '2fa' && (
                <form className="modern-login-form" onSubmit={handleVerify2FA}>
                  {!twoFactorUseBackup ? (
                    <div className="input-group-modern">
                      <label>6-DIGIT AUTHENTICATOR CODE</label>
                      <OtpPinBoxes
                        value={twoFactorCode}
                        onChange={setTwoFactorCode}
                        autoFocus={true}
                        onSubmit={(code) => handleVerify2FA(null, code)}
                      />
                    </div>
                  ) : (
                    <div className="input-group-modern">
                      <label htmlFor="admin-2fa-backup">BACKUP RECOVERY CODE</label>
                      <div className="input-container">
                        <span className="material-symbols-outlined input-icon">key</span>
                        <input
                          id="admin-2fa-backup"
                          type="text"
                          placeholder="XXXX-XXXX"
                          value={twoFactorRecoveryCode}
                          onChange={(e) => setTwoFactorRecoveryCode(e.target.value)}
                          autoFocus
                          required
                        />
                      </div>
                    </div>
                  )}

                  <div className="login-options">
                    <label className="custom-checkbox">
                      <input
                        type="checkbox"
                        checked={twoFactorTrustDevice}
                        onChange={(e) => setTwoFactorTrustDevice(e.target.checked)}
                      />
                      <span className="checkbox-mark"></span>
                      <span className="checkbox-label">Trust this device for 30 days</span>
                    </label>
                    <button
                      type="button"
                      className="link-modern-btn"
                      onClick={() => {
                        setError('');
                        setTwoFactorUseBackup((prev) => !prev);
                      }}
                    >
                      {twoFactorUseBackup ? 'Use App Code' : 'Use Backup Code'}
                    </button>
                  </div>

                  <button
                    type="submit"
                    className={`btn-modern-primary ${loading ? 'loading' : ''}`}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-before"></span>
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <span>Verify &amp; Log In</span>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>verified_user</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    className="btn-modern-secondary-opt"
                    onClick={() => {
                      setError('');
                      setViewMode('login');
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
                    <span>Back to Admin Sign In</span>
                  </button>
                </form>
              )}

              {/* MODE 3: FORGOT PASSWORD */}
              {viewMode === 'forgot' && (
                <form className="modern-login-form" onSubmit={handleForgotSubmit}>
                  {forgotSent ? (
                    <div className="otp-success-banner" style={{ marginBottom: '4px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>mark_email_read</span>
                      <span>
                        A 60-minute password reset link has been dispatched to <strong>{forgotEmail}</strong>.
                      </span>
                    </div>
                  ) : (
                    <div className="input-group-modern">
                      <label htmlFor="admin-forgot-email">REGISTERED ADMIN EMAIL</label>
                      <div className="input-container">
                        <span className="material-symbols-outlined input-icon">mail</span>
                        <input
                          id="admin-forgot-email"
                          type="email"
                          placeholder="bbdrts@gmail.com"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          autoFocus
                          required
                        />
                      </div>
                    </div>
                  )}

                  {forgotSent && forgotDevUrl && (
                    <a
                      href={forgotDevUrl}
                      className="btn-modern-secondary-opt"
                      style={{ textDecoration: 'none' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>open_in_new</span>
                      <span>Open Local Reset Link</span>
                    </a>
                  )}

                  {!forgotSent && (
                    <button
                      type="submit"
                      className={`btn-modern-primary ${loading ? 'loading' : ''}`}
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <span className="spinner-before"></span>
                          <span>Sending Reset Link...</span>
                        </>
                      ) : (
                        <>
                          <span>Send Password Reset Link</span>
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>send</span>
                        </>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn-modern-secondary-opt"
                    onClick={() => {
                      setError('');
                      setForgotSent(false);
                      setViewMode('login');
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
                    <span>Back to Admin Sign In</span>
                  </button>
                </form>
              )}

              <div className="login-divider"><span>SECURITY</span></div>

              <div className="login-footer-modern">
                <p className="switch-text admin-portal-audit-footer">
                  <span className="material-symbols-outlined">shield_lock</span>
                  <span>Restricted to authorized BBDRTS administrators. All attempts are audited.</span>
                </p>
              </div>
            </div>
          </div>

          {/* ===== LEFT BRAND PANEL (IDENTICAL VISUAL SYSTEM TO AUTHVIEW) ===== */}
          <div className="sliding-overlay-container">
            <div className="login-brand-side">
              {/* Top Brand Identity & Live Metrics */}
              <div className="brand-top-section">
                <div className="brand-header-block">
                  <div className="brand-logo-wrap">
                    <img src="/logo.png" alt="BBDRTS Logo" className="brand-logo-img" />
                  </div>
                  <div className="brand-text-wrap">
                    <div className="brand-title-row">
                      <h1 className="brand-title">BBDRTS</h1>
                      <span className="brand-protocol-pill">ADMIN</span>
                    </div>
                    <p className="brand-tagline">
                      Blockchain-Based Donation &amp; Relief Transparency System
                    </p>
                  </div>
                </div>

                <div className="brand-metrics-glass-card">
                  <div className="metric-col">
                    <span className="metric-val">{stats.donors}</span>
                    <span className="metric-lbl">TOTAL DONORS</span>
                  </div>
                  <div className="metric-divider"></div>
                  <div className="metric-col">
                    <span className="metric-val">{stats.orgs}</span>
                    <span className="metric-lbl">ACCREDITED NGOS</span>
                  </div>
                  <div className="metric-divider"></div>
                  <div className="metric-col">
                    <span className="metric-val">{stats.campaigns}</span>
                    <span className="metric-lbl">TOTAL CAMPAIGNS</span>
                  </div>
                </div>
              </div>

              {/* Centerpiece Governance Statement (same concise weight as AuthView) */}
              <div className="brand-welcome-block">
                <div className="brand-welcome-eyebrow">
                  <span className="material-symbols-outlined">admin_panel_settings</span>
                  <span>GOVERNANCE PORTAL</span>
                </div>
                <h2 className="brand-welcome-headline">
                  Platform governance, audited.
                </h2>
                <p className="brand-welcome-copy">
                  Review NGO KYC, resolve disputes, and monitor on-chain records.
                </p>
              </div>

              {/* Bottom Status Pill & Governance Badges */}
              <div className="brand-footer-block">
                <div className="brand-live-pill">
                  <span className="pulse-dot"></span>
                  <span>Sepolia Network Live</span>
                  <span className="pill-dot-sep">•</span>
                  <span className="pill-subtext">Governance Console</span>
                </div>

                <div className="brand-trust-labels">
                  <div className="trust-badge-item">
                    <span className="material-symbols-outlined">verified_user</span>
                    <span>KYC Vetting</span>
                  </div>
                  <div className="trust-badge-item">
                    <span className="material-symbols-outlined">gavel</span>
                    <span>Dispute Audit</span>
                  </div>
                  <div className="trust-badge-item">
                    <span className="material-symbols-outlined">security</span>
                    <span>Audit Logs</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
