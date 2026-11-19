const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
let sqlite3 = null;
try {
  sqlite3 = require('sqlite3').verbose();
} catch (err) {
  console.warn('⚠️ SQLite native driver could not be loaded:', err.message);
}
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const isCloud = !!process.env.DB_HOST;
let activeDriver = 'mysql'; // 'mysql' or 'sqlite'
let mysqlPool = null;
let sqliteDb = null;

// Dynamic MySQL configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  port: Number(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME || 'blockchain_relief',
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  timezone: 'Z',
  ...(isCloud ? { ssl: { rejectUnauthorized: false } } : {})
};

// ── Seed Default Accounts Helper ─────────────────────────────
async function seedDefaultAccounts(driver) {
  try {
    const adminPasswordHash = await bcrypt.hash('admin123', 10);
    const defaultPasswordHash = await bcrypt.hash('password123', 10);

    if (driver === 'sqlite') {
      sqliteDb.get('SELECT COUNT(*) as count FROM ADMINISTRATOR', (err, row) => {
        if (!err && row && row.count === 0) {
          sqliteDb.run(`INSERT INTO ADMINISTRATOR (Username, Password, Wallet_Address) VALUES (?, ?, ?)`,
            ['admin@bbdrts.gov.ph', adminPasswordHash, '0x206e5d8b76c8c4598d1a457493a746535560b771']);
        }
      });

      sqliteDb.get('SELECT COUNT(*) as count FROM DONOR', (err, row) => {
        if (!err && row && row.count === 0) {
          sqliteDb.run(`INSERT INTO DONOR (Username, Password, Total_Donated, Wallet_Address) VALUES (?, ?, ?, ?)`,
            ['donor@bbdrts.gov.ph', defaultPasswordHash, 0, null]);
        }
      });
    } else if (driver === 'mysql' && mysqlPool) {
      const [adminRows] = await mysqlPool.query('SELECT COUNT(*) as count FROM ADMINISTRATOR');
      if (adminRows[0].count === 0) {
        await mysqlPool.query(`INSERT INTO ADMINISTRATOR (Username, Password, Wallet_Address) VALUES (?, ?, ?)`,
          ['admin@bbdrts.gov.ph', adminPasswordHash, '0x206e5d8b76c8c4598d1a457493a746535560b771']);
      }

      const [donorRows] = await mysqlPool.query('SELECT COUNT(*) as count FROM DONOR');
      if (donorRows[0].count === 0) {
        await mysqlPool.query(`INSERT INTO DONOR (Username, Password, Total_Donated, Wallet_Address) VALUES (?, ?, ?, ?)`,
          ['donor@bbdrts.gov.ph', defaultPasswordHash, 0, null]);
      }
    }
  } catch (err) {
    console.warn('Seed account note:', err.message);
  }
}

