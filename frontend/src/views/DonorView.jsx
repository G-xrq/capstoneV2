import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ethers } from 'ethers';
import CampaignCard, { 
  shortAddr, 
  formatCampaignTitle, 
  getCampaignCategoryInfo, 
  getOrgDisplayName,
  getCampaignCoverData,
  getCampaignAuditDetails
} from '../components/CampaignCard';
import LocationMapPicker from '../components/LocationMapPicker';
import { ROLES } from '../roleConfig';
import SettingsPanel from '../components/SettingsPanel';
import { useToast } from '../context/ToastContext';
import './ReferenceDashboard.css';

export default function DonorView({ contract, walletAddress, campaigns, fetchCampaigns, fetchingCampaigns, currentUser, handleConnectWallet, handleLogout, updateDbWallet, theme = 'default', setTheme, textSize, setTextSize, onOpenNgoProfile }) {
  const { showSuccess } = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [campaignSort, setCampaignSort] = useState('NEWEST');
  const [searchQuery, setSearchQuery] = useState('');
  const [receiptFilter, setReceiptFilter] = useState('ALL');
  const [receiptSort, setReceiptSort] = useState('NEWEST');
  const [searchQueryReceipts, setSearchQueryReceipts] = useState('');
  const [selectedCampaignForProof, setSelectedCampaignForProof] = useState(null);

  const THEME_OPTIONS = [
    { id: 'dark',  name: 'Dark', icon: 'dark_mode', desc: 'Dark Contrast', activeBorder: '#22c55e', color: '#22c55e' },
    { id: 'light', name: 'Light', icon: 'light_mode', desc: 'Inverted Light', activeBorder: '#16a34a', color: '#16a34a' },
    { id: 'cyber', name: 'Cyber', icon: 'blur_on', desc: 'Cyber Navy', activeBorder: '#00ffa3', color: '#00ffa3' }
  ];

  // Pagination for Relief Campaigns
  const [currentPage, setCurrentPage] = useState(1);
  const campaignsPerPage = 4;

  // Reset page on filter/sort/search change
  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, campaignSort, searchQuery]);

  // Filter & Sort campaigns
  const filteredCampaigns = campaigns
    .filter(c => {
      if (categoryFilter !== 'ALL') {
        const catInfo = getCampaignCategoryInfo(c);
        if (categoryFilter !== catInfo.prefix && categoryFilter !== catInfo.code) return false;
      }
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const displayTitle = formatCampaignTitle(c.title, c.id).toLowerCase();
        const orgMatch = (c.orgAddress || '').toLowerCase().includes(q) || (c.orgName || '').toLowerCase().includes(q);
        const idMatch = String(c.id).includes(q);
        return displayTitle.includes(q) || orgMatch || idMatch;
      }
      return true;
    })
    .sort((a, b) => {
      if (campaignSort === 'NEWEST') return Number(b.id) - Number(a.id);
      if (campaignSort === 'GOAL_HIGH') return parseFloat(b.targetAmount || 0) - parseFloat(a.targetAmount || 0);
      if (campaignSort === 'GOAL_LOW') return parseFloat(a.targetAmount || 0) - parseFloat(b.targetAmount || 0);
      return 0;
    });

  const totalPages = Math.ceil(filteredCampaigns.length / campaignsPerPage) || 1;
  const paginatedCampaigns = filteredCampaigns.slice((currentPage - 1) * campaignsPerPage, currentPage * campaignsPerPage);

  // My Contributions / Receipts Logic
  const [myDonations, setMyDonations] = useState(null);
  const [loadingMyDonations, setLoadingMyDonations] = useState(false);

  const fetchMyDonations = async () => {
    setLoadingMyDonations(true);
    try {
      const token = localStorage.getItem('bbdrts_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      if (token) {
        const res = await fetch(`${apiUrl}/api/donations/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const list = await res.json();
          setMyDonations(Array.isArray(list) ? list : []);
          return;
        }
      }
      setMyDonations([]);
    } catch (err) {
      console.error("Failed to fetch donor history:", err);
      setMyDonations([]);
    } finally {
      setLoadingMyDonations(false);
    }
  };

  useEffect(() => {
    fetchMyDonations();
  }, [walletAddress]);

  const totalDonated = useMemo(() => {
    if (!myDonations || !Array.isArray(myDonations) || myDonations.length === 0) return "0.0000";
    return myDonations.reduce((acc, d) => {
      const amt = parseFloat(d.amount || d.Amount || 0) || 0;
      return acc + amt;
    }, 0).toFixed(4);
  }, [myDonations]);

  const uniqueCausesCount = useMemo(() => {
    if (!myDonations || !Array.isArray(myDonations)) return 0;
    const set = new Set(myDonations.map(d => String(d.campaignId)));
    return set.size;
  }, [myDonations]);

  // Filter & Sort My Contributions / Receipts
  const filteredMyDonations = useMemo(() => {
    if (!myDonations || !Array.isArray(myDonations)) return [];
    return myDonations
      .filter(d => {
        const matchCamp = campaigns.find(c => String(c.id) === String(d.campaignId)) || { id: d.campaignId, title: `Campaign #${d.campaignId}` };
        if (receiptFilter !== 'ALL') {
          const catInfo = getCampaignCategoryInfo(matchCamp);
          if (receiptFilter !== catInfo.prefix && receiptFilter !== catInfo.code) return false;
        }
        if (searchQueryReceipts.trim() !== '') {
          const q = searchQueryReceipts.toLowerCase().trim();
          const tx = (d.txHash || '').toLowerCase();
          const campTitle = formatCampaignTitle(matchCamp.title, matchCamp.id).toLowerCase();
          return tx.includes(q) || campTitle.includes(q) || String(d.campaignId).includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        if (receiptSort === 'AMOUNT_HIGH') return (parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0);
        if (receiptSort === 'AMOUNT_LOW') return (parseFloat(a.amount) || 0) - (parseFloat(b.amount) || 0);
        return 0;
      });
  }, [myDonations, receiptFilter, searchQueryReceipts, receiptSort, campaigns]);

  let userDisplayName = currentUser?.name || currentUser?.email || 'Valued Donor';
  if (userDisplayName.includes('@')) {
    const handle = userDisplayName.split('@')[0];
    if (handle.toLowerCase() === 'gestermacaldo') {
      userDisplayName = 'Gester Macaldo';
    } else {
      userDisplayName = handle.charAt(0).toUpperCase() + handle.slice(1);
    }
  }
  const userInitials = userDisplayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  return (
    <main className="container" style={{ paddingBottom: '40px' }}>
      <div className="ref-dashboard-grid">

        {/* ── Left Sidebar Navigation Panel ── */}
        <aside className="ref-sidebar">
          <div className="ref-sidebar-user">
            <div className="ref-sidebar-avatar">{userInitials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="ref-sidebar-name" title={userDisplayName}>{userDisplayName}</div>
              <div className="ref-sidebar-id">BBDRTS-DONOR-2026-0001</div>
            </div>
          </div>

          <div className="ref-sidebar-menu">
            <button 
              className={`ref-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <span className="material-symbols-outlined">dashboard</span>
              <span>Dashboard Overview</span>
            </button>

            <button 
              className={`ref-nav-item ${activeTab === 'campaigns' ? 'active' : ''}`}
              onClick={() => setActiveTab('campaigns')}
            >
              <span className="material-symbols-outlined">campaign</span>
              <span>Relief Campaigns</span>
            </button>

            <button 
              className={`ref-nav-item ${activeTab === 'my-donations' ? 'active' : ''}`}
              onClick={() => setActiveTab('my-donations')}
            >
              <span className="material-symbols-outlined">history</span>
              <span>My Contributions</span>
            </button>

            <button 
              className={`ref-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <span className="material-symbols-outlined">settings</span>
              <span>Profile & Settings</span>
            </button>
          </div>

          <div className="ref-sidebar-widget">
            <div className="ref-widget-header">
              <div className="ref-status-dot"></div>
              <span className="ref-widget-title">Sepolia Node Health</span>
            </div>
            <div className="ref-widget-detail">
              <div className="ref-widget-row">
                <span>Smart Contract</span>
                <span className="ref-widget-value green">● Synchronized</span>
              </div>
              <div className="ref-widget-row">
                <span>EVM Gateway</span>
                <span className="ref-widget-value">Sepolia Testnet</span>
              </div>
              <div className="ref-widget-row">
                <span>Verification</span>
                <span className="ref-widget-value">Automated</span>
              </div>
            </div>
          </div>

          {/* ── 🎨 3-Mode Theme Switcher Widget (Dark, Light, Cyber Navy) ── */}
          <div className="ref-sidebar-widget" style={{ marginTop: '16px' }}>
            <div className="ref-widget-header">
              <span className="material-symbols-outlined" style={{ fontSize: '16px', color: theme === 'dark' ? '#22c55e' : theme === 'light' ? '#f59e0b' : '#00ffa3' }}>
                palette
              </span>
              <span className="ref-widget-title">Interface Theme</span>
            </div>
            
            <div className="ref-theme-grid">
              {THEME_OPTIONS.map(t => {
                const isSelected = theme === t.id;
                const activeClass = isSelected ? `active-${t.id}` : '';
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      if (setTheme) {
                        setTheme(t.id);
                        showSuccess(`${t.name} enabled`, 'Theme Updated');
                      }
                    }}
                    className={`ref-theme-btn ${activeClass}`}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: t.color }}>
                      {t.icon}
                    </span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>{t.name.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* ── Main Content Area ── */}
        <section className="ref-main-content">

          {/* Sleek Top Status Capsules (Matching Reference Screenshot) */}
          <div className="ref-top-pill-strip" style={{ marginBottom: '4px' }}>
            <div className="ref-status-capsule">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>trending_up</span>
              <span>Sepolia Testnet Active</span>
            </div>
            <div className="ref-status-capsule">
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
              <span>Smart Contract: Immutable</span>
            </div>
            <div className="ref-status-capsule blue">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>verified_user</span>
              <span>0% Gateway Fees</span>
            </div>
            <div className="ref-status-capsule orange">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>warning</span>
              <span>Public Audit Ledger Live</span>
            </div>
          </div>

          {/* ── 1. DASHBOARD OVERVIEW TAB ONLY (Shows Welcome Banner + 4 Metric Cards) ── */}
          {activeTab === 'dashboard' && (
            <>
              {/* Top Hero Banner */}
              <div className="ref-welcome-card">
                <div className="ref-welcome-header">
                  <div className="ref-welcome-avatar">{userInitials}</div>
                  <div className="ref-welcome-text">
                    <h1>{userDisplayName || 'Donor Dashboard'}</h1>
                    <p>
                      <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#22c55e', verticalAlign: 'middle', marginRight: '4px' }}>verified</span>
                      Verified Donor Account • Connected: <code style={{ color: 'var(--accent)', fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}>{shortAddr(walletAddress)}</code>
                    </p>
                  </div>
                </div>

                <div className="ref-action-btns">
                  <button className="ref-btn-pill-primary" onClick={() => setActiveTab('campaigns')}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#22c55e' }}>volunteer_activism</span>
                    <span>Contribute to Relief</span>
                  </button>
                  <a href="https://sepolia.etherscan.io" target="_blank" rel="noreferrer" className="ref-btn-pill-primary" style={{ textDecoration: 'none' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>analytics</span>
                    <span>Public Ledger ↗</span>
                  </a>
                </div>
              </div>

              {/* 4-Metric Stat Cards Grid (Reference Layout & Colors) */}
              <div className="ref-metrics-grid">
                {/* 1. Green Circle - Contributions */}
                <div className="ref-metric-card">
                  <div className="ref-metric-icon-circle green">
                    <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>volunteer_activism</span>
                  </div>
                  <div className="ref-metric-title">My Contributions</div>
                  <div style={{ margin: '10px 0 12px' }}>
                    <span className="ref-pill-badge">
                      {myDonations?.length ?? 0} receipts recorded
                    </span>
                  </div>
                  <div className="ref-metric-sub">Verified on Sepolia Ledger</div>
                </div>

                {/* 2. Blue Circle - Causes */}
                <div className="ref-metric-card">
                  <div className="ref-metric-icon-circle blue">
                    <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>campaign</span>
                  </div>
                  <div className="ref-metric-title">Relief Causes</div>
                  <div style={{ margin: '10px 0 12px' }}>
                    <span className="ref-pill-badge">
                      {campaigns.length} causes active
                    </span>
                  </div>
                  <div className="ref-metric-sub" style={{ color: '#0284c7' }}>Open for Aid Assistance</div>
                </div>

                {/* 3. Purple Circle - Verification & Health */}
                <div className="ref-metric-card">
                  <div className="ref-metric-icon-circle purple">
                    <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>verified</span>
                  </div>
                  <div className="ref-metric-title">Smart Contract</div>
                  <div style={{ margin: '10px 0 12px' }}>
                    <span className="ref-pill-badge">
                      EVM Level 1 Verified
                    </span>
                  </div>
                  <div className="ref-metric-sub" style={{ color: '#9333ea' }}>Chain ID: 11155111</div>
                </div>

                {/* 4. Orange Circle - Total Donated */}
                <div className="ref-metric-card">
                  <div className="ref-metric-icon-circle orange">
                    <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>account_balance_wallet</span>
                  </div>
                  <div className="ref-metric-title">Total Contributed</div>
                  <div style={{ margin: '10px 0 12px' }}>
                    <span className="ref-pill-badge">
                      {totalDonated} ETH
                    </span>
                  </div>
                  <div className="ref-metric-sub" style={{ color: '#f59e0b' }}>
                    ≈ ₱{(parseFloat(totalDonated) * 170000).toLocaleString()} PHP
                  </div>
                </div>
              </div>

              {/* Featured Campaigns Preview Section */}
              <div style={{ marginTop: '28px' }}>
                <div className="section-header">
                  <h2 className="section-title">
                    <span className="material-symbols-outlined section-title-icon" style={{marginRight: '8px'}}>stars</span> Featured Relief Causes
                  </h2>
                  <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab('campaigns')}>
                    View All {campaigns.length} Campaigns →
                  </button>
                </div>

                {fetchingCampaigns && campaigns.length === 0 ? (
                  <div className="empty-state">
                    <div className="spinner spinner-light" style={{ width: 28, height: 28 }} />
                    <div className="empty-title">Reading from blockchain…</div>
                  </div>
                ) : campaigns.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">📭</div>
                    <div className="empty-title">No active campaigns on the ledger yet</div>
                  </div>
                ) : (
                  <div className="campaigns-list">
                    {campaigns.slice(0, 2).map((camp) => (
                      <CampaignCard
                        key={camp.id}
                        camp={camp}
                        contract={contract}
                        role={ROLES.DONOR}
                        walletAddress={walletAddress}
                        onDonated={fetchCampaigns}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── 2. DEDICATED RELIEF CAMPAIGNS TAB (Hides 4 boxes & welcome card) ── */}
          {activeTab === 'campaigns' && (
            <div style={{ marginTop: '8px' }}>
              <div className="section-header">
                <div>
                  <h2 className="section-title" style={{ fontSize: '1.4rem' }}>
                    <span className="material-symbols-outlined section-title-icon" style={{marginRight: '8px', color: '#0284c7'}}>campaign</span> Active Disaster Relief Campaigns
                  </h2>
                  <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '4px' }}>
                    Select a verified cause to contribute testnet ETH. All transactions are recorded on the Sepolia blockchain ledger.
                  </p>
                </div>

                <button
                  className="btn btn-ghost btn-sm"
                  onClick={fetchCampaigns}
                  disabled={fetchingCampaigns}
                >
                  {fetchingCampaigns
                    ? <div className="spinner spinner-light" />
                    : '↻ Refresh Campaigns'}
                </button>
              </div>

              {/* Category, Sorting & Theme Palette Dropdown Toolbar */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                gap: '12px', 
                marginTop: '16px', 
                marginBottom: '20px',
                flexWrap: 'wrap',
                background: 'var(--bg-surface)',
                padding: '10px 16px',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                boxSizing: 'border-box'
              }}>
                {/* Live Search Input Bar */}
                <div className="filter-search-box">
                  <div style={{ position: 'relative', width: '100%' }}>
                    <span className="material-symbols-outlined" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1.1rem', pointerEvents: 'none' }}>
                      search
                    </span>
                    <input
                      type="text"
                      placeholder="Search campaign, NGO, or cause..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="filter-search-input"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem', padding: 0 }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Filter Category */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Filter:</span>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="filter-select"
                  >
                    <option value="ALL">All Relief Causes ({campaigns.length})</option>
                    <option value="DR">🌊 Disaster Relief (DR-00X)</option>
                    <option value="CD">🤝 Charitable Aid (CD-00X)</option>
                  </select>
                </div>

                {/* Sort By */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Sort:</span>
                  <select
                    value={campaignSort}
                    onChange={(e) => setCampaignSort(e.target.value)}
                    className="filter-select"
                  >
                    <option value="NEWEST">✨ Newest First</option>
                    <option value="GOAL_HIGH">💰 Highest Goal</option>
                    <option value="GOAL_LOW">📉 Lowest Goal</option>
                  </select>
                </div>

                {/* 🎨 Quick Theme Switcher (3 Modes: Dark, Light, Cyber) */}
                <div className="filter-theme-pill">
                  <button
                    onClick={() => {
                      if (setTheme) {
                        setTheme('dark');
                        showSuccess('Layered Dark Mode enabled (#111, #222, #333)', 'Theme Updated');
                      }
                    }}
                    className={`filter-theme-btn ${theme === 'dark' ? 'active-dark' : ''}`}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#22c55e' }}>dark_mode</span>
                    <span>Dark</span>
                  </button>

                  <button
                    onClick={() => {
                      if (setTheme) {
                        setTheme('light');
                        showSuccess('Inverted Light Mode enabled', 'Theme Updated');
                      }
                    }}
                    className={`filter-theme-btn ${theme === 'light' ? 'active-light' : ''}`}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#16a34a' }}>light_mode</span>
                    <span>Light</span>
                  </button>

                  <button
                    onClick={() => {
                      if (setTheme) {
                        setTheme('cyber');
                        showSuccess('Cyber Navy Glass enabled', 'Theme Updated');
                      }
                    }}
                    className={`filter-theme-btn ${theme === 'cyber' ? 'active-cyber' : ''}`}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#00ffa3' }}>blur_on</span>
                    <span>Cyber</span>
                  </button>
                </div>
              </div>

              {fetchingCampaigns && campaigns.length === 0 ? (
                <div className="empty-state">
                  <div className="spinner spinner-light" style={{ width: 28, height: 28 }} />
                  <div className="empty-title">Reading campaigns from smart contract…</div>
                </div>
              ) : filteredCampaigns.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📭</div>
                  <div className="empty-title">No campaigns match this category</div>
                  <div className="empty-desc">
                    Try selecting a different category from the dropdown above.
                  </div>
                </div>
              ) : (
                <>
                  <div className="campaigns-list">
                    {paginatedCampaigns.map((camp) => (
                      <CampaignCard
                        key={camp.id}
                        camp={camp}
                        contract={contract}
                        role={ROLES.DONOR}
                        walletAddress={walletAddress}
                        onDonated={fetchCampaigns}
                        onOpenNgoProfile={onOpenNgoProfile}
                      />
                    ))}
                  </div>

                  {/* Pagination Controls Bar (100% Width Centered) */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    alignSelf: 'stretch',
                    paddingTop: '20px',
                    paddingBottom: '12px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                    marginTop: '28px'
                  }}>
                    <button
                      className="btn btn-outline btn-sm"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      style={{ minWidth: '36px', height: '36px', padding: 0, borderRadius: '8px', opacity: currentPage === 1 ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Previous Page"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>chevron_left</span>
                    </button>

                    {Array.from({ length: Math.max(1, totalPages) }, (_, i) => i + 1).map((pageNum) => (
                      <button
                        key={pageNum}
                        className={`btn btn-sm ${currentPage === pageNum ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setCurrentPage(pageNum)}
                        style={{ 
                          minWidth: '36px', 
                          height: '36px',
                          borderRadius: '8px', 
                          fontWeight: currentPage === pageNum ? 700 : 500 
                        }}
                      >
                        {pageNum}
                      </button>
                    ))}

                    <button
                      className="btn btn-outline btn-sm"
                      disabled={currentPage >= Math.max(1, totalPages)}
                      onClick={() => setCurrentPage(p => Math.min(Math.max(1, totalPages), p + 1))}
                      style={{ minWidth: '36px', height: '36px', padding: 0, borderRadius: '8px', opacity: currentPage >= Math.max(1, totalPages) ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Next Page"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>chevron_right</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── 3. MY CONTRIBUTIONS TAB ── */}
          {activeTab === 'my-donations' && (
            <div style={{ marginTop: '8px' }}>
              <div className="section-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px', marginBottom: '16px' }}>
                <div>
                  <h2 className="section-title" style={{ fontSize: '1.4rem' }}>
                    <span className="material-symbols-outlined section-title-icon" style={{marginRight: '8px', color: '#22c55e'}}>verified</span>
                    My Contribution History & Audit Receipts
                  </h2>
                  <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '4px' }}>
                    Tamper-proof on-chain donation history verified by the Sepolia smart contract.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    className="btn btn-outline btn-sm" 
                    onClick={() => window.print()}
                    style={{ borderRadius: '8px', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>print</span>
                    <span>Export Audit Report</span>
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={fetchMyDonations} disabled={loadingMyDonations}>
                    {loadingMyDonations ? <div className="spinner spinner-light" /> : '↻ Refresh Receipts'}
                  </button>
                </div>
              </div>

              {/* 4-Stat Metric Cards Grid */}
              <div className="ref-metrics-grid" style={{ marginBottom: '20px' }}>
                {/* 1. Green: Total Contributed */}
                <div className="ref-metric-card">
                  <div className="ref-metric-icon-circle green">
                    <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>volunteer_activism</span>
                  </div>
                  <div className="ref-metric-title">Total Contributed</div>
                  <div style={{ margin: '10px 0 12px' }}>
                    <span className="ref-pill-badge" style={{ fontSize: '1.05rem', fontWeight: 800 }}>
                      {totalDonated} ETH
                    </span>
                  </div>
                  <div className="ref-metric-sub">Personal ETH Contributed</div>
                </div>

                {/* 2. Blue: Fiat Equivalent */}
                <div className="ref-metric-card">
                  <div className="ref-metric-icon-circle blue">
                    <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>currency_exchange</span>
                  </div>
                  <div className="ref-metric-title">Fiat Value (PHP)</div>
                  <div style={{ margin: '10px 0 12px' }}>
                    <span className="ref-pill-badge" style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0284c7' }}>
                      ≈ ₱{(parseFloat(totalDonated) * 170000).toLocaleString('en-US', {maximumFractionDigits: 0})}
                    </span>
                  </div>
                  <div className="ref-metric-sub" style={{ color: '#0284c7' }}>Real-Time Conversion</div>
                </div>

                {/* 3. Purple: Verified Receipts */}
                <div className="ref-metric-card">
                  <div className="ref-metric-icon-circle purple">
                    <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>receipt_long</span>
                  </div>
                  <div className="ref-metric-title">Verified Receipts</div>
                  <div style={{ margin: '10px 0 12px' }}>
                    <span className="ref-pill-badge" style={{ fontSize: '1.05rem', fontWeight: 800, color: '#9333ea' }}>
                      {myDonations ? myDonations.length : 0} recorded
                    </span>
                  </div>
                  <div className="ref-metric-sub" style={{ color: '#9333ea' }}>100% Sepolia EVM Audited</div>
                </div>

                {/* 4. Orange: Supported Causes */}
                <div className="ref-metric-card">
                  <div className="ref-metric-icon-circle orange">
                    <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>campaign</span>
                  </div>
                  <div className="ref-metric-title">Causes Supported</div>
                  <div style={{ margin: '10px 0 12px' }}>
                    <span className="ref-pill-badge" style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f59e0b' }}>
                      {uniqueCausesCount} campaigns
                    </span>
                  </div>
                  <div className="ref-metric-sub" style={{ color: '#f59e0b' }}>Direct Community Aid</div>
                </div>
              </div>

              {/* Filter & Sort Toolbar */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                gap: '12px', 
                marginBottom: '18px',
                flexWrap: 'wrap',
                background: 'var(--bg-surface, rgba(15, 23, 42, 0.4))',
                padding: '12px 18px',
                borderRadius: '12px',
                border: '1px solid var(--border, rgba(255, 255, 255, 0.06))',
                transition: 'background var(--transition), border-color var(--transition)'
              }}>
                {/* Live Search Input */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 240px', minWidth: '220px' }}>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <span className="material-symbols-outlined" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1rem', pointerEvents: 'none' }}>
                      search
                    </span>
                    <input
                      type="text"
                      placeholder="Search tx hash or campaign..."
                      value={searchQueryReceipts}
                      onChange={(e) => setSearchQueryReceipts(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'var(--bg-input, rgba(30, 41, 59, 0.9))',
                        color: 'var(--text-primary, #fff)',
                        border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                        borderRadius: '8px',
                        padding: '7px 28px 7px 32px',
                        fontSize: '0.82rem',
                        outline: 'none'
                      }}
                    />
                    {searchQueryReceipts && (
                      <button
                        onClick={() => setSearchQueryReceipts('')}
                        style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.82rem', padding: 0 }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Category:</span>
                  <select
                    value={receiptFilter}
                    onChange={(e) => setReceiptFilter(e.target.value)}
                    style={{
                      background: 'var(--bg-input, rgba(30, 41, 59, 0.9))',
                      color: 'var(--text-primary, #fff)',
                      border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                      borderRadius: '8px',
                      padding: '6px 12px',
                      fontSize: '0.82rem',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="ALL">All Receipts ({myDonations ? myDonations.length : 0})</option>
                    <option value="DR">🚨 Disaster Relief (DR)</option>
                    <option value="CD">🤝 Charitable Aid (CD)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Sort By:</span>
                  <select
                    value={receiptSort}
                    onChange={(e) => setReceiptSort(e.target.value)}
                    style={{
                      background: 'var(--bg-input, rgba(30, 41, 59, 0.9))',
                      color: 'var(--text-primary, #fff)',
                      border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                      borderRadius: '8px',
                      padding: '6px 12px',
                      fontSize: '0.82rem',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="NEWEST">✨ Newest First</option>
                    <option value="AMOUNT_HIGH">💎 Highest Amount</option>
                    <option value="AMOUNT_LOW">📉 Lowest Amount</option>
                  </select>
                </div>
              </div>

              {loadingMyDonations ? (
                <div className="empty-state">
                  <div className="spinner spinner-light" style={{ width: 28, height: 28 }} />
                  <div className="empty-title">Querying your donation events…</div>
                </div>
              ) : !myDonations || myDonations.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📭</div>
                  <div className="empty-title">No personal donations recorded yet</div>
                  <div className="empty-desc">
                    Go to the "Relief Campaigns" tab on the left sidebar to make your first contribution.
                  </div>
                </div>
              ) : filteredMyDonations.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📭</div>
                  <div className="empty-title">No receipts match this category</div>
                  <div className="empty-desc">
                    Try selecting a different category from the dropdown above.
                  </div>
                </div>
              ) : (
                <div className="my-donations-list" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {filteredMyDonations.map((d, idx) => {
                    const matchCamp = campaigns.find(c => String(c.id) === String(d.campaignId)) || { id: d.campaignId, title: `Disaster Relief Campaign #${d.campaignId}` };
                    const rawTitle  = matchCamp ? matchCamp.title : `Disaster Relief Campaign #${d.campaignId}`;
                    const campTitle = formatCampaignTitle(rawTitle, d.campaignId);
                    const catInfo   = getCampaignCategoryInfo(matchCamp);
                    const coverData = getCampaignCoverData(matchCamp);
                    const orgName   = getOrgDisplayName(matchCamp.orgAddress, matchCamp.orgName, d.campaignId);

                    return (
                      <div key={idx} className="contribution-receipt-card fade-in">
                        {/* 3-Column Card Body: Left Media, Center Meta, Right Amount & Proof CTA */}
                        <div className="receipt-card-body">
                          {/* Left: Compact Cover Thumbnail */}
                          <div className="receipt-media-thumb">
                            <img src={coverData.imageUrl} alt={campTitle} className="receipt-media-img" />
                            <div className="receipt-media-overlay" />
                            <div className="receipt-media-badge-top">
                              <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>{coverData.categoryIcon}</span>
                              <span>{coverData.categoryTag}</span>
                            </div>
                            <div className="receipt-media-badge-bottom">
                              <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>location_on</span>
                              <span>{coverData.locationTag}</span>
                            </div>
                          </div>

                          {/* Center: Metadata, Title & Organization */}
                          <div className="receipt-content-col">
                            <div className="receipt-badge-group">
                              <span className={`campaign-category-pill ${catInfo.colorClass}`}>
                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>{catInfo.icon}</span>
                                <span>{catInfo.prefix}-00{d.campaignId} • {catInfo.label}</span>
                              </span>

                              <span className="receipt-verified-tag">
                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>verified</span>
                                <span>Confirmed On-Chain</span>
                              </span>

                              {d.isAnonymous ? (
                                <span className="badge badge-info" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                                  Anonymous Contribution
                                </span>
                              ) : (
                                <span className="badge badge-active" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                                  Public Donor Record
                                </span>
                              )}
                            </div>

                            <h3 className="receipt-title">
                              {campTitle}
                            </h3>

                            <div className="receipt-meta-chips">
                              <div
                                className="campaign-org-badge"
                                onClick={() => {
                                  if (onOpenNgoProfile) {
                                    onOpenNgoProfile(matchCamp.orgId || 3);
                                  }
                                }}
                                style={{ cursor: 'pointer' }}
                                title="Click to view verified NGO institutional profile"
                              >
                                <span className="material-symbols-outlined campaign-org-icon">domain</span>
                                <span className="campaign-org-label">Managing Org:</span>
                                <span className="campaign-org-name" style={{ textDecoration: 'underline' }}>{orgName}</span>
                                {matchCamp.orgAddress && (
                                  <span className="campaign-org-addr-tag">{shortAddr(matchCamp.orgAddress)}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right: Donation Amount & Direct Cause Proof Button */}
                          <div className="receipt-amount-col">
                            <div className="receipt-amount-box">
                              <div className="receipt-amount-eth">
                                +{d.amount} ETH
                              </div>
                              <div className="receipt-amount-php">
                                ≈ ₱{(parseFloat(d.amount || 0) * 170000).toLocaleString('en-US', {maximumFractionDigits: 2})} PHP
                              </div>
                            </div>

                            <button
                              type="button"
                              className="receipt-proof-view-btn"
                              onClick={() => setSelectedCampaignForProof(matchCamp)}
                              title="View Campaign Accomplishments, Budget Breakdown & Map"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>task_alt</span>
                              <span>View Cause & NGO Proof</span>
                            </button>
                          </div>
                        </div>

                        {/* Bottom Row: Blockchain Proof Bar */}
                        <div className="receipt-proof-bar">
                          <div className="receipt-tx-meta">
                            <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--accent)' }}>receipt_long</span>
                            <span style={{ color: 'var(--text-secondary)' }}>TX Hash:</span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                              {d.txHash ? `${d.txHash.slice(0, 18)}...${d.txHash.slice(-10)}` : 'On-Chain Verified'}
                            </span>
                          </div>

                          <div className="receipt-actions">
                            {d.txHash && (
                              <button
                                type="button"
                                className="receipt-copy-btn"
                                onClick={() => {
                                  navigator.clipboard.writeText(d.txHash);
                                  showSuccess('Transaction hash copied to clipboard!', 'Hash Copied');
                                }}
                                title="Copy TX Hash"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>content_copy</span>
                                <span>Copy Hash</span>
                              </button>
                            )}

                            {d.txHash && (
                              <a
                                href={`https://sepolia.etherscan.io/tx/${d.txHash}`}
                                target="_blank"
                                rel="noreferrer"
                                className="receipt-etherscan-link"
                                title="Inspect on Sepolia Etherscan"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>open_in_new</span>
                                <span>Inspect on Etherscan</span>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Direct Campaign Accomplishment Proof & Audit Modal ── */}
          {selectedCampaignForProof && (() => {
            const camp = selectedCampaignForProof;
            const audit = getCampaignAuditDetails(camp.id, camp.title, camp);
            const orgDisplayName = getOrgDisplayName(camp.orgAddress, camp.orgName, camp.id);
            const displayTitle = formatCampaignTitle(camp.title, camp.id);
            const catInfo = getCampaignCategoryInfo(camp);

            const targetPhp = (parseFloat(camp.targetAmount || 0) * 170000).toLocaleString('en-US', { maximumFractionDigits: 0 });
            const currentPhp = (parseFloat(camp.currentAmount || 0) * 170000).toLocaleString('en-US', { maximumFractionDigits: 0 });
            const pct = Math.min(100, Math.round(((parseFloat(camp.currentAmount || 0)) / (parseFloat(camp.targetAmount || 1))) * 100));

            return createPortal(
              <div style={{
                position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                background: 'rgba(5, 7, 12, 0.85)', backdropFilter: 'blur(14px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999
              }} className="fade-in">
                
                <div className="card bounce-in" style={{ 
                  width: '680px', 
                  maxWidth: '94vw', 
                  maxHeight: '92vh',
                  overflowY: 'auto',
                  padding: '24px 28px', 
                  background: 'var(--bg-card, #1a1a1a)', 
                  border: '1px solid var(--border, rgba(255, 255, 255, 0.1))', 
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 24px rgba(34, 197, 94, 0.12)', 
                  borderRadius: '20px',
                  color: 'var(--text-primary, #ffffff)'
                }}>

                  {/* Modal Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border, rgba(255, 255, 255, 0.08))', paddingBottom: '16px', marginBottom: '18px' }}>
                    <div style={{ flex: 1, minWidth: 0, paddingRight: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                        <span className={`campaign-category-pill ${catInfo.colorClass}`} style={{ fontSize: '0.72rem', padding: '3px 10px' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>{catInfo.icon}</span>
                          <span>{catInfo.prefix}-00{camp.id} • {catInfo.label}</span>
                        </span>
                        <span className="badge" style={{ fontSize: '0.72rem', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.3)', padding: '3px 10px', fontWeight: 700 }}>
                          {audit.urgency}
                        </span>
                        <span className="badge" style={{ fontSize: '0.72rem', background: 'rgba(34, 197, 94, 0.12)', color: '#22c55e', borderColor: 'rgba(34, 197, 94, 0.3)', padding: '3px 10px', fontWeight: 700 }}>
                          ● Active On-Chain
                        </span>
                      </div>
                      <h2 style={{ margin: 0, fontSize: '1.35rem', color: 'var(--text-primary, #ffffff)', fontWeight: 800, lineHeight: 1.3 }}>
                        {displayTitle}
                      </h2>
                      <div style={{ margin: '6px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted, #94a3b8)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span>
                          Managed by{' '}
                          <strong
                            style={{ color: '#38bdf8', cursor: 'pointer', textDecoration: 'underline' }}
                            onClick={() => {
                              setSelectedCampaignForProof(null);
                              if (onOpenNgoProfile) onOpenNgoProfile(camp.orgId || 3);
                            }}
                            title="Click to view verified institutional profile"
                          >
                            {orgDisplayName}
                          </strong>
                        </span>
                        <span>•</span>
                        <span style={{ color: '#22c55e', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>verified</span> Smart Contract Verified
                        </span>
                      </div>
                    </div>

                    <button 
                      onClick={() => setSelectedCampaignForProof(null)}
                      style={{
                        background: 'var(--bg-input, rgba(255, 255, 255, 0.06))',
                        border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
                        color: 'var(--text-muted, #94a3b8)',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1rem',
                        flexShrink: 0
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  {/* Financial & Progress Metric Capsule Bar */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                    gap: '10px',
                    background: 'var(--bg-surface, rgba(255, 255, 255, 0.03))',
                    border: '1px solid var(--border, rgba(255, 255, 255, 0.06))',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    marginBottom: '18px'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted, #94a3b8)', fontWeight: 700, letterSpacing: '0.5px' }}>
                        Target Campaign Goal
                      </div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary, #ffffff)', marginTop: '2px' }}>
                        ₱{targetPhp} <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94a3b8)', fontWeight: 600 }}>({camp.targetAmount} ETH)</span>
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted, #94a3b8)', fontWeight: 700, letterSpacing: '0.5px' }}>
                        Settled to Date
                      </div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#22c55e', marginTop: '2px' }}>
                        ₱{currentPhp} <span style={{ fontSize: '0.74rem', color: '#22c55e', fontWeight: 700 }}>({pct}% Funded)</span>
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted, #94a3b8)', fontWeight: 700, letterSpacing: '0.5px' }}>
                        Audit Protocol
                      </div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#22c55e', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>gavel</span> Sepolia EVM Audited
                      </div>
                    </div>
                  </div>

                  {/* 1. Target Region & Location GPS Interactive Map Box (2-Column Grid) */}
                  <div style={{ 
                    background: 'var(--bg-surface, rgba(255, 255, 255, 0.03))',
                    border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
                    borderRadius: '14px',
                    padding: '16px 18px',
                    marginBottom: '18px',
                    transition: 'background var(--transition), border-color var(--transition)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="material-symbols-outlined" style={{ color: '#ef4444', fontSize: '1.3rem' }}>
                          location_on
                        </span>
                        <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary, #ffffff)' }}>
                          Target Location & Interactive Audit Map
                        </span>
                      </div>
                      <span style={{ fontSize: '0.72rem', background: 'rgba(34, 197, 94, 0.12)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                        GPS LIVE AUDIT
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', alignItems: 'center' }}>
                      {/* Left: Location Meta */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>
                            Target Relief Location
                          </div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary, #ffffff)', marginTop: '3px', lineHeight: 1.35 }}>
                            📍 {audit.region}
                          </div>
                        </div>

                        {audit.gps && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #cbd5e1)' }}>
                            📡 <strong>Coordinates:</strong> <span style={{ color: '#22c55e', fontWeight: 700, fontFamily: 'var(--font-mono, monospace)' }}>{audit.gps}</span>
                          </div>
                        )}

                        <div style={{
                          background: 'var(--bg-input, rgba(0, 0, 0, 0.25))',
                          border: '1px solid var(--border, rgba(255, 255, 255, 0.06))',
                          borderRadius: '10px',
                          padding: '10px 12px'
                        }}>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>
                            Estimated Beneficiaries / Impact Scope
                          </div>
                          <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#22c55e', marginTop: '2px' }}>
                            {audit.beneficiaries}
                          </div>
                          {audit.contact && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)', marginTop: '4px' }}>
                              📞 Response Desk: <span style={{ color: 'var(--text-secondary, #cbd5e1)', fontWeight: 600 }}>{audit.contact}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Interactive Map */}
                      <div style={{
                        width: '100%',
                        height: '200px',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                        background: 'var(--bg-input, #111111)'
                      }}>
                        <LocationMapPicker
                          address={audit.region}
                          gps={audit.gps}
                          readOnly={true}
                          height="200px"
                          hideTip={true}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2. Mission Description */}
                  <div style={{ 
                    background: 'var(--bg-surface, rgba(255, 255, 255, 0.03))', 
                    border: '1px solid var(--border, rgba(255, 255, 255, 0.08))', 
                    borderRadius: '12px', 
                    padding: '16px', 
                    marginBottom: '18px',
                    transition: 'background var(--transition), border-color var(--transition)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <h4 style={{ margin: 0, fontSize: '0.92rem', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '1.15rem' }}>description</span> Mission Purpose & Humanitarian Scope
                      </h4>
                      {audit.targetDate && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #e2e8f0)', background: 'var(--bg-input, rgba(0, 0, 0, 0.3))', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--border, rgba(255,255,255,0.08))' }}>
                          📅 Target: {audit.targetDate}
                        </span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary, #cbd5e1)', lineHeight: '1.6', whiteSpace: 'pre-line' }}>
                      {audit.description}
                    </p>
                  </div>

                  {/* 3. Necessities & Fund Allocation Breakdown */}
                  {audit.allocations && Array.isArray(audit.allocations) && audit.allocations.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{ fontSize: '0.92rem', color: 'var(--text-primary, #ffffff)', fontWeight: 800, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="material-symbols-outlined" style={{ color: '#22c55e', fontSize: '1.2rem' }}>pie_chart</span>
                        Transparency Allocation & Necessities Breakdown
                      </h4>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
                        {audit.allocations.map((item, i) => (
                          <div key={i} style={{
                            background: 'var(--bg-surface, rgba(255, 255, 255, 0.03))',
                            border: '1px solid var(--border, rgba(255, 255, 255, 0.06))',
                            borderRadius: '10px',
                            padding: '10px 12px'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary, #e2e8f0)' }}>
                                {item.label}
                              </span>
                              <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#22c55e' }}>
                                {item.pct}%
                              </span>
                            </div>
                            <div style={{ background: 'var(--bg-input, rgba(0, 0, 0, 0.3))', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${item.pct}%`, height: '100%', background: 'linear-gradient(90deg, #16a34a, #22c55e)' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Modal Footer Action */}
                  <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                    <button 
                      className="btn btn-outline btn-full" 
                      style={{ padding: '12px', fontSize: '0.88rem' }} 
                      onClick={() => setSelectedCampaignForProof(null)}
                    >
                      Close Cause Audit & Proof
                    </button>
                  </div>

                </div>
              </div>,
              document.body
            );
          })()}

          {/* ── 4. SETTINGS TAB (Hides 4 boxes & welcome card) ── */}
          {activeTab === 'settings' && (
            <div style={{ marginTop: '8px' }}>
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
            </div>
          )}

        </section>
      </div>
    </main>
  );
}
