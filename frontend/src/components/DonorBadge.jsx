import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './DonorBadge.css';

/**
 * 7 Bespoke Vector SVG Badge Icons for Disaster Relief Platform
 * Strictly visual-only: Zero text inside any badge icon.
 * Progressively prestigious custom geometries.
 */

/**
 * 12 Bespoke Discord-Inspired Vector SVG Badge Icons for Disaster Relief
 * - Strictly visual-only: Zero text inside any badge icon.
 * - Distinct, chiseled 3D polygon facets (light vs. shadow facet splits).
 * - Every badge relates directly and meaningfully to the exact tier.
 * - Progressively prestigious geometries: Sprout Gem -> Compass Shield -> Partner Cross ->
 *   Amethyst Prism -> Phoenix Flame -> Heart Medallion -> Star of Mercy ->
 *   Winged Diamond Crest -> Patron Heraldic Shield -> Sovereign Monarch Crown ->
 *   Celestial Solar Nova -> Mythic Transcendent Diamond with Orbit Rings.
 */

// Tier 1: Contributor (₱1+) — Faceted Relief Sprout Gem
export function BadgeTier1Contributor({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={`custom-donor-badge-svg badge-svg-t1 ${className}`}>
      <defs>
        <linearGradient id="t1Plate" x1="18" y1="2" x2="18" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#044e39" />
        </linearGradient>
        <linearGradient id="t1LeafL" x1="10" y1="8" x2="18" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6ee7b7" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
        <linearGradient id="t1LeafR" x1="26" y1="8" x2="18" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#059669" />
          <stop offset="100%" stopColor="#022c22" />
        </linearGradient>
        <filter id="t1Glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#10b981" floodOpacity="0.5" />
        </filter>
      </defs>
      {/* Outer Faceted Diamond Shield */}
      <polygon points="18,2 31,10 31,22 18,34 5,22 5,10" fill="url(#t1Plate)" stroke="#a7f3d0" strokeWidth="1.3" filter="url(#t1Glow)" />
      {/* Top Left Highlight Bevel */}
      <polygon points="18,2 31,10 18,14 5,10" fill="#ffffff" fillOpacity="0.22" />
      {/* Bottom Shadow Bevel */}
      <polygon points="5,22 18,34 31,22 18,26" fill="#000000" fillOpacity="0.3" />
      {/* Sprout Stem Base */}
      <polygon points="17,26 19,26 18.6,18 17.4,18" fill="#a7f3d0" />
      {/* Left Sprout Leaf (Light facet) */}
      <path d="M18 19C13 18 9 12 11 8C15 9 17 14 18 19Z" fill="url(#t1LeafL)" stroke="#ecfdf5" strokeWidth="0.8" />
      {/* Right Sprout Leaf (Shadow facet) */}
      <path d="M18 19C23 18 27 12 25 8C21 9 19 14 18 19Z" fill="url(#t1LeafR)" stroke="#6ee7b7" strokeWidth="0.8" />
      {/* Central Sprout Gem Jewel */}
      <circle cx="18" cy="22" r="1.8" fill="#ffffff" />
    </svg>
  );
}

// Tier 2: Supporter (₱1,000+) — Tactical Compass Shield (Discord Star Bevels)
export function BadgeTier2Supporter({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={`custom-donor-badge-svg badge-svg-t2 ${className}`}>
      <defs>
        <linearGradient id="t2Plate" x1="18" y1="2" x2="18" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0284c7" />
          <stop offset="100%" stopColor="#082f49" />
        </linearGradient>
        <filter id="t2Glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="2.2" floodColor="#38bdf8" floodOpacity="0.55" />
        </filter>
      </defs>
      {/* Faceted Kite Shield */}
      <polygon points="18,1.5 31.5,8 28,24 18,34.5 8,24 4.5,8" fill="url(#t2Plate)" stroke="#7dd3fc" strokeWidth="1.3" filter="url(#t2Glow)" />
      {/* Bevel Rim */}
      <polygon points="18,1.5 31.5,8 25,12 18,5" fill="#ffffff" fillOpacity="0.25" />
      {/* Inner Compass Ring */}
      <circle cx="18" cy="18" r="8.5" fill="#082f49" fillOpacity="0.5" stroke="#38bdf8" strokeWidth="0.9" strokeDasharray="2 1.5" />
      {/* Cardinal 4-Point Faceted Star: Each point split into light & shadow halves */}
      {/* North Point: Left half light, Right half shadow */}
      <polygon points="18,7 18,18 15.5,17" fill="#e0f2fe" />
      <polygon points="18,7 20.5,17 18,18" fill="#0284c7" />
      {/* South Point: Left half shadow, Right half dark shadow */}
      <polygon points="18,29 15.5,19 18,18" fill="#0369a1" />
      <polygon points="18,29 18,18 20.5,19" fill="#075985" />
      {/* East Point: Top half light, Bottom half shadow */}
      <polygon points="29,18 19,15.5 18,18" fill="#7dd3fc" />
      <polygon points="29,18 18,18 19,20.5" fill="#0284c7" />
      {/* West Point: Top half light, Bottom half shadow */}
      <polygon points="7,18 18,18 17,15.5" fill="#bae6fd" />
      <polygon points="7,18 17,20.5 18,18" fill="#0369a1" />
      {/* Central Diamond Jewel */}
      <polygon points="18,15.5 20.5,18 18,20.5 15.5,18" fill="#ffffff" />
      <circle cx="18" cy="18" r="1" fill="#0284c7" />
    </svg>
  );
}

// Tier 3: Relief Partner (₱5,000+) — Interlocking Partnership Shield & Cross
export function BadgeTier3ReliefPartner({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={`custom-donor-badge-svg badge-svg-t3 ${className}`}>
      <defs>
        <linearGradient id="t3Plate" x1="18" y1="2" x2="18" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#172554" />
        </linearGradient>
        <linearGradient id="t3WingL" x1="6" y1="6" x2="20" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <filter id="t3Glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="2.4" floodColor="#3b82f6" floodOpacity="0.6" />
        </filter>
      </defs>
      {/* Outer Partnership Shield */}
      <path d="M18 2L30.5 7V19C30.5 26.5 24.5 32 18 34.5C11.5 32 5.5 26.5 5.5 19V7L18 2Z" fill="url(#t3Plate)" stroke="#93c5fd" strokeWidth="1.3" filter="url(#t3Glow)" />
      {/* Left Partner Interlocking Chevron Wing */}
      <path d="M7 9L18 4V13L11 17L12 24L7 21V9Z" fill="url(#t3WingL)" stroke="#ffffff" strokeWidth="0.7" />
      {/* Right Partner Interlocking Chevron Wing */}
      <path d="M29 9L18 4V13L25 17L24 24L29 21V9Z" fill="#1e40af" stroke="#93c5fd" strokeWidth="0.7" />
      {/* Center Beveled Relief Cross of Aid */}
      <polygon points="16,11 18,11 18,25 16,23" fill="#ffffff" />
      <polygon points="18,11 20,11 20,23 18,25" fill="#93c5fd" />
      <polygon points="12,15 24,15 22,17 14,17" fill="#ffffff" />
      <polygon points="14,17 22,17 24,19 12,19" fill="#60a5fa" />
      {/* Central Blue Sapphire Gem */}
      <circle cx="18" cy="17" r="1.6" fill="#1d4ed8" stroke="#ffffff" strokeWidth="0.6" />
    </svg>
  );
}

