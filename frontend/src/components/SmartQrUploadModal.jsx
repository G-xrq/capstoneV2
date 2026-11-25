import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import '../styles/SmartQrUploadModal.css';

const RAIL_OPTIONS = [
  { id: 'GCash', label: 'GCash', dot: 'gcash' },
  { id: 'Maya', label: 'Maya', dot: 'maya' },
  { id: 'Bank', label: 'Bank / InstaPay', dot: 'bank' }
];

export default function SmartQrUploadModal({
  isOpen,
  onClose,
  onSubmit,
  onFileUpload,
  onClearImage,
  method,
  setMethod,
  qrName,
  setQrName,
  accountName,
  setAccountName,
  accountNumber,
  setAccountNumber,
  qrImage,
  isDefault,
  setIsDefault,
  isCropping,
  isOcrExtracting,
  cropFeedback
}) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && !isCropping) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, isCropping, onClose]);

  if (!isOpen) return null;

  const triggerFilePicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFile = e.dataTransfer?.files?.[0];
    if (droppedFile && onFileUpload) {
      onFileUpload(droppedFile);
    }
  };

  const canSave = Boolean(qrImage && qrName.trim() && !isCropping);

  return createPortal(
    <div
      className="sqm-backdrop"
      onClick={() => !isCropping && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sqm-modal-title"
    >
      <div className="sqm-modal" onClick={(e) => e.stopPropagation()}>
        {/* Fixed Header */}
        <div className="sqm-header">
          <div className="sqm-header-left">
            <div className="sqm-header-icon">
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>qr_code_scanner</span>
            </div>
            <div>
              <h4 id="sqm-modal-title" className="sqm-title">Smart QR Auto-Crop &amp; Library Upload</h4>
              <p className="sqm-subtitle">
                Upload a phone screenshot — borders are auto-trimmed and recipient details extracted via OCR.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="sqm-close-btn"
            onClick={() => !isCropping && onClose()}
            aria-label="Close modal"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
          </button>
        </div>

        {/* Hidden Shared File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/*"
          onChange={onFileUpload}
          style={{ display: 'none' }}
        />

        <form className="sqm-form" onSubmit={onSubmit}>
          {/* Two-Column Split Body */}
          <div className="sqm-body">
            {/* Left Column: QR Dropzone / Extracted Preview Stage */}
            <div className="sqm-qr-stage">
              <div className="sqm-stage-label">
                <span>QR Code Matrix</span>
                {qrImage && (
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    Auto-cropped
                  </span>
                )}
              </div>

              {!qrImage ? (
                <div
                  className={`sqm-dropzone ${isDragging ? 'is-dragging' : ''}`}
                  onClick={triggerFilePicker}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      triggerFilePicker();
                    }
                  }}
                >
                  <div className="sqm-drop-icon">
                    <span className={`material-symbols-outlined ${isCropping ? 'spinning' : ''}`} style={{ fontSize: '24px' }}>
                      {isCropping ? 'progress_activity' : 'upload_file'}
                    </span>
                  </div>
                  <div className="sqm-drop-title">
                    {isCropping
                      ? 'Auto-Cropping Screenshot...'
                      : isDragging
                        ? 'Drop QR Screenshot Here'
                        : 'Upload or Drop QR Image'}
                  </div>
                  <div className="sqm-drop-hint">
                    GCash blue frames, Maya dark edges, and InstaPay borders are trimmed automatically.
                  </div>
                  <div className="sqm-format-tags">
                    <span className="sqm-format-tag">PNG</span>
                    <span className="sqm-format-tag">JPG</span>
                    <span className="sqm-format-tag">WEBP</span>
                  </div>
                </div>
              ) : (
                <div
                  className={`sqm-preview-card ${isDragging ? 'is-dragging' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="sqm-qr-frame">
                    <img src={qrImage} alt="Extracted QR Code" />
                  </div>

                  <div className={`sqm-status-pill ${isOcrExtracting || isCropping ? 'processing' : ''}`}>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                      {isOcrExtracting || isCropping ? 'hourglass_top' : 'check_circle'}
                    </span>
                    <span>
                      {isCropping
                        ? 'Cropping QR...'
                        : isOcrExtracting
                          ? 'Running OCR...'
                          : 'Pure QR Matrix Ready'}
                    </span>
                  </div>

                  {cropFeedback && <p className="sqm-crop-note">{cropFeedback}</p>}

                  <div className="sqm-preview-actions">
                    <button
                      type="button"
                      className="sqm-replace-btn"
                      onClick={triggerFilePicker}
                      disabled={isCropping}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>swap_horiz</span>
                      <span>Replace Image</span>
                    </button>
                    <button
                      type="button"
                      className="sqm-remove-btn"
                      onClick={() => onClearImage && onClearImage()}
                      disabled={isCropping}
                      title="Remove image"
                      aria-label="Remove image"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete_outline</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Payment Rail & Metadata Fields */}
            <div className="sqm-fields-col">
              <div className="sqm-field">
                <label className="sqm-label">Payment Method Rail</label>
                <div className="sqm-rail-grid" role="radiogroup" aria-label="Payment Method Rail">
                  {RAIL_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={method === opt.id}
                      className={`sqm-rail-btn ${method === opt.id ? 'active' : ''}`}
                      onClick={() => setMethod(opt.id)}
                    >
                      <span className={`sqm-rail-dot ${opt.dot}`} />
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="sqm-field">
                <div className="sqm-label-row">
                  <label className="sqm-label" htmlFor="sqm-id-name">
                    Custom QR Identifier Name *
                  </label>
                </div>
                <input
                  id="sqm-id-name"
                  type="text"
                  className="sqm-input"
                  value={qrName}
                  onChange={(e) => setQrName(e.target.value)}
                  placeholder={`e.g. Primary Disaster Relief ${method}`}
                  required
                />
              </div>

              <div className="sqm-field">
                <div className="sqm-label-row">
                  <label className="sqm-label" htmlFor="sqm-acct-name">
                    Account / Recipient Name
                  </label>
                  <span className="sqm-ocr-tag">OCR</span>
                </div>
                <input
                  id="sqm-acct-name"
                  type="text"
                  className="sqm-input"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="e.g. Philippine Red Cross – Maasin Chapter"
                />
              </div>

              <div className="sqm-field">
                <div className="sqm-label-row">
                  <label className="sqm-label" htmlFor="sqm-acct-num">
                    Account / Mobile Number
                  </label>
                  <span className="sqm-ocr-tag">OCR</span>
                </div>
                <input
                  id="sqm-acct-num"
                  type="text"
                  className="sqm-input mono"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="e.g. 0917 890 1430 or 1234-5678-9012"
                />
              </div>

              <div
                className="sqm-toggle-card"
                onClick={() => setIsDefault(!isDefault)}
                role="switch"
                aria-checked={isDefault}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setIsDefault(!isDefault);
                  }
                }}
              >
                <div className="sqm-toggle-text">
                  <span className="sqm-toggle-title">Set as Active Default Payout Rail</span>
                  <span className="sqm-toggle-desc">
                    Automatically shown to donors choosing {method === 'Bank' ? 'Bank / InstaPay' : method}.
                  </span>
                </div>
                <div className={`sqm-switch ${isDefault ? 'checked' : ''}`}>
                  <div className="sqm-switch-knob" />
                </div>
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="sqm-footer">
            <div className="sqm-footer-hint">
              <span
                className="material-symbols-outlined"
                style={{ fontSize: '15px', color: canSave ? '#10b981' : 'var(--text-muted)' }}
              >
                {canSave ? 'verified' : 'info'}
              </span>
              <span>
                {!qrImage
                  ? 'Upload a QR screenshot to continue'
                  : !qrName.trim()
                    ? 'Enter a QR identifier name'
                    : `Ready to save to ${method === 'Bank' ? 'Bank / InstaPay' : method} library`}
              </span>
            </div>

            <div className="sqm-footer-actions">
              <button
                type="button"
                className="sqm-btn-cancel"
                onClick={onClose}
                disabled={isCropping}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="sqm-btn-save"
                disabled={!canSave}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>bookmark_add</span>
                <span>Save to QR Library</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
