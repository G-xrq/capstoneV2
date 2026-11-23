/**
 * BBDRTS — RA 10173 On-Device High-Recall AI Face-Blur Privacy Shield
 *
 * Primary Engine: Dual on-device MediaPipe BlazeFace WASM models
 *   1. blaze_face_full_range.tflite (192x192 dense crowd / wide-room model)
 *   2. blaze_face_short_range.tflite (128x128 close-up booster)
 * combined with multi-scale overlapping tiles, shadow/brightness-boosted crowd scan,
 * horizontal flip (side-profile recovery), and +/-18° tilt passes (reclining heads),
 * merged via Non-Maximum Suppression + radial-feathered Gaussian blur.
 *
 * Secondary Fallback: Backend Gemini Vision endpoint (POST /api/privacy/detect-faces)
 * only if WebAssembly fails to initialize.
 */

import { FilesetResolver, FaceDetector } from '@mediapipe/tasks-vision';
import { API_URL } from '../config';

const MEDIAPIPE_WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm';

const FULL_RANGE_LOCAL_URL = '/mediapipe/blaze_face_full_range.tflite';
const FULL_RANGE_CDN_URL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_full_range/float16/1/blaze_face_full_range.tflite';

const SHORT_RANGE_LOCAL_URL = '/mediapipe/blaze_face_short_range.tflite';
const SHORT_RANGE_CDN_URL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

let detectorsPromise = null;

async function createDetector(vision, urls, minConfidence) {
  for (const modelUrl of urls) {
    try {
      return await FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: modelUrl, delegate: 'CPU' },
        runningMode: 'IMAGE',
        minDetectionConfidence: minConfidence,
        minSuppressionThreshold: 0.28
      });
    } catch (err) {
      console.warn(`[FacePrivacy] Model load failed (${modelUrl}):`, err.message);
    }
  }
  return null;
}

/**
 * Lazily initialize & cache both on-device MediaPipe BlazeFace models (Full-Range + Short-Range).
 */
export function preloadFaceDetector() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (detectorsPromise) return detectorsPromise;

  detectorsPromise = (async () => {
    const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
    // Initialize sequentially — MediaPipe WASM can deadlock if two FaceDetectors instantiate concurrently.
    const fullRange = await createDetector(vision, [FULL_RANGE_LOCAL_URL, FULL_RANGE_CDN_URL], 0.22);
    const shortRange = await createDetector(vision, [SHORT_RANGE_LOCAL_URL, SHORT_RANGE_CDN_URL], 0.30);

    if (!fullRange && !shortRange) {
      throw new Error('Could not initialize on-device MediaPipe face detectors');
    }
    return { fullRange, shortRange };
  })().catch((err) => {
    detectorsPromise = null;
    throw err;
  });

  return detectorsPromise;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode image'));
    img.src = src;
  });
}

function boxIoU(a, b) {
  const ix1 = Math.max(a.xmin, b.xmin);
  const iy1 = Math.max(a.ymin, b.ymin);
  const ix2 = Math.min(a.xmax, b.xmax);
  const iy2 = Math.min(a.ymax, b.ymax);
  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  const inter = iw * ih;
  if (inter <= 0) return 0;
  const areaA = (a.xmax - a.xmin) * (a.ymax - a.ymin);
  const areaB = (b.xmax - b.xmin) * (b.ymax - b.ymin);
  const union = areaA + areaB - inter;
  return union > 0 ? inter / union : 0;
}

function boxContainment(inner, outer) {
  const ix1 = Math.max(inner.xmin, outer.xmin);
  const iy1 = Math.max(inner.ymin, outer.ymin);
  const ix2 = Math.min(inner.xmax, outer.xmax);
  const iy2 = Math.min(inner.ymax, outer.ymax);
  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  const areaInner = Math.max(1, (inner.xmax - inner.xmin) * (inner.ymax - inner.ymin));
  return (iw * ih) / areaInner;
}

