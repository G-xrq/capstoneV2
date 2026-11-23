import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { API_URL } from '../config';
import SecCertificateModal from './SecCertificateModal';
import DisbursementProofModal from './DisbursementProofModal';
import { formatPhoneNumber } from '../utils/formatters';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import './NgoProfileModal.css';

const SEPOLIA_ADDR_EXPLORER = 'https://sepolia.etherscan.io/address/';

const CATEGORY_LABELS = {
  DR: 'Disaster Relief',
  CD: 'Charity Drive',
  ER: 'Emergency Response',
  CR: 'Community Recovery',
  MED: 'Medical Aid',
  FOOD: 'Food & Water Aid',
  SHELTER: 'Shelter & Evacuation',
  WATER: 'Clean Water & Sanitation',
  'FIRE AID': 'Fire Recovery',
  TYPHOON: 'Typhoon Relief'
};

function formatCategory(cat) {
  if (!cat) return 'Disaster Relief';
  const clean = String(cat).trim();
  const upper = clean.toUpperCase();
  return CATEGORY_LABELS[upper] || clean;
}

function formatUrgency(urg) {
  if (!urg) return { label: 'Active Mission', tone: 'active' };
  const upper = String(urg).toUpperCase();
  if (upper.includes('CRITICAL')) return { label: 'Critical Need', tone: 'critical' };
  if (upper.includes('HIGH') || upper.includes('URGENT') || upper.includes('EMERGENCY')) {
    return { label: 'High Priority', tone: 'urgent' };
  }
  return { label: 'Active Mission', tone: 'active' };
}

