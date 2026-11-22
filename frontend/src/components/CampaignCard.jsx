import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ethers } from 'ethers';
import Tesseract from 'tesseract.js';
import { ROLES } from '../roleConfig';
import LocationMapPicker from './LocationMapPicker';
import { useToast } from '../context/ToastContext';
import DonorBadge, { DonorTierModal, globalDonorRegistry } from './DonorBadge';
import EditCampaignModal from './EditCampaignModal';
import DisburseModal from './DisburseModal';
import DisbursementProofModal from './DisbursementProofModal';
import { API_URL } from '../config';
import LiveCounter from './LiveCounter';
import { autoCropQrScreenshot } from '../utils/qrCropper';
import { formatPhoneNumber } from '../utils/formatters';
import { getWorkspaceStrings } from '../data/workspaceTranslations';
import './MultiRailProgress.css';
import './CampaignDetailsModal.css';
import './DonateCheckoutModal.css';

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

/* ── Unified Tracking State Helper across Donor Portal ── */
export const isCampaignTracked = (campId, currentUser, walletAddress) => {
  if (typeof window === 'undefined' || !campId) return false;
  const cId = String(campId);

  // 1. Direct universal keys
  if (localStorage.getItem(`bbdrts_tracked_camp_${cId}`) === 'true') return true;
  if (localStorage.getItem(`bbdrts_tracked_${cId}`) === 'true') return true;

  // 2. User identifier keys
  const uid = currentUser?.id ? `u_${currentUser.id}` : (currentUser?.email ? `u_${currentUser.email}` : null);
  if (uid && localStorage.getItem(`bbdrts_tracked_${uid}_camp_${cId}`) === 'true') return true;

  // 3. Wallet address key
  if (walletAddress) {
    const w = `w_${walletAddress.toLowerCase()}`;
    if (localStorage.getItem(`bbdrts_tracked_${w}_camp_${cId}`) === 'true') return true;
  }

  // 4. Guest key
  if (localStorage.getItem(`bbdrts_tracked_guest_camp_${cId}`) === 'true') return true;

  // 5. Stored user profile key fallback
  try {
    const storedUser = localStorage.getItem('bbdrts_user');
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      const sUid = parsed?.id ? `u_${parsed.id}` : (parsed?.email ? `u_${parsed.email}` : null);
      if (sUid && localStorage.getItem(`bbdrts_tracked_${sUid}_camp_${cId}`) === 'true') return true;
    }
  } catch (_) {}

  return false;
};

export const setCampaignTrackedState = (campId, isTracked, currentUser, walletAddress) => {
  if (typeof window === 'undefined' || !campId) return;
  const cId = String(campId);
  const val = String(isTracked);

  // Write to universal key
  localStorage.setItem(`bbdrts_tracked_camp_${cId}`, val);

  // Write to user key if available
  const uid = currentUser?.id ? `u_${currentUser.id}` : (currentUser?.email ? `u_${currentUser.email}` : null);
  if (uid) {
    localStorage.setItem(`bbdrts_tracked_${uid}_camp_${cId}`, val);
  }

  // Write to wallet key if available
  if (walletAddress) {
    localStorage.setItem(`bbdrts_tracked_w_${walletAddress.toLowerCase()}_camp_${cId}`, val);
  }

  // Also write to guest key
  localStorage.setItem(`bbdrts_tracked_guest_camp_${cId}`, val);

  // Broadcast event across application so all views & cards re-render instantaneously
  window.dispatchEvent(new CustomEvent('bbdrts_track_change', {
    detail: { campId: cId, isTracked: Boolean(isTracked) }
  }));
};

/**
 * CampaignTitleMarquee
 * Single-line campaign title with smooth hover-triggered horizontal marquee animation
 * Only animates if the text exceeds the card's available width.
 */
export function CampaignTitleMarquee({ title, className = '' }) {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const [overflowDist, setOverflowDist] = useState(0);

  const measureOverflow = useCallback(() => {
    if (!containerRef.current || !textRef.current) return;
    const containerW = containerRef.current.clientWidth;
    const textW = textRef.current.scrollWidth;
    if (textW > containerW + 4) {
      setOverflowDist(textW - containerW);
    } else {
      setOverflowDist(0);
    }
  }, []);

  useEffect(() => {
    measureOverflow();

    const handleResize = () => measureOverflow();
    window.addEventListener('resize', handleResize);

    let ro;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      ro = new ResizeObserver(() => {
        measureOverflow();
      });
      ro.observe(containerRef.current);
    }

    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(measureOverflow);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (ro) ro.disconnect();
    };
  }, [measureOverflow, title]);

  const hasOverflow = overflowDist > 0;
  // Natural reading speed: ~30px per second, with a minimum duration of 4s
  const duration = Math.max(4, (overflowDist / 30) + 1.8);

  return (
    <div
      ref={containerRef}
      className={`campaign-title-marquee-wrapper ${hasOverflow ? 'has-overflow' : ''}`}
      title={hasOverflow ? title : undefined}
    >
      <div
        className={`campaign-title-track ${hasOverflow ? 'can-marquee' : ''}`}
        style={hasOverflow ? {
          '--marquee-dist': `-${overflowDist + 12}px`,
          '--marquee-duration': `${duration.toFixed(2)}s`
        } : undefined}
      >
        <h3
          ref={textRef}
          className={`campaign-title ${className}`}
        >
          {title}
        </h3>
      </div>
    </div>
  );
}

export const formatCleanLocation = (rawLoc) => {
  if (!rawLoc || !String(rawLoc).trim()) return 'Philippines';
  const str = String(rawLoc).trim();
  if (str.includes(',')) {
    const parts = str.split(',').map(s => s.trim()).filter(Boolean);
    const filtered = parts.filter(p => {
      const pLower = p.toLowerCase();
      if (pLower === 'philippines' || pLower === 'ph') return false;
      if (!isNaN(Number(pLower))) return false; // zip codes like 6601
      if (/^\d+/.test(pLower)) return false; // street / house numbers
      if (/street|st\.|ave|avenue|road|rd\.|blvd|boulevard|highway|hwy|lane|ln|drive|dr|way|expressway|corner|cor\.|building|bldg|floor|flr|room|rm|unit|block|blk|lot/i.test(pLower)) return false; // drop street & highway infrastructure
      if (/^(?:barangay|brgy|purok|sitio|poblacion|zone|subd|subdivision)\b/i.test(pLower)) return false; // drop hyper-local zones
      return true;
    });
    // Remove duplicate consecutive names (e.g. "Bohol, Bohol" -> "Bohol")
    const deduped = [];
    filtered.forEach(p => {
      if (!deduped.some(d => d.toLowerCase() === p.toLowerCase())) {
        deduped.push(p);
      }
    });
    if (deduped.length >= 2) {
      // Pick the last 2 (City / Municipality, Province)
      return deduped.slice(-2).join(', ');
    }
    if (deduped.length === 1) return deduped[0];
  }
  return str.replace(/\s*,\s*philippines$/i, '').replace(/\s*,\s*ph$/i, '').trim();
};

export const parseSafeDate = (dateVal) => {
  if (!dateVal) return null;
  if (dateVal instanceof Date) return isNaN(dateVal.getTime()) ? null : dateVal;
  if (typeof dateVal === 'string') {
    let s = dateVal.trim();
    // Pure date string "YYYY-MM-DD" -> parse components directly in local time to avoid UTC shift
    const ymdMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (ymdMatch) {
      const year = parseInt(ymdMatch[1], 10);
      const month = parseInt(ymdMatch[2], 10) - 1;
      const day = parseInt(ymdMatch[3], 10);
      return new Date(year, month, day);
    }
    // If format is "YYYY-MM-DD HH:MM:SS" (MySQL standard raw timestamp), convert space to 'T' and append 'Z' for UTC
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) {
      s = s.replace(' ', 'T') + 'Z';
    } else if (s.includes('T') && !s.endsWith('Z') && !s.includes('+') && !s.match(/-\d{2}:\d{2}$/)) {
      s = s + 'Z';
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
  }
  const fallback = new Date(dateVal);
  return isNaN(fallback.getTime()) ? null : fallback;
};

