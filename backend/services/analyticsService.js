const PHP_PER_ETH = 170000;

const CATEGORY_LABELS = {
  DR: 'Disaster Relief',
  CD: 'Charitable Aid',
  TYPHOON: 'Typhoon Response',
  FLOOD: 'Flood & Inundation',
  FOOD_WATER: 'Food & Clean Water',
  MEDICAL: 'Medical & First Aid',
  SHELTER: 'Emergency Shelter'
};

function normalizeCategory(rawCat, title = '') {
  const upper = String(rawCat || '').trim().toUpperCase();
  if (CATEGORY_LABELS[upper]) {
    return { key: upper, label: CATEGORY_LABELS[upper] };
  }
  const combined = `${upper} ${String(title || '').toUpperCase()}`;
  if (combined.includes('TYPHOON') || combined.includes('STORM')) return { key: 'TYPHOON', label: 'Typhoon Response' };
  if (combined.includes('FLOOD')) return { key: 'FLOOD', label: 'Flood & Inundation' };
  if (combined.includes('MEDICAL') || combined.includes('HEALTH') || combined.includes('BLOOD')) return { key: 'MEDICAL', label: 'Medical & First Aid' };
  if (combined.includes('FOOD') || combined.includes('WATER') || combined.includes('FEED')) return { key: 'FOOD_WATER', label: 'Food & Clean Water' };
  if (combined.includes('SHELTER') || combined.includes('HOUS')) return { key: 'SHELTER', label: 'Emergency Shelter' };
  if (combined.includes('CHARIT') || combined.includes('SCHOOL') || combined.includes('AGED') || combined.includes('CD')) return { key: 'CD', label: 'Charitable Aid' };
  return { key: 'DR', label: 'Disaster Relief' };
}

function normalizePaymentRail(paymentMethod = '', txHash = '') {
  const pm = String(paymentMethod || '').toUpperCase();
  const hash = String(txHash || '').toUpperCase();
  if (pm.includes('GCASH') || hash.startsWith('FIAT-GCAS') || hash.includes('GCASH')) return 'GCash';
  if (pm.includes('MAYA') || hash.startsWith('FIAT-MAYA') || hash.includes('MAYA')) return 'Maya';
  if (pm.includes('BANK') || pm.includes('CARD') || pm.includes('CREDIT') || hash.startsWith('FIAT-BANK') || hash.startsWith('FIAT-CRED')) return 'Bank / Card';
  return 'Legacy On-Chain';
}

function extractRegion(rawLoc) {
  const s = String(rawLoc || '').trim();
  if (!s) return 'Philippines (Unspecified)';
  const parenMatch = s.match(/\(([^)]+)\)/);
  if (parenMatch) {
    const inner = parenMatch[1].trim();
    if (!inner.toLowerCase().startsWith('landmark:') && !/^\d+$/.test(inner)) {
      if (/ncr|metro manila/i.test(inner)) return 'NCR (Metro Manila)';
      if (/bicol|region v\b/i.test(inner)) return 'Region V (Bicol)';
      if (/eastern visayas|region viii/i.test(inner)) return 'Region VIII (Eastern Visayas)';
      if (/central visayas|region vii/i.test(inner)) return 'Region VII (Central Visayas)';
      if (/western visayas|region vi\b/i.test(inner)) return 'Region VI (Western Visayas)';
      if (/calabarzon|region iv-a/i.test(inner)) return 'Region IV-A (CALABARZON)';
      if (/central luzon|region iii/i.test(inner)) return 'Region III (Central Luzon)';
      if (/ilocos|region i\b/i.test(inner)) return 'Region I (Ilocos)';
      if (/cagayan valley|region ii\b/i.test(inner)) return 'Region II (Cagayan Valley)';
      if (/davao|region xi\b/i.test(inner)) return 'Region XI (Davao)';
      if (/caraga|region xiii/i.test(inner)) return 'Region XIII (Caraga)';
      if (/northern mindanao|region x\b/i.test(inner)) return 'Region X (Northern Mindanao)';
      if (/cordillera|\bcar\b/i.test(inner)) return 'CAR (Cordillera)';
      if (/barmm/i.test(inner)) return 'BARMM';
      return inner;
    }
  }
  const lower = s.toLowerCase();
  if (lower.includes('manila') || lower.includes('quezon city') || lower.includes('makati') || lower.includes('pasig') || lower.includes('taguig') || lower.includes('ncr')) return 'NCR (Metro Manila)';
  if (lower.includes('leyte') || lower.includes('tacloban') || lower.includes('samar') || lower.includes('biliran') || lower.includes('ormoc') || lower.includes('maasin')) return 'Region VIII (Eastern Visayas)';
  if (lower.includes('albay') || lower.includes('legazpi') || lower.includes('camarines') || lower.includes('sorsogon') || lower.includes('bicol') || lower.includes('catanduanes') || lower.includes('masbate')) return 'Region V (Bicol)';
  if (lower.includes('cebu') || lower.includes('bohol') || lower.includes('negros oriental')) return 'Region VII (Central Visayas)';
  if (lower.includes('iloilo') || lower.includes('bacolod') || lower.includes('aklan') || lower.includes('capiz') || lower.includes('negros occidental')) return 'Region VI (Western Visayas)';
  if (lower.includes('cavite') || lower.includes('laguna') || lower.includes('batangas') || lower.includes('rizal') || lower.includes('quezon province')) return 'Region IV-A (CALABARZON)';
  if (lower.includes('pampanga') || lower.includes('bulacan') || lower.includes('tarlac') || lower.includes('zambales') || lower.includes('bataan') || lower.includes('nueva ecija')) return 'Region III (Central Luzon)';
  if (lower.includes('davao')) return 'Region XI (Davao)';
  if (lower.includes('cagayan de oro') || lower.includes('misamis') || lower.includes('bukidnon') || lower.includes('iligan')) return 'Region X (Northern Mindanao)';
  if (lower.includes('surigao') || lower.includes('agusan') || lower.includes('butuan') || lower.includes('siargao')) return 'Region XIII (Caraga)';
  if (lower.includes('baguio') || lower.includes('benguet')) return 'CAR (Cordillera)';
  if (lower.includes('mindanao') || lower.includes('zamboanga') || lower.includes('cotabato')) return 'Mindanao Regions';
  if (lower.includes('visayas')) return 'Visayas Regions';
  return s.split(',')[0].trim() || 'Philippines (Other)';
}