// Tier 4: Benefactor (₱10,000+) — Hexagonal Cut Amethyst Crystal Gem (Discord Booster Gem Style)
export function BadgeTier4Benefactor({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={`custom-donor-badge-svg badge-svg-t4 ${className}`}>
      <defs>
        <linearGradient id="t4Plate" x1="18" y1="2" x2="18" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#3b0764" />
        </linearGradient>
        <filter id="t4Glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="2.6" floodColor="#c084fc" floodOpacity="0.6" />
        </filter>
      </defs>
      {/* Outer Hexagon Rim Plate */}
      <polygon points="18,2 31.5,9.5 31.5,24.5 18,32 4.5,24.5 4.5,9.5" fill="url(#t4Plate)" stroke="#e9d5ff" strokeWidth="1.3" filter="url(#t4Glow)" />
      {/* 6 Outer Gem Facets Converging to Center Table */}
      <polygon points="18,2 25,12 11,12" fill="#f3e8ff" fillOpacity="0.75" />
      <polygon points="18,2 31.5,9.5 25,12" fill="#c084fc" />
      <polygon points="31.5,9.5 31.5,24.5 25,22 25,12" fill="#6b21a8" />
      <polygon points="31.5,24.5 18,32 4.5,24.5 11,22 25,22" fill="#4c1d95" />
      <polygon points="4.5,24.5 4.5,9.5 11,12 11,22" fill="#7e22ce" />
      <polygon points="4.5,9.5 18,2 11,12" fill="#d8b4fe" />
      {/* Central Hexagonal Table Facet */}
      <polygon points="18,13 24,16.5 24,20.5 18,24 12,20.5 12,16.5" fill="#f3e8ff" stroke="#a855f7" strokeWidth="0.8" />
      {/* Inner Glowing Diamond Beacon */}
      <polygon points="18,15 21,18.5 18,22 15,18.5" fill="#a855f7" />
      <circle cx="18" cy="18.5" r="1.2" fill="#ffffff" />
    </svg>
  );
}

// Tier 5: Advocate (₱25,000+) — Phoenix Wing & Beacon Flame
export function BadgeTier5Advocate({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={`custom-donor-badge-svg badge-svg-t5 ${className}`}>
      <defs>
        <linearGradient id="t5Plate" x1="18" y1="2" x2="18" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f43f5e" />
          <stop offset="100%" stopColor="#4c0519" />
        </linearGradient>
        <linearGradient id="t5Flame" x1="18" y1="9" x2="18" y2="25" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="50%" stopColor="#fb7185" />
          <stop offset="100%" stopColor="#be123c" />
        </linearGradient>
        <filter id="t5Glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="2.8" floodColor="#f43f5e" floodOpacity="0.65" />
        </filter>
      </defs>
      {/* Outer Angular Shield */}
      <polygon points="18,2 31,8 29,23 18,34 7,23 5,8" fill="url(#t5Plate)" stroke="#fecdd3" strokeWidth="1.3" filter="url(#t5Glow)" />
      {/* Left Phoenix Wing Feathers */}
      <path d="M6 9L15 13L11 18L15 20L10 24L8 16Z" fill="#fda4af" stroke="#ffffff" strokeWidth="0.7" />
      {/* Right Phoenix Wing Feathers */}
      <path d="M30 9L21 13L25 18L21 20L26 24L28 16Z" fill="#be123c" stroke="#fecdd3" strokeWidth="0.7" />
      {/* Center Rising Beacon Torch Flame: 3 Facets */}
      <path d="M18 9C15 14 13 18 13 22C13 25 15.5 27 18 27C20.5 27 23 25 23 22C23 18 21 14 18 9Z" fill="url(#t5Flame)" stroke="#ffe4e6" strokeWidth="0.8" />
      <path d="M18 10C16 14 14.5 18 14.5 21C14.5 23.5 16 25 18 25V10Z" fill="#ffffff" fillOpacity="0.35" />
      <polygon points="18,14 20,20 18,23 16,20" fill="#fef08a" />
      <circle cx="18" cy="19" r="1.1" fill="#ffffff" />
    </svg>
  );
}

// Tier 6: Philanthropist (₱50,000+) — Golden Heart Medallion
export function BadgeTier6Philanthropist({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={`custom-donor-badge-svg badge-svg-t6 ${className}`}>
      <defs>
        <linearGradient id="t6Plate" x1="18" y1="2" x2="18" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="40%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>
        <linearGradient id="t6HeartL" x1="13" y1="12" x2="18" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fffbeb" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
        <linearGradient id="t6HeartR" x1="23" y1="12" x2="18" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>
        <filter id="t6Glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="3" floodColor="#f59e0b" floodOpacity="0.7" />
        </filter>
      </defs>
      {/* Octagonal Beveled Golden Medallion Plate */}
      <polygon points="18,2 29.5,6.5 34,18 29.5,29.5 18,34 6.5,29.5 2,18 6.5,6.5" fill="url(#t6Plate)" stroke="#fef08a" strokeWidth="1.4" filter="url(#t6Glow)" />
      {/* Top Bevel Highlight */}
      <polygon points="18,2 29.5,6.5 25,10 18,5 11,10 6.5,6.5" fill="#ffffff" fillOpacity="0.3" />
      {/* Inner Decorative Golden Ring */}
      <circle cx="18" cy="18" r="10.5" fill="#78350f" fillOpacity="0.45" stroke="#fef08a" strokeWidth="0.9" strokeDasharray="2 1.5" />
      {/* Faceted Geometric Crystal Heart (Philanthropy Motif) */}
      <polygon points="18,14.5 14,11 10,14 11,18 18,25" fill="url(#t6HeartL)" stroke="#fffbeb" strokeWidth="0.7" />
      <polygon points="18,14.5 22,11 26,14 25,18 18,25" fill="url(#t6HeartR)" stroke="#fcd34d" strokeWidth="0.7" />
      <line x1="18" y1="14.5" x2="18" y2="25" stroke="#ffffff" strokeWidth="0.8" />
      {/* Specular Diamond in Heart Center */}
      <polygon points="18,16 20,18.5 18,21 16,18.5" fill="#ffffff" />
      <circle cx="18" cy="18.5" r="0.9" fill="#f59e0b" />
    </svg>
  );
}

