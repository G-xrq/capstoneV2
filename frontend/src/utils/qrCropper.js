/**
 * Smart Pure-QR Matrix Extractor & Recipient Detector for GCash, Maya & QR Ph.
 *
 * 1. Decodes the QR matrix directly via cross-browser jsQR (plus native BarcodeDetector
 *    when available) for pixel-exact QR bounds AND instant EMVCo QR Ph Tag 59 recipient
 *    name extraction — working reliably across Windows, macOS, Linux, iOS, and Android.
 * 2. Isolates ONLY the square QR code matrix itself (stripping outer phone screenshot
 *    backgrounds AND embedded text like "Transfer fees may apply.", masked name,
 *    Mobile No., and User ID) with a spec-compliant white quiet zone.
 * 3. Builds a color-aware, high-contrast black-on-white OCR strip (converting GCash blue
 *    #007DFE, Maya green, and dark-mode text into sharp monochrome for Tesseract) so
 *    recipient names and masked/unmasked mobile numbers extract cleanly.
 */

import jsQR from 'jsqr';
import Tesseract from 'tesseract.js';

const runJsQr = typeof jsQR === 'function' ? jsQR : jsQR?.default;

const GENERIC_MERCHANT_NAMES = new Set([
  'GCASH', 'G-XCHANGE', 'GXCHANGE', 'MAYA', 'PAYMAYA', 'QRPH', 'QR PH',
  'INSTAPAY', 'PESONET', 'MERCHANT', 'NA', 'N/A', 'USER', 'UNKNOWN'
]);

/**
 * Parse a flat EMVCo TLV string into an array of { tag, value } pairs.
 */
function parseEmvTlv(str) {
  const entries = [];
  if (!str || typeof str !== 'string') return entries;
  let i = 0;
  let guard = 0;
  while (i + 4 <= str.length && guard < 120) {
    guard++;
    const tag = str.slice(i, i + 2);
    const len = parseInt(str.slice(i + 2, i + 4), 10);
    if (!/^\d{2}$/.test(tag) || Number.isNaN(len) || len < 0 || i + 4 + len > str.length) {
      break;
    }
    const value = str.slice(i + 4, i + 4 + len);
    entries.push({ tag, value });
    i += 4 + len;
  }
  return entries;
}

/**
 * Normalize an unmasked Philippine mobile string into "09XX XXX XXXX" or return "".
 */
function normalizeUnmaskedPhMobile(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!/^\+?(?:63|0)?9[\d\s.-]{9,13}$/.test(trimmed)) return '';
  let digits = trimmed.replace(/\D/g, '');
  if (digits.startsWith('639') && digits.length === 12) {
    digits = '0' + digits.slice(2);
  } else if (digits.length === 10 && digits.startsWith('9')) {
    digits = '0' + digits;
  }
  if (digits.length === 11 && digits.startsWith('09')) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return '';
}

/**
 * Parse an EMVCo QR Ph / GCash / Maya / InstaPay TLV payload.
 * Extracts:
 *   - recipientName: Tag 59 (Merchant / Recipient Name)
 *   - accountNumber: Unmasked PH mobile if embedded in Merchant Account Info (Tags 26-51 / 62)
 *   - channel: 'GCash' | 'Maya' | 'Bank' | '' inferred from BIC / AID
 */
export function parseEmvQrPayload(rawValue) {
  const empty = { recipientName: '', accountNumber: '', channel: '' };
  if (!rawValue || typeof rawValue !== 'string') return empty;
  const str = rawValue.trim();
  if (!str.startsWith('0002')) return empty;

  const topEntries = parseEmvTlv(str);
  let recipientName = '';
  let accountNumber = '';
  let channel = '';

  for (const { tag, value } of topEntries) {
    const numTag = parseInt(tag, 10);
    const cleanVal = value.trim();

    if (tag === '59' && cleanVal.length >= 2) {
      if (!GENERIC_MERCHANT_NAMES.has(cleanVal.toUpperCase())) {
        recipientName = cleanVal.replace(/\s+/g, ' ');
      }
    } else if ((numTag >= 26 && numTag <= 51) || tag === '62') {
      const subEntries = parseEmvTlv(value);
      for (const sub of subEntries) {
        const sv = sub.value.trim();
        const upper = sv.toUpperCase();

        if (!channel) {
          if (upper.includes('GXCHPHM2') || upper.includes('GCASH')) {
            channel = 'GCash';
          } else if (upper.includes('PAPHPHM1') || upper.includes('MAYAPHM2') || upper.includes('PAYMAYA') || upper.includes('MAYA')) {
            channel = 'Maya';
          } else if (/^(?:BOPI|BNOR|UBPH|MBTC|LAUI|GOTY|TLBP|CHBK|RCBC|SETC|PNBM|EWBC|AUBK|DBPH|PABC)PH/.test(upper)) {
            channel = 'Bank';
          }
        }

        // Only accept exact standalone PH mobile numbers in subtags (never merchant/terminal IDs)
        if (!accountNumber && (sub.tag === '02' || sub.tag === '03' || sub.tag === '04' || sub.tag === '01')) {
          const mob = normalizeUnmaskedPhMobile(sv);
          if (mob) accountNumber = mob;
        }
      }
    }
  }

  return { recipientName, accountNumber, channel };
}