function parseRangeDays(rangeStr) {
  const clean = String(rangeStr || '30d').toLowerCase();
  if (clean === '7d') return 7;
  if (clean === '30d') return 30;
  if (clean === '90d') return 90;
  return null; // 'all'
}

function toDayKey(dateInput) {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  // Convert cleanly to PHT YYYY-MM-DD
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);
    return parts;
  } catch (_) {
    return d.toISOString().slice(0, 10);
  }
}

function formatShortDay(dayKey) {
  if (!dayKey) return '';
  try {
    const [y, m, day] = dayKey.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1, day, 4, 0, 0));
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' }).format(d);
  } catch (_) {
    return dayKey;
  }
}

function buildTrendSeries(txRows, disbRows, rangeDays, nowMs) {
  const dayMap = new Map();
  const ensureDay = (dayKey) => {
    if (!dayMap.has(dayKey)) {
      dayMap.set(dayKey, {
        date: dayKey,
        label: formatShortDay(dayKey),
        totalPhp: 0,
        txCount: 0,
        ewalletPhp: 0,
        bankCardPhp: 0,
        disbursedPhp: 0
      });
    }
    return dayMap.get(dayKey);
  };

  if (rangeDays && rangeDays <= 90) {
    for (let i = rangeDays - 1; i >= 0; i--) {
      const k = toDayKey(nowMs - i * 86400000);
      if (k) ensureDay(k);
    }
  }

  txRows.forEach((tx) => {
    const k = toDayKey(tx.createdAt);
    if (!k) return;
    if (rangeDays && !dayMap.has(k)) {
      const diffDays = (nowMs - new Date(tx.createdAt).getTime()) / 86400000;
      if (diffDays > rangeDays) return;
    }
    const bucket = ensureDay(k);
    bucket.totalPhp += tx.phpAmount;
    bucket.txCount += 1;
    if (tx.rail === 'GCash' || tx.rail === 'Maya') bucket.ewalletPhp += tx.phpAmount;
    else bucket.bankCardPhp += tx.phpAmount;
  });

  disbRows.forEach((d) => {
    const k = toDayKey(d.disbursedAt);
    if (!k) return;
    if (rangeDays && !dayMap.has(k)) {
      const diffDays = (nowMs - new Date(d.disbursedAt).getTime()) / 86400000;
      if (diffDays > rangeDays) return;
    }
    const bucket = ensureDay(k);
    bucket.disbursedPhp += d.amountPhp;
  });

  const sorted = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((b) => ({
    ...b,
    totalPhp: Math.round(b.totalPhp),
    ewalletPhp: Math.round(b.ewalletPhp),
    bankCardPhp: Math.round(b.bankCardPhp),
    disbursedPhp: Math.round(b.disbursedPhp)
  }));
}

function aggregatePaymentRails(txRows) {
  const railMap = new Map([
    ['GCash', { rail: 'GCash', php: 0, count: 0 }],
    ['Maya', { rail: 'Maya', php: 0, count: 0 }],
    ['Bank / Card', { rail: 'Bank / Card', php: 0, count: 0 }]
  ]);

  let totalPhp = 0;
  txRows.forEach((tx) => {
    const r = tx.rail || 'Legacy On-Chain';
    if (!railMap.has(r)) railMap.set(r, { rail: r, php: 0, count: 0 });
    const entry = railMap.get(r);
    entry.php += tx.phpAmount;
    entry.count += 1;
    totalPhp += tx.phpAmount;
  });

  return Array.from(railMap.values())
    .map((item) => ({
      ...item,
      php: Math.round(item.php),
      sharePct: totalPhp > 0 ? Number(((item.php / totalPhp) * 100).toFixed(1)) : 0
    }))
    .sort((a, b) => b.php - a.php);
}

function formatNormalizedTransactions(dtRows, campaignsMap) {
  return (dtRows || []).map((dt) => {
    const eth = parseFloat(dt.amount || dt.Amount || 0) || 0;
    const php = Math.round(eth * PHP_PER_ETH);
    const camp = campaignsMap.get(Number(dt.campaignId || dt.Campaign_ID));
    const rail = normalizePaymentRail(dt.paymentMethod || dt.Payment_Method, dt.txHash || dt.Tx_Hash);
    const donorName = Boolean(dt.isAnonymous || dt.Is_Anonymous)
      ? 'Anonymous Supporter'
      : (dt.donorName || dt.Donor_Name || 'Verified Supporter');

    return {
      id: dt.id || dt.Transaction_ID,
      txHash: dt.txHash || dt.Tx_Hash || '',
      campaignId: Number(dt.campaignId || dt.Campaign_ID),
      campaignTitle: camp?.title || dt.campaignTitle || dt.Campaign_Title || `Campaign #${dt.campaignId || dt.Campaign_ID}`,
      orgId: camp?.orgId || Number(dt.orgId || dt.Org_ID || 0),
      orgName: camp?.orgName || dt.orgName || 'Verified Partner NGO',
      donorId: dt.donorId || dt.Donor_ID || null,
      donorName,
      isAnonymous: Boolean(dt.isAnonymous || dt.Is_Anonymous),
      rail,
      ethAmount: eth,
      phpAmount: php,
      createdAt: dt.createdAt || dt.Created_At || null,
      status: 'VERIFIED'
    };
  });
}

function summarizeVerificationHealth(manualRows) {
  let approved = 0;
  let pending = 0;
  let rejected = 0;
  let pendingPhp = 0;
  let aiConfSum = 0;
  let aiConfCount = 0;

  (manualRows || []).forEach((m) => {
    const st = String(m.status || m.Status || '').toLowerCase();
    const php = Math.round((parseFloat(m.confirmedAmount ?? m.Confirmed_Amount ?? m.amount ?? m.Amount ?? 0) || 0) * PHP_PER_ETH);
    if (st === 'approved') approved += 1;
    else if (st === 'rejected') rejected += 1;
    else {
      pending += 1;
      pendingPhp += php;
    }

    const conf = Number(m.aiConfidence ?? m.Ai_Confidence_Score);
    if (Number.isFinite(conf) && conf > 0) {
      aiConfSum += conf;
      aiConfCount += 1;
    }
  });

  const reviewed = approved + rejected;
  return {
    approved,
    pending,
    rejected,
    pendingPhp,
    total: approved + pending + rejected,
    approvalRatePct: reviewed > 0 ? Number(((approved / reviewed) * 100).toFixed(1)) : 100,
    avgAiConfidence: aiConfCount > 0 ? Number((aiConfSum / aiConfCount).toFixed(1)) : 0
  };
}

