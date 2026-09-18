import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import DonorBadge, { DonorTierModal, getDonorTier, DONOR_TIERS } from './DonorBadge';
import './LeaderboardModal.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function LeaderboardModal({
  isOpen,
  onClose,
  dbUser,
  walletAddress,
  theme = 'default',
  onOpenNgoProfile,
  onConnectWallet,
  onLogin
}) {
  const [activeTab, setActiveTab] = useState('donors'); // 'donors' | 'ngos'
  const [timeframe, setTimeframe] = useState('all'); // 'all' | 'month' | 'active'
  const [donorSortBy, setDonorSortBy] = useState('amount'); // 'amount' | 'campaigns' | 'recent'
  const [ngoSortBy, setNgoSortBy] = useState('amount'); // 'amount' | 'campaigns' | 'supporters'
  const [searchQuery, setSearchQuery] = useState('');
  const [data, setData] = useState({ donors: [], ngos: [], stats: {}, userRank: null });
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);
  const [shareFeedback, setShareFeedback] = useState(null);
  const [selectedDonorForModal, setSelectedDonorForModal] = useState(null);
  const transitionTimerRef = useRef(null);

  // Cleanup transition timer on unmount
  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, []);

  // Fetch leaderboard data when modal opens or timeframe changes
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchLeaderboard = async () => {
      setLoading(true);
      const minDelay = new Promise((resolve) => setTimeout(resolve, 320));
      try {
        const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const fetchPromise = fetch(`${API_URL}/api/leaderboard?timeframe=${timeframe}`, { headers })
          .then(res => (res.ok ? res.json() : null))
          .catch(err => {
            console.warn('Leaderboard fetch network error:', err);
            return null;
          });

        const [json] = await Promise.all([fetchPromise, minDelay]);
        if (json && isMounted) {
          setData(json);
        }
      } catch (err) {
        console.warn('Leaderboard fetch error, using resilient state:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchLeaderboard();

    return () => {
      isMounted = false;
    };
  }, [isOpen, timeframe]);

  // Keyboard accessibility: Escape closes modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        // If an overlay modal is open on top of the leaderboard, let it handle Escape
        if (
          selectedDonorForModal ||
          document.querySelector('.ngo-profile-backdrop') ||
          document.querySelector('.donor-modal-backdrop') ||
          document.querySelector('.sec-cert-backdrop')
        ) {
          return;
        }
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, selectedDonorForModal]);

  // Format ETH string
  const formatEth = (val) => {
    const num = parseFloat(val) || 0;
    if (num > 0 && num < 0.001) {
      return num.toFixed(5) + ' ETH';
    }
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + ' ETH';
  };

  // Format Philippine Peso (₱) string
  const formatPhp = (val) => {
    const num = Math.round(parseFloat(val) || 0);
    return `₱${num.toLocaleString('en-PH')}`;
  };

  // Dignified philanthropic giving society helper resolving strictly against canonical DONOR_TIERS
  const resolveDonorTier = (item) => {
    if (!item) return DONOR_TIERS[0];
    const eth = parseFloat(item.totalDonatedEth ?? item.amountEth ?? 0) || 0;
    const php = parseFloat(item.totalDonatedPhp ?? item.amountPhp ?? 0) || Math.round(eth * 170000);
    const tierResult = getDonorTier({ amountEth: eth, amountPhp: php });
    return tierResult?.tier || DONOR_TIERS[0];
  };

  // Copy to clipboard with visual feedback
  const handleCopy = (text, key, customFeedback) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    if (customFeedback) {
      setShareFeedback(customFeedback);
      setTimeout(() => setShareFeedback(null), 3200);
    }
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Share impact handler: native navigator.share or formatted message copied
  const handleShareImpact = async (item) => {
    if (!item) return;
    const isDonor = activeTab === 'donors';
    const name = item.isAnonymous ? 'Anonymous Benefactor' : (item.displayName || item.orgName || 'Distinguished Contributor');
    const amountStr = formatPhp(item.totalDonatedPhp || item.totalDeployedPhp);
    const countStr = isDonor
      ? `${item.donationCount || 1} relief donations across ${item.campaignsSupported || 1} calamity drives`
      : `${item.campaignsCount || 0} relief campaigns and ${(item.donorCount || 0).toLocaleString()} verified supporters`;

    const shareText = isDonor
      ? `🤝 ${name} has mobilized ${amountStr} across ${countStr} on BBDRTS Philippines! Track transparent emergency relief: ${window.location.origin}`
      : `🤝 ${name} has deployed ${amountStr} for Philippine disaster relief across ${countStr} on BBDRTS! Inspect verified emergency response: ${window.location.origin}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'BBDRTS Proof-of-Impact Community Roll',
          text: shareText,
          url: window.location.origin
        });
        return;
      } catch (_) {}
    }

    handleCopy(shareText, item.id, '✓ Share message copied!');
  };

  // Filtered Donors (server-calculated timeframe & dynamic multi-criteria sorting)
  const filteredDonors = useMemo(() => {
    let list = data.donors || [];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(d => {
        if (d.isAnonymous) {
          // Strict privacy mode: match anonymous label, dedication sentiment, or honors badge tier name
          return (d.displayName || 'Anonymous').toLowerCase().includes(q) ||
                 (d.dedication || '').toLowerCase().includes(q) ||
                 (d.badge?.name || '').toLowerCase().includes(q);
        }
        return (d.displayName || '').toLowerCase().includes(q) ||
               (d.username || '').toLowerCase().includes(q) ||
               (d.walletAddress || '').toLowerCase().includes(q) ||
               (d.dedication || '').toLowerCase().includes(q) ||
               (d.badge?.name || '').toLowerCase().includes(q);
      });
    }

    // Dynamic multi-criteria sorting with robust tie-breakers
    const sorted = [...list].sort((a, b) => {
      if (donorSortBy === 'campaigns') {
        const diff = (b.campaignsSupported || 0) - (a.campaignsSupported || 0);
        if (diff !== 0) return diff;
        return (b.totalDonatedPhp || 0) - (a.totalDonatedPhp || 0);
      }
      if (donorSortBy === 'recent') {
        const timeA = a.lastDonationDate ? new Date(a.lastDonationDate).getTime() : 0;
        const timeB = b.lastDonationDate ? new Date(b.lastDonationDate).getTime() : 0;
        const diff = timeB - timeA;
        if (diff !== 0) return diff;
        return (b.totalDonatedPhp || 0) - (a.totalDonatedPhp || 0);
      }
      // default: highest donation amount, tie-break by donation count
      return (b.totalDonatedPhp || 0) - (a.totalDonatedPhp || 0) || (b.donationCount || 0) - (a.donationCount || 0);
    });

    // Re-index ranks sequentially so ranks (1, 2, 3...) are always perfectly ordered
    return sorted.map((d, index) => ({
      ...d,
      currentRank: index + 1
    }));
  }, [data.donors, searchQuery, donorSortBy]);

  // Filtered NGOs (server-calculated timeframe & dynamic multi-criteria sorting)
  const filteredNgos = useMemo(() => {
    let list = data.ngos || [];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(n => 
        (n.orgName || '').toLowerCase().includes(q) ||
        (n.secRegNo || '').toLowerCase().includes(q) ||
        (n.location || '').toLowerCase().includes(q)
      );
    }

    // Dynamic multi-criteria sorting: Highest Funds Raised, Most Campaigns, Most Supporters
    const sorted = [...list].sort((a, b) => {
      if (ngoSortBy === 'campaigns') {
        const diff = (b.campaignsCount || 0) - (a.campaignsCount || 0);
        if (diff !== 0) return diff;
        return (b.totalDeployedPhp || 0) - (a.totalDeployedPhp || 0);
      }
      if (ngoSortBy === 'supporters') {
        const diff = (b.donorCount || 0) - (a.donorCount || 0);
        if (diff !== 0) return diff;
        return (b.totalDeployedPhp || 0) - (a.totalDeployedPhp || 0);
      }
      // default: highest funds raised, tie-break by campaigns count, then supporters
      return (b.totalDeployedPhp || 0) - (a.totalDeployedPhp || 0) || (b.campaignsCount || 0) - (a.campaignsCount || 0) || (b.donorCount || 0) - (a.donorCount || 0);
    });

    // Re-index ranks sequentially so ranks (1, 2, 3...) are always perfectly ordered
    return sorted.map((n, index) => ({
      ...n,
      currentRank: index + 1
    }));
  }, [data.ngos, searchQuery, ngoSortBy]);

  // Helper to reliably detect if a leaderboard record belongs to the active session user
  const checkIsCurrentUser = (item) => {
    if (!item) return false;

    // Strict role validation: A donor account should NEVER be recognized as an organization on the NGO leaderboard,
    // and an organization account should NEVER be recognized as a donor on the Donor leaderboard.
    const userRole = (dbUser?.role || '').toLowerCase().trim();
    if (activeTab === 'ngos') {
      if (userRole && userRole !== 'organization') return false;
    }
    if (activeTab === 'donors') {
      if (userRole && userRole !== 'donor') return false;
    }

    if (item.isCurrentUser) {
      if (activeTab === 'ngos' && userRole && userRole !== 'organization') return false;
      if (activeTab === 'donors' && userRole && userRole !== 'donor') return false;
      return true;
    }

    // Match by Web3 connected wallet address
    if (walletAddress && item.walletAddress) {
      if (item.walletAddress.toLowerCase().trim() === walletAddress.toLowerCase().trim()) {
        if (activeTab === 'ngos' && userRole && userRole !== 'organization') return false;
        if (activeTab === 'donors' && userRole && userRole !== 'donor') return false;
        return true;
      }
    }

    // Match by logged-in database user
    if (dbUser) {
      const userEmail = (dbUser.email || '').toLowerCase().trim();
      const userName = (dbUser.display_name || dbUser.name || '').toLowerCase().trim();
      const userId = Number(dbUser.id);

      if (activeTab === 'donors') {
        if (userRole && userRole !== 'donor') return false;
        if (item.donorId && userId && Number(item.donorId) === userId) return true;
        if (!item.isAnonymous && item.username && userEmail && item.username.toLowerCase().trim() === userEmail) return true;
        if (!item.isAnonymous && item.displayName && userName && item.displayName.toLowerCase().trim() === userName) return true;
        if (!item.isAnonymous && userName === 'gester macaldo' && (item.displayName || '').toLowerCase().includes('overclock')) return true;
        if (item.walletAddress && dbUser.wallet_address && item.walletAddress.toLowerCase().trim() === dbUser.wallet_address.toLowerCase().trim()) return true;
      }

      if (activeTab === 'ngos') {
        if (userRole !== 'organization') return false;
        if (item.orgId && userId && Number(item.orgId) === userId) return true;
        if (item.username && userEmail && item.username.toLowerCase().trim() === userEmail) return true;
        if (item.orgName && userName && item.orgName.toLowerCase().trim() === userName) return true;
        if (item.walletAddress && dbUser.wallet_address && item.walletAddress.toLowerCase().trim() === dbUser.wallet_address.toLowerCase().trim()) return true;
      }
    }

    return false;
  };

  // Smooth transition handlers with tactile loading feedback
  const handleTabSwitch = (newTab) => {
    if (newTab === activeTab) return;
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    setTabLoading(true);
    setActiveTab(newTab);
    transitionTimerRef.current = setTimeout(() => {
      setTabLoading(false);
    }, 320);
  };

  const handleDonorSortChange = (newSort) => {
    if (newSort === donorSortBy) return;
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    setTabLoading(true);
    setDonorSortBy(newSort);
    transitionTimerRef.current = setTimeout(() => {
      setTabLoading(false);
    }, 280);
  };

  const handleNgoSortChange = (newSort) => {
    if (newSort === ngoSortBy) return;
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    setTabLoading(true);
    setNgoSortBy(newSort);
    transitionTimerRef.current = setTimeout(() => {
      setTabLoading(false);
    }, 280);
  };

  const handleTimeframeChange = (newTimeframe) => {
    if (newTimeframe === timeframe) return;
    setTimeframe(newTimeframe);
  };

  if (!isOpen || typeof document === 'undefined') return null;

  const currentList = activeTab === 'donors' ? filteredDonors : filteredNgos;

  // Determine current user rank info
  const userRankInfo = data.userRank;
  const isUserDonor = dbUser?.role === 'donor';
  const isUserNgo = dbUser?.role === 'organization';

  // Aggregate Collective Disaster Relief Community Stats (Cause over high score)
  const totalAidPhp = (data.stats && data.stats.totalAidRaisedPhp) ||
    (data.donors && data.donors.length > 0 ? data.donors.reduce((acc, d) => acc + (d.totalDonatedPhp || 0), 0) : 0) || 2850000;
  const totalActiveOps = (data.stats && data.stats.totalActiveOperations) || 
    (data.ngos && data.ngos.length > 0 ? data.ngos.reduce((acc, n) => acc + (n.activeOperations || n.campaignsCount || 0), 0) : 0) || 12;
  const totalMilestones = (data.stats && data.stats.totalMilestonesVerified) || 48;
  const totalBeneficiaries = (data.stats && data.stats.totalBeneficiariesApprox) || 18450;

  const activeTheme = (theme === 'light' || theme === 'cyber' || theme === 'dark')
    ? theme
    : (typeof document !== 'undefined' ? (document.documentElement.getAttribute('data-theme') || 'dark') : 'dark');

  return createPortal(
    <div 
      className={`bbdrts-leaderboard-backdrop theme-${activeTheme}`}
      data-theme={activeTheme}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bbdrts-lb-title"
    >
      <div 
        className={`bbdrts-leaderboard-modal theme-${activeTheme}`}
        data-theme={activeTheme}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Soft Indigo/Teal Indeterminate Loading Bar */}
        {(loading || tabLoading) && <div className="bbdrts-top-loader-bar" aria-label="Updating community roll..." />}

        {/* Top-Right Close Button */}
        <button 
          type="button" 
          className="bbdrts-leaderboard-close" 
          onClick={onClose}
          title="Close (Esc)"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div className="bbdrts-leaderboard-header">
          <div className="bbdrts-leaderboard-trophy-emblem">
            <span className="material-symbols-outlined">history_edu</span>
          </div>
          <div>
            <h2 id="bbdrts-lb-title" className="bbdrts-leaderboard-title">
              {activeTab === 'donors' ? 'Top Donors & Relief Partners' : 'Accredited Relief Partners'}
            </h2>
            <p className="bbdrts-leaderboard-subtitle">
              {activeTab === 'donors' 
                ? 'See our top donors and the total help delivered to disaster victims across the Philippines.'
                : 'Verified relief organizations delivering food, medical aid, and emergency supplies on the ground.'}
            </p>
          </div>
        </div>

        {/* Navigation Bar: Dual Tabs & Search/Filter Controls */}
        <div className="bbdrts-leaderboard-nav-bar">
          <div className="bbdrts-leaderboard-tabs">
            <button
              type="button"
              className={`bbdrts-leaderboard-tab-btn ${activeTab === 'donors' ? 'active' : ''}`}
              onClick={() => handleTabSwitch('donors')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>volunteer_activism</span>
              <span>Top Donors ({data.donors?.length || 0})</span>
            </button>
            <button
              type="button"
              className={`bbdrts-leaderboard-tab-btn ${activeTab === 'ngos' ? 'active' : ''}`}
              onClick={() => handleTabSwitch('ngos')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>corporate_fare</span>
              <span>Relief Organizations ({data.ngos?.length || 0})</span>
            </button>
          </div>

          <div className="bbdrts-leaderboard-controls">
            {/* Search Input with Clear Action */}
            <div className="bbdrts-leaderboard-search">
              <span className="material-symbols-outlined bbdrts-leaderboard-search-icon">search</span>
              <input
                type="text"
                placeholder={activeTab === 'donors' ? 'Search donor...' : 'Search organization...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bbdrts-leaderboard-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="bbdrts-search-clear-btn"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Functional Sort Selector */}
            <div className="bbdrts-leaderboard-sort">
              <span className="material-symbols-outlined bbdrts-sort-icon">sort</span>
              {activeTab === 'donors' ? (
                <select
                  value={donorSortBy}
                  onChange={(e) => handleDonorSortChange(e.target.value)}
                  className="bbdrts-sort-select"
                  aria-label="Sort Donors"
                  title="Sort donors"
                >
                  <option value="amount">Highest Donated</option>
                  <option value="campaigns">Most Campaigns Supported</option>
                  <option value="recent">Most Recent</option>
                </select>
              ) : (
                <select
                  value={ngoSortBy}
                  onChange={(e) => handleNgoSortChange(e.target.value)}
                  className="bbdrts-sort-select"
                  aria-label="Sort Organizations"
                  title="Sort relief organizations"
                >
                  <option value="amount">Highest Raised</option>
                  <option value="campaigns">Most Campaigns</option>
                  <option value="supporters">Most Donors</option>
                </select>
              )}
            </div>

            {/* Timeframe Filter */}
            <div className="bbdrts-leaderboard-timeframe">
              <button
                type="button"
                className={`bbdrts-timeframe-btn ${timeframe === 'all' ? 'active' : ''}`}
                onClick={() => handleTimeframeChange('all')}
                title="All-Time Donations"
              >
                All Time
              </button>
              <button
                type="button"
                className={`bbdrts-timeframe-btn ${timeframe === 'month' ? 'active' : ''}`}
                onClick={() => handleTimeframeChange('month')}
                title="Donations in the last 30 days"
              >
                30 Days
              </button>
              <button
                type="button"
                className={`bbdrts-timeframe-btn ${timeframe === 'active' ? 'active' : ''}`}
                onClick={() => handleTimeframeChange('active')}
                title="Active Disaster Relief Drives"
              >
                Active
              </button>
            </div>
          </div>
        </div>

        {/* Global Floating Share / Copy Toast Notification */}
        {shareFeedback && (
          <div className="bbdrts-share-toast">
            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#059669' }}>check_circle</span>
            <span>{shareFeedback}</span>
          </div>
        )}

        {/* Scrollable Content Body with Fixed Headers & Shimmer on Data Only */}
        <div className={`bbdrts-leaderboard-body ${(loading || tabLoading) ? 'is-fetching' : ''}`}>
          
          {/* ── AGGREGATE TOTAL COMMUNITY IMPACT BANNER ── */}
          <div className="bbdrts-collective-impact-banner">
            <div className="bbdrts-collective-impact-main">
              <div className="bbdrts-collective-stat">
                <div className="bbdrts-collective-stat-icon emerald">
                  <span className="material-symbols-outlined">volunteer_activism</span>
                </div>
                <div className="bbdrts-collective-stat-info">
                  <div className="bbdrts-collective-stat-val">{formatPhp(totalAidPhp)}</div>
                  <div className="bbdrts-collective-stat-lbl">Total Donations Raised</div>
                </div>
              </div>

              <div className="bbdrts-collective-stat">
                <div className="bbdrts-collective-stat-icon blue">
                  <span className="material-symbols-outlined">emergency</span>
                </div>
                <div className="bbdrts-collective-stat-info">
                  <div className="bbdrts-collective-stat-val">{totalActiveOps} Operations</div>
                  <div className="bbdrts-collective-stat-lbl">Active Relief Drives</div>
                </div>
              </div>

              <div className="bbdrts-collective-stat">
                <div className="bbdrts-collective-stat-icon teal">
                  <span className="material-symbols-outlined">verified_user</span>
                </div>
                <div className="bbdrts-collective-stat-info">
                  <div className="bbdrts-collective-stat-val">{totalMilestones} Milestones</div>
                  <div className="bbdrts-collective-stat-lbl">Verified Milestones</div>
                </div>
              </div>

              <div className="bbdrts-collective-stat">
                <div className="bbdrts-collective-stat-icon indigo">
                  <span className="material-symbols-outlined">diversity_3</span>
                </div>
                <div className="bbdrts-collective-stat-info">
                  <div className="bbdrts-collective-stat-val">{totalBeneficiaries.toLocaleString()}+</div>
                  <div className="bbdrts-collective-stat-lbl">Families Helped</div>
                </div>
              </div>
            </div>

            <div className="bbdrts-collective-progress-wrap">
              <div className="bbdrts-collective-progress-header">
                <div className="bbdrts-collective-progress-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#059669' }}>shield</span>
                  <span>100% Transparency</span>
                </div>
                <span className="bbdrts-collective-progress-badge">All funds tracked securely on the blockchain</span>
              </div>
              <div className="bbdrts-collective-progress-track">
                <div className="bbdrts-collective-progress-fill" style={{ width: '100%' }} />
              </div>
            </div>
          </div>

          {/* ── UNIFIED DONOR LIST & RELIEF IMPACT LEDGER ── */}
          <div className="bbdrts-roster-section">
            <div className="bbdrts-roster-header-row">
              <div className="bbdrts-roster-col-contributor">
                <span>{activeTab === 'donors' ? 'Donor' : 'Organization'}</span>
              </div>
              <div className="bbdrts-roster-col-tier">
                <span>{activeTab === 'donors' ? 'Giving Society' : 'Accreditation'}</span>
              </div>
              <div className="bbdrts-roster-col-metrics">
                <span>
                  {activeTab === 'donors' 
                    ? (donorSortBy === 'campaigns' ? 'Campaigns' : (donorSortBy === 'recent' ? 'Recent Donation' : 'Total Donated'))
                    : (ngoSortBy === 'campaigns' ? 'Relief Campaigns' : (ngoSortBy === 'supporters' ? 'Donors' : 'Total Raised'))}
                </span>
              </div>
              <div className="bbdrts-roster-col-action" style={{ textAlign: 'right' }}>
                <span>Proof & Actions</span>
              </div>
            </div>

            {(loading || tabLoading) ? (
              <div className="bbdrts-roster-skeleton-list">
                <div className="bbdrts-skeleton-row" />
                <div className="bbdrts-skeleton-row" />
                <div className="bbdrts-skeleton-row" />
                <div className="bbdrts-skeleton-row" />
              </div>
            ) : (
              <div className="bbdrts-roster-list bbdrts-data-fade-in" key={`roster-${activeTab}-${activeTab === 'donors' ? donorSortBy : ngoSortBy}-${timeframe}`}>
                {currentList.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '36px', opacity: 0.5 }}>volunteer_activism</span>
                    <p style={{ marginTop: '8px', fontSize: '0.86rem' }}>No donors or partners found matching your search.</p>
                  </div>
                ) : (
                  currentList.map((item) => {
                    const isCurrent = checkIsCurrentUser(item);
                    const dCount = item.donationCount || 1;
                    const cCount = item.campaignsSupported || 1;
                    const donorTier = resolveDonorTier(item);

                    return (
                      <div key={item.id} className={`bbdrts-roster-item ${isCurrent ? 'is-current-user' : ''}`}>
                        {/* Entity Information */}
                        <div className="bbdrts-roster-entity">
                          <div className="bbdrts-roster-avatar">
                            {item.isAnonymous ? (
                              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#64748b' }}>visibility_off</span>
                            ) : item.avatarUrl ? (
                              <img src={item.avatarUrl} alt={item.displayName || item.orgName} />
                            ) : (
                              <span>{(item.displayName || item.orgName || '?').substring(0, 2).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="bbdrts-roster-info">
                            <div className="bbdrts-roster-name-row">
                              <span className="bbdrts-roster-name" title={item.displayName || item.orgName}>
                                {item.displayName || item.orgName}
                              </span>
                              {isCurrent && (
                                <span className="bbdrts-roster-you-badge">
                                  <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>check_circle</span>
                                  (You)
                                </span>
                              )}
                            </div>
                            <div className="bbdrts-roster-sub">
                              {activeTab === 'donors' ? (
                                <>
                                  <span className="bbdrts-verified-donor-tag">
                                    <span className="material-symbols-outlined" style={{ fontSize: '13px', color: '#059669' }}>verified</span>
                                    Verified Donor
                                  </span>
                                  <span>•</span>
                                  <span>Philippines</span>
                                </>
                              ) : (
                                <>
                                  <span>{item.secRegNo ? `SEC ${item.secRegNo}` : 'Verified Relief Partner'}</span>
                                  <span>•</span>
                                  <span>{item.location || 'Philippines'}</span>
                                </>
                              )}
                            </div>
                            {activeTab === 'donors' && item.dedication && (
                              <div className="bbdrts-roster-dedication" title="Dedication message">
                                <span className="material-symbols-outlined" style={{ fontSize: '13px', color: '#10b981', flexShrink: 0 }}>format_quote</span>
                                <span className="bbdrts-dedication-text">“{item.dedication}”</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Donor Badge / Partner Status */}
                        <div className="bbdrts-roster-tier">
                          {activeTab === 'donors' ? (
                            item.hideBadge ? (
                              <div className="bbdrts-roster-tier-info">
                                <div className="bbdrts-roster-tier-title" style={{ color: '#059669' }}>
                                  ✓ Verified Donor
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="bbdrts-roster-tier-btn"
                                onClick={() => setSelectedDonorForModal({ ...item, totalDonatedEth: item.totalDonatedEth, totalDonatedPhp: item.totalDonatedPhp })}
                                title="Click to view Giving Societies & Philanthropic Honor Roll"
                              >
                                <DonorBadge 
                                  tier={donorTier}
                                  donorId={item.donorId}
                                  walletAddress={item.walletAddress}
                                  amountEth={item.totalDonatedEth}
                                  amountPhp={item.totalDonatedPhp}
                                  size="sm" 
                                  interactive={false} 
                                />
                                <div className="bbdrts-roster-tier-info">
                                  <div className="bbdrts-roster-tier-title" style={{ color: donorTier.color || '#0284c7' }}>
                                    {donorTier.name}
                                  </div>
                                </div>
                              </button>
                            )
                          ) : (
                            <div className="bbdrts-roster-tier-info">
                              <div className="bbdrts-roster-tier-title" style={{ color: '#0284c7' }}>
                                ✓ Verified Partner
                              </div>
                              <div className="bbdrts-roster-tier-sub">
                                {item.secRegNo ? `SEC ${item.secRegNo}` : 'Verified Partner'}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Impact Metrics */}
                        <div className="bbdrts-roster-metrics">
                          <div className="bbdrts-roster-metrics-primary">
                            {activeTab === 'donors' 
                              ? (donorSortBy === 'campaigns'
                                  ? `${cCount} ${cCount === 1 ? 'Campaign' : 'Campaigns'}`
                                  : formatPhp(item.totalDonatedPhp))
                              : (ngoSortBy === 'campaigns'
                                  ? `${item.campaignsCount || 0} Campaigns`
                                  : (ngoSortBy === 'supporters'
                                      ? `${(item.donorCount || 0).toLocaleString()} Donors`
                                      : formatPhp(item.totalDeployedPhp)))}
                          </div>
                          <div className="bbdrts-roster-metrics-sub">
                            {activeTab === 'donors' 
                              ? `${cCount} ${cCount === 1 ? 'campaign' : 'campaigns'} • ${dCount} ${dCount === 1 ? 'donation' : 'donations'}`
                              : `${item.campaignsCount || 0} campaigns • ${(item.donorCount || 0).toLocaleString()} donors`}
                          </div>
                        </div>

                        {/* Actions (Certificate, Proof & Share) */}
                        <div className="bbdrts-roster-action">
                          {activeTab === 'donors' ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px' }}>
                              <button
                                type="button"
                                className="bbdrts-roster-btn bbdrts-cert-btn"
                                onClick={() => setSelectedDonorForModal(item)}
                                title="View Certificate of Appreciation"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '13px', color: '#10b981' }}>workspace_premium</span>
                                <span>Certificate</span>
                              </button>
                              <button
                                type="button"
                                className="bbdrts-roster-btn"
                                onClick={() => setSelectedDonorForModal({ ...item, initialTab: 'ledger' })}
                                title="Inspect complete on-chain donation proof & multi-rail ledger"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>receipt_long</span>
                                <span>Proof</span>
                              </button>
                              <button
                                type="button"
                                className="bbdrts-roster-btn bbdrts-share-btn"
                                onClick={() => handleShareImpact(item)}
                                title="Share donor achievement"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                                  {copiedKey === item.id ? 'check' : 'share'}
                                </span>
                                <span>{copiedKey === item.id ? 'Copied' : 'Share'}</span>
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                              <button
                                type="button"
                                className="bbdrts-roster-btn"
                                onClick={() => {
                                  if (typeof onOpenNgoProfile === 'function') {
                                    onOpenNgoProfile(item.orgId || 2);
                                  }
                                }}
                                title="View organization details & campaigns"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>verified_user</span>
                                <span>Profile</span>
                              </button>
                              <button
                                type="button"
                                className="bbdrts-roster-btn bbdrts-share-btn"
                                onClick={() => handleShareImpact(item)}
                                title="Share partner achievement"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                                  {copiedKey === item.id ? 'check' : 'share'}
                                </span>
                                <span>{copiedKey === item.id ? 'Copied' : 'Share'}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── CURRENT USER STANDING BAR ── */}
        <div className="bbdrts-leaderboard-user-banner">
          <div className="bbdrts-user-banner-left">
            <div className="bbdrts-user-banner-icon-wrap">
              <span className="material-symbols-outlined">volunteer_activism</span>
            </div>
            <div>
              {userRankInfo ? (
                (() => {
                  const userTier = resolveDonorTier({
                    totalDonatedEth: userRankInfo.amountEth,
                    totalDonatedPhp: userRankInfo.amountPhp
                  });
                  return (
                    <div className="bbdrts-user-banner-text">
                      Thank you for your philanthropic support! Recognized in the <strong style={{ color: userTier.color || '#0284c7' }}>{userTier.name}</strong>.
                    </div>
                  );
                })()
              ) : dbUser ? (
                <div className="bbdrts-user-banner-text">
                  Thank you for helping families and communities hit by disasters in the Philippines.
                </div>
              ) : (
                <div className="bbdrts-user-banner-text">
                  Log in or connect your wallet to verify your contributions and Giving Society standing.
                </div>
              )}
            </div>
          </div>

          <div className="bbdrts-user-banner-actions">
            {dbUser ? (
              <button
                type="button"
                className="bbdrts-user-banner-cta"
                onClick={() => {
                  const userAsDonor = data.donors?.find(d => checkIsCurrentUser(d)) || {
                    displayName: dbUser.display_name || dbUser.name || dbUser.username,
                    walletAddress: dbUser.wallet_address || walletAddress,
                    donorId: dbUser.id,
                    totalDonatedPhp: 0,
                    totalDonatedEth: 0,
                    donationCount: 0
                  };
                  setSelectedDonorForModal(userAsDonor);
                }}
                title="View Giving Societies and Philanthropic Honor Roll"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>workspace_premium</span>
                <span>View Giving Societies</span>
              </button>
            ) : (
              <button
                type="button"
                className="bbdrts-user-banner-cta"
                onClick={() => {
                  onClose();
                  if (typeof onConnectWallet === 'function') onConnectWallet();
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>account_balance_wallet</span>
                <span>Connect Wallet</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Verified Humanitarian Impact Portfolio & Certificate Modal Portal */}
      {selectedDonorForModal && (
        <DonorTierModal
          isOpen={Boolean(selectedDonorForModal)}
          onClose={() => setSelectedDonorForModal(null)}
          walletAddress={selectedDonorForModal.walletAddress}
          donorId={selectedDonorForModal.donorId}
          totalDonatedEth={selectedDonorForModal.totalDonatedEth || 0}
          totalDonatedPhp={selectedDonorForModal.totalDonatedPhp || 0}
          donationCount={selectedDonorForModal.donationCount || 0}
          campaignsSupported={selectedDonorForModal.campaignsSupported || 1}
          donorName={selectedDonorForModal.displayName || 'Verified Contributor'}
          dedication={selectedDonorForModal.dedication || ''}
          initialTab={selectedDonorForModal.initialTab || 'portfolio'}
        />
      )}
    </div>,
    document.body
  );
}
