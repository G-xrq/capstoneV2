/**
 * BBDRTS — RA 10173 On-Device High-Precision AI Face-Blur Privacy Shield
 *
 * Primary Engine: Dual on-device MediaPipe BlazeFace WASM models
 *   1. blaze_face_full_range.tflite (192x192 dense crowd / wide-room model)
 *   2. blaze_face_short_range.tflite (128x128 close-up & crop verifier)
 * combined with:
 *   - Multi-scale overlapping tiles, shadow-lifted crowd scan, flip & tilt passes
 *   - 6-landmark facial anatomy validation (eyes / nose / mouth geometry)
 *   - Consensus-weighted Non-Maximum Suppression
 *   - Zoomed-in 256x256 Dual-Model Crop Cross-Verification (size-aware thresholds)
 *   - Anti-foliage / anti-graphic-banner pixel plausibility guard (fair across all skin tones)
 *   - Smooth radial-feathered Gaussian privacy blur
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
    const fullRange = await createDetector(vision, [FULL_RANGE_LOCAL_URL, FULL_RANGE_CDN_URL], 0.28);
    const shortRange = await createDetector(vision, [SHORT_RANGE_LOCAL_URL, SHORT_RANGE_CDN_URL], 0.34);

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
 * Validate MediaPipe 6-point facial landmarks (rightEye, leftEye, nose, mouth, rightEar, leftEar)
 * against the detected bounding box on the inference canvas.
 * Rejects nonsensical pareidolia detections on debris, foliage, banners, or roofs while allowing
 * frontal, 3/4, side-profile, and moderately tilted human faces.
 */
function hasValidFacialGeometry(det, cw, ch, allowTilted = false) {
  const bb = det?.boundingBox;
  const kps = det?.keypoints;
  if (!bb || !Array.isArray(kps) || kps.length < 4) return true;

  const bw = Math.max(1, bb.width);
  const bh = Math.max(1, bb.height);
  const toLocal = (kp) => ({
    x: (kp.x * cw - bb.originX) / bw,
    y: (kp.y * ch - bb.originY) / bh
  });

  const rightEye = toLocal(kps[0]);
  const leftEye = toLocal(kps[1]);
  const nose = toLocal(kps[2]);
  const mouth = toLocal(kps[3]);

  // All 4 core landmarks must stay reasonably inside the face bounding box
  for (const pt of [rightEye, leftEye, nose, mouth]) {
    if (pt.x < -0.22 || pt.x > 1.22 || pt.y < -0.22 || pt.y > 1.22) {
      return false;
    }
  }

  const eyeDx = Math.abs(leftEye.x - rightEye.x);
  const eyeDy = Math.abs(leftEye.y - rightEye.y);
  const eyeMidY = (leftEye.y + rightEye.y) / 2;

  // Eyes should sit in the upper-to-middle portion of the box and not be vertically stacked
  if (eyeMidY < 0.02 || eyeMidY > 0.72) return false;
  if (!allowTilted && eyeDy > 0.44) return false;
  if (eyeDx < 0.08 && eyeDy < 0.08) return false;

  // Mouth must sit below the eye line (prevents inverted / chaotic texture hallucinations)
  if (mouth.y < eyeMidY + 0.08) return false;
  if (mouth.y > 1.12) return false;

  // Nose should not be far above the eyes or far below the mouth
  if (nose.y < eyeMidY - 0.12 || nose.y > mouth.y + 0.14) return false;

  return true;
}

/**
 * Consensus-weighted Non-Maximum Suppression:
 * Clusters overlapping multi-pass candidates and tracks pass agreement & model diversity.
 */
function mergeDetectionsConsensusNMS(
  candidates,
  { iouThreshold = 0.24, soloMinScore = 0.54, consensusMinScore = 0.30 } = {}
) {
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
      matched.models.add(cand.modelId || 'full');
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
        models: new Set([cand.modelId || 'full']),
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
      hits: cl.passes.size,
      modelCount: cl.models.size
    }));
}

