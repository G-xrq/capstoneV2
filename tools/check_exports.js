const fs = require('fs');
const content = fs.readFileSync('backend/database.js', 'utf8');
const lines = content.split('\n');
for (let i = lines.length - 30; i < lines.length; i++) {
  console.log(i + 1, lines[i]);
}