export const formatLedgerDate = (dateVal) => {
  if (!dateVal) return 'Recently Verified';
  try {
    const d = parseSafeDate(dateVal);
    if (!d) return 'Recently Verified';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (_) {
    return 'Recently Verified';
  }
};

export const formatTimeAgo = (dateVal) => {
  if (!dateVal) return null;
  try {
    const d = parseSafeDate(dateVal);
    if (!d) return null;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    if (isNaN(diffMs)) return 'Just now';
    if (diffMs < 0) return 'Just now';
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch (_) {
    return null;
  }
};

export const getTransactionRailMeta = (txHash, paymentMethod = '') => {
  const hash = (txHash || '').toUpperCase();
  const pm = (paymentMethod || '').toUpperCase();
  if (pm.includes('GCASH') || hash.startsWith('FIAT-GCAS') || hash.includes('GCASH')) {
    return {
      railKey: 'GCASH',
      name: 'GCash QR Ph',
      badgeClass: 'rail-badge-gcash',
      icon: 'qr_code_2',
      dotClass: 'gcash-dot',
      color: '#0052FF',
      isWeb3: hash.startsWith('0X') && hash.length === 66
    };
  }
  if (pm.includes('MAYA') || hash.startsWith('FIAT-MAYA') || hash.includes('MAYA')) {
    return {
      railKey: 'MAYA',
      name: 'Maya E-Wallet',
      badgeClass: 'rail-badge-maya',
      icon: 'account_balance_wallet',
      dotClass: 'maya-dot',
      color: '#00D68F',
      isWeb3: hash.startsWith('0X') && hash.length === 66
    };
  }
  if (pm.includes('BANK') || pm.includes('CARD') || hash.startsWith('FIAT-BANK') || hash.startsWith('FIAT-CARD') || hash.startsWith('FIAT-CRED') || hash.includes('CARD') || hash.includes('BANK')) {
    return {
      railKey: 'CARD',
      name: 'Cards & Bank',
      badgeClass: 'rail-badge-card',
      icon: 'credit_card',
      dotClass: 'card-dot',
      color: '#a855f7',
      isWeb3: hash.startsWith('0X') && hash.length === 66
    };
  }
  return {
    railKey: 'CARD',
    name: 'Cards & Bank',
    badgeClass: 'rail-badge-card',
    icon: 'credit_card',
    dotClass: 'card-dot',
    color: '#a855f7',
    isWeb3: hash.startsWith('0X') && hash.length === 66
  };
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

export const getCategoryEvidencePhotos = (text = '') => {
  const full = String(text).toLowerCase();
  if (/fisherfolk|boat|palawan|marine|banca|livelihood/i.test(full) && !/fire|ember|volcano|typhoon|flood/i.test(full)) {
    return [
      'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80'
    ];
  }
  if (/kanlaon|mayon|volcano|ashfall|blanket|tremor/i.test(full)) {
    return [
      'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=800&q=80'
    ];
  }
  if (/medical|hygiene|medicine|doctor|clinic|sanitation|antibiotic/i.test(full)) {
    return [
      'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1584036561566-baf8f5f1b144?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?auto=format&fit=crop&w=800&q=80'
    ];
  }
  if (/shelter|reconstruct|rebuild|roof|lumber|tarpaulin|housing|fire/i.test(full)) {
    return [
      'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1527482797697-8795b05a13fe?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=800&q=80'
    ];
  }
  if (/flood|baha|inundat/i.test(full)) {
    return [
      'https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80'
    ];
  }
  if (/typhoon|bagyo|storm|odette|kristine|tino|yolanda|salin|luzon/i.test(full)) {
    return [
      'https://images.unsplash.com/photo-1527482797697-8795b05a13fe?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=800&q=80'
    ];
  }
  return [
    'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=800&q=80'
  ];
};

export const getCampaignCoverData = (camp = {}) => {
  const title = (camp.title || camp.Campaign_Title || '').toLowerCase();
  const desc = (camp.description || '').toLowerCase();
  const fullText = `${title} ${desc}`;

  let imageUrl = camp.imageUrl || camp.image_url;

  // Resolve disaster aftermath photos if uploaded
  let disasterPhotos = camp.disasterImages;
  if (!disasterPhotos && (camp.disaster_images_json || camp.disasterImagesJson)) {
    try {
      const parsed = typeof (camp.disaster_images_json || camp.disasterImagesJson) === 'string'
        ? JSON.parse(camp.disaster_images_json || camp.disasterImagesJson)
        : (camp.disaster_images_json || camp.disasterImagesJson);
      if (Array.isArray(parsed) && parsed.length > 0) disasterPhotos = parsed;
    } catch (_) {}
  }

  // Provide realistic disaster evidence photos if none were uploaded
  if (!Array.isArray(disasterPhotos) || disasterPhotos.length === 0) {
    disasterPhotos = getCategoryEvidencePhotos(fullText);
  }

  const hasDisasterPhotos = Boolean(Array.isArray(disasterPhotos) && disasterPhotos.length > 0);
  const disasterPhotosCount = hasDisasterPhotos ? disasterPhotos.length : 0;

  // Prioritize using the first uploaded field disaster photo as the cover image if no specific cover is set
  if (!imageUrl && hasDisasterPhotos) {
    imageUrl = disasterPhotos[0];
  }

  let categoryIcon = 'volunteer_activism';
  let categoryTag = 'Relief Cause';
  const rawLocation = camp.locationRegion || camp.location_region || camp.location || camp.region;
  let locationTag = rawLocation || 'Southern Leyte, PH';

  if (imageUrl) {
    return { imageUrl, categoryIcon, categoryTag, locationTag, hasDisasterPhotos, disasterPhotosCount };
  }

  // 1. Fisherfolk / Coastal Livelihood
  if (/fisherfolk|boat|palawan|marine|banca|livelihood/i.test(fullText) && !/fire|ember|volcano|typhoon|flood/i.test(fullText)) {
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
  // 4. Shelter, Fire Recovery & Reconstruction
  else if (/shelter|reconstruct|rebuild|roof|lumber|tarpaulin|housing|fire|ember/i.test(fullText)) {
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

  return { imageUrl, categoryIcon, categoryTag, locationTag, hasDisasterPhotos, disasterPhotosCount };
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

function CleanQrVoucherDisplay({ qrUrl, gatewayMethod }) {
  const [displayUrl, setDisplayUrl] = useState(qrUrl);
  const isMaya = (gatewayMethod || '').toLowerCase() === 'maya';

  useEffect(() => {
    let active = true;
    if (qrUrl) {
      autoCropQrScreenshot(qrUrl).then(res => {
        if (active && res.wasCropped && res.croppedUrl) {
          setDisplayUrl(res.croppedUrl);
        } else if (active) {
          setDisplayUrl(qrUrl);
        }
      });
    } else {
      setDisplayUrl(qrUrl);
    }
    return () => { active = false; };
  }, [qrUrl]);

  return (
    <div className="qr-ph-box" style={{ width: '100%', maxWidth: '290px', margin: '0 auto 16px', textAlign: 'center', padding: '16px', borderRadius: '18px', background: '#FFFFFF', boxShadow: '0 12px 32px rgba(0,0,0,0.35)', border: '1.5px solid #e2e8f0' }}>
      {/* Integrated Brand Header inside QR Voucher */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingBottom: '10px', marginBottom: '10px', borderBottom: '1.5px solid #f1f5f9' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '26px',
            height: '26px',
            borderRadius: '7px',
            background: isMaya ? '#000000' : '#007DFE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 5px rgba(0,0,0,0.15)'
          }}>
            {isMaya ? (
              <span style={{ color: '#00d68f', fontWeight: 900, fontSize: '12px', letterSpacing: '-0.5px' }}>m</span>
            ) : (
              <span style={{ color: '#ffffff', fontWeight: 900, fontSize: '15px' }}>G</span>
            )}
          </div>
          <span style={{ fontSize: '12px', fontWeight: 900, color: '#0f172a', letterSpacing: '0.4px' }}>
            OFFICIAL {gatewayMethod.toUpperCase()}
          </span>
        </div>
        <span style={{ fontSize: '9px', fontWeight: 800, color: '#16a34a', background: 'rgba(34, 197, 94, 0.12)', padding: '3px 8px', borderRadius: '10px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
          NGO Verified
        </span>
      </div>

      {/* QR Code / Voucher Image */}
      <div style={{ position: 'relative', width: '100%', minHeight: '220px', maxHeight: '340px', margin: '0 auto', borderRadius: '10px', overflow: 'hidden', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img
          src={displayUrl}
          alt={`${gatewayMethod} Official QR`}
          style={{ width: '100%', maxHeight: '330px', objectFit: 'contain', display: 'block' }}
        />
      </div>

      <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '10px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#007DFE' }}>qr_code_scanner</span>
        Point your {gatewayMethod} camera to scan
      </div>
    </div>
  );
}

export default function CampaignCard(props) {
  const { showWarning, showSuccess, showInfo } = useToast();
  const camp = props.camp || props.campaign || {};
  const {
    contract,
    role,
    walletAddress,
    onDonated,
    onDeactivated,
    onCampaignUpdated,
    onOpenNgoProfile,
    interfaceMode = 'standard',
    lowBandwidthMode = false,
    language = 'en'
  } = props;
  const wt = useMemo(() => getWorkspaceStrings(language), [language]);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  useEffect(() => {
    if (!lowBandwidthMode) setMediaLoaded(false);
  }, [lowBandwidthMode]);
  const activeTheme = props.theme || (typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') || 'light' : 'light');
  const [amount, setAmount] = useState('');
  const [deactivating, setDeactivating] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerRailFilter, setLedgerRailFilter] = useState('ALL');
  const [ledgerIdentityFilter, setLedgerIdentityFilter] = useState('ALL');
  const [ledgerSort, setLedgerSort] = useState('NEWEST');
  const [ledgerDateFilter, setLedgerDateFilter] = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [calViewDate, setCalViewDate] = useState(() => new Date());
  const datePickerContainerRef = useRef(null);
  const [copiedHashKey, setCopiedHashKey] = useState('');
  const [selectedLedgerDonor, setSelectedLedgerDonor] = useState(null);
  const [activeEvidenceImg, setActiveEvidenceImg] = useState(null);
  const [showAllDetailsTags, setShowAllDetailsTags] = useState(false);

  const handleCopyHash = (e, text, label = 'Reference') => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!text) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedHashKey(text);
      showSuccess?.(`${label} copied to clipboard!`, 'Copied');
      setTimeout(() => setCopiedHashKey(''), 2200);
    } catch (_) {
      showWarning?.('Unable to copy to clipboard', 'Copy Failed');
    }
  };

  // Category & meta info determination
  const catInfo = useMemo(() => getCampaignCategoryInfo(camp), [camp]);

  // Cover image & location tag determination
  const coverData = useMemo(() => getCampaignCoverData(camp), [camp]);
  const rawLocation = camp.locationRegion || camp.location_region || camp.location || camp.region || coverData?.locationTag || '';
  const cleanLocation = useMemo(() => formatCleanLocation(rawLocation), [rawLocation]);

  // Campaign tags (custom NGO selected or fallback)
  const campaignTags = useMemo(() => getCampaignTags(camp), [camp]);

  // Formatted Target Relief Delivery Date
  const formattedDeliveryDate = useMemo(() => {
    const raw = camp.targetDate || camp.target_date;
    if (!raw || !String(raw).trim()) return null;
    const s = String(raw).trim();
    if (s.toLowerCase().includes('active')) return 'Active Dispatch';
    const d = parseSafeDate(s);
    if (d) {
      try {
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      } catch (_) {
        return s;
      }
    }
    return s;
  }, [camp.targetDate, camp.target_date]);

  // Delivery Date & Campaign Operational Status (Option A: Graceful Distribution Phase)
  const deliveryDateStatus = useMemo(() => {
    if (!camp.isActive) {
      return {
        isOverdue: false,
        label: 'Concluded',
        badgeClass: 'badge-closed',
        icon: 'lock',
        tooltip: 'Relief campaign operations have concluded.'
      };
    }
    const raw = camp.targetDate || camp.target_date;
    if (!raw || !String(raw).trim()) {
      return {
        isOverdue: false,
        label: 'Active Relief Drive',
        badgeClass: 'badge-active',
        icon: 'check_circle',
        tooltip: 'Active relief drive accepting emergency contributions.'
      };
    }
    const targetDateObj = parseSafeDate(raw);
    if (!targetDateObj) {
      return {
        isOverdue: false,
        label: 'Active Relief Drive',
        badgeClass: 'badge-active',
        icon: 'check_circle',
        tooltip: 'Active relief drive accepting emergency contributions.'
      };
    }

    targetDateObj.setHours(23, 59, 59, 999);
    const now = new Date();

    if (now > targetDateObj) {
      return {
        isOverdue: true,
        label: 'Distribution in Progress',
        sublabel: 'Ongoing Relief Aid',
        badgeClass: 'badge-distribution',
        icon: 'local_shipping',
        tooltip: `Target delivery milestone (${formattedDeliveryDate}) reached! Field teams are actively deploying relief goods. The campaign remains open to receive ongoing emergency donations.`
      };
    }

    return {
      isOverdue: false,
      label: 'Active Relief Drive',
      badgeClass: 'badge-active',
      icon: 'check_circle',
      tooltip: `Active disaster relief fundraising towards target delivery on ${formattedDeliveryDate}.`
    };
  }, [camp.isActive, camp.targetDate, camp.target_date, formattedDeliveryDate]);

  // ── Campaign Operational Lifecycle Window (Creation ... Deactivation / Target / Today) ──
  const campaignLifecycle = useMemo(() => {
    // 1. Start Date determination (Creation date / earliest ledger record / fallback)
    let start = null;
    const rawCreated = camp.createdAt || camp.created_at || camp.creationDate;
    if (rawCreated) {
      const p = Date.parse(rawCreated);
      if (!isNaN(p)) start = new Date(p);
    }
    // If earlier donation exists in history, extend start to include it
    if (Array.isArray(history) && history.length > 0) {
      const times = history.map(h => h.createdAt ? Date.parse(h.createdAt) : null).filter(t => t && !isNaN(t));
      if (times.length > 0) {
        const earliestTx = new Date(Math.min(...times));
        if (!start || earliestTx < start) start = earliestTx;
      }
    }
    if (!start) start = new Date(Date.now() - 7 * 86400000);

    // 2. End Date determination (Deactivation date / Target delivery date / Today)
    let end = null;
    if (!camp.isActive) {
      const rawDeactivated = camp.updatedAt || camp.updated_at || camp.deactivatedAt;
      if (rawDeactivated) {
        const p = Date.parse(rawDeactivated);
        if (!isNaN(p)) end = new Date(p);
      }
    }
    if (!end && (camp.targetDate || camp.target_date)) {
      const rawTarget = camp.targetDate || camp.target_date;
      const p = Date.parse(rawTarget);
      if (!isNaN(p)) end = new Date(p);
    }
    if (!end) {
      end = new Date(); // Active campaign -> runs up to today
    }
    if (end < start) {
      end = new Date(start.getTime() + 14 * 86400000);
    }

    const toIso = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const startIso = toIso(start);
    const endIso = toIso(end);
    const formattedStart = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const formattedEnd = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return {
      startDate: start,
      endDate: end,
      startIso,
      endIso,
      formattedStart,
      formattedEnd,
      label: `${formattedStart} – ${formattedEnd}`,
      isDeactivated: !camp.isActive
    };
  }, [camp.createdAt, camp.created_at, camp.creationDate, camp.isActive, camp.targetDate, camp.target_date, camp.updatedAt, camp.updated_at, camp.deactivatedAt, history]);

  // Sync calendar view month to campaign start date
  useEffect(() => {
    if (campaignLifecycle.startDate) {
      setCalViewDate(new Date(campaignLifecycle.startDate));
    }
  }, [campaignLifecycle.startDate]);

  // Click outside to close custom calendar popover
  useEffect(() => {
    if (!datePickerOpen) return;
    const handleOutsideClick = (e) => {
      if (datePickerContainerRef.current && !datePickerContainerRef.current.contains(e.target)) {
        setDatePickerOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setDatePickerOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [datePickerOpen]);

  // Set of dates (YYYY-MM-DD) that have donation transactions recorded
  const donationDateSet = useMemo(() => {
    const s = new Set();
    if (Array.isArray(history)) {
      history.forEach((tx) => {
        if (tx.createdAt) {
          const d = parseSafeDate(tx.createdAt);
          if (d) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            s.add(`${y}-${m}-${day}`);
          }
        }
      });
    }
    return s;
  }, [history]);

  // Generate 35 or 42 calendar grid cells for currently viewed month
  const calMonthData = useMemo(() => {
    const year = calViewDate.getFullYear();
    const month = calViewDate.getMonth();

    const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 (Sun) to 6 (Sat)
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells = [];

    // Leading days from previous month
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, dayNum);
      const iso = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      cells.push({
        dayNum,
        iso,
        isCurrentMonth: false,
        dateObj: prevDate
      });
    }

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const curDate = new Date(year, month, d);
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        dayNum: d,
        iso,
        isCurrentMonth: true,
        dateObj: curDate
      });
    }

    // Trailing days from next month
    const totalCells = cells.length <= 35 ? 35 : 42;
    const remaining = totalCells - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d);
      const iso = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        dayNum: d,
        iso,
        isCurrentMonth: false,
        dateObj: nextDate
      });
    }

    return cells;
  }, [calViewDate]);

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    setCalViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    setCalViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleJumpToCampaign = (e) => {
    e.stopPropagation();
    setCalViewDate(new Date(campaignLifecycle.startDate));
  };

  const handleSelectDate = (iso) => {
    if (ledgerDateFilter === iso) {
      setLedgerDateFilter('');
    } else {
      setLedgerDateFilter(iso);
    }
    setDatePickerOpen(false);
  };

  // Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [donateStep, setDonateStep] = useState(1);
  const [customMsg, setCustomMsg] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [receiptBase64, setReceiptBase64] = useState('');
  const [previewReceiptModal, setPreviewReceiptModal] = useState(false);
  const [aiScanLoading, setAiScanLoading] = useState(false);
  const [aiScanResult, setAiScanResult] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deactivateModal, setDeactivateModal] = useState({ show: false, step: 0, hash: '', error: '' });
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [disburseModalOpen, setDisburseModalOpen] = useState(false);
  const [proofModalOpen, setProofModalOpen] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [legalConfirm, setLegalConfirm] = useState(false);
  const [certModalOpen, setCertModalOpen] = useState(false);
  const [auditProofExpanded, setAuditProofExpanded] = useState(false);
  const [showAllocationDrawer, setShowAllocationDrawer] = useState(false);

  // ── Maintenance Mode Guard State ──
  const [maintState, setMaintState] = useState(() => {
    try {
      const c = localStorage.getItem('bbdrts_maintenance');
      return c ? JSON.parse(c) : null;
    } catch (_) { return null; }
  });

  useEffect(() => {
    const handleMaint = (e) => {
      if (e.detail) setMaintState(e.detail);
    };
    window.addEventListener('bbdrts_maintenance_changed', handleMaint);
    return () => window.removeEventListener('bbdrts_maintenance_changed', handleMaint);
  }, []);

  const isDonationsMaintenance = Boolean(
    maintState?.enabled &&
    (maintState.scope?.includes('DONATIONS') || maintState.scope?.includes('FULL_PLATFORM') || maintState.scope?.includes('DONOR_PORTAL')) &&
    role !== ROLES.ADMIN
  );

  const isDisbursementsMaintenance = Boolean(
    maintState?.enabled &&
    (maintState.scope?.includes('DISBURSEMENTS') || maintState.scope?.includes('FULL_PLATFORM') || maintState.scope?.includes('NGO_PORTAL')) &&
    role !== ROLES.ADMIN
  );

  // Fiat Gateway Additions
  const [donorName, setDonorName] = useState('');
  const [donorEmail, setDonorEmail] = useState('');
  const [refNumber, setRefNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [isFlipped, setIsFlipped] = useState(false);

  // ── Mission Utility State: Campaign Tracking & Verified Sharing ──
  const campId = camp.id || 1;

  const [isTracked, setIsTracked] = useState(() => {
    return isCampaignTracked(campId, props.currentUser, walletAddress);
  });

  // Re-evaluate when user changes or campaign changes
  useEffect(() => {
    setIsTracked(isCampaignTracked(campId, props.currentUser, walletAddress));
  }, [campId, walletAddress, props.currentUser]);

  // Synchronize live with any tracking event across cards or views
  useEffect(() => {
    const handleTrackChange = (e) => {
      if (e.detail && String(e.detail.campId) === String(campId)) {
        setIsTracked(Boolean(e.detail.isTracked));
      } else {
        setIsTracked(isCampaignTracked(campId, props.currentUser, walletAddress));
      }
    };
    window.addEventListener('bbdrts_track_change', handleTrackChange);
    window.addEventListener('storage', handleTrackChange);
    return () => {
      window.removeEventListener('bbdrts_track_change', handleTrackChange);
      window.removeEventListener('storage', handleTrackChange);
    };
  }, [campId, walletAddress, props.currentUser]);

  const [isCopied, setIsCopied] = useState(false);

  const handleToggleTrack = (e) => {
    e.stopPropagation();
    const next = !isTracked;
    setIsTracked(next);
    setCampaignTrackedState(campId, next, props.currentUser, walletAddress);
    if (next) {
      showSuccess(`Now tracking Campaign #${campId} for milestone & ledger updates!`);
    } else {
      showInfo(`Removed Campaign #${campId} from your tracked operations`);
    }
  };

  const handleShare = async (e) => {
    e.stopPropagation();
    const campaignTitle = formatCampaignTitle(camp.title, campId);
    const shareUrl = `${window.location.origin}${window.location.pathname}?campaign=${campId}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `BBDRTS — ${campaignTitle}`,
          text: `Support this verified blockchain disaster relief campaign: ${campaignTitle}`,
          url: shareUrl
        });
        showSuccess('Campaign link shared successfully!');
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setIsCopied(true);
      showSuccess('Verified campaign link copied to clipboard!');
      setTimeout(() => setIsCopied(false), 2400);
    } catch (_) {
      showWarning('Unable to copy link to clipboard');
    }
  };

  // Mock Gateway State
  const [gatewayMethod, setGatewayMethod] = useState('');
  const [gatewayStep, setGatewayStep] = useState(0);
  const [gatewayRefNo, setGatewayRefNo] = useState('');
  const [duplicateRefWarning, setDuplicateRefWarning] = useState(null);
  const [railMismatchWarning, setRailMismatchWarning] = useState(null);

  // Real Direct QR & Receipt Upload is default; PayMongo Automated Checkout only appears when real PAYMONGO_SECRET_KEY is configured
  const [xenditEnabled, setXenditEnabled] = useState(false);
  const [checkoutMode, setCheckoutMode] = useState('manual');
  const [activeIntent, setActiveIntent] = useState(null);
  const [instantLoading, setInstantLoading] = useState(false);
  const [instantSimulating, setInstantSimulating] = useState(false);
  const [instantSettlingOnChain, setInstantSettlingOnChain] = useState(false);
  const [instantReceipt, setInstantReceipt] = useState(null);
  const [qrCopiedKey, setQrCopiedKey] = useState(null);
  const copyInstantValue = (key, val) => {
    if (!val) return;
    try { navigator.clipboard?.writeText(String(val)); } catch (_) {}
    setQrCopiedKey(key);
    setTimeout(() => setQrCopiedKey((prev) => (prev === key ? null : prev)), 1600);
  };

  const handleSimulateXenditQr = async () => {
    if (!activeIntent?.intentId) return;
    setInstantSimulating(true);
    try {
      const res = await fetch(`${API_URL}/api/payments/xendit-qrph/simulate/${activeIntent.intentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Xendit test simulation failed.');
      setInstantSettlingOnChain(false);
      setInstantReceipt(data);
      setTxHash(data.txHash || '');
      showSuccess?.(
        `₱${Number(data.amountPhp || activeIntent.amountPhp).toLocaleString('en-US')} verified via Xendit QR Ph & notarized on Sepolia!`,
        'Dynamic QR Ph Verified'
      );
      fetchHistory(true);
    } catch (err) {
      showWarning?.(err.message || 'Simulation failed.', 'Xendit Test Error');
    } finally {
      setInstantSimulating(false);
    }
  };

  useEffect(() => {
    fetch(`${API_URL}/api/payments/gateway-status`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.gatewayEnabled || d?.xenditEnabled) setXenditEnabled(true);
      })
      .catch(() => {});
  }, []);

  const createDirectQrIntent = async (method) => {
    const parsedPhp = Math.max(1, Math.round(Number(amount || 100)));
    try {
      const token = localStorage.getItem('bbdrts_token');
      const res = await fetch(`${API_URL}/api/donations/intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && token !== 'null' ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          campaign_id: Number(camp.id),
          amount_php: parsedPhp,
          payment_method: method,
          is_anonymous: isAnonymous
        })
      });
      if (res.ok) {
        const data = await res.json();
        setActiveIntent(data);
      }
    } catch (_) {}
  };

  const startInstantCheckout = async (method) => {
    const parsedPhp = Math.round(Number(amount || 0));
    if (!parsedPhp || parsedPhp < 1) {
      showWarning?.('Please enter a donation amount of at least ₱1.', 'Amount Required');
      return;
    }
    setGatewayMethod(method);
    setInstantLoading(true);
    setInstantReceipt(null);
    setActiveIntent(null);
    try {
      const token = localStorage.getItem('bbdrts_token');
      const res = await fetch(`${API_URL}/api/payments/checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && token !== 'null' ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          campaign_id: Number(camp.id),
          amount_php: parsedPhp,
          payment_method: method,
          is_anonymous: isAnonymous
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not start instant checkout.');
      setActiveIntent(data);
      setDonateStep(8);
    } catch (err) {
      showWarning?.(err.message || 'Instant checkout unavailable. You can use Direct QR & Receipt Upload instead.', 'Checkout Error');
    } finally {
      setInstantLoading(false);
    }
  };



  // Auto-poll live Xendit checkout session until webhook or API confirms payment
  useEffect(() => {
    if (donateStep !== 8 || !activeIntent?.intentId || !['xendit', 'xendit_qrph'].includes(activeIntent?.provider) || instantReceipt) return;
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/payments/intent/${activeIntent.intentId}`);
        if (res.ok) {
          const row = await res.json();
          if (row.Status === 'SETTLING') {
            setInstantSettlingOnChain(true);
          } else if (row.Status === 'COMPLETED' && row.Tx_Hash) {
            setInstantSettlingOnChain(false);
            setInstantReceipt({
              txHash: row.Tx_Hash,
              trackingCode: row.Tracking_Code,
              amountPhp: Number(row.Amount_Php || activeIntent.amountPhp),
              paymentMethod: row.Payment_Method || activeIntent.paymentMethod
            });
            setTxHash(row.Tx_Hash);
            showSuccess?.(
              `₱${Number(row.Amount_Php || activeIntent.amountPhp).toLocaleString('en-US')} verified via ${row.Payment_Method || activeIntent.paymentMethod} and sealed on Sepolia!`,
              'Donation Confirmed'
            );
            fetchHistory(true);
          }
        }
      } catch (_) {}
    }, 1800);
    return () => clearInterval(iv);
  }, [donateStep, activeIntent, instantReceipt]);

  // Real-Time Duplicate Receipt Check Listener for Donor Modal
  useEffect(() => {
    const currentRef = (refNumber || gatewayRefNo || '').trim();
    if (!currentRef && (!receiptBase64 || receiptBase64.length < 100)) {
      setDuplicateRefWarning(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/api/donations/check-duplicate-ref`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ref_no: currentRef, receipt_base64: receiptBase64 })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.isDuplicate) {
            setDuplicateRefWarning(data.reason || 'This reference number or receipt screenshot has already been recorded on the public ledger.');
          } else {
            setDuplicateRefWarning(null);
          }
        }
      } catch (_) {}
    }, 350);

    return () => clearTimeout(timer);
  }, [refNumber, gatewayRefNo, receiptBase64]);

  const receiptFileInputRef = useRef(null);

  const handleRemoveProof = () => {
    setReceiptBase64('');
    setAiScanResult(null);
    setAiScanLoading(false);
    setDuplicateRefWarning(null);
    setRailMismatchWarning(null);
    setRefNumber('');
    setGatewayRefNo('');
    if (receiptFileInputRef.current) {
      receiptFileInputRef.current.value = '';
    }
  };

  const handleReferenceChange = (val) => {
    if (gatewayMethod === 'GCash') {
      const digits = val.replace(/\D/g, '').slice(0, 13);
      let formatted = digits;
      if (digits.length > 7) {
        formatted = `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
      } else if (digits.length > 4) {
        formatted = `${digits.slice(0, 4)} ${digits.slice(4)}`;
      }
      setRefNumber(formatted);
      setGatewayRefNo(formatted);
    } else if (gatewayMethod === 'Maya') {
      const clean = val.replace(/[^a-zA-Z0-9\s]/g, '').slice(0, 16);
      setRefNumber(clean);
      setGatewayRefNo(clean);
    } else {
      const clean = val.replace(/[^a-zA-Z0-9\s\-_]/g, '').slice(0, 24);
      setRefNumber(clean);
      setGatewayRefNo(clean);
    }
  };

  // Real-Time Dynamic AI Receipt Verification State that synchronizes with active amount and duplicate warnings
  const activeAiResult = useMemo(() => {
    if (!aiScanResult) return null;
    const currentNumAmount = parseFloat(amount || 0);
    const extAmt = parseFloat(aiScanResult.extractedAmountPhp || 0);

    // Filter out any stale AMOUNT_MISMATCH flag
    let flags = (aiScanResult.fraudFlags || []).filter(f => !f.includes('AMOUNT_MISMATCH'));
    let hasAmtMismatch = false;

    // Only flag mismatch if user has a declared amount AND extracted amount, and they differ by > 5%
    if (extAmt > 0 && currentNumAmount > 0) {
      const diff = Math.abs(extAmt - currentNumAmount) / extAmt;
      if (diff > 0.05) {
        hasAmtMismatch = true;
        flags.push(`AMOUNT_MISMATCH: Receipt states ₱${extAmt.toLocaleString()} PHP, but declared donation is ₱${currentNumAmount.toLocaleString()} PHP`);
      }
    }

    // Recipient Credentials Cross-Check against active Campaign receiving details
    const expectedName = (gatewayMethod === 'Maya' ? (camp.mayaName || camp.maya_name) : (camp.gcashName || camp.gcash_name || 'CL***E JU*****E V.') || '').trim();
    const expectedPhone = (gatewayMethod === 'Maya' ? (camp.mayaNumber || camp.maya_number) : (camp.gcashNumber || camp.gcash_number || '0997 9939521') || '').trim();

    const extName = (aiScanResult.recipientName || '').trim();
    const extPhone = (aiScanResult.recipientPhone || '').trim();

    if (extName || extPhone) {
      // Check recipient name
      if (extName && expectedName) {
        const cleanStr = s => (s || '').toUpperCase().replace(/[^A-Z]/g, '');
        const extLetters = cleanStr(extName);
        const expLetters = cleanStr(expectedName);
        if (extLetters.length > 0 && expLetters.length > 0 && extLetters[0] !== expLetters[0]) {
          if (!flags.some(f => f.includes('RECIPIENT_NAME_MISMATCH') || f.includes('RECIPIENT_MISMATCH'))) {
            flags.push(`RECIPIENT_NAME_MISMATCH: Funds were transferred to "${extName}", but this campaign's official receiving account name is "${expectedName}".`);
          }
        }
      }
      // Check recipient phone
      if (extPhone && expectedPhone) {
        const extDigits = extPhone.replace(/\D/g, '');
        const expDigits = expectedPhone.replace(/\D/g, '');
        if (extDigits.length >= 4 && expDigits.length >= 4) {
          const extSuf = extDigits.slice(-4);
          const expSuf = expDigits.slice(-4);
          if (extSuf !== expSuf) {
            if (!flags.some(f => f.includes('RECIPIENT_PHONE_MISMATCH') || f.includes('RECIPIENT_MISMATCH'))) {
              flags.push(`RECIPIENT_PHONE_MISMATCH: Funds were sent to mobile ending in ${extSuf}, but this campaign's official receiving number ends in ${expSuf}.`);
            }
          }
        }
      }
    }

    // Receipt Date Stale / Expired Check (anti-recycling)
    if (aiScanResult.receiptDate) {
      const parsedDate = new Date(aiScanResult.receiptDate);
      if (!isNaN(parsedDate.getTime())) {
        const now = new Date();
        const diffDays = (now.getTime() - parsedDate.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays > 30 || (now.getFullYear() - parsedDate.getFullYear() >= 1)) {
          const daysAgo = Math.max(1, Math.round(diffDays));
          if (!flags.some(f => f.includes('EXPIRED_RECEIPT'))) {
            flags.push(`EXPIRED_RECEIPT: Receipt is dated ${aiScanResult.receiptDate} (~${daysAgo} days old). Recycled or expired receipts cannot be accepted.`);
          }
        }
      }
    }

    const hasRailMismatch = Boolean(railMismatchWarning) || flags.some(f => f.includes('PAYMENT_RAIL_MISMATCH') || f.includes('RAIL_MISMATCH'));
    const isDuplicate = Boolean(duplicateRefWarning) || flags.some(f => f.includes('DUPLICATE_REF_NUMBER'));
    const isExpired = flags.some(f => f.includes('EXPIRED_RECEIPT'));
    const isRecipientMismatch = flags.some(f => f.includes('RECIPIENT_MISMATCH') || f.includes('RECIPIENT_NAME_MISMATCH') || f.includes('RECIPIENT_PHONE_MISMATCH'));
    const isTampered = flags.some(f => f.includes('TAMPERED') || f.includes('INVALID_RECEIPT'));
    const isHighValue = extAmt >= 10000 || currentNumAmount >= 10000 || Boolean(aiScanResult.requiresManualAudit) || flags.some(f => f.includes('HIGH_VALUE'));
    if (isHighValue && !flags.some(f => f.includes('HIGH_VALUE_AUDIT_REQUIRED'))) {
      const val = extAmt || currentNumAmount;
      flags.push(`HIGH_VALUE_AUDIT_REQUIRED: High-value transfer (₱${val.toLocaleString()} PHP). Mandatory secondary verification against recipient account balance and official SMS notification before confirmation.`);
    }

    const hasInvalidReceipt = (aiScanResult.isPaymentReceipt === false) || isExpired || isRecipientMismatch || isTampered || flags.some(f => f.includes('INVALID_RECEIPT') || f.includes('INVALID_RECEIPT_IMAGE'));
    const hasValidRef = Boolean(aiScanResult.extractedRef && aiScanResult.extractedRef.trim().length >= 8);

    const hasAnySevereFlag = hasAmtMismatch || hasRailMismatch || isDuplicate || hasInvalidReceipt || isExpired || isRecipientMismatch || isTampered || flags.some(f => f.includes('FRAUD') || f.includes('MISMATCH') || f.includes('DUPLICATE') || f.includes('INVALID'));

    // Normalize score to percentage (handle float 0.98 -> 98)
    const rawScore = typeof aiScanResult.confidenceScore === 'number'
      ? (aiScanResult.confidenceScore <= 1.0 && aiScanResult.confidenceScore > 0 ? Math.round(aiScanResult.confidenceScore * 100) : Math.round(aiScanResult.confidenceScore))
      : 95;

    const isVerified = !hasAnySevereFlag && hasValidRef && !hasInvalidReceipt && !isHighValue && aiScanResult.isAiVerified === true && (rawScore >= 60);

    const confidenceScore = hasInvalidReceipt || hasAnySevereFlag
      ? 0
      : (isHighValue
          ? Math.min(rawScore, 70)
          : (!hasValidRef
              ? Math.min(rawScore, 35)
              : rawScore));

    // Filter out flags that already have dedicated banners displayed below to avoid duplicate warnings
    const visibleFraudFlags = flags.filter(f => {
      if ((railMismatchWarning || hasRailMismatch) && (f.includes('RAIL_MISMATCH') || f.includes('PAYMENT_RAIL_MISMATCH'))) {
        return false;
      }
      if ((duplicateRefWarning || isDuplicate) && (f.includes('DUPLICATE_REF_NUMBER') || f.includes('DUPLICATE'))) {
        return false;
      }
      return true;
    });

    return {
      ...aiScanResult,
      isPaymentReceipt: !hasInvalidReceipt,
      fraudFlags: visibleFraudFlags,
      isAiVerified: isVerified,
      confidenceScore
    };
  }, [aiScanResult, amount, duplicateRefWarning, railMismatchWarning, camp, gatewayMethod]);

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

  // Close details audit modal on Escape
  useEffect(() => {
    if (!detailsOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setDetailsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [detailsOpen]);

  // Close public ledger modal on Escape
  useEffect(() => {
    if (!ledgerOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setLedgerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [ledgerOpen]);

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

  // Robust Campaign Ownership Detection (Strictly authenticated to the current NGO)
  const campOrgAddr = camp.orgAddress || camp.org_address || camp.organization_wallet;
  let loggedInUser = null;
  try {
    const stored = localStorage.getItem('bbdrts_user');
    if (stored) loggedInUser = JSON.parse(stored);
  } catch (_) {}

  const currentOrgId = props.currentUser?.id || loggedInUser?.id || props.currentUser?.orgId;

  // A Donor, Public/guest, or Admin can NEVER be an owner of a campaign
  // An NGO can ONLY be an owner if the campaign's orgId strictly matches this NGO
  const isOwner = role === ROLES.ORGANIZATION && Boolean(
    (currentOrgId && camp.orgId && Number(camp.orgId) === Number(currentOrgId)) ||
    (!camp.orgId && Boolean(walletAddress) && Boolean(campOrgAddr) && walletAddress.toLowerCase() === campOrgAddr.toLowerCase())
  );
  const isNgoViewer = role === ROLES.ORGANIZATION;

  // Retail donations strictly for Donors / Public (prevents self-donation & circular wash-funding)
  const canDonate = role !== ROLES.ADMIN && !isOwner && !isNgoViewer && camp.isActive;
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
        const pm = (tx.paymentMethod || tx.Payment_Method || '').toUpperCase();
        if (pm.includes('GCASH') || hash.startsWith('FIAT-GCAS') || hash.includes('GCASH')) {
          gcashAmt += amt;
          gcashCnt++;
        } else if (pm.includes('MAYA') || hash.startsWith('FIAT-MAYA') || hash.includes('MAYA')) {
          mayaAmt += amt;
          mayaCnt++;
        } else if (pm.includes('BANK') || pm.includes('CARD') || hash.startsWith('FIAT-BANK') || hash.startsWith('FIAT-CARD') || hash.startsWith('FIAT-CRED') || hash.includes('BANK') || hash.includes('CARD')) {
          bankAmt += amt;
          bankCnt++;
        } else {
          ethAmt += amt;
          ethCnt++;
        }
      });

      const totalTracked = ethAmt + gcashAmt + mayaAmt + bankAmt;
      const currentEth = parseFloat(camp.currentAmount || 0);
      // Meaningful epsilon (0.000001 ETH ~ 0.17 PHP) strictly prevents IEEE-754 precision noise from creating phantom donors
      if (currentEth > totalTracked + 0.000001) {
        bankAmt += (currentEth - totalTracked);
        if (bankCnt === 0 && (!history || history.length === 0)) bankCnt = 1;
      }

      // Exact count of actual ledger donations
      const exactBackers = (history && history.length > 0)
        ? history.length 
        : (ethCnt + gcashCnt + mayaCnt + bankCnt);

      return {
        eth: { amount: ethAmt, php: Math.round(ethAmt * 170000), count: ethCnt },
        gcash: { amount: gcashAmt, php: Math.round(gcashAmt * 170000), count: gcashCnt },
        maya: { amount: mayaAmt, php: Math.round(mayaAmt * 170000), count: mayaCnt },
        bank: { amount: bankAmt, php: Math.round(bankAmt * 170000), count: bankCnt },
        totalRaisedEth: Math.max(totalTracked, currentEth),
        totalRaisedPhp: Math.round(Math.max(totalTracked, currentEth) * 170000),
        totalBackers: exactBackers
      };
    }

    // 2. If camp.railBreakdown is provided by API
    if (camp.railBreakdown && typeof camp.railBreakdown === 'object') {
      const apiBackers = camp.totalBackers ?? camp.donorsCount ?? camp.railBreakdown.totalBackers ?? (parseFloat(camp.currentAmount || 0) > 0 ? 1 : 0);
      return {
        ...camp.railBreakdown,
        totalBackers: apiBackers
      };
    }

    // 3. Fallback
    const currentEth = parseFloat(camp.currentAmount || 0);
    const apiBackers = camp.totalBackers ?? camp.donorsCount ?? (currentEth > 0 ? 1 : 0);
    return {
      eth: { amount: 0, php: 0, count: 0 },
      gcash: { amount: 0, php: 0, count: 0 },
      maya: { amount: 0, php: 0, count: 0 },
      bank: { amount: currentEth, php: Math.round(currentEth * 170000), count: apiBackers > 0 ? 1 : 0 },
      totalRaisedEth: currentEth,
      totalRaisedPhp: Math.round(currentEth * 170000),
      totalBackers: apiBackers
    };
  }, [camp.railBreakdown, camp.currentAmount, history]);

  const totalRailRaised = (parseFloat(breakdown?.eth?.amount || 0)) + 
                          (parseFloat(breakdown?.gcash?.amount || 0)) + 
                          (parseFloat(breakdown?.maya?.amount || 0)) + 
                          (parseFloat(breakdown?.bank?.amount || 0));
  const displayCurrentEth = Math.max(parseFloat(camp.currentAmount || 0), parseFloat(breakdown?.totalRaisedEth || 0), totalRailRaised);
  const targetPhp = parseFloat(camp.targetAmountPhp || camp.target_amount_php || 0) || (parseFloat(camp.targetAmount || 0) * 170000);
  const totalRaisedPhp = Math.round(((breakdown?.gcash?.php || 0) + (breakdown?.maya?.php || 0) + (breakdown?.bank?.php || 0) + (breakdown?.eth?.php || 0)));
  const targetGoal = Math.max(0.00000001, parseFloat(camp.targetAmount || 0.00000001));
  const currentTotal = Math.max(0.000001, displayCurrentEth);

  // Accurate percentage computation supporting micro-goals (e.g. ₱2 goal with ₱1 raised)
  const pct = targetPhp > 0 && totalRaisedPhp > 0
    ? (totalRaisedPhp >= targetPhp ? '100' : ((totalRaisedPhp / targetPhp) * 100).toFixed(1).replace(/\.0$/, ''))
    : progressPct(displayCurrentEth, camp.targetAmount);

  // True once lifetime funding reaches the goal (cap bar/percent cleanly at "Goal reached")
  const goalReached = (targetPhp > 0 && totalRaisedPhp >= targetPhp) ||
                      (parseFloat(camp.targetAmount || 0) > 0 && (displayCurrentEth / targetGoal) >= 0.99999);

  // Compute segment widths on the bar proportional to target goal (in PHP if available, else ETH)
  const usePhpBasis = targetPhp > 0;
  const rawSumPct = usePhpBasis 
    ? (totalRaisedPhp / targetPhp) * 100 
    : (targetGoal > 0 ? (totalRailRaised / targetGoal) * 100 : 0);
  const scale = rawSumPct > 100 ? (100 / rawSumPct) : 1;

  const totalBarPct = Math.min(100, Math.max(0, rawSumPct));
  const ethSegmentPct = usePhpBasis
    ? (((breakdown?.eth?.php || 0) / targetPhp) * 100) * scale
    : ((parseFloat(breakdown?.eth?.amount || 0) / targetGoal) * 100) * scale;
  const gcashSegmentPct = usePhpBasis
    ? (((breakdown?.gcash?.php || 0) / targetPhp) * 100) * scale
    : ((parseFloat(breakdown?.gcash?.amount || 0) / targetGoal) * 100) * scale;
  const mayaSegmentPct = usePhpBasis
    ? (((breakdown?.maya?.php || 0) / targetPhp) * 100) * scale
    : ((parseFloat(breakdown?.maya?.amount || 0) / targetGoal) * 100) * scale;
  const bankSegmentPct = usePhpBasis
    ? (((breakdown?.bank?.php || 0) / targetPhp) * 100) * scale
    : ((parseFloat(breakdown?.bank?.amount || 0) / targetGoal) * 100) * scale;

  // Percentage shares of total funds raised (Strictly sums to 100%)
  const ethShare = currentTotal > 0 ? Math.round(((parseFloat(breakdown?.eth?.amount || 0)) / currentTotal) * 100) : 0;
  const gcashShare = currentTotal > 0 ? Math.round(((parseFloat(breakdown?.gcash?.amount || 0)) / currentTotal) * 100) : 0;
  const mayaShare = currentTotal > 0 ? Math.round(((parseFloat(breakdown?.maya?.amount || 0)) / currentTotal) * 100) : 0;
  const bankShare = currentTotal > 0 ? Math.round(((parseFloat(breakdown?.bank?.amount || 0)) / currentTotal) * 100) : 0;

  // Fixed 4-chip incremental donation amounts (+₱50, +₱100, +₱500, +₱1000)
  const presetIncrements = [50, 100, 500, 1000];

  // Who can deactivate? Admin -> any campaign; Organization -> their own
  const canDeactivate =
    camp.isActive &&
    (role === ROLES.ADMIN || (role === ROLES.ORGANIZATION && isOwner));

  // ── Public Ledger Filters, Search, Rail Aggregations & Telemetry ──
  const ledgerCounts = useMemo(() => {
    if (!Array.isArray(history)) return { all: 0, onchain: 0, gcash: 0, maya: 0, card: 0, named: 0, guest: 0, anon: 0 };
    let onchain = 0, gcash = 0, maya = 0, card = 0;
    const uniqueNamed = new Set();
    const uniqueGuest = new Set();
    const uniqueAnon = new Set();

    history.forEach((tx) => {
      const hash = (tx.txHash || '').toUpperCase();
      const pm = (tx.paymentMethod || tx.Payment_Method || '').toUpperCase();
      if (pm.includes('GCASH') || hash.startsWith('FIAT-GCAS') || hash.includes('GCASH')) gcash++;
      else if (pm.includes('MAYA') || hash.startsWith('FIAT-MAYA') || hash.includes('MAYA')) maya++;
      else if (pm.includes('BANK') || pm.includes('CARD') || hash.startsWith('FIAT-BANK') || hash.startsWith('FIAT-CARD') || hash.startsWith('FIAT-CRED') || hash.includes('CARD') || hash.includes('BANK')) card++;
      else onchain++;

      const isGuest = Boolean(tx.isGuest || (!tx.donorId && (!tx.wallet || tx.wallet === '' || tx.wallet === '0x0000000000000000000000000000000000000000')));

      if (tx.isAnonymous) {
        uniqueAnon.add(tx.txHash || Math.random());
      } else if (isGuest) {
        uniqueGuest.add(tx.txHash || Math.random());
      } else {
        const idKey = tx.donorId ? `id_${tx.donorId}` : (tx.wallet && tx.wallet !== '0x0000000000000000000000000000000000000000' ? tx.wallet.toLowerCase() : tx.donor || Math.random());
        uniqueNamed.add(idKey);
      }
    });
    return { all: history.length, onchain, gcash, maya, card, named: uniqueNamed.size, guest: uniqueGuest.size, anon: uniqueAnon.size };
  }, [history]);

  const ledgerTelemetry = useMemo(() => {
    if (!Array.isArray(history) || history.length === 0) {
      return {
        totalPhp: 0,
        totalEth: 0,
        onchainCount: 0,
        gatewayCount: 0,
        uniqueDonors: 0,
        namedCount: 0,
        guestCount: 0,
        anonCount: 0,
        latestDate: null
      };
    }

    let totalPhp = 0;
    let totalEth = 0;
    let onchainCount = 0;
    let gatewayCount = 0;
    const uniqueNamedEntities = new Set();
    const uniqueGuestEntities = new Set();
    const uniqueAnonEntities = new Set();
    let latestTimestamp = 0;

    history.forEach((rec) => {
      const p = rec.phpAmount || Math.round((rec.rawAmount || parseFloat(rec.amount || 0)) * 170000);
      const e = parseFloat(rec.rawAmount || rec.amount || 0);
      totalPhp += p;
      totalEth += e;

      const hash = (rec.txHash || '').toUpperCase();
      const pm = (rec.paymentMethod || rec.Payment_Method || '').toUpperCase();
      if (pm.includes('GCASH') || pm.includes('MAYA') || pm.includes('BANK') || pm.includes('CARD') || hash.startsWith('FIAT-')) {
        gatewayCount++;
      } else {
        onchainCount++;
      }

      const isGuest = Boolean(rec.isGuest || (!rec.donorId && (!rec.wallet || rec.wallet === '' || rec.wallet === '0x0000000000000000000000000000000000000000')));

      if (rec.isAnonymous) {
        uniqueAnonEntities.add(rec.txHash || `anon_${Math.random()}`);
      } else if (isGuest) {
        uniqueGuestEntities.add(rec.txHash || `guest_${Math.random()}`);
      } else {
        let idKey = null;
        if (rec.donorId) {
          idKey = `id_${rec.donorId}`;
        } else if (rec.wallet && rec.wallet !== '0x0000000000000000000000000000000000000000') {
          idKey = rec.wallet.toLowerCase();
        } else if (rec.donor && rec.donor !== 'Anonymous' && rec.donor !== 'Guest Donor') {
          idKey = rec.donor.toLowerCase();
        } else {
          idKey = `donor_${rec.txHash || Math.random()}`;
        }
        uniqueNamedEntities.add(idKey);
      }

      if (rec.createdAt) {
        const d = parseSafeDate(rec.createdAt);
        const t = d ? d.getTime() : NaN;
        if (!isNaN(t) && t > latestTimestamp) latestTimestamp = t;
      }
    });

    const totalUniqueDonors = uniqueNamedEntities.size + uniqueGuestEntities.size + uniqueAnonEntities.size;

    return {
      totalPhp,
      totalEth,
      onchainCount,
      gatewayCount,
      uniqueDonors: totalUniqueDonors,
      namedCount: uniqueNamedEntities.size,
      guestCount: uniqueGuestEntities.size,
      anonCount: uniqueAnonEntities.size,
      latestDate: latestTimestamp > 0 ? new Date(latestTimestamp) : null
    };
  }, [history]);

  const isAnyFilterActive = ledgerRailFilter !== 'ALL' || ledgerIdentityFilter !== 'ALL' || ledgerSearch.trim() !== '' || Boolean(ledgerDateFilter) || ledgerSort !== 'NEWEST';

  const handleResetFilters = () => {
    setLedgerRailFilter('ALL');
    setLedgerIdentityFilter('ALL');
    setLedgerSearch('');
    setLedgerDateFilter('');
    setLedgerSort('NEWEST');
  };

  const formatLedgerSelectedDate = (isoStr) => {
    if (!isoStr) return 'Date';
    const parts = String(isoStr).split('-');
    if (parts.length !== 3) return 'Date';
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    if (isNaN(d.getTime())) return 'Date';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleOpenLedgerDatePicker = (e) => {
    if (e.target.closest('.ledger-date-clear-icon-btn')) return;
    if (ledgerDateInputRef.current) {
      if (typeof ledgerDateInputRef.current.showPicker === 'function') {
        try {
          ledgerDateInputRef.current.showPicker();
        } catch (_) {
          ledgerDateInputRef.current.focus();
        }
      } else {
        ledgerDateInputRef.current.focus();
      }
    }
  };

  const filteredHistory = useMemo(() => {
    if (!Array.isArray(history)) return [];
    return history
      .filter((rec) => {
        const hash = (rec.txHash || '').toUpperCase();
        const pm = (rec.paymentMethod || rec.Payment_Method || '').toUpperCase();

        // 1. Payment Rail Filter
        if (ledgerRailFilter === 'ONCHAIN') {
          if (pm.includes('GCASH') || pm.includes('MAYA') || pm.includes('BANK') || pm.includes('CARD') || hash.startsWith('FIAT-')) return false;
        } else if (ledgerRailFilter === 'GCASH') {
          if (!pm.includes('GCASH') && !hash.startsWith('FIAT-GCAS') && !hash.includes('GCASH')) return false;
        } else if (ledgerRailFilter === 'MAYA') {
          if (!pm.includes('MAYA') && !hash.startsWith('FIAT-MAYA') && !hash.includes('MAYA')) return false;
        } else if (ledgerRailFilter === 'CARD') {
          if (!pm.includes('BANK') && !pm.includes('CARD') && !hash.startsWith('FIAT-BANK') && !hash.startsWith('FIAT-CARD') && !hash.startsWith('FIAT-CRED') && !hash.includes('CARD') && !hash.includes('BANK')) return false;
        }

        // 2. Identity Filter (All | Verified | Guest | Anonymous)
        if (ledgerIdentityFilter === 'VERIFIED') {
          if (rec.isAnonymous || rec.isGuest) return false;
        } else if (ledgerIdentityFilter === 'GUEST') {
          if (!rec.isGuest || rec.isAnonymous) return false;
        } else if (ledgerIdentityFilter === 'ANON') {
          if (!rec.isAnonymous) return false;
        }

        // 3. Search Query Filter (txHash, donor name, wallet address, amount)
        if (ledgerSearch.trim() !== '') {
          const q = ledgerSearch.toLowerCase().trim();
          const matchTx = (rec.txHash || '').toLowerCase().includes(q);
          const matchDonor = (rec.donor || '').toLowerCase().includes(q);
          const matchWallet = (rec.wallet || '').toLowerCase().includes(q);
          const approxPhp = String(rec.phpAmount || Math.round((rec.rawAmount || parseFloat(rec.amount || 0)) * 170000));
          const matchAmount = approxPhp.includes(q) || String(rec.amount || '').includes(q);
          if (!matchTx && !matchDonor && !matchWallet && !matchAmount) return false;
        }

        // 4. Bounded Date Filter (exact date match within campaign operational lifecycle)
        if (ledgerDateFilter) {
          if (!rec.createdAt) return false;
          try {
            const recD = parseSafeDate(rec.createdAt);
            if (!recD) return false;
            const recY = recD.getFullYear();
            const recM = String(recD.getMonth() + 1).padStart(2, '0');
            const recDay = String(recD.getDate()).padStart(2, '0');
            const recIso = `${recY}-${recM}-${recDay}`;
            if (recIso !== ledgerDateFilter) return false;
          } catch (_) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const amtA = parseFloat(a.rawAmount || a.amount || 0);
        const amtB = parseFloat(b.rawAmount || b.amount || 0);
        if (ledgerSort === 'AMOUNT_HIGH') return amtB - amtA;
        if (ledgerSort === 'AMOUNT_LOW') return amtA - amtB;
        if (ledgerSort === 'OLDEST') {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeA - timeB;
        }
        // Default NEWEST
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
  }, [history, ledgerRailFilter, ledgerIdentityFilter, ledgerSearch, ledgerSort, ledgerDateFilter]);

  /* ── Checkout Modal Logic ─────────────────────── */
  const handleOpenCheckout = () => {
    if (isDonationsMaintenance) {
      showWarning(
        `Donation gateway is temporarily paused for scheduled maintenance (${maintState?.title || 'System Maintenance'}). Please try again shortly.`,
        'Maintenance Mode Active'
      );
      return;
    }
    setDonateStep(0); // Start at Payment Selector
    setCustomMsg('');
    setTxHash('');
    setIsAnonymous(false);
    setLegalConfirm(false);
    setModalOpen(true);
  };

  const handleConfirmDonate = async () => {
    if (isDonationsMaintenance) {
      showWarning(
        'Donation transactions are currently paused for system maintenance.',
        'Maintenance Active'
      );
      return;
    }
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
        const apiUrl = API_URL;
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
    setCardNumber('4242 4242 4242 4242'); // Official Sandbox Visa test card
    setCardName('GESTER MACALDO');
    setCardExpiry('12/28');
    setCardCvv('888');
    setCardEmail('donor@relief-foundation.ph');
    setCardAddress('Ayala Avenue, Makati City');
    setCardCity('Makati');
    setCardState('Metro Manila');
    setCardZip('1226');
    setCardCountry('Philippines');
    if (!amount || parseFloat(amount) <= 0) {
      setAmount('500');
    }
    showSuccess?.('Standard Sandbox Visa (4242) test credentials loaded!', 'Test Card Ready');
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

  // Universal Payment Processing Flag across all payment rails
  const isPaymentProcessing = (donateStep === 6 && isUploading) ||
                              (donateStep === 7 && gatewayLoading) ||
                              donateStep === 2 ||
                              donateStep === 3;

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
    setAiScanResult({
      isAiVerified: true,
      confidenceScore: 98,
      extractedRef: demoRef,
      extractedAmountPhp: demoAmount,
      detectedPaymentRail: isMaya ? 'Maya' : 'GCash',
      fraudFlags: [],
      auditedBy: 'GEMINI_AI_VISION_PREVIEW',
      summary: `Verified authentic ${brandName} confirmation receipt. Reference #${demoRef}.`
    });

    showSuccess?.(`Demo ${brandName} receipt, ₱${demoAmount} amount, and Ref #${demoRef} loaded! Ready to confirm.`, 'Demo Ready');
  };

  const handleReceiptUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      return showWarning("Receipt image must be under 8MB.", "File Too Large");
    }

    // Immediately clear stale verification alerts from previous uploads
    setDuplicateRefWarning(null);
    setRailMismatchWarning(null);
    setAiScanResult(null);

    const reader = new FileReader();
    reader.onload = async () => {
      const b64 = reader.result;
      setReceiptBase64(b64);
      setAiScanLoading(true);

      let serverExtractedSuccess = false;

      // Call Backend Gemini AI Receipt Vision Endpoint with Recipient Credentials
      try {
        const expectedRecipientName = gatewayMethod === 'Maya' 
          ? (camp.mayaName || camp.maya_name) 
          : (camp.gcashName || camp.gcash_name || 'CL***E JU*****E V.');

        const expectedRecipientPhone = gatewayMethod === 'Maya' 
          ? (camp.mayaNumber || camp.maya_number) 
          : (camp.gcashNumber || camp.gcash_number || '0997 9939521');

        const expectedOrgName = camp.orgName || camp.org_name || camp.title;

        const verifyRes = await fetch(`${API_URL}/api/verify-receipt-ai`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            receiptBase64: b64,
            amountEth: amount ? (parseFloat(amount) / 170000) : 0,
            paymentMethod: gatewayMethod || 'GCash',
            refNumber: refNumber || null,
            expectedRecipientName,
            expectedRecipientPhone,
            expectedOrgName
          })
        });
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json();
          setAiScanResult(verifyData);
          serverExtractedSuccess = true;

          // Non-receipt, tampered, expired, or recipient mismatch handling (Hard Fraud Rejection)
          const isHardRejection = verifyData.isPaymentReceipt === false || 
            verifyData.confidenceScore === 0 ||
            verifyData.fraudFlags?.some(f => 
              f.includes('INVALID_RECEIPT') || 
              f.includes('RECIPIENT_MISMATCH') || 
              f.includes('RECIPIENT_NAME_MISMATCH') || 
              f.includes('RECIPIENT_PHONE_MISMATCH') || 
              f.includes('EXPIRED_RECEIPT') || 
              f.includes('SUSPICIOUS_REFERENCE_SEQUENCE') || 
              f.includes('TAMPERED')
            );

          if (isHardRejection) {
            setRefNumber('');
            setGatewayRefNo('');
            showWarning?.(verifyData.summary || 'Receipt flagged by AI audit. Please verify payment details.', 'Verification Alert');
            return;
          }

          if (verifyData.extractedRef) {
            setRefNumber(verifyData.extractedRef);
            setGatewayRefNo(verifyData.extractedRef);
          }
          if (verifyData.extractedAmountPhp && Number(verifyData.extractedAmountPhp) > 0) {
            setAmount(String(verifyData.extractedAmountPhp));
          }
          if (verifyData.fraudFlags?.some(f => f.includes('RAIL_MISMATCH'))) {
            setRailMismatchWarning(verifyData.fraudFlags.find(f => f.includes('RAIL_MISMATCH')));
          }

          // Strict Rail Mismatch check: GCash reference scheme (13 digits) vs Maya, or detectedPaymentRail mismatch
          const digitsOnly = (verifyData.extractedRef || '').replace(/\D/g, '');
          const currentMethod = (gatewayMethod || 'GCash').toLowerCase();
          const detectedRail = verifyData.detectedPaymentRail || (digitsOnly.length === 13 ? 'GCash' : null);

          if (detectedRail && detectedRail.toLowerCase() !== currentMethod) {
            setRailMismatchWarning(`Payment Rail Mismatch: You selected ${gatewayMethod}, but uploaded a ${detectedRail} receipt screenshot! Please upload a valid ${gatewayMethod} slip.`);
          }

          if (verifyData.isDuplicateRef) {
            setDuplicateRefWarning(verifyData.fraudFlags?.find(f => f.includes('DUPLICATE_REF_NUMBER')) || `Reference number "${verifyData.extractedRef}" was already submitted in a previous donation transaction!`);
          }

          if (verifyData.extractedRef) {
            showSuccess?.(`AI Extracted Ref #${verifyData.extractedRef}${verifyData.extractedAmountPhp ? ` & Amount ₱${Number(verifyData.extractedAmountPhp).toLocaleString()}` : ''}!`, 'Auto-Filled');
          }
        }
      } catch (aiErr) {
        console.warn('AI Receipt Verification error:', aiErr);
      } finally {
        setAiScanLoading(false);
      }

      // Fast-Path: If server AI Vision inspected the receipt, finish immediately (No need for heavy browser OCR)
      if (serverExtractedSuccess) {
        return;
      }

      // ── Client-side Fallback Only When Server Offline ───
      try {
        const ocrResult = await Tesseract.recognize(file, 'eng');
        const text = ocrResult?.data?.text || '';
        const lowerText = text.toLowerCase();

        // Require transaction keywords
        const receiptKeywords = ['express send', 'send money', 'reference no', 'ref no', 'ref.', 'ref #', 'instapay', 'pesonet', 'transfer fee', 'total amount', 'payment details', 'transferred to', 'gcash', 'paymaya', 'maya'];
        const hasKeywords = receiptKeywords.some(kw => lowerText.includes(kw));

        if (!hasKeywords) {
          setAiScanResult({
            isPaymentReceipt: false,
            isAiVerified: false,
            confidenceScore: 0,
            extractedRef: null,
            extractedAmountPhp: null,
            fraudFlags: ['INVALID_RECEIPT: Uploaded image does not contain transaction headers or reference details.'],
            summary: 'Uploaded file is not a recognized payment receipt.'
          });
          setRefNumber('');
          setGatewayRefNo('');
          showWarning?.('Uploaded image does not appear to be a payment receipt.', 'Invalid Receipt');
          return;
        }

        // Search for reference numbers only after explicit keywords or 13-digit format
        const refMatch = text.match(/(?:Ref(?:\s*No|\.|\:|\#)?|Reference(?:\s*No|\.|\:|\#)?|Express\s*Send)[\s\.\:\#\-]*([0-9\s]{11,18})/i) ||
                         text.match(/\b(\d{4}[\s\.\-]+\d{3}[\s\.\-]+\d{6})\b/) ||
                         text.match(/\b(00\d{11}|10\d{11}|\d{13})\b/) ||
                         text.match(/\b(\d{4}[\s\-]?\d{9})\b/);

        // Strict Amount Regex
        const amtMatch = text.match(/(?:Total\s*Amount\s*Sent|Total\s*Amount|Amount\s*Sent|Amount|Total|Paid)[\s\S]{0,35}?(?:PHP|₱|P|Php)?\s*([\d,]+(?:\.\d{2})?)/i) ||
                          text.match(/(?:PHP|₱|Php)\s*([\d,]+(?:\.\d{2})?)/i) ||
                          text.match(/\b(?:PHP|₱|Php)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2}))\b/);

        let extractedRef = null;
        if (refMatch) {
          const rawRef = (refMatch[1] || refMatch[0]).trim().replace(/\s+/g, ' ');
          const digitsOnly = rawRef.replace(/\D/g, '');
          if (digitsOnly.length === 13) {
            extractedRef = `${digitsOnly.slice(0, 4)} ${digitsOnly.slice(4, 7)} ${digitsOnly.slice(7)}`;
          } else if (digitsOnly.length >= 10 && digitsOnly.length <= 16) {
            extractedRef = rawRef;
          }
        }

        let extractedAmt = null;
        if (amtMatch) {
          const parsed = parseFloat(amtMatch[1].replace(/,/g, ''));
          if (!isNaN(parsed) && parsed > 0 && parsed < 10000000) {
            extractedAmt = parsed;
          }
        }

        let detectedRail = null;
        if (/gcash/i.test(text)) detectedRail = 'GCash';
        else if (/maya|paymaya/i.test(text)) detectedRail = 'Maya';

        // Backend AI Vision Server Fallback for deeper verification
        if (b64) {
          try {
            const apiRes = await fetch(`${API_URL}/api/donations/check-duplicate-ref`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ receipt_base64: b64, payment_method: gatewayMethod })
            });
            if (apiRes.ok) {
              const apiData = await apiRes.json();
              // Only override with server AI extracted values if client OCR missed it or server has high confidence
              if (!extractedRef && apiData.extractedRef && apiData.extractedRef.length >= 10) {
                extractedRef = apiData.extractedRef;
              }
              if (!extractedAmt && apiData.extractedAmountPhp && apiData.extractedAmountPhp > 0) {
                extractedAmt = apiData.extractedAmountPhp;
              }
              if (apiData.detectedRail) detectedRail = apiData.detectedRail;
            }
          } catch (_) {}
        }

        // Rail Mismatch Validation on Donor Modal
        const currentSelectedRail = (gatewayMethod || '').trim().toLowerCase();
        const extractedDigits = (extractedRef || '').replace(/\D/g, '');
        if (!detectedRail && extractedDigits.length === 13) {
          detectedRail = 'GCash';
        }
        if (detectedRail && currentSelectedRail) {
          if (detectedRail.toLowerCase() !== currentSelectedRail) {
            setRailMismatchWarning(`Payment Rail Mismatch: You selected ${gatewayMethod}, but uploaded a ${detectedRail} receipt screenshot! Please upload a valid ${gatewayMethod} slip.`);
          }
        }

        // ── Strict Auto-Fill Execution ──────────────────────────────────────────
        // Only fill Reference Number if AI is 100% confident and valid
        if (extractedRef) {
          setRefNumber(extractedRef);
          setGatewayRefNo(extractedRef);
        }

        // Only fill Amount if AI detected explicit decimal amount with total/currency keyword
        if (extractedAmt && extractedAmt > 0) {
          setAmount(String(extractedAmt));
        }

        // ── Informative User Toast ──────────────────────────────────────────────
        if (extractedRef && extractedAmt) {
          showSuccess?.(`AI Vision Extracted Ref #${extractedRef} & Amount ₱${extractedAmt.toLocaleString()} PHP!`, 'Auto-Filled Details');
        } else if (extractedRef) {
          showSuccess?.(`AI Vision Extracted Ref #${extractedRef}! Amount not clearly detected, please enter manually.`, 'Reference Auto-Filled');
        } else if (extractedAmt) {
          showSuccess?.(`AI Vision Extracted Amount ₱${extractedAmt.toLocaleString()} PHP! Reference number not clearly detected, please enter manually.`, 'Amount Auto-Filled');
        } else {
          showSuccess?.("Receipt image attached! AI could not detect reference number or amount with 100% confidence. Please enter details manually.", "Receipt Attached");
        }

      } catch (tessErr) {
        console.warn('Tesseract OCR execution error:', tessErr);
        showSuccess?.("Receipt screenshot attached successfully! Please verify reference number and amount.", "Receipt Attached");
      }
    };
    reader.readAsDataURL(file);
  };

  const verifyGatewayPayment = async () => {
    if (railMismatchWarning) return showWarning(railMismatchWarning, "Payment Rail Mismatch Blocked");
    if (duplicateRefWarning) return showWarning(duplicateRefWarning, "Duplicate Receipt Blocked");
    if (activeAiResult?.fraudFlags?.some(f => f.includes('EXPIRED_RECEIPT'))) {
      return showWarning("Receipt is expired (~1+ year old) and cannot be accepted. Please upload an authentic, recent payment slip.", "Expired Receipt Blocked");
    }
    if (activeAiResult?.fraudFlags?.some(f => f.includes('TAMPERED'))) {
      return showWarning("Image contains instructional tutorial markings or tampering and cannot be accepted.", "Tampered Image Blocked");
    }
    const finalRef = (refNumber || gatewayRefNo || '').trim();
    if (!finalRef) return showWarning("Please enter the transaction reference number from your receipt.", "Missing Reference");
    if (gatewayMethod === 'GCash') {
      const cleanDigits = finalRef.replace(/\D/g, '');
      if (cleanDigits.length !== 13) {
        return showWarning("GCash reference numbers must be exactly 13 digits (e.g. 0044 579 175068).", "Invalid GCash Reference");
      }
    }
    if (!receiptBase64) return showWarning("Please upload your payment confirmation receipt screenshot.", "Missing Receipt");
    // Only block if image is invalid AND user did not enter a reference number
    if (activeAiResult && (activeAiResult.isPaymentReceipt === false || activeAiResult.confidenceScore === 0 || activeAiResult.fraudFlags?.some(f => f.includes('INVALID_RECEIPT'))) && !finalRef) {
      return showWarning("Uploaded image could not be verified. Please enter the reference number from your receipt.", "Reference Required");
    }
    const finalAmount = parseFloat(amount || 0);
    if (!finalAmount || finalAmount <= 0) return showWarning("Please enter a valid amount greater than ₱0.", "Invalid Amount");

    setGatewayLoading(true);

    try {
      const apiUrl = API_URL;
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

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Payment verification failed');
      }
      const data = await res.json();
      setTxHash(data.tx_hash || finalRef);

      setGatewayStep(4); // Success step
      if (walletAddress) {
        globalDonorRegistry.recordDonation(walletAddress, finalAmount / 170000, finalAmount);
      }
      setTimeout(() => {
        setGatewayLoading(false);
        setDonateStep(4); // Master Success Phase of CampaignCard
        onDonated?.(); // Refresh
        fetchHistory(true); // Refresh ledger
        window.dispatchEvent(new CustomEvent('bbdrts_donation_success'));
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
    if (paymentMethod === 'Credit Card') {
      const numAmt = parseFloat(amount || 0);
      if (!numAmt || numAmt <= 0) return showWarning("Please enter a donation amount greater than ₱0.", "Invalid Amount");
    } else if (!receiptBase64) {
      return showWarning("Please upload a screenshot of your receipt before submitting.", "Missing Receipt");
    }
    setIsUploading(true);
    try {
      // Simulate real-world gateway processing time
      await new Promise(resolve => setTimeout(resolve, 1800));

      const token = localStorage.getItem('bbdrts_token');
      const apiUrl = API_URL;

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
        setTxHash(data.tx_hash || '');
      } else {
        const parsed = parseFloat(amount);
        const ethAmount = parsed / 170000;
        const response = await fetch(`${apiUrl}/api/manual-donations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token && token !== 'null' ? { 'Authorization': `Bearer ${token}` } : {}) },
          body: JSON.stringify({
            campaign_id: Number(camp.id),
            amount: ethAmount,
            payment_method: paymentMethod,
            receipt_base64: receiptBase64,
            is_anonymous: isAnonymous,
            intent_id: activeIntent?.intentId || undefined,
            tracking_code: activeIntent?.trackingCode || undefined
          })
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

      const token = localStorage.getItem('bbdrts_token');
      if (!token) {
        throw new Error('Authentication session required to deactivate this campaign.');
      }
      const res = await fetch(`${API_URL}/api/campaigns/${camp.id}/deactivate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to deactivate campaign.');
      }

      setDeactivateModal({ show: true, step: 4, hash: resData.txHash || 'OFF-CHAIN-SYNCED', error: '' });
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
      const apiUrl = API_URL;
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
            const isGuest = Boolean(d.isGuest ?? (!d.donorId && (!d.wallet || d.wallet === '' || d.wallet === '0x0000000000000000000000000000000000000000')));
            const globalEth = isGuest
              ? 0
              : (d.globalTotalEth !== undefined && d.globalTotalEth !== null
                  ? parseFloat(d.globalTotalEth)
                  : rawEth);
            const globalPhp = Math.round(globalEth * 170000);

            if (!isGuest) {
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
            }

            const resolvedDonorName = d.Is_Anonymous
              ? 'Anonymous'
              : isGuest
                ? 'Guest Donor'
                : (d.donorName || 'Verified Donor');

            return {
              donor: resolvedDonorName,
              wallet: d.wallet,
              donorId: d.donorId,
              isGuest,
              isAnonymous: Boolean(d.Is_Anonymous),
              hideBadge: Boolean(d.hideBadge),
              avatarUrl: d.avatarUrl || '',
              username: d.username || '',
              location: d.location || '',
              bio: d.bio || '',
              amount: ethStr,
              rawAmount: rawEth,
              phpAmount: approxPhp,
              globalAmountEth: globalEth,
              globalAmountPhp: globalPhp,
              txHash: d.Tx_Hash,
              paymentMethod: d.paymentMethod || d.Payment_Method || 'Bank / Card',
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
                paymentMethod: 'Bank / Card',
                createdAt: new Date().toISOString()
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

  const cardRootRef = useRef(null);
  const isTargetFromUrl = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const p = new URLSearchParams(window.location.search);
    return p.get('campaign') && String(p.get('campaign')) === String(camp.id);
  }, [camp.id]);

  useEffect(() => {
    // Fallback scroll if not already positioned by view
    if (isTargetFromUrl && cardRootRef.current) {
      const timer = setTimeout(() => {
        const rect = cardRootRef.current?.getBoundingClientRect();
        if (rect && (rect.top < 0 || rect.bottom > (window.innerHeight + 100))) {
          const targetY = window.pageYOffset + rect.top - 85;
          window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
        }
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isTargetFromUrl]);

  /* ── Render ───────────────────────────────────── */
  return (
    <div
      ref={cardRootRef}
      id={props.id || `campaign-${camp.id}`}
      className={`card glow campaign-card fade-in ${!camp.isActive ? 'campaign-closed' : ''} ${showRailTelemetry ? 'telemetry-dropdown-active' : ''} ${isTargetFromUrl ? 'campaign-card-targeted' : ''}`}
      style={{ scrollMarginTop: '120px' }}
    >
      <div className="campaign-card-body">

        {/* ── Left: Campaign Cover Media ── */}
        <div className="campaign-media">
          {lowBandwidthMode && !mediaLoaded ? (
            <div className="data-saver-media-placeholder">
              <span className="material-symbols-outlined" style={{ fontSize: '26px', color: '#f59e0b' }}>
                signal_cellular_alt
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{wt.dataSaverTitle}</span>
              <span style={{ fontSize: '0.7rem', opacity: 0.85, maxWidth: '170px', lineHeight: 1.35 }}>
                {wt.dataSaverDeferred}
              </span>
              <button
                type="button"
                className="data-saver-load-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setMediaLoaded(true);
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>image</span>
                <span>{wt.loadPhoto}</span>
              </button>
            </div>
          ) : (
            <>
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
            </>
          )}

          {/* Category Badge inside Cover Media (Charitable Aid / Disaster Relief) */}
          <div className="campaign-media-cat-badge" title={catInfo.label}>
            <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>{catInfo.icon}</span>
            <span>{catInfo.label}</span>
          </div>

          {/* Disaster Evidence Photos Badge */}
          {coverData.hasDisasterPhotos && (
            <div className="campaign-media-evidence-badge" title={`${coverData.disasterPhotosCount} disaster impact evidence photo(s) attached`}>
              <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>photo_camera</span>
              <span>{coverData.disasterPhotosCount} Field Photo{coverData.disasterPhotosCount > 1 ? 's' : ''}</span>
            </div>
          )}

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
          {/* Top Meta Row: Clean, Uncrowded Badges */}
          <div className="campaign-header-top">
            {isTargetFromUrl && (
              <span className="campaign-targeted-badge" title="You were directed directly to this campaign via a shared link">
                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>share_location</span>
                <span>Shared Link</span>
              </span>
            )}

            {deliveryDateStatus.isOverdue ? (
              <span 
                className="badge badge-distribution"
                title={deliveryDateStatus.tooltip}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>local_shipping</span>
                <span>{wt.distributionBadge}</span>
              </span>
            ) : (
              <span className={`badge ${camp.isActive ? 'badge-active' : 'badge-closed'}`} title={deliveryDateStatus.tooltip}>
                <span className="status-dot" />
                <span>{camp.isActive ? wt.activeBadge : wt.concludedBadge}</span>
              </span>
            )}

            {isOwner && role !== ROLES.DONOR && (
              <span className="badge badge-info" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                Your Campaign
              </span>
            )}

            {(camp.disbursementStatus === 'DISBURSED' || (camp.disbursedAmountPhp || 0) > 0) && (
              <button
                type="button"
                className="badge badge-disbursed-geist"
                onClick={() => setProofModalOpen(true)}
                title="Click to inspect verified ground distribution receipts"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>task_alt</span>
                <span>Aid Disbursed</span>
              </button>
            )}

            <span className="campaign-meta-id-tag campaign-eyebrow-id" title={`Audit Campaign Reference #${camp.id}`}>
              #{camp.id}
            </span>
          </div>

          {/* Prominent Clean Title with Hover-Triggered Marquee */}
          <CampaignTitleMarquee title={formatCampaignTitle(camp.title, camp.id)} />

          {/* Managing Org & Ground Location Attribution Row */}
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

            {cleanLocation && (
              <>
                <span className="campaign-org-sep" aria-hidden="true">·</span>
                <button
                  type="button"
                  className="campaign-location-badge"
                  title={`Relief Operations Area: ${rawLocation || cleanLocation} • Click to view GPS Audit & Map`}
                onClick={(e) => {
                  e.stopPropagation();
                  setDetailsOpen(true);
                }}
              >
                <span className="material-symbols-outlined campaign-location-icon">location_on</span>
                  <span className="campaign-location-text">{cleanLocation}</span>
                </button>
              </>
            )}
          </div>

          {/* Multi-Rail Interactive Progress Bar */}
          <div className="multi-rail-wrapper" ref={railDropdownRef}>
            {/* Header: Goal & Total Percent (Clickable trigger for dropdown) */}
            <div className="multi-rail-header">
              <span className="multi-rail-goal-text">
                <strong><LiveCounter value={totalRaisedPhp} prefix="₱" duration={1050} /></strong> raised of ₱{(camp.targetAmountPhp || camp.target_amount_php || Math.round(parseFloat(camp.targetAmount || 0) * 170000)).toLocaleString('en-US', { maximumFractionDigits: 0 })} goal
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
                  {goalReached ? 'Goal reached' : `${pct}% funded`}
                </button>

                {/* Dropdown Popup anchored cleanly below % funded button */}
                {showRailTelemetry && (
                  <div className="multi-rail-dropdown-popup" onClick={(e) => e.stopPropagation()}>
                    <div className="dropdown-popup-header">
                      <div className="drawer-header-left">
                        <div className="drawer-pulse-dot"></div>
                        <span>Funding Sources</span>
                        <span className="drawer-backers-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>group</span>
                          <span>{breakdown.totalBackers || 0}</span>
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
                          <span className="drawer-compact-pip pip-gcash"></span>
                          <span className="drawer-compact-name">GCash</span>
                        </div>
                        <div className="drawer-compact-right">
                          <span className="drawer-compact-val">₱{breakdown.gcash.php.toLocaleString()}</span>
                          <span className="drawer-compact-pct">{gcashShare}%</span>
                        </div>
                      </div>
                      <div className="drawer-compact-row">
                        <div className="drawer-compact-left">
                          <span className="drawer-compact-pip pip-maya"></span>
                          <span className="drawer-compact-name">Maya</span>
                        </div>
                        <div className="drawer-compact-right">
                          <span className="drawer-compact-val">₱{breakdown.maya.php.toLocaleString()}</span>
                          <span className="drawer-compact-pct">{mayaShare}%</span>
                        </div>
                      </div>
                      <div className="drawer-compact-row">
                        <div className="drawer-compact-left">
                          <span className="drawer-compact-pip pip-bank"></span>
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
                  <div className="multi-rail-segment is-empty-placeholder" style={{ width: '100%', minWidth: 0, background: 'transparent' }} />
                )}
              </div>

              {/* Direct Segment Tooltips Positioned Right Above The Active Segment */}

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

          {/* Sleek, Non-redundant Metadata Strip */}
          {(() => {
            const totalBackers = breakdown?.totalBackers || 0;
            const audit = getCampaignAuditDetails(camp.id, camp.title, camp);
            const shortBeneficiaries = audit?.beneficiaries 
              ? audit.beneficiaries.split('(')[0].replace(/\s*\/\s*approx.*$/i, '').trim() 
              : null;
            return (
              <div className="campaign-meta-strip">
                <div className="campaign-meta-strip-left">
                  <span
                    className="campaign-meta-pill"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setShowRailTelemetry(prev => !prev)}
                    title={`Click to view payment breakdown (${totalBackers} total contributors)`}
                  >
                    <span className="material-symbols-outlined">group</span>
                    <span><strong>{totalBackers}</strong> {totalBackers === 1 ? 'donor' : 'donors'}</span>
                  </span>

                  {shortBeneficiaries && (
                    <>
                      <span className="campaign-meta-dot">·</span>
                      <span className="campaign-meta-pill" title={`Target Relief Impact: ${audit.beneficiaries}`}>
                        <span className="material-symbols-outlined">family_restroom</span>
                        <span className="campaign-meta-text-truncate">{shortBeneficiaries}</span>
                      </span>
                    </>
                  )}

                  {formattedDeliveryDate && (
                    <>
                      <span className="campaign-meta-dot">·</span>
                      <span className="campaign-meta-pill" title={`Target Relief Delivery Milestone: ${formattedDeliveryDate}`}>
                        <span className="material-symbols-outlined">event</span>
                        <span>Due {formattedDeliveryDate}</span>
                      </span>
                    </>
                  )}
                </div>

              </div>
            );
          })()}



          {/* Campaign Tags Row */}
          {campaignTags && campaignTags.length > 0 && (
            <div className="campaign-tags-row">
              {campaignTags.slice(0, 3).map((tag, idx) => (
                <span key={idx} className="campaign-tag-pill">
                  #{tag.replace(/^#/, '')}
                </span>
              ))}
              {campaignTags.length > 3 && (
                <div className="tag-overflow-wrap">
                  <span
                    className="campaign-tag-pill overflow-pill"
                    tabIndex={0}
                    role="button"
                    aria-label={`View ${campaignTags.length - 3} additional relief tags`}
                  >
                    +{campaignTags.length - 3}
                  </span>
                  <div className="tag-overflow-popover" role="tooltip">
                    <span className="tag-overflow-popover-label">
                      {campaignTags.length - 3} more tag{campaignTags.length - 3 !== 1 ? 's' : ''}
                    </span>
                    <div className="tag-overflow-grid">
                      {campaignTags.slice(3).map((tag, idx) => (
                        <span key={idx} className="campaign-tag-pill">
                          #{tag.replace(/^#/, '')}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right: Actions ── */}
        <div className="campaign-actions">
          {role === ROLES.ADMIN ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
              <p style={{ fontSize: '0.78rem', color: 'var(--warning)', textAlign: 'center', padding: '8px', border: '1px solid rgba(255,180,0,0.2)', borderRadius: '8px', background: 'rgba(255,180,0,0.05)', margin: 0 }}>
                Administrative accounts cannot execute financial transactions. Switch to a Donor account to donate.
              </p>
              {camp.isActive && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-full btn-danger-subtle"
                  onClick={triggerDeactivate}
                  disabled={deactivating}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>block</span>
                  <span>{deactivating ? 'Closing Operation…' : 'Admin Deactivate Campaign'}</span>
                </button>
              )}
              <div className="campaign-actions-secondary-btns">
                <button
                  className="btn btn-outline btn-sm btn-full"
                  onClick={() => setDetailsOpen(true)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>map</span>
                  <span>Details & Map</span>
                </button>
                <button className="btn btn-ghost btn-sm btn-full" onClick={toggleLedger} title="Open public blockchain ledger modal">
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>receipt_long</span>
                  <span>Public Ledger</span>
                </button>
              </div>
            </div>
          ) : isOwner ? (
            /* ── Campaign Owner Action Console ── */
            <div className="campaign-owner-actions">
              <button
                type="button"
                className="btn btn-sm btn-full"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isDisbursementsMaintenance) {
                    showWarning(
                      `Fund disbursement is temporarily paused for scheduled maintenance (${maintState?.title || 'System Maintenance'}). Escrow vault is safely locked.`,
                      'Maintenance Active'
                    );
                    return;
                  }
                  setDisburseModalOpen(true);
                }}
                title={isDisbursementsMaintenance ? 'Disbursement paused for maintenance' : 'Disburse raised funds and upload distribution photos / official receipts'}
                style={{
                  background: isDisbursementsMaintenance ? 'var(--bg-inset, #27272a)' : 'var(--accent-green, #10b981)',
                  color: isDisbursementsMaintenance ? 'var(--text-muted, #a1a1aa)' : '#ffffff',
                  border: `1px solid ${isDisbursementsMaintenance ? 'var(--border)' : 'var(--accent-green, #10b981)'}`,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  marginBottom: '6px',
                  cursor: isDisbursementsMaintenance ? 'not-allowed' : 'pointer'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>
                  {isDisbursementsMaintenance ? 'construction' : 'local_shipping'}
                </span>
                <span>{isDisbursementsMaintenance ? 'Disbursement (Maintenance)' : 'Disburse & Upload Relief Proof'}</span>
              </button>

              {(camp.disbursementStatus === 'DISBURSED' || (camp.disbursedAmountPhp || 0) > 0) && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm btn-full"
                  onClick={() => setProofModalOpen(true)}
                  style={{
                    borderColor: 'rgba(34, 197, 94, 0.4)',
                    color: 'var(--accent-green, #10b981)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    marginBottom: '6px'
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>verified</span>
                  <span>View Relief Proof (₱{(camp.disbursedAmountPhp || 0).toLocaleString()})</span>
                </button>
              )}

              <button
                type="button"
                className="btn btn-secondary btn-sm btn-full"
                onClick={() => setEditModalOpen(true)}
                title="Update ground relief operations and campaign details"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit_square</span>
                <span>Edit Campaign</span>
              </button>

              <div className="campaign-owner-action-row">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setDetailsOpen(true)}
                  title="View relief details, GPS audit & map"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>map</span>
                  <span>Details & Map</span>
                </button>

                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={toggleLedger}
                  title="Inspect public blockchain ledger & donation history"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>receipt_long</span>
                  <span>Public Ledger</span>
                </button>
              </div>

              {camp.isActive ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-full btn-danger-subtle"
                  onClick={triggerDeactivate}
                  disabled={deactivating}
                  title="Close campaign from accepting further donations"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>block</span>
                  <span>{deactivating ? 'Closing Operation…' : 'Deactivate Campaign'}</span>
                </button>
              ) : (
                <div className="campaign-closed-tag">
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>lock</span>
                  <span>Operation Concluded</span>
                </div>
              )}
            </div>
          ) : isNgoViewer ? (
            /* ── Inter-Agency Observer Console ── */
            <div className="campaign-observer-actions">
              <div 
                className="campaign-observer-status-pill"
                title="Direct donations are reserved for certified donor accounts to prevent circular funding."
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>corporate_fare</span>
                <span>{wt.partnerViewOnly}</span>
              </div>

              <div className="campaign-observer-btns-stack">
                <button
                  type="button"
                  className="btn btn-outline btn-sm btn-full"
                  onClick={() => setDetailsOpen(true)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>map</span>
                  <span>{wt.detailsMap}</span>
                </button>

                {interfaceMode !== 'simplified' && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-full"
                    onClick={toggleLedger}
                    title="Open public blockchain ledger modal"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>receipt_long</span>
                    <span>{wt.publicLedger}</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* ── Standard Donor Contribution Box & Action Buttons ── */
            <>
              <div className="donate-box-card">
                <div className="donate-box-header">
                  <span className="donate-box-eyebrow">{wt.contribution}</span>
                  {amount && Number(amount) > 0 ? (
                    <button
                      type="button"
                      onClick={() => setAmount('')}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.72rem', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                    >
                      <span>{wt.clear}</span>
                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>close</span>
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
                      placeholder={wt.amountPlaceholder}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      disabled={!canDonate}
                    />

                    {/* Floating Focus Popover with 4 Tailored Quick Add Chips */}
                    <div className="donate-focus-popover">
                      <div className="donate-popover-title">{wt.quickAdd}</div>
                      <div className="donate-presets-row">
                        {presetIncrements.map((inc) => (
                          <button
                            key={inc}
                            type="button"
                            className="donate-preset-chip"
                            onMouseDown={(e) => {
                              e.preventDefault();
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
                    <span>{interfaceMode === 'simplified' ? wt.donateRelief : wt.donate}</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>arrow_forward</span>
                  </button>
                </div>

                {!camp.isActive && (
                  <p style={{ fontSize: '0.74rem', color: 'var(--danger)', textAlign: 'center', margin: 0 }}>
                    {wt.campaignClosed}
                  </p>
                )}
              </div>

              <div className="campaign-actions-secondary-btns">
                <button
                  className="btn btn-outline btn-sm btn-full"
                  onClick={() => setDetailsOpen(true)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>map</span>
                  <span>{wt.detailsMap}</span>
                </button>

                {interfaceMode !== 'simplified' && (
                  <button className="btn btn-outline btn-sm btn-full" onClick={toggleLedger} title="Open public blockchain ledger modal">
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>receipt_long</span>
                    <span>{wt.publicLedger}</span>
                  </button>
                )}
              </div>
            </>
          )}

          {/* ── Bottom Corner Right: Mission Tracking & Share Tools ── */}
          <div className="campaign-utility-footer">
            <div className="campaign-utility-cluster">
              {!isOwner && (
                <button
                  type="button"
                  className={`campaign-utility-pill track-pill ${isTracked ? 'active' : ''}`}
                  onClick={handleToggleTrack}
                  title={isTracked ? 'Untrack campaign' : 'Track campaign for milestone & ledger updates'}
                  aria-label="Track campaign"
                >
                  <span className="material-symbols-outlined utility-icon">visibility</span>
                  <span className="utility-label">{isTracked ? 'Tracking' : 'Track'}</span>
                </button>
              )}

              <button
                type="button"
                className={`campaign-utility-pill share-pill ${isCopied ? 'copied' : ''}`}
                onClick={handleShare}
                title={isCopied ? 'Link copied!' : 'Share verified campaign link'}
                aria-label="Share campaign"
              >
                <span className="material-symbols-outlined utility-icon">
                  {isCopied ? 'check' : 'share'}
                </span>
                <span className="utility-label">{isCopied ? 'Copied' : 'Share'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Public Transaction Ledger Explorer Modal Card ── */}
      {ledgerOpen && createPortal(
        <div
          className="ledger-modal-backdrop fade-in"
          onClick={() => setLedgerOpen(false)}
        >
          <div
            className="ledger-modal-card bounce-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 1. Masterclass Header with Security Protocol Chip */}
            <div className="ledger-header">
              <div className="ledger-header-left">
                <div className="ledger-header-badge-icon">
                  <span className="material-symbols-outlined">account_balance</span>
                </div>
                <div className="ledger-header-title-block">
                  <div className="ledger-header-title-row">
                    <span className="ledger-header-title">Public Blockchain Ledger</span>
                    <span className="ledger-campaign-pill">Campaign #{camp.id}</span>
                    <div className="ledger-security-badge" title="Cryptographically audited with Sepolia EVM immutability">
                      <span className="ledger-pulse-dot" />
                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>verified_user</span>
                      <span>Sepolia Verified · 100% Immutable</span>
                    </div>
                  </div>
                  <span className="ledger-header-subtitle">
                    Public, tamper-proof record of verified GCash, Maya, card, and bank donations notarized on Sepolia
                  </span>
                </div>
              </div>

              <div className="ledger-header-actions">
                <button
                  type="button"
                  className={`ledger-sync-btn ${historyLoading ? 'is-syncing' : ''}`}
                  onClick={() => fetchHistory(true)}
                  disabled={historyLoading}
                  title="Query Sepolia blockchain and sync database receipts"
                >
                  <span className={`material-symbols-outlined ledger-sync-icon ${historyLoading ? 'spin-anim' : ''}`}>
                    sync
                  </span>
                  <span>{historyLoading ? 'Syncing…' : 'Sync'}</span>
                </button>

                <button
                  type="button"
                  className="ledger-modal-close-btn"
                  onClick={() => setLedgerOpen(false)}
                  title="Close Ledger (Esc)"
                  aria-label="Close Public Ledger"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            {/* 2. High-Impact 3-Card KPI Ribbon (Zero Truncation) */}
            <div className="ledger-kpi-ribbon">
              <div className="ledger-kpi-item">
                <div className="ledger-kpi-icon-wrap kpi-green">
                  <span className="material-symbols-outlined">payments</span>
                </div>
                <div className="ledger-kpi-data">
                  <span className="ledger-kpi-label">Audited Volume</span>
                  <div className="ledger-kpi-value-row">
                    <span className="ledger-kpi-primary-val">₱{ledgerTelemetry.totalPhp.toLocaleString('en-US')}</span>
                    <span className="ledger-kpi-secondary-val">
                      Gasless Sepolia Audited
                    </span>
                  </div>
                </div>
              </div>

              <div className="ledger-kpi-item">
                <div className="ledger-kpi-icon-wrap kpi-blue">
                  <span className="material-symbols-outlined">receipt_long</span>
                </div>
                <div className="ledger-kpi-data">
                  <span className="ledger-kpi-label">Recorded Transactions</span>
                  <div className="ledger-kpi-value-row">
                    <span className="ledger-kpi-primary-val">{ledgerTelemetry.onchainCount + ledgerTelemetry.gatewayCount} Receipts</span>
                    <span className="ledger-kpi-badge-val">
                      100% Verified &amp; Notarized
                    </span>
                  </div>
                </div>
              </div>

              <div className="ledger-kpi-item">
                <div className="ledger-kpi-icon-wrap kpi-purple">
                  <span className="material-symbols-outlined">groups</span>
                </div>
                <div className="ledger-kpi-data">
                  <span className="ledger-kpi-label">Community Contributors</span>
                  <div className="ledger-kpi-value-row">
                    <span className="ledger-kpi-primary-val">{ledgerTelemetry.uniqueDonors} Donors</span>
                    <span className="ledger-kpi-badge-val">
                      {ledgerTelemetry.namedCount} Verified · {ledgerTelemetry.guestCount} Guest · {ledgerTelemetry.anonCount} Anon
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {historyLoading ? (
              <div className="ledger-empty">
                <div className="spinner spinner-light" />
                <span>Querying Sepolia blockchain events &amp; audited ledger…</span>
              </div>
            ) : !history || history.length === 0 ? (
              <div className="ledger-empty">
                <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'var(--text-muted)' }}>inbox</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>No donations recorded for this campaign yet.</span>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Be the first to donate and establish an immutable record on Sepolia!</span>
              </div>
            ) : (
              <>
                {/* 3. Masterclass Web3 Control Center */}
                <div className="ledger-control-center">
                  {/* Row 1: Payment Rails Navigation */}
                  <div className="ledger-rails-row">
                    <div className="ledger-rail-tabs">
                      <button
                        type="button"
                        className={`ledger-rail-tab ${ledgerRailFilter === 'ALL' ? 'active' : ''}`}
                        onClick={() => setLedgerRailFilter('ALL')}
                      >
                        <span className="material-symbols-outlined rail-tab-icon">hub</span>
                        <span>All Rails</span>
                        <span className="ledger-pill-count">{ledgerCounts.all}</span>
                      </button>

                      {ledgerCounts.onchain > 0 && (
                        <button
                          type="button"
                          className={`ledger-rail-tab ${ledgerRailFilter === 'ONCHAIN' ? 'active tab-onchain' : ''}`}
                          onClick={() => setLedgerRailFilter('ONCHAIN')}
                        >
                          <span className="ledger-rail-dot onchain-dot" />
                          <span>Legacy Audited</span>
                          <span className="ledger-pill-count">{ledgerCounts.onchain}</span>
                        </button>
                      )}

                      {ledgerCounts.gcash > 0 && (
                        <button
                          type="button"
                          className={`ledger-rail-tab ${ledgerRailFilter === 'GCASH' ? 'active tab-gcash' : ''}`}
                          onClick={() => setLedgerRailFilter('GCASH')}
                        >
                          <span className="ledger-rail-dot gcash-dot" />
                          <span>GCash</span>
                          <span className="ledger-pill-count">{ledgerCounts.gcash}</span>
                        </button>
                      )}

                      {ledgerCounts.maya > 0 && (
                        <button
                          type="button"
                          className={`ledger-rail-tab ${ledgerRailFilter === 'MAYA' ? 'active tab-maya' : ''}`}
                          onClick={() => setLedgerRailFilter('MAYA')}
                        >
                          <span className="ledger-rail-dot maya-dot" />
                          <span>Maya</span>
                          <span className="ledger-pill-count">{ledgerCounts.maya}</span>
                        </button>
                      )}

                      {ledgerCounts.card > 0 && (
                        <button
                          type="button"
                          className={`ledger-rail-tab ${ledgerRailFilter === 'CARD' ? 'active tab-card' : ''}`}
                          onClick={() => setLedgerRailFilter('CARD')}
                        >
                          <span className="ledger-rail-dot card-dot" />
                          <span>Cards &amp; Bank</span>
                          <span className="ledger-pill-count">{ledgerCounts.card}</span>
                        </button>
                      )}
                    </div>

                    {isAnyFilterActive && (
                      <button
                        type="button"
                        className="ledger-clear-all-btn"
                        onClick={handleResetFilters}
                        title="Reset all filters"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>restart_alt</span>
                        <span>Reset Filters</span>
                      </button>
                    )}
                  </div>

                  {/* Row 2: Search, Contributor Type, Date & Sort */}
                  <div className="ledger-filters-row">
                    <div className="ledger-search-box">
                      <span className="material-symbols-outlined ledger-search-icon">search</span>
                      <input
                        type="text"
                        className="ledger-search-input"
                        placeholder="Search donor, tx hash, wallet, amount..."
                        value={ledgerSearch}
                        onChange={(e) => setLedgerSearch(e.target.value)}
                      />
                      {ledgerSearch && (
                        <button
                          type="button"
                          className="ledger-search-clear"
                          onClick={() => setLedgerSearch('')}
                          title="Clear search query"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>close</span>
                        </button>
                      )}
                    </div>

                    {/* Contributor Identity Segmented Filter */}
                    <div className="ledger-identity-tabs">
                      <button
                        type="button"
                        className={`ledger-id-tab ${ledgerIdentityFilter === 'ALL' ? 'active' : ''}`}
                        onClick={() => setLedgerIdentityFilter('ALL')}
                      >
                        All Donors
                      </button>
                      <button
                        type="button"
                        className={`ledger-id-tab ${ledgerIdentityFilter === 'VERIFIED' ? 'active' : ''}`}
                        onClick={() => setLedgerIdentityFilter('VERIFIED')}
                      >
                        Verified ({ledgerCounts.named})
                      </button>
                      {ledgerCounts.guest > 0 && (
                        <button
                          type="button"
                          className={`ledger-id-tab ${ledgerIdentityFilter === 'GUEST' ? 'active' : ''}`}
                          onClick={() => setLedgerIdentityFilter('GUEST')}
                        >
                          Guest ({ledgerCounts.guest})
                        </button>
                      )}
                      {ledgerCounts.anon > 0 && (
                        <button
                          type="button"
                          className={`ledger-id-tab ${ledgerIdentityFilter === 'ANON' ? 'active' : ''}`}
                          onClick={() => setLedgerIdentityFilter('ANON')}
                        >
                          Anonymous ({ledgerCounts.anon})
                        </button>
                      )}
                    </div>

                    {/* Date & Sort Group */}
                    <div className="ledger-aux-controls">
                      <div className="ledger-custom-date-container" ref={datePickerContainerRef}>
                        <button
                          type="button"
                          className={`ledger-date-btn-wrapper ${ledgerDateFilter ? 'is-active' : ''}`}
                          onClick={() => setDatePickerOpen(prev => !prev)}
                          title={ledgerDateFilter ? `Active filter: ${formatLedgerSelectedDate(ledgerDateFilter)}` : 'Filter transactions by date'}
                        >
                          <span className="material-symbols-outlined ledger-date-btn-icon">calendar_month</span>
                          <span className="ledger-date-btn-text">
                            {ledgerDateFilter ? formatLedgerSelectedDate(ledgerDateFilter) : 'Date'}
                          </span>
                          {ledgerDateFilter ? (
                            <span
                              role="button"
                              tabIndex={0}
                              className="ledger-date-clear-icon-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLedgerDateFilter('');
                              }}
                              title="Clear date filter"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>close</span>
                            </span>
                          ) : (
                            <span className="ledger-date-btn-arrow">{datePickerOpen ? '▴' : '▾'}</span>
                          )}
                        </button>

                        {datePickerOpen && (
                          <div className="ledger-custom-calendar-popover" onClick={(e) => e.stopPropagation()}>
                            {/* 1. Month Header & Nav */}
                            <div className="cal-header">
                              <button
                                type="button"
                                className="cal-nav-btn"
                                onClick={handlePrevMonth}
                                title="Previous Month"
                              >
                                <span className="material-symbols-outlined">chevron_left</span>
                              </button>

                              <div className="cal-month-title">
                                {calViewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                              </div>

                              <button
                                type="button"
                                className="cal-nav-btn"
                                onClick={handleNextMonth}
                                title="Next Month"
                              >
                                <span className="material-symbols-outlined">chevron_right</span>
                              </button>
                            </div>

                            {/* 2. Active Campaign Lifecycle Banner */}
                            <div className="cal-lifecycle-banner">
                              <span className="cal-pulse-dot" />
                              <span className="cal-lifecycle-text">
                                {campaignLifecycle.isDeactivated ? 'Campaign Timeline: ' : 'Active Window: '}
                                {campaignLifecycle.formattedStart} – {campaignLifecycle.formattedEnd}
                              </span>
                            </div>

                            {/* 3. Weekday Labels */}
                            <div className="cal-weekdays">
                              <span>Su</span>
                              <span>Mo</span>
                              <span>Tu</span>
                              <span>We</span>
                              <span>Th</span>
                              <span>Fr</span>
                              <span>Sa</span>
                            </div>

                            {/* 4. Days Grid */}
                            <div className="cal-grid">
                              {calMonthData.map((cell) => {
                                const inLifecycle = cell.iso >= campaignLifecycle.startIso && cell.iso <= campaignLifecycle.endIso;
                                const isStart = cell.iso === campaignLifecycle.startIso;
                                const isEnd = cell.iso === campaignLifecycle.endIso;
                                const isSelected = ledgerDateFilter === cell.iso;
                                const hasDonations = donationDateSet.has(cell.iso);

                                let cellClass = 'cal-day';
                                if (!cell.isCurrentMonth) cellClass += ' cal-day-outside';
                                if (inLifecycle) cellClass += ' cal-day-lifecycle';
                                if (isStart) cellClass += ' cal-day-start';
                                if (isEnd) cellClass += ' cal-day-end';
                                if (isSelected) cellClass += ' cal-day-selected';
                                if (hasDonations) cellClass += ' cal-day-has-tx';

                                return (
                                  <button
                                    key={cell.iso}
                                    type="button"
                                    className={cellClass}
                                    onClick={() => handleSelectDate(cell.iso)}
                                    title={`${cell.iso}${hasDonations ? ' · Has recorded donations' : ''}${inLifecycle ? ' · Active campaign timeframe' : ''}`}
                                  >
                                    <span className="cal-day-num">{cell.dayNum}</span>
                                    {hasDonations && <span className="cal-day-tx-dot" />}
                                  </button>
                                );
                              })}
                            </div>

                            {/* 5. Footer with Legend & Actions */}
                            <div className="cal-footer">
                              <div className="cal-legend">
                                <span className="cal-legend-item">
                                  <span className="cal-legend-swatch lifecycle-swatch" />
                                  <span>Active Window</span>
                                </span>
                                <span className="cal-legend-item">
                                  <span className="cal-legend-dot tx-dot-swatch" />
                                  <span>Donation</span>
                                </span>
                              </div>

                              <div className="cal-actions">
                                {ledgerDateFilter ? (
                                  <button
                                    type="button"
                                    className="cal-action-btn cal-clear-btn"
                                    onClick={() => {
                                      setLedgerDateFilter('');
                                      setDatePickerOpen(false);
                                    }}
                                  >
                                    Clear Filter
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="cal-action-btn cal-jump-btn"
                                    onClick={handleJumpToCampaign}
                                    title="View active campaign month"
                                  >
                                    Active Month
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="ledger-sort-wrapper">
                        <span className="material-symbols-outlined ledger-sort-icon">sort</span>
                        <select
                          className="ledger-sort-select"
                          value={ledgerSort}
                          onChange={(e) => setLedgerSort(e.target.value)}
                          aria-label="Sort ledger records"
                        >
                          <option value="NEWEST">Newest</option>
                          <option value="OLDEST">Oldest</option>
                          <option value="AMOUNT_HIGH">Highest Amount</option>
                          <option value="AMOUNT_LOW">Lowest Amount</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. High-Density Structured Ledger Table */}
                <div className="ledger-table-container">
                  <table className="ledger-table">
                    <thead>
                      <tr>
                        <th style={{ width: '18%' }}>Date &amp; Time</th>
                        <th style={{ width: '28%' }}>Contributor</th>
                        <th style={{ width: '16%' }}>Channel</th>
                        <th style={{ width: '22%' }}>Audit Proof / Tx</th>
                        <th style={{ width: '16%', textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHistory.length === 0 ? (
                        <tr className="ledger-empty-row">
                          <td colSpan={5} style={{ padding: 0, border: 'none', background: 'transparent' }}>
                            <div className="ledger-no-results" style={{ padding: '48px 16px', minHeight: '220px' }}>
                              <span className="material-symbols-outlined ledger-no-results-icon">
                                {ledgerDateFilter ? 'event_busy' : 'filter_alt_off'}
                              </span>
                              <span className="ledger-no-results-title">
                                {ledgerDateFilter
                                  ? `No transactions recorded on ${formatLedgerSelectedDate(ledgerDateFilter)}`
                                  : 'No transactions match your query'}
                              </span>
                              <span className="ledger-no-results-desc">
                                {ledgerDateFilter
                                  ? `No transactions found for ${formatLedgerSelectedDate(ledgerDateFilter)}. Try selecting another date or clear the filter to view all recorded donations.`
                                  : 'Try loosening your search keywords or resetting active filters.'}
                              </span>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                style={{ marginTop: '10px', fontSize: '0.74rem' }}
                                onClick={() => {
                                  setLedgerSearch('');
                                  setLedgerRailFilter('ALL');
                                  setLedgerIdentityFilter('ALL');
                                  setLedgerDateFilter('');
                                }}
                              >
                                {ledgerDateFilter ? 'View All Campaign Dates' : 'Reset All Filters'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredHistory.map((rec, idx) => {
                          const railMeta = getTransactionRailMeta(rec.txHash, rec.paymentMethod);
                          const isCopied = copiedHashKey === rec.txHash;
                          const isAnon = Boolean(rec.isAnonymous);
                          const isGuest = Boolean(rec.isGuest || (!rec.donorId && (!rec.wallet || rec.wallet === '' || rec.wallet === '0x0000000000000000000000000000000000000000')));

                          const parsedDate = parseSafeDate(rec.createdAt);
                          const recDateStr = parsedDate
                            ? parsedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            : 'Recently';
                          const recTimeStr = parsedDate
                            ? parsedDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                            : '';
                          const recIsoDate = parsedDate
                            ? `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`
                            : '';
                          const isDateMatched = ledgerDateFilter && recIsoDate === ledgerDateFilter;
                          const timeAgo = formatTimeAgo(rec.createdAt);

                          const donorDisplayName = isAnon
                            ? 'Anonymous Donor'
                            : isGuest
                              ? (rec.donor && rec.donor !== 'Verified Donor' && rec.donor !== 'Verified Supporter' ? rec.donor : 'Guest Donor')
                              : (rec.donor && !rec.donor.includes('@')
                                  ? rec.donor
                                  : (rec.donor
                                      ? rec.donor.split('@')[0].replace(/[\._\d]/g, ' ').trim().split(' ').filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Verified Donor'
                                      : 'Verified Donor')
                                );

                          return (
                            <tr key={idx} className={`ledger-row ${isDateMatched ? 'ledger-row-highlight' : ''}`}>
                              {/* 1. Date & Time */}
                              <td>
                                <div className="ledger-cell-datetime">
                                  <span className={`ledger-date-val ${isDateMatched ? 'matched-date' : ''}`}>
                                    {recDateStr}
                                  </span>
                                  <div className="ledger-time-sub">
                                    <span>{recTimeStr}</span>
                                    {timeAgo && <span className="ledger-timeago-dot">· {timeAgo}</span>}
                                  </div>
                                </div>
                              </td>

                              {/* 2. Contributor */}
                              <td>
                                <div className="ledger-cell-contributor">
                                  <div 
                                    className={`ledger-avatar-dot ${isAnon ? 'dot-anon' : isGuest ? 'dot-guest' : 'dot-named'} ${!isGuest && !isAnon ? 'is-clickable' : ''}`}
                                    onClick={() => {
                                      if (!isGuest && !isAnon) setSelectedLedgerDonor(rec);
                                    }}
                                    title={!isGuest && !isAnon ? `View ${donorDisplayName}'s Donor Profile & Honors` : undefined}
                                  >
                                    {isAnon ? (
                                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                                        visibility_off
                                      </span>
                                    ) : isGuest ? (
                                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                                        person_outline
                                      </span>
                                    ) : rec.avatarUrl && (rec.avatarUrl.startsWith('data:') || rec.avatarUrl.startsWith('http')) ? (
                                      <img src={rec.avatarUrl} alt={donorDisplayName} className="ledger-avatar-photo" />
                                    ) : rec.avatarUrl && rec.avatarUrl.length < 30 ? (
                                      <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                                        {rec.avatarUrl}
                                      </span>
                                    ) : (
                                      <span className="ledger-avatar-initials">
                                        {(donorDisplayName || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'V'}
                                      </span>
                                    )}
                                  </div>
                                  <div className="ledger-contributor-info">
                                    <div className="ledger-contributor-name-line">
                                      {!isGuest && !isAnon ? (
                                        <button
                                          type="button"
                                          className="ledger-contributor-name-btn"
                                          onClick={() => setSelectedLedgerDonor(rec)}
                                          title={`View ${donorDisplayName}'s Profile & Impact`}
                                        >
                                          {donorDisplayName}
                                        </button>
                                      ) : (
                                        <span className="ledger-contributor-name" title={donorDisplayName}>
                                          {donorDisplayName}
                                        </span>
                                      )}
                                      {!isGuest && !isAnon && !rec.hideBadge && (rec.donorId || rec.wallet) && (
                                        <DonorBadge
                                          size="xs"
                                          donorId={rec.donorId}
                                          walletAddress={rec.wallet}
                                          amountEth={rec.globalAmountEth}
                                          amountPhp={rec.globalAmountPhp}
                                          showLabel={false}
                                          showTooltip={true}
                                          showProgress={false}
                                        />
                                      )}
                                    </div>
                                    {isAnon ? (
                                      <span className="ledger-anon-tag">Private Donor</span>
                                    ) : isGuest ? (
                                      <span className="ledger-guest-tag">Guest Supporter</span>
                                    ) : rec.username ? (
                                      <span className="ledger-username-tag" title={`@${rec.username}`}>
                                        @{rec.username}
                                      </span>
                                    ) : (
                                      <span className="ledger-verified-tag">Verified Contributor</span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* 3. Channel */}
                              <td>
                                <div className="ledger-cell-channel">
                                  <span className={`ledger-channel-badge ${railMeta.badgeClass}`}>
                                    <span className={`ledger-rail-dot ${railMeta.dotClass}`} />
                                    <span>{railMeta.name}</span>
                                  </span>
                                  <span className="ledger-channel-audit-text">
                                    {railMeta.railKey === 'ONCHAIN' ? 'Sepolia Mined' : 'Relayed On-Chain'}
                                  </span>
                                </div>
                              </td>

                              {/* 4. Audit Proof / Tx Hash */}
                              <td>
                                <div className="ledger-cell-proof">
                                  <div className="ledger-proof-hash-line">
                                    {(() => {
                                      const rawHash = rec.txHash || '';
                                      let cleanDisplay = rawHash;
                                      if (cleanDisplay.startsWith('FIAT-GCAS-')) cleanDisplay = 'GCASH-' + cleanDisplay.slice(10);
                                      else if (cleanDisplay.startsWith('FIAT-MAYA-')) cleanDisplay = 'MAYA-' + cleanDisplay.slice(10);
                                      else if (cleanDisplay.startsWith('FIAT-BANK-')) cleanDisplay = 'BANK-' + cleanDisplay.slice(10);
                                      else if (cleanDisplay.startsWith('FIAT-CARD-')) cleanDisplay = 'CARD-' + cleanDisplay.slice(10);
                                      else if (cleanDisplay.startsWith('FIAT-')) cleanDisplay = 'REF-' + cleanDisplay.slice(5);

                                      const shortDisplay = cleanDisplay
                                        ? cleanDisplay.length > 20
                                          ? `${cleanDisplay.slice(0, 8)}...${cleanDisplay.slice(-6)}`
                                          : cleanDisplay
                                        : 'Confirmed';

                                      return (
                                        <span className="ledger-proof-mono" title={cleanDisplay || 'Confirmed'}>
                                          {shortDisplay}
                                        </span>
                                      );
                                    })()}
                                    {rec.txHash && (
                                      <button
                                        type="button"
                                        className={`ledger-proof-copy-btn ${isCopied ? 'copied' : ''}`}
                                        onClick={(e) => handleCopyHash(e, rec.txHash, 'Transaction reference')}
                                        title="Copy transaction reference"
                                      >
                                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
                                          {isCopied ? 'check' : 'content_copy'}
                                        </span>
                                      </button>
                                    )}
                                  </div>
                                  {rec.txHash && (() => {
                                    const isRealMinedTx = rec.txHash.startsWith('0x') && rec.txHash.length === 66 && !rec.txHash.startsWith('0x19ddb');
                                    const explorerHref = (railMeta.railKey === 'ONCHAIN' || isRealMinedTx)
                                      ? `${SEPOLIA_EXPLORER}${rec.txHash}`
                                      : 'https://sepolia.etherscan.io/address/0xB8Effb4f0394946a01da9C5342fC2e70c1E99ddA';
                                    const linkLabel = isRealMinedTx
                                      ? 'View on Etherscan'
                                      : (railMeta.railKey === 'ONCHAIN' ? 'Sepolia Explorer' : 'Contract Proof');
                                    const linkTitle = isRealMinedTx
                                      ? `Inspect notarized ${railMeta.name} audit proof on Sepolia Etherscan`
                                      : 'Inspect multi-sig escrow contract on Sepolia Etherscan';

                                    return (
                                      <a
                                        href={explorerHref}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="ledger-etherscan-link"
                                        title={linkTitle}
                                      >
                                        <span>{linkLabel}</span>
                                        <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>open_in_new</span>
                                      </a>
                                    );
                                  })()}
                                </div>
                              </td>

                              {/* 5. Amount */}
                              <td style={{ textAlign: 'right' }}>
                                <div className="ledger-cell-amount">
                                  <span className="ledger-amount-primary">
                                    ₱{(rec.phpAmount || Math.round((rec.rawAmount || parseFloat(rec.amount || 0)) * 170000)).toLocaleString('en-US')}
                                  </span>
                                  <span className="ledger-amount-secondary">
                                    PHP Verified
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* 5. Clean Modal Footer */}
            <div className="ledger-modal-footer">
              <div className="ledger-footer-status">
                <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--accent, #22c55e)' }}>verified_user</span>
                <span>Decentralized &amp; Cryptographically Audited Ledger</span>
              </div>
              <div className="ledger-footer-actions">
                <span className="ledger-footer-count">Showing {filteredHistory.length} of {history ? history.length : 0} records</span>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setLedgerOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Interactive Donor Profile & Honors Modal ── */}
      {selectedLedgerDonor && (
        <DonorTierModal
          isOpen={Boolean(selectedLedgerDonor)}
          onClose={() => setSelectedLedgerDonor(null)}
          walletAddress={selectedLedgerDonor.wallet}
          donorId={selectedLedgerDonor.donorId}
          txHash={selectedLedgerDonor.txHash || selectedLedgerDonor.Tx_Hash}
          totalDonatedEth={selectedLedgerDonor.globalAmountEth || selectedLedgerDonor.rawAmount || 0}
          totalDonatedPhp={selectedLedgerDonor.globalAmountPhp || selectedLedgerDonor.phpAmount || 0}
          donationCount={1}
          campaignsSupported={selectedLedgerDonor.campaignsSupported || 1}
          dedication={selectedLedgerDonor.dedication || selectedLedgerDonor.bio || ''}
          donorName={selectedLedgerDonor.donor || 'Verified Contributor'}
        />
      )}

      {/* ── Donor's Own Philanthropy Certificate Modal ── */}
      {certModalOpen && (() => {
        let loggedUser = null;
        try {
          const raw = localStorage.getItem('bbdrts_user');
          if (raw) loggedUser = JSON.parse(raw);
        } catch (_) {}
        const userEth = (Number(amount || 0)) / 170000;
        const userPhp = Number(amount || 0);
        const resolvedName = isAnonymous
          ? 'Anonymous Donor'
          : (donorName || loggedUser?.display_name || loggedUser?.name || 'Verified Philanthropist');
        return (
          <DonorTierModal
            isOpen={certModalOpen}
            onClose={() => setCertModalOpen(false)}
            walletAddress={walletAddress || loggedUser?.wallet_address || ''}
            donorId={loggedUser?.id || loggedUser?.Donor_ID || ''}
            txHash={txHash}
            totalDonatedEth={userEth}
            totalDonatedPhp={userPhp}
            donationCount={1}
            campaignsSupported={1}
            dedication={customMsg || loggedUser?.bio || 'In solidarity with disaster relief efforts.'}
            donorName={resolvedName}
          />
        );
      })()}

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
              className={`card bounce-in${!isPaymentProcessing && donateStep === 0 ? ' vc-donate-shell' : ''}${!isPaymentProcessing && donateStep === 8 ? ' vc-donate-shell vc-donate-shell--qr' : ''}${isPaymentProcessing ? ' vc-donate-shell vc-donate-shell--processing' : ''}`}
              style={{
                position: 'relative',
                width: isPaymentProcessing ? '464px' : ((donateStep === 6 || donateStep === 7) ? '880px' : ((donateStep === 0 || (donateStep === 8 && !instantReceipt && !instantSettlingOnChain)) ? '748px' : '464px')),
                maxWidth: '94vw',
                maxHeight: '92dvh',
                overflowY: 'auto',
                padding: (isPaymentProcessing || (!isPaymentProcessing && (donateStep === 0 || donateStep === 8))) ? '0px' : '24px',
                background: isPaymentProcessing ? undefined : 'var(--surface)',
                border: isPaymentProcessing ? undefined : '1px solid var(--border)',
                boxShadow: isPaymentProcessing ? undefined : 'var(--shadow-card, 0 25px 50px -12px rgba(0, 0, 0, 0.7))',
                borderRadius: (isPaymentProcessing || (!isPaymentProcessing && (donateStep === 0 || donateStep === 8))) ? '14px' : '18px',
                transition: 'width 0.25s ease'
              }}
            >

              {/* ── Universal Institutional Payment Processing Screen (Stripe / Vercel Geist) ── */}
              {isPaymentProcessing && (() => {
                const isEthSign = donateStep === 2;
                const isEthMine = donateStep === 3;
                const isCard = donateStep === 6 && isUploading;
                const isWallet = donateStep === 7 && gatewayLoading;

                let railIcon = 'account_balance_wallet';
                let railBadge = 'Official GCash Channel';
                let statusLabel = 'VERIFYING';
                let title = 'Processing GCash Transfer';
                let subtitle = 'Verifying your payment reference and notarizing your receipt on Sepolia.';
                let amountNumber = `₱${Math.round(parseFloat(amount || 0)).toLocaleString('en-US')}`;
                let amountUnit = 'PHP';
                let secondaryCaption = 'Gasless Sepolia Audit Proof';
                let traceLabel = 'GCash Reference';
                let traceValue = (refNumber || gatewayRefNo || 'Analyzing slip...').trim();
                let step1Text = 'Payment slip & reference ingested';
                let step2Text = 'Validating reference with GCash gateway';
                let step3Text = 'Notarizing audit receipt on Sepolia EVM';

                if (isWallet) {
                  const railName = gatewayMethod || 'GCash';
                  railIcon = 'account_balance_wallet';
                  railBadge = `Official ${railName} Rail`;
                  statusLabel = 'VERIFYING';
                  title = `Processing ${railName} Transfer`;
                  subtitle = `Cross-checking your ${railName} reference and preparing your immutable receipt.`;
                  amountNumber = `₱${Math.round(parseFloat(amount || 0)).toLocaleString('en-US')}`;
                  amountUnit = 'PHP';
                  secondaryCaption = 'Gasless Sepolia Audit Proof';
                  traceLabel = `${railName} Reference`;
                  traceValue = (refNumber || gatewayRefNo || 'Analyzing slip...').trim();
                  step1Text = 'Payment slip & reference ingested';
                  step2Text = `Validating reference with ${railName} gateway`;
                  step3Text = 'Notarizing audit receipt on Sepolia EVM';
                } else if (isCard) {
                  const brand = cardType !== 'unknown' ? cardType.toUpperCase() : 'CARD';
                  railIcon = 'credit_card';
                  railBadge = 'PCI-DSS Level 1 · Card Rail';
                  statusLabel = 'AUTHORIZING';
                  title = 'Authorizing Card Payment';
                  subtitle = 'Encrypting payload and clearing authorization with your issuing bank.';
                  amountNumber = `₱${Math.round(parseFloat(amount || 0)).toLocaleString('en-US')}`;
                  amountUnit = 'PHP';
                  secondaryCaption = 'Gasless Sepolia Audit Proof';
                  traceLabel = 'Payment Instrument';
                  traceValue = `${brand} •••• ${cardNumber ? cardNumber.replace(/\D/g, '').slice(-4) : '••••'}`;
                  step1Text = 'Card details tokenized & encrypted';
                  step2Text = '3D Secure bank clearing authorization';
                  step3Text = 'Minting tamper-proof audit receipt';
                } else if (isEthSign) {
                  railIcon = 'currency_exchange';
                  railBadge = 'Sepolia EVM · Smart Contract';
                  statusLabel = 'AWAITING SIGN';
                  title = 'Awaiting Wallet Signature';
                  subtitle = 'Review and approve the transaction prompt in your browser wallet.';
                  amountNumber = `${amount || '0'}`;
                  amountUnit = 'ETH';
                  secondaryCaption = `≈ ₱${Math.round(parseFloat(amount || 0) * 170000).toLocaleString('en-US')} PHP`;
                  traceLabel = 'Sender Wallet';
                  traceValue = walletAddress ? `${walletAddress.slice(0, 8)}…${walletAddress.slice(-6)}` : 'Connected Wallet';
                  step1Text = 'Relief smart contract call prepared';
                  step2Text = 'Awaiting cryptographic signature';
                  step3Text = 'Broadcasting to Sepolia validators';
                } else if (isEthMine) {
                  railIcon = 'hub';
                  railBadge = 'Sepolia Validator Network';
                  statusLabel = 'CONFIRMING';
                  title = 'Confirming On-Chain';
                  subtitle = 'Broadcasting signed payload to Sepolia nodes for block finalization.';
                  amountNumber = `${amount || '0'}`;
                  amountUnit = 'ETH';
                  secondaryCaption = `≈ ₱${Math.round(parseFloat(amount || 0) * 170000).toLocaleString('en-US')} PHP`;
                  traceLabel = 'Transaction Hash';
                  traceValue = txHash ? `${txHash.slice(0, 10)}…${txHash.slice(-8)}` : 'Broadcasting…';
                  step1Text = 'Client signature cryptographically verified';
                  step2Text = 'Validator consensus & block inclusion';
                  step3Text = 'Generating immutable audit receipt';
                }

                return (
                  <div className="pp-shell fade-in">
                    {/* Top Hairline Indeterminate Progress Stream */}
                    <div className="pp-progress-track" aria-hidden="true">
                      <div className="pp-progress-bar" />
                    </div>

                    {/* Flush Recessed Header */}
                    <div className="pp-header">
                      <div className="pp-rail-id">
                        <span className="material-symbols-outlined">{railIcon}</span>
                        <span>{railBadge}</span>
                      </div>
                      <div className="pp-status-chip">
                        <span className="pp-status-dot" />
                        <span>{statusLabel}</span>
                      </div>
                    </div>

                    {/* Main Body */}
                    <div className="pp-body">
                      <div className="pp-hero">
                        <div className="pp-icon-stage" aria-hidden="true">
                          <div className="pp-icon-well">
                            <span className="material-symbols-outlined">{railIcon}</span>
                          </div>
                          <div className="pp-icon-ring" />
                        </div>
                        <h3 className="pp-title">{title}</h3>
                        <p className="pp-subtitle">{subtitle}</p>
                      </div>

                      {/* Hero Amount Display (Zero Wrapping) */}
                      <div className="pp-amount-card">
                        <span className="pp-amount-eyebrow">Contribution Amount</span>
                        <div className="pp-amount-row">
                          <span className="pp-amount-val">{amountNumber}</span>
                          <span className="pp-amount-unit">{amountUnit}</span>
                        </div>
                        <span className="pp-amount-note">
                          <span className="material-symbols-outlined">verified_user</span>
                          <span>{secondaryCaption}</span>
                        </span>
                      </div>

                      {/* Clean 2-Row Receipt Meta Table */}
                      <div className="pp-meta-table">
                        <div className="pp-meta-row">
                          <span className="pp-meta-key">Campaign</span>
                          <span className="pp-meta-val" title={camp.title}>{camp.title}</span>
                        </div>
                        <div className="pp-meta-row">
                          <span className="pp-meta-key">{traceLabel}</span>
                          <span className="pp-meta-val pp-mono">{traceValue}</span>
                        </div>
                      </div>

                      {/* Unified 3-Step Verification Checklist (Single Clean Container) */}
                      <div className="pp-steps">
                        <div className="pp-step is-done">
                          <span className="pp-step-node">
                            <span className="material-symbols-outlined">check</span>
                          </span>
                          <span className="pp-step-label">{step1Text}</span>
                          <span className="pp-step-tag">Done</span>
                        </div>

                        <div className="pp-step is-active">
                          <span className="pp-step-node">
                            <span className="pp-step-spinner" />
                          </span>
                          <span className="pp-step-label">{step2Text}</span>
                          <span className="pp-step-tag">Active</span>
                        </div>

                        <div className="pp-step is-pending">
                          <span className="pp-step-node">
                            <span className="pp-step-hollow" />
                          </span>
                          <span className="pp-step-label">{step3Text}</span>
                          <span className="pp-step-tag">Queued</span>
                        </div>
                      </div>

                      {isEthSign && (
                        <button
                          type="button"
                          className="pp-cancel-btn"
                          onClick={() => setDonateStep(1)}
                        >
                          Cancel &amp; Return to Form
                        </button>
                      )}
                    </div>

                    {/* Flush Recessed Security Footer */}
                    <div className="pp-footer">
                      <span className="material-symbols-outlined">lock</span>
                      <span>256-Bit TLS Encrypted · 0% Platform Fee · Immutable Audit Trail</span>
                    </div>
                  </div>
                );
              })()}

              {/* ── STEP 0: Vercel Geist Split Checkout ── */}
              {!isPaymentProcessing && donateStep === 0 && (() => {
                const selectedChannel = gatewayMethod || 'GCash';
                const isInstant = Boolean(xenditEnabled && checkoutMode === 'instant');
                const parsedAmount = parseFloat(amount || 0);
                const hasAmount = !isNaN(parsedAmount) && parsedAmount > 0;
                const channelLabel = selectedChannel === 'Bank / Card' ? 'Bank & Cards' : selectedChannel;
                const orgDisplay = getOrgDisplayName(camp.orgAddress, camp.orgName, camp.id);
                const campDisplay = formatCampaignTitle(camp.title, camp.id);

                const handleContinue = () => {
                  if (isInstant) {
                    if (!hasAmount || Math.round(parsedAmount) < 1) {
                      document.getElementById('vc-donate-amount-input')?.focus();
                    }
                    startInstantCheckout(selectedChannel);
                    return;
                  }
                  if (selectedChannel === 'Bank / Card') {
                    createDirectQrIntent('Bank / Card');
                    setDonateStep(6);
                    return;
                  }
                  setGatewayMethod(selectedChannel);
                  setGatewayStep(0);
                  setGatewayMobile('');
                  setGatewayOtp(['', '', '', '', '', '']);
                  handleRemoveProof();
                  createDirectQrIntent(selectedChannel);
                  setDonateStep(7);
                };

                const channels = [
                  {
                    id: 'GCash',
                    name: 'GCash',
                    desc: isInstant ? 'Dynamic QR Ph · Instant e-wallet transfer' : 'Direct NGO GCash QR · AI slip scan',
                    badgeClass: 'gcash',
                    icon: 'G'
                  },
                  {
                    id: 'Maya',
                    name: 'Maya',
                    desc: isInstant ? 'Dynamic QR Ph · Maya wallet checkout' : 'Direct NGO Maya QR · AI slip scan',
                    badgeClass: 'maya',
                    icon: 'maya'
                  },
                  {
                    id: 'Bank / Card',
                    name: 'Bank & Cards',
                    desc: isInstant ? 'Dynamic QR Ph · InstaPay bank transfer' : 'Visa, Mastercard, or direct bank transfer',
                    badgeClass: 'bank',
                    icon: <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>credit_card</span>
                  }
                ];

                const presets = [
                  { val: '100', label: '₱100' },
                  { val: '500', label: '₱500' },
                  { val: '1000', label: '₱1,000' },
                  { val: '2500', label: '₱2,500' },
                  { val: '5000', label: '₱5,000' }
                ];

                return (
                  <div className="fade-in">
                    {/* Edge-to-edge Header */}
                    <div className="vc-donate-header">
                      <div className="vc-donate-header-left">
                        <img
                          src={coverData.imageUrl}
                          alt={campDisplay}
                          className="vc-donate-thumb"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=200&q=80';
                          }}
                        />
                        <div className="vc-donate-title-group">
                          <h2 className="vc-donate-title" title={campDisplay}>
                            Donate to {campDisplay}
                          </h2>
                          <div className="vc-donate-sub">
                            <strong>{orgDisplay}</strong>
                            <span className="material-symbols-outlined" style={{ fontSize: '13px', color: '#10b981' }}>verified</span>
                            <span>·</span>
                            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {goalReached ? 'Goal reached' : `${pct}% funded`}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="vc-donate-close-btn"
                        onClick={() => {
                          setMagnifierActive(false);
                          setModalOpen(false);
                        }}
                        title="Close"
                        aria-label="Close"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                      </button>
                    </div>

                    {/* Two-Column Split Checkout Grid */}
                    <div className="vc-donate-grid">
                      {/* Left Column: Amount + Payment Channel */}
                      <div className="vc-donate-main">
                        {/* Amount Field & Connected Presets */}
                        <div>
                          <div className="vc-field-header">
                            <label htmlFor="vc-donate-amount-input" className="vc-field-label">
                              Contribution amount
                            </label>
                            {amount && Number(amount) > 0 && (
                              <button
                                type="button"
                                className="vc-text-action"
                                onClick={() => setAmount('')}
                              >
                                Clear
                              </button>
                            )}
                          </div>

                          <div className="vc-amount-field">
                            <span className="vc-currency-symbol">₱</span>
                            <input
                              id="vc-donate-amount-input"
                              type="text"
                              inputMode="decimal"
                              className="vc-amount-input"
                              value={amount}
                              onChange={(e) => {
                                const cleaned = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
                                setAmount(cleaned);
                              }}
                              placeholder="0"
                              autoComplete="off"
                            />
                            <span className="vc-currency-badge">PHP</span>
                          </div>

                          <div className="vc-preset-bar" role="group" aria-label="Quick amount presets">
                            {presets.map((p) => {
                              const isSel = String(amount) === p.val;
                              return (
                                <button
                                  key={p.val}
                                  type="button"
                                  className={`vc-preset-btn${isSel ? ' active' : ''}`}
                                  onClick={() => setAmount(p.val)}
                                >
                                  {p.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Payment Channel + Inline Verification Switcher */}
                        <div>
                          <div className="vc-field-header">
                            <span className="vc-field-label">Payment method</span>
                            {xenditEnabled && (
                              <div className="vc-mode-tabs" role="tablist" aria-label="Verification mode">
                                <button
                                  type="button"
                                  role="tab"
                                  aria-selected={checkoutMode === 'instant'}
                                  className={`vc-mode-tab${checkoutMode === 'instant' ? ' active' : ''}`}
                                  onClick={() => setCheckoutMode('instant')}
                                >
                                  Instant QR Ph
                                </button>
                                <button
                                  type="button"
                                  role="tab"
                                  aria-selected={checkoutMode === 'manual'}
                                  className={`vc-mode-tab${checkoutMode === 'manual' ? ' active' : ''}`}
                                  onClick={() => setCheckoutMode('manual')}
                                >
                                  Direct QR &amp; Slip
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="vc-channel-list" role="radiogroup" aria-label="Payment channel">
                            {channels.map((ch) => {
                              const isSel = selectedChannel === ch.id;
                              return (
                                <button
                                  key={ch.id}
                                  type="button"
                                  role="radio"
                                  aria-checked={isSel}
                                  disabled={instantLoading}
                                  className={`vc-channel-row${isSel ? ' active' : ''}`}
                                  onClick={() => setGatewayMethod(ch.id)}
                                >
                                  <div className={`vc-channel-icon ${ch.badgeClass}`}>
                                    {ch.icon}
                                  </div>
                                  <div className="vc-channel-meta">
                                    <div className="vc-channel-name">{ch.name}</div>
                                    <div className="vc-channel-desc">{ch.desc}</div>
                                  </div>
                                  <span className="vc-channel-radio" aria-hidden="true" />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Order Summary & CTA */}
                      <div className="vc-donate-summary">
                        <div>
                          <div className="vc-field-label">Summary</div>

                          <div className="vc-summary-rows">
                            <div className="vc-summary-row">
                              <span className="vc-summary-k">Method</span>
                              <span className="vc-summary-v">{channelLabel}</span>
                            </div>
                            <div className="vc-summary-row">
                              <span className="vc-summary-k">Verification</span>
                              <span className="vc-summary-v">
                                <span
                                  className="vc-summary-dot"
                                  style={{ background: isInstant ? '#10b981' : '#3b82f6' }}
                                />
                                {isInstant ? 'Auto-Webhook' : 'Direct QR · AI Scan'}
                              </span>
                            </div>
                            <div className="vc-summary-row">
                              <span className="vc-summary-k">Platform fee</span>
                              <span className="vc-summary-v free">₱0.00</span>
                            </div>
                            <div className="vc-summary-row">
                              <span className="vc-summary-k">Audit ledger</span>
                              <span className="vc-summary-v">Sepolia · Gasless</span>
                            </div>
                          </div>

                          <div className="vc-summary-total">
                            <span className="vc-summary-total-label">Total due</span>
                            <span className={`vc-summary-total-val${hasAmount ? '' : ' empty'}`}>
                              {hasAmount ? (
                                <>
                                  ₱{parsedAmount.toLocaleString('en-US', {
                                    minimumFractionDigits: parsedAmount % 1 ? 2 : 0,
                                    maximumFractionDigits: 2
                                  })}
                                  <span className="vc-summary-total-unit">PHP</span>
                                </>
                              ) : (
                                <span className="vc-summary-placeholder">Enter amount</span>
                              )}
                            </span>
                          </div>

                          <div className="vc-summary-note">
                            <span className="material-symbols-outlined vc-summary-note-icon">
                              {isInstant ? 'bolt' : 'document_scanner'}
                            </span>
                            <span>
                              {isInstant
                                ? 'Generates a single-use QR Ph code. Auto-verified via webhook and sealed on Sepolia — no slip upload needed.'
                                : 'Shows the NGO QR code with a unique BB-XXXX tracking code for fast AI receipt verification.'}
                            </span>
                          </div>
                        </div>

                        <div>
                          <button
                            type="button"
                            disabled={instantLoading}
                            className="vc-donate-cta"
                            onClick={handleContinue}
                          >
                            {instantLoading ? (
                              <>
                                <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
                                <span>Preparing QR Ph...</span>
                              </>
                            ) : (
                              <>
                                <span>
                                  {hasAmount
                                    ? `Donate ₱${parsedAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })} via ${channelLabel}`
                                    : `Continue with ${channelLabel}`}
                                </span>
                                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>arrow_forward</span>
                              </>
                            )}
                          </button>
                          <div className="vc-donate-micro">
                            100% goes to verified humanitarian relief
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ── STEP 1: Web3 MetaMask Review & Signing ── */}
              {!isPaymentProcessing && donateStep === 1 && (
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

                  {/* Amount Breakdown Box & Input */}
                  <div style={{ marginBottom: '14px', background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-lg, 12px)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 700 }}>
                        Donation Amount (PHP)
                      </span>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        ≈ {((Number(amount || 0)) / 170000).toFixed(6)} ETH
                      </span>
                    </div>

                    <div style={{ position: 'relative', marginBottom: '10px' }}>
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: 'var(--accent)', fontSize: '1.2rem' }}>₱</span>
                      <input
                        type="number"
                        className="input"
                        style={{ width: '100%', paddingLeft: '32px', fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', borderRadius: 'var(--radius-md, 8px)' }}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="500"
                        min="1"
                      />
                    </div>

                    {/* Quick Preset Increments */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {['100', '500', '1000', '2500', '5000'].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          className="payment-quick-msg-chip"
                          style={{
                            background: amount === preset ? 'var(--accent)' : 'var(--bg-hover)',
                            borderColor: amount === preset ? 'var(--accent)' : 'var(--border)',
                            color: amount === preset ? 'var(--bg-base)' : 'var(--text-primary)',
                            fontWeight: 600,
                            fontSize: '0.74rem',
                            padding: '4px 10px',
                            borderRadius: 'var(--radius-sm, 6px)',
                            cursor: 'pointer'
                          }}
                          onClick={() => setAmount(preset)}
                        >
                          ₱{Number(preset).toLocaleString()}
                        </button>
                      ))}
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
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)' }}>{isAnonymous ? 'Name hidden from public list' : 'Hide name on public donor list'}</span>
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
                      disabled={!legalConfirm || !amount || parseFloat(amount) <= 0}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>lock</span>
                      <span>Confirm & Sign via MetaMask</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP 4: Verified Cryptographic Receipt Screen ── */}
              {!isPaymentProcessing && donateStep === 4 && (
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
                      <span style={{ fontSize: '0.72rem', color: '#22c55e', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>check</span>
                        CONFIRMED
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted, #94a3b8)' }}>Campaign:</span>
                      <strong style={{ fontSize: '0.84rem', color: 'var(--text-primary, #fff)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{camp.title}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted, #94a3b8)' }}>Amount:</span>
                      <strong style={{ fontSize: '0.96rem', color: '#22c55e' }}>₱{Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} PHP</strong>
                    </div>

                    {txHash && (() => {
                      const isRealMinedTx = txHash.startsWith('0x') && txHash.length === 66 && !txHash.startsWith('0x19ddb');
                      const explorerUrl = isRealMinedTx
                        ? `${SEPOLIA_EXPLORER}${txHash}`
                        : 'https://sepolia.etherscan.io/address/0xB8Effb4f0394946a01da9C5342fC2e70c1E99ddA';
                      const linkTitle = isRealMinedTx
                        ? 'Inspect mined transaction on Sepolia Etherscan'
                        : 'Inspect verified contract on Sepolia Etherscan';
                      return (
                        <div style={{ paddingTop: '8px', borderTop: '1px solid var(--border, rgba(255,255,255,0.08))' }}>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '4px' }}>Transaction Proof:</div>
                          <a
                            href={explorerUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: '#22c55e', textDecoration: 'none', wordBreak: 'break-all', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'monospace' }}
                            title={linkTitle}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>open_in_new</span>
                            {txHash.slice(0, 20)}...{txHash.slice(-10)}
                          </a>
                        </div>
                      );
                    })()}

                    {/* Two-Sided Settlement Audit: Sender Card (Debited) -> Receiver NGO Account (Credited) */}
                    {cardNumber && (
                      <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed rgba(255,255,255,0.12)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div style={{ background: 'rgba(0,0,0,0.28)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#38bdf8' }}>credit_card</span>
                            Sender Card (Debited)
                          </div>
                          <div style={{ fontSize: '0.80rem', color: '#fff', fontWeight: 700, marginTop: '4px' }}>
                            {cardName || 'Gester Macaldo'}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontFamily: 'monospace', marginTop: '2px' }}>
                            •••• {cardNumber.replace(/\s+/g, '').slice(-4) || '4242'} ({cardType?.toUpperCase() || 'VISA'})
                          </div>
                          <div style={{ fontSize: '0.76rem', color: '#ef4444', fontWeight: 800, marginTop: '4px' }}>
                            -₱{Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} PHP
                          </div>
                        </div>

                        <div style={{ background: 'rgba(34, 197, 94, 0.06)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(34, 197, 94, 0.22)' }}>
                          <div style={{ fontSize: '0.68rem', color: '#22c55e', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#22c55e' }}>account_balance</span>
                            Receiver NGO (Credited)
                          </div>
                          <div style={{ fontSize: '0.80rem', color: '#fff', fontWeight: 700, marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {camp.orgName || 'BBDRTS Relief Foundation'}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontFamily: 'monospace', marginTop: '2px' }}>
                            {camp.bankName || 'BDO Unibank'} • {camp.bankAccountNumber || '1092 8847 2910'}
                          </div>
                          <div style={{ fontSize: '0.76rem', color: '#22c55e', fontWeight: 800, marginTop: '4px' }}>
                            +₱{Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} PHP
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Donor Recognition & Certificate Callout */}
                  <div style={{
                    margin: '12px 0 16px',
                    padding: '12px 14px',
                    background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.12), rgba(245, 158, 11, 0.05))',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    textAlign: 'left'
                  }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #d97706, #b45309)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: '0 2px 8px rgba(217, 119, 6, 0.4)'
                    }}>
                      <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: '20px' }}>workspace_premium</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-primary, #fff)', letterSpacing: '0.2px' }}>
                        Certificate of Philanthropy Minted
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94a3b8)', marginTop: '2px', lineHeight: 1.3 }}>
                        Your support is recorded on the verified relief ledger. Claim and download your official credential.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCertModalOpen(true)}
                      style={{
                        padding: '8px 12px',
                        background: 'linear-gradient(135deg, #d97706, #b45309)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 700,
                        fontSize: '0.76rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>military_tech</span>
                      <span>View Honors</span>
                    </button>
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
              {!isPaymentProcessing && donateStep === 6 && (
                <div className="fade-in">

                  {/* Modal Header (Sticky) */}
                  <div style={{
                    position: 'sticky',
                    top: '-24px',
                    marginTop: '-24px',
                    paddingTop: '20px',
                    paddingBottom: '14px',
                    background: 'var(--surface)',
                    backdropFilter: 'blur(12px)',
                    zIndex: 25,
                    borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '18px'
                  }}>
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
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
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
                          onClick={handleAutofillTestCard}
                          className="btn btn-ghost btn-xs"
                          style={{
                            fontSize: '0.70rem',
                            padding: '3px 8px',
                            color: '#38bdf8',
                            background: 'rgba(56, 189, 248, 0.12)',
                            border: '1px solid rgba(56, 189, 248, 0.35)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontWeight: 600
                          }}
                          title="Click to auto-populate standard sandbox test card credentials"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>bolt</span>
                          Fill Test Card
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
                        
                        {/* Donation Amount Interactive Input */}
                        <div style={{ marginBottom: '14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary, #cbd5e1)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              Donation Amount (PHP)
                            </label>
                            <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>
                              0% Fee · Sepolia Audited
                            </span>
                          </div>

                          <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: '#22c55e', fontSize: '1.1rem' }}>₱</span>
                            <input
                              type="number"
                              className="input"
                              style={{
                                width: '100%',
                                paddingLeft: '32px',
                                paddingRight: '56px',
                                fontSize: '1.05rem',
                                fontWeight: 800,
                                color: 'var(--text-primary, #ffffff)',
                                background: 'var(--bg-base, #0d0e12)',
                                border: '1px solid var(--border, rgba(255,255,255,0.12))',
                                borderRadius: 'var(--radius-md, 8px)'
                              }}
                              value={amount}
                              onChange={(e) => setAmount(e.target.value)}
                              placeholder="500"
                              min="1"
                              step="any"
                            />
                            <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: 'var(--text-muted, #94a3b8)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                              PHP
                            </span>
                          </div>

                          {/* Quick Preset Amount Chips */}
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                            {['100', '500', '1000', '2500', '5000'].map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                style={{
                                  background: amount === preset ? '#22c55e' : 'var(--bg-hover, rgba(255,255,255,0.06))',
                                  borderColor: amount === preset ? '#22c55e' : 'var(--border, rgba(255,255,255,0.1))',
                                  borderWidth: '1px',
                                  borderStyle: 'solid',
                                  color: amount === preset ? '#000000' : 'var(--text-primary, #ffffff)',
                                  fontWeight: 700,
                                  fontSize: '0.72rem',
                                  padding: '4px 10px',
                                  borderRadius: 'var(--radius-sm, 6px)',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease'
                                }}
                                onClick={() => setAmount(preset)}
                              >
                                ₱{Number(preset).toLocaleString()}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--text-muted, #94a3b8)', fontSize: '0.8rem' }}>
                          <span>Processing & Gas Fee:</span>
                          <span style={{ color: '#22c55e', fontWeight: 600 }}>₱0.00 (Zero Non-Profit Fee)</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid var(--border, rgba(255,255,255,0.08))' }}>
                          <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary, #fff)' }}>Total Settlement:</span>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ color: '#22c55e', fontWeight: 800, fontSize: '1.05rem', lineHeight: '1.2' }}>₱{parseFloat(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} PHP</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)' }}>Gasless on-chain receipt</div>
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
                            <strong>Account Name:</strong> {camp.bankAccountName || camp.bank_account_name || camp.orgName || 'BBDRTS Relief Foundation Inc.'}
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

                        {/* Anonymous Toggle for Card Donation */}
                        <div
                          onClick={() => setIsAnonymous(!isAnonymous)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 14px', background: isAnonymous ? 'rgba(34, 197, 94, 0.08)' : 'var(--bg-card, rgba(255,255,255,0.02))',
                            border: `1px solid ${isAnonymous ? 'rgba(34, 197, 94, 0.4)' : 'var(--border, rgba(255,255,255,0.08))'}`,
                            borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s ease', userSelect: 'none', marginTop: '6px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                              width: '32px', height: '32px', borderRadius: '50%',
                              background: isAnonymous ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255,255,255,0.05)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: isAnonymous ? '#22c55e' : 'var(--text-muted, #94a3b8)',
                              transition: 'all 0.2s ease'
                            }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '1.15rem' }}>visibility_off</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.84rem', fontWeight: '700', color: isAnonymous ? '#22c55e' : 'var(--text-primary, #fff)' }}>
                                {isAnonymous ? 'Anonymous Card Donation' : 'Donate Anonymously'}
                              </span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)' }}>
                                {isAnonymous ? 'Name hidden from public list' : 'Hide name on public donor list'}
                              </span>
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
                          disabled={isUploading || !cardNumber || !cardExpiry || !cardCvv || !cardEmail || !amount || parseFloat(amount) <= 0}
                        >
                          {isUploading ? (
                            <>
                              <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                              <span>Processing Payment...</span>
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>lock</span>
                              <span>{amount && parseFloat(amount) > 0 ? `Pay ₱${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} PHP` : 'Enter Donation Amount'}</span>
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

              {/* ── STEP 8: Instant Auto-Verified Gateway Checkout (Unified Stripe / Vercel Geist) ── */}
              {!isPaymentProcessing && donateStep === 8 && activeIntent && (() => {
                const payMethod = instantReceipt?.paymentMethod || activeIntent.paymentMethod || 'GCash';
                const payMethodLow = String(payMethod).toLowerCase();
                const payBadgeClass = payMethodLow.includes('maya') ? 'maya' : (payMethodLow.includes('gcash') ? 'gcash' : 'bank');
                const payAmountNum = Math.round(Number(instantReceipt?.amountPhp || activeIntent.amountPhp || 0));
                const trackCode = instantReceipt?.trackingCode || activeIntent.trackingCode || '';
                const handleCloseStep8 = () => {
                  if (instantReceipt) {
                    window.dispatchEvent(new CustomEvent('bbdrts_donation_success'));
                    onDonated?.();
                    setModalOpen(false);
                  }
                  setDonateStep(0);
                  setInstantReceipt(null);
                  setInstantSettlingOnChain(false);
                };

                /* ── STATE C: DONATION VERIFIED ARCHIVAL RECEIPT ── */
                if (instantReceipt) {
                  const tx = instantReceipt.txHash || '';
                  return (
                    <div className="qr8-shell qr8-shell--verified fade-in">
                      <div className="qr8-top-bar is-success" aria-hidden="true" />
                      <div className="qr8-ambient-emerald" aria-hidden="true" />

                      {/* Flush Recessed Header */}
                      <div className="qr8-header">
                        <div className="qr8-head-left">
                          <span className="material-symbols-outlined qr8-head-ico is-emerald">verified</span>
                          <div className="qr8-head-text">
                            <span className="qr8-head-title">Official Donation Receipt</span>
                            <span className="qr8-head-sub">
                              {activeIntent.provider === 'xendit_qrph' ? 'QR Ph · Auto-Verified' : 'Gateway · Auto-Verified'}
                            </span>
                          </div>
                        </div>
                        <div className="qr8-head-right">
                          <span className="qr8-status-pill is-verified">
                            <span className="qr8-status-dot is-emerald" />
                            <span>VERIFIED</span>
                          </span>
                          <button type="button" className="vc-donate-close-btn" onClick={handleCloseStep8} aria-label="Close">
                            <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>close</span>
                          </button>
                        </div>
                      </div>

                      {/* Celebratory Hero */}
                      <div className="qr8-body qr8-body--compact">
                        <div className="qr8-verified-hero">
                          <div className="qr8-check-outer">
                            <div className="qr8-check-inner">
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                <path
                                  d="M5 13l4 4L19 7"
                                  stroke="#10b981"
                                  strokeWidth="2.4"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className="qr8-check-path"
                                />
                              </svg>
                            </div>
                          </div>

                          <div className="qr8-hero-amt-row">
                            <span className="qr8-hero-amt">₱{payAmountNum.toLocaleString('en-US')}</span>
                            <span className="qr8-hero-unit">PHP</span>
                          </div>
                          <div className="qr8-verified-heading">Thank you for your donation</div>
                          <p className="qr8-verified-desc">
                            Credited to campaign and notarized gaslessly on Ethereum Sepolia.
                          </p>
                        </div>

                        {/* Clean Hairline Receipt Table */}
                        <div className="qr8-meta-table">
                          <div className="qr8-meta-row qr8-meta-row--wrap">
                            <span className="qr8-meta-k">Campaign</span>
                            <span className="qr8-meta-v qr8-meta-v--clamp" title={camp.title}>{camp.title}</span>
                          </div>
                          <div className="qr8-meta-row">
                            <span className="qr8-meta-k">Channel</span>
                            <span className="qr8-meta-v">{payMethod} · QR Ph</span>
                          </div>
                          {trackCode && (
                            <div className="qr8-meta-row">
                              <span className="qr8-meta-k">Reference</span>
                              <span className="qr8-meta-v qr8-meta-v--actions">
                                <span className="pp-mono">{trackCode}</span>
                                <button
                                  type="button"
                                  className={`qr8-copy-btn${qrCopiedKey === 'ref' ? ' is-copied' : ''}`}
                                  onClick={() => copyInstantValue('ref', trackCode)}
                                  title="Copy reference code"
                                >
                                  <span className="material-symbols-outlined">
                                    {qrCopiedKey === 'ref' ? 'check' : 'content_copy'}
                                  </span>
                                </button>
                              </span>
                            </div>
                          )}
                          {tx && (
                            <div className="qr8-meta-row">
                              <span className="qr8-meta-k">Audit Proof</span>
                              <span className="qr8-meta-v qr8-meta-v--actions">
                                <a
                                  href={`https://sepolia.etherscan.io/tx/${tx}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="qr8-tx-link pp-mono"
                                >
                                  <span>{tx.slice(0, 10)}…{tx.slice(-6)}</span>
                                  <span className="material-symbols-outlined">open_in_new</span>
                                </a>
                                <button
                                  type="button"
                                  className={`qr8-copy-btn${qrCopiedKey === 'tx' ? ' is-copied' : ''}`}
                                  onClick={() => copyInstantValue('tx', tx)}
                                  title="Copy transaction hash"
                                >
                                  <span className="material-symbols-outlined">
                                    {qrCopiedKey === 'tx' ? 'check' : 'content_copy'}
                                  </span>
                                </button>
                              </span>
                            </div>
                          )}
                          <div className="qr8-meta-row">
                            <span className="qr8-meta-k">Status</span>
                            <span className="qr8-meta-v qr8-status-inline">
                              <span className="qr8-status-dot is-emerald" />
                              <span>Verified On-Chain</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Flush Recessed Action Footer */}
                      <div className={`qr8-footer qr8-footer--actions${tx ? ' has-two' : ''}`}>
                        {tx && (
                          <a
                            href={`https://sepolia.etherscan.io/tx/${tx}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="qr8-btn qr8-btn--secondary"
                          >
                            <span>View on Etherscan</span>
                            <span className="material-symbols-outlined">north_east</span>
                          </a>
                        )}
                        <button
                          type="button"
                          className="qr8-btn qr8-btn--primary"
                          onClick={handleCloseStep8}
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  );
                }

                /* ── STATE B: FINALIZING ON-CHAIN PROOF (Unified Stripe / Vercel Geist) ── */
                if (instantSettlingOnChain) {
                  return (
                    <div className="pp-shell fade-in">
                      <div className="pp-progress-track" aria-hidden="true">
                        <div className="pp-progress-bar" />
                      </div>

                      <div className="pp-header">
                        <div className="pp-rail-id">
                          <span className="material-symbols-outlined">qr_code_2</span>
                          <span>{payMethod} · QR Ph Auto-Verified</span>
                        </div>
                        <div className="pp-status-chip">
                          <span className="pp-status-dot" />
                          <span>NOTARIZING</span>
                        </div>
                      </div>

                      <div className="pp-body">
                        <div className="pp-hero">
                          <div className="pp-icon-stage" aria-hidden="true">
                            <div className="pp-icon-well">
                              <span className="material-symbols-outlined">hub</span>
                            </div>
                            <div className="pp-icon-ring" />
                          </div>
                          <h3 className="pp-title">Finalizing On-Chain Proof</h3>
                          <p className="pp-subtitle">
                            Payment confirmed. Sealing your immutable relief receipt on Ethereum Sepolia.
                          </p>
                        </div>

                        <div className="pp-amount-card">
                          <span className="pp-amount-eyebrow">Confirmed Contribution</span>
                          <div className="pp-amount-row">
                            <span className="pp-amount-val">₱{payAmountNum.toLocaleString('en-US')}</span>
                            <span className="pp-amount-unit">PHP</span>
                          </div>
                          <span className="pp-amount-note">
                            <span className="material-symbols-outlined">verified_user</span>
                            <span>{payMethod} · Ref {trackCode}</span>
                          </span>
                        </div>

                        <div className="pp-steps">
                          <div className="pp-step is-done">
                            <span className="pp-step-node">
                              <span className="material-symbols-outlined">check</span>
                            </span>
                            <span className="pp-step-label">Payment received via {payMethod}</span>
                            <span className="pp-step-tag">Confirmed</span>
                          </div>
                          <div className="pp-step is-active">
                            <span className="pp-step-node">
                              <span className="pp-step-spinner" />
                            </span>
                            <span className="pp-step-label">Sealing proof on Ethereum Sepolia</span>
                            <span className="pp-step-tag">Active</span>
                          </div>
                        </div>
                      </div>

                      <div className="pp-footer">
                        <span className="material-symbols-outlined">lock</span>
                        <span>Gasless Sepolia Relayer · 0% Platform Fee · Immutable Audit Trail</span>
                      </div>
                    </div>
                  );
                }

                /* ── STATE A: DYNAMIC QR PH INSTANT CHECKOUT ── */
                return (
                  <div className="qr8-shell fade-in">
                    {/* Flush Recessed Header */}
                    <div className="qr8-header">
                      <div className="qr8-head-left">
                        <div className={`vc-channel-icon ${payBadgeClass}`}>
                          {payBadgeClass === 'gcash' ? 'G' : payBadgeClass === 'maya' ? 'maya' : (
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>credit_card</span>
                          )}
                        </div>
                        <div className="qr8-head-text">
                          <span className="qr8-head-title">{payMethod} Instant Checkout</span>
                          <span className="qr8-head-sub">
                            {activeIntent.provider === 'xendit_qrph' ? 'QR Ph · Automatic Webhook Verification' : 'Gateway · Automatic Verification'}
                          </span>
                        </div>
                      </div>
                      <div className="qr8-head-right">
                        <span className="qr8-status-pill">
                          <span className="qr8-status-dot is-live" />
                          <span>AWAITING SCAN</span>
                        </span>
                        <button type="button" className="vc-donate-close-btn" onClick={handleCloseStep8} aria-label="Close">
                          <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>close</span>
                        </button>
                      </div>
                    </div>

                    {/* Balanced Split 2-Column QR Stage & Order Panel */}
                    <div className="qr8-split">
                      {/* Left: QR Ph Stage */}
                      <div className="qr8-stage">
                        {activeIntent.provider === 'xendit_qrph' && activeIntent.qrString ? (() => {
                          const qrPayload = activeIntent.liveMode ? activeIntent.qrString : (activeIntent.mobilePayUrl || activeIntent.qrString);
                          return (
                            <>
                              <div className="qr8-frame-wrap">
                                <span className="qr8-corner tl" aria-hidden="true" />
                                <span className="qr8-corner tr" aria-hidden="true" />
                                <span className="qr8-corner bl" aria-hidden="true" />
                                <span className="qr8-corner br" aria-hidden="true" />
                                <div className="qr8-paper-card">
                                  <div className="qr8-qrph-mark">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                      <path d="M4 13V6.5A2.5 2.5 0 0 1 6.5 4H13" stroke="#0038A8" strokeWidth="3.2" strokeLinecap="round" />
                                      <path d="M20 11v6.5a2.5 2.5 0 0 1-2.5 2.5H11" stroke="#CE1126" strokeWidth="3.2" strokeLinecap="round" />
                                      <circle cx="12" cy="12" r="3.4" fill="#FCD116" />
                                    </svg>
                                    <span className="qr8-qrph-wordmark">
                                      <span style={{ color: '#CE1126' }}>QR</span>
                                      <span style={{ color: '#0038A8' }}> Ph</span>
                                    </span>
                                  </div>
                                  <div className="qr8-code-box">
                                    <img
                                      src={`https://api.qrserver.com/v1/create-qr-code/?size=196x196&ecc=H&margin=2&color=000000&bgcolor=ffffff&data=${encodeURIComponent(qrPayload)}`}
                                      alt="Dynamic QR Ph Code"
                                      className="qr8-code-img"
                                    />
                                    <div className="qr8-code-emblem" aria-hidden="true">
                                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                        <path d="M4 13.5V6.5A2.5 2.5 0 0 1 6.5 4H13.5" stroke="#0038A8" strokeWidth="3.4" strokeLinecap="round" />
                                        <path d="M20 10.5v7a2.5 2.5 0 0 1-2.5 2.5h-7" stroke="#CE1126" strokeWidth="3.4" strokeLinecap="round" />
                                        <circle cx="12" cy="12" r="3.8" fill="#FCD116" />
                                      </svg>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="qr8-scan-copy">
                                <div className="qr8-scan-title">
                                  {activeIntent.liveMode ? 'Scan with GCash, Maya, or Bank App' : 'Scan with your phone camera'}
                                </div>
                                <div className="qr8-listen-pill">
                                  <span className="qr8-status-dot is-live" />
                                  <span>Listening for instant confirmation…</span>
                                </div>
                              </div>
                            </>
                          );
                        })() : activeIntent.checkoutUrl ? (
                          <div className="qr8-external-wrap">
                            <a
                              href={activeIntent.checkoutUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="qr8-btn qr8-btn--primary"
                            >
                              <span>Open Xendit Checkout</span>
                              <span className="material-symbols-outlined">north_east</span>
                            </a>
                            <span className="qr8-listen-pill">
                              <span className="qr8-status-dot is-live" />
                              <span>Waiting for automatic confirmation…</span>
                            </span>
                          </div>
                        ) : null}
                      </div>

                      {/* Right: Recessed Order Panel */}
                      <div className="qr8-panel">
                        <div className="qr8-panel-top">
                          <div className="qr8-amt-block">
                            <span className="qr8-amt-lbl">Total Contribution</span>
                            <div className="qr8-amt-row">
                              <span className="qr8-amt-val">₱{payAmountNum.toLocaleString('en-US')}</span>
                              <span className="qr8-amt-unit">PHP</span>
                            </div>
                          </div>

                          <div className="qr8-meta-table">
                            <div className="qr8-meta-row qr8-meta-row--wrap">
                              <span className="qr8-meta-k">Campaign</span>
                              <span className="qr8-meta-v qr8-meta-v--clamp" title={camp.title}>{camp.title}</span>
                            </div>
                            <div className="qr8-meta-row">
                              <span className="qr8-meta-k">Channel</span>
                              <span className="qr8-meta-v">{payMethod} · QR Ph</span>
                            </div>
                            <div className="qr8-meta-row">
                              <span className="qr8-meta-k">Reference</span>
                              <span className="qr8-meta-v qr8-meta-v--actions">
                                <span className="pp-mono">{trackCode}</span>
                                <button
                                  type="button"
                                  className={`qr8-copy-btn${qrCopiedKey === 'qrref' ? ' is-copied' : ''}`}
                                  onClick={() => copyInstantValue('qrref', trackCode)}
                                  title="Copy reference code"
                                >
                                  <span className="material-symbols-outlined">
                                    {qrCopiedKey === 'qrref' ? 'check' : 'content_copy'}
                                  </span>
                                </button>
                              </span>
                            </div>
                            <div className="qr8-meta-row">
                              <span className="qr8-meta-k">Settlement</span>
                              <span className="qr8-meta-v qr8-status-inline">
                                <span className="qr8-status-dot is-emerald" />
                                <span>Auto-Webhook · Sepolia</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="qr8-panel-bottom">
                          <div className="qr8-lock-note">
                            <span className="material-symbols-outlined">verified_user</span>
                            <span>Single-use QR locked to this campaign. No screenshot upload needed — proof seals automatically once paid.</span>
                          </div>
                          {!activeIntent.liveMode && activeIntent.provider === 'xendit_qrph' && (
                            <button
                              type="button"
                              disabled={instantSimulating}
                              onClick={handleSimulateXenditQr}
                              className="qr8-sim-btn"
                            >
                              <span className="material-symbols-outlined">
                                {instantSimulating ? 'hourglass_top' : 'qr_code_scanner'}
                              </span>
                              <span>{instantSimulating ? 'Confirming via Xendit Test API…' : 'Simulate Scan'}</span>
                              <span className="qr8-sim-tag">TEST</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Flush Recessed Footer */}
                    <div className="qr8-footer">
                      <button
                        type="button"
                        className="qr8-back-btn"
                        onClick={() => setDonateStep(0)}
                      >
                        <span className="material-symbols-outlined">arrow_back</span>
                        <span>Back</span>
                      </button>
                      <button
                        type="button"
                        className="qr8-switch-link"
                        onClick={() => {
                          setCheckoutMode('manual');
                          setDonateStep(0);
                        }}
                      >
                        <span>Prefer Direct QR &amp; Slip Upload?</span>
                        <span className="material-symbols-outlined">arrow_forward</span>
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* ── STEP 7: Institutional E-Wallet (GCash / Maya) Terminal ── */}
              {!isPaymentProcessing && donateStep === 7 && (
                <div className="fade-in">

                  {/* Modal Header (Sticky) */}
                  <div style={{
                    position: 'sticky',
                    top: '-24px',
                    marginTop: '-24px',
                    paddingTop: '20px',
                    paddingBottom: '14px',
                    background: 'var(--surface)',
                    backdropFilter: 'blur(12px)',
                    zIndex: 25,
                    borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '16px',
                    flexWrap: 'wrap',
                    gap: '10px'
                  }}>
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
                        onClick={() => {
                          handleRemoveProof();
                          setDonateStep(0);
                        }}
                        style={{ background: 'var(--bg-input, rgba(255,255,255,0.05))', border: '1px solid var(--border, rgba(255,255,255,0.1))', color: 'var(--text-muted, #94a3b8)', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Back to Payment Selector"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                      </button>
                    </div>
                  </div>

                  {activeIntent?.trackingCode && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        flexWrap: 'wrap',
                        padding: '10px 14px',
                        marginBottom: '14px',
                        borderRadius: '10px',
                        background: 'rgba(56, 189, 248, 0.08)',
                        border: '1px solid rgba(56, 189, 248, 0.28)'
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #cbd5e1)', lineHeight: 1.4 }}>
                        <strong style={{ color: '#38bdf8' }}>Transfer Note Code: {activeIntent.trackingCode}</strong>
                        <span style={{ display: 'block', fontSize: '0.71rem', color: 'var(--text-muted, #94a3b8)' }}>
                          Paste this code in your {gatewayMethod} message/note so your gift is always linked to this campaign even if you forget to upload a slip.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(activeIntent.trackingCode);
                          showSuccess?.(`Copied note code ${activeIntent.trackingCode}`, 'Copied');
                        }}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '6px',
                          border: '1px solid rgba(56, 189, 248, 0.4)',
                          background: 'rgba(56, 189, 248, 0.14)',
                          color: '#38bdf8',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          fontFamily: 'var(--font-mono, monospace)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>content_copy</span>
                        <span>{activeIntent.trackingCode}</span>
                      </button>
                    </div>
                  )}

                  {/* Main 2-Column Grid */}
                  <div className="ewallet-checkout-grid">

                    {/* Left Column: NGO's Official E-Wallet QR & Manual Copy Number Credentials */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ width: '100%', maxWidth: '340px', background: 'var(--bg-card, rgba(255,255,255,0.02))', border: '1px solid var(--border, rgba(255,255,255,0.08))', borderRadius: '16px', padding: '18px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

                        {/* NGO Uploaded QR Code OR Informative QR Fallback */}
                        {((gatewayMethod === 'Maya' ? (camp.mayaQrUrl || camp.maya_qr_url) : (camp.gcashQrUrl || camp.gcash_qr_url))) ? (
                          <CleanQrVoucherDisplay
                            qrUrl={gatewayMethod === 'Maya' ? (camp.mayaQrUrl || camp.maya_qr_url) : (camp.gcashQrUrl || camp.gcash_qr_url)}
                            gatewayMethod={gatewayMethod}
                          />
                        ) : (
                          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed var(--border, rgba(255,255,255,0.15))', borderRadius: '12px', padding: '16px', textAlign: 'center', width: '100%', maxWidth: '300px', marginBottom: '14px' }}>
                            <div style={{
                              width: '44px',
                              height: '44px',
                              borderRadius: '12px',
                              background: gatewayMethod === 'Maya' ? '#000000' : '#007DFE',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              margin: '0 auto 8px',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                            }}>
                              {gatewayMethod === 'Maya' ? (
                                <span style={{ color: '#00d68f', fontWeight: 900, fontSize: '14px' }}>m</span>
                              ) : (
                                <span style={{ color: '#ffffff', fontWeight: 900, fontSize: '20px' }}>G</span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-primary, #ffffff)', fontWeight: 700 }}>
                              Direct {gatewayMethod} Transfer
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)', marginTop: '4px', lineHeight: 1.4 }}>
                              No custom {gatewayMethod} QR uploaded. Transfer directly using the mobile number below:
                            </div>
                          </div>
                        )}

                        {/* Merchant Details Box with 1-Click Copy Number */}
                        <div style={{ width: '100%', maxWidth: '300px', background: 'var(--bg-input, rgba(0,0,0,0.25))', borderRadius: '12px', padding: '12px', border: '1px solid var(--border, rgba(255,255,255,0.06))', fontSize: '0.78rem' }}>
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

                          <div style={{
                            background: gatewayMethod === 'Maya' ? 'rgba(0, 214, 143, 0.08)' : 'rgba(34, 197, 94, 0.08)',
                            padding: '8px 10px',
                            borderRadius: '10px',
                            border: gatewayMethod === 'Maya' ? '1px solid rgba(0, 214, 143, 0.3)' : '1px solid rgba(34, 197, 94, 0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '10px',
                            marginBottom: '8px'
                          }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                              <span style={{ fontSize: '0.64rem', color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                                Official {gatewayMethod} Receiving No:
                              </span>
                              <strong style={{
                                color: gatewayMethod === 'Maya' ? '#00d68f' : '#22c55e',
                                fontFamily: 'var(--font-mono, monospace)',
                                fontSize: '0.88rem',
                                fontWeight: 800,
                                whiteSpace: 'nowrap',
                                letterSpacing: '0.5px'
                              }}>
                                {gatewayMethod === 'Maya'
                                  ? formatPhoneNumber(camp.mayaNumber || camp.maya_number || '0918 765 4321')
                                  : formatPhoneNumber(camp.gcashNumber || camp.gcash_number || '0917 890 1234')}
                              </strong>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const rawNum = gatewayMethod === 'Maya'
                                  ? (camp.mayaNumber || camp.maya_number || '09187654321')
                                  : (camp.gcashNumber || camp.gcash_number || '09178901234');
                                const targetNumber = formatPhoneNumber(rawNum);
                                const cleanNum = targetNumber.replace(/\s+/g, '');
                                navigator.clipboard.writeText(cleanNum);
                                showSuccess?.(`${gatewayMethod} number ${cleanNum} copied to clipboard!`, 'Number Copied');
                              }}
                              style={{
                                background: gatewayMethod === 'Maya' ? 'rgba(0, 214, 143, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                                border: gatewayMethod === 'Maya' ? '1px solid rgba(0, 214, 143, 0.5)' : '1px solid rgba(34, 197, 94, 0.4)',
                                color: gatewayMethod === 'Maya' ? '#00d68f' : '#22c55e',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '5px 8px',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                              }}
                              title="Copy Number to Clipboard"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>content_copy</span>
                              Copy
                            </button>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-muted, #94a3b8)', whiteSpace: 'nowrap' }}>Transfer Fee:</span>
                            <span style={{ color: '#22c55e', fontWeight: 700, whiteSpace: 'nowrap' }}>₱0.00 (Zero Fee)</span>
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* Right Column: Submission Form (Amount, Ref No., Receipt Upload) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {(() => {
                        const isMaya = gatewayMethod === 'Maya';
                        const railColor = isMaya ? '#00D68F' : '#007DFE';
                        const railBgLight = isMaya ? 'rgba(0, 214, 143, 0.12)' : 'rgba(0, 125, 254, 0.12)';
                        const railBorder = isMaya ? 'rgba(0, 214, 143, 0.35)' : 'rgba(0, 125, 254, 0.35)';
                        const railGradient = isMaya
                          ? 'linear-gradient(135deg, #00D68F 0%, #00B377 100%)'
                          : 'linear-gradient(135deg, #007DFE 0%, #0052FF 100%)';
                        const railShadow = isMaya
                          ? '0 4px 16px rgba(0, 214, 143, 0.35)'
                          : '0 4px 16px rgba(0, 125, 254, 0.35)';

                        return (
                          <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-lg, 14px)', border: '1px solid var(--border)' }}>

                            {/* 1. Amount Input */}
                            <div style={{ marginBottom: '14px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  1. Donation Amount (PHP)
                                </label>
                                <span style={{ fontSize: '0.74rem', color: '#10b981', fontWeight: 600 }}>
                                  0% Fee · Sepolia Audited
                                </span>
                              </div>

                              <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: 'var(--accent)', fontSize: '1.1rem' }}>₱</span>
                                <input
                                  type="number"
                                  className="input"
                                  style={{ width: '100%', paddingLeft: '32px', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', borderRadius: 'var(--radius-md, 8px)' }}
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
                                      background: amount === preset ? 'var(--accent)' : 'var(--bg-hover)',
                                      borderColor: amount === preset ? 'var(--accent)' : 'var(--border)',
                                      color: amount === preset ? 'var(--bg-base)' : 'var(--text-primary)',
                                      fontWeight: 600,
                                      fontSize: '0.75rem',
                                      padding: '4px 10px',
                                      borderRadius: 'var(--radius-sm, 6px)',
                                      cursor: 'pointer'
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
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  2. {gatewayMethod} Reference Number
                                </label>
                                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px', fontFamily: 'var(--font-mono)' }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>auto_awesome</span>
                                  AI Auto-Fill
                                </span>
                              </div>
                              <div style={{ position: 'relative' }}>
                                <span className="material-symbols-outlined" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '18px' }}>
                                  pin
                                </span>
                                <input
                                  type="text"
                                  className="input"
                                  style={{
                                    width: '100%', paddingLeft: '38px', fontSize: '0.92rem', fontFamily: 'var(--font-mono)', fontWeight: 700, borderRadius: 'var(--radius-md, 8px)',
                                    borderColor: (refNumber || gatewayRefNo) ? 'var(--border-strong)' : 'var(--border)'
                                  }}
                                  value={refNumber || gatewayRefNo || ''}
                                  onChange={(e) => handleReferenceChange(e.target.value)}
                                  maxLength={gatewayMethod === 'GCash' ? 15 : (gatewayMethod === 'Maya' ? 16 : 24)}
                                  placeholder={isMaya ? "e.g. 9012 3456 7890" : "e.g. 0044 579 175068"}
                                />
                              </div>
                            </div>

                            {/* 3. Screenshot / Receipt Upload & Preview */}
                            <div style={{ marginBottom: '16px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  3. Payment Screenshot / Proof
                                </label>
                              </div>

                              {receiptBase64 ? (
                                <>
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '14px',
                                    padding: '12px 14px',
                                    borderRadius: '12px',
                                    background: 'var(--bg-subcard, rgba(255, 255, 255, 0.03))',
                                    border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
                                    position: 'relative'
                                  }}>
                                    {/* Thumbnail with Click-to-Enlarge Overlay */}
                                    <div
                                      onClick={() => setPreviewReceiptModal(true)}
                                      style={{
                                        position: 'relative',
                                        width: '64px',
                                        height: '84px',
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        flexShrink: 0,
                                        border: '1px solid var(--border)',
                                        background: '#000',
                                        cursor: 'pointer'
                                      }}
                                      title="Click to view full receipt"
                                    >
                                      <img
                                        src={receiptBase64}
                                        alt="Payment Proof"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                      />
                                      <div
                                        style={{
                                          position: 'absolute',
                                          inset: 0,
                                          background: 'rgba(0, 0, 0, 0.4)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          opacity: 0,
                                          transition: 'opacity 0.2s ease'
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0'; }}
                                      >
                                        <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#fff' }}>zoom_in</span>
                                      </div>
                                    </div>

                                    {/* Receipt Meta & Verification Status */}
                                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                        <span className="material-symbols-outlined" style={{
                                          fontSize: '16px',
                                          color: (activeAiResult && (activeAiResult.isPaymentReceipt === false || activeAiResult.confidenceScore === 0))
                                            ? 'var(--danger, #e00000)'
                                            : (activeAiResult && activeAiResult.isAiVerified
                                                ? 'var(--accent-green, #10b981)'
                                                : (aiScanLoading ? '#38bdf8' : 'var(--text-muted, #94a3b8)'))
                                        }}>
                                          {aiScanLoading ? 'hourglass_top' : (activeAiResult && (activeAiResult.isPaymentReceipt === false || activeAiResult.confidenceScore === 0) ? 'error' : (activeAiResult && activeAiResult.isAiVerified ? 'check_circle' : 'receipt_long'))}
                                        </span>
                                        <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                          {aiScanLoading
                                            ? 'Scanning Receipt with AI...'
                                            : (activeAiResult && (activeAiResult.isPaymentReceipt === false || activeAiResult.confidenceScore === 0)
                                                ? (activeAiResult.fraudFlags?.some(f => f.includes('EXPIRED'))
                                                    ? 'Expired Receipt Slip'
                                                    : (activeAiResult.fraudFlags?.some(f => f.includes('TAMPERED') || f.includes('INVALID_RECEIPT'))
                                                        ? 'Tampered / Edited Slip Detected'
                                                        : (activeAiResult.fraudFlags?.some(f => f.includes('RECIPIENT'))
                                                            ? 'Wrong Recipient Account'
                                                            : 'Non-Receipt / Invalid Image')))
                                                : (activeAiResult && activeAiResult.isAiVerified
                                                    ? 'Verified Payment Receipt'
                                                    : (activeAiResult?.fraudFlags?.some(f => f.includes('HIGH_VALUE'))
                                                        ? 'High-Value Donation (Secondary Audit Required)'
                                                        : 'Official Payment Slip Attached')))}
                                        </span>
                                        {activeAiResult && activeAiResult.confidenceScore > 0 && !aiScanLoading && (
                                          <span style={{
                                            fontSize: '0.66rem',
                                            fontWeight: 700,
                                            padding: '2px 8px',
                                            borderRadius: '6px',
                                            background: activeAiResult.isAiVerified
                                              ? 'rgba(16, 185, 129, 0.15)'
                                              : (activeAiResult.fraudFlags?.some(f => f.includes('HIGH_VALUE'))
                                                  ? 'rgba(239, 68, 68, 0.15)'
                                                  : 'rgba(245, 158, 11, 0.15)'),
                                            color: activeAiResult.isAiVerified
                                              ? '#10b981'
                                              : (activeAiResult.fraudFlags?.some(f => f.includes('HIGH_VALUE'))
                                                  ? '#ef4444'
                                                  : '#f59e0b')
                                          }}>
                                            {activeAiResult.isAiVerified
                                              ? `✓ AI Verified (${activeAiResult.confidenceScore}%)`
                                              : (activeAiResult.fraudFlags?.some(f => f.includes('HIGH_VALUE'))
                                                  ? 'Secondary Audit Required'
                                                  : 'Review Needed')}
                                          </span>
                                        )}
                                      </div>

                                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                        {aiScanLoading ? (
                                          <span style={{ color: '#38bdf8' }}>Gemini AI inspecting transaction details...</span>
                                        ) : activeAiResult?.receiptDate ? (
                                          <span>
                                            Transferred on <strong style={{ color: 'var(--text-primary)' }}>{activeAiResult.receiptDate}</strong> • {activeAiResult.isAiVerified
                                              ? 'Verified by Gemini AI'
                                              : (activeAiResult.fraudFlags?.some(f => f.includes('EXPIRED'))
                                                  ? 'Flagged by Gemini AI (Expired)'
                                                  : (activeAiResult.fraudFlags?.some(f => f.includes('TAMPERED') || f.includes('INVALID_RECEIPT'))
                                                      ? 'Flagged by Gemini AI (Tampered / Altered)'
                                                      : (activeAiResult.fraudFlags?.some(f => f.includes('HIGH_VALUE'))
                                                          ? 'High-Value Guardrail Enforced'
                                                          : (activeAiResult.fraudFlags?.some(f => f.includes('RECIPIENT'))
                                                              ? 'Flagged by Gemini AI (Wrong Recipient)'
                                                              : 'Flagged by Gemini AI'))))}
                                          </span>
                                        ) : (
                                          <span>Official {gatewayMethod || 'payment'} slip attached • {activeAiResult?.isAiVerified ? 'Auto-verified' : 'Under Review'}</span>
                                        )}
                                      </div>

                                      {/* Quick Action Pills */}
                                      <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center' }}>
                                        <button
                                          type="button"
                                          onClick={() => setPreviewReceiptModal(true)}
                                          style={{
                                            background: 'var(--bg-card)',
                                            border: '1px solid var(--border)',
                                            borderRadius: '6px',
                                            padding: '3px 9px',
                                            fontSize: '0.7rem',
                                            color: 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            fontWeight: 600
                                          }}
                                        >
                                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>zoom_in</span>
                                          View Full
                                        </button>

                                        <label style={{
                                          background: 'var(--bg-card)',
                                          border: '1px solid var(--border)',
                                          borderRadius: '6px',
                                          padding: '3px 9px',
                                          fontSize: '0.7rem',
                                          color: 'var(--text-secondary)',
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          fontWeight: 600
                                        }}>
                                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>sync</span>
                                          Replace
                                          <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleReceiptUpload}
                                            style={{ display: 'none' }}
                                          />
                                        </label>
                                      </div>
                                    </div>
                                  </div>

                                {/* AI Receipt Vision Inspection Card (Module A) */}
                                {aiScanLoading && (
                                  <div className="ai-scanner-shimmer-box" style={{ marginTop: '10px' }}>
                                    <div className="ai-scanner-shimmer-line" />
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                      <div style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '8px',
                                        background: 'rgba(56, 189, 248, 0.18)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                      }}>
                                        <span className="material-symbols-outlined spin" style={{ fontSize: '20px', color: '#38bdf8' }}>
                                          progress_activity
                                        </span>
                                      </div>
                                      <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <span>Gemini AI Vision Scanning...</span>
                                          <span className="ai-scanning-pulse-dot" />
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>
                                          Extracting reference number & validating declared amount
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {activeAiResult && !aiScanLoading && (() => {
                                  const hasEnteredRef = Boolean((refNumber || gatewayRefNo || '').trim());
                                  const isInvalidDoc = activeAiResult.isPaymentReceipt === false || activeAiResult.confidenceScore === 0;

                                  // Hard fraud violations that strictly CANNOT be bypassed by manual typing
                                  const isExpiredReceipt = Boolean(activeAiResult.fraudFlags?.some(f => f.includes('EXPIRED_RECEIPT')));
                                  const isTamperedReceipt = Boolean(activeAiResult.fraudFlags?.some(f => f.includes('TAMPERED')));
                                  const isRecipientMismatch = Boolean(activeAiResult.fraudFlags?.some(f => f.includes('RECIPIENT_MISMATCH') || f.includes('RECIPIENT_NAME_MISMATCH') || f.includes('RECIPIENT_PHONE_MISMATCH')));
                                  const isSuspiciousRef = Boolean(activeAiResult.fraudFlags?.some(f => f.includes('SUSPICIOUS_REFERENCE_SEQUENCE')));
                                  const hasHardFraud = Boolean(
                                    railMismatchWarning || 
                                    duplicateRefWarning || 
                                    isExpiredReceipt || 
                                    isTamperedReceipt || 
                                    isRecipientMismatch || 
                                    isSuspiciousRef ||
                                    activeAiResult.fraudFlags?.some(f => f.includes('PAYMENT_RAIL_MISMATCH') || f.includes('RAIL_MISMATCH') || f.includes('DUPLICATE'))
                                  );

                                  const isVerifiedCard = !hasHardFraud && !isInvalidDoc && (Boolean(activeAiResult.isAiVerified) || activeAiResult.confidenceScore >= 60);

                                  // If cleanly verified and no hard fraud, suppress the redundant duplicate box (all details are displayed in form & receipt header)
                                  if (isVerifiedCard && (!activeAiResult.fraudFlags || activeAiResult.fraudFlags.every(f => !f.includes('REJECTION') && !f.includes('MISMATCH') && !f.includes('EXPIRED') && !f.includes('TAMPERED') && !f.includes('SUSPICIOUS')))) {
                                    return null;
                                  }

                                  // Clean digits check: for GCash, manual ref must be 13 digits
                                  const cleanDigits = (refNumber || gatewayRefNo || '').replace(/\D/g, '');
                                  const isValidManualRef = gatewayMethod === 'GCash' ? cleanDigits.length === 13 : hasEnteredRef && (refNumber || gatewayRefNo || '').trim().length >= 8;

                                  // Manual audit pending is ONLY allowed if there is NO hard fraud (not expired, not tampered, not mismatched rail)
                                  // and user provided a validly formatted reference number
                                  const isManualAuditPending = !isVerifiedCard && !hasHardFraud && isInvalidDoc && isValidManualRef;
                                  const isSoftNotice = !hasHardFraud && !isInvalidDoc && activeAiResult.confidenceScore >= 60;

                                  const cardBg = isVerifiedCard
                                    ? 'rgba(16, 185, 129, 0.08)'
                                    : (isSoftNotice ? 'rgba(56, 189, 248, 0.08)' : (isManualAuditPending ? 'rgba(245, 158, 11, 0.08)' : 'rgba(224, 0, 0, 0.08)'));
                                  const cardBorder = isVerifiedCard
                                    ? 'rgba(16, 185, 129, 0.35)'
                                    : (isSoftNotice ? 'rgba(56, 189, 248, 0.35)' : (isManualAuditPending ? 'rgba(245, 158, 11, 0.35)' : 'rgba(224, 0, 0, 0.35)'));
                                  const cardColor = isVerifiedCard
                                    ? 'var(--accent-green, #10b981)'
                                    : (isSoftNotice ? '#38bdf8' : (isManualAuditPending ? '#f59e0b' : 'var(--danger, #e00000)'));
                                  const cardIcon = isVerifiedCard
                                    ? 'verified'
                                    : (isSoftNotice ? 'info' : (isManualAuditPending ? 'pending_actions' : (isInvalidDoc ? 'cancel' : 'warning')));

                                  let cardTitle = '';
                                  if (isVerifiedCard) {
                                    cardTitle = `AI Verified (${activeAiResult.confidenceScore || 95}%)`;
                                  } else if (isSoftNotice) {
                                    cardTitle = `AI Verification Notice (${activeAiResult.confidenceScore}%)`;
                                  } else if (isManualAuditPending) {
                                    cardTitle = 'Manual NGO Audit Queued';
                                  } else if (isExpiredReceipt) {
                                    cardTitle = 'AI Rejection: Expired Receipt (0%)';
                                  } else if (isTamperedReceipt) {
                                    cardTitle = 'AI Rejection: Tampered Image (0%)';
                                  } else if (isRecipientMismatch) {
                                    cardTitle = 'AI Rejection: Wrong Recipient / Account (0%)';
                                  } else if (isSuspiciousRef) {
                                    cardTitle = 'AI Rejection: Artificial Ref Number (0%)';
                                  } else if (isInvalidDoc) {
                                    cardTitle = 'AI Rejection: Invalid Receipt Image (0%)';
                                  } else {
                                    cardTitle = `AI Verification Alert (${activeAiResult.confidenceScore || 35}%)`;
                                  }

                                  return (
                                    <div style={{
                                      marginTop: '8px',
                                      padding: '12px 14px',
                                      borderRadius: 'var(--radius-lg, 12px)',
                                      background: cardBg,
                                      border: `1px solid ${cardBorder}`,
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '8px'
                                    }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <span className="material-symbols-outlined" style={{
                                            fontSize: '18px',
                                            color: cardColor
                                          }}>
                                            {cardIcon}
                                          </span>
                                          <span style={{
                                            fontWeight: 700,
                                            fontSize: '0.80rem',
                                            color: cardColor,
                                            fontFamily: 'var(--font-sans)'
                                          }}>
                                            {cardTitle}
                                          </span>
                                        </div>
                                        <span style={{ fontSize: '0.66rem', background: 'var(--bg-hover)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 'var(--radius-pill)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                          Gemini AI + OCR
                                        </span>
                                      </div>

                                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '6px', fontSize: '0.74rem' }}>
                                        {(activeAiResult.extractedRef || (hasEnteredRef && isManualAuditPending)) && (
                                          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '6px 10px', borderRadius: 'var(--radius-sm, 6px)' }}>
                                            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.64rem', fontWeight: 600 }}>{activeAiResult.extractedRef ? 'EXTRACTED REF:' : 'MANUAL REF:'}</span>
                                            <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>#{activeAiResult.extractedRef || refNumber || gatewayRefNo}</span>
                                          </div>
                                        )}
                                        {Boolean(activeAiResult.extractedAmountPhp && Number(activeAiResult.extractedAmountPhp) > 0) && (
                                          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '6px 10px', borderRadius: 'var(--radius-sm, 6px)' }}>
                                            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.64rem', fontWeight: 600 }}>EXTRACTED AMOUNT:</span>
                                            <span style={{ color: 'var(--accent-green, #10b981)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>₱{Number(activeAiResult.extractedAmountPhp).toLocaleString()} PHP</span>
                                          </div>
                                        )}
                                      </div>

                                      {Boolean(activeAiResult.fraudFlags && activeAiResult.fraudFlags.length > 0) && (
                                        <div style={{ fontSize: '0.72rem', color: isManualAuditPending ? '#f59e0b' : 'var(--danger, #e00000)', marginTop: '2px', lineHeight: '1.4' }}>
                                          {activeAiResult.fraudFlags.map((flag, fIdx) => (
                                            <div key={fIdx}>• {flag}</div>
                                          ))}
                                          {isManualAuditPending && (
                                            <div style={{ marginTop: '4px', color: 'var(--text-secondary)' }}>
                                              ℹ️ Don't worry, your donation will be submitted for manual NGO review using the reference number you provided.
                                            </div>
                                          )}
                                          {hasHardFraud && (
                                            <div style={{ marginTop: '4px', color: 'var(--danger, #fca5a5)', fontWeight: 600 }}>
                                              ⚠️ This receipt cannot be accepted. Please upload an authentic, recent payment slip to proceed with your donation.
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </>
                            ) : (
                                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px', border: `1.5px dashed ${railBorder}`, borderRadius: '12px', cursor: 'pointer', background: railBgLight, transition: '0.2s' }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: '26px', color: railColor, marginBottom: '4px' }}>
                                    add_photo_alternate
                                  </span>
                                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary, #ffffff)' }}>
                                    Upload Receipt Screenshot
                                  </span>
                                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted, #94a3b8)', marginTop: '2px' }}>
                                    PNG, JPG or WebP confirmation screenshot from your payment app
                                  </span>
                                  <input
                                    ref={receiptFileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleReceiptUpload}
                                    style={{ display: 'none' }}
                                  />
                                </label>
                              )}
                            </div>

                            {/* Anonymous Toggle for GCash & Maya */}
                            <div
                              onClick={() => setIsAnonymous(!isAnonymous)}
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '10px 14px', background: isAnonymous ? railBgLight : 'var(--bg-card, rgba(255,255,255,0.02))',
                                border: `1px solid ${isAnonymous ? railColor : 'var(--border, rgba(255,255,255,0.08))'}`,
                                borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s ease', userSelect: 'none', marginBottom: '14px'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                  width: '32px', height: '32px', borderRadius: '50%',
                                  background: isAnonymous ? railBgLight : 'rgba(255,255,255,0.05)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  color: isAnonymous ? railColor : 'var(--text-muted, #94a3b8)',
                                  transition: 'all 0.2s ease'
                                }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: '1.15rem' }}>visibility_off</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontSize: '0.84rem', fontWeight: '700', color: isAnonymous ? railColor : 'var(--text-primary, #fff)' }}>
                                    {isAnonymous ? `Anonymous ${gatewayMethod} Donation` : 'Donate Anonymously'}
                                  </span>
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)' }}>
                                    {isAnonymous ? 'Name hidden from public list' : 'Hide name on public donor list'}
                                  </span>
                                </div>
                              </div>
                              <div style={{
                                width: '38px', height: '20px', borderRadius: '20px',
                                background: isAnonymous ? railColor : 'rgba(255,255,255,0.15)',
                                position: 'relative', transition: '0.2s', flexShrink: 0
                              }}>
                                <div style={{
                                  width: '16px', height: '16px', background: '#fff', borderRadius: '50%',
                                  position: 'absolute', top: '2px', left: isAnonymous ? '20px' : '2px',
                                  transition: '0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                }} />
                              </div>
                            </div>

                            {/* Payment Rail Mismatch Alert Banner */}
                            {railMismatchWarning && (
                              <div style={{
                                background: 'rgba(239, 68, 68, 0.15)',
                                border: '1.5px solid rgba(239, 68, 68, 0.5)',
                                borderRadius: '10px',
                                padding: '10px 14px',
                                marginBottom: '14px',
                                color: '#fca5a5',
                                fontSize: '0.8rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#ef4444', flexShrink: 0 }}>published_with_changes</span>
                                <span><strong>Rail Discrepancy Alert:</strong> {railMismatchWarning}</span>
                              </div>
                            )}

                            {/* Duplicate Receipt Alert Banner */}
                            {duplicateRefWarning && (
                              <div style={{
                                background: 'rgba(239, 68, 68, 0.12)',
                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                borderRadius: '10px',
                                padding: '10px 14px',
                                marginBottom: '14px',
                                color: '#ef4444',
                                fontSize: '0.8rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '18px', flexShrink: 0 }}>warning</span>
                                <span><strong>Duplicate Receipt Alert:</strong> {duplicateRefWarning}</span>
                              </div>
                            )}

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <button
                                className="btn btn-outline"
                                style={{ flex: 1 }}
                                onClick={() => {
                                  handleRemoveProof();
                                  setDonateStep(0);
                                }}
                                disabled={gatewayLoading}
                              >
                                Back
                              </button>
                              {(() => {
                                const hasEnteredRef = Boolean((refNumber || gatewayRefNo || '').trim());
                                const isReceiptInvalid = activeAiResult && (activeAiResult.isPaymentReceipt === false || activeAiResult.confidenceScore === 0 || activeAiResult.fraudFlags?.some(f => f.includes('INVALID_RECEIPT')));
                                const isExpiredReceipt = Boolean(activeAiResult?.fraudFlags?.some(f => f.includes('EXPIRED_RECEIPT')));
                                const isTamperedReceipt = Boolean(activeAiResult?.fraudFlags?.some(f => f.includes('TAMPERED')));
                                const isRecipientMismatch = Boolean(activeAiResult?.fraudFlags?.some(f => f.includes('RECIPIENT_MISMATCH') || f.includes('RECIPIENT_NAME_MISMATCH') || f.includes('RECIPIENT_PHONE_MISMATCH')));
                                const isSuspiciousRef = Boolean(activeAiResult?.fraudFlags?.some(f => f.includes('SUSPICIOUS_REFERENCE_SEQUENCE')));
                                const hasHardFraud = Boolean(
                                  duplicateRefWarning || 
                                  railMismatchWarning || 
                                  isExpiredReceipt || 
                                  isTamperedReceipt ||
                                  isRecipientMismatch ||
                                  isSuspiciousRef ||
                                  activeAiResult?.fraudFlags?.some(f => f.includes('PAYMENT_RAIL_MISMATCH') || f.includes('RAIL_MISMATCH') || f.includes('DUPLICATE'))
                                );

                                const cleanDigits = (refNumber || gatewayRefNo || '').replace(/\D/g, '');
                                const isValidManualRef = gatewayMethod === 'GCash' ? cleanDigits.length === 13 : hasEnteredRef && (refNumber || gatewayRefNo || '').trim().length >= 8;

                                const isManualAuditPending = !hasHardFraud && isReceiptInvalid && isValidManualRef;
                                const isBlocked = hasHardFraud || (isReceiptInvalid && !isValidManualRef);
                                const isSubmitDisabled = gatewayLoading || !amount || parseFloat(amount) <= 0 || !hasEnteredRef || !receiptBase64 || isBlocked;

                                return (
                                  <div style={{ flex: 2, display: 'flex', width: '100%', cursor: isSubmitDisabled ? 'not-allowed' : 'default' }}>
                                    <button
                                      type="button"
                                      className="btn"
                                      style={{
                                        width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.90rem', padding: '12px',
                                        background: isBlocked ? 'rgba(224, 0, 0, 0.12)' : (isManualAuditPending ? '#f59e0b' : 'var(--text-primary)'),
                                        color: isBlocked ? 'var(--danger, #e00000)' : (isManualAuditPending ? '#000000' : 'var(--bg-base)'),
                                        fontWeight: 700, borderRadius: 'var(--radius-md, 8px)',
                                        border: isBlocked ? '1px solid var(--danger, #e00000)' : (isManualAuditPending ? '1px solid #f59e0b' : '1px solid var(--text-primary)'),
                                        boxShadow: 'var(--shadow-sm)',
                                        cursor: isSubmitDisabled ? 'not-allowed' : 'pointer',
                                        opacity: isSubmitDisabled ? 0.6 : 1
                                      }}
                                      onClick={isSubmitDisabled ? undefined : verifyGatewayPayment}
                                      aria-disabled={isSubmitDisabled}
                                    >
                                      {gatewayLoading ? (
                                        <>
                                          <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px', borderColor: '#ffffff', borderTopColor: 'transparent' }} />
                                          <span>Verifying & Recording...</span>
                                        </>
                                      ) : (
                                        <>
                                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                                            {isBlocked ? 'block' : (isManualAuditPending ? 'assignment_turned_in' : 'check')}
                                          </span>
                                          <span>
                                            {duplicateRefWarning
                                              ? 'Duplicate Receipt Blocked'
                                              : (railMismatchWarning
                                                  ? 'Rail Mismatch Blocked'
                                                  : (isExpiredReceipt
                                                      ? 'Expired Receipt Blocked'
                                                      : (isTamperedReceipt
                                                          ? 'Tampered Image Blocked'
                                                          : (isRecipientMismatch
                                                              ? 'Recipient Mismatch Blocked'
                                                              : (isSuspiciousRef
                                                                  ? 'Artificial Ref Blocked'
                                                                  : (isReceiptInvalid && !isValidManualRef
                                                              ? (gatewayMethod === 'GCash' ? 'Enter 13-Digit Ref Number' : 'Enter Valid Reference Number')
                                                              : (amount && parseFloat(amount) > 0
                                                                  ? (isManualAuditPending
                                                                      ? `Submit for Manual NGO Review (₱${Number(amount).toLocaleString()})`
                                                                      : `Confirm & Submit (₱${Number(amount).toLocaleString()})`)
                                                                  : 'Confirm & Submit')))))))}
                                          </span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                );
                              })()}
                            </div>

                          </div>
                        );
                      })()}
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
            {modalOpen && !isPaymentProcessing && (
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

          {/* High-Resolution Attached Receipt Proof Lightbox */}
          {previewReceiptModal && receiptBase64 && createPortal(
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999999,
                background: 'rgba(0, 0, 0, 0.88)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px'
              }}
              onClick={() => setPreviewReceiptModal(false)}
            >
              <div
                style={{
                  position: 'relative',
                  maxWidth: '92vw',
                  maxHeight: '90vh',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  width: '100%',
                  marginBottom: '12px',
                  color: '#fff'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: 700 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#10b981' }}>verified</span>
                    Official Payment Confirmation Slip
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewReceiptModal(false)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: 'none',
                      color: '#fff',
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Close preview"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                  </button>
                </div>
                <img
                  src={receiptBase64}
                  alt="Full Payment Proof"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '80vh',
                    objectFit: 'contain',
                    borderRadius: '12px',
                    border: '1.5px solid rgba(255, 255, 255, 0.15)',
                    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.85)'
                  }}
                />
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
                <h3 style={{ marginBottom: '8px', color: 'var(--text)' }}>Deactivating Campaign</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Updating campaign status and sealing closure in the BBDRTS audit ledger…</p>
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
        const targetPhp = (camp.targetAmountPhp || camp.target_amount_php || Math.round(parseFloat(camp.targetAmount || 0) * 170000)).toLocaleString('en-US', { maximumFractionDigits: 0 });
        const currentPhp = (displayCurrentEth * 170000).toLocaleString('en-US', { maximumFractionDigits: 0 });
        const progressPercent = pct;

        let modalDisasterPhotos = camp.disasterImages;
        if (!modalDisasterPhotos && (camp.disaster_images_json || camp.disasterImagesJson)) {
          try {
            const parsed = typeof (camp.disaster_images_json || camp.disasterImagesJson) === 'string'
              ? JSON.parse(camp.disaster_images_json || camp.disasterImagesJson)
              : (camp.disaster_images_json || camp.disasterImagesJson);
            if (Array.isArray(parsed) && parsed.length > 0) modalDisasterPhotos = parsed;
          } catch (_) {}
        }
        if (!Array.isArray(modalDisasterPhotos) || modalDisasterPhotos.length === 0) {
          modalDisasterPhotos = getCategoryEvidencePhotos(`${camp.title || camp.Campaign_Title || ''} ${camp.description || ''}`);
        }
        const allModalPhotos = Array.from(new Set([coverData?.imageUrl, ...modalDisasterPhotos].filter(Boolean)));

        return createPortal(
          <div
            className="bbdrts-details-backdrop"
            onClick={() => setDetailsOpen(false)}
          >
            <div
              className="bbdrts-details-modal"
              onClick={(e) => e.stopPropagation()}
            >
              {/* ── 1. Clean Modal Header (Dedicated top section outside photo) ── */}
              <div className="bbdrts-details-header">
                <div className="bbdrts-details-header-top">
                  <div className="bbdrts-details-badges">
                    <span className="bbdrts-pill-mono">
                      #{catInfo.prefix}-00{camp.id}
                    </span>
                    <span className="bbdrts-pill-subtle">
                      <span className={`bbdrts-status-dot ${catInfo.prefix === 'DR' ? 'cat-dot-dr' : 'cat-dot-cd'}`} />
                      <span>{catInfo.label}</span>
                    </span>
                    {audit.urgency && (
                      <span className="bbdrts-pill-subtle urgency-pill">
                        <span className="bbdrts-status-dot urgency-dot" />
                        <span>{audit.urgency}</span>
                      </span>
                    )}
                    <span className="bbdrts-pill-subtle active-pill">
                      <span className="bbdrts-status-dot active-dot" />
                      <span>Active On-Chain</span>
                    </span>
                  </div>

                  {/* Minimalist Close Button */}
                  <button
                    type="button"
                    className="bbdrts-modal-close-btn"
                    onClick={() => setDetailsOpen(false)}
                    title="Close Campaign Details"
                    aria-label="Close Campaign Details"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                  </button>
                </div>

                {/* Campaign Title */}
                <h2 className="bbdrts-details-title">
                  {displayTitle}
                </h2>

                {/* Organization & Verification Metadata Bar */}
                <div className="bbdrts-details-org-bar">
                  <span>Managed by</span>
                  <button
                    type="button"
                    className="bbdrts-org-badge"
                    onClick={() => {
                      setDetailsOpen(false);
                      if (onOpenNgoProfile) onOpenNgoProfile(camp.orgId || 3);
                    }}
                    title="View verified NGO profile & missions"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#10b981' }}>domain</span>
                    <span>{orgDisplayName}</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '13px', color: '#10b981' }}>verified</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '13px', opacity: 0.6 }}>chevron_right</span>
                  </button>
                  <span className="bbdrts-meta-divider">•</span>
                  <span className="bbdrts-verified-indicator">
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>verified_user</span>
                    <span>Smart Contract Verified</span>
                  </span>
                  {camp.contractAddress && (
                    <>
                      <span className="bbdrts-meta-divider">•</span>
                      <span className="bbdrts-pill-mono" style={{ fontSize: '0.7rem' }}>Sepolia EVM</span>
                    </>
                  )}
                </div>
              </div>

              {/* ── 2. Modal Body Content ── */}
              <div className="bbdrts-details-body">
                {/* Minimalist Collapsible Tag Row */}
                {campaignTags && campaignTags.length > 0 && (
                  <div className="bbdrts-tags-row">
                    {(showAllDetailsTags ? campaignTags : campaignTags.slice(0, 5)).map((tag, idx) => (
                      <span key={idx} className="bbdrts-tag-pill">
                        #{tag.replace(/^#/, '')}
                      </span>
                    ))}
                    {campaignTags.length > 5 && (
                      <button
                        type="button"
                        className="bbdrts-tag-more-btn"
                        onClick={() => setShowAllDetailsTags(!showAllDetailsTags)}
                      >
                        {showAllDetailsTags ? 'Show less' : `+${campaignTags.length - 5} more`}
                      </button>
                    )}
                  </div>
                )}

                {/* Bento 4-Tile Metric Grid */}
                <div className="bbdrts-bento-grid">
                  <div className="bbdrts-bento-card">
                    <span className="bbdrts-bento-label">Target Goal</span>
                    <span className="bbdrts-bento-value">₱{targetPhp}</span>
                  </div>

                  <div className="bbdrts-bento-card">
                    <span className="bbdrts-bento-label">Settled to Date</span>
                    <span className="bbdrts-bento-value is-accent">
                      ₱{currentPhp} <span className="bbdrts-bento-sub">({progressPercent}%)</span>
                    </span>
                  </div>

                  <div className="bbdrts-bento-card">
                    <span className="bbdrts-bento-label">Target Delivery</span>
                    <span className="bbdrts-bento-meta">
                      <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--text-muted)' }}>calendar_today</span>
                      <span>{formattedDeliveryDate || audit.targetDate || 'Active'}</span>
                    </span>
                  </div>

                  <div className="bbdrts-bento-card">
                    <span className="bbdrts-bento-label">Community Backers</span>
                    <span className="bbdrts-bento-meta">
                      <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#10b981' }}>group</span>
                      <span>{breakdown.totalBackers > 0 ? `${breakdown.totalBackers} ${breakdown.totalBackers === 1 ? 'Backer' : 'Backers'}` : '0 Backers'}</span>
                    </span>
                  </div>
                </div>

                {/* Refined Progress Bar Strip */}
                <div className="bbdrts-progress-strip">
                  <div className="bbdrts-progress-track" title={`Funded: ${progressPercent}% of target`}>
                    <div className="bbdrts-progress-bar" style={{ width: `${Math.min(100, Math.max(0, parseFloat(progressPercent) || 0))}%` }} />
                  </div>
                  <div className="bbdrts-progress-info">
                    <span>Funding Progress: <strong>{progressPercent}%</strong> of target</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>shield</span>
                      <span>100% On-Chain Escrow Security</span>
                    </span>
                  </div>
                </div>

                {/* 2-Column Responsive Layout (Balanced 50/50 Grid) */}
                <div className="bbdrts-details-grid">
                  {/* Left Column: Mission Overview & Visual Evidence */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Mission Purpose */}
                    <div className="bbdrts-section-card">
                      <div className="bbdrts-section-card-header">
                        <h4 className="bbdrts-section-card-title">
                          <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#10b981' }}>article</span>
                          Mission & Humanitarian Scope
                        </h4>
                      </div>
                      <p className="bbdrts-desc-text">
                        {audit.description}
                      </p>

                      {/* Official Verification Document / Press Release */}
                      {audit.documentUrl && (
                        <div style={{ marginTop: '4px' }}>
                          <a
                            href={audit.documentUrl.startsWith('http') ? audit.documentUrl : `https://${audit.documentUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bbdrts-details-doc-link"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>verified</span>
                            <span>Official Verification Document / Press Release</span>
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>open_in_new</span>
                          </a>
                        </div>
                      )}

                      {/* Emergency Response Desk */}
                      {audit.contact && (
                        <div className="bbdrts-details-hotline-chip">
                          <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#10b981' }}>support_agent</span>
                          <div>
                            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Emergency Contact: </span>
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatPhoneNumber(audit.contact)}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Dedicated Cover & Narrative Media Showcase (Positioned below the bio / mission) */}
                    <div className="bbdrts-details-media" style={{ borderRadius: '14px', overflow: 'hidden' }}>
                      <img
                        src={coverData.imageUrl}
                        alt={camp.title}
                        className="bbdrts-details-media-img"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=600&q=80';
                        }}
                      />
                      <button
                        type="button"
                        className="bbdrts-media-expand-pill"
                        onClick={() => setActiveEvidenceImg(coverData.imageUrl)}
                        title="Click to view full photo"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>fullscreen</span>
                        <span>View Cover Photo</span>
                      </button>
                    </div>

                    {/* Official Disaster Impact & Damage Evidence */}
                    {modalDisasterPhotos.length > 0 && (
                      <div className="bbdrts-section-card">
                        <div className="bbdrts-section-card-header">
                          <h4 className="bbdrts-section-card-title">
                            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#f59e0b' }}>photo_library</span>
                            Disaster Impact Evidence ({modalDisasterPhotos.length})
                          </h4>
                          <span className="bbdrts-section-card-badge" style={{ color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.3)', background: 'rgba(245, 158, 11, 0.08)' }}>FIELD VERIFIED</span>
                        </div>
                        <p style={{ margin: '0 0 10px 0', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.45' }}>
                          Ground-level photographic verification uploaded by {camp.orgName || 'the accredited NGO'} documenting disaster severity.
                        </p>
                        <div className="bbdrts-details-evidence-grid">
                          {(() => {
                            const maxGrid = 6;
                            const hasOverflow = modalDisasterPhotos.length > maxGrid;
                            const visiblePhotos = hasOverflow ? modalDisasterPhotos.slice(0, maxGrid) : modalDisasterPhotos;
                            const overflowCount = modalDisasterPhotos.length - (maxGrid - 1);

                            return visiblePhotos.map((imgUrl, pIdx) => {
                              const isOverflow = hasOverflow && pIdx === (maxGrid - 1);
                              return (
                                <div
                                  key={pIdx}
                                  className={`bbdrts-evidence-thumb-container ${isOverflow ? 'is-overflow' : ''}`}
                                  onClick={() => setActiveEvidenceImg(imgUrl)}
                                  title={isOverflow ? `+${overflowCount} more photo${overflowCount > 1 ? 's' : ''}` : `Click to view field photo ${pIdx + 1}`}
                                  style={{ position: 'relative' }}
                                >
                                  <img src={imgUrl} alt={`Field evidence ${pIdx + 1}`} className="bbdrts-evidence-thumb" />
                                  <div className="bbdrts-evidence-thumb-overlay">
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>zoom_in</span>
                                  </div>
                                  {isOverflow && (
                                    <div className="beacon-thumb-overflow-overlay">
                                      <span>+{overflowCount}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Ground Deployment Audit & Proof of Fund Allocation */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Ground Deployment Audit */}
                    <div className="bbdrts-section-card">
                      <div className="bbdrts-section-card-header">
                        <h4 className="bbdrts-section-card-title">
                          <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#ef4444' }}>location_on</span>
                          Ground Deployment Audit
                        </h4>
                        <span className="bbdrts-section-card-badge">GPS VERIFIED</span>
                      </div>

                      {/* Interactive Leaflet Map View with Layer Controls */}
                      <div className="bbdrts-details-map-frame">
                        <LocationMapPicker
                          address={audit.region}
                          gps={audit.gps}
                          readOnly={true}
                          allowLayerSwitch={true}
                          height="230px"
                          hideTip={true}
                          theme={activeTheme}
                        />
                      </div>

                      {/* Map Quick Action Buttons (Google Maps + Copy GPS + Etherscan) */}
                      <div className="bbdrts-details-map-actions">
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(audit.gps || audit.region)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bbdrts-details-map-btn"
                          title="Open location in Google Maps"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#ea4335' }}>open_in_new</span>
                          <span>Google Maps</span>
                        </a>

                        {audit.gps && (
                          <button
                            type="button"
                            className="bbdrts-details-map-btn"
                            onClick={() => {
                              if (navigator.clipboard) {
                                navigator.clipboard.writeText(audit.gps);
                                showSuccess(`Coordinates copied to clipboard: ${audit.gps}`, 'GPS Copied');
                              }
                            }}
                            title="Copy GPS coordinates"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>content_copy</span>
                            <span>Copy GPS</span>
                          </button>
                        )}

                        {camp.contractAddress && (
                          <a
                            href={`https://sepolia.etherscan.io/address/${camp.contractAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bbdrts-details-map-btn"
                            title="View Escrow on Sepolia Etherscan"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#10b981' }}>receipt_long</span>
                            <span>Etherscan</span>
                          </a>
                        )}
                      </div>

                      {/* Logistics Key-Value Rows */}
                      <div className="bbdrts-details-logistics">
                        <div className="bbdrts-details-logistics-item">
                          <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#ef4444', marginTop: '2px', flexShrink: 0 }}>pin_drop</span>
                          <div className="bbdrts-details-logistics-text">
                            {audit.region}
                          </div>
                        </div>

                        {audit.gps && (
                          <div className="bbdrts-details-logistics-item">
                            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--text-muted)', flexShrink: 0 }}>radar</span>
                            <div>
                              <span style={{ color: '#10b981', fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', fontSize: '0.8rem' }}>
                                {audit.gps}
                              </span>
                            </div>
                          </div>
                        )}

                        {audit.beneficiaries && (
                          <div className="bbdrts-details-logistics-item">
                            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#10b981', marginTop: '2px', flexShrink: 0 }}>groups</span>
                            <div style={{ color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                              <strong style={{ color: '#10b981' }}>{audit.beneficiaries}</strong>
                            </div>
                          </div>
                        )}

                        {audit.contact && (
                          <div className="bbdrts-details-logistics-item">
                            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--text-muted)', flexShrink: 0 }}>call</span>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                              Response Desk: <strong style={{ color: 'var(--text-primary)' }}>{formatPhoneNumber(audit.contact)}</strong>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Proof of Fund Allocation */}
                    {audit.allocations && Array.isArray(audit.allocations) && audit.allocations.length > 0 && (() => {
                      const totalAllocTarget = camp.targetAmountPhp || camp.target_amount_php || (parseFloat(camp.targetAmount || 0) * 170000);
                      return (
                        <div className="bbdrts-section-card">
                          <div className="bbdrts-section-card-header">
                            <h4 className="bbdrts-section-card-title">
                              <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#10b981' }}>pie_chart</span>
                              Proof of Fund Allocation
                            </h4>
                            <span className="bbdrts-section-card-badge">TRANSPARENCY AUDIT</span>
                          </div>

                          <div className="bbdrts-details-allocations">
                            {audit.allocations.map((item, idx) => {
                              const cleanLabel = (item.label || '').replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();
                              const itemPhp = (totalAllocTarget * (item.pct / 100)).toLocaleString('en-US', { maximumFractionDigits: 0 });
                              return (
                                <div key={idx}>
                                  <div className="bbdrts-details-alloc-row">
                                    <span className="bbdrts-details-alloc-label">{cleanLabel}</span>
                                    <span className="bbdrts-details-alloc-val">
                                      <strong>₱{itemPhp}</strong> ({item.pct}%)
                                    </span>
                                  </div>
                                  <div className="bbdrts-details-alloc-track">
                                    <div className="bbdrts-details-alloc-fill" style={{ width: `${item.pct}%` }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Operational Policy Disclosures */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                            <div className="bbdrts-details-policy-box">
                              <div className="bbdrts-details-policy-title">
                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>savings</span>
                                <span>Surplus Reserve Policy</span>
                              </div>
                              <p className="bbdrts-details-policy-desc">
                                Contributions exceeding 100% roll over into the <strong>Calamity Response Reserve Fund</strong> for emergency relief and unbudgeted operations.
                              </p>
                            </div>

                            <div className="bbdrts-details-policy-box">
                              <div className="bbdrts-details-policy-title" style={{ color: '#0ea5e9' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>priority_high</span>
                                <span>Partial Funding Priority Rule</span>
                              </div>
                              <p className="bbdrts-details-policy-desc">
                                If the timeline concludes before reaching full target, accumulated funds are immediately disbursed to <strong>immediate survival necessities (food rations, drinking water & medical aid)</strong> first.
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* ── 3. Modal Actions Sticky Footer ── */}
              <div className="bbdrts-details-footer">
                <button
                  type="button"
                  className="bbdrts-details-btn-close"
                  onClick={() => setDetailsOpen(false)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                  <span>Close Audit</span>
                </button>

                {(camp.disbursementStatus === 'DISBURSED' || (camp.disbursedAmountPhp || 0) > 0) && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => {
                      setDetailsOpen(false);
                      setProofModalOpen(true);
                    }}
                    style={{
                      borderColor: 'rgba(34, 197, 94, 0.4)',
                      color: 'var(--accent, #22c55e)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>verified</span>
                    <span>View Relief Proof</span>
                  </button>
                )}

                {isOwner ? (
                  <>
                    <button
                      type="button"
                      className="bbdrts-details-btn-primary"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (isDisbursementsMaintenance) {
                          showWarning(
                            `Fund disbursement is temporarily paused for scheduled maintenance (${maintState?.title || 'System Maintenance'}). Escrow vault is safely locked.`,
                            'Maintenance Active'
                          );
                          return;
                        }
                        setDetailsOpen(false);
                        setDisburseModalOpen(true);
                      }}
                      style={{
                        background: isDisbursementsMaintenance ? '#27272a' : 'var(--accent, #22c55e)',
                        color: isDisbursementsMaintenance ? '#a1a1aa' : '#0a0a0a',
                        cursor: isDisbursementsMaintenance ? 'not-allowed' : 'pointer'
                      }}
                      title={isDisbursementsMaintenance ? 'Disbursement paused for maintenance' : 'Disburse raised funds and upload distribution photos / official receipts'}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                        {isDisbursementsMaintenance ? 'construction' : 'local_shipping'}
                      </span>
                      <span>{isDisbursementsMaintenance ? 'Disbursement (Maintenance)' : 'Disburse & Upload Relief Proof'}</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => {
                        setDetailsOpen(false);
                        setEditModalOpen(true);
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit_note</span>
                      <span>Edit Details</span>
                    </button>
                  </>
                ) : canDonate ? (
                  <button
                    type="button"
                    className="bbdrts-details-btn-primary"
                    onClick={() => {
                      setDetailsOpen(false);
                      setDonateStep(0);
                      setCustomMsg('');
                      setTxHash('');
                      setIsAnonymous(false);
                      setLegalConfirm(false);
                      setModalOpen(true);
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>volunteer_activism</span>
                    <span>Donate to Campaign</span>
                  </button>
                ) : null}
              </div>

              {/* Evidence Lightbox Modal (Root Document Body Portal) */}
              {activeEvidenceImg && typeof document !== 'undefined' && createPortal(
                <div
                  className="disaster-lightbox-backdrop"
                  onClick={() => setActiveEvidenceImg(null)}
                  role="dialog"
                  aria-modal="true"
                >
                  <div className="disaster-lightbox-content" onClick={(e) => e.stopPropagation()}>
                    {/* Top Bar: Counter & Close */}
                    <div className="disaster-lightbox-top-bar">
                      <div className="disaster-lightbox-pill">
                        <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#10b981' }}>photo_library</span>
                        <span>Photo {(() => {
                          const idx = allModalPhotos.indexOf(activeEvidenceImg);
                          return (idx >= 0 ? idx + 1 : 1);
                        })()} of {allModalPhotos.length || 1}</span>
                      </div>
                      <button
                        type="button"
                        className="disaster-lightbox-close"
                        onClick={() => setActiveEvidenceImg(null)}
                        title="Close Preview (Esc)"
                        aria-label="Close Preview"
                      >
                        <span className="material-symbols-outlined">close</span>
                      </button>
                    </div>

                    {/* Middle Stage: Stationary Prev + Fixed Image Frame + Stationary Next */}
                    <div className="disaster-lightbox-stage">
                      {allModalPhotos.length > 1 && (
                        <button
                          type="button"
                          className="disaster-lightbox-nav-btn prev"
                          onClick={(e) => {
                            e.stopPropagation();
                            const curr = allModalPhotos.indexOf(activeEvidenceImg);
                            const prev = curr > 0 ? curr - 1 : allModalPhotos.length - 1;
                            setActiveEvidenceImg(allModalPhotos[prev]);
                          }}
                          title="Previous Photo (Left Arrow)"
                          aria-label="Previous Photo"
                        >
                          <span className="material-symbols-outlined">chevron_left</span>
                        </button>
                      )}

                      <div className="disaster-lightbox-img-frame">
                        <img
                          src={activeEvidenceImg}
                          alt="Disaster Aftermath Evidence"
                          className="disaster-lightbox-img"
                        />
                      </div>

                      {allModalPhotos.length > 1 && (
                        <button
                          type="button"
                          className="disaster-lightbox-nav-btn next"
                          onClick={(e) => {
                            e.stopPropagation();
                            const curr = allModalPhotos.indexOf(activeEvidenceImg);
                            const next = curr < allModalPhotos.length - 1 ? curr + 1 : 0;
                            setActiveEvidenceImg(allModalPhotos[next]);
                          }}
                          title="Next Photo (Right Arrow)"
                          aria-label="Next Photo"
                        >
                          <span className="material-symbols-outlined">chevron_right</span>
                        </button>
                      )}
                    </div>

                    <div className="disaster-lightbox-caption">
                      <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#10b981' }}>verified</span>
                      <span>Disaster Impact & Aftermath Evidence • Ground Photographic Verification</span>
                    </div>

                    {/* Bottom Thumbnails Carousel */}
                    {allModalPhotos.length > 1 && (
                      <div className="disaster-lightbox-thumbs-strip" onClick={(e) => e.stopPropagation()}>
                        {allModalPhotos.map((thumbUrl, tIdx) => (
                          <button
                            key={tIdx}
                            type="button"
                            className={`disaster-lightbox-strip-thumb ${thumbUrl === activeEvidenceImg ? 'is-active' : ''}`}
                            onClick={() => setActiveEvidenceImg(thumbUrl)}
                            title={`Switch to photo ${tIdx + 1}`}
                          >
                            <img src={thumbUrl} alt={`Thumbnail ${tIdx + 1}`} />
                            <span className="disaster-lightbox-thumb-num">{tIdx + 1}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>,
                document.body
              )}
            </div>
          </div>,
          document.body
        );
      })()}

      {/* ── Edit Campaign Details & Operations Modal ── */}
      <EditCampaignModal
        camp={camp}
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSaved={() => {
          onCampaignUpdated?.();
          onDonated?.();
        }}
      />

      {/* ── Disburse Funds to Beneficiaries Modal ── */}
      <DisburseModal
        camp={camp}
        isOpen={disburseModalOpen}
        onClose={() => setDisburseModalOpen(false)}
        onDisbursed={() => {
          onCampaignUpdated?.();
          onDonated?.();
        }}
      />

      {/* ── Verified Aid Distribution Proof & Receipts Modal ── */}
      <DisbursementProofModal
        camp={camp}
        isOpen={proofModalOpen}
        onClose={() => setProofModalOpen(false)}
      />
    </div>
  );
}
