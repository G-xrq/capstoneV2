import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import SecCertificateModal from './SecCertificateModal';
import DisbursementProofModal from './DisbursementProofModal';
import { formatPhoneNumber } from '../utils/formatters';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { API_URL } from '../config';
import './NgoProfileModal.css';

// Clean human-readable category formatter (eliminates raw acronyms like "CD RELIEF")
const formatCategory = (cat) => {
  if (!cat) return 'Humanitarian Relief';
  const raw = String(cat).trim();
  const upper = raw.toUpperCase();
  const map = {
    CD: 'Community & Charity Drive',
    'CD RELIEF': 'Community & Charity Drive',
    CHARITY: 'Charity & Community Aid',
    DR: 'Disaster Relief',
    ER: 'Emergency Response',
    CR: 'Community Rehabilitation',
    MED: 'Medical Assistance',
    MEDICAL: 'Medical Assistance',
    FOOD: 'Emergency Food & Water',
    SHELTER: 'Shelter & Evacuation',
    WATER: 'Clean Water & Sanitation',
    'FIRE AID': 'Fire Relief & Recovery',
    FIRE: 'Fire Relief & Recovery',
    TYPHOON: 'Typhoon Relief',
    FLOOD: 'Flood Response',
    EARTHQUAKE: 'Earthquake Response',
    VOLCANO: 'Volcanic Eruption Relief',
    ANIMAL: 'Animal Welfare & Rescue',
    EDUCATION: 'Education & Youth Support',
    ELDERLY: 'Senior Citizen Care',
    HEALTH: 'Healthcare & Medical Aid'
  };
  if (map[upper]) return map[upper];
  // Title-case any normal multi-word category
  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
};

// Format urgency & funding status cleanly
const resolveMissionStatus = (camp, pct) => {
  const disbursedPhp = Number(camp.disbursedAmountPhp || 0);
  const status = String(camp.disbursementStatus || '').toUpperCase();
  if (status === 'DISBURSED' || status === 'PARTIALLY_DISBURSED' || disbursedPhp > 0) {
    return { label: status === 'DISBURSED' ? 'Aid Disbursed' : 'Partially Disbursed', tone: 'disbursed' };
  }
  if (pct >= 100) {
    return { label: 'Goal Reached', tone: 'funded' };
  }
  const urg = String(camp.urgency || '').toUpperCase();
  if (urg.includes('CRITICAL') || urg.includes('URGENT')) {
    return { label: 'Critical Need', tone: 'critical' };
  }
  if (urg.includes('HIGH') || urg.includes('EMERGENCY')) {
    return { label: 'High Priority', tone: 'high' };
  }
  return { label: 'Active Mission', tone: 'active' };
};

