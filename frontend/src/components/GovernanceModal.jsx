import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { contractAddress } from '../contractConfig';

export default function GovernanceModal({ isOpen, onClose, initialTab = 'governance' }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  if (!isOpen) return null;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(5, 7, 12, 0.85)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        padding: '16px'
      }}
      className="fade-in"
    >
      <div
        className="card bounce-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '780px',
          maxWidth: '94vw',
          maxHeight: '90vh',
          background: 'var(--bg-card, #16181e)',
          border: '1px solid var(--border, rgba(255, 255, 255, 0.12))',
          borderRadius: '20px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)',
          color: 'var(--text-primary, #ffffff)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(34, 197, 94, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#22c55e'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>policy</span>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                Institutional Governance & Security Framework
              </h3>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)' }}>
                BBDRTS Protocol • Compliance, Accreditation & Calamity Reserve Standards
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              borderRadius: '8px',
              color: 'var(--text-secondary, #cbd5e1)',
              cursor: 'pointer',
              padding: '6px 10px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
          padding: '0 24px',
          background: 'rgba(0, 0, 0, 0.2)',
          overflowX: 'auto',
          gap: '4px'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('governance')}
            style={{
              padding: '12px 14px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'governance' ? '2px solid #22c55e' : '2px solid transparent',
              color: activeTab === 'governance' ? '#22c55e' : 'var(--text-muted, #94a3b8)',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>gavel</span>
            <span>Terms of Governance</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('accreditation')}
            style={{
              padding: '12px 14px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'accreditation' ? '2px solid #22c55e' : '2px solid transparent',
              color: activeTab === 'accreditation' ? '#22c55e' : 'var(--text-muted, #94a3b8)',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>verified</span>
            <span>NGO Accreditation</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('allocation')}
            style={{
              padding: '12px 14px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'allocation' ? '2px solid #22c55e' : '2px solid transparent',
              color: activeTab === 'allocation' ? '#22c55e' : 'var(--text-muted, #94a3b8)',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>pie_chart</span>
            <span>Fund Allocation Policies</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            style={{
              padding: '12px 14px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'security' ? '2px solid #22c55e' : '2px solid transparent',
              color: activeTab === 'security' ? '#22c55e' : 'var(--text-muted, #94a3b8)',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>shield</span>
            <span>Security & Audit</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('academic')}
            style={{
              padding: '12px 14px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'academic' ? '2px solid #22c55e' : '2px solid transparent',
              color: activeTab === 'academic' ? '#22c55e' : 'var(--text-muted, #94a3b8)',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>school</span>
            <span>Institutional Origin</span>
          </button>
        </div>

        {/* Tab Body */}
        <div style={{
          padding: '24px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          lineHeight: '1.6',
          fontSize: '0.86rem',
          color: 'var(--text-secondary, #cbd5e1)'
        }}>
          {activeTab === 'governance' && (
            <div>
              <h4 style={{ color: '#ffffff', fontSize: '1rem', marginBottom: '8px' }}>
                Charter of Humanitarian Governance
              </h4>
              <p>
                The Blockchain-Based Donation & Relief Transparency System (BBDRTS) operates under a zero-intermediary charter. All smart contracts and multi-rail payment channels directly escrow and release funds to accredited disaster-relief non-governmental organizations (NGOs) upon cryptographic milestone validation.
              </p>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '14px', marginTop: '12px' }}>
                <h5 style={{ color: '#22c55e', margin: '0 0 6px 0', fontSize: '0.88rem' }}>1. Monetary Contributions Exclusivity</h5>
                <p style={{ margin: 0, fontSize: '0.82rem' }}>
                  The BBDRTS protocol exclusively handles <strong>monetary relief donations</strong> (Philippine Peso via GCash, Maya, cards, bank transfer, and Ethereum cryptocurrency). The platform does not coordinate or accept physical in-kind goods collections (such as second-hand clothes or perishable groceries).
                </p>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '14px', marginTop: '10px' }}>
                <h5 style={{ color: '#38bdf8', margin: '0 0 6px 0', fontSize: '0.88rem' }}>2. Role-Based Access Hierarchy & Anti-Sybil Controls</h5>
                <p style={{ margin: 0, fontSize: '0.82rem' }}>
                  The platform enforces strict cryptographic role separation: <strong>Donors</strong> (pure contribution & tax receipt issuance), <strong>Accredited NGOs</strong> (appeal creation & field disbursement execution), and <strong>Auditor Admin</strong> (on-chain KYC accreditation and emergency pause authority).
                </p>
              </div>
            </div>
          )}

          {activeTab === 'accreditation' && (
            <div>
              <h4 style={{ color: '#ffffff', fontSize: '1rem', marginBottom: '8px' }}>
                NGO Accreditation & Vetting Protocol
              </h4>
              <p>
                To prevent fraud and ensure aid reaches legitimate on-ground calamity operations, all organizations must pass a 4-tier accreditation protocol compliant with Republic Act No. 10121 (Philippine Disaster Risk Reduction and Management Act of 2010):
              </p>
              <ul style={{ paddingLeft: '20px', margin: '10px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li><strong>Securities and Exchange Commission (SEC) Registration:</strong> Verified Certificate of Incorporation and Articles of Incorporation.</li>
                <li><strong>DSWD Authority to Solicit:</strong> Official permit issued by the Department of Social Welfare and Development for charitable calamity drives.</li>
                <li><strong>Cryptographic Multi-Signature Binding:</strong> Linking of an official institutional EVM wallet address to the vetted executive signatory.</li>
                <li><strong>Quarterly Ground Audit:</strong> Mandatory posting of GPS-tagged field delivery photos, itemized receipts, and local barangay certificates of assistance.</li>
              </ul>
            </div>
          )}

          {activeTab === 'allocation' && (
            <div>
              <h4 style={{ color: '#ffffff', fontSize: '1rem', marginBottom: '8px' }}>
                Proof of Fund Allocation, Surplus & Deficit Policies
              </h4>
              <p>
                Every campaign deployed on BBDRTS requires a transparent, itemized fund allocation breakdown before going live. This answers critical operational questions regarding funding variations:
              </p>

              <div style={{ background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '12px', padding: '14px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#22c55e', fontWeight: 800, fontSize: '0.88rem', marginBottom: '4px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>savings</span>
                  <span>Surplus Reserve Rollover Policy</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.82rem' }}>
                  When monetary contributions exceed 100% of the target funding goal, the surplus funds are automatically protected and rolled over into the <strong>Post-Disaster Calamity Response Reserve Fund</strong>. These funds cannot be withdrawn for arbitrary purposes and are exclusively released for secondary rehabilitation or unbudgeted urgent emergency appeals.
                </p>
              </div>

              <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '12px', padding: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontWeight: 800, fontSize: '0.88rem', marginBottom: '4px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>priority_high</span>
                  <span>Partial Target Priority Disbursement Rule</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.82rem' }}>
                  If a disaster campaign reaches its scheduled operational deadline without achieving 100% of its financial goal, the accumulated funds are not locked. Instead, they are immediately released according to survival priority: <strong>Food & Clean Water (Tier 1)</strong> and <strong>Urgent Medical Aid (Tier 2)</strong> are fully funded first before allocating to long-term reconstruction.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div>
              <h4 style={{ color: '#ffffff', fontSize: '1rem', marginBottom: '8px' }}>
                Security Policy & Smart Contract Audit
              </h4>
              <p>
                BBDRTS is powered by OpenZeppelin-secured Solidity smart contracts running on the Ethereum Sepolia EVM. The platform architecture incorporates:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <strong>Non-Custodial Escrow:</strong> Platform administrators have zero access to pool funds; funds move strictly between verified donors and accredited NGO multi-sig wallets.
                </div>
                <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <strong>Multi-Rail Cross-Ledger Hashing:</strong> Every GCash, Maya, and Card transaction receives a SHA-256 cryptographic hash anchored to the immutable ledger.
                </div>
                <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <strong>Active Smart Contract Address:</strong> <code style={{ color: '#22c55e', fontSize: '0.78rem' }}>{contractAddress}</code>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'academic' && (
            <div>
              <h4 style={{ color: '#ffffff', fontSize: '1rem', marginBottom: '8px' }}>
                Institutional & Academic Attribution
              </h4>
              <div style={{ background: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
                <div style={{ color: '#eab308', fontWeight: 800, fontSize: '0.95rem', marginBottom: '4px' }}>
                  College of Computer Studies • Saint Joseph College (SJC)
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '8px' }}>
                  Maasin City, Southern Leyte, Philippines
                </div>
                <p style={{ margin: 0, fontSize: '0.82rem' }}>
                  This system was conceptualized, designed, and engineered as an official academic undergraduate capstone research project entitled <em>"Blockchain-Based Donation & Relief Transparency System for Disaster Calamity Operations in the Philippines"</em>.
                </p>
              </div>
              <p style={{ fontSize: '0.82rem' }}>
                The research investigates the integration of EVM blockchain smart contracts, fiat mobile payment rails (GCash & Maya), and geographical disaster GIS mapping to eliminate corruption, delayed assistance, and lack of transparency during Philippine typhoons, earthquakes, and flood emergencies.
              </p>
            </div>
          )}
        </div>

        {/* Footer Close */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
          display: 'flex',
          justifyContent: 'flex-end',
          background: 'rgba(0, 0, 0, 0.2)'
        }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onClose}
          >
            Close Window
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