/**
 * Parse EMVCo QR Ph / GCash / Maya TLV string for Tag 59 (Merchant / Recipient Name).
 */
export function parseEmvQrMerchantName(rawValue) {
  return parseEmvQrPayload(rawValue).recipientName;
}

/**
 * Attempt native browser BarcodeDetector (macOS/ChromeOS/Android) for pixel-exact QR bounds
 * and instant EMVCo payload decoding.
 */
async function detectWithBarcodeDetector(img) {
  try {
    if (typeof window === 'undefined' || !('BarcodeDetector' in window)) return null;
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    const barcodes = await detector.detect(img);
    if (!barcodes || barcodes.length === 0) return null;
    const first = barcodes[0];
    const bb = first?.boundingBox;
    if (!bb || bb.width < 40 || bb.height < 40) return null;
    return {
      x: Math.round(bb.x),
      y: Math.round(bb.y),
      width: Math.round(bb.width),
      height: Math.round(bb.height),
      rawValue: first.rawValue || ''
    };
  } catch (_) {
    return null;
  }
}

/**
 * Extract bounding box + rawValue from a jsQR result object.
 */
function jsQrHitToBounds(hit, scaleBackX = 1, scaleBackY = 1, offsetX = 0, offsetY = 0) {
  if (!hit || !hit.data) return null;
  const loc = hit.location;
  if (!loc) {
    return { x: 0, y: 0, width: 0, height: 0, rawValue: hit.data };
  }
  const xs = [
    loc.topLeftCorner?.x ?? 0,
    loc.topRightCorner?.x ?? 0,
    loc.bottomLeftCorner?.x ?? 0,
    loc.bottomRightCorner?.x ?? 0
  ];
  const ys = [
    loc.topLeftCorner?.y ?? 0,
    loc.topRightCorner?.y ?? 0,
    loc.bottomLeftCorner?.y ?? 0,
    loc.bottomRightCorner?.y ?? 0
  ];
  const minX = Math.min(...xs) * scaleBackX + offsetX;
  const maxX = Math.max(...xs) * scaleBackX + offsetX;
  const minY = Math.min(...ys) * scaleBackY + offsetY;
  const maxY = Math.max(...ys) * scaleBackY + offsetY;
  return {
    x: Math.round(minX),
    y: Math.round(minY),
    width: Math.round(maxX - minX),
    height: Math.round(maxY - minY),
    rawValue: hit.data
  };
}

/**
 * Run cross-browser pure-JS jsQR decoding on a canvas with automatic scaling &
 * high-contrast fallback passes so InstaPay/GCash/Maya QR codes with center logos
 * decode reliably on Windows, macOS, Linux, iOS, and Android.
 */
function decodeWithJsQrOnCanvas(canvas, w, h) {
  if (!runJsQr || !canvas || w < 40 || h < 40) return null;

  const tryDirect = (targetCanvas, tw, th, sx = 1, sy = 1, ox = 0, oy = 0) => {
    try {
      const tctx = targetCanvas.getContext('2d', { willReadFrequently: true });
      const imgData = tctx.getImageData(0, 0, tw, th);
      const hit = runJsQr(imgData.data, tw, th, { inversionAttempts: 'attemptBoth' });
      if (hit && hit.data) {
        return jsQrHitToBounds(hit, sx, sy, ox, oy);
      }
    } catch (_) {
      // ignore pass failure
    }
    return null;
  };

  // Pass 1: Direct decode (if image is moderate size) or downscaled to max 1100px for huge screenshots
  const maxDim = Math.max(w, h);
  if (maxDim <= 1250) {
    const direct = tryDirect(canvas, w, h, 1, 1);
    if (direct) return direct;
  } else {
    const scale = 1100 / maxDim;
    const sw = Math.max(60, Math.round(w * scale));
    const sh = Math.max(60, Math.round(h * scale));
    const scaled = document.createElement('canvas');
    scaled.width = sw;
    scaled.height = sh;
    const sctx = scaled.getContext('2d', { willReadFrequently: true });
    sctx.fillStyle = '#FFFFFF';
    sctx.fillRect(0, 0, sw, sh);
    sctx.drawImage(canvas, 0, 0, w, h, 0, 0, sw, sh);
    const hit = tryDirect(scaled, sw, sh, w / sw, h / sh);
    if (hit) return hit;

    // Also try native resolution if reasonable
    if (maxDim <= 2400) {
      const nativeHit = tryDirect(canvas, w, h, 1, 1);
      if (nativeHit) return nativeHit;
    }
  }

  // Pass 2: Upscale small images (< 360px) or add generous white quiet-zone border
  const pad = Math.max(24, Math.round(Math.min(w, h) * 0.1));
  const upScale = maxDim < 360 ? Math.min(3, Math.ceil(420 / Math.max(1, maxDim))) : 1;
  const pw = Math.round(w * upScale + pad * 2);
  const ph = Math.round(h * upScale + pad * 2);
  if (pw <= 1800 && ph <= 1800) {
    const padded = document.createElement('canvas');
    padded.width = pw;
    padded.height = ph;
    const pctx = padded.getContext('2d', { willReadFrequently: true });
    pctx.fillStyle = '#FFFFFF';
    pctx.fillRect(0, 0, pw, ph);
    pctx.imageSmoothingEnabled = upScale === 1;
    pctx.drawImage(canvas, 0, 0, w, h, pad, pad, Math.round(w * upScale), Math.round(h * upScale));
    const hit = tryDirect(padded, pw, ph, 1 / upScale, 1 / upScale, -pad / upScale, -pad / upScale);
    if (hit) return hit;

    // Pass 3: High-contrast binarized grayscale pass (recovers dim/washed-out photos)
    try {
      const bData = pctx.getImageData(0, 0, pw, ph);
      const d = bData.data;
      for (let i = 0; i < d.length; i += 4) {
        const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const v = lum < 138 ? 0 : 255;
        d[i] = v;
        d[i + 1] = v;
        d[i + 2] = v;
        d[i + 3] = 255;
      }
      const binHit = runJsQr(d, pw, ph, { inversionAttempts: 'attemptBoth' });
      if (binHit && binHit.data) {
        return jsQrHitToBounds(binHit, 1 / upScale, 1 / upScale, -pad / upScale, -pad / upScale);
      }
    } catch (_) {
      // ignore binarized pass failure
    }
  }

  return null;
}

