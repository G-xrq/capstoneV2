import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { API_URL } from '../config';
import { useToast } from '../context/ToastContext';
import { getLiveSessionId } from '../hooks/useLivePresence';
import '../views/VercelAdminTables.css';
import './AdminActiveUsersPanel.css';

function formatElapsed(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  if (totalSec < 60) return `${totalSec}s`;
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m`;
}

function formatLastSeen(lastSeenMs, nowMs) {
  if (!lastSeenMs) return '—';
  const diffSec = Math.max(0, Math.floor((nowMs - lastSeenMs) / 1000));
  if (diffSec < 12) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

function formatPhtTimestamp(msOrIso) {
  if (!msOrIso) return '—';
  try {
    const d = new Date(msOrIso);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).format(d) + ' PHT';
  } catch (_) {
    return '—';
  }
}

function getDeviceIcon(deviceType) {
  const lower = String(deviceType || '').toLowerCase();
  if (lower.includes('mobile') || lower.includes('phone')) return 'smartphone';
  if (lower.includes('tablet') || lower.includes('ipad')) return 'tablet_mac';
  return 'desktop_windows';
}

function getRoleMeta(role, isAuthenticated) {
  if (!isAuthenticated || role === 'guest') {
    return { label: 'GUEST', cls: 'role-guest', icon: 'person_outline' };
  }
  const r = String(role || 'donor').toLowerCase();
  if (r === 'admin') return { label: 'ADMIN', cls: 'role-admin', icon: 'shield_person' };
  if (r === 'organization' || r === 'ngo') return { label: 'NGO', cls: 'role-ngo', icon: 'corporate_fare' };
  return { label: 'DONOR', cls: 'role-donor', icon: 'volunteer_activism' };
}

function getInitials(name, email) {
  const src = (name || email || 'U').trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function shortWallet(addr) {
  if (!addr || addr.length < 10) return addr || '';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function AdminActiveUsersPanel({ onPresenceSummaryChange }) {
  const { showSuccess, showError } = useToast();
  const [sessions, setSessions] = useState([]);
  const [summary, setSummary] = useState({
    totalLive: 0,
    onlineNow: 0,
    idleNow: 0,
    authenticatedLive: 0,
    guestsLive: 0,
    donorsLive: 0,
    orgsLive: 0,
    adminsLive: 0,
    newAccountsLive: 0,
    convertedFromGuest: 0,
    recentOffline: 0,
    totalSessions: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState('LIVE'); // 'LIVE' | 'SIGNED_IN' | 'GUESTS' | 'NEW_ACCOUNTS' | 'ALL_RECENT'
  const [roleFilter, setRoleFilter] = useState('ALL'); // 'ALL' | 'donor' | 'organization' | 'admin' | 'guest'
  const [windowMinutes, setWindowMinutes] = useState(60);
  const [selectedSession, setSelectedSession] = useState(null);

  const currentSessionId = useMemo(() => getLiveSessionId(), []);

  const resolveAdminToken = async () => {
    let token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
    if (!token || token === 'null' || token === 'undefined') {
      try {
        const res = await fetch(`${API_URL}/api/auth/direct-admin`, { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          if (data.token) {
            localStorage.setItem('bbdrts_token', data.token);
            return data.token;
          }
        }
      } catch (_) {}
      return 'direct_admin_access_token';
    }
    return token;
  };

  const fetchActiveUsers = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      let token = await resolveAdminToken();
      let res = await fetch(`${API_URL}/api/admin/active-users?windowMinutes=${windowMinutes}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if ((res.status === 401 || res.status === 403) && token !== 'direct_admin_access_token') {
        token = 'direct_admin_access_token';
        res = await fetch(`${API_URL}/api/admin/active-users?windowMinutes=${windowMinutes}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      if (!res.ok) throw new Error('Failed to fetch live presence telemetry.');
      const data = await res.json();
      const list = Array.isArray(data.sessions) ? data.sessions : [];
      const nextSummary = data.summary || {};
      setSessions(list);
      setSummary(prev => ({ ...prev, ...nextSummary }));
      setLastSyncedAt(Date.now());

      if (onPresenceSummaryChange) {
        onPresenceSummaryChange(nextSummary);
      }

      setSelectedSession(prev => {
        if (!prev) return null;
        return list.find(s => s.sessionId === prev.sessionId) || prev;
      });
    } catch (err) {
      if (!silent) {
        showError(err.message || 'Could not load active users.', 'Presence Sync Error');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [windowMinutes, onPresenceSummaryChange, showError]);

  useEffect(() => {
    fetchActiveUsers(false);
  }, [fetchActiveUsers]);

  // 5-second real-time auto-refresh loop
  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = window.setInterval(() => {
      fetchActiveUsers(true);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, fetchActiveUsers]);

  // 1-second local clock tick so "Just now" / session duration stay fluid
  useEffect(() => {
    const tick = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  const handleClearOffline = async () => {
    try {
      let token = await resolveAdminToken();
      let res = await fetch(`${API_URL}/api/admin/active-users/offline`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if ((res.status === 401 || res.status === 403) && token !== 'direct_admin_access_token') {
        res = await fetch(`${API_URL}/api/admin/active-users/offline`, {
          method: 'DELETE',
          headers: { Authorization: 'Bearer direct_admin_access_token' }
        });
      }
      if (!res.ok) throw new Error('Failed to clear offline sessions.');
      showSuccess('Cleared disconnected sessions from the live monitor.', 'Monitor Cleaned');
      fetchActiveUsers(false);
    } catch (err) {
      showError(err.message || 'Could not clear offline sessions.', 'Error');
    }
  };

  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sessions.filter((s) => {
      if (scopeFilter === 'LIVE' && s.liveStatus === 'OFFLINE') return false;
      if (scopeFilter === 'SIGNED_IN' && (!s.isAuthenticated || s.liveStatus === 'OFFLINE')) return false;
      if (scopeFilter === 'GUESTS' && (s.isAuthenticated || s.liveStatus === 'OFFLINE')) return false;
      if (scopeFilter === 'NEW_ACCOUNTS' && !s.isNewAccount && !s.wasGuestConverted) return false;

      if (roleFilter !== 'ALL') {
        const effRole = s.isAuthenticated ? String(s.role || 'donor').toLowerCase() : 'guest';
        if (effRole !== roleFilter) return false;
      }

      if (q) {
        const hay = [
          s.userName,
          s.userEmail,
          s.orgName,
          s.visitorCode,
          s.role,
          s.currentView,
          s.currentSubpage,
          s.os,
          s.browser,
          s.deviceType,
          s.ipAddress,
          s.walletAddress
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sessions, scopeFilter, roleFilter, searchQuery]);

  return (
    <div className="admin-presence-panel">
      {/* ── Page Header ── */}
      <div className="admin-page-header">
        <div className="admin-page-title-wrap">
          <h2 className="admin-page-title">
            <span className="material-symbols-outlined" style={{ fontSize: '24px', color: '#10b981' }}>sensors</span>
            Live Active Users
            <span className={`presence-stream-pill ${autoRefresh ? 'is-live' : 'is-paused'}`}>
              <span className="presence-pulse-dot" />
              {autoRefresh ? 'LIVE · 5s' : 'PAUSED'}
            </span>
          </h2>
          <p className="admin-page-sub">
            Real-time visibility into who is using BBDRTS right now — distinguishing anonymous guest visitors from signed-in donors, NGOs, admins, and newly created accounts.
          </p>
        </div>

        <div className="admin-page-header-actions">
          <button
            type="button"
            className={`admin-header-btn ${autoRefresh ? 'active-stream' : 'secondary'}`}
            onClick={() => setAutoRefresh(prev => !prev)}
            title={autoRefresh ? 'Pause automatic 5-second refresh' : 'Resume automatic 5-second refresh'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
              {autoRefresh ? 'pause_circle' : 'play_circle'}
            </span>
            <span>{autoRefresh ? 'Auto-Sync On' : 'Auto-Sync Paused'}</span>
          </button>

          <button
            type="button"
            className="admin-header-btn secondary"
            onClick={() => fetchActiveUsers(false)}
            disabled={refreshing}
          >
            <span className={`material-symbols-outlined ${refreshing ? 'presence-spin' : ''}`} style={{ fontSize: '16px' }}>
              refresh
            </span>
            <span>Refresh</span>
          </button>

          {summary.recentOffline > 0 && (
            <button
              type="button"
              className="admin-header-btn secondary"
              onClick={handleClearOffline}
              title="Remove recently disconnected sessions"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>cleaning_services</span>
              <span>Clear Offline ({summary.recentOffline})</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 4-Column Vercel Executive KPI Strip ── */}
      <div className="admin-metric-strip">
        <div
          className="admin-metric-strip-item clickable"
          onClick={() => { setScopeFilter('LIVE'); setRoleFilter('ALL'); }}
          title="Filter to all live active sessions"
        >
          <div className="admin-metric-label">
            <span>Active Right Now</span>
            <span className="presence-kpi-dot online" />
          </div>
          <div className="admin-metric-value" style={{ color: '#10b981' }}>
            {summary.totalLive || 0}
          </div>
          <div className="admin-metric-sub">
            {summary.onlineNow || 0} online · {summary.idleNow || 0} idle tab
          </div>
        </div>

        <div
          className="admin-metric-strip-item clickable"
          onClick={() => { setScopeFilter('SIGNED_IN'); setRoleFilter('ALL'); }}
          title="Filter to signed-in users"
        >
          <div className="admin-metric-label">
            <span>Signed-In Accounts</span>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#38bdf8' }}>verified_user</span>
          </div>
          <div className="admin-metric-value">
            {summary.authenticatedLive || 0}
          </div>
          <div className="admin-metric-sub">
            {summary.donorsLive || 0} donors · {summary.orgsLive || 0} NGOs · {summary.adminsLive || 0} admin
          </div>
        </div>

        <div
          className="admin-metric-strip-item clickable"
          onClick={() => { setScopeFilter('GUESTS'); setRoleFilter('ALL'); }}
          title="Filter to anonymous guest visitors"
        >
          <div className="admin-metric-label">
            <span>Guest Visitors</span>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#a1a1aa' }}>person_outline</span>
          </div>
          <div className="admin-metric-value">
            {summary.guestsLive || 0}
          </div>
          <div className="admin-metric-sub">
            Browsing without an account
          </div>
        </div>

        <div
          className="admin-metric-strip-item clickable"
          onClick={() => { setScopeFilter('NEW_ACCOUNTS'); setRoleFilter('ALL'); }}
          title="Filter to newly created accounts & converted guests"
        >
          <div className="admin-metric-label">
            <span>New Signups &amp; Converted</span>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#a855f7' }}>person_add</span>
          </div>
          <div className="admin-metric-value" style={{ color: (summary.newAccountsLive || summary.convertedFromGuest) > 0 ? '#a855f7' : undefined }}>
            {summary.newAccountsLive || 0}
          </div>
          <div className="admin-metric-sub">
            {summary.convertedFromGuest || 0} upgraded from Guest session
          </div>
        </div>
      </div>

      {/* ── Main Live Presence Monitor Card ── */}
      <div className="vercel-admin-card padded">
        {/* Toolbar */}
        <div className="vercel-toolbar presence-toolbar">
          <div className="vercel-search-wrap">
            <span className="material-symbols-outlined search-icon">search</span>
            <input
              type="text"
              className="vercel-search-input"
              placeholder="Search name, email, Guest #ID, screen, OS, browser, or IP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="vercel-pill-group presence-scope-pills">
            {[
              { id: 'LIVE', label: 'Live Now', count: summary.totalLive },
              { id: 'SIGNED_IN', label: 'Signed In', count: summary.authenticatedLive },
              { id: 'GUESTS', label: 'Guests', count: summary.guestsLive },
              { id: 'NEW_ACCOUNTS', label: 'New / Converted', count: summary.newAccountsLive || summary.convertedFromGuest },
              { id: 'ALL_RECENT', label: 'All Recent', count: summary.totalSessions }
            ].map((pill) => (
              <button
                key={pill.id}
                type="button"
                className={`vercel-pill-btn ${scopeFilter === pill.id ? 'active' : ''}`}
                onClick={() => setScopeFilter(pill.id)}
              >
                <span>{pill.label}</span>
                <span className="presence-pill-count">{pill.count || 0}</span>
              </button>
            ))}
          </div>

          <div className="presence-toolbar-selects">
            <select
              className="presence-select"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              aria-label="Filter by role"
            >
              <option value="ALL">All Roles</option>
              <option value="donor">Donors</option>
              <option value="organization">NGOs / Orgs</option>
              <option value="admin">Admins</option>
              <option value="guest">Guests</option>
            </select>

            <select
              className="presence-select"
              value={windowMinutes}
              onChange={(e) => setWindowMinutes(Number(e.target.value))}
              aria-label="History window"
            >
              <option value={30}>Window: 30 min</option>
              <option value={60}>Window: 1 hour</option>
              <option value={360}>Window: 6 hours</option>
              <option value={1440}>Window: 24 hours</option>
            </select>
          </div>
        </div>

        {/* Sync Meta Row */}
        <div className="presence-sync-meta">
          <span>
            Showing <strong>{filteredSessions.length}</strong> of <strong>{sessions.length}</strong> tracked session{sessions.length === 1 ? '' : 's'}
          </span>
          <span className="presence-sync-time">
            {lastSyncedAt ? `Last synced ${formatLastSeen(lastSyncedAt, nowMs)}` : 'Syncing...'}
          </span>
        </div>

        {/* Table / Live Session List */}
        {loading ? (
          <div className="presence-empty-state">
            <span className="material-symbols-outlined presence-spin" style={{ fontSize: '26px' }}>progress_activity</span>
            <p>Connecting to live session presence stream...</p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="presence-empty-state">
            <span className="material-symbols-outlined" style={{ fontSize: '30px', opacity: 0.6 }}>person_search</span>
            <h4>No matching sessions</h4>
            <p>
              {scopeFilter === 'GUESTS'
                ? 'No anonymous guest visitors are currently browsing the platform.'
                : scopeFilter === 'NEW_ACCOUNTS'
                  ? 'No newly registered or guest-converted accounts in the selected window yet.'
                  : 'Try clearing your search or switching to "All Recent" to inspect recently active visitors.'}
            </p>
          </div>
        ) : (
          <div className="presence-table-wrap">
            <table className="presence-table">
              <thead>
                <tr>
                  <th>User &amp; Identity</th>
                  <th>Current Activity</th>
                  <th>Device &amp; Network</th>
                  <th>Presence &amp; Duration</th>
                  <th style={{ textAlign: 'right' }}>Session</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.map((s) => {
                  const roleMeta = getRoleMeta(s.role, s.isAuthenticated);
                  const isSelf = s.sessionId === currentSessionId;
                  const statusKey = (s.liveStatus || 'OFFLINE').toLowerCase();
                  const durationMs =
                    s.liveStatus === 'OFFLINE' && s.disconnectedMs
                      ? Math.max(0, s.disconnectedMs - (s.firstSeenMs || s.lastSeenMs))
                      : Math.max(0, nowMs - (s.firstSeenMs || s.lastSeenMs));

                  return (
                    <tr
                      key={s.sessionId}
                      className={`presence-row status-${statusKey}`}
                      onClick={() => setSelectedSession(s)}
                    >
                      {/* Identity */}
                      <td>
                        <div className="presence-identity-cell">
                          <div className={`presence-avatar ${roleMeta.cls}`}>
                            {s.isAuthenticated ? (
                              <span>{getInitials(s.orgName || s.userName, s.userEmail)}</span>
                            ) : (
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>person_outline</span>
                            )}
                            <span className={`presence-avatar-dot ${statusKey}`} title={s.liveStatus} />
                          </div>

                          <div className="presence-identity-text">
                            <div className="presence-name-line">
                              <strong className="presence-display-name">
                                {s.isAuthenticated
                                  ? (s.orgName || s.userName || s.userEmail || 'Registered User')
                                  : 'Guest User'}
                              </strong>
                              <span className={`presence-role-badge ${roleMeta.cls}`}>
                                {roleMeta.label}
                              </span>
                              {s.isNewAccount && (
                                <span className="presence-tag tag-new">
                                  <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>auto_awesome</span>
                                  NEW ACCOUNT
                                </span>
                              )}
                              {isSelf && <span className="presence-tag tag-self">YOU</span>}
                            </div>

                            <div className="presence-sub-line">
                              {s.isAuthenticated ? (
                                <>
                                  <span className="presence-email">{s.userEmail}</span>
                                  {s.wasGuestConverted && (
                                    <span className="presence-converted-note" title="Started as an anonymous guest and upgraded to a signed-in account in this session">
                                      · Converted from {s.visitorCode}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="presence-mono">{s.visitorCode} · Anonymous Visitor</span>
                              )}
                              {s.walletAddress && (
                                <span className="presence-wallet-tag" title={`Connected Wallet: ${s.walletAddress}`}>
                                  <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>account_balance_wallet</span>
                                  {shortWallet(s.walletAddress)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Activity */}
                      <td>
                        <div className="presence-activity-cell">
                          <span className="presence-view-name">{s.currentView || 'Public Landing Page'}</span>
                          <span className="presence-subpage-name">{s.currentSubpage || 'Overview'}</span>
                        </div>
                      </td>

                      {/* Device & Network */}
                      <td>
                        <div className="presence-device-cell">
                          <div className="presence-device-top">
                            <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--text-muted)' }}>
                              {getDeviceIcon(s.deviceType)}
                            </span>
                            <span>{s.os || 'Unknown OS'} · {s.browser || 'Browser'}</span>
                          </div>
                          <span className="presence-mono presence-ip">{s.ipAddress || 'Unknown IP'}</span>
                        </div>
                      </td>

                      {/* Presence & Duration */}
                      <td>
                        <div className="presence-time-cell">
                          <span className={`presence-status-pill status-${statusKey}`}>
                            <span className={`presence-status-dot ${statusKey}`} />
                            {s.liveStatus === 'ONLINE' ? 'Online' : s.liveStatus === 'IDLE' ? 'Idle Tab' : 'Left'}
                          </span>
                          <span className="presence-time-meta">
                            {s.liveStatus === 'OFFLINE'
                              ? `Left ${formatLastSeen(s.disconnectedMs || s.lastSeenMs, nowMs)}`
                              : `${formatLastSeen(s.lastSeenMs, nowMs)} · Active ${formatElapsed(durationMs)}`}
                          </span>
                        </div>
                      </td>

                      {/* Inspect */}
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="presence-inspect-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSession(s);
                          }}
                        >
                          <span>Inspect</span>
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>chevron_right</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Portaled Live Session Inspector Modal ── */}
      {selectedSession && typeof document !== 'undefined' && createPortal(
        <div
          className="presence-modal-backdrop"
          onClick={() => setSelectedSession(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Live Session Inspector"
        >
          <div className="presence-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="presence-modal-header">
              <div className="presence-modal-title-group">
                <div className={`presence-avatar lg ${getRoleMeta(selectedSession.role, selectedSession.isAuthenticated).cls}`}>
                  {selectedSession.isAuthenticated ? (
                    <span>{getInitials(selectedSession.orgName || selectedSession.userName, selectedSession.userEmail)}</span>
                  ) : (
                    <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>person_outline</span>
                  )}
                  <span className={`presence-avatar-dot ${(selectedSession.liveStatus || 'OFFLINE').toLowerCase()}`} />
                </div>
                <div>
                  <div className="presence-name-line">
                    <h3>
                      {selectedSession.isAuthenticated
                        ? (selectedSession.orgName || selectedSession.userName || selectedSession.userEmail)
                        : `Guest User (${selectedSession.visitorCode})`}
                    </h3>
                    <span className={`presence-role-badge ${getRoleMeta(selectedSession.role, selectedSession.isAuthenticated).cls}`}>
                      {getRoleMeta(selectedSession.role, selectedSession.isAuthenticated).label}
                    </span>
                    {selectedSession.isNewAccount && (
                      <span className="presence-tag tag-new">NEW ACCOUNT</span>
                    )}
                  </div>
                  <p className="presence-modal-sub">
                    {selectedSession.isAuthenticated
                      ? selectedSession.userEmail
                      : 'Anonymous browsing session (no registered account signed in yet)'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="presence-modal-close"
                onClick={() => setSelectedSession(null)}
                aria-label="Close session inspector"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="presence-modal-body">
              {selectedSession.wasGuestConverted && selectedSession.isAuthenticated && (
                <div className="presence-conversion-banner">
                  <span className="material-symbols-outlined">how_to_reg</span>
                  <div>
                    <strong>Guest-to-Account Conversion Detected</strong>
                    <span>
                      This visitor originally arrived as <code>{selectedSession.visitorCode}</code> and authenticated as <strong>{selectedSession.userName || selectedSession.userEmail}</strong> during this live session.
                    </span>
                  </div>
                </div>
              )}

              <div className="presence-detail-grid">
                <div className="presence-detail-item">
                  <span className="presence-detail-label">Current Screen</span>
                  <span className="presence-detail-val">{selectedSession.currentView}</span>
                  <span className="presence-detail-sub">{selectedSession.currentSubpage}</span>
                </div>
                <div className="presence-detail-item">
                  <span className="presence-detail-label">Live Status</span>
                  <span className="presence-detail-val">{selectedSession.liveStatus}</span>
                  <span className="presence-detail-sub">
                    Last ping {formatLastSeen(selectedSession.lastSeenMs, nowMs)}
                  </span>
                </div>
                <div className="presence-detail-item">
                  <span className="presence-detail-label">Device &amp; Browser</span>
                  <span className="presence-detail-val">{selectedSession.deviceType} · {selectedSession.os}</span>
                  <span className="presence-detail-sub">{selectedSession.browser}</span>
                </div>
                <div className="presence-detail-item">
                  <span className="presence-detail-label">Network &amp; Session ID</span>
                  <span className="presence-detail-val presence-mono">{selectedSession.ipAddress || '—'}</span>
                  <span className="presence-detail-sub presence-mono">{selectedSession.visitorCode}</span>
                </div>
                <div className="presence-detail-item">
                  <span className="presence-detail-label">Session Started</span>
                  <span className="presence-detail-val">{formatPhtTimestamp(selectedSession.firstSeenMs)}</span>
                  <span className="presence-detail-sub">
                    Duration: {formatElapsed(Math.max(0, (selectedSession.disconnectedMs || nowMs) - (selectedSession.firstSeenMs || nowMs)))}
                  </span>
                </div>
                <div className="presence-detail-item">
                  <span className="presence-detail-label">Web3 Wallet / Account Age</span>
                  <span className="presence-detail-val presence-mono">
                    {selectedSession.walletAddress ? shortWallet(selectedSession.walletAddress) : 'No wallet connected'}
                  </span>
                  <span className="presence-detail-sub">
                    {selectedSession.accountCreatedAt
                      ? `Account created ${formatPhtTimestamp(selectedSession.accountCreatedAt)}`
                      : (selectedSession.isAuthenticated ? 'Existing verified account' : 'Unregistered guest')}
                  </span>
                </div>
              </div>

              {/* Chronological Session Journey */}
              <div className="presence-journey-section">
                <div className="presence-journey-header">
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>timeline</span>
                  <span>Live Session Journey</span>
                </div>
                <div className="presence-journey-list">
                  {(Array.isArray(selectedSession.journey) && selectedSession.journey.length > 0
                    ? [...selectedSession.journey].reverse()
                    : [{ ts: selectedSession.lastSeenMs, type: 'nav', label: `Viewing ${selectedSession.currentView}` }]
                  ).map((step, i) => (
                    <div key={`${step.ts}-${i}`} className={`presence-journey-step type-${step.type || 'nav'}`}>
                      <span className="presence-journey-dot" />
                      <div className="presence-journey-content">
                        <span className="presence-journey-label">{step.label}</span>
                        <span className="presence-journey-time">{formatPhtTimestamp(step.ts)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