function boxesMatch(a, b, iouThreshold = 0.22) {
  if (
    boxIoU(a, b) > iouThreshold ||
    boxContainment(a, b) > 0.58 ||
    boxContainment(b, a) > 0.58
  ) {
    return true;
  }
  // Also catch slightly shifted duplicate detections from tilted/flipped passes
  const acx = (a.xmin + a.xmax) / 2;
  const acy = (a.ymin + a.ymax) / 2;
  const bcx = (b.xmin + b.xmax) / 2;
  const bcy = (b.ymin + b.ymax) / 2;
  const aw = a.xmax - a.xmin;
  const ah = a.ymax - a.ymin;
  const bw = b.xmax - b.xmin;
  const bh = b.ymax - b.ymin;
  const dist = Math.hypot(acx - bcx, acy - bcy);
  const minDim = Math.min(Math.max(aw, ah), Math.max(bw, bh));
  const maxDim = Math.max(Math.max(aw, ah), Math.max(bw, bh));
  return dist < minDim * 0.55 && maxDim / Math.max(1, minDim) < 2.2;
}

/**
 * Consensus-weighted Non-Maximum Suppression:
 * Clusters overlapping multi-pass candidates and counts how many distinct
 * passes agreed on each face. Real faces either score high (>= 0.42) or are
 * confirmed across >= 2 independent passes (normal/flipped/boosted/tiled),
 * which dramatically cuts bag/clothing false positives while boosting recall
 * on dim background faces.
 */
function mergeDetectionsConsensusNMS(candidates, { iouThreshold = 0.24, soloMinScore = 0.40, consensusMinScore = 0.23 } = {}) {
  const sorted = [...candidates].sort((a, b) => (b.score || 0) - (a.score || 0));
  const clusters = [];

  for (const cand of sorted) {
    let matched = null;
    for (const cl of clusters) {
      if (boxesMatch(cand, cl.best, iouThreshold)) {
        matched = cl;
        break;
      }
    }
    if (matched) {
      matched.passes.add(cand.passId);
      matched.count += 1;
      matched.maxScore = Math.max(matched.maxScore, cand.score);
      // Prefer tighter box if both have strong confidence (prevents tilted/boosted bloat)
      const bestArea = (matched.best.xmax - matched.best.xmin) * (matched.best.ymax - matched.best.ymin);
      const candArea = (cand.xmax - cand.xmin) * (cand.ymax - cand.ymin);
      if (cand.score >= matched.best.score * 0.85 && candArea < bestArea * 0.72) {
        matched.best = { ...cand, score: matched.maxScore };
      }
    } else {
      clusters.push({
        best: cand,
        passes: new Set([cand.passId]),
        count: 1,
        maxScore: cand.score
      });
    }
  }

  return clusters
    .filter((cl) => cl.maxScore >= soloMinScore || (cl.passes.size >= 2 && cl.maxScore >= consensusMinScore))
    .map((cl) => ({
      ymin: cl.best.ymin,
      xmin: cl.best.xmin,
      ymax: cl.best.ymax,
      xmax: cl.best.xmax,
      score: cl.maxScore,
      hits: cl.passes.size
    }));
}

function pushBox(rawCandidates, gx1, gy1, gx2, gy2, W, H, score, passId = 'p') {
  const bw = gx2 - gx1;
  const bh = gy2 - gy1;
  if (bw < 8 || bh < 8) return;

  // Aspect-ratio sanity filter (rejects long horizontal bags/banners/boxes while allowing angled faces)
  const ratio = bw / bh;
  if (ratio > 1.85 || ratio < 0.48) return;

  const xmin = Math.max(0, Math.min(1000, Math.round((gx1 / W) * 1000)));
  const ymin = Math.max(0, Math.min(1000, Math.round((gy1 / H) * 1000)));
  const xmax = Math.max(0, Math.min(1000, Math.round((gx2 / W) * 1000)));
  const ymax = Math.max(0, Math.min(1000, Math.round((gy2 / H) * 1000)));

  const nw = xmax - xmin;
  const nh = ymax - ymin;
  if (nw < 8 || nh < 8 || (nw > 920 && nh > 920)) return;

  rawCandidates.push({ ymin, xmin, ymax, xmax, score, passId });
}

/**
 * Multi-pass high-recall on-device crowd face detection.
 */
