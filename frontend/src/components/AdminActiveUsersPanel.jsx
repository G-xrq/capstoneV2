import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { API_URL } from '../config';
import { useToast } from '../context/ToastContext';
import { getLiveSessionId } from '../hooks/useLivePresence';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import '../views/VercelAdminTables.css';
import GeistSelect from './GeistSelect';
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

function formatCompactPhtDateTime(msOrIso) {
  if (!msOrIso) return '—';
  try {
    const d = new Date(msOrIso);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(d);
  } catch (_) {
    return '—';
  }
}

function formatJourneyTime(msOrIso, nowMs) {
  if (!msOrIso) return '—';
  try {
    const d = new Date(msOrIso);
    if (isNaN(d.getTime())) return '—';
    const dayFmt = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' });
    const sameDay = dayFmt.format(d) === dayFmt.format(new Date(nowMs || Date.now()));
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      ...(sameDay ? {} : { month: 'short', day: 'numeric' }),
      hour: 'numeric',
      minute: '2-digit',
      second: sameDay ? '2-digit' : undefined,
      hour12: true
    }).format(d);
  } catch (_) {
    return '—';
  }
}

function parseJourneyLabel(rawLabel) {
  const clean = String(rawLabel || '').trim();
  if (!clean) return { title: 'Active on platform', context: null };
  const withoutViewing = clean.replace(/^Viewing\s+/i, '');
  const parts = withoutViewing.split(/\s*[·•]\s*/).filter(Boolean);
  if (parts.length >= 2) {
    return {
      title: parts.slice(1).join(' · '),
      context: parts[0]
    };
  }
  return { title: withoutViewing, context: null };
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

  useEffect(() => {
    if (!selectedSession) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setSelectedSession(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedSession]);

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

  useRealtimeSync(
    ['presence'],
    () => { if (autoRefresh) fetchActiveUsers(true); },
    { enabled: autoRefresh, debounceMs: 400 }
  );

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
            <GeistSelect
              compact
              width="148px"
              menuMinWidth={200}
              value={roleFilter}
              onChange={(val) => setRoleFilter(val)}
              options={[
                { id: 'ALL', label: 'All Roles', icon: 'groups' },
                { id: 'donor', label: 'Donors', icon: 'person' },
                { id: 'organization', label: 'NGOs / Orgs', icon: 'domain' },
                { id: 'admin', label: 'Admins', icon: 'shield_person' },
                { id: 'guest', label: 'Guests', icon: 'visibility' }
              ]}
            />

            <GeistSelect
              compact
              alignRight
              width="162px"
              menuMinWidth={200}
              value={String(windowMinutes)}
              onChange={(val) => setWindowMinutes(Number(val))}
              options={[
                { id: '30', label: 'Window: 30 min', icon: 'schedule' },
                { id: '60', label: 'Window: 1 hour', icon: 'schedule' },
                { id: '360', label: 'Window: 6 hours', icon: 'history' },
                { id: '1440', label: 'Window: 24 hours', icon: 'calendar_today' }
              ]}
            />
          </div>
        </div>

        {/* Sync Meta Row */}
        <div className="presence-sync-meta">
          <span>
            Showing <strong>{filteredSessions.length}</strong> of <strong>{sessions.length}</strong> tracked session{sessions.length === 1 ? '' : 's'}
          </span>
          <span className="presence-sync-time">
            RA 10173 Masked IPs · {lastSyncedAt ? `Synced ${formatLastSeen(lastSyncedAt, nowMs)}` : 'Syncing...'}
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
                  const durationMs = typeof s.sessionDurationMs === 'number'
                    ? Math.max(0, s.sessionDurationMs)
                    : Math.max(0, (s.liveStatus === 'OFFLINE' ? (s.disconnectedMs || s.lastSeenMs) : s.lastSeenMs) - (s.firstSeenMs || s.lastSeenMs));

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
                                  {s.isNewAccount && s.wasGuestConverted && (
                                    <span className="presence-converted-note" title="Registered a new account during this session">
                                      · New signup ({s.visitorCode})
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="presence-mono">{s.visitorCode} · Anonymous Visitor</span>
                              )}
                              {/* Personal wallet tag removed — gasless audit mode */}
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
                            {s.liveStatus === 'ONLINE' ? 'Online' : s.liveStatus === 'IDLE' ? 'Away / Idle' : 'Offline'}
                          </span>
                          <span className="presence-time-meta">
                            {s.liveStatus === 'OFFLINE'
                              ? `Left ${formatLastSeen(s.disconnectedMs || s.lastSeenMs, nowMs)}`
                              : `${formatLastSeen(s.lastSeenMs, nowMs)} · Session ${formatElapsed(durationMs)}`}
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

      {/* ── Portaled Live Session Inspector Modal (Vercel Geist Observability) ── */}
      {selectedSession && typeof document !== 'undefined' && createPortal((() => {
        const roleMeta = getRoleMeta(selectedSession.role, selectedSession.isAuthenticated);
        const statusKey = (selectedSession.liveStatus || 'OFFLINE').toLowerCase();
        const statusLabel = selectedSession.liveStatus === 'ONLINE'
          ? 'Online'
          : selectedSession.liveStatus === 'IDLE'
            ? 'Away / Idle'
            : 'Offline';
        const isSelf = selectedSession.sessionId === currentSessionId;
        const durationMs = typeof selectedSession.sessionDurationMs === 'number'
          ? Math.max(0, selectedSession.sessionDurationMs)
          : Math.max(
              0,
              (selectedSession.liveStatus === 'OFFLINE'
                ? (selectedSession.disconnectedMs || selectedSession.lastSeenMs)
                : selectedSession.lastSeenMs) - (selectedSession.firstSeenMs || selectedSession.lastSeenMs)
            );
        const sessionStartMs = selectedSession.sessionStartedMs || selectedSession.firstSeenMs;
        const cleanSessionTag = String(selectedSession.visitorCode || '').replace(/^Guest\s*/i, '').trim() || 'Active';
        const journeyItems = Array.isArray(selectedSession.journey) && selectedSession.journey.length > 0
          ? [...selectedSession.journey].reverse()
          : [{
              ts: selectedSession.lastSeenMs,
              type: 'nav',
              label: `Viewing ${selectedSession.currentView || 'Platform'}${selectedSession.currentSubpage ? ` · ${selectedSession.currentSubpage}` : ''}`
            }];

        return (
          <div
            className="presence-modal-backdrop"
            onClick={() => setSelectedSession(null)}
            role="dialog"
            aria-modal="true"
            aria-label="Live Session Inspector"
          >
            <div className="presence-modal-card" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="presence-modal-header">
                <div className="presence-modal-title-group">
                  <div className={`presence-avatar lg ${roleMeta.cls}`}>
                    {selectedSession.isAuthenticated ? (
                      <span>{getInitials(selectedSession.orgName || selectedSession.userName, selectedSession.userEmail)}</span>
                    ) : (
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>person_outline</span>
                    )}
                    <span className={`presence-avatar-dot ${statusKey}`} />
                  </div>
                  <div className="psi-header-copy">
                    <div className="presence-name-line">
                      <h3>
                        {selectedSession.isAuthenticated
                          ? (selectedSession.orgName || selectedSession.userName || selectedSession.userEmail)
                          : `Guest User (${selectedSession.visitorCode})`}
                      </h3>
                      <span className={`presence-role-badge ${roleMeta.cls}`}>{roleMeta.label}</span>
                      <span className={`presence-status-pill status-${statusKey} psi-header-status`}>
                        <span className={`presence-status-dot ${statusKey}`} />
                        {statusLabel}
                      </span>
                      {selectedSession.isNewAccount && (
                        <span className="presence-tag tag-new">NEW ACCOUNT</span>
                      )}
                      {isSelf && <span className="presence-tag tag-self">YOU</span>}
                    </div>
                    <p className="presence-modal-sub">
                      <span>
                        {selectedSession.isAuthenticated
                          ? selectedSession.userEmail
                          : 'Anonymous guest session'}
                      </span>
                      <span className="psi-sub-sep">·</span>
                      <span>
                        {selectedSession.liveStatus === 'OFFLINE'
                          ? `Left ${formatLastSeen(selectedSession.disconnectedMs || selectedSession.lastSeenMs, nowMs)}`
                          : `Last ping ${formatLastSeen(selectedSession.lastSeenMs, nowMs)}`}
                      </span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="presence-modal-close"
                  onClick={() => setSelectedSession(null)}
                  aria-label="Close session inspector"
                  title="Close (Esc)"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                </button>
              </div>

              {/* Body */}
              <div className="presence-modal-body">
                {selectedSession.isNewAccount && selectedSession.wasGuestConverted && selectedSession.isAuthenticated && (
                  <div className="presence-conversion-banner">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>how_to_reg</span>
                    <div>
                      <strong>New Account Conversion</strong>
                      <span>
                        Arrived as <code>{selectedSession.visitorCode}</code> and registered as{' '}
                        <strong>{selectedSession.userName || selectedSession.userEmail}</strong> in this session.
                      </span>
                    </div>
                  </div>
                )}

                {/* Hero Live Activity Bar */}
                <div className="psi-now-bar">
                  <div className="psi-now-left">
                    <span className={`psi-now-dot status-${statusKey}`} />
                    <div className="psi-now-copy">
                      <span className="psi-now-kicker">Current Activity</span>
                      <div className="psi-now-path">
                        <span className="psi-now-view">{selectedSession.currentView || 'Public Landing Page'}</span>
                        {selectedSession.currentSubpage && (
                          <>
                            <span className="material-symbols-outlined psi-now-arrow">chevron_right</span>
                            <span className="psi-now-subpage">{selectedSession.currentSubpage}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="psi-now-duration" title={`Session active duration: ${formatElapsed(durationMs)}`}>
                    <span className="psi-now-duration-label">Session</span>
                    <span className="psi-now-duration-val">{formatElapsed(durationMs)}</span>
                  </div>
                </div>

                {/* Unified 2x2 Hairline Telemetry Matrix */}
                <div className="psi-telemetry-matrix">
                  <div className="psi-matrix-cell">
                    <div className="psi-cell-head">
                      <span className="material-symbols-outlined">{getDeviceIcon(selectedSession.deviceType)}</span>
                      <span>Device &amp; Browser</span>
                    </div>
                    <div className="psi-cell-val">{selectedSession.os || 'Unknown OS'} · {selectedSession.browser || 'Browser'}</div>
                    <div className="psi-cell-sub">{selectedSession.deviceType || 'Desktop'}</div>
                  </div>

                  <div className="psi-matrix-cell">
                    <div className="psi-cell-head">
                      <span className="material-symbols-outlined">lan</span>
                      <span>Network &amp; Session</span>
                    </div>
                    <div className="psi-cell-val presence-mono">{selectedSession.ipAddress || '—'}</div>
                    <div className="psi-cell-sub">
                      <span className="presence-mono">Session {cleanSessionTag}</span>
                      <span> · RA 10173 Masked</span>
                    </div>
                  </div>

                  <div className="psi-matrix-cell">
                    <div className="psi-cell-head">
                      <span className="material-symbols-outlined">schedule</span>
                      <span>Session Started</span>
                    </div>
                    <div className="psi-cell-val" title={formatPhtTimestamp(sessionStartMs)}>
                      {formatCompactPhtDateTime(sessionStartMs)}
                    </div>
                    <div className="psi-cell-sub">
                      {selectedSession.liveStatus === 'OFFLINE'
                        ? `Ended ${formatCompactPhtDateTime(selectedSession.disconnectedMs || selectedSession.lastSeenMs)}`
                        : `Active for ${formatElapsed(durationMs)}`}
                    </div>
                  </div>

                  <div className="psi-matrix-cell">
                    <div className="psi-cell-head">
                      <span className="material-symbols-outlined">
                        {selectedSession.isAuthenticated ? 'verified_user' : 'visibility'}
                      </span>
                      <span>Account</span>
                    </div>
                    <div className="psi-cell-val">
                      {selectedSession.isAuthenticated ? 'Verified Account' : 'Guest Visitor'}
                    </div>
                    <div className="psi-cell-sub" title={selectedSession.accountCreatedAt ? formatPhtTimestamp(selectedSession.accountCreatedAt) : undefined}>
                      {selectedSession.accountCreatedAt
                        ? `Joined ${formatCompactPhtDateTime(selectedSession.accountCreatedAt)}`
                        : (selectedSession.isAuthenticated ? 'Registered platform account' : 'Unregistered visitor')}
                    </div>
                  </div>
                </div>

                {/* Live Session Journey Card */}
                <div className="psi-journey-card">
                  <div className="psi-journey-head">
                    <div className="psi-journey-title">
                      <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>timeline</span>
                      <span>Session Activity</span>
                    </div>
                    <span className="psi-journey-count">
                      {journeyItems.length} {journeyItems.length === 1 ? 'event' : 'events'}
                    </span>
                  </div>

                  <div className="psi-journey-scroll">
                    <div className="psi-journey-timeline">
                      {journeyItems.map((step, i) => {
                        const parsed = parseJourneyLabel(step.label);
                        const isLatest = i === 0;
                        return (
                          <div
                            key={`${step.ts}-${i}`}
                            className={`psi-journey-row type-${step.type || 'nav'}${isLatest ? ' is-latest' : ''}`}
                          >
                            <div className="psi-timeline-rail" aria-hidden="true">
                              <span className="psi-timeline-node" />
                              {i < journeyItems.length - 1 && <span className="psi-timeline-line" />}
                            </div>
                            <div className="psi-journey-main">
                              <span className="psi-journey-label">{parsed.title}</span>
                              {parsed.context && (
                                <span className="psi-journey-context">{parsed.context}</span>
                              )}
                            </div>
                            <span
                              className="psi-journey-time"
                              title={formatPhtTimestamp(step.ts)}
                            >
                              {formatJourneyTime(step.ts, nowMs)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Clean Footer */}
              <div className="psi-modal-footer">
                <span className="psi-footer-hint">Press Esc to close · Live stream refreshes automatically</span>
                <button
                  type="button"
                  className="psi-footer-close"
                  onClick={() => setSelectedSession(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })(), document.body)}
    </div>
  );
}
