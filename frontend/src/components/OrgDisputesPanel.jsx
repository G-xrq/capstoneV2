import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import '../styles/FileDisputeModal.css';

function compressEvidenceImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.onload = () => {
        const maxSide = 1280;
        let { width, height } = img;
        if (width > maxSide || height > maxSide) {
          const ratio = Math.min(maxSide / width, maxSide / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.84));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

const NGO_RESPONSE_PRESETS = [
  'Our incoming GCash/Bank history confirms only the credited amount was received for this reference.',
  'The credited amount reflects a clerical entry error; we acknowledge the discrepancy for admin adjustment.',
  'Attached is our official incoming transaction history screenshot matching this reference number.'
];

export default function OrgDisputesPanel({
  disputes = [],
  apiUrl,
  onRefresh,
  onToast
}) {
  const [activeDispute, setActiveDispute] = useState(null);
  const [evidenceData, setEvidenceData] = useState(null);
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [proofBase64, setProofBase64] = useState(null);
  const [proofFileName, setProofFileName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [zoomImage, setZoomImage] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!activeDispute && !zoomImage) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (zoomImage) setZoomImage(null);
        else if (!submitting) setActiveDispute(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeDispute, zoomImage, submitting]);

  if (!Array.isArray(disputes) || disputes.length === 0) return null;

  const openRespondModal = async (dp) => {
    setActiveDispute(dp);
    setResponseText(dp.ngoResponse || '');
    setProofBase64(null);
    setProofFileName('');
    setError('');
    setEvidenceData(null);
    setLoadingEvidence(true);

    try {
      const token = localStorage.getItem('bbdrts_token') || sessionStorage.getItem('bbdrts_token');
      const res = await fetch(`${apiUrl}/api/disputes/${dp.id}/evidence`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEvidenceData(data);
        if (data.ngoEvidenceBase64) {
          setProofBase64(data.ngoEvidenceBase64);
          setProofFileName('Previously submitted counter-proof');
        }
      }
    } catch (_) {
      // ignore
    } finally {
      setLoadingEvidence(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid PNG, JPG, or WebP screenshot.');
      return;
    }
    try {
      setError('');
      const compressed = await compressEvidenceImage(file);
      setProofBase64(compressed);
      setProofFileName(file.name);
    } catch (err) {
      setError(err.message || 'Could not process image.');
    }
  };

  const handleSubmitCounterProof = async (e) => {
    e.preventDefault();
    if (!activeDispute) return;
    setError('');
    const clean = responseText.trim();
    if (clean.length < 5) {
      setError('Please enter your explanation (at least 5 characters).');
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('bbdrts_token') || sessionStorage.getItem('bbdrts_token');
      const res = await fetch(`${apiUrl}/api/org/disputes/${activeDispute.id}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          responseText: clean,
          evidenceBase64: proofBase64
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to submit counter-evidence.');
        setSubmitting(false);
        return;
      }
      if (onToast) onToast(data.message || 'Counter-evidence submitted to Administrators.');
      setActiveDispute(null);
      if (onRefresh) onRefresh({ silent: true });
    } catch (err) {
      setError(err.message || 'Network error while submitting response.');
    } finally {
      setSubmitting(false);
    }
  };

  const openCount = disputes.filter((d) => d.status === 'OPEN' || d.status === 'UNDER_REVIEW').length;

  return (
    <div className="odp-section">
      <div className="odp-head">
        <div className="odp-title-row">
          <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#ef4444' }}>gavel</span>
          <div>
            <h3 className="odp-title">
              Donor Audit Disputes ({openCount} Active · {disputes.length} Total)
            </h3>
            <p className="odp-sub">
              Submit your incoming GCash, Maya, or Bank transaction history screenshot so Administrators can verify the exact received amount.
            </p>
          </div>
        </div>
      </div>

      <div className="odp-list">
        {disputes.map((dp) => {
          const isClosed = dp.status === 'RESOLVED' || dp.status === 'DISMISSED';
          const hasResponded = Boolean(dp.ngoResponse || Number(dp.hasNgoEvidence));
          const varNum = Number(dp.variancePhp || 0);
          return (
            <div key={dp.id} className="odp-item">
              <div className="odp-item-main">
                <div className="odp-item-top">
                  <span className="odp-ticket">#{dp.ticketCode}</span>
                  <span className={`fdm-status-badge ${dp.status === 'RESOLVED' ? 'resolved' : dp.status === 'UNDER_REVIEW' ? 'review' : dp.status === 'DISMISSED' ? 'dismissed' : 'open'}`}>
                    {dp.status === 'UNDER_REVIEW' ? 'Under Review' : dp.status}
                  </span>
                  <span style={{ fontSize: '0.76rem', fontWeight: 700, color: varNum < 0 ? '#ef4444' : '#f59e0b' }}>
                    Declared ₱{Number(dp.declaredPhp || 0).toLocaleString()} → Credited ₱{Number(dp.creditedPhp || 0).toLocaleString()} ({varNum < 0 ? '-' : '+'}₱{Math.abs(varNum).toLocaleString()})
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  <strong>{dp.campaignTitle}</strong> · Donor: {dp.donorName || 'Verified Donor'}
                  {dp.referenceNumber ? ` · Ref ${dp.referenceNumber}` : ''}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Claim: {dp.reason}
                </div>
              </div>

              <div className="odp-item-actions">
                <button
                  type="button"
                  className={isClosed ? 'fdm-btn-sec' : 'fdm-btn-danger'}
                  style={hasResponded && !isClosed ? { background: '#f59e0b', color: '#0b0b0b' } : undefined}
                  onClick={() => openRespondModal(dp)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                    {isClosed ? 'visibility' : hasResponded ? 'edit_document' : 'upload_file'}
                  </span>
                  <span>
                    {isClosed ? 'View Ruling' : hasResponded ? 'Update Counter-Proof' : 'Submit Counter-Proof'}
                  </span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* NGO Counter-Proof Modal */}
      {activeDispute &&
        createPortal(
          <div
            className="fdm-backdrop"
            onClick={(e) => {
              if (e.target === e.currentTarget && !submitting) setActiveDispute(null);
            }}
          >
            <div className="fdm-modal is-wide" role="dialog" aria-modal="true" aria-labelledby="odp-modal-title">
              <div className="fdm-header">
                <div className="fdm-title-wrap">
                  <div className="fdm-icon-box warn">
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>gavel</span>
                  </div>
                  <div>
                    <h3 id="odp-modal-title" className="fdm-title">
                      Dispute Response · #{activeDispute.ticketCode}
                    </h3>
                    <p className="fdm-sub">
                      Provide your incoming GCash/Maya/Bank history screenshot for Ref {activeDispute.referenceNumber || 'N/A'} to assist Admin verification.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="fdm-close"
                  onClick={() => !submitting && setActiveDispute(null)}
                  aria-label="Close modal"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '19px' }}>close</span>
                </button>
              </div>

              <form onSubmit={handleSubmitCounterProof} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1, minHeight: 0 }}>
                <div className="fdm-body">
                  <div className="fdm-summary-grid">
                    <div className="fdm-stat">
                      <div className="fdm-stat-lbl">Donor Declared</div>
                      <div className="fdm-stat-val">₱{Number(activeDispute.declaredPhp || 0).toLocaleString()}</div>
                    </div>
                    <div className="fdm-stat">
                      <div className="fdm-stat-lbl">Your Credited Amount</div>
                      <div className="fdm-stat-val">₱{Number(activeDispute.creditedPhp || 0).toLocaleString()}</div>
                    </div>
                    <div className="fdm-stat">
                      <div className="fdm-stat-lbl">Variance</div>
                      <div className={`fdm-stat-val ${Number(activeDispute.variancePhp || 0) < 0 ? 'danger' : 'warn'}`}>
                        {Number(activeDispute.variancePhp || 0) < 0 ? '-' : '+'}₱{Math.abs(Number(activeDispute.variancePhp || 0)).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="fdm-evidence-grid">
                    {/* Left: Donor Claim & Original Slip */}
                    <div className="fdm-evidence-col">
                      <div className="fdm-col-head">
                        <span className="fdm-col-title">Donor&apos;s Submitted Claim &amp; Slip</span>
                      </div>
                      <div className="fdm-note-box">
                        <div className="fdm-note-lbl">Donor Statement</div>
                        <div>{activeDispute.reason}</div>
                      </div>
                      {loadingEvidence ? (
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', padding: '14px', textAlign: 'center' }}>
                          Loading original payment slip...
                        </div>
                      ) : evidenceData?.originalReceiptBase64 ? (
                        <div className="fdm-proof-card">
                          <div className="fdm-note-lbl">Donor&apos;s Original Payment Slip</div>
                          <button
                            type="button"
                            className="fdm-proof-thumb-btn"
                            onClick={() => setZoomImage({ src: evidenceData.originalReceiptBase64, label: 'Donor Original Slip' })}
                          >
                            <img src={evidenceData.originalReceiptBase64} alt="Donor original slip" />
                            <span className="fdm-proof-zoom-tag">
                              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>zoom_in</span>
                              <span>Zoom</span>
                            </span>
                          </button>
                        </div>
                      ) : (
                        <div className="fdm-awaiting-box" style={{ padding: '14px' }}>
                          No original slip image available.
                        </div>
                      )}
                    </div>

                    {/* Right: NGO Counter-Proof Upload */}
                    <div className="fdm-evidence-col">
                      <div className="fdm-col-head">
                        <span className="fdm-col-title">Your Incoming Wallet / Bank Proof</span>
                      </div>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/*"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                      />

                      {proofBase64 ? (
                        <div className="fdm-proof-card">
                          <button
                            type="button"
                            className="fdm-proof-thumb-btn"
                            onClick={() => setZoomImage({ src: proofBase64, label: 'NGO Incoming Transaction Proof' })}
                          >
                            <img src={proofBase64} alt="NGO counter proof" />
                            <span className="fdm-proof-zoom-tag">
                              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>zoom_in</span>
                              <span>Zoom</span>
                            </span>
                          </button>
                          {!(activeDispute.status === 'RESOLVED' || activeDispute.status === 'DISMISSED') && (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                type="button"
                                className="fdm-btn-sec"
                                style={{ flex: 1, height: '30px', fontSize: '0.73rem' }}
                                onClick={() => fileInputRef.current?.click()}
                              >
                                Replace Screenshot
                              </button>
                              <button
                                type="button"
                                className="fdm-btn-sec"
                                style={{ height: '30px', fontSize: '0.73rem' }}
                                onClick={() => {
                                  setProofBase64(null);
                                  setProofFileName('');
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div
                          className="fdm-upload-zone"
                          style={{ padding: '18px 14px', flexDirection: 'column', textAlign: 'center' }}
                          onClick={() => !(activeDispute.status === 'RESOLVED' || activeDispute.status === 'DISMISSED') && fileInputRef.current?.click()}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '26px', color: '#f59e0b' }}>
                            upload_file
                          </span>
                          <div style={{ fontSize: '0.79rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Upload Incoming GCash / Maya / Bank History
                          </div>
                          <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)' }}>
                            Show the exact received amount for Ref {activeDispute.referenceNumber || 'N/A'}
                          </div>
                        </div>
                      )}

                      <div className="fdm-field">
                        <label className="fdm-label">NGO Audit Explanation</label>
                        {!(activeDispute.status === 'RESOLVED' || activeDispute.status === 'DISMISSED') && (
                          <div className="fdm-chips">
                            {NGO_RESPONSE_PRESETS.map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                className={`fdm-chip ${responseText === preset ? 'active' : ''}`}
                                onClick={() => setResponseText(preset)}
                              >
                                {preset.slice(0, 42)}…
                              </button>
                            ))}
                          </div>
                        )}
                        <textarea
                          className="fdm-textarea"
                          placeholder="Explain what landed in your receiving account for this reference number..."
                          value={responseText}
                          onChange={(e) => setResponseText(e.target.value)}
                          disabled={activeDispute.status === 'RESOLVED' || activeDispute.status === 'DISMISSED'}
                        />
                      </div>
                    </div>
                  </div>

                  {activeDispute.adminNotes && (
                    <div className="fdm-note-box" style={{ borderColor: 'rgba(16, 185, 129, 0.35)' }}>
                      <div className="fdm-note-lbl" style={{ color: '#10b981' }}>Administrator Ruling &amp; Notes</div>
                      <div>{activeDispute.adminNotes}</div>
                    </div>
                  )}

                  {error && (
                    <div className="fdm-error">
                      <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>error</span>
                      <span>{error}</span>
                    </div>
                  )}
                </div>

                <div className="fdm-footer">
                  <button
                    type="button"
                    className="fdm-btn-sec"
                    onClick={() => setActiveDispute(null)}
                    disabled={submitting}
                  >
                    Close
                  </button>
                  {!(activeDispute.status === 'RESOLVED' || activeDispute.status === 'DISMISSED') && (
                    <button
                      type="submit"
                      className="fdm-btn-ok"
                      disabled={submitting}
                    >
                      {submitting ? 'Submitting...' : 'Submit Counter-Proof to Admin'}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {zoomImage &&
        createPortal(
          <div className="fdm-lightbox-backdrop" onClick={() => setZoomImage(null)}>
            <div className="fdm-lightbox-bar" onClick={(e) => e.stopPropagation()}>
              <span>{zoomImage.label}</span>
              <button type="button" className="fdm-btn-sec" onClick={() => setZoomImage(null)}>
                Close
              </button>
            </div>
            <img
              src={zoomImage.src}
              alt={zoomImage.label}
              className="fdm-lightbox-img"
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body
        )}
    </div>
  );
}
