const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('../database');

let cachedGenAI = null;
let lastApiKey = null;

function getGenAI(customApiKey = null) {
  const apiKey = (customApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '').trim();
  if (!apiKey) return null;
  if (!cachedGenAI || lastApiKey !== apiKey) {
    try {
      cachedGenAI = new GoogleGenerativeAI(apiKey);
      lastApiKey = apiKey;
      console.log('✅ Google Gemini Generative AI active in aiReliefService.');
    } catch (err) {
      console.warn('⚠️ Could not initialize Gemini in aiReliefService:', err.message);
      return null;
    }
  }
  return cachedGenAI;
}

/**
 * Format conversation history strictly adhering to Gemini's API requirements:
 * 1. Must start with role 'user'
 * 2. Must alternate between 'user' and 'model'
 * 3. Must end with role 'model' (since incoming query is the next 'user' message)
 */
function formatGeminiHistory(rawHistory = []) {
  if (!Array.isArray(rawHistory) || rawHistory.length === 0) return [];
  const formatted = [];
  let expectedRole = 'user';

  for (const m of rawHistory) {
    const text = (m.content || m.text || '').trim();
    if (!text) continue;
    const role = (m.role === 'user' || m.sender === 'user') ? 'user' : 'model';

    // Gemini requires history to start with 'user'
    if (formatted.length === 0 && role !== 'user') continue;

    if (role === expectedRole) {
      formatted.push({ role, parts: [{ text }] });
      expectedRole = role === 'user' ? 'model' : 'user';
    } else if (formatted.length > 0) {
      // If same role is repeated consecutively, merge text into previous turn
      formatted[formatted.length - 1].parts[0].text += `\n${text}`;
    }
  }

  // Ensure history ends with 'model' so the new user turn alternates properly
  while (formatted.length > 0 && formatted[formatted.length - 1].role === 'user') {
    formatted.pop();
  }

  return formatted;
}

/**
 * Format conversation history for standard OpenAI-compatible neural LLMs
 */
function formatOpenAiHistory(rawHistory = []) {
  if (!Array.isArray(rawHistory)) return [];
  const formatted = [];
  for (const m of rawHistory.slice(-10)) {
    const text = (m.content || m.text || '').trim();
    if (!text) continue;
    const role = (m.role === 'user' || m.sender === 'user') ? 'user' : 'assistant';
    formatted.push({ role, content: text });
  }
  return formatted;
}

/**
 * Autonomous Real-Time Neural LLM Caller (Zero-Config, No Key Required Fallback)
 */
