/**
 * Smart QR Card Extractor for GCash & Maya phone screenshots.
 * Detects whether the uploaded file is a mobile phone screenshot with a solid background (e.g. GCash blue or Maya black),
 * extracts the QR matrix and the underlying account details (Name, Mobile, User ID),
 * crops away the outer mobile screenshot borders, and returns a clean, high-resolution voucher image.
 */

import Tesseract from 'tesseract.js';

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
    return { croppedUrl: dataUrlOrFile, wasCropped: false };
  }

  if (!dataUrl || typeof dataUrl !== 'string') {
    return { croppedUrl: dataUrlOrFile, wasCropped: false };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;

        // If the image is already small or missing dimensions, do not crop
        if (!w || !h || w < 80 || h < 80) {
          return resolve({ croppedUrl: dataUrl, wasCropped: false, width: w, height: h });
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);

        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        const getPixel = (x, y) => {
          const clampedX = Math.max(0, Math.min(w - 1, x));
          const clampedY = Math.max(0, Math.min(h - 1, y));
          const idx = (clampedY * w + clampedX) * 4;
          return {
            r: data[idx],
            g: data[idx + 1],
            b: data[idx + 2],
            a: data[idx + 3]
          };
        };

        // 1. Detect Outer Background Color Signature (Blue = GCash, Dark / Green = Maya)
        const isBlueColor = (p) => (p.b > 110 && p.b > p.r * 1.25 && p.b > p.g * 1.05) || (p.b > 150 && p.r < 90);
        const isDarkColor = (p) => p.r < 40 && p.g < 40 && p.b < 40;
        const isGreenColor = (p) => p.g > 125 && p.g > p.r * 1.2 && p.g > p.b * 1.1;

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
          if (isBlueColor(p)) blueCount++;
          else if (isDarkColor(p)) darkCount++;
          else if (isGreenColor(p)) greenCount++;
        }

        let bgType = 'none';
        if (blueCount >= 1) {
          bgType = 'blue';
        } else if (darkCount >= 2) {
          bgType = 'dark';
        } else if (greenCount >= 1) {
          bgType = 'green';
        }

        const isImageBgPixel = (p) => {
          if (bgType === 'blue') return isBlueColor(p);
          if (bgType === 'dark') return isDarkColor(p);
          if (bgType === 'green') return isGreenColor(p);
          return false;
        };

        // 2. Locate QR Matrix (clusters of black/dark pixels in upper 72% of image)
        let qrMinX = w, qrMaxX = 0, qrMinY = h, qrMaxY = 0;
        const scanMaxY = Math.round(h * 0.72);
        for (let y = 12; y < scanMaxY; y += 3) {
          for (let x = 12; x < w - 12; x += 3) {
            const p = getPixel(x, y);
            if (p.r < 45 && p.g < 45 && p.b < 45) {
              if (x < qrMinX) qrMinX = x;
              if (x > qrMaxX) qrMaxX = x;
              if (y < qrMinY) qrMinY = y;
              if (y > qrMaxY) qrMaxY = y;
            }
          }
        }

        const qrW = qrMaxX - qrMinX;
        const qrH = qrMaxY - qrMinY;

        // If no QR matrix found or too small, return original
        if (qrW < 70 || qrH < 70 || qrMinX >= qrMaxX || qrMinY >= qrMaxY) {
          return resolve({ croppedUrl: dataUrl, wasCropped: false, width: w, height: h });
        }

        // 3. Scan upwards from bottom to find where the bottom colored strip begins
        let bottomBgY = h;
        if (bgType !== 'none') {
          for (let y = h - 1; y >= Math.round(h * 0.35); y--) {
            const pMid = getPixel(Math.round(w / 2), y);
            const pLeft = getPixel(Math.max(5, qrMinX), y);
            const pRight = getPixel(Math.min(w - 5, qrMaxX), y);
            if (isImageBgPixel(pMid) || (isImageBgPixel(pLeft) && isImageBgPixel(pRight))) {
              bottomBgY = y;
            } else {
              break;
            }
          }
        }

        // 4. Scan downwards below QR code to find the last row of recipient details text
        let lastTextY = qrMaxY;
        const searchLimitY = Math.min(bottomBgY - 4, qrMaxY + Math.round(qrH * 1.45));
        for (let y = qrMaxY + 4; y < searchLimitY; y += 2) {
          let textPixelCount = 0;
          const xStart = Math.max(8, qrMinX - 16);
          const xEnd = Math.min(w - 8, qrMaxX + 16);
          for (let x = xStart; x <= xEnd; x += 3) {
            const p = getPixel(x, y);
            const isWhite = (p.r > 225 && p.g > 225 && p.b > 225);
            if (!isWhite && !isImageBgPixel(p)) {
              textPixelCount++;
              if (textPixelCount >= 2) {
                lastTextY = y;
                break;
              }
            }
          }
        }

        // 5. Scan voucher card left and right boundaries at QR midpoint
        const midY = Math.round((qrMinY + qrMaxY) / 2);
        let cardLeft = 0;
        let cardRight = w;

        if (bgType !== 'none') {
          for (let x = qrMinX - 1; x >= 0; x--) {
            if (isImageBgPixel(getPixel(x, midY))) {
              cardLeft = x + 3;
              break;
            }
          }
          for (let x = qrMaxX + 1; x < w; x++) {
            if (isImageBgPixel(getPixel(x, midY))) {
              cardRight = x - 3;
              break;
            }
          }
        }

        // 6. Calculate clean, tight crop boundaries
        const padX = Math.max(14, Math.round(qrW * 0.05));
        const padY = Math.max(12, Math.round(qrW * 0.04));

        let finalMinX = Math.max(cardLeft, Math.max(0, qrMinX - padX));
        let finalMaxX = Math.min(cardRight, Math.min(w, qrMaxX + padX));
        let finalMinY = Math.max(0, qrMinY - padY);

        // Crop bottom ends cleanly below the last text line (or QR if no text), eliminating the bottom blue strip and dead gap
        const desiredBottom = (lastTextY > qrMaxY + 20) ? (lastTextY + 10) : (qrMaxY + 14);
        let finalMaxY = Math.min(bottomBgY - 4, desiredBottom);

        // Post-crop boundary safety scan: ensure bottom rows contain absolutely ZERO blue edge pixels
        if (bgType === 'blue') {
          while (finalMaxY > lastTextY + 4 && finalMaxY > qrMaxY + 10) {
            let bluePixelFound = false;
            const testXStart = Math.max(0, finalMinX + 4);
            const testXEnd = Math.min(w - 1, finalMaxX - 4);
            for (let x = testXStart; x <= testXEnd; x += 3) {
              if (isBlueColor(getPixel(x, finalMaxY))) {
                bluePixelFound = true;
                break;
              }
            }
            if (bluePixelFound) {
              finalMaxY -= 2;
            } else {
              break;
            }
          }
        }

        const cropW = Math.round(finalMaxX - finalMinX);
        const cropH = Math.round(finalMaxY - finalMinY);

        if (cropW < 70 || cropH < 70) {
          return resolve({ croppedUrl: dataUrl, wasCropped: false, width: w, height: h });
        }

        // Check if a meaningful crop is actually needed
        const needsCrop = (cropW < w - 10) || (cropH < h - 10) || (finalMinX > 6) || (finalMinY > 6);
        if (!needsCrop && bgType === 'none') {
          return resolve({ croppedUrl: dataUrl, wasCropped: false, width: w, height: h });
        }

        // 7. Render tightly cropped card to new canvas with clean white background
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = cropW;
        cropCanvas.height = cropH;
        const cropCtx = cropCanvas.getContext('2d');
        cropCtx.fillStyle = '#FFFFFF';
        cropCtx.fillRect(0, 0, cropW, cropH);
        cropCtx.drawImage(canvas, finalMinX, finalMinY, cropW, cropH, 0, 0, cropW, cropH);

        const croppedUrl = cropCanvas.toDataURL('image/png', 0.95);
        resolve({
          croppedUrl,
          wasCropped: true,
          width: cropW,
          height: cropH,
          bounds: { x: finalMinX, y: finalMinY, width: cropW, height: cropH }
        });
      } catch (err) {
        console.warn('QR auto-crop warning:', err);
        resolve({ croppedUrl: dataUrl, wasCropped: false });
      }
    };
    img.onerror = () => resolve({ croppedUrl: dataUrl, wasCropped: false });
    img.src = dataUrl;
  });
}

