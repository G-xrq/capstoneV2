import * as XLSX from 'xlsx';

/* ═══════════════════════════════════════════════════════════════════════════
   BBDRTS — Unified, Organized Export Engine (Donor · NGO · Admin)
   Supports Multi-Sheet Excel (.xlsx), UTF-8 BOM CSV (.csv), Structured JSON,
   and Print-Ready A4 PDF Reports & Official Vouchers (zero blank pages).
   ═══════════════════════════════════════════════════════════════════════════ */

function formatPhtNow(isoStr) {
  try {
    const d = isoStr ? new Date(isoStr) : new Date();
    if (isNaN(d.getTime())) return String(isoStr || '—');
    return (
      new Intl.DateTimeFormat('en-PH', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).format(d) + ' PHT'
    );
  } catch (_) {
    return new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC';
  }
}

function fmtPhp(val) {
  return `₱${Math.round(Number(val || 0)).toLocaleString('en-US')}`;
}

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeCsvCell(val) {
  const str = String(val ?? '').replace(/\r?\n/g, ' ').replace(/"/g, '""');
  return `"${str}"`;
}

function downloadBlobFile(content, mimeType, filename) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return filename;
}

function writeCsvRows(rows, filename) {
  const csvBody = rows.map((r) => r.map(escapeCsvCell).join(',')).join('\r\n');
  return downloadBlobFile('\uFEFF' + csvBody, 'text/csv;charset=utf-8;', filename);
}

function slugSegment(raw, maxLen = 34) {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen)
    .replace(/-+$/g, '');
}

/** Build an accurate, descriptive filename stem reflecting role, entity, active filters, and date. */
export function buildExportFileStem(baseParts = [], filterSummary = '') {
  const dateStamp = new Date().toISOString().slice(0, 10);
  const parts = ['BBDRTS', ...baseParts.map((p) => slugSegment(p, 32)).filter(Boolean)];

  const rawTokens = String(filterSummary || '')
    .split('·')
    .map((t) => t.trim())
    .filter(Boolean);

  for (const tok of rawTokens) {
    if (/^(all time|all records|all activity logs|all)$/i.test(tok)) continue;
    const cleaned = tok
      .replace(/^(channel|campaign|category|role|status|search):\s*/i, '')
      .replace(/["']/g, '');
    const slug = slugSegment(cleaned, 30);
    if (slug && !parts.includes(slug)) parts.push(slug);
  }

  parts.push(dateStamp);
  return parts.join('_').slice(0, 128).replace(/[_-]+$/g, '');
}

export function buildExportFilename(baseParts = [], filterSummary = '', ext = 'xlsx') {
  return `${buildExportFileStem(baseParts, filterSummary)}.${ext}`;
}

export function resolveDonationPhp(d) {
  if (!d) return 0;
  const isShortage = d.auditStatus === 'SHORTAGE' || Number(d.variancePhp || 0) < -20;
  const direct = Number(d.phpAmount ?? d.amountPhp ?? d.Amount_Php ?? d.Confirmed_Amount ?? 0);
  if (Number.isFinite(direct) && direct > 0) return Math.round(direct);
  const declared = Number(d.declaredPhp || 0);
  const credited = Number(d.creditedPhp || 0);
  if (!isShortage && declared > 0 && credited > 0 && Math.abs(declared - credited) <= 20) {
    return Math.round(declared);
  }
  if (credited > 0) return Math.round(credited);
  if (declared > 0) return Math.round(declared);
  const rawAmt = parseFloat(d.amount ?? d.Amount ?? d.amountEth ?? 0);
  if (!Number.isFinite(rawAmt) || rawAmt <= 0) return 0;
  return rawAmt >= 20 ? Math.round(rawAmt) : Math.round(rawAmt * 170000);
}

export function normalizePaymentRail(raw) {
  const s = String(raw || '').toUpperCase();
  if (s.includes('GCASH')) return 'GCash';
  if (s.includes('MAYA') || s.includes('PAYMAYA')) return 'Maya';
  if (s.includes('BANK') || s.includes('BDO') || s.includes('BPI') || s.includes('UNION') || s.includes('TRANSFER')) return 'Bank Transfer';
  if (s.includes('CARD') || s.includes('STRIPE') || s.includes('VISA') || s.includes('MASTER')) return 'Card / Bank';
  if (s.includes('ETH') || s.includes('SEPOLIA') || s.includes('CRYPTO')) return 'On-Chain (Sepolia)';
  return raw ? String(raw) : 'Bank / Card';
}

function formatReadableDetails(details) {
  if (!details) return '—';
  if (typeof details === 'string') {
    try {
      const parsed = JSON.parse(details);
      if (parsed && typeof parsed === 'object') details = parsed;
      else return details;
    } catch (_) {
      return details;
    }
  }
  if (typeof details === 'object') {
    const parts = Object.entries(details)
      .filter(([, v]) => v !== null && v !== undefined && v !== '' && typeof v !== 'object')
      .slice(0, 8)
      .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`);
    return parts.length > 0 ? parts.join(' | ') : '—';
  }
  return String(details);
}

function autoSizeSheet(ws, rows, extraWidth = 4) {
  if (!Array.isArray(rows) || rows.length === 0) return;
  const maxCols = rows.reduce((m, r) => Math.max(m, Array.isArray(r) ? r.length : 0), 0);
  const cols = [];
  for (let c = 0; c < maxCols; c++) {
    let maxLen = 10;
    for (let r = 2; r < rows.length; r++) {
      const cellVal = rows[r]?.[c];
      if (cellVal === null || cellVal === undefined) continue;
      const str = String(cellVal);
      if (str.length > maxLen) maxLen = str.length;
    }
    cols.push({ wch: Math.min(Math.max(maxLen + extraWidth, 13), 48) });
  }
  ws['!cols'] = cols;
}

function applyPhpAndPctFormats(ws, phpCols = [], pctCols = [], startRow = 1) {
  if (!ws['!ref']) return;
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let R = startRow; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (!cell || cell.t !== 'n') continue;
      if (phpCols.includes(C)) cell.z = '"₱"#,##0';
      else if (pctCols.includes(C)) cell.z = '0.0"%"';
    }
  }
}

/**
 * Shared Print / Save-as-PDF renderer.
 * Opens a crisp, light-themed A4 document with print-color-adjust preserved,
 * an interactive top print bar (hidden during printing), and automatic iframe
 * fallback when popup blockers prevent a new tab.
 */
function openPrintableHtml(title, bodyHtml, documentTitle = '') {
  const pdfTitle = documentTitle || title;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escHtml(pdfTitle)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #f3f4f6;
    color: #111827;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    line-height: 1.48;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .print-toolbar {
    position: sticky;
    top: 0;
    z-index: 20;
    background: #111827;
    color: #f9fafb;
    padding: 10px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 13px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.18);
  }
  .print-toolbar-title { font-weight: 600; display: flex; align-items: center; gap: 8px; }
  .print-toolbar-actions { display: flex; gap: 8px; }
  .print-btn {
    border: 1px solid rgba(255,255,255,0.22);
    background: transparent;
    color: #fff;
    padding: 6px 14px;
    border-radius: 6px;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
  }
  .print-btn.primary { background: #10b981; border-color: #10b981; color: #fff; }
  .print-btn:hover { opacity: 0.9; }
  .sheet {
    max-width: 960px;
    margin: 20px auto 32px;
    background: #ffffff;
    padding: 28px 32px;
    border-radius: 10px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.08);
  }
  .masthead {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    border-bottom: 2px solid #111827;
    padding-bottom: 14px;
    margin-bottom: 18px;
  }
  .brand { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.1em; color: #059669; font-weight: 800; }
  h1 { font-size: 20px; margin: 4px 0 4px; letter-spacing: -0.02em; color: #111827; }
  .sub { font-size: 12px; color: #4b5563; }
  .meta-right { text-align: right; font-size: 11px; color: #4b5563; flex-shrink: 0; }
  .meta-right strong { color: #111827; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
  .kpi-grid.cols-3 { grid-template-columns: repeat(3, 1fr); }
  .kpi-box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 11px 13px; background: #f9fafb; }
  .kpi-lbl { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; font-weight: 700; }
  .kpi-val { font-size: 16.5px; font-weight: 800; margin-top: 3px; color: #111827; font-variant-numeric: tabular-nums; }
  .kpi-sub { font-size: 10.5px; color: #4b5563; margin-top: 2px; }
  h2 {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 5px;
    margin: 20px 0 10px;
    color: #111827;
  }
  .insights { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 14px; }
  .insight { border-left: 3px solid #10b981; background: #f9fafb; padding: 8px 10px; font-size: 11.5px; border-radius: 0 6px 6px 0; }
  .insight strong { display: block; margin-bottom: 2px; color: #111827; }
  .bar-row { display: grid; grid-template-columns: 165px 1fr 145px; align-items: center; gap: 10px; margin-bottom: 7px; font-size: 11.5px; }
  .bar-label span { color: #6b7280; font-size: 10.5px; }
  .bar-track { height: 8px; background: #e5e7eb; border-radius: 99px; overflow: hidden; }
  .bar-fill { height: 100%; background: #059669; border-radius: 99px; }
  .bar-val { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
  table { width: 100%; border-collapse: collapse; font-size: 10.8px; margin-bottom: 14px; }
  th, td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f3f4f6; font-weight: 700; font-size: 9.8px; text-transform: uppercase; letter-spacing: 0.04em; color: #374151; }
  tbody tr:nth-child(even) { background: #fafafa; }
  tr.total-row td { background: #f3f4f6; font-weight: 800; border-top: 2px solid #9ca3af; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  td.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 9.8px; word-break: break-all; color: #374151; }
  .pill { display: inline-block; padding: 2px 7px; border-radius: 999px; font-size: 9.5px; font-weight: 700; white-space: nowrap; }
  .pill.active { background: #dcfce7; color: #166534; }
  .pill.pending { background: #fef3c7; color: #92400e; }
  .pill.closed { background: #f3f4f6; color: #4b5563; }
  .empty-note { padding: 14px; border: 1px dashed #d1d5db; border-radius: 8px; text-align: center; color: #6b7280; font-size: 12px; background: #f9fafb; }
  .voucher-card { border: 1.5px solid #111827; border-radius: 10px; padding: 20px 24px; }
  .voucher-amount { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; margin: 16px 0; }
  .voucher-amount .big { font-size: 24px; font-weight: 800; color: #047857; }
  .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 18px; margin-bottom: 14px; }
  .detail-item { border-bottom: 1px solid #f3f4f6; padding-bottom: 6px; }
  .detail-item .lbl { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; font-weight: 700; }
  .detail-item .val { font-size: 12.5px; font-weight: 600; color: #111827; margin-top: 2px; }
  .hash-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; word-break: break-all; color: #1f2937; }
  .footer-seal {
    margin-top: 22px;
    padding-top: 10px;
    border-top: 1px solid #d1d5db;
    font-size: 10px;
    color: #6b7280;
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }
  @media print {
    html, body { background: #ffffff !important; }
    .print-toolbar { display: none !important; }
    .sheet { margin: 0 !important; padding: 0 !important; box-shadow: none !important; border-radius: 0 !important; max-width: 100% !important; }
  }
</style>
</head>
<body>
  <div class="print-toolbar">
    <div class="print-toolbar-title">${escHtml(title)}</div>
    <div class="print-toolbar-actions">
      <button type="button" class="print-btn primary" onclick="window.print()">Print / Save as PDF</button>
      <button type="button" class="print-btn" onclick="window.close()">Close</button>
    </div>
  </div>
  <div class="sheet">
    ${bodyHtml}
  </div>
</body>
</html>`;

  const win = typeof window !== 'undefined' ? window.open('', '_blank', 'width=1024,height=780') : null;
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      try { win.print(); } catch (_) {}
    }, 320);
    return true;
  }

  // Fallback hidden iframe when popup blocker blocks window.open
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (_) {}
      setTimeout(() => iframe.remove(), 2000);
    }, 320);
  }
  return true;
}

