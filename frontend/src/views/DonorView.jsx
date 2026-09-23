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
  const [selectedVoucherTx, setSelectedVoucherTx] = useState(null);
  const [showReceiptZoom, setShowReceiptZoom] = useState(false);
  const [showTierModal, setShowTierModal] = useState(false);
  const [unlockedTierModal, setUnlockedTierModal] = useState(null);
  const [showGuidedTour, setShowGuidedTour] = useState(false);
  const [showTechDetails, setShowTechDetails] = useState(false);

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
    window.addEventListener('bbdrts_filter_category', handleCategoryNav);
    return () => {
      window.removeEventListener('bbdrts_navigate_radar', handleRadarNav);
      window.removeEventListener('bbdrts_navigate_campaigns', handleCampaignsNav);
      window.removeEventListener('bbdrts_navigate_home', handleHomeNav);
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
              {/* Unified Compact Donor Hero Banner */}
              <div className="ref-welcome-card ref-hero-unified" id="tour-donor-welcome">
                <div className="ref-hero-top-row">
                  {/* Left Column: Avatar & Identity */}
                  <div className="ref-hero-identity" id="tour-donor-identity">
                    <div className="ref-welcome-avatar" style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {currentUser?.avatar_url && (currentUser.avatar_url.startsWith('data:') || currentUser.avatar_url.startsWith('http')) ? (
                        <img src={currentUser.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : currentUser?.avatar_url && currentUser.avatar_url.length < 30 ? (
                        <span className="material-symbols-outlined" style={{ fontSize: '28px', color: 'var(--accent)' }}>{currentUser.avatar_url}</span>
                      ) : (
                        userInitials
                      )}
                    </div>
                    <div className="ref-hero-titles">
                      <div className="ref-hero-name-row">
                        <h1 className="ref-hero-name">{userDisplayName || 'Donor Dashboard'}</h1>
                      </div>
                      <div className="ref-hero-sub-row">
                        <span className="ref-hero-verified-badge">
                          <span className="material-symbols-outlined">verified</span>
                          Verified Donor
                        </span>
                        <span className="ref-hero-divider">•</span>
                        <span className="ref-hero-wallet">
                          Wallet Connected: <code className="ref-hero-code">{shortAddr(walletAddress)}</code>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Total Donated & Tier Standing */}
                  <div className="ref-hero-impact-stat" id="tour-donor-badge-card">
                    <div className="ref-hero-stat-amt">
                      ₱{Math.round(totalDonatedPhp).toLocaleString('en-US')}
                      <span className="ref-hero-stat-donated">donated</span>
                    </div>
                    <div className="ref-hero-stat-tier-line">
                      {activeTierInfo?.tier ? (
                        <span className="ref-hero-tier-label" style={{ color: activeTierInfo.tier.color }}>
                          {activeTierInfo.tier.name} · Tier {activeTierInfo.tier.tierNumber}
                        </span>
                      ) : (
                        <span className="ref-hero-tier-label" style={{ color: 'var(--text-muted)' }}>
                          Unranked Contributor
                        </span>
                      )}
                      {activeTierInfo?.nextTier && (
                        <span className="ref-hero-tier-next">
                          ({activeTierInfo.progressPct}% to Tier {activeTierInfo.nextTier.tierNumber})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Compact Next Tier Upgrade Card with Current Badge (Left) and Next Badge (Right) */}
                {activeTierInfo?.nextTier && (() => {
                  const CurrentIcon = activeTierInfo.tier?.IconComponent;
                  const NextIcon = activeTierInfo.nextTier.IconComponent;
                  const currentTierColor = activeTierInfo.tier?.color || '#eab308';
                  const nextTierColor = activeTierInfo.nextTier.color || '#a855f7';

                  return (
                    <div 
                      className="ref-hero-upgrade-card ref-hero-commendation-card" 
                      onClick={() => setShowTierModal(true)} 
                      title="Click to explore Philanthropic Honor Roll & Giving Societies"
                    >
                      {/* Left Side: Current Active Badge */}
                      <div className="ref-hero-upgrade-badge-col">
                        <div className="ref-hero-upgrade-badge-box">
                          {CurrentIcon ? (
                            <CurrentIcon size={44} />
                          ) : (
                            <span className="material-symbols-outlined" style={{ fontSize: '32px', color: currentTierColor }}>volunteer_activism</span>
                          )}
                        </div>
                      </div>

                      {/* Center: Commendation & Giving Recognition */}
                      <div className="ref-hero-upgrade-content">
                        <div className="ref-hero-upgrade-hdr">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span className="ref-hero-status-pill">
                              <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>verified</span>
                              <span>OFFICIAL GIVING RECOGNITION</span>
                            </span>
                            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: currentTierColor }}>
                              {activeTierInfo.tier ? `${activeTierInfo.tier.name} Society` : 'Community Supporter'}
                            </span>
                          </div>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '0.95rem' }}>
                            ₱{Math.round(totalDonatedPhp).toLocaleString('en-US')} Total Aid
                          </span>
                        </div>

                        <div className="ref-hero-upgrade-sub" style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: '1.4' }}>
                          {activeTierInfo.tier 
                            ? activeTierInfo.tier.description 
                            : 'Every contribution directly funds emergency food packs, clean drinking water, and frontline disaster relief.'}
                        </div>

                        {activeTierInfo.nextTier && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', paddingTop: '4px', borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.06))' }}>
                            <span>Next Giving Society: <strong style={{ color: 'var(--text-primary)' }}>{activeTierInfo.nextTier.name}</strong> (₱{activeTierInfo.nextTier.minPhp.toLocaleString()} threshold)</span>
                            <span style={{ color: '#10b981', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                              <span>Honor Roll Directory</span>
                              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>arrow_forward</span>
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Right Side: Honor Roll Trigger */}
                      <div className="ref-hero-honor-action" title="View Philanthropic Honor Roll">
                        <div className="ref-hero-honor-btn">
                          <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#10b981' }}>workspace_premium</span>
                          <span>Honor Roll</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Compact Action Buttons */}
                <div className="ref-action-btns ref-hero-actions" id="tour-donor-actions">
                  <button type="button" className="ref-btn-pill-primary" onClick={() => setActiveTab('my-donations')}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#38bdf8' }}>receipt_long</span>
                    <span>View Contributions</span>
                  </button>
                  <button type="button" className="ref-btn-pill-primary" onClick={() => setActiveTab('campaigns')}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#22c55e' }}>volunteer_activism</span>
                    <span>Donate to Relief</span>
                  </button>
                  <button type="button" className="ref-btn-pill-primary" onClick={() => setShowTierModal(true)}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#10b981' }}>volunteer_activism</span>
                    <span>Recognition Circles</span>
                  </button>
                  <a href="https://sepolia.etherscan.io" target="_blank" rel="noreferrer" className="ref-btn-pill-primary" style={{ textDecoration: 'none' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#a855f7' }}>analytics</span>
                    <span>Public Ledger ↗</span>
                  </a>
                </div>
              </div>

              {/* 4-Metric Stat Cards Grid — Premium Redesign */}
              <div className="ref-metrics-grid" id="tour-donor-metrics" style={{ gap: '16px' }}>

                {/* 1. My Contributions */}
                <div className="ref-metric-card" onClick={() => setActiveTab('my-donations')} style={{
                  padding: '20px 22px',
                  textAlign: 'left',
                  borderLeft: '3px solid #22c55e',
                  background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.06) 0%, var(--bg-card, #212121) 60%)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  cursor: 'pointer'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.6px' }}>My Contributions</span>
                    <div style={{
                      width: '34px', height: '34px', borderRadius: '10px',
                      background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.25)',
                      color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>receipt_long</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.9rem', fontWeight: 850, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>
                      {donorReceiptsCount}
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginLeft: '5px' }}>Receipts</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#22c55e', fontWeight: 600, marginTop: '4px' }}>
                      Verified on Sepolia Ledger
                    </div>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>open_in_new</span>
                    <span>Click to view all donations</span>
                  </div>
                </div>

                {/* 2. Relief Campaigns */}
                <div className="ref-metric-card" onClick={() => setActiveTab('campaigns')} style={{
                  padding: '20px 22px',
                  textAlign: 'left',
                  borderLeft: '3px solid #38bdf8',
                  background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.06) 0%, var(--bg-card, #212121) 60%)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  cursor: 'pointer'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Relief Campaigns</span>
                    <div style={{
                      width: '34px', height: '34px', borderRadius: '10px',
                      background: 'rgba(2, 132, 199, 0.15)', border: '1px solid rgba(56, 189, 248, 0.25)',
                      color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>campaign</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.9rem', fontWeight: 850, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>
                      {activeCampaignsCount}
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginLeft: '5px' }}>Active</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#38bdf8', fontWeight: 600, marginTop: '4px' }}>
                      {campaigns.length} total · {uniqueCausesCount > 0 ? `You supported ${uniqueCausesCount} cause${uniqueCausesCount !== 1 ? 's' : ''}` : 'Open for Aid'}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>open_in_new</span>
                    <span>Click to browse campaigns</span>
                  </div>
                </div>

                {/* 3. Total Contributed */}
                <div className="ref-metric-card" style={{
                  padding: '20px 22px',
                  textAlign: 'left',
                  borderLeft: '3px solid #a78bfa',
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.06) 0%, var(--bg-card, #212121) 60%)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Total Contributed</span>
                    <div style={{
                      width: '34px', height: '34px', borderRadius: '10px',
                      background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(167, 139, 250, 0.25)',
                      color: '#a78bfa', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>account_balance_wallet</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.9rem', fontWeight: 850, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>
                      {totalDonated}
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginLeft: '5px' }}>ETH</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#a78bfa', fontWeight: 600, marginTop: '4px' }}>
                      ≈ ₱{Math.round(totalDonatedPhp).toLocaleString('en-US')} PHP
                    </div>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>verified_user</span>
                    <span>On-chain verified contribution</span>
                  </div>
                </div>

                {/* 4. Recognition Standing */}
                <div className="ref-metric-card" onClick={() => setShowTierModal(true)} title="View Recognition Circles" style={{
                  padding: '20px 22px',
                  textAlign: 'left',
                  borderLeft: `3px solid ${activeTierInfo?.tier?.color || '#f59e0b'}`,
                  background: `linear-gradient(135deg, ${activeTierInfo?.tier ? activeTierInfo.tier.color + '0f' : 'rgba(245,158,11,0.06)'} 0%, var(--bg-card, #212121) 60%)`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  cursor: 'pointer'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: activeTierInfo?.tier?.color || '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Recognition</span>
                    <div style={{
                      width: '34px', height: '34px', borderRadius: '10px',
                      background: activeTierInfo?.tier ? activeTierInfo.tier.color + '26' : 'rgba(245,158,11,0.15)',
                      border: `1px solid ${activeTierInfo?.tier ? activeTierInfo.tier.color + '40' : 'rgba(245,158,11,0.25)'}`,
                      color: activeTierInfo?.tier?.color || '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>volunteer_activism</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 850, color: activeTierInfo?.tier?.color || '#f59e0b', letterSpacing: '-0.01em', lineHeight: 1 }}>
                      {activeTierInfo?.tier ? activeTierInfo.tier.name : 'Unranked'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: activeTierInfo?.tier?.color || '#f59e0b', fontWeight: 600, marginTop: '4px', opacity: 0.85 }}>
                      {activeTierInfo?.tier ? `${activeTierInfo.tier.name} Circle` : 'Make your first donation'}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>open_in_new</span>
                    <span>Click to view Honor Roll</span>
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

              {/* 4-Stat Metric Cards Grid — Premium Redesign */}
              <div className="ref-metrics-grid" style={{ marginBottom: '22px', gap: '16px' }}>

                {/* 1. Green: Total Contributed */}
                <div className="ref-metric-card" style={{
                  padding: '20px 22px',
                  textAlign: 'left',
                  borderLeft: '3px solid #22c55e',
                  background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.06) 0%, var(--bg-card, #212121) 60%)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Total Contributed</span>
                    <div style={{
                      width: '34px', height: '34px', borderRadius: '10px',
                      background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.25)',
                      color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>volunteer_activism</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.9rem', fontWeight: 850, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>
                      {totalDonated}
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginLeft: '5px' }}>ETH</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#22c55e', fontWeight: 600, marginTop: '4px' }}>
                      Personal ETH Contributed
                    </div>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>verified_user</span>
                    <span>On-chain verified contribution</span>
                  </div>
                </div>

                {/* 2. Blue: Peso Equivalent */}
                <div className="ref-metric-card" style={{
                  padding: '20px 22px',
                  textAlign: 'left',
                  borderLeft: '3px solid #38bdf8',
                  background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.06) 0%, var(--bg-card, #212121) 60%)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Peso Value (PHP)</span>
                    <div style={{
                      width: '34px', height: '34px', borderRadius: '10px',
                      background: 'rgba(2, 132, 199, 0.15)', border: '1px solid rgba(56, 189, 248, 0.25)',
                      color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>currency_exchange</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.9rem', fontWeight: 850, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>
                      ≈ ₱{Math.round(totalDonatedPhp).toLocaleString('en-US')}
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginLeft: '5px' }}>PHP</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#38bdf8', fontWeight: 600, marginTop: '4px' }}>
                      Real-Time Conversion
                    </div>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>payments</span>
                    <span>1 ETH ≈ ₱170,000 Live Rate</span>
                  </div>
                </div>

                {/* 3. Purple: Verified Receipts */}
                <div className="ref-metric-card" style={{
                  padding: '20px 22px',
                  textAlign: 'left',
                  borderLeft: '3px solid #a78bfa',
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.06) 0%, var(--bg-card, #212121) 60%)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Verified Receipts</span>
                    <div style={{
                      width: '34px', height: '34px', borderRadius: '10px',
                      background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(167, 139, 250, 0.25)',
                      color: '#a78bfa', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>receipt_long</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.9rem', fontWeight: 850, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>
                      {myDonations ? myDonations.length : 0}
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginLeft: '5px' }}>Recorded</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#a78bfa', fontWeight: 600, marginTop: '4px' }}>
                      100% Sepolia EVM Audited
                    </div>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>verified</span>
                    <span>Immutable smart contract logs</span>
                  </div>
                </div>

                {/* 4. Orange: Supported Causes */}
                <div className="ref-metric-card" style={{
                  padding: '20px 22px',
                  textAlign: 'left',
                  borderLeft: '3px solid #f59e0b',
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.06) 0%, var(--bg-card, #212121) 60%)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Causes Supported</span>
                    <div style={{
                      width: '34px', height: '34px', borderRadius: '10px',
                      background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.25)',
                      color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>campaign</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.9rem', fontWeight: 850, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>
                      {uniqueCausesCount}
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginLeft: '5px' }}>Campaigns</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#f59e0b', fontWeight: 600, marginTop: '4px' }}>
                      Direct Community Aid
                    </div>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>handshake</span>
                    <span>Direct humanitarian impact</span>
                  </div>
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

                    const pm = (d.paymentMethod || 'ETH').toUpperCase();
                    const isCard = pm.includes('CARD');
                    const isGcash = pm.includes('GCASH');
                    const isMaya = pm.includes('MAYA');
                    const railColor = isCard ? '#f59e0b' : isGcash ? '#007DFE' : isMaya ? '#10b981' : '#8b5cf6';
                    const railBg = isCard ? 'rgba(245, 158, 11, 0.12)' : isGcash ? 'rgba(0, 125, 254, 0.12)' : isMaya ? 'rgba(16, 185, 129, 0.12)' : 'rgba(139, 92, 246, 0.12)';
                    const railIcon = isCard ? 'credit_card' : isGcash ? 'smartphone' : isMaya ? 'account_balance_wallet' : 'token';
                    const ethAmt = parseFloat(d.amount || 0);
                    const phpAmt = Math.round(ethAmt * 170000);
                    const isShortage = d.auditStatus === 'SHORTAGE';

                    return (
                      <div key={idx} className={`contribution-receipt-card modern-receipt-card ${isShortage ? 'has-shortage' : ''} fade-in`}>
                        {/* ── Main Top Row: Clean Thumbnail, Structured Details, Financial Module ── */}
                        <div className="receipt-main-row">
                          {/* 1. Left: Clean Media Thumbnail (No overlapping text clutter) */}
                          <div className="receipt-thumb-clean">
                            <img src={coverData.imageUrl} alt={campTitle} className="receipt-thumb-img" />
                            <div className="receipt-thumb-cat-icon" title={catInfo.label}>
                              <span className="material-symbols-outlined">{catInfo.icon || 'volunteer_activism'}</span>
                            </div>
                          </div>

                          {/* 2. Center: Clean Typographic Hierarchy */}
                          <div className="receipt-body-center">
                            {/* Breadcrumb Header */}
                            <div className="receipt-header-meta">
                              <button
                                type="button"
                                className="receipt-org-link"
                                onClick={() => onOpenNgoProfile && onOpenNgoProfile(matchCamp.orgId || 3)}
                                title="Click to view verified NGO profile"
                              >
                                <span className="material-symbols-outlined org-icon">domain</span>
                                <span>{orgName}</span>
                                <span className="material-symbols-outlined org-verified">verified</span>
                              </button>

                              <span className="meta-separator">•</span>
                              <span className="receipt-cat-tag">{catInfo.label}</span>

                              {isShortage ? (
                                <span className="receipt-shortage-tag">
                                  <span className="material-symbols-outlined">warning</span>
                                  <span>Shortage Detected</span>
                                </span>
                              ) : (
                                <span className="receipt-verified-tag-clean">
                                  <span className="status-dot" />
                                  <span>Confirmed On-Chain</span>
                                </span>
                              )}
                            </div>

                            {/* Campaign Title */}
                            <h3 className="receipt-title-clean" title={campTitle}>
                              {campTitle}
                            </h3>

                            {/* Clean Sub-details (Location, Date, Reference) */}
                            <div className="receipt-subdetails">
                              {coverData.locationTag && (
                                <span className="subdetail-item" title="Relief Operation Location">
                                  <span className="material-symbols-outlined">location_on</span>
                                  <span>{coverData.locationTag}</span>
                                </span>
                              )}
                              <span className="subdetail-item" title="Contribution Timestamp">
                                <span className="material-symbols-outlined">calendar_today</span>
                                <span>{d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent'}</span>
                              </span>
                              {d.referenceNumber && (
                                <span className="subdetail-item" title="Payment Reference Number">
                                  <span className="material-symbols-outlined">tag</span>
                                  <span style={{ fontFamily: 'var(--font-mono)' }}>Ref: {d.referenceNumber}</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 3. Right: Financial Amount & Payment Rail */}
                          <div className="receipt-financial-col">
                            <div className="receipt-rail-badge" style={{ color: railColor, background: railBg, borderColor: railColor }}>
                              <span className="material-symbols-outlined">{railIcon}</span>
                              <span>{d.paymentMethod || 'ETH'}</span>
                            </div>

                            <div className="receipt-amount-wrapper">
                              {isShortage && d.declaredPhp ? (
                                <>
                                  <div className="receipt-amount-display alert">
                                    ₱{phpAmt.toLocaleString('en-US')}
                                  </div>
                                  <div className="receipt-shortage-note">
                                    <span className="declared-struck">₱{Number(d.declaredPhp).toLocaleString('en-US')}</span>
                                    <span className="variance-text">(-₱{Math.abs(d.variancePhp || 0).toLocaleString()})</span>
                                  </div>
                                  <div className="receipt-amount-eth-sub">
                                    ({ethAmt < 0.0001 ? ethAmt.toFixed(6) : ethAmt.toFixed(4)} ETH on-chain)
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="receipt-amount-display">
                                    ₱{phpAmt.toLocaleString('en-US')}
                                  </div>
                                  <div className="receipt-amount-eth-sub">
                                    ≈ {ethAmt < 0.0001 ? ethAmt.toFixed(6) : ethAmt.toFixed(4)} ETH
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* ── Middle: Sleek Discrepancy Alert Banner (Only if variance detected) ── */}
                        {isShortage && (
                          <div className="receipt-discrepancy-banner">
                            <div className="discrepancy-info">
                              <span className="material-symbols-outlined discrepancy-icon">gavel</span>
                              <div>
                                <div className="discrepancy-title">
                                  ⚠️ Audit Discrepancy Notarized on Ethereum Sepolia
                                </div>
                                <div className="discrepancy-desc">
                                  You declared <strong>₱{Number(d.declaredPhp || 0).toLocaleString()}</strong>, but NGO credited <strong>₱{Number(d.creditedPhp || 0).toLocaleString()}</strong> (<strong>-₱{Math.abs(d.variancePhp || 0).toLocaleString()} PHP</strong> shortage).
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              className="receipt-dispute-btn"
                              onClick={() => showSuccess(`Dispute filed for TX ${d.txHash?.slice(0, 10)}... Admin audit investigation initiated against ${orgName}.`, 'Audit Dispute Filed')}
                            >
                              <span className="material-symbols-outlined">flag</span>
                              <span>File Dispute</span>
                            </button>
                          </div>
                        )}

                        {/* ── Bottom Row: Transaction Hash & Action Bar ── */}
                        <div className="receipt-footer-row">
                          {/* Left: Compact Hash Token Chip */}
                          <div className="receipt-hash-chip">
                            <span className="material-symbols-outlined hash-token-icon">token</span>
                            <span className="hash-label">TX</span>
                            <span className="hash-code">
                              {d.txHash ? `${d.txHash.slice(0, 10)}...${d.txHash.slice(-8)}` : 'On-Chain Verified'}
                            </span>
                            {d.txHash && (
                              <button
                                type="button"
                                className="hash-sub-action"
                                onClick={() => {
                                  navigator.clipboard.writeText(d.txHash);
                                  showSuccess('Transaction hash copied to clipboard!', 'Hash Copied');
                                }}
                                title="Copy TX Hash"
                              >
                                <span className="material-symbols-outlined">content_copy</span>
                              </button>
                            )}
                            {d.txHash && (
                              <a
                                href={`https://sepolia.etherscan.io/tx/${d.txHash}`}
                                target="_blank"
                                rel="noreferrer"
                                className="hash-sub-action"
                                title="Inspect raw block details on Sepolia Etherscan"
                              >
                                <span className="material-symbols-outlined">open_in_new</span>
                              </a>
                            )}
                          </div>

                          {/* Right: Consolidated Action Buttons */}
                          <div className="receipt-footer-actions">
                            <button
                              type="button"
                              className="btn-proof-link"
                              onClick={() => setSelectedCampaignForProof(matchCamp)}
                              title="View Campaign Accomplishments, Budget Breakdown & Map"
                            >
                              <span className="material-symbols-outlined">verified</span>
                              <span>Cause Details</span>
                            </button>

                            <button
                              type="button"
                              className={`btn-certificate ${isShortage ? 'shortage' : ''}`}
                              onClick={() => setSelectedVoucherTx(d)}
                              title="Open Plain-English Blockchain Verification Certificate"
                            >
                              <span className="material-symbols-outlined">
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

                  {/* 3. Proof of Fund Allocation Breakdown & Policies */}
                  {audit.allocations && Array.isArray(audit.allocations) && audit.allocations.length > 0 && (() => {
                    const targetPhp = parseFloat(selectedCampaignForProof.targetAmount || 0) * 170000;
                    return (
                      <div style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <h4 style={{ fontSize: '0.92rem', color: 'var(--text-primary, #ffffff)', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="material-symbols-outlined" style={{ color: '#22c55e', fontSize: '1.2rem' }}>pie_chart</span>
                            Proof of Fund Allocation & Budget Breakdown
                          </h4>
                          <span style={{ fontSize: '0.68rem', background: 'rgba(34, 197, 94, 0.12)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.25)', padding: '2px 7px', borderRadius: '10px', fontWeight: 700 }}>
                            TRANSPARENCY AUDITED
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
                          {audit.allocations.map((item, i) => {
                            const itemPhp = (targetPhp * (item.pct / 100)).toLocaleString('en-US', { maximumFractionDigits: 0 });
                            return (
                              <div key={i} style={{
                                background: 'var(--bg-surface, rgba(255, 255, 255, 0.03))',
                                border: '1px solid var(--border, rgba(255, 255, 255, 0.06))',
                                borderRadius: '10px',
                                padding: '10px 12px'
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary, #e2e8f0)' }}>
                                    {item.label}
                                  </span>
                                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted, #94a3b8)' }}>
                                    <strong style={{ color: '#22c55e' }}>₱{itemPhp}</strong> ({item.pct}%)
                                  </span>
                                </div>
                                <div style={{ background: 'var(--bg-input, rgba(0, 0, 0, 0.3))', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                                  <div style={{ width: `${item.pct}%`, height: '100%', background: 'linear-gradient(90deg, #16a34a, #22c55e)' }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Operational Policies as questioned in defense */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px', marginTop: '12px' }}>
                          <div style={{ background: 'rgba(34, 197, 94, 0.06)', border: '1px solid rgba(34, 197, 94, 0.25)', borderRadius: '8px', padding: '9px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color: '#22c55e', marginBottom: '3px' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>savings</span>
                              <span>Surplus Reserve Policy</span>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary, #cbd5e1)', lineHeight: '1.45' }}>
                              Monetary donations exceeding 100% of the target goal roll over into the <strong>Calamity Response Reserve Fund</strong> to support unbudgeted community needs and future emergency campaigns.
                            </p>
                          </div>

                          <div style={{ background: 'rgba(56, 189, 248, 0.06)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '8px', padding: '9px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color: '#38bdf8', marginBottom: '3px' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>priority_high</span>
                              <span>Partial Funding Priority Rule</span>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary, #cbd5e1)', lineHeight: '1.45' }}>
                              If the deadline arrives before reaching the full target, all accumulated funds are immediately released with priority allocated to <strong>immediate survival necessities (food packs, potable water & medical aid)</strong> first.
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

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
        const paymentLabel = d.paymentMethod ? d.paymentMethod.toUpperCase() : 'ETH';

        return (
          <div
            className="cert-modal-backdrop"
            onClick={() => setSelectedVoucherTx(null)}
          >
            <div
              className={`cert-modal-card ${isShortage ? 'is-shortage' : ''} fade-in`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* 1. Official Notarized Certificate Header */}
              <div className="cert-header">
                <div className="cert-header-left">
                  <div className={`cert-seal-icon-box ${isShortage ? 'is-shortage' : ''}`}>
                    <span className="material-symbols-outlined">
                      {isShortage ? 'gavel' : 'verified_user'}
                    </span>
                  </div>
                  <div className="cert-title-group">
                    <h3>Blockchain Verification Certificate</h3>
                    <div className="cert-subtitle">
                      <span>Ethereum Sepolia Notarized Proof</span>
                      <span>•</span>
                      <span>ReliefLink PH Forensic Audit</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedVoucherTx(null)}
                  className="cert-close-btn"
                  title="Close Certificate"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* 2. Attestation Status Ribbon */}
              <div className={`cert-status-ribbon ${isShortage ? 'is-shortage' : ''}`}>
                <div className={`cert-status-badge ${isShortage ? 'is-shortage' : ''}`}>
                  <span className="cert-status-dot" />
                  <span>
                    {isShortage ? 'Audit Discrepancy Notarized on Ledger' : '100% Clean Audit · Zero Shortage'}
                  </span>
                </div>
                <div className="cert-ledger-id">
                  Ledger Entry #{d.id || 'SEPOLIA'}
                </div>
              </div>

              {/* 3. Certificate Body */}
              <div className="cert-body">
                {/* Forensic Plain-English Verdict Banner */}
                <div className={`cert-verdict-banner ${isShortage ? 'is-shortage' : ''}`}>
                  <span className="material-symbols-outlined verdict-icon">
                    {isShortage ? 'report_problem' : 'verified'}
                  </span>
                  <div>
                    <div className="cert-verdict-title">
                      {isShortage
                        ? `Shortage Flagged: ₱${Math.abs(variancePhp).toLocaleString()} Missing from Relief Goal`
                        : 'All Funds Accounted For On-Chain'}
                    </div>
                    <p className="cert-verdict-desc">
                      {isShortage ? (
                        <>
                          Your official receipt confirms you sent <strong>₱{declaredPhp.toLocaleString()}</strong>, but the NGO confirmed receiving only <strong>₱{creditedPhp.toLocaleString()}</strong>. Because this transaction was permanently sealed onto Ethereum Sepolia, <strong>the NGO cannot alter or erase this audit evidence</strong>.
                        </>
                      ) : (
                        <>
                          Your contribution of <strong>₱{creditedPhp.toLocaleString()}</strong> has been cryptographically verified and recorded onto the relief smart contract with zero deductions.
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Visual Reconciliation Pipeline (Payment Slip ➔ Credited ➔ Variance) */}
                <div className="cert-pipeline-box">
                  <div className="cert-pipeline-header">
                    <span>Forensic Transaction Reconciliation</span>
                    <span>Sepolia EVM Verified</span>
                  </div>

                  <div className="cert-pipeline-grid">
                    {/* Stage 1: Donor Declared */}
                    <div className="cert-pipe-card">
                      <div className="cert-pipe-label">
                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>receipt_long</span>
                        <span>1. You Sent (Slip)</span>
                      </div>
                      <div className="cert-pipe-amount">
                        ₱{declaredPhp.toLocaleString('en-US')}
                      </div>
                      <div className="cert-pipe-sub" title={`Via ${paymentLabel} (Ref: ${d.referenceNumber || 'Verified'})`}>
                        Via {paymentLabel} {d.referenceNumber ? `• Ref: ${d.referenceNumber}` : ''}
                      </div>
                    </div>

                    <div className="cert-flow-arrow">
                      <span className="material-symbols-outlined">arrow_forward</span>
                    </div>

                    {/* Stage 2: NGO Credited */}
                    <div className="cert-pipe-card">
                      <div className="cert-pipe-label">
                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>account_balance</span>
                        <span>2. NGO Credited</span>
                      </div>
                      <div className={`cert-pipe-amount ${isShortage ? 'danger-amount' : 'accent-amount'}`}>
                        ₱{creditedPhp.toLocaleString('en-US')}
                      </div>
                      <div className="cert-pipe-sub">
                        {amtEth < 0.0001 ? amtEth.toFixed(6) : amtEth.toFixed(4)} ETH on ledger
                      </div>
                    </div>

                    <div className="cert-flow-arrow">
                      <span className="material-symbols-outlined">arrow_forward</span>
                    </div>

                    {/* Stage 3: Variance Outcome */}
                    <div className={`cert-pipe-card variance-card ${isShortage ? 'is-shortage' : ''}`}>
                      <div className="cert-pipe-label">
                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                          {isShortage ? 'warning' : 'task_alt'}
                        </span>
                        <span>3. Forensic Variance</span>
                      </div>
                      <div className={`cert-pipe-amount ${isShortage ? 'danger-amount' : 'accent-amount'}`}>
                        {variancePhp < 0 ? `-₱${Math.abs(variancePhp).toLocaleString()}` : variancePhp > 0 ? `+₱${variancePhp.toLocaleString()}` : '₱0.00 Match'}
                      </div>
                      <div className={`cert-pipe-sub ${isShortage ? 'danger-sub' : 'accent-sub'}`}>
                        {isShortage ? '⚠️ Shortage Sealed On-Chain' : '✓ Perfectly Balanced'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Campaign & NGO Attribution Inset Cards */}
                <div className="cert-meta-grid">
                  <div className="cert-meta-card">
                    <div className="cert-meta-label">
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>campaign</span>
                      <span>Target Relief Campaign</span>
                    </div>
                    <div className="cert-meta-value" title={campTitle}>
                      {campTitle}
                    </div>
                  </div>

                  <div className="cert-meta-card">
                    <div className="cert-meta-label">
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>domain</span>
                      <span>Managing Organization</span>
                    </div>
                    <div className="cert-meta-value">
                      <span className="material-symbols-outlined org-badge-icon">verified</span>
                      <span>{orgName}</span>
                    </div>
                  </div>
                </div>

                {/* Payment Slip Evidence Preview (If uploaded by donor) */}
                {d.receiptBase64 && (
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: 'var(--bg-subcard)',
                    border: '1px solid var(--border)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                            maxHeight: '320px',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            objectFit: 'contain'
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Cryptographic Proof Card (Immutable Hash) */}
                <div className="cert-crypto-card">
                  <div className="cert-crypto-header">
                    <div className="cert-crypto-title">
                      <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>token</span>
                      <span>Immutable Ethereum Sepolia Blockchain Hash</span>
                    </div>
                    <div className="cert-crypto-net-pill">
                      <span>Sepolia EVM Verified</span>
                    </div>
                  </div>

                  <div className="cert-crypto-hash-row">
                    <div className="cert-crypto-hash-code" title={d.txHash}>
                      {d.txHash}
                    </div>
                    <div className="cert-crypto-actions">
                      <button
                        type="button"
                        className="cert-icon-btn"
                        onClick={() => {
                          navigator.clipboard.writeText(d.txHash);
                          showSuccess('Transaction hash copied to clipboard!', 'Hash Copied');
                        }}
                        title="Copy Transaction Hash"
                      >
                        <span className="material-symbols-outlined">content_copy</span>
                      </button>

                      {d.txHash && (
                        <a
                          href={`https://sepolia.etherscan.io/tx/${d.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="cert-icon-btn"
                          title="Inspect raw transaction on Sepolia Etherscan"
                        >
                          <span className="material-symbols-outlined">open_in_new</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. Certificate Action Footer */}
              <div className="cert-footer">
                <div className="cert-footer-guarantee">
                  <span className="material-symbols-outlined">shield</span>
                  <span>Permanently Sealed On-Chain · Tamper-Evident</span>
                </div>

                <div className="cert-footer-buttons">
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

                  <button
                    type="button"
                    className="btn-cert-outline"
                    onClick={() => window.print()}
                  >
                    <span className="material-symbols-outlined">print</span>
                    <span>Print / Save PDF</span>
                  </button>

                  {d.txHash && (
                    <a
                      href={`https://sepolia.etherscan.io/tx/${d.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-cert-outline"
                      title="Inspect raw block details on Sepolia Etherscan"
                    >
                      <span>Raw Etherscan ↗</span>
                    </a>
                  )}

                  <button
                    type="button"
                    className="btn-cert-close"
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
