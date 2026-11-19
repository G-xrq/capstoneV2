const fs = require('fs');
const content = fs.readFileSync('frontend/src/views/AuthView.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('cancel-email-change') || line.includes('verify-email-change') || line.includes('emailChangeNotice')) {
    console.log(i + 1, line);
  }
});
