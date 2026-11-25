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
  getCampaignTags,
  isCampaignTracked,
  getCategoryEvidencePhotos
} from '../components/CampaignCard';
import LocationMapPicker from '../components/LocationMapPicker';
import { ROLES } from '../roleConfig';
import SettingsPanel from '../components/SettingsPanel';
import DisasterRadarHeatmap from '../components/DisasterRadarHeatmap';
import DonorBadge, { DonorTierModal, DonorProgressCard, BadgeUpgradeModal, getDonorTier, globalDonorRegistry } from '../components/DonorBadge';
import GuidedTour from '../components/GuidedTour';
import SidebarToggleIcon from '../components/SidebarToggleIcon';
import DisbursementProofModal from '../components/DisbursementProofModal';
import FilterableExportModal from '../components/FilterableExportModal';
import GeistSelect from '../components/GeistSelect';
import { useToast } from '../context/ToastContext';
import { API_URL } from '../config';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import LiveCounter from '../components/LiveCounter';
import { CONTRACT_ADDRESS } from '../contractConfig';
import { getPaginationItems } from '../utils/pagination';
import { getWorkspaceStrings } from '../data/workspaceTranslations';
import {
  exportDonorReportExcel,
  exportDonorReportCsv,
  exportDonorPrintableReport,
  printDonationVoucher
} from '../utils/reportExporter';
import './ReferenceDashboard.css';
import '../components/CampaignDetailsModal.css';
import './DashboardOverview.css';
import CampaignSkeletonCard from '../components/CampaignSkeletonCard';
import DonationAnalyticsChart from '../components/DonationAnalyticsChart';

/* ── Skeleton loading placeholders (shimmer; mirrors CampaignCard & db-camp-row geometry) ── */
const DbSkeletonCard = () => <CampaignSkeletonCard />;

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

