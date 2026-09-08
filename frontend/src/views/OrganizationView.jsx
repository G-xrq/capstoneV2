import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import CampaignCard, { shortAddr, formatCampaignTitle, getOrgDisplayName } from '../components/CampaignCard';
import LocationMapPicker from '../components/LocationMapPicker';
import { ROLES } from '../roleConfig';
import SettingsPanel from '../components/SettingsPanel';
import DisasterRadarHeatmap from '../components/DisasterRadarHeatmap';
import { useToast } from '../context/ToastContext';
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
  const { showSuccess, showWarning } = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');

  // Filter & Sort States for "All Campaigns"
  const [categoryFilterAll, setCategoryFilterAll] = useState('ALL');
  const [campaignSortAll, setCampaignSortAll] = useState('NEWEST');
  const [searchQueryAll, setSearchQueryAll] = useState('');
  const [currentPageAll, setCurrentPageAll] = useState(1);

  // Filter & Sort States for "My Campaigns"
  const [categoryFilterMy, setCategoryFilterMy] = useState('ALL');
  const [campaignSortMy, setCampaignSortMy] = useState('NEWEST');
  const [searchQueryMy, setSearchQueryMy] = useState('');
  const [currentPageMy, setCurrentPageMy] = useState(1);

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
  const [country, setCountry] = useState('Philippines');
  const [zipCode, setZipCode] = useState('');
  const [landmark, setLandmark] = useState('');
  const [gpsCoordinates, setGpsCoordinates] = useState('');
  const [mapSearchTrigger, setMapSearchTrigger] = useState(0);
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

  const [foodPct, setFoodPct] = useState(40);
  const [medicalPct, setMedicalPct] = useState(30);
  const [shelterPct, setShelterPct] = useState(20);
  const [logisticsPct, setLogisticsPct] = useState(10);
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [txModal, setTxModal] = useState({ show: false, step: 0, hash: '', type: '', error: '' });

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

  const handleAutofillAllPaymentDetails = () => {
    // 1. GCash
    setGcashName(orgDisplayName || 'ReliefLink Foundation Inc.');
    setGcashNumber('0917 890 1234');
    const gcashSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300"><rect width="300" height="300" fill="#ffffff" rx="16"/><rect x="20" y="20" width="70" height="70" fill="#007dfe" rx="8"/><rect x="32" y="32" width="46" height="46" fill="#ffffff" rx="4"/><rect x="42" y="42" width="26" height="26" fill="#007dfe" rx="2"/><rect x="210" y="20" width="70" height="70" fill="#007dfe" rx="8"/><rect x="222" y="32" width="46" height="46" fill="#ffffff" rx="4"/><rect x="232" y="42" width="26" height="26" fill="#007dfe" rx="2"/><rect x="20" y="210" width="70" height="70" fill="#007dfe" rx="8"/><rect x="32" y="222" width="46" height="46" fill="#ffffff" rx="4"/><rect x="42" y="232" width="26" height="26" fill="#007dfe" rx="2"/><g fill="#0f172a"><rect x="105" y="35" width="14" height="14" rx="2"/><rect x="135" y="35" width="14" height="14" rx="2"/><rect x="165" y="35" width="14" height="14" rx="2"/><rect x="35" y="105" width="14" height="14" rx="2"/><rect x="35" y="135" width="14" height="14" rx="2"/><rect x="35" y="165" width="14" height="14" rx="2"/><rect x="105" y="105" width="14" height="14" rx="2"/><rect x="180" y="105" width="14" height="14" rx="2"/><rect x="105" y="180" width="14" height="14" rx="2"/><rect x="180" y="180" width="14" height="14" rx="2"/><rect x="215" y="105" width="14" height="14" rx="2"/><rect x="245" y="105" width="14" height="14" rx="2"/><rect x="105" y="215" width="14" height="14" rx="2"/><rect x="105" y="245" width="14" height="14" rx="2"/></g><rect x="110" y="110" width="80" height="80" rx="16" fill="#007dfe"/><text x="150" y="158" font-family="system-ui, -apple-system, sans-serif" font-size="38" font-weight="900" fill="#ffffff" text-anchor="middle">G</text><text x="150" y="285" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="700" fill="#007dfe" text-anchor="middle">OFFICIAL GCASH QR PH</text></svg>`;
    setGcashQrUrl(`data:image/svg+xml;utf8,${encodeURIComponent(gcashSvg)}`);

    // 2. Maya
    setMayaName(orgDisplayName || 'ReliefLink Foundation Inc.');
    setMayaNumber('0918 765 4321');
    const mayaSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300"><rect width="300" height="300" fill="#000000" rx="16"/><rect x="20" y="20" width="70" height="70" fill="#00d68f" rx="8"/><rect x="32" y="32" width="46" height="46" fill="#000000" rx="4"/><rect x="42" y="42" width="26" height="26" fill="#00d68f" rx="2"/><rect x="210" y="20" width="70" height="70" fill="#00d68f" rx="8"/><rect x="222" y="32" width="46" height="46" fill="#000000" rx="4"/><rect x="232" y="42" width="26" height="26" fill="#00d68f" rx="2"/><rect x="20" y="210" width="70" height="70" fill="#00d68f" rx="8"/><rect x="32" y="222" width="46" height="46" fill="#000000" rx="4"/><rect x="42" y="232" width="26" height="26" fill="#00d68f" rx="2"/><g fill="#ffffff"><rect x="105" y="35" width="14" height="14" rx="2"/><rect x="135" y="35" width="14" height="14" rx="2"/><rect x="165" y="35" width="14" height="14" rx="2"/><rect x="35" y="105" width="14" height="14" rx="2"/><rect x="35" y="135" width="14" height="14" rx="2"/><rect x="35" y="165" width="14" height="14" rx="2"/><rect x="105" y="105" width="14" height="14" rx="2"/><rect x="180" y="105" width="14" height="14" rx="2"/><rect x="105" y="180" width="14" height="14" rx="2"/><rect x="180" y="180" width="14" height="14" rx="2"/><rect x="215" y="105" width="14" height="14" rx="2"/><rect x="245" y="105" width="14" height="14" rx="2"/><rect x="105" y="215" width="14" height="14" rx="2"/><rect x="105" y="245" width="14" height="14" rx="2"/></g><rect x="100" y="115" width="100" height="70" rx="12" fill="#000000" stroke="#00d68f" stroke-width="2"/><text x="150" y="158" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="900" fill="#00d68f" text-anchor="middle">maya</text><text x="150" y="285" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="700" fill="#00d68f" text-anchor="middle">OFFICIAL MAYA QR PH</text></svg>`;
    setMayaQrUrl(`data:image/svg+xml;utf8,${encodeURIComponent(mayaSvg)}`);

    // 3. Bank Account
    setBankName('BDO Unibank');
    setBankAccountName(`${orgDisplayName || 'ReliefLink Foundation Inc.'}`);
    setBankAccountNumber('0012 3456 7890');
    const bankSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300"><rect width="300" height="300" fill="#ffffff" rx="16"/><rect x="20" y="20" width="70" height="70" fill="#0284c7" rx="8"/><rect x="32" y="32" width="46" height="46" fill="#ffffff" rx="4"/><rect x="42" y="42" width="26" height="26" fill="#0284c7" rx="2"/><rect x="210" y="20" width="70" height="70" fill="#0284c7" rx="8"/><rect x="222" y="32" width="46" height="46" fill="#ffffff" rx="4"/><rect x="232" y="42" width="26" height="26" fill="#0284c7" rx="2"/><rect x="20" y="210" width="70" height="70" fill="#0284c7" rx="8"/><rect x="32" y="222" width="46" height="46" fill="#ffffff" rx="4"/><rect x="42" y="232" width="26" height="26" fill="#0284c7" rx="2"/><g fill="#0f172a"><rect x="105" y="35" width="14" height="14" rx="2"/><rect x="135" y="35" width="14" height="14" rx="2"/><rect x="165" y="35" width="14" height="14" rx="2"/><rect x="35" y="105" width="14" height="14" rx="2"/><rect x="35" y="135" width="14" height="14" rx="2"/><rect x="35" y="165" width="14" height="14" rx="2"/><rect x="105" y="105" width="14" height="14" rx="2"/><rect x="180" y="105" width="14" height="14" rx="2"/><rect x="105" y="180" width="14" height="14" rx="2"/><rect x="180" y="180" width="14" height="14" rx="2"/><rect x="215" y="105" width="14" height="14" rx="2"/><rect x="245" y="105" width="14" height="14" rx="2"/><rect x="105" y="215" width="14" height="14" rx="2"/><rect x="105" y="245" width="14" height="14" rx="2"/></g><rect x="105" y="110" width="90" height="80" rx="14" fill="#0284c7"/><text x="150" y="158" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="900" fill="#ffffff" text-anchor="middle">BDO</text><text x="150" y="285" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="700" fill="#0284c7" text-anchor="middle">INSTAPAY / PESONET</text></svg>`;
    setBankQrUrl(`data:image/svg+xml;utf8,${encodeURIComponent(bankSvg)}`);

    showSuccess('Demo payment channels (GCash, Maya, Bank) auto-filled!', 'Channels Configured');
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

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPageAll(1);
  }, [categoryFilterAll, campaignSortAll, searchQueryAll]);

  useEffect(() => {
    setCurrentPageMy(1);
  }, [categoryFilterMy, campaignSortMy, searchQueryMy]);

  const handleGranularAddressFromMap = ({ street: s, barangay: b, city: c, province: p, country: cnt, zip: z }) => {
    setStreet(s || '');
    setBarangay(b || '');
    setCity(c || '');
    setProvince(p || '');
    setCountry(cnt || 'Philippines');
    const activeZip = z || zipCode;
    if (z) setZipCode(z);

    const constructed = [s, b, c, p, activeZip, cnt, landmark ? `(Landmark: ${landmark})` : ''].filter(Boolean).join(', ');
    setLocationRegion(constructed);
  };

  // Fetch Organization Received Donations
  const fetchOrgDonations = async () => {
    try {
      setLoadingOrgDonations(true);
      const token = localStorage.getItem('bbdrts_token');
      if (!token) return;
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
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
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
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
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
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
  const [kycStatusData, setKycStatusData] = useState(null);
  const [viewingKycCert, setViewingKycCert] = useState(false);

  const fetchKycData = async () => {
    try {
      setKycLoading(true);
      const token = localStorage.getItem('bbdrts_token');
      if (!token) return;
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/organization/kyc`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setKycStatusData(data);
        if (data.secRegistrationNo) setSecRegNo(data.secRegistrationNo);
        if (data.dswdAccreditationNo) setDswdNo(data.dswdAccreditationNo);
        if (data.boardMembers) setBoardMembersText(data.boardMembers);
        if (data.secCertificateUrl) setSecCertUrl(data.secCertificateUrl);
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
      setSecCertUrl(uploadEvent.target.result);
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
    setSecCertUrl(`data:image/svg+xml;utf8,${encodeURIComponent(secCertSvg)}`);
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
      const token = localStorage.getItem('bbdrts_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
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

      if (res.ok) {
        showSuccess('SEC documents submitted to the Admin Audit Desk for verification.', 'KYC Submitted');
        fetchKycData();
      } else {
        const err = await res.json();
        showWarning(err.error || 'Failed to submit KYC.', 'Submission Failed');
      }
    } catch (err) {
      console.error(err);
      showWarning('Network error submitting KYC: ' + err.message, 'Error');
    } finally {
      setKycSaving(false);
    }
  };

  useEffect(() => {
    fetchOrgDonations();
    fetchPendingDonations();
    fetchKycData();
  }, []);

  // Filter & Sort All Campaigns
  const filteredAllCampaigns = campaigns
    .filter(c => {
      if (categoryFilterAll !== 'ALL') {
        const displayTitle = formatCampaignTitle(c.title, c.id);
        const isCharity = /charity|school|orphan|food|feed|community|aid|blood|medical/i.test(displayTitle);
        if (categoryFilterAll === 'DR' && isCharity) return false;
        if (categoryFilterAll === 'CD' && !isCharity) return false;
      }
      if (searchQueryAll.trim()) {
        const q = searchQueryAll.toLowerCase().trim();
        const displayTitle = formatCampaignTitle(c.title, c.id).toLowerCase();
        const rawTitle = (c.title || '').toLowerCase();
        const orgName = (c.orgName || '').toLowerCase();
        return displayTitle.includes(q) || rawTitle.includes(q) || orgName.includes(q) || String(c.id).includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      if (campaignSortAll === 'GOAL_HIGH') return (parseFloat(b.targetAmount) || 0) - (parseFloat(a.targetAmount) || 0);
      if (campaignSortAll === 'GOAL_LOW') return (parseFloat(a.targetAmount) || 0) - (parseFloat(b.targetAmount) || 0);
      if (campaignSortAll === 'RAISED_HIGH') return (parseFloat(b.currentAmount) || 0) - (parseFloat(a.currentAmount) || 0);
      return b.id - a.id;
    });

  const totalPagesAll = Math.ceil(filteredAllCampaigns.length / campaignsPerPage);
  const paginatedAllCampaigns = filteredAllCampaigns.slice(
    (currentPageAll - 1) * campaignsPerPage,
    currentPageAll * campaignsPerPage
  );

  // Filter & Sort My Campaigns
  const filteredMyCampaigns = myCampaigns
    .filter(c => {
      if (categoryFilterMy !== 'ALL') {
        const displayTitle = formatCampaignTitle(c.title, c.id);
        const isCharity = /charity|school|orphan|food|feed|community|aid|blood|medical/i.test(displayTitle);
        if (categoryFilterMy === 'DR' && isCharity) return false;
        if (categoryFilterMy === 'CD' && !isCharity) return false;
      }
      if (searchQueryMy.trim()) {
        const q = searchQueryMy.toLowerCase().trim();
        const displayTitle = formatCampaignTitle(c.title, c.id).toLowerCase();
        const rawTitle = (c.title || '').toLowerCase();
        return displayTitle.includes(q) || rawTitle.includes(q) || String(c.id).includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      if (campaignSortMy === 'GOAL_HIGH') return (parseFloat(b.targetAmount) || 0) - (parseFloat(a.targetAmount) || 0);
      if (campaignSortMy === 'GOAL_LOW') return (parseFloat(a.targetAmount) || 0) - (parseFloat(b.targetAmount) || 0);
      if (campaignSortMy === 'RAISED_HIGH') return (parseFloat(b.currentAmount) || 0) - (parseFloat(a.currentAmount) || 0);
      return b.id - a.id;
    });

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
    const parsed = parseFloat(targetAmount);
    if (isNaN(parsed) || parsed <= 0)
      return setTxModal({ show: true, step: 0, error: 'Please enter a valid target amount greater than 0 ETH.' });
    if (!contract)
      return setTxModal({ show: true, step: 0, error: 'ACTION BLOCKED: You are not actively connected to MetaMask on this specific wallet address. Please go to Profile & Settings and click Connect MetaMask.' });

    try {
      setCreating(true);
      const targetInWei = ethers.parseEther(targetAmount);

      setTxModal({ show: true, step: 1, hash: '', type: 'CREATE', error: '' });
      const tx = await contract.createCampaign(title.trim(), targetInWei);

      setTxModal({ show: true, step: 2, hash: tx.hash, type: 'CREATE', error: '' });
      await tx.wait();

      try {
        const token = localStorage.getItem('bbdrts_token');
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

        const allocations = [
          { label: '🍲 Emergency Food Packs & Clean Water', pct: Number(foodPct) || 40, icon: 'rice_bowl' },
          { label: '🏥 Medical Aid & First-Aid Kits', pct: Number(medicalPct) || 30, icon: 'medical_services' },
          { label: '⛺ Emergency Shelter & Tarpaulins', pct: Number(shelterPct) || 20, icon: 'roofing' },
          { label: '🚚 Logistics & Evacuation Fuel', pct: Number(logisticsPct) || 10, icon: 'local_shipping' }
        ];

        // Construct full address from granular input fields if map picker wasn't clicked
        const constructedAddress = [street, barangay, city, province, zipCode, country, landmark ? `(Landmark: ${landmark})` : '']
          .map(s => (s || '').trim())
          .filter(Boolean)
          .join(', ');

        const finalLocationRegion = locationRegion.trim() || constructedAddress || '';

        const payload = {
          title: title.trim(),
          target_amount: targetAmount,
          contract_address: Object(contract).target || 'Pending',
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

        await fetch(`${apiUrl}/api/campaigns`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      } catch (err) {
        console.error("Failed to sync campaign to backend:", err);
      }

      setTxModal({ show: true, step: 3, hash: tx.hash, type: 'CREATE', error: '' });
      setTitle('');
      setTargetAmount('');
      setLocationRegion('');
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
            <div className="ref-sidebar-user">
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
                className={`ref-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                onClick={() => setActiveTab('dashboard')}
              >
                <span className="material-symbols-outlined">space_dashboard</span>
                <span>Dashboard Overview</span>
              </button>

              <button
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
                className={`ref-nav-item ${activeTab === 'all-campaigns' ? 'active' : ''}`}
                onClick={() => setActiveTab('all-campaigns')}
              >
                <span className="material-symbols-outlined">list_alt</span>
                <span>All Campaigns</span>
              </button>

              <button
                className={`ref-nav-item ${activeTab === 'radar-heatmap' ? 'active' : ''}`}
                onClick={() => setActiveTab('radar-heatmap')}
              >
                <span className="material-symbols-outlined" style={{ color: activeTab === 'radar-heatmap' ? '#38bdf8' : 'inherit' }}>radar</span>
                <span>Relief Radar</span>
              </button>

              <button
                className={`ref-nav-item ${activeTab === 'my-campaigns' ? 'active' : ''}`}
                onClick={() => setActiveTab('my-campaigns')}
              >
                <span className="material-symbols-outlined">account_balance</span>
                <span>My Campaigns</span>
              </button>

              <button
                className={`ref-nav-item ${activeTab === 'create' ? 'active' : ''}`}
                onClick={() => setActiveTab('create')}
              >
                <span className="material-symbols-outlined">rocket_launch</span>
                <span>Deploy Campaign</span>
              </button>

              <button
                className={`ref-nav-item ${activeTab === 'ledger' ? 'active' : ''}`}
                onClick={() => setActiveTab('ledger')}
              >
                <span className="material-symbols-outlined">receipt_long</span>
                <span>Donation Ledger</span>
              </button>

              <button
                className={`ref-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => setActiveTab('settings')}
              >
                <span className="material-symbols-outlined">account_circle</span>
                <span>Profile & Settings</span>
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

              {/* Filter & Sort Toolbar */}
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
                      placeholder="Search campaign, NGO, or cause..."
                      value={searchQueryAll}
                      onChange={(e) => setSearchQueryAll(e.target.value)}
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
                    {searchQueryAll && (
                      <button
                        onClick={() => setSearchQueryAll('')}
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
                    value={categoryFilterAll}
                    onChange={(e) => setCategoryFilterAll(e.target.value)}
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
                    <option value="ALL">All Categories ({campaigns.length})</option>
                    <option value="DR">🌊 Disaster Relief (DR-00X)</option>
                    <option value="CD">🤝 Charitable Aid (CD-00X)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 600 }}>Sort By:</span>
                  <select
                    value={campaignSortAll}
                    onChange={(e) => setCampaignSortAll(e.target.value)}
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
                    <option value="GOAL_HIGH">Target Goal: High to Low</option>
                    <option value="GOAL_LOW">Target Goal: Low to High</option>
                    <option value="RAISED_HIGH">Highest Raised</option>
                  </select>
                </div>

                {/* Segmented Layout Mode Controls [List] [Grid] (2-Col removed!) */}
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
                        role={ROLES.ORGANIZATION} walletAddress={walletAddress} onDonated={fetchCampaigns} />
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

              {/* Filter & Sort Toolbar */}
              {myCampaigns.length > 0 && (
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
                        placeholder="Search my campaigns..."
                        value={searchQueryMy}
                        onChange={(e) => setSearchQueryMy(e.target.value)}
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
                      {searchQueryMy && (
                        <button
                          onClick={() => setSearchQueryMy('')}
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
                      value={categoryFilterMy}
                      onChange={(e) => setCategoryFilterMy(e.target.value)}
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
                      <option value="ALL">All Categories ({myCampaigns.length})</option>
                      <option value="DR">🌊 Disaster Relief (DR-00X)</option>
                      <option value="CD">🤝 Charitable Aid (CD-00X)</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 600 }}>Sort By:</span>
                    <select
                      value={campaignSortMy}
                      onChange={(e) => setCampaignSortMy(e.target.value)}
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
                      <option value="GOAL_HIGH">Target Goal: High to Low</option>
                      <option value="GOAL_LOW">Target Goal: Low to High</option>
                      <option value="RAISED_HIGH">Highest Raised</option>
                    </select>
                  </div>

                  {/* Segmented Layout Mode Controls [List] [Grid] (2-Col removed!) */}
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
              )}

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
                        role={ROLES.ORGANIZATION} walletAddress={walletAddress} onDonated={fetchCampaigns} />
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
                <div className="card glow fade-in" style={{ padding: '28px', borderRadius: '16px' }}>
                  <div className="section-header" style={{ marginBottom: '16px' }}>
                    <h2 className="section-title">
                      <span className="material-symbols-outlined section-title-icon" style={{ marginRight: '8px' }}>rocket_launch</span> Deploy Relief Campaign
                    </h2>
                    <span className="badge badge-info">NGO Organization Portal</span>
                  </div>
                  <p style={{ fontSize: '0.88rem', color: '#94a3b8', marginBottom: '22px', lineHeight: 1.5 }}>
                    Deploy a new relief operation under your official organization name (<strong>{orgDisplayName}</strong>). This action creates a smart contract instance linked directly to your wallet address (<code style={{ fontSize: '0.82rem', color: 'var(--accent)' }}>{shortAddr(walletAddress)}</code>).
                  </p>

                  <form className="create-form" onSubmit={handleCreateCampaign} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Section 1: Campaign Essentials */}
                    <div style={{ background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '14px', padding: '20px' }}>
                      <h3 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>campaign</span> 1. Basic Campaign Information
                      </h3>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                        {/* Campaign Title (Full Width) */}
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '4px' }}>
                            Campaign Title *
                          </label>
                          <input className="input" type="text" required
                            placeholder="e.g., Super Typhoon Emergency Relief Operation"
                            value={title} onChange={(e) => setTitle(e.target.value)} disabled={creating} style={{ fontSize: '0.88rem' }} />
                        </div>

                        {/* Relief Category */}
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '4px' }}>
                            Relief Category *
                          </label>
                          <select
                            className="input"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            disabled={creating}
                            style={{ background: 'rgba(30, 41, 59, 0.9)', color: '#fff', fontSize: '0.85rem' }}
                          >
                            <option value="DR">🌊 Disaster Relief (DR)</option>
                            <option value="CD">🤝 Charitable Aid (CD)</option>
                          </select>
                        </div>

                        {/* Fundraising Target (ETH) */}
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '4px' }}>
                            Fundraising Target (ETH) *
                          </label>
                          <input className="input" type="number" step="0.001" min="0" required
                            placeholder="e.g., 0.5 ETH"
                            value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} disabled={creating} style={{ fontSize: '0.85rem' }} />
                          {targetAmount && !isNaN(parseFloat(targetAmount)) && (
                            <div style={{ marginTop: '4px', fontSize: '0.76rem', color: '#38bdf8', fontWeight: 600 }}>
                              ≈ Target Goal: ₱{(parseFloat(targetAmount) * 170000).toLocaleString('en-US', { maximumFractionDigits: 2 })} PHP
                            </div>
                          )}
                        </div>

                        {/* Urgency Status */}
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '4px' }}>
                            Urgency Status
                          </label>
                          <select className="input" value={urgency} onChange={(e) => setUrgency(e.target.value)} disabled={creating} style={{ fontSize: '0.85rem', background: 'rgba(30, 41, 59, 0.9)', color: '#fff' }}>
                            <option value="HIGH (EMERGENCY AID)">🔴 Emergency High Aid</option>
                            <option value="MEDIUM (URGENT REHABILITATION)">🟡 Urgent Medium Rehabilitation</option>
                            <option value="STABLE (CHARITABLE AID)">🟢 Standard Aid Operation</option>
                          </select>
                        </div>

                        {/* Target Relief Delivery Date */}
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '4px' }}>
                            Target Relief Delivery Date
                          </label>
                          <input
                            className="input"
                            type="date"
                            min={new Date().toISOString().split('T')[0]}
                            value={targetDate}
                            onChange={(e) => setTargetDate(e.target.value)}
                            disabled={creating}
                            style={{
                              fontSize: '0.85rem',
                              colorScheme: 'dark',
                              color: '#ffffff',
                              background: 'rgba(30, 41, 59, 0.9)',
                              cursor: 'pointer'
                            }}
                          />
                        </div>

                        {/* Estimated Beneficiaries (Full Width) */}
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '4px' }}>
                            Estimated Beneficiaries / Impact Scope
                          </label>
                          <input className="input" type="text"
                            placeholder="e.g., ~3,500 Displaced Families across 12 Barangays"
                            value={beneficiariesImpact} onChange={(e) => setBeneficiariesImpact(e.target.value)} disabled={creating} style={{ fontSize: '0.85rem' }} />
                        </div>

                        {/* Campaign Focus Tags (Clean Multi-Select without emoji) */}
                        <div style={{ gridColumn: '1 / -1', marginTop: '4px' }}>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '6px' }}>
                            Campaign Operation Tags (Select up to 4 tags to display on the card)
                          </label>
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
                                  style={{
                                    background: isSelected ? 'var(--accent-dim)' : 'rgba(30, 41, 59, 0.7)',
                                    border: isSelected ? '1px solid var(--accent)' : '1px solid rgba(255, 255, 255, 0.15)',
                                    color: isSelected ? 'var(--accent)' : 'var(--text-secondary)',
                                    fontSize: '0.74rem',
                                    fontWeight: 600,
                                    padding: '5px 10px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    transition: 'all 0.15s ease'
                                  }}
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

                    {/* Section 2: Interactive Location Map & Geocoding (2-Column Grid) */}
                    <div style={{ background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '14px', padding: '20px' }}>
                      <h3 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>map</span> 2. Target Location & Interactive Pin Map
                      </h3>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '20px', alignItems: 'start' }}>
                        {/* Left Column (50%): Granular Address Fields */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: '#ef4444' }}>location_on</span> Granular Address Details
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-xs"
                                onClick={() => {
                                  const fullAddr = [street, barangay, city, province, zipCode, country, landmark ? `(Landmark: ${landmark})` : ''].filter(Boolean).join(', ');
                                  if (fullAddr) setLocationRegion(fullAddr);
                                  setMapSearchTrigger({ query: fullAddr || locationRegion || 'Philippines', ts: Date.now() });
                                }}
                                disabled={creating}
                                style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid rgba(56, 189, 248, 0.4)' }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>search</span>
                                Find / Sync Location
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                onClick={() => {
                                  setStreet('');
                                  setBarangay('');
                                  setCity('');
                                  setProvince('');
                                  setZipCode('');
                                  setLandmark('');
                                  setCountry('Philippines');
                                  setLocationRegion('');
                                  setGpsCoordinates('');
                                }}
                                disabled={creating}
                                style={{ fontSize: '0.72rem', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '2px 8px', borderRadius: '6px' }}
                              >
                                🧹 Clear
                              </button>
                            </div>
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '4px' }}>
                              Street / Building / House No.
                            </label>
                            <input
                              className="input"
                              type="text"
                              placeholder="e.g., Rizal Street, Block 4"
                              value={street}
                              onChange={(e) => {
                                setStreet(e.target.value);
                                setLocationRegion([e.target.value, barangay, city, province, zipCode, country, landmark ? `(Landmark: ${landmark})` : ''].filter(Boolean).join(', '));
                              }}
                              disabled={creating}
                              style={{ fontSize: '0.85rem' }}
                            />
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '4px' }}>
                                Barangay
                              </label>
                              <input
                                className="input"
                                type="text"
                                placeholder="e.g., Barangay Abgao"
                                value={barangay}
                                onChange={(e) => {
                                  setBarangay(e.target.value);
                                  setLocationRegion([street, e.target.value, city, province, zipCode, country, landmark ? `(Landmark: ${landmark})` : ''].filter(Boolean).join(', '));
                                }}
                                disabled={creating}
                                style={{ fontSize: '0.85rem' }}
                              />
                            </div>

                            <div>
                              <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '4px' }}>
                                Municipality / City *
                              </label>
                              <input
                                className="input"
                                type="text"
                                required
                                placeholder="e.g., Maasin City"
                                value={city}
                                onChange={(e) => {
                                  setCity(e.target.value);
                                  setLocationRegion([street, barangay, e.target.value, province, zipCode, country, landmark ? `(Landmark: ${landmark})` : ''].filter(Boolean).join(', '));
                                }}
                                disabled={creating}
                                style={{ fontSize: '0.85rem' }}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '4px' }}>
                                Province / State *
                              </label>
                              <input
                                className="input"
                                type="text"
                                required
                                placeholder="e.g., Southern Leyte"
                                value={province}
                                onChange={(e) => {
                                  setProvince(e.target.value);
                                  setLocationRegion([street, barangay, city, e.target.value, zipCode, country, landmark ? `(Landmark: ${landmark})` : ''].filter(Boolean).join(', '));
                                }}
                                disabled={creating}
                                style={{ fontSize: '0.85rem' }}
                              />
                            </div>

                            <div>
                              <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '4px' }}>
                                Zip / Postal Code
                              </label>
                              <input
                                className="input"
                                type="text"
                                placeholder="e.g., 6600"
                                value={zipCode}
                                onChange={(e) => {
                                  setZipCode(e.target.value);
                                  setLocationRegion([street, barangay, city, province, e.target.value, country, landmark ? `(Landmark: ${landmark})` : ''].filter(Boolean).join(', '));
                                }}
                                disabled={creating}
                                style={{ fontSize: '0.85rem' }}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '4px' }}>
                                Country
                              </label>
                              <input
                                className="input"
                                type="text"
                                placeholder="e.g., Philippines"
                                value={country}
                                onChange={(e) => {
                                  setCountry(e.target.value);
                                  setLocationRegion([street, barangay, city, province, zipCode, e.target.value, landmark ? `(Landmark: ${landmark})` : ''].filter(Boolean).join(', '));
                                }}
                                disabled={creating}
                                style={{ fontSize: '0.85rem' }}
                              />
                            </div>

                            <div>
                              <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '4px' }}>
                                Landmark / Nearby Reference (Optional)
                              </label>
                              <input
                                className="input"
                                type="text"
                                placeholder="e.g., Beside Rizal Park, Near City Port"
                                value={landmark}
                                onChange={(e) => {
                                  setLandmark(e.target.value);
                                  setLocationRegion([street, barangay, city, province, zipCode, country, e.target.value ? `(Landmark: ${e.target.value})` : ''].filter(Boolean).join(', '));
                                }}
                                disabled={creating}
                                style={{ fontSize: '0.85rem' }}
                              />
                            </div>
                          </div>

                          {/* Combined Address Preview */}
                          <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '8px', padding: '10px 12px' }}>
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              📍 Formatted Full Address:
                            </div>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#38bdf8', marginTop: '2px', wordBreak: 'break-word' }}>
                              {locationRegion || 'Fill inputs above or select a point on the map →'}
                            </div>
                          </div>
                        </div>

                        {/* Right Column (50%): Square Leaflet Map View */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: '#38bdf8' }}>pin_drop</span> Square Map View
                            </span>
                            <span style={{ fontSize: '0.72rem', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.25)', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
                              Auto-Sync Pin
                            </span>
                          </div>

                          <div style={{
                            width: '100%',
                            height: '320px',
                            borderRadius: '14px',
                            overflow: 'hidden',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                            background: '#0f172a'
                          }}>
                            <LocationMapPicker
                              address={locationRegion}
                              gps={gpsCoordinates}
                              onChangeAddress={(addr) => setLocationRegion(addr)}
                              onChangeGranularAddress={handleGranularAddressFromMap}
                              onChangeGps={(coords) => setGpsCoordinates(coords)}
                              height="320px"
                              hideTip={true}
                              hideSearch={true}
                              searchTrigger={mapSearchTrigger}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section 3: Purpose & Contact */}
                    <div style={{ background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '20px' }}>
                      <h3 style={{ margin: '0 0 14px 0', fontSize: '0.95rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>contact_support</span> 3. Mission Purpose & Emergency Contact
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '14px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', color: '#e2e8f0', fontWeight: 600, marginBottom: '6px' }}>
                            Emergency Contact Hotline / Email
                          </label>
                          <input className="input" type="text"
                            placeholder="e.g., relief@redcross.org.ph • (053) 570-8899"
                            value={contactInfo} onChange={(e) => setContactInfo(e.target.value)} disabled={creating} />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', color: '#e2e8f0', fontWeight: 600, marginBottom: '6px' }}>
                            Official Document / Verification Link (Optional)
                          </label>
                          <input className="input" type="url"
                            placeholder="e.g., https://redcross.org.ph/press-release-102"
                            value={documentUrl} onChange={(e) => setDocumentUrl(e.target.value)} disabled={creating} />
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', color: '#e2e8f0', fontWeight: 600, marginBottom: '6px' }}>
                          Mission & Campaign Description
                        </label>
                        <textarea
                          className="input"
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
                        <div style={{ background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '14px', padding: '20px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                            <div>
                              <h3 style={{ margin: 0, fontSize: '0.98rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>account_balance_wallet</span> 4. Official Multi-Channel Payment Settings
                              </h3>
                              <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '3px' }}>
                                Configure receiving channels for donors contributing via GCash, Maya, or direct Bank Transfer.
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="card-autofill-btn"
                                onClick={handleAutofillFromProfile}
                                style={{
                                  margin: 0,
                                  padding: '7px 15px',
                                  fontSize: '0.78rem',
                                  background: profileReliefData.hasAny ? 'rgba(34, 197, 94, 0.16)' : 'rgba(148, 163, 184, 0.12)',
                                  color: profileReliefData.hasAny ? '#22c55e' : '#cbd5e1',
                                  border: profileReliefData.hasAny ? '1.5px solid rgba(34, 197, 94, 0.5)' : '1px dashed rgba(148, 163, 184, 0.35)',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  fontWeight: 700,
                                  transition: 'all 0.2s ease',
                                  boxShadow: profileReliefData.hasAny ? '0 0 12px rgba(34, 197, 94, 0.2)' : 'none'
                                }}
                                title={profileReliefData.hasAny ? "Auto-fill payment numbers and QR codes from your Organization Profile" : "No relief channels configured in profile edit yet. Click to view requirement."}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: profileReliefData.hasAny ? '#22c55e' : '#94a3b8' }}>
                                  sync_saved_locally
                                </span>
                                ⚡ Auto-fill from Profile
                                {profileReliefData.hasAny ? (
                                  <span style={{ background: '#22c55e', color: '#0f172a', fontSize: '0.65rem', padding: '1px 6px', borderRadius: '10px', fontWeight: 800 }}>
                                    READY
                                  </span>
                                ) : (
                                  <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', fontSize: '0.65rem', padding: '1px 6px', borderRadius: '10px', fontWeight: 700 }}>
                                    NOT SET IN PROFILE
                                  </span>
                                )}
                              </button>

                              <button
                                type="button"
                                className="card-autofill-btn"
                                onClick={handleAutofillAllPaymentDetails}
                                style={{ margin: 0, padding: '6px 12px', fontSize: '0.74rem', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}
                                title="Autofill verified test credentials for GCash, Maya, and BDO Bank"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>science</span>
                                Demo Fill
                              </button>
                            </div>
                          </div>

                          {/* Payment Channel Tab Selector */}
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              onClick={() => setActivePaymentChannelTab('gcash')}
                              style={{
                                flex: '1 1 120px',
                                padding: '8px 14px',
                                borderRadius: '10px',
                                border: activePaymentChannelTab === 'gcash' ? '1.5px solid #007DFE' : '1px solid rgba(255, 255, 255, 0.1)',
                                background: activePaymentChannelTab === 'gcash' ? 'rgba(0, 125, 254, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                                color: activePaymentChannelTab === 'gcash' ? '#007DFE' : '#94a3b8',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: (gcashNumber || gcashQrUrl || gcashName) ? '#22c55e' : '#64748b' }}></span>
                              <span>GCash</span>
                              {(gcashNumber || gcashQrUrl || gcashName) && <span style={{ fontSize: '0.7rem', color: '#22c55e' }}>✓</span>}
                            </button>

                            <button
                              type="button"
                              onClick={() => setActivePaymentChannelTab('maya')}
                              style={{
                                flex: '1 1 120px',
                                padding: '8px 14px',
                                borderRadius: '10px',
                                border: activePaymentChannelTab === 'maya' ? '1.5px solid #00d68f' : '1px solid rgba(255, 255, 255, 0.1)',
                                background: activePaymentChannelTab === 'maya' ? 'rgba(0, 214, 143, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                                color: activePaymentChannelTab === 'maya' ? '#00d68f' : '#94a3b8',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: (mayaNumber || mayaQrUrl || mayaName) ? '#22c55e' : '#64748b' }}></span>
                              <span>Maya</span>
                              {(mayaNumber || mayaQrUrl || mayaName) && <span style={{ fontSize: '0.7rem', color: '#22c55e' }}>✓</span>}
                            </button>

                            <button
                              type="button"
                              onClick={() => setActivePaymentChannelTab('bank')}
                              style={{
                                flex: '1 1 160px',
                                padding: '8px 14px',
                                borderRadius: '10px',
                                border: activePaymentChannelTab === 'bank' ? '1.5px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                                background: activePaymentChannelTab === 'bank' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                                color: activePaymentChannelTab === 'bank' ? '#38bdf8' : '#94a3b8',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: (bankAccountNumber || bankQrUrl) ? '#22c55e' : '#64748b' }}></span>
                              <span>Direct Bank Deposit</span>
                              {(bankAccountNumber || bankQrUrl) && <span style={{ fontSize: '0.7rem', color: '#22c55e' }}>✓</span>}
                            </button>
                          </div>

                          {/* ── 1. GCASH CHANNEL ── */}
                          {activePaymentChannelTab === 'gcash' && (
                            <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', alignItems: 'start', background: 'rgba(0, 125, 254, 0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(0, 125, 254, 0.2)' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.82rem', color: '#e2e8f0', fontWeight: 600, marginBottom: '6px' }}>
                                    Official GCash Account Name
                                  </label>
                                  <div style={{ position: 'relative' }}>
                                    <span className="material-symbols-outlined" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#007DFE', fontSize: '18px' }}>
                                      badge
                                    </span>
                                    <input
                                      className="input"
                                      type="text"
                                      placeholder="e.g., Philippine Red Cross - Southern Leyte"
                                      value={gcashName}
                                      onChange={(e) => setGcashName(e.target.value)}
                                      disabled={creating}
                                      style={{ paddingLeft: '38px', fontSize: '0.88rem' }}
                                    />
                                  </div>
                                  <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                                    Registered name displayed on GCash app confirmation.
                                  </span>
                                </div>

                                <div>
                                  <label style={{ display: 'block', fontSize: '0.82rem', color: '#e2e8f0', fontWeight: 600, marginBottom: '6px' }}>
                                    Official GCash Receiving Number
                                  </label>
                                  <div style={{ position: 'relative' }}>
                                    <span className="material-symbols-outlined" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#007DFE', fontSize: '18px' }}>
                                      smartphone
                                    </span>
                                    <input
                                      className="input"
                                      type="text"
                                      placeholder="e.g., 0917 890 1234"
                                      value={gcashNumber}
                                      onChange={(e) => setGcashNumber(e.target.value)}
                                      disabled={creating}
                                      style={{ paddingLeft: '38px', fontSize: '0.9rem', fontFamily: 'monospace', fontWeight: 700 }}
                                    />
                                  </div>
                                  <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                                    Donors can copy and send funds directly to this GCash account.
                                  </span>
                                </div>
                              </div>

                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                  <label style={{ fontSize: '0.82rem', color: '#e2e8f0', fontWeight: 600 }}>
                                    GCash QR Code Image
                                  </label>
                                  {gcashQrUrl && (
                                    <button
                                      type="button"
                                      onClick={() => setGcashQrUrl('')}
                                      style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}
                                    >
                                      Remove QR
                                    </button>
                                  )}
                                </div>

                                {gcashQrUrl ? (
                                  <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1.5px solid rgba(0, 125, 254, 0.4)', background: 'rgba(0,0,0,0.3)', padding: '10px', textAlign: 'center' }}>
                                    <img
                                      src={gcashQrUrl}
                                      alt="Organization GCash QR"
                                      style={{ maxHeight: '130px', maxWidth: '100%', objectFit: 'contain', borderRadius: '8px' }}
                                    />
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontSize: '0.74rem', color: '#007DFE', fontWeight: 700 }}>
                                      <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>verified</span>
                                      GCash QR Attached
                                    </div>
                                  </div>
                                ) : (
                                  <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px', border: '1.5px dashed rgba(0, 125, 254, 0.3)', borderRadius: '12px', cursor: 'pointer', background: 'rgba(0, 125, 254, 0.03)', transition: '0.2s' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#007DFE', marginBottom: '4px' }}>
                                      qr_code_scanner
                                    </span>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#ffffff' }}>
                                      Upload GCash QR
                                    </span>
                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>
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
                          )}

                          {/* ── 2. MAYA CHANNEL ── */}
                          {activePaymentChannelTab === 'maya' && (
                            <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', alignItems: 'start', background: 'rgba(0, 214, 143, 0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(0, 214, 143, 0.2)' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.82rem', color: '#e2e8f0', fontWeight: 600, marginBottom: '6px' }}>
                                    Official Maya Account Name
                                  </label>
                                  <div style={{ position: 'relative' }}>
                                    <span className="material-symbols-outlined" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#00d68f', fontSize: '18px' }}>
                                      badge
                                    </span>
                                    <input
                                      className="input"
                                      type="text"
                                      placeholder="e.g., Philippine Red Cross or Official Merchant"
                                      value={mayaName}
                                      onChange={(e) => setMayaName(e.target.value)}
                                      disabled={creating}
                                      style={{ paddingLeft: '38px', fontSize: '0.88rem' }}
                                    />
                                  </div>
                                  <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                                    Registered merchant or account name inside Maya.
                                  </span>
                                </div>

                                <div>
                                  <label style={{ display: 'block', fontSize: '0.82rem', color: '#e2e8f0', fontWeight: 600, marginBottom: '6px' }}>
                                    Official Maya Number or @Username
                                  </label>
                                  <div style={{ position: 'relative' }}>
                                    <span className="material-symbols-outlined" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#00d68f', fontSize: '18px' }}>
                                      account_circle
                                    </span>
                                    <input
                                      className="input"
                                      type="text"
                                      placeholder="e.g., 0918 765 4321 or @reliefph"
                                      value={mayaNumber}
                                      onChange={(e) => setMayaNumber(e.target.value)}
                                      disabled={creating}
                                      style={{ paddingLeft: '38px', fontSize: '0.9rem', fontFamily: 'monospace', fontWeight: 700 }}
                                    />
                                  </div>
                                  <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                                    Donors using Maya can transfer directly to this number or username.
                                  </span>
                                </div>
                              </div>

                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                  <label style={{ fontSize: '0.82rem', color: '#e2e8f0', fontWeight: 600 }}>
                                    Maya QR Code Image
                                  </label>
                                  {mayaQrUrl && (
                                    <button
                                      type="button"
                                      onClick={() => setMayaQrUrl('')}
                                      style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}
                                    >
                                      Remove QR
                                    </button>
                                  )}
                                </div>

                                {mayaQrUrl ? (
                                  <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1.5px solid rgba(0, 214, 143, 0.4)', background: 'rgba(0,0,0,0.3)', padding: '10px', textAlign: 'center' }}>
                                    <img
                                      src={mayaQrUrl}
                                      alt="Organization Maya QR"
                                      style={{ maxHeight: '130px', maxWidth: '100%', objectFit: 'contain', borderRadius: '8px' }}
                                    />
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontSize: '0.74rem', color: '#00d68f', fontWeight: 700 }}>
                                      <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>verified</span>
                                      Maya QR Attached
                                    </div>
                                  </div>
                                ) : (
                                  <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px', border: '1.5px dashed rgba(0, 214, 143, 0.3)', borderRadius: '12px', cursor: 'pointer', background: 'rgba(0, 214, 143, 0.03)', transition: '0.2s' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#00d68f', marginBottom: '4px' }}>
                                      qr_code_scanner
                                    </span>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#ffffff' }}>
                                      Upload Maya QR
                                    </span>
                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>
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
                          )}

                          {/* ── 3. DIRECT BANK DEPOSIT CHANNEL ── */}
                          {activePaymentChannelTab === 'bank' && (
                            <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', alignItems: 'start', background: 'rgba(56, 189, 248, 0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.82rem', color: '#e2e8f0', fontWeight: 600, marginBottom: '4px' }}>
                                    Bank Name
                                  </label>
                                  <input
                                    className="input"
                                    list="ph-bank-options"
                                    placeholder="e.g. BDO Unibank, BPI, Landbank"
                                    value={bankName}
                                    onChange={(e) => setBankName(e.target.value)}
                                    disabled={creating}
                                    style={{ background: 'rgba(30, 41, 59, 0.9)', color: '#fff', fontSize: '0.85rem' }}
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
                                  <label style={{ display: 'block', fontSize: '0.82rem', color: '#e2e8f0', fontWeight: 600, marginBottom: '4px' }}>
                                    Account Beneficiary Name
                                  </label>
                                  <input
                                    className="input"
                                    type="text"
                                    placeholder="e.g., ReliefLink Foundation Inc."
                                    value={bankAccountName}
                                    onChange={(e) => setBankAccountName(e.target.value)}
                                    disabled={creating}
                                    style={{ fontSize: '0.85rem' }}
                                  />
                                </div>

                                <div>
                                  <label style={{ display: 'block', fontSize: '0.82rem', color: '#e2e8f0', fontWeight: 600, marginBottom: '4px' }}>
                                    Account Number
                                  </label>
                                  <input
                                    className="input"
                                    type="text"
                                    placeholder="e.g., 0012 3456 7890"
                                    value={bankAccountNumber}
                                    onChange={(e) => setBankAccountNumber(e.target.value)}
                                    disabled={creating}
                                    style={{ fontSize: '0.88rem', fontFamily: 'monospace', fontWeight: 700 }}
                                  />
                                </div>
                              </div>

                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                  <label style={{ fontSize: '0.82rem', color: '#e2e8f0', fontWeight: 600 }}>
                                    Bank Transfer QR / InstaPay QR (Optional)
                                  </label>
                                  {bankQrUrl && (
                                    <button
                                      type="button"
                                      onClick={() => setBankQrUrl('')}
                                      style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}
                                    >
                                      Remove QR
                                    </button>
                                  )}
                                </div>

                                {bankQrUrl ? (
                                  <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1.5px solid rgba(56, 189, 248, 0.4)', background: 'rgba(0,0,0,0.3)', padding: '10px', textAlign: 'center' }}>
                                    <img
                                      src={bankQrUrl}
                                      alt="Organization Bank QR"
                                      style={{ maxHeight: '130px', maxWidth: '100%', objectFit: 'contain', borderRadius: '8px' }}
                                    />
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontSize: '0.74rem', color: '#38bdf8', fontWeight: 700 }}>
                                      <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>verified</span>
                                      Bank QR Attached
                                    </div>
                                  </div>
                                ) : (
                                  <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', border: '1.5px dashed rgba(56, 189, 248, 0.3)', borderRadius: '12px', cursor: 'pointer', background: 'rgba(56, 189, 248, 0.03)', transition: '0.2s' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#38bdf8', marginBottom: '4px' }}>
                                      account_balance
                                    </span>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#ffffff' }}>
                                      Upload Bank / InstaPay QR
                                    </span>
                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>
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
                          )}

                        </div>
                      );
                    })()}

                    {/* Submit Bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                      <button type="submit" className="btn btn-primary pulse" disabled={creating} style={{ padding: '12px 28px', fontSize: '0.95rem' }}>
                        {creating ? <><div className="spinner" /> Deploying to Blockchain…</> : '🚀 Confirm & Deploy Campaign'}
                      </button>

                      <div style={{ fontSize: '0.78rem', color: '#94a3b8', background: 'rgba(15, 23, 42, 0.5)', padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                        ⚡ Gas Fee Notice: Transaction mined on Sepolia EVM Protocol.
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
                    background: (kycStatusData?.Verification_Status === 'Approved') ? 'rgba(34, 197, 94, 0.08)' : 'rgba(56, 189, 248, 0.08)',
                    border: (kycStatusData?.Verification_Status === 'Approved') ? '1px solid rgba(34, 197, 94, 0.25)' : '1px solid rgba(56, 189, 248, 0.25)',
                    padding: '12px',
                    borderRadius: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: (kycStatusData?.Verification_Status === 'Approved') ? '#22c55e' : '#38bdf8', fontSize: '0.78rem', fontWeight: 700 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                        {(kycStatusData?.Verification_Status === 'Approved') ? 'check_circle' : 'fact_check'}
                      </span>
                      3. Admin Audit
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px' }}>
                      {(kycStatusData?.Verification_Status === 'Approved') ? 'Anti-Bias Rubric Passed' : 'Under Desk Review'}
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
                        <img
                          src={secCertUrl}
                          alt="SEC Certificate Preview"
                          style={{ maxHeight: '160px', maxWidth: '100%', objectFit: 'contain', borderRadius: '8px', cursor: 'pointer' }}
                          onClick={() => setViewingKycCert(true)}
                        />
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

                  {/* Submission Action Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <button
                      type="submit"
                      className="btn btn-primary glow pulse"
                      disabled={kycSaving || (!secRegNo.trim() && !secCertUrl)}
                      style={{ padding: '12px 28px', fontSize: '0.95rem' }}
                    >
                      {kycSaving ? <><div className="spinner" /> Transmitting KYC Documents…</> : '🚀 Submit Documents to Admin Audit Desk'}
                    </button>

                    <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
                      🛡️ All submissions are reviewed using an objective Anti-Bias Rubric.
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ── SEC Certificate Viewer Modal ── */}
          {viewingKycCert && secCertUrl && (
            <div style={{
              position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
              background: 'rgba(5, 7, 12, 0.85)', backdropFilter: 'blur(14px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999,
              padding: '24px'
            }} onClick={() => setViewingKycCert(false)}>
              <div style={{ maxWidth: '750px', width: '100%', background: '#0f172a', padding: '20px', borderRadius: '16px', border: '1px solid rgba(56, 189, 248, 0.4)', textAlign: 'center', boxShadow: '0 30px 60px rgba(0,0,0,0.8)' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="material-symbols-outlined">verified</span>
                    Official SEC Certificate of Incorporation Document
                  </h3>
                  <button
                    onClick={() => setViewingKycCert(false)}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>
                <img
                  src={secCertUrl}
                  alt="SEC Certificate"
                  style={{ width: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}
                />
                <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
                  <button className="btn btn-outline btn-sm" onClick={() => setViewingKycCert(false)}>Close Document</button>
                </div>
              </div>
            </div>
          )}

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
                <h3 style={{ marginBottom: '8px', color: 'var(--text)' }}>Awaiting Signature</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Please open MetaMask and securely sign the transaction to deploy your new campaign.</p>
              </div>
            )}

            {txModal.step === 2 && (
              <div className="fade-in" style={{ textAlign: 'center', padding: '40px 0' }}>
                <div className="spinner" style={{ width: '40px', height: '40px', margin: '0 auto 20px', borderColor: 'var(--secondary)', borderRightColor: 'transparent' }}></div>
                <h3 style={{ marginBottom: '8px', color: 'var(--text)' }}>Deploying Campaign</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>Mining your structural contract across the Sepolia network.</p>
                <div style={{ padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', fontSize: '0.75rem', wordBreak: 'break-all', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Transaction Hash:</span>
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
                  Your relief campaign has been permanently deployed on the immutable blockchain.
                </p>
                <div style={{ margin: '24px 0', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', textAlign: 'left', border: '1px solid rgba(0,255,100,0.1)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>Verified Block Receipt</div>
                  <a href={`https://sepolia.etherscan.io/tx/${txModal.hash}`} target="_blank" rel="noreferrer" style={{ color: 'var(--success)', textDecoration: 'none', wordBreak: 'break-all', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>open_in_new</span> {txModal.hash.slice(0, 20)}...
                  </a>
                </div>
                <button className="btn btn-primary btn-full pulse" onClick={() => { setTxModal({ show: false, step: 0, hash: '', type: '', error: '' }); setActiveTab('my-campaigns'); }}>Complete</button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