function aggregateCampaignMetrics(campRows, txRows, disbRows) {
  const txByCamp = new Map();
  txRows.forEach((t) => {
    if (!txByCamp.has(t.campaignId)) {
      txByCamp.set(t.campaignId, { php: 0, eth: 0, count: 0 });
    }
    const c = txByCamp.get(t.campaignId);
    c.php += t.phpAmount;
    c.eth += t.ethAmount;
    c.count += 1;
  });

  const disbByCamp = new Map();
  const benByCamp = new Map();
  disbRows.forEach((d) => {
    const cid = Number(d.campaignId);
    disbByCamp.set(cid, (disbByCamp.get(cid) || 0) + (parseFloat(d.amountPhp || 0) || 0));
    benByCamp.set(cid, (benByCamp.get(cid) || 0) + (Number(d.beneficiariesReached || 0) || 0));
  });

  return (campRows || []).map((c) => {
    const id = Number(c.id || c.Campaign_ID);
    const cat = normalizeCategory(c.category || c.Category, c.title || c.Campaign_Title);
    const region = extractRegion(c.locationRegion || c.Location_Region);
    const targetPhp = Number(c.targetAmountPhp || c.Target_Amount_Php) > 0
      ? Math.round(Number(c.targetAmountPhp || c.Target_Amount_Php))
      : Math.round((parseFloat(c.targetAmount || c.Target_Amount || 1) || 1) * PHP_PER_ETH);

    const allTimeRaisedEth = parseFloat(c.allTimeRaisedEth || c.currentAmount || 0) || 0;
    const allTimeRaisedPhp = Math.round(allTimeRaisedEth * PHP_PER_ETH);

    const periodAgg = txByCamp.get(id) || { php: 0, eth: 0, count: 0 };
    const storedDisb = parseFloat(c.disbursedAmountPhp || c.Disbursed_Amount_Php || 0) || 0;
    const logDisb = disbByCamp.get(id) || 0;
    const disbursedPhp = Math.round(Math.max(storedDisb, logDisb));
    const remainingPhp = Math.max(0, allTimeRaisedPhp - disbursedPhp);
    const fundingPct = targetPhp > 0 ? Number(Math.min(100, (allTimeRaisedPhp / targetPhp) * 100).toFixed(1)) : 0;
    const isActive = c.isActive === 0 || c.isActive === false ? false : true;

    return {
      id,
      orgId: Number(c.orgId || c.Org_ID || 0),
      orgName: c.orgName || c.Org_Name || 'Partner Organization',
      title: c.title || c.Campaign_Title || `Campaign #${id}`,
      categoryKey: cat.key,
      categoryLabel: cat.label,
      urgency: String(c.urgency || c.Urgency || 'HIGH').split('(')[0].trim(),
      locationRegion: c.locationRegion || c.Location_Region || 'Philippines',
      region,
      targetPhp,
      raisedPhp: allTimeRaisedPhp,
      raisedEth: Number(allTimeRaisedEth.toFixed(4)),
      periodRaisedPhp: Math.round(periodAgg.php),
      periodTxCount: periodAgg.count,
      fundingPct,
      disbursedPhp,
      remainingPhp,
      beneficiariesReached: benByCamp.get(id) || 0,
      isActive,
      status: isActive ? 'ACTIVE' : 'CONCLUDED',
      createdAt: c.createdAt || c.Created_At || null
    };
  });
}

function buildCategoryAndRegional(campaignPerf) {
  const catMap = new Map();
  const regMap = new Map();

  campaignPerf.forEach((c) => {
    if (!catMap.has(c.categoryKey)) {
      catMap.set(c.categoryKey, {
        key: c.categoryKey,
        label: c.categoryLabel,
        campaignCount: 0,
        activeCount: 0,
        raisedPhp: 0,
        targetPhp: 0,
        disbursedPhp: 0,
        txCount: 0
      });
    }
    const cat = catMap.get(c.categoryKey);
    cat.campaignCount += 1;
    if (c.isActive) cat.activeCount += 1;
    cat.raisedPhp += c.raisedPhp;
    cat.targetPhp += c.targetPhp;
    cat.disbursedPhp += c.disbursedPhp;
    cat.txCount += c.periodTxCount;

    if (!regMap.has(c.region)) {
      regMap.set(c.region, {
        region: c.region,
        campaignCount: 0,
        activeCount: 0,
        raisedPhp: 0,
        targetPhp: 0,
        disbursedPhp: 0
      });
    }
    const reg = regMap.get(c.region);
    reg.campaignCount += 1;
    if (c.isActive) reg.activeCount += 1;
    reg.raisedPhp += c.raisedPhp;
    reg.targetPhp += c.targetPhp;
    reg.disbursedPhp += c.disbursedPhp;
  });

  const categories = Array.from(catMap.values())
    .map((x) => ({
      ...x,
      fundingPct: x.targetPhp > 0 ? Number(Math.min(100, (x.raisedPhp / x.targetPhp) * 100).toFixed(1)) : 0
    }))
    .sort((a, b) => b.raisedPhp - a.raisedPhp || b.campaignCount - a.campaignCount);

  const regions = Array.from(regMap.values())
    .map((x) => ({
      ...x,
      fundingPct: x.targetPhp > 0 ? Number(Math.min(100, (x.raisedPhp / x.targetPhp) * 100).toFixed(1)) : 0
    }))
    .sort((a, b) => b.raisedPhp - a.raisedPhp || b.campaignCount - a.campaignCount);

  return { categories, regions };
}

function filterByRange(items, dateField, rangeDays, nowMs) {
  if (!rangeDays) return items;
  const cutoff = nowMs - rangeDays * 86400000;
  return items.filter((item) => {
    const val = item[dateField];
    if (!val) return false;
    const ts = new Date(val).getTime();
    return Number.isFinite(ts) && ts >= cutoff;
  });
}

function computePreviousPeriodDelta(allTxRows, rangeDays, nowMs, currentPhp) {
  if (!rangeDays) return null;
  const startPrev = nowMs - 2 * rangeDays * 86400000;
  const endPrev = nowMs - rangeDays * 86400000;
  const prevPhp = allTxRows.reduce((sum, tx) => {
    const ts = tx.createdAt ? new Date(tx.createdAt).getTime() : NaN;
    if (Number.isFinite(ts) && ts >= startPrev && ts < endPrev) {
      return sum + tx.phpAmount;
    }
    return sum;
  }, 0);
  if (prevPhp <= 0) return currentPhp > 0 ? 100 : 0;
  return Number((((currentPhp - prevPhp) / prevPhp) * 100).toFixed(1));
}

