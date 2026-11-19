const db = require('../database');

/**
 * Extracts client IP from incoming Express request.
 * Normalizes IPv6 localhost to IPv4 127.0.0.1.
 */
function getClientIp(req) {
  if (!req) return '127.0.0.1';
  const forwarded = req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip']);
  let ip = forwarded ? forwarded.split(',')[0].trim() : (req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || '127.0.0.1');
  if (ip === '::1' || ip === '::ffff:127.0.0.1') ip = '127.0.0.1';
  return ip;
}

/**
 * Recursively strips sensitive fields (passwords, tokens, keys)
 * before persisting metadata in activity logs.
 */
function sanitizeDetails(data) {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeDetails);

  const sensitiveKeys = [
    'password', 'new_password', 'current_password', 'confirm_password',
    'token', 'secret', 'secretkey', 'privatekey', 'private_key',
    'jwt', 'authorization', 'receipt_base64', 'base64image', 'file_buffer'
  ];

  const sanitized = {};
  for (const [key, val] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(s => lowerKey.includes(s))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      sanitized[key] = sanitizeDetails(val);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}

/**
 * Logs an activity into the persistent ACTIVITY_LOGS table.
 *
 * @param {Object} params
 * @param {import('express').Request} [params.req] - Express request object for IP & user resolution
 * @param {string} params.activity - Clear human-readable description of the event
 * @param {string} [params.userName] - Actor name
 * @param {string} [params.userEmail] - Actor email
 * @param {string} [params.role] - DONOR, NGO, ADMIN, or SYSTEM
 * @param {string} [params.target] - Target entity (e.g. Campaign title, user, donation ID)
 * @param {string} [params.category] - USER_MANAGEMENT, CAMPAIGN, DONATION, NGO, ADMIN_SECURITY, SYSTEM
 * @param {string} [params.status] - SUCCESS, FAILED, WARNING, INFO
 * @param {Object|string} [params.details] - Structured metadata diffs or context
 * @param {string} [params.ipAddress] - Optional explicit IP override
 */
