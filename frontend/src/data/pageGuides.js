/**
 * Contextual In-Page Spotlight Guides (strictly current-page elements only).
 * Each step accepts a `selector` (string or array of fallback selectors).
 * Missing/hidden elements on the current page are automatically skipped.
 */
export const PAGE_GUIDES = {
  /* ── NGO WORKSPACE ─────────────────────────────────────────────────────── */
  'ngo.dashboard': {
    title: 'Dashboard Overview',
    steps: [
      {
        selector: ['#tour-ngo-welcome', '.dbo-clean-hero'],
        title: 'Organization Status & Quick Summary',
        description: 'View your accreditation status, active relief operations, and live Sepolia audit connectivity at a glance.'
      },
      {
        selector: ['#tour-ngo-actions', '#tour-ngo-dashboard-header .admin-page-header-actions'],
        title: 'Primary Operational Shortcuts',
        description: 'Quickly launch a new relief campaign, review incoming donations, or jump into analytics and settings.'
      },
      {
        selector: ['#tour-ngo-metrics', '.dbo-metric-grid'],
        title: 'Live Fundraising & Escrow Metrics',
        description: 'Track total verified funds raised, active campaigns, pending payment slips, and escrow disbursement progress in real time.'
      },
      {
        selector: ['#tour-ngo-identity', '.dbo-clean-card'],
        title: 'Organization Identity & Activity',
        description: 'Review your verified NGO credentials, receiving rails, and recent on-chain contribution activity.'
      }
    ]
  },

  'ngo.allCampaigns': {
    title: 'Public Relief Campaigns',
    steps: [
      {
        selector: ['#tour-ngo-all-campaigns-header .admin-page-header-actions', '#tour-ngo-all-campaigns-header'],
        title: 'Live Public Directory Controls',
        description: 'Sync the latest public disaster relief drives and explore active campaigns across all accredited NGOs.'
      },
      {
        selector: ['[id^="tour-ngo-all-campaigns"] ~ div input[type="text"]', '.admin-page-header + div'],
        title: 'Search & Category Filters',
        description: 'Filter drives by disaster relief or charitable aid, search by location or organization, and sort by urgency or funding.'
      },
      {
        selector: ['.campaign-card'],
        title: 'Audited Campaign Cards',
        description: 'Open any drive to inspect its verified goal progress, donation count, public blockchain ledger, and relief disbursement proofs.'
      }
    ]
  },

  'ngo.myCampaigns': {
    title: 'My Organization Campaigns',
    steps: [
      {
        selector: ['#tour-ngo-my-campaigns-header .admin-page-header-actions', '#tour-ngo-my-campaigns-header'],
        title: 'Campaign Actions',
        description: 'Launch a new relief drive or refresh live escrow balances for your organization campaigns.'
      },
      {
        selector: ['.campaign-card'],
        title: 'Manage Escrow & Disbursements',
        description: 'Each card shows your raised volume, donation count, and escrow balance. Use Disburse Funds to release aid with proof photos and receipts, or inspect the public ledger.'
      }
    ]
  },

  'ngo.create': {
    title: 'Launch Relief Campaign',
    steps: [
      {
        selector: ['#tour-ngo-create-header'],
        title: 'Create a Verified Campaign',
        description: 'Publish a new disaster relief or charitable drive. Once submitted, donors can contribute via GCash, Maya, or Bank/Card with full Sepolia audit tracking.'
      },
      {
        selector: ['#tour-ngo-create-form form', '#tour-ngo-create-form .card', '#tour-ngo-create-form'],
        title: 'Campaign Details, Location & Payment Rails',
        description: 'Enter the title, category, PHP target, exact barangay/municipality pin on the map, and attach your official GCash/Maya QR or bank receiving details.'
      }
    ]
  },

  'ngo.ledger': {
    title: 'Donation Ledger',
    steps: [
      {
        selector: ['#tour-ngo-ledger-header .admin-page-header-actions'],
        title: 'Sync, Log Deposit & Export',
        description: 'Refresh live records, declare direct deposits received without a donor upload, or export formatted Excel, CSV, and Audit PDF reports.'
      },
      {
        selector: ['.ledger-kpi-strip'],
        title: 'Verified Volume & Pending Queue',
        description: 'Monitor total Sepolia-audited funds, recorded receipts across channels, and click Pending Review anytime slips are waiting.'
      },
      {
        selector: ['.ledger-tab-bar'],
        title: 'Channel Tabs & Dedicated Pending Review',
        description: 'Filter verified receipts by GCash, Maya, or Card & Bank — or switch to Pending Review to inspect AI-audited slips and confirm or reject them.'
      },
      {
        selector: ['.ledger-pending-strip', '.pvq-card'],
        title: 'Payment Slip Verification',
        description: 'Open Pending Review to inspect uploaded payment slips, cross-check amounts against your official statement, and record confirmed receipts on-chain.'
      }
    ]
  },

  'ngo.secKyc': {
    title: 'SEC Verification & Accreditation',
    steps: [
      {
        selector: ['#tour-ngo-sec-header'],
        title: 'Legal Accreditation Status',
        description: 'Track your organization SEC registration, TIN, and DSWD accreditation status required to launch public relief campaigns.'
      },
      {
        selector: ['#tour-ngo-sec-header ~ div'],
        title: 'Submit & Update Credentials',
        description: 'Upload your SEC Certificate of Incorporation and official governance documents for administrator verification.'
      }
    ]
  },

  'ngo.radar': {
    title: 'Disaster Radar & Heatmap',
    steps: [
      {
        selector: ['#tour-ngo-radar-header'],
        badge: 'Relief Radar · Overview',
        title: 'Live Philippine Disaster Radar',
        description: 'Monitor active relief hotspots, verified donation density, and campaign coverage across provinces and municipalities.'
      },
      {
        selector: ['.radar-unified-command-bar'],
        badge: 'Relief Radar · Command Bar',
        title: 'Region Presets, Telemetry & Fullscreen',
        description: 'Jump between All Philippines, Luzon, Visayas, and Mindanao, monitor live active operations, toggle density simulation, or expand into Fullscreen mode.'
      },
      {
        selector: ['.radar-map-viewport'],
        badge: 'Relief Radar · Interactive Map',
        title: 'Campaign Pins, Basemaps & Weather HUD',
        description: 'Click any campaign pin to inspect raised funds and donations received. Use the bottom-left dock to switch Terrain/Satellite/Dark/Provinces layers, the top-left HUD for PAGASA weather, and +/- or Ctrl + scroll to zoom.'
      }
    ]
  },

  /* ── DONOR WORKSPACE (Deep Contextual Page Guides) ────────────────────── */
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

  /* ── ADMINISTRATOR WORKSPACE ───────────────────────────────────────────── */
  'admin.dashboard': {
    title: 'Command Center Overview',
    steps: [
      {
        selector: ['.admin-page-header .admin-page-header-actions', '.admin-page-header'],
        title: 'Platform Command Controls',
        description: 'Sync real-time platform telemetry, monitor Sepolia relayer health, and manage live system operations.'
      },
      {
        selector: ['.dbo-metric-grid', '.admin-kpi-grid', '.admin-page-header + div'],
        title: 'Live Governance Telemetry',
        description: 'Track platform-wide verified donation volume, pending NGO applications, open audit disputes, and active relief campaigns.'
      }
    ]
  },

  'admin.monitoring': {
    title: 'Activity & Audit Monitoring',
    steps: [
      {
        selector: ['.admin-page-header .admin-page-header-actions', '.admin-page-header'],
        title: 'Live Audit Refresh & Exports',
        description: 'Refresh incoming security events or export filtered audit logs for governance compliance.'
      },
      {
        selector: ['.admin-page-header + div'],
        title: 'Category, Role & Date Filters',
        description: 'Narrow logs to admin security alerts, discrepancy flags, NGO verifications, or user actions across custom time ranges.'
      }
    ]
  },

  'admin.finance': {
    title: 'Financial Ledger',
    steps: [
      {
        selector: ['.admin-subtabs', '.vs-tabs', '.admin-page-header'],
        title: 'Finance Governance Views',
        description: 'Switch between the master Financial Ledger, Disbursement & Procurement logs, and Donation Audit Disputes.'
      },
      {
        selector: ['.admin-page-header .admin-page-header-actions'],
        title: 'Ledger Sync & Audit Exports',
        description: 'Refresh verified on-chain receipts, inspect AI payment slip dossiers, or export governance financial reports.'
      },
      {
        selector: ['.admin-page-header + div'],
        title: 'Cross-Platform Transactions',
        description: 'Filter verified donations across all NGOs and channels and inspect transaction hashes on Sepolia.'
      }
    ]
  },

  'admin.disbursements': {
    title: 'Disbursement & Procurement',
    steps: [
      {
        selector: ['.admin-page-header'],
        title: 'Aid Release Oversight',
        description: 'Review every escrow release submitted by accredited NGOs, including itemized procurement costs and relief photos.'
      },
      {
        selector: ['.admin-page-header + div'],
        title: 'Proof Verification & Audit Trail',
        description: 'Inspect attached merchant receipts, beneficiary delivery photos, and on-chain disbursement proof hashes.'
      }
    ]
  },

  'admin.disputes': {
    title: 'Donation Audit Disputes',
    steps: [
      {
        selector: ['.admin-page-header'],
        title: 'Two-Sided Discrepancy Resolution',
        description: 'Review formal disputes filed by donors when an NGO credits a different amount than declared.'
      },
      {
        selector: ['.admin-page-header + div'],
        title: 'Side-by-Side Evidence & Rulings',
        description: 'Compare the original donor slip, donor proof, NGO bank/GCash counter-statement, and AI OCR audit before issuing a governance verdict.'
      }
    ]
  },

  'admin.radar': {
    title: 'Relief Radar',
    steps: [
      {
        selector: ['.admin-page-header'],
        badge: 'Relief Radar · Overview',
        title: 'Nationwide Relief Monitoring',
        description: 'Track active emergency campaigns and funding density across all Philippine regions in real time.'
      },
      {
        selector: ['.radar-unified-command-bar'],
        badge: 'Relief Radar · Command Bar',
        title: 'Region Focus, Telemetry & Fullscreen',
        description: 'Switch regional presets, view active tracked operations, toggle density halos, or expand into Fullscreen mode.'
      },
      {
        selector: ['.radar-map-viewport'],
        badge: 'Relief Radar · Interactive Map',
        title: 'Interactive Oversight Map & Layer Controls',
        description: 'Click any campaign pin for funding details and donation counts. Use the on-map HUD for PAGASA weather, the bottom-left dock for basemaps, and +/- or Ctrl + scroll to zoom.'
      }
    ]
  },

  'admin.kyc': {
    title: 'KYC Approval',
    steps: [
      {
        selector: ['.admin-page-header'],
        title: 'Pending NGO Accreditation Queue',
        description: 'Review incoming NGO applications, SEC registration numbers, TIN, and uploaded incorporation certificates.'
      },
      {
        selector: ['.admin-page-header + div'],
        title: 'Approve or Reject Applications',
        description: 'Inspect legal credentials before granting campaign publishing access or returning clear feedback for resubmission.'
      }
    ]
  },

  'admin.accreditedNgos': {
    title: 'Accredited NGOs',
    steps: [
      {
        selector: ['.admin-page-header'],
        title: 'Verified Partner Directory',
        description: 'Manage all approved humanitarian organizations operating on BBDRTS.'
      },
      {
        selector: ['.admin-page-header + div'],
        title: 'Compliance & Account Controls',
        description: 'Inspect organization performance, SEC documents, campaign count, or suspend accounts with unresolved audit issues.'
      }
    ]
  },

  'admin.campaigns': {
    title: 'Campaigns Oversight',
    steps: [
      {
        selector: ['.admin-subtabs', '.vs-tabs', '.admin-page-header'],
        title: 'Campaigns Directory & Radar',
        description: 'Switch between the full Campaign Oversight table and the live Philippine Disaster Radar map.'
      },
      {
        selector: ['.admin-page-header + div'],
        title: 'Moderation & Escrow Status',
        description: 'Audit raised funds, verify disbursement proofs, and activate or pause drives to protect donors.'
      }
    ]
  },

  'admin.donors': {
    title: 'Donor Directory',
    steps: [
      {
        selector: ['.admin-page-header'],
        title: 'Registered Donor Accounts',
        description: 'Review registered supporters, total verified giving activity, and account status across the platform.'
      },
      {
        selector: ['.admin-page-header + div'],
        title: 'Search & Account Oversight',
        description: 'Search donors by name, email, or system ID and inspect account verification status.'
      }
    ]
  },

  'admin.ngos': {
    title: 'NGO Governance & Approvals',
    steps: [
      {
        selector: ['.admin-subtabs', '.vs-tabs', '.admin-page-header'],
        title: 'Pending Applications & Directory',
        description: 'Review new NGO SEC/DSWD accreditation requests or manage currently approved partner organizations.'
      },
      {
        selector: ['.admin-page-header + div'],
        title: 'Document Inspection & Decisions',
        description: 'Inspect uploaded SEC certificates, approve qualified organizations, or suspend accounts with unresolved audit violations.'
      }
    ]
  },

  'admin.system': {
    title: 'System & Broadcasts',
    steps: [
      {
        selector: ['.admin-subtabs', '.vs-tabs', '.admin-page-header'],
        title: 'Platform Governance Controls',
        description: 'Manage global announcement banners, scheduled maintenance windows, and system-level configuration.'
      }
    ]
  },

  /* ── SHARED PANELS ─────────────────────────────────────────────────────── */
  'shared.analytics': {
    title: 'Analytics & Reports',
    steps: [
      {
        selector: ['.va-range-group'],
        title: 'Time Window Selector',
        description: 'Switch between 7D, 30D, 90D, and All-Time windows to recalculate every chart, trend, and metric.'
      },
      {
        selector: ['.va-export-wrap'],
        title: 'Formatted Multi-Format Exports',
        description: 'Download structured Excel workbooks, print-ready Executive PDF reports, CSV tables, or full Audit JSON archives.'
      },
      {
        selector: ['.va-kpi-grid', '.va-kpis', '.va-grid', '.va-section'],
        title: 'Velocity, Channels & Breakdowns',
        description: 'Analyze donation velocity over time, GCash/Maya/Bank channel shares, and top-performing relief campaigns.'
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
        description: 'Jump between Profile details, Workspace Preferences (Dark/Light mode, High Contrast, Data Saver, language), Account Security (password & 2FA), and Ledger & System tools.'
      },
      {
        selector: ['.vs-content'],
        badge: 'Settings · Active Controls',
        title: 'Live Account & Accessibility Configuration',
        description: 'Every change you make here — from enabling Two-Factor Authentication to switching theme or accessibility modes — applies immediately and persists across sessions.'
      }
    ]
  }
};
