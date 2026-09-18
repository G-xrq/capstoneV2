import { useState, useEffect, useRef } from 'react';
import NotificationCenter from './NotificationCenter.jsx';
import LeaderboardModal from './LeaderboardModal.jsx';
import SmartContractModal from './SmartContractModal.jsx';
import LiveTrackerModal from './LiveTrackerModal.jsx';
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
  setShowSettingsModal,
  theme,
  toggleTheme,
  onOpenNgoProfile
}) {
  const { showSuccess } = useToast();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [showSmartContractModal, setShowSmartContractModal] = useState(false);
  const [showLiveTrackerModal, setShowLiveTrackerModal] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null); // 'campaigns' | 'transparency' | null

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
  let userDisplayName = dbUser?.display_name || dbUser?.name;
  if (!userDisplayName || userDisplayName.includes('@')) {
    const handle = dbUser?.email ? dbUser.email.split('@')[0] : 'User';
    if (handle.toLowerCase() === 'gestermacaldo') {
      userDisplayName = 'Gester Macaldo';
    } else {
      userDisplayName = handle.replace(/[\._]/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }
  const userInitials = userDisplayName ? userDisplayName.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'US';
  const roleLabel = dbUser?.role ? dbUser.role.toUpperCase() : 'VISITOR';

  const handleRadarClick = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (mobileMenuOpen) setMobileMenuOpen(false);
    setActiveDropdown(null);

    // If guest is viewing the login/signup portal, return to landing view
    if (!dbUser && showAuth && setShowAuth) {
      setShowAuth(false);
    }

    // Broadcast global event to active dashboards (Donor, NGO, Admin)
    window.dispatchEvent(new CustomEvent('bbdrts_navigate_radar'));

    // Smooth scroll if on LandingView
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
      {/* ── Sticky Main Navigation Header ── */}
      <header className="bbdrts-main-header">
        <div className="container bbdrts-header-inner">

          {/* Brand Logo & Tagline (Click returns to home overview) */}
          <div
            className="bbdrts-brand-link"
            style={{ cursor: 'pointer' }}
            onClick={handleHomeClick}
            title="Return to Home Overview"
          >
            <div className="bbdrts-logo-wrapper">
              <img src="/logo.png" alt="BBDRTS Logo" className="bbdrts-logo-img" />
            </div>
            <div className="bbdrts-brand-text">
              <div className="bbdrts-brand-title">
                <span>BBDRTS</span>
                <span className="bbdrts-brand-badge">Protocol v2.4</span>
              </div>
              <span className="bbdrts-brand-subtitle">
                Monetary Disaster Relief & Fund Allocation Protocol
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links (Only for Public / Guest Landing Page) */}
          {!dbUser ? (
            <nav aria-label="Main Navigation">
              <ul className="bbdrts-nav-menu">
                {/* 1. Home */}
                <li className="bbdrts-nav-item">
                  <button type="button" className="bbdrts-nav-link" onClick={handleHomeClick}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>home</span>
                    <span>Home</span>
                  </button>
                </li>

                {/* 2. Relief Radar */}
                <li className="bbdrts-nav-item">
                  <button type="button" className="bbdrts-nav-link" onClick={handleRadarClick}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#38bdf8' }}>radar</span>
                    <span>Relief Radar</span>
                    <span className="bbdrts-nav-badge-live">LIVE</span>
                  </button>
                </li>

                {/* 3. Relief Campaigns (with Calamity Filter Dropdown) */}
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
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>volunteer_activism</span>
                    <span>Relief Campaigns</span>
                    <span className="material-symbols-outlined bbdrts-dropdown-caret" style={{ fontSize: '16px' }}>
                      {activeDropdown === 'campaigns' ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>

                  <div className={`bbdrts-nav-dropdown ${activeDropdown === 'campaigns' ? 'show' : ''}`}>
                    <div className="bbdrts-dropdown-section-title">Filter by Calamity</div>
                    <button 
                      type="button" 
                      className="bbdrts-dropdown-action" 
                      onClick={() => handleCampaignsClick('ALL')}
                    >
                      <span className="material-symbols-outlined" style={{ color: '#22c55e' }}>view_carousel</span>
                      <div className="bbdrts-dropdown-action-text">
                        <span className="bbdrts-dropdown-action-title">All Active Operations</span>
                        <span className="bbdrts-dropdown-action-desc">Full registry of verified disaster causes</span>
                      </div>
                    </button>

                    <button 
                      type="button" 
                      className="bbdrts-dropdown-action" 
                      onClick={() => handleCampaignsClick('TYPHOON')}
                    >
                      <span className="material-symbols-outlined" style={{ color: '#38bdf8' }}>cyclone</span>
                      <div className="bbdrts-dropdown-action-text">
                        <span className="bbdrts-dropdown-action-title">Typhoon Response</span>
                        <span className="bbdrts-dropdown-action-desc">Storm surge, wind damage & emergency relief</span>
                      </div>
                    </button>

                    <button 
                      type="button" 
                      className="bbdrts-dropdown-action" 
                      onClick={() => handleCampaignsClick('FLOOD')}
                    >
                      <span className="material-symbols-outlined" style={{ color: '#60a5fa' }}>flood</span>
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
                      <span className="material-symbols-outlined" style={{ color: '#f59e0b' }}>water_drop</span>
                      <div className="bbdrts-dropdown-action-text">
                        <span className="bbdrts-dropdown-action-title">Food & Clean Water</span>
                        <span className="bbdrts-dropdown-action-desc">Hydration filtration kits & emergency dry rations</span>
                      </div>
                    </button>

                    <button 
                      type="button" 
                      className="bbdrts-dropdown-action" 
                      onClick={() => handleCampaignsClick('MEDICAL')}
                    >
                      <span className="material-symbols-outlined" style={{ color: '#ef4444' }}>medical_services</span>
                      <div className="bbdrts-dropdown-action-text">
                        <span className="bbdrts-dropdown-action-title">Medical & First Aid</span>
                        <span className="bbdrts-dropdown-action-desc">Mobile clinics, pharmaceuticals & trauma supplies</span>
                      </div>
                    </button>
                  </div>
                </li>

                {/* 4. Transparency & Trust (with Smart Contract, Ledger, Escrow Dropdown) */}
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
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#22c55e' }}>verified</span>
                    <span>Transparency</span>
                    <span className="material-symbols-outlined bbdrts-dropdown-caret" style={{ fontSize: '16px' }}>
                      {activeDropdown === 'transparency' ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>

                  <div className={`bbdrts-nav-dropdown ${activeDropdown === 'transparency' ? 'show' : ''}`}>
                    <div className="bbdrts-dropdown-section-title">Blockchain Verification</div>
                    <button 
                      type="button" 
                      className="bbdrts-dropdown-action"
                      onClick={() => {
                        setActiveDropdown(null);
                        setShowSmartContractModal(true);
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ color: '#22c55e' }}>code_blocks</span>
                      <div className="bbdrts-dropdown-action-text">
                        <span className="bbdrts-dropdown-action-title">Smart Contract Details</span>
                        <span className="bbdrts-dropdown-action-desc">Sepolia verified contract ABI, code & escrow</span>
                      </div>
                    </button>

                    <a 
                      href={`https://sepolia.etherscan.io/address/${contractAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bbdrts-dropdown-action"
                      onClick={() => setActiveDropdown(null)}
                    >
                      <span className="material-symbols-outlined" style={{ color: '#38bdf8' }}>receipt_long</span>
                      <div className="bbdrts-dropdown-action-text">
                        <span className="bbdrts-dropdown-action-title" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          Public Ledger on Etherscan ↗
                        </span>
                        <span className="bbdrts-dropdown-action-desc">Live on-chain immutable transaction history</span>
                      </div>
                    </a>

                    <div className="bbdrts-dropdown-divider" />
                    <div className="bbdrts-dropdown-section-title">Platform Integrity</div>

                    <button 
                      type="button" 
                      className="bbdrts-dropdown-action"
                      onClick={() => {
                        setActiveDropdown(null);
                        setShowLeaderboardModal(true);
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ color: '#10b981' }}>volunteer_activism</span>
                      <div className="bbdrts-dropdown-action-text">
                        <span className="bbdrts-dropdown-action-title">Top Donors & Partners</span>
                        <span className="bbdrts-dropdown-action-desc">See our top donors, relief organizations, and total help raised</span>
                      </div>
                    </button>

                    <button 
                      type="button" 
                      className="bbdrts-dropdown-action"
                      onClick={handleHowItWorksClick}
                    >
                      <span className="material-symbols-outlined" style={{ color: '#a855f7' }}>schema</span>
                      <div className="bbdrts-dropdown-action-text">
                        <span className="bbdrts-dropdown-action-title">How Escrow Works</span>
                        <span className="bbdrts-dropdown-action-desc">4-step milestone proof and aid disbursement</span>
                      </div>
                    </button>

                    <button 
                      type="button" 
                      className="bbdrts-dropdown-action"
                      onClick={handleTransparencyClick}
                    >
                      <span className="material-symbols-outlined" style={{ color: '#10b981' }}>lock_open</span>
                      <div className="bbdrts-dropdown-action-text">
                        <span className="bbdrts-dropdown-action-title">Direct NGO Escrow Routing</span>
                        <span className="bbdrts-dropdown-action-desc">100% of contributions routed directly to accredited causes</span>
                      </div>
                    </button>
                  </div>
                </li>
              </ul>
            </nav>
          ) : (
            /* Authenticated Dashboard Context Badge (clean, professional, eliminates sidebar redundancy) */
            <div className="bbdrts-auth-header-context">
              <div className="bbdrts-workspace-pill">
                <span className="material-symbols-outlined bbdrts-workspace-icon">
                  {roleLabel === 'ORGANIZATION' ? 'corporate_fare' : roleLabel === 'ADMIN' ? 'shield_person' : 'volunteer_activism'}
                </span>
                <span className="bbdrts-workspace-title">
                  {roleLabel === 'ORGANIZATION' ? 'NGO Operations Portal' : roleLabel === 'ADMIN' ? 'Auditor & Admin Console' : 'Donor Impact Portal'}
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons & Profile Hub */}
          <div className="bbdrts-header-actions">

            {/* ── Real-Time Live Stream Button ── */}
            <button
              type="button"
              className={`bbdrts-live-tracker-btn ${showLiveTrackerModal ? 'active' : ''}`}
              onClick={() => setShowLiveTrackerModal(true)}
              title="Live Donation Tracker — Real-Time Blockchain & Gateway Stream"
              aria-label="Open Live Donation Tracker"
            >
              <span className="live-header-beacon">
                <span className="live-header-pulse" />
                <span className="live-header-core" />
              </span>
              <span className="live-header-text">Live</span>
            </button>

            {/* Top Donors & Relief Partners Trigger */}
            <button
              type="button"
              className={`bbdrts-leaderboard-btn ${showLeaderboardModal ? 'active' : ''}`}
              onClick={() => setShowLeaderboardModal(true)}
              title="Top Donors & Relief Partners"
              aria-label="Open Top Donors and Relief Partners"
            >
              <span className="material-symbols-outlined bbdrts-leaderboard-icon">history_edu</span>
            </button>

            {/* Notification Center Trigger (Only Visible When Logged In) */}
            {dbUser && (
              <NotificationCenter
                dbUser={dbUser}
                theme={theme}
                onSelectNotificationAction={(notif) => {
                  if (notif.type === 'campaign') {
                    document.getElementById('campaigns')?.scrollIntoView({ behavior: 'smooth' });
                  } else if (notif.type === 'kyc' && onOpenNgoProfile) {
                    onOpenNgoProfile(notif.orgId || 3);
                  } else if (notif.type === 'security' && typeof setShowSettingsModal === 'function') {
                    setShowSettingsModal(true);
                  } else {
                    document.getElementById('campaigns')?.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
              />
            )}

            {/* Wallet Connect CTA (Only for guest / visitor who hasn't logged in and has no wallet) */}
            {!dbUser && !walletAddress && (
              <button
                type="button"
                className="bbdrts-wallet-btn"
                onClick={handleConnectWallet}
                title="Connect Web3 Wallet (MetaMask / EVM)"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>account_balance_wallet</span>
                <span>Connect Wallet</span>
              </button>
            )}

            {/* Guest Wallet Connected Pill (Only for guest visitor who connected wallet before logging in) */}
            {!dbUser && walletAddress && (
              <div className="bbdrts-wallet-pill" title={`Connected to Sepolia EVM: ${walletAddress}`}>
                <span className="bbdrts-status-dot" style={{ width: '6px', height: '6px' }} />
                <span className="bbdrts-wallet-tag">Sepolia</span>
                <span className="bbdrts-wallet-addr">{walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}</span>
              </div>
            )}

            {/* User Session Hub (Unified Web3 Profile Hub) */}
            {dbUser ? (
              <div className="bbdrts-profile-hub" onClick={(e) => e.stopPropagation()}>
                <div
                  className={`bbdrts-profile-chip ${isProfileOpen ? 'active' : ''}`}
                  onClick={() => setIsProfileOpen(prev => !prev)}
                >
                  <div className="bbdrts-avatar-wrap">
                    <div className="bbdrts-profile-avatar" style={{ overflow: 'hidden' }}>
                      {dbUser?.avatar_url && (dbUser.avatar_url.startsWith('data:') || dbUser.avatar_url.startsWith('http')) ? (
                        <img src={dbUser.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : dbUser?.avatar_url && dbUser.avatar_url.length < 30 ? (
                        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#ffffff' }}>{dbUser.avatar_url}</span>
                      ) : (
                        userInitials
                      )}
                    </div>
                    <span
                      className="bbdrts-avatar-status-dot"
                      style={{ background: walletAddress ? '#22c55e' : '#f59e0b' }}
                      title={walletAddress ? 'Web3 Wallet Connected' : 'Wallet Disconnected'}
                    />
                  </div>
                  <div className="bbdrts-profile-meta">
                    <span className="bbdrts-profile-name">{userDisplayName}</span>
                    <span className="bbdrts-profile-role-badge">{roleLabel}</span>
                  </div>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--text-muted)' }}>
                    {isProfileOpen ? 'expand_less' : 'expand_more'}
                  </span>
                </div>

                {isProfileOpen && (
                  <div className="bbdrts-profile-dropdown">
                    <div className="bbdrts-dropdown-header">
                      <div className="bbdrts-dropdown-name">{userDisplayName}</div>
                      <div className="bbdrts-dropdown-subrow">
                        <span className="bbdrts-dropdown-id">
                          {dbUser?.system_id || `BBDRTS-${roleLabel}-2026-${String(dbUser?.id || 1).padStart(4, '0')}`}
                        </span>
                        <span className="bbdrts-dropdown-role-pill">{roleLabel}</span>
                      </div>
                    </div>

                    {/* ── Integrated Web3 Network & Wallet Section ── */}
                    {walletAddress ? (
                      <div className="bbdrts-dropdown-wallet-box">
                        <div className="bbdrts-dropdown-wallet-status">
                          <span className="bbdrts-status-dot-pulse" />
                          <span className="bbdrts-dropdown-net-name">Sepolia Testnet</span>
                          <span className="bbdrts-dropdown-chain-tag">11155111</span>
                        </div>
                        <div className="bbdrts-dropdown-addr-row">
                          <span className="bbdrts-dropdown-addr-text" title={walletAddress}>
                            {walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}
                          </span>
                          <div className="bbdrts-dropdown-addr-actions">
                            <button
                              type="button"
                              className={`bbdrts-dropdown-mini-btn ${copiedAddr ? 'copied' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(walletAddress);
                                setCopiedAddr(true);
                                setTimeout(() => setCopiedAddr(false), 2000);
                              }}
                              title={copiedAddr ? 'Copied to Clipboard!' : 'Copy Wallet Address'}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                                {copiedAddr ? 'check' : 'content_copy'}
                              </span>
                            </button>
                            <a
                              href={`https://sepolia.etherscan.io/address/${walletAddress}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bbdrts-dropdown-mini-btn"
                              title="View on Sepolia Etherscan"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>open_in_new</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bbdrts-dropdown-wallet-box disconnected">
                        <div className="bbdrts-dropdown-wallet-status">
                          <span className="bbdrts-status-dot" style={{ width: '7px', height: '7px', background: '#f59e0b' }} />
                          <span className="bbdrts-dropdown-net-name" style={{ color: '#f59e0b' }}>Wallet Disconnected</span>
                        </div>
                        <button
                          type="button"
                          className="bbdrts-dropdown-connect-btn"
                          onClick={() => {
                            setIsProfileOpen(false);
                            handleConnectWallet();
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>account_balance_wallet</span>
                          <span>Connect MetaMask</span>
                        </button>
                      </div>
                    )}

                    <div className="bbdrts-dropdown-links">
                      <a href="#" className="bbdrts-dropdown-link" onClick={(e) => { e.preventDefault(); setShowSettingsModal(true); setIsProfileOpen(false); }}>
                        <span className="material-symbols-outlined bbdrts-dropdown-item-icon">manage_accounts</span>
                        <span>My Profile & Settings</span>
                      </a>

                      <button
                        type="button"
                        className="bbdrts-dropdown-link"
                        onClick={(e) => {
                          e.preventDefault();
                          toggleTheme();
                        }}
                        style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        <span className="material-symbols-outlined bbdrts-dropdown-item-icon" style={{ color: theme === 'dark' ? '#22c55e' : theme === 'light' ? '#f59e0b' : '#38bdf8' }}>
                          {theme === 'dark' ? 'dark_mode' : theme === 'light' ? 'light_mode' : 'palette'}
                        </span>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                          <span>Color Theme</span>
                          <span className="bbdrts-dropdown-theme-tag">
                            {theme === 'dark' ? 'Dark' : theme === 'light' ? 'Light' : 'Cyber'}
                          </span>
                        </div>
                      </button>

                      <a
                        href="#"
                        className="bbdrts-dropdown-link"
                        onClick={(e) => {
                          e.preventDefault();
                          setIsProfileOpen(false);
                          setShowLeaderboardModal(true);
                        }}
                      >
                        <span className="material-symbols-outlined bbdrts-dropdown-item-icon" style={{ color: '#10b981' }}>volunteer_activism</span>
                        <span>Top Donors & Partners</span>
                      </a>

                      {roleLabel === 'DONOR' && (
                        <a href="#campaigns" className="bbdrts-dropdown-link" onClick={() => setIsProfileOpen(false)}>
                          <span className="material-symbols-outlined bbdrts-dropdown-item-icon">volunteer_activism</span>
                          <span>Explore Relief Causes</span>
                        </a>
                      )}

                      {roleLabel === 'ORGANIZATION' && (
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
                          <span>My NGO Organization Profile</span>
                        </a>
                      )}

                      <a href="https://sepolia.etherscan.io" target="_blank" rel="noopener noreferrer" className="bbdrts-dropdown-link">
                        <span className="material-symbols-outlined bbdrts-dropdown-item-icon">receipt_long</span>
                        <span>Sepolia Public Ledger ↗</span>
                      </a>

                      <div className="bbdrts-dropdown-divider" />

                      <a href="#" className="bbdrts-dropdown-link logout" onClick={(e) => { e.preventDefault(); handleLogout(); setIsProfileOpen(false); }}>
                        <span className="material-symbols-outlined bbdrts-dropdown-item-icon">logout</span>
                        <span>Sign Out</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                className="bbdrts-login-btn"
                onClick={() => setShowAuth(prev => !prev)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  {showAuth ? 'arrow_back' : 'login'}
                </span>
                <span>{showAuth ? 'Landing Page' : 'Portal Access'}</span>
              </button>
            )}

            {/* Mobile Menu Toggle Button */}
            <button
              type="button"
              className="bbdrts-mobile-toggle"
              onClick={() => setMobileMenuOpen(prev => !prev)}
              aria-label="Toggle Navigation Drawer"
            >
              <span className="material-symbols-outlined">{mobileMenuOpen ? 'close' : 'menu'}</span>
            </button>

          </div>

        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="bbdrts-mobile-drawer open">
            {!dbUser ? (
              <>
                <button type="button" className="bbdrts-mobile-nav-link" onClick={handleHomeClick}>
                  <span className="material-symbols-outlined">home</span>
                  <span>Home</span>
                </button>
                <button type="button" className="bbdrts-mobile-nav-link" onClick={handleRadarClick}>
                  <span className="material-symbols-outlined" style={{ color: '#38bdf8' }}>radar</span>
                  <span>Relief Radar</span>
                  <span className="bbdrts-nav-badge-live">LIVE</span>
                </button>

                <div className="bbdrts-mobile-nav-group">
                  <div className="bbdrts-mobile-group-title">Relief Campaigns</div>
                  <button type="button" className="bbdrts-mobile-nav-link" onClick={() => handleCampaignsClick('ALL')}>
                    <span className="material-symbols-outlined" style={{ color: '#22c55e' }}>view_carousel</span>
                    <span>All Active Operations</span>
                  </button>
                  <button type="button" className="bbdrts-mobile-nav-link sub" onClick={() => handleCampaignsClick('TYPHOON')}>
                    <span className="material-symbols-outlined" style={{ color: '#38bdf8' }}>cyclone</span>
                    <span>Typhoon Response</span>
                  </button>
                  <button type="button" className="bbdrts-mobile-nav-link sub" onClick={() => handleCampaignsClick('FLOOD')}>
                    <span className="material-symbols-outlined" style={{ color: '#60a5fa' }}>flood</span>
                    <span>Flood & Inundation</span>
                  </button>
                  <button type="button" className="bbdrts-mobile-nav-link sub" onClick={() => handleCampaignsClick('FOOD')}>
                    <span className="material-symbols-outlined" style={{ color: '#f59e0b' }}>water_drop</span>
                    <span>Food & Clean Water</span>
                  </button>
                  <button type="button" className="bbdrts-mobile-nav-link sub" onClick={() => handleCampaignsClick('MEDICAL')}>
                    <span className="material-symbols-outlined" style={{ color: '#ef4444' }}>medical_services</span>
                    <span>Medical & First Aid</span>
                  </button>
                </div>

                <div className="bbdrts-mobile-nav-group">
                  <div className="bbdrts-mobile-group-title">Blockchain Transparency</div>
                  <button 
                    type="button" 
                    className="bbdrts-mobile-nav-link" 
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setShowSmartContractModal(true);
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ color: '#22c55e' }}>code_blocks</span>
                    <span>Smart Contract Audit</span>
                  </button>
                  <a 
                    href={`https://sepolia.etherscan.io/address/${contractAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bbdrts-mobile-nav-link"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span className="material-symbols-outlined" style={{ color: '#38bdf8' }}>receipt_long</span>
                    <span>Sepolia Public Ledger ↗</span>
                  </a>
                  <button type="button" className="bbdrts-mobile-nav-link" onClick={handleHowItWorksClick}>
                    <span className="material-symbols-outlined" style={{ color: '#a855f7' }}>schema</span>
                    <span>How Escrow Works</span>
                  </button>
                  <button type="button" className="bbdrts-mobile-nav-link" onClick={handleTransparencyClick}>
                    <span className="material-symbols-outlined" style={{ color: '#10b981' }}>lock_open</span>
                    <span>0% Intermediary Guarantee</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="bbdrts-mobile-nav-group">
                  <div className="bbdrts-mobile-group-title">Workspace Navigation</div>
                  <button type="button" className="bbdrts-mobile-nav-link" onClick={handleHomeClick}>
                    <span className="material-symbols-outlined" style={{ color: '#22c55e' }}>dashboard</span>
                    <span>Dashboard Overview</span>
                  </button>
                  <button type="button" className="bbdrts-mobile-nav-link" onClick={handleRadarClick}>
                    <span className="material-symbols-outlined" style={{ color: '#38bdf8' }}>radar</span>
                    <span>Relief Radar</span>
                  </button>
                  <button type="button" className="bbdrts-mobile-nav-link" onClick={() => handleCampaignsClick('ALL')}>
                    <span className="material-symbols-outlined" style={{ color: '#f59e0b' }}>volunteer_activism</span>
                    <span>Relief Campaigns</span>
                  </button>
                </div>

                <div className="bbdrts-mobile-nav-group">
                  <div className="bbdrts-mobile-group-title">Account & Security</div>
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
                    <span className="material-symbols-outlined" style={{ color: '#22c55e' }}>verified</span>
                    <span>Smart Contract Audit</span>
                  </button>
                  <button 
                    type="button" 
                    className="bbdrts-mobile-nav-link logout" 
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleLogout();
                    }}
                    style={{ color: '#ef4444' }}
                  >
                    <span className="material-symbols-outlined" style={{ color: '#ef4444' }}>logout</span>
                    <span>Sign Out</span>
                  </button>
                </div>
              </>
            )}

            <button
              type="button"
              className="bbdrts-mobile-drawer-btn"
              onClick={() => {
                setMobileMenuOpen(false);
                setShowLeaderboardModal(true);
              }}
            >
              <span className="material-symbols-outlined">history_edu</span>
              <span>Philanthropic Honor Roll & Ledger</span>
            </button>
          </div>
        )}
      </header>

      {/* Philanthropy & Relief Impact Leaderboard Modal */}
      <LeaderboardModal
        isOpen={showLeaderboardModal}
        onClose={() => setShowLeaderboardModal(false)}
        dbUser={dbUser}
        walletAddress={walletAddress}
        theme={theme}
        onOpenNgoProfile={onOpenNgoProfile}
      />

      {/* Smart Contract Verification Modal */}
      <SmartContractModal
        isOpen={showSmartContractModal}
        onClose={() => setShowSmartContractModal(false)}
        theme={theme}
      />

      {/* Real-Time Live Donation Tracker Card Modal */}
      <LiveTrackerModal
        isOpen={showLiveTrackerModal}
        onClose={() => setShowLiveTrackerModal(false)}
        theme={theme}
      />
    </>
  );
}
