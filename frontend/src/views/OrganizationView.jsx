import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ethers } from 'ethers';
import Tesseract from 'tesseract.js';
import { isLocalhost, API_URL } from '../config';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { blurFacesInImage, preloadFaceDetector } from '../utils/facePrivacyBlur';
import FaceBlurEditorModal from '../components/FaceBlurEditorModal';
import LiveCounter from '../components/LiveCounter';
import CampaignCard, { shortAddr, formatCampaignTitle, formatEthAmt, progressPct, getOrgDisplayName, getCampaignTags, getCampaignAuditDetails, getCampaignCategoryInfo, getCampaignCoverData } from '../components/CampaignCard';
import LocationMapPicker from '../components/LocationMapPicker';
import BarangayCombobox from '../components/BarangayCombobox';
import { ROLES } from '../roleConfig';
import SettingsPanel from '../components/SettingsPanel';
import DisasterRadarHeatmap from '../components/DisasterRadarHeatmap';
import SecCertificateModal, { normalizeSecDocUrl, isPdfDocument } from '../components/SecCertificateModal';
import GuidedTour from '../components/GuidedTour';
import SidebarToggleIcon from '../components/SidebarToggleIcon';
import AnalyticsReportsPanel from '../components/AnalyticsReportsPanel';
import DeclareDirectDepositModal from '../components/DeclareDirectDepositModal';
import FilterableExportModal from '../components/FilterableExportModal';
import { useToast } from '../context/ToastContext';
import { getRegions, getRegionForProvince } from '../data/philippineGeoData';
import { CONTRACT_ADDRESS } from '../contractConfig';
import { autoCropQrScreenshot, extractQrVoucherText } from '../utils/qrCropper';
import { formatPhoneNumber } from '../utils/formatters';
import { getWorkspaceStrings } from '../data/workspaceTranslations';
import {
  exportNgoLedgerCsv,
  exportNgoLedgerExcel,
  exportNgoAuditPdf,
  printDonationVoucher
} from '../utils/reportExporter';
import './ReferenceDashboard.css';
import './DashboardOverview.css';

export const formatImageSrc = (rawSrc) => {
  if (!rawSrc) return '';
  if (typeof rawSrc !== 'string') return '';
  const trimmed = rawSrc.trim();
  if (!trimmed) return '';

  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  if (trimmed.startsWith('<svg') || trimmed.includes('xmlns="http://www.w3.org/2000/svg"')) {
    return `data:image/svg+xml;utf8,${encodeURIComponent(trimmed)}`;
  }

  if (trimmed.startsWith('/9j/')) {
    return `data:image/jpeg;base64,${trimmed}`;
  }
  if (trimmed.startsWith('iVBORw0')) {
    return `data:image/png;base64,${trimmed}`;
  }
  if (trimmed.startsWith('R0lGOD')) {
    return `data:image/gif;base64,${trimmed}`;
  }
  if (trimmed.startsWith('UklGR')) {
    return `data:image/webp;base64,${trimmed}`;
  }
  if (trimmed.startsWith('PHN2Zy')) {
    return `data:image/svg+xml;base64,${trimmed}`;
  }

  return `data:image/png;base64,${trimmed}`;
};

