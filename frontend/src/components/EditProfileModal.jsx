import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './EditProfileModal.css';
import VercelIcon from './VercelIcon';
import { useToast } from '../context/ToastContext';
import { regions as fetchRegions, provinces as fetchProvinces, cities as fetchCities, barangays as fetchBarangays } from 'select-philippines-address';
import { autoCropQrScreenshot, extractQrVoucherText } from '../utils/qrCropper';
import { formatPhoneNumber } from '../utils/formatters';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const PROHIBITED_WORDS = [
  'sex', 'sexy', 'porn', 'porno', 'nude', 'naked', 'penis', 'cock', 'vagina', 'pussy', 'dick', 'boobs', 'tits', 'anal',
  'blowjob', 'handjob', 'cum', 'sperm', 'horny', 'masturbat', 'hentai', 'escort', 'onlyfans', 'dildo', 'orgasm', 'nsfw', 'erotic', 'pedophile', 'pedo',
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt', 'whore', 'slut', 'fag', 'faggot', 'nigger', 'nigga', 'retard', 'bullshit', 'motherfucker',
  'putangina', 'tangina', 'tanginamo', 'gago', 'tarantado', 'ulol', 'bobo', 'inutil', 'puta', 'leche', 'pakshet', 'tanga', 'kupal', 'pakyu', 'pokpok',
  'bayag', 'bilat', 'burat', 'puke', 'pekpek', 'kantot', 'jakol', 'tamod', 'chupa', 'hindot', 'tae', 'yawa', 'piste', 'atay', 'oten', 'giatay', 'buang',
  'admin', 'administrator', 'system', 'root', 'bbdrts_official', 'bbdrts_admin', 'official_support', 'moderator', 'staff', 'support_team', 'scammer', 'phishing', 'hacker'
];

function collapseRepeats(str) {
  return (str || '').replace(/(.)\1+/g, '$1');
}

function checkDisplayNameValidation(name) {
  if (!name || typeof name !== 'string') return '';
  const clean = name.trim();
  if (clean.length > 0 && clean.length < 3) {
    return 'Display name must be at least 3 characters long.';
  }
  if (clean.length > 35) {
    return 'Display name cannot exceed 35 characters.';
  }
  const validCharRegex = /^[a-zA-Z0-9\s._\-ñÑáéíóúÁÉÍÓÚ]+$/;
  if (clean.length > 0 && !validCharRegex.test(clean)) {
    return 'Display name can only contain letters, numbers, spaces, dots, hyphens, and underscores.';
  }

  const lower = clean.toLowerCase();
  const collapsed = collapseRepeats(lower);

  const matched = PROHIBITED_WORDS.find(w => {
    if (lower.includes(w) || collapsed.includes(w)) return true;
    return false;
  });

  if (matched) {
    return `The name contains an unauthorized or inappropriate term ("${matched}"). Please choose an appropriate public name.`;
  }

  if (
    collapsed === 'fuck' ||
    collapsed === 'shit' ||
    collapsed === 'bitch' ||
    collapsed === 'cum' ||
    collapsed === 'ass' ||
    collapsed.includes('sex')
  ) {
    return 'This display name contains prohibited or inappropriate words. Please choose an appropriate name.';
  }

  return '';
}

const DONOR_AVATAR_PRESETS = [
  { id: 'shield', icon: 'shield', label: 'Relief Guardian', color: '#22c55e' },
  { id: 'volunteer_activism', icon: 'volunteer_activism', label: 'Humanitarian Donor', color: '#38bdf8' },
  { id: 'handshake', icon: 'handshake', label: 'Community Patron', color: '#f59e0b' },
  { id: 'favorite', icon: 'favorite', label: 'Compassion Hero', color: '#ec4899' },
  { id: 'water_drop', icon: 'water_drop', label: 'Emergency Water Aid', color: '#06b6d4' },
  { id: 'medical_services', icon: 'medical_services', label: 'First Responder Partner', color: '#10b981' }
];

const NGO_BANNER_PRESETS = [
  { id: 'typhoon', label: 'Typhoon Relief Ops', gradient: 'linear-gradient(135deg, #064e3b 0%, #0f172a 100%)', icon: 'cyclone' },
  { id: 'medical', label: 'First Responder Ops', gradient: 'linear-gradient(135deg, #881337 0%, #1e1b4b 100%)', icon: 'medical_services' },
  { id: 'water', label: 'Water & Food Supply', gradient: 'linear-gradient(135deg, #0c4a6e 0%, #042f2e 100%)', icon: 'water_drop' },
  { id: 'shelter', label: 'Community Shelter', gradient: 'linear-gradient(135deg, #78350f 0%, #1e293b 100%)', icon: 'foundation' },
  { id: 'humanitarian', label: 'Red Cross Taskforce', gradient: 'linear-gradient(135deg, #1e1b4b 0%, #064e3b 100%)', icon: 'volunteer_activism' }
];

const NGO_AVATAR_PRESETS = [
  { id: 'corporate_fare', icon: 'corporate_fare', label: 'NGO Headquarters', color: '#22c55e' },
  { id: 'medical_services', icon: 'medical_services', label: 'Medical Response', color: '#ef4444' },
  { id: 'health_and_safety', icon: 'health_and_safety', label: 'Safety & Relief', color: '#38bdf8' },
  { id: 'shield', icon: 'shield', label: 'Disaster Guardian', color: '#f59e0b' },
  { id: 'volunteer_activism', icon: 'volunteer_activism', label: 'Humanitarian Volunteer', color: '#ec4899' },
  { id: 'domain', icon: 'domain', label: 'Institutional Center', color: '#10b981' }
];

