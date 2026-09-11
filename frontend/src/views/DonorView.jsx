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
import './ReferenceDashboard.css';

export default function DonorView({ contract, walletAddress, campaigns, fetchCampaigns, fetchingCampaigns, currentUser, handleConnectWallet, handleLogout, updateDbWallet, theme = 'default', setTheme, textSize, setTextSize, onOpenNgoProfile }) {
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
  const [receiptSort, setReceiptSort] = useState('NEWEST');
  const [searchQueryReceipts, setSearchQueryReceipts] = useState('');
  const [selectedCampaignForProof, setSelectedCampaignForProof] = useState(null);
  const [showTierModal, setShowTierModal] = useState(false);
  const [unlockedTierModal, setUnlockedTierModal] = useState(null);
  const [showGuidedTour, setShowGuidedTour] = useState(false);

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
      description: 'Your dashboard header displays your verified wallet address and current donor tier. Use the quick action buttons to open your Honors Ladder, jump directly to active relief appeals, or verify the public ledger on Etherscan.'
    },
    {
      target: '#tour-donor-badge-card',
      title: 'Honors Ladder & Tier Progress',
      icon: 'military_tech',
      badge: 'Donor Recognition',
      placement: 'bottom',
      align: 'start',
      description: 'Track your philanthropic journey across the 12-Tier Honors Ladder (from Tier 1 Contributor up to Tier 12 Mythic Patron). This card shows your progress toward the next tier based on your cumulative verified contributions. Click the button to explore all 12 tiers.'
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
    { id: 'dark',  name: 'Dark', icon: 'dark_mode', desc: 'Dark Contrast', activeBorder: '#22c55e', color: '#22c55e' },
    { id: 'light', name: 'Light', icon: 'light_mode', desc: 'Inverted Light', activeBorder: '#16a34a', color: '#16a34a' },
    { id: 'cyber', name: 'Cyber', icon: 'blur_on', desc: 'Cyber Navy', activeBorder: '#00ffa3', color: '#00ffa3' }
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

  // Pagination for Relief Campaigns (4 for list, 6 for grid)
  const [currentPage, setCurrentPage] = useState(1);
  const campaignsPerPage = viewMode === 'list' ? 4 : 6;

  // Reset page on any filter or viewMode change
  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, selectedTags, urgencyFilter, progressFilter, statusFilter, campaignSort, searchQuery, viewMode]);

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

    window.addEventListener('bbdrts_navigate_radar', handleRadarNav);
    window.addEventListener('bbdrts_navigate_campaigns', handleCampaignsNav);
    window.addEventListener('bbdrts_navigate_home', handleHomeNav);
    return () => {
      window.removeEventListener('bbdrts_navigate_radar', handleRadarNav);
      window.removeEventListener('bbdrts_navigate_campaigns', handleCampaignsNav);
      window.removeEventListener('bbdrts_navigate_home', handleHomeNav);
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

  const totalDonated = useMemo(() => {
    const listTotal = (!myDonations || !Array.isArray(myDonations) || myDonations.length === 0)
      ? 0
      : myDonations.reduce((acc, d) => acc + (parseFloat(d.amount || d.Amount || 0) || 0), 0);
    const registryTotal = globalCumulative?.totalEth || 0;
    return Math.max(listTotal, registryTotal).toFixed(4);
  }, [myDonations, globalCumulative]);

  const totalDonatedPhp = useMemo(() => {
    const calc = parseFloat(totalDonated || 0) * 170000;
    const regPhp = globalCumulative?.totalPhp || 0;
    return Math.max(calc, regPhp);
  }, [totalDonated, globalCumulative]);

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

  const uniqueCausesCount = useMemo(() => {
    if (!myDonations || !Array.isArray(myDonations)) return 0;
    const set = new Set(myDonations.map(d => String(d.campaignId)));
    return set.size;
  }, [myDonations]);

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
        if (searchQueryReceipts.trim() !== '') {
          const q = searchQueryReceipts.toLowerCase().trim();
          const tx = (d.txHash || '').toLowerCase();
          const campTitle = formatCampaignTitle(matchCamp.title, matchCamp.id).toLowerCase();
          return tx.includes(q) || campTitle.includes(q) || String(d.campaignId).includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        if (receiptSort === 'AMOUNT_HIGH') return (parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0);
        if (receiptSort === 'AMOUNT_LOW') return (parseFloat(a.amount) || 0) - (parseFloat(b.amount) || 0);
        return 0;
      });
  }, [myDonations, receiptFilter, searchQueryReceipts, receiptSort, campaigns]);

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
              <div className="ref-sidebar-id">BBDRTS-DONOR-2026-0001</div>
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
              <span className="material-symbols-outlined">history</span>
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

          <div className="ref-sidebar-widget" id="tour-donor-sepolia-node">
            <div className="ref-widget-header">
              <div className="ref-status-dot"></div>
              <span className="ref-widget-title">Sepolia Node Health</span>
            </div>
            <div className="ref-widget-detail">
              <div className="ref-widget-row">
                <span>Smart Contract</span>
                <span className="ref-widget-value green">● Synchronized</span>
              </div>
              <div className="ref-widget-row">
                <span>EVM Gateway</span>
                <span className="ref-widget-value">Sepolia Testnet</span>
              </div>
              <div className="ref-widget-row">
                <span>Verification</span>
                <span className="ref-widget-value">Automated</span>
              </div>
            </div>
          </div>

          {/* ── 🎨 3-Mode Theme Switcher Widget (Dark, Light, Cyber Navy) ── */}
          <div className="ref-sidebar-widget" style={{ marginTop: '16px' }}>
            <div className="ref-widget-header">
              <span className="material-symbols-outlined" style={{ fontSize: '16px', color: theme === 'dark' ? '#22c55e' : theme === 'light' ? '#f59e0b' : '#00ffa3' }}>
                palette
              </span>
              <span className="ref-widget-title">Interface Theme</span>
            </div>
            
            <div className="ref-theme-grid">
              {THEME_OPTIONS.map(t => {
                const isSelected = theme === t.id;
                const activeClass = isSelected ? `active-${t.id}` : '';
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      if (setTheme) {
                        setTheme(t.id);
                        showSuccess(`${t.name} enabled`, 'Theme Updated');
                      }
                    }}
                    className={`ref-theme-btn ${activeClass}`}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: t.color }}>
                      {t.icon}
                    </span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>{t.name.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* ── Main Content Area ── */}
        <section className="ref-main-content">

          {/* Sleek Top Status Capsules (Matching Reference Screenshot) */}
          <div className="ref-top-pill-strip" style={{ marginBottom: '4px' }}>
            <div className="ref-status-capsule">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>trending_up</span>
              <span>Sepolia Testnet Active</span>
            </div>
            <div className="ref-status-capsule">
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
              <span>Smart Contract: Immutable</span>
            </div>
            <div className="ref-status-capsule blue">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>verified_user</span>
              <span>0% Gateway Fees</span>
            </div>
            <div className="ref-status-capsule orange">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>warning</span>
              <span>Public Audit Ledger Live</span>
            </div>
          </div>

          {/* ── 1. DASHBOARD OVERVIEW TAB ONLY (Shows Welcome Banner + 4 Metric Cards) ── */}
          {activeTab === 'dashboard' && (
            <>
              {/* Top Hero Banner */}
              <div className="ref-welcome-card" id="tour-donor-welcome">
                <div className="ref-welcome-header" id="tour-donor-identity">
                  <div className="ref-welcome-avatar" style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {currentUser?.avatar_url && (currentUser.avatar_url.startsWith('data:') || currentUser.avatar_url.startsWith('http')) ? (
                      <img src={currentUser.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : currentUser?.avatar_url && currentUser.avatar_url.length < 30 ? (
                      <span className="material-symbols-outlined" style={{ fontSize: '28px', color: 'var(--accent)' }}>{currentUser.avatar_url}</span>
                    ) : (
                      userInitials
                    )}
                  </div>
                  <div className="ref-welcome-text">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <h1 style={{ margin: 0 }}>{userDisplayName || 'Donor Dashboard'}</h1>
                      <DonorBadge
                        size="md"
                        walletAddress={walletAddress || currentUser?.wallet_address}
                        donorId={currentUser?.id}
                        amountEth={totalDonated}
                        amountPhp={totalDonatedPhp}
                        onClick={() => setShowTierModal(true)}
                      />
                    </div>
                    <p style={{ marginTop: '4px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#22c55e', verticalAlign: 'middle', marginRight: '4px' }}>verified</span>
                      Verified Donor Account • Connected: <code style={{ color: 'var(--accent)', fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}>{shortAddr(walletAddress)}</code>
                    </p>
                  </div>
                </div>

                <div className="ref-action-btns" id="tour-donor-actions">
                  <button type="button" className="ref-btn-pill-primary" onClick={() => setShowTierModal(true)}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#eab308' }}>military_tech</span>
                    <span>Honors Ladder</span>
                  </button>
                  <button className="ref-btn-pill-primary" onClick={() => setActiveTab('campaigns')}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#22c55e' }}>volunteer_activism</span>
                    <span>Contribute to Relief</span>
                  </button>
                  <a href="https://sepolia.etherscan.io" target="_blank" rel="noreferrer" className="ref-btn-pill-primary" style={{ textDecoration: 'none' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>analytics</span>
                    <span>Public Ledger ↗</span>
                  </a>
                </div>
              </div>

              {/* Dynamic Donor Badge Progress & Recognition Card */}
              <div id="tour-donor-badge-card">
                <DonorProgressCard
                  walletAddress={walletAddress || currentUser?.wallet_address}
                  donorId={currentUser?.id}
                  amountEth={totalDonated}
                  amountPhp={totalDonatedPhp}
                  onOpenLadder={() => setShowTierModal(true)}
                />
              </div>

              {/* 4-Metric Stat Cards Grid (Reference Layout & Colors) */}
              <div className="ref-metrics-grid" id="tour-donor-metrics">
                {/* 1. Green Circle - Contributions */}
                <div className="ref-metric-card">
                  <div className="ref-metric-icon-circle green">
                    <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>volunteer_activism</span>
                  </div>
                  <div className="ref-metric-title">My Contributions</div>
                  <div style={{ margin: '10px 0 12px' }}>
                    <span className="ref-pill-badge">
                      {myDonations?.length ?? 0} receipts recorded
                    </span>
                  </div>
                  <div className="ref-metric-sub">Verified on Sepolia Ledger</div>
                </div>

                {/* 2. Blue Circle - Causes */}
                <div className="ref-metric-card">
                  <div className="ref-metric-icon-circle blue">
                    <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>campaign</span>
                  </div>
                  <div className="ref-metric-title">Relief Causes</div>
                  <div style={{ margin: '10px 0 12px' }}>
                    <span className="ref-pill-badge">
                      {campaigns.length} causes active
                    </span>
                  </div>
                  <div className="ref-metric-sub" style={{ color: '#0284c7' }}>Open for Aid Assistance</div>
                </div>

                {/* 3. Purple Circle - Verification & Health */}
                <div className="ref-metric-card">
                  <div className="ref-metric-icon-circle purple">
                    <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>verified</span>
                  </div>
                  <div className="ref-metric-title">Smart Contract</div>
                  <div style={{ margin: '10px 0 12px' }}>
                    <span className="ref-pill-badge">
                      EVM Level 1 Verified
                    </span>
                  </div>
                  <div className="ref-metric-sub" style={{ color: '#9333ea' }}>Chain ID: 11155111</div>
                </div>

                {/* 4. Orange Circle - Total Donated */}
                <div className="ref-metric-card">
                  <div className="ref-metric-icon-circle orange">
                    <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>account_balance_wallet</span>
                  </div>
                  <div className="ref-metric-title">Total Contributed</div>
                  <div style={{ margin: '10px 0 12px' }}>
                    <span className="ref-pill-badge">
                      {totalDonated} ETH
                    </span>
                  </div>
                  <div className="ref-metric-sub" style={{ color: '#f59e0b' }}>
                    ≈ ₱{(parseFloat(totalDonated) * 170000).toLocaleString()} PHP
                  </div>
                </div>
              </div>

              {/* Featured Campaigns Preview Section */}
              <div style={{ marginTop: '28px' }} id="tour-donor-featured-causes">
                <div className="section-header">
                  <h2 className="section-title">
                    <span className="material-symbols-outlined section-title-icon" style={{marginRight: '8px'}}>stars</span> Featured Relief Causes
                  </h2>
                  <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab('campaigns')}>
                    View All {campaigns.length} Campaigns →
                  </button>
                </div>

                {fetchingCampaigns && campaigns.length === 0 ? (
                  <div className="empty-state" id="tour-donor-first-campaign">
                    <div className="spinner spinner-light" style={{ width: 28, height: 28 }} />
                    <div className="empty-title">Reading from blockchain…</div>
                  </div>
                ) : campaigns.length === 0 ? (
                  <div className="empty-state" id="tour-donor-first-campaign">
                    <div className="empty-icon">📭</div>
                    <div className="empty-title">No active campaigns on the ledger yet</div>
                  </div>
                ) : (
                  <div className="campaigns-list">
                    {campaigns.slice(0, 2).map((camp, cIdx) => (
                      <div key={camp.id} id={cIdx === 0 ? "tour-donor-first-campaign" : undefined} style={{ width: '100%' }}>
                        <CampaignCard
                          camp={camp}
                          contract={contract}
                          role={ROLES.DONOR}
                          walletAddress={walletAddress}
                          onDonated={fetchCampaigns}
                          onOpenNgoProfile={onOpenNgoProfile}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── 2. DEDICATED RELIEF CAMPAIGNS TAB (Hides 4 boxes & welcome card) ── */}
          {activeTab === 'campaigns' && (
            <div style={{ marginTop: '8px' }} id="tour-campaigns-container">
              <div className="section-header">
                <div>
                  <h2 className="section-title" style={{ fontSize: '1.4rem' }}>
                    <span className="material-symbols-outlined section-title-icon" style={{marginRight: '8px', color: '#0284c7'}}>campaign</span> Active Disaster Relief Campaigns
                  </h2>
                  <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '4px' }}>
                    Select a verified cause to contribute testnet ETH. All transactions are recorded on the Sepolia blockchain ledger.
                  </p>
                </div>

                <button
                  className="btn btn-ghost btn-sm"
                  onClick={fetchCampaigns}
                  disabled={fetchingCampaigns}
                >
                  {fetchingCampaigns
                    ? <div className="spinner spinner-light" />
                    : '↻ Refresh Campaigns'}
                </button>
              </div>

              {/* ── Unified Campaign Toolbar: Filters on Left, Search & Sort on Right ── */}
              <div className="campaign-toolbar-card" id="tour-campaigns-toolbar">
                <div className="campaign-toolbar-unified-row">
                  {/* Left: Filters Header + Filter Pills (Causes, Priorities, Tags) */}
                  <div className="toolbar-filters-left">
                    <div className="toolbar-filters-header">
                      <span className="material-symbols-outlined">filter_list</span>
                      <span>Filters</span>
                    </div>

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
                        <span className="material-symbols-outlined filter-pill-icon" style={{ color: selectedCauseObj.color }}>{selectedCauseObj.icon}</span>
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
                        <span className="material-symbols-outlined filter-pill-icon" style={{ color: selectedPriorityObj.color }}>{selectedPriorityObj.icon}</span>
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
                        <span className="material-symbols-outlined filter-pill-icon" style={{ color: '#a855f7' }}>sell</span>
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
                          ✕
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
                  </div>
                </div>

                {/* Active Filters Bar */}
                {hasActiveFilters && (
                  <div className="campaign-active-filters-bar">
                    <div className="active-filters-left">
                      <span className="active-filters-label">Active filters:</span>

                      {/* Cause Chip */}
                      {categoryFilter !== 'ALL' && (
                        <div className="reference-active-chip">
                          <span className="material-symbols-outlined chip-icon" style={{ color: '#38bdf8' }}>public</span>
                          <span>{categoryFilter === 'DR' ? 'Disaster Relief' : 'Charitable Aid'}</span>
                          <button type="button" onClick={() => setCategoryFilter('ALL')} title="Remove filter">✕</button>
                        </div>
                      )}

                      {urgencyFilter !== 'ALL' && (
                        <div className="reference-active-chip">
                          <span className="material-symbols-outlined chip-icon" style={{ color: '#f59e0b' }}>bolt</span>
                          <span>{urgencyFilter === 'HIGH' ? 'High Priority' : urgencyFilter === 'MEDIUM' ? 'Medium Priority' : 'Standard Priority'}</span>
                          <button type="button" onClick={() => setUrgencyFilter('ALL')} title="Remove filter">✕</button>
                        </div>
                      )}

                      {/* Tag Chips */}
                      {selectedTags.map((tag) => (
                        <div key={tag} className="reference-active-chip">
                          <span className="material-symbols-outlined chip-icon" style={{ color: '#a855f7' }}>sell</span>
                          <span>#{tag}</span>
                          <button type="button" onClick={() => toggleTag(tag)} title={`Remove tag #${tag}`}>✕</button>
                        </div>
                      ))}

                      {/* Search Chip */}
                      {searchQuery.trim() && (
                        <div className="reference-active-chip">
                          <span className="material-symbols-outlined chip-icon" style={{ color: '#94a3b8' }}>search</span>
                          <span>"{searchQuery.trim()}"</span>
                          <button type="button" onClick={() => setSearchQuery('')} title="Clear search query">✕</button>
                        </div>
                      )}
                    </div>

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

              {/* ── Sub-strip Outside and Directly Below the Card ── */}
              <div className="campaign-toolbar-substrip">
                {/* Left: Showing # of # campaigns */}
                <div className="campaign-toolbar-count-tag">
                  <span className="count-indicator-dot" />
                  <span>Showing <strong>{filteredCampaigns.length}</strong> of {campaigns.length} campaigns</span>
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

              {fetchingCampaigns && campaigns.length === 0 ? (
                <div className="empty-state">
                  <div className="spinner spinner-light" style={{ width: 28, height: 28 }} />
                  <div className="empty-title">Reading campaigns from smart contract…</div>
                </div>
              ) : filteredCampaigns.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📭</div>
                  <div className="empty-title">No campaigns match this category</div>
                  <div className="empty-desc">
                    Try selecting a different category from the dropdown above.
                  </div>
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

          {/* ── 3. MY CONTRIBUTIONS TAB ── */}
          {activeTab === 'my-donations' && (
            <div style={{ marginTop: '8px' }}>
              <div className="section-header" id="tour-donations-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px', marginBottom: '16px' }}>
                <div>
                  <h2 className="section-title" style={{ fontSize: '1.4rem' }}>
                    <span className="material-symbols-outlined section-title-icon" style={{marginRight: '8px', color: '#22c55e'}}>verified</span>
                    My Contribution History & Audit Receipts
                  </h2>
                  <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '4px' }}>
                    Tamper-proof on-chain donation history verified by the Sepolia smart contract.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    className="btn btn-outline btn-sm" 
                    onClick={() => window.print()}
                    style={{ borderRadius: '8px', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>print</span>
                    <span>Export Audit Report</span>
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={fetchMyDonations} disabled={loadingMyDonations}>
                    {loadingMyDonations ? <div className="spinner spinner-light" /> : '↻ Refresh Receipts'}
                  </button>
                </div>
              </div>

              {/* Dynamic Donor Badge Progress & Recognition Card in History */}
              <DonorProgressCard
                walletAddress={walletAddress || currentUser?.wallet_address}
                donorId={currentUser?.id}
                amountEth={totalDonated}
                amountPhp={totalDonatedPhp}
                onOpenLadder={() => setShowTierModal(true)}
              />

              {/* 4-Stat Metric Cards Grid */}
              <div className="ref-metrics-grid" style={{ marginBottom: '20px' }}>
                {/* 1. Green: Total Contributed */}
                <div className="ref-metric-card">
                  <div className="ref-metric-icon-circle green">
                    <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>volunteer_activism</span>
                  </div>
                  <div className="ref-metric-title">Total Contributed</div>
                  <div style={{ margin: '10px 0 12px' }}>
                    <span className="ref-pill-badge" style={{ fontSize: '1.05rem', fontWeight: 800 }}>
                      {totalDonated} ETH
                    </span>
                  </div>
                  <div className="ref-metric-sub">Personal ETH Contributed</div>
                </div>

                {/* 2. Blue: Fiat Equivalent */}
                <div className="ref-metric-card">
                  <div className="ref-metric-icon-circle blue">
                    <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>currency_exchange</span>
                  </div>
                  <div className="ref-metric-title">Fiat Value (PHP)</div>
                  <div style={{ margin: '10px 0 12px' }}>
                    <span className="ref-pill-badge" style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0284c7' }}>
                      ≈ ₱{(parseFloat(totalDonated) * 170000).toLocaleString('en-US', {maximumFractionDigits: 0})}
                    </span>
                  </div>
                  <div className="ref-metric-sub" style={{ color: '#0284c7' }}>Real-Time Conversion</div>
                </div>

                {/* 3. Purple: Verified Receipts */}
                <div className="ref-metric-card">
                  <div className="ref-metric-icon-circle purple">
                    <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>receipt_long</span>
                  </div>
                  <div className="ref-metric-title">Verified Receipts</div>
                  <div style={{ margin: '10px 0 12px' }}>
                    <span className="ref-pill-badge" style={{ fontSize: '1.05rem', fontWeight: 800, color: '#9333ea' }}>
                      {myDonations ? myDonations.length : 0} recorded
                    </span>
                  </div>
                  <div className="ref-metric-sub" style={{ color: '#9333ea' }}>100% Sepolia EVM Audited</div>
                </div>

                {/* 4. Orange: Supported Causes */}
                <div className="ref-metric-card">
                  <div className="ref-metric-icon-circle orange">
                    <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>campaign</span>
                  </div>
                  <div className="ref-metric-title">Causes Supported</div>
                  <div style={{ margin: '10px 0 12px' }}>
                    <span className="ref-pill-badge" style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f59e0b' }}>
                      {uniqueCausesCount} campaigns
                    </span>
                  </div>
                  <div className="ref-metric-sub" style={{ color: '#f59e0b' }}>Direct Community Aid</div>
                </div>
              </div>

              {/* Filter & Sort Toolbar */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                gap: '12px', 
                marginBottom: '18px',
                flexWrap: 'wrap',
                background: 'var(--bg-surface, rgba(15, 23, 42, 0.4))',
                padding: '12px 18px',
                borderRadius: '12px',
                border: '1px solid var(--border, rgba(255, 255, 255, 0.06))',
                transition: 'background var(--transition), border-color var(--transition)'
              }}>
                {/* Live Search Input */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 240px', minWidth: '220px' }}>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <span className="material-symbols-outlined" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1rem', pointerEvents: 'none' }}>
                      search
                    </span>
                    <input
                      type="text"
                      placeholder="Search tx hash or campaign..."
                      value={searchQueryReceipts}
                      onChange={(e) => setSearchQueryReceipts(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'var(--bg-input, rgba(30, 41, 59, 0.9))',
                        color: 'var(--text-primary, #fff)',
                        border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                        borderRadius: '8px',
                        padding: '7px 28px 7px 32px',
                        fontSize: '0.82rem',
                        outline: 'none'
                      }}
                    />
                    {searchQueryReceipts && (
                      <button
                        onClick={() => setSearchQueryReceipts('')}
                        style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.82rem', padding: 0 }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Category:</span>
                  <select
                    value={receiptFilter}
                    onChange={(e) => setReceiptFilter(e.target.value)}
                    style={{
                      background: 'var(--bg-input, rgba(30, 41, 59, 0.9))',
                      color: 'var(--text-primary, #fff)',
                      border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                      borderRadius: '8px',
                      padding: '6px 12px',
                      fontSize: '0.82rem',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="ALL">All Receipts ({myDonations ? myDonations.length : 0})</option>
                    <option value="DR">🚨 Disaster Relief (DR)</option>
                    <option value="CD">🤝 Charitable Aid (CD)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Sort By:</span>
                  <select
                    value={receiptSort}
                    onChange={(e) => setReceiptSort(e.target.value)}
                    style={{
                      background: 'var(--bg-input, rgba(30, 41, 59, 0.9))',
                      color: 'var(--text-primary, #fff)',
                      border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                      borderRadius: '8px',
                      padding: '6px 12px',
                      fontSize: '0.82rem',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="NEWEST">✨ Newest First</option>
                    <option value="AMOUNT_HIGH">💎 Highest Amount</option>
                    <option value="AMOUNT_LOW">📉 Lowest Amount</option>
                  </select>
                </div>
              </div>

              {loadingMyDonations ? (
                <div className="empty-state">
                  <div className="spinner spinner-light" style={{ width: 28, height: 28 }} />
                  <div className="empty-title">Querying your donation events…</div>
                </div>
              ) : !myDonations || myDonations.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📭</div>
                  <div className="empty-title">No personal donations recorded yet</div>
                  <div className="empty-desc">
                    Go to the "Relief Campaigns" tab on the left sidebar to make your first contribution.
                  </div>
                </div>
              ) : filteredMyDonations.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📭</div>
                  <div className="empty-title">No receipts match this category</div>
                  <div className="empty-desc">
                    Try selecting a different category from the dropdown above.
                  </div>
                </div>
              ) : (
                <div className="my-donations-list" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {filteredMyDonations.map((d, idx) => {
                    const matchCamp = campaigns.find(c => String(c.id) === String(d.campaignId)) || { id: d.campaignId, title: `Disaster Relief Campaign #${d.campaignId}` };
                    const rawTitle  = matchCamp ? matchCamp.title : `Disaster Relief Campaign #${d.campaignId}`;
                    const campTitle = formatCampaignTitle(rawTitle, d.campaignId);
                    const catInfo   = getCampaignCategoryInfo(matchCamp);
                    const coverData = getCampaignCoverData(matchCamp);
                    const orgName   = getOrgDisplayName(matchCamp.orgAddress, matchCamp.orgName, d.campaignId);

                    return (
                      <div key={idx} className="contribution-receipt-card fade-in">
                        {/* 3-Column Card Body: Left Media, Center Meta, Right Amount & Proof CTA */}
                        <div className="receipt-card-body">
                          {/* Left: Compact Cover Thumbnail */}
                          <div className="receipt-media-thumb">
                            <img src={coverData.imageUrl} alt={campTitle} className="receipt-media-img" />
                            <div className="receipt-media-overlay" />
                            <div className="receipt-media-badge-top">
                              <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>{coverData.categoryIcon}</span>
                              <span>{coverData.categoryTag}</span>
                            </div>
                            <div className="receipt-media-badge-bottom">
                              <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>location_on</span>
                              <span>{coverData.locationTag}</span>
                            </div>
                          </div>

                          {/* Center: Metadata, Title & Organization */}
                          <div className="receipt-content-col">
                            <div className="receipt-badge-group">
                              <span className={`campaign-category-pill ${catInfo.colorClass}`}>
                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>{catInfo.icon}</span>
                                <span>{catInfo.prefix}-00{d.campaignId} • {catInfo.label}</span>
                              </span>

                              <span className="receipt-verified-tag">
                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>verified</span>
                                <span>Confirmed On-Chain</span>
                              </span>

                              {d.isAnonymous ? (
                                <span className="badge badge-info" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                                  Anonymous Contribution
                                </span>
                              ) : (
                                <span className="badge badge-active" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                                  Public Donor Record
                                </span>
                              )}
                            </div>

                            <h3 className="receipt-title">
                              {campTitle}
                            </h3>

                            <div className="receipt-meta-chips" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="campaign-org-badge"
                                onClick={() => {
                                  if (onOpenNgoProfile) {
                                    onOpenNgoProfile(matchCamp.orgId || 3);
                                  }
                                }}
                                title="Click to view verified NGO institutional profile"
                              >
                                <span className="material-symbols-outlined campaign-org-icon">domain</span>
                                <span className="campaign-org-name">{orgName}</span>
                                <span className="campaign-org-verified-badge" title="SEC Verified NGO">
                                  <span className="material-symbols-outlined">verified</span>
                                </span>
                                <span className="material-symbols-outlined campaign-org-arrow">chevron_right</span>
                              </button>

                              {coverData.locationTag && (
                                <button
                                  type="button"
                                  className="campaign-location-badge"
                                  onClick={() => setSelectedCampaignForProof(matchCamp)}
                                  title={`Relief Operation Area: ${coverData.locationTag} • Click to view Proof`}
                                >
                                  <span className="material-symbols-outlined campaign-location-icon">location_on</span>
                                  <span className="campaign-location-text">{coverData.locationTag}</span>
                                </button>
                              )}

                              <DonorBadge
                                size="sm"
                                walletAddress={walletAddress || currentUser?.wallet_address}
                                donorId={currentUser?.id}
                                amountEth={totalDonated}
                                amountPhp={totalDonatedPhp}
                                showLabel={false}
                                showTooltip={true}
                                showProgress={false}
                              />
                            </div>
                          </div>

                          {/* Right: Donation Amount & Direct Cause Proof Button */}
                          <div className="receipt-amount-col">
                            <div className="receipt-amount-box">
                              <div className="receipt-amount-eth">
                                +{d.amount} ETH
                              </div>
                              <div className="receipt-amount-php">
                                ≈ ₱{(parseFloat(d.amount || 0) * 170000).toLocaleString('en-US', {maximumFractionDigits: 2})} PHP
                              </div>
                            </div>

                            <button
                              type="button"
                              className="receipt-proof-view-btn"
                              onClick={() => setSelectedCampaignForProof(matchCamp)}
                              title="View Campaign Accomplishments, Budget Breakdown & Map"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>task_alt</span>
                              <span>View Cause & NGO Proof</span>
                            </button>
                          </div>
                        </div>

                        {/* Bottom Row: Blockchain Proof Bar */}
                        <div className="receipt-proof-bar">
                          <div className="receipt-tx-meta">
                            <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--accent)' }}>receipt_long</span>
                            <span style={{ color: 'var(--text-secondary)' }}>TX Hash:</span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                              {d.txHash ? `${d.txHash.slice(0, 18)}...${d.txHash.slice(-10)}` : 'On-Chain Verified'}
                            </span>
                          </div>

                          <div className="receipt-actions">
                            {d.txHash && (
                              <button
                                type="button"
                                className="receipt-copy-btn"
                                onClick={() => {
                                  navigator.clipboard.writeText(d.txHash);
                                  showSuccess('Transaction hash copied to clipboard!', 'Hash Copied');
                                }}
                                title="Copy TX Hash"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>content_copy</span>
                                <span>Copy Hash</span>
                              </button>
                            )}

                            {d.txHash && (
                              <a
                                href={`https://sepolia.etherscan.io/tx/${d.txHash}`}
                                target="_blank"
                                rel="noreferrer"
                                className="receipt-etherscan-link"
                                title="Inspect on Sepolia Etherscan"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>open_in_new</span>
                                <span>Inspect on Etherscan</span>
                              </a>
                            )}
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
              <div style={{
                position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                background: 'rgba(5, 7, 12, 0.85)', backdropFilter: 'blur(14px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999
              }} className="fade-in">
                
                <div className="card bounce-in" style={{ 
                  width: '680px', 
                  maxWidth: '94vw', 
                  maxHeight: '92vh',
                  overflowY: 'auto',
                  padding: '24px 28px', 
                  background: 'var(--bg-card, #1a1a1a)', 
                  border: '1px solid var(--border, rgba(255, 255, 255, 0.1))', 
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 24px rgba(34, 197, 94, 0.12)', 
                  borderRadius: '20px',
                  color: 'var(--text-primary, #ffffff)'
                }}>

                  {/* Modal Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border, rgba(255, 255, 255, 0.08))', paddingBottom: '16px', marginBottom: '18px' }}>
                    <div style={{ flex: 1, minWidth: 0, paddingRight: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                        <span className={`campaign-category-pill ${catInfo.colorClass}`} style={{ fontSize: '0.72rem', padding: '3px 10px' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>{catInfo.icon}</span>
                          <span>{catInfo.prefix}-00{camp.id} • {catInfo.label}</span>
                        </span>
                        <span className="badge" style={{ fontSize: '0.72rem', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.3)', padding: '3px 10px', fontWeight: 700 }}>
                          {audit.urgency}
                        </span>
                        <span className="badge" style={{ fontSize: '0.72rem', background: 'rgba(34, 197, 94, 0.12)', color: '#22c55e', borderColor: 'rgba(34, 197, 94, 0.3)', padding: '3px 10px', fontWeight: 700 }}>
                          ● Active On-Chain
                        </span>
                      </div>
                      <h2 style={{ margin: 0, fontSize: '1.35rem', color: 'var(--text-primary, #ffffff)', fontWeight: 800, lineHeight: 1.3 }}>
                        {displayTitle}
                      </h2>
                      <div style={{ margin: '8px 0 0 0', fontSize: '0.84rem', color: 'var(--text-muted, #94a3b8)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span>Managed by</span>
                        <button
                          type="button"
                          className="campaign-modal-org-btn"
                          onClick={() => {
                            setSelectedCampaignForProof(null);
                            if (onOpenNgoProfile) onOpenNgoProfile(camp.orgId || 3);
                          }}
                          title="Click to view verified institutional profile"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--accent, #22c55e)' }}>domain</span>
                          <span>{orgDisplayName}</span>
                          <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--accent, #22c55e)' }}>verified</span>
                          <span className="material-symbols-outlined" style={{ fontSize: '13px', opacity: 0.6 }}>chevron_right</span>
                        </button>
                        <span>•</span>
                        <span style={{ color: '#22c55e', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>verified</span> Smart Contract Verified
                        </span>
                      </div>
                    </div>

                    <button 
                      onClick={() => setSelectedCampaignForProof(null)}
                      style={{
                        background: 'var(--bg-input, rgba(255, 255, 255, 0.06))',
                        border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
                        color: 'var(--text-muted, #94a3b8)',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1rem',
                        flexShrink: 0
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  {/* Financial & Progress Metric Capsule Bar */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                    gap: '10px',
                    background: 'var(--bg-surface, rgba(255, 255, 255, 0.03))',
                    border: '1px solid var(--border, rgba(255, 255, 255, 0.06))',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    marginBottom: '18px'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted, #94a3b8)', fontWeight: 700, letterSpacing: '0.5px' }}>
                        Target Campaign Goal
                      </div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary, #ffffff)', marginTop: '2px' }}>
                        ₱{targetPhp} <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94a3b8)', fontWeight: 600 }}>({camp.targetAmount} ETH)</span>
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted, #94a3b8)', fontWeight: 700, letterSpacing: '0.5px' }}>
                        Settled to Date
                      </div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#22c55e', marginTop: '2px' }}>
                        ₱{currentPhp} <span style={{ fontSize: '0.74rem', color: '#22c55e', fontWeight: 700 }}>({pct}% Funded)</span>
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted, #94a3b8)', fontWeight: 700, letterSpacing: '0.5px' }}>
                        Audit Protocol
                      </div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#22c55e', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>gavel</span> Sepolia EVM Audited
                      </div>
                    </div>
                  </div>

                  {/* 1. Target Region & Location GPS Interactive Map Box (2-Column Grid) */}
                  <div style={{ 
                    background: 'var(--bg-surface, rgba(255, 255, 255, 0.03))',
                    border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
                    borderRadius: '14px',
                    padding: '16px 18px',
                    marginBottom: '18px',
                    transition: 'background var(--transition), border-color var(--transition)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="material-symbols-outlined" style={{ color: '#ef4444', fontSize: '1.3rem' }}>
                          location_on
                        </span>
                        <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary, #ffffff)' }}>
                          Target Location & Interactive Audit Map
                        </span>
                      </div>
                      <span style={{ fontSize: '0.72rem', background: 'rgba(34, 197, 94, 0.12)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                        GPS LIVE AUDIT
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', alignItems: 'center' }}>
                      {/* Left: Location Meta */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>
                            Target Relief Location
                          </div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary, #ffffff)', marginTop: '3px', lineHeight: 1.35 }}>
                            📍 {audit.region}
                          </div>
                        </div>

                        {audit.gps && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #cbd5e1)' }}>
                            📡 <strong>Coordinates:</strong> <span style={{ color: '#22c55e', fontWeight: 700, fontFamily: 'var(--font-mono, monospace)' }}>{audit.gps}</span>
                          </div>
                        )}

                        <div style={{
                          background: 'var(--bg-input, rgba(0, 0, 0, 0.25))',
                          border: '1px solid var(--border, rgba(255, 255, 255, 0.06))',
                          borderRadius: '10px',
                          padding: '10px 12px'
                        }}>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>
                            Estimated Beneficiaries / Impact Scope
                          </div>
                          <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#22c55e', marginTop: '2px' }}>
                            {audit.beneficiaries}
                          </div>
                          {audit.contact && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)', marginTop: '4px' }}>
                              📞 Response Desk: <span style={{ color: 'var(--text-secondary, #cbd5e1)', fontWeight: 600 }}>{audit.contact}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Interactive Map */}
                      <div style={{
                        width: '100%',
                        height: '200px',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                        background: 'var(--bg-input, #111111)'
                      }}>
                        <LocationMapPicker
                          address={audit.region}
                          gps={audit.gps}
                          readOnly={true}
                          height="200px"
                          hideTip={true}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2. Mission Description */}
                  <div style={{ 
                    background: 'var(--bg-surface, rgba(255, 255, 255, 0.03))', 
                    border: '1px solid var(--border, rgba(255, 255, 255, 0.08))', 
                    borderRadius: '12px', 
                    padding: '16px', 
                    marginBottom: '18px',
                    transition: 'background var(--transition), border-color var(--transition)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <h4 style={{ margin: 0, fontSize: '0.92rem', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '1.15rem' }}>description</span> Mission Purpose & Humanitarian Scope
                      </h4>
                      {audit.targetDate && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #e2e8f0)', background: 'var(--bg-input, rgba(0, 0, 0, 0.3))', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--border, rgba(255,255,255,0.08))' }}>
                          📅 Target: {audit.targetDate}
                        </span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary, #cbd5e1)', lineHeight: '1.6', whiteSpace: 'pre-line' }}>
                      {audit.description}
                    </p>
                  </div>

                  {/* 3. Necessities & Fund Allocation Breakdown */}
                  {audit.allocations && Array.isArray(audit.allocations) && audit.allocations.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{ fontSize: '0.92rem', color: 'var(--text-primary, #ffffff)', fontWeight: 800, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="material-symbols-outlined" style={{ color: '#22c55e', fontSize: '1.2rem' }}>pie_chart</span>
                        Transparency Allocation & Necessities Breakdown
                      </h4>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
                        {audit.allocations.map((item, i) => (
                          <div key={i} style={{
                            background: 'var(--bg-surface, rgba(255, 255, 255, 0.03))',
                            border: '1px solid var(--border, rgba(255, 255, 255, 0.06))',
                            borderRadius: '10px',
                            padding: '10px 12px'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary, #e2e8f0)' }}>
                                {item.label}
                              </span>
                              <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#22c55e' }}>
                                {item.pct}%
                              </span>
                            </div>
                            <div style={{ background: 'var(--bg-input, rgba(0, 0, 0, 0.3))', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${item.pct}%`, height: '100%', background: 'linear-gradient(90deg, #16a34a, #22c55e)' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Modal Footer Action */}
                  <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                    <button 
                      className="btn btn-outline btn-full" 
                      style={{ padding: '12px', fontSize: '0.88rem' }} 
                      onClick={() => setSelectedCampaignForProof(null)}
                    >
                      Close Cause Audit & Proof
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
        totalDonatedEth={totalDonated}
        totalDonatedPhp={totalDonatedPhp}
        donationCount={Math.max(myDonations?.length || 0, globalCumulative?.donationCount || 0)}
        donorName={userDisplayName || 'Verified Donor'}
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
    </main>
  );
}
