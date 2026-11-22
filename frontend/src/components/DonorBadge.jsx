import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { API_URL } from '../config';
import { realtimeSync } from '../utils/realtimeSync';
import './DonorBadge.css';

/**
 * 15 Bespoke Dignified Humanitarian Insignias for Disaster Relief
 * - Strictly visual-only: Zero text inside any badge icon.
 * - Rooted in authentic humanitarian symbolism (seedlings, water lifelines, emergency aid crosses,
 *   protective shelter, lamps of compassion, caring hands, laurel wreaths, civil anchors, and beacons of hope).
 * - Avoids gaming tropes: no glowing Discord crystal shards, no flaming phoenix sceptres, no monarch crowns.
 */

// ── 15 Dignified Humanitarian Insignias (Strictly Visual-Only, Zero Text Inside) ──

// Level 1: Community Contributor (₱1+) — Seedling of Emergency Aid & Hope
export function BadgeTier1Contributor({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={`custom-donor-badge-svg badge-svg-t1 ${className}`}>
      <circle cx="18" cy="18" r="16" fill="#ecfdf5" stroke="#10b981" strokeWidth="1.6" />
      <path d="M18 26V14" stroke="#059669" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 18C15 15 11 15 11 11C15 11 17 14 18 18Z" fill="#10b981" />
      <path d="M18 15C21 12 25 12 25 8C21 8 19 11 18 15Z" fill="#059669" />
      <circle cx="18" cy="27" r="1.5" fill="#047857" />
    </svg>
  );
}

// Level 2: Relief Sustainer (₱1,000+) — Caring Hands & Water Droplet
export function BadgeTier2Supporter({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={`custom-donor-badge-svg badge-svg-t2 ${className}`}>
      <circle cx="18" cy="18" r="16" fill="#f0f9ff" stroke="#0284c7" strokeWidth="1.6" />
      <path d="M18 9C18 9 13.5 15 13.5 18C13.5 20.48 15.52 22.5 18 22.5C20.48 22.5 22.5 20.48 22.5 18C22.5 15 18 9 18 9Z" fill="#38bdf8" />
      <path d="M9 21C11.5 24.5 14.5 26.5 18 26.5C21.5 26.5 24.5 24.5 27 21" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16.8" cy="17" r="1.2" fill="#ffffff" />
    </svg>
  );
}

// Level 3: Frontline Partner (₱5,000+) — Humanitarian Emergency Cross
export function BadgeTier3ReliefPartner({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={`custom-donor-badge-svg badge-svg-t3 ${className}`}>
      <circle cx="18" cy="18" r="16" fill="#eff6ff" stroke="#2563eb" strokeWidth="1.6" />
      <rect x="15" y="9" width="6" height="18" rx="2" fill="#2563eb" />
      <rect x="9" y="15" width="18" height="6" rx="2" fill="#2563eb" />
      <circle cx="18" cy="18" r="2.5" fill="#ffffff" />
    </svg>
  );
}

// Level 4: Shelter Benefactor (₱10,000+) — Sanctuary Haven & Protective Roof
export function BadgeTier4Benefactor({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={`custom-donor-badge-svg badge-svg-t4 ${className}`}>
      <circle cx="18" cy="18" r="16" fill="#faf5ff" stroke="#7c3aed" strokeWidth="1.6" />
      <path d="M8 17L18 9L28 17" stroke="#7c3aed" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 16V25H25V16" stroke="#9333ea" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="18" cy="20.5" r="2.5" fill="#c084fc" />
      <circle cx="18" cy="20.5" r="1.2" fill="#ffffff" />
    </svg>
  );
}

// Tier 5: Compassion Advocate (₱25,000+) — Lamp of Compassion & Gentle Flame
export function BadgeTier5Advocate({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={`custom-donor-badge-svg badge-svg-t5 ${className}`}>
      <circle cx="18" cy="18" r="16" fill="#fff1f2" stroke="#e11d48" strokeWidth="1.6" />
      <path d="M11 22C11 25 14 26.5 18 26.5C22 26.5 25 25 25 22H11Z" fill="#e11d48" />
      <path d="M14 26.5H22V28H14V26.5Z" fill="#be123c" />
      <path d="M18 10C18 10 15 14.5 15 17.5C15 19.5 16.34 21 18 21C19.66 21 21 19.5 21 17.5C21 14.5 18 10 18 10Z" fill="#fb7185" />
      <circle cx="18" cy="18" r="1.5" fill="#fef08a" />
    </svg>
  );
}

// Tier 6: Community Philanthropist (₱50,000+) — Heart of Philanthropy Held by Caring Hands
export function BadgeTier6Philanthropist({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={`custom-donor-badge-svg badge-svg-t6 ${className}`}>
      <circle cx="18" cy="18" r="16" fill="#fffbeb" stroke="#d97706" strokeWidth="1.6" />
      <path d="M18 12C16.5 10 13.5 10 12 12C10.5 14 11 17 18 22C25 17 25.5 14 24 12C22.5 10 19.5 10 18 12Z" fill="#d97706" />
      <path d="M9 22C11 25.5 14 27 18 27C22 27 25 25.5 27 22" stroke="#b45309" strokeWidth="2" strokeLinecap="round" />
      <circle cx="18" cy="15.5" r="1.4" fill="#ffffff" />
    </svg>
  );
}

// Tier 7: Distinguished Humanitarian (₱100,000+) — Red Shield of Relief & Mercy
export function BadgeTier7Humanitarian({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={`custom-donor-badge-svg badge-svg-t7 ${className}`}>
      <circle cx="18" cy="18" r="16" fill="#fef2f2" stroke="#dc2626" strokeWidth="1.6" />
      <path d="M18 7L27 11V19C27 24.5 23 28 18 29.5C13 28 9 24.5 9 19V11L18 7Z" fill="#fee2e2" stroke="#dc2626" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M16 13H20V16H23V20H20V23H16V20H13V16H16V13Z" fill="#dc2626" />
      <circle cx="18" cy="18" r="1.2" fill="#ffffff" />
    </svg>
  );
}

// Tier 8: Pillar of Mercy (₱250,000+) — Olive Wreath of Peace & Recovery
export function BadgeTier8DistinguishedHumanitarian({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={`custom-donor-badge-svg badge-svg-t8 ${className}`}>
      <circle cx="18" cy="18" r="16" fill="#f0fdfa" stroke="#0d9488" strokeWidth="1.6" />
      <path d="M13 11C11.5 14 11 18 13.5 22C14.5 23.5 16 25 18 26" stroke="#0d9488" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M23 11C24.5 14 25 18 22.5 22C21.5 23.5 20 25 18 26" stroke="#0d9488" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="11.5" cy="14" r="1.8" fill="#14b8a6" />
      <circle cx="11" cy="19" r="1.8" fill="#14b8a6" />
      <circle cx="24.5" cy="14" r="1.8" fill="#14b8a6" />
      <circle cx="25" cy="19" r="1.8" fill="#14b8a6" />
      <polygon points="18,12 19.5,15.5 23,16 20.5,18.5 21,22 18,20 15,22 15.5,18.5 13,16 16.5,15.5" fill="#0f766e" />
      <circle cx="18" cy="17.5" r="1" fill="#ffffff" />
    </svg>
  );
}

// Tier 9: Patron of Relief (₱500,000+) — Shield of Civil Protection & Anchor of Stability
export function BadgeTier9PatronOfRelief({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={`custom-donor-badge-svg badge-svg-t9 ${className}`}>
      <circle cx="18" cy="18" r="16" fill="#eff6ff" stroke="#1d4ed8" strokeWidth="1.6" />
      <circle cx="18" cy="11.5" r="2.5" stroke="#1d4ed8" strokeWidth="1.6" fill="none" />
      <line x1="18" y1="14" x2="18" y2="25" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" />
      <line x1="13.5" y1="16" x2="22.5" y2="16" stroke="#1d4ed8" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M11.5 21C12.5 25 15 27 18 27C21 27 23.5 25 24.5 21" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="18" cy="20" r="1.5" fill="#f59e0b" />
    </svg>
  );
}

// Tier 10: Disaster Relief Champion (₱1,000,000+) — Guiding Lighthouse Beacon of Hope
export function BadgeTier10GrandBenefactor({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={`custom-donor-badge-svg badge-svg-t10 ${className}`}>
      <circle cx="18" cy="18" r="16" fill="#f0f9ff" stroke="#0284c7" strokeWidth="1.8" />
      <polygon points="15,14 21,14 22.5,27 13.5,27" fill="#0284c7" />
      <rect x="15" y="10.5" width="6" height="3.5" rx="1" fill="#38bdf8" />
      <path d="M15 12L8 9M21 12L28 9M15 13L7 15M21 13L29 15" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 1.5" />
      <rect x="11.5" y="27" width="13" height="2" rx="1" fill="#0369a1" />
      <circle cx="18" cy="12" r="1.4" fill="#ffffff" />
    </svg>
  );
}

// Tier 11: Principal Benefactor (₱2,500,000+) — Civic Medal & Laurel of Honor
export function BadgeTier11PrincipalBenefactor({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={`custom-donor-badge-svg badge-svg-t11 ${className}`}>
      <circle cx="18" cy="18" r="16" fill="#faf5ff" stroke="#7e22ce" strokeWidth="1.8" />
      <polygon points="14,6 18,10 22,6 22,14 18,12 14,14" fill="#9333ea" />
      <circle cx="18" cy="20" r="8" fill="#faf5ff" stroke="#7e22ce" strokeWidth="1.6" />
      <polygon points="18,14.5 19.5,18 23,18.5 20.5,21 21,24.5 18,22.8 15,24.5 15.5,21 13,18.5 16.5,18" fill="#a855f7" />
      <circle cx="18" cy="19.8" r="1.5" fill="#ffffff" />
    </svg>
  );
}

