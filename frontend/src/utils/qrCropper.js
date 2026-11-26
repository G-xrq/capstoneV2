/**
 * Smart Pure-QR Matrix Extractor & Recipient Detector for GCash, Maya & QR Ph.
 *
 * 1. Isolates ONLY the square QR code matrix itself (stripping outer phone screenshot
 *    backgrounds AND embedded text like "Transfer fees may apply.", masked name,
 *    Mobile No., and User ID) with a spec-compliant white quiet zone.
 * 2. Preserves an `ocrSourceUrl` of the recipient text band below the QR (plus native
 *    EMVCo Tag 59 decoding when BarcodeDetector is available) so NGO uploaders can
 *    auto-extract the Recipient Name & Number cleanly into structured form fields.
 */

import Tesseract from 'tesseract.js';

/**
 * Parse EMVCo QR Ph / GCash / Maya TLV string for Tag 59 (Merchant / Recipient Name).
 */
export function parseEmvQrMerchantName(rawValue) {
  if (!rawValue || typeof rawValue !== 'string') return '';
  const str = rawValue.trim();
  if (!str.startsWith('0002')) return '';

  const GENERIC = new Set([
    'GCASH', 'G-XCHANGE', 'GXCHANGE', 'MAYA', 'PAYMAYA', 'QRPH', 'QR PH',
    'INSTAPAY', 'PESONET', 'MERCHANT', 'NA', 'N/A', 'USER'
  ]);

  let i = 0;
  let guard = 0;
  while (i + 4 <= str.length && guard < 80) {
    guard++;
    const tag = str.slice(i, i + 2);
    const len = parseInt(str.slice(i + 2, i + 4), 10);
    if (isNaN(len) || len < 0 || i + 4 + len > str.length) break;
    const val = str.slice(i + 4, i + 4 + len).trim();
    if (tag === '59' && val.length >= 2) {
      if (!GENERIC.has(val.toUpperCase())) {
        return val;
      }
    }
    i += 4 + len;
  }
  return '';
}