// Tier 7: Humanitarian (₱100,000+) — Star of Mercy (Maltese Relief Cross)
export function BadgeTier7Humanitarian({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={`custom-donor-badge-svg badge-svg-t7 ${className}`}>
      <defs>
        <linearGradient id="t7Plate" x1="18" y1="2" x2="18" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f87171" />
          <stop offset="40%" stopColor="#dc2626" />
          <stop offset="100%" stopColor="#7f1d1d" />
        </linearGradient>
        <filter id="t7Glow" x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="1.8" stdDeviation="3.2" floodColor="#ef4444" floodOpacity="0.75" />
        </filter>
      </defs>
      {/* 8-Point Maltese Cross of Mercy */}
      <path d="M18 2L21 9L27 5L24 11L31 11L25 15L31 19L24 19L27 25L21 21L18 28L15 21L9 25L12 19L5 19L11 15L5 11L12 11L9 5L15 9L18 2Z" fill="url(#t7Plate)" stroke="#fecaca" strokeWidth="1.4" filter="url(#t7Glow)" />
      {/* Facet Light Lines on Cardinal Arms */}
      <polygon points="18,2 18,18 15,9" fill="#ffffff" fillOpacity="0.35" />
      <polygon points="31,11 18,18 24,11" fill="#ffffff" fillOpacity="0.25" />
      <polygon points="5,11 18,18 11,15" fill="#ffffff" fillOpacity="0.3" />
      {/* Inner Beveled Octagon Core */}
      <polygon points="18,11 23,13 25,18 23,23 18,25 13,23 11,18 13,13" fill="#7f1d1d" stroke="#fca5a5" strokeWidth="0.9" />
      {/* Polished White Relief Cross */}
      <polygon points="16,13 20,13 20,16 23,16 23,20 20,20 20,23 16,23 16,20 13,20 13,16 16,16" fill="#ffffff" />
      <circle cx="18" cy="18" r="1.5" fill="#ef4444" />
      <circle cx="18" cy="18" r="0.7" fill="#ffffff" />
    </svg>
  );
}

// Tier 8: Distinguished Humanitarian (₱250,000+) — Winged Diamond Crest
export function BadgeTier8DistinguishedHumanitarian({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={`custom-donor-badge-svg badge-svg-t8 ${className}`}>
      <defs>
        <linearGradient id="t8Plate" x1="18" y1="2" x2="18" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#5eead4" />
          <stop offset="40%" stopColor="#0d9488" />
          <stop offset="100%" stopColor="#134e4a" />
        </linearGradient>
        <linearGradient id="t8Wing" x1="4" y1="4" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="50%" stopColor="#ccfbf1" />
          <stop offset="100%" stopColor="#0f766e" />
        </linearGradient>
        <filter id="t8Glow" x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="2" stdDeviation="3.4" floodColor="#14b8a6" floodOpacity="0.75" />
        </filter>
      </defs>
      {/* Outer Ascended Twin Wings */}
      <path d="M3 11L11 8L15 13L10 17L14 19L9 25L5 20L3 11Z" fill="url(#t8Wing)" stroke="#f1f5f9" strokeWidth="0.8" filter="url(#t8Glow)" />
      <path d="M33 11L25 8L21 13L26 17L22 19L27 25L31 20L33 11Z" fill="#115e59" stroke="#99f6e4" strokeWidth="0.8" filter="url(#t8Glow)" />
      {/* Central 8-Point Diamond Star Crest */}
      <polygon points="18,3 21,12 30,9 24,16 32,20 23,21 24,30 18,24 12,30 13,21 4,20 12,16 6,9 15,12" fill="url(#t8Plate)" stroke="#ccfbf1" strokeWidth="1.2" />
      {/* Chiseled Star Facets (Light / Shadow) */}
      <polygon points="18,3 18,18 15,12" fill="#ffffff" fillOpacity="0.45" />
      <polygon points="30,9 18,18 21,12" fill="#ffffff" fillOpacity="0.25" />
      <polygon points="32,20 18,18 24,16" fill="#134e4a" fillOpacity="0.5" />
      {/* Center Specular Diamond Table */}
      <polygon points="18,13 22,18 18,23 14,18" fill="#ffffff" stroke="#0d9488" strokeWidth="0.8" />
      <circle cx="18" cy="18" r="1.6" fill="#14b8a6" />
      <circle cx="18" cy="18" r="0.7" fill="#ffffff" />
    </svg>
  );
}

// Tier 9: Patron of Relief (₱500,000+) — Heraldic Patron Shield with Coronet & Wings
export function BadgeTier9PatronOfRelief({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={`custom-donor-badge-svg badge-svg-t9 ${className}`}>
      <defs>
        <linearGradient id="t9Plate" x1="18" y1="2" x2="18" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="50%" stopColor="#1d4ed8" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id="t9Gold" x1="18" y1="2" x2="18" y2="12" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#ca8a04" />
        </linearGradient>
        <filter id="t9Glow" x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="2" stdDeviation="3.6" floodColor="#3b82f6" floodOpacity="0.8" />
        </filter>
      </defs>
      {/* Guardian Shield Body */}
      <path d="M18 6L29 10V21C29 28 23.5 33 18 35C12.5 33 7 28 7 21V10L18 6Z" fill="url(#t9Plate)" stroke="#93c5fd" strokeWidth="1.4" filter="url(#t9Glow)" />
      {/* Left Shield Bevel Highlight */}
      <path d="M18 6L7 10V21C7 28 12.5 33 18 35V6Z" fill="#ffffff" fillOpacity="0.16" />
      {/* 3-Point Royal Patron Coronet perched atop */}
      <polygon points="12,8 14,3 18,6 22,3 24,8" fill="url(#t9Gold)" stroke="#fef08a" strokeWidth="0.8" />
      {/* Coronet Jewels */}
      <circle cx="14" cy="4" r="1.1" fill="#60a5fa" />
      <circle cx="18" cy="7" r="1.3" fill="#ffffff" />
      <circle cx="22" cy="4" r="1.1" fill="#60a5fa" />
      {/* Central Relief Beacon / Star */}
      <polygon points="18,13 20.5,18.5 26,19 21.5,23 23,28 18,25 13,28 14.5,23 10,19 15.5,18.5" fill="#facc15" stroke="#ffffff" strokeWidth="0.8" />
      <circle cx="18" cy="21" r="2.2" fill="#1e40af" stroke="#fef08a" strokeWidth="0.7" />
      <circle cx="18" cy="21" r="1" fill="#ffffff" />
    </svg>
  );
}

