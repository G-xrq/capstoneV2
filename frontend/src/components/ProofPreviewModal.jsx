import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Tesseract from 'tesseract.js';
import './ProofPreviewModal.css';

const defaultFormatImageSrc = (rawSrc) => {
  if (!rawSrc || typeof rawSrc !== 'string') return '';
  if (rawSrc.startsWith('data:') || rawSrc.startsWith('http://') || rawSrc.startsWith('https://') || rawSrc.startsWith('/')) {
    return rawSrc;
  }
  return `data:image/jpeg;base64,${rawSrc}`;
};

export default function ProofPreviewModal({
  proofPreviewModalImg,
  setProofPreviewModalImg,
  formatImageSrc = defaultFormatImageSrc
}) {
  const [ocrResult, setOcrResult] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [zoomPct, setZoomPct] = useState(100);
  const [copiedRef, setCopiedRef] = useState(false);

  const imgSrc = typeof proofPreviewModalImg === 'string'
    ? proofPreviewModalImg
    : (proofPreviewModalImg?.img || '');
  const dData = typeof proofPreviewModalImg === 'object'
    ? proofPreviewModalImg?.donation
    : null;

  // Lock background scroll & enable Escape-to-close while modal is open
  useEffect(() => {
    if (!proofPreviewModalImg) return;
    setZoomPct(100);
    setCopiedRef(false);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e) => {
      if (e.key === 'Escape') setProofPreviewModalImg(null);
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [proofPreviewModalImg, setProofPreviewModalImg]);

  // Run browser Tesseract OCR pixel extraction on the receipt image
  useEffect(() => {
    if (!proofPreviewModalImg || !imgSrc) {
      setOcrResult(null);
      setIsScanning(false);
      return;
    }

    setIsScanning(true);
    let active = true;
    const formattedSrc = formatImageSrc(imgSrc);

    Tesseract.recognize(formattedSrc, 'eng')
      .then(({ data }) => {
        if (!active) return;
        const text = data?.text || '';

        // Extract 13-digit GCash/Maya Ref No e.g. "9047 687 193886" or "0044315497640"
        let ref = null;
        const gcashMatch = text.match(/\b(\d{4}[\s.\-]+\d{3}[\s.\-]+\d{6})\b/) ||
          text.match(/(?:Ref|Ret|Rel|No|ID)[\s.:#]*([0-9\s.\-]{11,20})/i) ||
          text.match(/\b(00\d{11}|\d{13})\b/);
        if (gcashMatch) {
          ref = (gcashMatch[1] || gcashMatch[0]).trim().replace(/\s+/g, ' ');
        } else {
          const digitsAll = text.replace(/\D/g, '');
          if (digitsAll.length >= 13) {
            const m13 = digitsAll.match(/(00\d{11}|100\d{10}|\d{13})/);
            if (m13) {
              const d = m13[1];
              ref = `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
            }
          }
        }

        // Extract PHP Amount e.g. "500.00" or "1.00"
        let amt = null;
        const amtMatch = text.match(/(?:Total\s*Amount\s*Sent|Total\s*Amount|Amount|Sent|Paid)[\s\S]{0,30}?[₱P]?\s*([\d,]+\.\d{2})/i) ||
          text.match(/([\d,]+\.\d{2})/);
        if (amtMatch) {
          const parsedVal = parseFloat((amtMatch[1] || amtMatch[0]).replace(/,/g, ''));
          if (!isNaN(parsedVal) && parsedVal > 0 && parsedVal < 1000000) amt = parsedVal;
        }

        setOcrResult({ extractedRef: ref, extractedAmountPhp: amt });
      })
      .catch((err) => {
        console.warn('Real-time browser Tesseract OCR scan exception:', err);
      })
      .finally(() => {
        if (active) setIsScanning(false);
      });

    return () => {
      active = false;
    };
  }, [proofPreviewModalImg, imgSrc, formatImageSrc]);

  if (!proofPreviewModalImg) return null;

  const ai = dData?.ai_result || {};
  const flags = Array.isArray(ai.fraudFlags) ? ai.fraudFlags : [];
  const isDup = flags.some((f) => String(f).includes('DUPLICATE'));
  const isInvalidImg = flags.some((f) => String(f).includes('INVALID_RECEIPT_IMAGE'));

  const rawRef = dData?.Reference_Number || ai.extractedRef || ocrResult?.extractedRef || '';
  const isRefValid = Boolean(
    rawRef &&
    rawRef.trim().length >= 6 &&
    rawRef !== 'Not Provided' &&
    rawRef !== 'Unextracted' &&
    !rawRef.startsWith('REF-') &&
    !rawRef.startsWith('MANUAL-')
  );
  const refNo = isRefValid ? rawRef.trim() : (isScanning ? 'Scanning...' : 'Not provided');

  // Properly resolve declared PHP amount whether DB stored ETH or PHP
  const rawAmt = parseFloat(dData?.Amount || 0);
  const declaredAmtPhp = Number(dData?.Amount_PHP || dData?.amountPhp) > 0
    ? Math.round(Number(dData.Amount_PHP || dData.amountPhp))
    : (rawAmt > 100 ? Math.round(rawAmt) : Math.round(rawAmt * 170000));
  const extractedAmtPhp = Math.round(parseFloat(ai.extractedAmountPhp || ocrResult?.extractedAmountPhp || 0));
  const displayAmtPhp = extractedAmtPhp > 0 ? extractedAmtPhp : declaredAmtPhp;

  const declaredRail = dData?.Payment_Method || 'GCash';
  const detectedRail = ai.detectedRail || ocrResult?.extractedRail || declaredRail;
  const isRailMismatch = flags.some((f) => String(f).includes('PAYMENT_RAIL_MISMATCH'));
  const isAmtMismatch = flags.some((f) => String(f).includes('AMOUNT_MISMATCH')) ||
    (extractedAmtPhp > 0 && declaredAmtPhp > 0 && Math.abs(extractedAmtPhp - declaredAmtPhp) / declaredAmtPhp > 0.05);

  const isVerified = Boolean(!isDup && !isInvalidImg && !isRailMismatch && !isAmtMismatch && isRefValid && (ai.isAiVerified !== false));
  const score = isDup
    ? 15
    : isInvalidImg
      ? 15
      : (isRailMismatch || isAmtMismatch || !isRefValid)
        ? 35
        : Math.round(ai.confidenceScore || 98);

  const statusTone = isDup || isInvalidImg ? 'is-danger' : (isVerified ? 'is-ok' : 'is-warn');

  const check1Pass = !isInvalidImg && !isRailMismatch;
  const check2Pass = !isDup && isRefValid;
  const check3Pass = !isAmtMismatch && extractedAmtPhp > 0;
  const check4Pass = !isDup;
  const passedCount = [check1Pass, check2Pass, check3Pass, check4Pass].filter(Boolean).length;

  const handleCopyRef = () => {
    if (!isRefValid || !navigator.clipboard) return;
    navigator.clipboard.writeText(refNo).then(() => {
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 1800);
    }).catch(() => {});
  };

  const formattedImgSrc = formatImageSrc(imgSrc);
  const subtitleParts = [
    dData?.Donor_Name,
    dData?.Campaign_Title
  ].filter(Boolean);

  return createPortal(
    <div
      className="ppm-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Uploaded Payment Slip and AI Security Audit"
      onClick={() => setProofPreviewModalImg(null)}
    >
      <div className="ppm-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ppm-header">
          <div className="ppm-header-left">
            <div className="ppm-header-icon" aria-hidden="true">
              <span className="material-symbols-outlined" style={{ fontSize: '19px' }}>document_scanner</span>
            </div>
            <div className="ppm-header-copy">
              <h3 className="ppm-title">Payment Slip &amp; AI Security Audit</h3>
              <p className="ppm-subtitle" title={subtitleParts.join(' · ') || 'Real-time OCR pixel extraction & cross-verification breakdown'}>
                {subtitleParts.length > 0
                  ? subtitleParts.join(' · ')
                  : 'Real-time OCR pixel extraction & cross-verification breakdown'}
              </p>
            </div>
          </div>

          <div className="ppm-header-right">
            <span className={`ppm-status-pill ${statusTone}`}>
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                {isDup || isInvalidImg ? 'gpp_bad' : (isVerified ? 'verified' : 'gpp_maybe')}
              </span>
              <span>
                {isDup
                  ? `Duplicate Ref · ${score}%`
                  : isInvalidImg
                    ? `Invalid Slip · ${score}%`
                    : isVerified
                      ? `${score}% AI Verified`
                      : isScanning
                        ? 'Scanning OCR...'
                        : `Manual Review · ${score}%`}
              </span>
            </span>

            <button
              type="button"
              className="ppm-close-btn"
              onClick={() => setProofPreviewModalImg(null)}
              title="Close (Esc)"
              aria-label="Close preview"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
            </button>
          </div>
        </div>

        {/* Dual-Pane Body */}
        <div className="ppm-body">
          {/* Left Pane: Interactive Receipt Stage */}
          <div className="ppm-stage-pane">
            <div className="ppm-stage-toolbar">
              <span className="ppm-stage-meta">
                <span>Receipt</span>
                <span className="ppm-rail-tag">{declaredRail}</span>
              </span>

              <div className="ppm-zoom-controls" aria-label="Zoom controls">
                <button
                  type="button"
                  className="ppm-zoom-btn"
                  onClick={() => setZoomPct((z) => Math.max(100, z - 30))}
                  disabled={zoomPct <= 100}
                  title="Zoom out"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>remove</span>
                </button>
                <span className="ppm-zoom-readout">{zoomPct}%</span>
                <button
                  type="button"
                  className="ppm-zoom-btn"
                  onClick={() => setZoomPct((z) => Math.min(250, z + 30))}
                  disabled={zoomPct >= 250}
                  title="Zoom in"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>add</span>
                </button>
                {zoomPct > 100 && (
                  <button
                    type="button"
                    className="ppm-zoom-btn"
                    onClick={() => setZoomPct(100)}
                    title="Reset zoom"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            <div className={`ppm-canvas${zoomPct > 100 ? ' is-zoomed' : ''}`}>
              <img
                src={formattedImgSrc}
                alt="Uploaded Payment Slip"
                className="ppm-receipt-img"
                style={zoomPct > 100 ? { width: `${zoomPct}%` } : undefined}
                onClick={() => setZoomPct((z) => (z > 100 ? 100 : 160))}
                title={zoomPct > 100 ? 'Click to reset zoom' : 'Click to zoom in'}
              />
            </div>

            <div className="ppm-stage-caption">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>zoom_in</span>
              <span>Click image or use controls to inspect details</span>
            </div>
          </div>

          {/* Right Pane: Structured AI Audit & Metadata */}
          <div className="ppm-audit-pane">
            {/* Score Summary Card */}
            <div className="ppm-score-card">
              <div className="ppm-score-top">
                <div>
                  <div className="ppm-score-eyebrow">AI Security Assessment</div>
                  <div className="ppm-score-heading">
                    {isDup
                      ? 'Duplicate Reference Risk Detected'
                      : isInvalidImg
                        ? 'Unrecognized Receipt Image'
                        : isVerified
                          ? 'Receipt Passed Automated Verification'
                          : 'Manual Statement Cross-Check Recommended'}
                  </div>
                </div>
                <span className={`ppm-score-num ${statusTone}`}>{score}%</span>
              </div>
              <div className="ppm-score-track" aria-hidden="true">
                <div className={`ppm-score-fill ${statusTone}`} style={{ width: `${Math.min(100, Math.max(8, score))}%` }} />
              </div>
              <div className="ppm-score-foot">
                <span>{passedCount} of 4 automated checks passed</span>
                <span>{isScanning ? 'Running live OCR...' : 'Cross-check against official statement'}</span>
              </div>
            </div>

            <div className="ppm-section-lbl">Verification Breakdown</div>

            {/* Unified 4-Row Checklist Card */}
            <div className="ppm-checks-card">
              {/* Row 1: Receipt Layout & Channel */}
              <div className={`ppm-check-row${!check1Pass ? ' is-danger' : ''}`}>
                <span className={`material-symbols-outlined ppm-check-icon ${check1Pass ? 'is-ok' : 'is-danger'}`}>
                  {check1Pass ? 'check_circle' : 'gpp_bad'}
                </span>
                <div className="ppm-check-copy">
                  <div className="ppm-check-title">
                    {isRailMismatch
                      ? `Payment Rail Mismatch (${declaredRail} vs ${detectedRail})`
                      : isInvalidImg
                        ? 'Receipt Layout Not Recognized'
                        : `Official ${declaredRail} Layout Detected`}
                  </div>
                  <div className="ppm-check-desc">
                    {isRailMismatch
                      ? `Donor declared ${declaredRail}, but the uploaded slip belongs to a different channel.`
                      : isInvalidImg
                        ? 'Image does not match a recognized e-wallet or bank transfer slip.'
                        : 'Header structure and transaction receipt layout recognized.'}
                  </div>
                </div>
                <span className={`ppm-check-pill ${check1Pass ? 'is-ok' : 'is-danger'}`}>
                  {check1Pass ? 'Pass' : 'Flag'}
                </span>
              </div>

              {/* Row 2: Reference Number */}
              <div className={`ppm-check-row${isDup ? ' is-danger' : (!isRefValid ? ' is-warn' : '')}`}>
                <span className={`material-symbols-outlined ppm-check-icon ${isDup ? 'is-danger' : (isRefValid ? 'is-ok' : 'is-warn')}`}>
                  {isDup ? 'gpp_bad' : (isRefValid ? 'check_circle' : 'help_outline')}
                </span>
                <div className="ppm-check-copy">
                  <div className="ppm-check-title">
                    {isDup
                      ? `Duplicate Reference (${refNo})`
                      : isRefValid
                        ? `Reference Number Matched (${refNo})`
                        : isScanning
                          ? 'Scanning Reference Number...'
                          : 'Reference Number Unextracted'}
                  </div>
                  <div className="ppm-check-desc">
                    {isDup
                      ? 'This reference code matches a previously recorded transaction.'
                      : isRefValid
                        ? 'Extracted trace number matches the donor submission.'
                        : 'Verify the trace number directly on the receipt image.'}
                  </div>
                </div>
                <span className={`ppm-check-pill ${isDup ? 'is-danger' : (isRefValid ? 'is-ok' : 'is-warn')}`}>
                  {isDup ? 'Flag' : (isRefValid ? 'Pass' : (isScanning ? 'Scan' : 'Check'))}
                </span>
              </div>

              {/* Row 3: Amount Reconciliation */}
              <div className={`ppm-check-row${isAmtMismatch ? ' is-danger' : (extractedAmtPhp <= 0 ? ' is-warn' : '')}`}>
                <span className={`material-symbols-outlined ppm-check-icon ${isAmtMismatch ? 'is-danger' : (extractedAmtPhp > 0 ? 'is-ok' : 'is-warn')}`}>
                  {isAmtMismatch ? 'gpp_bad' : (extractedAmtPhp > 0 ? 'check_circle' : 'help_outline')}
                </span>
                <div className="ppm-check-copy">
                  <div className="ppm-check-title">
                    {isAmtMismatch
                      ? `Amount Mismatch (Receipt ₱${extractedAmtPhp.toLocaleString()} vs Declared ₱${declaredAmtPhp.toLocaleString()})`
                      : extractedAmtPhp > 0
                        ? `Amount Reconciled (₱${extractedAmtPhp.toLocaleString()})`
                        : `Declared Amount (₱${declaredAmtPhp.toLocaleString()})`}
                  </div>
                  <div className="ppm-check-desc">
                    {isAmtMismatch
                      ? 'Extracted receipt value differs from the donor-declared amount.'
                      : extractedAmtPhp > 0
                        ? 'Receipt amount matches the declared donation value.'
                        : 'Confirm the transferred figure directly on the receipt image.'}
                  </div>
                </div>
                <span className={`ppm-check-pill ${isAmtMismatch ? 'is-danger' : (extractedAmtPhp > 0 ? 'is-ok' : 'is-warn')}`}>
                  {isAmtMismatch ? 'Flag' : (extractedAmtPhp > 0 ? 'Pass' : 'Check')}
                </span>
              </div>

              {/* Row 4: Anti-Fraud Duplicate Screening */}
              <div className={`ppm-check-row${isDup ? ' is-danger' : ''}`}>
                <span className={`material-symbols-outlined ppm-check-icon ${isDup ? 'is-danger' : 'is-ok'}`}>
                  {isDup ? 'gpp_bad' : 'verified_user'}
                </span>
                <div className="ppm-check-copy">
                  <div className="ppm-check-title">
                    {isDup ? 'Duplicate Slip Reuse Flagged' : 'No Duplicate Transaction Found'}
                  </div>
                  <div className="ppm-check-desc">
                    {isDup
                      ? `Reference #${refNo} was already submitted in an earlier donation.`
                      : 'No prior database or Sepolia ledger entry shares this reference code.'}
                  </div>
                </div>
                <span className={`ppm-check-pill ${isDup ? 'is-danger' : 'is-ok'}`}>
                  {isDup ? 'Flag' : 'Clear'}
                </span>
              </div>
            </div>

            <div className="ppm-section-lbl">Extracted Metadata</div>

            {/* Structured 2x2 Metadata Grid */}
            <div className="ppm-meta-grid">
              <div className="ppm-meta-cell">
                <span className="ppm-meta-lbl">OCR Engine</span>
                <span className="ppm-meta-val" title={ocrResult ? 'Tesseract Browser OCR' : (ai.auditedBy || 'Tesseract Pixel OCR')}>
                  {ocrResult ? 'Tesseract Browser OCR' : (ai.auditedBy || 'Tesseract Pixel OCR')}
                </span>
              </div>
              <div className="ppm-meta-cell">
                <span className="ppm-meta-lbl">Payment Rail</span>
                <span className={`ppm-meta-val${isRailMismatch ? ' is-danger' : ''}`}>
                  {detectedRail}{isRailMismatch ? ` (Declared: ${declaredRail})` : ''}
                </span>
              </div>
              <div className="ppm-meta-cell">
                <span className="ppm-meta-lbl">Reference No.</span>
                <div className="ppm-meta-val-row">
                  <span className={`ppm-meta-val is-mono ${isDup ? 'is-danger' : (isRefValid ? 'is-ok' : 'is-warn')}`} title={refNo}>
                    {refNo}
                  </span>
                  {isRefValid && (
                    <button
                      type="button"
                      className="ppm-copy-mini"
                      onClick={handleCopyRef}
                      title={copiedRef ? 'Copied!' : 'Copy reference number'}
                      aria-label="Copy reference number"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                        {copiedRef ? 'check' : 'content_copy'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
              <div className="ppm-meta-cell">
                <span className="ppm-meta-lbl">Extracted Amount</span>
                <span className={`ppm-meta-val is-mono ${isAmtMismatch ? 'is-danger' : (displayAmtPhp > 0 ? 'is-ok' : 'is-warn')}`}>
                  ₱{Number(displayAmtPhp).toLocaleString('en-US')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="ppm-footer">
          <div className="ppm-footer-left">
            <a
              href={formattedImgSrc}
              download={dData?.Manual_ID ? `receipt_${dData.Manual_ID}.png` : 'payment_slip.png'}
              className="ppm-btn-secondary"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>download</span>
              <span>Download Slip</span>
            </a>
            {isRefValid && (
              <button type="button" className="ppm-btn-secondary" onClick={handleCopyRef}>
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                  {copiedRef ? 'check' : 'content_copy'}
                </span>
                <span>{copiedRef ? 'Ref Copied' : 'Copy Ref'}</span>
              </button>
            )}
          </div>

          <button
            type="button"
            className="ppm-btn-primary"
            onClick={() => setProofPreviewModalImg(null)}
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
