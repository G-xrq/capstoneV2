import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import DonorBadge from './DonorBadge';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [data, setData] = useState({ donors: [], ngos: [], stats: {}, userRank: null });
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState(null);

  // Fetch leaderboard data when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${API_URL}/api/leaderboard`, { headers });
        if (res.ok) {
          const json = await res.json();
          if (isMounted) setData(json);
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
  }, [isOpen]);

  // Keyboard accessibility: Escape closes modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Format ETH string
  const formatEth = (val) => {
    const num = parseFloat(val) || 0;
    if (num > 0 && num < 0.001) {
      return num.toFixed(5) + ' ETH';
    }
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + ' ETH';
  };

  // Format PHP string
  const formatPhp = (val) => {
    const num = parseFloat(val) || 0;
    return '₱' + Math.round(num).toLocaleString('en-US');
  };

  // Copy helper
  const handleCopy = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  // Filtered Donors
  const filteredDonors = useMemo(() => {
    let list = data.donors || [];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(d => 
        (d.displayName || '').toLowerCase().includes(q) ||
        (d.username || '').toLowerCase().includes(q) ||
        (d.walletAddress || '').toLowerCase().includes(q) ||
        (d.badge?.name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [data.donors, searchQuery]);

  // Filtered NGOs
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
    return list;
  }, [data.ngos, searchQuery]);

  if (!isOpen || typeof document === 'undefined') return null;

  const currentList = activeTab === 'donors' ? filteredDonors : filteredNgos;
  const top3 = currentList.slice(0, 3);
  const remaining = currentList.slice(3);

  // Determine current user rank info
  const userRankInfo = data.userRank;
  const isUserDonor = dbUser?.role === 'donor';
  const isUserNgo = dbUser?.role === 'organization';

  return createPortal(
    <div 
      className="bbdrts-leaderboard-backdrop" 
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bbdrts-lb-title"
    >
      <div 
        className={`bbdrts-leaderboard-modal theme-${theme}`} 
        onClick={(e) => e.stopPropagation()}
      >
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
            <span className="material-symbols-outlined">emoji_events</span>
          </div>
          <div>
            <div className="bbdrts-leaderboard-badge">
              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>verified</span>
              <span>BBDRTS PHILIPPINES • PROOF-OF-IMPACT LEADERBOARD</span>
            </div>
            <h2 id="bbdrts-lb-title" className="bbdrts-leaderboard-title">
              {activeTab === 'donors' ? 'Philanthropic Honor Roll' : 'Disaster Relief Impact Champions'}
            </h2>
            <p className="bbdrts-leaderboard-subtitle">
              {activeTab === 'donors' 
                ? 'Recognizing verified donors powering transparent emergency disaster response across the Philippine archipelago.'
                : 'Recognizing accredited relief organizations delivering verified on-the-ground proof, rapid response, and transparent escrow milestones.'}
            </p>
          </div>
        </div>

        {/* Navigation Bar: Dual Tabs & Search/Filter Controls */}
        <div className="bbdrts-leaderboard-nav-bar">
          <div className="bbdrts-leaderboard-tabs">
            <button
              type="button"
              className={`bbdrts-leaderboard-tab-btn ${activeTab === 'donors' ? 'active' : ''}`}
              onClick={() => setActiveTab('donors')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>volunteer_activism</span>
              <span>Top Donors ({data.donors?.length || 0})</span>
            </button>
            <button
              type="button"
              className={`bbdrts-leaderboard-tab-btn ${activeTab === 'ngos' ? 'active' : ''}`}
              onClick={() => setActiveTab('ngos')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>corporate_fare</span>
              <span>Top NGOs ({data.ngos?.length || 0})</span>
            </button>
          </div>

          <div className="bbdrts-leaderboard-controls">
            {/* Search Input */}
            <div className="bbdrts-leaderboard-search">
              <span className="material-symbols-outlined bbdrts-leaderboard-search-icon">search</span>
              <input
                type="text"
                placeholder={activeTab === 'donors' ? 'Search donor or wallet...' : 'Search organization...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bbdrts-leaderboard-search-input"
              />
            </div>

            {/* Timeframe Filter */}
            <div className="bbdrts-leaderboard-timeframe">
              <button
                type="button"
                className={`bbdrts-timeframe-btn ${timeframe === 'all' ? 'active' : ''}`}
                onClick={() => setTimeframe('all')}
              >
                All Time
              </button>
              <button
                type="button"
                className={`bbdrts-timeframe-btn ${timeframe === 'month' ? 'active' : ''}`}
                onClick={() => setTimeframe('month')}
              >
                30 Days
              </button>
              <button
                type="button"
                className={`bbdrts-timeframe-btn ${timeframe === 'active' ? 'active' : ''}`}
                onClick={() => setTimeframe('active')}
              >
                Active Storms
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="bbdrts-leaderboard-body">

          {/* ── TOP 3 OLYMPIC PODIUM ── */}
          {top3.length > 0 && (
            <div className="bbdrts-podium-section">
              {top3.map((item, idx) => {
                const rankNumber = idx + 1;
                const isRank1 = rankNumber === 1;
                const isRank2 = rankNumber === 2;
                const isRank3 = rankNumber === 3;

                return (
                  <div key={item.id || idx} className={`bbdrts-podium-slot rank-${rankNumber}`}>
                    <div className="bbdrts-podium-card">
                      {/* Medal / Crown Badge */}
                      <div className="bbdrts-podium-medal">
                        {isRank1 ? '👑' : isRank2 ? '🥈' : '🥉'}
                      </div>

                      {/* Avatar */}
                      <div className="bbdrts-podium-avatar">
                        {item.avatarUrl ? (
                          <img src={item.avatarUrl} alt={item.displayName || item.orgName} />
                        ) : (
                          <span>{(item.displayName || item.orgName || '?').substring(0, 2).toUpperCase()}</span>
                        )}
                      </div>

                      {/* Name */}
                      <div className="bbdrts-podium-name" title={item.displayName || item.orgName}>
                        {item.displayName || item.orgName}
                      </div>

                      {/* Tier or Accreditation Pill */}
                      {activeTab === 'donors' ? (
                        <div 
                          className="bbdrts-podium-tier-pill"
                          style={{
                            background: `${item.badge?.color || '#22c55e'}18`,
                            color: item.badge?.color || '#22c55e',
                            border: `1px solid ${item.badge?.color || '#22c55e'}40`
                          }}
                        >
                          <DonorBadge amountEth={item.totalDonatedEth} size="sm" interactive={false} />
                          <span>{item.badge?.name || 'Contributor'}</span>
                        </div>
                      ) : (
                        <div 
                          className="bbdrts-podium-tier-pill"
                          style={{
                            background: 'rgba(34, 197, 94, 0.14)',
                            color: '#22c55e',
                            border: '1px solid rgba(34, 197, 94, 0.35)'
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>verified</span>
                          <span>{item.secRegNo ? 'SEC Accredited' : 'Verified Partner'}</span>
                        </div>
                      )}

                      {/* Primary Stat */}
                      <div className="bbdrts-podium-amount">
                        {activeTab === 'donors' 
                          ? formatEth(item.totalDonatedEth)
                          : formatEth(item.totalDeployedEth)}
                      </div>

                      {/* Secondary Fiat Stat */}
                      <div className="bbdrts-podium-fiat">
                        {activeTab === 'donors' 
                          ? formatPhp(item.totalDonatedPhp)
                          : `${formatPhp(item.totalDeployedPhp)} Deployed`}
                      </div>

                      {/* Secondary Metric */}
                      <div className="bbdrts-podium-metric-sub">
                        {activeTab === 'donors'
                          ? `🤝 ${item.campaignsSupported || item.donationCount} Campaigns Supported`
                          : `🎯 ${item.milestonesCompleted} Milestones • ${(item.beneficiariesReached || 0).toLocaleString()} Reached`}
                      </div>
                    </div>

                    {/* Pedestal Base */}
                    <div className="bbdrts-podium-pedestal">
                      <span>{isRank1 ? '👑 #1 CHAMPION' : isRank2 ? '🥈 #2 SILVER' : '🥉 #3 BRONZE'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── RANKED ROSTER LIST (Rank #4+) ── */}
          <div className="bbdrts-roster-section">
            <div className="bbdrts-roster-header-row">
              <div>Rank</div>
              <div>{activeTab === 'donors' ? 'Philanthropist' : 'Organization'}</div>
              <div>{activeTab === 'donors' ? 'Honors Tier' : 'Accreditation'}</div>
              <div>{activeTab === 'donors' ? 'Total Giving' : 'Aid Deployed'}</div>
              <div style={{ textAlign: 'right' }}>Action</div>
            </div>

            {remaining.length === 0 && top3.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted, #94a3b8)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '36px', opacity: 0.5 }}>leaderboard</span>
                <p style={{ marginTop: '8px', fontSize: '0.86rem' }}>No entries found matching your filter criteria.</p>
              </div>
            )}

            {remaining.map((item) => {
              const rankNum = item.rank;
              const isCurrent = item.isCurrentUser;

              return (
                <div key={item.id} className={`bbdrts-roster-item ${isCurrent ? 'is-current-user' : ''}`}>
                  {/* Rank */}
                  <div className="bbdrts-roster-rank">
                    <div className="bbdrts-roster-rank-chip">
                      #{rankNum}
                    </div>
                  </div>

                  {/* Entity Information */}
                  <div className="bbdrts-roster-entity">
                    <div className="bbdrts-roster-avatar">
                      {item.avatarUrl ? (
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
                        {isCurrent && <span className="bbdrts-roster-you-tag">YOU</span>}
                      </div>
                      <div className="bbdrts-roster-sub">
                        {activeTab === 'donors' ? (
                          <>
                            {item.walletAddress && (
                              <span 
                                style={{ cursor: 'pointer', fontFamily: 'monospace' }}
                                onClick={() => handleCopy(item.walletAddress, item.id)}
                                title="Click to copy wallet address"
                              >
                                {copiedKey === item.id 
                                  ? '✓ Copied' 
                                  : `${item.walletAddress.substring(0, 6)}...${item.walletAddress.substring(item.walletAddress.length - 4)}`}
                              </span>
                            )}
                            <span>•</span>
                            <span>{item.location || 'Philippines'}</span>
                          </>
                        ) : (
                          <>
                            <span>{item.secRegNo ? `SEC ${item.secRegNo}` : 'Verified Relief Partner'}</span>
                            <span>•</span>
                            <span>{item.location || 'Philippines'}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tier / Accreditation */}
                  <div className="bbdrts-roster-tier">
                    {activeTab === 'donors' ? (
                      <>
                        <DonorBadge amountEth={item.totalDonatedEth} size="sm" interactive={false} />
                        <div className="bbdrts-roster-tier-info">
                          <div className="bbdrts-roster-tier-title" style={{ color: item.badge?.color || '#ffffff' }}>
                            {item.badge?.name || 'Contributor'}
                          </div>
                          <div className="bbdrts-roster-tier-sub">
                            {item.badge?.subtitle || 'Honors Badge'}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="bbdrts-roster-tier-info">
                        <div className="bbdrts-roster-tier-title" style={{ color: '#22c55e' }}>
                          ✓ 100% On-Chain Proof
                        </div>
                        <div className="bbdrts-roster-tier-sub">
                          {item.milestonesCompleted} Milestones Verified
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Impact Metrics */}
                  <div className="bbdrts-roster-metrics">
                    <div className="bbdrts-roster-metrics-primary">
                      {activeTab === 'donors' ? formatEth(item.totalDonatedEth) : formatEth(item.totalDeployedEth)}
                    </div>
                    <div className="bbdrts-roster-metrics-sub">
                      {activeTab === 'donors' 
                        ? `${formatPhp(item.totalDonatedPhp)} • ${item.campaignsSupported || item.donationCount} Causes` 
                        : `${formatPhp(item.totalDeployedPhp)} • ${(item.beneficiariesReached || 0).toLocaleString()} Reached`}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="bbdrts-roster-action">
                    {activeTab === 'donors' ? (
                      item.walletAddress ? (
                        <a
                          href={`https://sepolia.etherscan.io/address/${item.walletAddress}`}
                          target="_blank"
                          rel="noreferrer"
                          className="bbdrts-roster-btn"
                          title="Inspect transactions on Sepolia Etherscan"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>open_in_new</span>
                          <span>Ledger</span>
                        </a>
                      ) : (
                        <button
                          type="button"
                          className="bbdrts-roster-btn"
                          onClick={() => handleCopy(item.displayName, item.id)}
                          title="Copy Philanthropist Name"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                            {copiedKey === item.id ? 'check' : 'content_copy'}
                          </span>
                          <span>{copiedKey === item.id ? 'Copied' : 'Share'}</span>
                        </button>
                      )
                    ) : (
                      <button
                        type="button"
                        className="bbdrts-roster-btn"
                        onClick={() => {
                          onClose();
                          if (typeof onOpenNgoProfile === 'function') {
                            onOpenNgoProfile(item.orgId || 3);
                          }
                        }}
                        title="View Official Accreditation & Relief Drives"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>verified_user</span>
                        <span>Profile</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── STICKY CURRENT USER STANDING BAR ── */}
        <div className="bbdrts-leaderboard-user-banner">
          <div className="bbdrts-user-banner-left">
            <span className="material-symbols-outlined" style={{ fontSize: '26px', color: 'var(--accent, #22c55e)' }}>
              military_tech
            </span>
            <div>
              {userRankInfo ? (
                <div className="bbdrts-user-banner-text">
                  You are currently ranked <strong>#{userRankInfo.rank}</strong> of {userRankInfo.total} {activeTab === 'donors' ? 'registered donors' : 'accredited agencies'}.
                  {userRankInfo.role === 'donor' && (
                    <span> Current Standing: <strong style={{ color: userRankInfo.badge?.color }}>{userRankInfo.badge?.name}</strong>.</span>
                  )}
                </div>
              ) : dbUser ? (
                <div className="bbdrts-user-banner-text">
                  Logged in as <strong>{dbUser.name || dbUser.username}</strong> ({dbUser.role}). Donate to verified relief appeals to claim your place on the Philanthropic Honor Roll!
                </div>
              ) : (
                <div className="bbdrts-user-banner-text">
                  Connect your Web3 wallet or log in to track your personal verified ranking and earn on-chain honors tiers!
                </div>
              )}
            </div>
          </div>

          {!dbUser && (
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
    </div>,
    document.body
  );
}