/**
 * Build a color-aware, high-contrast black-on-white OCR canvas from a rectangular
 * region of the source screenshot.
 *
 * Converts GCash blue (#007DFE), Maya green (#00B25A), BPI red, and dark-mode white
 * text into razor-sharp black text on pure white for Tesseract.
 */
function buildPreprocessedOcrStrip(sourceCanvas, sx, sy, sw, sh) {
  if (!sourceCanvas || sw < 24 || sh < 18) return '';
  try {
    // Upscale narrow strips so small phone screenshot text is crisp for Tesseract
    const targetMinW = 760;
    const rawScale = sw < targetMinW ? Math.min(3, Math.ceil(targetMinW / sw)) : 1;
    const scale = Math.max(1, Math.min(3, rawScale));
    const pad = 24;
    const outW = Math.min(1600, Math.round(sw * scale) + pad * 2);
    const outH = Math.min(1600, Math.round(sh * scale) + pad * 2);
    const drawW = outW - pad * 2;
    const drawH = outH - pad * 2;

    const ocrCanvas = document.createElement('canvas');
    ocrCanvas.width = outW;
    ocrCanvas.height = outH;
    const ocrCtx = ocrCanvas.getContext('2d', { willReadFrequently: true });
    ocrCtx.fillStyle = '#FFFFFF';
    ocrCtx.fillRect(0, 0, outW, outH);
    ocrCtx.drawImage(sourceCanvas, sx, sy, sw, sh, pad, pad, drawW, drawH);

    // Detect whether the text card itself has a light or dark background
    const imgData = ocrCtx.getImageData(pad, pad, drawW, drawH);
    const d = imgData.data;

    let bgLumSum = 0;
    let bgSamples = 0;
    const samplePx = (px, py) => {
      const idx = (py * drawW + px) * 4;
      bgLumSum += 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2];
      bgSamples++;
    };
    const stepX = Math.max(1, Math.floor(drawW / 16));
    for (let x = 0; x < drawW; x += stepX) {
      samplePx(x, 2);
      samplePx(x, Math.max(0, drawH - 3));
    }
    const avgBgLum = bgSamples > 0 ? bgLumSum / bgSamples : 255;
    const isDarkCard = avgBgLum < 115;

    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      let v;
      if (isDarkCard) {
        // Light/colored text on dark card -> invert max channel so text becomes dark
        const bright = Math.max(r, g, b);
        v = 255 - bright;
        if (v <= 95) v = 0;
        else if (v >= 185) v = 255;
        else v = Math.round(((v - 95) / 90) * 255);
      } else {
        // Colored or dark text on light/white card -> min(r,g,b) turns #007DFE blue to 0 (pure black!)
        const minC = Math.min(r, g, b);
        if (minC <= 135) v = 0;
        else if (minC >= 225) v = 255;
        else v = Math.round(((minC - 135) / 90) * 255);
      }
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = 255;
    }

    ocrCtx.putImageData(imgData, pad, pad);
    return ocrCanvas.toDataURL('image/png', 0.95);
  } catch (_) {
    return '';
  }
}

