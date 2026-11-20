import * as XLSX from 'xlsx';

function formatPhtNow(isoStr) {
  try {
    const d = isoStr ? new Date(isoStr) : new Date();
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).format(d) + ' PHT';
  } catch (_) {
    return new Date().toISOString();
  }
}

function fmtPhp(val) {
  return `₱${Math.round(Number(val || 0)).toLocaleString('en-US')}`;
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
    cols.push({ wch: Math.min(Math.max(maxLen + extraWidth, 12), 48) });
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
      if (phpCols.includes(C)) cell.z = '₱#,##0';
      else if (pctCols.includes(C)) cell.z = '0.0"%"';
    }
  }
}

function buildExecutiveRows(analytics, isAdmin) {
  const { meta = {}, kpis = {}, paymentRails = [], verificationFunnel = {}, insights = [] } = analytics;
  const rows = [
    [isAdmin ? 'BBDRTS — INSTITUTIONAL PLATFORM ANALYTICS & AUDIT REPORT' : `BBDRTS — ${(meta.orgName || 'NGO').toUpperCase()} OPERATIONS ANALYTICS REPORT`],
    [`Blockchain-Based Donation & Relief Transparency System · Generated ${formatPhtNow(meta.generatedAt)}`],
    [],
    ['REPORT METADATA', 'VALUE', '', 'SCOPE SUMMARY'],
    ['Report Scope', isAdmin ? 'Platform-Wide Administrative Oversight' : `Organization Portal (${meta.orgName || 'NGO'})`, '', isAdmin ? 'All Accredited & Pending NGOs Included' : 'Scoped Exclusively to Organization Campaigns'],
    ['Reporting Window', meta.rangeLabel || meta.range || 'Last 30 Days', '', `Cause Category Filter: ${meta.category || 'ALL'}`],
    ['Generated At (PHT)', formatPhtNow(meta.generatedAt), '', isAdmin ? 'Prepared for: Platform Governance Admin' : `Accreditation Status: ${meta.verificationStatus || 'Pending'}`],
    [],
    ['SECTION 1: KEY PERFORMANCE INDICATORS', '', '', ''],
    ['KPI Metric', 'Numeric Value', 'Formatted Display', 'Operational Context'],
    ['Total Aid Mobilized (Period)', kpis.totalMobilizedPhp || 0, fmtPhp(kpis.totalMobilizedPhp), `${kpis.txCount || 0} verified donations notarized gaslessly on Sepolia`],
    ['All-Time Mobilized Aid', kpis.allTimeMobilizedPhp || 0, fmtPhp(kpis.allTimeMobilizedPhp), 'Cumulative PHP relief mobilized across all campaigns'],
    ['Average Contribution Size', kpis.avgGiftPhp || 0, fmtPhp(kpis.avgGiftPhp), 'Per verified donation record in selected period'],
    ['Disbursed Humanitarian Aid', kpis.totalDisbursedPhp || 0, fmtPhp(kpis.totalDisbursedPhp), `${kpis.utilizationPct || 0}% utilization rate of total mobilized funds`],
    ['Relief Operations Count', kpis.totalCampaigns || 0, `${kpis.totalCampaigns || 0} Operations`, `${kpis.activeCampaigns || 0} active · ${kpis.concludedCampaigns || 0} concluded`],
    ['Average Goal Completion', kpis.avgFundingPct || 0, `${kpis.avgFundingPct || 0}%`, 'Mean quota completion across portfolio'],
    isAdmin
      ? ['Registered NGOs (Total)', kpis.registeredNgos ?? ((kpis.approvedOrgs || 0) + (kpis.pendingOrgs || 0) + (kpis.rejectedOrgs || 0)), `${kpis.registeredNgos ?? ((kpis.approvedOrgs || 0) + (kpis.pendingOrgs || 0) + (kpis.rejectedOrgs || 0))} NGOs`, `${kpis.approvedOrgs || 0} verified/accredited · ${kpis.pendingOrgs || 0} pending KYC · ${kpis.rejectedOrgs || 0} rejected`]
      : ['Remaining Unallocated Escrow', kpis.remainingEscrowPhp || 0, fmtPhp(kpis.remainingEscrowPhp), 'Available for upcoming milestone disbursements'],
    isAdmin
      ? ['Verified / Accredited NGOs', kpis.verifiedNgos ?? kpis.approvedOrgs ?? 0, `${kpis.verifiedNgos ?? kpis.approvedOrgs ?? 0} Verified`, 'SEC-accredited · Gasless Sepolia audit active']
      : ['Verified Supporters', kpis.verifiedBackers || 0, `${kpis.verifiedBackers || 0} Verified`, `${kpis.repeatBackers || 0} repeat backers · 2FA / verified contributors`],
    isAdmin
      ? ['Registered Platform Donors', kpis.registeredDonors ?? kpis.totalDonors ?? 0, `${kpis.registeredDonors ?? kpis.totalDonors ?? 0} Donors`, `${kpis.verifiedDonors || 0} verified · ${kpis.registeredOnlyDonors || 0} registered-only accounts`]
      : ['Unique Identified Donors', kpis.uniqueDonors || 0, `${kpis.uniqueDonors || 0} Backers`, `${kpis.registeredBackers || 0} registered accounts · ${kpis.anonymousSharePct || 0}% anonymous donations`],
    ...(isAdmin
      ? [['Verified Platform Donors', kpis.verifiedDonors || 0, `${kpis.verifiedDonors || 0} Verified`, `${kpis.twoFactorDonors || 0} with 2FA · ${kpis.contributingDonors || 0} active contributors`]]
      : []),
    ['Manual Slip Verification Rate', kpis.approvalRatePct || 0, `${kpis.approvalRatePct || 0}%`, `${verificationFunnel.approved || 0} approved · ${verificationFunnel.pending || 0} pending · ${verificationFunnel.rejected || 0} rejected`],
    ['Avg AI OCR Verification Confidence', kpis.avgAiConfidence || 0, `${kpis.avgAiConfidence || 0}%`, 'Automated Gemini Vision & Tesseract slip audit score'],
    [],
    ['SECTION 2: AUTOMATED ANALYTICAL INSIGHTS', '', '', ''],
    ['Focus Area', 'Executive Observation', 'Detailed Evidence', '']
  ];

  insights.forEach((ins) => {
    rows.push([String(ins.tone || 'INFO').toUpperCase(), ins.title, ins.detail, '']);
  });

  rows.push([]);
  rows.push(['SECTION 3: PAYMENT RAIL VOLUME DISTRIBUTION', '', '', '']);
  rows.push(['Payment Channel', 'Verified Count', 'Volume (PHP)', 'Share (%)']);
  paymentRails.forEach((r) => {
    rows.push([r.rail, r.count, r.php, r.sharePct]);
  });

  return rows;
}

