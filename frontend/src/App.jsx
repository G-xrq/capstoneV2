import { useState, useEffect, useRef, useCallback } from 'react';
import { ethers } from 'ethers';
import { connectWallet, hydrateContract, getReadOnlyContract } from './web3Connection';
import { ROLES, ROLE_META } from './roleConfig';
import LandingView from './views/LandingView';
import AuthView from './views/AuthView';
import DonorView from './views/DonorView';
import OrganizationView from './views/OrganizationView';
import AdminView from './views/AdminView';
import SettingsPanel from './components/SettingsPanel';
import Header from './components/Header';
import Footer from './components/Footer';
import NgoProfileModal from './components/NgoProfileModal';
import ErrorBoundary from './components/ErrorBoundary';
import ReliefAiChat from './components/ReliefAiChat';
import './App.css';
import { isLocalhost, API_URL } from './config';

export default function App() {
  const contractRef = useRef(null);

  /* ── Database Auth State (Web2) ─────────────────────── */
  const [dbUser, setDbUser] = useState(null);
  // dbUser = { id, name, email, role, wallet_address }
  const [authLoading, setAuthLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false); // Default to Landing Page!
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  /* ── Wallet State (Web3) ────────────────────────────── */
  const [walletAddress, setWalletAddress] = useState('');
  const [hasMetaMask, setHasMetaMask] = useState(true);
  const [activeContract, setActiveContract] = useState(null);

  const [campaigns, setCampaigns] = useState([]);
  const [fetchingCampaigns, setFetchingCampaigns] = useState(false);

  /* ── Theme Management (Strictly 2 Themes: White / Light Mode [Default] & Dark Mode) ── */
  const [theme, setThemeState] = useState(() => {
    const saved = localStorage.getItem('bbdrts_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return 'light'; // White / Light Mode by default
  });

  const themeTransitionTimerRef = useRef(null);

  const applyThemeWithTransition = useCallback((targetTheme) => {
    const val = targetTheme === 'dark' ? 'dark' : 'light';
    const root = document.documentElement;

    const commitTheme = () => {
      root.setAttribute('data-theme', val);
      localStorage.setItem('bbdrts_theme', val);
      setThemeState(val);
    };

    if (typeof document !== 'undefined' && document.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.startViewTransition(() => {
        commitTheme();
      });
    } else {
      root.classList.add('theme-transitioning');
      if (themeTransitionTimerRef.current) {
        clearTimeout(themeTransitionTimerRef.current);
      }
      commitTheme();
      themeTransitionTimerRef.current = setTimeout(() => {
        root.classList.remove('theme-transitioning');
        themeTransitionTimerRef.current = null;
      }, 260);
    }
  }, []);

  const setTheme = useCallback((newTheme) => {
    applyThemeWithTransition(newTheme);
  }, [applyThemeWithTransition]);

  const toggleTheme = useCallback(() => {
    const current = document.documentElement.getAttribute('data-theme') || theme;
    const next = current === 'dark' ? 'light' : 'dark';
    applyThemeWithTransition(next);
  }, [theme, applyThemeWithTransition]);

  useEffect(() => {
    // Initial mount check: ensure DOM matches saved state without animation
    const currentAttr = document.documentElement.getAttribute('data-theme');
    if (currentAttr !== theme) {
      document.documentElement.setAttribute('data-theme', theme);
    }
    return () => {
      if (themeTransitionTimerRef.current) {
        clearTimeout(themeTransitionTimerRef.current);
      }
    };
  }, []);

  /* ── Text Size / Typography Preference (compact, normal, large, extra-large) ── */
  const [textSize, setTextSizeState] = useState(() => {
    const saved = localStorage.getItem('bbdrts_text_size');
    if (['compact', 'normal', 'large', 'extra-large'].includes(saved)) return saved;
    return 'normal';
  });

  const setTextSize = (newSize) => {
    const val = ['compact', 'normal', 'large', 'extra-large'].includes(newSize) ? newSize : 'normal';
    setTextSizeState(val);
    localStorage.setItem('bbdrts_text_size', val);
    document.documentElement.setAttribute('data-text-size', val);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-text-size', textSize);
  }, [textSize]);

  /* ── 1. Init Session & Check MetaMask ───────────────── */
  useEffect(() => {
    setHasMetaMask(Boolean(window.ethereum));

    const token = localStorage.getItem('bbdrts_token');
    const failsafeTimer = setTimeout(() => {
      setAuthLoading(false);
    }, 800);

    if (token) {
      fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.user) {
            setDbUser(data.user);
            const userIsAnon = Boolean(data.user.is_anonymous);
            localStorage.setItem('bbdrts_anon_default', String(userIsAnon));
            if (data.user.id || data.user.email) {
              localStorage.setItem(`bbdrts_anon_default_${data.user.id || data.user.email}`, String(userIsAnon));
            }
            if (data.user.wallet_address) {
              setWalletAddress(data.user.wallet_address);
            }
          }
        })
        .catch(err => console.error('Session restore failed:', err))
        .finally(() => {
          clearTimeout(failsafeTimer);
          setAuthLoading(false);
        });
    } else {
      clearTimeout(failsafeTimer);
      setAuthLoading(false);
    }

    const handleLiveProfileUpdate = (e) => {
      if (e.detail) {
        setDbUser(e.detail);
      }
    };
    window.addEventListener('bbdrts_profile_updated', handleLiveProfileUpdate);
    return () => {
      window.removeEventListener('bbdrts_profile_updated', handleLiveProfileUpdate);
    };
  }, []);

  /* ── 2. Handle Wallet Changes ───────────────────────── */
  useEffect(() => {
    if (!window.ethereum) return;
    const onChange = async (accounts) => {
      if (accounts.length === 0) {
        setWalletAddress('');
        contractRef.current = null;
        setActiveContract(null);
      } else {
        try {
          const contract = await hydrateContract();
          contractRef.current = contract;
          setActiveContract(contract);
          setWalletAddress(accounts[0]);
          fetchCampaigns(contract);
        } catch (err) {
          console.error('Account change error:', err);
        }
      }
    };
    window.ethereum.on('accountsChanged', onChange);

    if (dbUser && dbUser.wallet_address) {
      window.ethereum.request({ method: 'eth_accounts' })
        .then(async accounts => {
          if (accounts.length > 0 && accounts[0].toLowerCase() === dbUser.wallet_address.toLowerCase()) {
            try {
              const contract = await hydrateContract();
              contractRef.current = contract;
              setActiveContract(contract);
              fetchCampaigns(contract);
            } catch (e) {
              console.warn("Silent contract hydration prevented by MetaMask:", e);
            }
          }
        });
    }

    return () => window.ethereum.removeListener('accountsChanged', onChange);
  }, [dbUser]);

  /* ── Update DB with connected wallet ────────────────── */
  const updateDbWallet = async (address) => {
    if (!dbUser || dbUser.wallet_address === address) return;
    const token = localStorage.getItem('bbdrts_token');
    if (!token) return;
    try {
      await fetch(`${API_URL}/api/auth/wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ wallet_address: address })
      });
      setDbUser(prev => ({ ...prev, wallet_address: address }));
    } catch (err) {
      console.error('Failed to link wallet to DB Profile:', err);
    }
  };

  /* ── Smooth Auth Transition (Minimalist Vercel-Standard Handoff) ── */
  const [authTransition, setAuthTransition] = useState({
    active: false,
    closing: false,
    type: 'login', // 'login' | 'logout'
    title: '',
    subtitle: '',
    role: '',
    user: null
  });

  /* ── 3. Actions ─────────────────────────────────────── */
  const handleConnectWallet = async (forcePrompt = false) => {
    try {
      const { signer, contract } = await connectWallet(forcePrompt);
      contractRef.current = contract;
      setActiveContract(contract);
      const addr = await signer.getAddress();
      setWalletAddress(addr);
      fetchCampaigns(contract);
      updateDbWallet(addr);
    } catch (err) {
      console.error('Wallet connection failed:', err);
      if (err.message?.includes('MetaMask')) setHasMetaMask(false);
    }
  };

  const handleLoginSuccess = async (user, token) => {
    const assignedRole = user.role || 'donor';

    let friendlyName = user.display_name || user.name || '';
    if (!friendlyName || friendlyName.includes('@')) {
      const handle = user.email ? user.email.split('@')[0] : 'User';
      friendlyName = handle.replace(/[._]/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
    const firstName = friendlyName.split(' ')[0] || '';

    setAuthTransition({
      active: true,
      closing: false,
      type: 'login',
      title: firstName ? `Welcome back, ${firstName}` : 'Signing you in...',
      subtitle: assignedRole === 'organization'
        ? 'Synchronizing disaster relief operations...'
        : assignedRole === 'admin'
          ? 'Loading governance & audit console...'
          : 'Preparing your humanitarian contributions...',
      role: assignedRole,
      user
    });

    try {
      const authToken = token || localStorage.getItem('bbdrts_token');

      // Concurrently synchronize session profile, role permissions, and campaigns
      const roleFetches = [];
      if (assignedRole === 'organization') {
        if (authToken) {
          roleFetches.push(fetch(`${API_URL}/api/organization/kyc`, { headers: { 'Authorization': `Bearer ${authToken}` } }).catch(() => null));
          roleFetches.push(fetch(`${API_URL}/api/donations/me`, { headers: { 'Authorization': `Bearer ${authToken}` } }).catch(() => null));
          roleFetches.push(fetch(`${API_URL}/api/manual-donations/pending`, { headers: { 'Authorization': `Bearer ${authToken}` } }).catch(() => null));
        }
      } else if (assignedRole === 'admin') {
        if (authToken) roleFetches.push(fetch(`${API_URL}/api/admin/organizations`, { headers: { 'Authorization': `Bearer ${authToken}` } }).catch(() => null));
        roleFetches.push(fetch(`${API_URL}/api/public-stats`).catch(() => null));
      } else {
        if (authToken) roleFetches.push(fetch(`${API_URL}/api/donations/my`, { headers: { 'Authorization': `Bearer ${authToken}` } }).catch(() => null));
      }

      let contract = activeContract || contractRef.current;
      if (!contract && window.ethereum && user.wallet_address) {
        try {
          contract = await hydrateContract();
          contractRef.current = contract;
          setActiveContract(contract);
        } catch (_) {}
      }

      await Promise.all([
        fetch(`${API_URL}/api/auth/me`, { headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {} }).catch(() => null),
        ...roleFetches,
        fetchCampaigns(contract).catch(() => null),
        new Promise(r => setTimeout(r, 450)) // Smooth visual transition settling
      ]);

      // Smooth completion & handoff
      setAuthTransition(prev => ({ ...prev, closing: true }));
      setDbUser(user);
      const userIsAnon = Boolean(
        user?.is_anonymous || 
        (typeof user?.preferences === 'object' ? (user?.preferences?.is_anonymous || user?.preferences?.anonymous) : false)
      );
      localStorage.setItem('bbdrts_anon_default', String(userIsAnon));
      if (user?.id || user?.email) {
        localStorage.setItem(`bbdrts_anon_default_${user.id || user.email}`, String(userIsAnon));
      }
      if (user.wallet_address) setWalletAddress(user.wallet_address);
      setShowAuth(false);

      setTimeout(() => {
        setAuthTransition({
          active: false,
          closing: false,
          type: 'login',
          title: '',
          subtitle: '',
          role: '',
          user: null
        });
      }, 200);

    } catch (err) {
      console.warn('Notice during auth sign-in handoff:', err);
      setDbUser(user);
      setShowAuth(false);
      setAuthTransition(prev => ({ ...prev, active: false }));
    }
  };

  const handleLogout = async () => {
    setShowSettingsModal(false);
    setAuthTransition({
      active: true,
      closing: false,
      type: 'logout',
      title: 'Signing out...',
      subtitle: 'Safely closing your session & clearing cryptographic tokens...',
      role: '',
      user: null
    });

    // Clear local authentication tokens and Web3 contracts immediately
    localStorage.removeItem('bbdrts_token');
    localStorage.removeItem('token');
    localStorage.removeItem('bbdrts_user');
    localStorage.removeItem('bbdrts_anon_default');
    contractRef.current = null;
    setActiveContract(null);
    setWalletAddress('');

    // Concurrently refresh public drives for the visitor view
    await Promise.all([
      fetchCampaigns(null).catch(() => null),
      new Promise(r => setTimeout(r, 400)) // Graceful transition timing
    ]);

    setAuthTransition(prev => ({ ...prev, closing: true }));
    setDbUser(null);
    setShowAuth(true);

    setTimeout(() => {
      setAuthTransition({
        active: false,
        closing: false,
        type: 'logout',
        title: '',
        subtitle: '',
        role: '',
        user: null
      });
    }, 200);
  };

  /* ── 4. Fetch campaigns ──────────────────────────────── */
  const fetchCampaigns = async (contractOverride) => {
    try {
      setFetchingCampaigns(true);
      let dbCampaigns = [];
      try {
        const res = await fetch(`${API_URL}/api/campaigns?_t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          dbCampaigns = await res.json();
        }
      } catch (e) {
        console.error('Offline DB Sync failed:', e);
      }

      // Merge client-side localStorage cached campaigns (only enrich existing DB campaigns; do not inject ghost campaigns)
      try {
        const localCreated = JSON.parse(localStorage.getItem('bbdrts_created_campaigns') || '[]');
        const validLocal = [];
        localCreated.forEach(lc => {
          const lcTitle = (lc.title || '').trim().toLowerCase();
          const dbIndex = dbCampaigns.findIndex(d => (d.title || '').trim().toLowerCase() === lcTitle);

          const enriched = {
            title: lc.title,
            targetAmount: lc.targetAmount || lc.target_amount,
            tags: lc.tags || lc.tags_json || lc.tagsJson,
            locationRegion: lc.locationRegion || lc.location_region,
            gpsCoordinates: lc.gpsCoordinates || lc.gps_coordinates,
            beneficiariesImpact: lc.beneficiariesImpact || lc.beneficiaries_impact,
            allocationsJson: lc.allocationsJson || lc.allocations_json,
            contactInfo: lc.contactInfo || lc.contact_info,
            description: lc.description,
            urgency: lc.urgency,
            targetDate: lc.targetDate || lc.target_date,
            createdAt: lc.createdAt || lc.created_at,
            documentUrl: lc.documentUrl || lc.document_url,
            orgName: lc.orgName || lc.org_name
          };

          if (dbIndex !== -1) {
            // Overwrite any empty DB fields with local cache
            dbCampaigns[dbIndex] = {
              ...dbCampaigns[dbIndex],
              tags: dbCampaigns[dbIndex].tags || enriched.tags,
              locationRegion: dbCampaigns[dbIndex].locationRegion || enriched.locationRegion,
              gpsCoordinates: dbCampaigns[dbIndex].gpsCoordinates || enriched.gpsCoordinates,
              beneficiariesImpact: dbCampaigns[dbIndex].beneficiariesImpact || enriched.beneficiariesImpact,
              allocationsJson: dbCampaigns[dbIndex].allocationsJson || enriched.allocationsJson,
              contactInfo: dbCampaigns[dbIndex].contactInfo || enriched.contactInfo,
              description: dbCampaigns[dbIndex].description || enriched.description,
              urgency: dbCampaigns[dbIndex].urgency || enriched.urgency,
              targetDate: dbCampaigns[dbIndex].targetDate || enriched.targetDate,
              createdAt: dbCampaigns[dbIndex].createdAt || enriched.createdAt,
              documentUrl: dbCampaigns[dbIndex].documentUrl || enriched.documentUrl
            };
            validLocal.push(lc);
          }
        });
        // Prune orphan/stale campaigns from localStorage so ghost causes never persist
        localStorage.setItem('bbdrts_created_campaigns', JSON.stringify(validLocal));
      } catch (e) {
        console.warn('Failed to load local campaign cache:', e);
      }

      const contract = contractOverride || contractRef.current || getReadOnlyContract();
      if (contract && dbCampaigns.length > 0) {
        try {
          const count = Number(await contract.campaignCount());
          const synced = [];
          for (const dbCamp of dbCampaigns) {
            let onChainData = null;
            if (dbCamp.id && dbCamp.id <= count) {
              try {
                const c = await contract.campaigns(dbCamp.id);
                if (c && c[1]) onChainData = c;
              } catch (_) { }
            }
            if (!onChainData) {
              for (let i = 1; i <= count; i++) {
                try {
                  const c = await contract.campaigns(i);
                  if (c && c[1] && c[1].trim().toLowerCase() === (dbCamp.title || '').trim().toLowerCase()) {
                    onChainData = c;
                    break;
                  }
                } catch (_) { }
              }
            }

            if (onChainData) {
              const onChainEth = parseFloat(ethers.formatEther(onChainData[3])) || 0;
              const dbEth = parseFloat(dbCamp.currentAmount || 0) || 0;
              const finalCurrent = Math.max(onChainEth, dbEth);

              synced.push({
                ...dbCamp,
                orgAddress: onChainData[0] || dbCamp.orgAddress,
                targetAmount: ethers.formatEther(onChainData[2]),
                currentAmount: finalCurrent.toString(),
                isActive: onChainData[4]
              });
            } else {
              synced.push(dbCamp);
            }
          }
          setCampaigns(synced);
        } catch (contractErr) {
          console.warn('On-chain campaign sync warning:', contractErr);
          setCampaigns(dbCampaigns);
        }
      } else {
        setCampaigns(dbCampaigns);
      }
    } catch (err) {
      console.error('Campaign sync error:', err);
    } finally {
      setFetchingCampaigns(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);



  const uiRole = dbUser?.role || ROLES.PUBLIC;
  const roleMeta = ROLE_META[uiRole];

  const [selectedNgoForProfile, setSelectedNgoForProfile] = useState(null);
  const [activeTabInfo, setActiveTabInfo] = useState({
    tab: 'dashboard',
    section: 'Dashboard Overview',
    meta: null
  });

  const handleActiveTabChange = useCallback((tab, meta = null) => {
    const nextTab = tab || 'dashboard';
    const nextSection = meta?.section || (typeof tab === 'string' ? tab : 'Dashboard Overview');
    setActiveTabInfo(prev => {
      if (prev.tab === nextTab && prev.section === nextSection) return prev;
      return {
        tab: nextTab,
        section: nextSection,
        meta
      };
    });
  }, []);

  const sharedProps = {
    contract: activeContract,
    walletAddress,
    role: uiRole,
    campaigns,
    fetchCampaigns,
    fetchingCampaigns,
    currentUser: dbUser,
    handleConnectWallet,
    handleLogout,
    updateDbWallet,
    theme,
    setTheme,
    textSize,
    setTextSize,
    onOpenNgoProfile: (id) => setSelectedNgoForProfile(id || 3),
    onActiveTabChange: handleActiveTabChange
  };

  return (
    <div className="app" data-theme={theme}>

      {/* ── Modern Institutional Header with Live Network Status & Profile Hub ── */}
      <Header
        dbUser={dbUser}
        walletAddress={walletAddress}
        handleConnectWallet={handleConnectWallet}
        handleLogout={handleLogout}
        showAuth={showAuth}
        setShowAuth={setShowAuth}
        authMode={authMode}
        setAuthMode={setAuthMode}
        setShowSettingsModal={setShowSettingsModal}
        theme={theme}
        toggleTheme={toggleTheme}
        onOpenNgoProfile={(id) => setSelectedNgoForProfile(id || 3)}
      />

      <ErrorBoundary>
        {/* ── Unauthenticated Views: Default Landing Page vs Auth Portal ── */}
        {!dbUser && !showAuth && (
          <LandingView
            onConnect={() => {
              setAuthMode('login');
              setShowAuth(true);
            }}
            onSignIn={() => {
              setAuthMode('login');
              setShowAuth(true);
            }}
            onSignUp={() => {
              setAuthMode('register');
              setShowAuth(true);
            }}
            hasMetaMask={hasMetaMask}
            contract={activeContract}
            onOpenNgoProfile={(id) => setSelectedNgoForProfile(id || 3)}
            theme={theme}
          />
        )}

        {!dbUser && showAuth && (
          <AuthView
            onLoginSuccess={handleLoginSuccess}
            onConnectWallet={handleConnectWallet}
            hasMetaMask={hasMetaMask}
            onBack={() => setShowAuth(false)}
            theme={theme}
            initialMode={authMode}
          />
        )}

        {/* ── Role-based Dashboards (Require Wallet for Actions) ── */}
        {dbUser && (
          <div className="dashboard-enter-reveal">
            {/* Connect wallet prompt (Required for live on-chain, optional for localhost) */}
            {!walletAddress && (
              <div className="container" style={{ marginTop: '20px' }}>
                <div
                  className="metamask-alert-banner"
                  style={isLocalhost ? {
                    background: 'linear-gradient(90deg, rgba(56, 189, 248, 0.08), rgba(34, 197, 94, 0.1))',
                    borderColor: 'rgba(34, 197, 94, 0.35)',
                    color: 'var(--success)'
                  } : {}}
                >
                  <span className="material-symbols-outlined metamask-icon" style={isLocalhost ? { color: '#22c55e' } : {}}>
                    {isLocalhost ? 'bolt' : 'warning'}
                  </span>
                  <div className="metamask-alert-content">
                    <strong>
                      {isLocalhost
                        ? 'Localhost Mode: MetaMask Requirement Removed'
                        : (!hasMetaMask ? 'MetaMask Required' : 'MetaMask Required for Financial Actions')}
                    </strong>
                    <span>
                      {isLocalhost
                        ? `You are signed in as ${dbUser.email}. On localhost, you can deploy relief campaigns directly without connecting MetaMask.`
                        : !hasMetaMask
                          ? 'Please install the MetaMask browser extension to connect your Web3 wallet.'
                          : `You are signed securely into your account (${dbUser.email}), but to deploy campaigns or make donations, you must connect your Web3 wallet.`}
                    </span>
                  </div>
                  {!isLocalhost && !hasMetaMask ? (
                    <a
                      href="https://metamask.io/download/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-primary metamask-connect-btn"
                      style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <span className="material-symbols-outlined icon-sm">download</span>
                      <span>Download MetaMask ↗</span>
                    </a>
                  ) : (
                    <button className={`btn btn-sm metamask-connect-btn ${isLocalhost ? 'btn-outline' : 'btn-primary'}`} onClick={handleConnectWallet}>
                      <span className="material-symbols-outlined icon-sm">link</span>
                      {isLocalhost ? 'Connect Wallet (Optional)' : 'Connect MetaMask'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {uiRole === ROLES.ADMIN && <AdminView {...sharedProps} />}
            {uiRole === ROLES.ORGANIZATION && <OrganizationView {...sharedProps} />}
            {uiRole === ROLES.DONOR && <DonorView {...sharedProps} />}
          </div>
        )}
      </ErrorBoundary>

      {/* ── Account Settings Modal Overlay ── */}
      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)} style={{ zIndex: 10000 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '860px', width: '92%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', position: 'relative' }}>
            <button
              onClick={() => setShowSettingsModal(false)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', borderRadius: '8px' }}
              title="Close Settings (Esc)"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
            </button>
            <SettingsPanel
              contract={activeContract}
              currentUser={dbUser}
              walletAddress={walletAddress}
              handleConnectWallet={handleConnectWallet}
              handleLogout={handleLogout}
              updateDbWallet={updateDbWallet}
              theme={theme}
              setTheme={setTheme}
              textSize={textSize}
              setTextSize={setTextSize}
              onProfileUpdated={(updated) => setDbUser(updated)}
            />
          </div>
        </div>
      )}

      {/* ── Reworked Premium Vercel-Standard Auth Transition Overlay ── */}
      {authTransition.active && (
        <div
          className={`auth-transition-backdrop ${authTransition.closing ? 'closing' : ''}`}
          data-theme={theme}
          role="status"
          aria-live="polite"
        >
          <div className="auth-transition-card">
            {/* Top Hairline Animated Progress Bar */}
            <div className="auth-transition-progress-bar">
              <div className={`auth-transition-progress-indicator ${authTransition.closing ? 'done' : 'running'}`} />
            </div>

            <div className="auth-transition-inner">
              {/* Top Row: System Identity & Status Badge */}
              <div className="auth-transition-top-row">
                <div className="auth-transition-brand">
                  <div className="auth-transition-logo-badge">
                    <img
                      src="/logo.png"
                      alt="BBDRTS"
                      className="auth-transition-logo-img"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                    <span className="material-symbols-outlined auth-transition-logo-fallback">shield</span>
                  </div>
                  <span className="auth-transition-sysname">BBDRTS</span>
                </div>

                <div className={`auth-transition-status-pill ${authTransition.type}`}>
                  <span className="auth-transition-pulse-dot" />
                  <span>
                    {authTransition.type === 'logout'
                      ? 'Closing Session'
                      : authTransition.role === 'organization'
                        ? 'NGO Portal'
                        : authTransition.role === 'admin'
                          ? 'Governance'
                          : 'Donor Hub'}
                  </span>
                </div>
              </div>

              {/* Main Visual & Info */}
              <div className="auth-transition-main-content">
                <div className="auth-transition-avatar-box">
                  {authTransition.type === 'logout' ? (
                    <div className="auth-transition-icon-circle logout">
                      <span className="material-symbols-outlined">logout</span>
                    </div>
                  ) : authTransition.user?.avatar_url ? (
                    <img src={authTransition.user.avatar_url} alt="Profile" className="auth-transition-user-avatar" />
                  ) : (
                    <div className="auth-transition-icon-circle login">
                      <span className="material-symbols-outlined">
                        {authTransition.role === 'organization'
                          ? 'corporate_fare'
                          : authTransition.role === 'admin'
                            ? 'admin_panel_settings'
                            : 'volunteer_activism'}
                      </span>
                    </div>
                  )}
                  <div className="auth-transition-spinner-ring" />
                </div>

                <div className="auth-transition-copy">
                  <h3 className="auth-transition-title">
                    {authTransition.title || (authTransition.type === 'logout' ? 'Signing you out...' : 'Signing you in...')}
                  </h3>
                  <p className="auth-transition-subtitle">
                    {authTransition.subtitle || (authTransition.type === 'logout' ? 'Safely closing your session...' : 'Preparing your workspace...')}
                  </p>
                </div>
              </div>

              {/* Bottom Cryptographic Assurance Footer */}
              <div className="auth-transition-footer">
                <div className="auth-transition-assurance">
                  <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>lock</span>
                  <span>
                    {authTransition.type === 'logout'
                      ? 'Securely wiping local session keys'
                      : 'Sepolia EVM Cryptographic Verification'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Verified Institutional NGO Social Profile Modal ── */}
      {selectedNgoForProfile && (
        <NgoProfileModal
          orgId={selectedNgoForProfile}
          onClose={() => setSelectedNgoForProfile(null)}
          theme={theme}
        />
      )}

      {/* ── "ReliefAI" Humanitarian Relief Copilot Floating Assistant (Module C) with Live Dashboard Intelligence ── */}
      <ReliefAiChat
        currentUser={dbUser}
        walletAddress={walletAddress}
        userRole={dbUser?.role || 'donor'}
        campaigns={campaigns}
        activeView={
          !dbUser 
            ? (showAuth ? 'Authentication Portal' : 'Public Landing Page') 
            : (uiRole === ROLES.ADMIN ? 'Admin Governance Console' : uiRole === ROLES.ORGANIZATION ? 'NGO Operations Portal' : 'Donor Portal')
        }
        activeSubpage={
          showSettingsModal
            ? 'Account Profile & Security Settings Modal'
            : selectedNgoForProfile
              ? 'Verified Institutional NGO Profile Modal'
              : !dbUser
                ? (showAuth ? 'Authentication Portal' : 'Public Landing Page')
                : (activeTabInfo?.section || activeTabInfo?.tab || 'Dashboard Overview')
        }
        activeTabMeta={activeTabInfo?.meta}
      />

      {/* ── Modern Institutional 4-Column Mega Footer ── */}
      <Footer onNavigate={() => { }} theme={theme} toggleTheme={toggleTheme} />

    </div>
  );
}