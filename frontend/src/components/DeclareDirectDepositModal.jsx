import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { API_URL } from '../config';

/**
 * NGO "Declare Unclaimed Direct Deposit" Modal
 * Closes the static-QR loophole for honest NGOs: when a donor sends GCash, Maya,
 * or Bank Transfer directly without uploading a receipt, the NGO can declare it
 * here with the reference number (and optional BB-XXXX transfer note code),
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
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && campaigns.length > 0 && !campaignId) {
      const firstActive = campaigns.find((c) => c.isActive !== false && c.isActive !== 0) || campaigns[0];
      if (firstActive) setCampaignId(String(firstActive.id));
    }
  }, [isOpen, campaigns, campaignId]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const numericPhp = Math.round(Number(amountPhp || 0));
    if (!campaignId) {
      showError?.('Please select a target relief campaign.', 'Campaign Required');
      return;
    }
    if (!numericPhp || numericPhp < 1) {
      showError?.('Please enter a valid PHP amount (at least ₱1).', 'Invalid Amount');
      return;
    }
    if (!referenceNumber.trim() || referenceNumber.trim().length < 4) {
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
          reference_number: referenceNumber.trim(),
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
        `₱${numericPhp.toLocaleString('en-US')} via ${paymentMethod} logged (Ref: ${referenceNumber.trim()}).${matchMsg}`,
        'Unclaimed Deposit Recorded'
      );

      setAmountPhp('');
      setReferenceNumber('');
      setTrackingCode('');
      setNotes('');
      onSuccess?.(data);
      onClose?.();
    } catch (err) {
      showError?.(err.message || 'Unable to log direct deposit.', 'Declaration Failed');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={() => !submitting && onClose?.()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '500px',
          background: 'var(--bg-card, #0a0a0a)',
          border: '1px solid var(--border, #262626)',
          borderRadius: '14px',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.55)',
          fontFamily: 'var(--font-sans, inherit)'
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border, #262626)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.14)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add_card</span>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-primary, #fff)' }}>
                Log Unclaimed Direct Deposit
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.73rem', color: 'var(--text-muted, #888)' }}>
                Record GCash, Maya, or Bank transfers received without a donor receipt upload
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={() => onClose?.()}
            style={{
              background: 'transparent',
              border: '1px solid var(--border, #262626)',
              color: 'var(--text-muted, #888)',
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '13px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary, #a1a1aa)', marginBottom: '5px' }}>
              Target Relief Campaign *
            </label>
            <select
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              required
              style={{
                width: '100%',
                height: '38px',
                padding: '0 10px',
                borderRadius: '8px',
                border: '1px solid var(--border, #262626)',
                background: 'var(--bg-input, #111)',
                color: 'var(--text-primary, #fff)',
                fontSize: '0.82rem'
              }}
            >
              {campaigns.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  #{c.id} — {c.title}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary, #a1a1aa)', marginBottom: '5px' }}>
                Payment Channel *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border, #262626)',
                  background: 'var(--bg-input, #111)',
                  color: 'var(--text-primary, #fff)',
                  fontSize: '0.82rem'
                }}
              >
                <option value="GCash">GCash</option>
                <option value="Maya">Maya</option>
                <option value="Bank / Card">Bank Transfer / Card</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary, #a1a1aa)', marginBottom: '5px' }}>
                Amount Received (PHP) *
              </label>
              <input
                type="number"
                min="1"
                step="1"
                required
                placeholder="e.g. 500"
                value={amountPhp}
                onChange={(e) => setAmountPhp(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border, #262626)',
                  background: 'var(--bg-input, #111)',
                  color: 'var(--text-primary, #fff)',
                  fontSize: '0.84rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary, #a1a1aa)', marginBottom: '5px' }}>
                Payment Reference No. *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 0044 579 175068"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border, #262626)',
                  background: 'var(--bg-input, #111)',
                  color: 'var(--text-primary, #fff)',
                  fontSize: '0.82rem',
                  fontFamily: 'var(--font-mono, monospace)',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary, #a1a1aa)', marginBottom: '5px' }}>
                Donor Note Code (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. BB-4821A"
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value.toUpperCase())}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border, #262626)',
                  background: 'var(--bg-input, #111)',
                  color: 'var(--text-primary, #fff)',
                  fontSize: '0.82rem',
                  fontFamily: 'var(--font-mono, monospace)',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary, #a1a1aa)', marginBottom: '5px' }}>
              Audit Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Received via GCash inbox at 10:15 AM without donor slip"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{
                width: '100%',
                height: '38px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid var(--border, #262626)',
                background: 'var(--bg-input, #111)',
                color: 'var(--text-primary, #fff)',
                fontSize: '0.82rem',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.22)',
              fontSize: '0.73rem',
              color: 'var(--text-secondary, #a1a1aa)',
              lineHeight: 1.45
            }}
          >
            <strong style={{ color: '#10b981' }}>Gasless Blockchain Audit:</strong> Submitting this declaration immediately credits the campaign, prevents duplicate reference claims, and notarizes the deposit onto Ethereum Sepolia. If a donor&apos;s <code style={{ color: '#38bdf8' }}>BB-XXXX</code> code is entered, their account is automatically credited and notified.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '4px' }}>
            <button
              type="button"
              disabled={submitting}
              onClick={() => onClose?.()}
              className="btn btn-outline btn-sm"
              style={{ borderRadius: '8px', padding: '7px 14px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary btn-sm"
              style={{ borderRadius: '8px', padding: '7px 16px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                {submitting ? 'hourglass_top' : 'verified'}
              </span>
              <span>{submitting ? 'Notarizing on Sepolia…' : 'Record & Notarize Deposit'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
