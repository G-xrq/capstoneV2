import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { API_URL } from '../config';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import './DisbursementProofModal.css';

const SEPOLIA_EXPLORER = 'https://sepolia.etherscan.io/tx/';

const CATEGORY_MAP = {
  OFFICIAL_RECEIPT: { label: 'Merchant Receipt', icon: 'receipt_long' },
  GROUND_PHOTO: { label: 'Handover Photo', icon: 'photo_camera' },
  LGU_CERTIFICATE: { label: 'LGU Turnover Cert', icon: 'verified_user' },
  BENEFICIARY_ROSTER: { label: 'Recipient Masterlist', icon: 'assignment_turned_in' },
  LOGISTICS_WAYBILL: { label: 'Logistics Waybill', icon: 'local_shipping' }
};

const AID_CATEGORY_MAP = {
  FOOD_WATER: { label: 'Food & Potable Water', icon: 'rice_bowl' },
  MEDICAL: { label: 'Medical & First Aid', icon: 'medical_services' },
  SHELTER: { label: 'Shelter & Tarpaulins', icon: 'roofing' },
  LOGISTICS: { label: 'Logistics & Transport', icon: 'local_shipping' },
  HYGIENE_CASH: { label: 'Hygiene & Community Aid', icon: 'volunteer_activism' }
};

function parseProofData(raw) {
  const empty = {
    proofs: [],
    expenseBreakdown: [],
    location: '',
    lguPartner: '',
    aidCategory: '',
    allocationMode: '',
    proofDigest: '',
    onChain: undefined,
    blockNumber: null,
    explorerUrl: ''
  };
  if (!raw) return empty;
  if (typeof raw === 'object') {
    return { ...empty, ...raw };
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return { ...empty, proofs: parsed };
    }
    return {
      ...empty,
      proofs: parsed.proofs || (parsed.primaryUrl ? [{ id: 1, url: parsed.primaryUrl, caption: 'Ground Distribution Proof', category: 'OFFICIAL_RECEIPT' }] : []),
      expenseBreakdown: parsed.expenseBreakdown || [],
      location: parsed.location || '',
      lguPartner: parsed.lguPartner || '',
      aidCategory: parsed.aidCategory || '',
      allocationMode: parsed.allocationMode || '',
      proofDigest: parsed.proofDigest || '',
      onChain: typeof parsed.onChain === 'boolean' ? parsed.onChain : undefined,
      blockNumber: parsed.blockNumber || null,
      explorerUrl: parsed.explorerUrl || ''
    };
  } catch (_) {
    return {
      ...empty,
      proofs: [{ id: 1, url: raw, caption: 'Ground Distribution Proof', category: 'OFFICIAL_RECEIPT' }]
    };
  }
}

function normalizeProofSrc(rawUrl) {
  const url = String(rawUrl || '').trim();
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:') || url.startsWith('/api/')) {
    return url;
  }
  if (url.startsWith('/9j/')) return `data:image/jpeg;base64,${url}`;
  if (url.startsWith('iVBORw0')) return `data:image/png;base64,${url}`;
  if (url.startsWith('R0lGOD')) return `data:image/gif;base64,${url}`;
  if (url.startsWith('UklGR')) return `data:image/webp;base64,${url}`;
  return url;
}

function classifyProofFile(proof) {
  const url = String(proof?.url || '').trim();
  const mime = String(proof?.mimeType || proof?.type || '').toLowerCase();
  const name = String(proof?.name || proof?.caption || '').toLowerCase();

  if (
    mime.startsWith('image/') ||
    url.startsWith('data:image/') ||
    url.startsWith('/9j/') ||
    url.startsWith('iVBORw0') ||
    url.startsWith('R0lGOD') ||
    url.startsWith('UklGR') ||
    /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(name) ||
    (/\.(png|jpe?g|webp|gif|bmp|avif)(\?|$)/i.test(url))
  ) {
    return 'image';
  }
  if (mime === 'application/pdf' || url.startsWith('data:application/pdf') || /\.pdf$/i.test(name) || /\.pdf(\?|$)/i.test(url)) {
    return 'pdf';
  }
  if (
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    mime === 'text/csv' ||
    url.includes('spreadsheet') ||
    url.includes('excel') ||
    url.startsWith('data:text/csv') ||
    /\.(xlsx|xls|csv)$/i.test(name)
  ) {
    return 'spreadsheet';
  }
  // Ground photos & receipts without explicit extension default to image preview if URL looks like a hosted media/proof asset
  if (proof?.category === 'GROUND_PHOTO' && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:'))) {
    return 'image';
  }
  return 'document';
}

