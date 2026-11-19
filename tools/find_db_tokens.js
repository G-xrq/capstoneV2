const fs = require('fs');
const content = fs.readFileSync('backend/database.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('EMAIL_CHANGE_TOKENS')) {
    console.log(i + 1, line);
  }
});
