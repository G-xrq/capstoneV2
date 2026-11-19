import React from 'react';

/**
 * BBDRTS Master Brand Logo (Vector SVG)
 * Blockchain-Based Donation & Relief Transparency System
 * Features: Outer cryptographic hexagonal shield, 3D relief crystal prism, and central glowing heart core.
 */
export default function BbdrtsLogo({ size = 32, className = '', style = {} }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 512 512" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={`bbdrts-brand-logo-svg ${className}`}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      aria-label="BBDRTS Logo"
    >
      <defs>
        <radialGradient id="bbdrtsAmbientGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.25"/>
          <stop offset="70%" stopColor="#06b6d4" stopOpacity="0.08"/>
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0"/>
        </radialGradient>
        
        <linearGradient id="bbdrtsShieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34d399"/>
          <stop offset="40%" stopColor="#10b981"/>
          <stop offset="80%" stopColor="#06b6d4"/>
          <stop offset="100%" stopColor="#3b82f6"/>
        </linearGradient>

        <linearGradient id="bbdrtsTopFacet" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6ee7b7"/>
          <stop offset="100%" stopColor="#10b981"/>
        </linearGradient>

        <linearGradient id="bbdrtsLeftFacet" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#059669"/>
          <stop offset="100%" stopColor="#047857"/>
        </linearGradient>

        <linearGradient id="bbdrtsRightFacet" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4"/>
          <stop offset="100%" stopColor="#0284c7"/>
        </linearGradient>

        <linearGradient id="bbdrtsHeartCore" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff"/>
          <stop offset="40%" stopColor="#a7f3d0"/>
          <stop offset="100%" stopColor="#38bdf8"/>
        </linearGradient>

        <filter id="bbdrtsCoreGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="6" floodColor="#06b6d4" floodOpacity="0.5"/>
        </filter>
      </defs>

      {/* Ambient Radial Glow */}
      <circle cx="256" cy="256" r="235" fill="url(#bbdrtsAmbientGlow)"/>

      {/* Outer Hexagonal Shield Ring */}
      <path 
        d="M256 36 L446 146 L446 366 L256 476 L66 366 L66 146 Z" 
        stroke="url(#bbdrtsShieldGrad)" 
        strokeWidth="18" 
        strokeLinejoin="round" 
        strokeLinecap="round"
        fill="rgba(16, 185, 129, 0.05)" 
      />

      {/* Inner Interconnecting Blockchain Nodes */}
      {/* Top Roof / Relief Shelter Cap */}
      <path 
        d="M256 110 L386 185 L256 260 L126 185 Z" 
        fill="url(#bbdrtsTopFacet)" 
        stroke="rgba(255, 255, 255, 0.3)"
        strokeWidth="2"
        strokeLinejoin="round" 
      />

      {/* Left Facet (Security / Trust Node) */}
      <path 
        d="M126 185 L256 260 L256 410 L126 335 Z" 
        fill="url(#bbdrtsLeftFacet)" 
        stroke="rgba(255, 255, 255, 0.15)"
        strokeWidth="2"
        strokeLinejoin="round" 
      />

      {/* Right Facet (Transparency / Verification Node) */}
      <path 
        d="M256 260 L386 185 L386 335 L256 410 Z" 
        fill="url(#bbdrtsRightFacet)" 
        stroke="rgba(255, 255, 255, 0.2)"
        strokeWidth="2"
        strokeLinejoin="round" 
      />

      {/* Dynamic Center Heart Prism (Donation & Relief Core) */}
      <path 
        d="M256 180 C272 152 316 152 330 186 C342 216 318 246 256 294 C194 246 170 216 182 186 C196 152 240 152 256 180 Z" 
        fill="url(#bbdrtsHeartCore)"
        filter="url(#bbdrtsCoreGlow)" 
      />

      {/* Cryptographic Node Vertices */}
      <circle cx="256" cy="36" r="12" fill="#34d399"/>
      <circle cx="446" cy="146" r="12" fill="#38bdf8"/>
      <circle cx="446" cy="366" r="12" fill="#06b6d4"/>
      <circle cx="256" cy="476" r="12" fill="#10b981"/>
      <circle cx="66" cy="366" r="12" fill="#059669"/>
      <circle cx="66" cy="146" r="12" fill="#6ee7b7"/>

      {/* Light highlights inside vertices */}
      <circle cx="256" cy="36" r="5" fill="#ffffff"/>
      <circle cx="446" cy="146" r="5" fill="#ffffff"/>
      <circle cx="446" cy="366" r="5" fill="#ffffff"/>
      <circle cx="256" cy="476" r="5" fill="#ffffff"/>
      <circle cx="66" cy="366" r="5" fill="#ffffff"/>
      <circle cx="66" cy="146" r="5" fill="#ffffff"/>
      
      {/* Subtle Internal Crystal Dash Rays */}
      <line x1="256" y1="36" x2="256" y2="110" stroke="#34d399" strokeWidth="6" strokeLinecap="round" strokeDasharray="3 7"/>
      <line x1="446" y1="146" x2="386" y2="185" stroke="#38bdf8" strokeWidth="6" strokeLinecap="round" strokeDasharray="3 7"/>
      <line x1="446" y1="366" x2="386" y2="335" stroke="#06b6d4" strokeWidth="6" strokeLinecap="round" strokeDasharray="3 7"/>
      <line x1="256" y1="476" x2="256" y2="410" stroke="#10b981" strokeWidth="6" strokeLinecap="round" strokeDasharray="3 7"/>
      <line x1="66" y1="366" x2="126" y2="335" stroke="#059669" strokeWidth="6" strokeLinecap="round" strokeDasharray="3 7"/>
      <line x1="66" y1="146" x2="126" y2="185" stroke="#6ee7b7" strokeWidth="6" strokeLinecap="round" strokeDasharray="3 7"/>
    </svg>
  );
}