function formatBatchDateTime(rawDate) {
  if (!rawDate) return { date: 'Verified Delivery', time: '' };
  const d = new Date(rawDate);
  if (Number.isNaN(d.getTime())) return { date: 'Verified Delivery', time: '' };
  return {
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  };
}

function formatShortDate(rawDate) {
  if (!rawDate) return 'Verified';
  const d = new Date(rawDate);
  if (Number.isNaN(d.getTime())) return 'Verified';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function DisbursementProofModal({ camp, isOpen, onClose, theme }) {
  const [disbursements, setDisbursements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePreview, setActivePreview] = useState(null); // { items: [], index: number }
  const [zoomed, setZoomed] = useState(false);
  const [campaignDetails, setCampaignDetails] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  const [selectedBatchIdx, setSelectedBatchIdx] = useState(0);

  const campId = camp?.id || camp?.Campaign_ID || camp?.campaignId;

  const handleCopyValue = (key, text) => {
    if (!text) return;
    navigator.clipboard?.writeText(String(text)).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1800);
  };

  // Reset selected batch & preview ONLY when the modal opens for a campaign (NOT when activePreview toggles!)
  useEffect(() => {
    if (isOpen) {
      setSelectedBatchIdx(0);
      setActivePreview(null);
      setZoomed(false);
    }
  }, [isOpen, campId]);

  // Keyboard navigation (Escape closes lightbox first, then modal; ArrowLeft/ArrowRight cycle gallery images)
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (activePreview) {
          setActivePreview(null);
          setZoomed(false);
        } else {
          onClose?.();
        }
      } else if (activePreview && activePreview.items.length > 1) {
        if (e.key === 'ArrowRight') {
          setZoomed(false);
          setActivePreview((prev) => prev ? { ...prev, index: (prev.index + 1) % prev.items.length } : null);
        } else if (e.key === 'ArrowLeft') {
          setZoomed(false);
          setActivePreview((prev) => prev ? { ...prev, index: (prev.index - 1 + prev.items.length) % prev.items.length } : null);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, activePreview, onClose]);

  useEffect(() => {
    if (!isOpen || !campId) return;

    let isMounted = true;
    const fetchDisbursementsAndDetails = async () => {
      setLoading(true);
      try {
        const needsCampDetails =
          (!camp?.title && !camp?.Campaign_Title) ||
          (!camp?.orgName && !camp?.Org_Name);
        const fetchPromises = [fetch(`${API_URL}/api/campaigns/${campId}/disbursements`)];
        if (needsCampDetails) {
          fetchPromises.push(fetch(`${API_URL}/api/campaigns/${campId}`));
        }

        const [disbRes, campRes] = await Promise.all(fetchPromises);

        if (isMounted && disbRes && disbRes.ok) {
          const data = await disbRes.json();
          setDisbursements(Array.isArray(data) ? data : []);
        } else if (isMounted) {
          setDisbursements([]);
        }

        if (isMounted && campRes && campRes.ok) {
          const cData = await campRes.json();
          setCampaignDetails(cData);
        }
      } catch (err) {
        console.error('Failed to fetch disbursements:', err);
        if (isMounted) setDisbursements([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDisbursementsAndDetails();
    return () => { isMounted = false; };
  }, [isOpen, campId]);

  useRealtimeSync(
    ['disbursements', 'campaigns'],
    async () => {
      if (!isOpen || !campId) return;
      try {
        const res = await fetch(`${API_URL}/api/campaigns/${campId}/disbursements?_t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setDisbursements(Array.isArray(data) ? data : []);
        }
      } catch (_) {}
    },
    { enabled: Boolean(isOpen && campId), debounceMs: 250 }
  );

  // Clamp selectedBatchIdx cleanly if disbursements array shrinks
  const safeBatchIdx = disbursements.length > 0 ? Math.min(selectedBatchIdx, disbursements.length - 1) : 0;

  const parsedBatches = useMemo(() => {
    return disbursements.map((d, idx) => ({
      d,
      idx,
      batchNumber: disbursements.length - idx,
      proofData: parseProofData(d.proofUrl)
    }));
  }, [disbursements]);

  if (!isOpen || !camp) return null;

  const displayTitle =
    campaignDetails?.title ||
    campaignDetails?.Campaign_Title ||
    camp.title ||
    camp.Campaign_Title ||
    'Relief Operation';
  const displayOrg =
    camp.orgName ||
    camp.Org_Name ||
    campaignDetails?.orgName ||
    campaignDetails?.Org_Name ||
    disbursements[0]?.orgName ||
    'Accredited Relief Org';

  const totalDisbursedPhp = disbursements.reduce((sum, d) => sum + parseFloat(d.amountPhp || 0), 0);
  const totalBeneficiaries = disbursements.reduce((sum, d) => sum + (parseInt(d.beneficiariesReached, 10) || 0), 0);
  const totalProofFiles = parsedBatches.reduce((sum, b) => sum + (b.proofData.proofs?.length || 0), 0);

  const activeBatch = parsedBatches[safeBatchIdx] || null;
  const currentTheme = theme || (typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') : 'dark') || 'dark';
  const currentPreviewItem = activePreview ? activePreview.items[activePreview.index] : null;

  return createPortal(
    <>
      <div className="bbdrts-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" data-theme={currentTheme}>
        <div
          className={`bbdrts-proof-modal ${parsedBatches.length > 1 ? 'has-rail' : ''}`}
          onClick={(e) => e.stopPropagation()}
          data-theme={currentTheme}
        >
          {/* Compact Executive Header + Inline Summary Metrics */}
          <div className="bbdrts-proof-header">
            <div className="bbdrts-proof-title-cluster">
              <div className="bbdrts-proof-icon-wrap" aria-hidden="true">
                <span className="material-symbols-outlined">verified</span>
              </div>
              <div className="bbdrts-proof-title-copy">
                <div className="bbdrts-proof-eyebrow-row">
                  <span className="bbdrts-proof-tag">Audited Relief Delivery Proofs</span>
                  <span className="bbdrts-proof-sep">·</span>
                  <span className="bbdrts-proof-org-inline" title={displayOrg}>{displayOrg}</span>
                  {totalProofFiles > 0 && (
                    <span className="bbdrts-proof-count-chip">
                      {totalProofFiles} {totalProofFiles === 1 ? 'File' : 'Files'}
                    </span>
                  )}
                </div>
                <h2 className="bbdrts-proof-title" title={displayTitle}>{displayTitle}</h2>
              </div>
            </div>

            <div className="bbdrts-proof-header-right">
              {!loading && disbursements.length > 0 && (
                <div className="bbdrts-header-kpis">
                  <div className="bbdrts-hkpi">
                    <span className="hkpi-lbl">Total Disbursed</span>
                    <strong className="hkpi-val is-emerald">₱{totalDisbursedPhp.toLocaleString('en-US')}</strong>
                  </div>
                  <div className="bbdrts-hkpi">
                    <span className="hkpi-lbl">Reached</span>
                    <strong className="hkpi-val">
                      {totalBeneficiaries > 0 ? `${totalBeneficiaries.toLocaleString('en-US')}` : 'Community'}
                    </strong>
                  </div>
                  <div className="bbdrts-hkpi">
                    <span className="hkpi-lbl">Batches</span>
                    <strong className="hkpi-val">{disbursements.length}</strong>
                  </div>
                </div>
              )}

              <button type="button" className="bbdrts-proof-close-btn" onClick={onClose} aria-label="Close modal" title="Close (Esc)">
                <span className="material-symbols-outlined" style={{ fontSize: '19px' }}>close</span>
              </button>
            </div>
          </div>

          {/* Main Workspace: Master-Detail Split when 2+ batches, clean single pane when 1 */}
          <div className={`bbdrts-proof-workspace ${parsedBatches.length > 1 ? 'is-split' : ''}`}>
            {loading ? (
              <div className="bbdrts-proof-loading">
                <div className="spinner-border text-primary" role="status" style={{ width: '1.7rem', height: '1.7rem' }} />
                <span>Fetching live cryptographic distribution records…</span>
              </div>
            ) : disbursements.length === 0 ? (
              <div className="bbdrts-proof-empty">
                <div className="empty-icon-wrap">
                  <span className="material-symbols-outlined empty-icon">pending_actions</span>
                </div>
                <h3>No Disbursements Recorded Yet</h3>
                <p>
                  The NGO is currently procuring supplies and mobilizing logistics for this operation. Audited receipts and distribution photos will appear here automatically once aid is released.
                </p>
              </div>
            ) : (
              <>
                {/* Left Batch Navigator Rail (only shown when 2+ batches exist) */}
                {parsedBatches.length > 1 && (
                  <aside className="bbdrts-batch-rail" aria-label="Disbursement batches">
                    <div className="bbdrts-batch-rail-head">
                      <span>Disbursement Batches</span>
                      <span className="rail-count">{parsedBatches.length}</span>
                    </div>
                    <div className="bbdrts-batch-rail-list" role="tablist" aria-orientation="vertical">
                      {parsedBatches.map(({ d, idx, batchNumber, proofData }) => {
                        const isSelected = safeBatchIdx === idx;
                        const aidCat = proofData.aidCategory ? AID_CATEGORY_MAP[proofData.aidCategory] : null;
                        const isLiveOnChain = proofData.onChain === true || Boolean(proofData.explorerUrl);
                        const fileCount = proofData.proofs?.length || 0;
                        return (
                          <button
                            key={d.id || idx}
                            type="button"
                            role="tab"
                            aria-selected={isSelected}
                            className={`bbdrts-rail-item ${isSelected ? 'is-active' : ''}`}
                            onClick={() => setSelectedBatchIdx(idx)}
                          >
                            <div className="rail-item-top">
                              <span className="rail-batch-name">
                                {isLiveOnChain && <span className="rail-chain-dot" title="Verified On-Chain" />}
                                <span>Batch #{batchNumber}</span>
                              </span>
                              <span className="rail-batch-date">{formatShortDate(d.disbursedAt)}</span>
                            </div>
                            <div className="rail-item-amt">
                              ₱{parseFloat(d.amountPhp || 0).toLocaleString('en-US')}
                            </div>
                            <div className="rail-item-meta">
                              <span className="rail-meta-cat">{aidCat ? aidCat.label : (proofData.location || 'Relief Release')}</span>
                              <span className="rail-meta-files">{fileCount} {fileCount === 1 ? 'file' : 'files'}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </aside>
                )}

                {/* Right Focused Batch Detail View */}
                {activeBatch && (() => {
                  const { d, idx, batchNumber, proofData } = activeBatch;
                  const proofsList = proofData.proofs || [];
                  const expensesList = proofData.expenseBreakdown || [];
                  const aidCat = proofData.aidCategory ? AID_CATEGORY_MAP[proofData.aidCategory] : null;
                  const isLiveOnChain = proofData.onChain === true || Boolean(proofData.explorerUrl);
                  const explorerHref =
                    proofData.explorerUrl ||
                    (d.txHash && String(d.txHash).startsWith('0x') && proofData.onChain !== false
                      ? `${SEPOLIA_EXPLORER}${d.txHash}`
                      : '');
                  const dtParts = formatBatchDateTime(d.disbursedAt);

                  const metricCells = [
                    {
                      label: 'Amount Released',
                      value: `₱${parseFloat(d.amountPhp || 0).toLocaleString('en-US')}`,
                      accent: 'emerald',
                      mono: true
                    },
                    ...(d.beneficiariesReached > 0
                      ? [{
                          label: 'Recipients',
                          value: `${Number(d.beneficiariesReached).toLocaleString('en-US')} Families`
                        }]
                      : []),
                    ...(proofData.location
                      ? [{
                          label: 'Distribution Site',
                          value: proofData.location
                        }]
                      : []),
                    ...(proofData.lguPartner
                      ? [{
                          label: 'LGU / Partner',
                          value: proofData.lguPartner
                        }]
                      : [])
                  ];

                  // Build previewable gallery list so Lightbox supports Prev/Next cycling
                  const previewableItems = proofsList
                    .map((proof, pIdx) => {
                      const cat = CATEGORY_MAP[proof.category] || CATEGORY_MAP.OFFICIAL_RECEIPT;
                      const fileKind = classifyProofFile(proof);
                      const resolvedUrl = normalizeProofSrc(proof.url);
                      const hostedUrl = d.id ? `${API_URL}/api/disbursements/${d.id}/proof/${pIdx}` : resolvedUrl;
                      const downloadHref = d.id ? `${hostedUrl}?download=1` : resolvedUrl;
                      const safeDownloadName = proof.name || `relief-proof-${d.id || idx}-${pIdx + 1}`;
                      return {
                        pIdx,
                        proof,
                        cat,
                        fileKind,
                        url: resolvedUrl || hostedUrl,
                        hostedUrl,
                        downloadHref,
                        fileName: safeDownloadName,
                        title: proof.caption || proof.name || 'Verifiable Document',
                        category: cat.label
                      };
                    });

                  const lightboxItems = previewableItems.filter((item) => item.fileKind === 'image' || item.fileKind === 'pdf');

                  return (
                    <div className="bbdrts-proof-detail" key={d.id || idx}>
                      {/* Focused Batch Header */}
                      <div className="proof-detail-head">
                        <div className="proof-card-header-left">
                          <span className="batch-pill">
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check_circle</span>
                            <span>Disbursement #{batchNumber}</span>
                          </span>
                          {aidCat && (
                            <span className="proof-aid-cat-pill">
                              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>{aidCat.icon}</span>
                              <span>{aidCat.label}</span>
                            </span>
                          )}
                          {isLiveOnChain && (
                            <span className="proof-chain-badge is-live">
                              <span className="chain-dot" />
                              <span>On-Chain</span>
                            </span>
                          )}
                        </div>
                        <span className="timestamp">
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>schedule</span>
                          <span>
                            {dtParts.date}
                            {dtParts.time && (
                              <>
                                <span className="proof-pipe-sep" aria-hidden="true">|</span>
                                {dtParts.time}
                              </>
                            )}
                          </span>
                        </span>
                      </div>

                      {/* Hairline Metrics Bar */}
                      <div
                        className="proof-card-metrics"
                        style={{ gridTemplateColumns: `repeat(${Math.min(4, Math.max(1, metricCells.length))}, minmax(0, 1fr))` }}
                      >
                        {metricCells.map((cell, cIdx) => (
                          <div key={cIdx} className="metric-item">
                            <span className="metric-label">{cell.label}</span>
                            <strong className={`metric-val ${cell.accent || ''} ${cell.mono ? 'is-mono' : ''}`} title={cell.value}>
                              {cell.value}
                            </strong>
                          </div>
                        ))}
                      </div>

                      {/* Summary Narrative */}
                      {d.impactSummary && (
                        <div className="proof-narrative-box">
                          <div className="narrative-label">
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>description</span>
                            <span>Relief Distribution Summary</span>
                          </div>
                          <p className="narrative-text">{d.impactSummary}</p>
                        </div>
                      )}

                      {/* Itemized Expense Breakdown */}
                      {expensesList.length > 0 && (
                        <div className="proof-expenses-box">
                          <div className="narrative-label">
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>receipt_long</span>
                            <span>Itemized Procurement Breakdown ({expensesList.length})</span>
                          </div>
                          <div className="proof-expense-table-wrap">
                            <table className="proof-expense-table">
                              <thead>
                                <tr>
                                  <th>Item / Relief Good</th>
                                  <th>Quantity</th>
                                  <th style={{ textAlign: 'right' }}>Cost (PHP)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {expensesList.map((exp, eIdx) => (
                                  <tr key={eIdx}>
                                    <td>{exp.description || 'Relief Supplies'}</td>
                                    <td>{exp.quantity || '—'}</td>
                                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                                      ₱{parseFloat(exp.costPhp || 0).toLocaleString('en-US')}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Evidentiary Gallery */}
                      {previewableItems.length > 0 && (
                        <div className="proof-attachment-box">
                          <div className="narrative-label-row">
                            <div className="narrative-label">
                              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>collections</span>
                              <span>Verified Evidence &amp; Photos ({previewableItems.length})</span>
                            </div>
                            <span className="proof-privacy-note">
                              <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>shield_person</span>
                              <span>RA 10173 Privacy-Protected</span>
                            </span>
                          </div>

                          <div className={`proof-gallery-grid ${previewableItems.length === 1 ? 'is-single' : ''}`}>
                            {previewableItems.map((item) => {
                              const handleCardClick = () => {
                                if (item.fileKind === 'spreadsheet' || item.fileKind === 'document') {
                                  window.open(item.downloadHref, '_blank', 'noopener,noreferrer');
                                  return;
                                }
                                const lbIdx = lightboxItems.findIndex((x) => x.pIdx === item.pIdx);
                                setZoomed(false);
                                setActivePreview({
                                  items: lightboxItems,
                                  index: lbIdx >= 0 ? lbIdx : 0
                                });
                              };

                              return (
                                <div
                                  key={item.proof.id || item.pIdx}
                                  className="proof-gallery-card"
                                  role="button"
                                  tabIndex={0}
                                  onClick={handleCardClick}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      handleCardClick();
                                    }
                                  }}
                                >
                                  {item.fileKind === 'image' ? (
                                    <div className="proof-gallery-img-wrap">
                                      <img
                                        src={item.url}
                                        alt={item.title}
                                        loading="lazy"
                                        onError={(e) => {
                                          if (item.hostedUrl && e.currentTarget.src !== item.hostedUrl) {
                                            e.currentTarget.src = item.hostedUrl;
                                          }
                                        }}
                                      />
                                      <div className="proof-gallery-overlay">
                                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>zoom_in</span>
                                        <span>Inspect Full Photo</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className={`proof-gallery-doc-wrap is-${item.fileKind}`}>
                                      <span className="material-symbols-outlined doc-icon">
                                        {item.fileKind === 'pdf'
                                          ? 'picture_as_pdf'
                                          : item.fileKind === 'spreadsheet'
                                            ? 'table_view'
                                            : 'description'}
                                      </span>
                                      <span className="doc-kind-pill">
                                        {item.fileKind === 'pdf'
                                          ? 'PDF DOCUMENT'
                                          : item.fileKind === 'spreadsheet'
                                            ? 'EXCEL / CSV'
                                            : 'DOCUMENT'}
                                      </span>
                                      {item.proof.fileSize && <span className="doc-size">{item.proof.fileSize}</span>}
                                      <div className="proof-gallery-overlay">
                                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                                          {item.fileKind === 'pdf' ? 'visibility' : 'download'}
                                        </span>
                                        <span>{item.fileKind === 'pdf' ? 'Preview PDF' : 'Download File'}</span>
                                      </div>
                                    </div>
                                  )}

                                  <div className="proof-gallery-caption-row">
                                    <div className="proof-gallery-badge-bar">
                                      <span className="proof-gallery-badge">
                                        <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>{item.cat.icon}</span>
                                        <span>{item.cat.label}</span>
                                      </span>
                                      <a
                                        href={item.downloadHref}
                                        download={item.fileName}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="proof-gallery-dl-btn"
                                        title={`Download ${item.fileName}`}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>download</span>
                                      </a>
                                    </div>
                                    <span className="proof-gallery-title" title={item.title}>
                                      {item.title}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* On-Chain Sepolia Hash & SHA-256 Evidence Digest */}
                      {(d.txHash || proofData.proofDigest) && (
                        <div className="proof-tx-box">
                          <div className="proof-tx-header">
                            <span className="tx-label">
                              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>verified_user</span>
                              <span>Cryptographic Audit Proof</span>
                            </span>
                            {isLiveOnChain ? (
                              <span className="proof-chain-badge is-live">
                                <span className="chain-dot" />
                                <span>
                                  Sepolia Confirmed{proofData.blockNumber ? ` · Block #${Number(proofData.blockNumber).toLocaleString()}` : ''}
                                </span>
                              </span>
                            ) : proofData.onChain === false ? (
                              <span className="proof-chain-badge is-seal">
                                <span>SHA-256 Audit Seal</span>
                              </span>
                            ) : null}
                          </div>

                          {d.txHash && (
                            <div className="tx-row">
                              <code className="tx-code" title={d.txHash}>{d.txHash}</code>
                              <div className="tx-actions">
                                <button
                                  type="button"
                                  className="proof-mini-btn"
                                  onClick={() => handleCopyValue(`tx_${d.id || idx}`, d.txHash)}
                                  title="Copy transaction / seal hash"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                                    {copiedKey === `tx_${d.id || idx}` ? 'check' : 'content_copy'}
                                  </span>
                                  <span>{copiedKey === `tx_${d.id || idx}` ? 'Copied' : 'Copy'}</span>
                                </button>
                                {explorerHref && (
                                  <a
                                    href={explorerHref}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="proof-mini-btn"
                                    title="Verify on Sepolia Etherscan"
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>open_in_new</span>
                                    <span>Etherscan</span>
                                  </a>
                                )}
                              </div>
                            </div>
                          )}

                          {proofData.proofDigest && (
                            <div className="proof-digest-row">
                              <span className="digest-lbl">Evidence SHA-256:</span>
                              <code className="digest-code" title={proofData.proofDigest}>
                                {proofData.proofDigest}
                              </code>
                              <button
                                type="button"
                                className="digest-copy-btn"
                                onClick={() => handleCopyValue(`dig_${d.id || idx}`, proofData.proofDigest)}
                                title="Copy canonical SHA-256 digest"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                                  {copiedKey === `dig_${d.id || idx}` ? 'check' : 'content_copy'}
                                </span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </div>

          {/* Minimal Sticky Footer */}
          <div className="bbdrts-proof-footer">
            <div className="footer-left">
              <span className="material-symbols-outlined text-emerald" style={{ fontSize: '16px' }}>verified_user</span>
              <span>Permanently synchronized with Ethereum Sepolia &amp; BBDRTS Audit Vault</span>
            </div>
            <button type="button" className="bbdrts-proof-done-btn" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>

      {/* Portaled Full-Viewport Image / PDF Lightbox (Outside transformed/overflow-hidden modal!) */}
      {currentPreviewItem && (
        <div
          className="bbdrts-proof-zoom-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Evidence Preview"
          data-theme={currentTheme}
          onClick={() => {
            setActivePreview(null);
            setZoomed(false);
          }}
        >
          <div className="zoom-card" onClick={(e) => e.stopPropagation()}>
            <div className="zoom-header">
              <div className="zoom-header-meta">
                <div className="zoom-badge-row">
                  <span className="zoom-badge">{currentPreviewItem.category}</span>
                  {activePreview.items.length > 1 && (
                    <span className="zoom-counter">
                      {activePreview.index + 1} / {activePreview.items.length}
                    </span>
                  )}
                </div>
                <div className="zoom-title" title={currentPreviewItem.title}>{currentPreviewItem.title}</div>
              </div>
              <div className="zoom-actions">
                {currentPreviewItem.fileKind === 'image' && (
                  <button
                    type="button"
                    className="zoom-action-btn"
                    onClick={() => setZoomed((z) => !z)}
                    title={zoomed ? 'Fit to screen' : 'Zoom in'}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                      {zoomed ? 'zoom_out' : 'zoom_in'}
                    </span>
                    <span>{zoomed ? 'Fit' : 'Zoom'}</span>
                  </button>
                )}
                {currentPreviewItem.hostedUrl && (
                  <a
                    href={currentPreviewItem.hostedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="zoom-action-btn"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>open_in_new</span>
                    <span>Open Tab</span>
                  </a>
                )}
                <a
                  href={currentPreviewItem.downloadHref}
                  download={currentPreviewItem.fileName}
                  target="_blank"
                  rel="noreferrer"
                  className="zoom-action-btn"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>download</span>
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  className="zoom-close-inline-btn"
                  onClick={() => {
                    setActivePreview(null);
                    setZoomed(false);
                  }}
                  aria-label="Close preview"
                  title="Close (Esc)"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                </button>
              </div>
            </div>

            <div className={`zoom-img-container ${zoomed ? 'is-zoomed' : ''}`}>
              {activePreview.items.length > 1 && (
                <button
                  type="button"
                  className="zoom-nav-btn is-prev"
                  onClick={() => {
                    setZoomed(false);
                    setActivePreview((prev) => prev ? { ...prev, index: (prev.index - 1 + prev.items.length) % prev.items.length } : null);
                  }}
                  aria-label="Previous file"
                >
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
              )}

              {currentPreviewItem.fileKind === 'pdf' ? (
                <iframe
                  src={currentPreviewItem.hostedUrl || currentPreviewItem.url}
                  title={currentPreviewItem.title}
                  className="zoom-pdf-frame"
                />
              ) : (
                <img
                  src={currentPreviewItem.url}
                  alt={currentPreviewItem.title}
                  className={zoomed ? 'is-zoomed' : ''}
                  onClick={() => setZoomed((z) => !z)}
                  onError={(e) => {
                    if (currentPreviewItem.hostedUrl && e.currentTarget.src !== currentPreviewItem.hostedUrl) {
                      e.currentTarget.src = currentPreviewItem.hostedUrl;
                    }
                  }}
                />
              )}

              {activePreview.items.length > 1 && (
                <button
                  type="button"
                  className="zoom-nav-btn is-next"
                  onClick={() => {
                    setZoomed(false);
                    setActivePreview((prev) => prev ? { ...prev, index: (prev.index + 1) % prev.items.length } : null);
                  }}
                  aria-label="Next file"
                >
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
