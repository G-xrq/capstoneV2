import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { API_URL } from '../config';
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
 * 15 Dignified Humanitarian Recognition Societies strictly based on cumulative donations across all campaigns
 */
export const DONOR_TIERS = [
  {
    tierNumber: 1,
    id: 'tier-1',
    name: 'Community Supporter Circle',
    subtitle: 'Supporter Member',
    minPhp: 1,
    minEth: 0.000006,
    IconComponent: BadgeTier1Contributor,
    color: '#10b981',
    border: 'rgba(16, 185, 129, 0.35)',
    bg: 'rgba(16, 185, 129, 0.08)',
    badgeClass: 'tier-1',
    description: 'Helps provide immediate emergency food packs and clean water to families in need.'
  },
  {
    tierNumber: 2,
    id: 'tier-2',
    name: 'Relief Sustainer Society',
    subtitle: 'Sustaining Member',
    minPhp: 1000,
    minEth: 0.006,
    IconComponent: BadgeTier2Supporter,
    color: '#0284c7',
    border: 'rgba(2, 132, 199, 0.35)',
    bg: 'rgba(2, 132, 199, 0.08)',
    badgeClass: 'tier-2',
    description: 'Helps provide food packs, drinking water, and hygiene supplies.'
  },
  {
    tierNumber: 3,
    id: 'tier-3',
    name: 'Frontline Partner Council',
    subtitle: 'Partner Member',
    minPhp: 5000,
    minEth: 0.03,
    IconComponent: BadgeTier3ReliefPartner,
    color: '#2563eb',
    border: 'rgba(37, 99, 235, 0.35)',
    bg: 'rgba(37, 99, 235, 0.08)',
    badgeClass: 'tier-3',
    description: 'Helps equip volunteer rescue teams and provide first-aid supplies.'
  },
  {
    tierNumber: 4,
    id: 'tier-4',
    name: 'Shelter Benefactors Circle',
    subtitle: 'Benefactor Member',
    minPhp: 10000,
    minEth: 0.06,
    IconComponent: BadgeTier4Benefactor,
    color: '#7c3aed',
    border: 'rgba(124, 58, 237, 0.35)',
    bg: 'rgba(124, 58, 237, 0.08)',
    badgeClass: 'tier-4',
    description: 'Helps provide emergency tents and shelter materials for displaced families.'
  },
  {
    tierNumber: 5,
    id: 'tier-5',
    name: 'Humanitarian Advocate Society',
    subtitle: 'Advocate Member',
    minPhp: 25000,
    minEth: 0.15,
    IconComponent: BadgeTier5Advocate,
    color: '#e11d48',
    border: 'rgba(225, 29, 72, 0.35)',
    bg: 'rgba(225, 29, 72, 0.08)',
    badgeClass: 'tier-5',
    description: 'Helps fund medicines, health kits, and emergency medical checkups.'
  },
  {
    tierNumber: 6,
    id: 'tier-6',
    name: 'Philanthropic Partners Circle',
    subtitle: 'Associate Patron',
    minPhp: 50000,
    minEth: 0.30,
    IconComponent: BadgeTier6Philanthropist,
    color: '#d97706',
    border: 'rgba(217, 119, 6, 0.35)',
    bg: 'rgba(217, 119, 6, 0.08)',
    badgeClass: 'tier-6',
    description: 'Helps fund relief drives and support affected barangays.'
  },
  {
    tierNumber: 7,
    id: 'tier-7',
    name: 'Distinguished Humanitarian Society',
    subtitle: 'Distinguished Patron',
    minPhp: 100000,
    minEth: 0.60,
    IconComponent: BadgeTier7Humanitarian,
    color: '#dc2626',
    border: 'rgba(220, 38, 38, 0.35)',
    bg: 'rgba(220, 38, 38, 0.08)',
    badgeClass: 'tier-7',
    description: 'Helps fund major relief missions in disaster-hit areas.'
  },
  {
    tierNumber: 8,
    id: 'tier-8',
    name: 'Pillars of Mercy Fellowship',
    subtitle: 'Senior Fellow',
    minPhp: 250000,
    minEth: 1.50,
    IconComponent: BadgeTier8DistinguishedHumanitarian,
    color: '#0d9488',
    border: 'rgba(13, 148, 136, 0.35)',
    bg: 'rgba(13, 148, 136, 0.08)',
    badgeClass: 'tier-8',
    description: 'Helps deploy clean water filtration and emergency power equipment.'
  },
  {
    tierNumber: 9,
    id: 'tier-9',
    name: 'Patrons of Relief Society',
    subtitle: 'Executive Patron',
    minPhp: 500000,
    minEth: 3.00,
    IconComponent: BadgeTier9PatronOfRelief,
    color: '#1d4ed8',
    border: 'rgba(29, 78, 216, 0.35)',
    bg: 'rgba(29, 78, 216, 0.08)',
    badgeClass: 'tier-9',
    description: 'Helps send bulk food and relief goods to evacuation centers.'
  },
  {
    tierNumber: 10,
    id: 'tier-10',
    name: 'Disaster Relief Leadership Council',
    subtitle: 'Council Member',
    minPhp: 1000000,
    minEth: 6.00,
    IconComponent: BadgeTier10GrandBenefactor,
    color: '#0284c7',
    border: 'rgba(2, 132, 199, 0.4)',
    bg: 'rgba(2, 132, 199, 0.1)',
    badgeClass: 'tier-10',
    description: 'Helps families recover and rebuild communities after major disasters.'
  },
  {
    tierNumber: 11,
    id: 'tier-11',
    name: 'Principal Benefactors Fellowship',
    subtitle: 'Principal Fellow',
    minPhp: 2500000,
    minEth: 15.00,
    IconComponent: BadgeTier11PrincipalBenefactor,
    color: '#7e22ce',
    border: 'rgba(126, 34, 206, 0.4)',
    bg: 'rgba(126, 34, 206, 0.1)',
    badgeClass: 'tier-11',
    description: 'Helps repair schools and build stronger community evacuation centers.'
  },
  {
    tierNumber: 12,
    id: 'tier-12',
    name: 'Legacy Philanthropists Circle',
    subtitle: 'Legacy Fellow',
    minPhp: 5000000,
    minEth: 30.00,
    IconComponent: BadgeTier12LegacyBenefactor,
    color: '#059669',
    border: 'rgba(5, 150, 105, 0.45)',
    bg: 'rgba(5, 150, 105, 0.1)',
    badgeClass: 'tier-12',
    description: 'Helps build safer homes and prepare communities for future disasters.'
  },
  {
    tierNumber: 13,
    id: 'tier-13',
    name: 'Visionary Benefactors Council',
    subtitle: 'Founding Patron',
    minPhp: 10000000,
    minEth: 60.00,
    IconComponent: BadgeTier13SovereignGuardian,
    color: '#16a34a',
    border: 'rgba(22, 163, 74, 0.45)',
    bg: 'rgba(22, 163, 74, 0.1)',
    badgeClass: 'tier-13',
    description: 'Helps fund disaster preparedness and fast relief delivery across islands.'
  },
  {
    tierNumber: 14,
    id: 'tier-14',
    name: 'Distinguished Lifesavers Society',
    subtitle: 'Trustee Fellow',
    minPhp: 25000000,
    minEth: 150.00,
    IconComponent: BadgeTier14ChampionOfHope,
    color: '#b45309',
    border: 'rgba(180, 83, 9, 0.5)',
    bg: 'rgba(180, 83, 9, 0.1)',
    badgeClass: 'tier-14',
    description: 'Provides life-saving support for disaster relief across the nation.'
  },
  {
    tierNumber: 15,
    id: 'tier-15',
    name: 'Honorary Relief Board of Trustees',
    subtitle: 'Honorary Trustee',
    minPhp: 50000000,
    minEth: 300.00,
    IconComponent: BadgeTier15ApexLuminary,
    color: '#475569',
    border: 'rgba(71, 85, 105, 0.5)',
    bg: 'rgba(71, 85, 105, 0.12)',
    badgeClass: 'tier-15',
    description: 'A lasting legacy of helping disaster-hit families across the Philippines.'
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
    const count = Math.max(existing.donationCount || 0, data.donationCount || 0, 1);

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
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/donors/cumulative-totals`);
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
            <span>View Giving Societies</span>
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
        <div className="dpc-badge-col" onClick={onOpenLadder} title="Click to view Giving Societies & Certificate">
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
                  <span>Next Giving Society: <strong>{nextTier.name}</strong> (₱{nextTier.minPhp.toLocaleString('en-US')}+)</span>
                </div>
              ) : (
                <div className="dpc-next-society-hint">
                  <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#10b981' }}>verified</span>
                  <span>Honorary Relief Board of Trustees • Highest Philanthropic Recognition</span>
                </div>
              )}

              <div className="dpc-actions-group">
                <button type="button" className="dpc-cert-action-btn" onClick={onOpenLadder} title="View Certificate of Appreciation">
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>workspace_premium</span>
                  <span>View Certificate</span>
                </button>
                <button type="button" className="dpc-ladder-link" onClick={onOpenLadder}>
                  <span>Giving Societies</span>
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
  totalDonatedPhp = 0
}) {
  useEffect(() => {
    if (!isOpen || !newTier || typeof document === 'undefined') return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, newTier]);

  if (!isOpen || !newTier) return null;

  const Icon = newTier.IconComponent;

  const modalNode = (
    <div className="donor-upgrade-backdrop" onClick={onClose}>
      <div className="donor-upgrade-card donor-commendation-plaque fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="donor-plaque-topbar">
          <span className="donor-plaque-org-tag">PHILIPPINE DISASTER RELIEF TRANSPARENCY NETWORK</span>
        </div>

        <div className="donor-upgrade-emblem-halo" style={{ borderColor: newTier.border }}>
          <Icon size={64} className="donor-upgrade-svg" />
        </div>

        <span className="donor-upgrade-eyebrow" style={{ color: newTier.color }}>
          HONORARY RECOGNITION
        </span>

        <h2 className="donor-upgrade-title">
          New Giving Society Recognized!
        </h2>
        <h3 className="donor-upgrade-tier-name" style={{ color: newTier.color }}>
          {newTier.name}
        </h3>
        <p className="donor-upgrade-subtitle">{newTier.subtitle}</p>

        <p className="donor-upgrade-desc">
          Recognized for distinguished philanthropic support of emergency relief operations: {newTier.description}
        </p>

        {totalDonatedPhp > 0 && (
          <div className="donor-plaque-amount-callout">
            <span className="donor-plaque-amount-lbl">Total Donated</span>
            <span className="donor-plaque-amount-val">₱{Math.round(totalDonatedPhp).toLocaleString('en-US')} PHP</span>
          </div>
        )}

        <div className="donor-upgrade-badge-seal">
          <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#10b981' }}>verified</span>
          <span>Verified on the Blockchain</span>
        </div>

        <button type="button" className="btn btn-primary btn-full" onClick={onClose} style={{ marginTop: '16px' }}>
          Continue
        </button>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : null;
}

/**
 * Payment rail configuration for the Complete Ledger filter pills
 */
export const LEDGER_RAILS = [
  { id: 'ALL', label: 'All Rails', icon: 'hub', color: '#10b981', bg: 'rgba(16, 185, 129, 0.14)', glow: 'rgba(16, 185, 129, 0.25)' },
  { id: 'CARD', label: 'Credit Card', icon: 'credit_card', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.14)', glow: 'rgba(245, 158, 11, 0.25)' },
  { id: 'GCASH', label: 'GCash', icon: 'smartphone', color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.14)', glow: 'rgba(14, 165, 233, 0.25)' },
  { id: 'MAYA', label: 'Maya', icon: 'account_balance_wallet', color: '#00d68f', bg: 'rgba(0, 214, 143, 0.14)', glow: 'rgba(0, 214, 143, 0.25)' },
  { id: 'ETH', label: 'Sepolia ETH', icon: 'token', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.14)', glow: 'rgba(139, 92, 246, 0.25)' }
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
    railTimerRef.current = setTimeout(() => {
      setRailLoading(false);
    }, 280);
  }, [ledgerFilter]);

  const getRailCount = useCallback((railId) => {
    if (!Array.isArray(donorTransactions)) return 0;
    if (railId === 'ALL') return donorTransactions.length;
    return donorTransactions.filter(t => {
      const pm = (t.paymentMethod || 'ETH').toUpperCase();
      if (railId === 'CARD' || railId === 'CREDIT CARD') return pm.includes('CARD') || pm.includes('BANK');
      if (railId === 'GCASH') return pm.includes('GCASH');
      if (railId === 'MAYA') return pm.includes('MAYA');
      if (railId === 'ETH') return pm.includes('ETH') || pm.includes('CRYPTO') || pm.includes('SEPOLIA');
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
      const pm = (t.paymentMethod || 'ETH').toUpperCase();
      if (ledgerFilter === 'CREDIT CARD' || ledgerFilter === 'CARD') return pm.includes('CARD') || pm.includes('BANK');
      if (ledgerFilter === 'GCASH') return pm.includes('GCASH');
      if (ledgerFilter === 'MAYA') return pm.includes('MAYA');
      if (ledgerFilter === 'ETH') return pm.includes('ETH') || pm.includes('CRYPTO') || pm.includes('SEPOLIA');
      return true;
    });
  }, [donorTransactions, ledgerFilter]);

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
  const effectiveDonations = Math.max(donationCount || 0, globalStats?.donationCount || 0, donorTransactions.length, 1);

  const tierInfo = getDonorTier({
    amountEth: effectiveEth,
    amountPhp: effectivePhp
  });

  const { tier: activeTier, nextTier, totalPhp } = tierInfo;
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
    const certText = `🎖️ Verified Certificate of Appreciation\n` +
      `Donor: ${donorName}\n` +
      `Badge: ${activeTier ? activeTier.name : 'Community Contributor'}\n` +
      `Total Donated: ₱${Math.round(totalPhp).toLocaleString('en-US')} (${effectiveEth.toFixed(4)} ETH)\n` +
      `Blockchain: Sepolia Ethereum\n` +
      `${isActualTx ? 'Latest Transaction Hash' : 'Wallet Address'}: ${displayHash}\n` +
      `Total Verified Donations: ${donorTransactions.length || 1} records\n` +
      `Platform: Philippine Blockchain Disaster Relief Transparency Network (BBDRTS)\n` +
      `Explorer Link: ${certExplorerUrl}\n` +
      `Verification Link: ${window.location.origin}`;

    navigator.clipboard.writeText(certText);
    setCopiedProof(true);
    setTimeout(() => setCopiedProof(false), 3000);
  };

  return typeof document !== 'undefined' ? createPortal(
    <div className="donor-modal-backdrop" data-theme={currentTheme} onClick={onClose}>
      <div
        className={`donor-modal-card fade-in theme-${currentTheme}`}
        data-theme={currentTheme}
        onClick={(e) => e.stopPropagation()}
        style={{
          height: 'min(840px, 88vh)',
          minHeight: 'min(840px, 88vh)',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxSizing: 'border-box'
        }}
      >
        
        {/* Modal Header */}
        <div className="donor-modal-header" style={{ flexShrink: 0 }}>
          <div className="donor-modal-title-wrap">
            <div className="donor-modal-badge-preview" style={{ background: activeTier ? activeTier.bg : 'rgba(255,255,255,0.05)', borderColor: activeTier ? activeTier.border : 'rgba(255,255,255,0.1)' }}>
              <ActiveIcon size={34} />
            </div>
            <div>
              <h3 className="donor-modal-title">Donor Impact & Certificate</h3>
              <p className="donor-modal-subtitle">
                Verified Disaster Relief Donations • Philippines
              </p>
            </div>
          </div>
          <button type="button" className="donor-modal-close" onClick={onClose} title="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Tab Switcher: Certificate & Impact vs Complete Ledger vs All Badges */}
        <div className="donor-portfolio-tabs" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', height: '44px', minHeight: '44px', maxHeight: '44px', padding: '4px', boxSizing: 'border-box', alignItems: 'stretch', flexShrink: 0 }}>
          <button
            type="button"
            className={`donor-tab-btn ${modalTab === 'portfolio' ? 'is-active' : ''}`}
            onClick={() => setModalTab('portfolio')}
            style={{ height: '36px', minHeight: '36px', maxHeight: '36px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', padding: '0 8px', lineHeight: 1 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>workspace_premium</span>
            <span>Certificate & Impact</span>
          </button>
          <button
            type="button"
            className={`donor-tab-btn ${modalTab === 'ledger' ? 'is-active' : ''}`}
            onClick={() => setModalTab('ledger')}
            style={{ height: '36px', minHeight: '36px', maxHeight: '36px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', padding: '0 8px', lineHeight: 1 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>receipt_long</span>
            <span>Complete Ledger</span>
            {donorTransactions.length > 0 && (
              <span className="donor-tab-count-badge" style={{ height: '18px', minHeight: '18px', maxHeight: '18px', lineHeight: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
                {donorTransactions.length}
              </span>
            )}
          </button>
          <button
            type="button"
            className={`donor-tab-btn ${modalTab === 'directory' ? 'is-active' : ''}`}
            onClick={() => setModalTab('directory')}
            style={{ height: '36px', minHeight: '36px', maxHeight: '36px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', padding: '0 8px', lineHeight: 1 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>history_edu</span>
            <span>Giving Societies</span>
          </button>
        </div>

        {/* Tab 1: Certificate & Impact */}
        {modalTab === 'portfolio' && (
          <div
            className="donor-portfolio-content"
            style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', paddingRight: '4px' }}
          >
            
            {/* Active Standing Hero Banner */}
            <div className="donor-current-card" style={{ borderColor: activeTier ? activeTier.border : 'rgba(255,255,255,0.1)' }}>
              <div className="donor-current-top">
                <div>
                  <span className="donor-current-eyebrow">Donor Profile</span>
                  <h2 className="donor-current-name" style={{ color: activeTier ? activeTier.color : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ActiveIcon size={26} />
                    <span>{donorName}</span>
                  </h2>
                  <div className="donor-current-sub" style={{ marginTop: '2px' }}>
                    <strong style={{ color: activeTier ? activeTier.color : '#10b981' }}>{activeTier ? activeTier.name : 'Community Supporter'}</strong>
                    {activeTier && activeTier.subtitle && !activeTier.name.toLowerCase().includes(activeTier.subtitle.toLowerCase()) && (
                      <span> • {activeTier.subtitle}</span>
                    )}
                  </div>
                </div>
                <div className="donor-current-metric">
                  <span className="donor-metric-amt">₱{Math.round(totalPhp).toLocaleString('en-US')}</span>
                  <span className="donor-metric-lbl">Total Donated ({effectiveEth.toFixed(4)} ETH)</span>
                </div>
              </div>

              {dedication && (
                <div className="donor-portfolio-dedication">
                  <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#10b981' }}>format_quote</span>
                  <span>“{dedication}”</span>
                </div>
              )}

              {activeTier && <p className="donor-current-desc" style={{ marginTop: '8px' }}>{activeTier.description}</p>}

              {nextTier && (
                <div className="donor-current-next-society">
                  <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#10b981' }}>info</span>
                  <span>Next Badge: <strong>{nextTier.name}</strong> (₱{nextTier.minPhp.toLocaleString('en-US')}+ total donations)</span>
                </div>
              )}
            </div>

            {/* Donation Summary (100% Authentic Database & Blockchain Metrics) */}
            <div className="donor-impact-footprint-section">
              <div className="donor-footprint-header">
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#10b981' }}>verified</span>
                <span className="donor-footprint-title">Donation Summary</span>
              </div>
              <p className="donor-footprint-sub">
                Verified records stored safely on the blockchain:
              </p>

              <div className="donor-footprint-grid">
                <div className="donor-footprint-item">
                  <div className="donor-footprint-icon-circle food">
                    <span className="material-symbols-outlined">payments</span>
                  </div>
                  <div className="donor-footprint-val">₱{Math.round(totalPhp).toLocaleString('en-US')}</div>
                  <div className="donor-footprint-lbl">Total Donated</div>
                  <div className="donor-footprint-desc">{effectiveEth.toFixed(4)} ETH sent to disaster relief</div>
                </div>

                <div className="donor-footprint-item">
                  <div className="donor-footprint-icon-circle water">
                    <span className="material-symbols-outlined">campaign</span>
                  </div>
                  <div className="donor-footprint-val">{Math.max(1, campaignsSupported || 1)} Campaigns</div>
                  <div className="donor-footprint-lbl">Drives Supported</div>
                  <div className="donor-footprint-desc">Different disaster campaigns you helped</div>
                </div>

                <div className="donor-footprint-item">
                  <div className="donor-footprint-icon-circle medical">
                    <span className="material-symbols-outlined">receipt_long</span>
                  </div>
                  <div className="donor-footprint-val">{effectiveDonations} Records</div>
                  <div className="donor-footprint-lbl">Donations Made</div>
                  <div className="donor-footprint-desc">Confirmed donations on record</div>
                </div>

                <div className="donor-footprint-item">
                  <div className="donor-footprint-icon-circle escrow">
                    <span className="material-symbols-outlined">lock_open</span>
                  </div>
                  <div className="donor-footprint-val">100% Escrow</div>
                  <div className="donor-footprint-lbl">Escrow Protection</div>
                  <div className="donor-footprint-desc">Funds released only when relief work is verified</div>
                </div>
              </div>
            </div>

            {/* Certificate of Appreciation */}
            <div className="donor-certificate-frame">
              <div className="donor-cert-inner">
                <div className="donor-cert-header">
                  <div className="donor-cert-gov-seal">
                    <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#10b981' }}>verified_user</span>
                  </div>
                  <div className="donor-cert-org">
                    PHILIPPINE BLOCKCHAIN DISASTER RELIEF TRANSPARENCY NETWORK
                  </div>
                  <div className="donor-cert-network-sub">
                    Partnered with Verified Relief NGOs • SEC Registered
                  </div>
                  <div className="donor-cert-main-title">
                    CERTIFICATE OF APPRECIATION
                  </div>
                  <div className="donor-cert-ribbon-line" />
                </div>

                <div className="donor-cert-body">
                  <p className="donor-cert-intro">This certificate is proudly presented to</p>
                  <h1 className="donor-cert-holder-name">{donorName}</h1>
                  <p className="donor-cert-prose">
                    for generously supporting disaster relief operations in the Philippines. Your verified donations help provide emergency food, clean water, and vital aid to families affected by disasters.
                  </p>

                  <div className="donor-cert-badge-row">
                    <div className="donor-cert-badge-circle" style={{ borderColor: activeTier ? activeTier.border : '#10b981' }}>
                      <ActiveIcon size={38} />
                    </div>
                    <div className="donor-cert-badge-text">
                      <div className="donor-cert-society-name" style={{ color: activeTier ? activeTier.color : '#10b981' }}>
                        {activeTier ? activeTier.name : 'Community Contributor'}
                      </div>
                      <div className="donor-cert-society-meta">
                        Total Donated: <strong>₱{Math.round(totalPhp).toLocaleString('en-US')}</strong> ({effectiveEth.toFixed(4)} ETH)
                      </div>
                    </div>
                  </div>

                  <div className="donor-cert-footer-grid">
                    {walletAddress && walletAddress !== '0x0000000000000000000000000000000000000000' && (
                      <div className="donor-cert-col" style={{ textAlign: 'left' }}>
                        <span className="donor-cert-meta-lbl">VERIFIED DONOR WALLET</span>
                        <a
                          href={`https://sepolia.etherscan.io/address/${walletAddress}`}
                          target="_blank"
                          rel="noreferrer"
                          className="donor-cert-hash-link"
                          title="View Verified Wallet on Sepolia Etherscan"
                        >
                          {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
                          <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>open_in_new</span>
                        </a>
                      </div>
                    )}

                    {isActualTx && (
                      <div className="donor-cert-col" style={{ textAlign: walletAddress ? 'center' : 'left' }}>
                        <span className="donor-cert-meta-lbl">LATEST MINED TRANSACTION</span>
                        <a
                          href={`https://sepolia.etherscan.io/tx/${effectiveTxHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="donor-cert-hash-link"
                          title="View Mined Transaction on Sepolia Etherscan"
                        >
                          {String(effectiveTxHash).slice(0, 10)}...{String(effectiveTxHash).slice(-8)}
                          <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>open_in_new</span>
                        </a>
                      </div>
                    )}

                    <div className="donor-cert-col" style={{ textAlign: 'right' }}>
                      <span className="donor-cert-meta-lbl">TRANSPARENCY GUARANTEE</span>
                      <span className="donor-cert-standard-val">
                        <span className="material-symbols-outlined" style={{ fontSize: '12px', color: '#10b981' }}>verified</span>
                        100% of aid goes directly to relief operations
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Certificate Action Bar - Clean & focused */}
              <div className="donor-cert-actions-bar">
                <button
                  type="button"
                  className="donor-cert-action-btn primary"
                  onClick={handlePrintCertificate}
                  title="Print Certificate"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>print</span>
                  <span>Print Certificate</span>
                </button>

                <button
                  type="button"
                  className="donor-cert-action-btn secondary"
                  onClick={handleCopyProof}
                  title="Copy verification link to clipboard"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                    {copiedProof ? 'check_circle' : 'content_copy'}
                  </span>
                  <span>{copiedProof ? 'Link Copied!' : 'Copy Proof Link'}</span>
                </button>
              </div>
            </div>

          </div>
        )}

        {/* Tab 2: Complete Blockchain Ledger */}
        {modalTab === 'ledger' && (
          <div
            className="donor-ledger-content"
            style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', paddingRight: '4px' }}
          >
            <div className="donor-ledger-header">
              <div>
                <h4 className="donor-ledger-title" style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="material-symbols-outlined" style={{ color: '#10b981', fontSize: '20px' }}>verified</span>
                  <span>Complete On-Chain Donation History</span>
                </h4>
                <p style={{ margin: '3px 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  All verified disaster relief contributions made by <strong>{donorName}</strong>.
                </p>
              </div>

              <div className="donor-ledger-stats-pill">
                <span>Total: <strong>₱{Math.round(totalPhp).toLocaleString('en-US')}</strong></span>
                <span style={{ opacity: 0.6 }}>•</span>
                <span><strong>{donorTransactions.length}</strong> {donorTransactions.length === 1 ? 'Record' : 'Records'}</span>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="donor-ledger-filter-row">
              {LEDGER_RAILS.map(rail => {
                const count = getRailCount(rail.id);
                if (rail.id !== 'ALL' && count === 0) return null;
                const isActive = ledgerFilter === rail.id;

                return (
                  <button
                    key={rail.id}
                    type="button"
                    className={`donor-ledger-filter-btn ${isActive ? 'is-active' : ''}`}
                    style={{
                      '--rail-color': rail.color,
                      '--rail-bg': rail.bg,
                      '--rail-glow': rail.glow
                    }}
                    onClick={() => handleRailFilterChange(rail.id)}
                    title={`Filter by ${rail.label}`}
                  >
                    <span
                      className="material-symbols-outlined rail-icon"
                      style={{ color: rail.color }}
                    >
                      {rail.icon}
                    </span>
                    <span>{rail.label}</span>
                    <span className="filter-count-pill">{count}</span>
                  </button>
                );
              })}
            </div>

            {loadingTx || railLoading ? (
              <div className="donor-ledger-skeleton-list">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="donor-ledger-skeleton-card">
                    <div className="donor-ledger-skeleton-avatar" />
                    <div className="donor-ledger-skeleton-details">
                      <div className="donor-ledger-skeleton-pill title" />
                      <div className="donor-ledger-skeleton-pill sub-date" />
                      <div className="donor-ledger-skeleton-pill hash" />
                    </div>
                    <div className="donor-ledger-skeleton-amounts">
                      <div className="donor-ledger-skeleton-pill amt-php" />
                      <div className="donor-ledger-skeleton-pill amt-eth" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredTxList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed var(--border)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'var(--text-muted)', marginBottom: '8px' }}>receipt_long</span>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>No transactions found</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  No donation records match the selected payment rail.
                </div>
              </div>
            ) : (
              <div className="donor-ledger-list donor-data-fade-in">
                {filteredTxList.map((tx, idx) => {
                  const pm = (tx.paymentMethod || 'ETH').toUpperCase();
                  const isCard = pm.includes('CARD');
                  const isGcash = pm.includes('GCASH');
                  const isMaya = pm.includes('MAYA');
                  const railColor = isCard ? '#f59e0b' : isGcash ? '#007DFE' : isMaya ? '#10b981' : '#8b5cf6';
                  const railBg = isCard ? 'rgba(245, 158, 11, 0.12)' : isGcash ? 'rgba(0, 125, 254, 0.12)' : isMaya ? 'rgba(16, 185, 129, 0.12)' : 'rgba(139, 92, 246, 0.12)';
                  const railIcon = isCard ? 'credit_card' : isGcash ? 'smartphone' : isMaya ? 'account_balance_wallet' : 'token';
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
                    <div key={tx.id || idx} className="donor-ledger-card">
                      {/* Sleek payment rail avatar - soft rounded square, not a button */}
                      <div className="donor-ledger-icon-wrap" style={{ background: railBg, color: railColor }}>
                        <span className="material-symbols-outlined">{railIcon}</span>
                      </div>

                      {/* Center details */}
                      <div className="donor-ledger-details">
                        <div className="donor-ledger-title-line">
                          <span className="donor-ledger-campaign-name" title={tx.campaignTitle}>
                            {tx.campaignTitle || `Relief Campaign #${tx.campaignId || 1}`}
                          </span>
                        </div>

                        <div className="donor-ledger-sub-line">
                          <span className="donor-ledger-rail-name" style={{ color: railColor }}>
                            {tx.paymentMethod || 'ETH'}
                          </span>
                          <span className="donor-ledger-sep">•</span>
                          <span>{formattedDate}</span>
                          {tx.orgName && (
                            <>
                              <span className="donor-ledger-sep">•</span>
                              <span className="donor-ledger-org">{tx.orgName}</span>
                            </>
                          )}
                        </div>

                        {/* Monospace On-Chain Link without bulky buttons */}
                        {txHashClean && (
                          <div className="donor-ledger-hash-line">
                            {hasRealHash ? (
                              <a
                                href={`https://sepolia.etherscan.io/tx/${txHashClean}`}
                                target="_blank"
                                rel="noreferrer"
                                className="donor-ledger-hash-link"
                                title="Inspect transaction on Sepolia Etherscan (opens in new tab)"
                              >
                                <span>{txHashClean.slice(0, 10)}...{txHashClean.slice(-8)}</span>
                                <span className="material-symbols-outlined hash-icon">open_in_new</span>
                              </a>
                            ) : (
                              <span className="donor-ledger-hash-verified" title="Cryptographically verified record">
                                <span>{txHashClean.slice(0, 10)}...{txHashClean.slice(-8)}</span>
                                <span className="material-symbols-outlined hash-icon">verified</span>
                              </span>
                            )}

                            <button
                              type="button"
                              className="donor-ledger-hash-copy"
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
                              {copiedTxId === (tx.id || idx) && <span className="copied-toast">Copied</span>}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Right-aligned amounts */}
                      <div className="donor-ledger-amounts">
                        <div className="donor-ledger-php">₱{phpAmt.toLocaleString('en-US')}</div>
                        <div className="donor-ledger-eth">({ethAmt.toFixed(4)} ETH)</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: All Donor Badges */}
        {modalTab === 'directory' && (
          <div
            className="donor-directory-content"
            style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', paddingRight: '4px' }}
          >
            <div className="donor-ladder-title">
              <span>Philanthropic Giving Societies</span>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Formal donor recognition based on cumulative disaster relief contributions</span>
            </div>

            <div className="donor-ladder-list">
              {DONOR_TIERS.map((t) => {
                const isCurrent = activeTier?.id === t.id;
                const isUnlocked = totalPhp >= t.minPhp;
                const TierIcon = t.IconComponent;

                return (
                  <div
                    key={t.id}
                    className={`donor-tier-row ${isCurrent ? 'is-active' : ''} ${isUnlocked ? 'is-unlocked' : ''}`}
                    style={{ borderColor: isCurrent ? t.border : undefined }}
                  >
                    <div className="donor-tier-left">
                      <div className="donor-tier-icon-circle" style={{ background: t.bg, borderColor: t.border }}>
                        <TierIcon size={26} />
                      </div>
                      <div className="donor-tier-details">
                        <div className="donor-tier-row-hdr">
                          <span className="donor-tier-row-name" style={{ color: isCurrent ? t.color : 'var(--text-primary)' }}>
                            {t.name}
                          </span>
                          {isCurrent && <span className="donor-tier-current-tag">CURRENT GIVING SOCIETY</span>}
                          {isUnlocked && !isCurrent && <span className="donor-tier-unlocked-tag">MEMBER</span>}
                        </div>
                        <div className="donor-tier-row-sub">{t.subtitle}</div>
                        <div className="donor-tier-row-crit">
                          ₱{t.minPhp.toLocaleString('en-US')}+ total donations ({t.minEth} ETH)
                        </div>
                        <div className="donor-tier-row-desc">
                          {t.description}
                        </div>
                      </div>
                    </div>

                    <div className="donor-tier-badge-visual">
                      <div className="donor-badge-emblem icon-only" title={t.name}>
                        <TierIcon size={28} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="donor-modal-footer" style={{ flexShrink: 0, marginTop: 'auto', paddingTop: '14px' }}>
          <div className="donor-footer-verified">
            <span className="material-symbols-outlined" style={{ color: '#10b981', fontSize: '16px' }}>verified_user</span>
            <span>All donations are securely tracked and verified on the blockchain.</span>
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;
}