async function detectFacesOnDevice(img) {
  const loaded = await preloadFaceDetector();
  if (!loaded || (!loaded.fullRange && !loaded.shortRange)) {
    throw new Error('FaceDetector unavailable');
  }

  const primary = loaded.fullRange || loaded.shortRange;
  const secondary = loaded.fullRange && loaded.shortRange ? loaded.shortRange : null;

  const W = img.naturalWidth || img.width;
  const H = img.naturalHeight || img.height;
  const rawCandidates = [];

  // Reusable work canvas
  const work = document.createElement('canvas');
  const wCtx = work.getContext('2d');

  // Helper: detect on a full-image resized canvas (optionally flipped or brightness-boosted)
  const runFullPass = (detector, passId, { maxDim = 1024, flipX = false, filter = 'none', minScore = 0.22 } = {}) => {
    if (!detector) return;
    const scale = Math.min(1, maxDim / Math.max(W, H));
    const cw = Math.max(1, Math.round(W * scale));
    const ch = Math.max(1, Math.round(H * scale));
    work.width = cw;
    work.height = ch;
    wCtx.save();
    wCtx.clearRect(0, 0, cw, ch);
    if (filter !== 'none' && 'filter' in wCtx) wCtx.filter = filter;
    if (flipX) {
      wCtx.translate(cw, 0);
      wCtx.scale(-1, 1);
    }
    wCtx.drawImage(img, 0, 0, cw, ch);
    wCtx.restore();

    const res = detector.detect(work);
    const inv = 1 / scale;
    for (const det of res?.detections || []) {
      const score = det.categories?.[0]?.score ?? 0.5;
      if (score < minScore) continue;
      const bb = det.boundingBox;
      if (!bb) continue;
      const x1 = flipX ? (cw - (bb.originX + bb.width)) * inv : bb.originX * inv;
      const x2 = flipX ? (cw - bb.originX) * inv : (bb.originX + bb.width) * inv;
      pushBox(rawCandidates, x1, bb.originY * inv, x2, (bb.originY + bb.height) * inv, W, H, score, passId);
    }
  };

  // Helper: detect on tilted full-image canvas (catches reclining / tilted heads like bottom-right people)
  const runTiltedPass = (detector, passId, angleDeg, minScore = 0.36) => {
    if (!detector) return;
    const scale = Math.min(1, 840 / Math.max(W, H));
    const cw = Math.max(1, Math.round(W * scale));
    const ch = Math.max(1, Math.round(H * scale));
    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(-rad);
    const sin = Math.sin(-rad);

    work.width = cw;
    work.height = ch;
    wCtx.save();
    wCtx.clearRect(0, 0, cw, ch);
    wCtx.translate(cw / 2, ch / 2);
    wCtx.rotate(rad);
    wCtx.drawImage(img, -cw / 2, -ch / 2, cw, ch);
    wCtx.restore();

    const res = detector.detect(work);
    const inv = 1 / scale;
    for (const det of res?.detections || []) {
      const score = det.categories?.[0]?.score ?? 0.5;
      if (score < minScore) continue;
      const bb = det.boundingBox;
      if (!bb) continue;
      // Rotate center back to unrotated image coordinates
      const rcx = bb.originX + bb.width / 2 - cw / 2;
      const rcy = bb.originY + bb.height / 2 - ch / 2;
      const origCx = (rcx * cos - rcy * sin + cw / 2) * inv;
      const origCy = (rcx * sin + rcy * cos + ch / 2) * inv;
      const halfW = (bb.width * inv) / 2;
      const halfH = (bb.height * inv) / 2;
      pushBox(
        rawCandidates,
        origCx - halfW,
        origCy - halfH,
        origCx + halfW,
        origCy + halfH,
        W,
        H,
        score * 0.94,
        passId
      );
    }
  };

  // Helper: detect on overlapping tile grid (optionally brightness-boosted for dark gyms/shelters)
  const runTileGrid = (detector, passId, cols, rows, { overlap = 0.22, minScore = 0.23, filter = 'none', flipX = false } = {}) => {
    if (!detector) return;
    const stepX = W / cols;
    const stepY = H / rows;
    const padX = stepX * overlap;
    const padY = stepY * overlap;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const sx = Math.max(0, Math.floor(c * stepX - padX));
        const sy = Math.max(0, Math.floor(r * stepY - padY));
        const ex = Math.min(W, Math.ceil((c + 1) * stepX + padX));
        const ey = Math.min(H, Math.ceil((r + 1) * stepY + padY));
        const tw = ex - sx;
        const th = ey - sy;
        if (tw < 48 || th < 48) continue;

        // Resize tile up/down to ~440px for fast consistent WASM inference
        const tScale = Math.min(1.6, 440 / Math.max(tw, th));
        const cw = Math.max(1, Math.round(tw * tScale));
        const ch = Math.max(1, Math.round(th * tScale));

        work.width = cw;
        work.height = ch;
        wCtx.save();
        wCtx.clearRect(0, 0, cw, ch);
        if (filter !== 'none' && 'filter' in wCtx) wCtx.filter = filter;
        if (flipX) {
          wCtx.translate(cw, 0);
          wCtx.scale(-1, 1);
        }
        wCtx.drawImage(img, sx, sy, tw, th, 0, 0, cw, ch);
        wCtx.restore();

        const res = detector.detect(work);
        const inv = 1 / tScale;
        for (const det of res?.detections || []) {
          const score = det.categories?.[0]?.score ?? 0.5;
          if (score < minScore) continue;
          const bb = det.boundingBox;
          if (!bb) continue;
          const lx1 = flipX ? (cw - (bb.originX + bb.width)) * inv : bb.originX * inv;
          const lx2 = flipX ? (cw - bb.originX) * inv : (bb.originX + bb.width) * inv;
          pushBox(
            rawCandidates,
            sx + lx1,
            sy + bb.originY * inv,
            sx + lx2,
            sy + (bb.originY + bb.height) * inv,
            W,
            H,
            score,
            passId
          );
        }
      }
    }
  };

  // Pass 1: Full-Range full frame (normal + horizontal flip + shadow-lifted)
  runFullPass(primary, 'full_norm', { maxDim: 1024, minScore: 0.22 });
  runFullPass(primary, 'full_flip', { maxDim: 1024, flipX: true, minScore: 0.22 });
  runFullPass(primary, 'full_bright', { maxDim: 1024, filter: 'brightness(1.42) contrast(1.14)', minScore: 0.22 });
  if (secondary) {
    runFullPass(secondary, 'short_full', { maxDim: 840, minScore: 0.36 });
  }

  // Pass 2: Tilted passes (+/-22 deg) for reclining/leaning faces
  runTiltedPass(primary, 'tilt_p22', 22, 0.36);
  runTiltedPass(primary, 'tilt_m22', -22, 0.36);

  // Pass 3: 2x2 overlapping tiles (normal + flipped shadow-boosted + short-range close-up booster)
  if (W >= 320 && H >= 240) {
    runTileGrid(primary, 't2x2_norm', 2, 2, { overlap: 0.24, minScore: 0.22 });
    runTileGrid(primary, 't2x2_flip_bright', 2, 2, {
      overlap: 0.24,
      minScore: 0.22,
      flipX: true,
      filter: 'brightness(1.38) contrast(1.12)'
    });
    if (secondary) {
      runTileGrid(secondary, 't2x2_short', 2, 2, { overlap: 0.20, minScore: 0.42 });
    }
  }

  // Pass 4: 3x2 + 4x3 crowd tiles with strong shadow lift (catches small & dark background faces)
  if (W >= 560 && H >= 360) {
    runTileGrid(primary, 't3x2_bright', 3, 2, {
      overlap: 0.22,
      minScore: 0.22,
      filter: 'brightness(1.50) contrast(1.14)'
    });
    runTileGrid(primary, 't3x2_flip', 3, 2, { overlap: 0.22, minScore: 0.22, flipX: true });
  }
  if (W >= 780 && H >= 480) {
    runTileGrid(primary, 't4x3_bright', 4, 3, {
      overlap: 0.20,
      minScore: 0.23,
      filter: 'brightness(1.65) contrast(1.18)'
    });
    runTileGrid(primary, 't4x3_flip_bright', 4, 3, {
      overlap: 0.20,
      minScore: 0.23,
      flipX: true,
      filter: 'brightness(1.65) contrast(1.18)'
    });
  }

  return mergeDetectionsConsensusNMS(rawCandidates, {
    iouThreshold: 0.24,
    soloMinScore: 0.42,
    consensusMinScore: 0.23
  }).slice(0, 80);
}

