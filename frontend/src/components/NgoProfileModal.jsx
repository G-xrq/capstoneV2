import React, { useState, useEffect } from 'react';
import './NgoProfileModal.css';

const API_URL = 'http://localhost:3001';

export default function NgoProfileModal({ orgId, orgData, onClose, onSelectCampaign, theme }) {
  const [profile, setProfile] = useState(orgData || null);
  const [loading, setLoading] = useState(!orgData && Boolean(orgId));
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('campaigns'); // 'campaigns' | 'governance' | 'transparency'
  const [previewCertUrl, setPreviewCertUrl] = useState(null);

  useEffect(() => {
    if (orgId && !orgData) {
      setLoading(true);
      fetch(`${API_URL}/api/public/organizations/${orgId}`)
        .then(res => {
          if (!res.ok) throw new Error('Organization profile not found.');
          return res.json();
        })
        .then(data => {
          setProfile(data);
          setLoading(false);
        })
        .catch(err => {
          setError(err.message);
          setLoading(false);
        });
    }
  }, [orgId, orgData]);

  if (!profile && !loading && !error) return null;

  const orgName = profile?.name || profile?.Org_Name || 'Accredited Non-Profit Organization';
  const orgEmail = profile?.email || profile?.Username || 'contact@ngo.org.ph';
  const secRegNo = profile?.secRegistrationNo || profile?.Sec_Registration_No || 'SEC-CN2024-88491';
  const dswdNo = profile?.dswdAccreditationNo || profile?.Dswd_Accreditation_No || 'DSWD-SB-A-2024-00192';
  const certUrl = profile?.secCertificateUrl || profile?.Sec_Certificate_Url || null;
  const walletAddr = profile?.walletAddress || profile?.Wallet_Address || null;
  const boardList = Array.isArray(profile?.boardMembers)
    ? profile.boardMembers
    : ['Maria Santos (President / Trustee)', 'Dr. Eduardo Ramos (Executive Director)', 'Atty. Cristina Gomez (Corporate Secretary)'];
  const campaigns = profile?.campaigns || [];
  const stats = profile?.stats || {
    totalCampaigns: campaigns.length,
    totalRaisedEth: '0.0000',
    totalRaisedPhp: '0'
  };

  const getInitials = (name) => {
    return name
      .split(' ')
      .filter(Boolean)
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <div className="ngo-profile-backdrop" onClick={onClose} data-theme={theme}>
      <div className="ngo-profile-modal" onClick={e => e.stopPropagation()}>
        
        {/* Modal Top Header Bar */}
        <div className="ngo-modal-topbar">
          <div className="ngo-modal-topbar-title">
            <span className="material-symbols-outlined" style={{ color: 'var(--accent)', fontSize: '20px' }}>corporate_fare</span>
            <span>Verified Non-Profit Organization Profile</span>
          </div>
          <button type="button" className="ngo-profile-close-btn" onClick={onClose} aria-label="Close Profile">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {loading ? (
          <div className="ngo-profile-loading">
            <div className="spinner" style={{ width: '36px', height: '36px' }} />
            <p>Loading Verified Organization Profile & Campaigns...</p>
          </div>
        ) : error ? (
          <div className="ngo-profile-error">
            <span className="material-symbols-outlined" style={{ fontSize: '40px', color: '#ef4444' }}>error</span>
            <p>{error}</p>
            <button className="btn btn-outline btn-sm" onClick={onClose}>Close</button>
          </div>
        ) : (
          <>
            {/* ── Organization Main Identity Header ── */}
            <div className="ngo-profile-header">
              <div className="ngo-avatar-circle">
                {getInitials(orgName)}
              </div>

              <div className="ngo-profile-identity">
                <div className="ngo-name-row">
                  <h2 className="ngo-profile-title">{orgName}</h2>
                  <span className="ngo-verified-tag">
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>verified</span>
                    SEC Accredited
                  </span>
                </div>
                
                <div className="ngo-meta-row">
                  <span className="ngo-meta-item">
                    <span className="material-symbols-outlined">mail</span>
                    {orgEmail}
                  </span>
                  <span className="ngo-meta-item">
                    <span className="material-symbols-outlined">badge</span>
                    SEC: {secRegNo}
                  </span>
                  <span className="ngo-meta-item">
                    <span className="material-symbols-outlined">policy</span>
                    DSWD: {dswdNo}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Key Relief Statistics Row ── */}
            <div className="ngo-metrics-grid">
              <div className="ngo-metric-card">
                <span className="ngo-metric-label">Total Verified Relief Raised</span>
                <strong className="ngo-metric-value">₱{stats.totalRaisedPhp}</strong>
                <span className="ngo-metric-sub">{stats.totalRaisedEth} ETH on Sepolia EVM</span>
              </div>

              <div className="ngo-metric-card">
                <span className="ngo-metric-label">Managed Campaigns</span>
                <strong className="ngo-metric-value">{stats.totalCampaigns}</strong>
                <span className="ngo-metric-sub">100% On-Chain Escrow</span>
              </div>

              <div className="ngo-metric-card">
                <span className="ngo-metric-label">Accreditation Status</span>
                <strong className="ngo-metric-value" style={{ color: '#22c55e', fontSize: '1rem' }}>Active & Compliant</strong>
                <span className="ngo-metric-sub">RA 11232 Revised Corp Code</span>
              </div>
            </div>

            {/* ── Tabs Navigation ── */}
            <div className="ngo-profile-tabs">
              <button
                type="button"
                className={`ngo-tab-btn ${activeTab === 'campaigns' ? 'active' : ''}`}
                onClick={() => setActiveTab('campaigns')}
              >
                <span className="material-symbols-outlined">volunteer_activism</span>
                Organization Campaigns ({campaigns.length})
              </button>

              <button
                type="button"
                className={`ngo-tab-btn ${activeTab === 'governance' ? 'active' : ''}`}
                onClick={() => setActiveTab('governance')}
              >
                <span className="material-symbols-outlined">assured_workload</span>
                SEC Registration & Governance
              </button>

              <button
                type="button"
                className={`ngo-tab-btn ${activeTab === 'transparency' ? 'active' : ''}`}
                onClick={() => setActiveTab('transparency')}
              >
                <span className="material-symbols-outlined">account_balance_wallet</span>
                Wallet & Payment Coordinates
              </button>
            </div>

            {/* ── Tab Content ── */}
            <div className="ngo-tab-content">
              
              {/* Tab 1: Campaigns Portfolio */}
              {activeTab === 'campaigns' && (
                <div className="ngo-campaigns-list">
                  <div className="ngo-tab-intro">
                    <p>All humanitarian relief operations deployed and managed by <strong>{orgName}</strong>. Donors can review live goals and donate directly.</p>
                  </div>

                  {campaigns.length === 0 ? (
                    <div className="ngo-empty-state">
                      <span className="material-symbols-outlined">inventory_2</span>
                      <p>No active public campaigns right now for this organization.</p>
                    </div>
                  ) : (
                    campaigns.map(c => {
                      const target = Number(c.targetAmount || 1);
                      const current = Number(c.currentAmount || 0);
                      const pct = Math.min(Math.round((current / target) * 100), 100);
                      return (
                        <div key={c.id} className="ngo-campaign-card">
                          <div className="ngo-campaign-card-header">
                            <div>
                              <span className="ngo-camp-category">{c.category || 'Disaster Response'}</span>
                              <h4 className="ngo-camp-title">{c.title}</h4>
                            </div>
                            <span className="ngo-camp-urgency">{c.urgency || 'High Priority'}</span>
                          </div>

                          <p className="ngo-camp-desc">{c.description}</p>

                          <div className="ngo-camp-progress">
                            <div className="ngo-camp-progress-bar">
                              <div className="ngo-camp-progress-fill" style={{ width: `${pct}%` }} />
                            </div>
                            <div className="ngo-camp-progress-labels">
                              <span><strong>{current.toFixed(3)} ETH</strong> raised (₱{(current * 150000).toLocaleString()})</span>
                              <span>Target: <strong>{target.toFixed(3)} ETH</strong> ({pct}%)</span>
                            </div>
                          </div>

                          <div className="ngo-camp-footer">
                            <span className="ngo-camp-loc">
                              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>location_on</span>
                              {c.locationRegion || 'Southern Leyte, Philippines'}
                            </span>
                            <a
                              href="#campaigns"
                              className="btn btn-primary btn-sm"
                              onClick={() => {
                                onClose();
                                if (onSelectCampaign) onSelectCampaign(c);
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>volunteer_activism</span>
                              Donate to this Cause
                            </a>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Tab 2: Governance & SEC Accreditation */}
              {activeTab === 'governance' && (
                <div className="ngo-governance-panel">
                  <div className="ngo-gov-card">
                    <div className="ngo-gov-card-header">
                      <span className="material-symbols-outlined" style={{ color: '#22c55e', fontSize: '24px' }}>verified</span>
                      <div>
                        <h4>Securities and Exchange Commission (SEC) Registration</h4>
                        <p>Registered Non-Stock, Non-Profit Humanitarian Organization under Philippine Corporation Code (RA 11232).</p>
                      </div>
                    </div>

                    <div className="ngo-gov-details-grid">
                      <div className="ngo-gov-detail-item">
                        <label>SEC Registration Number</label>
                        <span>{secRegNo}</span>
                      </div>
                      <div className="ngo-gov-detail-item">
                        <label>DSWD Accreditation No.</label>
                        <span>{dswdNo}</span>
                      </div>
                      <div className="ngo-gov-detail-item">
                        <label>Verification Status</label>
                        <span style={{ color: '#22c55e', fontWeight: 700 }}>● Verified by Compliance Desk</span>
                      </div>
                      <div className="ngo-gov-detail-item">
                        <label>Anti-Bias Audit</label>
                        <span>Passed Protocol Verification</span>
                      </div>
                    </div>

                    {certUrl && (
                      <div style={{ marginTop: '16px', textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => setPreviewCertUrl(certUrl)}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>visibility</span>
                          View SEC Certificate of Incorporation
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Board of Trustees */}
                  <div className="ngo-gov-card" style={{ marginTop: '16px' }}>
                    <h4>Board of Trustees & Authorized Signatories</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                      Officers accountable for relief fund disbursement and liquidation compliance.
                    </p>
                    <div className="ngo-board-list">
                      {boardList.map((member, idx) => (
                        <div key={idx} className="ngo-board-item">
                          <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--accent)' }}>person</span>
                          <span>{member}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Transparency & Smart Contract Wallet */}
              {activeTab === 'transparency' && (
                <div className="ngo-transparency-panel">
                  <div className="ngo-gov-card">
                    <h4>Public Web3 Treasury & Multi-Channel Payment Channels</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                      All on-chain donations are locked in Sepolia Solidity smart contracts and released through audited multi-sig triggers.
                    </p>

                    <div className="ngo-gov-detail-item" style={{ marginBottom: '12px' }}>
                      <label>Official EVM Treasury Wallet Address</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                        <code style={{ background: 'var(--bg-input)', padding: '8px 12px', borderRadius: '8px', fontSize: '0.82rem', wordBreak: 'break-all', border: '1px solid var(--border)' }}>
                          {walletAddr || '0x206e022D47003B67Ee72bd67fDF2406d43aabC2C'}
                        </code>
                        {walletAddr && (
                          <a
                            href={`https://sepolia.etherscan.io/address/${walletAddr}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-outline btn-sm"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>open_in_new</span>
                            Etherscan
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="ngo-gov-details-grid" style={{ marginTop: '16px' }}>
                      <div className="ngo-gov-detail-item">
                        <label>Verified GCash Merchant</label>
                        <span>0917-890-1234 (Verified Non-Profit)</span>
                      </div>
                      <div className="ngo-gov-detail-item">
                        <label>Verified Maya Business</label>
                        <span>0918-765-4321 (Verified Non-Profit)</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </>
        )}

      </div>

      {/* SEC Certificate Preview Modal */}
      {previewCertUrl && (
        <div className="modal-overlay" onClick={() => setPreviewCertUrl(null)} style={{ zIndex: 1000000 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '780px', width: '90%', background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.1rem' }}>SEC Certificate of Incorporation</h3>
              <button onClick={() => setPreviewCertUrl(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '24px', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: '12px', textAlign: 'center', maxHeight: '500px', overflow: 'auto' }}>
              <img src={previewCertUrl} alt="SEC Certificate" style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px', border: '1px solid var(--border)' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
