import { useState } from 'react';
import { contractAddress } from '../contractConfig';
import { useToast } from '../context/ToastContext';

export default function SmartContractModal({ isOpen, onClose, theme }) {
  const { showSuccess } = useToast();
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(contractAddress);
    }
    setCopied(true);
    showSuccess('Smart contract address copied to clipboard! 📋');
    setTimeout(() => setCopied(false), 2200);
  };

  const isLight = theme === 'light';

  return (
    <div 
      className="modal-overlay" 
      onClick={onClose} 
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        width: '100vw', 
        height: '100vh', 
        background: 'rgba(5, 7, 12, 0.85)', 
        backdropFilter: 'blur(12px)', 
        WebkitBackdropFilter: 'blur(12px)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        zIndex: 10000 
      }}
    >
      <div 
        className="card glow" 
        onClick={e => e.stopPropagation()} 
        style={{ 
          width: '640px', 
          maxWidth: '92vw', 
          maxHeight: '90vh', 
          overflowY: 'auto', 
          background: isLight ? '#ffffff' : '#0f141e', 
          border: isLight ? '1px solid rgba(0,0,0,0.12)' : '1px solid rgba(34, 197, 94, 0.35)', 
          borderRadius: '18px', 
          padding: '28px', 
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 35px rgba(34, 197, 94, 0.15)',
          color: isLight ? '#0f172a' : '#ffffff',
          position: 'relative'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', borderBottom: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.08)', paddingBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '26px' }}>verified</span>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Smart Contract Verification</h3>
                <span style={{ fontSize: '0.72rem', background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.35)', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                  LIVE EVM
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: isLight ? '#64748b' : '#94a3b8' }}>
                Cryptographic specifications and Sepolia testnet execution parameters
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: isLight ? '#64748b' : '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '8px' }}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Contract Core Info Card */}
        <div style={{ background: isLight ? '#f8fafc' : 'rgba(0, 0, 0, 0.35)', border: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '18px', marginBottom: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: isLight ? '#64748b' : '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Contract Name</div>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: isLight ? '#0f172a' : '#ffffff', marginTop: '3px' }}>DisasterReliefTransparency.sol</div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: isLight ? '#64748b' : '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Network & Chain ID</div>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#22c55e', marginTop: '3px' }}>Ethereum Sepolia (11155111)</div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: isLight ? '#64748b' : '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Compiler & License</div>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: isLight ? '#0f172a' : '#ffffff', marginTop: '3px' }}>Solidity ^0.8.20 (MIT)</div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.7rem', color: isLight ? '#64748b' : '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '6px' }}>Deployed Contract Address</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: isLight ? '#ffffff' : '#090d14', border: isLight ? '1px solid rgba(0,0,0,0.12)' : '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '8px 12px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#22c55e' }}>tag</span>
              <code style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-mono, monospace)', fontSize: '0.82rem', color: isLight ? '#0f172a' : '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {contractAddress}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                style={{ background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.35)', color: '#22c55e', borderRadius: '6px', padding: '4px 10px', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{copied ? 'check' : 'content_copy'}</span>
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Security & Architecture Guarantees */}
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ margin: '0 0 12px', fontSize: '0.88rem', color: isLight ? '#475569' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 800 }}>
            Institutional Blockchain Guarantees
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 14px', borderRadius: '10px', background: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.02)', border: isLight ? '1px solid rgba(0,0,0,0.05)' : '1px solid rgba(255,255,255,0.05)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#22c55e', marginTop: '2px' }}>account_balance</span>
              <div>
                <strong style={{ fontSize: '0.84rem', color: isLight ? '#0f172a' : '#ffffff' }}>0% Platform Fees:</strong>
                <span style={{ fontSize: '0.8rem', color: isLight ? '#64748b' : '#94a3b8', marginLeft: '6px' }}>
                  100% of all received donations (crypto, e-wallets, and bank transfers) settle directly to verified NGO accounts with zero middleman deductions.
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 14px', borderRadius: '10px', background: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.02)', border: isLight ? '1px solid rgba(0,0,0,0.05)' : '1px solid rgba(255,255,255,0.05)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#38bdf8', marginTop: '2px' }}>hub</span>
              <div>
                <strong style={{ fontSize: '0.84rem', color: isLight ? '#0f172a' : '#ffffff' }}>Immutable Event Logs:</strong>
                <span style={{ fontSize: '0.8rem', color: isLight ? '#64748b' : '#94a3b8', marginLeft: '6px' }}>
                  Every disbursement, milestone achievement, and individual contribution emits indexed EVM logs, preventing historical record tampering.
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 14px', borderRadius: '10px', background: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.02)', border: isLight ? '1px solid rgba(0,0,0,0.05)' : '1px solid rgba(255,255,255,0.05)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#f59e0b', marginTop: '2px' }}>gavel</span>
              <div>
                <strong style={{ fontSize: '0.84rem', color: isLight ? '#0f172a' : '#ffffff' }}>Public Auditability:</strong>
                <span style={{ fontSize: '0.8rem', color: isLight ? '#64748b' : '#94a3b8', marginLeft: '6px' }}>
                  Donors, disaster response agencies, and state auditors can independently inspect balance ledgers directly via Etherscan without platform permission.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', paddingTop: '16px', borderTop: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.08)' }}>
          <a
            href={`https://sepolia.etherscan.io/address/${contractAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#16a34a', color: '#ffffff', padding: '10px 18px', borderRadius: '10px', fontSize: '0.86rem', fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 14px rgba(22, 163, 74, 0.35)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>open_in_new</span>
            <span>Inspect on Sepolia Etherscan ↗</span>
          </a>

          <button
            type="button"
            onClick={onClose}
            style={{ background: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)', color: isLight ? '#334155' : '#cbd5e1', border: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255, 255, 255, 0.12)', padding: '10px 18px', borderRadius: '10px', fontSize: '0.86rem', fontWeight: 600, cursor: 'pointer' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
