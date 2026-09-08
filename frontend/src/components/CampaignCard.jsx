import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ethers } from 'ethers';
import { ROLES } from '../roleConfig';
import LocationMapPicker from './LocationMapPicker';
import { useToast } from '../context/ToastContext';
import DonorBadge, { globalDonorRegistry } from './DonorBadge';
import './MultiRailProgress.css';

const SEPOLIA_EXPLORER = 'https://sepolia.etherscan.io/tx/';

export const shortAddr = (addr) =>
  addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '';

export const progressPct = (current, target) => {
  const c = parseFloat(current);
  const t = parseFloat(target);
  if (!t || isNaN(c) || c <= 0) return '0';
  const rawPct = (c / t) * 100;
  if (rawPct > 0 && rawPct < 1) {
    return rawPct.toFixed(2).replace(/\.?0+$/, '');
  }
  return Math.min(100, rawPct).toFixed(1).replace(/\.0$/, '');
};

export const formatEthAmt = (val) => {
  const n = parseFloat(val || 0);
  if (isNaN(n) || n === 0) return '0.00';
  if (n < 0.0001) return n.toFixed(6).replace(/\.?0+$/, '');
  return n.toFixed(4).replace(/\.?0+$/, '');
};

export const getOrgDisplayName = (orgAddress, orgName, campaignId) => {
  if (orgName && typeof orgName === 'string' && orgName.trim() && orgName !== 'Unknown Org') {
    return orgName.trim();
  }

  if (orgAddress && typeof orgAddress === 'string') {
    const addrLower = orgAddress.toLowerCase();
    if (addrLower.startsWith('0x206e')) return 'Red Cross Philippines';
    if (addrLower.startsWith('0x8898')) return 'CCS Relief Org';
    return shortAddr(orgAddress);
  }

  return 'NGO Relief Organization';
};

export const formatCampaignTitle = (title, id) => {
  if (!title || !String(title).trim()) return `Disaster Relief Campaign #${id}`;
  return title.trim();
};

export const getCampaignAuditDetails = (arg1, arg2, arg3) => {
  let id = 1;
  let title = '';
  let camp = {};

  if (typeof arg1 === 'object' && arg1 !== null) {
    camp = arg1;
    id = camp.id || 1;
    title = camp.title || '';
  } else {
    id = arg1 || 1;
    title = arg2 || '';
    camp = arg3 || {};
  }

  // Parse allocationsJson if present (supports camelCase & snake_case)
  const rawAllocations = camp.allocationsJson || camp.allocations_json;
  let customAllocations = null;
  if (rawAllocations) {
    try {
      const parsed = typeof rawAllocations === 'string' ? JSON.parse(rawAllocations) : rawAllocations;
      if (Array.isArray(parsed) && parsed.length > 0) {
        customAllocations = parsed;
      }
    } catch (e) {
      console.warn("Failed to parse allocationsJson", e);
    }
  }

  const region = camp.locationRegion || camp.location_region || camp.location;
  const gps = camp.gpsCoordinates || camp.gps_coordinates || camp.gps;
  const beneficiaries = camp.beneficiariesImpact || camp.beneficiaries_impact || camp.beneficiaries;
  const contact = camp.contactInfo || camp.contact_info || camp.contact;
  const urgency = camp.urgency;
  const description = camp.description;
  const targetDate = camp.targetDate || camp.target_date;
  const documentUrl = camp.documentUrl || camp.document_url;

  // Smart Context-Aware Fallbacks
  const fullText = `${title} ${description || ''} ${region || ''}`.toLowerCase();

  let fallbackRegion = 'Brgy. Combado & Coastal Evacuation Centers, Maasin City, Southern Leyte';
  let fallbackGps = '10.1335, 124.8436';
  let fallbackBeneficiaries = '1,250 Families (approx. 5,000 Individuals)';
  let fallbackUrgency = 'HIGH (EMERGENCY AID)';
  let fallbackContact = '+63 917 890 1234 (Disaster Response Desk)';
  let fallbackDesc = 'Immediate on-ground relief operations providing family food packs, potable drinking water canisters, emergency medical kits, and temporary weatherproof shelter tarpaulins for affected households.';
  let fallbackAllocations = [
    { label: 'Emergency Food Packs & Potable Water', pct: 40, icon: 'rice_bowl' },
    { label: 'Medical Supplies & First Aid Kits', pct: 25, icon: 'medical_services' },
    { label: 'Weatherproof Tarpaulins & Shelter Repair', pct: 20, icon: 'roofing' },
    { label: 'Logistics, Evacuation & Fuel Transport', pct: 15, icon: 'local_shipping' }
  ];

  if (/salin|bagyo|typhoon|storm|odette/i.test(fullText)) {
    fallbackRegion = 'Brgy. Combado & Lowland Evacuation Centers, Maasin City, Southern Leyte';
    fallbackGps = '10.1335, 124.8436';
    fallbackBeneficiaries = '1,450 Displaced Families (approx. 5,800 Individuals)';
    fallbackUrgency = 'CRITICAL EMERGENCY AID';
    fallbackDesc = 'Direct emergency relief operations for coastal and low-lying barangays severely affected by Typhoon Salin. Rapid aid packages include family food rations, water purification kits, hygiene packs, and emergency roof repair materials.';
    fallbackAllocations = [
      { label: 'Emergency Food Rations & Water Packs', pct: 45, icon: 'rice_bowl' },
      { label: 'Weatherproof Tarpaulins & Roofing Kits', pct: 30, icon: 'roofing' },
      { label: 'First Aid & Personal Hygiene Kits', pct: 15, icon: 'medical_services' },
      { label: 'Emergency Evacuation & Fuel Logistics', pct: 10, icon: 'local_shipping' }
    ];
  } else if (/blood|dugo|donor|red cross|medical|hospital/i.test(fullText)) {
    fallbackRegion = 'Philippine Red Cross Regional Blood Center, Southern Leyte';
    fallbackGps = '10.1360, 124.8470';
    fallbackBeneficiaries = '450 Critical Patients & Trauma Victims';
    fallbackUrgency = 'URGENT MEDICAL AID';
    fallbackContact = '+63 917 555 2468 (Red Cross Hotline)';
    fallbackDesc = 'Facilitation of emergency blood drives, testing reagents, temperature-controlled cold chain logistics, and direct patient transfusion subsidies across hospitals in Eastern Visayas.';
    fallbackAllocations = [
      { label: 'Blood Bags, Reagents & Testing Kits', pct: 50, icon: 'bloodtype' },
      { label: 'Cold-Chain Refrigerated Transport', pct: 25, icon: 'local_shipping' },
      { label: 'Donor Refreshments & Clinical Supplies', pct: 15, icon: 'medical_services' },
      { label: 'Biohazard Safety & Administration', pct: 10, icon: 'health_and_safety' }
    ];
  } else if (/food|nutrition|rice|hunger|meal/i.test(fullText)) {
    fallbackRegion = 'Southern Leyte Communities & Island Barangays';
    fallbackGps = '10.1350, 124.8440';
    fallbackBeneficiaries = '1,100 Underserved Households';
    fallbackUrgency = 'HIGH PRIORITY';
    fallbackDesc = 'Distribution of non-perishable nutritious food packs, fortified rice rations, infant milk, and clean water filtration buckets for disaster-stricken communities.';
    fallbackAllocations = [
      { label: 'Fortified Rice & Canned Goods', pct: 50, icon: 'rice_bowl' },
      { label: 'Water Filtration Canisters', pct: 25, icon: 'water_drop' },
      { label: 'Infant Nutrition & Supplemental Milk', pct: 15, icon: 'nutrition' },
      { label: 'Distribution & Transport Logistics', pct: 10, icon: 'local_shipping' }
    ];
  } else if (/shelter|rebuild|roof|housing/i.test(fullText)) {
    fallbackRegion = 'Coastal Barangays, Maasin City & Macrohon, Southern Leyte';
    fallbackGps = '10.1320, 124.8420';
    fallbackBeneficiaries = '850 Families Needing Shelter Rebuilding';
    fallbackUrgency = 'ESSENTIAL RECOVERY';
    fallbackDesc = 'Delivery of corrugated galvanized iron (CGI) roofing sheets, heavy-duty tarpaulins, framing timber, and structural toolkits to restore damaged family homes.';
    fallbackAllocations = [
      { label: 'CGI Roofing Sheets & Lumber Framing', pct: 55, icon: 'roofing' },
      { label: 'Heavy-Duty Waterproof Tarpaulins', pct: 25, icon: 'shield' },
      { label: 'Carpentry Toolkits & Fasteners', pct: 10, icon: 'construction' },
      { label: 'Transport & Staging Ground Logistics', pct: 10, icon: 'local_shipping' }
    ];
  }

  return {
    region: (region && region.trim()) || fallbackRegion,
    gps: (gps && gps.trim()) || fallbackGps,
    beneficiaries: (beneficiaries && beneficiaries.trim()) || fallbackBeneficiaries,
    allocations: customAllocations || fallbackAllocations,
    contact: (contact && contact.trim()) || fallbackContact,
    urgency: (urgency && urgency.trim()) || fallbackUrgency,
    description: (description && description.trim()) || fallbackDesc,
    targetDate: (targetDate && targetDate.trim()) || 'Active Operations',
    documentUrl: (documentUrl && documentUrl.trim()) || ''
  };
};

export const getCampaignCoverData = (camp = {}) => {
  const title = (camp.title || '').toLowerCase();
  const desc = (camp.description || '').toLowerCase();
  const fullText = `${title} ${desc}`;

  let imageUrl = camp.imageUrl || camp.image_url;
  let categoryIcon = 'volunteer_activism';
  let categoryTag = 'Relief Cause';
  const rawLocation = camp.locationRegion || camp.location_region || camp.location || camp.region;
  let locationTag = rawLocation || 'Southern Leyte, PH';

  if (imageUrl) {
    return { imageUrl, categoryIcon, categoryTag, locationTag };
  }

  // 1. Fisherfolk / Coastal Livelihood
  if (/fisherfolk|boat|palawan|marine|banca|livelihood/i.test(fullText)) {
    imageUrl = 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=600&q=80';
    categoryIcon = 'sailing';
    categoryTag = 'Livelihood Aid';
    locationTag = rawLocation || 'Northern Palawan';
  }
  // 2. Volcano / Ashfall Evacuees
  else if (/kanlaon|volcano|ashfall|blanket|tremor/i.test(fullText)) {
    imageUrl = 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=600&q=80';
    categoryIcon = 'volcano';
    categoryTag = 'Volcano Evacuees';
    locationTag = rawLocation || 'Canlaon, Negros Oriental';
  }
  // 3. Medical & Hygiene Aid
  else if (/medical|hygiene|medicine|doctor|clinic|sanitation|antibiotic/i.test(fullText)) {
    imageUrl = 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=600&q=80';
    categoryIcon = 'medical_services';
    categoryTag = 'Medical Aid';
    locationTag = rawLocation || 'Mindanao Disaster Zone';
  }
  // 4. Shelter & Reconstruction
  else if (/shelter|reconstruct|rebuild|roof|lumber|tarpaulin|housing/i.test(fullText)) {
    imageUrl = 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=600&q=80';
    categoryIcon = 'roofing';
    categoryTag = 'Shelter Recovery';
    locationTag = rawLocation || 'Samar & Biliran Islands';
  }
  // 5. Flood Emergency
  else if (/flood|baha|inundat/i.test(fullText)) {
    imageUrl = 'https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&w=600&q=80';
    categoryIcon = 'flood';
    categoryTag = 'Flood Emergency';
    locationTag = rawLocation || 'Davao & Agusan del Sur';
  }
  // 6. Typhoon / Super Typhoon / Storm
  else if (/typhoon|bagyo|storm|odette|salin|luzon/i.test(fullText)) {
    imageUrl = 'https://images.unsplash.com/photo-1527482797697-8795b05a13fe?auto=format&fit=crop&w=600&q=80';
    categoryIcon = 'cyclone';
    categoryTag = 'Typhoon Relief';
    locationTag = rawLocation || 'Southern Leyte, PH';
  }
  // 7. Food & Water Emergency
  else if (/food|water|meal|rice|nutrition|ration/i.test(fullText)) {
    imageUrl = 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=600&q=80';
    categoryIcon = 'nutrition';
    categoryTag = 'Food & Water';
    locationTag = rawLocation || 'Southern Leyte, PH';
  } else {
    imageUrl = 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=600&q=80';
    categoryIcon = 'handshake';
    categoryTag = 'Disaster Relief';
    locationTag = rawLocation || 'Philippines';
  }

  return { imageUrl, categoryIcon, categoryTag, locationTag };
};

export const getCampaignTags = (camp = {}) => {
  const rawTags = camp.tags || camp.tags_json || camp.tagsJson;
  if (Array.isArray(rawTags) && rawTags.length > 0) {
    return rawTags.map(t => String(t).trim()).filter(Boolean);
  }
  if (typeof rawTags === 'string' && rawTags.trim()) {
    return rawTags.split(',').map(t => t.trim()).filter(Boolean);
  }

  const title = (camp.title || '').toLowerCase();
  const desc = (camp.description || '').toLowerCase();
  const full = `${title} ${desc}`;

  if (/fisherfolk|boat|palawan|marine|livelihood/i.test(full)) {
    return ['Coastal Fisherfolk', 'Boat Rebuilding', 'Livelihood Recovery'];
  } else if (/kanlaon|volcano|ashfall|blanket/i.test(full)) {
    return ['Volcano Ashfall', 'Emergency Blankets', 'Evacuee Support'];
  } else if (/medical|hygiene|medicine|sanitation/i.test(full)) {
    return ['Medical Mission', 'First Aid Supplies', 'Hygiene Kits'];
  } else if (/shelter|reconstruct|rebuild|roof|housing/i.test(full)) {
    return ['Emergency Shelter', 'Home Reconstruction', 'CGI Roofing'];
  } else if (/flood|baha/i.test(full)) {
    return ['Flash Flood Response', 'Water Rescue', 'Evacuation Centers'];
  } else if (/typhoon|bagyo|storm|odette|luzon/i.test(full)) {
    return ['Typhoon Disaster Aid', 'Immediate Food Packs', 'Clean Water Access'];
  } else {
    return ['Disaster Response', 'Relief Operation', 'Humanitarian Aid'];
  }
};

export const getCampaignCategoryInfo = (camp = {}) => {
  // 1. Explicit category from database
  if (camp.category === 'CD') {
    return { prefix: 'CD', label: 'Charitable Aid', icon: 'volunteer_activism', colorClass: 'cat-pill-cd' };
  }
  if (camp.category === 'DR') {
    return { prefix: 'DR', label: 'Disaster Relief', icon: 'crisis_alert', colorClass: 'cat-pill-dr' };
  }

  // 2. Smart text fallback (Disaster keywords ALWAYS take priority!)
  const title = (camp.title || '').toLowerCase();
  const desc = (camp.description || '').toLowerCase();
  const full = `${title} ${desc}`;

  const isDisaster = /typhoon|bagyo|flood|baha|combado|calamity|storm|earthquake|salin|odette|disaster|rescue|evacuat/i.test(full);
  if (isDisaster) {
    return { prefix: 'DR', label: 'Disaster Relief', icon: 'crisis_alert', colorClass: 'cat-pill-dr' };
  }

  const isCharity = /charity|school|orphan|scholar|community|livelihood|pantry|medical|blood/i.test(full);
  if (isCharity) {
    return { prefix: 'CD', label: 'Charitable Aid', icon: 'volunteer_activism', colorClass: 'cat-pill-cd' };
  }

  return { prefix: 'DR', label: 'Disaster Relief', icon: 'crisis_alert', colorClass: 'cat-pill-dr' };
};

