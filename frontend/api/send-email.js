import nodemailer from 'nodemailer';

const EMAIL_RELAY_SECRET = process.env.EMAIL_RELAY_SECRET;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

export default async function handler(req, res) {
  // CORS configuration for cross-origin dispatch from backend
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-relay-secret'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  if (!EMAIL_RELAY_SECRET || !SMTP_USER || !SMTP_PASS) {
    return res.status(500).json({ error: 'Email relay service is unconfigured. Required environment variables (EMAIL_RELAY_SECRET, SMTP_USER, SMTP_PASS) are missing.' });
  }

  const clientSecret = req.headers['x-relay-secret'] || req.body?.secret;
  if (clientSecret !== EMAIL_RELAY_SECRET) {
    return res.status(401).json({ error: 'Unauthorized email relay request. Invalid secret key.' });
  }

  const { to, subject, html, text } = req.body;
  if (!to || (!html && !text)) {
    return res.status(400).json({ error: 'Missing required parameters: to, and html or text.' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      },
      connectionTimeout: 9000,
      greetingTimeout: 9000
    });

    const info = await transporter.sendMail({
      from: `"BBDRTS Protocol" <${SMTP_USER}>`,
      to,
      subject: subject || 'BBDRTS Protocol Verification Code',
      text: text || '',
      html: html || `<p>${text}</p>`
    });

    console.log(`✅ [VERCEL RELAY] Email dispatched to ${to} | ID: ${info.messageId}`);
    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      recipient: to
    });
  } catch (error) {
    console.error('❌ [VERCEL RELAY ERROR]:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
