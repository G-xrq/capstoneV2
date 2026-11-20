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
    desc: 'Immediate emergency response for police, fire, rescue, and ambulance services nationwide.',
    icon: 'emergency',
    badge: '24/7 Nationwide',
    tel: '911'
  },
  {
    name: 'Philippine Red Cross (PRC)',
    number: '143',
    altNumber: '(02) 8790-2300',
    desc: 'Disaster rescue, blood bank, relief supply mobilization, and field first-aid assistance.',
    icon: 'medical_services',
    badge: 'Disaster Relief',
    tel: '143'
  },
  {
    name: 'NDRRMC Operations Center',
    number: '(02) 8911-5061',
    altNumber: '(02) 8911-1406',
    desc: 'National Disaster Risk Reduction & Management Council. Calamity alerts & situational bulletins.',
    icon: 'shield',
    badge: 'Government Alert',
    tel: '0289115061'
  },
  {
    name: 'DSWD Disaster Response Unit',
    number: '(02) 8931-8101',
    altNumber: '(02) 8951-7119',
    desc: 'Department of Social Welfare & Development. Food pack distribution and displaced family aid.',
    icon: 'volunteer_activism',
    badge: 'Social Welfare',
    tel: '0289318101'
  },
  {
    name: 'PAGASA Weather Division',
    number: '(02) 8284-0800',
    desc: 'Severe typhoon advisories, rainfall warnings, and storm surge monitoring.',
    icon: 'cyclone',
    badge: 'Weather & Storm',
    tel: '0282840800'
  },
  {
    name: 'Philippine Coast Guard (PCG)',
    number: '(02) 8527-8481',
    altNumber: '0917-724-3682',
    desc: 'Maritime search and rescue, flood boat evacuations, and coastal disaster operations.',
    icon: 'sailing',
    badge: 'Water Rescue',
    tel: '0285278481'
  }
];

