import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { API_URL } from '../config';
import { useToast } from '../context/ToastContext';
import '../views/VercelAdminTables.css';
import './AdminBroadcastPanel.css';

const SEVERITY_CONFIG = {
  EMERGENCY: {
    label: 'Emergency Alert',
    badge: 'EMERGENCY',
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.12)',
    border: 'rgba(239, 68, 68, 0.3)',
    icon: 'warning'
  },
  OPERATIONAL: {
    label: 'Operational Notice',
    badge: 'OPERATIONAL',
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.3)',
    icon: 'info'
  },
  GENERAL: {
    label: 'Platform Advisory',
    badge: 'GENERAL',
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.3)',
    icon: 'campaign'
  }
};

export default function AdminBroadcastPanel({ onActiveCountChange }) {
  const { showSuccess, showError, showWarning } = useToast();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState('ALL');

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    severity: 'GENERAL',
    targetAudience: 'ALL',
    isActive: true,
    expiresAt: '',
    pushNotification: true
  });

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/announcements`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setAnnouncements(list);
        const activeCount = list.filter(a => a.isActive).length;
        if (onActiveCountChange) onActiveCountChange(activeCount);
      }
    } catch (err) {
      console.error('Failed to load announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.message.trim()) {
      showWarning('Please enter both an announcement title and message.', 'Required Fields');
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to publish announcement.');

      showSuccess(`Broadcast "${formData.title}" published to ${formData.targetAudience.toLowerCase()} audience.`, 'Broadcast Published');
      setShowModal(false);
      setFormData({
        title: '',
        message: '',
        severity: 'GENERAL',
        targetAudience: 'ALL',
        isActive: true,
        expiresAt: '',
        pushNotification: true
      });
      fetchAnnouncements();
    } catch (err) {
      showError(err.message, 'Broadcast Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (id, currentActive) => {
    try {
      const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
      const nextActive = !currentActive;
      const res = await fetch(`${API_URL}/api/admin/announcements/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ isActive: nextActive })
      });

      if (!res.ok) throw new Error('Failed to update status.');
      showSuccess(`Announcement ${nextActive ? 'activated' : 'deactivated'}.`, 'Status Updated');
      setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, isActive: nextActive } : a));
    } catch (err) {
      showError(err.message, 'Error');
    }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete broadcast announcement "${title}"?`)) return;
    try {
      const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/announcements/${id}`, {
        method: 'DELETE',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      if (!res.ok) throw new Error('Failed to delete.');
      showSuccess('Announcement removed.', 'Deleted');
      setAnnouncements(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      showError(err.message, 'Error');
    }
  };

  const filteredAnnouncements = announcements.filter(a => {
    if (filterSeverity !== 'ALL' && a.severity !== filterSeverity) return false;
    return true;
  });

  const activeCount = announcements.filter(a => a.isActive).length;
  const emergencyCount = announcements.filter(a => a.severity === 'EMERGENCY' && a.isActive).length;

  return (
    <div className="bbdrts-broadcast-panel">
      
      {/* ── Institutional Header Bar ── */}
      <div className="admin-page-header">
        <div className="admin-page-title-wrap">
          <h2 className="admin-page-title">
            <span className="material-symbols-outlined" style={{ fontSize: '24px', color: '#10b981' }}>podcasts</span>
            Broadcast &amp; Alerts
          </h2>
          <p className="admin-page-sub">
            Publish real-time disaster warnings, Ethereum Sepolia status alerts, and relief milestone advisories visible across all platform views.
          </p>
        </div>

        <div className="admin-page-header-actions">
          <button
            type="button"
            className="admin-header-btn"
            onClick={() => setShowModal(true)}
            title="Create a new system-wide alert or announcement"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add_alert</span>
            <span>New Broadcast</span>
          </button>
        </div>
      </div>

      {/* ── Metric Snapshot Cards ── */}
      <div className="bbdrts-broadcast-stats-grid">
        <div className="bbdrts-b-stat-card">
          <div className="stat-label-line">
            <span>ACTIVE BROADCASTS</span>
            <span className="material-symbols-outlined icon">rss_feed</span>
          </div>
          <strong className="stat-value text-emerald">{activeCount}</strong>
          <span className="stat-hint">Live across public and authenticated views</span>
        </div>

        <div className="bbdrts-b-stat-card">
          <div className="stat-label-line">
            <span>EMERGENCY DISASTER ALERTS</span>
            <span className="material-symbols-outlined icon text-red">warning</span>
          </div>
          <strong className="stat-value text-red">{emergencyCount}</strong>
          <span className="stat-hint">High priority severe weather warnings</span>
        </div>

        <div className="bbdrts-b-stat-card">
          <div className="stat-label-line">
            <span>TOTAL PUBLISHED</span>
            <span className="material-symbols-outlined icon">archive</span>
          </div>
          <strong className="stat-value">{announcements.length}</strong>
          <span className="stat-hint">All-time historical announcements</span>
        </div>
      </div>

      {/* ── Filter Strip ── */}
      <div className="bbdrts-filter-strip">
        <div className="filter-tabs">
          <button
            type="button"
            className={`filter-tab ${filterSeverity === 'ALL' ? 'active' : ''}`}
            onClick={() => setFilterSeverity('ALL')}
          >
            All Announcements ({announcements.length})
          </button>
          <button
            type="button"
            className={`filter-tab ${filterSeverity === 'EMERGENCY' ? 'active' : ''}`}
            onClick={() => setFilterSeverity('EMERGENCY')}
          >
            <span className="dot red" />
            Emergency Alerts ({announcements.filter(a => a.severity === 'EMERGENCY').length})
          </button>
          <button
            type="button"
            className={`filter-tab ${filterSeverity === 'OPERATIONAL' ? 'active' : ''}`}
            onClick={() => setFilterSeverity('OPERATIONAL')}
          >
            <span className="dot amber" />
            Operational ({announcements.filter(a => a.severity === 'OPERATIONAL').length})
          </button>
          <button
            type="button"
            className={`filter-tab ${filterSeverity === 'GENERAL' ? 'active' : ''}`}
            onClick={() => setFilterSeverity('GENERAL')}
          >
            <span className="dot green" />
            General ({announcements.filter(a => a.severity === 'GENERAL').length})
          </button>
        </div>

        <button
          type="button"
          className="bbdrts-btn-refresh"
          onClick={fetchAnnouncements}
          disabled={loading}
          title="Refresh announcements list"
        >
          <span className={`material-symbols-outlined ${loading ? 'spinning' : ''}`}>sync</span>
          <span>Refresh</span>
        </button>
      </div>

      {/* ── Announcements Table ── */}
      <div className="bbdrts-table-container">
        <table className="bbdrts-broadcast-table">
          <thead>
            <tr>
              <th style={{ width: '130px' }}>Severity</th>
              <th>Title &amp; Announcement Content</th>
              <th style={{ width: '110px' }}>Audience</th>
              <th style={{ width: '90px' }}>Status</th>
              <th style={{ width: '130px' }}>Published</th>
              <th style={{ width: '80px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="6" className="table-empty">
                  <div className="table-loading-spinner" />
                  <span>Loading broadcast announcements...</span>
                </td>
              </tr>
            )}

            {!loading && filteredAnnouncements.length === 0 && (
              <tr>
                <td colSpan="6" className="table-empty">
                  <span className="material-symbols-outlined empty-icon">campaign</span>
                  <strong>No broadcast announcements found</strong>
                  <span className="sub">Click &quot;New Broadcast Announcement&quot; to publish a disaster advisory or platform notice.</span>
                </td>
              </tr>
            )}

            {!loading && filteredAnnouncements.map((ann) => {
              const sev = SEVERITY_CONFIG[ann.severity] || SEVERITY_CONFIG.GENERAL;
              return (
                <tr key={ann.id} className={!ann.isActive ? 'row-inactive' : ''}>
                  <td>
                    <span
                      className="bbdrts-severity-pill"
                      style={{ color: sev.color, background: sev.bg, borderColor: sev.border }}
                    >
                      <span className="material-symbols-outlined icon">{sev.icon}</span>
                      <span>{sev.badge}</span>
                    </span>
                  </td>

                  <td>
                    <div className="ann-content-cell">
                      <strong className="ann-title">{ann.title}</strong>
                      <p className="ann-desc">{ann.message}</p>
                      {ann.expiresAt && (
                        <span className="ann-expires">
                          Expires: {new Date(ann.expiresAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </td>

                  <td>
                    <span className="bbdrts-audience-tag">
                      {ann.targetAudience === 'ALL' ? 'All Users' : (ann.targetAudience === 'DONOR' ? 'Donors Only' : 'NGOs Only')}
                    </span>
                  </td>

                  <td>
                    <button
                      type="button"
                      className={`bbdrts-status-toggle ${ann.isActive ? 'active' : 'inactive'}`}
                      onClick={() => handleToggleActive(ann.id, ann.isActive)}
                      title={ann.isActive ? 'Deactivate broadcast' : 'Activate broadcast'}
                    >
                      <span className="toggle-dot" />
                      <span>{ann.isActive ? 'Active' : 'Draft'}</span>
                    </button>
                  </td>

                  <td>
                    <span className="ann-date">
                      {new Date(ann.createdAt).toLocaleDateString('en-PH', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </td>

                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="bbdrts-btn-del-ann"
                      onClick={() => handleDelete(ann.id, ann.title)}
                      title="Delete announcement"
                    >
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Modal: Create Announcement (Portaled & Fixed Centered) ── */}
      {showModal && typeof document !== 'undefined' && createPortal(
        <div className="bbdrts-b-modal-overlay" onClick={() => setShowModal(false)} role="dialog" aria-modal="true">
          <div className="bbdrts-b-modal" onClick={e => e.stopPropagation()}>
            <div className="bbdrts-b-modal-head">
              <div className="head-title-wrap">
                <div className="head-icon">
                  <span className="material-symbols-outlined">podcasts</span>
                </div>
                <div>
                  <h3 className="modal-title">Publish Broadcast Announcement</h3>
                  <p className="modal-sub">Create a platform-wide banner to notify donors, NGOs, or all users.</p>
                </div>
              </div>
              <button type="button" className="close-btn" onClick={() => setShowModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateAnnouncement} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div className="bbdrts-b-modal-body">
                {/* Severity Selector */}
                <div className="form-group">
                  <label>Severity Level <span className="req">*</span></label>
                  <div className="severity-segmented-grid">
                    <button
                      type="button"
                      className={`sev-card ${formData.severity === 'EMERGENCY' ? 'active emergency' : ''}`}
                      onClick={() => setFormData(prev => ({ ...prev, severity: 'EMERGENCY' }))}
                    >
                      <span className="material-symbols-outlined icon text-red">warning</span>
                      <strong>Emergency Alert</strong>
                      <span>Severe weather, typhoons, evacuation</span>
                    </button>

                    <button
                      type="button"
                      className={`sev-card ${formData.severity === 'OPERATIONAL' ? 'active operational' : ''}`}
                      onClick={() => setFormData(prev => ({ ...prev, severity: 'OPERATIONAL' }))}
                    >
                      <span className="material-symbols-outlined icon text-amber">info</span>
                      <strong>Operational Notice</strong>
                      <span>Sepolia RPC, payment gateways</span>
                    </button>

                    <button
                      type="button"
                      className={`sev-card ${formData.severity === 'GENERAL' ? 'active general' : ''}`}
                      onClick={() => setFormData(prev => ({ ...prev, severity: 'GENERAL' }))}
                    >
                      <span className="material-symbols-outlined icon text-emerald">podcasts</span>
                      <strong>Platform Advisory</strong>
                      <span>Verification milestones, general info</span>
                    </button>
                  </div>
                </div>

                {/* Title Input */}
                <div className="form-group">
                  <label htmlFor="b-title">Announcement Headline <span className="req">*</span></label>
                  <input
                    id="b-title"
                    type="text"
                    placeholder="e.g. Typhoon Tino Signal #4: Priority Emergency Dispatch"
                    value={formData.title}
                    onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    required
                  />
                </div>

                {/* Message Textarea */}
                <div className="form-group">
                  <label htmlFor="b-msg">Detailed Announcement Narrative <span className="req">*</span></label>
                  <textarea
                    id="b-msg"
                    rows={3}
                    placeholder="e.g. Evacuation centers in Danao City have opened. Relief packages with potable water are currently being mobilized. Backers can track disbursements in real-time."
                    value={formData.message}
                    onChange={e => setFormData(prev => ({ ...prev, message: e.target.value }))}
                    required
                  />
                </div>

                {/* Target Audience & Expiration */}
                <div className="form-grid-2">
                  <div className="form-group">
                    <label htmlFor="b-aud">Target Audience</label>
                    <select
                      id="b-aud"
                      value={formData.targetAudience}
                      onChange={e => setFormData(prev => ({ ...prev, targetAudience: e.target.value }))}
                    >
                      <option value="ALL">All Users (Public Visitors, Donors, NGOs)</option>
                      <option value="DONOR">Donors &amp; Backers Only</option>
                      <option value="ORGANIZATION">Accredited NGOs Only</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="b-exp">Optional Expiration Date</label>
                    <input
                      id="b-exp"
                      type="datetime-local"
                      value={formData.expiresAt}
                      onChange={e => setFormData(prev => ({ ...prev, expiresAt: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Push Options Checkboxes */}
                <div className="form-checkbox-row">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={e => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    />
                    <span>Activate announcement immediately upon publishing</span>
                  </label>

                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.pushNotification}
                      onChange={e => setFormData(prev => ({ ...prev, pushNotification: e.target.checked }))}
                    />
                    <span>Also dispatch notification to user notification center</span>
                  </label>
                </div>
              </div>

              {/* Modal Footer (Always Visible at Bottom) */}
              <div className="bbdrts-b-modal-footer">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  disabled={submitting || !formData.title.trim() || !formData.message.trim()}
                >
                  <span className="material-symbols-outlined">send</span>
                  <span>{submitting ? 'Publishing...' : 'Publish Announcement'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
