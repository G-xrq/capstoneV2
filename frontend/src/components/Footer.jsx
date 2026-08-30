import { useState } from 'react';
import { contractAddress } from '../contractConfig';
import './Footer.css';

export default function Footer({ onNavigate }) {
  const [copied, setCopied] = useState(false);

  const handleCopyContract = (e) => {
    e.preventDefault();
    navigator.clipboard.writeText(contractAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <footer className="bbdrts-footer-root" id="footer-governance">
      <div className="bbdrts-footer-top-accent" />

      <div className="container bbdrts-footer-main">
        <div className="bbdrts-footer-grid">

          {/* ── Column 1: Brand & Mission ── */}
          <div className="bbdrts-footer-brand-col">
            <div className="bbdrts-footer-logo-row">
              <img src="/logo.png" alt="BBDRTS Logo" className="bbdrts-footer-logo-img" />
              <div>
                <div className="bbdrts-footer-brand-name">BBDRTS System</div>
                <div className="bbdrts-footer-brand-sub">Blockchain-Based Donation & Relief Transparency System</div>
              </div>
            </div>

            <p className="bbdrts-footer-mission">
              An institutional-grade, cryptographically auditable disaster relief allocation system deployed on the Sepolia EVM. Eliminating intermediary friction and ensuring 100% transparent humanitarian aid distribution across the Philippines.
            </p>

            {/* Smart Contract Quick Reference */}
            <div 
              className="bbdrts-footer-contract-chip" 
              onClick={handleCopyContract} 
              title="Click to copy Solidity Smart Contract Address"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#22c55e' }}>verified</span>
              <span>Contract:</span>
              <span className="bbdrts-contract-addr">{contractAddress.substring(0, 6)}...{contractAddress.substring(contractAddress.length - 4)}</span>
              <span className="material-symbols-outlined" style={{ fontSize: '14px', color: copied ? '#22c55e' : 'var(--text-muted)' }}>
                {copied ? 'check' : 'content_copy'}
              </span>
            </div>

            {/* Institutional Security Seals */}
            <div className="bbdrts-footer-trust-seals">
              <div className="bbdrts-trust-seal-item">
                <span className="material-symbols-outlined" style={{ fontSize: '13px', color: '#22c55e' }}>security</span>
                <span>Sepolia EVM Verified</span>
              </div>
              <div className="bbdrts-trust-seal-item">
                <span className="material-symbols-outlined" style={{ fontSize: '13px', color: '#38bdf8' }}>qr_code_2</span>
                <span>Multi-Rail Ready</span>
              </div>
              <div className="bbdrts-trust-seal-item">
                <span className="material-symbols-outlined" style={{ fontSize: '13px', color: '#f59e0b' }}>lock</span>
                <span>256-Bit SSL</span>
              </div>
            </div>
          </div>

          {/* ── Column 2: Protocol & Web3 Rails ── */}
          <div>
            <div className="bbdrts-footer-col-title">
              <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#22c55e' }}>token</span>
              <span>Protocol Rails</span>
            </div>
            <ul className="bbdrts-footer-links">
              <li className="bbdrts-footer-link-item">
                <a href="#campaigns">
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>chevron_right</span>
                  <span>Active Relief Causes</span>
                </a>
              </li>
              <li className="bbdrts-footer-link-item">
                <a href="#how-it-works">
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>chevron_right</span>
                  <span>How It Works</span>
                </a>
              </li>
              <li className="bbdrts-footer-link-item">
                <a href={`https://sepolia.etherscan.io/address/${contractAddress}`} target="_blank" rel="noopener noreferrer">
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>chevron_right</span>
                  <span>Sepolia EVM Explorer ↗</span>
                </a>
              </li>
              <li className="bbdrts-footer-link-item">
                <a href="#campaigns">
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>chevron_right</span>
                  <span>Instant Fiat Gateway (GCash/Maya)</span>
                </a>
              </li>
              <li className="bbdrts-footer-link-item">
                <a href="#transparency">
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>chevron_right</span>
                  <span>Smart Contract Verification</span>
                </a>
              </li>
            </ul>
          </div>

          {/* ── Column 3: Governance & Security ── */}
          <div>
            <div className="bbdrts-footer-col-title">
              <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#38bdf8' }}>admin_panel_settings</span>
              <span>Governance</span>
            </div>
            <ul className="bbdrts-footer-links">
              <li className="bbdrts-footer-link-item">
                <a href="#architecture">
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>chevron_right</span>
                  <span>NGO Accreditation Protocol</span>
                </a>
              </li>
              <li className="bbdrts-footer-link-item">
                <a href="#architecture">
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>chevron_right</span>
                  <span>Anti-Sybil Role Hierarchy</span>
                </a>
              </li>
              <li className="bbdrts-footer-link-item">
                <a href="#architecture">
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>chevron_right</span>
                  <span>Disaster Response Standards</span>
                </a>
              </li>
              <li className="bbdrts-footer-link-item">
                <a href="#architecture">
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>chevron_right</span>
                  <span>NDRRMC Guidelines Compliance</span>
                </a>
              </li>
              <li className="bbdrts-footer-link-item">
                <a href="#architecture">
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>chevron_right</span>
                  <span>Auditing & Transparency Reports</span>
                </a>
              </li>
            </ul>
          </div>

          {/* ── Column 4: Academic Attribution ── */}
          <div>
            <div className="bbdrts-footer-col-title">
              <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#eab308' }}>school</span>
              <span>Institutional Origin</span>
            </div>
            
            <div className="bbdrts-footer-academic-card">
              <div className="bbdrts-academic-title">College of Computer Studies</div>
              <div className="bbdrts-academic-sub">Saint Joseph College · SJC Maasin</div>
              <div style={{ margin: '8px 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Maasin City, Southern Leyte, Philippines
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', fontSize: '0.72rem', color: '#22c55e', fontWeight: 600 }}>
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>workspace_premium</span>
                <span>Academic Capstone Defense 2026</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Bottom Strip: Uptime & Legal ── */}
      <div className="bbdrts-footer-bottom">
        <div className="container bbdrts-footer-bottom-inner">
          <div className="bbdrts-footer-status-pill">
            <span className="bbdrts-status-dot" style={{ width: '6px', height: '6px' }} />
            <span>All Systems Operational · Sepolia EVM 100% Uptime</span>
          </div>

          <div style={{ color: 'var(--text-muted)' }}>
            © 2026 BBDRTS Protocol. Engineered for Immutable Humanitarian Aid.
          </div>

          <div className="bbdrts-footer-legal-links">
            <a href="#architecture">Security Policy</a>
            <span>•</span>
            <a href="#architecture">Terms of Governance</a>
            <span>•</span>
            <a href="#architecture">Open-Source Audit</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
