import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import SecCertificateModal from './SecCertificateModal';
import DisbursementProofModal from './DisbursementProofModal';
import VercelIcon from './VercelIcon';
import { formatPhoneNumber } from '../utils/formatters';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { API_URL } from '../config';
import './NgoProfileModal.css';

// Institutional fallback only used if user explicitly requests it on registry failure
const DEFAULT_RED_CROSS_PROFILE = {
  id: 8,
  name: 'Philippine Red Cross',
  email: 'disaster.relief@redcross.org.ph',
  verificationStatus: 'Approved',
  secRegistrationNo: 'SEC-CN2021-08492',
  dswdAccreditationNo: 'DSWD-SB-A-2024-0193',
  walletAddress: '0x206e022D47003B67Ee72bd67fDF2406d43aabC2C',
  mobileNumber: '(02) 8790-2300 / Hotline: 143',
  location: 'Mandaluyong City, Metro Manila & Field Chapters Nationwide',
  bio: 'Premier humanitarian organization chartered under Republic Act 10072, dedicated to rapid-response disaster relief, emergency food rations, clean water filtration, and community rebuilding across the Philippine archipelago.',
  website: 'https://redcross.org.ph',
  banner_url: '',
  avatar_url: '',
  gcashName: 'Philippine Red Cross',
  gcashNumber: '0917 890 1430',
  mayaName: 'Philippine Red Cross',
  mayaNumber: '0918 765 1430',
  bankName: 'BDO Unibank / Land Bank of the Philippines',
  bankAccountName: 'Philippine Red Cross',
  bankAccountNumber: '0012 3456 7890',
  bankDetails: 'BDO Unibank · Acct: 0012-3456-7890 (Disaster Relief Fund)',
  verifiedAt: '2024-10-15T00:00:00.000Z',
  boardMembers: [
    'Gov. Richard J. Gordon (Chairman & CEO)',
    'Dr. Gwendolyn T. Pang (Secretary General)',
    'Atty. Lorna P. Kapunan (Trustee & Legal Counsel)',
    'Dr. Benjamin M. Go (Humanitarian Logistics Director)'
  ],
  stats: {
    totalCampaigns: 3,
    totalRaisedEth: '2.9559',
    totalRaisedPhp: '443,382',
    totalDisbursedPhp: 0,
    totalDonors: 0
  }
};

// Human-readable campaign category labels (never shows cryptic "CD RELIEF" or "DR")
const formatCategory = (cat) => {
  if (!cat) return 'Disaster Relief';
  const raw = String(cat).trim();
  const upper = raw.toUpperCase();
  const map = {
    DR: 'Disaster Relief',
    CD: 'Community & Charity',
    ER: 'Emergency Response',
    CR: 'Community Recovery',
    MED: 'Medical Aid',
    MEDICAL: 'Medical Aid',
    HEALTH: 'Health & Medical',
    FOOD: 'Food & Water',
    SHELTER: 'Shelter & Housing',
    WATER: 'Clean Water',
    EDUCATION: 'Education Support',
    ANIMAL: 'Animal Welfare',
    'FIRE AID': 'Fire Recovery',
    FIRE: 'Fire Recovery',
    TYPHOON: 'Typhoon Relief',
    FLOOD: 'Flood Response',
    EARTHQUAKE: 'Earthquake Relief',
    VOLCANO: 'Volcano Response'
  };
  if (map[upper]) return map[upper];
  if (upper.startsWith('CD')) return 'Community & Charity';
  if (upper.startsWith('DR')) return 'Disaster Relief';
  return raw;
};

const formatUrgency = (urg) => {
  if (!urg) return { label: 'Active', type: 'normal' };
  const upper = String(urg).toUpperCase();
  if (upper.includes('CRITICAL') || upper.includes('URGENT')) {
    return { label: 'Critical', type: 'critical' };
  }
  if (upper.includes('HIGH') || upper.includes('EMERGENCY')) {
    return { label: 'High Priority', type: 'high' };
  }
  return { label: 'Active', type: 'normal' };
};

