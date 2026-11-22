import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import VercelIcon from './VercelIcon';
import './TermsPolicyModal.css';

const LEGAL_SECTIONS = [
  {
    id: 'agreement',
    name: 'User Agreement',
    icon: 'assignment',
    badge: 'Binding Contract',
    summary: 'Master operational agreement governing all users, donors, NGOs, and humanitarian volunteers on BBDRTS.'
  },
  {
    id: 'terms',
    name: 'Terms of Service',
    icon: 'gavel',
    badge: 'Platform Terms',
    summary: 'Smart contract non-custody, dual-rail fiat processing, donation finality, and code of conduct.'
  },
  {
    id: 'privacy',
    name: 'Privacy Policy (RA 10173)',
    icon: 'verified_user',
    badge: 'Data Privacy Act',
    summary: 'Compliance with Philippine Data Privacy Act of 2012, personal data handling, encryption, and donor rights.'
  },
  {
    id: 'integrity',
    name: 'Aid Integrity & Anti-Fraud',
    icon: 'shield',
    badge: 'Zero Tolerance',
    summary: 'Verification standards, OCR receipt validation, milestone disbursements, and fraudulent activity sanctions.'
  }
];

export default function TermsPolicyModal({ isOpen, onClose, initialTab = 'agreement', theme }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);

  // Sync initial tab when opening
  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
      setSearchQuery('');
      setHasScrolledToBottom(false);
    }
  }, [isOpen, initialTab]);

  // Handle ESC key to dismiss
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background scroll when modal is active
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 50) {
      setHasScrolledToBottom(true);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="vercel-legal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
    >
      <div
        className="vercel-legal-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Top Navigation Bar (Vercel Geist Header) ── */}
        <header className="vercel-legal-topbar">
          <div className="vercel-legal-topbar-left">
            <div className="vercel-legal-logo-chip">
              <VercelIcon name="policy" size={16} color="#10b981" />
              <span>BBDRTS Compliance</span>
            </div>
            <span className="vercel-legal-sep">/</span>
            <span className="vercel-legal-current-title" id="legal-modal-title">
              {LEGAL_SECTIONS.find(s => s.id === activeTab)?.name || 'Legal & Governance'}
            </span>
            <span className="vercel-legal-jurisdiction-pill">
              🇵🇭 Republic of the Philippines
            </span>
          </div>

          <div className="vercel-legal-topbar-right">
            <button
              type="button"
              className="vercel-legal-print-btn"
              onClick={handlePrint}
              title="Print document for legal or accreditation records"
              aria-label="Print Document"
            >
              <VercelIcon name="feed" size={15} />
              <span>Print / Save PDF</span>
            </button>
            <span className="vercel-legal-esc-kbd" title="Press ESC to close">ESC</span>
            <button
              type="button"
              className="vercel-legal-close-btn"
              onClick={onClose}
              aria-label="Close legal terms modal"
            >
              <VercelIcon name="close" size={16} />
            </button>
          </div>
        </header>

        {/* ── Sub-header: Tab Navigation & Quick Search Bar ── */}
        <div className="vercel-legal-subbar">
          <div className="vercel-legal-tabs-list" role="tablist">
            {LEGAL_SECTIONS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`vercel-legal-tab-item ${isActive ? 'is-active' : ''}`}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSearchQuery('');
                  }}
                >
                  <VercelIcon
                    name={tab.icon}
                    size={14}
                    color={isActive ? '#10b981' : 'currentColor'}
                  />
                  <span>{tab.name}</span>
                  {isActive && <div className="vercel-legal-tab-indicator" />}
                </button>
              );
            })}
          </div>

          <div className="vercel-legal-search-box">
            <VercelIcon name="search" size={14} color="#71717a" />
            <input
              type="text"
              placeholder="Search legal clauses (e.g. RA 10173, refund, custody)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="vercel-legal-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                className="vercel-legal-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <VercelIcon name="close" size={12} />
              </button>
            )}
          </div>
        </div>

        {/* ── Main Legal Body Container with Scroll Handling ── */}
        <div className="vercel-legal-body" onScroll={handleScroll}>
          <div className="vercel-legal-content-wrapper">

            {/* Document Meta Banner */}
            <div className="vercel-legal-meta-banner">
              <div className="vercel-legal-meta-tag">
                <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#10b981' }}>verified</span>
                <span>OFFICIAL STATUTORY DOCUMENT • VERSION 2.4</span>
              </div>
              <h1 className="vercel-legal-doc-title">
                {LEGAL_SECTIONS.find(s => s.id === activeTab)?.name}
              </h1>
              <p className="vercel-legal-doc-summary">
                {LEGAL_SECTIONS.find(s => s.id === activeTab)?.summary}
              </p>
              <div className="vercel-legal-meta-stats">
                <span>Effective Date: <strong>November 1, 2026</strong></span>
                <span className="vercel-legal-dot">•</span>
                <span>Jurisdiction: <strong>Republic of the Philippines</strong></span>
                <span className="vercel-legal-dot">•</span>
                <span>Governing Body: <strong>National Privacy Commission &amp; SEC</strong></span>
              </div>
            </div>

            {/* TAB 1: USER AGREEMENT */}
            {activeTab === 'agreement' && (
              <div className="vercel-legal-prose">
                <section className="vercel-legal-section">
                  <h3>1. Preamble &amp; Agreement to Terms</h3>
                  <p>
                    Welcome to the <strong>Blockchain-Based Donation &amp; Relief Transparency System (BBDRTS)</strong>. 
                    By accessing our application, creating an institutional or donor profile, contributing humanitarian funds 
                    via Philippine digital payment rails (GCash, Maya, Cards, and Bank Transfer), 
                    or publishing relief campaigns, you agree to enter into a legally binding contract governed by the 
                    laws of the Republic of the Philippines.
                  </p>
                  <p>
                    If you are registering on behalf of a Non-Governmental Organization (NGO), Foundation, or Humanitarian 
                    Unit, you represent and warrant that you possess the requisite corporate capacity, board resolution, 
                    and statutory authority under <strong>Republic Act No. 11232 (The Revised Corporation Code of the Philippines)</strong> 
                    to bind your entity to these terms.
                  </p>
                </section>

                <section className="vercel-legal-section">
                  <h3>2. Classification of Participants</h3>
                  <div className="vercel-legal-grid-2">
                    <div className="vercel-legal-callout">
                      <div className="vercel-callout-header">
                        <VercelIcon name="volunteer_activism" size={16} color="#10b981" />
                        <h4>Verified Relief Donors</h4>
                      </div>
                      <p>
                        Individual and corporate benefactors contributing financial resources towards verified 
                        Philippine disaster campaigns. Donors receive cryptographic on-chain receipts, real-time 
                        milestone tracking, and immutable audit proof of all funds disbursed.
                      </p>
                    </div>

                    <div className="vercel-legal-callout">
                      <div className="vercel-callout-header">
                        <VercelIcon name="domain" size={16} color="#0ea5e9" />
                        <h4>Accredited Humanitarian NGOs</h4>
                      </div>
                      <p>
                        Non-profit organizations possessing verified certificates from the Securities and Exchange 
                        Commission (SEC) and the Department of Social Welfare and Development (DSWD). Accredited NGOs 
                        undertake fiduciary custody of relief deployment on ground disaster sites.
                      </p>
                    </div>
                  </div>
                </section>

                <section className="vercel-legal-section">
                  <h3>3. Code of Conduct &amp; Humanitarian Standard</h3>
                  <p>All participants within the BBDRTS ecosystem covenant and agree to uphold the following non-negotiable principles:</p>
                  <ul className="vercel-legal-bullet-list">
                    <li>
                      <strong>Zero Aid Diversion:</strong> 100% of collected campaign contributions must be allocated strictly 
                      towards emergency food supplies, clean potable water, temporary shelter materials, medical first aid, 
                      and community rehabilitation as detailed in the published campaign allocation breakdown.
                    </li>
                    <li>
                      <strong>Photographic Ground Verification:</strong> NGOs must upload GPS-stamped, unedited ground photographic 
                      evidence documenting disaster impact and emergency relief distribution before, during, and after aid dispatch.
                    </li>
                    <li>
                      <strong>Transparent Expenditure Records:</strong> All fiat withdrawals and smart contract fund disbursements 
                      must be backed by verified commercial receipts, beneficiary acknowledgment manifests, and logistical haul bills.
                    </li>
                    <li>
                      <strong>Prohibition of Extortion or Political Favor:</strong> Relief distributions must be delivered on 
                      a strictly humanitarian, non-sectarian, and non-partisan basis without regard to race, creed, or political affiliation.
                    </li>
                  </ul>
                </section>

                <section className="vercel-legal-section">
                  <h3>4. Limitation of Platform Liability</h3>
                  <p>
                    BBDRTS operates as a decentralized coordination protocol and public transparency registry. While BBDRTS 
                    enforces algorithmic receipt verification, automated QR OCR checking, and SEC/DSWD registry vetting, 
                    the actual execution of physical disaster field operations is carried out by the accredited NGO. BBDRTS 
                    shall not be held liable for losses resulting from natural force majeure, regional power blackouts, telecommunication 
                    fiber cuts during severe tropical typhoons, or unauthorized local administrative delays.
                  </p>
                </section>

                <section className="vercel-legal-section">
                  <h3>5. Dispute Resolution &amp; Arbitration</h3>
                  <p>
                    Any dispute, controversy, or claim arising out of or relating to this Agreement shall be referred to and 
                    finally resolved by arbitration administered by the Philippine Dispute Resolution Center, Inc. (PDRCI) 
                    in accordance with the Arbitration Rules of the PDRCI for the time being in force. The seat of arbitration 
                    shall be Metro Manila, Philippines.
                  </p>
                </section>
              </div>
            )}

            {/* TAB 2: TERMS OF SERVICE */}
            {activeTab === 'terms' && (
              <div className="vercel-legal-prose">
                <section className="vercel-legal-section">
                  <h3>1. Gasless Blockchain Audit Architecture</h3>
                  <p>
                    BBDRTS uses immutable Ethereum smart contracts (deployed on Sepolia EVM) strictly as a <strong>public, tamper-proof transparency ledger</strong>.
                    All donations are processed in Philippine Pesos (PHP) — users are never required to purchase cryptocurrency, manage private keys, or install MetaMask.
                  </p>
                  <div className="vercel-legal-info-box">
                    <VercelIcon name="lock" size={16} color="#10b981" />
                    <div>
                      <strong>Zero-Wallet Gasless Relayer:</strong>
                      <span> Our platform relayer automatically covers blockchain gas fees and anchors verified PHP donation receipts and NGO disbursement proofs onto Ethereum Sepolia for public verification.</span>
                    </div>
                  </div>
                </section>

                <section className="vercel-legal-section">
                  <h3>2. Immutable Audit Record Finality</h3>
                  <p>
                    Once a verified donation or NGO disbursement milestone is notarized onto the Ethereum Sepolia ledger, its cryptographic audit hash is permanent and cannot be silently altered or deleted by any administrator or organization.
                  </p>
                </section>

                <section className="vercel-legal-section">
                  <h3>3. Philippine Multi-Rail Payment Processing (GCash, Maya, Bank &amp; Card)</h3>
                  <p>
                    To ensure 100% financial inclusion across the Philippine archipelago, BBDRTS operates natively in Philippine Pesos:
                  </p>
                  <ul className="vercel-legal-bullet-list">
                    <li>
                      <strong>Direct Recipient Routing:</strong> Donations made via QR Ph (Xendit), GCash, Maya, credit/debit card, or direct Philippine bank transfer settle to the verified NGO with 0% BBDRTS platform commission (standard third-party Xendit or bank/e-wallet processing fees may apply).
                    </li>
                    <li>
                      <strong>Receipt Reference Deduplication:</strong> Every uploaded payment slip is parsed by our automated AI Vision OCR engine. Bank and e-wallet reference numbers are cryptographically hashed and deduplicated to prevent counterfeit or recycled slips.
                    </li>
                    <li>
                      <strong>Public On-Chain Reconciliation:</strong> Every verified donation and NGO field disbursement is anchored onto Sepolia with a public Etherscan verification link.
                    </li>
                  </ul>
                </section>

                <section className="vercel-legal-section">
                  <h3>4. Prohibited Activities</h3>
                  <p>Users and organizations agree that they shall NOT:</p>
                  <ul className="vercel-legal-bullet-list">
                    <li>Upload falsified, AI-generated, or edited disaster impact photos to inflate calamity severity.</li>
                    <li>Submit counterfeit, forged, or altered bank deposit slips or GCash/Maya transfer receipts.</li>
                    <li>Use the platform for money laundering, structured deposits, or financing of terrorist activities under the Philippine Anti-Money Laundering Act (AMLA / RA 9160).</li>
                    <li>Attempt to exploit smart contract reentrancy, deploy flash loans against campaign balances, or inject malicious scripts into public verification uploads.</li>
                    <li>Harvest or scrape personal contact details, mobile numbers, or identities of relief donors or disaster victims.</li>
                  </ul>
                </section>

                <section className="vercel-legal-section">
                  <h3>5. Service Availability &amp; Emergency SLA</h3>
                  <p>
                    While BBDRTS maintains distributed multi-region cloud infrastructure designed for 99.9% uptime during severe 
                    natural disasters, we do not warrant uninterrupted operation during severe international subsea fiber cuts, 
                    grid collapse, or widespread regional catastrophe. In such events, local cached data and immutable on-chain records 
                    remain queryable directly through public EVM RPC endpoints.
                  </p>
                </section>
              </div>
            )}

            {/* TAB 3: PRIVACY POLICY (RA 10173) */}
            {activeTab === 'privacy' && (
              <div className="vercel-legal-prose">
                <section className="vercel-legal-section">
                  <div className="vercel-legal-statute-header">
                    <VercelIcon name="verified_user" size={20} color="#10b981" />
                    <div>
                      <h3>Compliance with Republic Act No. 10173</h3>
                      <span>Data Privacy Act of 2012 (DPA) &amp; National Privacy Commission (NPC) Implementing Rules</span>
                    </div>
                  </div>
                  <p>
                    The <strong>Blockchain-Based Donation &amp; Relief Transparency System (BBDRTS)</strong> is committed to 
                    safeguarding the privacy and data rights of our users, donors, humanitarian volunteers, and accredited non-profit entities. 
                    This Privacy Policy details our operational protocols for the collection, processing, protection, and retention 
                    of personal and sensitive personal data.
                  </p>
                </section>

                <section className="vercel-legal-section">
                  <h3>1. Personal Data We Collect</h3>
                  <p>We collect and process only the minimal data strictly necessary to fulfill humanitarian aid verification:</p>
                  <div className="vercel-legal-data-table-wrap">
                    <table className="vercel-legal-table">
                      <thead>
                        <tr>
                          <th>Data Category</th>
                          <th>Specific Data Elements</th>
                          <th>Purpose of Processing</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><strong>Identity Data</strong></td>
                          <td>Public Display Name, User Role, Profile Avatar</td>
                          <td>Public leaderboard display, donor pass generation, and community attribution.</td>
                        </tr>
                        <tr>
                          <td><strong>Contact Data</strong></td>
                          <td>Mobile Contact Number (Philippine +63 format), Verified Email Address</td>
                          <td>Two-factor SMS OTP authentication, disaster alert notifications, and receipt confirmation.</td>
                        </tr>
                        <tr>
                          <td><strong>Location Data</strong></td>
                          <td>Region, Province, City/Municipality, Barangay (PSGC Standard)</td>
                          <td>Geographic matching of relief donors to nearby regional calamity zones.</td>
                        </tr>
                        <tr>
                          <td><strong>Financial &amp; Audit Data</strong></td>
                          <td>GCash/Maya/Bank Reference #, Receipt Image, Sepolia Audit Transaction Hash</td>
                          <td>AI receipt verification and immutable gasless on-chain audit reconciliation.</td>
                        </tr>
                        <tr>
                          <td><strong>Institutional Data</strong></td>
                          <td>SEC Certificate, DSWD Permit #, Official NGO Name, Representative Name</td>
                          <td>Accreditation verification and anti-fraud institutional compliance.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="vercel-legal-section">
                  <h3>2. Lawful Basis for Processing</h3>
                  <p>We process personal data under the following legal bases recognized by the Data Privacy Act of 2012:</p>
                  <ul className="vercel-legal-bullet-list">
                    <li><strong>Explicit Consent (Section 12.a):</strong> Freely given, specific, and informed consent indicated when creating an account or submitting a donation.</li>
                    <li><strong>Contractual Necessity (Section 12.b):</strong> Necessary for the fulfillment of the user agreement and execution of relief contribution contracts.</li>
                    <li><strong>Legitimate Humanitarian Interest (Section 12.f):</strong> Vital public interest in ensuring disaster relief transparently reaches calamity-stricken communities during declared States of Calamity.</li>
                  </ul>
                </section>

                <section className="vercel-legal-section">
                  <h3>3. Data Protection &amp; Cryptographic Security Measures</h3>
                  <p>BBDRTS enforces bank-grade organizational, physical, and technical safeguards:</p>
                  <ul className="vercel-legal-bullet-list">
                    <li><strong>Encryption at Rest &amp; in Transit:</strong> All database records are encrypted with AES-256; web traffic is secured exclusively via TLS 1.3 with strict HSTS headers.</li>
                    <li><strong>Cryptographic Salting:</strong> Passwords, OTP pins, and confidential references are hashed using industry-standard bcrypt with high cost factors.</li>
                    <li><strong>Privacy-Preserving Public Ledger:</strong> On-chain audit events record only anonymized campaign and donation hashes. Personal identifiers like full names, emails, or phone numbers are never published on the public blockchain.</li>
                    <li><strong>Zero Data Selling:</strong> We NEVER sell, lease, monetize, or disclose donor or user records to commercial advertising networks or third-party marketing entities.</li>
                  </ul>
                </section>

                <section className="vercel-legal-section">
                  <h3>4. Rights of the Data Subject under RA 10173</h3>
                  <p>As a data subject registered on BBDRTS, you are entitled to the full protection of your statutory rights:</p>
                  <div className="vercel-legal-rights-grid">
                    <div className="vercel-legal-right-card">
                      <strong>Right to be Informed</strong>
                      <p>You have the right to know whether your personal data shall be, are being, or have been processed.</p>
                    </div>
                    <div className="vercel-legal-right-card">
                      <strong>Right of Access</strong>
                      <p>You may request reasonable access to your personal information and audit logs stored on our systems.</p>
                    </div>
                    <div className="vercel-legal-right-card">
                      <strong>Right to Rectification</strong>
                      <p>You can dispute inaccuracies and modify your profile details anytime via your Account Settings.</p>
                    </div>
                    <div className="vercel-legal-right-card">
                      <strong>Right to Erasure / Blocking</strong>
                      <p>You may request account deletion, subject to statutory 5-year disaster accounting retention rules.</p>
                    </div>
                  </div>
                </section>

                <section className="vercel-legal-section">
                  <h3>5. Data Retention &amp; Disposal</h3>
                  <p>
                    Personal data is retained only for as long as necessary to achieve humanitarian auditing purposes. Under 
                    applicable Philippine disaster risk accounting standards and Commission on Audit (COA) guidelines, disaster 
                    contribution records and allocation receipts are retained for a statutory period of five (5) years following 
                    campaign completion, after which records are anonymized or cryptographically shredded.
                  </p>
                </section>

                <section className="vercel-legal-section">
                  <h3>6. Contact our Data Protection Officer (DPO)</h3>
                  <p>
                    For inquiries, complaints, or exercising your data rights under RA 10173, you may contact our designated 
                    Data Protection Officer:
                  </p>
                  <div className="vercel-legal-contact-card">
                    <VercelIcon name="mail" size={16} color="#10b981" />
                    <div>
                      <strong>BBDRTS Data Protection Office</strong><br />
                      <span>Email: </span><a href="mailto:privacy@bbdrts.ph" className="vercel-legal-link">privacy@bbdrts.ph</a><br />
                      <span>Physical Address: </span><span>37 EDSA cor. Boni Ave, Mandaluyong City, Metro Manila, Philippines</span>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* TAB 4: AID INTEGRITY & ANTI-FRAUD */}
            {activeTab === 'integrity' && (
              <div className="vercel-legal-prose">
                <section className="vercel-legal-section">
                  <h3>1. Four-Pillar Aid Integrity Framework</h3>
                  <p>
                    BBDRTS operates under an uncompromising Zero-Tolerance Anti-Fraud Policy. Every disaster relief campaign 
                    must strictly pass four independent verification pillars before funds can be withdrawn or disbursed:
                  </p>
                  <div className="vercel-legal-pillars-list">
                    <div className="vercel-legal-pillar-item">
                      <div className="vercel-pillar-num">01</div>
                      <div className="vercel-pillar-body">
                        <strong>Statutory Accreditation Vetting</strong>
                        <p>Mandatory cross-verification of SEC Non-Profit Registration and DSWD Authority to Solicit licenses.</p>
                      </div>
                    </div>

                    <div className="vercel-legal-pillar-item">
                      <div className="vercel-pillar-num">02</div>
                      <div className="vercel-pillar-body">
                        <strong>Ground Photographic &amp; GPS Evidence</strong>
                        <p>Mandatory minimum of ground disaster aftermath photos verified against PAGASA and NDRRMC calamity telemetry.</p>
                      </div>
                    </div>

                    <div className="vercel-legal-pillar-item">
                      <div className="vercel-pillar-num">03</div>
                      <div className="vercel-pillar-body">
                        <strong>AI OCR Receipt &amp; Duplicate Reference Inspection</strong>
                        <p>Every commercial invoice and fiat slip is scanned to ensure reference IDs and vendor TINs are authentic.</p>
                      </div>
                    </div>

                    <div className="vercel-legal-pillar-item">
                      <div className="vercel-pillar-num">04</div>
                      <div className="vercel-pillar-body">
                        <strong>Milestone-Based Smart Contract Release</strong>
                        <p>Campaign funds are released in stepped tranches matching operational logistics milestones.</p>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="vercel-legal-section">
                  <h3>2. Sanctions for Fraudulent Relief Campaigns</h3>
                  <p>
                    Any organization, representative, or individual found attempting to siphon relief aid, upload forged receipts, 
                    misrepresent disaster severity, or duplicate transaction claims shall face immediate and irreversible sanctions:
                  </p>
                  <ul className="vercel-legal-bullet-list">
                    <li><strong>Immediate Account Freezing &amp; Blacklisting:</strong> Permanent deactivation of organizational profile and smart contract addresses across the entire BBDRTS network.</li>
                    <li><strong>Forfeiture of Calamity Reserve:</strong> Immediate transfer of remaining campaign funds to the National Disaster Risk Reduction &amp; Management Council (NDRRMC) emergency reserve pool.</li>
                    <li><strong>Statutory Criminal Referral:</strong> Formal referral to the Philippine National Police Anti-Cybercrime Group (PNP-ACG) and National Bureau of Investigation (NBI) Cybercrime Division for prosecution under <em>RA 10175 (Cybercrime Prevention Act)</em> and Article 315 of the Revised Penal Code (Swindling / Estafa).</li>
                  </ul>
                </section>

                <section className="vercel-legal-section">
                  <h3>3. Whistleblower &amp; Fraud Reporting Desk</h3>
                  <p>
                    If you observe discrepancies in relief distribution, missing field photo evidence, or suspect fraudulent 
                    activity on any active relief campaign, please report it immediately to our 24/7 Aid Integrity Desk:
                  </p>
                  <div className="vercel-legal-contact-card">
                    <VercelIcon name="security" size={16} color="#ef4444" />
                    <div>
                      <strong>BBDRTS Humanitarian Aid Integrity Desk</strong><br />
                      <span>Hotline: </span><strong>(02) 8911-5061 (NDRRMC Liaison) / 911</strong><br />
                      <span>Confidential Email: </span><a href="mailto:integrity@bbdrts.ph" className="vercel-legal-link">integrity@bbdrts.ph</a>
                    </div>
                  </div>
                </section>
              </div>
            )}

          </div>
        </div>

        {/* ── Modal Footer: Acceptance Status & Acknowledgment Action ── */}
        <footer className="vercel-legal-footer">
          <div className="vercel-legal-footer-left">
            <VercelIcon name="check_circle" size={16} color="#10b981" />
            <span className="vercel-legal-footer-hint">
              {hasScrolledToBottom
                ? 'You have reviewed the complete statutory disclosure.'
                : 'Scroll through the disclosure to review all statutory requirements.'}
            </span>
          </div>

          <div className="vercel-legal-footer-right">
            <button
              type="button"
              className="vercel-legal-btn-secondary"
              onClick={onClose}
            >
              Close
            </button>
            <button
              type="button"
              className="vercel-legal-btn-primary"
              onClick={onClose}
            >
              <VercelIcon name="check" size={14} color="#000000" />
              <span>I Understand &amp; Agree</span>
            </button>
          </div>
        </footer>

      </div>
    </div>,
    document.body
  );
}
