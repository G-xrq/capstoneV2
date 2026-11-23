/**
 * BBDRTS - RA 10173 AI Face Privacy Detector
 *
 * Uses Google Gemini Vision native spatial bounding-box detection ([ymin, xmin, ymax, xmax]
 * normalized 0..1000) to locate all visible human faces in NGO campaign and relief-proof photos
 * so the frontend can irreversibly blur them before publication.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

let cachedFastFaceModel = null;

function getGenAI() {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '').trim();
  if (!apiKey) return null;
  try {
    return new GoogleGenerativeAI(apiKey);
  } catch (_) {
    return null;
  }
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

function sanitizeFaces(rawFaces) {
  if (!Array.isArray(rawFaces)) return [];
  const valid = [];

  for (const item of rawFaces) {
    let ymin, xmin, ymax, xmax;
    if (Array.isArray(item) && item.length >= 4) {
      [ymin, xmin, ymax, xmax] = item.map(Number);
    } else if (item && Array.isArray(item.box_2d) && item.box_2d.length >= 4) {
      [ymin, xmin, ymax, xmax] = item.box_2d.map(Number);
    } else if (item && typeof item === 'object') {
      ymin = Number(item.ymin ?? item.y1 ?? item.top);
      xmin = Number(item.xmin ?? item.x1 ?? item.left);
      ymax = Number(item.ymax ?? item.y2 ?? item.bottom);
      xmax = Number(item.xmax ?? item.x2 ?? item.right);
    } else {
      continue;
    }

    if ([ymin, xmin, ymax, xmax].some((n) => !Number.isFinite(n))) continue;

    // Auto-handle 0..1 normalized coords if model ever emits decimals
    if (ymax <= 1 && xmax <= 1 && ymin >= 0 && xmin >= 0) {
      ymin *= 1000;
      xmin *= 1000;
      ymax *= 1000;
      xmax *= 1000;
    }

    ymin = Math.max(0, Math.min(1000, Math.round(ymin)));
    xmin = Math.max(0, Math.min(1000, Math.round(xmin)));
    ymax = Math.max(0, Math.min(1000, Math.round(ymax)));
    xmax = Math.max(0, Math.min(1000, Math.round(xmax)));

    const w = xmax - xmin;
    const h = ymax - ymin;

    // Filter out degenerate tiny noise (<0.8%) or full-frame hallucinated boxes (>92% both axes)
    if (w < 8 || h < 8) continue;
    if (w > 920 && h > 920) continue;

    const candidate = { ymin, xmin, ymax, xmax };
    if (!valid.some((existing) => boxIoU(existing, candidate) > 0.72)) {
      valid.push(candidate);
    }
  }

  return valid.slice(0, 60);
}

/**
 * Detect all visible human faces in a base64 image.
 * Returns normalized 0..1000 bounding boxes: { ymin, xmin, ymax, xmax }.
 */
async function detectFaces(imageBase64) {
  const startedAt = Date.now();
  const genAI = getGenAI();
  if (!genAI) {
    return {
      success: false,
      faces: [],
      count: 0,
      isDocumentOrReceipt: false,
      skipped: true,
      reason: 'GEMINI_API_KEY not configured',
      durationMs: Date.now() - startedAt
    };
  }

  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return {
      success: false,
      faces: [],
      count: 0,
      isDocumentOrReceipt: false,
      skipped: true,
      reason: 'Missing image payload',
      durationMs: Date.now() - startedAt
    };
  }

  let mimeType = 'image/jpeg';
  let cleanBase64 = imageBase64;
  const match = imageBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (match) {
    mimeType = match[1];
    cleanBase64 = match[2];
  }

  if (mimeType.includes('svg')) {
    return {
      success: true,
      faces: [],
      count: 0,
      isDocumentOrReceipt: true,
      skipped: true,
      durationMs: Date.now() - startedAt
    };
  }

  const imagePart = {
    inlineData: {
      data: cleanBase64,
      mimeType
    }
  };

  const prompt = `You are a precision privacy-protection vision detector for Republic Act 10173 (Philippine Data Privacy Act).
Task: Detect EVERY visible real human face in this image so it can be blurred for privacy protection.

Rules:
1. Detect ALL real human faces — including children, elderly, side profiles, partially occluded faces, and people in the background/crowd.
2. Each bounding box MUST tightly frame the person's head/face (forehead to chin, ear to ear) using normalized coordinates from 0 to 1000 in [ymin, xmin, ymax, xmax] order, where (0,0) is top-left and (1000,1000) is bottom-right.
3. Do NOT detect text, logos, cartoons, QR codes, icons, hands, or objects.
4. If the image is purely a merchant receipt, invoice, spreadsheet, certificate, or text document with NO real human faces, set "isDocumentOrReceipt": true and "faces": [].

Return ONLY valid JSON with this exact schema:
{
  "isDocumentOrReceipt": false,
  "faces": [
    { "ymin": 120, "xmin": 340, "ymax": 260, "xmax": 460 }
  ]
}`;

  // Prioritize fastest verified Vision model first (~1.2-2.0s) with resilient fallbacks
  const baseModels = [
    'gemini-flash-lite-latest',
    'gemini-3-flash-preview',
    'gemini-flash-latest',
    'gemini-2.5-flash-lite'
  ];
  const activeModels = cachedFastFaceModel
    ? [cachedFastFaceModel, ...baseModels.filter((m) => m !== cachedFastFaceModel)]
    : baseModels;

  for (const modelName of activeModels) {
    try {
      const is25 = modelName.includes('2.5') || modelName.includes('gemini-flash-latest');
      const baseConfig = {
        responseMimeType: 'application/json',
        temperature: 0,
        maxOutputTokens: 2048
      };

      const callModel = async (withThinkingZero) => {
        const generationConfig = withThinkingZero
          ? { ...baseConfig, thinkingConfig: { thinkingBudget: 0 } }
          : baseConfig;
        const model = genAI.getGenerativeModel({ model: modelName, generationConfig });
        return Promise.race([
          model.generateContent([prompt, imagePart]),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Vision face detection timeout')), 12000))
        ]);
      };

      let result;
      try {
        result = await callModel(is25);
      } catch (cfgErr) {
        if (is25 && /thinking/i.test(cfgErr.message || '')) {
          result = await callModel(false);
        } else {
          throw cfgErr;
        }
      }

      const rawText = result?.response?.text?.() || '';
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;

      const parsed = JSON.parse(jsonMatch[0]);
      const faces = sanitizeFaces(parsed.faces || parsed.boxes || []);
      const isDoc = Boolean(parsed.isDocumentOrReceipt) && faces.length === 0;

      cachedFastFaceModel = modelName;
      return {
        success: true,
        faces,
        count: faces.length,
        isDocumentOrReceipt: isDoc,
        model: modelName,
        durationMs: Date.now() - startedAt
      };
    } catch (err) {
      console.warn(`[FacePrivacy] Model ${modelName} failed:`, err.message);
      if (cachedFastFaceModel === modelName) cachedFastFaceModel = null;
    }
  }

  return {
    success: false,
    faces: [],
    count: 0,
    isDocumentOrReceipt: false,
    skipped: true,
    reason: 'All vision models unavailable',
    durationMs: Date.now() - startedAt
  };
}

module.exports = {
  detectFaces
};