function formatCompactPhp(val) {
  const n = Number(val) || 0;
  if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`;
  return `₱${Math.round(n).toLocaleString('en-US')}`;
}

function getInitials(name) {
  const parts = String(name || 'NGO').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'NG';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function ExpandableText({ text, maxLen = 190, className = '' }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  const clean = String(text).trim();
  if (clean.length <= maxLen) {
    return <p className={className}>{clean}</p>;
  }
  return (
    <p className={className}>
      {expanded ? clean : `${clean.slice(0, maxLen).trim()}…`}{' '}
      <button
        type="button"
        className="ngp-inline-toggle"
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

// Module-level RAM cache for instant reopening with stale-while-revalidate
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
  const [activeTab, setActiveTab] = useState('operations'); // 'operations' | 'governance' | 'channels'
  const [campFilter, setCampFilter] = useState('all'); // 'all' | 'active' | 'funded' | 'disbursed'
  const [campSearch, setCampSearch] = useState('');
  const [previewCertUrl, setPreviewCertUrl] = useState(null);
  const [previewTitle, setPreviewTitle] = useState('Official Verification Document');
  const [proofCamp, setProofCamp] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);

  const handleCopy = (key, text) => {
    if (!text) return;
    navigator.clipboard?.writeText(String(text)).catch(() => {});
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

    fetch(`${API_URL}/api/public/organizations/${encodeURIComponent(idToFetch)}?_t=${Date.now()}`, { cache: 'no-store' })
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
          setError(err.message || 'Unable to load organization profile.');
        }
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    setActiveTab('operations');
    setCampFilter('all');
    setCampSearch('');
    if (orgData) {
      setProfile(orgData);
      setLoading(false);
      setError('');
    } else if (orgId) {
      fetchProfile(orgId);
    }
  }, [orgId, orgData, fetchProfile]);

  useRealtimeSync(
    ['organizations', 'campaigns', 'donations', 'disbursements'],
    () => {
      if (orgId && !orgData) fetchProfile(orgId);
    },
    { enabled: Boolean(orgId && !orgData), debounceMs: 300 }
  );

  // ESC closes sub-modals first, then main modal
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (previewCertUrl) {
        setPreviewCertUrl(null);
      } else if (proofCamp) {
        setProofCamp(null);
      } else {
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, previewCertUrl, proofCamp]);

  const orgName = useMemo(() => {
    if (profile?.name) return profile.name;
    if (profile?.Org_Name) return profile.Org_Name;
    if (orgData?.name) return orgData.name;
    if (typeof orgId === 'string' && isNaN(orgId)) return orgId;
    if (loading) return 'Loading Organization…';
    return 'Organization Profile';
  }, [profile, orgData, orgId, loading]);

  const orgEmail = profile?.email || profile?.Username || '';
  const secRegNo = profile?.secRegistrationNo || profile?.Sec_Registration_No || '';
  const dswdNo = profile?.dswdAccreditationNo || profile?.Dswd_Accreditation_No || '';
  const certUrl = profile?.secCertificateUrl || profile?.Sec_Certificate_Url || null;
  const walletAddr = profile?.walletAddress || profile?.Wallet_Address || '';
  const location = profile?.location || '';
  const bio = profile?.bio || profile?.missionStatement || profile?.preferences?.missionStatement || '';
  const website = profile?.website || profile?.preferences?.website || '';
  const socialLink = profile?.socialLink || profile?.preferences?.socialLink || '';
  const bannerUrl = profile?.banner_url || profile?.bannerUrl || profile?.banner || '';
  const avatarUrl = profile?.avatar_url || profile?.avatarUrl || profile?.avatar || '';
  const rawHotline = profile?.emergency_hotline || profile?.preferences?.emergencyHotline || profile?.mobileNumber || profile?.phone || '';
  const hotline = rawHotline ? formatPhoneNumber(rawHotline) : '';
  const hqLandmark = profile?.hqLandmark || profile?.preferences?.hqLandmark || '';

  const focusAreas = useMemo(() => {
    const raw = profile?.focusAreas || profile?.preferences?.focusAreas || '';
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter(Boolean);
    return String(raw).split(/[,•|]/).map((s) => s.trim()).filter(Boolean);
  }, [profile]);

  const verifiedDateStr = profile?.verifiedAt || profile?.verified_date
    ? new Date(profile.verifiedAt || profile.verified_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  const boardMembers = useMemo(() => {
    const raw = profile?.boardMembers || profile?.Board_Members_Json;
    if (!raw) return [];
    if (Array.isArray(raw)) {
      if (raw.length === 1 && typeof raw[0] === 'string' && raw[0].includes('|')) {
        return raw[0].split('|').map((s) => s.trim()).filter(Boolean);
      }
      return raw.map((m) => (typeof m === 'object' ? `${m.name || ''}${m.role ? ` — ${m.role}` : ''}` : String(m))).filter(Boolean);
    }
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map((m) => (typeof m === 'object' ? `${m.name || ''}${m.role ? ` — ${m.role}` : ''}` : String(m))).filter(Boolean);
        }
      } catch (_) {}
      if (raw.includes('|')) return raw.split('|').map((s) => s.trim()).filter(Boolean);
      if (raw.includes(',')) return raw.split(',').map((s) => s.trim()).filter(Boolean);
      return raw.trim() ? [raw.trim()] : [];
    }
    return [];
  }, [profile]);

  const campaigns = useMemo(() => (Array.isArray(profile?.campaigns) ? profile.campaigns : []), [profile]);

  const totalRaisedPhp = useMemo(
    () =>
      campaigns.reduce((sum, c) => {
        const php = Number(c.currentAmountPhp || 0) || Math.round((Number(c.currentAmount || 0)) * 170000);
        return sum + php;
      }, 0),
    [campaigns]
  );

  const totalDisbursedPhp = useMemo(
    () => campaigns.reduce((sum, c) => sum + (Number(c.disbursedAmountPhp || 0)), 0),
    [campaigns]
  );

  const activeCampaignCount = useMemo(
    () => campaigns.filter((c) => c.isActive !== 0 && c.isActive !== false).length,
    [campaigns]
  );

  const totalBeneficiariesCount = useMemo(
    () =>
      campaigns.reduce((sum, c) => {
        const raw = String(c.beneficiariesImpact || c.beneficiaries_impact || c.beneficiaries || '').replace(/,/g, '');
        const m = raw.match(/\d+/);
        return sum + (m ? parseInt(m[0], 10) : 0);
      }, 0),
    [campaigns]
  );

  const filteredCampaigns = useMemo(() => {
    const q = campSearch.trim().toLowerCase();
    return campaigns.filter((c) => {
      const raised = Number(c.currentAmountPhp || 0) || Math.round((Number(c.currentAmount || 0)) * 170000);
      const goal = Number(c.targetAmountPhp || 0) || Math.round((Number(c.targetAmount || 0)) * 170000);
      const pct = goal > 0 ? Math.round((raised / goal) * 100) : 0;
      const isDisbursed =
        Number(c.disbursedAmountPhp || 0) > 0 ||
        c.disbursementStatus === 'DISBURSED' ||
        c.disbursementStatus === 'PARTIALLY_DISBURSED';

      if (campFilter === 'active' && (c.isActive === 0 || c.isActive === false)) return false;
      if (campFilter === 'funded' && pct < 100) return false;
      if (campFilter === 'disbursed' && !isDisbursed) return false;

      if (!q) return true;
      return [c.title, c.description, c.locationRegion, formatCategory(c.category)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [campaigns, campFilter, campSearch]);

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

  const configuredRails = useMemo(() => {
    const list = [];
    if (gcashNo || gcashName || gcashQrUrl) {
      list.push({
        id: 'gcash',
        badge: 'GCash',
        tone: 'gcash',
        title: 'GCash Direct Relief Account',
        holder: gcashName || orgName,
        number: gcashNo,
        qrUrl: gcashQrUrl
      });
    }
    if (mayaNo || mayaName || mayaQrUrl) {
      list.push({
        id: 'maya',
        badge: 'Maya',
        tone: 'maya',
        title: 'Maya Institutional Account',
        holder: mayaName || orgName,
        number: mayaNo,
        qrUrl: mayaQrUrl
      });
    }
    if (bankAccountNumber || bankName || bankDetails || bankQrUrl) {
      list.push({
        id: 'bank',
        badge: 'Bank / InstaPay',
        tone: 'bank',
        title: bankName || 'Official Bank Transfer',
        holder: bankAccountName || orgName,
        number: bankAccountNumber || bankDetails,
        qrUrl: bankQrUrl
      });
    }
    return list;
  }, [gcashNo, gcashName, gcashQrUrl, mayaNo, mayaName, mayaQrUrl, bankName, bankAccountName, bankAccountNumber, bankDetails, bankQrUrl, orgName]);

  const hasBanner = Boolean(
    bannerUrl && (bannerUrl.startsWith('data:') || bannerUrl.startsWith('http') || bannerUrl.startsWith('/'))
  );

  const primaryActiveCampaign = useMemo(
    () => campaigns.find((c) => c.isActive !== 0 && c.isActive !== false) || campaigns[0] || null,
    [campaigns]
  );

  const handleNavigateToCampaign = (camp) => {
    if (!camp) return;
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
    if (!url) return;
    setPreviewTitle(title || 'Official Document Preview');
    setPreviewCertUrl(url);
  };

  const effectiveTheme =
    theme ||
    (typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') || 'dark' : 'dark');

  const disbursedSharePct =
    totalRaisedPhp > 0 ? Math.min(100, Math.round((totalDisbursedPhp / totalRaisedPhp) * 100)) : 0;

  return createPortal(
    <div className="ngp-backdrop" onClick={onClose} data-theme={effectiveTheme}>
      <div
        className="ngp-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={orgName}
      >
        {/* ── 1. Slim Top Utility Bar (Exact Geist V4 Parity with CampaignDetailsModal) ── */}
        <header className="ngp-topbar">
          <div className="ngp-topbar-left">
            {onOpenDirectory ? (
              <button
                type="button"
                className="ngp-crumb-btn"
                onClick={onOpenDirectory}
                title="Back to all accredited NGOs"
              >
                <span className="material-symbols-outlined">arrow_back</span>
                <span>Organizations</span>
              </button>
            ) : (
              <span className="ngp-crumb-static">Organizations</span>
            )}
            <span className="ngp-sep">/</span>
            <span className="ngp-crumb-current">{orgName}</span>

            {!loading && profile && (
              <span className="ngp-status-chip is-verified">
                <span className="ngp-dot" />
                <span>{dswdNo ? 'SEC & DSWD Accredited' : 'SEC Accredited'}</span>
              </span>
            )}
          </div>

          <div className="ngp-topbar-right">
            <span className="ngp-esc">ESC</span>
            <button
              type="button"
              className="ngp-close-btn"
              onClick={onClose}
              aria-label="Close organization profile"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </header>

        {/* ── 2. Body: Loading / Error / Editorial 2-Pane Split ── */}
        {loading && !profile ? (
          <div className="ngp-split-scroll">
            <div className="ngp-split">
              <div className="ngp-main">
                <div className="ngp-skel-banner" />
                <div className="ngp-skel-id-row">
                  <div className="ngp-skel-avatar" />
                  <div className="ngp-skel-lines">
                    <div className="ngp-skel-line w-45" />
                    <div className="ngp-skel-line w-70" />
                  </div>
                </div>
                <div className="ngp-skel-kpi-row">
                  <div className="ngp-skel-line w-80" />
                  <div className="ngp-skel-line w-80" />
                  <div className="ngp-skel-line w-80" />
                  <div className="ngp-skel-line w-80" />
                </div>
                <div className="ngp-skel-block" />
                <div className="ngp-skel-block" />
              </div>
              <aside className="ngp-rail">
                <div className="ngp-skel-block" />
                <div className="ngp-skel-block" />
              </aside>
            </div>
          </div>
        ) : error && !profile ? (
          <div className="ngp-error-state">
            <span className="material-symbols-outlined err-ico">error_outline</span>
            <h3>Organization Record Unavailable</h3>
            <p>{error}</p>
            <div className="ngp-error-actions">
              {onOpenDirectory && (
                <button type="button" className="ngp-btn-primary" onClick={onOpenDirectory}>
                  Browse Accredited NGOs
                </button>
              )}
              <button type="button" className="ngp-btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="ngp-split-scroll">
            <div className="ngp-split">

              {/* ════════ LEFT EDITORIAL PANE (Open Canvas — Zero Box Clutter) ════════ */}
              <div className="ngp-main">

                {/* Wide Banner Hero (only rendered when org has a real cover banner) */}
                {hasBanner && (
                  <div className="ngp-banner-wrap">
                    <img src={bannerUrl} alt={`${orgName} banner`} className="ngp-banner-img" />
                  </div>
                )}

                {/* Identity Block */}
                <section className="ngp-identity">
                  <div className="ngp-id-row">
                    <div className="ngp-avatar">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={orgName} />
                      ) : (
                        <span>{getInitials(orgName)}</span>
                      )}
                      <span className="ngp-avatar-check" title="Verified Non-Profit">
                        <span className="material-symbols-outlined">check</span>
                      </span>
                    </div>

                    <div className="ngp-id-meta">
                      <h2 className="ngp-title">{orgName}</h2>
                      <div className="ngp-subline">
                        <span>Chartered Non-Profit</span>
                        {verifiedDateStr && (
                          <>
                            <span className="ngp-dot-sep">·</span>
                            <span>Accredited {verifiedDateStr}</span>
                          </>
                        )}
                        {location && (
                          <>
                            <span className="ngp-dot-sep">·</span>
                            <span className="ngp-loc-inline" title={location}>{location}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {bio ? (
                    <ExpandableText text={bio} maxLen={200} className="ngp-bio" />
                  ) : (
                    <p className="ngp-bio is-muted">
                      SEC-verified Philippine humanitarian organization cleared to run transparent disaster response and community relief operations on BBDRTS.
                    </p>
                  )}

                  {focusAreas.length > 0 && (
                    <div className="ngp-tags">
                      {focusAreas.slice(0, 6).map((area, i) => (
                        <span key={i} className="ngp-tag">{area}</span>
                      ))}
                    </div>
                  )}
                </section>

                {/* Hairline 4-Column Ledger Strip (Zero Box Clutter) */}
                <section className="ngp-kpi-ledger" aria-label="Organization impact metrics">
                  <div className="ngp-kpi-item">
                    <span className="ngp-kpi-lbl">Total raised</span>
                    <strong className="ngp-kpi-val is-emerald">{formatCompactPhp(totalRaisedPhp)}</strong>
                    <span className="ngp-kpi-sub">100% escrow audited</span>
                  </div>
                  <div className="ngp-kpi-item">
                    <span className="ngp-kpi-lbl">Aid disbursed</span>
                    <strong className="ngp-kpi-val">{formatCompactPhp(totalDisbursedPhp)}</strong>
                    <span className="ngp-kpi-sub">
                      {totalDisbursedPhp > 0 ? `${disbursedSharePct}% released to field` : 'In escrow reserve'}
                    </span>
                  </div>
                  <div className="ngp-kpi-item">
                    <span className="ngp-kpi-lbl">Operations</span>
                    <strong className="ngp-kpi-val">{campaigns.length}</strong>
                    <span className="ngp-kpi-sub">{activeCampaignCount} active</span>
                  </div>
                  <div className="ngp-kpi-item">
                    <span className="ngp-kpi-lbl">Community reach</span>
                    <strong className="ngp-kpi-val">
                      {totalBeneficiariesCount > 0 ? `${totalBeneficiariesCount.toLocaleString()}+` : 'Verified'}
                    </strong>
                    <span className="ngp-kpi-sub">documented reach</span>
                  </div>
                </section>

                {/* Clean Underline Tab Navigation */}
                <nav className="ngp-tabs" role="tablist" aria-label="Organization sections">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'operations'}
                    className={`ngp-tab ${activeTab === 'operations' ? 'is-active' : ''}`}
                    onClick={() => setActiveTab('operations')}
                  >
                    <span>Operations</span>
                    <span className="ngp-tab-count">{campaigns.length}</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'governance'}
                    className={`ngp-tab ${activeTab === 'governance' ? 'is-active' : ''}`}
                    onClick={() => setActiveTab('governance')}
                  >
                    <span>Governance &amp; SEC</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'channels'}
                    className={`ngp-tab ${activeTab === 'channels' ? 'is-active' : ''}`}
                    onClick={() => setActiveTab('channels')}
                  >
                    <span>Payment Channels</span>
                    {configuredRails.length > 0 && (
                      <span className="ngp-tab-count">{configuredRails.length}</span>
                    )}
                  </button>
                </nav>

                {/* ── TAB 1: OPERATIONS ── */}
                {activeTab === 'operations' && (
                  <section className="ngp-tab-panel">
                    {campaigns.length > 2 && (
                      <div className="ngp-ops-toolbar">
                        <div className="ngp-filter-pills">
                          {[
                            { id: 'all', label: 'All' },
                            { id: 'active', label: 'Active' },
                            { id: 'funded', label: 'Funded' },
                            { id: 'disbursed', label: 'Disbursed' }
                          ].map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              className={`ngp-filter-pill ${campFilter === f.id ? 'is-active' : ''}`}
                              onClick={() => setCampFilter(f.id)}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>

                        <div className="ngp-ops-search">
                          <span className="material-symbols-outlined">search</span>
                          <input
                            type="text"
                            placeholder="Filter missions…"
                            value={campSearch}
                            onChange={(e) => setCampSearch(e.target.value)}
                          />
                          {campSearch && (
                            <button
                              type="button"
                              className="ngp-ops-search-clear"
                              onClick={() => setCampSearch('')}
                              aria-label="Clear filter"
                            >
                              <span className="material-symbols-outlined">close</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {filteredCampaigns.length === 0 ? (
                      <div className="ngp-empty-inline">
                        <span className="material-symbols-outlined">inbox</span>
                        <div>
                          <strong>
                            {campaigns.length === 0 ? 'No relief operations yet' : 'No matching operations'}
                          </strong>
                          <p>
                            {campaigns.length === 0
                              ? `${orgName} is accredited and cleared to publish verified campaigns on BBDRTS.`
                              : 'Try another filter or clear your search term.'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="ngp-ops-list">
                        {filteredCampaigns.map((camp) => {
                          const raised =
                            Number(camp.currentAmountPhp || 0) ||
                            Math.round((Number(camp.currentAmount || 0)) * 170000);
                          const goal =
                            Number(camp.targetAmountPhp || 0) ||
                            Math.round((Number(camp.targetAmount || 0)) * 170000);
                          const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
                          const urg = formatUrgency(camp.urgency);
                          const disbursedPhp = Number(camp.disbursedAmountPhp || 0);
                          const isDisbursed =
                            disbursedPhp > 0 ||
                            camp.disbursementStatus === 'DISBURSED' ||
                            camp.disbursementStatus === 'PARTIALLY_DISBURSED';

                          return (
                            <article key={camp.id} className="ngp-op-row">
                              <div className="ngp-op-top">
                                <div className="ngp-op-head-left">
                                  <span className="ngp-op-cat">{formatCategory(camp.category)}</span>
                                  <h4 className="ngp-op-title">{camp.title}</h4>
                                </div>
                                <span className={`ngp-status-chip is-${urg.tone}`}>
                                  <span className="ngp-dot" />
                                  <span>{urg.label}</span>
                                </span>
                              </div>

                              {camp.description && (
                                <p className="ngp-op-desc">{camp.description}</p>
                              )}

                              <div className="ngp-op-progress">
                                <div className="ngp-progress-track">
                                  <div className="ngp-progress-fill" style={{ width: `${Math.max(raised > 0 ? 3 : 0, pct)}%` }} />
                                </div>
                                <div className="ngp-progress-meta">
                                  <span>
                                    <strong>₱{raised.toLocaleString('en-US')}</strong> raised
                                  </span>
                                  <span className="ngp-progress-goal">
                                    Goal: ₱{goal.toLocaleString('en-US')} ({pct}%)
                                  </span>
                                </div>
                              </div>

                              <div className="ngp-op-footer">
                                <span className="ngp-op-loc" title={camp.locationRegion || 'Philippines'}>
                                  <span className="material-symbols-outlined">location_on</span>
                                  <span>{camp.locationRegion || 'Philippine Relief Zone'}</span>
                                </span>

                                <div className="ngp-op-actions">
                                  {isDisbursed && (
                                    <button
                                      type="button"
                                      className="ngp-op-proof-btn"
                                      onClick={() =>
                                        setProofCamp({
                                          ...camp,
                                          orgName
                                        })
                                      }
                                    >
                                      <span className="material-symbols-outlined">verified</span>
                                      <span>Proof (₱{disbursedPhp.toLocaleString()})</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="ngp-op-donate-btn"
                                    onClick={() => handleNavigateToCampaign(camp)}
                                  >
                                    <span>Donate</span>
                                    <span aria-hidden="true">→</span>
                                  </button>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </section>
                )}

                {/* ── TAB 2: GOVERNANCE & SEC ── */}
                {activeTab === 'governance' && (
                  <section className="ngp-tab-panel">
                    <div className="ngp-kv-section">
                      <h3 className="ngp-section-label">Regulatory Credentials</h3>
                      <dl className="ngp-kv-list">
                        <div className="ngp-kv-row">
                          <dt>SEC Registration No.</dt>
                          <dd className="mono">{secRegNo || 'Verified Non-Stock Entity'}</dd>
                        </div>
                        <div className="ngp-kv-row">
                          <dt>DSWD Accreditation</dt>
                          <dd className="mono">{dswdNo || 'Under BBDRTS Institutional Oversight'}</dd>
                        </div>
                        <div className="ngp-kv-row">
                          <dt>Accreditation Status</dt>
                          <dd className="is-emerald">
                            Approved{verifiedDateStr ? ` · ${verifiedDateStr}` : ''}
                          </dd>
                        </div>
                        {walletAddr && (
                          <div className="ngp-kv-row">
                            <dt>Audit Wallet</dt>
                            <dd className="ngp-wallet-dd">
                              <code className="mono">{walletAddr.slice(0, 10)}…{walletAddr.slice(-8)}</code>
                              <button
                                type="button"
                                className="ngp-icon-action"
                                onClick={() => handleCopy('wallet', walletAddr)}
                                title="Copy wallet address"
                              >
                                <span className="material-symbols-outlined">
                                  {copiedKey === 'wallet' ? 'check' : 'content_copy'}
                                </span>
                              </button>
                              <a
                                href={`${SEPOLIA_ADDR_EXPLORER}${walletAddr}`}
                                target="_blank"
                                rel="noreferrer"
                                className="ngp-icon-action"
                                title="Inspect on Sepolia Etherscan"
                              >
                                <span className="material-symbols-outlined">open_in_new</span>
                              </a>
                            </dd>
                          </div>
                        )}
                      </dl>

                      {certUrl && (
                        <div style={{ marginTop: '14px' }}>
                          <button
                            type="button"
                            className="ngp-btn-secondary"
                            onClick={() => handleOpenDocPreview(certUrl, `${orgName} — SEC Registration Certificate`)}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>description</span>
                            <span>Inspect Official SEC Certificate</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="ngp-kv-section">
                      <h3 className="ngp-section-label">Governing Board &amp; Officers</h3>
                      {boardMembers.length > 0 ? (
                        <ul className="ngp-board-list">
                          {boardMembers.map((member, idx) => (
                            <li key={idx} className="ngp-board-item">
                              <span className="ngp-board-idx">{String(idx + 1).padStart(2, '0')}</span>
                              <span>{member}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="ngp-empty-muted">
                          Authorized signatory verified on file with the BBDRTS Compliance Desk under Republic Act 11232.
                        </p>
                      )}
                    </div>
                  </section>
                )}

                {/* ── TAB 3: PAYMENT CHANNELS ── */}
                {activeTab === 'channels' && (
                  <section className="ngp-tab-panel">
                    {configuredRails.length === 0 ? (
                      <div className="ngp-empty-inline">
                        <span className="material-symbols-outlined">account_balance</span>
                        <div>
                          <strong>Standard Escrow Routing Active</strong>
                          <p>
                            Donations to {orgName} settle through BBDRTS verified Philippine payment channels with 0% platform commission.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="ngp-rails-list">
                        {configuredRails.map((rail) => (
                          <div key={rail.id} className="ngp-rail-row">
                            <div className="ngp-rail-info">
                              <span className={`ngp-rail-badge is-${rail.tone}`}>{rail.badge}</span>
                              <div className="ngp-rail-title">{rail.title}</div>
                              <div className="ngp-rail-meta">
                                {rail.holder && <span>Account: <strong>{rail.holder}</strong></span>}
                                {rail.number && (
                                  <span className="ngp-rail-num">
                                    <code>{rail.number}</code>
                                    <button
                                      type="button"
                                      className="ngp-icon-action"
                                      onClick={() => handleCopy(rail.id, rail.number)}
                                      title="Copy account number"
                                    >
                                      <span className="material-symbols-outlined">
                                        {copiedKey === rail.id ? 'check' : 'content_copy'}
                                      </span>
                                    </button>
                                  </span>
                                )}
                              </div>
                            </div>

                            {rail.qrUrl && (
                              <button
                                type="button"
                                className="ngp-rail-qr-btn"
                                onClick={() => handleOpenDocPreview(rail.qrUrl, `${orgName} — ${rail.badge} Verified QR`)}
                                title="Expand verified QR code"
                              >
                                <img src={rail.qrUrl} alt={`${rail.badge} QR`} />
                                <span>Expand QR</span>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}
              </div>

              {/* ════════ RIGHT STICKY RAIL (Exact Parity with CampaignDetailsModal) ════════ */}
              <aside className="ngp-rail">

                {/* Primary Actions */}
                <div className="ngp-rail-actions">
                  {primaryActiveCampaign ? (
                    <button
                      type="button"
                      className="ngp-btn-primary"
                      onClick={() => handleNavigateToCampaign(primaryActiveCampaign)}
                    >
                      <span>Donate to Active Mission</span>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="ngp-btn-primary"
                      onClick={() => setActiveTab('governance')}
                    >
                      <span>Inspect Credentials</span>
                    </button>
                  )}

                  {onOpenDirectory && (
                    <button
                      type="button"
                      className="ngp-btn-secondary"
                      onClick={onOpenDirectory}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>corporate_fare</span>
                      <span>All Accredited NGOs</span>
                    </button>
                  )}
                </div>

                {/* Accreditation Summary */}
                <div className="ngp-rail-section">
                  <h3 className="ngp-section-label">Verification &amp; Trust</h3>
                  <dl className="ngp-rail-kv">
                    <div className="ngp-rail-kv-row">
                      <dt>SEC Reg.</dt>
                      <dd className="mono">{secRegNo || 'Verified'}</dd>
                    </div>
                    {dswdNo && (
                      <div className="ngp-rail-kv-row">
                        <dt>DSWD Acc.</dt>
                        <dd className="mono">{dswdNo}</dd>
                      </div>
                    )}
                    <div className="ngp-rail-kv-row">
                      <dt>Platform Fee</dt>
                      <dd className="is-emerald">0% Commission</dd>
                    </div>
                    <div className="ngp-rail-kv-row">
                      <dt>Audit Trail</dt>
                      <dd>Sepolia EVM · Gasless</dd>
                    </div>
                  </dl>

                  {certUrl && (
                    <button
                      type="button"
                      className="ngp-rail-link-btn"
                      onClick={() => handleOpenDocPreview(certUrl, `${orgName} — SEC Certificate`)}
                    >
                      <span className="material-symbols-outlined">verified_user</span>
                      <span>View SEC Certificate</span>
                    </button>
                  )}
                </div>

                {/* Direct Dispatch & Contact */}
                <div className="ngp-rail-section">
                  <h3 className="ngp-section-label">Dispatch &amp; Contact</h3>
                  <div className="ngp-contact-list">
                    {hotline && (
                      <div className="ngp-contact-row">
                        <span className="material-symbols-outlined ngp-contact-ico">call</span>
                        <div className="ngp-contact-text">
                          <span className="lbl">24/7 Operations Hotline</span>
                          <a href={`tel:${rawHotline}`} className="val mono">{hotline}</a>
                        </div>
                        <button
                          type="button"
                          className="ngp-icon-action"
                          onClick={() => handleCopy('hotline', rawHotline)}
                          title="Copy hotline"
                        >
                          <span className="material-symbols-outlined">
                            {copiedKey === 'hotline' ? 'check' : 'content_copy'}
                          </span>
                        </button>
                      </div>
                    )}

                    {orgEmail && (
                      <div className="ngp-contact-row">
                        <span className="material-symbols-outlined ngp-contact-ico">mail</span>
                        <div className="ngp-contact-text">
                          <span className="lbl">Official Email</span>
                          <a href={`mailto:${orgEmail}`} className="val">{orgEmail}</a>
                        </div>
                        <button
                          type="button"
                          className="ngp-icon-action"
                          onClick={() => handleCopy('email', orgEmail)}
                          title="Copy email"
                        >
                          <span className="material-symbols-outlined">
                            {copiedKey === 'email' ? 'check' : 'content_copy'}
                          </span>
                        </button>
                      </div>
                    )}

                    {(location || hqLandmark) && (
                      <div className="ngp-contact-row">
                        <span className="material-symbols-outlined ngp-contact-ico">location_on</span>
                        <div className="ngp-contact-text">
                          <span className="lbl">Headquarters</span>
                          <span className="val">{location || hqLandmark}</span>
                        </div>
                      </div>
                    )}

                    {website && (
                      <div className="ngp-contact-row">
                        <span className="material-symbols-outlined ngp-contact-ico">language</span>
                        <div className="ngp-contact-text">
                          <span className="lbl">Official Portal</span>
                          <a
                            href={/^https?:\/\//i.test(website) ? website : `https://${website}`}
                            target="_blank"
                            rel="noreferrer"
                            className="val is-link"
                          >
                            {website.replace(/^https?:\/\//i, '')} ↗
                          </a>
                        </div>
                      </div>
                    )}

                    {socialLink && (
                      <div className="ngp-contact-row">
                        <span className="material-symbols-outlined ngp-contact-ico">public</span>
                        <div className="ngp-contact-text">
                          <span className="lbl">Community Page</span>
                          <a
                            href={/^https?:\/\//i.test(socialLink) ? socialLink : `https://${socialLink}`}
                            target="_blank"
                            rel="noreferrer"
                            className="val is-link"
                          >
                            Official Social Updates ↗
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Compliance Footnote */}
                <div className="ngp-rail-footnote">
                  <span className="material-symbols-outlined">shield</span>
                  <span>
                    Verified under Republic Act 11232 (SEC). Every PHP donation and field disbursement is cryptographically notarized.
                  </span>
                </div>
              </aside>
            </div>
          </div>
        )}

        {/* Sub-modals: SEC / QR Document Lightbox & Verified Disbursement Proof Viewer */}
        {previewCertUrl && (
          <SecCertificateModal
            isOpen={Boolean(previewCertUrl)}
            onClose={() => setPreviewCertUrl(null)}
            documentUrl={previewCertUrl}
            title={previewTitle}
            orgName={orgName}
            secRegNo={secRegNo}
          />
        )}

        {proofCamp && (
          <DisbursementProofModal
            camp={proofCamp}
            isOpen={Boolean(proofCamp)}
            onClose={() => setProofCamp(null)}
            theme={effectiveTheme}
          />
        )}
      </div>
    </div>,
    document.body
  );
}
