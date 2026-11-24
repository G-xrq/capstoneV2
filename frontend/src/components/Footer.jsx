import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { contractAddress } from '../contractConfig';
import GovernanceModal from './GovernanceModal';
import SmartContractModal from './SmartContractModal';
import LiveTrackerModal from './LiveTrackerModal';
import LeaderboardModal from './LeaderboardModal';
import TermsPolicyModal from './TermsPolicyModal';
import './Footer.css';

const EMERGENCY_HOTLINES = [
  {
    name: 'National Emergency Hotline',
    number: '911',
    desc: 'Immediate dispatch for police, fire, rescue, and ambulance nationwide.',
    icon: 'emergency',
    badge: '24/7 Nationwide',
    tel: '911'
  },
  {
    name: 'Philippine Red Cross',
    number: '143',
    altNumber: '(02) 8790-2300',
    desc: 'Disaster rescue, blood services, relief mobilization, and field first aid.',
    icon: 'medical_services',
    badge: 'Disaster Relief',
    tel: '143'
  },
  {
    name: 'NDRRMC Operations Center',
    number: '(02) 8911-5061',
    altNumber: '(02) 8911-1406',
    desc: 'National calamity advisories, evacuation bulletins, and response coordination.',
    icon: 'shield',
    badge: 'Government Alert',
    tel: '0289115061'
  },
  {
    name: 'DSWD Disaster Response',
    number: '(02) 8931-8101',
    altNumber: '(02) 8951-7119',
    desc: 'Family food packs, camp coordination, and displaced household assistance.',
    icon: 'volunteer_activism',
    badge: 'Social Welfare',
    tel: '0289318101'
  },
  {
    name: 'PAGASA Weather Division',
    number: '(02) 8284-0800',
    desc: 'Severe typhoon advisories, rainfall warnings, and storm surge updates.',
    icon: 'cyclone',
    badge: 'Weather & Storm',
    tel: '0282840800'
  },
  {
    name: 'Philippine Coast Guard',
    number: '(02) 8527-8481',
    altNumber: '0917-724-3682',
    desc: 'Maritime search and rescue, flood boat evacuations, and coastal ops.',
    icon: 'sailing',
    badge: 'Water Rescue',
    tel: '0285278481'
  }
];