export default function CampaignCard(props) {
  const { showWarning, showSuccess, showInfo } = useToast();
  const camp = props.camp || props.campaign || {};
  const { contract, role, walletAddress, onDonated, onDeactivated, onOpenNgoProfile } = props;
  const [amount, setAmount] = useState('');
  const [deactivating, setDeactivating] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Category & meta info determination
  const catInfo = useMemo(() => getCampaignCategoryInfo(camp), [camp]);

  // Cover image & location tag determination
  const coverData = useMemo(() => getCampaignCoverData(camp), [camp]);

  // Campaign tags (custom NGO selected or fallback)
  const campaignTags = useMemo(() => getCampaignTags(camp), [camp]);

  // Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [donateStep, setDonateStep] = useState(1);
  const [customMsg, setCustomMsg] = useState('');
  const [txHash, setTxHash] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [legalConfirm, setLegalConfirm] = useState(false);
  const [receiptBase64, setReceiptBase64] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [deactivateModal, setDeactivateModal] = useState({ show: false, step: 0, hash: '', error: '' });

  // Fiat Gateway Additions
  const [donorName, setDonorName] = useState('');
  const [donorEmail, setDonorEmail] = useState('');
  const [refNumber, setRefNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [isFlipped, setIsFlipped] = useState(false);

  // Mock Gateway State
  const [gatewayMethod, setGatewayMethod] = useState('');
  const [gatewayStep, setGatewayStep] = useState(0);
  const [gatewayRefNo, setGatewayRefNo] = useState('');
  const [gatewayMobile, setGatewayMobile] = useState('');
  const [gatewayOtp, setGatewayOtp] = useState(['', '', '', '', '', '']);
  const [gatewayMpin, setGatewayMpin] = useState(['', '', '', '']);
  const [gatewayBalance, setGatewayBalance] = useState(0);
  const [gatewayLoading, setGatewayLoading] = useState(false);
  const [cardAddress, setCardAddress] = useState('');
  const [cardCity, setCardCity] = useState('');
  const [cardState, setCardState] = useState('');
  const [cardZip, setCardZip] = useState('');
  const [cardEmail, setCardEmail] = useState('');
  const [cardCountry, setCardCountry] = useState('Philippines');
  const [hideCardDetails, setHideCardDetails] = useState(false);
  const [showRailTelemetry, setShowRailTelemetry] = useState(false);
  const [hoveredRail, setHoveredRail] = useState(null);
  const railDropdownRef = useRef(null);

  // Close rail telemetry dropdown popup on click outside or Escape
  useEffect(() => {
    if (!showRailTelemetry) return;
    const handleClickOutside = (e) => {
      if (railDropdownRef.current && !railDropdownRef.current.contains(e.target)) {
        setShowRailTelemetry(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowRailTelemetry(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showRailTelemetry]);

  // Optical True-Zoom Magnifier Lens (280px, 1.5x Magnification, Symmetrical Invariance)
  const [magnifierActive, setMagnifierActive] = useState(false);
  const modalCardRef = useRef(null);
  const magnifierOverlayRef = useRef(null);
  const clipViewportRef = useRef(null);
  const scaledCardContainerRef = useRef(null);
  const zoomedViewRef = useRef(null);
  const lensRef = useRef(null);
  const outsideButtonRef = useRef(null);
  const LENS_SIZE = 280;
  const ZOOM_FACTOR = 1.5;

  useEffect(() => {
    if (!magnifierActive || !modalOpen) return;

    // Synchronize live DOM from modal card into zoomed view with live input values and focus state
    const syncLiveView = () => {
      const card = modalCardRef.current;
      const zoomed = zoomedViewRef.current;
      if (!card || !zoomed) return;

      zoomed.innerHTML = card.innerHTML;

      // Copy values of all input fields, textareas, and selects
      const liveInputs = card.querySelectorAll('input, textarea, select');
      const zoomedInputs = zoomed.querySelectorAll('input, textarea, select');
      liveInputs.forEach((inp, i) => {
        if (zoomedInputs[i]) {
          if (inp.type === 'checkbox' || inp.type === 'radio') {
            zoomedInputs[i].checked = inp.checked;
          } else {
            zoomedInputs[i].value = inp.value;
          }
        }
      });

      // Mirror focused element outline
      if (document.activeElement && card.contains(document.activeElement)) {
        const allLive = Array.from(card.querySelectorAll('*'));
        const activeIndex = allLive.indexOf(document.activeElement);
        if (activeIndex !== -1) {
          const allZoomed = Array.from(zoomed.querySelectorAll('*'));
          if (allZoomed[activeIndex]) {
            allZoomed[activeIndex].classList.add('is-magnified-focus');
          }
        }
      }

      // Ensure outside floating button is completely removed from the zoom view
      const extraBtns = zoomed.querySelectorAll('.magnifier-outside-btn');
      extraBtns.forEach(b => b.remove());
    };

    syncLiveView();

    // Observe any dynamic mutations inside the live modal card (step changes, form typing, etc.)
    let observer = null;
    if (window.MutationObserver && modalCardRef.current) {
      observer = new MutationObserver(() => {
        syncLiveView();
      });
      observer.observe(modalCardRef.current, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['class', 'value', 'checked', 'style']
      });
    }

    // Mirror native text selection into the zoomed view with identical font metrics
    const syncSelectionHighlight = () => {
      const card = modalCardRef.current;
      const zoomed = zoomedViewRef.current;
      if (!card || !zoomed) return;

      const selection = window.getSelection();
      const selectedText = selection ? selection.toString() : '';

      // Reset previous mirror highlights
      const oldMarks = zoomed.querySelectorAll('.magnifier-highlight-mirror');
      oldMarks.forEach(mark => {
        const parent = mark.parentNode;
        if (parent) {
          parent.replaceChild(document.createTextNode(mark.textContent), mark);
          parent.normalize();
        }
      });

      if (!selectedText || !selectedText.trim()) return;

      const trimmed = selectedText.trim();
      const walker = document.createTreeWalker(zoomed, NodeFilter.SHOW_TEXT, null, false);
      const textNodes = [];
      let node;
      while ((node = walker.nextNode())) {
        if (node.nodeValue && node.nodeValue.includes(trimmed)) {
          textNodes.push(node);
        }
      }

      textNodes.forEach(textNode => {
        const parent = textNode.parentNode;
        if (parent && parent.nodeName !== 'SCRIPT' && parent.nodeName !== 'STYLE') {
          const val = textNode.nodeValue;
          const idx = val.indexOf(trimmed);
          if (idx !== -1) {
            const before = val.substring(0, idx);
            const match = val.substring(idx, idx + trimmed.length);
            const after = val.substring(idx + trimmed.length);

            const frag = document.createDocumentFragment();
            if (before) frag.appendChild(document.createTextNode(before));
            const span = document.createElement('span');
            span.className = 'magnifier-highlight-mirror';
            span.textContent = match;
            frag.appendChild(span);
            if (after) frag.appendChild(document.createTextNode(after));

            parent.replaceChild(frag, textNode);
          }
        }
      });
    };

    let lastX = 0;
    let lastY = 0;

    const updateLensPosition = (mouseX, mouseY) => {
      const card = modalCardRef.current;
      const overlay = magnifierOverlayRef.current;
      const clipViewport = clipViewportRef.current;
      const cardContainer = scaledCardContainerRef.current;
      const zoomedCard = zoomedViewRef.current;
      const bezel = lensRef.current;

      if (!card || !overlay || !clipViewport || !cardContainer || !zoomedCard || !bezel) return;

      const rect = card.getBoundingClientRect();

      // Check if mouse cursor is over the modal card
      const isInside = (
        mouseX >= Math.floor(rect.left) &&
        mouseX <= Math.ceil(rect.right) &&
        mouseY >= Math.floor(rect.top) &&
        mouseY <= Math.ceil(rect.bottom)
      );

      if (!isInside) {
        overlay.style.display = 'none';
        return;
      }

      // Display optical overlay
      overlay.style.display = 'block';

      // 1. Position card container at the exact viewport rect of the live modal
      cardContainer.style.left = `${rect.left}px`;
      cardContainer.style.top = `${rect.top}px`;
      cardContainer.style.width = `${rect.width}px`;
      cardContainer.style.height = `${rect.height}px`;

      // 2. Mirror dimensions and scroll position
      zoomedCard.style.width = `${rect.width}px`;
      zoomedCard.style.height = `${rect.height}px`;
      zoomedCard.scrollTop = card.scrollTop;

      // 3. Symmetrical Invariance Scaling:
      // Setting transform origin directly at (mouseX - rect.left, mouseY - rect.top)
      // guarantees that the point under the cursor never shifts a single pixel!
      const originX = mouseX - rect.left;
      const originY = mouseY - rect.top;
      cardContainer.style.transformOrigin = `${originX}px ${originY}px`;
      cardContainer.style.transform = `scale(${ZOOM_FACTOR})`;

      // 4. Circular Clip-Path around mouseX, mouseY
      const LENS_RADIUS = LENS_SIZE / 2; // 140px
      clipViewport.style.clipPath = `circle(${LENS_RADIUS}px at ${mouseX}px ${mouseY}px)`;

      // 5. Bezel Ring centered exactly at mouseX, mouseY
      bezel.style.left = `${mouseX}px`;
      bezel.style.top = `${mouseY}px`;

      // 6. Real-Time Hover Reflection: Mirror the hovered element state inside the magnified glass
      const hoveredElement = document.elementFromPoint(mouseX, mouseY);
      const interactiveTarget = hoveredElement ? hoveredElement.closest('.payment-option-btn, button, .btn') : null;

      const prevHovered = zoomedCard.querySelectorAll('.is-magnified-hover');
      prevHovered.forEach(el => el.classList.remove('is-magnified-hover'));

      if (interactiveTarget && card.contains(interactiveTarget)) {
        const liveElements = Array.from(card.querySelectorAll('.payment-option-btn, button, .btn'));
        const targetIndex = liveElements.indexOf(interactiveTarget);
        if (targetIndex !== -1) {
          const zoomedElements = Array.from(zoomedCard.querySelectorAll('.payment-option-btn, button, .btn'));
          if (zoomedElements[targetIndex]) {
            zoomedElements[targetIndex].classList.add('is-magnified-hover');
          }
        }
      }
    };

    const handlePointerMove = (e) => {
      lastX = e.clientX;
      lastY = e.clientY;
      updateLensPosition(lastX, lastY);
    };

    const handleCardScroll = () => {
      updateLensPosition(lastX, lastY);
    };

    const handleHideLens = () => {
      if (magnifierOverlayRef.current) magnifierOverlayRef.current.style.display = 'none';
    };

    window.addEventListener('mousemove', handlePointerMove, { passive: true, capture: true });
    document.addEventListener('selectionchange', syncSelectionHighlight);
    const cardEl = modalCardRef.current;
    if (cardEl) {
      cardEl.addEventListener('scroll', handleCardScroll, { passive: true });
      cardEl.addEventListener('input', syncLiveView, { passive: true });
      cardEl.addEventListener('change', syncLiveView, { passive: true });
      cardEl.addEventListener('focusin', syncLiveView, { passive: true });
      cardEl.addEventListener('focusout', syncLiveView, { passive: true });
    }
    window.addEventListener('mouseleave', handleHideLens);
    window.addEventListener('blur', handleHideLens);

    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('mousemove', handlePointerMove, { capture: true });
      document.removeEventListener('selectionchange', syncSelectionHighlight);
      if (cardEl) {
        cardEl.removeEventListener('scroll', handleCardScroll);
        cardEl.removeEventListener('input', syncLiveView);
        cardEl.removeEventListener('change', syncLiveView);
        cardEl.removeEventListener('focusin', syncLiveView);
        cardEl.removeEventListener('focusout', syncLiveView);
      }
      window.removeEventListener('mouseleave', handleHideLens);
      window.removeEventListener('blur', handleHideLens);
      if (magnifierOverlayRef.current) magnifierOverlayRef.current.style.display = 'none';
    };
  }, [magnifierActive, modalOpen, donateStep, gatewayStep]);

  const isPublic = role === ROLES.PUBLIC;
  const canDonate = role !== ROLES.ADMIN && camp.isActive;
  // Multi-Rail Breakdown & Segment Calculations (Calculates from history transactions, API railBreakdown, or fallback)
  const breakdown = useMemo(() => {
    // 1. If history is loaded and has records, dynamically compute live telemetry directly from actual ledger transactions
    if (Array.isArray(history) && history.length > 0) {
      let ethAmt = 0, ethCnt = 0;
      let gcashAmt = 0, gcashCnt = 0;
      let mayaAmt = 0, mayaCnt = 0;
      let bankAmt = 0, bankCnt = 0;

      history.forEach((tx) => {
        const amt = parseFloat(tx.rawAmount || tx.amount || 0) || 0;
        const hash = (tx.txHash || tx.Tx_Hash || '').toUpperCase();
        if (hash.startsWith('FIAT-GCAS') || hash.includes('GCASH')) {
          gcashAmt += amt;
          gcashCnt++;
        } else if (hash.startsWith('FIAT-MAYA') || hash.includes('MAYA')) {
          mayaAmt += amt;
          mayaCnt++;
        } else if (hash.startsWith('FIAT-BANK') || hash.startsWith('FIAT-CARD') || hash.startsWith('FIAT-CRED') || hash.includes('BANK') || hash.includes('CARD')) {
          bankAmt += amt;
          bankCnt++;
        } else {
          ethAmt += amt;
          ethCnt++;
        }
      });

      const totalTracked = ethAmt + gcashAmt + mayaAmt + bankAmt;
      const currentEth = parseFloat(camp.currentAmount || 0);
      if (currentEth > totalTracked) {
        ethAmt += (currentEth - totalTracked);
        if (ethCnt === 0) ethCnt = 1;
      }

      return {
        eth: { amount: ethAmt, php: Math.round(ethAmt * 170000), count: ethCnt },
        gcash: { amount: gcashAmt, php: Math.round(gcashAmt * 170000), count: gcashCnt },
        maya: { amount: mayaAmt, php: Math.round(mayaAmt * 170000), count: mayaCnt },
        bank: { amount: bankAmt, php: Math.round(bankAmt * 170000), count: bankCnt },
        totalRaisedEth: Math.max(totalTracked, currentEth),
        totalRaisedPhp: Math.round(Math.max(totalTracked, currentEth) * 170000),
        totalBackers: ethCnt + gcashCnt + mayaCnt + bankCnt
      };
    }

    // 2. If camp.railBreakdown is provided by API
    if (camp.railBreakdown && typeof camp.railBreakdown === 'object') {
      return camp.railBreakdown;
    }

    // 3. Fallback
    const currentEth = parseFloat(camp.currentAmount || 0);
    return {
      eth: { amount: currentEth, php: Math.round(currentEth * 170000), count: currentEth > 0 ? 1 : 0 },
      gcash: { amount: 0, php: 0, count: 0 },
      maya: { amount: 0, php: 0, count: 0 },
      bank: { amount: 0, php: 0, count: 0 },
      totalRaisedEth: currentEth,
      totalRaisedPhp: Math.round(currentEth * 170000),
      totalBackers: currentEth > 0 ? 1 : 0
    };
  }, [camp.railBreakdown, camp.currentAmount, history]);

  const totalRailRaised = (parseFloat(breakdown?.eth?.amount || 0)) + 
                          (parseFloat(breakdown?.gcash?.amount || 0)) + 
                          (parseFloat(breakdown?.maya?.amount || 0)) + 
                          (parseFloat(breakdown?.bank?.amount || 0));
  const displayCurrentEth = Math.max(parseFloat(camp.currentAmount || 0), parseFloat(breakdown?.totalRaisedEth || 0), totalRailRaised);
  const targetGoal = Math.max(0.0001, parseFloat(camp.targetAmount || 1));
  const currentTotal = Math.max(0.000001, displayCurrentEth);
  const pct = progressPct(displayCurrentEth, camp.targetAmount);
  const totalBarPct = Math.min(100, Math.max(0, (displayCurrentEth / targetGoal) * 100));

  // Compute segment widths on the bar proportional to target goal
  const rawSumPct = targetGoal > 0 ? (totalRailRaised / targetGoal) * 100 : 0;
  const scale = rawSumPct > 100 ? (100 / rawSumPct) : 1;
  const ethSegmentPct = ((parseFloat(breakdown?.eth?.amount || 0) / targetGoal) * 100) * scale;
  const gcashSegmentPct = ((parseFloat(breakdown?.gcash?.amount || 0) / targetGoal) * 100) * scale;
  const mayaSegmentPct = ((parseFloat(breakdown?.maya?.amount || 0) / targetGoal) * 100) * scale;
  const bankSegmentPct = ((parseFloat(breakdown?.bank?.amount || 0) / targetGoal) * 100) * scale;

  // Percentage shares of total funds raised (Strictly sums to 100%)
  const ethShare = currentTotal > 0 ? Math.round(((parseFloat(breakdown?.eth?.amount || 0)) / currentTotal) * 100) : 0;
  const gcashShare = currentTotal > 0 ? Math.round(((parseFloat(breakdown?.gcash?.amount || 0)) / currentTotal) * 100) : 0;
  const mayaShare = currentTotal > 0 ? Math.round(((parseFloat(breakdown?.maya?.amount || 0)) / currentTotal) * 100) : 0;
  const bankShare = currentTotal > 0 ? Math.round(((parseFloat(breakdown?.bank?.amount || 0)) / currentTotal) * 100) : 0;

  // Fixed 4-chip incremental donation amounts (+₱50, +₱100, +₱500, +₱1000)
  const presetIncrements = [50, 100, 500, 1000];

  // Who can deactivate?
  // Admin → any campaign; Moderator → only their own
  const isOwner = walletAddress?.toLowerCase() === camp.orgAddress?.toLowerCase();
  const canDeactivate =
    camp.isActive &&
    Boolean(contract) &&
    (role === ROLES.ADMIN || (role === ROLES.ORGANIZATION && isOwner));

  /* ── Checkout Modal Logic ─────────────────────── */
  const handleOpenCheckout = () => {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0)
      return showWarning('Please enter a valid amount greater than ₱0.', 'Invalid Donation Amount');
    setDonateStep(0); // Start at Payment Selector
    setCustomMsg('');
    setTxHash('');
    setIsAnonymous(false);
    setLegalConfirm(false);
    setModalOpen(true);
  };

  const handleConfirmDonate = async () => {
    try {
      setDonateStep(2); // Signature Phase
      const parsed = parseFloat(amount);
      const ethAmount = parsed / 170000; // Convert PHP to ETH

      // We limit to 18 decimals max to prevent ethers parsing errors
      const ethString = ethAmount.toFixed(18).replace(/\.?0+$/, '');
      const wei = ethers.parseEther(ethString);
      const msg = customMsg.trim() || 'Verified Web Portal Transaction';

      const tx = await contract.donateToCampaign(camp.id, msg, { value: wei });

      setDonateStep(3); // Mining Phase
      setTxHash(tx.hash);
      await tx.wait();

      try {
        const token = localStorage.getItem('bbdrts_token');
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        await fetch(`${apiUrl}/api/donations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && token !== 'null' ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            campaign_id: Number(camp.id),
            tx_hash: tx.hash,
            amount: ethAmount,
            is_anonymous: isAnonymous,
            wallet_address: walletAddress || ''
          })
        });
      } catch (err) {
        console.error("Failed to sync donation to backend:", err);
      }

      if (walletAddress) {
        globalDonorRegistry.recordDonation(walletAddress, ethAmount, parsed);
      }

      setDonateStep(4); // Success Phase
      onDonated?.();
      if (ledgerOpen) fetchHistory(true);
    } catch (err) {
      console.error(err);
      if (err.code !== 'ACTION_REJECTED') {
        let errMsg = err.reason || err.shortMessage || err.message;
        if (typeof errMsg === 'string' && (errMsg.includes('missing revert data') || errMsg.includes('CALL_EXCEPTION'))) {
          errMsg = 'Transaction reverted by the network. This usually means you have insufficient SepoliaETH for gas/value, or the contract rejected the amount.';
        }
        setModalOpen(false);
        setDeactivateModal({ show: true, step: 5, hash: '', error: `Donation failed: ${errMsg}` });
      } else {
        setModalOpen(false);
      }
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) return showWarning("File must be less than 2MB.", "File Too Large");
      const reader = new FileReader();
      reader.onloadend = () => setReceiptBase64(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleCardNumberChange = (e) => setCardNumber(e.target.value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim().substring(0, 19));
  const handleExpiryChange = (e) => {
    let inputVal = e.target.value;
    let digits = inputVal.replace(/\D/g, '').substring(0, 4);
    if (!digits) {
      setCardExpiry('');
      return;
    }

    if (digits.length === 1) {
      if (parseInt(digits, 10) > 1) {
        setCardExpiry('0' + digits + '/');
      } else {
        setCardExpiry(digits);
      }
      return;
    }

    let mm = parseInt(digits.substring(0, 2), 10);
    if (mm > 12) mm = 12;
    if (mm === 0) mm = 1;
    const mmStr = mm < 10 ? '0' + mm : '' + mm;

    if (digits.length === 2) {
      setCardExpiry(inputVal.length < cardExpiry.length ? mmStr : mmStr + '/');
    } else {
      setCardExpiry(mmStr + '/' + digits.substring(2, 4));
    }
  };

  const handleAutofillTestCard = () => {
    setCardNumber('1234 5678 9012 3456');
    setCardName('GESTER MACALDO');
    setCardExpiry('12/28');
    setCardCvv('888');
    setCardEmail('donor@relief-foundation.ph');
    setCardAddress('Ayala Avenue, Makati City');
    setCardCity('Makati');
    setCardState('Metro Manila');
    setCardZip('1226');
    setCardCountry('Philippines');
    showSuccess?.('Verified Demo Card credentials loaded!', 'Test Card Ready');
  };

  const handleClearCardForm = () => {
    setCardName('');
    setCardNumber('');
    setCardExpiry('');
    setCardCvv('');
    setCardEmail('');
    setCardAddress('');
    setCardCity('');
    setCardState('');
    setCardZip('');
    setIsFlipped(false);
    showInfo?.('Payment credentials cleared.', 'Form Reset');
  };

  const numForType = cardNumber.replace(/\D/g, '');
  let cardType = 'unknown';
  if (numForType.startsWith('4')) cardType = 'visa';
  else if (numForType.startsWith('5')) cardType = 'mastercard';
  else if (numForType.startsWith('34') || numForType.startsWith('37')) cardType = 'amex';

  const visaLogo = '/Visa.png';
  const mcLogo = '/Mastercard.png';
  const amexLogo = '/Amex.png';
  const activeLogo = cardType === 'visa' ? visaLogo : cardType === 'mastercard' ? mcLogo : cardType === 'amex' ? amexLogo : null;

  const getDisplayCardNumber = () => {
    const cleanNumber = cardNumber.replace(/\D/g, '');
    if (!cleanNumber) {
      return '•••• •••• •••• ••••';
    }
    let display = '';
    for (let i = 0; i < 16; i++) {
      if (i > 0 && i % 4 === 0) display += ' ';
      if (i < cleanNumber.length) {
        display += hideCardDetails && i < 12 ? '•' : cleanNumber[i];
      } else {
        display += '•';
      }
    }
    return display;
  };

  const displayCardName = hideCardDetails
    ? (cardName ? cardName.split(' ').map(n => n[0] ? n[0] + '••••' : '').join(' ') : 'CARDHOLDER NAME')
    : (cardName || 'CARDHOLDER NAME');

  const getDisplayCvv = () => {
    if (!cardCvv) return '---';
    if (hideCardDetails) return '•'.repeat(cardCvv.length);
    return cardCvv;
  };

  // Gateway Functions
  const handleGatewayNext = () => {
    if (gatewayMobile.length < 10) return;
    setGatewayLoading(true);
    setTimeout(() => {
      setGatewayLoading(false);
      setGatewayStep(2);
    }, 1500);
  };

  const handleAutofillMobile = () => {
    setGatewayMobile('9171234567');
    showSuccess?.('Demo Mobile (+63 917 123 4567) loaded!', 'Mobile Ready');
  };

  const handleAutofillOtp = () => {
    setGatewayOtp(['1', '2', '3', '4', '5', '6']);
    showSuccess?.('Demo OTP (123456) loaded!', 'OTP Ready');
  };

  const handleGatewayOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...gatewayOtp];
    newOtp[index] = value.substring(value.length - 1);
    setGatewayOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      document.getElementById(`gateway-otp-${index + 1}`)?.focus();
    }
  };

  const handleAutofillDemoReceipt = () => {
    const demoAmount = amount && parseFloat(amount) > 0 ? amount : '500';
    setAmount(demoAmount);
    const demoRef = `${Math.floor(1000 + Math.random() * 9000)} ${Math.floor(1000 + Math.random() * 9000)} ${Math.floor(1000 + Math.random() * 9000)}`;
    setRefNumber(demoRef);
    setGatewayRefNo(demoRef);

    const isMaya = gatewayMethod === 'Maya';
    const brandColor = isMaya ? '#00D68F' : '#007DFE';
    const brandName = isMaya ? 'Maya' : 'GCash';
    const dateStr = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 500" width="380" height="500" style="background:#0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <defs>
        <linearGradient id="headerGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${brandColor}" />
          <stop offset="100%" stop-color="${isMaya ? '#059669' : '#0052FF'}" />
        </linearGradient>
      </defs>
      <rect width="380" height="500" fill="#131d2e" rx="16" />
      <rect width="380" height="90" fill="url(#headerGrad)" rx="16" />
      <rect y="70" width="380" height="20" fill="url(#headerGrad)" />
      
      <text x="190" y="42" font-size="20" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="1">${brandName.toUpperCase()} EXPRESS SEND</text>
      <text x="190" y="66" font-size="12" font-weight="600" fill="rgba(255,255,255,0.9)" text-anchor="middle">Official Transaction Confirmation</text>

      <circle cx="190" cy="118" r="22" fill="#22c55e" />
      <path d="M 180 118 L 187 125 L 200 110" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />

      <text x="190" y="158" font-size="15" font-weight="800" fill="#ffffff" text-anchor="middle">Payment Sent Successfully</text>
      <text x="190" y="176" font-size="11" fill="#94a3b8" text-anchor="middle">${dateStr}</text>

      <rect x="25" y="192" width="330" height="66" rx="12" fill="#1e293b" stroke="rgba(255,255,255,0.08)" />
      <text x="190" y="216" font-size="10" font-weight="700" fill="#94a3b8" text-anchor="middle" letter-spacing="0.5">TOTAL AMOUNT PAID</text>
      <text x="190" y="246" font-size="24" font-weight="900" fill="${brandColor}" text-anchor="middle">₱${Number(demoAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</text>

      <rect x="25" y="270" width="330" height="150" rx="12" fill="#1e293b" stroke="rgba(255,255,255,0.08)" />
      
      <text x="45" y="296" font-size="11" fill="#94a3b8">Beneficiary Merchant:</text>
      <text x="335" y="296" font-size="11" font-weight="700" fill="#ffffff" text-anchor="end">BBD-RTS Relief Foundation</text>

      <text x="45" y="324" font-size="11" fill="#94a3b8">Merchant Account:</text>
      <text x="335" y="324" font-size="11" font-weight="700" fill="#ffffff" text-anchor="end">0917 890 1234</text>

      <text x="45" y="352" font-size="11" fill="#94a3b8">Campaign Purpose:</text>
      <text x="335" y="352" font-size="11" font-weight="700" fill="#38bdf8" text-anchor="end">${(camp.title || 'Disaster Relief').substring(0, 20)}...</text>

      <text x="45" y="380" font-size="11" fill="#94a3b8">Reference Number:</text>
      <text x="335" y="380" font-size="12" font-weight="900" fill="#22c55e" text-anchor="end" font-family="monospace">${demoRef}</text>

      <text x="45" y="406" font-size="11" fill="#94a3b8">Payment Channel:</text>
      <text x="335" y="406" font-size="11" font-weight="700" fill="#ffffff" text-anchor="end">${brandName} QR Ph</text>

      <text x="190" y="455" font-size="10" font-weight="700" fill="#64748b" text-anchor="middle">BANGKO SENTRAL NG PILIPINAS (BSP) COMPLIANT</text>
      <text x="190" y="472" font-size="9" fill="#475569" text-anchor="middle">Blockchain-Based Donation &amp; Relief Transparency System</text>
    </svg>`;

    const b64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    setReceiptBase64(b64);

    showSuccess?.(`Demo ${brandName} receipt, ₱${demoAmount} amount, and Ref #${demoRef} loaded! Ready to confirm.`, 'Demo Ready');
  };

  const handleReceiptUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      return showWarning("Receipt image must be under 8MB.", "File Too Large");
    }
    const reader = new FileReader();
    reader.onload = () => {
      setReceiptBase64(reader.result);
      showSuccess?.("Receipt screenshot uploaded successfully!", "Receipt Attached");
    };
    reader.readAsDataURL(file);
  };

  const verifyGatewayPayment = async () => {
    const finalAmount = parseFloat(amount || 0);
    if (!finalAmount || finalAmount <= 0) return showWarning("Please enter a valid amount greater than ₱0.", "Invalid Amount");
    const finalRef = (refNumber || gatewayRefNo || '').trim();
    if (!finalRef) return showWarning("Please enter the transaction reference number or use Demo Autofill.", "Missing Reference");
    if (!receiptBase64) return showWarning("Please upload your payment screenshot or click Demo Autofill.", "Missing Receipt");

    setGatewayLoading(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const token = localStorage.getItem('bbdrts_token');
      const res = await fetch(`${apiUrl}/api/donations/verify-mock-gateway`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && token !== 'null' ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          campaign_id: camp.id,
          amount: finalAmount,
          method: gatewayMethod || 'GCash',
          wallet_address: walletAddress || '',
          is_anonymous: isAnonymous,
          ref_no: finalRef,
          receipt_base64: receiptBase64
        })
      });

      if (!res.ok) throw new Error('Payment verification failed');
      const data = await res.json();
      setTxHash(data.tx_hash || `FIAT-${(gatewayMethod || 'GCAS').toUpperCase().substring(0,4)}-${finalRef}`);

      setGatewayStep(4); // Success step
      if (walletAddress) {
        globalDonorRegistry.recordDonation(walletAddress, finalAmount / 170000, finalAmount);
      }
      setTimeout(() => {
        setGatewayLoading(false);
        setDonateStep(4); // Master Success Phase of CampaignCard
        onDonated?.(); // Refresh
        fetchHistory(true); // Refresh ledger
      }, 1600);

    } catch (err) {
      console.error(err);
      showWarning('Payment failed to process: ' + err.message, 'Gateway Error');
      setGatewayLoading(false);
    }
  };

  const getGatewayThemeColor = () => '#22c55e';
  const getGatewayThemeBg = () => 'var(--bg-card, #1a1a1a)';
  const getGatewayThemeText = () => 'var(--text-primary, #ffffff)';

  const submitManualDonation = async (paymentMethod) => {
    if (paymentMethod !== 'Credit Card' && !receiptBase64) return showWarning("Please upload a screenshot of your receipt before submitting.", "Missing Receipt");
    setIsUploading(true);
    try {
      // Simulate real-world gateway processing time
      await new Promise(resolve => setTimeout(resolve, 1800));

      const token = localStorage.getItem('bbdrts_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

      if (paymentMethod === 'Credit Card') {
        const res = await fetch(`${apiUrl}/api/donations/verify-mock-gateway`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && token !== 'null' ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            campaign_id: camp.id,
            amount: amount,
            method: 'Credit Card',
            wallet_address: walletAddress || '',
            is_anonymous: isAnonymous
          })
        });
        if (!res.ok) throw new Error('Card payment authorization failed');
        const data = await res.json();
        setTxHash(data.tx_hash || 'FIAT-CARD');
      } else {
        const parsed = parseFloat(amount);
        const ethAmount = parsed / 170000;
        const response = await fetch(`${apiUrl}/api/manual-donations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token && token !== 'null' ? { 'Authorization': `Bearer ${token}` } : {}) },
          body: JSON.stringify({ campaign_id: Number(camp.id), amount: ethAmount, payment_method: paymentMethod, receipt_base64: receiptBase64 })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to submit');
      }

      setDonateStep(4); // Success Phase
      onDonated?.();
      fetchHistory(true);
    } catch (e) {
      showWarning(e.message, "Submission Failed");
    } finally {
      setIsUploading(false);
    }
  };

  /* ── Deactivate Campaign ──────────────────────── */
  const triggerDeactivate = () => {
    setDeactivateModal({ show: true, step: 1, hash: '', error: '' });
  };

  const handleDeactivate = async () => {
    try {
      setDeactivating(true);
      setDeactivateModal({ show: true, step: 2, hash: '', error: '' });
      const tx = await contract.deactivateCampaign(camp.id);

      setDeactivateModal({ show: true, step: 3, hash: tx.hash, error: '' });
      await tx.wait();

      setDeactivateModal({ show: true, step: 4, hash: tx.hash, error: '' });
      onDeactivated?.();
    } catch (err) {
      console.error(err);
      if (err.code !== 'ACTION_REJECTED') {
        setDeactivateModal({ show: true, step: 5, hash: '', error: `Deactivation failed: ${err.reason || err.message}` });
      } else {
        setDeactivateModal({ show: false, step: 0, hash: '', error: '' });
      }
    } finally {
      setDeactivating(false);
    }
  };

  /* ── Ledger ───────────────────────────────────── */
  const fetchHistory = async (force = false) => {
    if (!force && history !== null) return;
    try {
      setHistoryLoading(true);
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      let list = [];

      try {
        const res = await fetch(`${apiUrl}/api/campaigns/${camp.id}/donations`);
        if (res.ok) {
          const data = await res.json();
          list = data.map((d) => {
            const rawEth = parseFloat(d.Amount || 0);
            const ethStr = rawEth < 0.0001
              ? rawEth.toFixed(7).replace(/\.?0+$/, '')
              : rawEth.toFixed(6).replace(/\.?0+$/, '');
            const approxPhp = Math.round(rawEth * 170000);
            const globalEth = d.globalTotalEth !== undefined && d.globalTotalEth !== null
              ? parseFloat(d.globalTotalEth)
              : rawEth;
            const globalPhp = Math.round(globalEth * 170000);

            if (d.wallet && d.wallet !== '0x0000000000000000000000000000000000000000') {
              globalDonorRegistry.set(d.wallet, {
                totalEth: globalEth,
                totalPhp: globalPhp,
                donorName: d.donorName
              });
            }
            if (d.donorId) {
              globalDonorRegistry.set(`id_${d.donorId}`, {
                totalEth: globalEth,
                totalPhp: globalPhp,
                donorName: d.donorName
              });
            }

            return {
              donor: d.Is_Anonymous ? '🕵️ Anonymous' : (d.donorName || 'Verified Supporter'),
              wallet: d.wallet,
              donorId: d.donorId,
              isAnonymous: Boolean(d.Is_Anonymous),
              amount: ethStr,
              rawAmount: rawEth,
              phpAmount: approxPhp,
              globalAmountEth: globalEth,
              globalAmountPhp: globalPhp,
              txHash: d.Tx_Hash,
              createdAt: d.createdAt
            };
          });
        }
      } catch (dbErr) {
        console.warn('DB ledger fetch warning:', dbErr);
      }

      // Check on-chain DonationReceived events to catch real-time MetaMask donations immediately
      if (contract) {
        try {
          const filter = contract.filters.DonationReceived(camp.id);
          const events = await contract.queryFilter(filter, -9000, 'latest');
          for (const ev of events) {
            const txHash = ev.transactionHash;
            const donorAddr = ev.args ? ev.args[1] : '';
            const weiAmt = ev.args ? ev.args[2] : 0n;
            const rawEth = parseFloat(ethers.formatEther(weiAmt));
            const ethAmt = rawEth < 0.0001
              ? rawEth.toFixed(7).replace(/\.?0+$/, '')
              : rawEth.toFixed(6).replace(/\.?0+$/, '');
            const approxPhp = Math.round(rawEth * 170000);

            if (txHash && !list.some(item => (item.txHash || '').toLowerCase() === txHash.toLowerCase())) {
              const regStats = donorAddr ? globalDonorRegistry.get(donorAddr) : null;
              const gEth = regStats?.totalEth || rawEth;
              const gPhp = regStats?.totalPhp || approxPhp;
              list.unshift({
                donor: `${donorAddr.substring(0, 6)}...${donorAddr.substring(donorAddr.length - 4)}`,
                wallet: donorAddr,
                isAnonymous: false,
                amount: ethAmt,
                rawAmount: rawEth,
                phpAmount: approxPhp,
                globalAmountEth: gEth,
                globalAmountPhp: gPhp,
                txHash: txHash,
              });

              // Auto-sync this on-chain donation to the backend database
              fetch(`${apiUrl}/api/donations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  campaign_id: Number(camp.id),
                  tx_hash: txHash,
                  amount: parseFloat(ethers.formatEther(weiAmt)),
                  is_anonymous: false,
                  wallet_address: donorAddr
                })
              }).catch(() => null);
            }
          }
        } catch (onChainFilterErr) {
          console.warn('On-chain event log query warning:', onChainFilterErr);
        }
      }

      setHistory(list);
    } catch (err) {
      console.error('Ledger fetch error:', err);
      if (!history) setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const toggleLedger = () => {
    const opening = !ledgerOpen;
    setLedgerOpen(opening);
    if (opening) fetchHistory(true);
  };

  // Auto-fetch transaction history on mount so multi-rail breakdown and public ledger telemetry are immediately populated
  useEffect(() => {
    if (camp.id) {
      fetchHistory();
    }
  }, [camp.id]);

  /* ── Render ───────────────────────────────────── */
  return (
    <div className={`card glow campaign-card fade-in ${!camp.isActive ? 'campaign-closed' : ''} ${showRailTelemetry ? 'telemetry-dropdown-active' : ''}`}>
      <div className="campaign-card-body">

        {/* ── Left: Campaign Cover Media ── */}
        <div className="campaign-media">
          <img
            src={coverData.imageUrl}
            alt={camp.title}
            className="campaign-media-img"
            loading="lazy"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=600&q=80';
            }}
          />
          <div className="campaign-media-overlay" />

          {/* Top Category Tag Capsule */}
          <div className="campaign-media-tag-top">
            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>{coverData.categoryIcon}</span>
            <span>{coverData.categoryTag}</span>
          </div>

          {/* Closed State Banner Overlay */}
          {!camp.isActive && (
            <div className="campaign-media-closed-badge">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>lock</span>
              <span>CONCLUDED</span>
            </div>
          )}
        </div>

        {/* ── Center: Info ── */}
        <div className="campaign-info">
          {/* Top Meta Row: Category Pill + Status Badge */}
          <div className="campaign-header-top">
            <div className={`campaign-category-pill ${catInfo.colorClass}`}>
              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>{catInfo.icon}</span>
              <span>{catInfo.prefix}-00{camp.id} • {catInfo.label}</span>
            </div>

            <span className={`badge ${camp.isActive ? 'badge-active' : 'badge-closed'}`}>
              <span className="status-dot" />
              {camp.isActive ? 'Active' : 'Closed'}
            </span>

            {isOwner && role !== ROLES.DONOR && (
              <span className="badge badge-info" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                Your Campaign
              </span>
            )}
          </div>

          {/* Prominent Clean Title */}
          <h3 className="campaign-title">
            {formatCampaignTitle(camp.title, camp.id)}
          </h3>

          {/* Managing Org Attribution & Operation Area Location Row */}
          <div className="campaign-org-row">
            <button
              type="button"
              className="campaign-org-badge"
              title="Click to view verified NGO institutional profile & all campaigns"
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenNgoProfile) {
                  onOpenNgoProfile(camp.orgId || camp.orgAddress || camp.orgName || 3);
                }
              }}
            >
              <span className="material-symbols-outlined campaign-org-icon">domain</span>
              <span className="campaign-org-name">{getOrgDisplayName(camp.orgAddress, camp.orgName, camp.id)}</span>
              <span className="campaign-org-verified-badge" title="SEC Verified NGO">
                <span className="material-symbols-outlined">verified</span>
              </span>
              <span className="material-symbols-outlined campaign-org-arrow">chevron_right</span>
            </button>

            {coverData.locationTag && (
              <button
                type="button"
                className="campaign-location-badge"
                title={`Relief Operation Area: ${coverData.locationTag} • Click to view GPS Audit & Map`}
                onClick={(e) => {
                  e.stopPropagation();
                  setDetailsOpen(true);
                }}
              >
                <span className="material-symbols-outlined campaign-location-icon">location_on</span>
                <span className="campaign-location-text">{coverData.locationTag}</span>
              </button>
            )}
          </div>

          {/* Multi-Rail Interactive Progress Bar */}
          <div className="multi-rail-wrapper" ref={railDropdownRef}>
            {/* Header: Goal & Total Percent (Clickable trigger for dropdown) */}
            <div className="multi-rail-header">
              <span className="multi-rail-goal-text">
                <strong>₱{((breakdown.gcash.php || 0) + (breakdown.maya.php || 0) + (breakdown.bank.php || 0) + (breakdown.eth.php || 0)).toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong> of ₱{(parseFloat(camp.targetAmount || 0) * 170000).toLocaleString('en-US', { maximumFractionDigits: 0 })} goal
              </span>

              <div className="multi-rail-header-right">
                <button
                  type="button"
                  className={`multi-rail-pct-badge ${showRailTelemetry ? 'is-active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowRailTelemetry(prev => !prev);
                  }}
                  title="Click to toggle payment rail breakdown"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>insights</span>
                  {pct}% funded
                </button>

                {/* Dropdown Popup anchored cleanly below % funded button */}
                {showRailTelemetry && (
                  <div className="multi-rail-dropdown-popup" onClick={(e) => e.stopPropagation()}>
                    <div className="dropdown-popup-header">
                      <div className="drawer-header-left">
                        <div className="drawer-pulse-dot"></div>
                        <span>Funding Sources</span>
                        <span className="drawer-backers-badge">
                          👥 {breakdown.totalBackers || 0}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="dropdown-popup-close-btn"
                        onClick={(e) => { e.stopPropagation(); setShowRailTelemetry(false); }}
                        title="Close breakdown"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>close</span>
                      </button>
                    </div>

                    <div className="drawer-compact-list">
                      <div className="drawer-compact-row">
                        <div className="drawer-compact-left">
                          <span className="drawer-compact-pip" style={{ background: '#22c55e' }}></span>
                          <span className="drawer-compact-name">Ethereum</span>
                        </div>
                        <div className="drawer-compact-right">
                          <span className="drawer-compact-val">{formatEthAmt(breakdown.eth.amount)} ETH</span>
                          <span className="drawer-compact-pct">{ethShare}%</span>
                        </div>
                      </div>
                      <div className="drawer-compact-row">
                        <div className="drawer-compact-left">
                          <span className="drawer-compact-pip" style={{ background: '#38bdf8' }}></span>
                          <span className="drawer-compact-name">GCash</span>
                        </div>
                        <div className="drawer-compact-right">
                          <span className="drawer-compact-val">₱{breakdown.gcash.php.toLocaleString()}</span>
                          <span className="drawer-compact-pct">{gcashShare}%</span>
                        </div>
                      </div>
                      <div className="drawer-compact-row">
                        <div className="drawer-compact-left">
                          <span className="drawer-compact-pip" style={{ background: '#10b981' }}></span>
                          <span className="drawer-compact-name">Maya</span>
                        </div>
                        <div className="drawer-compact-right">
                          <span className="drawer-compact-val">₱{breakdown.maya.php.toLocaleString()}</span>
                          <span className="drawer-compact-pct">{mayaShare}%</span>
                        </div>
                      </div>
                      <div className="drawer-compact-row">
                        <div className="drawer-compact-left">
                          <span className="drawer-compact-pip" style={{ background: '#a855f7' }}></span>
                          <span className="drawer-compact-name">Bank / Card</span>
                        </div>
                        <div className="drawer-compact-right">
                          <span className="drawer-compact-val">₱{breakdown.bank.php.toLocaleString()}</span>
                          <span className="drawer-compact-pct">{bankShare}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="drawer-compact-footer">
                      <div className="drawer-compact-status">
                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>verified_user</span>
                        <span>Cross-Ledger Verified</span>
                      </div>
                      <button type="button" className="drawer-ledger-link" onClick={() => { setLedgerOpen(true); fetchHistory(true); }}>
                        <span>Ledger</span>
                        <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>arrow_forward</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Segmented Multi-Rail Track with Direct Segment Tooltips */}
            <div 
              className="multi-rail-track-wrap"
              onClick={(e) => {
                e.stopPropagation();
                setShowRailTelemetry(prev => !prev);
              }}
              title="Click to view payment rail breakdown"
            >
              <div className="multi-rail-track-inner">
                {ethSegmentPct > 0 && (
                  <div 
                    className="multi-rail-segment rail-segment-eth" 
                    style={{ width: `${ethSegmentPct}%` }}
                    onMouseEnter={() => setHoveredRail('eth')}
                    onMouseLeave={() => setHoveredRail(null)}
                  />
                )}
                {gcashSegmentPct > 0 && (
                  <div 
                    className="multi-rail-segment rail-segment-gcash" 
                    style={{ width: `${gcashSegmentPct}%` }}
                    onMouseEnter={() => setHoveredRail('gcash')}
                    onMouseLeave={() => setHoveredRail(null)}
                  />
                )}
                {mayaSegmentPct > 0 && (
                  <div 
                    className="multi-rail-segment rail-segment-maya" 
                    style={{ width: `${mayaSegmentPct}%` }}
                    onMouseEnter={() => setHoveredRail('maya')}
                    onMouseLeave={() => setHoveredRail(null)}
                  />
                )}
                {bankSegmentPct > 0 && (
                  <div 
                    className="multi-rail-segment rail-segment-bank" 
                    style={{ width: `${bankSegmentPct}%` }}
                    onMouseEnter={() => setHoveredRail('bank')}
                    onMouseLeave={() => setHoveredRail(null)}
                  />
                )}
                {totalBarPct === 0 && (
                  <div className="multi-rail-segment" style={{ width: '100%', background: 'transparent' }} />
                )}
              </div>

              {/* Direct Segment Tooltips Positioned Right Above The Active Segment */}
              {hoveredRail === 'eth' && (
                <div 
                  className="rail-pill-tooltip rail-pill-tooltip-eth is-visible"
                  style={{ left: `${Math.max(12, Math.min(88, ethSegmentPct / 2))}%`, bottom: 'calc(100% + 8px)' }}
                >
                  <div className="rpt-header"><span className="rpt-pip" style={{ background: '#22c55e' }}></span>Ethereum</div>
                  <div className="rpt-amount" style={{ color: '#22c55e' }}>{formatEthAmt(breakdown.eth.amount)} ETH</div>
                  <div className="rpt-sub">≈ ₱{breakdown.eth.php.toLocaleString()}</div>
                  <div className="rpt-meta">{breakdown.eth.count || 0} on-chain tx{breakdown.eth.count !== 1 ? 's' : ''} · {ethShare}% of total</div>
                </div>
              )}
              {hoveredRail === 'gcash' && (
                <div 
                  className="rail-pill-tooltip rail-pill-tooltip-gcash is-visible"
                  style={{ left: `${Math.max(12, Math.min(88, ethSegmentPct + (gcashSegmentPct / 2)))}%`, bottom: 'calc(100% + 8px)' }}
                >
                  <div className="rpt-header"><span className="rpt-pip" style={{ background: '#38bdf8' }}></span>GCash</div>
                  <div className="rpt-amount" style={{ color: '#38bdf8' }}>₱{breakdown.gcash.php.toLocaleString()}</div>
                  <div className="rpt-sub">Received in Philippine Peso</div>
                  <div className="rpt-meta">{breakdown.gcash.count || 0} donor{breakdown.gcash.count !== 1 ? 's' : ''} · {gcashShare}% of total</div>
                </div>
              )}
              {hoveredRail === 'maya' && (
                <div 
                  className="rail-pill-tooltip rail-pill-tooltip-maya is-visible"
                  style={{ left: `${Math.max(12, Math.min(88, ethSegmentPct + gcashSegmentPct + (mayaSegmentPct / 2)))}%`, bottom: 'calc(100% + 8px)' }}
                >
                  <div className="rpt-header"><span className="rpt-pip" style={{ background: '#10b981' }}></span>Maya</div>
                  <div className="rpt-amount" style={{ color: '#10b981' }}>₱{breakdown.maya.php.toLocaleString()}</div>
                  <div className="rpt-sub">Received in Philippine Peso</div>
                  <div className="rpt-meta">{breakdown.maya.count || 0} donor{breakdown.maya.count !== 1 ? 's' : ''} · {mayaShare}% of total</div>
                </div>
              )}
              {hoveredRail === 'bank' && (
                <div 
                  className="rail-pill-tooltip rail-pill-tooltip-bank is-visible"
                  style={{ left: `${Math.max(12, Math.min(88, ethSegmentPct + gcashSegmentPct + mayaSegmentPct + (bankSegmentPct / 2)))}%`, bottom: 'calc(100% + 8px)' }}
                >
                  <div className="rpt-header"><span className="rpt-pip" style={{ background: '#a855f7' }}></span>Bank / Card</div>
                  <div className="rpt-amount" style={{ color: '#a855f7' }}>₱{breakdown.bank.php.toLocaleString()}</div>
                  <div className="rpt-sub">Received in Philippine Peso</div>
                  <div className="rpt-meta">{breakdown.bank.count || 0} deposit{breakdown.bank.count !== 1 ? 's' : ''} · {bankShare}% of total</div>
                </div>
              )}
            </div>
          </div>

          {/* Amounts: Uniform 3-Box Grid (Raised, Target Goal, Tracking ID) */}
          {(() => {
            const totalPhp = (breakdown.gcash.php || 0) + (breakdown.maya.php || 0) + (breakdown.bank.php || 0) + (breakdown.eth.php || 0);
            const targetPhp = parseFloat(camp.targetAmount || 0) * 170000;
            const ethAmt = breakdown.eth.amount ? formatEthAmt(breakdown.eth.amount) : '0';
            return (
              <div className="campaign-amounts">
                <div
                  className="amount-block"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setShowRailTelemetry(prev => !prev)}
                  title={`Click to view funding sources (${ethAmt} ETH on-chain)`}
                >
                  <span className="amount-label">Raised</span>
                  <span className="amount-value accent">
                    ₱{totalPhp.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div
                  className="amount-block"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setShowRailTelemetry(prev => !prev)}
                  title="Click to view funding sources"
                >
                  <span className="amount-label">Target Goal</span>
                  <span className="amount-value">
                    ₱{targetPhp.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="amount-block">
                  <span className="amount-label">Tracking ID</span>
                  <span className="amount-value" style={{ color: 'var(--text-secondary)' }}>
                    #{camp.id}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Campaign Tags Row */}
          {campaignTags && campaignTags.length > 0 && (
            <div className="campaign-tags-row">
              {campaignTags.map((tag, idx) => (
                <span key={idx} className="campaign-tag-pill">
                  #{tag.replace(/^#/, '')}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Actions ── */}
        <div className="campaign-actions">
          {role === ROLES.ADMIN ? (
            <p style={{ fontSize: '0.78rem', color: 'var(--warning)', textAlign: 'center', padding: '8px', border: '1px solid rgba(255,180,0,0.2)', borderRadius: '8px', background: 'rgba(255,180,0,0.05)' }}>
              Administrative accounts cannot execute financial transactions. Switch to a Donor or NGO account.
            </p>
          ) : (
            <div className="donate-box-card">
              <div className="donate-box-header" style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--accent)' }}>volunteer_activism</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Contribution
                  </span>
                </div>
                {amount && Number(amount) > 0 ? (
                  <button
                    type="button"
                    onClick={() => setAmount('')}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.72rem', cursor: 'pointer', padding: 0 }}
                  >
                    Clear ✕
                  </button>
                ) : null}
              </div>

              <div className="donate-row">
                <div className="donate-input-wrapper">
                  <span className="donate-peso-prefix">₱</span>
                  <input
                    className="donate-input-field"
                    type="number"
                    step="1"
                    min="0"
                    placeholder="Enter amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={!canDonate}
                  />

                  {/* Floating Focus Popover with 4 Tailored Quick Add Chips */}
                  <div className="donate-focus-popover">
                    <div className="donate-popover-title">Quick Add Amount:</div>
                    <div className="donate-presets-row">
                      {presetIncrements.map((inc) => (
                        <button
                          key={inc}
                          type="button"
                          className="donate-preset-chip"
                          onMouseDown={(e) => {
                            e.preventDefault(); // Prevent input blur
                            setAmount(prev => {
                              const current = Number(prev) || 0;
                              return String(current + inc);
                            });
                          }}
                          disabled={!canDonate}
                          title={`Add ₱${inc}`}
                        >
                          +₱{inc >= 1000 ? `${inc / 1000}k` : inc}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  className="btn btn-primary donate-cta-btn"
                  onClick={handleOpenCheckout}
                  disabled={!canDonate}
                >
                  <span>Donate</span>
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>arrow_forward</span>
                </button>
              </div>

              {!camp.isActive && (
                <p style={{ fontSize: '0.74rem', color: 'var(--danger)', textAlign: 'center', margin: 0 }}>
                  This campaign is closed to donations.
                </p>
              )}
            </div>
          )}

          <div className="campaign-actions-secondary-btns">
            <button
              className="btn btn-outline btn-sm btn-full"
              onClick={() => setDetailsOpen(true)}
              style={{
                background: 'var(--bg-input, rgba(0,0,0,0.2))',
                borderColor: 'var(--border, rgba(56, 189, 248, 0.4))',
                color: '#38bdf8',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>info</span>
              <span>Details & Map</span>
            </button>

            <button className="btn btn-ghost btn-sm btn-full" onClick={toggleLedger}>
              {ledgerOpen ? '▲ Hide Ledger' : '▼ Public Ledger'}
            </button>
          </div>

          {/* Deactivate button — only for eligible roles */}
          {canDeactivate && (
            <button
              className="btn btn-ghost btn-sm btn-full"
              onClick={triggerDeactivate}
              disabled={deactivating}
              style={{ color: 'var(--danger)', borderColor: 'rgba(255,78,106,0.3)', marginTop: '4px' }}
            >
              {deactivating ? <><div className="spinner" /> Confirming…</> : '🔴 Deactivate Campaign'}
            </button>
          )}
        </div>
      </div>

      {/* ── Public Transaction Ledger Panel ── */}
      {ledgerOpen && (
        <div className="ledger-panel">
          <div className="ledger-header">
            <div className="ledger-header-left">
              <span className="material-symbols-outlined ledger-header-icon">verified_user</span>
              <span className="ledger-header-title">Public Blockchain Ledger — Campaign #{camp.id}</span>
            </div>
            <div className="ledger-header-right">
              <span className="ledger-header-note">
                Immutable, tamper-proof receipts verifiable on Sepolia Etherscan
              </span>
            </div>
          </div>

          {historyLoading ? (
            <div className="ledger-empty">
              <div className="spinner spinner-light" />
              <span>Querying Sepolia blockchain events…</span>
            </div>
          ) : !history || history.length === 0 ? (
            <div className="ledger-empty">
              <span className="material-symbols-outlined" style={{ fontSize: '26px', color: 'var(--text-muted)' }}>inbox</span>
              <span>No donations recorded for this campaign yet.</span>
            </div>
          ) : (
            <div className="ledger-list">
              {history.map((rec, idx) => (
                <div key={idx} className="ledger-record-card">
                  {/* Top Row: Donor info on the left, Amount on the right */}
                  <div className="ledger-record-top">
                    <div className="ledger-donor-meta">
                      <div className="ledger-avatar-badge">
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                          {rec.isAnonymous ? 'visibility_off' : 'person'}
                        </span>
                      </div>
                      <div className="ledger-donor-text">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span className="ledger-donor-name">
                            {rec.isAnonymous 
                              ? '🕵️ Anonymous Patron' 
                              : (rec.donor && !rec.donor.includes('@') 
                                  ? rec.donor 
                                  : (rec.donor ? rec.donor.split('@')[0].replace(/[\._\d]/g, ' ').trim().split(' ').filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Verified Donor' : 'Verified Donor')
                                )
                            }
                          </span>
                          <DonorBadge
                            size="sm"
                            donorId={rec.donorId}
                            walletAddress={rec.wallet}
                            amountEth={rec.globalAmountEth}
                            amountPhp={rec.globalAmountPhp}
                            showLabel={false}
                            showTooltip={true}
                            showProgress={false}
                          />
                        </div>
                        {rec.wallet && !rec.isAnonymous && (
                          <span className="ledger-wallet-tag" title={rec.wallet}>
                            {shortAddr(rec.wallet)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="ledger-amount-meta">
                      <span className="ledger-amount-eth">+{rec.amount} ETH</span>
                      <span className="ledger-amount-php">
                        ≈ ₱{(rec.phpAmount || Math.round((rec.rawAmount || parseFloat(rec.amount || 0)) * 170000)).toLocaleString('en-US')} PHP
                      </span>
                    </div>
                  </div>

                  {/* Bottom Row: On-chain Verification & Etherscan Link vs Off-Chain Gateway Audit */}
                  <div className="ledger-record-bottom">
                    {rec.txHash?.startsWith('FIAT-') ? (
                      <>
                        <div className="ledger-verified-chip" style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.3)' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#38bdf8' }}>account_balance_wallet</span>
                          <span>Off-Chain Gateway Audit</span>
                        </div>
                        <div className="ledger-proof-link" style={{ cursor: 'default', background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)' }} title="Gateway Audit Receipt">
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>receipt_long</span>
                          <span className="ledger-hash-text">{rec.txHash}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="ledger-verified-chip">
                          <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--accent)' }}>verified</span>
                          <span>Verified On-Chain</span>
                        </div>
                        <a
                          href={`${SEPOLIA_EXPLORER}${rec.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="ledger-proof-link"
                          title="Inspect Transaction on Sepolia Etherscan"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>receipt</span>
                          <span className="ledger-hash-text">{rec.txHash ? `${rec.txHash.slice(0, 16)}...${rec.txHash.slice(-10)}` : 'Proof'}</span>
                          <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>open_in_new</span>
                        </a>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Premium Checkout Modal ── */}
      {modalOpen && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(5, 7, 12, 0.82)', backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999
        }} className="fade-in">

          {/* Sibling container wrapper so outside button floats truly outside the card */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start' }}>

            <div
              ref={modalCardRef}
              className="card bounce-in"
              style={{
                position: 'relative',
                width: (donateStep === 6 || donateStep === 7) ? '880px' : '500px',
                maxWidth: '94vw',
                maxHeight: '92vh',
                overflowY: 'auto',
                padding: '24px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-card, 0 25px 50px -12px rgba(0, 0, 0, 0.7))',
                borderRadius: '18px',
                transition: 'width 0.25s ease'
              }}
            >

              {/* ── STEP 0: Multi-Rail Payment Gateway Selector (Territory: Full Modal) ── */}
              {donateStep === 0 && (
                <div className="fade-in" style={{ position: 'relative' }}>

                  {/* Header with Close Button inside the main container */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#22c55e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>lock</span>
                        Institutional Contribution Gateway
                      </div>
                      <h2 style={{ margin: 0, fontSize: '1.3rem', color: 'var(--text-primary, #fff)', fontWeight: 800 }}>
                        Select Payment Method
                      </h2>
                    </div>
                    <button
                      onClick={() => {
                        setMagnifierActive(false);
                        setModalOpen(false);
                      }}
                      style={{ background: 'var(--bg-input, rgba(255,255,255,0.05))', border: '1px solid var(--border, rgba(255,255,255,0.1))', color: 'var(--text-muted, #94a3b8)', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Close dialog"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Order Context Summary Banner */}
                  <div className="payment-order-summary-card">
                    <div style={{ flex: 1, minWidth: '180px' }}>
                      <div className="payment-order-summary-title">{camp.title}</div>
                      <div className="payment-order-summary-org">
                        Beneficiary: <strong style={{ color: 'var(--text-secondary, #cbd5e1)' }}>{getOrgDisplayName(camp)}</strong>
                      </div>
                    </div>
                    <div className="payment-amount-capsule">
                      <div className="payment-amount-php">₱{Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                      <div className="payment-amount-eth">≈ {((Number(amount || 0)) / 170000).toFixed(5)} ETH</div>
                    </div>
                  </div>

                  <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.78rem', margin: '0 0 14px 2px' }}>
                    Choose how you would like to securely transfer your disaster relief aid:
                  </p>

                  {/* 4 Dedicated Payment Rails */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>

                    {/* Option 1: Web3 MetaMask */}
                    <button
                      onClick={() => {
                        if (!contract) return showWarning("MetaMask is not actively connected. Please connect your wallet first.", "Wallet Not Connected");
                        setDonateStep(1);
                      }}
                      className="payment-option-btn"
                    >
                      <div className="payment-option-icon-box" style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                        🦊
                      </div>
                      <div className="payment-option-meta">
                        <div className="payment-option-title-row">
                          <span className="payment-option-title">Web3 MetaMask Key</span>
                          <span className="payment-option-badge">100% On-Chain</span>
                        </div>
                        <div className="payment-option-desc">Direct Sepolia smart contract dispatch & immutable blockchain ledger entry</div>
                      </div>
                      <span className="material-symbols-outlined" style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '20px' }}>chevron_right</span>
                    </button>

                    {/* Option 2: GCash E-Wallet */}
                    <button
                      onClick={() => {
                        setGatewayMethod('GCash');
                        setGatewayStep(0);
                        setGatewayMobile('');
                        setGatewayOtp(['', '', '', '', '', '']);
                        setGatewayRefNo(`GCAS-${Math.floor(Math.random() * 1000000)}`);
                        setDonateStep(7);
                      }}
                      className="payment-option-btn"
                    >
                      <div className="payment-option-icon-box" style={{ background: '#0052FF', color: '#fff', fontWeight: 900 }}>
                        G
                      </div>
                      <div className="payment-option-meta">
                        <div className="payment-option-title-row">
                          <span className="payment-option-title">GCash E-Wallet</span>
                          <span className="payment-option-badge" style={{ background: 'rgba(0, 82, 255, 0.15)', color: '#38bdf8', borderColor: 'rgba(0, 82, 255, 0.3)' }}>Instant QR / OTP</span>
                        </div>
                        <div className="payment-option-desc">Fast contactless scan via QR Ph or phone authentication with instant receipt</div>
                      </div>
                      <span className="material-symbols-outlined" style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '20px' }}>chevron_right</span>
                    </button>

                    {/* Option 3: Maya (PayMaya) */}
                    <button
                      onClick={() => {
                        setGatewayMethod('Maya');
                        setGatewayStep(0);
                        setGatewayMobile('');
                        setGatewayOtp(['', '', '', '', '', '']);
                        setGatewayRefNo(`MAYA-${Math.floor(Math.random() * 1000000)}`);
                        setDonateStep(7);
                      }}
                      className="payment-option-btn"
                    >
                      <div className="payment-option-icon-box" style={{ background: '#00D68F', color: '#000', fontWeight: 900, fontSize: '13px' }}>
                        maya
                      </div>
                      <div className="payment-option-meta">
                        <div className="payment-option-title-row">
                          <span className="payment-option-title">Maya (PayMaya)</span>
                          <span className="payment-option-badge" style={{ background: 'rgba(0, 214, 143, 0.15)', color: '#00D68F', borderColor: 'rgba(0, 214, 143, 0.3)' }}>QR Ph Ready</span>
                        </div>
                        <div className="payment-option-desc">Scan QR Ph code or link registered Maya wallet with instant automated verification</div>
                      </div>
                      <span className="material-symbols-outlined" style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '20px' }}>chevron_right</span>
                    </button>

                    {/* Option 4: Bank Transfer & Cards */}
                    <button
                      onClick={() => setDonateStep(6)}
                      className="payment-option-btn"
                    >
                      <div className="payment-option-icon-box" style={{ background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.3)', color: '#22c55e' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>credit_card</span>
                      </div>
                      <div className="payment-option-meta">
                        <div className="payment-option-title-row">
                          <span className="payment-option-title">Bank & Credit Cards</span>
                          <span className="payment-option-badge">256-Bit SSL</span>
                        </div>
                        <div className="payment-option-desc">Visa, Mastercard, JCB, or direct InstaPay bank transfer gateway</div>
                      </div>
                      <span className="material-symbols-outlined" style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '20px' }}>chevron_right</span>
                    </button>

                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)', borderTop: '1px solid var(--border, rgba(255,255,255,0.08))', paddingTop: '12px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#22c55e' }}>verified_user</span>
                      Decentralized Disaster Relief Protocol
                    </span>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setModalOpen(false)}
                      style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP 1: Web3 MetaMask Review & Signing ── */}
              {donateStep === 1 && (
                <div className="fade-in">

                  {/* Step Bar */}
                  <div className="payment-step-bar">
                    <div className="payment-step-item">
                      <span className="payment-step-num">1</span>
                      <span>Select Rail</span>
                    </div>
                    <div className="payment-step-divider" />
                    <div className="payment-step-item active">
                      <span className="payment-step-num">2</span>
                      <span>Review & Sign</span>
                    </div>
                    <div className="payment-step-divider" />
                    <div className="payment-step-item">
                      <span className="payment-step-num">3</span>
                      <span>Receipt</span>
                    </div>
                  </div>

                  <h2 style={{ marginTop: 0, marginBottom: '14px', display: 'flex', alignItems: 'center', fontSize: '1.25rem', color: 'var(--text-primary, #fff)', fontWeight: 800 }}>
                    <span className="material-symbols-outlined" style={{ marginRight: '8px', color: '#22c55e' }}>volunteer_activism</span>
                    Review Contribution
                  </h2>

                  {/* Campaign Target Card */}
                  <div style={{ background: 'var(--bg-card, rgba(255,255,255,0.03))', border: '1px solid var(--border, rgba(255,255,255,0.08))', padding: '12px 14px', borderRadius: '12px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img
                      src={coverData.imageUrl}
                      alt={camp.title}
                      style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }}
                      onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=150&q=80'; }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: 'var(--text-primary, #fff)', fontWeight: 700, fontSize: '0.92rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{camp.title}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94a3b8)', marginTop: '2px' }}>
                        Beneficiary NGO: <strong style={{ color: 'var(--text-secondary, #cbd5e1)' }}>{getOrgDisplayName(camp)}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Amount Breakdown Box */}
                  <div style={{ marginBottom: '14px', textAlign: 'center', background: 'var(--bg-input, rgba(0,0,0,0.3))', padding: '14px', borderRadius: '12px', border: '1px solid var(--border, rgba(255,255,255,0.06))' }}>
                    <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted, #94a3b8)', marginBottom: '4px', fontWeight: 600 }}>
                      Selected Contribution
                    </div>
                    <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: '6px' }}>
                      <span style={{ fontSize: '2.2rem', fontWeight: '800', color: '#22c55e', lineHeight: '1' }}>₱{Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-muted, #94a3b8)' }}>PHP</span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary, #cbd5e1)', marginTop: '6px', fontWeight: '600', fontFamily: 'var(--font-mono, monospace)' }}>
                      ≈ {((Number(amount || 0)) / 170000).toFixed(6)} ETH (1 ETH ≈ ₱170,000)
                    </div>
                  </div>

                  {/* Public Support Note with Quick Preset Chips */}
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted, #94a3b8)' }}>Public Support Message (Optional)</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)' }}>{customMsg.length}/90</span>
                    </div>
                    <textarea
                      className="input"
                      style={{ width: '100%', minHeight: '58px', padding: '10px 12px', resize: 'none', fontSize: '0.84rem', borderRadius: '10px' }}
                      placeholder="Leave an encouraging message for the disaster relief victims..."
                      value={customMsg}
                      onChange={(e) => setCustomMsg(e.target.value)}
                      maxLength={90}
                    />
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {['Emergency Aid', 'Typhoon Relief Support', 'Food & Clean Water Aid', 'Prayers & Support'].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          className="payment-quick-msg-chip"
                          onClick={() => setCustomMsg(preset)}
                        >
                          +{preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                    {/* Anonymous Toggle */}
                    <div
                      onClick={() => setIsAnonymous(!isAnonymous)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', background: isAnonymous ? 'rgba(34, 197, 94, 0.08)' : 'var(--bg-card, rgba(255,255,255,0.02))',
                        border: `1px solid ${isAnonymous ? 'rgba(34, 197, 94, 0.4)' : 'var(--border, rgba(255,255,255,0.08))'}`,
                        borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s ease', userSelect: 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '34px', height: '34px', borderRadius: '50%',
                          background: isAnonymous ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255,255,255,0.05)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: isAnonymous ? '#22c55e' : 'var(--text-muted, #94a3b8)',
                          transition: 'all 0.2s ease'
                        }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>visibility_off</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.88rem', fontWeight: '700', color: isAnonymous ? '#22c55e' : 'var(--text-primary, #fff)' }}>Donate Anonymously</span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)' }}>Mask identity on the public Sepolia blockchain ledger</span>
                        </div>
                      </div>

                      <div style={{
                        width: '38px', height: '20px', borderRadius: '20px',
                        background: isAnonymous ? '#22c55e' : 'rgba(255,255,255,0.15)',
                        position: 'relative', transition: '0.2s', flexShrink: 0
                      }}>
                        <div style={{
                          width: '16px', height: '16px', background: '#fff', borderRadius: '50%',
                          position: 'absolute', top: '2px', left: isAnonymous ? '20px' : '2px',
                          transition: '0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }} />
                      </div>
                    </div>

                    {/* Legal Confirmation */}
                    <div
                      onClick={() => setLegalConfirm(!legalConfirm)}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: '10px',
                        padding: '10px 14px', background: legalConfirm ? 'rgba(34, 197, 94, 0.05)' : 'var(--bg-card, rgba(255,255,255,0.02))',
                        border: `1px solid ${legalConfirm ? 'rgba(34, 197, 94, 0.3)' : 'var(--border, rgba(255,255,255,0.08))'}`,
                        borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s ease', userSelect: 'none'
                      }}
                    >
                      <div style={{
                        minWidth: '20px', height: '20px', borderRadius: '6px', marginTop: '2px',
                        background: legalConfirm ? '#22c55e' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${legalConfirm ? '#22c55e' : 'rgba(255,255,255,0.2)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s', flexShrink: 0
                      }}>
                        {legalConfirm && <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#000', fontWeight: 'bold' }}>check</span>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: '500', color: legalConfirm ? 'var(--text-primary, #fff)' : 'var(--text-muted, #94a3b8)', lineHeight: '1.4' }}>
                          I confirm this transfer to the Sepolia Node smart contract is final and verifiable on the public ledger.
                        </span>
                      </div>
                    </div>

                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setDonateStep(0)}>Back</button>
                    <button
                      className="btn btn-primary"
                      style={{ flex: 2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      onClick={handleConfirmDonate}
                      disabled={!legalConfirm}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>lock</span>
                      <span>Confirm & Sign via MetaMask</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP 2: Awaiting MetaMask Signature ── */}
              {donateStep === 2 && (
                <div className="fade-in" style={{ textAlign: 'center', padding: '36px 12px' }}>
                  <div className="spinner" style={{ width: '46px', height: '46px', margin: '0 auto 20px', borderColor: '#22c55e', borderRightColor: 'transparent' }}></div>
                  <h3 style={{ marginBottom: '8px', color: 'var(--text-primary, #fff)', fontSize: '1.25rem', fontWeight: 800 }}>Awaiting MetaMask Signature</h3>
                  <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.86rem', maxWidth: '340px', margin: '0 auto', lineHeight: '1.5' }}>
                    Please open MetaMask extension and confirm the cryptographic signature to authorize this relief transaction.
                  </p>
                  <div style={{ marginTop: '20px', fontSize: '0.76rem', color: '#22c55e', fontFamily: 'monospace' }}>
                    ● SECURE CLIENT EVM GATEWAY LISTENING
                  </div>
                </div>
              )}

              {/* ── STEP 3: Mining Transaction on Sepolia Network ── */}
              {donateStep === 3 && (
                <div className="fade-in" style={{ textAlign: 'center', padding: '30px 12px' }}>
                  <div className="spinner" style={{ width: '46px', height: '46px', margin: '0 auto 20px', borderColor: '#22c55e', borderRightColor: 'transparent' }}></div>
                  <h3 style={{ marginBottom: '8px', color: 'var(--text-primary, #fff)', fontSize: '1.25rem', fontWeight: 800 }}>Mining on Sepolia Blockchain</h3>
                  <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.86rem', marginBottom: '16px' }}>
                    Broadcasting blocks to consensus nodes. This will finalize in a few moments.
                  </p>
                  <div style={{ padding: '12px', background: 'var(--bg-input, rgba(0,0,0,0.3))', borderRadius: '10px', fontSize: '0.78rem', wordBreak: 'break-all', border: '1px solid var(--border, rgba(255,255,255,0.08))', textAlign: 'left' }}>
                    <div style={{ color: 'var(--text-muted, #94a3b8)', marginBottom: '4px', fontSize: '0.72rem', textTransform: 'uppercase' }}>Transaction Hash:</div>
                    <div style={{ fontFamily: 'monospace', color: '#22c55e', fontSize: '0.82rem' }}>{txHash}</div>
                  </div>
                </div>
              )}

              {/* ── STEP 4: Verified Cryptographic Receipt Screen ── */}
              {donateStep === 4 && (
                <div className="fade-in" style={{ textAlign: 'center', padding: '16px 8px 8px' }}>
                  <div className="success-circle-container" style={{ margin: '0 auto 14px' }}>
                    <span
                      className="material-symbols-outlined check-icon-pop"
                      style={{ fontSize: '2.6rem', color: '#22c55e' }}
                    >
                      verified
                    </span>
                  </div>
                  <h3 style={{ margin: '0 0 4px', color: 'var(--text-primary, #fff)', fontSize: '1.3rem', fontWeight: 800 }}>Contribution Successful!</h3>
                  <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.82rem', margin: 0 }}>
                    Your funds have been recorded on the immutable smart contract ledger.
                  </p>

                  {/* Receipt Data Box */}
                  <div style={{ margin: '18px 0', padding: '16px', background: 'var(--bg-card, rgba(255,255,255,0.02))', borderRadius: '12px', textAlign: 'left', border: '1px solid rgba(34, 197, 94, 0.25)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))', paddingBottom: '8px' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Verified On-Chain Receipt</span>
                      <span style={{ fontSize: '0.72rem', color: '#22c55e', fontWeight: 700 }}>✓ CONFIRMED</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted, #94a3b8)' }}>Campaign:</span>
                      <strong style={{ fontSize: '0.84rem', color: 'var(--text-primary, #fff)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{camp.title}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted, #94a3b8)' }}>Amount:</span>
                      <strong style={{ fontSize: '0.96rem', color: '#22c55e' }}>₱{Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} <span style={{ fontSize: '0.76rem', color: 'var(--text-muted, #94a3b8)' }}>(≈ {((Number(amount || 0)) / 170000).toFixed(5)} ETH)</span></strong>
                    </div>

                    {txHash && (
                      <div style={{ paddingTop: '8px', borderTop: '1px solid var(--border, rgba(255,255,255,0.08))' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '4px' }}>Transaction Proof:</div>
                        <a
                          href={`${SEPOLIA_EXPLORER}${txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#22c55e', textDecoration: 'none', wordBreak: 'break-all', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'monospace' }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>open_in_new</span>
                          {txHash.slice(0, 20)}...{txHash.slice(-10)}
                        </a>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      className="btn btn-outline"
                      style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      onClick={() => {
                        if (txHash) navigator.clipboard.writeText(txHash);
                        showSuccess('Transaction hash copied to clipboard!', 'Proof Copied');
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>content_copy</span>
                      <span>Copy Proof</span>
                    </button>
                    <button
                      className="btn btn-primary"
                      style={{ flex: 1.5 }}
                      onClick={() => { setModalOpen(false); setAmount(''); }}
                    >
                      Complete & Close
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP 6: Institutional Card & Bank Checkout ── */}
              {donateStep === 6 && (
                <div className="fade-in">

                  {/* Modal Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))', paddingBottom: '14px' }}>
                    <div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#22c55e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>credit_card</span>
                        Direct Card & Bank Transfer Gateway
                      </div>
                      <h2 style={{ margin: 0, fontSize: '1.35rem', color: 'var(--text-primary, #fff)', fontWeight: 800 }}>
                        Card & Bank Checkout
                      </h2>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)', marginTop: '3px' }}>
                        Beneficiary Campaign: <strong style={{ color: 'var(--text-secondary, #cbd5e1)' }}>{camp.title}</strong>
                      </div>
                    </div>
                    <button
                      onClick={() => setDonateStep(0)}
                      style={{ background: 'var(--bg-input, rgba(255,255,255,0.05))', border: '1px solid var(--border, rgba(255,255,255,0.1))', color: 'var(--text-muted, #94a3b8)', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Back to Payment Selector"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="card-checkout-grid">

                    {/* Left Column: Visual 3D Card & Financial Summary */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>

                      {/* Preview Title & Demo Autofill Helper */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
                          Interactive Card
                        </span>
                        <button
                          type="button"
                          className="card-autofill-btn"
                          onClick={handleAutofillTestCard}
                          style={{ margin: 0 }}
                          title="Autofill verified demo test card details"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>bolt</span>
                          Demo Test Card
                        </button>
                      </div>

                      {/* 3D Visual Credit Card */}
                      <div style={{ perspective: '1000px', width: '100%', height: '200px', marginBottom: '14px', position: 'relative' }}>
                        <div style={{ width: '100%', height: '100%', position: 'absolute', transition: 'transform 0.6s cubic-bezier(0.4, 0.2, 0.2, 1)', transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>

                          {/* Front of Card */}
                          <div style={{
                            width: '100%', height: '100%', position: 'absolute', backfaceVisibility: 'hidden',
                            background: 'linear-gradient(135deg, #181a20 0%, #101216 50%, #0a0b0d 100%)',
                            border: '1px solid rgba(255,255,255,0.16)', borderRadius: '16px', padding: '20px 24px',
                            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.12)',
                            overflow: 'hidden'
                          }}>
                            {/* Subtle Metallic Sheen Shader */}
                            <div style={{ position: 'absolute', top: '-60%', left: '-60%', width: '220%', height: '220%', background: 'radial-gradient(circle at 65% 10%, rgba(255,255,255,0.06) 0%, transparent 60%)', pointerEvents: 'none' }}></div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1, minHeight: '28px' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ color: '#22c55e', fontSize: '0.62rem', fontWeight: '800', letterSpacing: '2px', textTransform: 'uppercase', background: 'rgba(34, 197, 94, 0.15)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(34, 197, 94, 0.3)' }}>RELIEF DEBIT</span>
                              </div>
                              <div>
                                {activeLogo ? (
                                  <img src={activeLogo} alt="Card Type" style={{ height: '24px', maxWidth: '64px', objectFit: 'contain' }} />
                                ) : (
                                  <span className="material-symbols-outlined" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '24px' }}>credit_card</span>
                                )}
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', position: 'relative', zIndex: 1 }}>
                              {/* Golden Holographic EMV Chip */}
                              <div style={{ width: '42px', height: '30px', background: 'linear-gradient(135deg, #e6c875 0%, #b88a28 100%)', borderRadius: '6px', position: 'relative', border: '1px solid rgba(0,0,0,0.4)', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>
                                <div style={{ position: 'absolute', top: '28%', left: 0, right: 0, height: '1px', background: 'rgba(0,0,0,0.2)' }}></div>
                                <div style={{ position: 'absolute', top: '72%', left: 0, right: 0, height: '1px', background: 'rgba(0,0,0,0.2)' }}></div>
                                <div style={{ position: 'absolute', top: 0, bottom: 0, left: '60%', width: '1px', background: 'rgba(0,0,0,0.2)' }}></div>
                              </div>
                              <span className="material-symbols-outlined" style={{ fontSize: '24px', color: 'rgba(255,255,255,0.75)' }}>contactless</span>
                            </div>

                            <div style={{ position: 'relative', zIndex: 1 }}>
                              <div style={{
                                fontFamily: 'var(--font-mono, monospace)',
                                fontSize: '1.28rem',
                                color: cardNumber ? '#f8fafc' : 'rgba(255,255,255,0.38)',
                                letterSpacing: '2.5px',
                                marginBottom: '10px',
                                textShadow: cardNumber ? '0 1px 3px rgba(0,0,0,0.6)' : 'none',
                                whiteSpace: 'nowrap'
                              }}>
                                {getDisplayCardNumber()}
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                                <div style={{
                                  maxWidth: '170px',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  fontWeight: 600,
                                  color: cardName ? '#e2e8f0' : 'rgba(255,255,255,0.38)',
                                  textShadow: cardName ? '0 1px 2px rgba(0,0,0,0.5)' : 'none'
                                }}>
                                  {displayCardName}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                  <span style={{ fontSize: '0.45rem', opacity: 0.7, marginBottom: '1px', letterSpacing: '1px', color: 'rgba(255,255,255,0.7)' }}>VALID THRU</span>
                                  <span style={{
                                    fontSize: '0.88rem',
                                    fontFamily: 'var(--font-mono, monospace)',
                                    letterSpacing: '1.5px',
                                    fontWeight: 600,
                                    color: cardExpiry ? '#e2e8f0' : 'rgba(255,255,255,0.38)'
                                  }}>
                                    {hideCardDetails && cardExpiry ? '••/••' : (cardExpiry || 'MM/YY')}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Back of Card */}
                          <div style={{ width: '100%', height: '100%', position: 'absolute', backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', background: 'linear-gradient(135deg, #181a20 0%, #101216 100%)', border: '1px solid rgba(255,255,255,0.16)', borderRadius: '16px', boxShadow: '0 16px 36px rgba(0, 0, 0, 0.5)', paddingTop: '20px' }}>
                            <div style={{ height: '38px', background: '#000000', width: '100%' }}></div>
                            <div style={{ padding: '18px 22px' }}>
                              <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.6)', marginBottom: '4px', textAlign: 'right', textTransform: 'uppercase' }}>Security CVC / CVV</div>
                              <div style={{
                                background: '#ffffff',
                                height: '34px',
                                width: '100%',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                paddingRight: '12px',
                                color: cardCvv ? '#0f172a' : '#94a3b8',
                                fontStyle: 'italic',
                                fontSize: '1rem',
                                letterSpacing: '2px',
                                fontWeight: 700
                              }}>
                                {getDisplayCvv()}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Flip and Mask Controls */}
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '14px' }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: '0.74rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid var(--border, rgba(255,255,255,0.1))' }}
                          onClick={() => setIsFlipped(!isFlipped)}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>sync</span>
                          {isFlipped ? 'Show Front' : 'Flip Card (CVV)'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: '0.74rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid var(--border, rgba(255,255,255,0.1))' }}
                          onClick={() => setHideCardDetails(!hideCardDetails)}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>{hideCardDetails ? 'visibility' : 'visibility_off'}</span>
                          {hideCardDetails ? 'Show Details' : 'Hide Details'}
                        </button>
                      </div>

                      {/* Financial Settlement Breakdown Card */}
                      <div style={{ background: 'var(--bg-card, rgba(255,255,255,0.03))', border: '1px solid var(--border, rgba(255,255,255,0.08))', borderRadius: '12px', padding: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--text-secondary, #cbd5e1)', fontSize: '0.84rem' }}>
                          <span>Donation Amount:</span>
                          <strong style={{ color: 'var(--text-primary, #fff)' }}>₱{parseFloat(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} PHP</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: 'var(--text-muted, #94a3b8)', fontSize: '0.8rem' }}>
                          <span>Processing & Gas Fee:</span>
                          <span style={{ color: '#22c55e', fontWeight: 600 }}>₱0.00 (Zero Non-Profit Fee)</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid var(--border, rgba(255,255,255,0.08))' }}>
                          <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary, #fff)' }}>Total Settlement:</span>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ color: '#22c55e', fontWeight: 800, fontSize: '1.05rem', lineHeight: '1.2' }}>₱{parseFloat(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)', fontFamily: 'var(--font-mono, monospace)' }}>≈ {(parseFloat(amount || 0) / 170000).toFixed(6)} ETH</div>
                          </div>
                        </div>
                      </div>

                      {/* Official NGO Bank Transfer Info (if available) */}
                      {(camp.bankAccountNumber || camp.bank_account_number) && (
                        <div style={{ marginTop: '12px', background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '12px', padding: '12px', fontSize: '0.78rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#38bdf8', fontWeight: 700 }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>account_balance</span>
                              <span>NGO Direct Bank Deposit</span>
                            </div>
                            <span style={{ fontSize: '0.68rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>InstaPay</span>
                          </div>
                          <div style={{ color: 'var(--text-secondary, #cbd5e1)', fontSize: '0.74rem', marginBottom: '4px' }}>
                            <strong>Bank:</strong> {camp.bankName || camp.bank_name || 'BDO Unibank'}
                          </div>
                          <div style={{ color: 'var(--text-secondary, #cbd5e1)', fontSize: '0.74rem', marginBottom: '6px' }}>
                            <strong>Account Name:</strong> {camp.bankAccountName || camp.bank_account_name || camp.orgName || 'ReliefLink Foundation Inc.'}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.25)', padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <span style={{ fontFamily: 'monospace', color: '#38bdf8', fontWeight: 700, fontSize: '0.84rem' }}>
                              {camp.bankAccountNumber || camp.bank_account_number}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const acct = (camp.bankAccountNumber || camp.bank_account_number).replace(/\s+/g, '');
                                navigator.clipboard.writeText(acct);
                                showSuccess?.(`Account number ${acct} copied!`, 'Copied');
                              }}
                              style={{ background: 'rgba(56, 189, 248, 0.2)', border: '1px solid rgba(56, 189, 248, 0.4)', color: '#38bdf8', padding: '2px 6px', borderRadius: '4px', fontSize: '0.68rem', cursor: 'pointer', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>content_copy</span>
                              Copy
                            </button>
                          </div>
                        </div>
                      )}

                    </div>

                    {/* Right Column: High-Converting Card Form */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--bg-card, rgba(255,255,255,0.02))', padding: '18px', borderRadius: '14px', border: '1px solid var(--border, rgba(255,255,255,0.06))' }}>

                        {/* Header with Clear Button on the Very Right */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))', paddingBottom: '8px' }}>
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-primary, #fff)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#22c55e' }}>credit_score</span>
                            Payment Credentials
                          </div>
                          <button
                            type="button"
                            onClick={handleClearCardForm}
                            className="btn btn-ghost btn-xs"
                            style={{
                              fontSize: '0.72rem',
                              padding: '2px 8px',
                              color: 'var(--text-muted, #94a3b8)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              border: '1px solid var(--border, rgba(255,255,255,0.08))',
                              borderRadius: '6px',
                              cursor: 'pointer'
                            }}
                            title="Clear all fields"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>backspace</span>
                            Clear
                          </button>
                        </div>

                        {/* Cardholder Name */}
                        <div className="card-field-group">
                          <label className="card-field-label">
                            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>person</span>
                            Cardholder Name
                          </label>
                          <div className="card-input-with-icon">
                            <span className="material-symbols-outlined input-icon-left">badge</span>
                            <input
                              type="text"
                              className="input"
                              placeholder="GESTER MACALDO"
                              value={cardName}
                              onChange={(e) => setCardName(e.target.value.toUpperCase())}
                              onFocus={() => setIsFlipped(false)}
                            />
                          </div>
                        </div>

                        {/* Card Number */}
                        <div className="card-field-group">
                          <label className="card-field-label">
                            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>credit_card</span>
                            16-Digit Card Number
                          </label>
                          <div className="card-input-with-icon">
                            <span className="material-symbols-outlined input-icon-left">payment</span>
                            <input
                              type="text"
                              className="input"
                              placeholder="1234 5678 9012 3456"
                              style={{ paddingRight: '90px' }}
                              value={cardNumber}
                              onChange={handleCardNumberChange}
                              onFocus={() => setIsFlipped(false)}
                            />
                            <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '4px', alignItems: 'center' }}>
                              {(cardType === 'unknown' || cardType === 'visa') && <img src={visaLogo} alt="Visa" style={{ height: '15px', objectFit: 'contain' }} />}
                              {(cardType === 'unknown' || cardType === 'mastercard') && <img src={mcLogo} alt="Mastercard" style={{ height: '15px', objectFit: 'contain' }} />}
                              {(cardType === 'unknown' || cardType === 'amex') && <img src={amexLogo} alt="Amex" style={{ height: '15px', objectFit: 'contain' }} />}
                            </div>
                          </div>
                        </div>

                        {/* Expiry & CVV Row */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div className="card-field-group">
                            <label className="card-field-label">
                              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>calendar_month</span>
                              Expiry (MM / YY)
                            </label>
                            <input
                              type="text"
                              placeholder="MM / YY"
                              className="input"
                              maxLength="5"
                              value={cardExpiry}
                              onChange={handleExpiryChange}
                              onFocus={() => setIsFlipped(false)}
                            />
                          </div>
                          <div className="card-field-group">
                            <label className="card-field-label">
                              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>lock</span>
                              Security CVV
                            </label>
                            <input
                              type={hideCardDetails ? "password" : "text"}
                              placeholder="CVV (3 or 4)"
                              className="input"
                              maxLength="4"
                              value={cardCvv}
                              onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                              onFocus={() => setIsFlipped(true)}
                              onBlur={() => setIsFlipped(false)}
                            />
                          </div>
                        </div>

                        <div style={{ fontSize: '0.82rem', color: 'var(--text-primary, #fff)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))', paddingBottom: '6px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#22c55e' }}>mail</span>
                          Receipt Destination
                        </div>

                        {/* Email Address */}
                        <div className="card-field-group">
                          <label className="card-field-label">Email Address</label>
                          <div className="card-input-with-icon">
                            <span className="material-symbols-outlined input-icon-left">mail</span>
                            <input
                              type="email"
                              className="input"
                              placeholder="donor@example.com"
                              value={cardEmail}
                              onChange={(e) => setCardEmail(e.target.value)}
                              onFocus={() => setIsFlipped(false)}
                            />
                          </div>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)', marginTop: '2px' }}>
                            Digital certificate of donation & on-chain proof will be sent here.
                          </span>
                        </div>

                        {/* Country & ZIP Row */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '10px' }}>
                          <div className="card-field-group">
                            <label className="card-field-label">Country / Region</label>
                            <select
                              className="input"
                              value={cardCountry}
                              onChange={(e) => setCardCountry(e.target.value)}
                              onFocus={() => setIsFlipped(false)}
                              style={{ appearance: 'none', cursor: 'pointer' }}
                            >
                              <option value="Philippines">Philippines</option>
                              <option value="United States">United States</option>
                              <option value="United Kingdom">United Kingdom</option>
                              <option value="Canada">Canada</option>
                              <option value="Australia">Australia</option>
                              <option value="Singapore">Singapore</option>
                              <option value="Japan">Japan</option>
                            </select>
                          </div>
                          <div className="card-field-group">
                            <label className="card-field-label">Postal / ZIP</label>
                            <input
                              type="text"
                              className="input"
                              placeholder="1226"
                              value={cardZip}
                              onChange={(e) => setCardZip(e.target.value)}
                              onFocus={() => setIsFlipped(false)}
                            />
                          </div>
                        </div>

                      </div>

                      {/* Action Buttons */}
                      <div style={{ marginTop: '14px', display: 'flex', gap: '10px' }}>
                        <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setDonateStep(0)} disabled={isUploading}>
                          Back
                        </button>
                        <button
                          className="btn btn-primary"
                          style={{ flex: 2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                          onClick={() => submitManualDonation('Credit Card')}
                          disabled={isUploading || !cardNumber || !cardExpiry || !cardCvv || !cardEmail}
                        >
                          {isUploading ? (
                            <>
                              <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                              <span>Processing Payment...</span>
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>lock</span>
                              <span>Pay ₱{parseFloat(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} PHP</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Institutional Trust Seals */}
                      <div className="card-trust-seal-bar">
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#22c55e' }}>enhanced_encryption</span>
                          256-Bit SSL Encrypted
                        </span>
                        <span>•</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#22c55e' }}>verified</span>
                          PCI-DSS Level 1 Compliant
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

              )}

              {/* ── STEP 7: Institutional E-Wallet (GCash / Maya) Terminal ── */}
              {donateStep === 7 && (
                <div className="fade-in">

                  {/* Modal Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))', paddingBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: gatewayMethod === 'Maya' ? '#00D68F' : '#007DFE', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>account_balance_wallet</span>
                        Official {gatewayMethod} Payment Channel
                      </div>
                      <h2 style={{ margin: 0, fontSize: '1.3rem', color: 'var(--text-primary, #fff)', fontWeight: 800 }}>
                        {gatewayMethod} Direct Transfer
                      </h2>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)', marginTop: '3px' }}>
                        Beneficiary Campaign: <strong style={{ color: 'var(--text-secondary, #cbd5e1)' }}>{camp.title}</strong>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        className="card-autofill-btn"
                        onClick={handleAutofillDemoReceipt}
                        style={{ margin: 0, padding: '6px 12px', fontSize: '0.76rem', background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.4)', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 700 }}
                        title="Autofill realistic demo receipt screenshot, ₱500 amount, and verified reference number"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>bolt</span>
                        ⚡ Demo Autofill (₱500 + Ref + Receipt)
                      </button>

                      <button
                        onClick={() => setDonateStep(0)}
                        style={{ background: 'var(--bg-input, rgba(255,255,255,0.05))', border: '1px solid var(--border, rgba(255,255,255,0.1))', color: 'var(--text-muted, #94a3b8)', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Back to Payment Selector"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Main 2-Column Grid */}
                  <div className="ewallet-checkout-grid">

                    {/* Left Column: NGO's Official E-Wallet QR & Manual Copy Number Credentials */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div style={{ background: 'var(--bg-card, rgba(255,255,255,0.02))', border: '1px solid var(--border, rgba(255,255,255,0.08))', borderRadius: '16px', padding: '18px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

                        {/* Brand Badge */}
                        <div style={{ width: '50px', height: '50px', borderRadius: '14px', background: gatewayMethod === 'Maya' ? '#000000' : '#007DFE', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px', border: gatewayMethod === 'Maya' ? '1.5px solid rgba(0,214,143,0.4)' : '1.5px solid rgba(255,255,255,0.2)', boxShadow: '0 4px 14px rgba(0,0,0,0.2)' }}>
                          {gatewayMethod === 'Maya' ? (
                            <span style={{ color: '#00d68f', fontWeight: 900, fontSize: '15px', letterSpacing: '-0.5px' }}>maya</span>
                          ) : (
                            <span style={{ color: '#ffffff', fontWeight: 900, fontSize: '24px' }}>G</span>
                          )}
                        </div>

                        {/* NGO Uploaded QR Code OR Informative QR Fallback */}
                        {((gatewayMethod === 'Maya' ? (camp.mayaQrUrl || camp.maya_qr_url) : (camp.gcashQrUrl || camp.gcash_qr_url))) ? (
                          <div className="qr-ph-box" style={{ maxWidth: '210px', margin: '0 auto 12px', textAlign: 'center' }}>
                            <div className="qr-ph-banner">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <span style={{ fontSize: '10px', fontWeight: 900, color: '#0f172a' }}>OFFICIAL</span>
                                <span style={{ fontSize: '10px', fontWeight: 900, color: gatewayMethod === 'Maya' ? '#00d68f' : '#007DFE' }}>{gatewayMethod.toUpperCase()}</span>
                                <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#22c55e', display: 'inline-block', margin: '0 1px' }}></span>
                              </div>
                              <span style={{ fontSize: '7px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                                NGO Verified
                              </span>
                            </div>

                            <div style={{ position: 'relative', width: '160px', height: '160px', margin: '0 auto', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.08)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px' }}>
                              <img
                                src={gatewayMethod === 'Maya' ? (camp.mayaQrUrl || camp.maya_qr_url) : (camp.gcashQrUrl || camp.gcash_qr_url)}
                                alt={`${gatewayMethod} QR`}
                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                              />
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #94a3b8)', marginTop: '4px' }}>
                              Point your {gatewayMethod} camera to scan
                            </div>
                          </div>
                        ) : (
                          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed var(--border, rgba(255,255,255,0.15))', borderRadius: '12px', padding: '16px', textAlign: 'center', width: '100%', maxWidth: '220px', marginBottom: '12px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '32px', color: gatewayMethod === 'Maya' ? '#00d68f' : '#007DFE', marginBottom: '4px' }}>
                              phone_android
                            </span>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-primary, #ffffff)', fontWeight: 700 }}>
                              Direct Transfer Channel
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)', marginTop: '2px', lineHeight: 1.4 }}>
                              No custom {gatewayMethod} QR uploaded. Transfer directly to the mobile number below:
                            </div>
                          </div>
                        )}

                        {/* Merchant Details Box with 1-Click Copy Number */}
                        <div style={{ width: '100%', background: 'var(--bg-input, rgba(0,0,0,0.25))', borderRadius: '12px', padding: '12px', border: '1px solid var(--border, rgba(255,255,255,0.06))', fontSize: '0.78rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span style={{ color: 'var(--text-muted, #94a3b8)' }}>Beneficiary Org:</span>
                            <strong style={{ color: 'var(--text-primary, #ffffff)', textAlign: 'right', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={camp.orgName || 'Accredited Relief Org'}>
                              {camp.orgName || 'Accredited Relief Org'}
                            </strong>
                          </div>

                          {((gatewayMethod === 'Maya' && (camp.mayaName || camp.maya_name)) || (gatewayMethod === 'GCash' && (camp.gcashName || camp.gcash_name))) && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <span style={{ color: 'var(--text-muted, #94a3b8)' }}>Account Name:</span>
                              <strong style={{ color: 'var(--text-primary, #ffffff)', textAlign: 'right', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {gatewayMethod === 'Maya' ? (camp.mayaName || camp.maya_name) : (camp.gcashName || camp.gcash_name)}
                              </strong>
                            </div>
                          )}

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', background: gatewayMethod === 'Maya' ? 'rgba(0, 214, 143, 0.08)' : 'rgba(34, 197, 94, 0.08)', padding: '6px 8px', borderRadius: '8px', border: gatewayMethod === 'Maya' ? '1.5px solid rgba(0, 214, 143, 0.3)' : '1px solid rgba(34, 197, 94, 0.2)' }}>
                            <span style={{ color: 'var(--text-secondary, #cbd5e1)', fontWeight: 600 }}>{gatewayMethod} No:</span>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                              <strong style={{ color: gatewayMethod === 'Maya' ? '#00d68f' : '#22c55e', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                {gatewayMethod === 'Maya'
                                  ? (camp.mayaNumber || camp.maya_number || '0918 765 4321')
                                  : (camp.gcashNumber || camp.gcash_number || '0917 890 1234')}
                              </strong>
                              <button
                                type="button"
                                onClick={() => {
                                  const targetNumber = gatewayMethod === 'Maya'
                                    ? (camp.mayaNumber || camp.maya_number || '09187654321')
                                    : (camp.gcashNumber || camp.gcash_number || '09178901234');
                                  const cleanNum = targetNumber.replace(/\s+/g, '');
                                  navigator.clipboard.writeText(cleanNum);
                                  showSuccess?.(`${gatewayMethod} number ${cleanNum} copied to clipboard!`, 'Number Copied');
                                }}
                                style={{ background: gatewayMethod === 'Maya' ? 'rgba(0, 214, 143, 0.2)' : 'rgba(34, 197, 94, 0.2)', border: gatewayMethod === 'Maya' ? '1px solid rgba(0, 214, 143, 0.5)' : '1px solid rgba(34, 197, 94, 0.4)', color: gatewayMethod === 'Maya' ? '#00d68f' : '#22c55e', cursor: 'pointer', display: 'flex', padding: '3px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, alignItems: 'center', gap: '3px' }}
                                title="Copy Number to Clipboard"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>content_copy</span>
                                Copy
                              </button>
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted, #94a3b8)' }}>Transfer Fee:</span>
                            <span style={{ color: '#22c55e', fontWeight: 700 }}>₱0.00 (Zero Fee)</span>
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* Right Column: Submission Form (Amount, Ref No., Receipt Upload) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

                      <div style={{ background: 'var(--bg-card, rgba(255,255,255,0.02))', padding: '20px', borderRadius: '16px', border: '1px solid var(--border, rgba(255,255,255,0.06))' }}>

                        {/* 1. Amount Input */}
                        <div style={{ marginBottom: '14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary, #cbd5e1)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              1. Donation Amount (PHP)
                            </label>
                            <span style={{ fontSize: '0.74rem', color: '#22c55e', fontFamily: 'monospace', fontWeight: 600 }}>
                              ≈ {((parseFloat(amount || 0)) / 170000).toFixed(6)} ETH
                            </span>
                          </div>

                          <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: 'var(--text-muted, #94a3b8)', fontSize: '1.1rem' }}>₱</span>
                            <input
                              type="number"
                              className="input"
                              style={{ width: '100%', paddingLeft: '32px', fontSize: '1.1rem', fontWeight: 800, color: '#22c55e', borderRadius: '10px' }}
                              value={amount}
                              onChange={(e) => setAmount(e.target.value)}
                              placeholder="500"
                              min="1"
                            />
                          </div>

                          {/* Quick Preset Chips */}
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                            {['100', '500', '1000', '2500', '5000'].map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                className="payment-quick-msg-chip"
                                style={{
                                  background: amount === preset ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.05)',
                                  borderColor: amount === preset ? '#22c55e' : 'rgba(255,255,255,0.1)',
                                  color: amount === preset ? '#22c55e' : 'var(--text-secondary, #cbd5e1)',
                                  fontWeight: 700,
                                  fontSize: '0.75rem',
                                  padding: '4px 10px',
                                  borderRadius: '8px'
                                }}
                                onClick={() => setAmount(preset)}
                              >
                                ₱{Number(preset).toLocaleString()}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 2. Reference Number Input */}
                        <div style={{ marginBottom: '14px' }}>
                          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary, #cbd5e1)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                            2. {gatewayMethod} Reference Number
                          </label>
                          <div style={{ position: 'relative' }}>
                            <span className="material-symbols-outlined" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #94a3b8)', fontSize: '18px' }}>
                              pin
                            </span>
                            <input
                              type="text"
                              className="input"
                              style={{ width: '100%', paddingLeft: '38px', fontSize: '0.92rem', fontFamily: 'monospace', fontWeight: 700, borderRadius: '10px' }}
                              value={refNumber || gatewayRefNo}
                              onChange={(e) => {
                                setRefNumber(e.target.value);
                                setGatewayRefNo(e.target.value);
                              }}
                              placeholder="e.g. 9012 3456 7890"
                            />
                          </div>
                        </div>

                        {/* 3. Screenshot / Receipt Upload & Preview */}
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary, #cbd5e1)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              3. Payment Screenshot / Proof
                            </label>
                            {receiptBase64 && (
                              <button
                                type="button"
                                onClick={() => setReceiptBase64('')}
                                style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}
                              >
                                Remove
                              </button>
                            )}
                          </div>

                          {receiptBase64 ? (
                            <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1.5px solid rgba(34, 197, 94, 0.4)', background: 'rgba(0,0,0,0.3)', padding: '8px', textAlign: 'center' }}>
                              <img
                                src={receiptBase64}
                                alt="Payment Proof"
                                style={{ maxHeight: '140px', maxWidth: '100%', objectFit: 'contain', borderRadius: '8px' }}
                              />
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontSize: '0.72rem', color: '#22c55e', fontWeight: 700 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check_circle</span>
                                Verified Payment Receipt Attached
                              </div>
                            </div>
                          ) : (
                            <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px', border: '1.5px dashed var(--border, rgba(255,255,255,0.15))', borderRadius: '12px', cursor: 'pointer', background: 'rgba(255,255,255,0.02)', transition: '0.2s' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '26px', color: 'var(--text-muted, #94a3b8)', marginBottom: '4px' }}>
                                add_photo_alternate
                              </span>
                              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary, #ffffff)' }}>
                                Upload Receipt Screenshot
                              </span>
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted, #94a3b8)', marginTop: '2px' }}>
                                PNG, JPG or WebP (Or click Demo Autofill above)
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleReceiptUpload}
                                style={{ display: 'none' }}
                              />
                            </label>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button
                            className="btn btn-outline"
                            style={{ flex: 1 }}
                            onClick={() => setDonateStep(0)}
                            disabled={gatewayLoading}
                          >
                            Back
                          </button>
                          <button
                            className="btn btn-primary"
                            style={{ flex: 2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.92rem', padding: '12px' }}
                            onClick={verifyGatewayPayment}
                            disabled={gatewayLoading || !amount || parseFloat(amount) <= 0 || (!refNumber && !gatewayRefNo) || !receiptBase64}
                          >
                            {gatewayLoading ? (
                              <>
                                <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                                <span>Verifying & Recording...</span>
                              </>
                            ) : (
                              <>
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check</span>
                                <span>Confirm & Submit (₱{Number(amount || 500).toLocaleString()})</span>
                              </>
                            )}
                          </button>
                        </div>

                      </div>

                    </div>

                  </div>

                  {/* Institutional Security Seals */}
                  <div className="card-trust-seal-bar" style={{ marginTop: '16px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#22c55e' }}>security</span>
                      BSP Supervised
                    </span>
                    <span>•</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#22c55e' }}>verified</span>
                      QR Ph National Standard
                    </span>
                    <span>•</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#22c55e' }}>lock</span>
                      256-Bit SSL Encrypted
                    </span>
                  </div>

                </div>
              )}

            </div>

            {/* Floating Magnifying Glass Button (Truly Outside the Main Container to the Right) */}
            {modalOpen && (
              <button
                ref={outsideButtonRef}
                type="button"
                onClick={() => setMagnifierActive(prev => !prev)}
                className={`magnifier-outside-btn ${magnifierActive ? 'active' : ''}`}
                title={magnifierActive ? "Turn off Magnifier Lens" : "Activate Magnifying Glass (1.5x Zoom)"}
                aria-label="Magnifier Glass Lens"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>search</span>
              </button>
            )}

          </div>

          {/* Active Optical True-Zoom Magnifier Lens Portal */}
          {magnifierActive && modalOpen && createPortal(
            <div
              ref={magnifierOverlayRef}
              className="optical-magnifier-overlay"
              style={{
                display: 'none',
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                pointerEvents: 'none',
                zIndex: 9999999
              }}
            >
              {/* 1. Magnified Scaled Content with dynamic circular clip-path */}
              <div
                ref={clipViewportRef}
                className="optical-magnifier-clip-viewport"
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  width: '100vw',
                  height: '100vh',
                  pointerEvents: 'none'
                }}
              >
                <div
                  ref={scaledCardContainerRef}
                  style={{
                    position: 'fixed',
                    pointerEvents: 'none'
                  }}
                >
                  <div
                    ref={zoomedViewRef}
                    className="card optical-magnifier-scaled-card"
                    style={{
                      margin: 0,
                      overflowY: 'hidden',
                      pointerEvents: 'none'
                    }}
                  />
                </div>
              </div>

              {/* 2. Optical Glass Bezel Ring & 1.5x Badge centered at cursor */}
              <div
                ref={lensRef}
                className="payment-magnifier-bezel"
                style={{
                  position: 'fixed',
                  pointerEvents: 'none'
                }}
              >
                <div className="magnifier-lens-rim-ring" />
                <div className="magnifier-zoom-badge">1.5x</div>
              </div>
            </div>,
            document.body
          )}
        </div>,
        document.body
      )}

      {/* ── Deactivate / Transaction Events Modal ── */}
      {deactivateModal.show && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(5, 7, 12, 0.75)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999
        }} className="fade-in">

          <div className="card bounce-in" style={{ width: '420px', padding: '24px', background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', borderRadius: '16px' }}>

            {deactivateModal.step === 1 && (
              <div className="fade-in">
                <h2 style={{ marginTop: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', fontSize: '1.2rem', color: 'var(--text)' }}>
                  <span className="material-symbols-outlined" style={{ marginRight: '8px', color: 'var(--danger)' }}>warning</span>
                  Deactivate Campaign
                </h2>
                <div style={{ background: 'rgba(255,60,60,0.05)', border: '1px solid rgba(255,60,60,0.2)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                  <strong style={{ color: 'var(--danger)', fontSize: '0.95rem' }}>Campaign #{camp.id}: {camp.title}</strong>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px', lineHeight: '1.5' }}>
                  This will permanently close the campaign to new donations. This administrative action is recorded on the blockchain and <strong>cannot be undone</strong>.
                </p>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setDeactivateModal({ show: false, step: 0, hash: '', error: '' })}>Cancel</button>
                  <button className="btn btn-primary glow" style={{ flex: 1, background: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={handleDeactivate}>Deactivate</button>
                </div>
              </div>
            )}

            {deactivateModal.step === 2 && (
              <div className="fade-in" style={{ textAlign: 'center', padding: '40px 0' }}>
                <div className="spinner" style={{ width: '40px', height: '40px', margin: '0 auto 20px', borderColor: 'var(--primary)', borderRightColor: 'transparent' }}></div>
                <h3 style={{ marginBottom: '8px', color: 'var(--text)' }}>Awaiting Signature</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Please sign the transaction in MetaMask to deactivate this campaign.</p>
              </div>
            )}

            {deactivateModal.step === 3 && (
              <div className="fade-in" style={{ textAlign: 'center', padding: '40px 0' }}>
                <div className="spinner" style={{ width: '40px', height: '40px', margin: '0 auto 20px', borderColor: 'var(--secondary)', borderRightColor: 'transparent' }}></div>
                <h3 style={{ marginBottom: '8px', color: 'var(--text)' }}>Deactivating Campaign</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>Mining your transaction on the Sepolia network.</p>
                <div style={{ padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', fontSize: '0.75rem', wordBreak: 'break-all', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Transaction Hash:</span>
                  {deactivateModal.hash}
                </div>
              </div>
            )}

            {deactivateModal.step === 4 && (
              <div className="fade-in" style={{ textAlign: 'center', padding: '20px 0 10px' }}>
                <div className="success-circle-container">
                  <span className="material-symbols-outlined check-icon-pop" style={{ fontSize: '2.5rem', color: 'var(--success)' }}>check</span>
                </div>
                <h3 style={{ marginBottom: '8px', color: 'var(--text)' }}>Campaign Deactivated</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Donations are now permanently closed for this campaign.</p>

                <div style={{ margin: '24px 0', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', textAlign: 'left', border: '1px solid rgba(0,255,100,0.1)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>Verified Block Receipt</div>
                  <a href={`${SEPOLIA_EXPLORER}${deactivateModal.hash}`} target="_blank" rel="noreferrer" style={{ color: 'var(--success)', textDecoration: 'none', wordBreak: 'break-all', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>open_in_new</span> {deactivateModal.hash.slice(0, 20)}...
                  </a>
                </div>

                <button className="btn btn-primary btn-full pulse" onClick={() => setDeactivateModal({ show: false, step: 0, hash: '', error: '' })}>Close</button>
              </div>
            )}

            {deactivateModal.step === 5 && (
              <div className="fade-in">
                <h2 style={{ marginTop: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', fontSize: '1.2rem', color: 'var(--text)' }}>
                  <span className="material-symbols-outlined" style={{ marginRight: '8px', color: 'var(--danger)' }}>error</span>
                  Transaction Failed
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px', lineHeight: '1.5' }}>
                  {deactivateModal.error}
                </p>
                <button className="btn btn-primary btn-full pulse" onClick={() => setDeactivateModal({ show: false, step: 0, hash: '', error: '' })}>Close</button>
              </div>
            )}

          </div>
        </div>, document.body)}

      {/* ── Comprehensive Campaign Audit & Location Details Modal ── */}
      {detailsOpen && (() => {
        const audit = getCampaignAuditDetails(camp.id, camp.title, camp);
        const orgDisplayName = getOrgDisplayName(camp.orgAddress, camp.orgName, camp.id);
        const displayTitle = formatCampaignTitle(camp.title, camp.id);
        const catInfo = getCampaignCategoryInfo(camp);
        const targetPhp = (parseFloat(camp.targetAmount || 0) * 170000).toLocaleString('en-US', { maximumFractionDigits: 0 });
        const currentPhp = (displayCurrentEth * 170000).toLocaleString('en-US', { maximumFractionDigits: 0 });
        const progressPercent = pct;

        return createPortal(
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(5, 7, 12, 0.85)', backdropFilter: 'blur(14px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999
          }} className="fade-in">

            <div className="card bounce-in" style={{
              width: '680px',
              maxWidth: '94vw',
              maxHeight: '92vh',
              overflowY: 'auto',
              padding: '24px 28px',
              background: 'var(--bg-card, #1a1a1a)',
              border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 24px rgba(34, 197, 94, 0.12)',
              borderRadius: '20px',
              color: 'var(--text-primary, #ffffff)'
            }}>

              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border, rgba(255, 255, 255, 0.08))', paddingBottom: '16px', marginBottom: '18px' }}>
                <div style={{ flex: 1, minWidth: 0, paddingRight: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    <span className={`campaign-category-pill ${catInfo.colorClass}`} style={{ fontSize: '0.72rem', padding: '3px 10px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>{catInfo.icon}</span>
                      <span>{catInfo.prefix}-00{camp.id} • {catInfo.label}</span>
                    </span>
                    <span className="badge" style={{ fontSize: '0.72rem', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.3)', padding: '3px 10px', fontWeight: 700 }}>
                      {audit.urgency}
                    </span>
                    <span className="badge" style={{ fontSize: '0.72rem', background: 'rgba(34, 197, 94, 0.12)', color: '#22c55e', borderColor: 'rgba(34, 197, 94, 0.3)', padding: '3px 10px', fontWeight: 700 }}>
                      ● Active On-Chain
                    </span>
                  </div>
                  <h2 style={{ margin: 0, fontSize: '1.35rem', color: 'var(--text-primary, #ffffff)', fontWeight: 800, lineHeight: 1.3 }}>
                    {displayTitle}
                  </h2>
                  <div style={{ margin: '8px 0 0 0', fontSize: '0.84rem', color: 'var(--text-muted, #94a3b8)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span>Managed by</span>
                    <button
                      type="button"
                      className="campaign-modal-org-btn"
                      onClick={() => {
                        setDetailsOpen(false);
                        if (onOpenNgoProfile) onOpenNgoProfile(camp.orgId || 3);
                      }}
                      title="Click to view verified NGO institutional profile & all campaigns"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--accent, #22c55e)' }}>domain</span>
                      <span>{orgDisplayName}</span>
                      <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--accent, #22c55e)' }}>verified</span>
                      <span className="material-symbols-outlined" style={{ fontSize: '13px', opacity: 0.6 }}>chevron_right</span>
                    </button>
                    <span>•</span>
                    <span style={{ color: '#22c55e', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>verified</span> Smart Contract Verified
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setDetailsOpen(false)}
                  style={{
                    background: 'var(--bg-input, rgba(255, 255, 255, 0.06))',
                    border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
                    color: 'var(--text-muted, #94a3b8)',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1rem',
                    flexShrink: 0
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Financial & Progress Metric Capsule Bar */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: '10px',
                background: 'var(--bg-surface, rgba(255, 255, 255, 0.03))',
                border: '1px solid var(--border, rgba(255, 255, 255, 0.06))',
                borderRadius: '12px',
                padding: '12px 16px',
                marginBottom: '18px'
              }}>
                <div>
                  <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted, #94a3b8)', fontWeight: 700, letterSpacing: '0.5px' }}>
                    Target Campaign Goal
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary, #ffffff)', marginTop: '2px' }}>
                    ₱{targetPhp}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted, #94a3b8)', fontWeight: 700, letterSpacing: '0.5px' }}>
                    Settled to Date
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#22c55e', marginTop: '2px' }}>
                    ₱{currentPhp} <span style={{ fontSize: '0.74rem', color: '#22c55e', fontWeight: 700 }}>({progressPercent}% Funded)</span>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted, #94a3b8)', fontWeight: 700, letterSpacing: '0.5px' }}>
                    Audit Protocol
                  </div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#22c55e', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>gavel</span> Sepolia EVM Audited
                  </div>
                </div>
              </div>

              {/* 1. Target Region & Location GPS Interactive Map Box (2-Column Grid) */}
              <div style={{
                background: 'var(--bg-surface, rgba(255, 255, 255, 0.03))',
                border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
                borderRadius: '14px',
                padding: '16px 18px',
                marginBottom: '18px',
                transition: 'background var(--transition), border-color var(--transition)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-symbols-outlined" style={{ color: '#ef4444', fontSize: '1.3rem' }}>
                      location_on
                    </span>
                    <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary, #ffffff)' }}>
                      Target Location & Interactive Audit Map
                    </span>
                  </div>
                  <span style={{ fontSize: '0.72rem', background: 'rgba(34, 197, 94, 0.12)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                    GPS LIVE AUDIT
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', alignItems: 'center' }}>
                  {/* Left Column: Location Details & Impact Summary */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>
                        Target Relief Location
                      </div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary, #ffffff)', marginTop: '3px', lineHeight: 1.35 }}>
                        📍 {audit.region}
                      </div>
                    </div>

                    {audit.gps && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #cbd5e1)' }}>
                        📡 <strong>Coordinates:</strong> <span style={{ color: '#22c55e', fontWeight: 700, fontFamily: 'var(--font-mono, monospace)' }}>{audit.gps}</span>
                      </div>
                    )}

                    {/* Impact & Contact Card */}
                    <div style={{
                      background: 'var(--bg-input, rgba(0, 0, 0, 0.25))',
                      border: '1px solid var(--border, rgba(255, 255, 255, 0.06))',
                      borderRadius: '10px',
                      padding: '10px 12px'
                    }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>
                        Estimated Beneficiaries / Impact Scope
                      </div>
                      <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#22c55e', marginTop: '2px' }}>
                        {audit.beneficiaries}
                      </div>
                      {audit.contact && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)', marginTop: '4px' }}>
                          📞 Response Desk: <span style={{ color: 'var(--text-secondary, #cbd5e1)', fontWeight: 600 }}>{audit.contact}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Square Read-Only Leaflet Map */}
                  <div style={{
                    width: '100%',
                    height: '200px',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                    background: 'var(--bg-input, #111111)'
                  }}>
                    <LocationMapPicker
                      address={audit.region}
                      gps={audit.gps}
                      readOnly={true}
                      height="200px"
                      hideTip={true}
                    />
                  </div>
                </div>
              </div>

              {/* Mission Purpose & Campaign Scope Description Box */}
              <div style={{
                background: 'var(--bg-surface, rgba(255, 255, 255, 0.03))',
                border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '18px',
                transition: 'background var(--transition), border-color var(--transition)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ margin: 0, fontSize: '0.92rem', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1.15rem' }}>description</span> Mission Purpose & Humanitarian Scope
                  </h4>
                  {audit.targetDate && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #e2e8f0)', background: 'var(--bg-input, rgba(0, 0, 0, 0.3))', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--border, rgba(255,255,255,0.08))' }}>
                      📅 Target: {audit.targetDate}
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary, #cbd5e1)', lineHeight: '1.6', whiteSpace: 'pre-line' }}>
                  {audit.description}
                </p>
                {audit.documentUrl && (
                  <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed var(--border, rgba(255,255,255,0.1))' }}>
                    <a
                      href={audit.documentUrl.startsWith('http') ? audit.documentUrl : `https://${audit.documentUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: '0.8rem', color: '#22c55e', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700, textDecoration: 'none' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>open_in_new</span> Official Verification / Press Release Audit Document
                    </a>
                  </div>
                )}
              </div>

              {/* 2. Fund Allocation Breakdown */}
              {audit.allocations && Array.isArray(audit.allocations) && audit.allocations.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ fontSize: '0.92rem', color: 'var(--text-primary, #ffffff)', fontWeight: 800, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-symbols-outlined" style={{ color: '#22c55e', fontSize: '1.2rem' }}>pie_chart</span>
                    Transparency Allocation & Necessities Breakdown
                  </h4>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
                    {audit.allocations.map((item, idx) => (
                      <div key={idx} style={{
                        background: 'var(--bg-surface, rgba(255, 255, 255, 0.03))',
                        border: '1px solid var(--border, rgba(255, 255, 255, 0.06))',
                        borderRadius: '10px',
                        padding: '10px 12px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary, #e2e8f0)' }}>
                            {item.label}
                          </span>
                          <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#22c55e' }}>
                            {item.pct}%
                          </span>
                        </div>
                        <div style={{ background: 'var(--bg-input, rgba(0, 0, 0, 0.3))', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${item.pct}%`, height: '100%', background: 'linear-gradient(90deg, #16a34a, #22c55e)' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                <button
                  className="btn btn-outline"
                  style={{ flex: 1, padding: '11px 16px', fontSize: '0.88rem' }}
                  onClick={() => setDetailsOpen(false)}
                >
                  Close Audit
                </button>

                {canDonate && (
                  <button
                    className="btn btn-primary glow"
                    style={{ flex: 1.6, padding: '11px 16px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    onClick={() => {
                      setDetailsOpen(false);
                      setModalOpen(true);
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>volunteer_activism</span>
                    Donate to Campaign
                  </button>
                )}
              </div>

            </div>
          </div>
          , document.body);
      })()}
    </div>
  );
}
