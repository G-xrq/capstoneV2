import { useState, useId, useEffect } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { API_URL } from '../config';
import { useToast } from '../context/ToastContext';
import './DisburseModal.css';

const AID_CATEGORIES = [
  { value: 'FOOD_WATER', label: 'Emergency Food Packs & Potable Water', icon: 'rice_bowl' },
  { value: 'MEDICAL', label: 'Medical Supplies & First Aid Kits', icon: 'medical_services' },
  { value: 'SHELTER', label: 'Weatherproof Tarpaulins & Shelter Kits', icon: 'roofing' },
  { value: 'LOGISTICS', label: 'Logistics, Evacuation & Fuel Transport', icon: 'local_shipping' },
  { value: 'HYGIENE_CASH', label: 'Hygiene Packs & Direct Community Aid', icon: 'volunteer_activism' }
];

const PROOF_CATEGORIES = [
  { value: 'OFFICIAL_RECEIPT', label: 'Official Merchant Receipt / Invoice' },
  { value: 'GROUND_PHOTO', label: 'Ground Aid Handover Photo' },
  { value: 'LGU_CERTIFICATE', label: 'Barangay Certificate of Turnover' },
  { value: 'BENEFICIARY_ROSTER', label: 'Masked Recipient Masterlist (RA 10173)' },
  { value: 'LOGISTICS_WAYBILL', label: 'Transport Manifest / Waybill' }
];

const WIZARD_STEPS = [
  { num: 1, title: 'Escrow Amount', icon: 'payments' },
  { num: 2, title: 'Relief Mission', icon: 'assignment' },
  { num: 3, title: 'Proof & Receipts', icon: 'receipt_long' },
  { num: 4, title: 'Review & Notarize', icon: 'verified' }
];