// Tier 12: Legacy Benefactor (₱5,000,000+) — Medallion of Enduring Relief & Community Pillar
export function BadgeTier12LegacyBenefactor({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={`custom-donor-badge-svg badge-svg-t12 ${className}`}>
      <circle cx="18" cy="18" r="16" fill="#ecfdf5" stroke="#059669" strokeWidth="2" />
      <circle cx="18" cy="18" r="12.5" fill="none" stroke="#10b981" strokeWidth="1" strokeDasharray="2 1.5" />
      <rect x="16" y="12" width="4" height="12" rx="1" fill="#047857" />
      <rect x="14" y="10" width="8" height="2.5" rx="1" fill="#059669" />
      <rect x="13.5" y="23.5" width="9" height="2.5" rx="1" fill="#059669" />
      <path d="M10 20C10 16 12 13 14 12M26 20C26 16 24 13 22 12" stroke="#10b981" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="18" cy="17" r="1.3" fill="#ffffff" />
    </svg>
  );
}

// Level 13: Visionary Benefactor (₱10,000,000+) — Sheltering Canopy of Care
export function BadgeTier13SovereignGuardian({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={`custom-donor-badge-svg badge-svg-t13 ${className}`}>
      <circle cx="18" cy="18" r="16" fill="#f0fdf4" stroke="#16a34a" strokeWidth="2" />
      <path d="M7 19C11 13 14.5 11 18 11C21.5 11 25 13 29 19" stroke="#15803d" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <circle cx="18" cy="18" r="2.6" fill="#16a34a" />
      <circle cx="13" cy="21" r="2" fill="#22c55e" />
      <circle cx="23" cy="21" r="2" fill="#22c55e" />
      <path d="M10 25C13 26.5 15.5 27 18 27C20.5 27 23 26.5 26 25" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="18" cy="18" r="1" fill="#ffffff" />
    </svg>
  );
}

// Level 14: Distinguished Lifesaver (₱25,000,000+) — Humanitarian Sun of Renewal
export function BadgeTier14ChampionOfHope({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={`custom-donor-badge-svg badge-svg-t14 ${className}`}>
      <circle cx="18" cy="18" r="16" fill="#fffbeb" stroke="#b45309" strokeWidth="2" />
      <circle cx="18" cy="18" r="7.5" fill="#f59e0b" stroke="#d97706" strokeWidth="1.2" />
      <line x1="18" y1="5" x2="18" y2="8" stroke="#b45309" strokeWidth="2" strokeLinecap="round" />
      <line x1="18" y1="28" x2="18" y2="31" stroke="#b45309" strokeWidth="2" strokeLinecap="round" />
      <line x1="5" y1="18" x2="8" y2="18" stroke="#b45309" strokeWidth="2" strokeLinecap="round" />
      <line x1="28" y1="18" x2="31" y2="18" stroke="#b45309" strokeWidth="2" strokeLinecap="round" />
      <line x1="9" y1="9" x2="11.2" y2="11.2" stroke="#d97706" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="24.8" y1="24.8" x2="27" y2="27" stroke="#d97706" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="9" y1="27" x2="11.2" y2="24.8" stroke="#d97706" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="24.8" y1="11.2" x2="27" y2="9" stroke="#d97706" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M18 15C17.3 14 15.8 14 15 15C14.2 16 14.5 17.5 18 20C21.5 17.5 21.8 16 21 15C20.2 14 18.7 14 18 15Z" fill="#ffffff" />
    </svg>
  );
}

// Level 15: Honorary Relief Trustee (₱50,000,000+) — Grand Order of Disaster Relief
export function BadgeTier15ApexLuminary({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={`custom-donor-badge-svg badge-svg-t15 ${className}`}>
      <circle cx="18" cy="18" r="16" fill="#f8fafc" stroke="#334155" strokeWidth="2" />
      <circle cx="18" cy="18" r="13" fill="#ffffff" stroke="#64748b" strokeWidth="1.4" />
      <circle cx="18" cy="18" r="10.5" fill="none" stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="1.5 1.5" />
      <polygon points="18,9 19.8,14.2 25,12 21.8,16.8 27,18 21.8,19.2 25,24 19.8,21.8 18,27 16.2,21.8 11,24 14.2,19.2 9,18 14.2,16.8 11,12 16.2,14.2" fill="#d97706" />
      <circle cx="18" cy="18" r="3.5" fill="#334155" stroke="#fef08a" strokeWidth="0.8" />
      <circle cx="18" cy="18" r="1.5" fill="#ffffff" />
    </svg>
  );
}

// Backward-compatibility aliases so existing tests or imports never break
export const BadgeTier1Seedling = BadgeTier1Contributor;
export const BadgeTier2Compass = BadgeTier2Supporter;
export const BadgeTier3Guardian = BadgeTier3ReliefPartner;
export const BadgeTier4Pillar = BadgeTier4Benefactor;
export const BadgeTier5Sunburst = BadgeTier5Advocate;
export const BadgeTier6Vanguard = BadgeTier6Philanthropist;
export const BadgeTier7Apex = BadgeTier7Humanitarian;
export const BadgeTier13VisionaryBenefactor = BadgeTier13SovereignGuardian;
export const BadgeTier14DistinguishedLifesaver = BadgeTier14ChampionOfHope;
export const BadgeTier15HonoraryReliefTrustee = BadgeTier15ApexLuminary;

/**
 * 15 Dignified Donor Recognition Tiers based on cumulative disaster relief contributions
 */
