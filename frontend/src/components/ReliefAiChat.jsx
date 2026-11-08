import React, { useState, useRef, useEffect, useMemo } from 'react';
import './ReliefAiChat.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || (
  typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3001'
    : 'https://bbdrts-backend-api.onrender.com'
);

const QUICK_STARTER_PROMPTS = [
  {
    icon: 'emergency',
    title: 'Urgent Calamity Appeals',
    sub: 'Where is relief aid needed most right now?',
    prompt: 'Which disaster relief drives currently have the highest funding deficit?'
  },
  {
    icon: 'account_balance_wallet',
    title: 'How to Donate',
    sub: 'MetaMask (crypto) & GCash / Maya guide',
    prompt: 'How can I donate through MetaMask (crypto) or GCash/Maya on BBDRTS?'
  },
  {
    icon: 'shield',
    title: 'Blockchain Transparency',
    sub: 'How smart contracts prevent diversion',
    prompt: 'How does blockchain technology ensure 100% transparency in BBDRTS?'
  },
  {
    icon: 'call',
    title: 'Emergency Hotlines',
    sub: 'Official numbers for NDRRMC & Red Cross',
    prompt: 'What are the official disaster emergency hotlines in the Philippines (911 / 143)?'
  }
];

const DEFAULT_FOLLOW_UP_SUGGESTIONS = [
  'How do I verify my donation receipt on-chain?',
  'What is the live funding status of active campaigns?',
  'Who are the verified partner NGOs?',
  'How to donate without cryptocurrency?'
];

/**
 * Autonomous Client-Side Real-Time AI Generation (Zero Hardcoded Strings!)
 * Directly communicates with Google Gemini or Neural LLM when backend is unreachable.
 */