/**
 * Fallback backend Gemini Vision probe (only used if MediaPipe WASM cannot run).
 */
async function detectFacesViaBackend(img, dataUrl, apiUrl, token) {
  const maxDim = 1024;
  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;
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
  const probeBase64 = canvas.toDataURL('image/jpeg', 0.74);

  const authToken =
    token ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('bbdrts_token') || localStorage.getItem('token') : null);

  const res = await fetch(`${apiUrl}/api/privacy/detect-faces`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
    },
    body: JSON.stringify({ imageBase64: probeBase64 })
  });

  if (!res.ok) throw new Error(`Backend face detection HTTP ${res.status}`);
  const data = await res.json();
  if (!data.success && data.skipped) {
    throw new Error(data.reason || 'Backend face detector unavailable');
  }
  return Array.isArray(data.faces) ? data.faces : [];
}

/**
 * Apply silky, radial-alpha-feathered irreversible Gaussian privacy blur over
 * normalized 0..1000 face boxes on the full-resolution image (zero hard edges).
 */
export async function applyFaceBlurBoxes(dataUrl, faces = [], options = {}) {
  if (!dataUrl || !Array.isArray(faces) || faces.length === 0) {
    return dataUrl;
  }

  const { padX = 0.34, padY = 0.42, quality = 0.86 } = options;
  const img = await loadImage(dataUrl);
  const W = img.naturalWidth || img.width;
  const H = img.naturalHeight || img.height;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, W, H);

  const patchCanvas = document.createElement('canvas');
  const patchCtx = patchCanvas.getContext('2d');
  const blurCanvas = document.createElement('canvas');
  const blurCtx = blurCanvas.getContext('2d');
  const tinyCanvas = document.createElement('canvas');
  const tinyCtx = tinyCanvas.getContext('2d');

  for (const box of faces) {
    const rawX = (box.xmin / 1000) * W;
    const rawY = (box.ymin / 1000) * H;
    const rawW = ((box.xmax - box.xmin) / 1000) * W;
    const rawH = ((box.ymax - box.ymin) / 1000) * H;
    if (rawW < 4 || rawH < 4) continue;

    const cx = rawX + rawW / 2;
    const cy = rawY + rawH / 2;
    const rx = rawW * (0.5 + padX);
    const ry = rawH * (0.5 + padY);

    const x = Math.max(0, Math.floor(cx - rx));
    const y = Math.max(0, Math.floor(cy - ry));
    const x2 = Math.min(W, Math.ceil(cx + rx));
    const y2 = Math.min(H, Math.ceil(cy + ry));
    const pw = x2 - x;
    const ph = y2 - y;
    if (pw < 6 || ph < 6) continue;

    const blurRadius = Math.max(8, Math.min(34, Math.round(Math.max(rawW, rawH) * 0.2)));
    const bleed = Math.min(blurRadius * 2, 48);
    const sx = Math.max(0, x - bleed);
    const sy = Math.max(0, y - bleed);
    const sx2 = Math.min(W, x2 + bleed);
    const sy2 = Math.min(H, y2 + bleed);
    const sw = sx2 - sx;
    const sh = sy2 - sy;

    const downW = Math.max(8, Math.min(20, Math.round(sw / Math.max(8, rawW * 0.14))));
    const downH = Math.max(8, Math.min(20, Math.round(sh / Math.max(8, rawH * 0.14))));
    tinyCanvas.width = downW;
    tinyCanvas.height = downH;
    tinyCtx.imageSmoothingEnabled = true;
    tinyCtx.imageSmoothingQuality = 'high';
    tinyCtx.clearRect(0, 0, downW, downH);
    tinyCtx.drawImage(img, sx, sy, sw, sh, 0, 0, downW, downH);

    blurCanvas.width = sw;
    blurCanvas.height = sh;
    blurCtx.clearRect(0, 0, sw, sh);
    blurCtx.imageSmoothingEnabled = true;
    blurCtx.imageSmoothingQuality = 'high';
    if ('filter' in blurCtx) {
      try {
        blurCtx.filter = `blur(${blurRadius}px)`;
        blurCtx.drawImage(tinyCanvas, 0, 0, downW, downH, 0, 0, sw, sh);
        blurCtx.filter = 'none';
      } catch (_) {
        blurCtx.drawImage(tinyCanvas, 0, 0, downW, downH, 0, 0, sw, sh);
      }
    } else {
      blurCtx.drawImage(tinyCanvas, 0, 0, downW, downH, 0, 0, sw, sh);
    }

    patchCanvas.width = pw;
    patchCanvas.height = ph;
    patchCtx.globalCompositeOperation = 'source-over';
    patchCtx.clearRect(0, 0, pw, ph);
    patchCtx.drawImage(blurCanvas, x - sx, y - sy, pw, ph, 0, 0, pw, ph);

    const localCx = cx - x;
    const localCy = cy - y;
    patchCtx.save();
    patchCtx.globalCompositeOperation = 'destination-in';
    patchCtx.translate(localCx, localCy);
    patchCtx.scale(rx, ry);
    const grad = patchCtx.createRadialGradient(0, 0, 0, 0, 0, 1);
    grad.addColorStop(0.0, 'rgba(0, 0, 0, 1)');
    grad.addColorStop(0.46, 'rgba(0, 0, 0, 1)');
    grad.addColorStop(0.70, 'rgba(0, 0, 0, 0.72)');
    grad.addColorStop(0.88, 'rgba(0, 0, 0, 0.20)');
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
    patchCtx.fillStyle = grad;
    patchCtx.beginPath();
    patchCtx.arc(0, 0, 1, 0, Math.PI * 2);
    patchCtx.fill();
    patchCtx.restore();

    ctx.drawImage(patchCanvas, x, y);
  }

  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Full pipeline: detect faces on-device via Dual MediaPipe BlazeFace (Full-Range + Short-Range)
 * with automatic Gemini backend fallback, then apply smooth radial-feathered Gaussian blur.
 */
