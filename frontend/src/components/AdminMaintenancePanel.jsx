import { useState, useEffect } from 'react';
import { API_URL } from '../config';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { useToast } from '../context/ToastContext';
import CustomDateTimePicker from './CustomDateTimePicker';
import '../views/VercelAdminTables.css';
import './AdminMaintenancePanel.css';

const MAINTENANCE_CATEGORIES = [
  {
    category: 'Entire System & Public Access',
    icon: 'dns',
    description: 'Control platform-wide lockdown and public unauthenticated access.',
    items: [
      {
        id: 'FULL_PLATFORM',
        label: 'Full Platform Lockdown (Entire System)',
        desc: 'Block all non-admin visitors across every page (Public Landing, Donors, NGOs).',
        icon: 'lock',
        critical: true
      },
      {
        id: 'PUBLIC_LANDING',
        label: 'Public Landing Page & Discovery Feed',
        desc: 'Show maintenance screen to unauthenticated visitors browsing disaster campaigns.',
        icon: 'public'
      },
      {
        id: 'NGO_ONBOARDING',
        label: 'NGO Accreditation & Registration Desk',
        desc: 'Pause new organization registrations and SEC document submissions.',
        icon: 'how_to_reg'
      }
    ]
  },
  {
    category: 'Donor Pages & Features Under Maintenance',
    icon: 'volunteer_activism',
    description: 'Control access to donor dashboard, contributions, and disaster mapping.',
    items: [
      {
        id: 'DONOR_PORTAL',
        label: 'Entire Donor Dashboard & Pages',
        desc: 'Block logged-in donors from accessing the donor portal and show maintenance dialog.',
        icon: 'person_off'
      },
      {
        id: 'DONATIONS',
        label: 'Donation Gateway (GCash, Maya, Card & Bank)',
        desc: 'Disable donation submission buttons and freeze escrow incoming contributions.',
        icon: 'payments'
      },
      {
        id: 'DONOR_RADAR',
        label: 'Disaster Radar & Topo Map GIS Explorer',
        desc: 'Pause the interactive humanitarian GIS radar and live evacuation map.',
        icon: 'radar'
      }
    ]
  },
  {
    category: 'NGO / Organization Pages Under Maintenance',
    icon: 'corporate_fare',
    description: 'Control access to NGO operations, fund releases, and campaign deployments.',
    items: [
      {
        id: 'NGO_PORTAL',
        label: 'Entire NGO Operations Portal',
        desc: 'Block logged-in NGO representatives from accessing the organization dashboard.',
        icon: 'domain_disabled'
      },
      {
        id: 'DISBURSEMENTS',
        label: 'Relief Fund Disbursements & Proofs',
        desc: 'Disable escrow release authorizations and expense report liquidation uploads.',
        icon: 'local_shipping'
      },
      {
        id: 'CAMPAIGN_CREATION',
        label: 'Deploy Emergency Relief Campaign',
        desc: 'Temporarily prevent NGOs from launching and deploying new disaster relief campaigns.',
        icon: 'add_box'
      }
    ]
  }
];