async function logActivity({
  req,
  activity,
  userName,
  userEmail,
  role,
  target = 'System',
  category = 'SYSTEM',
  status = 'SUCCESS',
  details = null,
  ipAddress = null
}) {
  try {
    let resolvedUser = userName;
    let resolvedEmail = userEmail;
    let resolvedRole = role;

    if (req && req.user) {
      if (!resolvedUser) resolvedUser = req.user.name || req.user.orgName || req.user.username || 'User';
      if (!resolvedEmail) resolvedEmail = req.user.email || req.user.username || '';
      if (!resolvedRole) resolvedRole = req.user.role ? req.user.role.toUpperCase() : 'USER';
    }

    resolvedUser = resolvedUser || 'System';
    resolvedEmail = resolvedEmail || 'system@bbdrts.internal';
    resolvedRole = (resolvedRole || 'SYSTEM').toUpperCase();
    if (resolvedRole === 'ORGANIZATION') resolvedRole = 'NGO';

    const clientIp = ipAddress || getClientIp(req);

    // Merge User-Agent if available
    let meta = details ? sanitizeDetails(details) : {};
    if (req && req.headers && req.headers['user-agent'] && typeof meta === 'object' && meta !== null) {
      meta.userAgent = req.headers['user-agent'];
    }

    const detailsJson = Object.keys(meta).length > 0 ? JSON.stringify(meta) : null;

    await db.query(`
      INSERT INTO ACTIVITY_LOGS (Activity, User_Name, User_Email, Role, Target, Category, Status, IP_Address, Details_Json, Created_At)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [
      activity,
      resolvedUser,
      resolvedEmail,
      resolvedRole,
      target,
      category,
      status,
      clientIp,
      detailsJson
    ]);
  } catch (err) {
    // Activity logger must never throw or disrupt the calling request
    console.warn('[ActivityLogger] Failed to write log:', err.message);
  }
}

/**
 * Seeds initial baseline logs if table is completely empty.
 */
async function seedInitialActivityLogs() {
  try {
    const [rows] = await db.query('SELECT COUNT(*) as count FROM ACTIVITY_LOGS');
    const count = rows && rows[0] ? (rows[0].count || rows[0]['COUNT(*)']) : 0;
    if (count > 0) return;

    console.log('🌱 Pre-seeding baseline System Activity Logs...');

    const baselineLogs = [
      {
        activity: 'System initialized & Sepolia EVM smart contract verified',
        userName: 'BBDRTS System',
        userEmail: 'system@bbdrts.internal',
        role: 'SYSTEM',
        target: 'Contract: 0xB8Effb4f0394946a01da9C5342fC2e70c1E99ddA',
        category: 'SYSTEM',
        status: 'SUCCESS',
        ipAddress: '127.0.0.1',
        details: { network: 'Sepolia Testnet', version: 'Solidity 0.8.20', standard: 'ERC-20 & Milestone Escrow' }
      },
      {
        activity: 'Admin (AdminDesk) logged in to governance console',
        userName: 'AdminDesk',
        userEmail: 'admin@bbdrts.gov.ph',
        role: 'ADMIN',
        target: 'Admin Dashboard',
        category: 'ADMIN_SECURITY',
        status: 'SUCCESS',
        ipAddress: '127.0.0.1',
        details: { action: 'AUTH_LOGIN', method: 'Password + Session JWT' }
      },
      {
        activity: 'ReliefLink PH (NGO) submitted SEC accreditation for verification',
        userName: 'ReliefLink PH',
        userEmail: 'relieflinkph@gmail.com',
        role: 'NGO',
        target: 'Accreditation: SEC-REG-2024-884129',
        category: 'NGO',
        status: 'SUCCESS',
        ipAddress: '120.28.175.42',
        details: { registrationNo: 'SEC-REG-2024-884129', province: 'Southern Leyte', region: 'Region VIII' }
      },
      {
        activity: 'Admin approved the SEC accreditation of ReliefLink PH',
        userName: 'AdminDesk',
        userEmail: 'admin@bbdrts.gov.ph',
        role: 'ADMIN',
        target: 'NGO: ReliefLink PH',
        category: 'NGO',
        status: 'SUCCESS',
        ipAddress: '127.0.0.1',
        details: { decision: 'Approved', verifiedBy: 'SuperAdmin', compliance: 'RA 10121 Philippine Disaster Risk Reduction' }
      },
      {
        activity: 'ReliefLink PH (NGO) created new campaign "Sogod Community Emergency Relief Campaign"',
        userName: 'ReliefLink PH',
        userEmail: 'relieflinkph@gmail.com',
        role: 'NGO',
        target: 'Campaign #1: Sogod Emergency Relief',
        category: 'CAMPAIGN',
        status: 'SUCCESS',
        ipAddress: '120.28.175.42',
        details: { targetPhp: 750000, targetEth: '2.5000', location: 'Sogod, Southern Leyte' }
      },
      {
        activity: 'Juan Migs Santos (Donor) registered a new donor account',
        userName: 'Juan Migs Santos',
        userEmail: 'juanmigs.santos05@gmail.com',
        role: 'DONOR',
        target: 'Donor: Juan Migs Santos',
        category: 'USER_MANAGEMENT',
        status: 'SUCCESS',
        ipAddress: '112.201.88.19',
        details: { role: 'DONOR', authMethod: 'Localhost / Email' }
      },
      {
        activity: 'Juan Migs Santos (Donor) uploaded donation receipt (₱2,000 via GCash)',
        userName: 'Juan Migs Santos',
        userEmail: 'juanmigs.santos05@gmail.com',
        role: 'DONOR',
        target: 'Receipt Ref #9001882142',
        category: 'DONATION',
        status: 'SUCCESS',
        ipAddress: '112.201.88.19',
        details: { amount: 2000, paymentMethod: 'GCash', campaign: 'Sogod Community Emergency Relief' }
      },
      {
        activity: 'AI Vision OCR verified donation receipt ref #9001882142',
        userName: 'BBDRTS OCR Engine',
        userEmail: 'ai-audit@bbdrts.internal',
        role: 'SYSTEM',
        target: 'Receipt Ref #9001882142',
        category: 'DONATION',
        status: 'SUCCESS',
        ipAddress: '127.0.0.1',
        details: { confidence: 0.98, detectedAmount: 2000, detectedMethod: 'GCash', status: 'MATCH' }
      },
      {
        activity: 'ReliefLink PH (NGO) confirmed and verified receipt #9001882142',
        userName: 'ReliefLink PH',
        userEmail: 'relieflinkph@gmail.com',
        role: 'NGO',
        target: 'Donation: ₱2,000',
        category: 'DONATION',
        status: 'SUCCESS',
        ipAddress: '120.28.175.42',
        details: { creditedPhp: 2000, onChainRelayed: true, txHash: '0x9f31a2...a642' }
      }
    ];

    for (const item of baselineLogs) {
      await db.query(`
        INSERT INTO ACTIVITY_LOGS (Activity, User_Name, User_Email, Role, Target, Category, Status, IP_Address, Details_Json, Created_At)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        item.activity,
        item.userName,
        item.userEmail,
        item.role,
        item.target,
        item.category,
        item.status,
        item.ipAddress,
        JSON.stringify(item.details)
      ]);
    }

    console.log(`✅ Seeded ${baselineLogs.length} baseline System Activity Logs.`);
  } catch (err) {
    console.warn('[ActivityLogger] Error during seeding:', err.message);
  }
}

// Auto-run seeder on module load
seedInitialActivityLogs();

module.exports = {
  logActivity,
  getClientIp,
  sanitizeDetails,
  seedInitialActivityLogs
};
