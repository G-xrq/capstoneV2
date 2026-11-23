import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { applyFaceBlurBoxes, blurFacesInImage } from '../utils/facePrivacyBlur';
import './FaceBlurEditorModal.css';

const BRUSH_SIZES = [
  { key: 'S', label: 'S', sizeNorm: 42 },
  { key: 'M', label: 'M', sizeNorm: 66 },
  { key: 'L', label: 'L', sizeNorm: 102 }
];

export default function FaceBlurEditorModal({
  isOpen,
  title = 'Photo Privacy Touch-Up',
  originalUrl,
  initialUrl,
  initialBoxes = [],
  initialBlurred = false,
  onSave,
  onClose
}) {
  const [boxes, setBoxes] = useState([]);
  const [history, setHistory] = useState([]);
  const [renderedUrl, setRenderedUrl] = useState('');
  const [mode, setMode] = useState('add'); // 'add' | 'erase'
  const [brushKey, setBrushKey] = useState('M');
  const [showZones, setShowZones] = useState(true);
  const [showOriginal, setShowOriginal] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [imgRatio, setImgRatio] = useState(1.4);

  const imgRef = useRef(null);
  const renderSeqRef = useRef(0);

  // Sync state whenever modal opens for a photo
  useEffect(() => {
    if (!isOpen) return;
    const seedBoxes = Array.isArray(initialBoxes) ? initialBoxes.map((b) => ({ ...b })) : [];
    setBoxes(seedBoxes);
    setHistory([]);
    setRenderedUrl(initialBlurred && initialUrl ? initialUrl : (originalUrl || initialUrl || ''));
    setMode('add');
    setShowZones(true);
    setShowOriginal(false);
    setRendering(false);
    setScanning(false);
  }, [isOpen, originalUrl, initialUrl, initialBoxes, initialBlurred]);

  const reRenderBlur = useCallback(async (nextBoxes) => {
    const seq = ++renderSeqRef.current;
    if (!originalUrl) return;
    if (!nextBoxes || nextBoxes.length === 0) {
      setRenderedUrl(originalUrl);
      setRendering(false);
      return;
    }
    setRendering(true);
    try {
      const out = await applyFaceBlurBoxes(originalUrl, nextBoxes);
      if (seq === renderSeqRef.current) {
        setRenderedUrl(out);
      }
    } catch (err) {
      console.error('[FaceBlurEditor] Render failed:', err);
    } finally {
      if (seq === renderSeqRef.current) {
        setRendering(false);
      }
    }
  }, [originalUrl]);

  const commitBoxes = useCallback((nextBoxes) => {
    setHistory((prev) => [...prev.slice(-24), boxes]);
    setBoxes(nextBoxes);
    setShowOriginal(false);
    reRenderBlur(nextBoxes);
  }, [boxes, reRenderBlur]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const prevBoxes = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setBoxes(prevBoxes);
    setShowOriginal(false);
    reRenderBlur(prevBoxes);
  }, [history, reRenderBlur]);

  // Keyboard shortcuts: Esc to close, Ctrl+Z to undo
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose, handleUndo]);

  if (!isOpen || !originalUrl) return null;

  const activeBrush = BRUSH_SIZES.find((b) => b.key === brushKey) || BRUSH_SIZES[1];

  const handleImageClick = (e) => {
    if (scanning || showOriginal || mode !== 'add') return;
    const imgEl = imgRef.current;
    if (!imgEl) return;
    const rect = imgEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const clickX = ((e.clientX - rect.left) / rect.width) * 1000;
    const clickY = ((e.clientY - rect.top) / rect.height) * 1000;
    if (clickX < 0 || clickX > 1000 || clickY < 0 || clickY > 1000) return;

    // Aspect-ratio compensated oval so brush looks round/face-shaped regardless of photo aspect ratio
    const halfH = activeBrush.sizeNorm / 2;
    const halfW = (halfH / Math.max(0.45, Math.min(2.5, imgRatio))) * 0.88;

    const newBox = {
      xmin: Math.max(0, Math.round(clickX - halfW)),
      xmax: Math.min(1000, Math.round(clickX + halfW)),
      ymin: Math.max(0, Math.round(clickY - halfH)),
      ymax: Math.min(1000, Math.round(clickY + halfH)),
      score: 1,
      manual: true
    };
    commitBoxes([...boxes, newBox]);
  };

  const handleRemoveZone = (idx, e) => {
    e?.stopPropagation();
    const next = boxes.filter((_, i) => i !== idx);
    commitBoxes(next);
  };

  const handleAiRescan = async () => {
    if (scanning || !originalUrl) return;
    setScanning(true);
    try {
      const res = await blurFacesInImage(originalUrl);
      if (Array.isArray(res.boxes) && res.boxes.length > 0) {
        setHistory((prev) => [...prev.slice(-24), boxes]);
        setBoxes(res.boxes);
        setRenderedUrl(res.url);
        setShowOriginal(false);
      }
    } catch (err) {
      console.error('[FaceBlurEditor] AI rescan failed:', err);
    } finally {
      setScanning(false);
    }
  };

  const handleSave = () => {
    const hasBlur = boxes.length > 0;
    const finalBlurredUrl = hasBlur ? (renderedUrl || originalUrl) : null;
    onSave?.({
      url: hasBlur ? finalBlurredUrl : originalUrl,
      blurredUrl: finalBlurredUrl,
      boxes,
      facesBlurred: boxes.length,
      isBlurred: hasBlur
    });
    onClose?.();
  };

  const displayedSrc = showOriginal ? originalUrl : (renderedUrl || originalUrl);

  return createPortal(
    <div className="bbdrts-fbe-overlay" onClick={onClose}>
      <div className="bbdrts-fbe-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bbdrts-fbe-header">
          <div className="bbdrts-fbe-title-group">
            <div className="bbdrts-fbe-shield-icon">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>privacy_tip</span>
            </div>
            <div className="bbdrts-fbe-title-text">
              <strong>{title}</strong>
              <span>RA 10173 Privacy Touch-Up · Click any face to add blur or click × to remove</span>
            </div>
          </div>

          <div className="bbdrts-fbe-header-right">
            <span className={`bbdrts-fbe-count-pill ${boxes.length === 0 ? 'is-zero' : ''}`}>
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>blur_on</span>
              <span>{boxes.length} {boxes.length === 1 ? 'face' : 'faces'} blurred</span>
            </span>
            <button
              type="button"
              className="bbdrts-fbe-close"
              onClick={onClose}
              aria-label="Close privacy editor"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
            </button>
          </div>
        </div>

        {/* Interactive Toolbar */}
        <div className="bbdrts-fbe-toolbar">
          <div className="bbdrts-fbe-tool-group">
            <div className="bbdrts-fbe-segmented" role="group" aria-label="Touch-up tool mode">
              <button
                type="button"
                className={`bbdrts-fbe-seg-btn ${mode === 'add' ? 'active' : ''}`}
                onClick={() => { setMode('add'); setShowOriginal(false); }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>add_circle</span>
                <span>Tap to Blur</span>
              </button>
              <button
                type="button"
                className={`bbdrts-fbe-seg-btn ${mode === 'erase' ? 'active-erase' : ''}`}
                onClick={() => { setMode('erase'); setShowZones(true); setShowOriginal(false); }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>ink_eraser</span>
                <span>Remove Spot</span>
              </button>
            </div>

            {mode === 'add' && (
              <>
                <span className="bbdrts-fbe-size-label">Size:</span>
                {BRUSH_SIZES.map((b) => (
                  <button
                    key={b.key}
                    type="button"
                    className={`bbdrts-fbe-pill-btn bbdrts-fbe-size-btn ${brushKey === b.key ? 'is-active' : ''}`}
                    onClick={() => setBrushKey(b.key)}
                    title={`Blur brush size: ${b.label}`}
                  >
                    {b.label}
                  </button>
                ))}
              </>
            )}
          </div>

          <div className="bbdrts-fbe-tool-group">
            <button
              type="button"
              className="bbdrts-fbe-pill-btn"
              onClick={handleAiRescan}
              disabled={scanning}
              title="Run on-device AI crowd face detection again"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>auto_fix_high</span>
              <span>{scanning ? 'Scanning…' : 'AI Re-Scan'}</span>
            </button>

            <button
              type="button"
              className="bbdrts-fbe-pill-btn"
              onClick={handleUndo}
              disabled={history.length === 0}
              title="Undo last change (Ctrl+Z)"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>undo</span>
              <span>Undo</span>
            </button>

            <button
              type="button"
              className={`bbdrts-fbe-pill-btn ${showZones ? 'is-active' : ''}`}
              onClick={() => setShowZones((v) => !v)}
              title="Toggle blur outline guides"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                {showZones ? 'visibility' : 'visibility_off'}
              </span>
              <span>{showZones ? 'Guides On' : 'Guides Off'}</span>
            </button>

            <button
              type="button"
              className={`bbdrts-fbe-pill-btn ${showOriginal ? 'is-active' : ''}`}
              onClick={() => setShowOriginal((v) => !v)}
              title="Compare with original unblurred photo"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>compare</span>
              <span>{showOriginal ? 'Showing Original' : 'Original'}</span>
            </button>
          </div>
        </div>

        {/* Interactive Image Stage */}
        <div className="bbdrts-fbe-stage">
          <div
            className={`bbdrts-fbe-img-box ${mode === 'add' && !showOriginal ? 'mode-add' : 'mode-erase'}`}
            onClick={handleImageClick}
          >
            <img
              ref={imgRef}
              src={displayedSrc}
              alt={title}
              className="bbdrts-fbe-img"
              draggable={false}
              onLoad={(e) => {
                const nw = e.currentTarget.naturalWidth || 1;
                const nh = e.currentTarget.naturalHeight || 1;
                setImgRatio(nw / nh);
              }}
            />

            {showZones && !showOriginal && boxes.map((box, idx) => {
              const left = `${box.xmin / 10}%`;
              const top = `${box.ymin / 10}%`;
              const width = `${Math.max(1.4, (box.xmax - box.xmin) / 10)}%`;
              const height = `${Math.max(1.4, (box.ymax - box.ymin) / 10)}%`;
              return (
                <div
                  key={`${box.xmin}-${box.ymin}-${idx}`}
                  className={`bbdrts-fbe-zone ${box.manual ? 'is-manual' : ''}`}
                  style={{ left, top, width, height }}
                  onClick={(e) => {
                    if (mode === 'erase') {
                      handleRemoveZone(idx, e);
                    }
                  }}
                  title={mode === 'erase' ? 'Click to remove this blur spot' : (box.manual ? 'Manual blur spot' : 'AI-detected face')}
                >
                  <button
                    type="button"
                    className="bbdrts-fbe-zone-del"
                    onClick={(e) => handleRemoveZone(idx, e)}
                    title="Remove this blur spot"
                    aria-label="Remove blur spot"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>

          {(scanning || rendering) && (
            <div className="bbdrts-fbe-scanning-badge">
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>progress_activity</span>
              <span>{scanning ? 'AI scanning crowd faces…' : 'Applying smooth feather blur…'}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bbdrts-fbe-footer">
          <div className="bbdrts-fbe-hint">
            <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#10b981' }}>touch_app</span>
            <span>
              {showOriginal
                ? 'Viewing unblurred original — toggle Original off to edit blur spots.'
                : mode === 'add'
                  ? 'Tap any unblurred face on the photo to add a smooth radial privacy blur.'
                  : 'Click any dashed zone or its × button to remove an unwanted blur spot.'}
            </span>
          </div>

          <div className="bbdrts-fbe-footer-actions">
            <button type="button" className="bbdrts-fbe-btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="bbdrts-fbe-btn-save"
              onClick={handleSave}
              disabled={rendering || scanning}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check_circle</span>
              <span>Save Privacy Changes</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