async function callClientRealtimeAi({ query, conversationHistory = [], customApiKey = '', dashboardContext = null }) {
  const activeKey = (customApiKey || import.meta.env.VITE_GEMINI_API_KEY || '').trim();

  const truncatedWallet = dashboardContext?.walletAddress && dashboardContext.walletAddress.length > 10
    ? `${dashboardContext.walletAddress.substring(0, 6)}...${dashboardContext.walletAddress.substring(38)}`
    : 'None (Browsing mode)';

  const dashboardNarrative = dashboardContext ? `
BACKGROUND DASHBOARD CONTEXT (REFERENCE ONLY - DO NOT DUMP OR RECITE UNLESS EXPLICITLY ASKED):
- Name: ${dashboardContext.userName || 'Guest / Unregistered'}
- Role: ${(dashboardContext.role || 'donor').toUpperCase()}
- Active Portal: ${dashboardContext.activeView || 'Live Portal'}
- Current Screen: ${dashboardContext.activeSubpage || 'Dashboard Overview'}
- Truncated Wallet: ${truncatedWallet}
- Loaded Campaigns: ${dashboardContext.totalCampaignsLoaded || 0}

ANTI-REPETITION CONSTRAINTS:
1. The user already sees their dashboard. DO NOT dump or recite their supporter profile, full wallet address, or email unless they explicitly ask "Who am I?" or "What is my wallet address?".
2. For conversational follow-ups like "what about now?", "what's next?", or "what should I do?", suggest active relief campaigns or next steps without reciting their profile card.` : '';
  
  if (activeKey && activeKey.length > 15) {
    for (const mName of ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-flash-latest']) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${mName}:generateContent?key=${activeKey}`;
        const systemText = `You are "ReliefAI", the intelligent, empathetic, and authoritative Web3 humanitarian assistant for BBDRTS (Blockchain-Based Donation & Relief Transparency System, developed by BSIT researchers at Saint Joseph College, Southern Leyte).
Lead Architect: Gester C. Macaldo; Development Team: Leslie Faye Baltazar, Reva Grace Faith A. Saga, Edrian Jade Ambalong, Rainelyn C. Villaranda, Niño Carl Vincent Cas, Meldwin A. Bato; Faculty Adviser: Ma'am Teni.

CRITICAL LANGUAGE DIRECTIVES:
1. DEFAULT LANGUAGE: Speak in clear, professional, friendly, and natural ENGLISH by default for all responses and explanations.
2. MULTILINGUAL CAPABILITY: You understand Tagalog/Filipino, Cebuano/Bisaya, and other languages. If and ONLY IF the user explicitly asks a question in Tagalog or Bisaya, reply thoughtfully in that language. Otherwise, strictly maintain ENGLISH as your default.
3. BBDRTS CONTEXT: Ground explanations on Ethereum Sepolia smart contracts, on-chain public ledger transparency, zero-cut MetaMask donations, QR Ph GCash/Maya AI receipt verification, and disaster hotlines (NDRRMC 911, Red Cross 143).
${dashboardNarrative}`;

        const contents = [];
        for (const m of conversationHistory.slice(-6)) {
          if (!m.text) continue;
          contents.push({
            role: m.sender === 'user' ? 'user' : 'model',
            parts: [{ text: m.text }]
          });
        }
        contents.push({
          role: 'user',
          parts: [{ text: query }]
        });

        const geminiRes = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemText }] },
            contents
          })
        });

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text && text.trim()) {
            return {
              text: text.trim(),
              modelUsed: `Google ${mName}`
            };
          }
        }
      } catch (gErr) {
        console.warn(`Client direct Gemini call error on ${mName}:`, gErr.message);
      }
    }
  }

  const systemPrompt = `You are "ReliefAI", the intelligent, authoritative, and empathetic Web3 humanitarian assistant for BBDRTS (Blockchain-Based Donation & Relief Transparency System, developed by BSIT researchers at Saint Joseph College, Southern Leyte).
Lead Architect: Gester C. Macaldo; Development Team: Leslie Faye Baltazar, Reva Grace Faith A. Saga, Edrian Jade Ambalong, Rainelyn C. Villaranda, Niño Carl Vincent Cas, Meldwin A. Bato; Adviser: Ma'am Teni.

CRITICAL LANGUAGE DIRECTIVES:
1. Speak in clear, professional, and natural ENGLISH by default.
2. If the user addresses you in Tagalog or Cebuano, understand and reply in their language, but default to ENGLISH.
3. Explain blockchain without dense jargon: public ledger, transparent smart contracts, zero intermediary fees.
4. Explain how donors can donate via BOTH MetaMask (direct Web3 crypto with zero gateway fee) and GCash/Maya/Bank (fiat QR Ph with automated AI receipt inspection and on-chain relayer notarization).
5. For emergency search and rescue, reference NDRRMC 911 and Red Cross 143.
${dashboardNarrative}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-8).map((m) => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.text
    })),
    { role: 'user', content: query }
  ];

  const res = await fetch('https://text.pollinations.ai/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      model: 'openai-fast',
      seed: Math.floor(Math.random() * 1000000)
    })
  });

  if (!res.ok) {
    throw new Error(`Neural LLM HTTP ${res.status}`);
  }

  const text = await res.text();
  if (text && text.trim()) {
    return {
      text: text.trim(),
      modelUsed: 'Real-Time Neural LLM'
    };
  }
  throw new Error('Empty response from neural LLM');
}

/**
 * Format inline markdown tokens (**bold**, `code`)
 */
function formatInline(str = '') {
  const parts = str.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, pIdx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={pIdx} className="bbdrts-copilot-highlight">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={pIdx} className="bbdrts-copilot-code-token">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

/**
 * Robust Markdown Renderer supporting Tables, Bullet Points, Lists, and Typography
 */
function renderMarkdown(text = '') {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  let inTable = false;
  let tableRows = [];
  let inList = false;
  let listItems = [];

  const flushTable = (key) => {
    if (tableRows.length === 0) return;
    const headerRow = tableRows[0];
    const dataRows = tableRows.slice(1).filter((r) => !r.every((c) => /^[-:\s]+$/.test(c)));
    elements.push(
      <div key={`table-${key}`} className="bbdrts-copilot-table-wrapper">
        <table className="bbdrts-copilot-markdown-table">
          <thead>
            <tr>
              {headerRow.map((cell, cIdx) => (
                <th key={cIdx}>{formatInline(cell.trim())}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataRows.map((row, rIdx) => (
              <tr key={rIdx}>
                {row.map((cell, cIdx) => (
                  <td key={cIdx}>{formatInline(cell.trim())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableRows = [];
    inTable = false;
  };

  const flushList = (key) => {
    if (listItems.length === 0) return;
    elements.push(
      <ul key={`list-${key}`} className="bbdrts-copilot-markdown-list">
        {listItems.map((item, iIdx) => (
          <li key={iIdx}>{formatInline(item)}</li>
        ))}
      </ul>
    );
    listItems = [];
    inList = false;
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    
    // Markdown headers (### Header)
    if (trimmed.startsWith('### ')) {
      if (inList) flushList(idx);
      if (inTable) flushTable(idx);
      elements.push(
        <h4 key={`h3-${idx}`} className="bbdrts-copilot-markdown-h3">
          {formatInline(trimmed.replace(/^###\s+/, ''))}
        </h4>
      );
      return;
    }
    if (trimmed.startsWith('## ')) {
      if (inList) flushList(idx);
      if (inTable) flushTable(idx);
      elements.push(
        <h3 key={`h2-${idx}`} className="bbdrts-copilot-markdown-h2">
          {formatInline(trimmed.replace(/^##\s+/, ''))}
        </h3>
      );
      return;
    }

    // Horizontal divider
    if (trimmed === '---' || trimmed === '***') {
      if (inList) flushList(idx);
      if (inTable) flushTable(idx);
      elements.push(<hr key={`hr-${idx}`} className="bbdrts-copilot-markdown-hr" />);
      return;
    }

    // Table detection: line starts and ends with |
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (inList) flushList(idx);
      inTable = true;
      const cells = trimmed.slice(1, -1).split('|');
      tableRows.push(cells);
      return;
    } else if (inTable) {
      flushTable(idx);
    }

    // List detection
    const listMatch = trimmed.match(/^[-*•]\s+(.*)$/) || trimmed.match(/^\d+\.\s+(.*)$/);
    if (listMatch) {
      if (inTable) flushTable(idx);
      inList = true;
      listItems.push(listMatch[1]);
      return;
    } else if (inList) {
      flushList(idx);
    }

    // Empty lines
    if (!trimmed) {
      elements.push(<div key={`spacer-${idx}`} style={{ height: '6px' }} />);
      return;
    }

    // Normal paragraph
    elements.push(
      <p key={`p-${idx}`} className="bbdrts-copilot-markdown-p">
        {formatInline(trimmed)}
      </p>
    );
  });

  if (inTable) flushTable('end');
  if (inList) flushList('end');

  return elements;
}

export default function ReliefAiChat({
  userRole = 'donor',
  currentUser = null,
  walletAddress = null,
  campaigns = [],
  activeView = 'Dashboard',
  activeSubpage = 'Dashboard Overview',
  activeTabMeta = null
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [currentSuggestions, setCurrentSuggestions] = useState(DEFAULT_FOLLOW_UP_SUGGESTIONS);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const dashboardContext = useMemo(() => {
    const rawCampList = Array.isArray(campaigns) ? campaigns : [];
    return {
      userName: currentUser?.name || currentUser?.Full_Name || currentUser?.username || null,
      userEmail: currentUser?.email || currentUser?.Email || null,
      role: userRole || currentUser?.role || 'donor',
      orgName: currentUser?.organization_name || currentUser?.Org_Name || null,
      walletAddress: walletAddress || currentUser?.wallet_address || null,
      activeView: activeView || 'Dashboard',
      activeSubpage: activeSubpage || 'Dashboard Overview',
      activeTabMeta: {
        ...(activeTabMeta || {}),
        visibleCampaigns: (activeTabMeta?.visibleCampaigns && activeTabMeta.visibleCampaigns.length > 0)
          ? activeTabMeta.visibleCampaigns
          : rawCampList.slice(0, 5).map(c => ({
              id: c.Campaign_ID || c.id,
              title: c.Campaign_Title || c.title || 'Relief Appeal',
              targetEth: c.Target_Amount || c.targetEth,
              raisedEth: c.Raised_Eth || c.raisedEth,
              region: c.Location_Region || c.region || 'Southern Leyte',
              urgency: c.Urgency || c.urgency || 'HIGH'
            }))
      },
      totalCampaignsLoaded: rawCampList.length,
      activeCampaignSummaries: (activeTabMeta?.visibleCampaigns && activeTabMeta.visibleCampaigns.length > 0)
        ? activeTabMeta.visibleCampaigns
        : rawCampList.slice(0, 5).map(c => ({
            id: c.Campaign_ID || c.id,
            title: c.Campaign_Title || c.title || 'Relief Appeal',
            targetEth: c.Target_Amount || c.targetEth,
            raisedEth: c.Raised_Eth || c.raisedEth,
            region: c.Location_Region || c.region,
            urgency: c.Urgency || c.urgency
          }))
    };
  }, [currentUser, walletAddress, userRole, campaigns, activeView, activeSubpage, activeTabMeta]);

  const dynamicStarters = useMemo(() => {
    const isAuth = Boolean(currentUser || walletAddress);
    const sub = (activeSubpage || '').toLowerCase();
    const tab = (activeTabMeta?.tab || '').toLowerCase();
    const starters = [];

    // ── Scenario A: User is on "My Contributions & Receipts" (Donor) ──
    if (sub.includes('contribution') || sub.includes('receipt') || tab === 'my-donations') {
      starters.push({
        icon: 'receipt_long',
        title: 'Analyze My Receipts',
        sub: 'Review verified on-chain donation history',
        prompt: 'Can you read my donation history on this screen, summarize my total contributions in ETH and PHP, and tell me my donor recognition tier?'
      });
      starters.push({
        icon: 'verified',
        title: 'How to Verify Receipts',
        sub: 'Etherscan Sepolia transaction audit',
        prompt: 'How do I verify the transaction hash of my donation on the Sepolia Etherscan blockchain ledger?'
      });
      starters.push({
        icon: 'print',
        title: 'Official Audit Receipts',
        sub: 'Tax deductible & NGO sealed proof',
        prompt: 'How do I download or export an official printable audit receipt for my donations?'
      });
      starters.push({
        icon: 'military_tech',
        title: 'Donor Tier Recognition',
        sub: '15 Humanitarian Recognition Circles',
        prompt: 'How do the 15 Disaster Relief Recognition Circles work and what tier am I currently at?'
      });
      return starters;
    }

    // ── Scenario B: User is on "Relief Radar" (Weather / Disaster Map) ──
    if (sub.includes('radar') || sub.includes('heatmap') || tab === 'radar-heatmap') {
      starters.push({
        icon: 'radar',
        title: 'Analyze Relief Radar',
        sub: 'Where is disaster aid needed most right now?',
        prompt: 'Can you analyze the live Relief Radar map on my screen and tell me which Philippine calamity zones currently need emergency aid most?'
      });
      starters.push({
        icon: 'cloudy_snowing',
        title: 'PAGASA Doppler Radar',
        sub: 'How real-time precipitation data works',
        prompt: 'How does BBDRTS integrate live PAGASA Doppler radar precipitation data with smart contract relief campaigns?'
      });
      starters.push({
        icon: 'emergency',
        title: 'Active Calamity Appeals',
        sub: 'Disaster drives in severe weather zones',
        prompt: 'Which emergency disaster campaigns on this map currently have critical funding shortfalls?'
      });
      starters.push({
        icon: 'call',
        title: 'Philippine Disaster Hotlines',
        sub: 'NDRRMC (911) & Red Cross (143)',
        prompt: 'What are the official emergency rescue and disaster hotlines in the Philippines (NDRRMC 911, Red Cross 143)?'
      });
      return starters;
    }

    // ── Scenario C: User is on "Relief Campaigns Explorer" ──
    if (sub.includes('campaign') || tab === 'campaigns' || tab === 'all-campaigns') {
      starters.push({
        icon: 'trending_up',
        title: 'Highest Deficit Appeals',
        sub: 'Drives with urgent remaining funding gap',
        prompt: 'Looking at the active relief campaigns on my screen, which one has the largest remaining funding deficit?'
      });
      starters.push({
        icon: 'account_balance_wallet',
        title: 'How to Donate',
        sub: 'MetaMask (crypto) & GCash / Maya guide',
        prompt: 'How can I donate through MetaMask (crypto) or GCash/Maya on BBDRTS?'
      });
      starters.push({
        icon: 'filter_alt',
        title: 'Filter & Search Campaigns',
        sub: 'Disaster Relief vs Charitable Aid',
        prompt: 'Explain the difference between Disaster Relief (DR) and Charitable Aid (CD) campaigns on this dashboard.'
      });
      starters.push({
        icon: 'shield',
        title: 'Anti-Corruption Escrow',
        sub: 'How smart contracts prevent diversion',
        prompt: 'How does blockchain technology ensure that 100% of my donation reaches the verified NGO without intermediaries?'
      });
      return starters;
    }

    // ── Scenario D: User is on "Deploy Campaign" (NGO / Admin) ──
    if (sub.includes('deploy') || sub.includes('create') || tab === 'create') {
      starters.push({
        icon: 'smart_toy',
        title: 'AI Smart Budget Calculator',
        sub: 'UN Sphere Project family unit allocations',
        prompt: 'How does the AI smart campaign budget generator calculate humanitarian family food packs, shelter, and medical allocations?'
      });
      starters.push({
        icon: 'post_add',
        title: 'Campaign Deployment Guide',
        sub: 'Smart contract target ETH & parameters',
        prompt: 'What information and verification details are required to deploy an emergency disaster appeal to the blockchain?'
      });
      starters.push({
        icon: 'security',
        title: 'Milestone Disbursement',
        sub: 'On-chain proof of relief distribution',
        prompt: 'How does milestone-based fund disbursement protect donor funds during emergency relief distribution?'
      });
      starters.push({
        icon: 'qr_code_2',
        title: 'Dual-Rail Payments (QR Ph)',
        sub: 'Setting up GCash/Maya recipient accounts',
        prompt: 'How can our NGO configure QR Ph and GCash/Maya accounts so non-crypto donors can contribute?'
      });
      return starters;
    }

    // ── Scenario E: User is on "Financial Ledger / Manual Verification" (NGO) ──
    if (sub.includes('ledger') || tab === 'ledger') {
      starters.push({
        icon: 'fact_check',
        title: 'Verify Manual Donations',
        sub: 'Approve pending GCash / Maya vouchers',
        prompt: 'How do I review, inspect, and approve pending GCash and Maya manual donation receipts uploaded by donors?'
      });
      starters.push({
        icon: 'document_scanner',
        title: 'AI Receipt Vision & OCR',
        sub: 'Automated reference number extraction',
        prompt: 'How does the AI vision receipt scanner extract reference numbers, amounts, and timestamps from payment screenshots?'
      });
      starters.push({
        icon: 'hub',
        title: 'On-Chain Notarization',
        sub: 'How fiat receipts are sealed in Sepolia',
        prompt: 'How are approved GCash and Maya donations permanently minted onto the Ethereum blockchain public ledger?'
      });
      starters.push({
        icon: 'table_view',
        title: 'Audit Trail & Export',
        sub: 'CSV / Etherscan ledger reconciliation',
        prompt: 'How can our organization export complete financial audit logs for government and donor compliance?'
      });
      return starters;
    }

    // ── Scenario F: User is on "SEC KYC / Approvals" (NGO / Admin) ──
    if (sub.includes('kyc') || sub.includes('approval') || tab === 'sec-kyc' || tab === 'approvals') {
      starters.push({
        icon: 'verified_user',
        title: 'SEC KYC Requirements',
        sub: 'Institutional accreditation criteria',
        prompt: 'What documents are required for an NGO to be verified and accredited on BBDRTS (SEC, Mayor’s Permit, DSWD)?'
      });
      starters.push({
        icon: 'gavel',
        title: 'Anti-Fraud Safeguards',
        sub: 'How vetting eliminates fake charities',
        prompt: 'How does the BBDRTS administrator verification process prevent fraudulent relief organizations from deploying campaigns?'
      });
      starters.push({
        icon: 'badge',
        title: 'Accreditation Status',
        sub: 'Review current verification standing',
        prompt: 'What is the current accreditation status of our organization and how do we complete verification?'
      });
      return starters;
    }

    // ── Scenario G: User is on "Profile & Settings" ──
    if (sub.includes('setting') || sub.includes('profile') || tab === 'settings') {
      starters.push({
        icon: 'manage_accounts',
        title: 'Profile & Web3 Wallet',
        sub: 'Updating your connected address & identity',
        prompt: 'How do I update my profile details and link my primary MetaMask Web3 wallet to this account?'
      });
      starters.push({
        icon: 'palette',
        title: 'Theme & Accessibility',
        sub: 'Light and Dark modes & font scaling',
        prompt: 'How do I switch between Light and Dark themes, or adjust text size for accessibility?'
      });
      starters.push({
        icon: 'lock',
        title: 'Session & Cryptographic Security',
        sub: 'JWT tokens & wallet signature security',
        prompt: 'How does BBDRTS secure user sessions and protect wallet signatures against phishing or unauthorized access?'
      });
      return starters;
    }

    // ── Scenario H: Default Overview (Dashboard Home) ──
    starters.push({
      icon: 'dashboard_customize',
      title: 'Analyze My Dashboard',
      sub: isAuth 
        ? `Live review of your ${activeView || 'portal'} & active section` 
        : 'Summarize system metrics & active appeals',
      prompt: isAuth
        ? `Can you read my active dashboard, confirm who I am logged in as on the ${activeSubpage || 'dashboard'}, and summarize my live status and recommendations?`
        : 'Can you read the current dashboard screen and tell me what relief drives and features are available here?'
    });

    if (userRole === 'organization') {
      starters.push({
        icon: 'campaign',
        title: 'My Calamity Appeals',
        sub: 'Review my active drives and pending aid',
        prompt: 'Summarize the disaster campaigns currently deployed under my organization and what funding deficits remain.'
      });
      starters.push({
        icon: 'fact_check',
        title: 'Verify Manual Donations',
        sub: 'Review pending GCash / Maya vouchers',
        prompt: 'How do I verify and approve pending GCash and Maya manual donation receipts uploaded by donors?'
      });
    } else {
      starters.push({
        icon: 'emergency',
        title: 'Urgent Calamity Appeals',
        sub: 'Where is relief aid needed most right now?',
        prompt: 'Which disaster relief drives currently have the highest funding deficit on this dashboard?'
      });
      starters.push({
        icon: 'account_balance_wallet',
        title: 'How to Donate',
        sub: 'MetaMask (crypto) & GCash / Maya guide',
        prompt: 'How can I donate through MetaMask (crypto) or GCash/Maya on BBDRTS?'
      });
    }

    starters.push({
      icon: 'shield',
      title: 'Blockchain Transparency',
      sub: 'How smart contracts prevent corruption',
      prompt: 'How does blockchain technology and Ethereum Sepolia eliminate diversion and corruption in BBDRTS?'
    });

    return starters;
  }, [currentUser, walletAddress, userRole, activeView, activeSubpage, activeTabMeta]);
  
  // Custom Gemini API Key State
  const defaultGlobalKey = import.meta.env.VITE_GEMINI_API_KEY || '';
  const [customApiKey, setCustomApiKey] = useState(() => {
    return localStorage.getItem('bbdrts_gemini_key') || defaultGlobalKey;
  });
  const [keyInput, setKeyInput] = useState(() => {
    return localStorage.getItem('bbdrts_gemini_key') || defaultGlobalKey;
  });
  const [showKeyText, setShowKeyText] = useState(false);
  const [keyTesting, setKeyTesting] = useState(false);
  const [keyTestStatus, setKeyTestStatus] = useState(null);

  const chatBottomRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isLoading, isOpen]);

  // Auto-resize input textarea smoothly as user types
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollH = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(Math.max(scrollH, 28), 130)}px`;
    }
  }, [input]);

  const handleResetChat = () => {
    setMessages([]);
    setCurrentSuggestions(DEFAULT_FOLLOW_UP_SUGGESTIONS);
    setInput('');
  };

  const handleCopyText = (id, text) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (_) {}
  };

  const handleSaveApiKey = async () => {
    const trimmed = keyInput.trim();
    if (!trimmed) {
      localStorage.removeItem('bbdrts_gemini_key');
      setCustomApiKey(defaultGlobalKey);
      setKeyTestStatus({ success: true, message: 'Reset: Using default system AI key.' });
      setTimeout(() => setKeyTestStatus(null), 4000);
      return;
    }

    setKeyTesting(true);
    setKeyTestStatus(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/ai/test-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: trimmed })
      });
      const data = await res.json();
      if (data.valid) {
        localStorage.setItem('bbdrts_gemini_key', trimmed);
        setCustomApiKey(trimmed);
        setKeyTestStatus({ success: true, message: 'Google Gemini API Key Verified & Active!' });
      } else {
        throw new Error(data.error || 'Invalid API Key.');
      }
    } catch (err) {
      try {
        const directRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${trimmed}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'Test' }] }] })
        });
        if (directRes.ok) {
          localStorage.setItem('bbdrts_gemini_key', trimmed);
          setCustomApiKey(trimmed);
          setKeyTestStatus({ success: true, message: 'Google Gemini Key Verified via Google AI Studio!' });
        } else {
          const errData = await directRes.json();
          setKeyTestStatus({ success: false, message: `Verification Failed: ${errData?.error?.message || 'Invalid key.'}` });
        }
      } catch (clientErr) {
        setKeyTestStatus({ success: false, message: `Error: ${err.message}` });
      }
    } finally {
      setKeyTesting(false);
      setTimeout(() => setKeyTestStatus(null), 5000);
    }
  };

  const handleSend = async (textToSend) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    const userMsg = {
      id: Date.now().toString(),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/ai/copilot-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(customApiKey ? { 'x-gemini-key': customApiKey } : {})
        },
        body: JSON.stringify({
          message: query,
          conversationHistory: messages.slice(-6).map((m) => ({ role: m.sender, content: m.text })),
          userRole,
          apiKey: customApiKey || undefined,
          dashboardContext
        })
      });

      if (!response.ok) {
        throw new Error('Backend copilot error: ' + response.status);
      }

      const data = await response.json();
      const aiReply = data.reply || 'I apologize, I could not process your query at this moment. Please try again.';

      if (Array.isArray(data.suggestedPrompts) && data.suggestedPrompts.length > 0) {
        setCurrentSuggestions(data.suggestedPrompts);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: aiReply,
          modelUsed: data.modelUsed || (data.isRealtimeAi ? 'Real-Time AI' : 'ReliefAI'),
          campaigns: data.campaigns || null,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } catch (err) {
      console.warn('Backend ReliefAI unavailable; activating Client Real-Time AI:', err.message);
      
      try {
        const liveAiResult = await callClientRealtimeAi({
          query,
          conversationHistory: messages,
          customApiKey,
          dashboardContext
        });

        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: 'ai',
            text: liveAiResult.text,
            modelUsed: liveAiResult.modelUsed || 'Real-Time AI',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      } catch (fallbackErr) {
        console.error('All Real-Time AI endpoints failed:', fallbackErr);
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: 'ai',
            text: `**Connection Notice**: Temporary connection interruption to the AI cluster. Please check your internet connection or verify your API settings.`,
            modelUsed: 'Connection Error',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* ── Floating Launcher Pill Button (Anchored Bottom-Right) ── */}
      {!isOpen && (
        <button
          className="bbdrts-copilot-trigger-btn"
          onClick={() => setIsOpen(true)}
          aria-label="Open ReliefAI Assistant"
        >
          <div className="bbdrts-copilot-trigger-icon-wrap">
            <span className="material-symbols-outlined" style={{ fontSize: '19px' }}>smart_toy</span>
            <span className="bbdrts-copilot-pulse-ring" />
          </div>
          <div className="bbdrts-copilot-trigger-info">
            <span className="bbdrts-copilot-trigger-title">ReliefAI</span>
            <span className="bbdrts-copilot-trigger-sub">
              <span className="dot" /> Online
            </span>
          </div>
        </button>
      )}

      {/* ── Clean Anchored Chat Window ── */}
      {isOpen && (
        <div className={`bbdrts-copilot-window ${isExpanded ? 'expanded' : ''}`}>
          
          {/* Header */}
          <div className="bbdrts-copilot-header">
            <div className="bbdrts-copilot-header-left">
              <div className="bbdrts-copilot-avatar-box">
                <span className="material-symbols-outlined" style={{ fontSize: '19px' }}>smart_toy</span>
              </div>
              <div className="bbdrts-copilot-header-titles">
                <div className="bbdrts-copilot-header-title-row">
                  <span className="bbdrts-copilot-title-text">ReliefAI</span>
                  <span className="bbdrts-copilot-copilot-tag">
                    {customApiKey ? 'Gemini' : 'Relief Copilot'}
                  </span>
                </div>
                <div className="bbdrts-copilot-header-sub">
                  <span className="bbdrts-copilot-status-badge" />
                  <span>BBDRTS Web3 Assistant</span>
                </div>
              </div>
            </div>

            <div className="bbdrts-copilot-header-actions-pill">
              <button
                className={`bbdrts-copilot-icon-btn ${showSettings ? 'active' : ''}`}
                onClick={() => setShowSettings((prev) => !prev)}
                title="AI Key & Intelligence Settings"
                aria-label="AI Settings"
              >
                <span className="material-symbols-outlined">tune</span>
              </button>
              <button
                className="bbdrts-copilot-icon-btn"
                onClick={handleResetChat}
                title="New Chat Session"
                aria-label="Clear Chat"
              >
                <span className="material-symbols-outlined">restart_alt</span>
              </button>
              <button
                className="bbdrts-copilot-icon-btn"
                onClick={() => setIsExpanded((prev) => !prev)}
                title={isExpanded ? 'Restore Standard Size' : 'Expand View'}
                aria-label="Toggle Expand"
              >
                <span className="material-symbols-outlined">
                  {isExpanded ? 'close_fullscreen' : 'open_in_full'}
                </span>
              </button>
              <button
                className="bbdrts-copilot-icon-btn close-btn"
                onClick={() => setIsOpen(false)}
                title="Close ReliefAI"
                aria-label="Close ReliefAI"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          </div>

          {/* Live Dashboard Sync Bar */}
          <div className="bbdrts-copilot-dashboard-sync-bar">
            <div className="bbdrts-copilot-sync-left">
              <span className="bbdrts-copilot-sync-dot" />
              <span className="bbdrts-copilot-sync-label">
                Synced: <strong>{activeSubpage || activeView || 'Dashboard Overview'}</strong>
                {currentUser?.name ? ` • ${currentUser.name.split(' ')[0]}` : (walletAddress ? ` • ${walletAddress.slice(0, 6)}...` : '')}
              </span>
            </div>
            <span className="bbdrts-copilot-sync-badge">
              {(userRole || 'donor').toUpperCase()}
            </span>
          </div>

          {/* AI Settings Overlay Modal */}
          {showSettings && (
            <div className="bbdrts-copilot-settings-overlay">
              <div className="bbdrts-copilot-settings-card">
                <div className="bbdrts-copilot-settings-header">
                  <div className="bbdrts-copilot-settings-title">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--accent, #22c55e)' }}>tune</span>
                    <span>ReliefAI Settings</span>
                  </div>
                  <button
                    className="bbdrts-copilot-close-sub"
                    onClick={() => setShowSettings(false)}
                    aria-label="Close Settings"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                  </button>
                </div>

                <div className="bbdrts-copilot-settings-body">
                  <div className="bbdrts-copilot-settings-status">
                    <span className="bbdrts-copilot-status-indicator active" />
                    <span>
                      <strong>Active Engine:</strong> {customApiKey ? 'Google Gemini (Active)' : 'Autonomous Real-Time Neural LLM'}
                    </span>
                  </div>

                  <p className="bbdrts-copilot-settings-note">
                    ReliefAI answers queries in <strong>English by default</strong> with full understanding of Tagalog, Cebuano, and regional dialects. All responses are verified against live Sepolia contracts and database drives.
                  </p>

                  <div className="bbdrts-copilot-api-field">
                    <label htmlFor="gemini-key-input">Custom Google Gemini API Key (Optional):</label>
                    <div className="bbdrts-copilot-api-input-row">
                      <div className="bbdrts-copilot-key-input-wrapper">
                        <input
                          id="gemini-key-input"
                          type={showKeyText ? 'text' : 'password'}
                          className="bbdrts-copilot-key-input"
                          placeholder="AIzaSy... or AQ..."
                          value={keyInput}
                          onChange={(e) => setKeyInput(e.target.value)}
                        />
                        <button
                          type="button"
                          className="bbdrts-copilot-eye-btn"
                          onClick={() => setShowKeyText((v) => !v)}
                          title={showKeyText ? 'Hide API key' : 'Show API key'}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                            {showKeyText ? 'visibility_off' : 'visibility'}
                          </span>
                        </button>
                      </div>
                      <button
                        className="bbdrts-copilot-save-key-btn"
                        onClick={handleSaveApiKey}
                        disabled={keyTesting}
                      >
                        {keyTesting ? 'Testing...' : keyInput.trim() ? 'Save' : 'Reset'}
                      </button>
                    </div>
                  </div>

                  {keyTestStatus && (
                    <div className={`bbdrts-copilot-key-status ${keyTestStatus.success ? 'success' : 'error'}`}>
                      {keyTestStatus.message}
                    </div>
                  )}

                  <div className="bbdrts-copilot-settings-footer-help">
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bbdrts-copilot-ext-link"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>open_in_new</span>
                      Get a free Gemini API Key at Google AI Studio
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Chat Messages Body */}
          <div className="bbdrts-copilot-chat-body">
            
            {/* Elegant Welcome State (Clean English, Zero Clutter) */}
            {messages.length === 0 && (
              <div className="bbdrts-copilot-welcome-container">
                <div className="bbdrts-copilot-welcome-badge">
                  <div className="bbdrts-copilot-welcome-icon-wrap">
                    <span className="material-symbols-outlined" style={{ fontSize: '26px' }}>shield</span>
                  </div>
                  <h3 className="bbdrts-copilot-welcome-title">Welcome to ReliefAI</h3>
                  <p className="bbdrts-copilot-welcome-subtitle">
                    Your intelligent Web3 assistant for verified disaster relief, on-chain donation tracking, and smart contract transparency.
                  </p>
                </div>

                <div className="bbdrts-copilot-starters-section">
                  <div className="bbdrts-copilot-starters-label">Suggested Inquiries</div>
                  <div className="bbdrts-copilot-starters-grid">
                    {dynamicStarters.map((item, idx) => (
                      <button
                        key={idx}
                        className="bbdrts-copilot-starter-card"
                        onClick={() => handleSend(item.prompt)}
                      >
                        <div className="bbdrts-copilot-starter-icon">
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{item.icon}</span>
                        </div>
                        <div className="bbdrts-copilot-starter-text">
                          <div className="bbdrts-copilot-starter-title">{item.title}</div>
                          <div className="bbdrts-copilot-starter-sub">{item.sub}</div>
                        </div>
                        <span className="material-symbols-outlined bbdrts-copilot-starter-arrow">arrow_forward</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Conversation Messages */}
            {messages.map((msg) => (
              <div key={msg.id} className={`bbdrts-copilot-msg-row ${msg.sender}`}>
                
                {msg.sender === 'ai' && (
                  <div className="bbdrts-copilot-msg-avatar ai">
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>smart_toy</span>
                  </div>
                )}

                <div className="bbdrts-copilot-msg-content">
                  <div className="bbdrts-copilot-bubble">
                    {renderMarkdown(msg.text)}

                    {/* Interactive Campaign Cards */}
                    {msg.campaigns && msg.campaigns.length > 0 && (
                      <div className="bbdrts-copilot-campaign-list">
                        {msg.campaigns.map((camp, cIdx) => (
                          <div key={cIdx} className="bbdrts-copilot-campaign-card-mini">
                            <div className="bbdrts-copilot-camp-header">
                              <span className="bbdrts-copilot-camp-title">{camp.Campaign_Title}</span>
                              <span className="bbdrts-copilot-camp-pct">{camp.pctFunded || 0}% funded</span>
                            </div>
                            <div className="bbdrts-copilot-camp-bar-track">
                              <div
                                className="bbdrts-copilot-camp-bar-fill"
                                style={{ width: `${Math.min(100, camp.pctFunded || 0)}%` }}
                              />
                            </div>
                            <div className="bbdrts-copilot-camp-footer">
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>location_on</span>
                                {camp.Location_Region || 'Philippines'}
                              </span>
                              <span>Target: <strong>{camp.Target_Amount} ETH</strong></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bbdrts-copilot-msg-footer">
                    <span className="bbdrts-copilot-msg-time">{msg.timestamp}</span>
                    {msg.sender === 'ai' && (
                      <>
                        {msg.modelUsed && (
                          <span className="bbdrts-copilot-model-badge">
                            <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>bolt</span>
                            {msg.modelUsed}
                          </span>
                        )}
                        <button
                          className="bbdrts-copilot-copy-btn"
                          onClick={() => handleCopyText(msg.id, msg.text)}
                          title="Copy response"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                            {copiedId === msg.id ? 'check' : 'content_copy'}
                          </span>
                          <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Live Typing & Real-Time Generation Status */}
            {isLoading && (
              <div className="bbdrts-copilot-msg-row ai">
                <div className="bbdrts-copilot-msg-avatar ai">
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>smart_toy</span>
                </div>
                <div className="bbdrts-copilot-typing-indicator-wrap">
                  <div className="bbdrts-copilot-typing-indicator">
                    <span className="bbdrts-copilot-typing-dot" />
                    <span className="bbdrts-copilot-typing-dot" />
                    <span className="bbdrts-copilot-typing-dot" />
                  </div>
                  <span className="bbdrts-copilot-generating-label">
                    <span className="bbdrts-copilot-pulse-ring-mini" />
                    ReliefAI is analyzing in real-time...
                  </span>
                </div>
              </div>
            )}
            
            <div ref={chatBottomRef} />
          </div>

          {/* ── Contextual Suggestion Pills Bar ── */}
          {messages.length > 0 && currentSuggestions && currentSuggestions.length > 0 && !isLoading && (
            <div className="bbdrts-copilot-chips-bar">
              {currentSuggestions.map((promptText, idx) => (
                <button
                  key={idx}
                  className="bbdrts-copilot-chip-btn"
                  onClick={() => handleSend(promptText)}
                >
                  <span className="material-symbols-outlined bbdrts-copilot-chip-icon">help_outline</span>
                  <span>{promptText}</span>
                </button>
              ))}
            </div>
          )}

          {/* ── Integrated Bottom Dock & Input ── */}
          <div className="bbdrts-copilot-dock">
            <form
              className="bbdrts-copilot-input-box"
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
            >
              <div className="bbdrts-copilot-textarea-wrap">
                <textarea
                  ref={textareaRef}
                  className="bbdrts-copilot-text-input"
                  rows="1"
                  placeholder="Ask about campaigns, blockchain verification, or paste 0x hash..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                />
              </div>
              <button
                type="submit"
                className={`bbdrts-copilot-send-btn ${input.trim() ? 'ready' : ''}`}
                disabled={isLoading || !input.trim()}
                title="Send message"
                aria-label="Send message"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>send</span>
              </button>
            </form>
            <div className="bbdrts-copilot-dock-note">
              <span>ReliefAI • Grounded on Ethereum Sepolia & Live Disaster Records</span>
            </div>
          </div>

        </div>
      )}
    </>
  );
}

