import React, { useState, useEffect } from 'react';
import './SettingsPanel.css';
import { ROLES, ROLE_META } from '../roleConfig';
import { contractAddress } from '../contractConfig';
import { shortAddr } from './CampaignCard';
import { useToast } from '../context/ToastContext';
import EditProfileModal from './EditProfileModal';
import DonorBadge from './DonorBadge';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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
  setTextSize,
  onProfileUpdated,
  totalDonatedEth = 0,
  totalDonatedPhp = 0,
  onOpenHonorsLadder,
  onStartTour
}) {
  const { showSuccess, showError } = useToast();
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'wallet' | 'preferences' | 'security'
  const [manualWallet, setManualWallet] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Web3 / Sepolia Network Detection
  const [currentChainId, setCurrentChainId] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.request({ method: 'eth_chainId' }).then(chain => {
        setCurrentChainId(chain);
      }).catch(() => {});

      const handleChainChanged = (chainId) => {
        setCurrentChainId(chainId);
      };
      if (window.ethereum.on) {
        window.ethereum.on('chainChanged', handleChainChanged);
      }
      return () => {
        if (window.ethereum?.removeListener) {
          window.ethereum.removeListener('chainChanged', handleChainChanged);
        }
      };
    }
  }, []);

  const isSepolia = currentChainId === '0xaa36a7' || currentChainId === '11155111' || currentChainId === 11155111;

  const handleSwitchToSepolia = async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      showError('MetaMask or Web3 wallet extension not detected in this browser.', 'Wallet Extension Missing');
      return;
    }
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xaa36a7' }]
      });
      setCurrentChainId('0xaa36a7');
      showSuccess('Switched to Ethereum Sepolia Testnet.', 'Network Switched');
    } catch (switchError) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: '0xaa36a7',
                chainName: 'Sepolia test network',
                nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://rpc.sepolia.org'],
                blockExplorerUrls: ['https://sepolia.etherscan.io']
              }
            ]
          });
          setCurrentChainId('0xaa36a7');
          showSuccess('Added and switched to Sepolia test network.', 'Network Added');
        } catch (addError) {
          showError(addError?.message || 'Failed to add Sepolia network.', 'Network Error');
        }
      } else {
        showError(switchError?.message || 'Failed to switch network.', 'Network Switch Failed');
      }
    }
  };

  // Helper to format registration date
  function formatMemberSince(dateVal) {
    if (!dateVal) return '2026';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '2026';
      return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } catch (_) {
      return '2026';
    }
  }

  // Preferences state
  const [emailNotify, setEmailNotify] = useState(() => {
    try { return localStorage.getItem('bbdrts_email_receipts') !== 'false'; } catch (_) { return true; }
  });
  const [calamityAlerts, setCalamityAlerts] = useState(() => {
    try { return localStorage.getItem('bbdrts_calamity_alerts') !== 'false'; } catch (_) { return true; }
  });
  const [glassFx, setGlassFx] = useState(() => {
    try { return localStorage.getItem('bbdrts_glass_fx') !== 'false'; } catch (_) { return true; }
  });

  // Anonymous default preference
  const getIsAnonymousFromUser = (user) => {
    if (!user) return false;
    if (user.is_anonymous !== undefined) return Boolean(user.is_anonymous);
    if (user.preferences) {
      try {
        const p = typeof user.preferences === 'string' ? JSON.parse(user.preferences) : user.preferences;
        if (p?.is_anonymous !== undefined) return Boolean(p.is_anonymous);
        if (p?.anonymous !== undefined) return Boolean(p.anonymous);
      } catch (_) {}
    }
    if (typeof window !== 'undefined') {
      const userKey = `bbdrts_anon_default_${user.id || user.email}`;
      const userScoped = localStorage.getItem(userKey);
      if (userScoped !== null) return userScoped === 'true';
    }
    return false;
  };

  const getShowBadgeFromUser = (user) => {
    if (!user) return true;
    if (user.show_badge !== undefined) return Boolean(user.show_badge);
    if (user.hide_badge !== undefined) return !user.hide_badge;
    if (user.preferences) {
      try {
        const p = typeof user.preferences === 'string' ? JSON.parse(user.preferences) : user.preferences;
        if (p?.show_badge !== undefined) return Boolean(p.show_badge);
        if (p?.hide_badge !== undefined) return !p.hide_badge;
      } catch (_) {}
    }
    if (typeof window !== 'undefined') {
      const userKey = `bbdrts_show_badge_${user.id || user.email}`;
      const userScoped = localStorage.getItem(userKey);
      if (userScoped !== null) return userScoped === 'true';
    }
    return true;
  };

  const [anonDefault, setAnonDefault] = useState(() => getIsAnonymousFromUser(currentUser));
  const [showBadge, setShowBadge] = useState(() => getShowBadgeFromUser(currentUser));

  useEffect(() => {
    const isAnon = getIsAnonymousFromUser(currentUser);
    setAnonDefault(isAnon);
    const badgeVis = getShowBadgeFromUser(currentUser);
    setShowBadge(badgeVis);
  }, [currentUser?.id, currentUser?.is_anonymous, currentUser?.show_badge, currentUser?.hide_badge, currentUser?.preferences]);

  const handleToggleAnonymous = async () => {
    const nextVal = !anonDefault;
    setAnonDefault(nextVal);
    if (typeof window !== 'undefined') {
      localStorage.setItem('bbdrts_anon_default', String(nextVal));
      if (currentUser?.id || currentUser?.email) {
        localStorage.setItem(`bbdrts_anon_default_${currentUser.id || currentUser.email}`, String(nextVal));
      }
    }

    if (currentUser) {
      let currentPrefs = {};
      try {
        currentPrefs = typeof currentUser.preferences === 'string'
          ? JSON.parse(currentUser.preferences)
          : (currentUser.preferences || {});
      } catch (_) {}

      const updatedPrefs = { ...currentPrefs, is_anonymous: nextVal, anonymous: nextVal };
      const updatedUser = { ...currentUser, is_anonymous: nextVal, preferences: updatedPrefs };

      if (onProfileUpdated) onProfileUpdated(updatedUser);

      const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
      if (token) {
        try {
          await fetch(`${API_URL}/api/auth/profile`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ preferences: updatedPrefs, is_anonymous: nextVal })
          });
        } catch (err) {
          console.warn('Failed to sync anonymity preference:', err);
        }
      }
    }

    showSuccess(
      nextVal
        ? 'Anonymous Donor Mode active. Your identity will be hidden on public donation walls.'
        : 'Public Donor Profile active. Your name will appear on verified donation receipts.',
      nextVal ? 'Anonymous Mode Enabled' : 'Public Profile Enabled'
    );
  };

  const handleToggleBadgeVisibility = async () => {
    const nextVal = !showBadge;
    setShowBadge(nextVal);
    if (typeof window !== 'undefined') {
      localStorage.setItem('bbdrts_show_badge', String(nextVal));
      if (currentUser?.id || currentUser?.email) {
        localStorage.setItem(`bbdrts_show_badge_${currentUser.id || currentUser.email}`, String(nextVal));
      }
    }

    if (currentUser) {
      let currentPrefs = {};
      try {
        currentPrefs = typeof currentUser.preferences === 'string'
          ? JSON.parse(currentUser.preferences)
          : (currentUser.preferences || {});
      } catch (_) {}

      const updatedPrefs = { ...currentPrefs, show_badge: nextVal, hide_badge: !nextVal };
      const updatedUser = { ...currentUser, show_badge: nextVal, hide_badge: !nextVal, preferences: updatedPrefs };

      if (onProfileUpdated) onProfileUpdated(updatedUser);

      const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
      if (token) {
        try {
          await fetch(`${API_URL}/api/auth/profile`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ preferences: updatedPrefs, show_badge: nextVal })
          });
        } catch (err) {
          console.warn('Failed to sync badge visibility:', err);
        }
      }
    }

    showSuccess(
      nextVal
        ? 'Recognition Badge is visible next to your name on public relief records.'
        : 'Recognition Badge hidden. Your name remains visible without the badge medal.',
      nextVal ? 'Badge Visible' : 'Badge Hidden'
    );
  };

  // Sync preference toggle to backend & storage
  const handleTogglePreference = async (key, val, successMessage) => {
    try {
      localStorage.setItem(`bbdrts_${key}`, String(val));
    } catch (_) {}

    let currentPrefs = {};
    try {
      currentPrefs = typeof currentUser?.preferences === 'string'
        ? JSON.parse(currentUser.preferences)
        : (currentUser?.preferences || {});
    } catch (_) {}

    const updatedPrefs = { ...currentPrefs, [key]: val };
    const updatedUser = { ...currentUser, preferences: updatedPrefs };
    if (onProfileUpdated) onProfileUpdated(updatedUser);

    const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
    if (token) {
      try {
        await fetch(`${API_URL}/api/auth/profile`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ preferences: updatedPrefs })
        });
      } catch (err) {
        console.warn('Failed to sync preference:', err);
      }
    }
    showSuccess(successMessage);
  };

  // Typography Scale Options
  const TEXT_SIZE_OPTIONS = [
    { id: 'compact', name: 'Compact', scale: '90%', icon: 'density_small', desc: 'Higher density for large tables and records.' },
    { id: 'normal', name: 'Standard', scale: '100%', icon: 'density_medium', desc: 'Balanced hierarchy for everyday usage.' },
    { id: 'large', name: 'Large', scale: '110%', icon: 'density_large', desc: 'Enhanced size for relaxed reading comfort.' },
    { id: 'extra-large', name: 'Extra Large', scale: '120%', icon: 'zoom_in', desc: 'Maximum accessibility and visibility.' }
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
    showSuccess(`Interface text size set to ${match?.name || sizeId} (${match?.scale || '100%'}).`, 'Text Size Updated');
  };

  // Password Change State & Handler
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const handleChangePassword = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!currentPassword) {
      showError('Please enter your current password.', 'Validation Error');
      return;
    }
    if (newPassword.length < 6) {
      showError('New password must be at least 6 characters long.', 'Validation Error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showError('New passwords do not match.', 'Password Mismatch');
      return;
    }

    setSavingPassword(true);
    try {
      const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
      if (!token) {
        showError('Session expired. Please log in again.', 'Unauthorized');
        setSavingPassword(false);
        return;
      }

      const res = await fetch(`${API_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change password.');

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showSuccess('Your password has been securely updated.', 'Password Updated');
    } catch (err) {
      showError(err.message || 'Failed to update password.', 'Error');
    } finally {
      setSavingPassword(false);
    }
  };

  if (!currentUser) return null;

  const roleMeta = ROLE_META[currentUser.role] || ROLE_META[ROLES.PUBLIC];
  const isOrg = currentUser?.role === ROLES.ORGANIZATION || currentUser?.role === 'organization';
  const isAdmin = currentUser?.role === ROLES.ADMIN || currentUser?.role === 'admin';

  let displayName = currentUser?.display_name || currentUser?.name || currentUser?.email || 'User';
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

  const userInitials = displayName ? displayName.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'US';
  const userId = currentUser.id || '1';

  return (
    <div className="bbdrts-settings-root">

      {/* ── Header Bar ── */}
      <div className="bbdrts-settings-header">
        <div className="bbdrts-settings-title-wrap">
          <h2 className="bbdrts-settings-title">
            <span className="material-symbols-outlined" style={{ fontSize: '24px', color: '#16a34a' }}>manage_accounts</span>
            Account & Settings
          </h2>
          <p className="bbdrts-settings-sub">
            Manage your personal profile, connected Ethereum wallet, and system preferences.
          </p>
        </div>

        <div className="bbdrts-settings-header-actions">
          <span className="bbdrts-settings-role-badge">
            <span className="material-symbols-outlined" style={{ fontSize: '15px', color: roleMeta.color }}>{roleMeta.icon}</span>
            <span>{isOrg ? 'Accredited NGO' : isAdmin ? 'Administrator' : 'Verified Relief Donor'}</span>
          </span>

          <button
            type="button"
            className="bbdrts-settings-edit-btn"
            onClick={() => setEditModalOpen(true)}
            title="Edit your display name, contact information, location, bio, and avatar"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
            <span>Edit Profile</span>
          </button>
        </div>
      </div>

      {/* ── Segmented Navigation Tabs ── */}
      <nav className="bbdrts-settings-tabs" aria-label="Settings categories">
        <button
          type="button"
          className={`bbdrts-settings-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>person</span>
          <span>Profile & Identity</span>
        </button>

        <button
          type="button"
          className={`bbdrts-settings-tab-btn ${activeTab === 'wallet' ? 'active' : ''}`}
          onClick={() => setActiveTab('wallet')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>account_balance_wallet</span>
          <span>Connected Wallet</span>
        </button>

        <button
          type="button"
          className={`bbdrts-settings-tab-btn ${activeTab === 'preferences' ? 'active' : ''}`}
          onClick={() => setActiveTab('preferences')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>tune</span>
          <span>Preferences & Theme</span>
        </button>

        <button
          type="button"
          className={`bbdrts-settings-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>shield</span>
          <span>Security & System</span>
        </button>
      </nav>

      {/* ══════════════════════════════════════════════════════════════════
          TAB 1: PROFILE & IDENTITY
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'profile' && (
        <div className="bbdrts-settings-pane">
          
          {/* Hero Identity Pass */}
          <div className="bbdrts-profile-hero">
            <div className="bbdrts-profile-hero-left">
              <div className="bbdrts-profile-avatar-wrap">
                {currentUser?.avatar_url && (currentUser.avatar_url.startsWith('data:') || currentUser.avatar_url.startsWith('http')) ? (
                  <img src={currentUser.avatar_url} alt="Profile Avatar" />
                ) : currentUser?.avatar_url && currentUser.avatar_url.length < 30 ? (
                  <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>{currentUser.avatar_url}</span>
                ) : (
                  userInitials
                )}
              </div>

              <div className="bbdrts-profile-hero-info">
                <div className="bbdrts-profile-name-row">
                  <h3 className="bbdrts-profile-hero-name">{displayName}</h3>
                  <span className="bbdrts-profile-badge-pill">
                    <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>verified</span>
                    {isOrg ? 'Verified NGO' : isAdmin ? 'Verified Admin' : 'Verified Donor'}
                  </span>
                </div>

                <div className="bbdrts-profile-hero-sub">
                  <span>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>mail</span>
                    {currentUser.email || `${displayName.toLowerCase().replace(/\s+/g, '')}@bbdrts.org`}
                  </span>
                  <span>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>location_on</span>
                    {currentUser.location || <span className="bbdrts-field-not-set">Location not set</span>}
                  </span>
                  <span>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>badge</span>
                    ID #{userId}
                  </span>
                  <span>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>calendar_today</span>
                    Member since {formatMemberSince(currentUser?.created_at || currentUser?.Created_At)}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="bbdrts-btn-outline"
              onClick={() => setEditModalOpen(true)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
              <span>Edit Profile</span>
            </button>
          </div>

          {/* Profile Information Card */}
          <div className="bbdrts-settings-card">
            <div className="bbdrts-settings-card-header">
              <div className="bbdrts-settings-card-title-wrap">
                <h4 className="bbdrts-settings-card-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#16a34a' }}>id_card</span>
                  Public Profile Information
                </h4>
                <p className="bbdrts-settings-card-desc">
                  Information displayed on your verified relief contribution receipts and certificates.
                </p>
              </div>

              <button
                type="button"
                className="bbdrts-btn-outline"
                onClick={() => setEditModalOpen(true)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
                <span>Edit Profile</span>
              </button>
            </div>

            <div className="bbdrts-profile-fields-grid">
              <div className="bbdrts-profile-field-item">
                <span className="bbdrts-profile-field-label">Display Name</span>
                <span className="bbdrts-profile-field-value">{displayName}</span>
              </div>

              <div className="bbdrts-profile-field-item">
                <span className="bbdrts-profile-field-label">Account Role</span>
                <span className="bbdrts-profile-field-value">{isOrg ? 'Accredited NGO Organization' : isAdmin ? 'System Administrator' : 'Humanitarian Relief Donor'}</span>
              </div>

              <div className="bbdrts-profile-field-item">
                <span className="bbdrts-profile-field-label">Contact Number</span>
                <span className="bbdrts-profile-field-value">
                  {currentUser?.phone || <span className="bbdrts-field-not-set">Not provided</span>}
                </span>
              </div>

              <div className="bbdrts-profile-field-item">
                <span className="bbdrts-profile-field-label">Registered Location</span>
                <span className="bbdrts-profile-field-value">
                  {currentUser?.location || <span className="bbdrts-field-not-set">Not provided</span>}
                </span>
              </div>

              <div className="bbdrts-profile-field-item" style={{ gridColumn: '1 / -1' }}>
                <span className="bbdrts-profile-field-label">About / Bio</span>
                <span className="bbdrts-profile-field-value">
                  {currentUser?.bio || <span className="bbdrts-field-not-set">No bio provided yet. Click "Edit Profile" to add one.</span>}
                </span>
              </div>
            </div>
          </div>

          {/* Donor Philanthropic Standing Card (Donors Only) */}
          {!isOrg && !isAdmin && (
            <div className="bbdrts-settings-card">
              <div className="bbdrts-settings-card-header">
                <div className="bbdrts-settings-card-title-wrap">
                  <h4 className="bbdrts-settings-card-title">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#16a34a' }}>military_tech</span>
                    Philanthropic Standing & Recognition
                  </h4>
                  <p className="bbdrts-settings-card-desc">
                    Your cumulative humanitarian contributions recorded on the immutable ledger.
                  </p>
                </div>

                {onOpenHonorsLadder && (
                  <button
                    type="button"
                    className="bbdrts-btn-outline"
                    onClick={onOpenHonorsLadder}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>leaderboard</span>
                    <span>View Honors Ladder</span>
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', padding: '14px', background: 'var(--bg-subcard, #fafafa)', border: '1px solid var(--border, #eaeaea)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <DonorBadge
                    size="lg"
                    walletAddress={walletAddress || currentUser?.wallet_address}
                    donorId={currentUser?.id}
                    amountEth={totalDonatedEth}
                    amountPhp={totalDonatedPhp}
                    showProgress={false}
                    onClick={onOpenHonorsLadder}
                  />
                  <div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Verified Supporter
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      ₱{Number(totalDonatedPhp).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} contributed · {Number(totalDonatedEth).toFixed(4)} ETH
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ textAlign: 'center', padding: '8px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Donated</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#16a34a' }}>₱{Number(totalDonatedPhp).toLocaleString()}</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '8px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sepolia On-Chain</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{Number(totalDonatedEth).toFixed(4)} ETH</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* NGO Regulatory Accreditation & Payout Rails (NGOs Only) */}
          {isOrg && (
            <div className="bbdrts-settings-card">
              <div className="bbdrts-settings-card-header">
                <div className="bbdrts-settings-card-title-wrap">
                  <h4 className="bbdrts-settings-card-title">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#16a34a' }}>verified_user</span>
                    Accreditation & Payout Receiving Rails
                  </h4>
                  <p className="bbdrts-settings-card-desc">
                    Official regulatory registration and active payout channels for emergency relief disbursements.
                  </p>
                </div>

                <button
                  type="button"
                  className="bbdrts-btn-outline"
                  onClick={() => setEditModalOpen(true)}
                  title="Update your payout numbers, QR codes, or accreditation numbers in Edit Profile"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>payments</span>
                  <span>Manage Rails</span>
                </button>
              </div>

              {/* Regulatory Accreditations Grid */}
              <div className="bbdrts-profile-fields-grid" style={{ marginBottom: '16px' }}>
                <div className="bbdrts-profile-field-item">
                  <span className="bbdrts-profile-field-label">SEC Registration No.</span>
                  <span className="bbdrts-profile-field-value">
                    {currentUser?.sec_registration_no || currentUser?.Sec_Registration_No || (
                      <span className="bbdrts-field-not-set">Pending Submission</span>
                    )}
                  </span>
                </div>

                <div className="bbdrts-profile-field-item">
                  <span className="bbdrts-profile-field-label">DSWD Accreditation No.</span>
                  <span className="bbdrts-profile-field-value">
                    {currentUser?.dswd_accreditation_no || currentUser?.Dswd_Accreditation_No || (
                      <span className="bbdrts-field-not-set">Pending Submission</span>
                    )}
                  </span>
                </div>

                <div className="bbdrts-profile-field-item">
                  <span className="bbdrts-profile-field-label">Verification Standing</span>
                  <span className="bbdrts-profile-field-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#16a34a' }}>check_circle</span>
                    <strong style={{ color: '#16a34a' }}>{currentUser?.verification_status || currentUser?.Verification_Status || 'Verified'}</strong>
                  </span>
                </div>

                <div className="bbdrts-profile-field-item">
                  <span className="bbdrts-profile-field-label">Emergency Hotline</span>
                  <span className="bbdrts-profile-field-value">
                    {currentUser?.emergency_hotline || currentUser?.Emergency_Hotline || (
                      <span className="bbdrts-field-not-set">Not configured</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Active Payout Channels Chips */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Receiving Channels
                </div>
                <div className="bbdrts-rails-grid">
                  <div className={`bbdrts-rail-chip ${(currentUser?.gcash_number || currentUser?.Gcash_Number) ? 'active' : ''}`}>
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#007dfe' }}>qr_code_2</span>
                    <div>
                      <div className="bbdrts-rail-title">GCash Rail</div>
                      <div className="bbdrts-rail-sub">
                        {(currentUser?.gcash_number || currentUser?.Gcash_Number)
                          ? `Active (${currentUser?.gcash_number || currentUser?.Gcash_Number})`
                          : 'Not configured'}
                      </div>
                    </div>
                  </div>

                  <div className={`bbdrts-rail-chip ${(currentUser?.maya_number || currentUser?.Maya_Number) ? 'active' : ''}`}>
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#00c389' }}>account_balance_wallet</span>
                    <div>
                      <div className="bbdrts-rail-title">Maya Rail</div>
                      <div className="bbdrts-rail-sub">
                        {(currentUser?.maya_number || currentUser?.Maya_Number)
                          ? `Active (${currentUser?.maya_number || currentUser?.Maya_Number})`
                          : 'Not configured'}
                      </div>
                    </div>
                  </div>

                  <div className={`bbdrts-rail-chip ${(currentUser?.bank_account_number || currentUser?.Bank_Account_Number || currentUser?.bank_name || currentUser?.bank_details) ? 'active' : ''}`}>
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#8b5cf6' }}>account_balance</span>
                    <div>
                      <div className="bbdrts-rail-title">Bank Transfer</div>
                      <div className="bbdrts-rail-sub">
                        {(currentUser?.bank_name || currentUser?.Bank_Name)
                          ? `${currentUser?.bank_name || currentUser?.Bank_Name}`
                          : (currentUser?.bank_details ? 'Configured' : 'Not configured')}
                      </div>
                    </div>
                  </div>

                  <div className={`bbdrts-rail-chip ${(walletAddress || currentUser?.wallet_address) ? 'active' : ''}`}>
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#16a34a' }}>currency_exchange</span>
                    <div>
                      <div className="bbdrts-rail-title">Sepolia Escrow</div>
                      <div className="bbdrts-rail-sub">
                        {(walletAddress || currentUser?.wallet_address)
                          ? shortAddr(walletAddress || currentUser?.wallet_address)
                          : 'No wallet linked'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 2: CONNECTED WALLET & WEB3
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'wallet' && (
        <div className="bbdrts-settings-pane">

          {/* Active Wallet Connection Card */}
          <div className="bbdrts-settings-card">
            <div className="bbdrts-settings-card-header">
              <div className="bbdrts-settings-card-title-wrap">
                <h4 className="bbdrts-settings-card-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#16a34a' }}>account_balance_wallet</span>
                  Ethereum Wallet Connection
                </h4>
                <p className="bbdrts-settings-card-desc">
                  Your wallet address authorizes cryptographic transactions and issues verifiable receipts on Sepolia.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isSepolia ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem', fontWeight: 600, color: '#16a34a', padding: '4px 8px', borderRadius: '4px', background: 'rgba(22, 163, 74, 0.1)', border: '1px solid rgba(22, 163, 74, 0.25)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check_circle</span>
                    Sepolia Active
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSwitchToSepolia}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      color: '#b45309',
                      background: 'rgba(245, 158, 11, 0.12)',
                      border: '1px solid rgba(245, 158, 11, 0.35)',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                    title="Switch your wallet network to Ethereum Sepolia Testnet"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>swap_horiz</span>
                    Switch to Sepolia
                  </button>
                )}
                <span style={{ fontSize: '0.74rem', fontFamily: 'monospace', padding: '4px 8px', borderRadius: '4px', background: 'var(--bg-subcard)', border: '1px solid var(--border)' }}>
                  Chain ID: 11155111
                </span>
              </div>
            </div>

            <div className={`bbdrts-wallet-box ${walletAddress ? 'connected' : 'disconnected'}`}>
              <div className="bbdrts-wallet-box-left">
                <div className={`bbdrts-wallet-icon-box ${walletAddress ? 'connected' : ''}`}>
                  <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>
                    {walletAddress ? 'link' : 'link_off'}
                  </span>
                </div>

                <div className="bbdrts-wallet-details">
                  <div className="bbdrts-wallet-status-row">
                    <span className={`bbdrts-wallet-status-dot ${walletAddress ? 'connected' : 'disconnected'}`} />
                    <span style={{ color: walletAddress ? '#16a34a' : '#ef4444' }}>
                      {walletAddress ? 'Wallet Connected & Active' : 'No Wallet Connected'}
                    </span>
                  </div>

                  {walletAddress ? (
                    <div className="bbdrts-wallet-addr-row">
                      <span className="bbdrts-wallet-addr-mono">{shortAddr(walletAddress)}</span>
                      <button
                        type="button"
                        className="bbdrts-wallet-micro-btn"
                        onClick={() => {
                          navigator.clipboard.writeText(walletAddress);
                          showSuccess('Wallet address copied to clipboard.', 'Address Copied');
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>content_copy</span>
                        <span>Copy</span>
                      </button>
                      <a
                        href={`https://sepolia.etherscan.io/address/${walletAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bbdrts-wallet-micro-btn"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>open_in_new</span>
                        <span>Etherscan</span>
                      </a>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Connect MetaMask to sign transactions or link your wallet address manually below.
                    </div>
                  )}
                </div>
              </div>

              <div className="bbdrts-wallet-actions">
                {walletAddress ? (
                  <>
                    {!contract && (
                      <button
                        type="button"
                        className="bbdrts-btn-outline"
                        onClick={() => handleConnectWallet(true)}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>sync</span>
                        <span>Sync Wallet</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="bbdrts-btn-outline"
                      style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                      onClick={async () => {
                        if (window.confirm("Are you sure you want to disconnect this wallet?")) {
                          if (updateDbWallet) {
                            await updateDbWallet('');
                          }
                          showSuccess('Wallet disconnected successfully.', 'Wallet Disconnected');
                        }
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>link_off</span>
                      <span>Disconnect</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="bbdrts-btn-primary"
                    onClick={() => handleConnectWallet(true)}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>account_balance_wallet</span>
                    <span>Connect MetaMask</span>
                  </button>
                )}
              </div>
            </div>

            {/* Network Mismatch Notice */}
            {walletAddress && currentChainId && !isSepolia && (
              <div style={{ margin: '0 20px 16px 20px', padding: '10px 14px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#b45309' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>warning</span>
                  <span>Wallet is connected to another network ({currentChainId}). Switch to Sepolia to transact.</span>
                </div>
                <button
                  type="button"
                  onClick={handleSwitchToSepolia}
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    padding: '5px 12px',
                    background: '#b45309',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                >
                  Switch to Sepolia (11155111)
                </button>
              </div>
            )}

            {/* Manual Wallet Address Binding Card */}
            <div className="bbdrts-manual-binding-box">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <strong style={{ fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                  Manual Wallet Address Binding
                </strong>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  If you are donating via external hardware wallet, mobile app, or paper key, enter your Ethereum address (0x...) to associate your public ledger receipts with this account.
                </p>
              </div>

              <div className="bbdrts-input-btn-group">
                <input
                  type="text"
                  className="bbdrts-settings-input"
                  placeholder="0x71C... (42-character Ethereum address)"
                  value={manualWallet}
                  onChange={e => setManualWallet(e.target.value)}
                />
                <button
                  type="button"
                  className="bbdrts-btn-primary"
                  onClick={async () => {
                    if (manualWallet.startsWith('0x') && manualWallet.length >= 40) {
                      if (updateDbWallet) {
                        await updateDbWallet(manualWallet.trim());
                        showSuccess('Wallet address linked successfully.', 'Wallet Bound');
                        setManualWallet('');
                      }
                    } else {
                      showError('Please enter a valid Ethereum address beginning with 0x.', 'Invalid Format');
                    }
                  }}
                >
                  Link Address
                </button>
              </div>
            </div>
          </div>

          {/* Smart Contract Verification Card */}
          <div className="bbdrts-settings-card">
            <div className="bbdrts-settings-card-header">
              <div className="bbdrts-settings-card-title-wrap">
                <h4 className="bbdrts-settings-card-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#16a34a' }}>verified</span>
                  Sepolia Smart Contract Escrow
                </h4>
                <p className="bbdrts-settings-card-desc">
                  All relief contributions are securely escrowed by our OpenZeppelin-verified smart contract.
                </p>
              </div>
            </div>

            <div className="bbdrts-diag-list">
              <div className="bbdrts-diag-item">
                <span className="bbdrts-diag-label">Active Contract Address:</span>
                <a
                  href={`https://sepolia.etherscan.io/address/${contractAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#16a34a', fontFamily: 'monospace', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <span>{contractAddress}</span>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>open_in_new</span>
                </a>
              </div>

              <div className="bbdrts-diag-item">
                <span className="bbdrts-diag-label">Network Protocol:</span>
                <span className="bbdrts-diag-value status-ok">● Ethereum Sepolia (Chain ID 11155111)</span>
              </div>

              <div className="bbdrts-diag-item">
                <span className="bbdrts-diag-label">Escrow Standard:</span>
                <span className="bbdrts-diag-value">Milestone-Based Humanitarian Release</span>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 3: PREFERENCES & THEME
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'preferences' && (
        <div className="bbdrts-settings-pane">

          {/* Visual Appearance & Theme Selection */}
          <div className="bbdrts-settings-card">
            <div className="bbdrts-settings-card-header">
              <div className="bbdrts-settings-card-title-wrap">
                <h4 className="bbdrts-settings-card-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#16a34a' }}>palette</span>
                  Visual Appearance & Theme
                </h4>
                <p className="bbdrts-settings-card-desc">
                  Choose your interface theme. Preferences are saved automatically.
                </p>
              </div>
            </div>

            <div className="bbdrts-theme-cards-grid">
              {/* Option 1: Light Mode (Default) */}
              <div
                className={`bbdrts-theme-card-option ${theme === 'light' ? 'active' : ''}`}
                onClick={() => {
                  if (setTheme) setTheme('light');
                  showSuccess('Light Mode enabled.', 'Theme Updated');
                }}
              >
                <div className="bbdrts-theme-preview-icon">
                  <span className="material-symbols-outlined">light_mode</span>
                </div>
                <div className="bbdrts-theme-option-text">
                  <span className="bbdrts-theme-option-title">Light Mode (Default)</span>
                  <span className="bbdrts-theme-option-desc">Clean white canvas with soft borders and high-contrast typography.</span>
                </div>
                {theme === 'light' && (
                  <span className="material-symbols-outlined bbdrts-theme-active-icon">check_circle</span>
                )}
              </div>

              {/* Option 2: Dark Mode */}
              <div
                className={`bbdrts-theme-card-option ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => {
                  if (setTheme) setTheme('dark');
                  showSuccess('Dark Mode enabled.', 'Theme Updated');
                }}
              >
                <div className="bbdrts-theme-preview-icon">
                  <span className="material-symbols-outlined">dark_mode</span>
                </div>
                <div className="bbdrts-theme-option-text">
                  <span className="bbdrts-theme-option-title">Dark Mode</span>
                  <span className="bbdrts-theme-option-desc">Deep charcoal and obsidian theme with comfortable contrast.</span>
                </div>
                {theme === 'dark' && (
                  <span className="material-symbols-outlined bbdrts-theme-active-icon">check_circle</span>
                )}
              </div>
            </div>
          </div>

          {/* Typography Scaling Card */}
          <div className="bbdrts-settings-card">
            <div className="bbdrts-settings-card-header">
              <div className="bbdrts-settings-card-title-wrap">
                <h4 className="bbdrts-settings-card-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#16a34a' }}>format_size</span>
                  Interface Typography Sizing
                </h4>
                <p className="bbdrts-settings-card-desc">
                  Scale text sizes across dashboards, campaign cards, tables, and dialogs.
                </p>
              </div>

              <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#16a34a' }}>
                Active: {TEXT_SIZE_OPTIONS.find(o => o.id === activeTextSize)?.name || 'Standard'}
              </span>
            </div>

            <div className="bbdrts-type-scale-grid">
              {TEXT_SIZE_OPTIONS.map((opt) => {
                const isActive = activeTextSize === opt.id;
                return (
                  <div
                    key={opt.id}
                    className={`bbdrts-type-scale-card ${isActive ? 'active' : ''}`}
                    onClick={() => handleSelectTextSize(opt.id)}
                  >
                    <div className="bbdrts-type-scale-info">
                      <span className="bbdrts-type-scale-name">{opt.name}</span>
                      <span className="bbdrts-type-scale-pct">{opt.scale} scale</span>
                    </div>
                    {isActive && (
                      <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#16a34a' }}>check</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notifications & Privacy Preferences */}
          <div className="bbdrts-settings-card">
            <div className="bbdrts-settings-card-header">
              <div className="bbdrts-settings-card-title-wrap">
                <h4 className="bbdrts-settings-card-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#16a34a' }}>notifications</span>
                  Notifications & Privacy
                </h4>
                <p className="bbdrts-settings-card-desc">
                  Manage communication alerts and public visibility options.
                </p>
              </div>
            </div>

            <div className="bbdrts-pref-list">
              <div
                className="bbdrts-pref-item"
                onClick={() => {
                  const nextVal = !emailNotify;
                  setEmailNotify(nextVal);
                  handleTogglePreference('email_receipts', nextVal, `Email contribution receipts ${nextVal ? 'enabled' : 'disabled'}.`);
                }}
              >
                <div className="bbdrts-pref-info">
                  <span className="bbdrts-pref-label">Email Contribution Receipts</span>
                  <span className="bbdrts-pref-desc">Receive tax deduction slips and on-chain verification links via email.</span>
                </div>
                <div className={`bbdrts-toggle-track ${emailNotify ? 'active' : ''}`}>
                  <div className="bbdrts-toggle-thumb" />
                </div>
              </div>

              <div
                className="bbdrts-pref-item"
                onClick={() => {
                  const nextVal = !calamityAlerts;
                  setCalamityAlerts(nextVal);
                  handleTogglePreference('calamity_alerts', nextVal, `Disaster response alerts ${nextVal ? 'enabled' : 'disabled'}.`);
                }}
              >
                <div className="bbdrts-pref-info">
                  <span className="bbdrts-pref-label">Urgent Disaster Calamity Alerts</span>
                  <span className="bbdrts-pref-desc">Instant alerts when severe typhoons, earthquakes, or floods require emergency relief.</span>
                </div>
                <div className={`bbdrts-toggle-track ${calamityAlerts ? 'active' : ''}`}>
                  <div className="bbdrts-toggle-thumb" />
                </div>
              </div>

              {!isOrg && (
                <>
                  <div className="bbdrts-pref-item" onClick={handleToggleAnonymous}>
                    <div className="bbdrts-pref-info">
                      <span className="bbdrts-pref-label">Anonymous Donor Mode</span>
                      <span className="bbdrts-pref-desc">Mask your real name on public campaign donor lists and leaderboards.</span>
                    </div>
                    <div className={`bbdrts-toggle-track ${anonDefault ? 'active' : ''}`}>
                      <div className="bbdrts-toggle-thumb" />
                    </div>
                  </div>

                  <div className="bbdrts-pref-item" onClick={handleToggleBadgeVisibility}>
                    <div className="bbdrts-pref-info">
                      <span className="bbdrts-pref-label">Philanthropic Recognition Badge</span>
                      <span className="bbdrts-pref-desc">Display your humanitarian supporter insignia next to your contributions.</span>
                    </div>
                    <div className={`bbdrts-toggle-track ${showBadge ? 'active' : ''}`}>
                      <div className="bbdrts-toggle-thumb" />
                    </div>
                  </div>
                </>
              )}

              <div
                className="bbdrts-pref-item"
                onClick={() => {
                  const nextVal = !glassFx;
                  setGlassFx(nextVal);
                  handleTogglePreference('glass_fx', nextVal, `Backdrop blur effects ${nextVal ? 'enabled' : 'disabled'}.`);
                }}
              >
                <div className="bbdrts-pref-info">
                  <span className="bbdrts-pref-label">Backdrop Blur Effects</span>
                  <span className="bbdrts-pref-desc">Frosted glass transparency across navigation bars and modal overlays.</span>
                </div>
                <div className={`bbdrts-toggle-track ${glassFx ? 'active' : ''}`}>
                  <div className="bbdrts-toggle-thumb" />
                </div>
              </div>

              {onStartTour && (
                <div
                  className="bbdrts-pref-item"
                  onClick={() => {
                    try {
                      localStorage.removeItem('bbdrts_tour_donor_done');
                      localStorage.removeItem('bbdrts_tour_ngo_done');
                      if (currentUser?.id) {
                        localStorage.removeItem(`bbdrts_tour_donor_${currentUser.id}`);
                        localStorage.removeItem(`bbdrts_tour_ngo_${currentUser.id}`);
                      }
                      localStorage.setItem('bbdrts_tour_force_launch', 'true');
                      onStartTour();
                      showSuccess('Interactive onboarding walkthrough restarted.', 'Tour Launched');
                    } catch (_) {}
                  }}
                >
                  <div className="bbdrts-pref-info">
                    <span className="bbdrts-pref-label">Reset Interactive Walkthrough</span>
                    <span className="bbdrts-pref-desc">Replay the guided feature tour for your dashboard.</span>
                  </div>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--text-muted)' }}>
                    play_circle
                  </span>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 4: SECURITY & SYSTEM STATUS
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'security' && (
        <div className="bbdrts-settings-pane">

          {/* Change Account Password Card */}
          <div className="bbdrts-settings-card">
            <div className="bbdrts-settings-card-header">
              <div className="bbdrts-settings-card-title-wrap">
                <h4 className="bbdrts-settings-card-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#16a34a' }}>lock</span>
                  Change Account Password
                </h4>
                <p className="bbdrts-settings-card-desc">
                  Update your authentication credentials. Passwords are encrypted using bcrypt hashing with salted rounds.
                </p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="bbdrts-password-form">
                <div className="bbdrts-field-group">
                  <label>Current Password</label>
                  <input
                    type="password"
                    className="bbdrts-settings-input"
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>

                <div className="bbdrts-field-group">
                  <label>New Password</label>
                  <input
                    type="password"
                    className="bbdrts-settings-input"
                    placeholder="Min. 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>

                <div className="bbdrts-field-group">
                  <label>Confirm New Password</label>
                  <input
                    type="password"
                    className="bbdrts-settings-input"
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button
                  type="submit"
                  className="bbdrts-settings-edit-btn"
                  disabled={savingPassword || !currentPassword || !newPassword}
                >
                  {savingPassword ? (
                    <>
                      <span className="material-symbols-outlined bbdrts-spin" style={{ fontSize: '14px' }}>sync</span>
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>key</span>
                      <span>Update Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* System Health Overview */}
          <div className="bbdrts-settings-card">
            <div className="bbdrts-settings-card-header">
              <div className="bbdrts-settings-card-title-wrap">
                <h4 className="bbdrts-settings-card-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#16a34a' }}>health_and_safety</span>
                  Real-Time System & Protocol Health
                </h4>
                <p className="bbdrts-settings-card-desc">
                  Status of blockchain nodes, smart contracts, and database synchronization.
                </p>
              </div>
            </div>

            <div className="bbdrts-diag-list">
              <div className="bbdrts-diag-item">
                <span className="bbdrts-diag-label">Sepolia EVM RPC Gateway:</span>
                <span className="bbdrts-diag-value status-ok">● Connected & Operational</span>
              </div>
              <div className="bbdrts-diag-item">
                <span className="bbdrts-diag-label">Smart Contract Escrow:</span>
                <span className="bbdrts-diag-value status-ok">● Active (OpenZeppelin Secure)</span>
              </div>
              <div className="bbdrts-diag-item">
                <span className="bbdrts-diag-label">Relief Ledger Database:</span>
                <span className="bbdrts-diag-value status-ok">● Synchronized</span>
              </div>
              <div className="bbdrts-diag-item">
                <span className="bbdrts-diag-label">Authentication Session:</span>
                <span className="bbdrts-diag-value">JWT Secure Session (Active)</span>
              </div>
            </div>
          </div>

          {/* Account Danger Zone / Sign Out */}
          <div className="bbdrts-settings-card bbdrts-danger-card">
            <div className="bbdrts-settings-card-header">
              <div className="bbdrts-settings-card-title-wrap">
                <h4 className="bbdrts-settings-card-title" style={{ color: '#ef4444' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#ef4444' }}>logout</span>
                  Sign Out of Account
                </h4>
                <p className="bbdrts-settings-card-desc">
                  Safely conclude your active session. You can sign back in at any time.
                </p>
              </div>

              <button
                type="button"
                className="bbdrts-danger-btn"
                onClick={handleLogout}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>logout</span>
                <span>Sign Out</span>
              </button>
            </div>
          </div>

        </div>
      )}

      {/* ── Edit Profile Modal (Single Source of Truth) ── */}
      {editModalOpen && (
        <EditProfileModal
          currentUser={currentUser}
          onClose={() => setEditModalOpen(false)}
          onProfileUpdated={(updated) => {
            if (onProfileUpdated) onProfileUpdated(updated);
          }}
          theme={theme}
          setTheme={setTheme}
        />
      )}

    </div>
  );
}
