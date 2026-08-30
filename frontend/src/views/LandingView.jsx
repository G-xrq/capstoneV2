import { useState, useEffect, useMemo } from 'react';
import CampaignCard from '../components/CampaignCard';
import { contractAddress } from '../contractConfig';
import './LandingView.css';

export default function LandingView({ onConnect, hasMetaMask, contract, onOpenNgoProfile }) {
  const [stats, setStats] = useState({
    donors: 0,
    orgs: 0,
    campaigns: 0,
    totalEthRaised: '0.00'
  });

  const [campaigns, setCampaigns] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [contractCopied, setContractCopied] = useState(false);

  const handleCopyContract = () => {
    navigator.clipboard.writeText(contractAddress);
    setContractCopied(true);
    setTimeout(() => setContractCopied(false), 2000);
  };

  useEffect(() => {
    const fetchLandingData = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        
        // Fetch real database counts and live campaigns in parallel
        const [statsRes, campsRes] = await Promise.all([
          fetch(`${apiUrl}/api/public-stats`).catch(() => null),
          fetch(`${apiUrl}/api/campaigns`).catch(() => null)
        ]);

        let realDbStats = { donors: 0, orgs: 0, campaigns: 0 };
        if (statsRes && statsRes.ok) {
          realDbStats = await statsRes.json();
        }

        if (campsRes && campsRes.ok) {
          const data = await campsRes.json();
          setCampaigns(data);

          const ethSum = data.reduce((sum, c) => sum + parseFloat(c.currentAmount || 0), 0);
          setStats({
            donors: realDbStats.donors || 0,
            orgs: realDbStats.orgs || 0,
            campaigns: data.length || realDbStats.campaigns || 0,
            totalEthRaised: ethSum > 0 ? ethSum.toFixed(2) : '0.00'
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

  // Pagination state (2 causes per page)
  const [currentPage, setCurrentPage] = useState(1);
  const CAMPAIGNS_PER_PAGE = 2;

  // Filtered campaigns based on category & search query
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(c => {
      const matchCategory = activeCategory === 'ALL' || 
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
  }, [campaigns, activeCategory, searchQuery]);

  // Reset to page 1 whenever filters or search query change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory, searchQuery]);

  const totalPages = Math.ceil(filteredCampaigns.length / CAMPAIGNS_PER_PAGE) || 1;

  const paginatedCampaigns = useMemo(() => {
    const start = (currentPage - 1) * CAMPAIGNS_PER_PAGE;
    return filteredCampaigns.slice(start, start + CAMPAIGNS_PER_PAGE);
  }, [filteredCampaigns, currentPage]);

  return (
    <div className="bbdrts-landing-root" id="top">
      
      {/* Ambient Lighting */}
      <div className="bbdrts-ambient-glow" />

      {/* ── 1. Centered Minimalist Hero ── */}
      <section className="bbdrts-hero-section">
        <div className="container">
          <div className="bbdrts-hero-content">
            
            <div className="bbdrts-hero-badge">
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>verified</span>
              <span>Saint Joseph College CCS · Capstone 2026</span>
            </div>

            <h1 className="bbdrts-hero-title">
              Transparent Donation & Relief{' '}
              <span className="bbdrts-hero-title-gradient">Powered by Blockchain</span>
            </h1>

            <p className="bbdrts-hero-lead">
              An open, immutable donation and relief transparency platform deployed on Ethereum Sepolia EVM. Ensuring 100% verifiable fund distribution to accredited humanitarian, charitable, and disaster response operations across the Philippines.
            </p>

            <div className="bbdrts-hero-actions">
              <a href="#campaigns" className="bbdrts-btn-primary">
                <span className="material-symbols-outlined">volunteer_activism</span>
                <span>Explore Relief Causes</span>
              </a>
              <button type="button" className="bbdrts-btn-secondary" onClick={onConnect}>
                <span className="material-symbols-outlined">login</span>
                <span>Access System Portal</span>
              </button>
            </div>

            {/* Clean Minimalist Stat Strip */}
            <div className="bbdrts-stats-strip">
              <div className="bbdrts-stat-item">
                <div className="bbdrts-stat-val">{stats.donors}</div>
                <div className="bbdrts-stat-lbl">Registered Donors</div>
              </div>
              <div 
                className="bbdrts-stat-item" 
                style={{ cursor: 'pointer' }}
                onClick={() => onOpenNgoProfile && onOpenNgoProfile()}
                title="Click to view Verified NGO Institutional Profile"
              >
                <div className="bbdrts-stat-val" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>{stats.orgs}</div>
                <div className="bbdrts-stat-lbl" style={{ color: 'var(--accent)' }}>Accredited NGOs ↗</div>
              </div>
              <div className="bbdrts-stat-item">
                <div className="bbdrts-stat-val">{stats.campaigns}</div>
                <div className="bbdrts-stat-lbl">Active Causes</div>
              </div>
              <div className="bbdrts-stat-item">
                <div className="bbdrts-stat-val">{stats.totalEthRaised} ETH</div>
                <div className="bbdrts-stat-lbl">Total Funds Raised</div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 2. Active Relief Operations Showcase ── */}
      <section className="bbdrts-campaigns-section" id="campaigns">
        <div className="container">
          
          <div className="bbdrts-section-header">
            <div>
              <h2 className="bbdrts-section-title">Active Humanitarian Relief Campaigns</h2>
              <p className="bbdrts-section-desc">
                Verified disaster response missions with live on-chain fund tracking.
              </p>
            </div>
          </div>

          {/* Clean Filter & Search Toolbar */}
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
            </div>

            <div className="bbdrts-search-input-wrap">
              <span className="material-symbols-outlined" style={{ fontSize: '17px', color: 'var(--text-muted)' }}>search</span>
              <input 
                type="text" 
                placeholder="Search causes or regions..." 
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

          {/* Campaign Cards List */}
          {loadingCampaigns ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div className="spinner" style={{ margin: '0 auto 16px', width: '36px', height: '36px' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading relief campaigns...</p>
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '42px', color: 'var(--text-muted)', marginBottom: '8px' }}>search_off</span>
              <h3 style={{ color: '#ffffff', marginBottom: '6px', fontSize: '1.1rem' }}>No Matching Causes</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem' }}>Try clearing your search query or selecting another filter.</p>
            </div>
          ) : (
            <>
              <div className="campaigns-list" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {paginatedCampaigns.map(campaign => (
                  <CampaignCard
                    key={campaign.id}
                    camp={campaign}
                    onDonate={() => onConnect()}
                    userRole="PUBLIC"
                    walletAddress=""
                    contract={contract}
                    onOpenNgoProfile={onOpenNgoProfile}
                  />
                ))}
              </div>

              {/* Pagination Controls Bar */}
              {totalPages > 1 && (
                <div className="bbdrts-pagination-row">
                  <div className="bbdrts-pagination-info">
                    Showing <strong>{((currentPage - 1) * CAMPAIGNS_PER_PAGE) + 1}–{Math.min(currentPage * CAMPAIGNS_PER_PAGE, filteredCampaigns.length)}</strong> of <strong>{filteredCampaigns.length}</strong> relief causes
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
                      title="Previous Page"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>chevron_left</span>
                      <span>Previous</span>
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
                      title="Next Page"
                    >
                      <span>Next</span>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>chevron_right</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </section>

      {/* ── 3. How BBDRTS Works ── */}
      <section className="bbdrts-lifecycle-section" id="how-it-works">
        <div className="container">
          
          <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
            <h2 className="bbdrts-section-title">How It Works</h2>
            <p className="bbdrts-section-desc">
              A transparent 4-step lifecycle safeguarding every peso and ether contributed.
            </p>
          </div>

          <div className="bbdrts-lifecycle-grid">
            
            <div className="bbdrts-lifecycle-card">
              <div className="bbdrts-step-num">STEP 01</div>
              <h3 className="bbdrts-step-title">Accredited Deployment</h3>
              <p className="bbdrts-step-desc">
                Verified relief non-profits submit disaster causes with verified GPS coordinates and itemized budgets.
              </p>
            </div>

            <div className="bbdrts-lifecycle-card">
              <div className="bbdrts-step-num">STEP 02</div>
              <h3 className="bbdrts-step-title">Multi-Rail Contribution</h3>
              <p className="bbdrts-step-desc">
                Donors contribute through Web3 MetaMask (ETH) or Instant Fiat rails (GCash, Maya, Bank Transfer).
              </p>
            </div>

            <div className="bbdrts-lifecycle-card">
              <div className="bbdrts-step-num">STEP 03</div>
              <h3 className="bbdrts-step-title">Smart Contract Escrow</h3>
              <p className="bbdrts-step-desc">
                Funds are secured in audited Solidity contracts on Sepolia EVM, preventing unauthorized withdrawal.
              </p>
            </div>

            <div className="bbdrts-lifecycle-card">
              <div className="bbdrts-step-num">STEP 04</div>
              <h3 className="bbdrts-step-title">Milestone Proof Release</h3>
              <p className="bbdrts-step-desc">
                Aid is released upon cryptographic proof of delivery, permanently verifiable on Sepolia Etherscan.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ── 4. Smart Contract Transparency Strip ── */}
      <section className="bbdrts-contract-strip" id="transparency">
        <div className="container">
          <div className="bbdrts-contract-box">
            
            <div className="bbdrts-contract-info">
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#22c55e' }}>verified</span>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#ffffff' }}>
                  Verified Sepolia Smart Contract
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Solidity 0.8.20 · 0% Intermediary Fee
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span className="bbdrts-contract-addr">{contractAddress}</span>
              <button 
                type="button" 
                onClick={handleCopyContract}
                className="bbdrts-btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                title="Copy Address"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                  {contractCopied ? 'check' : 'content_copy'}
                </span>
                <span>{contractCopied ? 'Copied' : 'Copy'}</span>
              </button>
              <a 
                href={`https://sepolia.etherscan.io/address/${contractAddress}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="bbdrts-btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                <span>Etherscan</span>
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>open_in_new</span>
              </a>
            </div>

          </div>
        </div>
      </section>

      {/* ── 5. Minimalist CTA ── */}
      <section className="bbdrts-cta-section">
        <div className="container">
          <h2 className="bbdrts-cta-title">Join the Transparent Relief Network</h2>
          <p className="bbdrts-cta-desc">
            Support disaster response missions in the Philippines with complete cryptographic auditability.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <button type="button" className="bbdrts-btn-primary" onClick={onConnect}>
              <span className="material-symbols-outlined">login</span>
              <span>Launch Portal</span>
            </button>
            <a href="#campaigns" className="bbdrts-btn-secondary">
              <span className="material-symbols-outlined">volunteer_activism</span>
              <span>Browse Causes</span>
            </a>
          </div>
        </div>
      </section>

    </div>
  );
}
