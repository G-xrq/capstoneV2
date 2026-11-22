import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { API_URL } from '../config';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import DonorBadge, { DonorTierModal, getDonorTier, DONOR_TIERS } from './DonorBadge';
import './LeaderboardModal.css';

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

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, []);

  // Lock page background scroll while modal is open (clean mobile touch scroll)
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // Fetch leaderboard data when modal opens or timeframe changes
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchLeaderboard = async () => {
      setLoading(true);
      const minDelay = new Promise((resolve) => setTimeout(resolve, 220));
      try {
        const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const fetchPromise = fetch(`${API_URL}/api/leaderboard?timeframe=${timeframe}&_t=${Date.now()}`, {
          headers,
          cache: 'no-store'
        })
          .then((res) => (res.ok ? res.json() : null))
          .catch((err) => {
            console.warn('Leaderboard fetch network error:', err);
            return null;
          });

        const [json] = await Promise.all([fetchPromise, minDelay]);
        if (json && isMounted) {
          setData(json);
        }
      } catch (err) {
        console.warn('Leaderboard fetch error:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchLeaderboard();
    return () => {
      isMounted = false;
    };
  }, [isOpen, timeframe]);

  // Real-time live sync while open
  useRealtimeSync(
    ['donations', 'manual_donations', 'organizations'],
    async () => {
      try {
        const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`${API_URL}/api/leaderboard?timeframe=${timeframe}&_t=${Date.now()}`, {
          headers,
          cache: 'no-store'
        });
        if (res.ok) {
          const json = await res.json();
          if (json) setData(json);
        }
      } catch (_) {}
    },
    { enabled: isOpen, debounceMs: 300 }
  );

  // Escape closes modal unless a nested overlay is open
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
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

  const formatPhp = (val) => {
    const num = Math.round(parseFloat(val) || 0);
    return `₱${num.toLocaleString('en-US')}`;
  };

  const resolveDonorTier = (item) => {
    if (!item) return DONOR_TIERS[0];
    const eth = parseFloat(item.totalDonatedEth ?? item.amountEth ?? 0) || 0;
    const php = parseFloat(item.totalDonatedPhp ?? item.amountPhp ?? 0) || Math.round(eth * 170000);
    const tierResult = getDonorTier({ amountEth: eth, amountPhp: php });
    return tierResult?.tier || DONOR_TIERS[0];
  };

  const handleCopy = (text, key, customFeedback) => {
    if (!text) return;
    try {
      navigator.clipboard.writeText(text);
    } catch (_) {}
    setCopiedKey(key);
    if (customFeedback) {
      setShareFeedback(customFeedback);
      setTimeout(() => setShareFeedback(null), 2800);
    }
    setTimeout(() => setCopiedKey(null), 2200);
  };

  const handleShareImpact = async (item) => {
    if (!item) return;
    const isDonor = activeTab === 'donors';
    const name = item.isAnonymous ? 'Anonymous Supporter' : (item.displayName || item.orgName || 'Verified Contributor');
    const amountStr = formatPhp(item.totalDonatedPhp || item.totalDeployedPhp);
    const countStr = isDonor
      ? `${item.donationCount || 1} relief donations across ${item.campaignsSupported || 1} drives`
      : `${item.campaignsCount || 0} relief drives and ${(item.donorCount || 0).toLocaleString()} verified supporters`;

    const shareText = isDonor
      ? `${name} has contributed ${amountStr} across ${countStr} on BBDRTS Philippines! Track verified relief: ${window.location.origin}`
      : `${name} has mobilized ${amountStr} for Philippine disaster relief across ${countStr} on BBDRTS! Inspect operations: ${window.location.origin}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'BBDRTS Top Donors & Relief Partners',
          text: shareText,
          url: window.location.origin
        });
        return;
      } catch (_) {}
    }

    handleCopy(shareText, item.id, 'Share message copied to clipboard');
  };

  const filteredDonors = useMemo(() => {
    let list = data.donors || [];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((d) => {
        if (d.isAnonymous) {
          return (
            (d.displayName || 'Anonymous').toLowerCase().includes(q) ||
            (d.dedication || '').toLowerCase().includes(q) ||
            (d.badge?.name || '').toLowerCase().includes(q)
          );
        }
        return (
          (d.displayName || '').toLowerCase().includes(q) ||
          (d.username || '').toLowerCase().includes(q) ||
          (d.walletAddress || '').toLowerCase().includes(q) ||
          (d.dedication || '').toLowerCase().includes(q) ||
          (d.badge?.name || '').toLowerCase().includes(q)
        );
      });
    }

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
      return (b.totalDonatedPhp || 0) - (a.totalDonatedPhp || 0) || (b.donationCount || 0) - (a.donationCount || 0);
    });

    return sorted.map((d, index) => ({ ...d, currentRank: index + 1 }));
  }, [data.donors, searchQuery, donorSortBy]);

  const filteredNgos = useMemo(() => {
    let list = data.ngos || [];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (n) =>
          (n.orgName || '').toLowerCase().includes(q) ||
          (n.secRegNo || '').toLowerCase().includes(q) ||
          (n.location || '').toLowerCase().includes(q)
      );
    }

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
      return (
        (b.totalDeployedPhp || 0) - (a.totalDeployedPhp || 0) ||
        (b.campaignsCount || 0) - (a.campaignsCount || 0) ||
        (b.donorCount || 0) - (a.donorCount || 0)
      );
    });

    return sorted.map((n, index) => ({ ...n, currentRank: index + 1 }));
  }, [data.ngos, searchQuery, ngoSortBy]);

  const checkIsCurrentUser = (item) => {
    if (!item) return false;
    const userRole = (dbUser?.role || '').toLowerCase().trim();
    if (activeTab === 'ngos' && userRole && userRole !== 'organization') return false;
    if (activeTab === 'donors' && userRole && userRole !== 'donor') return false;
    if (item.isCurrentUser) return true;

    if (walletAddress && item.walletAddress) {
      if (item.walletAddress.toLowerCase().trim() === walletAddress.toLowerCase().trim()) return true;
    }

    if (dbUser) {
      const userEmail = (dbUser.email || '').toLowerCase().trim();
      const userName = (dbUser.display_name || dbUser.name || '').toLowerCase().trim();
      const userId = Number(dbUser.id);

      if (activeTab === 'donors') {
        if (item.donorId && userId && Number(item.donorId) === userId) return true;
        if (!item.isAnonymous && item.username && userEmail && item.username.toLowerCase().trim() === userEmail) return true;
        if (!item.isAnonymous && item.displayName && userName && item.displayName.toLowerCase().trim() === userName) return true;
        if (!item.isAnonymous && userName === 'gester macaldo' && (item.displayName || '').toLowerCase().includes('overclock')) return true;
        if (item.walletAddress && dbUser.wallet_address && item.walletAddress.toLowerCase().trim() === dbUser.wallet_address.toLowerCase().trim()) return true;
      }

      if (activeTab === 'ngos') {
        if (item.orgId && userId && Number(item.orgId) === userId) return true;
        if (item.username && userEmail && item.username.toLowerCase().trim() === userEmail) return true;
        if (item.orgName && userName && item.orgName.toLowerCase().trim() === userName) return true;
        if (item.walletAddress && dbUser.wallet_address && item.walletAddress.toLowerCase().trim() === dbUser.wallet_address.toLowerCase().trim()) return true;
      }
    }

    return false;
  };

  const handleTabSwitch = (newTab) => {
    if (newTab === activeTab) return;
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    setTabLoading(true);
    setActiveTab(newTab);
    transitionTimerRef.current = setTimeout(() => setTabLoading(false), 180);
  };

  const handleDonorSortChange = (newSort) => {
    if (newSort === donorSortBy) return;
    setDonorSortBy(newSort);
  };

  const handleNgoSortChange = (newSort) => {
    if (newSort === ngoSortBy) return;
    setNgoSortBy(newSort);
  };

  if (!isOpen || typeof document === 'undefined') return null;

  const currentList = activeTab === 'donors' ? filteredDonors : filteredNgos;
  const userRankInfo = data.userRank;

  const totalAidPhp =
    (data.stats && data.stats.totalAidRaisedPhp) ||
    (data.donors && data.donors.length > 0 ? data.donors.reduce((acc, d) => acc + (d.totalDonatedPhp || 0), 0) : 0) ||
    0;
  const totalActiveOps =
    (data.stats && data.stats.totalActiveOperations) ||
    (data.ngos && data.ngos.length > 0 ? data.ngos.reduce((acc, n) => acc + (n.activeOperations || n.campaignsCount || 0), 0) : 0) ||
    0;
  const totalMilestones = (data.stats && data.stats.totalMilestonesVerified) || 0;
  const totalBeneficiaries = (data.stats && data.stats.totalBeneficiariesApprox) || 0;

  const resolvedTheme =
    theme && theme !== 'default'
      ? theme
      : document.documentElement.getAttribute('data-theme') || 'dark';

  return createPortal(
    <div
      className="lbv-backdrop"
      data-theme={resolvedTheme}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lbv-title"
    >
      <div className="lbv-modal" onClick={(e) => e.stopPropagation()}>
        {/* Top Indeterminate Shimmer Bar */}
        {(loading || tabLoading) && (
          <div className="lbv-loader-track" aria-label="Updating community roll">
            <div className="lbv-loader-bar" />
          </div>
        )}

        {/* ── FLUSH RECESSED HEADER ── */}
        <div className="lbv-header">
          <div className="lbv-header-left">
            <div className="lbv-icon-box">
              <span className="material-symbols-outlined">history_edu</span>
            </div>
            <div className="lbv-title-group">
              <div className="lbv-title-row">
                <h2 id="lbv-title" className="lbv-title">
                  {activeTab === 'donors' ? 'Top Donors & Relief Partners' : 'Accredited Relief Partners'}
                </h2>
                <span className="lbv-verified-chip">
                  <span className="lbv-live-dot" />
                  <span>SEPOLIA AUDITED</span>
                </span>
              </div>
              <p className="lbv-subtitle">
                {activeTab === 'donors'
                  ? 'Recognized contributors and verified disaster relief impact across the Philippines.'
                  : 'SEC-verified non-profit organizations executing audited emergency relief operations.'}
              </p>
            </div>
          </div>

          <button type="button" className="lbv-close-btn" onClick={onClose} title="Close (Esc)" aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* ── COMPACT 4-COLUMN HAIRLINE TELEMETRY STRIP ── */}
        <div className="lbv-stats-strip">
          <div className="lbv-stat-cell">
            <span className="lbv-stat-val">{formatPhp(totalAidPhp)}</span>
            <span className="lbv-stat-lbl">Total Donations Raised</span>
          </div>
          <div className="lbv-stat-cell">
            <span className="lbv-stat-val">{totalActiveOps}</span>
            <span className="lbv-stat-lbl">Active Relief Drives</span>
          </div>
          <div className="lbv-stat-cell">
            <span className="lbv-stat-val">{totalMilestones}</span>
            <span className="lbv-stat-lbl">Verified Milestones</span>
          </div>
          <div className="lbv-stat-cell">
            <span className="lbv-stat-val">{totalBeneficiaries.toLocaleString()}+</span>
            <span className="lbv-stat-lbl">Families Helped</span>
          </div>
        </div>

        {/* ── FLUSH UNDERLINE TABS + COMMAND TOOLBAR ── */}
        <div className="lbv-toolbar">
          <div className="lbv-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'donors'}
              className={`lbv-tab${activeTab === 'donors' ? ' is-active' : ''}`}
              onClick={() => handleTabSwitch('donors')}
            >
              <span>Top Donors</span>
              <span className="lbv-tab-count">{data.donors?.length || 0}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'ngos'}
              className={`lbv-tab${activeTab === 'ngos' ? ' is-active' : ''}`}
              onClick={() => handleTabSwitch('ngos')}
            >
              <span>Relief Organizations</span>
              <span className="lbv-tab-count">{data.ngos?.length || 0}</span>
            </button>
          </div>

          <div className="lbv-controls">
            <div className="lbv-search-wrap">
              <span className="material-symbols-outlined lbv-search-ico">search</span>
              <input
                type="text"
                className="lbv-search-input"
                placeholder={activeTab === 'donors' ? 'Search donor or circle…' : 'Search organization…'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="lbv-search-clear"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              )}
            </div>

            <div className="lbv-select-wrap">
              <span className="material-symbols-outlined lbv-select-ico">sort</span>
              {activeTab === 'donors' ? (
                <select
                  value={donorSortBy}
                  onChange={(e) => handleDonorSortChange(e.target.value)}
                  className="lbv-select"
                  aria-label="Sort donors"
                >
                  <option value="amount">Highest Donated</option>
                  <option value="campaigns">Most Campaigns</option>
                  <option value="recent">Most Recent</option>
                </select>
              ) : (
                <select
                  value={ngoSortBy}
                  onChange={(e) => handleNgoSortChange(e.target.value)}
                  className="lbv-select"
                  aria-label="Sort organizations"
                >
                  <option value="amount">Highest Raised</option>
                  <option value="campaigns">Most Campaigns</option>
                  <option value="supporters">Most Donors</option>
                </select>
              )}
            </div>

            <div className="lbv-seg" role="group" aria-label="Timeframe filter">
              {[
                { id: 'all', label: 'All Time' },
                { id: 'month', label: '30 Days' },
                { id: 'active', label: 'Active' }
              ].map((tf) => (
                <button
                  key={tf.id}
                  type="button"
                  className={`lbv-seg-btn${timeframe === tf.id ? ' is-active' : ''}`}
                  onClick={() => setTimeframe(tf.id)}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Share Toast */}
        {shareFeedback && (
          <div className="lbv-toast">
            <span className="material-symbols-outlined">check_circle</span>
            <span>{shareFeedback}</span>
          </div>
        )}

        {/* ── UNIFIED SCROLLABLE LEDGER TABLE ── */}
        <div className="lbv-body">
          {/* Sticky Aligned Column Header */}
          <div className="lbv-table-head">
            <span className="lbv-th lbv-th--rank">#</span>
            <span className="lbv-th">{activeTab === 'donors' ? 'Donor' : 'Organization'}</span>
            <span className="lbv-th">{activeTab === 'donors' ? 'Giving Circle' : 'Accreditation'}</span>
            <span className="lbv-th lbv-th--right">
              {activeTab === 'donors'
                ? donorSortBy === 'campaigns'
                  ? 'Drives'
                  : donorSortBy === 'recent'
                    ? 'Recent Total'
                    : 'Total Donated'
                : ngoSortBy === 'campaigns'
                  ? 'Campaigns'
                  : ngoSortBy === 'supporters'
                    ? 'Donors'
                    : 'Total Raised'}
            </span>
            <span className="lbv-th lbv-th--right">Actions</span>
          </div>

          {loading || tabLoading ? (
            <div className="lbv-skel-list">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="lbv-skel-row">
                  <div className="lbv-skel lbv-skel--rank" />
                  <div className="lbv-skel lbv-skel--avatar" />
                  <div className="lbv-skel-lines">
                    <div className="lbv-skel lbv-skel--name" />
                    <div className="lbv-skel lbv-skel--sub" />
                  </div>
                  <div className="lbv-skel lbv-skel--amt" />
                </div>
              ))}
            </div>
          ) : currentList.length === 0 ? (
            <div className="lbv-empty">
              <div className="lbv-empty-well">
                <span className="material-symbols-outlined">volunteer_activism</span>
              </div>
              <div className="lbv-empty-title">No matching records found</div>
              <p className="lbv-empty-desc">
                Try clearing your search query or switching to the All Time window.
              </p>
              {(searchQuery || timeframe !== 'all') && (
                <button
                  type="button"
                  className="lbv-reset-btn"
                  onClick={() => {
                    setSearchQuery('');
                    setTimeframe('all');
                  }}
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <div className="lbv-rows">
              {currentList.map((item) => {
                const isCurrent = checkIsCurrentUser(item);
                const dCount = item.donationCount || 1;
                const cCount = item.campaignsSupported || 1;
                const donorTier = resolveDonorTier(item);
                const rankStr = String(item.currentRank).padStart(2, '0');
                const rankClass =
                  item.currentRank === 1
                    ? ' is-gold'
                    : item.currentRank === 2
                      ? ' is-silver'
                      : item.currentRank === 3
                        ? ' is-bronze'
                        : '';

                return (
                  <div key={item.id} className={`lbv-row${isCurrent ? ' is-you' : ''}`}>
                    {/* Col 1: Rank */}
                    <div className={`lbv-cell-rank${rankClass}`}>{rankStr}</div>

                    {/* Col 2: Identity */}
                    <div className="lbv-cell-entity">
                      <div className="lbv-avatar">
                        {item.isAnonymous ? (
                          <span className="material-symbols-outlined">visibility_off</span>
                        ) : item.avatarUrl ? (
                          <img src={item.avatarUrl} alt={item.displayName || item.orgName} />
                        ) : (
                          <span>{(item.displayName || item.orgName || '?').substring(0, 2).toUpperCase()}</span>
                        )}
                      </div>

                      <div className="lbv-entity-meta">
                        <div className="lbv-name-row">
                          <span className="lbv-name" title={item.displayName || item.orgName}>
                            {item.displayName || item.orgName}
                          </span>
                          {!item.isAnonymous && (
                            <span className="material-symbols-outlined lbv-verified-ico" title="Verified">
                              verified
                            </span>
                          )}
                          {isCurrent && <span className="lbv-you-pill">You</span>}
                        </div>

                        <div className="lbv-sub">
                          {activeTab === 'donors' ? (
                            <span>{item.isAnonymous ? 'Private Donor · Philippines' : 'Verified Donor · Philippines'}</span>
                          ) : (
                            <span>
                              {item.secRegNo ? `SEC ${item.secRegNo}` : 'SEC Accredited'} · {item.location || 'Philippines'}
                            </span>
                          )}
                        </div>

                        {activeTab === 'donors' && item.dedication && (
                          <div className="lbv-dedication" title={item.dedication}>
                            “{item.dedication}”
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Col 3: Giving Circle / Accreditation */}
                    <div className="lbv-cell-circle">
                      {activeTab === 'donors' ? (
                        item.isAnonymous && item.hideBadge ? (
                          <span className="lbv-private-circle">
                            <span className="material-symbols-outlined">shield_person</span>
                            <span>Private Circle</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="lbv-circle-btn"
                            onClick={() =>
                              setSelectedDonorForModal({
                                ...item,
                                totalDonatedEth: item.totalDonatedEth,
                                totalDonatedPhp: item.totalDonatedPhp
                              })
                            }
                            title="View Giving Circle & Certificate"
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
                            <span className="lbv-circle-name">{donorTier.name}</span>
                          </button>
                        )
                      ) : (
                        <span className="lbv-ngo-badge">
                          <span className="material-symbols-outlined">verified_user</span>
                          <span>Accredited NGO</span>
                        </span>
                      )}
                    </div>

                    {/* Col 4: Impact Metrics (Right-Aligned, Zero Overlap) */}
                    <div className="lbv-cell-metrics">
                      <div className="lbv-metric-primary">
                        {activeTab === 'donors'
                          ? donorSortBy === 'campaigns'
                            ? `${cCount} ${cCount === 1 ? 'Drive' : 'Drives'}`
                            : formatPhp(item.totalDonatedPhp)
                          : ngoSortBy === 'campaigns'
                            ? `${item.campaignsCount || 0} Drives`
                            : ngoSortBy === 'supporters'
                              ? `${(item.donorCount || 0).toLocaleString()} Donors`
                              : formatPhp(item.totalDeployedPhp)}
                      </div>
                      <div className="lbv-metric-sub">
                        {activeTab === 'donors'
                          ? `${cCount} ${cCount === 1 ? 'drive' : 'drives'} · ${dCount} ${dCount === 1 ? 'donation' : 'donations'}`
                          : `${item.campaignsCount || 0} drives · ${(item.donorCount || 0).toLocaleString()} donors`}
                      </div>
                    </div>

                    {/* Col 5: Compact Hairline Actions */}
                    <div className="lbv-cell-actions">
                      {activeTab === 'donors' ? (
                        <>
                          <button
                            type="button"
                            className="lbv-act-btn lbv-act-btn--cert"
                            onClick={() => setSelectedDonorForModal(item)}
                            title="View Certificate of Appreciation"
                          >
                            <span className="material-symbols-outlined">workspace_premium</span>
                            <span>Certificate</span>
                          </button>
                          <button
                            type="button"
                            className="lbv-icon-act"
                            onClick={() => setSelectedDonorForModal({ ...item, initialTab: 'ledger' })}
                            title="Inspect on-chain donation ledger"
                            aria-label="Proof ledger"
                          >
                            <span className="material-symbols-outlined">receipt_long</span>
                          </button>
                          <button
                            type="button"
                            className={`lbv-icon-act${copiedKey === item.id ? ' is-copied' : ''}`}
                            onClick={() => handleShareImpact(item)}
                            title="Share achievement"
                            aria-label="Share"
                          >
                            <span className="material-symbols-outlined">
                              {copiedKey === item.id ? 'check' : 'share'}
                            </span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="lbv-act-btn"
                            onClick={() => {
                              if (typeof onOpenNgoProfile === 'function') {
                                onOpenNgoProfile(item.orgId || 2);
                              }
                            }}
                            title="View organization profile & drives"
                          >
                            <span>Profile</span>
                            <span className="material-symbols-outlined">arrow_forward</span>
                          </button>
                          <button
                            type="button"
                            className={`lbv-icon-act${copiedKey === item.id ? ' is-copied' : ''}`}
                            onClick={() => handleShareImpact(item)}
                            title="Share partner impact"
                            aria-label="Share"
                          >
                            <span className="material-symbols-outlined">
                              {copiedKey === item.id ? 'check' : 'share'}
                            </span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── FLUSH RECESSED USER STANDING FOOTER ── */}
        <div className="lbv-footer">
          <div className="lbv-footer-left">
            <span className="material-symbols-outlined lbv-footer-ico">volunteer_activism</span>
            {userRankInfo ? (
              (() => {
                const userTier = resolveDonorTier({
                  totalDonatedEth: userRankInfo.amountEth,
                  totalDonatedPhp: userRankInfo.amountPhp
                });
                return (
                  <span className="lbv-footer-text">
                    Recognized in the <strong>{userTier.name}</strong> Giving Circle · Thank you for your generosity.
                  </span>
                );
              })()
            ) : dbUser ? (
              <span className="lbv-footer-text">
                Thank you for supporting disaster relief communities across the Philippines.
              </span>
            ) : (
              <span className="lbv-footer-text">
                Sign in to view your verified donations, Giving Circle, and Certificate of Appreciation.
              </span>
            )}
          </div>

          {dbUser ? (
            <button
              type="button"
              className="lbv-footer-cta"
              onClick={() => {
                const userAsDonor = data.donors?.find((d) => checkIsCurrentUser(d)) || {
                  displayName: dbUser.display_name || dbUser.name || dbUser.username,
                  walletAddress: dbUser.wallet_address || walletAddress,
                  donorId: dbUser.id,
                  totalDonatedPhp: 0,
                  totalDonatedEth: 0,
                  donationCount: 0
                };
                setSelectedDonorForModal(userAsDonor);
              }}
            >
              <span className="material-symbols-outlined">workspace_premium</span>
              <span>My Certificate</span>
            </button>
          ) : (
            <button
              type="button"
              className="lbv-footer-cta"
              onClick={() => {
                onClose();
                if (typeof onLogin === 'function') onLogin();
              }}
            >
              <span>Log In</span>
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          )}
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