export async function autoCropQrScreenshot(dataUrlOrFile) {
  let dataUrl = '';
  if (dataUrlOrFile instanceof File || dataUrlOrFile instanceof Blob) {
    dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(dataUrlOrFile);
    });
  } else if (typeof dataUrlOrFile === 'string') {
    dataUrl = dataUrlOrFile;
  } else {
    return {
      croppedUrl: dataUrlOrFile,
      ocrSourceUrl: dataUrlOrFile,
      ocrTopSourceUrl: '',
      rawQrValue: '',
      emvRecipientName: '',
      emvAccountNumber: '',
      emvChannel: '',
      wasCropped: false
    };
  }

  if (!dataUrl || typeof dataUrl !== 'string') {
    return {
      croppedUrl: dataUrlOrFile,
      ocrSourceUrl: dataUrlOrFile,
      ocrTopSourceUrl: '',
      rawQrValue: '',
      emvRecipientName: '',
      emvAccountNumber: '',
      emvChannel: '',
      wasCropped: false
    };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;

        if (!w || !h || w < 60 || h < 60) {
          return resolve({
            croppedUrl: dataUrl,
            ocrSourceUrl: dataUrl,
            ocrTopSourceUrl: '',
            rawQrValue: '',
            emvRecipientName: '',
            emvAccountNumber: '',
            emvChannel: '',
            wasCropped: false,
            width: w,
            height: h
          });
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);

        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        const getPixel = (x, y) => {
          const cx = Math.max(0, Math.min(w - 1, x));
          const cy = Math.max(0, Math.min(h - 1, y));
          const idx = (cy * w + cx) * 4;
          return {
            r: data[idx],
            g: data[idx + 1],
            b: data[idx + 2],
            a: data[idx + 3]
          };
        };

        // 1. Detect outer phone-screenshot background (GCash blue, Maya dark/green)
        const isBlueBg = (p) => (p.b > 110 && p.b > p.r * 1.25 && p.b > p.g * 1.05) || (p.b > 150 && p.r < 90);
        const isDarkBg = (p) => p.r < 38 && p.g < 38 && p.b < 38;
        const isGreenBg = (p) => p.g > 125 && p.g > p.r * 1.2 && p.g > p.b * 1.1;

        const edgePoints = [
          getPixel(Math.round(w / 2), h - 6),
          getPixel(12, h - 6),
          getPixel(w - 12, h - 6),
          getPixel(Math.round(w / 2), 6),
          getPixel(12, 6),
          getPixel(w - 12, 6),
          getPixel(6, Math.round(h / 2)),
          getPixel(w - 6, Math.round(h / 2))
        ];

        let blueCount = 0;
        let darkCount = 0;
        let greenCount = 0;
        for (const p of edgePoints) {
          if (isBlueBg(p)) blueCount++;
          else if (isDarkBg(p)) darkCount++;
          else if (isGreenBg(p)) greenCount++;
        }

        let bgType = 'none';
        if (blueCount >= 1) bgType = 'blue';
        else if (darkCount >= 2) bgType = 'dark';
        else if (greenCount >= 1) bgType = 'green';

        const isImageBgPixel = (p) => {
          if (bgType === 'blue') return isBlueBg(p);
          if (bgType === 'dark') return isDarkBg(p);
          if (bgType === 'green') return isGreenBg(p);
          return false;
        };

        // Pure dark monochrome QR module pixel (excludes blue GCash name & gray footer text)
        const isQrBlack = (p) => {
          if (p.a < 128) return false;
          const maxC = Math.max(p.r, p.g, p.b);
          const minC = Math.min(p.r, p.g, p.b);
          return maxC < 78 && (maxC - minC) < 40;
        };

        // 2. Decode QR payload & pixel-exact bounds:
        //    Try native BarcodeDetector first, then cross-browser pure-JS jsQR!
        let qrMinX = w, qrMaxX = 0, qrMinY = h, qrMaxY = 0;
        let rawQrValue = '';

        let decodedHit = await detectWithBarcodeDetector(img);
        if (!decodedHit || !decodedHit.rawValue) {
          const jsQrHit = decodeWithJsQrOnCanvas(canvas, w, h);
          if (jsQrHit) {
            decodedHit = jsQrHit;
          }
        }

        if (decodedHit && decodedHit.width >= 40 && decodedHit.height >= 40) {
          qrMinX = Math.max(0, decodedHit.x);
          qrMinY = Math.max(0, decodedHit.y);
          qrMaxX = Math.min(w, decodedHit.x + decodedHit.width);
          qrMaxY = Math.min(h, decodedHit.y + decodedHit.height);
          rawQrValue = decodedHit.rawValue || '';
        } else {
          // 3. Fallback: High-transition horizontal/vertical QR density projection
          // Finds ONLY the dense square QR matrix, ignoring headers and text rows below.
          const marginX = Math.max(4, Math.round(w * 0.02));
          const xStart = marginX;
          const xEnd = w - marginX;
          const rowActive = new Uint8Array(h);

          for (let y = 4; y < h - 4; y++) {
            let blackCount = 0;
            let transitions = 0;
            let prevBlack = false;
            for (let x = xStart; x < xEnd; x += 2) {
              const p = getPixel(x, y);
              const blk = isQrBlack(p) && !(bgType === 'dark' && (x < w * 0.08 || x > w * 0.92));
              if (blk) blackCount++;
              if (blk !== prevBlack) {
                transitions++;
                prevBlack = blk;
              }
            }
            if (transitions >= 14 && blackCount >= Math.max(12, Math.round(w * 0.045))) {
              rowActive[y] = 1;
            }
          }

          const gapBridge = Math.max(10, Math.round(h * 0.035));
          let lastOn = -1;
          for (let y = 0; y < h; y++) {
            if (rowActive[y]) {
              if (lastOn >= 0 && y - lastOn <= gapBridge) {
                for (let fill = lastOn + 1; fill < y; fill++) rowActive[fill] = 1;
              }
              lastOn = y;
            }
          }

          let bestStart = -1, bestEnd = -1, bestLen = 0;
          let curStart = -1;
          for (let y = 0; y < h; y++) {
            if (rowActive[y]) {
              if (curStart === -1) curStart = y;
            } else if (curStart !== -1) {
              const len = y - curStart;
              if (len > bestLen) {
                bestLen = len;
                bestStart = curStart;
                bestEnd = y - 1;
              }
              curStart = -1;
            }
          }
          if (curStart !== -1 && (h - curStart) > bestLen) {
            bestLen = h - curStart;
            bestStart = curStart;
            bestEnd = h - 1;
          }

          if (bestLen >= 50 && bestStart >= 0) {
            qrMinY = bestStart;
            qrMaxY = bestEnd;

            const colActive = new Uint8Array(w);
            for (let x = xStart; x < xEnd; x++) {
              let blk = 0;
              let vTrans = 0;
              let prev = false;
              for (let y = qrMinY; y <= qrMaxY; y += 2) {
                const isB = isQrBlack(getPixel(x, y));
                if (isB) blk++;
                if (isB !== prev) {
                  vTrans++;
                  prev = isB;
                }
              }
              if (vTrans >= 10 && blk >= Math.max(8, Math.round(bestLen * 0.07))) {
                colActive[x] = 1;
              }
            }

            let cStart = -1, cEnd = -1, cBestLen = 0, cCur = -1;
            const cGap = Math.max(10, Math.round(w * 0.035));
            let cLastOn = -1;
            for (let x = 0; x < w; x++) {
              if (colActive[x]) {
                if (cLastOn >= 0 && x - cLastOn <= cGap) {
                  for (let fill = cLastOn + 1; fill < x; fill++) colActive[fill] = 1;
                }
                cLastOn = x;
              }
            }
            for (let x = 0; x < w; x++) {
              if (colActive[x]) {
                if (cCur === -1) cCur = x;
              } else if (cCur !== -1) {
                const len = x - cCur;
                if (len > cBestLen) {
                  cBestLen = len;
                  cStart = cCur;
                  cEnd = x - 1;
                }
                cCur = -1;
              }
            }
            if (cCur !== -1 && (w - cCur) > cBestLen) {
              cBestLen = w - cCur;
              cStart = cCur;
              cEnd = w - 1;
            }

            if (cBestLen >= 50 && cStart >= 0) {
              qrMinX = cStart;
              qrMaxX = cEnd;
            }
          }
        }

        const rawQrW = qrMaxX - qrMinX;
        const rawQrH = qrMaxY - qrMinY;

        if (rawQrW < 40 || rawQrH < 40 || qrMinX >= qrMaxX || qrMinY >= qrMaxY) {
          const emv = parseEmvQrPayload(rawQrValue);
          return resolve({
            croppedUrl: dataUrl,
            ocrSourceUrl: dataUrl,
            ocrTopSourceUrl: '',
            rawQrValue,
            emvRecipientName: emv.recipientName,
            emvAccountNumber: emv.accountNumber,
            emvChannel: emv.channel,
            wasCropped: false,
            width: w,
            height: h
          });
        }

        // Enforce tight 1:1 square around the QR matrix
        let sqSide = Math.min(rawQrW, rawQrH);
        const ratio = Math.max(rawQrW, rawQrH) / Math.max(1, sqSide);
        if (ratio <= 1.18) {
          sqSide = Math.max(rawQrW, rawQrH);
        } else {
          sqSide = rawQrW;
        }

        const cx = (qrMinX + qrMaxX) / 2;
        const cy = ratio > 1.18 ? (qrMinY + sqSide / 2) : ((qrMinY + qrMaxY) / 2);

        const quietPad = Math.max(12, Math.round(sqSide * 0.065));
        const srcX = Math.max(0, Math.round(cx - sqSide / 2 - quietPad));
        const srcY = Math.max(0, Math.round(cy - sqSide / 2 - quietPad));
        const srcMaxX = Math.min(w, Math.round(cx + sqSide / 2 + quietPad));
        const srcMaxY = Math.min(h, Math.round(cy + sqSide / 2 + quietPad));
        const srcW = Math.max(1, srcMaxX - srcX);
        const srcH = Math.max(1, srcMaxY - srcY);

        // 4. Render ONLY the pure square QR matrix centered onto a crisp white square canvas
        const outSide = Math.max(srcW, srcH);
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = outSide;
        cropCanvas.height = outSide;
        const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true });
        cropCtx.fillStyle = '#FFFFFF';
        cropCtx.fillRect(0, 0, outSide, outSide);
        const dx = Math.round((outSide - srcW) / 2);
        const dy = Math.round((outSide - srcH) / 2);
        cropCtx.drawImage(canvas, srcX, srcY, srcW, srcH, dx, dy, srcW, srcH);

        // If full-image jsQR didn't decode (e.g. small QR inside tall phone screenshot),
        // decode the isolated pure-QR square now!
        if (!rawQrValue) {
          const croppedHit = decodeWithJsQrOnCanvas(cropCanvas, outSide, outSide);
          if (croppedHit && croppedHit.rawValue) {
            rawQrValue = croppedHit.rawValue;
          }
        }

        const emv = parseEmvQrPayload(rawQrValue);

        // 5. Build preprocessed color-aware OCR text strips (BELOW and optionally ABOVE the QR)
        let ocrSourceUrl = '';
        let ocrTopSourceUrl = '';
        try {
          let bottomBgY = h;
          if (bgType !== 'none') {
            for (let y = h - 1; y >= Math.round(h * 0.4); y--) {
              const pMid = getPixel(Math.round(w / 2), y);
              if (isImageBgPixel(pMid)) bottomBgY = y;
              else break;
            }
          }
          const textTop = Math.min(h - 1, Math.round(cy + sqSide / 2 + 2));
          const textBottom = Math.min(h, bottomBgY);
          const textH = textBottom - textTop;
          const txLeft = Math.max(0, Math.round(cx - sqSide * 0.85));
          const txRight = Math.min(w, Math.round(cx + sqSide * 0.85));
          const txW = Math.max(1, txRight - txLeft);

          if (textH >= 24) {
            ocrSourceUrl = buildPreprocessedOcrStrip(canvas, txLeft, textTop, txW, textH);
          }

          // Also capture text strip ABOVE QR for bank/Maya cards that place Account Name above the matrix
          let topBgY = 0;
          if (bgType !== 'none') {
            for (let y = 0; y < Math.round(h * 0.45); y++) {
              const pMid = getPixel(Math.round(w / 2), y);
              if (isImageBgPixel(pMid)) topBgY = y;
              else break;
            }
          }
          const topTextBottom = Math.max(0, Math.round(cy - sqSide / 2 - 2));
          const topTextH = topTextBottom - topBgY;
          if (topTextH >= 28) {
            ocrTopSourceUrl = buildPreprocessedOcrStrip(canvas, txLeft, topBgY, txW, topTextH);
          }
        } catch (_) {
          ocrSourceUrl = '';
        }

        const needsCrop = (srcW < w - 12) || (srcH < h - 12) || (srcX > 8) || (srcY > 8);
        const croppedUrl = cropCanvas.toDataURL('image/png', 0.95);

        resolve({
          croppedUrl: needsCrop ? croppedUrl : dataUrl,
          ocrSourceUrl,
          ocrTopSourceUrl,
          rawQrValue,
          emvRecipientName: emv.recipientName,
          emvAccountNumber: emv.accountNumber,
          emvChannel: emv.channel,
          wasCropped: needsCrop,
          width: outSide,
          height: outSide,
          bounds: { x: srcX, y: srcY, width: srcW, height: srcH }
        });
      } catch (err) {
        console.warn('QR auto-crop warning:', err);
        resolve({
          croppedUrl: dataUrl,
          ocrSourceUrl: dataUrl,
          ocrTopSourceUrl: '',
          rawQrValue: '',
          emvRecipientName: '',
          emvAccountNumber: '',
          emvChannel: '',
          wasCropped: false
        });
      }
    };
    img.onerror = () => resolve({
      croppedUrl: dataUrl,
      ocrSourceUrl: dataUrl,
      ocrTopSourceUrl: '',
      rawQrValue: '',
      emvRecipientName: '',
      emvAccountNumber: '',
      emvChannel: '',
      wasCropped: false
    });
    img.src = dataUrl;
  });
}

