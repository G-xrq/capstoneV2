import { useState, useEffect } from 'react';
import NotificationCenter from './NotificationCenter.jsx';
import LeaderboardModal from './LeaderboardModal.jsx';
import SmartContractModal from './SmartContractModal.jsx';
import LiveTrackerModal from './LiveTrackerModal.jsx';
import BbdrtsLogo from './BbdrtsLogo.jsx';
import { contractAddress } from '../contractConfig';
import { useToast } from '../context/ToastContext';
import './Header.css';

export default function Header({
  dbUser,
  walletAddress,
  handleConnectWallet,
  handleLogout,
  showAuth,
  setShowAuth,
  authMode,
  setAuthMode,
  setShowSettingsModal,
  theme,
  toggleTheme,
  onOpenNgoProfile
}) {
  const { showSuccess } = useToast();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    const handleSidebarState = (e) => {
      setMobileSidebarOpen(Boolean(e?.detail?.open));
    };
    window.addEventListener('bbdrts_mobile_sidebar_state', handleSidebarState);
    return () => window.removeEventListener('bbdrts_mobile_sidebar_state', handleSidebarState);
  }, []);

  useEffect(() => {
    if (!dbUser) setMobileSidebarOpen(false);
  }, [dbUser]);

  // Lock background page scroll while public mobile navigation drawer is open
  useEffect(() => {
    if (!mobileMenuOpen || dbUser || typeof window === 'undefined') return;
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, [mobileMenuOpen, dbUser]);
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [showSmartContractModal, setShowSmartContractModal] = useState(false);
  const [showLiveTrackerModal, setShowLiveTrackerModal] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null); // 'campaigns' | 'transparency' | null
  const [collapsedBroadcast, setCollapsedBroadcast] = useState(null);

  // Synchronize collapsed broadcast announcement state
  useEffect(() => {
    const handleBroadcastStatus = (e) => {
      if (e?.detail?.isCollapsed && e?.detail?.activeAnnouncement) {
        setCollapsedBroadcast(e.detail.activeAnnouncement);
      } else {
        setCollapsedBroadcast(null);
      }
    };
    window.addEventListener('bbdrts_broadcast_status', handleBroadcastStatus);
    return () => window.removeEventListener('bbdrts_broadcast_status', handleBroadcastStatus);
  }, []);

  // Dismiss any lingering nav dropdowns when entering authentication view
  useEffect(() => {
    if (showAuth) {
      setActiveDropdown(null);
      setIsProfileOpen(false);
      setMobileMenuOpen(false);
    }
  }, [showAuth]);

  // Close profile dropdown & nav dropdowns when clicking outside
  useEffect(() => {
    const handleWindowClick = () => {
      setIsProfileOpen(false);
      setActiveDropdown(null);
    };
    if (isProfileOpen || activeDropdown) {
      window.addEventListener('click', handleWindowClick);
    }
    return () => window.removeEventListener('click', handleWindowClick);
  }, [isProfileOpen, activeDropdown]);

  // Formatted User Display Name & Initials
  let rawName = dbUser?.role === 'organization'
    ? (dbUser?.org_name || dbUser?.organization_name || dbUser?.name || dbUser?.display_name || dbUser?.Username || dbUser?.email)
    : (dbUser?.display_name || dbUser?.name || dbUser?.Username || dbUser?.email);

  const rawEmail = (dbUser?.email || dbUser?.Username || '').toLowerCase();
  const rawClean = (rawName || '').toLowerCase().replace(/[\s\-_]/g, '');

  let userDisplayName = rawName;
  if (rawEmail.includes('relieflink') || rawClean.includes('relieflink')) {
    userDisplayName = 'ReliefLink PH';
  } else if (rawEmail.includes('gestermacaldo') || rawClean.includes('gestermacaldo')) {
    userDisplayName = 'Gester Macaldo';
  } else if (rawEmail.includes('redcross') || rawClean.includes('redcross')) {
    userDisplayName = 'Philippine Red Cross';
  } else if (!userDisplayName || userDisplayName.includes('@')) {
    const handle = (rawEmail ? rawEmail.split('@')[0] : 'User');
    userDisplayName = handle.replace(/[\._\d]/g, ' ').trim().split(' ').filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || handle;
  }
  const userInitials = userDisplayName ? userDisplayName.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'US';
  const roleLabel = dbUser?.role
    ? (dbUser.role === 'organization' ? 'NGO' : dbUser.role === 'admin' ? 'ADMIN' : 'DONOR')
    : 'VISITOR';

  const handleRadarClick = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (mobileMenuOpen) setMobileMenuOpen(false);
    setActiveDropdown(null);

    if (!dbUser && showAuth && setShowAuth) {
      setShowAuth(false);
    }

    window.dispatchEvent(new CustomEvent('bbdrts_navigate_radar'));

    setTimeout(() => {
      const radarEl = document.getElementById('radar-heatmap');
      if (radarEl) {
        radarEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleCampaignsClick = (eOrCat) => {
    let category = 'ALL';
    if (typeof eOrCat === 'string') {
      category = eOrCat;
    } else if (eOrCat && eOrCat.preventDefault) {
      eOrCat.preventDefault();
    }
    if (mobileMenuOpen) setMobileMenuOpen(false);
    setActiveDropdown(null);

    if (!dbUser && showAuth && setShowAuth) {
      setShowAuth(false);
    }

    if (category && category !== 'ALL') {
      window.dispatchEvent(new CustomEvent('bbdrts_filter_category', { detail: { category } }));
    } else {
      window.dispatchEvent(new CustomEvent('bbdrts_navigate_campaigns'));
    }

    setTimeout(() => {
      const campEl = document.getElementById('campaigns');
      if (campEl) {
        campEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleHomeClick = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (mobileMenuOpen) setMobileMenuOpen(false);
    setActiveDropdown(null);

    if (!dbUser && showAuth && setShowAuth) {
      setShowAuth(false);
    }
    window.dispatchEvent(new CustomEvent('bbdrts_navigate_home'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleHowItWorksClick = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (mobileMenuOpen) setMobileMenuOpen(false);
    setActiveDropdown(null);

    if (!dbUser && showAuth && setShowAuth) {
      setShowAuth(false);
    }
    setTimeout(() => {
      const el = document.getElementById('how-it-works');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleTransparencyClick = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (mobileMenuOpen) setMobileMenuOpen(false);
    setActiveDropdown(null);

    if (!dbUser && showAuth && setShowAuth) {
      setShowAuth(false);
    }
    setTimeout(() => {
      const el = document.getElementById('transparency');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  return (
    <>
      <header className={`bbdrts-main-header ${dbUser ? 'dashboard-mode' : ''}`}>
        <div className={`bbdrts-header-inner ${dbUser ? 'dashboard-mode' : 'public-mode'}`}>

          {/* Left Cluster: Vercel Brand + Slash Breadcrumb + Public Nav */}
          <div className="bbdrts-header-left">
            {dbUser && (
              <button
                type="button"
                className={`bbdrts-sidebar-toggle-btn ${mobileSidebarOpen ? 'is-open' : ''}`}
                onClick={() => window.dispatchEvent(new CustomEvent('bbdrts_toggle_sidebar'))}
                title={mobileSidebarOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
                aria-label={mobileSidebarOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
                aria-expanded={mobileSidebarOpen}
              >
                <span className={`bbdrts-hamburger-morph ${mobileSidebarOpen ? 'is-open' : ''}`} aria-hidden="true">
                  <span className="bar bar-1" />
                  <span className="bar bar-2" />
                  <span className="bar bar-3" />
                </span>
              </button>
            )}

            <div
              className="bbdrts-brand-link"
              onClick={handleHomeClick}
              title="BBDRTS — Blockchain-Based Donation & Relief Transparency System"
            >
              <div className="bbdrts-logo-wrapper">
                <BbdrtsLogo size={32} />
              </div>
              <div className="bbdrts-brand-text-block">
                <span className="bbdrts-brand-wordmark">BBDRTS</span>
                <span className={`bbdrts-brand-tagline ${!dbUser ? 'landing-tagline' : ''}`}>
                  Blockchain-Based Donation &amp; Relief Transparency System
                </span>
              </div>
            </div>

            {!dbUser && (
              <span className="bbdrts-crumb-slash" aria-hidden="true">/</span>
            )}

            {!dbUser && (
              <nav aria-label="Main Navigation" className="bbdrts-public-nav-wrap bbdrts-desktop-nav">
                <ul className="bbdrts-nav-menu">
                  <li className="bbdrts-nav-item">
                    <button type="button" className="bbdrts-nav-link" onClick={handleHomeClick}>
                      <span>Home</span>
                    </button>
                  </li>

                  <li
                    className="bbdrts-nav-item has-dropdown"
                    onClick={(e) => e.stopPropagation()}
                    onMouseEnter={() => setActiveDropdown('campaigns')}
                    onMouseLeave={() => setActiveDropdown(null)}
                  >
                    <button
                      type="button"
                      className={`bbdrts-nav-link ${activeDropdown === 'campaigns' ? 'active' : ''}`}
                      onClick={() => handleCampaignsClick('ALL')}
                    >
                      <span>Campaigns</span>
                      <span className="material-symbols-outlined bbdrts-dropdown-caret">
                        expand_more
                      </span>
                    </button>

                    <div className={`bbdrts-nav-dropdown ${activeDropdown === 'campaigns' ? 'show' : ''}`}>
                      <div className="bbdrts-dropdown-section-title">Filter by Calamity</div>
                      <button
                        type="button"
                        className="bbdrts-dropdown-action"
                        onClick={() => handleCampaignsClick('ALL')}
                      >
                        <span className="material-symbols-outlined">grid_view</span>
                        <div className="bbdrts-dropdown-action-text">
                          <span className="bbdrts-dropdown-action-title">All Active Operations</span>
                          <span className="bbdrts-dropdown-action-desc">Full registry of verified relief drives</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        className="bbdrts-dropdown-action"
                        onClick={() => handleCampaignsClick('TYPHOON')}
                      >
                        <span className="material-symbols-outlined">cyclone</span>
                        <div className="bbdrts-dropdown-action-text">
                          <span className="bbdrts-dropdown-action-title">Typhoon Response</span>
                          <span className="bbdrts-dropdown-action-desc">Storm surge, wind damage & evacuation</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        className="bbdrts-dropdown-action"
                        onClick={() => handleCampaignsClick('FLOOD')}
                      >
                        <span className="material-symbols-outlined">flood</span>
                        <div className="bbdrts-dropdown-action-text">
                          <span className="bbdrts-dropdown-action-title">Flood & Inundation</span>
                          <span className="bbdrts-dropdown-action-desc">High-ground logistics & emergency shelter</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        className="bbdrts-dropdown-action"
                        onClick={() => handleCampaignsClick('FOOD')}
                      >
                        <span className="material-symbols-outlined">water_drop</span>
                        <div className="bbdrts-dropdown-action-text">
                          <span className="bbdrts-dropdown-action-title">Food & Clean Water</span>
                          <span className="bbdrts-dropdown-action-desc">Hydration filtration & dry rations</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        className="bbdrts-dropdown-action"
                        onClick={() => handleCampaignsClick('MEDICAL')}
                      >
                        <span className="material-symbols-outlined">medical_services</span>
                        <div className="bbdrts-dropdown-action-text">
                          <span className="bbdrts-dropdown-action-title">Medical & First Aid</span>
                          <span className="bbdrts-dropdown-action-desc">Mobile clinics & trauma supplies</span>
                        </div>
                      </button>
                    </div>
                  </li>

                  <li className="bbdrts-nav-item">
                    <button type="button" className="bbdrts-nav-link" onClick={handleRadarClick}>
                      <span>Radar</span>
                      <span className="bbdrts-nav-live-dot" title="Live PAGASA Doppler Telemetry" />
                    </button>
                  </li>

                  <li
                    className="bbdrts-nav-item has-dropdown"
                    onClick={(e) => e.stopPropagation()}
                    onMouseEnter={() => setActiveDropdown('transparency')}
                    onMouseLeave={() => setActiveDropdown(null)}
                  >
                    <button
                      type="button"
                      className={`bbdrts-nav-link ${activeDropdown === 'transparency' ? 'active' : ''}`}
                      onClick={() => setActiveDropdown(prev => prev === 'transparency' ? null : 'transparency')}
                    >
                      <span>Transparency</span>
                      <span className="material-symbols-outlined bbdrts-dropdown-caret">
                        expand_more
                      </span>
                    </button>

                    <div className={`bbdrts-nav-dropdown ${activeDropdown === 'transparency' ? 'show' : ''}`}>
                      <div className="bbdrts-dropdown-section-title">On-Chain Verification</div>
                      <button
                        type="button"
                        className="bbdrts-dropdown-action"
                        onClick={() => {
                          setActiveDropdown(null);
                          setShowSmartContractModal(true);
                        }}
                      >
                        <span className="material-symbols-outlined">code_blocks</span>
                        <div className="bbdrts-dropdown-action-text">
                          <span className="bbdrts-dropdown-action-title">Smart Contract Details</span>
                          <span className="bbdrts-dropdown-action-desc">Sepolia verified ABI, source & escrow</span>
                        </div>
                      </button>

                      <a
                        href={`https://sepolia.etherscan.io/address/${contractAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bbdrts-dropdown-action"
                        onClick={() => setActiveDropdown(null)}
                      >
                        <span className="material-symbols-outlined">receipt_long</span>
                        <div className="bbdrts-dropdown-action-text">
                          <span className="bbdrts-dropdown-action-title">Public Ledger on Etherscan ↗</span>
                          <span className="bbdrts-dropdown-action-desc">Immutable on-chain transaction history</span>
                        </div>
                      </a>

                      <div className="bbdrts-dropdown-divider" />
                      <div className="bbdrts-dropdown-section-title">Governance</div>

                      <button
                        type="button"
                        className="bbdrts-dropdown-action"
                        onClick={() => {
                          setActiveDropdown(null);
                          setShowLeaderboardModal(true);
                        }}
                      >
                        <span className="material-symbols-outlined">emoji_events</span>
                        <div className="bbdrts-dropdown-action-text">
                          <span className="bbdrts-dropdown-action-title">Top Donors & Partners</span>
                          <span className="bbdrts-dropdown-action-desc">Verified contributors & accredited NGOs</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        className="bbdrts-dropdown-action"
                        onClick={handleHowItWorksClick}
                      >
                        <span className="material-symbols-outlined">schema</span>
                        <div className="bbdrts-dropdown-action-text">
                          <span className="bbdrts-dropdown-action-title">How Escrow Works</span>
                          <span className="bbdrts-dropdown-action-desc">Milestone proof & aid disbursement</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        className="bbdrts-dropdown-action"
                        onClick={handleTransparencyClick}
                      >
                        <span className="material-symbols-outlined">verified_user</span>
                        <div className="bbdrts-dropdown-action-text">
                          <span className="bbdrts-dropdown-action-title">Direct NGO Routing</span>
                          <span className="bbdrts-dropdown-action-desc">0% platform fee, direct escrow custody</span>
                        </div>
                      </button>
                    </div>
                  </li>
                </ul>
              </nav>
            )}
          </div>

          {/* Right Cluster: Minimalist Geist Action Controls */}
          <div className="bbdrts-header-actions">

            {/* Reopen Broadcast Pill (Only shown when an announcement is active but hidden/collapsed by user) */}
            {collapsedBroadcast && (
              <button
                type="button"
                className={`bbdrts-header-broadcast-pill severity-${(collapsedBroadcast.severity || 'general').toLowerCase()}`}
                onClick={() => window.dispatchEvent(new CustomEvent('bbdrts_toggle_broadcast', { detail: { collapsed: false } }))}
                title="Show active broadcast announcement banner"
                aria-label="Show active broadcast announcement banner"
              >
                <span className="bbdrts-live-beacon" />
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                  {collapsedBroadcast.severity === 'EMERGENCY' ? 'warning' : (collapsedBroadcast.severity === 'OPERATIONAL' ? 'info' : 'podcasts')}
                </span>
                <span className="bbdrts-header-broadcast-label">
                  {collapsedBroadcast.severity === 'EMERGENCY' ? 'Emergency Alert' : (collapsedBroadcast.severity === 'OPERATIONAL' ? 'Notice Active' : 'Advisory Active')}
                </span>
                <span className="bbdrts-header-show-badge">Show ▾</span>
              </button>
            )}

            {/* Live Stream Trigger */}
            <button
              type="button"
              className={`bbdrts-live-pill ${showLiveTrackerModal ? 'active' : ''}`}
              onClick={() => setShowLiveTrackerModal(true)}
              title="Live Donation Tracker — Real-Time Activity"
              aria-label="Open Live Donation Tracker"
            >
              <span className="bbdrts-live-beacon" />
              <span>Live</span>
            </button>

            {/* Leaderboard Trigger */}
            <button
              type="button"
              className={`bbdrts-icon-btn bbdrts-leaderboard-btn ${showLeaderboardModal ? 'active' : ''}`}
              onClick={() => setShowLeaderboardModal(true)}
              title="Top Donors & Relief Partners"
              aria-label="Open Top Donors and Relief Partners"
            >
              <span className="material-symbols-outlined bbdrts-theme-icon" style={{ fontSize: '18px' }}>history_edu</span>
            </button>

            {/* Quick Theme Switcher */}
            {toggleTheme && (
              <button
                type="button"
                className="bbdrts-icon-btn"
                onClick={toggleTheme}
                title={`Switch Theme (Current: ${theme === 'light' ? 'Light' : 'Dark'})`}
                aria-label="Toggle Theme"
              >
                <span className={`material-symbols-outlined bbdrts-theme-icon ${theme === 'dark' ? 'is-dark' : 'is-light'}`} style={{ fontSize: '18px' }}>
                  {theme === 'light' ? 'dark_mode' : 'light_mode'}
                </span>
              </button>
            )}

            {/* Notification Center (Authenticated) */}
            {dbUser && (
              <NotificationCenter
                dbUser={dbUser}
                theme={theme}
                onSelectNotificationAction={(notif) => {
                  const role = (dbUser?.role || 'donor').toLowerCase();
                  const type = (notif?.type || '').toUpperCase();

                  let targetTab = 'dashboard';
                  if (type === 'DONATION' || type === 'WITHDRAWAL') {
                    targetTab = role === 'donor' ? 'my-donations' : 'ledger';
                  } else if (type === 'CAMPAIGN') {
                    targetTab = 'campaigns';
                  } else if (type === 'DISBURSEMENT' || type === 'MILESTONE' || type === 'RELIEF_PROOF') {
                    targetTab = role === 'admin' ? 'disbursements' : (role === 'organization' ? 'my-campaigns' : 'campaigns');
                    const campMatch = String(notif?.link || '').match(/[?&]campaign=([0-9]+)/i) || String(notif?.link || '').match(/\/campaigns\/([0-9]+)/i);
                    const campaignId = campMatch ? Number(campMatch[1]) : (notif?.referenceType === 'CAMPAIGN' && /^[0-9]+$/.test(String(notif?.referenceId)) ? Number(notif?.referenceId) : null);
                    if (campaignId) {
                      window.dispatchEvent(new CustomEvent('bbdrts_open_proof_modal', {
                        detail: { campaignId, notif }
                      }));
                    }
                  } else if (type === 'VERIFICATION' || type === 'KYC') {
                    targetTab = role === 'admin' ? 'approvals' : (role === 'organization' ? 'sec-kyc' : 'campaigns');
                  } else if (type === 'SECURITY') {
                    if (typeof setShowSettingsModal === 'function') {
                      setShowSettingsModal(true);
                      return;
                    }
                    targetTab = 'settings';
                  } else if (type === 'EMERGENCY' || type === 'BROADCAST') {
                    targetTab = role === 'admin' ? 'broadcast' : 'radar-heatmap';
                  } else {
                    targetTab = role === 'admin' ? 'audit-logs' : 'dashboard';
                  }

                  window.dispatchEvent(new CustomEvent('bbdrts_navigate_tab', { detail: { tab: targetTab } }));
                }}
              />
            )}

            {/* Gasless Sepolia audit runs automatically — no guest wallet button needed */}

            {/* Authenticated User Profile Hub */}
            {dbUser ? (
              <div className="bbdrts-profile-hub" onClick={(e) => e.stopPropagation()}>
                <div
                  className={`bbdrts-profile-chip ${isProfileOpen ? 'active' : ''}`}
                  onClick={() => setIsProfileOpen(prev => !prev)}
                >
                  <div className="bbdrts-avatar-wrap">
                    <div className="bbdrts-profile-avatar">
                      {dbUser?.avatar_url && (dbUser.avatar_url.startsWith('data:') || dbUser.avatar_url.startsWith('http')) ? (
                        <img src={dbUser.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : dbUser?.avatar_url && dbUser.avatar_url.length < 30 ? (
                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>{dbUser.avatar_url}</span>
                      ) : (
                        userInitials
                      )}
                    </div>
                    <span
                      className="bbdrts-avatar-status-dot"
                      style={{ background: 'var(--accent)' }}
                      title="Verified Session · Gasless Sepolia Audit Active"
                    />
                  </div>
                  <span className="bbdrts-profile-name">{userDisplayName}</span>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--text-muted)' }}>
                    expand_more
                  </span>
                </div>

                {isProfileOpen && (
                  <div className="bbdrts-profile-dropdown">
                    <div className="bbdrts-dropdown-header">
                      <div className="bbdrts-dropdown-name">{userDisplayName}</div>
                      <div className="bbdrts-dropdown-subrow">
                        <button
                          type="button"
                          className="bbdrts-dropdown-id-btn"
                          title="Click to copy System ID"
                          onClick={(e) => {
                            e.stopPropagation();
                            const sid = dbUser?.system_id || `BBDRTS-${roleLabel}-2026-${String(dbUser?.id || 1).padStart(5, '0')}`;
                            navigator.clipboard.writeText(sid);
                            setCopiedId(true);
                            setTimeout(() => setCopiedId(false), 2000);
                            showSuccess('User ID copied to clipboard.');
                          }}
                        >
                          <span className="bbdrts-dropdown-id-text">
                            {dbUser?.system_id || `BBDRTS-${roleLabel}-2026-${String(dbUser?.id || 1).padStart(5, '0')}`}
                          </span>
                          <span className="material-symbols-outlined bbdrts-id-copy-icon">
                            {copiedId ? 'check' : 'content_copy'}
                          </span>
                        </button>
                        <span className="bbdrts-dropdown-role-pill">{roleLabel}</span>
                      </div>
                    </div>

                    <div className="bbdrts-dropdown-wallet-box">
                      <div className="bbdrts-dropdown-wallet-status">
                        <span className="bbdrts-status-dot-pulse" />
                        <span className="bbdrts-dropdown-net-name">Gasless Sepolia Audit</span>
                        <span className="bbdrts-dropdown-chain-tag">11155111</span>
                      </div>
                      <div className="bbdrts-dropdown-addr-row">
                        <span className="bbdrts-dropdown-addr-text" title={`Audit Contract: ${contractAddress}`}>
                          {contractAddress.substring(0, 6)}…{contractAddress.substring(contractAddress.length - 4)}
                        </span>
                        <div className="bbdrts-dropdown-addr-actions">
                          <button
                            type="button"
                            className={`bbdrts-dropdown-mini-btn ${copiedAddr ? 'copied' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(contractAddress);
                              setCopiedAddr(true);
                              setTimeout(() => setCopiedAddr(false), 2000);
                              showSuccess('Audit contract address copied to clipboard.');
                            }}
                            title={copiedAddr ? 'Copied!' : 'Copy Sepolia Audit Contract'}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                              {copiedAddr ? 'check' : 'content_copy'}
                            </span>
                          </button>
                          <a
                            href={`https://sepolia.etherscan.io/address/${contractAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bbdrts-dropdown-mini-btn"
                            title="Inspect Audit Contract on Sepolia Etherscan"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>open_in_new</span>
                          </a>
                        </div>
                      </div>
                    </div>

                    <div className="bbdrts-dropdown-links">
                      <a href="#" className="bbdrts-dropdown-link" onClick={(e) => { e.preventDefault(); setShowSettingsModal(true); setIsProfileOpen(false); }}>
                        <span className="material-symbols-outlined bbdrts-dropdown-item-icon">manage_accounts</span>
                        <span>Profile & Settings</span>
                      </a>

                      <a href="#" className="bbdrts-dropdown-link" onClick={(e) => { e.preventDefault(); setShowLiveTrackerModal(true); setIsProfileOpen(false); }}>
                        <span className="material-symbols-outlined bbdrts-dropdown-item-icon" style={{ color: '#10b981' }}>sensors</span>
                        <span>Live Donations</span>
                      </a>

                      <a href="#" className="bbdrts-dropdown-link" onClick={(e) => { e.preventDefault(); setShowLeaderboardModal(true); setIsProfileOpen(false); }}>
                        <span className="material-symbols-outlined bbdrts-dropdown-item-icon">leaderboard</span>
                        <span>Top Donors &amp; Partners</span>
                      </a>

                      {(roleLabel === 'NGO' || roleLabel === 'ORGANIZATION') && (
                        <a
                          href="#"
                          className="bbdrts-dropdown-link"
                          onClick={(e) => {
                            e.preventDefault();
                            setIsProfileOpen(false);
                            if (onOpenNgoProfile) onOpenNgoProfile(3);
                          }}
                        >
                          <span className="material-symbols-outlined bbdrts-dropdown-item-icon">corporate_fare</span>
                          <span>Organization Profile</span>
                        </a>
                      )}

                      <a href={`https://sepolia.etherscan.io/address/${contractAddress}`} target="_blank" rel="noopener noreferrer" className="bbdrts-dropdown-link">
                        <span className="material-symbols-outlined bbdrts-dropdown-item-icon">receipt_long</span>
                        <span>Sepolia Etherscan ↗</span>
                      </a>

                      <div className="bbdrts-dropdown-divider" />

                      <a href="#" className="bbdrts-dropdown-link logout" onClick={(e) => { e.preventDefault(); handleLogout(); setIsProfileOpen(false); }}>
                        <span className="material-symbols-outlined bbdrts-dropdown-item-icon">logout</span>
                        <span>Log Out</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bbdrts-auth-btn-group">
                <button
                  type="button"
                  className={`bbdrts-ghost-btn ${showAuth && authMode === 'login' ? 'active' : ''}`}
                  onClick={() => {
                    if (setAuthMode) setAuthMode('login');
                    setShowAuth(true);
                  }}
                  title="Log in to your account"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>login</span>
                  <span>Log In</span>
                </button>
                <button
                  type="button"
                  className={`bbdrts-primary-btn ${showAuth && authMode === 'register' ? 'active' : ''}`}
                  onClick={() => {
                    if (setAuthMode) setAuthMode('register');
                    setShowAuth(true);
                  }}
                  title="Create a new account"
                >
                  <span>Sign Up</span>
                </button>
              </div>
            )}

            {/* Mobile Hamburger (Public Landing View Only — Logged-In Dashboards Use Left Sidebar Toggle) */}
            {!dbUser && (
              <button
                type="button"
                className={`bbdrts-mobile-toggle ${mobileMenuOpen ? 'is-open' : ''}`}
                onClick={() => setMobileMenuOpen(prev => !prev)}
                aria-label={mobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
                aria-expanded={mobileMenuOpen}
              >
                <span className={`bbdrts-hamburger-morph ${mobileMenuOpen ? 'is-open' : ''}`} aria-hidden="true">
                  <span className="bar bar-1" />
                  <span className="bar bar-2" />
                  <span className="bar bar-3" />
                </span>
              </button>
            )}
          </div>

        </div>

        {/* Mobile Navigation Drawer (Public Landing View Only) */}
        {!dbUser && mobileMenuOpen && (
          <div className="bbdrts-mobile-drawer open">
            {!dbUser ? (
              <>
                <button type="button" className="bbdrts-mobile-nav-link" onClick={handleHomeClick}>
                  <span className="material-symbols-outlined">home</span>
                  <span>Home</span>
                </button>
                <button type="button" className="bbdrts-mobile-nav-link" onClick={handleRadarClick}>
                  <span className="material-symbols-outlined">radar</span>
                  <span>Relief Radar</span>
                  <span className="bbdrts-nav-live-dot" style={{ marginLeft: 'auto', background: '#10b981', boxShadow: '0 0 8px rgba(16, 185, 129, 0.7)' }} />
                </button>

                <div className="bbdrts-mobile-nav-group">
                  <div className="bbdrts-mobile-group-title">Campaigns</div>
                  <button type="button" className="bbdrts-mobile-nav-link" onClick={() => handleCampaignsClick('ALL')}>
                    <span className="material-symbols-outlined">grid_view</span>
                    <span>All Active Operations</span>
                  </button>
                  <button type="button" className="bbdrts-mobile-nav-link sub" onClick={() => handleCampaignsClick('TYPHOON')}>
                    <span>Typhoon Response</span>
                  </button>
                  <button type="button" className="bbdrts-mobile-nav-link sub" onClick={() => handleCampaignsClick('FLOOD')}>
                    <span>Flood & Inundation</span>
                  </button>
                  <button type="button" className="bbdrts-mobile-nav-link sub" onClick={() => handleCampaignsClick('FOOD')}>
                    <span>Food & Clean Water</span>
                  </button>
                  <button type="button" className="bbdrts-mobile-nav-link sub" onClick={() => handleCampaignsClick('MEDICAL')}>
                    <span>Medical & First Aid</span>
                  </button>
                </div>

                <div className="bbdrts-mobile-nav-group">
                  <div className="bbdrts-mobile-group-title">Transparency</div>
                  <button
                    type="button"
                    className="bbdrts-mobile-nav-link"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setShowSmartContractModal(true);
                    }}
                  >
                    <span className="material-symbols-outlined">code_blocks</span>
                    <span>Smart Contract Audit</span>
                  </button>
                  <a
                    href={`https://sepolia.etherscan.io/address/${contractAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bbdrts-mobile-nav-link"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span className="material-symbols-outlined">receipt_long</span>
                    <span>Sepolia Public Ledger ↗</span>
                  </a>
                  <button type="button" className="bbdrts-mobile-nav-link" onClick={handleHowItWorksClick}>
                    <span className="material-symbols-outlined">schema</span>
                    <span>How Escrow Works</span>
                  </button>
                  <button type="button" className="bbdrts-mobile-nav-link" onClick={handleTransparencyClick}>
                    <span className="material-symbols-outlined">verified_user</span>
                    <span>0% Intermediary Guarantee</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="bbdrts-mobile-nav-group">
                  <div className="bbdrts-mobile-group-title">Workspace</div>
                  <button type="button" className="bbdrts-mobile-nav-link" onClick={handleHomeClick}>
                    <span className="material-symbols-outlined">dashboard</span>
                    <span>Dashboard Overview</span>
                  </button>
                  <button type="button" className="bbdrts-mobile-nav-link" onClick={handleRadarClick}>
                    <span className="material-symbols-outlined">radar</span>
                    <span>Relief Radar</span>
                  </button>
                  <button type="button" className="bbdrts-mobile-nav-link" onClick={() => handleCampaignsClick('ALL')}>
                    <span className="material-symbols-outlined">volunteer_activism</span>
                    <span>Relief Campaigns</span>
                  </button>
                </div>

                <div className="bbdrts-mobile-nav-group">
                  <div className="bbdrts-mobile-group-title">Account</div>
                  <button
                    type="button"
                    className="bbdrts-mobile-nav-link"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setShowSettingsModal(true);
                    }}
                  >
                    <span className="material-symbols-outlined">manage_accounts</span>
                    <span>Profile & Settings</span>
                  </button>
                  <button
                    type="button"
                    className="bbdrts-mobile-nav-link"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setShowSmartContractModal(true);
                    }}
                  >
                    <span className="material-symbols-outlined">code_blocks</span>
                    <span>Smart Contract Audit</span>
                  </button>
                  <button
                    type="button"
                    className="bbdrts-mobile-nav-link logout"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleLogout();
                    }}
                    style={{ color: 'var(--danger)' }}
                  >
                    <span className="material-symbols-outlined" style={{ color: 'var(--danger)' }}>logout</span>
                    <span>Log Out</span>
                  </button>
                </div>
              </>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
              <button
                type="button"
                className="bbdrts-mobile-drawer-btn"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setShowLiveTrackerModal(true);
                }}
              >
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px rgba(16, 185, 129, 0.75)', flexShrink: 0 }} />
                <span>Live Donations</span>
              </button>
              <button
                type="button"
                className="bbdrts-mobile-drawer-btn"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setShowLeaderboardModal(true);
                }}
              >
                <span className="material-symbols-outlined">emoji_events</span>
                <span>Top Donors &amp; Relief Partners</span>
              </button>
            </div>

            {/* No personal wallet required — gasless relayer active */}

            {!dbUser && (
              <div className="bbdrts-mobile-auth-dock" style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => {
                    setMobileMenuOpen(false);
                    if (setAuthMode) setAuthMode('login');
                    setShowAuth(true);
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>login</span>
                  <span>Log In</span>
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => {
                    setMobileMenuOpen(false);
                    if (setAuthMode) setAuthMode('register');
                    setShowAuth(true);
                  }}
                >
                  <span>Sign Up</span>
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      <LeaderboardModal
        isOpen={showLeaderboardModal}
        onClose={() => setShowLeaderboardModal(false)}
        dbUser={dbUser}
        theme={theme}
        onOpenNgoProfile={onOpenNgoProfile}
        onLogin={() => {
          setShowLeaderboardModal(false);
          if (setAuthMode) setAuthMode('login');
          setShowAuth(true);
        }}
      />

      <SmartContractModal
        isOpen={showSmartContractModal}
        onClose={() => setShowSmartContractModal(false)}
        theme={theme}
      />

      <LiveTrackerModal
        isOpen={showLiveTrackerModal}
        onClose={() => setShowLiveTrackerModal(false)}
        theme={theme}
      />
    </>
  );
}