/**
 * Attempt native browser BarcodeDetector (Chrome/Edge/Android) for pixel-exact QR bounds
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
    return { croppedUrl: dataUrlOrFile, ocrSourceUrl: dataUrlOrFile, emvRecipientName: '', wasCropped: false };
  }

  if (!dataUrl || typeof dataUrl !== 'string') {
    return { croppedUrl: dataUrlOrFile, ocrSourceUrl: dataUrlOrFile, emvRecipientName: '', wasCropped: false };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;

        if (!w || !h || w < 60 || h < 60) {
          return resolve({ croppedUrl: dataUrl, ocrSourceUrl: dataUrl, emvRecipientName: '', wasCropped: false, width: w, height: h });
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
          // Near-black & low chroma (QR modules are pure black/charcoal)
          return maxC < 78 && (maxC - minC) < 40;
        };

        // 2. Try native BarcodeDetector first for pixel-exact matrix bounds + EMVCo payload
        let qrMinX = w, qrMaxX = 0, qrMinY = h, qrMaxY = 0;
        let rawQrValue = '';
        let emvRecipientName = '';

        const nativeHit = await detectWithBarcodeDetector(img);
        if (nativeHit) {
          qrMinX = Math.max(0, nativeHit.x);
          qrMinY = Math.max(0, nativeHit.y);
          qrMaxX = Math.min(w, nativeHit.x + nativeHit.width);
          qrMaxY = Math.min(h, nativeHit.y + nativeHit.height);
          rawQrValue = nativeHit.rawValue;
          emvRecipientName = parseEmvQrMerchantName(rawQrValue);
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
            // QR matrix rows have high alternating black/white transitions (>= 14 edges)
            if (transitions >= 14 && blackCount >= Math.max(12, Math.round(w * 0.045))) {
              rowActive[y] = 1;
            }
          }

          // Close small vertical gaps (up to 16px, e.g., center logo like InstaPay/GCash)
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

          // Find tallest contiguous active vertical band (the QR matrix itself)
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

            // Now find exact horizontal bounds inside [qrMinY, qrMaxY]
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

        if (rawQrW < 50 || rawQrH < 50 || qrMinX >= qrMaxX || qrMinY >= qrMaxY) {
          return resolve({
            croppedUrl: dataUrl,
            ocrSourceUrl: dataUrl,
            rawQrValue,
            emvRecipientName,
            wasCropped: false,
            width: w,
            height: h
          });
        }

        // Enforce tight 1:1 square around the QR matrix (trims any slight vertical bleed from finder/text)
        let sqSide = Math.min(rawQrW, rawQrH);
        const ratio = Math.max(rawQrW, rawQrH) / Math.max(1, sqSide);
        if (ratio <= 1.18) {
          sqSide = Math.max(rawQrW, rawQrH);
        } else {
          // If height accidentally bled into a nearby line, clamp height to width (QR codes are always square!)
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

        // 4. Build OCR text strip from the region BELOW the QR matrix BEFORE discarding text
        let ocrSourceUrl = dataUrl;
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
          if (textH >= 28) {
            const txLeft = Math.max(0, Math.round(cx - sqSide * 0.72));
            const txRight = Math.min(w, Math.round(cx + sqSide * 0.72));
            const txW = Math.max(1, txRight - txLeft);
            const ocrCanvas = document.createElement('canvas');
            // Upscale 2x for much sharper Tesseract reading on small GCash/Maya text
            const scale = txW < 420 ? 2 : 1;
            ocrCanvas.width = txW * scale;
            ocrCanvas.height = textH * scale;
            const ocrCtx = ocrCanvas.getContext('2d');
            ocrCtx.fillStyle = '#FFFFFF';
            ocrCtx.fillRect(0, 0, ocrCanvas.width, ocrCanvas.height);
            ocrCtx.drawImage(canvas, txLeft, textTop, txW, textH, 0, 0, ocrCanvas.width, ocrCanvas.height);
            ocrSourceUrl = ocrCanvas.toDataURL('image/png', 0.95);
          }
        } catch (_) {
          ocrSourceUrl = dataUrl;
        }

        // 5. Render ONLY the pure square QR matrix centered onto a crisp white square canvas
        const outSide = Math.max(srcW, srcH);
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = outSide;
        cropCanvas.height = outSide;
        const cropCtx = cropCanvas.getContext('2d');
        cropCtx.fillStyle = '#FFFFFF';
        cropCtx.fillRect(0, 0, outSide, outSide);
        const dx = Math.round((outSide - srcW) / 2);
        const dy = Math.round((outSide - srcH) / 2);
        cropCtx.drawImage(canvas, srcX, srcY, srcW, srcH, dx, dy, srcW, srcH);

        const needsCrop = (srcW < w - 12) || (srcH < h - 12) || (srcX > 8) || (srcY > 8);
        const croppedUrl = cropCanvas.toDataURL('image/png', 0.95);

        resolve({
          croppedUrl: needsCrop ? croppedUrl : dataUrl,
          ocrSourceUrl,
          rawQrValue,
          emvRecipientName,
          wasCropped: needsCrop,
          width: outSide,
          height: outSide,
          bounds: { x: srcX, y: srcY, width: srcW, height: srcH }
        });
      } catch (err) {
        console.warn('QR auto-crop warning:', err);
        resolve({ croppedUrl: dataUrl, ocrSourceUrl: dataUrl, emvRecipientName: '', wasCropped: false });
      }
    };
    img.onerror = () => resolve({ croppedUrl: dataUrl, ocrSourceUrl: dataUrl, emvRecipientName: '', wasCropped: false });
    img.src = dataUrl;
  });
}

/**
 * Extract Recipient Account Name and Mobile Number from a QR screenshot/voucher.
 * Accepts either:
 *   - The result object from `autoCropQrScreenshot` (uses fast EMVCo Tag 59 + clean OCR text strip), OR
 *   - A plain image URL / data URL string (backward-compatible).
 */
