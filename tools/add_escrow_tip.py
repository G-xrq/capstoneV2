with open('frontend/src/components/PersonalizationOnboarding.jsx', 'r', encoding='utf-8') as f:
    jsx = f.read()

# Add Escrow micro-tip to Total Donated card
old_donated_card = """                <div className="preview-metric-card">
                  <div className="preview-metric-head">
                    <span className="preview-metric-title">{t.totalDonated}</span>
                    <span className="material-symbols-outlined preview-metric-icon">payments</span>
                  </div>
                  <div className="preview-metric-num accent">₱0</div>
                  <p className="preview-metric-cap">{t.onChainVerified}</p>
                </div>"""

new_donated_card = """                <div className="preview-metric-card">
                  <div className="preview-metric-head">
                    <span className="preview-metric-title">{t.totalDonated}</span>
                    <span className="material-symbols-outlined preview-metric-icon">payments</span>
                  </div>
                  <div className="preview-metric-num accent">₱0</div>
                  <p className="preview-metric-cap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                    <span>{t.onChainVerified}</span>
                    {prefs.guidedMicroTips && (
                      <span className="preview-micro-tip-tag" title="Smart Escrow: Relief funds remain locked until verified proof of field delivery is submitted">
                        <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>help</span>
                        <strong>Escrow:</strong> Locked until proof
                      </span>
                    )}
                  </p>
                </div>"""

assert old_donated_card in jsx, "Could not find old_donated_card"
jsx = jsx.replace(old_donated_card, new_donated_card)

# Add Simplified Mode Ledger micro-tip
old_direct = """                  <div>
                    <strong>{t.direct100}</strong>
                    <span className="preview-pill-sub">{t.direct100Sub}</span>
                  </div>"""

new_direct = """                  <div>
                    <strong>{t.direct100}</strong>
                    <span className="preview-pill-sub">{t.direct100Sub}</span>
                  </div>
                  {prefs.guidedMicroTips && (
                    <span className="preview-micro-tip-tag" style={{ marginLeft: 'auto' }} title="Public Ledger: Public on-chain verification">
                      <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>help</span>
                      <strong>Ledger:</strong> Verified on-chain
                    </span>
                  )}"""

assert old_direct in jsx, "Could not find old_direct"
jsx = jsx.replace(old_direct, new_direct)

with open('frontend/src/components/PersonalizationOnboarding.jsx', 'w', encoding='utf-8') as f:
    f.write(jsx)

print("Added Escrow and Simplified Ledger micro-tips successfully.")
