import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { API_URL } from '../config';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import './DisbursementProofModal.css';

const SEPOLIA_EXPLORER = 'https://sepolia.etherscan.io/tx/';

const CATEGORY_MAP = {
  OFFICIAL_RECEIPT: { label: 'Official Merchant Receipt / Invoice', icon: 'receipt_long' },
  GROUND_PHOTO: { label: 'Ground Aid Handover Photo', icon: 'photo_camera' },
  LGU_CERTIFICATE: { label: 'Barangay Certificate of Turnover', icon: 'verified_user' },
  BENEFICIARY_ROSTER: { label: 'Masked Recipient Masterlist (RA 10173)', icon: 'assignment_turned_in' },
  LOGISTICS_WAYBILL: { label: 'Transport Manifest / Waybill', icon: 'local_shipping' }
};

function parseProofData(raw) {
  if (!raw) return { proofs: [], expenseBreakdown: [], location: '', lguPartner: '' };
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return { proofs: parsed, expenseBreakdown: [], location: '', lguPartner: '' };
    }
    return {
      proofs: parsed.proofs || (parsed.primaryUrl ? [{ id: 1, url: parsed.primaryUrl, caption: 'Ground Distribution Proof', category: 'OFFICIAL_RECEIPT' }] : []),
      expenseBreakdown: parsed.expenseBreakdown || [],
      location: parsed.location || '',
      lguPartner: parsed.lguPartner || ''
    };
  } catch (_) {
    return {
      proofs: [{ id: 1, url: raw, caption: 'Ground Distribution Proof', category: 'OFFICIAL_RECEIPT' }],
      expenseBreakdown: [],
      location: '',
      lguPartner: ''
    };
  }
}