export async function extractQrVoucherText(imageOrResult) {
  try {
    const isObj = imageOrResult && typeof imageOrResult === 'object';
    const imageUrl = isObj ? (imageOrResult.ocrSourceUrl || imageOrResult.croppedUrl || '') : imageOrResult;
    const emvName = isObj ? String(imageOrResult.emvRecipientName || '').trim() : '';

    let text = '';
    let detectedName = emvName;
    let detectedNumber = '';

    if (imageUrl) {
      const res = await Tesseract.recognize(imageUrl, 'eng');
      text = res?.data?.text || '';

      // Detect mobile number (unmasked 09XX/+63 9XX or masked 09XX/+63 9XX *** ****)
      const phoneMatch =
        text.match(/(?:Mobile\s*No\.?|Number)[\s:.]*(\+?[0-9*•●·\s.-]{9,20})/i) ||
        text.match(/\b((?:\+?63\s*9|09)\d{2}[\s.-]?\d{3}[\s.-]?[\d*•●·]{4})\b/);
      if (phoneMatch) {
        let rawNum = phoneMatch[1].replace(/[•●·]/g, '*').replace(/\s+/g, ' ').trim();
        if (!/\*/.test(rawNum)) {
          let digits = rawNum.replace(/\D/g, '');
          if (digits.startsWith('639') && digits.length >= 12) {
            digits = '0' + digits.slice(2, 12);
          } else if (digits.length === 10 && digits.startsWith('9')) {
            digits = '0' + digits;
          }
          if (digits.length === 11 && digits.startsWith('09')) {
            rawNum = `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
          }
        }
        detectedNumber = rawNum;
      }

      // If EMVCo Tag 59 didn't already give us the recipient name, parse from OCR lines (including wrapped 2nd line initials like "S.")
      if (!detectedName) {
        const NOISE_RE = /(transfer|fees|apply|gcash|maya|paymaya|instapay|qr\s*ph|mobile\s*no|user\s*id|verified|scan|download|share|save|powered\s*by|bsp|pesonet|account\s*no)/i;
        const normalizeMaskDots = (s) =>
          s
            .replace(/[•●·]/g, '*')
            .replace(/(?<=[A-Z])[eoca0]+(?=[A-Z])/g, (m) => '*'.repeat(m.length));

        const lines = text
          .split('\n')
          .map((l) => l.replace(/[|_~`]/g, '').replace(/\s+/g, ' ').trim())
          .filter((l) => l.length >= 1 && l.length <= 48);

        const isNoiseOrDigits = (line) =>
          !line || NOISE_RE.test(line) || /^\+?[\d\s*•●·.-]{5,}$/.test(line);

        const isContinuationLine = (line) => {
          if (isNoiseOrDigits(line)) return false;
          const norm = normalizeMaskDots(line);
          // Wrapped single-letter surname initial (e.g. "S.", "S", "V.", "JR.") or wrapped uppercase/masked surname
          if (/^[A-Z]\.?$/.test(norm)) return true;
          if (/^(?:JR|SR|II|III|IV)\.?$/i.test(norm)) return true;
          if (/^[A-Za-z][A-Za-z\s.*'-]{1,28}$/.test(norm) && (/[A-Z]{2,}/.test(norm) || /\*/.test(norm))) {
            return true;
          }
          return false;
        };

        // Pass 1: Prefer GCash/Maya masked or uppercase recipient name line (e.g. "RE*A GR**E FA**H" + wrapped "S.")
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.length < 3 || isNoiseOrDigits(line)) continue;
          const norm = normalizeMaskDots(line);
          if (/^[A-Za-z][A-Za-z\s.*'-]{2,42}$/.test(norm) && (/[A-Z]{2,}/.test(norm) || /\*/.test(norm))) {
            let full = norm;
            // Merge up to 2 immediately following wrapped name / initial lines (e.g., "S.")
            for (let k = 1; k <= 2 && i + k < lines.length; k++) {
              const nextLine = lines[i + k];
              if (isContinuationLine(nextLine)) {
                full = `${full} ${normalizeMaskDots(nextLine)}`.trim();
              } else {
                break;
              }
            }
            detectedName = full;
            break;
          }
        }

        // Pass 2: Any clean name-like line (Title Case / mixed case)
        if (!detectedName) {
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.length < 4 || isNoiseOrDigits(line)) continue;
            if (/^[A-Za-z][A-Za-z\s.'-]{3,42}$/.test(line) && line.includes(' ')) {
              let full = line;
              if (i + 1 < lines.length && isContinuationLine(lines[i + 1])) {
                full = `${full} ${normalizeMaskDots(lines[i + 1])}`.trim();
              }
              detectedName = full;
              break;
            }
          }
        }
      }
    }

    const isMaskedNumber = Boolean(detectedNumber && detectedNumber.includes('*'));
    return { text, detectedName, detectedNumber, isMaskedNumber };
  } catch (err) {
    console.warn('OCR extraction warning:', err);
    return { text: '', detectedName: '', detectedNumber: '', isMaskedNumber: false };
  }
}