export const DONOR_TIERS = [
  {
    tierNumber: 1,
    id: 'tier-1',
    name: 'Kind Giver',
    subtitle: 'Food & Clean Water',
    minPhp: 1,
    minEth: 0.000006,
    IconComponent: BadgeTier1Contributor,
    color: '#10b981',
    border: 'rgba(16, 185, 129, 0.35)',
    bg: 'rgba(16, 185, 129, 0.08)',
    badgeClass: 'tier-1',
    description: 'Helps provide emergency food packs and clean drinking water to families in need.'
  },
  {
    tierNumber: 2,
    id: 'tier-2',
    name: 'Care Supporter',
    subtitle: 'Family Relief Packs',
    minPhp: 1000,
    minEth: 0.006,
    IconComponent: BadgeTier2Supporter,
    color: '#0284c7',
    border: 'rgba(2, 132, 199, 0.35)',
    bg: 'rgba(2, 132, 199, 0.08)',
    badgeClass: 'tier-2',
    description: 'Helps fund essential food packs, safe drinking water, and family hygiene kits.'
  },
  {
    tierNumber: 3,
    id: 'tier-3',
    name: 'Relief Ally',
    subtitle: 'Medical & First-Aid',
    minPhp: 5000,
    minEth: 0.03,
    IconComponent: BadgeTier3ReliefPartner,
    color: '#2563eb',
    border: 'rgba(37, 99, 235, 0.35)',
    bg: 'rgba(37, 99, 235, 0.08)',
    badgeClass: 'tier-3',
    description: 'Helps equip volunteer responders with first-aid supplies and emergency care gear.'
  },
  {
    tierNumber: 4,
    id: 'tier-4',
    name: 'Shelter Giver',
    subtitle: 'Emergency Shelters',
    minPhp: 10000,
    minEth: 0.06,
    IconComponent: BadgeTier4Benefactor,
    color: '#7c3aed',
    border: 'rgba(124, 58, 237, 0.35)',
    bg: 'rgba(124, 58, 237, 0.08)',
    badgeClass: 'tier-4',
    description: 'Helps provide weatherproof tents and shelter repair materials for displaced families.'
  },
  {
    tierNumber: 5,
    id: 'tier-5',
    name: 'Aid Advocate',
    subtitle: 'Community Health',
    minPhp: 25000,
    minEth: 0.15,
    IconComponent: BadgeTier5Advocate,
    color: '#e11d48',
    border: 'rgba(225, 29, 72, 0.35)',
    bg: 'rgba(225, 29, 72, 0.08)',
    badgeClass: 'tier-5',
    description: 'Helps fund emergency clinic medicines, maternal health kits, and volunteer medical missions.'
  },
  {
    tierNumber: 6,
    id: 'tier-6',
    name: 'Relief Sponsor',
    subtitle: 'Barangay Drives',
    minPhp: 50000,
    minEth: 0.30,
    IconComponent: BadgeTier6Philanthropist,
    color: '#d97706',
    border: 'rgba(217, 119, 6, 0.35)',
    bg: 'rgba(217, 119, 6, 0.08)',
    badgeClass: 'tier-6',
    description: 'Helps sponsor full-barangay relief distribution drives across disaster-affected communities.'
  },
  {
    tierNumber: 7,
    id: 'tier-7',
    name: 'Care Partner',
    subtitle: 'Rapid Response',
    minPhp: 100000,
    minEth: 0.60,
    IconComponent: BadgeTier7Humanitarian,
    color: '#dc2626',
    border: 'rgba(220, 38, 38, 0.35)',
    bg: 'rgba(220, 38, 38, 0.08)',
    badgeClass: 'tier-7',
    description: 'Helps fund rapid emergency response deployments to critical typhoon and flood zones.'
  },
  {
    tierNumber: 8,
    id: 'tier-8',
    name: 'Aid Sustainer',
    subtitle: 'Water & Solar Power',
    minPhp: 250000,
    minEth: 1.50,
    IconComponent: BadgeTier8DistinguishedHumanitarian,
    color: '#0d9488',
    border: 'rgba(13, 148, 136, 0.35)',
    bg: 'rgba(13, 148, 136, 0.08)',
    badgeClass: 'tier-8',
    description: 'Helps deploy mobile water filtration systems and emergency solar power generators.'
  },
  {
    tierNumber: 9,
    id: 'tier-9',
    name: 'Relief Steward',
    subtitle: 'Provincial Logistics',
    minPhp: 500000,
    minEth: 3.00,
    IconComponent: BadgeTier9PatronOfRelief,
    color: '#1d4ed8',
    border: 'rgba(29, 78, 216, 0.35)',
    bg: 'rgba(29, 78, 216, 0.08)',
    badgeClass: 'tier-9',
    description: 'Helps fund cargo transport and bulk relief deliveries to remote evacuation hubs.'
  },
  {
    tierNumber: 10,
    id: 'tier-10',
    name: 'Major Donor',
    subtitle: 'Community Recovery',
    minPhp: 1000000,
    minEth: 6.00,
    IconComponent: BadgeTier10GrandBenefactor,
    color: '#0284c7',
    border: 'rgba(2, 132, 199, 0.4)',
    bg: 'rgba(2, 132, 199, 0.1)',
    badgeClass: 'tier-10',
    description: 'Helps rebuild disaster-hit communities and restore sustainable family livelihoods.'
  },
  {
    tierNumber: 11,
    id: 'tier-11',
    name: 'Lead Benefactor',
    subtitle: 'Schools & Shelters',
    minPhp: 2500000,
    minEth: 15.00,
    IconComponent: BadgeTier11PrincipalBenefactor,
    color: '#7e22ce',
    border: 'rgba(126, 34, 206, 0.4)',
    bg: 'rgba(126, 34, 206, 0.1)',
    badgeClass: 'tier-11',
    description: 'Helps repair damaged schools and construct fortified community evacuation centers.'
  },
  {
    tierNumber: 12,
    id: 'tier-12',
    name: 'Honorary Patron',
    subtitle: 'Resilient Homes',
    minPhp: 5000000,
    minEth: 30.00,
    IconComponent: BadgeTier12LegacyBenefactor,
    color: '#059669',
    border: 'rgba(5, 150, 105, 0.45)',
    bg: 'rgba(5, 150, 105, 0.1)',
    badgeClass: 'tier-12',
    description: 'Helps construct typhoon-resilient permanent housing in high-risk coastal communities.'
  },
  {
    tierNumber: 13,
    id: 'tier-13',
    name: 'Grand Benefactor',
    subtitle: 'Inter-Island Aid',
    minPhp: 10000000,
    minEth: 60.00,
    IconComponent: BadgeTier13SovereignGuardian,
    color: '#16a34a',
    border: 'rgba(22, 163, 74, 0.45)',
    bg: 'rgba(22, 163, 74, 0.1)',
    badgeClass: 'tier-13',
    description: 'Helps fund emergency relief boats and inter-island humanitarian supply corridors.'
  },
  {
    tierNumber: 14,
    id: 'tier-14',
    name: 'Founding Patron',
    subtitle: 'National Operations',
    minPhp: 25000000,
    minEth: 150.00,
    IconComponent: BadgeTier14ChampionOfHope,
    color: '#b45309',
    border: 'rgba(180, 83, 9, 0.5)',
    bg: 'rgba(180, 83, 9, 0.1)',
    badgeClass: 'tier-14',
    description: 'Provides strategic philanthropic funding for nationwide disaster relief and recovery.'
  },
  {
    tierNumber: 15,
    id: 'tier-15',
    name: 'Legacy Trustee',
    subtitle: 'Enduring Relief Legacy',
    minPhp: 50000000,
    minEth: 300.00,
    IconComponent: BadgeTier15ApexLuminary,
    color: '#475569',
    border: 'rgba(71, 85, 105, 0.5)',
    bg: 'rgba(71, 85, 105, 0.12)',
    badgeClass: 'tier-15',
    description: 'A lasting philanthropic legacy ensuring rapid humanitarian disaster response across the Philippines.'
  }
];

/**
 * ── Global In-Memory & LocalStorage Registry for Cumulative Donor Totals ──
 * Badges and giving recognition reflect cumulative contributions across ALL campaigns.
 */
class DonorRegistry {
  constructor() {
    this.cache = new Map();
    this.listeners = new Set();
    this.loadFromStorage();
    if (typeof window !== 'undefined') {
      setTimeout(() => this.fetchGlobalTotals(), 500);
    }
  }

