/**
 * Contextual In-Page Spotlight Guides (strictly current-page normal-flow elements).
 * Powered directly by GuidedTour.jsx for 1:1 visual & motion parity with the sidebar tour.
 * Each step accepts `selector` (string or array of fallback selectors).
 * Hidden, missing, or position:absolute/fixed overlay elements are automatically skipped,
 * allowing guides to adapt dynamically to whichever sub-tab or wizard step is currently active.
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
        description: 'Displays your official organization name, avatar, SEC/DSWD verification status badge, and public transparency standing visible to every donor on BBDRTS.'
      },
      {
        selector: ['#tour-ngo-actions'],
        badge: 'NGO Dashboard · Quick Actions',
        title: 'Primary Operational Shortcuts',
        description: 'Launch a new emergency relief campaign, jump directly into your Donation Ledger to review incoming slips, or refresh live escrow balances with one click.'
      },
      {
        selector: ['.dbo-pending-banner'],
        badge: 'NGO Dashboard · Action Required',
        title: 'Pending Payment Slips Alert',
        description: 'Whenever donors upload GCash, Maya, or Bank transfer receipts awaiting your official statement cross-check, this banner highlights how many slips need review.'
      },
      {
        selector: ['#tour-ngo-metrics'],
        badge: 'NGO Dashboard · Live Telemetry',
        title: 'Fundraising, Escrow & Verification Metrics',
        description: 'Four real-time metrics track your total verified PHP mobilized, active relief drives, pending payment slips, and escrow funds disbursed with proof. Click any interactive stat to jump directly to its view.'
      },
      {
        selector: ['.dbo-spotlight-card'],
        badge: 'NGO Dashboard · Lead Operation',
        title: 'Primary Active Relief Campaign',
        description: 'Highlights your lead campaign with live PHP funding progress, target location, and direct buttons to audit its public blockchain ledger or disburse escrow funds.'
      },
      {
        selector: ['.dbo-secondary-grid'],
        badge: 'NGO Dashboard · Active Drives',
        title: 'Additional Deployed Campaigns',
        description: 'Monitor funding pacing across your other active drives side-by-side and jump straight into disbursement or public ledger auditing.'
      },
      {
        selector: ['.dbo-ledger-card'],
        badge: 'NGO Dashboard · Inbound Feed',
        title: 'Recent Verified Donations Feed',
        description: 'Lists your newest confirmed contributions in chronological order with payment channel tags (GCash, Maya, Card/Bank), verified PHP amounts, and direct Etherscan proof links.'
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
        description: 'Re-query the database and Sepolia ledger to load newly published public emergency campaigns across all accredited NGOs.'
      },
      {
        selector: ['.toolbar-filters-left'],
        badge: 'All Campaigns · Filters',
        title: 'Status, Category & Region Filters',
        description: 'Filter nationwide drives by Active or Concluded status, Disaster Relief (DR) vs. Charitable Aid (CD), and specific Philippine provinces.'
      },
      {
        selector: ['.toolbar-search-right', '.campaign-toolbar-search-box'],
        badge: 'All Campaigns · Search & Sort',
        title: 'Instant Search & Sort Controls',
        description: 'Search across campaign titles, NGO names, municipalities, or tags, and sort drives by newest, urgency, or funding progress.'
      },
      {
        selector: ['.campaign-toolbar-substrip'],
        badge: 'All Campaigns · Layout',
        title: 'Matching Count & Layout Switcher',
        description: 'See how many public drives match your active filters and switch between Grid Cards and Compact List layout.'
      },
      {
        selector: ['.campaign-card'],
        badge: 'All Campaigns · Audited Cards',
        title: 'Public Relief Campaign Cards',
        description: 'Open any drive to inspect live PHP raised, donations received, its Public Blockchain Ledger, and verified ground-zero Disbursement Proofs.'
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
        description: 'Launch a new relief campaign or refresh live raised balances and available escrow across all organization drives.'
      },
      {
        selector: ['.toolbar-filters-left'],
        badge: 'My Campaigns · Filters',
        title: 'Status & Category Filtering',
        description: 'Switch between Active and Concluded organization drives or narrow by Disaster Relief (DR) vs. Charitable Aid (CD).'
      },
      {
        selector: ['.toolbar-search-right', '.campaign-toolbar-search-box'],
        badge: 'My Campaigns · Search & Sort',
        title: 'Search & Sort Your Operations',
        description: 'Locate any campaign by title, location, or ID, and sort by newest, highest raised, or funding progress.'
      },
      {
        selector: ['.campaign-toolbar-substrip'],
        badge: 'My Campaigns · View Mode',
        title: 'Drive Count & Layout Switcher',
        description: 'Check how many drives match your filters and toggle between Grid Cards and Compact List view.'
      },
      {
        selector: ['.campaign-card'],
        badge: 'My Campaigns · Escrow Controls',
        title: 'Disburse Funds, Edit & Audit Ledger',
        description: 'Each card displays your live raised PHP, available escrow, and donations received. Click Disburse Funds to release aid with itemized procurement receipts and RA 10173 face-blurred delivery photos, or inspect the public ledger.'
      }
    ]
  },

  'ngo.create': {
    title: 'Create Campaign',
    steps: [
      {
        selector: ['#tour-ngo-create-header .admin-page-header-actions', '#tour-ngo-create-header'],
        badge: 'Create Campaign · Assistant',
        title: 'AI Budget Assistant & Publishing Access',
        description: 'Use the AI Smart Budget Generator to calculate realistic relief funding goals and verify that your NGO accreditation is approved to publish.'
      },
      {
        selector: ['.deploy-stepper-bar'],
        badge: 'Create Campaign · 5-Step Wizard',
        title: 'Structured 5-Stage Deployment Flow',
        description: 'Click any step to move between 01 Overview (title & PHP goal), 02 Story & Media (with on-device RA 10173 face-blur), 03 Relief Focus tags, 04 Ground Zero map pin, and 05 Official GCash/Maya/Bank payout rails.'
      },
      {
        selector: ['.deploy-section-header'],
        badge: 'Create Campaign · Current Stage',
        title: 'Active Stage Instructions',
        description: 'Shows the current deployment stage and required inputs before advancing to the next step.'
      },
      {
        selector: ['.deploy-section-card', '.dc-form'],
        badge: 'Create Campaign · Form Fields',
        title: 'Fill Details, Media, Map Pin or Payout Rails',
        description: 'Enter accurate relief figures and narratives. Uploaded ground photos automatically blur beneficiary faces on-device, and Step 5 lets you pull saved GCash/Maya/Bank QR vouchers directly from your Settings library.'
      },
      {
        selector: ['.dc-form-footer', '.deploy-step-footer', '.dc-nav-footer'],
        badge: 'Create Campaign · Navigation',
        title: 'Step Navigation & On-Chain Publication',
        description: 'Move back to revise earlier details or advance forward until Step 5, where you preview the exact Donor card before publishing live.'
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
        description: 'Sync fresh on-chain receipts, manually declare a direct bank/e-wallet deposit received without a donor upload, or export formatted Excel, CSV, and Audit PDF reports.'
      },
      {
        selector: ['.ledger-kpi-strip'],
        badge: 'Donation Ledger · Telemetry',
        title: 'Verified Volume, Receipts & Pending Queue',
        description: 'Monitor your Sepolia-audited PHP total, recorded receipt counts across GCash/Maya/Bank, and click Pending Review anytime slips are waiting.'
      },
      {
        selector: ['.ledger-tab-bar'],
        badge: 'Donation Ledger · Navigation',
        title: 'Payment Channel Tabs & Dedicated Pending Review',
        description: 'Filter verified receipts by GCash, Maya, or Card & Bank — or click Pending Review to open the full payment slip verification queue without crowding the ledger.'
      },
      {
        selector: ['.ledger-pending-strip', '.pvq-card'],
        badge: 'Donation Ledger · Slip Verification',
        title: 'Cross-Verify Uploaded Payment Slips',
        description: 'Inside Pending Review you can inspect AI-audited receipts, compare amounts against your official statement, batch-approve AI-verified slips, record verified receipts on Sepolia (with mandatory audit justification on any variance), or reject invalid slips.'
      },
      {
        selector: ['.ledger-pending-strip + div', '.ledger-tab-bar + div'],
        badge: 'Donation Ledger · Filter Toolbar',
        title: 'Search, Category, Campaign, Sort & View Mode',
        description: 'Search by tx hash, campaign, or donor; filter by Disaster Relief/Charitable Aid or specific campaign; sort by date or amount; and switch between Cards and Table view.'
      },
      {
        selector: ['.vercel-admin-card', '.vercel-data-table', '.contribution-receipt-card'],
        badge: 'Donation Ledger · Audit Records',
        title: 'Immutable Verified Receipts & Discrepancy Flags',
        description: 'Every confirmed row shows the Sepolia tx hash, timestamp, campaign, donor, channel, credited PHP, audit status (Matched, Shortage, or Over-Credit), and official voucher actions.'
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
        description: 'Manage your organization legal accreditation required to publish public relief campaigns and receive verified donations on BBDRTS.'
      },
      {
        selector: ['.sec-rail-card'],
        badge: 'Accreditation · Progress Rail',
        title: '4-Stage Regulatory Verification Workflow',
        description: 'Tracks your status from initial registration and document upload through Administrator compliance review to full Verified Partner accreditation.'
      },
      {
        selector: ['.sec-registry-card'],
        badge: 'Accreditation · Legal Registry',
        title: 'Approved SEC, TIN & DSWD Credentials',
        description: 'Displays your verified SEC registration number, Tax Identification Number, DSWD accreditation, and official organization signatory details.'
      },
      {
        selector: ['.sec-docs-card', '.sec-approved-layout > *:last-child'],
        badge: 'Accreditation · Verified Documents',
        title: 'Uploaded Certificates & Signatory IDs',
        description: 'Preview your stored SEC Certificate of Incorporation and authorized representative government IDs anytime, or update them if renewed.'
      },
      {
        selector: ['.sec-editor-divider + div', '#tour-ngo-sec-header ~ form'],
        badge: 'Accreditation · Submission Form',
        title: 'Submit or Update Legal Credentials',
        description: 'Upload clear scans of your SEC certificate and representative IDs for Administrator verification.'
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
        selector: ['.admin-segmented-tabs'],
        badge: 'Monitoring · Sub-Tabs',
        title: 'Switch Between Active Users & Activity Logs',
        description: 'Toggle smoothly between real-time connected user presence and the historical immutable System Activity Logs.'
      },
      {
        selector: ['.admin-presence-panel .admin-page-header .admin-page-header-actions'],
        badge: 'Active Users · Stream Controls',
        title: 'Pause/Resume Live Polling & Manual Refresh',
        description: 'Control real-time presence updates or trigger an immediate refresh to inspect who is online right now.'
      },
      {
        selector: ['.admin-presence-panel .admin-metric-strip'],
        badge: 'Active Users · Live Breakdown',
        title: 'Signed-In Roles vs. Anonymous Visitors',
        description: 'Separates online Donors, NGOs, Administrators, and anonymous guest visitors browsing BBDRTS right now.'
      },
      {
        selector: ['.vercel-toolbar'],
        badge: 'Active Users · Filter & Search',
        title: 'Search Active Sessions & Filter by Role',
        description: 'Find any connected user by email, name, or route and filter by role or online recency.'
      },
      {
        selector: ['.presence-table-wrap', '.admin-presence-panel .vercel-admin-card'],
        badge: 'Active Users · Live Roster',
        title: 'Inspect Connected Sessions & User Journeys',
        description: 'Click any row to inspect the user live session telemetry, device/browser details, and step-by-step navigation journey.'
      }
    ]
  },

  'admin.monitoring': {
    title: 'System Activity Logs',
    steps: [
      {
        selector: ['.admin-segmented-tabs'],
        badge: 'Monitoring · Sub-Tabs',
        title: 'Switch Between Active Users & Activity Logs',
        description: 'Jump between real-time connected users and the complete historical audit log stream.'
      },
      {
        selector: ['.admin-page-header .admin-page-header-actions'],
        badge: 'Activity Logs · Actions',
        title: 'Refresh & Export Audit Trail',
        description: 'Pull the newest server-logged events or export filtered audit records for compliance reviews.'
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
        description: 'Inspect full timestamped audit rows including actor role, event category, outcome status, and detailed metadata.'
      }
    ]
  },

  'admin.finance': {
    title: 'Financial Ledger',
    steps: [
      {
        selector: ['.admin-segmented-tabs'],
        badge: 'Finance Hub · Views',
        title: 'Ledger, Disbursements & Audit Disputes',
        description: 'Switch between the master multi-rail Financial Ledger, NGO Disbursement proofs, and Two-Sided Donation Audit Disputes.'
      },
      {
        selector: ['.admin-page-header .admin-page-header-actions'],
        badge: 'Financial Ledger · Controls',
        title: 'Sync Ledger & Export Governance Reports',
        description: 'Re-query all verified and pending multi-rail transactions across every NGO or export filtered Excel, CSV, and Audit PDF reports.'
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
        selector: ['.campaign-toolbar-substrip'],
        badge: 'Financial Ledger · View Mode',
        title: 'Record Count & Layout Toggle',
        description: 'Check matching transaction counts and toggle cleanly between Table and Card layouts.'
      },
      {
        selector: ['.vercel-admin-card', '.vercel-data-table'],
        badge: 'Financial Ledger · Audit Dossier',
        title: 'Global Multi-Rail Transactions & AI Dossiers',
        description: 'Click any row to open its full Payment Slip & AI Audit Dossier, inspect shortage/over-credit variance flags, or verify the hash on Sepolia Etherscan.'
      }
    ]
  },

  'admin.disbursements': {
    title: 'Disbursement & Procurement',
    steps: [
      {
        selector: ['.admin-segmented-tabs'],
        badge: 'Finance Hub · Views',
        title: 'Switch Finance Governance Sections',
        description: 'Jump between Global Financial Ledger, Disbursement & Procurement oversight, and Donation Audit Disputes.'
      },
      {
        selector: ['.admin-page-header .admin-page-header-actions'],
        badge: 'Disbursements · Actions',
        title: 'Refresh & Export Escrow Releases',
        description: 'Pull the latest NGO aid disbursements and export procurement audit summaries.'
      },
      {
        selector: ['.toolbar-filters-left'],
        badge: 'Disbursements · Category Filter',
        title: 'Filter by Aid Category',
        description: 'Filter escrow releases by Food & Water, Medical Aid, Shelter & Kits, or Logistics.'
      },
      {
        selector: ['.toolbar-search-right', '.campaign-toolbar-search-box'],
        badge: 'Disbursements · Search',
        title: 'Search Releases by NGO, Campaign or Item (Ctrl+K)',
        description: 'Locate any disbursement milestone quickly by NGO name, campaign title, or procurement keyword.'
      },
      {
        selector: ['.vercel-admin-card', '.vercel-data-table'],
        badge: 'Disbursements · Proof Audit',
        title: 'Inspect Itemized Receipts & Delivery Photos',
        description: 'Open any release to audit itemized procurement costs, attached merchant receipts, RA 10173 face-blurred relief photos, and Sepolia proof hashes.'
      }
    ]
  },

  'admin.disputes': {
    title: 'Donation Audit Disputes',
    steps: [
      {
        selector: ['.admin-segmented-tabs'],
        badge: 'Finance Hub · Views',
        title: 'Finance & Dispute Navigation',
        description: 'Switch between Transaction Ledger, Disbursements, and Two-Sided Audit Disputes.'
      },
      {
        selector: ['.admin-metric-strip'],
        badge: 'Disputes · Telemetry',
        title: 'Open Tickets, Review Status & Disputed Variance',
        description: 'Monitors how many discrepancy tickets are Open, Under Investigation, or Resolved alongside total disputed PHP variance.'
      },
      {
        selector: ['.toolbar-filters-left'],
        badge: 'Disputes · Status Filters',
        title: 'Filter Tickets by Investigation Stage',
        description: 'Focus immediately on Open tickets needing first review, tickets Under Review, or closed Resolved/Dismissed rulings.'
      },
      {
        selector: ['.toolbar-search-right', '.campaign-toolbar-search-box'],
        badge: 'Disputes · Search',
        title: 'Search by Ticket Code, Donor or NGO',
        description: 'Look up a specific dispute using its Ticket Code, donor email, organization name, or receipt reference.'
      },
      {
        selector: ['.adp-table-wrap', '.vercel-admin-card'],
        badge: 'Disputes · Side-by-Side Ruling',
        title: 'Inspect Both Sides & Issue Governance Verdicts',
        description: 'Click Review Evidence on any ticket to compare the original slip, donor proof, NGO bank/GCash counter-statement, and AI OCR audit — then record an official ruling that notifies both parties.'
      }
    ]
  },

  'admin.campaigns': {
    title: 'All Campaigns',
    steps: [
      {
        selector: ['.admin-segmented-tabs'],
        badge: 'Campaigns Hub · Views',
        title: 'Switch Between Campaign Oversight & Relief Radar',
        description: 'Toggle between the full platform Campaign Moderation registry and the live Philippine Relief Radar map.'
      },
      {
        selector: ['.admin-page-header .admin-page-header-actions'],
        badge: 'Campaigns · Oversight',
        title: 'Refresh Platform Campaign Registry',
        description: 'Sync every active and concluded relief drive across all accredited organizations.'
      },
      {
        selector: ['.toolbar-filters-left'],
        badge: 'Campaigns · Filters',
        title: 'Filter by Status & Category',
        description: 'Narrow drives to Active, Concluded, Disaster Relief (DR), or Charitable Aid (CD) to focus your moderation review.'
      },
      {
        selector: ['.toolbar-search-right', '.campaign-toolbar-search-box'],
        badge: 'Campaigns · Search',
        title: 'Search Drives, NGOs & Locations (Ctrl+K)',
        description: 'Search immediately by campaign title, campaign ID, organization name, or affected province.'
      },
      {
        selector: ['.campaign-toolbar-substrip'],
        badge: 'Campaigns · Layout',
        title: 'Drive Count & View Mode Switcher',
        description: 'Check matching drive counts and switch between Card Grid and Compact Table layouts.'
      },
      {
        selector: ['.campaign-toolbar-substrip ~ div', '.campaign-card', '.vercel-admin-card'],
        badge: 'Campaigns · Moderation',
        title: 'Audit Escrow Progress & Moderate Status',
        description: 'Review raised volume vs. disbursed escrow, inspect public ledgers and proofs, and pause or reactivate drives whenever governance intervention is needed.'
      }
    ]
  },

  'admin.radar': {
    title: 'Relief Radar',
    steps: [
      {
        selector: ['.admin-segmented-tabs'],
        badge: 'Campaigns Hub · Views',
        title: 'Switch Between Campaign Directory & Radar Map',
        description: 'Return to the full Campaigns Oversight table anytime or stay on the live geospatial map.'
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
        selector: ['.admin-metric-strip'],
        badge: 'Donor Directory · Telemetry',
        title: 'Registered Supporter & Security Summary',
        description: 'Shows total registered donors, verified email accounts, accounts currently locked out from failed logins, and active supporters.'
      },
      {
        selector: ['.toolbar-filters-left'],
        badge: 'Donor Directory · Status Filters',
        title: 'Filter by Verification or Lockout Status',
        description: 'Quickly isolate Locked accounts needing credential recovery, Verified supporters, or Unverified signups.'
      },
      {
        selector: ['.toolbar-search-right', '.campaign-toolbar-search-box'],
        badge: 'Donor Directory · Search',
        title: 'Find Any Donor by Name, Email or System ID',
        description: 'Search immediately using legal name, display name, email address, or BBDRTS-DONOR ID.'
      },
      {
        selector: ['.adp-table-wrap', '.vercel-admin-card'],
        badge: 'Donor Directory · Recovery Controls',
        title: 'Inspect Accounts & Execute Audited Password Resets',
        description: 'View each donor giving history, verification badge, and lockout state — or trigger an audited credential recovery/unlock when a supporter loses access.'
      }
    ]
  },

  'admin.kyc': {
    title: 'KYC Approval',
    steps: [
      {
        selector: ['.admin-segmented-tabs'],
        badge: 'NGO Governance · Sub-Tabs',
        title: 'Switch Between KYC Approvals & Accredited Directory',
        description: 'Move between incoming NGO accreditation applications and the full directory of already approved partners.'
      },
      {
        selector: ['.admin-page-header .admin-page-header-actions'],
        badge: 'KYC Approval · Actions',
        title: 'Refresh Incoming NGO Applications',
        description: 'Pull newly submitted SEC accreditation and KYC dossiers awaiting administrator review.'
      },
      {
        selector: ['.toolbar-filters-left'],
        badge: 'KYC Approval · Status Filters',
        title: 'Filter Applications by Review Status',
        description: 'Focus strictly on Pending reviews, revisit Rejected applications, or view all submissions.'
      },
      {
        selector: ['.toolbar-search-right', '.campaign-toolbar-search-box'],
        badge: 'KYC Approval · Search',
        title: 'Search by Organization, SEC No. or Email',
        description: 'Locate any applicant quickly by organization name, email, SEC registration number, or TIN.'
      },
      {
        selector: ['.vercel-admin-card'],
        badge: 'KYC Approval · Document Audit',
        title: 'Inspect Legal Credentials & Approve/Reject',
        description: 'Open each applicant SEC Certificate of Incorporation and authorized signatory IDs, then Approve to unlock campaign creation or Reject with clear feedback.'
      }
    ]
  },

  'admin.accreditedNgos': {
    title: 'Accredited NGOs',
    steps: [
      {
        selector: ['.admin-segmented-tabs'],
        badge: 'NGO Governance · Sub-Tabs',
        title: 'Switch Between KYC Approvals & Accredited Directory',
        description: 'Jump to pending NGO applications anytime or manage currently accredited partner organizations here.'
      },
      {
        selector: ['.admin-page-header .admin-page-header-actions'],
        badge: 'Accredited NGOs · Actions',
        title: 'Sync Partner Directory',
        description: 'Refresh live fundraising totals, campaign counts, and compliance standing across all approved partner organizations.'
      },
      {
        selector: ['.campaign-toolbar-card'],
        badge: 'Accredited NGOs · Search & Filter',
        title: 'Filter Approved Partner Organizations',
        description: 'Search partner NGOs by name, registration number, or email to inspect a specific organization record.'
      },
      {
        selector: ['.campaign-toolbar-substrip'],
        badge: 'Accredited NGOs · Count',
        title: 'Matching Accredited Organizations',
        description: 'Shows the total count of verified partner NGOs matching your current search.'
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
        selector: ['.admin-segmented-tabs'],
        badge: 'System Hub · Views',
        title: 'Switch Between Broadcasts & System Operations',
        description: 'Toggle between global announcement banners and database backup / maintenance controls.'
      },
      {
        selector: ['.bbdrts-broadcast-panel .admin-page-header-actions'],
        badge: 'Broadcasts · Actions',
        title: 'Compose New Advisory & Refresh Feed',
        description: 'Create a new platform-wide disaster alert or status banner, or refresh currently active advisories.'
      },
      {
        selector: ['.bbdrts-broadcast-stats-grid'],
        badge: 'Broadcasts · Telemetry',
        title: 'Active Advisories & Severity Summary',
        description: 'Track how many global banners are currently live, critical disaster alerts active, and total advisories published.'
      },
      {
        selector: ['.bbdrts-filter-strip'],
        badge: 'Broadcasts · Filters',
        title: 'Filter by Active Status or Severity',
        description: 'Switch between All, Active, and Archived advisories to manage live banners cleanly.'
      },
      {
        selector: ['.bbdrts-table-container'],
        badge: 'Broadcasts · History & Controls',
        title: 'Manage Live Banners & Target Audiences',
        description: 'Inspect target roles (All, Donors, NGOs), severity level, timestamps, and toggle or deactivate resolved alerts in one click.'
      }
    ]
  },

  'admin.systemOps': {
    title: 'System Operations',
    steps: [
      {
        selector: ['.admin-segmented-tabs'],
        badge: 'System Hub · Views',
        title: 'Switch Between Broadcasts & System Operations',
        description: 'Move between global emergency banners and backend compliance backups / maintenance controls.'
      },
      {
        selector: ['.bbdrts-maint-panel .admin-page-header-actions'],
        badge: 'System Ops · Quick Action',
        title: 'Trigger Snapshot or Save Safeguards',
        description: 'Generate an immediate off-chain compliance database backup or commit updated maintenance safeguards.'
      },
      {
        selector: ['.bbdrts-maint-tabs'],
        badge: 'System Ops · Mode Switcher',
        title: 'Database Backups vs. Maintenance Mode',
        description: 'Switch between regulatory database backup snapshots and granular scheduled maintenance mode.'
      },
      {
        selector: ['.bbdrts-backup-hero-card'],
        badge: 'System Ops · Backup Engine',
        title: 'Full Off-Chain Regulatory Snapshots',
        description: 'Capture full point-in-time TiDB database backups for regulatory archiving and disaster recovery.'
      },
      {
        selector: ['.bbdrts-table-container'],
        badge: 'System Ops · Archive History',
        title: 'Downloadable Backup History',
        description: 'Review snapshot dates, file sizes, and download stored compliance backups anytime.'
      },
      {
        selector: ['.schedule-clean-grid'],
        badge: 'System Ops · Maintenance Window',
        title: 'Schedule Start, Duration & Auto-Expiry',
        description: 'Define exact maintenance start and end times so the platform automatically returns online on schedule.'
      },
      {
        selector: ['.scope-tiles-grid'],
        badge: 'System Ops · Granular Scopes',
        title: 'Choose Exactly What Maintenance Locks',
        description: 'Restrict only specific workflows (such as donations, campaign creation, or signups) without shutting down read-only transparency.'
      },
      {
        selector: ['.maint-sticky-preview'],
        badge: 'System Ops · Live Preview',
        title: 'Real-Time User Maintenance Preview',
        description: 'Preview the exact notice banner, countdown timer, and contact details donors and NGOs will see before activating maintenance.'
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
        description: 'Toggle between 7D, 30D, 90D, and All-Time windows to recalculate every KPI, velocity wave, cohort metric, and table row instantly.'
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
        title: 'Metric Tabs (Mobilized, Avg Donation, Disbursed & Pacing)',
        description: 'Click Mobilized, Avg Donation, or Disbursed to switch the live area chart directly below while monitoring overall Goal Pacing.'
      },
      {
        selector: ['.va-hero-chart-body'],
        badge: 'Analytics · Velocity Chart',
        title: 'Live Contribution & Disbursement Trend Wave',
        description: 'Hover anywhere along the timeline curve to inspect daily totals and verify fundraising velocity across the selected period.'
      },
      {
        selector: ['.va-cohort-card'],
        badge: 'Analytics · Cohorts',
        title: 'Supporter & Organization Verification Cohorts',
        description: 'Review verified vs. anonymous donation shares, supporter verification rates, and partner organization accreditation standing.'
      },
      {
        selector: ['.va-card-tabbar'],
        badge: 'Analytics · Breakdown Deck',
        title: 'Switch Analytical Breakdowns',
        description: 'Toggle between payment channel shares (GCash, Maya, Card/Bank), category splits (Disaster Relief vs. Charitable Aid), and regional metrics.'
      },
      {
        selector: ['.va-table-scroll', '.va-table-controls'],
        badge: 'Analytics · Performance Matrix',
        title: 'Searchable Campaign Performance Matrix',
        description: 'Compare every campaign side-by-side by raised PHP, donations received, disbursed funds, and funding completion percentage.'
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
        description: 'Click Edit Profile to update your display name, avatar, contact details, location, bio, and anonymity preference for public ledgers.'
      },
      {
        selector: ['.vs-tabs'],
        badge: 'Settings · Navigation Tabs',
        title: 'Switch Between Settings Categories',
        description: 'Navigate across Profile, QR & Payout Rails (NGOs), Preferences (theme & accessibility), Security (password & 2FA), and Ledger & System.'
      },
      {
        selector: ['.vs-kv-list'],
        badge: 'Settings · Account Details',
        title: 'Verified Identity & Contact Registry',
        description: 'Displays your official BBDRTS System ID, email address, legal/organization name, and verified contact fields.'
      },
      {
        selector: ['.vs-toggle-list'],
        badge: 'Settings · Privacy Controls',
        title: 'Anonymity & Notification Preferences',
        description: 'Control whether your public contributions display anonymously and configure email/in-app notification alerts.'
      },
      {
        selector: ['.vs-qr-head-actions'],
        badge: 'Settings · QR Upload',
        title: 'Add Reusable GCash, Maya & Bank QR Codes',
        description: 'Upload e-wallet or bank QR images once with automatic smart cropping and OCR extraction so you can reuse them across every campaign.'
      },
      {
        selector: ['.vs-qr-toolbar'],
        badge: 'Settings · QR Filter',
        title: 'Search & Filter Saved Payout Rails',
        description: 'Filter your organization saved QR library by channel (GCash, Maya, Bank) or account label.'
      },
      {
        selector: ['.vs-qr-grid'],
        badge: 'Settings · QR Library',
        title: 'Manage Saved Payment Vouchers',
        description: 'Preview, inspect extracted account numbers, set defaults, or remove outdated QR codes from your payout library.'
      },
      {
        selector: ['.vs-theme-grid'],
        badge: 'Settings · Appearance',
        title: 'Dark, Light & System Theme Modes',
        description: 'Switch instantly between Vercel Dark and crisp Light Mode across every dashboard, chart, and modal.'
      },
      {
        selector: ['.vs-mode-grid'],
        badge: 'Settings · Accessibility',
        title: 'High Contrast, Data Saver & Reduced Motion',
        description: 'Optimize readability and performance for low-bandwidth disaster areas or accessibility preferences.'
      },
      {
        selector: ['.vs-sessions-list'],
        badge: 'Settings · Active Sessions',
        title: 'Password, 2FA & Active Device Security',
        description: 'Enable authenticator-app Two-Factor Authentication, update your password, and monitor active signed-in devices.'
      },
      {
        selector: ['.vs-health-grid'],
        badge: 'Settings · System Health',
        title: 'Blockchain Relayer & Node Diagnostics',
        description: 'Inspect live Ethereum Sepolia connectivity, contract address verification, and system ledger sync health.'
      }
    ]
  }
};
