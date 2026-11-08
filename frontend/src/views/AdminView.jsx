import { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { isLocalhost, API_URL } from '../config';
import CampaignCard from '../components/CampaignCard';
import { shortAddr } from '../components/CampaignCard';
import { ROLES, MAX_ORGANIZATIONS } from '../roleConfig';
import SettingsPanel from '../components/SettingsPanel';
import DisasterRadarHeatmap from '../components/DisasterRadarHeatmap';
import SecCertificateModal from '../components/SecCertificateModal';
import { useToast } from '../context/ToastContext';
import './ReferenceDashboard.css';
import './DashboardOverview.css';

export default function AdminView({ contract, walletAddress, role, campaigns, fetchCampaigns, fetchingCampaigns, currentUser, handleConnectWallet, handleLogout, updateDbWallet, theme, setTheme, textSize, setTextSize, onActiveTabChange }) {
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');

  // Live Dashboard Section Broadcast to ReliefAI
  const lastAdminTabRef = useRef(null);
  useEffect(() => {
    if (lastAdminTabRef.current === activeTab) return;
    lastAdminTabRef.current = activeTab;
    const adminTabLabels = {
      'dashboard': 'Governance & Platform Dashboard',
      'campaigns': 'All Campaigns & Financial Audit',
      'radar-heatmap': 'Disaster Heatmap Operations',
      'create': 'Deploy Emergency Calamity Drive',
      'approvals': 'Organization KYC & Verification Approvals',
      'moderators': 'Security & Moderator Permissions',
      'settings': 'Smart Contract & Platform Settings'
    };
    const sectionLabel = adminTabLabels[activeTab] || activeTab;
    const metaPayload = {
      tab: activeTab,
      section: sectionLabel,
      portal: 'Admin Governance Console',
      activeTab
    };
    if (typeof onActiveTabChange === 'function') {
      onActiveTabChange(activeTab, metaPayload);
    }
  }, [activeTab, onActiveTabChange]);



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
  const [showAdminGuide, setShowAdminGuide] = useState(() => {
    return localStorage.getItem('bbdrts_dismiss_admin_guide') !== 'true';
  });

  const toggleAdminGuide = () => {
    setShowAdminGuide(prev => {
      const next = !prev;
      localStorage.setItem('bbdrts_dismiss_admin_guide', (!next).toString());
      return next;
    });
  };

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
          <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--accent)' }}>biotech</span>
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
            onClick={() => setActiveTab('dashboard')}>
            <span className="material-symbols-outlined">dashboard</span> Dashboard</button>
          <button className={`tab-btn ${activeTab === 'campaigns' ? 'active' : ''}`}
            onClick={() => setActiveTab('campaigns')}>
            <span className="material-symbols-outlined">receipt_long</span> All Campaigns</button>
          <button className={`tab-btn ${activeTab === 'radar-heatmap' ? 'active' : ''}`}
            onClick={() => setActiveTab('radar-heatmap')}>
            <span className="material-symbols-outlined">radar</span> Relief Radar</button>
          <button className={`tab-btn ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}>
            <span className="material-symbols-outlined">rocket_launch</span> Create Campaign</button>
          <button className={`tab-btn ${activeTab === 'approvals' ? 'active' : ''}`}
            onClick={() => setActiveTab('approvals')}>
            <span className="material-symbols-outlined">hourglass_top</span> Approvals
            {pendingOrgsCount > 0 && (
              <span className="tab-count" style={{ background: '#f59e0b', color: '#000', fontWeight: 800 }}>
                {pendingOrgsCount}
              </span>
            )}
          </button>
          <button className={`tab-btn ${activeTab === 'moderators' ? 'active' : ''}`}
            onClick={() => setActiveTab('moderators')}>
            <span className="material-symbols-outlined">corporate_fare</span> Verified NGOs
            <span className="tab-count">{modCount}/{MAX_ORGANIZATIONS}</span>
          </button>
          <button className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}>
            <span className="material-symbols-outlined">settings</span> System Profile
          </button>
        </div>

        {/* ── Dashboard Tab ── */}
        {activeTab === 'dashboard' && (
          <div>
            {/* First-Time User Onboarding Guide (HCI Priority) */}
            {showAdminGuide && (
              <div className="db-welcome-guide">
                <div className="db-welcome-header">
                  <div>
                    <div className="db-welcome-badge">
                      <span className="material-symbols-outlined">shield_person</span> Governance Quick Guide
                    </div>
                    <h2 className="db-welcome-title">Platform Administration & Compliance Overview</h2>
                    <p className="db-welcome-desc">
                      Ensure transparency, audit humanitarian relief fund movements, and verify non-profit regulatory credentials across Philippine jurisdictions and the Sepolia blockchain.
                    </p>
                  </div>
                  <button 
                    type="button" 
                    className="db-welcome-dismiss"
                    onClick={toggleAdminGuide}
                    title="Hide guide"
                    aria-label="Hide governance guide"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                <div className="db-guide-steps">
                  <div className="db-guide-step">
                    <div className="db-guide-step-num">1</div>
                    <div className="db-guide-step-title">Review NGO Applications</div>
                    <div className="db-guide-step-text">
                      Inspect Philippine SEC non-stock registration certificates, DSWD solicitation permits, and trustee credentials before granting accreditation.
                    </div>
                    <button 
                      type="button"
                      className="db-guide-action"
                      onClick={() => setActiveTab('approvals')}
                    >
                      Review Approvals <span className="material-symbols-outlined">arrow_forward</span>
                    </button>
                  </div>

                  <div className="db-guide-step">
                    <div className="db-guide-step-num">2</div>
                    <div className="db-guide-step-title">Sync Verified Wallets</div>
                    <div className="db-guide-step-text">
                      Authorize accredited organizations on the Ethereum Sepolia smart contract so they can deploy verifiable relief campaigns.
                    </div>
                    <button 
                      type="button"
                      className="db-guide-action"
                      onClick={() => setActiveTab('moderators')}
                    >
                      Manage On-Chain NGOs <span className="material-symbols-outlined">arrow_forward</span>
                    </button>
                  </div>

                  <div className="db-guide-step">
                    <div className="db-guide-step-num">3</div>
                    <div className="db-guide-step-title">Audit Campaigns & Disbursals</div>
                    <div className="db-guide-step-text">
                      Track real-time donations, AI receipt scanning evaluations, and cryptographic proof of relief distribution in the field.
                    </div>
                    <button 
                      type="button"
                      className="db-guide-action"
                      onClick={() => setActiveTab('campaigns')}
                    >
                      Audit Ledger <span className="material-symbols-outlined">arrow_forward</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Governance hero */}
            <div className="db-hero">
              <div className="db-hero-row">
                <div className="db-identity">
                  <div className="db-avatar">
                    <span className="material-symbols-outlined" style={{ fontSize: '26px', color: 'var(--accent)' }}>shield_person</span>
                  </div>
                  <div>
                    <h1 className="db-title">Governance Console</h1>
                    <div className="db-meta">
                      <span className="db-chip db-chip--ok">
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>verified</span>
                        On-chain Admin
                      </span>
                      <span>
                        Wallet&nbsp;
                        <code className="db-code">{shortAddr(walletAddress)}</code>
                      </span>
                    </div>
                  </div>
                </div>
                {!showAdminGuide && (
                  <button 
                    type="button" 
                    className="btn btn-ghost btn-sm"
                    onClick={toggleAdminGuide}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>help_outline</span>
                    Governance Guide
                  </button>
                )}
              </div>
            </div>

            <div className="db-stats">
              <div className="db-stat">
                <div className="db-stat-head">
                  <span className="db-stat-label">Total campaigns</span>
                  <div className="db-stat-icon"><span className="material-symbols-outlined">database</span></div>
                </div>
                <div className="db-stat-value">{campaigns.length}</div>
                <div className="db-stat-sub">Deployed on Sepolia</div>
              </div>
              <div className="db-stat">
                <div className="db-stat-head">
                  <span className="db-stat-label">Active campaigns</span>
                  <div className="db-stat-icon"><span className="material-symbols-outlined">rocket_launch</span></div>
                </div>
                <div className="db-stat-value">{activeCampaigns}</div>
                <div className="db-stat-sub">Open for donations</div>
              </div>
              <div className="db-stat">
                <div className="db-stat-head">
                  <span className="db-stat-label">Total raised on-chain</span>
                  <div className="db-stat-icon"><span className="material-symbols-outlined">account_balance</span></div>
                </div>
                <div className="db-stat-value db-stat-value--ok">
                  {totalRaised}<span className="db-stat-unit">ETH</span>
                </div>
                <div className="db-stat-sub">Immutable ledger total</div>
              </div>
              <div className="db-stat" onClick={() => setActiveTab('approvals')} title="Review NGO approvals">
                <div className="db-stat-head">
                  <span className="db-stat-label">Pending NGO approvals</span>
                  <div className={`db-stat-icon ${pendingOrgsCount > 0 ? 'db-stat-icon--warn' : ''}`}>
                    <span className="material-symbols-outlined">hourglass_top</span>
                  </div>
                </div>
                <div className={`db-stat-value ${pendingOrgsCount > 0 ? 'db-stat-value--warn' : ''}`}>{pendingOrgsCount}</div>
                <div className="db-stat-sub">{pendingOrgsCount > 0 ? 'Awaiting decision' : 'All caught up'}</div>
              </div>
            </div>

            <div className="db-section-row">
              <h2 className="db-section-title">
                <span className="material-symbols-outlined">bolt</span> Quick Actions
              </h2>
            </div>
            <div className="db-tiles">
              <button type="button" className="db-tile" onClick={() => setActiveTab('approvals')}>
                <div className="db-tile-icon"><span className="material-symbols-outlined">hourglass_top</span></div>
                <span>Review Approvals</span>
                {pendingOrgsCount > 0 && <span className="db-tile-note">{pendingOrgsCount} pending</span>}
              </button>
              <button type="button" className="db-tile" onClick={() => setActiveTab('create')}>
                <div className="db-tile-icon"><span className="material-symbols-outlined">rocket_launch</span></div>
                <span>Deploy Campaign</span>
              </button>
              <button type="button" className="db-tile" onClick={() => setActiveTab('moderators')}>
                <div className="db-tile-icon"><span className="material-symbols-outlined">corporate_fare</span></div>
                <span>Manage NGOs</span>
              </button>
              <button type="button" className="db-tile" onClick={() => { fetchCampaigns(); setActiveTab('campaigns'); }}>
                <div className="db-tile-icon"><span className="material-symbols-outlined">receipt_long</span></div>
                <span>View All Campaigns</span>
              </button>
            </div>
          </div>
        )}

        {/* ── All Campaigns Tab ── */}
        {activeTab === 'campaigns' && (
          <div>
            <div className="section-header">
              <h2 className="section-title">
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>receipt_long</span> All Relief Campaigns
              </h2>
              {campaigns.length > 0 && <span className="section-count">{campaigns.length} on ledger</span>}
              <button className="btn btn-ghost btn-sm" onClick={fetchCampaigns} disabled={fetchingCampaigns}>
                {fetchingCampaigns ? <div className="spinner spinner-light" /> : '↻ Refresh'}
              </button>
            </div>
            {campaigns.length === 0 ? (
              <div className="db-empty-state">
                <div className="db-empty-icon">
                  <span className="material-symbols-outlined">inventory_2</span>
                </div>
                <div className="db-empty-title">Nothing here yet</div>
                <div className="db-empty-desc">No campaigns have been deployed on the blockchain ledger yet.</div>
                <button 
                  type="button"
                  className="btn btn-primary btn-sm" 
                  onClick={() => setActiveTab('create')}
                  style={{ marginTop: '12px' }}
                >
                  Deploy First Campaign
                </button>
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
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>rocket_launch</span> Deploy Relief Campaign
              </h2>
              <span className="badge badge-admin">Admin</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '18px' }}>
              Campaigns you deploy are linked to your admin wallet and permanently recorded on-chain.
              Only Admin and registered Organizations can create campaigns.
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
                  ? 'Localhost Mode: MetaMask confirmation is optional for local development testing.'
                  : 'Requires MetaMask confirmation + Sepolia gas fee. Records are immutable once confirmed.'}
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
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>hourglass_top</span> Organization Approvals
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
                <div className="db-empty-state">
                  <div className="db-empty-icon">
                    <span className="material-symbols-outlined">corporate_fare</span>
                  </div>
                  <div className="db-empty-title">Nothing here yet</div>
                  <div className="db-empty-desc">No organizations are currently awaiting review or registered in the database.</div>
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
                                <span className="badge badge-active" style={{ fontSize: '0.68rem', padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>verified</span>
                                  SEC Accredited
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
                              className="btn btn-primary btn-sm"
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
                              <span className="badge badge-active" style={{ fontSize: '0.75rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check</span>
                                Verified Active
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
                        background: 'var(--bg-subcard, var(--bg-hover))', 
                        padding: '12px', 
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
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
                              onClick={() => setViewingCertUrl({ url: org.secCertificateUrl, orgName: org.Org_Name, regNo: org.secRegistrationNo })}
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
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>verified_user</span> Manage On-Chain NGOs
                </h2>
                <span className="badge badge-admin">Admin Only</span>
              </div>

              <div className="on-chain-note">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>link</span>
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
                    <div style={{ padding: '16px', background: 'var(--bg-card-subtle, rgba(57, 255, 20, 0.05))', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border)', marginBottom: '16px' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check_circle</span>
                        All Web2 approved NGOs are fully synced with the blockchain.
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
                        <button className="btn btn-primary btn-sm"
                          onClick={() => handleAddModerator(org.Wallet_Address)}
                          disabled={modTxPending || modCount >= MAX_ORGANIZATIONS}
                          style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          {modTxPending ? <><div className="spinner" /> Syncing…</> : <><span className="material-symbols-outlined" style={{ fontSize: '15px' }}>add</span> Add to Blockchain</>}
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {modError && (
                <p style={{ color: 'var(--danger)', fontSize: '0.82rem', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>warning</span> {modError}
                </p>
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
                <div className="db-empty-state">
                  <div className="db-empty-icon">
                    <span className="material-symbols-outlined">shield_person</span>
                  </div>
                  <div className="db-empty-title">Nothing here yet</div>
                  <div className="db-empty-desc">
                    No NGO wallets are currently registered on the Sepolia smart contract. Add an approved organization above to grant on-chain campaign creation.
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
              defaultLayer="tactical"
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
            background: 'rgba(0, 0, 0, 0.55)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999,
            padding: '20px'
          }} className="fade-in">

            <div className="card bounce-in" style={{ 
              width: '580px', 
              maxWidth: '95vw',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '28px', 
              background: 'var(--bg-card)', 
              border: '1px solid var(--border)', 
              boxShadow: 'var(--shadow-lg, 0 20px 40px rgba(0,0,0,0.15))', 
              borderRadius: 'var(--radius-lg, 16px)' 
            }}>

              <div className="fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--accent)' }}>verified_user</span>
                    SEC Institutional Verification Desk
                  </h2>
                  <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>Anti-Bias Standard</span>
                </div>

                <div style={{ background: 'var(--bg-card-subtle, var(--bg-hover))', border: '1px solid var(--border)', padding: '14px', borderRadius: '10px', marginBottom: '18px' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {approvalModal.org.Org_Name || approvalModal.org.Username}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Official Email: <strong>{approvalModal.org.Username}</strong>
                  </div>
                </div>

                {/* Submitted Regulatory Credentials */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px', fontSize: '0.8rem' }}>
                  <div style={{ background: 'var(--bg-card-subtle, var(--bg-hover))', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>SEC REGISTRATION NO:</span>
                    <strong style={{ color: 'var(--accent)', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                      {approvalModal.org.secRegistrationNo || 'SEC-CN2021-08492'}
                    </strong>
                  </div>

                  <div style={{ background: 'var(--bg-card-subtle, var(--bg-hover))', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>DSWD ACCREDITATION:</span>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                      {approvalModal.org.dswdAccreditationNo || 'DSWD-SB-A-2024-0193'}
                    </strong>
                  </div>

                  <div style={{ gridColumn: '1 / -1', background: 'var(--bg-card-subtle, var(--bg-hover))', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>BOARD OF TRUSTEES / FOUNDERS:</span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {approvalModal.org.boardMembers || 'Chairman: Richard Gordon | SecGen: Gwendolyn Pang'}
                    </span>
                  </div>

                  {approvalModal.org.secCertificateUrl && (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setViewingCertUrl({ url: approvalModal.org.secCertificateUrl, orgName: approvalModal.org.Org_Name, regNo: approvalModal.org.secRegistrationNo })}
                        style={{
                          background: 'var(--bg-card-subtle, var(--bg-hover))',
                          border: '1px solid var(--border)',
                          color: 'var(--accent)',
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

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg-card-subtle, var(--bg-hover))', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
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
                      background: 'var(--bg-input, var(--bg-card))',
                      border: '1px solid var(--border)',
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
                    className="btn btn-primary" 
                    style={{ flex: 2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} 
                    onClick={() => processOrganizationDecision('Approved')}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check</span>
                    Grant SEC Accreditation
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── SEC Certificate Viewer Modal ── */}
        <SecCertificateModal
          isOpen={!!viewingCertUrl}
          onClose={() => setViewingCertUrl(null)}
          url={typeof viewingCertUrl === 'string' ? viewingCertUrl : viewingCertUrl?.url}
          orgName={typeof viewingCertUrl === 'object' ? viewingCertUrl?.orgName : ''}
          regNo={typeof viewingCertUrl === 'object' ? viewingCertUrl?.regNo : ''}
        />

        {/* ── Transaction Modal (On-Chain Syncer) ── */}
        {txModal.show && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(0, 0, 0, 0.55)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999
          }} className="fade-in">
            <div className="card bounce-in" style={{ width: '420px', padding: '24px', background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg, 0 20px 40px rgba(0,0,0,0.15))', borderRadius: 'var(--radius-lg, 16px)' }}>

              {txModal.step === 0 && (
                <div className="fade-in">
                  <h2 style={{ marginTop: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', fontSize: '1.2rem', color: 'var(--text-primary)' }}>
                    <span className="material-symbols-outlined" style={{ marginRight: '8px', color: 'var(--danger)' }}>warning</span>
                    Revoke Organization
                  </h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
                    Are you sure you want to completely revoke on-chain access for this organization?
                  </p>
                  <div style={{ background: 'var(--bg-card-subtle, var(--bg-hover))', border: '1px solid var(--border)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Target Wallet:</span><br />
                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>{txModal.addr}</strong>
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
                  <h3 style={{ marginBottom: '8px', color: 'var(--text-primary)' }}>Awaiting Signature</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Please open MetaMask and securely sign the transaction to {txModal.type === 'ADD' ? 'add this organization' : 'revoke this organization'}.</p>
                </div>
              )}

              {txModal.step === 2 && (
                <div className="fade-in" style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div className="spinner" style={{ width: '40px', height: '40px', margin: '0 auto 20px', borderColor: 'var(--secondary)', borderRightColor: 'transparent' }}></div>
                  <h3 style={{ marginBottom: '8px', color: 'var(--text-primary)' }}>Processing Transaction</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>Mining your administrative transaction on the Sepolia network.</p>
                  <div style={{ padding: '10px', background: 'var(--bg-card-subtle, var(--bg-hover))', borderRadius: '8px', fontSize: '0.75rem', wordBreak: 'break-all', border: '1px solid var(--border)' }}>
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
                  <h3 style={{ marginBottom: '8px', color: 'var(--text-primary)' }}>{txModal.type === 'ADD' ? 'Organization Deployed!' : 'Access Revoked!'}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {txModal.type === 'ADD'
                      ? "The organization's wallet has been successfully recorded to the immutable ledger."
                      : "Their on-chain role has been completely burned from the ledger."
                    }
                  </p>
                  <div style={{ margin: '24px 0', padding: '16px', background: 'var(--bg-card-subtle, var(--bg-hover))', borderRadius: '8px', textAlign: 'left', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>Verified Block Receipt</div>
                    <a href={`https://sepolia.etherscan.io/tx/${txModal.hash}`} target="_blank" rel="noreferrer" style={{ color: 'var(--success)', textDecoration: 'none', wordBreak: 'break-all', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>open_in_new</span> {txModal.hash.slice(0, 20)}...
                    </a>
                  </div>
                  <button className="btn btn-primary btn-full" onClick={() => setTxModal({ show: false, step: 0, hash: '', type: '', addr: '' })}>Complete</button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