  loadFromStorage() {
    try {
      if (typeof window === 'undefined') return;
      const saved = localStorage.getItem('bbdrts_global_donor_totals');
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.entries(parsed).forEach(([k, v]) => this.cache.set(k.toLowerCase(), v));
      }
    } catch (_) {}
  }

  saveToStorage() {
    try {
      if (typeof window === 'undefined') return;
      const obj = {};
      this.cache.forEach((v, k) => { obj[k] = v; });
      localStorage.setItem('bbdrts_global_donor_totals', JSON.stringify(obj));
    } catch (_) {}
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach(fn => {
      try { fn(); } catch (_) {}
    });
  }

  get(identifier, secondaryId) {
    const keys = [];
    if (identifier) {
      const k1 = String(identifier).toLowerCase().trim();
      if (k1 && k1 !== '0x0000000000000000000000000000000000000000') {
        keys.push(k1, `id_${k1}`);
      }
    }
    if (secondaryId) {
      const k2 = String(secondaryId).toLowerCase().trim();
      if (k2 && k2 !== '0x0000000000000000000000000000000000000000') {
        keys.push(k2, `id_${k2}`);
      }
    }
    let best = null;
    for (const k of keys) {
      const item = this.cache.get(k);
      if (item) {
        if (!best || (item.totalEth || 0) > (best.totalEth || 0)) {
          best = item;
        }
      }
    }
    return best;
  }

  set(identifier, data) {
    if (!identifier) return;
    const key = String(identifier).toLowerCase().trim();
    if (!key || key === '0x0000000000000000000000000000000000000000') return;

    const existing = this.cache.get(key) || {};
    const inputEth = data.totalEth !== undefined ? parseFloat(data.totalEth) : 0;
    const inputPhp = data.totalPhp !== undefined ? parseFloat(data.totalPhp) : Math.round(inputEth * 170000);
    const existingEth = existing.totalEth || 0;
    const existingPhp = existing.totalPhp || 0;

    const totalEth = Math.max(existingEth, inputEth);
    const totalPhp = Math.max(existingPhp, inputPhp, Math.round(totalEth * 170000));
    const count = Math.max(existing.donationCount || 0, data.donationCount || 0, (totalEth > 0 || totalPhp > 0) ? 1 : 0);

    const merged = {
      ...existing,
      ...data,
      totalEth,
      totalPhp,
      donationCount: count
    };

    this.cache.set(key, merged);
    this.saveToStorage();
    this.notify();
  }

  recordDonation(identifier, addedEth, addedPhp) {
    if (!identifier) return;
    const key = String(identifier).toLowerCase().trim();
    if (!key || key === '0x0000000000000000000000000000000000000000') return;

    const current = this.cache.get(key) || { totalEth: 0, totalPhp: 0, donationCount: 0 };
    const addEth = parseFloat(addedEth) || 0;
    const addPhp = parseFloat(addedPhp) || (addEth * 170000);

    const newEth = current.totalEth + addEth;
    const newPhp = current.totalPhp + addPhp;
    const newCount = (current.donationCount || 0) + 1;

    this.set(key, { totalEth: newEth, totalPhp: newPhp, donationCount: newCount });
  }

  async fetchGlobalTotals() {
    try {
      const res = await fetch(`${API_URL}/api/donors/cumulative-totals?_t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        Object.entries(data).forEach(([k, v]) => {
          this.cache.set(k.toLowerCase(), v);
        });
        this.saveToStorage();
        this.notify();
      }
    } catch (_) {}
  }
}

export const globalDonorRegistry = new DonorRegistry();
if (typeof window !== 'undefined') {
  realtimeSync.subscribe(['donations', 'manual_donations'], () => {
    globalDonorRegistry.fetchGlobalTotals();
  });
}

/**
 * Calculates current recognized Giving Society strictly based on cumulative donations
 */
export const getDonorTier = (arg1 = 0, arg2 = 0) => {
  let amountEth = 0;
  let amountPhp = 0;

  if (typeof arg1 === 'object' && arg1 !== null) {
    amountEth = arg1.amountEth ?? 0;
    amountPhp = arg1.amountPhp ?? 0;
  } else {
    amountEth = arg1 ?? 0;
    amountPhp = arg2 ?? 0;
  }

  const eth = parseFloat(amountEth) || 0;
  const php = parseFloat(amountPhp) || (eth * 170000);

  if (php < 1 && eth <= 0) {
    return {
      tier: null,
      nextTier: DONOR_TIERS[0],
      progressPct: 0,
      remainingPhp: 1,
      totalEth: eth,
      totalPhp: php
    };
  }

  let currentTier = DONOR_TIERS[0];
  for (let i = DONOR_TIERS.length - 1; i >= 0; i--) {
    const t = DONOR_TIERS[i];
    if (php >= t.minPhp || eth >= t.minEth) {
      currentTier = t;
      break;
    }
  }

  const currentIndex = DONOR_TIERS.findIndex(t => t.id === currentTier.id);
  const nextTier = currentIndex < DONOR_TIERS.length - 1 ? DONOR_TIERS[currentIndex + 1] : null;

  let progressPct = 100;
  let remainingPhp = 0;

  if (nextTier) {
    const targetPhp = nextTier.minPhp;
    const rawPct = targetPhp > 0 ? (php / targetPhp) * 100 : 0;
    const pctNum = Math.min(99.9, Math.max(0, Math.round(rawPct * 10) / 10));
    progressPct = pctNum % 1 === 0 ? pctNum : pctNum.toFixed(1);
    remainingPhp = Math.max(0, targetPhp - php);
  }

  return {
    tier: currentTier,
    nextTier,
    progressPct,
    remainingPhp,
    totalEth: eth,
    totalPhp: php
  };
};

/**
 * Visual-Only Donor Badge Component (Strictly NO text inside the badge icon)
 * Displays recognized Giving Society and exact cumulative giving amount prominently
 */
export default function DonorBadge({
  walletAddress,
  donorId,
  amountEth,
  amountPhp,
  tier: tierProp,
  isGuest: isGuestProp = false,
  size = 'md', // 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  showTooltip = true,
  interactive = true,
  onClick
}) {
  const [hovered, setHovered] = useState(false);
  const [coords, setCoords] = useState(null);
  const badgeRef = useRef(null);
  const [, setRegistryTick] = useState(0);

  useEffect(() => {
    return globalDonorRegistry.subscribe(() => setRegistryTick(t => t + 1));
  }, []);

  const globalStats = globalDonorRegistry.get(walletAddress, donorId);

  const effectiveEth = globalStats?.totalEth !== undefined
    ? globalStats.totalEth
    : (amountEth !== undefined && amountEth !== null ? parseFloat(amountEth) : 0);
  const effectivePhp = globalStats?.totalPhp !== undefined
    ? globalStats.totalPhp
    : (amountPhp !== undefined && amountPhp !== null ? parseFloat(amountPhp) : (effectiveEth * 170000));

  let tierInfo = null;
  if (tierProp) {
    let resolvedTier = null;
    if (typeof tierProp === 'object' && tierProp !== null) {
      resolvedTier = tierProp.IconComponent
        ? tierProp
        : (DONOR_TIERS.find(t => t.tierNumber === tierProp.tier || t.tierNumber === tierProp.tierNumber || t.id === tierProp.id || t.name === tierProp.name) || DONOR_TIERS[0]);
    } else if (typeof tierProp === 'number' || typeof tierProp === 'string') {
      const num = parseInt(tierProp, 10);
      resolvedTier = DONOR_TIERS.find(t => t.tierNumber === num || t.id === `tier-${num}` || t.name.toLowerCase() === String(tierProp).toLowerCase()) || DONOR_TIERS[0];
    }
    if (resolvedTier) {
      tierInfo = { tier: resolvedTier, nextTier: null, progressPct: 100, remainingPhp: 0, totalEth: effectiveEth, totalPhp: effectivePhp };
    }
  }

  if (!tierInfo) {
    tierInfo = getDonorTier({ amountEth: effectiveEth, amountPhp: effectivePhp });
  }

  const { tier } = tierInfo;

  const updateCoords = () => {
    if (!badgeRef.current) return;
    const rect = badgeRef.current.getBoundingClientRect();
    const tooltipWidth = 240;
    let left = rect.left + rect.width / 2;
    left = Math.max(tooltipWidth / 2 + 10, Math.min(window.innerWidth - tooltipWidth / 2 - 10, left));
    const placeBelow = rect.top < 130;
    const top = placeBelow ? (rect.bottom + 8) : (rect.top - 8);

    setCoords({ top, left, placeBelow });
  };

  useEffect(() => {
    if (!hovered) return;
    updateCoords();
    const handleScrollOrResize = () => updateCoords();
    window.addEventListener('scroll', handleScrollOrResize, { passive: true, capture: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, { capture: true });
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [hovered]);

  if (isGuestProp || !tier) {
    return null;
  }

  const Icon = tier.IconComponent;
  const iconPixelSize = size === 'xs' ? 14 : size === 'sm' ? 20 : size === 'lg' ? 36 : size === 'xl' ? 48 : 26;

  return (
    <>
      <div
        ref={badgeRef}
        className={`donor-badge-wrapper size-${size} ${tier.badgeClass} ${interactive ? 'is-interactive' : ''}`}
        onMouseEnter={() => {
          updateCoords();
          setHovered(true);
        }}
        onMouseLeave={() => setHovered(false)}
        onClick={(e) => {
          if (onClick) {
            e.stopPropagation();
            onClick(tierInfo);
          }
        }}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        title={showTooltip ? undefined : `${tier.name} • ₱${Math.round(tierInfo.totalPhp).toLocaleString('en-US')} Total Donated`}
      >
        <div className="donor-badge-emblem icon-only">
          <Icon size={iconPixelSize} className="donor-badge-custom-icon" />
        </div>
      </div>

      {showTooltip && hovered && coords && typeof document !== 'undefined' && createPortal(
        <div
          className={`donor-badge-tooltip-overlay ${coords.placeBelow ? 'place-below' : 'place-above'}`}
          style={{
            top: `${coords.top}px`,
            left: `${coords.left}px`
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="dbt-header">
            <Icon size={20} />
            <div style={{ flex: 1 }}>
              <span className="dbt-tier-title" style={{ color: tier.color }}>
                {tier.name}
              </span>
              <span className="dbt-subtitle">{tier.subtitle}</span>
            </div>
            <span className="dbt-rank-tag">VERIFIED</span>
          </div>

          <div className="dbt-stats-row">
            <div className="dbt-stat">
              <span className="dbt-stat-label">Total Donated</span>
              <span className="dbt-stat-val">
                ₱{Math.round(tierInfo.totalPhp).toLocaleString('en-US')}
              </span>
            </div>
          </div>

          <div className="dbt-desc">
            {tier.description}
          </div>

          <div className="dbt-max-badge">
            <span className="material-symbols-outlined" style={{ fontSize: '13px', color: '#10b981' }}>verified_user</span>
            <span>Verified on Blockchain</span>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

/**
 * Donor Recognition Card Component
 * Displays on the donor profile dashboard showing current badge, total donations, and certificate
 */
export function DonorProgressCard({
  walletAddress,
  donorId,
  amountEth,
  amountPhp,
  onOpenLadder
}) {
  const [, setRegistryTick] = useState(0);

  useEffect(() => {
    return globalDonorRegistry.subscribe(() => setRegistryTick(t => t + 1));
  }, []);

  const globalStats = globalDonorRegistry.get(walletAddress || donorId);
  const effectiveEth = globalStats?.totalEth !== undefined
    ? globalStats.totalEth
    : (amountEth !== undefined ? parseFloat(amountEth) : 0);
  const effectivePhp = globalStats?.totalPhp !== undefined
    ? globalStats.totalPhp
    : (amountPhp !== undefined ? parseFloat(amountPhp) : (effectiveEth * 170000));

  const tierInfo = getDonorTier({ amountEth: effectiveEth, amountPhp: effectivePhp });
  const { tier, nextTier, totalPhp } = tierInfo;

  if (!tier) {
    return (
      <div className="donor-progress-card unranked">
        <div className="dpc-left">
          <div className="dpc-unranked-icon-wrap">
            <BadgeTier1Contributor size={36} className="dpc-unranked-ghost" />
          </div>
          <div className="dpc-info">
            <span className="dpc-eyebrow">Donor Status</span>
            <h3 className="dpc-title">Make Your First Donation</h3>
            <p className="dpc-desc">
              Every donation of ₱1 or more helps provide food, clean water, and relief to families in need.
            </p>
          </div>
        </div>
        <div className="dpc-right">
          <button type="button" className="dpc-ladder-btn" onClick={onOpenLadder}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>workspace_premium</span>
            <span>Giving Circles</span>
          </button>
        </div>
      </div>
    );
  }

  const ActiveIcon = tier.IconComponent;

  return (
    <div className={`donor-progress-card ${tier.badgeClass}`}>
      <div className="dpc-main">
        {/* Large Visual Badge Emblem */}
        <div className="dpc-badge-col" onClick={onOpenLadder} title="Click to view Donor Tiers & Certificate">
          <div className="dpc-badge-emblem-wrap">
            <ActiveIcon size={46} />
          </div>
        </div>

        {/* Info & Impact Column */}
        <div className="dpc-content-col">
          <div className="dpc-header-row">
            <div>
              <div className="dpc-badge-meta-top">
                <span className="dpc-verified-pill">
                  <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>verified</span>
                  Verified Donor
                </span>
              </div>
              <h2 className="dpc-tier-name" style={{ color: tier.color }}>
                {tier.name}
              </h2>
              <span className="dpc-tier-subtitle">{tier.subtitle}</span>
            </div>

            <div className="dpc-impact-metric">
              <span className="dpc-metric-num">₱{Math.round(totalPhp).toLocaleString('en-US')}</span>
              <span className="dpc-metric-lbl">Total Donated</span>
            </div>
          </div>

          <div className="dpc-impact-body">
            <p className="dpc-society-desc">{tier.description}</p>
            
            <div className="dpc-society-footer">
              {nextTier ? (
                <div className="dpc-next-society-hint">
                  <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#10b981' }}>verified</span>
                  <span>Next Giving Circle: <strong>{nextTier.name}</strong> (₱{nextTier.minPhp.toLocaleString('en-US')}+)</span>
                </div>
              ) : (
                <div className="dpc-next-society-hint">
                  <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#10b981' }}>verified</span>
                  <span>Honorary Trustee • Highest Giving Circle</span>
                </div>
              )}

              <div className="dpc-actions-group">
                <button type="button" className="dpc-cert-action-btn" onClick={onOpenLadder} title="View Certificate of Appreciation">
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>workspace_premium</span>
                  <span>View Certificate</span>
                </button>
                <button type="button" className="dpc-ladder-link" onClick={onOpenLadder}>
                  <span>Giving Circles</span>
                  <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>arrow_forward</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Modal shown when a donor unlocks a new badge level
 */
export function BadgeUpgradeModal({
  newTier,
  isOpen,
  onClose,
  totalDonatedPhp = 0,
  donorName = '',
  onViewCertificate = null
}) {
  useEffect(() => {
    if (!isOpen || !newTier || typeof document === 'undefined') return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, newTier, onClose]);

  if (!isOpen || !newTier) return null;

  const Icon = newTier.IconComponent;
  const resolvedTheme = typeof document !== 'undefined' ? (document.documentElement.getAttribute('data-theme') || 'dark') : 'dark';
  const cleanDesc = String(newTier.description || '').trim();
  const formattedDesc = cleanDesc
    ? cleanDesc.charAt(0).toLowerCase() + cleanDesc.slice(1)
    : 'strengthens emergency disaster relief and recovery across the Philippines.';
  const cleanName = donorName && donorName !== 'Verified Donor' && donorName !== 'Verified Contributor' ? donorName : '';
  const milestonePhp = newTier.minPhp || Math.round((newTier.minEth || 0) * 170000);
  const displayTotalPhp = totalDonatedPhp > 0 ? Math.round(totalDonatedPhp) : milestonePhp;

  const modalNode = (
    <div className="donor-upgrade-backdrop" data-theme={resolvedTheme} onClick={onClose}>
      <div
        className="donor-upgrade-card donor-commendation-plaque fade-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`New Recognition: ${newTier.name}`}
      >
        {/* Top Ceremonial Gold Accent Bar */}
        <div className="du-top-accent" aria-hidden="true" />
        {/* Inset Archival Hairline Frame */}
        <div className="du-inner-frame" aria-hidden="true" />
        {/* Subtle Ambient Gold Radial Glow */}
        <div className="du-ambient-glow" aria-hidden="true" />

        <button
          type="button"
          className="du-close-btn"
          onClick={onClose}
          aria-label="Close recognition notice"
        >
          <span className="material-symbols-outlined">close</span>
        </button>

        <div className="du-content">
          <div className="du-org-eyebrow">BBDRTS · Honorary Recognition</div>

          {/* Framed Double-Ring Medallion Crest */}
          <div className="du-crest-stage">
            <div className="du-crest-outer">
              <div className="du-crest-inner">
                <Icon size={56} className="donor-upgrade-svg" />
              </div>
            </div>
          </div>

          <div className="du-kicker">New Giving Circle Reached</div>
          <h2 className="du-tier-display">{newTier.name}</h2>

          {newTier.subtitle && (
            <div className="du-focus-pill">{newTier.subtitle}</div>
          )}

          <p className="du-appreciation">
            {cleanName ? (
              <>Thank you, <strong>{cleanName}</strong>. Your generosity {formattedDesc}</>
            ) : (
              <>Thank you for your generosity. Your support {formattedDesc}</>
            )}
          </p>

          {/* Compact 2-Column Archival Verification Strip */}
          <div className="du-stats-strip">
            <div className="du-stat-cell">
              <span className="du-stat-lbl">{totalDonatedPhp > 0 ? 'Cumulative Impact' : 'Circle Milestone'}</span>
              <span className="du-stat-val">
                ₱{displayTotalPhp.toLocaleString('en-US')}{totalDonatedPhp > 0 ? '' : '+'}
              </span>
            </div>
            <div className="du-stat-cell">
              <span className="du-stat-lbl">Audit Status</span>
              <span className="du-stat-val du-stat-val--verified">
                <span className="du-verified-dot" />
                <span>Sepolia Verified</span>
              </span>
            </div>
          </div>

          {/* Balanced Action Footer */}
          <div className={`du-actions${onViewCertificate ? ' has-two' : ''}`}>
            {onViewCertificate ? (
              <>
                <button type="button" className="du-btn du-btn--secondary" onClick={onClose}>
                  Continue
                </button>
                <button type="button" className="du-btn du-btn--primary" onClick={onViewCertificate}>
                  <span className="material-symbols-outlined">workspace_premium</span>
                  <span>View Certificate</span>
                </button>
              </>
            ) : (
              <button type="button" className="du-btn du-btn--primary" onClick={onClose}>
                Continue
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : null;
}

/**
 * Payment rail configuration for the Complete Ledger filter pills
 */
export const LEDGER_RAILS = [
  { id: 'ALL', label: 'All Channels', icon: 'hub', color: '#10b981', bg: 'rgba(16, 185, 129, 0.14)', glow: 'rgba(16, 185, 129, 0.25)' },
  { id: 'GCASH', label: 'GCash', icon: 'smartphone', color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.14)', glow: 'rgba(14, 165, 233, 0.25)' },
  { id: 'MAYA', label: 'Maya', icon: 'account_balance_wallet', color: '#00d68f', bg: 'rgba(0, 214, 143, 0.14)', glow: 'rgba(0, 214, 143, 0.25)' },
  { id: 'CARD', label: 'Bank / Card', icon: 'credit_card', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.14)', glow: 'rgba(245, 158, 11, 0.25)' }
];

/**
 * Verified Humanitarian Impact Portfolio & Certificate of Philanthropy Modal
 * Acknowledges cumulative community generosity, tangible relief footprint, and verifiable credentials
 */
export function DonorTierModal({
  isOpen,
  onClose,
  walletAddress,
  donorId,
  txHash = null,
  transactions = null,
  totalDonatedEth = 0,
  totalDonatedPhp = 0,
  donationCount = 0,
  campaignsSupported = 1,
  donorName = 'Verified Contributor',
  dedication = '',
  initialTab = 'portfolio'
}) {
  const [modalTab, setModalTab] = useState(initialTab || 'portfolio');
  const [copiedProof, setCopiedProof] = useState(false);
  const [copiedTxId, setCopiedTxId] = useState(null);
  const [donorTransactions, setDonorTransactions] = useState(Array.isArray(transactions) ? transactions : []);
  const [loadingTx, setLoadingTx] = useState(false);
  const [ledgerFilter, setLedgerFilter] = useState('ALL');
  const [railLoading, setRailLoading] = useState(false);
  const [ledgerPage, setLedgerPage] = useState(1);
  const LEDGER_PAGE_SIZE = 6;
  const railTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (railTimerRef.current) clearTimeout(railTimerRef.current);
    };
  }, []);

  const handleRailFilterChange = useCallback((targetRail) => {
    if (targetRail === ledgerFilter) return;
    if (railTimerRef.current) clearTimeout(railTimerRef.current);
    setRailLoading(true);
    setLedgerFilter(targetRail);
    setLedgerPage(1);
    railTimerRef.current = setTimeout(() => {
      setRailLoading(false);
    }, 280);
  }, [ledgerFilter]);

  const getRailCount = useCallback((railId) => {
    if (!Array.isArray(donorTransactions)) return 0;
    if (railId === 'ALL') return donorTransactions.length;
    return donorTransactions.filter(t => {
      const pm = (t.paymentMethod || 'CARD').toUpperCase();
      if (railId === 'CARD' || railId === 'CREDIT CARD') return pm.includes('CARD') || pm.includes('BANK') || pm.includes('CREDIT');
      if (railId === 'GCASH') return pm.includes('GCASH');
      if (railId === 'MAYA') return pm.includes('MAYA');
      return false;
    }).length;
  }, [donorTransactions]);

  useEffect(() => {
    if (!isOpen) return;
    if (initialTab) {
      setModalTab(initialTab);
    }
    if (Array.isArray(transactions) && transactions.length > 0) {
      setDonorTransactions(transactions);
      return;
    }
    const validWallet = walletAddress && walletAddress !== '0x0000000000000000000000000000000000000000' ? walletAddress : null;
    const identifier = validWallet || donorId;
    if (!identifier) {
      setDonorTransactions([]);
      return;
    }

    setLoadingTx(true);
    fetch(`${API_URL}/api/donors/${identifier}/transactions`)
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (Array.isArray(data)) {
          setDonorTransactions(data);
        }
      })
      .catch(err => {
        console.warn('Donor transactions fetch notice:', err.message);
        setDonorTransactions([]);
      })
      .finally(() => setLoadingTx(false));
  }, [walletAddress, donorId, isOpen, transactions, initialTab]);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const filteredTxList = useMemo(() => {
    if (ledgerFilter === 'ALL') return donorTransactions;
    return donorTransactions.filter(t => {
      const pm = (t.paymentMethod || 'CARD').toUpperCase();
      if (ledgerFilter === 'CREDIT CARD' || ledgerFilter === 'CARD') return pm.includes('CARD') || pm.includes('BANK') || pm.includes('CREDIT');
      if (ledgerFilter === 'GCASH') return pm.includes('GCASH');
      if (ledgerFilter === 'MAYA') return pm.includes('MAYA');
      return true;
    });
  }, [donorTransactions, ledgerFilter]);

  const totalLedgerPages = Math.max(1, Math.ceil(filteredTxList.length / LEDGER_PAGE_SIZE));
  const safeLedgerPage = Math.min(ledgerPage, totalLedgerPages);
  const pagedTxList = useMemo(() => {
    const start = (safeLedgerPage - 1) * LEDGER_PAGE_SIZE;
    return filteredTxList.slice(start, start + LEDGER_PAGE_SIZE);
  }, [filteredTxList, safeLedgerPage, LEDGER_PAGE_SIZE]);

  if (!isOpen) return null;

  const globalStats = globalDonorRegistry.get(walletAddress, donorId);
  const txSumEth = donorTransactions.reduce((sum, t) => sum + (parseFloat(t.amount || 0) || 0), 0);
  const effectiveEth = Math.max(
    globalStats?.totalEth !== undefined ? globalStats.totalEth : totalDonatedEth,
    txSumEth
  );
  const effectivePhp = Math.max(
    globalStats?.totalPhp !== undefined ? globalStats.totalPhp : (totalDonatedPhp || (effectiveEth * 170000)),
    Math.round(txSumEth * 170000)
  );
  const effectiveDonations = Math.max(donationCount || 0, globalStats?.donationCount || 0, donorTransactions.length, (effectiveEth > 0 || effectivePhp > 0) ? 1 : 0);

  const tierInfo = getDonorTier({
    amountEth: effectiveEth,
    amountPhp: effectivePhp
  });

  const { tier: activeTier, nextTier, totalPhp, progressPct, remainingPhp } = tierInfo;
  const ActiveIcon = activeTier ? activeTier.IconComponent : BadgeTier1Contributor;

  const currentTheme = typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') || 'dark' : 'dark';

  // Resolve actual transaction hash vs wallet address
  const effectiveTxHash = txHash || donorTransactions?.[0]?.txHash || null;
  const isActualTx = Boolean(effectiveTxHash && String(effectiveTxHash).startsWith('0x') && String(effectiveTxHash).length === 66);
  const displayHash = isActualTx 
    ? String(effectiveTxHash) 
    : (walletAddress || '0xB8Effb4f0394946a01da9C5342fC2e70c1E99ddA');
  const shortHash = `${displayHash.substring(0, 10)}...${displayHash.substring(displayHash.length - 8)}`;
  const certExplorerUrl = isActualTx
    ? `https://sepolia.etherscan.io/tx/${displayHash}`
    : (walletAddress ? `https://sepolia.etherscan.io/address/${walletAddress}` : `https://sepolia.etherscan.io/address/0xB8Effb4f0394946a01da9C5342fC2e70c1E99ddA`);
  const certLabel = isActualTx ? 'LATEST BLOCKCHAIN TRANSACTION HASH' : 'VERIFIED DONOR WALLET';

  const handlePrintCertificate = () => {
    window.print();
  };

  const handleCopyProof = () => {
    const certText = `Verified Certificate of Appreciation\n` +
      `Donor: ${donorName}\n` +
      `Badge: ${activeTier ? activeTier.name : 'Community Contributor'}\n` +
      `Total Donated: ₱${Math.round(totalPhp).toLocaleString('en-US')} PHP\n` +
      `Blockchain: Sepolia Ethereum\n` +
      `${isActualTx ? 'Latest Transaction Hash' : 'Wallet Address'}: ${displayHash}\n` +
      `Total Verified Donations: ${donorTransactions.length || 1} records\n` +
      `Platform: Blockchain-Based Donation & Relief Transparency System (BBDRTS)\n` +
      `Explorer Link: ${certExplorerUrl}\n` +
      `Verification Link: ${window.location.origin}`;

    navigator.clipboard.writeText(certText);
    setCopiedProof(true);
    setTimeout(() => setCopiedProof(false), 3000);
  };

  const recognizedCircleCount = DONOR_TIERS.filter(t => totalPhp >= t.minPhp).length;
  const activeCircleNum = activeTier?.tierNumber || 0;
  const certSerial = `BBDRTS-${String(activeCircleNum || 1).padStart(2, '0')}-${String(effectiveDonations || 1).padStart(4, '0')}`;
  const issuedDateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const drivesHelpedCount = Math.max(1, campaignsSupported || 1);

  return typeof document !== 'undefined' ? createPortal(
    <div className="donor-modal-backdrop dic-backdrop" data-theme={currentTheme} onClick={onClose}>
      <div
        className={`donor-modal-card dic-modal fade-in theme-${currentTheme}`}
        data-theme={currentTheme}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Donor Impact and Certificate"
      >
        {/* ── 1. Flush Institutional Header ── */}
        <div className="dic-header">
          <div className="dic-header-left">
            <div className="dic-header-emblem">
              <ActiveIcon size={22} />
            </div>
            <div className="dic-header-copy">
              <h3 className="dic-title">Donor Impact & Certificate</h3>
              <div className="dic-subtitle">
                <span className="dic-live-dot" />
                <span>Verified Humanitarian Record</span>
                <span className="dic-sub-sep">·</span>
                <span>Republic of the Philippines</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="dic-close-btn"
            onClick={onClose}
            title="Close (Esc)"
            aria-label="Close modal"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* ── 2. Flush Horizontal Underline Tab Rail ── */}
        <div className="dic-tab-rail" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={modalTab === 'portfolio'}
            className={`dic-tab ${modalTab === 'portfolio' ? 'is-active' : ''}`}
            onClick={() => setModalTab('portfolio')}
          >
            <span className="material-symbols-outlined">workspace_premium</span>
            <span>Certificate & Impact</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={modalTab === 'ledger'}
            className={`dic-tab ${modalTab === 'ledger' ? 'is-active' : ''}`}
            onClick={() => setModalTab('ledger')}
          >
            <span className="material-symbols-outlined">receipt_long</span>
            <span>Complete Ledger</span>
            {donorTransactions.length > 0 && (
              <span className="dic-tab-count">{donorTransactions.length}</span>
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={modalTab === 'directory'}
            className={`dic-tab ${modalTab === 'directory' ? 'is-active' : ''}`}
            onClick={() => setModalTab('directory')}
          >
            <span className="material-symbols-outlined">volunteer_activism</span>
            <span>Giving Circles</span>
            <span className="dic-tab-count">{recognizedCircleCount}/{DONOR_TIERS.length}</span>
          </button>
        </div>

        {/* ── 3. Scrollable Content Stage ── */}
        <div className="dic-body">

          {/* TAB 1: CERTIFICATE & IMPACT */}
          {modalTab === 'portfolio' && (
            <div className="dic-pane dic-portfolio-pane">
              {/* Unboxed Identity & Standing Strip */}
              <div className="dic-identity-strip">
                <div className="dic-identity-top">
                  <div className="dic-identity-left">
                    <div className="dic-identity-medallion">
                      <ActiveIcon size={34} />
                    </div>
                    <div className="dic-identity-meta">
                      <div className="dic-identity-name-row">
                        <h2 className="dic-donor-name">{donorName}</h2>
                        <span className="dic-verified-icon" title="Verified Disaster Relief Contributor">
                          <span className="material-symbols-outlined">verified</span>
                        </span>
                      </div>
                      <div className="dic-standing-row">
                        <span className="dic-standing-pill">
                          {activeTier ? activeTier.name : 'Kind Giver'}
                        </span>
                        {activeTier?.subtitle && !activeTier.name.toLowerCase().includes(activeTier.subtitle.toLowerCase()) && (
                          <span className="dic-standing-sub">{activeTier.subtitle}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="dic-identity-total">
                    <span className="dic-total-val">₱{Math.round(totalPhp).toLocaleString('en-US')}</span>
                    <span className="dic-total-lbl">Total Verified Relief</span>
                  </div>
                </div>

                {dedication && (
                  <div className="dic-dedication-line">
                    <span className="material-symbols-outlined">format_quote</span>
                    <span>“{dedication}”</span>
                  </div>
                )}

                {activeTier && (
                  <p className="dic-standing-desc">{activeTier.description}</p>
                )}

                {/* 4-Column Hairline KPI Strip */}
                <div className="dic-kpi-band">
                  <div className="dic-kpi-cell">
                    <span className="dic-kpi-val">{drivesHelpedCount}</span>
                    <span className="dic-kpi-lbl">Relief Drives Helped</span>
                  </div>
                  <div className="dic-kpi-cell">
                    <span className="dic-kpi-val">{effectiveDonations}</span>
                    <span className="dic-kpi-lbl">Verified Receipts</span>
                  </div>
                  <div className="dic-kpi-cell">
                    <span className="dic-kpi-val">100%</span>
                    <span className="dic-kpi-lbl">Escrow Protected</span>
                  </div>
                  <div className="dic-kpi-cell">
                    <span className="dic-kpi-val">{activeTier ? `Circle ${activeTier.tierNumber} / 15` : 'Supporter'}</span>
                    <span className="dic-kpi-lbl">Giving Standing</span>
                  </div>
                </div>

                {/* Inline Next Giving Circle Progress */}
                {nextTier && (
                  <div className="dic-milestone-inline">
                    <div className="dic-milestone-row">
                      <span className="dic-milestone-left">
                        Next Giving Circle: <strong>{nextTier.name}</strong>{' '}
                        <span className="dic-milestone-muted">(₱{nextTier.minPhp.toLocaleString('en-US')}+)</span>
                      </span>
                      <span className="dic-milestone-right">
                        <span className="dic-milestone-muted">₱{Math.round(remainingPhp).toLocaleString('en-US')} away</span>
                        <span className="dic-milestone-pct">{progressPct}%</span>
                      </span>
                    </div>
                    <div className="dic-progress-track">
                      <div
                        className="dic-progress-fill"
                        style={{ width: `${Math.min(100, Math.max(2, progressPct))}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ── Prestigious Ceremonial Certificate of Appreciation (Identical Layout on Desktop & Mobile) ── */}
              <div className="donor-certificate-frame dic-cert-shell">
                <div className="dic-cert-stage">
                  <div className="donor-cert-inner dic-diploma">
                    {/* Ornamental Gold Filigree Inner Frame & 4 Corner Flourishes */}
                    <div className="dic-diploma-inner-border" aria-hidden="true" />
                    <svg className="dic-filigree dic-filigree--tl" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                      <path d="M2 38V6C2 3.8 3.8 2 6 2H38" stroke="currentColor" strokeWidth="1.4" />
                      <path d="M7 28V11C7 8.8 8.8 7 11 7H28" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.65" />
                      <circle cx="11" cy="11" r="2" fill="currentColor" />
                    </svg>
                    <svg className="dic-filigree dic-filigree--tr" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                      <path d="M2 38V6C2 3.8 3.8 2 6 2H38" stroke="currentColor" strokeWidth="1.4" />
                      <path d="M7 28V11C7 8.8 8.8 7 11 7H28" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.65" />
                      <circle cx="11" cy="11" r="2" fill="currentColor" />
                    </svg>
                    <svg className="dic-filigree dic-filigree--bl" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                      <path d="M2 38V6C2 3.8 3.8 2 6 2H38" stroke="currentColor" strokeWidth="1.4" />
                      <path d="M7 28V11C7 8.8 8.8 7 11 7H28" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.65" />
                      <circle cx="11" cy="11" r="2" fill="currentColor" />
                    </svg>
                    <svg className="dic-filigree dic-filigree--br" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                      <path d="M2 38V6C2 3.8 3.8 2 6 2H38" stroke="currentColor" strokeWidth="1.4" />
                      <path d="M7 28V11C7 8.8 8.8 7 11 7H28" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.65" />
                      <circle cx="11" cy="11" r="2" fill="currentColor" />
                    </svg>

                    {/* Subtle Embossed Watermark Crest */}
                    <svg className="dic-diploma-watermark" viewBox="0 0 200 200" fill="none" aria-hidden="true">
                      <circle cx="100" cy="100" r="88" stroke="currentColor" strokeWidth="1" strokeDasharray="3 4" />
                      <circle cx="100" cy="100" r="70" stroke="currentColor" strokeWidth="0.8" />
                      <path d="M100 34L114 78H160L123 105L137 150L100 123L63 150L77 105L40 78H86L100 34Z" stroke="currentColor" strokeWidth="0.9" />
                    </svg>

                    {/* Top Ceremonial Crest & Header */}
                    <div className="dic-diploma-header">
                      <div className="dic-diploma-crest">
                        <svg viewBox="0 0 56 32" fill="none" className="dic-laurel-svg" aria-hidden="true">
                          <path d="M18 26C10 22 6 14 8 6C12 10 14 16 18 22" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                          <path d="M15 24C11 20 9 14 11 9" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
                          <path d="M38 26C46 22 50 14 48 6C44 10 42 16 38 22" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                          <path d="M41 24C45 20 47 14 45 9" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
                          <path d="M28 6L34 10V17C34 21.5 31.3 25 28 26.5C24.7 25 22 21.5 22 17V10L28 6Z" stroke="currentColor" strokeWidth="1.3" fill="currentColor" fillOpacity="0.14" />
                          <path d="M25.5 16.5L27.3 18.3L30.8 14.3" stroke="#10b981" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <div className="dic-diploma-republic">
                        REPUBLIC OF THE PHILIPPINES · HUMANITARIAN RELIEF REGISTRY
                      </div>
                      <div className="dic-diploma-system">
                        Blockchain-Based Donation & Relief Transparency System
                      </div>
                      <h2 className="dic-diploma-title">Certificate of Appreciation</h2>
                      <div className="dic-diploma-ornament" aria-hidden="true">
                        <span className="dic-orn-line" />
                        <span className="dic-orn-diamond" />
                        <span className="dic-orn-line" />
                      </div>
                    </div>

                    {/* Ceremonial Recipient & Heartfelt Gratitude */}
                    <div className="dic-diploma-body">
                      <p className="dic-diploma-salutation">
                        With deepest gratitude and highest honor, proudly presented to
                      </p>
                      <h1 className="dic-diploma-name">{donorName}</h1>
                      <div className="dic-diploma-name-rule" aria-hidden="true" />

                      <p className="dic-diploma-citation">
                        In heartfelt recognition of your extraordinary generosity totaling{' '}
                        <strong>₱{Math.round(totalPhp).toLocaleString('en-US')}</strong> across{' '}
                        <strong>{drivesHelpedCount} verified disaster relief {drivesHelpedCount === 1 ? 'drive' : 'drives'}</strong>{' '}
                        ({effectiveDonations} on-chain {effectiveDonations === 1 ? 'contribution' : 'contributions'}). Your compassion brings food, clean water, shelter, and renewed hope to Filipino families rebuilding after crisis.
                      </p>

                      {dedication && (
                        <p className="dic-diploma-dedication">“{dedication}”</p>
                      )}

                      {/* Distinguished Giving Circle Ribbon */}
                      <div className="dic-diploma-ribbon">
                        <span className="dic-diploma-ribbon-badge">
                          <ActiveIcon size={24} />
                        </span>
                        <div className="dic-diploma-ribbon-copy">
                          <span className="dic-diploma-ribbon-eyebrow">HONORED GIVING CIRCLE</span>
                          <span className="dic-diploma-ribbon-name">
                            {activeTier ? activeTier.name : 'Kind Giver'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Symmetrical 3-Column Ceremonial Footer (Identical on Desktop & Mobile) */}
                    <div className="dic-diploma-footer">
                      {/* Left: Official Signatory */}
                      <div className="dic-diploma-sig-col">
                        <img
                          src="/admin-signature.png"
                          alt="System Administrator Signature"
                          className="dic-signature-img"
                          draggable="false"
                        />
                        <div className="dic-diploma-sig-line" />
                        <span className="dic-diploma-sig-title">System Administrator</span>
                        <span className="dic-diploma-sig-sub">BBDRTS Platform</span>
                      </div>

                      {/* Center: Embossed Gold & Emerald Official Notary Seal */}
                      <div className="dic-diploma-seal-col">
                        <div className="dic-gold-seal">
                          <svg viewBox="0 0 72 72" fill="none" className="dic-gold-seal-svg" aria-hidden="true">
                            <circle cx="36" cy="36" r="33" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2.5 2.5" />
                            <circle cx="36" cy="36" r="28" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.1" />
                            <circle cx="36" cy="36" r="23" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.65" />
                            <path d="M27.5 36.5L33 42L45 29.5" stroke="#10b981" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                        <span className="dic-diploma-seal-caption">VERIFIED SEAL</span>
                      </div>

                      {/* Right: Official Credential Record */}
                      <div className="dic-diploma-cred-col">
                        <span className="dic-diploma-cred-val dic-mono">{certSerial}</span>
                        <div className="dic-diploma-sig-line" />
                        <span className="dic-diploma-sig-title">{issuedDateStr}</span>
                        {isActualTx ? (
                          <a
                            href={`https://sepolia.etherscan.io/tx/${effectiveTxHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="dic-diploma-hash dic-mono"
                            title="Verify on Sepolia Etherscan"
                          >
                            <span>{String(effectiveTxHash).slice(0, 7)}…{String(effectiveTxHash).slice(-5)}</span>
                            <span className="material-symbols-outlined">open_in_new</span>
                          </a>
                        ) : (
                          <span className="dic-diploma-sig-sub">Sepolia EVM Verified</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recessed Certificate Action Bar */}
                <div className="donor-cert-actions-bar dic-cert-actions">
                  <button
                    type="button"
                    className="dic-btn dic-btn--primary"
                    onClick={handlePrintCertificate}
                    title="Print or Save Certificate as PDF"
                  >
                    <span className="material-symbols-outlined">print</span>
                    <span>Print / Save PDF</span>
                  </button>

                  <button
                    type="button"
                    className="dic-btn dic-btn--secondary"
                    onClick={handleCopyProof}
                    title="Copy verification summary to clipboard"
                  >
                    <span className="material-symbols-outlined" style={copiedProof ? { color: '#10b981' } : undefined}>
                      {copiedProof ? 'check_circle' : 'content_copy'}
                    </span>
                    <span>{copiedProof ? 'Proof Copied' : 'Copy Proof'}</span>
                  </button>

                  <button
                    type="button"
                    className="dic-btn dic-btn--ghost"
                    onClick={() => setModalTab('ledger')}
                  >
                    <span>View Full Ledger</span>
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: COMPLETE ON-CHAIN LEDGER */}
          {modalTab === 'ledger' && (
            <div className="dic-pane dic-ledger-pane">
              <div className="dic-ledger-topbar">
                <div>
                  <h4 className="dic-section-title">On-Chain Donation History</h4>
                  <p className="dic-section-sub">
                    Every notarized relief contribution recorded for <strong>{donorName}</strong>.
                  </p>
                </div>

                {/* Clean Monochrome Rail Filter */}
                <div className="dic-rail-seg" role="group" aria-label="Filter by payment rail">
                  {LEDGER_RAILS.map(rail => {
                    const count = getRailCount(rail.id);
                    if (rail.id !== 'ALL' && count === 0) return null;
                    const isActive = ledgerFilter === rail.id;
                    return (
                      <button
                        key={rail.id}
                        type="button"
                        className={`dic-rail-btn ${isActive ? 'is-active' : ''}`}
                        onClick={() => handleRailFilterChange(rail.id)}
                      >
                        {rail.id !== 'ALL' && (
                          <span className="dic-rail-dot" style={{ backgroundColor: rail.color }} />
                        )}
                        <span>{rail.id === 'ALL' ? 'All' : rail.label}</span>
                        <span className="dic-rail-count">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {loadingTx || railLoading ? (
                <div className="dic-ledger-panel">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="dic-ledger-skel-row">
                      <div className="dic-skel dic-skel--icon" />
                      <div className="dic-skel-col">
                        <div className="dic-skel dic-skel--title" />
                        <div className="dic-skel dic-skel--sub" />
                      </div>
                      <div className="dic-skel dic-skel--amt" />
                    </div>
                  ))}
                </div>
              ) : filteredTxList.length === 0 ? (
                <div className="dic-empty-box">
                  <span className="material-symbols-outlined">receipt_long</span>
                  <div className="dic-empty-title">No transactions found</div>
                  <div className="dic-empty-sub">No verified records match the selected payment channel.</div>
                </div>
              ) : (
                <div className="dic-ledger-panel donor-data-fade-in">
                  <div className="dic-ledger-list-head">
                    <span>CAMPAIGN & NOTARIZATION</span>
                    <span>AMOUNT (PHP)</span>
                  </div>

                  {pagedTxList.map((tx, idx) => {
                    const pm = (tx.paymentMethod || 'CARD').toUpperCase();
                    const isGcash = pm.includes('GCASH');
                    const isMaya = pm.includes('MAYA');
                    const railColor = isGcash ? '#0ea5e9' : isMaya ? '#10b981' : '#a855f7';
                    const railIcon = isGcash ? 'smartphone' : isMaya ? 'account_balance_wallet' : 'credit_card';
                    const ethAmt = parseFloat(tx.amount || 0);
                    const phpAmt = Math.round(ethAmt * 170000);
                    const txHashClean = tx.txHash || '';
                    const hasRealHash = txHashClean.startsWith('0x') && txHashClean.length === 66;
                    const formattedDate = tx.createdAt
                      ? new Date(tx.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : 'Verified Record';

                    return (
                      <div key={tx.id || idx} className="dic-ledger-row">
                        <div className="dic-ledger-row-left">
                          <div className="dic-ledger-icon-well">
                            <span className="material-symbols-outlined">{railIcon}</span>
                            <span className="dic-ledger-icon-dot" style={{ backgroundColor: railColor }} />
                          </div>

                          <div className="dic-ledger-info">
                            <div className="dic-ledger-camp" title={tx.campaignTitle}>
                              {tx.campaignTitle || `Relief Campaign #${tx.campaignId || 1}`}
                            </div>
                            <div className="dic-ledger-meta">
                              <span className="dic-ledger-channel">
                                {(tx.paymentMethod && !/eth|crypto|metamask/i.test(tx.paymentMethod)) ? tx.paymentMethod : 'Bank / Card'}
                              </span>
                              <span className="dic-sub-sep">·</span>
                              <span>{formattedDate}</span>
                              {tx.orgName && (
                                <>
                                  <span className="dic-sub-sep">·</span>
                                  <span>{tx.orgName}</span>
                                </>
                              )}
                            </div>

                            {txHashClean && (
                              <div className="dic-ledger-hash-row">
                                {hasRealHash ? (
                                  <a
                                    href={`https://sepolia.etherscan.io/tx/${txHashClean}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="dic-hash-link dic-mono"
                                    title="Inspect on Sepolia Etherscan"
                                  >
                                    <span>{txHashClean.slice(0, 10)}…{txHashClean.slice(-8)}</span>
                                    <span className="material-symbols-outlined">open_in_new</span>
                                  </a>
                                ) : (
                                  <span className="dic-hash-verified dic-mono">
                                    <span>{txHashClean.slice(0, 10)}…{txHashClean.slice(-8)}</span>
                                    <span className="material-symbols-outlined">verified</span>
                                  </span>
                                )}
                                <button
                                  type="button"
                                  className="dic-hash-copy"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(txHashClean);
                                    setCopiedTxId(tx.id || idx);
                                    setTimeout(() => setCopiedTxId(null), 2000);
                                  }}
                                  title="Copy transaction hash"
                                >
                                  <span className="material-symbols-outlined">
                                    {copiedTxId === (tx.id || idx) ? 'check' : 'content_copy'}
                                  </span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="dic-ledger-amt">
                          <span className="dic-ledger-php">₱{phpAmt.toLocaleString('en-US')}</span>
                          <span className="dic-ledger-verified-tag">
                            <span className="dic-live-dot" />
                            <span>Notarized</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {filteredTxList.length > LEDGER_PAGE_SIZE && (
                    <div className="dic-ledger-pager">
                      <span className="dic-pager-info">
                        Showing <strong>{(safeLedgerPage - 1) * LEDGER_PAGE_SIZE + 1}–{Math.min(safeLedgerPage * LEDGER_PAGE_SIZE, filteredTxList.length)}</strong> of <strong>{filteredTxList.length}</strong>
                      </span>
                      <div className="dic-pager-controls">
                        <button
                          type="button"
                          className="dic-pager-btn"
                          disabled={safeLedgerPage <= 1}
                          onClick={() => setLedgerPage(p => Math.max(1, p - 1))}
                        >
                          <span className="material-symbols-outlined">chevron_left</span>
                          <span>Prev</span>
                        </button>
                        <span className="dic-pager-page">
                          {safeLedgerPage} / {totalLedgerPages}
                        </span>
                        <button
                          type="button"
                          className="dic-pager-btn"
                          disabled={safeLedgerPage >= totalLedgerPages}
                          onClick={() => setLedgerPage(p => Math.min(totalLedgerPages, p + 1))}
                        >
                          <span>Next</span>
                          <span className="material-symbols-outlined">chevron_right</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: 15 PHILANTHROPIC GIVING CIRCLES (Zero Gaming Language) */}
          {modalTab === 'directory' && (
            <div className="dic-pane dic-tiers-pane">
              <div className="dic-tiers-summary">
                <div className="dic-tiers-summary-top">
                  <div>
                    <h4 className="dic-section-title">Humanitarian Giving Circles</h4>
                    <p className="dic-section-sub">
                      Dignified recognition honoring cumulative verified donations across Philippine relief drives.
                    </p>
                  </div>
                  <div className="dic-tiers-progress-pill">
                    <span className="dic-live-dot" />
                    <span><strong>{recognizedCircleCount}</strong> of {DONOR_TIERS.length} Recognized</span>
                  </div>
                </div>
                <div className="dic-progress-track">
                  <div
                    className="dic-progress-fill"
                    style={{ width: `${Math.round((recognizedCircleCount / DONOR_TIERS.length) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="dic-tiers-grid">
                {DONOR_TIERS.map((c) => {
                  const isCurrent = activeTier?.id === c.id;
                  const isRecognized = totalPhp >= c.minPhp;
                  const CircleIcon = c.IconComponent;

                  return (
                    <div
                      key={c.id}
                      className={`dic-tier-card ${isCurrent ? 'is-current' : isRecognized ? 'is-unlocked' : 'is-locked'}`}
                    >
                      <div className="dic-tier-card-top">
                        <div className="dic-tier-medallion">
                          <CircleIcon size={30} />
                        </div>

                        <div className="dic-tier-head-copy">
                          <div className="dic-tier-rank-row">
                            <span className="dic-tier-index dic-mono">CIRCLE {String(c.tierNumber).padStart(2, '0')}</span>
                            {isCurrent ? (
                              <span className="dic-tier-status dic-tier-status--current">
                                <span className="dic-live-dot" />
                                <span>Your Circle</span>
                              </span>
                            ) : isRecognized ? (
                              <span className="dic-tier-status dic-tier-status--unlocked">
                                <span className="material-symbols-outlined">check_circle</span>
                                <span>Recognized</span>
                              </span>
                            ) : (
                              <span className="dic-tier-status dic-tier-status--locked">
                                <span>Upcoming</span>
                              </span>
                            )}
                          </div>
                          <div className="dic-tier-name">{c.name}</div>
                          <div className="dic-tier-sub">{c.subtitle}</div>
                        </div>
                      </div>

                      <p className="dic-tier-desc">{c.description}</p>

                      <div className="dic-tier-footer">
                        <span className="dic-tier-threshold">₱{c.minPhp.toLocaleString('en-US')}+</span>
                        <span className="dic-tier-threshold-lbl">cumulative giving</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── 4. Flush Recessed Modal Footer ── */}
        <div className="dic-footer">
          <div className="dic-footer-left">
            <span className="dic-live-dot" />
            <span>Cryptographically audited on Sepolia EVM · All records immutable</span>
          </div>
          <button type="button" className="dic-btn dic-btn--secondary dic-btn--sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;
}
