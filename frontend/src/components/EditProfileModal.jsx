import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './EditProfileModal.css';
import { useToast } from '../context/ToastContext';
import { regions as fetchRegions, provinces as fetchProvinces, cities as fetchCities, barangays as fetchBarangays } from 'select-philippines-address';

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
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [emergencyHotline, setEmergencyHotline] = useState(currentUser?.emergency_hotline || '');
  const [website, setWebsite] = useState(currentUser?.website || '');
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

  const handleQrUpload = (file, setter, channelName) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showWarning('Please select a valid image file (PNG, JPG, WEBP).', 'Invalid File');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showWarning('QR Code image exceeds 8MB. Please select a smaller photo.', 'File Too Large');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setter(e.target.result);
      showSuccess(`${channelName} QR Code attached successfully!`, 'QR Uploaded');
    };
    reader.readAsDataURL(file);
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

    const token = localStorage.getItem('bbdrts_token');
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
            banner_url: bannerUrl,
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
            notifEmailReceipts,
            notifSmsAlerts,
            notifMilestones,
            notifReliefProof
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
            notifEmailReceipts,
            notifSmsAlerts,
            notifMilestones,
            notifReliefProof
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
    <div className={`bbdrts-edit-profile-backdrop ${isClosing ? 'closing' : ''}`} onClick={handleSmoothClose} data-theme={theme}>
      <div className="bbdrts-profile-studio-modal" onClick={e => e.stopPropagation()}>

        {/* ── Studio Top Header ── */}
        <div className="bbdrts-studio-header">
          <div className="bbdrts-studio-header-title">
            <div className="bbdrts-studio-header-icon-box">
              <span className="material-symbols-outlined">
                {isOrg ? 'domain' : 'account_circle'}
              </span>
            </div>
            <div>
              <h3>{isOrg ? 'Organization Settings & Institutional Profile' : 'Profile & Account Settings'}</h3>
              <span>{isOrg ? 'Manage verified non-profit credentials and emergency response channels' : 'Manage your public persona, verified credentials, and regional settings'}</span>
            </div>
          </div>
          <button type="button" className="bbdrts-studio-close-btn" onClick={handleSmoothClose} aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* ── Studio 2-Column Layout ── */}
        <div className="bbdrts-studio-body">

          {/* ── Left Sidebar Navigation ── */}
          <aside className="bbdrts-studio-sidebar">
            <div className="bbdrts-studio-sidebar-group">
              <span className="bbdrts-studio-sidebar-group-title">Account Settings</span>

              {!isOrg && !isAdmin ? (
                <>
                  <button
                    type="button"
                    className={`bbdrts-studio-nav-item ${activeTab === 'persona' ? 'active' : ''}`}
                    onClick={() => setActiveTab('persona')}
                  >
                    <span className="material-symbols-outlined">person</span>
                    <span>Public Profile</span>
                  </button>
                  <button
                    type="button"
                    className={`bbdrts-studio-nav-item ${activeTab === 'contact' ? 'active' : ''}`}
                    onClick={() => setActiveTab('contact')}
                  >
                    <span className="material-symbols-outlined">call</span>
                    <span>Contact & Region</span>
                  </button>
                  <button
                    type="button"
                    className={`bbdrts-studio-nav-item ${activeTab === 'verified' ? 'active' : ''}`}
                    onClick={() => setActiveTab('verified')}
                  >
                    <span className="material-symbols-outlined">verified_user</span>
                    <span>Verified Identity</span>
                  </button>
                  <button
                    type="button"
                    className={`bbdrts-studio-nav-item ${activeTab === 'notifications' ? 'active' : ''}`}
                    onClick={() => setActiveTab('notifications')}
                  >
                    <span className="material-symbols-outlined">notifications</span>
                    <span>Notifications</span>
                  </button>
                  <button
                    type="button"
                    className={`bbdrts-studio-nav-item ${activeTab === 'appearance' ? 'active' : ''}`}
                    onClick={() => setActiveTab('appearance')}
                  >
                    <span className="material-symbols-outlined">palette</span>
                    <span>Appearance</span>
                  </button>
                  <button
                    type="button"
                    className={`bbdrts-studio-nav-item ${activeTab === 'security' ? 'active' : ''}`}
                    onClick={() => setActiveTab('security')}
                  >
                    <span className="material-symbols-outlined">lock</span>
                    <span>Security & Web3</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className={`bbdrts-studio-nav-item ${activeTab === 'org_details' ? 'active' : ''}`}
                    onClick={() => setActiveTab('org_details')}
                  >
                    <span className="material-symbols-outlined">corporate_fare</span>
                    <span>Organization Profile</span>
                  </button>
                  <button
                    type="button"
                    className={`bbdrts-studio-nav-item ${activeTab === 'org_contact' ? 'active' : ''}`}
                    onClick={() => setActiveTab('org_contact')}
                  >
                    <span className="material-symbols-outlined">support_agent</span>
                    <span>Hotlines & Region</span>
                  </button>
                  <button
                    type="button"
                    className={`bbdrts-studio-nav-item ${activeTab === 'org_payments' ? 'active' : ''}`}
                    onClick={() => setActiveTab('org_payments')}
                  >
                    <span className="material-symbols-outlined">account_balance_wallet</span>
                    <span>Relief Channels</span>
                  </button>
                  <button
                    type="button"
                    className={`bbdrts-studio-nav-item ${activeTab === 'org_kyc' ? 'active' : ''}`}
                    onClick={() => setActiveTab('org_kyc')}
                  >
                    <span className="material-symbols-outlined">verified</span>
                    <span>Accreditation</span>
                  </button>
                  <button
                    type="button"
                    className={`bbdrts-studio-nav-item ${activeTab === 'appearance' ? 'active' : ''}`}
                    onClick={() => setActiveTab('appearance')}
                  >
                    <span className="material-symbols-outlined">palette</span>
                    <span>Appearance</span>
                  </button>
                  <button
                    type="button"
                    className={`bbdrts-studio-nav-item ${activeTab === 'security' ? 'active' : ''}`}
                    onClick={() => setActiveTab('security')}
                  >
                    <span className="material-symbols-outlined">lock</span>
                    <span>Security & Web3</span>
                  </button>
                </>
              )}
            </div>

            {/* Sidebar Protocol Badge */}
            <div className="bbdrts-studio-sidebar-footer">
              <div className="bbdrts-sidebar-user-card">
                <div className="bbdrts-sidebar-user-avatar">
                  {avatarUrl && (avatarUrl.startsWith('data:') || avatarUrl.startsWith('http')) ? (
                    <img src={avatarUrl} alt="Avatar" />
                  ) : avatarUrl && avatarUrl.length < 30 ? (
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--accent, #22c55e)' }}>{avatarUrl}</span>
                  ) : (
                    userInitials
                  )}
                </div>
                <div className="bbdrts-sidebar-user-info">
                  <strong title={isOrg ? (orgName || displayName) : displayName}>{isOrg ? (orgName || displayName) : displayName}</strong>
                  <span>BBDRTS-{isOrg ? 'NGO' : 'DONOR'}-2026</span>
                </div>
              </div>
            </div>
          </aside>

          {/* ── Right Content Canvas ── */}
          <main className="bbdrts-studio-main">
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

              <div className="bbdrts-studio-scroll-area">
                {/* ══════════════════════════════════════════════════
                    DONOR: PUBLIC PERSONA TAB
                   ══════════════════════════════════════════════════ */}
                {!isOrg && !isAdmin && activeTab === 'persona' && (
                  <div className="bbdrts-studio-pane fade-in">

                    {/* Clean Humanitarian Donor Avatar Studio Card */}
                    <div className="bbdrts-studio-avatar-card">
                      <div className="bbdrts-studio-avatar-content">
                        <div className="bbdrts-studio-avatar-wrap">
                          {avatarUrl && (avatarUrl.startsWith('data:') || avatarUrl.startsWith('http')) ? (
                            <img src={avatarUrl} alt="Avatar" className="bbdrts-studio-avatar-img" />
                          ) : avatarUrl && avatarUrl.length < 30 ? (
                            <div className="bbdrts-studio-avatar-icon">
                              <span className="material-symbols-outlined">{avatarUrl}</span>
                            </div>
                          ) : (
                            <div className="bbdrts-studio-avatar-initials">{userInitials}</div>
                          )}
                          <button
                            type="button"
                            className="bbdrts-studio-avatar-cam-btn"
                            onClick={() => fileInputRef.current?.click()}
                            title="Upload new profile picture"
                          >
                            <span className="material-symbols-outlined">photo_camera</span>
                          </button>
                        </div>

                        <div className="bbdrts-studio-avatar-meta">
                          <div className="bbdrts-studio-avatar-name-row">
                            <h4>{displayName}</h4>
                            <span className="bbdrts-studio-role-pill">
                              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>verified</span>
                              Verified Relief Donor
                            </span>
                          </div>
                          <p className="bbdrts-studio-avatar-sub">PNG, JPG, or WEBP up to 15MB • 1:1 square ratio recommended</p>

                          <div className="bbdrts-studio-avatar-actions">
                            <button
                              type="button"
                              className="bbdrts-studio-btn-sm primary"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              <span className="material-symbols-outlined">upload</span>
                              <span>Upload Photo</span>
                            </button>

                            {(avatarUrl || originalImageSrc) && (avatarUrl?.startsWith('data:') || avatarUrl?.startsWith('http') || originalImageSrc?.startsWith('data:') || originalImageSrc?.startsWith('http')) && (
                              <button
                                type="button"
                                className="bbdrts-studio-btn-sm outline"
                                onClick={handleOpenAdjuster}
                                title="Re-adjust zoom, pan, and rotation"
                              >
                                <span className="material-symbols-outlined">tune</span>
                                <span>Adjust Framing</span>
                              </button>
                            )}

                            {avatarUrl && (
                              <button
                                type="button"
                                className="bbdrts-studio-btn-sm danger"
                                onClick={handleRemovePhoto}
                              >
                                Reset
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Preset Badges Selector */}
                      <div className="bbdrts-studio-preset-bar">
                        <span className="bbdrts-studio-preset-title">Or choose a supporter badge:</span>
                        <div className="bbdrts-studio-preset-grid">
                          {DONOR_AVATAR_PRESETS.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              className={`bbdrts-studio-preset-btn ${avatarUrl === p.icon ? 'active' : ''}`}
                              onClick={() => setAvatarUrl(p.icon)}
                              title={p.label}
                            >
                              <span className="material-symbols-outlined" style={{ color: p.color }}>
                                {p.icon}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Public Display Name Section Card */}
                    <div className="bbdrts-studio-card">
                      <div className="bbdrts-studio-card-header">
                        <div className="bbdrts-studio-card-title-wrap">
                          <span className="material-symbols-outlined" style={{ color: 'var(--accent, #22c55e)' }}>badge</span>
                          <div>
                            <h5>Public Display Name</h5>
                            <span>Shown on public campaign leaderboards, donor passes, and receipts.</span>
                          </div>
                        </div>
                        {isCooldownActive ? (
                          <span className="bbdrts-cooldown-pill" title={`Cooldown in effect until ${nextAvailableDateStr}`}>
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>lock_clock</span>
                            <span>14d Cooldown • {nextAvailableDateStr}</span>
                          </span>
                        ) : (
                          <span className="bbdrts-ready-pill">
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>check_circle</span>
                            <span>Ready to update</span>
                          </span>
                        )}
                      </div>

                      <div className="bbdrts-studio-field-box">
                        <div className="bbdrts-input-icon-wrap">
                          <span className="material-symbols-outlined bbdrts-input-icon">person</span>
                          <input
                            type="text"
                            className={`bbdrts-studio-input ${isCooldownActive ? 'disabled' : ''} ${displayNameError ? 'error' : ''}`}
                            value={displayName}
                            onChange={e => {
                              const val = e.target.value;
                              setDisplayName(val);
                              setDisplayNameError(checkDisplayNameValidation(val));
                            }}
                            placeholder="e.g. CryptoPatron, LeyteRelief, ShieldOfHope"
                            disabled={isCooldownActive}
                            required
                          />
                        </div>

                        {/* Error & Cooldown Feedback Slot */}
                        <div className="bbdrts-field-feedback-slot">
                          {displayNameError ? (
                            <div className="bbdrts-status-error">
                              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>warning</span>
                              <span>{displayNameError}</span>
                            </div>
                          ) : (
                            <span className="bbdrts-status-hint">
                              {isCooldownActive
                                ? `Display name changes are limited to once every ${COOLDOWN_DAYS} days. Profile photos can be changed freely anytime.`
                                : `Must be 3–30 characters long. Modifying this starts a ${COOLDOWN_DAYS}-day security cooldown.`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Personal Bio Card */}
                    <div className="bbdrts-studio-card">
                      <div className="bbdrts-studio-card-header">
                        <div className="bbdrts-studio-card-title-wrap">
                          <span className="material-symbols-outlined" style={{ color: 'var(--accent, #22c55e)' }}>edit_note</span>
                          <div>
                            <h5>Personal Bio / Supporter Note</h5>
                            <span>Share your humanitarian focus or a message with the relief community.</span>
                          </div>
                        </div>
                      </div>

                      <div className="bbdrts-studio-field-box">
                        <textarea
                          className="bbdrts-studio-textarea"
                          rows="2"
                          value={bio}
                          onChange={e => setBio(e.target.value)}
                          placeholder="e.g. Committed to transparent, verified, and rapid disaster response across Eastern Visayas..."
                        />
                      </div>
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
                            value={phone.replace(/^\+63\s*/, '')}
                            onChange={e => {
                              const raw = e.target.value;
                              const formatted = raw.startsWith('+63') ? raw : `+63 ${raw.replace(/^[0\s]+/, '')}`;
                              setPhone(formatted);
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

                        {/* Web3 Wallet */}
                        <div className="bbdrts-studio-cred-row">
                          <div className="bbdrts-studio-cred-meta">
                            <span className="bbdrts-studio-cred-label">Web3 MetaMask Public Key (Sepolia)</span>
                            <span className="bbdrts-studio-cred-val font-mono">
                              {currentUser?.wallet_address || 'No wallet connected'}
                            </span>
                          </div>
                          {currentUser?.wallet_address && (
                            <a
                              href={`https://sepolia.etherscan.io/address/${currentUser.wallet_address}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bbdrts-security-etherscan-link"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>open_in_new</span>
                              <span>Etherscan</span>
                            </a>
                          )}
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
                              <strong>Obsidian Dark</strong>
                              {theme === 'dark' && <span className="bbdrts-theme-active-tag">Active</span>}
                            </div>
                            <span>Deep high-contrast charcoal canvas with neon emerald relief accents.</span>
                          </div>
                        </div>

                        {/* Light Mode */}
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
                              <strong>Crisp Light</strong>
                              {theme === 'light' && <span className="bbdrts-theme-active-tag">Active</span>}
                            </div>
                            <span>Clean executive daytime canvas with soft borders and readable slate typography.</span>
                          </div>
                        </div>

                        {/* Cyber Neon */}
                        <div
                          className={`bbdrts-theme-choice-card ${theme === 'cyber' ? 'active' : ''}`}
                          onClick={() => {
                            if (setTheme) setTheme('cyber');
                            document.documentElement.setAttribute('data-theme', 'cyber');
                            localStorage.setItem('bbdrts_theme', 'cyber');
                          }}
                        >
                          <div className="bbdrts-theme-preview-box cyber">
                            <span className="material-symbols-outlined">terminal</span>
                          </div>
                          <div className="bbdrts-theme-choice-info">
                            <div className="bbdrts-theme-choice-title">
                              <strong>Cyber Terminal</strong>
                              {theme === 'cyber' && <span className="bbdrts-theme-active-tag">Active</span>}
                            </div>
                            <span>High-tech Web3 command center with navy-cyan glow styling.</span>
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
                            <h5>Web3 Security & Cryptographic Sessions</h5>
                            <span>Manage cryptographic signing permissions and active protocol sessions.</span>
                          </div>
                        </div>
                      </div>

                      <div className="bbdrts-studio-credentials-list">
                        <div className="bbdrts-studio-cred-row">
                          <div className="bbdrts-studio-cred-meta">
                            <span className="bbdrts-studio-cred-label">EVM Cryptographic Protocol</span>
                            <span className="bbdrts-studio-cred-val">EIP-712 Typed Data Signatures Active</span>
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
                              wallet: currentUser?.wallet_address || 'Unconnected',
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
                  <div className="bbdrts-studio-pane fade-in">

                    {/* ── Unified Organization Profile & Half-Banner Card (50/50 Split) ── */}
                    <div className="bbdrts-ngo-header-card">
                      {/* Top Half: Cover Banner (Clickable Canvas with Center Hover Popup) */}
                      <div
                        className="bbdrts-ngo-banner-cover"
                        onClick={() => bannerInputRef.current?.click()}
                        title="Click anywhere to upload a new cover banner"
                      >
                        {/* High-Performance Dedicated Background Image Layer */}
                        <div
                          className="bbdrts-ngo-banner-bg"
                          style={
                            bannerUrl && (bannerUrl.startsWith('data:') || bannerUrl.startsWith('http') || bannerUrl.startsWith('/') || bannerUrl.includes('.jpg') || bannerUrl.includes('.png'))
                              ? { backgroundImage: `url(${bannerUrl})` }
                              : bannerUrl && bannerUrl.startsWith('linear-gradient')
                                ? { background: bannerUrl }
                                : { background: 'linear-gradient(135deg, #064e3b 0%, #0f172a 100%)' }
                          }
                        />

                        {/* Full-Coverage Dark Shroud (Zero Gaps, Complete 100% Uniform Darkening) */}
                        <div className="bbdrts-ngo-banner-shroud" />

                        {/* Center Hover Action Badge */}
                        <div className="bbdrts-ngo-banner-center-hover">
                          <div className="bbdrts-banner-hover-pill">
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>photo_camera</span>
                            <span>Click to Change Cover Banner</span>
                          </div>
                        </div>

                        {/* Corner Action Buttons on Hover */}
                        {bannerUrl && (
                          <div className="bbdrts-banner-corner-actions">
                            <button
                              type="button"
                              className="bbdrts-banner-corner-btn danger"
                              onClick={(e) => {
                                e.stopPropagation();
                                setBannerUrl('');
                              }}
                              title="Remove cover banner"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>delete</span>
                              <span>Remove</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Bottom Half: Profile Lower Space with 50% Overlapping Avatar & Org Name Beside */}
                      <div className="bbdrts-ngo-profile-lower">
                        <div className="bbdrts-ngo-identity-row">
                          {/* 50% Overlapping Logo Avatar Circle */}
                          <div className="bbdrts-ngo-avatar-overlap-wrap">
                            <div
                              className="bbdrts-ngo-avatar-circle"
                              onClick={() => fileInputRef.current?.click()}
                              title="Click to change organization logo"
                            >
                              {/* Inner Container with 100% Boundary Clipping to Prevent Un-Darkened Rim */}
                              <div className="bbdrts-ngo-avatar-inner">
                                {avatarUrl && (avatarUrl.startsWith('data:') || avatarUrl.startsWith('http')) ? (
                                  <img src={avatarUrl} alt="Logo" className="bbdrts-ngo-avatar-img" />
                                ) : avatarUrl && avatarUrl.length < 30 ? (
                                  <span className="material-symbols-outlined" style={{ fontSize: '46px', color: 'var(--accent, #22c55e)' }}>{avatarUrl}</span>
                                ) : (
                                  userInitials
                                )}

                                {/* Hover Darkening Shroud with "Change" Callout */}
                                <div className="bbdrts-ngo-avatar-hover-shroud">
                                  <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>photo_camera</span>
                                  <span>Change</span>
                                </div>
                              </div>

                              {/* Integrated Bottom-Right Camera Badge */}
                              <div
                                className="bbdrts-avatar-action-badge upload"
                                title="Upload new organization logo"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>photo_camera</span>
                              </div>

                              {/* Integrated Top-Left Remove Badge (shown when custom logo exists) */}
                              {avatarUrl && (
                                <button
                                  type="button"
                                  className="bbdrts-avatar-action-badge remove"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemovePhoto();
                                  }}
                                  title="Remove organization logo"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Organization Name & Verified Badge (Directly Beside Avatar) */}
                          <div className="bbdrts-ngo-meta-section">
                            <div className="bbdrts-ngo-name-row">
                              <h4>{orgName || 'Organization Profile'}</h4>
                              <span
                                className="bbdrts-verified-badge-icon"
                                title={`SEC Verified NGO • Verified ${verifiedDateStr}`}
                                aria-label={`SEC Verified NGO • Verified ${verifiedDateStr}`}
                              >
                                <span className="material-symbols-outlined">verified</span>
                              </span>
                            </div>
                            <p className="bbdrts-ngo-subtext">Verified Non-Profit Humanitarian Organization • Verified {verifiedDateStr}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ── Official Institutional Information ── */}
                    <div className="bbdrts-studio-card" style={{ marginTop: '14px' }}>
                      <div className="bbdrts-studio-card-header">
                        <div className="bbdrts-studio-card-title-wrap">
                          <span className="material-symbols-outlined" style={{ color: 'var(--accent, #22c55e)' }}>corporate_fare</span>
                          <div>
                            <h5>Official Non-Profit Information</h5>
                            <span>Institutional credentials displayed across relief campaigns and public ledger.</span>
                          </div>
                        </div>
                      </div>

                      <div className="bbdrts-studio-field-box">
                        <label className="bbdrts-studio-label">Official Non-Profit / NGO Name</label>
                        <input
                          type="text"
                          className="bbdrts-studio-input"
                          value={orgName}
                          onChange={e => setOrgName(e.target.value)}
                          placeholder="e.g. Philippine Red Cross - Southern Leyte Chapter"
                          required
                        />
                      </div>

                      <div className="bbdrts-studio-field-box">
                        <label className="bbdrts-studio-label">Official Website Portal</label>
                        <input
                          type="url"
                          className="bbdrts-studio-input"
                          value={website}
                          onChange={e => setWebsite(e.target.value)}
                          placeholder="https://redcross.org.ph"
                        />
                      </div>

                      <div className="bbdrts-studio-field-box">
                        <label className="bbdrts-studio-label">Humanitarian Mission Statement</label>
                        <textarea
                          className="bbdrts-studio-textarea"
                          rows="3"
                          value={bio}
                          onChange={e => setBio(e.target.value)}
                          placeholder="Describe your organization's mission, emergency response focus, and disaster relief capabilities..."
                        />
                      </div>
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

                {isOrg && activeTab === 'org_payments' && (
                  <div className="bbdrts-studio-pane fade-in">
                    <div className="bbdrts-studio-banner-notice">
                      <span className="material-symbols-outlined" style={{ color: '#38bdf8' }}>account_balance_wallet</span>
                      <div>
                        <strong>Direct Electronic Relief Disbursement Channels</strong>
                        <span>Configure verified GCash, Maya, and Commercial Bank accounts with official account holder credentials for emergency fiat aid disbursements.</span>
                      </div>
                    </div>

                    {/* 1. Official GCash Channel */}
                    <div className="bbdrts-studio-card">
                      <div className="bbdrts-studio-card-header">
                        <div className="bbdrts-studio-card-title-wrap">
                          <div className="bbdrts-studio-card-icon-box" style={{ background: 'rgba(0, 125, 254, 0.12)', borderColor: 'rgba(0, 125, 254, 0.3)', color: '#007dfe' }}>
                            <span className="material-symbols-outlined" style={{ color: '#007dfe' }}>smartphone</span>
                          </div>
                          <div>
                            <h5>Official GCash Humanitarian Channel</h5>
                            <span>Mobile receiving number and verified account holder name</span>
                          </div>
                        </div>
                        {gcashQrUrl && (
                          <span className="bbdrts-verified-badge-inline" style={{ color: '#007dfe', borderColor: 'rgba(0, 125, 254, 0.3)', background: 'rgba(0, 125, 254, 0.1)' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>qr_code_scanner</span>
                            QR Ph Ready
                          </span>
                        )}
                      </div>

                      <div className="bbdrts-studio-grid-2">
                        <div className="bbdrts-studio-field-box">
                          <label className="bbdrts-studio-label">Official GCash Account Name</label>
                          <input
                            type="text"
                            className="bbdrts-studio-input"
                            value={gcashName}
                            onChange={e => setGcashName(e.target.value)}
                            placeholder="e.g. Philippine Red Cross - Southern Leyte"
                          />
                          <span className="bbdrts-field-hint">
                            Must match the registered account name on your recipient GCash account.
                          </span>
                        </div>

                        <div className="bbdrts-studio-field-box">
                          <label className="bbdrts-studio-label">Official GCash Relief Number</label>
                          <div className="bbdrts-input-icon-wrap">
                            <span className="material-symbols-outlined bbdrts-input-icon" style={{ color: '#007dfe' }}>call</span>
                            <input
                              type="text"
                              className="bbdrts-studio-input"
                              value={gcashNumber}
                              onChange={e => setGcashNumber(e.target.value)}
                              placeholder="0917-XXX-XXXX"
                            />
                          </div>
                          <span className="bbdrts-field-hint">
                            Donors can copy and transfer emergency funds directly to this GCash mobile number.
                          </span>
                        </div>
                      </div>

                      {/* Compact QR Upload Strip */}
                      <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed var(--border, rgba(255,255,255,0.08))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {gcashQrUrl ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <img src={gcashQrUrl} alt="GCash QR" style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'contain', border: '1px solid #007dfe', background: '#fff' }} />
                              <div>
                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#007dfe', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>verified</span> GCash QR Ph Ready
                                </div>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)' }}>Official QR code image attached</span>
                              </div>
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted, #94a3b8)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#007dfe' }}>qr_code_scanner</span>
                              <span>Optional: Attach official GCash QR Ph image</span>
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => gcashFileInputRef.current?.click()}
                            style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(0, 125, 254, 0.12)', border: '1px solid rgba(0, 125, 254, 0.3)', color: '#007dfe', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>upload</span>
                            {gcashQrUrl ? 'Change QR' : 'Upload GCash QR'}
                          </button>
                          {gcashQrUrl && (
                            <button
                              type="button"
                              onClick={() => setGcashQrUrl('')}
                              style={{ padding: '6px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#ef4444', cursor: 'pointer' }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <input
                          type="file"
                          ref={gcashFileInputRef}
                          accept="image/*"
                          onChange={e => handleQrUpload(e.target.files?.[0], setGcashQrUrl, 'GCash')}
                          style={{ display: 'none' }}
                        />
                      </div>
                    </div>

                    {/* 2. Official Maya Channel */}
                    <div className="bbdrts-studio-card" style={{ marginTop: '14px' }}>
                      <div className="bbdrts-studio-card-header">
                        <div className="bbdrts-studio-card-title-wrap">
                          <div className="bbdrts-studio-card-icon-box" style={{ background: 'rgba(0, 214, 143, 0.12)', borderColor: 'rgba(0, 214, 143, 0.3)', color: '#00d68f' }}>
                            <span className="material-symbols-outlined" style={{ color: '#00d68f' }}>credit_card</span>
                          </div>
                          <div>
                            <h5>Official Maya Relief Channel</h5>
                            <span>Merchant / personal receiving number and registered account name</span>
                          </div>
                        </div>
                        {mayaQrUrl && (
                          <span className="bbdrts-verified-badge-inline" style={{ color: '#00d68f', borderColor: 'rgba(0, 214, 143, 0.3)', background: 'rgba(0, 214, 143, 0.1)' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>qr_code_scanner</span>
                            QR Ph Ready
                          </span>
                        )}
                      </div>

                      <div className="bbdrts-studio-grid-2">
                        <div className="bbdrts-studio-field-box">
                          <label className="bbdrts-studio-label">Official Maya Account Name</label>
                          <input
                            type="text"
                            className="bbdrts-studio-input"
                            value={mayaName}
                            onChange={e => setMayaName(e.target.value)}
                            placeholder="e.g. Philippine Red Cross or Official Merchant Name"
                          />
                          <span className="bbdrts-field-hint">
                            Registered account or merchant name displayed inside Maya.
                          </span>
                        </div>

                        <div className="bbdrts-studio-field-box">
                          <label className="bbdrts-studio-label">Official Maya Relief Number</label>
                          <div className="bbdrts-input-icon-wrap">
                            <span className="material-symbols-outlined bbdrts-input-icon" style={{ color: '#00d68f' }}>call</span>
                            <input
                              type="text"
                              className="bbdrts-studio-input"
                              value={mayaNumber}
                              onChange={e => setMayaNumber(e.target.value)}
                              placeholder="0918-XXX-XXXX"
                            />
                          </div>
                          <span className="bbdrts-field-hint">
                            Donors can send relief funds via Maya mobile or merchant account ID.
                          </span>
                        </div>
                      </div>

                      {/* Compact QR Upload Strip */}
                      <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed var(--border, rgba(255,255,255,0.08))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {mayaQrUrl ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <img src={mayaQrUrl} alt="Maya QR" style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'contain', border: '1px solid #00d68f', background: '#000' }} />
                              <div>
                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#00d68f', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>verified</span> Maya QR Ph Ready
                                </div>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)' }}>Official QR code image attached</span>
                              </div>
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted, #94a3b8)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#00d68f' }}>qr_code_scanner</span>
                              <span>Optional: Attach official Maya QR Ph image</span>
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => mayaFileInputRef.current?.click()}
                            style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(0, 214, 143, 0.12)', border: '1px solid rgba(0, 214, 143, 0.3)', color: '#00d68f', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>upload</span>
                            {mayaQrUrl ? 'Change QR' : 'Upload Maya QR'}
                          </button>
                          {mayaQrUrl && (
                            <button
                              type="button"
                              onClick={() => setMayaQrUrl('')}
                              style={{ padding: '6px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#ef4444', cursor: 'pointer' }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <input
                          type="file"
                          ref={mayaFileInputRef}
                          accept="image/*"
                          onChange={e => handleQrUpload(e.target.files?.[0], setMayaQrUrl, 'Maya')}
                          style={{ display: 'none' }}
                        />
                      </div>
                    </div>

                    {/* 3. Official Commercial Bank Account */}
                    <div className="bbdrts-studio-card" style={{ marginTop: '14px' }}>
                      <div className="bbdrts-studio-card-header">
                        <div className="bbdrts-studio-card-title-wrap">
                          <div className="bbdrts-studio-card-icon-box" style={{ background: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.3)', color: '#f59e0b' }}>
                            <span className="material-symbols-outlined" style={{ color: '#f59e0b' }}>assured_workload</span>
                          </div>
                          <div>
                            <h5>Official Commercial Bank Account</h5>
                            <span>Structured banking credentials for direct electronic bank deposits (InstaPay / PESONet)</span>
                          </div>
                        </div>
                        {bankQrUrl && (
                          <span className="bbdrts-verified-badge-inline" style={{ color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.3)', background: 'rgba(245, 158, 11, 0.1)' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>qr_code_scanner</span>
                            Bank QR Attached
                          </span>
                        )}
                      </div>

                      <div className="bbdrts-studio-grid-2">
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
                          />
                          <span className="bbdrts-field-hint">
                            Designated relief savings or current checking account number.
                          </span>
                        </div>
                      </div>

                      <div className="bbdrts-studio-field-box" style={{ marginTop: '12px' }}>
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

                      {/* Compact QR Upload Strip */}
                      <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed var(--border, rgba(255,255,255,0.08))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {bankQrUrl ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <img src={bankQrUrl} alt="Bank QR" style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'contain', border: '1px solid #f59e0b', background: '#fff' }} />
                              <div>
                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>verified</span> Bank QR Attached
                                </div>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)' }}>InstaPay / PESONet QR code attached</span>
                              </div>
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted, #94a3b8)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#f59e0b' }}>qr_code_scanner</span>
                              <span>Optional: Attach Bank Transfer / InstaPay QR code image</span>
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => bankFileInputRef.current?.click()}
                            style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#f59e0b', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>upload</span>
                            {bankQrUrl ? 'Change QR' : 'Upload Bank QR'}
                          </button>
                          {bankQrUrl && (
                            <button
                              type="button"
                              onClick={() => setBankQrUrl('')}
                              style={{ padding: '6px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#ef4444', cursor: 'pointer' }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <input
                          type="file"
                          ref={bankFileInputRef}
                          accept="image/*"
                          onChange={e => handleQrUpload(e.target.files?.[0], setBankQrUrl, 'Bank')}
                          style={{ display: 'none' }}
                        />
                      </div>
                    </div>

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

              {/* ── Studio Fixed Bottom Footer ── */}
              <div className="bbdrts-studio-footer">
                <button
                  type="button"
                  className="bbdrts-studio-btn-cancel"
                  onClick={handleSmoothClose}
                  disabled={saveState === 'saving' || saveState === 'success'}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`bbdrts-studio-btn-save ${saveState === 'success' ? 'success' : ''}`}
                  disabled={saveState === 'saving' || saveState === 'success'}
                >
                  {saveState === 'saving' && (
                    <>
                      <div className="spinner" style={{ width: '15px', height: '15px' }} />
                      <span>Saving Changes...</span>
                    </>
                  )}
                  {saveState === 'success' && (
                    <>
                      <span className="material-symbols-outlined bbdrts-success-pop-icon" style={{ fontSize: '18px' }}>check_circle</span>
                      <span>Changes Saved ✓</span>
                    </>
                  )}
                  {saveState === 'idle' && (
                    <>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>save</span>
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </main>

        </div>

      </div>

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

              {/* Centered Zoom Bar: [Zoom Out] ───🔘─── [Zoom In] 100% */}
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
