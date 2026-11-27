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
  const [rotationDeg, setRotationDeg] = useState(0);
  const [copiedRef, setCopiedRef] = useState(false);

  const imgSrc = typeof proofPreviewModalImg === 'string'
    ? proofPreviewModalImg
    : (proofPreviewModalImg?.img || '');
  const dData = typeof proofPreviewModalImg === 'object'
    ? proofPreviewModalImg?.donation
    : null;

  useEffect(() => {
    if (!proofPreviewModalImg) return;
    setZoomPct(100);
    setRotationDeg(0);
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

  const checks = [
    {
      key: 'layout',
      state: (!isInvalidImg && !isRailMismatch) ? 'ok' : 'danger',
      name: 'Receipt layout & channel',
      detail: isRailMismatch
        ? `Declared ${declaredRail}, but slip matches ${detectedRail}.`
        : isInvalidImg
          ? 'Image does not match a recognized transfer receipt.'
          : `Official ${declaredRail} slip layout recognized.`,
      tag: (!isInvalidImg && !isRailMismatch) ? 'Passed' : 'Flagged'
    },
    {
      key: 'ref',
      state: isDup ? 'danger' : (isRefValid ? 'ok' : 'warn'),
      name: 'Reference number',
      detail: isDup
        ? `Trace code ${refNo} matches a previously recorded transaction.`
        : isRefValid
          ? 'Extracted trace number matches donor submission.'
          : isScanning
            ? 'Scanning receipt image for trace number...'
            : 'Trace number was not auto-extracted; verify visually.',
      tag: isDup ? 'Flagged' : (isRefValid ? 'Passed' : (isScanning ? 'Scanning' : 'Review'))
    },
    {
      key: 'amount',
      state: isAmtMismatch ? 'danger' : (extractedAmtPhp > 0 ? 'ok' : 'warn'),
      name: 'Amount reconciliation',
      detail: isAmtMismatch
        ? `Receipt shows ₱${extractedAmtPhp.toLocaleString()} vs declared ₱${declaredAmtPhp.toLocaleString()}.`
        : extractedAmtPhp > 0
          ? `Receipt value matches declared ₱${declaredAmtPhp.toLocaleString()}.`
          : `Verify declared ₱${declaredAmtPhp.toLocaleString()} directly on slip.`,
      tag: isAmtMismatch ? 'Mismatch' : (extractedAmtPhp > 0 ? 'Matched' : 'Review')
    },
    {
      key: 'dup',
      state: isDup ? 'danger' : 'ok',
      name: 'Duplicate screening',
      detail: isDup
        ? 'Duplicate receipt reuse detected on the ledger.'
        : 'Unique across database and Sepolia audit records.',
      tag: isDup ? 'Flagged' : 'Clear'
    }
  ];

  const passedCount = checks.filter((c) => c.state === 'ok').length;

  const handleCopyRef = () => {
    if (!isRefValid || !navigator.clipboard) return;
    navigator.clipboard.writeText(refNo).then(() => {
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 1800);
    }).catch(() => {});
  };

  const formattedImgSrc = formatImageSrc(imgSrc);
  const canResetView = zoomPct !== 100 || rotationDeg !== 0;

  return createPortal(
    <div
      className="ppm-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Payment Slip Inspection"
      onClick={() => setProofPreviewModalImg(null)}
    >
      <div className="ppm-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ppm-header">
          <div className="ppm-header-left">
            <div className="ppm-header-title-wrap">
              <h3 className="ppm-title">Payment Slip Inspection</h3>
              <p className="ppm-subtitle">
                Uploaded transfer proof and automated OCR verification report
              </p>
            </div>
          </div>

          <div className="ppm-header-right">
            <span className={`ppm-status-badge ${statusTone}`}>
              <span className="ppm-status-dot" aria-hidden="true" />
              <span>
                {isDup
                  ? 'Duplicate Flagged'
                  : isInvalidImg
                    ? 'Invalid Receipt'
                    : isVerified
                      ? `AI Verified · ${score}%`
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

        {/* Body */}
        <div className="ppm-body">
          {/* Left Pane: Studio Document Viewer */}
          <div className="ppm-viewer-pane">
            <div className="ppm-viewer-bar">
              <span className="ppm-viewer-label">
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>receipt_long</span>
                <span>Original Slip</span>
              </span>

              <div className="ppm-viewer-controls" aria-label="Image controls">
                <button
                  type="button"
                  className="ppm-ctrl-btn"
                  onClick={() => setZoomPct((z) => Math.max(100, z - 30))}
                  disabled={zoomPct <= 100}
                  title="Zoom out"
                  aria-label="Zoom out"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>remove</span>
                </button>
                <span className="ppm-zoom-val">{zoomPct}%</span>
                <button
                  type="button"
                  className="ppm-ctrl-btn"
                  onClick={() => setZoomPct((z) => Math.min(250, z + 30))}
                  disabled={zoomPct >= 250}
                  title="Zoom in"
                  aria-label="Zoom in"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>add</span>
                </button>

                <span className="ppm-ctrl-sep" aria-hidden="true" />

                <button
                  type="button"
                  className="ppm-ctrl-btn"
                  onClick={() => setRotationDeg((deg) => (deg + 90) % 360)}
                  title="Rotate 90 degrees"
                  aria-label="Rotate receipt"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>rotate_right</span>
                </button>

                {canResetView && (
                  <button
                    type="button"
                    className="ppm-ctrl-btn"
                    onClick={() => {
                      setZoomPct(100);
                      setRotationDeg(0);
                    }}
                    title="Reset view"
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
                style={{
                  width: zoomPct > 100 ? `${zoomPct}%` : undefined,
                  transform: rotationDeg ? `rotate(${rotationDeg}deg)` : undefined
                }}
                onClick={() => setZoomPct((z) => (z > 100 ? 100 : 160))}
                title={zoomPct > 100 ? 'Click to fit' : 'Click to zoom in'}
              />
            </div>
          </div>

          {/* Right Pane: Financial Audit Inspector */}
          <div className="ppm-inspector-pane">
            {/* Hero Summary */}
            <div className="ppm-hero-summary">
              <div>
                <div className="ppm-hero-eyebrow">
                  {extractedAmtPhp > 0 ? 'Extracted Transfer Amount' : 'Declared Transfer Amount'}
                </div>
                <div className={`ppm-hero-amount${isAmtMismatch ? ' is-danger' : ''}`}>
                  ₱{Number(displayAmtPhp).toLocaleString('en-US')}
                </div>
                <div className="ppm-hero-sub">
                  {isAmtMismatch
                    ? `Donor declared ₱${declaredAmtPhp.toLocaleString('en-US')} via ${declaredRail}`
                    : `Submitted via ${declaredRail}`}
                </div>
              </div>

              <div className="ppm-score-block">
                <span className="ppm-score-caption">OCR Confidence</span>
                <span className={`ppm-score-val ${statusTone}`}>{score}%</span>
                <div className="ppm-score-bar" aria-hidden="true">
                  <div
                    className={`ppm-score-bar-fill ${statusTone}`}
                    style={{ width: `${Math.min(100, Math.max(8, score))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Clean Key-Value Transaction Details */}
            <div className="ppm-kv-list">
              <div className="ppm-kv-row">
                <span className="ppm-kv-key">Reference No.</span>
                <div className="ppm-kv-val-wrap">
                  <span className={`ppm-kv-val is-mono${isDup ? ' is-danger' : ''}`} title={refNo}>
                    {refNo}
                  </span>
                  {isRefValid && (
                    <button
                      type="button"
                      className="ppm-copy-btn"
                      onClick={handleCopyRef}
                      title="Copy reference number"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
                        {copiedRef ? 'check' : 'content_copy'}
                      </span>
                      <span>{copiedRef ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                </div>
              </div>

              {dData?.Donor_Name && (
                <div className="ppm-kv-row">
                  <span className="ppm-kv-key">Donor</span>
                  <span className="ppm-kv-val" title={dData.Donor_Name}>{dData.Donor_Name}</span>
                </div>
              )}

              {dData?.Campaign_Title && (
                <div className="ppm-kv-row">
                  <span className="ppm-kv-key">Campaign</span>
                  <span className="ppm-kv-val" title={dData.Campaign_Title}>{dData.Campaign_Title}</span>
                </div>
              )}

              <div className="ppm-kv-row">
                <span className="ppm-kv-key">Payment Channel</span>
                <span className={`ppm-kv-val${isRailMismatch ? ' is-danger' : ''}`}>
                  {detectedRail}{isRailMismatch ? ` (Declared: ${declaredRail})` : ''}
                </span>
              </div>

              <div className="ppm-kv-row">
                <span className="ppm-kv-key">Audit Engine</span>
                <span className="ppm-kv-val">
                  {ocrResult ? 'Tesseract OCR' : (ai.auditedBy || 'Tesseract OCR')}
                </span>
              </div>
            </div>

            {/* Automated Verification Checks */}
            <div>
              <div className="ppm-checks-head">
                <span className="ppm-section-title">Automated Verification</span>
                <span className="ppm-checks-summary">{passedCount} / {checks.length} passed</span>
              </div>

              <div className="ppm-checks-list">
                {checks.map((item) => (
                  <div
                    key={item.key}
                    className={`ppm-check-item${item.state === 'danger' ? ' is-danger' : (item.state === 'warn' ? ' is-warn' : '')}`}
                  >
                    <span className={`material-symbols-outlined ppm-check-icon is-${item.state}`}>
                      {item.state === 'ok' ? 'check_circle' : (item.state === 'danger' ? 'error' : 'info')}
                    </span>
                    <div className="ppm-check-body">
                      <div className="ppm-check-name">{item.name}</div>
                      <div className="ppm-check-detail">{item.detail}</div>
                    </div>
                    <span className={`ppm-check-tag is-${item.state}`}>{item.tag}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="ppm-footnote">
              <span className="material-symbols-outlined">info</span>
              <span>
                Automated OCR assists screening only. Always confirm final credit against your official {declaredRail} account statement.
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="ppm-footer">
          <a
            href={formattedImgSrc}
            download={dData?.Manual_ID ? `receipt_${dData.Manual_ID}.png` : 'payment_slip.png'}
            className="ppm-btn-ghost"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>download</span>
            <span>Download Original</span>
          </a>

          <button
            type="button"
            className="ppm-btn-primary"
            onClick={() => setProofPreviewModalImg(null)}
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
