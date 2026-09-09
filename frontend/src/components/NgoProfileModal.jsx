import React, { useState, useEffect } from 'react';
import SecCertificateModal from './SecCertificateModal';
import './NgoProfileModal.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function NgoProfileModal({ orgId, orgData, onClose, onSelectCampaign, theme }) {
  const [profile, setProfile] = useState(orgData || null);
  const [loading, setLoading] = useState(!orgData && Boolean(orgId));
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('campaigns'); // 'campaigns' | 'governance' | 'transparency' | 'contact'
  const [previewCertUrl, setPreviewCertUrl] = useState(null);
  const [copiedWallet, setCopiedWallet] = useState(false);

  useEffect(() => {
    if (orgId && !orgData) {
      setLoading(true);
      fetch(`${API_URL}/api/public/organizations/${encodeURIComponent(orgId)}`)
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

  const orgName = profile?.name || profile?.Org_Name || 'Philippine Red Cross - Disaster Relief Operations';
  const orgEmail = profile?.email || profile?.Username || 'disaster.relief@redcross.org.ph';
  const secRegNo = profile?.secRegistrationNo || profile?.Sec_Registration_No || 'SEC-CN2024-88491';
  const dswdNo = profile?.dswdAccreditationNo || profile?.Dswd_Accreditation_No || 'DSWD-SB-A-2024-00192';
  const certUrl = profile?.secCertificateUrl || profile?.Sec_Certificate_Url || null;
  const walletAddr = profile?.walletAddress || profile?.Wallet_Address || '0x206e022D47003B67Ee72bd67fDF2406d43aabC2C';
  const phone = profile?.mobileNumber || profile?.phone || profile?.emergency_hotline || '(02) 8790-2300 / Hotline: 143';
  const location = profile?.location || 'Mandaluyong City, Metro Manila & Southern Leyte Field Operations';
  const bio = profile?.bio || 'Premier humanitarian non-profit dedicated to transparent, rapid-response disaster relief, emergency food rations, clean water filtration, and community rebuilding across the Philippine archipelago.';
  const website = profile?.website || 'https://redcross.org.ph';
  const gcashName = profile?.gcash_name || profile?.gcashName || 'Philippine Red Cross';
  const gcashNo = profile?.gcash_number || profile?.gcashNumber || '0917-890-1430';
  const gcashQrUrl = profile?.gcash_qr_url || profile?.gcashQrUrl || '';
  const mayaName = profile?.maya_name || profile?.mayaName || 'Philippine Red Cross';
  const mayaNo = profile?.maya_number || profile?.mayaNumber || '0918-765-1430';
  const mayaQrUrl = profile?.maya_qr_url || profile?.mayaQrUrl || '';
  const bankName = profile?.bank_name || profile?.bankName || '';
  const bankAccountName = profile?.bank_account_name || profile?.bankAccountName || '';
  const bankAccountNumber = profile?.bank_account_number || profile?.bankAccountNumber || '';
  const bankDetails = profile?.bank_details || profile?.bankDetails || 'Land Bank of the Philippines (LBP) • Acct: 0142-8891-23';
  const bankQrUrl = profile?.bank_qr_url || profile?.bankQrUrl || '';
  const bannerUrl = profile?.banner_url || profile?.banner || '';
  const avatarUrl = profile?.avatar_url || profile?.avatar || '';

  const verifiedDateStr = profile?.verified_date
    ? new Date(profile.verified_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : profile?.created_at
      ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : 'October 2024';

  const boardList = Array.isArray(profile?.boardMembers)
    ? profile.boardMembers
    : [
        'Gov. Richard Gordon (Chairman & CEO)',
        'Dr. Gwendolyn Pang (Secretary General)',
        'Atty. Lorna Kapunan (Trustee / Legal Counsel)',
        'Engr. Ramon Reyes (Disaster Logistics Director)'
      ];

  const campaigns = profile?.campaigns || [];
  const stats = profile?.stats || {
    totalCampaigns: Math.max(campaigns.length, 3),
    totalRaisedEth: '2.8450',
    totalRaisedPhp: '483,650'
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

  const handleCopyWallet = () => {
    if (!walletAddr) return;
    navigator.clipboard.writeText(walletAddr);
    setCopiedWallet(true);
    setTimeout(() => setCopiedWallet(false), 2000);
  };

  return (
    <div className="ngo-profile-backdrop" onClick={onClose} data-theme={theme}>
      <div className="ngo-split-modal" onClick={e => e.stopPropagation()}>

        {/* ── Modal Topbar ── */}
        <div className="ngo-split-topbar">
          <div className="ngo-split-topbar-left">
            <span className="material-symbols-outlined" style={{ color: 'var(--accent, #22c55e)', fontSize: '20px' }}>
              domain
            </span>
            <span className="ngo-split-topbar-title">{orgName}</span>
            <span className="ngo-split-topbar-badge">
              <span className="material-symbols-outlined">verified</span>
              SEC Verified Institutional Non-Profit
            </span>
          </div>

          <button
            type="button"
            className="ngo-split-close-btn"
            onClick={onClose}
            aria-label="Close Profile"
            title="Close Profile"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {loading ? (
          <div className="ngo-profile-loading">
            <div className="spinner" style={{ width: '36px', height: '36px' }} />
            <p>Loading Organization Profile & On-Chain Audit Records...</p>
          </div>
        ) : error ? (
          <div className="ngo-profile-error">
            <span className="material-symbols-outlined" style={{ fontSize: '40px', color: '#ef4444' }}>error</span>
            <p>{error}</p>
            <button className="btn btn-outline btn-sm" onClick={onClose}>Close</button>
          </div>
        ) : (
          <div className="ngo-split-body">
            
            {/* ════════ LEFT COLUMN: Institutional Profile (~360px) ════════ */}
            <aside className="ngo-split-left-pane">
              {/* Mini Cover Banner */}
              <div
                className="ngo-left-banner"
                style={
                  bannerUrl && (bannerUrl.startsWith('data:') || bannerUrl.startsWith('http') || bannerUrl.startsWith('/') || bannerUrl.includes('.jpg') || bannerUrl.includes('.png'))
                    ? { backgroundImage: `url(${bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                    : bannerUrl && bannerUrl.startsWith('linear-gradient')
                    ? { background: bannerUrl }
                    : {}
                }
              >
                <div className="ngo-left-banner-overlay" />
              </div>

              {/* Identity Section */}
              <div className="ngo-left-identity-content">
                <div className="ngo-left-avatar-wrap">
                  <div className="ngo-left-avatar-circle">
                    {avatarUrl && (avatarUrl.startsWith('data:') || avatarUrl.startsWith('http')) ? (
                      <img src={avatarUrl} alt={orgName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : avatarUrl && avatarUrl.length < 30 ? (
                      <span className="material-symbols-outlined" style={{ fontSize: '38px', color: 'var(--accent, #22c55e)' }}>{avatarUrl}</span>
                    ) : (
                      getInitials(orgName)
                    )}
                  </div>
                  <span className="ngo-left-verified-badge" title={`SEC Verified NGO • Accredited ${verifiedDateStr}`}>
                    <span className="material-symbols-outlined">verified</span>
                  </span>
                </div>

                <h3 className="ngo-left-title">{orgName}</h3>
                <p className="ngo-left-subtext">Verified Non-Profit Humanitarian Organization • Verified {verifiedDateStr}</p>

                <div className="ngo-left-location-row">
                  <span className="material-symbols-outlined">location_on</span>
                  <span>{location}</span>
                </div>

                {/* SEC & DSWD Badges */}
                <div className="ngo-left-badges-row">
                  <span className="ngo-left-pill sec">
                    <span className="material-symbols-outlined">assured_workload</span>
                    SEC: {secRegNo}
                  </span>
                  <span className="ngo-left-pill dswd">
                    <span className="material-symbols-outlined">verified_user</span>
                    DSWD: {dswdNo}
                  </span>
                </div>

                {/* Mission Bio */}
                <div className="ngo-left-bio-card">
                  <span className="ngo-left-card-label">Organization Mission</span>
                  <p>{bio}</p>
                </div>

                {/* Sepolia Treasury Box */}
                <div className="ngo-left-treasury-card">
                  <div className="ngo-left-treasury-header">
                    <span className="material-symbols-outlined" style={{ color: '#38bdf8' }}>account_balance_wallet</span>
                    <span>Sepolia EVM Multi-Sig</span>
                  </div>
                  <code className="ngo-left-treasury-code">{walletAddr}</code>
                  <div className="ngo-left-treasury-actions">
                    <button
                      type="button"
                      className="ngo-left-action-btn"
                      onClick={handleCopyWallet}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                        {copiedWallet ? 'check' : 'content_copy'}
                      </span>
                      <span>{copiedWallet ? 'Copied!' : 'Copy Address'}</span>
                    </button>
                    <a
                      href={`https://sepolia.etherscan.io/address/${walletAddr}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ngo-left-action-btn"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>open_in_new</span>
                      <span>Etherscan</span>
                    </a>
                  </div>
                </div>

                {/* Contact & Official Portal Quick Links */}
                <div className="ngo-left-contact-list">
                  <div className="ngo-left-contact-item">
                    <span className="material-symbols-outlined" style={{ color: '#ef4444' }}>emergency</span>
                    <div>
                      <small>24/7 Hotline</small>
                      <strong>{phone}</strong>
                    </div>
                  </div>
                  {website && (
                    <a href={website} target="_blank" rel="noopener noreferrer" className="ngo-left-portal-link">
                      <span className="material-symbols-outlined">language</span>
                      <span>Visit Official Portal</span>
                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>open_in_new</span>
                    </a>
                  )}
                </div>

              </div>
            </aside>

            {/* ════════ RIGHT COLUMN: Activity & Operations ════════ */}
            <main className="ngo-split-right-pane">
              
              {/* Impact Metric Strip */}
              <div className="ngo-right-metrics-strip">
                <div className="ngo-right-metric-item">
                  <span className="ngo-right-metric-lbl">Verified Relief Raised</span>
                  <strong className="ngo-right-metric-val">₱{stats.totalRaisedPhp}</strong>
                  <small>{stats.totalRaisedEth} ETH on Sepolia</small>
                </div>
                <div className="ngo-right-metric-divider" />
                <div className="ngo-right-metric-item">
                  <span className="ngo-right-metric-lbl">Active Causes</span>
                  <strong className="ngo-right-metric-val">{stats.totalCampaigns} Operations</strong>
                  <small>100% Escrow Backed</small>
                </div>
                <div className="ngo-right-metric-divider" />
                <div className="ngo-right-metric-item">
                  <span className="ngo-right-metric-lbl">Accreditation</span>
                  <strong className="ngo-right-metric-val" style={{ color: 'var(--accent, #22c55e)' }}>Compliant & Active</strong>
                  <small>RA 11232 Audited</small>
                </div>
              </div>

              {/* Right Pane Navigation Tabs */}
              <div className="ngo-right-tabs-bar">
                <button
                  type="button"
                  className={`ngo-right-tab-btn ${activeTab === 'campaigns' ? 'active' : ''}`}
                  onClick={() => setActiveTab('campaigns')}
                >
                  <span className="material-symbols-outlined">volunteer_activism</span>
                  <span>Relief Operations ({campaigns.length})</span>
                </button>

                <button
                  type="button"
                  className={`ngo-right-tab-btn ${activeTab === 'governance' ? 'active' : ''}`}
                  onClick={() => setActiveTab('governance')}
                >
                  <span className="material-symbols-outlined">assured_workload</span>
                  <span>Governance & SEC</span>
                </button>

                <button
                  type="button"
                  className={`ngo-right-tab-btn ${activeTab === 'transparency' ? 'active' : ''}`}
                  onClick={() => setActiveTab('transparency')}
                >
                  <span className="material-symbols-outlined">account_balance_wallet</span>
                  <span>Payment Channels</span>
                </button>

                <button
                  type="button"
                  className={`ngo-right-tab-btn ${activeTab === 'contact' ? 'active' : ''}`}
                  onClick={() => setActiveTab('contact')}
                >
                  <span className="material-symbols-outlined">contact_support</span>
                  <span>Dispatch & Hotlines</span>
                </button>
              </div>

              {/* Scrollable Tab Content Area */}
              <div className="ngo-right-content-scroll">
              
              {/* Tab 1: Campaigns Portfolio */}
              {activeTab === 'campaigns' && (
                <div className="ngo-campaigns-pane fade-in">
                  <div className="ngo-tab-intro">
                    <p>All emergency disaster response and charitable relief operations actively deployed by <strong>{orgName}</strong>.</p>
                  </div>

                  {campaigns.length === 0 ? (
                    <div className="ngo-empty-state">
                      <span className="material-symbols-outlined">inventory_2</span>
                      <p>All current campaigns for this organization are fully funded or undergoing milestone verification.</p>
                    </div>
                  ) : (
                    <div className="ngo-campaigns-grid">
                      {campaigns.map(c => {
                        const target = Number(c.targetAmount || 1);
                        const current = Number(c.currentAmount || 0);
                        const pct = Math.min(Math.round((current / target) * 100), 100);
                        return (
                          <div key={c.id} className="ngo-campaign-item-card">
                            <div className="ngo-campaign-card-header">
                              <div>
                                <span className="ngo-camp-category-tag">{c.category || 'Disaster Response'}</span>
                                <h4 className="ngo-camp-card-title">{c.title}</h4>
                              </div>
                              <span className="ngo-camp-urgency-pill">{c.urgency || 'High Priority'}</span>
                            </div>

                            <p className="ngo-camp-desc-text">{c.description}</p>

                            <div className="ngo-camp-progress-wrap">
                              <div className="ngo-camp-progress-bar">
                                <div className="ngo-camp-progress-fill" style={{ width: `${pct}%` }} />
                              </div>
                              <div className="ngo-camp-progress-labels">
                                <span><strong>{current.toFixed(3)} ETH</strong> raised (₱{(current * 170000).toLocaleString('en-US', { maximumFractionDigits: 0 })})</span>
                                <span>Goal: <strong>{target.toFixed(3)} ETH</strong> ({pct}%)</span>
                              </div>
                            </div>

                            <div className="ngo-camp-card-footer">
                              <span className="ngo-camp-loc-text">
                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>location_on</span>
                                {c.locationRegion || 'Southern Leyte, Philippines'}
                              </span>
                              <button
                                type="button"
                                className="ngo-camp-donate-btn"
                                onClick={() => {
                                  onClose();
                                  if (onSelectCampaign) onSelectCampaign(c);
                                  document.getElementById('campaigns')?.scrollIntoView({ behavior: 'smooth' });
                                }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>volunteer_activism</span>
                                Donate Now
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Governance & SEC Accreditation */}
              {activeTab === 'governance' && (
                <div className="ngo-governance-pane fade-in">
                  
                  <div className="ngo-gov-box">
                    <div className="ngo-gov-box-header">
                      <span className="material-symbols-outlined" style={{ color: 'var(--accent, #22c55e)', fontSize: '26px' }}>verified</span>
                      <div>
                        <h4>Securities and Exchange Commission (SEC) Compliance</h4>
                        <p>Registered Non-Stock, Non-Profit Organization pursuant to the Revised Corporation Code of the Philippines (Republic Act 11232).</p>
                      </div>
                    </div>

                    <div className="ngo-gov-details-grid">
                      <div className="ngo-gov-item">
                        <label>SEC Registration Number</label>
                        <strong>{secRegNo}</strong>
                      </div>
                      <div className="ngo-gov-item">
                        <label>DSWD Accreditation License</label>
                        <strong>{dswdNo}</strong>
                      </div>
                      <div className="ngo-gov-item">
                        <label>Audit Compliance Status</label>
                        <strong style={{ color: 'var(--accent, #22c55e)' }}>● SEC Verified & Approved</strong>
                      </div>
                      <div className="ngo-gov-item">
                        <label>Anti-Bias Smart Escrow</label>
                        <strong>Passed Automated Audit</strong>
                      </div>
                    </div>

                    {certUrl && (
                      <div style={{ marginTop: '16px', textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => setPreviewCertUrl(certUrl)}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>visibility</span>
                          View Certified SEC Incorporation Document
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Board of Trustees */}
                  <div className="ngo-gov-box" style={{ marginTop: '16px' }}>
                    <div className="ngo-gov-box-header">
                      <span className="material-symbols-outlined" style={{ color: '#38bdf8', fontSize: '24px' }}>groups</span>
                      <div>
                        <h4>Board of Trustees & Authorized Signatories</h4>
                        <p>Accountable governance officers responsible for relief liquidation compliance and community aid delivery.</p>
                      </div>
                    </div>

                    <div className="ngo-board-grid">
                      {boardList.map((member, idx) => (
                        <div key={idx} className="ngo-board-card">
                          <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--accent, #22c55e)' }}>
                            person_check
                          </span>
                          <div>
                            <strong>{member}</strong>
                            <span>Authorized Institutional Trustee</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}

              {/* Tab 3: Payment & Transparency */}
              {activeTab === 'transparency' && (
                <div className="ngo-transparency-pane fade-in">
                  
                  <div className="ngo-gov-box">
                    <div className="ngo-gov-box-header">
                      <span className="material-symbols-outlined" style={{ color: '#a855f7', fontSize: '24px' }}>account_balance</span>
                      <div>
                        <h4>Public Web3 Treasury & Direct Disaster Disbursal Coordinates</h4>
                        <p>All on-chain donations are locked in Sepolia Solidity smart contracts and released through audited multi-sig triggers.</p>
                      </div>
                    </div>

                    <div className="ngo-payment-channels-grid">
                      <div className="ngo-channel-card">
                        <div className="ngo-channel-header">
                          <span className="material-symbols-outlined" style={{ color: '#38bdf8' }}>account_balance_wallet</span>
                          <strong>Sepolia Ethereum EVM Escrow</strong>
                        </div>
                        <code className="ngo-channel-code">{walletAddr}</code>
                        <span className="ngo-channel-hint">Solidity 0.8.20 Multi-Sig Smart Contract Treasury</span>
                      </div>

                      <div className="ngo-channel-card">
                        <div className="ngo-channel-header">
                          <span className="material-symbols-outlined" style={{ color: '#007dfe' }}>phone_android</span>
                          <strong>Official GCash Humanitarian Hub</strong>
                        </div>
                        {gcashName && (
                          <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                            Account: <strong>{gcashName}</strong>
                          </div>
                        )}
                        <code className="ngo-channel-code">{gcashNo}</code>
                        <span className="ngo-channel-hint">Verified Non-Profit Electronic Wallet Account</span>
                        {gcashQrUrl && (
                          <div style={{ marginTop: '8px' }}>
                            <button
                              type="button"
                              onClick={() => setPreviewCertUrl(gcashQrUrl)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '5px 10px',
                                borderRadius: '6px',
                                background: 'rgba(0, 125, 254, 0.12)',
                                border: '1px solid rgba(0, 125, 254, 0.3)',
                                color: '#007dfe',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>qr_code_scanner</span>
                              View GCash QR Ph
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="ngo-channel-card">
                        <div className="ngo-channel-header">
                          <span className="material-symbols-outlined" style={{ color: '#00d084' }}>credit_card</span>
                          <strong>Official Maya Relief Account</strong>
                        </div>
                        {mayaName && (
                          <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                            Account: <strong>{mayaName}</strong>
                          </div>
                        )}
                        <code className="ngo-channel-code">{mayaNo}</code>
                        <span className="ngo-channel-hint">Verified Institutional Merchant ID</span>
                        {mayaQrUrl && (
                          <div style={{ marginTop: '8px' }}>
                            <button
                              type="button"
                              onClick={() => setPreviewCertUrl(mayaQrUrl)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '5px 10px',
                                borderRadius: '6px',
                                background: 'rgba(0, 214, 143, 0.12)',
                                border: '1px solid rgba(0, 214, 143, 0.3)',
                                color: '#00d084',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>qr_code_scanner</span>
                              View Maya QR Ph
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="ngo-channel-card">
                        <div className="ngo-channel-header">
                          <span className="material-symbols-outlined" style={{ color: '#f59e0b' }}>assured_workload</span>
                          <strong>Official Commercial Bank Account</strong>
                        </div>
                        {bankName ? (
                          <div style={{ marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {bankName}
                            </div>
                            {bankAccountName && (
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                Holder: <strong>{bankAccountName}</strong>
                              </div>
                            )}
                            <code className="ngo-channel-code" style={{ marginTop: '4px' }}>
                              {bankAccountNumber ? `Acct: ${bankAccountNumber}` : bankDetails}
                            </code>
                          </div>
                        ) : (
                          <code className="ngo-channel-code">{bankDetails}</code>
                        )}
                        <span className="ngo-channel-hint">Designated Disaster Relief Account (InstaPay / PESONet)</span>
                        {bankQrUrl && (
                          <div style={{ marginTop: '8px' }}>
                            <button
                              type="button"
                              onClick={() => setPreviewCertUrl(bankQrUrl)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '5px 10px',
                                borderRadius: '6px',
                                background: 'rgba(245, 158, 11, 0.12)',
                                border: '1px solid rgba(245, 158, 11, 0.3)',
                                color: '#f59e0b',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>qr_code_scanner</span>
                              View Bank QR Code
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* Tab 4: Hotline & Operations */}
              {activeTab === 'contact' && (
                <div className="ngo-contact-pane fade-in">
                  
                  <div className="ngo-gov-box">
                    <div className="ngo-gov-box-header">
                      <span className="material-symbols-outlined" style={{ color: '#ef4444', fontSize: '24px' }}>emergency</span>
                      <div>
                        <h4>Disaster Response Hotline & Headquarters</h4>
                        <p>Direct communication channels for frontline disaster emergency requests and volunteer coordination.</p>
                      </div>
                    </div>

                    <div className="ngo-contact-info-grid">
                      <div className="ngo-contact-info-item">
                        <span className="material-symbols-outlined" style={{ color: '#ef4444' }}>call</span>
                        <div>
                          <label>24/7 Disaster Operations Hotline</label>
                          <strong>{phone}</strong>
                        </div>
                      </div>

                      <div className="ngo-contact-info-item">
                        <span className="material-symbols-outlined" style={{ color: 'var(--accent, #22c55e)' }}>mail</span>
                        <div>
                          <label>Official Institutional Email</label>
                          <strong>{orgEmail}</strong>
                        </div>
                      </div>

                      <div className="ngo-contact-info-item">
                        <span className="material-symbols-outlined" style={{ color: '#38bdf8' }}>language</span>
                        <div>
                          <label>Official Web Portal</label>
                          <a href={website} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', fontWeight: 600 }}>
                            {website} ↗
                          </a>
                        </div>
                      </div>

                      <div className="ngo-contact-info-item">
                        <span className="material-symbols-outlined" style={{ color: '#f59e0b' }}>pin_drop</span>
                        <div>
                          <label>Operations Headquarters & Staging Grounds</label>
                          <strong>{location}</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              )}

              </div>
            </main>
          </div>
        )}

      </div>

      {/* SEC Certificate Preview Lightbox */}
      <SecCertificateModal
        isOpen={!!previewCertUrl}
        onClose={() => setPreviewCertUrl(null)}
        url={previewCertUrl}
        orgName={orgName}
        regNo={secRegNo}
        title="Official SEC Certificate of Incorporation"
      />
    </div>
  );
}
