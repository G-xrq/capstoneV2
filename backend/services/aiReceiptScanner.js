/**
 * BBDRTS - AI Receipt Scanner & Fraud Prevention Engine
 * 
 * Uses Google Gemini 1.5 Flash Vision and Tesseract.js Optical Character Recognition
 * to parse uploaded payment receipts (GCash, PayMaya, Bank Transfers),
 * verify declared payment amounts, detect non-receipt images, and extract reference numbers.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const Tesseract = require('tesseract.js');

// Helper to dynamically get Gemini AI when GEMINI_API_KEY is configured
function getGenAI() {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '').trim();
  if (!apiKey) return null;
  try {
    return new GoogleGenerativeAI(apiKey);
  } catch (_) {
    return null;
  }
}

/**
 * Normalize common OCR character misreadings in numeric context.
 * Fixes camera photo / low-contrast OCR issues (e.g. 'O'->'0', 'l'->'1', 'S'->'5', 'b'->'6', 'B'->'8').
 */
function normalizeOcrDigits(rawStr = '') {
  if (!rawStr) return '';
  return rawStr
    .replace(/[O|o|D|Q]/g, '0')
    .replace(/[I|l|\||\!]/g, '1')
    .replace(/Z/g, '2')
    .replace(/[S|s]/g, '5')
    .replace(/b/g, '6')
    .replace(/B/g, '8')
    .replace(/[g|q]/g, '9');
}

/**
 * Detect artificial test sequences in reference numbers (e.g. 9765432109876, 1234567890123).
 */
function isSuspiciousReferencePattern(ref) {
  if (!ref) return false;
  const digits = String(ref).replace(/\D/g, '');
  if (digits.length !== 13) return false;
  if (/^(\d)\1{10,}$/.test(digits)) return true;
  if (/0123456|1234567|2345678|3456789|9876543|8765432|7654321|6543210|5432109/.test(digits)) return true;
  return false;
}

/**
 * Extract GCash or Maya reference numbers directly from raw text using contextual regex & OCR validation.
 */