/* ═══════════════════════════════════════════════════════════════════════════
   1. PLATFORM & NGO ANALYTICS EXPORTS (Excel / CSV / JSON / PDF)
   ═══════════════════════════════════════════════════════════════════════════ */

function buildExecutiveRows(analytics, isAdmin) {
  const { meta = {}, kpis = {}, paymentRails = [], verificationFunnel = {}, insights = [] } = analytics || {};
  const registeredNgos = kpis.registeredNgos ?? ((kpis.approvedOrgs || 0) + (kpis.pendingOrgs || 0) + (kpis.rejectedOrgs || 0));
  const verifiedNgos = kpis.verifiedNgos ?? kpis.approvedOrgs ?? 0;

  const rows = [
    [isAdmin ? 'BBDRTS — PLATFORM ANALYTICS & GOVERNANCE REPORT' : `BBDRTS — ${(meta.orgName || 'NGO').toUpperCase()} OPERATIONS REPORT`],
    [`Blockchain-Based Donation & Relief Transparency System · Generated ${formatPhtNow(meta.generatedAt)}`],
    [],
    ['REPORT DETAILS', 'VALUE', 'NOTES'],
    ['Report Scope', isAdmin ? 'Platform-Wide Administrative Oversight' : `NGO Portal (${meta.orgName || 'Organization'})`, isAdmin ? 'Includes all accredited & pending NGOs' : 'Scoped exclusively to organization campaigns'],
    ['Reporting Window', meta.rangeLabel || meta.range || 'Last 30 Days', `Cause Category Filter: ${meta.category || 'ALL'}`],
    ['Generated At (PHT)', formatPhtNow(meta.generatedAt), isAdmin ? 'Prepared for: Platform Governance Admin' : `SEC Status: ${meta.verificationStatus || 'Pending'}`],
    [],
    ['SECTION 1: KEY PERFORMANCE INDICATORS', '', ''],
    ['Metric', 'Value', 'Operational Context'],
    ['Total Aid Mobilized (Selected Window)', fmtPhp(kpis.totalMobilizedPhp), `${kpis.txCount || 0} verified donations notarized gaslessly on Sepolia`],
    ['All-Time Mobilized Aid', fmtPhp(kpis.allTimeMobilizedPhp), 'Cumulative PHP relief mobilized across all campaigns'],
    ['Average Contribution Size', fmtPhp(kpis.avgGiftPhp), 'Mean verified donation in selected period'],
    ['Disbursed Humanitarian Aid', fmtPhp(kpis.totalDisbursedPhp), `${kpis.utilizationPct || 0}% utilization rate of total mobilized funds`],
    ['Relief Operations Count', `${kpis.totalCampaigns || 0} Campaigns`, `${kpis.activeCampaigns || 0} active · ${kpis.concludedCampaigns || 0} concluded`],
    ['Average Goal Completion', `${kpis.avgFundingPct || 0}%`, 'Mean goal attainment across campaigns'],
    isAdmin
      ? ['Registered NGOs', `${registeredNgos} NGOs`, `${verifiedNgos} verified · ${kpis.pendingOrgs || 0} pending KYC · ${kpis.rejectedOrgs || 0} rejected`]
      : ['Remaining Unallocated Escrow', fmtPhp(kpis.remainingEscrowPhp), 'Available for upcoming milestone disbursements'],
    isAdmin
      ? ['Registered Platform Donors', `${kpis.registeredDonors ?? kpis.totalDonors ?? 0} Donors`, `${kpis.verifiedDonors || 0} verified · ${kpis.contributingDonors || 0} active contributors`]
      : ['Unique Supporters', `${kpis.uniqueDonors || 0} Donors`, `${kpis.verifiedBackers || 0} verified · ${kpis.repeatBackers || 0} repeat backers`],
    ['Manual Slip Verification Rate', `${kpis.approvalRatePct || 0}%`, `${verificationFunnel.approved || 0} approved · ${verificationFunnel.pending || 0} pending · ${verificationFunnel.rejected || 0} rejected`],
    ['Avg AI OCR Confidence', `${kpis.avgAiConfidence || 0}%`, 'Automated receipt verification score']
  ];

  if (insights.length > 0) {
    rows.push([]);
    rows.push(['SECTION 2: EXECUTIVE INSIGHTS', '', '']);
    rows.push(['Category', 'Headline', 'Observation Details']);
    insights.forEach((ins) => {
      rows.push([String(ins.tone || 'INFO').toUpperCase(), ins.title || '—', ins.detail || '—']);
    });
  }

  rows.push([]);
  rows.push(['SECTION 3: PAYMENT RAIL BREAKDOWN', '', '']);
  rows.push(['Payment Channel', 'Verified Transactions', 'Volume (PHP) & Share']);
  if (paymentRails.length > 0) {
    paymentRails.forEach((r) => {
      rows.push([r.rail, Number(r.count || 0), `${fmtPhp(r.php)} (${Number(r.sharePct || 0)}%)`]);
    });
  } else {
    rows.push(['No payment activity in selected window', 0, '₱0 (0%)']);
  }

  return rows;
}

