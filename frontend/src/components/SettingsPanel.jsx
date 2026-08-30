import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import './SettingsPanel.css';
import { ROLES, ROLE_META } from '../roleConfig';
import { shortAddr } from './CampaignCard';
import { useToast } from '../context/ToastContext';

export default function SettingsPanel({ 
  contract, 
  currentUser, 
  walletAddress, 
  handleConnectWallet, 
  handleLogout, 
  updateDbWallet, 
  theme, 
  setTheme,
  textSize,
  setTextSize
}) {
  const { showSuccess, showError } = useToast();
  const [manualWallet, setManualWallet] = useState('');
  const [emailNotify, setEmailNotify] = useState(true);
  const [anonDefault, setAnonDefault] = useState(false);
  const [glassFx, setGlassFx] = useState(true);
  const [calamityAlerts, setCalamityAlerts] = useState(true);

  // Text Size Scale Options
  const TEXT_SIZE_OPTIONS = [
    {
      id: 'compact',
      name: 'Compact',
      scale: '90%',
      baseSize: '14.5px',
      icon: 'density_small',
      desc: 'High data density for tables, transaction ledgers, & compact screens.'
    },
    {
      id: 'normal',
      name: 'Standard',
      scale: '100%',
      baseSize: '16px (Default)',
      icon: 'density_medium',
      desc: 'Balanced typography with optimal line heights for standard viewing.'
    },
    {
      id: 'large',
      name: 'Large',
      scale: '110%',
      baseSize: '17.5px',
      icon: 'density_large',
      desc: 'Enhanced font hierarchy for relaxed readability and eye comfort.'
    },
    {
      id: 'extra-large',
      name: 'Extra Large',
      scale: '120%',
      baseSize: '19px',
      icon: 'zoom_in',
      desc: 'High accessibility scale designed for maximum clarity and low strain.'
    }
  ];

  const activeTextSize = textSize || (typeof window !== 'undefined' ? localStorage.getItem('bbdrts_text_size') || 'normal' : 'normal');

  const handleSelectTextSize = (sizeId) => {
    if (setTextSize) {
      setTextSize(sizeId);
    } else {
      localStorage.setItem('bbdrts_text_size', sizeId);
      document.documentElement.setAttribute('data-text-size', sizeId);
    }
    const match = TEXT_SIZE_OPTIONS.find(o => o.id === sizeId);
    showSuccess(`Interface typography scaled to ${match?.name || sizeId} (${match?.scale || '100%'}).`, 'Text Size Updated');
  };

  // Edit Profile Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [profileName, setProfileName] = useState(currentUser?.name || currentUser?.email || 'Valued User');
  const [profilePhone, setProfilePhone] = useState(currentUser?.phone || '+63 912 345 6789');
  const [profileLocation, setProfileLocation] = useState(currentUser?.location || 'Southern Leyte, Philippines');
  const [profileBio, setProfileBio] = useState(currentUser?.bio || 'Committed to transparent and verifiable blockchain disaster relief.');

  if (!currentUser) return null;
  const roleMeta = ROLE_META[currentUser.role] || ROLE_META[ROLES.PUBLIC];
  const isOrg = currentUser?.role === ROLES.ORGANIZATION || currentUser?.role === 'organization';
  
  let displayName = profileName;
  if (isOrg) {
    if (displayName.toLowerCase().includes('redcross') || displayName.toLowerCase().includes('red cross')) {
      displayName = 'Philippine Red Cross';
    } else if (displayName.toLowerCase().includes('ccs')) {
      displayName = 'College of Computer Studies (CCS)';
    } else if (walletAddress) {
      if (walletAddress.toLowerCase().startsWith('0x206e')) displayName = 'Philippine Red Cross';
      if (walletAddress.toLowerCase().startsWith('0x8898')) displayName = 'College of Computer Studies (CCS)';
    }
  } else {
    if (displayName.includes('@')) {
      const handle = displayName.split('@')[0];
      if (handle.toLowerCase() === 'gestermacaldo') {
        displayName = 'Gester Macaldo';
      } else {
        displayName = handle.charAt(0).toUpperCase() + handle.slice(1);
      }
    }
  }
  
  const userInitials = displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'US';
  const userId = isOrg ? 'BBDRTS-NGO-2026-0001' : 'BBDRTS-DONOR-2026-0001';

  const handleSaveProfile = (e) => {
    e.preventDefault();
    showSuccess('Profile information updated successfully!', 'Profile Synchronized');
    setEditModalOpen(false);
  };

  return (
    <div className="settings-glass-container fade-in">
      
      {/* ── Header Bar ── */}
      <div className="section-header" style={{ borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))', paddingBottom: '1.25rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="settings-section-header" style={{ fontSize: '1.4rem' }}>
            <span className="material-symbols-outlined" style={{ color: '#22c55e' }}>shield</span> 
            {roleMeta.label} Identity & Security Command Center
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted, #94a3b8)', marginTop: '4px' }}>
            Manage your cryptographic identity, Web3 MetaMask key bindings, and personal system preferences.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="badge" style={{ color: roleMeta.color, borderColor: roleMeta.color, background: `${roleMeta.color}15`, padding: '8px 16px', fontSize: '0.88rem', fontWeight: 700 }}>
            <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: '6px', fontSize: '1.1rem' }}>{roleMeta.icon}</span> 
            {roleMeta.label}
          </span>
          <button 
            className="btn btn-outline btn-sm"
            onClick={() => setEditModalOpen(true)}
            style={{ borderRadius: '8px', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
            <span>Edit Profile</span>
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        
        {/* ── 1. HERO IDENTITY PASS CARD ── */}
        <div className="profile-hero-card" style={{
          background: 'var(--bg-surface, linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.7) 100%))',
          border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: 'var(--shadow-card, 0 15px 35px rgba(0,0,0,0.4))',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
            
            {/* Left: Avatar & Personal Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{
                width: '68px', height: '68px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                color: '#fff', fontWeight: '800', fontSize: '1.6rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 20px rgba(22, 163, 74, 0.35)',
                border: '2px solid rgba(255,255,255,0.2)'
              }}>
                {userInitials}
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: '1.35rem', color: 'var(--text-primary, #fff)', fontWeight: 800 }}>{displayName}</h3>
                  <span style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '2px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>verified</span>
                    VERIFIED {isOrg ? 'NGO PROTOCOL ENTITY' : 'RELIEF DONOR'}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94a3b8)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <span>✉️ {currentUser.email || `${displayName.toLowerCase().replace(/\s+/g, '')}@bbdrts.org`}</span>
                  <span>📍 {profileLocation}</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#22c55e', fontFamily: 'monospace', marginTop: '4px' }}>
                  PROTOCOL ID: {userId} • EVM AUTHENTICATED
                </div>
              </div>
            </div>

            {/* Right: Quick Diagnostics Grid */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ background: 'var(--bg-input, rgba(0,0,0,0.3))', padding: '10px 16px', borderRadius: '10px', border: '1px solid var(--border, rgba(255,255,255,0.05))', textAlign: 'center', minWidth: '120px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Network</div>
                <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary, #fff)' }}>Sepolia EVM</strong>
              </div>
              <div style={{ background: 'var(--bg-input, rgba(0,0,0,0.3))', padding: '10px 16px', borderRadius: '10px', border: '1px solid var(--border, rgba(255,255,255,0.05))', textAlign: 'center', minWidth: '120px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Smart Contract</div>
                <strong style={{ fontSize: '0.9rem', color: '#22c55e' }}>● 100% Online</strong>
              </div>
            </div>

          </div>
        </div>

        {/* ── 2. WEB3 METAMASK WALLET MANAGEMENT SUITE ── */}
        <div className="settings-section-glass">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 className="settings-section-header" style={{ margin: 0 }}>
              <span className="material-symbols-outlined" style={{ color: '#f59e0b' }}>account_balance_wallet</span> 
              Web3 MetaMask Cryptographic Key Suite
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)', fontFamily: 'monospace', background: 'var(--bg-input, rgba(255,255,255,0.05))', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border, rgba(255,255,255,0.1))' }}>
              Chain ID: 11155111 (Sepolia Testnet)
            </span>
          </div>

          <p className="settings-section-desc">
            Your MetaMask public address is registered on the blockchain to sign and authorize tamper-proof transactions.
          </p>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            {walletAddress ? (
              <div className={`wallet-conn-box ${contract ? 'connected' : 'mismatch'}`} style={{ padding: '16px 20px', borderRadius: '12px', flex: 1, minWidth: '280px' }}>
                <span className="wallet-icon" style={{ fontSize: '2.8rem' }}>🦊</span>
                <div style={{ flex: 1 }}>
                  <div className={`wallet-status ${contract ? 'connected' : 'mismatch'}`} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                     <span className="spinner-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', background: contract ? '#22c55e' : '#f59e0b' }} />
                     {contract ? 'Secure Cryptographic Link Active' : 'Signature Pending MetaMask Sync'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
                    <strong className="wallet-address" style={{ fontSize: '1.15rem' }}>{shortAddr(walletAddress)}</strong>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(walletAddress);
                        showSuccess('Full wallet address copied to clipboard!', 'Address Copied');
                      }}
                      style={{ background: 'var(--bg-input, rgba(255,255,255,0.06))', border: '1px solid var(--border, rgba(255,255,255,0.1))', color: '#22c55e', padding: '3px 10px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>content_copy</span>
                      Copy
                    </button>
                    <a
                      href={`https://sepolia.etherscan.io/address/${walletAddress}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', color: '#22c55e', padding: '3px 10px', borderRadius: '6px', fontSize: '0.75rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>open_in_new</span>
                      Etherscan
                    </a>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)', fontFamily: 'monospace', marginTop: '4px', wordBreak: 'break-all' }}>
                    {walletAddress}
                  </div>
                </div>
              </div>
            ) : (
              <div className="wallet-conn-box disconnected" style={{ padding: '16px 20px', borderRadius: '12px', flex: 1 }}>
                <span className="wallet-icon" style={{ filter: 'grayscale(100%)', fontSize: '2.8rem' }}>🦊</span>
                <div>
                  <div className="wallet-status disconnected">● No Cryptographic Wallet Bound</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>You must bind a MetaMask key to interact with smart contract campaigns.</div>
                </div>
              </div>
            )}
            
            {walletAddress ? (
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {!contract && (
                  <button className="btn btn-primary glow pulse" onClick={() => handleConnectWallet(true)} style={{ padding: '0.75rem 1.25rem' }}>
                    <span className="material-symbols-outlined">sync</span> Sync Wallet
                  </button>
                )}
                <button className="btn btn-outline" onClick={async () => {
                  if(window.confirm("CRITICAL WARNING: Unbinding this wallet revokes your ability to broadcast smart contract transactions. Proceed?")) {
                    if (updateDbWallet) {
                      await updateDbWallet('');
                      window.location.reload();
                    }
                  }
                }} style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#ef4444', padding: '0.75rem 1.25rem' }}>
                  <span className="material-symbols-outlined">link_off</span> Sever Link
                </button>
              </div>
            ) : (
              <button className="btn btn-primary glow" onClick={() => handleConnectWallet(true)} style={{ padding: '0.85rem 1.75rem' }}>
                <span className="material-symbols-outlined">link</span> Bind MetaMask Key
              </button>
            )}
          </div>
          
          {/* Terminal Sandbox Override */}
          <div className="terminal-sandbox" style={{ marginTop: '20px' }}>
             <div style={{ color: '#22c55e', fontSize: '0.82rem', marginBottom: '6px', fontWeight: 700 }}>&gt; MANUAL OVERRIDE PROTOCOL (OFFLINE CAPSTONE SIMULATION)</div>
             <p style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '10px' }}>
               Inject a custom 0x hex string to force Web3 database binding during capstone defense simulations.
             </p>
             <div className="terminal-input-group">
                <input type="text" className="terminal-input" placeholder="0x..." value={manualWallet} onChange={e => setManualWallet(e.target.value)} />
                <button className="terminal-btn" onClick={async () => {
                  if (manualWallet.startsWith('0x')) {
                     if(updateDbWallet) { 
                       await updateDbWallet(manualWallet.trim()); 
                       showSuccess('Wallet address linked successfully.', 'Wallet Synchronized');
                       window.location.reload(); 
                     }
                  } else {
                     showError('Invalid Ethereum wallet address format. Address must begin with 0x.', 'Format Error');
                  }
                }}>Inject [Enter]</button>
             </div>
          </div>
        </div>

        {/* ── 3. PREFERENCES & SYSTEM DIAGNOSTICS GRID ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
          
          {/* Visual Appearance & Theme */}
          <div className="settings-section-glass">
            <h3 className="settings-section-header" style={{ fontSize: '1.1rem' }}>
              <span className="material-symbols-outlined" style={{ color: '#22c55e' }}>palette</span> Visual Appearance & Theme
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px', marginBottom: '14px' }}>
              Choose your preferred visual appearance from 3 tailored design palettes:
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
              {/* Option 1: Layered Dark */}
              <div
                onClick={() => {
                  if (setTheme) {
                    setTheme('dark');
                    showSuccess('Dark Mode enabled (#111 canvas, #222 cards, #333 insets)', 'Theme Updated');
                  }
                }}
                style={{
                  background: '#222222',
                  border: theme === 'dark' ? '2px solid #22c55e' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  cursor: 'pointer',
                  boxShadow: theme === 'dark' ? '0 0 14px rgba(34, 197, 94, 0.3)' : 'none',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                {theme === 'dark' && (
                  <span className="material-symbols-outlined" style={{ position: 'absolute', top: '10px', right: '10px', fontSize: '18px', color: '#22c55e' }}>
                    check_circle
                  </span>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#22c55e' }}>dark_mode</span>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ffffff' }}>Dark Contrast</div>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#a3a3a3', lineHeight: 1.35 }}>
                  Harmonious mix of #111 canvas, #222 cards, #333 insets & crisp text.
                </div>
              </div>

              {/* Option 2: Inverted Light */}
              <div
                onClick={() => {
                  if (setTheme) {
                    setTheme('light');
                    showSuccess('Light Mode enabled', 'Theme Updated');
                  }
                }}
                style={{
                  background: '#ffffff',
                  border: theme === 'light' ? '2px solid #16a34a' : '1px solid rgba(0,0,0,0.12)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  cursor: 'pointer',
                  boxShadow: theme === 'light' ? '0 0 14px rgba(22, 163, 74, 0.3)' : 'none',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                {theme === 'light' && (
                  <span className="material-symbols-outlined" style={{ position: 'absolute', top: '10px', right: '10px', fontSize: '18px', color: '#16a34a' }}>
                    check_circle
                  </span>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#16a34a' }}>light_mode</span>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#111111' }}>Inverted Light</div>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#52525b', lineHeight: 1.35 }}>
                  Clean daytime canvas with white cards, soft borders & high-contrast text.
                </div>
              </div>

              {/* Option 3: Cyber Navy */}
              <div
                onClick={() => {
                  if (setTheme) {
                    setTheme('cyber');
                    showSuccess('Cyber Mode enabled', 'Theme Updated');
                  }
                }}
                style={{
                  background: '#16181f',
                  border: theme === 'cyber' ? '2px solid #00ffa3' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  cursor: 'pointer',
                  boxShadow: theme === 'cyber' ? '0 0 14px rgba(0, 255, 163, 0.3)' : 'none',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                {theme === 'cyber' && (
                  <span className="material-symbols-outlined" style={{ position: 'absolute', top: '10px', right: '10px', fontSize: '18px', color: '#00ffa3' }}>
                    check_circle
                  </span>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#00ffa3' }}>blur_on</span>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#00ffa3' }}>Cyber Navy</div>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.35 }}>
                  Deep navy #0a0b0f glassmorphism with neon mint & cyan glow.
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Preferences */}
          <div className="settings-section-glass">
            <h3 className="settings-section-header" style={{ fontSize: '1.1rem' }}>
              <span className="material-symbols-outlined" style={{ color: '#22c55e' }}>tune</span> Donor & Security Preferences
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
              
              <div 
                onClick={() => {
                  setEmailNotify(!emailNotify);
                  showSuccess(`Email receipts ${!emailNotify ? 'enabled' : 'disabled'}.`);
                }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-input, rgba(0,0,0,0.2))', border: '1px solid var(--border, rgba(255,255,255,0.05))', borderRadius: '10px', cursor: 'pointer' }}
              >
                <div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary, #fff)' }}>Email Audit Receipts</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)' }}>Receive on-chain receipt PDFs</div>
                </div>
                <div style={{ width: '38px', height: '20px', borderRadius: '20px', background: emailNotify ? '#22c55e' : 'rgba(255,255,255,0.15)', position: 'relative', transition: '0.2s', flexShrink: 0 }}>
                  <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: emailNotify ? '20px' : '2px', transition: '0.2s' }} />
                </div>
              </div>

              <div 
                onClick={() => {
                  setAnonDefault(!anonDefault);
                  showSuccess(`Default Anonymous Mode ${!anonDefault ? 'enabled' : 'disabled'}.`);
                }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-input, rgba(0,0,0,0.2))', border: '1px solid var(--border, rgba(255,255,255,0.05))', borderRadius: '10px', cursor: 'pointer' }}
              >
                <div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary, #fff)' }}>Default Anonymous Mode</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)' }}>Pre-check anonymous checkbox</div>
                </div>
                <div style={{ width: '38px', height: '20px', borderRadius: '20px', background: anonDefault ? '#22c55e' : 'rgba(255,255,255,0.15)', position: 'relative', transition: '0.2s', flexShrink: 0 }}>
                  <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: anonDefault ? '20px' : '2px', transition: '0.2s' }} />
                </div>
              </div>

              <div 
                onClick={() => {
                  setCalamityAlerts(!calamityAlerts);
                  showSuccess(`Emergency Dispatches ${!calamityAlerts ? 'enabled' : 'disabled'}.`);
                }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-input, rgba(0,0,0,0.2))', border: '1px solid var(--border, rgba(255,255,255,0.05))', borderRadius: '10px', cursor: 'pointer' }}
              >
                <div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary, #fff)' }}>Disaster Emergency Alerts</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)' }}>Notify for urgent typhoon aid</div>
                </div>
                <div style={{ width: '38px', height: '20px', borderRadius: '20px', background: calamityAlerts ? '#22c55e' : 'rgba(255,255,255,0.15)', position: 'relative', transition: '0.2s', flexShrink: 0 }}>
                  <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: calamityAlerts ? '20px' : '2px', transition: '0.2s' }} />
                </div>
              </div>

              <div 
                onClick={() => {
                  setGlassFx(!glassFx);
                  showSuccess(`High-Performance UI Glass ${!glassFx ? 'enabled' : 'disabled'}.`);
                }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-input, rgba(0,0,0,0.2))', border: '1px solid var(--border, rgba(255,255,255,0.05))', borderRadius: '10px', cursor: 'pointer' }}
              >
                <div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary, #fff)' }}>UI Glassmorphism Shaders</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)' }}>Enable backdrop blur effects</div>
                </div>
                <div style={{ width: '38px', height: '20px', borderRadius: '20px', background: glassFx ? '#22c55e' : 'rgba(255,255,255,0.15)', position: 'relative', transition: '0.2s', flexShrink: 0 }}>
                  <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: glassFx ? '20px' : '2px', transition: '0.2s' }} />
                </div>
              </div>

            </div>
          </div>

          {/* Blockchain & Protocol Health */}
          <div className="settings-section-glass">
            <h3 className="settings-section-header" style={{ fontSize: '1.1rem' }}>
              <span className="material-symbols-outlined" style={{ color: '#22c55e' }}>health_and_safety</span> Blockchain Protocol Health
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-input, rgba(0,0,0,0.2))', border: '1px solid var(--border, rgba(255,255,255,0.05))', borderRadius: '8px' }}>
                <span style={{ color: 'var(--text-muted, #94a3b8)' }}>EVM RPC Gateway:</span>
                <strong style={{ color: '#22c55e' }}>● Operational (Sepolia)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-input, rgba(0,0,0,0.2))', border: '1px solid var(--border, rgba(255,255,255,0.05))', borderRadius: '8px' }}>
                <span style={{ color: 'var(--text-muted, #94a3b8)' }}>Smart Contract Address:</span>
                <a 
                  href="https://sepolia.etherscan.io/address/0xD87ce126F2a014fa27a7c06282E2E6931705E507" 
                  target="_blank" 
                  rel="noreferrer" 
                  style={{ color: '#22c55e', fontFamily: 'monospace', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  0xD87c...E507 ↗
                </a>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-input, rgba(0,0,0,0.2))', border: '1px solid var(--border, rgba(255,255,255,0.05))', borderRadius: '8px' }}>
                <span style={{ color: 'var(--text-muted, #94a3b8)' }}>Protocol ABI Version:</span>
                <strong style={{ color: '#22c55e' }}>v2.4.1 (ERC-20/Native)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-input, rgba(0,0,0,0.2))', border: '1px solid var(--border, rgba(255,255,255,0.05))', borderRadius: '8px' }}>
                <span style={{ color: 'var(--text-muted, #94a3b8)' }}>Off-Chain Database:</span>
                <strong style={{ color: '#22c55e' }}>● MySQL Synchronized</strong>
              </div>
            </div>
          </div>

        </div>

        {/* ── 4. TYPOGRAPHY & TEXT SIZE SCALING ── */}
        <div className="settings-section-glass">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '6px' }}>
            <div>
              <h3 className="settings-section-header" style={{ fontSize: '1.15rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ color: '#22c55e' }}>format_size</span> 
                Typography & Interface Text Sizing
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)', marginTop: '4px', marginBottom: 0 }}>
                Dynamically scale font sizes and density across all campaign cards, charts, data ledgers, and modals.
              </p>
            </div>
            <span style={{ fontSize: '0.74rem', background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '4px 10px', borderRadius: '12px', fontWeight: 800 }}>
              Active Scale: {TEXT_SIZE_OPTIONS.find(o => o.id === activeTextSize)?.name || 'Standard'} ({TEXT_SIZE_OPTIONS.find(o => o.id === activeTextSize)?.scale || '100%'})
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', margin: '16px 0' }}>
            {TEXT_SIZE_OPTIONS.map((opt) => {
              const isActive = activeTextSize === opt.id;
              return (
                <div
                  key={opt.id}
                  onClick={() => handleSelectTextSize(opt.id)}
                  style={{
                    background: isActive 
                      ? (theme === 'light' ? '#f0fdf4' : 'rgba(34, 197, 94, 0.12)') 
                      : (theme === 'light' ? '#ffffff' : 'var(--bg-input, rgba(0, 0, 0, 0.25))'),
                    border: isActive ? '2px solid #22c55e' : '1px solid var(--border, rgba(255, 255, 255, 0.08))',
                    borderRadius: '12px',
                    padding: '14px',
                    cursor: 'pointer',
                    boxShadow: isActive ? '0 0 16px rgba(34, 197, 94, 0.22)' : 'none',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                >
                  {isActive && (
                    <span className="material-symbols-outlined" style={{ position: 'absolute', top: '10px', right: '10px', fontSize: '18px', color: '#22c55e' }}>
                      check_circle
                    </span>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '22px', color: isActive ? '#22c55e' : 'var(--text-muted, #94a3b8)' }}>
                      {opt.icon}
                    </span>
                    <div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary, #ffffff)' }}>
                        {opt.name} <span style={{ fontSize: '0.74rem', color: '#22c55e', fontWeight: 700 }}>({opt.scale})</span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)' }}>Base: {opt.baseSize}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary, #cbd5e1)', lineHeight: 1.35 }}>
                    {opt.desc}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Interactive Live Typography Sample */}
          <div style={{ 
            background: 'var(--bg-input, rgba(0, 0, 0, 0.25))', 
            border: '1px dashed var(--border, rgba(255, 255, 255, 0.12))', 
            borderRadius: '10px', 
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div>
              <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted, #94a3b8)', fontWeight: 700 }}>
                Live Typography Scaling Sample:
              </div>
              <div style={{ fontSize: '0.88rem', color: 'var(--text-primary, #ffffff)', fontWeight: 600, marginTop: '2px' }}>
                "Real-time transparent cryptographic disaster relief settlements on Sepolia EVM."
              </div>
            </div>
            <span className="badge" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', borderColor: '#22c55e', fontSize: '0.72rem', padding: '4px 10px' }}>
              Dynamic Scale: {TEXT_SIZE_OPTIONS.find(o => o.id === activeTextSize)?.scale || '100%'}
            </span>
          </div>
        </div>

        {/* ── 5. DANGER ZONE: SESSION TERMINATION ── */}
        <div className="settings-section-glass settings-danger-zone">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 className="settings-section-header" style={{color: '#ef4444', margin: 0, fontSize: '1.1rem'}}>Session Termination</h3>
              <p className="settings-section-desc" style={{color: 'rgba(239, 68, 68, 0.8)', margin: '4px 0 0'}}>
                Securely close active database session and clear local authorization keys.
              </p>
            </div>
            <button className="settings-btn-danger" onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.75rem 1.5rem' }}>
              <span className="material-symbols-outlined" style={{fontSize: '18px'}}>logout</span>
              Terminate Session
            </button>
          </div>
        </div>

      </div>

      {/* ── 5. EDIT PROFILE DETAILS MODAL ── */}
      {editModalOpen && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(5, 7, 12, 0.82)', backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999
        }} className="fade-in">
          
          <div className="card bounce-in" style={{ 
            width: '520px', 
            maxWidth: '92vw', 
            padding: '28px', 
            background: 'var(--bg-card, #0f172a)', 
            border: '1px solid var(--border, rgba(34, 197, 94, 0.3))', 
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 20px rgba(34, 197, 94, 0.15)', 
            borderRadius: '20px',
            color: 'var(--text-primary, #f8fafc)'
          }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border, rgba(255,255,255,0.1))', paddingBottom: '14px', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ color: '#22c55e', fontSize: '1.4rem' }}>manage_accounts</span>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary, #fff)', fontWeight: 700 }}>
                  Edit Profile & Contact Details
                </h3>
              </div>
              <button 
                onClick={() => setEditModalOpen(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
                  color: 'var(--text-muted, #94a3b8)',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1rem'
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '4px', fontWeight: 600 }}>
                  Full Name / Entity Identifier
                </label>
                <input 
                  type="text" 
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'var(--bg-input, rgba(30, 41, 59, 0.8))',
                    border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                    color: 'var(--text-primary, #fff)',
                    fontSize: '0.88rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '4px', fontWeight: 600 }}>
                  Contact Phone Number
                </label>
                <input 
                  type="text" 
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'var(--bg-input, rgba(30, 41, 59, 0.8))',
                    border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                    color: 'var(--text-primary, #fff)',
                    fontSize: '0.88rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '4px', fontWeight: 600 }}>
                  Operational Base / Location
                </label>
                <input 
                  type="text" 
                  value={profileLocation}
                  onChange={(e) => setProfileLocation(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'var(--bg-input, rgba(30, 41, 59, 0.8))',
                    border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                    color: 'var(--text-primary, #fff)',
                    fontSize: '0.88rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '4px', fontWeight: 600 }}>
                  Advocacy / Bio Note
                </label>
                <textarea 
                  value={profileBio}
                  onChange={(e) => setProfileBio(e.target.value)}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'var(--bg-input, rgba(30, 41, 59, 0.8))',
                    border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                    color: 'var(--text-primary, #fff)',
                    fontSize: '0.85rem',
                    resize: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  className="btn btn-outline" 
                  style={{ flex: 1 }}
                  onClick={() => setEditModalOpen(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ flex: 1.5 }}
                >
                  Save Profile
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