/**
 * Parse phone/account number from OCR text, handling full 11-digit PH mobile numbers,
 * explicitly masked numbers (0997 993 •••• / ****), and 7-digit truncated GCash masked
 * numbers (where OCR dropped the trailing 4 bullets).
 */
function parseNumberFromOcrText(text) {
  if (!text) return { detectedNumber: '', isMaskedNumber: false };

  // 1. Explicit full 11-digit PH mobile anywhere in text
  const fullPhMatch = text.match(/(?:\+?63\s*9|09)\d{2}[\s.-]?\d{3}[\s.-]?\d{4}\b/);
  if (fullPhMatch) {
    const formatted = normalizeUnmaskedPhMobile(fullPhMatch[0]);
    if (formatted) {
      return { detectedNumber: formatted, isMaskedNumber: false };
    }
  }

  // 2. Masked PH mobile (explicit bullets/asterisks/dots OR 7-digit prefix after "Mobile No.")
  const labeledMatch = text.match(/(?:Mobile\s*No\.?|Phone|Number)[\s:.]*(\+?(?:63\s*9|09)[\d*•●·∙◦○▪■°xX\s.-]{5,22})/i);
  const maskedInlineMatch = text.match(/\b((?:\+?63\s*9|09)\d{2}[\s.-]?\d{3}[\s.-]?[*•●·∙◦○▪■°xX.]{2,6})/);
  const candidate = labeledMatch?.[1] || maskedInlineMatch?.[1] || '';

  if (candidate) {
    // Try unmasked first just in case
    const cleanFull = normalizeUnmaskedPhMobile(candidate);
    if (cleanFull) {
      return { detectedNumber: cleanFull, isMaskedNumber: false };
    }

    // Extract leading numeric digits (usually 7 digits for "0997 993 ••••" or 8 digits for "+63 997 993 ••••")
    let leadingDigits = candidate.replace(/[*•●·∙◦○▪■°xX].*$/, '').replace(/\D/g, '');
    if (leadingDigits.startsWith('639') && leadingDigits.length >= 8) {
      leadingDigits = '0' + leadingDigits.slice(2);
    } else if (leadingDigits.startsWith('9') && leadingDigits.length >= 6 && leadingDigits.length <= 7) {
      leadingDigits = '0' + leadingDigits;
    }

    if (leadingDigits.startsWith('09') && leadingDigits.length >= 7 && leadingDigits.length < 11) {
      const prefix = `${leadingDigits.slice(0, 4)} ${leadingDigits.slice(4, 7)}`;
      return { detectedNumber: `${prefix} ****`, isMaskedNumber: true };
    }
    if (leadingDigits.startsWith('09') && leadingDigits.length === 11) {
      return {
        detectedNumber: `${leadingDigits.slice(0, 4)} ${leadingDigits.slice(4, 7)} ${leadingDigits.slice(7)}`,
        isMaskedNumber: false
      };
    }
  }

  // 3. Standalone 7-digit PH prefix (e.g. OCR read "0997 993" and completely dropped "Mobile No.:" + "••••")
  const partialPrefix = text.match(/\b((?:\+?63\s*9|09)\d{2}[\s.-]\d{3})(?!\s*\d)/);
  if (partialPrefix) {
    let digits = partialPrefix[1].replace(/\D/g, '');
    if (digits.startsWith('639') && digits.length === 8) digits = '0' + digits.slice(2);
    if (digits.startsWith('09') && digits.length === 7) {
      return { detectedNumber: `${digits.slice(0, 4)} ${digits.slice(4, 7)} ****`, isMaskedNumber: true };
    }
  }

  // 4. Bank Account Number (e.g. "Account No.: 1234-5678-9012")
  const bankMatch = text.match(/(?:Account\s*No\.?|Acct\.?\s*No\.?)[\s:.]*([0-9*•●\s-]{8,22})/i);
  if (bankMatch) {
    const rawAcct = bankMatch[1].replace(/[•●·]/g, '*').replace(/\s+/g, ' ').trim();
    if (rawAcct.replace(/\D/g, '').length >= 6) {
      return { detectedNumber: rawAcct, isMaskedNumber: rawAcct.includes('*') };
    }
  }

  return { detectedNumber: '', isMaskedNumber: false };
}