export async function blurFacesInImage(dataUrl, options = {}) {
  const { apiUrl = API_URL, token = null } = options;

  if (
    !dataUrl ||
    typeof dataUrl !== 'string' ||
    !dataUrl.startsWith('data:image/') ||
    dataUrl.startsWith('data:image/svg')
  ) {
    return {
      url: dataUrl,
      originalUrl: dataUrl,
      blurredUrl: null,
      facesBlurred: 0,
      blurred: false,
      boxes: [],
      engine: 'skipped'
    };
  }

  const startedAt = performance.now();
  let img;
  try {
    img = await loadImage(dataUrl);
  } catch (err) {
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

  let faces = [];
  let engine = 'mediapipe-dual-local';
  let detectError = null;

  try {
    faces = await detectFacesOnDevice(img);
  } catch (mpErr) {
    console.warn('[FacePrivacy] On-device MediaPipe failed, falling back to Gemini backend:', mpErr.message);
    engine = 'gemini-backend';
    try {
      faces = await detectFacesViaBackend(img, dataUrl, apiUrl, token);
    } catch (beErr) {
      detectError = beErr.message || mpErr.message;
    }
  }

  if (detectError) {
    return {
      url: dataUrl,
      originalUrl: dataUrl,
      blurredUrl: null,
      facesBlurred: 0,
      blurred: false,
      boxes: [],
      engine,
      durationMs: Math.round(performance.now() - startedAt),
      error: detectError
    };
  }

  if (!faces || faces.length === 0) {
    return {
      url: dataUrl,
      originalUrl: dataUrl,
      blurredUrl: null,
      facesBlurred: 0,
      blurred: false,
      boxes: [],
      engine,
      durationMs: Math.round(performance.now() - startedAt)
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
    engine,
    durationMs: Math.round(performance.now() - startedAt)
  };
}