function formatCompactPhp(val) {
  const n = Number(val) || 0;
  if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`;
  return `₱${Math.round(n).toLocaleString('en-US')}`;
}

function getInitials(name) {
  const parts = String(name || 'NG').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'NG';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function ExpandableText({ text, maxLen = 140, className = '' }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  const clean = String(text).trim();
  if (clean.length <= maxLen) {
    return <p className={className}>{clean}</p>;
  }
  return (
    <p className={className}>
      {expanded ? clean : `${clean.slice(0, maxLen).trim()}… `}
      <button
        type="button"
        className="ngo-inline-toggle"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded((prev) => !prev);
        }}
      >
        {expanded ? 'Show less' : 'Read more'}
      </button>
    </p>
  );
}

// Module-level RAM cache for instant profile switching with stale-while-revalidate
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
  const [campSearch, setCampSearch] = useState('');
  const [campFilter, setCampFilter] = useState('all'); // 'all' | 'active' | 'funded' | 'disbursed'
  const [previewCertUrl, setPreviewCertUrl] = useState(null);
  const [previewTitle, setPreviewTitle] = useState('Official Verification Document');
  const [proofModalCamp, setProofModalCamp] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);

  const handleCopy = (key, value) => {
    if (!value) return;
    navigator.clipboard?.writeText(String(value)).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1800);
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
          setError('');
        }
        setLoading(false);
      })
      .catch((err) => {
        console.warn('Organization profile fetch failed:', err);
        if (!orgProfileCache.has(cacheKey)) {
          setError(err.message || 'Unable to load organization profile.');
        }
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    setActiveTab('campaigns');
    setCampSearch('');
    setCampFilter('all');
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

  // Escape key handling (nested modals close first)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (proofModalCamp) {
          setProofModalCamp(null);
          return;
        }
        if (previewCertUrl) {
          setPreviewCertUrl(null);
          return;
        }
        if (typeof onClose === 'function') onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, previewCertUrl, proofModalCamp]);

  const orgName = useMemo(() => {
    if (profile?.name) return profile.name;
    if (profile?.Org_Name) return profile.Org_Name;
    if (orgData?.name) return orgData.name;
    if (typeof orgId === 'string' && isNaN(orgId)) return orgId;
    if (loading) return 'Loading…';
    return 'Organization Profile';
  }, [profile, orgData, orgId, loading]);

  const orgEmail = profile?.email || profile?.Username || '';
  const secRegNo = profile?.secRegistrationNo || profile?.Sec_Registration_No || '';
  const dswdNo = profile?.dswdAccreditationNo || profile?.Dswd_Accreditation_No || '';
  const certUrl = profile?.secCertificateUrl || profile?.Sec_Certificate_Url || null;
  const walletAddr = profile?.walletAddress || profile?.Wallet_Address || '';
  const phone = profile?.mobileNumber || profile?.phone || '';
  const location = profile?.location || '';
  const bio = profile?.bio || profile?.missionStatement || profile?.preferences?.missionStatement || '';
  const website = profile?.website || profile?.preferences?.website || '';
  const bannerUrl = profile?.banner_url || profile?.bannerUrl || profile?.banner || '';
  const avatarUrl = profile?.avatar_url || profile?.avatarUrl || profile?.avatar || '';
  const hqLandmark = profile?.hqLandmark || profile?.preferences?.hqLandmark || '';
  const socialLink = profile?.socialLink || profile?.preferences?.socialLink || '';
  const emergencyHotline = profile?.emergency_hotline || profile?.preferences?.emergencyHotline || phone || '';
  const secondaryPhone = phone && phone !== emergencyHotline ? phone : '';
  const leadOfficer = profile?.leadOfficer || profile?.preferences?.leadOfficer || '';

  const focusAreas = useMemo(() => {
    const raw = profile?.focusAreas || profile?.preferences?.focusAreas || '';
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter(Boolean);
    return String(raw).split(/[,•|]/).map((s) => s.trim()).filter(Boolean);
  }, [profile]);

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

  // Honest board list — never fabricates another NGO's trustees
  const boardList = useMemo(() => {
    const raw = profile?.boardMembers;
    if (!raw) return [];
    if (Array.isArray(raw)) {
      if (raw.length === 1 && typeof raw[0] === 'string' && raw[0].includes('|')) {
        return raw[0].split('|').map((s) => s.trim()).filter(Boolean);
      }
      return raw
        .map((m) => (typeof m === 'object' && m ? `${m.name || ''}${m.role ? ` (${m.role})` : ''}`.trim() : String(m).trim()))
        .filter(Boolean);
    }
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed
            .map((m) => (typeof m === 'object' && m ? `${m.name || ''}${m.role ? ` (${m.role})` : ''}`.trim() : String(m).trim()))
            .filter(Boolean);
        }
      } catch (_) {
        return raw.split('|').map((s) => s.trim()).filter(Boolean);
      }
    }
    return [];
  }, [profile]);

  const campaigns = useMemo(() => (Array.isArray(profile?.campaigns) ? profile.campaigns : []), [profile]);

  // Real financial & humanitarian metrics from the NGO's campaigns
  const totalRaisedPhp = useMemo(() => {
    const fromCamps = campaigns.reduce((acc, c) => {
      const val = Number(c.currentAmountPhp || Math.round((Number(c.currentAmount) || 0) * 170000));
      return acc + val;
    }, 0);
    if (fromCamps > 0) return Math.round(fromCamps);
    const statRaw = String(profile?.stats?.totalRaisedPhp || '0').replace(/[^\d.]/g, '');
    return Math.round(Number(statRaw) || 0);
  }, [campaigns, profile]);

  const totalDisbursedPhp = useMemo(() => {
    const fromCamps = campaigns.reduce((acc, c) => acc + (Number(c.disbursedAmountPhp) || 0), 0);
    if (fromCamps > 0) return Math.round(fromCamps);
    return Math.round(Number(profile?.stats?.totalDisbursedPhp) || 0);
  }, [campaigns, profile]);

  const activeCampaignCount = useMemo(
    () => campaigns.filter((c) => c.isActive !== 0 && c.isActive !== false).length,
    [campaigns]
  );

  const disbursedCampaignCount = useMemo(
    () =>
      campaigns.filter(
        (c) =>
          Number(c.disbursedAmountPhp || 0) > 0 ||
          c.disbursementStatus === 'DISBURSED' ||
          c.disbursementStatus === 'PARTIALLY_DISBURSED'
      ).length,
    [campaigns]
  );

  const totalBeneficiariesCount = useMemo(
    () =>
      campaigns.reduce((acc, c) => {
        const raw = String(c.beneficiariesImpact || c.beneficiaries_impact || c.beneficiaries || '');
        const match = raw.replace(/,/g, '').match(/\d+/);
        return acc + (match ? parseInt(match[0], 10) : 0);
      }, 0),
    [campaigns]
  );

  const totalDonorsCount = useMemo(() => {
    const fromCamps = campaigns.reduce((acc, c) => acc + (Number(c.donorsCount || c.totalBackers || 0)), 0);
    return Math.max(fromCamps, Number(profile?.stats?.totalDonors || 0));
  }, [campaigns, profile]);

  const filteredCampaigns = useMemo(() => {
    const q = campSearch.trim().toLowerCase();
    return campaigns.filter((c) => {
      const targetPhp = Number(c.targetAmountPhp || Math.round((Number(c.targetAmount) || 0) * 170000)) || 1;
      const raisedPhp = Number(c.currentAmountPhp || Math.round((Number(c.currentAmount) || 0) * 170000));
      const pct = Math.round((raisedPhp / targetPhp) * 100);
      const isDisbursed =
        Number(c.disbursedAmountPhp || 0) > 0 ||
        c.disbursementStatus === 'DISBURSED' ||
        c.disbursementStatus === 'PARTIALLY_DISBURSED';

      if (campFilter === 'active' && (c.isActive === 0 || c.isActive === false || pct >= 100)) return false;
      if (campFilter === 'funded' && pct < 100) return false;
      if (campFilter === 'disbursed' && !isDisbursed) return false;

      if (!q) return true;
      const hay = [c.title, c.description, c.locationRegion, formatCategory(c.category)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [campaigns, campSearch, campFilter]);

  // Payment rails configured on this organization
  const configuredRails = useMemo(() => {
    const list = [];
    if (gcashNo || gcashName || gcashQrUrl) {
      list.push({
        id: 'gcash',
        tag: 'GCash',
        tone: 'gcash',
        title: 'GCash Relief Account',
        holder: gcashName,
        number: gcashNo,
        qrUrl: gcashQrUrl,
        caption: 'Direct Philippine e-wallet transfer'
      });
    }
    if (mayaNo || mayaName || mayaQrUrl) {
      list.push({
        id: 'maya',
        tag: 'Maya',
        tone: 'maya',
        title: 'Maya Relief Account',
        holder: mayaName,
        number: mayaNo,
        qrUrl: mayaQrUrl,
        caption: 'Direct Maya institutional account'
      });
    }
    if (bankAccountNumber || bankName || bankDetails || bankQrUrl) {
      list.push({
        id: 'bank',
        tag: 'InstaPay / Bank',
        tone: 'bank',
        title: bankName || 'Bank Transfer Account',
        holder: bankAccountName,
        number: bankAccountNumber || bankDetails,
        qrUrl: bankQrUrl,
        caption: 'Direct Philippine bank transfer'
      });
    }
    return list;
  }, [gcashNo, gcashName, gcashQrUrl, mayaNo, mayaName, mayaQrUrl, bankName, bankAccountName, bankAccountNumber, bankDetails, bankQrUrl]);

  const hasBanner = Boolean(
    bannerUrl && (bannerUrl.startsWith('data:') || bannerUrl.startsWith('http') || bannerUrl.startsWith('/'))
  );

  const handleNavigateToCampaign = (camp) => {
    onClose?.();
    if (typeof onSelectCampaign === 'function') {
      onSelectCampaign(camp);
    }
    window.dispatchEvent(new CustomEvent('bbdrts_navigate_campaigns'));
    setTimeout(() => {
      const cardEl = document.getElementById(`campaign-${camp.id}`);
      if (cardEl) {
        const y = window.pageYOffset + cardEl.getBoundingClientRect().top - 90;
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      } else {
        document.getElementById('campaigns')?.scrollIntoView({ behavior: 'smooth' });
      }
    }, 120);
  };

  const handleOpenDocPreview = (url, title) => {
    setPreviewTitle(title || 'Official Document Preview');
    setPreviewCertUrl(url);
  };

  const effectiveTheme =
    theme ||
    (typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') || 'dark' : 'dark');

  const modalNode = (
    <div className="ngo-prof-overlay" onClick={onClose} data-theme={effectiveTheme}>
      <div className="ngo-prof-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={orgName}>
        {/* ── 1. Compact Top Breadcrumb Bar ── */}
        <header className="ngo-prof-topbar">
          <div className="ngo-prof-crumbs">
            {onOpenDirectory ? (
              <button
                type="button"
                className="ngo-prof-crumb-btn"
                onClick={onOpenDirectory}
                title="Back to all accredited NGOs"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>arrow_back</span>
                <span>Organizations</span>
              </button>
            ) : (
              <span className="ngo-prof-crumb-static">Organizations</span>
            )}
            <span className="ngo-prof-crumb-sep">/</span>
            <span className="ngo-prof-crumb-current">{orgName}</span>
          </div>

          <div className="ngo-prof-topbar-right">
            <span className="ngo-prof-esc">ESC</span>
            <button
              type="button"
              className="ngo-prof-close"
              onClick={onClose}
              aria-label="Close organization profile"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </header>

        {/* ── 2. Scrollable Body (Hero + KPI Bar + Tabs + Content) ── */}
        {loading && !profile ? (
          <div className="ngo-prof-scroll">
            <div className="ngo-prof-skel-banner" />
            <div className="ngo-prof-skel-body">
              <div className="ngo-prof-skel-row">
                <div className="ngo-prof-skel-avatar" />
                <div className="ngo-prof-skel-lines">
                  <div className="ngo-prof-skel-line w-40" />
                  <div className="ngo-prof-skel-line w-65" />
                </div>
              </div>
              <div className="ngo-prof-skel-kpis">
                <div className="ngo-prof-skel-box" />
                <div className="ngo-prof-skel-box" />
                <div className="ngo-prof-skel-box" />
                <div className="ngo-prof-skel-box" />
              </div>
              <div className="ngo-prof-skel-cards">
                <div className="ngo-prof-skel-card" />
                <div className="ngo-prof-skel-card" />
              </div>
            </div>
          </div>
        ) : error && !profile ? (
          <div className="ngo-prof-error">
            <span className="material-symbols-outlined err-ico">error_outline</span>
            <h3>Organization Profile Unavailable</h3>
            <p>{error}</p>
            <div className="ngo-prof-error-actions">
              {onOpenDirectory && (
                <button type="button" className="ngo-btn primary" onClick={onOpenDirectory}>
                  Browse Accredited NGOs
                </button>
              )}
              <button type="button" className="ngo-btn secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="ngo-prof-scroll">
            {/* Full-Width Natural Aspect Cover Banner (Never squished into a narrow sidebar) */}
            <div
              className={`ngo-prof-cover ${hasBanner ? 'has-image' : 'is-pattern'}`}
              style={hasBanner ? { backgroundImage: `url(${bannerUrl})` } : undefined}
            >
              <div className="ngo-prof-cover-scrim" />
            </div>

            {/* Identity Header Block */}
            <section className="ngo-prof-identity">
              <div className="ngo-prof-id-main">
                <div className="ngo-prof-avatar">
                  {avatarUrl && (avatarUrl.startsWith('data:') || avatarUrl.startsWith('http') || avatarUrl.startsWith('/')) ? (
                    <img src={avatarUrl} alt={orgName} />
                  ) : (
                    <span>{getInitials(orgName)}</span>
                  )}
                  <span className="ngo-prof-avatar-check" title="Verified Non-Profit">
                    <span className="material-symbols-outlined">check</span>
                  </span>
                </div>

                <div className="ngo-prof-id-text">
                  <div className="ngo-prof-title-line">
                    <h2 className="ngo-prof-name">{orgName}</h2>
                    <span className="ngo-prof-verified-chip">
                      <span className="material-symbols-outlined">verified</span>
                      <span>{dswdNo ? 'SEC & DSWD Verified' : 'SEC Verified'}</span>
                    </span>
                  </div>

                  <div className="ngo-prof-subline">
                    <span>Chartered Non-Profit</span>
                    {verifiedDateStr && (
                      <>
                        <span className="sep">·</span>
                        <span>Accredited {verifiedDateStr}</span>
                      </>
                    )}
                    {location && (
                      <>
                        <span className="sep">·</span>
                        <span className="loc-val" title={location}>{location}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Clean Quick Contact Actions */}
              <div className="ngo-prof-quick-actions">
                {emergencyHotline && (
                  <a
                    href={`tel:${emergencyHotline.replace(/[^\d+]/g, '')}`}
                    className="ngo-quick-chip"
                    title={`Call ${emergencyHotline}`}
                  >
                    <span className="material-symbols-outlined">call</span>
                    <span>{emergencyHotline}</span>
                  </a>
                )}
                {orgEmail && (
                  <a href={`mailto:${orgEmail}`} className="ngo-quick-chip" title={orgEmail}>
                    <span className="material-symbols-outlined">mail</span>
                    <span>Email</span>
                  </a>
                )}
                {website && (
                  <a
                    href={website.startsWith('http') ? website : `https://${website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ngo-quick-chip"
                    title={website}
                  >
                    <span className="material-symbols-outlined">language</span>
                    <span>Website</span>
                  </a>
                )}
              </div>

              {bio && <ExpandableText text={bio} maxLen={190} className="ngo-prof-bio" />}
            </section>

            {/* Sleek 4-Column Tabular KPI Bar */}
            <section className="ngo-prof-kpi-strip" aria-label="Organization impact summary">
              <div className="ngo-kpi-cell">
                <span className="kpi-lbl">Total raised</span>
                <strong className="kpi-val emerald">{formatCompactPhp(totalRaisedPhp)}</strong>
                <span className="kpi-sub">
                  {totalDonorsCount > 0
                    ? `${totalDonorsCount.toLocaleString()} verified donation${totalDonorsCount === 1 ? '' : 's'}`
                    : 'Sepolia-audited ledger'}
                </span>
              </div>

              <div className="ngo-kpi-cell">
                <span className="kpi-lbl">Aid disbursed</span>
                <strong className="kpi-val">{formatCompactPhp(totalDisbursedPhp)}</strong>
                <span className="kpi-sub">
                  {disbursedCampaignCount > 0
                    ? `${disbursedCampaignCount} mission${disbursedCampaignCount === 1 ? '' : 's'} with proofs`
                    : 'Held in verified escrow'}
                </span>
              </div>

              <div className="ngo-kpi-cell">
                <span className="kpi-lbl">Relief missions</span>
                <strong className="kpi-val">{campaigns.length}</strong>
                <span className="kpi-sub">{activeCampaignCount} currently active</span>
              </div>

              <div className="ngo-kpi-cell">
                <span className="kpi-lbl">Community reach</span>
                <strong className="kpi-val">
                  {totalBeneficiariesCount > 0 ? `${totalBeneficiariesCount.toLocaleString()}+` : 'Active'}
                </strong>
                <span className="kpi-sub">
                  {totalBeneficiariesCount > 0 ? 'Documented recipients' : 'Field aid distribution'}
                </span>
              </div>
            </section>

            {/* Clean Underline Tab Navigation */}
            <nav className="ngo-prof-tabs" aria-label="Organization profile sections">
              <button
                type="button"
                className={`ngo-tab ${activeTab === 'campaigns' ? 'active' : ''}`}
                onClick={() => setActiveTab('campaigns')}
              >
                <span>Operations</span>
                <span className="tab-count">{campaigns.length}</span>
              </button>
              <button
                type="button"
                className={`ngo-tab ${activeTab === 'governance' ? 'active' : ''}`}
                onClick={() => setActiveTab('governance')}
              >
                <span>Governance &amp; SEC</span>
              </button>
              <button
                type="button"
                className={`ngo-tab ${activeTab === 'treasury' ? 'active' : ''}`}
                onClick={() => setActiveTab('treasury')}
              >
                <span>Payment Channels</span>
                {configuredRails.length > 0 && <span className="tab-count">{configuredRails.length}</span>}
              </button>
              <button
                type="button"
                className={`ngo-tab ${activeTab === 'contact' ? 'active' : ''}`}
                onClick={() => setActiveTab('contact')}
              >
                <span>Contact &amp; Dispatch</span>
              </button>
            </nav>

            {/* Tab Panel Body */}
            <div className="ngo-prof-content">
              {/* TAB 1: RELIEF OPERATIONS */}
              {activeTab === 'campaigns' && (
                <div className="ngo-tab-pane">
                  {campaigns.length > 2 && (
                    <div className="ngo-ops-toolbar">
                      <div className="ngo-ops-search">
                        <span className="material-symbols-outlined">search</span>
                        <input
                          type="text"
                          placeholder={`Filter ${campaigns.length} missions by title or location…`}
                          value={campSearch}
                          onChange={(e) => setCampSearch(e.target.value)}
                        />
                        {campSearch && (
                          <button type="button" className="clear-btn" onClick={() => setCampSearch('')} aria-label="Clear search">
                            <span className="material-symbols-outlined">close</span>
                          </button>
                        )}
                      </div>

                      <div className="ngo-ops-filters">
                        {[
                          { id: 'all', label: 'All' },
                          { id: 'active', label: 'Active' },
                          { id: 'funded', label: 'Funded' },
                          { id: 'disbursed', label: 'Disbursed' }
                        ].map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            className={`filter-pill ${campFilter === f.id ? 'active' : ''}`}
                            onClick={() => setCampFilter(f.id)}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {filteredCampaigns.length === 0 ? (
                    <div className="ngo-empty-state">
                      <span className="material-symbols-outlined empty-ico">inventory_2</span>
                      <h4>{campaigns.length === 0 ? 'No Campaigns Published Yet' : 'No Matching Missions'}</h4>
                      <p>
                        {campaigns.length === 0
                          ? `${orgName} has not launched any public relief operations yet.`
                          : 'Try clearing your search keyword or switching the mission filter.'}
                      </p>
                      {(campSearch || campFilter !== 'all') && (
                        <button
                          type="button"
                          className="ngo-btn secondary"
                          onClick={() => { setCampSearch(''); setCampFilter('all'); }}
                        >
                          Reset Filters
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="ngo-ops-grid">
                      {filteredCampaigns.map((c) => {
                        const targetPhp = Number(c.targetAmountPhp || Math.round((Number(c.targetAmount) || 0) * 170000)) || 1;
                        const raisedPhp = Number(c.currentAmountPhp || Math.round((Number(c.currentAmount) || 0) * 170000));
                        const rawPct = Math.round((raisedPhp / targetPhp) * 100);
                        const barPct = Math.min(Math.max(rawPct, raisedPhp > 0 ? 2 : 0), 100);
                        const disbursedPhp = Number(c.disbursedAmountPhp || 0);
                        const hasProofs =
                          disbursedPhp > 0 ||
                          c.disbursementStatus === 'DISBURSED' ||
                          c.disbursementStatus === 'PARTIALLY_DISBURSED';
                        const missionStatus = resolveMissionStatus(c, rawPct);

                        return (
                          <article key={c.id} className="ngo-mission-card">
                            <div className="mission-top">
                              <span className="mission-cat">{formatCategory(c.category)}</span>
                              <span className={`mission-status is-${missionStatus.tone}`}>
                                <span className="dot" />
                                {missionStatus.label}
                              </span>
                            </div>

                            <h4 className="mission-title" title={c.title}>{c.title}</h4>

                            {c.description && (
                              <ExpandableText text={c.description} maxLen={95} className="mission-desc" />
                            )}

                            <div className="mission-progress">
                              <div className="progress-track">
                                <div className="progress-fill" style={{ width: `${barPct}%` }} />
                              </div>
                              <div className="progress-row">
                                <span className="raised-val">
                                  <strong>₱{raisedPhp.toLocaleString('en-US')}</strong> raised
                                </span>
                                <span className="goal-val">
                                  of ₱{targetPhp.toLocaleString('en-US')} ({rawPct}%)
                                </span>
                              </div>
                            </div>

                            <div className="mission-footer">
                              <span className="mission-loc" title={c.locationRegion || 'Philippines'}>
                                <span className="material-symbols-outlined">location_on</span>
                                <span>{c.locationRegion || 'Philippines'}</span>
                              </span>

                              <div className="mission-actions">
                                {hasProofs && (
                                  <button
                                    type="button"
                                    className="ngo-btn proof"
                                    onClick={() => setProofModalCamp({ ...c, orgName })}
                                    title="Inspect verified ground delivery proofs & receipts"
                                  >
                                    <span className="material-symbols-outlined">verified</span>
                                    <span>Proofs</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="ngo-btn primary"
                                  onClick={() => handleNavigateToCampaign(c)}
                                >
                                  <span>Donate</span>
                                  <span className="material-symbols-outlined">arrow_forward</span>
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
                <div className="ngo-tab-pane">
                  <div className="ngo-panel-card">
                    <div className="panel-head">
                      <div>
                        <h4>Institutional Registration &amp; Accreditation</h4>
                        <p>
                          Verified under the Revised Corporation Code of the Philippines (Republic Act 11232) and audited by the BBDRTS Compliance Desk.
                        </p>
                      </div>
                      {certUrl && (
                        <button
                          type="button"
                          className="ngo-btn secondary"
                          onClick={() => handleOpenDocPreview(certUrl, `${orgName} — SEC Certificate`)}
                        >
                          <span className="material-symbols-outlined">visibility</span>
                          <span>View SEC Certificate</span>
                        </button>
                      )}
                    </div>

                    <div className="ngo-kv-grid">
                      <div className="ngo-kv-item">
                        <span className="kv-lbl">SEC Registration No.</span>
                        <span className="kv-val mono">{secRegNo || 'On file with BBDRTS'}</span>
                      </div>
                      <div className="ngo-kv-item">
                        <span className="kv-lbl">DSWD Accreditation</span>
                        <span className="kv-val mono">{dswdNo || 'Verified Humanitarian Partner'}</span>
                      </div>
                      <div className="ngo-kv-item">
                        <span className="kv-lbl">Verification Status</span>
                        <span className="kv-val emerald">
                          Approved{verifiedDateStr ? ` · ${verifiedDateStr}` : ''}
                        </span>
                      </div>
                      <div className="ngo-kv-item">
                        <span className="kv-lbl">Legal Classification</span>
                        <span className="kv-val">Non-Stock, Non-Profit Organization</span>
                      </div>
                      {walletAddr && (
                        <div className="ngo-kv-item span-2">
                          <span className="kv-lbl">Public Audit Identity (Sepolia)</span>
                          <div className="kv-copy-row">
                            <code className="kv-val mono">{walletAddr}</code>
                            <button
                              type="button"
                              className="ngo-copy-btn"
                              onClick={() => handleCopy('wallet', walletAddr)}
                            >
                              <span className="material-symbols-outlined">
                                {copiedKey === 'wallet' ? 'check' : 'content_copy'}
                              </span>
                              <span>{copiedKey === 'wallet' ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="ngo-panel-card">
                    <div className="panel-head">
                      <div>
                        <h4>Accountable Signatories &amp; Governance</h4>
                        <p>Authorized officers overseeing field disbursement and liquidation reporting.</p>
                      </div>
                    </div>

                    {boardList.length > 0 || leadOfficer ? (
                      <div className="ngo-signatories-grid">
                        {leadOfficer && !boardList.some((b) => b.includes(leadOfficer)) && (
                          <div className="ngo-signatory-item">
                            <div className="sig-avatar">{getInitials(leadOfficer)}</div>
                            <div>
                              <strong>{leadOfficer}</strong>
                              <span>Executive Lead</span>
                            </div>
                          </div>
                        )}
                        {boardList.map((member, idx) => (
                          <div key={idx} className="ngo-signatory-item">
                            <div className="sig-avatar">{getInitials(member)}</div>
                            <div>
                              <strong>{member}</strong>
                              <span>Authorized Signatory</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="ngo-quiet-note">
                        Verified executive signatory records are on file with the BBDRTS SEC &amp; KYC Compliance Desk.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: PAYMENT CHANNELS */}
              {activeTab === 'treasury' && (
                <div className="ngo-tab-pane">
                  <div className="ngo-panel-card">
                    <div className="panel-head">
                      <div>
                        <h4>Verified Direct Payout Channels</h4>
                        <p>
                          Donations settle directly to {orgName} with 0% BBDRTS commission and automatic gasless Sepolia audit receipts.
                        </p>
                      </div>
                    </div>

                    {configuredRails.length === 0 ? (
                      <p className="ngo-quiet-note">
                        Payment channels for {orgName} are configured per relief campaign. Select any mission under Operations to view its active GCash, Maya, Card, or Bank options.
                      </p>
                    ) : (
                      <div className="ngo-rails-grid">
                        {configuredRails.map((rail) => (
                          <div key={rail.id} className="ngo-rail-card">
                            <div className="rail-head">
                              <span className="rail-title">{rail.title}</span>
                              <span className={`rail-tag is-${rail.tone}`}>{rail.tag}</span>
                            </div>
                            {rail.holder && <div className="rail-holder">{rail.holder}</div>}
                            {rail.number && (
                              <div className="rail-num-row">
                                <code className="rail-num">{rail.number}</code>
                                <button
                                  type="button"
                                  className="ngo-copy-btn"
                                  onClick={() => handleCopy(rail.id, rail.number)}
                                >
                                  <span className="material-symbols-outlined">
                                    {copiedKey === rail.id ? 'check' : 'content_copy'}
                                  </span>
                                  <span>{copiedKey === rail.id ? 'Copied' : 'Copy'}</span>
                                </button>
                              </div>
                            )}
                            <span className="rail-cap">{rail.caption}</span>
                            {rail.qrUrl && (
                              <button
                                type="button"
                                className="ngo-btn secondary rail-qr-btn"
                                onClick={() => handleOpenDocPreview(rail.qrUrl, `${orgName} — ${rail.title} QR`)}
                              >
                                <span className="material-symbols-outlined">qr_code_2</span>
                                <span>View Verified QR</span>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: CONTACT & DISPATCH */}
              {activeTab === 'contact' && (
                <div className="ngo-tab-pane">
                  <div className="ngo-panel-card">
                    <div className="panel-head">
                      <div>
                        <h4>Operations Dispatch &amp; Institutional Contact</h4>
                        <p>Direct channels for donor inquiries, LGU coordination, and field relief verification.</p>
                      </div>
                    </div>

                    <div className="ngo-contact-grid">
                      {emergencyHotline && (
                        <div className="ngo-contact-item">
                          <span className="material-symbols-outlined c-ico">call</span>
                          <div>
                            <span className="c-lbl">Operations Hotline</span>
                            <a href={`tel:${emergencyHotline.replace(/[^\d+]/g, '')}`} className="c-val link">
                              {emergencyHotline}
                            </a>
                          </div>
                        </div>
                      )}

                      {secondaryPhone && (
                        <div className="ngo-contact-item">
                          <span className="material-symbols-outlined c-ico">phone_iphone</span>
                          <div>
                            <span className="c-lbl">Secondary Mobile</span>
                            <span className="c-val">{secondaryPhone}</span>
                          </div>
                        </div>
                      )}

                      {orgEmail && (
                        <div className="ngo-contact-item">
                          <span className="material-symbols-outlined c-ico">mail</span>
                          <div>
                            <span className="c-lbl">Official Email</span>
                            <a href={`mailto:${orgEmail}`} className="c-val link">{orgEmail}</a>
                          </div>
                        </div>
                      )}

                      {location && (
                        <div className="ngo-contact-item">
                          <span className="material-symbols-outlined c-ico">location_on</span>
                          <div>
                            <span className="c-lbl">Operations Base</span>
                            <span className="c-val">{location}</span>
                          </div>
                        </div>
                      )}

                      {hqLandmark && (
                        <div className="ngo-contact-item">
                          <span className="material-symbols-outlined c-ico">apartment</span>
                          <div>
                            <span className="c-lbl">Headquarters Landmark</span>
                            <span className="c-val">{hqLandmark}</span>
                          </div>
                        </div>
                      )}

                      {website && (
                        <div className="ngo-contact-item">
                          <span className="material-symbols-outlined c-ico">language</span>
                          <div>
                            <span className="c-lbl">Official Website</span>
                            <a
                              href={website.startsWith('http') ? website : `https://${website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="c-val link"
                            >
                              {website} ↗
                            </a>
                          </div>
                        </div>
                      )}

                      {socialLink && (
                        <div className="ngo-contact-item">
                          <span className="material-symbols-outlined c-ico">share</span>
                          <div>
                            <span className="c-lbl">Social Channel</span>
                            <a
                              href={socialLink.startsWith('http') ? socialLink : `https://${socialLink}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="c-val link"
                            >
                              {socialLink} ↗
                            </a>
                          </div>
                        </div>
                      )}
                    </div>

                    {focusAreas.length > 0 && (
                      <div className="ngo-focus-block">
                        <span className="c-lbl">Relief Capabilities</span>
                        <div className="ngo-focus-chips">
                          {focusAreas.map((area, idx) => (
                            <span key={idx} className="ngo-focus-chip">{area}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* SEC Document & QR Lightbox */}
      <SecCertificateModal
        isOpen={!!previewCertUrl}
        onClose={() => setPreviewCertUrl(null)}
        url={previewCertUrl}
        orgName={orgName}
        regNo={secRegNo}
        title={previewTitle}
      />

      {/* Verified Field Disbursement Proofs Modal */}
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