export default function DisburseModal({ camp, isOpen, onClose, onDisbursed }) {
  const { showSuccess, showError, showWarning } = useToast();
  const fileInputId = useId();
  const excelInputId = useId();

  // Wizard active step: 1, 2, 3, 4
  const [currentStep, setCurrentStep] = useState(1);

  const campId = camp?.id || camp?.Campaign_ID;
  const currentPhp = parseFloat(camp?.currentAmountPhp || camp?.Current_Amount_Php || 0) || Math.round((parseFloat(camp?.currentAmount || camp?.Current_Amount || 0)) * 170000);
  const alreadyDisbursedPhp = parseFloat(camp?.disbursedAmountPhp || camp?.Disbursed_Amount_Php || 0);
  const availablePhp = Math.max(0, currentPhp - alreadyDisbursedPhp);

  // Allocation Mode: 'QUICK' (Milestone %) or 'ITEMIZED' (Exact Items / Excel)
  const [allocationMode, setAllocationMode] = useState('QUICK');

  // Quick Amount State
  const [amountPhp, setAmountPhp] = useState(availablePhp > 0 ? String(availablePhp) : '');

  // Mission Details
  const [beneficiariesReached, setBeneficiariesReached] = useState('100');
  const [aidCategory, setAidCategory] = useState('FOOD_WATER');
  const [lguPartner, setLguPartner] = useState('');
  const [location, setLocation] = useState('');
  const [impactSummary, setImpactSummary] = useState('');

  // Itemized Procurement State
  const [expenses, setExpenses] = useState([
    { id: 1, description: 'Emergency Food Packs (Rice, Canned Goods, Water)', quantity: '100 packs', costPhp: '' }
  ]);
  const [importedExcelName, setImportedExcelName] = useState('');

  // Multi-Proof Attachments
  const [proofs, setProofs] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Synchronize amount and reset to step 1 when modal opens or active campaign / escrow balance changes
  useEffect(() => {
    if (isOpen && camp) {
      setCurrentStep(1);
      if (availablePhp > 0) {
        setAmountPhp(String(availablePhp));
      } else {
        setAmountPhp('');
      }
      setBeneficiariesReached(availablePhp >= 5000 ? '100' : (availablePhp > 0 ? '5' : '1'));
    }
  }, [isOpen, campId, availablePhp]);

  if (!isOpen || !camp) return null;

  // Calculate sum of itemized procurement
  const totalItemizedPhp = expenses.reduce((sum, item) => sum + (parseFloat(item.costPhp) || 0), 0);

  // Effective amount to disburse based on selected mode
  const effectiveAmountPhp = allocationMode === 'ITEMIZED'
    ? totalItemizedPhp
    : (parseFloat(amountPhp) || 0);

  const formatEthPreview = (php) => {
    const n = (parseFloat(php) || 0) / 170000;
    if (n === 0) return '0.00';
    if (n < 0.0001) return n.toFixed(6).replace(/\.?0+$/, '');
    return n.toFixed(4).replace(/\.?0+$/, '');
  };
  const approxEth = formatEthPreview(effectiveAmountPhp);
  const remainingInEscrow = Math.max(0, availablePhp - effectiveAmountPhp);
  const isOverdrawn = availablePhp > 0 && effectiveAmountPhp > availablePhp;

  // Step Validation Rules
  const isStep1Valid = effectiveAmountPhp > 0 && !isOverdrawn;
  const isStep2Valid = (parseInt(beneficiariesReached) || 0) > 0 && lguPartner.trim().length > 0 && location.trim().length > 0 && impactSummary.trim().length > 0;
  const isStep3Valid = proofs.length > 0;

  // Quick Percentage Allocation Handler
  const handleQuickPercent = (pct) => {
    const val = Math.round(availablePhp * pct);
    setAmountPhp(String(val > 0 ? val : '1000'));
  };

  // Add / Edit / Remove Expense Items
  const handleAddExpense = () => {
    setExpenses(prev => [
      ...prev,
      { id: Date.now() + Math.random(), description: '', quantity: '', costPhp: '' }
    ]);
  };

  const handleUpdateExpense = (id, field, value) => {
    setExpenses(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleRemoveExpense = (id) => {
    if (expenses.length <= 1) {
      setExpenses([{ id: Date.now(), description: '', quantity: '', costPhp: '' }]);
      return;
    }
    setExpenses(prev => prev.filter(item => item.id !== id));
  };

  // Excel / CSV Import Parser
  const handleExcelUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (!rawRows || rawRows.length === 0) {
        showWarning('The uploaded spreadsheet appears to be empty.', 'Empty Sheet');
        return;
      }

      const parsedItems = [];
      let headerRowIndex = -1;
      let descCol = 0, qtyCol = 1, costCol = 2;

      for (let r = 0; r < Math.min(5, rawRows.length); r++) {
        const row = rawRows[r];
        if (Array.isArray(row)) {
          const rowLower = row.map(cell => String(cell || '').toLowerCase().trim());
          const foundDesc = rowLower.findIndex(c => c.includes('item') || c.includes('desc') || c.includes('particular') || c.includes('relief') || c.includes('good') || c.includes('name'));
          const foundQty = rowLower.findIndex(c => c.includes('qty') || c.includes('quantity') || c.includes('unit') || c.includes('count') || c.includes('pack'));
          const foundCost = rowLower.findIndex(c => c.includes('cost') || c.includes('amount') || c.includes('price') || c.includes('total') || c.includes('php') || c.includes('subtotal'));

          if (foundDesc !== -1 || foundCost !== -1) {
            headerRowIndex = r;
            if (foundDesc !== -1) descCol = foundDesc;
            if (foundQty !== -1) qtyCol = foundQty;
            if (foundCost !== -1) costCol = foundCost;
            break;
          }
        }
      }

      const startRow = headerRowIndex !== -1 ? headerRowIndex + 1 : 0;
      for (let r = startRow; r < rawRows.length; r++) {
        const row = rawRows[r];
        if (!row || !Array.isArray(row)) continue;

        const rawDesc = String(row[descCol] || '').trim();
        const rawQty = String(row[qtyCol] || '').trim();
        let rawCost = String(row[costCol] || '').replace(/[₱,$\s]/g, '');

        const parsedCost = parseFloat(rawCost);
        if (rawDesc || (!isNaN(parsedCost) && parsedCost > 0)) {
          parsedItems.push({
            id: Date.now() + Math.random() + r,
            description: rawDesc || `Procurement Item #${parsedItems.length + 1}`,
            quantity: rawQty || '1 lot',
            costPhp: !isNaN(parsedCost) && parsedCost > 0 ? String(parsedCost) : ''
          });
        }
      }

      if (parsedItems.length === 0) {
        showWarning('Could not recognize item columns. Make sure columns contain Item Description and Cost.', 'Parse Warning');
        return;
      }

      setExpenses(parsedItems);
      setImportedExcelName(file.name);

      const reader = new FileReader();
      reader.onload = (event) => {
        setProofs((prev) => [
          ...prev,
          {
            id: Date.now() + Math.random(),
            name: file.name,
            url: event.target.result,
            fileSize: (file.size / 1024).toFixed(1) + ' KB',
            caption: `NGO Liquidation Spreadsheet (${file.name})`,
            category: 'OFFICIAL_RECEIPT'
          }
        ]);
      };
      reader.readAsDataURL(file);

      showSuccess(`Imported ${parsedItems.length} items from "${file.name}"!`, 'Excel Parsed');
    } catch (err) {
      console.error('Failed to parse Excel file:', err);
      showError('Failed to read file. Please ensure it is a valid .xlsx, .xls, or .csv spreadsheet.', 'Import Error');
    }

    e.target.value = '';
  };

  // Proof Upload
  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach((file) => {
      if (file.size > 12 * 1024 * 1024) {
        showWarning(`"${file.name}" exceeds 12MB limit. Please compress.`, 'File Too Large');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target.result;
        let cat = 'GROUND_PHOTO';
        const nameLower = file.name.toLowerCase();
        if (nameLower.includes('receipt') || nameLower.includes('invoice') || nameLower.includes('bill') || file.type.includes('pdf')) {
          cat = 'OFFICIAL_RECEIPT';
        } else if (nameLower.includes('roster') || nameLower.includes('list') || nameLower.includes('masterlist')) {
          cat = 'BENEFICIARY_ROSTER';
        } else if (nameLower.includes('cert') || nameLower.includes('barangay')) {
          cat = 'LGU_CERTIFICATE';
        }

        setProofs((prev) => [
          ...prev,
          {
            id: Date.now() + Math.random(),
            name: file.name,
            url: base64,
            fileSize: (file.size / 1024).toFixed(1) + ' KB',
            caption: file.name.replace(/\.[^/.]+$/, ''),
            category: cat
          }
        ]);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const handleRemovePhoto = (id) => {
    setProofs((prev) => prev.filter((p) => p.id !== id));
  };

  const handleUpdateProofCategory = (id, newCat) => {
    setProofs((prev) => prev.map((p) => (p.id === id ? { ...p, category: newCat } : p)));
  };

  // Step Advancement Handler
  const handleNextStep = (e) => {
    e?.preventDefault();
    if (currentStep === 1) {
      if (!isStep1Valid) {
        showWarning('Please enter a valid disbursement amount within available escrow.', 'Amount Required');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!isStep2Valid) {
        showWarning('Please provide beneficiaries count, distribution site, and mission narrative.', 'Details Required');
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (!isStep3Valid) {
        showWarning('Please attach at least one proof of relief (official receipt or delivery photo).', 'Proof Required');
        return;
      }
      setCurrentStep(4);
    }
  };

  // Final Form Submission
  const handleSubmit = async (e) => {
    e?.preventDefault();

    if (effectiveAmountPhp <= 0) {
      showWarning('Disbursement amount must be greater than zero.', 'Validation Error');
      return;
    }

    if (availablePhp > 0 && effectiveAmountPhp > availablePhp) {
      showWarning(`Disbursement (₱${effectiveAmountPhp.toLocaleString()}) cannot exceed available escrow balance (₱${availablePhp.toLocaleString()}).`, 'Exceeds Escrow');
      return;
    }

    if (!impactSummary || !impactSummary.trim()) {
      showWarning('Please provide a relief impact summary narrative.', 'Validation Error');
      return;
    }

    if (proofs.length === 0) {
      showWarning('Please attach at least one proof of relief (official receipt, ground photo, or signed roster).', 'Proof Required');
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
      const primaryProofUrl = proofs[0]?.url || '';

      const validExpenses = allocationMode === 'ITEMIZED'
        ? expenses.filter(x => x.description.trim() && parseFloat(x.costPhp) > 0)
        : [];

      const payload = {
        amountPhp: effectiveAmountPhp,
        amountEth: parseFloat(approxEth),
        beneficiariesReached: parseInt(beneficiariesReached) || 0,
        aidCategory,
        lguPartner: lguPartner.trim(),
        location: location.trim(),
        impactSummary: impactSummary.trim(),
        proofUrl: primaryProofUrl,
        proofs: proofs.map(p => ({
          name: p.name,
          url: p.url,
          caption: p.caption,
          category: p.category,
          fileSize: p.fileSize
        })),
        expenseBreakdown: validExpenses,
        allocationMode
      };

      const res = await fetch(`${API_URL}/api/campaigns/${campId}/disburse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record disbursement.');
      }

      showSuccess(
        `Disbursed ₱${effectiveAmountPhp.toLocaleString()}! Notarized gaslessly with cryptographic audit proof.`,
        'Funds Released'
      );

      if (onDisbursed) onDisbursed(data);
      onClose();
    } catch (err) {
      console.error('Disbursement error:', err);
      showError(err.message || 'An error occurred while releasing funds.', 'Disbursement Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCategoryObj = AID_CATEGORIES.find(c => c.value === aidCategory) || AID_CATEGORIES[0];

  return createPortal(
    <div className="bbdrts-disb-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="bbdrts-disb-modal" onClick={(e) => e.stopPropagation()}>
        
        {/* ── 1. Header (Profile & Settings Typography & Layout) ── */}
        <div className="bbdrts-disb-header">
          <div className="bbdrts-disb-title-wrap">
            <h2 className="bbdrts-disb-title">
              <span className="material-symbols-outlined" style={{ fontSize: '24px', color: '#16a34a' }}>payments</span>
              <span>Disburse Funds &amp; Upload Proof of Relief</span>
            </h2>
            <p className="bbdrts-disb-subtitle">
              Record actual ground aid distribution, attach verifiable delivery photos and merchant receipts, and notify all donors.
            </p>
          </div>
          <button
            type="button"
            className="bbdrts-disb-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* ── 2. Financial Escrow Summary Strip ── */}
        <div className="bbdrts-disb-summary-strip">
          <div className="bbdrts-disb-summary-col col-campaign">
            <span className="label">Campaign</span>
            <strong className="val title" title={camp.title}>{camp.title}</strong>
          </div>
          <div className="bbdrts-disb-summary-col">
            <span className="label">Total Raised</span>
            <strong className="val">₱{currentPhp.toLocaleString()}</strong>
          </div>
          <div className="bbdrts-disb-summary-col">
            <span className="label">Already Disbursed</span>
            <strong className="val text-muted">₱{alreadyDisbursedPhp.toLocaleString()}</strong>
          </div>
          <div className="bbdrts-disb-summary-col highlight">
            <span className="label">Available in Escrow</span>
            <strong className="val text-emerald">
              <span className="bbdrts-disb-escrow-dot"></span>
              ₱{availablePhp.toLocaleString()}
            </strong>
          </div>
        </div>

        {/* ── 3. Interactive Stepper Navigation (1 -> 2 -> 3 -> 4) ── */}
        <div className="bbdrts-disb-stepper">
          {WIZARD_STEPS.map((s) => {
            const isCompleted = s.num < currentStep;
            const isActive = s.num === currentStep;
            const isClickable = s.num < currentStep;
            return (
              <button
                key={s.num}
                type="button"
                className={`bbdrts-disb-step-pill ${isActive ? 'is-active' : ''} ${isCompleted ? 'is-completed' : ''}`}
                onClick={() => {
                  if (isClickable) setCurrentStep(s.num);
                }}
                disabled={!isClickable && !isActive}
                title={`Step ${s.num}: ${s.title}`}
              >
                <span className="step-circle">
                  {isCompleted ? (
                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>check</span>
                  ) : (
                    s.num
                  )}
                </span>
                <span className="step-label">{s.title}</span>
              </button>
            );
          })}
        </div>

        {/* ── 4. Step-by-Step Wizard Body ── */}
        <form onSubmit={handleSubmit} className="bbdrts-disb-form">
          <div className="bbdrts-disb-scroll-body">

            {/* ══════════════════════════════════════════════════════════
                STEP 1: ESCROW ALLOCATION AMOUNT
               ══════════════════════════════════════════════════════════ */}
            {currentStep === 1 && (
              <div className="bbdrts-step-content animate-fade">
                <div className="bbdrts-step-intro">
                  <h3 className="bbdrts-step-heading">Step 1: Specify Disbursement Amount</h3>
                  <p className="bbdrts-step-desc">
                    Choose how much of the available escrow (<strong>₱{availablePhp.toLocaleString()}</strong>) was spent on emergency aid.
                  </p>
                </div>

                {/* Mode Selector Tabs */}
                <div className="bbdrts-disb-mode-selector">
                  <div className="bbdrts-disb-mode-tabs" role="tablist">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={allocationMode === 'QUICK'}
                      className={`bbdrts-disb-tab-btn ${allocationMode === 'QUICK' ? 'active' : ''}`}
                      onClick={() => setAllocationMode('QUICK')}
                    >
                      <span className="material-symbols-outlined">bolt</span>
                      <span>Quick Milestone Allocation</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={allocationMode === 'ITEMIZED'}
                      className={`bbdrts-disb-tab-btn ${allocationMode === 'ITEMIZED' ? 'active' : ''}`}
                      onClick={() => setAllocationMode('ITEMIZED')}
                    >
                      <span className="material-symbols-outlined">receipt_long</span>
                      <span>Itemized Procurement &amp; Excel Import</span>
                      {expenses.length > 1 && <span className="bbdrts-disb-count-tag">{expenses.length}</span>}
                    </button>
                  </div>
                </div>

                {allocationMode === 'QUICK' ? (
                  <div className="bbdrts-step-panel">
                    <div className="bbdrts-disb-field">
                      <label htmlFor="disb-amt">Amount to Disburse (PHP) <span className="req">*</span></label>
                      <div className={`bbdrts-disb-input-wrap lg ${isOverdrawn ? 'error' : ''}`}>
                        <span className="prefix">₱</span>
                        <input
                          id="disb-amt"
                          type="number"
                          min="1"
                          step="any"
                          placeholder="0.00"
                          value={amountPhp}
                          onChange={(e) => setAmountPhp(e.target.value)}
                          required
                          autoFocus
                        />
                        <span className="suffix">PHP</span>
                      </div>

                      {availablePhp > 0 && (
                        <div className="bbdrts-disb-presets-row">
                          <span className="presets-label">Quick Allocate:</span>
                          <button type="button" onClick={() => handleQuickPercent(0.25)}>25% (₱{Math.round(availablePhp * 0.25).toLocaleString()})</button>
                          <button type="button" onClick={() => handleQuickPercent(0.5)}>50% (₱{Math.round(availablePhp * 0.5).toLocaleString()})</button>
                          <button type="button" onClick={() => handleQuickPercent(0.75)}>75% (₱{Math.round(availablePhp * 0.75).toLocaleString()})</button>
                          <button type="button" onClick={() => handleQuickPercent(1.0)}>100% (All Funds: ₱{availablePhp.toLocaleString()})</button>
                        </div>
                      )}

                      {isOverdrawn ? (
                        <span className="hint-error">
                          ⚠️ Exceeds available escrow balance (₱{availablePhp.toLocaleString()}) by ₱{(effectiveAmountPhp - availablePhp).toLocaleString()}.
                        </span>
                      ) : (
                        <div className="bbdrts-escrow-balance-card">
                          <div className="escrow-calc-col">
                            <span className="calc-lbl">Available in Escrow</span>
                            <span className="calc-val">₱{availablePhp.toLocaleString()}</span>
                          </div>
                          <span className="calc-math">−</span>
                          <div className="escrow-calc-col">
                            <span className="calc-lbl">Releasing Now</span>
                            <span className="calc-val text-emerald">₱{effectiveAmountPhp.toLocaleString()}</span>
                          </div>
                          <span className="calc-math">=</span>
                          <div className="escrow-calc-col">
                            <span className="calc-lbl">Remaining in Escrow</span>
                            <span className="calc-val">₱{remainingInEscrow.toLocaleString()}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Itemized Procurement Mode */
                  <div className="bbdrts-disb-itemized-box">
                    <div className="bbdrts-disb-itemized-head">
                      <div>
                        <h4 className="bbdrts-disb-itemized-title">Itemized Procurement &amp; Expense Liquidation</h4>
                        <span className="bbdrts-disb-itemized-sub">
                          The disbursement amount is automatically calculated from your line items.
                        </span>
                      </div>
                      <div className="bbdrts-disb-itemized-actions">
                        <input
                          type="file"
                          id={excelInputId}
                          accept=".xlsx, .xls, .csv"
                          onChange={handleExcelUpload}
                          style={{ display: 'none' }}
                        />
                        <label htmlFor={excelInputId} className="bbdrts-disb-btn-excel" title="Import from Excel or CSV spreadsheet">
                          <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>table_view</span>
                          <span>Upload Excel / CSV</span>
                        </label>
                        <button
                          type="button"
                          className="bbdrts-disb-btn-add-item"
                          onClick={handleAddExpense}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>add</span>
                          <span>Add Item</span>
                        </button>
                      </div>
                    </div>

                    {importedExcelName && (
                      <div className="bbdrts-disb-excel-banner">
                        <span className="material-symbols-outlined">check_circle</span>
                        <span>Imported from <strong>{importedExcelName}</strong> ({expenses.length} line items)</span>
                      </div>
                    )}

                    <div className="bbdrts-disb-table-wrap">
                      <div className="bbdrts-disb-table-header">
                        <span style={{ flex: 2.2 }}>Item / Description</span>
                        <span style={{ flex: 1.1 }}>Quantity</span>
                        <span style={{ width: '130px', textAlign: 'right' }}>Cost (PHP)</span>
                        <span style={{ width: '28px' }}></span>
                      </div>

                      <div className="bbdrts-disb-table-rows">
                        {expenses.map((exp) => (
                          <div key={exp.id} className="bbdrts-disb-table-row">
                            <input
                              type="text"
                              placeholder="e.g. 50kg Sacks of Rice"
                              value={exp.description}
                              onChange={(e) => handleUpdateExpense(exp.id, 'description', e.target.value)}
                              style={{ flex: 2.2 }}
                            />
                            <input
                              type="text"
                              placeholder="e.g. 20 sacks"
                              value={exp.quantity}
                              onChange={(e) => handleUpdateExpense(exp.id, 'quantity', e.target.value)}
                              style={{ flex: 1.1 }}
                            />
                            <div className="bbdrts-disb-mini-input" style={{ width: '130px' }}>
                              <span className="mini-prefix">₱</span>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                placeholder="0.00"
                                value={exp.costPhp}
                                onChange={(e) => handleUpdateExpense(exp.id, 'costPhp', e.target.value)}
                              />
                            </div>
                            <button
                              type="button"
                              className="bbdrts-disb-row-del"
                              onClick={() => handleRemoveExpense(exp.id)}
                              title="Remove item"
                            >
                              <span className="material-symbols-outlined">close</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bbdrts-disb-total-line">
                      <span>Calculated Disbursement Amount:</span>
                      <strong className="text-emerald">₱{totalItemizedPhp.toLocaleString()}</strong>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                STEP 2: MISSION DETAILS & BENEFICIARIES
               ══════════════════════════════════════════════════════════ */}
            {currentStep === 2 && (
              <div className="bbdrts-step-content animate-fade">
                <div className="bbdrts-step-intro">
                  <h3 className="bbdrts-step-heading">Step 2: Ground Mission &amp; Beneficiaries</h3>
                  <p className="bbdrts-step-desc">
                    Record who received the emergency relief goods, where the mission took place, and what aid was delivered.
                  </p>
                </div>

                <div className="bbdrts-disb-grid-2">
                  <div className="bbdrts-disb-field">
                    <label htmlFor="disb-beneficiaries">Beneficiaries Reached (Families / Individuals) <span className="req">*</span></label>
                    <div className="bbdrts-disb-input-wrap">
                      <span className="prefix material-symbols-outlined">group</span>
                      <input
                        id="disb-beneficiaries"
                        type="number"
                        min="1"
                        placeholder="e.g. 150"
                        value={beneficiariesReached}
                        onChange={(e) => setBeneficiariesReached(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>
                    <span className="hint">Direct recipients receiving relief goods or emergency assistance.</span>
                  </div>

                  <div className="bbdrts-disb-field">
                    <label htmlFor="disb-category">Primary Aid Category <span className="req">*</span></label>
                    <div className="bbdrts-disb-select-wrap">
                      <span className="prefix material-symbols-outlined">{selectedCategoryObj.icon}</span>
                      <select
                        id="disb-category"
                        value={aidCategory}
                        onChange={(e) => setAidCategory(e.target.value)}
                      >
                        {AID_CATEGORIES.map(c => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                    <span className="hint">Categorizes expenditure for transparency reporting.</span>
                  </div>
                </div>

                <div className="bbdrts-disb-grid-2">
                  <div className="bbdrts-disb-field">
                    <label htmlFor="disb-lgu">Coordinating Barangay / LGU Partner <span className="req">*</span></label>
                    <div className="bbdrts-disb-input-wrap">
                      <span className="prefix material-symbols-outlined">account_balance</span>
                      <input
                        id="disb-lgu"
                        type="text"
                        placeholder="e.g. Barangay San Juan Council / Brgy. Capt. Juan dela Cruz"
                        value={lguPartner}
                        onChange={(e) => setLguPartner(e.target.value)}
                        required
                      />
                    </div>
                    <span className="hint">Barangay council or disaster office coordinating relief execution.</span>
                  </div>

                  <div className="bbdrts-disb-field">
                    <label htmlFor="disb-location">Distribution Site / Evacuation Center <span className="req">*</span></label>
                    <div className="bbdrts-disb-input-wrap">
                      <span className="prefix material-symbols-outlined">location_on</span>
                      <input
                        id="disb-location"
                        type="text"
                        placeholder="e.g. Combado Central Evacuation Gym, Maasin City"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        required
                      />
                    </div>
                    <span className="hint">Evacuation gym, relief staging center, or community plaza.</span>
                  </div>
                </div>

                <div className="bbdrts-disb-field">
                  <label htmlFor="disb-summary">Relief Impact &amp; Distribution Summary <span className="req">*</span></label>
                  <textarea
                    id="disb-summary"
                    rows={4}
                    placeholder="e.g. Distributed 150 emergency food packs containing rice, bottled drinking water, and canned goods to displaced coastal families in Barangay Malitbog."
                    value={impactSummary}
                    onChange={(e) => setImpactSummary(e.target.value)}
                    required
                  />
                  <span className="hint">This narrative is permanently published on-chain and sent in real-time notifications to all donors.</span>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                STEP 3: VERIFICATION PROOF & RECEIPTS
               ══════════════════════════════════════════════════════════ */}
            {currentStep === 3 && (
              <div className="bbdrts-step-content animate-fade">
                <div className="bbdrts-step-intro">
                  <h3 className="bbdrts-step-heading">Step 3: Verification Proof &amp; Receipts</h3>
                  <p className="bbdrts-step-desc">
                    Attach authentic photos of relief turnover to beneficiaries, merchant invoices, and signed recipient rosters.
                  </p>
                </div>

                {/* Data Privacy (RA 10173) Compliance Notice */}
                <div className="bbdrts-privacy-notice-box">
                  <div className="privacy-notice-header">
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#10b981' }}>security</span>
                    <strong>Data Privacy Act (RA 10173) Protection Notice</strong>
                  </div>
                  <p>
                    To protect the safety and dignity of vulnerable disaster survivors, please ensure citizen rosters mask personal details (e.g. <code>J*** D*** C***</code>). Alternatively, you may attach the official <strong>Barangay Certificate of Turnover</strong> signed by your Barangay Captain.
                  </p>
                </div>

                <div className="bbdrts-disb-field">
                  <input
                    type="file"
                    id={fileInputId}
                    multiple
                    accept="image/*,application/pdf"
                    onChange={handlePhotoUpload}
                    style={{ display: 'none' }}
                  />

                  <label htmlFor={fileInputId} className="bbdrts-disb-dropzone">
                    <div className="bbdrts-disb-drop-icon">
                      <span className="material-symbols-outlined">add_photo_alternate</span>
                    </div>
                    <div className="bbdrts-disb-drop-text">
                      <strong>Click or Drag to Upload Ground Photos &amp; Receipts</strong>
                      <span>Upload JPG, PNG, or PDF files (up to 12MB each). Handover photos, merchant invoices, and signed masterlists.</span>
                    </div>
                  </label>

                  {proofs.length > 0 ? (
                    <div className="bbdrts-disb-proofs-list">
                      <div className="proofs-list-header">
                        <span>Attached Files ({proofs.length})</span>
                        <span className="hint">Set category for each file</span>
                      </div>
                      {proofs.map((p) => (
                        <div key={p.id} className="bbdrts-disb-proof-item">
                          <div className="bbdrts-disb-proof-thumb">
                            {p.url && p.url.startsWith('data:image') ? (
                              <img src={p.url} alt={p.name} />
                            ) : (
                              <span className="material-symbols-outlined">description</span>
                            )}
                          </div>
                          <div className="bbdrts-disb-proof-info">
                            <span className="proof-name" title={p.name}>{p.name}</span>
                            <span className="proof-meta">{p.fileSize}</span>
                          </div>
                          <select
                            className="bbdrts-disb-proof-cat-select"
                            value={p.category}
                            onChange={(e) => handleUpdateProofCategory(p.id, e.target.value)}
                          >
                            {PROOF_CATEGORIES.map(c => (
                              <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="bbdrts-disb-proof-del"
                            onClick={() => handleRemovePhoto(p.id)}
                            title="Remove file"
                          >
                            <span className="material-symbols-outlined">close</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bbdrts-proofs-empty-notice">
                      <span className="material-symbols-outlined" style={{ color: '#eab308' }}>shield</span>
                      <span>At least 1 proof of relief is required to protect donor trust and unlock blockchain release.</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                STEP 4: REVIEW & BLOCKCHAIN NOTARIZATION
               ══════════════════════════════════════════════════════════ */}
            {currentStep === 4 && (
              <div className="bbdrts-step-content animate-fade">
                <div className="bbdrts-step-intro">
                  <h3 className="bbdrts-step-heading">Step 4: Final Audit Review</h3>
                  <p className="bbdrts-step-desc">
                    Review the disbursement summary. Submitting will notarize this aid milestone onto the blockchain and alert all backers.
                  </p>
                </div>

                <div className="bbdrts-review-grid">
                  <div className="bbdrts-review-card">
                    <span className="review-card-lbl">Releasing from Escrow</span>
                    <strong className="review-card-val text-emerald">₱{effectiveAmountPhp.toLocaleString()}</strong>
                    <span className="review-card-sub">Escrow Remaining: ₱{remainingInEscrow.toLocaleString()}</span>
                  </div>

                  <div className="bbdrts-review-card">
                    <span className="review-card-lbl">Beneficiaries &amp; Aid Type</span>
                    <strong className="review-card-val">{beneficiariesReached} Beneficiaries</strong>
                    <span className="review-card-sub">{selectedCategoryObj.label}</span>
                  </div>
                </div>

                <div className="bbdrts-review-grid" style={{ marginTop: '4px' }}>
                  <div className="bbdrts-review-section">
                    <span className="review-section-lbl">Coordinating Barangay / LGU</span>
                    <div className="review-location-chip">
                      <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#10b981' }}>account_balance</span>
                      <span>{lguPartner || 'Barangay LGU Partner'}</span>
                    </div>
                  </div>

                  <div className="bbdrts-review-section">
                    <span className="review-section-lbl">Distribution Site / Evacuation Center</span>
                    <div className="review-location-chip">
                      <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#10b981' }}>location_on</span>
                      <span>{location || 'Evacuation Center'}</span>
                    </div>
                  </div>
                </div>

                <div className="bbdrts-review-section">
                  <span className="review-section-lbl">Relief Narrative</span>
                  <blockquote className="review-narrative-quote">
                    "{impactSummary}"
                  </blockquote>
                </div>

                {allocationMode === 'ITEMIZED' && expenses.length > 0 && (
                  <div className="bbdrts-review-section">
                    <span className="review-section-lbl">Itemized Procurement Breakdown ({expenses.length} line items)</span>
                    <div className="review-itemized-chips">
                      {expenses.slice(0, 4).map((exp, i) => (
                        <div key={i} className="review-item-chip">
                          <span className="chip-desc">{exp.description || 'Supplies'}</span>
                          <span className="chip-qty">({exp.quantity || '1 lot'})</span>
                          <span className="chip-cost">₱{parseFloat(exp.costPhp || 0).toLocaleString()}</span>
                        </div>
                      ))}
                      {expenses.length > 4 && (
                        <div className="review-item-more">+{expenses.length - 4} more items</div>
                      )}
                    </div>
                  </div>
                )}

                <div className="bbdrts-review-section">
                  <span className="review-section-lbl">Attached Proofs ({proofs.length})</span>
                  <div className="review-proofs-pills">
                    {proofs.map((p) => (
                      <div key={p.id} className="review-proof-pill">
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>attach_file</span>
                        <span className="pill-name" title={p.name}>{p.name}</span>
                        <span className="pill-tag">{PROOF_CATEGORIES.find(c => c.value === p.category)?.label || 'Receipt'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bbdrts-blockchain-notice-box">
                  <span className="material-symbols-outlined" style={{ color: '#10b981', fontSize: '20px' }}>verified_user</span>
                  <div className="notice-body">
                    <strong>Cryptographic Audit &amp; Escrow Release</strong>
                    <p>
                      Confirming this milestone will compute a SHA-256 hash of your proofs and submit an audited on-chain record to the Ethereum EVM. All campaign backers will be notified in real-time.
                    </p>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* ── 5. Sticky Multi-Step Footer ── */}
          <div className="bbdrts-disb-footer">
            <div className="bbdrts-disb-footer-releasing">
              <span className="label">Releasing:</span>
              <strong className="amt">₱{effectiveAmountPhp.toLocaleString()}</strong>
            </div>

            <div className="bbdrts-disb-footer-actions">
              {currentStep > 1 ? (
                <button
                  type="button"
                  className="bbdrts-disb-btn-back"
                  onClick={() => setCurrentStep(s => s - 1)}
                  disabled={submitting}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
                  <span>Back</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="bbdrts-disb-btn-cancel"
                  onClick={onClose}
                  disabled={submitting}
                >
                  Cancel
                </button>
              )}

              {currentStep < 4 ? (
                <button
                  type="button"
                  className="bbdrts-disb-btn-next"
                  onClick={handleNextStep}
                  disabled={
                    (currentStep === 1 && !isStep1Valid) ||
                    (currentStep === 2 && !isStep2Valid) ||
                    (currentStep === 3 && !isStep3Valid)
                  }
                >
                  <span>Continue</span>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
                </button>
              ) : (
                <button
                  type="submit"
                  className="bbdrts-disb-btn-confirm"
                  disabled={
                    submitting ||
                    !isStep1Valid ||
                    !isStep2Valid ||
                    !isStep3Valid
                  }
                >
                  <span className="material-symbols-outlined">send</span>
                  <span>{submitting ? 'Notarizing & Disbursing...' : 'Confirm & Notarize on Blockchain'}</span>
                </button>
              )}
            </div>
          </div>
        </form>

      </div>
    </div>,
    document.body
  );
}
