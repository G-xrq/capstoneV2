import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './ConfirmDonationModal.css';

export default function ConfirmDonationModal({
  donation,
  confirmedAmountPhp,
  setConfirmedAmountPhp,
  confirmedRefNo,
  setConfirmedRefNo,
  checkAccountVerified,
  setCheckAccountVerified,
  checkAmountMatched,
  setCheckAmountMatched,
  submitting,
  formatImageSrc,
  onClose,
  onReject,
  onConfirm,
  onPreviewReceipt
}) {
  const [broadcastStep, setBroadcastStep] = useState(1);
  const [varianceReason, setVarianceReason] = useState('');
  const [checkVarianceAck, setCheckVarianceAck] = useState(false);

  useEffect(() => {
    setVarianceReason('');
    setCheckVarianceAck(false);
  }, [donation?.Manual_ID]);

  useEffect(() => {
    if (!donation || submitting) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [donation, submitting, onClose]);

  useEffect(() => {
    if (!submitting) {
      setBroadcastStep(1);
      return;
    }
    setBroadcastStep(1);
    const timer = setTimeout(() => {
      setBroadcastStep(2);
    }, 3200);
    return () => clearTimeout(timer);
  }, [submitting]);

  if (!donation) return null;

  const pmUpper = String(donation.Payment_Method || 'Bank / Card').toUpperCase();
  const isGcash = pmUpper.includes('GCASH');
  const isMaya = pmUpper.includes('MAYA') || pmUpper.includes('PAYMAYA');
  const railLabel = isGcash ? 'GCash' : isMaya ? 'Maya' : (donation.Payment_Method || 'Bank / Card');
  const railToneClass = isGcash ? 'is-gcash' : isMaya ? 'is-maya' : 'is-bank';

  const rawAmt = parseFloat(donation.Amount || 0);
  const claimedAmountPhp = Number(donation.Amount_PHP || donation.amountPhp) > 0
    ? Math.round(Number(donation.Amount_PHP || donation.amountPhp))
    : (rawAmt > 100 ? Math.round(rawAmt) : Math.round(rawAmt * 170000));

  const maxRailCapPhp = (isGcash || isMaya) ? 500000 : 5000000;
  const hasEntered = String(confirmedAmountPhp ?? '').trim() !== '';
  const enteredAmountNum = Number.isFinite(parseFloat(confirmedAmountPhp)) ? parseFloat(confirmedAmountPhp) : 0;
  const diffPhp = enteredAmountNum - claimedAmountPhp;
  const exceedsRailCap = enteredAmountNum > maxRailCapPhp;
  const isInvalidOrZero = !hasEntered || enteredAmountNum <= 0;
  const isBlocked = isInvalidOrZero || exceedsRailCap;
  const isOverCredit = !isBlocked && claimedAmountPhp > 0 && diffPhp >= 0.01;
  const isShortage = !isBlocked && claimedAmountPhp > 0 && diffPhp <= -0.01;
  const isAccountableVariance = isShortage || isOverCredit;
  const hasVariance = isBlocked || isAccountableVariance;
  const absDiff = Math.abs(Math.round(diffPhp * 100) / 100);

  const ai = donation.ai_result || {};
  const flags = Array.isArray(ai.fraudFlags) ? ai.fraudFlags : [];
  const hasFlag = flags.length > 0 || ai.isAiVerified === false;
  const aiScore = ai.confidenceScore ? Math.round(ai.confidenceScore) : null;

  const trimmedVarianceReason = varianceReason.trim();
  const varianceRequirementMet = !isAccountableVariance || (trimmedVarianceReason.length >= 5 && checkVarianceAck);
  const canConfirm = Boolean(checkAccountVerified && checkAmountMatched && !isBlocked && varianceRequirementMet);

  const quickVarianceReasons = isShortage
    ? [
        'Official statement shows lower amount received',
        'Donor mistyped receipt amount on submission',
        'Transfer or bank processing fee was deducted'
      ]
    : [
        'Official statement confirms higher amount received',
        'Donor under-declared actual transfer amount',
        'AI OCR misread the receipt amount'
      ];
  const displayRef = (confirmedRefNo || donation.Reference_Number || ai.extractedRef || '').trim();
  const formattedEntered = Math.round(enteredAmountNum).toLocaleString('en-US');

  const handleAmountChange = (rawVal) => {
    const cleaned = String(rawVal ?? '').replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const intPart = (parts[0] || '').slice(0, 7); // Max 7 integer digits (up to ₱9,999,999)
    const decPart = parts.length > 1 ? '.' + parts.slice(1).join('').slice(0, 2) : '';
    setConfirmedAmountPhp(intPart + decPart);
  };

  return createPortal(
    <div
      className="cdm-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={submitting ? 'Recording to Blockchain Ledger' : 'Confirm Received Donation'}
      onClick={() => {
        if (!submitting) onClose?.();
      }}
    >
      <div
        className={`cdm-dialog${submitting ? ' is-submitting' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {submitting ? (
          <>
            <div className="cdm-submit-view">
              <div className="cdm-net-pill">
                <span className="cdm-net-dot" />
                <span>Sepolia EVM · Notarizing</span>
              </div>

              <div className="cdm-orbital" aria-hidden="true">
                <div className="cdm-orbital-track" />
                <div className="cdm-orbital-core">
                  <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>verified_user</span>
                </div>
              </div>

              <h3 className="cdm-submit-title">Recording to Blockchain Ledger</h3>
              <p className="cdm-submit-sub">
                Writing cryptographic donation proof onto Sepolia and updating the campaign balance.
              </p>

              <div className="cdm-tx-card">
                <div className="cdm-tx-row">
                  <span className="cdm-tx-key">Confirmed Value</span>
                  <div className="cdm-tx-amount-group">
                    <span className={`cdm-rail-chip ${railToneClass}`}>{railLabel}</span>
                    <span className="cdm-tx-amount">₱{formattedEntered}</span>
                  </div>
                </div>
                <div className="cdm-tx-row">
                  <span className="cdm-tx-key">Reference No.</span>
                  <span className="cdm-tx-val is-mono" title={displayRef || 'Manual Attestation'}>
                    {displayRef || 'Manual Attestation'}
                  </span>
                </div>
                <div className="cdm-tx-row">
                  <span className="cdm-tx-key">Campaign</span>
                  <span className="cdm-tx-val" title={donation.Campaign_Title}>
                    {donation.Campaign_Title}
                  </span>
                </div>
              </div>

              <div className="cdm-stepper">
                <div className="cdm-step is-done">
                  <span className="cdm-step-icon">
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check_circle</span>
                  </span>
                  <span>NGO financial officer attestation verified</span>
                </div>

                <div className={`cdm-step ${broadcastStep >= 2 ? 'is-done' : 'is-active'}`}>
                  <span className="cdm-step-icon">
                    {broadcastStep >= 2 ? (
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check_circle</span>
                    ) : (
                      <span className="cdm-step-spinner" />
                    )}
                  </span>
                  <span>Broadcasting state transition to Ethereum Sepolia EVM</span>
                </div>

                <div className={`cdm-step ${broadcastStep >= 2 ? 'is-active' : ''}`}>
                  <span className="cdm-step-icon">
                    {broadcastStep >= 2 ? (
                      <span className="cdm-step-spinner" />
                    ) : (
                      <span className="cdm-step-dot" />
                    )}
                  </span>
                  <span>Awaiting block confirmation &amp; issuing digital receipt</span>
                </div>
              </div>
            </div>

            <div className="cdm-submit-foot">
              Finalizing on-chain record — please keep this window open until confirmation completes.
            </div>
          </>
        ) : (
          <>
            {/* Header */}
            <div className="cdm-header">
              <div className="cdm-header-left">
                <div className="cdm-header-icon" aria-hidden="true">
                  <span className="material-symbols-outlined" style={{ fontSize: '19px' }}>fact_check</span>
                </div>
                <div className="cdm-header-copy">
                  <div className="cdm-title-row">
                    <h3 className="cdm-title">Confirm Received Donation</h3>
                    <span className={`cdm-rail-chip ${railToneClass}`}>{railLabel}</span>
                    {aiScore !== null && (
                      <span
                        className={`cdm-ai-chip ${hasFlag ? 'is-warn' : 'is-ok'}`}
                        title={ai.summary || 'AI Receipt Audit'}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
                          {hasFlag ? 'warning' : 'verified'}
                        </span>
                        <span>{hasFlag ? 'AI Flagged' : `AI Verified · ${aiScore}%`}</span>
                      </span>
                    )}
                  </div>
                  <p className="cdm-subtitle">
                    Cross-reference the transfer slip against your official {railLabel} statement before recording.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="cdm-close-btn"
                onClick={onClose}
                title="Close"
                aria-label="Close modal"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
              </button>
            </div>

            {/* Body */}
            <div className="cdm-body">
              {/* Left Column: Receipt & Metadata */}
              <div className="cdm-col-left">
                <div className="cdm-receipt-card">
                  <div className="cdm-receipt-toolbar">
                    <span className="cdm-receipt-label">Transfer Receipt</span>
                    {donation.Receipt_Base64 && (
                      <div className="cdm-receipt-tools">
                        <button
                          type="button"
                          className="cdm-tool-btn"
                          onClick={() => onPreviewReceipt?.({ img: donation.Receipt_Base64, donation })}
                        >
                          <span className="material-symbols-outlined">zoom_in</span>
                          <span>Expand</span>
                        </button>
                        <a
                          href={formatImageSrc(donation.Receipt_Base64)}
                          download={`receipt_${donation.Manual_ID}.png`}
                          className="cdm-tool-btn"
                        >
                          <span className="material-symbols-outlined">download</span>
                          <span>Save</span>
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="cdm-receipt-stage">
                    {donation.Receipt_Base64 ? (
                      <img
                        src={formatImageSrc(donation.Receipt_Base64)}
                        alt="Uploaded transfer receipt"
                        className="cdm-receipt-img"
                        onClick={() => onPreviewReceipt?.({ img: donation.Receipt_Base64, donation })}
                        title="Click to inspect full size"
                      />
                    ) : (
                      <div className="cdm-receipt-empty">
                        <span className="material-symbols-outlined" style={{ fontSize: '32px', opacity: 0.45 }}>
                          receipt_long
                        </span>
                        <span>No receipt image attached</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="cdm-meta-card">
                  <div className="cdm-meta-row">
                    <span className="cdm-meta-key">Donor</span>
                    <span className="cdm-meta-val is-donor" title={donation.Donor_Name || 'Anonymous Supporter'}>
                      <span className="cdm-meta-dot" />
                      <span>{donation.Donor_Name || 'Anonymous Supporter'}</span>
                    </span>
                  </div>
                  <div className="cdm-meta-row">
                    <span className="cdm-meta-key">Campaign</span>
                    <span className="cdm-meta-val" title={donation.Campaign_Title}>
                      {donation.Campaign_Title}
                    </span>
                  </div>
                  <div className="cdm-meta-row">
                    <span className="cdm-meta-key">Declared</span>
                    <span className="cdm-meta-val is-amount">
                      ₱{claimedAmountPhp.toLocaleString('en-US')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Verification Controls */}
              <div className="cdm-col-right">
                <div className="cdm-notice">
                  <span className="material-symbols-outlined cdm-notice-icon">verified_user</span>
                  <div>
                    <span className="cdm-notice-title">Account Check Required:</span>{' '}
                    Verify that funds physically settled in your official <strong>{railLabel}</strong> account statement before minting on-chain.
                  </div>
                </div>

                {/* Actual Amount Received */}
                <div className="cdm-field">
                  <div className="cdm-field-head">
                    <label
                      htmlFor="cdm-amount-input"
                      className={`cdm-label${hasVariance ? ' is-error' : ''}`}
                    >
                      Actual Amount Received <span className="cdm-req">*</span>
                    </label>
                    <span className="cdm-label-hint">Gasless Sepolia Notarization</span>
                  </div>

                  <div className="cdm-input-wrap">
                    <span className={`cdm-input-prefix${hasVariance ? ' is-error' : ''}`}>₱</span>
                    <input
                      id="cdm-amount-input"
                      type="text"
                      inputMode="decimal"
                      value={confirmedAmountPhp}
                      onKeyDown={(e) => {
                        if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                      }}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      placeholder={String(claimedAmountPhp || 100)}
                      className={`cdm-input is-amount${hasVariance ? ' is-error' : ''}`}
                    />
                    <span className="cdm-input-suffix">PHP</span>
                  </div>

                  {hasVariance && (
                    <div
                      role="alert"
                      className={`cdm-variance-alert ${isBlocked ? 'is-blocked' : isOverCredit ? 'is-overcredit' : 'is-shortage'}`}
                    >
                      <div className="cdm-variance-head">
                        <span className="cdm-variance-badge">
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                            {isBlocked ? 'block' : 'gpp_maybe'}
                          </span>
                          <span>
                            {exceedsRailCap
                              ? `BLOCKED · EXCEEDS ${railLabel.toUpperCase()} LIMIT`
                              : isInvalidOrZero
                                ? 'INVALID AMOUNT'
                                : isOverCredit
                                  ? `AUDIT DISCREPANCY · OVER-CREDIT (+₱${absDiff.toLocaleString()})`
                                  : `AUDIT DISCREPANCY · SHORTAGE (-₱${absDiff.toLocaleString()})`}
                          </span>
                        </span>
                        {!isInvalidOrZero && (
                          <span className="cdm-variance-diff-pill">
                            Declared ₱{claimedAmountPhp.toLocaleString()} → Credited ₱{enteredAmountNum.toLocaleString()}
                          </span>
                        )}
                      </div>

                      {isBlocked ? (
                        <p className="cdm-variance-body">
                          {exceedsRailCap ? (
                            <>
                              Entered amount exceeds the maximum single-transfer ceiling of{' '}
                              <strong>₱{maxRailCapPhp.toLocaleString()}</strong> for <strong>{railLabel}</strong>. Enter the verified amount within the channel limit or restore the declared figure.
                            </>
                          ) : (
                            <>Enter a valid received amount greater than <strong>₱0</strong> (up to the <strong>₱{maxRailCapPhp.toLocaleString()}</strong> {railLabel} limit).</>
                          )}
                        </p>
                      ) : (
                        <>
                          <p className="cdm-variance-body">
                            You may adjust the credited figure to match what physically settled in your official {railLabel} statement. Saving{' '}
                            <strong>₱{enteredAmountNum.toLocaleString()}</strong> instead of declared{' '}
                            <strong>₱{claimedAmountPhp.toLocaleString()}</strong> triggers mandatory audit safeguards:
                          </p>
                          <ul className="cdm-variance-list">
                            <li>
                              <strong>Permanent Sepolia Flag:</strong>{' '}
                              <code>{isShortage ? 'ALERT_SHORTAGE' : 'ALERT_OVER_CREDIT'}</code> (Declared vs. Credited) is permanently notarized on-chain.
                            </li>
                            <li>
                              <strong>Instant Security Alerts:</strong> Both the donor and BBDRTS Governance Admins receive your audit note immediately.
                            </li>
                            <li>
                              <strong>Dispute &amp; Statement Review:</strong> The donor may file an Audit Dispute requiring your official {railLabel} statement as proof.
                            </li>
                          </ul>

                          <div className="cdm-variance-reason-box">
                            <div className="cdm-variance-reason-head">
                              <label htmlFor="cdm-variance-reason" className="cdm-variance-reason-label">
                                Audit Justification <span className="cdm-req">*</span>
                              </label>
                              <span className="cdm-variance-reason-count">{varianceReason.length} / 200</span>
                            </div>
                            <div className="cdm-variance-chips">
                              {quickVarianceReasons.map((preset) => (
                                <button
                                  key={preset}
                                  type="button"
                                  className={`cdm-variance-chip${varianceReason === preset ? ' is-active' : ''}`}
                                  onClick={() => setVarianceReason(preset)}
                                >
                                  {preset}
                                </button>
                              ))}
                            </div>
                            <input
                              id="cdm-variance-reason"
                              type="text"
                              maxLength={200}
                              value={varianceReason}
                              onChange={(e) => setVarianceReason(e.target.value)}
                              placeholder="Explain why the received amount differs from the donor's declared figure..."
                              className="cdm-variance-reason-input"
                            />
                          </div>

                          <label className={`cdm-variance-ack${checkVarianceAck ? ' is-checked' : ''}`}>
                            <input
                              type="checkbox"
                              checked={checkVarianceAck}
                              onChange={(e) => setCheckVarianceAck(e.target.checked)}
                            />
                            <span>
                              I acknowledge this {isShortage ? 'shortage' : 'over-credit'} adjustment will be permanently flagged on Sepolia and reported to the donor and Admins.
                            </span>
                          </label>
                        </>
                      )}

                      <div className="cdm-variance-actions">
                        <button
                          type="button"
                          className="cdm-restore-btn"
                          onClick={() => {
                            setConfirmedAmountPhp(String(claimedAmountPhp));
                            setVarianceReason('');
                            setCheckVarianceAck(false);
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>undo</span>
                          <span>Restore ₱{claimedAmountPhp.toLocaleString()}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="cdm-field-foot">
                    <span>
                      Credited to campaign:{' '}
                      <span className={hasVariance ? 'cdm-credit-err' : 'cdm-credit-ok'}>
                        ₱{formattedEntered}
                      </span>
                    </span>
                    <span>Matches declared: {hasVariance ? 'No' : 'Yes'}</span>
                  </div>
                </div>

                {/* Reference / Trace Number */}
                <div className="cdm-field">
                  <div className="cdm-field-head">
                    <label htmlFor="cdm-ref-input" className="cdm-label">
                      Reference / Trace No.
                    </label>
                    <span className="cdm-label-hint">Cross-reference code</span>
                  </div>
                  <input
                    id="cdm-ref-input"
                    type="text"
                    value={confirmedRefNo}
                    onChange={(e) => setConfirmedRefNo(e.target.value)}
                    placeholder="e.g. 6047 652 045344"
                    className="cdm-input"
                  />
                </div>

                {/* Attestation Checkboxes */}
                <div className="cdm-checks">
                  <label className={`cdm-check-tile${checkAccountVerified ? ' is-checked' : ''}`}>
                    <input
                      type="checkbox"
                      checked={checkAccountVerified}
                      onChange={(e) => setCheckAccountVerified(e.target.checked)}
                    />
                    <span>
                      I have checked our official <strong>{railLabel}</strong> account and confirmed receipt of these funds.
                    </span>
                  </label>

                  <label className={`cdm-check-tile${checkAmountMatched ? ' is-checked' : ''}`}>
                    <input
                      type="checkbox"
                      checked={checkAmountMatched}
                      onChange={(e) => setCheckAmountMatched(e.target.checked)}
                    />
                    <span>
                      The confirmed amount of <strong>₱{enteredAmountNum.toLocaleString()}</strong> accurately reflects what was credited to our organization.
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="cdm-footer">
              <button
                type="button"
                className="cdm-btn-reject"
                onClick={onReject}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>close</span>
                <span>Reject Slip</span>
              </button>

              <div className="cdm-footer-right">
                <button
                  type="button"
                  className="cdm-btn-cancel"
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={`cdm-btn-confirm${isAccountableVariance && canConfirm ? ' is-flagged' : ''}`}
                  onClick={() => onConfirm?.(isAccountableVariance ? trimmedVarianceReason : '')}
                  disabled={!canConfirm}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                    {isBlocked ? 'block' : isAccountableVariance ? 'gpp_maybe' : 'verified'}
                  </span>
                  <span>
                    {exceedsRailCap
                      ? 'Exceeds Rail Limit'
                      : isInvalidOrZero
                        ? 'Invalid Amount'
                        : isShortage
                          ? 'Record With Shortage Flag'
                          : isOverCredit
                            ? 'Record With Over-Credit Flag'
                            : 'Confirm & Record'}
                  </span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