async function buildAdminAnalytics(db, { range = '30d', category = 'ALL' } = {}) {
  const nowMs = Date.now();
  const rangeDays = parseRangeDays(range);

  const [
    [campRows],
    [dtRows],
    [manualRows],
    [disbRows],
    [orgRows],
    [donorRows],
    [actRows]
  ] = await Promise.all([
    db.query(`
      SELECT
        c.Campaign_ID as id,
        c.Org_ID as orgId,
        c.Campaign_Title as title,
        c.Target_Amount as targetAmount,
        c.Target_Amount_Php as targetAmountPhp,
        c.Category as category,
        c.Urgency as urgency,
        c.Location_Region as locationRegion,
        c.Is_Active as isActive,
        c.Disbursed_Amount_Php as disbursedAmountPhp,
        c.Created_At as createdAt,
        o.Org_Name as orgName,
        COALESCE(dt.sumEth, 0) as allTimeRaisedEth
      FROM CAMPAIGN c
      LEFT JOIN (
        SELECT Campaign_ID, SUM(Amount) as sumEth
        FROM DONATION_TRANSACTION
        GROUP BY Campaign_ID
      ) dt ON c.Campaign_ID = dt.Campaign_ID
      LEFT JOIN ORGANIZATION o ON c.Org_ID = o.Org_ID
      ORDER BY c.Campaign_ID DESC
    `),
    db.query(`
      SELECT
        dt.Transaction_ID as id,
        dt.Tx_Hash as txHash,
        dt.Amount as amount,
        COALESCE(dt.Payment_Method, 'Legacy On-Chain') as paymentMethod,
        dt.Campaign_ID as campaignId,
        dt.Org_ID as orgId,
        dt.Donor_ID as donorId,
        dt.Is_Anonymous as isAnonymous,
        dt.Created_At as createdAt,
        COALESCE(NULLIF(d.Display_Name, ''), NULLIF(d.Legal_Name, ''), NULLIF(d.Name, ''), d.Username) as donorName,
        d.Wallet_Address as donorWallet,
        d.Two_Factor_Enabled as donor2fa
      FROM DONATION_TRANSACTION dt
      LEFT JOIN DONOR d ON dt.Donor_ID = d.Donor_ID
      ORDER BY dt.Transaction_ID DESC
    `),
    db.query(`
      SELECT
        Manual_ID as id,
        Campaign_ID as campaignId,
        Amount as amount,
        Confirmed_Amount as confirmedAmount,
        Payment_Method as paymentMethod,
        Status as status,
        Ai_Confidence_Score as aiConfidence,
        Created_At as createdAt
      FROM MANUAL_DONATION
      ORDER BY Manual_ID DESC
    `),
    db.query(`
      SELECT
        d.Disbursement_ID as id,
        d.Campaign_ID as campaignId,
        d.Org_ID as orgId,
        d.Amount_Php as amountPhp,
        d.Amount_Eth as amountEth,
        d.Beneficiaries_Reached as beneficiariesReached,
        d.Impact_Summary as impactSummary,
        d.Tx_Hash as txHash,
        d.Disbursed_At as disbursedAt,
        c.Campaign_Title as campaignTitle,
        o.Org_Name as orgName
      FROM CAMPAIGN_DISBURSEMENT d
      LEFT JOIN CAMPAIGN c ON d.Campaign_ID = c.Campaign_ID
      LEFT JOIN ORGANIZATION o ON d.Org_ID = o.Org_ID
      ORDER BY d.Disbursed_At DESC
    `).catch(() => [[]]),
    db.query(`
      SELECT
        Org_ID as id,
        Org_Name as orgName,
        Username as email,
        Verification_Status as status,
        Wallet_Address as walletAddress,
        Sec_Registration_No as secRegNo
      FROM ORGANIZATION
      ORDER BY Org_ID DESC
    `),
    db.query(`
      SELECT
        Donor_ID as id,
        Wallet_Address as walletAddress,
        Total_Donated as totalDonated,
        Two_Factor_Enabled as twoFactorEnabled,
        Is_Deleted as isDeleted
      FROM DONOR
    `).catch(() => [[]]),
    db.query(`
      SELECT Category as category, COUNT(*) as count
      FROM ACTIVITY_LOGS
      GROUP BY Category
      ORDER BY count DESC
    `).catch(() => [[]])
  ]);

  const campaignsMap = new Map();
  (campRows || []).forEach((c) => campaignsMap.set(Number(c.id), c));

  let filteredCampRows = campRows || [];
  if (category && category !== 'ALL') {
    filteredCampRows = filteredCampRows.filter((c) => normalizeCategory(c.category, c.title).key === category);
  }
  const allowedCampIds = new Set(filteredCampRows.map((c) => Number(c.id)));

  const allNormalizedTx = formatNormalizedTransactions(dtRows, campaignsMap)
    .filter((tx) => category === 'ALL' || allowedCampIds.has(tx.campaignId));
  const scopedTx = filterByRange(allNormalizedTx, 'createdAt', rangeDays, nowMs);

  const normalizedDisb = (disbRows || [])
    .filter((d) => category === 'ALL' || allowedCampIds.has(Number(d.campaignId)))
    .map((d) => ({
      id: d.id,
      campaignId: Number(d.campaignId),
      campaignTitle: d.campaignTitle || `Campaign #${d.campaignId}`,
      orgId: Number(d.orgId || 0),
      orgName: d.orgName || 'Partner NGO',
      amountPhp: Math.round(parseFloat(d.amountPhp || 0) || 0),
      amountEth: Number((parseFloat(d.amountEth || 0) || 0).toFixed(4)),
      beneficiariesReached: Number(d.beneficiariesReached || 0) || 0,
      impactSummary: d.impactSummary || '',
      txHash: d.txHash || '',
      disbursedAt: d.disbursedAt || null
    }));
  const scopedDisb = filterByRange(normalizedDisb, 'disbursedAt', rangeDays, nowMs);

  const scopedManual = filterByRange(
    (manualRows || []).filter((m) => category === 'ALL' || allowedCampIds.has(Number(m.campaignId))),
    'createdAt',
    rangeDays,
    nowMs
  );

  const campaignPerf = aggregateCampaignMetrics(filteredCampRows, scopedTx, normalizedDisb);
  const { categories, regions } = buildCategoryAndRegional(campaignPerf);
  const paymentRails = aggregatePaymentRails(scopedTx);
  const verificationFunnel = summarizeVerificationHealth(scopedManual);
  const trendSeries = buildTrendSeries(scopedTx, scopedDisb, rangeDays, nowMs);

  const periodMobilizedPhp = scopedTx.reduce((s, t) => s + t.phpAmount, 0);
  const periodMobilizedEth = Number(scopedTx.reduce((s, t) => s + t.ethAmount, 0).toFixed(4));
  const allTimeMobilizedPhp = campaignPerf.reduce((s, c) => s + c.raisedPhp, 0);
  const allTimeMobilizedEth = Number(campaignPerf.reduce((s, c) => s + c.raisedEth, 0).toFixed(4));
  const periodDeltaPct = computePreviousPeriodDelta(allNormalizedTx, rangeDays, nowMs, periodMobilizedPhp);

  const totalDisbursedPhp = campaignPerf.reduce((s, c) => s + c.disbursedPhp, 0);
  const utilizationPct = allTimeMobilizedPhp > 0
    ? Number(Math.min(100, (totalDisbursedPhp / allTimeMobilizedPhp) * 100).toFixed(1))
    : 0;
  const totalBeneficiaries = normalizedDisb.reduce((s, d) => s + d.beneficiariesReached, 0);
  const avgGiftPhp = scopedTx.length > 0 ? Math.round(periodMobilizedPhp / scopedTx.length) : 0;

  const activeCampaigns = campaignPerf.filter((c) => c.isActive).length;
  const concludedCampaigns = campaignPerf.length - activeCampaigns;
  const avgFundingPct = campaignPerf.length > 0
    ? Number((campaignPerf.reduce((s, c) => s + c.fundingPct, 0) / campaignPerf.length).toFixed(1))
    : 0;

  // Organization breakdown
  const orgAgg = new Map();
  (orgRows || []).forEach((o) => {
    orgAgg.set(Number(o.id), {
      orgId: Number(o.id),
      orgName: o.orgName || o.email,
      email: o.email,
      status: o.status || 'Pending',
      secRegNo: o.secRegNo || '',
      walletAddress: o.walletAddress || '',
      campaignCount: 0,
      raisedPhp: 0,
      targetPhp: 0,
      disbursedPhp: 0,
      txCount: 0
    });
  });

  campaignPerf.forEach((c) => {
    if (!orgAgg.has(c.orgId)) {
      orgAgg.set(c.orgId, {
        orgId: c.orgId,
        orgName: c.orgName,
        email: '',
        status: 'Approved',
        secRegNo: '',
        walletAddress: '',
        campaignCount: 0,
        raisedPhp: 0,
        targetPhp: 0,
        disbursedPhp: 0,
        txCount: 0
      });
    }
    const o = orgAgg.get(c.orgId);
    o.campaignCount += 1;
    o.raisedPhp += c.raisedPhp;
    o.targetPhp += c.targetPhp;
    o.disbursedPhp += c.disbursedPhp;
    o.txCount += c.periodTxCount;
  });

  const topOrganizations = Array.from(orgAgg.values())
    .map((o) => ({
      ...o,
      fundingPct: o.targetPhp > 0 ? Number(Math.min(100, (o.raisedPhp / o.targetPhp) * 100).toFixed(1)) : 0
    }))
    .sort((a, b) => b.raisedPhp - a.raisedPhp || b.campaignCount - a.campaignCount);

  const approvedOrgs = (orgRows || []).filter((o) => String(o.status).toLowerCase() === 'approved').length;
  const pendingOrgs = (orgRows || []).filter((o) => String(o.status).toLowerCase() === 'pending').length;
  const rejectedOrgs = (orgRows || []).filter((o) => String(o.status).toLowerCase() === 'rejected').length;
  const registeredNgos = (orgRows || []).length;
  const activeCampaignOrgIds = new Set(campaignPerf.filter((c) => c.isActive).map((c) => Number(c.orgId)));
  const activeCampaignNgos = (orgRows || []).filter(
    (o) => String(o.status).toLowerCase() === 'approved' && activeCampaignOrgIds.has(Number(o.id))
  ).length;

  // Donor Cohorts: Registered Donors vs Verified Donors (confirmed contribution or 2FA enabled)
  const txCountByDonor = new Map();
  allNormalizedTx.forEach((tx) => {
    if (tx.donorId) {
      txCountByDonor.set(Number(tx.donorId), (txCountByDonor.get(Number(tx.donorId)) || 0) + 1);
    }
  });
  const activeDonorRows = (donorRows || []).filter((d) => Number(d.isDeleted || 0) !== 1);
  const registeredDonors = activeDonorRows.length;
  let verifiedDonors = 0;
  let twoFactorDonors = 0;
  let contributingDonors = 0;
  let repeatDonors = 0;
  activeDonorRows.forEach((d) => {
    const id = Number(d.id);
    const txCnt = txCountByDonor.get(id) || 0;
    const hasGift = txCnt > 0 || Number(d.totalDonated || 0) > 0;
    const has2fa = Number(d.twoFactorEnabled || 0) === 1;
    if (has2fa) twoFactorDonors += 1;
    if (hasGift) contributingDonors += 1;
    if (txCnt >= 2) repeatDonors += 1;
    if (hasGift || has2fa) verifiedDonors += 1;
  });
  const registeredOnlyDonors = Math.max(0, registeredDonors - verifiedDonors);

  const ecosystemStats = {
    donors: {
      registered: registeredDonors,
      verified: verifiedDonors,
      registeredOnly: registeredOnlyDonors,
      twoFactorEnabled: twoFactorDonors,
      contributing: contributingDonors,
      repeat: repeatDonors,
      verifiedRatePct: registeredDonors > 0 ? Number(((verifiedDonors / registeredDonors) * 100).toFixed(1)) : 0
    },
    ngos: {
      registered: registeredNgos,
      verified: approvedOrgs,
      pending: pendingOrgs,
      rejected: rejectedOrgs,
      activeCampaignNgos,
      verifiedRatePct: registeredNgos > 0 ? Number(((approvedOrgs / registeredNgos) * 100).toFixed(1)) : 0
    }
  };

  const actTotal = (actRows || []).reduce((s, r) => s + Number(r.count || 0), 0);
  const activityLabels = {
    USER_MANAGEMENT: 'User Auth & Accounts',
    ADMIN_SECURITY: 'Admin & Security',
    CAMPAIGN: 'Campaign Operations',
    DONATION: 'Donation Verification',
    NGO: 'NGO Accreditation',
    SYSTEM: 'System Core'
  };
  const activityBreakdown = (actRows || []).map((r) => ({
    category: r.category,
    label: activityLabels[r.category] || r.category,
    count: Number(r.count || 0),
    sharePct: actTotal > 0 ? Number(((Number(r.count || 0) / actTotal) * 100).toFixed(1)) : 0
  }));

  // Automated executive insights derived strictly from live database metrics
  const insights = [];
  const topRail = paymentRails.find((r) => r.count > 0);
  if (topRail) {
    insights.push({
      tone: 'sky',
      title: `${topRail.rail} leads donor inflows`,
      detail: `${topRail.rail} accounts for ${topRail.sharePct}% (₱${topRail.php.toLocaleString()}) across ${topRail.count} verified donation${topRail.count === 1 ? '' : 's'}.`
    });
  }
  if (regions[0] && regions[0].raisedPhp > 0) {
    insights.push({
      tone: 'emerald',
      title: `Highest mobilization in ${regions[0].region}`,
      detail: `${regions[0].campaignCount} campaign${regions[0].campaignCount === 1 ? '' : 's'} mobilized ₱${regions[0].raisedPhp.toLocaleString()} (${regions[0].fundingPct}% of regional quota).`
    });
  }
  if (pendingOrgs > 0 || verificationFunnel.pending > 0) {
    const pendingParts = [];
    if (pendingOrgs > 0) pendingParts.push(`${pendingOrgs} NGO SEC application${pendingOrgs === 1 ? '' : 's'}`);
    if (verificationFunnel.pending > 0) pendingParts.push(`${verificationFunnel.pending} payment slip${verificationFunnel.pending === 1 ? '' : 's'}`);
    insights.push({
      tone: 'amber',
      title: 'Verification items awaiting review',
      detail: `${pendingParts.join(' and ')} awaiting compliance review.`
    });
  } else {
    insights.push({
      tone: 'emerald',
      title: 'Compliance & AI slip checks clear',
      detail: `${verificationFunnel.approvalRatePct}% fiat verification pass rate with ${verificationFunnel.avgAiConfidence || 0}% avg AI OCR confidence.`
    });
  }
  insights.push({
    tone: 'purple',
    title: 'Escrow utilization & direct aid delivery',
    detail: `₱${totalDisbursedPhp.toLocaleString()} (${utilizationPct}% of mobilized funds) has been disbursed across recorded distribution manifests.`
  });

  return {
    meta: {
      scope: 'PLATFORM',
      range,
      rangeLabel: range === '7d' ? 'Last 7 Days' : range === '30d' ? 'Last 30 Days' : range === '90d' ? 'Last 90 Days' : 'All Time',
      category,
      generatedAt: new Date(nowMs).toISOString()
    },
    kpis: {
      totalMobilizedPhp: range === 'all' ? allTimeMobilizedPhp : periodMobilizedPhp,
      totalMobilizedEth: range === 'all' ? allTimeMobilizedEth : periodMobilizedEth,
      allTimeMobilizedPhp,
      allTimeMobilizedEth,
      periodDeltaPct,
      txCount: scopedTx.length,
      avgGiftPhp,
      totalDisbursedPhp,
      utilizationPct,
      totalBeneficiaries,
      activeCampaigns,
      concludedCampaigns,
      totalCampaigns: campaignPerf.length,
      avgFundingPct,
      totalDonors: registeredDonors,
      registeredDonors,
      verifiedDonors,
      registeredOnlyDonors,
      twoFactorDonors,
      contributingDonors,
      repeatDonors,
      registeredNgos,
      verifiedNgos: approvedOrgs,
      approvedOrgs,
      pendingOrgs,
      rejectedOrgs,
      activeCampaignNgos,
      approvalRatePct: verificationFunnel.approvalRatePct,
      avgAiConfidence: verificationFunnel.avgAiConfidence,
      pendingManualCount: verificationFunnel.pending
    },
    ecosystemStats,
    trendSeries,
    paymentRails,
    categoryBreakdown: categories,
    regionalBreakdown: regions,
    verificationFunnel,
    topOrganizations,
    campaignPerformance: campaignPerf,
    activityBreakdown,
    disbursements: scopedDisb,
    insights,
    ledgerRows: scopedTx.slice(0, 500)
  };
}

