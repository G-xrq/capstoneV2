import fs from 'fs';
import { parse } from '@babel/parser';

const code = fs.readFileSync('src/components/CampaignCard.jsx', 'utf8');
try {
  parse(code, {
    sourceType: 'module',
    plugins: ['jsx']
  });
  console.log("No syntax errors!");
} catch (e) {
  console.error(e);
}
