/**
 * BBDRTS — RA 10173 AI Face-Blur Privacy Utility
 *
 * Calls POST /api/privacy/detect-faces (Gemini Vision spatial bounding boxes)
 * and irreversibly blurs detected human faces on an offscreen HTML5 Canvas using
 * elliptical two-stage downscale-mosaic + Gaussian feathering so unblurred faces
 * are protected before publication on campaigns or relief disbursement proofs.
 */

import { API_URL } from '../config';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode image'));
    img.src = src;
  });
}

/**
 * Create a lightweight <= 1024px JPEG probe for ultra-fast Vision face detection.
 */
async function createDetectionProbe(dataUrl, maxDim = 1024) {
  const img = await loadImage(dataUrl);
  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    const ratio = Math.min(maxDim / width, maxDim / height);
    width = Math.max(1, Math.round(width * ratio));
    height = Math.max(1, Math.round(height * ratio));
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.74);
}

/**
 * Apply irreversible elliptical privacy blur over normalized 0..1000 face boxes
 * on the full-resolution image. Works across Chrome, Edge, Firefox, and iOS Safari.
 */
export async function applyFaceBlurBoxes(dataUrl, faces = [], options = {}) {
  if (!dataUrl || !Array.isArray(faces) || faces.length === 0) {
    return dataUrl;
  }

  const { padX = 0.14, padY = 0.18, quality = 0.85 } = options;
  const img = await loadImage(dataUrl);
  const W = img.naturalWidth || img.width;
  const H = img.naturalHeight || img.height;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, W, H);

  for (const box of faces) {
    const rawX = (box.xmin / 1000) * W;
    const rawY = (box.ymin / 1000) * H;
    const rawW = ((box.xmax - box.xmin) / 1000) * W;
    const rawH = ((box.ymax - box.ymin) / 1000) * H;
    if (rawW < 4 || rawH < 4) continue;

    const exW = rawW * (1 + padX * 2);
    const exH = rawH * (1 + padY * 2);
    const x = Math.max(0, Math.round(rawX - rawW * padX));
    const y = Math.max(0, Math.round(rawY - rawH * padY));
    const w = Math.min(W - x, Math.round(exW));
    const h = Math.min(H - y, Math.round(exH));
    if (w < 4 || h < 4) continue;

    // Stage 1: Irreversible downscale-upscale privacy destruction (100% Safari/mobile safe)
    const mosaicW = Math.max(5, Math.min(10, Math.round(w / 14)));
    const mosaicH = Math.max(5, Math.min(10, Math.round(h / 14)));

    const tiny = document.createElement('canvas');
    tiny.width = mosaicW;
    tiny.height = mosaicH;
    const tinyCtx = tiny.getContext('2d');
    tinyCtx.imageSmoothingEnabled = true;
    tinyCtx.drawImage(img, x, y, w, h, 0, 0, mosaicW, mosaicH);

    // Stage 2: Smooth elliptical blur blend
    const roi = document.createElement('canvas');
    roi.width = w;
    roi.height = h;
    const roiCtx = roi.getContext('2d');
    roiCtx.imageSmoothingEnabled = true;
    roiCtx.drawImage(tiny, 0, 0, mosaicW, mosaicH, 0, 0, w, h);

    const blurRadius = Math.max(6, Math.min(26, Math.round(Math.max(w, h) * 0.14)));

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w * 0.52, h * 0.52, 0, 0, Math.PI * 2);
    ctx.clip();

    // Draw smooth mosaic base first (guaranteed even if ctx.filter is ignored)
    ctx.drawImage(roi, x, y, w, h);

    // Overlay Gaussian blur pass for clean natural feathered look
    if ('filter' in ctx) {
      try {
        ctx.filter = `blur(${blurRadius}px)`;
        ctx.drawImage(roi, x - blurRadius, y - blurRadius, w + blurRadius * 2, h + blurRadius * 2);
        ctx.filter = 'none';
      } catch (_) {}
    }

    ctx.restore();
  }

  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Full pipeline: detect faces via Gemini Vision backend and return blurred image + metadata.
 * Gracefully falls back to original image if API is unavailable or image is a receipt/document.
 */
export async function blurFacesInImage(dataUrl, options = {}) {
  const { apiUrl = API_URL, token = null } = options;

  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/') || dataUrl.startsWith('data:image/svg')) {
    return {
      url: dataUrl,
      originalUrl: dataUrl,
      blurredUrl: null,
      facesBlurred: 0,
      blurred: false,
      boxes: [],
      isDocumentOrReceipt: true
    };
  }

  const authToken = token || (typeof localStorage !== 'undefined' ? (localStorage.getItem('bbdrts_token') || localStorage.getItem('token')) : null);

  try {
    const probeBase64 = await createDetectionProbe(dataUrl, 1024);
    const res = await fetch(`${apiUrl}/api/privacy/detect-faces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
      },
      body: JSON.stringify({ imageBase64: probeBase64 })
    });

    if (!res.ok) {
      throw new Error(`Face detection HTTP ${res.status}`);
    }

    const data = await res.json();
    const faces = Array.isArray(data.faces) ? data.faces : [];

    if (faces.length === 0) {
      return {
        url: dataUrl,
        originalUrl: dataUrl,
        blurredUrl: null,
        facesBlurred: 0,
        blurred: false,
        boxes: [],
        isDocumentOrReceipt: Boolean(data.isDocumentOrReceipt)
      };
    }

    const blurredUrl = await applyFaceBlurBoxes(dataUrl, faces);
    return {
      url: blurredUrl,
      originalUrl: dataUrl,
      blurredUrl,
      facesBlurred: faces.length,
      blurred: true,
      boxes: faces,
      isDocumentOrReceipt: false
    };
  } catch (err) {
    console.warn('[FacePrivacy] Fallback to original image:', err.message);
    return {
      url: dataUrl,
      originalUrl: dataUrl,
      blurredUrl: null,
      facesBlurred: 0,
      blurred: false,
      boxes: [],
      error: err.message
    };
  }
}
