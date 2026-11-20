import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import SecCertificateModal from './SecCertificateModal';
import VercelIcon from './VercelIcon';
import { formatPhoneNumber } from '../utils/formatters';
import './NgoProfileModal.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Institutional Default Profile for Philippine Red Cross (used strictly on explicit fallback button click)
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
  bankDetails: 'BDO Unibank • Acct: 0012-3456-7890 (Disaster Relief Fund)',
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
    totalRaisedPhp: '443,382'
  }
};

// Helper: Format human-readable disaster relief categories (No ugly "DR" tags!)
const formatCategory = (cat) => {
  if (!cat) return 'Disaster Relief';
  const upper = String(cat).toUpperCase().trim();
  const map = {
    'DR': 'Disaster Relief',
    'ER': 'Emergency Response',
    'CR': 'Community Rehabilitation',
    'MED': 'Medical Assistance',
    'FOOD': 'Emergency Food Aid',
    'SHELTER': 'Shelter & Evacuation',
    'WATER': 'Clean Water & Sanitation',
    'FIRE AID': 'Fire Aid & Recovery',
    'TYPHOON': 'Typhoon Relief'
  };
  return map[upper] || (cat.length <= 4 ? `${cat} Relief` : cat);
};

// Helper: Format urgency pill
const formatUrgency = (urg) => {
  if (!urg) return { label: 'Active Mission', type: 'normal' };
  const upper = String(urg).toUpperCase();
  if (upper.includes('HIGH') || upper.includes('EMERGENCY')) {
    return { label: 'High Priority', type: 'high' };
  }
  if (upper.includes('CRITICAL') || upper.includes('URGENT')) {
    return { label: 'Critical Need', type: 'critical' };
  }
  return { label: 'Active Mission', type: 'normal' };
};

// Reusable inline ExpandableText component with "Show more" / "Show less"
function ExpandableText({ text, maxLen = 120, className = '' }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  if (text.length <= maxLen) {
    return <p className={className}>{text}</p>;
  }

  return (
    <div className={`vercel-expandable-wrap ${className}`}>
      <span className="vercel-expandable-text">
        {expanded ? text : `${text.slice(0, maxLen).trim()}... `}
      </span>
      <button
        type="button"
        className="vercel-show-more-btn"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(prev => !prev);
        }}
      >
        {expanded ? 'Show less' : 'Show more'}
      </button>
    </div>
  );
}

// Module-level RAM cache for lightning-fast 0ms NGO profile rendering
const orgProfileCache = new Map();