function pushBox(rawCandidates, gx1, gy1, gx2, gy2, W, H, score, passId = 'p', modelId = 'full') {
  const bw = gx2 - gx1;
  const bh = gy2 - gy1;
  if (bw < 10 || bh < 10) return;

  // Aspect-ratio sanity filter (rejects long horizontal bags/banners/boxes while allowing angled faces)
  const ratio = bw / bh;
  if (ratio > 1.75 || ratio < 0.50) return;

  const xmin = Math.max(0, Math.min(1000, Math.round((gx1 / W) * 1000)));
  const ymin = Math.max(0, Math.min(1000, Math.round((gy1 / H) * 1000)));
  const xmax = Math.max(0, Math.min(1000, Math.round((gx2 / W) * 1000)));
  const ymax = Math.max(0, Math.min(1000, Math.round((gy2 / H) * 1000)));

  const nw = xmax - xmin;
  const nh = ymax - ymin;
  if (nw < 8 || nh < 8 || (nw > 900 && nh > 900)) return;

  rawCandidates.push({ ymin, xmin, ymax, xmax, score, passId, modelId });
}

/**
 * Inspect pixel statistics inside the candidate's inner face ellipse to catch obvious
 * non-face pareidolia (vivid green foliage/trees, vivid blue sky/water, or saturated red/white
 * graphic title overlays like "TYPHOON ODETTE"). Designed to reject anti-face colors only so
 * all human skin tones and dim/backlit lighting remain unaffected.
 */