export default function OrganizationView({
  contract,
  walletAddress,
  walletAlertBanner,
  campaigns = [],
  fetchCampaigns,
  fetchingCampaigns,
  currentUser,
  handleConnectWallet,
  handleLogout,
  updateDbWallet,
  theme,
  themeMode,
  setTheme,
  textSize,
  setTextSize,
  interfaceMode = 'standard',
  setInterfaceMode,
  language = 'en',
  setLanguage,
  reducedMotion = false,
  setReducedMotion,
  highContrast = false,
  setHighContrast,
  lowBandwidthMode = false,
  setLowBandwidthMode,
  onActiveTabChange
}) {
  const { showSuccess, showWarning, showError } = useToast();
  const wt = useMemo(() => getWorkspaceStrings(language), [language]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showNgoGuide, setShowNgoGuide] = useState(() => {
    try { return localStorage.getItem('bbdrts_dismiss_ngo_guide') !== 'true'; } catch (_) { return true; }
  });

  // Live Dashboard Section Broadcast to ReliefAI
  const lastOrgTabRef = useRef(null);
  useEffect(() => {
    if (lastOrgTabRef.current === activeTab) return;
    lastOrgTabRef.current = activeTab;
    const orgTabLabels = {
      'dashboard': 'NGO Operations Dashboard',
      'analytics': 'Organization Analytics & Reports',
      'sec-kyc': 'SEC & Accreditation KYC Verification',
      'all-campaigns': 'Public Relief Campaigns Explorer',
      'radar-heatmap': 'Disaster Relief Radar Heatmap',
      'my-campaigns': 'My Deployed Relief Drives',
      'create': 'Deploy New Relief Campaign (AI Budget)',
      'ledger': 'Financial Ledger & Manual Donation Verification',
      'settings': 'Organization Profile & Settings'
    };
    const sectionLabel = orgTabLabels[activeTab] || activeTab;
    const metaPayload = {
      tab: activeTab,
      section: sectionLabel,
      portal: 'NGO Operations Portal',
      orgName: currentUser?.organization_name || currentUser?.Org_Name || 'Accredited NGO',
      activeTab
    };
    if (typeof onActiveTabChange === 'function') {
      onActiveTabChange(activeTab, metaPayload);
    }
  }, [activeTab, onActiveTabChange]);



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
  const [ledgerRailFilter, setLedgerRailFilter] = useState('ALL');
  const [ledgerCampaignFilter, setLedgerCampaignFilter] = useState('ALL');
  const [ledgerSort, setLedgerSort] = useState('NEWEST');
  const [searchQueryLedger, setSearchQueryLedger] = useState('');
  const [currentPageLedger, setCurrentPageLedger] = useState(1);
  const [ledgerViewMode, setLedgerViewMode] = useState('table');
  const [selectedVoucherTx, setSelectedVoucherTx] = useState(null);
  const [proofPreviewModalImg, setProofPreviewModalImg] = useState(null);

  // Lock background scroll when voucher modal is open
  useEffect(() => {
    if (selectedVoucherTx) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [selectedVoucherTx]);

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
    const handleTabNav = (e) => {
      const targetTab = e?.detail?.tab;
      if (!targetTab) return;
      const resolved = targetTab === 'reports' ? 'analytics' : targetTab;
      if (resolved === 'sec-kyc') fetchKycData();
      setActiveTab(resolved);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('bbdrts_navigate_radar', handleRadarNav);
    window.addEventListener('bbdrts_navigate_campaigns', handleCampaignsNav);
    window.addEventListener('bbdrts_navigate_home', handleHomeNav);
    window.addEventListener('bbdrts_navigate_tab', handleTabNav);
    return () => {
      window.removeEventListener('bbdrts_navigate_radar', handleRadarNav);
      window.removeEventListener('bbdrts_navigate_campaigns', handleCampaignsNav);
      window.removeEventListener('bbdrts_navigate_home', handleHomeNav);
      window.removeEventListener('bbdrts_navigate_tab', handleTabNav);
    };
  }, []);

  // Create campaign form state
  const DISASTER_TAGS = [
    'Flood Relief',
    'Emergency Food',
    'Medical Aid',
    'Shelter Recovery',
    'Water Sanitation',
    'Urgent Response',
    'Evacuation Support',
    'First Aid Kits',
    'Disaster Recovery'
  ];

  const CHARITY_TAGS = [
    'Charity Outreach',
    'Education & Youth',
    'Feeding Program',
    'Children Support',
    'Elderly Care',
    'Community Rebuilding',
    'Livelihood Assistance',
    'Blood Donation',
    'Emergency Food',
    'Medical Aid',
    'Water Sanitation'
  ];

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
    'Evacuation Support',
    'Charity Outreach',
    'Education & Youth',
    'Feeding Program'
  ];

  // Multilingual keyword dictionary mapping disaster & relief scenarios to ALL necessary operation tags (English, Tagalog, Bisaya/Cebuano)
  const TAG_KEYWORD_RULES = [
    // 1. Flood / Baha / Lunop (Inundation, high water)
    // Necessary tags: Flood Relief, Disaster Recovery, Emergency Food, Water Sanitation, Urgent Response, Evacuation Support, Shelter Recovery
    {
      name: 'Flood Disaster',
      tags: ['Flood Relief', 'Disaster Recovery', 'Emergency Food', 'Water Sanitation', 'Urgent Response', 'Evacuation Support', 'Shelter Recovery'],
      keywords: [
        'flood', 'floods', 'flooding', 'flash flood', 'flashflood', 'deluge', 'inundat', 'submerged', 'water level', 'storm surge',
        'baha', 'pagbaha', 'binaha', 'bumabaha', 'lubog', 'inundasyon', 'daluyong', 'ragasa',
        'lunop', 'nalunop', 'nagbaha', 'nibaha', 'lapok'
      ]
    },
    // 2. Typhoon / Bagyo / Storm / Cyclone / Tropical Storm / Super Typhoon
    // Necessary tags: Disaster Recovery, Emergency Food, Water Sanitation, Shelter Recovery, Urgent Response, Evacuation Support, Children Support, Elderly Care, Community Rebuilding
    {
      name: 'Typhoon / Severe Storm',
      tags: ['Disaster Recovery', 'Emergency Food', 'Water Sanitation', 'Shelter Recovery', 'Urgent Response', 'Evacuation Support', 'Children Support', 'Elderly Care', 'Community Rebuilding'],
      keywords: [
        'typhoon', 'super typhoon', 'storm', 'tropical storm', 'cyclone', 'monsoon', 'habagat', 'heavy rain', 'gale', 'calamity',
        'odette', 'kristine', 'carina', 'yolanda', 'pepit', 'leon', 'marce', 'nika', 'egay', 'paeng', 'agaton', 'rai', 'haiyan',
        'bagyo', 'unos', 'sigwa', 'hanging habagat', 'malakas na ulan', 'delubyo', 'hagupit',
        'bagyohay', 'kusog nga hangin', 'makusog nga ulan'
      ]
    },
    // 3. Earthquake / Lindol / Linog / Tremor
    // Necessary tags: Disaster Recovery, Shelter Recovery, Medical Aid, First Aid Kits, Emergency Food, Water Sanitation, Urgent Response, Evacuation Support, Community Rebuilding
    {
      name: 'Earthquake Disaster',
      tags: ['Disaster Recovery', 'Shelter Recovery', 'Medical Aid', 'First Aid Kits', 'Emergency Food', 'Water Sanitation', 'Urgent Response', 'Evacuation Support', 'Community Rebuilding'],
      keywords: [
        'earthquake', 'quake', 'aftershock', 'tremor', 'ground shaking', 'faultline', 'seismic',
        'lindol', 'lumindol', 'naglindol', 'paglindol', 'pagyanig', 'yanig', 'nayanig',
        'linog', 'nilinog', 'naglinog', 'tay-og', 'pagtay-og', 'natay-og', 'uyog'
      ]
    },
    // 4. Fire / Conflagration / Sunog / Kasunogan
    // Necessary tags: Shelter Recovery, Emergency Food, Evacuation Support, Urgent Response, Water Sanitation, First Aid Kits, Medical Aid, Community Rebuilding
    {
      name: 'Fire Calamity',
      tags: ['Shelter Recovery', 'Emergency Food', 'Evacuation Support', 'Urgent Response', 'Water Sanitation', 'First Aid Kits', 'Medical Aid', 'Community Rebuilding'],
      keywords: [
        'fire', 'conflagration', 'blaze', 'burnt', 'burned', 'house fire', 'residential fire',
        'sunog', 'nasunog', 'nasunugan', 'kasunogan', 'apoy', 'natupok', 'lumiyab',
        'kalayo', 'kaayo', 'ugdaw', 'naugdaw', 'napildi sa sunog'
      ]
    },
    // 5. Landslide / Pagguho / Dahili / Mudslide
    // Necessary tags: Disaster Recovery, Urgent Response, Shelter Recovery, Evacuation Support, Emergency Food, Medical Aid, First Aid Kits
    {
      name: 'Landslide Disaster',
      tags: ['Disaster Recovery', 'Urgent Response', 'Shelter Recovery', 'Evacuation Support', 'Emergency Food', 'Medical Aid', 'First Aid Kits'],
      keywords: [
        'landslide', 'mudslide', 'rockslide', 'soil erosion', 'debris flow',
        'pagguho', 'guho', 'gumuho', 'tabon', 'natabunan', 'guho ng lupa',
        'dahili', 'nidahili', 'nagdahili', 'nahugno', 'natabunan sa yuta'
      ]
    },
    // 6. Volcano / Eruption / Bulkan / Ashfall / Lahar
    // Necessary tags: Disaster Recovery, Evacuation Support, Emergency Food, Water Sanitation, Medical Aid, Urgent Response, Shelter Recovery
    {
      name: 'Volcanic Eruption',
      tags: ['Disaster Recovery', 'Evacuation Support', 'Emergency Food', 'Water Sanitation', 'Medical Aid', 'Urgent Response', 'Shelter Recovery'],
      keywords: [
        'volcano', 'volcanic', 'eruption', 'ashfall', 'lava', 'lahar', 'pyroclastic', 'mayon', 'taal', 'kanlaon', 'bulusan', 'pinatubo',
        'bulkan', 'pagputok', 'pagsabog ng bulkan', 'abo',
        'pagbuto sa bulkan', 'abo sa bulkan'
      ]
    },
    // 7. Tsunami / Storm Surge / Daluyong
    // Necessary tags: Disaster Recovery, Flood Relief, Evacuation Support, Shelter Recovery, Emergency Food, Water Sanitation, Urgent Response
    {
      name: 'Tsunami & Storm Surge',
      tags: ['Disaster Recovery', 'Flood Relief', 'Evacuation Support', 'Shelter Recovery', 'Emergency Food', 'Water Sanitation', 'Urgent Response'],
      keywords: [
        'tsunami', 'storm surge', 'daluyong', 'dambuhalang alon', 'balud', 'hunas'
      ]
    },
    // 8. Evacuation / Bakwit / Displaced Families
    // Necessary tags: Evacuation Support, Emergency Food, Water Sanitation, Shelter Recovery, Urgent Response, Children Support, Elderly Care
    {
      name: 'Evacuation & Displacement',
      tags: ['Evacuation Support', 'Emergency Food', 'Water Sanitation', 'Shelter Recovery', 'Urgent Response', 'Children Support', 'Elderly Care'],
      keywords: [
        'evacuation', 'evacuate', 'evacuee', 'evacuees', 'displaced', 'displacement', 'temporary shelter', 'evacuation center',
        'likas', 'paglikas', 'lumikas', 'nagsilikas', 'nawalan ng tahanan',
        'bakwit', 'mga bakwit', 'namakwit', 'nanglayas', 'pamalhin', 'nawad-an ug balay'
      ]
    },
    // 9. Emergency Food / Relief Goods / Feeding / Hunger / Bugas / Pagkaon
    // Necessary tags: Emergency Food, Children Support, Community Rebuilding, Urgent Response
    {
      name: 'Food Aid & Feeding',
      tags: ['Emergency Food', 'Children Support', 'Community Rebuilding', 'Urgent Response'],
      keywords: [
        'food', 'food pack', 'relief pack', 'relief goods', 'ration', 'hunger', 'nutrition', 'malnutrition', 'starvation', 'groceries', 'feeding', 'rice', 'meal',
        'pagkain', 'bigas', 'kanin', 'gutom', 'pakain', 'ayuda', 'pamahagi', 'de-lata',
        'pagkaon', 'bugas', 'sud-an', 'kan-on', 'rasyon', 'kagutom'
      ]
    },
    // 10. Medical Mission / Outbreak / Health Crisis / Tambal / Gamot
    // Necessary tags: Medical Aid, First Aid Kits, Urgent Response, Children Support, Elderly Care
    {
      name: 'Medical & Healthcare',
      tags: ['Medical Aid', 'First Aid Kits', 'Urgent Response', 'Children Support', 'Elderly Care'],
      keywords: [
        'medical', 'medicine', 'medicines', 'hospital', 'doctor', 'nurse', 'patient', 'clinic', 'pharma', 'health', 'disease', 'illness', 'outbreak', 'epidemic', 'dengue', 'cholera', 'measles', 'infection',
        'gamot', 'doktor', 'nars', 'pagamutan', 'ospital', 'kalusugan', 'sakit', 'karamdaman', 'lunas', 'pampagaling',
        'tambal', 'tambalanan', 'masakiton', 'balatian', 'kaayohan'
      ]
    },
    // 11. Clean Drinking Water / Sanitation / Hygiene / WASH / Tubig
    // Necessary tags: Water Sanitation, Urgent Response, Medical Aid
    {
      name: 'Water & Sanitation',
      tags: ['Water Sanitation', 'Urgent Response', 'Medical Aid'],
      keywords: [
        'water', 'drinking water', 'potable', 'sanitation', 'hygiene', 'filter', 'filtration', 'clean water', 'wash', 'mineral water',
        'tubig', 'inumin', 'inuming tubig', 'kalinisan', 'pansala', 'hugasan',
        'ilimnon', 'mainum', 'limpyong tubig', 'sanitasyon'
      ]
    },
    // 12. Shelter Recovery / Roofing / Tarpaulins / Tents / Atop / Trapal
    // Necessary tags: Shelter Recovery, Community Rebuilding, Disaster Recovery, Urgent Response
    {
      name: 'Shelter & Housing Recovery',
      tags: ['Shelter Recovery', 'Community Rebuilding', 'Disaster Recovery', 'Urgent Response'],
      keywords: [
        'shelter', 'roof', 'roofing', 'tarpaulin', 'tarpaulins', 'tarp', 'tarps', 'tent', 'tents', 'housing', 'homeless', 'rebuild home', 'cgi sheet', 'timber', 'house repair',
        'bubong', 'bubungan', 'tolda', 'tirahan', 'bahay', 'nasirang bahay', 'pansamantalang tirahan', 'trapo', 'yero',
        'atop', 'trapal', 'balay', 'payag', 'nahugno', 'nagusbat', 'panimalay', 'pasilong', 'mapasilongan', 'sin'
      ]
    },
    // 13. Children & Youth Support / Bata / Kabataan
    // Necessary tags: Children Support, Emergency Food, Medical Aid
    {
      name: 'Children & Youth',
      tags: ['Children Support', 'Emergency Food', 'Medical Aid'],
      keywords: [
        'child', 'children', 'kid', 'kids', 'infant', 'baby', 'pediatric', 'orphan', 'student', 'school',
        'bata', 'mga bata', 'sanggol', 'anak', 'kabataan', 'mag-aaral', 'paaralan', 'paslit',
        'masuso', 'batang gamay', 'eskwela', 'tulunghaan'
      ]
    },
    // 14. Elderly Care / Senior Citizens / Tigulang / Lolo & Lola
    // Necessary tags: Elderly Care, Medical Aid, Emergency Food
    {
      name: 'Elderly Care',
      tags: ['Elderly Care', 'Medical Aid', 'Emergency Food'],
      keywords: [
        'elderly', 'senior', 'seniors', 'aged', 'grandparent', 'grandparents', 'pensioner', 'senior citizen',
        'matanda', 'mga matatanda', 'lolo', 'lola', 'nakatatanda', 'may edad',
        'tiguwang', 'tigulang', 'mga tigulang', 'katigulangan', 'apohan'
      ]
    },
    // 15. Blood Donation / Red Cross / Dugo / Sandugo
    // Necessary tags: Blood Donation, Medical Aid, Urgent Response
    {
      name: 'Blood Donation',
      tags: ['Blood Donation', 'Medical Aid', 'Urgent Response'],
      keywords: [
        'blood', 'transfusion', 'donor', 'plasma', 'platelet', 'red cross', 'blood donation', 'blood drive',
        'dugo', 'sandugo', 'donasyon ng dugo', 'salin ng dugo',
        'donar ug dugo', 'kuhaag dugo'
      ]
    },
    // 16. First Aid / Trauma / Wounds / Bandages
    // Necessary tags: First Aid Kits, Medical Aid, Urgent Response
    {
      name: 'First Aid & Trauma',
      tags: ['First Aid Kits', 'Medical Aid', 'Urgent Response'],
      keywords: [
        'first aid', 'bandage', 'gauze', 'antiseptic', 'wound', 'splint', 'trauma kit',
        'paunang lunas', 'benda', 'gasang pantapal', 'sugat', 'gamit pansugat',
        'paunang tabang', 'bendahe', 'samad', 'patambal'
      ]
    },
    // 17. Livelihood Assistance / Fisherfolk / Farmers / Bangka
    // Necessary tags: Livelihood Assistance, Community Rebuilding
    {
      name: 'Livelihood Assistance',
      tags: ['Livelihood Assistance', 'Community Rebuilding'],
      keywords: [
        'livelihood', 'fisherman', 'fishermen', 'fisherfolk', 'boat', 'banca', 'farmer', 'crop', 'harvest', 'seed', 'vendor',
        'kabuhayan', 'mangingisda', 'bangka', 'magsasaka', 'pananim', 'ani', 'tindero', 'hanapbuhay',
        'panginabuhian', 'mananagat', 'baroto', 'mag-uuma', 'uma', 'tanum'
      ]
    },
    // 18. Community Rebuilding / Bayanihan / Pagbangon
    // Necessary tags: Community Rebuilding, Disaster Recovery, Livelihood Assistance
    {
      name: 'Community Rebuilding',
      tags: ['Community Rebuilding', 'Disaster Recovery', 'Livelihood Assistance'],
      keywords: [
        'community', 'rebuild', 'rebuilding', 'recovery', 'rehabilitat', 'restoration', 'infrastructure', 'barangay',
        'pamayanan', 'bayanihan', 'pagbangon', 'kumpuni', 'pagsasaayos', 'tulong-tulong',
        'komunidad', 'timbayayong', 'ayohon', 'panaghiusa'
      ]
    },
    // 19. Urgent Response / SOS / Rescue / Saklolo / Tabang
    // Necessary tags: Urgent Response, Evacuation Support, First Aid Kits
    {
      name: 'Urgent & Rescue',
      tags: ['Urgent Response', 'Evacuation Support', 'First Aid Kits'],
      keywords: [
        'urgent', 'emergency', 'emergencies', 'critical', 'sos', 'rapid', 'immediate', 'crisis', 'rescue', 'alarm', 'alert',
        'agaran', 'madalian', 'saklolo', 'sakuna', 'krisis', 'sagip',
        'dinali-an', 'tabang', 'luwas', 'kuyaw', 'alarma', 'dali'
      ]
    },
    // 20. General Charity & Outreach / Kawanggawa / Gift Giving / Indigent Support
    // Necessary tags: Charity Outreach, Community Rebuilding, Livelihood Assistance
    {
      name: 'Charitable Outreach',
      tags: ['Charity Outreach', 'Community Rebuilding', 'Livelihood Assistance'],
      keywords: [
        'charity', 'charitable', 'outreach', 'philanthrop', 'donation drive', 'gift giving', 'gift-giving',
        'pamaskong handog', 'share a blessing', 'adopt a family', 'adopt-a-family', 'indigent', 'poverty',
        'underprivileged', 'less fortunate', 'marginalized', 'street family', 'street families', 'homeless',
        'pwd', 'persons with disability', 'indigenous', 'ip community', 'lumad', 'aeta', 'welfare', 'fundraiser', 'fundraising', 'benefit',
        'kawanggawa', 'tulong sa kapwa', 'ayuda sa komunidad', 'handog', 'malasakit', 'pagmamalasakit', 'pagbabahagi',
        'kabus', 'tabang sa kabus', 'kaloy-an', 'pasko', 'christmas drive'
      ]
    },
    // 21. Education, Scholarships & Back-to-School Supplies
    // Necessary tags: Education & Youth, Children Support, Charity Outreach
    {
      name: 'Education & Scholarship',
      tags: ['Education & Youth', 'Children Support', 'Charity Outreach'],
      keywords: [
        'scholarship', 'scholar', 'education', 'educational', 'school', 'school supplies', 'back to school', 'back-to-school',
        'balik eskwela', 'balik-eskwela', 'tuition', 'student', 'students', 'notebook', 'backpack', 'textbook',
        'books', 'library', 'classroom', 'literacy', 'daycare', 'day care', 'kindergarten', 'learning',
        'iskolar', 'edukasyon', 'eskwela', 'eskwelahan', 'gamit pang-eskwela', 'gamit pampaaralan',
        'mag-aaral', 'estudyante', 'pag-aaral', 'tunghaan', 'eskuwelahan', 'kabataan', 'youth'
      ]
    },
    // 22. Feeding Program, Community Pantry & Nutrition Drive
    // Necessary tags: Feeding Program, Emergency Food, Children Support, Charity Outreach
    {
      name: 'Feeding Program & Pantry',
      tags: ['Feeding Program', 'Emergency Food', 'Children Support', 'Charity Outreach'],
      keywords: [
        'feeding', 'feeding program', 'community pantry', 'pantry', 'soup kitchen', 'malnutrition', 'malnourished',
        'undernourished', 'nutrition', 'lugaw', 'sopas', 'hot meal', 'hot meals', 'packed meal', 'food drive',
        'food bank', 'grocery pack', 'pakain', 'pagpapakain', 'pangkain', 'sustansya', 'nutrisyon', 'pakaon'
      ]
    },
    // 23. Orphanage, Foster Care & Child Welfare
    // Necessary tags: Children Support, Charity Outreach, Education & Youth
    {
      name: 'Orphanage & Child Welfare',
      tags: ['Children Support', 'Charity Outreach', 'Education & Youth'],
      keywords: [
        'orphan', 'orphanage', 'orphans', 'foster', 'bahay ampunan', 'ampunan', 'street children',
        'batang lansangan', 'child welfare', 'children home', 'batan-on'
      ]
    },
    // 24. Medical / Dental / Optical Mission & Patient Aid
    // Necessary tags: Medical Aid, Charity Outreach, First Aid Kits
    {
      name: 'Medical & Dental Mission',
      tags: ['Medical Aid', 'Charity Outreach', 'First Aid Kits'],
      keywords: [
        'medical mission', 'dental mission', 'dental', 'optical mission', 'eyeglasses', 'wheelchair',
        'prosthetic', 'dialysis', 'cancer', 'chemotherapy', 'surgery', 'cleft lip', 'cataract',
        'free clinic', 'health mission', 'mental health', 'libreng gamutan', 'libreng checkup',
        'misyong medikal', 'ngipin', 'libreng tambal'
      ]
    },
    // 25. Clothing, Slippers & Care Package Drives
    // Necessary tags: Charity Outreach, Community Rebuilding
    {
      name: 'Clothing & Care Drive',
      tags: ['Charity Outreach', 'Community Rebuilding'],
      keywords: [
        'clothing drive', 'clothes', 'blanket', 'slippers', 'tsinelas', 'shoes', 'uniform',
        'damit', 'kasuotan', 'sanina', 'sinina', 'care package', 'essential pack'
      ]
    }
  ];

  const detectTagsFromTitle = (titleText) => {
    if (!titleText || typeof titleText !== 'string') return [];
    const normalized = titleText.toLowerCase();
    const matchedSet = new Set();

    for (const rule of TAG_KEYWORD_RULES) {
      let matched = false;
      for (const kw of rule.keywords) {
        if (kw.includes(' ')) {
          if (normalized.includes(kw)) {
            matched = true;
            break;
          }
        } else {
          const escaped = kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
          const suffix = kw.length <= 4 ? '($|[^a-zA-Z0-9])' : '';
          const regex = new RegExp(`(^|[^a-zA-Z0-9])${escaped}${suffix}`, 'i');
          if (regex.test(normalized)) {
            matched = true;
            break;
          }
        }
      }
      if (matched && Array.isArray(rule.tags)) {
        rule.tags.forEach(tag => {
          if (PRESET_CAMPAIGN_TAGS.includes(tag)) {
            matchedSet.add(tag);
          }
        });
      }
    }
    return Array.from(matchedSet);
  };

  const detectCategoryFromTitle = (titleText) => {
    if (!titleText || typeof titleText !== 'string') return null;
    const lower = titleText.toLowerCase();

    // Check for Disaster Relief keywords (English, Tagalog, Bisaya)
    const disasterKeywords = [
      'flood', 'floods', 'flooding', 'deluge', 'baha', 'pagbaha', 'binaha', 'lunop', 'nalunop', 'nagbaha', 'storm surge', 'daluyong',
      'typhoon', 'super typhoon', 'storm', 'cyclone', 'bagyo', 'unos', 'habagat', 'odette', 'kristine', 'carina', 'yolanda', 'pepit', 'leon', 'marce', 'nika', 'egay', 'paeng', 'agaton',
      'earthquake', 'quake', 'lindol', 'linog', 'tay-og', 'aftershock', 'tremor',
      'landslide', 'pagguho', 'dahili', 'mudslide',
      'volcano', 'bulkan', 'eruption', 'ashfall', 'mayon', 'taal', 'kanlaon',
      'fire', 'sunog', 'kasunogan', 'ugdaw', 'conflagration',
      'calamity', 'kalamidad', 'sakuna', 'rescue', 'evacuation', 'bakwit', 'likas', 'displaced', 'tsunami'
    ];

    for (const kw of disasterKeywords) {
      if (kw.includes(' ')) {
        if (lower.includes(kw)) return 'DR';
      } else {
        const suffix = kw.length <= 4 ? '($|[^a-zA-Z0-9])' : '';
        const regex = new RegExp(`(^|[^a-zA-Z0-9])${kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}${suffix}`, 'i');
        if (regex.test(lower)) return 'DR';
      }
    }

    // Check for Charitable Aid keywords
    const charitableKeywords = [
      'charity', 'charitable', 'outreach', 'philanthrop', 'donation drive', 'gift giving', 'gift-giving',
      'pamaskong handog', 'adopt a family', 'adopt-a-family', 'indigent', 'underprivileged', 'less fortunate',
      'feeding', 'feeding program', 'soup kitchen', 'food drive', 'food bank', 'malnutrition', 'nutrition', 'pakain', 'pakaon',
      'scholarship', 'scholar', 'education', 'educational', 'school', 'school supplies', 'back to school', 'balik eskwela', 'iskolar', 'edukasyon', 'eskwela', 'estudyante',
      'orphan', 'orphanage', 'ampunan', 'bahay ampunan', 'street children', 'youth', 'kabataan',
      'elderly home', 'senior citizen', 'community pantry', 'pantry', 'community development',
      'medical mission', 'dental mission', 'optical mission', 'wheelchair', 'dialysis', 'cancer', 'free clinic', 'health mission',
      'blood donation', 'blood drive', 'livelihood', 'poverty', 'pwd', 'indigenous', 'lumad', 'clothing drive', 'care package',
      'kawanggawa', 'kabuhayan', 'ayuda sa komunidad', 'tulong sa kapwa', 'panginabuhian', 'handog', 'malasakit', 'kabus'
    ];

    for (const kw of charitableKeywords) {
      if (kw.includes(' ')) {
        if (lower.includes(kw)) return 'CD';
      } else {
        const suffix = kw.length <= 4 ? '($|[^a-zA-Z0-9])' : '';
        const regex = new RegExp(`(^|[^a-zA-Z0-9])${kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}${suffix}`, 'i');
        if (regex.test(lower)) return 'CD';
      }
    }

    return null;
  };

  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [category, setCategory] = useState('DR');
  const manuallySelectedCategoryRef = useRef(false);
  const [isCategoryAuto, setIsCategoryAuto] = useState(false);
  const [selectedTags, setSelectedTags] = useState([]);
  const manuallySelectedTagsRef = useRef(new Set());
  const manuallyDeselectedTagsRef = useRef(new Set());
  const autoDetectedTagsRef = useRef([]);

  const handleTitleChange = (newTitle) => {
    setTitle(newTitle);
    const newDetected = detectTagsFromTitle(newTitle);
    const oldDetected = autoDetectedTagsRef.current;
    autoDetectedTagsRef.current = newDetected;

    // Auto-select category if user hasn't manually overridden
    if (!manuallySelectedCategoryRef.current) {
      const autoCat = detectCategoryFromTitle(newTitle);
      if (autoCat) {
        setCategory(autoCat);
        setIsCategoryAuto(true);
      } else {
        setIsCategoryAuto(false);
      }
    }

    setSelectedTags(prev => {
      const prevSet = new Set(prev);
      oldDetected.forEach(t => {
        if (!newDetected.includes(t) && !manuallySelectedTagsRef.current.has(t)) {
          prevSet.delete(t);
        }
      });
      newDetected.forEach(t => {
        if (!manuallyDeselectedTagsRef.current.has(t)) {
          prevSet.add(t);
        }
      });
      return Array.from(prevSet);
    });
  };

  const handleTagToggle = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
      manuallyDeselectedTagsRef.current.add(tag);
      manuallySelectedTagsRef.current.delete(tag);
    } else {
      setSelectedTags([...selectedTags, tag]);
      manuallySelectedTagsRef.current.add(tag);
      manuallyDeselectedTagsRef.current.delete(tag);
    }
  };

  const [locationRegion, setLocationRegion] = useState('');
  const [street, setStreet] = useState('');
  const [barangay, setBarangay] = useState('');
  const [prefetchedPsgcBarangays, setPrefetchedPsgcBarangays] = useState({ city: '', list: [] });
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
  const [urgency, setUrgency] = useState('');
  const [targetDate, setTargetDate] = useState('');

  // Custom Calendar State for Target Relief Delivery Date
  const [deliveryDatePickerOpen, setDeliveryDatePickerOpen] = useState(false);
  const [calViewDate, setCalViewDate] = useState(() => new Date());
  const deliveryDateContainerRef = useRef(null);

  // Custom Dropdowns for Category & Urgency (matching Web3 Calendar UI)
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const categoryDropdownRef = useRef(null);
  const [showUrgencyDropdown, setShowUrgencyDropdown] = useState(false);
  const urgencyDropdownRef = useRef(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (deliveryDateContainerRef.current && !deliveryDateContainerRef.current.contains(e.target)) {
        setDeliveryDatePickerOpen(false);
      }
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target)) {
        setShowCategoryDropdown(false);
      }
      if (urgencyDropdownRef.current && !urgencyDropdownRef.current.contains(e.target)) {
        setShowUrgencyDropdown(false);
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setDeliveryDatePickerOpen(false);
        setShowCategoryDropdown(false);
        setShowUrgencyDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  // Sync calendar month when targetDate changes
  useEffect(() => {
    if (targetDate) {
      const d = new Date(targetDate + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        setCalViewDate(d);
      }
    }
  }, [targetDate]);

  const handlePrevCalMonth = () => {
    setCalViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const handleNextCalMonth = () => {
    setCalViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const calMonthCells = useMemo(() => {
    const year = calViewDate.getFullYear();
    const month = calViewDate.getMonth();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const cells = [];
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, dayNum);
      const iso = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      cells.push({ dayNum, iso, isCurrentMonth: false, isPast: iso < todayIso, isToday: iso === todayIso });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ dayNum: d, iso, isCurrentMonth: true, isPast: iso < todayIso, isToday: iso === todayIso });
    }
    const remaining = 7 - (cells.length % 7);
    if (remaining < 7) {
      for (let j = 1; j <= remaining; j++) {
        const nextDate = new Date(year, month + 1, j);
        const iso = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(j).padStart(2, '0')}`;
        cells.push({ dayNum: j, iso, isCurrentMonth: false, isPast: iso < todayIso, isToday: iso === todayIso });
      }
    }
    return cells;
  }, [calViewDate]);

  const formatSelectedDeliveryDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr + 'T00:00:00');
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const handleTargetDateChange = (newDate) => {
    setTargetDate(newDate);
    if (newDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const chosen = new Date(newDate + 'T00:00:00');
      chosen.setHours(0, 0, 0, 0);
      const diffTime = chosen.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 5) {
        setUrgency('HIGH (EMERGENCY AID)');
      } else if (diffDays <= 14) {
        setUrgency('MEDIUM (URGENT REHABILITATION)');
      } else {
        setUrgency('STABLE (CHARITABLE AID)');
      }
    } else {
      setUrgency('');
    }
  };

  const [documentUrl, setDocumentUrl] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [contactList, setContactList] = useState(['']);
  const [showAllTags, setShowAllTags] = useState(false);

  const handleAddContact = () => {
    if (contactList.length >= 5) return;
    setContactList(prev => [...prev, '']);
  };

  const handleContactChange = (index, value) => {
    const formatted = /^[0-9\s]+$/.test(value) ? formatPhoneNumber(value) : value;
    setContactList(prev => {
      const updated = [...prev];
      updated[index] = formatted;
      setContactInfo(updated.map(c => c.trim()).filter(Boolean).join(' • '));
      return updated;
    });
  };

  const handleRemoveContact = (index) => {
    setContactList(prev => {
      if (prev.length <= 1) {
        setContactInfo('');
        return [''];
      }
      const updated = prev.filter((_, i) => i !== index);
      setContactInfo(updated.map(c => c.trim()).filter(Boolean).join(' • '));
      return updated;
    });
  };

  const formatUrgencyDisplay = (urg) => {
    if (!urg) return '';
    const u = String(urg).toUpperCase();
    if (u.includes('HIGH') || u.includes('CRITICAL')) return 'Critical Emergency (≤ 5 Days)';
    if (u.includes('MEDIUM') || u.includes('URGENT') || u.includes('REHAB')) return 'Urgent Relief (6–14 Days)';
    if (u.includes('STABLE') || u.includes('STANDARD') || u.includes('CHARITABLE')) return 'Standard Operations (> 14 Days)';
    return urg;
  };

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
  const [showDeclareDepositModal, setShowDeclareDepositModal] = useState(false);
  const [txModal, setTxModal] = useState({ show: false, step: 0, hash: '', type: '', error: '', isLocal: false });

  // ── Reusable Payment QR Codes from NGO Settings Library ──
  const [savedQrList, setSavedQrList] = useState([]);
  const [showSelectQrModal, setShowSelectQrModal] = useState(null); // 'GCash' | 'Maya' | 'Bank' | null
  const [saveToLibraryChecked, setSaveToLibraryChecked] = useState(false);
  const [selectedGcashQrId, setSelectedGcashQrId] = useState(null);
  const [selectedMayaQrId, setSelectedMayaQrId] = useState(null);
  const [selectedBankQrId, setSelectedBankQrId] = useState(null);

  const fetchSavedQrCodes = async () => {
    try {
      const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/organization/qr-codes`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setSavedQrList(list);

        // Pre-select default GCash QR if not already set
        const defaultGcash = list.find(q => q.payment_method === 'GCash' && q.is_default);
        if (defaultGcash && !gcashQrUrl) {
          setSelectedGcashQrId(defaultGcash.id);
          setGcashQrUrl(defaultGcash.qr_image_url);
          if (defaultGcash.account_name && !gcashName) setGcashName(defaultGcash.account_name);
          if (defaultGcash.account_number && !gcashNumber) setGcashNumber(formatPhoneNumber(defaultGcash.account_number));
        }

        // Pre-select default Maya QR if not already set
        const defaultMaya = list.find(q => q.payment_method === 'Maya' && q.is_default);
        if (defaultMaya && !mayaQrUrl) {
          setSelectedMayaQrId(defaultMaya.id);
          setMayaQrUrl(defaultMaya.qr_image_url);
          if (defaultMaya.account_name && !mayaName) setMayaName(defaultMaya.account_name);
          if (defaultMaya.account_number && !mayaNumber) setMayaNumber(formatPhoneNumber(defaultMaya.account_number));
        }

        // Pre-select default Bank QR if not already set
        const defaultBank = list.find(q => q.payment_method === 'Bank' && q.is_default);
        if (defaultBank && !bankQrUrl) {
          setSelectedBankQrId(defaultBank.id);
          setBankQrUrl(defaultBank.qr_image_url);
          if (defaultBank.account_name && !bankAccountName) setBankAccountName(defaultBank.account_name);
          if (defaultBank.account_number && !bankAccountNumber) setBankAccountNumber(formatPhoneNumber(defaultBank.account_number));
        }
      }
    } catch (e) {
      console.warn('Failed to fetch saved QR codes:', e);
    }
  };

  useEffect(() => {
    fetchSavedQrCodes();
  }, []);

  const handleSelectSavedQr = (qr) => {
    if (qr.payment_method === 'GCash') {
      setSelectedGcashQrId(qr.id);
      setGcashQrUrl(qr.qr_image_url);
      if (qr.account_name) setGcashName(qr.account_name);
      if (qr.account_number) setGcashNumber(formatPhoneNumber(qr.account_number));
      showSuccess(`Assigned "${qr.custom_name}" GCash QR to this campaign!`, 'QR Code Assigned');
    } else if (qr.payment_method === 'Maya') {
      setSelectedMayaQrId(qr.id);
      setMayaQrUrl(qr.qr_image_url);
      if (qr.account_name) setMayaName(qr.account_name);
      if (qr.account_number) setMayaNumber(formatPhoneNumber(qr.account_number));
      showSuccess(`Assigned "${qr.custom_name}" Maya QR to this campaign!`, 'QR Code Assigned');
    } else if (qr.payment_method === 'Bank') {
      setSelectedBankQrId(qr.id);
      setBankQrUrl(qr.qr_image_url);
      if (qr.account_name) setBankAccountName(qr.account_name);
      if (qr.account_number) setBankAccountNumber(formatPhoneNumber(qr.account_number));
      showSuccess(`Assigned "${qr.custom_name}" Bank QR to this campaign!`, 'QR Code Assigned');
    }
    setShowSelectQrModal(null);
  };

  const handleDeleteSavedQr = async (qrId, e) => {
    if (e) e.stopPropagation();
    try {
      const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/organization/qr-codes/${qrId}`, {
        method: 'DELETE',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      if (res.ok) {
        showSuccess('QR code removed from reusable library.', 'Deleted');
        fetchSavedQrCodes();
      }
    } catch (err) {
      console.warn('Failed to delete QR:', err);
    }
  };

  // ── Module B: AI Smart Budget & Campaign Generator State ──
  const [showAiBudgetModal, setShowAiBudgetModal] = useState(false);
  const [aiDisasterType, setAiDisasterType] = useState('Typhoon');
  const [aiSeverityRating, setAiSeverityRating] = useState('Signal 3');
  const [aiBeneficiariesCount, setAiBeneficiariesCount] = useState(500);
  const [aiRegion, setAiRegion] = useState('Eastern Visayas (Southern Leyte)');
  const [aiBudgetLoading, setAiBudgetLoading] = useState(false);
  const [aiBudgetResult, setAiBudgetResult] = useState(null);

  const handleGenerateAiBudget = async () => {
    setAiBudgetLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || (
        window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
          ? 'http://localhost:3001'
          : 'https://bbdrts-backend-api.onrender.com'
      );
      const res = await fetch(`${apiUrl}/api/ai/generate-campaign-budget`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disasterType: aiDisasterType,
          severityRating: aiSeverityRating,
          beneficiariesCount: aiBeneficiariesCount,
          region: aiRegion
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate budget');
      setAiBudgetResult(data);
    } catch (err) {
      console.warn('AI Budget Generation error, using local fallback:', err);
      // Deterministic client fallback if offline
      setAiBudgetResult({
        totalBudgetPhp: Math.round(aiBeneficiariesCount * 1250 * 1.25),
        totalBudgetEth: Number(((aiBeneficiariesCount * 1250 * 1.25) / 170000).toFixed(4)),
        unitCostPerFamily: 1563,
        unitDescription: '₱1,563 per family (Sphere Humanitarian Standard: 7-day food pack, clean water, shelter tarps, first-aid)',
        primaryNeeds: ['Potable Drinking Water', 'Rice & Ready-to-Eat Food Packs', 'Tarpaulins & Roofing Materials', 'Emergency First-Aid Kits'],
        allocations: { foodWater: 45, shelter: 25, medical: 20, logistics: 10 },
        campaignTitle: `Emergency ${aiDisasterType} Relief Drive: ${aiRegion}`,
        campaignDescription: `In response to the ${aiDisasterType} affecting ${aiRegion} (${aiSeverityRating}), this campaign mobilizes immediate humanitarian aid for ${Number(aiBeneficiariesCount).toLocaleString()} families. Funds are allocated according to international Sphere Humanitarian standards: 45% Food & Water, 25% Emergency Shelter, 20% Medical Care, and 10% Logistics. All donations are permanently audited on the blockchain ledger.`,
        beneficiariesImpact: `${Number(aiBeneficiariesCount).toLocaleString()} families across high-risk barangays in ${aiRegion}`,
        generatedBy: 'SPHERE_HUMANITARIAN_MATRIX'
      });
    } finally {
      setAiBudgetLoading(false);
    }
  };

  const handleApplyAiBudget = () => {
    if (!aiBudgetResult) return;
    setTitle(aiBudgetResult.campaignTitle || `Emergency ${aiDisasterType} Relief`);
    setTargetAmount(String(aiBudgetResult.totalBudgetPhp || ''));
    setCategory('DR');
    setUrgency(aiSeverityRating.includes('4') || aiSeverityRating.includes('5') ? 'Critical' : 'High');
    setDescription(aiBudgetResult.campaignDescription || '');
    setBeneficiariesImpact(aiBudgetResult.beneficiariesImpact || '');
    setLocationRegion(aiRegion);
    setShowAiBudgetModal(false);
    showSuccess?.('AI Smart Budget & Humanitarian Allocations applied to campaign!', 'AI Budget Applied');
  };

  const handleGcashQrUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showWarning('Please upload a valid image file (PNG, JPG, WebP).', 'Invalid File');
      return;
    }

    try {
      showSuccess('Extracting pure GCash QR code & recipient details...', 'Processing QR');
      const cropResult = await autoCropQrScreenshot(file);
      const { croppedUrl, wasCropped } = cropResult;
      setGcashQrUrl(croppedUrl);

      // Always extract Recipient Name & Number from the pre-crop text strip / EMVCo Tag 59
      try {
        const { detectedName, detectedNumber, isMaskedNumber } = await extractQrVoucherText(cropResult);
        if (detectedName) {
          setGcashName(detectedName);
        }
        if (detectedNumber && (!isMaskedNumber || !gcashNumber)) {
          setGcashNumber(isMaskedNumber ? detectedNumber : formatPhoneNumber(detectedNumber));
        }
        if (detectedName) {
          showSuccess(`Pure GCash QR extracted · Recipient detected: ${detectedName}`, 'QR & Recipient Ready');
        } else if (wasCropped) {
          showSuccess('Clean GCash QR code extracted cleanly!', 'QR Extracted');
        } else {
          showSuccess('GCash QR Code uploaded successfully!', 'QR Code Attached');
        }
      } catch (_) {
        showSuccess(wasCropped ? 'Clean GCash QR code extracted cleanly!' : 'GCash QR Code uploaded successfully!', 'QR Code Attached');
      }
    } catch (err) {
      console.warn('QR upload error:', err);
      const reader = new FileReader();
      reader.onload = (uploadEvent) => setGcashQrUrl(uploadEvent.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleMayaQrUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showWarning('Please upload a valid image file (PNG, JPG, WebP).', 'Invalid File');
      return;
    }

    try {
      showSuccess('Extracting pure Maya QR code & recipient details...', 'Processing QR');
      const cropResult = await autoCropQrScreenshot(file);
      const { croppedUrl, wasCropped } = cropResult;
      setMayaQrUrl(croppedUrl);
      try {
        const { detectedName, detectedNumber, isMaskedNumber } = await extractQrVoucherText(cropResult);
        if (detectedName) setMayaName(detectedName);
        if (detectedNumber && (!isMaskedNumber || !mayaNumber)) {
          setMayaNumber(isMaskedNumber ? detectedNumber : formatPhoneNumber(detectedNumber));
        }
        if (detectedName) {
          showSuccess(`Pure Maya QR extracted · Recipient detected: ${detectedName}`, 'QR & Recipient Ready');
        } else if (wasCropped) {
          showSuccess('Clean Maya QR code extracted cleanly!', 'QR Extracted');
        } else {
          showSuccess('Maya QR Code uploaded successfully!', 'QR Code Attached');
        }
      } catch (_) {
        showSuccess(wasCropped ? 'Clean Maya QR code extracted cleanly!' : 'Maya QR Code uploaded successfully!', 'QR Code Attached');
      }
    } catch (err) {
      console.warn('Maya QR upload error:', err);
      const reader = new FileReader();
      reader.onload = (uploadEvent) => setMayaQrUrl(uploadEvent.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleBankQrUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showWarning('Please upload a valid image file (PNG, JPG, WebP).', 'Invalid File');
      return;
    }
    try {
      const cropResult = await autoCropQrScreenshot(file);
      setBankQrUrl(cropResult.croppedUrl);
      try {
        const { detectedName } = await extractQrVoucherText(cropResult);
        if (detectedName) {
          setBankAccountName(detectedName);
          showSuccess(`Pure Bank QR extracted · Account holder detected: ${detectedName}`, 'QR & Recipient Ready');
          return;
        }
      } catch (_) {}
      showSuccess(cropResult.wasCropped ? 'Clean Bank QR code extracted!' : 'Bank Transfer QR Code uploaded successfully!', 'QR Code Attached');
    } catch (_) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        setBankQrUrl(uploadEvent.target.result);
        showSuccess('Bank Transfer QR Code uploaded successfully!', 'QR Code Attached');
      };
      reader.readAsDataURL(file);
    }
  };

  // ── Disaster Aftermath & Ground Evidence Photos State (+ RA 10173 AI Face-Blur Privacy Shield) ──
  const [disasterImages, setDisasterImages] = useState([]);
  const [disasterImagesMeta, setDisasterImagesMeta] = useState([]);
  const [editingCampaignPhotoIdx, setEditingCampaignPhotoIdx] = useState(null);
  const [autoBlurCampaignFaces, setAutoBlurCampaignFaces] = useState(true);
  useEffect(() => {
    preloadFaceDetector().catch(() => {});
  }, []);
  const [disasterProcessLabel, setDisasterProcessLabel] = useState('Optimizing & Compressing Photos...');
  const [isProcessingDisasterImages, setIsProcessingDisasterImages] = useState(false);
  const [draggedPhotoIdx, setDraggedPhotoIdx] = useState(null);
  const [dragOverPhotoIdx, setDragOverPhotoIdx] = useState(null);
  const disasterFileInputRef = useRef(null);
  const [deployStep, setDeployStep] = useState(1);
  const [previewViewMode, setPreviewViewMode] = useState('list');

  const moveDisasterImage = (fromIdx, toIdx) => {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0) return;
    setDisasterImages(prev => {
      if (fromIdx >= prev.length || toIdx >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(fromIdx, 1);
      copy.splice(toIdx, 0, moved);
      return copy;
    });
    setDisasterImagesMeta(prev => {
      if (fromIdx >= prev.length || toIdx >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(fromIdx, 1);
      copy.splice(toIdx, 0, moved);
      return copy;
    });
  };

  const processAndCompressImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1200;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.82);
          resolve(compressed);
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleDisasterImagesUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files || files.length === 0) return;

    const remainingSlots = 10 - disasterImages.length;
    if (remainingSlots <= 0) {
      showWarning('Maximum of 10 disaster aftermath photos allowed per campaign.', 'Limit Reached');
      if (disasterFileInputRef.current) disasterFileInputRef.current.value = '';
      return;
    }

    const filesToProcess = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      showWarning(`Only the first ${remainingSlots} photo(s) were added (max 10 photos).`, 'Upload Limit');
    }

    setIsProcessingDisasterImages(true);
    setDisasterProcessLabel(autoBlurCampaignFaces ? 'AI Scanning & Blurring Faces (RA 10173)...' : 'Optimizing & Compressing Photos...');
    let totalFacesBlurred = 0;

    try {
      const processedUrls = [];
      const processedMeta = [];
      for (const file of filesToProcess) {
        if (!file.type.startsWith('image/')) {
          showWarning(`Skipped "${file.name}": not an image.`, 'Invalid File');
          continue;
        }
        const dataUrl = await processAndCompressImage(file);
        let finalUrl = dataUrl;
        let meta = { originalUrl: dataUrl, blurredUrl: null, boxes: [], facesBlurred: 0, isBlurred: false };

        if (autoBlurCampaignFaces) {
          setDisasterProcessLabel(`AI protecting faces in "${file.name}" (RA 10173)...`);
          const blurRes = await blurFacesInImage(dataUrl);
          if (blurRes.blurred && blurRes.facesBlurred > 0) {
            finalUrl = blurRes.url;
            meta = {
              originalUrl: dataUrl,
              blurredUrl: blurRes.blurredUrl,
              boxes: Array.isArray(blurRes.boxes) ? blurRes.boxes : [],
              facesBlurred: blurRes.facesBlurred,
              isBlurred: true
            };
            totalFacesBlurred += blurRes.facesBlurred;
          }
        }

        processedUrls.push(finalUrl);
        processedMeta.push(meta);
      }

      if (processedUrls.length > 0) {
        setDisasterImages(prev => [...prev, ...processedUrls]);
        setDisasterImagesMeta(prev => [...prev, ...processedMeta]);
        showSuccess(
          totalFacesBlurred > 0
            ? `${processedUrls.length} photo(s) attached · AI blurred ${totalFacesBlurred} face${totalFacesBlurred === 1 ? '' : 's'} (RA 10173)!`
            : `${processedUrls.length} photo(s) attached successfully!`,
          totalFacesBlurred > 0 ? 'Photos Attached & Privacy Protected' : 'Photos Attached'
        );
      }
    } catch (err) {
      console.error('Failed to process disaster images:', err);
      showWarning('Could not process some image files.', 'Processing Error');
    } finally {
      setIsProcessingDisasterImages(false);
      setDisasterProcessLabel('Optimizing & Compressing Photos...');
      if (disasterFileInputRef.current) disasterFileInputRef.current.value = '';
    }
  };

  const toggleDisasterImageBlur = async (targetIdx) => {
    const currentUrl = disasterImages[targetIdx];
    const currentMeta = disasterImagesMeta[targetIdx];
    if (!currentUrl) return;

    if (currentMeta?.blurredUrl) {
      const nextBlurred = !currentMeta.isBlurred;
      const nextUrl = nextBlurred ? currentMeta.blurredUrl : currentMeta.originalUrl;
      setDisasterImages(prev => prev.map((u, i) => (i === targetIdx ? nextUrl : u)));
      setDisasterImagesMeta(prev => prev.map((m, i) => (i === targetIdx ? { ...m, isBlurred: nextBlurred } : m)));
      return;
    }

    setIsProcessingDisasterImages(true);
    setDisasterProcessLabel('AI scanning photo for faces (RA 10173)...');
    try {
      const base = currentMeta?.originalUrl || currentUrl;
      const res = await blurFacesInImage(base);
      if (res.blurred && res.facesBlurred > 0) {
        setDisasterImages(prev => prev.map((u, i) => (i === targetIdx ? res.url : u)));
        setDisasterImagesMeta(prev => {
          const copy = [...prev];
          copy[targetIdx] = {
            originalUrl: base,
            blurredUrl: res.blurredUrl,
            boxes: Array.isArray(res.boxes) ? res.boxes : [],
            facesBlurred: res.facesBlurred,
            isBlurred: true
          };
          return copy;
        });
        showSuccess(`Blurred ${res.facesBlurred} face${res.facesBlurred === 1 ? '' : 's'} for RA 10173 privacy.`, 'Faces Protected');
      } else if (res.error) {
        showWarning(`Face detection could not run (${res.error}). Please retry.`, 'Privacy Scanner Unavailable');
      } else {
        showWarning('No human faces detected in this photo.', 'Privacy Scan Complete');
      }
    } finally {
      setIsProcessingDisasterImages(false);
      setDisasterProcessLabel('Optimizing & Compressing Photos...');
    }
  };

  const removeDisasterImage = (indexToRemove) => {
    setDraggedPhotoIdx(null);
    setDragOverPhotoIdx(null);
    setDisasterImages(prev => prev.filter((_, idx) => idx !== indexToRemove));
    setDisasterImagesMeta(prev => prev.filter((_, idx) => idx !== indexToRemove));
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
  const [orgDonations, setOrgDonations] = useState([]);
  const [loadingOrgDonations, setLoadingOrgDonations] = useState(false);

  const [pendingDonations, setPendingDonations] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);

  const myCampaigns = (campaigns || []).filter((c) => {
    if (currentUser?.id && c.orgId) {
      return Number(c.orgId) === Number(currentUser.id);
    }
    return Boolean(walletAddress) && c.orgAddress?.toLowerCase() === walletAddress?.toLowerCase();
  });

  const totalRaisedByMe = (myCampaigns || [])
    .reduce((s, c) => s + parseFloat(c.currentAmount || 0), 0);

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

  const handleGranularAddressFromMap = ({ street: s = '', barangay: b = '', psgcBarangays = [], city: c = '', province: p = '', region: r = '', country: cnt = 'Philippines', zip: z = '', landmark: l = '' }) => {
    const resolvedRegion = r || (p ? getRegionForProvince(p) : '') || '';
    const normCityKey = (v) => String(v || '').toLowerCase().replace(/^city of\s+/i, '').replace(/\s+city$/i, '').trim();
    const isSameCity = Boolean(city && c && normCityKey(city) === normCityKey(c));
    // Directly apply mathematically verified PSA/NAMRIA polygon barangay!
    // If offshore/unmatched inside same city, preserve user's existing barangay; if moving to a different city, clear stale barangay.
    const nextBarangay = b || (isSameCity ? barangay : '');

    setStreet(s);
    setBarangay(nextBarangay);
    setCity(c);
    setProvince(p);
    setRegion(resolvedRegion);
    setCountry(cnt || 'Philippines');
    setZipCode(z);
    setLandmark(l);
    if (Array.isArray(psgcBarangays) && psgcBarangays.length > 0 && c) {
      setPrefetchedPsgcBarangays({ city: c, list: psgcBarangays });
    }

    const constructed = [
      s,
      nextBarangay,
      c,
      p,
      resolvedRegion,
      z,
      cnt || 'Philippines',
      l ? `(Landmark: ${l})` : ''
    ].filter(Boolean).join(', ');

    setLocationRegion(constructed);
  };


  // Fetch Organization Received Donations
  const fetchOrgDonations = async (arg) => {
    const silent = Boolean(arg && typeof arg === 'object' && arg.silent === true);
    try {
      if (!silent) setLoadingOrgDonations(true);
      const token = localStorage.getItem('bbdrts_token');
      if (!token) return;
      const apiUrl = API_URL;
      const res = await fetch(`${apiUrl}/api/donations/me?_t=${Date.now()}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        setOrgDonations(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      if (!silent) console.error('Failed to fetch org donations:', err);
    } finally {
      if (!silent) setLoadingOrgDonations(false);
    }
  };

  const fetchPendingDonations = async (arg) => {
    const silent = Boolean(arg && typeof arg === 'object' && arg.silent === true);
    try {
      if (!silent) setLoadingPending(true);
      const token = localStorage.getItem('bbdrts_token');
      if (!token) return;
      const apiUrl = API_URL;
      const res = await fetch(`${apiUrl}/api/manual-donations/pending?_t=${Date.now()}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        setPendingDonations(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      if (!silent) console.error('Failed to fetch pending donations:', err);
    } finally {
      if (!silent) setLoadingPending(false);
    }
  };

  // ── Real NGO E-Wallet & Bank Slip Cross-Verification States ──
  const [verifyingDonation, setVerifyingDonation] = useState(null);
  const [confirmedAmountPhp, setConfirmedAmountPhp] = useState('');
  const [confirmedRefNo, setConfirmedRefNo] = useState('');
  const [checkAccountVerified, setCheckAccountVerified] = useState(false);
  const [checkAmountMatched, setCheckAmountMatched] = useState(false);
  const [verifyingSubmitting, setVerifyingSubmitting] = useState(false);

  // Rejection modal states
  const [rejectingDonation, setRejectingDonation] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectingSubmitting, setRejectingSubmitting] = useState(false);

  const handleOpenVerification = (donation) => {
    setVerifyingDonation(donation);
    const phpVal = Math.round(parseFloat(donation.Amount || 0) * 170000);
    setConfirmedAmountPhp(String(phpVal));
    setConfirmedRefNo(donation.Reference_Number || donation.ai_result?.extractedRef || '');
    setCheckAccountVerified(false);
    setCheckAmountMatched(false);
  };

  const handleOpenRejection = (donation) => {
    setRejectingDonation(donation);
    setRejectionReason('Payment could not be verified in our official account statements.');
  };

  const handleConfirmApproval = async () => {
    if (!verifyingDonation) return;
    if (!checkAccountVerified || !checkAmountMatched) {
      showWarning('Please complete both verification checklist items before approving.', 'Audit Checklist Required');
      return;
    }
    const numericAmount = parseFloat(confirmedAmountPhp);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      showWarning('Please enter a valid received amount in PHP.', 'Invalid Amount');
      return;
    }

    setVerifyingSubmitting(true);
    try {
      const token = localStorage.getItem('bbdrts_token');
      const apiUrl = API_URL;
      const finalRefToSend = (confirmedRefNo.trim() || verifyingDonation.Reference_Number || verifyingDonation.ai_result?.extractedRef || '').trim();
      const res = await fetch(`${apiUrl}/api/manual-donations/${verifyingDonation.Manual_ID}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          confirmed_amount_php: numericAmount,
          reference_number: finalRefToSend || undefined
        })
      });
      const data = await res.json();
      if (res.ok) {
        showSuccess(data.message || `Donation of ₱${numericAmount.toLocaleString()} verified and recorded to blockchain ledger.`, 'Payment Confirmed & Recorded');
        setVerifyingDonation(null);
        fetchPendingDonations();
        fetchOrgDonations();
        if (typeof fetchCampaigns === 'function') fetchCampaigns();
      } else {
        showError(data.error || 'Failed to approve donation.', 'Verification Failed');
      }
    } catch (error) {
      showError(error.message, 'Verification Error');
    } finally {
      setVerifyingSubmitting(false);
    }
  };

  const handleConfirmRejection = async () => {
    if (!rejectingDonation) return;
    if (!rejectionReason.trim()) {
      showWarning('Please provide an audit reason for rejecting this payment slip.', 'Reason Required');
      return;
    }

    setRejectingSubmitting(true);
    try {
      const token = localStorage.getItem('bbdrts_token');
      const apiUrl = API_URL;
      const res = await fetch(`${apiUrl}/api/manual-donations/${rejectingDonation.Manual_ID}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          rejection_reason: rejectionReason.trim()
        })
      });
      const data = await res.json();
      if (res.ok) {
        showSuccess(data.message || 'Donation slip rejected and donor notified.', 'Donation Rejected');
        setRejectingDonation(null);
        fetchPendingDonations();
        fetchOrgDonations();
      } else {
        showError(data.error || 'Failed to reject donation.', 'Error');
      }
    } catch (error) {
      showError(error.message, 'Error');
    } finally {
      setRejectingSubmitting(false);
    }
  };

  // ── Post-Signup SEC Institutional Accreditation & KYC State ──
  const [secRegNo, setSecRegNo] = useState('');
  const [dswdNo, setDswdNo] = useState('');
  const [boardMembersText, setBoardMembersText] = useState('');
  const [tinNo, setTinNo] = useState('');
  const [registeredAddress, setRegisteredAddress] = useState('');
  const [repName, setRepName] = useState('');
  const [repPosition, setRepPosition] = useState('');
  const [repIdType, setRepIdType] = useState('Philippine Passport');
  const [repIdNo, setRepIdNo] = useState('');
  const [primaryIdType, setPrimaryIdType] = useState('Philippine Passport');
  const [primaryIdNumber, setPrimaryIdNumber] = useState('');
  const [primaryIdUrl, setPrimaryIdUrl] = useState('');
  const [secondaryIdType, setSecondaryIdType] = useState('LTO Driver\'s License');
  const [secondaryIdNumber, setSecondaryIdNumber] = useState('');
  const [secondaryIdUrl, setSecondaryIdUrl] = useState('');
  const [previewDocModal, setPreviewDocModal] = useState({ open: false, title: '', url: '', regNo: '' });
  const [affirmationChecked, setAffirmationChecked] = useState(false);
  const [secCertUrl, setSecCertUrl] = useState('');
  const [kycLoading, setKycLoading] = useState(false);
  const [kycSaving, setKycSaving] = useState(false);
  const [kycStepText, setKycStepText] = useState('');
  const [kycStatusData, setKycStatusData] = useState(null);
  const [viewingKycCert, setViewingKycCert] = useState(false);
  const [showKycFormOverride, setShowKycFormOverride] = useState(false);
  const [showGuidedTour, setShowGuidedTour] = useState(false);

  const userTourKey = currentUser?.id
    ? `bbdrts_tour_ngo_${currentUser.id}`
    : currentUser?.email
      ? `bbdrts_tour_ngo_${currentUser.email}`
      : 'bbdrts_tour_ngo_done';

  // Auto-launch Guided Tour ONLY for brand new NGO registrations, AFTER Workspace Setup closes
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
          const targetEl = document.querySelector('#tour-ngo-welcome') || document.querySelector('#tour-ngo-profile');
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
    }, 100);
  };

  const handleCloseTour = () => setShowGuidedTour(false);

  const ngoTourSteps = useMemo(() => [
    {
      target: '#tour-ngo-welcome',
      title: 'Command Center & Organization Overview',
      icon: 'corporate_fare',
      badge: 'Operations Hub',
      placement: 'bottom',
      align: 'start',
      description: 'Your command center header displays your organization name, SEC accreditation badge, and gasless Sepolia audit status. Use the action buttons to review your verification status or verify the public ledger on Etherscan.'
    },
    {
      target: '#tour-ngo-metrics',
      title: 'Operational Metrics & Escrow Status',
      icon: 'analytics',
      badge: 'Mission Analytics',
      placement: 'bottom',
      align: 'center',
      description: 'Monitor your key organization metrics: active relief campaigns, total PHP donations received across GCash, Maya, cards, and bank transfer, completed milestones, and verified escrow funds.'
    },
    {
      target: '#tour-ngo-tab-sec',
      title: 'SEC & Legal Accreditation Tab',
      icon: 'verified_user',
      badge: 'Legal Compliance',
      placement: 'right',
      align: 'center',
      description: 'Access the accreditation tab to submit and track your Philippine SEC non-stock registration, DSWD licenses, and board member verifications required to deploy verified on-chain appeals.'
    },
    {
      target: '#tour-ngo-tab-create',
      title: 'Create Relief Campaign Tab',
      icon: 'rocket_launch',
      badge: 'Campaign Deployment',
      placement: 'right',
      align: 'center',
      description: 'Launch emergency appeals by setting funding goals in Philippine Pesos (PHP), calamity type, urgency priority, affected Philippine location, and milestone-based escrow delivery schedules.'
    },
    {
      target: '#tour-ngo-tab-my-campaigns',
      title: 'My Campaigns & Proof Upload Tab',
      icon: 'add_a_photo',
      badge: 'Ground Operations',
      placement: 'right',
      align: 'center',
      description: 'Manage active relief campaigns and submit milestone delivery proofs (geotagged distribution photos, merchant receipts, and beneficiary logs) to unlock subsequent escrow funding tiers.'
    },
    {
      target: '#tour-ngo-tab-ledger',
      title: 'Financial Ledger & Audit Tab',
      icon: 'account_balance',
      badge: 'Audit Ledger',
      placement: 'right',
      align: 'center',
      description: 'Review multi-channel financial reconciliation across GCash, Maya, cards, and bank deposits with gasless Sepolia audit trails and exportable compliance reports.'
    },
    {
      target: '#tour-ngo-tab-radar',
      title: 'Relief Radar Tab',
      icon: 'radar',
      badge: 'Weather & Logistics',
      placement: 'right',
      align: 'center',
      description: 'Access the interactive Philippine map combining real-time PAGASA Doppler radar precipitation feeds with relief campaign pins to coordinate logistics and emergency aid dispatch.'
    },
    {
      target: '#tour-ngo-sepolia-node',
      title: 'Blockchain Status & Tutorial Replay',
      icon: 'hub',
      badge: 'System Status',
      placement: 'right',
      align: 'end',
      description: 'Shows the live status of the blockchain network connected to this system. You can restart this guided walkthrough anytime from the "Guided Tutorial" button in the sidebar.'
    }
  ], []);

  const fetchKycData = async (arg) => {
    const silent = Boolean(arg && typeof arg === 'object' && arg.silent === true);
    try {
      if (!silent) setKycLoading(true);
      const token = localStorage.getItem('bbdrts_token');
      if (!token) return;
      const apiUrl = API_URL;
      const res = await fetch(`${apiUrl}/api/organization/kyc?_t=${Date.now()}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        setKycStatusData(data);
        if (silent) return;
        if (data.secRegistrationNo) setSecRegNo(data.secRegistrationNo);
        if (data.dswdAccreditationNo) setDswdNo(data.dswdAccreditationNo);
        if (data.boardMembers) setBoardMembersText(data.boardMembers);
        if (data.tinNumber) setTinNo(data.tinNumber);
        if (data.registeredAddress) setRegisteredAddress(data.registeredAddress);
        if (data.authorizedRepName) setRepName(data.authorizedRepName);
        if (data.authorizedRepPosition) setRepPosition(data.authorizedRepPosition);
        if (data.authorizedRepIdType) setRepIdType(data.authorizedRepIdType);
        if (data.authorizedRepIdNo) setRepIdNo(data.authorizedRepIdNo);
        if (data.primaryIdType) setPrimaryIdType(data.primaryIdType);
        if (data.primaryIdNumber) setPrimaryIdNumber(data.primaryIdNumber);
        if (data.primaryIdUrl) setPrimaryIdUrl(normalizeSecDocUrl(data.primaryIdUrl));
        if (data.secondaryIdType) setSecondaryIdType(data.secondaryIdType);
        if (data.secondaryIdNumber) setSecondaryIdNumber(data.secondaryIdNumber);
        if (data.secondaryIdUrl) setSecondaryIdUrl(normalizeSecDocUrl(data.secondaryIdUrl));
        if (data.secCertificateUrl) setSecCertUrl(normalizeSecDocUrl(data.secCertificateUrl));
      }
    } catch (err) {
      if (!silent) console.error('Failed to load KYC data:', err);
    } finally {
      if (!silent) setKycLoading(false);
    }
  };

  // Live real-time sync: immediately reflect incoming donations, manual receipts, KYC status, and QR updates
  useRealtimeSync(
    ['donations', 'manual_donations', 'campaigns', 'disbursements'],
    () => {
      fetchOrgDonations({ silent: true });
      fetchPendingDonations({ silent: true });
    },
    { debounceMs: 250 }
  );

  useRealtimeSync(
    ['organizations', 'profile'],
    () => fetchKycData({ silent: true }),
    { debounceMs: 300 }
  );

  useRealtimeSync(
    ['qr_codes'],
    () => fetchSavedQrCodes(),
    { debounceMs: 300 }
  );

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

  const handlePrimaryIdUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') && !file.type.includes('pdf')) {
      showWarning('Please upload a valid image or PDF document.', 'Invalid File');
      return;
    }
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setPrimaryIdUrl(normalizeSecDocUrl(uploadEvent.target.result));
      showSuccess(`${primaryIdType} document attached!`, 'Primary ID Attached');
    };
    reader.readAsDataURL(file);
  };

  const handleSecondaryIdUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') && !file.type.includes('pdf')) {
      showWarning('Please upload a valid image or PDF document.', 'Invalid File');
      return;
    }
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setSecondaryIdUrl(normalizeSecDocUrl(uploadEvent.target.result));
      showSuccess(`${secondaryIdType} document attached!`, 'Secondary ID Attached');
    };
    reader.readAsDataURL(file);
  };

  // Live Dossier Readiness Evaluation (5 Core Institutional Checkpoints)
  const dossierCompletion = useMemo(() => {
    let score = 0;
    const total = 5;
    const items = [
      { id: 1, label: 'Entity Profile', desc: 'SEC Number, TIN & Registered Address', done: Boolean(secRegNo?.trim() && tinNo?.trim() && registeredAddress?.trim()) },
      { id: 2, label: 'Authorized Signatory', desc: 'Representative Name, Position & Trustees', done: Boolean(repName?.trim() && repPosition?.trim() && boardMembersText?.trim()) },
      { id: 3, label: 'Dual Government IDs', desc: 'Primary & Secondary ID Files Attached', done: Boolean(primaryIdNumber?.trim() && primaryIdUrl && secondaryIdNumber?.trim() && secondaryIdUrl) },
      { id: 4, label: 'SEC Certificate Vault', desc: 'Certificate of Incorporation Uploaded', done: Boolean(secCertUrl) },
      { id: 5, label: 'Legal Affirmation', desc: 'RA 11232 Perjury & Authority Declaration', done: Boolean(affirmationChecked) }
    ];
    items.forEach(it => { if (it.done) score++; });
    const percent = Math.round((score / total) * 100);
    return { score, total, percent, items };
  }, [secRegNo, tinNo, registeredAddress, repName, repPosition, boardMembersText, primaryIdNumber, primaryIdUrl, secondaryIdNumber, secondaryIdUrl, secCertUrl, affirmationChecked]);

  const handleAutofillDemoSec = () => {
    setSecRegNo('SEC-CN2021-08492');
    setTinNo('000-842-192-000');
    setRegisteredAddress('Philippine Red Cross National HQ, 37 EDSA cor. Boni Ave., Mandaluyong City, Metro Manila');
    setDswdNo('DSWD-SB-A-2024-0193');
    setRepName('Gwendolyn Pang');
    setRepPosition('Secretary General & Authorized Trustee');
    setRepIdType('Philippine Passport');
    setRepIdNo('P8942103B');
    setBoardMembersText('Chairman: Richard Gordon | SecGen: Gwendolyn Pang | Trustee: Dr. Benjamin Go');
    setAffirmationChecked(true);

    // 1. Generate realistic Philippine Passport SVG (Primary ID)
    const passportSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 380" width="600" height="380"><rect width="600" height="380" fill="#0f172a" rx="12"/><rect x="12" y="12" width="576" height="356" fill="#1e293b" stroke="#38bdf8" stroke-width="2" rx="8"/><text x="300" y="45" font-family="sans-serif" font-size="12" font-weight="700" fill="#94a3b8" text-anchor="middle" letter-spacing="2">REPUBLIC OF THE PHILIPPINES / REPUBLIKA NG PILIPINAS</text><text x="300" y="70" font-family="sans-serif" font-size="18" font-weight="800" fill="#f8fafc" text-anchor="middle">PASAPORTE / PASSPORT</text><rect x="40" y="100" width="130" height="170" fill="#0f172a" stroke="#38bdf8" stroke-width="1.5" rx="6"/><circle cx="105" cy="165" r="40" fill="#334155"/><path d="M65,245 Q105,200 145,245" fill="#475569"/><text x="105" y="260" font-family="sans-serif" font-size="9" fill="#94a3b8" text-anchor="middle">GOVERNMENT OFFICIAL</text><text x="200" y="125" font-family="sans-serif" font-size="10" fill="#94a3b8">PASSPORT NO. / NUMERO NG PASAPORTE</text><text x="200" y="145" font-family="monospace" font-size="16" font-weight="700" fill="#38bdf8">P8942103B</text><text x="200" y="175" font-family="sans-serif" font-size="10" fill="#94a3b8">SURNAME / APELYIDO</text><text x="200" y="195" font-family="sans-serif" font-size="15" font-weight="700" fill="#ffffff">PANG</text><text x="200" y="225" font-family="sans-serif" font-size="10" fill="#94a3b8">GIVEN NAMES / MGA PANGALAN</text><text x="200" y="245" font-family="sans-serif" font-size="14" font-weight="700" fill="#ffffff">GWENDOLYN TSANG</text><text x="200" y="275" font-family="sans-serif" font-size="10" fill="#94a3b8">NATIONALITY / PAGKAMAMAMAYAN</text><text x="200" y="295" font-family="sans-serif" font-size="13" font-weight="600" fill="#ffffff">FILIPINO (PHL)</text><rect x="40" y="315" width="520" height="36" fill="#0f172a" rx="4"/><text x="55" y="338" font-family="monospace" font-size="12" fill="#38bdf8" letter-spacing="3">P&lt;PHLPANG&lt;&lt;GWENDOLYN&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</text></svg>`;
    const passB64 = window.btoa(unescape(encodeURIComponent(passportSvg)));
    setPrimaryIdType('Philippine Passport');
    setPrimaryIdNumber('P8942103B');
    setPrimaryIdUrl(`data:image/svg+xml;base64,${passB64}`);

    // 2. Generate realistic Philippine Driver's License SVG (Secondary ID)
    const dlSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 380" width="600" height="380"><rect width="600" height="380" fill="#042f2e" rx="12"/><rect x="12" y="12" width="576" height="356" fill="#064e3b" stroke="#10b981" stroke-width="2" rx="8"/><text x="300" y="45" font-family="sans-serif" font-size="11" font-weight="700" fill="#6ee7b7" text-anchor="middle" letter-spacing="1.5">REPUBLIC OF THE PHILIPPINES • DEPARTMENT OF TRANSPORTATION</text><text x="300" y="70" font-family="sans-serif" font-size="17" font-weight="800" fill="#ffffff" text-anchor="middle">LAND TRANSPORTATION OFFICE • DRIVER'S LICENSE</text><rect x="40" y="100" width="130" height="165" fill="#022c22" stroke="#10b981" stroke-width="1.5" rx="6"/><circle cx="105" cy="165" r="40" fill="#065f46"/><path d="M65,245 Q105,205 145,245" fill="#047857"/><text x="200" y="125" font-family="sans-serif" font-size="10" fill="#a7f3d0">LICENSE NO.</text><text x="200" y="145" font-family="monospace" font-size="16" font-weight="700" fill="#34d399">N02-18-938210</text><text x="200" y="175" font-family="sans-serif" font-size="10" fill="#a7f3d0">NAME (LAST, FIRST, MIDDLE)</text><text x="200" y="195" font-family="sans-serif" font-size="15" font-weight="700" fill="#ffffff">PANG, GWENDOLYN TSANG</text><text x="200" y="225" font-family="sans-serif" font-size="10" fill="#a7f3d0">ADDRESS</text><text x="200" y="245" font-family="sans-serif" font-size="13" font-weight="600" fill="#ffffff">MANDALUYONG CITY, METRO MANILA</text><text x="200" y="275" font-family="sans-serif" font-size="10" fill="#a7f3d0">EXPIRATION DATE</text><text x="200" y="295" font-family="monospace" font-size="13" font-weight="600" fill="#34d399">2032-10-18</text><rect x="40" y="315" width="520" height="32" fill="#022c22" rx="4"/><text x="55" y="335" font-family="monospace" font-size="11" fill="#6ee7b7">LTO SECURITY BARCODE &amp; BIOMETRICS VALIDATED</text></svg>`;
    const dlB64 = window.btoa(unescape(encodeURIComponent(dlSvg)));
    setSecondaryIdType('LTO Driver\'s License');
    setSecondaryIdNumber('N02-18-938210');
    setSecondaryIdUrl(`data:image/svg+xml;base64,${dlB64}`);

    // 3. Generate realistic Philippine SEC Certificate SVG
    const secCertSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" width="600" height="400"><rect width="600" height="400" fill="#fdfbf7" stroke="#b45309" stroke-width="6" rx="8"/><rect x="15" y="15" width="570" height="370" fill="none" stroke="#d97706" stroke-width="2" stroke-dasharray="8 4"/><text x="300" y="60" font-family="Georgia, serif" font-size="16" font-weight="bold" fill="#78350f" text-anchor="middle">REPUBLIC OF THE PHILIPPINES</text><text x="300" y="85" font-family="Georgia, serif" font-size="20" font-weight="bold" fill="#b45309" text-anchor="middle">SECURITIES AND EXCHANGE COMMISSION</text><text x="300" y="110" font-family="sans-serif" font-size="12" fill="#92400e" text-anchor="middle">SEC Building, EDSA, Greenhills, Mandaluyong City</text><line x1="100" y1="125" x2="500" y2="125" stroke="#b45309" stroke-width="2"/><text x="300" y="160" font-family="Georgia, serif" font-size="22" font-style="italic" fill="#1e293b" text-anchor="middle">CERTIFICATE OF INCORPORATION</text><text x="300" y="195" font-family="sans-serif" font-size="14" fill="#334155" text-anchor="middle">This is to certify that</text><text x="300" y="230" font-family="Georgia, serif" font-size="20" font-weight="bold" fill="#0f172a" text-anchor="middle">PHILIPPINE RED CROSS - SOUTHERN LEYTE CHAPTER</text><text x="300" y="260" font-family="sans-serif" font-size="13" fill="#475569" text-anchor="middle">is registered as a Non-Stock, Non-Profit Humanitarian Corporation</text><text x="300" y="295" font-family="monospace" font-size="15" font-weight="bold" fill="#b45309" text-anchor="middle">COMPANY REG. NO. SEC-CN2021-08492</text><text x="300" y="355" font-family="sans-serif" font-size="11" fill="#64748b" text-anchor="middle">Issued under Republic Act 11232 • Duly Verified & Seal Affixed</text></svg>`;
    const b64 = window.btoa(unescape(encodeURIComponent(secCertSvg)));
    setSecCertUrl(`data:image/svg+xml;base64,${b64}`);
    showSuccess('Complete Philippine SEC, BIR & Dual Government IDs populated!', 'Demo Credentials Ready');
  };

  const handleSaveKyc = async (e) => {
    e?.preventDefault();
    if (!secRegNo.trim() && !secCertUrl) {
      showWarning('Please enter your SEC Registration Number or upload the Certificate.', 'Missing Requirements');
      return;
    }
    if (!affirmationChecked) {
      showWarning('Please accept the legal compliance affirmation to proceed with submission.', 'Affirmation Required');
      return;
    }

    try {
      setKycSaving(true);
      setKycStepText('Verifying Certificate of Incorporation and organization seal...');

      const token = localStorage.getItem('bbdrts_token');
      const apiUrl = API_URL;

      const stepTimer = setTimeout(() => {
        setKycStepText('Validating SEC registration, BIR TIN, and AMLA dual government IDs...');
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
          dswd_accreditation_no: dswdNo.trim(),
          tin_number: tinNo.trim(),
          registered_address: registeredAddress.trim(),
          authorized_rep_name: repName.trim(),
          authorized_rep_position: repPosition.trim(),
          authorized_rep_id_type: primaryIdType,
          authorized_rep_id_no: primaryIdNumber,
          primary_id_type: primaryIdType,
          primary_id_number: primaryIdNumber.trim(),
          primary_id_url: primaryIdUrl,
          secondary_id_type: secondaryIdType,
          secondary_id_number: secondaryIdNumber.trim(),
          secondary_id_url: secondaryIdUrl
        })
      });

      clearTimeout(stepTimer);
      const data = await res.json();

      if (res.ok && data.success) {
        showSuccess(data.message || 'Verification Successful! Your organization is now accredited.', 'Verification Approved');
        if (currentUser) currentUser.verification_status = 'Approved';
        await fetchKycData();
      } else if (data.verification_status === 'Flagged') {
        showError(data.error || 'Maximum verification attempts exceeded. Account flagged for admin review.', 'Account Flagged');
        await fetchKycData();
      } else {
        showWarning(data.message || data.error || 'Document could not be verified. Please verify the SEC registration number and upload a legible certificate.', 'Verification Incomplete');
        await fetchKycData();
      }
    } catch (err) {
      console.error(err);
      showWarning('Network error during verification: ' + err.message, 'Connection Error');
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

  // Telemetry across all received donations for the organization
  const ledgerTelemetry = useMemo(() => {
    const list = orgDonations || [];
    let totalEth = 0;
    const railCounts = { gcash: 0, maya: 0, bank: 0 };
    list.forEach(d => {
      const amt = parseFloat(d.amount || 0) || 0;
      totalEth += amt;
      const m = String(d.paymentMethod || '').toUpperCase();
      if (m.includes('GCASH')) railCounts.gcash++;
      else if (m.includes('MAYA') || m.includes('PAYMAYA')) railCounts.maya++;
      else railCounts.bank++;
    });
    return {
      totalEth,
      totalPhp: Math.round(totalEth * 170000),
      totalCount: list.length,
      railCounts
    };
  }, [orgDonations]);

  // Filter & Sort Ledger Transactions
  const filteredLedger = useMemo(() => {
    return (orgDonations || [])
      .filter(d => {
        // Category filter
        if (ledgerFilter !== 'ALL') {
          const matchCamp = (campaigns || []).find(c => String(c.id) === String(d.campaignId));
          const campTitle = matchCamp ? formatCampaignTitle(matchCamp.title, matchCamp.id) : '';
          const isCharity = /charity|school|orphan|food|feed|community|aid|blood|medical/i.test(campTitle);
          if (ledgerFilter === 'DR' && isCharity) return false;
          if (ledgerFilter === 'CD' && !isCharity) return false;
        }

        // Payment Rail filter
        if (ledgerRailFilter !== 'ALL') {
          const m = String(d.paymentMethod || '').toUpperCase();
          if (ledgerRailFilter === 'GCASH' && !m.includes('GCASH')) return false;
          if (ledgerRailFilter === 'MAYA' && !m.includes('MAYA') && !m.includes('PAYMAYA')) return false;
          if (ledgerRailFilter === 'BANK' && !m.includes('BANK') && !m.includes('CARD') && !m.includes('CREDIT')) return false;
        }

        // Campaign filter
        if (ledgerCampaignFilter !== 'ALL') {
          if (String(d.campaignId) !== String(ledgerCampaignFilter)) return false;
        }

        // Search query filter
        if (searchQueryLedger.trim()) {
          const q = searchQueryLedger.toLowerCase().trim();
          const txHash = (d.txHash || '').toLowerCase();
          const matchCamp = (campaigns || []).find(c => String(c.id) === String(d.campaignId));
          const campTitle = matchCamp ? formatCampaignTitle(matchCamp.title, matchCamp.id).toLowerCase() : '';
          const donorName = (d.donorName || '').toLowerCase();
          const donorWallet = (d.donorWallet || '').toLowerCase();
          return txHash.includes(q) || campTitle.includes(q) || String(d.campaignId).includes(q) || donorName.includes(q) || donorWallet.includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        if (ledgerSort === 'AMOUNT_HIGH') return (parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0);
        if (ledgerSort === 'AMOUNT_LOW') return (parseFloat(a.amount) || 0) - (parseFloat(b.amount) || 0);
        if (ledgerSort === 'OLDEST') return (a.id || 0) - (b.id || 0);
        return (b.id || 0) - (a.id || 0);
      });
  }, [orgDonations, ledgerFilter, ledgerRailFilter, ledgerCampaignFilter, searchQueryLedger, ledgerSort, campaigns]);

  const totalPagesLedger = Math.ceil(((filteredLedger || []).length) / campaignsPerPage);
  const paginatedLedger = (filteredLedger || []).slice(
    (currentPageLedger - 1) * campaignsPerPage,
    currentPageLedger * campaignsPerPage
  );

  const [ngoLedgerExportOpen, setNgoLedgerExportOpen] = useState(false);

  // Organized NGO Ledger Exports (Blob UTF-8 BOM CSV, Multi-Sheet Excel, Printable Audit PDF)
  const getNgoDisplayTitle = () =>
    currentUser?.org_name || currentUser?.name || currentUser?.organization_name || 'Verified NGO';

  const handleExportLedgerCsv = () => {
    setNgoLedgerExportOpen(false);
    const list = filteredLedger && filteredLedger.length > 0 ? filteredLedger : (orgDonations || []);
    const file = exportNgoLedgerCsv({
      orgName: getNgoDisplayTitle(),
      donations: list,
      campaigns
    });
    showSuccess(`Exported ${list.length} ledger record${list.length === 1 ? '' : 's'} to "${file}".`, 'CSV Export Ready');
  };

  const handleExportLedgerExcel = () => {
    setNgoLedgerExportOpen(false);
    const list = filteredLedger && filteredLedger.length > 0 ? filteredLedger : (orgDonations || []);
    const file = exportNgoLedgerExcel({
      orgName: getNgoDisplayTitle(),
      donations: list,
      campaigns
    });
    showSuccess(`Generated Excel audit workbook "${file}" (${list.length} records).`, 'Excel Export Ready');
  };

  const handleExportLedgerPdf = () => {
    setNgoLedgerExportOpen(false);
    const list = filteredLedger && filteredLedger.length > 0 ? filteredLedger : (orgDonations || []);
    exportNgoAuditPdf({
      orgName: getNgoDisplayTitle(),
      donations: list,
      campaigns
    });
    showSuccess('Opened formatted A4 NGO Financial Audit Report.', 'Audit PDF Ready');
  };

  // Deploy Campaign Logic
  const handleCreateCampaign = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();

    // STRICT CHECK: Never deploy unless the user is on the final step (Step 5)
    if (deployStep < 5) {
      setDeployStep(s => Math.min(5, s + 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!title.trim()) {
      setDeployStep(1);
      return setTxModal({ show: true, step: 0, error: 'Please enter a campaign title in Step 1.' });
    }
    const parsedPhp = parseFloat(targetAmount);
    if (isNaN(parsedPhp) || parsedPhp <= 0) {
      setDeployStep(1);
      return setTxModal({ show: true, step: 0, error: 'Please enter a valid target fundraising goal in PHP (greater than ₱0) in Step 1.' });
    }
    if (!targetDate) {
      setDeployStep(1);
      return setTxModal({ show: true, step: 0, error: 'Please select a Target Due Date in Step 1.' });
    }
    if (!city.trim() || !province.trim()) {
      setDeployStep(4);
      return setTxModal({ show: true, step: 0, error: 'Please provide at least a Municipality/City and Province in Step 4.' });
    }

    const ethEquivalent = (parsedPhp / 170000).toFixed(6);

    try {
      setCreating(true);
      let deployedHash = `BBDRTS-CAMP-${Date.now()}`;
      setTxModal({ show: true, step: 1, hash: '', type: 'CREATE', error: '', isLocal: true });
      await new Promise(r => setTimeout(r, 250));
      setTxModal({ show: true, step: 2, hash: deployedHash, type: 'CREATE', error: '', isLocal: true });

      try {
        const token = localStorage.getItem('bbdrts_token');
        const apiUrl = import.meta.env.VITE_API_URL || (
          !isLocalhost
            ? 'https://bbdrts-backend-api.onrender.com'
            : 'http://localhost:3001'
        );

        const allocations = null;

        // Construct full address from granular input fields if map picker wasn't clicked
        const constructedAddress = [street, barangay, city, province, region, zipCode, country, landmark ? `(Landmark: ${landmark})` : '']
          .map(s => (s || '').trim())
          .filter(Boolean)
          .join(', ');

        const finalLocationRegion = locationRegion.trim() || constructedAddress || '';

        const payload = {
          title: title.trim(),
          target_amount: ethEquivalent,
          targetAmount: ethEquivalent,
          target_amount_php: parsedPhp,
          targetAmountPhp: parsedPhp,
          contract_address: '0xB8Effb4f0394946a01da9C5342fC2e70c1E99ddA',
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
          disaster_images_json: disasterImages,
          disaster_images: disasterImages,
          disasterImages: disasterImages,
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

        const resData = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(resData.error || 'Failed to publish relief campaign.');
        }
        if (resData.txHash) deployedHash = resData.txHash;
      } catch (err) {
        console.error("Failed to sync campaign to backend:", err);
        throw err;
      }

      setTxModal({ show: true, step: 3, hash: deployedHash, type: 'CREATE', error: '', isLocal: !String(deployedHash).startsWith('0x') });
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
      setDisasterImages([]);
      setDisasterImagesMeta([]);
      setGcashName('');
      setGcashNumber('');
      setGcashQrUrl('');
      setSelectedGcashQrId(null);
      setMayaName('');
      setMayaNumber('');
      setMayaQrUrl('');
      setSelectedMayaQrId(null);
      setBankName('BDO Unibank');
      setBankAccountName('');
      setBankAccountNumber('');
      setBankQrUrl('');
      setSelectedBankQrId(null);
      setDescription('');
      setTargetDate('');
      setUrgency('');
      setSelectedTags([]);
      autoDetectedTagsRef.current = [];
      manuallySelectedTagsRef.current.clear();
      manuallyDeselectedTagsRef.current.clear();
      setDeployStep(1);
      fetchCampaigns();
      fetchOrgDonations();
      showSuccess(
        'Campaign successfully deployed and notarized on the blockchain!',
        'Campaign Active'
      );
    } catch (err) {
      console.error(err);
      if (err.code !== 'ACTION_REJECTED') {
        let errMsg = err.reason || err.shortMessage || err.message || 'Unable to deploy campaign right now. Please try again.';
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
    <div className="ref-dashboard-container">
      {/* Mobile Drawer Backdrop */}
      <div
        className={`ref-sidebar-backdrop ${mobileSidebarOpen ? 'active' : ''}`}
        onClick={() => setMobileSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* ── Left-Flush Sticky Sidebar Navigation (Zero space on the left) ── */}
      <aside className={`ref-sidebar ${isSidebarCollapsed ? 'collapsed' : ''} ${mobileSidebarOpen ? 'mobile-open' : ''}`}>
        <div>
          <div className="ref-sidebar-header-strip">
            <div className="ref-sidebar-brand-group">
              <span className="material-symbols-outlined ref-portal-icon" style={{ color: 'var(--accent, #10b981)' }}>corporate_fare</span>
              <span className="ref-portal-title">NGO Portal</span>
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

          <nav className="ref-sidebar-menu">
            <button
              id="tour-ngo-tab-dashboard"
              className={`ref-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => { setActiveTab('dashboard'); setMobileSidebarOpen(false); }}
              title={wt.dashboardOverview}
            >
              <span className="material-symbols-outlined">space_dashboard</span>
              <span>{wt.dashboardOverview}</span>
            </button>

            <button
              id="tour-ngo-tab-analytics"
              className={`ref-nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
              onClick={() => { setActiveTab('analytics'); setMobileSidebarOpen(false); }}
              title="Fundraising Analytics, Trends & Excel/PDF Reports"
            >
              <span className="material-symbols-outlined">analytics</span>
              <span>Analytics &amp; Reports</span>
            </button>

            <button
              id="tour-ngo-tab-my-campaigns"
              className={`ref-nav-item ${activeTab === 'my-campaigns' ? 'active' : ''}`}
              onClick={() => { setActiveTab('my-campaigns'); setMobileSidebarOpen(false); }}
              title={wt.myCampaigns}
            >
              <span className="material-symbols-outlined">campaign</span>
              <span>{wt.myCampaigns}</span>
            </button>

            <button
              id="tour-ngo-tab-create"
              className={`ref-nav-item ${activeTab === 'create' ? 'active' : ''}`}
              onClick={() => { setActiveTab('create'); setMobileSidebarOpen(false); }}
              title={wt.deployCampaign}
            >
              <span className="material-symbols-outlined">rocket_launch</span>
              <span>{wt.deployCampaign}</span>
            </button>

            <button
              id="tour-ngo-tab-ledger"
              className={`ref-nav-item ${activeTab === 'ledger' ? 'active' : ''}`}
              onClick={() => { setActiveTab('ledger'); setMobileSidebarOpen(false); }}
              title="Donation Ledger"
            >
              <span className="material-symbols-outlined">receipt_long</span>
              <span>Donation Ledger</span>
            </button>

            {interfaceMode !== 'simplified' && (
              <button
                id="tour-ngo-tab-radar"
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
                id="tour-ngo-tab-all-campaigns"
                className={`ref-nav-item ${activeTab === 'all-campaigns' ? 'active' : ''}`}
                onClick={() => { setActiveTab('all-campaigns'); setMobileSidebarOpen(false); }}
                title={wt.allOrgCampaigns}
              >
                <span className="material-symbols-outlined">public</span>
                <span>{wt.allOrgCampaigns}</span>
              </button>
            )}

            <button
              id="tour-ngo-tab-sec"
              className={`ref-nav-item ${activeTab === 'sec-kyc' ? 'active' : ''}`}
              onClick={() => { fetchKycData(); setActiveTab('sec-kyc'); setMobileSidebarOpen(false); }}
              title="SEC Accreditation & KYC"
            >
              <span className="material-symbols-outlined">verified_user</span>
              <span>SEC Accreditation & KYC</span>
              {(currentUser?.verification_status !== 'Approved' && kycStatusData?.Verification_Status !== 'Approved') && (
                <span className="ref-nav-count" style={{ marginLeft: 'auto', background: 'rgba(234, 179, 8, 0.2)', color: '#facc15', border: '1px solid rgba(234, 179, 8, 0.4)', borderRadius: '4px', fontSize: '0.62rem', fontWeight: 800, padding: '1px 5px' }}>
                  Required
                </span>
              )}
            </button>

            <button
              id="tour-ngo-tab-settings"
              className={`ref-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => { setActiveTab('settings'); setMobileSidebarOpen(false); }}
              title={wt.profileSettings}
            >
              <span className="material-symbols-outlined">account_circle</span>
              <span>{wt.profileSettings}</span>
            </button>
          </nav>
        </div>

        {/* ── Sidebar Bottom Footer Dock ── */}
        <div className="ref-sidebar-footer-group" id="tour-ngo-sepolia-node">
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



        {/* ── 1. DASHBOARD OVERVIEW TAB ONLY (Exact DonorView Editorial Geist Architecture) ── */}
        {activeTab === 'dashboard' && (() => {
          const isSecApproved = currentUser?.verification_status === 'Approved' || kycStatusData?.Verification_Status === 'Approved';
          const activeOpsCount = (myCampaigns || []).filter((c) => c.isActive).length;
          const concludedOpsCount = (myCampaigns || []).length - activeOpsCount;
          const totalRaisedPhp = Math.round(totalRaisedByMe * 170000);
          const totalTargetPhp = (myCampaigns || []).reduce(
            (sum, c) => sum + Number(c.targetAmountPhp || c.target_amount_php || Math.round((parseFloat(c.targetAmount) || 0) * 170000)),
            0
          );
          const overallFundingPct = totalTargetPhp > 0 ? Math.min(100, Math.round((totalRaisedPhp / totalTargetPhp) * 100)) : 0;
          const donationsCount = orgDonations ? orgDonations.length : 0;
          const sortedOps = [...(myCampaigns || [])].sort((a, b) => Number(Boolean(b.isActive)) - Number(Boolean(a.isActive)));

          return (
            <div key="tab-org-dashboard" className="donor-tab-transition">
              {/* Institutional Vercel Page Header (Matches DonorView) */}
              <div className="admin-page-header" id="tour-ngo-dashboard-header">
                <div className="admin-page-title-wrap">
                  <h2 className="admin-page-title">
                    <span className="material-symbols-outlined icon" style={{ color: 'var(--text-primary)' }}>space_dashboard</span>
                    <span>{wt.orgOverviewTitle}</span>
                  </h2>
                  <p className="admin-page-sub">
                    {wt.orgOverviewSub}
                  </p>
                </div>
              </div>

              {/* ── 1. Unified Organization Profile Hero (Atmospheric Banner + Identity + Hairline Stat Deck) ── */}
              <div className="dbo-org-hero-card" id="tour-ngo-welcome">
                {(() => {
                  const rawBanner = currentUser?.banner_url || '';
                  const isImageBanner = Boolean(
                    rawBanner &&
                    (rawBanner.startsWith('data:') || rawBanner.startsWith('http') || rawBanner.startsWith('/'))
                  );
                  const isGradientBanner = Boolean(rawBanner && rawBanner.startsWith('linear-gradient'));
                  const bannerStyle = isImageBanner
                    ? { backgroundImage: `url(${rawBanner})` }
                    : isGradientBanner
                      ? { background: rawBanner }
                      : undefined;

                  return (
                    <div
                      className={`dbo-org-cover-strip ${isImageBanner ? 'has-image' : isGradientBanner ? 'has-gradient' : 'is-default-mesh'}`}
                      style={bannerStyle}
                    >
                      <div className="dbo-org-cover-scrim" aria-hidden="true" />
                      <button
                        type="button"
                        className="dbo-org-cover-edit"
                        onClick={() => setActiveTab('settings')}
                        title="Customize organization cover banner in Profile & Settings"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>photo_camera</span>
                        <span>Edit Banner</span>
                      </button>
                    </div>
                  );
                })()}

                <div className="dbo-hero-content dbo-org-hero-body">
                  <div className="dbo-hero-main-row dbo-org-identity-row">
                    <div className="dbo-hero-identity" id="tour-ngo-identity">
                      <div className="dbo-hero-avatar dbo-org-overlap-avatar">
                        {currentUser?.avatar_url && (currentUser.avatar_url.startsWith('data:') || currentUser.avatar_url.startsWith('http')) ? (
                          <img src={currentUser.avatar_url} alt="Profile" />
                        ) : currentUser?.avatar_url && currentUser.avatar_url.length < 30 ? (
                          <span className="material-symbols-outlined" style={{ fontSize: '24px', color: 'var(--text-primary)' }}>{currentUser.avatar_url}</span>
                        ) : (
                          orgInitials
                        )}
                      </div>
                      <div className="dbo-hero-title-group">
                        <div className="dbo-hero-name-row">
                          <h1 className="dbo-hero-name">{orgDisplayName || 'Organization Dashboard'}</h1>
                          {isSecApproved && (
                            <span
                              className="material-symbols-outlined dbo-hero-verified-icon"
                              title="SEC Accredited Non-Profit Organization"
                              aria-label="SEC Accredited"
                            >
                              verified
                            </span>
                          )}
                        </div>
                        <p className="dbo-hero-sub">
                          {isSecApproved
                            ? 'SEC-accredited relief operations notarized gaslessly on Ethereum Sepolia.'
                            : 'Complete SEC accreditation to unlock verified relief campaign deployment.'}
                        </p>
                      </div>
                    </div>

                    <div className="dbo-hero-actions" id="tour-ngo-actions">
                      <button
                        type="button"
                        className="dbo-cmd-btn dbo-cmd-btn--primary"
                        onClick={() => setActiveTab('create')}
                        title="Deploy a new disaster relief or charitable campaign"
                      >
                        <span>{wt.deployCampaign}</span>
                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>arrow_forward</span>
                      </button>

                      <button
                        type="button"
                        className="dbo-cmd-btn"
                        onClick={() => setActiveTab('analytics')}
                        title="View fundraising analytics and export reports"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>analytics</span>
                        <span>Analytics</span>
                      </button>

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

                  {/* Inline Action Notice: SEC Accreditation Pending */}
                  {!isSecApproved && (
                    <div className="dbo-pending-banner">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <span className="material-symbols-outlined" style={{ color: '#f59e0b', fontSize: '19px', flexShrink: 0 }}>
                          verified_user
                        </span>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                          <strong>SEC Accreditation Pending:</strong>{' '}
                          Submit your SEC registration, signatory IDs, and certificate to unlock relief campaign deployment.
                        </div>
                      </div>
                      <button
                        type="button"
                        className="dbo-cmd-btn dbo-cmd-btn--primary"
                        onClick={() => { fetchKycData(); setActiveTab('sec-kyc'); }}
                        style={{ height: '30px', padding: '0 12px', fontSize: '0.74rem', flexShrink: 0 }}
                      >
                        <span>Complete Verification</span>
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>arrow_forward</span>
                      </button>
                    </div>
                  )}

                </div>

                {/* Integrated Bottom Hairline Stat Deck */}
                <div className="dbo-bare-stats cols-4 dbo-org-stats-deck" id="tour-ngo-metrics">
                    <button
                      type="button"
                      className="dbo-bare-stat clickable"
                      onClick={() => setActiveTab('analytics')}
                      title="Inspect mobilized aid telemetry and channel breakdown"
                    >
                      <span className="dbo-bare-icon-box" aria-hidden="true">
                        <span className="material-symbols-outlined">payments</span>
                      </span>
                      <span className="dbo-bare-text">
                        <LiveCounter value={totalRaisedPhp} prefix="₱" duration={1050} className="dbo-bare-val" />
                        <span className="dbo-bare-lbl">Total Aid Mobilized</span>
                      </span>
                    </button>

                    <button
                      type="button"
                      className="dbo-bare-stat clickable"
                      onClick={() => setActiveTab('my-campaigns')}
                      title="Manage your deployed relief operations"
                    >
                      <span className="dbo-bare-icon-box" aria-hidden="true">
                        <span className="material-symbols-outlined">rocket_launch</span>
                      </span>
                      <span className="dbo-bare-text">
                        <LiveCounter value={myCampaigns.length} duration={850} className="dbo-bare-val" />
                        <span className="dbo-bare-lbl">
                          {activeOpsCount} active · {concludedOpsCount} concluded
                        </span>
                      </span>
                    </button>

                    <button
                      type="button"
                      className="dbo-bare-stat clickable"
                      onClick={() => setActiveTab('ledger')}
                      title="Open immutable donation ledger"
                    >
                      <span className="dbo-bare-icon-box" aria-hidden="true">
                        <span className="material-symbols-outlined">receipt_long</span>
                      </span>
                      <span className="dbo-bare-text">
                        <LiveCounter value={donationsCount} duration={850} className="dbo-bare-val" />
                        <span className="dbo-bare-lbl">Donations Received</span>
                      </span>
                    </button>

                    <button
                      type="button"
                      className="dbo-bare-stat clickable"
                      onClick={() => { fetchKycData(); setActiveTab('sec-kyc'); }}
                      title="Review SEC accreditation and KYC registry"
                    >
                      <span className="dbo-bare-icon-box" aria-hidden="true">
                        <span className="material-symbols-outlined" style={{ color: isSecApproved ? '#10b981' : '#f59e0b' }}>
                          {isSecApproved ? 'verified_user' : 'hourglass_top'}
                        </span>
                      </span>
                      <span className="dbo-bare-text">
                        <span className="dbo-bare-val dbo-bare-val--tier" style={{ color: isSecApproved ? '#10b981' : '#f59e0b' }}>
                          <span>{isSecApproved ? 'Accredited' : 'Pending'}</span>
                          <span className="material-symbols-outlined" style={{ fontSize: '14px', opacity: 0.6 }}>north_east</span>
                        </span>
                        <span className="dbo-bare-lbl">SEC Legal Standing</span>
                      </span>
                  </button>
                </div>
              </div>

              {/* ── 2. Editorial Bento Workspace (1+2 Deployed Operations + Inbound Aid Feed & Goal Pacing) ── */}
              <div className="dbo-workspace-split">
                {/* Left Column: My Deployed Operations (1 Lead Spotlight + 2 Compact Cards) */}
                <div className="dbo-workspace-col">
                  <div className="dbo-section-bar">
                    <div className="dbo-section-title-group">
                      <h2 className="dbo-section-title">Deployed Operations</h2>
                      <span className="dbo-count-pill">{myCampaigns.length}</span>
                    </div>
                    <button type="button" className="dbo-clean-link" onClick={() => setActiveTab('my-campaigns')}>
                      <span>Manage all</span>
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
                    </button>
                  </div>

                  {fetchingCampaigns && myCampaigns.length === 0 ? (
                    <div className="db-empty-state">
                      <div className="spinner spinner-light" style={{ width: 24, height: 24, margin: '0 auto 10px' }} />
                      <div className="db-empty-title">Reading relief operations…</div>
                    </div>
                  ) : sortedOps.length === 0 ? (
                    <div className="db-empty-state">
                      <div className="db-empty-icon"><span className="material-symbols-outlined">rocket_launch</span></div>
                      <div className="db-empty-title">No relief operations deployed yet</div>
                      <div className="db-empty-desc">Launch your first campaign to accept verified GCash, Maya, and bank contributions.</div>
                      <button
                        type="button"
                        className="dbo-row-donate-btn"
                        style={{ display: 'inline-flex', margin: '12px auto 0' }}
                        onClick={() => setActiveTab('create')}
                      >
                        <span>Deploy First Campaign</span>
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>arrow_forward</span>
                      </button>
                    </div>
                  ) : (
                    <div className="dbo-bento-appeals">
                      {/* Lead Spotlight Operation (#1) */}
                      {(() => {
                        const camp = sortedOps[0];
                        if (!camp) return null;
                        const pct = progressPct(camp.currentAmount, camp.targetAmount);
                        const cover = getCampaignCoverData(camp);
                        const catInfo = getCampaignCategoryInfo(camp);
                        const campPhpTarget = (camp.targetAmountPhp || camp.target_amount_php || Math.round((parseFloat(camp.targetAmount) || 0) * 170000)).toLocaleString('en-US');
                        const campPhpCurrent = Math.round((parseFloat(camp.currentAmount) || 0) * 170000).toLocaleString('en-US');

                        return (
                          <div className="dbo-spotlight-card">
                            <div
                              className="dbo-spotlight-media"
                              style={cover.imageUrl ? { backgroundImage: `url(${cover.imageUrl})` } : undefined}
                            >
                              <div className="dbo-spotlight-scrim" />
                            </div>

                            <div className="dbo-spotlight-body">
                              <div className="dbo-appeal-meta-pills">
                                <span className="dbo-cat-chip">{catInfo.label}</span>
                                {!camp.isActive && <span className="dbo-cat-chip urgent">Concluded</span>}
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
                                <span className="dbo-org-label">{camp.isActive ? 'Active operation' : 'Concluded operation'}</span>
                                <div className="dbo-appeal-row-actions">
                                  <button
                                    type="button"
                                    className="dbo-row-icon-btn"
                                    onClick={() => setActiveTab('ledger')}
                                    title="Inspect campaign receipts in ledger"
                                    aria-label="Inspect ledger"
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>receipt_long</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="dbo-row-donate-btn"
                                    onClick={() => {
                                      setActiveTab('my-campaigns');
                                      setSearchQueryMy(camp.title || '');
                                    }}
                                  >
                                    <span>Manage</span>
                                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>arrow_forward</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Secondary 2-Column Compact Operations (#2 & #3) */}
                      {sortedOps.length > 1 && (
                        <div className="dbo-secondary-grid">
                          {sortedOps.slice(1, 3).map((camp) => {
                            const pct = progressPct(camp.currentAmount, camp.targetAmount);
                            const cover = getCampaignCoverData(camp);
                            const catInfo = getCampaignCategoryInfo(camp);
                            const campPhpTarget = (camp.targetAmountPhp || camp.target_amount_php || Math.round((parseFloat(camp.targetAmount) || 0) * 170000)).toLocaleString('en-US');
                            const campPhpCurrent = Math.round((parseFloat(camp.currentAmount) || 0) * 170000).toLocaleString('en-US');

                            return (
                              <div className="dbo-mini-appeal-card" key={camp.id}>
                                <div
                                  className="dbo-mini-media"
                                  style={cover.imageUrl ? { backgroundImage: `url(${cover.imageUrl})` } : undefined}
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
                                      <button
                                        type="button"
                                        className="dbo-row-icon-btn"
                                        onClick={() => setActiveTab('ledger')}
                                        title="View ledger"
                                        aria-label="View ledger"
                                      >
                                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>receipt_long</span>
                                      </button>
                                      <button
                                        type="button"
                                        className="dbo-row-donate-btn"
                                        onClick={() => {
                                          setActiveTab('my-campaigns');
                                          setSearchQueryMy(camp.title || '');
                                        }}
                                      >
                                        <span>Manage</span>
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

                {/* Right Column: Recent Inbound Aid Feed + Overall Mobilization Pacing */}
                <div className="dbo-workspace-col">
                  <div className="dbo-section-bar">
                    <div className="dbo-section-title-group">
                      <h2 className="dbo-section-title">Recent Inbound Aid</h2>
                      {donationsCount > 0 && <span className="dbo-count-pill">{donationsCount}</span>}
                    </div>
                    <button type="button" className="dbo-clean-link" onClick={() => setActiveTab('ledger')}>
                      <span>Open ledger</span>
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
                    </button>
                  </div>

                  <div className="dbo-ledger-card">
                    {donationsCount === 0 ? (
                      <div style={{ padding: '28px 20px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>No inbound donations recorded yet</div>
                        <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '6px 0 0', lineHeight: 1.5 }}>
                          Verified GCash, Maya, and Bank contributions to your relief drives will appear here in real time.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div>
                          {orgDonations.slice(0, 5).map((d, dIdx) => {
                            const rail = (d.paymentMethod || d.Payment_Method || 'PHP').toUpperCase();
                            const ethAmt = parseFloat(d.amount || d.Amount || 0);
                            const phpVal = d.phpAmount || Math.round(ethAmt * 170000);
                            const txHash = d.txHash || d.Tx_Hash;
                            const donorName = d.donorName || d.donor_name || 'Verified Contributor';
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
                                      <span>{donorName}</span>
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
                          onClick={() => setActiveTab('ledger')}
                        >
                          <span>View all {donationsCount} notarized receipts</span>
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
                        </button>
                      </>
                    )}
                  </div>

                  {/* Operational Funding Pacing & Quick Analytics Card */}
                  <button
                    type="button"
                    className="dbo-milestone-card"
                    onClick={() => setActiveTab('analytics')}
                    title="Open Fundraising Analytics & Export Reports"
                  >
                    <div className="dbo-milestone-top">
                      <div className="dbo-milestone-left">
                        <span className="dbo-milestone-label">Portfolio Goal Pacing</span>
                        <span className="dbo-milestone-name">
                          {overallFundingPct}% of combined targets mobilized
                        </span>
                      </div>
                      <span className="dbo-milestone-cta">
                        <span>Analytics</span>
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>north_east</span>
                      </span>
                    </div>

                    <div className="dbo-clean-progress-bar" style={{ marginTop: '12px' }}>
                      <div
                        className="dbo-clean-progress-fill"
                        style={{ width: `${Math.min(100, Math.max(totalRaisedPhp > 0 ? 4 : 0, overallFundingPct))}%` }}
                      />
                    </div>

                    <div className="dbo-milestone-foot">
                      <span>Raised: <strong>₱{totalRaisedPhp.toLocaleString('en-US')}</strong></span>
                      <span>Goal: ₱{totalTargetPhp.toLocaleString('en-US')}</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── 2. ALL CAMPAIGNS TAB ── */}
        {activeTab === 'all-campaigns' && (
          <div key="tab-org-all-campaigns" className="donor-tab-transition">
            <div className="admin-page-header" id="tour-ngo-all-campaigns-header">
              <div className="admin-page-title-wrap">
                <h2 className="admin-page-title">
                  <span className="material-symbols-outlined icon" style={{ color: 'var(--text-primary)' }}>public</span>
                  <span>All Relief Campaigns</span>
                </h2>
                <p className="admin-page-sub">
                  Public ledger view of all active disaster relief and charitable aid campaigns across the network.
                </p>
              </div>

              <div className="admin-page-header-actions">
                <button
                  type="button"
                  className="dbo-cmd-btn"
                  onClick={fetchCampaigns}
                  disabled={fetchingCampaigns}
                >
                  <span className={`material-symbols-outlined ${fetchingCampaigns ? 'spinning' : ''}`} style={{ fontSize: '15px' }}>refresh</span>
                  <span>{fetchingCampaigns ? 'Refreshing...' : 'Refresh'}</span>
                </button>
              </div>
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
                      <span className="material-symbols-outlined filter-pill-icon" style={{ color: 'var(--text-secondary)' }}>{selectedCauseObjAll.icon}</span>
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
                            <span className="material-symbols-outlined filter-popover-option-icon" style={{ color: 'var(--text-secondary)' }}>{opt.icon}</span>
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
                      <span className="material-symbols-outlined filter-pill-icon" style={{ color: 'var(--text-secondary)' }}>{selectedPriorityObjAll.icon}</span>
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
                            <span className="material-symbols-outlined filter-popover-option-icon" style={{ color: 'var(--text-secondary)' }}>{opt.icon}</span>
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
                      <span className="material-symbols-outlined filter-pill-icon" style={{ color: 'var(--text-secondary)' }}>sell</span>
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
                            <span className="tags-popover-count">{campaigns?.length || 0}</span>
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
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>close</span>
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
                        <button type="button" onClick={() => setCategoryFilterAll('ALL')} title="Remove filter">
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>close</span>
                        </button>
                      </div>
                    )}

                    {urgencyFilterAll !== 'ALL' && (
                      <div className="reference-active-chip">
                        <span className="material-symbols-outlined chip-icon" style={{ color: '#f59e0b' }}>bolt</span>
                        <span>{urgencyFilterAll === 'HIGH' ? 'High Priority' : urgencyFilterAll === 'MEDIUM' ? 'Medium Priority' : 'Standard Priority'}</span>
                        <button type="button" onClick={() => setUrgencyFilterAll('ALL')} title="Remove filter">
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>close</span>
                        </button>
                      </div>
                    )}

                    {selectedTagsAll.map((tag) => (
                      <div key={tag} className="reference-active-chip">
                        <span className="material-symbols-outlined chip-icon" style={{ color: '#a855f7' }}>sell</span>
                        <span>#{tag}</span>
                        <button type="button" onClick={() => setSelectedTagsAll(prev => prev.filter(t => t !== tag))} title={`Remove tag #${tag}`}>
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>close</span>
                        </button>
                      </div>
                    ))}

                    {searchQueryAll.trim() && (
                      <div className="reference-active-chip">
                        <span className="material-symbols-outlined chip-icon" style={{ color: '#94a3b8' }}>search</span>
                        <span>"{searchQueryAll.trim()}"</span>
                        <button type="button" onClick={() => setSearchQueryAll('')} title="Clear search query">
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>close</span>
                        </button>
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
                <span>Showing <strong>{(filteredAllCampaigns || []).length}</strong> of {campaigns?.length || 0} campaigns</span>
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

            {(filteredAllCampaigns || []).length === 0 ? (
              <div className="db-empty-state">
                <div className="db-empty-icon">
                  <span className="material-symbols-outlined">search_off</span>
                </div>
                <div className="db-empty-title">No campaigns match your filter</div>
                <div className="db-empty-desc">
                  Try selecting a different category or clearing your search query.
                </div>
                <button
                  type="button"
                  className="db-btn"
                  onClick={() => { setCategoryFilterAll('ALL'); setSearchQueryAll(''); }}
                >
                  <span>Reset Filters</span>
                </button>
              </div>
            ) : (
              <>
                <div className={viewModeOrg === 'grid' || viewModeOrg === 'grid-3' || viewModeOrg === 'grid-2' ? 'campaigns-grid' : 'campaigns-list'}>
                  {paginatedAllCampaigns.map((camp) => (
                    <CampaignCard key={camp.id} camp={camp} contract={contract}
                      role={ROLES.ORGANIZATION} walletAddress={walletAddress} currentUser={currentUser}
                      interfaceMode={interfaceMode} lowBandwidthMode={lowBandwidthMode} language={language}
                      onDonated={() => fetchCampaigns({ silent: true })} onDeactivated={() => fetchCampaigns({ silent: true })} onCampaignUpdated={() => fetchCampaigns({ silent: true })} />
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
          <div key="tab-org-my-campaigns" className="donor-tab-transition">
            <div className="admin-page-header" id="tour-ngo-my-campaigns-header">
              <div className="admin-page-title-wrap">
                <h2 className="admin-page-title">
                  <span className="material-symbols-outlined icon" style={{ color: 'var(--text-primary)' }}>campaign</span>
                  <span>My Campaigns</span>
                </h2>
                <p className="admin-page-sub">
                  Relief operations deployed under {orgDisplayName || 'your organization'} ({shortAddr(walletAddress)}).
                </p>
              </div>

              <div className="admin-page-header-actions">
                <button
                  type="button"
                  className="dbo-cmd-btn"
                  onClick={fetchCampaigns}
                  disabled={fetchingCampaigns}
                >
                  <span className={`material-symbols-outlined ${fetchingCampaigns ? 'spinning' : ''}`} style={{ fontSize: '15px' }}>refresh</span>
                  <span>{fetchingCampaigns ? 'Refreshing...' : 'Refresh'}</span>
                </button>
              </div>
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
                      <span className="material-symbols-outlined filter-pill-icon" style={{ color: 'var(--text-secondary)' }}>
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
                            <span className="material-symbols-outlined filter-popover-option-icon" style={{ color: 'var(--text-secondary)' }}>{opt.icon}</span>
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
                      <span className="material-symbols-outlined filter-pill-icon" style={{ color: 'var(--text-secondary)' }}>
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
                            <span className="material-symbols-outlined filter-popover-option-icon" style={{ color: 'var(--text-secondary)' }}>{opt.icon}</span>
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
                      <span className="material-symbols-outlined filter-pill-icon" style={{ color: 'var(--text-secondary)' }}>sell</span>
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
                            <span className="tags-popover-count">{myCampaigns?.length || 0}</span>
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
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>close</span>
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
                        <button type="button" onClick={() => setCategoryFilterMy('ALL')} title="Remove filter">
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>close</span>
                        </button>
                      </div>
                    )}

                    {urgencyFilterMy !== 'ALL' && (
                      <div className="reference-active-chip">
                        <span className="material-symbols-outlined chip-icon" style={{ color: '#f59e0b' }}>bolt</span>
                        <span>{urgencyFilterMy === 'HIGH' ? 'High Priority' : urgencyFilterMy === 'MEDIUM' ? 'Medium Priority' : 'Standard Priority'}</span>
                        <button type="button" onClick={() => setUrgencyFilterMy('ALL')} title="Remove filter">
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>close</span>
                        </button>
                      </div>
                    )}

                    {selectedTagsMy.map((tag) => (
                      <div key={tag} className="reference-active-chip">
                        <span className="material-symbols-outlined chip-icon" style={{ color: '#a855f7' }}>sell</span>
                        <span>#{tag}</span>
                        <button type="button" onClick={() => setSelectedTagsMy(prev => prev.filter(t => t !== tag))} title={`Remove tag #${tag}`}>
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>close</span>
                        </button>
                      </div>
                    ))}

                    {searchQueryMy.trim() && (
                      <div className="reference-active-chip">
                        <span className="material-symbols-outlined chip-icon" style={{ color: '#94a3b8' }}>search</span>
                        <span>"{searchQueryMy.trim()}"</span>
                        <button type="button" onClick={() => setSearchQueryMy('')} title="Clear search query">
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>close</span>
                        </button>
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
                <span>Showing <strong>{(filteredMyCampaigns || []).length}</strong> of {myCampaigns?.length || 0} campaigns</span>
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

            {(myCampaigns?.length || 0) === 0 ? (
              <div className="db-empty-state">
                <div className="db-empty-icon">
                  <span className="material-symbols-outlined">campaign</span>
                </div>
                <div className="db-empty-title">You haven't created any campaigns yet</div>
                <div className="db-empty-desc">
                  Publish your first relief operation onto the blockchain to start receiving contributions.
                </div>
                <button
                  type="button"
                  className="db-btn db-btn--primary"
                  onClick={() => setActiveTab('create')}
                >
                  <span className="material-symbols-outlined">add</span>
                  <span>Create First Campaign</span>
                </button>
              </div>
            ) : (filteredMyCampaigns || []).length === 0 ? (
              <div className="db-empty-state">
                <div className="db-empty-icon">
                  <span className="material-symbols-outlined">filter_alt_off</span>
                </div>
                <div className="db-empty-title">No campaigns match your search</div>
                <div className="db-empty-desc">
                  Try adjusting your category, urgency, or keyword filter.
                </div>
                <button
                  type="button"
                  className="db-btn"
                  onClick={() => { setCategoryFilterMy('ALL'); setUrgencyFilterMy('ALL'); setSearchQueryMy(''); }}
                >
                  <span>Reset Filters</span>
                </button>
              </div>
            ) : (
              <>
                <div className={viewModeOrg === 'grid' || viewModeOrg === 'grid-3' || viewModeOrg === 'grid-2' ? 'campaigns-grid' : 'campaigns-list'}>
                  {paginatedMyCampaigns.map((camp) => (
                    <CampaignCard key={camp.id} camp={camp} contract={contract}
                      role={ROLES.ORGANIZATION} walletAddress={walletAddress} currentUser={currentUser}
                      interfaceMode={interfaceMode} lowBandwidthMode={lowBandwidthMode} language={language}
                      onDonated={() => fetchCampaigns({ silent: true })} onDeactivated={() => fetchCampaigns({ silent: true })} onCampaignUpdated={() => fetchCampaigns({ silent: true })} />
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
          <div key="tab-org-create" className="donor-tab-transition" id="tour-ngo-create-form">
            {/* Institutional Vercel Page Header */}
            <div className="admin-page-header" id="tour-ngo-create-header">
              <div className="admin-page-title-wrap">
                <h2 className="admin-page-title">
                  <span className="material-symbols-outlined icon" style={{ color: 'var(--text-primary)' }}>rocket_launch</span>
                  <span>Create Campaign</span>
                </h2>
                <p className="admin-page-sub">
                  Launch a verified disaster relief or community campaign under <strong>{orgDisplayName || 'your organization'}</strong>.
                </p>
              </div>

              <div className="admin-page-header-actions">
                <span className="dc-verified-pill">
                  <span className="dc-live-dot" />
                  <span>Verified NGO</span>
                </span>
                {walletAddress && (
                  <span className="admin-header-badge">
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>account_balance_wallet</span>
                    <span>{shortAddr(walletAddress)}</span>
                  </span>
                )}
              </div>
            </div>

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
              <div className="fade-in deploy-campaign-card dc-shell">
                {/* Flush 5-Step Underline Bar (DonorView Chrome) */}
                <div className="deploy-stepper-bar" role="tablist" aria-label="Campaign steps">
                  {[
                    { num: 1, label: 'Overview' },
                    { num: 2, label: 'Story & Media' },
                    { num: 3, label: 'Relief Focus' },
                    { num: 4, label: 'Location' },
                    { num: 5, label: 'Review & Payout' }
                  ].map(st => {
                    const isActive = deployStep === st.num;
                    const isCompleted = deployStep > st.num;
                    return (
                      <button
                        key={st.num}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setDeployStep(st.num)}
                        className={`deploy-step-indicator${isActive ? ' active' : ''}${isCompleted ? ' completed' : ''}`}
                        title={`Step ${st.num}: ${st.label}`}
                      >
                        <span className="deploy-step-indicator-num">
                          {isCompleted ? <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>check</span> : `0${st.num}`}
                        </span>
                        <span className="dc-step-lbl">{st.label}</span>
                      </button>
                    );
                  })}
                </div>

                <form className="create-form dc-form" onSubmit={handleCreateCampaign}>
                  {/* ── Step 1: Campaign Overview & Target ── */}
                  {deployStep === 1 && (
                    <div className="fade-in deploy-section-card">
                      <div className="deploy-section-header">
                        <div className="deploy-section-title-wrap">
                          <div>
                            <h3 className="deploy-section-title">Campaign Overview</h3>
                            <div className="deploy-section-subtitle">
                              {category === 'CD'
                                ? 'Define the community initiative title, category, fundraising goal, and target schedule.'
                                : 'Define the emergency relief title, category, fundraising goal, and delivery schedule.'}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="dc-overview-grid">
                        {/* Row 1: Campaign Title (Full Width) */}
                        <div className="dc-span-full">
                          <label className="deploy-input-label">
                            <span>Campaign Title <span className="deploy-required-star">*</span></span>
                            {Array.isArray(autoDetectedTagsRef.current) && autoDetectedTagsRef.current.length > 0 && (
                              <span className="dc-hint-accent">
                                {autoDetectedTagsRef.current.length} focus tags auto-matched
                              </span>
                            )}
                          </label>
                          <input
                            className="input deploy-field-input"
                            type="text"
                            required
                            placeholder={category === 'CD' ? 'e.g., Community Feeding Program & School Supplies Drive' : 'e.g., Flash Flood Relief Operation — Southern Leyte'}
                            value={title}
                            onChange={(e) => handleTitleChange(e.target.value)}
                            disabled={creating}
                          />
                        </div>

                        {/* Row 2 Left: Campaign Category (Clean Inline Segmented Control — Zero Truncation) */}
                        <div>
                          <div className="deploy-input-label">
                            <span>Campaign Category <span className="deploy-required-star">*</span></span>
                            {isCategoryAuto && <span className="dc-hint-accent">Auto-detected</span>}
                          </div>
                          <div className="dc-seg-bar" role="radiogroup" aria-label="Campaign category">
                            <button
                              type="button"
                              role="radio"
                              aria-checked={category === 'DR'}
                              disabled={creating}
                              className={`dc-seg-btn${category === 'DR' ? ' is-active' : ''}`}
                              onClick={() => {
                                setCategory('DR');
                                manuallySelectedCategoryRef.current = true;
                                setIsCategoryAuto(false);
                              }}
                            >
                              <span className="material-symbols-outlined">flood</span>
                              <span>Disaster Relief (DR)</span>
                            </button>
                            <button
                              type="button"
                              role="radio"
                              aria-checked={category === 'CD'}
                              disabled={creating}
                              className={`dc-seg-btn${category === 'CD' ? ' is-active' : ''}`}
                              onClick={() => {
                                setCategory('CD');
                                manuallySelectedCategoryRef.current = true;
                                setIsCategoryAuto(false);
                              }}
                            >
                              <span className="material-symbols-outlined">volunteer_activism</span>
                              <span>Community Aid (CD)</span>
                            </button>
                          </div>
                          <div className="dc-field-sub">
                            {category === 'CD'
                              ? 'Feeding programs, medical missions, schooling & livelihood.'
                              : 'Typhoons, floods, earthquakes, volcanic & fire emergencies.'}
                          </div>
                        </div>

                        {/* Row 2 Right: Fundraising Target + Compact Preset Chips */}
                        <div>
                          <div className="deploy-input-label">
                            <span>Fundraising Target (PHP) <span className="deploy-required-star">*</span></span>
                            {targetAmount && !isNaN(parseFloat(targetAmount)) && parseFloat(targetAmount) > 0 && (
                              <span className="dc-hint-mono">₱{Math.round(parseFloat(targetAmount)).toLocaleString('en-US')}</span>
                            )}
                          </div>
                          <div className="deploy-currency-wrap">
                            <span className="deploy-currency-prefix">₱</span>
                            <input
                              className="input deploy-field-input deploy-currency-input"
                              type="number"
                              min="100"
                              step="100"
                              required
                              placeholder="100,000"
                              value={targetAmount}
                              onChange={(e) => setTargetAmount(e.target.value)}
                              disabled={creating}
                            />
                          </div>
                          <div className="dc-preset-row">
                            {[25000, 50000, 100000, 250000, 500000].map((amt) => (
                              <button
                                key={amt}
                                type="button"
                                className={`dc-preset-chip${Number(targetAmount) === amt ? ' is-active' : ''}`}
                                onClick={() => !creating && setTargetAmount(String(amt))}
                                disabled={creating}
                              >
                                ₱{amt >= 1000 ? `${amt / 1000}K` : amt}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Row 3 Left: Target Due Date (Calendar Popover) */}
                        <div style={{ position: 'relative' }} ref={deliveryDateContainerRef}>
                          <div className="deploy-input-label">
                            <span>Target Due Date <span className="deploy-required-star">*</span></span>
                            {targetDate && <span className="dc-hint-accent">Deadline set</span>}
                          </div>
                          <div style={{ position: 'relative' }}>
                            <button
                              type="button"
                              onClick={() => !creating && setDeliveryDatePickerOpen(prev => !prev)}
                              disabled={creating}
                              className={`dc-date-btn${deliveryDatePickerOpen ? ' is-open' : ''}${targetDate ? ' has-val' : ''}`}
                              title="Select target due date"
                            >
                              <span className="dc-date-left">
                                <span className="material-symbols-outlined dc-date-ico">calendar_month</span>
                                <span className="dc-date-text">
                                  {targetDate ? formatSelectedDeliveryDate(targetDate) : 'Select Due Date…'}
                                </span>
                              </span>
                              {targetDate ? (
                                <span
                                  role="button"
                                  tabIndex={0}
                                  className="dc-date-clear"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTargetDateChange('');
                                  }}
                                  title="Clear date"
                                >
                                  <span className="material-symbols-outlined">close</span>
                                </span>
                              ) : (
                                <span className="material-symbols-outlined dc-date-chev">expand_more</span>
                              )}
                            </button>

                            {deliveryDatePickerOpen && (
                              <div
                                className="ledger-custom-calendar-popover"
                                onClick={(e) => e.stopPropagation()}
                                style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: '300px', zIndex: 120 }}
                              >
                                <div className="cal-header">
                                  <button type="button" className="cal-nav-btn" onClick={handlePrevCalMonth} title="Previous Month">
                                    <span className="material-symbols-outlined">chevron_left</span>
                                  </button>
                                  <div className="cal-month-title">
                                    {calViewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                  </div>
                                  <button type="button" className="cal-nav-btn" onClick={handleNextCalMonth} title="Next Month">
                                    <span className="material-symbols-outlined">chevron_right</span>
                                  </button>
                                </div>
                                <div className="cal-lifecycle-banner" style={{ fontSize: '0.66rem', padding: '3px 8px' }}>
                                  <span className="cal-pulse-dot" />
                                  <span className="cal-lifecycle-text">Auto Urgency: ≤5d Critical · 6–14d Urgent · &gt;14d Standard</span>
                                </div>
                                <div className="cal-weekdays">
                                  <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
                                </div>
                                <div className="cal-grid">
                                  {calMonthCells.map((cell) => {
                                    const isSelected = targetDate === cell.iso;
                                    let cellClass = 'cal-day';
                                    if (!cell.isCurrentMonth) cellClass += ' cal-day-outside';
                                    if (cell.isPast) cellClass += ' cal-day-past';
                                    if (isSelected) cellClass += ' cal-day-selected';
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    const cellDate = new Date(cell.iso + 'T00:00:00');
                                    const diffDays = Math.ceil((cellDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                    let dotColor = null;
                                    if (!cell.isPast && cell.isCurrentMonth) {
                                      if (diffDays <= 5) dotColor = '#ef4444';
                                      else if (diffDays <= 14) dotColor = '#eab308';
                                      else dotColor = '#10b981';
                                    }
                                    return (
                                      <button
                                        key={cell.iso}
                                        type="button"
                                        className={cellClass}
                                        disabled={cell.isPast}
                                        onClick={() => {
                                          handleTargetDateChange(cell.iso);
                                          setDeliveryDatePickerOpen(false);
                                        }}
                                        style={{
                                          opacity: cell.isPast ? 0.35 : 1,
                                          cursor: cell.isPast ? 'not-allowed' : 'pointer',
                                          border: cell.isToday ? '1px dashed #10b981' : 'none',
                                          background: isSelected ? '#ffffff' : (cell.isToday ? 'rgba(16,185,129,0.1)' : 'transparent'),
                                          color: isSelected ? '#000000' : 'inherit',
                                          fontWeight: isSelected || cell.isToday ? 700 : 500,
                                          position: 'relative'
                                        }}
                                        title={cell.isPast ? 'Past date unavailable' : `${cell.iso} (${diffDays === 0 ? 'Today' : `${diffDays} days from now`})`}
                                      >
                                        <span className="cal-day-num">{cell.dayNum}</span>
                                        {dotColor && !isSelected && (
                                          <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: dotColor, position: 'absolute', bottom: '3px' }} />
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="dc-field-sub">
                            {category === 'CD' ? 'Estimated outreach completion date.' : 'Target date for ground relief delivery.'}
                          </div>
                        </div>

                        {/* Row 3 Right: Urgency Status (Clean Inline 3-Segment Control Matching Height) */}
                        <div>
                          <div className="deploy-input-label">
                            <span>Urgency Status</span>
                            {urgency && targetDate && <span className="dc-hint-accent">Auto-suggested</span>}
                          </div>
                          <div className="dc-seg-bar dc-seg-bar--3" role="radiogroup" aria-label="Urgency status">
                            {[
                              { id: 'HIGH (EMERGENCY AID)', label: 'Critical', dot: '#ef4444', active: urgency.includes('HIGH') || urgency.includes('CRITICAL') },
                              { id: 'MEDIUM (URGENT REHABILITATION)', label: 'Urgent', dot: '#f59e0b', active: urgency.includes('MEDIUM') || urgency.includes('URGENT') || urgency.includes('REHAB') },
                              { id: 'STABLE (CHARITABLE AID)', label: 'Standard', dot: '#10b981', active: urgency.includes('STABLE') || urgency.includes('STANDARD') || urgency.includes('CHARITABLE') }
                            ].map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                role="radio"
                                aria-checked={opt.active}
                                disabled={creating}
                                className={`dc-seg-btn${opt.active ? ' is-active' : ''}`}
                                onClick={() => setUrgency(opt.id)}
                              >
                                <span className="dc-urg-dot" style={{ background: opt.dot }} />
                                <span>{opt.label}</span>
                              </button>
                            ))}
                          </div>
                          <div className="dc-field-sub">
                            Automatically suggested from due date; click to override anytime.
                          </div>
                        </div>

                        {/* Row 4: Estimated Beneficiaries (Full Width) */}
                        <div className="dc-span-full">
                          <label className="deploy-input-label">
                            <span>{category === 'CD' ? 'Estimated Beneficiaries / Community Impact' : 'Estimated Beneficiaries / Displaced Families'}</span>
                            <span className="dc-hint-mono">Optional</span>
                          </label>
                          <input
                            className="input deploy-field-input"
                            type="text"
                            placeholder={category === 'CD' ? 'e.g., ~500 Underserved Children & 120 Local Families' : 'e.g., ~3,500 Displaced Families across 12 Barangays'}
                            value={beneficiariesImpact}
                            onChange={(e) => setBeneficiariesImpact(e.target.value)}
                            disabled={creating}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Step 2: Mission Narrative & Ground Evidence Photos ── */}
                  {deployStep === 2 && (
                    <div className="fade-in">
                      <div className="deploy-section-card">
                        <div className="deploy-section-header">
                          <div className="deploy-section-title-wrap">
                            <div className="deploy-section-icon-badge">
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                                {category === 'CD' ? 'volunteer_activism' : 'photo_library'}
                              </span>
                            </div>
                            <div>
                              <h3 className="deploy-section-title">
                                {category === 'CD' ? '2. Initiative Story & Beneficiary Photos' : '2. Mission Story & Field Photos'}
                              </h3>
                              <div className="deploy-section-subtitle">
                                {category === 'CD'
                                  ? 'Describe the community need and upload authentic photos of the beneficiaries or project activities.'
                                  : 'Describe the on-ground reality and upload real photos of the disaster damage to show donors the urgent need.'}
                              </div>
                            </div>
                          </div>
                          <span className="deploy-step-pill">Step 2 of 5</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          <div>
                            <label className="deploy-input-label">
                              <span>
                                {category === 'CD'
                                  ? 'Community Initiative Background & Objectives'
                                  : 'Emergency Mission Narrative & Ground Situation'}
                              </span>
                            </label>
                            <textarea
                              className="input deploy-field-input"
                              rows="4"
                              placeholder={category === 'CD'
                                ? "Describe the beneficiary community, project goals, planned resource distribution, and long-term community impact..."
                                : "Provide mission background, emergency relief scope, on-ground displacement, and immediate response plan..."}
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              disabled={creating}
                              style={{ width: '100%', resize: 'vertical' }}
                            />
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                            {/* Dynamic Multiple Contacts Support */}
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <label className="deploy-input-label" style={{ margin: 0 }}>
                                  <span>
                                    {category === 'CD'
                                      ? 'Project Coordinators / Contact Inquiries'
                                      : 'Emergency Contact Hotlines / Dispatch'}
                                  </span>
                                </label>
                                {contactList.length < 5 && (
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-xs"
                                    onClick={handleAddContact}
                                    disabled={creating}
                                    style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--accent, #22c55e)', padding: '2px 6px' }}
                                    title="Add another contact hotline or email"
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>add</span>
                                    <span>Add Contact</span>
                                  </button>
                                )}
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {contactList.map((contact, idx) => (
                                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ position: 'relative', flex: 1 }}>
                                      <input
                                        className="input deploy-field-input"
                                        type="text"
                                        placeholder={idx === 0
                                          ? (category === 'CD' ? "e.g., 0992 982 4615 or outreach@ngo.org" : "e.g., 0992 982 4615 or relief@redcross.org.ph")
                                          : "e.g., Secondary hotline, field captain, or email"}
                                        value={contact}
                                        onChange={(e) => handleContactChange(idx, e.target.value)}
                                        disabled={creating}
                                        style={{ width: '100%', paddingRight: '32px', height: '40px', minHeight: '40px' }}
                                      />
                                      <span
                                        className="material-symbols-outlined"
                                        style={{
                                          position: 'absolute',
                                          right: '10px',
                                          top: '50%',
                                          transform: 'translateY(-50%)',
                                          fontSize: '15px',
                                          color: 'var(--text-muted)',
                                          pointerEvents: 'none'
                                        }}
                                      >
                                        {contact.includes('@') ? 'mail' : 'call'}
                                      </span>
                                    </div>
                                    {contactList.length > 1 && (
                                      <button
                                        type="button"
                                        className="btn btn-ghost btn-xs"
                                        onClick={() => handleRemoveContact(idx)}
                                        disabled={creating}
                                        title="Remove contact"
                                        style={{ color: '#ef4444', padding: '6px', borderRadius: '8px' }}
                                      >
                                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                              <div style={{ marginTop: '4px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                {category === 'CD'
                                  ? 'Add direct phone numbers, email addresses, or lead coordinator contacts for public inquiries.'
                                  : 'Add emergency hotlines, field dispatch lines, or local barangay relief coordinator numbers.'}
                              </div>
                            </div>

                            {/* Official Verification URL / Calamity Report */}
                            <div>
                              <label className="deploy-input-label" style={{ marginBottom: '6px' }}>
                                <span>
                                  {category === 'CD'
                                    ? 'Project Proposal / Official Initiative URL (Optional)'
                                    : 'Official Calamity Report / NDRRMC SitRep URL (Optional)'}
                                </span>
                              </label>
                              <input
                                className="input deploy-field-input"
                                type="url"
                                placeholder={category === 'CD'
                                  ? "e.g., https://our-ngo.org.ph/community-drive-2026 or proposal link"
                                  : "e.g., https://ndrrmc.gov.ph/sitrep-102 or bulletin link"}
                                value={documentUrl}
                                onChange={(e) => setDocumentUrl(e.target.value)}
                                disabled={creating}
                                style={{ width: '100%', height: '40px', minHeight: '40px' }}
                              />
                              <div style={{ marginTop: '4px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                {category === 'CD'
                                  ? 'Official organization website, project brief, or local council endorsement link.'
                                  : 'Official NDRRMC situation bulletin, local news report, or government advisory.'}
                              </div>
                            </div>
                          </div>

                          {/* Dynamic Photos Section: Field Damage for DR vs Beneficiary/Activity for CD */}
                          <div style={{ marginTop: '8px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                              <label className="deploy-input-label" style={{ margin: 0 }}>
                                <span>
                                  {category === 'CD'
                                    ? 'Beneficiary & Community Initiative Photos'
                                    : 'Field Damage & Disaster Aftermath Photos'}
                                </span>
                              </label>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <label
                                  title="RA 10173: Automatically detect and blur survivor faces in uploaded photos"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    color: autoBlurCampaignFaces ? '#10b981' : 'var(--text-muted)',
                                    background: autoBlurCampaignFaces ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-inset)',
                                    padding: '2px 9px',
                                    borderRadius: '6px',
                                    border: `1px solid ${autoBlurCampaignFaces ? 'rgba(16, 185, 129, 0.32)' : 'var(--border)'}`,
                                    cursor: 'pointer',
                                    userSelect: 'none'
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={autoBlurCampaignFaces}
                                    onChange={(e) => setAutoBlurCampaignFaces(e.target.checked)}
                                    style={{ accentColor: '#10b981', margin: 0, cursor: 'pointer' }}
                                  />
                                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>blur_on</span>
                                  <span>AI Face-Blur (RA 10173)</span>
                                </label>
                                <span style={{
                                  fontSize: '0.72rem',
                                  color: disasterImages.length >= 10 ? '#ef4444' : (disasterImages.length > 0 ? 'var(--accent)' : 'var(--text-muted)'),
                                  fontWeight: 700,
                                  background: 'var(--bg-inset)',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border)'
                                }}>
                                  {disasterImages.length} / 10 Photos Attached
                                </span>
                              </div>
                            </div>

                            <input
                              ref={disasterFileInputRef}
                              type="file"
                              multiple
                              accept="image/png, image/jpeg, image/webp"
                              onChange={handleDisasterImagesUpload}
                              style={{ display: 'none' }}
                              disabled={creating || isProcessingDisasterImages || disasterImages.length >= 10}
                            />

                            {disasterImages.length < 10 && (
                              <div
                                className="deploy-dropzone"
                                onClick={() => {
                                  if (!creating && !isProcessingDisasterImages && disasterFileInputRef.current) {
                                    disasterFileInputRef.current.click();
                                  }
                                }}
                              >
                                {isProcessingDisasterImages ? (
                                  <>
                                    <span className="material-symbols-outlined spin" style={{ fontSize: '26px', color: 'var(--accent)' }}>progress_activity</span>
                                    <span style={{ fontSize: '0.84rem', color: 'var(--text-primary)', fontWeight: 600 }}>{disasterProcessLabel}</span>
                                  </>
                                ) : (
                                  <>
                                    <div className="deploy-section-icon-badge" style={{ width: '42px', height: '42px', borderRadius: '50%' }}>
                                      <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                                        {category === 'CD' ? 'add_a_photo' : 'add_photo_alternate'}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                      {category === 'CD'
                                        ? 'Click or Drag to Upload Community / Beneficiary Photos'
                                        : 'Click or Drag to Upload Disaster Photos'}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                      {category === 'CD'
                                        ? 'Photos of community activities, beneficiaries, or initiative activities • PNG, JPG, WebP (Max 10)'
                                        : 'Featured on the Tactical Radar Info Card and Dossier • PNG, JPG, WebP (Max 10)'}
                                    </div>
                                  </>
                                )}
                              </div>
                            )}

                            {/* Photos Thumbnails Preview Grid with Drag-and-Drop Reordering */}
                            {disasterImages.length > 0 && (
                              <div>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '8px',
                                  margin: '14px 0 10px',
                                  padding: '8px 12px',
                                  borderRadius: '8px',
                                  background: 'rgba(255, 255, 255, 0.03)',
                                  border: '1px dashed var(--border)',
                                  fontSize: '0.78rem',
                                  color: 'var(--text-muted)'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--accent)' }}>drag_pan</span>
                                    <span>
                                      <strong>Drag photos</strong> to change their order. <strong>Photo #1</strong> will always serve as the campaign Cover Photo.
                                    </span>
                                  </div>
                                  <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
                                    {disasterImages.length} / 10 Photos
                                  </span>
                                </div>

                                <div style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))',
                                  gap: '14px',
                                  marginTop: '10px'
                                }}>
                                  {disasterImages.map((imgSrc, idx) => {
                                    const isCover = idx === 0;
                                    const isDragging = draggedPhotoIdx === idx;
                                    const isDragOver = dragOverPhotoIdx === idx && draggedPhotoIdx !== idx;

                                    return (
                                      <div
                                        key={imgSrc ? imgSrc.slice(0, 32) + idx : idx}
                                        className={`deploy-photo-card ${isCover ? 'cover' : ''} ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
                                        draggable={!creating && !isProcessingDisasterImages}
                                        onDragStart={(e) => {
                                          setDraggedPhotoIdx(idx);
                                          e.dataTransfer.effectAllowed = 'move';
                                          e.dataTransfer.setData('text/plain', String(idx));
                                        }}
                                        onDragOver={(e) => {
                                          e.preventDefault();
                                          e.dataTransfer.dropEffect = 'move';
                                          if (dragOverPhotoIdx !== idx) {
                                            setDragOverPhotoIdx(idx);
                                          }
                                        }}
                                        onDragEnter={(e) => {
                                          e.preventDefault();
                                          if (dragOverPhotoIdx !== idx) {
                                            setDragOverPhotoIdx(idx);
                                          }
                                        }}
                                        onDragLeave={(e) => {
                                          if (e.currentTarget.contains(e.relatedTarget)) return;
                                          if (dragOverPhotoIdx === idx) {
                                            setDragOverPhotoIdx(null);
                                          }
                                        }}
                                        onDrop={(e) => {
                                          e.preventDefault();
                                          setDragOverPhotoIdx(null);
                                          const sourceIdx = draggedPhotoIdx !== null ? draggedPhotoIdx : parseInt(e.dataTransfer.getData('text/plain'), 10);
                                          if (!isNaN(sourceIdx) && sourceIdx !== idx) {
                                            moveDisasterImage(sourceIdx, idx);
                                          }
                                          setDraggedPhotoIdx(null);
                                        }}
                                        onDragEnd={() => {
                                          setDraggedPhotoIdx(null);
                                          setDragOverPhotoIdx(null);
                                        }}
                                        style={{
                                          cursor: isDragging ? 'grabbing' : 'grab',
                                          opacity: isDragging ? 0.35 : 1,
                                          transform: isDragging ? 'scale(0.95)' : isDragOver ? 'scale(1.03)' : 'scale(1)',
                                          borderColor: isDragOver ? 'var(--accent)' : isCover ? 'var(--accent)' : undefined,
                                          boxShadow: isDragOver ? '0 0 14px var(--accent-dim)' : undefined,
                                          transition: 'transform 0.15s ease, opacity 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease'
                                        }}
                                        title="Click and drag to reorder photos"
                                      >
                                        {/* Top Clean Media Viewport */}
                                        <div
                                          className="deploy-photo-media"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingCampaignPhotoIdx(idx);
                                          }}
                                          title="Click to inspect & touch-up face blur (RA 10173)"
                                          style={{ cursor: 'pointer' }}
                                        >
                                          <img
                                            src={imgSrc}
                                            alt={`Disaster aftermath evidence ${idx + 1}`}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none', userSelect: 'none', display: 'block' }}
                                            draggable={false}
                                          />

                                          {/* Drag Handle Indicator with Order Number */}
                                          <div
                                            className="deploy-photo-drag-handle"
                                            title="Drag to reorder position"
                                          >
                                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>drag_indicator</span>
                                            <span>#{idx + 1}</span>
                                          </div>

                                          {/* Touch-Up Privacy Blur button */}
                                          <button
                                            type="button"
                                            className="deploy-photo-touchup-btn"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setEditingCampaignPhotoIdx(idx);
                                            }}
                                            title="Open full preview & tap faces to add/remove blur"
                                          >
                                            <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>tune</span>
                                            <span>Touch-Up</span>
                                          </button>

                                          {/* Remove photo button */}
                                          <button
                                            type="button"
                                            className="deploy-photo-remove-btn"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              removeDisasterImage(idx);
                                            }}
                                            title="Remove photo"
                                            aria-label="Remove photo"
                                          >
                                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
                                          </button>
                                        </div>

                                        {/* Clean Bottom Utility Bar (Zero Badge Overlap) */}
                                        <div className="deploy-photo-footer">
                                          {isCover ? (
                                            <span className="deploy-photo-cover-tag">
                                              <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>star</span>
                                              <span>Cover</span>
                                            </span>
                                          ) : (
                                            <button
                                              type="button"
                                              className="deploy-photo-set-cover-btn"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                moveDisasterImage(idx, 0);
                                              }}
                                              title="Make this the Cover Photo (Slot #1)"
                                            >
                                              <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>star_border</span>
                                              <span>Set Cover</span>
                                            </button>
                                          )}

                                          {(() => {
                                            const meta = disasterImagesMeta[idx];
                                            const blurredCount = meta?.isBlurred ? (meta.facesBlurred || 0) : 0;
                                            const isPaused = Boolean(meta?.blurredUrl && !meta.isBlurred);
                                            return (
                                              <button
                                                type="button"
                                                className={`deploy-photo-privacy-btn ${blurredCount > 0 ? 'is-blurred' : (isPaused ? 'is-paused' : '')}`}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  toggleDisasterImageBlur(idx);
                                                }}
                                                title={blurredCount > 0 ? `${blurredCount} face(s) blurred — click to show original` : (isPaused ? 'Click to re-apply face blur' : 'Scan & blur faces (RA 10173)')}
                                              >
                                                <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>blur_on</span>
                                                <span>
                                                  {blurredCount > 0 ? `${blurredCount} blurred` : (isPaused ? 'Re-blur' : 'Blur')}
                                                </span>
                                              </button>
                                            );
                                          })()}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {editingCampaignPhotoIdx !== null && disasterImages[editingCampaignPhotoIdx] && (
                    <FaceBlurEditorModal
                      isOpen={true}
                      title={`Campaign Photo #${editingCampaignPhotoIdx + 1}`}
                      originalUrl={disasterImagesMeta[editingCampaignPhotoIdx]?.originalUrl || disasterImages[editingCampaignPhotoIdx]}
                      initialUrl={disasterImages[editingCampaignPhotoIdx]}
                      initialBoxes={disasterImagesMeta[editingCampaignPhotoIdx]?.boxes || []}
                      initialBlurred={Boolean(disasterImagesMeta[editingCampaignPhotoIdx]?.isBlurred)}
                      onClose={() => setEditingCampaignPhotoIdx(null)}
                      onSave={(updated) => {
                        const targetIdx = editingCampaignPhotoIdx;
                        setDisasterImages((prev) => prev.map((u, i) => (i === targetIdx ? updated.url : u)));
                        setDisasterImagesMeta((prev) => {
                          const next = [...prev];
                          const prevOriginal = prev[targetIdx]?.originalUrl || disasterImages[targetIdx];
                          next[targetIdx] = {
                            originalUrl: prevOriginal,
                            blurredUrl: updated.blurredUrl,
                            boxes: updated.boxes,
                            facesBlurred: updated.facesBlurred,
                            isBlurred: updated.isBlurred
                          };
                          return next;
                        });
                        showSuccess(
                          updated.facesBlurred > 0
                            ? `Saved ${updated.facesBlurred} blurred face${updated.facesBlurred === 1 ? '' : 's'} on Photo #${targetIdx + 1}.`
                            : `Saved unblurred Photo #${targetIdx + 1}.`,
                          'Privacy Touch-Up Saved'
                        );
                      }}
                    />
                  )}

                  {/* ── Step 3: Humanitarian Operation Tags ── */}
                  {deployStep === 3 && (
                    <div className="fade-in">
                      <div className="deploy-section-card">
                        <div className="deploy-section-header">
                          <div className="deploy-section-title-wrap">
                            <div className="deploy-section-icon-badge">
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                                {category === 'CD' ? 'volunteer_activism' : 'sell'}
                              </span>
                            </div>
                            <div>
                              <h3 className="deploy-section-title">
                                {category === 'CD' ? '3. Community Aid & Initiative Tags' : '3. Disaster Response & Relief Tags'}
                              </h3>
                              <div className="deploy-section-subtitle">
                                {category === 'CD'
                                  ? 'Keywords in title auto-detect relevant project tags. Click chips to toggle tags.'
                                  : 'Keywords in title auto-detect relevant disaster relief tags. Click chips to toggle tags.'}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.74rem', color: selectedTags.length > 0 ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 600 }}>
                              {selectedTags.length} Selected
                            </span>
                            <span className="deploy-step-pill">Step 3 of 5</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {[...(category === 'CD' ? CHARITY_TAGS : DISASTER_TAGS), ...PRESET_CAMPAIGN_TAGS.filter(t => !(category === 'CD' ? CHARITY_TAGS : DISASTER_TAGS).includes(t))].map((tag) => {
                            const isSelected = selectedTags.includes(tag);
                            const isAuto = autoDetectedTagsRef.current.includes(tag) && isSelected;
                            return (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => handleTagToggle(tag)}
                                className={`deploy-tag-chip ${isSelected ? 'active' : ''}`}
                                title={isAuto ? 'Auto-detected from campaign title keyword. Click to toggle.' : `Click to toggle ${tag}`}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{isSelected ? 'check' : 'add'}</span>
                                <span>{tag}</span>
                                {isAuto && (
                                  <span style={{ fontSize: '9px', opacity: 0.85, marginLeft: '3px', background: 'var(--accent-dim)', border: '1px solid var(--accent)', padding: '1px 4px', borderRadius: '3px' }}>
                                    auto
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Step 4: Operation Ground Zero & Interactive Map ── */}
                  {deployStep === 4 && (
                    <div className="fade-in">
                      <div className="deploy-section-card">
                        <div className="deploy-section-header">
                          <div className="deploy-section-title-wrap">
                            <div className="deploy-section-icon-badge">
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>explore</span>
                            </div>
                            <div>
                              <h3 className="deploy-section-title">
                                {category === 'CD' ? '4. Beneficiary Community Location & Map Pin' : '4. Disaster Location & Ground Pin'}
                              </h3>
                              <div className="deploy-section-subtitle">
                                {category === 'CD'
                                  ? 'Enter the beneficiary community location or click anywhere on the map to pin project coordinates.'
                                  : 'Enter the disaster ground location or click anywhere on the map to pin exact coordinates.'}
                              </div>
                            </div>
                          </div>
                          <span className="deploy-step-pill">Step 4 of 5</span>
                        </div>

                        {/* 2-Column Responsive Layout: Granular Address Details (Left) & Stable Map View (Right) */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '22px', alignItems: 'start' }}>

                          {/* ── Left Column: Granular Address Details ── */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: '#ef4444' }}>location_on</span>
                                Complete Address Details
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
                                  <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>clear_all</span>
                                  <span>Clear</span>
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
                                  setLocationRegion([e.target.value, barangay, city, province, region, zipCode, country, landmark ? `(Landmark: ${landmark})` : ''].filter(Boolean).join(', '));
                                }}
                                disabled={creating}
                              />
                            </div>

                            {/* 2. Barangay & Municipality / City */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                              <div>
                                <label className="deploy-input-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                                  <span>Barangay</span>
                                  <span style={{ fontSize: '0.64rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.02em' }}>PSA PSGC</span>
                                </label>
                                <BarangayCombobox
                                  value={barangay}
                                  onChange={(val) => {
                                    setBarangay(val);
                                    setLocationRegion([street, val, city, province, region, zipCode, country, landmark ? `(Landmark: ${landmark})` : ''].filter(Boolean).join(', '));
                                  }}
                                  city={city}
                                  province={province}
                                  prefetchedBarangays={prefetchedPsgcBarangays.list}
                                  prefetchedForCity={prefetchedPsgcBarangays.city}
                                  disabled={creating}
                                  inputClassName="input deploy-field-input"
                                  placeholder="Select or type Barangay"
                                  variant="deploy"
                                />
                              </div>
                              <div>
                                <label className="deploy-input-label">Municipality / City <span className="deploy-required-star">*</span></label>
                                <input
                                  className="input deploy-field-input"
                                  type="text"
                                  required
                                  placeholder="e.g., Maasin City"
                                  value={city}
                                  onChange={(e) => {
                                    setCity(e.target.value);
                                    setLocationRegion([street, barangay, e.target.value, province, region, zipCode, country, landmark ? `(Landmark: ${landmark})` : ''].filter(Boolean).join(', '));
                                  }}
                                  disabled={creating}
                                />
                              </div>
                            </div>

                            {/* 3. Province / State beside and left of Zip / Postal Code */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                              <div>
                                <label className="deploy-input-label">Province / State <span className="deploy-required-star">*</span></label>
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
                                    setLocationRegion([street, barangay, city, provVal, (autoReg || region), zipCode, country, landmark ? `(Landmark: ${landmark})` : ''].filter(Boolean).join(', '));
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
                                    setLocationRegion([street, barangay, city, province, region, e.target.value, country, landmark ? `(Landmark: ${landmark})` : ''].filter(Boolean).join(', '));
                                  }}
                                  disabled={creating}
                                />
                              </div>
                            </div>

                            {/* 4. Region & Country */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                              <div>
                                <label className="deploy-input-label">Region <span className="deploy-required-star">*</span></label>
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
                                    setLocationRegion([street, barangay, city, province, regVal, zipCode, country, landmark ? `(Landmark: ${landmark})` : ''].filter(Boolean).join(', '));
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
                                    setLocationRegion([street, barangay, city, province, region, zipCode, e.target.value, landmark ? `(Landmark: ${landmark})` : ''].filter(Boolean).join(', '));
                                  }}
                                  disabled={creating}
                                />
                              </div>
                            </div>

                            {/* 5. Landmark / Evacuation Site */}
                            <div>
                              <label className="deploy-input-label">
                                {category === 'CD' ? 'Landmark / Community Center / School (Optional)' : 'Landmark / Evacuation Site (Optional)'}
                              </label>
                              <input
                                className="input deploy-field-input"
                                type="text"
                                placeholder={category === 'CD' ? "e.g., Near Barangay Covered Court, Elementary School, Health Center" : "e.g., Near City Port, Rizal Park, Evacuation Center"}
                                value={landmark}
                                onChange={(e) => {
                                  setLandmark(e.target.value);
                                  setLocationRegion([street, barangay, city, province, region, zipCode, country, e.target.value ? `(Landmark: ${e.target.value})` : ''].filter(Boolean).join(', '));
                                }}
                                disabled={creating}
                              />
                            </div>

                            {/* Find Location Button */}
                            <button
                              type="button"
                              className="deploy-locate-btn"
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
                              title="Search and pin location on map"
                            >
                              {isFindingLocation ? (
                                <>
                                  <span className="material-symbols-outlined spin" style={{ fontSize: '18px', color: 'var(--accent)' }}>progress_activity</span>
                                  <span>Finding Location on Map...</span>
                                </>
                              ) : (
                                <>
                                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--accent)' }}>explore</span>
                                  <span>Find Location & Pin on Map</span>
                                </>
                              )}
                            </button>

                            {/* Formatted Full Address & GPS Badge */}
                            <div style={{
                              background: 'var(--bg-inset)',
                              border: '1px solid var(--border)',
                              borderRadius: '10px',
                              padding: '12px 14px',
                              marginTop: '4px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: '10px'
                            }}>
                              <div style={{ flex: 1, minWidth: '180px' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--accent)' }}>location_on</span>
                                  <span>Confirmed Target Area:</span>
                                </div>
                                <div style={{ fontSize: '0.84rem', fontWeight: 600, color: locationRegion ? 'var(--text-primary)' : 'var(--text-muted)', marginTop: '2px', wordBreak: 'break-word' }}>
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
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                border: '1px solid var(--accent-glow, rgba(34,197,94,0.3))',
                                whiteSpace: 'nowrap'
                              }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>my_location</span>
                                <span>GPS: {gpsCoordinates || '10.1327° N, 124.8385° E'}</span>
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
                                onChangeGranularAddress={handleGranularAddressFromMap}
                                onChangeGps={(coords) => setGpsCoordinates(coords)}
                                onLocationFound={(res) => {
                                  setIsFindingLocation(false);
                                  const nextZip = (!zipCode && res.address?.postcode && /^\d{4}$/.test(String(res.address.postcode).trim())) ? String(res.address.postcode).trim() : zipCode;
                                  const nextReg = region || (province ? getRegionForProvince(province) : '');
                                  if (nextZip !== zipCode) setZipCode(nextZip);
                                  if (nextReg && nextReg !== region) setRegion(nextReg);
                                  const preservedAddr = [street, barangay, city, province, nextReg, nextZip, country || 'Philippines', landmark ? `(Landmark: ${landmark})` : ''].filter(Boolean).join(', ');
                                  if (preservedAddr) setLocationRegion(preservedAddr);
                                  showSuccess(
                                    `Pinned on map (${res.display_name?.split(',').slice(0, 2).join(',') || city || province}). Your typed address fields were preserved.`,
                                    'Map Location Pinned'
                                  );
                                }}
                                onSearchStatus={(status) => {
                                  setIsFindingLocation(false);
                                  if (!status.success) {
                                    showWarning(
                                      'Could not find the address on the map. Please check the City / Province or click directly on the map.',
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
                            <div style={{ marginTop: '8px', fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>info</span>
                              <span>Click or drag the pin to auto-fill official PSA/NAMRIA Barangay, City, Province, Region, ZIP &amp; GPS. Clicking Find Location pins your typed address without overwriting your text.</span>
                            </div>
                          </div>

                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Step 5: Official Receiving Channels & Review ── */}
                  {deployStep === 5 && (
                    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                      {/* Pre-Flight Operation Review — Real DonorView CampaignCard Preview */}
                      {(() => {
                        const targetPhpVal = Math.max(0, Math.round(Number(targetAmount || 0)));
                        const resolvedLoc = [barangay, city, province].filter(Boolean).join(', ') || locationRegion || '';
                        const previewCamp = {
                          id: 0,
                          isPreview: true,
                          title: title.trim() || 'Untitled Campaign',
                          category: category || 'DR',
                          description: description.trim() || '',
                          targetAmount: targetPhpVal / 170000,
                          targetAmountPhp: targetPhpVal,
                          target_amount_php: targetPhpVal,
                          currentAmount: 0,
                          currentAmountPhp: 0,
                          current_amount_php: 0,
                          isActive: true,
                          orgName: orgDisplayName || currentUser?.name || 'Your Organization',
                          orgAddress: walletAddress || currentUser?.wallet_address || '',
                          locationRegion: resolvedLoc,
                          location_region: resolvedLoc,
                          urgency: urgency || 'STABLE (CHARITABLE AID)',
                          targetDate: targetDate || '',
                          target_date: targetDate || '',
                          beneficiariesImpact: beneficiariesImpact || '',
                          beneficiaries_impact: beneficiariesImpact || '',
                          tags: Array.isArray(selectedTags) ? selectedTags : [],
                          disasterImages: Array.isArray(disasterImages) ? disasterImages : [],
                          imageUrl: Array.isArray(disasterImages) && disasterImages.length > 0 ? disasterImages[0] : '',
                          gcashName,
                          gcashNumber,
                          gcashQrUrl,
                          mayaName,
                          mayaNumber,
                          mayaQrUrl,
                          bankQrUrl,
                          donorCount: 0,
                          railBreakdown: {
                            gcash: { php: 0, count: 0 },
                            maya: { php: 0, count: 0 },
                            bank: { php: 0, count: 0 },
                            eth: { php: 0, count: 0 }
                          }
                        };
                        return (
                          <div className="dc-preflight-panel">
                            <div className="dc-preflight-head">
                              <div className="dc-preflight-title-row">
                                <span className="material-symbols-outlined">fact_check</span>
                                <span>Pre-Flight Operation Review</span>
                                <span className="dc-preflight-badge">
                                  <span className="dc-live-dot" />
                                  <span>Donor View</span>
                                </span>
                              </div>

                              <div className="dc-pv-toggle" role="group" aria-label="Preview layout">
                                <button
                                  type="button"
                                  className={`dc-pv-toggle-btn${previewViewMode === 'list' ? ' is-active' : ''}`}
                                  onClick={() => setPreviewViewMode('list')}
                                >
                                  <span className="material-symbols-outlined">view_agenda</span>
                                  <span>List</span>
                                </button>
                                <button
                                  type="button"
                                  className={`dc-pv-toggle-btn${previewViewMode === 'grid' ? ' is-active' : ''}`}
                                  onClick={() => setPreviewViewMode('grid')}
                                >
                                  <span className="material-symbols-outlined">grid_view</span>
                                  <span>Grid</span>
                                </button>
                              </div>
                            </div>

                            <div className="dc-preflight-body">
                              <div className="dc-real-preview-stage" aria-label="Read-only preview of donor campaign card">
                                <div className={previewViewMode === 'grid' ? 'campaigns-grid dc-real-preview-grid' : 'campaigns-list dc-real-preview-list'}>
                                  <CampaignCard
                                    camp={previewCamp}
                                    contract={contract}
                                    role={ROLES.DONOR}
                                    walletAddress={walletAddress}
                                    currentUser={currentUser}
                                    interfaceMode={interfaceMode}
                                    lowBandwidthMode={lowBandwidthMode}
                                    language={language}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Section 3: Official Multi-Channel E-Wallet & Bank Settings */}
                      {(() => {
                        const profileReliefData = getProfileReliefChannels();
                        const gcashReady = Boolean(gcashNumber || gcashQrUrl || gcashName);
                        const mayaReady = Boolean(mayaNumber || mayaQrUrl || mayaName);
                        const bankReady = Boolean(bankAccountNumber || bankQrUrl || bankName);
                        const gcashLibCount = savedQrList.filter(q => q.payment_method === 'GCash').length;
                        const mayaLibCount = savedQrList.filter(q => q.payment_method === 'Maya').length;
                        const bankLibCount = savedQrList.filter(q => q.payment_method === 'Bank').length;

                        const channels = [
                          {
                            id: 'gcash',
                            name: 'GCash',
                            dot: '#007DFE',
                            ready: gcashReady,
                            summary: gcashReady ? [gcashNumber, gcashQrUrl ? 'QR attached' : ''].filter(Boolean).join(' · ') || gcashName : 'Click to add account'
                          },
                          {
                            id: 'maya',
                            name: 'Maya',
                            dot: '#00d68f',
                            ready: mayaReady,
                            summary: mayaReady ? [mayaNumber, mayaQrUrl ? 'QR attached' : ''].filter(Boolean).join(' · ') || mayaName : 'Click to add account'
                          },
                          {
                            id: 'bank',
                            name: 'Bank Transfer',
                            dot: '#a855f7',
                            ready: bankReady,
                            summary: bankReady ? [bankName, bankAccountNumber || (bankQrUrl ? 'QR attached' : '')].filter(Boolean).join(' · ') : 'Click to add bank'
                          }
                        ];

                        return (
                          <div className="deploy-section-card dc-pay-section">
                            <div className="deploy-section-header dc-pay-header">
                              <div>
                                <h3 className="deploy-section-title">Receiving Payment Channels</h3>
                                <div className="deploy-section-subtitle">
                                  Choose where donors send direct transfers. You can configure one or all three channels.
                                </div>
                              </div>

                              {profileReliefData.hasAny && (
                                <button
                                  type="button"
                                  className="dc-pay-import-btn"
                                  onClick={handleAutofillFromProfile}
                                  title="Autofill GCash, Maya, and Bank details from your NGO Profile"
                                >
                                  <span className="material-symbols-outlined">sync</span>
                                  <span>Autofill from Profile</span>
                                </button>
                              )}
                            </div>

                            {/* 3 Clear Interactive Channel Cards */}
                            <div className="dc-pay-tabs" role="tablist" aria-label="Payment channels">
                              {channels.map((ch) => {
                                const isActive = activePaymentChannelTab === ch.id;
                                return (
                                  <button
                                    key={ch.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={isActive}
                                    className={`dc-pay-tab${isActive ? ' is-active' : ''}`}
                                    onClick={() => setActivePaymentChannelTab(ch.id)}
                                  >
                                    <div className="dc-pay-tab-top">
                                      <span className="dc-pay-tab-name">
                                        <span className="dc-pay-brand-dot" style={{ background: ch.dot }} />
                                        <span>{ch.name}</span>
                                      </span>
                                      <span className={`dc-pay-status${ch.ready ? ' is-ready' : ''}`}>
                                        {ch.ready ? 'Ready' : 'Not set'}
                                      </span>
                                    </div>
                                    <span className="dc-pay-tab-sub">{ch.summary}</span>
                                  </button>
                                );
                              })}
                            </div>

                            {/* Clean Neutral 2-Column Editor Panel */}
                            <div className="dc-pay-editor fade-in" key={activePaymentChannelTab}>
                              {/* ── 1. GCASH ── */}
                              {activePaymentChannelTab === 'gcash' && (
                                <div className="dc-pay-grid">
                                  <div className="dc-pay-fields">
                                    <div className="dc-pay-field">
                                      <label className="dc-pay-lbl">GCash Account Name</label>
                                      <input
                                        className="input deploy-field-input"
                                        type="text"
                                        placeholder="e.g., Philippine Red Cross - Southern Leyte"
                                        value={gcashName}
                                        onChange={(e) => setGcashName(e.target.value)}
                                        disabled={creating}
                                      />
                                      <span className="dc-field-sub">Registered name shown to donors in the GCash app.</span>
                                    </div>

                                    <div className="dc-pay-field">
                                      <label className="dc-pay-lbl">GCash Mobile Number</label>
                                      <input
                                        className="input deploy-field-input dc-pay-mono"
                                        type="text"
                                        placeholder="0992 982 4615"
                                        value={gcashNumber}
                                        onChange={(e) => setGcashNumber(formatPhoneNumber(e.target.value))}
                                        disabled={creating}
                                      />
                                      <span className="dc-field-sub">11-digit mobile number for direct GCash transfers.</span>
                                    </div>
                                  </div>

                                  <div className="dc-pay-qr-col">
                                    <div className="dc-pay-qr-bar">
                                      <span className="dc-pay-lbl">GCash QR Code</span>
                                      <div className="dc-pay-qr-acts">
                                        <button
                                          type="button"
                                          className="dc-pay-mini-btn"
                                          onClick={() => setShowSelectQrModal('GCash')}
                                        >
                                          <span className="material-symbols-outlined">qr_code_2</span>
                                          <span>Library ({gcashLibCount})</span>
                                        </button>
                                        {gcashQrUrl && (
                                          <button
                                            type="button"
                                            className="dc-pay-mini-btn dc-pay-mini-btn--danger"
                                            onClick={() => {
                                              setGcashQrUrl('');
                                              setSelectedGcashQrId(null);
                                            }}
                                            title="Remove QR"
                                          >
                                            Remove
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {gcashQrUrl ? (
                                      <div className="dc-pay-qr-preview">
                                        <img src={gcashQrUrl} alt="Organization GCash QR" className="dc-pay-qr-img" />
                                        <span className="dc-pay-qr-tag">
                                          <span className="material-symbols-outlined">check_circle</span>
                                          <span>QR attached</span>
                                        </span>
                                      </div>
                                    ) : (
                                      <label className="dc-pay-qr-drop">
                                        <span className="material-symbols-outlined dc-pay-qr-ico">qr_code_scanner</span>
                                        <span className="dc-pay-qr-drop-title">Upload GCash QR</span>
                                        <span className="dc-pay-qr-drop-sub">PNG, JPG, or WebP</span>
                                        <input type="file" accept="image/*" onChange={handleGcashQrUpload} style={{ display: 'none' }} disabled={creating} />
                                      </label>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* ── 2. MAYA ── */}
                              {activePaymentChannelTab === 'maya' && (
                                <div className="dc-pay-grid">
                                  <div className="dc-pay-fields">
                                    <div className="dc-pay-field">
                                      <label className="dc-pay-lbl">Maya Account / Merchant Name</label>
                                      <input
                                        className="input deploy-field-input"
                                        type="text"
                                        placeholder="e.g., Philippine Red Cross or Official Merchant"
                                        value={mayaName}
                                        onChange={(e) => setMayaName(e.target.value)}
                                        disabled={creating}
                                      />
                                      <span className="dc-field-sub">Registered merchant or recipient name in Maya.</span>
                                    </div>

                                    <div className="dc-pay-field">
                                      <label className="dc-pay-lbl">Maya Number or @Username</label>
                                      <input
                                        className="input deploy-field-input dc-pay-mono"
                                        type="text"
                                        placeholder="0992 982 4615"
                                        value={mayaNumber}
                                        onChange={(e) => setMayaNumber(formatPhoneNumber(e.target.value))}
                                        disabled={creating}
                                      />
                                      <span className="dc-field-sub">Donors can send funds directly to this Maya account.</span>
                                    </div>
                                  </div>

                                  <div className="dc-pay-qr-col">
                                    <div className="dc-pay-qr-bar">
                                      <span className="dc-pay-lbl">Maya QR Code</span>
                                      <div className="dc-pay-qr-acts">
                                        <button
                                          type="button"
                                          className="dc-pay-mini-btn"
                                          onClick={() => setShowSelectQrModal('Maya')}
                                        >
                                          <span className="material-symbols-outlined">qr_code_2</span>
                                          <span>Library ({mayaLibCount})</span>
                                        </button>
                                        {mayaQrUrl && (
                                          <button
                                            type="button"
                                            className="dc-pay-mini-btn dc-pay-mini-btn--danger"
                                            onClick={() => {
                                              setMayaQrUrl('');
                                              setSelectedMayaQrId(null);
                                            }}
                                            title="Remove QR"
                                          >
                                            Remove
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {mayaQrUrl ? (
                                      <div className="dc-pay-qr-preview">
                                        <img src={mayaQrUrl} alt="Organization Maya QR" className="dc-pay-qr-img" />
                                        <span className="dc-pay-qr-tag">
                                          <span className="material-symbols-outlined">check_circle</span>
                                          <span>QR attached</span>
                                        </span>
                                      </div>
                                    ) : (
                                      <label className="dc-pay-qr-drop">
                                        <span className="material-symbols-outlined dc-pay-qr-ico">qr_code_scanner</span>
                                        <span className="dc-pay-qr-drop-title">Upload Maya QR</span>
                                        <span className="dc-pay-qr-drop-sub">PNG, JPG, or WebP</span>
                                        <input type="file" accept="image/*" onChange={handleMayaQrUpload} style={{ display: 'none' }} disabled={creating} />
                                      </label>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* ── 3. DIRECT BANK TRANSFER ── */}
                              {activePaymentChannelTab === 'bank' && (
                                <div className="dc-pay-grid">
                                  <div className="dc-pay-fields">
                                    <div className="dc-pay-field">
                                      <label className="dc-pay-lbl">Bank Name</label>
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

                                    <div className="dc-pay-bank-pair">
                                      <div className="dc-pay-field">
                                        <label className="dc-pay-lbl">Account Name</label>
                                        <input
                                          className="input deploy-field-input"
                                          type="text"
                                          placeholder="Account holder name"
                                          value={bankAccountName}
                                          onChange={(e) => setBankAccountName(e.target.value)}
                                          disabled={creating}
                                        />
                                      </div>

                                      <div className="dc-pay-field">
                                        <label className="dc-pay-lbl">Account Number</label>
                                        <input
                                          className="input deploy-field-input dc-pay-mono"
                                          type="text"
                                          placeholder="0012 3456 7890"
                                          value={bankAccountNumber}
                                          onChange={(e) => setBankAccountNumber(e.target.value)}
                                          disabled={creating}
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  <div className="dc-pay-qr-col">
                                    <div className="dc-pay-qr-bar">
                                      <span className="dc-pay-lbl">InstaPay / Bank QR (Optional)</span>
                                      <div className="dc-pay-qr-acts">
                                        {bankLibCount > 0 && (
                                          <button
                                            type="button"
                                            className="dc-pay-mini-btn"
                                            onClick={() => setShowSelectQrModal('Bank')}
                                          >
                                            <span className="material-symbols-outlined">qr_code_2</span>
                                            <span>Library ({bankLibCount})</span>
                                          </button>
                                        )}
                                        {bankQrUrl && (
                                          <button
                                            type="button"
                                            className="dc-pay-mini-btn dc-pay-mini-btn--danger"
                                            onClick={() => {
                                              setBankQrUrl('');
                                              setSelectedBankQrId(null);
                                            }}
                                            title="Remove QR"
                                          >
                                            Remove
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {bankQrUrl ? (
                                      <div className="dc-pay-qr-preview">
                                        <img src={bankQrUrl} alt="Organization Bank QR" className="dc-pay-qr-img" />
                                        <span className="dc-pay-qr-tag">
                                          <span className="material-symbols-outlined">check_circle</span>
                                          <span>QR attached</span>
                                        </span>
                                      </div>
                                    ) : (
                                      <label className="dc-pay-qr-drop">
                                        <span className="material-symbols-outlined dc-pay-qr-ico">account_balance</span>
                                        <span className="dc-pay-qr-drop-title">Upload Bank / InstaPay QR</span>
                                        <span className="dc-pay-qr-drop-sub">PNG, JPG, or WebP</span>
                                        <input type="file" accept="image/*" onChange={handleBankQrUpload} style={{ display: 'none' }} disabled={creating} />
                                      </label>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Single Clean Footer Switch for QR Library Saving */}
                              <div className="dc-pay-editor-foot">
                                <label className="dc-pay-save-toggle">
                                  <input
                                    type="checkbox"
                                    checked={saveToLibraryChecked}
                                    onChange={(e) => setSaveToLibraryChecked(e.target.checked)}
                                  />
                                  <span className="dc-pay-switch" aria-hidden="true" />
                                  <span>Save newly uploaded QR codes to your reusable library</span>
                                </label>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Multi-Step Wizard Navigation Controls */}
                  <div className="deploy-wizard-actions">
                    <div>
                      {deployStep > 1 && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            setDeployStep(s => Math.max(1, s - 1));
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 18px', borderRadius: '8px' }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
                          <span>Back</span>
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        Step {deployStep} of 5
                      </span>
                    </div>

                    <div>
                      {deployStep < 5 ? (
                        <button
                          key="wizard-continue-step-btn"
                          type="button"
                          className="btn btn-primary"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (deployStep === 1) {
                              if (!title.trim()) {
                                showWarning('Please provide a campaign title before continuing.');
                                return;
                              }
                              const parsedPhp = parseFloat(targetAmount);
                              if (isNaN(parsedPhp) || parsedPhp <= 0) {
                                showWarning('Please provide a valid fundraising target goal (greater than ₱0).');
                                return;
                              }
                              if (!targetDate) {
                                showWarning('Please select a Target Due Date to continue.');
                                return;
                              }
                            } else if (deployStep === 4) {
                              if (!city.trim() || !province.trim()) {
                                showWarning('Please specify at least a Municipality/City and Province.');
                                return;
                              }
                            }
                            setDeployStep(s => Math.min(5, s + 1));
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 22px', borderRadius: '8px', fontWeight: 700 }}
                        >
                          <span>Continue to Step {deployStep + 1}</span>
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_forward</span>
                        </button>
                      ) : (
                        <button
                          key="wizard-submit-deploy-btn"
                          type="button"
                          className="btn btn-primary"
                          onClick={handleCreateCampaign}
                          disabled={creating}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 32px', borderRadius: '8px', fontWeight: 700 }}
                        >
                          {creating ? (
                            <><div className="spinner" /> Deploying Campaign to Ledger…</>
                          ) : (
                            <>
                              <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>check_circle</span>
                              <span>Launch Campaign</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* ── 5. DONATION LEDGER TAB ── */}
        {activeTab === 'ledger' && (
          <div key="tab-org-ledger" className="donor-tab-transition" style={{ paddingBottom: '130px' }}>
            <div className="admin-page-header" id="tour-ngo-ledger-header">
              <div className="admin-page-title-wrap">
                <h2 className="admin-page-title">
                  <span className="material-symbols-outlined icon" style={{ color: 'var(--text-primary)' }}>receipt_long</span>
                  <span>Donation Ledger</span>
                </h2>
                <p className="admin-page-sub">
                  Immutable, tamper-proof real-time transaction receipts and audit trail for contributions received by {orgDisplayName || 'your organization'}.
                </p>
              </div>

              <div className="admin-page-header-actions">
                <button
                  type="button"
                  className="dbo-cmd-btn"
                  onClick={fetchOrgDonations}
                  disabled={loadingOrgDonations}
                  title="Re-query the blockchain and database for latest transactions"
                >
                  <span className={`material-symbols-outlined ${loadingOrgDonations ? 'spinning' : ''}`} style={{ fontSize: '15px' }}>sync</span>
                  <span>{loadingOrgDonations ? 'Syncing...' : 'Sync Ledger'}</span>
                </button>
                <button
                  type="button"
                  className="dbo-cmd-btn"
                  onClick={() => setShowDeclareDepositModal(true)}
                  title="Declare a GCash, Maya, or Bank transfer received without a donor receipt upload"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>add_card</span>
                  <span>Log Deposit</span>
                </button>
                <button
                  type="button"
                  className="dbo-cmd-btn dbo-cmd-btn--primary"
                  onClick={() => setNgoLedgerExportOpen(true)}
                  title="Filter & export organized NGO ledger (Excel, CSV, or Audit PDF)"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>tune</span>
                  <span>Export Report</span>
                </button>
              </div>
            </div>

            {/* ── Unified Executive Metrics Strip — Vercel Design System (Zero Card-Ception) ── */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              overflow: 'hidden',
              marginBottom: '20px'
            }}>
              {/* Stat 1: Total Funds Received */}
              <div style={{ padding: '16px 20px', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Total Funds Received
                  </span>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#10b981' }}>payments</span>
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono, monospace)', letterSpacing: '-0.02em' }}>
                  <LiveCounter value={Math.round(totalRaisedByMe * 170000)} prefix="₱" duration={1050} /> <span style={{ fontSize: '0.80rem', color: 'var(--text-muted)' }}>PHP</span>
                </div>
                <div style={{ fontSize: '0.74rem', color: '#10b981', fontWeight: 500 }}>
                  Gasless Sepolia Audited Total
                </div>
              </div>

              {/* Stat 2: Verified Transactions */}
              <div style={{ padding: '16px 20px', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Verified Transactions
                  </span>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#38bdf8' }}>receipt_long</span>
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono, monospace)', letterSpacing: '-0.02em' }}>
                  <LiveCounter value={ledgerTelemetry.totalCount} duration={850} /> <span style={{ fontSize: '0.80rem', color: 'var(--text-muted)' }}>Recorded</span>
                </div>
                <div style={{ fontSize: '0.74rem', color: '#38bdf8', fontWeight: 500 }}>
                  100% Sepolia EVM Audited
                </div>
              </div>

              {/* Stat 3: Payment Rails Breakdown */}
              <div style={{ padding: '16px 20px', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Payment Rails
                  </span>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#a78bfa' }}>account_balance_wallet</span>
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono, monospace)', letterSpacing: '-0.02em' }}>
                  <LiveCounter value={ledgerTelemetry.railCounts.gcash + ledgerTelemetry.railCounts.maya + ledgerTelemetry.railCounts.bank} duration={850} /> <span style={{ fontSize: '0.80rem', color: 'var(--text-muted)' }}>PHP Donations</span>
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  GCash ({ledgerTelemetry.railCounts.gcash}) · Maya ({ledgerTelemetry.railCounts.maya}) · Bank/Card ({ledgerTelemetry.railCounts.bank})
                </div>
              </div>

              {/* Stat 4: Offline Verifications */}
              {(() => {
                const pendingCount = (pendingDonations || []).length;
                return (
                  <div style={{
                    padding: '16px 20px',
                    display: 'flex', flexDirection: 'column', gap: '4px',
                    background: pendingCount > 0 ? 'rgba(245, 158, 11, 0.04)' : 'transparent'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 600, color: pendingCount > 0 ? '#f59e0b' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Offline Verifications
                      </span>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px', color: pendingCount > 0 ? '#f59e0b' : '#10b981' }}>
                        {pendingCount > 0 ? 'hourglass_top' : 'task_alt'}
                      </span>
                    </div>
                    <div style={{ fontSize: '1.45rem', fontWeight: 800, color: pendingCount > 0 ? '#f59e0b' : 'var(--text-primary)', fontFamily: 'var(--font-mono, monospace)' }}>
                      {pendingCount} <span style={{ fontSize: '0.80rem', color: 'var(--text-muted)' }}>Pending</span>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: pendingCount > 0 ? '#f59e0b' : '#10b981', fontWeight: 500 }}>
                      {pendingCount > 0 ? 'Action required in review table' : 'All payment slips verified'}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* ── Pending Manual Donations Section (E-Wallets & Banks) — Premium Redesign + AI Audit & Batch Verification ── */}
            {Boolean((pendingDonations || []).length > 0) && (
              <div style={{
                marginBottom: '28px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                padding: '22px 26px',
                borderRadius: '16px',
                boxShadow: 'var(--shadow-card)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      background: 'rgba(56, 189, 248, 0.15)',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      color: '#38bdf8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>pending_actions</span>
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.12rem', color: 'var(--text-primary)', fontWeight: 800, letterSpacing: '-0.01em' }}>
                        Pending E-Wallet &amp; Bank Slip Verifications ({(pendingDonations || []).length})
                      </h3>
                      <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        AI Receipt Audit Engine automatically verifies reference patterns and amounts to protect NGOs from fraud.
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={async () => {
                        const allIds = (pendingDonations || []).map(d => d.Manual_ID);
                        if (!window.confirm(`Fast-Approve ALL ${allIds.length} pending donation slips with AI Verification?`)) return;
                        try {
                          const res = await fetch(`${API_BASE_URL}/manual-donations/batch-verify`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ manualIds: allIds })
                          });
                          const data = await res.json();
                          if (res.ok && data.success) {
                            alert(`Successfully batch-verified ${data.verifiedCount} donation slip(s)!`);
                            fetchPendingDonations();
                            fetchOrgDashboardData();
                          } else {
                            alert(`Batch verification failed: ${data.error || 'Unknown error'}`);
                          }
                        } catch (err) {
                          alert('Failed to connect to server for batch verification.');
                        }
                      }}
                      style={{
                        background: '#16a34a',
                        color: '#fff',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(22, 163, 74, 0.25)'
                      }}
                      title="Batch approve all pending slips with AI OCR Verification"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>bolt</span>
                      <span>1-Click Approve All AI-Verified Slips</span>
                    </button>

                    <span className="ref-status-live-chip" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '5px 12px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.5px' }}>
                      ACTION REQUIRED ({(pendingDonations || []).length})
                    </span>
                  </div>
                </div>

                {loadingPending ? (
                  <div style={{ textAlign: 'center', padding: '30px' }}><div className="spinner spinner-light" /></div>
                ) : (
                  <div style={{ overflowX: 'auto', borderRadius: '12px' }}>
                    <table style={{
                      width: '100%',
                      minWidth: '960px',
                      borderCollapse: 'separate',
                      borderSpacing: '0 8px',
                      fontSize: '0.85rem'
                    }}>
                      <thead>
                        <tr style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 700 }}>
                          <th style={{ padding: '8px 16px', textAlign: 'left', width: '20%' }}>Donor Identity</th>
                          <th style={{ padding: '8px 16px', textAlign: 'left', width: '24%' }}>Relief Campaign</th>
                          <th style={{ padding: '8px 16px', textAlign: 'left', width: '14%' }}>Payment Rail</th>
                          <th style={{ padding: '8px 16px', textAlign: 'left', width: '15%' }}>Amount (PHP)</th>
                          <th style={{ padding: '8px 16px', textAlign: 'center', width: '15%' }}>AI OCR Status</th>
                          <th style={{ padding: '8px 16px', textAlign: 'right', width: '12%' }}>Review Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingDonations.map((d) => {
                          const pm = String(d.Payment_Method || 'Fiat').toUpperCase();
                          const isGcash = pm.includes('GCASH');
                          const isMaya = pm.includes('MAYA') || pm.includes('PAYMAYA');

                          return (
                            <tr
                              key={d.Manual_ID}
                              style={{
                                background: 'var(--bg-subcard, var(--bg-card))',
                                border: '1px solid var(--border)',
                                boxShadow: 'var(--shadow-sm)',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              {/* 1. Donor Name / Badge */}
                              <td style={{ padding: '14px 16px', borderRadius: '10px 0 0 10px', verticalAlign: 'middle' }}>
                                {d.Donor_Name && d.Donor_Name !== 'Anonymous Donor' ? (
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)', padding: '5px 12px', borderRadius: '8px', color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.82rem' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#38bdf8' }}>account_circle</span>
                                    <span>{d.Donor_Name}</span>
                                  </div>
                                ) : (
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'var(--bg-input, rgba(255, 255, 255, 0.06))', border: '1px solid var(--border)', padding: '5px 12px', borderRadius: '8px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.81rem' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>visibility_off</span>
                                    <span>Anonymous Donor</span>
                                  </div>
                                )}
                              </td>

                              {/* 2. Relief Campaign */}
                              <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.86rem', lineHeight: 1.4, paddingRight: '8px' }}>
                                  {d.Campaign_Title}
                                </div>
                              </td>

                              {/* 3. Payment Rail Badge */}
                              <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  fontSize: '0.74rem',
                                  fontWeight: 700,
                                  background: isGcash ? 'rgba(56, 189, 248, 0.15)' : isMaya ? 'rgba(34, 197, 94, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                                  color: isGcash ? '#0284c7' : isMaya ? '#16a34a' : '#9333ea',
                                  border: `1px solid ${isGcash ? 'rgba(56, 189, 248, 0.35)' : isMaya ? 'rgba(34, 197, 94, 0.35)' : 'rgba(168, 85, 247, 0.35)'}`
                                }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                                    {isGcash ? 'smartphone' : isMaya ? 'credit_card' : 'account_balance'}
                                  </span>
                                  <span>{pm}</span>
                                </span>
                              </td>

                              {/* 4. Amount ETH + PHP */}
                              <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <span style={{ color: '#16a34a', fontWeight: 850, fontSize: '0.94rem', letterSpacing: '-0.01em' }}>
                                    ₱{Math.round(parseFloat(d.Amount) * 170000).toLocaleString('en-US')} <span style={{ fontSize: '0.76rem' }}>PHP</span>
                                  </span>
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                                    Awaiting NGO check
                                  </span>
                                </div>
                              </td>

                              {/* 5. AI OCR Status & Proof Slip */}
                              <td style={{ padding: '14px 16px', textAlign: 'center', verticalAlign: 'middle' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                  {(() => {
                                    const ai = d.ai_result || {};
                                    const refNo = d.Reference_Number || ai.extractedRef || '';
                                    const hasRef = Boolean(refNo && refNo.trim().length >= 8);
                                    const hasImage = Boolean(d.Receipt_Base64);
                                    const flags = ai.fraudFlags || [];
                                    const isInvalidImg = flags.some(f => String(f).includes('INVALID_RECEIPT_IMAGE'));
                                    const isDup = flags.some(f => String(f).includes('DUPLICATE'));

                                    const isRailMismatch = flags.some(f => String(f).includes('PAYMENT_RAIL_MISMATCH'));
                                    const isAmtMismatch = flags.some(f => String(f).includes('AMOUNT_MISMATCH'));
                                    const isVerified = Boolean(ai.isAiVerified !== false && (hasRef || ai.isAiVerified) && !isInvalidImg && !isDup && !isRailMismatch && !isAmtMismatch);
                                    const score = (ai.confidenceScore && ai.confidenceScore > 50 && isVerified) ? ai.confidenceScore : (isVerified ? 98 : (ai.confidenceScore || 35));

                                    if (isVerified) {
                                      return (
                                        <span
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '3px 8px',
                                            borderRadius: '6px',
                                            fontSize: '0.71rem',
                                            fontWeight: 800,
                                            background: 'rgba(34, 197, 94, 0.12)',
                                            color: '#16a34a',
                                            border: '1px solid rgba(34, 197, 94, 0.3)'
                                          }}
                                          title={ai.summary || 'Receipt verified by Gemini AI Vision & Tesseract OCR'}
                                        >
                                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>verified</span>
                                          <span>AI Verified ({score}%)</span>
                                        </span>
                                      );
                                    } else if (isInvalidImg) {
                                      return (
                                        <span
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '3px 8px',
                                            borderRadius: '6px',
                                            fontSize: '0.71rem',
                                            fontWeight: 800,
                                            background: 'rgba(239, 68, 68, 0.15)',
                                            color: '#ef4444',
                                            border: '1px solid rgba(239, 68, 68, 0.35)'
                                          }}
                                          title={ai.summary || 'Not a valid payment receipt screenshot'}
                                        >
                                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>gpp_bad</span>
                                          <span>Not a Receipt ({score}%)</span>
                                        </span>
                                      );
                                    } else if (isDup) {
                                      return (
                                        <span
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '3px 8px',
                                            borderRadius: '6px',
                                            fontSize: '0.71rem',
                                            fontWeight: 800,
                                            background: 'rgba(245, 158, 11, 0.18)',
                                            color: '#d97706',
                                            border: '1px solid rgba(245, 158, 11, 0.4)'
                                          }}
                                          title={flags.join('\n')}
                                        >
                                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>warning</span>
                                          <span>Duplicate Ref ({score}%)</span>
                                        </span>
                                      );
                                    } else if (isAmtMismatch) {
                                      return (
                                        <span
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '3px 8px',
                                            borderRadius: '6px',
                                            fontSize: '0.71rem',
                                            fontWeight: 800,
                                            background: 'rgba(239, 68, 68, 0.15)',
                                            color: '#ef4444',
                                            border: '1px solid rgba(239, 68, 68, 0.35)'
                                          }}
                                          title={flags.find(f => String(f).includes('AMOUNT_MISMATCH')) || 'Extracted receipt amount differs from declared amount'}
                                        >
                                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>error</span>
                                          <span>Amount Mismatch ({score}%)</span>
                                        </span>
                                      );
                                    } else if (isRailMismatch) {
                                      return (
                                        <span
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '3px 8px',
                                            borderRadius: '6px',
                                            fontSize: '0.71rem',
                                            fontWeight: 800,
                                            background: 'rgba(239, 68, 68, 0.15)',
                                            color: '#ef4444',
                                            border: '1px solid rgba(239, 68, 68, 0.35)'
                                          }}
                                          title={flags.find(f => String(f).includes('PAYMENT_RAIL_MISMATCH')) || 'Declared rail differs from receipt image'}
                                        >
                                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>gpp_bad</span>
                                          <span>Rail Mismatch ({score}%)</span>
                                        </span>
                                      );
                                    } else {
                                      return (
                                        <span
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '3px 8px',
                                            borderRadius: '6px',
                                            fontSize: '0.71rem',
                                            fontWeight: 800,
                                            background: 'rgba(245, 158, 11, 0.12)',
                                            color: '#d97706',
                                            border: '1px solid rgba(245, 158, 11, 0.3)'
                                          }}
                                          title={ai.summary || 'Requires manual NGO verification'}
                                        >
                                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>help_outline</span>
                                          <span>Manual Audit ({score}%)</span>
                                        </span>
                                      );
                                    }
                                  })()}

                                  {d.Receipt_Base64 ? (
                                    <button
                                      type="button"
                                      onClick={() => setProofPreviewModalImg({ img: d.Receipt_Base64, donation: d })}
                                      style={{
                                        background: 'rgba(56, 189, 248, 0.15)',
                                        border: '1px solid rgba(56, 189, 248, 0.35)',
                                        color: '#38bdf8',
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        fontSize: '0.73rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                      }}
                                    >
                                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>image</span>
                                      <span>Preview Slip</span>
                                    </button>
                                  ) : (
                                    <span style={{ color: '#64748b', fontSize: '0.73rem', fontStyle: 'italic' }}>No Slip Uploaded</span>
                                  )}
                                </div>
                              </td>

                              {/* 6. Review Actions */}
                              <td style={{ padding: '14px 16px', borderRadius: '0 10px 10px 0', verticalAlign: 'middle' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                                  <button
                                    type="button"
                                    className="btn btn-sm"
                                    style={{
                                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                      color: '#fff',
                                      border: 'none',
                                      padding: '7px 14px',
                                      borderRadius: '8px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      fontWeight: 700,
                                      fontSize: '0.78rem',
                                      boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
                                      cursor: 'pointer'
                                    }}
                                    onClick={() => handleOpenVerification(d)}
                                    title="Review donor slip and cross-reference with account statement"
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>fact_check</span>
                                    <span>Verify</span>
                                  </button>

                                  <button
                                    type="button"
                                    className="btn btn-sm"
                                    style={{
                                      background: 'rgba(239, 68, 68, 0.12)',
                                      color: '#ef4444',
                                      border: '1px solid rgba(239, 68, 68, 0.35)',
                                      padding: '7px 12px',
                                      borderRadius: '8px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      fontWeight: 600,
                                      fontSize: '0.78rem',
                                      cursor: 'pointer'
                                    }}
                                    onClick={() => handleOpenRejection(d)}
                                    title="Reject unverified or mismatched payment slip"
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>cancel</span>
                                    <span>Reject</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── Vercel Navigation Underline Tabs (Payment Rails) ── */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
              borderBottom: '1px solid var(--border)',
              marginBottom: '16px',
              overflowX: 'auto',
              scrollbarWidth: 'none'
            }}>
              {[
                { key: 'ALL', label: 'All Receipts', count: (orgDonations || []).length },
                { key: 'GCASH', label: 'GCash', count: ledgerTelemetry?.railCounts?.gcash || 0 },
                { key: 'MAYA', label: 'Maya', count: ledgerTelemetry?.railCounts?.maya || 0 },
                { key: 'BANK', label: 'Card & Bank', count: ledgerTelemetry?.railCounts?.bank || 0 }
              ].map(rail => {
                const isActive = ledgerRailFilter === rail.key;
                return (
                  <button
                    key={rail.key}
                    type="button"
                    onClick={() => { setLedgerRailFilter(rail.key); setCurrentPageLedger(1); }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      borderBottom: isActive ? '2px solid var(--text-primary)' : '2px solid transparent',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                      padding: '10px 2px',
                      marginBottom: '-1px',
                      fontSize: '0.82rem',
                      fontWeight: isActive ? 600 : 500,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{rail.label}</span>
                    <span style={{
                      background: isActive ? 'var(--bg-hover)' : 'var(--bg-inset)',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                      padding: '1px 7px',
                      borderRadius: '10px',
                      fontSize: '0.70rem',
                      fontWeight: 600
                    }}>
                      {rail.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* ── Unified Single-Row Vercel Toolbar ── */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
              marginBottom: '16px'
            }}>
              {/* Search input with sleek Vercel input styling */}
              <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
                <span className="material-symbols-outlined" style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  fontSize: '16px',
                  pointerEvents: 'none'
                }}>
                  search
                </span>
                <input
                  type="text"
                  placeholder="Search hash, campaign, donor..."
                  value={searchQueryLedger}
                  onChange={(e) => { setSearchQueryLedger(e.target.value); setCurrentPageLedger(1); }}
                  style={{
                    width: '100%',
                    height: '36px',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '0 30px 0 32px',
                    fontSize: '0.82rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                {searchQueryLedger && (
                  <button
                    type="button"
                    onClick={() => { setSearchQueryLedger(''); setCurrentPageLedger(1); }}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>close</span>
                  </button>
                )}
              </div>

              {/* Right: Dropdowns + Segmented Mode Switcher */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {/* Category Dropdown */}
                <select
                  value={ledgerFilter}
                  onChange={(e) => { setLedgerFilter(e.target.value); setCurrentPageLedger(1); }}
                  style={{
                    height: '36px',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '0 10px',
                    fontSize: '0.78rem',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="ALL">All Categories</option>
                  <option value="DR">Disaster Relief (DR)</option>
                  <option value="CD">Charitable Aid (CD)</option>
                </select>

                {/* Campaign Dropdown */}
                <select
                  value={ledgerCampaignFilter}
                  onChange={(e) => { setLedgerCampaignFilter(e.target.value); setCurrentPageLedger(1); }}
                  style={{
                    height: '36px',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '0 10px',
                    fontSize: '0.78rem',
                    outline: 'none',
                    cursor: 'pointer',
                    maxWidth: '180px'
                  }}
                >
                  <option value="ALL">All Campaigns</option>
                  {(myCampaigns || []).map(c => (
                    <option key={c.id} value={c.id}>#{c.id} - {c.title?.slice(0, 20)}...</option>
                  ))}
                </select>

                {/* Sort Dropdown */}
                <select
                  value={ledgerSort}
                  onChange={(e) => setLedgerSort(e.target.value)}
                  style={{
                    height: '36px',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '0 10px',
                    fontSize: '0.78rem',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="NEWEST">Newest First</option>
                  <option value="AMOUNT_HIGH">Highest Amount</option>
                  <option value="AMOUNT_LOW">Lowest Amount</option>
                  <option value="OLDEST">Oldest First</option>
                </select>

                {/* Reset button if active filters */}
                {(ledgerFilter !== 'ALL' || ledgerCampaignFilter !== 'ALL' || searchQueryLedger.trim()) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQueryLedger('');
                      setLedgerFilter('ALL');
                      setLedgerCampaignFilter('ALL');
                      setCurrentPageLedger(1);
                    }}
                    style={{
                      height: '36px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      borderRadius: '8px',
                      padding: '0 10px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Reset
                  </button>
                )}

                {/* Vercel Segmented Switcher: Cards vs Table */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '2px',
                  height: '36px',
                  boxSizing: 'border-box'
                }}>
                  <button
                    type="button"
                    onClick={() => setLedgerViewMode('cards')}
                    style={{
                      background: ledgerViewMode === 'cards' ? 'var(--bg-hover)' : 'transparent',
                      color: ledgerViewMode === 'cards' ? 'var(--text-primary)' : 'var(--text-muted)',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0 10px',
                      height: '30px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>view_agenda</span>
                    <span>Cards</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLedgerViewMode('table')}
                    style={{
                      background: ledgerViewMode === 'table' ? 'var(--bg-hover)' : 'transparent',
                      color: ledgerViewMode === 'table' ? 'var(--text-primary)' : 'var(--text-muted)',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0 10px',
                      height: '30px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>table_rows</span>
                    <span>Table</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ── Main Ledger Content ── */}
            {loadingOrgDonations ? (
              <div className="empty-state">
                <div className="spinner spinner-light" style={{ width: 28, height: 28 }} />
                <div className="empty-title">Synchronizing on-chain ledger entries…</div>
              </div>
            ) : !orgDonations || orgDonations.length === 0 ? (
              <div className="db-empty-state">
                <div className="db-empty-icon">
                  <span className="material-symbols-outlined">receipt_long</span>
                </div>
                <div className="db-empty-title">No transactions recorded yet</div>
                <div className="db-empty-desc">
                  When donors contribute to your relief campaigns, immutable cryptographic receipts will appear here in real time.
                </div>
              </div>
            ) : (filteredLedger || []).length === 0 ? (
              <div className="db-empty-state">
                <div className="db-empty-icon">
                  <span className="material-symbols-outlined">search_off</span>
                </div>
                <div className="db-empty-title">No transactions match these filter criteria</div>
                <div className="db-empty-desc">
                  Try adjusting the search keyword, category, or payment rail filter above.
                </div>
                <button
                  type="button"
                  className="db-btn"
                  onClick={() => { setSearchQueryLedger(''); setLedgerFilter('ALL'); setLedgerRailFilter('ALL'); setLedgerCampaignFilter('ALL'); }}
                >
                  <span>Reset Filters</span>
                </button>
              </div>
            ) : ledgerViewMode === 'cards' ? (
              /* ── CARDS VIEW: Vercel Geist 4-Column Grid ── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {paginatedLedger.map((d, idx) => {
                  const matchCamp = (campaigns || []).find(c => String(c.id) === String(d.campaignId)) || { id: d.campaignId, title: `Relief Campaign #${d.campaignId}` };
                  const rawTitle = matchCamp ? matchCamp.title : `Disaster Relief Campaign #${d.campaignId}`;
                  const campTitle = formatCampaignTitle(rawTitle, d.campaignId);
                  const catInfo = getCampaignCategoryInfo(matchCamp);
                  const method = String(d.paymentMethod || 'CARD').toUpperCase();
                  const isGcash = method.includes('GCASH');
                  const isMaya = method.includes('MAYA');
                  const donorDisplay = d.isAnonymous ? 'Anonymous Supporter' : (d.donorName || 'Public Philanthropist');
                  const phpVal = Math.round(parseFloat(d.amount || 0) * 170000);
                  const ethVal = parseFloat(d.amount || 0).toFixed(4);

                  const variancePhp = d.variancePhp !== undefined && d.variancePhp !== null ? Number(d.variancePhp) : 0;
                  const declaredPhp = d.declaredPhp !== undefined && d.declaredPhp !== null ? Number(d.declaredPhp) : (variancePhp !== 0 ? (phpVal - variancePhp) : phpVal);
                  const isShortage = d.auditStatus === 'SHORTAGE' || variancePhp < -20;
                  const isOverCredit = d.auditStatus === 'OVER_CREDIT' || variancePhp > 20;
                  const hasVariance = isShortage || isOverCredit;

                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '44px 1fr auto auto',
                        alignItems: 'center',
                        gap: '16px',
                        padding: '14px 18px',
                        background: isShortage ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.06) 0%, var(--bg-card) 100%)' : 'var(--bg-card)',
                        border: isShortage ? '1px solid rgba(239, 68, 68, 0.45)' : (isOverCredit ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border)'),
                        borderRadius: '10px',
                        transition: 'border-color 0.15s ease, background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = isShortage ? '#ef4444' : 'var(--border-strong)'; e.currentTarget.style.background = isShortage ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-card-hover)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = isShortage ? 'rgba(239, 68, 68, 0.45)' : (isOverCredit ? 'rgba(245, 158, 11, 0.4)' : 'var(--border)'); e.currentTarget.style.background = isShortage ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.06) 0%, var(--bg-card) 100%)' : 'var(--bg-card)'; }}
                    >
                      {/* Col 1: Payment Rail Avatar */}
                      <div style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '10px',
                        background: isShortage ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-inset)',
                        border: isShortage ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--border-strong)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <span className="material-symbols-outlined" style={{
                          fontSize: '20px',
                          color: isShortage ? '#ef4444' : (isGcash ? '#38bdf8' : isMaya ? '#00d68f' : '#a855f7')
                        }}>
                          {isShortage ? 'warning' : (isGcash ? 'payments' : isMaya ? 'account_balance_wallet' : 'credit_card')}
                        </span>
                        <span style={{
                          fontSize: '0.52rem',
                          fontWeight: 700,
                          color: isShortage ? '#ef4444' : (isGcash ? '#38bdf8' : isMaya ? '#00d68f' : '#a855f7'),
                          letterSpacing: '0.04em',
                          marginTop: '1px'
                        }}>
                          {isGcash ? 'GCASH' : isMaya ? 'MAYA' : 'CARD'}
                        </span>
                      </div>

                      {/* Col 2: Metadata */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                          <span className={`campaign-category-pill ${catInfo.colorClass}`} style={{ fontSize: '0.66rem', padding: '1px 6px', borderRadius: '4px' }}>
                            <span>{catInfo.prefix}-00{d.campaignId} • {catInfo.label}</span>
                          </span>

                          {isShortage ? (
                            <span style={{
                              fontSize: '0.66rem',
                              color: '#ef4444',
                              background: 'rgba(239, 68, 68, 0.12)',
                              border: '1px solid rgba(239, 68, 68, 0.35)',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              fontWeight: 700
                            }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>warning</span>
                              <span>Amount Altered / Shortage ({variancePhp < 0 ? `-₱${Math.abs(variancePhp).toLocaleString()} PHP` : `+₱${variancePhp.toLocaleString()} PHP`})</span>
                            </span>
                          ) : isOverCredit ? (
                            <span style={{
                              fontSize: '0.66rem',
                              color: '#f59e0b',
                              background: 'rgba(245, 158, 11, 0.12)',
                              border: '1px solid rgba(245, 158, 11, 0.35)',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              fontWeight: 700
                            }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>info</span>
                              <span>Over-Credited (+₱{variancePhp.toLocaleString()} PHP)</span>
                            </span>
                          ) : (
                            <span style={{
                              fontSize: '0.66rem',
                              color: '#10b981',
                              background: 'rgba(16, 185, 129, 0.1)',
                              border: '1px solid rgba(16, 185, 129, 0.25)',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              fontWeight: 600
                            }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>verified</span>
                              <span>Verified On-Chain</span>
                            </span>
                          )}

                          {d.isAnonymous ? (
                            <span style={{ background: 'var(--bg-inset)', color: 'var(--text-muted)', fontSize: '0.66rem', padding: '1px 6px', borderRadius: '4px' }}>
                              Anonymous
                            </span>
                          ) : (
                            <span style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.2)', fontSize: '0.66rem', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                              Public Donor
                            </span>
                          )}

                          <span style={{
                            fontSize: '0.66rem',
                            fontWeight: 600,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: 'var(--bg-inset)',
                            color: 'var(--text-muted)',
                            border: '1px solid var(--border-strong)'
                          }}>
                            {method}
                          </span>
                        </div>

                        <h4 style={{ margin: '0 0 4px 0', fontSize: '0.94rem', color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {campTitle}
                        </h4>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                          <span>Donor: <strong style={{ color: 'var(--text-secondary)' }}>{donorDisplay}</strong></span>
                          {d.donorWallet && (
                            <span>Wallet: <code style={{ fontSize: '0.70rem', background: 'var(--bg-inset)', padding: '1px 5px', borderRadius: '4px', color: 'var(--text-secondary)' }}>{shortAddr(d.donorWallet)}</code></span>
                          )}
                          <span style={{ color: 'var(--border-strong)' }}>•</span>
                          <span>{d.createdAt ? new Date(d.createdAt).toLocaleString() : 'Audited On-Chain'}</span>
                          {d.txHash && (
                            <>
                              <span style={{ color: 'var(--border-strong)' }}>•</span>
                              <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '0.70rem' }}>
                                Tx: {d.txHash.slice(0, 10)}...{d.txHash.slice(-6)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Col 3: Amount Credited */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{
                          fontSize: '1.25rem',
                          fontWeight: 700,
                          color: isShortage ? '#ef4444' : (isOverCredit ? '#f59e0b' : '#10b981'),
                          letterSpacing: '-0.02em',
                          fontFamily: 'var(--font-mono)'
                        }}>
                          +₱{phpVal.toLocaleString('en-US')}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 500, marginTop: '2px' }}>
                          Sepolia Audited
                        </div>
                        {hasVariance && (
                          <div style={{
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            color: isShortage ? '#ef4444' : '#f59e0b',
                            marginTop: '2px',
                            fontFamily: 'var(--font-mono)'
                          }}>
                            Claimed: ₱{declaredPhp.toLocaleString()} ({variancePhp < 0 ? `-₱${Math.abs(variancePhp).toLocaleString()}` : `+₱${variancePhp.toLocaleString()}`})
                          </div>
                        )}
                      </div>

                      {/* Col 4: Vercel Buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => setSelectedVoucherTx(d)}
                          style={{
                            background: 'var(--bg-inset)',
                            border: '1px solid var(--border-strong)',
                            color: 'var(--text-primary)',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.15s ease'
                          }}
                          title="Inspect official cryptographic receipt voucher"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '13px', color: '#10b981' }}>verified</span>
                          <span>Voucher</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(d.txHash);
                            showSuccess('Transaction hash copied to clipboard!', 'Hash Copied');
                          }}
                          style={{
                            background: 'transparent',
                            border: '1px solid var(--border)',
                            color: 'var(--text-muted)',
                            borderRadius: '6px',
                            padding: '6px 8px',
                            fontSize: '0.72rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                          title="Copy Transaction Hash"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>content_copy</span>
                          <span>Copy</span>
                        </button>

                        {d.txHash && !d.txHash.startsWith('MOCK') && (
                          <a
                            href={`https://sepolia.etherscan.io/tx/${d.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              background: 'transparent',
                              border: '1px solid var(--border)',
                              color: 'var(--text-muted)',
                              borderRadius: '6px',
                              padding: '6px 8px',
                              fontSize: '0.72rem',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                            title="View on Sepolia Etherscan Block Explorer"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>open_in_new</span>
                            <span>Etherscan</span>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ── AUDIT TABLE VIEW: Vercel Dark Theme ── */
              <div style={{
                background: 'var(--bg-card)',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                overflow: 'hidden'
              }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: '920px', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-subcard)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '0.70rem', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>Tx Hash</th>
                        <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '0.70rem', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>Timestamp</th>
                        <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '0.70rem', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>Campaign</th>
                        <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '0.70rem', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>Donor</th>
                        <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '0.70rem', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>Rail</th>
                        <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '0.70rem', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>Amount Credited</th>
                        <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '0.70rem', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>Audit Status</th>
                        <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '0.70rem', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>On-Chain Equivalent</th>
                        <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '0.70rem', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedLedger.map((d, idx) => {
                        const matchCamp = (campaigns || []).find(c => String(c.id) === String(d.campaignId));
                        const rawTitle = matchCamp ? matchCamp.title : `Campaign #${d.campaignId}`;
                        const campTitle = formatCampaignTitle(rawTitle, d.campaignId);
                        const donor = d.isAnonymous ? 'Anonymous' : (d.donorName || 'Public Supporter');
                        const phpVal = Math.round(parseFloat(d.amount || 0) * 170000);

                        const variancePhp = d.variancePhp !== undefined && d.variancePhp !== null ? Number(d.variancePhp) : 0;
                        const declaredPhp = d.declaredPhp !== undefined && d.declaredPhp !== null ? Number(d.declaredPhp) : (variancePhp !== 0 ? (phpVal - variancePhp) : phpVal);
                        const isShortage = d.auditStatus === 'SHORTAGE' || variancePhp < -20;
                        const isOverCredit = d.auditStatus === 'OVER_CREDIT' || variancePhp > 20;
                        const hasVariance = isShortage || isOverCredit;

                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle, var(--border))', background: isShortage ? 'rgba(239, 68, 68, 0.03)' : 'transparent', transition: 'background-color 0.15s ease' }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isShortage ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-hover)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isShortage ? 'rgba(239, 68, 68, 0.03)' : 'transparent'; }}
                          >
                            <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ color: isShortage ? '#ef4444' : '#10b981' }}>
                                  {d.txHash ? `${d.txHash.slice(0, 8)}…${d.txHash.slice(-6)}` : 'N/A'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(d.txHash);
                                    showSuccess('Transaction hash copied!', 'Copied');
                                  }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
                                  title="Copy Hash"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>content_copy</span>
                                </button>
                              </div>
                            </td>
                            <td style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: '0.76rem' }}>
                              {d.createdAt ? new Date(d.createdAt).toLocaleString() : 'Audited'}
                            </td>
                            <td style={{ padding: '12px 14px', fontWeight: 500, color: 'var(--text-primary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {campTitle}
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <span style={{ color: d.isAnonymous ? 'var(--text-muted)' : 'var(--text-primary)', fontWeight: d.isAnonymous ? 400 : 600 }}>
                                {donor}
                              </span>
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <span style={{ padding: '2px 7px', borderRadius: '4px', background: 'var(--bg-inset)', border: '1px solid var(--border-strong)', fontSize: '0.70rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                {d.paymentMethod || 'Bank / Card'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 14px', fontFamily: 'monospace' }}>
                              <div style={{ color: isShortage ? '#ef4444' : (isOverCredit ? '#f59e0b' : '#10b981'), fontWeight: 750 }}>
                                +₱{phpVal.toLocaleString('en-US')}
                              </div>
                              {hasVariance && (
                                <div style={{ fontSize: '0.68rem', color: isShortage ? '#ef4444' : '#f59e0b', fontWeight: 600, marginTop: '2px' }}>
                                  Claimed: ₱{declaredPhp.toLocaleString()} ({variancePhp < 0 ? `-₱${Math.abs(variancePhp).toLocaleString()}` : `+₱${variancePhp.toLocaleString()}`})
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              {isShortage ? (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  background: 'rgba(239, 68, 68, 0.12)',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  color: '#ef4444',
                                  fontSize: '0.68rem',
                                  fontWeight: 700
                                }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>warning</span>
                                  <span>Shortage ({variancePhp < 0 ? `-₱${Math.abs(variancePhp).toLocaleString()}` : `+₱${variancePhp}`})</span>
                                </span>
                              ) : isOverCredit ? (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  background: 'rgba(245, 158, 11, 0.12)',
                                  border: '1px solid rgba(245, 158, 11, 0.3)',
                                  color: '#f59e0b',
                                  fontSize: '0.68rem',
                                  fontWeight: 700
                                }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>info</span>
                                  <span>Over-Credit</span>
                                </span>
                              ) : (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  background: 'rgba(16, 185, 129, 0.1)',
                                  border: '1px solid rgba(16, 185, 129, 0.25)',
                                  color: '#10b981',
                                  fontSize: '0.68rem',
                                  fontWeight: 600
                                }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>verified</span>
                                  <span>Clean Match</span>
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                              Sepolia Audited
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <button
                                  type="button"
                                  onClick={() => setSelectedVoucherTx(d)}
                                  style={{
                                    background: 'var(--bg-inset)',
                                    border: '1px solid var(--border-strong)',
                                    color: 'var(--text-primary)',
                                    borderRadius: '4px',
                                    padding: '4px 8px',
                                    fontSize: '0.70rem',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                  }}
                                >
                                  Voucher
                                </button>
                                {d.txHash && !d.txHash.startsWith('MOCK') && (
                                  <a
                                    href={`https://sepolia.etherscan.io/tx/${d.txHash}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                      color: 'var(--text-muted)',
                                      fontSize: '0.70rem',
                                      textDecoration: 'none',
                                      display: 'inline-flex',
                                      alignItems: 'center'
                                    }}
                                    title="Sepolia Explorer"
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>open_in_new</span>
                                  </a>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Centered Pagination Controls ── */}
            {totalPagesLedger > 1 && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '24px',
                padding: '12px 0',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Showing {(currentPageLedger - 1) * campaignsPerPage + 1}–{Math.min(currentPageLedger * campaignsPerPage, (filteredLedger || []).length)} of {(filteredLedger || []).length} verified transactions
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
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
                      type="button"
                      className={`btn btn-sm ${currentPageLedger === pageNum ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setCurrentPageLedger(pageNum)}
                      style={{ minWidth: '34px', height: '34px', borderRadius: '8px', fontWeight: currentPageLedger === pageNum ? 700 : 400 }}
                    >
                      {pageNum}
                    </button>
                  ))}

                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setCurrentPageLedger(p => Math.min(totalPagesLedger, p + 1))}
                    disabled={currentPageLedger === totalPagesLedger}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    Next <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>chevron_right</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 5.5. NGO LEGAL VERIFICATION & SEC ACCREDITATION ── */}
        {activeTab === 'sec-kyc' && (() => {
          const isKycApproved = currentUser?.verification_status === 'Approved' || kycStatusData?.Verification_Status === 'Approved';
          const isKycRejected = kycStatusData?.Verification_Status === 'Rejected';
          const effectiveSecReg = secRegNo || kycStatusData?.secRegistrationNo || '';
          const effectiveTin = tinNo || kycStatusData?.tinNumber || '';
          const effectiveDswd = dswdNo || kycStatusData?.dswdAccreditationNo || '';
          const effectiveRepName = repName || kycStatusData?.authorizedRepName || '';
          const effectiveRepPos = repPosition || kycStatusData?.authorizedRepPosition || '';
          const effectiveAddress = registeredAddress || kycStatusData?.registeredAddress || '';
          const effectiveBoard = boardMembersText || kycStatusData?.boardMembers || '';
          const effectivePrimaryType = primaryIdType || kycStatusData?.primaryIdType || 'Philippine Passport';
          const effectivePrimaryNo = primaryIdNumber || kycStatusData?.primaryIdNumber || '';
          const effectivePrimaryUrl = primaryIdUrl || kycStatusData?.primaryIdUrl || '';
          const effectiveSecondaryType = secondaryIdType || kycStatusData?.secondaryIdType || "LTO Driver's License";
          const effectiveSecondaryNo = secondaryIdNumber || kycStatusData?.secondaryIdNumber || '';
          const effectiveSecondaryUrl = secondaryIdUrl || kycStatusData?.secondaryIdUrl || '';
          const effectiveSecCertUrl = secCertUrl || kycStatusData?.secCertificateUrl || '';
          const hasSubmittedDocs = Boolean(effectiveSecReg.trim() || effectiveSecCertUrl);
          const attachedDocCount = [effectiveSecCertUrl, effectivePrimaryUrl, effectiveSecondaryUrl].filter(Boolean).length;

          const statusTone = isKycApproved ? 'approved' : isKycRejected ? 'rejected' : hasSubmittedDocs ? 'review' : 'pending';
          const statusLabel = isKycApproved
            ? 'Accredited'
            : isKycRejected
              ? 'Correction required'
              : hasSubmittedDocs
                ? 'Under review'
                : 'Submission required';

          return (
            <div key="tab-org-sec-kyc" className="sec-v2-wrap donor-tab-transition">
              {/* ── Page Header (Matches DonorView) ── */}
              <div className="admin-page-header" id="tour-ngo-sec-header">
                <div className="admin-page-title-wrap">
                  <h2 className="admin-page-title">
                    <span className="material-symbols-outlined icon" style={{ color: 'var(--text-primary)' }}>verified_user</span>
                    <span>SEC Accreditation &amp; KYC</span>
                  </h2>
                  <p className="admin-page-sub">
                    Manage Philippine non-profit legal credentials (SEC RA 11232, BIR, DSWD) and signatory KYC documents for relief campaign deployment.
                  </p>
                </div>

                <div className="admin-page-header-actions">
                  <button
                    type="button"
                    className="dbo-cmd-btn"
                    onClick={fetchKycData}
                    disabled={kycLoading}
                    title="Reload verification status from server"
                  >
                    <span className={`material-symbols-outlined ${kycLoading ? 'spinning' : ''}`} style={{ fontSize: '15px' }}>refresh</span>
                    <span>{kycLoading ? 'Refreshing...' : 'Refresh'}</span>
                  </button>

                  {isKycApproved ? (
                    <button
                      type="button"
                      className="dbo-cmd-btn"
                      onClick={() => setShowKycFormOverride(!showKycFormOverride)}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                        {showKycFormOverride ? 'close' : 'edit'}
                      </span>
                      <span>{showKycFormOverride ? 'Close Editor' : 'Edit Credentials'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="dbo-cmd-btn"
                      onClick={handleAutofillDemoSec}
                      title="Fill sample Philippine non-profit credentials for demonstration"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>bolt</span>
                      <span>Fill Sample Data</span>
                    </button>
                  )}
                </div>
              </div>

              {/* ── 4-Stage Verification Progress Rail ── */}
              <div className="sec-rail-card">
                <div className="sec-rail-head">
                  <div className="sec-rail-title">Verification workflow</div>
                  <span className={`sec-status-badge is-${statusTone}`}>
                    <span className="sec-status-dot" />
                    <span>{statusLabel}</span>
                  </span>
                </div>

                <div className="sec-rail-steps">
                  <div className="sec-rail-step is-done">
                    <div className="sec-rail-node">
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check</span>
                    </div>
                    <div className="sec-rail-copy">
                      <div className="sec-rail-name">1. Account registered</div>
                      <div className="sec-rail-desc">Organization profile created</div>
                    </div>
                  </div>

                  <div className={`sec-rail-step ${(hasSubmittedDocs || isKycApproved) ? 'is-done' : 'is-current'}`}>
                    <div className="sec-rail-node">
                      {(hasSubmittedDocs || isKycApproved) ? (
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check</span>
                      ) : '2'}
                    </div>
                    <div className="sec-rail-copy">
                      <div className="sec-rail-name">2. Credentials submitted</div>
                      <div className="sec-rail-desc">
                        {(hasSubmittedDocs || isKycApproved) ? 'SEC certificate & IDs attached' : 'Awaiting document upload'}
                      </div>
                    </div>
                  </div>

                  <div className={`sec-rail-step ${isKycApproved ? 'is-done' : isKycRejected ? 'is-warning' : hasSubmittedDocs ? 'is-current' : ''}`}>
                    <div className="sec-rail-node">
                      {isKycApproved ? (
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check</span>
                      ) : isKycRejected ? (
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>priority_high</span>
                      ) : '3'}
                    </div>
                    <div className="sec-rail-copy">
                      <div className="sec-rail-name">3. Document validation</div>
                      <div className="sec-rail-desc">
                        {isKycApproved
                          ? 'SEC seal & registration verified'
                          : isKycRejected
                            ? 'Requires resubmission'
                            : hasSubmittedDocs
                              ? 'Review in progress'
                              : 'Pending submission'}
                      </div>
                    </div>
                  </div>

                  <div className={`sec-rail-step ${isKycApproved ? 'is-done' : ''}`}>
                    <div className="sec-rail-node">
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                        {isKycApproved ? 'lock_open' : 'lock'}
                      </span>
                    </div>
                    <div className="sec-rail-copy">
                      <div className="sec-rail-name">4. Campaign access</div>
                      <div className="sec-rail-desc">
                        {isKycApproved ? 'Campaign deployment unlocked' : 'Unlocked upon approval'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Approved Institutional Registry (2-Column Geist Layout) ── */}
              {isKycApproved && (
                <div className="sec-approved-layout">
                  {/* Left Main Registry Card */}
                  <div className="sec-registry-card">
                    <div className="sec-registry-top">
                      <div className="sec-registry-identity">
                        <div className="sec-registry-shield">
                          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>verified</span>
                        </div>
                        <div>
                          <h3 className="sec-registry-title">Officially Accredited Non-Profit</h3>
                          <p className="sec-registry-sub">
                            Verified under Philippine SEC RA 11232 guidelines. Relief campaign deployment and smart vault access are active.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn btn-primary sec-deploy-cta"
                        onClick={() => setActiveTab('create')}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>add_circle</span>
                        <span>Deploy Campaign</span>
                      </button>
                    </div>

                    {/* Section 1: Corporate & Regulatory Identifiers */}
                    <div className="sec-registry-section">
                      <div className="sec-registry-section-title">Corporate &amp; regulatory identifiers</div>
                      <div className="sec-kv-grid">
                        <div className="sec-kv-cell">
                          <span className="sec-kv-label">SEC Registration Number</span>
                          <span className="sec-kv-value is-mono">
                            {effectiveSecReg || 'Not provided'}
                          </span>
                        </div>
                        <div className="sec-kv-cell">
                          <span className="sec-kv-label">BIR Tax Identification (TIN)</span>
                          <span className="sec-kv-value is-mono">
                            {effectiveTin || 'Not provided'}
                          </span>
                        </div>
                        <div className="sec-kv-cell">
                          <span className="sec-kv-label">DSWD Solicitation Permit</span>
                          <span className={`sec-kv-value is-mono ${!effectiveDswd ? 'is-muted' : ''}`}>
                            {effectiveDswd || 'Optional — Not on file'}
                          </span>
                        </div>
                        <div className="sec-kv-cell">
                          <span className="sec-kv-label">Smart Vault Status</span>
                          <span className="sec-kv-value">
                            <span className="sec-inline-pill is-verified">
                              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>lock_open</span>
                              <span>Unlocked</span>
                            </span>
                          </span>
                        </div>
                        <div className="sec-kv-cell is-full">
                          <span className="sec-kv-label">Registered Office Address</span>
                          <span className="sec-kv-value">
                            {effectiveAddress || 'Not provided'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Authorized Liaison & Governance */}
                    <div className="sec-registry-section">
                      <div className="sec-registry-section-title">Authorized signatory &amp; governance</div>
                      <div className="sec-kv-grid">
                        <div className="sec-kv-cell">
                          <span className="sec-kv-label">Authorized Liaison Trustee</span>
                          <span className="sec-kv-value">
                            {effectiveRepName || 'Not provided'}
                          </span>
                        </div>
                        <div className="sec-kv-cell">
                          <span className="sec-kv-label">Official Designation</span>
                          <span className="sec-kv-value">
                            {effectiveRepPos || 'Authorized Officer'}
                          </span>
                        </div>
                        {effectiveBoard && (
                          <div className="sec-kv-cell is-full">
                            <span className="sec-kv-label">Governing Board of Trustees</span>
                            <span className="sec-kv-value sec-kv-board">{effectiveBoard}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Vault & Regulatory Portals Column */}
                  <aside className="sec-approved-aside">
                    {/* Verified Documents Vault */}
                    <div className="sec-aside-card">
                      <div className="sec-aside-head">
                        <span className="sec-aside-title">Verified documents</span>
                        <span className="sec-aside-count">{attachedDocCount} on file</span>
                      </div>

                      <div className="sec-vault-list">
                        {/* SEC Certificate Row */}
                        <div className="sec-vault-row">
                          <div className="sec-vault-icon">
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                              {effectiveSecCertUrl && isPdfDocument(effectiveSecCertUrl) ? 'picture_as_pdf' : 'description'}
                            </span>
                          </div>
                          <div className="sec-vault-info">
                            <div className="sec-vault-name">SEC Certificate</div>
                            <div className="sec-vault-meta">{effectiveSecReg || 'Certificate of Incorporation'}</div>
                          </div>
                          {effectiveSecCertUrl ? (
                            <button
                              type="button"
                              className="sec-vault-view-btn"
                              onClick={() => setPreviewDocModal({
                                open: true,
                                title: 'Official SEC Certificate of Incorporation',
                                url: effectiveSecCertUrl,
                                regNo: effectiveSecReg
                              })}
                            >
                              View
                            </button>
                          ) : (
                            <span className="sec-vault-missing">None</span>
                          )}
                        </div>

                        {/* Primary ID Row */}
                        <div className="sec-vault-row">
                          <div className="sec-vault-icon">
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>contact_page</span>
                          </div>
                          <div className="sec-vault-info">
                            <div className="sec-vault-name">{effectivePrimaryType}</div>
                            <div className="sec-vault-meta">
                              Primary ID{effectivePrimaryNo ? ` · ${effectivePrimaryNo}` : ''}
                            </div>
                          </div>
                          {effectivePrimaryUrl ? (
                            <button
                              type="button"
                              className="sec-vault-view-btn"
                              onClick={() => setPreviewDocModal({
                                open: true,
                                title: `Primary Government ID (${effectivePrimaryType})`,
                                url: effectivePrimaryUrl,
                                regNo: effectivePrimaryNo
                              })}
                            >
                              View
                            </button>
                          ) : (
                            <span className="sec-vault-missing">On file</span>
                          )}
                        </div>

                        {/* Secondary ID Row */}
                        <div className="sec-vault-row">
                          <div className="sec-vault-icon">
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>badge</span>
                          </div>
                          <div className="sec-vault-info">
                            <div className="sec-vault-name">{effectiveSecondaryType}</div>
                            <div className="sec-vault-meta">
                              Secondary ID{effectiveSecondaryNo ? ` · ${effectiveSecondaryNo}` : ''}
                            </div>
                          </div>
                          {effectiveSecondaryUrl ? (
                            <button
                              type="button"
                              className="sec-vault-view-btn"
                              onClick={() => setPreviewDocModal({
                                open: true,
                                title: `Secondary Government ID (${effectiveSecondaryType})`,
                                url: effectiveSecondaryUrl,
                                regNo: effectiveSecondaryNo
                              })}
                            >
                              View
                            </button>
                          ) : (
                            <span className="sec-vault-missing">On file</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Official Regulatory Portals */}
                    <div className="sec-aside-card">
                      <div className="sec-aside-head">
                        <span className="sec-aside-title">Regulatory registries</span>
                      </div>
                      <div className="sec-portal-list">
                        <a
                          href="https://esparc.sec.gov.ph"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="sec-portal-link"
                        >
                          <div>
                            <div className="sec-portal-name">SEC eSPARC Portal</div>
                            <div className="sec-portal-host">esparc.sec.gov.ph</div>
                          </div>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>north_east</span>
                        </a>
                        <a
                          href="https://standards.dswd.gov.ph"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="sec-portal-link"
                        >
                          <div>
                            <div className="sec-portal-name">DSWD Standards Bureau</div>
                            <div className="sec-portal-host">standards.dswd.gov.ph</div>
                          </div>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>north_east</span>
                        </a>
                      </div>
                    </div>
                  </aside>
                </div>
              )}

              {/* ── Compliance Notice (When Not Yet Approved) ── */}
              {!isKycApproved && (
                <div className="sec-compliance-banner">
                  <div className="sec-compliance-icon">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>gavel</span>
                  </div>
                  <div className="sec-compliance-content">
                    <div className="sec-compliance-title">Philippine non-profit accreditation requirements</div>
                    <p className="sec-compliance-desc">
                      Non-profit organizations must provide valid SEC Non-Stock registration (RA 11232), BIR TIN, and two government-issued signatory IDs (AMLA RA 9160) to unlock campaign deployment.
                    </p>
                  </div>
                  <div className="sec-compliance-actions">
                    <a href="https://esparc.sec.gov.ph" target="_blank" rel="noopener noreferrer" className="sec-compliance-btn">
                      <span>SEC eSPARC</span>
                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>north_east</span>
                    </a>
                    <a href="https://standards.dswd.gov.ph" target="_blank" rel="noopener noreferrer" className="sec-compliance-btn">
                      <span>DSWD Bureau</span>
                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>north_east</span>
                    </a>
                  </div>
                </div>
              )}

              {/* ── Rejection Notice Banner (When Rejected) ── */}
              {isKycRejected && (
                <div className="sec-rejection-banner">
                  <span className="material-symbols-outlined" style={{ color: '#ef4444', fontSize: '22px', flexShrink: 0, marginTop: '1px' }}>error</span>
                  <div>
                    <div className="sec-rejection-title">Verification incomplete — correction required</div>
                    <p className="sec-rejection-desc">
                      {kycStatusData?.auditNotes || 'Your submitted registration details or certificate could not be validated. Please verify your SEC registration number and upload a clear, legible certificate.'}
                    </p>
                  </div>
                </div>
              )}

              {/* ── Accreditation Submission / Update Workspace ── */}
              {(!isKycApproved || showKycFormOverride) && (
                <>
                  {isKycApproved && showKycFormOverride && (
                    <div className="sec-editor-divider">
                      <span>Update registration &amp; KYC documents</span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setShowKycFormOverride(false)}
                      >
                        Cancel editing
                      </button>
                    </div>
                  )}

                  <form onSubmit={handleSaveKyc} className="sec-terminal-layout">
                    {/* Left Sticky Dossier Readiness Sidebar */}
                    <aside className="sec-dossier-sidebar">
                      <div className="sec-dossier-top">
                        <h3 className="sec-dossier-title">Dossier readiness</h3>
                        <span className={`sec-dossier-pct ${dossierCompletion.percent === 100 ? 'is-done' : ''}`}>
                          {dossierCompletion.percent}%
                        </span>
                      </div>

                      <div className="sec-dossier-progress-box">
                        <div className="sec-dossier-progress-header">
                          <span>Requirements met</span>
                          <span>{dossierCompletion.score} / {dossierCompletion.total}</span>
                        </div>
                        <div className="sec-dossier-progress-track">
                          <div className="sec-dossier-progress-fill" style={{ width: `${dossierCompletion.percent}%` }} />
                        </div>
                      </div>

                      <div className="sec-dossier-checklist">
                        {dossierCompletion.items.map((it) => (
                          <div key={it.id} className={`sec-dossier-item ${it.done ? 'is-ready' : 'is-pending'}`}>
                            <div className="sec-dossier-item-left">
                              <span className="material-symbols-outlined" style={{
                                fontSize: '15px',
                                color: it.done ? '#10b981' : 'var(--text-muted)'
                              }}>
                                {it.done ? 'check_circle' : 'radio_button_unchecked'}
                              </span>
                              <span>{it.label}</span>
                            </div>
                            <span className={`sec-dossier-item-badge ${it.done ? 'done' : 'wait'}`}>
                              {it.done ? 'Ready' : 'Pending'}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="sec-dossier-trust-badges">
                        <div className="sec-dossier-trust-row">
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>verified_user</span>
                          <span>SEC RA 11232 Non-Stock Standard</span>
                        </div>
                        <div className="sec-dossier-trust-row">
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>gavel</span>
                          <span>AMLA RA 9160 Dual-ID Policy</span>
                        </div>
                        <div className="sec-dossier-trust-row">
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>lock</span>
                          <span>Encrypted Document Storage</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="sec-sample-fill-btn"
                        onClick={handleAutofillDemoSec}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>bolt</span>
                        <span>Fill sample SEC credentials</span>
                      </button>
                    </aside>

                    {/* Right Modular Form Cards */}
                    <div className="sec-terminal-main">
                      {/* Card 1: Corporate & Tax Identity */}
                      <div className="sec-workstation-card">
                        <div className="sec-workstation-header">
                          <div className="sec-workstation-title-group">
                            <div className="sec-workstation-icon">
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>domain</span>
                            </div>
                            <div>
                              <h4 className="sec-workstation-title">Corporate &amp; Tax Identity</h4>
                              <p className="sec-workstation-subtitle">SEC Certificate of Incorporation, BIR Form 2303, and principal office address</p>
                            </div>
                          </div>
                          <span className="sec-workstation-badge">Required</span>
                        </div>

                        <div className="sec-form-row-2">
                          <div className="sec-field">
                            <label>SEC Registration Number <span className="sec-req">*</span></label>
                            <input
                              type="text"
                              className="input"
                              placeholder="e.g., SEC-CN2021-08492"
                              value={secRegNo}
                              onChange={e => setSecRegNo(e.target.value)}
                              style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 600 }}
                              required
                            />
                            <span className="sec-field-hint">Non-stock registration code from your SEC certificate.</span>
                          </div>

                          <div className="sec-field">
                            <label>BIR Tax Identification (TIN) <span className="sec-req">*</span></label>
                            <input
                              type="text"
                              className="input"
                              placeholder="e.g., 000-842-192-000"
                              value={tinNo}
                              onChange={e => setTinNo(e.target.value)}
                              style={{ fontFamily: 'var(--font-mono, monospace)' }}
                              required
                            />
                            <span className="sec-field-hint">BIR Form 2303 non-profit tax identification number.</span>
                          </div>
                        </div>

                        <div className="sec-form-row-2" style={{ marginBottom: 0 }}>
                          <div className="sec-field" style={{ marginBottom: 0 }}>
                            <label>Registered Office Address <span className="sec-req">*</span></label>
                            <input
                              type="text"
                              className="input"
                              placeholder="e.g., 37 EDSA cor. Boni Ave., Mandaluyong City, Metro Manila"
                              value={registeredAddress}
                              onChange={e => setRegisteredAddress(e.target.value)}
                              required
                            />
                            <span className="sec-field-hint">Principal office address listed in the Articles of Incorporation.</span>
                          </div>

                          <div className="sec-field" style={{ marginBottom: 0 }}>
                            <label>DSWD / LGU Solicitation Permit</label>
                            <input
                              type="text"
                              className="input"
                              placeholder="e.g., DSWD-SB-A-2024-0193 (Optional)"
                              value={dswdNo}
                              onChange={e => setDswdNo(e.target.value)}
                              style={{ fontFamily: 'var(--font-mono, monospace)' }}
                            />
                            <span className="sec-field-hint">DSWD public solicitation permit (PD 1564) or LGU endorsement.</span>
                          </div>
                        </div>
                      </div>

                      {/* Card 2: Authorized Signatory & Governance */}
                      <div className="sec-workstation-card">
                        <div className="sec-workstation-header">
                          <div className="sec-workstation-title-group">
                            <div className="sec-workstation-icon">
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>badge</span>
                            </div>
                            <div>
                              <h4 className="sec-workstation-title">Authorized Signatory &amp; Trustees</h4>
                              <p className="sec-workstation-subtitle">Named natural person authorized to administer campaigns and relief escrows</p>
                            </div>
                          </div>
                          <span className="sec-workstation-badge">AMLA Standard</span>
                        </div>

                        <div className="sec-form-row-2">
                          <div className="sec-field">
                            <label>Authorized Representative Full Name <span className="sec-req">*</span></label>
                            <input
                              type="text"
                              className="input"
                              placeholder="e.g., Gwendolyn Pang"
                              value={repName}
                              onChange={e => setRepName(e.target.value)}
                              required
                            />
                          </div>

                          <div className="sec-field">
                            <label>Official Designation / Title <span className="sec-req">*</span></label>
                            <input
                              type="text"
                              className="input"
                              placeholder="e.g., Secretary General"
                              value={repPosition}
                              onChange={e => setRepPosition(e.target.value)}
                              required
                            />
                          </div>
                        </div>

                        <div className="sec-field" style={{ marginBottom: 0 }}>
                          <label>Governing Board of Trustees &amp; Officers <span className="sec-req">*</span></label>
                          <input
                            type="text"
                            className="input"
                            placeholder="e.g., Richard Gordon (Chairman) | Gwendolyn Pang (SecGen) | Dr. Benjamin Go (Trustee)"
                            value={boardMembersText}
                            onChange={e => setBoardMembersText(e.target.value)}
                            required
                          />
                          <span className="sec-field-hint">Current trustees and roles as listed in your SEC General Information Sheet (GIS).</span>
                        </div>
                      </div>

                      {/* Card 3: Dual Government ID Verification */}
                      <div className="sec-workstation-card">
                        <div className="sec-workstation-header">
                          <div className="sec-workstation-title-group">
                            <div className="sec-workstation-icon">
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>id_card</span>
                            </div>
                            <div>
                              <h4 className="sec-workstation-title">Signatory Government IDs</h4>
                              <p className="sec-workstation-subtitle">Two valid Philippine government-issued photo IDs for the authorized representative</p>
                            </div>
                          </div>
                          <span className="sec-workstation-badge">2 IDs Required</span>
                        </div>

                        <div className="sec-dual-id-grid">
                          {/* Primary ID */}
                          <div className="sec-id-upload-card">
                            <div className="sec-id-card-head">
                              <span className="sec-id-card-head-title">Primary Government ID</span>
                              <span className={`sec-id-card-pill ${primaryIdUrl ? 'is-attached' : ''}`}>
                                {primaryIdUrl ? 'Attached' : 'Required'}
                              </span>
                            </div>

                            <div className="sec-field" style={{ marginBottom: 0 }}>
                              <label style={{ fontSize: '0.74rem' }}>ID Type</label>
                              <select
                                className="input"
                                value={primaryIdType}
                                onChange={e => setPrimaryIdType(e.target.value)}
                                style={{ height: '38px', fontSize: '0.80rem' }}
                                required
                              >
                                <option value="Philippine Passport">Philippine Passport</option>
                                <option value="PhilID (National ID)">PhilID (Philippine National ID)</option>
                                <option value="UMID (Unified Multi-Purpose ID)">UMID (Unified Multi-Purpose ID)</option>
                                <option value="LTO Driver's License">LTO Driver&apos;s License</option>
                                <option value="PRC Professional ID">PRC Professional ID</option>
                              </select>
                            </div>

                            <div className="sec-field" style={{ marginBottom: 0 }}>
                              <label style={{ fontSize: '0.74rem' }}>Document Number</label>
                              <input
                                type="text"
                                className="input"
                                placeholder="e.g., P8942103B"
                                value={primaryIdNumber}
                                onChange={e => setPrimaryIdNumber(e.target.value)}
                                style={{ fontFamily: 'var(--font-mono, monospace)', height: '38px', fontSize: '0.80rem' }}
                                required
                              />
                            </div>

                            {primaryIdUrl ? (
                              <div className="sec-id-attached">
                                <div className="sec-id-attached-info">
                                  <div className="sec-id-attached-icon">
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                                      {isPdfDocument(primaryIdUrl) ? 'picture_as_pdf' : 'contact_page'}
                                    </span>
                                  </div>
                                  <div className="sec-id-attached-details">
                                    <div className="sec-id-attached-name">{primaryIdType}</div>
                                    <div className="sec-id-attached-meta">{primaryIdNumber || 'Front scan attached'}</div>
                                  </div>
                                </div>
                                <div className="sec-id-attached-actions">
                                  <button
                                    type="button"
                                    className="btn btn-outline btn-sm"
                                    onClick={() => setPreviewDocModal({ open: true, title: `Primary Government ID (${primaryIdType})`, url: primaryIdUrl, regNo: primaryIdNumber })}
                                    style={{ fontSize: '0.74rem', padding: '4px 10px' }}
                                  >
                                    Inspect
                                  </button>
                                  <label className="btn btn-ghost btn-sm" style={{ fontSize: '0.74rem', padding: '4px 10px', cursor: 'pointer', margin: 0 }}>
                                    Replace
                                    <input type="file" accept="image/*,application/pdf" onChange={handlePrimaryIdUpload} style={{ display: 'none' }} />
                                  </label>
                                </div>
                              </div>
                            ) : (
                              <label className="sec-id-dropzone">
                                <span className="material-symbols-outlined" style={{ fontSize: '22px', color: 'var(--text-muted)', marginBottom: '4px' }}>upload_file</span>
                                <span className="sec-dropzone-title">Upload Primary ID (Front)</span>
                                <span className="sec-dropzone-sub">PNG, JPG, or PDF</span>
                                <input type="file" accept="image/*,application/pdf" onChange={handlePrimaryIdUpload} style={{ display: 'none' }} />
                              </label>
                            )}
                          </div>

                          {/* Secondary ID */}
                          <div className="sec-id-upload-card">
                            <div className="sec-id-card-head">
                              <span className="sec-id-card-head-title">Secondary Government ID</span>
                              <span className={`sec-id-card-pill ${secondaryIdUrl ? 'is-attached' : ''}`}>
                                {secondaryIdUrl ? 'Attached' : 'Required'}
                              </span>
                            </div>

                            <div className="sec-field" style={{ marginBottom: 0 }}>
                              <label style={{ fontSize: '0.74rem' }}>ID Type</label>
                              <select
                                className="input"
                                value={secondaryIdType}
                                onChange={e => setSecondaryIdType(e.target.value)}
                                style={{ height: '38px', fontSize: '0.80rem' }}
                                required
                              >
                                <option value="LTO Driver's License">LTO Driver&apos;s License</option>
                                <option value="PhilID (National ID)">PhilID (Philippine National ID)</option>
                                <option value="PRC Professional ID">PRC Professional ID</option>
                                <option value="SSS / GSIS E-Card">SSS / GSIS E-Card</option>
                                <option value="Postal ID (Biometric)">Postal ID (Biometric)</option>
                                <option value="Voter's ID / Comelec">Voter&apos;s ID / Comelec Certificate</option>
                                <option value="TIN Card (BIR)">TIN Card (BIR)</option>
                              </select>
                            </div>

                            <div className="sec-field" style={{ marginBottom: 0 }}>
                              <label style={{ fontSize: '0.74rem' }}>Document Number</label>
                              <input
                                type="text"
                                className="input"
                                placeholder="e.g., N02-18-938210"
                                value={secondaryIdNumber}
                                onChange={e => setSecondaryIdNumber(e.target.value)}
                                style={{ fontFamily: 'var(--font-mono, monospace)', height: '38px', fontSize: '0.80rem' }}
                                required
                              />
                            </div>

                            {secondaryIdUrl ? (
                              <div className="sec-id-attached">
                                <div className="sec-id-attached-info">
                                  <div className="sec-id-attached-icon">
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                                      {isPdfDocument(secondaryIdUrl) ? 'picture_as_pdf' : 'badge'}
                                    </span>
                                  </div>
                                  <div className="sec-id-attached-details">
                                    <div className="sec-id-attached-name">{secondaryIdType}</div>
                                    <div className="sec-id-attached-meta">{secondaryIdNumber || 'Front scan attached'}</div>
                                  </div>
                                </div>
                                <div className="sec-id-attached-actions">
                                  <button
                                    type="button"
                                    className="btn btn-outline btn-sm"
                                    onClick={() => setPreviewDocModal({ open: true, title: `Secondary Government ID (${secondaryIdType})`, url: secondaryIdUrl, regNo: secondaryIdNumber })}
                                    style={{ fontSize: '0.74rem', padding: '4px 10px' }}
                                  >
                                    Inspect
                                  </button>
                                  <label className="btn btn-ghost btn-sm" style={{ fontSize: '0.74rem', padding: '4px 10px', cursor: 'pointer', margin: 0 }}>
                                    Replace
                                    <input type="file" accept="image/*,application/pdf" onChange={handleSecondaryIdUpload} style={{ display: 'none' }} />
                                  </label>
                                </div>
                              </div>
                            ) : (
                              <label className="sec-id-dropzone">
                                <span className="material-symbols-outlined" style={{ fontSize: '22px', color: 'var(--text-muted)', marginBottom: '4px' }}>upload_file</span>
                                <span className="sec-dropzone-title">Upload Secondary ID (Front)</span>
                                <span className="sec-dropzone-sub">PNG, JPG, or PDF</span>
                                <input type="file" accept="image/*,application/pdf" onChange={handleSecondaryIdUpload} style={{ display: 'none' }} />
                              </label>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Card 4: Official SEC Certificate */}
                      <div className="sec-workstation-card">
                        <div className="sec-workstation-header">
                          <div className="sec-workstation-title-group">
                            <div className="sec-workstation-icon">
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>description</span>
                            </div>
                            <div>
                              <h4 className="sec-workstation-title">SEC Certificate of Incorporation</h4>
                              <p className="sec-workstation-subtitle">Automated seal &amp; registration check via Gemini Vision OCR</p>
                            </div>
                          </div>
                          {secCertUrl && (
                            <button
                              type="button"
                              onClick={() => setSecCertUrl('')}
                              className="sec-remove-link"
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        {secCertUrl ? (
                          <div className="sec-doc-attached">
                            <div className="sec-doc-info">
                              <div className="sec-doc-icon">
                                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                                  {isPdfDocument(secCertUrl) ? 'picture_as_pdf' : 'description'}
                                </span>
                              </div>
                              <div>
                                <div className="sec-doc-filename">Official SEC Certificate attached</div>
                                <div className="sec-doc-meta">
                                  {isPdfDocument(secCertUrl) ? 'PDF Document' : 'Image Document'}{secRegNo ? ` · ${secRegNo}` : ''}
                                </div>
                              </div>
                            </div>

                            <div className="sec-doc-actions">
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => setPreviewDocModal({ open: true, title: 'Official SEC Certificate of Incorporation', url: secCertUrl, regNo: secRegNo })}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.76rem' }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>visibility</span>
                                <span>Inspect</span>
                              </button>
                              <label
                                className="btn btn-ghost btn-sm"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.76rem', cursor: 'pointer', margin: 0 }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>sync</span>
                                <span>Replace</span>
                                <input type="file" accept="image/*,application/pdf" onChange={handleKycCertUpload} style={{ display: 'none' }} />
                              </label>
                            </div>
                          </div>
                        ) : (
                          <label className="sec-dropzone">
                            <span className="material-symbols-outlined" style={{ fontSize: '26px', color: 'var(--text-muted)', marginBottom: '6px' }}>upload_file</span>
                            <span className="sec-dropzone-title">Upload SEC Certificate of Incorporation</span>
                            <span className="sec-dropzone-sub">PNG, JPG, or PDF (Max 10 MB) — signed Philippine non-stock certificate</span>
                            <input type="file" accept="image/*,application/pdf" onChange={handleKycCertUpload} style={{ display: 'none' }} />
                          </label>
                        )}
                      </div>

                      {/* Card 5: Legal Affirmation & Submit */}
                      <div className="sec-workstation-card">
                        <label className="sec-affirmation-box">
                          <input
                            type="checkbox"
                            checked={affirmationChecked}
                            onChange={e => setAffirmationChecked(e.target.checked)}
                            required={!isKycApproved}
                          />
                          <span className="sec-affirmation-text">
                            I affirm under penalty of perjury and Republic Act No. 11232 (Revised Corporation Code of the Philippines) that this organization is a legitimate Non-Stock, Non-Profit entity and that the credentials and signatory IDs submitted belong to its authorized officers.
                          </span>
                        </label>

                        {kycSaving && kycStepText && (
                          <div className="sec-scanning-bar">
                            <div className="spinner spinner-light" style={{ width: '15px', height: '15px' }} />
                            <span>{kycStepText}</span>
                          </div>
                        )}

                        <div className="sec-submit-bar">
                          <div className="sec-submit-meta">
                            <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#10b981' }}>shield</span>
                            <span>RA 11232 &amp; AMLA RA 9160 compliant review</span>
                          </div>

                          <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={kycSaving || (!secRegNo.trim() && !secCertUrl) || (!affirmationChecked && !isKycApproved)}
                            style={{ padding: '9px 20px', fontSize: '0.84rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                          >
                            {kycSaving ? (
                              <>
                                <div className="spinner" />
                                <span>Verifying Dossier...</span>
                              </>
                            ) : (
                              <>
                                <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>verified</span>
                                <span>{isKycApproved ? 'Save Updated Credentials' : 'Submit for Accreditation'}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>
                </>
              )}
            </div>
          );
        })()}

        {/* ── Universal Document Viewer Modal (SEC Cert, Primary ID, & Secondary ID) ── */}
        <SecCertificateModal
          isOpen={(viewingKycCert && !!secCertUrl) || previewDocModal.open}
          onClose={() => {
            setViewingKycCert(false);
            setPreviewDocModal({ open: false, title: '', url: '', regNo: '' });
          }}
          url={previewDocModal.open ? previewDocModal.url : secCertUrl}
          orgName={currentUser?.name || kycStatusData?.Org_Name || ''}
          regNo={previewDocModal.open ? previewDocModal.regNo : (secRegNo || kycStatusData?.secRegistrationNo || '')}
          title={previewDocModal.open ? previewDocModal.title : 'Official SEC Certificate of Incorporation Document'}
        />

        {/* ── 5.8. DISASTER RELIEF RADAR HEATMAP TAB (NGO STRATEGIC DISPATCH) ── */}
        {activeTab === 'radar-heatmap' && (
          <div key="tab-org-radar" className="rr-page donor-tab-transition">
            <div className="admin-page-header" id="tour-ngo-radar-header">
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
                  <span className={`material-symbols-outlined ${fetchingCampaigns ? 'spinning' : ''}`} style={{ fontSize: '15px' }}>refresh</span>
                  <span>{fetchingCampaigns ? 'Refreshing...' : 'Refresh'}</span>
                </button>
              </div>
            </div>

            <DisasterRadarHeatmap
              campaigns={campaigns}
              height="620px"
              theme={theme}
              defaultLayer="terrain"
              lowBandwidthMode={lowBandwidthMode}
              reducedMotion={reducedMotion}
              language={language}
              onSelectCampaign={(c) => {
                setActiveTab('all-campaigns');
                setSearchQueryAll(c.title || '');
              }}
            />
          </div>
        )}

        {/* ── 5.9. NGO ANALYTICS & REPORTS TAB ── */}
        {activeTab === 'analytics' && (
          <div key="tab-org-analytics" className="donor-tab-transition">
            <AnalyticsReportsPanel
              mode="organization"
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          </div>
        )}

        {/* ── 6. PROFILE & SETTINGS TAB ── */}
        {activeTab === 'settings' && (
          <div key="tab-org-settings" className="donor-tab-transition">
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
              onStartTour={handleStartTour}
            />
          </div>
        )}

      </section>

      {/* ── AI Smart Budget & Allocation Generator Modal (Module B) ── */}
      {showAiBudgetModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(5, 7, 12, 0.8)', backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999,
          padding: '16px'
        }} className="fade-in">
          <div className="card bounce-in" style={{
            width: '640px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto',
            padding: '24px', background: 'var(--bg-card, #1c1c1c)', border: '1px solid var(--border-strong, rgba(255, 255, 255, 0.16))',
            boxShadow: '0 24px 60px rgba(0,0,0,0.8)', borderRadius: '20px'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))', paddingBottom: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--accent-dim, rgba(34, 197, 94, 0.12))', border: '1px solid var(--border-focus, rgba(34, 197, 94, 0.4))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent, #22c55e)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>smart_toy</span>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary, #fff)' }}>AI Smart Budget & Allocation Generator</h3>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary, #94a3b8)' }}>Powered by UN Sphere Project Standards & Humanitarian Relief Guidelines</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAiBudgetModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted, #94a3b8)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Input Parameters Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '20px' }}>
              <div>
                <label className="deploy-input-label">Disaster / Calamity Type</label>
                <select
                  className="input deploy-field-input"
                  value={aiDisasterType}
                  onChange={(e) => setAiDisasterType(e.target.value)}
                >
                  <option value="Typhoon">Typhoon (Bagyo / Cyclone)</option>
                  <option value="Earthquake">Earthquake (Lindol)</option>
                  <option value="Flood">Flash Flood (Baha)</option>
                  <option value="Landslide">Landslide (Pagguho)</option>
                  <option value="Volcano">Volcanic Eruption (Bulkang Pagsabog)</option>
                </select>
              </div>

              <div>
                <label className="deploy-input-label">Severity Rating / Warning Signal</label>
                <select
                  className="input deploy-field-input"
                  value={aiSeverityRating}
                  onChange={(e) => setAiSeverityRating(e.target.value)}
                >
                  <option value="Signal 1">Signal 1 / Intensity IV (Low Impact)</option>
                  <option value="Signal 2">Signal 2 / Intensity V (Moderate Impact)</option>
                  <option value="Signal 3">Signal 3 / Intensity VI (High Impact)</option>
                  <option value="Signal 4">Signal 4 / Intensity VII (Critical Impact)</option>
                  <option value="Signal 5">Signal 5 / Intensity VIII (Catastrophic / Super Calamity)</option>
                </select>
              </div>

              <div>
                <label className="deploy-input-label">Target Beneficiaries (Families)</label>
                <input
                  type="number"
                  min="10"
                  step="50"
                  className="input deploy-field-input"
                  value={aiBeneficiariesCount}
                  onChange={(e) => setAiBeneficiariesCount(e.target.value)}
                  placeholder="e.g. 500"
                />
              </div>

              <div>
                <label className="deploy-input-label">Geographical Region / Calamity Zone</label>
                <input
                  type="text"
                  className="input deploy-field-input"
                  value={aiRegion}
                  onChange={(e) => setAiRegion(e.target.value)}
                  placeholder="e.g. Eastern Visayas (Southern Leyte)"
                />
              </div>
            </div>

            {/* Action Button */}
            <button
              type="button"
              onClick={handleGenerateAiBudget}
              disabled={aiBudgetLoading || !aiBeneficiariesCount}
              className="btn btn-primary btn-full"
              style={{
                padding: '12px',
                fontSize: '0.9rem',
                fontWeight: 700,
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: 'var(--accent, #22c55e)',
                color: '#052e16',
                border: 'none',
                boxShadow: '0 2px 12px var(--accent-glow, rgba(34, 197, 94, 0.3))',
                cursor: 'pointer'
              }}
            >
              {aiBudgetLoading ? (
                <>
                  <span className="material-symbols-outlined spin" style={{ fontSize: '20px' }}>progress_activity</span>
                  <span>Computing Sphere Standards & Humanitarian Metrics...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>calculate</span>
                  <span>Calculate Standard Humanitarian Allocations</span>
                </>
              )}
            </button>

            {/* Generated Results Preview */}
            {aiBudgetResult && (
              <div style={{ marginTop: '22px', borderTop: '1px solid var(--border, rgba(255,255,255,0.08))', paddingTop: '18px' }} className="fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--accent, #22c55e)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Calculated Humanitarian Target
                  </span>
                  <span style={{ fontSize: '0.68rem', background: 'var(--accent-dim, rgba(34, 197, 94, 0.15))', color: 'var(--accent, #22c55e)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(34, 197, 94, 0.3)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>check</span>
                    {aiBudgetResult.generatedBy === 'AI_GEMINI_1.5_FLASH' ? 'Gemini 1.5 Flash Verified' : 'Sphere Humanitarian Matrix'}
                  </span>
                </div>

                {/* Financial KPI Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ background: 'var(--bg-input, rgba(255,255,255,0.04))', padding: '12px', borderRadius: '12px', border: '1px solid var(--border, rgba(255,255,255,0.08))' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #94a3b8)' }}>RECOMMENDED BUDGET</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--accent, #22c55e)', marginTop: '2px' }}>
                      ₱{Number(aiBudgetResult.totalBudgetPhp).toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #a3a3a3)', marginTop: '2px' }}>
                      PHP Recommended Target
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-input, rgba(255,255,255,0.04))', padding: '12px', borderRadius: '12px', border: '1px solid var(--border, rgba(255,255,255,0.08))' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #94a3b8)' }}>UNIT COST PER FAMILY</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary, #ffffff)', marginTop: '2px' }}>
                      ₱{Number(aiBudgetResult.unitCostPerFamily).toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)', marginTop: '2px' }}>
                      7-day survival standard
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-input, rgba(255,255,255,0.04))', padding: '12px', borderRadius: '12px', border: '1px solid var(--border, rgba(255,255,255,0.08))' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #94a3b8)' }}>TOTAL INDIVIDUALS</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--warning, #f59e0b)', marginTop: '2px' }}>
                      {(Number(aiBeneficiariesCount) * 5).toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)', marginTop: '2px' }}>
                      {Number(aiBeneficiariesCount).toLocaleString()} families
                    </div>
                  </div>
                </div>

                {/* Allocations Breakdown Progress Bars */}
                {aiBudgetResult.allocations && (
                  <div style={{ marginBottom: '16px', background: 'var(--bg-input, rgba(0,0,0,0.25))', padding: '12px', borderRadius: '12px', border: '1px solid var(--border, rgba(255,255,255,0.05))' }}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary, #cbd5e1)', marginBottom: '8px' }}>
                      Humanitarian Resource Allocation Breakdown
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '0.74rem' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted, #94a3b8)', marginBottom: '2px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>water_drop</span>
                            <span>Food & Potable Water</span>
                          </span>
                          <strong style={{ color: 'var(--accent, #22c55e)' }}>{aiBudgetResult.allocations.foodWater}%</strong>
                        </div>
                        <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${aiBudgetResult.allocations.foodWater}%`, height: '100%', background: 'var(--accent, #22c55e)' }} />
                        </div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '2px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>home</span>
                            <span>Emergency Shelter</span>
                          </span>
                          <strong style={{ color: '#f97316' }}>{aiBudgetResult.allocations.shelter}%</strong>
                        </div>
                        <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${aiBudgetResult.allocations.shelter}%`, height: '100%', background: '#f97316' }} />
                        </div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '2px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>medical_services</span>
                            <span>Medical & First-Aid</span>
                          </span>
                          <strong style={{ color: '#22c55e' }}>{aiBudgetResult.allocations.medical}%</strong>
                        </div>
                        <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${aiBudgetResult.allocations.medical}%`, height: '100%', background: '#22c55e' }} />
                        </div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '2px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>local_shipping</span>
                            <span>First-Mile Logistics</span>
                          </span>
                          <strong style={{ color: '#a855f7' }}>{aiBudgetResult.allocations.logistics}%</strong>
                        </div>
                        <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${aiBudgetResult.allocations.logistics}%`, height: '100%', background: '#a855f7' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Generated Mission Narrative */}
                <div style={{ marginBottom: '18px', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '0.74rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Generated Campaign Title:</div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#ffffff', margin: '3px 0 8px 0' }}>{aiBudgetResult.campaignTitle}</div>
                  <div style={{ fontSize: '0.74rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Objective Mission Narrative:</div>
                  <div style={{ fontSize: '0.78rem', color: '#cbd5e1', lineHeight: '1.5', marginTop: '3px' }}>{aiBudgetResult.campaignDescription}</div>
                </div>

                {/* Apply Button */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={handleApplyAiBudget}
                    className="btn btn-primary"
                    style={{
                      flex: 1,
                      padding: '12px',
                      fontSize: '0.88rem',
                      fontWeight: 800,
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                      border: 'none',
                      color: '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span>
                    <span>Apply Smart Allocations to Campaign Form</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAiBudgetModal(false)}
                    className="btn btn-outline"
                    style={{ padding: '12px 20px', borderRadius: '12px', cursor: 'pointer' }}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
                  Publishing Campaign
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Validating campaign quota and preparing gasless Sepolia audit registration…
                </p>
              </div>
            )}

            {txModal.step === 2 && (
              <div className="fade-in" style={{ textAlign: 'center', padding: '40px 0' }}>
                <div className="spinner" style={{ width: '40px', height: '40px', margin: '0 auto 20px', borderColor: 'var(--secondary)', borderRightColor: 'transparent' }}></div>
                <h3 style={{ marginBottom: '8px', color: 'var(--text)' }}>
                  Activating Relief Drive
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
                  Saving campaign coordinates, payment channels, and audit proof…
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
                  Your relief campaign is now live and accepting GCash, Maya, Card, and Bank donations with gasless Sepolia audit receipts.
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

      {/* ── Official Cryptographic Receipt Voucher Modal ── */}
      {selectedVoucherTx && createPortal((() => {
        const matchCamp = campaigns.find(c => String(c.id) === String(selectedVoucherTx.campaignId));
        const rawTitle = matchCamp ? matchCamp.title : `Disaster Relief Campaign #${selectedVoucherTx.campaignId}`;
        const campTitle = formatCampaignTitle(rawTitle, selectedVoucherTx.campaignId);
        const donorDisplay = selectedVoucherTx.isAnonymous ? 'Anonymous Supporter' : (selectedVoucherTx.donorName || 'Public Philanthropist');
        const amtEth = parseFloat(selectedVoucherTx.amount || 0).toFixed(4);
        const amtPhp = Math.round(parseFloat(selectedVoucherTx.amount || 0) * 170000);

        const variancePhp = selectedVoucherTx.variancePhp !== undefined && selectedVoucherTx.variancePhp !== null ? Number(selectedVoucherTx.variancePhp) : 0;
        const declaredPhp = selectedVoucherTx.declaredPhp !== undefined && selectedVoucherTx.declaredPhp !== null ? Number(selectedVoucherTx.declaredPhp) : (variancePhp !== 0 ? (amtPhp - variancePhp) : amtPhp);
        const isShortage = selectedVoucherTx.auditStatus === 'SHORTAGE' || variancePhp < -20;
        const isOverCredit = selectedVoucherTx.auditStatus === 'OVER_CREDIT' || variancePhp > 20;
        const hasVariance = isShortage || isOverCredit;

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
              background: 'rgba(0, 0, 0, 0.78)',
              backdropFilter: 'blur(8px)',
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
                maxWidth: '600px',
                background: 'var(--bg-card, #1c1c1c)',
                border: isShortage ? '1px solid rgba(239, 68, 68, 0.45)' : (isOverCredit ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border-strong, rgba(255, 255, 255, 0.16))'),
                borderRadius: '18px',
                overflow: 'hidden',
                boxShadow: isShortage ? '0 24px 60px rgba(239, 68, 68, 0.25)' : '0 24px 60px rgba(0, 0, 0, 0.65)'
              }}
            >
              {/* Voucher Header */}
              <div style={{
                padding: '18px 24px',
                background: 'var(--bg-subcard, #242424)',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    background: isShortage ? 'rgba(239, 68, 68, 0.15)' : (isOverCredit ? 'rgba(245, 158, 11, 0.15)' : 'rgba(34, 197, 94, 0.15)'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isShortage ? '#ef4444' : (isOverCredit ? '#f59e0b' : '#22c55e'),
                    border: `1px solid ${isShortage ? 'rgba(239, 68, 68, 0.35)' : (isOverCredit ? 'rgba(245, 158, 11, 0.35)' : 'rgba(34, 197, 94, 0.3)')}`
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                      {isShortage ? 'warning' : (isOverCredit ? 'info' : 'verified')}
                    </span>
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {isShortage ? 'Official Audit Voucher · Discrepancy Flagged' : 'Official Audit Voucher'}
                    </h3>
                    <div style={{ fontSize: '0.76rem', color: isShortage ? '#fca5a5' : 'var(--text-muted)' }}>
                      {isShortage ? 'Variance Recorded in Immutable Public Ledger' : 'BBDRTS Humanitarian Protocol · Blockchain Audited'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedVoucherTx(null)}
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--text-muted)' }}
                  title="Close Voucher"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                </button>
              </div>

              {/* Verified / Discrepancy Ribbon */}
              {isShortage ? (
                <div style={{
                  padding: '11px 24px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  borderBottom: '1px solid rgba(239, 68, 68, 0.28)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.78rem'
                }}>
                  <span style={{ color: '#ef4444', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>gpp_bad</span>
                    Audit Shortage Flagged · Credited Amount Altered by NGO
                  </span>
                  <span style={{ color: '#fca5a5', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                    Variance: {variancePhp < 0 ? `-₱${Math.abs(variancePhp).toLocaleString()} PHP` : `+₱${variancePhp.toLocaleString()} PHP`}
                  </span>
                </div>
              ) : isOverCredit ? (
                <div style={{
                  padding: '11px 24px',
                  background: 'rgba(245, 158, 11, 0.12)',
                  borderBottom: '1px solid rgba(245, 158, 11, 0.28)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.78rem'
                }}>
                  <span style={{ color: '#f59e0b', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>info</span>
                    Over-Credited Transaction (+₱{variancePhp.toLocaleString()} PHP)
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    ID #{selectedVoucherTx.id || 'ON-CHAIN'}
                  </span>
                </div>
              ) : (
                <div style={{
                  padding: '10px 24px',
                  background: 'linear-gradient(90deg, rgba(34, 197, 94, 0.15), transparent)',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.78rem'
                }}>
                  <span style={{ color: '#22c55e', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>check_circle</span>
                    Verified On-Chain Transaction
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    ID #{selectedVoucherTx.id || 'ON-CHAIN'}
                  </span>
                </div>
              )}

              {/* Voucher Details Body */}
              <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Variance Breakdown Box */}
                {hasVariance && (
                  <div style={{
                    background: isShortage ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                    border: `1px solid ${isShortage ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                    borderRadius: '10px',
                    padding: '12px 16px'
                  }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: isShortage ? '#ef4444' : '#f59e0b', letterSpacing: '0.04em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>rule</span>
                      <span>Tamper-Proof Audit Discrepancy Breakdown</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', fontSize: '0.78rem' }}>
                      <div>
                        <div style={{ color: '#888888', fontSize: '0.70rem' }}>Declared by Contributor</div>
                        <div style={{ fontWeight: 700, color: '#ededed', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>₱{declaredPhp.toLocaleString()} PHP</div>
                      </div>
                      <div>
                        <div style={{ color: '#888888', fontSize: '0.70rem' }}>Credited by NGO</div>
                        <div style={{ fontWeight: 700, color: isShortage ? '#ef4444' : '#f59e0b', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>₱{amtPhp.toLocaleString()} PHP</div>
                      </div>
                      <div>
                        <div style={{ color: '#888888', fontSize: '0.70rem' }}>On-Chain Variance</div>
                        <div style={{ fontWeight: 800, color: isShortage ? '#ef4444' : '#f59e0b', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                          {variancePhp < 0 ? `-₱${Math.abs(variancePhp).toLocaleString()} PHP` : `+₱${variancePhp.toLocaleString()} PHP`}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.70rem', color: isShortage ? '#fca5a5' : '#fde68a', marginTop: '8px', lineHeight: 1.4 }}>
                      {isShortage
                        ? '⚠️ Warning: The beneficiary organization modified and verified this transaction with a shortage compared to the contributor\'s declared payment slip. This discrepancy has been permanently sealed on Ethereum Sepolia.'
                        : 'Notice: Contributor was credited with additional funds beyond the initial declaration.'}
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, marginBottom: '3px' }}>
                      Beneficiary Organization
                    </div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {orgDisplayName}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, marginBottom: '3px' }}>
                      Payment Method Rail
                    </div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#38bdf8' }}>
                      {selectedVoucherTx.paymentMethod || 'Bank / Card'}
                    </div>
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, marginBottom: '3px' }}>
                      Relief Campaign
                    </div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {campTitle}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, marginBottom: '3px' }}>
                      Contributor / Donor
                    </div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {donorDisplay}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, marginBottom: '3px' }}>
                      Contribution Timestamp
                    </div>
                    <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                      {selectedVoucherTx.createdAt ? new Date(selectedVoucherTx.createdAt).toLocaleString() : 'Audited On-Chain'}
                    </div>
                  </div>
                </div>

                {/* Amount Highlight Box */}
                <div style={{
                  background: 'var(--bg-subcard)',
                  border: isShortage ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  {(() => {
                    const pm = String(selectedVoucherTx.paymentMethod || 'ETH').toUpperCase();
                    const isFiat = pm.includes('GCASH') || pm.includes('MAYA') || pm.includes('BANK') || pm.includes('CARD') || String(selectedVoucherTx.txHash || '').startsWith('FIAT-');
                    return (
                      <>
                        <div>
                          <div style={{ fontSize: '0.74rem', color: isShortage ? '#ef4444' : 'var(--text-muted)', fontWeight: 600 }}>
                            {isShortage ? 'Amount Credited (Altered)' : 'Amount Transferred'}
                          </div>
                          <div style={{ fontSize: '1.45rem', fontWeight: 850, color: isShortage ? '#ef4444' : 'var(--accent, #22c55e)' }}>
                            +₱{amtPhp.toLocaleString('en-US')} PHP
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>Audit Verification</div>
                          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#38bdf8' }}>
                            Gasless Sepolia Seal
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Tx Hash Box */}
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, marginBottom: '4px' }}>
                    Cryptographic Transaction Hash
                  </div>
                  <div style={{
                    background: 'var(--bg-input)',
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
                    <span>{selectedVoucherTx.txHash}</span>
                    <button
                      type="button"
                      className="btn btn-xs btn-ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedVoucherTx.txHash);
                        showSuccess('Hash copied to clipboard!', 'Copied');
                      }}
                      title="Copy Hash"
                      style={{ display: 'inline-flex', alignItems: 'center' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>content_copy</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Voucher Footer Actions */}
              <div style={{
                padding: '14px 24px',
                background: 'var(--bg-subcard)',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '10px'
              }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => printDonationVoucher({
                    ...selectedVoucherTx,
                    phpAmount: amtPhp,
                    campaignTitle: campTitle,
                    orgName: getNgoDisplayTitle(),
                    donorName: donorDisplay,
                    isShortage
                  })}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>print</span>
                  <span>Print Voucher</span>
                </button>
                {selectedVoucherTx.txHash && !selectedVoucherTx.txHash.startsWith('MOCK') && (
                  <a
                    href={`https://sepolia.etherscan.io/tx/${selectedVoucherTx.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-outline btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                  >
                    <span>Etherscan</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>open_in_new</span>
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
        );
      })(), document.body)}

      {/* ── NGO Declare Unclaimed Direct Deposit Modal ── */}
      <DeclareDirectDepositModal
        isOpen={showDeclareDepositModal}
        onClose={() => setShowDeclareDepositModal(false)}
        campaigns={myCampaigns || []}
        onSuccess={() => {
          fetchOrgDonations?.();
          onDonated?.();
        }}
        showSuccess={showSuccess}
        showError={showError}
      />

      {/* ── Filterable NGO Financial Ledger Export Modal ── */}
      <FilterableExportModal
        isOpen={ngoLedgerExportOpen}
        onClose={() => setNgoLedgerExportOpen(false)}
        role="ngo"
        title="Export NGO Donation Ledger"
        subtitle="Filter by date range, payment channel, cause, campaign, or keyword before exporting"
        records={orgDonations || []}
        campaigns={myCampaigns || campaigns || []}
        meta={{ orgName: orgDisplayName || currentUser?.name || 'Verified NGO' }}
        initialFilters={{
          category: ledgerFilter || 'ALL',
          channel: ledgerRailFilter === 'BANK' ? 'BANK_CARD' : (ledgerRailFilter || 'ALL'),
          campaignId: ledgerCampaignFilter || 'ALL',
          search: searchQueryLedger || ''
        }}
        onExported={(msg, title) => showSuccess(msg, title)}
      />

      {/* ── Proof of Payment Screenshot & AI Security Audit Preview Modal ── */}
      <ProofPreviewModal proofPreviewModalImg={proofPreviewModalImg} setProofPreviewModalImg={setProofPreviewModalImg} />


      {/* ── Real NGO E-Wallet & Bank Slip Cross-Verification Modal ── */}
      {verifyingDonation && createPortal(
        <div
          className="modal-overlay fade-in"
          onClick={() => !verifyingSubmitting && setVerifyingDonation(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(5, 7, 12, 0.85)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '16px'
          }}
        >
          <div
            className="card bounce-in"
            onClick={e => e.stopPropagation()}
            style={{
              width: '880px',
              maxWidth: '96vw',
              maxHeight: '92vh',
              background: '#0a0a0a',
              border: '1px solid #222222',
              borderRadius: '14px',
              boxShadow: '0 25px 65px rgba(0, 0, 0, 0.9)',
              color: '#ededed',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '16px 22px',
              borderBottom: '1px solid #222222',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#0a0a0a'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: '#141414',
                  border: '1px solid #262626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ededed',
                  flexShrink: 0
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>fact_check</span>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>Confirm Received Donation</span>
                    <span style={{
                      fontSize: '0.66rem',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: '#181818',
                      color: '#ededed',
                      border: '1px solid #282828',
                      textTransform: 'uppercase',
                      fontFamily: 'monospace'
                    }}>
                      {verifyingDonation.Payment_Method || 'E-Wallet'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#888888', marginTop: '2px' }}>
                    Cross-reference incoming funds with your actual account statement before on-chain recording
                  </div>
                </div>
              </div>
              {!verifyingSubmitting && (
                <button
                  type="button"
                  onClick={() => setVerifyingDonation(null)}
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '6px', color: '#888888', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  title="Close"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                </button>
              )}
            </div>

            {/* Modal Body: Switch between Loading State and Form */}
            {verifyingSubmitting ? (
              /* ── Task 2: Dedicated Blockchain Recording Screen ── */
              <div style={{
                padding: '48px 24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                minHeight: '440px',
                background: '#0a0a0a'
              }}>
                {/* Animated Pulsing Ring & Node Icon */}
                <div style={{
                  position: 'relative',
                  width: '84px',
                  height: '84px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '22px'
                }}>
                  <div style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    border: '2px solid rgba(16, 185, 129, 0.4)',
                    animation: 'ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite'
                  }} />
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: '#111111',
                    border: '1px solid #222222',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 35px rgba(16, 185, 129, 0.25)'
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '30px', color: '#10b981' }}>
                      account_balance
                    </span>
                  </div>
                </div>

                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ededed', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
                  Recording to Blockchain Ledger
                </h3>
                <p style={{ fontSize: '0.82rem', color: '#888888', maxWidth: '420px', margin: '0 0 24px 0', lineHeight: 1.5 }}>
                  Minting immutable cryptographic donation record onto Sepolia EVM and crediting funds to campaign balance.
                </p>

                {/* Transaction Summary Card */}
                <div style={{
                  width: '100%',
                  maxWidth: '460px',
                  background: '#0e0e0e',
                  border: '1px solid #222222',
                  borderRadius: '10px',
                  padding: '14px 18px',
                  marginBottom: '20px',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', color: '#888888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Confirmed Value</span>
                    <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#10b981', fontFamily: 'var(--font-mono, monospace)' }}>
                      ₱{parseFloat(confirmedAmountPhp || 0).toLocaleString()} PHP
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', color: '#888888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Reference / Trace</span>
                    <span style={{ fontSize: '0.78rem', color: '#ededed', fontFamily: 'var(--font-mono, monospace)', fontWeight: 600 }}>
                      #{confirmedRefNo || verifyingDonation.Reference_Number || 'Manual Attestation'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', color: '#888888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Beneficiary Campaign</span>
                    <span style={{ fontSize: '0.78rem', color: '#ededed', fontWeight: 500, maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {verifyingDonation.Campaign_Title}
                    </span>
                  </div>
                </div>

                {/* Live Step Progression */}
                <div style={{ width: '100%', maxWidth: '460px', display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.76rem', color: '#10b981' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check_circle</span>
                    <span>NGO financial officer attestation verified</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.76rem', color: '#ededed' }}>
                    <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px', borderColor: '#38bdf8', borderTopColor: 'transparent' }} />
                    <span>Broadcasting state transition to Ethereum Sepolia EVM...</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.76rem', color: '#666666' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>radio_button_unchecked</span>
                    <span>Awaiting block confirmation & issuing immutable digital receipt</span>
                  </div>
                </div>
              </div>
            ) : (
              /* ── Task 1: Improved Modal Body ── */
              <div style={{
                padding: '22px 24px',
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: 'minmax(280px, 350px) 1fr',
                gap: '24px',
                background: '#0a0a0a'
              }}>
                {/* Left Column: Uploaded Receipt Preview */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888888' }}>
                    Donor's Uploaded Transfer Receipt
                  </div>

                  <div style={{
                    background: '#000000',
                    border: '1px solid #222222',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    minHeight: '260px',
                    maxHeight: '380px'
                  }}>
                    {verifyingDonation.Receipt_Base64 ? (
                      <>
                        <img
                          src={formatImageSrc(verifyingDonation.Receipt_Base64)}
                          alt="Receipt slip"
                          style={{
                            maxWidth: '100%',
                            maxHeight: '320px',
                            objectFit: 'contain',
                            cursor: 'zoom-in'
                          }}
                          onClick={() => setProofPreviewModalImg(verifyingDonation.Receipt_Base64)}
                          title="Click to view full size"
                        />
                        <div style={{
                          position: 'absolute',
                          bottom: '10px',
                          display: 'flex',
                          gap: '8px'
                        }}>
                          <button
                            type="button"
                            onClick={() => setProofPreviewModalImg(verifyingDonation.Receipt_Base64)}
                            style={{
                              background: '#141414',
                              border: '1px solid #2a2a2a',
                              color: '#ededed',
                              borderRadius: '6px',
                              padding: '4px 10px',
                              fontSize: '0.72rem',
                              fontWeight: 500,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>zoom_in</span>
                            <span>Full Size</span>
                          </button>
                          <a
                            href={formatImageSrc(verifyingDonation.Receipt_Base64)}
                            download={`receipt_${verifyingDonation.Manual_ID}.png`}
                            style={{
                              background: '#141414',
                              border: '1px solid #2a2a2a',
                              color: '#ededed',
                              borderRadius: '6px',
                              padding: '4px 10px',
                              fontSize: '0.72rem',
                              fontWeight: 500,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              textDecoration: 'none'
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>download</span>
                            <span>Save</span>
                          </a>
                        </div>
                      </>
                    ) : (
                      <div style={{ padding: '30px', textAlign: 'center', color: '#666666' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '36px', opacity: 0.5, marginBottom: '8px', display: 'block' }}>receipt_long</span>
                        <span style={{ fontSize: '0.78rem' }}>No slip image was attached by donor</span>
                      </div>
                    )}
                  </div>

                  {/* Donor claim metadata card */}
                  <div style={{
                    background: '#0e0e0e',
                    border: '1px solid #1f1f1f',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    fontSize: '0.78rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#888888', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Donor</span>
                      <span style={{ fontWeight: 600, color: '#ededed', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                        {verifyingDonation.Donor_Name || 'Anonymous Supporter'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#888888', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Relief Campaign</span>
                      <span style={{ fontWeight: 500, color: '#ededed', textAlign: 'right', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={verifyingDonation.Campaign_Title}>
                        {verifyingDonation.Campaign_Title}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#888888', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Claimed Amount</span>
                      <span style={{ fontWeight: 700, color: '#10b981', fontFamily: 'var(--font-mono, monospace)' }}>
                        ₱{Math.round(parseFloat(verifyingDonation.Amount || 0) * 170000).toLocaleString()} PHP
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Column: NGO Verification Controls */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                  {/* Audit Callout Banner */}
                  <div style={{
                    background: 'rgba(245, 158, 11, 0.04)',
                    border: '1px solid rgba(245, 158, 11, 0.22)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'flex-start'
                  }}>
                    <span className="material-symbols-outlined" style={{ color: '#f59e0b', fontSize: '18px', marginTop: '1px', flexShrink: 0 }}>security</span>
                    <div style={{ fontSize: '0.76rem', lineHeight: '1.45', color: '#cbd5e1' }}>
                      <strong style={{ color: '#f59e0b' }}>Account Check Required:</strong> Confirm that the funds have physically settled in your official <strong>{verifyingDonation.Payment_Method}</strong> account or merchant statement before minting to the blockchain ledger.
                    </div>
                  </div>

                  {/* Confirmed Received Amount Input */}
                  {(() => {
                    const claimedAmountPhp = Math.round(parseFloat(verifyingDonation.Amount || 0) * 170000);
                    const enteredAmountNum = parseFloat(confirmedAmountPhp) || 0;
                    const variancePhp = claimedAmountPhp - enteredAmountNum;
                    const isLargeVariance = claimedAmountPhp > 0 && variancePhp > 30 && (variancePhp / claimedAmountPhp > 0.05);

                    return (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, marginBottom: '6px', color: '#888888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Actual Amount Received by NGO (PHP) <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: '#888888', fontSize: '0.95rem' }}>₱</span>
                          <input
                            type="number"
                            step="any"
                            min="1"
                            value={confirmedAmountPhp}
                            onChange={e => setConfirmedAmountPhp(e.target.value)}
                            placeholder="e.g. 6500"
                            style={{
                              width: '100%',
                              background: '#0e0e0e',
                              border: isLargeVariance ? '1px solid #ef4444' : '1px solid #222222',
                              borderRadius: '8px',
                              padding: '10px 14px 10px 30px',
                              color: '#ededed',
                              fontSize: '1.10rem',
                              fontWeight: 700,
                              fontFamily: 'var(--font-mono, monospace)',
                              outline: 'none',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>

                        {/* Real-time Variance Warning */}
                        {isLargeVariance && (
                          <div style={{
                            marginTop: '8px',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            background: 'rgba(239, 68, 68, 0.08)',
                            border: '1px solid rgba(239, 68, 68, 0.28)',
                            display: 'flex',
                            gap: '8px',
                            alignItems: 'flex-start'
                          }}>
                            <span className="material-symbols-outlined" style={{ color: '#ef4444', fontSize: '16px', marginTop: '1px', flexShrink: 0 }}>warning</span>
                            <div style={{ fontSize: '0.72rem', color: '#fca5a5', lineHeight: 1.4 }}>
                              <strong style={{ color: '#fff' }}>Amount Variance Detected (-₱{variancePhp.toLocaleString()} PHP):</strong> Recording ₱{enteredAmountNum.toLocaleString()} instead of claimed ₱{claimedAmountPhp.toLocaleString()}. This variance will be permanently recorded in the immutable public audit trail.
                            </div>
                          </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.72rem', color: '#888888' }}>
                          <span>
                            Credited to Campaign: <strong style={{ color: isLargeVariance ? '#f59e0b' : '#10b981' }}>₱{Math.round(parseFloat(confirmedAmountPhp) || 0).toLocaleString()} PHP</strong>
                          </span>
                          <span>Gasless Sepolia Notarization</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Reference / Transaction Trace Number */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, marginBottom: '6px', color: '#888888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Transaction Reference / Trace No. <span style={{ color: '#666666', fontWeight: 400 }}>(Cross-reference code)</span>
                    </label>
                    <input
                      type="text"
                      value={confirmedRefNo}
                      onChange={e => setConfirmedRefNo(e.target.value)}
                      placeholder="e.g. 1045 655 683789"
                      style={{
                        width: '100%',
                        background: '#0e0e0e',
                        border: '1px solid #222222',
                        borderRadius: '8px',
                        padding: '9px 12px',
                        color: '#ededed',
                        fontSize: '0.85rem',
                        fontFamily: 'var(--font-mono, monospace)',
                        fontWeight: 600,
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* Audit Attestation Interactive Tiles */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      color: checkAccountVerified ? '#ededed' : '#888888',
                      background: checkAccountVerified ? '#141414' : '#0e0e0e',
                      border: checkAccountVerified ? '1px solid #333333' : '1px solid #222222',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      transition: 'all 0.15s ease'
                    }}>
                      <input
                        type="checkbox"
                        checked={checkAccountVerified}
                        onChange={e => setCheckAccountVerified(e.target.checked)}
                        style={{ marginTop: '2px', cursor: 'pointer', accentColor: '#10b981' }}
                      />
                      <span>I have opened our official <strong>{verifyingDonation.Payment_Method}</strong> balance and confirmed receipt of these funds.</span>
                    </label>

                    <label style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      color: checkAmountMatched ? '#ededed' : '#888888',
                      background: checkAmountMatched ? '#141414' : '#0e0e0e',
                      border: checkAmountMatched ? '1px solid #333333' : '1px solid #222222',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      transition: 'all 0.15s ease'
                    }}>
                      <input
                        type="checkbox"
                        checked={checkAmountMatched}
                        onChange={e => setCheckAmountMatched(e.target.checked)}
                        style={{ marginTop: '2px', cursor: 'pointer', accentColor: '#10b981' }}
                      />
                      <span>The confirmed amount of <strong>₱{(parseFloat(confirmedAmountPhp) || 0).toLocaleString()}</strong> accurately reflects what was credited to our organization.</span>
                    </label>
                  </div>

                </div>
              </div>
            )}

            {/* Modal Footer Actions */}
            <div style={{
              padding: '14px 22px',
              borderTop: '1px solid #222222',
              background: '#0a0a0a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              {verifyingSubmitting ? (
                <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '6px 0', color: '#888888', fontSize: '0.78rem' }}>
                  <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px', borderColor: '#10b981', borderTopColor: 'transparent' }} />
                  <span style={{ fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.04em' }}>IMMUTABLE CRYPTOGRAPHIC CONSENSUS IN PROGRESS... PLEASE WAIT</span>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{
                      background: 'rgba(239, 68, 68, 0.08)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      padding: '7px 14px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      borderRadius: '8px',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      const cur = verifyingDonation;
                      setVerifyingDonation(null);
                      handleOpenRejection(cur);
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>cancel</span>
                    <span>Reject Slip</span>
                  </button>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      style={{
                        background: 'transparent',
                        border: '1px solid #262626',
                        color: '#888888',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontSize: '0.80rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                      onClick={() => setVerifyingDonation(null)}
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      style={{
                        padding: '8px 20px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: 600,
                        fontSize: '0.82rem',
                        background: (!checkAccountVerified || !checkAmountMatched || !(parseFloat(confirmedAmountPhp) > 0)) ? '#222222' : '#ededed',
                        color: (!checkAccountVerified || !checkAmountMatched || !(parseFloat(confirmedAmountPhp) > 0)) ? '#666666' : '#000000',
                        border: 'none',
                        borderRadius: '8px',
                        opacity: (!checkAccountVerified || !checkAmountMatched || !(parseFloat(confirmedAmountPhp) > 0)) ? 0.6 : 1,
                        cursor: (!checkAccountVerified || !checkAmountMatched || !(parseFloat(confirmedAmountPhp) > 0)) ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      onClick={handleConfirmApproval}
                      disabled={!checkAccountVerified || !checkAmountMatched || !(parseFloat(confirmedAmountPhp) > 0)}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>verified</span>
                      <span>Confirm &amp; Record to Ledger</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Rejection Modal with Reason Selection ── */}
      {rejectingDonation && createPortal(
        <div
          className="modal-overlay fade-in"
          onClick={() => !rejectingSubmitting && setRejectingDonation(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(5, 7, 12, 0.85)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '16px'
          }}
        >
          <div
            className="card bounce-in"
            onClick={e => e.stopPropagation()}
            style={{
              width: '540px',
              maxWidth: '95vw',
              background: 'var(--bg-card, #131622)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '18px',
              boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.85)',
              color: 'var(--text-primary, #ffffff)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>warning</span>
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.08rem' }}>Reject Payment Slip</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Provide an audit reason to notify the donor.
                </div>
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '0.8rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <div><strong>Donor:</strong> {rejectingDonation.Donor_Name || 'Anonymous'}</div>
              <div><strong>Rail:</strong> {rejectingDonation.Payment_Method} · <strong>Claimed:</strong> ₱{Math.round(parseFloat(rejectingDonation.Amount || 0) * 170000).toLocaleString()}</div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>
                Select Reason for Rejection:
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[
                  'Payment not received in official organization account statements',
                  'Receipt screenshot is unreadable, blurry, or missing key details',
                  'Amount on receipt does not match the claimed donation',
                  'Duplicate or expired transaction receipt slip'
                ].map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRejectionReason(r)}
                    style={{
                      textAlign: 'left',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: rejectionReason === r ? '1px solid #ef4444' : '1px solid var(--border, rgba(255,255,255,0.08))',
                      background: rejectionReason === r ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255,255,255,0.02)',
                      color: rejectionReason === r ? '#fff' : 'var(--text-secondary)',
                      fontSize: '0.78rem',
                      cursor: 'pointer'
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>
                Detailed Audit Note for Donor:
              </label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="Explain why this payment slip could not be confirmed..."
                style={{
                  width: '100%',
                  background: 'var(--bg-input, rgba(30, 41, 59, 0.8))',
                  border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                  borderRadius: '10px',
                  padding: '10px',
                  color: '#fff',
                  fontSize: '0.82rem',
                  resize: 'none',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setRejectingDonation(null)}
                disabled={rejectingSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm"
                style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 18px', fontWeight: 700 }}
                onClick={handleConfirmRejection}
                disabled={!rejectionReason.trim() || rejectingSubmitting}
              >
                {rejectingSubmitting ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Interactive Guided Onboarding Spotlight Tour */}
      <GuidedTour
        isOpen={showGuidedTour}
        onClose={handleCloseTour}
        steps={ngoTourSteps}
        onTabChange={setActiveTab}
        tourKey={userTourKey}
        roleName="NGO Partner"
        theme={theme}
      />

      {/* ── SELECT REUSABLE QR CODE MODAL ── */}
      {showSelectQrModal && typeof document !== 'undefined' && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0, 0, 0, 0.78)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999
        }} onClick={() => setShowSelectQrModal(null)}>
          <div
            style={{
              width: '90%', maxWidth: '520px', maxHeight: '85vh',
              background: 'var(--bg-card, #121212)', border: '1.5px solid var(--border)',
              borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column',
              boxShadow: '0 25px 50px rgba(0,0,0,0.5)', overflow: 'hidden'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{
                  fontSize: '22px',
                  color: showSelectQrModal === 'Maya' ? '#00d68f' : showSelectQrModal === 'Bank' ? '#10b981' : '#007dfe'
                }}>
                  qr_code_2
                </span>
                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Select {showSelectQrModal} QR Code
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowSelectQrModal(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <p style={{ margin: '0 0 14px 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Choose from your previously saved reusable QR codes in NGO Settings, or upload a new one:
            </p>

            {/* List of matching saved QR codes */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
              {savedQrList.filter(q => q.payment_method === showSelectQrModal).length === 0 ? (
                <div style={{
                  padding: '24px', textAlign: 'center', background: 'var(--bg-subcard)',
                  borderRadius: '10px', border: '1px dashed var(--border)', color: 'var(--text-muted)'
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '32px', marginBottom: '6px' }}>qr_code_scanner</span>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    No saved {showSelectQrModal} QR codes found
                  </div>
                  <p style={{ fontSize: '0.72rem', margin: '4px 0 0 0' }}>
                    Upload a new QR code in the campaign creation form or in Profile &amp; Settings &gt; Relief Channels.
                  </p>
                </div>
              ) : (
                (() => {
                  let activeSelectedId = null;
                  if (showSelectQrModal === 'GCash') {
                    activeSelectedId = selectedGcashQrId || (savedQrList.find(q => q.payment_method === 'GCash' && (q.id === selectedGcashQrId || (gcashQrUrl && q.qr_image_url === gcashQrUrl)))?.id);
                  } else if (showSelectQrModal === 'Maya') {
                    activeSelectedId = selectedMayaQrId || (savedQrList.find(q => q.payment_method === 'Maya' && (q.id === selectedMayaQrId || (mayaQrUrl && q.qr_image_url === mayaQrUrl)))?.id);
                  } else if (showSelectQrModal === 'Bank') {
                    activeSelectedId = selectedBankQrId || (savedQrList.find(q => q.payment_method === 'Bank' && (q.id === selectedBankQrId || (bankQrUrl && q.qr_image_url === bankQrUrl)))?.id);
                  }

                  return savedQrList
                    .filter(q => q.payment_method === showSelectQrModal)
                    .map(qr => {
                      const isSelected = Boolean(activeSelectedId && qr.id === activeSelectedId);
                      return (
                        <div
                          key={qr.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 14px',
                            borderRadius: '12px',
                            background: isSelected ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-subcard)',
                            border: `1.5px solid ${isSelected ? '#10b981' : 'var(--border)'}`,
                            gap: '12px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                            <img
                              src={qr.qr_image_url}
                              alt={qr.custom_name}
                              style={{
                                width: '50px', height: '50px', objectFit: 'contain',
                                borderRadius: '6px', background: '#fff', border: '1px solid var(--border)', flexShrink: 0
                              }}
                            />
                            <div style={{ overflow: 'hidden' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {qr.custom_name}
                                </span>
                                {qr.is_default ? (
                                  <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '1px 6px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                                    DEFAULT
                                  </span>
                                ) : null}
                              </div>
                              {qr.account_name && (
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {qr.account_name}
                                </div>
                              )}
                              {qr.account_number && (
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                  {formatPhoneNumber(qr.account_number)}
                                </div>
                              )}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={() => handleSelectSavedQr(qr)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '7px 14px',
                                borderRadius: '8px',
                                fontSize: '0.76rem',
                                fontWeight: 700,
                                background: isSelected ? 'rgba(34, 197, 94, 0.18)' : 'var(--bg-card)',
                                border: `1.5px solid ${isSelected ? '#22c55e' : 'var(--border)'}`,
                                color: isSelected ? '#22c55e' : 'var(--text-primary)',
                                cursor: 'pointer'
                              }}
                            >
                              {isSelected ? (
                                <>
                                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>check_circle</span>
                                  <span>Selected</span>
                                </>
                              ) : (
                                <span>Select</span>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteSavedQr(qr.id, e)}
                              title="Delete this QR code from library"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '7px 8px',
                                borderRadius: '8px',
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                color: '#ef4444',
                                cursor: 'pointer'
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                            </button>
                          </div>
                        </div>
                      );
                    });
                })()
              )}
            </div>

            <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowSelectQrModal(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  background: 'var(--bg-subcard)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Standalone Proof Preview & Live Browser OCR Modal Component               */
/* ─────────────────────────────────────────────────────────────────────────── */
function ProofPreviewModal({ proofPreviewModalImg, setProofPreviewModalImg }) {
  const [ocrResult, setOcrResult] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  const imgSrc = typeof proofPreviewModalImg === 'string' ? proofPreviewModalImg : (proofPreviewModalImg?.img || '');
  const dData = typeof proofPreviewModalImg === 'object' ? proofPreviewModalImg?.donation : null;

  // Lock background body scroll while image preview modal is active
  useEffect(() => {
    if (proofPreviewModalImg) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [proofPreviewModalImg]);

  useEffect(() => {
    if (!proofPreviewModalImg || !imgSrc) {
      setOcrResult(null);
      setIsScanning(false);
      return;
    }

    setIsScanning(true);
    let active = true;

    const formattedSrc = formatImageSrc(imgSrc);

    Tesseract.recognize(formattedSrc, 'eng')
      .then(({ data }) => {
        if (!active) return;
        const text = data?.text || '';

        // Extract 13-digit GCash Ref No e.g. "0044 315 497640" or "0044315497640"
        let ref = null;
        const gcashMatch = text.match(/\b(\d{4}[\s\.\-]+\d{3}[\s\.\-]+\d{6})\b/) ||
          text.match(/(?:Ref|Ret|Rel|No|ID)[\s\.\:\#]*([0-9\s\.\-]{11,20})/i) ||
          text.match(/\b(00\d{11}|\d{13})\b/);
        if (gcashMatch) {
          ref = (gcashMatch[1] || gcashMatch[0]).trim().replace(/\s+/g, ' ');
        } else {
          const digitsAll = text.replace(/\D/g, '');
          if (digitsAll.length >= 13) {
            const m13 = digitsAll.match(/(00\d{11}|100\d{10}|\d{13})/);
            if (m13) {
              const d = m13[1];
              ref = `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
            }
          }
        }

        // Extract PHP Amount e.g. "460.00"
        let amt = null;
        const amtMatch = text.match(/(?:Total\s*Amount\s*Sent|Total\s*Amount|Amount|Sent|Paid)[\s\S]{0,30}?[₱P]?\s*([\d,]+\.\d{2})/i) ||
          text.match(/([\d,]+\.\d{2})/);
        if (amtMatch) {
          const parsedVal = parseFloat((amtMatch[1] || amtMatch[0]).replace(/,/g, ''));
          if (!isNaN(parsedVal) && parsedVal > 0 && parsedVal < 1000000) amt = parsedVal;
        }

        setOcrResult({ extractedRef: ref, extractedAmountPhp: amt });
      })
      .catch((err) => {
        console.warn('Real-time browser Tesseract OCR scan exception:', err);
      })
      .finally(() => {
        if (active) setIsScanning(false);
      });

    return () => { active = false; };
  }, [proofPreviewModalImg, imgSrc]);

  if (!proofPreviewModalImg) return null;

  const ai = dData?.ai_result || {};
  const flags = ai.fraudFlags || [];
  const isDup = flags.some(f => String(f).includes('DUPLICATE'));
  const isInvalidImg = flags.some(f => String(f).includes('INVALID_RECEIPT_IMAGE'));

  const rawRef = dData?.Reference_Number || ai.extractedRef || ocrResult?.extractedRef || '';
  const isRefValid = Boolean(rawRef && rawRef.trim().length >= 6 && rawRef !== 'Not Provided' && rawRef !== 'Unextracted' && !rawRef.startsWith('REF-') && !rawRef.startsWith('MANUAL-'));
  const refNo = isRefValid ? rawRef.trim() : (isScanning ? 'Scanning OCR...' : 'Not Provided');

  const declaredAmtPhp = dData?.Payment_Method === 'ETH' ? Math.round(parseFloat(dData?.Amount || 0) * 170000) : Math.round(parseFloat(dData?.Amount || 0));
  const extractedAmtPhp = Math.round(parseFloat(ai.extractedAmountPhp || ocrResult?.extractedAmountPhp || 0));
  const amtPhp = extractedAmtPhp > 0 ? extractedAmtPhp : declaredAmtPhp;

  const declaredRail = dData?.Payment_Method || 'GCash';
  const paymentRail = declaredRail;
  const isRailMismatch = flags.some(f => String(f).includes('PAYMENT_RAIL_MISMATCH'));
  const isAmtMismatch = flags.some(f => String(f).includes('AMOUNT_MISMATCH')) ||
    (extractedAmtPhp > 0 && declaredAmtPhp > 0 && Math.abs(extractedAmtPhp - declaredAmtPhp) / declaredAmtPhp > 0.05);
  const isAmtValid = extractedAmtPhp > 0 || declaredAmtPhp > 0;

  // ── Ironclad Verification Rules ──
  const isVerified = Boolean(!isDup && !isInvalidImg && !isRailMismatch && !isAmtMismatch && isRefValid && (ai.isAiVerified !== false));
  const score = isDup ? 15 : (isInvalidImg ? 15 : ((isRailMismatch || isAmtMismatch || !isRefValid) ? 35 : (ai.confidenceScore || 98)));

  return createPortal(
    <div
      className="bbdrts-edit-profile-backdrop"
      onClick={() => setProofPreviewModalImg(null)}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0, 0, 0, 0.88)',
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
          maxWidth: '920px',
          maxHeight: '92vh',
          background: '#0d1117',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="material-symbols-outlined" style={{ color: '#0284c7', fontSize: '22px' }}>analytics</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.02rem', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Uploaded Payment Slip &amp; AI Security Audit</div>
              <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>Real-time OCR pixel extraction &amp; cross-verification breakdown</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 12px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 800,
                background: isDup ? 'rgba(239, 68, 68, 0.18)' : (isVerified ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.18)'),
                color: isDup ? '#ef4444' : (isVerified ? '#16a34a' : '#d97706'),
                border: `1px solid ${isDup ? 'rgba(239, 68, 68, 0.4)' : (isVerified ? 'rgba(34, 197, 94, 0.35)' : 'rgba(245, 158, 11, 0.4)')}`
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>{isDup ? 'warning' : (isVerified ? 'verified' : 'help_outline')}</span>
              <span>{isDup ? `Duplicate Ref (${score}%)` : (isVerified ? `${score}% AI Verified` : (isScanning ? `Scanning OCR...` : `Manual Audit (${score}%)`))}</span>
            </span>
              <button type="button" onClick={() => setProofPreviewModalImg(null)} className="btn btn-ghost btn-sm" style={{ color: 'var(--text-muted)' }} title="Close">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
              </button>
          </div>
        </div>

        {/* Body Content - Dual Pane */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: '0', flex: 1, overflow: 'hidden' }}>
          {/* Left Pane: Image Viewer */}
          <div style={{ padding: '20px', background: 'var(--bg-subcard, var(--bg-hover))', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid var(--border)' }}>
            <div style={{ width: '100%', maxHeight: '62vh', overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '10px' }}>
              <img src={formatImageSrc(imgSrc)} alt="Uploaded Payment Slip" style={{ maxWidth: '100%', maxHeight: '58vh', objectFit: 'contain', borderRadius: '8px' }} />
            </div>
            <div style={{ marginTop: '12px', fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>center_focus_strong</span>
              <span>Original screenshot provided by donor</span>
            </div>
          </div>

          {/* Right Pane: AI Audit Reasons & Verification Breakdown */}
          <div style={{ padding: '20px 24px', overflowY: 'auto', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Title Section */}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: isDup ? '#ef4444' : (isVerified ? '#0284c7' : '#d97706'), marginBottom: '4px' }}>
                {isDup ? 'High Risk Warning Triggered' : (isVerified ? 'AI Audit Verification Reasons' : 'Manual Audit Required')}
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                Why did the AI score this receipt at <strong>{score}%</strong> confidence?
              </div>
            </div>

            {/* Checklist of Reasons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

              {/* Checkmark 1: Genuine Slip & Rail Structure */}
              <div style={{ display: 'flex', gap: '12px', padding: '10px 14px', borderRadius: '10px', background: (isInvalidImg || isRailMismatch) ? 'rgba(239, 68, 68, 0.12)' : 'rgba(34, 197, 94, 0.08)', border: `1px solid ${(isInvalidImg || isRailMismatch) ? 'rgba(239, 68, 68, 0.35)' : 'rgba(34, 197, 94, 0.25)'}` }}>
                <span className="material-symbols-outlined" style={{ color: (isInvalidImg || isRailMismatch) ? '#ef4444' : '#16a34a', fontSize: '18px', marginTop: '2px' }}>{(isInvalidImg || isRailMismatch) ? 'gpp_bad' : 'check_circle'}</span>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {isRailMismatch ? `Payment Rail Mismatch (${declaredRail} vs Image Slip)` : `Official ${declaredRail} Receipt Layout Detected`}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: isRailMismatch ? '#ef4444' : 'var(--text-muted)', marginTop: '2px' }}>
                    {isRailMismatch ? `Donor selected ${declaredRail}, but uploaded a receipt from a different payment provider!` : 'OCR engine recognized header elements and transaction receipt layout.'}
                  </div>
                </div>
              </div>

              {/* Checkmark 2: Reference Number Match */}
              <div style={{ display: 'flex', gap: '12px', padding: '10px 14px', borderRadius: '10px', background: isDup ? 'rgba(239, 68, 68, 0.12)' : (isRefValid ? 'rgba(34, 197, 94, 0.08)' : 'rgba(245, 158, 11, 0.12)'), border: `1px solid ${isDup ? 'rgba(239, 68, 68, 0.35)' : (isRefValid ? 'rgba(34, 197, 94, 0.25)' : 'rgba(245, 158, 11, 0.35)')}` }}>
                <span className="material-symbols-outlined" style={{ color: isDup ? '#ef4444' : (isRefValid ? '#16a34a' : '#d97706'), fontSize: '18px', marginTop: '2px' }}>{isDup ? 'gpp_bad' : (isRefValid ? 'check_circle' : 'help_outline')}</span>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {isDup ? `Duplicate Reference (${refNo})` : (isRefValid ? `Reference Number Match (${refNo})` : (isScanning ? 'Scanning Reference Number...' : 'Reference Number Unextracted'))}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: isDup ? '#ef4444' : (isRefValid ? 'var(--text-muted)' : '#d97706'), marginTop: '2px' }}>
                    {isDup ? 'WARNING: Reference number matches a previously recorded transaction.' : (isRefValid ? 'Extracted reference number matches donor submission.' : 'Parsing receipt image pixels for 13-digit reference number...')}
                  </div>
                </div>
              </div>

              {/* Checkmark 3: Payment Amount Reconciled */}
              <div style={{ display: 'flex', gap: '12px', padding: '10px 14px', borderRadius: '10px', background: isAmtMismatch ? 'rgba(239, 68, 68, 0.12)' : (extractedAmtPhp > 0 ? 'rgba(34, 197, 94, 0.08)' : 'rgba(245, 158, 11, 0.12)'), border: `1px solid ${isAmtMismatch ? 'rgba(239, 68, 68, 0.35)' : (extractedAmtPhp > 0 ? 'rgba(34, 197, 94, 0.25)' : 'rgba(245, 158, 11, 0.35)')}` }}>
                <span className="material-symbols-outlined" style={{ color: isAmtMismatch ? '#ef4444' : (extractedAmtPhp > 0 ? '#16a34a' : '#d97706'), fontSize: '18px', marginTop: '2px' }}>{isAmtMismatch ? 'gpp_bad' : (extractedAmtPhp > 0 ? 'check_circle' : 'help_outline')}</span>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {isAmtMismatch ? `Amount Mismatch (Receipt: ₱${extractedAmtPhp.toLocaleString()} vs Declared: ₱${declaredAmtPhp.toLocaleString()})` : (extractedAmtPhp > 0 ? `Amount Reconciled (₱${extractedAmtPhp.toLocaleString()} PHP)` : `Declared Amount: ₱${declaredAmtPhp.toLocaleString()} PHP`)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: isAmtMismatch ? '#ef4444' : 'var(--text-muted)', marginTop: '2px' }}>
                    {isAmtMismatch ? `Extracted receipt amount (₱${extractedAmtPhp.toLocaleString()}) differs from declared donation value (₱${declaredAmtPhp.toLocaleString()})!` : 'Receipt amount matches declared donation value.'}
                  </div>
                </div>
              </div>

              {/* Checkmark 4: Anti-Fraud Clearance / Duplicate Check */}
              {isDup ? (
                <div style={{ display: 'flex', gap: '12px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)' }}>
                  <span className="material-symbols-outlined" style={{ color: '#ef4444', fontSize: '18px', marginTop: '2px' }}>gpp_bad</span>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Duplicate Reference Number Flagged ({refNo})
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '2px' }}>
                      FRAUD WARNING: Reference #{refNo} has ALREADY been submitted and recorded in a previous donation transaction! Duplicate slip reuse detected.
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '12px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.25)' }}>
                  <span className="material-symbols-outlined" style={{ color: '#16a34a', fontSize: '18px', marginTop: '2px' }}>shield</span>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Zero Anti-Fraud Duplicate Flagged
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      No previous transaction on the database or blockchain ledger has used this reference number.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* OCR Extracted Metadata Card */}
            <div style={{ background: 'rgba(15, 23, 42, 0.7)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '12px 16px' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '8px' }}>
                Extracted Metadata Summary
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.76rem' }}>
                <div>
                  <span style={{ color: '#94a3b8' }}>OCR Engine: </span>
                  <span style={{ color: '#f8fafc', fontWeight: 700 }}>{ocrResult ? 'Tesseract Live Browser OCR' : (ai.auditedBy || 'Tesseract Pixel OCR')}</span>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>Payment Rail: </span>
                  <span style={{ color: isRailMismatch ? '#ef4444' : '#38bdf8', fontWeight: 700 }}>
                    {ai.detectedRail || ocrResult?.extractedRail || paymentRail} {isRailMismatch ? `(Declared: ${declaredRail})` : ''}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>Ref Number: </span>
                  <span style={{ color: isRefValid ? '#4ade80' : '#fbbf24', fontWeight: 800, fontFamily: 'monospace' }}>{refNo}</span>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>Extracted Amount: </span>
                  <span style={{ color: isAmtValid ? '#4ade80' : '#fbbf24', fontWeight: 800 }}>₱{Number(amtPhp).toLocaleString()} PHP</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer Modal Actions */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.6)' }}>
          <a href={formatImageSrc(imgSrc)} download="payment_slip.png" className="btn btn-outline btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>download</span>
            <span>Download Slip</span>
          </a>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" onClick={() => setProofPreviewModalImg(null)} className="btn btn-primary btn-sm">
              Close Preview
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}