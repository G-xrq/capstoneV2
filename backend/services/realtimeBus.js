/**
 * BBDRTS Real-Time Event Broadcast Bus (SSE + Scoped Version Ledger)
 *
 * Streams instant, zero-polling invalidation events to all connected dashboards
 * (Donor, NGO/Organization, Admin, Public Landing) whenever any write operation
 * succeeds on the backend. Also exposes a monotonic per-scope version map for
 * ultra-lightweight fallback/catch-up sync after network drops or tab sleep.
 */

const ALL_SCOPES = [
  'campaigns',
  'donations',
  'manual_donations',
  'disbursements',
  'organizations',
  'announcements',
  'maintenance',
  'notifications',
  'qr_codes',
  'backups',
  'presence',
  'profile',
  'audit',
  'analytics',
];

const clients = new Set();
let globalVersion = 1;
const scopeVersions = {};
ALL_SCOPES.forEach((s) => {
  scopeVersions[s] = 1;
});

let nextClientId = 1;
let lastPresenceEmitAt = 0;

/**
 * Publish a real-time change event to all connected SSE clients.
 * @param {string|string[]} scopes - One or more affected data scopes
 * @param {object} meta - Optional metadata (method, path, reason)
 */
function publish(scopes, meta = {}) {
  const list = Array.isArray(scopes) ? scopes : [scopes];
  const validScopes = Array.from(new Set(list.filter(Boolean)));
  if (validScopes.length === 0) return;

  globalVersion += 1;
  const now = Date.now();
  for (const sc of validScopes) {
    scopeVersions[sc] = (scopeVersions[sc] || 1) + 1;
  }

  const payload = JSON.stringify({
    version: globalVersion,
    scopes: validScopes,
    scopeVersions: { ...scopeVersions },
    reason: meta.reason || meta.path || 'mutation',
    ts: now,
  });

  const frame = `event: update\ndata: ${payload}\n\n`;
  for (const client of clients) {
    try {
      client.res.write(frame);
      if (typeof client.res.flush === 'function') {
        client.res.flush();
      }
    } catch (_) {
      clients.delete(client);
    }
  }
}

/**
 * Resolve affected dashboard scopes from an HTTP mutation request.
 * Returns null for read-only utility POST routes that should not trigger reloads.
 */