export function exportExcelWorkbook(analytics, options = {}) {
  const safeAnalytics = analytics || {};
  const isAdmin = (options.mode || safeAnalytics?.meta?.scope) === 'admin' || safeAnalytics?.meta?.scope === 'PLATFORM';
  const wb = XLSX.utils.book_new();
  const dateStamp = new Date().toISOString().slice(0, 10);

  // Sheet 1: Executive Summary (clean 3-column layout, zero duplicate columns)
  const execRows = buildExecutiveRows(safeAnalytics, isAdmin);
  const wsExec = XLSX.utils.aoa_to_sheet(execRows);
  const mergesExec = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } }
  ];
  execRows.forEach((r, idx) => {
    if (typeof r[0] === 'string' && r[0].startsWith('SECTION ')) {
      mergesExec.push({ s: { r: idx, c: 0 }, e: { r: idx, c: 2 } });
    }
  });
  wsExec['!merges'] = mergesExec;
  autoSizeSheet(wsExec, execRows, 4);
  XLSX.utils.book_append_sheet(wb, wsExec, 'Executive Summary');

  // Sheet 2: Daily Trends
  const trends = safeAnalytics.trendSeries || [];
  const trendRows = [
    [isAdmin ? 'DAILY CONTRIBUTION & DISBURSEMENT TRENDS' : 'NGO DAILY INFLOW & DISBURSEMENT TRENDS'],
    [`Window: ${safeAnalytics?.meta?.rangeLabel || 'Last 30 Days'} · Generated: ${formatPhtNow(safeAnalytics?.meta?.generatedAt)}`],
    [],
    ['Date (PHT)', 'Label', 'Donations', 'GCash (PHP)', 'Maya (PHP)', 'Bank / Card (PHP)', 'Total Inflow (PHP)', 'Disbursed Aid (PHP)']
  ];
  let sumTx = 0, sumGcash = 0, sumMaya = 0, sumBankCard = 0, sumTotal = 0, sumDisb = 0;
  if (trends.length > 0) {
    trends.forEach((t) => {
      const gc = Number(t.gcashPhp ?? 0);
      const my = Number(t.mayaPhp ?? 0);
      const bc = Number(t.bankCardPhp ?? 0);
      const tot = Number(t.totalPhp ?? 0);
      const disb = Number(t.disbursedPhp ?? 0);
      sumTx += Number(t.txCount || 0);
      sumGcash += gc;
      sumMaya += my;
      sumBankCard += bc;
      sumTotal += tot;
      sumDisb += disb;
      trendRows.push([t.date, t.label, Number(t.txCount || 0), gc, my, bc, tot, disb]);
    });
  } else {
    trendRows.push(['No daily activity recorded in selected window', '', 0, 0, 0, 0, 0, 0]);
  }
  trendRows.push(['TOTAL', `${trends.length} Days`, sumTx, sumGcash, sumMaya, sumBankCard, sumTotal, sumDisb]);
  const wsTrends = XLSX.utils.aoa_to_sheet(trendRows);
  wsTrends['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } }];
  autoSizeSheet(wsTrends, trendRows, 4);
  applyPhpAndPctFormats(wsTrends, [3, 4, 5, 6, 7], [], 4);
  XLSX.utils.book_append_sheet(wb, wsTrends, 'Daily Trends');

  // Sheet 3: Payment Rails
  const rails = safeAnalytics.paymentRails || [];
  const railRows = [
    ['PAYMENT CHANNEL BREAKDOWN'],
    ['Philippine Multi-Rail Payment Channels (Gaslessly Notarized on Sepolia)'],
    [],
    ['Payment Channel', 'Verified Transactions', 'Volume (PHP)', 'Portfolio Share (%)']
  ];
  let rCount = 0, rPhp = 0;
  if (rails.length > 0) {
    rails.forEach((r) => {
      rCount += Number(r.count || 0);
      rPhp += Number(r.php || 0);
      railRows.push([r.rail, Number(r.count || 0), Number(r.php || 0), Number(r.sharePct || 0)]);
    });
  } else {
    railRows.push(['No payment channel volume yet', 0, 0, 0]);
  }
  railRows.push(['TOTAL', rCount, rPhp, rPhp > 0 ? 100 : 0]);
  const wsRails = XLSX.utils.aoa_to_sheet(railRows);
  wsRails['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } }];
  autoSizeSheet(wsRails, railRows, 4);
  applyPhpAndPctFormats(wsRails, [2], [3], 4);
  XLSX.utils.book_append_sheet(wb, wsRails, 'Payment Rails');

  // Sheet 4: Campaign Performance
  const camps = safeAnalytics.campaignPerformance || [];
  const campHeaders = isAdmin
    ? ['ID', 'Campaign Title', 'Operating NGO', 'Category', 'Urgency', 'Region', 'Status', 'Goal (PHP)', 'Raised (PHP)', 'Funded (%)', 'Disbursed (PHP)', 'Remaining (PHP)']
    : ['ID', 'Campaign Title', 'Category', 'Urgency', 'Region', 'Status', 'Goal (PHP)', 'Raised (PHP)', 'Funded (%)', 'Disbursed (PHP)', 'Remaining (PHP)'];
  const campRows = [
    ['CAMPAIGN PERFORMANCE & ESCROW MATRIX'],
    [`Total Campaigns: ${camps.length} · Generated ${formatPhtNow(safeAnalytics?.meta?.generatedAt)}`],
    [],
    campHeaders
  ];
  let cGoal = 0, cRaised = 0, cDisb = 0, cRem = 0;
  if (camps.length > 0) {
    camps.forEach((c) => {
      const target = Number(c.targetPhp || 0);
      const raised = Number(c.raisedPhp || 0);
      const disb = Number(c.disbursedPhp || 0);
      const rem = Number(c.remainingPhp || 0);
      cGoal += target;
      cRaised += raised;
      cDisb += disb;
      cRem += rem;
      campRows.push(
        isAdmin
          ? [c.id, c.title, c.orgName, c.categoryLabel, c.urgency, c.region, c.status, target, raised, Number(c.fundingPct || 0), disb, rem]
          : [c.id, c.title, c.categoryLabel, c.urgency, c.region, c.status, target, raised, Number(c.fundingPct || 0), disb, rem]
      );
    });
  } else {
    campRows.push(new Array(campHeaders.length).fill('').map((_, i) => (i === 1 ? 'No campaigns found in this filter' : '')));
  }
  const avgPct = cGoal > 0 ? Number(((cRaised / cGoal) * 100).toFixed(1)) : 0;
  campRows.push(
    isAdmin
      ? ['TOTAL', `${camps.length} Campaigns`, '', '', '', '', '', cGoal, cRaised, avgPct, cDisb, cRem]
      : ['TOTAL', `${camps.length} Campaigns`, '', '', '', '', cGoal, cRaised, avgPct, cDisb, cRem]
  );
  const wsCamps = XLSX.utils.aoa_to_sheet(campRows);
  wsCamps['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: campHeaders.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: campHeaders.length - 1 } }
  ];
  autoSizeSheet(wsCamps, campRows, 3);
  if (isAdmin) applyPhpAndPctFormats(wsCamps, [7, 8, 10, 11], [9], 4);
  else applyPhpAndPctFormats(wsCamps, [6, 7, 9, 10], [8], 4);
  XLSX.utils.book_append_sheet(wb, wsCamps, 'Campaign Performance');

  // Sheet 5: Admin NGO Directory OR NGO Disbursements Log
  if (isAdmin) {
    const orgs = safeAnalytics.topOrganizations || [];
    const orgRows = [
      ['ORGANIZATION GOVERNANCE & FUNDRAISING DIRECTORY'],
      ['SEC Verification Status, Operations Count & Multi-Rail Aid Mobilized'],
      [],
      ['Org ID', 'Organization Name', 'Email Address', 'Verification Status', 'SEC Reg No.', 'Campaigns', 'Goal (PHP)', 'Raised (PHP)', 'Funded (%)', 'Disbursed (PHP)']
    ];
    let oGoal = 0, oRaised = 0, oDisb = 0;
    if (orgs.length > 0) {
      orgs.forEach((o) => {
        oGoal += Number(o.targetPhp || 0);
        oRaised += Number(o.raisedPhp || 0);
        oDisb += Number(o.disbursedPhp || 0);
        orgRows.push([o.orgId, o.orgName, o.email, o.status, o.secRegNo || 'N/A', Number(o.campaignCount || 0), Number(o.targetPhp || 0), Number(o.raisedPhp || 0), Number(o.fundingPct || 0), Number(o.disbursedPhp || 0)]);
      });
    } else {
      orgRows.push(['—', 'No registered NGOs found', '', '', '', 0, 0, 0, 0, 0]);
    }
    orgRows.push(['TOTAL', `${orgs.length} Organizations`, '', '', '', '', oGoal, oRaised, '', oDisb]);
    const wsOrgs = XLSX.utils.aoa_to_sheet(orgRows);
    wsOrgs['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } }];
    autoSizeSheet(wsOrgs, orgRows, 3);
    applyPhpAndPctFormats(wsOrgs, [6, 7, 9], [8], 4);
    XLSX.utils.book_append_sheet(wb, wsOrgs, 'NGO Governance');
  } else {
    const disbs = safeAnalytics.disbursements || [];
    const disbRows = [
      ['RELIEF DISBURSEMENT & BENEFICIARY IMPACT LOG'],
      [`Recorded distribution milestones for ${safeAnalytics?.meta?.orgName || 'Organization'}`],
      [],
      ['Disbursement ID', 'Campaign', 'Beneficiaries Reached', 'Amount Disbursed (PHP)', 'Impact Summary', 'Sepolia Audit Hash', 'Disbursed Date (PHT)']
    ];
    let dPhp = 0, dBen = 0;
    if (disbs.length > 0) {
      disbs.forEach((d) => {
        dPhp += Number(d.amountPhp || 0);
        dBen += Number(d.beneficiariesReached || 0);
        disbRows.push([d.id, d.campaignTitle, Number(d.beneficiariesReached || 0), Number(d.amountPhp || 0), d.impactSummary || '—', d.txHash || '—', formatPhtNow(d.disbursedAt)]);
      });
    } else {
      disbRows.push(['—', 'No disbursements recorded in this window', 0, 0, '—', '—', '—']);
    }
    disbRows.push(['TOTAL', `${disbs.length} Records`, dBen, dPhp, '', '', '']);
    const wsDisb = XLSX.utils.aoa_to_sheet(disbRows);
    wsDisb['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } }];
    autoSizeSheet(wsDisb, disbRows, 3);
    applyPhpAndPctFormats(wsDisb, [3], [], 4);
    XLSX.utils.book_append_sheet(wb, wsDisb, 'Disbursement Proofs');
  }

  // Sheet 6: Detailed Verified Transaction Ledger
  const txList = safeAnalytics.ledgerRows || [];
  const txHeaders = isAdmin
    ? ['Tx ID', 'Timestamp (PHT)', 'Campaign', 'Operating NGO', 'Donor Identity', 'Payment Channel', 'Amount (PHP)', 'Sepolia Audit Hash', 'Status']
    : ['Tx ID', 'Timestamp (PHT)', 'Campaign', 'Donor Identity', 'Payment Channel', 'Amount (PHP)', 'Sepolia Audit Hash', 'Status'];
  const txRows = [
    ['VERIFIED CONTRIBUTION TRANSACTION LEDGER'],
    [`Showing ${txList.length} verified records (${safeAnalytics?.meta?.rangeLabel || 'Last 30 Days'})`],
    [],
    txHeaders
  ];
  let lPhp = 0;
  if (txList.length > 0) {
    txList.forEach((tx) => {
      const php = Number(tx.phpAmount || 0);
      lPhp += php;
      txRows.push(
        isAdmin
          ? [tx.id, formatPhtNow(tx.createdAt), tx.campaignTitle, tx.orgName, tx.donorName, tx.rail, php, tx.txHash || '—', tx.status || 'Verified']
          : [tx.id, formatPhtNow(tx.createdAt), tx.campaignTitle, tx.donorName, tx.rail, php, tx.txHash || '—', tx.status || 'Verified']
      );
    });
  } else {
    txRows.push(new Array(txHeaders.length).fill('').map((_, i) => (i === 2 ? 'No verified donations recorded in this period' : '')));
  }
  txRows.push(
    isAdmin
      ? ['TOTAL', `${txList.length} Transactions`, '', '', '', '', lPhp, '', '']
      : ['TOTAL', `${txList.length} Transactions`, '', '', '', lPhp, '', '']
  );
  const wsLedger = XLSX.utils.aoa_to_sheet(txRows);
  wsLedger['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: txHeaders.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: txHeaders.length - 1 } }
  ];
  autoSizeSheet(wsLedger, txRows, 3);
  if (isAdmin) applyPhpAndPctFormats(wsLedger, [6], [], 4);
  else applyPhpAndPctFormats(wsLedger, [5], [], 4);
  XLSX.utils.book_append_sheet(wb, wsLedger, 'Transaction Ledger');

  const tfLabel = safeAnalytics?.meta?.timeframeLabel || options.timeframeLabel || '';
  const filename = buildExportFilename(
    isAdmin ? ['Admin', 'Analytics'] : ['NGO', 'Analytics', safeAnalytics?.meta?.orgName || 'Report'],
    tfLabel,
    'xlsx'
  );
  XLSX.writeFile(wb, filename);
  return filename;
}

/**
 * Clean, flat, column-aligned CSV export (no jagged multi-table column misalignment).
 * Exports the verified Transaction Ledger (or Campaign Performance if 0 transactions),
 * with a crisp metadata banner and totals row.
 */
export function exportFormattedCsv(analytics, options = {}) {
  const safeAnalytics = analytics || {};
  const isAdmin = (options.mode || safeAnalytics?.meta?.scope) === 'admin' || safeAnalytics?.meta?.scope === 'PLATFORM';
  const dateStamp = new Date().toISOString().slice(0, 10);
  const txList = safeAnalytics.ledgerRows || [];
  const camps = safeAnalytics.campaignPerformance || [];

  const rows = [];
  if (txList.length > 0) {
    rows.push(
      isAdmin
        ? ['Tx ID', 'Timestamp (PHT)', 'Campaign', 'Operating NGO', 'Donor Identity', 'Payment Channel', 'Amount (PHP)', 'Status', 'Sepolia Audit Hash']
        : ['Tx ID', 'Timestamp (PHT)', 'Campaign', 'Donor Identity', 'Payment Channel', 'Amount (PHP)', 'Status', 'Sepolia Audit Hash']
    );
    let totalPhp = 0;
    txList.forEach((t) => {
      const php = Number(t.phpAmount || 0);
      totalPhp += php;
      rows.push(
        isAdmin
          ? [t.id, formatPhtNow(t.createdAt), t.campaignTitle, t.orgName || 'Verified NGO', t.donorName, t.rail, php, t.status || 'Verified', t.txHash || '—']
          : [t.id, formatPhtNow(t.createdAt), t.campaignTitle, t.donorName, t.rail, php, t.status || 'Verified', t.txHash || '—']
      );
    });
    rows.push(
      isAdmin
        ? ['TOTAL', `${txList.length} Verified Donations`, '', '', '', '', totalPhp, '', '']
        : ['TOTAL', `${txList.length} Verified Donations`, '', '', '', totalPhp, '', '']
    );
  } else {
    rows.push(['Campaign ID', 'Campaign Title', 'Operating NGO', 'Category', 'Region', 'Status', 'Goal (PHP)', 'Raised (PHP)', 'Funded (%)', 'Disbursed (PHP)']);
    let sumGoal = 0, sumRaised = 0, sumDisb = 0;
    camps.forEach((c) => {
      sumGoal += Number(c.targetPhp || 0);
      sumRaised += Number(c.raisedPhp || 0);
      sumDisb += Number(c.disbursedPhp || 0);
      rows.push([c.id, c.title, c.orgName || safeAnalytics?.meta?.orgName || 'NGO', c.categoryLabel, c.region, c.status, Number(c.targetPhp || 0), Number(c.raisedPhp || 0), `${c.fundingPct || 0}%`, Number(c.disbursedPhp || 0)]);
    });
    rows.push(['TOTAL', `${camps.length} Campaigns`, '', '', '', '', sumGoal, sumRaised, sumGoal > 0 ? `${((sumRaised / sumGoal) * 100).toFixed(1)}%` : '0%', sumDisb]);
  }

  const tfLabel = safeAnalytics?.meta?.timeframeLabel || options.timeframeLabel || '';
  const dataKind = txList.length > 0 ? 'Transactions' : 'Campaigns';
  const filename = buildExportFilename(
    isAdmin ? ['Admin', dataKind] : ['NGO', safeAnalytics?.meta?.orgName || 'Report', dataKind],
    tfLabel,
    'csv'
  );
  return writeCsvRows(rows, filename);
}

export function exportStructuredJson(analytics, options = {}) {
  const safeAnalytics = analytics || {};
  const isAdmin = (options.mode || safeAnalytics?.meta?.scope) === 'admin' || safeAnalytics?.meta?.scope === 'PLATFORM';
  const dateStamp = new Date().toISOString().slice(0, 10);
  const tfLabel = safeAnalytics?.meta?.timeframeLabel || options.timeframeLabel || '';
  const filename = buildExportFilename(
    isAdmin ? ['Admin', 'Analytics'] : ['NGO', safeAnalytics?.meta?.orgName || 'Operations', 'Analytics'],
    tfLabel,
    'json'
  );
  const payload = {
    reportTitle: isAdmin ? 'BBDRTS Platform Analytics & Governance Report' : 'BBDRTS NGO Operations Analytics Report',
    exportedAtPht: formatPhtNow(safeAnalytics?.meta?.generatedAt),
    ...safeAnalytics
  };
  return downloadBlobFile(JSON.stringify(payload, null, 2), 'application/json;charset=utf-8;', filename);
}

export function exportPrintablePdfReport(analytics, options = {}) {
  const safeAnalytics = analytics || {};
  const isAdmin = (options.mode || safeAnalytics?.meta?.scope) === 'admin' || safeAnalytics?.meta?.scope === 'PLATFORM';
  const {
    meta = {},
    kpis = {},
    paymentRails = [],
    campaignPerformance = [],
    topOrganizations = [],
    disbursements = [],
    ledgerRows = [],
    insights = [],
    verificationFunnel = {}
  } = safeAnalytics;

  const railBarsHtml = paymentRails.length > 0
    ? paymentRails
        .map(
          (r) => `
      <div class="bar-row">
        <div class="bar-label">${escHtml(r.rail)} <span>(${r.count} tx)</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max(Number(r.sharePct || 0), r.count > 0 ? 3 : 0)}%"></div></div>
        <div class="bar-val">${escHtml(fmtPhp(r.php))} (${Number(r.sharePct || 0)}%)</div>
      </div>`
        )
        .join('')
    : `<div class="empty-note">No payment transactions recorded in the selected window.</div>`;

  const campRowsHtml = campaignPerformance.length > 0
    ? campaignPerformance
        .slice(0, 30)
        .map(
          (c) => `
      <tr>
        <td>${escHtml(c.title)}</td>
        ${isAdmin ? `<td>${escHtml(c.orgName)}</td>` : ''}
        <td>${escHtml(c.categoryLabel)}</td>
        <td>${escHtml(c.region)}</td>
        <td class="num">${escHtml(fmtPhp(c.targetPhp))}</td>
        <td class="num">${escHtml(fmtPhp(c.raisedPhp))}</td>
        <td class="num">${Number(c.fundingPct || 0)}%</td>
        <td class="num">${escHtml(fmtPhp(c.disbursedPhp))}</td>
        <td><span class="pill ${c.isActive ? 'active' : 'closed'}">${escHtml(c.status)}</span></td>
      </tr>`
        )
        .join('')
    : `<tr><td colspan="${isAdmin ? 9 : 8}" style="text-align:center;color:#6b7280;padding:12px;">No campaigns matched the current filter.</td></tr>`;

  const orgSectionHtml = isAdmin && topOrganizations.length > 0
    ? `
      <h2>Organization Governance &amp; Mobilization</h2>
      <table>
        <thead>
          <tr><th>Organization</th><th>Status</th><th>SEC Reg #</th><th class="num">Campaigns</th><th class="num">Raised (PHP)</th><th class="num">Disbursed (PHP)</th></tr>
        </thead>
        <tbody>
          ${topOrganizations
            .map(
              (o) => `
            <tr>
              <td>${escHtml(o.orgName)}</td>
              <td><span class="pill ${/approved|verified/i.test(o.status) ? 'active' : 'pending'}">${escHtml(o.status)}</span></td>
              <td>${escHtml(o.secRegNo || 'N/A')}</td>
              <td class="num">${o.campaignCount}</td>
              <td class="num">${escHtml(fmtPhp(o.raisedPhp))}</td>
              <td class="num">${escHtml(fmtPhp(o.disbursedPhp))}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>`
    : '';

  const disbSectionHtml = !isAdmin
    ? `
      <h2>Relief Fund Disbursements (${disbursements.length})</h2>
      ${disbursements.length > 0
        ? `<table>
            <thead><tr><th>Date (PHT)</th><th>Campaign</th><th class="num">Beneficiaries</th><th class="num">Disbursed (PHP)</th><th>Impact Summary</th></tr></thead>
            <tbody>
              ${disbursements.slice(0, 25).map((d) => `
                <tr>
                  <td>${escHtml(formatPhtNow(d.disbursedAt))}</td>
                  <td>${escHtml(d.campaignTitle)}</td>
                  <td class="num">${Number(d.beneficiariesReached || 0).toLocaleString()}</td>
                  <td class="num">${escHtml(fmtPhp(d.amountPhp))}</td>
                  <td>${escHtml(d.impactSummary || '—')}</td>
                </tr>`).join('')}
            </tbody>
          </table>`
        : `<div class="empty-note">No relief disbursements logged in this period yet.</div>`}`
    : '';

  const recentLedgerHtml = `
    <h2>Recent Verified Transactions (${Math.min(ledgerRows.length, 30)} of ${ledgerRows.length})</h2>
    ${ledgerRows.length > 0
      ? `<table>
          <thead>
            <tr>
              <th>Date (PHT)</th>
              <th>Campaign</th>
              <th>Donor</th>
              <th>Channel</th>
              <th class="num">Amount (PHP)</th>
              <th>Sepolia Audit Hash</th>
            </tr>
          </thead>
          <tbody>
            ${ledgerRows.slice(0, 30).map((tx) => `
              <tr>
                <td>${escHtml(formatPhtNow(tx.createdAt))}</td>
                <td>${escHtml(tx.campaignTitle)}</td>
                <td>${escHtml(tx.donorName)}</td>
                <td>${escHtml(tx.rail)}</td>
                <td class="num">${escHtml(fmtPhp(tx.phpAmount))}</td>
                <td class="mono">${escHtml(tx.txHash ? (tx.txHash.length > 22 ? tx.txHash.slice(0, 12) + '…' + tx.txHash.slice(-8) : tx.txHash) : '—')}</td>
              </tr>`).join('')}
          </tbody>
        </table>`
      : `<div class="empty-note">No verified donations recorded in this reporting window.</div>`}`;

  const title = isAdmin ? 'BBDRTS Admin Executive Analytics Report' : `${meta.orgName || 'NGO'} Operations Analytics Report`;
  const bodyHtml = `
    <div class="masthead">
      <div>
        <div class="brand">BBDRTS · Blockchain-Based Donation &amp; Relief Transparency System</div>
        <h1>${escHtml(isAdmin ? 'Executive Platform Analytics & Governance Report' : `${meta.orgName || 'NGO'} Operations & Impact Report`)}</h1>
        <div class="sub">Window: <strong>${escHtml(meta.rangeLabel || 'Last 30 Days')}</strong>${isAdmin ? ` · Category: <strong>${escHtml(meta.category || 'ALL')}</strong>` : ` · SEC Status: <strong>${escHtml(meta.verificationStatus || 'Pending')}</strong>`}</div>
      </div>
      <div class="meta-right">
        <div><strong>Generated:</strong> ${escHtml(formatPhtNow(meta.generatedAt))}</div>
        <div><strong>Audit Ledger:</strong> Gasless Ethereum Sepolia · PHP Multi-Rail</div>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-box">
        <div class="kpi-lbl">Mobilized Aid (${escHtml(meta.rangeLabel || 'Period')})</div>
        <div class="kpi-val">${escHtml(fmtPhp(kpis.totalMobilizedPhp))}</div>
        <div class="kpi-sub">${kpis.txCount || 0} verified donations · Sepolia notarized</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-lbl">Disbursed Aid</div>
        <div class="kpi-val">${escHtml(fmtPhp(kpis.totalDisbursedPhp))}</div>
        <div class="kpi-sub">${kpis.utilizationPct || 0}% portfolio utilization</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-lbl">Relief Operations</div>
        <div class="kpi-val">${kpis.totalCampaigns || 0} Campaigns</div>
        <div class="kpi-sub">${kpis.activeCampaigns || 0} active · ${kpis.avgFundingPct || 0}% avg funded</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-lbl">Receipt Audit Rate</div>
        <div class="kpi-val">${verificationFunnel.approvalRatePct || kpis.approvalRatePct || 0}%</div>
        <div class="kpi-sub">${verificationFunnel.approved || 0} approved · ${verificationFunnel.pending || 0} pending</div>
      </div>
    </div>

    ${insights.length > 0 ? `
      <h2>Key Analytical Insights</h2>
      <div class="insights">
        ${insights.map((i) => `<div class="insight"><strong>${escHtml(i.title)}</strong>${escHtml(i.detail)}</div>`).join('')}
      </div>` : ''}

    <h2>Payment Rail Breakdown</h2>
    ${railBarsHtml}

    <h2>Campaign Performance Summary</h2>
    <table>
      <thead>
        <tr>
          <th>Campaign</th>
          ${isAdmin ? '<th>NGO</th>' : ''}
          <th>Category</th>
          <th>Region</th>
          <th class="num">Goal (PHP)</th>
          <th class="num">Raised (PHP)</th>
          <th class="num">Funded</th>
          <th class="num">Disbursed</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>${campRowsHtml}</tbody>
    </table>

    ${orgSectionHtml}
    ${disbSectionHtml}
    ${recentLedgerHtml}

    <div class="footer-seal">
      <span>BBDRTS Automated Reporting Engine · RA 10121 &amp; Sepolia EVM Transparency</span>
      <span>Printed ${escHtml(formatPhtNow())}</span>
    </div>`;

  const tfLabel = meta.timeframeLabel || options.timeframeLabel || '';
  const pdfStem = buildExportFileStem(
    isAdmin ? ['Admin', 'Analytics', 'Report'] : ['NGO', meta.orgName || 'Operations', 'Analytics'],
    tfLabel
  );
  return openPrintableHtml(title, bodyHtml, pdfStem);
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. DONOR EXPORTS (Excel · CSV · Printable Statement PDF · Single Receipt)
   ═══════════════════════════════════════════════════════════════════════════ */

function normalizeDonorRows(donations = [], campaigns = []) {
  return (donations || []).map((d, idx) => {
    const camp = (campaigns || []).find((c) => String(c.id) === String(d.campaignId));
    const campTitle = d.campaignTitle || camp?.title || `Relief Campaign #${d.campaignId || idx + 1}`;
    const orgName = d.orgName || camp?.orgName || 'Verified Accredited NGO';
    const isCharity =
      camp?.category === 'CD' ||
      /charity|school|orphan|food|feed|community|blood|medical|education/i.test(campTitle);
    const php = resolveDonationPhp(d);
    const rail = normalizePaymentRail(d.paymentMethod);
    const status = d.isShortage
      ? 'Discrepancy Flagged'
      : (d.status || 'Verified On-Chain');
    return {
      idx: idx + 1,
      id: d.id || `RCP-${idx + 1}`,
      datePht: formatPhtNow(d.createdAt || d.timestamp),
      campaignId: d.campaignId || '—',
      campaignTitle: campTitle,
      category: isCharity ? 'Charitable Aid' : 'Disaster Relief',
      orgName,
      rail,
      php,
      status,
      txHash: d.txHash || d.Tx_Hash || '—',
      note: d.message || d.dedication || ''
    };
  });
}

export function exportDonorReportExcel({ donorName = 'Verified Donor', donorEmail = '', donations = [], campaigns = [], filterSummary = 'All Records' }) {
  const rows = normalizeDonorRows(donations, campaigns);
  const totalPhp = rows.reduce((s, r) => s + r.php, 0);
  const uniqueCampaigns = new Set(rows.map((r) => String(r.campaignId))).size;
  const dateStamp = new Date().toISOString().slice(0, 10);

  const railMap = {};
  rows.forEach((r) => {
    if (!railMap[r.rail]) railMap[r.rail] = { count: 0, php: 0 };
    railMap[r.rail].count += 1;
    railMap[r.rail].php += r.php;
  });

  const wb = XLSX.utils.book_new();

  // Sheet 1: Donor Summary
  const summaryRows = [
    ['BBDRTS — OFFICIAL DONOR CONTRIBUTION STATEMENT'],
    [`Prepared for ${donorName}${donorEmail ? ` (${donorEmail})` : ''} · Generated ${formatPhtNow()}`],
    [],
    ['SUMMARY METRIC', 'VALUE', 'DETAILS'],
    ['Donor Name', donorName, donorEmail || 'Verified BBDRTS Donor Account'],
    ['Filters Applied', filterSummary || 'All Records', 'Exact scope included in this workbook'],
    ['Total Verified Contributions', fmtPhp(totalPhp), `${rows.length} donation receipt${rows.length === 1 ? '' : 's'} notarized on Ethereum Sepolia`],
    ['Campaigns Supported', `${uniqueCampaigns} Campaign${uniqueCampaigns === 1 ? '' : 's'}`, 'Across SEC-accredited Philippine NGOs'],
    ['Average Donation', fmtPhp(rows.length > 0 ? totalPhp / rows.length : 0), 'Mean contribution per verified receipt'],
    [],
    ['PAYMENT CHANNEL BREAKDOWN', 'RECEIPTS', 'TOTAL AMOUNT (PHP)']
  ];
  const railEntries = Object.entries(railMap);
  if (railEntries.length > 0) {
    railEntries.forEach(([rail, info]) => {
      summaryRows.push([rail, info.count, info.php]);
    });
  } else {
    summaryRows.push(['No donations recorded yet', 0, 0]);
  }
  const wsSum = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSum['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } }
  ];
  autoSizeSheet(wsSum, summaryRows, 4);
  applyPhpAndPctFormats(wsSum, [2], [], 11);
  XLSX.utils.book_append_sheet(wb, wsSum, 'Donor Summary');

  // Sheet 2: Itemized Donation Receipts
  const ledgerRows = [
    ['VERIFIED DONATION RECEIPTS LEDGER'],
    [`Showing ${rows.length} contribution${rows.length === 1 ? '' : 's'} · All amounts in Philippine Peso (PHP)`],
    [],
    ['#', 'Date & Time (PHT)', 'Campaign Title', 'Category', 'Operating NGO', 'Payment Channel', 'Amount (PHP)', 'Audit Status', 'Sepolia Transaction Hash']
  ];
  if (rows.length > 0) {
    rows.forEach((r) => {
      ledgerRows.push([r.idx, r.datePht, r.campaignTitle, r.category, r.orgName, r.rail, r.php, r.status, r.txHash]);
    });
  } else {
    ledgerRows.push(['—', 'No donation receipts recorded yet', '', '', '', '', 0, '—', '—']);
  }
  ledgerRows.push(['TOTAL', `${rows.length} Receipts`, '', '', '', '', totalPhp, '', '']);
  const wsRec = XLSX.utils.aoa_to_sheet(ledgerRows);
  wsRec['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } }];
  autoSizeSheet(wsRec, ledgerRows, 3);
  applyPhpAndPctFormats(wsRec, [6], [], 4);
  XLSX.utils.book_append_sheet(wb, wsRec, 'Donation Receipts');

  // Sheet 3: Campaigns Supported Rollup
  const campMap = {};
  rows.forEach((r) => {
    const key = String(r.campaignId);
    if (!campMap[key]) {
      campMap[key] = { title: r.campaignTitle, category: r.category, orgName: r.orgName, count: 0, php: 0 };
    }
    campMap[key].count += 1;
    campMap[key].php += r.php;
  });
  const campRollup = [
    ['CAMPAIGNS SUPPORTED SUMMARY'],
    ['Aggregated contributions grouped by relief campaign'],
    [],
    ['Campaign Title', 'Category', 'Operating NGO', 'Donations Made', 'Total Contributed (PHP)']
  ];
  const campEntries = Object.values(campMap);
  if (campEntries.length > 0) {
    campEntries.forEach((c) => campRollup.push([c.title, c.category, c.orgName, c.count, c.php]));
  } else {
    campRollup.push(['No campaigns supported yet', '', '', 0, 0]);
  }
  campRollup.push(['TOTAL', `${campEntries.length} Campaigns`, '', rows.length, totalPhp]);
  const wsCamp = XLSX.utils.aoa_to_sheet(campRollup);
  wsCamp['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } }];
  autoSizeSheet(wsCamp, campRollup, 3);
  applyPhpAndPctFormats(wsCamp, [4], [], 4);
  XLSX.utils.book_append_sheet(wb, wsCamp, 'Campaigns Supported');

  const filename = buildExportFilename(['Donor', 'Statement', donorName !== 'Verified Donor' ? donorName : ''], filterSummary, 'xlsx');
  XLSX.writeFile(wb, filename);
  return filename;
}

export function exportDonorReportCsv({ donorName = '', donations = [], campaigns = [], filterSummary = '' }) {
  const rows = normalizeDonorRows(donations, campaigns);
  const totalPhp = rows.reduce((s, r) => s + r.php, 0);
  const csvRows = [
    ['Receipt #', 'Date & Time (PHT)', 'Campaign Title', 'Category', 'Operating NGO', 'Payment Channel', 'Amount (PHP)', 'Audit Status', 'Sepolia Transaction Hash']
  ];
  if (rows.length > 0) {
    rows.forEach((r) => {
      csvRows.push([r.idx, r.datePht, r.campaignTitle, r.category, r.orgName, r.rail, r.php, r.status, r.txHash]);
    });
  } else {
    csvRows.push(['—', 'No donation receipts recorded yet', '', '', '', '', 0, '—', '—']);
  }
  csvRows.push(['TOTAL', `${rows.length} Verified Receipts`, '', '', '', '', totalPhp, '', '']);
  const filename = buildExportFilename(['Donor', 'Receipts', donorName && donorName !== 'Verified Donor' ? donorName : ''], filterSummary, 'csv');
  return writeCsvRows(csvRows, filename);
}

export function exportDonorPrintableReport({ donorName = 'Verified Donor', donorEmail = '', donations = [], campaigns = [], filterSummary = 'All Records' }) {
  const rows = normalizeDonorRows(donations, campaigns);
  const totalPhp = rows.reduce((s, r) => s + r.php, 0);
  const uniqueCampaigns = new Set(rows.map((r) => String(r.campaignId))).size;

  const railMap = {};
  rows.forEach((r) => {
    if (!railMap[r.rail]) railMap[r.rail] = { count: 0, php: 0 };
    railMap[r.rail].count += 1;
    railMap[r.rail].php += r.php;
  });
  const railHtml = Object.entries(railMap).length > 0
    ? Object.entries(railMap).map(([rail, info]) => {
        const pct = totalPhp > 0 ? Math.round((info.php / totalPhp) * 100) : 0;
        return `
          <div class="bar-row">
            <div class="bar-label">${escHtml(rail)} <span>(${info.count} tx)</span></div>
            <div class="bar-track"><div class="bar-fill" style="width:${Math.max(pct, 3)}%"></div></div>
            <div class="bar-val">${escHtml(fmtPhp(info.php))} (${pct}%)</div>
          </div>`;
      }).join('')
    : `<div class="empty-note">No payment channel records yet.</div>`;

  const tableBody = rows.length > 0
    ? rows.map((r) => `
        <tr>
          <td>#${r.idx}</td>
          <td>${escHtml(r.datePht)}</td>
          <td><strong>${escHtml(r.campaignTitle)}</strong><br/><span style="color:#6b7280;font-size:10px;">${escHtml(r.orgName)}</span></td>
          <td>${escHtml(r.rail)}</td>
          <td class="num"><strong>${escHtml(fmtPhp(r.php))}</strong></td>
          <td><span class="pill active">${escHtml(r.status)}</span></td>
          <td class="mono">${escHtml(r.txHash && r.txHash.length > 22 ? r.txHash.slice(0, 12) + '…' + r.txHash.slice(-8) : r.txHash)}</td>
        </tr>`).join('') +
      `<tr class="total-row">
        <td colspan="4">TOTAL (${rows.length} Verified Receipt${rows.length === 1 ? '' : 's'})</td>
        <td class="num">${escHtml(fmtPhp(totalPhp))}</td>
        <td colspan="2">100% Gasless Sepolia Notarized</td>
      </tr>`
    : `<tr><td colspan="7" style="text-align:center;color:#6b7280;padding:18px;">No donation receipts recorded on this account yet.</td></tr>`;

  const bodyHtml = `
    <div class="masthead">
      <div>
        <div class="brand">BBDRTS · Official Donor Contribution Statement</div>
        <h1>Verified Philanthropy &amp; Relief Audit Report</h1>
        <div class="sub">Donor: <strong>${escHtml(donorName)}</strong>${donorEmail ? ` · ${escHtml(donorEmail)}` : ''} · Scope: <strong>${escHtml(filterSummary || 'All Records')}</strong></div>
      </div>
      <div class="meta-right">
        <div><strong>Generated:</strong> ${escHtml(formatPhtNow())}</div>
        <div><strong>Network:</strong> Ethereum Sepolia Audit Seal</div>
      </div>
    </div>

    <div class="kpi-grid cols-3">
      <div class="kpi-box">
        <div class="kpi-lbl">Total Contributed</div>
        <div class="kpi-val">${escHtml(fmtPhp(totalPhp))}</div>
        <div class="kpi-sub">Verified Philippine Peso total</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-lbl">Verified Receipts</div>
        <div class="kpi-val">${rows.length}</div>
        <div class="kpi-sub">Immutable on-chain audit proofs</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-lbl">Campaigns Supported</div>
        <div class="kpi-val">${uniqueCampaigns}</div>
        <div class="kpi-sub">SEC-accredited relief operations</div>
      </div>
    </div>

    <h2>Payment Channel Breakdown</h2>
    ${railHtml}

    <h2>Itemized Donation Receipts</h2>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Date &amp; Time (PHT)</th>
          <th>Campaign &amp; Operating NGO</th>
          <th>Channel</th>
          <th class="num">Amount (PHP)</th>
          <th>Status</th>
          <th>Sepolia Hash</th>
        </tr>
      </thead>
      <tbody>${tableBody}</tbody>
    </table>

    <div class="footer-seal">
      <span>BBDRTS — Blockchain-Based Donation &amp; Relief Transparency System (RA 10173 Compliant)</span>
      <span>Issued ${escHtml(formatPhtNow())}</span>
    </div>`;

  const pdfStem = buildExportFileStem(['Donor', 'Statement', donorName !== 'Verified Donor' ? donorName : ''], filterSummary);
  const displayTitle = filterSummary && !/^(all time|all records)$/i.test(filterSummary)
    ? `BBDRTS Donor Statement — ${donorName} (${filterSummary})`
    : `BBDRTS Donor Statement — ${donorName}`;
  return openPrintableHtml(displayTitle, bodyHtml, pdfStem);
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. NGO DONATION LEDGER EXPORTS (Excel · CSV · Audit PDF)
   ═══════════════════════════════════════════════════════════════════════════ */

function normalizeNgoLedgerRows(donations = [], campaigns = []) {
  return (donations || []).map((d, idx) => {
    const camp = (campaigns || []).find((c) => String(c.id) === String(d.campaignId));
    const campTitle = d.campaignTitle || camp?.title || `Relief Campaign #${d.campaignId || idx + 1}`;
    const isCharity =
      camp?.category === 'CD' ||
      /charity|school|orphan|food|feed|community|blood|medical|education/i.test(campTitle);
    const php = resolveDonationPhp(d);
    const donorName = d.isAnonymous ? 'Anonymous Supporter' : (d.donorName || 'Public Philanthropist');
    return {
      idx: idx + 1,
      id: d.id || `TX-${idx + 1}`,
      datePht: formatPhtNow(d.createdAt || d.timestamp),
      campaignId: d.campaignId || '—',
      campaignTitle: campTitle,
      category: isCharity ? 'Charitable Aid' : 'Disaster Relief',
      donorName,
      rail: normalizePaymentRail(d.paymentMethod),
      php,
      status: d.isShortage ? 'Discrepancy Flagged' : (d.status || 'Verified On-Chain'),
      txHash: d.txHash || d.Tx_Hash || '—'
    };
  });
}

export function exportNgoLedgerCsv({ orgName = 'NGO', donations = [], campaigns = [], filterSummary = '' }) {
  const rows = normalizeNgoLedgerRows(donations, campaigns);
  const totalPhp = rows.reduce((s, r) => s + r.php, 0);
  const csvRows = [
    ['Tx ID', 'Date & Time (PHT)', 'Campaign ID', 'Campaign Title', 'Category', 'Donor Name', 'Payment Channel', 'Amount (PHP)', 'Verification Status', 'Sepolia Transaction Hash']
  ];
  if (rows.length > 0) {
    rows.forEach((r) => {
      csvRows.push([r.id, r.datePht, r.campaignId, r.campaignTitle, r.category, r.donorName, r.rail, r.php, r.status, r.txHash]);
    });
  } else {
    csvRows.push(['—', 'No transactions in current filter', '', '', '', '', '', 0, '—', '—']);
  }
  csvRows.push(['TOTAL', `${rows.length} Verified Transactions`, '', '', '', '', '', totalPhp, '', '']);
  const filename = buildExportFilename(['NGO', 'Ledger', orgName], filterSummary, 'csv');
  return writeCsvRows(csvRows, filename);
}

export function exportNgoLedgerExcel({ orgName = 'NGO', donations = [], campaigns = [], filterSummary = 'All Records' }) {
  const rows = normalizeNgoLedgerRows(donations, campaigns);
  const totalPhp = rows.reduce((s, r) => s + r.php, 0);
  const uniqueDonors = new Set(rows.map((r) => r.donorName)).size;
  const railMap = {};
  rows.forEach((r) => {
    if (!railMap[r.rail]) railMap[r.rail] = { count: 0, php: 0 };
    railMap[r.rail].count += 1;
    railMap[r.rail].php += r.php;
  });

  const wb = XLSX.utils.book_new();
  const sumRows = [
    [`BBDRTS — ${String(orgName || 'NGO').toUpperCase()} DONATION LEDGER SUMMARY`],
    [`Generated ${formatPhtNow()} · Gasless Ethereum Sepolia Audited`],
    [],
    ['METRIC', 'VALUE', 'NOTES'],
    ['Organization', orgName, 'Verified BBDRTS Relief Partner'],
    ['Filters Applied', filterSummary || 'All Records', 'Exact scope included in this audit workbook'],
    ['Total Donations (Filtered)', fmtPhp(totalPhp), `${rows.length} verified ledger records`],
    ['Unique Donors', `${uniqueDonors} Supporters`, 'Includes anonymous supporters where applicable'],
    ['Average Contribution', fmtPhp(rows.length > 0 ? totalPhp / rows.length : 0), 'Mean per transaction'],
    [],
    ['PAYMENT CHANNEL', 'TRANSACTIONS', 'TOTAL VOLUME (PHP)']
  ];
  const entries = Object.entries(railMap);
  if (entries.length > 0) entries.forEach(([rail, info]) => sumRows.push([rail, info.count, info.php]));
  else sumRows.push(['No transactions yet', 0, 0]);

  const wsSum = XLSX.utils.aoa_to_sheet(sumRows);
  wsSum['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } }];
  autoSizeSheet(wsSum, sumRows, 4);
  applyPhpAndPctFormats(wsSum, [2], [], 11);
  XLSX.utils.book_append_sheet(wb, wsSum, 'Ledger Summary');

  const ledRows = [
    ['ITEMIZED DONATION LEDGER'],
    [`Organization: ${orgName} · ${rows.length} Transactions`],
    [],
    ['Tx ID', 'Date & Time (PHT)', 'Campaign ID', 'Campaign Title', 'Category', 'Donor Name', 'Payment Channel', 'Amount (PHP)', 'Status', 'Sepolia Audit Hash']
  ];
  if (rows.length > 0) {
    rows.forEach((r) => {
      ledRows.push([r.id, r.datePht, r.campaignId, r.campaignTitle, r.category, r.donorName, r.rail, r.php, r.status, r.txHash]);
    });
  } else {
    ledRows.push(['—', 'No transactions in current filter', '', '', '', '', '', 0, '—', '—']);
  }
  ledRows.push(['TOTAL', `${rows.length} Transactions`, '', '', '', '', '', totalPhp, '', '']);
  const wsLed = XLSX.utils.aoa_to_sheet(ledRows);
  wsLed['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } }];
  autoSizeSheet(wsLed, ledRows, 3);
  applyPhpAndPctFormats(wsLed, [7], [], 4);
  XLSX.utils.book_append_sheet(wb, wsLed, 'Donation Ledger');

  // Sheet 3: Campaign Breakdown
  const ngoCampMap = {};
  rows.forEach((r) => {
    const k = String(r.campaignId);
    if (!ngoCampMap[k]) ngoCampMap[k] = { title: r.campaignTitle, category: r.category, count: 0, php: 0 };
    ngoCampMap[k].count += 1;
    ngoCampMap[k].php += r.php;
  });
  const ngoCampEntries = Object.values(ngoCampMap).sort((a, b) => b.php - a.php);
  const ngoCampRows = [
    ['CAMPAIGN CONTRIBUTION BREAKDOWN'],
    [`Grouped totals across ${ngoCampEntries.length} campaign(s)`],
    [],
    ['Campaign Title', 'Category', 'Verified Donations', 'Total Raised (PHP)', 'Share (%)']
  ];
  if (ngoCampEntries.length > 0) {
    ngoCampEntries.forEach((c) => {
      const pct = totalPhp > 0 ? Number(((c.php / totalPhp) * 100).toFixed(1)) : 0;
      ngoCampRows.push([c.title, c.category, c.count, c.php, pct]);
    });
  } else {
    ngoCampRows.push(['No campaign donations matched the active filter', '', 0, 0, 0]);
  }
  ngoCampRows.push(['TOTAL', `${ngoCampEntries.length} Campaigns`, rows.length, totalPhp, totalPhp > 0 ? 100 : 0]);
  const wsNgoCamp = XLSX.utils.aoa_to_sheet(ngoCampRows);
  wsNgoCamp['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } }];
  autoSizeSheet(wsNgoCamp, ngoCampRows, 3);
  applyPhpAndPctFormats(wsNgoCamp, [3], [4], 4);
  XLSX.utils.book_append_sheet(wb, wsNgoCamp, 'Campaign Breakdown');

  const filename = buildExportFilename(['NGO', 'Ledger', orgName], filterSummary, 'xlsx');
  XLSX.writeFile(wb, filename);
  return filename;
}

export function exportNgoAuditPdf({ orgName = 'NGO', donations = [], campaigns = [], filterSummary = 'All Records' }) {
  const rows = normalizeNgoLedgerRows(donations, campaigns);
  const totalPhp = rows.reduce((s, r) => s + r.php, 0);
  const uniqueDonors = new Set(rows.map((r) => r.donorName)).size;
  const uniqueCamps = new Set(rows.map((r) => String(r.campaignId))).size;

  const railMap = {};
  rows.forEach((r) => {
    if (!railMap[r.rail]) railMap[r.rail] = { count: 0, php: 0 };
    railMap[r.rail].count += 1;
    railMap[r.rail].php += r.php;
  });
  const railHtml = Object.entries(railMap).length > 0
    ? Object.entries(railMap).map(([rail, info]) => {
        const pct = totalPhp > 0 ? Math.round((info.php / totalPhp) * 100) : 0;
        return `
          <div class="bar-row">
            <div class="bar-label">${escHtml(rail)} <span>(${info.count} tx)</span></div>
            <div class="bar-track"><div class="bar-fill" style="width:${Math.max(pct, 3)}%"></div></div>
            <div class="bar-val">${escHtml(fmtPhp(info.php))} (${pct}%)</div>
          </div>`;
      }).join('')
    : `<div class="empty-note">No donations recorded in the active filter yet.</div>`;

  const tableBody = rows.length > 0
    ? rows.slice(0, 100).map((r) => `
        <tr>
          <td>${escHtml(r.datePht)}</td>
          <td><strong>${escHtml(r.campaignTitle)}</strong><br/><span style="color:#6b7280;font-size:10px;">${escHtml(r.category)}</span></td>
          <td>${escHtml(r.donorName)}</td>
          <td>${escHtml(r.rail)}</td>
          <td class="num"><strong>${escHtml(fmtPhp(r.php))}</strong></td>
          <td><span class="pill active">${escHtml(r.status)}</span></td>
          <td class="mono">${escHtml(r.txHash && r.txHash.length > 22 ? r.txHash.slice(0, 12) + '…' + r.txHash.slice(-8) : r.txHash)}</td>
        </tr>`).join('') +
      `<tr class="total-row">
        <td colspan="4">TOTAL (${rows.length} Verified Transactions)</td>
        <td class="num">${escHtml(fmtPhp(totalPhp))}</td>
        <td colspan="2">Sepolia Blockchain Verified</td>
      </tr>`
    : `<tr><td colspan="7" style="text-align:center;color:#6b7280;padding:18px;">No donations found in the current ledger filter.</td></tr>`;

  const bodyHtml = `
    <div class="masthead">
      <div>
        <div class="brand">BBDRTS · NGO Financial Transparency Audit</div>
        <h1>${escHtml(orgName)} — Donation Ledger Report</h1>
        <div class="sub">Scope: <strong>${escHtml(filterSummary || 'All Records')}</strong> · Multi-rail receipt reconciliation</div>
      </div>
      <div class="meta-right">
        <div><strong>Generated:</strong> ${escHtml(formatPhtNow())}</div>
        <div><strong>Records Included:</strong> ${rows.length}</div>
      </div>
    </div>

    <div class="kpi-grid cols-3">
      <div class="kpi-box">
        <div class="kpi-lbl">Total Funds Received</div>
        <div class="kpi-val">${escHtml(fmtPhp(totalPhp))}</div>
        <div class="kpi-sub">Gasless Sepolia Audited</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-lbl">Verified Transactions</div>
        <div class="kpi-val">${rows.length}</div>
        <div class="kpi-sub">Across ${uniqueCamps} active campaign${uniqueCamps === 1 ? '' : 's'}</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-lbl">Unique Supporters</div>
        <div class="kpi-val">${uniqueDonors}</div>
        <div class="kpi-sub">RA 10173 privacy compliant</div>
      </div>
    </div>

    <h2>Payment Channel Distribution</h2>
    ${railHtml}

    <h2>Itemized Donation Ledger</h2>
    <table>
      <thead>
        <tr>
          <th>Date &amp; Time (PHT)</th>
          <th>Campaign</th>
          <th>Donor</th>
          <th>Channel</th>
          <th class="num">Amount (PHP)</th>
          <th>Status</th>
          <th>Sepolia Hash</th>
        </tr>
      </thead>
      <tbody>${tableBody}</tbody>
    </table>

    <div class="footer-seal">
      <span>BBDRTS NGO Financial Audit Report · Prepared for SEC &amp; Donor Transparency</span>
      <span>Printed ${escHtml(formatPhtNow())}</span>
    </div>`;

  const pdfStem = buildExportFileStem(['NGO', 'Audit', orgName], filterSummary);
  const displayTitle = filterSummary && !/^(all time|all records)$/i.test(filterSummary)
    ? `BBDRTS NGO Audit Report — ${orgName} (${filterSummary})`
    : `BBDRTS NGO Audit Report — ${orgName}`;
  return openPrintableHtml(displayTitle, bodyHtml, pdfStem);
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. ADMIN EXPORTS (Financial Ledger Excel/CSV/PDF + Activity Logs Excel/CSV)
   ═══════════════════════════════════════════════════════════════════════════ */

function normalizeAdminLedgerRows(items = []) {
  return (items || []).map((tx, idx) => ({
    idx: idx + 1,
    id: tx.id || `TX-${idx + 1}`,
    datePht: formatPhtNow(tx.timestamp || tx.createdAt),
    campaignTitle: tx.Campaign_Title || tx.campaignTitle || 'Relief Appeal',
    donorName: tx.Donor_Name || tx.donorName || 'Verified Donor',
    donorEmail: tx.Donor_Email || tx.donorEmail || '—',
    rail: normalizePaymentRail(tx.rail || tx.paymentMethod),
    php: Number(tx.phpAmount || resolveDonationPhp(tx)),
    status: tx.status || 'Verified',
    refCode: tx.refCode || tx.txHash || '—'
  }));
}

export function exportAdminFinancialLedgerCsv(items = [], filterSummary = '') {
  const rows = normalizeAdminLedgerRows(items);
  const totalPhp = rows.reduce((s, r) => s + r.php, 0);
  const csvRows = [
    ['#', 'Date & Time (PHT)', 'Campaign', 'Donor Name', 'Donor Email', 'Payment Channel', 'Amount (PHP)', 'Status', 'Reference / Sepolia Hash']
  ];
  if (rows.length > 0) {
    rows.forEach((r) => {
      csvRows.push([r.idx, r.datePht, r.campaignTitle, r.donorName, r.donorEmail, r.rail, r.php, r.status, r.refCode]);
    });
  } else {
    csvRows.push(['—', 'No transactions matched current filters', '', '', '', '', 0, '—', '—']);
  }
  csvRows.push(['TOTAL', `${rows.length} Transactions`, '', '', '', '', totalPhp, '', '']);
  const filename = buildExportFilename(['Admin', 'Financial', 'Ledger'], filterSummary, 'csv');
  return writeCsvRows(csvRows, filename);
}

export function exportAdminFinancialLedgerExcel(items = [], filterSummary = 'All Records') {
  const rows = normalizeAdminLedgerRows(items);
  const totalPhp = rows.reduce((s, r) => s + r.php, 0);
  const railMap = {};
  rows.forEach((r) => {
    if (!railMap[r.rail]) railMap[r.rail] = { count: 0, php: 0 };
    railMap[r.rail].count += 1;
    railMap[r.rail].php += r.php;
  });

  const wb = XLSX.utils.book_new();
  const sumRows = [
    ['BBDRTS — PLATFORM FINANCIAL LEDGER SUMMARY'],
    [`Generated ${formatPhtNow()} · Administrative Audit Export`],
    [],
    ['METRIC', 'VALUE', 'NOTES'],
    ['Filters Applied', filterSummary || 'All Records', 'Exact scope included in this audit workbook'],
    ['Total Filtered Volume', fmtPhp(totalPhp), `${rows.length} transactions included`],
    ['Average Transaction', fmtPhp(rows.length > 0 ? totalPhp / rows.length : 0), 'Mean verified donation value'],
    [],
    ['PAYMENT CHANNEL', 'TRANSACTIONS', 'VOLUME (PHP)']
  ];
  const entries = Object.entries(railMap);
  if (entries.length > 0) entries.forEach(([rail, info]) => sumRows.push([rail, info.count, info.php]));
  else sumRows.push(['No transactions matched', 0, 0]);
  const wsSum = XLSX.utils.aoa_to_sheet(sumRows);
  wsSum['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } }];
  autoSizeSheet(wsSum, sumRows, 4);
  applyPhpAndPctFormats(wsSum, [2], [], 9);
  XLSX.utils.book_append_sheet(wb, wsSum, 'Ledger Summary');

  const ledRows = [
    ['PLATFORM MULTI-RAIL FINANCIAL LEDGER'],
    [`Showing ${rows.length} reconciled transactions · All amounts in PHP`],
    [],
    ['#', 'Date & Time (PHT)', 'Campaign', 'Donor Name', 'Donor Email', 'Payment Channel', 'Amount (PHP)', 'Status', 'Reference / Sepolia Hash']
  ];
  if (rows.length > 0) {
    rows.forEach((r) => {
      ledRows.push([r.idx, r.datePht, r.campaignTitle, r.donorName, r.donorEmail, r.rail, r.php, r.status, r.refCode]);
    });
  } else {
    ledRows.push(['—', 'No transactions matched current filters', '', '', '', '', 0, '—', '—']);
  }
  ledRows.push(['TOTAL', `${rows.length} Transactions`, '', '', '', '', totalPhp, '', '']);
  const wsLed = XLSX.utils.aoa_to_sheet(ledRows);
  wsLed['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } }];
  autoSizeSheet(wsLed, ledRows, 3);
  applyPhpAndPctFormats(wsLed, [6], [], 4);
  XLSX.utils.book_append_sheet(wb, wsLed, 'Financial Ledger');

  // Sheet 3: Campaign Breakdown
  const admCampMap = {};
  rows.forEach((r) => {
    const k = r.campaignTitle || 'Relief Appeal';
    if (!admCampMap[k]) admCampMap[k] = { title: k, count: 0, php: 0 };
    admCampMap[k].count += 1;
    admCampMap[k].php += r.php;
  });
  const admCampEntries = Object.values(admCampMap).sort((a, b) => b.php - a.php);
  const admCampRows = [
    ['CAMPAIGN VOLUME BREAKDOWN'],
    [`Grouped across ${admCampEntries.length} campaign(s)`],
    [],
    ['Campaign Title', 'Transactions', 'Total Volume (PHP)', 'Share (%)']
  ];
  if (admCampEntries.length > 0) {
    admCampEntries.forEach((c) => {
      const pct = totalPhp > 0 ? Number(((c.php / totalPhp) * 100).toFixed(1)) : 0;
      admCampRows.push([c.title, c.count, c.php, pct]);
    });
  } else {
    admCampRows.push(['No transactions matched active filters', 0, 0, 0]);
  }
  admCampRows.push(['TOTAL', rows.length, totalPhp, totalPhp > 0 ? 100 : 0]);
  const wsAdmCamp = XLSX.utils.aoa_to_sheet(admCampRows);
  wsAdmCamp['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } }];
  autoSizeSheet(wsAdmCamp, admCampRows, 3);
  applyPhpAndPctFormats(wsAdmCamp, [2], [3], 4);
  XLSX.utils.book_append_sheet(wb, wsAdmCamp, 'Campaign Breakdown');

  const filename = buildExportFilename(['Admin', 'Financial', 'Ledger'], filterSummary, 'xlsx');
  XLSX.writeFile(wb, filename);
  return filename;
}

export function exportAdminFinancialLedgerPdf(items = [], filterSummary = 'All Records') {
  const rows = normalizeAdminLedgerRows(items);
  const totalPhp = rows.reduce((s, r) => s + r.php, 0);
  const verifiedCount = rows.filter((r) => /verified|approved/i.test(r.status)).length;

  const railMap = {};
  rows.forEach((r) => {
    if (!railMap[r.rail]) railMap[r.rail] = { count: 0, php: 0 };
    railMap[r.rail].count += 1;
    railMap[r.rail].php += r.php;
  });
  const railHtml = Object.entries(railMap).length > 0
    ? Object.entries(railMap).map(([rail, info]) => {
        const pct = totalPhp > 0 ? Math.round((info.php / totalPhp) * 100) : 0;
        return `
          <div class="bar-row">
            <div class="bar-label">${escHtml(rail)} <span>(${info.count} tx)</span></div>
            <div class="bar-track"><div class="bar-fill" style="width:${Math.max(pct, 3)}%"></div></div>
            <div class="bar-val">${escHtml(fmtPhp(info.php))} (${pct}%)</div>
          </div>`;
      }).join('')
    : `<div class="empty-note">No transactions in current filter.</div>`;

  const tableBody = rows.length > 0
    ? rows.slice(0, 120).map((r) => `
        <tr>
          <td>${escHtml(r.datePht)}</td>
          <td><strong>${escHtml(r.campaignTitle)}</strong></td>
          <td>${escHtml(r.donorName)}</td>
          <td>${escHtml(r.rail)}</td>
          <td class="num"><strong>${escHtml(fmtPhp(r.php))}</strong></td>
          <td><span class="pill ${/verified|approved/i.test(r.status) ? 'active' : 'pending'}">${escHtml(r.status)}</span></td>
          <td class="mono">${escHtml(r.refCode.length > 22 ? r.refCode.slice(0, 12) + '…' + r.refCode.slice(-8) : r.refCode)}</td>
        </tr>`).join('') +
      `<tr class="total-row">
        <td colspan="4">TOTAL (${rows.length} Transactions)</td>
        <td class="num">${escHtml(fmtPhp(totalPhp))}</td>
        <td colspan="2">${verifiedCount} Verified</td>
      </tr>`
    : `<tr><td colspan="7" style="text-align:center;color:#6b7280;padding:18px;">No financial ledger records matched the active filters.</td></tr>`;

  const bodyHtml = `
    <div class="masthead">
      <div>
        <div class="brand">BBDRTS · Platform Financial Governance Audit</div>
        <h1>Global Multi-Rail Financial Ledger Report</h1>
        <div class="sub">Scope: <strong>${escHtml(filterSummary || 'All Records')}</strong> · Gasless Sepolia Reconciled Ledger</div>
      </div>
      <div class="meta-right">
        <div><strong>Generated:</strong> ${escHtml(formatPhtNow())}</div>
        <div><strong>Total Records:</strong> ${rows.length}</div>
      </div>
    </div>

    <div class="kpi-grid cols-3">
      <div class="kpi-box">
        <div class="kpi-lbl">Total Volume (Filtered)</div>
        <div class="kpi-val">${escHtml(fmtPhp(totalPhp))}</div>
        <div class="kpi-sub">Philippine Peso total</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-lbl">Transactions</div>
        <div class="kpi-val">${rows.length}</div>
        <div class="kpi-sub">${verifiedCount} verified · ${rows.length - verifiedCount} pending/other</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-lbl">Average Contribution</div>
        <div class="kpi-val">${escHtml(fmtPhp(rows.length > 0 ? totalPhp / rows.length : 0))}</div>
        <div class="kpi-sub">Mean per record</div>
      </div>
    </div>

    <h2>Payment Channel Breakdown</h2>
    ${railHtml}

    <h2>Itemized Financial Ledger</h2>
    <table>
      <thead>
        <tr>
          <th>Date &amp; Time (PHT)</th>
          <th>Campaign</th>
          <th>Donor</th>
          <th>Channel</th>
          <th class="num">Amount (PHP)</th>
          <th>Status</th>
          <th>Reference / Hash</th>
        </tr>
      </thead>
      <tbody>${tableBody}</tbody>
    </table>

    <div class="footer-seal">
      <span>BBDRTS Administrative Audit Export · Gasless Ethereum Sepolia Verification</span>
      <span>Printed ${escHtml(formatPhtNow())}</span>
    </div>`;

  const pdfStem = buildExportFileStem(['Admin', 'Financial', 'Ledger'], filterSummary);
  const displayTitle = filterSummary && !/^(all time|all records)$/i.test(filterSummary)
    ? `BBDRTS Admin Financial Ledger (${filterSummary})`
    : 'BBDRTS Admin Financial Ledger Report';
  return openPrintableHtml(displayTitle, bodyHtml, pdfStem);
}

export function exportAdminActivityLogsCsv(logs = [], filterSummary = '') {
  const csvRows = [
    ['Log ID', 'Timestamp (PHT)', 'Category', 'Activity Description', 'Actor Name', 'Actor Email', 'Role', 'Target Entity', 'Status', 'Source IP', 'Details Summary']
  ];
  if (logs.length > 0) {
    logs.forEach((l) => {
      csvRows.push([
        l.id ?? '',
        formatPhtNow(l.createdAt || l.timestamp),
        l.category || 'SYSTEM',
        l.activity || l.action || '—',
        l.userName || l.actor || 'System',
        l.userEmail || '—',
        l.role || '—',
        l.target || l.ref || '—',
        l.status || 'SUCCESS',
        l.ipAddress || '—',
        formatReadableDetails(l.details)
      ]);
    });
  } else {
    csvRows.push(['—', 'No activity logs matched current filters', '', '', '', '', '', '', '', '', '']);
  }
  const filename = buildExportFilename(['Activity', 'Logs'], filterSummary, 'csv');
  return writeCsvRows(csvRows, filename);
}

export function exportAdminActivityLogsExcel(logs = [], filterSummary = 'All Activity Logs') {
  const wb = XLSX.utils.book_new();
  // Sheet 1: Audit Summary
  const catCounts = {};
  const roleCounts = {};
  (logs || []).forEach((l) => {
    const c = l.category || 'SYSTEM';
    const r = l.role || 'SYSTEM';
    catCounts[c] = (catCounts[c] || 0) + 1;
    roleCounts[r] = (roleCounts[r] || 0) + 1;
  });
  const sumRows = [
    ['BBDRTS — SYSTEM ACTIVITY AUDIT SUMMARY'],
    [`Generated ${formatPhtNow()} · Scope: ${filterSummary || 'All Activity Logs'}`],
    [],
    ['METRIC', 'VALUE', 'NOTES'],
    ['Filters Applied', filterSummary || 'All Activity Logs', 'Exact filter scope exported'],
    ['Total Audit Records', logs.length, 'Tamper-evident system trail'],
    [],
    ['ACTIVITY CATEGORY', 'EVENTS', 'SHARE (%)']
  ];
  Object.entries(catCounts).sort((a, b) => b[1] - a[1]).forEach(([cat, cnt]) => {
    sumRows.push([cat, cnt, logs.length > 0 ? Number(((cnt / logs.length) * 100).toFixed(1)) : 0]);
  });
  const wsSum = XLSX.utils.aoa_to_sheet(sumRows);
  wsSum['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } }];
  autoSizeSheet(wsSum, sumRows, 4);
  applyPhpAndPctFormats(wsSum, [], [2], 8);
  XLSX.utils.book_append_sheet(wb, wsSum, 'Audit Summary');

  const rows = [
    ['BBDRTS — SYSTEM ACTIVITY & SECURITY AUDIT LOGS'],
    [`Exported ${logs.length} immutable audit records · Scope: ${filterSummary || 'All Activity Logs'}`],
    [],
    ['Log ID', 'Timestamp (PHT)', 'Category', 'Activity Description', 'Actor Name', 'Actor Email', 'Role', 'Target Entity', 'Status', 'Source IP', 'Details Summary']
  ];
  if (logs.length > 0) {
    logs.forEach((l) => {
      rows.push([
        l.id ?? '',
        formatPhtNow(l.createdAt || l.timestamp),
        l.category || 'SYSTEM',
        l.activity || l.action || '—',
        l.userName || l.actor || 'System',
        l.userEmail || '—',
        l.role || '—',
        l.target || l.ref || '—',
        l.status || 'SUCCESS',
        l.ipAddress || '—',
        formatReadableDetails(l.details)
      ]);
    });
  } else {
    rows.push(['—', 'No activity logs matched current filters', '', '', '', '', '', '', '', '', '']);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } }];
  autoSizeSheet(ws, rows, 3);
  XLSX.utils.book_append_sheet(wb, ws, 'System Activity Logs');
  const filename = buildExportFilename(['Activity', 'Logs'], filterSummary, 'xlsx');
  XLSX.writeFile(wb, filename);
  return filename;
}

export function exportAdminActivityLogsPdf(logs = [], filterSummary = 'All Activity Logs') {
  const catCounts = {};
  (logs || []).forEach((l) => {
    const c = l.category || 'SYSTEM';
    catCounts[c] = (catCounts[c] || 0) + 1;
  });
  const barsHtml = Object.entries(catCounts).length > 0
    ? Object.entries(catCounts).sort((a, b) => b[1] - a[1]).map(([cat, cnt]) => {
        const pct = logs.length > 0 ? Math.round((cnt / logs.length) * 100) : 0;
        return `
          <div class="bar-row">
            <div class="bar-label">${escHtml(cat)}</div>
            <div class="bar-track"><div class="bar-fill" style="width:${Math.max(pct, 3)}%"></div></div>
            <div class="bar-val">${cnt} (${pct}%)</div>
          </div>`;
      }).join('')
    : `<div class="empty-note">No activity logs matched the active filters.</div>`;

  const tableBody = logs.length > 0
    ? logs.slice(0, 150).map((l) => `
        <tr>
          <td>#${escHtml(l.id ?? '')}</td>
          <td>${escHtml(formatPhtNow(l.createdAt || l.timestamp))}</td>
          <td><span class="pill active">${escHtml(l.category || 'SYSTEM')}</span></td>
          <td><strong>${escHtml(l.activity || l.action || '—')}</strong></td>
          <td>${escHtml(l.userName || l.actor || 'System')}<br/><span style="color:#6b7280;font-size:9.5px;">${escHtml(l.role || '')}</span></td>
          <td>${escHtml(l.target || l.ref || '—')}</td>
          <td>${escHtml(formatReadableDetails(l.details))}</td>
        </tr>`).join('')
    : `<tr><td colspan="7" style="text-align:center;color:#6b7280;padding:18px;">No activity logs matched the active filters.</td></tr>`;

  const bodyHtml = `
    <div class="masthead">
      <div>
        <div class="brand">BBDRTS · System Security &amp; Governance Audit Trail</div>
        <h1>System Activity Logs Report</h1>
        <div class="sub">Scope: <strong>${escHtml(filterSummary || 'All Activity Logs')}</strong></div>
      </div>
      <div class="meta-right">
        <div><strong>Generated:</strong> ${escHtml(formatPhtNow())}</div>
        <div><strong>Records Exported:</strong> ${logs.length}</div>
      </div>
    </div>

    <h2>Event Category Distribution</h2>
    ${barsHtml}

    <h2>Audit Trail Entries (${Math.min(logs.length, 150)} of ${logs.length})</h2>
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Timestamp (PHT)</th>
          <th>Category</th>
          <th>Activity Description</th>
          <th>Actor / Role</th>
          <th>Target</th>
          <th>Details</th>
        </tr>
      </thead>
      <tbody>${tableBody}</tbody>
    </table>

    <div class="footer-seal">
      <span>BBDRTS Centralized Immutable Activity Audit Trail</span>
      <span>Printed ${escHtml(formatPhtNow())}</span>
    </div>`;

  const pdfStem = buildExportFileStem(['Activity', 'Logs'], filterSummary);
  const displayTitle = filterSummary && !/^(all time|all records|all activity logs)$/i.test(filterSummary)
    ? `BBDRTS System Activity Logs (${filterSummary})`
    : 'BBDRTS System Activity Logs Report';
  return openPrintableHtml(displayTitle, bodyHtml, pdfStem);
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. OFFICIAL PRINTABLE DONATION RECEIPT / VOUCHER (Donor & NGO Modals)
   ═══════════════════════════════════════════════════════════════════════════ */

export function printDonationVoucher(voucher = {}) {
  const php = resolveDonationPhp(voucher);
  const donorName = voucher.isAnonymous ? 'Anonymous Supporter' : (voucher.donorName || 'Verified Donor');
  const campaignTitle = voucher.campaignTitle || `Relief Campaign #${voucher.campaignId || ''}`;
  const orgName = voucher.orgName || 'Verified Accredited NGO';
  const rail = normalizePaymentRail(voucher.paymentMethod);
  const datePht = formatPhtNow(voucher.createdAt || voucher.timestamp);
  const txHash = voucher.txHash || voucher.Tx_Hash || 'Pending Blockchain Confirmation';
  const status = voucher.isShortage ? 'Audit Discrepancy Flagged' : 'Verified & Notarized On-Chain';

  const bodyHtml = `
    <div class="voucher-card">
      <div class="masthead" style="margin-bottom:14px;">
        <div>
          <div class="brand">BBDRTS · Official Blockchain Audit Receipt</div>
          <h1>Donation Verification Voucher</h1>
          <div class="sub">Tamper-proof philanthropic record notarized gaslessly on Ethereum Sepolia</div>
        </div>
        <div class="meta-right">
          <div><strong>Receipt ID:</strong> ${escHtml(voucher.id ? `#${voucher.id}` : 'VERIFIED')}</div>
          <div><strong>Issued:</strong> ${escHtml(datePht)}</div>
        </div>
      </div>

      <div class="voucher-amount">
        <div>
          <div class="kpi-lbl" style="color:#065f46;">Verified Contribution Amount</div>
          <div class="big">${escHtml(fmtPhp(php))} PHP</div>
        </div>
        <div style="text-align:right;">
          <span class="pill active" style="font-size:11px;padding:4px 10px;">✓ ${escHtml(status)}</span>
          <div style="font-size:11px;color:#065f46;margin-top:4px;">Channel: <strong>${escHtml(rail)}</strong></div>
        </div>
      </div>

      <div class="detail-grid">
        <div class="detail-item">
          <div class="lbl">Campaign Beneficiary</div>
          <div class="val">${escHtml(campaignTitle)}</div>
        </div>
        <div class="detail-item">
          <div class="lbl">Operating Accredited NGO</div>
          <div class="val">${escHtml(orgName)}</div>
        </div>
        <div class="detail-item">
          <div class="lbl">Contributor Identity</div>
          <div class="val">${escHtml(donorName)}</div>
        </div>
        <div class="detail-item">
          <div class="lbl">Timestamp (Philippine Standard Time)</div>
          <div class="val">${escHtml(datePht)}</div>
        </div>
      </div>

      <div style="margin-top:12px;">
        <div class="kpi-lbl" style="margin-bottom:5px;">Cryptographic Sepolia Audit Hash</div>
        <div class="hash-box">${escHtml(txHash)}</div>
      </div>

      <div class="footer-seal" style="margin-top:18px;">
        <span>BBDRTS — Blockchain-Based Donation &amp; Relief Transparency System</span>
        <span>RA 10173 Privacy Compliant · Printed ${escHtml(formatPhtNow())}</span>
      </div>
    </div>`;

  const voucherIdTag = voucher.id ? `Receipt-${voucher.id}` : 'Receipt';
  const pdfStem = buildExportFileStem(['Audit', 'Voucher', voucherIdTag, orgName, campaignTitle], '');
  return openPrintableHtml(`BBDRTS Official Audit Voucher ${voucher.id ? `#${voucher.id} ` : ''}— ${campaignTitle}`, bodyHtml, pdfStem);
}
