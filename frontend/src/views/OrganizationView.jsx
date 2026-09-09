import { useState, useEffect, useRef, useMemo } from 'react';
import { ethers } from 'ethers';
import { isLocalhost, API_URL } from '../config';
import CampaignCard, { shortAddr, formatCampaignTitle, getOrgDisplayName, getCampaignTags, getCampaignAuditDetails } from '../components/CampaignCard';
import LocationMapPicker from '../components/LocationMapPicker';
import { ROLES } from '../roleConfig';
import SettingsPanel from '../components/SettingsPanel';
import DisasterRadarHeatmap from '../components/DisasterRadarHeatmap';
import SecCertificateModal, { normalizeSecDocUrl, isPdfDocument } from '../components/SecCertificateModal';
import GuidedTour from '../components/GuidedTour';
import { useToast } from '../context/ToastContext';
import { getRegions, getRegionForProvince } from '../data/philippineGeoData';
import './ReferenceDashboard.css';

export default function OrganizationView({
  contract,
  walletAddress,
  campaigns,
  fetchCampaigns,
  fetchingCampaigns,
  currentUser,
  handleConnectWallet,
  handleLogout,
  updateDbWallet,
  theme,
  setTheme,
  textSize,
  setTextSize
}) {
  const { showSuccess, showWarning, showError } = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');

  // Filter & Sort States for "All Campaigns" (Unified Toolbar matching DonorView)
  const [categoryFilterAll, setCategoryFilterAll] = useState('ALL');
  const [urgencyFilterAll, setUrgencyFilterAll] = useState('ALL');
  const [selectedTagsAll, setSelectedTagsAll] = useState([]);
  const [campaignSortAll, setCampaignSortAll] = useState('NEWEST');
  const [searchQueryAll, setSearchQueryAll] = useState('');
  const [currentPageAll, setCurrentPageAll] = useState(1);

  const [showCausesDropdownAll, setShowCausesDropdownAll] = useState(false);
  const [showPrioritiesDropdownAll, setShowPrioritiesDropdownAll] = useState(false);
  const [showTagsDropdownAll, setShowTagsDropdownAll] = useState(false);
  const [showSortDropdownAll, setShowSortDropdownAll] = useState(false);

  const causesDropdownRefAll = useRef(null);
  const prioritiesDropdownRefAll = useRef(null);
  const tagsDropdownRefAll = useRef(null);
  const sortDropdownRefAll = useRef(null);
  const searchInputRefAll = useRef(null);

  // Filter & Sort States for "My Campaigns"
  const [categoryFilterMy, setCategoryFilterMy] = useState('ALL');
  const [urgencyFilterMy, setUrgencyFilterMy] = useState('ALL');
  const [selectedTagsMy, setSelectedTagsMy] = useState([]);
  const [campaignSortMy, setCampaignSortMy] = useState('NEWEST');
  const [searchQueryMy, setSearchQueryMy] = useState('');
  const [currentPageMy, setCurrentPageMy] = useState(1);

  const [showCausesDropdownMy, setShowCausesDropdownMy] = useState(false);
  const [showPrioritiesDropdownMy, setShowPrioritiesDropdownMy] = useState(false);
  const [showTagsDropdownMy, setShowTagsDropdownMy] = useState(false);
  const [showSortDropdownMy, setShowSortDropdownMy] = useState(false);

  const causesDropdownRefMy = useRef(null);
  const prioritiesDropdownRefMy = useRef(null);
  const tagsDropdownRefMy = useRef(null);
  const sortDropdownRefMy = useRef(null);
  const searchInputRefMy = useRef(null);

  // Filter & Sort States for "Ledger"
  const [ledgerFilter, setLedgerFilter] = useState('ALL');
  const [ledgerSort, setLedgerSort] = useState('NEWEST');
  const [searchQueryLedger, setSearchQueryLedger] = useState('');
  const [currentPageLedger, setCurrentPageLedger] = useState(1);

  // View Layout Mode for Campaigns: 'list' or 'grid' (2-column option removed per user request)
  const [viewModeOrg, setViewModeOrg] = useState(() => {
    try {
      const saved = localStorage.getItem('bbdrts_campaign_view_mode');
      if (saved === 'grid' || saved === 'grid-3' || saved === 'grid-2') return 'grid';
      return 'list';
    } catch {
      return 'list';
    }
  });

  const handleViewModeChangeOrg = (mode) => {
    const target = mode === 'grid' ? 'grid' : 'list';
    setViewModeOrg(target);
    try {
      localStorage.setItem('bbdrts_campaign_view_mode', target);
    } catch { }
  };

  const campaignsPerPage = viewModeOrg === 'list' ? 4 : 6;

  // Global Header Navigation Listener
  useEffect(() => {
    const handleRadarNav = () => {
      setActiveTab('radar-heatmap');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const handleCampaignsNav = () => {
      setActiveTab('all-campaigns');
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

  // Create campaign form state
  const PRESET_CAMPAIGN_TAGS = [
    'Flood Relief',
    'Emergency Food',
    'Medical Aid',
    'Shelter Recovery',
    'Water Sanitation',
    'Urgent Response',
    'Children Support',
    'Elderly Care',
    'Disaster Recovery',
    'Community Rebuilding',
    'Blood Donation',
    'First Aid Kits',
    'Livelihood Assistance',
    'Evacuation Support'
  ];



  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [category, setCategory] = useState('DR');
  const [selectedTags, setSelectedTags] = useState(['Flood Relief', 'Emergency Food']);
  const [locationRegion, setLocationRegion] = useState('');
  const [street, setStreet] = useState('');
  const [barangay, setBarangay] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [region, setRegion] = useState('');
  const [country, setCountry] = useState('Philippines');
  const [zipCode, setZipCode] = useState('');
  const [landmark, setLandmark] = useState('');
  const [gpsCoordinates, setGpsCoordinates] = useState('');
  const [mapSearchTrigger, setMapSearchTrigger] = useState(0);
  const [isFindingLocation, setIsFindingLocation] = useState(false);
  const [beneficiariesImpact, setBeneficiariesImpact] = useState('');
  const [urgency, setUrgency] = useState('HIGH (EMERGENCY AID)');
  const [targetDate, setTargetDate] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');
  const [contactInfo, setContactInfo] = useState('');

  // Multi-Channel Payment Settings State
  const [activePaymentChannelTab, setActivePaymentChannelTab] = useState('gcash');
  const [gcashName, setGcashName] = useState('');
  const [gcashNumber, setGcashNumber] = useState('');
  const [gcashQrUrl, setGcashQrUrl] = useState('');
  const [mayaName, setMayaName] = useState('');
  const [mayaNumber, setMayaNumber] = useState('');
  const [mayaQrUrl, setMayaQrUrl] = useState('');
  const [bankName, setBankName] = useState('BDO Unibank');
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankQrUrl, setBankQrUrl] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [bypassMetaMaskLocal, setBypassMetaMaskLocal] = useState(true);
  const [txModal, setTxModal] = useState({ show: false, step: 0, hash: '', type: '', error: '', isLocal: false });

  const handleGcashQrUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showWarning('Please upload a valid image file (PNG, JPG, WebP).', 'Invalid File');
      return;
    }
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setGcashQrUrl(uploadEvent.target.result);
      showSuccess('GCash QR Code uploaded successfully!', 'QR Code Attached');
    };
    reader.readAsDataURL(file);
  };

  const handleMayaQrUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showWarning('Please upload a valid image file (PNG, JPG, WebP).', 'Invalid File');
      return;
    }
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setMayaQrUrl(uploadEvent.target.result);
      showSuccess('Maya QR Code uploaded successfully!', 'QR Code Attached');
    };
    reader.readAsDataURL(file);
  };

  const handleBankQrUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showWarning('Please upload a valid image file (PNG, JPG, WebP).', 'Invalid File');
      return;
    }
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setBankQrUrl(uploadEvent.target.result);
      showSuccess('Bank Transfer QR Code uploaded successfully!', 'QR Code Attached');
    };
    reader.readAsDataURL(file);
  };

  // Helper: Extract profile relief channel details from currentUser / preferences
  const getProfileReliefChannels = () => {
    if (!currentUser) return { hasAny: false };
    let prefs = {};
    if (currentUser.preferences) {
      try {
        prefs = typeof currentUser.preferences === 'string' ? JSON.parse(currentUser.preferences) : currentUser.preferences;
      } catch (_) { }
    }

    const gNum = (currentUser.gcash_number || prefs.gcash_number || '').trim();
    const gName = (currentUser.gcash_name || prefs.gcash_name || '').trim();
    const gQr = currentUser.gcash_qr_url || prefs.gcash_qr_url || '';

    const mNum = (currentUser.maya_number || prefs.maya_number || '').trim();
    const mName = (currentUser.maya_name || prefs.maya_name || '').trim();
    const mQr = currentUser.maya_qr_url || prefs.maya_qr_url || '';

    let bName = (currentUser.bank_name || prefs.bank_name || '').trim();
    let bAcctName = (currentUser.bank_account_name || prefs.bank_account_name || '').trim();
    let bAcctNum = (currentUser.bank_account_number || prefs.bank_account_number || '').trim();
    const bQr = currentUser.bank_qr_url || prefs.bank_qr_url || '';
    const bDetails = (currentUser.bank_details || prefs.bank_details || '').trim();

    if (!bName && !bAcctNum && bDetails) {
      const parts = bDetails.split('•').map(s => s.trim());
      if (parts.length >= 2) {
        bName = parts[0] || '';
        const acctPart = parts.find(p => p.toLowerCase().includes('acct')) || parts[parts.length - 1];
        bAcctNum = acctPart.replace(/acct:?/i, '').trim();
        if (parts.length >= 3) {
          bAcctName = parts[1] || '';
        }
      } else {
        bName = bDetails;
      }
    }

    const hasAny = Boolean(gNum || gQr || gName || mNum || mQr || mName || bAcctNum || bQr);

    return {
      hasAny,
      gcashNumber: gNum,
      gcashName: gName,
      gcashQrUrl: gQr,
      mayaNumber: mNum,
      mayaName: mName,
      mayaQrUrl: mQr,
      bankName: bName || 'BDO Unibank',
      bankAccountName: bAcctName || (currentUser.name || ''),
      bankAccountNumber: bAcctNum,
      bankQrUrl: bQr
    };
  };

  // Auto-fill from Organization Profile (Strictly enforced: only applies if already in profile edit)
  const handleAutofillFromProfile = () => {
    const profile = getProfileReliefChannels();

    if (!profile || !profile.hasAny) {
      showWarning(
        'No relief channels configured in your profile yet. Please configure your GCash, Maya, or Bank details in Profile & Settings > Relief Channels first.',
        'No Profile Details Found'
      );
      return;
    }

    const filled = [];

    if (profile.gcashNumber || profile.gcashQrUrl || profile.gcashName) {
      if (profile.gcashNumber) setGcashNumber(profile.gcashNumber);
      if (profile.gcashName) setGcashName(profile.gcashName);
      if (profile.gcashQrUrl) setGcashQrUrl(profile.gcashQrUrl);
      filled.push('GCash');
    }

    if (profile.mayaNumber || profile.mayaQrUrl || profile.mayaName) {
      if (profile.mayaNumber) setMayaNumber(profile.mayaNumber);
      if (profile.mayaName) setMayaName(profile.mayaName);
      if (profile.mayaQrUrl) setMayaQrUrl(profile.mayaQrUrl);
      filled.push('Maya');
    }

    if (profile.bankAccountNumber || profile.bankQrUrl || profile.bankAccountName) {
      if (profile.bankName) setBankName(profile.bankName);
      if (profile.bankAccountName) setBankAccountName(profile.bankAccountName);
      if (profile.bankAccountNumber) setBankAccountNumber(profile.bankAccountNumber);
      if (profile.bankQrUrl) setBankQrUrl(profile.bankQrUrl);
      filled.push('Bank');
    }

    showSuccess(
      `Payment details & QR codes successfully auto-filled from your profile (${filled.join(', ')}).`,
      'Profile Channels Synced'
    );
  };



  // Organization Ledger / Donations State
  const [orgDonations, setOrgDonations] = useState(null);
  const [loadingOrgDonations, setLoadingOrgDonations] = useState(false);

  const [pendingDonations, setPendingDonations] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);

  const myCampaigns = campaigns.filter(
    (c) => c.orgAddress?.toLowerCase() === walletAddress?.toLowerCase()
  );

  const totalRaisedByMe = myCampaigns
    .reduce((s, c) => s + parseFloat(c.currentAmount || 0), 0);

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

  const selectedCauseObjAll = CAUSE_OPTIONS.find(o => o.value === categoryFilterAll) || CAUSE_OPTIONS[0];
  const selectedPriorityObjAll = PRIORITY_OPTIONS.find(o => o.value === urgencyFilterAll) || PRIORITY_OPTIONS[0];
  const selectedSortObjAll = SORT_OPTIONS.find(o => o.value === campaignSortAll) || SORT_OPTIONS[0];

  const selectedCauseObjMy = CAUSE_OPTIONS.find(o => o.value === categoryFilterMy) || CAUSE_OPTIONS[0];
  const selectedPriorityObjMy = PRIORITY_OPTIONS.find(o => o.value === urgencyFilterMy) || PRIORITY_OPTIONS[0];
  const selectedSortObjMy = SORT_OPTIONS.find(o => o.value === campaignSortMy) || SORT_OPTIONS[0];

  // Available tags & counts for All Campaigns
  const { availableTagsAll, tagCountsAll } = useMemo(() => {
    const counts = {};
    (campaigns || []).forEach((camp) => {
      const tags = getCampaignTags(camp);
      tags.forEach((t) => {
        const clean = t.replace(/^#/, '').trim();
        if (clean) counts[clean] = (counts[clean] || 0) + 1;
      });
    });
    const unique = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    return { availableTagsAll: unique, tagCountsAll: counts };
  }, [campaigns]);

  // Available tags & counts for My Campaigns
  const { availableTagsMy, tagCountsMy } = useMemo(() => {
    const counts = {};
    (myCampaigns || []).forEach((camp) => {
      const tags = getCampaignTags(camp);
      tags.forEach((t) => {
        const clean = t.replace(/^#/, '').trim();
        if (clean) counts[clean] = (counts[clean] || 0) + 1;
      });
    });
    const unique = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    return { availableTagsMy: unique, tagCountsMy: counts };
  }, [myCampaigns]);

  const hasActiveFiltersAll = categoryFilterAll !== 'ALL' || urgencyFilterAll !== 'ALL' || selectedTagsAll.length > 0 || Boolean(searchQueryAll.trim());
  const hasActiveFiltersMy = categoryFilterMy !== 'ALL' || urgencyFilterMy !== 'ALL' || selectedTagsMy.length > 0 || Boolean(searchQueryMy.trim());

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (causesDropdownRefAll.current && !causesDropdownRefAll.current.contains(e.target)) setShowCausesDropdownAll(false);
      if (prioritiesDropdownRefAll.current && !prioritiesDropdownRefAll.current.contains(e.target)) setShowPrioritiesDropdownAll(false);
      if (tagsDropdownRefAll.current && !tagsDropdownRefAll.current.contains(e.target)) setShowTagsDropdownAll(false);
      if (sortDropdownRefAll.current && !sortDropdownRefAll.current.contains(e.target)) setShowSortDropdownAll(false);

      if (causesDropdownRefMy.current && !causesDropdownRefMy.current.contains(e.target)) setShowCausesDropdownMy(false);
      if (prioritiesDropdownRefMy.current && !prioritiesDropdownRefMy.current.contains(e.target)) setShowPrioritiesDropdownMy(false);
      if (tagsDropdownRefMy.current && !tagsDropdownRefMy.current.contains(e.target)) setShowTagsDropdownMy(false);
      if (sortDropdownRefMy.current && !sortDropdownRefMy.current.contains(e.target)) setShowSortDropdownMy(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut: Cmd+K / Ctrl+K to focus search input
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (activeTab === 'all-campaigns' && searchInputRefAll.current) {
          searchInputRefAll.current.focus();
        } else if (activeTab === 'my-campaigns' && searchInputRefMy.current) {
          searchInputRefMy.current.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPageAll(1);
  }, [categoryFilterAll, urgencyFilterAll, selectedTagsAll, campaignSortAll, searchQueryAll]);

  useEffect(() => {
    setCurrentPageMy(1);
  }, [categoryFilterMy, urgencyFilterMy, selectedTagsMy, campaignSortMy, searchQueryMy]);

  const handleGranularAddressFromMap = ({ street: s, barangay: b, city: c, province: p, region: r, country: cnt, zip: z, landmark: l }) => {
    if (s) setStreet(s);
    if (b) setBarangay(b);
    if (c) setCity(c);
    if (p) {
      setProvince(p);
      if (!r) {
        r = getRegionForProvince(p);
      }
    }
    if (r) setRegion(r);
    if (cnt) setCountry(cnt);
    if (z) setZipCode(z);
    if (l && !landmark) setLandmark(l);

    const activeStreet = s || street;
    const activeBarangay = b || barangay;
    const activeCity = c || city;
    const activeProvince = p || province;
    const activeRegion = r || region;
    const activeZip = z || zipCode;
    const activeLandmark = l || landmark;
    const activeCountry = cnt || country || 'Philippines';

    const constructed = [
      activeStreet,
      activeBarangay,
      activeCity,
      activeProvince,
      activeRegion ? `(${activeRegion})` : '',
      activeZip,
      activeCountry,
      activeLandmark ? `(Landmark: ${activeLandmark})` : ''
    ].filter(Boolean).join(', ');

    setLocationRegion(constructed);
  };


  // Fetch Organization Received Donations
  const fetchOrgDonations = async () => {
    try {
      setLoadingOrgDonations(true);
      const token = localStorage.getItem('bbdrts_token');
      if (!token) return;
      const apiUrl = API_URL;
      const res = await fetch(`${apiUrl}/api/donations/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOrgDonations(data);
      }
    } catch (err) {
      console.error('Failed to fetch org donations:', err);
    } finally {
      setLoadingOrgDonations(false);
    }
  };

  const fetchPendingDonations = async () => {
    try {
      setLoadingPending(true);
      const token = localStorage.getItem('bbdrts_token');
      if (!token) return;
      const apiUrl = API_URL;
      const res = await fetch(`${apiUrl}/api/manual-donations/pending`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPendingDonations(data);
      }
    } catch (err) {
      console.error('Failed to fetch pending donations:', err);
    } finally {
      setLoadingPending(false);
    }
  };

  const handleVerifyDonation = async (id, action) => {
    try {
      const token = localStorage.getItem('bbdrts_token');
      const apiUrl = API_URL;
      const res = await fetch(`${apiUrl}/api/manual-donations/${id}/${action}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showSuccess(`Donation ${action === 'approve' ? 'Approved & Recorded to Ledger' : 'Rejected'} successfully.`, 'Verification Complete');
        fetchPendingDonations();
        fetchOrgDonations();
        if (typeof fetchCampaigns === 'function') fetchCampaigns();
      } else {
        const err = await res.json();
        showError(err.error, 'Verification Failed');
      }
    } catch (error) {
      showError(error.message, 'Error');
    }
  };

  // ── Post-Signup SEC Institutional Accreditation & KYC State ──
  const [secRegNo, setSecRegNo] = useState('');
  const [dswdNo, setDswdNo] = useState('');
  const [boardMembersText, setBoardMembersText] = useState('');
  const [secCertUrl, setSecCertUrl] = useState('');
  const [kycLoading, setKycLoading] = useState(false);
  const [kycSaving, setKycSaving] = useState(false);
  const [kycStepText, setKycStepText] = useState('');
  const [kycStatusData, setKycStatusData] = useState(null);
  const [viewingKycCert, setViewingKycCert] = useState(false);
  const [showGuidedTour, setShowGuidedTour] = useState(false);

  const userTourKey = currentUser?.id 
    ? `bbdrts_tour_ngo_${currentUser.id}` 
    : currentUser?.email 
      ? `bbdrts_tour_ngo_${currentUser.email}` 
      : 'bbdrts_tour_ngo_done';

  // Auto-launch Guided Tour for first-time NGOs
  useEffect(() => {
    try {
      const forceLaunch = localStorage.getItem('bbdrts_tour_force_launch') === 'true';
      const userTourDone = localStorage.getItem(userTourKey) === 'true';

      if (forceLaunch || !userTourDone) {
        let attempts = 0;
        const maxAttempts = 60;
        const pollInterval = setInterval(() => {
          attempts++;
          const authBackdrop = document.querySelector('.auth-transition-backdrop');
          const targetEl = document.querySelector('#tour-ngo-profile');
          const isAuthClear = !authBackdrop || authBackdrop.classList.contains('closing');
          const isTargetReady = targetEl && targetEl.getBoundingClientRect().width > 0;

          if ((isAuthClear && isTargetReady) || attempts >= maxAttempts) {
            clearInterval(pollInterval);
            setTimeout(() => {
              setShowGuidedTour(true);
              localStorage.removeItem('bbdrts_tour_force_launch');
            }, 350);
          }
        }, 100);

        return () => clearInterval(pollInterval);
      }
    } catch (_) {}
  }, [userTourKey]);

  const ngoTourSteps = [
    {
      target: '#tour-ngo-profile',
      title: 'Welcome NGO Partner!',
      icon: 'corporate_fare',
      badge: 'Step 1 of 8 • Welcome',
      description: 'Welcome to your Disaster Operations Hub. Here you can mobilize emergency appeals, manage ground missions, and maintain transparent relief accountability.',
      placement: 'right'
    },
    {
      target: '#tour-ngo-tab-sec',
      title: 'Institutional SEC & AI Vision KYC',
      icon: 'verified_user',
      badge: 'Step 2 of 8 • Accreditation',
      tab: 'sec-kyc',
      description: 'Upload your Philippine SEC Certificate of Incorporation or DSWD accreditation for instant 3-second Gemini AI Vision verification to unlock live campaign deployment.',
      placement: 'right'
    },
    {
      target: '#tour-ngo-tab-create',
      title: 'Deploy Disaster Relief Campaigns',
      icon: 'rocket_launch',
      badge: 'Step 3 of 8 • Deployment',
      tab: 'create',
      description: 'Launch new calamity relief appeals backed by Ethereum smart contracts. Specify funding targets, urgency levels, disaster categories, and Philippine regional coordinates.',
      placement: 'right'
    },
    {
      target: '#tour-ngo-tab-radar',
      title: 'Disaster Relief Radar Heatmap',
      icon: 'radar',
      badge: 'Step 4 of 8 • Strategic Dispatch',
      tab: 'radar-heatmap',
      description: 'Real-time Doppler calamity radar tracking disaster concentration across the Philippines. Pinpoint high-density calamity zones to strategically dispatch field missions.',
      placement: 'right'
    },
    {
      target: '#tour-ngo-tab-my-campaigns',
      title: 'My Campaigns & Milestone Management',
      icon: 'account_balance',
      badge: 'Step 5 of 8 • Missions',
      tab: 'my-campaigns',
      description: 'Track your organization\'s live appeals, post ground-zero beneficiary updates, and upload verifiable expenditure proofs for donor transparency.',
      placement: 'right'
    },
    {
      target: '#tour-ngo-tab-ledger',
      title: 'Donation Ledger & On-Chain Audits',
      icon: 'receipt_long',
      badge: 'Step 6 of 8 • Financials',
      tab: 'ledger',
      description: 'Inspect all incoming contributions in real-time, matching transaction hashes, cryptographic donor identities, and payment channels.',
      placement: 'right'
    },
    {
      target: '#tour-ngo-tab-settings',
      title: 'Payment Rails & Traditional E-Wallets',
      icon: 'account_circle',
      badge: 'Step 7 of 8 • Settings',
      tab: 'settings',
      description: 'Set up your GCash, PayMaya, and Bank wire QR codes alongside your Web3 wallet address so non-crypto Filipino donors can support your missions.',
      placement: 'right'
    },
    {
      target: '#tour-ngo-tab-dashboard',
      title: 'You\'re Mission Ready!',
      icon: 'emergency',
      badge: 'Step 8 of 8 • Ready',
      tab: 'dashboard',
      description: 'Your command center is configured! Monitor your metrics, submit your SEC accreditation, and deploy live relief missions to help affected Filipino communities.',
      placement: 'right'
    }
  ];

  const fetchKycData = async () => {
    try {
      setKycLoading(true);
      const token = localStorage.getItem('bbdrts_token');
      if (!token) return;
      const apiUrl = API_URL;
      const res = await fetch(`${apiUrl}/api/organization/kyc`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setKycStatusData(data);
        if (data.secRegistrationNo) setSecRegNo(data.secRegistrationNo);
        if (data.dswdAccreditationNo) setDswdNo(data.dswdAccreditationNo);
        if (data.boardMembers) setBoardMembersText(data.boardMembers);
        if (data.secCertificateUrl) setSecCertUrl(normalizeSecDocUrl(data.secCertificateUrl));
      }
    } catch (err) {
      console.error('Failed to load KYC data:', err);
    } finally {
      setKycLoading(false);
    }
  };

  const handleKycCertUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') && !file.type.includes('pdf')) {
      showWarning('Please upload a valid image or PDF document.', 'Invalid File');
      return;
    }
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setSecCertUrl(normalizeSecDocUrl(uploadEvent.target.result));
      showSuccess('SEC Certificate attached successfully!', 'Document Ready');
    };
    reader.readAsDataURL(file);
  };

  const handleAutofillDemoSec = () => {
    setSecRegNo('SEC-CN2021-08492');
    setDswdNo('DSWD-SB-A-2024-0193');
    setBoardMembersText('Chairman: Richard Gordon | SecGen: Gwendolyn Pang | Trustee: Dr. Benjamin Go');

    // Generate realistic Philippine SEC Certificate SVG
    const secCertSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" width="600" height="400"><rect width="600" height="400" fill="#fdfbf7" stroke="#b45309" stroke-width="6" rx="8"/><rect x="15" y="15" width="570" height="370" fill="none" stroke="#d97706" stroke-width="2" stroke-dasharray="8 4"/><text x="300" y="60" font-family="Georgia, serif" font-size="16" font-weight="bold" fill="#78350f" text-anchor="middle">REPUBLIC OF THE PHILIPPINES</text><text x="300" y="85" font-family="Georgia, serif" font-size="20" font-weight="bold" fill="#b45309" text-anchor="middle">SECURITIES AND EXCHANGE COMMISSION</text><text x="300" y="110" font-family="sans-serif" font-size="12" fill="#92400e" text-anchor="middle">SEC Building, EDSA, Greenhills, Mandaluyong City</text><line x1="100" y1="125" x2="500" y2="125" stroke="#b45309" stroke-width="2"/><text x="300" y="160" font-family="Georgia, serif" font-size="22" font-style="italic" fill="#1e293b" text-anchor="middle">CERTIFICATE OF INCORPORATION</text><text x="300" y="195" font-family="sans-serif" font-size="14" fill="#334155" text-anchor="middle">This is to certify that</text><text x="300" y="230" font-family="Georgia, serif" font-size="20" font-weight="bold" fill="#0f172a" text-anchor="middle">PHILIPPINE RED CROSS - SOUTHERN LEYTE CHAPTER</text><text x="300" y="260" font-family="sans-serif" font-size="13" fill="#475569" text-anchor="middle">is registered as a Non-Stock, Non-Profit Humanitarian Corporation</text><text x="300" y="295" font-family="monospace" font-size="15" font-weight="bold" fill="#b45309" text-anchor="middle">COMPANY REG. NO. SEC-CN2021-08492</text><text x="300" y="355" font-family="sans-serif" font-size="11" fill="#64748b" text-anchor="middle">Issued under Republic Act 11232 • Duly Verified & Seal Affixed</text></svg>`;
    const b64 = window.btoa(unescape(encodeURIComponent(secCertSvg)));
    setSecCertUrl(`data:image/svg+xml;base64,${b64}`);
    showSuccess('Verified Philippine SEC credentials populated!', 'Demo Credentials Ready');
  };

  const handleSaveKyc = async (e) => {
    e?.preventDefault();
    if (!secRegNo.trim() && !secCertUrl) {
      showWarning('Please enter your SEC Registration Number or upload the Certificate.', 'Missing Requirements');
      return;
    }

    try {
      setKycSaving(true);
      setKycStepText('🤖 Gemini Vision AI: Analyzing institutional seal & document authenticity...');
      
      const token = localStorage.getItem('bbdrts_token');
      const apiUrl = API_URL;

      const stepTimer = setTimeout(() => {
        setKycStepText('⚡ Cross-referencing SEC Registry Number against Anti-Fraud Rubric...');
      }, 1400);

      const res = await fetch(`${apiUrl}/api/organization/kyc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          org_name: orgDisplayName,
          sec_registration_no: secRegNo.trim(),
          sec_certificate_url: secCertUrl,
          board_members: boardMembersText.trim(),
          dswd_accreditation_no: dswdNo.trim()
        })
      });

      clearTimeout(stepTimer);
      const data = await res.json();

      if (res.ok && data.success) {
        showSuccess(data.message || 'Verification Successful! Accredited by Gemini AI Vision.', 'AI Accredited ✅');
        if (currentUser) currentUser.verification_status = 'Approved';
        await fetchKycData();
      } else if (data.verification_status === 'Flagged') {
        showError(data.error || 'Maximum verification attempts exceeded. Account flagged.', 'Account Flagged ⚠️');
        await fetchKycData();
      } else {
        showWarning(data.message || data.error || 'Document could not be verified by AI rubric. Please check the document and resubmit.', 'Verification Notice');
        await fetchKycData();
      }
    } catch (err) {
      console.error(err);
      showWarning('Network error during AI verification: ' + err.message, 'Error');
    } finally {
      setKycSaving(false);
      setKycStepText('');
    }
  };

  useEffect(() => {
    fetchOrgDonations();
    fetchPendingDonations();
    fetchKycData();
  }, []);

  // Filter & Sort All Campaigns
  const filteredAllCampaigns = useMemo(() => {
    return campaigns
      .filter(c => {
        if (categoryFilterAll !== 'ALL') {
          const displayTitle = formatCampaignTitle(c.title, c.id);
          const isCharity = /charity|school|orphan|food|feed|community|aid|blood|medical/i.test(displayTitle);
          if (categoryFilterAll === 'DR' && isCharity) return false;
          if (categoryFilterAll === 'CD' && !isCharity) return false;
        }
        if (urgencyFilterAll !== 'ALL') {
          const audit = getCampaignAuditDetails(c.id, c.title, c);
          const u = (audit.urgency || '').toUpperCase();
          if (urgencyFilterAll === 'HIGH' && !u.includes('HIGH') && !u.includes('CRITICAL')) return false;
          if (urgencyFilterAll === 'MEDIUM' && !u.includes('MEDIUM') && !u.includes('URGENT')) return false;
          if (urgencyFilterAll === 'STABLE' && !u.includes('ESSENTIAL') && !u.includes('STABLE')) return false;
        }
        if (selectedTagsAll.length > 0) {
          const cTags = getCampaignTags(c).map(t => t.replace(/^#/, '').toLowerCase());
          const hasMatch = selectedTagsAll.some(st => cTags.includes(st.toLowerCase()));
          if (!hasMatch) return false;
        }
        if (searchQueryAll.trim()) {
          const q = searchQueryAll.toLowerCase().trim();
          const displayTitle = formatCampaignTitle(c.title, c.id).toLowerCase();
          const rawTitle = (c.title || '').toLowerCase();
          const orgName = (c.orgName || '').toLowerCase();
          const loc = (c.locationRegion || c.location || '').toLowerCase();
          return displayTitle.includes(q) || rawTitle.includes(q) || orgName.includes(q) || loc.includes(q) || String(c.id).includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        if (campaignSortAll === 'MOST_FUNDED') {
          const pctA = (parseFloat(a.currentAmount || 0) / Math.max(0.0001, parseFloat(a.targetAmount || 1)));
          const pctB = (parseFloat(b.currentAmount || 0) / Math.max(0.0001, parseFloat(b.targetAmount || 1)));
          return pctB - pctA;
        }
        if (campaignSortAll === 'GOAL_HIGH') return (parseFloat(b.targetAmount) || 0) - (parseFloat(a.targetAmount) || 0);
        if (campaignSortAll === 'GOAL_LOW') return (parseFloat(a.targetAmount) || 0) - (parseFloat(b.targetAmount) || 0);
        if (campaignSortAll === 'RAISED_HIGH') return (parseFloat(b.currentAmount) || 0) - (parseFloat(a.currentAmount) || 0);
        return b.id - a.id;
      });
  }, [campaigns, categoryFilterAll, urgencyFilterAll, selectedTagsAll, searchQueryAll, campaignSortAll]);

  const totalPagesAll = Math.ceil(filteredAllCampaigns.length / campaignsPerPage);
  const paginatedAllCampaigns = filteredAllCampaigns.slice(
    (currentPageAll - 1) * campaignsPerPage,
    currentPageAll * campaignsPerPage
  );

  // Filter & Sort My Campaigns
  const filteredMyCampaigns = useMemo(() => {
    return myCampaigns
      .filter(c => {
        if (categoryFilterMy !== 'ALL') {
          const displayTitle = formatCampaignTitle(c.title, c.id);
          const isCharity = /charity|school|orphan|food|feed|community|aid|blood|medical/i.test(displayTitle);
          if (categoryFilterMy === 'DR' && isCharity) return false;
          if (categoryFilterMy === 'CD' && !isCharity) return false;
        }
        if (urgencyFilterMy !== 'ALL') {
          const audit = getCampaignAuditDetails(c.id, c.title, c);
          const u = (audit.urgency || '').toUpperCase();
          if (urgencyFilterMy === 'HIGH' && !u.includes('HIGH') && !u.includes('CRITICAL')) return false;
          if (urgencyFilterMy === 'MEDIUM' && !u.includes('MEDIUM') && !u.includes('URGENT')) return false;
          if (urgencyFilterMy === 'STABLE' && !u.includes('ESSENTIAL') && !u.includes('STABLE')) return false;
        }
        if (selectedTagsMy.length > 0) {
          const cTags = getCampaignTags(c).map(t => t.replace(/^#/, '').toLowerCase());
          const hasMatch = selectedTagsMy.some(st => cTags.includes(st.toLowerCase()));
          if (!hasMatch) return false;
        }
        if (searchQueryMy.trim()) {
          const q = searchQueryMy.toLowerCase().trim();
          const displayTitle = formatCampaignTitle(c.title, c.id).toLowerCase();
          const rawTitle = (c.title || '').toLowerCase();
          const loc = (c.locationRegion || c.location || '').toLowerCase();
          return displayTitle.includes(q) || rawTitle.includes(q) || loc.includes(q) || String(c.id).includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        if (campaignSortMy === 'MOST_FUNDED') {
          const pctA = (parseFloat(a.currentAmount || 0) / Math.max(0.0001, parseFloat(a.targetAmount || 1)));
          const pctB = (parseFloat(b.currentAmount || 0) / Math.max(0.0001, parseFloat(b.targetAmount || 1)));
          return pctB - pctA;
        }
        if (campaignSortMy === 'GOAL_HIGH') return (parseFloat(b.targetAmount) || 0) - (parseFloat(a.targetAmount) || 0);
        if (campaignSortMy === 'GOAL_LOW') return (parseFloat(a.targetAmount) || 0) - (parseFloat(b.targetAmount) || 0);
        if (campaignSortMy === 'RAISED_HIGH') return (parseFloat(b.currentAmount) || 0) - (parseFloat(a.currentAmount) || 0);
        return b.id - a.id;
      });
  }, [myCampaigns, categoryFilterMy, urgencyFilterMy, selectedTagsMy, searchQueryMy, campaignSortMy]);

  const totalPagesMy = Math.ceil(filteredMyCampaigns.length / campaignsPerPage);
  const paginatedMyCampaigns = filteredMyCampaigns.slice(
    (currentPageMy - 1) * campaignsPerPage,
    currentPageMy * campaignsPerPage
  );

  // Filter & Sort Ledger Transactions
  const filteredLedger = (orgDonations || [])
    .filter(d => {
      if (ledgerFilter !== 'ALL') {
        const matchCamp = campaigns.find(c => String(c.id) === String(d.campaignId));
        const campTitle = matchCamp ? formatCampaignTitle(matchCamp.title, matchCamp.id) : '';
        const isCharity = /charity|school|orphan|food|feed|community|aid|blood|medical/i.test(campTitle);
        if (ledgerFilter === 'DR' && isCharity) return false;
        if (ledgerFilter === 'CD' && !isCharity) return false;
      }
      if (searchQueryLedger.trim()) {
        const q = searchQueryLedger.toLowerCase().trim();
        const txHash = (d.txHash || '').toLowerCase();
        const matchCamp = campaigns.find(c => String(c.id) === String(d.campaignId));
        const campTitle = matchCamp ? formatCampaignTitle(matchCamp.title, matchCamp.id).toLowerCase() : '';
        return txHash.includes(q) || campTitle.includes(q) || String(d.campaignId).includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      if (ledgerSort === 'AMOUNT_HIGH') return (parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0);
      if (ledgerSort === 'AMOUNT_LOW') return (parseFloat(a.amount) || 0) - (parseFloat(b.amount) || 0);
      return (b.id || 0) - (a.id || 0);
    });

  const totalPagesLedger = Math.ceil(filteredLedger.length / campaignsPerPage);
  const paginatedLedger = filteredLedger.slice(
    (currentPageLedger - 1) * campaignsPerPage,
    currentPageLedger * campaignsPerPage
  );

  // Deploy Campaign Logic
  const handleCreateCampaign = async (e) => {
    e.preventDefault();

    if (!title.trim()) return setTxModal({ show: true, step: 0, error: 'Please enter a campaign title.' });
    const parsedPhp = parseFloat(targetAmount);
    if (isNaN(parsedPhp) || parsedPhp <= 0)
      return setTxModal({ show: true, step: 0, error: 'Please enter a valid target fundraising goal in PHP (greater than ₱0).' });

    const ethEquivalent = (parsedPhp / 170000).toFixed(6);

    // MetaMask requirement check: only enforced in production / live environments
    if (!isLocalhost && !contract) {
      return setTxModal({
        show: true,
        step: 0,
        error: 'ACTION BLOCKED: You are not actively connected to MetaMask on this specific wallet address. Please go to Profile & Settings and click Connect MetaMask.'
      });
    }

    const shouldBypassMetaMask = isLocalhost && (!contract || bypassMetaMaskLocal);

    try {
      setCreating(true);
      let deployedHash = '';

      if (shouldBypassMetaMask) {
        deployedHash = `0xlocal_${Date.now()}_${Math.random().toString(16).substring(2, 10)}`;
        setTxModal({ show: true, step: 1, hash: '', type: 'CREATE', error: '', isLocal: true });
        await new Promise(r => setTimeout(r, 350));
        setTxModal({ show: true, step: 2, hash: deployedHash, type: 'CREATE', error: '', isLocal: true });
        await new Promise(r => setTimeout(r, 400));
      } else {
        const targetInWei = ethers.parseEther(ethEquivalent.toString());
        setTxModal({ show: true, step: 1, hash: '', type: 'CREATE', error: '', isLocal: false });
        const tx = await contract.createCampaign(title.trim(), targetInWei);
        setTxModal({ show: true, step: 2, hash: tx.hash, type: 'CREATE', error: '', isLocal: false });
        await tx.wait();
        deployedHash = tx.hash;
      }

      try {
        const token = localStorage.getItem('bbdrts_token');
        const apiUrl = import.meta.env.VITE_API_URL || (
          !isLocalhost
            ? 'https://bbdrts-backend-api.onrender.com'
            : 'http://localhost:3001'
        );

        const allocations = null;

        // Construct full address from granular input fields if map picker wasn't clicked
        const constructedAddress = [street, barangay, city, province, region ? `(${region})` : '', zipCode, country, landmark ? `(Landmark: ${landmark})` : '']
          .map(s => (s || '').trim())
          .filter(Boolean)
          .join(', ');

        const finalLocationRegion = locationRegion.trim() || constructedAddress || '';

        const payload = {
          title: title.trim(),
          target_amount: ethEquivalent,
          target_amount_php: parsedPhp,
          contract_address: (contract && Object(contract).target) ? Object(contract).target : '0xLocalSimulatedContract',
          category: category,
          tags: selectedTags.join(', '),
          location_region: finalLocationRegion,
          gps_coordinates: gpsCoordinates.trim() || '',
          beneficiaries_impact: beneficiariesImpact.trim() || '',
          allocations_json: allocations,
          contact_info: contactInfo.trim() || `${currentUser?.username || 'ngo'}@bbdrts.org`,
          description: description.trim() || '',
          urgency: urgency,
          target_date: targetDate,
          document_url: documentUrl.trim(),
          gcash_name: gcashName.trim(),
          gcash_number: gcashNumber.trim(),
          gcash_qr_url: gcashQrUrl,
          maya_name: mayaName.trim(),
          maya_number: mayaNumber.trim(),
          maya_qr_url: mayaQrUrl,
          bank_name: bankName.trim(),
          bank_account_name: bankAccountName.trim(),
          bank_account_number: bankAccountNumber.trim(),
          bank_qr_url: bankQrUrl,
          org_name: orgDisplayName
        };

        // Cache in LocalStorage for client-side resilience
        try {
          const existingLocal = JSON.parse(localStorage.getItem('bbdrts_created_campaigns') || '[]');
          existingLocal.unshift(payload);
          localStorage.setItem('bbdrts_created_campaigns', JSON.stringify(existingLocal));
        } catch (e) {
          console.warn('LocalStorage cache write error:', e);
        }

        const res = await fetch(`${apiUrl}/api/campaigns`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.warn("Backend campaign sync notice:", errData);
        }
      } catch (err) {
        console.error("Failed to sync campaign to backend:", err);
      }

      setTxModal({ show: true, step: 3, hash: deployedHash, type: 'CREATE', error: '', isLocal: shouldBypassMetaMask });
      setTitle('');
      setTargetAmount('');
      setLocationRegion('');
      setStreet('');
      setBarangay('');
      setCity('');
      setProvince('');
      setRegion('');
      setZipCode('');
      setLandmark('');
      setCountry('Philippines');
      setGpsCoordinates('');
      setBeneficiariesImpact('');
      setContactInfo('');
      setGcashName('');
      setGcashNumber('');
      setGcashQrUrl('');
      setMayaName('');
      setMayaNumber('');
      setMayaQrUrl('');
      setBankName('BDO Unibank');
      setBankAccountName('');
      setBankAccountNumber('');
      setBankQrUrl('');
      setDescription('');
      setTargetDate('');
      setDocumentUrl('');
      setUrgency('HIGH (EMERGENCY AID)');
      fetchCampaigns();
      fetchOrgDonations();
      showSuccess(
        shouldBypassMetaMask
          ? 'Campaign successfully deployed in Localhost Mode!'
          : 'Campaign successfully deployed on the blockchain!',
        'Campaign Active'
      );
    } catch (err) {
      console.error(err);
      if (err.code !== 'ACTION_REJECTED') {
        let errMsg = err.reason || err.shortMessage || err.message || 'Please check MetaMask.';
        if (typeof errMsg === 'string' && (errMsg.includes('missing revert data') || errMsg.includes('CALL_EXCEPTION'))) {
          errMsg = 'Transaction reverted by the network. Ensure you have sufficient SepoliaETH to deploy this contract.';
        }
        setTxModal({ show: true, step: 0, error: `Transaction failed: ${errMsg}` });
      } else {
        setTxModal({ show: false, step: 0, hash: '', type: '', error: '' });
      }
    } finally {
      setCreating(false);
    }
  };

  const orgDisplayName = getOrgDisplayName(walletAddress, currentUser?.name, 1);
  const orgInitials = orgDisplayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  return (
    <main className="dashboard container" style={{ paddingTop: '16px' }}>
      {/* ── Reference Dashboard Grid Architecture (Matching DonorView Layout) ── */}
      <div className="ref-dashboard-grid" style={{ marginTop: '0' }}>

        {/* ── Left Sidebar Navigation (Maasin Reference Style) ── */}
        <aside className="ref-sidebar">
          <div>
            <div className="ref-sidebar-user" id="tour-ngo-profile">
              <div className="ref-sidebar-avatar" style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {currentUser?.avatar_url && (currentUser.avatar_url.startsWith('data:') || currentUser.avatar_url.startsWith('http')) ? (
                  <img src={currentUser.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : currentUser?.avatar_url && currentUser.avatar_url.length < 30 ? (
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--accent)' }}>{currentUser.avatar_url}</span>
                ) : (
                  orgInitials
                )}
              </div>
              <div>
                <div className="ref-sidebar-name">{orgDisplayName}</div>
                <div className="ref-sidebar-id">BBDRTS-NGO-2026-0001</div>
              </div>
            </div>

            <nav className="ref-sidebar-menu" style={{ marginTop: '16px' }}>
              <button
                id="tour-ngo-tab-dashboard"
                className={`ref-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                onClick={() => setActiveTab('dashboard')}
              >
                <span className="material-symbols-outlined">space_dashboard</span>
                <span>Dashboard Overview</span>
              </button>

              <button
                id="tour-ngo-tab-sec"
                className={`ref-nav-item ${activeTab === 'sec-kyc' ? 'active' : ''}`}
                onClick={() => { fetchKycData(); setActiveTab('sec-kyc'); }}
              >
                <span className="material-symbols-outlined">verified_user</span>
                <span>SEC Accreditation & KYC</span>
                {(currentUser?.verification_status !== 'Approved' && kycStatusData?.Verification_Status !== 'Approved') && (
                  <span style={{ marginLeft: 'auto', background: 'rgba(234, 179, 8, 0.2)', color: '#facc15', border: '1px solid rgba(234, 179, 8, 0.4)', borderRadius: '4px', fontSize: '0.62rem', fontWeight: 800, padding: '1px 5px' }}>
                    Required
                  </span>
                )}
              </button>

              <button
                id="tour-ngo-tab-all-campaigns"
                className={`ref-nav-item ${activeTab === 'all-campaigns' ? 'active' : ''}`}
                onClick={() => setActiveTab('all-campaigns')}
              >
                <span className="material-symbols-outlined">list_alt</span>
                <span>All Campaigns</span>
              </button>

              <button
                id="tour-ngo-tab-radar"
                className={`ref-nav-item ${activeTab === 'radar-heatmap' ? 'active' : ''}`}
                onClick={() => setActiveTab('radar-heatmap')}
              >
                <span className="material-symbols-outlined" style={{ color: activeTab === 'radar-heatmap' ? '#38bdf8' : 'inherit' }}>radar</span>
                <span>Relief Radar</span>
              </button>

              <button
                id="tour-ngo-tab-my-campaigns"
                className={`ref-nav-item ${activeTab === 'my-campaigns' ? 'active' : ''}`}
                onClick={() => setActiveTab('my-campaigns')}
              >
                <span className="material-symbols-outlined">account_balance</span>
                <span>My Campaigns</span>
              </button>

              <button
                id="tour-ngo-tab-create"
                className={`ref-nav-item ${activeTab === 'create' ? 'active' : ''}`}
                onClick={() => setActiveTab('create')}
              >
                <span className="material-symbols-outlined">rocket_launch</span>
                <span>Deploy Campaign</span>
              </button>

              <button
                id="tour-ngo-tab-ledger"
                className={`ref-nav-item ${activeTab === 'ledger' ? 'active' : ''}`}
                onClick={() => setActiveTab('ledger')}
              >
                <span className="material-symbols-outlined">receipt_long</span>
                <span>Donation Ledger</span>
              </button>

              <button
                id="tour-ngo-tab-settings"
                className={`ref-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => setActiveTab('settings')}
              >
                <span className="material-symbols-outlined">account_circle</span>
                <span>Profile & Settings</span>
              </button>

              <button 
                type="button"
                className="ref-nav-item"
                onClick={() => setShowGuidedTour(true)}
                style={{ marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px', color: '#38bdf8' }}
                title="Take a guided walkthrough of the NGO portal"
              >
                <span className="material-symbols-outlined" style={{ color: '#38bdf8' }}>help</span>
                <span style={{ fontWeight: 600 }}>Guided Tutorial</span>
              </button>
            </nav>
          </div>

          {/* ── Web3 Sepolia Live Protocol Widget ── */}
          <div className="ref-sidebar-widget" style={{ marginTop: '20px' }}>
            <div className="ref-widget-header">
              <span className="ref-status-dot"></span>
              <span className="ref-widget-title">Sepolia EVM Protocol</span>
            </div>
            <div className="ref-widget-detail">
              <div className="ref-widget-row">
                <span>Verification</span>
                <span className="ref-widget-value green">
                  {currentUser?.verification_status === 'Approved' ? 'Approved NGO' : 'Pending Verification'}
                </span>
              </div>
              <div className="ref-widget-row">
                <span>Contract Health</span>
                <span className="ref-widget-value">100% Immutable</span>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Main Content Area ── */}
        <section className="ref-main-content">

          {/* Sleek Inline Testnet Banner
          <div className="ref-inline-testnet-banner">
            <span>🔬</span>
            <span>
                <strong>Sepolia Testnet Protocol Active</strong> — Verified Smart Contract Operations.{' '}
              <a href="https://sepoliafaucet.com/" target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline' }}>
                Get Sepolia ETH →
              </a>
            </span>
          </div>
          */}

          {/* ── 1. DASHBOARD OVERVIEW TAB ONLY ── */}
          {activeTab === 'dashboard' && (
            <>
              {/* Top Hero Banner */}
              <div
                className="ref-welcome-card"
                style={
                  currentUser?.banner_url && (currentUser.banner_url.startsWith('data:') || currentUser.banner_url.startsWith('http') || currentUser.banner_url.startsWith('/'))
                    ? { backgroundImage: `linear-gradient(rgba(10,12,18,0.72), rgba(10,12,18,0.92)), url(${currentUser.banner_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                    : currentUser?.banner_url && currentUser.banner_url.startsWith('linear-gradient')
                      ? { background: currentUser.banner_url }
                      : {}
                }
              >
                <div className="ref-welcome-header">
                  <div className="ref-welcome-avatar" style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {currentUser?.avatar_url && (currentUser.avatar_url.startsWith('data:') || currentUser.avatar_url.startsWith('http')) ? (
                      <img src={currentUser.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : currentUser?.avatar_url && currentUser.avatar_url.length < 30 ? (
                      <span className="material-symbols-outlined" style={{ fontSize: '28px', color: 'var(--accent)' }}>{currentUser.avatar_url}</span>
                    ) : (
                      orgInitials
                    )}
                  </div>
                  <div className="ref-welcome-text">
                    <h1>{orgDisplayName || 'Organization Dashboard'}</h1>
                    <p>
                      <span className="material-symbols-outlined" style={{ fontSize: '13px', color: '#22c55e', verticalAlign: 'middle', marginRight: '4px' }}>verified</span>
                      NGO Organization Protocol • Entity Address: <code style={{ color: 'var(--accent)', fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}>{shortAddr(walletAddress)}</code>
                    </p>
                  </div>
                </div>

                <div className="ref-action-btns">
                  <button className="ref-btn-pill-primary" onClick={() => setActiveTab('create')}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>rocket_launch</span>
                    <span>Deploy Campaign</span>
                  </button>
                  <a href="https://sepolia.etherscan.io" target="_blank" rel="noreferrer" className="ref-btn-pill-primary" style={{ textDecoration: 'none' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>analytics</span>
                    <span>Public Ledger</span>
                  </a>
                </div>
              </div>

              {/* Action Required: SEC Accreditation Banner (when pending) */}
              {(currentUser?.verification_status !== 'Approved' && kycStatusData?.Verification_Status !== 'Approved') && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.12) 0%, rgba(14, 165, 233, 0.08) 100%)',
                  border: '1px solid rgba(234, 179, 8, 0.35)',
                  borderRadius: '14px',
                  padding: '16px 20px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '14px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(234, 179, 8, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#facc15', flexShrink: 0 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>verified_user</span>
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, color: '#fef08a', fontSize: '0.95rem' }}>
                        Institutional SEC Non-Profit Accreditation Pending
                      </div>
                      <div style={{ color: '#cbd5e1', fontSize: '0.8rem', marginTop: '2px' }}>
                        Submit your SEC Registration Number, Board of Trustees, and Certificate to unlock on-chain campaign deployment.
                      </div>
                    </div>
                  </div>
                  <button
                    className="btn btn-primary btn-sm glow pulse"
                    onClick={() => { fetchKycData(); setActiveTab('sec-kyc'); }}
                    style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <span>Complete SEC Verification</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
                  </button>
                </div>
              )}

              {/* 4-Metric Stat Cards Grid */}
              <div className="ref-metrics-grid">
                <div className="ref-metric-card">
                  <div className="ref-metric-icon-circle">
                    <span className="material-symbols-outlined" style={{ fontSize: '22px', color: '#0284c7' }}>account_balance_wallet</span>
                  </div>
                  <div className="ref-metric-title">Total Raised</div>
                  <div className="ref-metric-value">{totalRaisedByMe.toFixed(4)} <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>ETH</span></div>
                  <div className="ref-metric-sub">≈ ₱{(totalRaisedByMe * 170000).toLocaleString('en-US', { maximumFractionDigits: 0 })} PHP</div>
                </div>

                <div className="ref-metric-card">
                  <div className="ref-metric-icon-circle">
                    <span className="material-symbols-outlined" style={{ fontSize: '22px', color: '#22c55e' }}>account_balance</span>
                  </div>
                  <div className="ref-metric-title">My Deployed Campaigns</div>
                  <div className="ref-metric-value">{myCampaigns.length}</div>
                  <div className="ref-metric-sub">{myCampaigns.filter(c => c.isActive).length} Active Operations</div>
                </div>

                <div className="ref-metric-card">
                  <div className="ref-metric-icon-circle">
                    <span className="material-symbols-outlined" style={{ fontSize: '22px', color: '#0284c7' }}>receipt_long</span>
                  </div>
                  <div className="ref-metric-title">Received Donations</div>
                  <div className="ref-metric-value">{orgDonations ? orgDonations.length : 0}</div>
                  <div className="ref-metric-sub">Verified On-Chain Ledger</div>
                </div>

                <div className="ref-metric-card">
                  <div className="ref-metric-icon-circle">
                    <span className="material-symbols-outlined" style={{ fontSize: '22px', color: '#38bdf8' }}>verified</span>
                  </div>
                  <div className="ref-metric-title">Verification Status</div>
                  <div className="ref-metric-value" style={{ fontSize: '1rem', color: currentUser?.verification_status === 'Approved' ? '#22c55e' : '#f59e0b' }}>
                    {currentUser?.verification_status === 'Approved' ? '✓ Approved NGO' : '⌛ Pending'}
                  </div>
                  <div className="ref-metric-sub">Admin Managed Access</div>
                </div>
              </div>

              {/* My Deployed Campaigns Preview Section */}
              <div style={{ marginTop: '28px' }}>
                <div className="section-header">
                  <h2 className="section-title">
                    <span className="material-symbols-outlined section-title-icon" style={{ marginRight: '8px' }}>account_balance</span> My Relief Operations
                  </h2>
                  <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab('my-campaigns')}>
                    View All {myCampaigns.length} Campaigns →
                  </button>
                </div>

                {fetchingCampaigns && myCampaigns.length === 0 ? (
                  <div className="empty-state">
                    <div className="spinner spinner-light" style={{ width: 28, height: 28 }} />
                    <div className="empty-title">Reading from blockchain…</div>
                  </div>
                ) : myCampaigns.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">🚀</div>
                    <div className="empty-title">You haven't deployed any campaigns yet</div>
                    <div className="empty-desc">Click "Deploy Campaign" to start your first relief operation.</div>
                  </div>
                ) : (
                  <div className="campaigns-list">
                    {myCampaigns.slice(0, 2).map((camp) => (
                      <CampaignCard
                        key={camp.id}
                        camp={camp}
                        contract={contract}
                        role={ROLES.ORGANIZATION}
                        walletAddress={walletAddress}
                        onDonated={fetchCampaigns}
                        onDeactivated={fetchCampaigns}
                        onCampaignUpdated={fetchCampaigns}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── 2. ALL CAMPAIGNS TAB ── */}
          {activeTab === 'all-campaigns' && (
            <div style={{ marginTop: '8px' }}>
              <div className="section-header">
                <div>
                  <h2 className="section-title" style={{ fontSize: '1.4rem' }}>
                    <span className="material-symbols-outlined section-title-icon" style={{ marginRight: '8px', color: '#0284c7' }}>list_alt</span> All Relief Campaigns
                  </h2>
                  <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '4px' }}>
                    Public ledger view of all active disaster relief and charitable aid campaigns across the network.
                  </p>
                </div>

                <button
                  className="btn btn-ghost btn-sm"
                  onClick={fetchCampaigns}
                  disabled={fetchingCampaigns}
                >
                  {fetchingCampaigns
                    ? <div className="spinner spinner-light" />
                    : '↻ Refresh'}
                </button>
              </div>

              {/* ── Unified Campaign Toolbar: Filters on Left, Search & Sort on Right (Matches DonorView) ── */}
              <div className="campaign-toolbar-card">
                <div className="campaign-toolbar-unified-row">
                  {/* Left: Filters Header + Filter Pills (Causes, Priorities, Tags) */}
                  <div className="toolbar-filters-left">
                    <div className="toolbar-filters-header">
                      <span className="material-symbols-outlined">filter_list</span>
                      <span>Filters</span>
                    </div>

                    {/* Cause Filter Pill Popover */}
                    <div style={{ position: 'relative' }} ref={causesDropdownRefAll}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCausesDropdownAll(prev => !prev);
                          setShowPrioritiesDropdownAll(false);
                          setShowTagsDropdownAll(false);
                          setShowSortDropdownAll(false);
                        }}
                        className={`filter-pill-btn ${categoryFilterAll !== 'ALL' ? 'active-filter' : ''}`}
                        title="Filter by cause category"
                      >
                        <span className="material-symbols-outlined filter-pill-icon" style={{ color: selectedCauseObjAll.color }}>{selectedCauseObjAll.icon}</span>
                        <span>{selectedCauseObjAll.label}</span>
                        <span className="material-symbols-outlined filter-pill-arrow" style={{ position: 'static', marginLeft: '4px' }}>
                          {showCausesDropdownAll ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>

                      {showCausesDropdownAll && (
                        <div className="filter-custom-popover">
                          {CAUSE_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setCategoryFilterAll(opt.value);
                                setShowCausesDropdownAll(false);
                              }}
                              className={`filter-popover-option ${categoryFilterAll === opt.value ? 'selected' : ''}`}
                            >
                              <span className="material-symbols-outlined filter-popover-option-icon" style={{ color: opt.color }}>{opt.icon}</span>
                              <span>{opt.label}</span>
                              {categoryFilterAll === opt.value && (
                                <span className="material-symbols-outlined filter-popover-check">check</span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Priority Filter Pill Popover */}
                    <div style={{ position: 'relative' }} ref={prioritiesDropdownRefAll}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowPrioritiesDropdownAll(prev => !prev);
                          setShowCausesDropdownAll(false);
                          setShowTagsDropdownAll(false);
                          setShowSortDropdownAll(false);
                        }}
                        className={`filter-pill-btn ${urgencyFilterAll !== 'ALL' ? 'active-filter' : ''}`}
                        title="Filter by urgency priority"
                      >
                        <span className="material-symbols-outlined filter-pill-icon" style={{ color: selectedPriorityObjAll.color }}>{selectedPriorityObjAll.icon}</span>
                        <span>{selectedPriorityObjAll.label}</span>
                        <span className="material-symbols-outlined filter-pill-arrow" style={{ position: 'static', marginLeft: '4px' }}>
                          {showPrioritiesDropdownAll ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>

                      {showPrioritiesDropdownAll && (
                        <div className="filter-custom-popover">
                          {PRIORITY_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setUrgencyFilterAll(opt.value);
                                setShowPrioritiesDropdownAll(false);
                              }}
                              className={`filter-popover-option ${urgencyFilterAll === opt.value ? 'selected' : ''}`}
                            >
                              <span className="material-symbols-outlined filter-popover-option-icon" style={{ color: opt.color }}>{opt.icon}</span>
                              <span>{opt.label}</span>
                              {urgencyFilterAll === opt.value && (
                                <span className="material-symbols-outlined filter-popover-check">check</span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Tags Dropdown Popover with Checkboxes */}
                    <div style={{ position: 'relative' }} ref={tagsDropdownRefAll}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowTagsDropdownAll(prev => !prev);
                          setShowCausesDropdownAll(false);
                          setShowPrioritiesDropdownAll(false);
                          setShowSortDropdownAll(false);
                        }}
                        className={`filter-pill-btn ${selectedTagsAll.length > 0 ? 'active-filter' : ''}`}
                        title="Filter by tags"
                      >
                        <span className="material-symbols-outlined filter-pill-icon" style={{ color: '#a855f7' }}>sell</span>
                        <span>Tags</span>
                        {selectedTagsAll.length > 0 && (
                          <span className="tags-dropdown-badge-ref">{selectedTagsAll.length}</span>
                        )}
                        <span className="material-symbols-outlined filter-pill-arrow" style={{ position: 'static', marginLeft: '4px' }}>
                          {showTagsDropdownAll ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>

                      {showTagsDropdownAll && (
                        <div className="tags-popover-menu">
                          <div className="tags-popover-header">
                            <span className="tags-popover-title">
                              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>sell</span>
                              Filter by Tags
                            </span>
                            {selectedTagsAll.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setSelectedTagsAll([])}
                                className="tags-popover-clear-btn"
                              >
                                Clear ({selectedTagsAll.length})
                              </button>
                            )}
                          </div>

                          <div className="tags-popover-list">
                            {/* "All Tags" Checkbox */}
                            <label className={`tags-popover-item ${selectedTagsAll.length === 0 ? 'checked' : ''}`}>
                              <input
                                type="checkbox"
                                checked={selectedTagsAll.length === 0}
                                onChange={() => setSelectedTagsAll([])}
                              />
                              <span className="tags-popover-tag-text">All Tags</span>
                              <span className="tags-popover-count">{campaigns.length}</span>
                            </label>

                            {/* Individual Tag Checkboxes */}
                            {availableTagsAll.map((tag) => {
                              const isChecked = selectedTagsAll.includes(tag);
                              const count = tagCountsAll[tag] || 0;
                              return (
                                <label key={tag} className={`tags-popover-item ${isChecked ? 'checked' : ''}`}>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      setSelectedTagsAll(prev =>
                                        prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                                      );
                                    }}
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
                        ref={searchInputRefAll}
                        type="text"
                        placeholder="Search campaign, NGO, or cause..."
                        value={searchQueryAll}
                        onChange={(e) => setSearchQueryAll(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') e.target.blur();
                        }}
                        className="filter-search-input-ref"
                      />
                      {searchQueryAll && (
                        <button
                          type="button"
                          onClick={() => setSearchQueryAll('')}
                          className="filter-search-clear-btn-ref"
                          title="Clear search"
                        >
                          ✕
                        </button>
                      )}
                      <kbd className="filter-search-shortcut-badge" title="Press Ctrl+K or ⌘K to focus search">⌘ K</kbd>
                    </div>

                    {/* Sort Pill Popover */}
                    <div style={{ position: 'relative' }} ref={sortDropdownRefAll}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowSortDropdownAll(prev => !prev);
                          setShowCausesDropdownAll(false);
                          setShowPrioritiesDropdownAll(false);
                          setShowTagsDropdownAll(false);
                        }}
                        className="filter-pill-btn"
                        title="Sort campaigns"
                      >
                        <span className="material-symbols-outlined filter-pill-icon" style={{ color: '#94a3b8' }}>swap_vert</span>
                        <span>{selectedSortObjAll.label}</span>
                        <span className="material-symbols-outlined filter-pill-arrow" style={{ position: 'static', marginLeft: '4px' }}>
                          {showSortDropdownAll ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>

                      {showSortDropdownAll && (
                        <div className="filter-custom-popover align-right">
                          {SORT_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setCampaignSortAll(opt.value);
                                setShowSortDropdownAll(false);
                              }}
                              className={`filter-popover-option ${campaignSortAll === opt.value ? 'selected' : ''}`}
                            >
                              <span className="material-symbols-outlined filter-popover-option-icon" style={{ color: '#94a3b8' }}>{opt.icon}</span>
                              <span>{opt.label}</span>
                              {campaignSortAll === opt.value && (
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
                {hasActiveFiltersAll && (
                  <div className="campaign-active-filters-bar">
                    <div className="active-filters-left">
                      <span className="active-filters-label">Active filters:</span>

                      {categoryFilterAll !== 'ALL' && (
                        <div className="reference-active-chip">
                          <span className="material-symbols-outlined chip-icon" style={{ color: '#38bdf8' }}>public</span>
                          <span>{categoryFilterAll === 'DR' ? 'Disaster Relief' : 'Charitable Aid'}</span>
                          <button type="button" onClick={() => setCategoryFilterAll('ALL')} title="Remove filter">✕</button>
                        </div>
                      )}

                      {urgencyFilterAll !== 'ALL' && (
                        <div className="reference-active-chip">
                          <span className="material-symbols-outlined chip-icon" style={{ color: '#f59e0b' }}>bolt</span>
                          <span>{urgencyFilterAll === 'HIGH' ? 'High Priority' : urgencyFilterAll === 'MEDIUM' ? 'Medium Priority' : 'Standard Priority'}</span>
                          <button type="button" onClick={() => setUrgencyFilterAll('ALL')} title="Remove filter">✕</button>
                        </div>
                      )}

                      {selectedTagsAll.map((tag) => (
                        <div key={tag} className="reference-active-chip">
                          <span className="material-symbols-outlined chip-icon" style={{ color: '#a855f7' }}>sell</span>
                          <span>#{tag}</span>
                          <button type="button" onClick={() => setSelectedTagsAll(prev => prev.filter(t => t !== tag))} title={`Remove tag #${tag}`}>✕</button>
                        </div>
                      ))}

                      {searchQueryAll.trim() && (
                        <div className="reference-active-chip">
                          <span className="material-symbols-outlined chip-icon" style={{ color: '#94a3b8' }}>search</span>
                          <span>"{searchQueryAll.trim()}"</span>
                          <button type="button" onClick={() => setSearchQueryAll('')} title="Clear search query">✕</button>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setCategoryFilterAll('ALL');
                        setUrgencyFilterAll('ALL');
                        setSelectedTagsAll([]);
                        setSearchQueryAll('');
                      }}
                      className="btn-clear-all-filters-ref"
                      title="Reset all filters and search"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>restart_alt</span>
                      <span>Clear all</span>
                    </button>
                  </div>
                )}
              </div>

              {/* ── Sub-strip Outside and Directly Below the Card: Count on Left, Layout Toggle on Right ── */}
              <div className="campaign-toolbar-substrip">
                <div className="campaign-toolbar-count-tag">
                  <span className="count-indicator-dot" />
                  <span>Showing <strong>{filteredAllCampaigns.length}</strong> of {campaigns.length} campaigns</span>
                </div>

                <div className="filter-layout-segmented-pill" role="group" aria-label="Layout view mode">
                  <button
                    type="button"
                    onClick={() => handleViewModeChangeOrg('list')}
                    className={`layout-seg-btn ${viewModeOrg === 'list' ? 'active' : ''}`}
                    title="List View"
                    aria-label="List View"
                  >
                    <span className="material-symbols-outlined">format_list_bulleted</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleViewModeChangeOrg('grid')}
                    className={`layout-seg-btn ${viewModeOrg === 'grid' || viewModeOrg === 'grid-3' || viewModeOrg === 'grid-2' ? 'active' : ''}`}
                    title="Grid View"
                    aria-label="Grid View"
                  >
                    <span className="material-symbols-outlined">grid_view</span>
                  </button>
                </div>
              </div>

              {filteredAllCampaigns.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📭</div>
                  <div className="empty-title">No campaigns match this category</div>
                  <div className="empty-desc">
                    Try selecting a different category from the dropdown above.
                  </div>
                </div>
              ) : (
                <>
                  <div className={viewModeOrg === 'grid' || viewModeOrg === 'grid-3' || viewModeOrg === 'grid-2' ? 'campaigns-grid' : 'campaigns-list'}>
                    {paginatedAllCampaigns.map((camp) => (
                      <CampaignCard key={camp.id} camp={camp} contract={contract}
                        role={ROLES.ORGANIZATION} walletAddress={walletAddress}
                        onDonated={fetchCampaigns} onDeactivated={fetchCampaigns} onCampaignUpdated={fetchCampaigns} />
                    ))}
                  </div>

                  {/* Centered Pagination Controls */}
                  {totalPagesAll > 1 && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '8px',
                      marginTop: '24px',
                      padding: '12px 0'
                    }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setCurrentPageAll(p => Math.max(1, p - 1))}
                        disabled={currentPageAll === 1}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>chevron_left</span> Previous
                      </button>

                      {Array.from({ length: totalPagesAll }, (_, i) => i + 1).map((pageNum) => (
                        <button
                          key={pageNum}
                          className={`btn btn-sm ${currentPageAll === pageNum ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => setCurrentPageAll(pageNum)}
                          style={{ minWidth: '36px', height: '36px', borderRadius: '8px', fontWeight: currentPageAll === pageNum ? 700 : 400 }}
                        >
                          {pageNum}
                        </button>
                      ))}

                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setCurrentPageAll(p => Math.min(totalPagesAll, p + 1))}
                        disabled={currentPageAll === totalPagesAll}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        Next <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>chevron_right</span>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── 3. MY CAMPAIGNS TAB ── */}
          {activeTab === 'my-campaigns' && (
            <div style={{ marginTop: '8px' }}>
              <div className="section-header">
                <div>
                  <h2 className="section-title" style={{ fontSize: '1.4rem' }}>
                    <span className="material-symbols-outlined section-title-icon" style={{ marginRight: '8px', color: '#0284c7' }}>account_balance</span> My Campaigns
                  </h2>
                  <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '4px' }}>
                    Relief operations deployed under {orgDisplayName} ({shortAddr(walletAddress)}).
                  </p>
                </div>

                <button
                  className="btn btn-ghost btn-sm"
                  onClick={fetchCampaigns}
                  disabled={fetchingCampaigns}
                >
                  {fetchingCampaigns
                    ? <div className="spinner spinner-light" />
                    : '↻ Refresh'}
                </button>
              </div>

              {/* ── Unified Filter, Search & Sort Toolbar ── */}
              <div className="campaign-toolbar-card">
                <div className="campaign-toolbar-unified-row">
                  {/* Left: Section Label & Quick Filter Pills */}
                  <div className="toolbar-filters-left">
                    <div className="toolbar-section-badge">
                      <span className="material-symbols-outlined">filter_list</span>
                      <span>Filters</span>
                    </div>

                    {/* Causes Dropdown Popover */}
                    <div style={{ position: 'relative' }} ref={causesDropdownRefMy}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCausesDropdownMy(prev => !prev);
                          setShowPrioritiesDropdownMy(false);
                          setShowTagsDropdownMy(false);
                          setShowSortDropdownMy(false);
                        }}
                        className={`filter-pill-btn ${categoryFilterMy !== 'ALL' ? 'active-filter' : ''}`}
                        title="Filter by cause type"
                      >
                        <span className="material-symbols-outlined filter-pill-icon" style={{ color: selectedCauseObjMy.color }}>
                          {selectedCauseObjMy.icon}
                        </span>
                        <span>{selectedCauseObjMy.label}</span>
                        <span className="material-symbols-outlined filter-pill-arrow" style={{ position: 'static', marginLeft: '4px' }}>
                          {showCausesDropdownMy ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>

                      {showCausesDropdownMy && (
                        <div className="filter-custom-popover">
                          {CAUSE_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setCategoryFilterMy(opt.value);
                                setShowCausesDropdownMy(false);
                              }}
                              className={`filter-popover-option ${categoryFilterMy === opt.value ? 'selected' : ''}`}
                            >
                              <span className="material-symbols-outlined filter-popover-option-icon" style={{ color: opt.color }}>{opt.icon}</span>
                              <span>{opt.label}</span>
                              {categoryFilterMy === opt.value && (
                                <span className="material-symbols-outlined filter-popover-check">check</span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Priorities Dropdown Popover */}
                    <div style={{ position: 'relative' }} ref={prioritiesDropdownRefMy}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowPrioritiesDropdownMy(prev => !prev);
                          setShowCausesDropdownMy(false);
                          setShowTagsDropdownMy(false);
                          setShowSortDropdownMy(false);
                        }}
                        className={`filter-pill-btn ${urgencyFilterMy !== 'ALL' ? 'active-filter' : ''}`}
                        title="Filter by urgency level"
                      >
                        <span className="material-symbols-outlined filter-pill-icon" style={{ color: selectedPriorityObjMy.color }}>
                          {selectedPriorityObjMy.icon}
                        </span>
                        <span>{selectedPriorityObjMy.label}</span>
                        <span className="material-symbols-outlined filter-pill-arrow" style={{ position: 'static', marginLeft: '4px' }}>
                          {showPrioritiesDropdownMy ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>

                      {showPrioritiesDropdownMy && (
                        <div className="filter-custom-popover">
                          {PRIORITY_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setUrgencyFilterMy(opt.value);
                                setShowPrioritiesDropdownMy(false);
                              }}
                              className={`filter-popover-option ${urgencyFilterMy === opt.value ? 'selected' : ''}`}
                            >
                              <span className="material-symbols-outlined filter-popover-option-icon" style={{ color: opt.color }}>{opt.icon}</span>
                              <span>{opt.label}</span>
                              {urgencyFilterMy === opt.value && (
                                <span className="material-symbols-outlined filter-popover-check">check</span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Tags Dropdown Popover with Checkboxes */}
                    <div style={{ position: 'relative' }} ref={tagsDropdownRefMy}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowTagsDropdownMy(prev => !prev);
                          setShowCausesDropdownMy(false);
                          setShowPrioritiesDropdownMy(false);
                          setShowSortDropdownMy(false);
                        }}
                        className={`filter-pill-btn ${selectedTagsMy.length > 0 ? 'active-filter' : ''}`}
                        title="Filter by tags"
                      >
                        <span className="material-symbols-outlined filter-pill-icon" style={{ color: '#a855f7' }}>sell</span>
                        <span>Tags</span>
                        {selectedTagsMy.length > 0 && (
                          <span className="tags-dropdown-badge-ref">{selectedTagsMy.length}</span>
                        )}
                        <span className="material-symbols-outlined filter-pill-arrow" style={{ position: 'static', marginLeft: '4px' }}>
                          {showTagsDropdownMy ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>

                      {showTagsDropdownMy && (
                        <div className="tags-popover-menu">
                          <div className="tags-popover-header">
                            <span className="tags-popover-title">
                              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>sell</span>
                              Filter by Tags
                            </span>
                            {selectedTagsMy.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setSelectedTagsMy([])}
                                className="tags-popover-clear-btn"
                              >
                                Clear ({selectedTagsMy.length})
                              </button>
                            )}
                          </div>

                          <div className="tags-popover-list">
                            {/* "All Tags" Checkbox */}
                            <label className={`tags-popover-item ${selectedTagsMy.length === 0 ? 'checked' : ''}`}>
                              <input
                                type="checkbox"
                                checked={selectedTagsMy.length === 0}
                                onChange={() => setSelectedTagsMy([])}
                              />
                              <span className="tags-popover-tag-text">All Tags</span>
                              <span className="tags-popover-count">{myCampaigns.length}</span>
                            </label>

                            {/* Individual Tag Checkboxes */}
                            {availableTagsMy.map((tag) => {
                              const isChecked = selectedTagsMy.includes(tag);
                              const count = tagCountsMy[tag] || 0;
                              return (
                                <label key={tag} className={`tags-popover-item ${isChecked ? 'checked' : ''}`}>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      setSelectedTagsMy(prev =>
                                        prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                                      );
                                    }}
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
                        ref={searchInputRefMy}
                        type="text"
                        placeholder="Search my campaigns..."
                        value={searchQueryMy}
                        onChange={(e) => setSearchQueryMy(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') e.target.blur();
                        }}
                        className="filter-search-input-ref"
                      />
                      {searchQueryMy && (
                        <button
                          type="button"
                          onClick={() => setSearchQueryMy('')}
                          className="filter-search-clear-btn-ref"
                          title="Clear search"
                        >
                          ✕
                        </button>
                      )}
                      <kbd className="filter-search-shortcut-badge" title="Press Ctrl+K or ⌘K to focus search">⌘ K</kbd>
                    </div>

                    {/* Sort Pill Popover */}
                    <div style={{ position: 'relative' }} ref={sortDropdownRefMy}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowSortDropdownMy(prev => !prev);
                          setShowCausesDropdownMy(false);
                          setShowPrioritiesDropdownMy(false);
                          setShowTagsDropdownMy(false);
                        }}
                        className="filter-pill-btn"
                        title="Sort campaigns"
                      >
                        <span className="material-symbols-outlined filter-pill-icon" style={{ color: '#94a3b8' }}>swap_vert</span>
                        <span>{selectedSortObjMy.label}</span>
                        <span className="material-symbols-outlined filter-pill-arrow" style={{ position: 'static', marginLeft: '4px' }}>
                          {showSortDropdownMy ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>

                      {showSortDropdownMy && (
                        <div className="filter-custom-popover align-right">
                          {SORT_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setCampaignSortMy(opt.value);
                                setShowSortDropdownMy(false);
                              }}
                              className={`filter-popover-option ${campaignSortMy === opt.value ? 'selected' : ''}`}
                            >
                              <span className="material-symbols-outlined filter-popover-option-icon" style={{ color: '#94a3b8' }}>{opt.icon}</span>
                              <span>{opt.label}</span>
                              {campaignSortMy === opt.value && (
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
                {hasActiveFiltersMy && (
                  <div className="campaign-active-filters-bar">
                    <div className="active-filters-left">
                      <span className="active-filters-label">Active filters:</span>

                      {categoryFilterMy !== 'ALL' && (
                        <div className="reference-active-chip">
                          <span className="material-symbols-outlined chip-icon" style={{ color: '#38bdf8' }}>public</span>
                          <span>{categoryFilterMy === 'DR' ? 'Disaster Relief' : 'Charitable Aid'}</span>
                          <button type="button" onClick={() => setCategoryFilterMy('ALL')} title="Remove filter">✕</button>
                        </div>
                      )}

                      {urgencyFilterMy !== 'ALL' && (
                        <div className="reference-active-chip">
                          <span className="material-symbols-outlined chip-icon" style={{ color: '#f59e0b' }}>bolt</span>
                          <span>{urgencyFilterMy === 'HIGH' ? 'High Priority' : urgencyFilterMy === 'MEDIUM' ? 'Medium Priority' : 'Standard Priority'}</span>
                          <button type="button" onClick={() => setUrgencyFilterMy('ALL')} title="Remove filter">✕</button>
                        </div>
                      )}

                      {selectedTagsMy.map((tag) => (
                        <div key={tag} className="reference-active-chip">
                          <span className="material-symbols-outlined chip-icon" style={{ color: '#a855f7' }}>sell</span>
                          <span>#{tag}</span>
                          <button type="button" onClick={() => setSelectedTagsMy(prev => prev.filter(t => t !== tag))} title={`Remove tag #${tag}`}>✕</button>
                        </div>
                      ))}

                      {searchQueryMy.trim() && (
                        <div className="reference-active-chip">
                          <span className="material-symbols-outlined chip-icon" style={{ color: '#94a3b8' }}>search</span>
                          <span>"{searchQueryMy.trim()}"</span>
                          <button type="button" onClick={() => setSearchQueryMy('')} title="Clear search query">✕</button>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setCategoryFilterMy('ALL');
                        setUrgencyFilterMy('ALL');
                        setSelectedTagsMy([]);
                        setSearchQueryMy('');
                      }}
                      className="btn-clear-all-filters-ref"
                      title="Reset all filters and search"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>restart_alt</span>
                      <span>Clear all</span>
                    </button>
                  </div>
                )}
              </div>

              {/* ── Sub-strip Outside and Directly Below the Card: Count on Left, Layout Toggle on Right ── */}
              <div className="campaign-toolbar-substrip">
                <div className="campaign-toolbar-count-tag">
                  <span className="count-indicator-dot" />
                  <span>Showing <strong>{filteredMyCampaigns.length}</strong> of {myCampaigns.length} campaigns</span>
                </div>

                <div className="filter-layout-segmented-pill" role="group" aria-label="Layout view mode">
                  <button
                    type="button"
                    onClick={() => handleViewModeChangeOrg('list')}
                    className={`layout-seg-btn ${viewModeOrg === 'list' ? 'active' : ''}`}
                    title="List View"
                    aria-label="List View"
                  >
                    <span className="material-symbols-outlined">format_list_bulleted</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleViewModeChangeOrg('grid')}
                    className={`layout-seg-btn ${viewModeOrg === 'grid' || viewModeOrg === 'grid-3' || viewModeOrg === 'grid-2' ? 'active' : ''}`}
                    title="Grid View"
                    aria-label="Grid View"
                  >
                    <span className="material-symbols-outlined">grid_view</span>
                  </button>
                </div>
              </div>

              {myCampaigns.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🚀</div>
                  <div className="empty-title">You haven't created any campaigns yet</div>
                  <div className="empty-desc">
                    Switch to the "Deploy Campaign" tab to publish your first relief operation onto the blockchain.
                  </div>
                </div>
              ) : filteredMyCampaigns.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📭</div>
                  <div className="empty-title">No campaigns match this category</div>
                  <div className="empty-desc">
                    Try selecting a different category from the dropdown above.
                  </div>
                </div>
              ) : (
                <>
                  <div className={viewModeOrg === 'grid' || viewModeOrg === 'grid-3' || viewModeOrg === 'grid-2' ? 'campaigns-grid' : 'campaigns-list'}>
                    {paginatedMyCampaigns.map((camp) => (
                      <CampaignCard key={camp.id} camp={camp} contract={contract}
                        role={ROLES.ORGANIZATION} walletAddress={walletAddress}
                        onDonated={fetchCampaigns} onDeactivated={fetchCampaigns} onCampaignUpdated={fetchCampaigns} />
                    ))}
                  </div>

                  {/* Centered Pagination Controls */}
                  {totalPagesMy > 1 && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '8px',
                      marginTop: '24px',
                      padding: '12px 0'
                    }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setCurrentPageMy(p => Math.max(1, p - 1))}
                        disabled={currentPageMy === 1}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>chevron_left</span> Previous
                      </button>

                      {Array.from({ length: totalPagesMy }, (_, i) => i + 1).map((pageNum) => (
                        <button
                          key={pageNum}
                          className={`btn btn-sm ${currentPageMy === pageNum ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => setCurrentPageMy(pageNum)}
                          style={{ minWidth: '36px', height: '36px', borderRadius: '8px', fontWeight: currentPageMy === pageNum ? 700 : 400 }}
                        >
                          {pageNum}
                        </button>
                      ))}

                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setCurrentPageMy(p => Math.min(totalPagesMy, p + 1))}
                        disabled={currentPageMy === totalPagesMy}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        Next <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>chevron_right</span>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── 4. DEPLOY CAMPAIGN TAB ── */}
          {activeTab === 'create' && (
            <div style={{ marginTop: '8px' }}>
              {currentUser?.verification_status !== 'Approved' ? (
                <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 40px', textAlign: 'center', border: '1px solid rgba(255, 60, 60, 0.4)', background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255, 60, 60, 0.05) 100%)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '56px', color: 'var(--danger)', marginBottom: '16px' }}>gpp_bad</span>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--danger)', marginBottom: '12px' }}>Action Blocked: Pending Verification</h2>
                  <p style={{ color: 'var(--text-secondary)', maxWidth: '550px', lineHeight: '1.6', fontSize: '1.05rem' }}>
                    Your Organization account must be manually verified and <strong>Approved by an Admin</strong> before you are allowed to deploy relief campaigns permanently onto the blockchain.
                  </p>
                  <div style={{ marginTop: '24px', padding: '12px 24px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                      Please check back later or contact the system administrator to expedite your approval.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="card glow fade-in deploy-campaign-card">
                  <div className="section-header" style={{ marginBottom: '16px' }}>
                    <h2 className="section-title">
                      <span className="material-symbols-outlined section-title-icon" style={{ marginRight: '8px' }}>rocket_launch</span> Deploy Relief Campaign
                    </h2>
                    <span className="badge badge-info">NGO Organization Portal</span>
                  </div>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '18px', lineHeight: 1.5 }}>
                    Deploy a new relief operation under your official organization name (<strong>{orgDisplayName}</strong>).{' '}
                    {walletAddress ? (
                      <>This action creates a verified campaign linked to your authorized wallet (<code style={{ fontSize: '0.82rem', color: 'var(--accent)' }}>{shortAddr(walletAddress)}</code>).</>
                    ) : (
                      <>Relief operation details will be published directly to the public humanitarian ledger.</>
                    )}
                  </p>


                  <form className="create-form" onSubmit={handleCreateCampaign} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Section 1: Campaign Essentials */}
                    <div className="deploy-section-card">
                      <div className="deploy-section-header">
                        <div className="deploy-section-title">
                          <span className="material-symbols-outlined deploy-section-icon">campaign</span>
                          <span>1. Basic Campaign Information</span>
                        </div>
                        <span className="deploy-step-pill">Step 1 of 4</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                        {/* Campaign Title (Full Width) */}
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label className="deploy-input-label">
                            Campaign Title *
                          </label>
                          <input className="input deploy-field-input" type="text" required
                            placeholder="e.g., Super Typhoon Emergency Relief Operation"
                            value={title} onChange={(e) => setTitle(e.target.value)} disabled={creating} />
                        </div>

                        {/* Relief Category */}
                        <div>
                          <label className="deploy-input-label">
                            Relief Category *
                          </label>
                          <select
                            className="input deploy-field-input"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            disabled={creating}
                          >
                            <option value="DR">🌊 Disaster Relief (DR)</option>
                            <option value="CD">🤝 Charitable Aid (CD)</option>
                          </select>
                        </div>

                        {/* Fundraising Target (PHP / ₱) */}
                        <div>
                          <label className="deploy-input-label">
                            Fundraising Target (PHP / ₱) *
                          </label>
                          <div className="deploy-currency-wrap">
                            <span className="deploy-currency-prefix">₱</span>
                            <input
                              className="input deploy-field-input deploy-currency-input"
                              type="number"
                              min="100"
                              step="100"
                              required
                              placeholder="e.g., 100,000"
                              value={targetAmount}
                              onChange={(e) => setTargetAmount(e.target.value)}
                              disabled={creating}
                            />
                          </div>
                          {targetAmount && !isNaN(parseFloat(targetAmount)) && parseFloat(targetAmount) > 0 && (
                            <div style={{ marginTop: '4px', fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span>≈ {(parseFloat(targetAmount) / 170000).toFixed(5)} ETH</span>
                              <span>(Crypto Protocol Equivalent)</span>
                            </div>
                          )}
                        </div>

                        {/* Urgency Status */}
                        <div>
                          <label className="deploy-input-label">
                            Urgency Status
                          </label>
                          <select className="input deploy-field-input" value={urgency} onChange={(e) => setUrgency(e.target.value)} disabled={creating}>
                            <option value="HIGH (EMERGENCY AID)">🔴 Emergency High Aid</option>
                            <option value="MEDIUM (URGENT REHABILITATION)">🟡 Urgent Medium Rehabilitation</option>
                            <option value="STABLE (CHARITABLE AID)">🟢 Standard Aid Operation</option>
                          </select>
                        </div>

                        {/* Target Relief Delivery Date */}
                        <div>
                          <label className="deploy-input-label">
                            Target Relief Delivery Date
                          </label>
                          <input
                            className="input deploy-field-input"
                            type="date"
                            min={new Date().toISOString().split('T')[0]}
                            value={targetDate}
                            onChange={(e) => setTargetDate(e.target.value)}
                            disabled={creating}
                          />
                        </div>

                        {/* Estimated Beneficiaries (Full Width) */}
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label className="deploy-input-label">
                            Estimated Beneficiaries / Impact Scope
                          </label>
                          <input className="input deploy-field-input" type="text"
                            placeholder="e.g., ~3,500 Displaced Families across 12 Barangays"
                            value={beneficiariesImpact} onChange={(e) => setBeneficiariesImpact(e.target.value)} disabled={creating} />
                        </div>

                        {/* Campaign Focus Tags */}
                        <div style={{ gridColumn: '1 / -1', marginTop: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <label className="deploy-input-label" style={{ margin: 0 }}>
                              Campaign Operation Tags (Select up to 4 tags to display on the card)
                            </label>
                            <span style={{ fontSize: '0.74rem', color: selectedTags.length >= 4 ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 600 }}>
                              {selectedTags.length}/4 Selected
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {PRESET_CAMPAIGN_TAGS.map((tag) => {
                              const isSelected = selectedTags.includes(tag);
                              return (
                                <button
                                  key={tag}
                                  type="button"
                                  onClick={() => {
                                    if (isSelected) {
                                      setSelectedTags(selectedTags.filter(t => t !== tag));
                                    } else {
                                      if (selectedTags.length >= 4) {
                                        return showWarning('You can select up to 4 tags per campaign.', 'Max Tags Limit');
                                      }
                                      setSelectedTags([...selectedTags, tag]);
                                    }
                                  }}
                                  className={`deploy-tag-chip ${isSelected ? 'active' : ''}`}
                                >
                                  <span>{isSelected ? '✓' : '+'}</span>
                                  <span>{tag}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Target Relief Ground & Interactive Topographic Pin Map */}
                    <div className="deploy-section-card">
                      <div className="deploy-section-header">
                        <div>
                          <div className="deploy-section-title">
                            <span className="material-symbols-outlined deploy-section-icon">explore</span>
                            <span>2. Target Location & Interactive Pin Map</span>
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Pinpoint deployment area on the interactive topographic map. Granular address details update automatically.
                          </div>
                        </div>
                        <span className="deploy-step-pill">Step 2 of 4</span>
                      </div>

                      {/* 2-Column Responsive Layout: Granular Address Details (Left) & Stable Map View (Right) */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '22px', alignItems: 'start' }}>
                        
                        {/* ── Left Column: Granular Address Details ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: '#ef4444' }}>location_on</span>
                              Granular Address Details
                            </div>
                            {(street || barangay || city || province || region || zipCode || landmark || locationRegion || gpsCoordinates) && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                onClick={() => {
                                  setStreet('');
                                  setBarangay('');
                                  setCity('');
                                  setProvince('');
                                  setRegion('');
                                  setZipCode('');
                                  setLandmark('');
                                  setCountry('Philippines');
                                  setLocationRegion('');
                                  setGpsCoordinates('');
                                }}
                                disabled={creating}
                                style={{ fontSize: '0.72rem', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '2px 8px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                title="Clear all address fields"
                              >
                                🧹 Clear
                              </button>
                            )}
                          </div>

                          {/* 1. Street / Building / House No. */}
                          <div>
                            <label className="deploy-input-label">Street / Building / House No.</label>
                            <input
                              className="input deploy-field-input"
                              type="text"
                              placeholder="e.g., Rizal Street, Block 4"
                              value={street}
                              onChange={(e) => {
                                setStreet(e.target.value);
                                setLocationRegion([e.target.value, barangay, city, province, region ? `(${region})` : '', zipCode, country, landmark ? `(Landmark: ${landmark})` : ''].filter(Boolean).join(', '));
                              }}
                              disabled={creating}
                            />
                          </div>

                          {/* 2. Barangay & Municipality / City */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div>
                              <label className="deploy-input-label">Barangay</label>
                              <input
                                className="input deploy-field-input"
                                type="text"
                                placeholder="e.g., Barangay Abgao"
                                value={barangay}
                                onChange={(e) => {
                                  setBarangay(e.target.value);
                                  setLocationRegion([street, e.target.value, city, province, region ? `(${region})` : '', zipCode, country, landmark ? `(Landmark: ${landmark})` : ''].filter(Boolean).join(', '));
                                }}
                                disabled={creating}
                              />
                            </div>
                            <div>
                              <label className="deploy-input-label">Municipality / City *</label>
                              <input
                                className="input deploy-field-input"
                                type="text"
                                required
                                placeholder="e.g., Maasin City"
                                value={city}
                                onChange={(e) => {
                                  setCity(e.target.value);
                                  setLocationRegion([street, barangay, e.target.value, province, region ? `(${region})` : '', zipCode, country, landmark ? `(Landmark: ${landmark})` : ''].filter(Boolean).join(', '));
                                }}
                                disabled={creating}
                              />
                            </div>
                          </div>

                          {/* 3. Province / State beside and left of Zip / Postal Code */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div>
                              <label className="deploy-input-label">Province / State *</label>
                              <input
                                className="input deploy-field-input"
                                type="text"
                                required
                                placeholder="e.g., Southern Leyte"
                                value={province}
                                onChange={(e) => {
                                  const provVal = e.target.value;
                                  setProvince(provVal);
                                  const autoReg = getRegionForProvince(provVal);
                                  if (autoReg) setRegion(autoReg);
                                  setLocationRegion([street, barangay, city, provVal, (autoReg || region) ? `(${autoReg || region})` : '', zipCode, country, landmark ? `(Landmark: ${landmark})` : ''].filter(Boolean).join(', '));
                                }}
                                disabled={creating}
                              />
                            </div>
                            <div>
                              <label className="deploy-input-label">Zip / Postal Code</label>
                              <input
                                className="input deploy-field-input"
                                type="text"
                                placeholder="e.g., 6600"
                                value={zipCode}
                                onChange={(e) => {
                                  setZipCode(e.target.value);
                                  setLocationRegion([street, barangay, city, province, region ? `(${region})` : '', e.target.value, country, landmark ? `(Landmark: ${landmark})` : ''].filter(Boolean).join(', '));
                                }}
                                disabled={creating}
                              />
                            </div>
                          </div>

                          {/* 4. Region & Country */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                            <div>
                              <label className="deploy-input-label">Region *</label>
                              <input
                                className="input deploy-field-input"
                                type="text"
                                required
                                list="ph-region-options"
                                placeholder="e.g., Region VIII (Eastern Visayas)"
                                value={region}
                                onChange={(e) => {
                                  const regVal = e.target.value;
                                  setRegion(regVal);
                                  setLocationRegion([street, barangay, city, province, regVal ? `(${regVal})` : '', zipCode, country, landmark ? `(Landmark: ${landmark})` : ''].filter(Boolean).join(', '));
                                }}
                                disabled={creating}
                              />
                              <datalist id="ph-region-options">
                                {getRegions().map((r) => (
                                  <option key={r} value={r} />
                                ))}
                              </datalist>
                            </div>
                            <div>
                              <label className="deploy-input-label">Country</label>
                              <input
                                className="input deploy-field-input"
                                type="text"
                                placeholder="e.g., Philippines"
                                value={country}
                                onChange={(e) => {
                                  setCountry(e.target.value);
                                  setLocationRegion([street, barangay, city, province, region ? `(${region})` : '', zipCode, e.target.value, landmark ? `(Landmark: ${landmark})` : ''].filter(Boolean).join(', '));
                                }}
                                disabled={creating}
                              />
                            </div>
                          </div>

                          {/* 5. Landmark / Evacuation Site */}
                          <div>
                            <label className="deploy-input-label">Landmark / Evacuation Site (Optional)</label>
                            <input
                              className="input deploy-field-input"
                              type="text"
                              placeholder="e.g., Near City Port, Rizal Park, Evacuation Center"
                              value={landmark}
                              onChange={(e) => {
                                setLandmark(e.target.value);
                                setLocationRegion([street, barangay, city, province, region ? `(${region})` : '', zipCode, country, e.target.value ? `(Landmark: ${e.target.value})` : ''].filter(Boolean).join(', '));
                              }}
                              disabled={creating}
                            />
                          </div>

                          {/* 5. Find Location button below the address input form */}
                          <button
                            type="button"
                            className="btn"
                            onClick={() => {
                              const searchAddress = [street, barangay, city, province, region, country].filter(Boolean).join(', ');
                              if (!city && !province && !searchAddress) {
                                return showWarning('Please enter at least a Municipality/City or Province to locate on map.', 'Location Required');
                              }
                              setIsFindingLocation(true);
                              setMapSearchTrigger({
                                structured: { street, barangay, city, province, region, country, landmark },
                                query: searchAddress,
                                ts: Date.now()
                              });
                            }}
                            disabled={creating || isFindingLocation}
                            style={{
                              width: '100%',
                              padding: '11px 18px',
                              fontSize: '0.9rem',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px',
                              borderRadius: '10px',
                              marginTop: '2px',
                              background: '#ffffff',
                              color: '#0f172a',
                              border: '1.5px solid #cbd5e1',
                              cursor: isFindingLocation ? 'wait' : 'pointer',
                              transition: 'all 0.2s ease',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.18)'
                            }}
                            title="Search and pin location on map"
                          >
                            {isFindingLocation ? (
                              <>
                                <span className="material-symbols-outlined spin" style={{ fontSize: '1.25rem', color: '#16a34a' }}>progress_activity</span>
                                <span style={{ color: '#0f172a' }}>Pinpointing Location on Map...</span>
                              </>
                            ) : (
                              <>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.25rem', color: '#16a34a' }}>explore</span>
                                <span style={{ color: '#0f172a' }}>Find Location</span>
                              </>
                            )}
                          </button>

                          {/* Formatted Full Address & GPS Badge */}
                          <div style={{
                            background: 'var(--bg-subcard)',
                            border: '1px solid var(--border)',
                            borderRadius: '10px',
                            padding: '12px 14px',
                            marginTop: '6px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '10px'
                          }}>
                            <div style={{ flex: 1, minWidth: '180px' }}>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                📍 Confirmed Deployment Address:
                              </div>
                              <div style={{ fontSize: '0.84rem', fontWeight: 700, color: locationRegion ? 'var(--text-primary)' : 'var(--text-muted)', marginTop: '2px', wordBreak: 'break-word' }}>
                                {locationRegion || 'Fill inputs above or select a point on the map →'}
                              </div>
                            </div>
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              background: 'var(--accent-dim)',
                              color: 'var(--accent)',
                              padding: '4px 10px',
                              borderRadius: '8px',
                              fontSize: '0.76rem',
                              fontWeight: 700,
                              border: '1px solid var(--accent-glow, rgba(34,197,94,0.3))',
                              whiteSpace: 'nowrap'
                            }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>my_location</span>
                              <span>GPS: {gpsCoordinates || '10.1333° N, 124.8667° E'}</span>
                            </div>
                          </div>
                        </div>

                        {/* ── Right Column: Square Leaflet Map View ── */}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: 'var(--accent)' }}>pin_drop</span>
                              Deployment Topo Map
                            </span>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                color: 'var(--accent)',
                                background: 'var(--accent-dim)',
                                border: '1px solid var(--accent-glow, rgba(34,197,94,0.25))',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>sync</span>
                              Auto-Sync Pin
                            </span>
                          </div>

                          <div style={{
                            height: '470px',
                            minHeight: '470px',
                            maxHeight: '470px',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            border: '1px solid var(--border)',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                            background: 'var(--bg-subcard)',
                            position: 'relative',
                            display: 'flex',
                            flexDirection: 'column'
                          }}>
                            <LocationMapPicker
                              address={locationRegion}
                              gps={gpsCoordinates}
                              onChangeAddress={(addr) => setLocationRegion(addr)}
                              onChangeGranularAddress={handleGranularAddressFromMap}
                              onChangeGps={(coords) => setGpsCoordinates(coords)}
                              onLocationFound={(res) => {
                                setIsFindingLocation(false);
                                showSuccess(
                                  `Location found: ${res.name || res.display_name?.split(',')[0] || 'Map pinned successfully'}.`,
                                  'Map Pinpoint Complete'
                                );
                                if (!zipCode && res.address?.postcode) {
                                  setZipCode(res.address.postcode);
                                }
                              }}
                              onSearchStatus={(status) => {
                                setIsFindingLocation(false);
                                if (!status.success) {
                                  showWarning(
                                    'Could not pinpoint exact address on map. Please verify City / Province or click directly on the map.',
                                    'Location Search'
                                  );
                                }
                              }}
                              height="470px"
                              hideTip={true}
                              hideSearch={true}
                              searchTrigger={mapSearchTrigger}
                              theme={theme}
                              markerShape="redPin"
                              defaultLayer="street"
                            />
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* Section 3: Purpose & Contact */}
                    <div className="deploy-section-card">
                      <div className="deploy-section-header">
                        <div className="deploy-section-title">
                          <span className="material-symbols-outlined deploy-section-icon">contact_support</span>
                          <span>3. Mission Purpose & Emergency Contact</span>
                        </div>
                        <span className="deploy-step-pill">Step 3 of 4</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '14px' }}>
                        <div>
                          <label className="deploy-input-label">
                            Emergency Contact Hotline / Email
                          </label>
                          <input className="input deploy-field-input" type="text"
                            placeholder="e.g., relief@redcross.org.ph • (053) 570-8899"
                            value={contactInfo} onChange={(e) => setContactInfo(e.target.value)} disabled={creating} />
                        </div>

                        <div>
                          <label className="deploy-input-label">
                            Official Document / Verification Link (Optional)
                          </label>
                          <input className="input deploy-field-input" type="url"
                            placeholder="e.g., https://redcross.org.ph/press-release-102"
                            value={documentUrl} onChange={(e) => setDocumentUrl(e.target.value)} disabled={creating} />
                        </div>
                      </div>

                      <div>
                        <label className="deploy-input-label">
                          Mission & Campaign Description
                        </label>
                        <textarea
                          className="input deploy-field-input"
                          rows="3"
                          placeholder="Provide mission background, emergency relief scope, and on-ground deployment plan..."
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          disabled={creating}
                          style={{ width: '100%', resize: 'none' }}
                        />
                      </div>
                    </div>

                    {/* Section 4: Official Multi-Channel E-Wallet & Bank Settings */}
                    {(() => {
                      const profileReliefData = getProfileReliefChannels();
                      return (
                        <div className="deploy-section-card">
                          <div className="deploy-section-header" style={{ marginBottom: '14px' }}>
                            <div>
                              <div className="deploy-section-title">
                                <span className="material-symbols-outlined deploy-section-icon">account_balance_wallet</span>
                                <span>4. Official Multi-Channel Payment Settings</span>
                              </div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                                Configure receiving channels for donors contributing via GCash, Maya, or direct Bank Transfer.
                              </div>
                            </div>
                            <span className="deploy-step-pill">Step 4 of 4</span>
                          </div>

                          {/* Payment Channel Switcher & Actions Toolbar */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px',
                            marginBottom: '16px',
                            flexWrap: 'wrap'
                          }}>
                            {/* Segmented Pill Tab Selector */}
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              background: 'var(--bg-subcard, rgba(255, 255, 255, 0.05))',
                              padding: '4px',
                              borderRadius: '12px',
                              border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
                              gap: '4px',
                              maxWidth: '100%',
                              overflowX: 'auto'
                            }}>
                              <button
                                type="button"
                                onClick={() => setActivePaymentChannelTab('gcash')}
                                style={{
                                  padding: '7px 18px',
                                  borderRadius: '8px',
                                  border: 'none',
                                  background: activePaymentChannelTab === 'gcash' ? '#007DFE' : 'transparent',
                                  color: activePaymentChannelTab === 'gcash' ? '#ffffff' : 'var(--text-secondary)',
                                  fontSize: '0.82rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  transition: 'all 0.15s ease',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                <span style={{
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '50%',
                                  background: (gcashNumber || gcashQrUrl || gcashName) ? (activePaymentChannelTab === 'gcash' ? '#ffffff' : '#22c55e') : 'rgba(255,255,255,0.3)'
                                }} />
                                <span>GCash</span>
                                {(gcashNumber || gcashQrUrl || gcashName) && <span style={{ fontSize: '0.72rem', opacity: 0.9 }}>✓</span>}
                              </button>

                              <button
                                type="button"
                                onClick={() => setActivePaymentChannelTab('maya')}
                                style={{
                                  padding: '7px 18px',
                                  borderRadius: '8px',
                                  border: 'none',
                                  background: activePaymentChannelTab === 'maya' ? '#00b87c' : 'transparent',
                                  color: activePaymentChannelTab === 'maya' ? '#ffffff' : 'var(--text-secondary)',
                                  fontSize: '0.82rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  transition: 'all 0.15s ease',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                <span style={{
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '50%',
                                  background: (mayaNumber || mayaQrUrl || mayaName) ? (activePaymentChannelTab === 'maya' ? '#ffffff' : '#22c55e') : 'rgba(255,255,255,0.3)'
                                }} />
                                <span>Maya</span>
                                {(mayaNumber || mayaQrUrl || mayaName) && <span style={{ fontSize: '0.72rem', opacity: 0.9 }}>✓</span>}
                              </button>

                              <button
                                type="button"
                                onClick={() => setActivePaymentChannelTab('bank')}
                                style={{
                                  padding: '7px 18px',
                                  borderRadius: '8px',
                                  border: 'none',
                                  background: activePaymentChannelTab === 'bank' ? '#16a34a' : 'transparent',
                                  color: activePaymentChannelTab === 'bank' ? '#ffffff' : 'var(--text-secondary)',
                                  fontSize: '0.82rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  transition: 'all 0.15s ease',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                <span style={{
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '50%',
                                  background: (bankAccountNumber || bankQrUrl) ? (activePaymentChannelTab === 'bank' ? '#ffffff' : '#22c55e') : 'rgba(255,255,255,0.3)'
                                }} />
                                <span>Direct Bank Deposit</span>
                                {(bankAccountNumber || bankQrUrl) && <span style={{ fontSize: '0.72rem', opacity: 0.9 }}>✓</span>}
                              </button>
                            </div>

                            {/* Import Verified Channels from Profile */}
                            {profileReliefData.hasAny && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={handleAutofillFromProfile}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  fontSize: '0.78rem',
                                  fontWeight: 600,
                                  padding: '7px 14px',
                                  borderRadius: '8px'
                                }}
                                title="Import verified payment channels and QR codes from your Organization Profile"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--accent)' }}>
                                  sync
                                </span>
                                Import Channels from Profile
                              </button>
                            )}
                          </div>

                          {/* ── 1. GCASH CHANNEL ── */}
                          {activePaymentChannelTab === 'gcash' && (
                            <div
                              className="fade-in"
                              style={{
                                background: 'rgba(0, 125, 254, 0.04)',
                                padding: '18px 20px',
                                borderRadius: '12px',
                                border: '1px solid rgba(0, 125, 254, 0.28)'
                              }}
                            >
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '20px', alignItems: 'stretch' }}>
                                {/* Left Column: GCash Account Details */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                  <div>
                                    <label className="deploy-input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                      <span className="material-symbols-outlined" style={{ color: '#007DFE', fontSize: '18px' }}>badge</span>
                                      Official GCash Account Name
                                    </label>
                                    <input
                                      className="input deploy-field-input"
                                      type="text"
                                      placeholder="e.g., Philippine Red Cross - Southern Leyte"
                                      value={gcashName}
                                      onChange={(e) => setGcashName(e.target.value)}
                                      disabled={creating}
                                    />
                                    <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                                      Registered name displayed on GCash app confirmation.
                                    </span>
                                  </div>

                                  <div>
                                    <label className="deploy-input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                      <span className="material-symbols-outlined" style={{ color: '#007DFE', fontSize: '18px' }}>smartphone</span>
                                      Official GCash Receiving Number
                                    </label>
                                    <input
                                      className="input deploy-field-input"
                                      type="text"
                                      placeholder="e.g., 0917 890 1234"
                                      value={gcashNumber}
                                      onChange={(e) => setGcashNumber(e.target.value)}
                                      disabled={creating}
                                      style={{ fontFamily: 'monospace', fontWeight: 700 }}
                                    />
                                    <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                                      Donors can copy and send funds directly to this GCash account.
                                    </span>
                                  </div>
                                </div>

                                {/* Right Column: GCash QR Code */}
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <label className="deploy-input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                                      <span className="material-symbols-outlined" style={{ color: '#007DFE', fontSize: '18px' }}>qr_code</span>
                                      GCash QR Code Image
                                    </label>
                                    {gcashQrUrl && (
                                      <button
                                        type="button"
                                        onClick={() => setGcashQrUrl('')}
                                        style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.73rem', cursor: 'pointer', fontWeight: 600 }}
                                      >
                                        Remove QR
                                      </button>
                                    )}
                                  </div>

                                  {gcashQrUrl ? (
                                    <div style={{
                                      flex: 1,
                                      minHeight: '140px',
                                      position: 'relative',
                                      borderRadius: '10px',
                                      overflow: 'hidden',
                                      border: '1.5px solid rgba(0, 125, 254, 0.45)',
                                      background: 'var(--bg-subcard)',
                                      padding: '12px',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      textAlign: 'center'
                                    }}>
                                      <img
                                        src={gcashQrUrl}
                                        alt="Organization GCash QR"
                                        style={{ maxHeight: '110px', maxWidth: '100%', objectFit: 'contain', borderRadius: '8px' }}
                                      />
                                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontSize: '0.74rem', color: '#007DFE', fontWeight: 700 }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>verified</span>
                                        GCash QR Attached
                                      </div>
                                    </div>
                                  ) : (
                                    <label style={{
                                      flex: 1,
                                      minHeight: '140px',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      padding: '16px',
                                      border: '1.5px dashed rgba(0, 125, 254, 0.4)',
                                      borderRadius: '10px',
                                      cursor: 'pointer',
                                      background: 'rgba(0, 125, 254, 0.03)',
                                      transition: 'all 0.2s ease',
                                      textAlign: 'center'
                                    }}>
                                      <span className="material-symbols-outlined" style={{ fontSize: '32px', color: '#007DFE', marginBottom: '6px' }}>
                                        qr_code_scanner
                                      </span>
                                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        Upload GCash QR
                                      </span>
                                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                        PNG, JPG or WebP image
                                      </span>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleGcashQrUpload}
                                        style={{ display: 'none' }}
                                        disabled={creating}
                                      />
                                    </label>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* ── 2. MAYA CHANNEL ── */}
                          {activePaymentChannelTab === 'maya' && (
                            <div
                              className="fade-in"
                              style={{
                                background: 'rgba(0, 214, 143, 0.04)',
                                padding: '18px 20px',
                                borderRadius: '12px',
                                border: '1px solid rgba(0, 214, 143, 0.28)'
                              }}
                            >
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '20px', alignItems: 'stretch' }}>
                                {/* Left Column: Maya Account Details */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                  <div>
                                    <label className="deploy-input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                      <span className="material-symbols-outlined" style={{ color: '#00d68f', fontSize: '18px' }}>badge</span>
                                      Official Maya Account Name
                                    </label>
                                    <input
                                      className="input deploy-field-input"
                                      type="text"
                                      placeholder="e.g., Philippine Red Cross or Official Merchant"
                                      value={mayaName}
                                      onChange={(e) => setMayaName(e.target.value)}
                                      disabled={creating}
                                    />
                                    <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                                      Registered merchant or account name inside Maya.
                                    </span>
                                  </div>

                                  <div>
                                    <label className="deploy-input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                      <span className="material-symbols-outlined" style={{ color: '#00d68f', fontSize: '18px' }}>account_circle</span>
                                      Official Maya Number or @Username
                                    </label>
                                    <input
                                      className="input deploy-field-input"
                                      type="text"
                                      placeholder="e.g., 0918 765 4321 or @reliefph"
                                      value={mayaNumber}
                                      onChange={(e) => setMayaNumber(e.target.value)}
                                      disabled={creating}
                                      style={{ fontFamily: 'monospace', fontWeight: 700 }}
                                    />
                                    <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                                      Donors using Maya can transfer directly to this number or username.
                                    </span>
                                  </div>
                                </div>

                                {/* Right Column: Maya QR Code */}
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <label className="deploy-input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                                      <span className="material-symbols-outlined" style={{ color: '#00d68f', fontSize: '18px' }}>qr_code</span>
                                      Maya QR Code Image
                                    </label>
                                    {mayaQrUrl && (
                                      <button
                                        type="button"
                                        onClick={() => setMayaQrUrl('')}
                                        style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.73rem', cursor: 'pointer', fontWeight: 600 }}
                                      >
                                        Remove QR
                                      </button>
                                    )}
                                  </div>

                                  {mayaQrUrl ? (
                                    <div style={{
                                      flex: 1,
                                      minHeight: '140px',
                                      position: 'relative',
                                      borderRadius: '10px',
                                      overflow: 'hidden',
                                      border: '1.5px solid rgba(0, 214, 143, 0.45)',
                                      background: 'var(--bg-subcard)',
                                      padding: '12px',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      textAlign: 'center'
                                    }}>
                                      <img
                                        src={mayaQrUrl}
                                        alt="Organization Maya QR"
                                        style={{ maxHeight: '110px', maxWidth: '100%', objectFit: 'contain', borderRadius: '8px' }}
                                      />
                                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontSize: '0.74rem', color: '#00d68f', fontWeight: 700 }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>verified</span>
                                        Maya QR Attached
                                      </div>
                                    </div>
                                  ) : (
                                    <label style={{
                                      flex: 1,
                                      minHeight: '140px',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      padding: '16px',
                                      border: '1.5px dashed rgba(0, 214, 143, 0.4)',
                                      borderRadius: '10px',
                                      cursor: 'pointer',
                                      background: 'rgba(0, 214, 143, 0.03)',
                                      transition: 'all 0.2s ease',
                                      textAlign: 'center'
                                    }}>
                                      <span className="material-symbols-outlined" style={{ fontSize: '32px', color: '#00d68f', marginBottom: '6px' }}>
                                        qr_code_scanner
                                      </span>
                                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        Upload Maya QR
                                      </span>
                                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                        PNG, JPG or WebP image
                                      </span>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleMayaQrUpload}
                                        style={{ display: 'none' }}
                                        disabled={creating}
                                      />
                                    </label>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* ── 3. DIRECT BANK DEPOSIT CHANNEL ── */}
                          {activePaymentChannelTab === 'bank' && (
                            <div
                              className="fade-in"
                              style={{
                                background: 'rgba(22, 163, 74, 0.04)',
                                padding: '18px 20px',
                                borderRadius: '12px',
                                border: '1px solid rgba(22, 163, 74, 0.28)'
                              }}
                            >
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '20px', alignItems: 'stretch' }}>
                                {/* Left Column: Bank Account Details */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                  <div>
                                    <label className="deploy-input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                      <span className="material-symbols-outlined" style={{ color: 'var(--accent)', fontSize: '18px' }}>account_balance</span>
                                      Bank Name
                                    </label>
                                    <input
                                      className="input deploy-field-input"
                                      list="ph-bank-options"
                                      placeholder="e.g., BDO Unibank, BPI, Landbank"
                                      value={bankName}
                                      onChange={(e) => setBankName(e.target.value)}
                                      disabled={creating}
                                    />
                                    <datalist id="ph-bank-options">
                                      <option value="BDO Unibank" />
                                      <option value="BPI (Bank of the Philippine Islands)" />
                                      <option value="Land Bank of the Philippines (LBP)" />
                                      <option value="UnionBank of the Philippines" />
                                      <option value="Metrobank" />
                                      <option value="Security Bank" />
                                      <option value="RCBC" />
                                      <option value="PNB (Philippine National Bank)" />
                                      <option value="China Bank" />
                                      <option value="Development Bank of the Philippines (DBP)" />
                                    </datalist>
                                  </div>

                                  <div>
                                    <label className="deploy-input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                      <span className="material-symbols-outlined" style={{ color: 'var(--accent)', fontSize: '18px' }}>person</span>
                                      Account Beneficiary Name
                                    </label>
                                    <input
                                      className="input deploy-field-input"
                                      type="text"
                                      placeholder="e.g., ReliefLink Foundation Inc."
                                      value={bankAccountName}
                                      onChange={(e) => setBankAccountName(e.target.value)}
                                      disabled={creating}
                                    />
                                  </div>

                                  <div>
                                    <label className="deploy-input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                      <span className="material-symbols-outlined" style={{ color: 'var(--accent)', fontSize: '18px' }}>numbers</span>
                                      Account Number
                                    </label>
                                    <input
                                      className="input deploy-field-input"
                                      type="text"
                                      placeholder="e.g., 0012 3456 7890"
                                      value={bankAccountNumber}
                                      onChange={(e) => setBankAccountNumber(e.target.value)}
                                      disabled={creating}
                                      style={{ fontFamily: 'monospace', fontWeight: 700 }}
                                    />
                                  </div>
                                </div>

                                {/* Right Column: Bank QR / InstaPay */}
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <label className="deploy-input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                                      <span className="material-symbols-outlined" style={{ color: 'var(--accent)', fontSize: '18px' }}>qr_code</span>
                                      Bank Transfer QR / InstaPay QR (Optional)
                                    </label>
                                    {bankQrUrl && (
                                      <button
                                        type="button"
                                        onClick={() => setBankQrUrl('')}
                                        style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.73rem', cursor: 'pointer', fontWeight: 600 }}
                                      >
                                        Remove QR
                                      </button>
                                    )}
                                  </div>

                                  {bankQrUrl ? (
                                    <div style={{
                                      flex: 1,
                                      minHeight: '140px',
                                      position: 'relative',
                                      borderRadius: '10px',
                                      overflow: 'hidden',
                                      border: '1.5px solid var(--accent)',
                                      background: 'var(--bg-subcard)',
                                      padding: '12px',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      textAlign: 'center'
                                    }}>
                                      <img
                                        src={bankQrUrl}
                                        alt="Organization Bank QR"
                                        style={{ maxHeight: '110px', maxWidth: '100%', objectFit: 'contain', borderRadius: '8px' }}
                                      />
                                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontSize: '0.74rem', color: 'var(--accent)', fontWeight: 700 }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>verified</span>
                                        Bank QR Attached
                                      </div>
                                    </div>
                                  ) : (
                                    <label style={{
                                      flex: 1,
                                      minHeight: '140px',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      padding: '16px',
                                      border: '1.5px dashed rgba(22, 163, 74, 0.4)',
                                      borderRadius: '10px',
                                      cursor: 'pointer',
                                      background: 'rgba(22, 163, 74, 0.03)',
                                      transition: 'all 0.2s ease',
                                      textAlign: 'center'
                                    }}>
                                      <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'var(--accent)', marginBottom: '6px' }}>
                                        account_balance
                                      </span>
                                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        Upload Bank / InstaPay QR
                                      </span>
                                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                        PNG, JPG or WebP image
                                      </span>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleBankQrUpload}
                                        style={{ display: 'none' }}
                                        disabled={creating}
                                      />
                                    </label>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                        </div>
                      );
                    })()}

                    {/* Submit Bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                      <button type="submit" className="btn btn-primary pulse" disabled={creating} style={{ padding: '12px 28px', fontSize: '0.95rem' }}>
                        {creating ? (
                          <><div className="spinner" /> Deploying Campaign…</>
                        ) : (
                          '🚀 Confirm & Deploy Campaign'
                        )}
                      </button>

                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', background: 'var(--bg-subcard)', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#10b981' }}>verified_user</span>
                        <span>Official NGO Release: Verified relief deployment recorded on disaster ledger.</span>
                      </div>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* ── 5. DONATION LEDGER TAB ── */}
          {activeTab === 'ledger' && (
            <div style={{ marginTop: '8px' }}>
              <div className="section-header">
                <div>
                  <h2 className="section-title" style={{ fontSize: '1.4rem' }}>
                    <span className="material-symbols-outlined section-title-icon" style={{ marginRight: '8px', color: '#0284c7' }}>receipt_long</span> Organization Donation Ledger
                  </h2>
                  <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '4px' }}>
                    Real-time transaction receipts for contributions received by {orgDisplayName}.
                  </p>
                </div>

                <button className="btn btn-ghost btn-sm" onClick={fetchOrgDonations} disabled={loadingOrgDonations}>
                  {loadingOrgDonations ? <div className="spinner spinner-light" /> : '↻ Sync Ledger'}
                </button>
              </div>

              {/* ── Pending Manual Donations Section (Capstone) ── */}
              <div style={{ marginBottom: '40px', background: 'rgba(56, 189, 248, 0.03)', border: '1px solid rgba(56, 189, 248, 0.15)', padding: '24px', borderRadius: '16px' }}>
                <h3 style={{ marginTop: 0, marginBottom: '16px', display: 'flex', alignItems: 'center', fontSize: '1.1rem', color: '#38bdf8' }}>
                  <span className="material-symbols-outlined" style={{ marginRight: '8px' }}>pending_actions</span>
                  Pending Fiat Verifications (Off-Chain)
                </h3>

                {loadingPending ? (
                  <div style={{ textAlign: 'center', padding: '20px' }}><div className="spinner spinner-light" /></div>
                ) : pendingDonations.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>No pending fiat donations require verification.</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table" style={{ minWidth: '800px', fontSize: '0.85rem' }}>
                      <thead>
                        <tr>
                          <th>Donor</th>
                          <th>Campaign</th>
                          <th>Method</th>
                          <th>Amount (ETH)</th>
                          <th>Receipt</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingDonations.map((d) => (
                          <tr key={d.Manual_ID}>
                            <td>{d.Donor_Name || 'Anonymous'}</td>
                            <td>{d.Campaign_Title}</td>
                            <td><span style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', fontSize: '0.75rem' }}>{d.Payment_Method}</span></td>
                            <td style={{ color: '#00ffa3', fontWeight: 'bold' }}>{parseFloat(d.Amount).toFixed(4)} ETH</td>
                            <td>
                              {d.Receipt_Base64 ? (
                                <a href={d.Receipt_Base64} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline' }}>View Screenshot</a>
                              ) : (
                                <span style={{ color: '#64748b' }}>No Image</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button className="btn btn-sm" style={{ background: '#10b981', color: '#fff', border: 'none' }} onClick={() => handleVerifyDonation(d.Manual_ID, 'approve')}>Approve</button>
                              <button className="btn btn-sm" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.5)' }} onClick={() => handleVerifyDonation(d.Manual_ID, 'reject')}>Reject</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Filter & Sort Toolbar */}
              {orgDonations && orgDonations.length > 0 && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  marginTop: '16px',
                  marginBottom: '20px',
                  flexWrap: 'wrap',
                  background: 'rgba(15, 23, 42, 0.4)',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.06)'
                }}>
                  {/* Search Input */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 240px', minWidth: '220px' }}>
                    <div style={{ position: 'relative', width: '100%' }}>
                      <span className="material-symbols-outlined" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '1.1rem', pointerEvents: 'none' }}>
                        search
                      </span>
                      <input
                        type="text"
                        placeholder="Search tx hash or campaign..."
                        value={searchQueryLedger}
                        onChange={(e) => setSearchQueryLedger(e.target.value)}
                        style={{
                          width: '100%',
                          background: 'rgba(30, 41, 59, 0.9)',
                          color: '#fff',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          borderRadius: '8px',
                          padding: '7px 30px 7px 34px',
                          fontSize: '0.85rem',
                          outline: 'none'
                        }}
                      />
                      {searchQueryLedger && (
                        <button
                          onClick={() => setSearchQueryLedger('')}
                          style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem', padding: 0 }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 600 }}>Filter Category:</span>
                    <select
                      value={ledgerFilter}
                      onChange={(e) => setLedgerFilter(e.target.value)}
                      style={{
                        background: 'rgba(30, 41, 59, 0.9)',
                        color: '#fff',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '8px',
                        padding: '6px 14px',
                        fontSize: '0.85rem',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="ALL">All Transactions ({orgDonations.length})</option>
                      <option value="DR">🌊 Disaster Relief (DR)</option>
                      <option value="CD">🤝 Charitable Aid (CD)</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 600 }}>Sort Amount:</span>
                    <select
                      value={ledgerSort}
                      onChange={(e) => setLedgerSort(e.target.value)}
                      style={{
                        background: 'rgba(30, 41, 59, 0.9)',
                        color: '#fff',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '8px',
                        padding: '6px 14px',
                        fontSize: '0.85rem',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="NEWEST">Newest First</option>
                      <option value="AMOUNT_HIGH">Amount: High to Low</option>
                      <option value="AMOUNT_LOW">Amount: Low to High</option>
                    </select>
                  </div>
                </div>
              )}

              {!orgDonations || orgDonations.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📜</div>
                  <div className="empty-title">No transactions recorded yet</div>
                  <div className="empty-desc">
                    When donors contribute to your relief campaigns, immutable receipts will appear here in real time.
                  </div>
                </div>
              ) : filteredLedger.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📭</div>
                  <div className="empty-title">No transactions match this category</div>
                  <div className="empty-desc">
                    Try selecting a different category from the dropdown above.
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {paginatedLedger.map((d, idx) => {
                      const matchCamp = campaigns.find(c => String(c.id) === String(d.campaignId));
                      const rawTitle = matchCamp ? matchCamp.title : `Disaster Relief Campaign #${d.campaignId}`;
                      const campTitle = formatCampaignTitle(rawTitle, d.campaignId);
                      const isCharity = /charity|school|orphan|food|feed|community|aid|blood|medical/i.test(campTitle);
                      const catCode = isCharity ? `CD-00${d.campaignId}` : `DR-00${d.campaignId}`;
                      const catLabel = isCharity ? 'Charitable Aid' : 'Disaster Relief';

                      return (
                        <div
                          key={idx}
                          className="card glow fade-in"
                          style={{
                            padding: '18px 22px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                            background: 'rgba(15, 23, 42, 0.65)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '14px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                <span className={`badge ${isCharity ? 'badge-info' : 'badge-warning'}`} style={{ fontSize: '0.7rem' }}>
                                  {catCode} • {catLabel}
                                </span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>
                                  ✓ Verified On-Chain
                                </span>
                              </div>
                              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#ffffff', fontWeight: 600 }}>
                                {campTitle}
                              </h3>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--success)' }}>
                                +{d.amount} <span style={{ fontSize: '0.85rem' }}>ETH</span>
                              </div>
                              <div style={{ fontSize: '0.82rem', color: '#38bdf8', fontWeight: 500, marginTop: '2px' }}>
                                ≈ ₱{(parseFloat(d.amount) * 170000).toLocaleString('en-US', { maximumFractionDigits: 2 })} PHP
                              </div>
                            </div>
                          </div>

                          <div style={{
                            paddingTop: '10px',
                            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                            display: 'flex',
                            justify: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '8px',
                            fontSize: '0.78rem'
                          }}>
                            <div style={{ fontFamily: 'monospace', color: '#94a3b8' }}>
                              <span style={{ color: '#cbd5e1' }}>Tx Hash:</span> {d.txHash.slice(0, 18)}…{d.txHash.slice(-8)}
                            </div>

                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => {
                                  navigator.clipboard.writeText(d.txHash);
                                  showSuccess('Transaction hash copied to clipboard!', 'Hash Copied');
                                }}
                                style={{ padding: '3px 10px', fontSize: '0.75rem' }}
                              >
                                📋 Copy
                              </button>
                              <a
                                href={`https://sepolia.etherscan.io/tx/${d.txHash}`}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-outline btn-sm"
                                style={{ padding: '3px 10px', fontSize: '0.75rem' }}
                              >
                                ↗ Etherscan
                              </a>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Centered Pagination Controls */}
                  {totalPagesLedger > 1 && (
                    <div style={{
                      display: 'flex',
                      justify: 'center',
                      alignItems: 'center',
                      gap: '8px',
                      marginTop: '24px',
                      padding: '12px 0'
                    }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setCurrentPageLedger(p => Math.max(1, p - 1))}
                        disabled={currentPageLedger === 1}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>chevron_left</span> Previous
                      </button>

                      {Array.from({ length: totalPagesLedger }, (_, i) => i + 1).map((pageNum) => (
                        <button
                          key={pageNum}
                          className={`btn btn-sm ${currentPageLedger === pageNum ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => setCurrentPageLedger(pageNum)}
                          style={{ minWidth: '36px', height: '36px', borderRadius: '8px', fontWeight: currentPageLedger === pageNum ? 700 : 400 }}
                        >
                          {pageNum}
                        </button>
                      ))}

                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setCurrentPageLedger(p => Math.min(totalPagesLedger, p + 1))}
                        disabled={currentPageLedger === totalPagesLedger}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        Next <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>chevron_right</span>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── 5.5. SEC ACCREDITATION & INSTITUTIONAL KYC CENTER (POST-SIGNUP) ── */}
          {activeTab === 'sec-kyc' && (
            <div style={{ marginTop: '8px' }}>
              <div className="section-header">
                <div>
                  <h2 className="section-title" style={{ fontSize: '1.4rem' }}>
                    <span className="material-symbols-outlined section-title-icon" style={{ marginRight: '8px', color: '#38bdf8' }}>verified_user</span>
                    Institutional SEC Non-Profit Accreditation Center
                  </h2>
                  <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '4px' }}>
                    Philippine Non-Stock Corporation & DSWD Disaster Relief Operations KYC Compliance Portal
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button className="btn btn-ghost btn-sm" onClick={fetchKycData} disabled={kycLoading}>
                    {kycLoading ? <div className="spinner spinner-light" /> : '↻ Refresh Status'}
                  </button>
                  <button
                    type="button"
                    onClick={handleAutofillDemoSec}
                    style={{
                      background: 'rgba(56, 189, 248, 0.12)',
                      border: '1px solid rgba(56, 189, 248, 0.35)',
                      color: '#38bdf8',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      padding: '6px 14px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>bolt</span>
                    ⚡ Demo SEC Credentials
                  </button>
                </div>
              </div>

              {/* 4-Step Milestone Status Tracker */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '20px',
                marginBottom: '24px'
              }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>
                  Accreditation Verification Milestones
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                  {/* Step 1 */}
                  <div style={{ background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.25)', padding: '12px', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#22c55e', fontSize: '0.78rem', fontWeight: 700 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check_circle</span>
                      1. Account Created
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px' }}>Official NGO Email Verified</div>
                  </div>

                  {/* Step 2 */}
                  <div style={{
                    background: (secRegNo || secCertUrl) ? 'rgba(34, 197, 94, 0.08)' : 'rgba(234, 179, 8, 0.08)',
                    border: (secRegNo || secCertUrl) ? '1px solid rgba(34, 197, 94, 0.25)' : '1px solid rgba(234, 179, 8, 0.25)',
                    padding: '12px',
                    borderRadius: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: (secRegNo || secCertUrl) ? '#22c55e' : '#facc15', fontSize: '0.78rem', fontWeight: 700 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                        {(secRegNo || secCertUrl) ? 'check_circle' : 'pending'}
                      </span>
                      2. SEC Documents
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px' }}>
                      {(secRegNo || secCertUrl) ? 'Certificate Attached' : 'Awaiting Submission'}
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div style={{
                    background: (kycStatusData?.Verification_Status === 'Approved') ? 'rgba(34, 197, 94, 0.08)' : (kycStatusData?.Verification_Status === 'Rejected' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(56, 189, 248, 0.08)'),
                    border: (kycStatusData?.Verification_Status === 'Approved') ? '1px solid rgba(34, 197, 94, 0.25)' : (kycStatusData?.Verification_Status === 'Rejected' ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(56, 189, 248, 0.25)'),
                    padding: '12px',
                    borderRadius: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: (kycStatusData?.Verification_Status === 'Approved') ? '#22c55e' : (kycStatusData?.Verification_Status === 'Rejected' ? '#ef4444' : '#38bdf8'), fontSize: '0.78rem', fontWeight: 700 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                        {(kycStatusData?.Verification_Status === 'Approved') ? 'check_circle' : (kycStatusData?.Verification_Status === 'Rejected' ? 'cancel' : 'psychology')}
                      </span>
                      3. AI Vision Audit
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px' }}>
                      {(kycStatusData?.Verification_Status === 'Approved') ? 'Gemini AI Verified' : (kycStatusData?.Verification_Status === 'Rejected' ? 'Rubric Check Failed' : 'Autonomous AI Inspection')}
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div style={{
                    background: (kycStatusData?.Verification_Status === 'Approved') ? 'rgba(34, 197, 94, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                    border: (kycStatusData?.Verification_Status === 'Approved') ? '1px solid rgba(34, 197, 94, 0.25)' : '1px solid rgba(255, 255, 255, 0.08)',
                    padding: '12px',
                    borderRadius: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: (kycStatusData?.Verification_Status === 'Approved') ? '#22c55e' : '#64748b', fontSize: '0.78rem', fontWeight: 700 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                        {(kycStatusData?.Verification_Status === 'Approved') ? 'lock_open' : 'lock'}
                      </span>
                      4. Campaign Deploy
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px' }}>
                      {(kycStatusData?.Verification_Status === 'Approved') ? 'Blockchain Authorized' : 'Unlocked on Approval'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Verified Certificate Shield (If Approved) */}
              {kycStatusData?.Verification_Status === 'Approved' ? (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(56, 189, 248, 0.08) 100%)',
                  border: '1.5px solid rgba(34, 197, 94, 0.4)',
                  borderRadius: '16px',
                  padding: '28px',
                  marginBottom: '30px',
                  textAlign: 'center',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
                }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(34, 197, 94, 0.2)', color: '#22c55e', marginBottom: '14px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '36px' }}>verified</span>
                  </div>
                  <h3 style={{ margin: 0, fontSize: '1.3rem', color: '#22c55e', fontWeight: 800 }}>
                    Official SEC Accredited Non-Profit Corporation
                  </h3>
                  <p style={{ color: '#cbd5e1', fontSize: '0.85rem', maxWidth: '600px', margin: '8px auto 16px auto' }}>
                    This organization is formally verified under Philippine Securities and Exchange Commission (SEC) eSPARC guidelines as a Non-Stock, Non-Profit Humanitarian Institution.
                  </p>

                  <div style={{ display: 'inline-flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', padding: '12px 24px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.82rem' }}>
                    <div><span style={{ color: '#94a3b8' }}>SEC Reg No:</span> <strong style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{secRegNo || kycStatusData?.secRegistrationNo || 'SEC-CN2021-08492'}</strong></div>
                    <div><span style={{ color: '#94a3b8' }}>DSWD Permit:</span> <strong style={{ color: '#ffffff' }}>{dswdNo || kycStatusData?.dswdAccreditationNo || 'DSWD-SB-A-2024-0193'}</strong></div>
                    <div><span style={{ color: '#94a3b8' }}>Auditor:</span> <strong style={{ color: '#38bdf8' }}>{kycStatusData?.verifiedBy || 'AI_GEMINI_VISION'}</strong></div>
                    <div><span style={{ color: '#94a3b8' }}>Verified Date:</span> <strong style={{ color: '#22c55e' }}>{kycStatusData?.verifiedAt ? new Date(kycStatusData.verifiedAt).toLocaleDateString() : 'Active'}</strong></div>
                  </div>

                  {secCertUrl && (
                    <div style={{ marginTop: '18px' }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => setViewingKycCert(true)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>visibility</span>
                        Inspect Official SEC Certificate Document
                      </button>
                    </div>
                  )}
                </div>
              ) : null}

              {/* Rejection Notice Banner (If Rejected) */}
              {kycStatusData?.Verification_Status === 'Rejected' && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1.5px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: '14px',
                  padding: '18px 24px',
                  marginBottom: '24px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '14px'
                }}>
                  <span className="material-symbols-outlined" style={{ color: '#ef4444', fontSize: '28px', marginTop: '2px' }}>error</span>
                  <div>
                    <div style={{ color: '#ef4444', fontWeight: 800, fontSize: '0.95rem' }}>
                      AI Verification Notice: Correction Required
                    </div>
                    <p style={{ color: '#cbd5e1', fontSize: '0.82rem', margin: '4px 0 0 0', lineHeight: 1.5 }}>
                      {kycStatusData?.auditNotes || 'Your submitted document did not pass the autonomous anti-bias compliance check. Please verify your registration number and upload a legible certificate.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Form Section: Submit / Update Institutional Documents */}
              <div className="card" style={{ padding: '28px', background: 'var(--surface)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-symbols-outlined" style={{ color: '#38bdf8' }}>badge</span>
                    Institutional Credentials & Governance Submission
                  </h3>
                  <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>SEC Non-Stock Rubric</span>
                </div>

                <p style={{ fontSize: '0.84rem', color: '#94a3b8', marginBottom: '22px', lineHeight: '1.5' }}>
                  In compliance with Republic Act 11232 and Philippine Disaster Response Guidelines, NGOs must submit their legitimate Securities and Exchange Commission (SEC) Non-Stock Registration Number and Certificate of Incorporation to prevent fraudulent campaigns.
                </p>

                <form onSubmit={handleSaveKyc}>
                  <div className="form-grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '6px' }}>
                        SEC REGISTRATION NUMBER <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="input"
                        placeholder="e.g., SEC-CN2021-08492"
                        value={secRegNo}
                        onChange={e => setSecRegNo(e.target.value)}
                        style={{ fontFamily: 'monospace', fontWeight: 700 }}
                        required
                      />
                      <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px', display: 'block' }}>
                        Issued by Philippine Securities and Exchange Commission (SEC eSPARC)
                      </span>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '6px' }}>
                        DSWD / LGU ACCREDITATION PERMIT (OPTIONAL)
                      </label>
                      <input
                        type="text"
                        className="input"
                        placeholder="e.g., DSWD-SB-A-2024-0193"
                        value={dswdNo}
                        onChange={e => setDswdNo(e.target.value)}
                        style={{ fontFamily: 'monospace' }}
                      />
                      <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px', display: 'block' }}>
                        Public Solicitation Authorization Number
                      </span>
                    </div>
                  </div>

                  <div style={{ marginBottom: '18px' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '6px' }}>
                      BOARD OF TRUSTEES / FOUNDERS / INCORPORATORS <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g., Chairman: Richard Gordon | SecGen: Gwendolyn Pang | Trustee: Dr. Benjamin Go"
                      value={boardMembersText}
                      onChange={e => setBoardMembersText(e.target.value)}
                      required
                    />
                    <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px', display: 'block' }}>
                      List key officers to confirm authorized identity and eliminate human bias during review.
                    </span>
                  </div>

                  {/* Certificate Image Upload Box */}
                  <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0' }}>
                        OFFICIAL SEC CERTIFICATE OF INCORPORATION (IMAGE / PDF) <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      {secCertUrl && (
                        <button
                          type="button"
                          onClick={() => setSecCertUrl('')}
                          style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                        >
                          Remove Document
                        </button>
                      )}
                    </div>

                    {secCertUrl ? (
                      <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1.5px solid rgba(56, 189, 248, 0.4)', background: 'rgba(0,0,0,0.3)', padding: '12px', textAlign: 'center' }}>
                        {isPdfDocument(secCertUrl) ? (
                          <div
                            onClick={() => setViewingKycCert(true)}
                            style={{ padding: '24px 16px', background: 'rgba(56, 189, 248, 0.08)', borderRadius: '8px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '42px', color: '#ef4444' }}>picture_as_pdf</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff' }}>Official SEC Certificate (PDF Document)</span>
                            <span style={{ fontSize: '0.74rem', color: '#38bdf8' }}>Click to Inspect Full Document</span>
                          </div>
                        ) : (
                          <img
                            src={normalizeSecDocUrl(secCertUrl)}
                            alt="SEC Certificate Preview"
                            style={{ maxHeight: '160px', maxWidth: '100%', objectFit: 'contain', borderRadius: '8px', cursor: 'pointer' }}
                            onClick={() => setViewingKycCert(true)}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const fallbackEl = document.getElementById('sec-thumb-fallback');
                              if (fallbackEl) fallbackEl.style.display = 'flex';
                            }}
                          />
                        )}
                        <div id="sec-thumb-fallback" style={{ display: 'none', flexDirection: 'column', alignItems: 'center', padding: '16px', background: 'rgba(217, 119, 6, 0.1)', borderRadius: '8px', cursor: 'pointer' }} onClick={() => setViewingKycCert(true)}>
                          <span className="material-symbols-outlined" style={{ fontSize: '36px', color: '#f59e0b' }}>verified</span>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f59e0b', marginTop: '4px' }}>SEC Certificate Document Attached</span>
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Click to Inspect Official Certificate</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#38bdf8' }}>verified</span>
                          <span style={{ fontSize: '0.78rem', color: '#38bdf8', fontWeight: 700 }}>
                            SEC Certificate Attached • Click Image to Inspect Full Size
                          </span>
                        </div>
                      </div>
                    ) : (
                      <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '28px 16px', border: '1.5px dashed rgba(56, 189, 248, 0.35)', borderRadius: '12px', cursor: 'pointer', background: 'rgba(56, 189, 248, 0.03)', transition: '0.2s' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '32px', color: '#38bdf8', marginBottom: '6px' }}>
                          upload_file
                        </span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff' }}>
                          Upload SEC Certificate Document (PNG, JPG, PDF)
                        </span>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                          Max 5MB • Valid Certificate of Incorporation or Articles
                        </span>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={handleKycCertUpload}
                          style={{ display: 'none' }}
                        />
                      </label>
                    )}
                  </div>

                  {/* Real-Time AI Scanning Progress Banner */}
                  {kycSaving && kycStepText && (
                    <div style={{
                      background: 'rgba(56, 189, 248, 0.1)',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      borderRadius: '10px',
                      padding: '12px 16px',
                      marginBottom: '16px',
                      fontSize: '0.82rem',
                      color: '#38bdf8',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}>
                      <div className="spinner spinner-light" style={{ width: '16px', height: '16px' }} />
                      <span style={{ fontWeight: 600 }}>{kycStepText}</span>
                    </div>
                  )}

                  {/* Submission Action Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <button
                      type="submit"
                      className="btn btn-primary glow pulse"
                      disabled={kycSaving || (!secRegNo.trim() && !secCertUrl)}
                      style={{ padding: '12px 28px', fontSize: '0.95rem' }}
                    >
                      {kycSaving ? <><div className="spinner" /> AI Vision Verifying…</> : '🤖 Submit for Autonomous AI Verification'}
                    </button>

                    <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
                      🛡️ Real-time Gemini AI Vision analysis • Zero human gatekeeping or bias.
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ── SEC Certificate Viewer Modal ── */}
          <SecCertificateModal
            isOpen={viewingKycCert && !!secCertUrl}
            onClose={() => setViewingKycCert(false)}
            url={secCertUrl}
            orgName={currentUser?.name || kycStatusData?.Org_Name || ''}
            regNo={secRegNo || kycStatusData?.secRegistrationNo || ''}
          />

          {/* ── 5.8. DISASTER RELIEF RADAR HEATMAP TAB (NGO STRATEGIC DISPATCH) ── */}
          {activeTab === 'radar-heatmap' && (
            <div style={{ marginTop: '8px' }}>
              <div className="section-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px' }}>
                <div>
                  <h2 className="section-title" style={{ fontSize: '1.4rem' }}>
                    <span className="material-symbols-outlined section-title-icon" style={{ marginRight: '8px', color: 'var(--accent)' }}>radar</span>
                    Disaster Relief Radar Heatmap · NGO Strategic Dispatch
                  </h2>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Monitor meteorological Doppler relief concentration across the Philippines to identify high-density disaster zones and mobilize field missions.
                  </p>
                </div>
              </div>

              <DisasterRadarHeatmap
                campaigns={campaigns}
                height="620px"
                theme={theme}
                onSelectCampaign={(c) => {
                  setActiveTab('all-campaigns');
                  setSearchQueryAll(c.title || '');
                }}
              />
            </div>
          )}

          {/* ── 6. PROFILE & SETTINGS TAB ── */}
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
                onStartTour={() => setShowGuidedTour(true)}
              />
            </div>
          )}

        </section>
      </div>

      {/* ── Web3 Deployment Modal ── */}
      {txModal.show && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(5, 7, 12, 0.75)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999
        }} className="fade-in">
          <div className="card bounce-in" style={{ width: '420px', padding: '24px', background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', borderRadius: '16px' }}>

            {txModal.step === 0 && (
              <div className="fade-in">
                <h2 style={{ marginTop: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', fontSize: '1.2rem', color: 'var(--text)' }}>
                  <span className="material-symbols-outlined" style={{ marginRight: '8px', color: 'var(--danger)' }}>error</span>
                  Action Blocked
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px', lineHeight: '1.5' }}>
                  {txModal.error}
                </p>
                <button className="btn btn-primary btn-full pulse" onClick={() => setTxModal({ show: false, step: 0, hash: '', type: '', error: '' })}>Understood</button>
              </div>
            )}

            {txModal.step === 1 && (
              <div className="fade-in" style={{ textAlign: 'center', padding: '40px 0' }}>
                <div className="spinner" style={{ width: '40px', height: '40px', margin: '0 auto 20px', borderColor: 'var(--primary)', borderRightColor: 'transparent' }}></div>
                <h3 style={{ marginBottom: '8px', color: 'var(--text)' }}>
                  {txModal.isLocal ? 'Preparing Campaign' : 'Awaiting Signature'}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {txModal.isLocal
                    ? 'Initializing relief campaign in local development database...'
                    : 'Please open MetaMask and securely sign the transaction to deploy your new campaign.'}
                </p>
              </div>
            )}

            {txModal.step === 2 && (
              <div className="fade-in" style={{ textAlign: 'center', padding: '40px 0' }}>
                <div className="spinner" style={{ width: '40px', height: '40px', margin: '0 auto 20px', borderColor: 'var(--secondary)', borderRightColor: 'transparent' }}></div>
                <h3 style={{ marginBottom: '8px', color: 'var(--text)' }}>
                  {txModal.isLocal ? 'Saving to Database' : 'Deploying Campaign'}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
                  {txModal.isLocal
                    ? 'Registering relief campaign and allocation metrics on local server.'
                    : 'Mining your structural contract across the Sepolia network.'}
                </p>
                <div style={{ padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', fontSize: '0.75rem', wordBreak: 'break-all', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    {txModal.isLocal ? 'Local Reference Hash:' : 'Transaction Hash:'}
                  </span>
                  {txModal.hash}
                </div>
              </div>
            )}

            {txModal.step === 3 && (
              <div className="fade-in" style={{ textAlign: 'center', padding: '20px 0 10px' }}>
                <div className="success-circle-container">
                  <span className="material-symbols-outlined check-icon-pop" style={{ fontSize: '2.5rem', color: 'var(--success)' }}>check</span>
                </div>
                <h3 style={{ marginBottom: '8px', color: 'var(--text)' }}>Deployment Successful!</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {txModal.isLocal
                    ? 'Your relief campaign has been successfully deployed in Localhost Mode and saved to the database.'
                    : 'Your relief campaign has been permanently deployed on the immutable blockchain.'}
                </p>
                <div style={{ margin: '24px 0', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', textAlign: 'left', border: '1px solid rgba(0,255,100,0.1)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    {txModal.isLocal ? 'Local Receipt Verification' : 'Verified Block Receipt'}
                  </div>
                  {txModal.isLocal ? (
                    <div style={{ color: 'var(--success)', wordBreak: 'break-all', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>check_circle</span>
                      <span>{txModal.hash}</span>
                    </div>
                  ) : (
                    <a href={`https://sepolia.etherscan.io/tx/${txModal.hash}`} target="_blank" rel="noreferrer" style={{ color: 'var(--success)', textDecoration: 'none', wordBreak: 'break-all', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>open_in_new</span> {txModal.hash.slice(0, 20)}...
                    </a>
                  )}
                </div>
                <button className="btn btn-primary btn-full pulse" onClick={() => { setTxModal({ show: false, step: 0, hash: '', type: '', error: '', isLocal: false }); setActiveTab('my-campaigns'); }}>Complete</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Interactive Guided Onboarding Spotlight Tour */}
      <GuidedTour
        isOpen={showGuidedTour}
        onClose={() => setShowGuidedTour(false)}
        steps={ngoTourSteps}
        onTabChange={(t) => setActiveTab(t)}
        tourKey={userTourKey}
        roleName="NGO Partner"
        theme={theme}
      />
    </main>
  );
}