export default function Footer({ onNavigate, theme, toggleTheme }) {
  const [copied, setCopied] = useState(false);
  const [govModal, setGovModal] = useState({ open: false, tab: 'governance' });
  const [legalModal, setLegalModal] = useState({ open: false, tab: 'agreement' });
  const [showContractModal, setShowContractModal] = useState(false);
  const [showLiveTracker, setShowLiveTracker] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [copiedHotline, setCopiedHotline] = useState(null);

  const openGov = (tab = 'governance') => {
    setGovModal({ open: true, tab });
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

  const handleCopyContract = (e) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(contractAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyNumber = (num, name) => {
    navigator.clipboard.writeText(num);
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

  const handleHowItWorksClick = (e) => {
    e.preventDefault();
    const el = document.getElementById('how-it-works');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      setShowContractModal(true);
    }
  };

  return (
    <footer className="bbdrts-footer-root" id="footer-governance">
      <div className="container bbdrts-footer-main">
        <div className="bbdrts-footer-grid">

          {/* ── Column 1: Platform & System Mission ── */}
          <div className="bbdrts-footer-brand-col">
            <div className="bbdrts-footer-brand-header">
              <div className="bbdrts-footer-logo-badge">
                <img src="/logo.png" alt="BBDRTS Logo" className="bbdrts-footer-logo-img" />
              </div>
              <div className="bbdrts-footer-brand-titles">
                <span className="bbdrts-footer-brand-title">BBDRTS</span>
                <span className="bbdrts-footer-brand-tagline">Blockchain-Based Donation & Relief Transparency System</span>
              </div>
            </div>

            <p className="bbdrts-footer-mission">
              An open, tamper-proof humanitarian platform for the Philippines. BBDRTS connects donors directly to verified disaster response operations through Philippine payment rails (GCash, Maya, Cards, Bank Transfer), a gasless Ethereum Sepolia audit relayer, and public milestone delivery proofs.
            </p>

            {/* Verified Contract Address Chip & Explorer Link */}
            <div className="bbdrts-footer-contract-chip-wrap">
              <div
                className="bbdrts-footer-contract-chip"
                onClick={handleCopyContract}
                title="Click to copy Sepolia Smart Contract Address"
              >
                <span className="material-symbols-outlined contract-icon">verified</span>
                <span className="contract-label">Sepolia Contract:</span>
                <span className="bbdrts-contract-addr">
                  {contractAddress.substring(0, 6)}...{contractAddress.substring(contractAddress.length - 4)}
                </span>
                <span className="material-symbols-outlined copy-icon">
                  {copied ? 'check' : 'content_copy'}
                </span>
                {copied && <span className="bbdrts-copied-tooltip">Copied!</span>}
              </div>

              <a
                href={`https://sepolia.etherscan.io/address/${contractAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bbdrts-footer-explorer-icon-link"
                title="Open contract on Sepolia Etherscan"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>open_in_new</span>
              </a>
            </div>

            {/* Live Operational Status Beacon */}
            <div
              className="bbdrts-footer-status-beacon"
              onClick={() => setShowLiveTracker(true)}
              title="Click to open the live real-time donation stream"
            >
              <span className="bbdrts-live-beacon" />
              <span>Ethereum Sepolia · All Systems Operational</span>
              <span className="material-symbols-outlined" style={{ fontSize: '14px', opacity: 0.6 }}>chevron_right</span>
            </div>
          </div>

          {/* ── Column 2: Relief Causes (Navigation) ── */}
          <div className="bbdrts-footer-col">
            <div className="bbdrts-footer-col-title">Relief Causes</div>
            <ul className="bbdrts-footer-links">
              <li>
                <button type="button" className="bbdrts-footer-link" onClick={handleNavigateCampaigns('ALL')}>
                  Explore All Causes
                </button>
              </li>
              <li>
                <button type="button" className="bbdrts-footer-link" onClick={handleNavigateCampaigns('DR')}>
                  Disaster Emergency Appeals
                </button>
              </li>
              <li>
                <button type="button" className="bbdrts-footer-link" onClick={handleNavigateCampaigns('CD')}>
                  Community Development
                </button>
              </li>
              <li>
                <button type="button" className="bbdrts-footer-link" onClick={handleNavigateRadar}>
                  Disaster Radar & Hazard Heatmap
                </button>
              </li>
              <li>
                <button type="button" className="bbdrts-footer-link" onClick={() => setShowLeaderboard(true)}>
                  Top Donors & Partner Wall
                </button>
              </li>
              <li>
                <button type="button" className="bbdrts-footer-link" onClick={handleHowItWorksClick}>
                  How Milestone Escrow Works
                </button>
              </li>
            </ul>
          </div>

          {/* ── Column 3: Blockchain Transparency ── */}
          <div className="bbdrts-footer-col">
            <div className="bbdrts-footer-col-title">Transparency</div>
            <ul className="bbdrts-footer-links">
              <li>
                <a
                  href={`https://sepolia.etherscan.io/address/${contractAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bbdrts-footer-link"
                >
                  Sepolia Public Ledger ↗
                </a>
              </li>
              <li>
                <button type="button" className="bbdrts-footer-link" onClick={() => setShowContractModal(true)}>
                  Smart Contract Architecture
                </button>
              </li>
              <li>
                <button type="button" className="bbdrts-footer-link" onClick={() => setShowLiveTracker(true)}>
                  Live Contribution Activity
                </button>
              </li>
              <li>
                <button type="button" className="bbdrts-footer-link" onClick={() => openGov('security')}>
                  Blockchain Audit & Receipt Verification
                </button>
              </li>
              <li>
                <button type="button" className="bbdrts-footer-link" onClick={() => openGov('allocation')}>
                  Milestone Fund Release Policy
                </button>
              </li>
              <li>
                <button type="button" className="bbdrts-footer-link" onClick={() => openGov('accreditation')}>
                  NGO Accreditation Standards
                </button>
              </li>
            </ul>
          </div>

          {/* ── Column 4: Governance, Compliance & Aid ── */}
          <div className="bbdrts-footer-col">
            <div className="bbdrts-footer-col-title">Governance & Legal</div>
            <ul className="bbdrts-footer-links">
              <li>
                <button type="button" className="bbdrts-footer-link" onClick={() => openLegal('agreement')}>
                  User Agreement
                </button>
              </li>
              <li>
                <button type="button" className="bbdrts-footer-link" onClick={() => openLegal('terms')}>
                  Terms of Service
                </button>
              </li>
              <li>
                <button type="button" className="bbdrts-footer-link" onClick={() => openLegal('privacy')}>
                  Privacy Policy (RA 10173)
                </button>
              </li>
              <li>
                <button type="button" className="bbdrts-footer-link" onClick={() => openLegal('integrity')}>
                  Aid Integrity &amp; Anti-Fraud
                </button>
              </li>
              <li>
                <button type="button" className="bbdrts-footer-link" onClick={() => openGov('accreditation')}>
                  SEC &amp; DSWD Vetting Protocol
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="bbdrts-footer-link bbdrts-footer-emergency-highlight"
                  onClick={() => setShowEmergencyModal(true)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#ef4444' }}>emergency</span>
                  <span>Emergency Hotlines (911 / 143)</span>
                </button>
              </li>
            </ul>
          </div>

        </div>
      </div>

      {/* ── Bottom Operational Strip (Vercel Style) ── */}
      <div className="bbdrts-footer-bottom">
        <div className="container bbdrts-footer-bottom-inner">
          <div className="bbdrts-footer-copyright">
            <span>© 2026 BBDRTS.</span>
            <span className="bbdrts-footer-sep">·</span>
            <span>Blockchain-Based Donation & Relief Transparency System</span>
            <span className="bbdrts-footer-sep">·</span>
            <span className="bbdrts-footer-flag">🇵🇭 Philippines</span>
          </div>

          <div className="bbdrts-footer-controls">
            <div className="bbdrts-footer-legal-links">
              <button type="button" className="bbdrts-footer-legal-btn" onClick={() => openLegal('agreement')}>User Agreement</button>
              <button type="button" className="bbdrts-footer-legal-btn" onClick={() => openLegal('terms')}>Terms</button>
              <button type="button" className="bbdrts-footer-legal-btn" onClick={() => openLegal('privacy')}>Privacy Policy</button>
              <button type="button" className="bbdrts-footer-legal-btn" onClick={() => openGov('security')}>Security</button>
              <button type="button" className="bbdrts-footer-legal-btn" onClick={() => setShowContractModal(true)}>Contract Audit</button>
              <button
                type="button"
                className="bbdrts-footer-legal-btn emergency-btn"
                onClick={() => setShowEmergencyModal(true)}
              >
                Hotlines (911)
              </button>
            </div>

            {/* Theme Toggle Pill in Footer */}
            {toggleTheme && (
              <button
                type="button"
                className="bbdrts-footer-theme-btn"
                onClick={toggleTheme}
                title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                  {theme === 'light' ? 'dark_mode' : 'light_mode'}
                </span>
                <span>{theme === 'light' ? 'Dark' : 'Light'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Governance & Compliance Modal */}
      <GovernanceModal
        isOpen={govModal.open}
        onClose={() => setGovModal({ ...govModal, open: false })}
        initialTab={govModal.tab}
      />

      {/* Statutory Legal Framework, User Agreement, Terms & Privacy (RA 10173) Modal */}
      <TermsPolicyModal
        isOpen={legalModal.open}
        onClose={() => setLegalModal(prev => ({ ...prev, open: false }))}
        initialTab={legalModal.tab}
        theme={theme}
      />

      {/* Smart Contract Verification Modal */}
      <SmartContractModal
        isOpen={showContractModal}
        onClose={() => setShowContractModal(false)}
        theme={theme}
      />

      {/* Live Activity Stream Modal */}
      <LiveTrackerModal
        isOpen={showLiveTracker}
        onClose={() => setShowLiveTracker(false)}
        theme={theme}
      />

      {/* Top Benefactors & Leaderboard Modal */}
      <LeaderboardModal
        isOpen={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
        theme={theme}
      />

      {/* Emergency Hotlines Modal */}
      {showEmergencyModal && createPortal(
        <div
          className="bbdrts-hotline-backdrop"
          onClick={() => setShowEmergencyModal(false)}
        >
          <div
            className="bbdrts-hotline-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bbdrts-hotline-modal-header">
              <div className="bbdrts-hotline-modal-title-wrap">
                <div className="bbdrts-hotline-icon-box">
                  <span className="material-symbols-outlined">emergency</span>
                </div>
                <div>
                  <h3 className="bbdrts-hotline-modal-title">Philippine Emergency & Relief Hotlines</h3>
                  <p className="bbdrts-hotline-modal-sub">
                    Verified national emergency numbers and 24/7 disaster response operations centers.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="bbdrts-hotline-close-btn"
                onClick={() => setShowEmergencyModal(false)}
                aria-label="Close hotlines modal"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Hotlines Grid */}
            <div className="bbdrts-hotline-grid">
              {EMERGENCY_HOTLINES.map((h) => (
                <div key={h.name} className="bbdrts-hotline-card">
                  <div className="bbdrts-hotline-card-top">
                    <div className="bbdrts-hotline-card-title-row">
                      <span className="material-symbols-outlined bbdrts-hotline-card-icon">{h.icon}</span>
                      <span className="bbdrts-hotline-card-name">{h.name}</span>
                    </div>
                    <span className="bbdrts-hotline-card-badge">{h.badge}</span>
                  </div>

                  <p className="bbdrts-hotline-card-desc">{h.desc}</p>

                  <div className="bbdrts-hotline-card-numbers">
                    <div className="bbdrts-hotline-main-num">{h.number}</div>
                    {h.altNumber && (
                      <div className="bbdrts-hotline-alt-num">Alt: {h.altNumber}</div>
                    )}
                  </div>

                  <div className="bbdrts-hotline-card-actions">
                    <a
                      href={`tel:${h.tel}`}
                      className="bbdrts-hotline-call-btn"
                      title={`Call ${h.name}`}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>call</span>
                      <span>Call Now</span>
                    </a>
                    <button
                      type="button"
                      className="bbdrts-hotline-copy-btn"
                      onClick={() => handleCopyNumber(h.number, h.name)}
                      title="Copy phone number"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                        {copiedHotline === h.name ? 'check' : 'content_copy'}
                      </span>
                      <span>{copiedHotline === h.name ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Advisory Footer */}
            <div className="bbdrts-hotline-modal-footer">
              <div className="bbdrts-hotline-advisory">
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#f59e0b' }}>info</span>
                <span>
                  For flood evacuations and immediate life threats, call <strong>911</strong> or <strong>PRC 143</strong> first. For real-time bulletins, monitor the <a href="https://ndrrmc.gov.ph" target="_blank" rel="noopener noreferrer">NDRRMC Official Portal ↗</a>.
                </span>
              </div>
              <button
                type="button"
                className="bbdrts-hotline-dismiss-btn"
                onClick={() => setShowEmergencyModal(false)}
              >
                Close Hotlines
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </footer>
  );
}