// Tier 10: Grand Benefactor (₱1,000,000+) — Sovereign Monarch Crown (1M Milestone)
export function BadgeTier10GrandBenefactor({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={`custom-donor-badge-svg badge-svg-t10 ${className}`}>
      <defs>
        <linearGradient id="t10Gold" x1="18" y1="2" x2="18" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fffbeb" />
          <stop offset="25%" stopColor="#fde047" />
          <stop offset="60%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#713f12" />
        </linearGradient>
        <filter id="t10Glow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2.2" stdDeviation="4" floodColor="#eab308" floodOpacity="0.85" />
        </filter>
      </defs>
      {/* Radial Halo Aura */}
      <circle cx="18" cy="18" r="16" fill="#ca8a04" fillOpacity="0.15" stroke="#fde047" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="3 2" />
      {/* Imperial 5-Spire Sovereign Crown Silhouette */}
      <path d="M4 27L6 14L11 20L18 6L25 20L30 14L32 27H4Z" fill="url(#t10Gold)" stroke="#fffbeb" strokeWidth="1.5" filter="url(#t10Glow)" />
      {/* 3D Vertical Chiseled Bevels on Spires */}
      <polygon points="18,6 18,27 15,20" fill="#ffffff" fillOpacity="0.38" />
      <polygon points="18,6 21,20 18,27" fill="#713f12" fillOpacity="0.4" />
      <polygon points="6,14 8,27 11,20" fill="#ffffff" fillOpacity="0.25" />
      <polygon points="30,14 25,20 28,27" fill="#713f12" fillOpacity="0.3" />
      {/* Arched Velvet Base Band */}
      <path d="M4 27H32V31C32 32 30 33 18 33C6 33 4 32 4 31V27Z" fill="#713f12" stroke="#fef08a" strokeWidth="1.1" />
      {/* Floating Diamond Gemstones on 5 Spire Pinnacles */}
      <polygon points="18,2 20,5 18,8 16,5" fill="#ffffff" stroke="#ca8a04" strokeWidth="0.6" />
      <circle cx="6" cy="13" r="1.6" fill="#38bdf8" stroke="#ffffff" strokeWidth="0.5" />
      <circle cx="30" cy="13" r="1.6" fill="#38bdf8" stroke="#ffffff" strokeWidth="0.5" />
      <circle cx="11" cy="19" r="1.4" fill="#f43f5e" stroke="#ffffff" strokeWidth="0.5" />
      <circle cx="25" cy="19" r="1.4" fill="#f43f5e" stroke="#ffffff" strokeWidth="0.5" />
      {/* Jewels on Headband */}
      <circle cx="10" cy="30" r="1.2" fill="#ef4444" />
      <circle cx="18" cy="30" r="1.4" fill="#ffffff" />
      <circle cx="26" cy="30" r="1.2" fill="#3b82f6" />
    </svg>
  );
}

// Tier 11: Principal Benefactor (₱2,500,000+) — Celestial Solar Nova & Archon Crest
export function BadgeTier11PrincipalBenefactor({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={`custom-donor-badge-svg badge-svg-t11 ${className}`}>
      <defs>
        <linearGradient id="t11Plate" x1="18" y1="2" x2="18" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f472b6" />
          <stop offset="35%" stopColor="#a855f7" />
          <stop offset="70%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#3b0764" />
        </linearGradient>
        <filter id="t11Glow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2.2" stdDeviation="4.2" floodColor="#c084fc" floodOpacity="0.85" />
        </filter>
      </defs>
      {/* 12-Ray Radiant Solar Flare Crown */}
      <path d="M18 1L21 6L26.5 4L26 10L32 10.5L29 16L35 18L29 20L32 25.5L26 26L26.5 32L21 30L18 35L15 30L9.5 32L10 26L4 25.5L7 20L1 18L7 16L4 10.5L10 10L9.5 4L15 6L18 1Z" fill="url(#t11Plate)" stroke="#f5d0fe" strokeWidth="1.3" filter="url(#t11Glow)" />
      {/* Light Rays on Cardinal Points */}
      <line x1="18" y1="1" x2="18" y2="35" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="0.8" />
      <line x1="1" y1="18" x2="35" y2="18" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="0.8" />
      {/* Inner Octagonal Archon Gold Plate */}
      <polygon points="18,9 24.5,11.5 27,18 24.5,24.5 18,27 11.5,24.5 9,18 11.5,11.5" fill="#581c87" stroke="#fde047" strokeWidth="1.2" />
      {/* Blazing Pulsar Diamond Star */}
      <polygon points="18,11 20.5,15.5 25,18 20.5,20.5 18,25 15.5,20.5 11,18 15.5,15.5" fill="#fde047" stroke="#ffffff" strokeWidth="0.8" />
      {/* Pure White Hot Pulsar Core */}
      <circle cx="18" cy="18" r="2.2" fill="#ffffff" />
      <circle cx="18" cy="18" r="1.1" fill="#f472b6" />
    </svg>
  );
}

