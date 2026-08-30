import fs from 'fs';

const code = fs.readFileSync('src/components/CampaignCard.jsx', 'utf8');
const lines = code.split('\n');

let depth = 0;
for (let i = 854; i < 940; i++) {
  const line = lines[i] || '';
  const opens = (line.match(/<div/g) || []).length;
  const closes = (line.match(/<\/div>/g) || []).length;
  depth += opens - closes;
  console.log(`Line ${i + 1}: ${line.trim()} | Depth: ${depth}`);
}
