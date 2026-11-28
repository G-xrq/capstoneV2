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
        title: 'Live Philippine Disaster Radar',
        description: 'Monitor active relief hotspots, verified donation density, and campaign coverage across provinces and municipalities.'
      },
      {
        selector: ['.radar-command-hud', '.radar-map-card'],
        title: 'Interactive Map & Zoom Controls',
        description: 'Click any campaign pin to inspect raised funds and donations received. Use +/- buttons, Ctrl + scroll, or Fullscreen mode to zoom cleanly.'
      }
    ]
  },

  /* ── DONOR WORKSPACE ───────────────────────────────────────────────────── */
  'donor.dashboard': {
    title: 'Dashboard Overview',
    steps: [
      {
        selector: ['#tour-donor-welcome', '.dbo-clean-hero'],
        title: 'Your Giving Hub',
        description: 'Welcome to your personal disaster relief dashboard. Track your verified impact and jump straight into active emergency drives.'
      },
      {
        selector: ['#tour-donor-metrics', '.dbo-metric-grid'],
        title: 'Live Impact Summary',
        description: 'See your total verified PHP contributions, number of donations recorded on Sepolia, and supported relief campaigns.'
      },
      {
        selector: ['#tour-donor-featured-causes', '#tour-donor-first-campaign', '.campaign-card'],
        title: 'Featured Relief Campaigns',
        description: 'Inspect urgent drives, verify each organization public blockchain ledger, and contribute securely via GCash, Maya, or Bank/Card.'
      }
    ]
  },

  'donor.campaigns': {
    title: 'Explore Campaigns',
    steps: [
      {
        selector: ['#tour-campaigns-toolbar'],
        title: 'Search, Filter & Sort Drives',
        description: 'Find specific disaster relief or charitable drives by region, category, keyword, or funding urgency.'
      },
      {
        selector: ['#tour-campaigns-container .campaign-card', '.campaign-card'],
        title: 'Inspect & Donate Transparently',
        description: 'View raised progress, donation counts, public ledger records, and ground disbursement proofs before donating.'
      }
    ]
  },

  'donor.donations': {
    title: 'My Contributions & Receipts',
    steps: [
      {
        selector: ['#tour-donations-header .admin-page-header-actions', '#tour-donations-header'],
        title: 'Contribution History Controls',
        description: 'Refresh your live donation status and download official verified receipt vouchers.'
      },
      {
        selector: ['.contribution-receipt-card', '#tour-donations-header ~ div'],
        title: 'Receipts, Payment Slips & Disputes',
        description: 'Inspect your uploaded slip, view your immutable Sepolia Etherscan hash, or file a formal Audit Dispute if an NGO credits a different amount than you sent.'
      }
    ]
  },

  'donor.radar': {
    title: 'Disaster Radar & Heatmap',
    steps: [
      {
        selector: ['#tour-radar-header'],
        title: 'Nationwide Relief Coverage',
        description: 'Explore where verified disaster relief drives are actively operating across the Philippines.'
      },
      {
        selector: ['.radar-command-hud', '.radar-map-card'],
        title: 'Interactive Map & Pins',
        description: 'Select any hotspot pin to view raised funds, donations received, and open the campaign directly. Use +/- or Ctrl + scroll to zoom.'
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
        title: 'Nationwide Relief Monitoring',
        description: 'Track active emergency campaigns and funding density across all Philippine regions in real time.'
      },
      {
        selector: ['.radar-command-hud', '.radar-map-card'],
        title: 'Interactive Oversight Map',
        description: 'Click any campaign pin for funding details and donation counts. Use +/- buttons, Ctrl + scroll, or Fullscreen mode to zoom.'
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
        title: 'Edit Profile Identity',
        description: 'Update your display name, avatar, location, contact details, and organization bio anytime.'
      },
      {
        selector: ['.vs-tabs'],
        title: 'Settings Sections',
        description: 'Navigate between Profile, QR & Payout Rails (for NGOs), workspace Preferences, 2FA Security, and Ledger & System settings.'
      },
      {
        selector: ['.vs-content'],
        title: 'Active Configuration Panel',
        description: 'Configure theme mode, notification preferences, two-factor authentication, and saved payment QR codes right here.'
      }
    ]
  }
};