// ── Initialize SQLite Fallback ────────────────────────────────
function initSqlite() {
  return new Promise((resolve, reject) => {
    if (!sqlite3) {
      return reject(new Error('SQLite native driver is not available on this host. Please configure MySQL (DB_HOST, DB_USER, DB_PASSWORD).'));
    }
    const dbPath = path.resolve(__dirname, 'blockchain_relief.db');
    sqliteDb = new sqlite3.Database(dbPath, (err) => {
      if (err) return reject(err);
      console.log('✅ Connected to local SQLite Database (Zero-Config Fallback).');

      // Create Tables in SQLite
      sqliteDb.serialize(() => {
        sqliteDb.run(`
          CREATE TABLE IF NOT EXISTS ADMINISTRATOR (
            Admin_ID INTEGER PRIMARY KEY AUTOINCREMENT,
            Username TEXT UNIQUE NOT NULL,
            Password TEXT NOT NULL,
            Wallet_Address TEXT
          )
        `);

        sqliteDb.run(`
          CREATE TABLE IF NOT EXISTS ORGANIZATION (
            Org_ID INTEGER PRIMARY KEY AUTOINCREMENT,
            Username TEXT UNIQUE NOT NULL,
            Password TEXT NOT NULL,
            Org_Name TEXT,
            Verification_Status TEXT DEFAULT 'Pending',
            Wallet_Address TEXT,
            Mobile_Number TEXT,
            Sec_Registration_No TEXT,
            Sec_Certificate_Url TEXT,
            Board_Members_Json TEXT,
            Dswd_Accreditation_No TEXT,
            Verified_At DATETIME,
            Verified_By TEXT,
            Audit_Notes TEXT
          )
        `);

        // Migration check for existing SQLite databases
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Mobile_Number TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Sec_Registration_No TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Sec_Certificate_Url TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Board_Members_Json TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Dswd_Accreditation_No TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Verified_At DATETIME`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Verified_By TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Audit_Notes TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Banner_Url TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Preferences_Json TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Location TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Bio TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Avatar_Url TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Website TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Emergency_Hotline TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Gcash_Name TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Gcash_Number TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Gcash_Qr_Url TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Maya_Name TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Maya_Number TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Maya_Qr_Url TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Bank_Name TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Bank_Account_Name TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Bank_Account_Number TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Bank_Details TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Bank_Qr_Url TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Tin_Number TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Authorized_Rep_Name TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Authorized_Rep_Position TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Authorized_Rep_Id_Type TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Authorized_Rep_Id_No TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Registered_Address TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Primary_Id_Type TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Primary_Id_Number TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Primary_Id_Url TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Secondary_Id_Type TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Secondary_Id_Number TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Secondary_Id_Url TEXT`, () => {});

        sqliteDb.run(`
          CREATE TABLE IF NOT EXISTS DONOR (
            Donor_ID INTEGER PRIMARY KEY AUTOINCREMENT,
            Username TEXT UNIQUE NOT NULL,
            Password TEXT NOT NULL,
            Total_Donated REAL DEFAULT 0,
            Wallet_Address TEXT
          )
        `);

        sqliteDb.run(`ALTER TABLE DONOR ADD COLUMN Name TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE DONOR ADD COLUMN Legal_Name TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE DONOR ADD COLUMN Display_Name TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE DONOR ADD COLUMN Mobile_Number TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE DONOR ADD COLUMN Location TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE DONOR ADD COLUMN Bio TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE DONOR ADD COLUMN Avatar_Url TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE DONOR ADD COLUMN Preferences_Json TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE DONOR ADD COLUMN Name_Last_Changed_At DATETIME`, () => {});
        sqliteDb.run(`ALTER TABLE DONOR ADD COLUMN Created_At DATETIME DEFAULT CURRENT_TIMESTAMP`, (err) => { if (err) sqliteDb.run(`ALTER TABLE DONOR ADD COLUMN Created_At TEXT`, () => {}); });
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Created_At DATETIME DEFAULT CURRENT_TIMESTAMP`, (err) => { if (err) sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Created_At TEXT`, () => {}); });
        sqliteDb.run(`ALTER TABLE ADMINISTRATOR ADD COLUMN Created_At DATETIME DEFAULT CURRENT_TIMESTAMP`, (err) => { if (err) sqliteDb.run(`ALTER TABLE ADMINISTRATOR ADD COLUMN Created_At TEXT`, () => {}); });

        sqliteDb.run(`ALTER TABLE DONOR ADD COLUMN Known_Devices_Json TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Known_Devices_Json TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ADMINISTRATOR ADD COLUMN Known_Devices_Json TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE DONOR ADD COLUMN Security_Tokens_Json TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Security_Tokens_Json TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ADMINISTRATOR ADD COLUMN Security_Tokens_Json TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE DONOR ADD COLUMN Active_Sessions_Json TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Active_Sessions_Json TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ADMINISTRATOR ADD COLUMN Active_Sessions_Json TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE DONOR ADD COLUMN Two_Factor_Enabled INTEGER DEFAULT 0`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Two_Factor_Enabled INTEGER DEFAULT 0`, () => {});
        sqliteDb.run(`ALTER TABLE ADMINISTRATOR ADD COLUMN Two_Factor_Enabled INTEGER DEFAULT 0`, () => {});
        sqliteDb.run(`ALTER TABLE DONOR ADD COLUMN Two_Factor_Secret TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Two_Factor_Secret TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ADMINISTRATOR ADD COLUMN Two_Factor_Secret TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE DONOR ADD COLUMN Two_Factor_Recovery_Codes_Json TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Two_Factor_Recovery_Codes_Json TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ADMINISTRATOR ADD COLUMN Two_Factor_Recovery_Codes_Json TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE DONOR ADD COLUMN Failed_Login_Attempts INTEGER DEFAULT 0`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Failed_Login_Attempts INTEGER DEFAULT 0`, () => {});
        sqliteDb.run(`ALTER TABLE ADMINISTRATOR ADD COLUMN Failed_Login_Attempts INTEGER DEFAULT 0`, () => {});
        sqliteDb.run(`ALTER TABLE DONOR ADD COLUMN Lockout_Until DATETIME`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Lockout_Until DATETIME`, () => {});
        sqliteDb.run(`ALTER TABLE ADMINISTRATOR ADD COLUMN Lockout_Until DATETIME`, () => {});

        sqliteDb.run(`ALTER TABLE DONOR ADD COLUMN Deletion_Scheduled_At DATETIME`, () => {});
        sqliteDb.run(`ALTER TABLE DONOR ADD COLUMN Deletion_Effective_At DATETIME`, () => {});
        sqliteDb.run(`ALTER TABLE DONOR ADD COLUMN Is_Deleted INTEGER DEFAULT 0`, () => {});
        sqliteDb.run(`ALTER TABLE DONOR ADD COLUMN Deletion_Reason TEXT`, () => {});

        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Deletion_Scheduled_At DATETIME`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Deletion_Effective_At DATETIME`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Is_Deleted INTEGER DEFAULT 0`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Deletion_Reason TEXT`, () => {});

        sqliteDb.run(`ALTER TABLE ADMINISTRATOR ADD COLUMN Deletion_Scheduled_At DATETIME`, () => {});
        sqliteDb.run(`ALTER TABLE ADMINISTRATOR ADD COLUMN Deletion_Effective_At DATETIME`, () => {});
        sqliteDb.run(`ALTER TABLE ADMINISTRATOR ADD COLUMN Is_Deleted INTEGER DEFAULT 0`, () => {});
        sqliteDb.run(`ALTER TABLE ADMINISTRATOR ADD COLUMN Deletion_Reason TEXT`, () => {});

        sqliteDb.run(`
          CREATE TABLE IF NOT EXISTS EMAIL_CHANGE_TOKENS (
            Token TEXT PRIMARY KEY,
            Cancel_Token TEXT,
            Current_Email TEXT NOT NULL,
            New_Email TEXT NOT NULL,
            Role TEXT NOT NULL,
            User_ID INTEGER NOT NULL,
            Status TEXT DEFAULT 'PENDING',
            Expires_At DATETIME NOT NULL,
            Revert_Expires_At DATETIME,
            Applied_At DATETIME,
            Reverted_At DATETIME,
            Created_At DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, () => {});
        sqliteDb.run(`ALTER TABLE EMAIL_CHANGE_TOKENS ADD COLUMN Cancel_Token TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE EMAIL_CHANGE_TOKENS ADD COLUMN Status TEXT DEFAULT 'PENDING'`, () => {});
        sqliteDb.run(`ALTER TABLE EMAIL_CHANGE_TOKENS ADD COLUMN Revert_Expires_At DATETIME`, () => {});
        sqliteDb.run(`ALTER TABLE EMAIL_CHANGE_TOKENS ADD COLUMN Applied_At DATETIME`, () => {});
        sqliteDb.run(`ALTER TABLE EMAIL_CHANGE_TOKENS ADD COLUMN Reverted_At DATETIME`, () => {});

        sqliteDb.run(`
          CREATE TABLE IF NOT EXISTS PASSWORD_RESET_TOKENS (
            Token TEXT PRIMARY KEY,
            Email TEXT NOT NULL,
            Role TEXT NOT NULL,
            User_ID INTEGER NOT NULL,
            Expires_At DATETIME NOT NULL,
            Created_At DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, () => {});

        // Backfill existing donors where Legal_Name is NULL
        sqliteDb.all(`SELECT Donor_ID, Username, Name FROM DONOR WHERE Legal_Name IS NULL`, [], (err, rows) => {
          if (!err && rows && rows.length > 0) {
            rows.forEach((row) => {
              const handle = row.Username ? row.Username.split('@')[0] : 'Donor';
              let formatted = handle.toLowerCase() === 'gestermacaldo'
                ? 'Gester Macaldo'
                : handle.replace(/[\._\d]/g, ' ').trim().split(' ').filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || handle;
              const val = row.Name && !row.Name.includes('@') ? row.Name : formatted;
              sqliteDb.run(`UPDATE DONOR SET Legal_Name = ?, Display_Name = COALESCE(Display_Name, ?), Name = COALESCE(Name, ?) WHERE Donor_ID = ?`, [val, val, val, row.Donor_ID]);
            });
          }
        });

        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Location TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Bio TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Avatar_Url TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Website TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Emergency_Hotline TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Gcash_Number TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Maya_Number TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Bank_Details TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ORGANIZATION ADD COLUMN Qr_Codes_Json TEXT`, () => {});

        sqliteDb.run(`
          CREATE TABLE IF NOT EXISTS ORGANIZATION_QR_CODE (
            Qr_ID INTEGER PRIMARY KEY AUTOINCREMENT,
            Org_ID INTEGER,
            Custom_Name TEXT NOT NULL,
            Payment_Method TEXT NOT NULL,
            Account_Name TEXT,
            Account_Number TEXT,
            Qr_Image_Url TEXT NOT NULL,
            Is_Default INTEGER DEFAULT 0,
            Created_At DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (Org_ID) REFERENCES ORGANIZATION(Org_ID) ON DELETE CASCADE
          )
        `);

        sqliteDb.run(`ALTER TABLE ADMINISTRATOR ADD COLUMN Name TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ADMINISTRATOR ADD COLUMN Title TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ADMINISTRATOR ADD COLUMN Agency TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ADMINISTRATOR ADD COLUMN Mobile_Number TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE ADMINISTRATOR ADD COLUMN Avatar_Url TEXT`, () => {});

        sqliteDb.run(`
          CREATE TABLE IF NOT EXISTS CAMPAIGN (
            Campaign_ID INTEGER PRIMARY KEY AUTOINCREMENT,
            Org_ID INTEGER,
            Campaign_Title TEXT NOT NULL,
            Target_Amount REAL NOT NULL,
            Smart_Contract_Address TEXT,
            Description TEXT,
            Location_Region TEXT,
            Gps_Coordinates TEXT,
            Beneficiaries_Impact TEXT,
            Allocations_Json TEXT,
            Contact_Info TEXT,
            Category TEXT,
            Urgency TEXT,
            Target_Date TEXT,
            Document_Url TEXT,
            Gcash_Name TEXT,
            Gcash_Number TEXT,
            Gcash_Qr_Url TEXT,
            Maya_Name TEXT,
            Maya_Number TEXT,
            Maya_Qr_Url TEXT,
            Bank_Name TEXT,
            Bank_Account_Name TEXT,
            Bank_Account_Number TEXT,
            Bank_Qr_Url TEXT,
            Tags TEXT,
            FOREIGN KEY (Org_ID) REFERENCES ORGANIZATION(Org_ID) ON DELETE CASCADE
          )
        `);

        // Migration columns for existing SQLite database
        sqliteDb.run(`ALTER TABLE CAMPAIGN ADD COLUMN Tags TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE CAMPAIGN ADD COLUMN Description TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE CAMPAIGN ADD COLUMN Location_Region TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE CAMPAIGN ADD COLUMN Gps_Coordinates TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE CAMPAIGN ADD COLUMN Beneficiaries_Impact TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE CAMPAIGN ADD COLUMN Allocations_Json TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE CAMPAIGN ADD COLUMN Contact_Info TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE CAMPAIGN ADD COLUMN Category TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE CAMPAIGN ADD COLUMN Urgency TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE CAMPAIGN ADD COLUMN Target_Date TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE CAMPAIGN ADD COLUMN Document_Url TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE CAMPAIGN ADD COLUMN Gcash_Name TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE CAMPAIGN ADD COLUMN Gcash_Number TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE CAMPAIGN ADD COLUMN Gcash_Qr_Url TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE CAMPAIGN ADD COLUMN Maya_Name TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE CAMPAIGN ADD COLUMN Maya_Number TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE CAMPAIGN ADD COLUMN Maya_Qr_Url TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE CAMPAIGN ADD COLUMN Bank_Name TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE CAMPAIGN ADD COLUMN Bank_Account_Name TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE CAMPAIGN ADD COLUMN Bank_Account_Number TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE CAMPAIGN ADD COLUMN Is_Active INTEGER DEFAULT 1`, () => {});
        sqliteDb.run(`ALTER TABLE CAMPAIGN ADD COLUMN Created_At DATETIME`, () => {});
        sqliteDb.run(`ALTER TABLE CAMPAIGN ADD COLUMN Ai_Suggested_Allocations TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE CAMPAIGN ADD COLUMN Ai_Generated_Summary TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE CAMPAIGN ADD COLUMN Disaster_Images_Json TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE CAMPAIGN ADD COLUMN Disbursed_Amount REAL DEFAULT 0`, () => {});
        sqliteDb.run(`ALTER TABLE CAMPAIGN ADD COLUMN Disbursed_Amount_Php REAL DEFAULT 0`, () => {});
        sqliteDb.run(`ALTER TABLE CAMPAIGN ADD COLUMN Disbursement_Status TEXT DEFAULT 'FUNDRAISING'`, () => {});
        sqliteDb.run(`ALTER TABLE CAMPAIGN ADD COLUMN Last_Disbursement_At DATETIME`, () => {});

        sqliteDb.run(`
          CREATE TABLE IF NOT EXISTS CAMPAIGN_DISBURSEMENT (
            Disbursement_ID INTEGER PRIMARY KEY AUTOINCREMENT,
            Campaign_ID INTEGER NOT NULL,
            Org_ID INTEGER NOT NULL,
            Amount_Php REAL NOT NULL,
            Amount_Eth REAL DEFAULT 0,
            Beneficiaries_Reached INTEGER DEFAULT 0,
            Impact_Summary TEXT NOT NULL,
            Proof_Url TEXT,
            Tx_Hash TEXT,
            Disbursed_At DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        sqliteDb.run(`ALTER TABLE CAMPAIGN ADD COLUMN Target_Amount_Php REAL DEFAULT 0`, () => {});
        sqliteDb.run(`UPDATE CAMPAIGN SET Target_Amount_Php = ROUND(Target_Amount * 170000, 2) WHERE (Target_Amount_Php IS NULL OR Target_Amount_Php = 0) AND Target_Amount > 0`, () => {});

        sqliteDb.run(`
          CREATE TABLE IF NOT EXISTS DONATION_TRANSACTION (
            Transaction_ID INTEGER PRIMARY KEY AUTOINCREMENT,
            Donor_ID INTEGER,
            Org_ID INTEGER,
            Campaign_ID INTEGER,
            Tx_Hash TEXT UNIQUE NOT NULL,
            Amount REAL NOT NULL,
            Is_Anonymous INTEGER DEFAULT 0,
            Wallet_Address TEXT,
            Created_At DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (Donor_ID) REFERENCES DONOR(Donor_ID) ON DELETE SET NULL,
            FOREIGN KEY (Org_ID) REFERENCES ORGANIZATION(Org_ID) ON DELETE SET NULL,
            FOREIGN KEY (Campaign_ID) REFERENCES CAMPAIGN(Campaign_ID) ON DELETE CASCADE
          )
        `);

        sqliteDb.run(`ALTER TABLE DONATION_TRANSACTION ADD COLUMN Wallet_Address TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE DONATION_TRANSACTION ADD COLUMN Payment_Method TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE DONATION_TRANSACTION ADD COLUMN Created_At DATETIME DEFAULT CURRENT_TIMESTAMP`, () => {});

        sqliteDb.run(`
          CREATE TABLE IF NOT EXISTS MANUAL_DONATION (
            Manual_ID INTEGER PRIMARY KEY AUTOINCREMENT,
            Donor_ID INTEGER,
            Campaign_ID INTEGER,
            Amount REAL NOT NULL,
            Payment_Method TEXT,
            Receipt_Base64 TEXT,
            Status TEXT DEFAULT 'Pending',
            Created_At DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (Donor_ID) REFERENCES DONOR(Donor_ID) ON DELETE SET NULL,
            FOREIGN KEY (Campaign_ID) REFERENCES CAMPAIGN(Campaign_ID) ON DELETE CASCADE
          )
        `);

        sqliteDb.run(`ALTER TABLE MANUAL_DONATION ADD COLUMN Is_Anonymous INTEGER DEFAULT 0`, () => {});
        sqliteDb.run(`ALTER TABLE MANUAL_DONATION ADD COLUMN Reference_Number TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE MANUAL_DONATION ADD COLUMN Confirmed_Amount REAL`, () => {});
        sqliteDb.run(`ALTER TABLE MANUAL_DONATION ADD COLUMN Rejection_Reason TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE MANUAL_DONATION ADD COLUMN Verified_At DATETIME`, () => {});
        sqliteDb.run(`ALTER TABLE MANUAL_DONATION ADD COLUMN Ai_Extracted_Amount REAL`, () => {});
        sqliteDb.run(`ALTER TABLE MANUAL_DONATION ADD COLUMN Ai_Extracted_Ref_No TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE MANUAL_DONATION ADD COLUMN Ai_Extracted_Date TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE MANUAL_DONATION ADD COLUMN Ai_Confidence_Score REAL`, () => {});
        sqliteDb.run(`ALTER TABLE MANUAL_DONATION ADD COLUMN Ai_Validation_Status TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE MANUAL_DONATION ADD COLUMN Ai_Audit_Notes TEXT`, () => {});

        sqliteDb.run(`
          CREATE TABLE IF NOT EXISTS NOTIFICATIONS (
            Notification_ID INTEGER PRIMARY KEY AUTOINCREMENT,
            Type TEXT DEFAULT 'SYSTEM',
            Title TEXT NOT NULL,
            Message TEXT NOT NULL,
            Reference_ID TEXT,
            Reference_Type TEXT,
            Link TEXT,
            Created_At DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        sqliteDb.run(`ALTER TABLE NOTIFICATIONS ADD COLUMN Reference_ID TEXT`, () => {});
        sqliteDb.run(`ALTER TABLE NOTIFICATIONS ADD COLUMN Reference_Type TEXT`, () => {});

        sqliteDb.run(`
          CREATE TABLE IF NOT EXISTS USER_NOTIFICATIONS (
            User_Notif_ID INTEGER PRIMARY KEY AUTOINCREMENT,
            User_Email TEXT NOT NULL,
            Role TEXT NOT NULL,
            Notification_ID INTEGER NOT NULL,
            Is_Read INTEGER DEFAULT 0,
            Read_At DATETIME NULL,
            Is_Deleted INTEGER DEFAULT 0,
            Deleted_At DATETIME NULL,
            Created_At DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (Notification_ID) REFERENCES NOTIFICATIONS(Notification_ID) ON DELETE CASCADE
          )
        `, async (initErr) => {
          if (initErr) return reject(initErr);
          sqliteDb.run(`ALTER TABLE USER_NOTIFICATIONS ADD COLUMN Is_Deleted INTEGER DEFAULT 0`, () => {});
          sqliteDb.run(`ALTER TABLE USER_NOTIFICATIONS ADD COLUMN Deleted_At DATETIME NULL`, () => {});

          sqliteDb.run(`
            CREATE TABLE IF NOT EXISTS ACTIVITY_LOGS (
              Log_ID INTEGER PRIMARY KEY AUTOINCREMENT,
              Activity TEXT NOT NULL,
              User_Name TEXT,
              User_Email TEXT,
              Role TEXT DEFAULT 'SYSTEM',
              Target TEXT,
              Category TEXT DEFAULT 'SYSTEM',
              Status TEXT DEFAULT 'SUCCESS',
              IP_Address TEXT,
              Details_Json TEXT,
              Created_At DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `);

          sqliteDb.run(`
            CREATE TABLE IF NOT EXISTS SYSTEM_ANNOUNCEMENT (
              Announcement_ID INTEGER PRIMARY KEY AUTOINCREMENT,
              Title TEXT NOT NULL,
              Message TEXT NOT NULL,
              Severity TEXT DEFAULT 'GENERAL',
              Target_Audience TEXT DEFAULT 'ALL',
              Is_Active INTEGER DEFAULT 1,
              Created_By TEXT DEFAULT 'Admin',
              Created_At DATETIME DEFAULT CURRENT_TIMESTAMP,
              Expires_At DATETIME NULL
            )
          `);

          sqliteDb.run(`
            CREATE TABLE IF NOT EXISTS SYSTEM_SETTINGS (
              Setting_Key TEXT PRIMARY KEY,
              Setting_Value TEXT,
              Updated_At DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `);

          sqliteDb.run(`
            CREATE TABLE IF NOT EXISTS LIVE_PRESENCE (
              Session_ID TEXT PRIMARY KEY,
              Visitor_Code TEXT NOT NULL,
              Is_Authenticated INTEGER DEFAULT 0,
              User_ID INTEGER NULL,
              User_Name TEXT NULL,
              User_Email TEXT NULL,
              User_Role TEXT DEFAULT 'guest',
              Org_Name TEXT NULL,
              Verification_Status TEXT NULL,
              Wallet_Address TEXT NULL,
              Is_New_Account INTEGER DEFAULT 0,
              Account_Created_At TEXT NULL,
              Was_Guest_Converted INTEGER DEFAULT 0,
              Current_View TEXT DEFAULT 'Public Landing Page',
              Current_Subpage TEXT DEFAULT 'Overview',
              Current_Path TEXT DEFAULT '/',
              Device_Type TEXT DEFAULT 'Desktop',
              OS TEXT DEFAULT 'Unknown',
              Browser TEXT DEFAULT 'Web Browser',
              IP_Address TEXT NULL,
              Status TEXT DEFAULT 'ONLINE',
              First_Seen_Ms INTEGER NOT NULL,
              Last_Seen_Ms INTEGER NOT NULL,
              Disconnected_Ms INTEGER NULL,
              Journey_Json TEXT NULL
            )
          `);

          console.log('✅ ERD Tables Synchronized with SQLite.');
          await seedDefaultAccounts('sqlite');
          resolve();
        });
      });
    });
  });
}