const formatCompactPhp = (val) => {
  const n = Number(val) || 0;
  if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`;
  return `₱${Math.round(n).toLocaleString('en-US')}`;
};

function ExpandableText({ text, maxLen = 120, className = '' }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  if (text.length <= maxLen) {
    return <p className={className}>{text}</p>;
  }

  return (
    <div className={`vercel-expandable-wrap ${className}`}>
      <span className="vercel-expandable-text">
        {expanded ? text : `${text.slice(0, maxLen).trim()}… `}
      </span>
      <button
        type="button"
        className="vercel-show-more-btn"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded((prev) => !prev);
        }}
      >
        {expanded ? 'Show less' : 'Read more'}
      </button>
    </div>
  );
}

// Module-level RAM cache for instant modal reopening
const orgProfileCache = new Map();

export default function NgoProfileModal({ orgId, orgData, onClose, onSelectCampaign, onOpenDirectory, theme }) {
  const [profile, setProfile] = useState(() => {
    if (orgData) return orgData;
    if (orgId && orgProfileCache.has(String(orgId))) {
      return orgProfileCache.get(String(orgId));
    }
    return null;
  });
  const [loading, setLoading] = useState(() => {
    if (orgData) return false;
    if (orgId && orgProfileCache.has(String(orgId))) return false;
    return Boolean(orgId);
  });
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('campaigns'); // 'campaigns' | 'governance' | 'treasury' | 'contact'
  const [campFilter, setCampFilter] = useState('all'); // 'all' | 'active' | 'funded' | 'disbursed'
  const [campSearch, setCampSearch] = useState('');
  const [previewCertUrl, setPreviewCertUrl] = useState(null);
  const [previewTitle, setPreviewTitle] = useState('Official Verification Document');
  const [proofModalCamp, setProofModalCamp] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleCopy = (key, value) => {
    if (!value) return;
    navigator.clipboard?.writeText(String(value)).catch(() => {});
    setCopiedField(key);
    setTimeout(() => setCopiedField((prev) => (prev === key ? null : prev)), 1600);
  };

  const fetchProfile = useCallback((idToFetch) => {
    if (!idToFetch) return;
    const cacheKey = String(idToFetch);

    if (orgProfileCache.has(cacheKey)) {
      setProfile(orgProfileCache.get(cacheKey));
      setLoading(false);
      setError('');
    } else {
      setLoading(true);
      setError('');
    }

    fetch(`${API_URL}/api/public/organizations/${encodeURIComponent(idToFetch)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Organization registry record not found.');
        return res.json();
      })
      .then((data) => {
        if (data && !data.error) {
          orgProfileCache.set(cacheKey, data);
          if (data.id) orgProfileCache.set(String(data.id), data);
          if (data.name) orgProfileCache.set(data.name.toLowerCase(), data);
          setProfile(data);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.warn('Organization profile fetch failed:', err);
        if (!orgProfileCache.has(cacheKey)) {
          setError(err.message || 'Organization registry record not found.');
        }
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    setActiveTab('campaigns');
    setCampFilter('all');
    setCampSearch('');
    if (orgData) {
      setProfile(orgData);
      setLoading(false);
    } else if (orgId) {
      fetchProfile(orgId);
    }
  }, [orgId, orgData, fetchProfile]);

  useRealtimeSync(
    ['organizations', 'campaigns', 'donations', 'disbursements', 'profile'],
    () => { if (orgId) fetchProfile(orgId); },
    { enabled: Boolean(orgId), debounceMs: 300 }
  );

  // Keyboard shortcuts: Escape closes sub-modals first, then main modal; [ / Ctrl+\ / Alt+S toggles sidebar
  useEffect(() => {
    const handleToggleEvent = () => setIsSidebarCollapsed((prev) => !prev);
    window.addEventListener('bbdrts_toggle_modal_sidebar', handleToggleEvent);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (previewCertUrl) {
          setPreviewCertUrl(null);
          return;
        }
        if (proofModalCamp) {
          setProofModalCamp(null);
          return;
        }
        if (typeof onClose === 'function') onClose();
        return;
      }

      const target = e.target;
      const isInput = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('input, textarea, [contenteditable="true"]')
      );
      if (isInput) return;

      const isMod = e.ctrlKey || e.metaKey;
      const isBracket = e.key === '[' || e.code === 'BracketLeft';
      const isBackslash = isMod && (e.key === '\\' || e.code === 'Backslash');
      const isAltShortcut = e.altKey && (e.key === 's' || e.key === 'S' || e.key === 'b' || e.key === 'B');
      const isModShortcut = (isMod && (e.key === 'b' || e.key === 'B')) || (isMod && e.shiftKey && (e.key === 's' || e.key === 'S'));

      if (isBracket || isBackslash || isAltShortcut || isModShortcut) {
        e.preventDefault();
        e.stopPropagation();
        setIsSidebarCollapsed((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('bbdrts_toggle_modal_sidebar', handleToggleEvent);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, previewCertUrl, proofModalCamp]);

  const handleLoadDefaultRedCross = () => {
    setError('');
    setProfile(DEFAULT_RED_CROSS_PROFILE);
    setLoading(false);
  };

  const orgName = useMemo(() => {
    if (profile?.name) return profile.name;
    if (profile?.Org_Name) return profile.Org_Name;
    if (orgData?.name) return orgData.name;
    if (typeof orgId === 'string' && isNaN(orgId)) return orgId;
    if (loading) return 'Loading organization…';
    return 'Organization Profile';
  }, [profile, orgData, orgId, loading]);

  const orgEmail = profile?.email || profile?.Username || '';
  const secRegNo = profile?.secRegistrationNo || profile?.Sec_Registration_No || '';
  const dswdNo = profile?.dswdAccreditationNo || profile?.Dswd_Accreditation_No || '';
  const certUrl = profile?.secCertificateUrl || profile?.Sec_Certificate_Url || null;
  const walletAddr = profile?.walletAddress || profile?.Wallet_Address || '';
  const phone = profile?.mobileNumber || profile?.phone || profile?.emergency_hotline || '';
  const location = profile?.location || '';
  const bio = profile?.bio || profile?.missionStatement || profile?.preferences?.missionStatement || '';
  const website = profile?.website || profile?.preferences?.website || '';
  const bannerUrl = profile?.banner_url || profile?.bannerUrl || profile?.banner || '';
  const avatarUrl = profile?.avatar_url || profile?.avatarUrl || profile?.avatar || '';

  const focusAreasRaw = profile?.focusAreas || profile?.preferences?.focusAreas || '';
  const focusAreas = useMemo(() => {
    if (!focusAreasRaw) return [];
    if (Array.isArray(focusAreasRaw)) return focusAreasRaw;
    return String(focusAreasRaw).split(/[,•|]/).map((s) => s.trim()).filter(Boolean);
  }, [focusAreasRaw]);

  const hqLandmark = profile?.hqLandmark || profile?.preferences?.hqLandmark || '';
  const socialLink = profile?.socialLink || profile?.preferences?.socialLink || '';
  const emergencyHotline = profile?.emergency_hotline || profile?.preferences?.emergencyHotline || phone || '';
  const secondaryPhone = (profile?.mobileNumber || profile?.phone) && (profile?.mobileNumber || profile?.phone) !== emergencyHotline
    ? (profile?.mobileNumber || profile?.phone)
    : '';
  const leadOfficer = profile?.leadOfficer || profile?.preferences?.leadOfficer || '';

  const gcashName = profile?.gcash_name || profile?.gcashName || '';
  const gcashNo = formatPhoneNumber(profile?.gcash_number || profile?.gcashNumber || '');
  const gcashQrUrl = profile?.gcash_qr_url || profile?.gcashQrUrl || '';
  const mayaName = profile?.maya_name || profile?.mayaName || '';
  const mayaNo = formatPhoneNumber(profile?.maya_number || profile?.mayaNumber || '');
  const mayaQrUrl = profile?.maya_qr_url || profile?.mayaQrUrl || '';
  const bankName = profile?.bank_name || profile?.bankName || '';
  const bankAccountName = profile?.bank_account_name || profile?.bankAccountName || '';
  const bankAccountNumber = profile?.bank_account_number || profile?.bankAccountNumber || '';
  const bankDetails = profile?.bank_details || profile?.bankDetails || '';
  const bankQrUrl = profile?.bank_qr_url || profile?.bankQrUrl || '';

  const verifiedDateStr = profile?.verifiedAt || profile?.verified_date
    ? new Date(profile.verifiedAt || profile.verified_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null;

  // Parse board members accurately — NEVER leak Red Cross trustees onto unrelated NGOs
  const boardList = useMemo(() => {
    const raw = profile?.boardMembers;
    if (!raw) return [];
    if (Array.isArray(raw)) {
      if (raw.length === 1 && typeof raw[0] === 'string' && raw[0].includes('|')) {
        return raw[0].split('|').map((s) => s.trim()).filter(Boolean);
      }
      return raw
        .map((m) => (typeof m === 'object' ? `${m.name || ''}${m.role ? ` (${m.role})` : ''}` : String(m).trim()))
        .filter(Boolean);
    }
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed
            .map((m) => (typeof m === 'object' ? `${m.name || ''}${m.role ? ` (${m.role})` : ''}` : String(m).trim()))
            .filter(Boolean);
        }
      } catch (_) {
        if (raw.includes('|')) return raw.split('|').map((s) => s.trim()).filter(Boolean);
        return raw.trim() ? [raw.trim()] : [];
      }
    }
    return [];
  }, [profile]);

  const campaigns = useMemo(() => (Array.isArray(profile?.campaigns) ? profile.campaigns : []), [profile]);

  // Live financial & impact metrics
  const totalRaisedPhp = useMemo(() => {
    const fromCamps = campaigns.reduce((acc, c) => {
      const val = Number(c.currentAmountPhp || (Number(c.currentAmount || 0) * 170000));
      return acc + val;
    }, 0);
    if (fromCamps > 0) return Math.round(fromCamps);
    const statRaw = String(profile?.stats?.totalRaisedPhp || '0').replace(/,/g, '');
    return Math.round(Number(statRaw) || 0);
  }, [campaigns, profile]);

  const totalDisbursedPhp = useMemo(() => {
    const fromCamps = campaigns.reduce((acc, c) => acc + Number(c.disbursedAmountPhp || 0), 0);
    if (fromCamps > 0) return Math.round(fromCamps);
    return Math.round(Number(profile?.stats?.totalDisbursedPhp || 0));
  }, [campaigns, profile]);

  const totalBeneficiariesCount = useMemo(() => {
    return campaigns.reduce((acc, c) => {
      const raw = String(c.beneficiariesImpact || c.beneficiaries_impact || c.beneficiaries || '');
      const match = raw.replace(/,/g, '').match(/\d+/);
      return acc + (match ? parseInt(match[0], 10) : 0);
    }, 0);
  }, [campaigns]);

  const totalDonorsCount = useMemo(() => {
    const fromCamps = campaigns.reduce((acc, c) => acc + Number(c.totalBackers || c.donorsCount || 0), 0);
    return Math.max(fromCamps, Number(profile?.stats?.totalDonors || 0));
  }, [campaigns, profile]);

  const activeMissionsCount = useMemo(
    () => campaigns.filter((c) => c.isActive === undefined || Boolean(c.isActive)).length,
    [campaigns]
  );

  const disbursedCampaignsCount = useMemo(
    () => campaigns.filter((c) => c.disbursementStatus === 'DISBURSED' || c.disbursementStatus === 'PARTIALLY_DISBURSED' || Number(c.disbursedAmountPhp || 0) > 0).length,
    [campaigns]
  );

  const filteredCampaigns = useMemo(() => {
    const q = campSearch.trim().toLowerCase();
    return campaigns.filter((c) => {
      const targetPhp = Number(c.targetAmountPhp || Math.round(Number(c.targetAmount || 1) * 170000));
      const raisedPhp = Number(c.currentAmountPhp || Math.round(Number(c.currentAmount || 0) * 170000));
      const isFunded = targetPhp > 0 && raisedPhp >= targetPhp;
      const isDisbursed = c.disbursementStatus === 'DISBURSED' || c.disbursementStatus === 'PARTIALLY_DISBURSED' || Number(c.disbursedAmountPhp || 0) > 0;
      const isActive = c.isActive === undefined || Boolean(c.isActive);

      if (campFilter === 'active' && !isActive) return false;
      if (campFilter === 'funded' && !isFunded) return false;
      if (campFilter === 'disbursed' && !isDisbursed) return false;

      if (q) {
        const hay = [c.title, c.description, c.locationRegion, formatCategory(c.category)]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [campaigns, campFilter, campSearch]);

  const getInitials = (name) =>
    (name || 'OR')
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

  const handleOpenDocPreview = (url, title) => {
    setPreviewTitle(title || 'Official Document Preview');
    setPreviewCertUrl(url);
  };

  const effectiveTheme =
    theme ||
    (typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') || 'dark' : 'dark');

  const hasBanner = Boolean(bannerUrl && (bannerUrl.startsWith('data:') || bannerUrl.startsWith('http') || bannerUrl.startsWith('/')));

  const modalNode = (
    <div className="vercel-ngo-backdrop" onClick={onClose} data-theme={effectiveTheme}>
      <div className="vercel-ngo-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={orgName}>

        {/* ── Top Bar ── */}
        <header className="vercel-ngo-topbar">
          <div className="vercel-ngo-breadcrumbs">
            <button
              type="button"
              className="vercel-sidebar-toggle-btn"
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              title={isSidebarCollapsed ? 'Show sidebar ([)' : 'Hide sidebar ([)'}
              aria-label="Toggle sidebar"
            >
              <VercelIcon name={isSidebarCollapsed ? 'menu_open' : 'dock_to_right'} size={16} />
            </button>

            {onOpenDirectory ? (
              <button
                type="button"
                className="vercel-ngo-breadcrumb-btn"
                onClick={onOpenDirectory}
                title="Browse all accredited NGOs"
              >
                <VercelIcon name="arrow_back" size={14} />
                <span>All Organizations</span>
              </button>
            ) : (
              <span className="vercel-ngo-breadcrumb-parent">Organizations</span>
            )}

            <span className="vercel-ngo-breadcrumb-separator">/</span>
            <span className="vercel-ngo-breadcrumb-current">
              {loading && !profile ? (
                <span className="vercel-loading-shimmer-text">Loading organization…</span>
              ) : (
                orgName
              )}
            </span>
          </div>

          <div className="vercel-ngo-topbar-actions">
            <span className="vercel-kbd-hint" title="Press ESC to close">ESC</span>
            <button
              type="button"
              className="vercel-ngo-close-btn"
              onClick={onClose}
              aria-label="Close organization profile"
            >
              <VercelIcon name="close" size={18} />
            </button>
          </div>
        </header>

        {/* ── Body Switcher: Skeleton | Error | Split Dossier ── */}
        {loading && !profile ? (
          <div className="vercel-ngo-skeleton-body">
            <div className="vercel-skeleton-sidebar">
              <div className="vercel-skeleton-banner" />
              <div className="vercel-skeleton-line title" style={{ marginTop: '14px' }} />
              <div className="vercel-skeleton-line sub" />
              <div className="vercel-skeleton-card" style={{ height: '72px', marginTop: '12px' }} />
              <div className="vercel-skeleton-card" style={{ height: '84px' }} />
            </div>
            <div className="vercel-skeleton-main">
              <div className="vercel-skeleton-card" style={{ height: '72px' }} />
              <div className="vercel-skeleton-content-area" />
            </div>
          </div>
        ) : error && !profile ? (
          <div className="vercel-ngo-error-body">
            <div className="vercel-error-card">
              <div className="vercel-error-icon-wrap">
                <VercelIcon name="error" size={24} color="#ef4444" />
              </div>
              <h3 className="vercel-error-title">Organization record unavailable</h3>
              <p className="vercel-error-desc">
                {error} Return to the directory to pick another verified organization, or try again.
              </p>
              <div className="vercel-error-actions">
                {onOpenDirectory ? (
                  <button type="button" className="vercel-btn vercel-btn-primary" onClick={onOpenDirectory}>
                    Browse All Organizations
                  </button>
                ) : (
                  <button type="button" className="vercel-btn vercel-btn-primary" onClick={handleLoadDefaultRedCross}>
                    Load Philippine Red Cross
                  </button>
                )}
                <button type="button" className="vercel-btn vercel-btn-secondary" onClick={onClose}>
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className={`vercel-ngo-split-layout ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>

            {/* ════════ LEFT DOSSIER RAIL ════════ */}
            {!isSidebarCollapsed && (
              <aside className="vercel-ngo-sidebar">
                {hasBanner && (
                  <div className="vercel-sidebar-banner-frame">
                    <img src={bannerUrl} alt={`${orgName} banner`} className="vercel-sidebar-banner-img" />
                    <div className="vercel-sidebar-banner-fade" />
                  </div>
                )}

                <div className={`vercel-sidebar-content ${hasBanner ? 'has-banner' : 'no-banner'}`}>
                  {/* Clean Identity Header (Avatar sits neatly beside title, never crushing banner artwork) */}
                  <div className="vercel-sidebar-identity">
                    <div className="vercel-sidebar-avatar">
                      {avatarUrl && (avatarUrl.startsWith('data:') || avatarUrl.startsWith('http')) ? (
                        <img src={avatarUrl} alt={orgName} />
                      ) : avatarUrl && avatarUrl.length < 30 ? (
                        <VercelIcon name={avatarUrl} size={24} />
                      ) : (
                        <span className="vercel-sidebar-initials">{getInitials(orgName)}</span>
                      )}
                    </div>

                    <div className="vercel-sidebar-identity-text">
                      <div className="vercel-sidebar-name-line">
                        <h3 className="vercel-sidebar-title" title={orgName}>{orgName}</h3>
                        <span className="vercel-verified-mark" title="SEC & DSWD Accredited Non-Profit">
                          <VercelIcon name="verified" size={16} color="#10b981" />
                        </span>
                      </div>
                      <span className="vercel-sidebar-accredited-date">
                        {verifiedDateStr ? `Accredited ${verifiedDateStr}` : 'Verified Philippine Non-Profit'}
                      </span>
                    </div>
                  </div>

                  {/* Registration Key-Value Block (Quiet hairline rows, click-to-copy) */}
                  {(secRegNo || dswdNo) && (
                    <div className="vercel-rail-section">
                      <div className="vercel-rail-section-label">Registration</div>
                      <div className="vercel-rail-kv-list">
                        {secRegNo && (
                          <button
                            type="button"
                            className="vercel-rail-kv-row"
                            onClick={() => handleCopy('sec', secRegNo)}
                            title="Copy SEC Registration Number"
                          >
                            <span className="kv-key">SEC</span>
                            <span className="kv-val mono">{secRegNo}</span>
                            <span className="kv-copy">
                              {copiedField === 'sec' ? 'Copied' : <VercelIcon name="content_copy" size={12} />}
                            </span>
                          </button>
                        )}
                        {dswdNo && (
                          <button
                            type="button"
                            className="vercel-rail-kv-row"
                            onClick={() => handleCopy('dswd', dswdNo)}
                            title="Copy DSWD Accreditation Number"
                          >
                            <span className="kv-key">DSWD</span>
                            <span className="kv-val mono">{dswdNo}</span>
                            <span className="kv-copy">
                              {copiedField === 'dswd' ? 'Copied' : <VercelIcon name="content_copy" size={12} />}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Contact & Dispatch Block */}
                  {(emergencyHotline || secondaryPhone || orgEmail || location || website || socialLink) && (
                    <div className="vercel-rail-section">
                      <div className="vercel-rail-section-label">Contact</div>
                      <div className="vercel-rail-contact-list">
                        {emergencyHotline && (
                          <a href={`tel:${emergencyHotline.replace(/[^\d+]/g, '')}`} className="vercel-rail-contact-item">
                            <VercelIcon name="call" size={15} color="#8b8b96" />
                            <div className="ci-body">
                              <span className="ci-lbl">Operations hotline</span>
                              <span className="ci-val">{emergencyHotline}</span>
                            </div>
                          </a>
                        )}
                        {secondaryPhone && (
                          <a href={`tel:${secondaryPhone.replace(/[^\d+]/g, '')}`} className="vercel-rail-contact-item">
                            <VercelIcon name="phone_iphone" size={15} color="#8b8b96" />
                            <div className="ci-body">
                              <span className="ci-lbl">Mobile</span>
                              <span className="ci-val">{secondaryPhone}</span>
                            </div>
                          </a>
                        )}
                        {orgEmail && (
                          <a href={`mailto:${orgEmail}`} className="vercel-rail-contact-item">
                            <VercelIcon name="mail" size={15} color="#8b8b96" />
                            <div className="ci-body">
                              <span className="ci-lbl">Official email</span>
                              <span className="ci-val">{orgEmail}</span>
                            </div>
                          </a>
                        )}
                        {location && (
                          <div className="vercel-rail-contact-item is-static">
                            <VercelIcon name="location_on" size={15} color="#8b8b96" />
                            <div className="ci-body">
                              <span className="ci-lbl">Headquarters</span>
                              <span className="ci-val">{location}</span>
                            </div>
                          </div>
                        )}
                        {hqLandmark && (
                          <div className="vercel-rail-contact-item is-static">
                            <VercelIcon name="apartment" size={15} color="#8b8b96" />
                            <div className="ci-body">
                              <span className="ci-lbl">Landmark</span>
                              <span className="ci-val">{hqLandmark}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {(website || socialLink) && (
                        <div className="vercel-rail-link-row">
                          {website && (
                            <a
                              href={website.startsWith('http') ? website : `https://${website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="vercel-rail-ext-link"
                            >
                              <VercelIcon name="language" size={14} />
                              <span>Website</span>
                              <VercelIcon name="open_in_new" size={12} />
                            </a>
                          )}
                          {socialLink && (
                            <a
                              href={socialLink.startsWith('http') ? socialLink : `https://${socialLink}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="vercel-rail-ext-link"
                            >
                              <VercelIcon name="share" size={14} />
                              <span>Social</span>
                              <VercelIcon name="open_in_new" size={12} />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mission & Focus Areas */}
                  {(bio || focusAreas.length > 0) && (
                    <div className="vercel-rail-section">
                      <div className="vercel-rail-section-label">Mission</div>
                      {bio && <ExpandableText text={bio} maxLen={140} className="vercel-sidebar-bio" />}
                      {focusAreas.length > 0 && (
                        <div className="vercel-sidebar-tags">
                          {focusAreas.map((area, idx) => (
                            <span key={idx} className="vercel-sidebar-tag-chip">{area}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Executive Leadership */}
                  {leadOfficer && (
                    <div className="vercel-rail-section">
                      <div className="vercel-rail-section-label">Executive lead</div>
                      <div className="vercel-rail-lead-val">{leadOfficer}</div>
                    </div>
                  )}
                </div>
              </aside>
            )}

            {/* ════════ RIGHT MAIN PANEL ════════ */}
            <main className="vercel-ngo-main">

              {/* Unified 4-Column Hairline Ledger Bar */}
              <section className="vercel-ledger-bar" aria-label="Organization impact summary">
                <div className="vercel-ledger-cell">
                  <span className="ledger-lbl">Total raised</span>
                  <strong className="ledger-val mono">{formatCompactPhp(totalRaisedPhp)}</strong>
                </div>
                <div className="vercel-ledger-cell">
                  <span className="ledger-lbl">Aid disbursed</span>
                  <strong className={`ledger-val mono ${totalDisbursedPhp > 0 ? 'is-emerald' : ''}`}>
                    {totalDisbursedPhp > 0 ? formatCompactPhp(totalDisbursedPhp) : '₱0'}
                  </strong>
                </div>
                <div className="vercel-ledger-cell">
                  <span className="ledger-lbl">Operations</span>
                  <strong className="ledger-val mono">
                    {campaigns.length}
                    {activeMissionsCount > 0 && activeMissionsCount < campaigns.length ? (
                      <span className="ledger-sub"> ({activeMissionsCount} live)</span>
                    ) : null}
                  </strong>
                </div>
                <div className="vercel-ledger-cell">
                  <span className="ledger-lbl">
                    {totalBeneficiariesCount > 0 ? 'Estimated reach' : 'Verified gifts'}
                  </span>
                  <strong className="ledger-val mono">
                    {totalBeneficiariesCount > 0
                      ? `${totalBeneficiariesCount.toLocaleString('en-US')}+`
                      : totalDonorsCount > 0
                        ? totalDonorsCount.toLocaleString('en-US')
                        : '0'}
                  </strong>
                </div>
              </section>

              {/* Clean Underline Navigation Tabs */}
              <nav className="vercel-ngo-tabs-bar" aria-label="Organization sections">
                <button
                  type="button"
                  className={`vercel-tab-btn ${activeTab === 'campaigns' ? 'active' : ''}`}
                  onClick={() => setActiveTab('campaigns')}
                >
                  <span>Operations</span>
                  <span className="vercel-tab-count">{campaigns.length}</span>
                </button>

                <button
                  type="button"
                  className={`vercel-tab-btn ${activeTab === 'governance' ? 'active' : ''}`}
                  onClick={() => setActiveTab('governance')}
                >
                  <span>Governance &amp; SEC</span>
                </button>

                <button
                  type="button"
                  className={`vercel-tab-btn ${activeTab === 'treasury' ? 'active' : ''}`}
                  onClick={() => setActiveTab('treasury')}
                >
                  <span>Payment Channels</span>
                </button>

                <button
                  type="button"
                  className={`vercel-tab-btn ${activeTab === 'contact' ? 'active' : ''}`}
                  onClick={() => setActiveTab('contact')}
                >
                  <span>Dispatch &amp; Contact</span>
                </button>
              </nav>

              {/* Scrollable Tab Panels Body */}
              <div className="vercel-ngo-panel-scroll">

                {/* TAB 1: OPERATIONS */}
                {activeTab === 'campaigns' && (
                  <div className="vercel-tab-pane">
                    <div className="vercel-ops-toolbar">
                      <div className="vercel-ops-filter-pills" role="tablist" aria-label="Filter operations">
                        <button
                          type="button"
                          className={`ops-pill ${campFilter === 'all' ? 'active' : ''}`}
                          onClick={() => setCampFilter('all')}
                        >
                          All ({campaigns.length})
                        </button>
                        <button
                          type="button"
                          className={`ops-pill ${campFilter === 'active' ? 'active' : ''}`}
                          onClick={() => setCampFilter('active')}
                        >
                          Active ({activeMissionsCount})
                        </button>
                        <button
                          type="button"
                          className={`ops-pill ${campFilter === 'funded' ? 'active' : ''}`}
                          onClick={() => setCampFilter('funded')}
                        >
                          Funded
                        </button>
                        {disbursedCampaignsCount > 0 && (
                          <button
                            type="button"
                            className={`ops-pill ${campFilter === 'disbursed' ? 'active' : ''}`}
                            onClick={() => setCampFilter('disbursed')}
                          >
                            Proof Posted ({disbursedCampaignsCount})
                          </button>
                        )}
                      </div>

                      {campaigns.length > 3 && (
                        <div className="vercel-ops-search">
                          <VercelIcon name="search" size={14} color="#71717a" />
                          <input
                            type="text"
                            placeholder="Filter campaigns…"
                            value={campSearch}
                            onChange={(e) => setCampSearch(e.target.value)}
                          />
                          {campSearch && (
                            <button type="button" className="ops-search-clear" onClick={() => setCampSearch('')} aria-label="Clear filter">
                              <VercelIcon name="close" size={13} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {campaigns.length === 0 ? (
                      <div className="vercel-empty-card">
                        <VercelIcon name="inventory_2" size={26} color="#666666" />
                        <p>This organization has not published any active relief campaigns yet.</p>
                      </div>
                    ) : filteredCampaigns.length === 0 ? (
                      <div className="vercel-empty-card">
                        <VercelIcon name="search_off" size={26} color="#666666" />
                        <p>No campaigns match the current filter.</p>
                        <button
                          type="button"
                          className="vercel-btn vercel-btn-secondary"
                          onClick={() => { setCampFilter('all'); setCampSearch(''); }}
                        >
                          Reset filters
                        </button>
                      </div>
                    ) : (
                      <div className="vercel-campaigns-list">
                        {filteredCampaigns.map((c) => {
                          const targetEth = Number(c.targetAmount || 1);
                          const currentEth = Number(c.currentAmount || 0);
                          const raisedPhpNum = Number(c.currentAmountPhp || Math.round(currentEth * 170000));
                          const goalPhpNum = Number(c.targetAmountPhp || Math.round(targetEth * 170000));
                          const pct = goalPhpNum > 0
                            ? Math.min(Math.round((raisedPhpNum / goalPhpNum) * 100), 100)
                            : Math.min(Math.round((currentEth / targetEth) * 100), 100);
                          const disbursedPhpNum = Number(c.disbursedAmountPhp || 0);
                          const hasDisbursed =
                            c.disbursementStatus === 'DISBURSED' ||
                            c.disbursementStatus === 'PARTIALLY_DISBURSED' ||
                            disbursedPhpNum > 0;
                          const urgency = formatUrgency(c.urgency);
                          const categoryName = formatCategory(c.category);

                          return (
                            <article key={c.id} className="vercel-campaign-card">
                              <div className="vercel-camp-header">
                                <div className="vercel-camp-title-block">
                                  <div className="vercel-camp-meta-line">
                                    <span className="vercel-camp-category">{categoryName}</span>
                                    {hasDisbursed && (
                                      <span className="vercel-camp-proof-tag">
                                        <VercelIcon name="verified" size={12} color="#10b981" />
                                        <span>Aid disbursed</span>
                                      </span>
                                    )}
                                  </div>
                                  <h4 className="vercel-camp-title">{c.title}</h4>
                                </div>

                                <span className={`vercel-camp-urgency ${urgency.type}`}>
                                  <span className="vercel-urgency-dot" />
                                  {urgency.label}
                                </span>
                              </div>

                              {c.description && c.description.trim() && (
                                <ExpandableText text={c.description.trim()} maxLen={135} className="vercel-camp-desc" />
                              )}

                              <div className="vercel-camp-progress-section">
                                <div className="vercel-progress-track">
                                  <div
                                    className="vercel-progress-bar"
                                    style={{ width: `${Math.max(pct, raisedPhpNum > 0 ? 3 : 0)}%` }}
                                  />
                                </div>
                                <div className="vercel-progress-labels">
                                  <span className="raised mono">
                                    ₱{raisedPhpNum.toLocaleString('en-US')}
                                    <span className="sub"> raised of ₱{goalPhpNum.toLocaleString('en-US')}</span>
                                  </span>
                                  <span className="pct-badge mono">{pct}%</span>
                                </div>
                              </div>

                              <div className="vercel-camp-footer">
                                <div className="vercel-camp-loc">
                                  <VercelIcon name="location_on" size={14} color="#71717a" />
                                  <span className="loc-text" title={c.locationRegion || 'Philippines'}>
                                    {c.locationRegion || 'Philippines'}
                                  </span>
                                </div>

                                <div className="vercel-camp-actions">
                                  {hasDisbursed && (
                                    <button
                                      type="button"
                                      className="vercel-btn vercel-btn-proof"
                                      onClick={() => setProofModalCamp({ ...c, orgName })}
                                    >
                                      <VercelIcon name="verified" size={14} color="#10b981" />
                                      <span>Relief Proof</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="vercel-btn vercel-btn-primary"
                                    onClick={() => {
                                      onClose();
                                      if (onSelectCampaign) onSelectCampaign(c);
                                      document.getElementById('campaigns')?.scrollIntoView({ behavior: 'smooth' });
                                    }}
                                  >
                                    <span>Donate</span>
                                  </button>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: GOVERNANCE & SEC */}
                {activeTab === 'governance' && (
                  <div className="vercel-tab-pane">
                    <div className="vercel-card-box">
                      <div className="vercel-card-box-header">
                        <div>
                          <h4 className="vercel-card-box-title">SEC &amp; DSWD Accreditation</h4>
                          <p className="vercel-card-box-desc">
                            Non-stock, non-profit corporation verified under the Revised Corporation Code of the Philippines (RA 11232).
                          </p>
                        </div>

                        {certUrl && (
                          <button
                            type="button"
                            className="vercel-btn vercel-btn-secondary"
                            onClick={() => handleOpenDocPreview(certUrl, 'Official SEC Certificate of Incorporation')}
                          >
                            <VercelIcon name="visibility" size={14} />
                            <span>View SEC Certificate</span>
                          </button>
                        )}
                      </div>

                      <div className="vercel-info-grid">
                        <div className="vercel-info-item">
                          <span className="lbl">SEC registration number</span>
                          <span className="val mono">{secRegNo || 'On file with compliance desk'}</span>
                        </div>
                        <div className="vercel-info-item">
                          <span className="lbl">DSWD accreditation</span>
                          <span className="val mono">{dswdNo || 'Verified partner status'}</span>
                        </div>
                        <div className="vercel-info-item">
                          <span className="lbl">Legal classification</span>
                          <span className="val">Non-Stock, Non-Profit Humanitarian NGO</span>
                        </div>
                        <div className="vercel-info-item">
                          <span className="lbl">Audit &amp; escrow status</span>
                          <span className="val" style={{ color: '#10b981' }}>Approved · Sepolia Audited</span>
                        </div>
                        {walletAddr && (
                          <div className="vercel-info-item" style={{ gridColumn: '1 / -1' }}>
                            <span className="lbl">Institutional ledger wallet</span>
                            <div className="vercel-wallet-copy-row">
                              <span className="val mono">{walletAddr}</span>
                              <button
                                type="button"
                                className="vercel-inline-copy-btn"
                                onClick={() => handleCopy('wallet', walletAddr)}
                              >
                                {copiedField === 'wallet' ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="vercel-card-box">
                      <div className="vercel-card-box-header">
                        <div>
                          <h4 className="vercel-card-box-title">Board of Trustees &amp; Signatories</h4>
                          <p className="vercel-card-box-desc">
                            Authorized executive officers accountable for relief disbursement and liquidation reporting.
                          </p>
                        </div>
                      </div>

                      {boardList.length > 0 ? (
                        <div className="vercel-board-grid">
                          {boardList.map((member, idx) => (
                            <div key={idx} className="vercel-board-card">
                              <div className="vercel-board-avatar">
                                <VercelIcon name="person" size={15} />
                              </div>
                              <div className="vercel-board-text">
                                <strong className="name">{member}</strong>
                                <span className="role">Authorized signatory</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="vercel-muted-note">
                          Signatory roster verified during SEC &amp; KYC onboarding and maintained in the compliance vault.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 3: PAYMENT CHANNELS */}
                {activeTab === 'treasury' && (
                  <div className="vercel-tab-pane">
                    <div className="vercel-card-box">
                      <div className="vercel-card-box-header">
                        <div>
                          <h4 className="vercel-card-box-title">Verified Direct Payout Channels</h4>
                          <p className="vercel-card-box-desc">
                            Donations sent to {orgName} settle at 0% BBDRTS platform commission and are recorded gaslessly on Ethereum Sepolia.
                          </p>
                        </div>
                      </div>

                      <div className="vercel-rails-grid">
                        {/* GCash */}
                        <div className="vercel-rail-card">
                          <div className="vercel-rail-top">
                            <span className="vercel-rail-name">GCash</span>
                            <span className="vercel-rail-tag gcash">E-Wallet</span>
                          </div>
                          {gcashNo || gcashQrUrl ? (
                            <>
                              {gcashName && <div className="vercel-rail-holder">{gcashName}</div>}
                              {gcashNo && (
                                <button type="button" className="vercel-rail-code-btn" onClick={() => handleCopy('gcash', gcashNo)}>
                                  <code>{gcashNo}</code>
                                  <span>{copiedField === 'gcash' ? 'Copied' : 'Copy'}</span>
                                </button>
                              )}
                              {gcashQrUrl && (
                                <div className="vercel-rail-actions">
                                  <button
                                    type="button"
                                    className="vercel-btn-pill"
                                    onClick={() => handleOpenDocPreview(gcashQrUrl, `${orgName} · GCash QR`)}
                                  >
                                    <VercelIcon name="qr_code_scanner" size={13} />
                                    <span>View GCash QR</span>
                                  </button>
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="vercel-rail-caption">Configured per campaign checkout</span>
                          )}
                        </div>

                        {/* Maya */}
                        <div className="vercel-rail-card">
                          <div className="vercel-rail-top">
                            <span className="vercel-rail-name">Maya</span>
                            <span className="vercel-rail-tag maya">E-Wallet</span>
                          </div>
                          {mayaNo || mayaQrUrl ? (
                            <>
                              {mayaName && <div className="vercel-rail-holder">{mayaName}</div>}
                              {mayaNo && (
                                <button type="button" className="vercel-rail-code-btn" onClick={() => handleCopy('maya', mayaNo)}>
                                  <code>{mayaNo}</code>
                                  <span>{copiedField === 'maya' ? 'Copied' : 'Copy'}</span>
                                </button>
                              )}
                              {mayaQrUrl && (
                                <div className="vercel-rail-actions">
                                  <button
                                    type="button"
                                    className="vercel-btn-pill"
                                    onClick={() => handleOpenDocPreview(mayaQrUrl, `${orgName} · Maya QR`)}
                                  >
                                    <VercelIcon name="qr_code_scanner" size={13} />
                                    <span>View Maya QR</span>
                                  </button>
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="vercel-rail-caption">Configured per campaign checkout</span>
                          )}
                        </div>

                        {/* Bank */}
                        <div className="vercel-rail-card">
                          <div className="vercel-rail-top">
                            <span className="vercel-rail-name">{bankName || 'Bank Transfer'}</span>
                            <span className="vercel-rail-tag bank">InstaPay / PESONet</span>
                          </div>
                          {bankAccountNumber || bankDetails || bankQrUrl ? (
                            <>
                              {bankAccountName && <div className="vercel-rail-holder">{bankAccountName}</div>}
                              {(bankAccountNumber || bankDetails) && (
                                <button
                                  type="button"
                                  className="vercel-rail-code-btn"
                                  onClick={() => handleCopy('bank', bankAccountNumber || bankDetails)}
                                >
                                  <code>{bankAccountNumber || bankDetails}</code>
                                  <span>{copiedField === 'bank' ? 'Copied' : 'Copy'}</span>
                                </button>
                              )}
                              {bankQrUrl && (
                                <div className="vercel-rail-actions">
                                  <button
                                    type="button"
                                    className="vercel-btn-pill"
                                    onClick={() => handleOpenDocPreview(bankQrUrl, `${orgName} · Bank QR`)}
                                  >
                                    <VercelIcon name="qr_code_scanner" size={13} />
                                    <span>View Bank QR</span>
                                  </button>
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="vercel-rail-caption">Configured per campaign checkout</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 4: DISPATCH & CONTACT */}
                {activeTab === 'contact' && (
                  <div className="vercel-tab-pane">
                    <div className="vercel-card-box">
                      <div className="vercel-card-box-header">
                        <div>
                          <h4 className="vercel-card-box-title">Operations Dispatch &amp; Contact</h4>
                          <p className="vercel-card-box-desc">
                            Direct communication channels for relief coordination, donor inquiries, and field logistics.
                          </p>
                        </div>
                      </div>

                      <div className="vercel-contact-grid">
                        {emergencyHotline && (
                          <div className="vercel-contact-tile">
                            <div className="vercel-contact-icon">
                              <VercelIcon name="call" size={17} color="#10b981" />
                            </div>
                            <div>
                              <span className="lbl">24/7 operations hotline</span>
                              <a href={`tel:${emergencyHotline.replace(/[^\d+]/g, '')}`} className="val-link">
                                {emergencyHotline}
                              </a>
                            </div>
                          </div>
                        )}

                        {secondaryPhone && (
                          <div className="vercel-contact-tile">
                            <div className="vercel-contact-icon">
                              <VercelIcon name="phone_iphone" size={17} color="#38bdf8" />
                            </div>
                            <div>
                              <span className="lbl">Secondary mobile</span>
                              <strong className="val">{secondaryPhone}</strong>
                            </div>
                          </div>
                        )}

                        {orgEmail && (
                          <div className="vercel-contact-tile">
                            <div className="vercel-contact-icon">
                              <VercelIcon name="mail" size={17} color="#10b981" />
                            </div>
                            <div>
                              <span className="lbl">Official email</span>
                              <a href={`mailto:${orgEmail}`} className="val-link">{orgEmail}</a>
                            </div>
                          </div>
                        )}

                        {website && (
                          <div className="vercel-contact-tile">
                            <div className="vercel-contact-icon">
                              <VercelIcon name="language" size={17} color="#38bdf8" />
                            </div>
                            <div>
                              <span className="lbl">Official portal</span>
                              <a
                                href={website.startsWith('http') ? website : `https://${website}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="val-link"
                              >
                                {website}
                              </a>
                            </div>
                          </div>
                        )}

                        {location && (
                          <div className="vercel-contact-tile">
                            <div className="vercel-contact-icon">
                              <VercelIcon name="location_on" size={17} color="#f59e0b" />
                            </div>
                            <div>
                              <span className="lbl">Logistics headquarters</span>
                              <strong className="val">{location}</strong>
                            </div>
                          </div>
                        )}

                        {hqLandmark && (
                          <div className="vercel-contact-tile">
                            <div className="vercel-contact-icon">
                              <VercelIcon name="apartment" size={17} color="#38bdf8" />
                            </div>
                            <div>
                              <span className="lbl">Headquarters landmark</span>
                              <strong className="val">{hqLandmark}</strong>
                            </div>
                          </div>
                        )}

                        {socialLink && (
                          <div className="vercel-contact-tile">
                            <div className="vercel-contact-icon">
                              <VercelIcon name="share" size={17} color="#a855f7" />
                            </div>
                            <div>
                              <span className="lbl">Official social page</span>
                              <a
                                href={socialLink.startsWith('http') ? socialLink : `https://${socialLink}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="val-link"
                              >
                                {socialLink}
                              </a>
                            </div>
                          </div>
                        )}

                        {!emergencyHotline && !orgEmail && !website && !location && (
                          <p className="vercel-muted-note">
                            Contact details are currently being updated by this organization.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </main>
          </div>
        )}
      </div>

      {/* SEC Certificate & QR Lightbox */}
      <SecCertificateModal
        isOpen={Boolean(previewCertUrl)}
        onClose={() => setPreviewCertUrl(null)}
        url={previewCertUrl}
        orgName={orgName}
        regNo={secRegNo}
        title={previewTitle}
      />

      {/* Verified Relief Proof Modal (opened directly from disbursed campaigns) */}
      {proofModalCamp && (
        <DisbursementProofModal
          camp={proofModalCamp}
          isOpen={Boolean(proofModalCamp)}
          onClose={() => setProofModalCamp(null)}
          theme={effectiveTheme}
        />
      )}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : null;
}