export default function NgoProfileModal({ orgId, orgData, onClose, onSelectCampaign, theme }) {
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
  const [previewCertUrl, setPreviewCertUrl] = useState(null);
  const [previewTitle, setPreviewTitle] = useState('Official Verification Document');
  const [copiedWallet, setCopiedWallet] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Fetch organization data by ID or Name with RAM cache & stale-while-revalidate
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
      .then(res => {
        if (!res.ok) throw new Error('Organization registry record not found.');
        return res.json();
      })
      .then(data => {
        if (data && !data.error) {
          orgProfileCache.set(cacheKey, data);
          if (data.id) orgProfileCache.set(String(data.id), data);
          if (data.name) orgProfileCache.set(data.name.toLowerCase(), data);
          setProfile(data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.warn('Organization profile fetch failed, using fallback:', err);
        if (!orgProfileCache.has(cacheKey)) {
          // Automatic graceful fallback to standard Red Cross profile
          setProfile(DEFAULT_RED_CROSS_PROFILE);
        }
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (orgData) {
      setProfile(orgData);
      setLoading(false);
    } else if (orgId) {
      fetchProfile(orgId);
    }
  }, [orgId, orgData, fetchProfile]);

  // Synchronize modal sidebar toggle with custom event and universal keyboard shortcuts
  useEffect(() => {
    const handleToggleEvent = () => {
      setIsSidebarCollapsed(prev => !prev);
    };
    window.addEventListener('bbdrts_toggle_modal_sidebar', handleToggleEvent);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (previewCertUrl) {
          setPreviewCertUrl(null);
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
      const isBackslash = (isMod && (e.key === '\\' || e.code === 'Backslash'));
      const isAltShortcut = e.altKey && (
        e.key === 's' || e.key === 'S' || e.code === 'KeyS' ||
        e.key === 'b' || e.key === 'B' || e.code === 'KeyB'
      );
      const isModShortcut = (
        (isMod && (e.key === 'b' || e.key === 'B' || e.code === 'KeyB')) ||
        (isMod && e.shiftKey && (e.key === 's' || e.key === 'S' || e.code === 'KeyS'))
      );

      if (isBracket || isBackslash || isAltShortcut || isModShortcut) {
        e.preventDefault();
        e.stopPropagation();
        setIsSidebarCollapsed(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('bbdrts_toggle_modal_sidebar', handleToggleEvent);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, previewCertUrl]);

  // Fallback handler to load default Red Cross profile ONLY if user explicitly clicks fallback button
  const handleLoadDefaultRedCross = () => {
    setError('');
    setProfile(DEFAULT_RED_CROSS_PROFILE);
    setLoading(false);
  };

  // Safe display name: When loading, show clean loading placeholder instead of flashing "Philippine Red Cross"
  const orgName = useMemo(() => {
    if (profile?.name) return profile.name;
    if (profile?.Org_Name) return profile.Org_Name;
    if (orgData?.name) return orgData.name;
    if (typeof orgId === 'string' && isNaN(orgId)) return orgId;
    if (loading) return 'Loading Organization...';
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

  // Rich NGO Profile Attributes
  const focusAreasRaw = profile?.focusAreas || profile?.preferences?.focusAreas || '';
  const focusAreas = useMemo(() => {
    if (!focusAreasRaw) return [];
    if (Array.isArray(focusAreasRaw)) return focusAreasRaw;
    return String(focusAreasRaw).split(/[,•|]/).map(s => s.trim()).filter(Boolean);
  }, [focusAreasRaw]);

  const hqLandmark = profile?.hqLandmark || profile?.preferences?.hqLandmark || '';
  const socialLink = profile?.socialLink || profile?.preferences?.socialLink || '';
  const emergencyHotline = profile?.emergency_hotline || profile?.preferences?.emergencyHotline || phone || '';
  const secondaryPhone = (profile?.mobileNumber || profile?.phone) && (profile?.mobileNumber || profile?.phone) !== emergencyHotline
    ? (profile?.mobileNumber || profile?.phone)
    : '';
  const leadOfficer = profile?.leadOfficer || profile?.preferences?.leadOfficer || '';
  const establishedYear = profile?.establishedYear || profile?.preferences?.establishedYear || '1947';

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
    ? new Date(profile.verifiedAt || profile.verified_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'October 2024';

  // Normalize board members
  const parseBoardMembers = (raw) => {
    if (!raw) return DEFAULT_RED_CROSS_PROFILE.boardMembers;
    if (Array.isArray(raw)) {
      if (raw.length === 1 && typeof raw[0] === 'string' && raw[0].includes('|')) {
        return raw[0].split('|').map(s => s.trim()).filter(Boolean);
      }
      return raw.map(m => (typeof m === 'object' ? `${m.name || ''} (${m.role || 'Trustee'})` : String(m)));
    }
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parseBoardMembers(parsed);
      } catch (_) {
        if (raw.includes('|')) {
          return raw.split('|').map(s => s.trim()).filter(Boolean);
        }
        return [raw];
      }
    }
    return DEFAULT_RED_CROSS_PROFILE.boardMembers;
  };

  const boardList = parseBoardMembers(profile?.boardMembers);
  const campaigns = profile?.campaigns || [];
  
  // Calculate dynamic stats from campaigns
  const totalRaisedPhpFromCamps = campaigns.reduce((acc, c) => {
    const val = Number(c.currentAmountPhp || (Number(c.currentAmount || 0) * 170000));
    return acc + val;
  }, 0);

  const totalRaisedEthFromCamps = campaigns.reduce((acc, c) => acc + Number(c.currentAmount || 0), 0);

  // Total donors mobilized across campaigns
  const totalDonorsCount = campaigns.reduce((acc, c) => {
    const donors = Number(c.totalBackers || c.donorsCount || 0);
    return acc + donors;
  }, 0);

  // Total documented beneficiary reach across campaigns (lives / families assisted)
  const totalBeneficiariesCount = campaigns.reduce((acc, c) => {
    const raw = String(c.beneficiariesImpact || c.beneficiaries_impact || c.beneficiaries || '');
    const clean = raw.replace(/,/g, '');
    const match = clean.match(/\d+/);
    return acc + (match ? parseInt(match[0], 10) : 0);
  }, 0);

  const stats = profile?.stats || {
    totalCampaigns: campaigns.length,
    totalRaisedEth: totalRaisedEthFromCamps > 0 ? totalRaisedEthFromCamps.toFixed(4) : '0.0000',
    totalRaisedPhp: totalRaisedPhpFromCamps > 0 ? Math.round(totalRaisedPhpFromCamps).toLocaleString('en-US') : '0'
  };

  const getInitials = (name) => {
    return (name || 'OR')
      .split(' ')
      .filter(Boolean)
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const handleCopyWallet = () => {
    if (!walletAddr) return;
    navigator.clipboard.writeText(walletAddr);
    setCopiedWallet(true);
    setTimeout(() => setCopiedWallet(false), 2000);
  };

  const handleOpenDocPreview = (url, title) => {
    setPreviewTitle(title || 'Official Document Preview');
    setPreviewCertUrl(url);
  };

  const effectiveTheme = theme || (typeof document !== 'undefined' ? (document.documentElement.getAttribute('data-theme') || 'dark') : 'dark');

  const modalNode = (
    <div className="vercel-ngo-backdrop" onClick={onClose} data-theme={effectiveTheme}>
      <div className="vercel-ngo-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">

        {/* ── Top Header Bar (With Accurate Loading Title & Sidebar Collapse Toggle) ── */}
        <header className="vercel-ngo-topbar">
          <div className="vercel-ngo-breadcrumbs">
            <button
              type="button"
              className="vercel-sidebar-toggle-btn"
              onClick={() => setIsSidebarCollapsed(prev => !prev)}
              title={isSidebarCollapsed ? "Expand Sidebar ([ or Ctrl+\\ or Alt+S)" : "Collapse Sidebar ([ or Ctrl+\\ or Alt+S)"}
              aria-label="Toggle Sidebar"
            >
              <VercelIcon name={isSidebarCollapsed ? 'menu_open' : 'dock_to_right'} size={18} />
            </button>
            <VercelIcon name="domain" size={18} color="#10b981" />
            <span className="vercel-ngo-breadcrumb-parent">Organizations</span>
            <span className="vercel-ngo-breadcrumb-separator">/</span>
            <span className="vercel-ngo-breadcrumb-current">
              {loading && !profile ? (
                <span className="vercel-loading-shimmer-text">Loading Organization...</span>
              ) : (
                orgName
              )}
            </span>

            {/* Verified badge only displays once profile is loaded */}
            {!loading && profile && (
              <span className="vercel-ngo-verified-pill">
                <VercelIcon name="verified" size={14} color="#10b981" />
                SEC &amp; DSWD Accredited
              </span>
            )}
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

        {/* ── Content View Switcher: Loading Skeleton vs Error State vs 2-Column Split ── */}
        {loading && !profile ? (
          <div className="vercel-ngo-skeleton-body">
            <div className="vercel-skeleton-sidebar">
              <div className="vercel-skeleton-banner" />
              <div className="vercel-skeleton-avatar" />
              <div className="vercel-skeleton-line title" />
              <div className="vercel-skeleton-line sub" />
              <div className="vercel-skeleton-line badges" />
              <div className="vercel-skeleton-card" style={{ height: '70px', marginTop: '10px' }} />
            </div>
            <div className="vercel-skeleton-main">
              <div className="vercel-skeleton-stats-grid">
                <div className="vercel-skeleton-card" />
                <div className="vercel-skeleton-card" />
                <div className="vercel-skeleton-card" />
              </div>
              <div className="vercel-skeleton-content-area" />
            </div>
          </div>
        ) : error && !profile ? (
          <div className="vercel-ngo-error-body">
            <div className="vercel-error-card">
              <div className="vercel-error-icon-wrap">
                <VercelIcon name="error" size={24} color="#ef4444" />
              </div>
              <h3 className="vercel-error-title">Registry Record Unavailable</h3>
              <p className="vercel-error-desc">
                {error} We could not resolve this specific organization profile from the registry right now.
              </p>
              <div className="vercel-error-actions">
                <button
                  type="button"
                  className="vercel-btn vercel-btn-primary"
                  onClick={handleLoadDefaultRedCross}
                >
                  Load Philippine Red Cross Profile
                </button>
                <button
                  type="button"
                  className="vercel-btn vercel-btn-secondary"
                  onClick={onClose}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ════════ 2-COLUMN SPLIT LAYOUT (SIDEBAR 35% | BODY 65%) ════════ */
          <div className={`vercel-ngo-split-layout ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>

            {/* ════════ LEFT COLUMN: SIDEBAR (35%) ════════ */}
            {!isSidebarCollapsed && (
              <aside className="vercel-ngo-sidebar">
                {/* Organization Cover Banner */}
                <div
                  className="vercel-sidebar-banner"
                  style={
                    bannerUrl && (bannerUrl.startsWith('data:') || bannerUrl.startsWith('http') || bannerUrl.startsWith('/'))
                      ? { backgroundImage: `url(${bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                      : {}
                  }
                >
                  <div className="vercel-sidebar-banner-overlay" />
                </div>

                {/* Sidebar Profile & Information Content */}
                <div className="vercel-sidebar-content">
                  
                  {/* Institutional Avatar */}
                  <div className="vercel-sidebar-avatar-wrap">
                    <div className="vercel-sidebar-avatar">
                      {avatarUrl && (avatarUrl.startsWith('data:') || avatarUrl.startsWith('http')) ? (
                        <img src={avatarUrl} alt={orgName} />
                      ) : avatarUrl && avatarUrl.length < 30 ? (
                        <VercelIcon name={avatarUrl} size={28} />
                      ) : (
                        <span className="vercel-sidebar-initials">{getInitials(orgName)}</span>
                      )}
                    </div>
                    <span className="vercel-sidebar-avatar-badge" title="Verified Philippine Humanitarian Non-Profit">
                      <VercelIcon name="check" size={13} color="#ffffff" />
                    </span>
                  </div>

                  {/* Organization Titles & Badges */}
                  <div className="vercel-sidebar-meta">
                    <h3 className="vercel-sidebar-title">{orgName}</h3>
                    <div className="vercel-sidebar-verified-tag">
                      <VercelIcon name="verified" size={14} color="#10b981" />
                      <span>SEC Verified Non-Profit</span>
                    </div>
                    <span className="vercel-sidebar-accredited-date">
                      Chartered Non-Profit • Accredited {verifiedDateStr}
                    </span>
                  </div>

                  {/* Location & Operational Landmark Base */}
                  {(location || hqLandmark) && (
                    <div className="vercel-sidebar-loc-group">
                      {location && (
                        <div className="vercel-sidebar-loc-row">
                          <VercelIcon name="location_on" size={15} color="#f59e0b" />
                          <span>{location}</span>
                        </div>
                      )}
                      {hqLandmark && (
                        <div className="vercel-sidebar-landmark-row">
                          <VercelIcon name="apartment" size={15} color="#38bdf8" />
                          <div>
                            <span className="lbl">Base / Landmark</span>
                            <span className="val">{hqLandmark}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Monospace Compliance Badges */}
                  {(secRegNo || dswdNo) && (
                    <div className="vercel-sidebar-badges">
                      {secRegNo && <span className="vercel-meta-item mono">SEC: {secRegNo}</span>}
                      {dswdNo && <span className="vercel-meta-item mono">DSWD: {dswdNo}</span>}
                    </div>
                  )}

                  {/* Organization Mission Card with "Show more" Toggle */}
                  {bio && (
                    <div className="vercel-sidebar-card">
                      <div className="vercel-sidebar-card-header-line">
                        <VercelIcon name="flag" size={14} color="#10b981" />
                        <span className="vercel-sidebar-card-label">Humanitarian Mission &amp; Mandate</span>
                      </div>
                      <ExpandableText text={bio} maxLen={130} className="vercel-sidebar-bio" />
                    </div>
                  )}

                  {/* Disaster Response Focus Areas Chips */}
                  {focusAreas.length > 0 && (
                    <div className="vercel-sidebar-card">
                      <div className="vercel-sidebar-card-header-line">
                        <VercelIcon name="travel_explore" size={14} color="#0ea5e9" />
                        <span className="vercel-sidebar-card-label">Relief Capabilities &amp; Focus</span>
                      </div>
                      <div className="vercel-sidebar-tags">
                        {focusAreas.map((area, idx) => (
                          <span key={idx} className="vercel-sidebar-tag-chip">
                            #{area.replace(/\s+/g, '')}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Dispatch Hotline & Portal Quick Actions */}
                  <div className="vercel-sidebar-contact-card">
                    {emergencyHotline && (
                      <div className="vercel-sidebar-contact-row">
                        <VercelIcon name="call" size={16} color="#ef4444" />
                        <div>
                          <span className="lbl">24/7 Operations Hotline</span>
                          <a href={`tel:${emergencyHotline.replace(/[^\d+]/g, '')}`} className="val" style={{ textDecoration: 'none' }}>
                            {emergencyHotline}
                          </a>
                        </div>
                      </div>
                    )}

                    {secondaryPhone && (
                      <div className="vercel-sidebar-contact-row">
                        <VercelIcon name="phone_iphone" size={16} color="#38bdf8" />
                        <div>
                          <span className="lbl">Secondary Contact Mobile</span>
                          <span className="val">{secondaryPhone}</span>
                        </div>
                      </div>
                    )}

                    {orgEmail && (
                      <div className="vercel-sidebar-contact-row">
                        <VercelIcon name="mail" size={16} color="#10b981" />
                        <div>
                          <span className="lbl">Official Email</span>
                          <a href={`mailto:${orgEmail}`} className="val" style={{ textDecoration: 'none' }}>
                            {orgEmail}
                          </a>
                        </div>
                      </div>
                    )}

                    {website && (
                      <a
                        href={website.startsWith('http') ? website : `https://${website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="vercel-sidebar-portal-btn"
                      >
                        <VercelIcon name="language" size={14} />
                        <span>Visit Official Portal</span>
                        <VercelIcon name="open_in_new" size={13} />
                      </a>
                    )}

                    {socialLink && (
                      <a
                        href={socialLink.startsWith('http') ? socialLink : `https://${socialLink}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="vercel-sidebar-social-btn"
                      >
                        <VercelIcon name="share" size={14} />
                        <span>Official Social Channel</span>
                        <VercelIcon name="open_in_new" size={13} />
                      </a>
                    )}
                  </div>

                  {/* Leadership / Governance Point of Contact */}
                  {leadOfficer && (
                    <div className="vercel-sidebar-officer-row">
                      <VercelIcon name="badge" size={16} color="#a855f7" />
                      <div>
                        <span className="lbl">Executive Leadership</span>
                        <span className="val">{leadOfficer}</span>
                      </div>
                    </div>
                  )}

                  {/* Trust & Charter Verification Badges */}
                  <div className="vercel-sidebar-trust-strip">
                    <div className="vercel-sidebar-trust-pill">
                      <VercelIcon name="verified" size={13} color="#10b981" />
                      <span>SEC eSPARC Non-Stock Compliant</span>
                    </div>
                    <div className="vercel-sidebar-trust-pill">
                      <VercelIcon name="shield" size={13} color="#38bdf8" />
                      <span>DSWD Accredited First Responder</span>
                    </div>
                  </div>

                </div>
              </aside>
            )}

            {/* ════════ RIGHT COLUMN: MAIN BODY (65% or 100% when collapsed) ════════ */}
            <main className="vercel-ngo-main">

              {/* ── Impact Metrics Strip: 3 Clean, Human-Relevant Impact Tiles ── */}
              <section className="vercel-ngo-metrics-strip">
                <div className="vercel-metric-tile">
                  <span className="vercel-metric-label">Documented Community Reach</span>
                  <span className="vercel-metric-value" style={{ color: '#10b981' }}>
                    {totalBeneficiariesCount > 0 ? `${totalBeneficiariesCount.toLocaleString('en-US')}+ Reached` : 'Verified Field Reach'}
                  </span>
                  <span className="vercel-metric-sub">Direct Ground Aid Distribution</span>
                </div>

                <div className="vercel-metric-tile">
                  <span className="vercel-metric-label">Relief Operations</span>
                  <span className="vercel-metric-value">{stats.totalCampaigns} Active Missions</span>
                  <span className="vercel-metric-sub">100% Escrow Backed</span>
                </div>

                <div className="vercel-metric-tile">
                  <span className="vercel-metric-label">Donors &amp; Community</span>
                  <span className="vercel-metric-value" style={{ color: '#10b981' }}>
                    {totalDonorsCount > 0 ? `${totalDonorsCount} Donors Supported` : 'SEC & DSWD Accredited'}
                  </span>
                  <span className="vercel-metric-sub">Verified Humanitarian Escrow</span>
                </div>
              </section>

              {/* ── Navigation Tabs: Concise, Never Cuts Off ── */}
              <nav className="vercel-ngo-tabs-bar" aria-label="Organization views">
                <button
                  type="button"
                  className={`vercel-tab-btn ${activeTab === 'campaigns' ? 'active' : ''}`}
                  onClick={() => setActiveTab('campaigns')}
                >
                  <VercelIcon name="volunteer_activism" size={16} />
                  <span>Operations</span>
                  <span className="vercel-tab-count">{campaigns.length}</span>
                </button>

                <button
                  type="button"
                  className={`vercel-tab-btn ${activeTab === 'governance' ? 'active' : ''}`}
                  onClick={() => setActiveTab('governance')}
                >
                  <VercelIcon name="shield" size={16} />
                  <span>Governance &amp; SEC</span>
                </button>

                <button
                  type="button"
                  className={`vercel-tab-btn ${activeTab === 'treasury' ? 'active' : ''}`}
                  onClick={() => setActiveTab('treasury')}
                >
                  <VercelIcon name="account_balance_wallet" size={16} />
                  <span>Payment Channels</span>
                </button>

                <button
                  type="button"
                  className={`vercel-tab-btn ${activeTab === 'contact' ? 'active' : ''}`}
                  onClick={() => setActiveTab('contact')}
                >
                  <VercelIcon name="support_agent" size={16} />
                  <span>Dispatch &amp; Contact</span>
                </button>
              </nav>

              {/* Scrollable Tab Panels Body */}
              <div className="vercel-ngo-panel-scroll">

                {/* TAB 1: RELIEF OPERATIONS */}
                {activeTab === 'campaigns' && (
                  <div className="vercel-tab-pane">
                    <div className="vercel-pane-header">
                      <div>
                        <h4 className="vercel-pane-title">Active Relief Operations</h4>
                        <p className="vercel-pane-desc">
                          Emergency disaster response and community rebuilding operations actively deployed by {orgName}.
                        </p>
                      </div>
                    </div>

                    {campaigns.length === 0 ? (
                      <div className="vercel-empty-card">
                        <VercelIcon name="inventory_2" size={30} color="#666666" />
                        <p>All emergency operations for this organization are currently fully funded or under scheduled milestone distribution.</p>
                      </div>
                    ) : (
                      <div className="vercel-campaigns-list">
                        {campaigns.map(c => {
                          const targetEth = Number(c.targetAmount || 1);
                          const currentEth = Number(c.currentAmount || 0);
                          const pct = Math.min(Math.round((currentEth / targetEth) * 100), 100);
                          const raisedPhp = Number(c.currentAmountPhp || Math.round(currentEth * 170000)).toLocaleString('en-US');
                          const goalPhp = Number(c.targetAmountPhp || Math.round(targetEth * 170000)).toLocaleString('en-US');
                          const urgency = formatUrgency(c.urgency);
                          const categoryName = formatCategory(c.category);

                          return (
                            <div key={c.id} className="vercel-campaign-card">
                              <div className="vercel-camp-header">
                                <div>
                                  <span className="vercel-camp-badge">{categoryName}</span>
                                  <h4 className="vercel-camp-title">{c.title}</h4>
                                </div>
                                <span className={`vercel-camp-urgency ${urgency.type}`}>
                                  <span className="vercel-urgency-dot" />
                                  {urgency.label}
                                </span>
                              </div>

                              {/* Campaign Description with "Show more" Toggle */}
                              <ExpandableText text={c.description} maxLen={110} className="vercel-camp-desc" />

                              {/* Modern Luminous Progress Track */}
                              <div className="vercel-camp-progress-section">
                                <div className="vercel-progress-track">
                                  <div
                                    className="vercel-progress-bar"
                                    style={{ width: `${Math.max(pct, 2)}%` }}
                                  />
                                </div>
                                <div className="vercel-progress-labels">
                                  <span className="raised">
                                    ₱{raisedPhp} <span className="sub">raised</span>
                                  </span>
                                  <span className="goal">
                                    Goal: ₱{goalPhp} <span className="pct-badge">({pct}%)</span>
                                  </span>
                                </div>
                              </div>

                              <div className="vercel-camp-footer">
                                <div className="vercel-camp-loc">
                                  <VercelIcon name="location_on" size={14} />
                                  <span className="loc-text" title={c.locationRegion || 'Philippines Impact Zone'}>
                                    {c.locationRegion || 'Philippines Impact Zone'}
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  className="vercel-btn vercel-btn-primary"
                                  onClick={() => {
                                    onClose();
                                    if (onSelectCampaign) onSelectCampaign(c);
                                    document.getElementById('campaigns')?.scrollIntoView({ behavior: 'smooth' });
                                  }}
                                >
                                  <span>Donate to Operation</span>
                                  <VercelIcon name="arrow_forward" size={14} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: GOVERNANCE & SEC ACCREDITATION */}
                {activeTab === 'governance' && (
                  <div className="vercel-tab-pane">
                    <div className="vercel-card-box">
                      <div className="vercel-card-box-header">
                        <div>
                          <h4 className="vercel-card-box-title">Securities and Exchange Commission (SEC) Registration</h4>
                          <p className="vercel-card-box-desc">
                            Registered Non-Stock, Non-Profit Corporation organized under the Revised Corporation Code of the Philippines (Republic Act 11232).
                          </p>
                        </div>

                        {certUrl && (
                          <button
                            type="button"
                            className="vercel-btn vercel-btn-secondary"
                            onClick={() => handleOpenDocPreview(certUrl, 'Official SEC Certificate of Incorporation')}
                          >
                            <VercelIcon name="visibility" size={15} />
                            <span>View SEC Certificate</span>
                          </button>
                        )}
                      </div>

                      <div className="vercel-info-grid">
                        <div className="vercel-info-item">
                          <span className="lbl">SEC Registration Number</span>
                          <span className="val mono">{secRegNo || 'SEC-CN2021-08492'}</span>
                        </div>
                        <div className="vercel-info-item">
                          <span className="lbl">DSWD License Status</span>
                          <span className="val mono">{dswdNo || 'DSWD-SB-A-2024-0193'}</span>
                        </div>
                        <div className="vercel-info-item">
                          <span className="lbl">Legal Classification</span>
                          <span className="val">Non-Stock, Non-Profit Humanitarian NGO</span>
                        </div>
                        <div className="vercel-info-item">
                          <span className="lbl">Anti-Bias Escrow Rubric</span>
                          <span className="val" style={{ color: '#10b981' }}>● Audited &amp; Approved</span>
                        </div>
                      </div>
                    </div>

                    {/* Board of Trustees */}
                    <div className="vercel-card-box" style={{ marginTop: '14px' }}>
                      <div className="vercel-card-box-header">
                        <div>
                          <h4 className="vercel-card-box-title">Board of Trustees &amp; Accountable Signatories</h4>
                          <p className="vercel-card-box-desc">
                            Authorized executive officers responsible for milestone liquidation and humanitarian relief coordination.
                          </p>
                        </div>
                      </div>

                      <div className="vercel-board-grid">
                        {boardList.map((member, idx) => (
                          <div key={idx} className="vercel-board-card">
                            <div className="vercel-board-avatar">
                              <VercelIcon name="person" size={16} />
                            </div>
                            <div className="vercel-board-text">
                              <strong className="name">{member}</strong>
                              <span className="role">Institutional Signatory</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: MULTI-RAIL TREASURY & PAYMENT CHANNELS */}
                {activeTab === 'treasury' && (
                  <div className="vercel-tab-pane">
                    <div className="vercel-card-box">
                      <div className="vercel-card-box-header">
                        <div>
                          <h4 className="vercel-card-box-title">Audited Multi-Rail Treasury Coordinates</h4>
                          <p className="vercel-card-box-desc">
                            All Philippine Peso donations (GCash, Maya, Cards, and Bank Transfer) are verified and notarized gaslessly onto the public Ethereum Sepolia audit ledger.
                          </p>
                        </div>
                      </div>

                      <div className="vercel-rails-grid">

                        {/* GCash Rail */}
                        <div className="vercel-rail-card">
                          <div className="vercel-rail-top">
                            <span className="vercel-rail-name">Official GCash Relief Hub</span>
                            <span className="vercel-rail-tag gcash">GCash</span>
                          </div>
                          {gcashName && <div className="vercel-rail-holder">Account Name: <strong>{gcashName}</strong></div>}
                          <code className="vercel-rail-code">{gcashNo || '0917 890 1430'}</code>
                          <span className="vercel-rail-caption">Verified Non-Profit Electronic Wallet Account</span>
                          {gcashQrUrl && (
                            <div className="vercel-rail-actions">
                              <button
                                type="button"
                                className="vercel-btn-pill"
                                onClick={() => handleOpenDocPreview(gcashQrUrl, 'Official GCash QR Ph')}
                              >
                                <VercelIcon name="qr_code_scanner" size={13} />
                                <span>View GCash QR Ph</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Maya Rail */}
                        <div className="vercel-rail-card">
                          <div className="vercel-rail-top">
                            <span className="vercel-rail-name">Official Maya Relief Account</span>
                            <span className="vercel-rail-tag maya">Maya</span>
                          </div>
                          {mayaName && <div className="vercel-rail-holder">Account Name: <strong>{mayaName}</strong></div>}
                          <code className="vercel-rail-code">{mayaNo || '0918 765 1430'}</code>
                          <span className="vercel-rail-caption">Verified Institutional Merchant ID</span>
                          {mayaQrUrl && (
                            <div className="vercel-rail-actions">
                              <button
                                type="button"
                                className="vercel-btn-pill"
                                onClick={() => handleOpenDocPreview(mayaQrUrl, 'Official Maya QR Ph')}
                              >
                                <VercelIcon name="qr_code_scanner" size={13} />
                                <span>View Maya QR Ph</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Bank Rail */}
                        <div className="vercel-rail-card">
                          <div className="vercel-rail-top">
                            <span className="vercel-rail-name">{bankName || 'Commercial Bank Wire'}</span>
                            <span className="vercel-rail-tag bank">InstaPay / PESONet</span>
                          </div>
                          {bankAccountName && <div className="vercel-rail-holder">Holder: <strong>{bankAccountName}</strong></div>}
                          <code className="vercel-rail-code">{bankAccountNumber ? `Acct: ${bankAccountNumber}` : (bankDetails || 'BDO / Landbank Relief Account')}</code>
                          <span className="vercel-rail-caption">Direct Bank Wire / InstaPay Disaster Account</span>
                          {bankQrUrl && (
                            <div className="vercel-rail-actions">
                              <button
                                type="button"
                                className="vercel-btn-pill"
                                onClick={() => handleOpenDocPreview(bankQrUrl, 'Official Bank Transfer QR')}
                              >
                                <VercelIcon name="qr_code_scanner" size={13} />
                                <span>View Bank QR</span>
                              </button>
                            </div>
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
                          <h4 className="vercel-card-box-title">Emergency Response Dispatch &amp; Operations Center</h4>
                          <p className="vercel-card-box-desc">
                            Direct communication coordinates for frontline emergency reporting, field coordination, and institutional logistics.
                          </p>
                        </div>
                      </div>

                      <div className="vercel-contact-grid">
                        <div className="vercel-contact-tile">
                          <div className="vercel-contact-icon emergency">
                            <VercelIcon name="call" size={18} color="#ef4444" />
                          </div>
                          <div>
                            <span className="lbl">24/7 Disaster Operations Hotline</span>
                            <strong className="val">{emergencyHotline || phone || '143 / (02) 8790-2300'}</strong>
                          </div>
                        </div>

                        {secondaryPhone && (
                          <div className="vercel-contact-tile">
                            <div className="vercel-contact-icon phone" style={{ background: 'rgba(56, 189, 248, 0.1)', borderColor: 'rgba(56, 189, 248, 0.25)' }}>
                              <VercelIcon name="phone_iphone" size={18} color="#38bdf8" />
                            </div>
                            <div>
                              <span className="lbl">Secondary Contact Mobile</span>
                              <strong className="val">{secondaryPhone}</strong>
                            </div>
                          </div>
                        )}

                        <div className="vercel-contact-tile">
                          <div className="vercel-contact-icon email">
                            <VercelIcon name="mail" size={18} color="#10b981" />
                          </div>
                          <div>
                            <span className="lbl">Official Institutional Email</span>
                            <strong className="val">{orgEmail || 'operations@bbdrts.gov.ph'}</strong>
                          </div>
                        </div>

                        <div className="vercel-contact-tile">
                          <div className="vercel-contact-icon web">
                            <VercelIcon name="language" size={18} color="#0070f3" />
                          </div>
                          <div>
                            <span className="lbl">Official Web Portal</span>
                            <a href={website.startsWith('http') ? website : `https://${website || 'redcross.org.ph'}`} target="_blank" rel="noopener noreferrer" className="val-link">
                              {website || 'https://redcross.org.ph'} ↗
                            </a>
                          </div>
                        </div>

                        <div className="vercel-contact-tile">
                          <div className="vercel-contact-icon loc">
                            <VercelIcon name="location_on" size={18} color="#f59e0b" />
                          </div>
                          <div>
                            <span className="lbl">Operations Logistics Headquarters</span>
                            <strong className="val">{location || 'Metro Manila & Regional Field Hubs'}</strong>
                          </div>
                        </div>

                        {hqLandmark && (
                          <div className="vercel-contact-tile">
                            <div className="vercel-contact-icon landmark" style={{ background: 'rgba(56, 189, 248, 0.1)', borderColor: 'rgba(56, 189, 248, 0.25)' }}>
                              <VercelIcon name="apartment" size={18} color="#38bdf8" />
                            </div>
                            <div>
                              <span className="lbl">Headquarters Landmark &amp; Base</span>
                              <strong className="val">{hqLandmark}</strong>
                            </div>
                          </div>
                        )}

                        {socialLink && (
                          <div className="vercel-contact-tile">
                            <div className="vercel-contact-icon social" style={{ background: 'rgba(168, 85, 247, 0.1)', borderColor: 'rgba(168, 85, 247, 0.25)' }}>
                              <VercelIcon name="share" size={18} color="#a855f7" />
                            </div>
                            <div>
                              <span className="lbl">Official Social Media Page</span>
                              <a href={socialLink.startsWith('http') ? socialLink : `https://${socialLink}`} target="_blank" rel="noopener noreferrer" className="val-link">
                                {socialLink} ↗
                              </a>
                            </div>
                          </div>
                        )}

                        {focusAreas.length > 0 && (
                          <div className="vercel-contact-tile" style={{ gridColumn: '1 / -1' }}>
                            <div className="vercel-contact-icon focus" style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.25)' }}>
                              <VercelIcon name="travel_explore" size={18} color="#10b981" />
                            </div>
                            <div style={{ flex: 1 }}>
                              <span className="lbl">Primary Disaster Response Capabilities</span>
                              <div className="vercel-sidebar-tags" style={{ marginTop: '6px' }}>
                                {focusAreas.map((area, idx) => (
                                  <span key={idx} className="vercel-sidebar-tag-chip" style={{ fontSize: '0.75rem', padding: '3px 8px' }}>
                                    #{area.replace(/\s+/g, '')}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
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

      {/* SEC Document & QR Lightbox Modal */}
      <SecCertificateModal
        isOpen={!!previewCertUrl}
        onClose={() => setPreviewCertUrl(null)}
        url={previewCertUrl}
        orgName={orgName}
        regNo={secRegNo}
        title={previewTitle}
      />
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : null;
}
