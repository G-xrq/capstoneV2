/**
 * Contextual In-Page Spotlight Guides (strictly current-page flow elements only).
 * Powered directly by GuidedTour.jsx for 1:1 visual & motion parity with the sidebar tour.
 * Each step accepts `selector` (string or array of fallback selectors).
 * Hidden, missing, or position:absolute/fixed overlay elements are automatically skipped.
 */
export const PAGE_GUIDES = {
  /* ═══════════════════════════════════════════════════════════════════════════
     NGO WORKSPACE (OrganizationView.jsx)
     ═══════════════════════════════════════════════════════════════════════════ */
  'ngo.dashboard': {
    title: 'Dashboard Overview',
    steps: [
      {
        selector: ['#tour-ngo-identity'],
        badge: 'NGO Dashboard · Identity',
        title: 'Accredited Organization Profile & Standing',
        description: 'Displays your official organization name, avatar, SEC/DSWD verification badge, and public transparency standing visible to donors across BBDRTS.'
      },
      {
        selector: ['#tour-ngo-actions'],
        badge: 'NGO Dashboard · Quick Actions',
        title: 'Primary Operational Shortcuts',
        description: 'Launch a new emergency relief campaign, jump directly into your Donation Ledger to verify incoming slips, or refresh live escrow balances with one click.'
      },
      {
        selector: ['.dbo-pending-banner'],
        badge: 'NGO Dashboard · Action Required',
        title: 'Pending Payment Slips Alert',
        description: 'Whenever donors upload GCash, Maya, or Bank transfer receipts awaiting your statement cross-check, this banner highlights how many slips need review.'
      },
      {
        selector: ['#tour-ngo-metrics'],
        badge: 'NGO Dashboard · Live Telemetry',
        title: 'Fundraising, Escrow & Verification Metrics',
        description: 'Four real-time metrics track your total verified PHP mobilized, active relief drives, pending payment slips, and escrow funds disbursed with proof. Click any interactive stat to open its dedicated view.'
      },
      {
        selector: ['.dbo-spotlight-card'],
        badge: 'NGO Dashboard · Lead Operation',
        title: 'Primary Active Relief Campaign',
        description: 'Highlights your lead campaign with live PHP funding progress, target location, and quick shortcuts to inspect the public ledger or disburse escrow funds.'
      },
      {
        selector: ['.dbo-secondary-grid'],
        badge: 'NGO Dashboard · Active Drives',
        title: 'Additional Deployed Campaigns',
        description: 'Monitor funding pacing across your other active drives side-by-side and jump directly into disbursement or ledger auditing.'
      },
      {
        selector: ['.dbo-ledger-card'],
        badge: 'NGO Dashboard · Inbound Feed',
        title: 'Recent Verified Donations Feed',
        description: 'Tracks your newest confirmed contributions in real time with payment channel tags, verified PHP amounts, and Sepolia Etherscan proof links.'
      }
    ]
  },

  'ngo.allCampaigns': {
    title: 'All Relief Campaigns',
    steps: [
      {
        selector: ['#tour-ngo-all-campaigns-header .admin-page-header-actions'],
        badge: 'All Campaigns · Live Sync',
        title: 'Refresh Nationwide Relief Directory',
        description: 'Re-query the database and blockchain ledger to load newly launched public emergency campaigns across all accredited NGOs.'
      },
      {
        selector: ['.toolbar-filters-left', '.campaign-toolbar-card'],
        badge: 'All Campaigns · Filters',
        title: 'Status, Category & Region Filters',
        description: 'Filter nationwide campaigns by Active or Concluded status, Disaster Relief (DR) vs. Charitable Aid (CD), and specific Philippine regions.'
      },
      {
        selector: ['.toolbar-search-right', '.campaign-toolbar-search-box'],
        badge: 'All Campaigns · Search & Sort',
        title: 'Instant Search & Sort Controls',
        description: 'Search by campaign title, NGO name, municipality, or tag, and sort drives by newest, urgency, or funding progress.'
      },
      {
        selector: ['.campaign-card'],
        badge: 'All Campaigns · Audited Cards',
        title: 'Public Relief Campaign Cards',
        description: 'Inspect any accredited drive to view live PHP raised, donations received, its Public Blockchain Ledger, and verified Disbursement Proofs.'
      }
    ]
  },

  'ngo.myCampaigns': {
    title: 'My Campaigns',
    steps: [
      {
        selector: ['#tour-ngo-my-campaigns-header .admin-page-header-actions'],
        badge: 'My Campaigns · Actions',
        title: 'Deploy New Drive & Sync Escrow',
        description: 'Launch a new relief campaign or refresh your live raised balances and available escrow across all organization drives.'
      },
      {
        selector: ['.campaign-toolbar-card'],
        badge: 'My Campaigns · Filter Bar',
        title: 'Filter, Search & Sort Your Operations',
        description: 'Quickly narrow your own campaigns by Active or Concluded status, Disaster Relief vs. Charitable Aid, keyword search, or sort order.'
      },
      {
        selector: ['.campaign-toolbar-substrip'],
        badge: 'My Campaigns · View Mode',
        title: 'Drive Count & Layout Switcher',
        description: 'Check how many drives match your current filters and switch cleanly between Grid Cards and Compact List layout.'
      },
      {
        selector: ['.campaign-card'],
        badge: 'My Campaigns · Escrow Controls',
        title: 'Disburse Funds, Edit & Audit Ledger',
        description: 'Each card displays your live raised PHP, available escrow, and donations received. Click Disburse Funds to release aid with itemized receipts and RA 10173 face-blurred delivery photos, or inspect the public ledger.'
      }
    ]
  },

  'ngo.create': {
    title: 'Create Campaign',
    steps: [
      {
        selector: ['#tour-ngo-create-header .admin-page-header-actions', '#tour-ngo-create-header'],
        badge: 'Create Campaign · Header',
        title: 'AI Budget Assistant & Accreditation Status',
        description: 'Use the AI Smart Budget Generator to estimate fair relief targets, and confirm your organization is SEC-approved to publish live campaigns.'
      },
      {
        selector: ['.deploy-stepper-bar'],
        badge: 'Create Campaign · 5-Step Wizard',
        title: 'Structured 5-Stage Campaign Deployment',
        description: 'Move seamlessly across 01 Overview (title & PHP goal), 02 Story & Media (with automatic RA 10173 face-blur), 03 Relief Focus tags, 04 Ground Zero map pin, and 05 Official GCash/Maya/Bank payout rails.'
      },
      {
        selector: ['.deploy-section-card', '.dc-form'],
        badge: 'Create Campaign · Active Stage',
        title: 'Complete the Active Deployment Step',
        description: 'Fill out the highlighted step fields — uploaded photos are automatically scanned on-device to protect beneficiary faces, and saved QR vouchers from Settings can be attached on Step 5.'
      }
    ]
  },

  'ngo.ledger': {
    title: 'Donation Ledger',
    steps: [
      {
        selector: ['#tour-ngo-ledger-header .admin-page-header-actions'],
        badge: 'Donation Ledger · Actions',
        title: 'Sync Ledger, Log Deposit & Export Reports',
        description: 'Sync fresh on-chain receipts, manually declare a direct bank/e-wallet deposit received without a donor upload, or export organized Excel, CSV, and Audit PDF financial reports.'
      },
      {
        selector: ['.ledger-kpi-strip'],
        badge: 'Donation Ledger · Telemetry',
        title: 'Verified Volume, Receipts & Pending Review',
        description: 'Track your Sepolia-audited total PHP volume, recorded receipts across GCash/Maya/Bank, and click the Pending Review metric anytime slips are waiting.'
      },
      {
        selector: ['.ledger-tab-bar'],
        badge: 'Donation Ledger · Navigation',
        title: 'Payment Channel Tabs & Dedicated Pending Queue',
        description: 'Filter verified receipts by GCash, Maya, or Card & Bank — or click Pending Review to switch cleanly into the full payment slip verification queue.'
      },
      {
        selector: ['.ledger-pending-strip', '.pvq-card'],
        badge: 'Donation Ledger · Verification',
        title: 'Cross-Verify Uploaded Payment Slips',
        description: 'Open Pending Review to inspect each AI-audited receipt, cross-check the amount against your official statement, confirm onto Sepolia (with mandatory audit justification on any discrepancy), or reject invalid slips.'
      },
      {
        selector: ['.ledger-tab-bar ~ div input[type="text"]'],
        badge: 'Donation Ledger · Filters',
        title: 'Search, Filter & Switch Cards/Table View',
        description: 'Search by tx hash, campaign, or donor; filter by category or specific campaign; sort by date or amount; and toggle between Cards and Table view.'
      }
    ]
  },

  'ngo.secKyc': {
    title: 'SEC Accreditation & KYC',
    steps: [
      {
        selector: ['#tour-ngo-sec-header .admin-page-header-actions', '#tour-ngo-sec-header'],
        badge: 'Accreditation · Status',
        title: 'Institutional Verification & Compliance',
        description: 'Manage your organization legal accreditation required to publish verified relief campaigns and receive public donations on BBDRTS.'
      },
      {
        selector: ['.sec-rail-card'],
        badge: 'Accreditation · Progress',
        title: '4-Stage Regulatory Verification Rail',
        description: 'Tracks your status from account setup and SEC/ID document upload through Administrator review to full Verified Partner accreditation.'
      },
      {
        selector: ['.sec-registry-card', '.sec-approved-layout', '#tour-ngo-sec-header ~ div'],
        badge: 'Accreditation · Credentials',
        title: 'SEC Certificate, TIN & Signatory Documents',
        description: 'Inspect your verified SEC registration, TIN, DSWD number, and official certificates — or submit updated accreditation documents for review.'
      }
    ]
  },

  'ngo.radar': {
    title: 'Relief Radar',
    steps: [
      {
        selector: ['#tour-ngo-radar-header .admin-page-header-actions'],
        badge: 'Relief Radar · Live Sync',
        title: 'Sync Live Geospatial Telemetry',
        description: 'Refresh nationwide relief pins and live funding metrics directly from the ledger.'
      },
      {
        selector: ['.radar-region-segmented-control'],
        badge: 'Relief Radar · Quick Regions',
        title: 'Island Group Focus Presets',
        description: 'Jump cleanly across All Philippines, Luzon, Visayas, or Mindanao to evaluate regional disaster coverage.'
      },
      {
        selector: ['.radar-bar-right'],
        badge: 'Relief Radar · Controls',
        title: 'Active Operations, Density & Fullscreen',
        description: 'Monitor active tracked operations, toggle density heatmap simulation, recenter the map, or expand into Fullscreen mode for strategic dispatch planning.'
      },
      {
        selector: ['.radar-map-viewport'],
        badge: 'Relief Radar · Interactive Map',
        title: 'Hotspot Pins, Weather HUD & Basemap Layers',
        description: 'Click any campaign pin to inspect raised PHP and donations received. Use the on-map top-left HUD for PAGASA weather overlays, the bottom-left dock for Terrain/Satellite/Dark/Provinces layers, and +/- or Ctrl + scroll to zoom.'
      }
    ]
  },

  /* ═══════════════════════════════════════════════════════════════════════════
     DONOR WORKSPACE (DonorView.jsx)
     ═══════════════════════════════════════════════════════════════════════════ */
  'donor.dashboard': {
    title: 'Dashboard Overview',
    steps: [
      {
        selector: ['#tour-donor-identity'],
        badge: 'Dashboard · Identity & Tier',
        title: 'Your Verified Donor Profile & Recognition Tier',
        description: 'Displays your donor identity, current recognition badge, and active standing on BBDRTS. Every verified PHP contribution you make automatically advances your donor tier across 15 milestones.'
      },
      {
        selector: ['#tour-donor-actions'],
        badge: 'Dashboard · Quick Actions',
        title: 'One-Click Giving & Verification Shortcuts',
        description: 'Use these command buttons to jump directly into active disaster appeals, open your verified receipt archive, or refresh live balances straight from the blockchain and database.'
      },
      {
        selector: ['.dbo-pending-banner'],
        badge: 'Dashboard · Pending Slips',
        title: 'Pending Payment Slip Status',
        description: 'Whenever you have uploaded a GCash, Maya, or Bank transfer slip awaiting NGO confirmation, this alert tracks how many receipts are in review so you know when funds settle on-chain.'
      },
      {
        selector: ['#tour-donor-metrics'],
        badge: 'Dashboard · Impact Telemetry',
        title: 'Live Giving Metrics & Contribution Trend',
        description: 'Four real-time metrics track your total PHP contributed (with a live trend sparkline), currently open emergency appeals, estimated families aided, and verified Sepolia receipts. Click any interactive stat to jump straight to its detailed view.'
      },
      {
        selector: ['#tour-donor-first-campaign', '#tour-donor-featured-causes'],
        badge: 'Dashboard · Priority Appeal',
        title: 'Featured Urgent Relief Campaign',
        description: 'Spotlights the highest-priority active disaster drive with its category chip, location, live PHP funding progress bar, and accredited NGO. Click the ledger button to audit its public transactions first, or click Donate to contribute directly.'
      },
      {
        selector: ['.dbo-secondary-grid'],
        badge: 'Dashboard · More Active Drives',
        title: 'Additional Verified Appeals',
        description: 'Quickly compare additional active drives side-by-side — checking funding progress, target locations, and jumping directly into their public ledger or donation form.'
      },
      {
        selector: ['.dbo-ledger-card'],
        badge: 'Dashboard · Activity Feed',
        title: 'Recent Verified Contributions & Etherscan Proof',
        description: 'Lists your latest contributions with payment channel tags (GCash, Maya, Card/Bank), verified PHP amounts, and direct Etherscan links to each gasless Sepolia audit record.'
      }
    ]
  },

  'donor.campaigns': {
    title: 'Explore Campaigns',
    steps: [
      {
        selector: ['.ec-head-stats'],
        badge: 'Explore · Live Registry',
        title: 'Platform-Wide Relief Snapshot',
        description: 'Shows the cumulative verified PHP raised across all accredited drives, how many active emergency campaigns are open right now, and how many have reached 100% of their funding goal.'
      },
      {
        selector: ['.ec-search-box'],
        badge: 'Explore · Instant Search',
        title: 'Search Drives, NGOs & Locations (Ctrl+K)',
        description: 'Type any campaign title, accredited NGO name, province, municipality, or disaster tag to filter drives instantaneously. Press Ctrl+K (or Cmd+K) anywhere on this page to jump directly into search.'
      },
      {
        selector: ['.ec-filters-group'],
        badge: 'Explore · Precision Filters',
        title: 'Status, Category, Region & Sort Controls',
        description: 'Switch between Active and Concluded drives, narrow down to Disaster Relief (DR) or Charitable Aid (CD), filter by Philippine province, and sort by urgency, newest drives, or highest progress.'
      },
      {
        selector: ['#tour-campaigns-container .campaign-card', '.campaign-card'],
        badge: 'Explore · Campaign Card',
        title: 'Transparent Audited Campaign Cards',
        description: 'Every card displays the verified NGO, target location, live PHP raised vs. goal, and total donations received. Use the card buttons to inspect the Public Blockchain Ledger, view ground-zero Disbursement Proofs (delivery photos & receipts), or donate via GCash, Maya, or Bank/Card.'
      }
    ]
  },

  'donor.donations': {
    title: 'My Contributions',
    steps: [
      {
        selector: ['#tour-donations-header .admin-page-header-actions'],
        badge: 'Contributions · Reports & Sync',
        title: 'Export Giving Reports & Sync Receipts',
        description: 'Click Export Report to download a filtered Excel, CSV, or print-ready PDF dossier of your donations. Click Sync Receipts anytime to pull the latest NGO confirmations and Sepolia hashes.'
      },
      {
        selector: ['.rcp-summary-band'],
        badge: 'Contributions · Audit Summary',
        title: 'Total Impact & Discrepancy Balance Status',
        description: 'Summarizes your total notarized PHP contributions, receipt breakdown (Disaster Relief vs. Charitable Aid), unique campaigns supported, and a live reconciliation pill confirming whether all your donations are 100% Balanced or if any shortage/variance was flagged.'
      },
      {
        selector: ['.rcp-analytics-split > *:first-child'],
        badge: 'Contributions · Giving Timeline',
        title: 'Personal Contribution Analytics Chart',
        description: 'Plots your giving history over time so you can visualize how your contributions have accumulated across relief drives.'
      },
      {
        selector: ['.rcp-channels-card'],
        badge: 'Contributions · Payment Rails',
        title: 'Channel Share Breakdown (0% Markup)',
        description: 'Breaks down what percentage of your contributions were sent via GCash, Card/Bank, and Maya — all recorded with zero platform markup and gasless Sepolia notarization.'
      },
      {
        selector: ['.rcp-panel-toolbar'],
        badge: 'Contributions · Filter Ledger',
        title: 'Search & Filter Your Receipt Archive',
        description: 'Search by campaign name, reference code, or transaction hash, and filter by category or payment rail to locate any specific receipt in seconds.'
      },
      {
        selector: ['.rcp-ledger-panel'],
        badge: 'Contributions · Receipts & Disputes',
        title: 'Digital Vouchers, Payment Slips & Audit Disputes',
        description: 'From each verified row you can inspect your original uploaded payment slip, open your official printable voucher, verify the transaction directly on Sepolia Etherscan, or file a formal Audit Dispute if an NGO credited a different amount than you sent.'
      }
    ]
  },

  'donor.radar': {
    title: 'Relief Radar',
    steps: [
      {
        selector: ['#tour-radar-header .admin-page-header-actions'],
        badge: 'Relief Radar · Live Sync',
        title: 'Sync Live Geospatial Telemetry',
        description: 'Refresh the map directly from the live database and smart contract ledger to load newly launched drives and updated funding totals.'
      },
      {
        selector: ['.radar-region-segmented-control'],
        badge: 'Relief Radar · Quick Regions',
        title: 'Island Group Focus Presets',
        description: 'Recenter the map in one click across All Philippines, Luzon, Visayas, or Mindanao without dragging manually.'
      },
      {
        selector: ['.radar-bar-right'],
        badge: 'Relief Radar · Command Controls',
        title: 'Live Operations Counter, Density & Fullscreen',
        description: 'View tracked relief operations and Philippine Standard Time (UTC+8), toggle density heatmap intensity, recenter the map, or expand into Fullscreen mode for full scroll-wheel zooming.'
      },
      {
        selector: ['.radar-map-viewport'],
        badge: 'Relief Radar · Interactive Map',
        title: 'Campaign Pins, Weather HUD & Basemap Switcher',
        description: 'Click any glowing pin to open its campaign dossier (raised PHP, donations received, and quick Donate link). Inside the map, use the top-left HUD for live PAGASA weather overlays, the bottom-left dock to switch Terrain/Satellite/Dark/Provinces layers, and +/- or Ctrl + scroll to zoom safely.'
      }
    ]
  },

  /* ═══════════════════════════════════════════════════════════════════════════
     ADMINISTRATOR WORKSPACE (AdminView.jsx & Admin Sub-Panels)
     ═══════════════════════════════════════════════════════════════════════════ */
  'admin.dashboard': {
    title: 'Dashboard Overview',
    steps: [
      {
        selector: ['.admin-page-header .admin-page-header-actions'],
        badge: 'Admin Command · Controls',
        title: 'Live Platform Sync & Governance Actions',
        description: 'Refresh platform-wide telemetry directly from TiDB and Ethereum Sepolia or jump into live operational controls.'
      },
      {
        selector: ['.admin-metric-strip'],
        badge: 'Admin Command · Platform KPIs',
        title: 'Five-Pillar Governance Telemetry Strip',
        description: 'Monitors total verified platform funds, active relief campaigns, accredited NGOs, pending SEC/KYC applications, and live Sepolia audit health. Click any interactive KPI cell to open its management queue.'
      },
      {
        selector: ['#guide-admin-recent-tx'],
        badge: 'Admin Command · Contributions',
        title: 'Recent Multi-Rail Contributions Stream',
        description: 'Inspect the latest donations arriving across GCash, Maya, Card, and Bank channels, check Sepolia notarization status, or click View Ledger for full reconciliation.'
      },
      {
        selector: ['#guide-admin-kyc-queue'],
        badge: 'Admin Command · Compliance Queue',
        title: 'SEC Regulatory KYC Approval Queue',
        description: 'Highlights pending NGO accreditation submissions awaiting legal review so you can inspect SEC certificates and approve qualified partners promptly.'
      },
      {
        selector: ['#guide-admin-recent-logs'],
        badge: 'Admin Command · Security Feed',
        title: 'Recent System Activity & Audit Logs',
        description: 'Tracks real-time administrative actions, amount discrepancy alerts, and security events across the entire platform.'
      }
    ]
  },

  'admin.activeUsers': {
    title: 'Live Active Users',
    steps: [
      {
        selector: ['.admin-presence-panel .admin-page-header .admin-page-header-actions', '.admin-presence-panel .admin-page-header'],
        badge: 'Active Users · Stream Controls',
        title: 'Live Presence Polling & Manual Refresh',
        description: 'Monitor real-time active sessions across BBDRTS, pause or resume live polling, and trigger an immediate presence refresh.'
      },
      {
        selector: ['.admin-presence-panel .admin-metric-strip', '.presence-kpi-grid'],
        badge: 'Active Users · Breakdown',
        title: 'Role & Session Distribution',
        description: 'Distinguishes signed-in Donors, NGOs, and Administrators from anonymous guest visitors currently browsing the platform.'
      },
      {
        selector: ['.admin-presence-panel .vercel-admin-card', '.presence-table-wrap'],
        badge: 'Active Users · Live Roster',
        title: 'Connected Users & Current Route Activity',
        description: 'Inspect each active session, role badge, current view, device/browser context, and last heartbeat timestamp.'
      }
    ]
  },

  'admin.monitoring': {
    title: 'System Activity Logs',
    steps: [
      {
        selector: ['.admin-page-header .admin-page-header-actions'],
        badge: 'Activity Logs · Actions',
        title: 'Refresh & Export Audit Trail',
        description: 'Pull the newest server-logged events or export filtered audit records for compliance documentation.'
      },
      {
        selector: ['.admin-metric-strip'],
        badge: 'Activity Logs · Summary',
        title: 'Event Volume & Security Alert Counters',
        description: 'Summarizes total recorded events, successful operations, active role actions, and flagged security/discrepancy warnings.'
      },
      {
        selector: ['.toolbar-filters-left'],
        badge: 'Activity Logs · Filters',
        title: 'Category, Role & Timeframe Filters',
        description: 'Narrow logs specifically to Admin Security alerts, Donation verifications, NGO KYC decisions, or Auth events over any date range.'
      },
      {
        selector: ['.toolbar-search-right', '.campaign-toolbar-search-box'],
        badge: 'Activity Logs · Search',
        title: 'Search by Actor, Email or Reference',
        description: 'Locate any specific audit entry instantly by typing a user email, organization name, campaign ID, or receipt reference.'
      },
      {
        selector: ['.vercel-admin-card', '.vercel-data-table'],
        badge: 'Activity Logs · Ledger',
        title: 'Immutable Activity Feed',
        description: 'Inspect full timestamped audit rows including actor role, event category, outcome status, and detailed technical metadata.'
      }
    ]
  },

  'admin.finance': {
    title: 'Financial Ledger',
    steps: [
      {
        selector: ['.admin-page-header .admin-page-header-actions'],
        badge: 'Financial Ledger · Controls',
        title: 'Sync Ledger & Export Governance Reports',
        description: 'Re-query all verified and pending multi-rail transactions across every NGO or export filtered financial reports (Excel, CSV, PDF).'
      },
      {
        selector: ['.admin-metric-strip'],
        badge: 'Financial Ledger · Telemetry',
        title: 'Cross-Platform Volume & Pending Slips',
        description: 'Track global notarized PHP volume, verified receipt count, payment rail distribution, and pending manual slips awaiting verification.'
      },
      {
        selector: ['.toolbar-filters-left'],
        badge: 'Financial Ledger · Filters',
        title: 'Channel, Status & Category Filters',
        description: 'Filter global receipts by GCash, Maya, Card/Bank, Verified vs. Pending status, or Disaster Relief vs. Charitable Aid.'
      },
      {
        selector: ['.toolbar-search-right', '.campaign-toolbar-search-box'],
        badge: 'Financial Ledger · Search',
        title: 'Instant Transaction Search (Ctrl+K)',
        description: 'Find any donation across the platform by reference number, Sepolia tx hash, donor email, NGO, or campaign title.'
      },
      {
        selector: ['.vercel-admin-card', '.vercel-data-table'],
        badge: 'Financial Ledger · Audit Dossier',
        title: 'Global Multi-Rail Transactions & AI Dossiers',
        description: 'Click any row to open its full Payment Slip & AI Audit Dossier, inspect variance/shortage flags, or verify the cryptographic hash on Sepolia Etherscan.'
      }
    ]
  },

  'admin.disbursements': {
    title: 'Disbursement & Procurement',
    steps: [
      {
        selector: ['.admin-page-header .admin-page-header-actions'],
        badge: 'Disbursements · Sync',
        title: 'Refresh & Export Escrow Releases',
        description: 'Pull the latest NGO aid disbursements and export procurement audit summaries.'
      },
      {
        selector: ['.campaign-toolbar-card'],
        badge: 'Disbursements · Filter Bar',
        title: 'Filter by Category & Search Releases',
        description: 'Filter disbursement batches by aid category (Food, Medical, Shelter, Logistics) or search by NGO, campaign, and milestone description.'
      },
      {
        selector: ['.vercel-admin-card', '.vercel-data-table'],
        badge: 'Disbursements · Proof Audit',
        title: 'Verify Ground Delivery Photos & Receipts',
        description: 'Inspect each NGO escrow release, itemized procurement breakdown, attached merchant receipts, RA 10173 face-blurred relief photos, and Sepolia proof hash.'
      }
    ]
  },

  'admin.disputes': {
    title: 'Donation Audit Disputes',
    steps: [
      {
        selector: ['.admin-page-header'],
        badge: 'Disputes · Governance',
        title: 'Two-Sided Discrepancy Resolution Center',
        description: 'Handles formal disputes opened by donors whenever an NGO credits a different amount than declared on a payment slip.'
      },
      {
        selector: ['.admin-page-header + div'],
        badge: 'Disputes · Evidence & Verdicts',
        title: 'Inspect Both Sides & Issue Official Rulings',
        description: 'Compare the original uploaded slip, donor bank/GCash proof, NGO counter-statement, and AI OCR audit side-by-side, then record a formal verdict (Upheld NGO Fault, Dismissed Donor Error, or Mutual Adjustment) that notifies both parties.'
      }
    ]
  },

  'admin.campaigns': {
    title: 'All Campaigns',
    steps: [
      {
        selector: ['.admin-page-header .admin-page-header-actions'],
        badge: 'Campaigns · Oversight',
        title: 'Refresh Platform Campaign Registry',
        description: 'Sync every active and concluded relief drive across all accredited organizations.'
      },
      {
        selector: ['.toolbar-filters-left'],
        badge: 'Campaigns · Filters',
        title: 'Filter by Status, Category & Accreditation',
        description: 'Narrow drives to Active, Concluded, Disaster Relief, or Charitable Aid to focus your moderation review.'
      },
      {
        selector: ['.toolbar-search-right', '.campaign-toolbar-search-box'],
        badge: 'Campaigns · Search',
        title: 'Search Drives, NGOs & Locations',
        description: 'Search immediately by campaign title, campaign ID, organization name, or affected province.'
      },
      {
        selector: ['.campaign-toolbar-substrip ~ div', '.campaign-card', '.vercel-admin-card'],
        badge: 'Campaigns · Moderation',
        title: 'Audit Escrow Progress & Moderate Status',
        description: 'Review raised volume vs. disbursed escrow, inspect public ledgers and proofs, and pause or reactivate drives when governance intervention is required.'
      }
    ]
  },

  'admin.radar': {
    title: 'Relief Radar',
    steps: [
      {
        selector: ['.admin-page-header'],
        badge: 'Relief Radar · Oversight',
        title: 'Nationwide Relief Operations Map',
        description: 'Monitor active emergency campaigns and regional funding density across every Philippine province in real time.'
      },
      {
        selector: ['.radar-region-segmented-control'],
        badge: 'Relief Radar · Regions',
        title: 'Island Group Focus Presets',
        description: 'Switch immediately between All Philippines, Luzon, Visayas, and Mindanao.'
      },
      {
        selector: ['.radar-bar-right'],
        badge: 'Relief Radar · Controls',
        title: 'Operations Telemetry, Density & Fullscreen',
        description: 'View tracked operation totals, toggle density simulation halos, recenter the map, or expand into Fullscreen mode.'
      },
      {
        selector: ['.radar-map-viewport'],
        badge: 'Relief Radar · Interactive Map',
        title: 'Hotspot Pins, Weather HUD & Basemap Switcher',
        description: 'Click any campaign pin to inspect raised funds and donations received. Use the on-map HUD for PAGASA weather overlays, the bottom-left dock for Terrain/Satellite/Dark/Provinces layers, and +/- or Ctrl + scroll to zoom.'
      }
    ]
  },

  'admin.donors': {
    title: 'Donor Accounts & Credential Recovery',
    steps: [
      {
        selector: ['.admin-page-header'],
        badge: 'Donor Directory · Overview',
        title: 'Registered Supporter Oversight',
        description: 'Manage registered donor accounts, view verified giving totals, and assist supporters with account security or credential recovery.'
      },
      {
        selector: ['.admin-page-header + div'],
        badge: 'Donor Directory · Search & Actions',
        title: 'Search Accounts & Manage Access',
        description: 'Filter donors by name, email, or BBDRTS Donor ID, inspect verification status, and oversee account standing.'
      }
    ]
  },

  'admin.kyc': {
    title: 'KYC Approval',
    steps: [
      {
        selector: ['.admin-page-header .admin-page-header-actions'],
        badge: 'KYC Approval · Actions',
        title: 'Refresh Incoming NGO Applications',
        description: 'Pull newly submitted SEC accreditation and KYC dossiers awaiting administrator review.'
      },
      {
        selector: ['.campaign-toolbar-card'],
        badge: 'KYC Approval · Filter Bar',
        title: 'Filter & Search Pending Applications',
        description: 'Filter by review status and search applicants by organization name, email, SEC registration number, or TIN.'
      },
      {
        selector: ['.vercel-admin-card'],
        badge: 'KYC Approval · Document Audit',
        title: 'Inspect Legal Credentials & Decide',
        description: 'Open each applicant SEC Certificate of Incorporation and authorized representative IDs, then Approve to grant campaign publishing access or Reject with a clear audit reason.'
      }
    ]
  },

  'admin.accreditedNgos': {
    title: 'Accredited NGOs',
    steps: [
      {
        selector: ['.admin-page-header .admin-page-header-actions'],
        badge: 'Accredited NGOs · Actions',
        title: 'Sync Partner Directory',
        description: 'Refresh live fundraising totals, campaign counts, and compliance standing across all approved partner organizations.'
      },
      {
        selector: ['.campaign-toolbar-card'],
        badge: 'Accredited NGOs · Search',
        title: 'Filter Approved Organizations',
        description: 'Search partner NGOs by name, registration number, or email to inspect a specific organization record.'
      },
      {
        selector: ['.vercel-admin-card', '.vercel-data-table'],
        badge: 'Accredited NGOs · Governance',
        title: 'Monitor Compliance & Manage Standing',
        description: 'Review each accredited NGO verified volume, SEC certificate, active drives, or suspend/revoke privileges if audit violations occur.'
      }
    ]
  },

  'admin.broadcast': {
    title: 'Broadcast & Alerts',
    steps: [
      {
        selector: ['.admin-page-header .admin-page-header-actions'],
        badge: 'Broadcasts · Sync',
        title: 'Refresh Active Platform Advisories',
        description: 'Sync currently active disaster warnings, typhoon alerts, and global banners visible across all portals.'
      },
      {
        selector: ['.admin-page-header + div'],
        badge: 'Broadcasts · Composer & Feed',
        title: 'Publish Targeted Warnings & Manage Banners',
        description: 'Compose severity-tagged announcements (Info, Warning, Critical), target specific roles (All, Donors, NGOs), and deactivate resolved advisories in one click.'
      }
    ]
  },

  'admin.systemOps': {
    title: 'System Operations',
    steps: [
      {
        selector: ['.admin-page-header .admin-page-header-actions'],
        badge: 'System Ops · Quick Action',
        title: 'Snapshots & Maintenance Actions',
        description: 'Trigger an immediate off-chain compliance database backup or refresh maintenance status controls.'
      },
      {
        selector: ['.admin-page-header + div'],
        badge: 'System Ops · Governance Controls',
        title: 'Database Backups & Granular Maintenance Mode',
        description: 'Download regulatory database snapshots or schedule scoped maintenance windows with custom notices so donors and NGOs never encounter confusing downtime.'
      }
    ]
  },

  /* ═══════════════════════════════════════════════════════════════════════════
     SHARED PANELS (AnalyticsReportsPanel.jsx & SettingsPanel.jsx)
     ═══════════════════════════════════════════════════════════════════════════ */
  'shared.analytics': {
    title: 'Analytics & Reports',
    steps: [
      {
        selector: ['.va-range-group'],
        badge: 'Analytics · Time Window',
        title: 'Switch Reporting Timeframe',
        description: 'Toggle between 7D, 30D, 90D, and All-Time windows to recalculate every KPI, trend curve, channel breakdown, and table row instantly.'
      },
      {
        selector: ['.va-export-wrap'],
        badge: 'Analytics · Multi-Format Export',
        title: 'Download Excel, Executive PDF, CSV & JSON',
        description: 'Export formatted 6-sheet Excel workbooks, print-ready Executive PDF reports, UTF-8 CSV tables, or complete Audit JSON archives.'
      },
      {
        selector: ['.va-kpi-grid'],
        badge: 'Analytics · Interactive KPIs',
        title: 'Interactive Metric Tabs & Velocity Chart',
        description: 'Click Mobilized, Avg Donation, or Disbursed to switch the live area chart directly below and inspect goal pacing over time.'
      },
      {
        selector: ['.va-cohort-card'],
        badge: 'Analytics · Cohorts',
        title: 'Donor & NGO Verification Cohorts',
        description: 'Review supporter verification rates, anonymous vs. verified giving share, and organization accreditation standing.'
      },
      {
        selector: ['.va-card-tabbar'],
        badge: 'Analytics · Breakdowns',
        title: 'Switch Analytical Breakdowns & Performance Matrix',
        description: 'Explore channel distribution, category shares, and scroll down to the flush Performance Matrix table ranking every campaign.'
      }
    ]
  },

  'shared.settings': {
    title: 'Profile & Settings',
    steps: [
      {
        selector: ['.vs-primary-btn'],
        badge: 'Settings · Profile Identity',
        title: 'Edit Your Account Identity & Avatar',
        description: 'Click Edit Profile to update your display name, avatar, contact details, location, bio, and anonymity preference for public donation ledgers.'
      },
      {
        selector: ['.vs-tabs'],
        badge: 'Settings · Navigation Tabs',
        title: 'Switch Between Settings Categories',
        description: 'Jump between Profile details, QR & Payout Rails (for NGOs), Workspace Preferences (Dark/Light mode, High Contrast, Data Saver, language), Account Security (password & 2FA), and Ledger & System tools.'
      },
      {
        selector: ['.vs-content'],
        badge: 'Settings · Active Controls',
        title: 'Live Account & Accessibility Configuration',
        description: 'Every change you make here — from saving reusable GCash/Maya QR codes to enabling Two-Factor Authentication or switching theme — applies immediately and persists across sessions.'
      }
    ]
  }
};
