const crypto = require('crypto');

const XENDIT_API_BASE = 'https://api.xendit.co';

function getXenditKey() {
  return String(process.env.XENDIT_SECRET_KEY || '').trim();
}

function getXenditWebhookToken() {
  return String(process.env.XENDIT_WEBHOOK_TOKEN || '').trim();
}

function isXenditConfigured() {
  const key = getXenditKey();
  return Boolean(key && (key.startsWith('xnd_development_') || key.startsWith('xnd_production_')));
}

function isXenditLive() {
  return getXenditKey().startsWith('xnd_production_');
}

function authHeader() {
  return 'Basic ' + Buffer.from(`${getXenditKey()}:`).toString('base64');
}

function mapRailToXenditMethods(method = 'GCash') {
  const m = String(method || '').toUpperCase();
  if (m.includes('GCASH')) return ['GCASH', 'QRPH'];
  if (m.includes('MAYA')) return ['PAYMAYA', 'QRPH'];
  if (m.includes('CARD') || m.includes('BANK')) return ['CREDIT_CARD', 'QRPH', 'DD_BPI', 'DD_UBP'];
  return ['GCASH', 'PAYMAYA', 'QRPH', 'CREDIT_CARD'];
}

/**
 * Create a real Xendit Checkout Invoice (Test or Live depending on XENDIT_SECRET_KEY).
 * Supports GCash, Maya (PAYMAYA), Dynamic QR Ph (QRPH), Cards, and PH Banks in PHP.
 */
async function createInvoice({
  intentId,
  trackingCode,
  campaignId,
  campaignTitle,
  amountPhp,
  paymentMethod = 'GCash',
  donorEmail = '',
  donorName = '',
  successUrl,
  failureUrl
}) {
  if (!isXenditConfigured()) {
    throw new Error('XENDIT_SECRET_KEY is not configured in backend/.env');
  }

  const numericPhp = Math.max(1, Math.round(Number(amountPhp) || 0));
  const payload = {
    external_id: `${trackingCode}-I${intentId}`,
    amount: numericPhp,
    currency: 'PHP',
    description: `BBDRTS Disaster Relief · ${campaignTitle || `Campaign #${campaignId}`} (${trackingCode})`,
    invoice_duration: 1800, // 30 minutes
    payment_methods: mapRailToXenditMethods(paymentMethod),
    success_redirect_url: successUrl || 'http://localhost:5173/?payment_status=success',
    failure_redirect_url: failureUrl || 'http://localhost:5173/?payment_status=cancelled',
    metadata: {
      intent_id: String(intentId),
      tracking_code: String(trackingCode),
      campaign_id: String(campaignId),
      payment_method: String(paymentMethod)
    }
  };

  if (donorEmail && donorEmail.includes('@')) {
    payload.payer_email = donorEmail;
  }
  if (donorName) {
    payload.customer = { given_names: String(donorName).slice(0, 80) };
  }

  const resp = await fetch(`${XENDIT_API_BASE}/v2/invoices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: authHeader()
    },
    body: JSON.stringify(payload)
  });

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || !json?.id || !json?.invoice_url) {
    const detail = json?.message || json?.error_code || `Xendit HTTP ${resp.status}`;
    throw new Error(`Xendit Invoice error: ${detail}`);
  }

  return {
    provider: 'xendit',
    sessionId: json.id,
    checkoutUrl: json.invoice_url,
    amountPhp: numericPhp,
    status: json.status || 'PENDING'
  };
}

/**
 * Fetch live invoice status directly from Xendit API (enables real status sync even on localhost).
 */
async function getInvoice(invoiceId) {
  if (!isXenditConfigured() || !invoiceId) return null;
  const resp = await fetch(`${XENDIT_API_BASE}/v2/invoices/${encodeURIComponent(invoiceId)}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: authHeader()
    }
  });
  if (!resp.ok) return null;
  return resp.json().catch(() => null);
}