async function buildOrganizationAnalytics(db, { userId, userWallet = '', range = '30d' } = {}) {
  const nowMs = Date.now();
  const rangeDays = parseRangeDays(range);
  const cleanWallet = String(userWallet || '').toLowerCase().trim() || '___none___';

  const [[orgRows]] = await Promise.all([
    db.query('SELECT Org_ID, Org_Name, Username, Verification_Status, Wallet_Address FROM ORGANIZATION WHERE Org_ID = ? LIMIT 1', [userId])
  ]);
  const orgInfo = orgRows?.[0] || {};
  const orgEffectiveWallet = String(orgInfo.Wallet_Address || cleanWallet).toLowerCase().trim() || '___none___';

  const [
    [campRows],
    [dtRows],
    [manualRows],
    [disbRows]
  ] = await Promise.all([
    db.query(`
      SELECT
        c.Campaign_ID as id,
        c.Org_ID as orgId,
        c.Campaign_Title as title,
        c.Target_Amount as targetAmount,
        c.Target_Amount_Php as targetAmountPhp,
        c.Category as category,
        c.Urgency as urgency,
        c.Location_Region as locationRegion,
        c.Is_Active as isActive,
        c.Disbursed_Amount_Php as disbursedAmountPhp,
        c.Created_At as createdAt,
        o.Org_Name as orgName,
        COALESCE(dt.sumEth, 0) as allTimeRaisedEth
      FROM CAMPAIGN c
      LEFT JOIN (
        SELECT Campaign_ID, SUM(Amount) as sumEth
        FROM DONATION_TRANSACTION
        GROUP BY Campaign_ID
      ) dt ON c.Campaign_ID = dt.Campaign_ID
      LEFT JOIN ORGANIZATION o ON c.Org_ID = o.Org_ID
      WHERE c.Org_ID = ? OR (o.Wallet_Address IS NOT NULL AND LOWER(o.Wallet_Address) = ?)
      ORDER BY c.Campaign_ID DESC
    `, [userId, orgEffectiveWallet]),
    db.query(`
      SELECT
        dt.Transaction_ID as id,
        dt.Tx_Hash as txHash,
        dt.Amount as amount,
        COALESCE(dt.Payment_Method, 'Legacy On-Chain') as paymentMethod,
        dt.Campaign_ID as campaignId,
        dt.Org_ID as orgId,
        dt.Donor_ID as donorId,
        dt.Is_Anonymous as isAnonymous,
        dt.Created_At as createdAt,
        COALESCE(NULLIF(d.Display_Name, ''), NULLIF(d.Legal_Name, ''), NULLIF(d.Name, ''), d.Username) as donorName,
        d.Wallet_Address as donorWallet,
        d.Two_Factor_Enabled as donor2fa
      FROM DONATION_TRANSACTION dt
      LEFT JOIN CAMPAIGN c ON dt.Campaign_ID = c.Campaign_ID
      LEFT JOIN ORGANIZATION o ON (dt.Org_ID = o.Org_ID OR c.Org_ID = o.Org_ID)
      LEFT JOIN DONOR d ON dt.Donor_ID = d.Donor_ID
      WHERE dt.Org_ID = ? OR c.Org_ID = ? OR (o.Wallet_Address IS NOT NULL AND LOWER(o.Wallet_Address) = ?)
      ORDER BY dt.Transaction_ID DESC
    `, [userId, userId, orgEffectiveWallet]),
    db.query(`
      SELECT
        md.Manual_ID as id,
        md.Campaign_ID as campaignId,
        md.Amount as amount,
        md.Confirmed_Amount as confirmedAmount,
        md.Payment_Method as paymentMethod,
        md.Status as status,
        md.Ai_Confidence_Score as aiConfidence,
        md.Created_At as createdAt
      FROM MANUAL_DONATION md
      LEFT JOIN CAMPAIGN c ON md.Campaign_ID = c.Campaign_ID
      WHERE c.Org_ID = ?
      ORDER BY md.Manual_ID DESC
    `, [userId]),
    db.query(`
      SELECT
        d.Disbursement_ID as id,
        d.Campaign_ID as campaignId,
        d.Amount_Php as amountPhp,
        d.Amount_Eth as amountEth,
        d.Beneficiaries_Reached as beneficiariesReached,
        d.Impact_Summary as impactSummary,
        d.Tx_Hash as txHash,
        d.Disbursed_At as disbursedAt,
        c.Campaign_Title as campaignTitle
      FROM CAMPAIGN_DISBURSEMENT d
      LEFT JOIN CAMPAIGN c ON d.Campaign_ID = c.Campaign_ID
      WHERE d.Org_ID = ? OR c.Org_ID = ?
      ORDER BY d.Disbursed_At DESC
    `, [userId, userId]).catch(() => [[]])
  ]);

  const campaignsMap = new Map();
  (campRows || []).forEach((c) => campaignsMap.set(Number(c.id), c));

  const allNormalizedTx = formatNormalizedTransactions(dtRows, campaignsMap);
  const scopedTx = filterByRange(allNormalizedTx, 'createdAt', rangeDays, nowMs);

  const normalizedDisb = (disbRows || []).map((d) => ({
    id: d.id,
    campaignId: Number(d.campaignId),
    campaignTitle: d.campaignTitle || `Campaign #${d.campaignId}`,
    amountPhp: Math.round(parseFloat(d.amountPhp || 0) || 0),
    amountEth: Number((parseFloat(d.amountEth || 0) || 0).toFixed(4)),
    beneficiariesReached: Number(d.beneficiariesReached || 0) || 0,
    impactSummary: d.impactSummary || '',
    txHash: d.txHash || '',
    disbursedAt: d.disbursedAt || null
  }));
  const scopedDisb = filterByRange(normalizedDisb, 'disbursedAt', rangeDays, nowMs);
  const scopedManual = filterByRange(manualRows || [], 'createdAt', rangeDays, nowMs);

  const campaignPerf = aggregateCampaignMetrics(campRows, scopedTx, normalizedDisb);
  const { categories, regions } = buildCategoryAndRegional(campaignPerf);
  const paymentRails = aggregatePaymentRails(scopedTx);
  const verificationFunnel = summarizeVerificationHealth(scopedManual);
  const trendSeries = buildTrendSeries(scopedTx, scopedDisb, rangeDays, nowMs);

  const periodMobilizedPhp = scopedTx.reduce((s, t) => s + t.phpAmount, 0);
  const periodMobilizedEth = Number(scopedTx.reduce((s, t) => s + t.ethAmount, 0).toFixed(4));
  const allTimeMobilizedPhp = campaignPerf.reduce((s, c) => s + c.raisedPhp, 0);
  const allTimeMobilizedEth = Number(campaignPerf.reduce((s, c) => s + c.raisedEth, 0).toFixed(4));
  const periodDeltaPct = computePreviousPeriodDelta(allNormalizedTx, rangeDays, nowMs, periodMobilizedPhp);

  const totalDisbursedPhp = campaignPerf.reduce((s, c) => s + c.disbursedPhp, 0);
  const remainingEscrowPhp = Math.max(0, allTimeMobilizedPhp - totalDisbursedPhp);
  const utilizationPct = allTimeMobilizedPhp > 0
    ? Number(Math.min(100, (totalDisbursedPhp / allTimeMobilizedPhp) * 100).toFixed(1))
    : 0;
  const totalBeneficiaries = normalizedDisb.reduce((s, d) => s + d.beneficiariesReached, 0);

  const donorMetaById = new Map();
  (dtRows || []).forEach((r) => {
    if (r.donorId) {
      donorMetaById.set(Number(r.donorId), {
        hasWallet: Boolean(r.donorWallet && String(r.donorWallet).trim().length > 0),
        has2fa: Number(r.donor2fa || 0) === 1
      });
    }
  });

  const uniqueDonorSet = new Set();
  const registeredBackerIds = new Set();
  const verifiedBackerIds = new Set();
  const backerGiftCounts = new Map();
  let anonCount = 0;
  const supporterAgg = new Map();
  scopedTx.forEach((tx) => {
    const key = tx.isAnonymous
      ? `anon_${tx.id}`
      : (tx.donorId ? `d_${tx.donorId}` : tx.donorName);
    if (!tx.isAnonymous && tx.donorId) {
      const dId = Number(tx.donorId);
      uniqueDonorSet.add(`d_${dId}`);
      registeredBackerIds.add(dId);
      backerGiftCounts.set(dId, (backerGiftCounts.get(dId) || 0) + 1);
      const dm = donorMetaById.get(dId);
      if (dm?.has2fa) {
        verifiedBackerIds.add(dId);
      }
    } else {
      uniqueDonorSet.add(key);
    }

    if (tx.isAnonymous) anonCount += 1;

    const supKey = tx.isAnonymous ? 'Anonymous Supporters' : tx.donorName;
    if (!supporterAgg.has(supKey)) {
      supporterAgg.set(supKey, { name: supKey, isAnonymous: tx.isAnonymous, php: 0, eth: 0, count: 0 });
    }
    const item = supporterAgg.get(supKey);
    item.php += tx.phpAmount;
    item.eth += tx.ethAmount;
    item.count += 1;
  });

  let repeatBackers = 0;
  backerGiftCounts.forEach((cnt, dId) => {
    if (cnt >= 2) {
      repeatBackers += 1;
      verifiedBackerIds.add(dId);
    }
  });
  const registeredOnlyBackers = Math.max(0, registeredBackerIds.size - verifiedBackerIds.size);
  const supporterStats = {
    totalBackers: uniqueDonorSet.size,
    registeredBackers: registeredBackerIds.size,
    verifiedBackers: verifiedBackerIds.size,
    registeredOnlyBackers,
    repeatBackers,
    anonymousGifts: anonCount,
    verifiedRatePct: registeredBackerIds.size > 0
      ? Number(((verifiedBackerIds.size / registeredBackerIds.size) * 100).toFixed(1))
      : 0
  };

  const topContributors = Array.from(supporterAgg.values())
    .map((x) => ({ ...x, eth: Number(x.eth.toFixed(4)) }))
    .sort((a, b) => b.php - a.php)
    .slice(0, 6);

  const avgGiftPhp = scopedTx.length > 0 ? Math.round(periodMobilizedPhp / scopedTx.length) : 0;
  const anonymousSharePct = scopedTx.length > 0 ? Number(((anonCount / scopedTx.length) * 100).toFixed(1)) : 0;
  const activeCampaigns = campaignPerf.filter((c) => c.isActive).length;
  const concludedCampaigns = campaignPerf.length - activeCampaigns;
  const avgFundingPct = campaignPerf.length > 0
    ? Number((campaignPerf.reduce((s, c) => s + c.fundingPct, 0) / campaignPerf.length).toFixed(1))
    : 0;

  // Tailored operational insights ONLY relevant to this NGO
  const insights = [];
  if (verificationFunnel.pending > 0) {
    insights.push({
      tone: 'amber',
      title: `${verificationFunnel.pending} donation slip${verificationFunnel.pending === 1 ? '' : 's'} pending review`,
      detail: `Review ₱${verificationFunnel.pendingPhp.toLocaleString()} in submitted e-wallet receipts in your Donation Ledger to credit campaign quotas.`
    });
  }
  const topRail = paymentRails.find((r) => r.count > 0);
  if (topRail) {
    insights.push({
      tone: 'sky',
      title: `${topRail.rail} is your top donation channel`,
      detail: `${topRail.sharePct}% of your received volume (₱${topRail.php.toLocaleString()}) arrives via ${topRail.rail}. Keep QR codes updated.`
    });
  }
  const bestCamp = [...campaignPerf].sort((a, b) => b.fundingPct - a.fundingPct)[0];
  if (bestCamp && bestCamp.raisedPhp > 0) {
    insights.push({
      tone: 'emerald',
      title: `Top momentum: ${bestCamp.title.slice(0, 38)}`,
      detail: `Reached ${bestCamp.fundingPct}% of goal (₱${bestCamp.raisedPhp.toLocaleString()} / ₱${bestCamp.targetPhp.toLocaleString()}).`
    });
  }
  if (remainingEscrowPhp > 0) {
    insights.push({
      tone: 'purple',
      title: `₱${remainingEscrowPhp.toLocaleString()} available to disburse`,
      detail: `${utilizationPct}% of mobilized aid is disbursed (${totalBeneficiaries.toLocaleString()} beneficiaries reached so far).`
    });
  }

  return {
    meta: {
      scope: 'ORGANIZATION',
      orgName: orgInfo.Org_Name || 'Accredited Organization',
      orgEmail: orgInfo.Username || '',
      verificationStatus: orgInfo.Verification_Status || 'Pending',
      range,
      rangeLabel: range === '7d' ? 'Last 7 Days' : range === '30d' ? 'Last 30 Days' : range === '90d' ? 'Last 90 Days' : 'All Time',
      generatedAt: new Date(nowMs).toISOString()
    },
    kpis: {
      totalMobilizedPhp: range === 'all' ? allTimeMobilizedPhp : periodMobilizedPhp,
      totalMobilizedEth: range === 'all' ? allTimeMobilizedEth : periodMobilizedEth,
      allTimeMobilizedPhp,
      allTimeMobilizedEth,
      periodDeltaPct,
      txCount: scopedTx.length,
      uniqueDonors: uniqueDonorSet.size,
      registeredBackers: supporterStats.registeredBackers,
      verifiedBackers: supporterStats.verifiedBackers,
      repeatBackers: supporterStats.repeatBackers,
      avgGiftPhp,
      anonymousSharePct,
      totalDisbursedPhp,
      remainingEscrowPhp,
      utilizationPct,
      totalBeneficiaries,
      activeCampaigns,
      concludedCampaigns,
      totalCampaigns: campaignPerf.length,
      avgFundingPct,
      pendingSlipsCount: verificationFunnel.pending,
      pendingSlipsPhp: verificationFunnel.pendingPhp,
      approvalRatePct: verificationFunnel.approvalRatePct,
      avgAiConfidence: verificationFunnel.avgAiConfidence
    },
    trendSeries,
    paymentRails,
    categoryBreakdown: categories,
    regionalBreakdown: regions,
    verificationFunnel,
    supporterStats,
    campaignPerformance: campaignPerf,
    disbursements: scopedDisb,
    topContributors,
    insights,
    ledgerRows: scopedTx.slice(0, 500)
  };
}

module.exports = {
  buildAdminAnalytics,
  buildOrganizationAnalytics
};