/**
 * Parse Recipient Name from OCR lines (fallback when EMVCo Tag 59 is absent or masked).
 */
function parseNameFromOcrText(text) {
  if (!text) return '';
  const NOISE_RE = /(transfer|fees|apply|gcash|maya|paymaya|instapay|qr\s*ph|mobile\s*no|user\s*id|verified|scan|download|share|save|powered\s*by|bsp|pesonet|account\s*no|bank\s*transfer|receive\s*money|send\s*money)/i;

  const normalizeMaskDots = (s) =>
    s
      .replace(/[•●·∙◦○▪■°©®@]/g, '*')
      .replace(/(?<=[A-Z])[eoca08o]+(?=[A-Z])/g, (m) => '*'.repeat(m.length))
      .replace(/[,;:!?]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const lines = text
    .split('\n')
    .map((l) => l.replace(/[|_~`[\]{}]/g, '').replace(/\s+/g, ' ').trim())
    .filter((l) => l.length >= 1 && l.length <= 52);

  const isNoiseOrDigits = (line) =>
    !line || NOISE_RE.test(line) || /^\+?[\d\s*•●·∙◦○°.-]{4,}$/.test(line);

  const isContinuationLine = (line) => {
    if (isNoiseOrDigits(line)) return false;
    const norm = normalizeMaskDots(line);
    if (/^[A-Z]\.?$/.test(norm)) return true;
    if (/^(?:JR|SR|II|III|IV)\.?$/i.test(norm)) return true;
    if (/^[A-Za-z][A-Za-z\s.*'-]{1,28}$/.test(norm) && (/[A-Z]{2,}/.test(norm) || /\*/.test(norm))) {
      return true;
    }
    return false;
  };

  // Pass 1: Prefer GCash/Maya masked or uppercase recipient name line (e.g. "CL***E JU*****E V." + wrapped "S.")
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length < 3 || isNoiseOrDigits(line)) continue;
    const norm = normalizeMaskDots(line);
    if (/^[A-Za-z][A-Za-z\s.*'-]{2,44}$/.test(norm) && (/[A-Z]{2,}/.test(norm) || /\*/.test(norm))) {
      let full = norm;
      for (let k = 1; k <= 2 && i + k < lines.length; k++) {
        const nextLine = lines[i + k];
        if (isContinuationLine(nextLine)) {
          full = `${full} ${normalizeMaskDots(nextLine)}`.trim();
        } else {
          break;
        }
      }
      return full;
    }
  }

  // Pass 2: Any clean multi-word Title Case / mixed-case name line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length < 4 || isNoiseOrDigits(line)) continue;
    const norm = normalizeMaskDots(line);
    if (/^[A-Za-z][A-Za-z\s.'-]{3,44}$/.test(norm) && norm.includes(' ')) {
      let full = norm;
      if (i + 1 < lines.length && isContinuationLine(lines[i + 1])) {
        full = `${full} ${normalizeMaskDots(lines[i + 1])}`.trim();
      }
      return full;
    }
  }

  return '';
}

/**
 * Extract Recipient Account Name and Mobile/Account Number from a QR screenshot/voucher.
 * Accepts either:
 *   - The result object from `autoCropQrScreenshot` (uses instant cross-browser EMVCo Tag 59 + high-contrast OCR), OR
 *   - A plain image URL / data URL string (backward-compatible — automatically runs EMVCo + OCR).
 */
export async function extractQrVoucherText(imageOrResult) {
  try {
    let cropResult = imageOrResult;
    if (typeof imageOrResult === 'string' && imageOrResult) {
      cropResult = await autoCropQrScreenshot(imageOrResult);
    }

    const isObj = cropResult && typeof cropResult === 'object';
    const emvName = isObj ? String(cropResult.emvRecipientName || '').trim() : '';
    const emvNumber = isObj ? String(cropResult.emvAccountNumber || '').trim() : '';
    const emvChannel = isObj ? String(cropResult.emvChannel || '').trim() : '';
    const bottomOcrUrl = isObj ? (cropResult.ocrSourceUrl || '') : '';
    const topOcrUrl = isObj ? (cropResult.ocrTopSourceUrl || '') : '';

    let text = '';
    let detectedName = emvName;
    let detectedNumber = emvNumber;
    let isMaskedNumber = Boolean(detectedNumber && detectedNumber.includes('*'));
    let nameSource = emvName ? 'emv' : 'none';

    // If EMVCo already gave us BOTH an unmasked name and an unmasked number, skip slow OCR!
    const needOcrForNumber = !detectedNumber;
    const needOcrForName = !detectedName || detectedName.includes('*');

    const runOcrPass = async (imgUrl) => {
      if (!imgUrl) return '';
      const res = await Tesseract.recognize(imgUrl, 'eng');
      return res?.data?.text || '';
    };

    if ((needOcrForName || needOcrForNumber) && bottomOcrUrl) {
      const bottomText = await runOcrPass(bottomOcrUrl);
      text = bottomText;

      if (needOcrForNumber) {
        const parsedNum = parseNumberFromOcrText(bottomText);
        if (parsedNum.detectedNumber) {
          detectedNumber = parsedNum.detectedNumber;
          isMaskedNumber = parsedNum.isMaskedNumber;
        }
      }

      if (needOcrForName) {
        const ocrName = parseNameFromOcrText(bottomText);
        if (ocrName) {
          if (!detectedName) {
            detectedName = ocrName;
            nameSource = 'ocr';
          } else if (detectedName.includes('*') && !ocrName.includes('*')) {
            // Upgrade masked EMVCo P2P name ONLY if OCR found a matching unmasked full name
            if (ocrName[0]?.toUpperCase() === detectedName[0]?.toUpperCase()) {
              detectedName = ocrName;
              nameSource = 'ocr';
            }
          }
        }
      }
    }

    // Fallback: Check text strip ABOVE the QR matrix (for Bank/Maya cards with top header names)
    if ((!detectedName || !detectedNumber) && topOcrUrl) {
      const topText = await runOcrPass(topOcrUrl);
      text = text ? `${text}\n${topText}` : topText;

      if (!detectedNumber) {
        const parsedNum = parseNumberFromOcrText(topText);
        if (parsedNum.detectedNumber) {
          detectedNumber = parsedNum.detectedNumber;
          isMaskedNumber = parsedNum.isMaskedNumber;
        }
      }

      if (!detectedName) {
        const ocrName = parseNameFromOcrText(topText);
        if (ocrName) {
          detectedName = ocrName;
          nameSource = 'ocr';
        }
      }
    }

    return {
      text,
      detectedName,
      detectedNumber,
      isMaskedNumber,
      nameSource,
      emvChannel
    };
  } catch (err) {
    console.warn('OCR extraction warning:', err);
    return {
      text: '',
      detectedName: '',
      detectedNumber: '',
      isMaskedNumber: false,
      nameSource: 'none',
      emvChannel: ''
    };
  }
}
