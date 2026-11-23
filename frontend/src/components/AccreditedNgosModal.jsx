import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { API_URL } from '../config';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import './AccreditedNgosModal.css';

// Module-level RAM cache for instant reopening with stale-while-revalidate
let cachedDirectory = null;

function getInitials(name) {
  const parts = String(name || 'NGO').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'NG';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatCompactPhp(val) {
  const n = Number(val) || 0;
  if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`;
  return `₱${Math.round(n).toLocaleString()}`;
}

export default function AccreditedNgosModal({ isOpen, onClose, onSelectNgo, theme }) {
  const [ngos, setNgos] = useState(() => (Array.isArray(cachedDirectory) ? cachedDirectory : []));
  const [loading, setLoading] = useState(() => !Array.isArray(cachedDirectory));
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('raised'); // 'raised' | 'campaigns' | 'name'

  const fetchOrganizations = useCallback(async ({ silent = false } = {}) => {
    if (!silent && !Array.isArray(cachedDirectory)) {
      setLoading(true);
    }
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/public/organizations?_t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load accredited NGO registry.');
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      cachedDirectory = list;
      setNgos(list);
    } catch (err) {
      if (!Array.isArray(cachedDirectory)) {
        setError(err.message || 'Unable to load verified organizations.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    fetchOrganizations({ silent: Array.isArray(cachedDirectory) });
  }, [isOpen, fetchOrganizations]);

  useRealtimeSync(
    ['organizations', 'campaigns', 'donations', 'disbursements'],
    () => {
      if (isOpen) fetchOrganizations({ silent: true });
    },
    { enabled: Boolean(isOpen), debounceMs: 300 }
  );

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const filteredNgos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = ngos.filter((org) => {
      if (!q) return true;
      const haystack = [
        org.name,
        org.location,
        org.secRegistrationNo,
        org.dswdAccreditationNo,
        org.bio,
        org.email
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });

    const getRaisedPhp = (o) =>
      o.totalRaisedPhp !== undefined && o.totalRaisedPhp !== null
        ? Number(o.totalRaisedPhp) || 0
        : Math.round((Number(o.totalRaisedEth) || 0) * 170000);

    return [...list].sort((a, b) => {
      if (sortBy === 'campaigns') {
        return (Number(b.campaignCount) || 0) - (Number(a.campaignCount) || 0) || getRaisedPhp(b) - getRaisedPhp(a);
      }
      if (sortBy === 'name') {
        return String(a.name || '').localeCompare(String(b.name || ''));
      }
      return getRaisedPhp(b) - getRaisedPhp(a) || (Number(b.campaignCount) || 0) - (Number(a.campaignCount) || 0);
    });
  }, [ngos, searchQuery, sortBy]);

  if (!isOpen) return null;

  const currentTheme =
    theme ||
    (typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') : 'dark') ||
    'dark';

  const totalCampaignsAcrossNgos = ngos.reduce((sum, o) => sum + (Number(o.campaignCount) || 0), 0);
  const totalRaisedAcrossNgos = ngos.reduce((sum, o) => {
    const php =
      o.totalRaisedPhp !== undefined && o.totalRaisedPhp !== null
        ? Number(o.totalRaisedPhp) || 0
        : Math.round((Number(o.totalRaisedEth) || 0) * 170000);
    return sum + php;
  }, 0);

  return createPortal(
    <div
      className="bbdrts-ngo-dir-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Accredited Humanitarian NGOs"
      data-theme={currentTheme}
    >
      <div className="bbdrts-ngo-dir-modal" onClick={(e) => e.stopPropagation()} data-theme={currentTheme}>
        {/* Header */}
        <div className="bbdrts-ngo-dir-header">
          <div className="bbdrts-ngo-dir-title-wrap">
            <div className="bbdrts-ngo-dir-icon">
              <span className="material-symbols-outlined">verified_user</span>
            </div>
            <div>
              <div className="bbdrts-ngo-dir-eyebrow">
                <span>SEC &amp; DSWD ACCREDITED REGISTRY</span>
                <span className="bbdrts-ngo-dir-count-pill">
                  <span className="dot" />
                  {ngos.length} Verified
                </span>
              </div>
              <h2 className="bbdrts-ngo-dir-title">Accredited Humanitarian NGOs</h2>
              <p className="bbdrts-ngo-dir-subtitle">
                Select any verified organization to inspect its SEC credentials, live relief campaigns, disbursement proofs, and verified payout channels.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="bbdrts-ngo-dir-close"
            onClick={onClose}
            aria-label="Close directory"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Summary Strip + Search & Sort Controls */}
        <div className="bbdrts-ngo-dir-toolbar">
          <div className="bbdrts-ngo-dir-search-wrap">
            <span className="material-symbols-outlined search-ico">search</span>
            <input
              type="text"
              placeholder="Search NGO name, location, or SEC registration..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            )}
          </div>

          <div className="bbdrts-ngo-dir-sort-group" role="tablist" aria-label="Sort accredited NGOs">
            <button
              type="button"
              className={`sort-chip ${sortBy === 'raised' ? 'active' : ''}`}
              onClick={() => setSortBy('raised')}
            >
              Most Raised
            </button>
            <button
              type="button"
              className={`sort-chip ${sortBy === 'campaigns' ? 'active' : ''}`}
              onClick={() => setSortBy('campaigns')}
            >
              Most Campaigns
            </button>
            <button
              type="button"
              className={`sort-chip ${sortBy === 'name' ? 'active' : ''}`}
              onClick={() => setSortBy('name')}
            >
              A–Z
            </button>
          </div>
        </div>

        {/* Directory Body */}
        <div className="bbdrts-ngo-dir-body">
          {loading ? (
            <div className="bbdrts-ngo-dir-grid">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="bbdrts-ngo-dir-card is-skeleton">
                  <div className="skel-row">
                    <div className="skel-avatar" />
                    <div className="skel-lines">
                      <div className="skel-line w-60" />
                      <div className="skel-line w-40" />
                    </div>
                  </div>
                  <div className="skel-line w-90" />
                  <div className="skel-line w-75" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="bbdrts-ngo-dir-empty">
              <span className="material-symbols-outlined empty-ico">cloud_off</span>
              <h3>Could Not Load Accredited NGOs</h3>
              <p>{error}</p>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => fetchOrganizations({ silent: false })}
              >
                Retry
              </button>
            </div>
          ) : filteredNgos.length === 0 ? (
            <div className="bbdrts-ngo-dir-empty">
              <span className="material-symbols-outlined empty-ico">search_off</span>
              <h3>No Matching Organizations</h3>
              <p>
                {searchQuery
                  ? `No verified NGO matched "${searchQuery}". Try another keyword or clear the search filter.`
                  : 'No accredited organizations are currently listed.'}
              </p>
              {searchQuery && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setSearchQuery('')}
                >
                  Clear Search
                </button>
              )}
            </div>
          ) : (
            <div className="bbdrts-ngo-dir-grid">
              {filteredNgos.map((org) => {
                const raisedPhp =
                  org.totalRaisedPhp !== undefined && org.totalRaisedPhp !== null
                    ? Number(org.totalRaisedPhp) || 0
                    : Math.round((Number(org.totalRaisedEth) || 0) * 170000);
                const disbursedPhp = Number(org.totalDisbursedPhp || 0);
                const campaignCount = Number(org.campaignCount || 0);
                const verifiedYear = org.verifiedAt
                  ? new Date(org.verifiedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                  : null;

                return (
                  <button
                    key={org.id}
                    type="button"
                    className="bbdrts-ngo-dir-card"
                    onClick={() => onSelectNgo && onSelectNgo(org.id)}
                  >
                    <div className="ngo-card-top">
                      <div className="ngo-card-avatar">
                        {org.avatar_url ? (
                          <img src={org.avatar_url} alt={org.name} loading="lazy" />
                        ) : (
                          <span>{getInitials(org.name)}</span>
                        )}
                        <span className="ngo-verified-dot" title="SEC Verified NGO">
                          <span className="material-symbols-outlined">check</span>
                        </span>
                      </div>

                      <div className="ngo-card-head-meta">
                        <div className="ngo-card-name-row">
                          <h3 className="ngo-card-name" title={org.name}>{org.name}</h3>
                        </div>
                        <div className="ngo-card-badges">
                          <span className="ngo-pill verified">
                            <span className="material-symbols-outlined">verified</span>
                            <span>SEC Accredited</span>
                          </span>
                          {org.secRegistrationNo && (
                            <span className="ngo-pill mono" title={`SEC Registration: ${org.secRegistrationNo}`}>
                              {org.secRegistrationNo}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <p className="ngo-card-bio">
                      {org.bio && org.bio.trim()
                        ? org.bio.trim()
                        : 'Verified Philippine humanitarian partner accredited under Republic Act 11232 for transparent disaster response and community relief.'}
                    </p>

                    {(org.location || verifiedYear) && (
                      <div className="ngo-card-meta-line">
                        {org.location && (
                          <span className="meta-chip" title={org.location}>
                            <span className="material-symbols-outlined">location_on</span>
                            <span className="truncate">{org.location}</span>
                          </span>
                        )}
                        {verifiedYear && (
                          <span className="meta-chip">
                            <span className="material-symbols-outlined">calendar_today</span>
                            <span>Verified {verifiedYear}</span>
                          </span>
                        )}
                      </div>
                    )}

                    <div className="ngo-card-stats">
                      <div className="ngo-stat">
                        <span className="lbl">Campaigns</span>
                        <strong className="val">{campaignCount}</strong>
                      </div>
                      <div className="ngo-stat">
                        <span className="lbl">Raised</span>
                        <strong className="val emerald">{formatCompactPhp(raisedPhp)}</strong>
                      </div>
                      <div className="ngo-stat">
                        <span className="lbl">Disbursed</span>
                        <strong className="val">{formatCompactPhp(disbursedPhp)}</strong>
                      </div>
                      <span className="ngo-card-open-cta">
                        <span>View Profile</span>
                        <span className="material-symbols-outlined">arrow_forward</span>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bbdrts-ngo-dir-footer">
          <div className="footer-meta">
            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#10b981' }}>shield</span>
            <span>
              {ngos.length} Verified Partner{ngos.length === 1 ? '' : 's'} · {totalCampaignsAcrossNgos} Relief Campaigns · {formatCompactPhp(totalRaisedAcrossNgos)} Audited
            </span>
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