function toDatetimeLocal(val) {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatFriendlyDateTime(val) {
  if (!val) return '';
  const normalized = typeof val === 'string'
    ? val.trim().replace(/\s*[|·•]\s*/g, ', ')
    : val;
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return '';
  const datePart = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const timePart = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  return `${datePart} | ${timePart}`;
}

export default function AdminMaintenancePanel({ onMaintenanceStateChange, forcedSection = null }) {
  const { showSuccess, showError, showWarning } = useToast();
  const [internalSection, setInternalSection] = useState('backups'); // 'backups' | 'maintenance'
  const activeSection = forcedSection || internalSection;
  const setActiveSection = setInternalSection;

  // ── Database Backups State ──
  const [backups, setBackups] = useState([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);

  // ── Maintenance Mode State ──
  const [maintenance, setMaintenance] = useState({
    enabled: false,
    autoDeactivate: true,
    scope: [],
    title: 'System Under Scheduled Maintenance',
    message: 'Our platform services are currently undergoing maintenance to enhance reliability and smart contract security. Essential relief tracking remains recorded on-chain.',
    startTime: '',
    startTimeIso: '',
    endTime: '',
    endTimeIso: '',
    contactPerson: 'Disaster Relief IT Support',
    contactEmail: 'bbdrts@gmail.com',
    contactPhone: '0992 982 4615'
  });
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [liveNowMs, setLiveNowMs] = useState(() => Date.now());
  const [followLiveStart, setFollowLiveStart] = useState(true);
  const [linkedDurationMins, setLinkedDurationMins] = useState(15);
  const [isEndOpenEnded, setIsEndOpenEnded] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setLiveNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const parseMaintMs = (iso, friendly) => {
    for (const v of [iso, friendly]) {
      if (!v || typeof v !== 'string' || !v.trim()) continue;
      const normalized = v.trim().replace(/\s*[|·•]\s*/g, ', ');
      const ms = Date.parse(normalized);
      if (!isNaN(ms)) return ms;
    }
    return null;
  };

  const formatDurationShort = (ms) => {
    const secs = Math.max(0, Math.ceil(ms / 1000));
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  const rawStartMs = parseMaintMs(maintenance.startTimeIso, maintenance.startTime);
  const rawEndMs = parseMaintMs(maintenance.endTimeIso, maintenance.endTime);

  // Follow real live time whenever user is in Live/Now mode OR when a non-active saved/draft start time has fallen into the past
  const isLiveStartActive = Boolean(
    followLiveStart ||
    (!maintenance.enabled && (!rawStartMs || rawStartMs <= liveNowMs))
  );
  const effectiveStartDate = isLiveStartActive ? new Date(liveNowMs) : (rawStartMs ? new Date(rawStartMs) : null);
  const effectiveStartDisplay = isLiveStartActive
    ? formatFriendlyDateTime(effectiveStartDate)
    : (maintenance.startTime || '');
  const effectiveStartIso = effectiveStartDate ? effectiveStartDate.toISOString() : '';
  const startMs = isLiveStartActive ? liveNowMs : rawStartMs;

  // Keep Expected Completion always a specific duration ahead of Effective From unless explicitly cleared or running a saved countdown
  const isLinkedEndActive = Boolean(
    !isEndOpenEnded && (
      linkedDurationMins !== null ||
      (!maintenance.enabled && (!rawEndMs || rawEndMs <= (startMs || liveNowMs)))
    )
  );
  const activeOffsetMins = linkedDurationMins || 15;
  const endMs = isEndOpenEnded
    ? null
    : (isLinkedEndActive ? (startMs || liveNowMs) + activeOffsetMins * 60000 : rawEndMs);
  const effectiveEndDate = endMs ? new Date(endMs) : null;
  const effectiveEndDisplay = isEndOpenEnded
    ? ''
    : (isLinkedEndActive ? formatFriendlyDateTime(effectiveEndDate) : (maintenance.endTime || ''));
  const effectiveEndIso = effectiveEndDate ? effectiveEndDate.toISOString() : '';

  const hasInvalidWindow = Boolean(startMs && endMs && endMs <= startMs);
  const isEndPastNow = Boolean(endMs && endMs <= liveNowMs);
  const isEndInPast = Boolean(maintenance.enabled && maintenance.autoDeactivate && isEndPastNow);
  const schedulePhase = !maintenance.enabled
    ? 'OFF'
    : (maintenance.autoDeactivate && endMs && liveNowMs >= endMs)
      ? 'COMPLETED'
      : (startMs && liveNowMs < startMs)
        ? 'SCHEDULED'
        : 'ACTIVE';

  // Fetch Backups
  const fetchBackups = async (silent = false) => {
    if (!silent) setBackupsLoading(true);
    try {
      const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/backups`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      if (res.ok) {
        const data = await res.json();
        setBackups(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.warn('Failed to load database backups:', err.message);
    } finally {
      if (!silent) setBackupsLoading(false);
    }
  };

  // Fetch Maintenance Mode
  const fetchMaintenance = async () => {
    try {
      const res = await fetch(`${API_URL}/api/system/maintenance`);
      if (res.ok) {
        const data = await res.json();
        setMaintenance(data);
        const nowFetch = Date.now();
        const fetchedStartMs = parseMaintMs(data.startTimeIso, data.startTime);
        const fetchedEndMs = parseMaintMs(data.endTimeIso, data.endTime);
        const isFutureScheduled = Boolean(fetchedStartMs && fetchedStartMs > nowFetch);
        const isActiveRunning = Boolean(data.enabled && fetchedStartMs && fetchedStartMs <= nowFetch);
        setFollowLiveStart(!isFutureScheduled && !isActiveRunning);

        if (data.enabled && fetchedEndMs && fetchedEndMs > nowFetch) {
          // Preserve active countdown target without moving the finish line
          setLinkedDurationMins(null);
          setIsEndOpenEnded(false);
        } else if (data.enabled && !fetchedEndMs) {
          setLinkedDurationMins(null);
          setIsEndOpenEnded(true);
        } else {
          // Inactive or previously completed window: keep Expected Completion cleanly ahead (+15m default)
          const inferredMins = (fetchedStartMs && fetchedEndMs && fetchedEndMs > fetchedStartMs)
            ? Math.max(2, Math.round((fetchedEndMs - fetchedStartMs) / 60000))
            : 15;
          const snapped = [2, 5, 15, 30, 60].includes(inferredMins) ? inferredMins : 15;
          setLinkedDurationMins(snapped);
          setIsEndOpenEnded(false);
        }
        if (onMaintenanceStateChange) onMaintenanceStateChange(data.enabled);
      }
    } catch (err) {
      console.warn('Failed to load maintenance config:', err.message);
    }
  };

  useEffect(() => {
    fetchBackups();
    fetchMaintenance();
  }, []);

  useRealtimeSync(
    ['backups'],
    () => fetchBackups(true),
    { debounceMs: 250 }
  );

  useRealtimeSync(
    ['maintenance'],
    () => fetchMaintenance(),
    { debounceMs: 200 }
  );

  // ── Handlers: Database Backups ──
  const handleCreateSnapshot = async (format = 'sql') => {
    setCreatingBackup(true);
    try {
      const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/backups/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ format })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create snapshot.');

      showSuccess(`Database snapshot (${data.backup?.sizeFormatted || '14.8 MB'}) generated!`, 'Snapshot Complete');
      fetchBackups();
    } catch (err) {
      showError(err.message, 'Backup Failed');
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleDownloadBackup = async (filename) => {
    try {
      const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/backups/${encodeURIComponent(filename)}/download`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });

      if (!res.ok) throw new Error('Download failed.');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showSuccess(`Downloaded ${filename}`, 'Download Started');
    } catch (err) {
      showError(err.message, 'Download Error');
    }
  };

  const handleDeleteBackup = async (filename) => {
    if (!window.confirm(`Delete database backup archive "${filename}"?`)) return;
    try {
      const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/backups/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      if (!res.ok) throw new Error('Failed to delete backup.');

      showSuccess('Backup archive deleted.', 'Deleted');
      setBackups(prev => prev.filter(b => b.filename !== filename));
    } catch (err) {
      showError(err.message, 'Delete Error');
    }
  };

  // ── Handlers: Maintenance Mode ──
  const handleToggleScope = (scopeId) => {
    setMaintenance(prev => {
      const exists = prev.scope?.includes(scopeId);
      const newScope = exists
        ? prev.scope.filter(s => s !== scopeId)
        : [...(prev.scope || []), scopeId];
      return { ...prev, scope: newScope };
    });
  };

  const handleApplyPreset = (type) => {
    switch (type) {
      case 'ALL':
        setMaintenance(prev => ({
          ...prev,
          scope: ['FULL_PLATFORM', 'PUBLIC_LANDING', 'NGO_ONBOARDING', 'DONOR_PORTAL', 'DONATIONS', 'DONOR_RADAR', 'NGO_PORTAL', 'DISBURSEMENTS', 'CAMPAIGN_CREATION']
        }));
        break;
      case 'DONOR':
        setMaintenance(prev => ({
          ...prev,
          scope: ['DONOR_PORTAL', 'DONATIONS', 'DONOR_RADAR']
        }));
        break;
      case 'NGO':
        setMaintenance(prev => ({
          ...prev,
          scope: ['NGO_PORTAL', 'DISBURSEMENTS', 'CAMPAIGN_CREATION']
        }));
        break;
      case 'FINANCIAL':
        setMaintenance(prev => ({
          ...prev,
          scope: ['DONATIONS', 'DISBURSEMENTS']
        }));
        break;
      case 'CLEAR':
        setMaintenance(prev => ({
          ...prev,
          scope: []
        }));
        break;
      default:
        break;
    }
  };

  const handleTriggerPreview = () => {
    window.dispatchEvent(new CustomEvent('bbdrts_toggle_preview_maintenance', {
      detail: {
        open: true,
        config: {
          ...maintenance,
          startTime: effectiveStartDisplay,
          startTimeIso: effectiveStartIso,
          endTime: effectiveEndDisplay,
          endTimeIso: effectiveEndIso
        }
      }
    }));
  };

  const handleSetStartOffset = (minsFromNow = 0) => {
    const isNow = minsFromNow === 0;
    setFollowLiveStart(isNow);
    const startDate = new Date(Date.now() + minsFromNow * 60000);
    if (!isNow) startDate.setSeconds(0, 0);
    setMaintenance(prev => {
      const existingEndMs = parseMaintMs(prev.endTimeIso, prev.endTime);
      const next = {
        ...prev,
        startTime: formatFriendlyDateTime(startDate),
        startTimeIso: startDate.toISOString()
      };
      if (!isEndOpenEnded) {
        const offsetToKeep = linkedDurationMins || (existingEndMs && existingEndMs <= startDate.getTime() ? 15 : null);
        if (offsetToKeep) {
          const shiftedEnd = new Date(startDate.getTime() + offsetToKeep * 60000);
          next.endTime = formatFriendlyDateTime(shiftedEnd);
          next.endTimeIso = shiftedEnd.toISOString();
          next.autoDeactivate = true;
        }
      }
      return next;
    });
  };

  const handleSetStartNow = () => handleSetStartOffset(0);

  const handleSetDurationFromStart = (durationMins) => {
    setIsEndOpenEnded(false);
    setLinkedDurationMins(durationMins);
    setMaintenance(prev => {
      const now = Date.now();
      const startParsed = parseMaintMs(prev.startTimeIso, prev.startTime);
      const isFutureStart = Boolean(!followLiveStart && startParsed && startParsed > now);
      if (!isFutureStart && !prev.enabled) setFollowLiveStart(true);
      const baseMs = isFutureStart ? startParsed : now;
      const target = new Date(baseMs + durationMins * 60000);
      return {
        ...prev,
        ...(!isFutureStart && !prev.enabled
          ? { startTime: formatFriendlyDateTime(new Date(baseMs)), startTimeIso: new Date(baseMs).toISOString() }
          : {}),
        endTime: formatFriendlyDateTime(target),
        endTimeIso: target.toISOString(),
        autoDeactivate: true
      };
    });
  };

  const handleMakeOpenEnded = () => {
    setLinkedDurationMins(null);
    setIsEndOpenEnded(true);
    setMaintenance(prev => ({
      ...prev,
      endTime: '',
      endTimeIso: '',
      autoDeactivate: false
    }));
  };

  const handleSaveMaintenance = async (e) => {
    e?.preventDefault();
    if (hasInvalidWindow) {
      showWarning('Expected Completion Time must be later than Effective From.', 'Invalid Schedule Window');
      return;
    }
    if (isEndInPast) {
      showWarning('Expected Completion Time is already in the past. Pick a future completion time or disable auto-deactivate.', 'Completion Time Passed');
      return;
    }

    setSavingMaintenance(true);
    try {
      const nowAtSave = new Date();
      const finalStartDate = isLiveStartActive ? nowAtSave : (startMs ? new Date(startMs) : null);
      const finalEndDate = isEndOpenEnded
        ? null
        : (isLinkedEndActive
            ? new Date((finalStartDate ? finalStartDate.getTime() : nowAtSave.getTime()) + activeOffsetMins * 60000)
            : (endMs ? new Date(endMs) : null));
      const payload = {
        ...maintenance,
        startTime: finalStartDate ? formatFriendlyDateTime(finalStartDate) : '',
        startTimeIso: finalStartDate ? finalStartDate.toISOString() : '',
        endTime: finalEndDate ? formatFriendlyDateTime(finalEndDate) : '',
        endTimeIso: finalEndDate ? finalEndDate.toISOString() : '',
        autoDeactivate: finalEndDate ? Boolean(maintenance.autoDeactivate) : false
      };
      const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/maintenance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update maintenance settings.');

      const savedConfig = data.config || payload;
      setMaintenance(savedConfig);
      if (savedConfig.enabled && finalEndDate) {
        setFollowLiveStart(false);
        setLinkedDurationMins(null);
      }
      try {
        localStorage.setItem('bbdrts_maintenance', JSON.stringify(savedConfig));
      } catch (_) {}
      window.dispatchEvent(new CustomEvent('bbdrts_maintenance_changed', { detail: savedConfig }));

      showSuccess(
        data.message || `Maintenance mode ${savedConfig.enabled ? 'saved' : 'deactivated'} successfully!`,
        savedConfig.effectiveState === 'SCHEDULED' ? 'Maintenance Scheduled' : 'Settings Saved'
      );
      if (onMaintenanceStateChange) onMaintenanceStateChange(Boolean(savedConfig.enabled));
    } catch (err) {
      showError(err.message, 'Save Error');
    } finally {
      setSavingMaintenance(false);
    }
  };

  return (
    <div className="bbdrts-maint-panel">
      
      {/* ── Institutional Header Bar ── */}
      <div className="admin-page-header">
        <div className="admin-page-title-wrap">
          <h2 className="admin-page-title">
            <span className="material-symbols-outlined" style={{ fontSize: '24px', color: '#f59e0b' }}>settings_backup_restore</span>
            System Operations
          </h2>
          <p className="admin-page-sub">
            Generate full off-chain database snapshots for regulatory compliance and configure granular maintenance safeguards with zero donor confusion.
          </p>
        </div>

        <div className="admin-page-header-actions">
          {activeSection === 'backups' ? (
            <button
              type="button"
              className="admin-header-btn"
              onClick={() => handleCreateSnapshot('sql')}
              disabled={creatingBackup}
              title="Generate full off-chain SQL snapshot"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>backup</span>
              <span>{creatingBackup ? 'Creating Snapshot...' : 'Create Snapshot'}</span>
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="admin-header-btn secondary"
                onClick={handleTriggerPreview}
                title="Preview what non-admin visitors see"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>visibility</span>
                <span>Preview Screen</span>
              </button>
              <button
                type="button"
                className="admin-header-btn"
                onClick={handleSaveMaintenance}
                disabled={savingMaintenance}
                title="Save maintenance mode configuration"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>save</span>
                <span>{savingMaintenance ? 'Saving...' : 'Save Settings'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Section Navigation Tabs (hidden when embedded in unified Admin hub tabs) */}
      {!forcedSection && (
      <div className="bbdrts-maint-tabs" style={{ marginBottom: '20px' }}>
        <button
          type="button"
          className={`maint-tab-btn ${activeSection === 'backups' ? 'active' : ''}`}
          onClick={() => setActiveSection('backups')}
        >
          <span className="material-symbols-outlined">database</span>
          <span>Database Backups</span>
          <span className="count-pill">{backups.length}</span>
        </button>

        <button
          type="button"
          className={`maint-tab-btn ${activeSection === 'maintenance' ? 'active' : ''}`}
          onClick={() => setActiveSection('maintenance')}
        >
          <span className="material-symbols-outlined">handyman</span>
          <span>Maintenance Mode</span>
          {maintenance.enabled && <span className="status-dot-active" title="Maintenance Mode Active" />}
        </button>
      </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          SECTION 1: DATABASE BACKUPS & RECOVERY
         ══════════════════════════════════════════════════════════════ */}
      {activeSection === 'backups' && (
        <div className="bbdrts-section-content fade-in">
          
          {/* Action Hero Card */}
          <div className="bbdrts-backup-hero-card">
            <div className="hero-left">
              <div className="hero-icon-box">
                <span className="material-symbols-outlined">cloud_sync</span>
              </div>
              <div>
                <h3 className="bbdrts-backup-hero-title">Automated Point-in-Time Database Snapshots</h3>
                <p className="bbdrts-backup-hero-desc">
                  Exports schema DDL and all table rows (Users, Campaigns, Disbursements, Manual Receipts, Audit Logs) into standardized SQL or JSON archives.
                </p>
              </div>
            </div>

            <div className="hero-actions">
              <button
                type="button"
                className="bbdrts-btn-backup-sql"
                onClick={() => handleCreateSnapshot('sql')}
                disabled={creatingBackup}
              >
                <span className="material-symbols-outlined">terminal</span>
                <span>{creatingBackup ? 'Dumping SQL...' : 'Create Snapshot (.sql)'}</span>
              </button>

              <button
                type="button"
                className="bbdrts-btn-backup-json"
                onClick={() => handleCreateSnapshot('json')}
                disabled={creatingBackup}
              >
                <span className="material-symbols-outlined">data_object</span>
                <span>{creatingBackup ? 'Exporting...' : 'Export JSON (.json)'}</span>
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="bbdrts-table-container">
            <div className="table-top-bar">
              <span className="table-top-title">ARCHIVED DATABASE BACKUP SNAPSHOTS</span>
              <button
                type="button"
                className="btn-sync-backups"
                onClick={fetchBackups}
                disabled={backupsLoading}
              >
                <span className={`material-symbols-outlined ${backupsLoading ? 'spinning' : ''}`}>sync</span>
                <span>Refresh</span>
              </button>
            </div>

            <table className="bbdrts-maint-table">
              <thead>
                <tr>
                  <th>Backup Date (PHT)</th>
                  <th>Archive File Name</th>
                  <th style={{ width: '100px' }}>File Size</th>
                  <th style={{ width: '90px' }}>Format</th>
                  <th style={{ width: '100px' }}>Status</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {backupsLoading && (
                  <tr>
                    <td colSpan="6" className="table-empty">
                      <div className="table-loading-spinner" />
                      <span>Scanning backup directory...</span>
                    </td>
                  </tr>
                )}

                {!backupsLoading && backups.length === 0 && (
                  <tr>
                    <td colSpan="6" className="table-empty">
                      <span className="material-symbols-outlined empty-icon">folder_off</span>
                      <strong>No database snapshots generated yet</strong>
                      <span className="sub">Click &quot;Create Snapshot (.sql)&quot; above to archive your current database state.</span>
                    </td>
                  </tr>
                )}

                {!backupsLoading && backups.map((b) => (
                  <tr key={b.filename}>
                    <td>
                      <span className="backup-date">
                        {new Date(b.createdAt).toLocaleString('en-PH', {
                          timeZone: 'Asia/Manila',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: true
                        })}
                      </span>
                    </td>

                    <td>
                      <div className="filename-cell">
                        <span className="material-symbols-outlined icon">description</span>
                        <strong className="name" title={b.filename}>{b.filename}</strong>
                      </div>
                    </td>

                    <td>
                      <span className="backup-size">{b.sizeFormatted}</span>
                    </td>

                    <td>
                      <span className={`format-pill ${b.format}`}>
                        .{b.format}
                      </span>
                    </td>

                    <td>
                      <span className="status-complete-pill">
                        <span className="material-symbols-outlined">check_circle</span>
                        <span>Complete</span>
                      </span>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div className="table-action-btns">
                        <button
                          type="button"
                          className="btn-tbl-download"
                          onClick={() => handleDownloadBackup(b.filename)}
                          title="Download backup archive"
                        >
                          <span className="material-symbols-outlined">download</span>
                        </button>
                        <button
                          type="button"
                          className="btn-tbl-del"
                          onClick={() => handleDeleteBackup(b.filename)}
                          title="Delete snapshot"
                        >
                          <span className="material-symbols-outlined">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          SECTION 2: MAINTENANCE MODE CONFIGURATION (Vercel Geist Operations UI)
         ══════════════════════════════════════════════════════════════ */}
      {activeSection === 'maintenance' && (
        <form onSubmit={handleSaveMaintenance} className="bbdrts-maint-clean-form fade-in">

          {/* Master Status Control Bar */}
          <div className={`bbdrts-maint-status-banner ${schedulePhase === 'ACTIVE' ? 'active' : schedulePhase === 'SCHEDULED' ? 'scheduled' : 'inactive'}`}>
            <div className="banner-left">
              <div className="status-icon-wrap">
                <span className="material-symbols-outlined">
                  {schedulePhase === 'ACTIVE' ? 'construction' : schedulePhase === 'SCHEDULED' ? 'schedule' : 'check_circle'}
                </span>
              </div>
              <div>
                <div className="status-title-row">
                  <strong className="status-title">
                    {schedulePhase === 'SCHEDULED'
                      ? `Scheduled Maintenance · Starts in ${formatDurationShort(startMs - liveNowMs)}`
                      : schedulePhase === 'ACTIVE'
                        ? 'Platform Maintenance Active'
                        : 'All Systems Operational'}
                  </strong>
                  <span className={`maint-phase-pill is-${schedulePhase.toLowerCase()}`}>
                    <span className="maint-phase-dot" />
                    <span>{schedulePhase === 'SCHEDULED' ? 'Armed' : schedulePhase === 'ACTIVE' ? 'Lockdown Live' : 'Normal'}</span>
                  </span>
                </div>
                <p className="status-sub">
                  {schedulePhase === 'SCHEDULED'
                    ? `Armed for ${maintenance.startTime}. Visitors see a non-blocking countdown bar until start time, then enter maintenance automatically.`
                    : schedulePhase === 'ACTIVE'
                      ? (endMs && maintenance.autoDeactivate
                          ? `Non-admin visitors are restricted · Auto-restores & refreshes users in ${formatDurationShort(endMs - liveNowMs)}.`
                          : 'Non-admin visitors are currently restricted according to the selected scope below. Administrators retain full access.')
                      : 'Toggle on to activate immediately or arm a scheduled maintenance window below.'}
                </p>
              </div>
            </div>

            <div className="banner-right-toggle">
              <span className="banner-toggle-state">{maintenance.enabled ? 'Armed / On' : 'Off'}</span>
              <label className="bbdrts-switch" aria-label="Toggle Maintenance Mode">
                <input
                  type="checkbox"
                  checked={maintenance.enabled}
                  onChange={e => setMaintenance(prev => ({ ...prev, enabled: e.target.checked }))}
                />
                <span className="slider round" />
              </label>
            </div>
          </div>

          {/* Dual Column Workspace: Left Controls + Right Sticky Live Visitor Preview */}
          <div className="bbdrts-maint-dual-grid">

            {/* ── LEFT COLUMN: Ordered by Operator Priority ── */}
            <div className="maint-grid-left">

              {/* 1. Schedule Window (Primary Action) */}
              <div className="bbdrts-maint-section-card">
                <div className="section-card-header">
                  <div className="header-title-row">
                    <div className="section-icon-badge is-blue">
                      <span className="material-symbols-outlined">calendar_clock</span>
                    </div>
                    <div>
                      <h4 className="section-title">Schedule Window</h4>
                      <p className="section-sub">Auto-starts at Effective From and auto-restores users at Expected Completion</p>
                    </div>
                  </div>
                </div>

                <div className="schedule-clean-grid">
                  {/* Effective From */}
                  <div className="schedule-clean-col">
                    <div className="schedule-col-head">
                      <label className="clean-label">
                        <span>Effective From</span>
                      </label>
                      <div className="schedule-quick-chips">
                        <button
                          type="button"
                          className={`btn-set-now${isLiveStartActive ? ' is-live-active' : ''}`}
                          onClick={() => handleSetStartOffset(0)}
                          title="Follow live system clock"
                        >
                          {isLiveStartActive && <span className="live-chip-dot" />}
                          <span>Now</span>
                        </button>
                        <button type="button" className="btn-set-now" onClick={() => handleSetStartOffset(2)}>+2m</button>
                        <button type="button" className="btn-set-now" onClick={() => handleSetStartOffset(5)}>+5m</button>
                        <button type="button" className="btn-set-now" onClick={() => handleSetStartOffset(15)}>+15m</button>
                      </div>
                    </div>

                    <CustomDateTimePicker
                      value={effectiveStartDisplay}
                      onChange={(formattedStr, dateObj) => {
                        if (!formattedStr || !dateObj || isNaN(dateObj.getTime())) {
                          setFollowLiveStart(true);
                          setMaintenance(prev => ({ ...prev, startTime: '', startTimeIso: '' }));
                          return;
                        }
                        const isFuture = dateObj.getTime() > Date.now() + 30000;
                        setFollowLiveStart(!isFuture);
                        setMaintenance(prev => {
                          const next = {
                            ...prev,
                            startTime: formattedStr,
                            startTimeIso: dateObj.toISOString()
                          };
                          if (!isEndOpenEnded) {
                            const prevEnd = parseMaintMs(prev.endTimeIso, prev.endTime);
                            const offsetToKeep = linkedDurationMins || (prevEnd && prevEnd <= dateObj.getTime() ? 15 : null);
                            if (offsetToKeep) {
                              const shifted = new Date(dateObj.getTime() + offsetToKeep * 60000);
                              next.endTime = formatFriendlyDateTime(shifted);
                              next.endTimeIso = shifted.toISOString();
                              next.autoDeactivate = true;
                            }
                          }
                          return next;
                        });
                      }}
                      placeholder="Following live time..."
                      icon="schedule"
                      showPresets={false}
                    />
                    <span className={`field-caption${isLiveStartActive ? ' is-live' : ''}`}>
                      {isLiveStartActive
                        ? `Live · ${new Date(liveNowMs).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })} · Starts immediately once armed`
                        : startMs && startMs > liveNowMs
                          ? `Auto-activates in ${formatDurationShort(startMs - liveNowMs)}`
                          : `Started ${maintenance.startTime}`}
                    </span>
                  </div>

                  {/* Expected Completion Time */}
                  <div className="schedule-clean-col">
                    <div className="schedule-col-head">
                      <label className="clean-label">
                        <span>Expected Completion</span>
                      </label>
                      <div className="schedule-quick-chips">
                        {[
                          { mins: 2, label: '+2m' },
                          { mins: 5, label: '+5m' },
                          { mins: 15, label: '+15m' },
                          { mins: 30, label: '+30m' },
                          { mins: 60, label: '+1h' }
                        ].map((opt) => {
                          const isActiveChip = Boolean(isLinkedEndActive && activeOffsetMins === opt.mins);
                          return (
                            <button
                              key={opt.mins}
                              type="button"
                              className={`btn-set-now is-end${isActiveChip ? ' is-end-active' : ''}`}
                              onClick={() => handleSetDurationFromStart(opt.mins)}
                              title={`Keep Expected Completion ${opt.label} ahead of Effective From`}
                            >
                              {isActiveChip && <span className="live-chip-dot" />}
                              <span>{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <CustomDateTimePicker
                      value={effectiveEndDisplay}
                      onChange={(formattedStr, dateObj) => {
                        if (!formattedStr || !dateObj || isNaN(dateObj.getTime())) {
                          handleMakeOpenEnded();
                          return;
                        }
                        setIsEndOpenEnded(false);
                        setLinkedDurationMins(null);
                        setMaintenance(prev => ({
                          ...prev,
                          endTime: formattedStr,
                          endTimeIso: dateObj.toISOString(),
                          autoDeactivate: true
                        }));
                      }}
                      placeholder="Open-ended (no completion time)..."
                      icon="event_available"
                      highlight={!hasInvalidWindow && !isEndPastNow && Boolean(endMs)}
                      invalid={hasInvalidWindow || isEndPastNow}
                      showPresets={false}
                      align="right"
                    />
                    <span className={`field-caption${hasInvalidWindow || isEndPastNow ? ' is-error' : ''}`}>
                      {hasInvalidWindow
                        ? 'Must be later than Effective From'
                        : isEndPastNow
                          ? 'Completion time has already passed'
                          : isLinkedEndActive
                            ? `Tracks +${activeOffsetMins >= 60 ? `${activeOffsetMins / 60}h` : `${activeOffsetMins}m`} ahead of Effective From`
                            : endMs
                              ? `Duration: ${formatDurationShort(endMs - (startMs && startMs > liveNowMs ? startMs : liveNowMs))}`
                              : 'Open-ended until turned off manually'}
                    </span>
                  </div>
                </div>

                {/* Live Schedule Window Validation & Telemetry Strip */}
                <div className={`maint-schedule-summary ${hasInvalidWindow || isEndPastNow ? 'is-error' : schedulePhase === 'SCHEDULED' || (startMs && startMs > liveNowMs) ? 'is-scheduled' : endMs ? 'is-ok' : 'is-neutral'}`}>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', flexShrink: 0, marginTop: '1px' }}>
                    {hasInvalidWindow || isEndPastNow ? 'error' : (startMs && startMs > liveNowMs) ? 'schedule_send' : endMs ? 'event_available' : 'all_inclusive'}
                  </span>
                  <div className="maint-schedule-summary-body">
                    <div className="maint-schedule-summary-text">
                      {hasInvalidWindow ? (
                        <>
                          <strong>Invalid schedule window:</strong> Expected Completion must be later than Effective From.
                        </>
                      ) : isEndPastNow ? (
                        <>
                          <strong>Completion time has passed:</strong> {effectiveEndDisplay || maintenance.endTime} is in the past. Set a future completion time or make it open-ended.
                        </>
                      ) : startMs && startMs > liveNowMs ? (
                        <>
                          <strong>Scheduled Window Ready:</strong> Starts automatically in <strong>{formatDurationShort(startMs - liveNowMs)}</strong>
                          {endMs ? <> · Duration: <strong>{formatDurationShort(endMs - startMs)}</strong></> : null}
                          {endMs && maintenance.autoDeactivate ? ' · Auto-restores users at completion.' : '.'}
                        </>
                      ) : endMs && endMs > liveNowMs ? (
                        <>
                          <strong>Timed Window Ready:</strong> Starts immediately and finishes in <strong>{formatDurationShort(endMs - liveNowMs)}</strong>
                          {maintenance.autoDeactivate ? ' · Users auto-refresh back into the live app.' : '.'}
                        </>
                      ) : (
                        <>
                          <strong>Open-Ended Window:</strong> Runs immediately when armed until manually turned off.
                        </>
                      )}
                    </div>

                    {(hasInvalidWindow || isEndPastNow) && (
                      <div className="maint-schedule-fix-actions">
                        <button
                          type="button"
                          className="maint-schedule-fix-btn"
                          onClick={() => handleSetDurationFromStart(15)}
                        >
                          Set +15m
                        </button>
                        <button
                          type="button"
                          className="maint-schedule-fix-btn is-subtle"
                          onClick={handleMakeOpenEnded}
                        >
                          Make Open-Ended
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <label className="auto-deactivate-tile">
                  <input
                    type="checkbox"
                    checked={Boolean(maintenance.autoDeactivate)}
                    onChange={e => setMaintenance(prev => ({ ...prev, autoDeactivate: e.target.checked }))}
                  />
                  <div>
                    <div className="auto-deact-title">Auto-restore &amp; auto-refresh users at completion time</div>
                    <div className="auto-deact-sub">Ends platform lockdown automatically and reloads visitor sessions when the window closes.</div>
                  </div>
                </label>
              </div>

              {/* 2. Target Scope & Access Control (Compact 2-Column Selectable Tiles) */}
              <div className="bbdrts-maint-section-card">
                <div className="section-card-header">
                  <div className="header-title-row">
                    <div className="section-icon-badge is-amber">
                      <span className="material-symbols-outlined">tune</span>
                    </div>
                    <div>
                      <h4 className="section-title">Target Scope &amp; Portals</h4>
                      <p className="section-sub">Choose which portals or features are restricted during maintenance</p>
                    </div>
                  </div>

                  <div className="bbdrts-maint-presets-strip">
                    <button type="button" className="preset-pill-btn" onClick={() => handleApplyPreset('ALL')}>Full Platform</button>
                    <button type="button" className="preset-pill-btn" onClick={() => handleApplyPreset('DONOR')}>Donors</button>
                    <button type="button" className="preset-pill-btn" onClick={() => handleApplyPreset('NGO')}>NGOs</button>
                    <button type="button" className="preset-pill-btn" onClick={() => handleApplyPreset('FINANCIAL')}>Financial</button>
                    <button type="button" className="preset-pill-btn clear" onClick={() => handleApplyPreset('CLEAR')}>Clear</button>
                  </div>
                </div>

                <div className="scopes-compact-groups">
                  {MAINTENANCE_CATEGORIES.map(cat => (
                    <div key={cat.category} className="scope-compact-group">
                      <div className="scope-group-divider">
                        <span className="material-symbols-outlined group-icon">{cat.icon}</span>
                        <span className="group-heading">{cat.category}</span>
                      </div>

                      <div className="scope-tiles-grid">
                        {cat.items.map(opt => {
                          const isChecked = maintenance.scope?.includes(opt.id);
                          return (
                            <label
                              key={opt.id}
                              className={`scope-card-tile ${isChecked ? 'is-selected' : ''} ${opt.critical ? 'is-critical' : ''}`}
                            >
                              <input
                                type="checkbox"
                                className="scope-checkbox-native"
                                checked={isChecked}
                                onChange={() => handleToggleScope(opt.id)}
                              />
                              <div className="scope-tile-ico">
                                <span className="material-symbols-outlined">{opt.icon}</span>
                              </div>
                              <div className="scope-tile-copy">
                                <div className="scope-tile-top">
                                  <span className="scope-row-label">{opt.label}</span>
                                  {opt.critical && <span className="scope-row-badge">ALL</span>}
                                </div>
                                <span className="scope-row-sub">{opt.desc}</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Public Notice & Explanation */}
              <div className="bbdrts-maint-section-card">
                <div className="section-card-header">
                  <div className="header-title-row">
                    <div className="section-icon-badge is-neutral">
                      <span className="material-symbols-outlined">chat</span>
                    </div>
                    <div>
                      <h4 className="section-title">Public Notice &amp; Explanation</h4>
                      <p className="section-sub">Displayed prominently on the visitor maintenance screen</p>
                    </div>
                  </div>
                </div>

                <div className="form-fields-clean-stack">
                  <div className="clean-field-group">
                    <label htmlFor="maint-title" className="clean-label">
                      <span>Display Heading</span>
                      <span className="req">*</span>
                    </label>
                    <input
                      id="maint-title"
                      type="text"
                      className="clean-text-input"
                      placeholder="e.g. System Under Scheduled Maintenance"
                      value={maintenance.title}
                      onChange={e => setMaintenance(prev => ({ ...prev, title: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="clean-field-group">
                    <label htmlFor="maint-msg" className="clean-label">
                      <span>Public Explanation</span>
                      <span className="req">*</span>
                    </label>
                    <textarea
                      id="maint-msg"
                      className="clean-textarea"
                      rows={3}
                      placeholder="Explain why maintenance is happening and reassure donors that records remain safe on-chain..."
                      value={maintenance.message}
                      onChange={e => setMaintenance(prev => ({ ...prev, message: e.target.value }))}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* 4. Emergency Support Contact */}
              <div className="bbdrts-maint-section-card">
                <div className="section-card-header">
                  <div className="header-title-row">
                    <div className="section-icon-badge is-emerald">
                      <span className="material-symbols-outlined">support_agent</span>
                    </div>
                    <div>
                      <h4 className="section-title">Operations Support Contact</h4>
                      <p className="section-sub">Assistance details displayed in the maintenance screen footer</p>
                    </div>
                  </div>
                </div>

                <div className="contact-clean-grid">
                  <div className="clean-field-group">
                    <label htmlFor="maint-person" className="clean-label">Support Unit</label>
                    <input
                      id="maint-person"
                      type="text"
                      className="clean-text-input"
                      placeholder="Disaster Relief IT Support"
                      value={maintenance.contactPerson}
                      onChange={e => setMaintenance(prev => ({ ...prev, contactPerson: e.target.value }))}
                    />
                  </div>

                  <div className="clean-field-group">
                    <label htmlFor="maint-email" className="clean-label">Support Email</label>
                    <input
                      id="maint-email"
                      type="email"
                      className="clean-text-input"
                      placeholder="bbdrts@gmail.com"
                      value={maintenance.contactEmail}
                      onChange={e => setMaintenance(prev => ({ ...prev, contactEmail: e.target.value }))}
                    />
                  </div>

                  <div className="clean-field-group">
                    <label htmlFor="maint-phone" className="clean-label">Hotline</label>
                    <input
                      id="maint-phone"
                      type="text"
                      className="clean-text-input"
                      placeholder="0992 982 4615"
                      value={maintenance.contactPhone}
                      onChange={e => setMaintenance(prev => ({ ...prev, contactPhone: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* ── RIGHT COLUMN: Sticky Live Visitor Preview & Quick Save ── */}
            <div className="maint-grid-right">
              <div className="maint-sticky-preview">

                <div className="preview-top-head">
                  <div className="preview-head-left">
                    <span className="material-symbols-outlined icon">visibility</span>
                    <strong className="preview-head-title">Live Visitor Preview</strong>
                  </div>
                  <span className="live-sync-badge">
                    <span className="live-sync-dot" />
                    <span>SYNCED</span>
                  </span>
                </div>

                {/* Browser-Frame Mini Preview */}
                <div className="sim-browser-shell">
                  <div className="sim-browser-bar">
                    <div className="sim-browser-dots" aria-hidden="true">
                      <span /><span /><span />
                    </div>
                    <span className="sim-browser-url">bbdrts / status</span>
                    <span className={`sim-browser-state is-${schedulePhase.toLowerCase()}`}>
                      {schedulePhase}
                    </span>
                  </div>

                  <div className="simulated-maint-card geist-sim">
                    <div className="sim-icon-box">
                      <span className="material-symbols-outlined">construction</span>
                    </div>

                    <div className="sim-geist-status-pill">
                      <span className="sim-geist-dot" />
                      <span>{schedulePhase === 'SCHEDULED' ? 'Scheduled Window' : 'Scheduled Maintenance'}</span>
                    </div>

                    <h4 className="sim-title">
                      {maintenance.title || 'System Under Scheduled Maintenance'}
                    </h4>

                    <p className="sim-sec-desc sim-hero-desc">
                      {maintenance.message || 'Our platform services are currently undergoing maintenance to enhance reliability and smart contract security.'}
                    </p>

                    <div className="sim-bento">
                      <div className="sim-times-row">
                        <div className="sim-time-box">
                          <span className="time-lbl">Started</span>
                          <strong className="time-val">{effectiveStartDisplay || 'In Progress'}</strong>
                        </div>
                        <div className="sim-time-box highlight">
                          <span className="time-lbl">Completion</span>
                          <strong className="time-val">{effectiveEndDisplay || 'Shortly'}</strong>
                        </div>
                      </div>

                      {(startMs && startMs > liveNowMs) ? (
                        <div className="sim-countdown-strip">
                          <span>Starts in</span>
                          <strong>{formatDurationShort(startMs - liveNowMs)}</strong>
                        </div>
                      ) : (endMs && endMs > liveNowMs) ? (
                        <div className="sim-countdown-strip">
                          <span>Remaining</span>
                          <strong>{formatDurationShort(endMs - liveNowMs)}</strong>
                        </div>
                      ) : null}
                    </div>

                    {maintenance.scope && maintenance.scope.length > 0 && !maintenance.scope.includes('FULL_PLATFORM') && (
                      <div className="sim-scope-note">
                        <span className="scope-lbl">TARGETED SCOPE</span>
                        <div className="sim-scope-tags">
                          {maintenance.scope.map(s => (
                            <span key={s} className="sim-scope-tag">{s.replace(/_/g, ' ')}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="sim-footer">
                      <div className="sim-footer-contact">
                        <span className="material-symbols-outlined">headset_mic</span>
                        <span>{maintenance.contactPerson || 'Operations Support'}</span>
                      </div>
                      <div className="sim-footer-details">
                        {maintenance.contactPhone && <span>{maintenance.contactPhone}</span>}
                        {maintenance.contactPhone && maintenance.contactEmail && <span>·</span>}
                        {maintenance.contactEmail && <span>{maintenance.contactEmail}</span>}
                      </div>
                      <div className="sim-footer-telemetry">
                        <span className="telemetry-dot" />
                        <span>{maintenance.autoDeactivate && endMs ? 'Auto-refreshes users on completion' : 'Real-time SSE sync active'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Direct Sticky Actions */}
                <div className="preview-sticky-actions">
                  <button
                    type="submit"
                    className="btn-save-maintenance is-full"
                    disabled={savingMaintenance || hasInvalidWindow || isEndInPast}
                  >
                    <span className="material-symbols-outlined">save</span>
                    <span>
                      {savingMaintenance
                        ? 'Saving Configuration…'
                        : schedulePhase === 'SCHEDULED'
                          ? 'Save & Arm Schedule'
                          : maintenance.enabled
                            ? 'Save & Activate Maintenance'
                            : 'Save Settings'}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="btn-open-fullscreen-sim"
                    onClick={handleTriggerPreview}
                    title="Preview fullscreen maintenance screen"
                  >
                    <span className="material-symbols-outlined">open_in_new</span>
                    <span>Open Fullscreen Preview</span>
                  </button>
                </div>

              </div>
            </div>

          </div>

        </form>
      )}
    </div>
  );
}