export default function DonorView({ contract, walletAddress, walletAlertBanner, campaigns = [], fetchCampaigns, fetchingCampaigns, currentUser, handleConnectWallet, handleLogout, updateDbWallet, theme = 'default', themeMode, setTheme, textSize, setTextSize, interfaceMode = 'standard', setInterfaceMode, language = 'en', setLanguage, reducedMotion = false, setReducedMotion, highContrast = false, setHighContrast, lowBandwidthMode = false, setLowBandwidthMode, onOpenNgoProfile, onActiveTabChange }) {
  const { showSuccess } = useToast();
  const wt = useMemo(() => getWorkspaceStrings(language), [language]);
  const [loadedThumbs, setLoadedThumbs] = useState({});
  useEffect(() => {
    if (!lowBandwidthMode) setLoadedThumbs({});
  }, [lowBandwidthMode]);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Always reset scroll to top on tab switch or dashboard mount
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    const mainContent = document.querySelector('.ref-main-content');
    if (mainContent) mainContent.scrollTop = 0;
  }, [activeTab]);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [selectedTags, setSelectedTags] = useState([]);
  const [urgencyFilter, setUrgencyFilter] = useState('ALL');
  const [progressFilter, setProgressFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [campaignSort, setCampaignSort] = useState('NEWEST');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyTracked, setOnlyTracked] = useState(false);
  const [trackRevision, setTrackRevision] = useState(0);

  // Synchronize tracked campaign list live whenever any card is tracked or untracked
  useEffect(() => {
    const handleTrackUpdate = () => {
      setTrackRevision(prev => prev + 1);
    };
    window.addEventListener('bbdrts_track_change', handleTrackUpdate);
    window.addEventListener('storage', handleTrackUpdate);
    return () => {
      window.removeEventListener('bbdrts_track_change', handleTrackUpdate);
      window.removeEventListener('storage', handleTrackUpdate);
    };
  }, []);
  const [receiptFilter, setReceiptFilter] = useState('ALL');
  const [receiptRailFilter, setReceiptRailFilter] = useState('ALL');
  const [receiptSort, setReceiptSort] = useState('NEWEST');
  const [searchQueryReceipts, setSearchQueryReceipts] = useState('');
  const [receiptsPage, setReceiptsPage] = useState(1);
  const receiptsLedgerRef = useRef(null);
  const RECEIPTS_PER_PAGE = 10;
  const [selectedCampaignForProof, setSelectedCampaignForProof] = useState(null);
  const [selectedProofCamp, setSelectedProofCamp] = useState(null);
  const [showAllProofTags, setShowAllProofTags] = useState(false);
  const [activeProofEvidenceImg, setActiveProofEvidenceImg] = useState(null);
  const [selectedVoucherTx, setSelectedVoucherTx] = useState(null);
  const [donorExportOpen, setDonorExportOpen] = useState(false);
  const [showReceiptZoom, setShowReceiptZoom] = useState(false);
  const [showTierModal, setShowTierModal] = useState(false);
  const [unlockedTierModal, setUnlockedTierModal] = useState(null);
  const [showGuidedTour, setShowGuidedTour] = useState(false);
  const [showTechDetails, setShowTechDetails] = useState(false);

  // Responsive Left-Flush Sidebar State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('bbdrts_sidebar_collapsed') === 'true'; } catch (_) { return false; }
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('bbdrts_mobile_sidebar_state', { detail: { open: mobileSidebarOpen } }));
    return () => {
      window.dispatchEvent(new CustomEvent('bbdrts_mobile_sidebar_state', { detail: { open: false } }));
    };
  }, [mobileSidebarOpen]);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('bbdrts_sidebar_collapsed', String(next));
        document.body.setAttribute('data-sidebar-collapsed', String(next));
      } catch (_) {}
      window.dispatchEvent(new CustomEvent('bbdrts_sidebar_changed', { detail: { collapsed: next } }));
      return next;
    });
  };

  useEffect(() => {
    try {
      const isCollapsed = localStorage.getItem('bbdrts_sidebar_collapsed') === 'true';
      document.body.setAttribute('data-sidebar-collapsed', String(isCollapsed));
    } catch (_) {}
  }, []);

  useEffect(() => {
    const handleToggle = () => {
      if (typeof window !== 'undefined' && window.innerWidth <= 768) {
        setMobileSidebarOpen(prev => !prev);
      } else {
        toggleSidebar();
      }
    };
    const handleTourSidebar = (e) => {
      if (typeof window !== 'undefined' && window.innerWidth <= 900) {
        setMobileSidebarOpen(Boolean(e?.detail?.open));
      }
    };
    window.addEventListener('bbdrts_toggle_sidebar', handleToggle);
    window.addEventListener('bbdrts_tour_sidebar', handleTourSidebar);
    return () => {
      window.removeEventListener('bbdrts_toggle_sidebar', handleToggle);
      window.removeEventListener('bbdrts_tour_sidebar', handleTourSidebar);
    };
  }, []);
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

  // Auto-launch Guided Tour ONLY for brand new donor registrations, AFTER Workspace Setup closes
  useEffect(() => {
    let pollInterval = null;
    let launchTimeout = null;
    let cancelled = false;

    const tryLaunchTour = () => {
      if (cancelled) return;
      try {
        const isNewSignup = localStorage.getItem('bbdrts_tour_force_launch') === 'true' ||
                            localStorage.getItem('bbdrts_is_new_registration') === 'true';
        const userTourDone = localStorage.getItem(userTourKey) === 'true';
        if (!isNewSignup || userTourDone) return;

        let attempts = 0;
        const maxAttempts = 60;
        if (pollInterval) clearInterval(pollInterval);

        pollInterval = setInterval(() => {
          if (cancelled) {
            clearInterval(pollInterval);
            return;
          }
          const onboardingActive = Boolean(
            document.querySelector('.onboarding-backdrop') ||
            document.body.dataset.onboardingOpen === 'true' ||
            localStorage.getItem('bbdrts_needs_onboarding') === 'true'
          );
          if (onboardingActive) {
            return; // Pause while BBDRTS Workspace Setup is still open
          }

          attempts++;
          const authBackdrop = document.querySelector('.auth-transition-backdrop');
          const targetEl = document.querySelector('#tour-donor-welcome') || document.querySelector('#tour-donor-profile');
          const isAuthClear = !authBackdrop || authBackdrop.classList.contains('closing');
          const isTargetReady = targetEl && targetEl.getBoundingClientRect().width > 0;

          if ((isAuthClear && isTargetReady) || attempts >= maxAttempts) {
            clearInterval(pollInterval);
            pollInterval = null;
            launchTimeout = setTimeout(() => {
              if (cancelled) return;
              setActiveTab('dashboard');
              setShowGuidedTour(true);
              localStorage.removeItem('bbdrts_tour_force_launch');
              localStorage.removeItem('bbdrts_is_new_registration');
            }, 350);
          }
        }, 120);
      } catch (_) {}
    };

    tryLaunchTour();
    const onOnboardingDone = () => tryLaunchTour();
    window.addEventListener('bbdrts_onboarding_finished', onOnboardingDone);
    return () => {
      cancelled = true;
      window.removeEventListener('bbdrts_onboarding_finished', onOnboardingDone);
      if (pollInterval) clearInterval(pollInterval);
      if (launchTimeout) clearTimeout(launchTimeout);
    };
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
      title: 'Welcome & Quick Actions',
      badge: 'Dashboard Overview',
      placement: 'bottom',
      align: 'start',
      description: 'Your verified donor standing at a glance. Jump directly into active relief campaigns or inspect the public Sepolia audit ledger.'
    },
    {
      target: '#tour-donor-metrics',
      title: 'Live Impact Summary',
      badge: 'Key Metrics',
      placement: 'bottom',
      align: 'center',
      description: 'Track your total verified PHP contributions with real-time momentum, active relief causes, and notarized on-chain receipts.'
    },
    {
      target: '#tour-donor-first-campaign, #tour-donor-featured-causes',
      title: 'Featured Relief Appeals',
      badge: 'Active Causes',
      placement: 'bottom',
      align: 'center',
      description: 'Browse prioritized campaigns from SEC-accredited NGOs. Donate in PHP via GCash, Maya, Bank Transfer, or Card with gasless on-chain receipts.'
    },
    {
      target: '#tour-donor-tab-campaigns',
      title: 'Explore Campaigns',
      badge: 'Navigation',
      placement: 'right',
      align: 'center',
      description: 'Filter every active relief appeal by category (Disaster Relief or Charitable Aid), urgency priority, or keyword search.'
    },
    {
      target: '#tour-donor-tab-donations',
      title: 'My Contributions & Analytics',
      badge: 'Donation Ledger',
      placement: 'right',
      align: 'center',
      description: 'Inspect interactive donation trends across Today, Week, Month, Year, and All time, plus your paginated Sepolia-verified receipts.'
    },
    {
      target: '#tour-donor-tab-radar',
      title: 'Live Relief Radar',
      badge: 'PAGASA Weather Map',
      placement: 'right',
      align: 'center',
      description: 'Monitor real-time PAGASA Doppler precipitation layers alongside geotagged disaster relief drives across the Philippines.'
    },
    {
      target: '.ref-nav-item-tutorial, .ref-sidebar-footer-group',
      title: 'Replay Anytime',
      badge: 'You’re All Set',
      placement: 'right',
      align: 'end',
      description: 'Need a refresher later? Click Guided Tutorial here in the sidebar or visit Preferences in Profile & Settings to replay this walkthrough.'
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
    { value: 'ALL', label: 'All Causes', icon: 'public' },
    { value: 'DR', label: 'Disaster Relief', icon: 'flood' },
    { value: 'CD', label: 'Charitable Aid', icon: 'volunteer_activism' }
  ];

  const PRIORITY_OPTIONS = [
    { value: 'ALL', label: 'All Priorities', icon: 'bolt' },
    { value: 'HIGH', label: 'High Priority', icon: 'priority_high' },
    { value: 'MEDIUM', label: 'Medium Priority', icon: 'bolt' },
    { value: 'STABLE', label: 'Standard / Stable', icon: 'verified_user' }
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
  }, [categoryFilter, selectedTags, urgencyFilter, progressFilter, statusFilter, campaignSort, searchQuery, viewMode, targetCampaignId, onlyTracked, trackRevision]);

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

  const hasActiveFilters = onlyTracked || categoryFilter !== 'ALL' || selectedTags.length > 0 || urgencyFilter !== 'ALL' || progressFilter !== 'ALL' || statusFilter !== 'ALL' || searchQuery.trim() !== '';

  const resetAllFilters = () => {
    setCategoryFilter('ALL');
    setSelectedTags([]);
    setUrgencyFilter('ALL');
    setProgressFilter('ALL');
    setStatusFilter('ALL');
    setSearchQuery('');
    setOnlyTracked(false);
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

    const handleTabNav = (e) => {
      const targetTab = e?.detail?.tab;
      if (!targetTab) return;
      const aliasMap = {
        'ledger': 'my-donations',
        'financial-ledger': 'my-donations',
        'donations': 'my-donations',
        'my-donations': 'my-donations',
        'history': 'my-donations',
        'receipts': 'my-donations',
        'campaigns': 'campaigns',
        'my-campaigns': 'campaigns',
        'all-campaigns': 'campaigns',
        'radar': 'radar-heatmap',
        'radar-heatmap': 'radar-heatmap',
        'settings': 'settings',
        'dashboard': 'dashboard'
      };
      const resolved = aliasMap[targetTab] || targetTab;
      setActiveTab(resolved);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleProofModalNav = (e) => {
      const { campaign, campaignId } = e?.detail || {};
      if (campaign) {
        setSelectedProofCamp(campaign);
      } else if (campaignId) {
        setSelectedProofCamp({ id: campaignId, Campaign_ID: campaignId });
      }
    };

    window.addEventListener('bbdrts_navigate_radar', handleRadarNav);
    window.addEventListener('bbdrts_navigate_campaigns', handleCampaignsNav);
    window.addEventListener('bbdrts_navigate_home', handleHomeNav);
    window.addEventListener('bbdrts_navigate_contributions', handleContributionsNav);
    window.addEventListener('bbdrts_filter_category', handleCategoryNav);
    window.addEventListener('bbdrts_navigate_tab', handleTabNav);
    window.addEventListener('bbdrts_open_proof_modal', handleProofModalNav);
    return () => {
      window.removeEventListener('bbdrts_navigate_radar', handleRadarNav);
      window.removeEventListener('bbdrts_navigate_campaigns', handleCampaignsNav);
      window.removeEventListener('bbdrts_navigate_home', handleHomeNav);
      window.removeEventListener('bbdrts_navigate_contributions', handleContributionsNav);
      window.removeEventListener('bbdrts_filter_category', handleCategoryNav);
      window.removeEventListener('bbdrts_navigate_tab', handleTabNav);
      window.removeEventListener('bbdrts_open_proof_modal', handleProofModalNav);
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
        if (!(displayTitle.includes(q) || rawTitle.includes(q) || desc.includes(q) || orgMatch || locationMatch || tagMatch || idMatch)) {
          return false;
        }
      }

      // 7. Tracked Campaigns Filter (using unified tracking storage helper)
      if (onlyTracked) {
        if (!isCampaignTracked(c.id, currentUser, walletAddress)) {
          return false;
        }
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
  const [pendingIntents, setPendingIntents] = useState([]);

  const fetchPendingIntents = async () => {
    try {
      const token = localStorage.getItem('bbdrts_token');
      if (!token) return;
      const res = await fetch(`${API_URL}/api/donations/intents/me?_t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });
      if (res.ok) {
        const list = await res.json();
        setPendingIntents(Array.isArray(list) ? list : []);
      }
    } catch (_) {}
  };

  const handleDismissPendingIntent = async (intentId) => {
    try {
      const token = localStorage.getItem('bbdrts_token');
      await fetch(`${API_URL}/api/donations/intent/${intentId}/cancel`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      setPendingIntents((prev) => prev.filter((item) => item.intentId !== intentId));
    } catch (_) {}
  };

  const fetchMyDonations = async (arg) => {
    const silent = Boolean(arg && typeof arg === 'object' && arg.silent === true);
    if (!silent) setLoadingMyDonations(true);
    try {
      const token = localStorage.getItem('bbdrts_token');
      const apiUrl = API_URL;
      if (token) {
        const res = await fetch(`${apiUrl}/api/donations/me?_t=${Date.now()}`, {
          headers: { 'Authorization': `Bearer ${token}` },
          cache: 'no-store'
        });
        if (res.ok) {
          const list = await res.json();
          setMyDonations(Array.isArray(list) ? list : []);
          return;
        }
      }
      if (!silent) setMyDonations([]);
    } catch (err) {
      if (!silent) {
        console.error("Failed to fetch donor history:", err);
        setMyDonations([]);
      }
    } finally {
      if (!silent) setLoadingMyDonations(false);
    }
  };

  useEffect(() => {
    fetchMyDonations();
    fetchPendingIntents();
  }, [walletAddress]);

  // Live real-time sync: immediately reflect new donations, manual verifications, and disbursements
  useRealtimeSync(
    ['donations', 'manual_donations', 'campaigns', 'disbursements'],
    () => {
      fetchMyDonations({ silent: true });
      fetchPendingIntents();
    },
    { debounceMs: 250 }
  );

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
  const activeCampaigns = useMemo(() => {
    if (!Array.isArray(campaigns) || campaigns.length === 0) return [];
    return campaigns.filter(c => c.isActive !== false && !c.isClosed);
  }, [campaigns]);

  const activeCampaignsCount = activeCampaigns.length;

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
    if (!Array.isArray(activeCampaigns) || activeCampaigns.length === 0) return 0;
    return activeCampaigns.filter(c => {
      const u = (c.audit?.urgency || c.urgency || '').toUpperCase();
      return u.includes('CRITICAL') || u.includes('HIGH') || u.includes('URGENT');
    }).length;
  }, [activeCampaigns]);

  const estimatedFamiliesAided = useMemo(() => {
    const php = totalDonatedPhp || 0;
    if (php > 0) return Math.max(1, Math.floor(php / 500));
    return 0;
  }, [totalDonatedPhp]);

  // Real-data 7-point momentum sparkline & delta for Dashboard Overview Total Contributed
  const contributionSparkline = useMemo(() => {
    const list = Array.isArray(myDonations) ? myDonations : [];
    if (list.length === 0) {
      return { hasData: false, deltaPct: 0, linePath: '', areaPath: '', peakX: 0, peakY: 0 };
    }
    const sorted = [...list]
      .map(d => ({
        ts: d.createdAt ? new Date(d.createdAt).getTime() : Date.now(),
        php: Number(d.phpAmount || d.amountPhp) || Math.round((parseFloat(d.amount || d.Amount || 0) || 0) * 170000)
      }))
      .sort((a, b) => a.ts - b.ts);

    // Take last 7 donations (or pad cleanly if fewer) to plot recent giving momentum
    const recent = sorted.slice(-7);
    const vals = recent.map(r => Math.max(1, r.php));
    while (vals.length < 4) vals.unshift(Math.round(vals[0] * 0.6));

    const maxV = Math.max(...vals, 1);
    const minV = Math.min(...vals, 0);
    const span = Math.max(maxV - minV, 1);
    const w = 68;
    const h = 22;
    const padX = 3;
    const padY = 4;

    const pts = vals.map((v, i) => ({
      x: padX + (i / (vals.length - 1)) * (w - padX * 2),
      y: padY + (1 - (v - minV) / span) * (h - padY * 2)
    }));

    let line = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      line += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    const area = `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${h} L ${pts[0].x.toFixed(1)} ${h} Z`;

    // Growth delta: latest contribution share of cumulative total (bounded cleanly 1% - 99%)
    const lastPhp = sorted[sorted.length - 1]?.php || 0;
    const prevTotal = Math.max(1, totalDonatedPhp - lastPhp);
    const rawDelta = Math.round((lastPhp / prevTotal) * 100);
    const deltaPct = Math.max(1, Math.min(99, rawDelta));

    let peakIdx = pts.length - 1;
    let lowestY = Infinity;
    pts.forEach((p, idx) => {
      if (p.y <= lowestY) { lowestY = p.y; peakIdx = idx; }
    });

    return {
      hasData: true,
      deltaPct,
      linePath: line,
      areaPath: area,
      peakX: pts[peakIdx].x,
      peakY: pts[peakIdx].y
    };
  }, [myDonations, totalDonatedPhp]);

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

  // Donor badge upgrade popups disabled



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
          const pm = String(d.paymentMethod || 'CARD').toUpperCase();
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

  useEffect(() => {
    setReceiptsPage(1);
  }, [receiptFilter, receiptRailFilter, searchQueryReceipts, receiptSort]);

  return (
    <div className="ref-dashboard-container" data-interface-mode={interfaceMode}>
      {/* Mobile Drawer Backdrop */}
      <div
        className={`ref-sidebar-backdrop ${mobileSidebarOpen ? 'active' : ''}`}
        onClick={() => setMobileSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* ── Left-Flush Sticky Sidebar Navigation (Zero gap on the left) ── */}
      <aside className={`ref-sidebar ${isSidebarCollapsed ? 'collapsed' : ''} ${mobileSidebarOpen ? 'mobile-open' : ''}`}>
        <div>
          <div className="ref-sidebar-header-strip">
            <div className="ref-sidebar-brand-group">
              <span className="material-symbols-outlined ref-portal-icon" style={{ color: 'var(--text-primary)' }}>volunteer_activism</span>
              <span className="ref-portal-title">{wt.donorPortal}</span>
            </div>
            <button
              type="button"
              className="ref-sidebar-collapse-toggle"
              onClick={toggleSidebar}
              title={isSidebarCollapsed ? "Expand Sidebar ([ or Ctrl+\\ or Alt+S)" : "Collapse Sidebar ([ or Ctrl+\\ or Alt+S)"}
              aria-label={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              <SidebarToggleIcon />
            </button>
          </div>

          <div className="ref-sidebar-menu">
            <button 
              id="tour-donor-tab-dashboard"
              className={`ref-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => { setActiveTab('dashboard'); setMobileSidebarOpen(false); }}
              title={wt.dashboardOverview}
            >
              <span className="material-symbols-outlined">dashboard</span>
              <span>{wt.dashboardOverview}</span>
            </button>

            <button 
              id="tour-donor-tab-campaigns"
              className={`ref-nav-item ${activeTab === 'campaigns' ? 'active' : ''}`}
              onClick={() => { setActiveTab('campaigns'); setMobileSidebarOpen(false); }}
              title={wt.exploreCampaigns}
            >
              <span className="material-symbols-outlined">explore</span>
              <span>{wt.exploreCampaigns}</span>
            </button>

            {interfaceMode !== 'simplified' && (
              <button 
                id="tour-donor-tab-radar"
                className={`ref-nav-item ${activeTab === 'radar-heatmap' ? 'active' : ''}`}
                onClick={() => { setActiveTab('radar-heatmap'); setMobileSidebarOpen(false); }}
                title={wt.reliefRadar}
              >
                <span className="material-symbols-outlined">radar</span>
                <span>{wt.reliefRadar}</span>
              </button>
            )}

            {interfaceMode !== 'simplified' && (
              <button 
                id="tour-donor-tab-donations"
                className={`ref-nav-item ${activeTab === 'my-donations' ? 'active' : ''}`}
                onClick={() => { setActiveTab('my-donations'); setMobileSidebarOpen(false); }}
                title={wt.myContributions}
              >
                <span className="material-symbols-outlined">receipt_long</span>
                <span>{wt.myContributions}</span>
              </button>
            )}

            <button 
              id="tour-donor-tab-settings"
              className={`ref-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => { setActiveTab('settings'); setMobileSidebarOpen(false); }}
              title={wt.profileSettings}
            >
              <span className="material-symbols-outlined">settings</span>
              <span>{wt.profileSettings}</span>
            </button>
          </div>
        </div>

        {/* ── Sidebar Bottom Footer Dock ── */}
        <div className="ref-sidebar-footer-group" id="tour-donor-sepolia-node">
          <button 
            type="button"
            className="ref-nav-item ref-nav-item-tutorial"
            onClick={() => { handleStartTour(); setMobileSidebarOpen(false); }}
            title={wt.guidedTutorial}
            aria-label={wt.guidedTutorial}
          >
            <span className="material-symbols-outlined">help</span>
            <span>{wt.guidedTutorial}</span>
          </button>
        </div>
      </aside>

        {/* ── Main Content Area ── */}
        <section className="ref-main-content">
          {walletAlertBanner}

          {/* ── 1. DASHBOARD OVERVIEW TAB ONLY (Shows Welcome Banner + 4 Metric Cards) ── */}
          {activeTab === 'dashboard' && (
            <div key="tab-dashboard" className="donor-tab-transition">
              {/* Institutional Vercel Page Header */}
              <div className="admin-page-header" id="tour-donor-dashboard-header">
                <div className="admin-page-title-wrap">
                  <h2 className="admin-page-title">
                    <span className="material-symbols-outlined icon" style={{ color: 'var(--text-primary)' }}>space_dashboard</span>
                    <span>{wt.dashboardOverview}</span>
                  </h2>
                  <p className="admin-page-sub">
                    {wt.donorOverviewSub}
                  </p>
                </div>
              </div>

              {/* ── 1. Borderless Editorial Hero with Vercel Geist Isometric Blockchain Backdrop ── */}
              <div className="dbo-editorial-hero" id="tour-donor-welcome">
                {/* Theme-reactive Photorealistic Vercel Geist 3D Glass Isometric Blockchain Backdrop */}
                <div className="dbo-hero-bg-mesh" aria-hidden="true" />

                <div className="dbo-hero-content">
                  <div className="dbo-hero-main-row">
                    <div className="dbo-hero-identity" id="tour-donor-identity">
                      <div className="dbo-hero-avatar">
                        {currentUser?.avatar_url && (currentUser.avatar_url.startsWith('data:') || currentUser.avatar_url.startsWith('http')) ? (
                          <img src={currentUser.avatar_url} alt="Profile" />
                        ) : currentUser?.avatar_url && currentUser.avatar_url.length < 30 ? (
                          <span className="material-symbols-outlined" style={{ fontSize: '24px', color: 'var(--text-primary)' }}>{currentUser.avatar_url}</span>
                        ) : (
                          userInitials
                        )}
                      </div>
                      <div className="dbo-hero-title-group">
                        <div className="dbo-hero-name-row">
                          <h1 className="dbo-hero-name">{userDisplayName || 'Donor Dashboard'}</h1>
                          <span
                            className="material-symbols-outlined dbo-hero-verified-icon"
                            title={wt.verifiedWorkspace}
                            aria-label={wt.verifiedWorkspace}
                          >
                            verified
                          </span>
                        </div>
                        <p className="dbo-hero-sub">
                          Verified PHP relief contributions anchored gaslessly on Ethereum Sepolia.
                        </p>
                      </div>
                    </div>

                    <div className="dbo-hero-actions" id="tour-donor-actions">
                      <button
                        type="button"
                        className="dbo-cmd-btn dbo-cmd-btn--primary"
                        onClick={() => setActiveTab('campaigns')}
                        title="Explore active disaster relief campaigns"
                      >
                        <span>{interfaceMode === 'simplified' ? wt.donateRelief : wt.browseCampaigns}</span>
                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>arrow_forward</span>
                      </button>

                      {interfaceMode !== 'simplified' && (
                        <button
                          type="button"
                          className="dbo-cmd-btn"
                          onClick={() => setActiveTab('radar-heatmap')}
                          title="Inspect Philippine disaster relief radar"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>map</span>
                          <span>{wt.exploreMap}</span>
                        </button>
                      )}

                      {interfaceMode !== 'simplified' && (
                        <a
                          href="https://sepolia.etherscan.io"
                          target="_blank"
                          rel="noreferrer"
                          className="dbo-cmd-ghost"
                          title="View Sepolia network explorer"
                        >
                          <span>{wt.publicLedger}</span>
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>north_east</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {pendingIntents.length > 0 && (
                    <div className="dbo-pending-banner">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <span className="material-symbols-outlined" style={{ color: '#f59e0b', fontSize: '19px', flexShrink: 0 }}>
                          pending_actions
                        </span>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                          <strong>Unfinished Direct-QR Donation ({pendingIntents[0].trackingCode}):</strong>{' '}
                          You started a <strong>₱{Number(pendingIntents[0].amountPhp || 0).toLocaleString('en-US')}</strong> {pendingIntents[0].paymentMethod} transfer to{' '}
                          <strong>{pendingIntents[0].campaignTitle}</strong> without uploading a receipt.
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <button
                          type="button"
                          className="dbo-cmd-btn dbo-cmd-btn--primary"
                          onClick={() => setActiveTab('campaigns')}
                          style={{ height: '30px', padding: '0 12px', fontSize: '0.74rem' }}
                        >
                          Upload Receipt
                        </button>
                        <button
                          type="button"
                          className="dbo-cmd-btn"
                          onClick={() => handleDismissPendingIntent(pendingIntents[0].intentId)}
                          style={{ height: '30px', padding: '0 10px', fontSize: '0.74rem' }}
                        >
                          I didn&apos;t pay
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Bare Hairline Stat Strip with Left Icons + Donor Tier Badge */}
                  <div
                    className={`dbo-bare-stats ${interfaceMode === 'simplified' ? 'cols-3' : 'cols-4'}`}
                    id="tour-donor-metrics"
                  >
                    <button
                      type="button"
                      className="dbo-bare-stat dbo-bare-stat--spark clickable"
                      onClick={() => setActiveTab('my-donations')}
                      title="View donation analytics and history"
                    >
                      <span className="dbo-bare-icon-box" aria-hidden="true">
                        <span className="material-symbols-outlined">payments</span>
                      </span>
                      <span className="dbo-bare-text">
                        <LiveCounter value={Math.round(totalDonatedPhp)} prefix="₱" duration={1050} className="dbo-bare-val" />
                        <span className="dbo-bare-lbl">{wt.metricTotalContributed}</span>
                      </span>
                      {contributionSparkline.hasData && (
                        <span className="dbo-spark-wrap" aria-hidden="true">
                          <span className="dbo-spark-delta">↑ +{contributionSparkline.deltaPct}%</span>
                          <svg className="dbo-spark-svg" viewBox="0 0 68 22" fill="none">
                            <defs>
                              <linearGradient id="dboSparkStroke" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#0d9488" />
                                <stop offset="100%" stopColor="#10b981" />
                              </linearGradient>
                              <linearGradient id="dboSparkFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
                                <stop offset="100%" stopColor="#0d9488" stopOpacity="0" />
                              </linearGradient>
                            </defs>
                            <path d={contributionSparkline.areaPath} fill="url(#dboSparkFill)" />
                            <path d={contributionSparkline.linePath} stroke="url(#dboSparkStroke)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                            <circle cx={contributionSparkline.peakX} cy={contributionSparkline.peakY} r="2.2" fill="#10b981" />
                          </svg>
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      className="dbo-bare-stat clickable"
                      onClick={() => setActiveTab('campaigns')}
                      title="Browse relief campaigns"
                    >
                      <span className="dbo-bare-icon-box" aria-hidden="true">
                        <span className="material-symbols-outlined">campaign</span>
                      </span>
                      <span className="dbo-bare-text">
                        <LiveCounter value={activeCampaignsCount} duration={850} className="dbo-bare-val" />
                        <span className="dbo-bare-lbl">{wt.metricLiveAppeals}</span>
                      </span>
                    </button>

                    <div className="dbo-bare-stat">
                      <span className="dbo-bare-icon-box" aria-hidden="true">
                        <span className="material-symbols-outlined">groups</span>
                      </span>
                      <span className="dbo-bare-text">
                        <LiveCounter value={estimatedFamiliesAided} prefix={estimatedFamiliesAided > 0 ? '~' : ''} duration={950} className="dbo-bare-val" />
                        <span className="dbo-bare-lbl">
                          {interfaceMode === 'simplified' ? 'People & Families Aided' : 'Families Reached'}
                        </span>
                      </span>
                    </div>

                    {interfaceMode !== 'simplified' && (
                      <button
                        type="button"
                        className="dbo-bare-stat clickable"
                        onClick={() => setActiveTab('my-donations')}
                        title="View your notarized donation receipts"
                      >
                        <span className="dbo-bare-icon-box" aria-hidden="true">
                          <span className="material-symbols-outlined">verified</span>
                        </span>
                        <span className="dbo-bare-text">
                          <LiveCounter value={donorReceiptsCount} duration={900} className="dbo-bare-val" />
                          <span className="dbo-bare-lbl">Verified Receipts</span>
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* ── 2. Editorial Bento Workspace (1+2 Featured Appeals + Activity Ledger & Milestone) ── */}
              <div className="dbo-workspace-split">
                {/* Left Column: Featured Appeals (1 Lead Spotlight + 2 Compact Cards) */}
                <div className="dbo-workspace-col" id="tour-donor-featured-causes">
                  <div className="dbo-section-bar">
                    <div className="dbo-section-title-group">
                      <h2 className="dbo-section-title">{wt.activeAppeals}</h2>
                      <span className="dbo-count-pill">{activeCampaignsCount}</span>
                    </div>
                    <button type="button" className="dbo-clean-link" onClick={() => setActiveTab('campaigns')}>
                      <span>{wt.viewAll}</span>
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
                    </button>
                  </div>

                  {fetchingCampaigns && campaigns.length === 0 ? (
                    <div className="dbo-appeals-stack">
                      <DbSkeletonCampRow />
                      <DbSkeletonCampRow />
                    </div>
                  ) : (!campaigns || campaigns.length === 0) ? (
                    <div className="db-empty-state">
                      <div className="db-empty-icon"><span className="material-symbols-outlined">inbox</span></div>
                      <div className="db-empty-title">No active campaigns on the ledger yet</div>
                      <div className="db-empty-desc">Check back soon for upcoming humanitarian relief missions.</div>
                    </div>
                  ) : (
                    <div className="dbo-bento-appeals">
                      {/* Lead Spotlight Campaign (#1) */}
                      {(() => {
                        const featuredList = activeCampaigns.length > 0 ? activeCampaigns : campaigns;
                        const camp = featuredList[0];
                        if (!camp) return null;
                        const pct = progressPct(camp.currentAmount, camp.targetAmount);
                        const cover = getCampaignCoverData(camp);
                        const catInfo = getCampaignCategoryInfo(camp);
                        const isCritical = (camp.audit?.urgency || camp.urgency || '').toUpperCase().includes('CRITICAL') || (camp.audit?.urgency || camp.urgency || '').toUpperCase().includes('URGENT');
                        const campPhpTarget = (camp.targetAmountPhp || camp.target_amount_php || Math.round((parseFloat(camp.targetAmount) || 0) * 170000)).toLocaleString('en-US');
                        const campPhpCurrent = Math.round((parseFloat(camp.currentAmount) || 0) * 170000).toLocaleString('en-US');

                        return (
                          <div className="dbo-spotlight-card" id="tour-donor-first-campaign">
                            <div
                              className="dbo-spotlight-media"
                              style={!lowBandwidthMode || loadedThumbs[camp.id] ? (cover.imageUrl ? { backgroundImage: `url(${cover.imageUrl})` } : undefined) : undefined}
                            >
                              <div className="dbo-spotlight-scrim" />
                              {lowBandwidthMode && !loadedThumbs[camp.id] && (
                                <button
                                  type="button"
                                  className="data-saver-load-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLoadedThumbs(prev => ({ ...prev, [camp.id]: true }));
                                  }}
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>image</span>
                                  <span>Load Photo</span>
                                </button>
                              )}
                            </div>

                            <div className="dbo-spotlight-body">
                              <div className="dbo-appeal-meta-pills">
                                <span className="dbo-cat-chip">{catInfo.label}</span>
                                {isCritical && <span className="dbo-cat-chip urgent">Critical</span>}
                                <span className="dbo-loc-text">{cover.locationTag || 'Philippines'}</span>
                              </div>

                              <h3 className="dbo-spotlight-title" title={camp.title}>
                                {formatCampaignTitle(camp.title, camp.id)}
                              </h3>

                              <div className="dbo-spotlight-progress">
                                <div className="dbo-clean-progress-bar">
                                  <div className="dbo-clean-progress-fill" style={{ width: `${Math.min(100, parseFloat(pct) || 0)}%` }} />
                                </div>
                                <div className="dbo-clean-progress-labels">
                                  <span><strong>₱{campPhpCurrent}</strong> <span className="dbo-goal-muted">/ ₱{campPhpTarget}</span></span>
                                  <span className="dbo-pct-val">{pct}%</span>
                                </div>
                              </div>

                              <div className="dbo-spotlight-footer">
                                <span className="dbo-org-label">{getOrgDisplayName(camp)}</span>
                                <div className="dbo-appeal-row-actions">
                                  {interfaceMode !== 'simplified' && (
                                    <button
                                      type="button"
                                      className="dbo-row-icon-btn"
                                      onClick={() => setSelectedCampaignForProof(camp)}
                                      title={wt.detailsMap}
                                      aria-label={wt.detailsMap}
                                    >
                                      <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>map</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="dbo-row-donate-btn"
                                    onClick={() => {
                                      setActiveTab('campaigns');
                                      setSearchQuery(camp.title || '');
                                    }}
                                  >
                                    <span>{interfaceMode === 'simplified' ? wt.donateRelief : wt.donate}</span>
                                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>arrow_forward</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Secondary 2-Column Compact Campaigns (#2 & #3) */}
                      {(activeCampaigns.length > 0 ? activeCampaigns : campaigns).length > 1 && (
                        <div className="dbo-secondary-grid">
                          {(activeCampaigns.length > 0 ? activeCampaigns : campaigns).slice(1, 3).map((camp) => {
                            const pct = progressPct(camp.currentAmount, camp.targetAmount);
                            const cover = getCampaignCoverData(camp);
                            const catInfo = getCampaignCategoryInfo(camp);
                            const campPhpTarget = (camp.targetAmountPhp || camp.target_amount_php || Math.round((parseFloat(camp.targetAmount) || 0) * 170000)).toLocaleString('en-US');
                            const campPhpCurrent = Math.round((parseFloat(camp.currentAmount) || 0) * 170000).toLocaleString('en-US');

                            return (
                              <div className="dbo-mini-appeal-card" key={camp.id}>
                                <div
                                  className="dbo-mini-media"
                                  style={!lowBandwidthMode || loadedThumbs[camp.id] ? (cover.imageUrl ? { backgroundImage: `url(${cover.imageUrl})` } : undefined) : undefined}
                                >
                                  <div className="dbo-mini-scrim" />
                                  <span className="dbo-mini-cat-chip">{catInfo.label}</span>
                                </div>

                                <div className="dbo-mini-body">
                                  <h3 className="dbo-mini-title" title={camp.title}>
                                    {formatCampaignTitle(camp.title, camp.id)}
                                  </h3>

                                  <div className="dbo-mini-progress">
                                    <div className="dbo-clean-progress-bar">
                                      <div className="dbo-clean-progress-fill" style={{ width: `${Math.min(100, parseFloat(pct) || 0)}%` }} />
                                    </div>
                                    <div className="dbo-clean-progress-labels">
                                      <span><strong>₱{campPhpCurrent}</strong> <span className="dbo-goal-muted">/ ₱{campPhpTarget}</span></span>
                                      <span className="dbo-pct-val">{pct}%</span>
                                    </div>
                                  </div>

                                  <div className="dbo-mini-footer">
                                    <span className="dbo-loc-text">{cover.locationTag || 'Philippines'}</span>
                                    <div className="dbo-appeal-row-actions">
                                      {interfaceMode !== 'simplified' && (
                                        <button
                                          type="button"
                                          className="dbo-row-icon-btn"
                                          onClick={() => setSelectedCampaignForProof(camp)}
                                          title={wt.detailsMap}
                                          aria-label={wt.detailsMap}
                                        >
                                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>map</span>
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        className="dbo-row-donate-btn"
                                        onClick={() => {
                                          setActiveTab('campaigns');
                                          setSearchQuery(camp.title || '');
                                        }}
                                      >
                                        <span>{wt.donate}</span>
                                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>arrow_forward</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right Column: Verified Activity Ledger + Honor Roll Milestone */}
                <div className="dbo-workspace-col">
                  <div className="dbo-section-bar">
                    <div className="dbo-section-title-group">
                      <h2 className="dbo-section-title">{wt.recentContributions}</h2>
                      {myDonations?.length > 0 && <span className="dbo-count-pill">{myDonations.length}</span>}
                    </div>
                    <button type="button" className="dbo-clean-link" onClick={() => setActiveTab('my-donations')}>
                      <span>{wt.viewReceipts}</span>
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
                    </button>
                  </div>

                  <div className="dbo-ledger-card">
                    {(!myDonations || myDonations.length === 0) ? (
                      <div style={{ padding: '28px 20px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>{wt.noContributions}</div>
                        <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '6px 0 14px', lineHeight: 1.5 }}>
                          Donate via GCash, Maya, Bank Transfer, or Card to anchor your first gasless on-chain receipt.
                        </p>
                        <button
                          type="button"
                          className="dbo-row-donate-btn"
                          style={{ display: 'inline-flex', margin: '0 auto' }}
                          onClick={() => setActiveTab('campaigns')}
                        >
                          <span>Explore Campaigns</span>
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>arrow_forward</span>
                        </button>
                      </div>
                    ) : (
                      <>
                        <div>
                          {myDonations.slice(0, 5).map((d, dIdx) => {
                            const rail = (d.paymentMethod || d.Payment_Method || 'PHP').toUpperCase();
                            const ethAmt = parseFloat(d.amount || d.Amount || 0);
                            const phpVal = d.phpAmount || Math.round(ethAmt * 170000);
                            const txHash = d.txHash || d.Tx_Hash;
                            const campTitle = d.campaignTitle || d.campaign_title || 'Relief Operation';

                            return (
                              <div className="dbo-feed-row" key={dIdx}>
                                <div className="dbo-feed-info">
                                  <span className="dbo-feed-rail">
                                    {rail.includes('GCASH') ? 'GCASH' : rail.includes('MAYA') ? 'MAYA' : (rail.includes('BANK') || rail.includes('CARD')) ? 'BANK' : 'PHP'}
                                  </span>
                                  <div className="dbo-feed-text">
                                    <div className="dbo-feed-title" title={campTitle}>{campTitle}</div>
                                    <div className="dbo-feed-meta">
                                      <span className="dbo-emerald-dot-sm" />
                                      <span>{interfaceMode === 'simplified' ? 'Verified' : 'On-Chain'}</span>
                                      {txHash && (
                                        <>
                                          <span style={{ opacity: 0.35 }}>·</span>
                                          <a
                                            href={`https://sepolia.etherscan.io/tx/${txHash}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="dbo-feed-link"
                                            title="View on Sepolia Etherscan"
                                          >
                                            <span>{shortAddr(txHash)}</span>
                                            <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>north_east</span>
                                          </a>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="dbo-feed-amt">+₱{phpVal.toLocaleString('en-US')}</div>
                              </div>
                            );
                          })}
                        </div>

                        <button
                          type="button"
                          className="dbo-ledger-footer-btn"
                          onClick={() => setActiveTab('my-donations')}
                        >
                          <span>View all {donorReceiptsCount} notarized receipts</span>
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
                        </button>
                      </>
                    )}
                  </div>


                </div>
              </div>
            </div>
          )}

          {/* ── 2. DEDICATED RELIEF CAMPAIGNS TAB (Vercel Geist Institutional Standard) ── */}
          {activeTab === 'campaigns' && (() => {
            const raisedPhp = campaigns.reduce((s, c) => s + (parseFloat(c.currentAmount) || 0), 0) * 170000;
            const activeDrivesCount = campaigns.filter(c => c.isActive !== false).length;
            const fundedCount = campaigns.filter(c => parseFloat(c.targetAmount) > 0 && parseFloat(c.currentAmount) >= parseFloat(c.targetAmount)).length;
            const orgCount = new Set(campaigns.map(c => c.orgName || c.orgAddress).filter(Boolean)).size;
            const startIdx = filteredCampaigns.length === 0 ? 0 : ((currentPage - 1) * campaignsPerPage) + 1;
            const endIdx = Math.min(filteredCampaigns.length, currentPage * campaignsPerPage);
            const isGridView = viewMode === 'grid' || viewMode === 'grid-3' || viewMode === 'grid-2';

            return (
            <div key="tab-campaigns" id="tour-campaigns-container" className="ec-page donor-tab-transition">
              {/* Institutional Vercel Page Header with Inline Registry Snapshot */}
              <div className="admin-page-header" id="tour-campaigns-header">
                <div className="admin-page-title-wrap">
                  <h2 className="admin-page-title">
                    <span className="material-symbols-outlined icon" style={{ color: 'var(--text-primary)' }}>explore</span>
                    <span>{wt.exploreCampaigns}</span>
                  </h2>
                  <p className="admin-page-sub">
                    {wt.allCampaignsSub}
                  </p>
                </div>

                <div className="ec-head-stats">
                  <div className="ec-head-stat">
                    <span className="ec-head-stat-val">
                      <span className="ec-live-dot" />
                      <LiveCounter value={Math.round(raisedPhp)} prefix="₱" duration={1050} />
                    </span>
                    <span className="ec-head-stat-lbl">raised to date</span>
                  </div>
                  <div className="ec-head-stat">
                    <LiveCounter value={activeDrivesCount} duration={800} className="ec-head-stat-val" />
                    <span className="ec-head-stat-lbl">active drives</span>
                  </div>
                  <div className="ec-head-stat">
                    <LiveCounter value={fundedCount} duration={800} className="ec-head-stat-val" />
                    <span className="ec-head-stat-lbl">fully funded</span>
                  </div>
                </div>
              </div>

              {/* ── 2. Unified Vercel Geist Command & Filter Bar ── */}
              <div className="ec-toolbar-panel" id="tour-campaigns-toolbar">
                <div className="ec-toolbar-row">
                  {/* Search Input with ⌘K */}
                  <div className="ec-search-box">
                    <span className="material-symbols-outlined ec-search-icon">search</span>
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search campaigns, NGOs, provinces, or tags..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          e.target.blur();
                        }
                      }}
                      className="ec-search-input"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="ec-search-clear"
                        title="Clear search"
                        aria-label="Clear search"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
                      </button>
                    )}
                    <kbd className="ec-search-kbd" title="Press Ctrl+K or ⌘K to focus search">⌘K</kbd>
                  </div>

                  {/* Filter Controls Cluster */}
                  <div className="ec-filters-group">
                    {/* Cause Dropdown */}
                    <div className="ec-dropdown-wrap" ref={causesDropdownRef}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCausesDropdown(prev => !prev);
                          setShowPrioritiesDropdown(false);
                          setShowTagsDropdown(false);
                          setShowSortDropdown(false);
                        }}
                        className={`ec-filter-btn ${categoryFilter !== 'ALL' ? 'is-active' : ''}`}
                        title="Filter by cause category"
                      >
                        <span className="material-symbols-outlined ec-filter-icon">{selectedCauseObj.icon}</span>
                        <span>{selectedCauseObj.label}</span>
                        <span className="material-symbols-outlined ec-filter-chevron">
                          {showCausesDropdown ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>

                      {showCausesDropdown && (
                        <div className="ec-popover">
                          <div className="ec-popover-label">Cause Category</div>
                          {CAUSE_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setCategoryFilter(opt.value);
                                setShowCausesDropdown(false);
                              }}
                              className={`ec-popover-opt ${categoryFilter === opt.value ? 'is-selected' : ''}`}
                            >
                              <span className="material-symbols-outlined ec-popover-opt-icon">{opt.icon}</span>
                              <span>{opt.label}</span>
                              {categoryFilter === opt.value && (
                                <span className="material-symbols-outlined ec-popover-check">check</span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Priority Dropdown */}
                    <div className="ec-dropdown-wrap" ref={prioritiesDropdownRef}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowPrioritiesDropdown(prev => !prev);
                          setShowCausesDropdown(false);
                          setShowTagsDropdown(false);
                          setShowSortDropdown(false);
                        }}
                        className={`ec-filter-btn ${urgencyFilter !== 'ALL' ? 'is-active' : ''}`}
                        title="Filter by urgency priority"
                      >
                        <span className="material-symbols-outlined ec-filter-icon">{selectedPriorityObj.icon}</span>
                        <span>{selectedPriorityObj.label}</span>
                        <span className="material-symbols-outlined ec-filter-chevron">
                          {showPrioritiesDropdown ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>

                      {showPrioritiesDropdown && (
                        <div className="ec-popover">
                          <div className="ec-popover-label">Urgency Priority</div>
                          {PRIORITY_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setUrgencyFilter(opt.value);
                                setShowPrioritiesDropdown(false);
                              }}
                              className={`ec-popover-opt ${urgencyFilter === opt.value ? 'is-selected' : ''}`}
                            >
                              <span className="material-symbols-outlined ec-popover-opt-icon">{opt.icon}</span>
                              <span>{opt.label}</span>
                              {urgencyFilter === opt.value && (
                                <span className="material-symbols-outlined ec-popover-check">check</span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Tags Multi-Select Popover */}
                    <div className="ec-dropdown-wrap" ref={tagsDropdownRef}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowTagsDropdown(prev => !prev);
                          setShowCausesDropdown(false);
                          setShowPrioritiesDropdown(false);
                          setShowSortDropdown(false);
                        }}
                        className={`ec-filter-btn ${selectedTags.length > 0 ? 'is-active' : ''}`}
                        title="Filter by tags"
                      >
                        <span className="material-symbols-outlined ec-filter-icon">sell</span>
                        <span>Tags</span>
                        {selectedTags.length > 0 && (
                          <span className="ec-filter-badge">{selectedTags.length}</span>
                        )}
                        <span className="material-symbols-outlined ec-filter-chevron">
                          {showTagsDropdown ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>

                      {showTagsDropdown && (
                        <div className="ec-popover ec-tags-popover">
                          <div className="ec-tags-popover-head">
                            <span className="ec-popover-label" style={{ padding: 0 }}>Filter by Tags</span>
                            {selectedTags.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setSelectedTags([])}
                                className="ec-tags-clear-btn"
                              >
                                Clear ({selectedTags.length})
                              </button>
                            )}
                          </div>

                          <div className="ec-tags-list">
                            <label className={`ec-tag-row ${selectedTags.length === 0 ? 'is-checked' : ''}`}>
                              <input
                                type="checkbox"
                                checked={selectedTags.length === 0}
                                onChange={() => setSelectedTags([])}
                              />
                              <span className="ec-tag-name">All Tags</span>
                              <span className="ec-tag-count">{campaigns?.length || 0}</span>
                            </label>

                            {availableTags.map((tag) => {
                              const isChecked = selectedTags.includes(tag);
                              const count = tagCounts[tag] || 0;
                              return (
                                <label key={tag} className={`ec-tag-row ${isChecked ? 'is-checked' : ''}`}>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleTag(tag)}
                                  />
                                  <span className="ec-tag-name">#{tag}</span>
                                  {count > 0 && <span className="ec-tag-count">{count}</span>}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Tracked Watchlist Toggle */}
                    <button
                      type="button"
                      onClick={() => setOnlyTracked(prev => !prev)}
                      className={`ec-filter-btn ${onlyTracked ? 'is-active' : ''}`}
                      title={onlyTracked ? 'Showing tracked campaigns. Click to show all' : 'Filter by campaigns you are tracking'}
                    >
                      {onlyTracked ? (
                        <span className="ec-live-dot" />
                      ) : (
                        <span className="material-symbols-outlined ec-filter-icon">visibility</span>
                      )}
                      <span>Tracked</span>
                    </button>

                    <span className="ec-toolbar-divider" aria-hidden="true" />

                    {/* Sort Popover */}
                    <div className="ec-dropdown-wrap" ref={sortDropdownRef}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowSortDropdown(prev => !prev);
                          setShowCausesDropdown(false);
                          setShowPrioritiesDropdown(false);
                          setShowTagsDropdown(false);
                        }}
                        className="ec-filter-btn"
                        title="Sort campaigns"
                      >
                        <span className="material-symbols-outlined ec-filter-icon">swap_vert</span>
                        <span>{selectedSortObj.label}</span>
                        <span className="material-symbols-outlined ec-filter-chevron">
                          {showSortDropdown ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>

                      {showSortDropdown && (
                        <div className="ec-popover ec-popover--right">
                          <div className="ec-popover-label">Sort Order</div>
                          {SORT_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setCampaignSort(opt.value);
                                setShowSortDropdown(false);
                              }}
                              className={`ec-popover-opt ${campaignSort === opt.value ? 'is-selected' : ''}`}
                            >
                              <span className="material-symbols-outlined ec-popover-opt-icon">{opt.icon}</span>
                              <span>{opt.label}</span>
                              {campaignSort === opt.value && (
                                <span className="material-symbols-outlined ec-popover-check">check</span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Segmented List / Grid Switcher */}
                    <div className="ec-view-seg" role="group" aria-label="Layout view mode">
                      <button
                        type="button"
                        onClick={() => handleViewModeChange('list')}
                        className={`ec-view-seg-btn ${viewMode === 'list' ? 'is-active' : ''}`}
                        title="List View"
                        aria-label="List View"
                      >
                        <span className="material-symbols-outlined">format_list_bulleted</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleViewModeChange('grid')}
                        className={`ec-view-seg-btn ${isGridView ? 'is-active' : ''}`}
                        title="Grid View"
                        aria-label="Grid View"
                      >
                        <span className="material-symbols-outlined">grid_view</span>
                      </button>
                    </div>

                    {/* Sync Registry Icon Button (Contextual beside Data Controls) */}
                    <button
                      type="button"
                      className="ec-sync-icon-btn"
                      onClick={fetchCampaigns}
                      disabled={fetchingCampaigns}
                      title={fetchingCampaigns ? 'Syncing campaigns...' : 'Sync registry from ledger'}
                      aria-label="Sync registry from ledger"
                    >
                      <span className={`material-symbols-outlined ${fetchingCampaigns ? 'spinning' : ''}`}>
                        sync
                      </span>
                    </button>
                  </div>
                </div>

                {/* Integrated Results & Active Filters Sub-bar */}
                <div className="ec-toolbar-subbar">
                  <div className="ec-subbar-left">
                    <div className="ec-result-count">
                      <span className="ec-live-dot" />
                      <span>
                        Showing <strong>{filteredCampaigns.length}</strong> of {campaigns?.length || 0} campaigns
                      </span>
                    </div>

                    {hasActiveFilters && (
                      <div className="ec-active-chips">
                        {categoryFilter !== 'ALL' && (
                          <span className="ec-active-chip">
                            <span>{categoryFilter === 'DR' ? 'Disaster Relief' : 'Charitable Aid'}</span>
                            <button type="button" onClick={() => setCategoryFilter('ALL')} aria-label="Remove cause filter">
                              <span className="material-symbols-outlined">close</span>
                            </button>
                          </span>
                        )}

                        {urgencyFilter !== 'ALL' && (
                          <span className="ec-active-chip">
                            <span>{urgencyFilter === 'HIGH' ? 'High Priority' : urgencyFilter === 'MEDIUM' ? 'Medium Priority' : 'Standard Priority'}</span>
                            <button type="button" onClick={() => setUrgencyFilter('ALL')} aria-label="Remove priority filter">
                              <span className="material-symbols-outlined">close</span>
                            </button>
                          </span>
                        )}

                        {selectedTags.map((tag) => (
                          <span key={tag} className="ec-active-chip">
                            <span>#{tag}</span>
                            <button type="button" onClick={() => toggleTag(tag)} aria-label={`Remove tag #${tag}`}>
                              <span className="material-symbols-outlined">close</span>
                            </button>
                          </span>
                        ))}

                        {searchQuery.trim() && (
                          <span className="ec-active-chip">
                            <span>"{searchQuery.trim()}"</span>
                            <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear search query">
                              <span className="material-symbols-outlined">close</span>
                            </button>
                          </span>
                        )}

                        {onlyTracked && (
                          <span className="ec-active-chip">
                            <span className="ec-live-dot" />
                            <span>Tracked</span>
                            <button type="button" onClick={() => setOnlyTracked(false)} aria-label="Show all campaigns">
                              <span className="material-symbols-outlined">close</span>
                            </button>
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={resetAllFilters}
                          className="ec-clear-all-btn"
                          title="Reset all filters and search"
                        >
                          Clear all
                        </button>
                      </div>
                    )}
                  </div>

                  {filteredCampaigns.length > 0 && (
                    <div className="ec-subbar-meta">
                      Page {currentPage} of {Math.max(1, totalPages)}
                    </div>
                  )}
                </div>
              </div>

              {/* ── 3. Campaign Directory Stage ── */}
              <div className="ec-campaigns-stage">
                {fetchingCampaigns && campaigns.length === 0 ? (
                  <div
                    className={isGridView ? 'campaigns-grid' : 'campaigns-list'}
                    aria-busy="true"
                  >
                    {Array.from({ length: paginatedCampaigns.length || campaignsPerPage }, (_, i) => (
                      <DbSkeletonCard key={i} />
                    ))}
                  </div>
                ) : filteredCampaigns.length === 0 ? (
                  onlyTracked ? (
                    <div className="ec-empty-state">
                      <div className="ec-empty-icon">
                        <span className="material-symbols-outlined">visibility</span>
                      </div>
                      <h3 className="ec-empty-title">No Tracked Relief Operations Yet</h3>
                      <p className="ec-empty-desc">
                        Click the <strong>Track</strong> button on any campaign card to follow its milestones, disbursement proofs, and verified on-chain receipts.
                      </p>
                      <button
                        type="button"
                        className="dbo-cmd-btn dbo-cmd-btn--primary"
                        onClick={() => setOnlyTracked(false)}
                      >
                        <span>Browse All Campaigns</span>
                      </button>
                    </div>
                  ) : (
                    <div className="ec-empty-state">
                      <div className="ec-empty-icon">
                        <span className="material-symbols-outlined">search_off</span>
                      </div>
                      <h3 className="ec-empty-title">No campaigns match your filters</h3>
                      <p className="ec-empty-desc">
                        Try broadening your cause category, priority level, or clearing search keywords.
                      </p>
                      <button
                        type="button"
                        className="dbo-cmd-btn dbo-cmd-btn--primary"
                        onClick={resetAllFilters}
                      >
                        <span>Reset All Filters</span>
                      </button>
                    </div>
                  )
                ) : (
                  <>
                    <div className={isGridView ? 'campaigns-grid' : 'campaigns-list'}>
                      {paginatedCampaigns.map((camp) => (
                        <CampaignCard
                          key={camp.id}
                          camp={camp}
                          contract={contract}
                          role={ROLES.DONOR}
                          walletAddress={walletAddress}
                          currentUser={currentUser}
                          interfaceMode={interfaceMode}
                          lowBandwidthMode={lowBandwidthMode}
                          language={language}
                          onDonated={() => fetchCampaigns({ silent: true })}
                          onOpenNgoProfile={onOpenNgoProfile}
                        />
                      ))}
                    </div>

                    {/* Clean Centered Pagination Controls */}
                    <div className="ec-pagination-centered">
                      <button
                        type="button"
                        className="ec-pag-btn ec-pag-btn--icon"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        title="Previous Page"
                        aria-label="Previous Page"
                      >
                        <span className="material-symbols-outlined">chevron_left</span>
                      </button>

                      {getPaginationItems(currentPage, totalPages, 7).map((item, idx) => {
                        if (item === '...') {
                          return (
                            <span key={`ellipsis-${idx}`} className="ec-pag-ellipsis">
                              …
                            </span>
                          );
                        }
                        const pageNum = Number(item);
                        return (
                          <button
                            key={pageNum}
                            type="button"
                            className={`ec-pag-btn ${currentPage === pageNum ? 'is-active' : ''}`}
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        className="ec-pag-btn ec-pag-btn--icon"
                        disabled={currentPage >= Math.max(1, totalPages)}
                        onClick={() => setCurrentPage(p => Math.min(Math.max(1, totalPages), p + 1))}
                        title="Next Page"
                        aria-label="Next Page"
                      >
                        <span className="material-symbols-outlined">chevron_right</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
            );
          })()}

          {/* ── 3. MY CONTRIBUTIONS TAB (Vercel-Standard Redesign) ── */}
          {activeTab === 'my-donations' && (() => {
            const totalReceiptsLen = myDonations ? myDonations.length : 0;
            const gcashCount = (myDonations || []).filter(d => String(d.paymentMethod || '').toUpperCase().includes('GCASH')).length;
            const mayaCount = (myDonations || []).filter(d => String(d.paymentMethod || '').toUpperCase().includes('MAYA')).length;
            const otherRailCount = Math.max(0, totalReceiptsLen - gcashCount - mayaCount);
            const gcashPct = totalReceiptsLen > 0 ? Math.round((gcashCount / totalReceiptsLen) * 100) : 0;
            const mayaPct = totalReceiptsLen > 0 ? Math.round((mayaCount / totalReceiptsLen) * 100) : 0;
            const otherPct = totalReceiptsLen > 0 ? Math.max(0, 100 - gcashPct - mayaPct) : 0;
            const tierPct = activeTierInfo?.nextTier ? Math.min(100, Math.max(4, Math.round(activeTierInfo.progressPct || 0))) : 100;

            return (
            <div key="tab-my-donations" className="bbdrts-contributions-tab rcp-vault-page donor-tab-transition">
              {/* Institutional Vercel Page Header */}
              <div className="admin-page-header" id="tour-donations-header">
                <div className="admin-page-title-wrap">
                  <h2 className="admin-page-title">
                    <span className="material-symbols-outlined icon" style={{ color: 'var(--text-primary)' }}>receipt_long</span>
                    <span>{wt.myContributions}</span>
                  </h2>
                  <p className="admin-page-sub">
                    {wt.contributionsSub}
                  </p>
                </div>

                <div className="admin-page-header-actions">
                  <button
                    type="button"
                    className="dbo-cmd-btn dbo-cmd-btn--primary"
                    onClick={() => setDonorExportOpen(true)}
                    title="Filter & export your organized contribution report (Excel, CSV, or PDF)"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>tune</span>
                    <span>Export Report</span>
                  </button>

                  <button
                    type="button"
                    className="dbo-cmd-btn"
                    onClick={fetchMyDonations}
                    disabled={loadingMyDonations}
                    title="Sync receipts directly from smart contract and database"
                  >
                    <span className={`material-symbols-outlined ${loadingMyDonations ? 'spinning' : ''}`} style={{ fontSize: '15px' }}>
                      sync
                    </span>
                    <span>{loadingMyDonations ? 'Syncing...' : 'Sync Receipts'}</span>
                  </button>
                </div>
              </div>

              {/* ── 1. Borderless Ledger Summary Band (Directly on Canvas — Zero Heavy Boxes) ── */}
              <div className="rcp-summary-band">
                <div className="rcp-band-cell rcp-band-cell--primary">
                  <div className="rcp-band-val-row">
                    <LiveCounter value={Math.round(totalDonatedPhp)} prefix="₱" duration={1050} className="rcp-band-total" />
                    <span className={`rcp-audit-pill ${hasAnyShortage ? 'is-alert' : 'is-ok'}`}>
                      <span className={`rcp-live-dot ${hasAnyShortage ? 'is-alert' : ''}`} />
                      <span>{hasAnyShortage ? 'Shortage Notarized' : '100% Balanced'}</span>
                    </span>
                  </div>
                  <span className="rcp-band-lbl">Total Contributed · Gasless Sepolia Notarized</span>
                </div>

                <div className="rcp-band-cell">
                  <LiveCounter value={totalReceiptsLen} duration={850} className="rcp-band-num" />
                  <span className="rcp-band-lbl">Receipts ({drReceiptsCount} DR · {cdReceiptsCount} CD)</span>
                </div>

                <div className="rcp-band-cell">
                  <LiveCounter value={uniqueCausesCount} duration={850} className="rcp-band-num" />
                  <span className="rcp-band-lbl">Campaigns Supported</span>
                </div>

                <div className="rcp-band-cell">
                  <span className="rcp-band-num" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#10b981' }}>verified_user</span>
                    <span>Sepolia</span>
                  </span>
                  <span className="rcp-band-lbl">On-Chain Proof Active</span>
                </div>
              </div>

              {/* ── 1B. Compact Asymmetric Analytics Split (Chart 1.75fr + Payment Channels 1fr) ── */}
              <div className="rcp-analytics-split">
                <DonationAnalyticsChart donations={myDonations} />

                <div className="rcp-channels-card">
                  <div className="rcp-ch-header">
                    <div className="rcp-ch-title-row">
                      <span className="rcp-ch-icon" aria-hidden="true">
                        <span className="material-symbols-outlined">account_balance_wallet</span>
                      </span>
                      <h3 className="da-title">Payment Channels</h3>
                    </div>
                    <span className="rcp-ch-count">{totalReceiptsLen} tx</span>
                  </div>

                  <div className="rcp-ch-list">
                    {[
                      { label: 'GCash', count: gcashCount, pct: gcashPct, barClass: 'is-teal' },
                      { label: 'Card / Bank', count: otherRailCount, pct: otherPct, barClass: 'is-mono' },
                      { label: 'Maya', count: mayaCount, pct: mayaPct, barClass: 'is-emerald' }
                    ].map((ch) => (
                      <div className="rcp-ch-row" key={ch.label}>
                        <div className="rcp-ch-row-top">
                          <span className="rcp-ch-name">{ch.label}</span>
                          <span className="rcp-ch-meta">
                            <strong>{ch.count}</strong> · {ch.pct}%
                          </span>
                        </div>
                        <div className="rcp-ch-track">
                          <div className={`rcp-ch-fill ${ch.barClass}`} style={{ width: `${ch.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rcp-ch-footer">
                    <span className="rcp-live-dot" />
                    <span>0% BBDRTS Markup · Gasless Sepolia Relay</span>
                  </div>
                </div>
              </div>

              {/* ── 2. Unified Vercel Geist Receipt Ledger Panel (Integrated Filters + 10-Row Pagination) ── */}
              {(() => {
                const totalFiltered = filteredMyDonations.length;
                const totalReceiptPages = Math.max(1, Math.ceil(totalFiltered / RECEIPTS_PER_PAGE));
                const safeReceiptsPage = Math.min(receiptsPage, totalReceiptPages);
                const startIdx = (safeReceiptsPage - 1) * RECEIPTS_PER_PAGE;
                const endIdx = Math.min(startIdx + RECEIPTS_PER_PAGE, totalFiltered);
                const paginatedReceipts = filteredMyDonations.slice(startIdx, endIdx);
                const hasActiveFilters = receiptFilter !== 'ALL' || receiptRailFilter !== 'ALL' || searchQueryReceipts.trim() !== '';

                const goToReceiptPage = (nextPage) => {
                  const clamped = Math.max(1, Math.min(totalReceiptPages, nextPage));
                  setReceiptsPage(clamped);
                  if (receiptsLedgerRef.current) {
                    const top = receiptsLedgerRef.current.getBoundingClientRect().top + window.scrollY - 76;
                    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
                  }
                };

                return (
                  <div className="rcp-ledger-panel" ref={receiptsLedgerRef}>
                    {/* Integrated Filter & Search Toolbar */}
                    <div className="rcp-panel-toolbar">
                      <div className="rcp-search-box">
                        <span className="material-symbols-outlined rcp-search-icon">search</span>
                        <input
                          type="text"
                          className="rcp-search-input"
                          placeholder="Search campaign, TX hash, or reference..."
                          value={searchQueryReceipts}
                          onChange={(e) => setSearchQueryReceipts(e.target.value)}
                        />
                        {searchQueryReceipts && (
                          <button
                            type="button"
                            className="rcp-search-clear"
                            onClick={() => setSearchQueryReceipts('')}
                            title="Clear search"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
                          </button>
                        )}
                      </div>

                      <div className="rcp-filter-seg">
                        <button
                          type="button"
                          className={`rcp-seg-btn ${receiptFilter === 'ALL' ? 'active' : ''}`}
                          onClick={() => setReceiptFilter('ALL')}
                        >
                          <span>All</span>
                          <span className="rcp-seg-cnt">{totalReceiptsLen}</span>
                        </button>
                        <button
                          type="button"
                          className={`rcp-seg-btn ${receiptFilter === 'DR' ? 'active' : ''}`}
                          onClick={() => setReceiptFilter('DR')}
                        >
                          <span>Disaster Relief</span>
                          <span className="rcp-seg-cnt">{drReceiptsCount}</span>
                        </button>
                        <button
                          type="button"
                          className={`rcp-seg-btn ${receiptFilter === 'CD' ? 'active' : ''}`}
                          onClick={() => setReceiptFilter('CD')}
                        >
                          <span>Charitable Aid</span>
                          <span className="rcp-seg-cnt">{cdReceiptsCount}</span>
                        </button>
                      </div>

                      <div className="rcp-select-cluster">
                        <GeistSelect
                          compact
                          width="154px"
                          menuMinWidth={210}
                          value={receiptRailFilter}
                          onChange={(val) => setReceiptRailFilter(val)}
                          options={[
                            { id: 'ALL', label: 'All Channels', sub: 'Every payment method', icon: 'apps' },
                            { id: 'GCASH', label: 'GCash', sub: 'GCash e-wallet transfers', icon: 'account_balance_wallet' },
                            { id: 'MAYA', label: 'Maya', sub: 'Maya e-wallet transfers', icon: 'account_balance_wallet' },
                            { id: 'CARD', label: 'Card / Bank', sub: 'QR Ph, cards & bank rails', icon: 'credit_card' }
                          ]}
                        />

                        <GeistSelect
                          compact
                          alignRight
                          width="158px"
                          menuMinWidth={200}
                          value={receiptSort}
                          onChange={(val) => setReceiptSort(val)}
                          options={[
                            { id: 'NEWEST', label: 'Newest First', icon: 'schedule' },
                            { id: 'AMOUNT_HIGH', label: 'Highest Amount', icon: 'trending_up' },
                            { id: 'AMOUNT_LOW', label: 'Lowest Amount', icon: 'trending_down' },
                            { id: 'OLDEST', label: 'Oldest First', icon: 'history' }
                          ]}
                        />
                      </div>
                    </div>

                    {/* Crisp Ledger Sub-Header */}
                    <div className="rcp-ledger-subhead">
                      <span>Campaign &amp; Cryptographic Proof</span>
                      <div className="rcp-subhead-right">
                        {hasActiveFilters && (
                          <button
                            type="button"
                            className="rcp-reset-link"
                            onClick={() => {
                              setReceiptFilter('ALL');
                              setReceiptRailFilter('ALL');
                              setSearchQueryReceipts('');
                            }}
                          >
                            Reset filters
                          </button>
                        )}
                        <span className="rcp-subhead-count">
                          {totalFiltered > 0 ? `${startIdx + 1}–${endIdx} of ${totalFiltered}` : '0 receipts'}
                        </span>
                      </div>
                    </div>

                    {/* Ledger Rows: Skeleton | Empty | Paginated 10 Rows */}
                    {loadingMyDonations ? (
                      <div>
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} className="rcp-row rcp-row-skel">
                            <div className="rcp-skel-thumb db-skel" />
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <span className="db-skel" style={{ width: '48%', height: '15px', borderRadius: '4px' }} />
                              <span className="db-skel" style={{ width: '68%', height: '11px', borderRadius: '4px' }} />
                              <span className="db-skel" style={{ width: '36%', height: '11px', borderRadius: '4px' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                              <span className="db-skel" style={{ width: '82px', height: '18px', borderRadius: '4px' }} />
                              <span className="db-skel" style={{ width: '130px', height: '26px', borderRadius: '6px' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : !myDonations || myDonations.length === 0 ? (
                      <div className="rcp-empty-inner">
                        <div className="db-empty-icon-wrap">
                          <span className="material-symbols-outlined">receipt_long</span>
                        </div>
                        <h3 className="db-empty-title">No contributions recorded yet</h3>
                        <p className="db-empty-desc">
                          When you support any active disaster relief campaign using GCash, Maya, Card, or Bank Transfer, your digital receipts and gasless Sepolia audit proofs will appear here.
                        </p>
                        <div className="db-empty-action">
                          <button
                            type="button"
                            className="dbo-cmd-btn dbo-cmd-btn--primary"
                            onClick={() => setActiveTab('campaigns')}
                          >
                            <span>Explore Relief Campaigns</span>
                            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>arrow_forward</span>
                          </button>
                        </div>
                      </div>
                    ) : totalFiltered === 0 ? (
                      <div className="rcp-empty-inner">
                        <div className="db-empty-icon-wrap">
                          <span className="material-symbols-outlined">filter_list_off</span>
                        </div>
                        <h3 className="db-empty-title">No receipts match your search</h3>
                        <p className="db-empty-desc">
                          No contributions match your current filter combination. Try selecting "All Channels" or clearing your search term.
                        </p>
                        <div className="db-empty-action">
                          <button
                            type="button"
                            className="dbo-cmd-btn"
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
                      <>
                        <div>
                          {paginatedReceipts.map((d, idx) => {
                            const matchCamp = campaigns.find(c => String(c.id) === String(d.campaignId)) || { id: d.campaignId, title: `Disaster Relief Campaign #${d.campaignId}` };
                            const rawTitle = matchCamp ? matchCamp.title : `Disaster Relief Campaign #${d.campaignId}`;
                            const campTitle = formatCampaignTitle(rawTitle, d.campaignId);
                            const catInfo = getCampaignCategoryInfo(matchCamp);
                            const coverData = getCampaignCoverData(matchCamp);
                            const orgName = getOrgDisplayName(matchCamp.orgAddress, matchCamp.orgName, d.campaignId);

                            const pm = (d.paymentMethod || 'CARD').toUpperCase();
                            const railLabel = pm.includes('GCASH') ? 'GCASH' : pm.includes('MAYA') ? 'MAYA' : (pm.includes('BANK') || pm.includes('CARD')) ? 'CARD / BANK' : ((d.paymentMethod && !/eth|crypto|metamask/i.test(d.paymentMethod)) ? d.paymentMethod.toUpperCase() : 'PHP');
                            const ethAmt = parseFloat(d.amount || 0);
                            const rawEthPhp = Math.round(ethAmt * 170000);
                            const isShortage = d.auditStatus === 'SHORTAGE' || Number(d.variancePhp || 0) < -20;
                            const phpAmt = !isShortage && Number(d.declaredPhp) > 0 && Math.abs(rawEthPhp - Number(d.declaredPhp)) <= 20
                              ? Number(d.declaredPhp)
                              : (Number(d.creditedPhp) > 0 ? Number(d.creditedPhp) : rawEthPhp);
                            const isDisbursed = matchCamp.disbursementStatus === 'DISBURSED' || matchCamp.disbursementStatus === 'PARTIALLY_DISBURSED' || (matchCamp.disbursedAmountPhp || 0) > 0;
                            const dateLabel = d.createdAt
                              ? new Date(d.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                              : 'Recent';

                            return (
                              <div key={d.txHash || `${startIdx + idx}`} className={`rcp-row ${isShortage ? 'is-shortage' : ''}`}>
                                <div className="rcp-row-main">
                                  <button
                                    type="button"
                                    className="rcp-thumb-btn"
                                    onClick={() => setSelectedCampaignForProof(matchCamp)}
                                    title="Inspect campaign details"
                                  >
                                    <img src={coverData.imageUrl} alt={campTitle} className="rcp-thumb-img" loading="lazy" />
                                  </button>

                                  <div className="rcp-row-center">
                                    <div className="rcp-row-title-line">
                                      <h3
                                        className="rcp-row-title"
                                        onClick={() => setSelectedCampaignForProof(matchCamp)}
                                        title={campTitle}
                                      >
                                        {campTitle}
                                      </h3>

                                      {isDisbursed ? (
                                        <button
                                          type="button"
                                          className="rcp-status-pill is-disbursed"
                                          onClick={() => setSelectedProofCamp(matchCamp)}
                                          title="View verified beneficiary distribution receipts"
                                        >
                                          <span className="rcp-status-dot ok" />
                                          <span>Relief Disbursed</span>
                                        </button>
                                      ) : isShortage ? (
                                        <span className="rcp-status-pill is-shortage">
                                          <span className="rcp-status-dot alert" />
                                          <span>Shortage Detected</span>
                                        </span>
                                      ) : (
                                        <span className="rcp-status-pill">
                                          <span className="rcp-status-dot ok" />
                                          <span>Confirmed On-Chain</span>
                                        </span>
                                      )}
                                    </div>

                                    <div className="rcp-row-meta">
                                      <button
                                        type="button"
                                        className="rcp-org-link"
                                        onClick={() => onOpenNgoProfile && onOpenNgoProfile(matchCamp.orgId || 3)}
                                        title="View verified NGO credentials"
                                      >
                                        <span>{orgName}</span>
                                        <span className="material-symbols-outlined rcp-org-check">verified</span>
                                      </button>
                                      <span className="rcp-dot-sep">·</span>
                                      <span>{catInfo.label}</span>
                                      <span className="rcp-dot-sep">·</span>
                                      <span>{dateLabel}</span>
                                      {coverData.locationTag && (
                                        <>
                                          <span className="rcp-dot-sep">·</span>
                                          <span className="rcp-loc-clip">{coverData.locationTag}</span>
                                        </>
                                      )}
                                    </div>

                                    <div className="rcp-proof-strip">
                                      <span className="rcp-rail-badge">{railLabel}</span>

                                      {d.referenceNumber && (
                                        <span className="rcp-ref-tag" title="Payment Reference Number">
                                          Ref: {d.referenceNumber}
                                        </span>
                                      )}

                                      <span className="rcp-hash-chip">
                                        <span className="rcp-hash-prefix">TX</span>
                                        <span className="rcp-hash-val">
                                          {d.txHash ? `${d.txHash.slice(0, 8)}...${d.txHash.slice(-6)}` : 'Verified'}
                                        </span>
                                        {d.txHash && (
                                          <button
                                            type="button"
                                            className="rcp-hash-action"
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
                                            className="rcp-hash-action"
                                            title="Inspect on Sepolia Etherscan"
                                          >
                                            <span className="material-symbols-outlined">north_east</span>
                                          </a>
                                        )}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="rcp-row-right">
                                    <div className="rcp-amt-block">
                                      <div className={`rcp-amt-val ${isShortage ? 'is-alert' : ''}`}>
                                        +₱{phpAmt.toLocaleString('en-US')}
                                      </div>
                                      {isShortage && d.declaredPhp ? (
                                        <div className="rcp-amt-variance">
                                          <span className="rcp-struck">₱{Number(d.declaredPhp).toLocaleString('en-US')}</span>
                                          <span className="rcp-var-diff">-₱{Math.abs(d.variancePhp || 0).toLocaleString()}</span>
                                        </div>
                                      ) : (
                                        <div className="rcp-amt-sub">Sepolia Verified</div>
                                      )}
                                    </div>

                                    <div className="rcp-row-actions">
                                      {isDisbursed && (
                                        <button
                                          type="button"
                                          className="rcp-btn-subtle is-emerald"
                                          onClick={() => setSelectedProofCamp(matchCamp)}
                                          title="Inspect audited ground distribution receipts and proof"
                                        >
                                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>verified</span>
                                          <span>Proof</span>
                                        </button>
                                      )}

                                      <button
                                        type="button"
                                        className="rcp-btn-subtle"
                                        onClick={() => setSelectedCampaignForProof(matchCamp)}
                                        title="View Campaign Details & Map"
                                      >
                                        <span>Details</span>
                                      </button>

                                      <button
                                        type="button"
                                        className={`rcp-btn-primary ${isShortage ? 'is-alert' : ''}`}
                                        onClick={() => setSelectedVoucherTx(d)}
                                        title="Open Official Donation Receipt"
                                      >
                                        <span>{isShortage ? 'Audit' : 'Receipt'}</span>
                                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>arrow_forward</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                {isShortage && (
                                  <div className="rcp-shortage-bar">
                                    <div className="rcp-shortage-left">
                                      <span className="material-symbols-outlined" style={{ fontSize: '16px', flexShrink: 0 }}>gavel</span>
                                      <span>
                                        <strong>Audit Discrepancy Notarized:</strong> Declared ₱{Number(d.declaredPhp || 0).toLocaleString()}, NGO credited ₱{Number(d.creditedPhp || 0).toLocaleString()} (<strong>-₱{Math.abs(d.variancePhp || 0).toLocaleString()} PHP</strong>).
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      className="rcp-dispute-btn"
                                      onClick={() => showSuccess(`Dispute filed for TX ${d.txHash?.slice(0, 10)}... Admin audit investigation initiated against ${orgName}.`, 'Audit Dispute Filed')}
                                    >
                                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>flag</span>
                                      <span>File Dispute</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Built-in Vercel Geist Pagination Footer (10 per page) */}
                        <div className="rcp-pagination-bar">
                          <span className="rcp-page-summary">
                            Showing <strong>{startIdx + 1}–{endIdx}</strong> of <strong>{totalFiltered}</strong> notarized receipts
                          </span>

                          {totalReceiptPages > 1 && (
                            <div className="rcp-page-controls" role="navigation" aria-label="Receipts pagination">
                              <button
                                type="button"
                                className="rcp-page-btn"
                                disabled={safeReceiptsPage <= 1}
                                onClick={() => goToReceiptPage(safeReceiptsPage - 1)}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>chevron_left</span>
                                <span>Prev</span>
                              </button>

                              <div className="rcp-page-nums">
                                {getPaginationItems(safeReceiptsPage, totalReceiptPages).map((item, pIdx) =>
                                  item === '...' ? (
                                    <span key={`ell-${pIdx}`} className="rcp-page-ellipsis">…</span>
                                  ) : (
                                    <button
                                      key={item}
                                      type="button"
                                      className={`rcp-page-num ${item === safeReceiptsPage ? 'active' : ''}`}
                                      onClick={() => goToReceiptPage(item)}
                                    >
                                      {item}
                                    </button>
                                  )
                                )}
                              </div>

                              <button
                                type="button"
                                className="rcp-page-btn"
                                disabled={safeReceiptsPage >= totalReceiptPages}
                                onClick={() => goToReceiptPage(safeReceiptsPage + 1)}
                              >
                                <span>Next</span>
                                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>chevron_right</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
            );
          })()}

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
            const targetPhp = (camp.targetAmountPhp || camp.target_amount_php || Math.round(parseFloat(camp.targetAmount || 0) * 170000)).toLocaleString('en-US', { maximumFractionDigits: 0 });
            const currentPhp = (effectiveCurrent * 170000).toLocaleString('en-US', { maximumFractionDigits: 0 });
            const pct = progressPct(effectiveCurrent, camp.targetAmount);

            let modalDisasterPhotos = camp.disasterImages;
            if (!modalDisasterPhotos && (camp.disaster_images_json || camp.disasterImagesJson)) {
              try {
                const parsed = typeof (camp.disaster_images_json || camp.disasterImagesJson) === 'string'
                  ? JSON.parse(camp.disaster_images_json || camp.disasterImagesJson)
                  : (camp.disaster_images_json || camp.disasterImagesJson);
                if (Array.isArray(parsed) && parsed.length > 0) modalDisasterPhotos = parsed;
              } catch (_) {}
            }
            if (!Array.isArray(modalDisasterPhotos) || modalDisasterPhotos.length === 0) {
              modalDisasterPhotos = getCategoryEvidencePhotos(`${camp.title || camp.Campaign_Title || ''} ${camp.description || ''}`);
            }
            const allModalPhotos = Array.from(new Set([coverData?.imageUrl, ...modalDisasterPhotos].filter(Boolean)));

            return createPortal(
              <div
                className="bbdrts-details-backdrop"
                onClick={() => setSelectedCampaignForProof(null)}
              >
                <div
                  className="bbdrts-details-modal"
                  onClick={(e) => e.stopPropagation()}
                >

                  {/* ── Slim Top Utility Bar ── */}
                  <div className="cdm-topbar">
                    <div className="cdm-topbar-meta">
                      <span className="cdm-id">#{catInfo.prefix}-00{camp.id}</span>
                      <span className="cdm-sep">·</span>
                      <span className="cdm-cat">{catInfo.label}</span>
                      {audit.urgency && (
                        <span className={`cdm-status-chip ${/HIGH|EMERGENCY|CRITICAL|MEDIUM|URGENT/i.test(audit.urgency) ? 'is-urgent' : ''}`}>
                          <span className="cdm-dot" />
                          <span>
                            {/HIGH|EMERGENCY|CRITICAL/i.test(audit.urgency)
                              ? 'Emergency'
                              : /MEDIUM|URGENT/i.test(audit.urgency)
                                ? 'Urgent'
                                : 'Standard'}
                          </span>
                        </span>
                      )}
                      <span className="cdm-status-chip is-active">
                        <span className="cdm-dot" />
                        <span>Active</span>
                      </span>
                    </div>

                    <button
                      type="button"
                      className="cdm-close-btn"
                      onClick={() => setSelectedCampaignForProof(null)}
                      title="Close"
                      aria-label="Close Campaign Details"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                    </button>
                  </div>

                  {/* ── 2-Pane Editorial + Sticky Funding/Map Split ── */}
                  <div className="cdm-split-scroll">
                    <div className="cdm-split">
                      {/* LEFT: Open Editorial Narrative, Cover Photo, Evidence & Allocations */}
                      <div className="cdm-main">
                        <div className="cdm-cover">
                          <img
                            src={coverData.imageUrl}
                            alt={camp.title}
                            className="cdm-cover-img"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=600&q=80';
                            }}
                          />
                          <button
                            type="button"
                            className="cdm-cover-expand"
                            onClick={() => setActiveProofEvidenceImg(coverData.imageUrl)}
                            title="Expand photo"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>fullscreen</span>
                            <span>Expand</span>
                          </button>
                        </div>

                        <div className="cdm-headline-block">
                          <h2 className="cdm-title">{displayTitle}</h2>

                          <div className="cdm-org-row">
                            <span>Organized by</span>
                            <button
                              type="button"
                              className="cdm-org-btn"
                              onClick={() => {
                                setSelectedCampaignForProof(null);
                                if (onOpenNgoProfile) onOpenNgoProfile(camp.orgId || 3);
                              }}
                              title="View verified organization profile"
                            >
                              <span>{orgDisplayName}</span>
                              <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#10b981' }}>verified</span>
                              <span className="material-symbols-outlined" style={{ fontSize: '14px', opacity: 0.55 }}>chevron_right</span>
                            </button>
                            <span className="cdm-sep">·</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#10b981' }}>verified_user</span>
                              <span>Sepolia verified</span>
                            </span>
                          </div>

                          {campaignTags && campaignTags.length > 0 && (
                            <div className="cdm-tags">
                              {(showAllProofTags ? campaignTags : campaignTags.slice(0, 6)).map((tag, idx) => (
                                <span key={idx} className="cdm-tag">#{tag.replace(/^#/, '')}</span>
                              ))}
                              {campaignTags.length > 6 && (
                                <button
                                  type="button"
                                  className="cdm-tag-more"
                                  onClick={() => setShowAllProofTags(!showAllProofTags)}
                                >
                                  {showAllProofTags ? 'Show less' : `+${campaignTags.length - 6} more`}
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="cdm-section">
                          <div className="cdm-section-head">
                            <h3 className="cdm-section-title">About this campaign</h3>
                          </div>
                          <p className="cdm-prose">{audit.description}</p>

                          {audit.documentUrl && (
                            <a
                              href={audit.documentUrl.startsWith('http') ? audit.documentUrl : `https://${audit.documentUrl}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="cdm-doc-link"
                            >
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#10b981' }}>verified</span>
                                <span>Official Verification Document / Press Release</span>
                              </span>
                              <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--text-muted)' }}>north_east</span>
                            </a>
                          )}
                        </div>

                        {modalDisasterPhotos.length > 0 && (
                          <div className="cdm-section">
                            <div className="cdm-section-head">
                              <h3 className="cdm-section-title">Field evidence</h3>
                              <span className="cdm-section-meta">{modalDisasterPhotos.length} photo{modalDisasterPhotos.length === 1 ? '' : 's'}</span>
                            </div>
                            <div className="bbdrts-details-evidence-grid">
                              {(() => {
                                const maxGrid = 6;
                                const hasOverflow = modalDisasterPhotos.length > maxGrid;
                                const visiblePhotos = hasOverflow ? modalDisasterPhotos.slice(0, maxGrid) : modalDisasterPhotos;
                                const overflowCount = modalDisasterPhotos.length - (maxGrid - 1);

                                return visiblePhotos.map((imgUrl, pIdx) => {
                                  const isOverflow = hasOverflow && pIdx === (maxGrid - 1);
                                  return (
                                    <div
                                      key={pIdx}
                                      className={`bbdrts-evidence-thumb-container ${isOverflow ? 'is-overflow' : ''}`}
                                      onClick={() => setActiveProofEvidenceImg(imgUrl)}
                                      title={isOverflow ? `+${overflowCount} more` : `View photo ${pIdx + 1}`}
                                      style={{ position: 'relative' }}
                                    >
                                      <img src={imgUrl} alt={`Field evidence ${pIdx + 1}`} className="bbdrts-evidence-thumb" />
                                      <div className="bbdrts-evidence-thumb-overlay">
                                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>zoom_in</span>
                                      </div>
                                      {isOverflow && (
                                        <div className="beacon-thumb-overflow-overlay">
                                          <span>+{overflowCount}</span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          </div>
                        )}

                        {audit.allocations && Array.isArray(audit.allocations) && audit.allocations.length > 0 && (() => {
                          const totalAllocTarget = camp.targetAmountPhp || camp.target_amount_php || (parseFloat(camp.targetAmount || 0) * 170000);
                          return (
                            <div className="cdm-section">
                              <div className="cdm-section-head">
                                <h3 className="cdm-section-title">Fund allocation</h3>
                                <span className="cdm-section-meta">Planned disbursement</span>
                              </div>
                              <div className="cdm-alloc-list">
                                {audit.allocations.map((item, idx) => {
                                  const cleanLabel = (item.label || '').replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();
                                  const itemPhp = (totalAllocTarget * (item.pct / 100)).toLocaleString('en-US', { maximumFractionDigits: 0 });
                                  return (
                                    <div key={idx}>
                                      <div className="cdm-alloc-row">
                                        <span className="cdm-alloc-label">{cleanLabel}</span>
                                        <span className="cdm-alloc-val">
                                          <strong>₱{itemPhp}</strong> ({item.pct}%)
                                        </span>
                                      </div>
                                      <div className="cdm-alloc-track">
                                        <div className="cdm-alloc-fill" style={{ width: `${item.pct}%` }} />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="cdm-policy-note">
                                <div><strong>Surplus reserve:</strong> Funds above 100% roll into the Calamity Response Reserve Fund for emergency needs.</div>
                                <div><strong>Partial funding rule:</strong> If a drive closes early, funds prioritize immediate food, water, and medical essentials first.</div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* RIGHT: Sticky Funding Summary, CTA & Ground Map */}
                      <aside className="cdm-rail">
                        <div className="cdm-funding-block">
                          <div className="cdm-raised-row">
                            <span className="cdm-raised-amount">₱{currentPhp}</span>
                            <span className="cdm-raised-pct">{pct}% funded</span>
                          </div>
                          <div className="cdm-goal-line">
                            raised of <strong>₱{targetPhp}</strong> goal
                          </div>
                          <div className="cdm-progress-track" title={`Funded: ${pct}% of target`}>
                            <div className="cdm-progress-fill" style={{ width: `${Math.min(100, Math.max(0, parseFloat(pct) || 0))}%` }} />
                          </div>

                          <div className="cdm-facts-grid">
                            <div className="cdm-fact">
                              <span className="cdm-fact-label">Target delivery</span>
                              <span className="cdm-fact-val">{audit.targetDate || 'Active'}</span>
                            </div>
                            <div className="cdm-fact">
                              <span className="cdm-fact-label">Audit protocol</span>
                              <span className="cdm-fact-val">Sepolia EVM</span>
                            </div>
                          </div>
                        </div>

                        <div className="cdm-actions">
                          <button
                            type="button"
                            className="cdm-btn-primary"
                            onClick={() => {
                              setSelectedCampaignForProof(null);
                              setActiveTab('campaigns');
                              setSearchQuery(camp.title || '');
                            }}
                          >
                            <span>Donate to Campaign</span>
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
                          </button>
                        </div>

                        <div className="cdm-rail-section">
                          <div className="cdm-section-head">
                            <h3 className="cdm-section-title">Ground location</h3>
                            <span className="cdm-section-meta">GPS verified</span>
                          </div>

                          <div className="cdm-map-wrap">
                            <LocationMapPicker
                              address={audit.region}
                              gps={audit.gps}
                              readOnly={true}
                              allowLayerSwitch={true}
                              height="196px"
                              hideTip={true}
                              theme={theme}
                            />
                          </div>

                          <div className="cdm-address-text">{audit.region}</div>
                          {audit.gps && <div className="cdm-gps-line">{audit.gps}</div>}

                          <div className="cdm-map-links">
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(audit.gps || audit.region)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="cdm-chip-btn"
                            >
                              <span>Google Maps</span>
                              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>north_east</span>
                            </a>
                            {audit.gps && (
                              <button
                                type="button"
                                className="cdm-chip-btn"
                                onClick={() => {
                                  if (navigator.clipboard) {
                                    navigator.clipboard.writeText(audit.gps);
                                    showSuccess(`Coordinates copied: ${audit.gps}`, 'GPS Copied');
                                  }
                                }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>content_copy</span>
                                <span>Copy GPS</span>
                              </button>
                            )}
                            {camp.contractAddress && (
                              <a
                                href={`https://sepolia.etherscan.io/address/${camp.contractAddress}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="cdm-chip-btn"
                              >
                                <span>Etherscan</span>
                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>north_east</span>
                              </a>
                            )}
                          </div>
                        </div>

                        {(audit.beneficiaries || audit.contact) && (
                          <div className="cdm-rail-section">
                            <div className="cdm-detail-rows">
                              {audit.beneficiaries && (
                                <div className="cdm-detail-row">
                                  <span className="cdm-detail-key">Target impact</span>
                                  <span className="cdm-detail-val">{audit.beneficiaries}</span>
                                </div>
                              )}
                              {audit.contact && (
                                <div className="cdm-detail-row">
                                  <span className="cdm-detail-key">Response desk</span>
                                  <span className="cdm-detail-val">{audit.contact}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </aside>
                    </div>
                  </div>
                </div>

                {/* Evidence Lightbox Modal (Root Document Body Portal) */}
                {activeProofEvidenceImg && typeof document !== 'undefined' && createPortal(
                  <div
                    className="disaster-lightbox-backdrop"
                    onClick={() => setActiveProofEvidenceImg(null)}
                    role="dialog"
                    aria-modal="true"
                  >
                    <div className="disaster-lightbox-content" onClick={(e) => e.stopPropagation()}>
                      <div className="disaster-lightbox-top-bar">
                        <div className="disaster-lightbox-pill">
                          <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#10b981' }}>photo_library</span>
                          <span>Photo {(() => {
                            const idx = allModalPhotos.indexOf(activeProofEvidenceImg);
                            return (idx >= 0 ? idx + 1 : 1);
                          })()} of {allModalPhotos.length || 1}</span>
                        </div>
                        <button
                          type="button"
                          className="disaster-lightbox-close"
                          onClick={() => setActiveProofEvidenceImg(null)}
                          title="Close Preview (Esc)"
                          aria-label="Close Preview"
                        >
                          <span className="material-symbols-outlined">close</span>
                        </button>
                      </div>

                      {/* Middle Stage: Stationary Prev + Fixed Image Frame + Stationary Next */}
                      <div className="disaster-lightbox-stage">
                        {allModalPhotos.length > 1 && (
                          <button
                            type="button"
                            className="disaster-lightbox-nav-btn prev"
                            onClick={(e) => {
                              e.stopPropagation();
                              const curr = allModalPhotos.indexOf(activeProofEvidenceImg);
                              const prev = curr > 0 ? curr - 1 : allModalPhotos.length - 1;
                              setActiveProofEvidenceImg(allModalPhotos[prev]);
                            }}
                            title="Previous Photo (Left Arrow)"
                            aria-label="Previous Photo"
                          >
                            <span className="material-symbols-outlined">chevron_left</span>
                          </button>
                        )}

                        <div className="disaster-lightbox-img-frame">
                          <img
                            src={activeProofEvidenceImg}
                            alt="Disaster Aftermath Evidence"
                            className="disaster-lightbox-img"
                          />
                        </div>

                        {allModalPhotos.length > 1 && (
                          <button
                            type="button"
                            className="disaster-lightbox-nav-btn next"
                            onClick={(e) => {
                              e.stopPropagation();
                              const curr = allModalPhotos.indexOf(activeProofEvidenceImg);
                              const next = curr < allModalPhotos.length - 1 ? curr + 1 : 0;
                              setActiveProofEvidenceImg(allModalPhotos[next]);
                            }}
                            title="Next Photo (Right Arrow)"
                            aria-label="Next Photo"
                          >
                            <span className="material-symbols-outlined">chevron_right</span>
                          </button>
                        )}
                      </div>

                      <div className="disaster-lightbox-caption">
                        <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#10b981' }}>verified</span>
                        <span>Disaster Impact & Aftermath Evidence • Ground Photographic Verification</span>
                      </div>

                      {allModalPhotos.length > 1 && (
                        <div className="disaster-lightbox-thumbs-strip" onClick={(e) => e.stopPropagation()}>
                          {allModalPhotos.map((thumbUrl, tIdx) => (
                            <button
                              key={tIdx}
                              type="button"
                              className={`disaster-lightbox-strip-thumb ${thumbUrl === activeProofEvidenceImg ? 'is-active' : ''}`}
                              onClick={() => setActiveProofEvidenceImg(thumbUrl)}
                              title={`Switch to photo ${tIdx + 1}`}
                            >
                              <img src={thumbUrl} alt={`Thumbnail ${tIdx + 1}`} />
                              <span className="disaster-lightbox-thumb-num">{tIdx + 1}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>,
                  document.body
                )}
              </div>,
              document.body
            );
          })()}

          {/* ── 3.5. DISASTER RELIEF RADAR HEATMAP TAB (Vercel Geist Institutional Standard) ── */}
          {activeTab === 'radar-heatmap' && (
            <div key="tab-radar" className="rr-page donor-tab-transition">
              <div className="admin-page-header" id="tour-radar-header">
                <div className="admin-page-title-wrap">
                  <h2 className="admin-page-title">
                    <span className="material-symbols-outlined icon" style={{ color: 'var(--text-primary)' }}>radar</span>
                    <span>{wt.reliefRadar}</span>
                  </h2>
                  <p className="admin-page-sub">
                    {wt.radarSub}
                  </p>
                </div>

                <div className="admin-page-header-actions">
                  <button
                    type="button"
                    className="dbo-cmd-btn"
                    onClick={fetchCampaigns}
                    disabled={fetchingCampaigns}
                    title="Refresh live geospatial telemetry from ledger"
                  >
                    <span className={`material-symbols-outlined ${fetchingCampaigns ? 'spinning' : ''}`} style={{ fontSize: '15px' }}>
                      sync
                    </span>
                    <span>{fetchingCampaigns ? 'Syncing...' : 'Sync Telemetry'}</span>
                  </button>
                </div>
              </div>

              <DisasterRadarHeatmap
                campaigns={campaigns}
                height="640px"
                theme={theme}
                defaultLayer="terrain"
                lowBandwidthMode={lowBandwidthMode}
                reducedMotion={reducedMotion}
                language={language}
                onSelectCampaign={(c) => {
                  setActiveTab('campaigns');
                  setSearchQuery(c.title || '');
                }}
              />
            </div>
          )}

          {/* ── 4. SETTINGS TAB (Hides 4 boxes & welcome card) ── */}
          {activeTab === 'settings' && (
            <div key="tab-settings" className="donor-tab-transition">
              <SettingsPanel
                pageTitle={wt.profileSettings} 
                contract={contract}
                currentUser={currentUser} 
                walletAddress={walletAddress} 
                handleConnectWallet={handleConnectWallet} 
                handleLogout={handleLogout} 
                updateDbWallet={updateDbWallet}
                theme={theme}
                themeMode={themeMode}
                setTheme={setTheme}
                textSize={textSize}
                setTextSize={setTextSize}
                interfaceMode={interfaceMode}
                setInterfaceMode={setInterfaceMode}
                language={language}
                setLanguage={setLanguage}
                reducedMotion={reducedMotion}
                setReducedMotion={setReducedMotion}
                highContrast={highContrast}
                setHighContrast={setHighContrast}
                lowBandwidthMode={lowBandwidthMode}
                setLowBandwidthMode={setLowBandwidthMode}
                totalDonatedEth={totalDonated}
                totalDonatedPhp={totalDonatedPhp}
                onStartTour={handleStartTour}
              />
            </div>
          )}

        </section>

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
      {/* ── Official Donation Receipt Modal (Clean Geist Digital Receipt) ── */}
      {selectedVoucherTx && createPortal((() => {
        const d = selectedVoucherTx;
        const matchCamp = campaigns.find(c => String(c.id) === String(d.campaignId)) || { id: d.campaignId, title: d.campaignTitle || `Relief Campaign #${d.campaignId}` };
        const rawTitle = matchCamp ? matchCamp.title : `Relief Campaign #${d.campaignId}`;
        const campTitle = formatCampaignTitle(rawTitle, d.campaignId);
        const orgName = d.orgName || getOrgDisplayName(matchCamp.orgAddress, matchCamp.orgName, d.campaignId);
        const amtEth = parseFloat(d.amount || 0);
        const fallbackPhp = Math.round(amtEth * 170000);
        const rawDeclaredPhp = Number(d.declaredPhp || fallbackPhp);
        const rawCreditedPhp = Number(d.creditedPhp || fallbackPhp);
        const rawVariancePhp = Number(d.variancePhp !== undefined ? d.variancePhp : (rawCreditedPhp - rawDeclaredPhp));
        const isShortage = d.auditStatus === 'SHORTAGE' || rawVariancePhp < -20;
        const isRoundingDrift = !isShortage && Math.abs(rawCreditedPhp - rawDeclaredPhp) <= 20;
        const canonicalPhp = Number(d.phpAmount || d.amountPhp || rawDeclaredPhp || rawCreditedPhp || fallbackPhp);
        const declaredPhp = isRoundingDrift ? canonicalPhp : rawDeclaredPhp;
        const creditedPhp = isRoundingDrift ? canonicalPhp : rawCreditedPhp;
        const variancePhp = isRoundingDrift ? 0 : rawVariancePhp;
        const donorDisplay = d.isAnonymous ? 'Anonymous Donor' : (userDisplayName || currentUser?.name || 'Verified Donor');
        const issuedDateStr = d.createdAt
          ? new Date(d.createdAt).toLocaleString('en-PH', {
              timeZone: 'Asia/Manila',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            }) + ' PHT'
          : 'Verified On-Chain';
        const isValidTxHash = Boolean(d.txHash && String(d.txHash).startsWith('0x'));

        return (
          <div
            className="rcp-modal-backdrop"
            onClick={() => setSelectedVoucherTx(null)}
            role="dialog"
            aria-modal="true"
            aria-label="Official Donation Receipt"
          >
            <div
              className={`rcp-modal-card fade-in ${isShortage ? 'is-shortage' : ''}`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top Header */}
              <div className="rcp-modal-head">
                <div className="rcp-modal-head-left">
                  <div className={`rcp-modal-icon ${isShortage ? 'is-alert' : ''}`}>
                    <span className="material-symbols-outlined">
                      {isShortage ? 'report_problem' : 'receipt_long'}
                    </span>
                  </div>
                  <div>
                    <h3 className="rcp-modal-title">Official Donation Receipt</h3>
                    <div className="rcp-modal-sub">BBDRTS · Ethereum Sepolia Verified</div>
                  </div>
                </div>

                <div className="rcp-modal-head-right">
                  <span className="rcp-modal-ref">#{d.id || 'SEPOLIA'}</span>
                  <button
                    type="button"
                    className="rcp-modal-close"
                    onClick={() => setSelectedVoucherTx(null)}
                    aria-label="Close receipt"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
              </div>

              {/* Amount Hero Centerpiece */}
              <div className="rcp-modal-hero">
                <div className={`rcp-modal-status-pill ${isShortage ? 'is-alert' : 'is-ok'}`}>
                  <span className="rcp-modal-status-dot" />
                  <span>{isShortage ? 'Discrepancy Flagged On-Chain' : 'Verified & Notarized'}</span>
                </div>
                <div className={`rcp-modal-amount ${isShortage ? 'is-alert' : ''}`}>
                  ₱{creditedPhp.toLocaleString('en-US')}
                  <span className="rcp-modal-currency">PHP</span>
                </div>
                <div className="rcp-modal-meta-line">
                  <span>{d.paymentMethod || 'GCash'}</span>
                  <span>·</span>
                  <span>{issuedDateStr}</span>
                </div>
              </div>

              <div className="rcp-modal-divider" />

              {/* Body */}
              <div className="rcp-modal-body">
                {isShortage && (
                  <div className="rcp-modal-alert-box">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', flexShrink: 0 }}>gavel</span>
                    <div>
                      <strong>Shortage of ₱{Math.abs(variancePhp).toLocaleString('en-US')} recorded on-chain</strong>
                      <p>
                        Your slip confirms <strong>₱{declaredPhp.toLocaleString('en-US')}</strong> sent, while <strong>₱{creditedPhp.toLocaleString('en-US')}</strong> was credited. This variance is permanently sealed on Sepolia.
                      </p>
                    </div>
                  </div>
                )}

                {/* Clean Receipt Line Items */}
                <div className="rcp-modal-rows">
                  <div className="rcp-modal-row">
                    <span className="rcp-modal-row-lbl">Campaign</span>
                    <span className="rcp-modal-row-val">{campTitle}</span>
                  </div>
                  <div className="rcp-modal-row">
                    <span className="rcp-modal-row-lbl">Managing NGO</span>
                    <span className="rcp-modal-row-val">{orgName}</span>
                  </div>
                  <div className="rcp-modal-row">
                    <span className="rcp-modal-row-lbl">Donor</span>
                    <span className="rcp-modal-row-val">{donorDisplay}</span>
                  </div>
                  <div className="rcp-modal-row">
                    <span className="rcp-modal-row-lbl">Payment Channel</span>
                    <span className="rcp-modal-row-val">
                      {d.paymentMethod || 'GCash'}{d.referenceNumber ? ` · Ref ${d.referenceNumber}` : ''}
                    </span>
                  </div>
                  <div className="rcp-modal-row">
                    <span className="rcp-modal-row-lbl">Amount Sent</span>
                    <span className="rcp-modal-row-val rcp-mono">₱{declaredPhp.toLocaleString('en-US')}</span>
                  </div>
                  <div className="rcp-modal-row">
                    <span className="rcp-modal-row-lbl">Amount Credited</span>
                    <span className={`rcp-modal-row-val rcp-mono ${isShortage ? 'is-alert' : 'is-ok'}`}>
                      ₱{creditedPhp.toLocaleString('en-US')}
                      {!isShortage && ' · Exact Match'}
                    </span>
                  </div>
                  <div className="rcp-modal-row">
                    <span className="rcp-modal-row-lbl">Platform Commission</span>
                    <span className="rcp-modal-row-val rcp-mono is-ok">₱0.00 (0%)</span>
                  </div>
                </div>

                {/* Optional Uploaded Slip Preview */}
                {d.receiptBase64 && (
                  <div className="rcp-modal-slip">
                    <div className="rcp-modal-slip-head">
                      <span>
                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>image</span>
                        <span>Uploaded Payment Slip</span>
                      </span>
                      <button
                        type="button"
                        className="rcp-modal-link-btn"
                        onClick={() => setShowReceiptZoom(!showReceiptZoom)}
                      >
                        {showReceiptZoom ? 'Hide Slip' : 'View Slip'}
                      </button>
                    </div>
                    {showReceiptZoom && (
                      <div className="rcp-modal-slip-img-wrap">
                        <img src={d.receiptBase64} alt="Official Payment Slip" />
                      </div>
                    )}
                  </div>
                )}

                {/* Blockchain Proof Hash */}
                {d.txHash && (
                  <div className="rcp-modal-hash-block">
                    <div className="rcp-modal-hash-lbl">Ethereum Sepolia Proof Hash</div>
                    <div className="rcp-modal-hash-box">
                      <span>{d.txHash}</span>
                      <button
                        type="button"
                        className="rcp-modal-copy-btn"
                        onClick={() => {
                          navigator.clipboard.writeText(d.txHash);
                          showSuccess('Transaction hash copied!', 'Copied');
                        }}
                        title="Copy transaction hash"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>content_copy</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="rcp-modal-foot">
                <div className="rcp-modal-foot-left">
                  {isShortage && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                      onClick={() => showSuccess(`Dispute logged against ${orgName}. Ticket #AUDIT-${Date.now().toString().slice(-6)} created.`, 'Dispute Filed')}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>gavel</span>
                      <span>File Dispute</span>
                    </button>
                  )}
                </div>

                <div className="rcp-modal-foot-right">
                  <button
                    type="button"
                    className="rcp-modal-btn"
                    onClick={() => printDonationVoucher({
                      ...d,
                      phpAmount: creditedPhp,
                      campaignTitle: campTitle,
                      orgName,
                      donorName: donorDisplay,
                      isShortage
                    })}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>print</span>
                    <span>Print / PDF</span>
                  </button>

                  {isValidTxHash && (
                    <a
                      href={`https://sepolia.etherscan.io/tx/${d.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rcp-modal-btn"
                    >
                      <span>Etherscan</span>
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>open_in_new</span>
                    </a>
                  )}

                  <button
                    type="button"
                    className="rcp-modal-btn is-primary"
                    onClick={() => setSelectedVoucherTx(null)}
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })(), document.body)}

      {/* ── Verified Aid Distribution Proof & Receipts Modal ── */}
      <DisbursementProofModal
        camp={selectedProofCamp}
        isOpen={Boolean(selectedProofCamp)}
        onClose={() => setSelectedProofCamp(null)}
      />

      {/* ── Filterable Donor Contribution Export Modal ── */}
      <FilterableExportModal
        isOpen={donorExportOpen}
        onClose={() => setDonorExportOpen(false)}
        role="donor"
        title="Export Contribution Statement"
        subtitle="Filter your verified donations by date, payment channel, cause, or campaign"
        records={myDonations || []}
        campaigns={campaigns || []}
        meta={{
          donorName: userDisplayName || currentUser?.name || 'Verified Donor',
          donorEmail: currentUser?.email || ''
        }}
        initialFilters={{
          category: receiptFilter || 'ALL',
          channel: receiptRailFilter === 'CARD' ? 'BANK_CARD' : (receiptRailFilter || 'ALL'),
          search: searchQueryReceipts || ''
        }}
        onExported={(msg, title) => showSuccess(msg, title)}
      />
    </div>
  );
}
