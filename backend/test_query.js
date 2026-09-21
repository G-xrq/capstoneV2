require('dotenv').config({ path: './.env' });
const mysql = require('mysql2/promise');

(async () => {
  try {
    const conn = await mysql.createConnection(process.env.DATABASE_URL || {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 4000,
      ssl: { rejectUnauthorized: false }
    });

    const userId = 3;
    const userWallet = '0x206e022d47003b67ee72bd67fdf2406d43aabc2c';

    // 1. Test donations/me query
    const [donations] = await conn.query(`
      SELECT 
        dt.Transaction_ID as id,
        dt.Tx_Hash as txHash,
        dt.Amount as amount,
        COALESCE(dt.Payment_Method, 'ETH') as paymentMethod,
        dt.Campaign_ID as campaignId,
        dt.Is_Anonymous as isAnonymous,
        c.Campaign_Title as campaignTitle,
        o.Org_Name as orgName,
        dt.Created_At as createdAt,
        dt.Donor_ID as donorId,
        COALESCE(dt.Wallet_Address, d.Wallet_Address, '') as donorWallet,
        COALESCE(NULLIF(d.Display_Name, ''), NULLIF(d.Name, ''), NULLIF(d.Username, '')) as donorName,
        d.Avatar_Url as donorAvatar
      FROM DONATION_TRANSACTION dt
      LEFT JOIN DONOR d ON dt.Donor_ID = d.Donor_ID
      LEFT JOIN CAMPAIGN c ON dt.Campaign_ID = c.Campaign_ID
      LEFT JOIN ORGANIZATION o ON (dt.Org_ID = o.Org_ID OR c.Org_ID = o.Org_ID)
      WHERE (dt.Org_ID = ? OR c.Org_ID = ? OR (o.Wallet_Address IS NOT NULL AND LOWER(o.Wallet_Address) = ?))
      ORDER BY dt.Transaction_ID DESC
    `, [userId, userId, userWallet]);
    console.log('✅ /api/donations/me returned rows:', donations.length);

    // 2. Test manual-donations/pending query
    const [pending] = await conn.query(`
      SELECT m.*, d.Username as Donor_Name, d.Username as Donor_Email_Real, c.Campaign_Title, o.Org_Name
      FROM MANUAL_DONATION m 
      LEFT JOIN DONOR d ON m.Donor_ID = d.Donor_ID 
      JOIN CAMPAIGN c ON m.Campaign_ID = c.Campaign_ID 
      LEFT JOIN ORGANIZATION o ON c.Org_ID = o.Org_ID
      WHERE m.Status = 'Pending' AND c.Org_ID = ?
      ORDER BY m.Manual_ID DESC
    `, [userId]);
    console.log('✅ /api/manual-donations/pending returned rows:', pending.length);

    await conn.end();
  } catch (e) {
    console.error('❌ Query error:', e);
  }
})();