// ── Dual Database Initialization ─────────────────────────────
async function initializeDatabase() {
  try {
    // Auto-create the database on both local and cloud (TiDB/MySQL)
    try {
      const dbName = process.env.DB_NAME || 'blockchain_relief';
      const rootConn = await mysql.createConnection({
        host: dbConfig.host,
        user: dbConfig.user,
        password: dbConfig.password,
        port: dbConfig.port,
        ...(isCloud ? { ssl: { rejectUnauthorized: false } } : {})
      });
      await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
      await rootConn.end();
      console.log(`✅ Database "${dbName}" ensured.`);
    } catch (err) {
      // Silently skip — DB may already exist or user lacks CREATE privilege
      console.warn('⚠️ Could not auto-create database:', err.message);
    }

    mysqlPool = mysql.createPool(dbConfig);
    // Helper to identify benign idle socket resets from TiDB Cloud serverless proxy
    const isBenignDisconnect = (err) => {
      if (!err) return false;
      const msg = String(err.message || '').toLowerCase();
      const code = String(err.code || '').toLowerCase();
      return (
        code === 'econnreset' ||
        code === 'protocol_connection_lost' ||
        code === 'econnrefused' ||
        code === 'etimedout' ||
        msg.includes('econnreset') ||
        msg.includes('connection lost') ||
        msg.includes('closed')
      );
    };

    // Attach error listeners to prevent uncaughtException crash on idle TCP drop (ECONNRESET)
    if (mysqlPool.pool) {
      mysqlPool.pool.on('error', (err) => {
        if (isBenignDisconnect(err)) return;
        console.warn('⚠️ Handled MySQL pool idle error:', err.message);
      });
      mysqlPool.pool.on('connection', (conn) => {
        conn.on('error', (err) => {
          if (isBenignDisconnect(err)) return;
          console.warn('⚠️ Handled MySQL connection socket error:', err.message);
        });
      });
    }
    // Test connection with a quick ping
    await mysqlPool.query('SELECT 1');
    console.log('✅ Connected to MySQL Database.');

    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS ADMINISTRATOR (
        Admin_ID INT AUTO_INCREMENT PRIMARY KEY,
        Username VARCHAR(255) UNIQUE NOT NULL,
        Password VARCHAR(255) NOT NULL,
        Wallet_Address VARCHAR(255)
      )
    `);

    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS ORGANIZATION (
        Org_ID INT AUTO_INCREMENT PRIMARY KEY,
        Username VARCHAR(255) UNIQUE NOT NULL,
        Password VARCHAR(255) NOT NULL,
        Org_Name VARCHAR(255),
        Verification_Status VARCHAR(50) DEFAULT 'Pending',
        Wallet_Address VARCHAR(255),
        Mobile_Number VARCHAR(50),
        Sec_Registration_No VARCHAR(100),
        Sec_Certificate_Url LONGTEXT,
        Board_Members_Json LONGTEXT,
        Dswd_Accreditation_No VARCHAR(100),
        Verified_At DATETIME,
        Verified_By VARCHAR(255),
        Audit_Notes LONGTEXT
      )
    `);
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Mobile_Number VARCHAR(50)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Sec_Registration_No VARCHAR(100)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Sec_Certificate_Url LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Board_Members_Json LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION MODIFY COLUMN Board_Members_Json LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Dswd_Accreditation_No VARCHAR(100)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Verified_At DATETIME`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Verified_By VARCHAR(255)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Location VARCHAR(255)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Bio LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION MODIFY COLUMN Bio LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Avatar_Url LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Website VARCHAR(255)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Emergency_Hotline VARCHAR(100)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Gcash_Name VARCHAR(255)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Gcash_Number VARCHAR(50)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Gcash_Qr_Url LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Maya_Name VARCHAR(255)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Maya_Number VARCHAR(50)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Maya_Qr_Url LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Bank_Name VARCHAR(255)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Bank_Account_Name VARCHAR(255)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Bank_Account_Number VARCHAR(100)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Bank_Details LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION MODIFY COLUMN Bank_Details LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Bank_Qr_Url LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Banner_Url LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Preferences_Json LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION MODIFY COLUMN Preferences_Json LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Audit_Notes LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION MODIFY COLUMN Audit_Notes LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Qr_Codes_Json LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Tin_Number VARCHAR(100)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Authorized_Rep_Name VARCHAR(255)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Authorized_Rep_Position VARCHAR(255)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Authorized_Rep_Id_Type VARCHAR(100)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Authorized_Rep_Id_No VARCHAR(100)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Registered_Address TEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Primary_Id_Type VARCHAR(100)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Primary_Id_Number VARCHAR(100)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Primary_Id_Url LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Secondary_Id_Type VARCHAR(100)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Secondary_Id_Number VARCHAR(100)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Secondary_Id_Url LONGTEXT`); } catch (_) {}

    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS ORGANIZATION_QR_CODE (
        Qr_ID INT AUTO_INCREMENT PRIMARY KEY,
        Org_ID INT,
        Custom_Name VARCHAR(255) NOT NULL,
        Payment_Method VARCHAR(50) NOT NULL,
        Account_Name VARCHAR(255),
        Account_Number VARCHAR(100),
        Qr_Image_Url LONGTEXT NOT NULL,
        Is_Default BOOLEAN DEFAULT 0,
        Created_At DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (Org_ID) REFERENCES ORGANIZATION(Org_ID) ON DELETE CASCADE
      )
    `);

    try { await mysqlPool.query(`ALTER TABLE ADMINISTRATOR ADD COLUMN Name VARCHAR(255)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ADMINISTRATOR ADD COLUMN Title VARCHAR(255)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ADMINISTRATOR ADD COLUMN Agency VARCHAR(255)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ADMINISTRATOR ADD COLUMN Mobile_Number VARCHAR(50)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ADMINISTRATOR ADD COLUMN Avatar_Url LONGTEXT`); } catch (_) {}

    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS DONOR (
        Donor_ID INT AUTO_INCREMENT PRIMARY KEY,
        Username VARCHAR(255) UNIQUE NOT NULL,
        Password VARCHAR(255) NOT NULL,
        Name VARCHAR(255),
        Mobile_Number VARCHAR(50),
        Location VARCHAR(255),
        Bio LONGTEXT,
        Avatar_Url LONGTEXT,
        Preferences_Json LONGTEXT,
        Total_Donated DECIMAL(20, 2) DEFAULT 0,
        Wallet_Address VARCHAR(255)
      )
    `);
    try { await mysqlPool.query(`ALTER TABLE DONOR ADD COLUMN Name VARCHAR(255)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE DONOR ADD COLUMN Legal_Name VARCHAR(255)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE DONOR ADD COLUMN Display_Name VARCHAR(255)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE DONOR ADD COLUMN Mobile_Number VARCHAR(50)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE DONOR ADD COLUMN Location VARCHAR(255)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE DONOR ADD COLUMN Bio LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE DONOR MODIFY COLUMN Bio LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE DONOR ADD COLUMN Avatar_Url LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE DONOR ADD COLUMN Preferences_Json LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE DONOR MODIFY COLUMN Preferences_Json LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE DONOR ADD COLUMN Name_Last_Changed_At DATETIME`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE DONOR ADD COLUMN Is_Anonymous BOOLEAN DEFAULT 0`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE DONOR ADD COLUMN Created_At DATETIME DEFAULT CURRENT_TIMESTAMP`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Created_At DATETIME DEFAULT CURRENT_TIMESTAMP`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ADMINISTRATOR ADD COLUMN Created_At DATETIME DEFAULT CURRENT_TIMESTAMP`); } catch (_) {}

    try { await mysqlPool.query(`ALTER TABLE DONOR ADD COLUMN Known_Devices_Json LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Known_Devices_Json LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ADMINISTRATOR ADD COLUMN Known_Devices_Json LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE DONOR ADD COLUMN Security_Tokens_Json LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Security_Tokens_Json LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ADMINISTRATOR ADD COLUMN Security_Tokens_Json LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE DONOR ADD COLUMN Active_Sessions_Json LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Active_Sessions_Json LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ADMINISTRATOR ADD COLUMN Active_Sessions_Json LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE DONOR ADD COLUMN Two_Factor_Enabled TINYINT DEFAULT 0`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Two_Factor_Enabled TINYINT DEFAULT 0`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ADMINISTRATOR ADD COLUMN Two_Factor_Enabled TINYINT DEFAULT 0`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE DONOR ADD COLUMN Two_Factor_Secret VARCHAR(255)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Two_Factor_Secret VARCHAR(255)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ADMINISTRATOR ADD COLUMN Two_Factor_Secret VARCHAR(255)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE DONOR ADD COLUMN Two_Factor_Recovery_Codes_Json LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Two_Factor_Recovery_Codes_Json LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ADMINISTRATOR ADD COLUMN Two_Factor_Recovery_Codes_Json LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE DONOR ADD COLUMN Failed_Login_Attempts INT DEFAULT 0`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Failed_Login_Attempts INT DEFAULT 0`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ADMINISTRATOR ADD COLUMN Failed_Login_Attempts INT DEFAULT 0`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE DONOR ADD COLUMN Lockout_Until DATETIME NULL`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Lockout_Until DATETIME NULL`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ADMINISTRATOR ADD COLUMN Lockout_Until DATETIME NULL`); } catch (_) {}

    try { await mysqlPool.query(`ALTER TABLE DONOR ADD COLUMN Deletion_Scheduled_At DATETIME NULL`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE DONOR ADD COLUMN Deletion_Effective_At DATETIME NULL`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE DONOR ADD COLUMN Is_Deleted TINYINT(1) DEFAULT 0`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE DONOR ADD COLUMN Deletion_Reason LONGTEXT NULL`); } catch (_) {}

    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Deletion_Scheduled_At DATETIME NULL`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Deletion_Effective_At DATETIME NULL`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Is_Deleted TINYINT(1) DEFAULT 0`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ORGANIZATION ADD COLUMN Deletion_Reason LONGTEXT NULL`); } catch (_) {}

    try { await mysqlPool.query(`ALTER TABLE ADMINISTRATOR ADD COLUMN Deletion_Scheduled_At DATETIME NULL`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ADMINISTRATOR ADD COLUMN Deletion_Effective_At DATETIME NULL`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ADMINISTRATOR ADD COLUMN Is_Deleted TINYINT(1) DEFAULT 0`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE ADMINISTRATOR ADD COLUMN Deletion_Reason LONGTEXT NULL`); } catch (_) {}

    try {
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS EMAIL_CHANGE_TOKENS (
          Token VARCHAR(255) PRIMARY KEY,
          Cancel_Token VARCHAR(255),
          Current_Email VARCHAR(255) NOT NULL,
          New_Email VARCHAR(255) NOT NULL,
          Role VARCHAR(50) NOT NULL,
          User_ID INT NOT NULL,
          Status VARCHAR(50) DEFAULT 'PENDING',
          Expires_At DATETIME NOT NULL,
          Revert_Expires_At DATETIME,
          Applied_At DATETIME,
          Reverted_At DATETIME,
          Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE EMAIL_CHANGE_TOKENS ADD COLUMN Cancel_Token VARCHAR(255) NULL`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE EMAIL_CHANGE_TOKENS ADD COLUMN Status VARCHAR(50) DEFAULT 'PENDING'`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE EMAIL_CHANGE_TOKENS ADD COLUMN Revert_Expires_At DATETIME NULL`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE EMAIL_CHANGE_TOKENS ADD COLUMN Applied_At DATETIME NULL`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE EMAIL_CHANGE_TOKENS ADD COLUMN Reverted_At DATETIME NULL`); } catch (_) {}

    try {
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS PASSWORD_RESET_TOKENS (
          Token VARCHAR(255) PRIMARY KEY,
          Email VARCHAR(255) NOT NULL,
          Role VARCHAR(50) NOT NULL,
          User_ID INT NOT NULL,
          Expires_At DATETIME NOT NULL,
          Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch (_) {}

    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS CAMPAIGN (
        Campaign_ID INT AUTO_INCREMENT PRIMARY KEY,
        Org_ID INT,
        Campaign_Title VARCHAR(255) NOT NULL,
        Target_Amount DECIMAL(36, 18) NOT NULL,
        Target_Amount_Php DECIMAL(20, 2) DEFAULT 0,
        Smart_Contract_Address VARCHAR(255),
        Description TEXT,
        Location_Region VARCHAR(255),
        Gps_Coordinates VARCHAR(255),
        Beneficiaries_Impact VARCHAR(255),
        Allocations_Json TEXT,
        Contact_Info VARCHAR(255),
        Category VARCHAR(100),
        Urgency VARCHAR(100),
        Target_Date VARCHAR(100),
        Document_Url VARCHAR(500),
        Gcash_Name VARCHAR(255),
        Gcash_Number VARCHAR(50),
        Gcash_Qr_Url LONGTEXT,
        Maya_Name VARCHAR(255),
        Maya_Number VARCHAR(50),
        Maya_Qr_Url LONGTEXT,
        Bank_Name VARCHAR(100),
        Bank_Account_Name VARCHAR(150),
        Bank_Account_Number VARCHAR(50),
        Bank_Qr_Url LONGTEXT,
        Tags TEXT,
        FOREIGN KEY (Org_ID) REFERENCES ORGANIZATION(Org_ID) ON DELETE CASCADE
      )
    `);
    try { await mysqlPool.query(`ALTER TABLE CAMPAIGN ADD COLUMN Tags TEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE CAMPAIGN ADD COLUMN Description TEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE CAMPAIGN ADD COLUMN Location_Region VARCHAR(255)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE CAMPAIGN ADD COLUMN Gps_Coordinates VARCHAR(255)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE CAMPAIGN ADD COLUMN Beneficiaries_Impact VARCHAR(255)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE CAMPAIGN ADD COLUMN Allocations_Json TEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE CAMPAIGN MODIFY COLUMN Allocations_Json LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE CAMPAIGN ADD COLUMN Contact_Info VARCHAR(255)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE CAMPAIGN ADD COLUMN Category VARCHAR(100)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE CAMPAIGN ADD COLUMN Urgency VARCHAR(100)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE CAMPAIGN ADD COLUMN Target_Date VARCHAR(100)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE CAMPAIGN ADD COLUMN Document_Url VARCHAR(500)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE CAMPAIGN MODIFY COLUMN Document_Url LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE CAMPAIGN ADD COLUMN Gcash_Name VARCHAR(255)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE CAMPAIGN ADD COLUMN Gcash_Number VARCHAR(50)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE CAMPAIGN ADD COLUMN Gcash_Qr_Url LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE CAMPAIGN ADD COLUMN Maya_Name VARCHAR(255)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE CAMPAIGN ADD COLUMN Maya_Number VARCHAR(50)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE CAMPAIGN ADD COLUMN Maya_Qr_Url LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE CAMPAIGN ADD COLUMN Bank_Name VARCHAR(100)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE CAMPAIGN ADD COLUMN Bank_Account_Name VARCHAR(150)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE CAMPAIGN ADD COLUMN Bank_Account_Number VARCHAR(50)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE CAMPAIGN ADD COLUMN Bank_Qr_Url LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE CAMPAIGN ADD COLUMN Is_Active TINYINT(1) DEFAULT 1`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE CAMPAIGN ADD COLUMN Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE CAMPAIGN ADD COLUMN Ai_Suggested_Allocations LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE CAMPAIGN ADD COLUMN Ai_Generated_Summary LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE CAMPAIGN ADD COLUMN Disaster_Images_Json LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE CAMPAIGN MODIFY COLUMN Disaster_Images_Json LONGTEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE CAMPAIGN MODIFY COLUMN Target_Amount DECIMAL(36, 18)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE CAMPAIGN ADD COLUMN Target_Amount_Php DECIMAL(20, 2) DEFAULT 0`); } catch (_) {}
    try { await mysqlPool.query(`UPDATE CAMPAIGN SET Target_Amount_Php = ROUND(Target_Amount * 170000, 2) WHERE (Target_Amount_Php IS NULL OR Target_Amount_Php = 0) AND Target_Amount > 0`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE CAMPAIGN ADD COLUMN Disbursed_Amount DECIMAL(36, 18) DEFAULT 0`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE CAMPAIGN ADD COLUMN Disbursed_Amount_Php DECIMAL(15, 2) DEFAULT 0`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE CAMPAIGN ADD COLUMN Disbursement_Status VARCHAR(50) DEFAULT 'FUNDRAISING'`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE CAMPAIGN ADD COLUMN Last_Disbursement_At TIMESTAMP NULL`); } catch (_) {}

    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS CAMPAIGN_DISBURSEMENT (
        Disbursement_ID INT AUTO_INCREMENT PRIMARY KEY,
        Campaign_ID INT NOT NULL,
        Org_ID INT NOT NULL,
        Amount_Php DECIMAL(15, 2) NOT NULL,
        Amount_Eth DECIMAL(36, 18) DEFAULT 0,
        Beneficiaries_Reached INT DEFAULT 0,
        Impact_Summary TEXT NOT NULL,
        Proof_Url LONGTEXT,
        Tx_Hash VARCHAR(255),
        Disbursed_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (Campaign_ID) REFERENCES CAMPAIGN(Campaign_ID) ON DELETE CASCADE
      )
    `);

    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS DONATION_TRANSACTION (
        Transaction_ID INT AUTO_INCREMENT PRIMARY KEY,
        Donor_ID INT,
        Org_ID INT,
        Campaign_ID INT,
        Tx_Hash VARCHAR(255) UNIQUE NOT NULL,
        Amount DECIMAL(36, 18) NOT NULL,
        Is_Anonymous BOOLEAN DEFAULT 0,
        FOREIGN KEY (Donor_ID) REFERENCES DONOR(Donor_ID) ON DELETE SET NULL,
        FOREIGN KEY (Org_ID) REFERENCES ORGANIZATION(Org_ID) ON DELETE SET NULL,
        FOREIGN KEY (Campaign_ID) REFERENCES CAMPAIGN(Campaign_ID) ON DELETE CASCADE
      )
    `);
    try { await mysqlPool.query(`ALTER TABLE DONATION_TRANSACTION MODIFY COLUMN Amount DECIMAL(36, 18) NOT NULL`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE DONATION_TRANSACTION ADD COLUMN Wallet_Address VARCHAR(255)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE DONATION_TRANSACTION ADD COLUMN Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE DONATION_TRANSACTION ADD COLUMN Payment_Method VARCHAR(50) DEFAULT 'ETH'`); } catch (_) {}

    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS MANUAL_DONATION (
        Manual_ID INT AUTO_INCREMENT PRIMARY KEY,
        Donor_ID INT,
        Campaign_ID INT,
        Amount DECIMAL(36, 18) NOT NULL,
        Payment_Method VARCHAR(50),
        Receipt_Base64 LONGTEXT,
        Status VARCHAR(20) DEFAULT 'Pending',
        Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (Donor_ID) REFERENCES DONOR(Donor_ID) ON DELETE SET NULL,
        FOREIGN KEY (Campaign_ID) REFERENCES CAMPAIGN(Campaign_ID) ON DELETE CASCADE
      )
    `);
    try { await mysqlPool.query(`ALTER TABLE MANUAL_DONATION MODIFY COLUMN Amount DECIMAL(36, 18) NOT NULL`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE MANUAL_DONATION ADD COLUMN Is_Anonymous BOOLEAN DEFAULT 0`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE MANUAL_DONATION ADD COLUMN Reference_Number VARCHAR(255)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE MANUAL_DONATION ADD COLUMN Confirmed_Amount DECIMAL(36, 18)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE MANUAL_DONATION ADD COLUMN Rejection_Reason TEXT`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE MANUAL_DONATION ADD COLUMN Verified_At TIMESTAMP NULL`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE MANUAL_DONATION ADD COLUMN Ai_Extracted_Amount DECIMAL(36, 18)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE MANUAL_DONATION ADD COLUMN Ai_Extracted_Ref_No VARCHAR(255)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE MANUAL_DONATION ADD COLUMN Ai_Extracted_Date VARCHAR(100)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE MANUAL_DONATION ADD COLUMN Ai_Confidence_Score DECIMAL(5, 2)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE MANUAL_DONATION ADD COLUMN Ai_Validation_Status VARCHAR(100)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE MANUAL_DONATION ADD COLUMN Ai_Audit_Notes LONGTEXT`); } catch (_) {}

    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS NOTIFICATIONS (
        Notification_ID INT AUTO_INCREMENT PRIMARY KEY,
        Type VARCHAR(50) DEFAULT 'SYSTEM',
        Title VARCHAR(255) NOT NULL,
        Message TEXT NOT NULL,
        Reference_ID VARCHAR(255),
        Reference_Type VARCHAR(100),
        Link VARCHAR(255),
        Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    try { await mysqlPool.query(`ALTER TABLE NOTIFICATIONS ADD COLUMN Reference_ID VARCHAR(255)`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE NOTIFICATIONS ADD COLUMN Reference_Type VARCHAR(100)`); } catch (_) {}

    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS USER_NOTIFICATIONS (
        User_Notif_ID INT AUTO_INCREMENT PRIMARY KEY,
        User_Email VARCHAR(255) NOT NULL,
        Role VARCHAR(50) NOT NULL,
        Notification_ID INT NOT NULL,
        Is_Read BOOLEAN DEFAULT 0,
        Read_At TIMESTAMP NULL,
        Is_Deleted BOOLEAN DEFAULT 0,
        Deleted_At TIMESTAMP NULL,
        Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (Notification_ID) REFERENCES NOTIFICATIONS(Notification_ID) ON DELETE CASCADE
      )
    `);

    try { await mysqlPool.query(`ALTER TABLE USER_NOTIFICATIONS ADD COLUMN Is_Deleted BOOLEAN DEFAULT 0`); } catch (_) {}
    try { await mysqlPool.query(`ALTER TABLE USER_NOTIFICATIONS ADD COLUMN Deleted_At TIMESTAMP NULL`); } catch (_) {}

    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS ACTIVITY_LOGS (
        Log_ID INT AUTO_INCREMENT PRIMARY KEY,
        Activity VARCHAR(500) NOT NULL,
        User_Name VARCHAR(255),
        User_Email VARCHAR(255),
        Role VARCHAR(50) DEFAULT 'SYSTEM',
        Target VARCHAR(255),
        Category VARCHAR(50) DEFAULT 'SYSTEM',
        Status VARCHAR(20) DEFAULT 'SUCCESS',
        IP_Address VARCHAR(100),
        Details_Json LONGTEXT,
        Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_act_created (Created_At),
        INDEX idx_act_category (Category),
        INDEX idx_act_role (Role)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS SYSTEM_ANNOUNCEMENT (
        Announcement_ID INT AUTO_INCREMENT PRIMARY KEY,
        Title VARCHAR(255) NOT NULL,
        Message TEXT NOT NULL,
        Severity ENUM('EMERGENCY', 'OPERATIONAL', 'GENERAL') DEFAULT 'GENERAL',
        Target_Audience ENUM('ALL', 'DONOR', 'ORGANIZATION') DEFAULT 'ALL',
        Is_Active BOOLEAN DEFAULT 1,
        Created_By VARCHAR(150) DEFAULT 'Admin',
        Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        Expires_At TIMESTAMP NULL,
        INDEX idx_ann_active (Is_Active),
        INDEX idx_ann_created (Created_At)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS SYSTEM_SETTINGS (
        Setting_Key VARCHAR(100) PRIMARY KEY,
        Setting_Value LONGTEXT,
        Updated_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS LIVE_PRESENCE (
        Session_ID VARCHAR(100) PRIMARY KEY,
        Visitor_Code VARCHAR(40) NOT NULL,
        Is_Authenticated BOOLEAN DEFAULT 0,
        User_ID INT NULL,
        User_Name VARCHAR(255) NULL,
        User_Email VARCHAR(255) NULL,
        User_Role VARCHAR(50) DEFAULT 'guest',
        Org_Name VARCHAR(255) NULL,
        Verification_Status VARCHAR(50) NULL,
        Wallet_Address VARCHAR(120) NULL,
        Is_New_Account BOOLEAN DEFAULT 0,
        Account_Created_At VARCHAR(64) NULL,
        Was_Guest_Converted BOOLEAN DEFAULT 0,
        Current_View VARCHAR(160) DEFAULT 'Public Landing Page',
        Current_Subpage VARCHAR(200) DEFAULT 'Overview',
        Current_Path VARCHAR(255) DEFAULT '/',
        Device_Type VARCHAR(50) DEFAULT 'Desktop',
        OS VARCHAR(80) DEFAULT 'Unknown',
        Browser VARCHAR(80) DEFAULT 'Web Browser',
        IP_Address VARCHAR(120) NULL,
        Status VARCHAR(20) DEFAULT 'ONLINE',
        First_Seen_Ms BIGINT NOT NULL,
        Last_Seen_Ms BIGINT NOT NULL,
        Disconnected_Ms BIGINT NULL,
        Journey_Json LONGTEXT NULL,
        INDEX idx_presence_last_seen (Last_Seen_Ms),
        INDEX idx_presence_role (User_Role),
        INDEX idx_presence_status (Status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    activeDriver = 'mysql';
    console.log('✅ ERD Tables Synchronized with MySQL.');
    await seedDefaultAccounts('mysql');
  } catch (error) {
    console.warn(`⚠️ MySQL unavailable (${error.code || error.message}). Activating SQLite3 fallback...`);
    activeDriver = 'sqlite';
    await initSqlite();
  }
}

// Start initialization immediately
const initPromise = initializeDatabase();

// ── Cloud Database Keep-Alive Heartbeat ─────────────────────────────
// Keeps the remote TiDB Cloud proxy socket active, preventing ECONNRESET drops
setInterval(async () => {
  if (activeDriver === 'mysql' && mysqlPool) {
    try {
      await mysqlPool.query('SELECT 1');
    } catch (_) {}
  }
}, 20000);

// Universal Query Helper compatible with both MySQL and SQLite
module.exports = {
  query: async (sql, params = []) => {
    await initPromise;

    if (activeDriver === 'mysql') {
      try {
        return await mysqlPool.query(sql, params);
      } catch (err) {
        if (err && (err.code === 'ECONNRESET' || err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ETIMEDOUT')) {
          console.warn(`⚠️ MySQL connection interrupted (${err.code}). Auto-retrying query once...`);
          return await mysqlPool.query(sql, params);
        }
        throw err;
      }
    }

    // SQLite mode
    return new Promise((resolve, reject) => {
      const trimmed = sql.trim();
      const isSelect = trimmed.toUpperCase().startsWith('SELECT');

      if (isSelect) {
        sqliteDb.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve([rows, []]);
        });
      } else {
        sqliteDb.run(sql, params, function (err) {
          if (err) return reject(err);
          resolve([{ insertId: this.lastID, affectedRows: this.changes }, []]);
        });
      }
    });
  },
  getActiveDriver: () => activeDriver,
  getDbConfig: () => ({
    host: dbConfig.host,
    user: dbConfig.user,
    database: dbConfig.database,
    port: dbConfig.port,
    isCloud
  })
};
