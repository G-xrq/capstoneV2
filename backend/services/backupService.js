const fs = require('fs');
const path = require('path');
const db = require('../database');

const BACKUPS_DIR = path.resolve(__dirname, '..', 'backups');

// Ensure backups directory exists
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') return null;
  // Prevent directory traversal
  const base = path.basename(filename);
  if (!/^[a-zA-Z0-9_\-\.]+\.(sql|json)$/.test(base)) {
    return null;
  }
  return base;
}

/**
 * Generate a complete database backup (.sql or .json)
 */
async function createBackup(format = 'sql') {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `bbdrts_backup_${timestamp}.${format}`;
  const filePath = path.join(BACKUPS_DIR, filename);

  try {
    // 1. Get all tables in the current database
    let tables = [];
    try {
      const [tableRows] = await db.query('SHOW FULL TABLES WHERE Table_Type = "BASE TABLE"');
      if (Array.isArray(tableRows)) {
        tables = tableRows.map(r => Object.values(r)[0]).filter(Boolean);
      }
    } catch (err) {
      console.warn('Could not list tables with SHOW FULL TABLES, falling back:', err.message);
      // Fallback to known BBDRTS tables
      tables = [
        'ADMINISTRATOR',
        'ORGANIZATION',
        'ORGANIZATION_QR_CODE',
        'DONOR',
        'CAMPAIGN',
        'CAMPAIGN_DISBURSEMENT',
        'DONATION_TRANSACTION',
        'MANUAL_DONATION',
        'NOTIFICATIONS',
        'USER_NOTIFICATIONS',
        'ACTIVITY_LOGS',
        'SYSTEM_ANNOUNCEMENT',
        'SYSTEM_SETTINGS'
      ];
    }

    if (format === 'json') {
      const exportData = {
        metadata: {
          system: 'BBDRTS Blockchain Disaster Relief Tracking System',
          version: '2.0.0',
          exportedAt: new Date().toISOString(),
          tablesCount: tables.length
        },
        tables: {}
      };

      for (const table of tables) {
        try {
          const [rows] = await db.query(`SELECT * FROM \`${table}\``);
          exportData.tables[table] = rows || [];
        } catch (tableErr) {
          console.warn(`Could not export rows from ${table}:`, tableErr.message);
          exportData.tables[table] = [];
        }
      }

      fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf-8');
    } else {
      // Standard SQL Dump
      let sqlDump = `-- ================================================================\n`;
      sqlDump += `-- BBDRTS (Blockchain-Based Disaster Relief Tracking System)\n`;
      sqlDump += `-- Automated Database Snapshot & Disaster Recovery Archive\n`;
      sqlDump += `-- Export Date: ${new Date().toISOString()} (PHT: ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })})\n`;
      sqlDump += `-- Target Tables: ${tables.join(', ')}\n`;
      sqlDump += `-- ================================================================\n\n`;
      sqlDump += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;

      for (const table of tables) {
        try {
          // Schema definition
          let createTableSql = '';
          try {
            const [createRows] = await db.query(`SHOW CREATE TABLE \`${table}\``);
            if (createRows && createRows[0]) {
              createTableSql = createRows[0]['Create Table'] || createRows[0]['create table'];
            }
          } catch (_) {}

          sqlDump += `--\n-- Table structure for \`${table}\`\n--\n`;
          sqlDump += `DROP TABLE IF EXISTS \`${table}\`;\n`;
          if (createTableSql) {
            sqlDump += `${createTableSql};\n\n`;
          }

          // Data Rows
          const [rows] = await db.query(`SELECT * FROM \`${table}\``);
          if (Array.isArray(rows) && rows.length > 0) {
            sqlDump += `--\n-- Dumping data for table \`${table}\` (${rows.length} records)\n--\n`;
            
            // Insert in chunks of 50
            const chunkSize = 50;
            for (let i = 0; i < rows.length; i += chunkSize) {
              const chunk = rows.slice(i, i + chunkSize);
              const cols = Object.keys(chunk[0]).map(c => `\`${c}\``).join(', ');
              
              const valLines = chunk.map(row => {
                const values = Object.values(row).map(val => {
                  if (val === null || val === undefined) return 'NULL';
                  if (typeof val === 'number') return val;
                  if (typeof val === 'boolean') return val ? 1 : 0;
                  if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
                  // Escape string
                  const str = String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
                  return `'${str}'`;
                });
                return `(${values.join(', ')})`;
              });

              sqlDump += `INSERT INTO \`${table}\` (${cols}) VALUES\n  ${valLines.join(',\n  ')};\n`;
            }
            sqlDump += `\n`;
          }
        } catch (tableErr) {
          console.warn(`Error dumping table ${table}:`, tableErr.message);
          sqlDump += `-- Error reading table \`${table}\`: ${tableErr.message}\n\n`;
        }
      }

      sqlDump += `SET FOREIGN_KEY_CHECKS = 1;\n`;
      sqlDump += `-- Dump complete: ${new Date().toISOString()}\n`;

      fs.writeFileSync(filePath, sqlDump, 'utf-8');
    }

    const stat = fs.statSync(filePath);
    return {
      filename,
      filePath,
      sizeBytes: stat.size,
      sizeFormatted: formatBytes(stat.size),
      createdAt: stat.birthtime || stat.mtime,
      format,
      status: 'Complete'
    };
  } catch (err) {
    // Clean up partial file if failed
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (_) {}
    }
    throw err;
  }
}

/**
 * List all generated backup snapshots
 */
function listBackups() {
  if (!fs.existsSync(BACKUPS_DIR)) return [];

  const files = fs.readdirSync(BACKUPS_DIR);
  const backups = [];

  for (const file of files) {
    if (!file.startsWith('bbdrts_backup_')) continue;
    const fullPath = path.join(BACKUPS_DIR, file);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isFile()) {
        const ext = path.extname(file).replace('.', '').toLowerCase();
        backups.push({
          filename: file,
          sizeBytes: stat.size,
          sizeFormatted: formatBytes(stat.size),
          createdAt: stat.birthtime || stat.mtime,
          format: ext,
          status: 'Complete'
        });
      }
    } catch (_) {}
  }

  // Sort newest first
  return backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Delete a specific backup file
 */
function deleteBackup(rawFilename) {
  const safeName = sanitizeFilename(rawFilename);
  if (!safeName) throw new Error('Invalid backup filename.');

  const targetPath = path.join(BACKUPS_DIR, safeName);
  if (!fs.existsSync(targetPath)) {
    throw new Error('Backup file not found.');
  }

  fs.unlinkSync(targetPath);
  return { success: true, filename: safeName };
}

/**
 * Get the path for downloading
 */
function getBackupDownloadPath(rawFilename) {
  const safeName = sanitizeFilename(rawFilename);
  if (!safeName) return null;

  const targetPath = path.join(BACKUPS_DIR, safeName);
  if (!fs.existsSync(targetPath)) return null;

  return targetPath;
}

module.exports = {
  createBackup,
  listBackups,
  deleteBackup,
  getBackupDownloadPath
};