/**
 * Verify Xendit webhook `x-callback-token` header using constant-time comparison.
 */
function verifyWebhookToken(callbackTokenHeader) {
  const expected = getXenditWebhookToken();
  if (!expected) return { valid: true, mode: 'unverified_dev' };
  if (!callbackTokenHeader || typeof callbackTokenHeader !== 'string') {
    return { valid: false, reason: 'Missing x-callback-token header' };
  }
  const a = Buffer.from(callbackTokenHeader.trim(), 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { valid: false, reason: 'Invalid x-callback-token' };
  }
  return { valid: true, mode: 'token_verified' };
}

/**
 * Create an Embedded Dynamic QR Ph code via Xendit QR Codes API (ZERO redirect — renders directly inside BBDRTS modal).
 * Works with GCash, Maya, BPI, BDO, UnionBank, and all QR Ph-compliant Philippine apps.
 */
async function createDynamicQrPh({
  intentId,
  trackingCode,
  campaignId,
  amountPhp,
  paymentMethod = 'GCash'
}) {
  if (!isXenditConfigured()) {
    throw new Error('XENDIT_SECRET_KEY is not configured in backend/.env');
  }
  const numericPhp = Math.max(1, Math.round(Number(amountPhp) || 0));
  const payload = {
    reference_id: `${trackingCode}-I${intentId}`,
    type: 'DYNAMIC',
    currency: 'PHP',
    amount: numericPhp,
    channel_code: 'QRPH',
    metadata: {
      intent_id: String(intentId),
      tracking_code: String(trackingCode),
      campaign_id: String(campaignId),
      payment_method: String(paymentMethod)
    }
  };

  const resp = await fetch(`${XENDIT_API_BASE}/qr_codes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'api-version': '2022-07-31',
      Authorization: authHeader()
    },
    body: JSON.stringify(payload)
  });

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || !json?.id || !json?.qr_string) {
    const detail = json?.message || json?.error_code || `Xendit QR Ph HTTP ${resp.status}`;
    throw new Error(`Xendit Dynamic QR Ph error: ${detail}`);
  }

  return {
    provider: 'xendit_qrph',
    sessionId: json.id,
    qrString: json.qr_string,
    expiresAt: json.expires_at || null,
    checkoutUrl: null,
    amountPhp: numericPhp,
    status: json.status || 'ACTIVE',
    liveMode: isXenditLive()
  };
}

/**
 * Fetch payments made against a Xendit Dynamic QR Ph code.
 */
async function getQrPhPayments(qrId) {
  if (!isXenditConfigured() || !qrId) return [];
  const resp = await fetch(`${XENDIT_API_BASE}/qr_codes/${encodeURIComponent(qrId)}/payments`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'api-version': '2022-07-31',
      Authorization: authHeader()
    }
  });
  if (!resp.ok) return [];
  const json = await resp.json().catch(() => ({}));
  return Array.isArray(json?.data) ? json.data : [];
}

/**
 * Trigger Xendit's official Test-Mode QR Ph payment simulation (strictly disabled in Live Mode).
 */
async function simulateQrPhPayment(qrId, amountPhp) {
  if (!isXenditConfigured() || isXenditLive()) {
    throw new Error('QR Ph simulation is only available in Xendit Test Mode.');
  }
  const resp = await fetch(`${XENDIT_API_BASE}/qr_codes/${encodeURIComponent(qrId)}/payments/simulate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'api-version': '2022-07-31',
      Authorization: authHeader()
    },
    body: JSON.stringify({ amount: Math.max(1, Math.round(Number(amountPhp) || 0)) })
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(json?.message || `Xendit QR simulate HTTP ${resp.status}`);
  }
  return json;
}

function generateTrackingCode() {
  return `BB${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

module.exports = {
  isXenditConfigured,
  isXenditLive,
  generateTrackingCode,
  createInvoice,
  getInvoice,
  createDynamicQrPh,
  getQrPhPayments,
  simulateQrPhPayment,
  verifyWebhookToken
};