/**
 * Extract Account Name and Mobile Number from cropped QR voucher text using Tesseract OCR.
 */
export async function extractQrVoucherText(imageUrl) {
  try {
    const res = await Tesseract.recognize(imageUrl, 'eng');
    const text = res?.data?.text || '';

    let detectedName = '';
    let detectedNumber = '';

    // Pattern for mobile number: 09xx xxx xxxx or similar
    const phoneMatch = text.match(/\b(09\d{2}[\s\.\-]?\d{3}[\s\.\-]?[\d\*]{4})\b/) ||
                       text.match(/(?:Mobile\s*No\.?|Number)[\s\:\.]*([0-9\*\s]{9,15})/i);
    if (phoneMatch) {
      detectedNumber = phoneMatch[1].trim();
    }

    // Pattern for GCash account name (e.g., CL***E JU*****E V. or normal name)
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      // Look for lines with asterisks (masked names) or uppercase names
      if (/^[A-Z0-9\*\s\.\-]{4,35}$/.test(line) && !line.includes('Transfer') && !line.includes('GCash') && !line.includes('Mobile') && !line.includes('User ID') && !line.includes('fees')) {
        detectedName = line;
        break;
      }
    }

    return { text, detectedName, detectedNumber };
  } catch (err) {
    console.warn('OCR extraction warning:', err);
    return { text: '', detectedName: '', detectedNumber: '' };
  }
}

