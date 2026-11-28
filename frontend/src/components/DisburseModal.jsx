import { useState, useId, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { API_URL } from '../config';
import { useToast } from '../context/ToastContext';
import { blurFacesInImage, preloadFaceDetector } from '../utils/facePrivacyBlur';
import FaceBlurEditorModal from './FaceBlurEditorModal';
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

function formatFileBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  return (bytes / 1024).toFixed(1) + ' KB';
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => resolve(ev.target.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

async function prepareProofDataUrl(file) {
  const rawUrl = await readFileAsDataUrl(file);
  const isCompressibleImage =
    file.type &&
    file.type.startsWith('image/') &&
    !file.type.includes('svg') &&
    !file.type.includes('gif') &&
    file.size > 280 * 1024;

  if (!isCompressibleImage) {
    return { url: rawUrl, fileSize: formatFileBytes(file.size) };
  }

  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = rawUrl;
    });
    const maxDim = 1440;
    let { width, height } = img;
    if (width > maxDim || height > maxDim) {
      const ratio = Math.min(maxDim / width, maxDim / height);
      width = Math.max(1, Math.round(width * ratio));
      height = Math.max(1, Math.round(height * ratio));
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const compressedUrl = canvas.toDataURL('image/jpeg', 0.82);
    const compressedBytes = Math.round((compressedUrl.length * 3) / 4);
    if (compressedUrl.length < rawUrl.length) {
      return { url: compressedUrl, fileSize: formatFileBytes(compressedBytes) + ' (optimized)' };
    }
  } catch (_) {}

  return { url: rawUrl, fileSize: formatFileBytes(file.size) };
}

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

  // Multi-Proof Attachments & RA 10173 AI Face-Blur Privacy Shield
  const [proofs, setProofs] = useState([]);
  const [autoBlurFaces, setAutoBlurFaces] = useState(true);
  const [blurStatusLabel, setBlurStatusLabel] = useState('');
  const [previewProofId, setPreviewProofId] = useState(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [processingFiles, setProcessingFiles] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const wasOpenRef = useRef(false);
  const lastCampIdRef = useRef(null);

  // Cleanly reset all wizard fields only when modal opens or switches to a different campaign
  // (never wipes NGO progress mid-form if a live SSE donation updates availablePhp)
  useEffect(() => {
    const justOpened = isOpen && (!wasOpenRef.current || lastCampIdRef.current !== campId);
    if (justOpened && camp) {
      setCurrentStep(1);
      setAllocationMode('QUICK');
      setAmountPhp(availablePhp > 0 ? String(availablePhp) : '');
      setBeneficiariesReached(availablePhp >= 5000 ? '100' : (availablePhp > 0 ? '5' : '1'));
      setAidCategory('FOOD_WATER');
      setLguPartner('');
      setLocation(camp.locationRegion || camp.location || '');
      setImpactSummary('');
      setExpenses([
        { id: Date.now(), description: 'Emergency Food Packs (Rice, Canned Goods, Water)', quantity: '100 packs', costPhp: '' }
      ]);
      setImportedExcelName('');
      setProofs([]);
      setAutoBlurFaces(true);
      setBlurStatusLabel('');
      setPreviewProofId(null);
      setIsDraggingOver(false);
      setProcessingFiles(false);
      lastCampIdRef.current = campId;
      preloadFaceDetector().catch(() => {});
    }
    wasOpenRef.current = Boolean(isOpen);
  }, [isOpen, campId, camp, availablePhp]);

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
  const isOverdrawn = availablePhp <= 0 ? effectiveAmountPhp > 0 : effectiveAmountPhp > availablePhp + 0.01;

  // Step Validation Rules
  const isStep1Valid = availablePhp > 0 && effectiveAmountPhp > 0 && !isOverdrawn;
  const isStep2Valid = (parseInt(beneficiariesReached) || 0) > 0 && lguPartner.trim().length > 0 && location.trim().length > 0 && impactSummary.trim().length > 0;
  const isStep3Valid = proofs.length > 0 && !processingFiles;

  // Quick Percentage Allocation Handler
  const handleQuickPercent = (pct) => {
    if (availablePhp <= 0) return;
    const val = pct >= 1 ? availablePhp : Math.max(1, Math.round(availablePhp * pct));
    setAmountPhp(String(Math.min(availablePhp, val)));
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

  // Proof Upload (supports click & drag-and-drop, auto-compresses photos & RA 10173 AI face blur)
  const processProofFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    setProcessingFiles(true);
    setBlurStatusLabel(autoBlurFaces ? 'AI scanning & blurring faces (RA 10173)...' : 'Optimizing & packaging proof files...');
    let totalFacesBlurred = 0;
    let blurredPhotosCount = 0;

    try {
      const added = [];
      for (const file of files) {
        if (file.size > 12 * 1024 * 1024) {
          showWarning(`"${file.name}" exceeds 12MB limit. Please compress or split the document.`, 'File Too Large');
          continue;
        }
        const nameLower = file.name.toLowerCase();
        const isAllowed =
          (file.type && (file.type.startsWith('image/') || file.type === 'application/pdf' || file.type.includes('sheet') || file.type.includes('excel') || file.type.includes('csv'))) ||
          /\.(png|jpe?g|webp|pdf|xlsx|xls|csv)$/i.test(nameLower);
        if (!isAllowed) {
          showWarning(`"${file.name}" is not a supported proof format. Use JPG, PNG, PDF, or Excel/CSV.`, 'Unsupported File');
          continue;
        }

        const { url, fileSize } = await prepareProofDataUrl(file);
        let cat = 'GROUND_PHOTO';
        if (nameLower.includes('receipt') || nameLower.includes('invoice') || nameLower.includes('bill') || file.type.includes('pdf') || /\.(xlsx|xls|csv)$/i.test(nameLower)) {
          cat = 'OFFICIAL_RECEIPT';
        } else if (nameLower.includes('roster') || nameLower.includes('list') || nameLower.includes('masterlist')) {
          cat = 'BENEFICIARY_ROSTER';
        } else if (nameLower.includes('cert') || nameLower.includes('barangay') || nameLower.includes('turnover')) {
          cat = 'LGU_CERTIFICATE';
        } else if (nameLower.includes('waybill') || nameLower.includes('manifest') || nameLower.includes('delivery')) {
          cat = 'LOGISTICS_WAYBILL';
        }

        const isImage = Boolean(url && url.startsWith('data:image/') && !url.startsWith('data:image/svg'));
        let finalUrl = url;
        let blurredUrl = null;
        let facesBlurred = 0;
        let faceBoxes = [];
        let isBlurred = false;
        let faceScanned = false;

        if (isImage && autoBlurFaces) {
          setBlurStatusLabel(`AI scanning "${file.name}" for faces (RA 10173)...`);
          const blurRes = await blurFacesInImage(url);
          faceScanned = !blurRes.error;
          if (blurRes.blurred && blurRes.facesBlurred > 0) {
            finalUrl = blurRes.url;
            blurredUrl = blurRes.blurredUrl;
            facesBlurred = blurRes.facesBlurred;
            faceBoxes = Array.isArray(blurRes.boxes) ? blurRes.boxes : [];
            isBlurred = true;
            totalFacesBlurred += facesBlurred;
            blurredPhotosCount += 1;
          }
        }

        added.push({
          id: Date.now() + Math.random(),
          name: file.name,
          url: finalUrl,
          originalUrl: url,
          blurredUrl,
          boxes: faceBoxes,
          facesBlurred,
          isBlurred,
          faceScanned,
          scanningFaces: false,
          fileSize,
          caption: file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' '),
          category: cat
        });
      }

      if (added.length > 0) {
        setProofs((prev) => [...prev, ...added]);
        if (totalFacesBlurred > 0) {
          showSuccess(
            `RA 10173 Privacy Shield automatically blurred ${totalFacesBlurred} face${totalFacesBlurred === 1 ? '' : 's'} across ${blurredPhotosCount} photo${blurredPhotosCount === 1 ? '' : 's'}.`,
            'Faces Protected'
          );
        }
      }
    } catch (err) {
      console.error('Proof upload processing failed:', err);
      showError('Failed to process one or more proof files. Please try again.', 'Upload Error');
    } finally {
      setProcessingFiles(false);
      setBlurStatusLabel('');
    }
  };

  // Toggle Blurred <-> Original instantly, or run on-demand AI face blur on a single proof photo
  const handleToggleProofFaceBlur = async (id) => {
    const target = proofs.find((p) => p.id === id);
    if (!target || !target.url?.startsWith('data:image/')) return;

    if (target.blurredUrl) {
      const nextBlurred = !target.isBlurred;
      setProofs((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, isBlurred: nextBlurred, url: nextBlurred ? p.blurredUrl : (p.originalUrl || p.url) }
            : p
        )
      );
      return;
    }

    setProofs((prev) => prev.map((p) => (p.id === id ? { ...p, scanningFaces: true } : p)));
    const res = await blurFacesInImage(target.originalUrl || target.url);
    setProofs((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        if (res.blurred && res.facesBlurred > 0) {
          return {
            ...p,
            url: res.url,
            blurredUrl: res.blurredUrl,
            boxes: Array.isArray(res.boxes) ? res.boxes : [],
            facesBlurred: res.facesBlurred,
            isBlurred: true,
            faceScanned: true,
            scanningFaces: false
          };
        }
        return { ...p, faceScanned: !res.error, scanningFaces: false };
      })
    );
    if (res.blurred && res.facesBlurred > 0) {
      showSuccess(`Blurred ${res.facesBlurred} face${res.facesBlurred === 1 ? '' : 's'} in "${target.name}".`, 'RA 10173 Privacy Shield');
    } else if (res.error) {
      showWarning(`Face detection could not run (${res.error}). Please retry.`, 'Privacy Scanner Unavailable');
    } else {
      showWarning(`No human faces detected in "${target.name}".`, 'Privacy Scan Complete');
    }
  };

  const handlePhotoUpload = (e) => {
    processProofFiles(e.target.files);
    e.target.value = '';
  };

  const handleDropProofs = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer?.files?.length) {
      processProofFiles(e.dataTransfer.files);
    }
  };

  const handleRemovePhoto = (id) => {
    setProofs((prev) => prev.filter((p) => p.id !== id));
  };

  const handleUpdateProofCategory = (id, newCat) => {
    setProofs((prev) => prev.map((p) => (p.id === id ? { ...p, category: newCat } : p)));
  };

  const handleUpdateProofCaption = (id, newCaption) => {
    setProofs((prev) => prev.map((p) => (p.id === id ? { ...p, caption: newCaption } : p)));
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

    if (availablePhp <= 0) {
      showWarning('No undisbursed escrow funds are available for this campaign yet.', 'Escrow Empty');
      return;
    }

    if (effectiveAmountPhp > availablePhp + 0.01) {
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

      const notified = Number(data.notifiedDonorsCount || 0);
      const emailed = Number(data.emailedDonorsCount || 0);
      const chainNote = data.onChain ? 'Anchored live on Sepolia.' : 'Sealed with SHA-256 audit proof.';
      const donorNote = notified > 0
        ? `${notified} donor${notified === 1 ? '' : 's'} notified (${emailed} email${emailed === 1 ? '' : 's'} sent).`
        : 'Verified relief proofs are now live on the campaign.';
      showSuccess(
        `Disbursed ₱${effectiveAmountPhp.toLocaleString()}! ${chainNote} ${donorNote}`,
        'Relief Funds Disbursed'
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
        
        {/* ── 1. Header (Geist Treasury Layout) ── */}
        <div className="bbdrts-disb-header">
          <div className="bbdrts-disb-header-left">
            <div className="bbdrts-disb-header-icon" aria-hidden="true">
              <span className="material-symbols-outlined" style={{ fontSize: '19px' }}>payments</span>
            </div>
            <div className="bbdrts-disb-title-wrap">
              <h2 className="bbdrts-disb-title">Disburse Funds &amp; Proof of Relief</h2>
              <p className="bbdrts-disb-subtitle">
                Release verified escrow funds, attach delivery proofs, and notify campaign donors.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="bbdrts-disb-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
            title="Close (Esc)"
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
            <span className="label">Disbursed</span>
            <strong className="val text-muted">₱{alreadyDisbursedPhp.toLocaleString()}</strong>
          </div>
          <div className="bbdrts-disb-summary-col highlight">
            <span className="label">Available Escrow</span>
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

                {availablePhp <= 0 && (
                  <div className="bbdrts-proofs-empty-notice" style={{ marginTop: 0 }}>
                    <span className="material-symbols-outlined" style={{ color: '#eab308' }}>info</span>
                    <span>
                      {alreadyDisbursedPhp > 0
                        ? `All ₱${currentPhp.toLocaleString()} raised for this campaign has already been disbursed. New verified donations will automatically unlock additional escrow balance here.`
                        : 'No verified donations have settled into escrow for this campaign yet. Once donations are verified, you can release funds and upload relief proofs here.'}
                    </span>
                  </div>
                )}

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
                      <div className="bbdrts-disb-label-row">
                        <label htmlFor="disb-amt">Amount to Disburse <span className="req">*</span></label>
                        {availablePhp > 0 && (
                          <span className="bbdrts-disb-label-meta">
                            Max ₱{availablePhp.toLocaleString()}
                          </span>
                        )}
                      </div>
                      <div className={`bbdrts-disb-input-wrap lg ${isOverdrawn ? 'error' : ''}`}>
                        <span className="prefix">₱</span>
                        <input
                          id="disb-amt"
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={amountPhp}
                          onKeyDown={(e) => {
                            if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                          }}
                          onChange={(e) => {
                            const cleaned = String(e.target.value || '').replace(/[^0-9.]/g, '');
                            const parts = cleaned.split('.');
                            let intPart = (parts[0] || '').slice(0, 8);
                            if (intPart.length > 1 && intPart.startsWith('0')) {
                              intPart = intPart.replace(/^0+/, '') || '0';
                            }
                            const decPart = parts.length > 1 ? '.' + parts.slice(1).join('').slice(0, 2) : '';
                            setAmountPhp(intPart + decPart);
                          }}
                          required
                          autoFocus
                        />
                        <span className="suffix">PHP</span>
                      </div>

                      {availablePhp > 0 && (
                        <div className="bbdrts-disb-preset-grid" role="group" aria-label="Quick allocation presets">
                          {[
                            { pct: 0.25, label: '25%', val: Math.round(availablePhp * 0.25) },
                            { pct: 0.5, label: '50%', val: Math.round(availablePhp * 0.5) },
                            { pct: 0.75, label: '75%', val: Math.round(availablePhp * 0.75) },
                            { pct: 1.0, label: '100% · Max', val: availablePhp }
                          ].map((p) => {
                            const isSelected = effectiveAmountPhp > 0 && Math.abs(effectiveAmountPhp - p.val) < 1;
                            return (
                              <button
                                key={p.label}
                                type="button"
                                className={`bbdrts-disb-preset-card${isSelected ? ' is-selected' : ''}`}
                                onClick={() => handleQuickPercent(p.pct)}
                              >
                                <span className="preset-pct">{p.label}</span>
                                <span className="preset-amt">₱{p.val.toLocaleString()}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {isOverdrawn ? (
                        <div className="bbdrts-disb-overdrawn-alert" role="alert">
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>error</span>
                          <span>
                            Exceeds available escrow (₱{availablePhp.toLocaleString()}) by{' '}
                            <strong>₱{(effectiveAmountPhp - availablePhp).toLocaleString()}</strong>.
                          </span>
                        </div>
                      ) : (() => {
                        const releasePct = availablePhp > 0
                          ? Math.min(100, Math.max(0, Math.round((effectiveAmountPhp / availablePhp) * 100)))
                          : 0;
                        return (
                          <div className="bbdrts-escrow-balance-card">
                            <div className="bbdrts-escrow-grid">
                              <div className="escrow-calc-col">
                                <span className="calc-lbl">Available</span>
                                <span className="calc-val">₱{availablePhp.toLocaleString()}</span>
                              </div>
                              <div className="escrow-calc-col">
                                <span className="calc-lbl">Releasing Now</span>
                                <span className="calc-val text-emerald">₱{effectiveAmountPhp.toLocaleString()}</span>
                              </div>
                              <div className="escrow-calc-col is-right">
                                <span className="calc-lbl">Remaining After</span>
                                <span className="calc-val">₱{remainingInEscrow.toLocaleString()}</span>
                              </div>
                            </div>
                            <div className="bbdrts-escrow-progress-wrap">
                              <div className="bbdrts-escrow-progress-track">
                                <div className="bbdrts-escrow-progress-fill" style={{ width: `${releasePct}%` }} />
                              </div>
                              <span className="bbdrts-escrow-progress-label">{releasePct}% of escrow</span>
                            </div>
                          </div>
                        );
                      })()}
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

                {/* Data Privacy (RA 10173) Compliance Notice + AI Auto-Blur Shield Toggle */}
                <div className="bbdrts-privacy-notice-box">
                  <div className="privacy-notice-top-row">
                    <div className="privacy-notice-header">
                      <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#10b981' }}>security</span>
                      <strong>RA 10173 Survivor Privacy &amp; AI Face-Blur Shield</strong>
                    </div>
                    <label className="bbdrts-faceblur-toggle" title="Automatically detect and blur human faces in uploaded photos while keeping receipts untouched">
                      <input
                        type="checkbox"
                        checked={autoBlurFaces}
                        onChange={(e) => setAutoBlurFaces(e.target.checked)}
                      />
                      <span className="toggle-track">
                        <span className="toggle-thumb" />
                      </span>
                      <span className="toggle-label">{autoBlurFaces ? 'AI Face-Blur ON' : 'AI Face-Blur OFF'}</span>
                    </label>
                  </div>
                  <p>
                    AI automatically detects and blurs beneficiary faces in ground photos before upload while keeping receipts and certificates sharp. For citizen rosters, mask names (e.g. <code>J*** D***</code>) or attach a signed <strong>Barangay Certificate of Turnover</strong>.
                  </p>
                </div>

                <div className="bbdrts-disb-field">
                  <input
                    type="file"
                    id={fileInputId}
                    multiple
                    accept="image/*,application/pdf,.xlsx,.xls,.csv"
                    onChange={handlePhotoUpload}
                    style={{ display: 'none' }}
                  />

                  <label
                    htmlFor={fileInputId}
                    className={`bbdrts-disb-dropzone ${isDraggingOver ? 'is-dragging' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(true); }}
                    onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(true); }}
                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(false); }}
                    onDrop={handleDropProofs}
                  >
                    <div className="bbdrts-disb-drop-icon">
                      <span className="material-symbols-outlined">
                        {processingFiles ? 'hourglass_top' : (isDraggingOver ? 'file_download' : 'add_photo_alternate')}
                      </span>
                    </div>
                    <div className="bbdrts-disb-drop-text">
                      <strong>
                        {processingFiles
                          ? (blurStatusLabel || 'Optimizing & Packaging Proof Files...')
                          : (isDraggingOver ? 'Drop Relief Proofs Here' : 'Click or Drag to Upload Ground Photos & Receipts')}
                      </strong>
                      <span>Upload JPG, PNG, PDF, or Excel/CSV files (up to 12MB each). Large photos are auto-optimized for fast on-chain &amp; email delivery.</span>
                    </div>
                  </label>

                  {proofs.length > 0 ? (
                    <div className="bbdrts-disb-proofs-list">
                      <div className="proofs-list-header">
                        <span>Attached Files ({proofs.length})</span>
                        <span className="hint">Label &amp; categorize each proof for donors</span>
                      </div>
                      {proofs.map((p) => {
                        const isImg = Boolean(p.url && p.url.startsWith('data:image'));
                        const isPdf = Boolean((p.url && p.url.startsWith('data:application/pdf')) || /\.pdf$/i.test(p.name || ''));
                        const isSheet = /\.(xlsx|xls|csv)$/i.test(p.name || '');
                        return (
                          <div key={p.id} className="bbdrts-disb-proof-item">
                            <div
                              className={`bbdrts-disb-proof-thumb ${isImg ? 'is-clickable' : ''}`}
                              onClick={() => isImg && setPreviewProofId(p.id)}
                              title={isImg ? 'Click to preview photo' : p.name}
                            >
                              {isImg ? (
                                <img src={p.url} alt={p.name} />
                              ) : isPdf ? (
                                <span className="material-symbols-outlined" style={{ color: '#f87171' }}>picture_as_pdf</span>
                              ) : isSheet ? (
                                <span className="material-symbols-outlined" style={{ color: '#10b981' }}>table_view</span>
                              ) : (
                                <span className="material-symbols-outlined">description</span>
                              )}
                            </div>
                            <div className="bbdrts-disb-proof-info">
                              <input
                                type="text"
                                className="bbdrts-disb-proof-caption-input"
                                value={p.caption || ''}
                                onChange={(e) => handleUpdateProofCaption(p.id, e.target.value)}
                                placeholder="Label this proof (e.g., Rice invoice, Handover photo)"
                                title="Edit caption shown to donors"
                              />
                              <div className="proof-meta-row">
                                <span className="proof-meta" title={p.name}>{p.name} · {p.fileSize}</span>
                                {isImg && p.scanningFaces && (
                                  <span className="proof-privacy-pill is-scanning">Scanning faces…</span>
                                )}
                                {isImg && !p.scanningFaces && p.isBlurred && p.facesBlurred > 0 && (
                                  <span className="proof-privacy-pill is-protected">
                                    <span className="material-symbols-outlined">blur_on</span>
                                    <span>{p.facesBlurred} face{p.facesBlurred === 1 ? '' : 's'} blurred</span>
                                  </span>
                                )}
                                {isImg && !p.scanningFaces && p.blurredUrl && !p.isBlurred && (
                                  <span className="proof-privacy-pill is-paused">Original shown</span>
                                )}
                                {isImg && !p.scanningFaces && (
                                  <>
                                    <button
                                      type="button"
                                      className="proof-privacy-action"
                                      onClick={() => handleToggleProofFaceBlur(p.id)}
                                      title={p.isBlurred ? 'Restore unblurred original' : 'Run AI face blur on this photo'}
                                    >
                                      {p.isBlurred ? 'Undo blur' : (p.blurredUrl ? 'Re-blur' : 'Blur faces')}
                                    </button>
                                    <button
                                      type="button"
                                      className="proof-privacy-action"
                                      onClick={() => setPreviewProofId(p.id)}
                                      title="Inspect photo & tap any face to add or remove blur"
                                    >
                                      Touch-Up Blur
                                    </button>
                                  </>
                                )}
                              </div>
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
                        );
                      })}
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
                    <strong>Sepolia Notarization, Donor Notifications &amp; Proof Emails</strong>
                    <p>
                      Confirming this milestone computes a canonical SHA-256 evidence digest, notarizes the release gaslessly on Ethereum Sepolia, posts instant alerts to every donor&apos;s Notification Center, and sends Verified Relief Proof emails with downloadable receipts and photos.
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

      {(() => {
        const activeP = previewProofId ? proofs.find((x) => x.id === previewProofId) : null;
        if (!activeP) return null;
        return (
          <FaceBlurEditorModal
            isOpen={true}
            title={activeP.caption || activeP.name || 'Disbursement Proof Photo'}
            originalUrl={activeP.originalUrl || activeP.url}
            initialUrl={activeP.url}
            initialBoxes={activeP.boxes || []}
            initialBlurred={Boolean(activeP.isBlurred)}
            onClose={() => setPreviewProofId(null)}
            onSave={(updated) => {
              setProofs((prev) =>
                prev.map((item) =>
                  item.id === activeP.id
                    ? {
                        ...item,
                        url: updated.url,
                        blurredUrl: updated.blurredUrl,
                        boxes: updated.boxes,
                        facesBlurred: updated.facesBlurred,
                        isBlurred: updated.isBlurred,
                        faceScanned: true
                      }
                    : item
                )
              );
              showSuccess(
                updated.facesBlurred > 0
                  ? `Saved ${updated.facesBlurred} blurred face${updated.facesBlurred === 1 ? '' : 's'} for "${activeP.name}".`
                  : `Saved original photo for "${activeP.name}".`,
                'Privacy Touch-Up Saved'
              );
            }}
          />
        );
      })()}
    </div>,
    document.body
  );
}
