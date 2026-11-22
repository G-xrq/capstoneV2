import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { API_URL } from '../config';
import { useToast } from '../context/ToastContext';
import { formatPhoneNumber, cleanPhoneNumber } from '../utils/formatters';
import { autoCropQrScreenshot } from '../utils/qrCropper';
import { getRegions, getRegionForProvince } from '../data/philippineGeoData';
import LocationMapPicker from './LocationMapPicker';
import './EditCampaignModal.css';

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

const WIZARD_STEPS = [
  { num: 1, label: 'Schedule' },
  { num: 2, label: 'Location' },
  { num: 3, label: 'Story & Tags' },
  { num: 4, label: 'Payment & QR' }
];

export default function EditCampaignModal({ camp, isOpen, onClose, onSaved }) {
  const { showSuccess, showError, showWarning } = useToast();

  // Wizard Stepper State: 1 to 4 (matching Deploy Campaign)
  const [currentStep, setCurrentStep] = useState(1);

  // Editable Fields
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [urgency, setUrgency] = useState('');
  const [beneficiariesImpact, setBeneficiariesImpact] = useState('');
  const [locationRegion, setLocationRegion] = useState('');
  const [gpsCoordinates, setGpsCoordinates] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [customTagInput, setCustomTagInput] = useState('');
  const [saving, setSaving] = useState(false);

  // Granular Address Details (Deploy Campaign Image 3 Standard)
  const [street, setStreet] = useState('');
  const [barangay, setBarangay] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [region, setRegion] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [country, setCountry] = useState('Philippines');
  const [landmark, setLandmark] = useState('');
  const [isFindingLocation, setIsFindingLocation] = useState(false);
  const [mapSearchTrigger, setMapSearchTrigger] = useState(null);

  // Dropdown Popovers State (Deploy Campaign Style)
  const [showUrgencyDropdown, setShowUrgencyDropdown] = useState(false);
  const urgencyDropdownRef = useRef(null);

  // Calendar Popover State
  const [deliveryDatePickerOpen, setDeliveryDatePickerOpen] = useState(false);
  const [calViewDate, setCalViewDate] = useState(() => new Date());
  const deliveryDateContainerRef = useRef(null);
  const nativeDateInputRef = useRef(null);

  // Payment Relief Channels
  const [activePaymentChannelTab, setActivePaymentChannelTab] = useState('gcash');
  const [gcashName, setGcashName] = useState('');
  const [gcashNumber, setGcashNumber] = useState('');
  const [gcashQrUrl, setGcashQrUrl] = useState('');

  const [mayaName, setMayaName] = useState('');
  const [mayaNumber, setMayaNumber] = useState('');
  const [mayaQrUrl, setMayaQrUrl] = useState('');

  const [bankName, setBankName] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankQrUrl, setBankQrUrl] = useState('');

  const [savedQrList, setSavedQrList] = useState([]);
  const [showSelectQrModal, setShowSelectQrModal] = useState(null);
  const [uploadingQrRail, setUploadingQrRail] = useState(null);
  const [previewQrModalUrl, setPreviewQrModalUrl] = useState(null);

  // Fetch NGO's reusable QR code library
  const fetchSavedQrCodes = async () => {
    try {
      const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/organization/qr-codes`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.qr_codes || []);
        setSavedQrList(list);
      }
    } catch (err) {
      console.warn('Failed to load saved QR codes:', err);
    }
  };

  useEffect(() => {
    if (camp && isOpen) {
      setDescription(camp.description || '');
      const initialDate = camp.targetDate || camp.target_date || '';
      setTargetDate(initialDate);
      if (initialDate) {
        const d = new Date(initialDate + 'T00:00:00');
        if (!isNaN(d.getTime())) setCalViewDate(d);
      } else {
        setCalViewDate(new Date());
      }

      setUrgency(camp.urgency || 'HIGH (EMERGENCY AID)');
      setBeneficiariesImpact(camp.beneficiariesImpact || camp.beneficiaries_impact || '');
      const loc = camp.locationRegion || camp.location_region || camp.location || '';
      setLocationRegion(loc);
      setGpsCoordinates(camp.gpsCoordinates || camp.gps_coordinates || camp.gps || '');
      setContactInfo(camp.contactInfo || camp.contact_info || '');
      setDocumentUrl(camp.documentUrl || camp.document_url || '');

      // Parse granular location if available or initialize from composite string
      if (camp.street || camp.city || camp.province) {
        setStreet(camp.street || '');
        setBarangay(camp.barangay || '');
        setCity(camp.city || '');
        setProvince(camp.province || '');
        setRegion(camp.region || '');
        setZipCode(camp.zipCode || camp.zip_code || '');
        setLandmark(camp.landmark || '');
        setCountry(camp.country || 'Philippines');
      } else if (loc) {
        const parts = loc.split(',').map(s => s.trim());
        if (parts.length >= 3) {
          setStreet(parts[0] || '');
          setBarangay(parts[1] || '');
          setCity(parts[2] || '');
          if (parts[3]) {
            setProvince(parts[3]);
            const autoReg = getRegionForProvince(parts[3]);
            if (autoReg) setRegion(autoReg);
          }
        } else if (parts.length === 2) {
          setStreet(parts[0] || '');
          setCity(parts[1] || '');
        } else {
          setStreet(loc);
        }
        setCountry('Philippines');
      }

      setGcashName(camp.gcashName || camp.gcash_name || '');
      setGcashNumber(formatPhoneNumber(camp.gcashNumber || camp.gcash_number || ''));
      setGcashQrUrl(camp.gcashQrUrl || camp.gcash_qr_url || '');

      setMayaName(camp.mayaName || camp.maya_name || '');
      setMayaNumber(formatPhoneNumber(camp.mayaNumber || camp.maya_number || ''));
      setMayaQrUrl(camp.mayaQrUrl || camp.maya_qr_url || '');

      setBankName(camp.bankName || camp.bank_name || '');
      setBankAccountName(camp.bankAccountName || camp.bank_account_name || '');
      setBankAccountNumber(formatPhoneNumber(camp.bankAccountNumber || camp.bank_account_number || ''));
      setBankQrUrl(camp.bankQrUrl || camp.bank_qr_url || '');

      fetchSavedQrCodes();

      const rawTags = camp.tags || camp.tags_json || camp.tagsJson || '';
      let tagsArr = [];
      if (Array.isArray(rawTags)) {
        tagsArr = rawTags.map(t => String(t).trim()).filter(Boolean);
      } else if (typeof rawTags === 'string' && rawTags.trim()) {
        tagsArr = rawTags.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean);
      }
      setSelectedTags(tagsArr);
      setCurrentStep(1);
      setDeliveryDatePickerOpen(false);
      setShowUrgencyDropdown(false);
      setShowSelectQrModal(null);
      setPreviewQrModalUrl(null);
    }
  }, [camp, isOpen]);

  // Outside click listener for popovers
  useEffect(() => {
    const handleOutside = (e) => {
      if (deliveryDateContainerRef.current && !deliveryDateContainerRef.current.contains(e.target)) {
        setDeliveryDatePickerOpen(false);
      }
      if (urgencyDropdownRef.current && !urgencyDropdownRef.current.contains(e.target)) {
        setShowUrgencyDropdown(false);
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setDeliveryDatePickerOpen(false);
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

  // Update composite address whenever any granular field changes
  const updateGranularField = (field, val) => {
    let nextStreet = field === 'street' ? val : street;
    let nextBarangay = field === 'barangay' ? val : barangay;
    let nextCity = field === 'city' ? val : city;
    let nextProvince = field === 'province' ? val : province;
    let nextRegion = field === 'region' ? val : region;
    let nextZip = field === 'zipCode' ? val : zipCode;
    let nextCountry = field === 'country' ? val : country;
    let nextLandmark = field === 'landmark' ? val : landmark;

    if (field === 'street') setStreet(val);
    else if (field === 'barangay') setBarangay(val);
    else if (field === 'city') setCity(val);
    else if (field === 'province') {
      setProvince(val);
      const autoReg = getRegionForProvince(val);
      if (autoReg) {
        setRegion(autoReg);
        nextRegion = autoReg;
      }
    }
    else if (field === 'region') setRegion(val);
    else if (field === 'zipCode') setZipCode(val);
    else if (field === 'country') setCountry(val);
    else if (field === 'landmark') setLandmark(val);

    const full = [
      nextStreet,
      nextBarangay,
      nextCity,
      nextProvince,
      nextRegion ? `(${nextRegion})` : '',
      nextZip,
      nextCountry || 'Philippines',
      nextLandmark ? `(Landmark: ${nextLandmark})` : ''
    ].filter(Boolean).join(', ');
    setLocationRegion(full);
  };

  // Two-way sync from Map pin / click to granular inputs
  const handleGranularAddressFromMap = ({ street: s = '', barangay: b = '', city: c = '', province: p = '', region: r = '', country: cnt = 'Philippines', zip: z = '', landmark: l = '', fullAddress = '' }) => {
    const resolvedRegion = r || (p ? getRegionForProvince(p) : '') || '';
    setStreet(s);
    setBarangay(b);
    setCity(c);
    setProvince(p);
    setRegion(resolvedRegion);
    setCountry(cnt || 'Philippines');
    setZipCode(z);
    setLandmark(l);

    const constructed = fullAddress || [
      s,
      b,
      c,
      p,
      resolvedRegion,
      z,
      cnt || 'Philippines',
      l ? `(Landmark: ${l})` : ''
    ].filter(Boolean).join(', ');
    setLocationRegion(constructed);
  };

  // Calendar cells computation (Deploy Campaign Style - Unrestricted Date Selection)
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

      if (diffDays <= 5) setUrgency('HIGH (EMERGENCY AID)');
      else if (diffDays <= 14) setUrgency('MEDIUM (URGENT REHABILITATION)');
      else setUrgency('STABLE (CHARITABLE AID)');
    }
  };

  // Quick Preset Date Helper
  const applyDatePreset = (daysOffset) => {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    handleTargetDateChange(iso);
    setCalViewDate(d);
  };

  const handleTagToggle = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleAddCustomTag = (e) => {
    e.preventDefault();
    const clean = customTagInput.trim().replace(/^#/, '');
    if (clean && !selectedTags.includes(clean)) {
      setSelectedTags([...selectedTags, clean]);
      setCustomTagInput('');
    }
  };

  if (!isOpen || !camp) return null;

  const rawTargetEth = camp.targetAmount || camp.target_amount || camp.target || '0';
  const targetEthFormatted = parseFloat(rawTargetEth) > 0 ? parseFloat(rawTargetEth).toFixed(4) : '0.0000';
  const rawTargetPhp = camp.targetAmountPhp || camp.target_amount_php || (parseFloat(rawTargetEth) * 170000);
  const targetPhpFormatted = Math.round(rawTargetPhp).toLocaleString('en-US');

  // Assign QR from library
  const handleSelectSavedQr = (qr) => {
    if (qr.payment_method === 'GCash') {
      setGcashQrUrl(qr.qr_image_url);
      if (qr.account_name) setGcashName(qr.account_name);
      if (qr.account_number) setGcashNumber(formatPhoneNumber(qr.account_number));
      showSuccess(`Assigned "${qr.custom_name}" GCash QR!`, 'QR Code Assigned');
    } else if (qr.payment_method === 'Maya') {
      setMayaQrUrl(qr.qr_image_url);
      if (qr.account_name) setMayaName(qr.account_name);
      if (qr.account_number) setMayaNumber(formatPhoneNumber(qr.account_number));
      showSuccess(`Assigned "${qr.custom_name}" Maya QR!`, 'QR Code Assigned');
    } else if (qr.payment_method === 'Bank') {
      setBankQrUrl(qr.qr_image_url);
      if (qr.account_name) setBankAccountName(qr.account_name);
      if (qr.account_number) setBankAccountNumber(formatPhoneNumber(qr.account_number));
      showSuccess(`Assigned "${qr.custom_name}" Bank QR!`, 'QR Code Assigned');
    }
    setShowSelectQrModal(null);
  };

  // Upload new QR code with auto-crop
  const handleUploadNewQr = async (rail, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingQrRail(rail);
    try {
      const croppedUrl = await autoCropQrScreenshot(file);
      if (rail === 'GCash') setGcashQrUrl(croppedUrl);
      else if (rail === 'Maya') setMayaQrUrl(croppedUrl);
      else if (rail === 'Bank') setBankQrUrl(croppedUrl);

      showSuccess(`Successfully cropped and attached ${rail} QR code!`, 'QR Code Ready');
    } catch (_) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (rail === 'GCash') setGcashQrUrl(ev.target.result);
        else if (rail === 'Maya') setMayaQrUrl(ev.target.result);
        else if (rail === 'Bank') setBankQrUrl(ev.target.result);
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadingQrRail(null);
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    try {
      setSaving(true);
      const token = localStorage.getItem('bbdrts_token');
      if (!token) {
        showWarning('Please login to update campaign details.', 'Authentication Required');
        return;
      }

      const res = await fetch(`${API_URL}/api/campaigns/${camp.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          description: description.trim(),
          target_date: targetDate,
          urgency: urgency,
          beneficiaries_impact: beneficiariesImpact.trim(),
          location_region: locationRegion.trim(),
          gps_coordinates: gpsCoordinates.trim(),
          contact_info: contactInfo.trim(),
          tags: selectedTags.join(', '),
          document_url: documentUrl.trim(),
          street: street.trim(),
          barangay: barangay.trim(),
          city: city.trim(),
          province: province.trim(),
          region: region.trim(),
          zip_code: zipCode.trim(),
          country: country.trim(),
          landmark: landmark.trim(),
          gcash_name: gcashName.trim(),
          gcash_number: cleanPhoneNumber(gcashNumber),
          gcash_qr_url: gcashQrUrl,
          maya_name: mayaName.trim(),
          maya_number: cleanPhoneNumber(mayaNumber),
          maya_qr_url: mayaQrUrl,
          bank_name: bankName.trim(),
          bank_account_name: bankAccountName.trim(),
          bank_account_number: bankAccountNumber.trim(),
          bank_qr_url: bankQrUrl
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to update campaign details.');
      }

      showSuccess('Campaign details updated successfully!', 'Changes Saved');
      onSaved?.();
      onClose();
    } catch (err) {
      console.error(err);
      showError(err.message, 'Update Failed');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="bbdrts-edit-camp-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="bbdrts-edit-camp-modal" onClick={(e) => e.stopPropagation()}>

        {/* ── 1. Modal Header ── */}
        <div className="bbdrts-edit-header">
          <div className="bbdrts-edit-title-wrap">
            <div className="bbdrts-edit-icon">
              <span className="material-symbols-outlined">edit_note</span>
            </div>
            <div>
              <div className="bbdrts-edit-title-line">
                <h2 className="bbdrts-edit-title">Edit Campaign Settings</h2>
                <span className="bbdrts-camp-id-badge">#{camp.id}</span>
              </div>
              <div className="bbdrts-edit-subtitle" title={camp.title}>
                {camp.title}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="bbdrts-edit-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* ── 2. EVM Cryptographic Lock Strip ── */}
        <div className="bbdrts-edit-lock-strip">
          <div className="lock-left">
            <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#10b981' }}>lock</span>
            <span>
              Target fund (<strong className="font-mono">₱{targetPhpFormatted}</strong>) is cryptographically locked on the Sepolia audit ledger. Operational relief and field details below can be updated at any time.
            </span>
          </div>
          <span className="audited-pill">On-Chain Audited</span>
        </div>

        {/* ── 3. Interactive Multi-Step Stepper Bar (Matching Image 1 & Deploy Campaign) ── */}
        <div className="bbdrts-stepper-wrap">
          <div className="bbdrts-edit-stepper-bar">
            {WIZARD_STEPS.map((st) => {
              const isActive = currentStep === st.num;
              const isCompleted = currentStep > st.num;
              return (
                <button
                  key={st.num}
                  type="button"
                  onClick={() => setCurrentStep(st.num)}
                  className={`bbdrts-edit-step-btn ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                  title={`Jump to Step ${st.num}: ${st.label}`}
                >
                  <span className="bbdrts-edit-step-num">
                    {isCompleted ? <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>check</span> : `0${st.num}`}
                  </span>
                  <span>{st.label}</span>
                </button>
              );
            })}
          </div>

          {/* Slim Progress Track Bar */}
          <div className="bbdrts-edit-progress-track">
            <div className="bbdrts-edit-progress-bar" style={{ width: `${currentStep * 25}%` }} />
          </div>
        </div>

        {/* ── 4. Scrollable Form Content Body ── */}
        <form id="edit-campaign-form" onSubmit={handleSubmit} className="bbdrts-edit-form">
          <div className="bbdrts-edit-scroll-body">

            {/* ════ STEP 1: OPERATIONAL TIMELINE & URGENCY PRIORITY ════ */}
            {currentStep === 1 && (
              <div className="bbdrts-step-card">
                <div className="bbdrts-step-header">
                  <div className="bbdrts-step-title-wrap">
                    <div className="bbdrts-step-icon-badge">
                      <span className="material-symbols-outlined">schedule</span>
                    </div>
                    <div>
                      <h3 className="bbdrts-step-title">1. Operational Timeline &amp; Urgency Priority</h3>
                      <div className="bbdrts-step-subtitle">
                        Adjust target relief delivery deadline, impact scope, and emergency aid priority.
                      </div>
                    </div>
                  </div>
                  <span className="bbdrts-step-pill">Step 1 of 4</span>
                </div>

                <div className="bbdrts-edit-grid-2">
                  {/* Delivery Date with Deploy Campaign Popover + Quick Preset Chips */}
                  <div className="bbdrts-field" style={{ position: 'relative' }} ref={deliveryDateContainerRef}>
                    <div className="bbdrts-field-label-row">
                      <label>Target Due Date <span style={{ color: '#ef4444' }}>*</span></label>
                      <div className="bbdrts-date-quick-chips">
                        <button type="button" className="bbdrts-date-chip-btn" onClick={() => applyDatePreset(7)} title="Set 7 days from now">+7d</button>
                        <button type="button" className="bbdrts-date-chip-btn" onClick={() => applyDatePreset(14)} title="Set 14 days from now">+14d</button>
                        <button type="button" className="bbdrts-date-chip-btn" onClick={() => applyDatePreset(30)} title="Set 30 days from now">+30d</button>
                        {targetDate && (
                          <button type="button" className="bbdrts-date-chip-btn" onClick={() => handleTargetDateChange('')} title="Clear selected date" style={{ color: '#f43f5e' }}>Clear</button>
                        )}
                      </div>
                    </div>

                    {/* Trigger Bar */}
                    <div
                      className="bbdrts-input-wrap"
                      style={{ cursor: 'pointer' }}
                      onClick={() => setDeliveryDatePickerOpen(prev => !prev)}
                    >
                      <span className="prefix material-symbols-outlined" style={{ color: targetDate ? '#10b981' : '#71717a' }}>calendar_month</span>
                      <span style={{ flex: 1, fontSize: '0.82rem', color: targetDate ? '#ededed' : '#71717a', fontWeight: targetDate ? 600 : 400 }}>
                        {targetDate ? formatSelectedDeliveryDate(targetDate) : 'Select Delivery Date...'}
                      </span>
                      {targetDate && (
                        <span
                          role="button"
                          onClick={(e) => { e.stopPropagation(); handleTargetDateChange(''); }}
                          style={{ color: '#71717a', cursor: 'pointer', padding: '2px', display: 'flex' }}
                          title="Clear date"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>close</span>
                        </span>
                      )}
                      <span
                        className="material-symbols-outlined"
                        style={{
                          fontSize: '1.1rem',
                          color: '#71717a',
                          transition: 'transform 0.15s ease',
                          transform: deliveryDatePickerOpen ? 'rotate(180deg)' : 'none'
                        }}
                      >
                        expand_more
                      </span>
                    </div>

                    {/* Hidden Native Date Input for Accessibility / Browser Pickers */}
                    <input
                      ref={nativeDateInputRef}
                      type="date"
                      value={targetDate}
                      onChange={(e) => handleTargetDateChange(e.target.value)}
                      style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
                      tabIndex={-1}
                    />

                    {/* Web3 Calendar Popover (Unrestricted Date Selection) */}
                    {deliveryDatePickerOpen && (
                      <div className="bbdrts-cal-popover" onClick={e => e.stopPropagation()}>
                        <div className="bbdrts-cal-header">
                          <button
                            type="button"
                            className="bbdrts-cal-header-btn"
                            onClick={() => setCalViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                            title="Previous Month"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>chevron_left</span>
                          </button>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className="bbdrts-cal-month-title">
                              {calViewDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                            </span>
                            <button
                              type="button"
                              className="bbdrts-date-chip-btn"
                              onClick={() => {
                                const now = new Date();
                                setCalViewDate(now);
                              }}
                              style={{ padding: '0 4px', fontSize: '0.62rem' }}
                            >
                              Today
                            </button>
                          </div>
                          <button
                            type="button"
                            className="bbdrts-cal-header-btn"
                            onClick={() => setCalViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                            title="Next Month"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>chevron_right</span>
                          </button>
                        </div>

                        <div className="bbdrts-cal-weekdays">
                          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <span key={d}>{d}</span>)}
                        </div>

                        <div className="bbdrts-cal-grid">
                          {calMonthCells.map((cell) => {
                            const isSelected = targetDate === cell.iso;
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const cellDate = new Date(cell.iso + 'T00:00:00');
                            const diffDays = Math.ceil((cellDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                            let dotColor = null;
                            if (cell.isCurrentMonth) {
                              if (diffDays >= 0 && diffDays <= 5) dotColor = '#ef4444';
                              else if (diffDays > 5 && diffDays <= 14) dotColor = '#f59e0b';
                              else if (diffDays > 14) dotColor = '#22c55e';
                            }

                            return (
                              <button
                                key={cell.iso}
                                type="button"
                                className={`bbdrts-cal-day ${!cell.isCurrentMonth ? 'outside' : ''} ${cell.isPast ? 'past' : ''} ${cell.isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                                onClick={() => {
                                  handleTargetDateChange(cell.iso);
                                  setDeliveryDatePickerOpen(false);
                                }}
                                title={`${cell.iso} (${diffDays === 0 ? 'Today' : `${diffDays} days from now`})`}
                              >
                                <span>{cell.dayNum}</span>
                                {dotColor && !isSelected && (
                                  <span className="bbdrts-cal-dot" style={{ background: dotColor }} />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <span className="field-hint">Setting a relief delivery deadline auto-calculates emergency urgency.</span>
                  </div>

                  {/* Urgency Status (Deploy Campaign Custom Dropdown Popover) */}
                  <div className="bbdrts-field" style={{ position: 'relative' }} ref={urgencyDropdownRef}>
                    <div className="bbdrts-field-label-row">
                      <label>Urgency Priority Level</label>
                      {targetDate && urgency && (
                        <span style={{ fontSize: '0.68rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>autorenew</span> Auto-set from date
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      className={`bbdrts-dropdown-trigger ${showUrgencyDropdown ? 'open' : ''}`}
                      onClick={() => setShowUrgencyDropdown(prev => !prev)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: urgency === 'HIGH (EMERGENCY AID)' ? '#ef4444' : (urgency === 'MEDIUM (URGENT REHABILITATION)' ? '#f59e0b' : (urgency === 'STABLE (CHARITABLE AID)' ? '#22c55e' : '#71717a')),
                            flexShrink: 0
                          }}
                        />
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: urgency ? '#ededed' : '#71717a' }}>
                          {urgency === 'HIGH (EMERGENCY AID)' && 'Critical Emergency (≤ 5 Days)'}
                          {urgency === 'MEDIUM (URGENT REHABILITATION)' && 'Urgent Relief (6–14 Days)'}
                          {urgency === 'STABLE (CHARITABLE AID)' && 'Standard Operations (> 14 Days)'}
                          {!urgency && 'Select Urgency Status...'}
                        </span>
                      </div>
                      <span
                        className="material-symbols-outlined"
                        style={{
                          fontSize: '1.1rem',
                          color: '#71717a',
                          transition: 'transform 0.15s ease',
                          transform: showUrgencyDropdown ? 'rotate(180deg)' : 'none'
                        }}
                      >
                        expand_more
                      </span>
                    </button>

                    {/* Popover */}
                    {showUrgencyDropdown && (
                      <div className="bbdrts-dropdown-popover" onClick={e => e.stopPropagation()}>
                        <div className="bbdrts-dropdown-popover-header">
                          <span>Urgency Status</span>
                        </div>

                        <button
                          type="button"
                          className={`bbdrts-dropdown-option ${urgency === 'HIGH (EMERGENCY AID)' ? 'active' : ''}`}
                          onClick={() => {
                            setUrgency('HIGH (EMERGENCY AID)');
                            setShowUrgencyDropdown(false);
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
                            <span>Critical Emergency (≤ 5 Days)</span>
                          </div>
                          {urgency === 'HIGH (EMERGENCY AID)' && (
                            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#22c55e' }}>check</span>
                          )}
                        </button>

                        <button
                          type="button"
                          className={`bbdrts-dropdown-option ${urgency === 'MEDIUM (URGENT REHABILITATION)' ? 'active' : ''}`}
                          onClick={() => {
                            setUrgency('MEDIUM (URGENT REHABILITATION)');
                            setShowUrgencyDropdown(false);
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} />
                            <span>Urgent Relief (6–14 Days)</span>
                          </div>
                          {urgency === 'MEDIUM (URGENT REHABILITATION)' && (
                            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#22c55e' }}>check</span>
                          )}
                        </button>

                        <button
                          type="button"
                          className={`bbdrts-dropdown-option ${urgency === 'STABLE (CHARITABLE AID)' ? 'active' : ''}`}
                          onClick={() => {
                            setUrgency('STABLE (CHARITABLE AID)');
                            setShowUrgencyDropdown(false);
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} />
                            <span>Standard Operations (&gt; 14 Days)</span>
                          </div>
                          {urgency === 'STABLE (CHARITABLE AID)' && (
                            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#22c55e' }}>check</span>
                          )}
                        </button>
                      </div>
                    )}
                    <span className="field-hint">Prioritizes campaign dispatch in disaster radar feeds.</span>
                  </div>
                </div>

                {/* Beneficiaries Scope */}
                <div className="bbdrts-field">
                  <label htmlFor="edit-beneficiaries">Estimated Beneficiaries / Impact Scope</label>
                  <div className="bbdrts-input-wrap">
                    <span className="prefix material-symbols-outlined">group</span>
                    <input
                      id="edit-beneficiaries"
                      type="text"
                      placeholder="e.g. 1,000 displaced families in Barangay Hibunawan"
                      value={beneficiariesImpact}
                      onChange={(e) => setBeneficiariesImpact(e.target.value)}
                    />
                  </div>
                  <span className="field-hint">Target family count or community population receiving assistance.</span>
                </div>
              </div>
            )}

            {/* ════ STEP 2: DISASTER LOCATION & GROUND PIN (DEPLOY CAMPAIGN IMAGE 3 EXACT MATCH) ════ */}
            {currentStep === 2 && (
              <div className="bbdrts-step-card">
                <div className="bbdrts-step-header">
                  <div className="bbdrts-step-title-wrap">
                    <div className="bbdrts-step-icon-badge">
                      <span className="material-symbols-outlined">explore</span>
                    </div>
                    <div>
                      <h3 className="bbdrts-step-title">2. Disaster Location &amp; Ground Pin</h3>
                      <div className="bbdrts-step-subtitle">
                        Enter the disaster ground location or click anywhere on the map to pin exact coordinates.
                      </div>
                    </div>
                  </div>
                  <span className="bbdrts-step-pill">Step 2 of 4</span>
                </div>

                <div className="bbdrts-location-map-grid">
                  {/* Left Column: Granular Address Details */}
                  <div className="bbdrts-location-left-col">
                    <div className="bbdrts-col-header-line">
                      <div className="bbdrts-col-header-title">
                        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#ef4444' }}>location_on</span>
                        <span>Complete Address Details</span>
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
                          style={{ fontSize: '0.70rem', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '2px 8px', borderRadius: '5px', display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'transparent', cursor: 'pointer' }}
                          title="Clear all address inputs"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>clear_all</span>
                          <span>Clear</span>
                        </button>
                      )}
                    </div>

                    {/* 1. Street / Building / House No. */}
                    <div className="bbdrts-field">
                      <label>Street / Building / House No.</label>
                      <div className="bbdrts-input-wrap">
                        <input
                          type="text"
                          placeholder="e.g., Rizal Street, Block 4"
                          value={street}
                          onChange={(e) => updateGranularField('street', e.target.value)}
                        />
                      </div>
                    </div>

                    {/* 2. Barangay & Municipality / City */}
                    <div className="bbdrts-edit-grid-2">
                      <div className="bbdrts-field">
                        <label>Barangay</label>
                        <div className="bbdrts-input-wrap">
                          <input
                            type="text"
                            placeholder="e.g., Barangay Abgao"
                            value={barangay}
                            onChange={(e) => updateGranularField('barangay', e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="bbdrts-field">
                        <label>Municipality / City <span style={{ color: '#ef4444' }}>*</span></label>
                        <div className="bbdrts-input-wrap">
                          <input
                            type="text"
                            placeholder="e.g., Maasin City"
                            value={city}
                            onChange={(e) => updateGranularField('city', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* 3. Province / State & Zip / Postal Code */}
                    <div className="bbdrts-edit-grid-2">
                      <div className="bbdrts-field">
                        <label>Province / State <span style={{ color: '#ef4444' }}>*</span></label>
                        <div className="bbdrts-input-wrap">
                          <input
                            type="text"
                            placeholder="e.g., Southern Leyte"
                            value={province}
                            onChange={(e) => updateGranularField('province', e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="bbdrts-field">
                        <label>Zip / Postal Code</label>
                        <div className="bbdrts-input-wrap">
                          <input
                            type="text"
                            placeholder="e.g., 6600"
                            value={zipCode}
                            onChange={(e) => updateGranularField('zipCode', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* 4. Region & Country */}
                    <div className="bbdrts-edit-grid-2">
                      <div className="bbdrts-field">
                        <label>Region <span style={{ color: '#ef4444' }}>*</span></label>
                        <div className="bbdrts-input-wrap">
                          <input
                            type="text"
                            list="ph-region-edit-options"
                            placeholder="e.g., Region VIII (Eastern Visayas)"
                            value={region}
                            onChange={(e) => updateGranularField('region', e.target.value)}
                          />
                          <datalist id="ph-region-edit-options">
                            {getRegions().map((r) => (
                              <option key={r} value={r} />
                            ))}
                          </datalist>
                        </div>
                      </div>
                      <div className="bbdrts-field">
                        <label>Country</label>
                        <div className="bbdrts-input-wrap">
                          <input
                            type="text"
                            placeholder="Philippines"
                            value={country}
                            onChange={(e) => updateGranularField('country', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* 5. Landmark / Evacuation Site (Optional) */}
                    <div className="bbdrts-field">
                      <label>Landmark / Evacuation Site (Optional)</label>
                      <div className="bbdrts-input-wrap">
                        <input
                          type="text"
                          placeholder="e.g., Near City Port, Rizal Park, Evacuation Center"
                          value={landmark}
                          onChange={(e) => updateGranularField('landmark', e.target.value)}
                        />
                      </div>
                    </div>

                    {/* 6. Find Location & Pin on Map Button */}
                    <button
                      type="button"
                      className="bbdrts-locate-btn"
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
                      disabled={isFindingLocation}
                    >
                      {isFindingLocation ? (
                        <>
                          <span className="material-symbols-outlined spin" style={{ fontSize: '18px', color: '#22c55e' }}>progress_activity</span>
                          <span>Locating on Map...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#22c55e' }}>explore</span>
                          <span>Find Location &amp; Pin on Map</span>
                        </>
                      )}
                    </button>

                    {/* 7. Confirmed Target Area Summary Box & GPS Badge */}
                    <div className="bbdrts-target-summary-box">
                      <div style={{ flex: 1, minWidth: '160px' }}>
                        <div style={{ fontSize: '0.68rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '13px', color: '#22c55e' }}>location_on</span>
                          <span>Confirmed Target Area:</span>
                        </div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: locationRegion ? '#ededed' : '#71717a', marginTop: '2px', wordBreak: 'break-word' }}>
                          {locationRegion || 'Fill inputs above or select a point on the map →'}
                        </div>
                      </div>
                      <div className="bbdrts-gps-badge">
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>my_location</span>
                        <span>GPS: {gpsCoordinates || '10.1333° N, 124.8667° E'}</span>
                      </div>
                    </div>

                    {/* 8. Field Operations Hotline / Contact */}
                    <div className="bbdrts-field" style={{ marginTop: '2px' }}>
                      <label htmlFor="edit-contact">Field Operations Contact &amp; Hotline</label>
                      <div className="bbdrts-input-wrap">
                        <span className="prefix material-symbols-outlined">call</span>
                        <input
                          id="edit-contact"
                          type="text"
                          placeholder="e.g. relief-operations@redcross.org.ph / (053) 832-1923"
                          value={contactInfo}
                          onChange={(e) => setContactInfo(e.target.value)}
                        />
                      </div>
                      <span className="field-hint">Official contact info for donor inquiries and logistics.</span>
                    </div>
                  </div>

                  {/* Right Column: Square Leaflet Map View */}
                  <div className="bbdrts-location-right-col">
                    <div className="bbdrts-col-header-line">
                      <div className="bbdrts-col-header-title">
                        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#22c55e' }}>pin_drop</span>
                        <span>Deployment Topo Map</span>
                      </div>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          color: '#22c55e',
                          background: 'rgba(34, 197, 94, 0.12)',
                          border: '1px solid rgba(34, 197, 94, 0.25)',
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
                        <span>Auto-Sync Pin</span>
                      </span>
                    </div>

                    <div className="bbdrts-map-frame-box">
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
                            'Map Location Set'
                          );
                          if (!zipCode && res.address?.postcode) {
                            setZipCode(res.address.postcode);
                          }
                        }}
                        onSearchStatus={(status) => {
                          setIsFindingLocation(false);
                          if (!status.success) {
                            showWarning(
                              'Could not find address on the map. Please verify municipality or click directly on the map.',
                              'Location Search'
                            );
                          }
                        }}
                        hideSearch={true}
                        allowLayerSwitch={true}
                        defaultLayer="terrain"
                        searchTrigger={mapSearchTrigger}
                        height="440px"
                        theme="dark"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ════ STEP 3: MISSION PURPOSE & CAMPAIGN TAGS ════ */}
            {currentStep === 3 && (
              <div className="bbdrts-step-card">
                <div className="bbdrts-step-header">
                  <div className="bbdrts-step-title-wrap">
                    <div className="bbdrts-step-icon-badge">
                      <span className="material-symbols-outlined">description</span>
                    </div>
                    <div>
                      <h3 className="bbdrts-step-title">3. Mission Purpose &amp; Campaign Operation Tags</h3>
                      <div className="bbdrts-step-subtitle">
                        Refine your humanitarian appeal narrative, operational tags, and official accreditation link.
                      </div>
                    </div>
                  </div>
                  <span className="bbdrts-step-pill">Step 3 of 4</span>
                </div>

                {/* Description */}
                <div className="bbdrts-field">
                  <label htmlFor="edit-description">Mission Purpose &amp; Operational Narrative</label>
                  <textarea
                    id="edit-description"
                    rows={4}
                    placeholder="Describe the disaster relief mission, emergency relief supply delivery, and recovery objectives..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                  <span className="field-hint">This narrative is public and visible to all global donors.</span>
                </div>

                {/* Operation Tags */}
                <div className="bbdrts-field">
                  <div className="bbdrts-field-label-row">
                    <label>Campaign Operation Tags</label>
                    <span style={{ fontSize: '0.70rem', color: '#10b981' }}>{selectedTags.length} Selected</span>
                  </div>
                  <div className="bbdrts-tag-chips-wrap">
                    {PRESET_CAMPAIGN_TAGS.map((tag) => {
                      const isSelected = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          className={`bbdrts-tag-chip ${isSelected ? 'active' : ''}`}
                          onClick={() => handleTagToggle(tag)}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                            {isSelected ? 'check' : 'add'}
                          </span>
                          <span>{tag}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Add Custom Tag */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <div className="bbdrts-input-wrap" style={{ flex: 1 }}>
                      <span className="prefix">#</span>
                      <input
                        type="text"
                        placeholder="Add custom tag (e.g. LeyteRebuild)..."
                        value={customTagInput}
                        onChange={(e) => setCustomTagInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddCustomTag(e); }}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={handleAddCustomTag}
                      style={{ padding: '0 12px', fontSize: '0.74rem' }}
                    >
                      Add Tag
                    </button>
                  </div>
                </div>

                {/* Accreditation URL */}
                <div className="bbdrts-field">
                  <label htmlFor="edit-doc">Accreditation Document or Evacuation Manifest Link</label>
                  <div className="bbdrts-input-wrap">
                    <span className="prefix material-symbols-outlined">link</span>
                    <input
                      id="edit-doc"
                      type="url"
                      placeholder="https://drive.google.com/... or IPFS / SEC certification link"
                      value={documentUrl}
                      onChange={(e) => setDocumentUrl(e.target.value)}
                    />
                  </div>
                  <span className="field-hint">Public link to SEC, DSWD, or NDRRMC verification documents.</span>
                </div>
              </div>
            )}

            {/* ════ STEP 4: PAYMENT RELIEF CHANNELS & QR CODES ════ */}
            {currentStep === 4 && (
              <div className="bbdrts-step-card">
                <div className="bbdrts-step-header">
                  <div className="bbdrts-step-title-wrap">
                    <div className="bbdrts-step-icon-badge">
                      <span className="material-symbols-outlined">qr_code_2</span>
                    </div>
                    <div>
                      <h3 className="bbdrts-step-title">4. Payment Relief Channels &amp; QR Codes</h3>
                      <div className="bbdrts-step-subtitle">
                        Manage receiving e-wallets, bank accounts, and verified QR Ph codes for donor contributions.
                      </div>
                    </div>
                  </div>
                  <span className="bbdrts-step-pill">Step 4 of 4</span>
                </div>

                {/* Payment Rail Switcher Tabs */}
                <div className="bbdrts-rail-switcher" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    className={`bbdrts-rail-btn ${activePaymentChannelTab === 'gcash' ? 'active' : ''}`}
                    onClick={() => setActivePaymentChannelTab('gcash')}
                  >
                    <span>GCash</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    className={`bbdrts-rail-btn ${activePaymentChannelTab === 'maya' ? 'active' : ''}`}
                    onClick={() => setActivePaymentChannelTab('maya')}
                  >
                    <span>Maya</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    className={`bbdrts-rail-btn ${activePaymentChannelTab === 'bank' ? 'active' : ''}`}
                    onClick={() => setActivePaymentChannelTab('bank')}
                  >
                    <span>Bank Transfer</span>
                  </button>
                </div>

                {/* GCASH RAIL */}
                {activePaymentChannelTab === 'gcash' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div className="bbdrts-edit-grid-2">
                      <div className="bbdrts-field">
                        <label>Official GCash Account Name</label>
                        <div className="bbdrts-input-wrap">
                          <input
                            type="text"
                            placeholder="e.g. ReliefLink Operations"
                            value={gcashName}
                            onChange={(e) => setGcashName(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="bbdrts-field">
                        <label>Official GCash Number</label>
                        <div className="bbdrts-input-wrap">
                          <input
                            type="text"
                            placeholder="e.g. 0917 123 4567"
                            value={gcashNumber}
                            onChange={(e) => setGcashNumber(formatPhoneNumber(e.target.value))}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bbdrts-qr-row-simple">
                      {gcashQrUrl ? (
                        <div className="bbdrts-qr-thumb" onClick={() => setPreviewQrModalUrl(gcashQrUrl)} title="Click to enlarge">
                          <img src={gcashQrUrl} alt="GCash QR" />
                        </div>
                      ) : (
                        <div className="bbdrts-qr-thumb" style={{ background: '#141414', border: '1px dashed #333' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '24px', color: '#71717a' }}>qr_code_2</span>
                        </div>
                      )}
                      <div className="bbdrts-qr-info">
                        <div className="title">GCash QR Ph Code</div>
                        <div className="sub">{gcashQrUrl ? 'Active QR Ph code attached' : 'No QR attached yet'}</div>
                        {gcashQrUrl && (
                          <button
                            type="button"
                            onClick={() => setGcashQrUrl('')}
                            style={{ background: 'transparent', border: 'none', color: '#f43f5e', fontSize: '0.68rem', cursor: 'pointer', textAlign: 'left', padding: 0, marginTop: '2px' }}
                          >
                            Remove QR
                          </button>
                        )}
                      </div>
                      <div className="bbdrts-qr-actions-row">
                        <button
                          type="button"
                          className="bbdrts-btn-qr-action"
                          onClick={() => setShowSelectQrModal('GCash')}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>bookmark</span>
                          <span>Library ({savedQrList.filter(q => q.payment_method === 'GCash').length})</span>
                        </button>
                        <label className="bbdrts-btn-qr-action" style={{ cursor: 'pointer', margin: 0 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>upload</span>
                          <span>{uploadingQrRail === 'GCash' ? 'Cropping...' : 'Upload QR'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={(e) => handleUploadNewQr('GCash', e)}
                            disabled={saving || uploadingQrRail === 'GCash'}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* MAYA RAIL */}
                {activePaymentChannelTab === 'maya' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div className="bbdrts-edit-grid-2">
                      <div className="bbdrts-field">
                        <label>Official Maya Account Name</label>
                        <div className="bbdrts-input-wrap">
                          <input
                            type="text"
                            placeholder="e.g. Philippine Red Cross"
                            value={mayaName}
                            onChange={(e) => setMayaName(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="bbdrts-field">
                        <label>Official Maya Number</label>
                        <div className="bbdrts-input-wrap">
                          <input
                            type="text"
                            placeholder="e.g. 0918 765 4321"
                            value={mayaNumber}
                            onChange={(e) => setMayaNumber(formatPhoneNumber(e.target.value))}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bbdrts-qr-row-simple">
                      {mayaQrUrl ? (
                        <div className="bbdrts-qr-thumb" onClick={() => setPreviewQrModalUrl(mayaQrUrl)} title="Click to enlarge">
                          <img src={mayaQrUrl} alt="Maya QR" />
                        </div>
                      ) : (
                        <div className="bbdrts-qr-thumb" style={{ background: '#141414', border: '1px dashed #333' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '24px', color: '#71717a' }}>qr_code_2</span>
                        </div>
                      )}
                      <div className="bbdrts-qr-info">
                        <div className="title">Maya QR Ph Code</div>
                        <div className="sub">{mayaQrUrl ? 'Active Maya QR attached' : 'No QR attached yet'}</div>
                        {mayaQrUrl && (
                          <button
                            type="button"
                            onClick={() => setMayaQrUrl('')}
                            style={{ background: 'transparent', border: 'none', color: '#f43f5e', fontSize: '0.68rem', cursor: 'pointer', textAlign: 'left', padding: 0, marginTop: '2px' }}
                          >
                            Remove QR
                          </button>
                        )}
                      </div>
                      <div className="bbdrts-qr-actions-row">
                        <button
                          type="button"
                          className="bbdrts-btn-qr-action"
                          onClick={() => setShowSelectQrModal('Maya')}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>bookmark</span>
                          <span>Library ({savedQrList.filter(q => q.payment_method === 'Maya').length})</span>
                        </button>
                        <label className="bbdrts-btn-qr-action" style={{ cursor: 'pointer', margin: 0 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>upload</span>
                          <span>{uploadingQrRail === 'Maya' ? 'Cropping...' : 'Upload QR'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={(e) => handleUploadNewQr('Maya', e)}
                            disabled={saving || uploadingQrRail === 'Maya'}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* BANK TRANSFER RAIL */}
                {activePaymentChannelTab === 'bank' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div className="bbdrts-edit-grid-2">
                      <div className="bbdrts-field">
                        <label>Bank Name</label>
                        <div className="bbdrts-input-wrap">
                          <input
                            type="text"
                            placeholder="e.g. BDO Unibank / BPI / Landbank"
                            value={bankName}
                            onChange={(e) => setBankName(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="bbdrts-field">
                        <label>Account Name</label>
                        <div className="bbdrts-input-wrap">
                          <input
                            type="text"
                            placeholder="e.g. Relief Foundation Inc."
                            value={bankAccountName}
                            onChange={(e) => setBankAccountName(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bbdrts-field">
                      <label>Bank Account Number</label>
                      <div className="bbdrts-input-wrap">
                        <input
                          type="text"
                          placeholder="e.g. 0012 3456 7890"
                          value={bankAccountNumber}
                          onChange={(e) => setBankAccountNumber(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="bbdrts-qr-row-simple">
                      {bankQrUrl ? (
                        <div className="bbdrts-qr-thumb" onClick={() => setPreviewQrModalUrl(bankQrUrl)} title="Click to enlarge">
                          <img src={bankQrUrl} alt="Bank QR" />
                        </div>
                      ) : (
                        <div className="bbdrts-qr-thumb" style={{ background: '#141414', border: '1px dashed #333' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '24px', color: '#71717a' }}>qr_code_2</span>
                        </div>
                      )}
                      <div className="bbdrts-qr-info">
                        <div className="title">Bank QR / Deposit Slip</div>
                        <div className="sub">{bankQrUrl ? 'Active Bank QR attached' : 'No QR attached yet'}</div>
                        {bankQrUrl && (
                          <button
                            type="button"
                            onClick={() => setBankQrUrl('')}
                            style={{ background: 'transparent', border: 'none', color: '#f43f5e', fontSize: '0.68rem', cursor: 'pointer', textAlign: 'left', padding: 0, marginTop: '2px' }}
                          >
                            Remove QR
                          </button>
                        )}
                      </div>
                      <div className="bbdrts-qr-actions-row">
                        <button
                          type="button"
                          className="bbdrts-btn-qr-action"
                          onClick={() => setShowSelectQrModal('Bank')}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>bookmark</span>
                          <span>Library ({savedQrList.filter(q => q.payment_method === 'Bank').length})</span>
                        </button>
                        <label className="bbdrts-btn-qr-action" style={{ cursor: 'pointer', margin: 0 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>upload</span>
                          <span>{uploadingQrRail === 'Bank' ? 'Cropping...' : 'Upload QR'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={(e) => handleUploadNewQr('Bank', e)}
                            disabled={saving || uploadingQrRail === 'Bank'}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* ── 5. Fixed Sticky Footer with Step Navigation & Save ── */}
          <div className="bbdrts-edit-footer">
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <div className="bbdrts-footer-actions-right">
              {currentStep > 1 && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setCurrentStep(s => Math.max(1, s - 1))}
                  disabled={saving}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
                  <span>Previous</span>
                </button>
              )}

              {currentStep < 4 ? (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setCurrentStep(s => Math.min(4, s + 1))}
                    disabled={saving}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    <span>Next Step</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
                  </button>

                  <button
                    type="submit"
                    className="btn btn-outline"
                    disabled={saving}
                    style={{ fontSize: '0.76rem', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.35)' }}
                    title="Save current modifications immediately"
                  >
                    <span>Save Now</span>
                  </button>
                </>
              ) : (
                <button
                  type="submit"
                  className="btn btn-primary bbdrts-btn-save"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" style={{ width: '15px', height: '15px', marginRight: '6px' }} />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>save</span>
                      <span>Save Campaign Details</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </form>

      </div>

      {/* ── SELECT REUSABLE QR CODE MODAL ── */}
      {showSelectQrModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(6px)',
            zIndex: 99999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setShowSelectQrModal(null)}
        >
          <div
            style={{
              background: '#0d0d0d',
              border: '1px solid #282828',
              borderRadius: '12px',
              padding: '18px 20px',
              width: '420px',
              maxWidth: '100%',
              boxShadow: '0 24px 50px rgba(0,0,0,0.9)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <strong style={{ fontSize: '0.88rem', color: '#ededed' }}>
                Select Saved {showSelectQrModal} QR Code
              </strong>
              <button
                type="button"
                onClick={() => setShowSelectQrModal(null)}
                style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
              </button>
            </div>

            <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {savedQrList.filter(q => q.payment_method === showSelectQrModal).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 10px', color: '#71717a', fontSize: '0.78rem' }}>
                  No saved {showSelectQrModal} QR codes found in your library.
                </div>
              ) : (
                savedQrList
                  .filter(q => q.payment_method === showSelectQrModal)
                  .map(qr => (
                    <div
                      key={qr.id}
                      onClick={() => handleSelectSavedQr(qr)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '8px 12px',
                        background: '#141414',
                        border: '1px solid #222222',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'border-color 0.12s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#444'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = '#222'}
                    >
                      <img src={qr.qr_image_url} alt={qr.custom_name} style={{ width: '40px', height: '40px', objectFit: 'contain', background: '#fff', borderRadius: '4px' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.80rem', fontWeight: 600, color: '#ededed' }}>{qr.custom_name}</div>
                        <div style={{ fontSize: '0.70rem', color: '#71717a' }}>{qr.account_name} ({qr.account_number})</div>
                      </div>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#10b981' }}>arrow_forward</span>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── IMAGE ZOOM PREVIEW MODAL ── */}
      {previewQrModalUrl && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.9)',
            backdropFilter: 'blur(8px)',
            zIndex: 999999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}
          onClick={() => setPreviewQrModalUrl(null)}
        >
          <div style={{ maxWidth: '380px', width: '100%', background: '#fff', borderRadius: '12px', padding: '16px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <img src={previewQrModalUrl} alt="QR Preview" style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '8px' }} />
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setPreviewQrModalUrl(null)}
              style={{ marginTop: '12px', width: '100%', color: '#000', borderColor: '#ccc' }}
            >
              Close Preview
            </button>
          </div>
        </div>
      )}

    </div>,
    document.body
  );
}