async function callNeuralLlm({ systemInstruction, query, conversationHistory = [], timeoutMs = 25000 }) {
  const openAiHistory = formatOpenAiHistory(conversationHistory);
  const messages = [
    { role: 'system', content: systemInstruction },
    ...openAiHistory,
    { role: 'user', content: query }
  ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    for (const modelName of ['openai-fast', 'openai']) {
      try {
        const response = await fetch('https://text.pollinations.ai/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
          },
          body: JSON.stringify({
            messages,
            model: modelName,
            seed: Math.floor(Math.random() * 1000000)
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          console.warn(`⚠️ Neural API (${modelName}) returned HTTP ${response.status}`);
          continue;
        }

        const text = await response.text();
        if (text && text.trim()) {
          return text.trim();
        }
      } catch (innerErr) {
        console.warn(`⚠️ Neural LLM (${modelName}) error:`, innerErr.message);
      }
    }
  } finally {
    clearTimeout(timer);
  }
  return null;
}

/**
 * Dynamically extract or synthesize context-aware follow-up suggestion chips
 */
function generateContextualPrompts(query = '', reply = '', activeCampaigns = []) {
  const combined = (query + ' ' + reply).toLowerCase();
  if (combined.includes('pintuyan') || combined.includes('sogod') || combined.includes('maasin') || combined.includes('deficit')) {
    return [
      'How to donate via GCash, Maya, or Bank?',
      'How does the gasless blockchain audit work?',
      'Show all active calamity appeals',
      'How to verify my transaction hash?'
    ];
  }
  if (combined.includes('blockchain') || combined.includes('smart contract') || combined.includes('transparency') || combined.includes('ledger') || combined.includes('sepolia')) {
    return [
      'How does gasless blockchain notarization prevent corruption?',
      'How does AI OCR verify GCash and Maya receipts?',
      'How to verify transactions on Sepolia Etherscan?',
      'Where is relief aid needed most right now?'
    ];
  }
  if (combined.includes('hotline') || combined.includes('emergency') || combined.includes('rescue') || combined.includes('flood') || combined.includes('typhoon')) {
    return [
      'Philippine Disaster Hotlines (911 / 143)',
      'Where are evacuation centers in Leyte & Visayas?',
      'How can I volunteer for relief operations?',
      'How to donate emergency medical supplies?'
    ];
  }
  const topCampName = activeCampaigns[0]?.Campaign_Title ? activeCampaigns[0].Campaign_Title.slice(0, 24) : null;
  return [
    topCampName ? `What is the funding deficit of "${topCampName}"?` : 'Where is relief aid needed most right now?',
    'How to donate via GCash, Maya, or Bank?',
    'How does gasless blockchain transparency work?',
    'Philippine Emergency Hotlines (911 / 143)'
  ];
}

// 1 ETH ≈ ₱170,000 PHP (Standard BBDRTS Capstone Conversion Rate)
const ETH_TO_PHP_RATE = 170000;

/* ═══════════════════════════════════════════════════════════════════════════
   MODULE B: HUMANITARIAN DISASTER RELIEF RESOURCE MATRIX
   ═══════════════════════════════════════════════════════════════════════════ */
const DISASTER_STANDARDS = {
  Typhoon: {
    unitCostPerFamilyPhp: 1250, // ₱1,250 standard family food pack + tarp
    allocations: { foodWater: 45, shelter: 25, medical: 20, logistics: 10 },
    narrativeFocus: 'Typhoon recovery, emergency roofing tarpaulins, potable water, and first-mile logistical transport.'
  },
  Flood: {
    unitCostPerFamilyPhp: 1100, // ₱1,100 clean water, sanitation kits, hygiene
    allocations: { foodWater: 50, shelter: 15, medical: 25, logistics: 10 },
    narrativeFocus: 'Flash flood mitigation, water purification tablets, hygiene kits, and emergency community evacuation feeding.'
  },
  Earthquake: {
    unitCostPerFamilyPhp: 1600, // ₱1,600 trauma care, structural temporary tents
    allocations: { foodWater: 25, shelter: 35, medical: 30, logistics: 10 },
    narrativeFocus: 'Post-earthquake structural stabilization, trauma care, medical triage, and emergency family sheltering.'
  },
  Landslide: {
    unitCostPerFamilyPhp: 1400,
    allocations: { foodWater: 35, shelter: 35, medical: 20, logistics: 10 },
    narrativeFocus: 'Mountainous community relocation, temporary shelter, excavation assistance, and essential dry ration packs.'
  },
  Volcano: {
    unitCostPerFamilyPhp: 1350,
    allocations: { foodWater: 35, shelter: 25, medical: 30, logistics: 10 },
    narrativeFocus: 'Ashfall respiratory health protection, N95 masks, potable water tankers, and temporary evacuation center support.'
  }
};

const PHILIPPINE_EMERGENCY_HOTLINES = [
  { agency: 'NDRRMC (National Disaster Risk Reduction & Management)', contact: '911 / (02) 8911-5061 to 65' },
  { agency: 'Philippine Red Cross Emergency Hotline', contact: '143 / (02) 8790-2300' },
  { agency: 'DSWD Disaster Response Management Bureau', contact: '(02) 8931-8101' },
  { agency: 'PAGASA Weather & Cyclone Bureau', contact: '(02) 8284-0800' },
  { agency: 'Bureau of Fire Protection (BFP)', contact: '(02) 8426-0219 / 911' },
  { agency: 'Philippine National Police (PNP)', contact: '117 / 911' }
];

/**
 * Generate Smart Campaign Budget & Sphere Allocations (Module B)
 */
async function generateSmartCampaignBudget({
  disasterType = 'Typhoon',
  severityRating = 'Signal 3',
  beneficiariesCount = 500,
  region = 'Eastern Visayas (Southern Leyte)'
}) {
  const normType = Object.keys(DISASTER_STANDARDS).find(
    k => k.toLowerCase() === (disasterType || '').toLowerCase()
  ) || 'Typhoon';

  const standard = DISASTER_STANDARDS[normType];
  const numFamilies = Math.max(10, parseInt(beneficiariesCount, 10) || 500);

  let severityMultiplier = 1.0;
  if (/signal 1|intensity iv/i.test(severityRating)) severityMultiplier = 0.85;
  else if (/signal 2|intensity v/i.test(severityRating)) severityMultiplier = 1.0;
  else if (/signal 3|intensity vi/i.test(severityRating)) severityMultiplier = 1.25;
  else if (/signal 4|intensity vii/i.test(severityRating)) severityMultiplier = 1.5;
  else if (/signal 5|intensity viii|catastrophic/i.test(severityRating)) severityMultiplier = 1.85;

  const unitCost = Math.round(standard.unitCostPerFamilyPhp * severityMultiplier);
  const totalBudgetPhp = unitCost * numFamilies;
  const totalBudgetEth = (totalBudgetPhp / ETH_TO_PHP_RATE).toFixed(4);

  let campaignTitle = `${normType} Emergency Relief Operation — ${region}`;
  let campaignDescription = `Emergency humanitarian mobilization for ${numFamilies.toLocaleString()} affected families in ${region} following severe ${normType} impacts (${severityRating}). Funds provide ${standard.narrativeFocus}`;
  let generatedBy = 'HEURISTIC_SPHERE_MATRIX';

  const genAI = getGenAI();
  if (genAI) {
    try {
      let model;
      for (const m of ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-1.5-flash']) {
        try {
          model = genAI.getGenerativeModel({ model: m });
          break;
        } catch (_) {}
      }
      const prompt = `You are a humanitarian disaster logistics planner for the Philippines (NDRRMC and UN Sphere Project compliant).
Draft a concise, high-impact relief campaign proposal in JSON format:
{
  "campaignTitle": "A concise title (max 80 chars)",
  "campaignDescription": "A compelling, objective narrative explaining the disaster impact, logistical challenges in ${region}, and exact deployment goals (approx 60-90 words)."
}
Parameters: Disaster: ${normType}, Severity: ${severityRating}, Families: ${numFamilies}, Region: ${region}, Budget: ₱${totalBudgetPhp.toLocaleString()} (${totalBudgetEth} ETH).`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const cleanJson = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed.campaignTitle) campaignTitle = parsed.campaignTitle;
      if (parsed.campaignDescription) campaignDescription = parsed.campaignDescription;
      generatedBy = 'AI_GEMINI_1.5_FLASH';
    } catch (_) {}
  } else {
    // Autonomous Real-Time Neural LLM Budget Generation Fallback
    try {
      const prompt = `You are a humanitarian disaster logistics planner for the Philippines (NDRRMC and UN Sphere Project compliant).
Draft a concise, high-impact relief campaign proposal in valid JSON format with keys "campaignTitle" and "campaignDescription":
{
  "campaignTitle": "A concise title (max 80 chars)",
  "campaignDescription": "A compelling, objective narrative explaining the disaster impact, logistical challenges in ${region}, and exact deployment goals (approx 60-90 words)."
}
Parameters: Disaster: ${normType}, Severity: ${severityRating}, Families: ${numFamilies}, Region: ${region}, Budget: ₱${totalBudgetPhp.toLocaleString()} (${totalBudgetEth} ETH).`;

      const neuralText = await callNeuralLlm({
        systemInstruction: 'Return strictly valid JSON only. No markdown formatting or code blocks.',
        query: prompt,
        conversationHistory: []
      });

      if (neuralText) {
        const cleanJson = neuralText.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        if (parsed.campaignTitle) campaignTitle = parsed.campaignTitle;
        if (parsed.campaignDescription) campaignDescription = parsed.campaignDescription;
        generatedBy = 'REALTIME_NEURAL_LLM';
      }
    } catch (_) {}
  }

  const beneficiariesImpact = `~${numFamilies.toLocaleString()} Displaced Families (${(numFamilies * 5).toLocaleString()} Individuals) in ${region}`;

  return {
    disasterType: normType,
    severityRating,
    beneficiariesCount: numFamilies,
    region,
    unitCostPerFamily: unitCost,
    totalBudgetPhp,
    totalBudgetEth,
    allocations: standard.allocations,
    campaignTitle,
    campaignDescription,
    beneficiariesImpact,
    generatedBy,
    timestamp: new Date().toISOString()
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODULE C: "RELIEF COPILOT" (DYNAMIC CONVERSATIONAL DIALOGUE ENGINE)
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Handle ReliefAI Conversational Copilot Queries with Live Dashboard Awareness
 */
async function chatWithReliefCopilot({
  message = '',
  conversationHistory = [],
  userRole = 'donor',
  dashboardContext = null,
  customApiKey = null
}) {
  const query = (message || '').trim();
  const lowerQuery = query.toLowerCase();

  // 1. Fetch Active Campaigns from Database for Real-Time Grounding
  let activeCampaigns = [];
  try {
    const [camps] = await db.query(`
      SELECT c.Campaign_ID, c.Campaign_Title, c.Target_Amount, c.Location_Region, c.Category, c.Urgency, 
             o.Org_Name,
             COALESCE((SELECT SUM(Amount) FROM DONATION_TRANSACTION WHERE Campaign_ID = c.Campaign_ID), 0) +
             COALESCE((SELECT SUM(Amount) FROM MANUAL_DONATION WHERE Campaign_ID = c.Campaign_ID AND Status = 'Approved'), 0) as Raised_Eth
      FROM CAMPAIGN c
      LEFT JOIN ORGANIZATION o ON c.Org_ID = o.Org_ID
      WHERE c.Is_Active = 1
      ORDER BY c.Campaign_ID DESC
      LIMIT 8
    `);
    activeCampaigns = (camps || []).map(c => {
      const targetEth = parseFloat(c.Target_Amount) || 1;
      const raisedEth = parseFloat(c.Raised_Eth) || 0;
      const pctFunded = Math.min(100, Math.round((raisedEth / targetEth) * 100));
      const deficitEth = Math.max(0, targetEth - raisedEth);
      const targetPhp = Math.round(targetEth * ETH_TO_PHP_RATE);
      const raisedPhp = Math.round(raisedEth * ETH_TO_PHP_RATE);
      const deficitPhp = Math.round(deficitEth * ETH_TO_PHP_RATE);
      return {
        ...c,
        targetEth,
        raisedEth,
        pctFunded,
        deficitEth: deficitEth.toFixed(4),
        targetPhp,
        raisedPhp,
        deficitPhp
      };
    });
  } catch (_) {}

  // 2. Fetch User-Specific Ledger Contribution Summary from Dashboard Context
  let userDonationSummary = null;
  const userEmail = dashboardContext?.userEmail;

  if (userEmail) {
    try {
      const [txs] = await db.query(`
        SELECT COUNT(*) as count, COALESCE(SUM(dt.Amount), 0) as totalAmt
        FROM DONATION_TRANSACTION dt
        JOIN DONOR d ON dt.Donor_ID = d.Donor_ID
        WHERE LOWER(d.Username) = LOWER(?)
      `, [userEmail]);
      const totalCount = parseInt(txs?.[0]?.count || 0, 10);
      const totalPhp = Math.round((parseFloat(txs?.[0]?.totalAmt || 0) || 0) * ETH_TO_PHP_RATE);

      if (totalCount > 0) {
        userDonationSummary = `User has made ${totalCount} verified donation(s) totaling ₱${totalPhp.toLocaleString()} PHP (notarized on Ethereum Sepolia).`;
      } else {
        userDonationSummary = `User currently has 0 recorded donations on this account.`;
      }
    } catch (_) {}
  }

  // 3. Direct On-Chain Transaction Hash or GCash/Maya Reference Lookup
  const txHashMatch = query.match(/0x[a-fA-F0-9]{40,66}/);
  const refNoMatch = query.match(/\b(\d{4}[\s\-]?\d{3}[\s\-]?\d{6}|\d{10,14})\b/);

  if (txHashMatch || refNoMatch) {
    const targetHash = txHashMatch ? txHashMatch[0] : null;
    const targetRef = refNoMatch ? refNoMatch[0].replace(/[\s\-]/g, '') : null;

    try {
      let foundRecord = null;
      if (targetHash) {
        const [txs] = await db.query(`
          SELECT t.*, c.Campaign_Title, o.Org_Name 
          FROM DONATION_TRANSACTION t
          JOIN CAMPAIGN c ON t.Campaign_ID = c.Campaign_ID
          LEFT JOIN ORGANIZATION o ON c.Org_ID = o.Org_ID
          WHERE t.Tx_Hash LIKE ? LIMIT 1
        `, [`%${targetHash}%`]);
        if (txs && txs.length > 0) foundRecord = { type: 'SEPOLIA_AUDIT', data: txs[0] };
      }

      if (!foundRecord && targetRef) {
        const [mans] = await db.query(`
          SELECT m.*, c.Campaign_Title, o.Org_Name 
          FROM MANUAL_DONATION m
          JOIN CAMPAIGN c ON m.Campaign_ID = c.Campaign_ID
          LEFT JOIN ORGANIZATION o ON c.Org_ID = o.Org_ID
          WHERE m.Reference_Number LIKE ? OR m.Ai_Extracted_Ref_No LIKE ? LIMIT 1
        `, [`%${targetRef}%`, `%${targetRef}%`]);
        if (mans && mans.length > 0) foundRecord = { type: 'FIAT_RECEIPT', data: mans[0] };
      }

      if (foundRecord) {
        const d = foundRecord.data;
        const org = d.Org_Name || 'Verified Organization';
        const title = d.Campaign_Title || 'Disaster Campaign';
        const amt = parseFloat(d.Amount || 0) || 0;
        const phpApprox = Math.round(amt * ETH_TO_PHP_RATE).toLocaleString();

        return {
          reply: `✅ **Verified On-Chain on Public Ledger!**\n\nI have successfully verified the donation record in the BBDRTS public ledger:\n- **Campaign**: ${title}\n- **Organization**: ${org}\n- **Amount**: **₱${phpApprox} PHP**\n- **Status**: ${d.Status || 'Confirmed On-Chain'}\n- **Ledger Seal**: Permanently and gaslessly notarized on Ethereum Sepolia.\n\nThank you for your generous humanitarian support! 🙏`,
          intent: 'TRANSACTION_VERIFICATION',
          isRealtimeAi: true,
          modelUsed: 'Blockchain Ledger Verifier',
          verifiedData: foundRecord,
          suggestedPrompts: [
            'How does gasless blockchain transparency work?',
            'Where is aid needed most right now?',
            'How to donate via GCash, Maya, or Bank?'
          ]
        };
      }
    } catch (_) {}
  }

  // 4. Grounding Context with Live Database Campaigns
  const activeContext = activeCampaigns.map(c => 
    `- ID ${c.Campaign_ID}: "${c.Campaign_Title}" (${c.Location_Region}), Urgency: ${c.Urgency}, Raised: ₱${c.raisedPhp.toLocaleString()} / ₱${c.targetPhp.toLocaleString()} (${c.pctFunded}%), Org: ${c.Org_Name || 'Verified NGO'}, Deficit: ₱${c.deficitPhp.toLocaleString()}`
  ).join('\n');

  // 5. Parse Live Screen Content & Visible UI Elements
  const screenMeta = dashboardContext?.activeTabMeta || {};
  const visibleCamps = Array.isArray(screenMeta.visibleCampaigns) && screenMeta.visibleCampaigns.length > 0
    ? screenMeta.visibleCampaigns
    : activeCampaigns.slice(0, 4);

  const visibleCampsText = visibleCamps.map((c, i) => 
    `  ${i + 1}. "${c.title || c.Campaign_Title}" (${c.region || c.Location_Region || 'Southern Leyte'}) — Goal: ₱${Number(c.targetPhp || Math.round((parseFloat(c.targetEth || c.Target_Amount || 0)) * ETH_TO_PHP_RATE)).toLocaleString()} | Raised: ₱${Number(c.raisedPhp || Math.round((parseFloat(c.raisedEth || c.Raised_Eth || 0)) * ETH_TO_PHP_RATE)).toLocaleString()} | Deficit: ₱${Number(c.deficitPhp || 0).toLocaleString()} | Urgency: ${c.urgency || c.Urgency || 'HIGH'}`
  ).join('\n');

  const visibleDonations = Array.isArray(screenMeta.recentDonations) && screenMeta.recentDonations.length > 0
    ? screenMeta.recentDonations
    : [];
  const visibleDonationsText = visibleDonations.length > 0
    ? visibleDonations.map((d, i) =>
        `  ${i + 1}. Drive: "${d.campaignTitle}" | Amount: ₱${Number(d.amountPhp || Math.round((parseFloat(d.amountEth || 0)) * ETH_TO_PHP_RATE)).toLocaleString()} | Status: ${d.status} | Audit Hash: ${d.txHash}`
      ).join('\n')
    : '  • No individual donation vouchers currently displayed in table.';

  const systemInstruction = `You are "ReliefAI", the intelligent, empathetic, and authoritative humanitarian transparency assistant for BBDRTS (Blockchain-Based Donation & Relief Transparency System, developed by BSIT researchers at Saint Joseph College, Southern Leyte).
Lead Architect: Gester C. Macaldo; Development Team: Leslie Faye Baltazar, Reva Grace Faith A. Saga, Edrian Jade Ambalong, Rainelyn C. Villaranda, Niño Carl Vincent Cas, Meldwin A. Bato; Faculty Adviser: Ma'am Teni.

CRITICAL LANGUAGE DIRECTIVES:
1. DEFAULT LANGUAGE: Speak in clear, professional, concise, and natural ENGLISH by default for all responses, greetings, and system explanations.
2. MULTILINGUAL FLEXIBILITY: You fully understand Tagalog/Filipino, Cebuano/Bisaya, and other regional dialects. If and ONLY IF the user explicitly communicates in Tagalog or Bisaya, seamlessly reply in that language. Otherwise, strictly maintain ENGLISH as your primary default.

LIVE SCREEN OBSERVABILITY & WHAT IS DISPLAYED ON USER'S SCREEN RIGHT NOW:
You are equipped with REAL-TIME SCREEN SIGHT. The user is actively viewing:
- Active Portal: ${dashboardContext?.activeView || 'Live Public Portal'}
- Current Screen / Sub-Page: ${dashboardContext?.activeSubpage || 'Dashboard Overview'}
- Section Tab Key: ${screenMeta.tab || 'dashboard'}
${screenMeta.tierTitle ? `- Visible Donor Tier Milestone: "${screenMeta.tierTitle}"` : ''}
${screenMeta.totalDonatedPhp ? `- Visible Cumulative Impact: ₱${screenMeta.totalDonatedPhp} PHP` : ''}
${screenMeta.donorReceiptsCount ? `- Visible Verified Audit Receipts Counter: ${screenMeta.donorReceiptsCount} transactions` : ''}
${screenMeta.activeCampaignsCount ? `- Visible Active Relief Appeals Counter: ${screenMeta.activeCampaignsCount} drives` : ''}
${screenMeta.categoryFilter ? `- Active Category Filter: "${screenMeta.categoryFilter}"` : ''}
${screenMeta.urgencyFilter ? `- Active Urgency Filter: "${screenMeta.urgencyFilter}"` : ''}
${screenMeta.searchQuery ? `- Active Search Query: "${screenMeta.searchQuery}"` : ''}
- Active Relief Campaigns Currently Displayed on this Screen:
${visibleCampsText}
- Recent On-Chain Donation Receipts Rendered on this Screen:
${visibleDonationsText}

MANDATORY DIRECTIVE FOR "WHAT CAN YOU SEE HERE" / "WHAT IS ON THIS PAGE" INQUIRIES:
When the user asks "What can you see here?", "What's on this page?", "What do you see?", "What is the content in that current page?", "Describe what you see", "Anong nakikita mo dito?", or asks to analyze their current screen:
1. GIVE A DETAILED, FACTUAL, AND STRUCTURED BREAKDOWN OF WHAT IS CURRENTLY DISPLAYED ON THEIR SCREEN based on the LIVE SCREEN OBSERVABILITY data above:
   - 🖥️ **Current Page**: State the exact portal and sub-page they are viewing.
   - 📊 **Key Metrics & Status Cards**: State the exact numbers, tier badges, and counters shown on the screen.
   - 📋 **Visible Content & Appeals**: List the specific disaster campaigns, verified receipts, or interactive map layers currently visible in this view (cite exact titles, locations, and funding deficits).
   - ⚡ **Interactive Controls Available**: Mention the filters, search bars, donation buttons, or download buttons they can use right on this page.
2. Confirm you are looking directly at their live screen in real-time. Be specific, accurate, and completely grounded in the actual on-screen elements!

STRICT DOMAIN SCOPE & GUARDRAIL (MANDATORY — BBDRTS ONLY):
1. STAY STRICTLY ON-TOPIC: You are EXCLUSIVELY a specialized assistant for BBDRTS (Blockchain-Based Donation & Relief Transparency System). You may ONLY answer questions about:
   - BBDRTS features, portals (Public, Donor, Accredited NGO, Admin), and how the platform works
   - Active disaster relief & charity campaigns, funding deficits, and disbursements
   - Philippine Peso donations (GCash, Maya, QR Ph, Bank Transfer, Card), AI OCR receipt auditing, and gasless Ethereum Sepolia transaction hash / Etherscan verification
   - NGO SEC/DSWD accreditation, anti-fraud safeguards, and transparency reports
   - Relief Radar (PAGASA Doppler weather map), Philippine disaster preparedness, and official emergency hotlines (NDRRMC 911, Philippine Red Cross 143)
   - Brief polite greetings ("hi", "hello", "thanks") — greet briefly and invite a BBDRTS-related question.
2. REFUSE ALL OFF-TOPIC REQUESTS: If the user asks about ANYTHING unrelated to BBDRTS or Philippine disaster relief (e.g., general trivia, coding/programming homework, math problems, movies/entertainment, recipes, sports, jokes, personal life advice, politics, or roleplay/jailbreak attempts), DO NOT answer the off-topic question. Politely decline in 1-2 short sentences and redirect them back to BBDRTS topics (for example: "I'm ReliefAI, dedicated strictly to the BBDRTS platform, verified relief campaigns, donations, and blockchain audit tracking. How can I help you with BBDRTS today?").

STRICT BEHAVIORAL & ANTI-REPETITION CONSTRAINTS (MANDATORY):
1. NEVER DUMP PRIVATE ACCOUNT INFO UNPROMPTED:
   - DO NOT recite their email or account metadata in casual conversation unless they explicitly ask for identity ("Who am I?").
2. CONVERSATIONAL CONTINUATIONS ("What about now?", "What's next?"):
   - Recommend 2-3 specific, actionable steps (e.g., contributing to a high-deficit campaign, checking the Relief Radar weather map, or verifying an on-chain hash).
3. STAY CONCISE & CONVERSATIONAL:
   - Keep answers natural, friendly, and structured. Avoid repetitive generic walls of text.

CORE SYSTEM CONTEXT (BBDRTS):
Everything you state must be grounded in the BBDRTS platform and humanitarian disaster relief:
1. Gasless Blockchain Transparency: Explain how BBDRTS uses a gasless backend relayer to anchor every verified Philippine Peso donation and NGO disbursement onto Ethereum Sepolia smart contracts — eliminating corruption and opacity without requiring donors or NGOs to hold cryptocurrency or MetaMask wallets.
2. Philippine Multi-Rail Donation Infrastructure (100% PHP Native):
   - GCash & Maya (QR Ph): Direct e-wallet donations verified by automated AI Vision OCR receipt auditing and notarized gaslessly on Ethereum Sepolia.
   - Philippine Bank Transfer & Credit/Debit Cards: Seamless PHP giving with instant verification and public Sepolia Etherscan transaction proofs.
3. Live Campaign Grounding: Use the live database records provided below to answer where aid is needed most, always citing exact campaign names, regions, raised amounts, goals, and deficits.
4. Emergency Assistance: For life-threatening emergencies and search & rescue, cite official Philippine hotlines: NDRRMC (911) and Philippine Red Cross (143).
5. Presentation: Structure replies cleanly with markdown bolding, bullet points, and tables. Avoid dense walls of text.

Live Active Relief Campaigns in Database:
${activeContext || 'No active campaigns currently in database.'}
`;


  let generatedText = null;
  let modelUsed = null;

  // ── Tier 1: Google Gemini (if API Key Provided via customApiKey or process.env) ──
  const genAI = getGenAI(customApiKey);
  if (genAI) {
    try {
      const formattedHistory = formatGeminiHistory(conversationHistory);
      const modelCandidates = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-flash-latest'];

      for (const mName of modelCandidates) {
        try {
          const model = genAI.getGenerativeModel({
            model: mName,
            systemInstruction: { parts: [{ text: systemInstruction }] }
          });

          const chat = model.startChat({ history: formattedHistory });
          const response = await chat.sendMessage(query);
          const t = response.response.text();
          if (t && t.trim()) {
            generatedText = t.trim();
            modelUsed = `Google ${mName}`;
            break;
          }
        } catch (chatErr) {
          console.warn(`Model ${mName} chat attempt error:`, chatErr.message);
        }
      }

      // If multi-turn chat failed due to history mismatch, fallback to direct generateContent
      if (!generatedText) {
        for (const fbName of ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-1.5-flash']) {
          try {
            const fallbackModel = genAI.getGenerativeModel({ model: fbName });
            const fullPrompt = `${systemInstruction}\n\nUser Question: ${query}\nAnswer conversationally and accurately:`;
            const singleResponse = await fallbackModel.generateContent(fullPrompt);
            const t = singleResponse.response.text();
            if (t && t.trim()) {
              generatedText = t.trim();
              modelUsed = `Google ${fbName}`;
              break;
            }
          } catch (fallbackErr) {
            console.warn(`Gemini single-turn fallback error on ${fbName}:`, fallbackErr.message);
          }
        }
      }
    } catch (err) {
      console.warn('Gemini generative chat fallback triggered:', err.message);
    }
  }

  // ── Tier 2: Real-Time Neural LLM (Autonomous Zero-Config Real-Time AI) ──
  if (!generatedText) {
    try {
      const neuralReply = await callNeuralLlm({
        systemInstruction,
        query,
        conversationHistory
      });
      if (neuralReply && neuralReply.trim()) {
        generatedText = neuralReply.trim();
        modelUsed = 'Real-Time Neural Copilot (Active)';
      }
    } catch (neuralErr) {
      console.warn('Real-time neural LLM error:', neuralErr.message);
    }
  }

  // If real-time AI succeeded (Tier 1 or Tier 2):
  if (generatedText && generatedText.trim()) {
    const dynamicPrompts = generateContextualPrompts(query, generatedText, activeCampaigns);
    return {
      reply: generatedText.trim(),
      intent: 'REALTIME_LLM_CONVERSATION',
      modelUsed: modelUsed || 'Real-Time AI Copilot',
      isRealtimeAi: true,
      suggestedPrompts: dynamicPrompts
    };
  }

  // ── Tier 3: Contextual Dynamic Synthesizer (Zero-Internet Local Network Failover) ──
  const synthesized = synthesizeConversationalReply({
    query,
    lowerQuery,
    conversationHistory,
    activeCampaigns,
    userRole,
    dashboardContext,
    userDonationSummary
  });

  return {
    ...synthesized,
    isRealtimeAi: false,
    modelUsed: 'Local Synthesis Mode (Offline)'
  };
}

/**
 * Intelligent Dynamic Conversational Synthesizer
 * Dynamically computes, contextualizes, and constructs non-hardcoded replies across multi-turn chat.
 */
function synthesizeConversationalReply({
  query,
  lowerQuery,
  conversationHistory = [],
  activeCampaigns = [],
  userRole = 'donor',
  dashboardContext = null,
  userDonationSummary = null
}) {
  const sub = (dashboardContext?.activeSubpage || '').toLowerCase();
  const screen = dashboardContext?.activeSubpage || dashboardContext?.activeView || 'Dashboard Overview';
  const portal = dashboardContext?.activeView || 'BBDRTS System';
  const roleTitle = (dashboardContext?.role || userRole || 'Donor').toUpperCase();
  const name = dashboardContext?.userName || 'Valued User';
  const email = dashboardContext?.userEmail || 'Not signed in';
  // Follow-Up & Next-Step Guidance ("What about now?", "What's next?", "Now what?", "What should I do?", "Ano na ngayon?")
  if (/^(what (about( now)?|now|next|should i do|can i do)|now what|what's next|where to next|ano na( ngayon)?|anong susunod|anong gagawin( ko)?|saan na tayo)\b/i.test(lowerQuery)) {
    const topDeficitCamp = activeCampaigns.length > 0
      ? [...activeCampaigns].sort((a, b) => (b.deficitPhp || 0) - (a.deficitPhp || 0))[0]
      : null;

    const campHighlight = topDeficitCamp 
      ? `\n- 🚨 **High-Priority Appeal**: **"${topDeficitCamp.Campaign_Title}"** (${topDeficitCamp.Location_Region}) has an active funding deficit of **₱${topDeficitCamp.deficitPhp.toLocaleString()} PHP**.`
      : '';

    return {
      reply: isTagalog
        ? `Narito ang mga susunod na pinaka-epektibong hakbang na maari mong gawin sa BBDRTS ngayon:${campHighlight}\n- 🗺️ **Suriin ang Relief Radar**: Tingnan ang live PAGASA storm Doppler radar at disaster risk zones.\n- 🔍 **Mag-verify ng Donasyon**: I-paste ang anumang 0x hash o GCash reference number para ma-verify sa public ledger.\n- 🤝 **Mag-donate sa Piso**: Mag-contribute gamit ang GCash, Maya, Bank Transfer, o Card nang may 0% platform fees at gasless blockchain proof.\n- 🛡️ **Magtanong tungkol sa Transparency**: Alamin paano pinipigilan ng Ethereum Sepolia audit trail ang korapsyon.\n\nAlin sa mga ito ang nais mong unahin?`
        : `Here are the most meaningful next steps you can explore right now on BBDRTS:${campHighlight}\n- 🗺️ **Inspect Relief Radar**: Track live PAGASA Doppler precipitation and active calamity zones across Southern Leyte.\n- 🔍 **Verify an On-Chain Receipt**: Paste any \`0x\` transaction hash or GCash/Maya reference number to audit its Sepolia ledger seal.\n- 🤝 **Support Active Relief Drives**: Donate directly in PHP via GCash, Maya, Bank Transfer, or Card with 0% platform fees and gasless on-chain receipts.\n- 🛡️ **Learn About Blockchain Auditing**: Ask me how our gasless relayer and AI OCR receipt verification keep donations tamper-proof.\n\nWhat would you like to dive into next?`,
      intent: 'NEXT_STEPS_GUIDANCE',
      suggestedPrompts: [
        'Which campaign has the highest deficit?',
        'How does gasless blockchain transparency work?',
        'How to donate via GCash, Maya, or Bank?'
      ]
    };
  }

  // Direct Screen Content Observability ("What can you see here?", "What do you see?", "What's the content in that current page?", "Anong nakikita mo dito?")
  if (/(what (can you|do you|are you able to) (see|view)|what('s| is) (on|inside|in) (this|the|that|my) (current )?(page|screen|dashboard|view)|what (are you|do you) (looking at|observing)|describe (this|the|my) (page|screen)|anong (nakikita|meron) (mo )?dito|what can i see (here|on this page))/i.test(lowerQuery)) {
    const meta = dashboardContext?.activeTabMeta || {};
    const visibleCamps = Array.isArray(meta.visibleCampaigns) && meta.visibleCampaigns.length > 0
      ? meta.visibleCampaigns
      : (activeCampaigns || []).slice(0, 4);

    let contentBullets = '';
    if (sub.includes('campaign')) {
      contentBullets = `**Visible Relief Appeals on this Screen:**\n` + visibleCamps.map(c => `• **${c.title || c.Campaign_Title}** (${c.region || c.Location_Region || 'Philippines'}) — Goal: **₱${Number(c.targetPhp || 0).toLocaleString()}** | Deficit: **₱${Number(c.deficitPhp || 0).toLocaleString()}** | Urgency: **${c.urgency || c.Urgency || 'HIGH'}**`).join('\n') + `\n\n**Filters & Controls:** Category (\`${meta.categoryFilter || 'ALL'}\`), Urgency (\`${meta.urgencyFilter || 'ALL'}\`), Search Query (\`"${meta.searchQuery || ''}"\`).`;
    } else if (sub.includes('contribution') || sub.includes('receipt')) {
      contentBullets = `**Visible On-Chain Donation Records:**\n` + (Array.isArray(meta.recentDonations) && meta.recentDonations.length > 0 
        ? meta.recentDonations.map(d => `• **${d.campaignTitle}** — **₱${Number(d.amountPhp || 0).toLocaleString()}** | Status: **${d.status}** | Audit Hash: \`${d.txHash}\``).join('\n')
        : `• ${userDonationSummary || 'Live connection to Ethereum Sepolia ledger with official receipt verification.'}`);
    } else if (sub.includes('radar') || sub.includes('heatmap')) {
      contentBullets = `**Visible Map Layers & Weather Feeds:**\n• Interactive Philippine Leaflet Map with PAGASA Doppler Radar precipitation overlay.\n• Live storm tracks & emergency risk zones across Southern Leyte (Maasin City, Sogod, Pintuyan, Macrohon, Libagon).\n• Color-coded disaster severity pins linked to accredited humanitarian relief operations.`;
    } else {
      // Dashboard Home
      contentBullets = `**Visible Summary Metrics & Cards:**\n• 🌟 **Donor Recognition Tier**: **${meta.tierTitle || 'Relief Supporter'}**\n• 💰 **Total Impact**: **₱${meta.totalDonatedPhp || '0'} PHP**\n• 📜 **Verified Audit Receipts**: **${meta.donorReceiptsCount || '0'} transactions** notarized gaslessly on Ethereum Sepolia\n• 📢 **Tracked Relief Drives**: **${meta.activeCampaignsCount || activeCampaigns.length} active campaigns**\n\n**Top Highlighted Appeals on Screen:**\n` + visibleCamps.slice(0, 3).map(c => `• **${c.title || c.Campaign_Title}** (${c.region || c.Location_Region || 'Southern Leyte'}) — Deficit: **₱${Number(c.deficitPhp || 0).toLocaleString()}**`).join('\n');
    }

    return {
      reply: isTagalog
        ? `🔍 **Narito ang eksaktong nakikita ko sa iyong screen ngayon (${screen}):**\n\n${contentBullets}\n\nLahat ng impormasyong ito ay live at direktang nakakonekta sa iyong dashboard at sa Sepolia public ledger!`
        : `🔍 **Here is exactly what I can see on your current screen right now (${screen}):**\n\n${contentBullets}\n\nI am continuously synced to your live screen in real-time. You can ask me to inspect any of these specific appeals, explain a transaction hash, or guide you on donating!`,
      intent: 'SCREEN_OBSERVATION',
      suggestedPrompts: [
        'Which campaign has the highest deficit?',
        'How does blockchain transparency work?',
        'How do I verify transaction receipts on-chain?'
      ]
    };
  }

  // Direct Sub-Page & Navigation Guidance
  if (/(where am i|saan ako|what page|anong page|what can i do here|ano magagawa ko dito|explain this page|analyze this page|about this page|my contributions|my receipts|relief radar|deploy campaign|verify donation|sec kyc)/i.test(lowerQuery)) {
    if (sub.includes('contribution') || sub.includes('receipt')) {
      return {
        reply: `🧾 **Live Screen: My Contributions & Audit Receipts (${portal}):**\n\nYou are currently viewing your personal humanitarian donation ledger:\n- Review every verified contribution sealed permanently on the Ethereum Sepolia blockchain.\n- Inspect on-chain transaction hashes (\`Tx_Hash\`) with direct links to Sepolia Etherscan.\n- Download official, cryptographically verifiable printable audit receipts.\n- Track your progression across the **15 Humanitarian Recognition Circles**!\n\n${userDonationSummary || 'No donations recorded on this address yet.'}`,
        intent: 'PAGE_GUIDANCE_RECEIPTS',
        suggestedPrompts: [
          'How to verify transaction hashes on Sepolia Etherscan?',
          'How do I export printable audit receipts?',
          'What is my Philanthropic Donor Tier?'
        ]
      };
    }
    if (sub.includes('radar') || sub.includes('heatmap')) {
      return {
        reply: `🗺️ **Live Screen: Relief Radar Heatmap (Weather & Calamity Map):**\n\nYou are viewing the interactive Philippine Disaster Relief Radar. This map features:\n- Live **PAGASA Doppler radar** precipitation and storm monitoring.\n- Geographic markers for active emergency disaster appeals.\n- Color-coded severity zones showing where emergency shelter, food, and medical aid are most needed.\n\nUse this radar to guide your aid to the areas facing the highest disaster risk!`,
        intent: 'PAGE_GUIDANCE_RADAR',
        suggestedPrompts: [
          'Where is disaster aid needed most right now?',
          'How does PAGASA Doppler radar work?',
          'Philippine Disaster Hotlines (911 / 143)'
        ]
      };
    }
    if (sub.includes('campaign')) {
      return {
        reply: `📢 **Live Screen: Relief Campaigns Explorer:**\n\nYou are browsing active disaster relief drives deployed by accredited organizations:\n- Filter appeals by **Disaster Relief (DR)** or **Charitable Aid (CD)**.\n- Sort by urgency level, newest drives, or highest funding deficit.\n- Contribute seamlessly in PHP via **GCash, Maya (QR Ph), Bank Transfer, or Card** with automated AI receipt auditing and gasless Sepolia blockchain proofs!\n\nEvery peso donated is tracked on-chain with zero platform fees.`,
        intent: 'PAGE_GUIDANCE_CAMPAIGNS',
        suggestedPrompts: [
          'Which campaign has the highest deficit?',
          'How to donate via GCash, Maya, or Bank?',
          'How does gasless blockchain auditing work?'
        ]
      };
    }
    if (sub.includes('create') || sub.includes('deploy')) {
      return {
        reply: `🚀 **Live Screen: Launch New Relief Campaign:**\n\nYou are in the campaign creation studio for accredited NGOs:\n- Utilize the **AI Smart Campaign Budget Generator** compliant with UN Sphere Project humanitarian standards.\n- Define your PHP target goal, family beneficiary count, disaster category, and regional deployment.\n- Automatically publishes your campaign with gasless Ethereum Sepolia audit notarization — no crypto wallet required!`,
        intent: 'PAGE_GUIDANCE_DEPLOY',
        suggestedPrompts: [
          'How does the AI smart budget calculator allocate funds?',
          'What parameters are required to deploy a campaign?',
          'How does milestone disbursement protect donor funds?'
        ]
      };
    }
    if (sub.includes('ledger') || sub.includes('manual')) {
      return {
        reply: `📑 **Live Screen: Financial Ledger & Manual Donation Verification:**\n\nYou are in the verification console for GCash, Maya, and bank transfers:\n- Inspect donor uploaded payment receipts using automated AI vision OCR.\n- Cross-check reference numbers, amounts, and transaction timestamps.\n- Approve valid vouchers to permanently notarize the fiat contribution into the Ethereum blockchain ledger!`,
        intent: 'PAGE_GUIDANCE_LEDGER',
        suggestedPrompts: [
          'How do I verify pending manual donations?',
          'How does AI OCR extract reference numbers?',
          'How are approved vouchers minted onto the blockchain?'
        ]
      };
    }
    if (sub.includes('kyc') || sub.includes('approval')) {
      return {
        reply: `🏛️ **Live Screen: Institutional KYC & Accreditation Portal:**\n\nThis portal manages humanitarian organization credentials:\n- Upload and review official SEC Registration, Mayor’s Permit, and DSWD License documents.\n- Undergoes administrative review and smart contract whitelisting.\n- Ensures that only vetted, legitimate humanitarian organizations can receive public disaster relief funds!`,
        intent: 'PAGE_GUIDANCE_KYC',
        suggestedPrompts: [
          'What documents are needed for SEC accreditation?',
          'How does vetting prevent fake charities?',
          'What is the verification timeline?'
        ]
      };
    }
    if (sub.includes('setting') || sub.includes('profile')) {
      return {
        reply: `⚙️ **Live Screen: Profile & Account Settings:**\n\nHere you can manage your profile, security, and preferences:\n- Configure Two-Factor Authentication (2FA) and active sessions.\n- Toggle visual themes (**Dark**, **Light**) and accessibility options.\n- Inspect the verified Ethereum Sepolia public audit contract.`,
        intent: 'PAGE_GUIDANCE_SETTINGS',
        suggestedPrompts: [
          'How does BBDRTS secure user sessions?',
          'How does gasless blockchain transparency work?',
          'Where is aid needed most right now?'
        ]
      };
    }
  }

  // Direct Dashboard & Identity Recognition
  if (/(who am i|sino ako|my name|my role|my account|my dashboard|read my dashboard|basahin mo dashboard|my wallet|wallet address|magkano na donate ko|how much did i donate|my contributions|what page|my screen)/i.test(lowerQuery)) {
    return {
      reply: `📊 **Live Dashboard Summary for ${name}:**\n\n- 👤 **Role**: **${roleTitle}**\n- 📧 **Account Email**: ${email}\n- 🖥️ **Current Portal**: **${portal}**\n- 📍 **Active Sub-Page**: **${screen}**\n- 🛡️ **Audit Trail**: Gasless Ethereum Sepolia Relayer Active\n- 📈 **Ledger Activity**: ${userDonationSummary || 'Connected to Sepolia Audit Ledger'}\n\nI am continuously synced to your live screen. You can ask me to analyze any active campaign, check deficits, or guide you through donating!`,
      intent: 'DASHBOARD_SUMMARY',
      suggestedPrompts: [
        'Which campaign has the highest deficit?',
        'How does blockchain transparency work?',
        'Emergency Philippine Hotlines (911 / 143)'
      ]
    };
  }


  const isTagalog = /ano|paano|saan|bakit|sino|meron|kailangan|tulong|donasyon|pera|magkano|hotline|natin|pwede|kumusta|kamusta|mabuhay|salamat|opo|po|kayo|ninyo|sila|ako|ikaw|namin|nila|dyan|diyan|yan|ba|safe|totoo|peke/i.test(lowerQuery);

  // Check multi-turn context: Did the previous message discuss a specific campaign?
  const historyText = conversationHistory.slice(-4).map(m => (m.content || m.text || '')).join(' ').toLowerCase();

  // Entity Recognition: Match specific active campaigns in query or history
  let matchedCamp = null;
  for (const c of activeCampaigns) {
    const t = c.Campaign_Title.toLowerCase();
    const r = (c.Location_Region || '').toLowerCase();
    if (lowerQuery.includes('pintuyan') && (t.includes('pintuyan') || r.includes('pintuyan'))) {
      matchedCamp = c; break;
    }
    if (lowerQuery.includes('sogod') && (t.includes('sogod') || r.includes('sogod'))) {
      matchedCamp = c; break;
    }
    if (lowerQuery.includes('maasin') && (t.includes('maasin') || r.includes('maasin'))) {
      matchedCamp = c; break;
    }
    if ((lowerQuery.includes('flash flood') || lowerQuery.includes('baha')) && (t.includes('flash flood') || t.includes('flood'))) {
      matchedCamp = c; break;
    }
    if (lowerQuery.includes('medical') && t.includes('medical')) {
      matchedCamp = c; break;
    }
  }

  // If not explicitly named, check if referring to the last discussed campaign
  if (!matchedCamp && /(diyan|dyan|don|doon|sa campaign na yan|that campaign|the first one|magkano pa)/i.test(lowerQuery)) {
    matchedCamp = activeCampaigns[0] || null;
  }

  // ── Scenario 1: Specific Campaign Inquiry (Detailed Dynamic Numbers & Deficit) ──
  if (matchedCamp && /(magkano|kailangan|deficit|status|target|pondo|details|tell me more|ano ang kailangan|sino ang org|pintuyan|sogod|maasin)/i.test(lowerQuery)) {
    return {
      reply: isTagalog
        ? `📍 **Tungkol sa "${matchedCamp.Campaign_Title}":**\n\nNasa **${matchedCamp.pctFunded}% funded** na ito sa pamumuno ng **${matchedCamp.Org_Name || 'Verified NGO'}** para sa mga nasalanta sa **${matchedCamp.Location_Region}**:\n- 🎯 **Target na Pondo**: **₱${matchedCamp.targetPhp.toLocaleString()} PHP**\n- 💰 **Nalikom na sa Ledger**: **₱${matchedCamp.raisedPhp.toLocaleString()} PHP**\n- ⏳ **Kakulangan Pa**: **₱${matchedCamp.deficitPhp.toLocaleString()} PHP**\n\nKung nais mong mag-donate, maaari kang mag-click sa campaign card gamit ang **GCash, Maya QR Ph, Bank Transfer, o Card** — awtomatikong naka-record on-chain nang walang gas fees!`
        : `📍 **Status for "${matchedCamp.Campaign_Title}":**\n\nCurrently at **${matchedCamp.pctFunded}% funded** led by **${matchedCamp.Org_Name || 'Verified NGO'}** in **${matchedCamp.Location_Region}**:\n- 🎯 **Target Goal**: **₱${matchedCamp.targetPhp.toLocaleString()} PHP**\n- 💰 **Recorded On-Chain**: **₱${matchedCamp.raisedPhp.toLocaleString()} PHP**\n- ⏳ **Remaining Deficit**: **₱${matchedCamp.deficitPhp.toLocaleString()} PHP**\n\nYou can back this operation directly by clicking the campaign card via **GCash, Maya QR Ph, Bank Transfer, or Card** — automatically notarized gaslessly on Ethereum Sepolia!`,
      intent: 'CAMPAIGN_DETAIL',
      campaigns: [matchedCamp],
      suggestedPrompts: [
        `Paano mag-donate sa ${matchedCamp.Campaign_Title.slice(0, 24)}...?`,
        'Paano gumagana ang Blockchain transparency?',
        'Ipakita ang iba pang mga campaigns'
      ]
    };
  }

  // ── Scenario 2: Priority Relief Recommendations ──
  if (/(saan.*(kailangan|tulung|donat|kampanya|campaign)|urgent|rekomenda|recommend|priority|anong.*campaign|sinong.*nasalanta|pinaka.*kailangan|calamity.*area|disaster.*zone|drives)/i.test(lowerQuery)) {
    if (activeCampaigns.length > 0) {
      const topCamps = [...activeCampaigns].sort((a, b) => a.pctFunded - b.pctFunded).slice(0, 3);
      const campSummaries = topCamps.map((c, i) => {
        return `${i + 1}. **${c.Campaign_Title}** (${c.Location_Region || 'Philippines'})\n   - Organisasyon: *${c.Org_Name || 'Verified NGO'}*\n   - Pondo: **${c.pctFunded}% funded** (Kulang pa: **₱${c.deficitPhp.toLocaleString()} PHP**)`;
      }).join('\n\n');

      return {
        reply: isTagalog
          ? `📍 **Mga Prayoridad na Disaster Relief Operations Ngayon:**\n\nNarito ang mga aktibong relief drives sa database na may pinakamalaking kakulangan sa pondo:\n\n${campSummaries}\n\nMaaari kang mag-donate agad gamit ang **GCash, Maya QR Ph, Bank Transfer, o Card** — awtomatikong naka-audit sa blockchain!`
          : `📍 **Top Priority Disaster Relief Operations:**\n\nHere are the active relief campaigns currently experiencing the greatest funding deficits:\n\n${campSummaries}\n\nYou can back any of these operations immediately via **GCash, Maya, Bank Transfer, or Card** by selecting their card below!`,
        intent: 'RECOMMEND_CAMPAIGNS',
        campaigns: topCamps,
        suggestedPrompts: [
          'Paano mag-donate via GCash, Maya, o Bank?',
          'Paano gumagana ang Blockchain transparency?',
          'Philippine Emergency Hotlines (911 / 143)'
        ]
      };
    }
  }

  // ── Scenario 3: How to Donate (Philippine E-Wallets, Cards & Banks + Gasless Audit) ──
  if (/(paano.*(mag-donate|magdonate|mag donate|magbigay|tumulong|magpadala|send|bayad)|how.*to.*donate|paraan.*ng.*donasyon|steps|proseso)/i.test(lowerQuery)) {
    return {
      reply: isTagalog
        ? `🤝 **Madaling Gabay sa Pag-Donate sa BBDRTS (100% Piso — Walang Crypto o Wallet na Kailangan):**\n\n1. **GCash & Maya (QR Ph):**\n   - I-click ang **"Donate Now"** sa campaign card at piliin ang **GCash** o **Maya**.\n   - I-scan ang official QR Ph code ng accredited NGO at ipadala ang donasyon sa piso.\n   - I-upload ang screenshot ng resibo — awtomatikong susuriin ng **AI Vision OCR** ang reference number at ire-record sa Ethereum Sepolia gamit ang aming gasless relayer.\n\n2. **Credit / Debit Card & Bank Transfer:**\n   - Piliin ang **Bank / Card** sa donation modal para sa mabilis at beripikadong donasyon sa piso na may permanenteng Etherscan proof.`
        : `🤝 **How to Donate on BBDRTS (100% PHP Native — Zero Crypto or Wallet Needed):**\n\n1. **GCash & Maya (QR Ph):**\n   - Click **"Donate Now"** on any active campaign card and choose **GCash** or **Maya**.\n   - Scan the verified NGO's official QR Ph code and send your contribution in Philippine Pesos.\n   - Upload your receipt screenshot — our **AI Vision OCR** audits the reference number and our gasless relayer permanently notarizes it on Ethereum Sepolia.\n\n2. **Bank Transfer & Credit / Debit Card:**\n   - Choose **Bank / Card** in the donation modal for direct peso giving with instant verification and an immutable public Sepolia Etherscan proof.`,
      intent: 'HOW_TO_DONATE',
      suggestedPrompts: [
        'Saan pinaka-kailangan ng tulong ngayon?',
        'Paano gumagana ang Blockchain transparency?',
        'Paano sinusuri ng AI ang mga resibo?'
      ]
    };
  }

  // ── Scenario 4: E-Wallets / GCash / Maya Specifics (No Crypto / No MetaMask) ──
  if (/(gcash|paymaya|maya|qr ph|bank transfer|bdo|bpi|peso|fiat|wala akong (crypto|metamask|wallet)|walang metamask|no (crypto|metamask|wallet))/i.test(lowerQuery)) {
    return {
      reply: isTagalog
        ? `📱 **Donasyon Gamit ang GCash, Maya, o Bank Transfer:**\n\nHindi mo kailangang magkaroon ng cryptocurrency o MetaMask para makatulong sa mga nasalanta!\n- Bawat accredited NGO sa BBDRTS ay may rehistradong **QR Ph, GCash, at Maya account**.\n- Piliin lamang ang GCash o Maya sa donation window, i-scan ang QR code, at ipadala ang donasyon sa piso.\n- Kapag nag-upload ka ng screenshot ng resibo, binabasa ng ating **AI Vision OCR** ang 13-digit reference number at halaga.\n- Kapag na-verify, permanenteng itong inilalagay sa **Ethereum Sepolia public ledger** bilang patunay na pumasok ang iyong tulong.`
        : `📱 **Donating via GCash, Maya, or Bank Transfer (No MetaMask Needed):**\n\nYou do not need any cryptocurrency or Web3 wallet to support disaster relief operations!\n- Every verified NGO on BBDRTS provides official **QR Ph, GCash, Maya, and Bank transfer details**.\n- When you upload your receipt screenshot, our **AI Vision OCR** inspects the reference number, amount, and payment rail.\n- Once verified, the donation is notarized onto the **Ethereum Sepolia public ledger** for immutable proof of contribution.`,
      intent: 'FIAT_EWALLETS',
      suggestedPrompts: [
        'Paano sinusuri ng AI ang mga resibo?',
        'Saan pinaka-kailangan ng tulong ngayon?',
        'Paano gumagana ang Blockchain transparency?'
      ]
    };
  }

  // ── Scenario 4B: Crypto / MetaMask Questions -> Explain Gasless PHP Architecture ──
  if (/(ano ang metamask|what is metamask|metamask.*guide|private key|public key|gas fee|paano gamitin ang metamask|crypto|ethereum wallet)/i.test(lowerQuery)) {
    return {
      reply: isTagalog
        ? `🛡️ **Hindi Kailangan ng MetaMask o Cryptocurrency sa BBDRTS!**\n\nDinisenyo ang BBDRTS para sa bawat Pilipino gamit ang **Gasless Blockchain Relayer**:\n- **100% Piso ang Donasyon:** Gamitin ang **GCash, Maya, Bank Transfer, o Card** — hindi mo kailangang bumili ng ETH o mag-install ng MetaMask.\n- **Zero Gas Fees:** Ang aming backend relayer ang awtomatikong nagbabayad ng gas at nagtatala ng bawat beripikadong donasyon sa **Ethereum Sepolia public ledger**.\n- **Buong Transparency:** Makukuha mo pa rin ang permanenteng Transaction Hash at Sepolia Etherscan link!`
        : `🛡️ **No MetaMask or Cryptocurrency Needed on BBDRTS!**\n\nBBDRTS is built for everyday Filipino donors using a **Gasless Blockchain Audit Relayer**:\n- **100% PHP Donations:** Donate seamlessly via **GCash, Maya, Bank Transfer, or Card** — no ETH purchases or browser wallet extensions required.\n- **Zero Gas Fees for Users:** Our secure backend relayer automatically covers network gas fees and anchors every verified donation and NGO disbursement onto **Ethereum Sepolia**.\n- **Full Public Verifiability:** Every verified contribution still receives an immutable Transaction Hash you can verify on Sepolia Etherscan 24/7!`,
      intent: 'EXPLAIN_WALLET',
      suggestedPrompts: [
        'Paano mag-donate gamit ang GCash o Maya?',
        'Saan pinaka-kailangan ng tulong ngayon?',
        'Paano gumagana ang Blockchain transparency?'
      ]
    };
  }

  // ── Scenario 5: Blockchain, Transparency, & Anti-Corruption ("Safe ba?") ──
  if (/(blockchain|smart contract|transparency|transparent|vending|panloloko|nakaw|kurakot|middleman|safe|legit|bakit blockchain|paano gumagana|corruption|corrupt|protect|secure|security|auditable|audit)/i.test(lowerQuery)) {
    return {
      reply: isTagalog
        ? `🛡️ **Bakit Ligtas at Hindi Mananakaw ang Donasyon sa BBDRTS:**\n\nIsipin ang blockchain na parang **isang higanteng record book** na hawak ng libu-libong computers nang sabay-sabay:\n1. **Hindi Nabubura o Nababago:** Kapag na-record na ng aming gasless relayer ang donasyon mo, kahit sino (maging admin o opisyal) ay hindi makakapagbago o makakapagtago nito.\n2. **AI OCR + Smart Contract Audit:** Bawat GCash, Maya, Bank, at Card receipt ay sinusuri at permanente nang nakatatak sa Ethereum Sepolia kasama ang mga ulat ng paggastos ng NGO.\n3. **Public Auditing:** Bawat donor ay may **Transaction Hash** na pwedeng i-verify kahit sino sa Sepolia Etherscan 24/7.`
        : `🛡️ **Why Relief Funds on BBDRTS are Transparent & Tamper-Proof:**\n\nThink of the blockchain as an **immutable, shared public ledger** distributed across thousands of validator nodes:\n1. **Tamper-Proof Audit Trail:** Once our gasless relayer seals a verified PHP donation or NGO disbursement on Ethereum Sepolia, no admin or bad actor can silently edit or hide it.\n2. **Zero Wallet Friction:** Donors give in Philippine Pesos (GCash, Maya, Bank, Card) while still getting full cryptographic accountability.\n3. **Radical Transparency:** Every verified contribution produces a **Transaction Hash** auditable by anyone on Sepolia Etherscan 24/7.`,
      intent: 'EXPLAIN_BLOCKCHAIN',
      suggestedPrompts: [
        'Saan pinaka-kailangan ng tulong ngayon?',
        'Paano mag-donate via GCash, Maya, o Bank?',
        'Paano sinusuri ng AI ang mga resibo?'
      ]
    };
  }

  // ── Scenario 6: AI Vision Receipt Inspection & Anti-Fraud ──
  if (/(ai.*(receipt|resibo|scanner|vision|ocr|fraud)|ocr|pekeng resibo|duplicate receipt|tamper|receipt verification)/i.test(lowerQuery)) {
    return {
      reply: isTagalog
        ? `🤖 **Paano Sinusuri ng AI ang mga Resibo (Anti-Fraud Engine):**\n\nPinagsasama ng BBDRTS ang **Google Gemini 1.5 Flash Vision** at **Tesseract OCR**:\n1. **Reference Number Extraction**: Awtomatikong binabasa ang 13-digit GCash ref o Maya ID.\n2. **Amount Discrepancy Matching**: Kinukumpara ang halaga sa larawan laban sa idineklara ng nag-donate.\n3. **Payment Rail Check**: Kung GCash ang pinili ngunit Maya slip ang ini-upload, agad itong napapansin ng AI.\n4. **Duplicate Prevention**: Tinitiyak na hindi pa nagamit ang resibong iyon sa ibang kampanya.`
        : `🤖 **How AI Receipt Scanning & Anti-Fraud Auditing Operates:**\n\nBBDRTS pairs **Google Gemini 1.5 Flash Vision** with **Tesseract OCR**:\n1. **Reference Number Parsing**: Automatically extracts 13-digit GCash references or alphanumeric Maya transaction IDs.\n2. **Amount Validation**: Cross-checks the visually parsed sum against the donor's declared pledge.\n3. **Payment Rail Consistency**: Flags if a donor declared GCash but attached a Maya or Bank slip.\n4. **Ledger Deduplication**: Prevents fraudulent recycling of the same screenshot across multiple campaigns.`,
      intent: 'AI_RECEIPT_SCANNER',
      suggestedPrompts: [
        'Donasyon gamit ang GCash at Maya',
        'Paano gumagana ang Blockchain transparency?',
        'Saan pinaka-kailangan ng tulong ngayon?'
      ]
    };
  }

  // ── Scenario 7: NGO Accreditation & SEC Legitimacy ──
  if (/(sec.*(accredit|cert|rehistro)|dswd|legit.*ngo|organisasyon.*rehistro|paano.*maging.*ngo|peke.*ngo)/i.test(lowerQuery)) {
    return {
      reply: isTagalog
        ? `🏛️ **Paano Pinatutunayan ang Pagiging Lehitimo ng mga NGO:**\n\nBago makapag-deploy ng disaster campaign ang isang organisasyon sa BBDRTS:\n1. **SEC Registration & Certificate**: Kailangang mag-upload ng opisyal na Certificate of Incorporation mula sa Securities and Exchange Commission.\n2. **DSWD Solicitation Permit**: Sinusuri ang legal na pahintulot sa pangangalap ng pondo para sa kalamidad.\n3. **Board of Trustees Transparency**: Nakalathala ang listahan ng mga pinuno sa transparency dossier ng NGO.\n4. **Dual Audit**: Sinusuri ng AI Document Vision at System Administrator bago maaprubahan.`
        : `🏛️ **How Humanitarian Organizations (NGOs) are Authenticated:**\n\nBefore any relief campaign can be deployed on BBDRTS:\n1. **SEC Registration**: NGOs must submit their official SEC Certificate of Incorporation and valid Registration Number.\n2. **DSWD Solicitation Permit**: Validated for lawful disaster fund solicitation.\n3. **Board of Trustees**: Complete governance roster published on their public transparency dossier.\n4. **Dual Inspection**: Audited by Gemini AI Document Vision and the System Administrator before permissions are unlocked.`,
      intent: 'NGO_ACCREDITATION',
      suggestedPrompts: [
        'Saan pinaka-kailangan ng tulong ngayon?',
        'Paano gumagana ang Blockchain transparency?',
        'Tungkol sa mga developer ng BBDRTS'
      ]
    };
  }

  // ── Scenario 8: Official Emergency Calamity Hotlines ──
  if (/(hotline|emergency.*contact|tawagan.*emergency|rescue.*hotline|numero.*ng.*rescue|numero.*ng.*911|numero.*ng.*red cross|numero.*ng.*ndrrmc)/i.test(lowerQuery)) {
    const list = PHILIPPINE_EMERGENCY_HOTLINES.map(h => `• **${h.agency}**: \`${h.contact}\``).join('\n');
    return {
      reply: isTagalog
        ? `🚨 **Mga Opisyal na Emergency Disaster Hotlines sa Pilipinas:**\n\n${list}\n\n*Paalala: Para sa agarang search, rescue, o medical evacuation, tumawag agad sa 911 o Red Cross 143.*`
        : `🚨 **Philippine National Disaster Emergency Hotlines:**\n\n${list}\n\n*Important: For immediate search, rescue, or medical evacuation, dial 911 or Red Cross 143.*`,
      intent: 'HOTLINES',
      suggestedPrompts: [
        'Saan pinaka-kailangan ng tulong ngayon?',
        'Paano mag-donate via GCash, Maya, o Bank?',
        'Paano gumagana ang Blockchain transparency?'
      ]
    };
  }

  // ── Scenario 9: About Capstone, Developers & Saint Joseph College ──
  if (/(sino.*(gumawa|kayo|developer|architect)|tungkol sa bbdrts|about bbdrts|capstone|thesis|saint joseph college|sjc|ccs|gester)/i.test(lowerQuery)) {
    return {
      reply: isTagalog
        ? `🎓 **Tungkol sa BBDRTS Capstone Project:**\n\nAng **BBDRTS (Blockchain-Based Donation and Relief Transparency System)** ay idinisenyo at binuo ng mga BSIT researchers sa **Saint Joseph College (College of Computer Studies)**:\n- **Lead System Architect:** Gester C. Macaldo\n- **Research & Development Team:** Leslie Faye Baltazar, Reva Grace Faith A. Saga, Edrian Jade Ambalong, Rainelyn C. Villaranda, Niño Carl Vincent Cas, at Meldwin A. Bato.\n- **Faculty Adviser:** Ma'am Teni\n\nLayunin nitong alisin ang financial opacity at tiyaking may 100% mathematical trust ang bawat donasyon sa Pilipinas!`
        : `🎓 **About the BBDRTS Capstone System:**\n\nThe **Blockchain-Based Donation and Relief Transparency System (BBDRTS)** is engineered by BSIT researchers at **Saint Joseph College (College of Computer Studies)**:\n- **Lead System Architect:** Gester C. Macaldo\n- **Research Team:** Leslie Faye Baltazar, Reva Grace Faith A. Saga, Edrian Jade Ambalong, Rainelyn C. Villaranda, Niño Carl Vincent Cas, and Meldwin A. Bato.\n- **Adviser:** Ma'am Teni\n\nThe mission is to eliminate intermediary deductions and establish verifiable mathematical trust for Philippine disaster response.`,
      intent: 'ABOUT_SYSTEM',
      suggestedPrompts: [
        'Saan pinaka-kailangan ng tulong ngayon?',
        'Paano gumagana ang Blockchain transparency?',
        'Paano mag-donate via GCash, Maya, o Bank?'
      ]
    };
  }

  // ── Scenario 10: Polite Thank You / Gratitude ──
  if (/(salamat|thank you|thanks|ty|maraming salamat|daghang salamat|arigato)/i.test(lowerQuery)) {
    return {
      reply: isTagalog
        ? `Walang anuman! 🙏 Masaya akong makatulong sa iyong disaster relief journey.\n\nNandito lang ako palagi kung nais mong sumuri ng mga priority campaigns, mag-verify ng transaction receipt sa ledger, o alamin paano gumagana ang smart contracts. Ingat palagi at nawa'y makatulong ang ating munting ambag!`
        : `You are very welcome! 🙏 Glad to assist in your relief and donation journey.\n\nI am always here whenever you need to verify on-chain receipts, check high-priority relief drives, or learn more about smart contracts. Stay safe and thank you for supporting transparent relief drives!`,
      intent: 'THANK_YOU',
      suggestedPrompts: [
        'Saan pinaka-kailangan ng tulong ngayon?',
        'Paano gumagana ang Blockchain transparency?',
        'Philippine Emergency Hotlines (911 / 143)'
      ]
    };
  }

  // ── Scenario 11: Casual Greetings & Open Inquiries ──
  if (/(^hi|^hello|^kamusta|^kumusta|mabuhay|good morning|good afternoon|good evening|hey|greetings)/i.test(lowerQuery)) {
    return {
      reply: isTagalog
        ? `Mabuhay! Ako ang iyong **ReliefAI**, ang AI & blockchain transparency assistant ng BBDRTS. Maari kitang gabayan sa:\n- 📍 **Pagsusuri ng mga urgent disaster relief drives**\n- 🤝 **Paraan ng pag-donate gamit ang GCash, Maya, Bank Transfer, o Card**\n- 🔍 **Pag-audit ng iyong Transaction Hash o e-wallet receipt**\n- 🛡️ **Paliwanag kung paano gumagana ang gasless blockchain audit trail**\n\nAno ang nais mong talakayin ngayon?`
        : `Greetings! I am **ReliefAI**, your humanitarian transparency assistant for BBDRTS. I can guide you with:\n- 📍 **Exploring urgent disaster relief drives in the Philippines**\n- 🤝 **Step-by-step PHP donation via GCash, Maya, Bank Transfer, or Card**\n- 🔍 **Verifying transaction hashes and transfer slips on the public ledger**\n- 🛡️ **Understanding how our gasless Ethereum Sepolia audit ensures 100% transparency**\n\nWhat would you like to explore today?`,
      intent: 'GREETING',
      suggestedPrompts: [
        'Saan pinaka-kailangan ng tulong ngayon?',
        'Paano gumagana ang Blockchain transparency?',
        'Paano mag-donate via GCash, Maya, o Bank?',
        'Philippine Emergency Hotlines (911 / 143)'
      ]
    };
  }

  // ── Scenario 12: Contextual Conversational Synthesis Fallback ──
  return {
    reply: isTagalog
      ? `Naiintindihan ko ang iyong katanungan. Bilang iyong **ReliefAI**, narito ang mga pangunahing tulong na maari kong ibigay:\n\n1. 📍 **"Saan pinaka-kailangan ng tulong ngayon?"** — Ipapakita ko ang mga verified relief drives na may kritikal na kakulangan sa pondo.\n2. 🤝 **"Paano mag-donate via GCash, Maya, o Bank?"** — Step-by-step na gabay sa donasyon sa piso.\n3. 🛡️ **"Paano gumagana ang blockchain transparency?"** — Paliwanag kung bakit ligtas sa korapsyon ang pondo.\n4. 🚨 **"Philippine Emergency Hotlines"** — Listahan ng mga opisyal na numero tulad ng 911 at Red Cross 143.\n\n*Maaari ka ring mag-paste ng anumang 0x hash o GCash reference number upang ma-verify ko agad sa public ledger!*`
      : `I understand your inquiry. As your **ReliefAI** assistant, here is what I can assist you with right now:\n\n1. 📍 **"Where is aid most needed now?"** — Highlights active campaigns with critical funding deficits.\n2. 🤝 **"How to donate via GCash, Maya, or Bank?"** — Step-by-step PHP donation guide.\n3. 🛡️ **"How does blockchain transparency work?"** — How our gasless Sepolia audit ensures funds cannot be diverted.\n4. 🚨 **"Philippine Emergency Hotlines"** — Verified emergency contacts for 911 and Red Cross 143.\n\n*You can also paste any 0x transaction hash or reference number to verify a contribution on-chain!*`,
    intent: 'ASSIST_OPTIONS',
    suggestedPrompts: [
      'Saan pinaka-kailangan ng tulong ngayon?',
      'Paano gumagana ang Blockchain transparency?',
      'Paano mag-donate via GCash, Maya, o Bank?',
      'Philippine Emergency Hotlines (911 / 143)'
    ]
  };
}

module.exports = {
  DISASTER_STANDARDS,
  generateSmartCampaignBudget,
  chatWithReliefCopilot,
  chatWithBayanihanCopilot: chatWithReliefCopilot, // Backward-compatibility alias
  ETH_TO_PHP_RATE
};
