const crypto = require('crypto');

const PAYMONGO_API_BASE = 'https://api.paymongo.com/v1';

function getPaymongoKey() {
  return String(process.env.PAYMONGO_SECRET_KEY || '').trim();
}

function getWebhookSecret() {
  return String(process.env.PAYMONGO_WEBHOOK_SECRET || '').trim();
}

function isPaymongoConfigured() {
  const key = getPaymongoKey();
  return Boolean(key && (key.startsWith('sk_test_') || key.startsWith('sk_live_')));
}

function isLiveMode() {
  return getPaymongoKey().startsWith('sk_live_');
}

function mapRailToPaymongoTypes(method = 'GCash') {
  const m = String(method || '').toUpperCase();
  if (m.includes('GCASH')) return ['gcash', 'qrph'];
  if (m.includes('MAYA')) return ['paymaya', 'qrph'];
  if (m.includes('CARD') || m.includes('BANK')) return ['card', 'qrph', 'dob', 'dob_ubp'];
  return ['gcash', 'paymaya', 'qrph', 'card'];
}

function generateTrackingCode() {
  const rand = crypto.randomInt(1000, 9999);
  const alpha = crypto.randomBytes(1).toString('hex').toUpperCase();
  return `BB-${rand}${alpha}`;
}

/**
 * Create a PayMongo Checkout Session (real API when PAYMONGO_SECRET_KEY is configured,
 * or built-in test sandbox session otherwise so end-to-end automated webhook flows
 * work out-of-the-box during local development and capstone defense demos).
 */
async function createCheckoutSession({
  intentId,
  trackingCode,
  campaignId,
  campaignTitle,
  amountPhp,
  paymentMethod = 'GCash',
  donorEmail = '',
  donorName = '',
  successUrl,
  cancelUrl
}) {
  const numericPhp = Math.max(1, Math.round(Number(amountPhp) || 0));
  const amountCentavos = Math.max(100, numericPhp * 100); // PayMongo minimum is 100 centavos (₱1.00)

  if (!isPaymongoConfigured()) {
    const sandboxSessionId = `cs_sandbox_${trackingCode.replace(/[^A-Z0-9]/gi, '')}_${Date.now()}`;
    return {
      provider: 'sandbox',
      sessionId: sandboxSessionId,
      checkoutUrl: null,
      amountPhp: numericPhp,
      paymentMethodTypes: mapRailToPaymongoTypes(paymentMethod)
    };
  }

  const secretKey = getPaymongoKey();
  const authHeader = 'Basic ' + Buffer.from(`${secretKey}:`).toString('base64');

  const payload = {
    data: {
      attributes: {
        billing: donorName || donorEmail ? {
          name: donorName || 'BBDRTS Supporter',
          email: donorEmail || undefined
        } : undefined,
        send_email_receipt: Boolean(donorEmail),
        show_description: true,
        show_line_items: true,
        description: `BBDRTS Disaster Relief · ${campaignTitle} (${trackingCode})`,
        line_items: [
          {
            currency: 'PHP',
            amount: amountCentavos,
            name: `${campaignTitle || `Campaign #${campaignId}`}`.slice(0, 120),
            quantity: 1,
            description: `Ref ${trackingCode} · 100% Gasless Sepolia Audited`
          }
        ],
        payment_method_types: mapRailToPaymongoTypes(paymentMethod),
        reference_number: trackingCode,
        metadata: {
          intent_id: String(intentId),
          tracking_code: String(trackingCode),
          campaign_id: String(campaignId),
          payment_method: String(paymentMethod)
        },
        success_url: successUrl || 'http://localhost:5173/?payment_status=success',
        cancel_url: cancelUrl || 'http://localhost:5173/?payment_status=cancelled'
      }
    }
  };

  const resp = await fetch(`${PAYMONGO_API_BASE}/checkout_sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: authHeader
    },
    body: JSON.stringify(payload)
  });

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || !json?.data?.id) {
    const detail = json?.errors?.[0]?.detail || `PayMongo HTTP ${resp.status}`;
    throw new Error(`PayMongo Checkout error: ${detail}`);
  }

  return {
    provider: 'paymongo',
    sessionId: json.data.id,
    checkoutUrl: json.data.attributes?.checkout_url || null,
    amountPhp: numericPhp,
    paymentMethodTypes: json.data.attributes?.payment_method_types || mapRailToPaymongoTypes(paymentMethod)
  };
}

/**
 * Verify PayMongo-Signature header (`t=<ts>,te=<test_sig>,li=<live_sig>`) using HMAC-SHA256.
 * Returns { valid: true } when secret is not set (sandbox/test dev), or verifies cryptographic signature when set.
 */
function verifyWebhookSignature(rawBody, signatureHeader) {
  const secret = getWebhookSecret();
  if (!secret) {
    return { valid: true, mode: 'unverified_dev' };
  }
  if (!signatureHeader || typeof signatureHeader !== 'string') {
    return { valid: false, reason: 'Missing Paymongo-Signature header' };
  }

  const parts = {};
  signatureHeader.split(',').forEach((seg) => {
    const [k, v] = seg.split('=');
    if (k && v) parts[k.trim()] = v.trim();
  });

  const timestamp = parts.t;
  const expectedSig = isLiveMode() ? (parts.li || parts.te) : (parts.te || parts.li);
  if (!timestamp || !expectedSig) {
    return { valid: false, reason: 'Malformed Paymongo-Signature header' };
  }

  const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '');
  const computed = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${bodyStr}`)
    .digest('hex');

  const a = Buffer.from(computed, 'utf8');
  const b = Buffer.from(expectedSig, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { valid: false, reason: 'HMAC signature mismatch' };
  }

  return { valid: true, mode: 'hmac_verified' };
}

module.exports = {
  isPaymongoConfigured,
  isLiveMode,
  generateTrackingCode,
  createCheckoutSession,
  verifyWebhookSignature
};