export default function DisbursementProofModal({ camp, isOpen, onClose, theme }) {
  const [disbursements, setDisbursements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeImageZoom, setActiveImageZoom] = useState(null);
  const [campaignDetails, setCampaignDetails] = useState(null);

  const campId = camp?.id || camp?.Campaign_ID || camp?.campaignId;

  useEffect(() => {
    if (!isOpen || !campId) return;

    let isMounted = true;
    const fetchDisbursementsAndDetails = async () => {
      setLoading(true);
      try {
        const fetchPromises = [fetch(`${API_URL}/api/campaigns/${campId}/disbursements`)];
        if (!camp?.title && !camp?.Campaign_Title) {
          fetchPromises.push(fetch(`${API_URL}/api/campaigns/${campId}`));
        }

        const [disbRes, campRes] = await Promise.all(fetchPromises);

        if (isMounted && disbRes && disbRes.ok) {
          const data = await disbRes.json();
          setDisbursements(Array.isArray(data) ? data : []);
        } else if (isMounted) {
          setDisbursements([]);
        }

        if (isMounted && campRes && campRes.ok) {
          const cData = await campRes.json();
          setCampaignDetails(cData);
        }
      } catch (err) {
        console.error('Failed to fetch disbursements:', err);
        if (isMounted) setDisbursements([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDisbursementsAndDetails();
    return () => { isMounted = false; };
  }, [isOpen, campId]);

  useRealtimeSync(
    ['disbursements', 'campaigns'],
    async () => {
      if (!isOpen || !campId) return;
      try {
        const res = await fetch(`${API_URL}/api/campaigns/${campId}/disbursements?_t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setDisbursements(Array.isArray(data) ? data : []);
        }
      } catch (_) {}
    },
    { enabled: Boolean(isOpen && campId), debounceMs: 250 }
  );

  if (!isOpen || !camp) return null;

  const displayTitle = camp.title || camp.Campaign_Title || campaignDetails?.title || campaignDetails?.Campaign_Title || 'Relief Operation';
  const displayOrg = camp.orgName || camp.Org_Name || campaignDetails?.orgName || campaignDetails?.Org_Name || 'Accredited Relief Org';

  const totalDisbursedPhp = disbursements.reduce((sum, d) => sum + parseFloat(d.amountPhp || 0), 0);
  const totalBeneficiaries = disbursements.reduce((sum, d) => sum + (parseInt(d.beneficiariesReached) || 0), 0);

  const currentTheme = theme || (typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') : 'dark') || 'dark';

  return createPortal(
    <div className="bbdrts-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" data-theme={currentTheme}>
      <div className="bbdrts-proof-modal" onClick={(e) => e.stopPropagation()} data-theme={currentTheme}>
        {/* Header */}
        <div className="bbdrts-proof-header">
          <div className="bbdrts-proof-title-cluster">
            <div className="bbdrts-proof-icon-wrap">
              <span className="material-symbols-outlined">verified</span>
            </div>
            <div>
              <div className="bbdrts-proof-tag">Audited Relief Delivery &amp; Donor Proofs</div>
              <h2 className="bbdrts-proof-title">{displayTitle}</h2>
              <p className="bbdrts-proof-subtitle">
                Official merchant receipts, ground handover photos, signed recipient rosters, and on-chain verification.
              </p>
            </div>
          </div>
          <button type="button" className="bbdrts-proof-close-btn" onClick={onClose} aria-label="Close modal">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Aggregate Stats */}
        <div className="bbdrts-proof-stats-strip">
          <div className="bbdrts-proof-stat">
            <span className="stat-label">Total Aid Disbursed</span>
            <strong className="stat-val emerald">₱{totalDisbursedPhp.toLocaleString()}</strong>
          </div>
          <div className="bbdrts-proof-stat">
            <span className="stat-label">Beneficiaries Reached</span>
            <strong className="stat-val">{totalBeneficiaries > 0 ? `${totalBeneficiaries.toLocaleString()} Recipients` : 'Community Distribution'}</strong>
          </div>
          <div className="bbdrts-proof-stat">
            <span className="stat-label">Disbursement Batches</span>
            <strong className="stat-val">{disbursements.length} Record{disbursements.length === 1 ? '' : 's'}</strong>
          </div>
          <div className="bbdrts-proof-stat">
            <span className="stat-label">Operating NGO</span>
            <strong className="stat-val highlight">{displayOrg}</strong>
          </div>
        </div>

        {/* Content Body */}
        <div className="bbdrts-proof-body">
          {loading ? (
            <div className="bbdrts-proof-loading">
              <div className="spinner-border text-primary" role="status" style={{ width: '2rem', height: '2rem' }} />
              <span>Fetching live cryptographic distribution records...</span>
            </div>
          ) : disbursements.length === 0 ? (
            <div className="bbdrts-proof-empty">
              <span className="material-symbols-outlined empty-icon">pending_actions</span>
              <h3>No Disbursements Recorded Yet</h3>
              <p>
                The NGO is currently procuring supplies and mobilizing logistics for this operation. When relief goods are released to the community, audited receipts and distribution photos will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="bbdrts-proof-timeline">
              {disbursements.map((d, idx) => {
                const proofData = parseProofData(d.proofUrl);
                const proofsList = proofData.proofs || [];
                const expensesList = proofData.expenseBreakdown || [];

                return (
                  <div key={d.id || idx} className="bbdrts-proof-card">
                    <div className="proof-card-header">
                      <div className="batch-pill">
                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>task_alt</span>
                        <span>Disbursement #{disbursements.length - idx}</span>
                      </div>
                      <span className="timestamp">
                        {d.disbursedAt ? new Date(d.disbursedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Verified Delivery'}
                      </span>
                    </div>

                    <div className="proof-card-metrics">
                      <div className="metric-item">
                        <span className="metric-label">Amount Released</span>
                        <strong className="metric-val">₱{parseFloat(d.amountPhp || 0).toLocaleString()}</strong>
                      </div>
                      {d.beneficiariesReached > 0 && (
                        <div className="metric-item">
                          <span className="metric-label">Recipients Impacted</span>
                          <strong className="metric-val">{Number(d.beneficiariesReached).toLocaleString()} Families</strong>
                        </div>
                      )}
                      {proofData.location && (
                        <div className="metric-item">
                          <span className="metric-label">Evacuation Site / Location</span>
                          <strong className="metric-val" style={{ fontSize: '0.85rem' }}>{proofData.location}</strong>
                        </div>
                      )}
                      {proofData.lguPartner && (
                        <div className="metric-item">
                          <span className="metric-label">LGU / Agency Partner</span>
                          <strong className="metric-val" style={{ fontSize: '0.85rem' }}>{proofData.lguPartner}</strong>
                        </div>
                      )}
                    </div>

                    {/* Summary Narrative */}
                    <div className="proof-narrative-box">
                      <div className="narrative-label">
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>description</span>
                        <span>Relief Distribution Summary</span>
                      </div>
                      <p className="narrative-text">{d.impactSummary}</p>
                    </div>

                    {/* Itemized Expense Breakdown (Where the Money Went) */}
                    {expensesList.length > 0 && (
                      <div className="proof-expenses-box">
                        <div className="narrative-label">
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>receipt_long</span>
                          <span>Itemized Procurement &amp; Liquidation Breakdown ({expensesList.length} items)</span>
                        </div>
                        <div className="proof-expense-table-wrap">
                          <table className="proof-expense-table">
                            <thead>
                              <tr>
                                <th>Item / Relief Good</th>
                                <th>Quantity</th>
                                <th style={{ textAlign: 'right' }}>Cost (PHP)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {expensesList.map((exp, eIdx) => (
                                <tr key={eIdx}>
                                  <td>{exp.description || 'Relief Supplies'}</td>
                                  <td>{exp.quantity || '—'}</td>
                                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                                    ₱{parseFloat(exp.costPhp || 0).toLocaleString()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Multiple Verifiable Proofs Gallery */}
                    {proofsList.length > 0 && (
                      <div className="proof-attachment-box">
                        <div className="narrative-label">
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>collections</span>
                          <span>Verified Evidentiary Documents &amp; Photos ({proofsList.length})</span>
                        </div>

                        <div className="proof-gallery-grid">
                          {proofsList.map((proof, pIdx) => {
                            const cat = CATEGORY_MAP[proof.category] || CATEGORY_MAP.OFFICIAL_RECEIPT;
                            return (
                              <div
                                key={proof.id || pIdx}
                                className="proof-gallery-card"
                                onClick={() => setActiveImageZoom({ url: proof.url, title: proof.caption || proof.name, category: cat.label })}
                              >
                                <div className="proof-gallery-img-wrap">
                                  <img src={proof.url} alt={proof.caption || 'Proof'} />
                                  <div className="proof-gallery-overlay">
                                    <span className="material-symbols-outlined">zoom_in</span>
                                    <span>Expand Proof</span>
                                  </div>
                                </div>
                                <div className="proof-gallery-caption-row">
                                  <span className="proof-gallery-badge">
                                    <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>{cat.icon}</span>
                                    <span>{cat.label}</span>
                                  </span>
                                  <span className="proof-gallery-title" title={proof.caption}>
                                    {proof.caption || proof.name || 'Verifiable Document'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* On-Chain Sepolia Hash */}
                    {d.txHash && (
                      <div className="proof-tx-box">
                        <span className="tx-label">Cryptographic Audit Ledger Proof:</span>
                        <div className="tx-row">
                          <code className="tx-code">{d.txHash}</code>
                          {d.txHash.startsWith('0x') && (
                            <a
                              href={`${SEPOLIA_EXPLORER}${d.txHash}`}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-outline btn-xs"
                              title="Verify on Sepolia Etherscan"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>open_in_new</span>
                              <span>Etherscan</span>
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bbdrts-proof-footer">
          <div className="footer-left">
            <span className="material-symbols-outlined text-emerald" style={{ fontSize: '17px' }}>shield</span>
            <span>All receipts &amp; records permanently synchronized with Sepolia EVM &amp; BBDRTS Audit Vault</span>
          </div>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Close Proof
          </button>
        </div>

        {/* Image Zoom Modal */}
        {activeImageZoom && (
          <div className="bbdrts-proof-zoom-overlay" onClick={() => setActiveImageZoom(null)}>
            <div className="zoom-card" onClick={(e) => e.stopPropagation()}>
              <div className="zoom-header">
                <div>
                  <span className="zoom-badge">{activeImageZoom.category}</span>
                  <div className="zoom-title">{activeImageZoom.title}</div>
                </div>
                <button type="button" className="zoom-close-btn" onClick={() => setActiveImageZoom(null)}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <div className="zoom-img-container">
                <img src={activeImageZoom.url} alt={activeImageZoom.title} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
