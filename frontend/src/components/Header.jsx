import { useState, useEffect } from 'react';
import NotificationCenter from './NotificationCenter.jsx';
import LeaderboardModal from './LeaderboardModal.jsx';
import SmartContractModal from './SmartContractModal.jsx';
import LiveTrackerModal from './LiveTrackerModal.jsx';
import { contractAddress } from '../contractConfig';
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

  const handlePaymentRailsClick = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (mobileMenuOpen) setMobileMenuOpen(false);
    setActiveDropdown(null);

    if (!dbUser && showAuth && setShowAuth) {
      setShowAuth(false);
    }
    setTimeout(() => {
      const el = document.getElementById('payment-rails');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleFaqClick = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (mobileMenuOpen) setMobileMenuOpen(false);
    setActiveDropdown(null);

    if (!dbUser && showAuth && setShowAuth) {
      setShowAuth(false);
    }
    setTimeout(() => {
      const el = document.getElementById('faq');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  return (
    <>
      {/* ── Sticky Main Navigation Header (Vercel-Standard Minimalist Header) ── */}
      <header className="bbdrts-main-header">
        <div className="container bbdrts-header-inner">

          {/* ── Brand Logo & Vercel-Style Workspace Breadcrumb ── */}
          <div
            className="bbdrts-brand-link"
            onClick={handleHomeClick}
            title={dbUser ? "Return to Dashboard Overview" : "Blockchain-Based Donation & Relief Transparency System"}
          >
            <div className="bbdrts-logo-wrapper">
              <img src="/logo.png" alt="BBDRTS" className="bbdrts-logo-img" />
            </div>

            <div className="bbdrts-brand-breadcrumb">
              <span className="bbdrts-brand-title">BBDRTS</span>

              {dbUser && (
                <>
                  <span className="bbdrts-brand-slash">/</span>
                  <span className="bbdrts-brand-workspace">
                    {roleLabel === 'ORGANIZATION'
                      ? 'NGO Operations'
                      : roleLabel === 'ADMIN'
                        ? 'Governance Console'
                        : 'Donor Impact'}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* ── Desktop Navigation Links ── */}
          {!dbUser ? (
            /* Visitor Landing Navigation */
            <nav aria-label="Main Navigation" className="bbdrts-desktop-nav">
              <ul className="bbdrts-nav-menu">
                <li className="bbdrts-nav-item">
                  <button type="button" className="bbdrts-nav-link" onClick={handleRadarClick}>
                    <span className="bbdrts-nav-dot" />
                    <span>Disaster Map</span>
                  </button>
                </li>

                {/* Relief Causes Dropdown */}
                <li
                  className="bbdrts-nav-item has-dropdown"
                  onClick={(e) => e.stopPropagation()}
                  onMouseEnter={() => setActiveDropdown('campaigns')}
                  onMouseLeave={() => setActiveDropdown(null)}
                >
                  <button
                    type="button"
                    className={`bbdrts-nav-link ${activeDropdown === 'campaigns' ? 'active' : ''}`}
                    onClick={(e) => {
                      if (e.target && e.target.classList.contains('bbdrts-dropdown-caret')) {
                        e.stopPropagation();
                        setActiveDropdown(prev => prev === 'campaigns' ? null : 'campaigns');
                        return;
                      }
                      handleCampaignsClick('ALL');
                    }}
                  >
                    <span>Relief Causes</span>
                    <span className="material-symbols-outlined bbdrts-dropdown-caret">
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
                      <span className="material-symbols-outlined action-icon">view_carousel</span>
                      <div className="bbdrts-dropdown-action-text">
                        <span className="bbdrts-dropdown-action-title">All Active Relief Drives</span>
                        <span className="bbdrts-dropdown-action-desc">Full registry of verified disaster response causes</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      className="bbdrts-dropdown-action"
                      onClick={() => handleCampaignsClick('TYPHOON')}
                    >
                      <span className="material-symbols-outlined action-icon">cyclone</span>
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
                      <span className="material-symbols-outlined action-icon">flood</span>
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
                      <span className="material-symbols-outlined action-icon">water_drop</span>
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
                      <span className="material-symbols-outlined action-icon">medical_services</span>
                      <div className="bbdrts-dropdown-action-text">
                        <span className="bbdrts-dropdown-action-title">Medical & First Aid</span>
                        <span className="bbdrts-dropdown-action-desc">Mobile clinics, pharmaceuticals & trauma supplies</span>
                      </div>
                    </button>
                  </div>
                </li>

                {/* How It Works (4-Step Escrow Workflow) */}
                <li className="bbdrts-nav-item">
                  <button type="button" className="bbdrts-nav-link" onClick={handleHowItWorksClick}>
                    How It Works
                  </button>
                </li>

                {/* Transparency Dropdown */}
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
                      {activeDropdown === 'transparency' ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>

                  <div className={`bbdrts-nav-dropdown ${activeDropdown === 'transparency' ? 'show' : ''}`}>
                    <div className="bbdrts-dropdown-section-title">Smart Contract Verification</div>
                    <button
                      type="button"
                      className="bbdrts-dropdown-action"
                      onClick={() => {
                        setActiveDropdown(null);
                        setShowSmartContractModal(true);
                      }}
                    >
                      <span className="material-symbols-outlined action-icon">code_blocks</span>
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
                      <span className="material-symbols-outlined action-icon">receipt_long</span>
                      <div className="bbdrts-dropdown-action-text">
                        <span className="bbdrts-dropdown-action-title">Public Ledger on Etherscan ↗</span>
                        <span className="bbdrts-dropdown-action-desc">Live on-chain immutable transaction history</span>
                      </div>
                    </a>

                    <div className="bbdrts-dropdown-divider" />
                    <div className="bbdrts-dropdown-section-title">Ecosystem & Integrity</div>

                    <button
                      type="button"
                      className="bbdrts-dropdown-action"
                      onClick={() => {
                        setActiveDropdown(null);
                        setShowLeaderboardModal(true);
                      }}
                    >
                      <span className="material-symbols-outlined action-icon">volunteer_activism</span>
                      <div className="bbdrts-dropdown-action-text">
                        <span className="bbdrts-dropdown-action-title">Top Donors & Partners</span>
                        <span className="bbdrts-dropdown-action-desc">See top donors, relief groups & total aid</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      className="bbdrts-dropdown-action"
                      onClick={handlePaymentRailsClick}
                    >
                      <span className="material-symbols-outlined action-icon">payments</span>
                      <div className="bbdrts-dropdown-action-text">
                        <span className="bbdrts-dropdown-action-title">Payment Methods</span>
                        <span className="bbdrts-dropdown-action-desc">GCash, Maya, Bank Transfer & Sepolia Crypto</span>
                      </div>
                    </button>
                  </div>
                </li>

                {/* FAQ Link */}
                <li className="bbdrts-nav-item">
                  <button type="button" className="bbdrts-nav-link" onClick={handleFaqClick}>
                    FAQ
                  </button>
                </li>
              </ul>
            </nav>
          ) : (
            /* Authenticated Quick Tabs (Instant Dashboard Navigation) */
            <nav aria-label="Dashboard Navigation" className="bbdrts-desktop-nav">
              <ul className="bbdrts-nav-menu">
                <li className="bbdrts-nav-item">
                  <button type="button" className="bbdrts-nav-link" onClick={handleHomeClick}>
                    <span>Dashboard</span>
                  </button>
                </li>
                <li className="bbdrts-nav-item">
                  <button type="button" className="bbdrts-nav-link" onClick={handleRadarClick}>
                    <span className="bbdrts-nav-dot" />
                    <span>Relief Radar</span>
                  </button>
                </li>
                <li className="bbdrts-nav-item">
                  <button type="button" className="bbdrts-nav-link" onClick={() => handleCampaignsClick('ALL')}>
                    <span>Relief Causes</span>
                  </button>
                </li>
              </ul>
            </nav>
          )}

          {/* ── Header Actions Toolbar ── */}
          <div className="bbdrts-header-actions">

            {/* 1. Real-Time Live Donation Tracker Pill */}
            <button
              type="button"
              className={`bbdrts-live-pill ${showLiveTrackerModal ? 'active' : ''}`}
              onClick={() => setShowLiveTrackerModal(true)}
              title="Live Donation Tracker — Real-Time Donations Across All Rails"
              aria-label="Open Live Donation Tracker"
            >
              <span className="bbdrts-live-beacon" />
              <span>Live Tracker</span>
            </button>

            {/* 2. Vercel-Style Dedicated Theme Switcher */}
            <button
              type="button"
              className="bbdrts-icon-btn"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
              aria-label="Toggle color theme"
            >
              <span className={`material-symbols-outlined bbdrts-theme-icon ${theme === 'dark' ? 'is-dark' : 'is-light'}`} style={{ fontSize: '18px' }}>
                {theme === 'light' ? 'dark_mode' : 'light_mode'}
              </span>
            </button>

            {/* 3. Notification Center Trigger (Authenticated Only) */}
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

            {/* 4. Guest Connected Wallet Pill (Only shown if wallet is connected) */}
            {!dbUser && walletAddress && (
              <div className="bbdrts-wallet-pill" title={`Connected to Sepolia EVM: ${walletAddress}`}>
                <span className="bbdrts-wallet-dot" />
                <span className="bbdrts-wallet-addr">{walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}</span>
              </div>
            )}

            {/* 7. Authenticated User Profile Hub or Guest Sign In */}
            {dbUser ? (
              <div className="bbdrts-profile-hub" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className={`bbdrts-profile-chip ${isProfileOpen ? 'active' : ''}`}
                  onClick={() => setIsProfileOpen(prev => !prev)}
                  aria-label="Open Account Menu"
                >
                  <div className="bbdrts-profile-avatar">
                    {dbUser?.avatar_url && (dbUser.avatar_url.startsWith('data:') || dbUser.avatar_url.startsWith('http')) ? (
                      <img src={dbUser.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : dbUser?.avatar_url && dbUser.avatar_url.length < 30 ? (
                      <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#ffffff' }}>{dbUser.avatar_url}</span>
                    ) : (
                      userInitials
                    )}
                  </div>
                  <span className="bbdrts-profile-name">{userDisplayName}</span>
                  <span className="material-symbols-outlined bbdrts-profile-chevron">
                    {isProfileOpen ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {isProfileOpen && (
                  <div className="bbdrts-profile-dropdown">
                    <div className="bbdrts-dropdown-header">
                      <div className="bbdrts-dropdown-name">{userDisplayName}</div>
                      <div className="bbdrts-dropdown-subrow">
                        <span className="bbdrts-dropdown-id">
                          {dbUser?.email || dbUser?.system_id || `BBDRTS-${roleLabel}-${String(dbUser?.id || 1).padStart(4, '0')}`}
                        </span>
                        <span className="bbdrts-dropdown-role-pill">{roleLabel}</span>
                      </div>
                    </div>

                    {/* Integrated Web3 Network Status */}
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
                          <span className="bbdrts-wallet-warn-dot" />
                          <span className="bbdrts-dropdown-net-name" style={{ color: 'var(--warning)' }}>Wallet Disconnected</span>
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

                    {/* Profile Dropdown Navigation Links */}
                    <div className="bbdrts-dropdown-links">
                      <button
                        type="button"
                        className="bbdrts-dropdown-link"
                        onClick={() => {
                          setShowSettingsModal(true);
                          setIsProfileOpen(false);
                        }}
                      >
                        <span className="material-symbols-outlined bbdrts-dropdown-item-icon">manage_accounts</span>
                        <span>Account & Settings</span>
                      </button>

                      <button
                        type="button"
                        className="bbdrts-dropdown-link"
                        onClick={() => {
                          toggleTheme();
                        }}
                      >
                        <span className="material-symbols-outlined bbdrts-dropdown-item-icon">
                          {theme === 'light' ? 'dark_mode' : 'light_mode'}
                        </span>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                          <span>Appearance</span>
                          <span className="bbdrts-dropdown-theme-tag">
                            {theme === 'light' ? 'Light' : 'Dark'}
                          </span>
                        </div>
                      </button>

                      <button
                        type="button"
                        className="bbdrts-dropdown-link"
                        onClick={() => {
                          setIsProfileOpen(false);
                          setShowLeaderboardModal(true);
                        }}
                      >
                        <span className="material-symbols-outlined bbdrts-dropdown-item-icon">leaderboard</span>
                        <span>Top Donors & Partners</span>
                      </button>

                      {roleLabel === 'ORGANIZATION' && (
                        <button
                          type="button"
                          className="bbdrts-dropdown-link"
                          onClick={() => {
                            setIsProfileOpen(false);
                            if (onOpenNgoProfile) onOpenNgoProfile(3);
                          }}
                        >
                          <span className="material-symbols-outlined bbdrts-dropdown-item-icon">corporate_fare</span>
                          <span>My NGO Organization Profile</span>
                        </button>
                      )}

                      {roleLabel === 'DONOR' && (
                        <>
                          <button
                            type="button"
                            className="bbdrts-dropdown-link"
                            onClick={() => {
                              setIsProfileOpen(false);
                              window.dispatchEvent(new CustomEvent('bbdrts_navigate_contributions'));
                            }}
                          >
                            <span className="material-symbols-outlined bbdrts-dropdown-item-icon">receipt_long</span>
                            <span>My Contributions</span>
                          </button>
                          <button
                            type="button"
                            className="bbdrts-dropdown-link"
                            onClick={() => {
                              setIsProfileOpen(false);
                              handleCampaignsClick('ALL');
                            }}
                          >
                            <span className="material-symbols-outlined bbdrts-dropdown-item-icon">volunteer_activism</span>
                            <span>Explore Relief Causes</span>
                          </button>
                        </>
                      )}

                      <a
                        href={`https://sepolia.etherscan.io/address/${contractAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bbdrts-dropdown-link"
                      >
                        <span className="material-symbols-outlined bbdrts-dropdown-item-icon">receipt_long</span>
                        <span>Sepolia Contract Ledger ↗</span>
                      </a>

                      <div className="bbdrts-dropdown-divider" />

                      <button
                        type="button"
                        className="bbdrts-dropdown-link logout"
                        onClick={() => {
                          handleLogout();
                          setIsProfileOpen(false);
                        }}
                      >
                        <span className="material-symbols-outlined bbdrts-dropdown-item-icon">logout</span>
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : showAuth ? (
              /* Back to Home when AuthView is active */
              <button
                type="button"
                className="bbdrts-secondary-btn"
                onClick={() => setShowAuth(false)}
                title="Return to Landing Page"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
                <span>Back to Home</span>
              </button>
            ) : (
              /* Dual Log In & Sign Up Auth Group */
              <div className="bbdrts-auth-btn-group">
                <button
                  type="button"
                  className="bbdrts-ghost-btn"
                  onClick={() => {
                    if (setAuthMode) setAuthMode('login');
                    setShowAuth(true);
                  }}
                  title="Sign In to Your Account"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>login</span>
                  <span>Log In</span>
                </button>

                <button
                  type="button"
                  className="bbdrts-primary-btn"
                  onClick={() => {
                    if (setAuthMode) setAuthMode('register');
                    setShowAuth(true);
                  }}
                  title="Create a Free Account"
                >
                  <span>Sign Up</span>
                </button>
              </div>
            )}

            {/* 8. Mobile Drawer Hamburger Button */}
            <button
              type="button"
              className="bbdrts-mobile-toggle"
              onClick={() => setMobileMenuOpen(prev => !prev)}
              aria-label="Toggle navigation drawer"
            >
              <span className="material-symbols-outlined">{mobileMenuOpen ? 'close' : 'menu'}</span>
            </button>

          </div>

        </div>

        {/* ── Mobile Navigation Drawer ── */}
        {mobileMenuOpen && (
          <div className="bbdrts-mobile-drawer open">
            {!dbUser ? (
              <>
                <button type="button" className="bbdrts-mobile-nav-link" onClick={handleHomeClick}>
                  <span className="material-symbols-outlined">home</span>
                  <span>Overview</span>
                </button>

                <button type="button" className="bbdrts-mobile-nav-link" onClick={handleRadarClick}>
                  <span className="material-symbols-outlined">radar</span>
                  <span>Relief Radar</span>
                  <span className="bbdrts-mobile-live-tag">LIVE</span>
                </button>

                <div className="bbdrts-mobile-nav-group">
                  <div className="bbdrts-mobile-group-title">Relief Drives</div>
                  <button type="button" className="bbdrts-mobile-nav-link" onClick={() => handleCampaignsClick('ALL')}>
                    <span className="material-symbols-outlined">view_carousel</span>
                    <span>All Relief Causes</span>
                  </button>
                  <button type="button" className="bbdrts-mobile-nav-link sub" onClick={() => handleCampaignsClick('TYPHOON')}>
                    <span className="material-symbols-outlined">cyclone</span>
                    <span>Typhoon Response</span>
                  </button>
                  <button type="button" className="bbdrts-mobile-nav-link sub" onClick={() => handleCampaignsClick('FLOOD')}>
                    <span className="material-symbols-outlined">flood</span>
                    <span>Flood & Inundation</span>
                  </button>
                  <button type="button" className="bbdrts-mobile-nav-link sub" onClick={() => handleCampaignsClick('FOOD')}>
                    <span className="material-symbols-outlined">water_drop</span>
                    <span>Food & Water</span>
                  </button>
                  <button type="button" className="bbdrts-mobile-nav-link sub" onClick={() => handleCampaignsClick('MEDICAL')}>
                    <span className="material-symbols-outlined">medical_services</span>
                    <span>Medical Aid</span>
                  </button>
                </div>

                <div className="bbdrts-mobile-nav-group">
                  <div className="bbdrts-mobile-group-title">Protocol & Auditing</div>
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
                  <button type="button" className="bbdrts-mobile-nav-link" onClick={handlePaymentRailsClick}>
                    <span className="material-symbols-outlined">payments</span>
                    <span>Payment Methods</span>
                  </button>
                  <button type="button" className="bbdrts-mobile-nav-link" onClick={handleFaqClick}>
                    <span className="material-symbols-outlined">quiz</span>
                    <span>Frequently Asked Questions</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="bbdrts-mobile-nav-group">
                  <div className="bbdrts-mobile-group-title">Workspace Navigation</div>
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
                    <span>Relief Causes</span>
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
                    <span className="material-symbols-outlined">verified</span>
                    <span>Smart Contract Audit</span>
                  </button>
                  <button
                    type="button"
                    className="bbdrts-mobile-nav-link logout"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleLogout();
                    }}
                  >
                    <span className="material-symbols-outlined">logout</span>
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
              <span className="material-symbols-outlined">leaderboard</span>
              <span>Top Donors & Partners</span>
            </button>

            {!dbUser && (
              <div className="bbdrts-mobile-auth-dock">
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

      {/* Real-Time Live Donation Tracker Modal */}
      <LiveTrackerModal
        isOpen={showLiveTrackerModal}
        onClose={() => setShowLiveTrackerModal(false)}
        theme={theme}
      />
    </>
  );
}
