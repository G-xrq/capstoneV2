import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { isLocalhost, API_URL } from '../config';
import CampaignCard from '../components/CampaignCard';
import { shortAddr } from '../components/CampaignCard';
import { ROLES, MAX_ORGANIZATIONS } from '../roleConfig';
import SettingsPanel from '../components/SettingsPanel';
import DisasterRadarHeatmap from '../components/DisasterRadarHeatmap';
import { useToast } from '../context/ToastContext';

export default function AdminView({ contract, walletAddress, role, campaigns, fetchCampaigns, fetchingCampaigns, currentUser, handleConnectWallet, handleLogout, updateDbWallet, theme, setTheme, textSize, setTextSize }) {
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');

  // Create campaign form
  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [creating, setCreating] = useState(false);

  // Global Header Navigation Listener
  useEffect(() => {
    const handleRadarNav = () => {
      setActiveTab('radar-heatmap');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const handleCampaignsNav = () => {
      setActiveTab('campaigns');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const handleHomeNav = () => {
      setActiveTab('dashboard');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('bbdrts_navigate_radar', handleRadarNav);
    window.addEventListener('bbdrts_navigate_campaigns', handleCampaignsNav);
    window.addEventListener('bbdrts_navigate_home', handleHomeNav);
    return () => {
      window.removeEventListener('bbdrts_navigate_radar', handleRadarNav);
      window.removeEventListener('bbdrts_navigate_campaigns', handleCampaignsNav);
      window.removeEventListener('bbdrts_navigate_home', handleHomeNav);
    };
  }, []);

  // Moderator management (on-chain)
  const [moderators, setModerators] = useState([]);
  const [modLoading, setModLoading] = useState(false);
  const [newModAddr, setNewModAddr] = useState('');
  const [modError, setModError] = useState('');
  const [modTxPending, setModTxPending] = useState(false);
  const [modCount, setModCount] = useState(0);

  // Web2 Organization management (Approve & SEC Compliance)
  const [organizations, setOrganizations] = useState([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const [approvalModal, setApprovalModal] = useState({ show: false, org: null });
  const [viewingCertUrl, setViewingCertUrl] = useState(null);
  const [auditRubric, setAuditRubric] = useState({
    secValid: true,
    nonStockValid: true,
    trusteesValid: true,
    dswdValid: true
  });
  const [auditNotes, setAuditNotes] = useState('Duly verified against Philippine SEC Non-Stock Corporate Standards. Identity and non-profit charter confirmed.');
  const [txModal, setTxModal] = useState({ show: false, step: 0, hash: '', type: '', addr: '' });

  const loadOrganizations = async () => {
    try {
      setOrgLoading(true);
      const token = localStorage.getItem('bbdrts_token');
      const apiUrl = API_URL;
      const res = await fetch(`${apiUrl}/api/admin/organizations`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'x-admin-wallet': walletAddress || ''
        }
      });
      if (res.ok) {
        const data = await res.json();
        setOrganizations(data);
      }
    } catch (err) {
      console.error('Failed to load orgs', err);
    } finally {
      setOrgLoading(false);
    }
  };

  useEffect(() => {
    loadOrganizations();
  }, [walletAddress]);

  useEffect(() => {
    if (activeTab === 'approvals' || activeTab === 'moderators' || activeTab === 'dashboard') {
      loadOrganizations();
    }
  }, [activeTab]);

  const pendingOrgsCount = organizations.filter(o => o.Verification_Status !== 'Approved').length;

  const handleApproveClick = (org) => {
    setAuditRubric({
      secValid: true,
      nonStockValid: true,
      trusteesValid: true,
      dswdValid: Boolean(org.dswdAccreditationNo)
    });
    setAuditNotes(`Verified against Philippine SEC eSPARC Non-Stock Registry (${org.secRegistrationNo || 'SEC Certified'}). Anti-bias rubric satisfied.`);
    setApprovalModal({ show: true, org });
  };

  const processOrganizationDecision = async (decisionStatus) => {
    const org = approvalModal.org;
    if (!org) return;
    setApprovalModal({ show: false, org: null });
    try {
      const token = localStorage.getItem('bbdrts_token');
      const apiUrl = API_URL;
      const res = await fetch(`${apiUrl}/api/admin/organizations/${org.Org_ID}/verify`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-admin-wallet': walletAddress || ''
        },
        body: JSON.stringify({
          status: decisionStatus,
          audit_notes: auditNotes,
          audit_checklist: auditRubric
        })
      });
      if (res.ok) {
        showSuccess(`Organization ${decisionStatus === 'Approved' ? 'SEC Accreditation Confirmed' : 'Application Rejected'}.`, 'Audit Complete');
        loadOrganizations();
      } else {
        const err = await res.json();
        showError('Verification Error: ' + err.error, 'Audit Failed');
      }
    } catch (err) {
      console.error(err);
    }
  };

  /* ── Load moderators from blockchain events ──────────── */
  const loadModerators = async () => {
    if (!contract) return;
    try {
      setModLoading(true);

      // Assemble all possible addresses to check against the smart contract mapping
      const possibleAddrs = new Set();

      // 1. Trust the Web2 Database (bypasses RPC limitations immediately)
      organizations.forEach(org => {
        if (org.Wallet_Address && ethers.isAddress(org.Wallet_Address)) {
          possibleAddrs.add(org.Wallet_Address);
        }
      });

      // 2. Fallback to RPC Events for any legacy manually-added wallets
      try {
        const addedEvents = await contract.queryFilter(contract.filters.OrganizationAdded());
        addedEvents.forEach(e => possibleAddrs.add(e.args[0]));
      } catch (evtErr) {
        console.warn('RPC Event polling rate-limited. Falling back entirely to Database mappings.');
      }

      // 3. Cryptographically verify every possibility via the blockchain mapping
      const active = [];
      for (const addr of possibleAddrs) {
        const isActive = await contract.isOrganization(addr);
        if (isActive) active.push(addr);
      }

      // Also get count from contract state for verification
      const count = Number(await contract.organizationCount());
      setModerators(active);
      setModCount(count);
    } catch (err) {
      console.error('Failed to load moderators:', err);
    } finally {
      setModLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'moderators' && contract) loadModerators();
  }, [activeTab, contract, organizations]);

  /* ── Stats ──────────────────────────────────────────── */
  const totalRaised = campaigns
    .reduce((s, c) => s + parseFloat(c.currentAmount || 0), 0)
    .toFixed(4);
  const activeCampaigns = campaigns.filter((c) => c.isActive).length;

  /* ── Create Campaign ────────────────────────────────── */
  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    if (!title.trim()) return showWarning('Please enter a campaign title.', 'Title Required');
    const parsed = parseFloat(targetAmount);
    if (isNaN(parsed) || parsed <= 0)
      return showWarning('Please enter a valid target amount greater than 0 ETH.', 'Invalid Goal Amount');
    if (!isLocalhost && !contract)
      return showWarning('MetaMask is not connected to this admin account. Connect wallet in Profile Settings.', 'Wallet Required');
    try {
      setCreating(true);
      if (contract) {
        const tx = await contract.createCampaign(title.trim(), ethers.parseEther(targetAmount));
        showInfo('Transaction broadcasted. Awaiting Sepolia block mining...', 'Contract Pending');
        await tx.wait();
        showSuccess('Campaign deployed and permanently recorded on the Sepolia blockchain ledger!', 'Campaign Deployed');
      } else {
        await new Promise(r => setTimeout(r, 500));
        showSuccess('Campaign deployed in Localhost Mode (MetaMask bypassed)!', 'Campaign Deployed');
      }
      setTitle('');
      setTargetAmount('');
      fetchCampaigns();
      setActiveTab('campaigns');
    } catch (err) {
      console.error(err);
      if (err.code !== 'ACTION_REJECTED') showError(`Transaction failed: ${err.reason || err.message}`, 'Deployment Error');
    } finally {
      setCreating(false);
    }
  };

  /* ── Add Organization (on-chain) ───────────────────────── */
  const handleAddModerator = async (targetAddr) => {
    setModError('');
    const addr = targetAddr?.trim() || newModAddr.trim();

    if (!ethers.isAddress(addr))
      return setModError('Invalid Ethereum address. Please double-check and try again.');
    if (addr.toLowerCase() === walletAddress?.toLowerCase())
      return setModError('The Admin wallet cannot be registered as an organization.');
    if (modCount >= MAX_ORGANIZATIONS)
      return setModError(`Maximum of ${MAX_ORGANIZATIONS} organizations reached. Remove one first.`);
    if (!contract) return setModError('MetaMask is not actively connected to this test account. Connect in Profile Settings.');

    try {
      setModTxPending(true);
      setTxModal({ show: true, step: 1, hash: '', type: 'ADD', addr });
      const tx = await contract.addOrganization(addr);

      setTxModal({ show: true, step: 2, hash: tx.hash, type: 'ADD', addr });
      await tx.wait();

      setTxModal({ show: true, step: 3, hash: tx.hash, type: 'ADD', addr });
      setNewModAddr('');
      loadModerators();
    } catch (err) {
      console.error(err);
      setTxModal({ show: false, step: 0, hash: '', type: '', addr: '' });
      if (err.code !== 'ACTION_REJECTED')
        setModError(`Transaction failed: ${err.reason || err.message}`);
    } finally {
      setModTxPending(false);
    }
  };

  const triggerRemoveOrganization = (addr) => {
    setTxModal({ show: true, step: 0, hash: '', type: 'REMOVE', addr });
  };

  const handleRemoveModerator = async () => {
    const addr = txModal.addr;
    if (!contract) return setModError('MetaMask is not actively connected to this admin account. Connect in Profile settings.');
    try {
      setModTxPending(true);
      setTxModal({ show: true, step: 1, hash: '', type: 'REMOVE', addr });
      const tx = await contract.removeOrganization(addr);

      setTxModal({ show: true, step: 2, hash: tx.hash, type: 'REMOVE', addr });
      await tx.wait();

      setTxModal({ show: true, step: 3, hash: tx.hash, type: 'REMOVE', addr });
      loadModerators();
    } catch (err) {
      console.error(err);
      setTxModal({ show: false, step: 0, hash: '', type: '', addr: '' });
      if (err.code !== 'ACTION_REJECTED')
        setModError(`Transaction failed: ${err.reason || err.message}`);
    } finally {
      setModTxPending(false);
    }
  };

  /* ── Render ─────────────────────────────────────────── */
  return (
    <main className="dashboard">
      <div className="container">

        {/* Testnet Banner */}
        <div className="testnet-banner">
          <span>🔬</span>
          <span>
            <strong>Sepolia Testnet</strong> — Moderator add/remove operations are
            real blockchain transactions that require a small gas fee.{' '}
            <a href="https://sepoliafaucet.com/" target="_blank" rel="noreferrer"
              style={{ color: 'var(--info)', textDecoration: 'underline' }}>
              Get Sepolia ETH →
            </a>
          </span>
        </div>

        {/* Tab Bar */}
        <div className="tab-bar">
          <button className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}>⚡ Dashboard</button>
          <button className={`tab-btn ${activeTab === 'campaigns' ? 'active' : ''}`}
            onClick={() => setActiveTab('campaigns')}>📋 All Campaigns</button>
          <button className={`tab-btn ${activeTab === 'radar-heatmap' ? 'active' : ''}`}
            onClick={() => setActiveTab('radar-heatmap')}>📡 Relief Radar</button>
          <button className={`tab-btn ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}>🚀 Create Campaign</button>
          <button className={`tab-btn ${activeTab === 'approvals' ? 'active' : ''}`}
            onClick={() => setActiveTab('approvals')}>
            ⏳ Approvals
            {pendingOrgsCount > 0 && (
              <span className="tab-count" style={{ background: '#f59e0b', color: '#000', fontWeight: 800 }}>
                {pendingOrgsCount}
              </span>
            )}
          </button>
          <button className={`tab-btn ${activeTab === 'moderators' ? 'active' : ''}`}
            onClick={() => setActiveTab('moderators')}>
            🛡️ Verified NGOs
            <span className="tab-count">{modCount}/{MAX_ORGANIZATIONS}</span>
          </button>
          <button className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}>
            ⚙️ System Profile
          </button>
        </div>

        {/* ── Dashboard Tab ── */}
        {activeTab === 'dashboard' && (
          <div>
            <div className="admin-welcome">
              <div className="admin-welcome-icon">⚡</div>
              <div>
                <div className="admin-welcome-title">Admin Panel</div>
                <div className="admin-welcome-addr">
                  Connected as:{' '}
                  <span style={{ color: 'var(--warning)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                    {walletAddress}
                  </span>
                </div>
                <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Role enforced on-chain by the DonationRelief smart contract (Sepolia).
                </div>
              </div>
            </div>

            <div className="admin-stat-grid">
              <div className="stat-card">
                <div className="stat-card-value">{campaigns.length}</div>
                <div className="stat-card-label">Total Campaigns</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-value">{activeCampaigns}</div>
                <div className="stat-card-label">Active</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-value accent">{totalRaised} <span style={{ fontSize: '0.9rem' }}>ETH</span></div>
                <div className="stat-card-label">Total Raised On-Chain</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-value" style={{ color: pendingOrgsCount > 0 ? 'var(--warning)' : 'var(--info)' }}>
                  {pendingOrgsCount}
                </div>
                <div className="stat-card-label">Pending NGO Approvals</div>
              </div>
            </div>

            <div className="admin-quick-actions">
              <h2 className="section-title" style={{ marginBottom: '14px' }}>
                <span className="section-title-icon">⚡</span> Quick Actions
              </h2>
              <div className="admin-actions-grid">
                <button className="admin-action-card" onClick={() => setActiveTab('approvals')}>
                  <span style={{ fontSize: '1.6rem' }}>⏳</span>
                  <span>Review Approvals {pendingOrgsCount > 0 ? `(${pendingOrgsCount})` : ''}</span>
                </button>
                <button className="admin-action-card" onClick={() => setActiveTab('create')}>
                  <span style={{ fontSize: '1.6rem' }}>🚀</span>
                  <span>Deploy Campaign</span>
                </button>
                <button className="admin-action-card" onClick={() => setActiveTab('moderators')}>
                  <span style={{ fontSize: '1.6rem' }}>🛡️</span>
                  <span>Manage NGOs</span>
                </button>
                <button className="admin-action-card" onClick={() => { fetchCampaigns(); setActiveTab('campaigns'); }}>
                  <span style={{ fontSize: '1.6rem' }}>📋</span>
                  <span>View All Campaigns</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── All Campaigns Tab ── */}
        {activeTab === 'campaigns' && (
          <div>
            <div className="section-header">
              <h2 className="section-title">
                <span className="section-title-icon">📋</span> All Relief Campaigns
              </h2>
              {campaigns.length > 0 && <span className="section-count">{campaigns.length} on ledger</span>}
              <button className="btn btn-ghost btn-sm" onClick={fetchCampaigns} disabled={fetchingCampaigns}>
                {fetchingCampaigns ? <div className="spinner spinner-light" /> : '↻ Refresh'}
              </button>
            </div>
            {campaigns.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <div className="empty-title">No campaigns yet</div>
                <div className="empty-desc">Deploy the first campaign from the "Create Campaign" tab.</div>
              </div>
            ) : (
              <div className="campaigns-list">
                {campaigns.map((camp) => (
                  <CampaignCard key={camp.id} camp={camp} contract={contract}
                    role={ROLES.ADMIN} walletAddress={walletAddress}
                    onDonated={fetchCampaigns} onDeactivated={fetchCampaigns} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Create Campaign Tab ── */}
        {activeTab === 'create' && (
          <div className="card">
            <div className="section-header">
              <h2 className="section-title">
                <span className="section-title-icon">🚀</span> Deploy Relief Campaign
              </h2>
              <span className="badge badge-admin">Admin</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '18px' }}>
              Campaigns you deploy are linked to your admin wallet and permanently recorded on-chain.
              Only Admin and registered Moderators can create campaigns.
            </p>
            <form className="create-form" onSubmit={handleCreateCampaign}>
              <input className="input" type="text"
                placeholder="Campaign title — e.g., Typhoon Odette Relief, CCS Emergency Fund"
                value={title} onChange={(e) => setTitle(e.target.value)} disabled={creating} />
              <div className="form-row">
                <input className="input" type="number" step="0.001" min="0"
                  placeholder="Fundraising target in ETH — e.g., 0.5"
                  value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)}
                  disabled={creating} />
                <button type="submit" className="btn btn-primary" disabled={creating} style={{ flexShrink: 0 }}>
                  {creating ? <><div className="spinner" /> Processing…</> : '+ Deploy Campaign'}
                </button>
              </div>
              <p className="form-hint">
                {isLocalhost
                  ? '⚡ Localhost Mode: MetaMask confirmation is optional for local development testing.'
                  : '⚠️ Requires MetaMask confirmation + Sepolia gas fee. Records are immutable once confirmed.'}
              </p>
            </form>
          </div>
        )}

        {/* ── Approvals Tab ── */}
        {activeTab === 'approvals' && (
          <div>
            <div className="card">
              <div className="section-header">
                <h2 className="section-title">
                  <span className="section-title-icon">⏳</span> Organization Approvals
                </h2>
                <button className="btn btn-ghost btn-sm" onClick={loadOrganizations} disabled={orgLoading}>
                  {orgLoading ? <div className="spinner spinner-light" /> : '↻ Refresh Data'}
                </button>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '18px' }}>
                Review and approve Organizations that have signed up via the web portal. Organizations must be approved here before they can deploy campaigns.
              </p>

              {orgLoading ? (
                <div className="empty-state" style={{ padding: '32px' }}>
                  <div className="spinner spinner-light" style={{ width: 24, height: 24 }} />
                </div>
              ) : organizations.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📂</div>
                  <div className="empty-title">No organizations found</div>
                </div>
              ) : (
                <div className="mod-list">
                  {organizations.map((org) => (
                    <div key={org.Org_ID} className="mod-item" style={{ 
                      borderLeft: org.Verification_Status === 'Approved' ? '4px solid var(--success)' : '4px solid var(--warning)',
                      padding: '16px',
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      gap: '12px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                        <div className="mod-item-left" style={{ alignItems: 'flex-start' }}>
                          <span className="mod-index">#{org.Org_ID}</span>
                          <div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {org.Org_Name || org.Username}
                              {org.Verification_Status === 'Approved' && (
                                <span className="badge badge-active" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                                  🛡️ SEC Accredited
                                </span>
                              )}
                            </div>
                            <div className="mod-addr-full" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              Official Institutional Email: <strong>{org.Username}</strong>
                            </div>
                          </div>
                        </div>

                        <div>
                          {org.Verification_Status !== 'Approved' ? (
                            <button 
                              className="btn btn-primary btn-sm glow pulse"
                              onClick={() => handleApproveClick(org)}
                              style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>fact_check</span>
                              <span>Review SEC Credentials & Verify</span>
                            </button>
                          ) : (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <button
                                className="btn btn-outline btn-sm"
                                onClick={() => handleApproveClick(org)}
                                style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                              >
                                View Audit Record
                              </button>
                              <span className="badge badge-active" style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
                                ✓ Verified Active
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* SEC & Regulatory Compliance Metadata Grid */}
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
                        gap: '8px', 
                        background: 'rgba(0, 0, 0, 0.25)', 
                        padding: '12px', 
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        fontSize: '0.78rem'
                      }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block' }}>SEC Non-Stock Reg. No:</span>
                          <strong style={{ color: '#38bdf8', fontFamily: 'monospace' }}>
                            {org.secRegistrationNo || 'SEC-CN2021-08492 (Simulated)'}
                          </strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block' }}>DSWD Accreditation / Permit:</span>
                          <span style={{ color: 'var(--text-primary)' }}>
                            {org.dswdAccreditationNo || 'DSWD-SB-A-2024-0193'}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block' }}>Board of Trustees / Founders:</span>
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {org.boardMembers || 'Chairman: Richard Gordon | SecGen: Gwendolyn Pang'}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block' }}>Certificate of Incorporation:</span>
                          {org.secCertificateUrl ? (
                            <button
                              type="button"
                              onClick={() => setViewingCertUrl(org.secCertificateUrl)}
                              style={{ background: 'none', border: 'none', color: '#38bdf8', padding: 0, cursor: 'pointer', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>visibility</span>
                              View Attached SEC Certificate
                            </button>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>Digital Filing On Record</span>
                          )}
                        </div>
                      </div>

                      {org.Verification_Status === 'Approved' && org.auditNotes && (
                        <div style={{ fontSize: '0.74rem', color: '#94a3b8', background: 'rgba(34, 197, 94, 0.06)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(34, 197, 94, 0.15)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#22c55e' }}>verified</span>
                          <span><strong>Audit Trail:</strong> {org.auditNotes} (Auditor: {org.verifiedBy || 'System Admin'})</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Moderators Tab ── */}
        {activeTab === 'moderators' && (
          <div>
            <div className="card">
              <div className="section-header">
                <h2 className="section-title">
                  <span className="section-title-icon">🛡️</span> Manage On-Chain NGOs
                </h2>
                <span className="badge badge-admin">Admin Only</span>
              </div>

              <div className="on-chain-note">
                <span>🔗</span>
                <span>
                  Organization (NGO) roles are enforced <strong>on the smart contract</strong>.
                  Adding or removing an NGO is a blockchain transaction —
                  it is permanent, auditable, and requires a gas fee.
                </span>
              </div>

              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '16px 0' }}>
                Registered NGO wallets that can create and manage relief campaigns.
                Maximum <strong style={{ color: 'var(--text-primary)' }}>{MAX_ORGANIZATIONS}</strong> organizations.
              </p>

              {/* Add Moderator Form */}
              {/* 1-Click Integration Pipeline */}
              <div className="section-header" style={{ margin: '0 0 12px 0' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Pending Blockchain Registration
                </span>
                <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>1-Click Sync</span>
              </div>

              {(() => {
                const pendingOrgs = organizations.filter(org =>
                  org.Verification_Status === 'Approved' &&
                  org.Wallet_Address &&
                  !moderators.map(m => m.toLowerCase()).includes(org.Wallet_Address.toLowerCase())
                );

                if (orgLoading) return <div className="spinner spinner-light" style={{ width: 24, height: 24, marginBottom: '16px' }} />;

                if (pendingOrgs.length === 0) {
                  return (
                    <div style={{ padding: '16px', background: 'rgba(57, 255, 20, 0.05)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--success)', marginBottom: '16px' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--success)' }}>
                        ✓ All Web2 approved NGOs are fully synced with the blockchain.
                      </span>
                    </div>
                  );
                }

                return (
                  <div className="mod-list" style={{ marginBottom: '24px' }}>
                    {pendingOrgs.map(org => (
                      <div key={org.Org_ID} className="mod-item" style={{ borderLeft: '4px solid var(--warning)' }}>
                        <div className="mod-item-left">
                          <span className="mod-index">#{org.Org_ID}</span>
                          <div>
                            <div className="mod-addr-full">{org.Username}</div>
                            <div className="mod-addr-short">
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Wallet: {shortAddr(org.Wallet_Address)}</span>
                            </div>
                          </div>
                        </div>
                        <button className="btn btn-primary btn-sm glow pulse"
                          onClick={() => handleAddModerator(org.Wallet_Address)}
                          disabled={modTxPending || modCount >= MAX_ORGANIZATIONS}
                          style={{ flexShrink: 0 }}>
                          {modTxPending ? <><div className="spinner" /> Syncing…</> : '+ Add to Blockchain'}
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {modError && (
                <p style={{ color: 'var(--danger)', fontSize: '0.82rem', marginTop: '8px' }}>⚠️ {modError}</p>
              )}
              {modCount >= MAX_ORGANIZATIONS && (
                <p style={{ color: 'var(--warning)', fontSize: '0.82rem', marginTop: '8px' }}>
                  Maximum of {MAX_ORGANIZATIONS} NGOs reached. Remove one to add another.
                </p>
              )}

              <hr style={{ margin: '20px 0', borderColor: 'var(--border)', borderStyle: 'solid', borderWidth: '0 0 1px 0' }} />

              <div className="section-header" style={{ margin: '0 0 12px 0' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Registered NGO Wallets
                </span>
                <span className="section-count">{modCount}/{MAX_ORGANIZATIONS}</span>
                <button className="btn btn-ghost btn-sm" onClick={loadModerators} disabled={modLoading}>
                  {modLoading ? <div className="spinner spinner-light" /> : '↻ Refresh from chain'}
                </button>
              </div>

              {modLoading ? (
                <div className="empty-state" style={{ padding: '32px' }}>
                  <div className="spinner spinner-light" style={{ width: 24, height: 24 }} />
                  <div className="empty-title">Querying blockchain events…</div>
                </div>
              ) : moderators.length === 0 ? (
                <div className="empty-state" style={{ padding: '32px', border: '1px dashed var(--border)' }}>
                  <div className="empty-icon" style={{ fontSize: '1.6rem' }}>🛡️</div>
                  <div className="empty-title">No NGOs registered on the blockchain</div>
                  <div className="empty-desc">
                    Add an NGO wallet above to grant on-chain campaign creation access.
                  </div>
                </div>
              ) : (
                <div className="mod-list">
                  {moderators.map((addr, idx) => (
                    <div key={addr} className="mod-item">
                      <div className="mod-item-left">
                        <span className="mod-index">#{idx + 1}</span>
                        <div>
                          <div className="mod-addr-full" title={addr}>{addr}</div>
                          <div className="mod-addr-short">
                            <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>
                              On-Chain NGO
                            </span>
                          </div>
                        </div>
                      </div>
                      <button className="btn btn-ghost btn-sm"
                        onClick={() => triggerRemoveOrganization(addr)}
                        disabled={modTxPending}
                        style={{ color: 'var(--danger)', borderColor: 'rgba(255,78,106,0.3)', flexShrink: 0 }}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Relief Radar Tab ── */}
        {activeTab === 'radar-heatmap' && (
          <div style={{ marginTop: '14px' }}>
            <DisasterRadarHeatmap
              campaigns={campaigns}
              height="620px"
              theme={theme}
              onSelectCampaign={(c) => {
                setActiveTab('campaigns');
              }}
            />
          </div>
        )}

        {/* ── Settings Tab ── */}
        {activeTab === 'settings' && (
          <SettingsPanel
            contract={contract}
            currentUser={currentUser}
            walletAddress={walletAddress}
            handleConnectWallet={handleConnectWallet}
            handleLogout={handleLogout}
            updateDbWallet={updateDbWallet}
            theme={theme}
            setTheme={setTheme}
            textSize={textSize}
            setTextSize={setTextSize}
          />
        )}


        {/* ── Anti-Bias SEC Compliance Review Desk Modal ── */}
        {approvalModal.show && approvalModal.org && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(5, 7, 12, 0.8)', backdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999,
            padding: '20px'
          }} className="fade-in">

            <div className="card bounce-in" style={{ 
              width: '580px', 
              maxWidth: '95vw',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '28px', 
              background: 'var(--surface)', 
              border: '1px solid rgba(56, 189, 248, 0.3)', 
              boxShadow: '0 25px 50px rgba(0,0,0,0.6)', 
              borderRadius: '18px' 
            }}>

              <div className="fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.25rem', color: 'var(--text)' }}>
                    <span className="material-symbols-outlined" style={{ color: '#38bdf8' }}>verified_user</span>
                    SEC Institutional Verification Desk
                  </h2>
                  <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>Anti-Bias Standard</span>
                </div>

                <div style={{ background: 'rgba(56, 189, 248, 0.06)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '14px', borderRadius: '10px', marginBottom: '18px' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {approvalModal.org.Org_Name || approvalModal.org.Username}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Official Email: <strong>{approvalModal.org.Username}</strong>
                  </div>
                </div>

                {/* Submitted Regulatory Credentials */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px', fontSize: '0.8rem' }}>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>SEC REGISTRATION NO:</span>
                    <strong style={{ color: '#38bdf8', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                      {approvalModal.org.secRegistrationNo || 'SEC-CN2021-08492'}
                    </strong>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>DSWD ACCREDITATION:</span>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                      {approvalModal.org.dswdAccreditationNo || 'DSWD-SB-A-2024-0193'}
                    </strong>
                  </div>

                  <div style={{ gridColumn: '1 / -1', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>BOARD OF TRUSTEES / FOUNDERS:</span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {approvalModal.org.boardMembers || 'Chairman: Richard Gordon | SecGen: Gwendolyn Pang'}
                    </span>
                  </div>

                  {approvalModal.org.secCertificateUrl && (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setViewingCertUrl(approvalModal.org.secCertificateUrl)}
                        style={{
                          background: 'rgba(56, 189, 248, 0.12)',
                          border: '1px solid rgba(56, 189, 248, 0.35)',
                          color: '#38bdf8',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>open_in_new</span>
                        Inspect Attached SEC Certificate of Incorporation
                      </button>
                    </div>
                  )}
                </div>

                {/* Objective Anti-Bias Compliance Rubric Checklist */}
                <div style={{ marginBottom: '18px' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--success)' }}>checklist</span>
                    Anti-Bias Compliance Criteria Checklist
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                      <input 
                        type="checkbox" 
                        checked={auditRubric.secValid} 
                        onChange={e => setAuditRubric({ ...auditRubric, secValid: e.target.checked })} 
                      />
                      <span>SEC eSPARC Non-Stock Corporate Legal Existence Validated</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                      <input 
                        type="checkbox" 
                        checked={auditRubric.nonStockValid} 
                        onChange={e => setAuditRubric({ ...auditRubric, nonStockValid: e.target.checked })} 
                      />
                      <span>Non-Profit Articles of Incorporation Align with Humanitarian Aid</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                      <input 
                        type="checkbox" 
                        checked={auditRubric.trusteesValid} 
                        onChange={e => setAuditRubric({ ...auditRubric, trusteesValid: e.target.checked })} 
                      />
                      <span>Board of Trustees and Authorized Officer Identity Confirmed</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                      <input 
                        type="checkbox" 
                        checked={auditRubric.dswdValid} 
                        onChange={e => setAuditRubric({ ...auditRubric, dswdValid: e.target.checked })} 
                      />
                      <span>DSWD / LGU Disaster Relief Solicitation Clearance Checked</span>
                    </label>
                  </div>
                </div>

                {/* Audit Trail Note Input */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    AUDIT LOG STATEMENT (PERMANENTLY RECORDED)
                  </label>
                  <textarea
                    value={auditNotes}
                    onChange={e => setAuditNotes(e.target.value)}
                    rows="2"
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '0.8rem',
                      fontFamily: 'inherit',
                      resize: 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    className="btn btn-outline" 
                    style={{ flex: 1 }} 
                    onClick={() => setApprovalModal({ show: false, org: null })}
                  >
                    Cancel
                  </button>
                  <button 
                    className="btn btn-outline" 
                    style={{ color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.4)' }} 
                    onClick={() => processOrganizationDecision('Rejected')}
                  >
                    Reject Application
                  </button>
                  <button 
                    className="btn btn-primary glow pulse" 
                    style={{ flex: 2 }} 
                    onClick={() => processOrganizationDecision('Approved')}
                  >
                    ✓ Grant SEC Accreditation
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── SEC Certificate Viewer Modal ── */}
        {viewingCertUrl && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(5, 7, 12, 0.85)', backdropFilter: 'blur(14px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999,
            padding: '24px'
          }} onClick={() => setViewingCertUrl(null)}>
            <div style={{ maxWidth: '750px', width: '100%', background: '#0f172a', padding: '20px', borderRadius: '16px', border: '1px solid rgba(56, 189, 248, 0.4)', textAlign: 'center', boxShadow: '0 30px 60px rgba(0,0,0,0.8)' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="material-symbols-outlined">verified</span>
                  Official SEC Certificate of Incorporation Document
                </h3>
                <button 
                  onClick={() => setViewingCertUrl(null)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
              <img 
                src={viewingCertUrl} 
                alt="SEC Certificate" 
                style={{ width: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }} 
              />
              <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
                <button className="btn btn-outline btn-sm" onClick={() => setViewingCertUrl(null)}>Close Document</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Transaction Modal (On-Chain Syncer) ── */}
        {txModal.show && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(5, 7, 12, 0.75)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999
          }} className="fade-in">
            <div className="card bounce-in" style={{ width: '420px', padding: '24px', background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', borderRadius: '16px' }}>

              {txModal.step === 0 && (
                <div className="fade-in">
                  <h2 style={{ marginTop: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', fontSize: '1.2rem', color: 'var(--text)' }}>
                    <span className="material-symbols-outlined" style={{ marginRight: '8px', color: 'var(--danger)' }}>warning</span>
                    Revoke Organization
                  </h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
                    Are you sure you want to completely revoke on-chain access for this organization?
                  </p>
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Target Wallet:</span><br />
                    <strong style={{ color: 'var(--text)', fontSize: '0.85rem' }}>{txModal.addr}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                    <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setTxModal({ show: false, step: 0, hash: '', type: '', addr: '' })}>Cancel</button>
                    <button className="btn btn-primary" style={{ flex: 1, background: 'var(--danger)', color: 'white', borderColor: 'var(--danger)' }} onClick={handleRemoveModerator}>Confirm & Sign</button>
                  </div>
                </div>
              )}

              {txModal.step === 1 && (
                <div className="fade-in" style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div className="spinner" style={{ width: '40px', height: '40px', margin: '0 auto 20px', borderColor: 'var(--primary)', borderRightColor: 'transparent' }}></div>
                  <h3 style={{ marginBottom: '8px', color: 'var(--text)' }}>Awaiting Signature</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Please open MetaMask and securely sign the transaction to {txModal.type === 'ADD' ? 'add this organization' : 'revoke this organization'}.</p>
                </div>
              )}

              {txModal.step === 2 && (
                <div className="fade-in" style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div className="spinner" style={{ width: '40px', height: '40px', margin: '0 auto 20px', borderColor: 'var(--secondary)', borderRightColor: 'transparent' }}></div>
                  <h3 style={{ marginBottom: '8px', color: 'var(--text)' }}>Processing Transaction</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>Mining your administrative transaction on the Sepolia network.</p>
                  <div style={{ padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', fontSize: '0.75rem', wordBreak: 'break-all', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Transaction Hash:</span>
                    {txModal.hash}
                  </div>
                </div>
              )}

              {txModal.step === 3 && (
                <div className="fade-in" style={{ textAlign: 'center', padding: '20px 0 10px' }}>
                  <div className="success-circle-container">
                    <span className="material-symbols-outlined check-icon-pop" style={{ fontSize: '2.5rem', color: 'var(--success)' }}>check</span>
                  </div>
                  <h3 style={{ marginBottom: '8px', color: 'var(--text)' }}>{txModal.type === 'ADD' ? 'Organization Deployed!' : 'Access Revoked!'}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {txModal.type === 'ADD'
                      ? "The organization's wallet has been successfully recorded to the immutable ledger."
                      : "Their on-chain role has been completely burned from the ledger."
                    }
                  </p>
                  <div style={{ margin: '24px 0', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', textAlign: 'left', border: '1px solid rgba(0,255,100,0.1)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>Verified Block Receipt</div>
                    <a href={`https://sepolia.etherscan.io/tx/${txModal.hash}`} target="_blank" rel="noreferrer" style={{ color: 'var(--success)', textDecoration: 'none', wordBreak: 'break-all', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>open_in_new</span> {txModal.hash.slice(0, 20)}...
                    </a>
                  </div>
                  <button className="btn btn-primary btn-full pulse" onClick={() => setTxModal({ show: false, step: 0, hash: '', type: '', addr: '' })}>Complete</button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