export default function EditProfileModal({ currentUser, onClose, onProfileUpdated, theme, setTheme }) {
  const { showSuccess, showError, showWarning } = useToast();
  const fileInputRef = useRef(null);
  const bannerInputRef = useRef(null);
  const gcashFileInputRef = useRef(null);
  const mayaFileInputRef = useRef(null);
  const bankFileInputRef = useRef(null);
  const [saving, setSaving] = useState(false);

  const role = currentUser?.role || 'donor';
  const isOrg = role === 'organization';
  const isAdmin = role === 'admin';

  let initialLegalName = currentUser?.legal_name || currentUser?.name || '';
  if (!initialLegalName || initialLegalName.includes('@')) {
    const handle = currentUser?.email ? currentUser.email.split('@')[0] : 'Donor';
    if (handle.toLowerCase() === 'gestermacaldo') {
      initialLegalName = 'Gester Macaldo';
    } else {
      initialLegalName = handle.replace(/[\._]/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }

  let initialDisplayName = currentUser?.display_name || currentUser?.name || initialLegalName;
  if (!initialDisplayName || initialDisplayName.includes('@')) {
    initialDisplayName = initialLegalName;
  }

  // Parse preferences & granular location from JSON if exists
  let initialPrefs = {
    notifEmailReceipts: true,
    notifSmsAlerts: true,
    notifMilestones: true,
    notifReliefProof: true,
    is_anonymous: false,
    banner_url: '',
    regionCode: '',
    regionName: '',
    provinceCode: '',
    provinceName: '',
    cityCode: '',
    cityName: '',
    barangayCode: '',
    barangayName: '',
    region: '',
    province: '',
    municipality: '',
    barangay: ''
  };
  if (currentUser?.preferences) {
    try {
      const parsed = typeof currentUser.preferences === 'string' ? JSON.parse(currentUser.preferences) : currentUser.preferences;
      initialPrefs = { ...initialPrefs, ...parsed };
    } catch (_) { }
  }

  // Form State
  const [legalName] = useState(initialLegalName);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [displayNameError, setDisplayNameError] = useState('');
  const [orgName, setOrgName] = useState(currentUser?.name || currentUser?.org_name || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatar_url || '');
  const [bannerUrl, setBannerUrl] = useState(currentUser?.banner_url || initialPrefs.banner_url || '');
  const [originalImageSrc, setOriginalImageSrc] = useState(currentUser?.avatar_url || '');
  const [originalBannerSrc, setOriginalBannerSrc] = useState(currentUser?.banner_url || initialPrefs.banner_url || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [location, setLocation] = useState(currentUser?.location || '');

  const verifiedDateStr = currentUser?.verified_date
    ? new Date(currentUser.verified_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : currentUser?.verified_at
      ? new Date(currentUser.verified_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : currentUser?.created_at
        ? new Date(currentUser.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : 'October 2024';

  // Smooth Save & Close State ('idle' | 'saving' | 'success')
  const [saveState, setSaveState] = useState('idle');
  const [isClosing, setIsClosing] = useState(false);

  const [cropper, setCropper] = useState({
    active: false,
    mode: 'avatar', // 'avatar' | 'banner'
    imageSrc: null,
    zoom: 1,
    rotation: 0,
    panX: 0,
    panY: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    imgNaturalWidth: 400,
    imgNaturalHeight: 400
  });

  const cropperImgRef = useRef(null);

  const handleBannerSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      return showError('Please select a valid image file (PNG, JPG, WEBP).', 'Invalid File');
    }
    if (file.size > 15 * 1024 * 1024) {
      showWarning('Banner image exceeds 15MB limit. Please choose a smaller photo.', 'File Too Large');
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      setOriginalBannerSrc(evt.target.result);
      const img = new Image();
      img.onload = () => {
        setCropper({
          active: true,
          mode: 'banner',
          imageSrc: evt.target.result,
          zoom: 1,
          rotation: 0,
          panX: 0,
          panY: 0,
          isDragging: false,
          dragStartX: 0,
          dragStartY: 0,
          imgNaturalWidth: img.naturalWidth || 800,
          imgNaturalHeight: img.naturalHeight || 400
        });
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
    if (bannerInputRef.current) bannerInputRef.current.value = '';
  };

  // Complete 100% PSA PSGC Cascading Location Lists & Codes
  const [regionList, setRegionList] = useState([]);
  const [provinceList, setProvinceList] = useState([]);
  const [cityList, setCityList] = useState([]);
  const [barangayList, setBarangayList] = useState([]);

  const [regionCode, setRegionCode] = useState(initialPrefs.regionCode || '');
  const [regionName, setRegionName] = useState(initialPrefs.regionName || initialPrefs.region || '');
  const [provinceCode, setProvinceCode] = useState(initialPrefs.provinceCode || '');
  const [provinceName, setProvinceName] = useState(initialPrefs.provinceName || initialPrefs.province || '');
  const [cityCode, setCityCode] = useState(initialPrefs.cityCode || '');
  const [cityName, setCityName] = useState(initialPrefs.cityName || initialPrefs.municipality || '');
  const [barangayCode, setBarangayCode] = useState(initialPrefs.barangayCode || '');
  const [barangayName, setBarangayName] = useState(initialPrefs.barangayName || initialPrefs.barangay || '');

  // Fetch official regions and pre-load children if previously saved
  useEffect(() => {
    fetchRegions().then((data) => {
      setRegionList(data || []);
      if (initialPrefs.regionCode) {
        fetchProvinces(initialPrefs.regionCode).then((provs) => {
          setProvinceList(provs || []);
          if (initialPrefs.provinceCode) {
            fetchCities(initialPrefs.provinceCode).then((cts) => {
              setCityList(cts || []);
              if (initialPrefs.cityCode) {
                fetchBarangays(initialPrefs.cityCode).then((brgys) => {
                  setBarangayList(brgys || []);
                });
              }
            });
          }
        });
      }
    }).catch(err => console.warn('Failed to load regions:', err));
  }, []);

  const handleSmoothClose = () => {
    if (saveState === 'saving') return;
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 280);
  };

  const [notifEmailReceipts, setNotifEmailReceipts] = useState(initialPrefs.notifEmailReceipts !== false);
  const [notifSmsAlerts, setNotifSmsAlerts] = useState(initialPrefs.notifSmsAlerts !== false);
  const [notifMilestones, setNotifMilestones] = useState(initialPrefs.notifMilestones !== false);
  const [notifReliefProof, setNotifReliefProof] = useState(initialPrefs.notifReliefProof !== false);
  const [isAnonymous, setIsAnonymous] = useState(() => {
    if (currentUser?.is_anonymous !== undefined) return Boolean(currentUser.is_anonymous);
    if (initialPrefs.is_anonymous !== undefined) return Boolean(initialPrefs.is_anonymous);
    if (typeof window !== 'undefined') {
      return localStorage.getItem('bbdrts_anon_default') === 'true';
    }
    return false;
  });
  const [showBadge, setShowBadge] = useState(() => {
    if (currentUser?.show_badge !== undefined) return Boolean(currentUser.show_badge);
    if (currentUser?.hide_badge !== undefined) return !currentUser.hide_badge;
    if (initialPrefs.show_badge !== undefined) return Boolean(initialPrefs.show_badge);
    if (initialPrefs.hide_badge !== undefined) return !initialPrefs.hide_badge;
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('bbdrts_show_badge');
      if (stored !== null) return stored === 'true';
    }
    return true;
  });
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [emergencyHotline, setEmergencyHotline] = useState(currentUser?.emergency_hotline || '');
  const [website, setWebsite] = useState(currentUser?.website || initialPrefs.website || '');
  const [occupation, setOccupation] = useState(initialPrefs.occupation || '');
  const [socialLink, setSocialLink] = useState(initialPrefs.socialLink || '');
  const [preferredCauses, setPreferredCauses] = useState(initialPrefs.preferredCauses || '');
  const [emergencyContact, setEmergencyContact] = useState(initialPrefs.emergencyContact || '');
  const [missionStatement, setMissionStatement] = useState(initialPrefs.missionStatement || '');
  const [focusAreas, setFocusAreas] = useState(initialPrefs.focusAreas || '');
  const [hqLandmark, setHqLandmark] = useState(initialPrefs.hqLandmark || '');
  const [gcashName, setGcashName] = useState(currentUser?.gcash_name || initialPrefs.gcash_name || '');
  const [gcashNumber, setGcashNumber] = useState(currentUser?.gcash_number || '');
  const [gcashQrUrl, setGcashQrUrl] = useState(currentUser?.gcash_qr_url || initialPrefs.gcash_qr_url || '');
  const [mayaName, setMayaName] = useState(currentUser?.maya_name || initialPrefs.maya_name || '');
  const [mayaNumber, setMayaNumber] = useState(currentUser?.maya_number || '');
  const [mayaQrUrl, setMayaQrUrl] = useState(currentUser?.maya_qr_url || initialPrefs.maya_qr_url || '');

  // Extract structured bank fields if available
  let initBankName = currentUser?.bank_name || initialPrefs.bank_name || '';
  let initBankAccountName = currentUser?.bank_account_name || initialPrefs.bank_account_name || '';
  let initBankAccountNumber = currentUser?.bank_account_number || initialPrefs.bank_account_number || '';
  if (!initBankName && !initBankAccountNumber && currentUser?.bank_details) {
    const parts = currentUser.bank_details.split('•').map(s => s.trim());
    if (parts.length >= 2) {
      initBankName = parts[0] || '';
      const acctPart = parts.find(p => p.toLowerCase().includes('acct')) || parts[parts.length - 1];
      initBankAccountNumber = acctPart.replace(/acct:?/i, '').trim();
      if (parts.length >= 3) {
        initBankAccountName = parts[1] || '';
      }
    } else {
      initBankName = currentUser.bank_details;
    }
  }

  const [bankName, setBankName] = useState(initBankName);
  const [bankAccountName, setBankAccountName] = useState(initBankAccountName);
  const [bankAccountNumber, setBankAccountNumber] = useState(initBankAccountNumber);
  const [bankDetails, setBankDetails] = useState(currentUser?.bank_details || '');
  const [bankQrUrl, setBankQrUrl] = useState(currentUser?.bank_qr_url || initialPrefs.bank_qr_url || '');

  // ── Smart QR Auto-Cropping, OCR Extraction & Saved QR Library Integration ──
  const [isProcessingQr, setIsProcessingQr] = useState(false);
  const [savedQrLibrary, setSavedQrLibrary] = useState([]);
  const [showQrPicker, setShowQrPicker] = useState(null); // 'GCash' | 'Maya' | 'Bank' | null
  const [activePaymentChannelTab, setActivePaymentChannelTab] = useState('gcash');
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Snapshot initial form values on mount for unsaved changes detection
  const initialFormRef = useRef({
    displayName: initialDisplayName,
    orgName: currentUser?.name || currentUser?.org_name || '',
    avatarUrl: currentUser?.avatar_url || '',
    bannerUrl: currentUser?.banner_url || initialPrefs.banner_url || '',
    phone: currentUser?.phone || '',
    location: currentUser?.location || '',
    bio: currentUser?.bio || '',
    emergencyHotline: currentUser?.emergency_hotline || '',
    website: currentUser?.website || initialPrefs.website || '',
    gcashName: currentUser?.gcash_name || initialPrefs.gcash_name || '',
    gcashNumber: currentUser?.gcash_number || '',
    gcashQrUrl: currentUser?.gcash_qr_url || initialPrefs.gcash_qr_url || '',
    mayaName: currentUser?.maya_name || initialPrefs.maya_name || '',
    mayaNumber: currentUser?.maya_number || '',
    mayaQrUrl: currentUser?.maya_qr_url || initialPrefs.maya_qr_url || '',
    bankName: initBankName,
    bankAccountName: initBankAccountName,
    bankAccountNumber: initBankAccountNumber,
    bankQrUrl: currentUser?.bank_qr_url || initialPrefs.bank_qr_url || '',
    missionStatement: initialPrefs.missionStatement || '',
    focusAreas: initialPrefs.focusAreas || '',
    hqLandmark: initialPrefs.hqLandmark || ''
  });

  const isFormDirty = () => {
    const init = initialFormRef.current;
    if (!init) return false;
    return (
      displayName !== init.displayName ||
      orgName !== init.orgName ||
      avatarUrl !== init.avatarUrl ||
      bannerUrl !== init.bannerUrl ||
      phone !== init.phone ||
      location !== init.location ||
      bio !== init.bio ||
      emergencyHotline !== init.emergencyHotline ||
      website !== init.website ||
      gcashName !== init.gcashName ||
      gcashNumber !== init.gcashNumber ||
      gcashQrUrl !== init.gcashQrUrl ||
      mayaName !== init.mayaName ||
      mayaNumber !== init.mayaNumber ||
      mayaQrUrl !== init.mayaQrUrl ||
      bankName !== init.bankName ||
      bankAccountName !== init.bankAccountName ||
      bankAccountNumber !== init.bankAccountNumber ||
      bankQrUrl !== init.bankQrUrl ||
      missionStatement !== init.missionStatement ||
      focusAreas !== init.focusAreas ||
      hqLandmark !== init.hqLandmark
    );
  };

  const handleAttemptClose = () => {
    if (saveState === 'saving') return;
    if (isFormDirty()) {
      setShowDiscardConfirm(true);
    } else {
      handleSmoothClose();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (cropper.active) {
          setCropper(prev => ({ ...prev, active: false }));
          return;
        }
        if (showQrPicker) {
          setShowQrPicker(null);
          return;
        }
        if (showDiscardConfirm) {
          setShowDiscardConfirm(false);
          return;
        }
        handleAttemptClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    cropper.active, showQrPicker, showDiscardConfirm, saveState,
    displayName, orgName, avatarUrl, bannerUrl, phone, location, bio,
    emergencyHotline, website, gcashName, gcashNumber, gcashQrUrl,
    mayaName, mayaNumber, mayaQrUrl, bankName, bankAccountName, bankAccountNumber, bankQrUrl
  ]);

  useEffect(() => {
    if (isOrg) {
      const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
      fetch(`${API_URL}/api/organization/qr-codes?org_id=${currentUser?.id || 8}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      })
        .then(r => r.ok ? r.json() : [])
        .then(data => {
          if (Array.isArray(data)) setSavedQrLibrary(data);
        })
        .catch(() => {});
    }
  }, [isOrg, currentUser?.id]);

  const handleSelectFromLibrary = (qr) => {
    if (qr.payment_method === 'GCash') {
      setGcashQrUrl(qr.qr_image_url);
      if (qr.account_name) setGcashName(qr.account_name);
      if (qr.account_number) setGcashNumber(formatPhoneNumber(qr.account_number));
      showSuccess(`Assigned saved "${qr.custom_name}" GCash QR to profile!`, 'QR Applied');
    } else if (qr.payment_method === 'Maya') {
      setMayaQrUrl(qr.qr_image_url);
      if (qr.account_name) setMayaName(qr.account_name);
      if (qr.account_number) setMayaNumber(formatPhoneNumber(qr.account_number));
      showSuccess(`Assigned saved "${qr.custom_name}" Maya QR to profile!`, 'QR Applied');
    } else if (qr.payment_method === 'Bank') {
      setBankQrUrl(qr.qr_image_url);
      if (qr.account_name) setBankAccountName(qr.account_name);
      if (qr.account_number) setBankAccountNumber(formatPhoneNumber(qr.account_number));
      showSuccess(`Assigned saved "${qr.custom_name}" Bank QR to profile!`, 'QR Applied');
    }
    setShowQrPicker(null);
  };

  const handleQrUpload = async (file, setter, channelName) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showWarning('Please select a valid image file (PNG, JPG, WEBP).', 'Invalid File');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showWarning('QR Code image exceeds 8MB. Please select a smaller photo.', 'File Too Large');
      return;
    }

    setIsProcessingQr(true);
    showSuccess(`Analyzing ${channelName} image & auto-cropping voucher...`, 'Processing QR');

    try {
      const { croppedUrl, wasCropped } = await autoCropQrScreenshot(file);
      setter(croppedUrl);

      // Run OCR recipient detection on cropped QR voucher card
      try {
        const { detectedName, detectedNumber } = await extractQrVoucherText(croppedUrl);
        if (channelName === 'GCash') {
          if (detectedName && !gcashName) setGcashName(detectedName);
          if (detectedNumber && !gcashNumber) setGcashNumber(formatPhoneNumber(detectedNumber));
        } else if (channelName === 'Maya') {
          if (detectedName && !mayaName) setMayaName(detectedName);
          if (detectedNumber && !mayaNumber) setMayaNumber(formatPhoneNumber(detectedNumber));
        } else if (channelName === 'Bank') {
          if (detectedName && !bankAccountName) setBankAccountName(detectedName);
          if (detectedNumber && !bankAccountNumber) setBankAccountNumber(formatPhoneNumber(detectedNumber));
        }

        if (wasCropped && (detectedName || detectedNumber)) {
          showSuccess(`Clean ${channelName} voucher cropped and account details auto-extracted via OCR!`, 'Smart QR Auto-Cropped');
        } else if (wasCropped) {
          showSuccess(`Clean ${channelName} QR voucher extracted (mobile screenshot background cropped)!`, 'Smart QR Auto-Cropped');
        } else {
          showSuccess(`${channelName} QR Code attached successfully!`, 'QR Uploaded');
        }
      } catch (ocrErr) {
        console.warn('OCR error:', ocrErr);
        showSuccess(`${channelName} QR Code attached successfully!`, 'QR Uploaded');
      }
    } catch (cropErr) {
      console.warn('Auto-crop error, falling back to standard reader:', cropErr);
      const reader = new FileReader();
      reader.onload = (e) => {
        setter(e.target.result);
        showSuccess(`${channelName} QR Code attached!`, 'QR Uploaded');
      };
      reader.readAsDataURL(file);
    } finally {
      setIsProcessingQr(false);
    }
  };
  const [activeTab, setActiveTab] = useState(isOrg ? 'org_details' : 'persona');

  // Cascading Handlers: selecting parent resets all lower levels
  const handleRegionSelect = (e) => {
    const code = e.target.value;
    const item = regionList.find(r => r.region_code === code);
    setRegionCode(code);
    setRegionName(item ? item.region_name : '');

    setProvinceCode('');
    setProvinceName('');
    setCityCode('');
    setCityName('');
    setBarangayCode('');
    setBarangayName('');
    setProvinceList([]);
    setCityList([]);
    setBarangayList([]);

    if (code) {
      fetchProvinces(code).then(data => setProvinceList(data || [])).catch(console.warn);
    }
  };

  const handleProvinceSelect = (e) => {
    const code = e.target.value;
    const item = provinceList.find(p => p.province_code === code);
    setProvinceCode(code);
    setProvinceName(item ? item.province_name : '');

    setCityCode('');
    setCityName('');
    setBarangayCode('');
    setBarangayName('');
    setCityList([]);
    setBarangayList([]);

    if (code) {
      fetchCities(code).then(data => setCityList(data || [])).catch(console.warn);
    }
  };

  const handleCitySelect = (e) => {
    const code = e.target.value;
    const item = cityList.find(c => c.city_code === code);
    setCityCode(code);
    setCityName(item ? item.city_name : '');

    setBarangayCode('');
    setBarangayName('');
    setBarangayList([]);

    if (code) {
      fetchBarangays(code).then(data => setBarangayList(data || [])).catch(console.warn);
    }
  };

  const handleBarangaySelect = (e) => {
    const code = e.target.value;
    const item = barangayList.find(b => b.brgy_code === code);
    setBarangayCode(code);
    setBarangayName(item ? item.brgy_name : '');
  };

  // 14-Day Cooldown Calculator for Donor Display Name
  const COOLDOWN_DAYS = 14;
  const lastChangedStr = currentUser?.name_last_changed_at;
  let isCooldownActive = false;
  let daysRemaining = 0;
  let nextAvailableDateStr = '';

  if (lastChangedStr && !isOrg && !isAdmin) {
    const lastChangedTime = new Date(lastChangedStr).getTime();
    if (!isNaN(lastChangedTime)) {
      const now = Date.now();
      const cooldownMs = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
      const elapsed = now - lastChangedTime;
      if (elapsed < cooldownMs) {
        isCooldownActive = true;
        daysRemaining = Math.ceil((cooldownMs - elapsed) / (24 * 60 * 60 * 1000));
        const nextDate = new Date(lastChangedTime + cooldownMs);
        nextAvailableDateStr = nextDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      }
    }
  }

  // Handle Photo Selection -> Open 1:1 Interactive Adjuster
  const handleImageFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      return showError('Please select a valid image file (PNG, JPG, WEBP).', 'Invalid File');
    }
    if (file.size > 15 * 1024 * 1024) {
      return showWarning('Image size exceeds 15MB limit. Please choose a smaller photo.', 'File Too Large');
    }

    const reader = new FileReader();
    reader.onload = () => {
      setOriginalImageSrc(reader.result);
      const img = new Image();
      img.onload = () => {
        setCropper({
          active: true,
          mode: 'avatar',
          imageSrc: reader.result,
          zoom: 1,
          rotation: 0,
          panX: 0,
          panY: 0,
          isDragging: false,
          dragStartX: 0,
          dragStartY: 0,
          imgNaturalWidth: img.naturalWidth || 400,
          imgNaturalHeight: img.naturalHeight || 400
        });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Re-open Adjuster on Current Avatar Image without re-uploading
  const handleOpenAdjuster = () => {
    const srcToAdjust = originalImageSrc || avatarUrl;
    if (!srcToAdjust || srcToAdjust.length < 30) {
      fileInputRef.current?.click();
      return;
    }
    const img = new Image();
    img.onload = () => {
      setCropper({
        active: true,
        mode: 'avatar',
        imageSrc: srcToAdjust,
        zoom: 1,
        rotation: 0,
        panX: 0,
        panY: 0,
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0,
        imgNaturalWidth: img.naturalWidth || 400,
        imgNaturalHeight: img.naturalHeight || 400
      });
    };
    img.src = srcToAdjust;
  };

  // Re-open Adjuster on Current Cover Banner without re-uploading
  const handleOpenBannerAdjuster = () => {
    const srcToAdjust = originalBannerSrc || bannerUrl;
    if (!srcToAdjust || srcToAdjust.length < 30 || srcToAdjust.startsWith('linear-gradient')) {
      bannerInputRef.current?.click();
      return;
    }
    const img = new Image();
    img.onload = () => {
      setCropper({
        active: true,
        mode: 'banner',
        imageSrc: srcToAdjust,
        zoom: 1,
        rotation: 0,
        panX: 0,
        panY: 0,
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0,
        imgNaturalWidth: img.naturalWidth || 800,
        imgNaturalHeight: img.naturalHeight || 400
      });
    };
    img.src = srcToAdjust;
  };

  // Dynamic Viewport & Base Image Dimensions (Aspect Ratio Aware)
  const isBannerMode = cropper.mode === 'banner';
  const viewportW = isBannerMode ? 460 : 250;
  const viewportH = isBannerMode ? 155 : 250;
  const targetAspect = viewportW / viewportH;

  const isRotated90or270 = cropper.rotation === 90 || cropper.rotation === 270;
  const effectiveW = isRotated90or270 ? (cropper.imgNaturalHeight || 400) : (cropper.imgNaturalWidth || 400);
  const effectiveH = isRotated90or270 ? (cropper.imgNaturalWidth || 400) : (cropper.imgNaturalHeight || 400);
  const imgAspect = effectiveW / (effectiveH || 1);

  let baseW, baseH;
  if (imgAspect >= targetAspect) {
    baseH = viewportH;
    baseW = viewportH * imgAspect;
  } else {
    baseW = viewportW;
    baseH = viewportW / imgAspect;
  }

  // Strict Pan Clamping: Image edges will NEVER enter inside the active viewport
  const getClampedPan = (panX, panY, zoom) => {
    const currentW = baseW * zoom;
    const currentH = baseH * zoom;

    const maxPanX = Math.max(0, (currentW - viewportW) / 2);
    const maxPanY = Math.max(0, (currentH - viewportH) / 2);

    return {
      panX: Math.max(-maxPanX, Math.min(maxPanX, panX)),
      panY: Math.max(-maxPanY, Math.min(maxPanY, panY))
    };
  };

  // Pointer Capture Drag Handlers for seamless 2D drag
  const handlePointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setCropper(prev => ({
      ...prev,
      isDragging: true,
      dragStartX: e.clientX - prev.panX,
      dragStartY: e.clientY - prev.panY
    }));
  };

  const handlePointerMove = (e) => {
    if (!cropper.isDragging) return;
    const rawPanX = e.clientX - cropper.dragStartX;
    const rawPanY = e.clientY - cropper.dragStartY;
    const clamped = getClampedPan(rawPanX, rawPanY, cropper.zoom);
    setCropper(prev => ({
      ...prev,
      panX: clamped.panX,
      panY: clamped.panY
    }));
  };

  const handlePointerUp = (e) => {
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) { }
    setCropper(prev => ({ ...prev, isDragging: false }));
  };

  // Zoom Handler with automatic pan boundary re-clamping
  const handleZoomChange = (newZoom) => {
    const targetZoom = Math.min(3.5, Math.max(1.0, +newZoom.toFixed(2)));
    setCropper(prev => {
      const clamped = getClampedPan(prev.panX, prev.panY, targetZoom);
      return {
        ...prev,
        zoom: targetZoom,
        panX: clamped.panX,
        panY: clamped.panY
      };
    });
  };

  // Mouse Wheel Zoom
  const handleWheelZoom = (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    handleZoomChange(cropper.zoom + delta);
  };

  // Rotate 90 Degrees Clockwise
  const handleRotate = () => {
    setCropper(prev => ({
      ...prev,
      rotation: (prev.rotation + 90) % 360,
      panX: 0,
      panY: 0
    }));
  };

  // Reset Adjuster
  const handleResetAdjuster = () => {
    setCropper(prev => ({
      ...prev,
      zoom: 1,
      rotation: 0,
      panX: 0,
      panY: 0
    }));
  };

  // Confirm Crop / Framing using HTML5 Canvas
  const handleApplyCrop = () => {
    try {
      const canvas = document.createElement('canvas');
      const outW = isBannerMode ? 1200 : 300;
      const outH = isBannerMode ? 400 : 300;
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');

      const img = cropperImgRef.current;
      if (!img) return;

      const scale = cropper.zoom;

      ctx.save();
      // Translate to canvas center for rotation & scaling
      ctx.translate(outW / 2, outH / 2);
      ctx.rotate((cropper.rotation * Math.PI) / 180);
      ctx.scale(scale, scale);

      // Draw image centered with user clamped pan offset
      const ratio = outW / viewportW;
      const drawX = (-baseW / 2 + cropper.panX / scale) * ratio;
      const drawY = (-baseH / 2 + cropper.panY / scale) * ratio;
      const drawW = baseW * ratio;
      const drawH = baseH * ratio;

      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();

      const croppedBase64 = canvas.toDataURL('image/jpeg', 0.92);
      if (isBannerMode) {
        setBannerUrl(croppedBase64);
        showSuccess('Cover banner framed and ready to save.', 'Banner Ready');
      } else {
        setAvatarUrl(croppedBase64);
        showSuccess('Profile photo framed and ready to save.', 'Photo Ready');
      }
      setCropper(prev => ({ ...prev, active: false, imageSrc: null }));
    } catch (err) {
      console.error('Crop failed:', err);
      showError('Failed to process image adjustment.', 'Adjustment Error');
    }
  };

  const handleRemovePhoto = () => {
    setAvatarUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isOrg) {
      const clientErr = checkDisplayNameValidation(displayName);
      if (clientErr) {
        setDisplayNameError(clientErr);
        return;
      }
    }

    setSaveState('saving');
    setDisplayNameError('');

    const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
    try {
      const constructedLocation = [
        barangayName ? `Brgy. ${barangayName}` : '',
        cityName,
        provinceName,
        regionName
      ].filter(Boolean).join(', ');

      const payload = isOrg
        ? {
          id: currentUser?.id,
          email: currentUser?.email,
          role: 'organization',
          name: orgName,
          phone,
          location: constructedLocation || location,
          bio,
          avatar_url: avatarUrl,
          banner_url: bannerUrl,
          emergency_hotline: emergencyHotline,
          website,
          gcash_name: gcashName,
          gcash_number: gcashNumber,
          gcash_qr_url: gcashQrUrl,
          maya_name: mayaName,
          maya_number: mayaNumber,
          maya_qr_url: mayaQrUrl,
          bank_name: bankName,
          bank_account_name: bankAccountName,
          bank_account_number: bankAccountNumber,
          bank_details: [bankName, bankAccountName, bankAccountNumber ? `Acct: ${bankAccountNumber}` : ''].filter(Boolean).join(' • ') || bankDetails,
          bank_qr_url: bankQrUrl,
          preferences: JSON.stringify({
            regionCode,
            regionName,
            provinceCode,
            provinceName,
            cityCode,
            cityName,
            barangayCode,
            barangayName,
            region: regionName,
            province: provinceName,
            municipality: cityName,
            barangay: barangayName,
            phone_verified: true,
            banner_url: bannerUrl || '',
            gcash_name: gcashName,
            gcash_number: gcashNumber,
            gcash_qr_url: gcashQrUrl || '',
            maya_name: mayaName,
            maya_number: mayaNumber,
            maya_qr_url: mayaQrUrl || '',
            bank_name: bankName,
            bank_account_name: bankAccountName,
            bank_account_number: bankAccountNumber,
            bank_details: [bankName, bankAccountName, bankAccountNumber ? `Acct: ${bankAccountNumber}` : ''].filter(Boolean).join(' • ') || bankDetails,
            bank_qr_url: bankQrUrl || '',
            notifEmailReceipts,
            notifSmsAlerts,
            notifMilestones,
            notifReliefProof,
            website,
            occupation,
            socialLink,
            preferredCauses,
            missionStatement,
            focusAreas,
            hqLandmark,
            emergencyHotline,
            emergencyContact
          })
        }
        : {
          id: currentUser?.id,
          email: currentUser?.email,
          role: 'donor',
          name: isCooldownActive ? (currentUser?.display_name || currentUser?.name) : displayName,
          display_name: isCooldownActive ? (currentUser?.display_name || currentUser?.name) : displayName,
          avatar_url: avatarUrl,
          phone,
          location: constructedLocation || location,
          bio,
          is_anonymous: isAnonymous,
          show_badge: showBadge,
          hide_badge: !showBadge,
          preferences: JSON.stringify({
            regionCode,
            regionName,
            provinceCode,
            provinceName,
            cityCode,
            cityName,
            barangayCode,
            barangayName,
            region: regionName,
            province: provinceName,
            municipality: cityName,
            barangay: barangayName,
            phone_verified: true,
            is_anonymous: isAnonymous,
            anonymous: isAnonymous,
            show_badge: showBadge,
            hide_badge: !showBadge,
            notifEmailReceipts,
            notifSmsAlerts,
            notifMilestones,
            notifReliefProof,
            website,
            occupation,
            socialLink,
            preferredCauses,
            missionStatement,
            focusAreas,
            hqLandmark,
            emergencyHotline,
            emergencyContact
          })
        };

      const res = await fetch(`${API_URL}/api/auth/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        setSaveState('idle');
        const errorMsg = data.error || 'Failed to update profile.';
        if (!isOrg) {
          setDisplayNameError(errorMsg);
        } else {
          showError(errorMsg, 'Update Failed');
        }
        return;
      }

      setSaveState('success');
      showSuccess('Profile updated successfully!', 'Profile Saved');

      if (data.user) {
        try {
          localStorage.setItem('bbdrts_user', JSON.stringify(data.user));
          localStorage.setItem('bbdrts_anon_default', String(isAnonymous));
          localStorage.setItem('bbdrts_show_badge', String(showBadge));
          if (data.user?.id || data.user?.email) {
            localStorage.setItem(`bbdrts_anon_default_${data.user.id || data.user.email}`, String(isAnonymous));
            localStorage.setItem(`bbdrts_show_badge_${data.user.id || data.user.email}`, String(showBadge));
          }
        } catch (_) { }
        window.dispatchEvent(new CustomEvent('bbdrts_profile_updated', { detail: data.user }));
      }
      if (onProfileUpdated && data.user) {
        onProfileUpdated(data.user);
      }

      // Smooth visual confirmation before closing
      setTimeout(() => {
        setIsClosing(true);
        setTimeout(() => {
          onClose();
        }, 280);
      }, 650);

    } catch (err) {
      setSaveState('idle');
      console.error('Profile update error:', err);
      if (!isOrg && err.message) {
        setDisplayNameError(err.message);
      } else {
        showError(err.message || 'Failed to update profile.', 'Update Failed');
      }
    }
  };

  const userInitials = (isOrg ? (orgName || currentUser?.name || 'NGO') : (displayName || legalName || currentUser?.email || 'US'))
    .replace('@gmail.com', '')
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  // Render via createPortal directly into document.body to ensure perfect center alignment
  return createPortal(
    <div className={`bbdrts-edit-profile-backdrop ${isClosing ? 'closing' : ''}`} onClick={handleAttemptClose} data-theme={theme}>
      <div className="bbdrts-profile-studio-modal" onClick={e => e.stopPropagation()}>

        {/* ── Minimal Vercel Studio Header ── */}
        <div className="bbdrts-studio-header epm2-header">
          <div className="epm2-header-copy">
            <h3>{isOrg ? 'Edit Organization Profile' : 'Edit Profile'}</h3>
            <p>
              {isOrg
                ? 'Manage institutional identity, hotlines, payout rails, and accreditation.'
                : 'Manage your public display name, photo, contact details, and relief profile.'}
            </p>
          </div>
          <div className="epm2-header-right">
            <span className="epm2-kbd" title="Press ESC to close">ESC</span>
            <button type="button" className="epm2-close-btn" onClick={handleAttemptClose} aria-label="Close">
              <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>close</span>
            </button>
          </div>
        </div>

        {/* ── 2-Column Vercel Studio Body (Left Navigation Rail + Right Content Canvas) ── */}
        <div className="bbdrts-studio-body epm2-body">

          {/* Left Navigation Rail */}
          <aside className="bbdrts-studio-sidebar epm2-sidebar">
            <div className="epm2-nav-group">
              <span className="epm2-nav-heading">{isOrg ? 'Organization' : 'Profile'}</span>

              {!isOrg && !isAdmin ? (
                <>
                  <button
                    type="button"
                    className={`epm2-nav-item ${activeTab === 'persona' ? 'active' : ''}`}
                    onClick={() => setActiveTab('persona')}
                  >
                    <span className="material-symbols-outlined">person</span>
                    <span>Public Profile</span>
                  </button>
                  <button
                    type="button"
                    className={`epm2-nav-item ${activeTab === 'contact' ? 'active' : ''}`}
                    onClick={() => setActiveTab('contact')}
                  >
                    <span className="material-symbols-outlined">call</span>
                    <span>Contact &amp; Location</span>
                  </button>
                  <button
                    type="button"
                    className={`epm2-nav-item ${activeTab === 'additional' ? 'active' : ''}`}
                    onClick={() => setActiveTab('additional')}
                  >
                    <span className="material-symbols-outlined">badge</span>
                    <span>Additional Info</span>
                  </button>
                  <button
                    type="button"
                    className={`epm2-nav-item ${activeTab === 'verified' ? 'active' : ''}`}
                    onClick={() => setActiveTab('verified')}
                  >
                    <span className="material-symbols-outlined">verified_user</span>
                    <span>Verified Identity</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className={`epm2-nav-item ${activeTab === 'org_details' ? 'active' : ''}`}
                    onClick={() => setActiveTab('org_details')}
                  >
                    <span className="material-symbols-outlined">corporate_fare</span>
                    <span>Organization Profile</span>
                  </button>
                  <button
                    type="button"
                    className={`epm2-nav-item ${activeTab === 'org_contact' ? 'active' : ''}`}
                    onClick={() => setActiveTab('org_contact')}
                  >
                    <span className="material-symbols-outlined">support_agent</span>
                    <span>Hotlines &amp; Location</span>
                  </button>
                  <button
                    type="button"
                    className={`epm2-nav-item ${activeTab === 'org_additional' ? 'active' : ''}`}
                    onClick={() => setActiveTab('org_additional')}
                  >
                    <span className="material-symbols-outlined">info</span>
                    <span>Additional Info</span>
                  </button>
                  <button
                    type="button"
                    className={`epm2-nav-item ${activeTab === 'org_payments' ? 'active' : ''}`}
                    onClick={() => setActiveTab('org_payments')}
                  >
                    <span className="material-symbols-outlined">account_balance_wallet</span>
                    <span>Payout Rails</span>
                  </button>
                  <button
                    type="button"
                    className={`epm2-nav-item ${activeTab === 'org_kyc' ? 'active' : ''}`}
                    onClick={() => setActiveTab('org_kyc')}
                  >
                    <span className="material-symbols-outlined">verified</span>
                    <span>Accreditation</span>
                  </button>
                </>
              )}
            </div>

            {/* Subtle Account Identity Anchor at Bottom of Rail */}
            <div className="epm2-sidebar-foot">
              <div className="epm2-mini-card">
                <div className="epm2-mini-avatar">
                  {avatarUrl && (avatarUrl.startsWith('data:') || avatarUrl.startsWith('http')) ? (
                    <img src={avatarUrl} alt="Avatar" />
                  ) : avatarUrl && avatarUrl.length < 30 ? (
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{avatarUrl}</span>
                  ) : (
                    userInitials
                  )}
                </div>
                <div className="epm2-mini-info">
                  <strong title={isOrg ? (orgName || displayName) : displayName}>
                    {isOrg ? (orgName || displayName) : displayName}
                  </strong>
                  <span className="epm2-mini-id">
                    <span className="epm2-dot" />
                    <span>BBDRTS-{isOrg ? 'NGO' : 'DONOR'}-2026</span>
                  </span>
                </div>
              </div>
            </div>
          </aside>

          {/* Right Content Canvas */}
          <main className="bbdrts-studio-main epm2-main">
            <form onSubmit={handleSubmit} className="bbdrts-studio-form">

              {/* Hidden Global File Inputs (Always Mounted & Available Across All Tabs) */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageFileChange}
                accept="image/png, image/jpeg, image/webp"
                style={{ display: 'none' }}
              />
              <input
                type="file"
                ref={bannerInputRef}
                onChange={handleBannerSelect}
                accept="image/png, image/jpeg, image/webp"
                style={{ display: 'none' }}
              />

              <div className="bbdrts-studio-scroll-area epm2-scroll">
                {/* ══════════════════════════════════════════════════
                    DONOR: PUBLIC PROFILE TAB
                   ══════════════════════════════════════════════════ */}
                {!isOrg && !isAdmin && activeTab === 'persona' && (
                  <div className="epm2-pane" key="epm2-persona">

                    {/* Borderless Avatar Identity Section */}
                    <div className="epm2-section">
                      <div className="epm2-avatar-row">
                        <button
                          type="button"
                          className="epm2-avatar-btn"
                          onClick={() => fileInputRef.current?.click()}
                          title="Upload profile photo"
                        >
                          <div className="epm2-avatar-circle">
                            {avatarUrl && (avatarUrl.startsWith('data:') || avatarUrl.startsWith('http')) ? (
                              <img src={avatarUrl} alt="Avatar" />
                            ) : avatarUrl && avatarUrl.length < 30 ? (
                              <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>{avatarUrl}</span>
                            ) : (
                              <span>{userInitials}</span>
                            )}
                          </div>
                          <span className="epm2-avatar-overlay">
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>photo_camera</span>
                          </span>
                        </button>

                        <div className="epm2-avatar-meta">
                          <div className="epm2-name-line">
                            <h4>{displayName || 'Donor'}</h4>
                            <span className="material-symbols-outlined epm2-verified-icon" title="Verified Donor">verified</span>
                          </div>
                          <p className="epm2-sub-line">PNG, JPG, or WEBP up to 15MB · 1:1 square recommended</p>

                          <div className="epm2-btn-row">
                            <button
                              type="button"
                              className="epm2-btn epm2-btn--solid"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              Upload Photo
                            </button>

                            {(avatarUrl || originalImageSrc) && (avatarUrl?.startsWith('data:') || avatarUrl?.startsWith('http') || originalImageSrc?.startsWith('data:') || originalImageSrc?.startsWith('http')) && (
                              <button
                                type="button"
                                className="epm2-btn epm2-btn--outline"
                                onClick={handleOpenAdjuster}
                                title="Adjust zoom, pan, and rotation"
                              >
                                Adjust Framing
                              </button>
                            )}

                            {avatarUrl && (
                              <button
                                type="button"
                                className="epm2-btn epm2-btn--ghost-danger"
                                onClick={handleRemovePhoto}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Monochrome Supporter Icon Presets */}
                      <div className="epm2-preset-bar">
                        <span className="epm2-preset-lbl">Or choose an icon badge</span>
                        <div className="epm2-preset-list">
                          {DONOR_AVATAR_PRESETS.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              className={`epm2-preset-btn ${avatarUrl === p.icon ? 'active' : ''}`}
                              onClick={() => setAvatarUrl(p.icon)}
                              title={p.label}
                            >
                              <span className="material-symbols-outlined">{p.icon}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Public Display Name Section */}
                    <div className="epm2-section">
                      <div className="epm2-field-head">
                        <div>
                          <label htmlFor="epm2-donor-name" className="epm2-field-title">Public Display Name</label>
                          <p className="epm2-field-sub">Shown on public campaign donor lists, passes, and receipts.</p>
                        </div>
                        {isCooldownActive ? (
                          <span className="epm2-status-pill is-warn" title={`Cooldown in effect until ${nextAvailableDateStr}`}>
                            <span className="epm2-dot is-warn" />
                            <span>Cooldown · {nextAvailableDateStr}</span>
                          </span>
                        ) : (
                          <span className="epm2-status-pill">
                            <span className="epm2-dot" />
                            <span>Editable</span>
                          </span>
                        )}
                      </div>

                      <input
                        id="epm2-donor-name"
                        type="text"
                        className={`epm2-input ${isCooldownActive ? 'is-disabled' : ''} ${displayNameError ? 'is-error' : ''}`}
                        value={displayName}
                        onChange={e => {
                          const val = e.target.value;
                          setDisplayName(val);
                          setDisplayNameError(checkDisplayNameValidation(val));
                        }}
                        placeholder="e.g. ReliefPatron, LeyteRelief"
                        disabled={isCooldownActive}
                        required
                      />

                      {displayNameError ? (
                        <p className="epm2-error-text">{displayNameError}</p>
                      ) : (
                        <p className="epm2-note-text">
                          {isCooldownActive
                            ? `Display name changes are limited to once every ${COOLDOWN_DAYS} days. Photos can be changed anytime.`
                            : `3–35 characters. Updating starts a ${COOLDOWN_DAYS}-day security cooldown.`}
                        </p>
                      )}
                    </div>

                    {/* Personal Bio Section */}
                    <div className="epm2-section">
                      <div className="epm2-field-head">
                        <div>
                          <label htmlFor="epm2-donor-bio" className="epm2-field-title">Bio / Supporter Note</label>
                          <p className="epm2-field-sub">Share a short message about your humanitarian focus.</p>
                        </div>
                      </div>
                      <textarea
                        id="epm2-donor-bio"
                        className="epm2-textarea"
                        rows="3"
                        value={bio}
                        onChange={e => setBio(e.target.value)}
                        placeholder="e.g. Supporting transparent disaster response across Eastern Visayas..."
                      />
                    </div>

                  </div>
                )}

                {/* ══════════════════════════════════════════════════
                  DONOR: CONTACT & REGION TAB (CASCADING PSGC)
                 ══════════════════════════════════════════════════ */}
                {!isOrg && !isAdmin && activeTab === 'contact' && (
                  <div className="bbdrts-studio-pane fade-in">

                    <div className="bbdrts-studio-card">
                      <div className="bbdrts-studio-card-header">
                        <div className="bbdrts-studio-card-title-wrap">
                          <div className="bbdrts-studio-card-icon-box">
                            <span className="material-symbols-outlined">contact_phone</span>
                          </div>
                          <div>
                            <h5>Contact Information & Region</h5>
                            <span>Select your Region, Province, Municipality, and Barangay for localized disaster matching.</span>
                          </div>
                        </div>
                      </div>

                      {/* Primary Mobile Contact Number */}
                      <div className="bbdrts-studio-field-box">
                        <label className="bbdrts-studio-label">Primary Mobile Contact Number</label>
                        <div className="bbdrts-input-icon-wrap">
                          <span className="bbdrts-input-prefix-flag">🇵🇭 +63</span>
                          <input
                            type="tel"
                            className="bbdrts-studio-input with-prefix"
                            value={phone ? phone.replace(/^\+63\s*/, '').replace(/^0+/, '') : ''}
                            onChange={e => {
                              const raw = e.target.value.replace(/[^0-9]/g, '');
                              const cleaned = raw.replace(/^0+/, '');
                              setPhone(cleaned ? `+63 ${cleaned}` : '');
                            }}
                            placeholder="912 345 6789"
                          />
                        </div>
                        <span className="bbdrts-status-hint">Direct contact for dispatch alerts and relief verification updates.</span>
                      </div>

                      {/* Cascading 1 & 2: Region then Province */}
                      <div className="bbdrts-studio-grid-2">
                        <div className="bbdrts-studio-field-box">
                          <label className="bbdrts-studio-label">1. Region</label>
                          <div className="bbdrts-input-icon-wrap">
                            <span className="material-symbols-outlined bbdrts-input-icon">map</span>
                            <select
                              className="bbdrts-studio-select"
                              value={regionCode}
                              onChange={handleRegionSelect}
                            >
                              <option value="">
                                {regionList.length > 0 ? `-- Select Region (${regionList.length} Total) --` : 'Loading Philippine Regions...'}
                              </option>
                              {regionList.map((r) => (
                                <option key={r.region_code} value={r.region_code}>
                                  {r.region_name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <span className="bbdrts-status-hint">Official PSA administrative region.</span>
                        </div>

                        <div className="bbdrts-studio-field-box">
                          <label className="bbdrts-studio-label">2. Province</label>
                          <div className="bbdrts-input-icon-wrap">
                            <span className="material-symbols-outlined bbdrts-input-icon">location_city</span>
                            <select
                              className="bbdrts-studio-select"
                              value={provinceCode}
                              onChange={handleProvinceSelect}
                              disabled={!regionCode || provinceList.length === 0}
                            >
                              <option value="">
                                {regionCode
                                  ? (provinceList.length > 0
                                    ? `-- Select Province (${provinceList.length}) --`
                                    : 'No Provinces in Region / Independent District')
                                  : '-- Select Region First --'}
                              </option>
                              {provinceList.map((p) => (
                                <option key={p.province_code} value={p.province_code}>
                                  {p.province_name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <span className="bbdrts-status-hint">
                            {regionName ? `Provinces / Districts in ${regionName}` : 'Select a Region first.'}
                          </span>
                        </div>
                      </div>

                      {/* Cascading 3 & 4: Municipality then Barangay */}
                      <div className="bbdrts-studio-grid-2">
                        <div className="bbdrts-studio-field-box">
                          <label className="bbdrts-studio-label">3. Municipality / City</label>
                          <div className="bbdrts-input-icon-wrap">
                            <span className="material-symbols-outlined bbdrts-input-icon">domain</span>
                            <select
                              className="bbdrts-studio-select"
                              value={cityCode}
                              onChange={handleCitySelect}
                              disabled={!provinceCode || cityList.length === 0}
                            >
                              <option value="">
                                {provinceCode
                                  ? (cityList.length > 0
                                    ? `-- Select Municipality / City (${cityList.length}) --`
                                    : 'No Cities/Municipalities Found')
                                  : '-- Select Province First --'}
                              </option>
                              {cityList.map((c) => (
                                <option key={c.city_code} value={c.city_code}>
                                  {c.city_name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <span className="bbdrts-status-hint">
                            {provinceName ? `Cities & Municipalities in ${provinceName}` : 'Select a Province first.'}
                          </span>
                        </div>

                        <div className="bbdrts-studio-field-box">
                          <label className="bbdrts-studio-label">4. Barangay</label>
                          <div className="bbdrts-input-icon-wrap">
                            <span className="material-symbols-outlined bbdrts-input-icon">location_on</span>
                            <select
                              className="bbdrts-studio-select"
                              value={barangayCode}
                              onChange={handleBarangaySelect}
                              disabled={!cityCode || barangayList.length === 0}
                            >
                              <option value="">
                                {cityCode
                                  ? (barangayList.length > 0
                                    ? `-- Select Barangay (${barangayList.length}) --`
                                    : 'No Barangays Found')
                                  : '-- Select Municipality First --'}
                              </option>
                              {barangayList.map((b) => (
                                <option key={b.brgy_code} value={b.brgy_code}>
                                  {b.brgy_name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <span className="bbdrts-status-hint">
                            {cityName ? `Barangays in ${cityName}` : 'Select a Municipality first.'}
                          </span>
                        </div>
                      </div>

                      {/* Emergency SMS Alerts Toggle */}
                      <div className="bbdrts-sms-toggles-list" style={{ marginTop: '4px' }}>
                        <label className="bbdrts-toggle-row">
                          <div className="bbdrts-toggle-meta">
                            <strong>Receive Emergency SMS & On-Chain Receipts</strong>
                            <span>Get SMS alerts for critical regional disaster campaigns and on-chain donation receipts.</span>
                          </div>
                          <input
                            type="checkbox"
                            className="bbdrts-switch-checkbox"
                            checked={notifSmsAlerts}
                            onChange={e => setNotifSmsAlerts(e.target.checked)}
                          />
                        </label>
                      </div>

                    </div>

                  </div>
                )}

                {/* ══════════════════════════════════════════════════
                  DONOR: VERIFIED IDENTITY TAB
                 ══════════════════════════════════════════════════ */}
                {!isOrg && !isAdmin && activeTab === 'additional' && (
                  <div className="bbdrts-studio-pane fade-in">
                    <div className="bbdrts-studio-card">
                      <div className="bbdrts-studio-card-header">
                        <div className="bbdrts-studio-card-title-wrap">
                          <div className="bbdrts-studio-card-icon-box">
                            <span className="material-symbols-outlined">badge</span>
                          </div>
                          <div>
                            <h5>Additional Background & Humanitarian Profile (Optional)</h5>
                            <span>Share optional details to help communities and NGOs better recognize your humanitarian contributions.</span>
                          </div>
                        </div>
                      </div>

                      <div className="bbdrts-studio-field-box">
                        <label className="bbdrts-studio-label">
                          Occupation / Profession
                          <span className="bbdrts-opt-tag" style={{ marginLeft: '6px', fontSize: '0.68rem', opacity: 0.65 }}>(Optional)</span>
                        </label>
                        <div className="bbdrts-input-icon-wrap">
                          <span className="material-symbols-outlined bbdrts-input-icon">work</span>
                          <input
                            type="text"
                            className="bbdrts-studio-input"
                            value={occupation}
                            onChange={e => setOccupation(e.target.value)}
                            placeholder="e.g. Software Engineer, Healthcare Worker, Educator"
                            maxLength={80}
                          />
                        </div>
                        <span className="bbdrts-status-hint">Optional profession for contributor background.</span>
                      </div>

                      <div className="bbdrts-studio-field-box">
                        <label className="bbdrts-studio-label">
                          Personal Website or Portfolio
                          <span className="bbdrts-opt-tag" style={{ marginLeft: '6px', fontSize: '0.68rem', opacity: 0.65 }}>(Optional)</span>
                        </label>
                        <div className="bbdrts-input-icon-wrap">
                          <span className="material-symbols-outlined bbdrts-input-icon">language</span>
                          <input
                            type="url"
                            className="bbdrts-studio-input"
                            value={website}
                            onChange={e => setWebsite(e.target.value)}
                            placeholder="https://yourwebsite.com"
                            maxLength={160}
                          />
                        </div>
                        <span className="bbdrts-status-hint">Link to your personal homepage, portfolio, or foundation page.</span>
                      </div>

                      <div className="bbdrts-studio-field-box">
                        <label className="bbdrts-studio-label">
                          Social Media Profile / Handle
                          <span className="bbdrts-opt-tag" style={{ marginLeft: '6px', fontSize: '0.68rem', opacity: 0.65 }}>(Optional)</span>
                        </label>
                        <div className="bbdrts-input-icon-wrap">
                          <span className="material-symbols-outlined bbdrts-input-icon">alternate_email</span>
                          <input
                            type="text"
                            className="bbdrts-studio-input"
                            value={socialLink}
                            onChange={e => setSocialLink(e.target.value)}
                            placeholder="@yourusername or https://linkedin.com/in/..."
                            maxLength={120}
                          />
                        </div>
                        <span className="bbdrts-status-hint">LinkedIn, X (Twitter), Facebook, or Instagram profile.</span>
                      </div>

                      <div className="bbdrts-studio-field-box">
                        <label className="bbdrts-studio-label">
                          Preferred Relief Causes
                          <span className="bbdrts-opt-tag" style={{ marginLeft: '6px', fontSize: '0.68rem', opacity: 0.65 }}>(Optional)</span>
                        </label>
                        <div className="bbdrts-input-icon-wrap">
                          <span className="material-symbols-outlined bbdrts-input-icon">favorite</span>
                          <input
                            type="text"
                            className="bbdrts-studio-input"
                            value={preferredCauses}
                            onChange={e => setPreferredCauses(e.target.value)}
                            placeholder="e.g. Typhoon Relief, Flood Evacuation, Medical Aid"
                            maxLength={120}
                          />
                        </div>
                        <span className="bbdrts-status-hint">Relief sectors you are passionate about supporting.</span>
                      </div>

                      <div className="bbdrts-studio-field-box">
                        <label className="bbdrts-studio-label">
                          Emergency Contact / Alternate Contact
                          <span className="bbdrts-opt-tag" style={{ marginLeft: '6px', fontSize: '0.68rem', opacity: 0.65 }}>(Optional)</span>
                        </label>
                        <div className="bbdrts-input-icon-wrap">
                          <span className="material-symbols-outlined bbdrts-input-icon">emergency</span>
                          <input
                            type="text"
                            className="bbdrts-studio-input"
                            value={emergencyContact}
                            onChange={e => setEmergencyContact(e.target.value)}
                            placeholder="Name & Contact (e.g. Maria Santos - 0917 123 4567)"
                            maxLength={100}
                          />
                        </div>
                        <span className="bbdrts-status-hint">Designated backup emergency contact during disaster coordination.</span>
                      </div>
                    </div>
                  </div>
                )}

                {!isOrg && !isAdmin && activeTab === 'verified' && (
                  <div className="bbdrts-studio-pane fade-in">

                    <div className="bbdrts-studio-card">
                      <div className="bbdrts-studio-card-header">
                        <div className="bbdrts-studio-card-title-wrap">
                          <div className="bbdrts-studio-card-icon-box">
                            <span className="material-symbols-outlined">shield</span>
                          </div>
                          <div>
                            <h5>Cryptographic Identity & Verified Ledger Records</h5>
                            <span>These immutable credentials authenticate your on-chain donation receipts.</span>
                          </div>
                        </div>
                      </div>

                      <div className="bbdrts-studio-credentials-list">
                        {/* Legal Name */}
                        <div className="bbdrts-studio-cred-row">
                          <div className="bbdrts-studio-cred-meta">
                            <span className="bbdrts-studio-cred-label">Registered Legal Name</span>
                            <span className="bbdrts-studio-cred-val">{legalName}</span>
                          </div>
                          <span className="bbdrts-permanent-badge-inline">
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>lock</span>
                            Permanent Identity
                          </span>
                        </div>

                        {/* Email */}
                        <div className="bbdrts-studio-cred-row">
                          <div className="bbdrts-studio-cred-meta">
                            <span className="bbdrts-studio-cred-label">Account Email</span>
                            <span className="bbdrts-studio-cred-val">{currentUser?.email || 'Not provided'}</span>
                          </div>
                          <span className="bbdrts-verified-badge-inline">
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>verified</span>
                            Verified Email
                          </span>
                        </div>

                        {/* Gasless Blockchain Audit Status */}
                        <div className="bbdrts-studio-cred-row">
                          <div className="bbdrts-studio-cred-meta">
                            <span className="bbdrts-studio-cred-label">Blockchain Audit Trail</span>
                            <span className="bbdrts-studio-cred-val">
                              Gasless Ethereum Sepolia Notarization Active (No Wallet Required)
                            </span>
                          </div>
                          <span className="bbdrts-verified-badge-inline">
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>verified</span>
                            Active
                          </span>
                        </div>
                      </div>
                    </div>

                  </div>
                )}

                {/* ══════════════════════════════════════════════════
                  DONOR: NOTIFICATION PREFERENCES TAB
                 ══════════════════════════════════════════════════ */}
                {!isOrg && !isAdmin && activeTab === 'notifications' && (
                  <div className="bbdrts-studio-pane fade-in">
                    <div className="bbdrts-studio-card">
                      <div className="bbdrts-studio-card-header">
                        <div className="bbdrts-studio-card-title-wrap">
                          <div className="bbdrts-studio-card-icon-box">
                            <span className="material-symbols-outlined">notifications</span>
                          </div>
                          <div>
                            <h5>Disaster & Ledger Notification Channels</h5>
                            <span>Configure which event alerts are dispatched to your email and phone.</span>
                          </div>
                        </div>
                      </div>

                      <div className="bbdrts-sms-toggles-list">
                        <label className="bbdrts-toggle-row">
                          <div className="bbdrts-toggle-meta">
                            <strong>Email Donation Receipts & Tax Summaries</strong>
                            <span>Send official cryptographic donation certificates to {currentUser?.email}.</span>
                          </div>
                          <input
                            type="checkbox"
                            className="bbdrts-switch-checkbox"
                            checked={notifEmailReceipts}
                            onChange={e => setNotifEmailReceipts(e.target.checked)}
                          />
                        </label>

                        <label className="bbdrts-toggle-row">
                          <div className="bbdrts-toggle-meta">
                            <strong>Critical Calamity Warnings (Signal 3+ / M6.0+ Quake)</strong>
                            <span>Receive priority SMS dispatches when severe disaster campaigns launch in your region.</span>
                          </div>
                          <input
                            type="checkbox"
                            className="bbdrts-switch-checkbox"
                            checked={notifSmsAlerts}
                            onChange={e => setNotifSmsAlerts(e.target.checked)}
                          />
                        </label>

                        <label className="bbdrts-toggle-row">
                          <div className="bbdrts-toggle-meta">
                            <strong>Campaign Milestone & Escrow Release Alerts</strong>
                            <span>Notify me when smart contract fund milestones are verified and released to NGOs.</span>
                          </div>
                          <input
                            type="checkbox"
                            className="bbdrts-switch-checkbox"
                            checked={notifMilestones}
                            onChange={e => setNotifMilestones(e.target.checked)}
                          />
                        </label>

                        <label className="bbdrts-toggle-row">
                          <div className="bbdrts-toggle-meta">
                            <strong>Beneficiary Proof of Delivery Updates</strong>
                            <span>Notify me when field officers upload photo proof of aid distribution to affected families.</span>
                          </div>
                          <input
                            type="checkbox"
                            className="bbdrts-switch-checkbox"
                            checked={notifReliefProof}
                            onChange={e => setNotifReliefProof(e.target.checked)}
                          />
                        </label>

                        <label className="bbdrts-toggle-row">
                          <div className="bbdrts-toggle-meta">
                            <strong>Anonymous Mode & Leaderboard Privacy</strong>
                            <span>Mask your public persona as "Anonymous" on honor rolls, rankings, and public searches.</span>
                          </div>
                          <input
                            type="checkbox"
                            className="bbdrts-switch-checkbox"
                            checked={isAnonymous}
                            onChange={e => setIsAnonymous(e.target.checked)}
                          />
                        </label>

                        <label className="bbdrts-toggle-row">
                          <div className="bbdrts-toggle-meta">
                            <strong>Display Merit Badge on Public Ledgers</strong>
                            <span>Show your cumulative honors tier medal on public receipts and the leaderboard (your name remains visible even when disabled).</span>
                          </div>
                          <input
                            type="checkbox"
                            className="bbdrts-switch-checkbox"
                            checked={showBadge}
                            onChange={e => setShowBadge(e.target.checked)}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* ══════════════════════════════════════════════════
                  DONOR: APPEARANCE & THEME TAB
                 ══════════════════════════════════════════════════ */}
                {/* ══════════════════════════════════════════════════
                  APPEARANCE & THEME TAB (UNIVERSAL)
                 ══════════════════════════════════════════════════ */}
                {activeTab === 'appearance' && (
                  <div className="bbdrts-studio-pane fade-in">
                    <div className="bbdrts-studio-card">
                      <div className="bbdrts-studio-card-header">
                        <div className="bbdrts-studio-card-title-wrap">
                          <div className="bbdrts-studio-card-icon-box">
                            <span className="material-symbols-outlined">palette</span>
                          </div>
                          <div>
                            <h5>Visual Appearance & Theme</h5>
                            <span>Select your preferred visual palette across the BBDRTS relief ecosystem.</span>
                          </div>
                        </div>
                      </div>

                      <div className="bbdrts-theme-selection-grid">
                        {/* Light Mode (Default) */}
                        <div
                          className={`bbdrts-theme-choice-card ${theme === 'light' ? 'active' : ''}`}
                          onClick={() => {
                            if (setTheme) setTheme('light');
                            document.documentElement.setAttribute('data-theme', 'light');
                            localStorage.setItem('bbdrts_theme', 'light');
                          }}
                        >
                          <div className="bbdrts-theme-preview-box light">
                            <span className="material-symbols-outlined">light_mode</span>
                          </div>
                          <div className="bbdrts-theme-choice-info">
                            <div className="bbdrts-theme-choice-title">
                              <strong>Light Mode (Default)</strong>
                              {theme === 'light' && <span className="bbdrts-theme-active-tag">Active</span>}
                            </div>
                            <span>Clean, spacious white canvas with soft borders and readable typography.</span>
                          </div>
                        </div>

                        {/* Dark Mode */}
                        <div
                          className={`bbdrts-theme-choice-card ${theme === 'dark' ? 'active' : ''}`}
                          onClick={() => {
                            if (setTheme) setTheme('dark');
                            document.documentElement.setAttribute('data-theme', 'dark');
                            localStorage.setItem('bbdrts_theme', 'dark');
                          }}
                        >
                          <div className="bbdrts-theme-preview-box dark">
                            <span className="material-symbols-outlined">dark_mode</span>
                          </div>
                          <div className="bbdrts-theme-choice-info">
                            <div className="bbdrts-theme-choice-title">
                              <strong>Dark Mode</strong>
                              {theme === 'dark' && <span className="bbdrts-theme-active-tag">Active</span>}
                            </div>
                            <span>Deep charcoal and obsidian background with comfortable contrast.</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ══════════════════════════════════════════════════
                  SECURITY & WEB3 SESSIONS TAB (UNIVERSAL)
                 ══════════════════════════════════════════════════ */}
                {activeTab === 'security' && (
                  <div className="bbdrts-studio-pane fade-in">
                    <div className="bbdrts-studio-card">
                      <div className="bbdrts-studio-card-header">
                        <div className="bbdrts-studio-card-title-wrap">
                          <div className="bbdrts-studio-card-icon-box">
                            <span className="material-symbols-outlined">security</span>
                          </div>
                          <div>
                            <h5>Account Security &amp; Blockchain Audit Export</h5>
                            <span>Inspect your active authentication session and download your Sepolia audit record.</span>
                          </div>
                        </div>
                      </div>

                      <div className="bbdrts-studio-credentials-list">
                        <div className="bbdrts-studio-cred-row">
                          <div className="bbdrts-studio-cred-meta">
                            <span className="bbdrts-studio-cred-label">Blockchain Notarization Engine</span>
                            <span className="bbdrts-studio-cred-val">Gasless Ethereum Sepolia Audit Relayer Active</span>
                          </div>
                          <span className="bbdrts-verified-badge-inline">
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>verified</span>
                            Secure
                          </span>
                        </div>

                        <div className="bbdrts-studio-cred-row">
                          <div className="bbdrts-studio-cred-meta">
                            <span className="bbdrts-studio-cred-label">Authenticated Session Token</span>
                            <span className="bbdrts-studio-cred-val">JWT Multi-Factor Bearer Session</span>
                          </div>
                          <span className="bbdrts-permanent-badge-inline">
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>key</span>
                            Active
                          </span>
                        </div>
                      </div>

                      <div className="bbdrts-security-actions-row" style={{ marginTop: '14px' }}>
                        <button
                          type="button"
                          className="bbdrts-studio-btn-sm outline"
                          onClick={() => {
                            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
                              entity: isOrg ? (orgName || currentUser?.name) : (currentUser?.name || currentUser?.email),
                              role: currentUser?.role || 'user',
                              audit_mode: 'Gasless Sepolia Relayer (PHP Native)',
                              export_date: new Date().toISOString(),
                              protocol: "BBDRTS Sepolia Relief Ledger"
                            }, null, 2));
                            const downloadAnchor = document.createElement('a');
                            downloadAnchor.setAttribute("href", dataStr);
                            downloadAnchor.setAttribute("download", `bbdrts_${isOrg ? 'ngo' : 'donor'}_audit_${currentUser?.id || 'export'}.json`);
                            document.body.appendChild(downloadAnchor);
                            downloadAnchor.click();
                            downloadAnchor.remove();
                            showSuccess('On-chain audit certificate exported successfully!', 'Audit Exported');
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>download</span>
                          <span>Export On-Chain Relief Record (JSON)</span>
                        </button>
                      </div>

                    </div>
                  </div>
                )}

                {/* ══════════════════════════════════════════════════
                  ORGANIZATION TABS: PROFILE & COVER BANNER STUDIO
                 ══════════════════════════════════════════════════ */}
                {isOrg && activeTab === 'org_details' && (
                  <div className="epm2-pane" key="epm2-org-details">

                    {/* Refined Cover Banner + Overlapping Logo Section */}
                    <div className="epm2-section">
                      <div
                        className="epm2-ngo-banner"
                        onClick={() => bannerInputRef.current?.click()}
                      >
                        <div
                          className="epm2-ngo-banner-img"
                          style={
                            bannerUrl && (bannerUrl.startsWith('data:') || bannerUrl.startsWith('http') || bannerUrl.startsWith('/') || bannerUrl.includes('.jpg') || bannerUrl.includes('.png'))
                              ? { backgroundImage: `url(${bannerUrl})` }
                              : bannerUrl && bannerUrl.startsWith('linear-gradient')
                                ? { background: bannerUrl }
                                : { background: 'linear-gradient(135deg, #0d0d0f 0%, #18181b 100%)' }
                          }
                        />
                        <div className="epm2-ngo-banner-scrim" />
                        <div className="epm2-ngo-banner-actions">
                          <button
                            type="button"
                            className="epm2-banner-pill"
                            onClick={(e) => {
                              e.stopPropagation();
                              bannerInputRef.current?.click();
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>photo_camera</span>
                            <span>{bannerUrl ? 'Change Banner' : 'Upload Banner'}</span>
                          </button>
                          {bannerUrl && (
                            <button
                              type="button"
                              className="epm2-banner-pill is-danger"
                              onClick={(e) => {
                                e.stopPropagation();
                                setBannerUrl('');
                              }}
                              title="Remove cover banner"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>delete</span>
                              <span>Remove</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="epm2-ngo-identity-bar">
                        <div className="epm2-ngo-identity-left">
                          <button
                            type="button"
                            className="epm2-avatar-btn"
                            onClick={() => fileInputRef.current?.click()}
                            title="Change organization logo"
                          >
                            <div className="epm2-avatar-circle epm2-avatar-circle--ngo">
                              {avatarUrl && (avatarUrl.startsWith('data:') || avatarUrl.startsWith('http')) ? (
                                <img src={avatarUrl} alt="Logo" />
                              ) : avatarUrl && avatarUrl.length < 30 ? (
                                <span className="material-symbols-outlined" style={{ fontSize: '30px' }}>{avatarUrl}</span>
                              ) : (
                                <span>{userInitials}</span>
                              )}
                            </div>
                            <span className="epm2-avatar-overlay">
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>photo_camera</span>
                            </span>
                          </button>

                          <div className="epm2-avatar-meta">
                            <div className="epm2-name-line">
                              <h4>{orgName || 'Organization Profile'}</h4>
                              {(currentUser?.verification_status === 'Approved' || currentUser?.Verification_Status === 'Approved') && (
                                <span
                                  className="material-symbols-outlined epm2-verified-icon"
                                  title={`SEC Verified NGO · Verified ${verifiedDateStr}`}
                                >
                                  verified
                                </span>
                              )}
                            </div>
                            <p className="epm2-sub-line">
                              {(currentUser?.verification_status === 'Approved' || currentUser?.Verification_Status === 'Approved')
                                ? `SEC & DSWD Accredited NGO · ${verifiedDateStr}`
                                : (currentUser?.verification_status === 'Pending' || currentUser?.Verification_Status === 'Pending')
                                  ? `Accreditation Pending · ${verifiedDateStr}`
                                  : 'Registered Humanitarian Entity'}
                            </p>
                          </div>
                        </div>

                        <div className="epm2-btn-row" style={{ marginTop: 0 }}>
                          <button
                            type="button"
                            className="epm2-btn epm2-btn--outline"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            {avatarUrl ? 'Change Logo' : 'Upload Logo'}
                          </button>
                          {avatarUrl && (
                            <button
                              type="button"
                              className="epm2-btn epm2-btn--ghost-danger"
                              onClick={handleRemovePhoto}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Official Non-Profit Name & Website (Balanced 2-Col) */}
                    <div className="epm2-section">
                      <div className="epm2-grid-2">
                        <div className="epm2-field">
                          <label htmlFor="epm2-org-name" className="epm2-field-title">Official Organization Name</label>
                          <input
                            id="epm2-org-name"
                            type="text"
                            className="epm2-input"
                            value={orgName}
                            onChange={e => setOrgName(e.target.value)}
                            placeholder="e.g. Philippine Red Cross - Southern Leyte"
                            required
                          />
                        </div>

                        <div className="epm2-field">
                          <label htmlFor="epm2-org-web" className="epm2-field-title">Official Website</label>
                          <input
                            id="epm2-org-web"
                            type="url"
                            className="epm2-input"
                            value={website}
                            onChange={e => setWebsite(e.target.value)}
                            placeholder="https://redcross.org.ph"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Humanitarian Mission Statement */}
                    <div className="epm2-section">
                      <div className="epm2-field-head">
                        <div>
                          <label htmlFor="epm2-org-bio" className="epm2-field-title">Humanitarian Mission Statement</label>
                          <p className="epm2-field-sub">Displayed on your public NGO audit profile and active relief campaigns.</p>
                        </div>
                      </div>
                      <textarea
                        id="epm2-org-bio"
                        className="epm2-textarea"
                        rows="3"
                        value={bio}
                        onChange={e => setBio(e.target.value)}
                        placeholder="Describe your organization's mission, emergency focus, and disaster response capabilities..."
                      />
                    </div>

                  </div>
                )}

                {/* ══════════════════════════════════════════════════
                  ORGANIZATION TABS: HOTLINES & REGIONAL BASE
                 ══════════════════════════════════════════════════ */}
                {isOrg && activeTab === 'org_contact' && (
                  <div className="bbdrts-studio-pane fade-in">

                    {/* Emergency Dispatch & Hotlines */}
                    <div className="bbdrts-studio-card">
                      <div className="bbdrts-studio-card-header">
                        <div className="bbdrts-studio-card-title-wrap">
                          <span className="material-symbols-outlined" style={{ color: 'var(--accent, #22c55e)' }}>support_agent</span>
                          <div>
                            <h5>Emergency Operations & Hotlines</h5>
                            <span>Direct dispatch numbers for urgent disaster response coordination.</span>
                          </div>
                        </div>
                      </div>

                      <div className="bbdrts-studio-grid-2">
                        <div className="bbdrts-studio-field-box">
                          <label className="bbdrts-studio-label">24/7 Disaster Operations Hotline</label>
                          <input
                            type="text"
                            className="bbdrts-studio-input"
                            value={emergencyHotline}
                            onChange={e => setEmergencyHotline(e.target.value)}
                            placeholder="e.g. (053) 570-9111 / 143"
                          />
                        </div>

                        {/* Mobile Number */}
                        <div className="bbdrts-studio-field-box">
                          <label className="bbdrts-studio-label">Primary Mobile Dispatch</label>
                          <input
                            type="tel"
                            className="bbdrts-studio-input"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            placeholder="e.g. +63 917 888 9999"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 4-Tier Cascading PSGC Location Selector */}
                    <div className="bbdrts-studio-card" style={{ marginTop: '14px' }}>
                      <div className="bbdrts-studio-card-header">
                        <div className="bbdrts-studio-card-title-wrap">
                          <span className="material-symbols-outlined" style={{ color: 'var(--accent, #22c55e)' }}>location_on</span>
                          <div>
                            <h5>Headquarters / Regional Base (PSGC)</h5>
                            <span>Official Philippine Standard Geographic Code location for emergency dispatch.</span>
                          </div>
                        </div>
                      </div>

                      <div className="bbdrts-studio-grid-2">
                        <div className="bbdrts-studio-field-box">
                          <label className="bbdrts-studio-label">1. Region</label>
                          <select
                            className="bbdrts-studio-select"
                            value={regionCode}
                            onChange={handleRegionSelect}
                          >
                            <option value="">
                              {regionList.length > 0 ? `-- Select Administrative Region (${regionList.length} Total) --` : 'Loading Philippine Regions...'}
                            </option>
                            {regionList.map((r) => (
                              <option key={r.region_code} value={r.region_code}>
                                {r.region_name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="bbdrts-studio-field-box">
                          <label className="bbdrts-studio-label">2. Province / District</label>
                          <select
                            className="bbdrts-studio-select"
                            value={provinceCode}
                            onChange={handleProvinceSelect}
                            disabled={!regionCode || provinceList.length === 0}
                          >
                            <option value="">
                              {regionCode
                                ? (provinceList.length > 0
                                  ? `-- Select Province (${provinceList.length}) --`
                                  : 'No Provinces in Region / Independent District')
                                : '-- Select Region First --'}
                            </option>
                            {provinceList.map((p) => (
                              <option key={p.province_code} value={p.province_code}>
                                {p.province_name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="bbdrts-studio-field-box">
                          <label className="bbdrts-studio-label">3. City / Municipality</label>
                          <select
                            className="bbdrts-studio-select"
                            value={cityCode}
                            onChange={handleCitySelect}
                            disabled={!provinceCode || cityList.length === 0}
                          >
                            <option value="">
                              {provinceCode
                                ? (cityList.length > 0
                                  ? `-- Select City / Municipality (${cityList.length}) --`
                                  : 'No Cities Found')
                                : '-- Select Province First --'}
                            </option>
                            {cityList.map((c) => (
                              <option key={c.city_code} value={c.city_code}>
                                {c.city_name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="bbdrts-studio-field-box">
                          <label className="bbdrts-studio-label">4. Barangay</label>
                          <select
                            className="bbdrts-studio-select"
                            value={barangayCode}
                            onChange={handleBarangaySelect}
                            disabled={!cityCode || barangayList.length === 0}
                          >
                            <option value="">
                              {cityCode
                                ? (barangayList.length > 0
                                  ? `-- Select Barangay (${barangayList.length}) --`
                                  : 'No Barangays Found')
                                : '-- Select City / Municipality First --'}
                            </option>
                            {barangayList.map((b) => (
                              <option key={b.brgy_code} value={b.brgy_code}>
                                {b.brgy_name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {(barangayName || cityName || provinceName || regionName) && (
                        <div className="bbdrts-psgc-summary-pill" style={{ marginTop: '12px' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--accent, #22c55e)' }}>pin_drop</span>
                          <span>
                            <strong>Operational HQ:</strong> {[
                              barangayName ? `Brgy. ${barangayName}` : '',
                              cityName,
                              provinceName,
                              regionName
                            ].filter(Boolean).join(', ')}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Disaster Broadcast Notification Alerts */}
                    <div className="bbdrts-studio-card" style={{ marginTop: '14px' }}>
                      <label className="bbdrts-toggle-row">
                        <div className="bbdrts-toggle-meta">
                          <strong>Disaster Dispatch & Emergency SMS Alerts</strong>
                          <span>Receive immediate SMS alerts when emergency relief campaigns are assigned to your base.</span>
                        </div>
                        <input
                          type="checkbox"
                          className="bbdrts-switch-checkbox"
                          checked={notifSmsAlerts}
                          onChange={e => setNotifSmsAlerts(e.target.checked)}
                        />
                      </label>
                    </div>

                  </div>
                )}

                {isOrg && activeTab === 'org_additional' && (
                  <div className="bbdrts-studio-pane fade-in">
                    <div className="bbdrts-studio-card">
                      <div className="bbdrts-studio-card-header">
                        <div className="bbdrts-studio-card-title-wrap">
                          <div className="bbdrts-studio-card-icon-box">
                            <span className="material-symbols-outlined">info</span>
                          </div>
                          <div>
                            <h5>Institutional Background & Operational Profile (Optional)</h5>
                            <span>Optional organizational information visible to donors, relief partners, and humanitarian audits.</span>
                          </div>
                        </div>
                      </div>

                      <div className="bbdrts-studio-field-box">
                        <label className="bbdrts-studio-label">
                          Official NGO Website
                          <span className="bbdrts-opt-tag" style={{ marginLeft: '6px', fontSize: '0.68rem', opacity: 0.65 }}>(Optional)</span>
                        </label>
                        <div className="bbdrts-input-icon-wrap">
                          <span className="material-symbols-outlined bbdrts-input-icon">language</span>
                          <input
                            type="url"
                            className="bbdrts-studio-input"
                            value={website}
                            onChange={e => setWebsite(e.target.value)}
                            placeholder="https://www.redcross.org.ph"
                            maxLength={160}
                          />
                        </div>
                        <span className="bbdrts-status-hint">Official humanitarian website or operations portal.</span>
                      </div>

                      <div className="bbdrts-studio-field-box">
                        <label className="bbdrts-studio-label">
                          Official Social Media Page / Channel
                          <span className="bbdrts-opt-tag" style={{ marginLeft: '6px', fontSize: '0.68rem', opacity: 0.65 }}>(Optional)</span>
                        </label>
                        <div className="bbdrts-input-icon-wrap">
                          <span className="material-symbols-outlined bbdrts-input-icon">share</span>
                          <input
                            type="text"
                            className="bbdrts-studio-input"
                            value={socialLink}
                            onChange={e => setSocialLink(e.target.value)}
                            placeholder="https://facebook.com/your-ngo or @officialhandle"
                            maxLength={140}
                          />
                        </div>
                        <span className="bbdrts-status-hint">Verified organization Facebook, X (Twitter), or YouTube page.</span>
                      </div>

                      <div className="bbdrts-studio-field-box">
                        <label className="bbdrts-studio-label">
                          Mission Statement & Core Mandate
                          <span className="bbdrts-opt-tag" style={{ marginLeft: '6px', fontSize: '0.68rem', opacity: 0.65 }}>(Optional)</span>
                        </label>
                        <textarea
                          className="bbdrts-studio-textarea"
                          value={missionStatement}
                          onChange={e => setMissionStatement(e.target.value)}
                          placeholder="Provide a brief summary of your organization's humanitarian mandate, community goals, and disaster response mission..."
                          rows={3}
                          maxLength={350}
                        />
                        <span className="bbdrts-status-hint">Displayed on public NGO audit profile and campaign headers.</span>
                      </div>

                      <div className="bbdrts-studio-field-box">
                        <label className="bbdrts-studio-label">
                          Primary Disaster Response Focus Areas
                          <span className="bbdrts-opt-tag" style={{ marginLeft: '6px', fontSize: '0.68rem', opacity: 0.65 }}>(Optional)</span>
                        </label>
                        <div className="bbdrts-input-icon-wrap">
                          <span className="material-symbols-outlined bbdrts-input-icon">travel_explore</span>
                          <input
                            type="text"
                            className="bbdrts-studio-input"
                            value={focusAreas}
                            onChange={e => setFocusAreas(e.target.value)}
                            placeholder="e.g. Typhoon Emergency Relief, Medical First Response, Water & Sanitation"
                            maxLength={160}
                          />
                        </div>
                        <span className="bbdrts-status-hint">Key sectors of expertise and deployment capability.</span>
                      </div>

                      <div className="bbdrts-studio-field-box">
                        <label className="bbdrts-studio-label">
                          Headquarters Landmark / Campus Directions
                          <span className="bbdrts-opt-tag" style={{ marginLeft: '6px', fontSize: '0.68rem', opacity: 0.65 }}>(Optional)</span>
                        </label>
                        <div className="bbdrts-input-icon-wrap">
                          <span className="material-symbols-outlined bbdrts-input-icon">apartment</span>
                          <input
                            type="text"
                            className="bbdrts-studio-input"
                            value={hqLandmark}
                            onChange={e => setHqLandmark(e.target.value)}
                            placeholder="e.g. Near Provincial Capitol, Beside City Hall Complex"
                            maxLength={120}
                          />
                        </div>
                        <span className="bbdrts-status-hint">Physical landmarks to assist in-person aid deliveries and logistics dispatch.</span>
                      </div>
                    </div>
                  </div>
                )}

                {isOrg && activeTab === 'org_payments' && (
                  <div className="bbdrts-studio-pane fade-in">
                    <div className="bbdrts-studio-banner-notice">
                      <VercelIcon name="account_balance_wallet" size={18} color="#38bdf8" />
                      <div>
                        <strong>Official Donation Receiving Channels &amp; QR Codes</strong>
                        <span>Configure receiving channels for donors contributing via GCash, Maya, or direct Bank Transfer. Synchronizes with campaign deployment.</span>
                      </div>
                    </div>

                    {/* Payment Channel Switcher Toolbar matching Step 5 */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      flexWrap: 'wrap'
                    }}>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        background: 'rgba(255, 255, 255, 0.05)',
                        padding: '4px',
                        borderRadius: '10px',
                        border: '1px solid #262626',
                        gap: '4px'
                      }}>
                        <button
                          type="button"
                          onClick={() => setActivePaymentChannelTab('gcash')}
                          style={{
                            padding: '6px 16px',
                            borderRadius: '6px',
                            border: 'none',
                            background: activePaymentChannelTab === 'gcash' ? '#007DFE' : 'transparent',
                            color: activePaymentChannelTab === 'gcash' ? '#ffffff' : '#888888',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.12s ease'
                          }}
                        >
                          <span style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: (gcashNumber || gcashQrUrl || gcashName) ? (activePaymentChannelTab === 'gcash' ? '#ffffff' : '#22c55e') : 'rgba(255,255,255,0.3)'
                          }} />
                          <span>GCash</span>
                          {(gcashNumber || gcashQrUrl || gcashName) && <VercelIcon name="check" size={12} color={activePaymentChannelTab === 'gcash' ? '#ffffff' : '#22c55e'} />}
                        </button>

                        <button
                          type="button"
                          onClick={() => setActivePaymentChannelTab('maya')}
                          style={{
                            padding: '6px 16px',
                            borderRadius: '6px',
                            border: 'none',
                            background: activePaymentChannelTab === 'maya' ? '#00b87c' : 'transparent',
                            color: activePaymentChannelTab === 'maya' ? '#ffffff' : '#888888',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.12s ease'
                          }}
                        >
                          <span style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: (mayaNumber || mayaQrUrl || mayaName) ? (activePaymentChannelTab === 'maya' ? '#ffffff' : '#22c55e') : 'rgba(255,255,255,0.3)'
                          }} />
                          <span>Maya</span>
                          {(mayaNumber || mayaQrUrl || mayaName) && <VercelIcon name="check" size={12} color={activePaymentChannelTab === 'maya' ? '#ffffff' : '#22c55e'} />}
                        </button>

                        <button
                          type="button"
                          onClick={() => setActivePaymentChannelTab('bank')}
                          style={{
                            padding: '6px 16px',
                            borderRadius: '6px',
                            border: 'none',
                            background: activePaymentChannelTab === 'bank' ? '#16a34a' : 'transparent',
                            color: activePaymentChannelTab === 'bank' ? '#ffffff' : '#888888',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.12s ease'
                          }}
                        >
                          <span style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: (bankAccountNumber || bankQrUrl) ? (activePaymentChannelTab === 'bank' ? '#ffffff' : '#22c55e') : 'rgba(255,255,255,0.3)'
                          }} />
                          <span>Direct Bank Deposit</span>
                          {(bankAccountNumber || bankQrUrl) && <VercelIcon name="check" size={12} color={activePaymentChannelTab === 'bank' ? '#ffffff' : '#22c55e'} />}
                        </button>
                      </div>
                    </div>

                    {/* ── 1. GCASH CHANNEL ── */}
                    {activePaymentChannelTab === 'gcash' && (
                      <div className="bbdrts-studio-card fade-in">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '20px', alignItems: 'stretch' }}>
                          {/* Left Column: Account Details */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div className="bbdrts-studio-field-box">
                              <label className="bbdrts-studio-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <VercelIcon name="badge" size={16} color="#007DFE" />
                                Official GCash Account Name
                              </label>
                              <input
                                type="text"
                                className="bbdrts-studio-input"
                                placeholder="e.g., Philippine Red Cross - Southern Leyte"
                                value={gcashName}
                                onChange={e => setGcashName(e.target.value)}
                              />
                              <span className="bbdrts-field-hint">
                                Registered name displayed on GCash app confirmation.
                              </span>
                            </div>

                            <div className="bbdrts-studio-field-box">
                              <label className="bbdrts-studio-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <VercelIcon name="phone_iphone" size={16} color="#007DFE" />
                                Official GCash Receiving Number
                              </label>
                              <input
                                type="text"
                                className="bbdrts-studio-input"
                                placeholder="0992 982 4615"
                                value={gcashNumber}
                                onChange={e => setGcashNumber(formatPhoneNumber(e.target.value))}
                                style={{ fontFamily: 'monospace', fontWeight: 600 }}
                              />
                              <span className="bbdrts-field-hint">
                                Donors can copy and send funds directly to this GCash account.
                              </span>
                            </div>
                          </div>

                          {/* Right Column: GCash QR Code Preview / Dropzone */}
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <label className="bbdrts-studio-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                                <VercelIcon name="qr_code" size={16} color="#007DFE" />
                                GCash QR Code Image
                              </label>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <button
                                  type="button"
                                  onClick={() => setShowQrPicker('GCash')}
                                  style={{
                                    background: 'rgba(0, 125, 254, 0.1)',
                                    border: '1px solid rgba(0, 125, 254, 0.3)',
                                    color: '#007DFE',
                                    fontSize: '0.74rem',
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                  title="Pick from reusable QR library"
                                >
                                  <VercelIcon name="qr_code_2" size={13} color="#007DFE" />
                                  <span>Select QR Code ({savedQrLibrary.filter(q => q.payment_method === 'GCash').length})</span>
                                </button>
                                {gcashQrUrl && (
                                  <button
                                    type="button"
                                    onClick={() => setGcashQrUrl('')}
                                    style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.74rem', cursor: 'pointer', fontWeight: 600 }}
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            </div>

                            {gcashQrUrl ? (
                              <div style={{
                                flex: 1,
                                minHeight: '140px',
                                position: 'relative',
                                borderRadius: '8px',
                                overflow: 'hidden',
                                border: '1.5px solid rgba(0, 125, 254, 0.45)',
                                background: '#111111',
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
                                  style={{ maxHeight: '110px', maxWidth: '100%', objectFit: 'contain', borderRadius: '6px' }}
                                />
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontSize: '0.74rem', color: '#007DFE', fontWeight: 600 }}>
                                  <VercelIcon name="verified" size={14} color="#007DFE" />
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
                                borderRadius: '8px',
                                cursor: 'pointer',
                                background: 'rgba(0, 125, 254, 0.03)',
                                transition: 'all 0.15s ease',
                                textAlign: 'center'
                              }}>
                                <VercelIcon name="qr_code_scanner" size={32} color="#007DFE" style={{ marginBottom: '6px' }} />
                                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#ededed' }}>
                                  Upload GCash QR
                                </span>
                                <span style={{ fontSize: '0.72rem', color: '#888888', marginTop: '2px' }}>
                                  PNG, JPG or WebP image • Auto-crop &amp; OCR enabled
                                </span>
                                <input
                                  type="file"
                                  ref={gcashFileInputRef}
                                  accept="image/*"
                                  onChange={e => handleQrUpload(e.target.files?.[0], setGcashQrUrl, 'GCash')}
                                  style={{ display: 'none' }}
                                />
                              </label>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── 2. MAYA CHANNEL ── */}
                    {activePaymentChannelTab === 'maya' && (
                      <div className="bbdrts-studio-card fade-in">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '20px', alignItems: 'stretch' }}>
                          {/* Left Column: Account Details */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div className="bbdrts-studio-field-box">
                              <label className="bbdrts-studio-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <VercelIcon name="badge" size={16} color="#00b87c" />
                                Official Maya Account Name
                              </label>
                              <input
                                type="text"
                                className="bbdrts-studio-input"
                                placeholder="e.g., Philippine Red Cross or Official Merchant Name"
                                value={mayaName}
                                onChange={e => setMayaName(e.target.value)}
                              />
                              <span className="bbdrts-field-hint">
                                Registered account or merchant name displayed inside Maya.
                              </span>
                            </div>

                            <div className="bbdrts-studio-field-box">
                              <label className="bbdrts-studio-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <VercelIcon name="phone_iphone" size={16} color="#00b87c" />
                                Official Maya Relief Number
                              </label>
                              <input
                                type="text"
                                className="bbdrts-studio-input"
                                placeholder="0918 765 1430"
                                value={mayaNumber}
                                onChange={e => setMayaNumber(formatPhoneNumber(e.target.value))}
                                style={{ fontFamily: 'monospace', fontWeight: 600 }}
                              />
                              <span className="bbdrts-field-hint">
                                Donors can send relief funds via Maya mobile or merchant account ID.
                              </span>
                            </div>
                          </div>

                          {/* Right Column: Maya QR Code Preview / Dropzone */}
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <label className="bbdrts-studio-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                                <VercelIcon name="qr_code" size={16} color="#00b87c" />
                                Maya QR Code Image
                              </label>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <button
                                  type="button"
                                  onClick={() => setShowQrPicker('Maya')}
                                  style={{
                                    background: 'rgba(0, 184, 124, 0.1)',
                                    border: '1px solid rgba(0, 184, 124, 0.3)',
                                    color: '#00b87c',
                                    fontSize: '0.74rem',
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                  title="Pick from reusable QR library"
                                >
                                  <VercelIcon name="qr_code_2" size={13} color="#00b87c" />
                                  <span>Select QR Code ({savedQrLibrary.filter(q => q.payment_method === 'Maya').length})</span>
                                </button>
                                {mayaQrUrl && (
                                  <button
                                    type="button"
                                    onClick={() => setMayaQrUrl('')}
                                    style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.74rem', cursor: 'pointer', fontWeight: 600 }}
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            </div>

                            {mayaQrUrl ? (
                              <div style={{
                                flex: 1,
                                minHeight: '140px',
                                position: 'relative',
                                borderRadius: '8px',
                                overflow: 'hidden',
                                border: '1.5px solid rgba(0, 184, 124, 0.45)',
                                background: '#111111',
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
                                  style={{ maxHeight: '110px', maxWidth: '100%', objectFit: 'contain', borderRadius: '6px' }}
                                />
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontSize: '0.74rem', color: '#00b87c', fontWeight: 600 }}>
                                  <VercelIcon name="verified" size={14} color="#00b87c" />
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
                                border: '1.5px dashed rgba(0, 184, 124, 0.4)',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                background: 'rgba(0, 184, 124, 0.03)',
                                transition: 'all 0.15s ease',
                                textAlign: 'center'
                              }}>
                                <VercelIcon name="qr_code_scanner" size={32} color="#00b87c" style={{ marginBottom: '6px' }} />
                                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#ededed' }}>
                                  Upload Maya QR
                                </span>
                                <span style={{ fontSize: '0.72rem', color: '#888888', marginTop: '2px' }}>
                                  PNG, JPG or WebP image • Auto-crop &amp; OCR enabled
                                </span>
                                <input
                                  type="file"
                                  ref={mayaFileInputRef}
                                  accept="image/*"
                                  onChange={e => handleQrUpload(e.target.files?.[0], setMayaQrUrl, 'Maya')}
                                  style={{ display: 'none' }}
                                />
                              </label>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── 3. DIRECT BANK DEPOSIT CHANNEL ── */}
                    {activePaymentChannelTab === 'bank' && (
                      <div className="bbdrts-studio-card fade-in">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '20px', alignItems: 'stretch' }}>
                          {/* Left Column: Bank Account Details */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div className="bbdrts-studio-field-box">
                              <label className="bbdrts-studio-label">Bank / Financial Institution</label>
                              <input
                                type="text"
                                className="bbdrts-studio-input"
                                value={bankName}
                                onChange={e => {
                                  const bName = e.target.value;
                                  setBankName(bName);
                                  setBankDetails([bName, bankAccountName, bankAccountNumber ? `Acct: ${bankAccountNumber}` : ''].filter(Boolean).join(' • '));
                                }}
                                placeholder="e.g. Land Bank of the Philippines (LBP) / BDO"
                              />
                              <span className="bbdrts-field-hint">
                                Official commercial or universal bank institution.
                              </span>
                            </div>

                            <div className="bbdrts-studio-field-box">
                              <label className="bbdrts-studio-label">Bank Account Number</label>
                              <input
                                type="text"
                                className="bbdrts-studio-input font-mono"
                                value={bankAccountNumber}
                                onChange={e => {
                                  const bNum = e.target.value;
                                  setBankAccountNumber(bNum);
                                  setBankDetails([bankName, bankAccountName, bNum ? `Acct: ${bNum}` : ''].filter(Boolean).join(' • '));
                                }}
                                placeholder="e.g. 0142-8891-23"
                                style={{ fontFamily: 'monospace', fontWeight: 600 }}
                              />
                              <span className="bbdrts-field-hint">
                                Designated relief savings or current checking account number.
                              </span>
                            </div>

                            <div className="bbdrts-studio-field-box">
                              <label className="bbdrts-studio-label">Bank Account Holder Name</label>
                              <input
                                type="text"
                                className="bbdrts-studio-input"
                                value={bankAccountName}
                                onChange={e => {
                                  const bAcctName = e.target.value;
                                  setBankAccountName(bAcctName);
                                  setBankDetails([bankName, bAcctName, bankAccountNumber ? `Acct: ${bankAccountNumber}` : ''].filter(Boolean).join(' • '));
                                }}
                                placeholder="e.g. Philippine Red Cross - Southern Leyte Chapter"
                              />
                              <span className="bbdrts-field-hint">
                                Exact corporate or institutional account holder name registered with the bank.
                              </span>
                            </div>
                          </div>

                          {/* Right Column: Bank QR Code Preview / Dropzone */}
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <label className="bbdrts-studio-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                                <VercelIcon name="qr_code" size={16} color="#16a34a" />
                                Bank Transfer / InstaPay QR Image
                              </label>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <button
                                  type="button"
                                  onClick={() => setShowQrPicker('Bank')}
                                  style={{
                                    background: 'rgba(22, 163, 74, 0.1)',
                                    border: '1px solid rgba(22, 163, 74, 0.3)',
                                    color: '#16a34a',
                                    fontSize: '0.74rem',
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                  title="Pick from reusable QR library"
                                >
                                  <VercelIcon name="qr_code_2" size={13} color="#16a34a" />
                                  <span>Select QR Code ({savedQrLibrary.filter(q => q.payment_method === 'Bank').length})</span>
                                </button>
                                {bankQrUrl && (
                                  <button
                                    type="button"
                                    onClick={() => setBankQrUrl('')}
                                    style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.74rem', cursor: 'pointer', fontWeight: 600 }}
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            </div>

                            {bankQrUrl ? (
                              <div style={{
                                flex: 1,
                                minHeight: '140px',
                                position: 'relative',
                                borderRadius: '8px',
                                overflow: 'hidden',
                                border: '1.5px solid rgba(22, 163, 74, 0.45)',
                                background: '#111111',
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
                                  style={{ maxHeight: '110px', maxWidth: '100%', objectFit: 'contain', borderRadius: '6px' }}
                                />
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontSize: '0.74rem', color: '#16a34a', fontWeight: 600 }}>
                                  <VercelIcon name="verified" size={14} color="#16a34a" />
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
                                borderRadius: '8px',
                                cursor: 'pointer',
                                background: 'rgba(22, 163, 74, 0.03)',
                                transition: 'all 0.15s ease',
                                textAlign: 'center'
                              }}>
                                <VercelIcon name="qr_code_scanner" size={32} color="#16a34a" style={{ marginBottom: '6px' }} />
                                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#ededed' }}>
                                  Upload Bank QR
                                </span>
                                <span style={{ fontSize: '0.72rem', color: '#888888', marginTop: '2px' }}>
                                  PNG, JPG or WebP image • InstaPay / PESONet
                                </span>
                                <input
                                  type="file"
                                  ref={bankFileInputRef}
                                  accept="image/*"
                                  onChange={e => handleQrUpload(e.target.files?.[0], setBankQrUrl, 'Bank')}
                                  style={{ display: 'none' }}
                                />
                              </label>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {isOrg && activeTab === 'org_kyc' && (
                  <div className="bbdrts-studio-pane fade-in">
                    <div className="bbdrts-studio-card">
                      <div className="bbdrts-studio-card-header">
                        <div className="bbdrts-studio-card-title-wrap">
                          <span className="material-symbols-outlined" style={{ color: 'var(--accent, #22c55e)' }}>verified</span>
                          <div>
                            <h5>Government Compliance & SEC Accreditation</h5>
                            <span>Official regulatory credentials verified on the protocol network.</span>
                          </div>
                        </div>
                      </div>

                      <div className="bbdrts-studio-credentials-list">
                        <div className="bbdrts-studio-cred-row">
                          <div className="bbdrts-studio-cred-meta">
                            <span className="bbdrts-studio-cred-label">SEC Registration Number</span>
                            <span className="bbdrts-studio-cred-val font-mono">{currentUser?.sec_registration_no || 'SEC-CN2020-001234'}</span>
                          </div>
                          <span className="bbdrts-verified-badge-inline">
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>verified</span>
                            SEC Registered
                          </span>
                        </div>

                        <div className="bbdrts-studio-cred-row">
                          <div className="bbdrts-studio-cred-meta">
                            <span className="bbdrts-studio-cred-label">DSWD Accreditation Number</span>
                            <span className="bbdrts-studio-cred-val font-mono">{currentUser?.dswd_accreditation_no || 'DSWD-SB-A-2024-0089'}</span>
                          </div>
                          <span className="bbdrts-verified-badge-inline">
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>verified</span>
                            DSWD Accredited
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* ── Minimal Vercel Footer ── */}
              <div className="bbdrts-studio-footer epm2-footer">
                <div className="epm2-footer-meta">
                  <span className="epm2-dot" />
                  <span>Syncs with official registry &amp; Sepolia receipts</span>
                </div>
                <div className="epm2-footer-actions">
                  <button
                    type="button"
                    className="epm2-btn epm2-btn--outline"
                    onClick={handleSmoothClose}
                    disabled={saveState === 'saving' || saveState === 'success'}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`epm2-btn epm2-btn--solid ${saveState === 'success' ? 'is-saved' : ''}`}
                    disabled={saveState === 'saving' || saveState === 'success'}
                  >
                    {saveState === 'saving' && (
                      <>
                        <div className="spinner" style={{ width: '13px', height: '13px' }} />
                        <span>Saving...</span>
                      </>
                    )}
                    {saveState === 'success' && (
                      <>
                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>check</span>
                        <span>Saved</span>
                      </>
                    )}
                    {saveState === 'idle' && <span>Save Changes</span>}
                  </button>
                </div>
              </div>

            </form>
          </main>

        </div>

      </div>


      {/* ── Discard Unsaved Changes Confirmation Dialog ── */}
      {showDiscardConfirm && (
        <div className="bbdrts-discard-backdrop" onClick={() => setShowDiscardConfirm(false)}>
          <div className="bbdrts-discard-card" onClick={e => e.stopPropagation()} role="alertdialog" aria-modal="true">
            <div className="bbdrts-discard-header">
              <div className="bbdrts-discard-icon-wrap">
                <VercelIcon name="error" size={20} color="#ef4444" />
              </div>
              <div className="bbdrts-discard-titles">
                <h4>Discard Unsaved Changes?</h4>
                <p>You have unsaved modifications in your profile. Discarding will revert all changes and close the editor.</p>
              </div>
            </div>
            <div className="bbdrts-discard-actions">
              <button
                type="button"
                className="bbdrts-discard-btn-cancel"
                onClick={() => setShowDiscardConfirm(false)}
                autoFocus
              >
                Keep Editing
              </button>
              <button
                type="button"
                className="bbdrts-discard-btn-confirm"
                onClick={() => {
                  setShowDiscardConfirm(false);
                  handleSmoothClose();
                }}
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          INTERACTIVE IMAGE & BANNER ADJUSTER MODAL LIGHTBOX
          (Supports both 1:1 Profile Photo & 3:1 Cover Banner Framing)
         ══════════════════════════════════════════════════ */}
      {cropper.active && cropper.imageSrc && (
        <div className="bbdrts-cropper-overlay" data-theme={theme || document.documentElement.getAttribute('data-theme') || 'dark'} onClick={() => setCropper(prev => ({ ...prev, active: false }))}>
          <div className={`bbdrts-cropper-modal ${isBannerMode ? 'banner-mode' : ''}`} onClick={e => e.stopPropagation()}>

            <div className="bbdrts-cropper-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--accent, #22c55e)' }}>
                  {isBannerMode ? 'aspect_ratio' : 'tune'}
                </span>
                <strong>{isBannerMode ? 'Adjust Cover Banner (3:1 Landscape)' : 'Adjust Image (1:1 Ratio)'}</strong>
              </div>
              <button
                type="button"
                className="bbdrts-edit-profile-close-btn"
                onClick={() => setCropper(prev => ({ ...prev, active: false }))}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="bbdrts-cropper-body">
              <p className="bbdrts-cropper-instruction">
                {isBannerMode
                  ? 'Drag anywhere to position cover banner • Use slider or scroll wheel to zoom'
                  : 'Drag anywhere to pan photo • Use slider or scroll wheel to zoom'}
              </p>

              {/* Dynamic Viewport Box (1:1 Square or 3:1 Banner Landscape) */}
              <div
                className={`bbdrts-cropper-viewport ${isBannerMode ? 'banner-viewport' : ''}`}
                style={{
                  width: `${viewportW}px`,
                  height: `${viewportH}px`,
                  borderRadius: isBannerMode ? '12px' : '16px'
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onWheel={handleWheelZoom}
              >
                {/* Background Image undergoing Pan, Zoom & Rotation with explicit base dimension */}
                <img
                  ref={cropperImgRef}
                  src={cropper.imageSrc}
                  alt="Adjust Source"
                  className="bbdrts-cropper-img"
                  style={{
                    width: `${baseW}px`,
                    height: `${baseH}px`,
                    maxWidth: 'none',
                    maxHeight: 'none',
                    transform: `translate(${cropper.panX}px, ${cropper.panY}px) rotate(${cropper.rotation}deg) scale(${cropper.zoom})`,
                    transformOrigin: 'center center',
                    pointerEvents: 'none',
                    userSelect: 'none'
                  }}
                  draggable={false}
                />

                {/* 3x3 Rule-of-Thirds Framing Grid Overlay */}
                <div className="bbdrts-cropper-grid-overlay">
                  <div className="bbdrts-grid-line-v v1" />
                  <div className="bbdrts-grid-line-v v2" />
                  <div className="bbdrts-grid-line-h h1" />
                  <div className="bbdrts-grid-line-h h2" />
                </div>

                {/* Circular Mask Overlay (Only in 1:1 Avatar Mode) */}
                {!isBannerMode && <div className="bbdrts-cropper-circular-mask" />}
              </div>

              {/* Adjuster Action Tools (Rotate, Reset) */}
              <div className="bbdrts-adjuster-tools-bar">
                <button
                  type="button"
                  className="bbdrts-adjuster-action-btn"
                  onClick={handleRotate}
                  title="Rotate 90°"
                >
                  <span className="material-symbols-outlined">rotate_right</span>
                  <span>Rotate</span>
                </button>

                <button
                  type="button"
                  className="bbdrts-adjuster-action-btn"
                  onClick={handleResetAdjuster}
                  title="Reset Zoom & Alignment"
                >
                  <span className="material-symbols-outlined">restart_alt</span>
                  <span>Reset</span>
                </button>
              </div>

              {/* Centered Zoom Bar: [Zoom Out] ─── Slider ─── [Zoom In] 100% */}
              <div className="bbdrts-cropper-zoom-bar">
                <button
                  type="button"
                  className="bbdrts-cropper-zoom-btn"
                  onClick={() => handleZoomChange(cropper.zoom - 0.1)}
                  title="Zoom Out"
                >
                  <span className="material-symbols-outlined">zoom_out</span>
                </button>

                <div className="bbdrts-zoom-slider-container">
                  <input
                    type="range"
                    className="bbdrts-cropper-zoom-slider"
                    min="1"
                    max="3.5"
                    step="0.02"
                    value={cropper.zoom}
                    onChange={e => handleZoomChange(parseFloat(e.target.value))}
                  />
                </div>

                <button
                  type="button"
                  className="bbdrts-cropper-zoom-btn"
                  onClick={() => handleZoomChange(cropper.zoom + 0.1)}
                  title="Zoom In"
                >
                  <span className="material-symbols-outlined">zoom_in</span>
                </button>

                <span className="bbdrts-cropper-zoom-label">{(cropper.zoom * 100).toFixed(0)}%</span>
              </div>

            </div>

            <div className="bbdrts-cropper-footer">
              <button
                type="button"
                className="bbdrts-edit-btn-cancel"
                onClick={() => setCropper(prev => ({ ...prev, active: false }))}
              >
                Cancel
              </button>
              <button
                type="button"
                className="bbdrts-edit-btn-save"
                onClick={handleApplyCrop}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check</span>
                <span>{isBannerMode ? 'Set Cover Banner' : 'Set Image'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>,
    document.body
  );
}