// Tier 12: Legacy Benefactor (₱5,000,000+) — The Eternal Transcendence Diamond (Apex Mythic)
export function BadgeTier12LegacyBenefactor({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={`custom-donor-badge-svg badge-svg-t12 ${className}`}>
      <defs>
        {/* Holographic Iridescent Spectrum Gradient */}
        <linearGradient id="t12Holo" x1="2" y1="2" x2="34" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="20%" stopColor="#00ffa3" />
          <stop offset="45%" stopColor="#38bdf8" />
          <stop offset="70%" stopColor="#c084fc" />
          <stop offset="90%" stopColor="#facc15" />
          <stop offset="100%" stopColor="#f43f5e" />
        </linearGradient>
        <linearGradient id="t12Wings" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="50%" stopColor="#67e8f9" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
        <filter id="t12Glow" x="-35%" y="-35%" width="170%" height="170%">
          <feDropShadow dx="0" dy="2.5" stdDeviation="4.8" floodColor="#00ffa3" floodOpacity="0.9" />
        </filter>
      </defs>
      {/* Dual Tilted Cosmic Orbital Light Rings */}
      <ellipse cx="18" cy="18" rx="16" ry="6.5" transform="rotate(-28 18 18)" fill="none" stroke="url(#t12Holo)" strokeWidth="1.2" strokeDasharray="3 2" opacity="0.85" />
      <ellipse cx="18" cy="18" rx="16" ry="6.5" transform="rotate(28 18 18)" fill="none" stroke="url(#t12Holo)" strokeWidth="1.2" strokeDasharray="3 2" opacity="0.85" />
      {/* Symmetrical Mythic Phoenix Wings */}
      <path d="M2 13L9 9L14 14L9 18L14 20L8 27L4 21L2 13Z" fill="url(#t12Wings)" stroke="#ffffff" strokeWidth="0.8" />
      <path d="M34 13L27 9L22 14L27 18L22 20L28 27L32 21L34 13Z" fill="url(#t12Wings)" stroke="#ffffff" strokeWidth="0.8" />
      {/* 16-Point Faceted Transcendent Diamond Starburst */}
      <polygon points="18,1 20.5,6.5 25.5,4.5 25,10.5 30.5,11.5 28,16.5 33.5,18 28,19.5 30.5,24.5 25,25.5 25.5,31.5 20.5,29.5 18,35 15.5,29.5 10.5,31.5 11,25.5 5.5,24.5 8,19.5 2.5,18 8,16.5 5.5,11.5 11,10.5 10.5,4.5 15.5,6.5" fill="url(#t12Holo)" stroke="#ffffff" strokeWidth="1.5" filter="url(#t12Glow)" />
      {/* Ray Facet Refraction Lines */}
      <line x1="18" y1="1" x2="18" y2="35" stroke="#ffffff" strokeWidth="0.8" />
      <line x1="2.5" y1="18" x2="33.5" y2="18" stroke="#ffffff" strokeWidth="0.8" />
      {/* Central Brilliant-Cut Gem Core */}
      <polygon points="18,11 23,14 25,18 23,22 18,25 13,22 11,18 13,14" fill="#030712" stroke="#ffffff" strokeWidth="1.1" />
      {/* Specular Prism Center Star */}
      <polygon points="18,13 21.5,18 18,23 14.5,18" fill="url(#t12Holo)" stroke="#ffffff" strokeWidth="0.7" />
      {/* Pure White Diamond Flash */}
      <circle cx="18" cy="18" r="2" fill="#ffffff" />
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

/**
 * 12 Professional Humanitarian Tiers strictly based on cumulative donations across all campaigns
 */
export const DONOR_TIERS = [
  {
    tierNumber: 1,
    id: 'tier-1',
    name: 'Contributor',
    subtitle: 'Relief Sprout Gem',
    minPhp: 1,
    minEth: 0.000006,
    IconComponent: BadgeTier1Contributor,
    color: '#10b981',
    border: 'rgba(16, 185, 129, 0.45)',
    bg: 'rgba(16, 185, 129, 0.12)',
    badgeClass: 'tier-1',
    description: 'Foundation donor planting the initial seed of emergency aid for disaster-affected communities.'
  },
  {
    tierNumber: 2,
    id: 'tier-2',
    name: 'Supporter',
    subtitle: 'Crisis Compass',
    minPhp: 1000,
    minEth: 0.006,
    IconComponent: BadgeTier2Supporter,
    color: '#38bdf8',
    border: 'rgba(56, 189, 248, 0.45)',
    bg: 'rgba(56, 189, 248, 0.12)',
    badgeClass: 'tier-2',
    description: 'Committed supporter navigating vital supplies and resources directly into frontline crisis impact zones.'
  },
  {
    tierNumber: 3,
    id: 'tier-3',
    name: 'Relief Partner',
    subtitle: 'Partnership Shield',
    minPhp: 5000,
    minEth: 0.03,
    IconComponent: BadgeTier3ReliefPartner,
    color: '#60a5fa',
    border: 'rgba(96, 165, 250, 0.45)',
    bg: 'rgba(96, 165, 250, 0.12)',
    badgeClass: 'tier-3',
    description: 'Active relief partner joining forces with emergency responders to safeguard vulnerable displaced families.'
  },
  {
    tierNumber: 4,
    id: 'tier-4',
    name: 'Benefactor',
    subtitle: 'Prism of Benevolence',
    minPhp: 10000,
    minEth: 0.06,
    IconComponent: BadgeTier4Benefactor,
    color: '#c084fc',
    border: 'rgba(192, 132, 252, 0.45)',
    bg: 'rgba(192, 132, 252, 0.12)',
    badgeClass: 'tier-4',
    description: 'Generous benefactor providing foundational pillars of sustenance, medical aid, and emergency shelters.'
  },
  {
    tierNumber: 5,
    id: 'tier-5',
    name: 'Advocate',
    subtitle: 'Phoenix Beacon',
    minPhp: 25000,
    minEth: 0.15,
    IconComponent: BadgeTier5Advocate,
    color: '#f43f5e',
    border: 'rgba(244, 63, 94, 0.5)',
    bg: 'rgba(244, 63, 94, 0.14)',
    badgeClass: 'tier-5',
    description: 'Passionate advocate championing relief operations and mobilizing critical aid for vulnerable populations.'
  },
  {
    tierNumber: 6,
    id: 'tier-6',
    name: 'Philanthropist',
    subtitle: 'Golden Heart Medallion',
    minPhp: 50000,
    minEth: 0.30,
    IconComponent: BadgeTier6Philanthropist,
    color: '#f59e0b',
    border: 'rgba(245, 158, 11, 0.55)',
    bg: 'rgba(245, 158, 11, 0.14)',
    badgeClass: 'tier-6',
    description: 'Distinguished philanthropist whose heartfelt generosity funds extensive community recovery and rescue efforts.'
  },
  {
    tierNumber: 7,
    id: 'tier-7',
    name: 'Humanitarian',
    subtitle: 'Star of Mercy',
    minPhp: 100000,
    minEth: 0.60,
    IconComponent: BadgeTier7Humanitarian,
    color: '#ef4444',
    border: 'rgba(239, 68, 68, 0.6)',
    bg: 'rgba(239, 68, 68, 0.16)',
    badgeClass: 'tier-7',
    description: 'High-impact humanitarian spearheading life-saving crisis interventions and major disaster relief deployments.'
  },
  {
    tierNumber: 8,
    id: 'tier-8',
    name: 'Distinguished Humanitarian',
    subtitle: 'Winged Diamond Crest',
    minPhp: 250000,
    minEth: 1.50,
    IconComponent: BadgeTier8DistinguishedHumanitarian,
    color: '#14b8a6',
    border: 'rgba(20, 184, 166, 0.6)',
    bg: 'rgba(20, 184, 166, 0.16)',
    badgeClass: 'tier-8',
    description: 'Elevated humanitarian of exceptional distinction, delivering sustained transformational aid across regions.'
  },
  {
    tierNumber: 9,
    id: 'tier-9',
    name: 'Patron of Relief',
    subtitle: 'Heraldic Patron Crest',
    minPhp: 500000,
    minEth: 3.00,
    IconComponent: BadgeTier9PatronOfRelief,
    color: '#3b82f6',
    border: 'rgba(59, 130, 246, 0.65)',
    bg: 'rgba(59, 130, 246, 0.16)',
    badgeClass: 'tier-9',
    description: 'Institutional patron standing as a monumental pillar of emergency logistical networks and disaster readiness.'
  },
  {
    tierNumber: 10,
    id: 'tier-10',
    name: 'Grand Benefactor',
    subtitle: 'Sovereign Monarch Crown',
    minPhp: 1000000,
    minEth: 6.00,
    IconComponent: BadgeTier10GrandBenefactor,
    color: '#eab308',
    border: 'rgba(234, 179, 8, 0.7)',
    bg: 'rgba(234, 179, 8, 0.18)',
    badgeClass: 'tier-10',
    description: 'Million-peso benefactor crowned with sovereign honors for underwriting massive provincial disaster response programs.'
  },
  {
    tierNumber: 11,
    id: 'tier-11',
    name: 'Principal Benefactor',
    subtitle: 'Celestial Solar Nova',
    minPhp: 2500000,
    minEth: 15.00,
    IconComponent: BadgeTier11PrincipalBenefactor,
    color: '#a855f7',
    border: 'rgba(168, 85, 247, 0.75)',
    bg: 'rgba(168, 85, 247, 0.2)',
    badgeClass: 'tier-11',
    description: 'Cornerstone humanitarian pillar whose extraordinary patronage revitalizes entire calamity zones and infrastructure.'
  },
  {
    tierNumber: 12,
    id: 'tier-12',
    name: 'Legacy Benefactor',
    subtitle: 'Eternal Transcendence Star',
    minPhp: 5000000,
    minEth: 30.00,
    IconComponent: BadgeTier12LegacyBenefactor,
    color: '#00ffa3',
    border: 'rgba(0, 255, 163, 0.85)',
    bg: 'rgba(0, 255, 163, 0.22)',
    badgeClass: 'tier-12',
    description: 'The supreme civilian honor in the Disaster Relief Network, cementing an immortal legacy of life-saving benevolence.'
  }
];

/**
 * ── Global In-Memory & LocalStorage Registry for Cumulative Donor Totals ──
 * Enforces the core rule: BADGES ARE USER-LEVEL, NOT DONATION-LEVEL.
 * One donor/wallet = one global badge determined by cumulative contributions across ALL campaigns.
 */
class DonorRegistry {
  constructor() {
    this.cache = new Map();
    this.listeners = new Set();
    this.loadFromStorage();
    // Auto-fetch backend cumulative totals on initialization
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

    // Cumulative contributions can NEVER decrease!
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
 * Calculates current tier, next tier, and progression percentage strictly based on cumulative donations
 * Accepts either ({ amountEth, amountPhp }) or (amountEth, amountPhp)
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

  // If donor has not made any successful donations yet
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

  // Find the highest tier unlocked
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
    const basePhp = currentTier.minPhp;
    const targetPhp = nextTier.minPhp;
    const clampedPhp = Math.max(basePhp, Math.min(targetPhp, php));
    const range = targetPhp - basePhp;
    progressPct = range > 0 ? Math.min(99, Math.round(((clampedPhp - basePhp) / range) * 100)) : 0;
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
 * Resolves the donor's global cumulative contribution across ALL campaigns.
 */
export default function DonorBadge({
  walletAddress,
  donorId,
  amountEth,
  amountPhp,
  size = 'md', // 'sm' | 'md' | 'lg' | 'xl'
  showTooltip = true,
  interactive = true,
  showProgress = false, // Public ledger & history: strictly false (only badge title + total contributions)
  onClick
}) {
  const [hovered, setHovered] = useState(false);
  const [coords, setCoords] = useState(null);
  const badgeRef = useRef(null);
  const [, setRegistryTick] = useState(0);

  // Re-render whenever global cumulative donor totals update
  useEffect(() => {
    return globalDonorRegistry.subscribe(() => setRegistryTick(t => t + 1));
  }, []);

  // 1. Resolve donor's global cumulative contribution across all campaigns
  const globalStats = globalDonorRegistry.get(walletAddress, donorId);
  const effectiveEth = globalStats?.totalEth !== undefined
    ? globalStats.totalEth
    : (amountEth !== undefined ? parseFloat(amountEth) : 0);
  const effectivePhp = globalStats?.totalPhp !== undefined
    ? globalStats.totalPhp
    : (amountPhp !== undefined ? parseFloat(amountPhp) : (effectiveEth * 170000));

  const tierInfo = getDonorTier({ amountEth: effectiveEth, amountPhp: effectivePhp });
  const { tier, nextTier, progressPct, remainingPhp } = tierInfo;

  // Floating Overlay Positioning: computes exact viewport placement relative to badge
  const updateCoords = () => {
    if (!badgeRef.current) return;
    const rect = badgeRef.current.getBoundingClientRect();
    const tooltipWidth = 220;
    let left = rect.left + rect.width / 2;
    // Clamp to viewport so overlay never spills past screen edges
    left = Math.max(tooltipWidth / 2 + 10, Math.min(window.innerWidth - tooltipWidth / 2 - 10, left));

    // Determine placement: above or below
    // If rect.top < 130 (near top navbar), place below badge; otherwise place above
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

  if (!tier) {
    // Unranked/Newcomer state (₱0 donations): no badge
    return null;
  }

  const Icon = tier.IconComponent;
  const iconPixelSize = size === 'sm' ? 22 : size === 'lg' ? 36 : size === 'xl' ? 48 : 28;

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
        title={showTooltip ? undefined : `${tier.name} • ${tier.subtitle}`}
      >
        {/* Strictly Visual Custom Icon Badge: Zero text inside */}
        <div className="donor-badge-emblem icon-only">
          <Icon size={iconPixelSize} className="donor-badge-custom-icon" />
        </div>
      </div>

      {/* True Floating Overlay Tooltip Card via React Portal (Never cut off by parent containers) */}
      {showTooltip && hovered && coords && typeof document !== 'undefined' && createPortal(
        <div
          className={`donor-badge-tooltip-overlay ${coords.placeBelow ? 'place-below' : 'place-above'}`}
          style={{
            top: `${coords.top}px`,
            left: `${coords.left}px`
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Badge Title Header */}
          <div className="dbt-header">
            <Icon size={19} />
            <span className="dbt-tier-title" style={{ color: tier.color }}>
              {tier.name}
            </span>
            <span className="dbt-rank-tag">VERIFIED</span>
          </div>

          {/* Total Cumulative Contributions */}
          <div className="dbt-stats-row">
            <div className="dbt-stat">
              <span className="dbt-stat-label">Total Contributions</span>
              <span className="dbt-stat-val">
                ₱{Math.round(tierInfo.totalPhp).toLocaleString('en-US')}
              </span>
            </div>
          </div>

          {/* Optional Progress Details (only if explicitly requested on profile/dashboard) */}
          {showProgress && (
            nextTier ? (
              <div className="dbt-progress-block">
                <div className="dbt-progress-header">
                  <span>Next Badge: <strong>{nextTier.name}</strong></span>
                  <span style={{ color: nextTier.color, fontWeight: 700 }}>{progressPct}%</span>
                </div>
                <div className="dbt-progress-track">
                  <div
                    className="dbt-progress-fill"
                    style={{ width: `${progressPct}%`, background: nextTier.color }}
                  />
                </div>
                <div className="dbt-progress-hint">
                  <strong>₱{Math.round(remainingPhp).toLocaleString('en-US')}</strong> more to upgrade
                </div>
              </div>
            ) : (
              <div className="dbt-max-badge">
                <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#00ffa3' }}>verified</span>
                <span>Apex Humanitarian Standing • Highest Tier</span>
              </div>
            )
          )}
        </div>,
        document.body
      )}
    </>
  );
}

/**
 * Donor Progress Card Component
 * Displays on the donor profile dashboard showing current tier, live progress bar to next tier, and upgrade stats
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
  const { tier, nextTier, progressPct, remainingPhp, totalPhp } = tierInfo;

  if (!tier) {
    return (
      <div className="donor-progress-card unranked">
        <div className="dpc-left">
          <div className="dpc-unranked-icon-wrap">
            <BadgeTier1Contributor size={36} className="dpc-unranked-ghost" />
          </div>
          <div className="dpc-info">
            <span className="dpc-eyebrow">Humanitarian Recognition</span>
            <h3 className="dpc-title">Become a Verified Relief Donor</h3>
            <p className="dpc-desc">
              Make your first donation of ₱1 or more to unlock Tier 1 (Contributor) and earn your verified badge.
            </p>
          </div>
        </div>
        <div className="dpc-right">
          <button type="button" className="dpc-ladder-btn" onClick={onOpenLadder}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>military_tech</span>
            <span>View 12-Tier Honors</span>
          </button>
        </div>
      </div>
    );
  }

  const ActiveIcon = tier.IconComponent;
  const NextIcon = nextTier?.IconComponent;

  return (
    <div className={`donor-progress-card ${tier.badgeClass}`}>
      <div className="dpc-main">
        {/* Large Visual Badge Emblem */}
        <div className="dpc-badge-col" onClick={onOpenLadder} title="Click to view full honors ladder">
          <div className="dpc-badge-emblem-wrap">
            <ActiveIcon size={46} />
          </div>
          <span className="dpc-badge-tier-tag" style={{ color: tier.color }}>
            Tier {tier.tierNumber}
          </span>
        </div>

        {/* Info & Progress Column */}
        <div className="dpc-content-col">
          <div className="dpc-header-row">
            <div>
              <div className="dpc-badge-meta-top">
                <span className="dpc-standing-label">Active Donor Standing</span>
                <span className="dpc-verified-pill">
                  <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>verified</span>
                  On-Chain Verified
                </span>
              </div>
              <h2 className="dpc-tier-name" style={{ color: tier.color }}>
                {tier.name}
              </h2>
              <span className="dpc-tier-subtitle">{tier.subtitle}</span>
            </div>

            <div className="dpc-impact-metric">
              <span className="dpc-metric-num">₱{Math.round(totalPhp).toLocaleString('en-US')}</span>
              <span className="dpc-metric-lbl">Cumulative Contributions</span>
            </div>
          </div>

          {/* Real-Time Progress Bar to Next Badge */}
          {nextTier ? (
            <div className="dpc-prog-wrapper">
              <div className="dpc-prog-header">
                <div className="dpc-next-tier-target">
                  <span>Next Upgrade:</span>
                  <div className="dpc-next-pill">
                    {NextIcon && <NextIcon size={14} />}
                    <strong>Tier {nextTier.tierNumber} • {nextTier.name}</strong>
                    <span className="dpc-goal-amount">(₱{nextTier.minPhp.toLocaleString('en-US')} goal)</span>
                  </div>
                </div>
                <span className="dpc-pct-text" style={{ color: nextTier.color }}>
                  {progressPct}%
                </span>
              </div>

              <div className="dpc-prog-track">
                <div
                  className="dpc-prog-bar"
                  style={{
                    width: `${progressPct}%`,
                    background: `linear-gradient(90deg, ${tier.color} 0%, ${nextTier.color} 100%)`
                  }}
                />
              </div>

              <div className="dpc-prog-footer">
                <span className="dpc-prog-remaining">
                  Contribute <strong>₱{Math.round(remainingPhp).toLocaleString('en-US')}</strong> more to automatically upgrade your badge.
                </span>
                <button type="button" className="dpc-ladder-link" onClick={onOpenLadder}>
                  <span>Honors Ladder</span>
                  <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>arrow_forward</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="dpc-apex-banner">
              <div className="dpc-apex-left">
                <span className="material-symbols-outlined" style={{ color: '#00ffa3', fontSize: '20px' }}>military_tech</span>
                <div>
                  <strong>Legacy Benefactor Achieved</strong>
                  <p>You have unlocked the highest humanitarian merit standing in the Philippine Disaster Relief Network.</p>
                </div>
              </div>
              <button type="button" className="dpc-ladder-link" onClick={onOpenLadder}>
                <span>View All Tiers</span>
                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>arrow_forward</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Subtle Badge-Unlocked Celebration Modal
 * Triggers cleanly when a donor unlocks a new tier from cumulative contributions
 */
export function BadgeUpgradeModal({
  newTier,
  isOpen,
  onClose
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
      <div className="donor-upgrade-card fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="donor-upgrade-shimmer" />

        <div className="donor-upgrade-emblem-halo" style={{ borderColor: newTier.border, boxShadow: `0 0 32px ${newTier.color}40` }}>
          <Icon size={72} className="donor-upgrade-svg" />
        </div>

        <span className="donor-upgrade-eyebrow" style={{ color: newTier.color }}>
          HUMANITARIAN STANDING UPGRADED
        </span>

        <h2 className="donor-upgrade-title">
          Tier {newTier.tierNumber} Unlocked!
        </h2>
        <h3 className="donor-upgrade-tier-name" style={{ color: newTier.color }}>
          {newTier.name}
        </h3>
        <p className="donor-upgrade-subtitle">{newTier.subtitle}</p>

        <p className="donor-upgrade-desc">
          {newTier.description}
        </p>

        <div className="donor-upgrade-badge-seal">
          <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#10b981' }}>verified</span>
          <span>Verified On-Chain Merit Credential</span>
        </div>

        <button type="button" className="btn btn-primary btn-full" onClick={onClose} style={{ marginTop: '16px' }}>
          Continue to Dashboard
        </button>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : null;
}

/**
 * 12-Tier Honors Ladder Modal
 * True fixed portal overlay (Never cut off or displaced by page scrolling or parent containers)
 */
export function DonorTierModal({
  isOpen,
  onClose,
  walletAddress,
  donorId,
  totalDonatedEth = 0,
  totalDonatedPhp = 0,
  donationCount = 0,
  donorName = 'Verified Donor'
}) {
  // Lock body scroll and handle escape key when modal is open
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

  if (!isOpen) return null;

  const globalStats = globalDonorRegistry.get(walletAddress, donorId);
  const effectiveEth = globalStats?.totalEth !== undefined ? globalStats.totalEth : totalDonatedEth;
  const effectivePhp = globalStats?.totalPhp !== undefined ? globalStats.totalPhp : (totalDonatedPhp || (effectiveEth * 170000));

  const tierInfo = getDonorTier({
    amountEth: effectiveEth,
    amountPhp: effectivePhp
  });

  const { tier: activeTier, nextTier, progressPct, remainingPhp, totalPhp } = tierInfo;
  const ActiveIcon = activeTier ? activeTier.IconComponent : BadgeTier1Contributor;

  const modalNode = (
    <div className="donor-modal-backdrop" onClick={onClose}>
      <div className="donor-modal-card fade-in" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="donor-modal-header">
          <div className="donor-modal-title-wrap">
            <div className="donor-modal-badge-preview" style={{ background: activeTier ? activeTier.bg : 'rgba(255,255,255,0.05)', borderColor: activeTier ? activeTier.border : 'rgba(255,255,255,0.1)' }}>
              <ActiveIcon size={34} />
            </div>
            <div>
              <h3 className="donor-modal-title">Humanitarian Honors & Badge System</h3>
              <p className="donor-modal-subtitle">
                12 progressive merit tiers unlocked automatically via cumulative platform-wide donations.
              </p>
            </div>
          </div>
          <button type="button" className="donor-modal-close" onClick={onClose} title="Close honors ladder">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Active Standing Banner */}
        <div className="donor-current-card" style={{ borderColor: activeTier ? activeTier.border : 'rgba(255,255,255,0.1)' }}>
          <div className="donor-current-top">
            <div>
              <span className="donor-current-eyebrow">Your Active Standing</span>
              <h2 className="donor-current-name" style={{ color: activeTier ? activeTier.color : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ActiveIcon size={26} />
                <span>{activeTier ? `Tier ${activeTier.tierNumber}: ${activeTier.name}` : 'Unranked Donor'}</span>
              </h2>
              <span className="donor-current-sub">{activeTier ? activeTier.subtitle : 'Make your first donation of ₱1+ to earn Contributor'}</span>
            </div>
            <div className="donor-current-metric">
              <span className="donor-metric-amt">₱{Math.round(totalPhp).toLocaleString('en-US')}</span>
              <span className="donor-metric-lbl">Cumulative Contributions</span>
            </div>
          </div>

          {activeTier && <p className="donor-current-desc">{activeTier.description}</p>}

          {/* Progress to Next Tier */}
          {nextTier && (
            <div className="donor-ladder-prog">
              <div className="donor-ladder-prog-hdr">
                <span>Progress to <strong>Tier {nextTier.tierNumber} ({nextTier.name})</strong></span>
                <span style={{ color: nextTier.color, fontWeight: 700 }}>{progressPct}%</span>
              </div>
              <div className="donor-ladder-prog-track">
                <div
                  className="donor-ladder-prog-fill"
                  style={{
                    width: `${progressPct}%`,
                    background: activeTier
                      ? `linear-gradient(90deg, ${activeTier.color}, ${nextTier.color})`
                      : nextTier.color
                  }}
                />
              </div>
              <div className="donor-ladder-prog-ftr">
                <span>Contribute <strong>₱{Math.round(remainingPhp).toLocaleString('en-US')}</strong> more to reach Tier {nextTier.tierNumber}.</span>
              </div>
            </div>
          )}
        </div>

        {/* Complete 12-Tier Roadmap List */}
        <div className="donor-ladder-title">
          <span>12-Tier Disaster Relief Roadmap</span>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Automated Real-Time Recognition</span>
        </div>

        <div className="donor-ladder-list">
          {DONOR_TIERS.map((t) => {
            const isCurrent = activeTier?.id === t.id;
            const isUnlocked = totalPhp >= t.minPhp;
            const TierIcon = t.IconComponent;

            return (
              <div
                key={t.id}
                className={`donor-tier-row ${isCurrent ? 'is-active' : ''} ${isUnlocked ? 'is-unlocked' : 'is-locked'}`}
                style={{ borderColor: isCurrent ? t.border : undefined }}
              >
                <div className="donor-tier-left">
                  <div className="donor-tier-icon-circle" style={{ background: t.bg, borderColor: t.border }}>
                    <TierIcon size={26} />
                  </div>
                  <div className="donor-tier-details">
                    <div className="donor-tier-row-hdr">
                      <span className="donor-tier-row-name" style={{ color: isCurrent ? t.color : 'var(--text-primary)' }}>
                        Tier {t.tierNumber}: {t.name}
                      </span>
                      {isCurrent && <span className="donor-tier-current-tag">ACTIVE BADGE</span>}
                      {isUnlocked && !isCurrent && <span className="donor-tier-unlocked-tag">UNLOCKED</span>}
                    </div>
                    <div className="donor-tier-row-sub">{t.subtitle}</div>
                    <div className="donor-tier-row-crit">
                      ₱{t.minPhp.toLocaleString('en-US')} cumulative donation threshold ({t.minEth} ETH)
                    </div>
                  </div>
                </div>

                <div className="donor-tier-badge-visual">
                  <div className="donor-badge-emblem icon-only" title={`Tier ${t.tierNumber}: ${t.name}`}>
                    <TierIcon size={28} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="donor-modal-footer">
          <div className="donor-footer-verified">
            <span className="material-symbols-outlined" style={{ color: '#10b981', fontSize: '16px' }}>verified_user</span>
            <span>All donor badge credentials cryptographically verifiable on Sepolia EVM Ledger</span>
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : null;
}
