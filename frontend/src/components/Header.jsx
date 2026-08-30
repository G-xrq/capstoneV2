import { useState, useEffect } from 'react';
import NotificationCenter from './NotificationCenter.jsx';
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
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleWindowClick = () => setIsProfileOpen(false);
    if (isProfileOpen) {
      window.addEventListener('click', handleWindowClick);
    }
    return () => window.removeEventListener('click', handleWindowClick);
  }, [isProfileOpen]);

  // Formatted User Display Name & Initials
  let userDisplayName = dbUser?.name;
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

  return (
    <>
      {/* ── Tier 1: Real-Time Protocol Ticker Bar ── */}
      <div className="bbdrts-topbar">
        <div className="container bbdrts-topbar-inner">
          <div className="bbdrts-topbar-left">
            <div className="bbdrts-topbar-item">
              <span className="bbdrts-status-dot" />
              <span><strong>Network:</strong> Sepolia EVM Testnet (Chain ID: 11155111)</span>
            </div>
            <div className="bbdrts-topbar-item" style={{ display: 'none' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '13px', color: '#22c55e' }}>verified</span>
              <span>Solidity 0.8.20 Multi-Sig Escrow Active</span>
            </div>
            <div className="bbdrts-topbar-item">
              <span className="material-symbols-outlined" style={{ fontSize: '13px', color: '#38bdf8' }}>phone_in_talk</span>
              <span>NDRRMC Disaster Hotline: (02) 8911-1406</span>
            </div>
          </div>

          <div className="bbdrts-topbar-right">
            <button
              type="button"
              className="bbdrts-theme-btn"
              onClick={toggleTheme}
              title={`Switch Theme (Active: ${theme.toUpperCase()})`}
              aria-label="Toggle Color Theme"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px', color: theme === 'dark' ? '#22c55e' : theme === 'light' ? '#f59e0b' : '#38bdf8' }}>
                {theme === 'dark' ? 'dark_mode' : theme === 'light' ? 'light_mode' : 'blur_on'}
              </span>
              <span>Theme: {theme === 'dark' ? 'Dark' : theme === 'light' ? 'Light' : 'Cyber'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Tier 2: Sticky Main Navigation Header ── */}
      <header className="bbdrts-main-header">
        <div className="container bbdrts-header-inner">

          {/* Brand Logo & Tagline */}
          <div
            className="bbdrts-brand-link"
            onClick={() => {
              if (!dbUser) setShowAuth(false);
            }}
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
                Blockchain-Based Donation & Relief Transparency System
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav aria-label="Main Navigation">
            <ul className="bbdrts-nav-menu">
              <li className="bbdrts-nav-item">
                <a href="#top" className="bbdrts-nav-link" onClick={() => { if (!dbUser) setShowAuth(false); }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>home</span>
                  <span>Home</span>
                </a>
              </li>
              <li className="bbdrts-nav-item">
                <a href="#campaigns" className="bbdrts-nav-link">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>volunteer_activism</span>
                  <span>Relief Campaigns</span>
                </a>
              </li>
              <li className="bbdrts-nav-item">
                <a
                  href="#ngos"
                  className="bbdrts-nav-link"
                  onClick={(e) => {
                    if (onOpenNgoProfile) {
                      e.preventDefault();
                      onOpenNgoProfile(3);
                    }
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>domain_verification</span>
                  <span>Verified NGOs</span>
                </a>
              </li>
              <li className="bbdrts-nav-item">
                <a href="#transparency" className="bbdrts-nav-link">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>verified</span>
                  <span>Smart Contract</span>
                </a>
              </li>
              <li className="bbdrts-nav-item">
                <a href="#footer-governance" className="bbdrts-nav-link">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>assured_workload</span>
                  <span>Institution Info</span>
                </a>
              </li>
            </ul>
          </nav>

          {/* Action Buttons & Profile Hub */}
          <div className="bbdrts-header-actions">

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
                  } else if (notif.type === 'security' && onOpenSettings) {
                    onOpenSettings();
                  } else {
                    document.getElementById('campaigns')?.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
              />
            )}

            {/* Wallet Connect / Status Pill */}
            {!walletAddress ? (
              <button
                type="button"
                className="bbdrts-wallet-btn"
                onClick={handleConnectWallet}
                title="Connect Web3 Wallet (MetaMask / EVM)"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>account_balance_wallet</span>
                <span>Connect Wallet</span>
              </button>
            ) : (
              <div className="bbdrts-wallet-pill" title={`Connected to Sepolia EVM: ${walletAddress}`}>
                <span className="bbdrts-status-dot" style={{ width: '6px', height: '6px' }} />
                <span className="bbdrts-wallet-tag">Sepolia</span>
                <span className="bbdrts-wallet-addr">{walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}</span>
              </div>
            )}

            {/* User Session Hub (Logged In) vs Portal Login (Logged Out) */}
            {dbUser ? (
              <div className="bbdrts-profile-hub" onClick={(e) => e.stopPropagation()}>
                <div
                  className={`bbdrts-profile-chip ${isProfileOpen ? 'active' : ''}`}
                  onClick={() => setIsProfileOpen(prev => !prev)}
                >
                  <div className="bbdrts-profile-avatar">{userInitials}</div>
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
                      <div className="bbdrts-dropdown-id">BBDRTS-{roleLabel}-2026-0001</div>
                    </div>

                    <div className="bbdrts-dropdown-links">
                      <a href="#" className="bbdrts-dropdown-link" onClick={(e) => { e.preventDefault(); setIsProfileOpen(false); }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#22c55e' }}>space_dashboard</span>
                        <span>Role Dashboard</span>
                      </a>
                      <a
                        href="#"
                        className="bbdrts-dropdown-link"
                        onClick={(e) => {
                          e.preventDefault();
                          setIsProfileOpen(false);
                          if (onOpenNgoProfile) onOpenNgoProfile(3);
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#38bdf8' }}>corporate_fare</span>
                        <span>View Verified NGO Profile</span>
                      </a>
                      <a href="#" className="bbdrts-dropdown-link" onClick={(e) => { e.preventDefault(); setShowSettingsModal(true); setIsProfileOpen(false); }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#eab308' }}>manage_accounts</span>
                        <span>Edit Profile & Settings</span>
                      </a>
                      <a href="#campaigns" className="bbdrts-dropdown-link" onClick={() => setIsProfileOpen(false)}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#eab308' }}>volunteer_activism</span>
                        <span>Explore Relief Causes</span>
                      </a>
                      <a href="https://sepolia.etherscan.io" target="_blank" rel="noopener noreferrer" className="bbdrts-dropdown-link">
                        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#a855f7' }}>analytics</span>
                        <span>Public Ledger Reports ↗</span>
                      </a>
                      <a href="#" className="bbdrts-dropdown-link logout" onClick={(e) => { e.preventDefault(); handleLogout(); setIsProfileOpen(false); }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>logout</span>
                        <span>Logout Session</span>
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
            <a href="#top" className="bbdrts-nav-link" onClick={() => { setMobileMenuOpen(false); if (!dbUser) setShowAuth(false); }}>Home</a>
            <a href="#campaigns" className="bbdrts-nav-link" onClick={() => setMobileMenuOpen(false)}>Relief Campaigns</a>
            <a href="#how-it-works" className="bbdrts-nav-link" onClick={() => setMobileMenuOpen(false)}>How It Works</a>
            <a href="#transparency" className="bbdrts-nav-link" onClick={() => setMobileMenuOpen(false)}>Smart Contract</a>
            <a href="#footer-governance" className="bbdrts-nav-link" onClick={() => setMobileMenuOpen(false)}>Institution Info</a>
          </div>
        )}
      </header>
    </>
  );
}
