const db = require('../backend/database.js');

async function checkTokens() {
  try {
    const [tokens] = await db.query('SELECT * FROM EMAIL_CHANGE_TOKENS');
    console.log('EMAIL_CHANGE_TOKENS rows:', tokens);
  } catch (err) {
    console.log('EMAIL_CHANGE_TOKENS err:', err.message);
  }

  try {
    const [donors] = await db.query('SELECT Donor_ID, Username, Name, Display_Name, Legal_Name FROM DONOR WHERE LOWER(Username) LIKE "%macaldo%"');
    console.log('Donors matching macaldo:', donors);
  } catch (err) {
    console.log('Donors err:', err.message);
  }

  process.exit(0);
}

checkTokens().catch(e => {
  console.error(e);
  process.exit(1);
});