function resolveScopesForRequest(method, rawPath, reqBody = null) {
  const m = String(method || '').toUpperCase();
  if (m !== 'POST' && m !== 'PUT' && m !== 'PATCH' && m !== 'DELETE') {
    return null;
  }

  const p = String(rawPath || '').split('?')[0].toLowerCase();

  // Ignore read-only utility POST endpoints & high-frequency auth checks
  if (
    p === '/api/donations/check-duplicate-ref' ||
    p === '/api/verify-receipt-ai' ||
    p === '/api/ai/inspect-receipt' ||
    p === '/api/ai/generate-campaign-budget' ||
    p === '/api/ai/copilot-chat' ||
    p === '/api/ai/chat' ||
    p === '/api/ai/test-key' ||
    p === '/api/auth/login' ||
    p === '/api/auth/login-2fa-verify' ||
    p === '/api/auth/login-otp-request' ||
    p === '/api/auth/login-otp-verify' ||
    p === '/api/auth/direct-admin' ||
    p === '/api/auth/forgot-password' ||
    p === '/api/auth/reset-password' ||
    p === '/api/auth/2fa/generate' ||
    p === '/api/auth/register-request'
  ) {
    return null;
  }

  // Presence heartbeats: only broadcast on meaningful transitions or throttled every 5s
  if (p === '/api/presence/heartbeat') {
    const evt = reqBody && typeof reqBody === 'object' ? reqBody.eventType : null;
    const now = Date.now();
    if (evt === 'login' || evt === 'logout' || evt === 'account_created' || now - lastPresenceEmitAt > 5000) {
      lastPresenceEmitAt = now;
      return ['presence'];
    }
    return null;
  }

  if (p === '/api/presence/leave' || p.startsWith('/api/admin/active-users')) {
    return ['presence'];
  }

  // Disbursements & campaign mutations
  if (p.includes('/disburse')) {
    return ['disbursements', 'campaigns', 'audit', 'analytics', 'notifications'];
  }
  if (p.startsWith('/api/campaigns')) {
    return ['campaigns', 'audit', 'analytics', 'notifications'];
  }

  // Manual donation verification & submissions
  if (p.startsWith('/api/manual-donations')) {
    return ['manual_donations', 'donations', 'campaigns', 'audit', 'analytics', 'notifications'];
  }

  // Direct donations, intents, checkouts, webhooks
  if (
    p.startsWith('/api/donations') ||
    p.startsWith('/api/payments') ||
    p.startsWith('/api/webhooks') ||
    p.startsWith('/api/org/donations')
  ) {
    return ['donations', 'campaigns', 'audit', 'analytics', 'notifications'];
  }

  // Organization KYC & Admin Organization Verification
  if (
    p.startsWith('/api/organization/kyc') ||
    p.startsWith('/api/org/kyc-submit') ||
    p.startsWith('/api/admin/organizations')
  ) {
    return ['organizations', 'profile', 'audit', 'analytics', 'notifications'];
  }

  // Saved Organization QR Codes
  if (p.startsWith('/api/organization/qr-codes')) {
    return ['qr_codes', 'campaigns'];
  }

  // Broadcast Announcements
  if (p.startsWith('/api/admin/announcements')) {
    return ['announcements', 'notifications', 'audit'];
  }

  // System Maintenance Mode
  if (p.startsWith('/api/admin/maintenance') || p.startsWith('/api/system/maintenance')) {
    return ['maintenance', 'audit'];
  }

  // Database Backups
  if (p.startsWith('/api/admin/backups')) {
    return ['backups', 'audit'];
  }

  // Notifications inbox actions
  if (p.startsWith('/api/notifications')) {
    return ['notifications'];
  }

  // User profile, preferences, wallet, email change, account registration
  if (
    p.startsWith('/api/auth/profile') ||
    p.startsWith('/api/auth/preferences') ||
    p.startsWith('/api/auth/wallet') ||
    p.startsWith('/api/auth/verify-email-change') ||
    p.startsWith('/api/auth/cancel-email-change')
  ) {
    return ['profile', 'organizations'];
  }

  if (p === '/api/auth/register' || p === '/api/auth/register-verify') {
    return ['organizations', 'audit', 'analytics', 'presence'];
  }

  return ['audit'];
}

/**
 * Express middleware that automatically publishes scoped real-time invalidation
 * events whenever any mutating endpoint completes with HTTP 2xx.
 */
function realtimeAutoPublishMiddleware(req, res, next) {
  const m = req.method;
  if (m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE') {
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const scopes = resolveScopesForRequest(m, req.originalUrl || req.path, req.body);
        if (scopes && scopes.length > 0) {
          publish(scopes, { method: m, path: req.path });
        }
      }
    });
  }
  next();
}

/**
 * Express route handler for GET /api/realtime/stream (Server-Sent Events)
 */
function handleStream(req, res) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  const client = {
    id: nextClientId++,
    res,
    connectedAt: Date.now(),
  };
  clients.add(client);

  // Initial handshake frame with current global & per-scope versions
  try {
    const handshake = JSON.stringify({
      version: globalVersion,
      scopeVersions: { ...scopeVersions },
      serverTime: Date.now(),
    });
    res.write(`retry: 2500\nevent: connected\ndata: ${handshake}\n\n`);
  } catch (_) {
    clients.delete(client);
    return;
  }

  // Keepalive ping every 22s so proxies (Render/Cloudflare/Nginx) keep the SSE stream warm
  const keepalive = setInterval(() => {
    try {
      res.write(`: keepalive ${Date.now()}\n\n`);
    } catch (_) {
      clearInterval(keepalive);
      clients.delete(client);
    }
  }, 22000);

  req.on('close', () => {
    clearInterval(keepalive);
    clients.delete(client);
  });
}

/**
 * Express route handler for GET /api/realtime/version (Ultra-lightweight catch-up check)
 */
function handleVersion(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    version: globalVersion,
    scopeVersions: { ...scopeVersions },
    connectedClients: clients.size,
    serverTime: Date.now(),
  });
}

module.exports = {
  ALL_SCOPES,
  publish,
  realtimeAutoPublishMiddleware,
  handleStream,
  handleVersion,
};
