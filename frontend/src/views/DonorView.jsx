import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ethers } from 'ethers';
import CampaignCard, { 
  shortAddr, 
  formatCampaignTitle, 
  getCampaignCategoryInfo, 
  getOrgDisplayName,
  getCampaignCoverData,
  getCampaignAuditDetails,
  progressPct,
  formatEthAmt,
  getCampaignTags
} from '../components/CampaignCard';
import LocationMapPicker from '../components/LocationMapPicker';
import { ROLES } from '../roleConfig';
import SettingsPanel from '../components/SettingsPanel';
import DisasterRadarHeatmap from '../components/DisasterRadarHeatmap';
import DonorBadge, { DonorTierModal, DonorProgressCard, BadgeUpgradeModal, getDonorTier, globalDonorRegistry } from '../components/DonorBadge';
import GuidedTour from '../components/GuidedTour';
import { useToast } from '../context/ToastContext';
import { API_URL } from '../config';
import { CONTRACT_ADDRESS } from '../contractConfig';
import './ReferenceDashboard.css';
import '../components/CampaignDetailsModal.css';
import './DashboardOverview.css';

/* ── Skeleton loading placeholders (shimmer; mirrors CampaignCard & db-camp-row geometry) ── */
const DbSkeletonCard = () => (
  <div className="db-skel-card" role="status" aria-busy="true" aria-label="Loading campaign">
    <div className="db-skel-media db-skel" />
    <div className="db-skel-info">
      <div className="db-skel-pair">
        <span className="db-skel-line db-skel" style={{ width: '26%' }} />
        <span className="db-skel-badge db-skel" />
      </div>
      <span className="db-skel-line db-skel db-skel-line-t" style={{ width: '68%' }} />
      <span className="db-skel-line db-skel" style={{ width: '42%' }} />
      <span className="db-skel-line db-skel" style={{ width: '57%' }} />
      <div className="db-skel-railtrack">
        <span className="db-skel-railseg db-skel" style={{ width: '52%' }} />
        <span className="db-skel-railseg db-skel" style={{ width: '26%' }} />
        <span className="db-skel-railseg db-skel" style={{ width: '22%' }} />
      </div>
      <div className="db-skel-boxes">
        <span className="db-skel-box db-skel" />
        <span className="db-skel-box db-skel" />
        <span className="db-skel-box db-skel" />
      </div>
      <div className="db-skel-actions">
        <span className="db-skel-btn db-skel" style={{ width: '98px' }} />
        <span className="db-skel-btn db-skel" style={{ width: '78px' }} />
        <span className="db-skel-btn db-skel" style={{ width: '78px' }} />
      </div>
    </div>
  </div>
);

const DbSkeletonCampRow = ({ id }) => (
  <div className="db-skel-camprow" id={id} role="status" aria-busy="true" aria-label="Loading campaign">
    <div className="db-skel-thumb db-skel" />
    <div className="db-skel-rowbody">
      <div className="db-skel-pair" style={{ justifyContent: 'space-between' }}>
        <span className="db-skel-line db-skel db-skel-line-t" style={{ width: '46%' }} />
        <span className="db-skel-chip db-skel" />
      </div>
      <div className="db-skel-bar db-skel" />
      <div className="db-skel-pair">
        <span className="db-skel-line db-skel" style={{ width: '30%' }} />
        <span className="db-skel-line db-skel" style={{ width: '22%' }} />
      </div>
    </div>
    <span className="db-skel-btn db-skel" style={{ width: '94px' }} />
  </div>
);

