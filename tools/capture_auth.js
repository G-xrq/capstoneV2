const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BRAIN_DIR = 'C:\\Users\\Gester\\.gemini\\antigravity\\brain\\331c98ba-81fa-4258-8ed7-eae682e42bbd';
const PORT = 9341;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function cdpGet(ep) {
  return new Promise((res, rej) => {
    http.get('http://127.0.0.1:' + PORT + ep, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => { try { res(JSON.parse(d)); } catch(e) { res(d); } });
    }).on('error', rej);
  });
}

(async () => {
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + path.join(require('os').tmpdir(), 'chrome_auth_' + Date.now()),
    '--window-size=1440,1050',
    'about:blank'
  ]);

  let versionData = null;
  for (let i = 0; i < 30; i++) {
    try {
      versionData = await cdpGet('/json/version');
      if (versionData && versionData.webSocketDebuggerUrl) break;
    } catch (_) {}
    await sleep(200);
  }

  const targets = await cdpGet('/json/list');
  const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
  let id = 1;
  const map = new Map();
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && map.has(m.id)) { map.get(m.id)(m.result); map.delete(m.id); }
  };
  await new Promise(r => ws.onopen = r);
  const send = (m, p = {}) => new Promise(r => { const i = id++; map.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: 'http://localhost:5173' });
  await sleep(1500);

  // Clear token so it's unauthenticated, then click "Log In"
  await send('Runtime.evaluate', {
    expression: `
      localStorage.removeItem('bbdrts_token');
      location.reload();
    `
  });
  await sleep(2000);

  // Click Log In button in header
  await send('Runtime.evaluate', {
    expression: `
      const btns = Array.from(document.querySelectorAll('button'));
      const loginBtn = btns.find(b => b.textContent && b.textContent.includes('Log In'));
      if (loginBtn) loginBtn.click();
    `
  });
  await sleep(1500);

  let snap = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(BRAIN_DIR, 'verify_current_authview.png'), Buffer.from(snap.data, 'base64'));
  console.log('Saved verify_current_authview.png');

  // Also toggle to Register mode
  await send('Runtime.evaluate', {
    expression: `
      const regBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && (b.textContent.includes('Create an account') || b.textContent.includes('Sign Up')));
      if (regBtn) regBtn.click();
    `
  });
  await sleep(1000);

  snap = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(BRAIN_DIR, 'verify_current_authview_register.png'), Buffer.from(snap.data, 'base64'));
  console.log('Saved verify_current_authview_register.png');

  ws.close();
  try { chromeProc.kill(); } catch (_) {}
  process.exit(0);
})();