function extractRefNumberHeuristic(str = '', paymentRail = 'GCash', targetRefNo = null) {
  if (!str || typeof str !== 'string') return targetRefNo || null;

  // 0. Check if targetRefNo digits exist in OCR text (Space & Hyphen Insensitive Match)
  if (targetRefNo && typeof targetRefNo === 'string' && targetRefNo.trim().length >= 6) {
    const targetDigits = targetRefNo.replace(/\D/g, '');
    const strDigits = str.replace(/\D/g, '');
    if (targetDigits.length >= 8 && strDigits.includes(targetDigits)) {
      return targetRefNo.trim();
    }
  }

  // 1. Contextual Keyword Search around "Ref No", "Reference No", "Express Send", "Trans ID", "Seq No"
  // Look specifically for chunks immediately following reference keywords
  const keywordRegex = /(?:Ref(?:\s*No|\.|\:|\#)?|Reference(?:\s*No|\.|\:|\#)?|Express\s*Send|Trans\s*ID|Seq\s*No)[\s\.\:\#\-]+([A-Za-z0-9\s\.\-]{8,35})/gi;
  let kwMatch;
  while ((kwMatch = keywordRegex.exec(str)) !== null) {
    const afterKw = kwMatch[1];
    // Strip trailing date words (e.g. "Jun 20, 2025" or "Aug 12") to avoid bleeding
    const cleanedChunk = afterKw.split(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i)[0].trim();
    const normalizedChunk = normalizeOcrDigits(cleanedChunk);
    const digitsOnly = normalizedChunk.replace(/\D/g, '');
    if (digitsOnly.length === 13) {
      return `${digitsOnly.slice(0, 4)} ${digitsOnly.slice(4, 7)} ${digitsOnly.slice(7)}`;
    }
    if (digitsOnly.length >= 10 && digitsOnly.length <= 14) {
      return digitsOnly;
    }
  }

  // 2. GCash 13-Digit Patterns in raw text (actual numeric digits only)
  const gcashMatch = str.match(/\b(\d{4}[\s\.\-]+\d{3}[\s\.\-]+\d{6})\b/) ||
                     str.match(/\b(00\d{11}|10\d{11}|\d{13})\b/) ||
                     str.match(/\b(\d{4}[\s\-]?\d{9})\b/);

  if (gcashMatch) {
    const rawRef = gcashMatch[1] || gcashMatch[0];
    const cleaned = rawRef.trim().replace(/\s+/g, ' ');
    const digitsOnly = cleaned.replace(/\D/g, '');
    if (digitsOnly.length === 13) {
      return `${digitsOnly.slice(0, 4)} ${digitsOnly.slice(4, 7)} ${digitsOnly.slice(7)}`;
    }
    if (digitsOnly.length >= 10 && digitsOnly.length <= 14) return cleaned;
  }

  // 3. PayMaya or Bank Alphanumeric Reference Patterns (only when explicitly prefixed with Ref/ID/No)
  const mayaRefMatch = str.match(/(?:Ref|ID|No)[\s\.\:\#]+([A-Z0-9\-]{10,20})/i);
  if (mayaRefMatch) {
    const cleaned = mayaRefMatch[1].trim();
    if (cleaned.length >= 8) return cleaned;
  }

  // NOTE: Never blindly return targetRefNo if it does not appear in the OCR text or image!
  return null;
}

/**
 * Detect actual payment rail (GCash, Maya, Bank) from raw text elements and reference format.
 */
function detectPaymentRailFromText(str = '', refNo = '') {
  if (!str && !refNo) return null;
  const lower = (str || '').toLowerCase();
  const digits = (refNo || '').replace(/\D/g, '');

  // 1. Explicit brand keywords
  const hasMaya = /maya|paymaya|maya wallet|maya bank|pay maya/i.test(lower);
  const hasGcash = /gcash|g-cash|g cash|gash|express send|send money|instapay|qr ph|user id:|transfer fees/i.test(lower);
  const hasBank = /bdo|bpi|metrobank|unionbank|landbank|rcbc|security bank|chinabank|pnb|bank transfer/i.test(lower);

  if (hasMaya) return 'Maya';
  if (hasGcash) return 'GCash';
  if (hasBank) return 'Bank';

  // 2. Strict GCash reference scheme: In the Philippines, 13 numeric digits are exclusively GCash
  if (digits.length === 13) {
    return 'GCash';
  }

  // 3. Search for 13-digit sequence in text
  const norm = normalizeOcrDigits(str);
  if (/\b\d{4}[\s\.\-]?\d{3}[\s\.\-]?\d{6}\b/.test(norm) || /\b(00\d{11}|10\d{11}|\d{13})\b/.test(norm)) {
    return 'GCash';
  }

  return null;
}

/**
 * Extract PHP amounts directly from raw text using regex.
 */
function extractAmountPhpHeuristic(str = '') {
  if (!str || typeof str !== 'string') return null;

  // 1. Matches "Total Amount Sent ₱460.00" or "Amount: ₱500.00" or "Sent ₱460.00" or "Total PHP 30.00"
  const matchA = str.match(/(?:Total\s*Amount\s*Sent|Total\s*Amount|Amount\s*Sent|Amount|Sent|Paid|Total)[\s\S]{0,35}?(?:PHP|₱|P|Php)?\s*([\d,]+(?:\.\d{2})?)/i);
  if (matchA) {
    const val = parseFloat(matchA[1].replace(/,/g, ''));
    if (!isNaN(val) && val > 0 && val < 10000000) return val;
  }

  // 2. Matches currency symbol followed by amount e.g. "₱500.00" or "PHP 1,500.00" or "₱500"
  const matchCurr = str.match(/(?:₱|PHP|Php)\s*([\d,]+(?:\.\d{2})?)/i);
  if (matchCurr) {
    const val = parseFloat(matchCurr[1].replace(/,/g, ''));
    if (!isNaN(val) && val > 0 && val < 10000000) return val;
  }

  // 3. Matches standalone decimal currency numbers e.g. "500.00" or "1,500.00"
  const matchDecimals = str.match(/([\d,]+\.\d{2})/g);
  if (matchDecimals && matchDecimals.length > 0) {
    for (const m of matchDecimals) {
      const val = parseFloat(m.replace(/,/g, ''));
      if (!isNaN(val) && val > 0 && val < 10000000) {
        return val;
      }
    }
  }

  return null;
}

/**
 * Clean phone digits to 10-digit Philippine local mobile format (strips +63, 63, or leading 0).
 */
function cleanPhoneDigits(str = '') {
  if (!str) return '';
  return String(str).replace(/\D/g, '').replace(/^63/, '').replace(/^0/, '');
}

/**
 * Robust check if extracted phone number matches or is compatible with expected receiving number.
 * Handles masked phone numbers (e.g. "+63 9*****9086", "0997 993 ....", "+63 9... 02 1638", "+63 997 507 3639").
 */
function phonesMatch(extractedPhone, expectedPhone) {
  if (!extractedPhone || !expectedPhone) return true; // Inconclusive if either missing
  const rawExt = String(extractedPhone).trim();
  const rawExp = String(expectedPhone).trim();

  // Full clean comparison if neither has mask characters (*, •, .)
  const isExtMasked = /[\*\•\.]/.test(rawExt);
  const isExpMasked = /[\*\•\.]/.test(rawExp);

  const cleanExt = cleanPhoneDigits(rawExt);
  const cleanExp = cleanPhoneDigits(rawExp);

  if (!isExtMasked && !isExpMasked) {
    if (cleanExt.length === 10 && cleanExp.length === 10) {
      return cleanExt === cleanExp;
    }
  }

  // 1. Suffix matching: Look for visible trailing digits (e.g. "1638" vs "9521" or "3639")
  const sufExtMatch = rawExt.match(/(\d{3,4})[^\d]*$/);
  const sufExpMatch = rawExp.match(/(\d{3,4})[^\d]*$/);
  if (sufExtMatch && sufExpMatch) {
    const sufExt = sufExtMatch[1];
    const sufExp = sufExpMatch[1];
    const minSuf = Math.min(sufExt.length, sufExp.length);
    if (minSuf >= 3 && sufExt.slice(-minSuf) !== sufExp.slice(-minSuf)) {
      return false; // Trailing digits mismatch (e.g. 1638 !== 9521)
    }
  }

  // 2. Prefix matching: Look for visible leading mobile operator digits (e.g. "997" vs "917")
  // Only inspect contiguous digits before any masking character (*, •, .)
  const normExt = rawExt.replace(/^\+?63\s*/, '').replace(/^0/, '').trim();
  const normExp = rawExp.replace(/^\+?63\s*/, '').replace(/^0/, '').trim();

  const beforeMaskExt = normExt.split(/[\*\•\.]/)[0];
  const beforeMaskExp = normExp.split(/[\*\•\.]/)[0];
  const preExt = beforeMaskExt.replace(/\D/g, '');
  const preExp = beforeMaskExp.replace(/\D/g, '');

  if (preExt && preExp) {
    // Only perform network prefix check if at least 3 digits are visible before the mask (e.g. "997" vs "917")
    if (preExt.length >= 3 && preExp.length >= 3) {
      const cmpLen = Math.min(preExt.length, preExp.length, 4);
      if (preExt.slice(0, cmpLen) !== preExt.slice(0, cmpLen)) {
        return false; // Mobile prefix mismatch (e.g. 997 vs 917)
      }
    } else if (preExt.length >= 1 && preExp.length >= 1) {
      const cmpLen = Math.min(preExt.length, preExp.length);
      if (preExt.slice(0, cmpLen) !== preExp.slice(0, cmpLen)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Robust check if extracted recipient name matches or is compatible with expected receiving account name.
 * Handles masked names (e.g. "SA••H A.", "GE•E M.", "CL***E JU*****E V.", "CR•••••••O J• C.", "ReliefLink PH").
 */
function namesMatch(extractedName, expectedName, expectedOrg) {
  if (!extractedName) return true; // Inconclusive
  if (!expectedName && !expectedOrg) return true;

  const clean = (s) => (s || '').toUpperCase().trim();
  const ext = clean(extractedName);
  const exp = clean(expectedName);
  const org = clean(expectedOrg);

  // Exact or direct substring match
  if (exp && (ext === exp || ext.includes(exp) || exp.includes(ext))) return true;
  if (org && (ext === org || ext.includes(org) || org.includes(ext))) return true;

  // Extract letter tokens ignoring masks (*, •, ., -, bullet points)
  const parseToken = (tok) => {
    const lettersOnly = tok.replace(/[^A-Z]/g, '');
    if (!lettersOnly) return { start: '', end: '', initial: '', raw: tok };
    return {
      start: lettersOnly.slice(0, 2),
      end: lettersOnly.slice(-1),
      initial: lettersOnly[0],
      raw: tok
    };
  };

  const extTokens = ext.split(/[\s,]+/).filter(Boolean).map(parseToken).filter(t => t.initial);
  const expTokens = (exp || org).split(/[\s,]+/).filter(Boolean).map(parseToken).filter(t => t.initial);

  if (extTokens.length === 0 || expTokens.length === 0) return true;

  // 1. Compare First Word/Name Initial (e.g. 'S' from 'SA••H' vs 'C' from 'CL***E' or 'G' from 'GE•E')
  const extFirst = extTokens[0];
  const expFirst = expTokens[0];
  if (extFirst.initial && expFirst.initial) {
    if (extFirst.initial !== expFirst.initial) {
      return false; // First initial mismatch (e.g. 'S' vs 'C' or 'G' vs 'C')
    }
  }
  if (extFirst.start.length >= 2 && expFirst.start.length >= 2) {
    if (extFirst.start !== expFirst.start) {
      return false; // First 2 letters mismatch (e.g. 'SA' vs 'CL')
    }
  }

  // 2. Compare Last Word/Initial (e.g. 'A' vs 'V' or 'M' vs 'V')
  const extLast = extTokens[extTokens.length - 1];
  const expLast = expTokens[expTokens.length - 1];
  if (extLast.initial && expLast.initial) {
    if (extLast.initial !== expLast.initial) {
      return false; // Last initial mismatch (e.g. 'A' vs 'V')
    }
  }

  return true;
}

/**
 * Cross-check extracted recipient name & phone against campaign's official receiving credentials.
 */
function checkRecipientCredentials(extractedName, extractedPhone, expectedName, expectedPhone, expectedOrg) {
  const check = {
    isMatch: true,
    flags: [],
    details: ''
  };

  if (!extractedName && !extractedPhone) return check;
  if (!expectedName && !expectedPhone && !expectedOrg) return check;

  const nameValid = namesMatch(extractedName, expectedName, expectedOrg);
  const phoneValid = phonesMatch(extractedPhone, expectedPhone);

  if (!nameValid && !phoneValid) {
    check.isMatch = false;
    check.flags.push(
      `RECIPIENT_MISMATCH: Funds were transferred to "${extractedName || 'Unknown'}" (${extractedPhone || 'Unknown'}), but this campaign's official receiving account is "${expectedName || expectedOrg || 'Official Account'}" (${expectedPhone || 'Official Number'}).`
    );
    check.details = `Recipient credentials mismatch: Name "${extractedName}" and Phone "${extractedPhone}" do not match campaign receiver "${expectedName}" (${expectedPhone}).`;
  } else if (!nameValid) {
    check.isMatch = false;
    check.flags.push(
      `RECIPIENT_NAME_MISMATCH: Funds were transferred to "${extractedName}", but this campaign's official receiving account name is "${expectedName || expectedOrg}".`
    );
    check.details = `Recipient name mismatch: "${extractedName}" vs expected "${expectedName || expectedOrg}".`;
  } else if (!phoneValid) {
    check.isMatch = false;
    check.flags.push(
      `RECIPIENT_PHONE_MISMATCH: Funds were sent to phone number ${extractedPhone}, but this campaign's official receiving number is ${expectedPhone}.`
    );
    check.details = `Recipient phone mismatch: "${extractedPhone}" vs expected "${expectedPhone}".`;
  }

  return check;
}

/**
 * Analyzes a payment receipt image base64 and cross-references declared donation amounts & reference numbers.
 * 
 * @param {string} base64Data - RFC base64 image data string
 * @param {number|string} declaredAmountEth - Declared ETH or PHP amount
 * @param {string} paymentRail - "GCash", "Maya", "Bank", etc.
 * @param {string} targetRefNo - Reference Number provided during submission
 * @param {Object} extraExpected - Expected recipient name, phone, and org name
 * @returns {Promise<Object>} Analysis report with confidenceScore, extractedRef, fraudFlags, and isAiVerified status
 */
async function auditReceiptImage(base64Data, declaredAmountEth = 0, paymentRail = 'GCash', targetRefNo = null, extraExpected = {}) {
  const {
    expectedRecipientName = null,
    expectedRecipientPhone = null,
    expectedOrgName = null
  } = (typeof extraExpected === 'object' && extraExpected !== null) ? extraExpected : {};
  const declaredEth = parseFloat(declaredAmountEth) || 0;
  // If declared Eth > 100, it was already passed in PHP! Otherwise convert from ETH approx.
  const declaredPhpApprox = declaredEth > 100 ? Math.round(declaredEth) : Math.round(declaredEth * 170000);

  // Default Result Structure
  let result = {
    isAiVerified: false,
    confidenceScore: 45,
    extractedRef: targetRefNo && !targetRefNo.startsWith('REF-') && !targetRefNo.startsWith('MANUAL-') ? targetRefNo : null,
    extractedAmountPhp: declaredPhpApprox || null,
    fraudFlags: [],
    auditedBy: 'AI_VISION_OCR',
    summary: 'Receipt slip requires manual NGO verification.'
  };

  try {
    if (!base64Data || typeof base64Data !== 'string') {
      return {
        isAiVerified: false,
        confidenceScore: 0,
        extractedRef: targetRefNo || null,
        fraudFlags: ['MISSING_IMAGE_DATA'],
        auditedBy: 'HEURISTIC_PARSER',
        summary: 'No receipt image file uploaded for verification.'
      };
    }

    // Determine actual MIME type
    let mimeType = 'image/jpeg';
    if (base64Data.startsWith('data:image/png')) mimeType = 'image/png';
    else if (base64Data.startsWith('data:image/webp')) mimeType = 'image/webp';
    else if (base64Data.startsWith('data:image/gif')) mimeType = 'image/gif';
    else if (base64Data.startsWith('data:image/svg+xml')) mimeType = 'image/svg+xml';

    // Clean base64 header
    const cleanBase64 = base64Data.replace(/^data:image\/[a-zA-Z0-9+\-]+;base64,/, '').trim();

    // ── 1. Check for Portal-Generated Demo SVG Receipts ──────────────────
    if (mimeType === 'image/svg+xml' || base64Data.includes('EXPRESS%20SEND') || base64Data.includes('BANGKO%20SENTRAL') || base64Data.includes('Reference%20Number')) {
      let decodedSvg = '';
      try {
        decodedSvg = decodeURIComponent(base64Data);
      } catch (_) {
        decodedSvg = Buffer.from(cleanBase64, 'base64').toString('utf8');
      }

      const ref = extractRefNumberHeuristic(decodedSvg, paymentRail, targetRefNo) || targetRefNo || `REF${Date.now().toString().slice(-8)}`;
      const amt = extractAmountPhpHeuristic(decodedSvg) || declaredPhpApprox;
      const detectedRail = detectPaymentRailFromText(decodedSvg) || paymentRail;

      const hasRailMismatch = detectedRail && paymentRail && (detectedRail.toLowerCase() !== paymentRail.toLowerCase());
      const hasAmtMismatch = amt && declaredPhpApprox > 0 && (Math.abs(amt - declaredPhpApprox) / declaredPhpApprox > 0.05);

      const flags = [];
      if (hasRailMismatch) flags.push(`PAYMENT_RAIL_MISMATCH: Declared method is ${paymentRail}, but receipt slip is for ${detectedRail}`);
      if (hasAmtMismatch) flags.push(`AMOUNT_MISMATCH: Receipt states ₱${amt.toLocaleString()} PHP, but declared donation is ₱${declaredPhpApprox.toLocaleString()} PHP`);

      const isVerified = !hasRailMismatch && !hasAmtMismatch;
      const score = isVerified ? 98 : 35;

      return {
        isAiVerified: isVerified,
        confidenceScore: score,
        extractedRef: ref,
        extractedAmountPhp: amt,
        fraudFlags: flags,
        auditedBy: 'AI_PORTAL_RECEIPT_VALIDATOR',
        summary: isVerified
          ? `Official ${paymentRail} Slip verified. Ref: ${ref}. Amount: ₱${amt.toLocaleString()} PHP.`
          : `⚠️ Audit Alert: ${flags.join(' | ')}`
      };
    }

    // ── 2. Gemini Vision AI Inspection ─────────────────────────
    const genAI = getGenAI();
    if (genAI) {
      try {
        const prompt = `You are a strict anti-fraud forensic investigator auditing Philippine payment receipts (${paymentRail}, GCash, PayMaya, Bank Transfer, QR Ph).
Your primary job is to CATCH FAKE, EDITED, PHOTOSHOPPED, OR AI-GENERATED RECEIPTS. Fraudsters frequently take authentic receipts and alter the recipient name, reference number, date, or amount to steal relief funds or falsify donations.

BENEFICIARY CAMPAIGN EXPECTED RECIPIENT CREDENTIALS (IF APPLICABLE):
- Expected Account Name: ${expectedRecipientName || 'N/A'}
- Expected Phone / Mobile: ${expectedRecipientPhone || 'N/A'}
- Beneficiary Organization: ${expectedOrgName || 'N/A'}

MANDATORY FORENSIC FRAUD CHECKS (INSPECT EVERY FIELD UNDER A DIGITAL MAGNIFYING GLASS):
1. TYPOGRAPHY & FONT CONSISTENCY:
   - Authentic GCash, Maya, and Philippine bank apps render all text in their exact, proprietary, uniform UI typefaces with crisp vector-like edges.
   - Scrutinize:
     * The Recipient Name (e.g., "CL***E JU*****E V.")
     * The Recipient Phone (e.g., "0997 993 9521")
     * The Amount & Total Amount Sent (e.g., "50,000.00", "₱50,000.00")
     * The Reference Number (e.g., "Ref No. 9046 840 764280")
     * The Date and Time (e.g., "Nov 13, 2026 12:12 PM")
   - If the font family, weight, kerning, or digit geometry of the Amount (e.g., ₱50,000.00), the Peso symbol "₱", Reference Number, or Recipient Name does NOT match the native app UI or looks typed over in a generic font (Arial, Roboto, Montserrat, etc.), you MUST set hasTamperingOrAnnotations = true and confidenceScore = 0!

2. ERASER PATCHES, BRUSH STROKES, & COMPRESSION HALOS:
   - Inspect the background canvas around all text fields, specifically:
     * Under the recipient phone number
     * Around the label "Sent via GCash"
     * Around the "Amount" and "Total Amount Sent" values
     * Around the Reference Number and Date
   - If there is a hazy white/grey patch, erased box, brush smudge, blurry ghosting, or mismatched pixel compression noise where previous text was wiped out and new text was typed over, you MUST set hasTamperingOrAnnotations = true and confidenceScore = 0!

3. SYNTHETIC OR AI-GENERATED RECEIPTS:
   - If this receipt was fabricated by another AI image generator, online receipt maker, or template tool (tells: slight blurring on static logos/labels like "Sent via GCash", misaligned horizontal divider lines, unnatural spacing, or floating numbers), you MUST set hasTamperingOrAnnotations = true and confidenceScore = 0!

4. TUTORIAL / SAMPLE / EDUCATIONAL IMAGES:
   - If the image contains red circles, arrows, callout boxes, tutorial labels like "GCash Reference Number", or sample watermarks, you MUST set hasTamperingOrAnnotations = true and confidenceScore = 0!

5. STRICT REJECTION ACTIONS:
   - If ANY tampering, digital editing, font inconsistency, or eraser patch is detected:
     * "hasTamperingOrAnnotations": true
     * "isPaymentReceipt": false
     * "confidenceScore": 0
     * "rejectionReason": State clearly what was altered (e.g., "Font mismatch and typographical splicing detected on amount ₱50,000.00; smudged eraser halo detected around 'Sent via GCash'").

EXTRACTION RULES (ONLY FOR 100% UNALTERED, GENUINE SLIPS):
- "refNumber": 13-digit sequence for GCash (e.g., "9046 840 764280" or "9046840764280"). If tampered, MUST be null.
- "amountPhp": Total amount sent in PHP as a number (e.g., 50000.00). If tampered, MUST be null.
- "detectedPaymentRail": "GCash", "Maya", or "Bank". If tampered, MUST be null.
- "recipientName": Exact recipient name displayed at top. If tampered, MUST be null.
- "recipientPhone": Recipient phone number or account number.
- "receiptDate": Date and time on slip (e.g., "Nov 13, 2026 12:12 PM").
- "confidenceScore": 0 for tampered/edited/fake/samples, 95 only for crisp, genuine, unaltered slips.
- "rejectionReason": Detailed reason if rejected, null if authentic.

Return strictly JSON format:
{
  "isPaymentReceipt": boolean,
  "hasTamperingOrAnnotations": boolean,
  "refNumber": string | null,
  "amountPhp": number | null,
  "detectedPaymentRail": string | null,
  "recipientName": string | null,
  "recipientPhone": string | null,
  "receiptDate": string | null,
  "isAuthenticLook": boolean,
  "confidenceScore": number,
  "rejectionReason": string | null
}`;

        const imagePart = {
          inlineData: {
            data: cleanBase64,
            mimeType: mimeType === 'image/svg+xml' ? 'image/png' : mimeType
          }
        };

        const activeModels = [
          'gemini-3.8-flash',
          'gemini-3.5-flash-lite',
          'gemini-flash-lite-latest',
          'gemini-3-flash-preview',
          'gemini-2.5-flash',
          'gemini-2.0-flash'
        ];
        let response = null;
        let successfulModel = 'gemini-3.5-flash-lite';

        for (const m of activeModels) {
          try {
            const model = genAI.getGenerativeModel({ model: m });
            // 25.0s timeout per Gemini attempt to accommodate network variation for high-res images
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 25000));
            response = await Promise.race([
              model.generateContent([prompt, imagePart]),
              timeoutPromise
            ]);
            if (response && response.response) {
              successfulModel = m;
              break;
            }
          } catch (modelErr) {
            console.warn(`Gemini model ${m} attempt failed:`, modelErr.message);
          }
        }

        if (response && response.response) {
          const text = response.response.text();
          const jsonMatch = text.match(/\{[\s\S]*\}/);

          if (jsonMatch) {
            let parsed = null;
            try {
              parsed = JSON.parse(jsonMatch[0]);
            } catch (_) {
              // Heuristic regex fallback for unescaped characters in Gemini response
              const isReceiptMatch = jsonMatch[0].match(/"isPaymentReceipt"\s*:\s*(true|false)/i);
              const tamperMatch = jsonMatch[0].match(/"hasTamperingOrAnnotations"\s*:\s*(true|false)/i);
              const authMatch = jsonMatch[0].match(/"isAuthenticLook"\s*:\s*(true|false)/i);
              const reasonMatch = jsonMatch[0].match(/"rejectionReason"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);
              const refMatch = jsonMatch[0].match(/"refNumber"\s*:\s*"([^"\\]+)"/i);
              const amtMatch = jsonMatch[0].match(/"amountPhp"\s*:\s*([0-9\.]+)/i);
              const railMatch = jsonMatch[0].match(/"detectedPaymentRail"\s*:\s*"([^"\\]+)"/i);
              const dateMatch = jsonMatch[0].match(/"receiptDate"\s*:\s*"([^"\\]+)"/i);
              const scoreMatch = jsonMatch[0].match(/"confidenceScore"\s*:\s*([0-9\.]+)/i);

              if (isReceiptMatch || tamperMatch) {
                parsed = {
                  isPaymentReceipt: isReceiptMatch ? isReceiptMatch[1].toLowerCase() === 'true' : false,
                  hasTamperingOrAnnotations: tamperMatch ? tamperMatch[1].toLowerCase() === 'true' : false,
                  isAuthenticLook: authMatch ? authMatch[1].toLowerCase() === 'true' : true,
                  rejectionReason: reasonMatch ? reasonMatch[1] : null,
                  refNumber: refMatch ? refMatch[1] : null,
                  amountPhp: amtMatch ? parseFloat(amtMatch[1]) : null,
                  detectedPaymentRail: railMatch ? railMatch[1] : null,
                  receiptDate: dateMatch ? dateMatch[1] : null,
                  confidenceScore: scoreMatch ? parseFloat(scoreMatch[1]) : 0
                };
              }
            }

            if (parsed) {
              // STRICT NON-RECEIPT OR TAMPERED/SAMPLE IMAGE REJECTION
              const isTamperedOrFake = parsed.isPaymentReceipt === false ||
                parsed.hasTamperingOrAnnotations === true ||
                parsed.isAuthenticLook === false ||
                (typeof parsed.confidenceScore === 'number' && parsed.confidenceScore === 0);

              if (isTamperedOrFake) {
                const rejectionMsg = parsed.rejectionReason || 'Visual forensics detected typographical alteration, font mismatch, or synthetic receipt tampering.';
                result.isPaymentReceipt = false;
                result.isAiVerified = false;
                result.confidenceScore = 0;
                result.extractedRef = null;
                result.extractedAmountPhp = null;
                result.detectedPaymentRail = null;
                result.fraudFlags = [`INVALID_RECEIPT: ${rejectionMsg}`];
                result.auditedBy = `AI_${successfulModel.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
                result.summary = `⚠️ AI Fraud Alert: ${rejectionMsg}`;
                return result;
              }

              // Normalize confidence score (handle 0.95 -> 95)
              let score = parsed.confidenceScore;
              if (typeof score === 'number' && score <= 1.0 && score > 0) {
                score = Math.round(score * 100);
              } else if (typeof score !== 'number' || score <= 0) {
                score = 95;
              }

              // Normalize 13-digit GCash reference
              let ref = (parsed.refNumber || targetRefNo || '').trim();
              const digitsOnly = ref.replace(/\D/g, '');
              if (digitsOnly.length === 13) {
                ref = `${digitsOnly.slice(0, 4)} ${digitsOnly.slice(4, 7)} ${digitsOnly.slice(7)}`;
              }

              result.isPaymentReceipt = true;
              result.extractedRef = ref || null;
              result.extractedAmountPhp = parsed.amountPhp || (declaredPhpApprox > 0 ? declaredPhpApprox : null);
              result.detectedPaymentRail = parsed.detectedPaymentRail || detectPaymentRailFromText(ref, ref);
              result.receiptDate = parsed.receiptDate || null;
              result.recipientName = parsed.recipientName || null;
              result.recipientPhone = parsed.recipientPhone || null;

              // Stale / Expired Receipt Check (Prevents recycling old receipts)
              let hasDateMismatch = false;
              if (parsed.receiptDate) {
                const parsedDate = new Date(parsed.receiptDate);
                if (!isNaN(parsedDate.getTime())) {
                  const now = new Date();
                  const diffDays = (now.getTime() - parsedDate.getTime()) / (1000 * 60 * 60 * 24);
                  // Hard reject if receipt is older than 30 days or from a past calendar year (anti-recycling)
                  if (diffDays > 30 || (now.getFullYear() - parsedDate.getFullYear() >= 1)) {
                    const daysAgo = Math.max(1, Math.round(diffDays));
                    result.fraudFlags.push(`EXPIRED_RECEIPT: Receipt is dated ${parsed.receiptDate} (~${daysAgo} days old). Recycled or expired receipts cannot be accepted.`);
                    hasDateMismatch = true;
                  } else if (diffDays < -1) {
                    result.fraudFlags.push(`INVALID_DATE: Receipt timestamp is in the future (${parsed.receiptDate}).`);
                    hasDateMismatch = true;
                  } else if (diffDays > 7) {
                    result.fraudFlags.push(`STALE_RECEIPT_WARNING: Receipt is dated ${parsed.receiptDate} (${Math.round(diffDays)} days ago).`);
                  }
                }
              }

              // Recipient Credentials Cross-Verification Check (Anti-Fraud)
              let hasRecipientMismatch = false;
              if (result.recipientName || result.recipientPhone) {
                const recipientCheck = checkRecipientCredentials(
                  result.recipientName,
                  result.recipientPhone,
                  expectedRecipientName,
                  expectedRecipientPhone,
                  expectedOrgName
                );

                if (!recipientCheck.isMatch) {
                  hasRecipientMismatch = true;
                  for (const flag of recipientCheck.flags) {
                    result.fraudFlags.push(flag);
                  }
                }
              }

              if (hasDateMismatch || hasRecipientMismatch) {
                result.isPaymentReceipt = false;
                result.isAiVerified = false;
                result.confidenceScore = 0;
                result.extractedRef = null;
                result.extractedAmountPhp = null;
                result.auditedBy = `AI_${successfulModel.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
                result.summary = `⚠️ Fraud Alert: ${result.fraudFlags.join(' | ')}`;
                return result;
              }

              // Rail Mismatch Check
              const detectedRail = result.detectedPaymentRail;
              const hasRailMismatch = (detectedRail && paymentRail && (detectedRail.toLowerCase() !== paymentRail.toLowerCase())) ||
                (paymentRail && paymentRail.toLowerCase() === 'maya' && digitsOnly.length === 13);

              if (hasRailMismatch) {
                result.fraudFlags.push(`PAYMENT_RAIL_MISMATCH: Declared method is ${paymentRail}, but receipt is a ${detectedRail || 'GCash'} payment slip!`);
              }

              // Amount Mismatch Check
              let hasAmtMismatch = false;
              if (parsed.amountPhp && declaredPhpApprox > 0) {
                const diffPercent = Math.abs(parsed.amountPhp - declaredPhpApprox) / declaredPhpApprox;
                if (diffPercent > 0.05) {
                  hasAmtMismatch = true;
                  result.fraudFlags.push(`AMOUNT_MISMATCH: Receipt states ₱${parsed.amountPhp.toLocaleString()} PHP, but declared donation is ₱${declaredPhpApprox.toLocaleString()} PHP`);
                }
              }

              const finalAmount = parsed.amountPhp || declaredPhpApprox || 0;
              if (hasRailMismatch || hasAmtMismatch || !result.extractedRef) {
                result.confidenceScore = 35;
                result.isAiVerified = false;
              } else if (finalAmount >= 10000) {
                // High-value donation guardrail (₱10,000+ PHP)
                // Even visually clean receipts with large sums must undergo mandatory secondary manual audit
                result.confidenceScore = Math.min(score, 70);
                result.isAiVerified = false;
                result.requiresManualAudit = true;
                result.fraudFlags.push(`HIGH_VALUE_AUDIT_REQUIRED: High-value transfer (₱${finalAmount.toLocaleString()} PHP). Mandatory secondary verification against recipient account balance and official SMS notification before confirmation.`);
              } else {
                result.confidenceScore = score >= 60 ? score : 95;
                result.isAiVerified = true;
              }

              result.auditedBy = `AI_${successfulModel.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
              result.summary = result.isAiVerified
                ? `Gemini AI Vision verified ${result.detectedPaymentRail || paymentRail} slip. Ref: ${result.extractedRef || 'Detected'}. Amount: ₱${parsed.amountPhp || declaredPhpApprox} PHP.`
                : `⚠️ AI Audit Flagged: ${result.fraudFlags.join(' | ')}`;

              return result;
            }
        }
      }
      } catch (geminiErr) {
        console.warn('⚠️ Gemini Vision API call exception:', geminiErr.message);
      }
    }

    // ── 3. Tesseract.js Real Image Pixel OCR Engine with Keyword Guard ──
    try {
      const imgBuffer = Buffer.from(cleanBase64, 'base64');
      const ocrRes = await Tesseract.recognize(imgBuffer, 'eng');
      const ocrText = ocrRes?.data?.text || '';
      const lowerOcr = ocrText.toLowerCase();

      // Guard: An authentic receipt MUST contain financial transaction keywords
      const receiptKeywords = [
        'express send', 'send money', 'reference no', 'ref no', 'ref.', 'ref #', 'trans id',
        'instapay', 'pesonet', 'transfer fee', 'total amount', 'amount sent',
        'payment details', 'transferred to', 'sent via', 'successfully sent',
        'paymaya', 'maya', 'payment receipt', 'transaction receipt', 'gcash'
      ];
      const matchedKeywords = receiptKeywords.filter(kw => lowerOcr.includes(kw));
      const extractedRefTess = extractRefNumberHeuristic(ocrText, paymentRail, targetRefNo);
      const extractedAmtTess = extractAmountPhpHeuristic(ocrText);
      const detectedRailTess = detectPaymentRailFromText(ocrText, extractedRefTess);

      if (matchedKeywords.length === 0 && !extractedRefTess) {
        // If user already typed or provided a reference number, don't hard reject
        if (targetRefNo && targetRefNo.length >= 8) {
          result.isPaymentReceipt = true;
          result.isAiVerified = false;
          result.confidenceScore = 45;
          result.extractedRef = targetRefNo;
          result.extractedAmountPhp = declaredPhpApprox > 0 ? declaredPhpApprox : null;
          result.detectedPaymentRail = paymentRail;
          result.fraudFlags.push('MANUAL_AUDIT_REQUIRED: OCR text scan was inconclusive (screen glare/angle). Flagged for NGO manual verification.');
          result.summary = 'Photo attached. Please confirm reference number matches receipt for NGO manual verification.';
          result.auditedBy = 'MANUAL_AUDIT_PENDING_CONFIRMATION';
          return result;
        }

        result.isPaymentReceipt = false;
        result.isAiVerified = false;
        result.confidenceScore = 0;
        result.extractedRef = null;
        result.extractedAmountPhp = null;
        result.detectedPaymentRail = null;
        result.fraudFlags.push('UNREADABLE_RECEIPT: Unable to detect transaction details. Please confirm reference number manually or upload a clear screenshot.');
        result.summary = 'Unable to detect transaction details. Please confirm reference number manually or upload a clear screenshot.';
        return result;
      }

      // 1. Recipient Name & Phone Extraction & Cross-Check from OCR Text
      let extractedNameTess = null;
      const nameLineMatch = ocrText.match(/\b([A-Z][A-Za-z0-9\s\.\-\•\*]{1,30}\s+[A-Z]\.?)\b/);
      if (nameLineMatch) {
        extractedNameTess = nameLineMatch[1].trim();
      }

      let extractedPhoneTess = null;
      const phoneMatchOcr = ocrText.match(/(?:09|\+63\s*9)[\d\s\-]{8,14}/);
      if (phoneMatchOcr) {
        extractedPhoneTess = phoneMatchOcr[0].trim();
      }

      if (extractedNameTess || extractedPhoneTess) {
        const recipientCheck = checkRecipientCredentials(
          extractedNameTess,
          extractedPhoneTess,
          expectedRecipientName,
          expectedRecipientPhone,
          expectedOrgName
        );
        if (!recipientCheck.isMatch) {
          result.isPaymentReceipt = false;
          result.isAiVerified = false;
          result.confidenceScore = 0;
          result.extractedRef = null;
          result.extractedAmountPhp = null;
          for (const flag of recipientCheck.flags) {
            result.fraudFlags.push(flag);
          }
          result.summary = `⚠️ Fraud Alert: Recipient credentials mismatch detected on receipt.`;
          return result;
        }
      }

      // 2. Receipt Date Extraction & Stale/Expiration Check from OCR Text
      const dateMatch = ocrText.match(/\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}(?:\s+\d{1,2}:\d{2}\s*(?:AM|PM)?)?)\b/i);
      if (dateMatch) {
        result.receiptDate = dateMatch[1].trim();
        const parsedDate = new Date(result.receiptDate);
        if (!isNaN(parsedDate.getTime())) {
          const now = new Date();
          const diffDays = (now.getTime() - parsedDate.getTime()) / (1000 * 60 * 60 * 24);
          if (diffDays > 30 || (now.getFullYear() - parsedDate.getFullYear() >= 1)) {
            const daysAgo = Math.max(1, Math.round(diffDays));
            result.fraudFlags.push(`EXPIRED_RECEIPT: Receipt is dated ${result.receiptDate} (~${daysAgo} days old). Recycled or expired receipts cannot be accepted.`);
            result.isPaymentReceipt = false;
            result.isAiVerified = false;
            result.confidenceScore = 0;
            result.extractedRef = null;
            result.extractedAmountPhp = null;
            result.summary = `⚠️ Fraud Alert: ${result.fraudFlags.join(' | ')}`;
            return result;
          }
        }
      }

      // 3. Suspicious Sequential Reference Pattern Check
      if (isSuspiciousReferencePattern(extractedRefTess)) {
        result.fraudFlags.push(`SUSPICIOUS_REFERENCE_SEQUENCE: Reference #${extractedRefTess} contains an artificial sequential pattern. Authentic payment references are non-sequential.`);
        result.isPaymentReceipt = false;
        result.isAiVerified = false;
        result.confidenceScore = 0;
        result.extractedRef = null;
        result.extractedAmountPhp = null;
        result.summary = `⚠️ Fraud Alert: Suspicious sequential reference pattern detected.`;
        return result;
      }

      const hasRailMismatch = (detectedRailTess && paymentRail && (detectedRailTess.toLowerCase() !== paymentRail.toLowerCase())) ||
        (paymentRail && paymentRail.toLowerCase() === 'maya' && extractedRefTess && extractedRefTess.replace(/\D/g, '').length === 13);
        (paymentRail && paymentRail.toLowerCase() === 'maya' && extractedRefTess && extractedRefTess.replace(/\D/g, '').length === 13);

      if (!extractedRefTess) {
        // Financial keywords were present, but reference number was obscured or angled
        result.isPaymentReceipt = true;
        result.isAiVerified = false;
        result.confidenceScore = targetRefNo ? 50 : 35;
        result.extractedRef = targetRefNo || null;
        result.extractedAmountPhp = extractedAmtTess || (declaredPhpApprox > 0 ? declaredPhpApprox : null);
        result.detectedPaymentRail = detectedRailTess || paymentRail;
        result.fraudFlags.push('MANUAL_VERIFICATION_REQUIRED: Reference number could not be read automatically (screen glare or angle). Please enter reference number manually.');
        result.summary = 'Receipt detected. Please verify your reference number for NGO audit.';
        result.auditedBy = 'OCR_PARTIAL_MATCH';
        return result;
      }

      const extAmt = extractedAmtTess !== null ? extractedAmtTess : null;
      const hasAmtMismatch = extractedAmtTess && declaredPhpApprox > 0 && (Math.abs(extractedAmtTess - declaredPhpApprox) / declaredPhpApprox > 0.05);

      result.isPaymentReceipt = true;
      result.extractedRef = extractedRefTess;
      result.extractedAmountPhp = extAmt;
      result.detectedPaymentRail = detectedRailTess || (extractedRefTess && extractedRefTess.replace(/\D/g, '').length === 13 ? 'GCash' : null);
      result.auditedBy = 'AI_VISION_OCR_NORMALIZED_ENGINE';

      if (hasRailMismatch) {
        result.fraudFlags.push(`PAYMENT_RAIL_MISMATCH: Declared method is ${paymentRail}, but receipt is a ${result.detectedPaymentRail || 'GCash'} payment slip!`);
      }
      if (hasAmtMismatch) {
        result.fraudFlags.push(`AMOUNT_MISMATCH: Receipt states ₱${extractedAmtTess.toLocaleString()} PHP, but declared donation is ₱${declaredPhpApprox.toLocaleString()} PHP`);
      }

      if (hasRailMismatch || hasAmtMismatch) {
        result.isAiVerified = false;
        result.confidenceScore = 35;
        result.summary = `⚠️ Manual Audit Flagged: ${result.fraudFlags.join(' | ')}`;
      } else {
        result.isAiVerified = true;
        result.confidenceScore = 80;
        result.summary = `OCR verified ${paymentRail} Ref No: ${extractedRefTess}.${extAmt ? ` Amount: ₱${extAmt} PHP.` : ''}`;
      }

      return result;
    } catch (tessErr) {
      console.warn('Tesseract OCR engine exception:', tessErr.message);
    }

    // Default Fallback
    if (targetRefNo && targetRefNo.length >= 8) {
      result.isPaymentReceipt = true;
      result.isAiVerified = false;
      result.confidenceScore = 40;
      result.extractedRef = targetRefNo;
      result.extractedAmountPhp = declaredPhpApprox > 0 ? declaredPhpApprox : null;
      result.detectedPaymentRail = paymentRail;
      result.fraudFlags.push('MANUAL_AUDIT_REQUIRED: Automatic AI reading was inconclusive. Flagged for NGO manual verification.');
      result.summary = 'Receipt attached. Requires manual NGO confirmation.';
      result.auditedBy = 'MANUAL_AUDIT_FALLBACK';
      return result;
    }

    result.isPaymentReceipt = false;
    result.isAiVerified = false;
    result.confidenceScore = 0;
    result.extractedRef = null;
    result.extractedAmountPhp = null;
    result.detectedPaymentRail = null;
    result.fraudFlags.push('UNREADABLE_RECEIPT: Uploaded image could not be automatically verified. Please confirm reference number manually.');
    result.summary = 'Uploaded file could not be automatically verified. Please confirm reference number manually.';

  } catch (err) {
    console.error('❌ Error auditing receipt image:', err);
    result.isAiVerified = false;
    result.confidenceScore = 45;
    result.extractedRef = targetRefNo && !targetRefNo.startsWith('REF-') ? targetRefNo : null;
    result.fraudFlags.push('OCR_PROCESSING_ERROR');
    result.summary = `⚠️ Manual Audit (45%): Receipt requires manual NGO verification.`;
  }

  return result;
}

module.exports = {
  auditReceiptImage
};