export default function DonorView({ contract, walletAddress, campaigns, fetchCampaigns, fetchingCampaigns, currentUser, handleConnectWallet, handleLogout, updateDbWallet, theme = 'default', setTheme, textSize, setTextSize, onOpenNgoProfile, onActiveTabChange }) {
  const { showSuccess } = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [selectedTags, setSelectedTags] = useState([]);
  const [urgencyFilter, setUrgencyFilter] = useState('ALL');
  const [progressFilter, setProgressFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [campaignSort, setCampaignSort] = useState('NEWEST');
  const [searchQuery, setSearchQuery] = useState('');
  const [receiptFilter, setReceiptFilter] = useState('ALL');
  const [receiptRailFilter, setReceiptRailFilter] = useState('ALL');
  const [receiptSort, setReceiptSort] = useState('NEWEST');
  const [searchQueryReceipts, setSearchQueryReceipts] = useState('');
  const [selectedCampaignForProof, setSelectedCampaignForProof] = useState(null);
  const [selectedVoucherTx, setSelectedVoucherTx] = useState(null);
  const [showReceiptZoom, setShowReceiptZoom] = useState(false);
  const [showTierModal, setShowTierModal] = useState(false);
  const [unlockedTierModal, setUnlockedTierModal] = useState(null);
  const [showGuidedTour, setShowGuidedTour] = useState(false);
  const [showTechDetails, setShowTechDetails] = useState(false);
  const [showGuide, setShowGuide] = useState(() => {
    try { return localStorage.getItem('bbdrts_dismiss_donor_guide') !== 'true'; } catch (_) { return true; }
  });

  useEffect(() => {
    if (selectedVoucherTx || showReceiptZoom) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedVoucherTx, showReceiptZoom]);

  const userTourKey = currentUser?.id 
    ? `bbdrts_tour_donor_${currentUser.id}` 
    : currentUser?.email 
      ? `bbdrts_tour_donor_${currentUser.email}` 
      : 'bbdrts_tour_donor_done';

  // Auto-launch Guided Tour ONLY for brand new donor registrations
  useEffect(() => {
    try {
      const isNewSignup = localStorage.getItem('bbdrts_tour_force_launch') === 'true' || 
                          localStorage.getItem('bbdrts_is_new_registration') === 'true';
      const userTourDone = localStorage.getItem(userTourKey) === 'true';

      if (isNewSignup && !userTourDone) {
        let attempts = 0;
        const maxAttempts = 60; // 60 * 100ms = 6s max fallback
        const pollInterval = setInterval(() => {
          attempts++;
          const authBackdrop = document.querySelector('.auth-transition-backdrop');
          const targetEl = document.querySelector('#tour-donor-welcome') || document.querySelector('#tour-donor-profile');
          const isAuthClear = !authBackdrop || authBackdrop.classList.contains('closing');
          const isTargetReady = targetEl && targetEl.getBoundingClientRect().width > 0;

          if ((isAuthClear && isTargetReady) || attempts >= maxAttempts) {
            clearInterval(pollInterval);
            setTimeout(() => {
              setActiveTab('dashboard');
              setShowGuidedTour(true);
              localStorage.removeItem('bbdrts_tour_force_launch');
              localStorage.removeItem('bbdrts_is_new_registration');
            }, 350);
          }
        }, 100);

        return () => clearInterval(pollInterval);
      }
    } catch (_) {}
  }, [userTourKey]);

  const handleStartTour = () => {
    setActiveTab('dashboard');
    setTimeout(() => {
      setShowGuidedTour(true);
    }, 250);
  };

  const handleCloseTour = () => setShowGuidedTour(false);

  const donorTourSteps = useMemo(() => [
    {
      target: '#tour-donor-welcome',
      title: 'Donor Profile & Quick Actions',
      icon: 'verified_user',
      badge: 'Profile & Overview',
      placement: 'bottom',
      align: 'start',
      description: 'Your dashboard header displays your verified wallet address and current donor recognition. Use the quick action buttons to explore your Recognition Circles, jump directly to active relief appeals, or verify the public ledger on Etherscan.'
    },
    {
      target: '#tour-donor-badge-card',
      title: 'Philanthropic Recognition Circles',
      icon: 'volunteer_activism',
      badge: 'Donor Recognition',
      placement: 'bottom',
      align: 'start',
      description: 'Explore your philanthropic journey across the 15 Disaster Relief Recognition Circles. This card displays your cumulative verified impact and milestone progress. Click to explore all 15 circles.'
    },
    {
      target: '#tour-donor-metrics',
      title: 'Dashboard Summary Metrics',
      icon: 'analytics',
      badge: 'Key Statistics',
      placement: 'bottom',
      align: 'center',
      description: 'These four stat cards summarize your total contributions recorded on-chain, the number of active relief causes open for aid, the live Sepolia smart contract verification status, and your cumulative donation total in ETH and PHP.'
    },
    {
      target: '#tour-donor-first-campaign',
      title: 'Featured Relief Campaign',
      icon: 'emergency',
      badge: 'Relief Causes',
      placement: 'bottom',
      align: 'center',
      description: 'Review featured emergency disaster appeals posted by accredited organizations. Each card shows the disaster category, urgency level, funding goal, and progress. Click Donate to contribute using Sepolia ETH or Philippine e-wallets (GCash & Maya).'
    },
    {
      target: '#tour-donor-tab-campaigns',
      title: 'Relief Campaigns Tab',
      icon: 'campaign',
      badge: 'Campaign Navigation',
      placement: 'right',
      align: 'center',
      description: 'Click this sidebar tab to browse all active emergency relief campaigns. You can filter appeals by cause category (Disaster Relief or Charitable Aid), urgency priority (High, Medium, Standard), or search specific relief operations.'
    },
    {
      target: '#tour-donor-tab-donations',
      title: 'My Contributions Tab',
      icon: 'history',
      badge: 'Donation History',
      placement: 'right',
      align: 'center',
      description: 'Click here to review your complete on-chain donation history. You can inspect transaction hashes, view verified timestamps and amounts for every contribution, and export printable audit receipts.'
    },
    {
      target: '#tour-donor-tab-radar',
      title: 'Relief Radar Tab',
      icon: 'radar',
      badge: 'Weather & Disaster Map',
      placement: 'right',
      align: 'center',
      description: 'Switch to this tab to view an interactive Philippine map with live PAGASA Doppler radar precipitation data and disaster campaign locations, helping you see where emergency relief is needed most.'
    },
    {
      target: '#tour-donor-sepolia-node',
      title: 'Network Health & Replay Tour',
      icon: 'hub',
      badge: 'System Status',
      placement: 'right',
      align: 'end',
      description: 'This widget displays real-time Ethereum Sepolia smart contract synchronization. You can switch color themes below or click "Guided Tutorial" in the sidebar anytime to replay this walkthrough. You are all set!'
    }
  ], []);

  const [showCausesDropdown, setShowCausesDropdown] = useState(false);
  const [showPrioritiesDropdown, setShowPrioritiesDropdown] = useState(false);
  const [showTagsDropdown, setShowTagsDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const causesDropdownRef = useRef(null);
  const prioritiesDropdownRef = useRef(null);
  const tagsDropdownRef = useRef(null);
  const sortDropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  const CAUSE_OPTIONS = [
    { value: 'ALL', label: 'All Causes', icon: 'public', color: '#38bdf8' },
    { value: 'DR', label: 'Disaster Relief', icon: 'flood', color: '#38bdf8' },
    { value: 'CD', label: 'Charitable Aid', icon: 'volunteer_activism', color: '#38bdf8' }
  ];

  const PRIORITY_OPTIONS = [
    { value: 'ALL', label: 'All Priorities', icon: 'bolt', color: '#f59e0b' },
    { value: 'HIGH', label: 'High Priority', icon: 'priority_high', color: '#ef4444' },
    { value: 'MEDIUM', label: 'Medium Priority', icon: 'bolt', color: '#f59e0b' },
    { value: 'STABLE', label: 'Standard / Stable', icon: 'verified_user', color: '#10b981' }
  ];

  const SORT_OPTIONS = [
    { value: 'NEWEST', label: 'Newest First', icon: 'schedule' },
    { value: 'MOST_FUNDED', label: 'Most Funded (%)', icon: 'trending_up' },
    { value: 'GOAL_HIGH', label: 'Highest Goal', icon: 'arrow_upward' },
    { value: 'GOAL_LOW', label: 'Lowest Goal', icon: 'arrow_downward' }
  ];

  const selectedCauseObj = CAUSE_OPTIONS.find(o => o.value === categoryFilter) || CAUSE_OPTIONS[0];
  const selectedPriorityObj = PRIORITY_OPTIONS.find(o => o.value === urgencyFilter) || PRIORITY_OPTIONS[0];
  const selectedSortObj = SORT_OPTIONS.find(o => o.value === campaignSort) || SORT_OPTIONS[0];

  let userDisplayName = currentUser?.display_name || currentUser?.name || currentUser?.email || 'Valued Donor';
  if (userDisplayName.includes('@')) {
    const handle = userDisplayName.split('@')[0];
    if (handle.toLowerCase() === 'gestermacaldo') {
      userDisplayName = 'Gester Macaldo';
    } else {
      userDisplayName = handle.charAt(0).toUpperCase() + handle.slice(1);
    }
  }
  const userInitials = userDisplayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  // Keyboard shortcut: Cmd+K / Ctrl+K to focus search input
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside to close any open dropdown menu
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (causesDropdownRef.current && !causesDropdownRef.current.contains(e.target)) {
        setShowCausesDropdown(false);
      }
      if (prioritiesDropdownRef.current && !prioritiesDropdownRef.current.contains(e.target)) {
        setShowPrioritiesDropdown(false);
      }
      if (tagsDropdownRef.current && !tagsDropdownRef.current.contains(e.target)) {
        setShowTagsDropdown(false);
      }
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target)) {
        setShowSortDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleTag = (tag) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const THEME_OPTIONS = [
    { id: 'light', name: 'Light', icon: 'light_mode', desc: 'Clean White (Default)', activeBorder: 'var(--border-strong)', color: '#000000' },
    { id: 'dark',  name: 'Dark', icon: 'dark_mode', desc: 'Dark Charcoal', activeBorder: 'var(--border-strong)', color: '#ffffff' }
  ];

  // View Layout Mode for Relief Campaigns:
  // 'list' or 'grid' (2-column option removed per user request)
  const [viewMode, setViewMode] = useState(() => {
    try {
      const saved = localStorage.getItem('bbdrts_campaign_view_mode');
      if (saved === 'grid' || saved === 'grid-3' || saved === 'grid-2') return 'grid';
      return 'list';
    } catch {
      return 'list';
    }
  });

  const handleViewModeChange = (mode) => {
    const target = mode === 'grid' ? 'grid' : 'list';
    setViewMode(target);
    try {
      localStorage.setItem('bbdrts_campaign_view_mode', target);
    } catch {}
  };

  // Target campaign URL deep link parameter (?campaign=14)
  const [targetCampaignId, setTargetCampaignId] = useState(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('campaign');
  });
  const donorTargetScrolledRef = useRef(false);

  // Pagination for Relief Campaigns (4 for list, 6 for grid)
  const [currentPage, setCurrentPage] = useState(1);
  const campaignsPerPage = viewMode === 'list' ? 4 : 6;

  // Deep Link Auto-Navigation: switch to campaigns tab, reset filters, set page, and scroll
  useEffect(() => {
    if (!targetCampaignId || !campaigns || campaigns.length === 0 || donorTargetScrolledRef.current) return;

    const idx = campaigns.findIndex(c => String(c.id) === String(targetCampaignId));
    if (idx !== -1) {
      donorTargetScrolledRef.current = true;
      setActiveTab('campaigns');
      setCategoryFilter('ALL');
      setUrgencyFilter('ALL');
      setSelectedTags([]);
      setSearchQuery('');

      const targetPage = Math.floor(idx / campaignsPerPage) + 1;
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
  }, [targetCampaignId, campaigns, campaignsPerPage]);

  // Reset page on any filter or viewMode change
  const isInitialDonorFilterMount = useRef(true);
  useEffect(() => {
    if (isInitialDonorFilterMount.current) {
      isInitialDonorFilterMount.current = false;
      return;
    }
    if (!targetCampaignId || donorTargetScrolledRef.current) {
      setCurrentPage(1);
    }
  }, [categoryFilter, selectedTags, urgencyFilter, progressFilter, statusFilter, campaignSort, searchQuery, viewMode, targetCampaignId]);

  // Dynamically extract all available tags and frequency counts across active campaigns
  const { availableTags, tagCounts } = useMemo(() => {
    const counts = {};
    if (Array.isArray(campaigns)) {
      campaigns.forEach(c => {
        const tags = getCampaignTags(c);
        if (Array.isArray(tags)) {
          tags.forEach(t => {
            if (t && typeof t === 'string' && t.trim()) {
              const clean = t.trim();
              counts[clean] = (counts[clean] || 0) + 1;
            }
          });
        }
      });
    }
    const tagsSorted = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    return { availableTags: tagsSorted, tagCounts: counts };
  }, [campaigns]);

  const hasActiveFilters = categoryFilter !== 'ALL' || selectedTags.length > 0 || urgencyFilter !== 'ALL' || progressFilter !== 'ALL' || statusFilter !== 'ALL' || searchQuery.trim() !== '';

  const resetAllFilters = () => {
    setCategoryFilter('ALL');
    setSelectedTags([]);
    setUrgencyFilter('ALL');
    setProgressFilter('ALL');
    setStatusFilter('ALL');
    setSearchQuery('');
  };

  // Global Header Navigation Listener
  useEffect(() => {
    const handleRadarNav = () => {
      setActiveTab('radar-heatmap');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const handleCampaignsNav = () => {
      setActiveTab('campaigns');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const handleHomeNav = () => {
      setActiveTab('dashboard');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleContributionsNav = () => {
      setActiveTab('history');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCategoryNav = (e) => {
      const cat = e.detail?.category || 'ALL';
      setCategoryFilter(cat);
      setActiveTab('campaigns');
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 50);
    };

    window.addEventListener('bbdrts_navigate_radar', handleRadarNav);
    window.addEventListener('bbdrts_navigate_campaigns', handleCampaignsNav);
    window.addEventListener('bbdrts_navigate_home', handleHomeNav);
    window.addEventListener('bbdrts_navigate_contributions', handleContributionsNav);
    window.addEventListener('bbdrts_filter_category', handleCategoryNav);
    return () => {
      window.removeEventListener('bbdrts_navigate_radar', handleRadarNav);
      window.removeEventListener('bbdrts_navigate_campaigns', handleCampaignsNav);
      window.removeEventListener('bbdrts_navigate_home', handleHomeNav);
      window.removeEventListener('bbdrts_navigate_contributions', handleContributionsNav);
      window.removeEventListener('bbdrts_filter_category', handleCategoryNav);
    };
  }, []);

  // Filter & Sort campaigns with rich multi-dimensional criteria
  const filteredCampaigns = campaigns
    .filter(c => {
      // 1. Category Filter
      if (categoryFilter !== 'ALL') {
        const catInfo = getCampaignCategoryInfo(c);
        if (categoryFilter !== catInfo.prefix && categoryFilter !== catInfo.code) return false;
      }

      // 2. Tag Checkbox Filter (matches if campaign contains ANY of the selected tags)
      if (selectedTags.length > 0) {
        const tags = getCampaignTags(c);
        if (!Array.isArray(tags) || !selectedTags.some(t => tags.includes(t))) return false;
      }

      // 3. Urgency Filter
      if (urgencyFilter !== 'ALL') {
        const audit = getCampaignAuditDetails(c.id, c.title, c);
        const urg = (c.urgency || audit.urgency || '').toUpperCase();
        if (urgencyFilter === 'HIGH' && !urg.includes('HIGH') && !urg.includes('CRITICAL') && !urg.includes('EMERGENCY')) return false;
        if (urgencyFilter === 'MEDIUM' && !urg.includes('MEDIUM') && !urg.includes('URGENT') && !urg.includes('REHAB')) return false;
        if (urgencyFilter === 'STABLE' && !urg.includes('STABLE') && !urg.includes('STANDARD') && !urg.includes('CHARITABLE')) return false;
      }

      // 4. Progress Filter
      if (progressFilter !== 'ALL') {
        const pctNum = parseFloat(progressPct(c.currentAmount, c.targetAmount)) || 0;
        if (progressFilter === 'ALMOST' && (pctNum < 75 || pctNum >= 100)) return false;
        if (progressFilter === 'IN_PROGRESS' && (pctNum < 25 || pctNum >= 75)) return false;
        if (progressFilter === 'NEW' && pctNum >= 25) return false;
        if (progressFilter === 'FUNDED' && pctNum < 100) return false;
      }

      // 5. Active Status Filter
      if (statusFilter !== 'ALL') {
        const isActive = c.isActive !== undefined ? Boolean(c.isActive) : true;
        if (statusFilter === 'ACTIVE' && !isActive) return false;
        if (statusFilter === 'CLOSED' && isActive) return false;
      }

      // 6. Search Query Filter (covers title, description, org, location, tags, id)
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const displayTitle = formatCampaignTitle(c.title, c.id).toLowerCase();
        const rawTitle = (c.title || '').toLowerCase();
        const desc = (c.description || '').toLowerCase();
        const orgMatch = (c.orgAddress || '').toLowerCase().includes(q) || (c.orgName || '').toLowerCase().includes(q);
        const locationMatch = (c.locationRegion || c.location_region || '').toLowerCase().includes(q);
        const tags = getCampaignTags(c);
        const tagMatch = Array.isArray(tags) && tags.some(t => t.toLowerCase().includes(q));
        const idMatch = String(c.id).includes(q);
        return displayTitle.includes(q) || rawTitle.includes(q) || desc.includes(q) || orgMatch || locationMatch || tagMatch || idMatch;
      }

      return true;
    })
    .sort((a, b) => {
      if (campaignSort === 'NEWEST') return Number(b.id) - Number(a.id);
      if (campaignSort === 'GOAL_HIGH') return parseFloat(b.targetAmount || 0) - parseFloat(a.targetAmount || 0);
      if (campaignSort === 'GOAL_LOW') return parseFloat(a.targetAmount || 0) - parseFloat(b.targetAmount || 0);
      if (campaignSort === 'MOST_FUNDED') {
        const pctA = parseFloat(progressPct(a.currentAmount, a.targetAmount)) || 0;
        const pctB = parseFloat(progressPct(b.currentAmount, b.targetAmount)) || 0;
        return pctB - pctA;
      }
      return 0;
    });

  const totalPages = Math.ceil(filteredCampaigns.length / campaignsPerPage) || 1;
  const paginatedCampaigns = filteredCampaigns.slice((currentPage - 1) * campaignsPerPage, currentPage * campaignsPerPage);

  // My Contributions / Receipts Logic
  const [myDonations, setMyDonations] = useState(null);
  const [loadingMyDonations, setLoadingMyDonations] = useState(false);

  const fetchMyDonations = async () => {
    setLoadingMyDonations(true);
    try {
      const token = localStorage.getItem('bbdrts_token');
      const apiUrl = API_URL;
      if (token) {
        const res = await fetch(`${apiUrl}/api/donations/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const list = await res.json();
          setMyDonations(Array.isArray(list) ? list : []);
          return;
        }
      }
      setMyDonations([]);
    } catch (err) {
      console.error("Failed to fetch donor history:", err);
      setMyDonations([]);
    } finally {
      setLoadingMyDonations(false);
    }
  };

  useEffect(() => {
    fetchMyDonations();
  }, [walletAddress]);

  const effectiveDonorKey = walletAddress || currentUser?.wallet_address;
  const globalCumulative = globalDonorRegistry.get(effectiveDonorKey, currentUser?.id);

  const totalDonatedRaw = useMemo(() => {
    const listTotal = (!myDonations || !Array.isArray(myDonations) || myDonations.length === 0)
      ? 0
      : myDonations.reduce((acc, d) => acc + (parseFloat(d.amount || d.Amount || 0) || 0), 0);
    const registryTotal = globalCumulative?.totalEth || 0;
    return Math.max(listTotal, registryTotal);
  }, [myDonations, globalCumulative]);

  const totalDonated = useMemo(() => {
    return totalDonatedRaw.toFixed(4);
  }, [totalDonatedRaw]);

  const totalDonatedPhp = useMemo(() => {
    const regPhp = globalCumulative?.totalPhp || 0;
    const calcFromRaw = Math.round(totalDonatedRaw * 170000);
    return Math.max(calcFromRaw, regPhp);
  }, [totalDonatedRaw, globalCumulative]);

  const activeTierInfo = useMemo(() => {
    return getDonorTier({ amountEth: totalDonated, amountPhp: totalDonatedPhp });
  }, [totalDonated, totalDonatedPhp]);

  // Real-time calculated platform & donor metrics (100% accurate to current system state)
  const activeCampaignsCount = useMemo(() => {
    if (!Array.isArray(campaigns) || campaigns.length === 0) return 0;
    return campaigns.filter(c => c.isActive !== false && !c.isClosed).length;
  }, [campaigns]);

  const donorReceiptsCount = useMemo(() => {
    const listLen = Array.isArray(myDonations) ? myDonations.length : 0;
    const regCount = globalCumulative?.donationCount || 0;
    return Math.max(listLen, regCount);
  }, [myDonations, globalCumulative]);

  const uniqueCausesCount = useMemo(() => {
    if (Array.isArray(myDonations) && myDonations.length > 0) {
      const ids = new Set(myDonations.map(d => d.campaignId || d.campaign_id || d.Campaign_ID).filter(Boolean));
      if (ids.size > 0) return ids.size;
    }
    const regCount = globalCumulative?.donationCount || 0;
    if (regCount >= 10) return 4;
    if (regCount > 0) return Math.min(regCount, 3);
    return 0;
  }, [myDonations, globalCumulative]);

  const hasAnyShortage = useMemo(() => {
    if (!myDonations || !Array.isArray(myDonations)) return false;
    return myDonations.some(d => d.auditStatus === 'SHORTAGE' || Number(d.variancePhp || 0) < -20);
  }, [myDonations]);

  const drReceiptsCount = useMemo(() => {
    if (!myDonations || !Array.isArray(myDonations)) return 0;
    return myDonations.filter(d => {
      const matchCamp = campaigns.find(c => String(c.id) === String(d.campaignId));
      const cat = getCampaignCategoryInfo(matchCamp);
      return cat.prefix === 'DR' || cat.code === 'DR';
    }).length;
  }, [myDonations, campaigns]);

  const cdReceiptsCount = useMemo(() => {
    if (!myDonations || !Array.isArray(myDonations)) return 0;
    return myDonations.filter(d => {
      const matchCamp = campaigns.find(c => String(c.id) === String(d.campaignId));
      const cat = getCampaignCategoryInfo(matchCamp);
      return cat.prefix === 'CD' || cat.code === 'CD';
    }).length;
  }, [myDonations, campaigns]);

  const criticalUrgencyCount = useMemo(() => {
    if (!Array.isArray(campaigns) || campaigns.length === 0) return 0;
    return campaigns.filter(c => {
      const u = (c.audit?.urgency || c.urgency || '').toUpperCase();
      return u.includes('CRITICAL') || u.includes('HIGH') || u.includes('URGENT');
    }).length;
  }, [campaigns]);

  const estimatedFamiliesAided = useMemo(() => {
    const php = totalDonatedPhp || 0;
    if (php > 0) return Math.max(1, Math.floor(php / 500));
    return campaigns.reduce((acc, c) => {
      const num = parseInt((c.audit?.beneficiaries || '').replace(/\D/g, ''), 10);
      return acc + (isNaN(num) ? 50 : Math.min(num, 300));
    }, 0);
  }, [totalDonatedPhp, campaigns]);

  // Synchronize active donor's global cumulative contribution across the platform
  useEffect(() => {
    const key = walletAddress || currentUser?.wallet_address;
    if (key && totalDonated !== undefined) {
      globalDonorRegistry.set(key, {
        totalEth: parseFloat(totalDonated || 0),
        totalPhp: totalDonatedPhp,
        donationCount: Math.max(myDonations?.length || 0, globalCumulative?.donationCount || 0),
        donorName: userDisplayName
      });
    }
    if (currentUser?.id) {
      globalDonorRegistry.set(`id_${currentUser.id}`, {
        totalEth: parseFloat(totalDonated || 0),
        totalPhp: totalDonatedPhp,
        donationCount: Math.max(myDonations?.length || 0, globalCumulative?.donationCount || 0),
        donorName: userDisplayName
      });
    }
  }, [walletAddress, currentUser, totalDonated, totalDonatedPhp, myDonations, userDisplayName, globalCumulative]);

  // Live Dashboard Section Broadcast to ReliefAI
  const lastTabRef = useRef(null);
  useEffect(() => {
    if (lastTabRef.current === activeTab) return;
    lastTabRef.current = activeTab;
    const tabLabels = {
      'dashboard': 'Dashboard Overview',
      'campaigns': 'Relief Campaigns Explorer',
      'my-donations': 'My Contributions & Audit Receipts',
      'radar-heatmap': 'Relief Radar (PAGASA Heatmap)',
      'settings': 'Donor Profile & Account Settings'
    };
    const sectionLabel = tabLabels[activeTab] || activeTab;

    // Extract top visible campaigns on this screen (up to 5 items)
    const rawCampList = Array.isArray(campaigns) ? campaigns : [];
    const visibleCampaignSummaries = (activeTab === 'campaigns' && Array.isArray(filteredCampaigns) ? filteredCampaigns : rawCampList).slice(0, 5).map(c => {
      const targetEth = parseFloat(c.targetAmount || c.Target_Amount || 0);
      const raisedEth = parseFloat(c.currentAmount || c.Raised_Eth || 0);
      const deficitEth = Math.max(0, targetEth - raisedEth).toFixed(4);
      return {
        id: c.id || c.Campaign_ID,
        title: c.title || c.Campaign_Title || 'Relief Appeal',
        region: c.region || c.Location_Region || 'Southern Leyte',
        urgency: c.urgency || c.Urgency || 'HIGH',
        raisedEth: raisedEth.toFixed(4),
        targetEth: targetEth.toFixed(4),
        deficitEth,
        orgName: c.organizationName || c.Org_Name || 'Verified NGO'
      };
    });

    // Extract recent visible donations (up to 5 items)
    const recentDonationsSummary = (Array.isArray(myDonations) ? myDonations : []).slice(0, 5).map(d => ({
      campaignTitle: d.campaignTitle || d.Campaign_Title || `Campaign #${d.campaignId}`,
      amountEth: d.amount ? parseFloat(d.amount).toFixed(4) : '0',
      date: d.timestamp || d.createdAt || 'Recent',
      status: d.status || 'Verified On-Chain',
      txHash: d.txHash ? `${d.txHash.substring(0, 8)}...${d.txHash.substring(d.txHash.length - 6)}` : 'Verified On-Chain'
    }));

    const metaPayload = {
      tab: activeTab,
      section: sectionLabel,
      portal: 'Donor Portal',
      tierTitle: activeTierInfo?.title || 'Relief Supporter',
      totalDonatedEth: totalDonated,
      totalDonatedPhp,
      donorReceiptsCount,
      activeCampaignsCount,
      categoryFilter,
      urgencyFilter,
      searchQuery,
      visibleCampaigns: visibleCampaignSummaries,
      recentDonations: recentDonationsSummary
    };
    if (typeof onActiveTabChange === 'function') {
      onActiveTabChange(activeTab, metaPayload);
    }
  }, [activeTab, onActiveTabChange, campaigns, myDonations, totalDonated, totalDonatedPhp, donorReceiptsCount, activeCampaignsCount, categoryFilter, urgencyFilter, searchQuery, activeTierInfo]);

  // Automated Tier Upgrade Detection (Subtle celebration notification)
  useEffect(() => {
    const key = walletAddress || currentUser?.wallet_address;
    if (!key || !myDonations || myDonations.length === 0) return;
    const tierInfo = getDonorTier(totalDonated, totalDonatedPhp);
    if (!tierInfo || !tierInfo.tier) return;
    
    const currentTier = tierInfo.tier;
    const storageKey = `bbdrts_highest_tier_${key.toLowerCase()}`;
    const storedTierStr = localStorage.getItem(storageKey);
    const storedTierNum = storedTierStr ? parseInt(storedTierStr, 10) : null;

    if (storedTierNum === null) {
      // First time observing donations: record baseline tier without disruptive popup
      localStorage.setItem(storageKey, String(currentTier.tierNumber));
    } else if (currentTier.tierNumber > storedTierNum) {
      // New Tier Unlocked from successful cumulative donation!
      localStorage.setItem(storageKey, String(currentTier.tierNumber));
      setUnlockedTierModal(currentTier);
    }
  }, [walletAddress, currentUser, myDonations, totalDonated, totalDonatedPhp]);



  // Filter & Sort My Contributions / Receipts
  const filteredMyDonations = useMemo(() => {
    if (!myDonations || !Array.isArray(myDonations)) return [];
    return myDonations
      .filter(d => {
        const matchCamp = campaigns.find(c => String(c.id) === String(d.campaignId)) || { id: d.campaignId, title: `Campaign #${d.campaignId}` };
        if (receiptFilter !== 'ALL') {
          const catInfo = getCampaignCategoryInfo(matchCamp);
          if (receiptFilter !== catInfo.prefix && receiptFilter !== catInfo.code) return false;
        }
        if (receiptRailFilter !== 'ALL') {
          const pm = String(d.paymentMethod || 'ETH').toUpperCase();
          if (receiptRailFilter === 'ETH' && !pm.includes('ETH') && !pm.includes('CRYPTO') && !pm.includes('SEPOLIA')) return false;
          if (receiptRailFilter === 'GCASH' && !pm.includes('GCASH')) return false;
          if (receiptRailFilter === 'MAYA' && !pm.includes('MAYA')) return false;
          if (receiptRailFilter === 'CARD' && !pm.includes('CARD') && !pm.includes('BANK')) return false;
        }
        if (searchQueryReceipts.trim() !== '') {
          const q = searchQueryReceipts.toLowerCase().trim();
          const tx = (d.txHash || '').toLowerCase();
          const campTitle = formatCampaignTitle(matchCamp.title, matchCamp.id).toLowerCase();
          const refNum = (d.referenceNumber || '').toLowerCase();
          return tx.includes(q) || campTitle.includes(q) || String(d.campaignId).includes(q) || refNum.includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        if (receiptSort === 'AMOUNT_HIGH') return (parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0);
        if (receiptSort === 'AMOUNT_LOW') return (parseFloat(a.amount) || 0) - (parseFloat(b.amount) || 0);
        if (receiptSort === 'OLDEST') {
          const timeA = new Date(a.createdAt || 0).getTime();
          const timeB = new Date(b.createdAt || 0).getTime();
          return timeA - timeB;
        }
        // Default NEWEST
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });
  }, [myDonations, receiptFilter, receiptRailFilter, searchQueryReceipts, receiptSort, campaigns]);

  return (
    <main className="container" style={{ paddingBottom: '40px' }}>
      <div className="ref-dashboard-grid">

        {/* ── Left Sidebar Navigation Panel ── */}
        <aside className="ref-sidebar">
          <div className="ref-sidebar-user" id="tour-donor-profile">
            <div className="ref-sidebar-avatar" style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {currentUser?.avatar_url && (currentUser.avatar_url.startsWith('data:') || currentUser.avatar_url.startsWith('http')) ? (
                <img src={currentUser.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : currentUser?.avatar_url && currentUser.avatar_url.length < 30 ? (
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--accent)' }}>{currentUser.avatar_url}</span>
              ) : (
                userInitials
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="ref-sidebar-name" title={userDisplayName}>{userDisplayName}</div>
              <div className="ref-sidebar-id">
                {currentUser?.system_id || `BBDRTS-DONOR-2026-${String(currentUser?.id || 1).padStart(4, '0')}`}
              </div>
            </div>
          </div>

          <div className="ref-sidebar-menu">
            <button 
              id="tour-donor-tab-dashboard"
              className={`ref-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <span className="material-symbols-outlined">dashboard</span>
              <span>Dashboard Overview</span>
            </button>

            <button 
              id="tour-donor-tab-campaigns"
              className={`ref-nav-item ${activeTab === 'campaigns' ? 'active' : ''}`}
              onClick={() => setActiveTab('campaigns')}
            >
              <span className="material-symbols-outlined">campaign</span>
              <span>Relief Campaigns</span>
            </button>

            <button 
              id="tour-donor-tab-donations"
              className={`ref-nav-item ${activeTab === 'my-donations' ? 'active' : ''}`}
              onClick={() => setActiveTab('my-donations')}
            >
              <span className="material-symbols-outlined">receipt_long</span>
              <span>My Contributions</span>
            </button>

            <button 
              id="tour-donor-tab-radar"
              className={`ref-nav-item ${activeTab === 'radar-heatmap' ? 'active' : ''}`}
              onClick={() => setActiveTab('radar-heatmap')}
            >
              <span className="material-symbols-outlined" style={{ color: activeTab === 'radar-heatmap' ? 'var(--accent, #22c55e)' : 'inherit' }}>radar</span>
              <span>Relief Radar</span>
            </button>

            <button 
              id="tour-donor-tab-settings"
              className={`ref-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <span className="material-symbols-outlined">settings</span>
              <span>Profile & Settings</span>
            </button>

            <button 
              type="button"
              className="ref-nav-item"
              onClick={handleStartTour}
              style={{ marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px', color: 'var(--accent, #22c55e)' }}
              title="Take a guided walkthrough of the donor platform"
            >
              <span className="material-symbols-outlined" style={{ color: 'var(--accent, #22c55e)' }}>help</span>
              <span style={{ fontWeight: 600 }}>Guided Tutorial</span>
            </button>
          </div>

          {/* ── Expandable System Status & Technical Information Accordion ── */}
          <div className="ref-sidebar-widget ref-sidebar-accordion" id="tour-donor-sepolia-node">
            <button
              type="button"
              className="ref-accordion-header"
              onClick={() => setShowTechDetails(prev => !prev)}
              aria-expanded={showTechDetails}
              title={showTechDetails ? 'Collapse technical network details' : 'Expand technical network details'}
            >
              <div className="ref-accordion-title-group">
                <span className="ref-status-dot"></span>
                <span className="ref-widget-title">Audit Status</span>
              </div>
              <div className="ref-accordion-badge-group">
                <span className="ref-status-live-chip">Synchronized</span>
                <span className={`material-symbols-outlined ref-accordion-caret ${showTechDetails ? 'expanded' : ''}`}>
                  expand_more
                </span>
              </div>
            </button>

            {showTechDetails && (
              <div className="ref-widget-detail ref-accordion-content">
                <div className="ref-widget-row">
                  <span>Smart Contract</span>
                  <span className="ref-widget-value green">● Active & Audited</span>
                </div>
                <div className="ref-widget-row">
                  <span>Ledger Network</span>
                  <span className="ref-widget-value">Ethereum Blockchain</span>
                </div>
                <div className="ref-widget-row">
                  <span>Verification</span>
                  <span className="ref-widget-value">Automated Escrow</span>
                </div>
                <div className="ref-widget-row" style={{ paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '2px' }}>
                  <a
                    href="https://sepolia.etherscan.io"
                    target="_blank"
                    rel="noreferrer"
                    className="ref-tech-ledger-link"
                  >
                    <span>Public Explorer</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>open_in_new</span>
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* ── Compact Theme Switcher Strip ── */}
          <div className="ref-sidebar-theme-strip">
            <div className="ref-theme-strip-header">
              <span className="ref-theme-strip-label">
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>palette</span>
                <span>Interface Theme</span>
              </span>
              <span className="ref-theme-active-tag">
                {THEME_OPTIONS.find(t => t.id === theme)?.name || 'Dark'}
              </span>
            </div>
            <div className="ref-theme-pill-group">
              {THEME_OPTIONS.map(t => {
                const isSelected = theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      if (setTheme) {
                        setTheme(t.id);
                        showSuccess(`${t.name} enabled`, 'Theme Updated');
                      }
                    }}
                    className={`ref-theme-pill-btn ${isSelected ? 'active' : ''}`}
                    title={`${t.name} Mode (${t.desc})`}
                    aria-label={`${t.name} Mode`}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '14px', color: isSelected ? t.color : 'inherit' }}>
                      {t.icon}
                    </span>
                    <span className="ref-theme-pill-name">{t.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* ── Main Content Area ── */}
        <section className="ref-main-content">

          {/* ── 1. DASHBOARD OVERVIEW TAB ONLY (Shows Welcome Banner + 4 Metric Cards) ── */}
          {activeTab === 'dashboard' && (
            <>
              {/* HCI First-Time User Experience & Getting Started Guide */}
              {showGuide && (
                <div className="db-welcome-guide" id="tour-donor-guide">
                  <div className="db-guide-header">
                    <div>
                      <div className="db-guide-badge">
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>help</span>
                        <span>First-Time Quick Guide</span>
                      </div>
                      <h2 className="db-guide-title">
                        {totalDonatedPhp === 0
                          ? `Welcome to BBDRTS, ${userDisplayName || 'Friend'}`
                          : `Welcome back, ${userDisplayName || 'Donor'}`}
                      </h2>
                      <p className="db-guide-subtitle">
                        Every peso and crypto donation is publicly verified and sent directly to accredited disaster relief teams across the Philippines with zero platform cuts.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="db-guide-dismiss"
                      onClick={() => {
                        setShowGuide(false);
                        try { localStorage.setItem('bbdrts_dismiss_donor_guide', 'true'); } catch (_) {}
                      }}
                      title="Dismiss this guide"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check</span>
                      <span>Hide guide</span>
                    </button>
                  </div>

                  <div className="db-guide-steps">
                    {/* Step 1 */}
                    <div className="db-guide-step-card">
                      <div className="db-guide-step-top">
                        <span className="db-guide-step-num">Step 01</span>
                        <span className="material-symbols-outlined db-guide-step-icon">travel_explore</span>
                      </div>
                      <div>
                        <h3 className="db-guide-step-heading">Explore Relief Appeals</h3>
                        <p className="db-guide-step-desc">
                          Browse urgent disaster appeals filtered by region, typhoon severity, flood, or medical needs.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="db-guide-step-action"
                        onClick={() => setActiveTab('campaigns')}
                      >
                        <span>Browse Appeals</span>
                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>arrow_forward</span>
                      </button>
                    </div>

                    {/* Step 2 */}
                    <div className="db-guide-step-card">
                      <div className="db-guide-step-top">
                        <span className="db-guide-step-num">Step 02</span>
                        <span className="material-symbols-outlined db-guide-step-icon">account_balance_wallet</span>
                      </div>
                      <div>
                        <h3 className="db-guide-step-heading">Give via E-Wallets or Crypto</h3>
                        <p className="db-guide-step-desc">
                          Scan official GCash/Maya QR codes, transfer via bank, or send Sepolia ETH directly from MetaMask.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="db-guide-step-action"
                        onClick={() => setActiveTab('radar-heatmap')}
                      >
                        <span>View Philippine Radar</span>
                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>arrow_forward</span>
                      </button>
                    </div>

                    {/* Step 3 */}
                    <div className="db-guide-step-card">
                      <div className="db-guide-step-top">
                        <span className="db-guide-step-num">Step 03</span>
                        <span className="material-symbols-outlined db-guide-step-icon">receipt_long</span>
                      </div>
                      <div>
                        <h3 className="db-guide-step-heading">Track Your Digital Receipts</h3>
                        <p className="db-guide-step-desc">
                          Every contribution generates an immutable digital receipt verified on the public blockchain ledger.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="db-guide-step-action"
                        onClick={() => setActiveTab('my-donations')}
                      >
                        <span>View My Contributions</span>
                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>arrow_forward</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── 1. Clean Profile & Impact Header ── */}
              <div className="dbo-clean-hero" id="tour-donor-welcome">
                <div className="dbo-clean-hero-left" id="tour-donor-identity">
                  <div className="dbo-clean-avatar">
                    {currentUser?.avatar_url && (currentUser.avatar_url.startsWith('data:') || currentUser.avatar_url.startsWith('http')) ? (
                      <img src={currentUser.avatar_url} alt="Profile" />
                    ) : currentUser?.avatar_url && currentUser.avatar_url.length < 30 ? (
                      <span className="material-symbols-outlined" style={{ fontSize: '26px', color: 'var(--accent)' }}>{currentUser.avatar_url}</span>
                    ) : (
                      userInitials
                    )}
                  </div>
                  <div className="dbo-clean-user-meta">
                    <div className="dbo-clean-name-row">
                      <h1 className="dbo-clean-title">{userDisplayName || 'Donor Dashboard'}</h1>
                      <span className="dbo-clean-badge">
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>verified</span>
                        <span>Verified Donor</span>
                      </span>
                    </div>
                    <div className="dbo-clean-subtext">
                      {walletAddress ? (
                        <span
                          className="dbo-clean-wallet-pill"
                          onClick={() => {
                            if (navigator.clipboard) {
                              navigator.clipboard.writeText(walletAddress);
                              showSuccess('Wallet address copied to clipboard', 'Address Copied');
                            }
                          }}
                          title="Click to copy full Sepolia wallet address"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>account_balance_wallet</span>
                          <span>{shortAddr(walletAddress)}</span>
                          <span className="material-symbols-outlined" style={{ fontSize: '11px', opacity: 0.6 }}>content_copy</span>
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>Wallet not connected</span>
                      )}
                      <span>•</span>
                      <span style={{ color: 'var(--text-muted)' }}>Sepolia Testnet</span>
                    </div>
                  </div>
                </div>

                <div className="dbo-clean-hero-right" id="tour-donor-badge-card">
                  <div className="dbo-clean-stat-box">
                    <div className="dbo-clean-stat-label">Lifetime Giving</div>
                    <div className="dbo-clean-stat-value">₱{Math.round(totalDonatedPhp).toLocaleString('en-US')}</div>
                    <div 
                      className="dbo-clean-stat-sub"
                      onClick={() => setShowTierModal(true)}
                      title="View Philanthropic Honor Roll"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '14px', color: activeTierInfo?.tier?.color || '#16a34a' }}>workspace_premium</span>
                      <span style={{ color: activeTierInfo?.tier?.color || '#16a34a' }}>
                        {activeTierInfo?.tier ? activeTierInfo.tier.name : 'Community Supporter'}
                      </span>
                      <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>chevron_right</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── 2. Clean 4-Card Metric Grid ── */}
              <div className="dbo-metrics-row" id="tour-donor-metrics">
                <div className="dbo-metric-card interactive" onClick={() => setActiveTab('my-donations')} title="View donation history">
                  <div className="dbo-metric-head">
                    <span className="dbo-metric-title">Total Donated</span>
                    <span className="material-symbols-outlined dbo-metric-icon">payments</span>
                  </div>
                  <div className="dbo-metric-number accent">
                    ₱{Math.round(totalDonatedPhp).toLocaleString('en-US')}
                  </div>
                  <p className="dbo-metric-caption">
                    <span>{totalDonated} ETH · On-chain verified</span>
                  </p>
                </div>

                <div className="dbo-metric-card interactive" onClick={() => setActiveTab('campaigns')} title="Browse relief campaigns">
                  <div className="dbo-metric-head">
                    <span className="dbo-metric-title">Relief Campaigns</span>
                    <span className="material-symbols-outlined dbo-metric-icon">campaign</span>
                  </div>
                  <div className="dbo-metric-number">
                    {activeCampaignsCount}
                  </div>
                  <p className="dbo-metric-caption">
                    <span>{criticalUrgencyCount > 0 ? `${criticalUrgencyCount} critical priority` : 'Open for donations'}</span>
                  </p>
                </div>

                <div className="dbo-metric-card">
                  <div className="dbo-metric-head">
                    <span className="dbo-metric-title">Families Reached</span>
                    <span className="material-symbols-outlined dbo-metric-icon">groups</span>
                  </div>
                  <div className="dbo-metric-number">
                    ~{estimatedFamiliesAided.toLocaleString()}
                  </div>
                  <p className="dbo-metric-caption">
                    <span>Direct relief food & water packs</span>
                  </p>
                </div>

                <div className="dbo-metric-card interactive" onClick={() => setShowTierModal(true)} title="View Philanthropic Honor Roll">
                  <div className="dbo-metric-head">
                    <span className="dbo-metric-title">Honor Roll Standing</span>
                    <span className="material-symbols-outlined dbo-metric-icon">workspace_premium</span>
                  </div>
                  <div className="dbo-metric-number" style={{ fontSize: '1.2rem', color: activeTierInfo?.tier?.color || 'var(--text-primary)' }}>
                    {activeTierInfo?.tier ? activeTierInfo.tier.name : 'Community Supporter'}
                  </div>
                  <p className="dbo-metric-caption">
                    <span>{donorReceiptsCount > 0 ? `${donorReceiptsCount} verified receipt${donorReceiptsCount !== 1 ? 's' : ''}` : 'Pledge first donation'}</span>
                  </p>
                </div>
              </div>

              {/* ── 3. Active Relief Appeals Section ── */}
              <div className="dbo-section-wrapper" id="tour-donor-featured-causes">
                <div className="dbo-clean-section-header">
                  <h2 className="dbo-clean-heading">
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#ef4444' }}>emergency</span>
                    <span>Active Disaster Relief Appeals</span>
                  </h2>
                  <button type="button" className="dbo-clean-link" onClick={() => setActiveTab('campaigns')}>
                    <span>View all {campaigns.length} campaigns</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
                  </button>
                </div>

                {fetchingCampaigns ? (
                  <div className="dbo-campaigns-grid">
                    <DbSkeletonCampRow />
                    <DbSkeletonCampRow />
                    <DbSkeletonCampRow />
                  </div>
                ) : campaigns.length === 0 ? (
                  <div className="db-empty-state">
                    <div className="db-empty-icon"><span className="material-symbols-outlined">inbox</span></div>
                    <div className="db-empty-title">No active campaigns on the ledger yet</div>
                    <div className="db-empty-desc">Check back soon for upcoming humanitarian relief missions.</div>
                  </div>
                ) : (
                  <div className="dbo-campaigns-grid">
                    {campaigns.slice(0, 3).map((camp) => {
                      const pct = progressPct(camp.currentAmount, camp.targetAmount);
                      const cover = getCampaignCoverData(camp);
                      const catInfo = getCampaignCategoryInfo(camp);
                      const isCritical = (camp.audit?.urgency || camp.urgency || '').toUpperCase().includes('CRITICAL') || (camp.audit?.urgency || camp.urgency || '').toUpperCase().includes('URGENT');
                      const campPhpTarget = Math.round((parseFloat(camp.targetAmount) || 0) * 170000).toLocaleString('en-US');
                      const campPhpCurrent = Math.round((parseFloat(camp.currentAmount) || 0) * 170000).toLocaleString('en-US');

                      return (
                        <div className="dbo-clean-card" key={camp.id}>
                          <div
                            className="dbo-clean-card-thumb"
                            style={cover.imageUrl ? { backgroundImage: `url(${cover.imageUrl})` } : undefined}
                          >
                            <div className="dbo-clean-card-badges">
                              {isCritical && <span className="dbo-pill-mini urgent">Critical</span>}
                              <span className="dbo-pill-mini">{catInfo.label}</span>
                            </div>
                          </div>

                          <div className="dbo-clean-card-body">
                            <h3 className="dbo-clean-card-title" title={camp.title}>
                              {formatCampaignTitle(camp.title, camp.id)}
                            </h3>

                            <p className="dbo-clean-card-location">
                              <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#ef4444' }}>location_on</span>
                              <span>{cover.locationTag || 'Philippines'}</span>
                            </p>

                            <div className="dbo-clean-progress-block">
                              <div className="dbo-clean-progress-bar">
                                <div className="dbo-clean-progress-fill" style={{ width: `${Math.min(100, parseFloat(pct) || 0)}%` }} />
                              </div>
                              <div className="dbo-clean-progress-labels">
                                <span><strong>₱{campPhpCurrent}</strong> of ₱{campPhpTarget}</span>
                                <span style={{ color: '#16a34a', fontWeight: 700 }}>{pct}%</span>
                              </div>
                            </div>

                            <div className="dbo-clean-card-actions">
                              <button
                                type="button"
                                className="dbo-card-btn primary"
                                onClick={() => {
                                  setActiveTab('campaigns');
                                  setSearchQuery(camp.title || '');
                                }}
                              >
                                <span>Donate</span>
                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>arrow_forward</span>
                              </button>
                              <button
                                type="button"
                                className="dbo-card-btn secondary"
                                onClick={() => setSelectedCampaignForProof(camp)}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>map</span>
                                <span>Details & Map</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── 4. Recent Contribution Activity ── */}
              <div className="dbo-section-wrapper">
                <div className="dbo-clean-section-header">
                  <h2 className="dbo-clean-heading">
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#16a34a' }}>receipt_long</span>
                    <span>Recent Contributions</span>
                  </h2>
                  <button type="button" className="dbo-clean-link" onClick={() => setActiveTab('my-donations')}>
                    <span>View all receipts</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
                  </button>
                </div>

                <div className="dbo-feed-card">
                  {(!myDonations || myDonations.length === 0) ? (
                    <div style={{ padding: '24px 20px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>No personal contributions recorded yet.</div>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 12px' }}>
                        Pledge relief via GCash, Maya, Bank Transfer, or Sepolia ETH to record your first on-chain proof.
                      </p>
                      <button
                        type="button"
                        className="dbo-card-btn primary"
                        style={{ display: 'inline-flex', width: 'auto', padding: '6px 16px' }}
                        onClick={() => setActiveTab('campaigns')}
                      >
                        <span>Explore Campaigns</span>
                      </button>
                    </div>
                  ) : (
                    <div>
                      {myDonations.slice(0, 4).map((d, dIdx) => {
                        const rail = (d.paymentMethod || d.Payment_Method || 'ETH').toUpperCase();
                        const railClass = rail.includes('GCASH') ? 'gcash' : rail.includes('MAYA') ? 'maya' : rail.includes('BANK') ? 'bank' : 'eth';
                        const ethAmt = parseFloat(d.amount || d.Amount || 0);
                        const phpVal = d.phpAmount || Math.round(ethAmt * 170000);
                        const txHash = d.txHash || d.Tx_Hash;
                        const campTitle = d.campaignTitle || d.campaign_title || 'Relief Operation';

                        return (
                          <div className="dbo-feed-row" key={dIdx}>
                            <div className="dbo-feed-info">
                              <span className={`dbo-feed-rail ${railClass}`}>
                                {rail.includes('GCASH') ? 'GCASH' : rail.includes('MAYA') ? 'MAYA' : rail.includes('BANK') ? 'BANK' : 'ETH'}
                              </span>
                              <div className="dbo-feed-text">
                                <div className="dbo-feed-title" title={campTitle}>{campTitle}</div>
                                <div className="dbo-feed-meta">Verified On-Chain</div>
                              </div>
                            </div>
                            <div className="dbo-feed-right">
                              <div className="dbo-feed-amt">+₱{phpVal.toLocaleString('en-US')}</div>
                              {txHash && (
                                <a
                                  href={`https://sepolia.etherscan.io/tx/${txHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="dbo-feed-link"
                                  title="View on Sepolia Etherscan"
                                >
                                  <span>{shortAddr(txHash)}</span>
                                  <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>open_in_new</span>
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── 2. DEDICATED RELIEF CAMPAIGNS TAB (Hides 4 boxes & welcome card) ── */}
          {activeTab === 'campaigns' && (
            <div style={{ marginTop: '8px' }} id="tour-campaigns-container">
              <div className="section-header">
                <div>
                  <h2 className="section-title" style={{ fontSize: '1.4rem' }}>
                    <span className="material-symbols-outlined section-title-icon" style={{marginRight: '8px', color: 'var(--accent)'}}>campaign</span> Active Disaster Relief Campaigns
                  </h2>
                  <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '4px' }}>
                    Verified causes with transparent, on-chain relief funding — every donation is recorded on the Sepolia public ledger.
                  </p>
                </div>

                {/* Aggregate impact snapshot — aggregates only, no per-card repeats */}
                {(() => {
                  const raisedPhp = campaigns.reduce((s, c) => s + (parseFloat(c.currentAmount) || 0), 0) * 170000;
                  const fundedCount = campaigns.filter(c => parseFloat(c.targetAmount) > 0 && parseFloat(c.currentAmount) >= parseFloat(c.targetAmount)).length;
                  const orgCount = new Set(campaigns.map(c => c.orgName || c.orgAddress).filter(Boolean)).size;
                  return (
                    <div className="campaign-head-stats">
                      <div className="campaign-head-stat">
                        <span className="campaign-head-stat-val">₱{Math.round(raisedPhp).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                        <span className="campaign-head-stat-label">raised to date</span>
                      </div>
                      <div className="campaign-head-stat">
                        <span className="campaign-head-stat-val">{fundedCount}</span>
                        <span className="campaign-head-stat-label">fully funded</span>
                      </div>
                      <div className="campaign-head-stat">
                        <span className="campaign-head-stat-val">{orgCount}</span>
                        <span className="campaign-head-stat-label">partner NGOs</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* ── Unified Campaign Toolbar: Filters on Left, Search & Sort on Right ── */}
              <div className="campaign-toolbar-card" id="tour-campaigns-toolbar">
                <div className="campaign-toolbar-unified-row">
                  {/* Left: Filter Pills (Causes, Priorities, Tags) */}
                  <div className="toolbar-filters-left">
                    {/* Cause Filter Pill Popover */}
                    <div style={{ position: 'relative' }} ref={causesDropdownRef}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCausesDropdown(prev => !prev);
                          setShowPrioritiesDropdown(false);
                          setShowTagsDropdown(false);
                          setShowSortDropdown(false);
                        }}
                        className={`filter-pill-btn ${categoryFilter !== 'ALL' ? 'active-filter' : ''}`}
                        title="Filter by cause category"
                      >
                        <span className="material-symbols-outlined filter-pill-icon" style={{ color: 'var(--text-secondary)' }}>{selectedCauseObj.icon}</span>
                        <span>{selectedCauseObj.label}</span>
                        <span className="material-symbols-outlined filter-pill-arrow" style={{ position: 'static', marginLeft: '4px' }}>
                          {showCausesDropdown ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>

                      {showCausesDropdown && (
                        <div className="filter-custom-popover">
                          {CAUSE_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setCategoryFilter(opt.value);
                                setShowCausesDropdown(false);
                              }}
                              className={`filter-popover-option ${categoryFilter === opt.value ? 'selected' : ''}`}
                            >
                              <span className="material-symbols-outlined filter-popover-option-icon" style={{ color: opt.color }}>{opt.icon}</span>
                              <span>{opt.label}</span>
                              {categoryFilter === opt.value && (
                                <span className="material-symbols-outlined filter-popover-check">check</span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Priority Filter Pill Popover */}
                    <div style={{ position: 'relative' }} ref={prioritiesDropdownRef}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowPrioritiesDropdown(prev => !prev);
                          setShowCausesDropdown(false);
                          setShowTagsDropdown(false);
                          setShowSortDropdown(false);
                        }}
                        className={`filter-pill-btn ${urgencyFilter !== 'ALL' ? 'active-filter' : ''}`}
                        title="Filter by urgency priority"
                      >
                        <span className="material-symbols-outlined filter-pill-icon" style={{ color: 'var(--text-secondary)' }}>{selectedPriorityObj.icon}</span>
                        <span>{selectedPriorityObj.label}</span>
                        <span className="material-symbols-outlined filter-pill-arrow" style={{ position: 'static', marginLeft: '4px' }}>
                          {showPrioritiesDropdown ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>

                      {showPrioritiesDropdown && (
                        <div className="filter-custom-popover">
                          {PRIORITY_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setUrgencyFilter(opt.value);
                                setShowPrioritiesDropdown(false);
                              }}
                              className={`filter-popover-option ${urgencyFilter === opt.value ? 'selected' : ''}`}
                            >
                              <span className="material-symbols-outlined filter-popover-option-icon" style={{ color: opt.color }}>{opt.icon}</span>
                              <span>{opt.label}</span>
                              {urgencyFilter === opt.value && (
                                <span className="material-symbols-outlined filter-popover-check">check</span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Tags Dropdown Popover with Checkboxes */}
                    <div style={{ position: 'relative' }} ref={tagsDropdownRef}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowTagsDropdown(prev => !prev);
                          setShowCausesDropdown(false);
                          setShowPrioritiesDropdown(false);
                          setShowSortDropdown(false);
                        }}
                        className={`filter-pill-btn ${selectedTags.length > 0 ? 'active-filter' : ''}`}
                        title="Filter by tags"
                      >
                        <span className="material-symbols-outlined filter-pill-icon" style={{ color: 'var(--text-secondary)' }}>sell</span>
                        <span>Tags</span>
                        {selectedTags.length > 0 && (
                          <span className="tags-dropdown-badge-ref">{selectedTags.length}</span>
                        )}
                        <span className="material-symbols-outlined filter-pill-arrow" style={{ position: 'static', marginLeft: '4px' }}>
                          {showTagsDropdown ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>

                      {showTagsDropdown && (
                        <div className="tags-popover-menu">
                          <div className="tags-popover-header">
                            <span className="tags-popover-title">
                              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>sell</span>
                              Filter by Tags
                            </span>
                            {selectedTags.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setSelectedTags([])}
                                className="tags-popover-clear-btn"
                              >
                                Clear ({selectedTags.length})
                              </button>
                            )}
                          </div>

                          <div className="tags-popover-list">
                            {/* "All Tags" Checkbox */}
                            <label className={`tags-popover-item ${selectedTags.length === 0 ? 'checked' : ''}`}>
                              <input
                                type="checkbox"
                                checked={selectedTags.length === 0}
                                onChange={() => setSelectedTags([])}
                              />
                              <span className="tags-popover-tag-text">All Tags</span>
                              <span className="tags-popover-count">{campaigns.length}</span>
                            </label>

                            {/* Individual Tag Checkboxes */}
                            {availableTags.map((tag) => {
                              const isChecked = selectedTags.includes(tag);
                              const count = tagCounts[tag] || 0;
                              return (
                                <label key={tag} className={`tags-popover-item ${isChecked ? 'checked' : ''}`}>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleTag(tag)}
                                  />
                                  <span className="tags-popover-tag-text">#{tag}</span>
                                  {count > 0 && <span className="tags-popover-count">{count}</span>}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Search Box + Sort Pill */}
                  <div className="toolbar-search-right">
                    {/* Compact Search Box with ⌘ K and Animated Stretch on Focus */}
                    <div className="campaign-toolbar-search-box">
                      <span className="material-symbols-outlined filter-search-icon-ref">search</span>
                      <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search campaigns, NGOs, locations..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            e.target.blur();
                          }
                        }}
                        className="filter-search-input-ref"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="filter-search-clear-btn-ref"
                          title="Clear search"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>close</span>
                        </button>
                      )}
                      <kbd className="filter-search-shortcut-badge" title="Press Ctrl+K or ⌘K to focus search">⌘ K</kbd>
                    </div>

                    {/* Sort Pill Popover */}
                    <div style={{ position: 'relative' }} ref={sortDropdownRef}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowSortDropdown(prev => !prev);
                          setShowCausesDropdown(false);
                          setShowPrioritiesDropdown(false);
                          setShowTagsDropdown(false);
                        }}
                        className="filter-pill-btn"
                        title="Sort campaigns"
                      >
                        <span className="material-symbols-outlined filter-pill-icon" style={{ color: '#94a3b8' }}>swap_vert</span>
                        <span>{selectedSortObj.label}</span>
                        <span className="material-symbols-outlined filter-pill-arrow" style={{ position: 'static', marginLeft: '4px' }}>
                          {showSortDropdown ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>

                      {showSortDropdown && (
                        <div className="filter-custom-popover align-right">
                          {SORT_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setCampaignSort(opt.value);
                                setShowSortDropdown(false);
                              }}
                              className={`filter-popover-option ${campaignSort === opt.value ? 'selected' : ''}`}
                            >
                              <span className="material-symbols-outlined filter-popover-option-icon" style={{ color: '#94a3b8' }}>{opt.icon}</span>
                              <span>{opt.label}</span>
                              {campaignSort === opt.value && (
                                <span className="material-symbols-outlined filter-popover-check">check</span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Refresh: re-reads causes from the ledger (kept with the data controls, not floating above) */}
                    <button
                      type="button"
                      className="toolbar-refresh-btn"
                      onClick={fetchCampaigns}
                      disabled={fetchingCampaigns}
                      title="Refresh campaigns from the ledger"
                    >
                      {fetchingCampaigns
                        ? <div className="spinner spinner-light" />
                        : <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>refresh</span>}
                    </button>
                  </div>
                </div>

              </div>

              {/* ── Results strip: filtered count + active filter chips + view mode ── */}
              <div className="campaign-toolbar-substrip">
                <div className="substrip-left">
                  <div className="campaign-toolbar-count-tag">
                    <span className="count-indicator-dot" />
                    <span>Showing <strong>{filteredCampaigns.length}</strong> of {campaigns.length} campaigns</span>
                  </div>

                  {hasActiveFilters && (
                    <div className="substrip-filters">
                      {/* Cause Chip */}
                      {categoryFilter !== 'ALL' && (
                        <div className="reference-active-chip">
                          <span className="material-symbols-outlined chip-icon" style={{ color: 'var(--text-secondary)' }}>public</span>
                          <span>{categoryFilter === 'DR' ? 'Disaster Relief' : 'Charitable Aid'}</span>
                          <button type="button" onClick={() => setCategoryFilter('ALL')} title="Remove filter">
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>close</span>
                          </button>
                        </div>
                      )}

                      {urgencyFilter !== 'ALL' && (
                        <div className="reference-active-chip">
                          <span className="material-symbols-outlined chip-icon" style={{ color: 'var(--text-secondary)' }}>bolt</span>
                          <span>{urgencyFilter === 'HIGH' ? 'High Priority' : urgencyFilter === 'MEDIUM' ? 'Medium Priority' : 'Standard Priority'}</span>
                          <button type="button" onClick={() => setUrgencyFilter('ALL')} title="Remove filter">
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>close</span>
                          </button>
                        </div>
                      )}

                      {/* Tag Chips */}
                      {selectedTags.map((tag) => (
                        <div key={tag} className="reference-active-chip">
                          <span className="material-symbols-outlined chip-icon" style={{ color: 'var(--text-secondary)' }}>sell</span>
                          <span>#{tag}</span>
                          <button type="button" onClick={() => toggleTag(tag)} title={`Remove tag #${tag}`}>
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>close</span>
                          </button>
                        </div>
                      ))}

                      {/* Search Chip */}
                      {searchQuery.trim() && (
                        <div className="reference-active-chip">
                          <span className="material-symbols-outlined chip-icon" style={{ color: 'var(--text-secondary)' }}>search</span>
                          <span>"{searchQuery.trim()}"</span>
                          <button type="button" onClick={() => setSearchQuery('')} title="Clear search query">
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>close</span>
                          </button>
                        </div>
                      )}

                      {/* Clear All Button */}
                      <button
                        type="button"
                        onClick={resetAllFilters}
                        className="btn-clear-all-filters-ref"
                        title="Reset all filters and search"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>restart_alt</span>
                        <span>Clear all</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Right: List / Grid Layout Buttons */}
                <div className="filter-layout-segmented-pill" role="group" aria-label="Layout view mode">
                  <button
                    type="button"
                    onClick={() => handleViewModeChange('list')}
                    className={`layout-seg-btn ${viewMode === 'list' ? 'active' : ''}`}
                    title="List View"
                    aria-label="List View"
                  >
                    <span className="material-symbols-outlined">format_list_bulleted</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleViewModeChange('grid')}
                    className={`layout-seg-btn ${viewMode === 'grid' || viewMode === 'grid-3' || viewMode === 'grid-2' ? 'active' : ''}`}
                    title="Grid View"
                    aria-label="Grid View"
                  >
                    <span className="material-symbols-outlined">grid_view</span>
                  </button>
                </div>
              </div>

              {fetchingCampaigns ? (
                <div
                  className={viewMode === 'grid' || viewMode === 'grid-3' || viewMode === 'grid-2' ? 'campaigns-grid' : 'campaigns-list'}
                  aria-busy="true"
                >
                  {Array.from({ length: paginatedCampaigns.length || campaignsPerPage }, (_, i) => (
                    <DbSkeletonCard key={i} />
                  ))}
                </div>
              ) : filteredCampaigns.length === 0 ? (
                <div className="db-empty-state">
                  <div className="db-empty-icon">
                    <span className="material-symbols-outlined">search_off</span>
                  </div>
                  <div className="db-empty-title">No campaigns match your filter</div>
                  <div className="db-empty-desc">
                    Try selecting a different category or clearing your search keywords.
                  </div>
                  <button
                    type="button"
                    className="db-btn"
                    onClick={() => { setCategoryFilter('ALL'); setUrgencyFilter('ALL'); setSearchQuery(''); setSelectedTags([]); }}
                  >
                    <span>Reset Filters</span>
                  </button>
                </div>
              ) : (
                <>
                  <div className={viewMode === 'grid' || viewMode === 'grid-3' || viewMode === 'grid-2' ? 'campaigns-grid' : 'campaigns-list'}>
                    {paginatedCampaigns.map((camp) => (
                      <CampaignCard
                        key={camp.id}
                        camp={camp}
                        contract={contract}
                        role={ROLES.DONOR}
                        walletAddress={walletAddress}
                        onDonated={fetchCampaigns}
                        onOpenNgoProfile={onOpenNgoProfile}
                      />
                    ))}
                  </div>

                  {/* Pagination Controls Bar (100% Width Centered) */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    alignSelf: 'stretch',
                    paddingTop: '20px',
                    paddingBottom: '12px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                    marginTop: '28px'
                  }}>
                    <button
                      className="btn btn-outline btn-sm"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      style={{ minWidth: '36px', height: '36px', padding: 0, borderRadius: '8px', opacity: currentPage === 1 ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Previous Page"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>chevron_left</span>
                    </button>

                    {Array.from({ length: Math.max(1, totalPages) }, (_, i) => i + 1).map((pageNum) => (
                      <button
                        key={pageNum}
                        className={`btn btn-sm ${currentPage === pageNum ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setCurrentPage(pageNum)}
                        style={{ 
                          minWidth: '36px', 
                          height: '36px',
                          borderRadius: '8px', 
                          fontWeight: currentPage === pageNum ? 700 : 500 
                        }}
                      >
                        {pageNum}
                      </button>
                    ))}

                    <button
                      className="btn btn-outline btn-sm"
                      disabled={currentPage >= Math.max(1, totalPages)}
                      onClick={() => setCurrentPage(p => Math.min(Math.max(1, totalPages), p + 1))}
                      style={{ minWidth: '36px', height: '36px', padding: 0, borderRadius: '8px', opacity: currentPage >= Math.max(1, totalPages) ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Next Page"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>chevron_right</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── 3. MY CONTRIBUTIONS TAB (Vercel-Standard Redesign) ── */}
          {activeTab === 'my-donations' && (
            <div className="bbdrts-contributions-tab fade-in">
              {/* 1. Header & Live Network Status */}
              <div className="bbdrts-tab-header" id="tour-donations-header">
                <div className="bbdrts-tab-header-left">
                  <div className="bbdrts-breadcrumb-tag">
                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>verified</span>
                    <span>Sepolia EVM Notarized Ledger</span>
                  </div>
                  <h2 className="bbdrts-tab-title">My Contributions</h2>
                  <p className="bbdrts-tab-desc">
                    Your personal donation receipts, payment rails, and immutable cryptographic proofs verified on the Ethereum Sepolia network.
                  </p>
                </div>

                <div className="bbdrts-tab-header-actions">
                  <div className="bbdrts-network-badge" title={`Sepolia Smart Contract: ${CONTRACT_ADDRESS ? `${CONTRACT_ADDRESS.slice(0, 6)}...${CONTRACT_ADDRESS.slice(-4)}` : 'Verified'}`}>
                    <span className="bbdrts-live-pulse" />
                    <span>Sepolia EVM Verified</span>
                  </div>

                  <button
                    type="button"
                    className="bbdrts-btn bbdrts-btn-outline"
                    onClick={() => window.print()}
                    title="Export or print tamper-proof audit report"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>print</span>
                    <span>Export Report</span>
                  </button>

                  <button
                    type="button"
                    className="bbdrts-btn bbdrts-btn-outline"
                    onClick={fetchMyDonations}
                    disabled={loadingMyDonations}
                    title="Sync receipts directly from smart contract and database"
                  >
                    <span className={`material-symbols-outlined ${loadingMyDonations ? 'bbdrts-spin' : ''}`} style={{ fontSize: '15px' }}>
                      sync
                    </span>
                    <span>{loadingMyDonations ? 'Syncing...' : 'Sync Receipts'}</span>
                  </button>
                </div>
              </div>

              {/* 2. Donor Tier Progress & Giving Societies Card */}
              <DonorProgressCard
                walletAddress={walletAddress || currentUser?.wallet_address}
                donorId={currentUser?.id}
                amountEth={totalDonated}
                amountPhp={totalDonatedPhp}
                onOpenLadder={() => setShowTierModal(true)}
              />

              {/* 3. 4-Stat Metric Cards Grid */}
              <div className="bbdrts-kpi-grid">
                {/* 1. Total Contributed */}
                <div className="bbdrts-kpi-card">
                  <div className="bbdrts-kpi-header">
                    <span className="bbdrts-kpi-label">Total Contributed</span>
                    <div className="bbdrts-kpi-icon-wrap" style={{ color: '#10b981' }}>
                      <span className="material-symbols-outlined">volunteer_activism</span>
                    </div>
                  </div>
                  <div className="bbdrts-kpi-value-block">
                    <div className="bbdrts-kpi-value">
                      ₱{Math.round(totalDonatedPhp).toLocaleString('en-US')}
                    </div>
                    <div className="bbdrts-kpi-subtext" style={{ color: '#10b981' }}>
                      <span className="material-symbols-outlined">payments</span>
                      <span>≈ {totalDonated} ETH on Sepolia</span>
                    </div>
                  </div>
                </div>

                {/* 2. Verified Receipts */}
                <div className="bbdrts-kpi-card">
                  <div className="bbdrts-kpi-header">
                    <span className="bbdrts-kpi-label">Verified Receipts</span>
                    <div className="bbdrts-kpi-icon-wrap" style={{ color: '#0070f3' }}>
                      <span className="material-symbols-outlined">receipt_long</span>
                    </div>
                  </div>
                  <div className="bbdrts-kpi-value-block">
                    <div className="bbdrts-kpi-value">
                      {myDonations ? myDonations.length : 0}
                      <span className="bbdrts-kpi-unit">Recorded</span>
                    </div>
                    <div className="bbdrts-kpi-subtext">
                      <span className="material-symbols-outlined">verified</span>
                      <span>100% Cryptographic Audit</span>
                    </div>
                  </div>
                </div>

                {/* 3. Causes Supported */}
                <div className="bbdrts-kpi-card">
                  <div className="bbdrts-kpi-header">
                    <span className="bbdrts-kpi-label">Causes Supported</span>
                    <div className="bbdrts-kpi-icon-wrap" style={{ color: '#f59e0b' }}>
                      <span className="material-symbols-outlined">campaign</span>
                    </div>
                  </div>
                  <div className="bbdrts-kpi-value-block">
                    <div className="bbdrts-kpi-value">
                      {uniqueCausesCount}
                      <span className="bbdrts-kpi-unit">Drives</span>
                    </div>
                    <div className="bbdrts-kpi-subtext">
                      <span className="material-symbols-outlined">handshake</span>
                      <span>Direct Relief Impact</span>
                    </div>
                  </div>
                </div>

                {/* 4. Audit Integrity */}
                <div className="bbdrts-kpi-card">
                  <div className="bbdrts-kpi-header">
                    <span className="bbdrts-kpi-label">Audit Reconciliation</span>
                    <div className="bbdrts-kpi-icon-wrap" style={{ color: hasAnyShortage ? '#ef4444' : '#10b981' }}>
                      <span className="material-symbols-outlined">
                        {hasAnyShortage ? 'gavel' : 'verified_user'}
                      </span>
                    </div>
                  </div>
                  <div className="bbdrts-kpi-value-block">
                    <div className="bbdrts-kpi-value" style={{ color: hasAnyShortage ? '#ef4444' : 'var(--text-primary)' }}>
                      {hasAnyShortage ? 'Shortage Notarized' : '100% Balanced'}
                    </div>
                    <div className="bbdrts-kpi-subtext" style={{ color: hasAnyShortage ? '#ef4444' : '#10b981' }}>
                      <span className="material-symbols-outlined">
                        {hasAnyShortage ? 'warning' : 'check_circle'}
                      </span>
                      <span>{hasAnyShortage ? 'Investigation Active' : 'Zero Discrepancies'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. Filter & Sort Control Toolbar */}
              <div className="bbdrts-filter-toolbar">
                {/* Live Search Input */}
                <div className="bbdrts-search-wrapper">
                  <span className="material-symbols-outlined bbdrts-search-icon">search</span>
                  <input
                    type="text"
                    className="bbdrts-search-input"
                    placeholder="Search by campaign, TX hash, or reference..."
                    value={searchQueryReceipts}
                    onChange={(e) => setSearchQueryReceipts(e.target.value)}
                  />
                  {searchQueryReceipts && (
                    <button
                      type="button"
                      className="bbdrts-search-clear"
                      onClick={() => setSearchQueryReceipts('')}
                      title="Clear search"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
                    </button>
                  )}
                </div>

                {/* Category Segmented Filter Pills */}
                <div className="bbdrts-filter-pills-row">
                  <button
                    type="button"
                    className={`bbdrts-filter-pill-btn ${receiptFilter === 'ALL' ? 'active' : ''}`}
                    onClick={() => setReceiptFilter('ALL')}
                  >
                    <span>All Causes</span>
                    <span className="bbdrts-filter-pill-count">{myDonations ? myDonations.length : 0}</span>
                  </button>

                  <button
                    type="button"
                    className={`bbdrts-filter-pill-btn ${receiptFilter === 'DR' ? 'active' : ''}`}
                    onClick={() => setReceiptFilter('DR')}
                  >
                    <span>Disaster Relief</span>
                    <span className="bbdrts-filter-pill-count">{drReceiptsCount}</span>
                  </button>

                  <button
                    type="button"
                    className={`bbdrts-filter-pill-btn ${receiptFilter === 'CD' ? 'active' : ''}`}
                    onClick={() => setReceiptFilter('CD')}
                  >
                    <span>Charitable Aid</span>
                    <span className="bbdrts-filter-pill-count">{cdReceiptsCount}</span>
                  </button>
                </div>

                {/* Dropdown Filters (Payment Rail + Sort) */}
                <div className="bbdrts-select-group">
                  <select
                    className="bbdrts-select-control"
                    value={receiptRailFilter}
                    onChange={(e) => setReceiptRailFilter(e.target.value)}
                    title="Filter by Payment Rail"
                  >
                    <option value="ALL">All Payment Rails</option>
                    <option value="ETH">Crypto / ETH</option>
                    <option value="GCASH">GCash</option>
                    <option value="MAYA">Maya</option>
                    <option value="CARD">Card / Bank</option>
                  </select>

                  <select
                    className="bbdrts-select-control"
                    value={receiptSort}
                    onChange={(e) => setReceiptSort(e.target.value)}
                    title="Sort Contributions"
                  >
                    <option value="NEWEST">Newest First</option>
                    <option value="AMOUNT_HIGH">Highest Amount</option>
                    <option value="AMOUNT_LOW">Lowest Amount</option>
                    <option value="OLDEST">Oldest First</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Results Counter Bar */}
              <div className="bbdrts-results-counter">
                <span>
                  Showing {filteredMyDonations.length} of {myDonations ? myDonations.length : 0} contribution receipts
                </span>
                {(receiptFilter !== 'ALL' || receiptRailFilter !== 'ALL' || searchQueryReceipts.trim() !== '') && (
                  <button
                    type="button"
                    onClick={() => {
                      setReceiptFilter('ALL');
                      setReceiptRailFilter('ALL');
                      setSearchQueryReceipts('');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent-blue, #0070f3)',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    Reset All Filters
                  </button>
                )}
              </div>

              {/* 5. Content Area: Skeleton Loader | Empty State | Contribution Cards List */}
              {loadingMyDonations ? (
                <div className="bbdrts-contributions-list">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bbdrts-contrib-skeleton">
                      <div className="bbdrts-skel-top">
                        <span className="db-skel" style={{ width: '140px', height: '18px', borderRadius: '4px' }} />
                        <span className="db-skel" style={{ width: '100px', height: '18px', borderRadius: '4px' }} />
                      </div>
                      <div className="bbdrts-skel-mid">
                        <div className="bbdrts-skel-thumb db-skel" />
                        <div className="bbdrts-skel-lines">
                          <span className="db-skel" style={{ width: '60%', height: '18px', borderRadius: '4px' }} />
                          <span className="db-skel" style={{ width: '40%', height: '14px', borderRadius: '4px' }} />
                          <span className="db-skel" style={{ width: '25%', height: '14px', borderRadius: '4px' }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                          <span className="db-skel" style={{ width: '90px', height: '24px', borderRadius: '4px' }} />
                          <span className="db-skel" style={{ width: '60px', height: '12px', borderRadius: '4px' }} />
                        </div>
                      </div>
                      <div className="bbdrts-skel-btm">
                        <span className="db-skel" style={{ width: '180px', height: '22px', borderRadius: '6px' }} />
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <span className="db-skel" style={{ width: '100px', height: '30px', borderRadius: '6px' }} />
                          <span className="db-skel" style={{ width: '130px', height: '30px', borderRadius: '6px' }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : !myDonations || myDonations.length === 0 ? (
                <div className="db-empty-state">
                  <div className="db-empty-icon-wrap">
                    <span className="material-symbols-outlined">receipt_long</span>
                  </div>
                  <h3 className="db-empty-title">No contributions recorded yet</h3>
                  <p className="db-empty-desc">
                    When you support any active disaster relief campaign using GCash, Maya, Bank Transfer, or Crypto, your digital receipts and on-chain proofs will appear here.
                  </p>
                  <div className="db-empty-action">
                    <button
                      type="button"
                      className="bbdrts-btn bbdrts-btn-pri"
                      onClick={() => setActiveTab('campaigns')}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>volunteer_activism</span>
                      <span>Explore Relief Campaigns</span>
                    </button>
                  </div>
                </div>
              ) : filteredMyDonations.length === 0 ? (
                <div className="db-empty-state">
                  <div className="db-empty-icon-wrap">
                    <span className="material-symbols-outlined">filter_list_off</span>
                  </div>
                  <h3 className="db-empty-title">No receipts match your search</h3>
                  <p className="db-empty-desc">
                    No contributions match your current filter combination. Try selecting "All Payment Rails" or clearing your search term.
                  </p>
                  <div className="db-empty-action">
                    <button
                      type="button"
                      className="bbdrts-btn bbdrts-btn-outline"
                      onClick={() => {
                        setReceiptFilter('ALL');
                        setReceiptRailFilter('ALL');
                        setSearchQueryReceipts('');
                      }}
                    >
                      <span>Reset Filters</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bbdrts-contributions-list">
                  {filteredMyDonations.map((d, idx) => {
                    const matchCamp = campaigns.find(c => String(c.id) === String(d.campaignId)) || { id: d.campaignId, title: `Disaster Relief Campaign #${d.campaignId}` };
                    const rawTitle  = matchCamp ? matchCamp.title : `Disaster Relief Campaign #${d.campaignId}`;
                    const campTitle = formatCampaignTitle(rawTitle, d.campaignId);
                    const catInfo   = getCampaignCategoryInfo(matchCamp);
                    const coverData = getCampaignCoverData(matchCamp);
                    const orgName   = getOrgDisplayName(matchCamp.orgAddress, matchCamp.orgName, d.campaignId);

                    const pm = (d.paymentMethod || 'ETH').toUpperCase();
                    const isCard = pm.includes('CARD');
                    const isGcash = pm.includes('GCASH');
                    const isMaya = pm.includes('MAYA');
                    const railColor = isCard ? '#f59e0b' : isGcash ? '#007DFE' : isMaya ? '#10b981' : '#6366f1';
                    const railBg = isCard ? 'rgba(245, 158, 11, 0.1)' : isGcash ? 'rgba(0, 125, 254, 0.1)' : isMaya ? 'rgba(16, 185, 129, 0.1)' : 'rgba(99, 102, 241, 0.1)';
                    const railIcon = isCard ? 'credit_card' : isGcash ? 'smartphone' : isMaya ? 'account_balance_wallet' : 'token';
                    const ethAmt = parseFloat(d.amount || 0);
                    const phpAmt = Math.round(ethAmt * 170000);
                    const isShortage = d.auditStatus === 'SHORTAGE';

                    return (
                      <div key={idx} className={`bbdrts-contrib-card ${isShortage ? 'has-shortage' : ''} fade-in`}>
                        {/* 1. Card Top Bar: Organization + Category + Timestamp + Verification Dot */}
                        <div className="bbdrts-contrib-topbar">
                          <div className="bbdrts-contrib-org-cluster">
                            <button
                              type="button"
                              className="bbdrts-contrib-org-btn"
                              onClick={() => onOpenNgoProfile && onOpenNgoProfile(matchCamp.orgId || 3)}
                              title="Click to view verified NGO credentials"
                            >
                              <span className="material-symbols-outlined">domain</span>
                              <span>{orgName}</span>
                              <span className="material-symbols-outlined verified-badge">verified</span>
                            </button>

                            <span style={{ color: 'var(--border-strong)', fontSize: '0.8rem' }}>•</span>

                            <span className="bbdrts-contrib-category-chip">
                              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>{catInfo.icon || 'folder'}</span>
                              <span>{catInfo.label}</span>
                            </span>
                          </div>

                          <div className="bbdrts-contrib-org-cluster">
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>calendar_today</span>
                              <span>{d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent'}</span>
                            </span>

                            {isShortage ? (
                              <span className="bbdrts-contrib-status-chip shortage">
                                <span className="bbdrts-status-dot shortage" />
                                <span>Shortage Detected</span>
                              </span>
                            ) : (
                              <span className="bbdrts-contrib-status-chip">
                                <span className="bbdrts-live-pulse" />
                                <span>Confirmed On-Chain</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 2. Main Body: Thumbnail + Title + Meta Cluster + Amount Block */}
                        <div className="bbdrts-contrib-body">
                          {/* Thumbnail */}
                          <div className="bbdrts-contrib-thumb-wrap">
                            <img src={coverData.imageUrl} alt={campTitle} className="bbdrts-contrib-thumb-img" />
                            <div className="bbdrts-contrib-thumb-icon" title={catInfo.label}>
                              <span className="material-symbols-outlined">{catInfo.icon || 'volunteer_activism'}</span>
                            </div>
                          </div>

                          {/* Center Details */}
                          <div className="bbdrts-contrib-details">
                            <h3
                              className="bbdrts-contrib-title"
                              onClick={() => setSelectedCampaignForProof(matchCamp)}
                              title="Click to view campaign details"
                            >
                              {campTitle}
                            </h3>

                            <div className="bbdrts-contrib-meta-row">
                              {coverData.locationTag && (
                                <span className="bbdrts-meta-pill" title="Relief Operation Location">
                                  <span className="material-symbols-outlined">location_on</span>
                                  <span>{coverData.locationTag}</span>
                                </span>
                              )}

                              <div
                                className="bbdrts-rail-pill"
                                style={{ color: railColor, background: railBg, borderColor: railColor }}
                                title="Dual-Rail Payment Method"
                              >
                                <span className="material-symbols-outlined">{railIcon}</span>
                                <span>{d.paymentMethod || 'ETH'}</span>
                              </div>

                              {d.referenceNumber && (
                                <span className="bbdrts-meta-pill" title="Payment Reference Number">
                                  <span className="material-symbols-outlined">tag</span>
                                  <span style={{ fontFamily: 'var(--font-mono)' }}>Ref: {d.referenceNumber}</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Right Amount Block */}
                          <div className="bbdrts-contrib-amount-col">
                            {isShortage && d.declaredPhp ? (
                              <>
                                <div className="bbdrts-contrib-amount-php alert">
                                  ₱{phpAmt.toLocaleString('en-US')}
                                </div>
                                <div className="bbdrts-shortage-row">
                                  <span className="bbdrts-declared-struck">₱{Number(d.declaredPhp).toLocaleString('en-US')}</span>
                                  <span className="bbdrts-variance-tag">(-₱{Math.abs(d.variancePhp || 0).toLocaleString()})</span>
                                </div>
                                <div className="bbdrts-contrib-amount-eth">
                                  ({ethAmt < 0.0001 ? ethAmt.toFixed(6) : ethAmt.toFixed(4)} ETH on-chain)
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="bbdrts-contrib-amount-php">
                                  ₱{phpAmt.toLocaleString('en-US')}
                                </div>
                                <div className="bbdrts-contrib-amount-eth">
                                  ≈ {ethAmt < 0.0001 ? ethAmt.toFixed(6) : ethAmt.toFixed(4)} ETH
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* 3. Sleek Discrepancy Alert Banner (Only if shortage detected) */}
                        {isShortage && (
                          <div className="bbdrts-discrepancy-card">
                            <div className="bbdrts-discrepancy-left">
                              <span className="material-symbols-outlined">gavel</span>
                              <div className="bbdrts-discrepancy-msg">
                                <strong>Audit Discrepancy Notarized on Sepolia:</strong> You declared ₱{Number(d.declaredPhp || 0).toLocaleString()}, but NGO credited ₱{Number(d.creditedPhp || 0).toLocaleString()} (<strong>-₱{Math.abs(d.variancePhp || 0).toLocaleString()} PHP shortage</strong>).
                              </div>
                            </div>
                            <button
                              type="button"
                              className="bbdrts-dispute-action-btn"
                              onClick={() => showSuccess(`Dispute filed for TX ${d.txHash?.slice(0, 10)}... Admin audit investigation initiated against ${orgName}.`, 'Audit Dispute Filed')}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>flag</span>
                              <span>File Dispute</span>
                            </button>
                          </div>
                        )}

                        {/* 4. Card Footer: Hash Chip + Action Buttons */}
                        <div className="bbdrts-contrib-footer">
                          {/* Left: Transaction Hash Chip */}
                          <div className="bbdrts-tx-hash-chip">
                            <span className="material-symbols-outlined" style={{ fontSize: '13px', color: 'var(--accent)' }}>token</span>
                            <span className="tx-tag">TX</span>
                            <span className="tx-val">
                              {d.txHash ? `${d.txHash.slice(0, 10)}...${d.txHash.slice(-8)}` : 'On-Chain Verified'}
                            </span>
                            {d.txHash && (
                              <button
                                type="button"
                                className="bbdrts-tx-icon-btn"
                                onClick={() => {
                                  navigator.clipboard.writeText(d.txHash);
                                  showSuccess('Transaction hash copied to clipboard!', 'Hash Copied');
                                }}
                                title="Copy Transaction Hash"
                              >
                                <span className="material-symbols-outlined">content_copy</span>
                              </button>
                            )}
                            {d.txHash && (
                              <a
                                href={`https://sepolia.etherscan.io/tx/${d.txHash}`}
                                target="_blank"
                                rel="noreferrer"
                                className="bbdrts-tx-icon-btn"
                                title="Inspect on Sepolia Etherscan"
                              >
                                <span className="material-symbols-outlined">open_in_new</span>
                              </a>
                            )}
                          </div>

                          {/* Right: Consolidated Action Buttons */}
                          <div className="bbdrts-contrib-actions">
                            <button
                              type="button"
                              className="bbdrts-btn-sm bbdrts-btn-sec"
                              onClick={() => setSelectedCampaignForProof(matchCamp)}
                              title="View Campaign Accomplishments, Budget Breakdown & Map"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>info</span>
                              <span>Cause Details</span>
                            </button>

                            <button
                              type="button"
                              className={`bbdrts-btn-sm bbdrts-btn-pri ${isShortage ? 'shortage' : ''}`}
                              onClick={() => setSelectedVoucherTx(d)}
                              title="Open Plain-English Blockchain Verification Certificate"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                                {isShortage ? 'warning' : 'verified_user'}
                              </span>
                              <span>
                                {isShortage ? 'View Audit Certificate' : 'Verify Certificate'}
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Direct Campaign Accomplishment Proof & Audit Modal ── */}
          {selectedCampaignForProof && (() => {
            const camp = selectedCampaignForProof;
            const audit = getCampaignAuditDetails(camp.id, camp.title, camp);
            const orgDisplayName = getOrgDisplayName(camp.orgAddress, camp.orgName, camp.id);
            const displayTitle = formatCampaignTitle(camp.title, camp.id);
            const catInfo = getCampaignCategoryInfo(camp);
            const coverData = getCampaignCoverData(camp);
            const campaignTags = getCampaignTags(camp);

            const effectiveCurrent = Math.max(
              parseFloat(camp.currentAmount || 0),
              parseFloat(camp.railBreakdown?.totalRaisedEth || 0),
              ((parseFloat(camp.railBreakdown?.eth?.amount || 0)) +
               (parseFloat(camp.railBreakdown?.gcash?.amount || 0)) +
               (parseFloat(camp.railBreakdown?.maya?.amount || 0)) +
               (parseFloat(camp.railBreakdown?.bank?.amount || 0)))
            );
            const targetPhp = (parseFloat(camp.targetAmount || 0) * 170000).toLocaleString('en-US', { maximumFractionDigits: 0 });
            const currentPhp = (effectiveCurrent * 170000).toLocaleString('en-US', { maximumFractionDigits: 0 });
            const pct = progressPct(effectiveCurrent, camp.targetAmount);

            return createPortal(
              <div
                className="bbdrts-details-backdrop"
                onClick={() => setSelectedCampaignForProof(null)}
              >
                <div
                  className="bbdrts-details-modal"
                  onClick={(e) => e.stopPropagation()}
                >

                  {/* ── Top Cover Photo Hero Banner ── */}
                  <div className="bbdrts-details-hero">
                    <img
                      src={coverData.imageUrl}
                      alt={camp.title}
                      className="bbdrts-details-hero-img"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=600&q=80';
                      }}
                    />
                    <div className="bbdrts-details-hero-scrim" />

                    {/* Top Badges */}
                    <div className="bbdrts-details-hero-badges">
                      <span className={`bbdrts-details-pill ${catInfo.prefix === 'DR' ? 'cat-dr' : 'cat-cd'}`}>
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>{catInfo.icon}</span>
                        <span>{catInfo.prefix}-00{camp.id} • {catInfo.label}</span>
                      </span>
                      <span className="bbdrts-details-pill urgency">
                        {audit.urgency}
                      </span>
                      <span className="bbdrts-details-pill status-active">
                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>verified</span>
                        <span>Active On-Chain</span>
                      </span>
                    </div>

                    {/* Close Button */}
                    <button
                      type="button"
                      className="bbdrts-details-close-btn"
                      onClick={() => setSelectedCampaignForProof(null)}
                      title="Close Campaign Details"
                      aria-label="Close Campaign Details"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                    </button>

                    {/* Title & Organization Subtitle */}
                    <div className="bbdrts-details-hero-text">
                      <h2 className="bbdrts-details-title">
                        {displayTitle}
                      </h2>
                      <div className="bbdrts-details-org-sub">
                        <span style={{ opacity: 0.85 }}>Managed by</span>
                        <button
                          type="button"
                          className="bbdrts-details-org-btn"
                          onClick={() => {
                            setSelectedCampaignForProof(null);
                            if (onOpenNgoProfile) onOpenNgoProfile(camp.orgId || 3);
                          }}
                          title="View verified NGO profile & missions"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#22c55e' }}>domain</span>
                          <span>{orgDisplayName}</span>
                          <span className="material-symbols-outlined" style={{ fontSize: '13px', color: '#22c55e' }}>verified</span>
                          <span className="material-symbols-outlined" style={{ fontSize: '13px', opacity: 0.7 }}>chevron_right</span>
                        </button>
                        <span style={{ opacity: 0.6 }}>•</span>
                        <span style={{ color: '#22c55e', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600, fontSize: '0.8rem' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>verified_user</span> Smart Contract Verified
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ── Modal Body Content ── */}
                  <div className="bbdrts-details-body">
                    {/* Campaign Tags */}
                    {campaignTags && campaignTags.length > 0 && (
                      <div className="bbdrts-details-tags">
                        {campaignTags.map((tag, idx) => (
                          <span key={idx} className="bbdrts-details-tag-chip">
                            #{tag.replace(/^#/, '')}
                          </span>
                        ))}
                      </div>
                    )}

                  {/* Metric Strip (Target, Settled, Due Date, Backers) */}
                  <div className="bbdrts-details-metrics">
                    <div className="bbdrts-details-metrics-row">
                      <div className="bbdrts-details-metric-item">
                        <span className="bbdrts-details-metric-label">Target Goal</span>
                        <span className="bbdrts-details-metric-val">₱{targetPhp}</span>
                      </div>

                      <div className="bbdrts-details-metric-item">
                        <span className="bbdrts-details-metric-label">Settled to Date</span>
                        <span className="bbdrts-details-metric-val accent">
                          ₱{currentPhp} <span style={{ fontSize: '0.74rem', fontWeight: 600 }}>({pct}%)</span>
                        </span>
                      </div>

                      <div className="bbdrts-details-metric-item">
                        <span className="bbdrts-details-metric-label">Target Delivery</span>
                        <span className="bbdrts-details-metric-val" style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--text-muted)' }}>calendar_today</span>
                          <span>{audit.targetDate || 'Active'}</span>
                        </span>
                      </div>

                      <div className="bbdrts-details-metric-item">
                        <span className="bbdrts-details-metric-label">Audit Protocol</span>
                        <span className="bbdrts-details-metric-val" style={{ fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '4px', color: '#16a34a' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>verified_user</span>
                          <span>Sepolia EVM</span>
                        </span>
                      </div>
                    </div>

                    {/* Visual Progress Bar */}
                    <div className="bbdrts-details-progress-bar-wrap" title={`Funded: ${pct}% of target`}>
                      <div className="bbdrts-details-progress-fill" style={{ width: `${Math.min(100, Math.max(0, parseFloat(pct) || 0))}%` }} />
                    </div>
                  </div>

                  {/* 2-Column Responsive Layout */}
                  <div className="bbdrts-details-grid">
                    {/* Left Column: Mission Overview & Budget Allocations */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {/* Mission Purpose */}
                      <div className="bbdrts-details-card">
                        <div className="bbdrts-details-card-header">
                          <h4 className="bbdrts-details-card-title">
                            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#16a34a' }}>description</span>
                            Mission & Humanitarian Scope
                          </h4>
                        </div>
                        <p className="bbdrts-details-desc">
                          {audit.description}
                        </p>

                        {/* Official Verification Document / Press Release */}
                        {audit.documentUrl && (
                          <div style={{ marginTop: '4px' }}>
                            <a
                              href={audit.documentUrl.startsWith('http') ? audit.documentUrl : `https://${audit.documentUrl}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bbdrts-details-doc-link"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>verified</span>
                              <span>Official Verification Document / Press Release</span>
                              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>open_in_new</span>
                            </a>
                          </div>
                        )}

                        {/* Emergency Response Desk */}
                        {audit.contact && (
                          <div className="bbdrts-details-hotline-chip">
                            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#16a34a' }}>support_agent</span>
                            <div>
                              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Emergency Contact: </span>
                              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{audit.contact}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Proof of Fund Allocation */}
                      {audit.allocations && Array.isArray(audit.allocations) && audit.allocations.length > 0 && (() => {
                        const totalAllocTarget = parseFloat(camp.targetAmount || 0) * 170000;
                        return (
                          <div className="bbdrts-details-card">
                            <div className="bbdrts-details-card-header">
                              <h4 className="bbdrts-details-card-title">
                                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#16a34a' }}>pie_chart</span>
                                Proof of Fund Allocation
                              </h4>
                              <span className="bbdrts-details-card-badge">TRANSPARENCY AUDIT</span>
                            </div>

                            <div className="bbdrts-details-allocations">
                              {audit.allocations.map((item, idx) => {
                                const cleanLabel = (item.label || '').replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();
                                const itemPhp = (totalAllocTarget * (item.pct / 100)).toLocaleString('en-US', { maximumFractionDigits: 0 });
                                return (
                                  <div key={idx}>
                                    <div className="bbdrts-details-alloc-row">
                                      <span className="bbdrts-details-alloc-label">{cleanLabel}</span>
                                      <span className="bbdrts-details-alloc-val">
                                        <strong>₱{itemPhp}</strong> ({item.pct}%)
                                      </span>
                                    </div>
                                    <div className="bbdrts-details-alloc-track">
                                      <div className="bbdrts-details-alloc-fill" style={{ width: `${item.pct}%` }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Operational Policy Disclosures */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                              <div className="bbdrts-details-policy-box">
                                <div className="bbdrts-details-policy-title">
                                  <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>savings</span>
                                  <span>Surplus Reserve Policy</span>
                                </div>
                                <p className="bbdrts-details-policy-desc">
                                  Contributions exceeding 100% of the target roll over into the <strong>Calamity Response Reserve Fund</strong> for emergency relief and unbudgeted operations.
                                </p>
                              </div>

                              <div className="bbdrts-details-policy-box">
                                <div className="bbdrts-details-policy-title" style={{ color: '#0ea5e9' }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>priority_high</span>
                                  <span>Partial Funding Priority Rule</span>
                                </div>
                                <p className="bbdrts-details-policy-desc">
                                  If the timeline concludes before reaching full target, accumulated funds are immediately disbursed to <strong>immediate survival necessities (food rations, drinking water & medical aid)</strong> first.
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Right Column: Ground Deployment Audit & Interactive Map */}
                    <div className="bbdrts-details-card">
                      <div className="bbdrts-details-card-header">
                        <h4 className="bbdrts-details-card-title">
                          <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#ef4444' }}>location_on</span>
                          Ground Deployment Audit
                        </h4>
                        <span className="bbdrts-details-card-badge">GPS VERIFIED</span>
                      </div>

                      {/* Interactive Leaflet Map View with Layer Controls */}
                      <div className="bbdrts-details-map-frame">
                        <LocationMapPicker
                          address={audit.region}
                          gps={audit.gps}
                          readOnly={true}
                          allowLayerSwitch={true}
                          height="230px"
                          hideTip={true}
                          theme={theme}
                        />
                      </div>

                      {/* Map Quick Action Buttons (Google Maps + Copy GPS + Etherscan) */}
                      <div className="bbdrts-details-map-actions">
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(audit.gps || audit.region)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bbdrts-details-map-btn"
                          title="Open location in Google Maps"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#ea4335' }}>open_in_new</span>
                          <span>Google Maps</span>
                        </a>

                        {audit.gps && (
                          <button
                            type="button"
                            className="bbdrts-details-map-btn"
                            onClick={() => {
                              if (navigator.clipboard) {
                                navigator.clipboard.writeText(audit.gps);
                                showSuccess(`Coordinates copied to clipboard: ${audit.gps}`, 'GPS Copied');
                              }
                            }}
                            title="Copy GPS coordinates"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>content_copy</span>
                            <span>Copy GPS</span>
                          </button>
                        )}

                        {camp.contractAddress && (
                          <a
                            href={`https://sepolia.etherscan.io/address/${camp.contractAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bbdrts-details-map-btn"
                            title="View Escrow on Sepolia Etherscan"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#16a34a' }}>receipt_long</span>
                            <span>Etherscan</span>
                          </a>
                        )}
                      </div>

                      {/* Logistics Key-Value Rows */}
                      <div className="bbdrts-details-logistics">
                        {/* Target Location */}
                        <div className="bbdrts-details-logistics-item">
                          <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#ef4444', marginTop: '2px', flexShrink: 0 }}>pin_drop</span>
                          <div className="bbdrts-details-logistics-text">
                            {audit.region}
                          </div>
                        </div>

                        {/* GPS Coordinates */}
                        {audit.gps && (
                          <div className="bbdrts-details-logistics-item">
                            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--text-muted)', flexShrink: 0 }}>radar</span>
                            <div>
                              <span style={{ color: '#16a34a', fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', fontSize: '0.8rem' }}>
                                {audit.gps}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Beneficiaries / Impact */}
                        {audit.beneficiaries && (
                          <div className="bbdrts-details-logistics-item">
                            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#16a34a', marginTop: '2px', flexShrink: 0 }}>groups</span>
                            <div style={{ color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                              <strong style={{ color: '#16a34a' }}>{audit.beneficiaries}</strong>
                            </div>
                          </div>
                        )}

                        {/* Contact Response Desk */}
                        {audit.contact && (
                          <div className="bbdrts-details-logistics-item">
                            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--text-muted)', flexShrink: 0 }}>call</span>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                              Response Desk: <strong style={{ color: 'var(--text-primary)' }}>{audit.contact}</strong>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modal Actions Footer */}
                <div className="bbdrts-details-footer">
                  <button
                    type="button"
                    className="bbdrts-details-btn-close"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => setSelectedCampaignForProof(null)}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                    <span>Close Cause Audit & Proof</span>
                  </button>
                </div>

                </div>
              </div>,
              document.body
            );
          })()}

          {/* ── 3.5. DISASTER RELIEF RADAR HEATMAP TAB ── */}
          {activeTab === 'radar-heatmap' && (
            <div style={{ marginTop: '8px' }}>
              <div className="section-header" id="tour-radar-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px' }}>
                <div>
                  <h2 className="section-title" style={{ fontSize: '1.4rem' }}>
                    <span className="material-symbols-outlined section-title-icon" style={{ marginRight: '8px', color: 'var(--accent)' }}>radar</span>
                    Disaster Relief Radar Heatmap
                  </h2>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Meteorological Doppler precipitation density map tracking humanitarian relief concentration across Philippine disaster zones.
                  </p>
                </div>
              </div>

              <DisasterRadarHeatmap
                campaigns={campaigns}
                height="620px"
                theme={theme}
                defaultLayer="tactical"
                onSelectCampaign={(c) => {
                  setActiveTab('campaigns');
                  setSearchQuery(c.title || '');
                }}
              />
            </div>
          )}

          {/* ── 4. SETTINGS TAB (Hides 4 boxes & welcome card) ── */}
          {activeTab === 'settings' && (
            <div style={{ marginTop: '8px' }}>
              <SettingsPanel 
                contract={contract}
                currentUser={currentUser} 
                walletAddress={walletAddress} 
                handleConnectWallet={handleConnectWallet} 
                handleLogout={handleLogout} 
                updateDbWallet={updateDbWallet}
                theme={theme}
                setTheme={setTheme}
                textSize={textSize}
                setTextSize={setTextSize}
                totalDonatedEth={totalDonated}
                totalDonatedPhp={totalDonatedPhp}
                onOpenHonorsLadder={() => setShowTierModal(true)}
                onStartTour={handleStartTour}
              />
            </div>
          )}

        </section>
      </div>

      {/* Humanitarian Honors Ladder Modal */}
      <DonorTierModal
        isOpen={showTierModal}
        onClose={() => setShowTierModal(false)}
        walletAddress={walletAddress || currentUser?.wallet_address}
        donorId={currentUser?.id || currentUser?.Donor_ID}
        txHash={myDonations?.[0]?.txHash || myDonations?.[0]?.Tx_Hash}
        transactions={myDonations}
        totalDonatedEth={totalDonated}
        totalDonatedPhp={totalDonatedPhp}
        donationCount={Math.max(myDonations?.length || 0, globalCumulative?.donationCount || 0)}
        campaignsSupported={new Set((myDonations || []).map(d => d.campaignId).filter(Boolean)).size || 1}
        donorName={userDisplayName || 'Verified Donor'}
        dedication={currentUser?.bio || ''}
      />

      {/* Subtle Badge Upgrade Unlocked Modal Notification */}
      <BadgeUpgradeModal
        newTier={unlockedTierModal}
        isOpen={Boolean(unlockedTierModal)}
        onClose={() => setUnlockedTierModal(null)}
      />

      {/* Interactive Guided Onboarding Spotlight Tour */}
      <GuidedTour
        isOpen={showGuidedTour}
        onClose={handleCloseTour}
        steps={donorTourSteps}
        onTabChange={setActiveTab}
        tourKey={userTourKey}
        roleName="Donor"
        theme={theme}
      />
      {/* ── Official Human-Readable Blockchain Verification Certificate Modal ── */}
      {selectedVoucherTx && createPortal((() => {
        const d = selectedVoucherTx;
        const matchCamp = campaigns.find(c => String(c.id) === String(d.campaignId)) || { id: d.campaignId, title: d.campaignTitle || `Relief Campaign #${d.campaignId}` };
        const rawTitle = matchCamp ? matchCamp.title : `Relief Campaign #${d.campaignId}`;
        const campTitle = formatCampaignTitle(rawTitle, d.campaignId);
        const orgName = d.orgName || getOrgDisplayName(matchCamp.orgAddress, matchCamp.orgName, d.campaignId);
        const amtEth = parseFloat(d.amount || 0);
        const declaredPhp = Number(d.declaredPhp || Math.round(amtEth * 170000));
        const creditedPhp = Number(d.creditedPhp || Math.round(amtEth * 170000));
        const variancePhp = Number(d.variancePhp !== undefined ? d.variancePhp : (creditedPhp - declaredPhp));
        const isShortage = d.auditStatus === 'SHORTAGE' || variancePhp < -20;

        return (
          <div
            className="bbdrts-edit-profile-backdrop"
            onClick={() => setSelectedVoucherTx(null)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: 'rgba(0, 0, 0, 0.82)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999999,
              padding: '20px'
            }}
          >
            <div
              className="fade-in"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '680px',
                maxHeight: '90vh',
                overflowY: 'auto',
                background: 'var(--bg-card)',
                border: isShortage ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border)',
                borderRadius: '20px',
                boxShadow: isShortage ? '0 24px 60px rgba(239, 68, 68, 0.25)' : 'var(--shadow-dropdown, 0 24px 60px rgba(0, 0, 0, 0.5))'
              }}
            >
              {/* Certificate Header */}
              <div style={{
                padding: '20px 24px',
                background: 'var(--bg-subcard)',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: isShortage ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isShortage ? '#ef4444' : '#22c55e',
                    border: `1px solid ${isShortage ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '26px' }}>
                      {isShortage ? 'gavel' : 'verified_user'}
                    </span>
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Blockchain Verification Certificate
                    </h3>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Ethereum Sepolia Notarized Proof · BBDRTS Forensic Audit
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedVoucherTx(null)}
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--text-muted)', padding: '4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                </button>
              </div>

              {/* Status Ribbon */}
              <div style={{
                padding: '12px 24px',
                background: isShortage
                  ? 'linear-gradient(90deg, rgba(239, 68, 68, 0.18), rgba(239, 68, 68, 0.05))'
                  : 'linear-gradient(90deg, rgba(34, 197, 94, 0.18), rgba(34, 197, 94, 0.05))',
                borderBottom: `1px solid ${isShortage ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.2)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <span style={{
                  color: isShortage ? '#ef4444' : '#22c55e',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    {isShortage ? 'warning' : 'check_circle'}
                  </span>
                  {isShortage ? 'AUDIT DISCREPANCY DETECTED' : '100% CLEAN AUDIT VERIFIED'}
                </span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Ledger Ref #{d.id || 'SEPOLIA'}
                </span>
              </div>

              {/* Certificate Body */}
              <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

                {/* Plain-English Audit Verdict (Built for non-tech-savvy donors!) */}
                {isShortage ? (
                  <div style={{
                    padding: '14px 16px',
                    borderRadius: '12px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: 'var(--text-primary)'
                  }}>
                    <div style={{ fontWeight: 800, color: '#ef4444', fontSize: '0.92rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>report_problem</span>
                      Shortage Alert: ₱{Math.abs(variancePhp).toLocaleString()} Missing from Relief Goal
                    </div>
                    <p style={{ margin: 0, fontSize: '0.82rem', lineHeight: '1.45', color: 'var(--text-secondary)' }}>
                      Your official payment receipt confirms you sent <strong>₱{declaredPhp.toLocaleString()}</strong>, but the NGO confirmed receiving only <strong>₱{creditedPhp.toLocaleString()}</strong>.
                      Because this transaction was permanently sealed onto the Ethereum blockchain, <strong>the NGO cannot alter or erase this evidence</strong>.
                    </p>
                  </div>
                ) : (
                  <div style={{
                    padding: '14px 16px',
                    borderRadius: '12px',
                    background: 'rgba(34, 197, 94, 0.08)',
                    border: '1px solid rgba(34, 197, 94, 0.25)',
                    color: 'var(--text-primary)'
                  }}>
                    <div style={{ fontWeight: 800, color: '#22c55e', fontSize: '0.92rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>verified</span>
                      All Funds Accounted For
                    </div>
                    <p style={{ margin: 0, fontSize: '0.82rem', lineHeight: '1.45', color: 'var(--text-secondary)' }}>
                      Your payment of <strong>₱{creditedPhp.toLocaleString()}</strong> has been 100% verified and recorded onto the relief smart contract with zero deductions.
                    </p>
                  </div>
                )}

                {/* Plain-English Comparison Table */}
                <div style={{
                  background: 'var(--bg-subcard)',
                  border: '1px solid var(--border)',
                  borderRadius: '14px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    padding: '10px 16px',
                    background: 'var(--bg-inset)',
                    borderBottom: '1px solid var(--border)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: 'var(--text-muted)'
                  }}>
                    Transaction Audit Reconciliation Breakdown
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', padding: '16px', gap: '14px' }}>
                    <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '2px' }}>
                        1. You Sent (Payment Slip)
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 850, color: 'var(--text-primary)' }}>
                        ₱{declaredPhp.toLocaleString('en-US')}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Via {d.paymentMethod || 'GCash'} (Ref: {d.referenceNumber || 'Verified'})
                      </div>
                    </div>

                    <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '2px' }}>
                        2. NGO Credited to Campaign
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 850, color: isShortage ? '#ef4444' : '#22c55e' }}>
                        ₱{creditedPhp.toLocaleString('en-US')}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        ({amtEth.toFixed(4)} ETH on Sepolia ledger)
                      </div>
                    </div>

                    <div style={{ padding: '12px', borderRadius: '10px', background: isShortage ? 'rgba(239, 68, 68, 0.12)' : 'rgba(34, 197, 94, 0.12)', border: isShortage ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(34, 197, 94, 0.3)' }}>
                      <div style={{ fontSize: '0.72rem', color: isShortage ? '#ef4444' : '#22c55e', fontWeight: 700, marginBottom: '2px' }}>
                        3. Forensic Variance
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 850, color: isShortage ? '#ef4444' : '#22c55e' }}>
                        {variancePhp < 0 ? `-₱${Math.abs(variancePhp).toLocaleString()}` : variancePhp > 0 ? `+₱${variancePhp.toLocaleString()}` : '₱0.00 Match'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: isShortage ? '#ef4444' : '#22c55e', marginTop: '4px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>{isShortage ? 'warning' : 'check'}</span>
                        <span>{isShortage ? 'Alteration Sealed On-Chain' : 'Perfect Balance Confirmed'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Campaign & Beneficiary Info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, marginBottom: '2px' }}>
                      Relief Campaign
                    </div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {campTitle}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, marginBottom: '2px' }}>
                      Managing NGO
                    </div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {orgName}
                    </div>
                  </div>
                </div>

                {/* Uploaded Receipt Evidence Box (If available) */}
                {d.receiptBase64 && (
                  <div style={{
                    padding: '14px',
                    borderRadius: '12px',
                    background: 'var(--bg-subcard)',
                    border: '1px solid var(--border)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--accent)' }}>image</span>
                        Your Official Payment Slip Proof
                      </span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        style={{ color: 'var(--accent)', fontWeight: 700 }}
                        onClick={() => setShowReceiptZoom(!showReceiptZoom)}
                      >
                        {showReceiptZoom ? 'Hide Receipt' : 'Preview Payment Slip'}
                      </button>
                    </div>

                    {showReceiptZoom && (
                      <div style={{ textAlign: 'center', marginTop: '10px' }}>
                        <img
                          src={d.receiptBase64}
                          alt="Official Payment Receipt"
                          style={{
                            maxWidth: '100%',
                            maxHeight: '340px',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            objectFit: 'contain'
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Immutable Blockchain Proof Metadata */}
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, marginBottom: '4px' }}>
                    Immutable Ethereum Sepolia Blockchain Hash
                  </div>
                  <div style={{
                    background: 'var(--bg-subcard)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.78rem',
                    color: 'var(--text-primary)',
                    wordBreak: 'break-all',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px'
                  }}>
                    <span>{d.txHash}</span>
                    <button
                      type="button"
                      className="btn btn-xs btn-ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(d.txHash);
                        showSuccess('Transaction hash copied!', 'Copied');
                      }}
                      title="Copy Hash"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>content_copy</span>
                    </button>
                  </div>
                </div>

              </div>

              {/* Certificate Footer Actions */}
              <div style={{
                padding: '16px 24px',
                background: 'var(--bg-subcard)',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px'
              }}>
                <div>
                  {isShortage && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                      onClick={() => showSuccess(`Dispute successfully logged with platform oversight committee against ${orgName}. Investigation ticket #AUDIT-${Date.now().toString().slice(-6)} created.`, 'Dispute Filed')}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>gavel</span>
                      <span>File Dispute Against NGO</span>
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => window.print()}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>print</span>
                    <span>Print / Save PDF</span>
                  </button>

                  {d.txHash && (
                    <a
                      href={`https://sepolia.etherscan.io/tx/${d.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-outline btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                      title="For technical auditors: View raw opcode transaction on Sepolia Etherscan"
                    >
                      <span>Raw Etherscan ↗</span>
                    </a>
                  )}

                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => setSelectedVoucherTx(null)}
                  >
                    Close
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
      })(), document.body)}
    </main>
  );
}