export default function Footer({ onNavigate, theme, toggleTheme }) {
  const [copied, setCopied] = useState(false);
  const [policyModal, setPolicyModal] = useState({ open: false, tab: 'accreditation' });
  const [legalModal, setLegalModal] = useState({ open: false, tab: 'agreement' });
  const [showContractModal, setShowContractModal] = useState(false);
  const [showLiveTracker, setShowLiveTracker] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [copiedHotline, setCopiedHotline] = useState(null);

  const openPolicy = (tab = 'accreditation') => {
    setPolicyModal({ open: true, tab });
  };

  const openLegal = (tab = 'agreement') => {
    setLegalModal({ open: true, tab });
  };

  useEffect(() => {
    const handleOpenLegalEvent = (e) => {
      const tab = e.detail?.tab || 'agreement';
      openLegal(tab);
    };
    window.addEventListener('bbdrts_open_legal', handleOpenLegalEvent);
    return () => window.removeEventListener('bbdrts_open_legal', handleOpenLegalEvent);
  }, []);

  // Lock background scroll & support Esc while Emergency Hotlines modal is open
  useEffect(() => {
    if (!showEmergencyModal || typeof document === 'undefined') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') setShowEmergencyModal(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [showEmergencyModal]);

  const handleCopyContract = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!contractAddress) return;
    try {
      navigator.clipboard.writeText(contractAddress);
    } catch (_) {}
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyNumber = (num, name) => {
    try {
      navigator.clipboard.writeText(num);
    } catch (_) {}
    setCopiedHotline(name);
    setTimeout(() => setCopiedHotline(null), 2000);
  };

  const handleNavigateRadar = (e) => {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent('bbdrts_navigate_radar'));
    setTimeout(() => {
      document.getElementById('radar-heatmap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleNavigateCampaigns = (category = 'ALL') => (e) => {
    e.preventDefault();
    if (category && category !== 'ALL') {
      window.dispatchEvent(new CustomEvent('bbdrts_filter_category', { detail: { category } }));
    } else {
      window.dispatchEvent(new CustomEvent('bbdrts_navigate_campaigns'));
    }
    setTimeout(() => {
      const el = document.getElementById('campaigns');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 100);
  };

  const resolvedTheme =
    theme ||
    (typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') : null) ||
    'dark';
  const isLight = resolvedTheme === 'light';

  const shortContract = contractAddress
    ? `${contractAddress.substring(0, 6)}…${contractAddress.substring(contractAddress.length - 4)}`
    : '0x0000…0000';

  return (
    <footer className="ftv-root" id="footer-main">
      <div className="container ftv-main">
        <div className="ftv-grid">
          {/* ── Column 1: Brand, Mission & Deployed Contract ── */}
          <div className="ftv-brand-col">
            <div className="ftv-brand-head">
              <div className="ftv-logo-box">
                <img src="/logo.png" alt="BBDRTS" className="ftv-logo-img" />
              </div>
              <div className="ftv-brand-meta">
                <div className="ftv-brand-row">
                  <span className="ftv-brand-name">BBDRTS</span>
                  <span className="ftv-region-tag">PH</span>
                </div>
                <span className="ftv-brand-sub">Blockchain-Based Donation &amp; Relief Transparency System</span>
              </div>
            </div>

            <p className="ftv-mission">
              Public disaster relief tracking for the Philippines — supporting Xendit QR Ph (GCash, Maya, InstaPay), direct QR transfers with AI receipt verification, and gasless Ethereum Sepolia audit records.
            </p>

            {/* Unified Sepolia Contract Pill */}
            <div className="ftv-contract-pill">
              <button
                type="button"
                className="ftv-contract-copy"
                onClick={handleCopyContract}
                title="Copy Sepolia Smart Contract Address"
              >
                <span className="ftv-contract-dot" />
                <span className="ftv-contract-lbl">Sepolia Contract</span>
                <span className="ftv-contract-addr">{shortContract}</span>
                <span className="material-symbols-outlined ftv-contract-ico">
                  {copied ? 'check' : 'content_copy'}
                </span>
              </button>
              <span className="ftv-contract-sep" aria-hidden="true" />
              <a
                href={`https://sepolia.etherscan.io/address/${contractAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ftv-contract-ext"
                title="Inspect contract on Sepolia Etherscan"
                aria-label="Open Sepolia Etherscan"
              >
                <span className="material-symbols-outlined">north_east</span>
              </a>
            </div>
          </div>

          {/* ── Column 2: Explore ── */}
          <div className="ftv-col">
            <div className="ftv-col-title">Explore</div>
            <ul className="ftv-links">
              <li>
                <button type="button" className="ftv-link" onClick={handleNavigateCampaigns('ALL')}>
                  Active Campaigns
                </button>
              </li>
              <li>
                <button type="button" className="ftv-link" onClick={handleNavigateCampaigns('DR')}>
                  Disaster Relief
                </button>
              </li>
              <li>
                <button type="button" className="ftv-link" onClick={handleNavigateCampaigns('CD')}>
                  Community Drives
                </button>
              </li>
              <li>
                <button type="button" className="ftv-link" onClick={handleNavigateRadar}>
                  Relief Radar
                </button>
              </li>
            </ul>
          </div>

          {/* ── Column 3: Transparency ── */}
          <div className="ftv-col">
            <div className="ftv-col-title">Transparency</div>
            <ul className="ftv-links">
              <li>
                <button type="button" className="ftv-link" onClick={() => setShowLiveTracker(true)}>
                  Live Donation Feed
                </button>
              </li>
              <li>
                <button type="button" className="ftv-link" onClick={() => setShowContractModal(true)}>
                  Smart Contract Details
                </button>
              </li>
              <li>
                <a
                  href={`https://sepolia.etherscan.io/address/${contractAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ftv-link ftv-link--ext"
                >
                  <span>Sepolia Etherscan</span>
                  <span className="material-symbols-outlined">north_east</span>
                </a>
              </li>
              <li>
                <button type="button" className="ftv-link" onClick={() => openPolicy('security')}>
                  Receipt &amp; Ledger Verification
                </button>
              </li>
              <li>
                <button type="button" className="ftv-link" onClick={() => openPolicy('allocation')}>
                  Fund Allocation Policy
                </button>
              </li>
            </ul>
          </div>

          {/* ── Column 4: Policies & Legal ── */}
          <div className="ftv-col">
            <div className="ftv-col-title">Policies &amp; Legal</div>
            <ul className="ftv-links">
              <li>
                <button type="button" className="ftv-link" onClick={() => openPolicy('accreditation')}>
                  NGO Vetting Standards
                </button>
              </li>
              <li>
                <button type="button" className="ftv-link" onClick={() => openLegal('agreement')}>
                  User Agreement
                </button>
              </li>
              <li>
                <button type="button" className="ftv-link" onClick={() => openLegal('terms')}>
                  Terms of Service
                </button>
              </li>
              <li>
                <button type="button" className="ftv-link" onClick={() => openLegal('privacy')}>
                  Privacy Policy (RA 10173)
                </button>
              </li>
              <li>
                <button type="button" className="ftv-link" onClick={() => openLegal('integrity')}>
                  Anti-Fraud Policy
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* ── Bottom Bar (Honest & Accurate · Zero Duplication) ── */}
      <div className="ftv-bottom">
        <div className="container ftv-bottom-inner">
          <div className="ftv-bottom-left">
            <span className="ftv-copy">© 2026 BBDRTS · Philippines</span>
            <button
              type="button"
              className="ftv-status-btn"
              onClick={() => setShowLiveTracker(true)}
              title="Inspect live donations recorded on Ethereum Sepolia"
            >
              <span className="ftv-status-dot" />
              <span>Sepolia Live Feed</span>
            </button>
          </div>

          <div className="ftv-bottom-right">
            <button
              type="button"
              className="ftv-hotline-pill"
              onClick={() => setShowEmergencyModal(true)}
              title="View Philippine 24/7 Emergency & Relief Hotlines"
            >
              <span className="ftv-hotline-dot" />
              <span>Emergency</span>
              <span className="ftv-hotline-nums">911 · 143</span>
            </button>

            {toggleTheme && (
              <div className="ftv-theme-seg" role="group" aria-label="Color theme">
                <button
                  type="button"
                  className={`ftv-theme-opt${!isLight ? ' is-active' : ''}`}
                  onClick={() => {
                    if (isLight) toggleTheme();
                  }}
                  title="Dark Mode"
                  aria-label="Switch to Dark Mode"
                  aria-pressed={!isLight}
                >
                  <span className="material-symbols-outlined">dark_mode</span>
                </button>
                <button
                  type="button"
                  className={`ftv-theme-opt${isLight ? ' is-active' : ''}`}
                  onClick={() => {
                    if (!isLight) toggleTheme();
                  }}
                  title="Light Mode"
                  aria-label="Switch to Light Mode"
                  aria-pressed={isLight}
                >
                  <span className="material-symbols-outlined">light_mode</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Platform Policies & Standards Modal */}
      <GovernanceModal
        isOpen={policyModal.open}
        onClose={() => setPolicyModal((prev) => ({ ...prev, open: false }))}
        initialTab={policyModal.tab}
      />

      {/* Statutory Legal Framework, User Agreement, Terms & Privacy (RA 10173) Modal */}
      <TermsPolicyModal
        isOpen={legalModal.open}
        onClose={() => setLegalModal((prev) => ({ ...prev, open: false }))}
        initialTab={legalModal.tab}
        theme={resolvedTheme}
      />

      {/* Smart Contract Details Modal */}
      <SmartContractModal
        isOpen={showContractModal}
        onClose={() => setShowContractModal(false)}
        theme={resolvedTheme}
      />

      {/* Live Activity Stream Modal */}
      <LiveTrackerModal
        isOpen={showLiveTracker}
        onClose={() => setShowLiveTracker(false)}
        theme={resolvedTheme}
      />

      {/* Emergency Hotlines Modal */}
      {showEmergencyModal &&
        createPortal(
          <div
            className="ftv-hotline-backdrop"
            data-theme={resolvedTheme}
            onClick={() => setShowEmergencyModal(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ftv-hotline-title"
          >
            <div className="ftv-hotline-modal" onClick={(e) => e.stopPropagation()}>
              <div className="ftv-hotline-head">
                <div className="ftv-hotline-head-left">
                  <div className="ftv-hotline-icon">
                    <span className="material-symbols-outlined">emergency</span>
                  </div>
                  <div>
                    <h3 id="ftv-hotline-title" className="ftv-hotline-title">
                      Philippine Emergency &amp; Relief Hotlines
                    </h3>
                    <p className="ftv-hotline-sub">
                      Verified 24/7 national emergency numbers and disaster operations centers.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="ftv-hotline-close"
                  onClick={() => setShowEmergencyModal(false)}
                  aria-label="Close hotlines modal"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="ftv-hotline-grid">
                {EMERGENCY_HOTLINES.map((h) => (
                  <div key={h.name} className="ftv-hotline-card">
                    <div className="ftv-hotline-card-top">
                      <span className="ftv-hotline-card-name">
                        <span className="material-symbols-outlined ftv-hotline-card-ico">{h.icon}</span>
                        <span>{h.name}</span>
                      </span>
                      <span className="ftv-hotline-badge">{h.badge}</span>
                    </div>

                    <p className="ftv-hotline-desc">{h.desc}</p>

                    <div className="ftv-hotline-nums-row">
                      <span className="ftv-hotline-main-num">{h.number}</span>
                      {h.altNumber && <span className="ftv-hotline-alt">Alt: {h.altNumber}</span>}
                    </div>

                    <div className="ftv-hotline-actions">
                      <a href={`tel:${h.tel}`} className="ftv-hotline-call" title={`Call ${h.name}`}>
                        <span className="material-symbols-outlined">call</span>
                        <span>Call Now</span>
                      </a>
                      <button
                        type="button"
                        className={`ftv-hotline-copy${copiedHotline === h.name ? ' is-copied' : ''}`}
                        onClick={() => handleCopyNumber(h.number, h.name)}
                        title="Copy phone number"
                      >
                        <span className="material-symbols-outlined">
                          {copiedHotline === h.name ? 'check' : 'content_copy'}
                        </span>
                        <span>{copiedHotline === h.name ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="ftv-hotline-foot">
                <p className="ftv-hotline-advisory">
                  For immediate life threats or flood evacuations, call <strong>911</strong> or{' '}
                  <strong>Red Cross 143</strong> first. Live bulletins:{' '}
                  <a href="https://ndrrmc.gov.ph" target="_blank" rel="noopener noreferrer">
                    NDRRMC Portal ↗
                  </a>
                </p>
                <button
                  type="button"
                  className="ftv-hotline-done"
                  onClick={() => setShowEmergencyModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </footer>
  );
}
