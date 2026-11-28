import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { API_URL } from '../config';
import GeistSelect from './GeistSelect';
import './DeclareDirectDepositModal.css';

const PAYMENT_RAILS = [
  { id: 'GCash', label: 'GCash', dotClass: 'is-gcash', maxPhp: 500000, refPlaceholder: 'e.g. 0044 579 175068' },
  { id: 'Maya', label: 'Maya', dotClass: 'is-maya', maxPhp: 500000, refPlaceholder: 'e.g. MYA928374651' },
  { id: 'Bank / Card', label: 'Bank / Card', dotClass: 'is-bank', maxPhp: 5000000, refPlaceholder: 'e.g. INSTA-88412039' }
];

/**
 * NGO "Log Unclaimed Direct Deposit" Modal (Dual-Theme Vercel Geist)
 * Closes the static-QR loophole for honest NGOs: when a donor sends GCash, Maya,
 * or Bank Transfer directly without uploading a receipt, the NGO can declare it
 * here with the reference number (and optional BBXXXXXX transfer note code),
 * crediting the campaign and notarizing it gaslessly on Ethereum Sepolia.
 */
export default function DeclareDirectDepositModal({
  isOpen,
  onClose,
  campaigns = [],
  onSuccess,
  showSuccess,
  showError
}) {
  const [campaignId, setCampaignId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('GCash');
  const [amountPhp, setAmountPhp] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [trackingCode, setTrackingCode] = useState('');
  const [matchedIntent, setMatchedIntent] = useState(null);
  const [lookupStatus, setLookupStatus] = useState('idle'); // 'idle' | 'loading' | 'found' | 'not_found'
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && campaigns.length > 0 && !campaignId) {
      const firstActive = campaigns.find((c) => c.isActive !== false && c.isActive !== 0) || campaigns[0];
      if (firstActive) setCampaignId(String(firstActive.id));
    }
  }, [isOpen, campaigns, campaignId]);

  useEffect(() => {
    if (!isOpen || submitting) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, submitting, onClose]);

  // Live auto-identify donor, campaign, channel, and amount as soon as NGO enters a BBXXXXXX code
  useEffect(() => {
    const code = trackingCode.trim().toUpperCase();
    if (!code || code.length < 6) {
      setMatchedIntent(null);
      setLookupStatus('idle');
      return;
    }
    const timer = setTimeout(async () => {
      setLookupStatus('loading');
      try {
        const token = localStorage.getItem('bbdrts_token');
        const res = await fetch(`${API_URL}/api/org/donations/intent-lookup/${encodeURIComponent(code)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.found) {
            setMatchedIntent(data);
            setLookupStatus('found');
            if (data.campaignId) setCampaignId(String(data.campaignId));
            if (data.paymentMethod) {
              const pmUp = String(data.paymentMethod).toUpperCase();
              setPaymentMethod(pmUp.includes('GCASH') ? 'GCash' : pmUp.includes('MAYA') ? 'Maya' : 'Bank / Card');
            }
            if (data.amountPhp && Number(data.amountPhp) > 0) setAmountPhp(String(Math.round(Number(data.amountPhp))));
            return;
          }
        }
        setMatchedIntent(null);
        setLookupStatus('not_found');
      } catch (_) {
        setMatchedIntent(null);
        setLookupStatus('idle');
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [trackingCode]);

  if (!isOpen) return null;

  const activeRail = PAYMENT_RAILS.find((r) => r.id === paymentMethod) || PAYMENT_RAILS[0];
  const parsedAmount = Number.isFinite(parseFloat(amountPhp)) ? parseFloat(amountPhp) : 0;
  const exceedsRailCap = parsedAmount > activeRail.maxPhp;
  const cleanRef = referenceNumber.trim();
  const canSubmit = Boolean(!submitting && campaignId && parsedAmount >= 1 && !exceedsRailCap && cleanRef.length >= 4);

  const handleAmountChange = (rawVal) => {
    const cleaned = String(rawVal ?? '').replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    let intPart = (parts[0] || '').slice(0, 7);
    if (intPart.length > 1 && intPart.startsWith('0')) {
      intPart = intPart.replace(/^0+/, '') || '0';
    }
    const decPart = parts.length > 1 ? '.' + parts.slice(1).join('').slice(0, 2) : '';
    setAmountPhp(intPart + decPart);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const numericPhp = Math.round(parsedAmount);
    if (!campaignId) {
      showError?.('Please select a target relief campaign.', 'Campaign Required');
      return;
    }
    if (!numericPhp || numericPhp < 1) {
      showError?.('Please enter a valid PHP amount (at least ₱1).', 'Invalid Amount');
      return;
    }
    if (numericPhp > activeRail.maxPhp) {
      showError?.(
        `Amount exceeds the single-transfer limit of ₱${activeRail.maxPhp.toLocaleString('en-US')} for ${activeRail.label}.`,
        'Amount Limit Exceeded'
      );
      return;
    }
    if (cleanRef.length < 4) {
      showError?.('Please enter the GCash, Maya, or bank reference number.', 'Reference Required');
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('bbdrts_token');
      const res = await fetch(`${API_URL}/api/org/donations/declare-direct`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          campaign_id: Number(campaignId),
          amount_php: numericPhp,
          payment_method: paymentMethod,
          reference_number: cleanRef,
          tracking_code: trackingCode.trim().toUpperCase() || undefined,
          notes: notes.trim() || undefined
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record direct deposit.');
      }

      const matchMsg = data.matchedTrackingCode
        ? ` Matched to donor intent ${data.matchedTrackingCode} & notarized on Sepolia.`
        : ' Notarized gaslessly on Ethereum Sepolia.';
      showSuccess?.(
        `₱${numericPhp.toLocaleString('en-US')} via ${paymentMethod} logged (Ref: ${cleanRef}).${matchMsg}`,
        'Unclaimed Deposit Recorded'
      );

      setAmountPhp('');
      setReferenceNumber('');
      setTrackingCode('');
      setMatchedIntent(null);
      setLookupStatus('idle');
      setNotes('');
      onSuccess?.(data);
      onClose?.();
    } catch (err) {
      showError?.(err.message || 'Unable to log direct deposit.', 'Declaration Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const campaignOptions = campaigns.map((c) => ({
    id: String(c.id),
    label: c.title || `Campaign #${c.id}`,
    triggerLabel: `#${c.id} — ${c.title || 'Relief Campaign'}`,
    sub: [`#${c.id}`, c.locationMunicipality || c.locationCity || c.locationProvince || ''].filter(Boolean).join(' · '),
    badge: c.isActive === false || c.isActive === 0 ? 'Closed' : (c.category === 'CD' ? 'Charity' : 'Relief'),
    icon: c.category === 'CD' ? 'volunteer_activism' : 'campaign'
  }));

  return createPortal(
    <div
      className="ddm-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Log Unclaimed Direct Deposit"
      onClick={() => !submitting && onClose?.()}
    >
      <div className="ddm-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ddm-header">
          <div className="ddm-header-left">
            <div className="ddm-header-icon" aria-hidden="true">
              <span className="material-symbols-outlined" style={{ fontSize: '19px' }}>add_card</span>
            </div>
            <div>
              <h3 className="ddm-title">Log Unclaimed Direct Deposit</h3>
              <p className="ddm-subtitle">
                Record GCash, Maya, or Bank transfers received without a donor receipt upload.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="ddm-close-btn"
            disabled={submitting}
            onClick={() => onClose?.()}
            aria-label="Close modal"
            title="Close (Esc)"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>

        {/* Form */}
        <form className="ddm-form" onSubmit={handleSubmit}>
          <div className="ddm-body">
            {/* Optional Auto-Match Donor Note Code */}
            <div className={`ddm-lookup-card${lookupStatus === 'found' ? ' is-matched' : ''}`}>
              <div className="ddm-label-row">
                <label htmlFor="ddm-tracking-code" className="ddm-label">
                  Donor Note Code
                </label>
                {lookupStatus === 'idle' && (
                  <span className="ddm-status-tag is-idle">Optional · Auto-fills donor &amp; drive</span>
                )}
                {lookupStatus === 'loading' && (
                  <span className="ddm-status-tag is-loading">Looking up…</span>
                )}
                {lookupStatus === 'found' && (
                  <span className="ddm-status-tag is-found">
                    <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>check_circle</span>
                    <span>Auto-Matched</span>
                  </span>
                )}
                {lookupStatus === 'not_found' && (
                  <span className="ddm-status-tag is-warn">No matching intent</span>
                )}
              </div>

              <div className="ddm-input-wrap">
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--text-muted)' }}>
                  qr_code_scanner
                </span>
                <input
                  id="ddm-tracking-code"
                  type="text"
                  className="ddm-input is-mono"
                  placeholder="Paste note code from GCash/Maya (e.g. BB278341)"
                  value={trackingCode}
                  onChange={(e) => setTrackingCode(e.target.value.toUpperCase())}
                />
                {trackingCode && (
                  <button
                    type="button"
                    className="ddm-clear-btn"
                    onClick={() => {
                      setTrackingCode('');
                      setMatchedIntent(null);
                      setLookupStatus('idle');
                    }}
                    aria-label="Clear note code"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>close</span>
                  </button>
                )}
              </div>

              {matchedIntent && (
                <div className="ddm-matched-banner">
                  <span className="material-symbols-outlined">verified</span>
                  <div>
                    <div>
                      <strong>Matched Donor:</strong> {matchedIntent.donorName}
                    </div>
                    <div>
                      <strong>Intended Drive:</strong> #{matchedIntent.campaignId} — {matchedIntent.campaignTitle} (₱{Number(matchedIntent.amountPhp || 0).toLocaleString('en-US')} via {matchedIntent.paymentMethod})
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Target Relief Campaign (GeistSelect) */}
            <div className="ddm-field">
              <label className="ddm-label">
                Target Relief Campaign <span className="ddm-req">*</span>
              </label>
              <GeistSelect
                width="100%"
                menuMinWidth={360}
                searchable={campaigns.length > 5}
                searchPlaceholder="Search campaign by title, #ID, or location..."
                emptyText="No campaigns found"
                value={campaignId}
                onChange={(val) => setCampaignId(String(val))}
                options={campaignOptions}
              />
            </div>

            {/* 1-Click Payment Channel Selector */}
            <div className="ddm-field">
              <div className="ddm-label-row">
                <label className="ddm-label">
                  Payment Channel <span className="ddm-req">*</span>
                </label>
                <span className="ddm-hint">Max ₱{activeRail.maxPhp.toLocaleString('en-US')}</span>
              </div>
              <div className="ddm-rail-grid" role="radiogroup" aria-label="Payment channel">
                {PAYMENT_RAILS.map((rail) => {
                  const isActive = paymentMethod === rail.id;
                  return (
                    <button
                      key={rail.id}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      className={`ddm-rail-btn${isActive ? ' is-active' : ''}`}
                      onClick={() => setPaymentMethod(rail.id)}
                    >
                      <span className={`ddm-rail-dot ${rail.dotClass}`} aria-hidden="true" />
                      <span>{rail.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Amount & Reference No. Row */}
            <div className="ddm-grid-2">
              <div className="ddm-field">
                <label htmlFor="ddm-amount" className="ddm-label">
                  Amount Received <span className="ddm-req">*</span>
                </label>
                <div className={`ddm-input-wrap${exceedsRailCap ? ' is-error' : ''}`}>
                  <span className="ddm-prefix">₱</span>
                  <input
                    id="ddm-amount"
                    type="text"
                    inputMode="decimal"
                    className="ddm-input is-mono"
                    placeholder="0.00"
                    value={amountPhp}
                    onKeyDown={(e) => {
                      if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                    }}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    required
                  />
                  <span className="ddm-suffix">PHP</span>
                </div>
                {exceedsRailCap && (
                  <span className="ddm-error-note">
                    Exceeds {activeRail.label} limit (₱{activeRail.maxPhp.toLocaleString('en-US')}).
                  </span>
                )}
              </div>

              <div className="ddm-field">
                <label htmlFor="ddm-ref" className="ddm-label">
                  Payment Reference No. <span className="ddm-req">*</span>
                </label>
                <div className="ddm-input-wrap">
                  <input
                    id="ddm-ref"
                    type="text"
                    className="ddm-input is-mono"
                    placeholder={activeRail.refPlaceholder}
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Audit Notes (Optional) */}
            <div className="ddm-field">
              <div className="ddm-label-row">
                <label htmlFor="ddm-notes" className="ddm-label">
                  Audit Notes
                </label>
                <span className="ddm-hint">{notes.length} / 200</span>
              </div>
              <div className="ddm-input-wrap">
                <input
                  id="ddm-notes"
                  type="text"
                  maxLength={200}
                  className="ddm-input"
                  placeholder="e.g. Received via GCash inbox at 10:15 AM without donor slip"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            {/* Calm Sepolia Audit Notice */}
            <div className="ddm-audit-note">
              <span className="material-symbols-outlined">verified_user</span>
              <span>
                <strong>Gasless Blockchain Audit:</strong> Submitting credits the campaign immediately, locks this reference number against duplicate claims, and notarizes the deposit onto Ethereum Sepolia. Entering a donor&apos;s <code>BBXXXXXX</code> code automatically credits and notifies their account.
              </span>
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="ddm-footer">
            <span className="ddm-footer-summary">
              {parsedAmount >= 1 ? (
                <>
                  Crediting <strong>₱{Math.round(parsedAmount).toLocaleString('en-US')}</strong> via {paymentMethod}
                </>
              ) : (
                'Enter deposit amount and trace reference'
              )}
            </span>

            <div className="ddm-footer-actions">
              <button
                type="button"
                className="ddm-btn-cancel"
                disabled={submitting}
                onClick={() => onClose?.()}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="ddm-btn-submit"
                disabled={!canSubmit}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>verified</span>
                <span>{submitting ? 'Notarizing…' : 'Record & Notarize Deposit'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
