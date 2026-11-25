import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './OfficialAuditVoucherModal.css';

function formatVoucherTimestamp(raw) {
  if (!raw) return 'Audited On-Chain';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return String(raw);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

function getRailBadgeTone(method) {
  const pm = String(method || '').toUpperCase();
  if (pm.includes('GCASH')) return { label: method || 'GCash', cls: 'is-gcash', icon: 'account_balance_wallet' };
  if (pm.includes('MAYA')) return { label: method || 'Maya', cls: 'is-maya', icon: 'account_balance_wallet' };
  if (pm.includes('QR')) return { label: method || 'QR Ph', cls: 'is-qr', icon: 'qr_code_2' };
  if (pm.includes('CARD')) return { label: method || 'Card', cls: 'is-bank', icon: 'credit_card' };
  if (pm.includes('BANK')) return { label: method || 'Bank Transfer', cls: 'is-bank', icon: 'account_balance' };
  return { label: method || 'Bank / Card', cls: 'is-bank', icon: 'payments' };
}

export default function OfficialAuditVoucherModal({
  tx,
  campTitle,
  orgDisplayName,
  donorDisplay,
  amtPhp,
  declaredPhp,
  variancePhp,
  isShortage,
  isOverCredit,
  onClose,
  onPrint,
  onCopySuccess
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!tx) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tx, onClose]);

  if (!tx) return null;

  const hasVariance = isShortage || isOverCredit;
  const toneClass = isShortage ? 'is-shortage' : isOverCredit ? 'is-overcredit' : 'is-verified';
  const rail = getRailBadgeTone(tx.paymentMethod);
  const refCode = tx.refCode || tx.paymentReference || tx.referenceNumber || '';
  const hasEtherscan = Boolean(tx.txHash && !String(tx.txHash).startsWith('MOCK') && !String(tx.txHash).startsWith('FIAT-'));

  const handleCopyHash = async () => {
    if (!tx.txHash) return;
    try {
      await navigator.clipboard.writeText(tx.txHash);
      setCopied(true);
      onCopySuccess?.('Transaction hash copied to clipboard!', 'Copied');
      setTimeout(() => setCopied(false), 1800);
    } catch (_) {}
  };

  return createPortal(
    <div
      className="avm-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Official Audit Voucher"
    >
      <div className={`avm-card ${toneClass} fade-in`} onClick={(e) => e.stopPropagation()}>

        {/* ── 1. Compact Header ── */}
        <div className="avm-head">
          <div className="avm-head-left">
            <div className={`avm-seal-icon ${toneClass}`}>
              <span className="material-symbols-outlined">
                {isShortage ? 'gpp_bad' : isOverCredit ? 'info' : 'verified'}
              </span>
            </div>
            <div className="avm-head-copy">
              <div className="avm-title-row">
                <h3 className="avm-title">Official Audit Voucher</h3>
                <span className="avm-id-chip">ID #{tx.id || 'ON-CHAIN'}</span>
              </div>
              <p className="avm-sub">
                {isShortage
                  ? 'Discrepancy Flagged · Sealed in Immutable Public Ledger'
                  : 'BBDRTS Humanitarian Protocol · Blockchain Audited'}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="avm-close-btn"
            onClick={onClose}
            aria-label="Close Official Audit Voucher"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* ── 2. Amount & Verification Hero Surface ── */}
        <div className={`avm-hero ${toneClass}`}>
          <div className="avm-hero-top">
            <span className={`avm-status-pill ${toneClass}`}>
              <span className="avm-status-dot" />
              <span>
                {isShortage
                  ? 'Audit Shortage Flagged'
                  : isOverCredit
                    ? `Over-Credited (+₱${Math.abs(variancePhp).toLocaleString('en-US')})`
                    : 'Verified On-Chain Transaction'}
              </span>
            </span>

            <span className="avm-network-pill">
              <span className="material-symbols-outlined">shield</span>
              <span>Gasless Sepolia Seal</span>
            </span>
          </div>

          <div className="avm-hero-amount-row">
            <div className="avm-amount-block">
              <span className="avm-amount-label">
                {isShortage ? 'Credited Amount (Altered by NGO)' : 'Total Verified Contribution'}
              </span>
              <div className={`avm-amount-val ${toneClass}`}>
                <span className="avm-amount-sign">+₱</span>
                <span>{Number(amtPhp || 0).toLocaleString('en-US')}</span>
                <span className="avm-amount-currency">PHP</span>
              </div>
            </div>

            <div className={`avm-rail-pill ${rail.cls}`}>
              <span className="material-symbols-outlined">{rail.icon}</span>
              <span>{rail.label}</span>
            </div>
          </div>
        </div>

        {/* ── Perforated Voucher Divider ── */}
        <div className="avm-perforation" aria-hidden="true">
          <span className="avm-notch left" />
          <span className="avm-dashed-line" />
          <span className="avm-notch right" />
        </div>

        {/* ── 3. Body: Optional Discrepancy Breakdown + Bento Ledger + Hash ── */}
        <div className="avm-body">

          {hasVariance && (
            <div className={`avm-variance-box ${isShortage ? 'is-shortage' : 'is-overcredit'}`}>
              <div className="avm-variance-head">
                <span className="material-symbols-outlined">rule</span>
                <span>Tamper-Proof Audit Discrepancy Breakdown</span>
              </div>
              <div className="avm-variance-grid">
                <div className="avm-variance-cell">
                  <span className="avm-var-lbl">Declared by Donor</span>
                  <strong className="avm-var-val">₱{Number(declaredPhp || 0).toLocaleString('en-US')}</strong>
                </div>
                <div className="avm-variance-cell">
                  <span className="avm-var-lbl">Credited by NGO</span>
                  <strong className={`avm-var-val ${isShortage ? 'is-danger' : 'is-warn'}`}>
                    ₱{Number(amtPhp || 0).toLocaleString('en-US')}
                  </strong>
                </div>
                <div className="avm-variance-cell">
                  <span className="avm-var-lbl">On-Chain Variance</span>
                  <strong className={`avm-var-val ${isShortage ? 'is-danger' : 'is-warn'}`}>
                    {variancePhp < 0
                      ? `-₱${Math.abs(variancePhp).toLocaleString('en-US')}`
                      : `+₱${Math.abs(variancePhp).toLocaleString('en-US')}`}
                  </strong>
                </div>
              </div>
              <p className="avm-variance-note">
                {isShortage
                  ? 'The beneficiary organization verified this slip with a shortage relative to the contributor\'s declared payment. This variance is permanently sealed on Ethereum Sepolia.'
                  : 'The beneficiary organization credited additional funds beyond the contributor\'s initial declaration.'}
              </p>
            </div>
          )}

          {/* Structured Geist Bento Details */}
          <div className="avm-bento">
            <div className="avm-bento-row is-full">
              <div className="avm-cell-head">
                <span className="material-symbols-outlined">campaign</span>
                <span>Relief Campaign</span>
              </div>
              <div className="avm-cell-val is-campaign">{campTitle}</div>
            </div>

            <div className="avm-bento-grid-2">
              <div className="avm-bento-cell">
                <div className="avm-cell-head">
                  <span className="material-symbols-outlined">domain</span>
                  <span>Beneficiary NGO</span>
                </div>
                <div className="avm-cell-val">{orgDisplayName}</div>
              </div>

              <div className="avm-bento-cell">
                <div className="avm-cell-head">
                  <span className="material-symbols-outlined">person</span>
                  <span>Contributor / Donor</span>
                </div>
                <div className="avm-cell-val">{donorDisplay}</div>
              </div>
            </div>

            <div className="avm-bento-grid-2">
              <div className="avm-bento-cell">
                <div className="avm-cell-head">
                  <span className="material-symbols-outlined">schedule</span>
                  <span>Recorded Timestamp</span>
                </div>
                <div className="avm-cell-val is-muted">{formatVoucherTimestamp(tx.createdAt)}</div>
              </div>

              <div className="avm-bento-cell">
                <div className="avm-cell-head">
                  <span className="material-symbols-outlined">receipt</span>
                  <span>{refCode ? 'Payment Reference' : 'Platform Commission'}</span>
                </div>
                <div className={`avm-cell-val ${refCode ? 'is-mono' : 'is-emerald'}`}>
                  {refCode || '0% Fee · 100% Direct Aid'}
                </div>
              </div>
            </div>
          </div>

          {/* Cryptographic On-Chain Hash Proof */}
          {tx.txHash && (
            <div className="avm-hash-section">
              <div className="avm-hash-head">
                <span className="avm-hash-label">
                  <span className="material-symbols-outlined">fingerprint</span>
                  <span>Cryptographic Transaction Hash</span>
                </span>
                <span className="avm-hash-net">Ethereum Sepolia</span>
              </div>

              <div className="avm-hash-box">
                <code className="avm-hash-code" title={tx.txHash}>{tx.txHash}</code>
                <button
                  type="button"
                  className={`avm-copy-btn ${copied ? 'is-copied' : ''}`}
                  onClick={handleCopyHash}
                >
                  <span className="material-symbols-outlined">
                    {copied ? 'check' : 'content_copy'}
                  </span>
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* ── 4. Executive Footer Actions ── */}
        <div className="avm-foot">
          <div className="avm-foot-seal">
            <span className="material-symbols-outlined">verified_user</span>
            <span>Immutable On-Chain Receipt</span>
          </div>

          <div className="avm-foot-actions">
            <button type="button" className="avm-btn-secondary" onClick={onPrint}>
              <span className="material-symbols-outlined">print</span>
              <span>Print Voucher</span>
            </button>

            {hasEtherscan && (
              <a
                href={`https://sepolia.etherscan.io/tx/${tx.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="avm-btn-secondary"
              >
                <span>Etherscan</span>
                <span className="material-symbols-outlined">open_in_new</span>
              </a>
            )}

            <button type="button" className="avm-btn-primary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}