function analyzeFacePatchPixels(ctx, sx, sy, sw, sh) {
  const sampleW = Math.max(12, Math.min(40, Math.round(sw)));
  const sampleH = Math.max(12, Math.min(40, Math.round(sh)));
  const imgData = ctx.getImageData(
    Math.max(0, Math.floor(sx)),
    Math.max(0, Math.floor(sy)),
    Math.max(1, Math.floor(sw)),
    Math.max(1, Math.floor(sh))
  );
  const data = imgData.data;
  const iw = imgData.width;
  const ih = imgData.height;
  const stepX = Math.max(1, Math.floor(iw / sampleW));
  const stepY = Math.max(1, Math.floor(ih / sampleH));

  let total = 0;
  let greenFoliage = 0;
  let vividBlue = 0;
  let neonRedGraphic = 0;
  let extremeGraphicBW = 0;

  for (let y = Math.floor(ih * 0.14); y < Math.ceil(ih * 0.86); y += stepY) {
    for (let x = Math.floor(iw * 0.14); x < Math.ceil(iw * 0.86); x += stepX) {
      const idx = (y * iw + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      total++;

      // Vivid green vegetation / leaves / grass
      if (g > r + 14 && g > b + 14 && g > 55) {
        greenFoliage++;
      }
      // Vivid blue sky / tarps / deep water
      if (b > r + 28 && b > g + 14 && b > 80) {
        vividBlue++;
      }
      // Hyper-saturated graphic red (banners, title overlays, warning signs)
      if (r > 165 && r - g > 95 && r - b > 95) {
        neonRedGraphic++;
      }
      // Pure graphic black/white text strokes
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      if ((maxC < 18 || minC > 242) && maxC - minC < 12) {
        extremeGraphicBW++;
      }
    }
  }

  if (total === 0) {
    return { greenRatio: 0, blueRatio: 0, neonRedRatio: 0, graphicBwRatio: 0 };
  }

  return {
    greenRatio: greenFoliage / total,
    blueRatio: vividBlue / total,
    neonRedRatio: neonRedGraphic / total,
    graphicBwRatio: extremeGraphicBW / total
  };
}

/**
 * Zoomed-in 256x256 Dual-Model Crop Cross-Verification:
 * Crops a clean 2.0x square window around every NMS candidate from the original image and
 * re-tests it directly with BOTH blaze_face_short_range AND blaze_face_full_range.
 *
 * Real faces (even small/dim crowd faces) jump sharply in confidence when zoomed & centered,
 * whereas pareidolia false positives on debris, foliage, roofs, or bold text overlays collapse
 * or fail dual-model confirmation — especially on large boxes where detail is abundant.
 */
function verifyCandidatesWithZoomedCrops(img, candidates, { fullRange, shortRange }) {
  if (!candidates.length) return [];

  const W = img.naturalWidth || img.width;
  const H = img.naturalHeight || img.height;

  const cropCanvas = document.createElement('canvas');
  const cropSize = 256;
  cropCanvas.width = cropSize;
  cropCanvas.height = cropSize;
  const cCtx = cropCanvas.getContext('2d', { willReadFrequently: true });

  const runCenteredProbe = (detector, filter = 'none') => {
    if (!detector) return { score: 0, box: null };
    if (filter !== 'none' && 'filter' in cCtx) {
      // Redraw with shadow lift only when requested
      return null;
    }
    const res = detector.detect(cropCanvas);
    let bestScore = 0;
    let bestBox = null;
    for (const det of res?.detections || []) {
      const score = det.categories?.[0]?.score ?? 0;
      const bb = det.boundingBox;
      if (!bb) continue;
      if (!hasValidFacialGeometry(det, cropSize, cropSize, true)) continue;
      const dcx = (bb.originX + bb.width / 2) / cropSize;
      const dcy = (bb.originY + bb.height / 2) / cropSize;
      const dSize = Math.max(bb.width, bb.height) / cropSize;
      // Must align near the center of the crop and match scale reasonably
      if (Math.hypot(dcx - 0.5, dcy - 0.5) > 0.28) continue;
      if (dSize < 0.18 || dSize > 0.92) continue;
      if (score > bestScore) {
        bestScore = score;
        bestBox = bb;
      }
    }
    return { score: bestScore, box: bestBox };
  };

  const verified = [];

  for (const cand of candidates) {
    const bx = (cand.xmin / 1000) * W;
    const by = (cand.ymin / 1000) * H;
    const bw = ((cand.xmax - cand.xmin) / 1000) * W;
    const bh = ((cand.ymax - cand.ymin) / 1000) * H;
    const cx = bx + bw / 2;
    const cy = by + bh / 2;
    const normMax = Math.max(cand.xmax - cand.xmin, cand.ymax - cand.ymin);

    // Build a clean 2.0x square crop centered on the candidate
    const side = Math.max(bw, bh) * 2.05;
    const sx = cx - side / 2;
    const sy = cy - side / 2;

    const drawCrop = (filter = 'none') => {
      cCtx.save();
      cCtx.fillStyle = '#000000';
      cCtx.fillRect(0, 0, cropSize, cropSize);
      if (filter !== 'none' && 'filter' in cCtx) cCtx.filter = filter;
      cCtx.drawImage(img, sx, sy, side, side, 0, 0, cropSize, cropSize);
      cCtx.restore();
    };

    // 1. Clean un-altered crop check
    drawCrop('none');

    // Analyze pixel plausibility inside the inner face region of the crop
    const faceLocalW = (bw / side) * cropSize;
    const faceLocalH = (bh / side) * cropSize;
    const faceLocalX = (cropSize - faceLocalW) / 2;
    const faceLocalY = (cropSize - faceLocalH) / 2;
    const px = analyzeFacePatchPixels(cCtx, faceLocalX, faceLocalY, faceLocalW, faceLocalH);

    const shortProbe = runCenteredProbe(shortRange);
    const fullProbe = runCenteredProbe(fullRange);
    let shortScore = shortProbe?.score || 0;
    let fullScore = fullProbe?.score || 0;

    // 2. For small dim crowd faces only (normMax < 65), allow a gentle shadow-lifted re-probe
    if (normMax < 65 && Math.max(shortScore, fullScore) < 0.50) {
      drawCrop('brightness(1.45) contrast(1.12)');
      const liftedShort = runCenteredProbe(shortRange)?.score || 0;
      const liftedFull = runCenteredProbe(fullRange)?.score || 0;
      shortScore = Math.max(shortScore, liftedShort * 0.94);
      fullScore = Math.max(fullScore, liftedFull * 0.94);
    }

    const bothModelsLoaded = Boolean(shortRange && fullRange);
    const strongDualConsensus = shortScore >= 0.80 && fullScore >= 0.80;

    // Anti-foliage / anti-sky / anti-graphic-banner rejection
    const isFoliage = px.greenRatio > 0.36;
    const isBlueSkyOrTarp = px.blueRatio > 0.42;
    const isGraphicBanner =
      px.neonRedRatio > 0.16 ||
      (px.neonRedRatio > 0.08 && px.graphicBwRatio > 0.18) ||
      px.graphicBwRatio > 0.58;

    if ((isFoliage || isBlueSkyOrTarp || isGraphicBanner) && !strongDualConsensus) {
      continue;
    }

    // Size-aware acceptance rules:
    // Large candidates (>= 12.5% of frame) have abundant pixel detail — a real close-up face
    // will ALWAYS be strongly confirmed by BOTH models on a centered 256x256 crop.
    let accepted = false;
    if (normMax >= 125) {
      if (bothModelsLoaded) {
        accepted =
          (shortScore >= 0.58 && fullScore >= 0.56) ||
          (shortScore >= 0.74 && fullScore >= 0.42) ||
          (fullScore >= 0.78 && shortScore >= 0.42);
      } else {
        accepted = Math.max(shortScore, fullScore) >= 0.78;
      }
    } else if (normMax >= 55) {
      // Mid-sized faces: require solid dual-model confirmation or strong zoomed score
      if (bothModelsLoaded) {
        accepted =
          (shortScore >= 0.44 && fullScore >= 0.44) ||
          shortScore >= 0.68 ||
          fullScore >= 0.70 ||
          (cand.score >= 0.65 && Math.max(shortScore, fullScore) >= 0.48);
      } else {
        accepted = Math.max(shortScore, fullScore) >= 0.64;
      }
    } else {
      // Small / distant crowd faces: zoomed crop magnifies them for clear verification
      if (bothModelsLoaded) {
        accepted =
          (shortScore >= 0.34 && fullScore >= 0.34) ||
          fullScore >= 0.52 ||
          shortScore >= 0.54 ||
          (cand.hits >= 3 && cand.score >= 0.45 && Math.max(shortScore, fullScore) >= 0.32);
      } else {
        accepted = Math.max(shortScore, fullScore) >= 0.50;
      }
    }

    if (accepted) {
      verified.push({
        ...cand,
        score: Math.max(cand.score, shortScore, fullScore),
        shortScore,
        fullScore
      });
    }
  }

  return verified;
}

/**
 * Multi-pass high-precision on-device crowd face detection.
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
  const runFullPass = (
    detector,
    passId,
    modelId,
    { maxDim = 1024, flipX = false, filter = 'none', minScore = 0.28 } = {}
  ) => {
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
      if (!hasValidFacialGeometry(det, cw, ch, false)) continue;
      const bb = det.boundingBox;
      if (!bb) continue;
      const x1 = flipX ? (cw - (bb.originX + bb.width)) * inv : bb.originX * inv;
      const x2 = flipX ? (cw - bb.originX) * inv : (bb.originX + bb.width) * inv;
      pushBox(rawCandidates, x1, bb.originY * inv, x2, (bb.originY + bb.height) * inv, W, H, score, passId, modelId);
    }
  };

  // Helper: detect on tilted full-image canvas (catches reclining / tilted heads)
  const runTiltedPass = (detector, passId, modelId, angleDeg, minScore = 0.44) => {
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
      if (!hasValidFacialGeometry(det, cw, ch, true)) continue;
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
        passId,
        modelId
      );
    }
  };

  // Helper: detect on overlapping tile grid (optionally brightness-boosted for dark gyms/shelters)
  const runTileGrid = (
    detector,
    passId,
    modelId,
    cols,
    rows,
    { overlap = 0.22, minScore = 0.28, filter = 'none', flipX = false } = {}
  ) => {
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
          if (!hasValidFacialGeometry(det, cw, ch, false)) continue;
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
            passId,
            modelId
          );
        }
      }
    }
  };

  // Pass 1: Full-Range full frame (normal + horizontal flip + shadow-lifted)
  runFullPass(primary, 'full_norm', 'full', { maxDim: 1024, minScore: 0.28 });
  runFullPass(primary, 'full_flip', 'full', { maxDim: 1024, flipX: true, minScore: 0.28 });
  runFullPass(primary, 'full_bright', 'full', {
    maxDim: 1024,
    filter: 'brightness(1.40) contrast(1.12)',
    minScore: 0.30
  });
  if (secondary) {
    runFullPass(secondary, 'short_full', 'short', { maxDim: 840, minScore: 0.42 });
  }

  // Pass 2: Tilted passes (+/-22 deg) for reclining/leaning faces
  runTiltedPass(primary, 'tilt_p22', 'full', 22, 0.44);
  runTiltedPass(primary, 'tilt_m22', 'full', -22, 0.44);

  // Pass 3: 2x2 overlapping tiles (normal + flipped shadow-boosted + short-range close-up booster)
  if (W >= 320 && H >= 240) {
    runTileGrid(primary, 't2x2_norm', 'full', 2, 2, { overlap: 0.24, minScore: 0.28 });
    runTileGrid(primary, 't2x2_flip_bright', 'full', 2, 2, {
      overlap: 0.24,
      minScore: 0.30,
      flipX: true,
      filter: 'brightness(1.36) contrast(1.10)'
    });
    if (secondary) {
      runTileGrid(secondary, 't2x2_short', 'short', 2, 2, { overlap: 0.20, minScore: 0.46 });
    }
  }

  // Pass 4: 3x2 + 4x3 crowd tiles with shadow lift (catches small & dark background faces)
  if (W >= 560 && H >= 360) {
    runTileGrid(primary, 't3x2_bright', 'full', 3, 2, {
      overlap: 0.22,
      minScore: 0.28,
      filter: 'brightness(1.48) contrast(1.12)'
    });
    runTileGrid(primary, 't3x2_flip', 'full', 3, 2, { overlap: 0.22, minScore: 0.28, flipX: true });
  }
  if (W >= 780 && H >= 480) {
    runTileGrid(primary, 't4x3_bright', 'full', 4, 3, {
      overlap: 0.20,
      minScore: 0.30,
      filter: 'brightness(1.60) contrast(1.16)'
    });
    runTileGrid(primary, 't4x3_flip_bright', 'full', 4, 3, {
      overlap: 0.20,
      minScore: 0.30,
      flipX: true,
      filter: 'brightness(1.60) contrast(1.16)'
    });
  }

  const merged = mergeDetectionsConsensusNMS(rawCandidates, {
    iouThreshold: 0.24,
    soloMinScore: 0.54,
    consensusMinScore: 0.30
  }).slice(0, 80);

  // Pass 5: Zoomed 256x256 Dual-Model Crop Verification + Pixel Plausibility Guard
  return verifyCandidatesWithZoomedCrops(img, merged, loaded);
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

  const { padX = 0.16, padY = 0.24, quality = 0.86 } = options;
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

    // Auto-detected MediaPipe boxes anchor slightly low (eyes-to-chin), so nudge 3% upward to cover eyebrows cleanly without swallowing hair or collars.
    const isManual = Boolean(box.manual);
    const effPadX = isManual ? 0.14 : padX;
    const effPadY = isManual ? 0.18 : padY;
    const cx = rawX + rawW / 2;
    const cy = rawY + rawH * (isManual ? 0.5 : 0.47);
    const rx = rawW * (0.5 + effPadX);
    const ry = rawH * (0.5 + effPadY);

    const x = Math.max(0, Math.floor(cx - rx));
    const y = Math.max(0, Math.floor(cy - ry));
    const x2 = Math.min(W, Math.ceil(cx + rx));
    const y2 = Math.min(H, Math.ceil(cy + ry));
    const pw = x2 - x;
    const ph = y2 - y;
    if (pw < 6 || ph < 6) continue;

    const blurRadius = Math.max(10, Math.min(36, Math.round(Math.max(rawW, rawH) * 0.22)));
    const bleed = Math.min(blurRadius * 2, 48);
    const sx = Math.max(0, x - bleed);
    const sy = Math.max(0, y - bleed);
    const sx2 = Math.min(W, x2 + bleed);
    const sy2 = Math.min(H, y2 + bleed);
    const sw = sx2 - sx;
    const sh = sy2 - sy;

    // 5-8px pixel collapse removes facial features irreversibly without bleeding hair/background too far inward
    const downW = Math.max(5, Math.min(8, Math.round(sw / Math.max(12, rawW * 0.22))));
    const downH = Math.max(5, Math.min(8, Math.round(sh / Math.max(12, rawH * 0.22))));
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
    // Solid opaque core fits snugly across eyebrows-to-chin (0.68), then feathers cleanly right along the hairline & jawline.
    const grad = patchCtx.createRadialGradient(0, 0, 0, 0, 0, 1);
    grad.addColorStop(0.0, 'rgba(0, 0, 0, 1)');
    grad.addColorStop(0.68, 'rgba(0, 0, 0, 1)');
    grad.addColorStop(0.84, 'rgba(0, 0, 0, 0.58)');
    grad.addColorStop(0.95, 'rgba(0, 0, 0, 0.16)');
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
 * with zoomed crop cross-verification and Gemini backend fallback, then apply radial-feathered Gaussian blur.
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
