const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'c:/Users/Gester/OneDrive/Desktop/Blockchain/backend/.env' });

async function checkPending() {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: { rejectUnauthorized: false }
    });

    const [rows] = await conn.query('SELECT Manual_ID, Amount, Payment_Method, Reference_Number, LENGTH(Receipt_Base64) as b64_len, Status FROM MANUAL_DONATION ORDER BY Manual_ID DESC LIMIT 5');
    console.log('RECENT PENDING MANUAL DONATIONS:');
    console.log(rows);

    await conn.end();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkPending();