export function exportExcelWorkbook(analytics, options = {}) {
  const isAdmin = (options.mode || analytics?.meta?.scope) === 'admin' || analytics?.meta?.scope === 'PLATFORM';
  const wb = XLSX.utils.book_new();
  const dateStamp = new Date().toISOString().slice(0, 10);

  // Sheet 1: Executive Summary
  const execRows = buildExecutiveRows(analytics, isAdmin);
  const wsExec = XLSX.utils.aoa_to_sheet(execRows);
  const sec1Idx = execRows.findIndex((r) => r[0] === 'SECTION 1: KEY PERFORMANCE INDICATORS');
  const sec2Idx = execRows.findIndex((r) => r[0] === 'SECTION 2: AUTOMATED ANALYTICAL INSIGHTS');
  const sec3Idx = execRows.findIndex((r) => r[0] === 'SECTION 3: PAYMENT RAIL VOLUME DISTRIBUTION');
  wsExec['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
    ...(sec1Idx >= 0 ? [{ s: { r: sec1Idx, c: 0 }, e: { r: sec1Idx, c: 3 } }] : []),
    ...(sec2Idx >= 0 ? [{ s: { r: sec2Idx, c: 0 }, e: { r: sec2Idx, c: 3 } }] : []),
    ...(sec3Idx >= 0 ? [{ s: { r: sec3Idx, c: 0 }, e: { r: sec3Idx, c: 3 } }] : [])
  ];
  autoSizeSheet(wsExec, execRows, 3);
  applyPhpAndPctFormats(wsExec, [2], [3], sec3Idx >= 0 ? sec3Idx + 2 : 24);
  XLSX.utils.book_append_sheet(wb, wsExec, 'Executive Summary');

  // Sheet 2: Period Trends
  const trends = analytics.trendSeries || [];
  const trendRows = [
    [isAdmin ? 'DAILY CONTRIBUTION & DISBURSEMENT TRENDS' : 'NGO DAILY INFLOW & DISBURSEMENT TRENDS'],
    [`Window: ${analytics?.meta?.rangeLabel || '30D'} · Generated: ${formatPhtNow(analytics?.meta?.generatedAt)}`],
    [],
    ['Date (PHT)', 'Display Label', 'Verified Donations', 'E-Wallet Inflow (PHP)', 'Bank / Card Inflow (PHP)', 'Total Inflow (PHP)', 'Disbursed Aid (PHP)']
  ];
  let sumTx = 0, sumEwallet = 0, sumBankCard = 0, sumTotal = 0, sumDisb = 0;
  trends.forEach((t) => {
    const ew = Number(t.ewalletPhp ?? t.fiatPhp ?? 0);
    const bc = Number(t.bankCardPhp ?? t.cryptoPhp ?? 0);
    sumTx += t.txCount || 0;
    sumEwallet += ew;
    sumBankCard += bc;
    sumTotal += t.totalPhp || 0;
    sumDisb += t.disbursedPhp || 0;
    trendRows.push([t.date, t.label, t.txCount, ew, bc, t.totalPhp, t.disbursedPhp]);
  });
  trendRows.push(['TOTAL', `${trends.length} Days`, sumTx, sumEwallet, sumBankCard, sumTotal, sumDisb]);
  const wsTrends = XLSX.utils.aoa_to_sheet(trendRows);
  wsTrends['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } }];
  autoSizeSheet(wsTrends, trendRows, 4);
  applyPhpAndPctFormats(wsTrends, [3, 4, 5, 6], [], 4);
  XLSX.utils.book_append_sheet(wb, wsTrends, 'Daily Trends');

  // Sheet 3: Payment Rails
  const rails = analytics.paymentRails || [];
  const railRows = [
    ['PAYMENT CHANNEL PERFORMANCE BREAKDOWN'],
    ['Philippine Multi-Rail Payment Channels (Gaslessly Notarized on Sepolia)'],
    [],
    ['Payment Channel', 'Verified Transactions', 'Volume (PHP)', 'Portfolio Share (%)']
  ];
  let rCount = 0, rPhp = 0;
  rails.forEach((r) => {
    rCount += r.count || 0;
    rPhp += r.php || 0;
    railRows.push([r.rail, r.count, r.php, r.sharePct]);
  });
  railRows.push(['TOTAL', rCount, rPhp, 100]);
  const wsRails = XLSX.utils.aoa_to_sheet(railRows);
  wsRails['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } }];
  autoSizeSheet(wsRails, railRows, 4);
  applyPhpAndPctFormats(wsRails, [2], [3], 4);
  XLSX.utils.book_append_sheet(wb, wsRails, 'Payment Rails');

  // Sheet 4: Campaign Performance
  const camps = analytics.campaignPerformance || [];
  const campHeaders = isAdmin
    ? ['ID', 'Campaign Title', 'Operating NGO', 'Category', 'Urgency', 'Region', 'Status', 'Goal (PHP)', 'Raised (PHP)', 'Funded (%)', 'Disbursed (PHP)', 'Remaining (PHP)']
    : ['ID', 'Campaign Title', 'Category', 'Urgency', 'Region', 'Status', 'Goal (PHP)', 'Raised (PHP)', 'Funded (%)', 'Disbursed (PHP)', 'Remaining (PHP)'];
  const campRows = [
    ['CAMPAIGN PERFORMANCE & ESCROW UTILIZATION MATRIX'],
    [`Total Campaigns: ${camps.length} · Generated ${formatPhtNow(analytics?.meta?.generatedAt)}`],
    [],
    campHeaders
  ];
  let cGoal = 0, cRaised = 0, cDisb = 0, cRem = 0;
  camps.forEach((c) => {
    cGoal += c.targetPhp || 0;
    cRaised += c.raisedPhp || 0;
    cDisb += c.disbursedPhp || 0;
    cRem += c.remainingPhp || 0;
    const row = isAdmin
      ? [c.id, c.title, c.orgName, c.categoryLabel, c.urgency, c.region, c.status, c.targetPhp, c.raisedPhp, c.fundingPct, c.disbursedPhp, c.remainingPhp]
      : [c.id, c.title, c.categoryLabel, c.urgency, c.region, c.status, c.targetPhp, c.raisedPhp, c.fundingPct, c.disbursedPhp, c.remainingPhp];
    campRows.push(row);
  });
  const avgPct = cGoal > 0 ? Number(((cRaised / cGoal) * 100).toFixed(1)) : 0;
  campRows.push(
    isAdmin
      ? ['TOTAL', `${camps.length} Operations`, '', '', '', '', '', cGoal, cRaised, avgPct, cDisb, cRem]
      : ['TOTAL', `${camps.length} Operations`, '', '', '', '', cGoal, cRaised, avgPct, cDisb, cRem]
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
    const orgs = analytics.topOrganizations || [];
    const orgRows = [
      ['ORGANIZATION GOVERNANCE & FUNDRAISING DIRECTORY'],
      ['SEC Verification Status, Operations Count & Multi-Rail Aid Mobilized'],
      [],
      ['Org ID', 'Organization Name', 'Email Address', 'Verification Status', 'SEC Reg No.', 'Campaigns', 'Target Quota (PHP)', 'Total Raised (PHP)', 'Funding (%)', 'Disbursed (PHP)']
    ];
    let oGoal = 0, oRaised = 0, oDisb = 0;
    orgs.forEach((o) => {
      oGoal += o.targetPhp || 0;
      oRaised += o.raisedPhp || 0;
      oDisb += o.disbursedPhp || 0;
      orgRows.push([o.orgId, o.orgName, o.email, o.status, o.secRegNo || 'N/A', o.campaignCount, o.targetPhp, o.raisedPhp, o.fundingPct, o.disbursedPhp]);
    });
    orgRows.push(['TOTAL', `${orgs.length} Organizations`, '', '', '', '', oGoal, oRaised, '', oDisb]);
    const wsOrgs = XLSX.utils.aoa_to_sheet(orgRows);
    wsOrgs['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } }];
    autoSizeSheet(wsOrgs, orgRows, 3);
    applyPhpAndPctFormats(wsOrgs, [6, 7, 9], [8], 4);
    XLSX.utils.book_append_sheet(wb, wsOrgs, 'NGO Governance');
  } else {
    const disbs = analytics.disbursements || [];
    const disbRows = [
      ['RELIEF DISBURSEMENT & BENEFICIARY IMPACT MANIFESTS'],
      [`Recorded distribution milestones for ${analytics?.meta?.orgName || 'Organization'}`],
      [],
      ['Disbursement ID', 'Campaign', 'Beneficiaries Reached', 'Amount Disbursed (PHP)', 'Impact Summary', 'Sepolia Audit Hash', 'Disbursed Date (PHT)']
    ];
    let dPhp = 0, dBen = 0;
    disbs.forEach((d) => {
      dPhp += d.amountPhp || 0;
      dBen += Number(d.beneficiariesReached || 0);
      disbRows.push([d.id, d.campaignTitle, d.beneficiariesReached || 0, d.amountPhp, d.impactSummary, d.txHash, formatPhtNow(d.disbursedAt)]);
    });
    disbRows.push(['TOTAL', `${disbs.length} Records`, dBen, dPhp, '', '', '']);
    const wsDisb = XLSX.utils.aoa_to_sheet(disbRows);
    wsDisb['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } }];
    autoSizeSheet(wsDisb, disbRows, 3);
    applyPhpAndPctFormats(wsDisb, [3], [], 4);
    XLSX.utils.book_append_sheet(wb, wsDisb, 'Disbursement Proofs');
  }

  // Sheet 6: Detailed Verified Ledger
  const txList = analytics.ledgerRows || [];
  const txHeaders = isAdmin
    ? ['Tx ID', 'Timestamp (PHT)', 'Campaign', 'Operating NGO', 'Donor Identity', 'Payment Channel', 'Amount (PHP)', 'Sepolia Audit Hash', 'Status']
    : ['Tx ID', 'Timestamp (PHT)', 'Campaign', 'Donor Identity', 'Payment Channel', 'Amount (PHP)', 'Sepolia Audit Hash', 'Status'];
  const txRows = [
    ['VERIFIED CONTRIBUTION TRANSACTION LEDGER'],
    [`Showing ${txList.length} verified records in selected window (${analytics?.meta?.rangeLabel || '30D'})`],
    [],
    txHeaders
  ];
  let lPhp = 0;
  txList.forEach((tx) => {
    lPhp += tx.phpAmount || 0;
    txRows.push(
      isAdmin
        ? [tx.id, formatPhtNow(tx.createdAt), tx.campaignTitle, tx.orgName, tx.donorName, tx.rail, tx.phpAmount, tx.txHash, tx.status]
        : [tx.id, formatPhtNow(tx.createdAt), tx.campaignTitle, tx.donorName, tx.rail, tx.phpAmount, tx.txHash, tx.status]
    );
  });
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

  const safePrefix = isAdmin
    ? 'BBDRTS_Admin_Analytics_Report'
    : `BBDRTS_${String(analytics?.meta?.orgName || 'NGO').replace(/[^a-zA-Z0-9]+/g, '_')}_Analytics`;
  const filename = `${safePrefix}_${dateStamp}.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
}

function escapeCsvCell(val) {
  const str = String(val ?? '').replace(/"/g, '""');
  return `"${str}"`;
}

export function exportFormattedCsv(analytics, options = {}) {
  const isAdmin = (options.mode || analytics?.meta?.scope) === 'admin' || analytics?.meta?.scope === 'PLATFORM';
  const rows = [
    ...buildExecutiveRows(analytics, isAdmin),
    [],
    ['SECTION 4: CAMPAIGN PERFORMANCE MATRIX', '', '', ''],
    ['ID', 'Campaign Title', 'Category', 'Region', 'Status', 'Goal (PHP)', 'Raised (PHP)', 'Funded (%)', 'Disbursed (PHP)']
  ];

  (analytics.campaignPerformance || []).forEach((c) => {
    rows.push([c.id, c.title, c.categoryLabel, c.region, c.status, c.targetPhp, c.raisedPhp, `${c.fundingPct}%`, c.disbursedPhp]);
  });

  rows.push([]);
  rows.push(['SECTION 5: TRANSACTION LEDGER SUMMARY', '', '', '']);
  rows.push(['Tx ID', 'Timestamp (PHT)', 'Campaign', 'Donor', 'Payment Channel', 'Amount (PHP)', 'Sepolia Audit Hash']);
  (analytics.ledgerRows || []).forEach((t) => {
    rows.push([t.id, formatPhtNow(t.createdAt), t.campaignTitle, t.donorName, t.rail, t.phpAmount, t.txHash]);
  });

  const csvBody = rows.map((r) => r.map(escapeCsvCell).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csvBody], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStamp = new Date().toISOString().slice(0, 10);
  const filename = isAdmin
    ? `BBDRTS_Admin_Report_${dateStamp}.csv`
    : `BBDRTS_NGO_Report_${dateStamp}.csv`;
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return filename;
}

export function exportStructuredJson(analytics, options = {}) {
  const isAdmin = (options.mode || analytics?.meta?.scope) === 'admin' || analytics?.meta?.scope === 'PLATFORM';
  const dateStamp = new Date().toISOString().slice(0, 10);
  const filename = isAdmin
    ? `BBDRTS_Admin_Analytics_${dateStamp}.json`
    : `BBDRTS_NGO_Analytics_${dateStamp}.json`;
  const payload = {
    reportTitle: isAdmin ? 'BBDRTS Platform Analytics & Governance Report' : 'BBDRTS NGO Operations Analytics Report',
    exportedAtPht: formatPhtNow(analytics?.meta?.generatedAt),
    ...analytics
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return filename;
}

export function exportPrintablePdfReport(analytics, options = {}) {
  const isAdmin = (options.mode || analytics?.meta?.scope) === 'admin' || analytics?.meta?.scope === 'PLATFORM';
  const {
    meta = {},
    kpis = {},
    paymentRails = [],
    campaignPerformance = [],
    topOrganizations = [],
    insights = [],
    verificationFunnel = {}
  } = analytics;

  const esc = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const railBarsHtml = paymentRails
    .map(
      (r) => `
      <div class="bar-row">
        <div class="bar-label">${esc(r.rail)} <span>(${r.count} tx)</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max(r.sharePct, r.count > 0 ? 3 : 0)}%"></div></div>
        <div class="bar-val">${esc(fmtPhp(r.php))} (${r.sharePct}%)</div>
      </div>`
    )
    .join('');

  const campRowsHtml = campaignPerformance
    .slice(0, 25)
    .map(
      (c) => `
      <tr>
        <td>${esc(c.title)}</td>
        ${isAdmin ? `<td>${esc(c.orgName)}</td>` : ''}
        <td>${esc(c.categoryLabel)}</td>
        <td>${esc(c.region)}</td>
        <td class="num">${esc(fmtPhp(c.targetPhp))}</td>
        <td class="num">${esc(fmtPhp(c.raisedPhp))}</td>
        <td class="num">${c.fundingPct}%</td>
        <td class="num">${esc(fmtPhp(c.disbursedPhp))}</td>
        <td><span class="pill ${c.isActive ? 'active' : 'closed'}">${esc(c.status)}</span></td>
      </tr>`
    )
    .join('');

  const orgSectionHtml = isAdmin
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
              <td>${esc(o.orgName)}</td>
              <td>${esc(o.status)}</td>
              <td>${esc(o.secRegNo || 'N/A')}</td>
              <td class="num">${o.campaignCount}</td>
              <td class="num">${esc(fmtPhp(o.raisedPhp))}</td>
              <td class="num">${esc(fmtPhp(o.disbursedPhp))}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>`
    : '';

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(isAdmin ? 'BBDRTS Admin Executive Analytics Report' : `${meta.orgName || 'NGO'} Operations Analytics Report`)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111827; margin: 0; padding: 24px; line-height: 1.45; background: #fff; }
  .masthead { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111827; padding-bottom: 14px; margin-bottom: 18px; }
  .brand { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #059669; font-weight: 700; }
  h1 { font-size: 20px; margin: 4px 0 4px; letter-spacing: -0.02em; }
  .meta-right { text-align: right; font-size: 11px; color: #4b5563; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
  .kpi-box { border: 1px solid #d1d5db; border-radius: 6px; padding: 10px 12px; background: #f9fafb; }
  .kpi-lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; font-weight: 700; }
  .kpi-val { font-size: 16px; font-weight: 800; margin-top: 3px; color: #111827; }
  .kpi-sub { font-size: 10.5px; color: #4b5563; margin-top: 2px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; margin: 18px 0 10px; color: #111827; }
  .insights { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 16px; }
  .insight { border-left: 3px solid #10b981; background: #f9fafb; padding: 8px 10px; font-size: 11.5px; }
  .insight strong { display: block; margin-bottom: 2px; }
  .bar-row { display: grid; grid-template-columns: 165px 1fr 140px; align-items: center; gap: 10px; margin-bottom: 7px; font-size: 11.5px; }
  .bar-label span { color: #6b7280; font-size: 10.5px; }
  .bar-track { height: 8px; background: #e5e7eb; border-radius: 99px; overflow: hidden; }
  .bar-fill { height: 100%; background: #111827; border-radius: 99px; }
  .bar-val { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 16px; }
  th, td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; }
  th { background: #f3f4f6; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .pill { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 9.5px; font-weight: 700; }
  .pill.active { background: #dcfce7; color: #166534; }
  .pill.closed { background: #f3f4f6; color: #4b5563; }
  .footer-seal { margin-top: 20px; padding-top: 10px; border-top: 1px solid #d1d5db; font-size: 10px; color: #6b7280; display: flex; justify-content: space-between; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="masthead">
    <div>
      <div class="brand">BBDRTS · Blockchain-Based Donation &amp; Relief Transparency System</div>
      <h1>${esc(isAdmin ? 'Executive Platform Analytics & Governance Report' : `${meta.orgName || 'NGO'} Operations & Impact Report`)}</h1>
      <div style="font-size:11.5px;color:#4b5563;">Window: <strong>${esc(meta.rangeLabel || 'Last 30 Days')}</strong>${isAdmin ? ` · Category: <strong>${esc(meta.category || 'ALL')}</strong>` : ` · SEC Status: <strong>${esc(meta.verificationStatus || 'Pending')}</strong>`}</div>
    </div>
    <div class="meta-right">
      <div><strong>Generated:</strong> ${esc(formatPhtNow(meta.generatedAt))}</div>
      <div><strong>Audit Ledger:</strong> Gasless Ethereum Sepolia · PHP Payment Rails</div>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-box">
      <div class="kpi-lbl">Mobilized Aid (${esc(meta.rangeLabel)})</div>
      <div class="kpi-val">${esc(fmtPhp(kpis.totalMobilizedPhp))}</div>
      <div class="kpi-sub">${kpis.txCount || 0} verified donations · Sepolia notarized</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-lbl">Disbursed Aid</div>
      <div class="kpi-val">${esc(fmtPhp(kpis.totalDisbursedPhp))}</div>
      <div class="kpi-sub">${kpis.utilizationPct || 0}% portfolio utilization</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-lbl">Operations &amp; Quota Avg</div>
      <div class="kpi-val">${kpis.totalCampaigns || 0} Campaigns</div>
      <div class="kpi-sub">${kpis.activeCampaigns || 0} active · ${kpis.avgFundingPct || 0}% avg funded</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-lbl">Slip Audit Pass Rate</div>
      <div class="kpi-val">${verificationFunnel.approvalRatePct || 0}%</div>
      <div class="kpi-sub">${verificationFunnel.approved || 0} approved · ${verificationFunnel.pending || 0} pending (${kpis.avgAiConfidence || 0}% AI conf.)</div>
    </div>
  </div>

  <h2>Key Analytical Insights</h2>
  <div class="insights">
    ${insights.map((i) => `<div class="insight"><strong>${esc(i.title)}</strong>${esc(i.detail)}</div>`).join('')}
  </div>

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

  <div class="footer-seal">
    <span>BBDRTS Automated Reporting Engine · Philippine RA 10121 &amp; Sepolia EVM Transparency</span>
    <span>Printed ${esc(formatPhtNow())}</span>
  </div>
</body>
</html>`;

  const win = typeof window !== 'undefined' ? window.open('', '_blank', 'width=1024,height=760') : null;
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 350);
    return true;
  }

  // Fallback hidden iframe when popup blocker prevents new tab
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
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => iframe.remove(), 1500);
    }, 350);
  }
  return true;
}
