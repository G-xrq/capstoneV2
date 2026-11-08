import { useState, useEffect, useMemo, useRef } from 'react';
import CampaignCard from '../components/CampaignCard';
import DisasterRadarHeatmap from '../components/DisasterRadarHeatmap';
import { contractAddress } from '../contractConfig';
import { API_URL } from '../config';
import './LandingView.css';

export default function LandingView({
  onConnect,
  onSignIn,
  onSignUp,
  hasMetaMask,
  contract,
  onOpenNgoProfile,
  theme
}) {
  const [stats, setStats] = useState({
    donors: 0,
    orgs: 0,
    campaigns: 0,
    totalEthRaised: '0.00',
    totalPhpEstimated: '0'
  });

  const [campaigns, setCampaigns] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('urgency'); // 'urgency' | 'target' | 'raised' | 'newest'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [contractCopied, setContractCopied] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState(null);

  // Deep Link URL Target Campaign Detection (?campaign=14)
  const [targetCampaignId, setTargetCampaignId] = useState(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('campaign');
  });
  const targetScrolledRef = useRef(false);

  const handleCopyContract = () => {
    navigator.clipboard.writeText(contractAddress);
    setContractCopied(true);
    setTimeout(() => setContractCopied(false), 2200);
  };

  const toggleFaq = (index) => {
    setOpenFaqIndex(prev => prev === index ? null : index);
  };

  useEffect(() => {
    const fetchLandingData = async () => {
      try {
        const apiUrl = API_URL;

        // Fetch real database counts and live campaigns in parallel with cache-busting
        const [statsRes, campsRes] = await Promise.all([
          fetch(`${apiUrl}/api/public-stats?_t=${Date.now()}`, { cache: 'no-store' }).catch(() => null),
          fetch(`${apiUrl}/api/campaigns?_t=${Date.now()}`, { cache: 'no-store' }).catch(() => null)
        ]);

        let realDbStats = { donors: 0, orgs: 0, campaigns: 0 };
        if (statsRes && statsRes.ok) {
          realDbStats = await statsRes.json();
        }

        if (campsRes && campsRes.ok) {
          const data = await campsRes.json();
          const validList = Array.isArray(data) ? data.filter(c => c && (c.title || c.id)) : [];
          setCampaigns(validList);

          const ethSum = validList.reduce((sum, c) => sum + parseFloat(c.currentAmount || 0), 0);
          const phpEst = Math.round(ethSum * 185000); // Approximate PHP/ETH rate for reference

          setStats({
            donors: realDbStats.donors || 0,
            orgs: realDbStats.orgs || 0,
            campaigns: validList.length || realDbStats.campaigns || 0,
            totalEthRaised: ethSum > 0 ? ethSum.toFixed(2) : '0.00',
            totalPhpEstimated: phpEst > 0 ? phpEst.toLocaleString() : '0'
          });
        }
      } catch (err) {
        console.error('Failed to fetch public campaigns for landing page:', err);
      } finally {
        setLoadingCampaigns(false);
      }
    };

    fetchLandingData();
  }, []);

  // Global Navigation Listener for Landing View
  useEffect(() => {
    const handleRadarNav = () => {
      setTimeout(() => {
        const el = document.getElementById('radar-heatmap');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    };
    const handleCampaignsNav = () => {
      setTimeout(() => {
        const el = document.getElementById('campaigns');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    };

    const handleCategoryNav = (e) => {
      const cat = e.detail?.category || 'ALL';
      setActiveCategory(cat);
      setSearchQuery('');
      setCurrentPage(1);
      setTimeout(() => {
        const el = document.getElementById('campaigns');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    };

    window.addEventListener('bbdrts_navigate_radar', handleRadarNav);
    window.addEventListener('bbdrts_navigate_campaigns', handleCampaignsNav);
    window.addEventListener('bbdrts_filter_category', handleCategoryNav);
    return () => {
      window.removeEventListener('bbdrts_navigate_radar', handleRadarNav);
      window.removeEventListener('bbdrts_navigate_campaigns', handleCampaignsNav);
      window.removeEventListener('bbdrts_filter_category', handleCategoryNav);
    };
  }, []);

  // Dynamic Pagination based on View Mode
  const [currentPage, setCurrentPage] = useState(1);
  const CAMPAIGNS_PER_PAGE = viewMode === 'grid' ? 4 : 2;

  // Filtered and Sorted campaigns based on category, search query, and sort criteria
  const processedCampaigns = useMemo(() => {
    let list = campaigns.filter(c => {
      const matchCategory = activeCategory === 'ALL' ||
        (activeCategory === 'DR' && (c.category === 'DR' || !c.category || c.category === 'TYPHOON' || c.category === 'FLOOD')) ||
        (activeCategory === 'CD' && (c.category === 'CD' || c.category === 'COMMUNITY' || c.category === 'EDUCATION' || c.category === 'LIVELIHOOD')) ||
        (activeCategory === 'TYPHOON' && (c.title?.toLowerCase().includes('typhoon') || c.category === 'TYPHOON')) ||
        (activeCategory === 'FLOOD' && (c.title?.toLowerCase().includes('flood') || c.category === 'FLOOD')) ||
        (activeCategory === 'MEDICAL' && (c.title?.toLowerCase().includes('medical') || c.category === 'MEDICAL')) ||
        (activeCategory === 'FOOD' && (c.title?.toLowerCase().includes('food') || c.category === 'FOOD_WATER')) ||
        (activeCategory === 'SHELTER' && (c.title?.toLowerCase().includes('shelter') || c.category === 'SHELTER' || c.category === 'LIVELIHOOD'));

      const query = searchQuery.trim().toLowerCase();
      const matchQuery = !query ||
        c.title?.toLowerCase().includes(query) ||
        c.description?.toLowerCase().includes(query) ||
        c.locationRegion?.toLowerCase().includes(query) ||
        c.orgName?.toLowerCase().includes(query);

      return matchCategory && matchQuery;
    });

    // Sorting logic
    if (sortBy === 'urgency') {
      list.sort((a, b) => {
        const diffA = (parseFloat(a.targetAmount || 0) - parseFloat(a.currentAmount || 0));
        const diffB = (parseFloat(b.targetAmount || 0) - parseFloat(b.currentAmount || 0));
        return diffB - diffA;
      });
    } else if (sortBy === 'target') {
      list.sort((a, b) => parseFloat(b.targetAmount || 0) - parseFloat(a.targetAmount || 0));
    } else if (sortBy === 'raised') {
      list.sort((a, b) => parseFloat(b.currentAmount || 0) - parseFloat(a.currentAmount || 0));
    } else if (sortBy === 'newest') {
      list.sort((a, b) => (b.id || 0) - (a.id || 0));
    }

    return list;
  }, [campaigns, activeCategory, searchQuery, sortBy]);

  // Reset to page 1 whenever user changes filter or search query
  const isInitialFilterMount = useRef(true);
  useEffect(() => {
    if (isInitialFilterMount.current) {
      isInitialFilterMount.current = false;
      return;
    }
    if (!targetCampaignId || targetScrolledRef.current) {
      setCurrentPage(1);
    }
  }, [activeCategory, searchQuery, targetCampaignId, sortBy, viewMode]);

  const totalPages = Math.ceil(processedCampaigns.length / CAMPAIGNS_PER_PAGE) || 1;

  const paginatedCampaigns = useMemo(() => {
    const start = (currentPage - 1) * CAMPAIGNS_PER_PAGE;
    return processedCampaigns.slice(start, start + CAMPAIGNS_PER_PAGE);
  }, [processedCampaigns, currentPage, CAMPAIGNS_PER_PAGE]);

  // Deep Link Auto-Navigation
  useEffect(() => {
    if (!targetCampaignId || campaigns.length === 0 || targetScrolledRef.current) return;

    const idx = campaigns.findIndex(c => String(c.id) === String(targetCampaignId));
    if (idx !== -1) {
      targetScrolledRef.current = true;
      setActiveCategory('ALL');
      setSearchQuery('');

      const targetPage = Math.floor(idx / CAMPAIGNS_PER_PAGE) + 1;
      setCurrentPage(targetPage);

      let attempts = 0;
      const scrollTimer = setInterval(() => {
        attempts++;
        const el = document.getElementById(`campaign-${targetCampaignId}`);
        if (el) {
          clearInterval(scrollTimer);
          const rect = el.getBoundingClientRect();
          const targetY = window.pageYOffset + rect.top - 85;
          window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
        } else if (attempts >= 30) {
          clearInterval(scrollTimer);
        }
      }, 80);

      return () => clearInterval(scrollTimer);
    }
  }, [targetCampaignId, campaigns, CAMPAIGNS_PER_PAGE]);

  return (
    <div className="bbdrts-landing-root" id="top">

      {/* ── 1. Hero Section ── */}
      <section className="bbdrts-hero-section">
        <div className="bbdrts-ambient-spotlight" aria-hidden="true" />
        <div className="bbdrts-hero-grid-bg" aria-hidden="true" />

        <div className="container">
          <div className="bbdrts-hero-center-content">

            {/* Project / Capstone Badge */}
            <div className="bbdrts-hero-badge">
              <span className="bbdrts-pulse-beacon" />
              <span>Transparent Disaster Relief Platform · Saint Joseph College CCS</span>
            </div>

            {/* Headline */}
            <h1 className="bbdrts-hero-title">
              Disaster relief donations <br className="bbdrts-br-desktop" />
              <span className="bbdrts-title-gradient">you can actually trace.</span>
            </h1>

            <p className="bbdrts-hero-lead">
              BBDRTS connects donors directly to verified disaster response organizations across 82 Philippine provinces. Give easily using <strong>GCash, Maya, Bank Transfer, or Crypto</strong> with full transparency and zero platform fees.
            </p>

            {/* Direct Assistance Callout */}
            <div className="bbdrts-hero-direct-callout">
              <span className="material-symbols-outlined" style={{ color: '#10b981', fontSize: '18px', flexShrink: 0 }}>shield</span>
              <span>
                <strong>Direct Financial Assistance:</strong> Every donation is held in smart contract escrow and released in phases to verified relief teams once official receipts and proof of delivery are submitted.
              </span>
            </div>

            {/* Primary Action Buttons */}
            <div className="bbdrts-hero-actions">
              <a href="#campaigns" className="bbdrts-btn-primary">
                <span>Browse Relief Appeals</span>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_downward</span>
              </a>
              <a href="#radar-heatmap" className="bbdrts-btn-secondary">
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>map</span>
                <span>View Disaster Map</span>
              </a>
              <button type="button" className="bbdrts-btn-ghost" onClick={onSignIn || onConnect}>
                <span>Sign In / Register ↗</span>
              </button>
            </div>

            {/* 5-Column Bento Stat Strip */}
            <div className="bbdrts-floating-stats-card">
              <div className="bbdrts-bento-stat-col">
                <div className="bbdrts-bento-stat-val">82 Provinces</div>
                <div className="bbdrts-bento-stat-lbl">Monitored on Map</div>
              </div>

              <div className="bbdrts-bento-stat-col">
                <div className="bbdrts-bento-stat-val">{stats.totalEthRaised} ETH</div>
                <div className="bbdrts-bento-stat-lbl">Total Aid Raised (₱{stats.totalPhpEstimated})</div>
              </div>

              <div className="bbdrts-bento-stat-col">
                <div className="bbdrts-bento-stat-val">{stats.donors}</div>
                <div className="bbdrts-bento-stat-lbl">Donors Helping Out</div>
              </div>

              <div
                className="bbdrts-bento-stat-col bbdrts-bento-clickable"
                onClick={() => onOpenNgoProfile && onOpenNgoProfile(3)}
                title="Click to view verified organization accreditation profile"
              >
                <div className="bbdrts-bento-stat-val">{stats.orgs} Verified ↗</div>
                <div className="bbdrts-bento-stat-lbl">Relief Organizations</div>
              </div>

              <div className="bbdrts-bento-stat-col">
                <div className="bbdrts-bento-stat-val highlight-green">0% Fee</div>
                <div className="bbdrts-bento-stat-lbl">Direct to Victims</div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 2. The Problem & Solution ── */}
      <section className="bbdrts-purpose-section" id="purpose">
        <div className="container">
          <div className="bbdrts-section-header-centered">
            <div className="bbdrts-section-eyebrow">THE PROBLEM & SOLUTION</div>
            <h2 className="bbdrts-section-title">Making Disaster Relief Honest and Transparent</h2>
            <p className="bbdrts-section-desc" style={{ maxWidth: '720px', margin: '0 auto' }}>
              The Philippines experiences over 20 typhoons and calamities each year. In traditional relief drives, donors often have no way of knowing if their money actually reached the victims. BBDRTS was built to solve this problem using smart contracts and receipt verification.
            </p>
          </div>

          <div className="bbdrts-comparison-grid">
            {/* The Common Problems in Traditional Charity */}
            <div className="bbdrts-comparison-card flawed">
              <div className="bbdrts-comparison-header">
                <div className="bbdrts-comparison-tag danger">
                  <span className="material-symbols-outlined">cancel</span>
                  <span>Common Issues in Traditional Relief</span>
                </div>
                <h3 className="bbdrts-comparison-title">Donations with little to no visibility</h3>
              </div>

              <ul className="bbdrts-comparison-list">
                <li>
                  <span className="material-symbols-outlined icon-danger">close</span>
                  <div>
                    <strong>Private Bank Accounts:</strong> Donors deposit money into bank accounts without a clear public breakdown of how the money is spent.
                  </div>
                </li>
                <li>
                  <span className="material-symbols-outlined icon-danger">close</span>
                  <div>
                    <strong>Slow Delivery:</strong> Heavy paperwork and delays mean relief supplies can take weeks to reach evacuation centers.
                  </div>
                </li>
                <li>
                  <span className="material-symbols-outlined icon-danger">close</span>
                  <div>
                    <strong>Risk of Lost or Spoiled Goods:</strong> Without public tracking, relief packs can spoil in storage or be distributed unfairly.
                  </div>
                </li>
                <li>
                  <span className="material-symbols-outlined icon-danger">close</span>
                  <div>
                    <strong>No Public Receipts:</strong> Donors rarely get to see the actual vendor receipts, purchase orders, or distribution logs.
                  </div>
                </li>
              </ul>
            </div>

            {/* How BBDRTS Solves It */}
            <div className="bbdrts-comparison-card standard">
              <div className="bbdrts-comparison-header">
                <div className="bbdrts-comparison-tag success">
                  <span className="material-symbols-outlined">check_circle</span>
                  <span>How BBDRTS Solves This</span>
                </div>
                <h3 className="bbdrts-comparison-title">Transparent escrow with verifiable proof</h3>
              </div>

              <ul className="bbdrts-comparison-list">
                <li>
                  <span className="material-symbols-outlined icon-success">check</span>
                  <div>
                    <strong>Smart Contract Escrow:</strong> Donations are held securely in a smart contract. Funds are released in milestones, not all at once.
                  </div>
                </li>
                <li>
                  <span className="material-symbols-outlined icon-success">check</span>
                  <div>
                    <strong>Multiple Payment Options:</strong> Donors can contribute directly using GCash, Maya, Bank Transfer, or Sepolia Ethereum.
                  </div>
                </li>
                <li>
                  <span className="material-symbols-outlined icon-success">check</span>
                  <div>
                    <strong>Milestone Releases:</strong> Relief teams receive the next batch of funds only after showing proof of how earlier funds were spent.
                  </div>
                </li>
                <li>
                  <span className="material-symbols-outlined icon-success">check</span>
                  <div>
                    <strong>Receipt Scanning with OCR:</strong> Teams upload official merchant receipts, which are scanned to verify purchased goods against the budget.
                  </div>
                </li>
              </ul>
            </div>
          </div>

        </div>
      </section>

      {/* ── 3. Interactive Philippine Disaster Map ── */}
      <section className="bbdrts-radar-section" id="radar-heatmap">
        <div className="container">
          <div className="bbdrts-command-deck-header">
            <div>
              <div className="bbdrts-section-eyebrow">INTERACTIVE CALAMITY MAP</div>
              <h2 className="bbdrts-section-title">Philippine Disaster Map & Relief Tracking</h2>
              <p className="bbdrts-section-desc">
                Nationwide map monitoring across all 82 provinces. Track disaster alert levels (L1–L5) and live relief operations.
              </p>
            </div>

            <div className="bbdrts-radar-legend-chips">
              <span className="bbdrts-legend-chip l1">L1–L2 Low Alert</span>
              <span className="bbdrts-legend-chip l3">L3 Moderate</span>
              <span className="bbdrts-legend-chip l4">L4 Severe</span>
              <span className="bbdrts-legend-chip l5">L5 Critical</span>
            </div>
          </div>

          <div className="bbdrts-radar-frame">
            <DisasterRadarHeatmap
              campaigns={campaigns}
              theme={theme}
              defaultLayer="terrain"
              onSelectCampaign={(c) => {
                setActiveCategory('ALL');
                setSearchQuery(c.title || '');
                setCurrentPage(1);
                setTimeout(() => {
                  const el = document.getElementById(`campaign-${c.id}`) || document.getElementById('campaigns');
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 80);
              }}
            />
          </div>

          {/* Map Footer Helper */}
          <div className="bbdrts-radar-footer-bar">
            <div className="bbdrts-radar-footer-info">
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#10b981' }}>my_location</span>
              <span><strong>Interactive Map:</strong> Hover or click on any province to view active campaigns, alert levels, and total funds raised.</span>
            </div>
            <a href="#campaigns" className="bbdrts-link-action">
              <span>View All Campaigns</span>
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>east</span>
            </a>
          </div>

        </div>
      </section>

      {/* ── 4. Active Relief Operations Showcase ── */}
      <section className="bbdrts-campaigns-section" id="campaigns">
        <div className="container">

          <div className="bbdrts-section-header">
            <div>
              <div className="bbdrts-section-eyebrow">ACTIVE OPERATIONS</div>
              <h2 className="bbdrts-section-title">Verified Relief Campaigns</h2>
              <p className="bbdrts-section-desc">
                Support ongoing disaster response operations with milestone escrow and public donation tracking.
              </p>
            </div>

            {/* Layout View Toggle */}
            <div className="bbdrts-view-toggle-bar">
              <button
                type="button"
                className={`bbdrts-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid View (2-Column)"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>grid_view</span>
                <span>Grid</span>
              </button>
              <button
                type="button"
                className={`bbdrts-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="List View (1-Column)"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>view_agenda</span>
                <span>List</span>
              </button>
            </div>
          </div>

          {/* Filter & Search Toolbar */}
          <div className="bbdrts-filter-toolbar">
            <div className="bbdrts-filter-group">
              <button
                type="button"
                className={`bbdrts-filter-btn ${activeCategory === 'ALL' ? 'active' : ''}`}
                onClick={() => setActiveCategory('ALL')}
              >
                All Causes ({campaigns.length})
              </button>
              <button
                type="button"
                className={`bbdrts-filter-btn ${activeCategory === 'TYPHOON' ? 'active' : ''}`}
                onClick={() => setActiveCategory('TYPHOON')}
              >
                Typhoon
              </button>
              <button
                type="button"
                className={`bbdrts-filter-btn ${activeCategory === 'FLOOD' ? 'active' : ''}`}
                onClick={() => setActiveCategory('FLOOD')}
              >
                Flood
              </button>
              <button
                type="button"
                className={`bbdrts-filter-btn ${activeCategory === 'FOOD' ? 'active' : ''}`}
                onClick={() => setActiveCategory('FOOD')}
              >
                Food & Water
              </button>
              <button
                type="button"
                className={`bbdrts-filter-btn ${activeCategory === 'MEDICAL' ? 'active' : ''}`}
                onClick={() => setActiveCategory('MEDICAL')}
              >
                Medical
              </button>
              <button
                type="button"
                className={`bbdrts-filter-btn ${activeCategory === 'SHELTER' ? 'active' : ''}`}
                onClick={() => setActiveCategory('SHELTER')}
              >
                Shelter
              </button>
              <button
                type="button"
                className={`bbdrts-filter-btn ${activeCategory === 'CD' ? 'active' : ''}`}
                onClick={() => setActiveCategory('CD')}
              >
                Community
              </button>
            </div>

            <div className="bbdrts-toolbar-right">
              {/* Sort selector */}
              <div className="bbdrts-sort-wrap">
                <span className="bbdrts-sort-label">Sort:</span>
                <select
                  className="bbdrts-sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="urgency">Most Urgent Need</option>
                  <option value="target">Highest Target Goal</option>
                  <option value="raised">Most Funds Raised</option>
                  <option value="newest">Recently Launched</option>
                </select>
              </div>

              {/* Search Field */}
              <div className="bbdrts-search-input-wrap">
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--text-muted)' }}>search</span>
                <input
                  type="text"
                  placeholder="Search causes, regions, or NGOs..."
                  className="bbdrts-search-field"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>close</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Campaign Cards Rendering */}
          {loadingCampaigns ? (
            <div style={{ textAlign: 'center', padding: '64px 0' }}>
              <div className="spinner spinner-light" style={{ margin: '0 auto 16px', width: '32px', height: '32px' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading relief campaigns...</p>
            </div>
          ) : processedCampaigns.length === 0 ? (
            <div className="bbdrts-empty-state">
              <span className="material-symbols-outlined" style={{ fontSize: '38px', color: 'var(--text-muted)', marginBottom: '12px' }}>search_off</span>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '6px', fontSize: '1.1rem', fontWeight: 600 }}>No matching relief causes found</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0, maxWidth: '420px' }}>Try switching categories, clearing your search keywords, or selecting another filter.</p>
              <button
                type="button"
                className="bbdrts-btn-secondary"
                onClick={() => { setActiveCategory('ALL'); setSearchQuery(''); setSortBy('urgency'); }}
                style={{ marginTop: '18px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>filter_alt_off</span>
                <span>Reset Filters</span>
              </button>
            </div>
          ) : (
            <>
              {/* Campaign Container with Grid vs List support */}
              <div className={viewMode === 'grid' ? 'campaigns-grid cols-2' : 'campaigns-list'}>
                {paginatedCampaigns.map(campaign => (
                  <div
                    key={campaign.id}
                    id={`campaign-${campaign.id}`}
                    className={`bbdrts-campaign-item-wrapper ${String(campaign.id) === String(targetCampaignId) ? 'target-campaign-highlight' : ''}`}
                    style={{ scrollMarginTop: '90px' }}
                  >
                    <CampaignCard
                      id={`campaign-${campaign.id}`}
                      camp={campaign}
                      onDonate={() => onConnect()}
                      userRole="PUBLIC"
                      walletAddress=""
                      contract={contract}
                      onOpenNgoProfile={onOpenNgoProfile}
                    />
                  </div>
                ))}
              </div>

              {/* Modern Pagination Bar */}
              {totalPages > 1 && (
                <div className="bbdrts-pagination-row">
                  <div className="bbdrts-pagination-info">
                    Showing <strong>{((currentPage - 1) * CAMPAIGNS_PER_PAGE) + 1}–{Math.min(currentPage * CAMPAIGNS_PER_PAGE, processedCampaigns.length)}</strong> of <strong>{processedCampaigns.length}</strong> active causes
                  </div>

                  <div className="bbdrts-pagination-controls">
                    <button
                      type="button"
                      className="bbdrts-page-btn"
                      onClick={() => {
                        setCurrentPage(prev => Math.max(1, prev - 1));
                        document.getElementById('campaigns')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      disabled={currentPage === 1}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>chevron_left</span>
                      <span>Prev</span>
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                      <button
                        key={pageNum}
                        type="button"
                        className={`bbdrts-page-num ${currentPage === pageNum ? 'active' : ''}`}
                        onClick={() => {
                          setCurrentPage(pageNum);
                          document.getElementById('campaigns')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                      >
                        {pageNum}
                      </button>
                    ))}

                    <button
                      type="button"
                      className="bbdrts-page-btn"
                      onClick={() => {
                        setCurrentPage(prev => Math.min(totalPages, prev + 1));
                        document.getElementById('campaigns')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      disabled={currentPage === totalPages}
                    >
                      <span>Next</span>
                      <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>chevron_right</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </section>

      {/* ── 5. How It Works (The 4 Steps) ── */}
      <section className="bbdrts-lifecycle-section" id="how-it-works">
        <div className="container">

          <div className="bbdrts-lifecycle-header">
            <div className="bbdrts-section-eyebrow">SYSTEM WORKFLOW</div>
            <h2 className="bbdrts-section-title">How Donations Are Protected in 4 Steps</h2>
            <p className="bbdrts-section-desc">
              From donation to field delivery, every step is recorded to prevent misuse of funds.
            </p>
          </div>

          <div className="bbdrts-lifecycle-grid">
            <div className="bbdrts-lifecycle-card">
              <div className="bbdrts-step-num">STEP 01</div>
              <div className="bbdrts-step-icon">
                <span className="material-symbols-outlined">domain_verification</span>
              </div>
              <h3 className="bbdrts-step-title">Verified Campaign Creation</h3>
              <p className="bbdrts-step-desc">
                Only verified organizations can create campaigns. Each campaign includes a target budget, location, and planned milestones.
              </p>
            </div>

            <div className="bbdrts-lifecycle-card">
              <div className="bbdrts-step-num">STEP 02</div>
              <div className="bbdrts-step-icon">
                <span className="material-symbols-outlined">currency_exchange</span>
              </div>
              <h3 className="bbdrts-step-title">Donation via E-Wallet or Crypto</h3>
              <p className="bbdrts-step-desc">
                Donors give easily using GCash, Maya, Bank Transfer, or Sepolia ETH. 100% of the donation goes toward the campaign.
              </p>
            </div>

            <div className="bbdrts-lifecycle-card">
              <div className="bbdrts-step-num">STEP 03</div>
              <div className="bbdrts-step-icon">
                <span className="material-symbols-outlined">shield_locked</span>
              </div>
              <h3 className="bbdrts-step-title">Funds Held in Smart Contract</h3>
              <p className="bbdrts-step-desc">
                Donations are locked in a Solidity smart contract escrow. The organization cannot withdraw all funds at once.
              </p>
            </div>

            <div className="bbdrts-lifecycle-card">
              <div className="bbdrts-step-num">STEP 04</div>
              <div className="bbdrts-step-icon">
                <span className="material-symbols-outlined">document_scanner</span>
              </div>
              <h3 className="bbdrts-step-title">Milestone & Receipt Verification</h3>
              <p className="bbdrts-step-desc">
                To unlock subsequent funds, relief teams upload official receipts and delivery photos verified by OCR text scanning.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* ── 6. Payment Methods (GCash, Maya, Bank, Crypto) ── */}
      <section className="bbdrts-rails-section" id="payment-rails">
        <div className="container">
          <div className="bbdrts-section-header-centered">
            <div className="bbdrts-section-eyebrow">PAYMENT METHODS</div>
            <h2 className="bbdrts-section-title">Donate Using Familiar Payment Options</h2>
            <p className="bbdrts-section-desc" style={{ maxWidth: '680px', margin: '0 auto' }}>
              You do not need cryptocurrency experience to help. We support the standard payment methods Filipinos use daily.
            </p>
          </div>

          <div className="bbdrts-rails-grid">
            <div className="bbdrts-rail-card gcash">
              <div className="bbdrts-rail-header">
                <div className="bbdrts-rail-badge gcash">GCash</div>
                <span className="bbdrts-rail-meta">Instant Mobile QR</span>
              </div>
              <h4 className="bbdrts-rail-title">Scan-to-Donate via QR Ph</h4>
              <p className="bbdrts-rail-desc">
                Donate directly from your GCash mobile wallet using standard QR Ph. Instant receipt verification and zero processing deduction.
              </p>
              <div className="bbdrts-rail-features">
                <span>✓ Zero platform fees</span>
                <span>✓ Instant SMS receipt</span>
              </div>
            </div>

            <div className="bbdrts-rail-card maya">
              <div className="bbdrts-rail-header">
                <div className="bbdrts-rail-badge maya">Maya</div>
                <span className="bbdrts-rail-meta">Digital Banking</span>
              </div>
              <h4 className="bbdrts-rail-title">Maya E-Wallet & Cards</h4>
              <p className="bbdrts-rail-desc">
                Contribute seamlessly with your Maya wallet, Maya Mastercard, or Visa debit card with live milestone tracking.
              </p>
              <div className="bbdrts-rail-features">
                <span>✓ Debit/Credit card support</span>
                <span>✓ Fast bank sync</span>
              </div>
            </div>

            <div className="bbdrts-rail-card bank">
              <div className="bbdrts-rail-header">
                <div className="bbdrts-rail-badge bank">Bank Transfer</div>
                <span className="bbdrts-rail-meta">InstaPay / PESONet</span>
              </div>
              <h4 className="bbdrts-rail-title">Direct Philippine Banks</h4>
              <p className="bbdrts-rail-desc">
                Supports all major domestic financial institutions including BDO, BPI, UnionBank, Metrobank, and LandBank.
              </p>
              <div className="bbdrts-rail-features">
                <span>✓ 24/7 InstaPay clearance</span>
                <span>✓ Large corporate grants</span>
              </div>
            </div>

            <div className="bbdrts-rail-card crypto">
              <div className="bbdrts-rail-header">
                <div className="bbdrts-rail-badge crypto">Ethereum Web3</div>
                <span className="bbdrts-rail-meta">Sepolia EVM Escrow</span>
              </div>
              <h4 className="bbdrts-rail-title">Native Smart Contract Rails</h4>
              <p className="bbdrts-rail-desc">
                Send ETH or ERC-20 tokens directly into audited Solidity smart contracts via MetaMask with immutable Etherscan proof.
              </p>
              <div className="bbdrts-rail-features">
                <span>✓ 100% decentralized escrow</span>
                <span>✓ On-chain Donor NFT tier</span>
              </div>
              <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                <a
                  href="https://metamask.io/download/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '0.78rem',
                    color: 'var(--text-secondary, #888888)',
                    textDecoration: 'none',
                    fontWeight: 500
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#f59e0b' }}>download</span>
                  <span>Install MetaMask Extension ↗</span>
                </a>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── 7. Who Is This For? (Donors vs Organizations) ── */}
      <section className="bbdrts-personas-section">
        <div className="container">
          <div className="bbdrts-personas-grid">

            {/* Persona A: For Donors */}
            <div className="bbdrts-persona-card donor">
              <div className="bbdrts-persona-badge">
                <span className="material-symbols-outlined">favorite</span>
                <span>For Donors & Citizens</span>
              </div>
              <h3 className="bbdrts-persona-title">Give with Peace of Mind</h3>
              <p className="bbdrts-persona-desc">
                Know where every peso goes. Track relief shipments on the map, view uploaded store receipts, and receive verified donor badges.
              </p>
              <div className="bbdrts-persona-actions">
                <a href="#campaigns" className="bbdrts-btn-primary">
                  <span>Browse Relief Appeals</span>
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>arrow_forward</span>
                </a>
                <button type="button" className="bbdrts-btn-secondary" onClick={onSignIn || onConnect}>
                  <span>Sign In as Donor</span>
                </button>
              </div>
            </div>

            {/* Persona B: For Relief NGOs */}
            <div className="bbdrts-persona-card ngo">
              <div className="bbdrts-persona-badge">
                <span className="material-symbols-outlined">corporate_fare</span>
                <span>For Relief Organizations</span>
              </div>
              <h3 className="bbdrts-persona-title">Launch Relief Campaigns Fast</h3>
              <p className="bbdrts-persona-desc">
                Submit organization accreditation credentials. Launch disaster relief appeals quickly, receive donor support with 0% platform fees, and request milestone fund releases.
              </p>
              <div className="bbdrts-persona-actions">
                <button type="button" className="bbdrts-btn-primary" onClick={onSignUp || onConnect}>
                  <span>Register Organization</span>
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>verified</span>
                </button>
                <button
                  type="button"
                  className="bbdrts-btn-secondary"
                  onClick={() => onOpenNgoProfile && onOpenNgoProfile(3)}
                >
                  <span>View Verified NGO Profile ↗</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 8. Smart Contract Transparency Dock ── */}
      <section className="bbdrts-contract-strip" id="transparency">
        <div className="container">
          <div className="bbdrts-contract-box">

            <div className="bbdrts-contract-info">
              <div className="bbdrts-contract-icon-box">
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>terminal</span>
              </div>
              <div>
                <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Verified Smart Contract on Sepolia Testnet</span>
                  <span className="bbdrts-solidity-badge">Solidity 0.8.20</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Milestone Escrow · Saint Joseph College CCS Capstone Project
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span className="bbdrts-contract-addr">{contractAddress}</span>
              <button
                type="button"
                onClick={handleCopyContract}
                className="bbdrts-btn-secondary bbdrts-btn-compact"
                title="Copy Contract Address"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                  {contractCopied ? 'check' : 'content_copy'}
                </span>
                <span>{contractCopied ? 'Copied!' : 'Copy'}</span>
              </button>
              <a
                href={`https://sepolia.etherscan.io/address/${contractAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bbdrts-btn-secondary bbdrts-btn-compact"
              >
                <span>Sepolia Etherscan ↗</span>
              </a>
            </div>

          </div>
        </div>
      </section>

      {/* ── 9. Frequently Asked Questions (Accordion) ── */}
      <section className="bbdrts-faq-section" id="faq">
        <div className="container" style={{ maxWidth: '820px' }}>
          <div className="bbdrts-section-header-centered" style={{ marginBottom: '36px' }}>
            <div className="bbdrts-section-eyebrow">QUESTIONS & ANSWERS</div>
            <h2 className="bbdrts-section-title">Frequently Asked Questions</h2>
            <p className="bbdrts-section-desc">
              Common questions about how BBDRTS protects donations and tracks disaster relief.
            </p>
          </div>

          <div className="bbdrts-faq-list">
            <div className={`bbdrts-faq-item ${openFaqIndex === 0 ? 'open' : ''}`}>
              <button type="button" className="bbdrts-faq-question" onClick={() => toggleFaq(0)}>
                <span>How does BBDRTS prevent fund misuse or theft?</span>
                <span className="material-symbols-outlined faq-icon">
                  {openFaqIndex === 0 ? 'remove' : 'add'}
                </span>
              </button>
              {openFaqIndex === 0 && (
                <div className="bbdrts-faq-answer">
                  <p>
                    Instead of giving all the money to an organization upfront, donations are held in a smart contract escrow. Funds are released in milestones. The organization must upload receipts and photos showing how the previous batch of money was spent before getting the next batch.
                  </p>
                </div>
              )}
            </div>

            <div className={`bbdrts-faq-item ${openFaqIndex === 1 ? 'open' : ''}`}>
              <button type="button" className="bbdrts-faq-question" onClick={() => toggleFaq(1)}>
                <span>Can I donate using GCash or Maya without cryptocurrency?</span>
                <span className="material-symbols-outlined faq-icon">
                  {openFaqIndex === 1 ? 'remove' : 'add'}
                </span>
              </button>
              {openFaqIndex === 1 && (
                <div className="bbdrts-faq-answer">
                  <p>
                    <strong>Yes, absolutely.</strong> The system supports direct donations through GCash, Maya, and bank transfers via QR Ph and InstaPay. The transaction is recorded in the system so the campaign progress updates automatically without requiring a crypto wallet.
                  </p>
                </div>
              )}
            </div>

            <div className={`bbdrts-faq-item ${openFaqIndex === 2 ? 'open' : ''}`}>
              <button type="button" className="bbdrts-faq-question" onClick={() => toggleFaq(2)}>
                <span>How are relief organizations verified?</span>
                <span className="material-symbols-outlined faq-icon">
                  {openFaqIndex === 2 ? 'remove' : 'add'}
                </span>
              </button>
              {openFaqIndex === 2 && (
                <div className="bbdrts-faq-answer">
                  <p>
                    Before an organization can launch a campaign, administrators verify their official registration documents (such as SEC registration or DSWD authority to solicit) and contact details. Every approved organization has a public profile where donors can inspect their credentials.
                  </p>
                </div>
              )}
            </div>

            <div className={`bbdrts-faq-item ${openFaqIndex === 3 ? 'open' : ''}`}>
              <button type="button" className="bbdrts-faq-question" onClick={() => toggleFaq(3)}>
                <span>How does the receipt scanning feature work?</span>
                <span className="material-symbols-outlined faq-icon">
                  {openFaqIndex === 3 ? 'remove' : 'add'}
                </span>
              </button>
              {openFaqIndex === 3 && (
                <div className="bbdrts-faq-answer">
                  <p>
                    When relief workers purchase supplies (like rice, canned goods, or medicine), they upload a photo of the official merchant receipt. The system uses optical character recognition (OCR) with Tesseract.js to read the total amount, date, and vendor details, helping verify the expense against the campaign budget before releasing the next milestone.
                  </p>
                </div>
              )}
            </div>

            <div className={`bbdrts-faq-item ${openFaqIndex === 4 ? 'open' : ''}`}>
              <button type="button" className="bbdrts-faq-question" onClick={() => toggleFaq(4)}>
                <span>Does BBDRTS deduct any platform fees?</span>
                <span className="material-symbols-outlined faq-icon">
                  {openFaqIndex === 4 ? 'remove' : 'add'}
                </span>
              </button>
              {openFaqIndex === 4 && (
                <div className="bbdrts-faq-answer">
                  <p>
                    <strong>Zero platform fees (0%).</strong> BBDRTS was created as a capstone thesis project at Saint Joseph College to promote transparency in disaster response. 100% of contributed funds are allocated directly to verified relief operations.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── 10. Simple Bottom Call to Action ── */}
      <section className="bbdrts-cta-section">
        <div className="container">
          <div className="bbdrts-cta-badge">
            <span className="bbdrts-pulse-beacon" />
            <span>SAINT JOSEPH COLLEGE CCS CAPSTONE PROJECT</span>
          </div>
          <h2 className="bbdrts-cta-title">Help Bring Transparent Relief to the Philippines</h2>
          <p className="bbdrts-cta-desc">
            Support frontline disaster relief drives, track donations on the map, or register your organization to help communities in need.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button type="button" className="bbdrts-btn-primary" onClick={onSignIn || onConnect}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>login</span>
              <span>Launch Relief Portal</span>
            </button>
            <a href="#campaigns" className="bbdrts-btn-secondary">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>search</span>
              <span>Browse Campaigns</span>
            </a>
            <a href="#radar-heatmap" className="bbdrts-btn-secondary">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>map</span>
              <span>View Disaster Map</span>
            </a>
          </div>
        </div>
      </section>

    </div>
  );
}
