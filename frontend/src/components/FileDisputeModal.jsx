import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import '../styles/FileDisputeModal.css';

const SHORTAGE_PRESETS = [
  'Credited amount is lower than my payment receipt',
  'My payment slip shows the full amount transferred',
  'Requesting admin verification of NGO audit entry'
];

const OVERCREDIT_PRESETS = [
  'Credited amount is higher than what I actually sent',
  'Requesting correction to match my transfer receipt',
  'Requesting admin verification of NGO audit entry'
];

const VERDICT_LABELS = {
  UPHELD_NGO_FAULT: 'Upheld · NGO Discrepancy Confirmed',
  DISMISSED_DONOR_ERROR: 'Dismissed · NGO Credited Amount Verified',
  MUTUAL_ADJUSTMENT: 'Resolved · Mutual Audit Adjustment'
};

function getStatusMeta(status) {
  const s = String(status || 'OPEN').toUpperCase();
  if (s === 'RESOLVED') return { label: 'Resolved', cls: 'resolved' };
  if (s === 'UNDER_REVIEW') return { label: 'Under Review', cls: 'review' };
  if (s === 'DISMISSED') return { label: 'Dismissed', cls: 'dismissed' };
  return { label: 'Open · Pending Admin', cls: 'open' };
}

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

export default function FileDisputeModal({
  tx,
  campaignTitle,
  orgName,
  apiUrl,
  onClose,
  onSuccess
}) {
  const existingTicket = tx?.disputeTicket || null;
  const declaredPhp = Number(tx?.declaredPhp || 0);
  const creditedPhp = Number(tx?.creditedPhp || Math.round(parseFloat(tx?.amount || 0) * 170000));
  const variancePhp = Number(
    tx?.variancePhp !== undefined && tx?.variancePhp !== null
      ? tx.variancePhp
      : creditedPhp - declaredPhp
  );
  const isShortage = tx?.auditStatus === 'SHORTAGE' || variancePhp <= -0.01;
  const isOverCredit = tx?.auditStatus === 'OVER_CREDIT' || variancePhp >= 0.01;
  const presets = isOverCredit && !isShortage ? OVERCREDIT_PRESETS : SHORTAGE_PRESETS;

  const [reason, setReason] = useState(
    isShortage
      ? 'Credited amount is lower than my payment receipt'
      : isOverCredit
        ? 'Credited amount is higher than what I actually sent'
        : ''
  );
  const [evidenceBase64, setEvidenceBase64] = useState(null);
  const [evidenceFileName, setEvidenceFileName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submittedDispute, setSubmittedDispute] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [submitting, onClose]);

  if (!tx) return null;

  const activeTicket = submittedDispute || (existingTicket ? {
    ticketCode: tx.disputeTicket,
    status: tx.disputeStatus || 'OPEN',
    reason: tx.disputeReason,
    ngoResponse: tx.disputeNgoResponse,
    verdict: tx.disputeVerdict,
    adminNotes: tx.disputeAdminNotes,
    createdAt: tx.disputeCreatedAt,
    resolvedAt: tx.disputeResolvedAt
  } : null);

  const handleEvidenceChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPG, or WebP).');
      return;
    }
    try {
      setError('');
      const dataUrl = await compressEvidenceImage(file);
      setEvidenceBase64(dataUrl);
      setEvidenceFileName(file.name);
    } catch (err) {
      setError(err.message || 'Unable to process image.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const clean = reason.trim();
    if (clean.length < 5) {
      setError('Please describe the discrepancy (at least 5 characters).');
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('bbdrts_token') || sessionStorage.getItem('bbdrts_token');
      if (!token) {
        setError('Your session has expired. Please sign in again to file a dispute.');
        setSubmitting(false);
        return;
      }

      const res = await fetch(`${apiUrl}/api/donations/disputes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          transactionId: tx.id,
          txHash: tx.txHash,
          campaignId: tx.campaignId,
          reason: clean,
          evidenceBase64
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not submit audit dispute.');
        setSubmitting(false);
        return;
      }

      setSubmittedDispute(data.dispute || {
        ticketCode: 'AUDIT-FILED',
        status: 'OPEN',
        reason: clean
      });
      if (onSuccess) onSuccess(data);
    } catch (err) {
      setError(err.message || 'Network error while submitting dispute.');
    } finally {
      setSubmitting(false);
    }
  };

  const statusMeta = activeTicket ? getStatusMeta(activeTicket.status) : null;

  return createPortal(
    <div
      className="fdm-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="fdm-modal" role="dialog" aria-modal="true" aria-labelledby="fdm-heading">
        <div className="fdm-header">
          <div className="fdm-title-wrap">
            <div className={`fdm-icon-box ${activeTicket ? (statusMeta?.cls === 'resolved' ? 'ok' : 'warn') : (isOverCredit && !isShortage ? 'warn' : '')}`}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                {activeTicket ? (statusMeta?.cls === 'resolved' ? 'task_alt' : 'gavel') : 'gavel'}
              </span>
            </div>
            <div>
              <h3 id="fdm-heading" className="fdm-title">
                {activeTicket ? 'Audit Dispute Ticket' : 'File Donation Audit Dispute'}
              </h3>
              <p className="fdm-sub">
                {activeTicket
                  ? 'Two-sided audit record reviewed by BBDRTS Administrators.'
                  : 'Escalate this credited amount discrepancy with supporting proof.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="fdm-close"
            onClick={() => !submitting && onClose()}
            aria-label="Close dispute dialog"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '19px' }}>close</span>
          </button>
        </div>

        {activeTicket ? (
          <>
            <div className="fdm-body">
              <div className={`fdm-ticket-box ${statusMeta?.cls === 'resolved' ? '' : 'open'}`}>
                <div className="fdm-ticket-head">
                  <span className="fdm-ticket-code">#{activeTicket.ticketCode}</span>
                  <span className={`fdm-status-badge ${statusMeta?.cls}`}>{statusMeta?.label}</span>
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  {submittedDispute
                    ? 'Your original payment slip, AI audit log, and dispute details have been submitted. Both Administrators and the managing NGO have been notified.'
                    : 'Administrators compare your original slip, AI OCR audit, and the NGO counter-proof before issuing a final ruling.'}
                </div>
              </div>

              <div className="fdm-summary-grid">
                <div className="fdm-stat">
                  <div className="fdm-stat-lbl">Declared</div>
                  <div className="fdm-stat-val">₱{declaredPhp.toLocaleString('en-US')}</div>
                </div>
                <div className="fdm-stat">
                  <div className="fdm-stat-lbl">Credited</div>
                  <div className="fdm-stat-val">₱{creditedPhp.toLocaleString('en-US')}</div>
                </div>
                <div className="fdm-stat">
                  <div className="fdm-stat-lbl">Variance</div>
                  <div className={`fdm-stat-val ${variancePhp < 0 ? 'danger' : 'warn'}`}>
                    {variancePhp < 0 ? '-' : '+'}₱{Math.abs(variancePhp).toLocaleString('en-US')}
                  </div>
                </div>
              </div>

              <div className="fdm-tx-meta">
                <div className="fdm-meta-row">
                  <span className="fdm-meta-k">Campaign</span>
                  <span className="fdm-meta-v">{campaignTitle || tx.campaignTitle || 'Relief Campaign'}</span>
                </div>
                <div className="fdm-meta-row">
                  <span className="fdm-meta-k">Managing NGO</span>
                  <span className="fdm-meta-v">{orgName || tx.orgName || 'Organization'}</span>
                </div>
                {tx.txHash && (
                  <div className="fdm-meta-row">
                    <span className="fdm-meta-k">Sepolia TX</span>
                    <span className="fdm-meta-v mono">{tx.txHash.slice(0, 14)}...{tx.txHash.slice(-8)}</span>
                  </div>
                )}
              </div>

              {activeTicket.reason && (
                <div className="fdm-note-box">
                  <div className="fdm-note-lbl">Your Submitted Statement</div>
                  <div>{activeTicket.reason}</div>
                </div>
              )}

              {activeTicket.ngoResponse && (
                <div className="fdm-note-box" style={{ borderColor: 'rgba(245, 158, 11, 0.35)' }}>
                  <div className="fdm-note-lbl" style={{ color: '#f59e0b' }}>NGO Audit Response</div>
                  <div>{activeTicket.ngoResponse}</div>
                </div>
              )}

              {(activeTicket.verdict || activeTicket.adminNotes) && (
                <div className="fdm-note-box" style={{ borderColor: 'rgba(16, 185, 129, 0.35)' }}>
                  <div className="fdm-note-lbl" style={{ color: '#10b981' }}>
                    {activeTicket.verdict && VERDICT_LABELS[activeTicket.verdict]
                      ? VERDICT_LABELS[activeTicket.verdict]
                      : 'Administrator Resolution Notes'}
                  </div>
                  {activeTicket.adminNotes && <div>{activeTicket.adminNotes}</div>}
                </div>
              )}
            </div>

            <div className="fdm-footer">
              <button type="button" className="fdm-btn-ok" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="fdm-body">
              <div className="fdm-summary-grid">
                <div className="fdm-stat">
                  <div className="fdm-stat-lbl">Declared Sent</div>
                  <div className="fdm-stat-val">₱{declaredPhp.toLocaleString('en-US')}</div>
                </div>
                <div className="fdm-stat">
                  <div className="fdm-stat-lbl">NGO Credited</div>
                  <div className="fdm-stat-val">₱{creditedPhp.toLocaleString('en-US')}</div>
                </div>
                <div className="fdm-stat">
                  <div className="fdm-stat-lbl">{isShortage ? 'Shortage' : 'Over-Credit'}</div>
                  <div className={`fdm-stat-val ${isShortage ? 'danger' : 'warn'}`}>
                    {variancePhp < 0 ? '-' : '+'}₱{Math.abs(variancePhp).toLocaleString('en-US')}
                  </div>
                </div>
              </div>

              <div className="fdm-tx-meta">
                <div className="fdm-meta-row">
                  <span className="fdm-meta-k">Campaign</span>
                  <span className="fdm-meta-v">{campaignTitle || tx.campaignTitle || 'Relief Campaign'}</span>
                </div>
                <div className="fdm-meta-row">
                  <span className="fdm-meta-k">Managing NGO</span>
                  <span className="fdm-meta-v">{orgName || tx.orgName || 'Organization'}</span>
                </div>
                {tx.referenceNumber && (
                  <div className="fdm-meta-row">
                    <span className="fdm-meta-k">Reference No.</span>
                    <span className="fdm-meta-v mono">{tx.referenceNumber}</span>
                  </div>
                )}
                {tx.txHash && (
                  <div className="fdm-meta-row">
                    <span className="fdm-meta-k">Sepolia TX</span>
                    <span className="fdm-meta-v mono">{tx.txHash.slice(0, 14)}...{tx.txHash.slice(-8)}</span>
                  </div>
                )}
              </div>

              <div className="fdm-field">
                <label className="fdm-label" htmlFor="fdm-reason-input">
                  Dispute Details (Sent to Admin Governance &amp; NGO)
                </label>
                <div className="fdm-chips">
                  {presets.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`fdm-chip ${reason === p ? 'active' : ''}`}
                      onClick={() => setReason(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <textarea
                  id="fdm-reason-input"
                  className="fdm-textarea"
                  placeholder="Explain the mismatch between your transfer receipt and the amount credited..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              {/* Optional Supporting Proof Upload */}
              <div className="fdm-field">
                <label className="fdm-label">
                  Additional Proof Screenshot (Optional · e.g. Wallet History or SMS Alert)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/*"
                  onChange={handleEvidenceChange}
                  style={{ display: 'none' }}
                />
                {evidenceBase64 ? (
                  <div className="fdm-upload-preview">
                    <div className="fdm-upload-left">
                      <img src={evidenceBase64} alt="Supporting proof" className="fdm-upload-thumb" />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {evidenceFileName || 'Supporting proof attached'}
                        </div>
                        <div style={{ fontSize: '0.70rem', color: '#10b981' }}>
                          Attached alongside your original donation slip
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="fdm-btn-sec"
                      style={{ height: '30px', padding: '0 10px', fontSize: '0.73rem' }}
                      onClick={() => {
                        setEvidenceBase64(null);
                        setEvidenceFileName('');
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div
                    className="fdm-upload-zone"
                    onClick={() => fileInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                  >
                    <div className="fdm-upload-left">
                      <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#38bdf8' }}>
                        add_photo_alternate
                      </span>
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          Attach extra bank / e-wallet history screenshot
                        </div>
                        <div style={{ fontSize: '0.70rem', color: 'var(--text-muted)' }}>
                          Your original payment slip is already included automatically for Admin review.
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#38bdf8', flexShrink: 0 }}>
                      Browse
                    </span>
                  </div>
                )}
              </div>

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
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="fdm-btn-danger"
                disabled={submitting}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>gavel</span>
                <span>{submitting ? 'Submitting Dispute...' : 'Submit Audit Dispute'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
