import { useState, useEffect } from 'react';
import { API_URL } from '../config';
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
        label: 'Donation Gateway (Crypto Escrow & Manual Fiat)',
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
  const d = new Date(val);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

export default function AdminMaintenancePanel({ onMaintenanceStateChange }) {
  const { showSuccess, showError, showWarning } = useToast();
  const [activeSection, setActiveSection] = useState('backups'); // 'backups' | 'maintenance'

  // ── Database Backups State ──
  const [backups, setBackups] = useState([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);

  // ── Maintenance Mode State ──
  const [maintenance, setMaintenance] = useState({
    enabled: false,
    autoDeactivate: false,
    scope: [],
    title: 'System Under Scheduled Maintenance',
    message: 'Our platform services are currently undergoing maintenance to enhance reliability and smart contract security. Essential relief tracking remains recorded on-chain.',
    startTime: '',
    endTime: '',
    contactPerson: 'Disaster Relief IT Support',
    contactEmail: 'support@bbdrts.gov.ph',
    contactPhone: '(053) 832-1923'
  });
  const [savingMaintenance, setSavingMaintenance] = useState(false);

  // Fetch Backups
  const fetchBackups = async () => {
    setBackupsLoading(true);
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
      setBackupsLoading(false);
    }
  };

  // Fetch Maintenance Mode
  const fetchMaintenance = async () => {
    try {
      const res = await fetch(`${API_URL}/api/system/maintenance`);
      if (res.ok) {
        const data = await res.json();
        setMaintenance(data);
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
      detail: { open: true, config: maintenance }
    }));
  };

  const handleSetStartNow = () => {
    const now = new Date();
    setMaintenance(prev => ({
      ...prev,
      startTime: formatFriendlyDateTime(now)
    }));
  };

  const handleSetPresetEnd = (mins) => {
    const target = new Date();
    target.setMinutes(target.getMinutes() + mins);
    setMaintenance(prev => ({
      ...prev,
      endTime: formatFriendlyDateTime(target)
    }));
  };

  const handleSetPresetEndTomorrow = (hour = 9) => {
    const target = new Date();
    target.setDate(target.getDate() + 1);
    target.setHours(hour, 0, 0, 0);
    setMaintenance(prev => ({
      ...prev,
      endTime: formatFriendlyDateTime(target)
    }));
  };

  const handleSaveMaintenance = async (e) => {
    e?.preventDefault();
    setSavingMaintenance(true);
    try {
      const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/maintenance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(maintenance)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update maintenance settings.');

      const savedConfig = data.config || maintenance;
      try {
        localStorage.setItem('bbdrts_maintenance', JSON.stringify(savedConfig));
      } catch (_) {}
      window.dispatchEvent(new CustomEvent('bbdrts_maintenance_changed', { detail: savedConfig }));

      showSuccess(`Maintenance mode ${maintenance.enabled ? 'activated' : 'deactivated'} successfully!`, 'Settings Saved');
      if (onMaintenanceStateChange) onMaintenanceStateChange(maintenance.enabled);
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

      {/* Section Navigation Tabs (Segmented bar below header line) */}
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
          SECTION 2: MAINTENANCE MODE CONFIGURATION (Clean, Flat, No Card Overload)
         ══════════════════════════════════════════════════════════════ */}
      {activeSection === 'maintenance' && (
        <form onSubmit={handleSaveMaintenance} className="bbdrts-maint-clean-form fade-in">
          
          {/* Master Enable Banner */}
          <div className={`bbdrts-maint-status-banner ${maintenance.enabled ? 'active' : 'inactive'}`}>
            <div className="banner-left">
              <div className="status-icon-wrap">
                <span className="material-symbols-outlined">
                  {maintenance.enabled ? 'construction' : 'check_circle'}
                </span>
              </div>
              <div>
                <strong className="status-title">
                  Maintenance Mode: {maintenance.enabled ? 'ACTIVE (RESTRICTED ACCESS)' : 'DISABLED (NORMAL OPERATIONS)'}
                </strong>
                <p className="status-sub">
                  {maintenance.enabled
                    ? 'Non-admin visitors are currently restricted according to the scope configured below. Administrators retain full access.'
                    : 'All disaster relief campaigns, blockchain escrow releases, and donation gateways are operating normally.'}
                </p>
              </div>
            </div>

            <label className="bbdrts-switch">
              <input
                type="checkbox"
                checked={maintenance.enabled}
                onChange={e => setMaintenance(prev => ({ ...prev, enabled: e.target.checked }))}
              />
              <span className="slider round" />
            </label>
          </div>

          {/* Dual Column Layout: Left Form + Right Sticky Live User Preview */}
          <div className="bbdrts-maint-dual-grid">

            {/* ── LEFT COLUMN: Clean Form Canvas (Flat, No Nested Cards) ── */}
            <div className="maint-grid-left">

              {/* 1. Maintenance Scope Section (Flat List, No Nested Cards) */}
              <div className="bbdrts-maint-section-card">
                <div className="section-card-header">
                  <div className="header-title-row">
                    <span className="material-symbols-outlined icon">checklist</span>
                    <div>
                      <h4 className="section-title">Maintenance Scope &amp; Target Areas</h4>
                      <p className="section-sub">Select which user portals and operational services are restricted to non-admin users</p>
                    </div>
                  </div>

                  {/* Quick Presets Strip */}
                  <div className="bbdrts-maint-presets-strip">
                    <span className="presets-label">Presets:</span>
                    <button
                      type="button"
                      className="preset-pill-btn"
                      onClick={() => handleApplyPreset('ALL')}
                      title="Lock down entire platform for all users except administrators"
                    >
                      <span className="material-symbols-outlined">lock</span>
                      <span>Full Platform</span>
                    </button>
                    <button
                      type="button"
                      className="preset-pill-btn"
                      onClick={() => handleApplyPreset('DONOR')}
                      title="Restrict all donor dashboard pages, donations, and radar"
                    >
                      <span className="material-symbols-outlined">volunteer_activism</span>
                      <span>Donors Only</span>
                    </button>
                    <button
                      type="button"
                      className="preset-pill-btn"
                      onClick={() => handleApplyPreset('NGO')}
                      title="Restrict all NGO operations, disbursements, and deployments"
                    >
                      <span className="material-symbols-outlined">corporate_fare</span>
                      <span>NGOs Only</span>
                    </button>
                    <button
                      type="button"
                      className="preset-pill-btn"
                      onClick={() => handleApplyPreset('FINANCIAL')}
                      title="Pause incoming donations and outgoing disbursements"
                    >
                      <span className="material-symbols-outlined">payments</span>
                      <span>Financial Only</span>
                    </button>
                    <button
                      type="button"
                      className="preset-pill-btn clear"
                      onClick={() => handleApplyPreset('CLEAR')}
                      title="Deselect all modules"
                    >
                      <span>Clear</span>
                    </button>
                  </div>
                </div>

                {/* Flat Categorized Rows */}
                <div className="scopes-flat-container">
                  {MAINTENANCE_CATEGORIES.map(cat => (
                    <div key={cat.category} className="scope-flat-group">
                      <div className="scope-group-divider">
                        <span className="material-symbols-outlined group-icon">{cat.icon}</span>
                        <span className="group-heading">{cat.category}</span>
                        <span className="group-desc">— {cat.description}</span>
                      </div>

                      <div className="scope-flat-rows">
                        {cat.items.map(opt => {
                          const isChecked = maintenance.scope?.includes(opt.id);
                          return (
                            <label
                              key={opt.id}
                              className={`scope-flat-row ${isChecked ? 'selected' : ''}`}
                            >
                              <input
                                type="checkbox"
                                className="scope-checkbox-native"
                                checked={isChecked}
                                onChange={() => handleToggleScope(opt.id)}
                              />
                              <span className="material-symbols-outlined scope-row-icon">
                                {opt.icon}
                              </span>
                              <div className="scope-row-body">
                                <div className="scope-row-title-line">
                                  <span className="scope-row-label">{opt.label}</span>
                                  {opt.critical && <span className="scope-row-badge">PLATFORM-WIDE</span>}
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

              {/* 2. Message & Narrative Section */}
              <div className="bbdrts-maint-section-card">
                <div className="section-card-header">
                  <div className="header-title-row">
                    <span className="material-symbols-outlined icon">chat</span>
                    <div>
                      <h4 className="section-title">Public Notice &amp; Explanation</h4>
                      <p className="section-sub">Clear explanation preserves donor confidence during scheduled downtime</p>
                    </div>
                  </div>
                </div>

                <div className="form-fields-clean-stack">
                  <div className="clean-field-group">
                    <label htmlFor="maint-title" className="clean-label">
                      <span>Display Title / Main Heading</span>
                      <span className="req">*</span>
                    </label>
                    <input
                      id="maint-title"
                      type="text"
                      className="clean-text-input"
                      placeholder="e.g. SYSTEM UNDER SCHEDULED MAINTENANCE"
                      value={maintenance.title}
                      onChange={e => setMaintenance(prev => ({ ...prev, title: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="clean-field-group">
                    <label htmlFor="maint-msg" className="clean-label">
                      <span>Detailed Public Explanation</span>
                      <span className="req">*</span>
                    </label>
                    <textarea
                      id="maint-msg"
                      className="clean-textarea"
                      rows={3}
                      placeholder="e.g. Platform services are currently undergoing maintenance to enhance reliability and smart contract security..."
                      value={maintenance.message}
                      onChange={e => setMaintenance(prev => ({ ...prev, message: e.target.value }))}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* 3. Schedule Window (Custom Date & Time Picker) */}
              <div className="bbdrts-maint-section-card">
                <div className="section-card-header">
                  <div className="header-title-row">
                    <span className="material-symbols-outlined icon">calendar_clock</span>
                    <div>
                      <h4 className="section-title">Maintenance Schedule Window</h4>
                      <p className="section-sub">Set when maintenance began and the target completion time</p>
                    </div>
                  </div>
                </div>

                <div className="schedule-clean-grid">
                  {/* Started Time */}
                  <div className="schedule-clean-col">
                    <div className="schedule-col-head">
                      <label className="clean-label">
                        <span className="material-symbols-outlined">schedule</span>
                        <span>Maintenance Started (Effective From)</span>
                      </label>
                      <button
                        type="button"
                        className="btn-set-now"
                        onClick={handleSetStartNow}
                        title="Stamp current instant as start time"
                      >
                        <span className="material-symbols-outlined">update</span>
                        <span>Set to Now</span>
                      </button>
                    </div>

                    <CustomDateTimePicker
                      value={maintenance.startTime}
                      onChange={(formattedStr) => {
                        setMaintenance(prev => ({
                          ...prev,
                          startTime: formattedStr
                        }));
                      }}
                      placeholder="Select start date & time (or Leave empty for In Progress)..."
                      icon="schedule"
                      showPresets={false}
                    />
                    <span className="field-caption">
                      Displayed as &quot;{maintenance.startTime || 'In Progress (Immediate)'}&quot; on public screen.
                    </span>
                  </div>

                  {/* Expected Completion Time */}
                  <div className="schedule-clean-col">
                    <div className="schedule-col-head">
                      <label className="clean-label">
                        <span className="material-symbols-outlined highlight">event_available</span>
                        <span>Expected Completion Time</span>
                      </label>
                      <span className="custom-picker-tag">Custom Calendar &amp; Time</span>
                    </div>

                    <CustomDateTimePicker
                      value={maintenance.endTime}
                      onChange={(formattedStr) => {
                        setMaintenance(prev => ({
                          ...prev,
                          endTime: formattedStr
                        }));
                      }}
                      placeholder="Select completion date & time..."
                      icon="event_available"
                      highlight={true}
                      showPresets={true}
                      align="right"
                    />
                    <span className="field-caption">
                      Displayed as &quot;{maintenance.endTime || 'Expected Shortly'}&quot; on public screen.
                    </span>
                  </div>
                </div>

                <div className="auto-deactivate-row">
                  <label className="auto-deactivate-checkbox-label">
                    <input
                      type="checkbox"
                      checked={Boolean(maintenance.autoDeactivate)}
                      onChange={e => setMaintenance(prev => ({ ...prev, autoDeactivate: e.target.checked }))}
                    />
                    <span>Auto-deactivate platform lockdown when completion time arrives (Optional)</span>
                  </label>
                </div>
              </div>

              {/* 4. Emergency Support Contact */}
              <div className="bbdrts-maint-section-card">
                <div className="section-card-header">
                  <div className="header-title-row">
                    <span className="material-symbols-outlined icon">support_agent</span>
                    <div>
                      <h4 className="section-title">Emergency Operations Support Contact</h4>
                      <p className="section-sub">Direct assistance channels displayed on the maintenance screen for NGOs and donors</p>
                    </div>
                  </div>
                </div>

                <div className="contact-clean-grid">
                  <div className="clean-field-group">
                    <label htmlFor="maint-person" className="clean-label">Contact Unit / Person</label>
                    <input
                      id="maint-person"
                      type="text"
                      className="clean-text-input"
                      placeholder="e.g. Disaster Relief IT Support"
                      value={maintenance.contactPerson}
                      onChange={e => setMaintenance(prev => ({ ...prev, contactPerson: e.target.value }))}
                    />
                  </div>

                  <div className="clean-field-group">
                    <label htmlFor="maint-email" className="clean-label">Contact Email</label>
                    <input
                      id="maint-email"
                      type="email"
                      className="clean-text-input"
                      placeholder="e.g. support@bbdrts.gov.ph"
                      value={maintenance.contactEmail}
                      onChange={e => setMaintenance(prev => ({ ...prev, contactEmail: e.target.value }))}
                    />
                  </div>

                  <div className="clean-field-group">
                    <label htmlFor="maint-phone" className="clean-label">Contact Phone / Hotline</label>
                    <input
                      id="maint-phone"
                      type="text"
                      className="clean-text-input"
                      placeholder="e.g. (053) 832-1923"
                      value={maintenance.contactPhone}
                      onChange={e => setMaintenance(prev => ({ ...prev, contactPhone: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* 5. Bottom Actions Bar */}
              <div className="bbdrts-maint-actions-bar">
                <div className="actions-left">
                  <span className="actions-notice">
                    Changes take effect immediately across all client sessions upon saving.
                  </span>
                </div>

                <div className="actions-right">
                  <button
                    type="button"
                    className="btn-preview-screen"
                    onClick={handleTriggerPreview}
                    title="Preview what non-admin visitors and donors see right now"
                  >
                    <span className="material-symbols-outlined">visibility</span>
                    <span>Simulate / Preview User Screen</span>
                  </button>

                  <button
                    type="submit"
                    className="btn-save-maintenance"
                    disabled={savingMaintenance}
                  >
                    <span className="material-symbols-outlined">save</span>
                    <span>{savingMaintenance ? 'Saving Configuration...' : 'Save Maintenance Settings'}</span>
                  </button>
                </div>
              </div>

            </div>

            {/* ── RIGHT COLUMN: Sticky Live User Preview Card ── */}
            <div className="maint-grid-right">
              <div className="maint-sticky-preview">
                
                {/* Header above preview card */}
                <div className="preview-top-head">
                  <div className="preview-head-left">
                    <span className="material-symbols-outlined icon">visibility</span>
                    <strong className="preview-head-title">LIVE USER PREVIEW</strong>
                  </div>
                  <span className="live-sync-badge">
                    <span className="live-sync-dot" />
                    <span>REAL-TIME SYNC</span>
                  </span>
                </div>

                {/* The Preview Card (Faithful to actual MaintenanceGuardModal) */}
                <div className="simulated-maint-card">
                  {/* Industrial Corner Rivets */}
                  <span className="sim-rivet tl" aria-hidden="true" />
                  <span className="sim-rivet tr" aria-hidden="true" />
                  <span className="sim-rivet bl" aria-hidden="true" />
                  <span className="sim-rivet br" aria-hidden="true" />

                  {/* Top Construction Icon with Amber Glow */}
                  <div className="sim-icon-box">
                    <span className="material-symbols-outlined">construction</span>
                  </div>

                  {/* Title & Warning Badge */}
                  <h4 className="sim-title">
                    {maintenance.title || 'SYSTEM UNDER SCHEDULED MAINTENANCE'}
                  </h4>

                  <div className="sim-badge">
                    <span className="material-symbols-outlined">warning</span>
                    <span>SERVICE TEMPORARILY UNAVAILABLE</span>
                  </div>

                  {/* What's Happening */}
                  <div className="sim-section">
                    <div className="sim-sec-head">
                      <span className="material-symbols-outlined">info</span>
                      <span>What&apos;s Happening?</span>
                    </div>
                    <p className="sim-sec-desc">
                      {maintenance.message || 'Platform services are currently undergoing maintenance to enhance reliability and smart contract security. Essential relief tracking remains recorded on-chain.'}
                    </p>
                  </div>

                  {/* Timeline Row (Started vs Expected Completion) */}
                  <div className="sim-times-row">
                    <div className="sim-time-box">
                      <span className="material-symbols-outlined time-icon">event_upcoming</span>
                      <span className="time-lbl">MAINTENANCE STARTED</span>
                      <strong className="time-val">{maintenance.startTime || 'In Progress'}</strong>
                    </div>

                    <div className="sim-time-box highlight">
                      <span className="material-symbols-outlined time-icon">event_available</span>
                      <span className="time-lbl">EXPECTED COMPLETION</span>
                      <strong className="time-val">{maintenance.endTime || 'Expected Shortly'}</strong>
                    </div>
                  </div>

                  {/* Scope Note if Custom Scope */}
                  {maintenance.scope && maintenance.scope.length > 0 && !maintenance.scope.includes('FULL_PLATFORM') && (
                    <div className="sim-scope-note">
                      <span className="scope-lbl">RESTRICTED SECTORS:</span>
                      <div className="sim-scope-tags">
                        {maintenance.scope.map(s => (
                          <span key={s} className="sim-scope-tag">{s.replace(/_/g, ' ')}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Support Footer */}
                  <div className="sim-footer">
                    <div className="sim-footer-contact">
                      <span className="material-symbols-outlined">support_agent</span>
                      <span>Need Help? Contact {maintenance.contactPerson || 'Operations Support'}</span>
                    </div>
                    <div className="sim-footer-details">
                      {maintenance.contactPhone && <span>{maintenance.contactPhone}</span>}
                      {maintenance.contactPhone && maintenance.contactEmail && <span>•</span>}
                      {maintenance.contactEmail && <span>{maintenance.contactEmail}</span>}
                    </div>

                    {/* Subtle Live Telemetry Line */}
                    <div className="sim-footer-telemetry">
                      <span className="telemetry-dot" />
                      <span>Live telemetry active • Real-time status sync</span>
                    </div>
                  </div>
                </div>

                {/* Simulation Mode Action Button */}
                <button
                  type="button"
                  className="btn-open-fullscreen-sim"
                  onClick={handleTriggerPreview}
                  title="Simulate what non-admin visitors and donors see in full-screen"
                >
                  <span className="material-symbols-outlined">open_in_new</span>
                  <span>Open Fullscreen Simulation</span>
                </button>

              </div>
            </div>

          </div>

        </form>
      )}

    </div>
  );
}
