const fs = require('fs');
const content = fs.readFileSync('backend/server.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('/api/auth/request-email-change') || line.includes('/api/auth/verify-email-change') || line.includes('/api/auth/cancel-email-change')) {
    console.log(i + 1, line);
  }
});
