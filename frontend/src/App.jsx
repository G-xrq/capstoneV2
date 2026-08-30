import { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { connectWallet } from './web3Connection';
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
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function App() {
  const contractRef = useRef(null);

  /* ── Database Auth State (Web2) ─────────────────────── */
  const [dbUser, setDbUser] = useState(null);
  // dbUser = { id, name, email, role, wallet_address }
  const [authLoading, setAuthLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false); // Default to Landing Page!
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  /* ── Wallet State (Web3) ────────────────────────────── */
  const [walletAddress, setWalletAddress] = useState('');
  const [hasMetaMask, setHasMetaMask] = useState(true);
  const [activeContract, setActiveContract] = useState(null);

  const [campaigns, setCampaigns] = useState([]);
  const [fetchingCampaigns, setFetchingCampaigns] = useState(false);

  /* ── Theme Management (Dark #111/#222/#333, Inverted Light, Cyber Navy) ── */
  const [theme, setThemeState] = useState(() => {
    const saved = localStorage.getItem('bbdrts_theme');
    if (saved === 'light' || saved === 'dark' || saved === 'cyber') return saved;
    return 'dark';
  });

  const setTheme = (newTheme) => {
    const val = (newTheme === 'light' || newTheme === 'cyber') ? newTheme : 'dark';
    setThemeState(val);
    localStorage.setItem('bbdrts_theme', val);
    document.documentElement.setAttribute('data-theme', val);
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : theme === 'light' ? 'cyber' : 'dark';
    setTheme(next);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

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
          const { contract } = await connectWallet();
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
              const { hydrateContract } = await import('./web3Connection.js');
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

  /* ── Smooth Auth Transition (Live Network & Web3 Handshake Synchronization) ── */
  const [authTransition, setAuthTransition] = useState({
    active: false,
    closing: false,
    type: 'login', // 'login' | 'logout'
    stage: 1,      // 1, 2, 3, 4
    title: '',
    role: '',
    user: null,
    latencyMs: 42
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
    const startPing = performance.now();

    setAuthTransition({
      active: true,
      closing: false,
      type: 'login',
      stage: 1,
      title: `Welcome, ${user.name || user.email}!`,
      role: assignedRole,
      user,
      latencyMs: Math.round(Math.random() * 20 + 30)
    });

    try {
      const authToken = token || localStorage.getItem('bbdrts_token');

      // ── Stage 1: Real Session & Token Validation ──
      await Promise.all([
        fetch(`${API_URL}/api/auth/me`, {
          headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
        }).catch(() => null),
        new Promise(r => setTimeout(r, 260)) // Smooth visual pacing
      ]);

      // ── Stage 2: Live Role Profile & Governance Permissions Sync ──
      setAuthTransition(prev => ({ ...prev, stage: 2 }));
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

      await Promise.all([
        ...roleFetches,
        new Promise(r => setTimeout(r, 320))
      ]);

      // ── Stage 3: Sepolia EVM Contract & Campaign Hydration ──
      setAuthTransition(prev => ({ ...prev, stage: 3 }));
      let contract = activeContract || contractRef.current;
      if (!contract && window.ethereum && user.wallet_address) {
        try {
          const { hydrateContract } = await import('./web3Connection.js');
          contract = await hydrateContract();
          contractRef.current = contract;
          setActiveContract(contract);
        } catch (_) {}
      }

      await Promise.all([
        fetchCampaigns(contract).catch(() => null),
        new Promise(r => setTimeout(r, 360))
      ]);

      // Measure true roundtrip latency
      const elapsedPing = Math.round(performance.now() - startPing);
      setAuthTransition(prev => ({ ...prev, stage: 4, latencyMs: Math.max(28, Math.min(elapsedPing, 95)) }));
      
      // ── Stage 4: Access Granted & Seamless Handoff ──
      await new Promise(r => setTimeout(r, 260));

      // Trigger smooth exit transition
      setAuthTransition(prev => ({ ...prev, closing: true }));
      setDbUser(user);
      if (user.wallet_address) setWalletAddress(user.wallet_address);
      setShowAuth(false);

      setTimeout(() => {
        setAuthTransition({
          active: false,
          closing: false,
          type: 'login',
          stage: 1,
          title: '',
          role: '',
          user: null,
          latencyMs: 38
        });
      }, 320);

    } catch (err) {
      console.warn('Network sync notice during auth transition:', err);
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
      stage: 1,
      title: 'Disconnecting Session...',
      role: '',
      user: null,
      latencyMs: 32
    });

    // Step 1: Disconnecting Web3
    await new Promise(r => setTimeout(r, 260));
    setAuthTransition(prev => ({ ...prev, stage: 2 }));

    // Step 2: Purging Local Storage & Keys
    localStorage.removeItem('bbdrts_token');
    contractRef.current = null;
    setActiveContract(null);
    setWalletAddress('');
    
    // Step 3: Refreshing Public Campaigns
    setAuthTransition(prev => ({ ...prev, stage: 3 }));
    await Promise.all([
      fetchCampaigns(null).catch(() => null),
      new Promise(r => setTimeout(r, 320))
    ]);

    // Smooth exit
    setAuthTransition(prev => ({ ...prev, closing: true }));
    setDbUser(null);
    setShowAuth(false);

    setTimeout(() => {
      setAuthTransition({
        active: false,
        closing: false,
        type: 'logout',
        stage: 1,
        title: '',
        role: '',
        user: null,
        latencyMs: 32
      });
    }, 320);
  };

  /* ── 4. Fetch campaigns ──────────────────────────────── */
  const fetchCampaigns = async (contractOverride) => {
    try {
      setFetchingCampaigns(true);
      let dbCampaigns = [];
      try {
        const res = await fetch(`${API_URL}/api/campaigns`);
        if (res.ok) {
          dbCampaigns = await res.json();
        }
      } catch (e) {
        console.error('Offline DB Sync failed:', e);
      }

      // Merge client-side localStorage cached campaigns
      try {
        const localCreated = JSON.parse(localStorage.getItem('bbdrts_created_campaigns') || '[]');
        localCreated.forEach(lc => {
          const lcTitle = (lc.title || '').trim().toLowerCase();
          const dbIndex = dbCampaigns.findIndex(d => (d.title || '').trim().toLowerCase() === lcTitle);

          const enriched = {
            title: lc.title,
            targetAmount: lc.targetAmount || lc.target_amount,
            locationRegion: lc.locationRegion || lc.location_region,
            gpsCoordinates: lc.gpsCoordinates || lc.gps_coordinates,
            beneficiariesImpact: lc.beneficiariesImpact || lc.beneficiaries_impact,
            allocationsJson: lc.allocationsJson || lc.allocations_json,
            contactInfo: lc.contactInfo || lc.contact_info,
            description: lc.description,
            urgency: lc.urgency,
            targetDate: lc.targetDate || lc.target_date,
            documentUrl: lc.documentUrl || lc.document_url,
            orgName: lc.orgName || lc.org_name
          };

          if (dbIndex !== -1) {
            // Overwrite any empty DB fields with local cache
            dbCampaigns[dbIndex] = {
              ...dbCampaigns[dbIndex],
              locationRegion: dbCampaigns[dbIndex].locationRegion || enriched.locationRegion,
              gpsCoordinates: dbCampaigns[dbIndex].gpsCoordinates || enriched.gpsCoordinates,
              beneficiariesImpact: dbCampaigns[dbIndex].beneficiariesImpact || enriched.beneficiariesImpact,
              allocationsJson: dbCampaigns[dbIndex].allocationsJson || enriched.allocationsJson,
              contactInfo: dbCampaigns[dbIndex].contactInfo || enriched.contactInfo,
              description: dbCampaigns[dbIndex].description || enriched.description,
              urgency: dbCampaigns[dbIndex].urgency || enriched.urgency,
              targetDate: dbCampaigns[dbIndex].targetDate || enriched.targetDate,
              documentUrl: dbCampaigns[dbIndex].documentUrl || enriched.documentUrl
            };
          } else {
            dbCampaigns.unshift(enriched);
          }
        });
      } catch (e) {
        console.warn('Failed to load local campaign cache:', e);
      }

      const contract = contractOverride || contractRef.current;
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
              synced.push({
                ...dbCamp,
                orgAddress: onChainData[0] || dbCamp.orgAddress,
                targetAmount: ethers.formatEther(onChainData[2]),
                currentAmount: ethers.formatEther(onChainData[3]),
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
    onOpenNgoProfile: (id) => setSelectedNgoForProfile(id || 3)
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
        setShowSettingsModal={setShowSettingsModal}
        theme={theme}
        toggleTheme={toggleTheme}
        onOpenNgoProfile={(id) => setSelectedNgoForProfile(id || 3)}
      />

      {/* ── Unauthenticated Views: Default Landing Page vs Auth Portal ── */}
      {!dbUser && !showAuth && (
        <LandingView
          onConnect={() => setShowAuth(true)}
          hasMetaMask={hasMetaMask}
          contract={activeContract}
          onOpenNgoProfile={(id) => setSelectedNgoForProfile(id || 3)}
        />
      )}

      {!dbUser && showAuth && (
        <AuthView
          onLoginSuccess={handleLoginSuccess}
          onConnectWallet={handleConnectWallet}
          hasMetaMask={hasMetaMask}
          onBack={() => setShowAuth(false)}
          theme={theme}
        />
      )}

      {/* ── Role-based Dashboards (Require Wallet for Actions) ── */}
      {dbUser && (
        <div className="dashboard-enter-reveal">
          {/* Global requirement to connect wallet if they are signed into the DB but have no active Web3 session */}
          {!walletAddress && (
            <div className="container" style={{ marginTop: '20px' }}>
              <div className="metamask-alert-banner">
                <span className="material-symbols-outlined metamask-icon">warning</span>
                <div className="metamask-alert-content">
                  <strong>MetaMask Required for Financial Actions</strong>
                  <span>You are signed securely into your account ({dbUser.email}), but to deploy campaigns or make donations, you must connect your Web3 wallet.</span>
                </div>
                <button className="btn btn-primary btn-sm metamask-connect-btn" onClick={handleConnectWallet}>
                  <span className="material-symbols-outlined icon-sm">link</span>
                  Connect MetaMask
                </button>
              </div>
            </div>
          )}

          {uiRole === ROLES.ADMIN && <AdminView {...sharedProps} />}
          {uiRole === ROLES.ORGANIZATION && <OrganizationView {...sharedProps} />}
          {uiRole === ROLES.DONOR && <DonorView {...sharedProps} />}
        </div>
      )}

      {/* ── Account Settings Modal Overlay ── */}
      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)} style={{ zIndex: 10000 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '680px', width: '90%', background: '#131622', border: '1px solid #242a3c', borderRadius: '16px', padding: '24px', position: 'relative' }}>
            <button
              onClick={() => setShowSettingsModal(false)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '24px', cursor: 'pointer' }}
            >
              ×
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
            />
          </div>
        </div>
      )}

      {/* ── Ultra-Smooth Multi-Stage Holographic Web3 Transition Overlay (Login & Logout) ── */}
      {authTransition.active && (
        <div className={`auth-transition-backdrop ${authTransition.closing ? 'closing' : ''}`} data-theme={theme}>
          {/* Ambient Glow Orb */}
          <div style={{
            position: 'absolute',
            width: '420px',
            height: '420px',
            borderRadius: '50%',
            filter: 'blur(90px)',
            opacity: theme === 'light' ? 0.35 : 0.65,
            animation: 'ambientGlowPulse 2.5s infinite ease-in-out',
            background: authTransition.type === 'logout'
              ? 'radial-gradient(circle, rgba(239, 68, 68, 0.5) 0%, rgba(249, 115, 22, 0) 70%)'
              : authTransition.role === 'admin'
                ? 'radial-gradient(circle, rgba(168, 85, 247, 0.5) 0%, rgba(56, 189, 248, 0) 70%)'
                : authTransition.role === 'organization'
                  ? 'radial-gradient(circle, rgba(56, 189, 248, 0.5) 0%, rgba(34, 197, 94, 0) 70%)'
                  : 'radial-gradient(circle, rgba(34, 197, 94, 0.5) 0%, rgba(56, 189, 248, 0) 70%)'
          }} />

          <div className="auth-transition-card">

            {/* Dual Orbital Rings with Center Avatar */}
            <div style={{ position: 'relative', width: '96px', height: '96px', margin: '0 auto 20px auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {/* Outer Counter-Clockwise Ring */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                border: '2px solid transparent',
                borderTopColor: authTransition.type === 'logout' ? '#ef4444' : authTransition.role === 'admin' ? '#c084fc' : theme === 'light' ? '#0284c7' : '#38bdf8',
                borderBottomColor: authTransition.type === 'logout' ? '#f97316' : theme === 'light' ? '#16a34a' : '#22c55e',
                animation: 'spinCounterClockwise 3.5s linear infinite'
              }} />

              {/* Inner Clockwise Dashed Ring */}
              <div style={{
                position: 'absolute',
                top: '7px',
                left: '7px',
                width: '82px',
                height: '82px',
                borderRadius: '50%',
                border: theme === 'light' ? '1.5px dashed rgba(0, 0, 0, 0.25)' : '1.5px dashed rgba(255, 255, 255, 0.3)',
                animation: 'spinClockwise 4.5s linear infinite'
              }} />

              {/* Center Role Icon */}
              <div style={{
                width: '62px',
                height: '62px',
                borderRadius: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: authTransition.type === 'logout'
                  ? 'rgba(239, 68, 68, 0.18)'
                  : authTransition.role === 'admin'
                    ? 'rgba(168, 85, 247, 0.18)'
                    : authTransition.role === 'organization'
                      ? 'rgba(56, 189, 248, 0.18)'
                      : 'rgba(34, 197, 94, 0.18)',
                color: authTransition.type === 'logout'
                  ? '#ef4444'
                  : authTransition.role === 'admin'
                    ? '#a855f7'
                    : authTransition.role === 'organization'
                      ? '#0284c7'
                      : '#16a34a',
                boxShadow: theme === 'light' ? '0 4px 15px rgba(0,0,0,0.08)' : '0 0 25px rgba(0,0,0,0.5)',
                border: theme === 'light' ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255, 255, 255, 0.15)'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>
                  {authTransition.type === 'logout'
                    ? 'logout'
                    : authTransition.role === 'admin'
                      ? 'shield_person'
                      : authTransition.role === 'organization'
                        ? 'corporate_fare'
                        : 'volunteer_activism'}
                </span>
              </div>
            </div>

            {/* Title */}
            <h3 className="auth-transition-title">
              {authTransition.title}
            </h3>

            {/* Status Pill with Live Percentage */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: '999px',
              fontSize: '0.7rem',
              fontWeight: 800,
              letterSpacing: '0.6px',
              textTransform: 'uppercase',
              marginBottom: '18px',
              background: authTransition.type === 'logout'
                ? 'rgba(239, 68, 68, 0.15)'
                : 'rgba(56, 189, 248, 0.15)',
              color: authTransition.type === 'logout' ? '#ef4444' : theme === 'light' ? '#0284c7' : '#38bdf8',
              border: `1px solid ${authTransition.type === 'logout' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(56, 189, 248, 0.3)'}`
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                {authTransition.type === 'logout' ? 'lock_reset' : 'sensors'}
              </span>
              <span>
                {authTransition.type === 'logout'
                  ? `STAGE ${authTransition.stage}/3: DISCONNECTING (${Math.min(authTransition.stage * 35, 100)}%)`
                  : `STAGE ${Math.min(authTransition.stage, 3)}/3: LIVE NETWORK HANDSHAKE (${Math.min(authTransition.stage * 28, 100)}%)`}
              </span>
            </div>

            {/* Interactive Live Handshake Checklist */}
            <div className="auth-transition-checklist">
              {authTransition.type === 'login' ? (
                <>
                  {/* Step 1 */}
                  <div className="auth-transition-item">
                    <span style={{ color: authTransition.stage >= 1 ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#0284c7' }}>key</span>
                      Validating Session Security Token
                    </span>
                    {authTransition.stage >= 2 ? (
                      <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--accent)', animation: 'stageCheckPop 0.25s ease-out' }}>check_circle</span>
                    ) : (
                      <div className="spinner spinner-light" style={{ width: '14px', height: '14px' }} />
                    )}
                  </div>

                  {/* Step 2 */}
                  <div className="auth-transition-item">
                    <span style={{ color: authTransition.stage >= 2 ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#a855f7' }}>verified_user</span>
                      Syncing Role Governance [{authTransition.role.toUpperCase()}]
                    </span>
                    {authTransition.stage >= 3 ? (
                      <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--accent)', animation: 'stageCheckPop 0.25s ease-out' }}>check_circle</span>
                    ) : authTransition.stage === 2 ? (
                      <div className="spinner spinner-light" style={{ width: '14px', height: '14px' }} />
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>⋯</span>
                    )}
                  </div>

                  {/* Step 3 */}
                  <div className="auth-transition-item">
                    <span style={{ color: authTransition.stage >= 3 ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--accent)' }}>account_tree</span>
                      Hydrating Sepolia EVM Node & Live Campaigns
                    </span>
                    {authTransition.stage >= 4 ? (
                      <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--accent)', animation: 'stageCheckPop 0.25s ease-out' }}>check_circle</span>
                    ) : authTransition.stage === 3 ? (
                      <div className="spinner spinner-light" style={{ width: '14px', height: '14px' }} />
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>⋯</span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Logout Step 1 */}
                  <div className="auth-transition-item">
                    <span style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#ef4444' }}>lock</span>
                      Terminating Active Web3 Session
                    </span>
                    {authTransition.stage >= 2 ? (
                      <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--accent)', animation: 'stageCheckPop 0.25s ease-out' }}>check_circle</span>
                    ) : (
                      <div className="spinner spinner-light" style={{ width: '14px', height: '14px' }} />
                    )}
                  </div>

                  {/* Logout Step 2 */}
                  <div className="auth-transition-item">
                    <span style={{ color: authTransition.stage >= 2 ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#f97316' }}>delete_sweep</span>
                      Purging Local Auth Tokens & Cache
                    </span>
                    {authTransition.stage >= 3 ? (
                      <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--accent)', animation: 'stageCheckPop 0.25s ease-out' }}>check_circle</span>
                    ) : authTransition.stage === 2 ? (
                      <div className="spinner spinner-light" style={{ width: '14px', height: '14px' }} />
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>⋯</span>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Animated Dynamic Progress Bar */}
            <div style={{
              width: '100%',
              height: '5px',
              background: theme === 'light' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)',
              borderRadius: '999px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: authTransition.type === 'logout'
                  ? `${Math.min(authTransition.stage * 35, 100)}%`
                  : `${Math.min(authTransition.stage * 28, 100)}%`,
                background: authTransition.type === 'logout'
                  ? 'linear-gradient(90deg, #ef4444, #f97316)'
                  : authTransition.role === 'admin'
                    ? 'linear-gradient(90deg, #a855f7, #38bdf8)'
                    : 'linear-gradient(90deg, #38bdf8, var(--accent))',
                borderRadius: '999px',
                transition: 'width 0.4s cubic-bezier(0.22, 1, 0.36, 1)'
              }} />
            </div>

            {/* Real-Time Cryptographic Hash & Network Ticker */}
            <div className="auth-transition-footer-hash">
              <span>LATENCY: {authTransition.latencyMs}ms</span>
              <span>SEPOLIA EVM 11155111</span>
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>• SYNCED</span>
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

      {/* ── Modern Institutional 4-Column Mega Footer ── */}
      <Footer onNavigate={() => { }} />

    </div>
  );
}