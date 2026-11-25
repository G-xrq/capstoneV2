import { useState, useEffect } from 'react';
import OtpPinBoxes from '../components/OtpPinBoxes';
import { API_URL, apiFetch } from '../config';
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

  // Live governance telemetry
  const [telemetry, setTelemetry] = useState({
    online: null,
    donors: '--',
    orgs: '--',
    campaigns: '--'
  });

  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/api/public-stats`)
      .then(async (res) => {
        if (!res.ok) throw new Error('offline');
        return res.json();
      })
      .then((data) => {
        if (!active || !data) return;
        setTelemetry({
          online: true,
          donors: String(data.donors ?? 0),
          orgs: String(data.orgs ?? 0),
          campaigns: String(data.campaigns ?? 0)
        });
      })
      .catch(() => {
        if (!active) return;
        setTelemetry((prev) => ({ ...prev, online: false }));
      });
    return () => {
      active = false;
    };
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
      throw new Error('Unexpected response received from server.');
    }
    if (!response.ok) {
      throw new Error(data?.error || 'Authentication failed.');
    }
    return data;
  };

  const finalizeAdminLogin = async (data) => {
    if (!data?.token || !data?.user || String(data.user.role).toLowerCase() !== 'admin') {
      throw new Error('Access denied. Administrator privileges are required for this portal.');
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
      setError('Enter both administrator email and password.');
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
      setError('Enter your registered administrator email address.');
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
    <div className="admin-portal-shell" data-theme={theme}>
      <div className="admin-portal-grid-bg" aria-hidden="true" />

      {/* Top navigation bar */}
      <div className="admin-portal-topbar">
        <button
          type="button"
          className="admin-portal-pill"
          onClick={onBack}
          aria-label="Return to public home"
        >
          <span className="material-symbols-outlined">arrow_back</span>
          <span>Public Portal</span>
        </button>

        <div className="admin-portal-topbar-right">
          <div className={`admin-portal-status-pill ${telemetry.online === false ? 'is-offline' : ''}`}>
            <span className="admin-portal-status-dot" />
            <span>
              {telemetry.online === null
                ? 'Checking API...'
                : telemetry.online
                  ? 'Governance API Online'
                  : 'API Unreachable'}
            </span>
          </div>

          {onToggleTheme && (
            <button
              type="button"
              className="admin-portal-pill is-icon"
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

      {/* Main centered authentication card */}
      <main className="admin-portal-main">
        <div className="admin-portal-card">
          <div className="admin-portal-card-head">
            <div className="admin-portal-brand-row">
              <div className="admin-portal-shield">
                <span className="material-symbols-outlined">admin_panel_settings</span>
              </div>
              <div>
                <div className="admin-portal-eyebrow">BBDRTS GOVERNANCE</div>
                <h1 className="admin-portal-title">
                  {viewMode === '2fa'
                    ? 'Two-Factor Verification'
                    : viewMode === 'forgot'
                      ? 'Recover Admin Access'
                      : 'Administrator Portal'}
                </h1>
              </div>
            </div>
            <p className="admin-portal-subtitle">
              {viewMode === '2fa'
                ? `Confirm your identity for ${twoFactorEmail} to unlock the governance console.`
                : viewMode === 'forgot'
                  ? 'Request a 60-minute single-use password reset link for your administrator account.'
                  : 'Authorized access for NGO KYC vetting, ledger audits, dispute adjudication, and platform controls.'}
            </p>
          </div>

          {isNonAdminSession && viewMode === 'login' && (
            <div className="admin-portal-banner is-info" role="status">
              <span className="material-symbols-outlined">info</span>
              <span>
                Signed in as <strong>{currentUser.email || currentUser.name}</strong> ({currentUser.role}). Sign in with Administrator credentials below to switch sessions.
              </span>
            </div>
          )}

          {error && (
            <div className="admin-portal-banner is-error" role="alert">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* ── MODE 1: CREDENTIAL LOGIN ── */}
          {viewMode === 'login' && (
            <form className="admin-portal-form" onSubmit={handleLoginSubmit} noValidate>
              <div className="admin-portal-field">
                <label htmlFor="admin-email">ADMINISTRATOR EMAIL</label>
                <div className="admin-portal-input-wrap">
                  <span className="material-symbols-outlined admin-portal-input-icon">mail</span>
                  <input
                    id="admin-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@bbdrts.gov.ph"
                    autoComplete="username"
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div className="admin-portal-field">
                <div className="admin-portal-label-row">
                  <label htmlFor="admin-password">PASSWORD</label>
                  <button
                    type="button"
                    className="admin-portal-inline-link"
                    onClick={() => {
                      setError('');
                      setForgotEmail(email);
                      setForgotSent(false);
                      setForgotDevUrl('');
                      setViewMode('forgot');
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="admin-portal-input-wrap">
                  <span className="material-symbols-outlined admin-portal-input-icon">lock</span>
                  <input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter administrator password"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="admin-portal-eye-btn"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <span className="material-symbols-outlined">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="admin-portal-submit-btn"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="admin-portal-spinner" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Governance Console</span>
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* ── MODE 2: TWO-FACTOR AUTHENTICATION ── */}
          {viewMode === '2fa' && (
            <form className="admin-portal-form" onSubmit={handleVerify2FA}>
              {!twoFactorUseBackup ? (
                <div className="admin-portal-field">
                  <label>6-DIGIT AUTHENTICATOR CODE</label>
                  <OtpPinBoxes
                    value={twoFactorCode}
                    onChange={setTwoFactorCode}
                    autoFocus={true}
                    onSubmit={(code) => handleVerify2FA(null, code)}
                  />
                </div>
              ) : (
                <div className="admin-portal-field">
                  <label htmlFor="admin-backup-code">BACKUP RECOVERY CODE</label>
                  <div className="admin-portal-input-wrap">
                    <span className="material-symbols-outlined admin-portal-input-icon">key</span>
                    <input
                      id="admin-backup-code"
                      type="text"
                      value={twoFactorRecoveryCode}
                      onChange={(e) => setTwoFactorRecoveryCode(e.target.value)}
                      placeholder="XXXX-XXXX"
                      autoFocus
                      required
                    />
                  </div>
                </div>
              )}

              <label className="admin-portal-check-row">
                <input
                  type="checkbox"
                  checked={twoFactorTrustDevice}
                  onChange={(e) => setTwoFactorTrustDevice(e.target.checked)}
                />
                <span>Trust this device for 30 days</span>
              </label>

              <button
                type="submit"
                className="admin-portal-submit-btn"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="admin-portal-spinner" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Verify &amp; Enter Console</span>
                    <span className="material-symbols-outlined">verified_user</span>
                  </>
                )}
              </button>

              <div className="admin-portal-secondary-actions">
                <button
                  type="button"
                  className="admin-portal-inline-link"
                  onClick={() => {
                    setError('');
                    setTwoFactorUseBackup((prev) => !prev);
                  }}
                >
                  {twoFactorUseBackup ? 'Use authenticator app code' : 'Use backup recovery code'}
                </button>
                <button
                  type="button"
                  className="admin-portal-inline-link"
                  onClick={() => {
                    setError('');
                    setViewMode('login');
                  }}
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          )}

          {/* ── MODE 3: PASSWORD RECOVERY ── */}
          {viewMode === 'forgot' && (
            <form className="admin-portal-form" onSubmit={handleForgotSubmit}>
              {forgotSent ? (
                <div className="admin-portal-banner is-success" role="status">
                  <span className="material-symbols-outlined">mark_email_read</span>
                  <span>
                    If an administrator account matches <strong>{forgotEmail}</strong>, a 60-minute password reset link has been sent.
                  </span>
                </div>
              ) : (
                <div className="admin-portal-field">
                  <label htmlFor="admin-forgot-email">REGISTERED ADMINISTRATOR EMAIL</label>
                  <div className="admin-portal-input-wrap">
                    <span className="material-symbols-outlined admin-portal-input-icon">mail</span>
                    <input
                      id="admin-forgot-email"
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="admin@bbdrts.gov.ph"
                      autoFocus
                      required
                    />
                  </div>
                </div>
              )}

              {forgotSent && forgotDevUrl && (
                <a className="admin-portal-dev-link" href={forgotDevUrl}>
                  Open Local Reset Link
                </a>
              )}

              {!forgotSent && (
                <button
                  type="submit"
                  className="admin-portal-submit-btn"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="admin-portal-spinner" />
                      <span>Sending Reset Link...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Password Reset Link</span>
                      <span className="material-symbols-outlined">send</span>
                    </>
                  )}
                </button>
              )}

              <div className="admin-portal-secondary-actions">
                <button
                  type="button"
                  className="admin-portal-inline-link"
                  onClick={() => {
                    setError('');
                    setForgotSent(false);
                    setViewMode('login');
                  }}
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          )}

          {/* Footer security strip */}
          <div className="admin-portal-card-foot">
            <div className="admin-portal-foot-metrics">
              <span><strong>{telemetry.orgs}</strong> NGOs</span>
              <span className="admin-portal-dot-sep">·</span>
              <span><strong>{telemetry.campaigns}</strong> Campaigns</span>
              <span className="admin-portal-dot-sep">·</span>
              <span><strong>{telemetry.donors}</strong> Donors</span>
            </div>
            <div className="admin-portal-audit-note">
              <span className="material-symbols-outlined">shield_lock</span>
              <span>All sign-in attempts are recorded in the system security audit log.</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
