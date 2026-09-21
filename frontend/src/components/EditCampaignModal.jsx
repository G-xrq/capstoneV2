import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { API_URL } from '../config';
import { useToast } from '../context/ToastContext';

// Preset tags identical to Campaign Deployment
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

export default function EditCampaignModal({ camp, isOpen, onClose, onSaved }) {
  const { showSuccess, showError, showWarning } = useToast();

  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [urgency, setUrgency] = useState('');
  const [beneficiariesImpact, setBeneficiariesImpact] = useState('');
  const [locationRegion, setLocationRegion] = useState('');
  const [gpsCoordinates, setGpsCoordinates] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [saving, setSaving] = useState(false);

  // Custom Web3 Calendar Popover state (matching Deploy Campaign)
  const [deliveryDatePickerOpen, setDeliveryDatePickerOpen] = useState(false);
  const [calViewDate, setCalViewDate] = useState(() => new Date());
  const deliveryDateContainerRef = useRef(null);

  // Initialize modal state when camp changes or modal opens
  useEffect(() => {
    if (camp && isOpen) {
      setDescription(camp.description || '');
      const initialDate = camp.targetDate || camp.target_date || '';
      setTargetDate(initialDate);
      if (initialDate) {
        const d = new Date(initialDate + 'T00:00:00');
        if (!isNaN(d.getTime())) {
          setCalViewDate(d);
        }
      } else {
        setCalViewDate(new Date());
      }

      setUrgency(camp.urgency || 'HIGH (EMERGENCY AID)');
      setBeneficiariesImpact(camp.beneficiariesImpact || camp.beneficiaries_impact || '');
      setLocationRegion(camp.locationRegion || camp.location_region || camp.location || '');
      setGpsCoordinates(camp.gpsCoordinates || camp.gps_coordinates || camp.gps || '');
      setContactInfo(camp.contactInfo || camp.contact_info || '');
      setDocumentUrl(camp.documentUrl || camp.document_url || '');

      // Parse tags
      const rawTags = camp.tags || camp.tags_json || camp.tagsJson || '';
      let tagsArr = [];
      if (Array.isArray(rawTags)) {
        tagsArr = rawTags.map(t => String(t).trim()).filter(Boolean);
      } else if (typeof rawTags === 'string' && rawTags.trim()) {
        tagsArr = rawTags.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean);
      }
      setSelectedTags(tagsArr);
      setDeliveryDatePickerOpen(false);
    }
  }, [camp, isOpen]);

  // Close calendar popover on outside click or Escape
  useEffect(() => {
    if (!deliveryDatePickerOpen) return;
    const handleOutside = (e) => {
      if (deliveryDateContainerRef.current && !deliveryDateContainerRef.current.contains(e.target)) {
        setDeliveryDatePickerOpen(false);
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setDeliveryDatePickerOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [deliveryDatePickerOpen]);

  // Close modal on Escape if calendar is closed
  useEffect(() => {
    const handleModalEsc = (e) => {
      if (e.key === 'Escape' && isOpen && !deliveryDatePickerOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleModalEsc);
    return () => window.removeEventListener('keydown', handleModalEsc);
  }, [isOpen, deliveryDatePickerOpen, onClose]);

  // Calendar month navigation
  const handlePrevCalMonth = () => {
    setCalViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const handleNextCalMonth = () => {
    setCalViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // Compute calendar cells matching Deploy Campaign
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
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Date selection with automatic urgency calculation matching Deploy Campaign
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

  // Tag chip toggle
  const handleTagToggle = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  if (!isOpen || !camp) return null;

  // Format financial targets for the EVM lock note
  const rawTargetEth = camp.targetAmount || camp.target_amount || camp.target || '0';
  const targetEthFormatted = parseFloat(rawTargetEth) > 0 ? parseFloat(rawTargetEth).toFixed(4) : '0.0000';
  const rawTargetPhp = camp.targetAmountPhp || camp.target_amount_php || (parseFloat(rawTargetEth) * 170000);
  const targetPhpFormatted = Math.round(rawTargetPhp).toLocaleString('en-US');

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
          document_url: documentUrl.trim()
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
    <div
      className="bbdrts-edit-profile-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999999,
        padding: '16px'
      }}
    >
      <div
        className="fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '760px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-card, #1c1c1c)',
          borderRadius: '16px',
          border: '1px solid var(--border-strong, rgba(255, 255, 255, 0.16))',
          boxShadow: '0 25px 65px rgba(0, 0, 0, 0.85)',
          overflow: 'hidden'
        }}
      >
        {/* ── Modal Header: Clean, Authentic Web3 NGO Console ── */}
        <div style={{
          padding: '16px 22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
          background: 'var(--bg-subcard, #232323)',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'var(--accent-dim, rgba(34, 197, 94, 0.15))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent, #22c55e)',
              border: '1px solid var(--accent-glow, rgba(34, 197, 94, 0.3))',
              flexShrink: 0
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>edit_note</span>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Edit Campaign Details
                </h2>
                <span className="deploy-step-pill" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                  Campaign #{camp.id}
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {camp.title}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              color: 'var(--text-muted)',
              fontSize: '1.1rem',
              lineHeight: 1
            }}
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* ── EVM Cryptographic Lock Banner ── */}
        <div style={{
          padding: '10px 22px',
          background: 'rgba(34, 197, 94, 0.06)',
          borderBottom: '1px solid rgba(34, 197, 94, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--accent, #22c55e)' }}>lock</span>
            <span>
              Financial target (<strong style={{ color: 'var(--text-primary)' }}>₱{targetPhpFormatted} PHP</strong> • {targetEthFormatted} ETH) is cryptographically locked on Sepolia EVM. Operational relief and field details below can be updated at any time.
            </span>
          </div>
          <span style={{
            fontSize: '0.66rem',
            fontWeight: 700,
            letterSpacing: '0.5px',
            color: 'var(--accent, #22c55e)',
            background: 'var(--accent-dim, rgba(34, 197, 94, 0.18))',
            padding: '3px 8px',
            borderRadius: '6px',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap'
          }}>
            On-Chain Audited
          </span>
        </div>

        {/* ── Scrollable Form Body: Identical to Deploy Campaign ── */}
        <form
          id="edit-campaign-form"
          onSubmit={handleSubmit}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '18px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          {/* Section 1: Operational Timeline & Urgency Priority */}
          <div className="deploy-section-card" style={{ flexShrink: 0, overflow: 'visible' }}>
            <div className="deploy-section-header">
              <div className="deploy-section-title">
                <span className="material-symbols-outlined deploy-section-icon">schedule</span>
                <span>1. Operational Timeline & Urgency Priority</span>
              </div>
              <span className="deploy-step-pill">Priority & Schedule</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              {/* Target Relief Delivery Date with Web3 Calendar Popover */}
              <div style={{ position: 'relative' }} ref={deliveryDateContainerRef}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label className="deploy-input-label" style={{ margin: 0 }}>
                    Target Relief Delivery Date
                  </label>
                  {targetDate && (
                    <span style={{ fontSize: '0.68rem', color: 'var(--accent, #22c55e)', fontWeight: 600 }}>
                      ✓ Date set
                    </span>
                  )}
                </div>

                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => !saving && setDeliveryDatePickerOpen(prev => !prev)}
                    disabled={saving}
                    className="input deploy-field-input"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      textAlign: 'left',
                      padding: '9px 12px',
                      background: 'var(--bg-input, rgba(255,255,255,0.03))',
                      border: targetDate ? '1.5px solid var(--accent, #22c55e)' : '1px solid var(--border)',
                      borderRadius: '10px'
                    }}
                    title="Click to open calendar and select delivery target date"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '1.15rem', color: targetDate ? 'var(--accent)' : 'var(--text-muted)' }}>
                        calendar_month
                      </span>
                      <span style={{ fontSize: '0.84rem', fontWeight: targetDate ? 700 : 500, color: targetDate ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {targetDate ? formatSelectedDeliveryDate(targetDate) : 'Select Delivery Date...'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {targetDate ? (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTargetDateChange('');
                          }}
                          style={{
                            padding: '2px 6px',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            color: 'var(--text-muted)',
                            background: 'rgba(255,255,255,0.08)',
                            cursor: 'pointer'
                          }}
                          title="Clear date"
                        >
                          ✕
                        </span>
                      ) : (
                        <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>
                          {deliveryDatePickerOpen ? 'expand_less' : 'expand_more'}
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Web3 Calendar Popover */}
                  {deliveryDatePickerOpen && (
                    <div
                      className="ledger-custom-calendar-popover"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        left: 0,
                        right: 'auto',
                        width: '300px',
                        zIndex: 1000
                      }}
                    >
                      {/* Month Header */}
                      <div className="cal-header">
                        <button
                          type="button"
                          className="cal-nav-btn"
                          onClick={handlePrevCalMonth}
                          title="Previous Month"
                        >
                          <span className="material-symbols-outlined">chevron_left</span>
                        </button>
                        <div className="cal-month-title">
                          {calViewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </div>
                        <button
                          type="button"
                          className="cal-nav-btn"
                          onClick={handleNextCalMonth}
                          title="Next Month"
                        >
                          <span className="material-symbols-outlined">chevron_right</span>
                        </button>
                      </div>

                      {/* Urgency Helper Banner */}
                      <div className="cal-lifecycle-banner" style={{ fontSize: '0.66rem', padding: '3px 8px' }}>
                        <span className="cal-pulse-dot" />
                        <span className="cal-lifecycle-text">
                          Auto Urgency: ≤5d High • 6–14d Medium • &gt;14d Stable
                        </span>
                      </div>

                      {/* Weekday Labels */}
                      <div className="cal-weekdays">
                        <span>Su</span>
                        <span>Mo</span>
                        <span>Tu</span>
                        <span>We</span>
                        <span>Th</span>
                        <span>Fr</span>
                        <span>Sa</span>
                      </div>

                      {/* Days Grid */}
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
                            else dotColor = '#22c55e';
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
                                border: cell.isToday ? '1px dashed var(--accent, #22c55e)' : 'none',
                                background: isSelected ? 'var(--accent, #22c55e)' : (cell.isToday ? 'rgba(34,197,94,0.08)' : 'transparent'),
                                color: isSelected ? '#000000' : 'inherit',
                                fontWeight: isSelected || cell.isToday ? 700 : 500,
                                position: 'relative'
                              }}
                              title={cell.isPast ? 'Past date unavailable' : `${cell.iso} (${diffDays === 0 ? 'Today' : `${diffDays} days from now`})`}
                            >
                              <span className="cal-day-num">{cell.dayNum}</span>
                              {dotColor && !isSelected && (
                                <span
                                  style={{
                                    width: '4px',
                                    height: '4px',
                                    borderRadius: '50%',
                                    background: dotColor,
                                    position: 'absolute',
                                    bottom: '3px'
                                  }}
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ marginTop: '4px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Selecting a date will auto-fill the Urgency Status below.
                </div>
              </div>

              {/* Urgency Status Dropdown */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label className="deploy-input-label" style={{ margin: 0 }}>
                    Urgency Status
                  </label>
                  {urgency && (
                    <span style={{ fontSize: '0.68rem', color: 'var(--accent, #22c55e)', fontWeight: 600 }}>
                      ✓ Auto-set from target date
                    </span>
                  )}
                </div>
                <select
                  className="input deploy-field-input"
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value)}
                  disabled={saving}
                  style={{ cursor: 'pointer' }}
                >
                  <option value="">-- Select or Auto-filled by Delivery Date --</option>
                  <option value="HIGH (EMERGENCY AID)">🔴 Emergency High Aid (≤ 5 Days)</option>
                  <option value="MEDIUM (URGENT REHABILITATION)">🟡 Urgent Medium Rehabilitation (6–14 Days)</option>
                  <option value="STABLE (CHARITABLE AID)">🟢 Standard Aid Operation (&gt; 14 Days)</option>
                </select>
                <div style={{ marginTop: '4px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Prioritizes campaign dispatch in humanitarian radar and feed.
                </div>
              </div>

              {/* Estimated Beneficiaries / Impact Scope (Full Width) */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="deploy-input-label">
                  Estimated Beneficiaries / Impact Scope
                </label>
                <input
                  className="input deploy-field-input"
                  type="text"
                  placeholder="e.g., ~3,500 Displaced Families across 12 Barangays"
                  value={beneficiariesImpact}
                  onChange={(e) => setBeneficiariesImpact(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Ground Distribution & Field Contact */}
          <div className="deploy-section-card" style={{ flexShrink: 0, overflow: 'visible' }}>
            <div className="deploy-section-header">
              <div className="deploy-section-title">
                <span className="material-symbols-outlined deploy-section-icon">location_on</span>
                <span>2. Ground Distribution & Field Contact</span>
              </div>
              <span className="deploy-step-pill">Ground Relief</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              {/* Distribution Location */}
              <div>
                <label className="deploy-input-label">
                  Relief Distribution Location & Evacuation Landmark
                </label>
                <input
                  className="input deploy-field-input"
                  type="text"
                  placeholder="e.g., Southern Leyte Provincial Sports Complex, Maasin City"
                  value={locationRegion}
                  onChange={(e) => setLocationRegion(e.target.value)}
                  disabled={saving}
                />
              </div>

              {/* GPS Coordinates */}
              <div>
                <label className="deploy-input-label">
                  GPS Coordinates (Latitude, Longitude) (Optional)
                </label>
                <input
                  className="input deploy-field-input"
                  type="text"
                  placeholder="e.g., 10.1335, 124.8436"
                  value={gpsCoordinates}
                  onChange={(e) => setGpsCoordinates(e.target.value)}
                  disabled={saving}
                />
                <div style={{ marginTop: '4px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Used by Relief Radar and Humanitarian Pin Map.
                </div>
              </div>

              {/* Emergency Contact Hotline / Desk (Full Width) */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="deploy-input-label">
                  Emergency Contact Hotline / Response Desk
                </label>
                <input
                  className="input deploy-field-input"
                  type="text"
                  placeholder="e.g., relief@redcross.org.ph • (053) 570-8899"
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Mission Purpose & Campaign Operation Tags */}
          <div className="deploy-section-card" style={{ flexShrink: 0, overflow: 'visible' }}>
            <div className="deploy-section-header">
              <div className="deploy-section-title">
                <span className="material-symbols-outlined deploy-section-icon">description</span>
                <span>3. Mission Purpose & Campaign Operation Tags</span>
              </div>
              <span className="deploy-step-pill">Humanitarian Context</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Campaign Operation Tags */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label className="deploy-input-label" style={{ margin: 0 }}>
                    Campaign Operation Tags
                  </label>
                  <span style={{ fontSize: '0.74rem', color: selectedTags.length > 0 ? 'var(--accent, #22c55e)' : 'var(--text-muted)', fontWeight: 600 }}>
                    {selectedTags.length} Selected
                  </span>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Click to toggle preset tags or add custom relief tags below.
                </div>

                {/* Preset Tag Chips identical to Deploy Campaign */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                  {PRESET_CAMPAIGN_TAGS.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleTagToggle(tag)}
                        className={`deploy-tag-chip ${isSelected ? 'active' : ''}`}
                        title={`Click to ${isSelected ? 'remove' : 'add'} ${tag}`}
                      >
                        <span>{isSelected ? '✓' : '+'}</span>
                        <span>{tag}</span>
                      </button>
                    );
                  })}

                  {/* Any existing custom tags not in PRESET_CAMPAIGN_TAGS */}
                  {selectedTags.filter(t => !PRESET_CAMPAIGN_TAGS.includes(t)).map((customTag) => (
                    <button
                      key={customTag}
                      type="button"
                      onClick={() => handleTagToggle(customTag)}
                      className="deploy-tag-chip active"
                      title="Custom tag. Click to remove."
                    >
                      <span>✓</span>
                      <span>{customTag}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mission & Campaign Description */}
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
                  disabled={saving}
                  style={{ width: '100%', resize: 'vertical', lineHeight: 1.5 }}
                />
              </div>

              {/* Official Document / Verification Link */}
              <div>
                <label className="deploy-input-label">
                  Official Document / Verification Link (Optional)
                </label>
                <input
                  className="input deploy-field-input"
                  type="url"
                  placeholder="e.g., https://redcross.org.ph/press-release-102"
                  value={documentUrl}
                  onChange={(e) => setDocumentUrl(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>
          </div>
        </form>

        {/* ── Fixed Footer Action Bar ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '12px',
          padding: '14px 22px',
          borderTop: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
          background: 'var(--bg-subcard, #232323)',
          flexShrink: 0
        }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={saving}
            style={{ padding: '8px 18px', fontSize: '0.84rem' }}
          >
            Cancel
          </button>

          <button
            type="submit"
            form="edit-campaign-form"
            className="btn btn-primary glow"
            disabled={saving}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 22px',
              fontSize: '0.85rem',
              fontWeight: 700
            }}
          >
            {saving ? (
              <>
                <div className="spinner spinner-light" style={{ width: 15, height: 15 }} />
                <span>Saving…</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>save</span>
                <span>Save Campaign Details</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
