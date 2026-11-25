import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import PH_PROVINCES_GEOJSON from '../data/philippines_provinces.json';
import { getWorkspaceStrings } from '../data/workspaceTranslations';
import './DisasterRadarHeatmap.css';

// ── Philippine Geographical Centroids & Region Lookups (All 82 Official Provinces) ────
const PH_LOCATIONS = {
  // ── Region I – Ilocos Region ──
  'ilocos norte': { name: 'Ilocos Norte', region: 'Ilocos Region (Region I)', lat: 18.1960, lng: 120.5927 },
  'ilocos sur': { name: 'Ilocos Sur', region: 'Ilocos Region (Region I)', lat: 17.5705, lng: 120.3871 },
  'la union': { name: 'La Union', region: 'Ilocos Region (Region I)', lat: 16.6159, lng: 120.3209 },
  'pangasinan': { name: 'Pangasinan', region: 'Ilocos Region (Region I)', lat: 15.9758, lng: 120.3484 },

  // ── Region II – Cagayan Valley ──
  'batanes': { name: 'Batanes', region: 'Cagayan Valley (Region II)', lat: 20.4485, lng: 121.9708 },
  'cagayan': { name: 'Cagayan', region: 'Cagayan Valley (Region II)', lat: 17.6132, lng: 121.7270 },
  'isabela': { name: 'Isabela', region: 'Cagayan Valley (Region II)', lat: 16.9754, lng: 121.8107 },
  'nueva vizcaya': { name: 'Nueva Vizcaya', region: 'Cagayan Valley (Region II)', lat: 16.3225, lng: 121.1444 },
  'quirino': { name: 'Quirino', region: 'Cagayan Valley (Region II)', lat: 16.2750, lng: 121.5750 },

  // ── Region III – Central Luzon ──
  'aurora': { name: 'Aurora', region: 'Central Luzon (Region III)', lat: 15.7500, lng: 121.5500 },
  'bataan': { name: 'Bataan', region: 'Central Luzon (Region III)', lat: 14.6417, lng: 120.4770 },
  'bulacan': { name: 'Bulacan', region: 'Central Luzon (Region III)', lat: 14.8527, lng: 120.8160 },
  'nueva ecija': { name: 'Nueva Ecija', region: 'Central Luzon (Region III)', lat: 15.4865, lng: 120.9702 },
  'pampanga': { name: 'Pampanga', region: 'Central Luzon (Region III)', lat: 15.0343, lng: 120.6844 },
  'tarlac': { name: 'Tarlac', region: 'Central Luzon (Region III)', lat: 15.4802, lng: 120.5979 },
  'zambales': { name: 'Zambales', region: 'Central Luzon (Region III)', lat: 15.3167, lng: 120.0667 },

  // ── Region IV-A – CALABARZON ──
  'batangas': { name: 'Batangas', region: 'CALABARZON (Region IV-A)', lat: 13.7565, lng: 121.0583 },
  'cavite': { name: 'Cavite', region: 'CALABARZON (Region IV-A)', lat: 14.2833, lng: 120.9167 },
  'laguna': { name: 'Laguna', region: 'CALABARZON (Region IV-A)', lat: 14.2691, lng: 121.3986 },
  'quezon': { name: 'Quezon', region: 'CALABARZON (Region IV-A)', lat: 14.0269, lng: 121.9248 },
  'rizal': { name: 'Rizal', region: 'CALABARZON (Region IV-A)', lat: 14.6037, lng: 121.3084 },

  // ── Region IV-B – MIMAROPA ──
  'marinduque': { name: 'Marinduque', region: 'MIMAROPA (Region IV-B)', lat: 13.4167, lng: 121.9000 },
  'occidental mindoro': { name: 'Occidental Mindoro', region: 'MIMAROPA (Region IV-B)', lat: 13.0000, lng: 120.9167 },
  'oriental mindoro': { name: 'Oriental Mindoro', region: 'MIMAROPA (Region IV-B)', lat: 13.1500, lng: 121.3000 },
  'palawan': { name: 'Palawan', region: 'MIMAROPA (Region IV-B)', lat: 9.8349, lng: 118.7384 },
  'romblon': { name: 'Romblon', region: 'MIMAROPA (Region IV-B)', lat: 12.5500, lng: 122.2833 },

  // ── Region V – Bicol Region ──
  'albay': { name: 'Albay', region: 'Bicol Region (Region V)', lat: 13.1391, lng: 123.7438 },
  'camarines norte': { name: 'Camarines Norte', region: 'Bicol Region (Region V)', lat: 14.1167, lng: 122.9500 },
  'camarines sur': { name: 'Camarines Sur', region: 'Bicol Region (Region V)', lat: 13.6218, lng: 123.1948 },
  'catanduanes': { name: 'Catanduanes', region: 'Bicol Region (Region V)', lat: 13.7667, lng: 124.2333 },
  'masbate': { name: 'Masbate', region: 'Bicol Region (Region V)', lat: 12.3700, lng: 123.6300 },
  'sorsogon': { name: 'Sorsogon', region: 'Bicol Region (Region V)', lat: 12.9738, lng: 124.0058 },

  // ── Region VI – Western Visayas ──
  'aklan': { name: 'Aklan', region: 'Western Visayas (Region VI)', lat: 11.7076, lng: 122.3662 },
  'antique': { name: 'Antique', region: 'Western Visayas (Region VI)', lat: 10.7500, lng: 122.0000 },
  'capiz': { name: 'Capiz', region: 'Western Visayas (Region VI)', lat: 11.5853, lng: 122.7511 },
  'guimaras': { name: 'Guimaras', region: 'Western Visayas (Region VI)', lat: 10.5667, lng: 122.5833 },
  'iloilo': { name: 'Iloilo', region: 'Western Visayas (Region VI)', lat: 10.7202, lng: 122.5621 },

  // ── Region VII – Central Visayas ──
  'bohol': { name: 'Bohol', region: 'Central Visayas (Region VII)', lat: 9.8500, lng: 124.2000 },
  'cebu': { name: 'Cebu', region: 'Central Visayas (Region VII)', lat: 10.3157, lng: 123.8854 },
  'siquijor': { name: 'Siquijor', region: 'Central Visayas (Region VII)', lat: 9.2000, lng: 123.5500 },

  // ── Region VIII – Eastern Visayas ──
  'biliran': { name: 'Biliran', region: 'Eastern Visayas (Region VIII)', lat: 11.5500, lng: 124.5000 },
  'eastern samar': { name: 'Eastern Samar', region: 'Eastern Visayas (Region VIII)', lat: 11.6000, lng: 125.4500 },
  'leyte': { name: 'Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.9500, lng: 124.8500 },
  'northern samar': { name: 'Northern Samar', region: 'Eastern Visayas (Region VIII)', lat: 12.4500, lng: 124.6500 },
  'samar': { name: 'Samar', region: 'Eastern Visayas (Region VIII)', lat: 11.7500, lng: 124.9500 },
  'southern leyte': { name: 'Southern Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.2500, lng: 124.9500 },

  // ── Region IX – Zamboanga Peninsula ──
  'sulu': { name: 'Sulu', region: 'Zamboanga Peninsula (Region IX)', lat: 6.0000, lng: 121.0000 },
  'zamboanga del norte': { name: 'Zamboanga del Norte', region: 'Zamboanga Peninsula (Region IX)', lat: 8.2500, lng: 123.0000 },
  'zamboanga del sur': { name: 'Zamboanga del Sur', region: 'Zamboanga Peninsula (Region IX)', lat: 7.8000, lng: 123.2500 },
  'zamboanga sibugay': { name: 'Zamboanga Sibugay', region: 'Zamboanga Peninsula (Region IX)', lat: 7.7500, lng: 122.7500 },

  // ── Region X – Northern Mindanao ──
  'bukidnon': { name: 'Bukidnon', region: 'Northern Mindanao (Region X)', lat: 8.1575, lng: 125.1278 },
  'camiguin': { name: 'Camiguin', region: 'Northern Mindanao (Region X)', lat: 9.1736, lng: 124.7297 },
  'lanao del norte': { name: 'Lanao del Norte', region: 'Northern Mindanao (Region X)', lat: 8.0000, lng: 124.0000 },
  'misamis occidental': { name: 'Misamis Occidental', region: 'Northern Mindanao (Region X)', lat: 8.3500, lng: 123.7500 },
  'misamis oriental': { name: 'Misamis Oriental', region: 'Northern Mindanao (Region X)', lat: 8.4542, lng: 124.6319 },

  // ── Region XI – Davao Region ──
  'davao de oro': { name: 'Davao de Oro', region: 'Davao Region (Region XI)', lat: 7.6000, lng: 126.0000 },
  'davao del norte': { name: 'Davao del Norte', region: 'Davao Region (Region XI)', lat: 7.5700, lng: 125.7500 },
  'davao del sur': { name: 'Davao del Sur', region: 'Davao Region (Region XI)', lat: 6.8500, lng: 125.3500 },
  'davao occidental': { name: 'Davao Occidental', region: 'Davao Region (Region XI)', lat: 6.0000, lng: 125.6000 },
  'davao oriental': { name: 'Davao Oriental', region: 'Davao Region (Region XI)', lat: 7.3000, lng: 126.3000 },

  // ── Region XII – SOCCSKSARGEN ──
  'cotabato': { name: 'Cotabato', region: 'SOCCSKSARGEN (Region XII)', lat: 7.2000, lng: 124.9000 },
  'sarangani': { name: 'Sarangani', region: 'SOCCSKSARGEN (Region XII)', lat: 5.9500, lng: 125.1000 },
  'south cotabato': { name: 'South Cotabato', region: 'SOCCSKSARGEN (Region XII)', lat: 6.2500, lng: 124.8500 },
  'sultan kudarat': { name: 'Sultan Kudarat', region: 'SOCCSKSARGEN (Region XII)', lat: 6.6000, lng: 124.4000 },

  // ── Region XIII – Caraga ──
  'agusan del norte': { name: 'Agusan del Norte', region: 'Caraga (Region XIII)', lat: 8.9475, lng: 125.5406 },
  'agusan del sur': { name: 'Agusan del Sur', region: 'Caraga (Region XIII)', lat: 8.5000, lng: 125.8000 },
  'dinagat islands': { name: 'Dinagat Islands', region: 'Caraga (Region XIII)', lat: 10.1300, lng: 125.6000 },
  'surigao del norte': { name: 'Surigao del Norte', region: 'Caraga (Region XIII)', lat: 9.7892, lng: 125.4957 },
  'surigao del sur': { name: 'Surigao del Sur', region: 'Caraga (Region XIII)', lat: 8.6500, lng: 126.1500 },

  // ── BARMM ──
  'basilan': { name: 'Basilan', region: 'BARMM', lat: 6.5500, lng: 122.0000 },
  'lanao del sur': { name: 'Lanao del Sur', region: 'BARMM', lat: 7.8500, lng: 124.3000 },
  'maguindanao del norte': { name: 'Maguindanao del Norte', region: 'BARMM', lat: 7.2000, lng: 124.2500 },
  'maguindanao del sur': { name: 'Maguindanao del Sur', region: 'BARMM', lat: 6.9500, lng: 124.5000 },
  'tawi-tawi': { name: 'Tawi-Tawi', region: 'BARMM', lat: 5.1500, lng: 120.0000 },

  // ── Cordillera Administrative Region (CAR) ──
  'abra': { name: 'Abra', region: 'Cordillera Administrative Region (CAR)', lat: 17.6000, lng: 120.7500 },
  'apayao': { name: 'Apayao', region: 'Cordillera Administrative Region (CAR)', lat: 18.0000, lng: 121.2500 },
  'benguet': { name: 'Benguet', region: 'Cordillera Administrative Region (CAR)', lat: 16.5000, lng: 120.6000 },
  'ifugao': { name: 'Ifugao', region: 'Cordillera Administrative Region (CAR)', lat: 16.8500, lng: 121.1500 },
  'kalinga': { name: 'Kalinga', region: 'Cordillera Administrative Region (CAR)', lat: 17.4000, lng: 121.2000 },
  'mountain province': { name: 'Mountain Province', region: 'Cordillera Administrative Region (CAR)', lat: 17.0833, lng: 121.0000 },

  // ── Negros Island Region (NIR) ──
  'negros occidental': { name: 'Negros Occidental', region: 'Negros Island Region (NIR)', lat: 10.6765, lng: 122.9509 },
  'negros oriental': { name: 'Negros Oriental', region: 'Negros Island Region (NIR)', lat: 9.3068, lng: 123.3054 },

  // ── Capital Region ──
  'metro manila': { name: 'Metro Manila (NCR)', region: 'National Capital Region', lat: 14.5995, lng: 120.9842 },
  'ncr': { name: 'Metro Manila (NCR)', region: 'National Capital Region', lat: 14.5995, lng: 120.9842 },
  'manila': { name: 'City of Manila', region: 'National Capital Region', lat: 14.5995, lng: 120.9842 },
  'quezon city': { name: 'Quezon City', region: 'National Capital Region', lat: 14.6760, lng: 121.0437 },

  // ── Aliases & Alternate Names ──
  'compostela valley': { name: 'Davao de Oro', region: 'Davao Region (Region XI)', lat: 7.6000, lng: 126.0000 },
  'north cotabato': { name: 'Cotabato', region: 'SOCCSKSARGEN (Region XII)', lat: 7.2000, lng: 124.9000 },
  'western samar': { name: 'Samar', region: 'Eastern Visayas (Region VIII)', lat: 11.7500, lng: 124.9500 },
  'maguindanao': { name: 'Maguindanao del Sur', region: 'BARMM', lat: 6.9500, lng: 124.5000 },
  'shariff kabunsuan': { name: 'Maguindanao del Norte', region: 'BARMM', lat: 7.2000, lng: 124.2500 },
  'dinagat': { name: 'Dinagat Islands', region: 'Caraga (Region XIII)', lat: 10.1300, lng: 125.6000 },
  'mindoro': { name: 'Mindoro Island', region: 'MIMAROPA (Region IV-B)', lat: 13.1500, lng: 121.3000 },

  // ── Municipal & Barangay Hubs (Preserving Granular Pins) ──
  'tagnipa': { name: 'Brgy. Tagnipa, Maasin City', region: 'Eastern Visayas (Region VIII)', lat: 10.1385, lng: 124.8605 },
  'combado': { name: 'Brgy. Combado, Maasin City', region: 'Eastern Visayas (Region VIII)', lat: 10.1335, lng: 124.8732 },
  'dongon': { name: 'Brgy. Dongon, Maasin City', region: 'Eastern Visayas (Region VIII)', lat: 10.1430, lng: 124.8850 },
  'mantahan': { name: 'Brgy. Mantahan, Maasin City', region: 'Eastern Visayas (Region VIII)', lat: 10.1290, lng: 124.8700 },
  'asuncion': { name: 'Brgy. Asuncion, Maasin City', region: 'Eastern Visayas (Region VIII)', lat: 10.1250, lng: 124.8580 },
  'maasin': { name: 'Maasin City, Southern Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.1333, lng: 124.8667 },
  'macrohon': { name: 'Macrohon, Southern Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.0500, lng: 124.9500 },
  'sogod': { name: 'Sogod, Southern Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.3800, lng: 124.9800 },
  'malitbog': { name: 'Malitbog, Southern Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.1600, lng: 125.0000 },
  'bontoc': { name: 'Bontoc, Southern Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.3600, lng: 124.9600 },
  'saint bernard': { name: 'Saint Bernard, Southern Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.3200, lng: 125.1300 },
  'liloan': { name: 'Liloan, Southern Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.1600, lng: 125.1300 },
  'san juan': { name: 'San Juan, Southern Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.2700, lng: 125.1800 },
  'hinunangan': { name: 'Hinunangan, Southern Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.4000, lng: 125.2000 },
  'hinundayan': { name: 'Hinundayan, Southern Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.3500, lng: 125.2500 },
  'silago': { name: 'Silago, Southern Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.5300, lng: 125.1600 },
  'limasawa': { name: 'Limasawa Island, Southern Leyte', region: 'Eastern Visayas (Region VIII)', lat: 9.9200, lng: 125.0700 },
  'padre burgos': { name: 'Padre Burgos, Southern Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.0800, lng: 125.0200 },
  'tacloban': { name: 'Tacloban City, Leyte', region: 'Eastern Visayas (Region VIII)', lat: 11.2433, lng: 125.0047 },
  'ormoc': { name: 'Ormoc City, Leyte', region: 'Eastern Visayas (Region VIII)', lat: 11.0050, lng: 124.6075 },
  'guiuan': { name: 'Guiuan, Eastern Samar', region: 'Eastern Visayas (Region VIII)', lat: 11.0300, lng: 125.7200 },
  'borongan': { name: 'Borongan City, Eastern Samar', region: 'Eastern Visayas (Region VIII)', lat: 11.6075, lng: 125.4319 },
  'catbalogan': { name: 'Catbalogan City, Samar', region: 'Eastern Visayas (Region VIII)', lat: 11.7800, lng: 124.8800 },
  'tagbilaran': { name: 'Tagbilaran City, Bohol', region: 'Central Visayas (Region VII)', lat: 9.6729, lng: 123.8730 },
  'montesuerte': { name: 'Carmen / Montesuerte, Bohol', region: 'Central Visayas (Region VII)', lat: 9.8728, lng: 124.2083 },
  'mandaue': { name: 'Mandaue City, Cebu', region: 'Central Visayas (Region VII)', lat: 10.3333, lng: 123.9333 },
  'dumaguete': { name: 'Dumaguete City, Negros Oriental', region: 'Negros Island Region (NIR)', lat: 9.3068, lng: 123.3054 },
  'bacolod': { name: 'Bacolod City, Negros Occidental', region: 'Negros Island Region (NIR)', lat: 10.6765, lng: 122.9509 },
  'legazpi': { name: 'Legazpi City, Albay', region: 'Bicol Region (Region V)', lat: 13.1391, lng: 123.7438 },
  'naga': { name: 'Naga City, Camarines Sur', region: 'Bicol Region (Region V)', lat: 13.6218, lng: 123.1948 },
  'baguio': { name: 'Baguio City', region: 'Cordillera Administrative Region (CAR)', lat: 16.4023, lng: 120.5960 },
  'davao city': { name: 'Davao City', region: 'Davao Region (Region XI)', lat: 7.1907, lng: 125.4553 },
  'cagayan de oro': { name: 'Cagayan de Oro City', region: 'Northern Mindanao (Region X)', lat: 8.4542, lng: 124.6319 },
  'butuan': { name: 'Butuan City', region: 'Caraga (Region XIII)', lat: 8.9475, lng: 125.5406 },
  'general santos': { name: 'General Santos City', region: 'SOCCSKSARGEN (Region XII)', lat: 6.1164, lng: 125.1716 },
  'marawi': { name: 'Marawi City / Lanao del Sur', region: 'BARMM', lat: 8.0000, lng: 124.2800 },
  'zamboanga city': { name: 'Zamboanga City', region: 'Zamboanga Peninsula (Region IX)', lat: 6.9214, lng: 122.0790 }
};

// ── Disaster Severity Alert Scale (GDACS / FEMA International 6-Tier System) ──
const DOPPLER_TIERS = {
  1: {
    level: 1,
    label: 'Low Need',
    rainDesc: 'Level 1: Low Need (1 Cause)',
    rangeTag: '1 Cause',
    min: 1,
    max: 1,
    color: '#0284c7', // Rich Cerulean Blue
    glowColor: 'rgba(2, 132, 199, 0.40)',
    badgeBg: '#0284c7',
    badgeText: '#ffffff',
    pulseSpeed: '3.2s',
    cloudRadius: 9000,
    coreRadius: 3500,
    badgeClass: 'tier-cyan'
  },
  2: {
    level: 2,
    label: 'Moderate Need',
    rainDesc: 'Level 2: Moderate Need (2–3 Causes)',
    rangeTag: '2–3 Causes',
    min: 2,
    max: 3,
    color: '#2563eb', // Rich Cobalt Blue
    glowColor: 'rgba(37, 99, 235, 0.40)',
    badgeBg: '#2563eb',
    badgeText: '#ffffff',
    pulseSpeed: '2.6s',
    cloudRadius: 12000,
    coreRadius: 4800,
    badgeClass: 'tier-blue'
  },
  3: {
    level: 3,
    label: 'High Need',
    rainDesc: 'Level 3: High Need (4–6 Causes)',
    rangeTag: '4–6 Causes',
    min: 4,
    max: 6,
    color: '#f59e0b', // Rich Radiant Golden Sun Amber (Warm & Visible)
    glowColor: 'rgba(245, 158, 11, 0.45)',
    badgeBg: '#d97706',
    badgeText: '#ffffff',
    pulseSpeed: '2.0s',
    cloudRadius: 15000,
    coreRadius: 6200,
    badgeClass: 'tier-yellow'
  },
  4: {
    level: 4,
    label: 'Severe Need',
    rainDesc: 'Level 4: Severe Need (7–11 Causes)',
    rangeTag: '7–11 Causes',
    min: 7,
    max: 11,
    color: '#ea580c', // Deep Vibrant Alert Fire Orange (Never Muddy Brown)
    glowColor: 'rgba(234, 88, 12, 0.45)',
    badgeBg: '#ea580c',
    badgeText: '#ffffff',
    pulseSpeed: '1.6s',
    cloudRadius: 19000,
    coreRadius: 7800,
    badgeClass: 'tier-orange'
  },
  5: {
    level: 5,
    label: 'Critical Need',
    rainDesc: 'Level 5: Critical Need (12–19 Causes)',
    rangeTag: '12–19 Causes',
    min: 12,
    max: 19,
    color: '#dc2626', // Deep Emergency Crimson Red (Crisp & Pure)
    glowColor: 'rgba(220, 38, 38, 0.50)',
    badgeBg: '#dc2626',
    badgeText: '#ffffff',
    pulseSpeed: '1.2s',
    cloudRadius: 23000,
    coreRadius: 9500,
    badgeClass: 'tier-red'
  },
  6: {
    level: 6,
    label: 'Maximum Urgency',
    rainDesc: 'Level 6: Maximum Urgency (20+ Causes)',
    rangeTag: '20+ Causes',
    min: 20,
    max: Infinity,
    color: '#7c3aed', // Deep Electric Royal Violet Purple
    glowColor: 'rgba(124, 58, 237, 0.55)',
    badgeBg: '#7c3aed',
    badgeText: '#ffffff',
    borderColor: 'rgba(255, 255, 255, 0.85)',
    pulseSpeed: '0.9s',
    cloudRadius: 28000,
    coreRadius: 11500,
    badgeClass: 'tier-purple'
  }
};

const getTier = (count) => {
  if (count <= 0) return null;
  if (count <= 1) return DOPPLER_TIERS[1];
  if (count <= 3) return DOPPLER_TIERS[2];
  if (count <= 6) return DOPPLER_TIERS[3];
  if (count <= 11) return DOPPLER_TIERS[4];
  if (count <= 19) return DOPPLER_TIERS[5];
  return DOPPLER_TIERS[6];
};

const resolveCampaignCoords = (campaign) => {
  const gpsStr = campaign.gpsCoordinates || campaign.gps_coordinates || '';
  if (gpsStr && typeof gpsStr === 'string') {
    const matchDeg = gpsStr.match(/(\d+\.?\d*)\s*°?\s*([NS])?[\s,]+(\d+\.?\d*)\s*°?\s*([EW])?/i);
    if (matchDeg) {
      let lat = parseFloat(matchDeg[1]);
      let lng = parseFloat(matchDeg[3]);
      if ((matchDeg[2] || '').toUpperCase() === 'S') lat = -lat;
      if ((matchDeg[4] || '').toUpperCase() === 'W') lng = -lng;
      if (!isNaN(lat) && !isNaN(lng) && lat > 4 && lat < 22 && lng > 115 && lng < 130) {
        return [lat, lng];
      }
    }
    const matchSimple = gpsStr.match(/(-?\d+\.\d+)[\s,]+(-?\d+\.\d+)/);
    if (matchSimple) {
      const lat = parseFloat(matchSimple[1]);
      const lng = parseFloat(matchSimple[2]);
      if (!isNaN(lat) && !isNaN(lng) && lat > 4 && lat < 22 && lng > 115 && lng < 130) {
        return [lat, lng];
      }
    }
  }

  // Clean text for province/regional matching by stripping street names & infrastructure words
  // so that "Rizal Street", "Rizal Ave", "Jose Rizal St", "Quezon Blvd", etc. are never mistaken for provinces!
  const cleanLoc = stripStreetInfrastructure(campaign.locationRegion || '');
  const cleanTitle = stripStreetInfrastructure(campaign.title || '');
  const text = `${cleanLoc} ${cleanTitle}`.toLowerCase();

  for (const [key, val] of Object.entries(PH_LOCATIONS)) {
    if (key === 'rizal') {
      if (text.includes('albay') || text.includes('bicol') || text.includes('leyte') || text.includes('visayas') || text.includes('mindanao')) continue;
      const hasRizalTown = /antipolo|cainta|taytay|binangonan|san mateo|tanay|morong|angono|baras|cardona|jalajala|jala-jala|pililla|teresa|montalban|\brodriguez\b/i.test(text);
      const isRizalProvince = /\bprovince\s+of\s+rizal\b|\brizal\s+province\b/i.test(text) ||
        (/\brizal\b/i.test(text) && (/calabarzon|region\s+iv-a/i.test(text) || !text.includes('street')));
      if (!hasRizalTown && !isRizalProvince) continue;
    }
    if (text.includes(key)) {
      return [val.lat, val.lng];
    }
  }

  return [10.2500, 124.9500];
};

// Clean text for province/regional matching by stripping street names & infrastructure words
export function stripStreetInfrastructure(str = '') {
  if (!str) return '';
  return String(str)
    .replace(/\b(?:dr\.?\s*)?(?:jose\s*)?rizal\s+(?:street|st\.?|avenue|ave\.?|boulevard|blvd\.?|highway|hwy\.?|road|rd\.?|lane|ln\.?|drive|dr\.?|way|bridge|monument|memorial|park|center|hall)\b/gi, ' ')
    .replace(/\b(?:street|st\.?|avenue|ave\.?|boulevard|blvd\.?|highway|hwy\.?|road|rd\.?|lane|ln\.?|drive|dr\.?|way)\s+(?:dr\.?\s*)?(?:jose\s*)?rizal\b/gi, ' ')
    .replace(/\b(?:street|st\.?|avenue|ave\.?|boulevard|blvd\.?|highway|hwy\.?|road|rd\.?|lane|ln\.?|drive|dr\.?|way|expressway|corner|cor\.|building|bldg|floor|flr|room|rm|unit|block|blk|lot)\b/gi, ' ')
    .replace(/\b(?:barangay|brgy\.?|purok|sitio|zone)\b/gi, ' ');
}

const reverseGeocodeApproxCoords = (coords) => {
  if (!coords || !coords[0] || !coords[1]) return null;
  const lat = Number(coords[0]);
  const lng = Number(coords[1]);
  // Southern Leyte bounds: lat 9.8 - 10.6, lng 124.7 - 125.4
  if (lat >= 9.8 && lat <= 10.6 && lng >= 124.7 && lng <= 125.4) {
    return { name: 'Southern Leyte', region: 'Region VIII (Eastern Visayas)' };
  }
  // Leyte bounds: lat 10.5 - 11.5, lng 124.3 - 125.1
  if (lat >= 10.5 && lat <= 11.5 && lng >= 124.3 && lng <= 125.1) {
    return { name: 'Leyte', region: 'Region VIII (Eastern Visayas)' };
  }
  // Albay / Bicol bounds: lat 13.0 - 13.4, lng 123.4 - 123.9
  if (lat >= 13.0 && lat <= 13.4 && lng >= 123.4 && lng <= 123.9) {
    return { name: 'Albay', region: 'Region V (Bicol)' };
  }
  // Metro Manila / NCR: lat 14.4 - 14.7, lng 120.9 - 121.1
  if (lat >= 14.4 && lat <= 14.7 && lng >= 120.9 && lng <= 121.1) {
    return { name: 'Metro Manila', region: 'National Capital Region (NCR)' };
  }
  return null;
};

const getClusterKey = (campaign, coords) => {
  const provMatch = getProvinceMatchForCampaign(campaign);
  if (provMatch && provMatch.name) return provMatch.name;

  const geoMatch = reverseGeocodeApproxCoords(coords);
  if (geoMatch && geoMatch.name) return geoMatch.name;

  const cleanLoc = stripStreetInfrastructure(campaign.locationRegion || '');
  const cleanTitle = stripStreetInfrastructure(campaign.title || '');
  const cleanDesc = stripStreetInfrastructure(campaign.description || '');
  const text = `${cleanLoc} ${cleanTitle} ${cleanDesc}`.toLowerCase();
  for (const [key, val] of Object.entries(PH_LOCATIONS)) {
    if (key === 'rizal') {
      if (text.includes('albay') || text.includes('bicol') || text.includes('leyte') || text.includes('visayas') || text.includes('mindanao')) continue;
      const hasRizalTown = /antipolo|cainta|taytay|binangonan|san mateo|tanay|morong|angono|baras|cardona|jalajala|jala-jala|pililla|teresa|montalban|\brodriguez\b/i.test(text);
      const isRizalProvince = /\bprovince\s+of\s+rizal\b|\brizal\s+province\b/i.test(text) ||
        (/\brizal\b/i.test(text) && (/calabarzon|region\s+iv-a/i.test(text) || !text.includes('street')));
      if (!hasRizalTown && !isRizalProvince) continue;
    }
    if (text.includes(key)) {
      return val.name;
    }
  }
  return coords && coords[0] ? `${coords[0].toFixed(1)}°N, ${coords[1].toFixed(1)}°E` : 'Philippines Disaster Zone';
};

// ── Province Centroids Computed from Official GeoJSON Boundaries ──
// Ensures regional cluster beacons sit directly at the geographic center of the province,
// rather than being placed on top of the last campaign deployed.
export const PROVINCE_CENTROIDS = (() => {
  const centroids = {};
  if (PH_PROVINCES_GEOJSON && PH_PROVINCES_GEOJSON.features) {
    PH_PROVINCES_GEOJSON.features.forEach(feat => {
      const name = feat.properties?.name;
      if (!name) return;
      const key = name.toLowerCase().trim();
      let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
      const extract = (coords) => {
        if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
          const [lng, lat] = coords;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
        } else if (Array.isArray(coords)) {
          coords.forEach(extract);
        }
      };
      extract(feat.geometry.coordinates);
      if (minLat !== 90 && maxLat !== -90) {
        centroids[key] = {
          name,
          region: feat.properties?.region || 'Philippines Disaster Zone',
          lat: (minLat + maxLat) / 2,
          lng: (minLng + maxLng) / 2
        };
      }
    });
  }
  return centroids;
})();

export const getProvinceMatchForCampaign = (campaign) => {
  const cleanLoc = stripStreetInfrastructure(campaign?.locationRegion || '');
  const cleanTitle = stripStreetInfrastructure(campaign?.title || '');
  const text = `${cleanLoc} ${cleanTitle}`.toLowerCase();

  // 1. Direct match with GeoJSON province name (sorted descending by key length to match longest/most specific first)
  const sortedProvCentroids = Object.entries(PROVINCE_CENTROIDS).sort((a, b) => b[0].length - a[0].length);
  for (const [pKey, pData] of sortedProvCentroids) {
    if (pKey === 'leyte' && text.includes('southern leyte')) continue;
    if (pKey === 'samar' && (text.includes('eastern samar') || text.includes('northern samar'))) continue;
    if (pKey === 'davao del sur' && text.includes('davao occidental')) continue;
    if (pKey === 'rizal') {
      if (text.includes('albay') || text.includes('bicol') || text.includes('leyte') || text.includes('visayas') || text.includes('mindanao')) continue;
      const hasRizalTown = /antipolo|cainta|taytay|binangonan|san mateo|tanay|morong|angono|baras|cardona|jalajala|jala-jala|pililla|teresa|montalban|\brodriguez\b/i.test(text);
      const isRizalProvince = /\bprovince\s+of\s+rizal\b|\brizal\s+province\b/i.test(text) ||
        (/\brizal\b/i.test(text) && (/calabarzon|region\s+iv-a/i.test(text) || !text.includes('street')));
      if (!hasRizalTown && !isRizalProvince) continue;
    }
    if (text.includes(pKey)) {
      return pData;
    }
  }

  // 2. City / Municipality lookup from PH_LOCATIONS (sorted descending by key length)
  const sortedLocations = Object.entries(PH_LOCATIONS).sort((a, b) => b[0].length - a[0].length);
  for (const [locKey, locVal] of sortedLocations) {
    if (locKey === 'rizal') {
      if (text.includes('albay') || text.includes('bicol') || text.includes('leyte') || text.includes('visayas') || text.includes('mindanao')) continue;
      const hasRizalTown = /antipolo|cainta|taytay|binangonan|san mateo|tanay|morong|angono|baras|cardona|jalajala|jala-jala|pililla|teresa|montalban|\brodriguez\b/i.test(text);
      const isRizalProvince = /\bprovince\s+of\s+rizal\b|\brizal\s+province\b/i.test(text) ||
        (/\brizal\b/i.test(text) && (/calabarzon|region\s+iv-a/i.test(text) || !text.includes('street')));
      if (!hasRizalTown && !isRizalProvince) continue;
    }
    if (text.includes(locKey)) {
      const locName = locVal.name.toLowerCase();
      for (const [pKey, pData] of sortedProvCentroids) {
        if (pKey === 'leyte' && locName.includes('southern leyte')) continue;
        if (pKey === 'samar' && (locName.includes('eastern samar') || locName.includes('northern samar'))) continue;
        if (pKey === 'davao del sur' && locName.includes('davao occidental')) continue;
        if (locName.includes(pKey)) {
          return pData;
        }
      }
      return {
        name: locVal.name.split(',')[0].trim(),
        region: locVal.region,
        lat: locVal.lat,
        lng: locVal.lng
      };
    }
  }

  return null;
};

// ── Resolve Campaign Disaster Category, Semantic Color & Theme Metadata ───────
export const getCampaignCategoryMeta = (camp) => {
  const cat = String(camp?.category || '').toUpperCase();
  const title = String(camp?.title || '').toLowerCase();
  const desc = String(camp?.description || '').toLowerCase();
  const text = `${title} ${desc}`.toLowerCase();

  // 1. Volcano Eruption & Ashfall
  if (cat === 'VOLCANO' || /volcano|bulkan|ashfall|eruption|kanlaon|taal|mayon/i.test(text)) {
    return {
      key: 'VOLCANO',
      label: 'Volcano Response',
      shortLabel: 'VOLCANO',
      icon: 'volcano',
      color: '#dc2626',             // Magma Red
      glowColor: 'rgba(220, 38, 38, 0.5)',
      badgeBg: 'rgba(220, 38, 38, 0.16)',
      badgeText: '#f87171',
      pillBorder: 'rgba(220, 38, 38, 0.45)'
    };
  }

  // 2. Landslide & Mudslide (Critical in Southern Leyte, e.g. St. Bernard, Guinsaugon)
  if (cat === 'LANDSLIDE' || /landslide|mudslide|guinsaugon|rockfall|debris flow|soil erosion|erosyon/i.test(text)) {
    return {
      key: 'LANDSLIDE',
      label: 'Landslide Relief',
      shortLabel: 'LANDSLIDE',
      icon: 'landslide',
      color: '#b45309',             // Warm Terracotta Amber
      glowColor: 'rgba(180, 83, 9, 0.5)',
      badgeBg: 'rgba(180, 83, 9, 0.16)',
      badgeText: '#fbbf24',
      pillBorder: 'rgba(180, 83, 9, 0.45)'
    };
  }

  // 3. Earthquake & Seismic Tremor
  if (cat === 'EARTHQUAKE' || /earthquake|lindol|tremor|seismic|aftershock|tectonic|ground rupture/i.test(text)) {
    return {
      key: 'EARTHQUAKE',
      label: 'Earthquake Relief',
      shortLabel: 'EARTHQUAKE',
      icon: 'earthquake',
      color: '#ea580c',             // Tectonic Orange
      glowColor: 'rgba(234, 88, 12, 0.5)',
      badgeBg: 'rgba(234, 88, 12, 0.16)',
      badgeText: '#fb923c',
      pillBorder: 'rgba(234, 88, 12, 0.45)'
    };
  }

  // 4. Fire Disaster / Residential Blaze
  if (cat === 'FIRE' || /fire|sunog|blaze|conflagration|residential fire|fire victim/i.test(text)) {
    return {
      key: 'FIRE',
      label: 'Fire Disaster Aid',
      shortLabel: 'FIRE AID',
      icon: 'local_fire_department',
      color: '#f97316',             // Flame Orange
      glowColor: 'rgba(249, 115, 22, 0.5)',
      badgeBg: 'rgba(249, 115, 22, 0.16)',
      badgeText: '#fdba74',
      pillBorder: 'rgba(249, 115, 22, 0.45)'
    };
  }

  // 5. Typhoon / Storm / Cyclone
  if (cat === 'TYPHOON' || /typhoon|bagyo|cyclone|super typhoon|storm|odette|haiyan|kristine|tropical storm|gale|habagat/i.test(text)) {
    return {
      key: 'TYPHOON',
      label: 'Typhoon Relief',
      shortLabel: 'TYPHOON',
      icon: 'cyclone',
      color: '#0070f3',             // Vercel Electric Blue (--accent-blue)
      glowColor: 'rgba(0, 112, 243, 0.45)',
      badgeBg: 'rgba(0, 112, 243, 0.14)',
      badgeText: '#38bdf8',
      pillBorder: 'rgba(0, 112, 243, 0.40)'
    };
  }

  // 6. Flood & Flash Flood
  if (cat === 'FLOOD' || /flood|flash flood|baha|inundat|overflow|submerged|water level|river swell/i.test(text)) {
    return {
      key: 'FLOOD',
      label: 'Flood Response',
      shortLabel: 'FLOOD',
      icon: 'flood',
      color: '#06b6d4',             // Ocean Teal / Cyan
      glowColor: 'rgba(6, 182, 212, 0.5)',
      badgeBg: 'rgba(6, 182, 212, 0.16)',
      badgeText: '#22d3ee',
      pillBorder: 'rgba(6, 182, 212, 0.45)'
    };
  }

  // 7. Clean Drinking Water (Specifically Potable / Drinking water)
  if (cat === 'WATER' || /drinking water|potable water|mineral water|clean water|water filtration|water gallon|water station|water supply|water purification|tubig/i.test(text)) {
    return {
      key: 'WATER',
      label: 'Clean Water Supply',
      shortLabel: 'WATER AID',
      icon: 'water_drop',
      color: '#38bdf8',             // Crystal Sky Blue
      glowColor: 'rgba(56, 189, 248, 0.5)',
      badgeBg: 'rgba(56, 189, 248, 0.16)',
      badgeText: '#7dd3fc',
      pillBorder: 'rgba(56, 189, 248, 0.45)'
    };
  }

  // 8. Food Packs & Feeding Programs (Meals, Rice, Rations, Groceries)
  if (cat === 'FOOD_WATER' || cat === 'FOOD' || /food|rice|bigas|meal|grocery|ration|nutrition|canned|hunger|feeding|hot meal|food pack|ayuda/i.test(text)) {
    return {
      key: 'FOOD',
      label: 'Food & Rations',
      shortLabel: 'FOOD AID',
      icon: 'restaurant',           // Clear dining/meal icon instead of confusing water droplet
      color: '#f59e0b',             // Warm Amber Gold (--accent-orange)
      glowColor: 'rgba(245, 158, 11, 0.5)',
      badgeBg: 'rgba(245, 158, 11, 0.16)',
      badgeText: '#fbbf24',
      pillBorder: 'rgba(245, 158, 11, 0.45)'
    };
  }

  // 9. Shelter & House Reconstruction (Roofing, Tents, Lumber)
  if (cat === 'SHELTER' || /shelter|roof|roofing|yero|corrugated|tarpaulin|tent|rebuild|reconstruction|housing|evacuat|lumber|plywood|homeless/i.test(text)) {
    return {
      key: 'SHELTER',
      label: 'Shelter Recovery',
      shortLabel: 'SHELTER',
      icon: 'roofing',
      color: '#10b981',             // Emerald Green
      glowColor: 'rgba(16, 185, 129, 0.5)',
      badgeBg: 'rgba(16, 185, 129, 0.16)',
      badgeText: '#34d399',
      pillBorder: 'rgba(16, 185, 129, 0.45)'
    };
  }

  // 10. Medical Aid & First Aid Supplies
  if (cat === 'MEDICAL' || /medical|medicine|gamot|doctor|nurse|clinic|hospital|first aid|hygiene|sanitation|surgical|health|vaccin|pharmacy/i.test(text)) {
    return {
      key: 'MEDICAL',
      label: 'Medical Mission',
      shortLabel: 'MEDICAL',
      icon: 'medical_services',
      color: '#ef4444',             // Crimson Red (--danger)
      glowColor: 'rgba(239, 68, 68, 0.5)',
      badgeBg: 'rgba(239, 68, 68, 0.16)',
      badgeText: '#f87171',
      pillBorder: 'rgba(239, 68, 68, 0.45)'
    };
  }

  // 11. Search & Rescue / Evacuation Dispatch
  if (cat === 'RESCUE' || /search and rescue|rescue|airlift|rubber boat|ambulance|emergency transport|first responder|responder/i.test(text)) {
    return {
      key: 'RESCUE',
      label: 'Search & Rescue',
      shortLabel: 'RESCUE',
      icon: 'emergency',
      color: '#e11d48',             // Rose Red
      glowColor: 'rgba(225, 29, 72, 0.5)',
      badgeBg: 'rgba(225, 29, 72, 0.16)',
      badgeText: '#fb7185',
      pillBorder: 'rgba(225, 29, 72, 0.45)'
    };
  }

  // 12. Children & Education Support (Schools, Student kits)
  if (cat === 'EDUCATION' || /school|student|children|child|bata|education|classroom|learning|books|school supply/i.test(text)) {
    return {
      key: 'EDUCATION',
      label: 'Education Support',
      shortLabel: 'EDUCATION',
      icon: 'school',
      color: '#8b5cf6',             // Violet Purple
      glowColor: 'rgba(139, 92, 246, 0.5)',
      badgeBg: 'rgba(139, 92, 246, 0.16)',
      badgeText: '#a78bfa',
      pillBorder: 'rgba(139, 92, 246, 0.45)'
    };
  }

  // 13. Livelihood & Cash Assistance (Fisherfolk, Farmers, Small business)
  if (cat === 'LIVELIHOOD' || /livelihood|cash assistance|pangkabuhayan|financial aid|banca|fishing boat|farmer|crops|seeds|fisherman/i.test(text)) {
    return {
      key: 'LIVELIHOOD',
      label: 'Livelihood Aid',
      shortLabel: 'LIVELIHOOD',
      icon: 'payments',
      color: '#14b8a6',             // Teal
      glowColor: 'rgba(20, 184, 166, 0.5)',
      badgeBg: 'rgba(20, 184, 166, 0.16)',
      badgeText: '#2dd4bf',
      pillBorder: 'rgba(20, 184, 166, 0.45)'
    };
  }

  // 14. Default / General Emergency: Theme Accent (#22c55e)
  return {
    key: 'EMERGENCY',
    label: 'Emergency Relief',
    shortLabel: 'RELIEF',
    icon: 'crisis_alert',
    color: '#22c55e',               // Theme Green Accent (--accent)
    glowColor: 'rgba(34, 197, 94, 0.5)',
    badgeBg: 'rgba(34, 197, 94, 0.16)',
    badgeText: '#4ade80',
    pillBorder: 'rgba(34, 197, 94, 0.45)'
  };
};

const SOUTHERN_LEYTE_MUNICIPALITIES = [
  'Maasin City', 'Maasin', 'Macrohon', 'Padre Burgos', 'Malitbog', 'Tomas Oppus',
  'Bontoc', 'Sogod', 'Libagon', 'Liloan', 'San Francisco', 'Pintuyan',
  'San Ricardo', 'Saint Bernard', 'San Juan', 'Anahawan', 'Hinundayan',
  'Hinunangan', 'Silago', 'Limasawa'
];

const resolveCampaignSubLocation = (camp, focusedProvince = '') => {
  if (!camp) return focusedProvince || 'Disaster Zone';
  const rawLoc = String(camp.locationRegion || '').trim();
  const title = String(camp.title || '').trim();
  const desc = String(camp.description || '').trim();
  const provNorm = (focusedProvince || '').toLowerCase().trim();

  // 1. If comma-separated address exists (e.g. from Nominatim/DB like "A. Mabini Street, Santa Cruz, Macrohon, Southern Leyte, 6601, Philippines")
  if (rawLoc.includes(',')) {
    const rawParts = rawLoc.split(',').map(s => s.trim()).filter(Boolean);
    const filtered = rawParts.filter(p => {
      const pNorm = p.toLowerCase();
      if (pNorm === 'philippines' || pNorm === 'ph') return false;
      if (!isNaN(Number(pNorm))) return false; // postal code / numeric
      if (provNorm && (pNorm === provNorm || pNorm.includes(provNorm))) return false;
      // Filter out general province names from sublocation to avoid "Southern Leyte, Southern Leyte"
      if (['southern leyte', 'leyte', 'bohol', 'cebu', 'eastern samar', 'northern samar', 'samar'].includes(pNorm)) return false;
      return true;
    });
    if (filtered.length > 0) {
      // Pick the most specific local parts (e.g. "Santa Cruz, Macrohon" or "Javier, Sogod" or "Poblacion, Libagon")
      return filtered.slice(-2).join(', ');
    }
  }

  // 2. Scan for specific municipality/city in text
  const fullText = `${rawLoc} ${title} ${desc}`.toLowerCase();
  for (const mun of SOUTHERN_LEYTE_MUNICIPALITIES) {
    if (new RegExp(`\\b${mun.toLowerCase()}\\b`).test(fullText)) {
      if (fullText.includes('combado')) return `Barangay Combado, ${mun}`;
      if (fullText.includes('tagnipa')) return `Tagnipa, ${mun}`;
      if (fullText.includes('santa cruz')) return `Santa Cruz, ${mun}`;
      if (fullText.includes('san bernardo')) return `San Bernardo, ${mun}`;
      if (fullText.includes('poblacion ubos')) return `Poblacion Ubos, ${mun}`;
      if (fullText.includes('poblacion')) return `Poblacion, ${mun}`;
      return mun;
    }
  }

  // 3. Fallback: if rawLoc is not empty and not identical to province
  if (rawLoc && rawLoc.toLowerCase() !== provNorm && rawLoc.toLowerCase() !== 'philippines') {
    return rawLoc;
  }
  return focusedProvince || 'Disaster Zone';
};

const getProvinceCampaigns = (provinceName, allCampaigns) => {
  if (!provinceName || !allCampaigns || !allCampaigns.length) return [];
  const norm = provinceName.toLowerCase().trim();
  return allCampaigns.filter(c => {
    // Strip street names and infrastructure before checking province keywords to prevent false matches
    const cleanLoc = stripStreetInfrastructure(c.locationRegion || '');
    const cleanTitle = stripStreetInfrastructure(c.title || '');
    // Only search locationRegion and title (never description) to avoid false positives from donor/historical text
    const text = `${cleanLoc} ${cleanTitle}`.toLowerCase();

    if (norm === 'southern leyte') {
      return text.includes('southern leyte') || text.includes('maasin') || text.includes('macrohon') ||
        text.includes('sogod') || text.includes('combado') || text.includes('limasawa') ||
        text.includes('padre burgos') || text.includes('bontoc') || text.includes('malitbog') ||
        text.includes('libagon') || text.includes('pintuyan') || text.includes('san juan') ||
        text.includes('saint bernard') || text.includes('san ricardo') || text.includes('liloan') ||
        text.includes('silago') || text.includes('tagnipa');
    }
    if (norm === 'leyte') {
      return text.replace(/southern\s+leyte/g, '').includes('leyte') || text.includes('tacloban') || text.includes('ormoc') || text.includes('palo') || text.includes('baybay') || text.includes('tanauan');
    }
    if (norm === 'eastern samar') {
      return text.includes('eastern samar') || text.includes('borongan') || text.includes('guiuan');
    }
    if (norm === 'northern samar') {
      return text.includes('northern samar') || text.includes('catarman');
    }
    if (norm === 'samar') {
      const clean = text.replace(/eastern\s+samar/g, '').replace(/northern\s+samar/g, '');
      return clean.includes('samar') || text.includes('catbalogan');
    }
    if (norm === 'bohol') return text.includes('bohol') || text.includes('tagbilaran') || text.includes('tubigon') || text.includes('loay') || text.includes('panglao');
    if (norm === 'cebu') return text.includes('cebu') || text.includes('mandaue') || text.includes('lapu-lapu') || text.includes('talisay') || text.includes('danao');
    if (norm === 'albay') return text.includes('albay') || text.includes('legazpi') || text.includes('mayon') || text.includes('daraga') || text.includes('tabaco') || text.includes('bacacay');
    if (norm === 'camarines sur') return text.includes('camarines sur') || text.includes('naga city') || text.includes('pili');
    if (norm === 'camarines norte') return text.includes('camarines norte') || text.includes('daet');
    if (norm === 'catanduanes') return text.includes('catanduanes') || text.includes('virac');
    if (norm === 'sorsogon') return text.includes('sorsogon');
    if (norm === 'masbate') return text.includes('masbate');
    if (norm === 'isabela') return (text.includes('isabela') && !text.includes('basilan') && !text.includes('isabela city')) || text.includes('ilagan');
    if (norm === 'cagayan') return (text.includes('cagayan') && !text.includes('cagayan de oro')) || text.includes('tuguegarao');
    if (norm === 'benguet') return text.includes('benguet') || text.includes('baguio');
    if (norm === 'pangasinan') return text.includes('pangasinan') || text.includes('dagupan');
    if (norm === 'pampanga') return text.includes('pampanga') || text.includes('san fernando') || text.includes('angeles');
    if (norm === 'bulacan') return text.includes('bulacan') || text.includes('malolos');
    if (norm === 'cavite') return text.includes('cavite') || text.includes('tagaytay') || text.includes('dasmarinas');
    if (norm === 'laguna') return text.includes('laguna') || text.includes('calamba') || text.includes('santa rosa');
    if (norm === 'batangas') return text.includes('batangas') || text.includes('lipa');
    if (norm === 'rizal') {
      // Strict anti-imposter check: must NOT match Albay, Bicol, Leyte, Visayas, or Mindanao
      if (text.includes('albay') || text.includes('bicol') || text.includes('leyte') || text.includes('visayas') || text.includes('mindanao')) return false;
      const hasRizalTown = /antipolo|cainta|taytay|binangonan|san mateo|tanay|morong|angono|baras|cardona|jalajala|jala-jala|pililla|teresa|montalban|\brodriguez\b/i.test(text);
      const isRizalProvince = /\bprovince\s+of\s+rizal\b|\brizal\s+province\b/i.test(text) ||
        (/\brizal\b/i.test(text) && (/calabarzon|region\s+iv-a/i.test(text) || !text.includes('street')));
      return hasRizalTown || isRizalProvince;
    }
    if (norm === 'quezon') {
      const clean = text.replace(/quezon\s+city/g, '').replace(/\bqc\b/g, '');
      return (clean.includes('quezon') && (text.includes('calabarzon') || text.includes('region iv-a') || clean.includes('province'))) || text.includes('lucena') || text.includes('tayabas');
    }
    if (norm === 'metropolitan manila' || norm.includes('manila')) {
      return text.includes('metro manila') || text.includes('manila') || text.includes('quezon city') || text.includes('ncr') || text.includes('makati') || text.includes('taguig');
    }
    if (norm === 'davao del sur') return text.includes('davao del sur') || text.includes('davao city');
    if (norm === 'davao del norte') return text.includes('davao del norte') || text.includes('tagum');
    if (norm === 'davao oriental') return text.includes('davao oriental') || text.includes('mati');
    if (norm === 'davao de oro') return text.includes('davao de oro') || text.includes('compostela');
    if (norm === 'davao occidental') return text.includes('davao occidental') || text.includes('malita');
    if (norm === 'misamis oriental') return text.includes('misamis oriental') || text.includes('cagayan de oro');
    if (norm === 'misamis occidental') return text.includes('misamis occidental') || text.includes('ozamiz');
    if (norm === 'bukidnon') return text.includes('bukidnon') || text.includes('malaybalay');
    if (norm === 'zamboanga del sur') return text.includes('zamboanga del sur') || text.includes('zamboanga city');
    if (norm === 'surigao del norte') return text.includes('surigao del norte') || text.includes('siargao');
    if (norm === 'surigao del sur') return text.includes('surigao del sur');
    if (norm === 'palawan') return text.includes('palawan') || text.includes('puerto princesa');
    if (norm === 'occidental mindoro') return text.includes('occidental mindoro') || text.includes('san jose');
    if (norm === 'oriental mindoro') return text.includes('oriental mindoro') || text.includes('calapan');
    return text.includes(norm);
  });
};

// ── Simulated Mission Generator for Archipelagic Campaign Density Visualization ──
// Allows previewing a fully populated Philippine disaster radar (counts 1 to 30 per province)
// WITHOUT creating mock campaigns in the database or smart contracts.
export function generateSimulatedMissions(seed = 1, realCampaigns = []) {
  let s = (Math.abs(seed) % 2147483647) || 1;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  const DISASTER_TEMPLATES = [
    { cat: 'TYPHOON', title: 'Typhoon Relief & Rapid Response', desc: 'Emergency supply drops, high-capacity tarpaulins, and family food packs deployed to coastal evacuation sites.' },
    { cat: 'FLOOD', title: 'Flash Flood Rescue & Evacuation Aid', desc: 'Deploying rescue boats, dry emergency rations, and potable water filtration kits for submerged communities.' },
    { cat: 'MEDICAL', title: 'Emergency Medical Triage & First Aid', desc: 'Mobile health teams providing emergency antibiotics, sterile wound dressings, and pediatric supplies in disaster shelters.' },
    { cat: 'FOOD', title: 'Food Rations & Clean Water Distribution', desc: 'Fortified rice, canned provisions, and clean drinking water cisterns delivered to isolated high-risk barangays.' },
    { cat: 'SHELTER', title: 'Temporary Shelter Recovery Kit', desc: 'Heavy-duty framing lumber, corrugated galvanized roofing, and rebuilding toolsets for displaced households.' },
    { cat: 'EMERGENCY', title: 'Resilience Power & Satellite Comms Grid', desc: 'Off-grid solar generator banks, satellite communications, and urgent logistics for search-and-rescue teams.' }
  ];

  const NGOS = [
    'Philippine Red Cross',
    'GMA Kapuso Foundation',
    'Ayala Foundation',
    'Caritas Philippines',
    'UNICEF Philippines',
    'Angat Buhay',
    'ABS-CBN Sagip Kapamilya',
    'Waves for Water Philippines'
  ];

  const URGENCIES = ['HIGH', 'CRITICAL', 'URGENT'];

  const simulated = [];
  const provEntries = Object.entries(PROVINCE_CENTROIDS);

  provEntries.forEach(([provKey, centroid]) => {
    const provName = centroid.name;
    const realProvCamps = getProvinceCampaigns(provName, realCampaigns);
    const realCount = realProvCamps.length;

    // Focus simulated disaster missions on a realistic regional crisis corridor (e.g. 6-10 affected provinces)
    // instead of cluttering every corner of all 82 provinces.
    const roll = rand();
    let targetCount = 0;
    if (roll < 0.88) {
      // ~88% of provinces remain clear for clean, realistic geospatial focus
      targetCount = 0;
    } else if (roll < 0.94) {
      // Tier 1: 1 cause (Emerging)
      targetCount = 1;
    } else if (roll < 0.97) {
      // Tier 2: 2-3 causes (Moderate)
      targetCount = 2 + Math.floor(rand() * 2);
    } else if (roll < 0.985) {
      // Tier 3: 4-6 causes (High)
      targetCount = 4 + Math.floor(rand() * 3);
    } else if (roll < 0.995) {
      // Tier 4: 7-11 causes (Severe)
      targetCount = 7 + Math.floor(rand() * 5);
    } else {
      // Tier 5/6: 12-20 causes (Epicenter)
      targetCount = 12 + Math.floor(rand() * 9);
    }

    // Number of simulated missions needed on top of any existing real campaigns
    const needed = Math.max(0, targetCount - realCount);

    for (let i = 0; i < needed; i++) {
      const template = DISASTER_TEMPLATES[Math.floor(rand() * DISASTER_TEMPLATES.length)];
      const ngo = NGOS[Math.floor(rand() * NGOS.length)];
      const urgency = URGENCIES[Math.floor(rand() * URGENCIES.length)];

      const targetEth = parseFloat((5.0 + rand() * 30.0).toFixed(2));
      const raisedEth = parseFloat((rand() * targetEth * 0.92).toFixed(2));

      // Golden spiral distribution so individual pins spread gracefully across the province
      const angle = (i * 2.39996) + (rand() * 0.5);
      const dist = 0.022 + (Math.sqrt(i + 1) * 0.024);
      const pinLat = centroid.lat + Math.sin(angle) * dist;
      const pinLng = centroid.lng + Math.cos(angle) * dist;

      const SIMULATED_AFTERMATH_SAMPLES = [
        'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=800&q=80'
      ];
      const pIdx1 = Math.floor(rand() * SIMULATED_AFTERMATH_SAMPLES.length);
      const pIdx2 = (pIdx1 + 1) % SIMULATED_AFTERMATH_SAMPLES.length;
      const simDisasterPhotos = [SIMULATED_AFTERMATH_SAMPLES[pIdx1], SIMULATED_AFTERMATH_SAMPLES[pIdx2]];

      simulated.push({
        id: `sim-${provKey}-${seed}-${i + 1}`,
        title: `${provName} ${template.title}`,
        description: `${template.desc} Coordinated in ${provName}, ${centroid.region}.`,
        locationRegion: provName,
        category: template.cat,
        urgency,
        orgName: ngo,
        targetAmount: targetEth,
        currentAmount: raisedEth,
        raised_eth: raisedEth,
        target_eth: targetEth,
        gpsCoordinates: `${pinLat.toFixed(4)}, ${pinLng.toFixed(4)}`,
        isSimulated: true,
        disasterImages: simDisasterPhotos,
        disaster_images_json: JSON.stringify(simDisasterPhotos)
      });
    }
  });

  return simulated;
}

// Basemap URL resolver based on active Theme
const resolveBasemapLayers = (themeMode, activeLayer) => {
  if (activeLayer === 'provinces') {
    // Pure vector canvas on clean cartographic background - NO external tiles, NO API keys
    return {
      base: null,
      labels: null,
      maxZoom: 18
    };
  }
  if (activeLayer === 'satellite') {
    return {
      base: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      labels: null,
      maxZoom: 20
    };
  }
  if (activeLayer === 'terrain') {
    // High-contrast Physical Elevation & Topography (Lush shaded relief, rich greenery, highway shields)
    return {
      base: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
      labels: null,
      maxZoom: 20
    };
  }
  if (activeLayer === 'osm') {
    return {
      base: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      labels: null,
      maxZoom: 19
    };
  }

  // Tactical Basemap: ArcGIS Canvas Dark / Light (100% Free, Zero Watermarks, No API Key Required)
  if (themeMode === 'light') {
    return {
      base: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      labels: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      maxZoom: 16,
      subdomains: ''
    };
  }

  return {
    base: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    labels: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 16,
    subdomains: ''
  };
};

// ── Dynamic Viewport-Proximity Cluster Aggregator ──
// Prevents screen overcrowding by collapsing nearby provincial nodes into regional hubs at national scale.
// As the user zooms in, hubs automatically split into individual provinces, and then municipal relief stations.
function aggregateClustersByScreenDistance(clusterList, currentZoom, map) {
  if (!map || !clusterList || clusterList.length === 0) return [];
  // If map container layout is not yet ready, return clusterList directly
  try {
    const size = map.getSize ? map.getSize() : null;
    if (size && (size.x <= 0 || size.y <= 0)) return clusterList;
  } catch (_) { }

  // At zoom >= 8.5, provincial nodes have plenty of screen room
  if (currentZoom >= 8.5) return clusterList;

  // Collision threshold in screen pixels:
  // At national scale (zoom <= 6.8), 56px threshold groups adjacent provinces into clean regional hubs
  // At intermediate zoom (7 - 8.4), 36px threshold
  const thresholdPx = currentZoom <= 6.8 ? 56 : 36;

  const results = [];
  const processed = new Set();

  for (let i = 0; i < clusterList.length; i++) {
    if (processed.has(i)) continue;
    const primary = clusterList[i];
    processed.add(i);

    let ptPrimary;
    try {
      ptPrimary = map.latLngToContainerPoint([primary.lat, primary.lng]);
    } catch (_) {
      ptPrimary = { x: 0, y: 0 };
    }

    const primCamps = Array.isArray(primary.campaigns) ? primary.campaigns : [];
    const primCount = primCamps.length;
    const mergedCampaigns = [...primCamps];
    let totalRaised = primary.totalRaised || 0;
    let totalTarget = primary.totalTarget || 0;
    const members = [{ name: primary.name, count: primCount, tier: primary.tier, lat: primary.lat, lng: primary.lng }];
    let sumLat = primary.lat * primCount;
    let sumLng = primary.lng * primCount;
    let totalWeight = primCount;

    for (let j = i + 1; j < clusterList.length; j++) {
      if (processed.has(j)) continue;
      const candidate = clusterList[j];

      let ptCandidate;
      try {
        ptCandidate = map.latLngToContainerPoint([candidate.lat, candidate.lng]);
      } catch (_) {
        ptCandidate = { x: 0, y: 0 };
      }

      const distPx = Math.hypot(ptPrimary.x - ptCandidate.x, ptPrimary.y - ptCandidate.y);
      if (distPx < thresholdPx) {
        processed.add(j);
        const candCamps = Array.isArray(candidate.campaigns) ? candidate.campaigns : [];
        const candCount = candCamps.length;
        mergedCampaigns.push(...candCamps);
        totalRaised += candidate.totalRaised || 0;
        totalTarget += candidate.totalTarget || 0;
        members.push({ name: candidate.name, count: candCount, tier: candidate.tier, lat: candidate.lat, lng: candidate.lng });
        sumLat += candidate.lat * candCount;
        sumLng += candidate.lng * candCount;
        totalWeight += candCount;
      }
    }

    if (members.length === 1) {
      results.push(primary);
    } else {
      const avgLat = totalWeight > 0 ? sumLat / totalWeight : primary.lat;
      const avgLng = totalWeight > 0 ? sumLng / totalWeight : primary.lng;
      const combinedCount = mergedCampaigns.length;
      const combinedTier = getTier(combinedCount);
      const mainRegion = (primary.regionName || '').split('(')[0].trim() || 'Regional Cluster';

      results.push({
        id: `agg-${primary.id}-${members.length}`,
        name: `${mainRegion} (${members.length} Provinces)`,
        regionName: `${members.length} Aggregated Sectors: ${members.map(m => m.name.split(',')[0].trim()).join(', ')}`,
        lat: avgLat,
        lng: avgLng,
        campaigns: mergedCampaigns,
        totalRaised,
        totalTarget,
        tier: combinedTier,
        isMacroHub: true,
        memberProvinces: members,
        zoomTarget: Math.min(8.5, currentZoom + 2.0)
      });
    }
  }

  return results;
}

function DisasterRadarHeatmapInner({
  campaigns = [],
  onSelectCampaign,
  className = '',
  title = 'Philippine Disaster Relief Radar Heatmap',
  height = '620px',
  allowFullscreen = true,
  theme: propTheme,
  defaultLayer = 'terrain',
  lowBandwidthMode = false,
  reducedMotion = false,
  language = 'en'
}) {
  const wt = useMemo(() => getWorkspaceStrings(language), [language]);
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const baseLayerRef = useRef(null);
  const labelLayerRef = useRef(null);
  const heatCloudGroupRef = useRef(null);
  const markersGroupRef = useRef(null);
  const provinceGeoGroupRef = useRef(null);
  const campaignPinsGroupRef = useRef(null);
  const geoJsonLayerRef = useRef(null);
  const spotlightLayerRef = useRef(null);
  const spotlightRendererRef = useRef(null);
  const provinceRendererRef = useRef(null);
  const clusterMarkersByProvinceRef = useRef(new Map());
  const provinceLayersByNameRef = useRef(new Map());

  const [currentTheme, setCurrentTheme] = useState(() => {
    return propTheme || document.documentElement.getAttribute('data-theme') || 'dark';
  });

  const [activeLayer, setActiveLayer] = useState(() => (lowBandwidthMode ? 'provinces' : defaultLayer)); // 'provinces' | 'satellite' | 'terrain' | 'tactical' | 'osm'
  useEffect(() => {
    setActiveLayer(lowBandwidthMode ? 'provinces' : defaultLayer);
  }, [lowBandwidthMode, defaultLayer]);
  // Command HUD collapsed state (defaults to true for clean view)
  const [isCommandHudCollapsed, setIsCommandHudCollapsed] = useState(true);
  const [hudSearchQuery, setHudSearchQuery] = useState('');
  const [hoveredCorridorName, setHoveredCorridorName] = useState(null);
  const [currentZoomLevel, setCurrentZoomLevel] = useState(6);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [focusedProvince, setFocusedProvince] = useState(null);
  const focusedProvinceRef = useRef(null);
  const isProvinceClickRef = useRef(false);
  const lastFocusCenterRef = useRef([11.2, 123.8]);
  // Preserves exact camera zoom & center before clicking a province so disclicking outside smoothly returns
  const preFocusViewRef = useRef(null);
  const [simulateDensity, setSimulateDensity] = useState(false);
  const [simSeed, setSimSeed] = useState(1);
  const [includeConcluded, setIncludeConcluded] = useState(false);

  // ── Interactive Beacon Focus Experience State ──
  const [selectedBeaconCampaign, setSelectedBeaconCampaign] = useState(null);
  const [selectedBeaconCoords, setSelectedBeaconCoords] = useState(null);
  const [isOverviewExpanded, setIsOverviewExpanded] = useState(false);
  const [lightboxPhotos, setLightboxPhotos] = useState([]);
  const [activeLightboxIdx, setActiveLightboxIdx] = useState(null);
  const openLightbox = (photos = [], idx = 0) => {
    if (!photos || photos.length === 0) return;
    setLightboxPhotos(photos);
    setActiveLightboxIdx(idx);
  };
  const [activeDossierPhotoIdx, setActiveDossierPhotoIdx] = useState(0);
  const selectedBeaconRef = useRef(null);
  const preBeaconViewRef = useRef(null);
  const pinCoordsByCampIdRef = useRef(new Map());

  const concludedCampaignCount = useMemo(() => {
    return (campaigns || []).filter(c => c.isActive === false || c.isClosed).length;
  }, [campaigns]);

  // Active campaigns combining real on-chain campaigns (excluding concluded unless toggled) with simulated density missions
  const activeCampaigns = useMemo(() => {
    const base = includeConcluded
      ? (campaigns || [])
      : (campaigns || []).filter(c => c.isActive !== false && !c.isClosed);
    if (!simulateDensity) return base;
    const simulated = generateSimulatedMissions(simSeed, base);
    return [...base, ...simulated];
  }, [campaigns, includeConcluded, simulateDensity, simSeed]);

  const activeLayerRef = useRef(activeLayer);
  activeLayerRef.current = activeLayer;
  const currentThemeRef = useRef(currentTheme);
  currentThemeRef.current = currentTheme;
  const campaignsRef = useRef(activeCampaigns);
  campaignsRef.current = activeCampaigns;
  const isMapMovingRef = useRef(false);
  const hoveredProvinceLayersRef = useRef(new Set());

  // Smooth linear camera transition (avoids flyTo's parabolic scale warp that corrupts SVG layer coordinates)
  const smoothNavigateTo = (targetCenter, targetZoom) => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const currentZ = map.getZoom();
    const targetZ = typeof targetZoom === 'number' ? targetZoom : currentZ;

    isMapMovingRef.current = true;

    // If already at target zoom, panTo is 100% linear translation with zero scale distortion
    if (Math.abs(currentZ - targetZ) < 0.1) {
      map.panTo(targetCenter, { animate: true, duration: 0.5 });
    } else {
      map.setView(targetCenter, targetZ, { animate: true, duration: 0.6 });
    }
  };

  // Dynamically calculate camera zoom tailored to the exact geographical dimensions & size of any province
  const getProvinceOptimalZoom = (bounds, map) => {
    if (!bounds || !bounds.isValid() || !map) return 9;
    const boundsZoom = map.getBoundsZoom(bounds, false, [70, 70]);
    const latSpan = Math.abs(bounds.getNorth() - bounds.getSouth());
    const lngSpan = Math.abs(bounds.getEast() - bounds.getWest());
    const maxSpan = Math.max(latSpan, lngSpan);

    // Large provinces (Palawan, Isabela, Cagayan, Bukidnon): span > 1.8 deg -> zoom 7.5 to 8
    if (maxSpan > 2.0) {
      return Math.min(boundsZoom, 7.5);
    }
    if (maxSpan > 1.2) {
      return Math.min(Math.max(boundsZoom, 8), 8.5);
    }
    // Small island provinces & compact territories (Guimaras, Siquijor, Camiguin, Batanes, Biliran): span < 0.45 deg -> zoom 10.5
    if (maxSpan < 0.45) {
      return Math.max(boundsZoom, 10.5);
    }
    // Standard medium provinces (Southern Leyte, Cebu, Bohol, Albay, Batangas): zoom 9 to 9.5
    return Math.min(Math.max(boundsZoom, 8.5), 10);
  };

  // ── Reposition Selected Beacon Toward the Left Side of the Screen at Zoom ──
  const computeOffsetCenter = (lat, lng, targetZoom, map) => {
    if (!map) return [lat, lng];
    const size = map.getSize();
    const isMobile = size.x < 768;

    const targetPt = map.project([lat, lng], targetZoom);
    // Desktop: shift camera center right by 22% of container width so beacon sits at ~28% from the left edge
    const offsetPxX = isMobile ? 0 : (size.x * 0.22);
    // Mobile: shift camera center down so beacon sits in the upper portion above the bottom drawer
    const offsetPxY = isMobile ? (size.y * 0.18) : 0;

    const cameraCenterPt = L.point(targetPt.x + offsetPxX, targetPt.y + offsetPxY);
    return map.unproject(cameraCenterPt, targetZoom);
  };

  // ── Update CSS classes on pin markers for isolation & highlight ──
  const updatePinIsolationStyles = (selectedCampId) => {
    if (!campaignPinsGroupRef.current) return;
    campaignPinsGroupRef.current.eachLayer(pinMarker => {
      const el = pinMarker.getElement();
      if (!el) return;
      const inner = el.querySelector('.exact-campaign-tactical-pin');
      const markerCampId = pinMarker._campaignId;

      if (selectedCampId) {
        if (markerCampId === selectedCampId) {
          pinMarker.setZIndexOffset(100000);
          el.classList.add('is-beacon-selected');
          el.classList.remove('is-beacon-dimmed');
          if (inner) {
            inner.classList.add('is-beacon-selected');
            inner.classList.remove('is-beacon-dimmed');
          }
        } else {
          pinMarker.setZIndexOffset(0);
          el.classList.remove('is-beacon-selected');
          el.classList.add('is-beacon-dimmed');
          if (inner) {
            inner.classList.remove('is-beacon-selected');
            inner.classList.add('is-beacon-dimmed');
          }
        }
      } else {
        pinMarker.setZIndexOffset(0);
        el.classList.remove('is-beacon-selected', 'is-beacon-dimmed');
        if (inner) {
          inner.classList.remove('is-beacon-selected', 'is-beacon-dimmed');
        }
      }
    });
  };

  // ── Beacon Selection & Repositioning Handler ──
  const handleSelectBeacon = (camp, coords) => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Record previous camera zoom & center before entering beacon focus
    if (!selectedBeaconRef.current) {
      preBeaconViewRef.current = {
        zoom: map.getZoom(),
        center: map.getCenter()
      };
    }

    const campId = String(camp.id || camp.title);
    selectedBeaconRef.current = campId;
    setSelectedBeaconCampaign(camp);
    setSelectedBeaconCoords(coords);
    setIsOverviewExpanded(false);
    setActiveDossierPhotoIdx(0);

    // Auto-collapse the left operations corridor HUD so the left screen is clean for the beacon
    setIsCommandHudCollapsed(true);
    setIsDossierOpen(false);

    const targetZoom = 13.5;
    const offsetCenter = computeOffsetCenter(coords[0], coords[1], targetZoom, map);

    isMapMovingRef.current = true;
    map.flyTo(offsetCenter, targetZoom, {
      animate: true,
      duration: 0.85,
      easeLinearity: 0.25
    });

    updatePinIsolationStyles(campId);
  };

  // ── Close Beacon Focus & Smoothly Return to Previous Map State ──
  const handleCloseBeaconFocus = () => {
    setSelectedBeaconCampaign(null);
    setSelectedBeaconCoords(null);
    selectedBeaconRef.current = null;
    setIsOverviewExpanded(false);
    updatePinIsolationStyles(null);

    // Smoothly restore previous map zoom and viewport
    if (preBeaconViewRef.current && mapRef.current) {
      const { zoom: returnZoom, center: returnCenter } = preBeaconViewRef.current;
      isMapMovingRef.current = true;
      mapRef.current.flyTo(returnCenter, returnZoom, {
        animate: true,
        duration: 0.75,
        easeLinearity: 0.25
      });
      preBeaconViewRef.current = null;
    }
  };

  // ── Step Through Campaigns Within the Focused Sector ──
  const handleStepBeacon = (direction) => {
    if (!focusedProvince || !selectedBeaconCampaign) return;
    const provCamps = getProvinceCampaigns(focusedProvince, activeCampaigns);
    if (provCamps.length <= 1) return;

    const currentId = String(selectedBeaconCampaign.id || selectedBeaconCampaign.title);
    const currentIndex = provCamps.findIndex(c => String(c.id || c.title) === currentId);
    let nextIndex = currentIndex + direction;
    if (nextIndex < 0) nextIndex = provCamps.length - 1;
    if (nextIndex >= provCamps.length) nextIndex = 0;

    const nextCamp = provCamps[nextIndex];
    const nextId = String(nextCamp.id || nextCamp.title);
    const nextCoords = pinCoordsByCampIdRef.current.get(nextId) || resolveCampaignCoords(nextCamp);

    handleSelectBeacon(nextCamp, nextCoords);
  };
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [isLegendExpanded, setIsLegendExpanded] = useState(false);
  const [filterRegion, setFilterRegion] = useState('ALL');
  const [focusedTier, setFocusedTier] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  // Synchronize Theme Changes (Dark, Light)
  useEffect(() => {
    if (propTheme) {
      setCurrentTheme(propTheme);
    }
  }, [propTheme]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const themeAttr = document.documentElement.getAttribute('data-theme') || 'dark';
      setCurrentTheme(themeAttr);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  // Real-Time Philippine Standard Time (PST / UTC+8)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options = {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      };
      setCurrentTime(new Intl.DateTimeFormat('en-PH', options).format(now));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Spatial clustering: Groups campaigns into provincial clusters
  // Locks the beacon to the true geographical centroid of the province (never the last deployed campaign)
  const clusters = useMemo(() => {
    const map = new Map();

    (activeCampaigns || []).forEach(c => {
      const coords = resolveCampaignCoords(c);
      const provMatch = getProvinceMatchForCampaign(c);
      const clusterKey = provMatch ? provMatch.name : getClusterKey(c, coords);
      const regionName = provMatch ? provMatch.region : 'Philippines Disaster Zone';

      if (!map.has(clusterKey)) {
        map.set(clusterKey, {
          id: clusterKey,
          name: clusterKey,
          regionName,
          lat: provMatch?.lat ?? coords[0],
          lng: provMatch?.lng ?? coords[1],
          campaigns: [],
          totalRaised: 0,
          totalTarget: 0
        });
      }

      const cluster = map.get(clusterKey);
      cluster.campaigns.push(c);
      cluster.totalRaised += parseFloat(c.currentAmount || 0);
      cluster.totalTarget += parseFloat(c.targetAmount || 0);
    });

    // Ensure cluster beacon lat/lng is locked to the province centroid
    return Array.from(map.values()).map(cl => {
      const provKey = cl.name.toLowerCase().trim();
      let lat = cl.lat;
      let lng = cl.lng;

      if (PROVINCE_CENTROIDS[provKey]) {
        lat = PROVINCE_CENTROIDS[provKey].lat;
        lng = PROVINCE_CENTROIDS[provKey].lng;
      } else if (cl.campaigns.length > 1) {
        const sumLat = cl.campaigns.reduce((sum, camp) => sum + resolveCampaignCoords(camp)[0], 0);
        const sumLng = cl.campaigns.reduce((sum, camp) => sum + resolveCampaignCoords(camp)[1], 0);
        lat = sumLat / cl.campaigns.length;
        lng = sumLng / cl.campaigns.length;
      }

      return {
        ...cl,
        lat,
        lng,
        tier: getTier(cl.campaigns.length)
      };
    });
  }, [activeCampaigns]);

  // Filtered clusters
  const visibleClusters = useMemo(() => {
    let result = clusters;
    if (filterRegion === 'LUZON') {
      result = result.filter(c => c.lat >= 12.5);
    } else if (filterRegion === 'VISAYAS') {
      result = result.filter(c => c.lat >= 9.0 && c.lat < 12.5);
    } else if (filterRegion === 'MINDANAO') {
      result = result.filter(c => c.lat < 9.0);
    }

    if (focusedTier !== null) {
      result = result.filter(c => c.tier.level === focusedTier);
    }

    return result;
  }, [clusters, filterRegion, focusedTier]);

  // Derive active cluster for the dossier HUD: either from selectedCluster or focusedProvince
  const activeDossierCluster = useMemo(() => {
    if (selectedCluster) return selectedCluster;
    if (!focusedProvince) return null;

    const normProv = focusedProvince.toLowerCase().trim();
    const match = clusters.find(c => {
      const cName = c.name.toLowerCase().trim();
      return cName === normProv || c.id.toLowerCase().trim() === normProv || cName.includes(normProv) || normProv.includes(cName);
    });
    if (match) return match;

    const provCamps = getProvinceCampaigns(focusedProvince, activeCampaigns);
    if (!provCamps || provCamps.length === 0) return null;

    const centroid = PROVINCE_CENTROIDS[normProv] || { lat: 12.8797, lng: 121.7740 };
    let totalRaised = 0;
    let totalTarget = 0;
    provCamps.forEach(c => {
      totalRaised += parseFloat(c.currentAmount || c.raised_eth || 0);
      totalTarget += parseFloat(c.targetAmount || c.target_eth || 0);
    });

    return {
      id: focusedProvince,
      name: focusedProvince,
      regionName: 'Philippine Disaster Relief Sector',
      lat: centroid.lat,
      lng: centroid.lng,
      campaigns: provCamps,
      totalRaised,
      totalTarget,
      tier: getTier(provCamps.length)
    };
  }, [selectedCluster, focusedProvince, clusters, activeCampaigns]);

  const totalTrackedCampaigns = (activeCampaigns || []).length;

  // Sorted active crisis corridors for Command HUD (Ranked by highest GDACS emergency level and campaign count)
  const sortedCorridors = useMemo(() => {
    return [...clusters].sort((a, b) => {
      if (b.tier.level !== a.tier.level) return b.tier.level - a.tier.level;
      return b.campaigns.length - a.campaigns.length;
    });
  }, [clusters]);

  const filteredCorridors = useMemo(() => {
    if (!hudSearchQuery.trim()) return sortedCorridors;
    const q = hudSearchQuery.toLowerCase().trim();
    return sortedCorridors.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.regionName.toLowerCase().includes(q) ||
      c.tier.label.toLowerCase().includes(q)
    );
  }, [sortedCorridors, hudSearchQuery]);

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current) return;

    if (!mapRef.current) {
      const provRenderer = L.svg({ padding: 2.5 });
      provinceRendererRef.current = provRenderer;

      const map = L.map(containerRef.current, {
        center: [11.2, 123.8],
        zoom: 6,
        minZoom: 5,
        maxZoom: 17,
        zoomControl: false,
        attributionControl: false,
        fadeAnimation: !reducedMotion,
        zoomAnimation: !reducedMotion,
        markerZoomAnimation: !reducedMotion,
        renderer: provRenderer,
        maxBounds: [
          [3.0, 114.0],
          [22.5, 132.0]
        ],
        maxBoundsViscosity: 0.75
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      const cfg = resolveBasemapLayers(currentTheme, activeLayer);
      if (cfg.base) {
        const base = L.tileLayer(cfg.base, {
          maxZoom: cfg.maxZoom,
          subdomains: cfg.subdomains || '',
          keepBuffer: 8,
          updateWhenIdle: true,
          updateWhenZooming: false
        }).addTo(map);
        baseLayerRef.current = base;
      }

      if (cfg.labels) {
        const labels = L.tileLayer(cfg.labels, {
          maxZoom: cfg.maxZoom,
          pane: 'overlayPane',
          keepBuffer: 8,
          updateWhenIdle: true,
          updateWhenZooming: false
        }).addTo(map);
        labelLayerRef.current = labels;
      }

      if (!map.getPane('spotlightPane')) {
        const spPane = map.createPane('spotlightPane');
        spPane.style.zIndex = '350';
        spPane.style.pointerEvents = 'none';
      }
      spotlightRendererRef.current = L.svg({ pane: 'spotlightPane', padding: 2.0 });

      provinceGeoGroupRef.current = L.layerGroup().addTo(map);
      heatCloudGroupRef.current = L.layerGroup().addTo(map);
      markersGroupRef.current = L.layerGroup().addTo(map);
      campaignPinsGroupRef.current = L.layerGroup().addTo(map);

      // User requirement: "clicking outside the country should deactivate the focus to improve efficiency"
      // User requirement: "I changed my mind, unfocusing on a country doesn't zoom out even a little"
      // Clicking outside deactivates the focus immediately with zero camera zoom out
      map.on('click', () => {
        if (isProvinceClickRef.current) return;

        // 1. If a beacon is focused, deselect the beacon and restore province camera view
        if (selectedBeaconRef.current) {
          handleCloseBeaconFocus();
          return;
        }

        if (campaignPinsGroupRef.current) {
          campaignPinsGroupRef.current.eachLayer(otherMarker => {
            otherMarker.setZIndexOffset(0);
            const otherEl = otherMarker.getElement();
            if (otherEl) {
              otherEl.classList.remove('is-marker-pinned', 'is-marker-hovered');
              const otherInner = otherEl.querySelector('.exact-campaign-tactical-pin');
              if (otherInner) {
                otherInner.classList.remove('is-card-pinned', 'is-card-hovered');
              }
            }
          });
        }
        if (isProvinceClickRef.current) return;
        if (focusedProvinceRef.current) {
          setFocusedProvince(null);
          focusedProvinceRef.current = null;
          setSelectedCluster(null);
          setIsDossierOpen(false);

          // Disclicking outside returns the zoom to the exact zoom height it was at before clicking the province
          if (preFocusViewRef.current && mapRef.current) {
            const { zoom: returnZoom, center: returnCenter } = preFocusViewRef.current;
            smoothNavigateTo(returnCenter, returnZoom);
            preFocusViewRef.current = null;
          }
        }
      });

      // Track movement states to prevent mid-flight hover recalculations that offset vector paths
      map.on('movestart zoomstart', () => {
        isMapMovingRef.current = true;
        clearAllHoveredProvinces();
      });

      // Clear any stuck hover highlight whenever the mouse enters ocean or empty map canvas
      map.on('mousemove', (e) => {
        if (!hoveredProvinceLayersRef.current || hoveredProvinceLayersRef.current.size === 0) return;
        const origTarget = e.originalEvent && e.originalEvent.target;
        if (!origTarget) return;

        // If cursor is over any pin, marker, beacon, or tooltip card, user is interacting with it
        if (origTarget.closest && origTarget.closest('.leaflet-marker-icon, .tactical-radar-node-wrapper, .tactical-radar-node, .province-leaflet-tooltip, .leaflet-tooltip, .exact-tactical-pin-wrapper')) {
          return;
        }

        // If cursor is over one of the currently hovered province vector paths, keep it highlighted
        let isOverHoveredLayer = false;
        hoveredProvinceLayersRef.current.forEach(hl => {
          if (hl._path && hl._path === origTarget) {
            isOverHoveredLayer = true;
          }
          if (typeof hl.eachLayer === 'function') {
            hl.eachLayer(sub => {
              if (sub._path && sub._path === origTarget) isOverHoveredLayer = true;
            });
          }
        });
        if (isOverHoveredLayer) return;

        // If cursor is over ANY other province path in GeoJSON, let that province's mouseover handle it
        if (origTarget.tagName === 'path' && origTarget.classList && origTarget.classList.contains('leaflet-interactive')) {
          return;
        }

        // Cursor is over ocean, map canvas, or unassociated tiles: clear all hover outlines
        clearAllHoveredProvinces();
      });

      // Clear any stuck hover highlight if the cursor leaves the map stage
      map.on('mouseout', () => {
        clearAllHoveredProvinces();
      });

      // Real-time progressive opacity fade while zooming
      const syncProvinceZoomStyles = () => {
        const currentFocused = focusedProvinceRef.current;
        const currentZ = map.getZoom();
        const activeL = activeLayerRef.current;
        const camps = campaignsRef.current;

        if (containerRef.current) {
          containerRef.current.classList.toggle('is-deep-zoom', currentZ >= 11 && currentZ < 13);
          containerRef.current.classList.toggle('is-ultra-zoom', currentZ >= 13);
        }

        if (geoJsonLayerRef.current) {
          geoJsonLayerRef.current.eachLayer((layer) => {
            const feature = layer.feature;
            if (feature) {
              const pName = feature.properties?.name || '';
              const isThisFocused = Boolean(currentFocused && (pName.toLowerCase() === currentFocused.toLowerCase()));
              const style = getProvinceStyle(feature, currentFocused, activeL, camps, currentZ);
              layer.setStyle(style);
              if (layer._path && typeof style.fillOpacity === 'number') {
                layer._path.setAttribute('fill-opacity', String(style.fillOpacity));
                layer._path.style.fillOpacity = String(style.fillOpacity);
              }
              if (isThisFocused) {
                layer.bringToFront();
              }
            }
          });
        }
      };

      map.on('zoom', () => {
        const currentZ = map.getZoom();
        setCurrentZoomLevel(currentZ);
        syncProvinceZoomStyles();
      });

      // Automatic vector synchronization on motion end (guarantees zero coordinate drift)
      map.on('moveend zoomend', () => {
        isMapMovingRef.current = false;
        const currentZ = map.getZoom();
        setCurrentZoomLevel(currentZ);
        syncProvinceZoomStyles();
      });

      // Barrier: Close any sector overview card immediately if a province is focused
      map.on('tooltipopen', (e) => {
        if (focusedProvinceRef.current) {
          const el = e.tooltip?.getElement();
          if (el && el.querySelector('.province-tooltip-card')) {
            e.tooltip.close();
          }
        }
      });

      if (containerRef.current) {
        const initZ = map.getZoom();
        containerRef.current.classList.toggle('is-deep-zoom', initZ >= 11 && initZ < 13);
        containerRef.current.classList.toggle('is-ultra-zoom', initZ >= 13);
      }

      mapRef.current = map;
    }

    const timer = setTimeout(() => {
      if (mapRef.current) mapRef.current.invalidateSize();
    }, 200);

    return () => {
      clearTimeout(timer);
      if (spotlightLayerRef.current && mapRef.current) {
        if (mapRef.current.hasLayer(spotlightLayerRef.current)) {
          mapRef.current.removeLayer(spotlightLayerRef.current);
        }
        spotlightLayerRef.current = null;
      }
      spotlightRendererRef.current = null;
      provinceRendererRef.current = null;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      provinceGeoGroupRef.current = null;
      heatCloudGroupRef.current = null;
      markersGroupRef.current = null;
      campaignPinsGroupRef.current = null;
    };
  }, []);

  // Update Basemap Layer when activeLayer OR currentTheme changes
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const cfg = resolveBasemapLayers(currentTheme, activeLayer);

    if (baseLayerRef.current) {
      map.removeLayer(baseLayerRef.current);
      baseLayerRef.current = null;
    }
    if (labelLayerRef.current) {
      map.removeLayer(labelLayerRef.current);
      labelLayerRef.current = null;
    }

    if (cfg.base) {
      const newBase = L.tileLayer(cfg.base, {
        maxZoom: cfg.maxZoom,
        subdomains: cfg.subdomains || '',
        keepBuffer: 8,
        updateWhenIdle: true,
        updateWhenZooming: false
      }).addTo(map);
      baseLayerRef.current = newBase;
    }

    if (cfg.labels) {
      const newLabels = L.tileLayer(cfg.labels, {
        maxZoom: cfg.maxZoom,
        pane: 'overlayPane',
        keepBuffer: 8,
        updateWhenIdle: true,
        updateWhenZooming: false
      }).addTo(map);
      labelLayerRef.current = newLabels;
    }
  }, [activeLayer, currentTheme]);

  // ── Canonical Sector Tooltip HTML Generator (Unified Inspection Card) ──
  // Shared identically between Province Vector Polygons and Tactical Cluster Node Pins to eliminate redundancy
  function createSectorTooltipHtml({
    pName = 'Province',
    regionName = '',
    count = 0,
    tier = null,
    totalEth = 0,
    isHub = false,
    memberProvinces = []
  }) {
    const safeTier = tier || getTier(count);
    const causesLabel = count === 1 ? 'Cause' : 'Causes';
    // Strip redundant parenthesized cause count since the card directly below shows active causes
    const cleanBadgeText = (safeTier.rainDesc || safeTier.label || '').replace(/\s*\(\d+\s*Causes?\)/i, '').trim();
    const ethFormatted = (typeof totalEth === 'number' ? totalEth : parseFloat(totalEth) || 0).toFixed(2);

    let displayTitle = pName;
    let displayRegion = regionName;
    if (displayTitle && displayTitle.includes('°N') && displayTitle.includes('°E')) {
      displayTitle = 'Southern Leyte';
      displayRegion = 'Region VIII (Eastern Visayas)';
    }

    return `
      <div class="province-tooltip-card ${isHub ? 'is-macro-hub' : ''}">
        <div class="prov-tooltip-header">
          <div class="prov-tooltip-title-col">
            <span class="prov-tooltip-title">${displayTitle}</span>
            ${displayRegion ? `<span class="prov-tooltip-region">${displayRegion}</span>` : ''}
          </div>
        </div>
        <div class="prov-tooltip-badge" style="--badge-tier: ${safeTier.color}; background: ${safeTier.color}1f; color: ${safeTier.color}; border: 1px solid ${safeTier.color}55;">
          <span class="prov-badge-pulse-dot" style="background: ${safeTier.color};"></span>
          <span>${cleanBadgeText}</span>
        </div>
        <div class="prov-tooltip-stats-grid">
          <div class="prov-stat-cardlet">
            <span class="prov-stat-k">Relief Operations</span>
            <span class="prov-stat-v text-accent"><strong>${count}</strong> Active ${causesLabel}</span>
          </div>
          <div class="prov-stat-cardlet">
            <span class="prov-stat-k">Funds Mobilized</span>
            <span class="prov-stat-v"><strong>₱${Number(Math.round(totalEth * 170000)).toLocaleString('en-US')}</strong></span>
          </div>
        </div>
        ${isHub && memberProvinces && memberProvinces.length > 0 ? `
          <div class="macro-breakdown-list">
            ${memberProvinces.map(m => `
              <div class="macro-breakdown-row">
                <span class="macro-dot" style="background-color: ${m.tier?.color || '#3b82f6'};"></span>
                <span class="macro-name">${m.name.split(',')[0]}</span>
                <strong class="macro-val">${m.count} cause${m.count > 1 ? 's' : ''}</strong>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  // Helper function to calculate style for any province tuned specifically per basemap
  function getProvinceStyle(feature, currentFocused, currentLayer, currentCampaigns, zoomLevel) {
    const pName = feature.properties?.name || '';
    const provCamps = getProvinceCampaigns(pName, currentCampaigns);
    const count = provCamps.length;
    const isPlainWhite = currentLayer === 'provinces';
    const hasFocus = Boolean(currentFocused);
    const isThisFocused = Boolean(hasFocus && (currentFocused.toLowerCase() === pName.toLowerCase()));
    const isHovered = Boolean(hoveredCorridorName && (hoveredCorridorName.toLowerCase() === pName.toLowerCase()));

    const z = typeof zoomLevel === 'number' ? zoomLevel : (mapRef.current ? mapRef.current.getZoom() : 6);
    const isZoomedOut = z <= 6.5;
    const isLightMode = currentTheme === 'light';

    // ── DYNAMIC PROVINCE COLOR OPACITY LOGIC (ACROSS ALL MAP STYLES) ──
    // 1. Zoomed out (z <= 6): ~65% opacity (0.65) to keep fills deeply saturated without obscuring relief/terrain
    // 2. Zooming in (z = 6 to 10): smoothly transitions from 65% (0.65) down to a balanced 30% floor (0.30)
    // 3. Zoomed in deeply (z >= 10): clamped at 30% minimum opacity so colors remain vivid while roads/pins are crystal clear
    // 4. Selected / Focused: reduces that specific province's opacity strictly to 10% (0.10) to highlight granular assets
    const dynamicZoomOpacity = z <= 6
      ? 0.65
      : (z >= 10 ? 0.30 : Number((0.65 - ((z - 6) / 4) * (0.65 - 0.30)).toFixed(3)));

    // ── IF A PROVINCE IS FOCUSED AND THIS IS NOT THE ONE: ELEGANTLY DIMMED & MUTED ──
    if (hasFocus && !isThisFocused) {
      if (count > 0) {
        const tier = getTier(count);
        return {
          noClip: true,
          fillColor: tier.color,
          fillOpacity: Math.min(dynamicZoomOpacity, 0.25),
          color: isPlainWhite ? (isLightMode ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.15)') : 'rgba(255, 255, 255, 0.20)',
          weight: 0.8,
          opacity: 0.60
        };
      }
      return {
        noClip: true,
        fillColor: isPlainWhite ? (isLightMode ? '#f5f5f5' : '#141414') : '#000000',
        fillOpacity: 0.04,
        color: isPlainWhite ? (isLightMode ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)') : 'rgba(255, 255, 255, 0.06)',
        weight: 0.5,
        opacity: 0.30
      };
    }

    // ── 1. ACTIVE DISASTER RELIEF PROVINCE (HIGH-CONTRAST TUNED PER BASEMAP) ──
    if (count > 0) {
      const tier = getTier(count);
      // Selected province's 10% opacity strictly overrides the normal zoom-based opacity
      const effectiveOpacity = isThisFocused
        ? 0.10
        : (isHovered ? Math.min(0.92, dynamicZoomOpacity + 0.08) : dynamicZoomOpacity);

      // SATELLITE: Photographic base with tier color-coded boundary at rest (White hover/focus outline)
      if (currentLayer === 'satellite') {
        return {
          noClip: true,
          fillColor: tier.color,
          fillOpacity: effectiveOpacity,
          color: isThisFocused ? '#ffffff' : (isHovered ? '#ffffff' : tier.color),
          weight: isThisFocused ? (z >= 9 ? 1.6 : 1.8) : (isHovered ? 2.2 : (isZoomedOut ? 0.8 : 1.2)),
          opacity: 0.95
        };
      }

      // PLAIN VECTOR: Clean choropleth with tier color-coded boundary at rest (Black hover/focus outline)
      if (isPlainWhite) {
        return {
          noClip: true,
          fillColor: tier.color,
          fillOpacity: effectiveOpacity,
          color: isThisFocused ? '#000000' : (isHovered ? '#000000' : tier.color),
          weight: isThisFocused ? (z >= 9 ? 1.6 : 1.8) : (isHovered ? 2.2 : (isZoomedOut ? 0.8 : 1.2)),
          opacity: 0.95
        };
      }

      // TERRAIN: Vivid saturation above hillshading with tier color-coded boundary at rest (Black hover/focus outline)
      if (currentLayer === 'terrain') {
        return {
          noClip: true,
          fillColor: tier.color,
          fillOpacity: effectiveOpacity,
          color: isThisFocused ? '#000000' : (isHovered ? '#000000' : tier.color),
          weight: isThisFocused ? (z >= 9 ? 1.6 : 1.8) : (isHovered ? 2.2 : (isZoomedOut ? 0.8 : 1.2)),
          opacity: 0.95
        };
      }

      // TACTICAL (ARCGIS CANVAS DARK / LIGHT): Luminous neon radar glow with tier color-coded boundary at rest (White hover/focus outline in dark mode, Black in light mode)
      if (currentLayer === 'tactical') {
        const tacticalHoverColor = isLightMode ? '#000000' : '#ffffff';
        return {
          noClip: true,
          fillColor: tier.color,
          fillOpacity: effectiveOpacity,
          color: isThisFocused ? tacticalHoverColor : (isHovered ? tacticalHoverColor : tier.color),
          weight: isThisFocused ? (z >= 9 ? 1.6 : 1.8) : (isHovered ? 2.2 : (isZoomedOut ? 0.8 : 1.2)),
          opacity: 0.95
        };
      }

      // STREET (OSM): Rich translucent overlay with tier color-coded boundary at rest (Black hover/focus outline)
      return {
        noClip: true,
        fillColor: tier.color,
        fillOpacity: effectiveOpacity,
        color: isThisFocused ? '#000000' : (isHovered ? '#000000' : tier.color),
        weight: isThisFocused ? (z >= 9 ? 1.6 : 1.8) : (isHovered ? 2.2 : (isZoomedOut ? 0.8 : 1.2)),
        opacity: 0.95
      };
    }

    // ── 2. UNAFFECTED PROVINCE (CLEAN NEUTRAL BOUNDARIES TUNED PER BASEMAP) ──
    if (currentLayer === 'satellite') {
      return {
        noClip: true,
        fillColor: isThisFocused ? 'rgba(255, 255, 255, 0.10)' : 'transparent',
        fillOpacity: isThisFocused ? 0.10 : 0,
        color: isThisFocused ? 'rgba(255, 255, 255, 0.90)' : 'rgba(255, 255, 255, 0.22)',
        weight: isThisFocused ? 1.4 : 0.6,
        opacity: 0.75
      };
    }

    if (isPlainWhite) {
      return {
        noClip: true,
        fillColor: isThisFocused ? (isLightMode ? 'rgba(0, 112, 243, 0.10)' : 'rgba(0, 112, 243, 0.10)') : (isLightMode ? '#f5f5f5' : '#141414'),
        fillOpacity: isThisFocused ? 0.10 : Math.max(0.15, 0.35 * (dynamicZoomOpacity / 0.80)),
        color: isThisFocused ? (isLightMode ? '#000000' : '#ffffff') : (isLightMode ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)'),
        weight: isThisFocused ? 1.4 : 0.6,
        opacity: 0.90
      };
    }

    if (currentLayer === 'tactical') {
      return {
        noClip: true,
        fillColor: isThisFocused ? (isLightMode ? 'rgba(0, 112, 243, 0.10)' : 'rgba(0, 112, 243, 0.10)') : 'transparent',
        fillOpacity: isThisFocused ? 0.10 : 0,
        color: isThisFocused ? (isLightMode ? '#000000' : '#ffffff') : (isLightMode ? 'rgba(0, 0, 0, 0.10)' : 'rgba(255, 255, 255, 0.10)'),
        weight: isThisFocused ? 1.4 : 0.6,
        opacity: 0.75
      };
    }

    // Terrain & Street unaffected
    return {
      noClip: true,
      fillColor: isThisFocused ? (isLightMode ? 'rgba(0, 112, 243, 0.10)' : 'rgba(0, 112, 243, 0.10)') : 'transparent',
      fillOpacity: isThisFocused ? 0.10 : 0,
      color: isThisFocused ? (isLightMode ? '#000000' : '#ffffff') : (isLightMode ? 'rgba(0, 0, 0, 0.10)' : 'rgba(255, 255, 255, 0.10)'),
      weight: isThisFocused ? 1.4 : 0.6,
      opacity: 0.75
    };
  }

  // Canonical style reset for any province vector layer (guarantees zero stuck hover strokes)
  function resetProvinceLayer(provLayer) {
    if (!provLayer || !provLayer.feature) return;
    const currentFocused = focusedProvinceRef.current;
    const pName = provLayer.feature.properties?.name || '';
    const isThisFocused = Boolean(currentFocused && (currentFocused.toLowerCase() === pName.toLowerCase()));
    if (isThisFocused) return; // Never reset the bold highlight of the focused province

    const currentActiveL = activeLayerRef.current || 'terrain';
    const currentCamps = campaignsRef.current || [];
    const currentZ = mapRef.current ? mapRef.current.getZoom() : 6;

    const freshStyle = getProvinceStyle(
      provLayer.feature,
      currentFocused,
      currentActiveL,
      currentCamps,
      currentZ
    );
    provLayer.setStyle(freshStyle);
    if (provLayer._path && typeof freshStyle.fillOpacity === 'number') {
      provLayer._path.setAttribute('fill-opacity', String(freshStyle.fillOpacity));
      provLayer._path.style.fillOpacity = String(freshStyle.fillOpacity);
    }
    if (currentFocused) {
      const focusedLayer = provinceLayersByNameRef.current.get(currentFocused.toLowerCase());
      if (focusedLayer && typeof focusedLayer.bringToFront === 'function') {
        focusedLayer.bringToFront();
      }
    }
  }

  // Clear all currently hovered province highlights safely
  function clearAllHoveredProvinces(keepLayer = null) {
    if (!hoveredProvinceLayersRef.current) return;
    hoveredProvinceLayersRef.current.forEach(layer => {
      if (layer !== keepLayer) {
        resetProvinceLayer(layer);
        hoveredProvinceLayersRef.current.delete(layer);
      }
    });
  }

  // Apply hover outline highlight safely to any province layer
  function setProvinceHoverHighlight(layer, hoverColor) {
    if (!layer || !layer.setStyle) return;
    const currentFocused = focusedProvinceRef.current;
    const pName = layer.feature?.properties?.name || '';
    if (currentFocused && currentFocused.toLowerCase() === pName.toLowerCase()) {
      return; // Do not alter the focused province style
    }
    hoveredProvinceLayersRef.current.add(layer);
    layer.setStyle({
      weight: 2.2,
      color: hoverColor,
      opacity: 1.0
    });
    if (typeof layer.bringToFront === 'function') {
      layer.bringToFront();
    }
  }

  // Hover outline color resolver:
  // - Terrain, Street (OSM), and Plain are always light maps -> Black (#000000)
  // - Satellite is always dark photographic base -> White (#ffffff)
  // - Tactical strictly adapts to app theme: White (#ffffff) in Dark Mode, Black (#000000) in Light Mode
  function getHoverOutlineColor(layerMode, themeMode) {
    if (layerMode === 'tactical') {
      return themeMode === 'light' ? '#000000' : '#ffffff';
    }
    if (layerMode === 'satellite') {
      return '#ffffff';
    }
    return '#000000'; // 'terrain', 'osm', 'provinces'
  }

  // Robust province layer resolver supporting canonical names, aliases, and comma-separated cities
  function resolveProvinceLayerForName(rawName) {
    if (!rawName || !provinceLayersByNameRef.current) return null;
    const clean = rawName.toLowerCase().trim();
    if (provinceLayersByNameRef.current.has(clean)) {
      return provinceLayersByNameRef.current.get(clean);
    }
    if (clean.includes(',')) {
      const parts = clean.split(',').map(p => p.trim());
      for (const part of parts) {
        if (provinceLayersByNameRef.current.has(part)) {
          return provinceLayersByNameRef.current.get(part);
        }
      }
    }
    for (const [key, layer] of provinceLayersByNameRef.current.entries()) {
      if (clean.includes(key) || key.includes(clean)) {
        return layer;
      }
    }
    return null;
  }

  // ── Initialize Philippine Provinces GeoJSON Layer (BUILT ONCE, ZERO FLICKER) ──
  useEffect(() => {
    if (!mapRef.current || !provinceGeoGroupRef.current) return;
    const geoGroup = provinceGeoGroupRef.current;
    geoGroup.clearLayers();

    const provRenderer = provinceRendererRef.current || L.svg({ padding: 2.5 });

    const geoJsonLayer = L.geoJSON(PH_PROVINCES_GEOJSON, {
      renderer: provRenderer,
      noClip: true,
      style: (feature) => ({
        noClip: true,
        ...getProvinceStyle(feature, focusedProvinceRef.current, activeLayer, activeCampaigns, mapRef.current ? mapRef.current.getZoom() : 6)
      }),
      onEachFeature: (feature, layer) => {
        const pName = feature.properties?.name || 'Province';
        const pKey = pName.toLowerCase().trim();
        provinceLayersByNameRef.current.set(pKey, layer);

        const provCamps = getProvinceCampaigns(pName, activeCampaigns);
        const count = provCamps.length;
        const tier = count > 0 ? getTier(count) : null;
        const totalEth = provCamps.reduce((acc, c) => acc + (parseFloat(c.currentAmount || c.raised_eth || 0) || 0), 0);
        const totalTargetEth = provCamps.reduce((acc, c) => acc + (parseFloat(c.targetAmount || c.target_eth || 0) || 0), 0);
        const provCentroid = PROVINCE_CENTROIDS[pKey];
        const regionName = provCentroid?.region || feature.properties?.region || '';

        // Only bind tooltips for provinces with active campaigns to prevent mousemove lag
        if (count > 0) {
          const tooltipHtml = createSectorTooltipHtml({
            pName,
            regionName,
            count,
            tier,
            totalEth
          });

          const tooltip = L.tooltip({
            sticky: true,
            direction: 'top',
            offset: [0, -14],
            opacity: 0.98,
            className: 'province-leaflet-tooltip'
          }).setContent(tooltipHtml);

          layer.bindTooltip(tooltip);
        }

        // Adaptive Bounds & Flip Logic for Province Polygon Tooltip:
        // Automatically flips down and clamps horizontally so card NEVER collides with or overlaps borders
        const updateLayerTooltipBounds = (e) => {
          const tt = layer.getTooltip();
          if (!tt || !mapRef.current || !e || !e.containerPoint) return;
          const pt = e.containerPoint;
          const size = mapRef.current.getSize();
          const flipDown = pt.y < 225;
          const targetDirection = flipDown ? 'bottom' : 'top';
          let offsetX = 0;
          const cardHalfWidth = 125;
          if (pt.x < cardHalfWidth + 16) {
            offsetX = (cardHalfWidth + 16) - pt.x;
          } else if (pt.x > size.x - (cardHalfWidth + 16)) {
            offsetX = -(pt.x - (size.x - (cardHalfWidth + 16)));
          }
          const offsetY = flipDown ? 20 : -14;

          const curOffset = tt.options.offset || [0, 0];
          if (tt.options.direction !== targetDirection || curOffset[0] !== offsetX || curOffset[1] !== offsetY) {
            tt.options.direction = targetDirection;
            tt.options.offset = [offsetX, offsetY];
            if (tt.isOpen && tt.isOpen()) {
              tt.update();
            }
          }
        };

        layer.on({
          mousedown: (e) => {
            // Prevent browser from focusing the SVG path element (stops Chrome from drawing bounding-box outline)
            if (e && e.originalEvent && typeof e.originalEvent.preventDefault === 'function') {
              e.originalEvent.preventDefault();
            }
          },
          mouseover: (e) => {
            if (isMapMovingRef.current) return;
            const currentFocused = focusedProvinceRef.current;
            const isThisFocused = Boolean(currentFocused && (currentFocused.toLowerCase() === pKey));

            // If this province is already focused, suppress its tooltip entirely —
            // the mission pins are already visible; the "Click to focus" tooltip is misleading.
            if (isThisFocused) {
              if (layer.getTooltip()) layer.closeTooltip();
              return; // Also skip hover highlight for the focused province border
            }

            // Immediately clear any other hovered provinces to eliminate stuck hover borders
            clearAllHoveredProvinces(e.target);

            updateLayerTooltipBounds(e);

            const currentActiveL = activeLayerRef.current || 'terrain';
            const currentThemeMode = currentThemeRef.current || 'dark';
            const hoverColor = getHoverOutlineColor(currentActiveL, currentThemeMode);

            setProvinceHoverHighlight(e.target, hoverColor);
          },
          mousemove: (e) => {
            if (isMapMovingRef.current) return;
            const currentFocused = focusedProvinceRef.current;
            const isThisFocused = Boolean(currentFocused && (currentFocused.toLowerCase() === pKey));
            if (isThisFocused) return;
            updateLayerTooltipBounds(e);
          },
          mouseout: (e) => {
            const relTarget = e.originalEvent && e.originalEvent.relatedTarget;
            const marker = clusterMarkersByProvinceRef.current.get(pKey);
            const markerEl = marker?.getElement ? marker.getElement() : null;

            // If cursor is moving directly into this province's cluster marker or its tooltip card, maintain outline
            if (relTarget) {
              if (markerEl && (relTarget === markerEl || markerEl.contains(relTarget))) return;
              if (relTarget.closest && relTarget.closest('.province-leaflet-tooltip, .leaflet-marker-icon')) return;
            }

            resetProvinceLayer(e.target);
            if (hoveredProvinceLayersRef.current) {
              hoveredProvinceLayersRef.current.delete(e.target);
            }
          },
          click: (e) => {
            if (e && e.originalEvent) {
              L.DomEvent.stopPropagation(e.originalEvent);
              // Explicitly blur the clicked element so the browser drops any focus ring immediately
              if (e.originalEvent.target && typeof e.originalEvent.target.blur === 'function') {
                e.originalEvent.target.blur();
              }
            }
            if (document.activeElement && typeof document.activeElement.blur === 'function') {
              document.activeElement.blur();
            }
            if (layer._path && typeof layer._path.blur === 'function') {
              layer._path.blur();
            }

            // Close tooltip immediately across map — prevents the info card from remaining open
            if (layer.getTooltip()) layer.closeTooltip();
            if (mapRef.current) {
              mapRef.current.eachLayer(l => {
                if (typeof l.closeTooltip === 'function') {
                  try { l.closeTooltip(); } catch (_) { }
                }
              });
            }

            isProvinceClickRef.current = true;
            setTimeout(() => {
              isProvinceClickRef.current = false;
            }, 150);

            // Record zoom height and center before focusing so disclicking outside smoothly returns
            if (!focusedProvinceRef.current && mapRef.current) {
              preFocusViewRef.current = {
                zoom: mapRef.current.getZoom(),
                center: mapRef.current.getCenter()
              };
            }

            setFocusedProvince(pName);
            focusedProvinceRef.current = pName;
            // Do NOT open a dossier/cluster card on province click — mission pins are revealed instead
            setSelectedCluster(null);

            const bounds = layer.getBounds();
            if (mapRef.current && bounds && bounds.isValid()) {
              const center = bounds.getCenter();
              lastFocusCenterRef.current = [center.lat, center.lng];
              const optimalZoom = getProvinceOptimalZoom(bounds, mapRef.current);
              smoothNavigateTo(center, optimalZoom);
            }
          }
        });

        // Ensure path element has no tabindex and no outline
        if (layer._path) {
          layer._path.setAttribute('tabindex', '-1');
          layer._path.style.outline = 'none';
        }
      }
    });

    geoGroup.addLayer(geoJsonLayer);
    geoJsonLayerRef.current = geoJsonLayer;
  }, [activeCampaigns]);

  // ── Smoothly Update Province Styles on Focus Change ──
  useEffect(() => {
    focusedProvinceRef.current = focusedProvince;
    if (!geoJsonLayerRef.current) return;

    geoJsonLayerRef.current.eachLayer((layer) => {
      const feature = layer.feature;
      if (!feature) return;
      const pName = feature.properties?.name || '';
      const isThisFocused = Boolean(focusedProvince && (pName.toLowerCase() === focusedProvince.toLowerCase()));
      const provStyle = getProvinceStyle(feature, focusedProvince, activeLayer, activeCampaigns, mapRef.current ? mapRef.current.getZoom() : 6);

      // Explicitly update focus and dim classes on each province path
      if (layer._path) {
        layer._path.classList.remove('is-focused-province', 'is-dimmed-province');
        if (focusedProvince) {
          if (isThisFocused) {
            layer._path.classList.add('is-focused-province');
          } else {
            layer._path.classList.add('is-dimmed-province');
          }
        }
        layer._path.setAttribute('tabindex', '-1');
        layer._path.style.outline = 'none';
        if (typeof layer._path.blur === 'function') {
          layer._path.blur();
        }
      }

      // Explicitly set the exact style directly on each layer
      layer.setStyle(provStyle);
      if (layer._path && typeof provStyle.fillOpacity === 'number') {
        layer._path.setAttribute('fill-opacity', String(provStyle.fillOpacity));
        layer._path.style.fillOpacity = String(provStyle.fillOpacity);
      }

      if (isThisFocused && !isMapMovingRef.current) {
        layer.bringToFront();
      }
    });
  }, [focusedProvince, activeLayer, activeCampaigns, hoveredCorridorName, currentTheme]);

  // ── Native Vector Spotlight Dimmer (Punches 100% Crisp Hole in spotlightPane at zIndex 350) ──
  // Living strictly in spotlightPane (zIndex 350), it is BELOW markerPane (zIndex 600) and popupPane (zIndex 700)
  // so the HUD card and mission pins are NEVER darkened or clipped!
  const getOuterRing = (map) => {
    if (!map) return [[-35, 75], [-35, 165], [45, 165], [45, 75]];
    const b = map.getBounds().pad(2.0);
    return [
      [b.getSouth(), b.getWest()],
      [b.getSouth(), b.getEast()],
      [b.getNorth(), b.getEast()],
      [b.getNorth(), b.getWest()]
    ];
  };

  const getProvinceHoles = (provName) => {
    if (!provName) return [];
    const targetLower = provName.toLowerCase().trim();
    let feat = PH_PROVINCES_GEOJSON.features.find(f => {
      const n = (f.properties?.name || '').toLowerCase().trim();
      const alt = (f.properties?.alt_name || '').toLowerCase().trim();
      return n === targetLower || alt === targetLower;
    });
    if (!feat) {
      feat = PH_PROVINCES_GEOJSON.features.find(f => {
        const n = (f.properties?.name || '').toLowerCase().trim();
        const alt = (f.properties?.alt_name || '').toLowerCase().trim();
        return targetLower.startsWith(n) || n.startsWith(targetLower) ||
          (alt && (targetLower.startsWith(alt) || alt.startsWith(targetLower)));
      });
    }
    if (!feat || !feat.geometry) return [];

    if (feat.geometry.type === 'Polygon') {
      // GeoJSON is [lng, lat], Leaflet is [lat, lng]
      return [
        feat.geometry.coordinates[0].map(([lng, lat]) => [lat, lng])
      ];
    } else if (feat.geometry.type === 'MultiPolygon') {
      return feat.geometry.coordinates.map(poly =>
        poly[0].map(([lng, lat]) => [lat, lng])
      );
    }
    return [];
  };

  // Sync native vector spotlight overlay when focused province or theme changes
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const targetOpacity = currentTheme === 'light' ? 0.20 : 0.35;
    const targetColor = '#000000';

    if (focusedProvince) {
      const holes = getProvinceHoles(focusedProvince);
      if (holes.length > 0) {
        const outerRing = getOuterRing(map);
        const latlngs = [outerRing, ...holes];

        if (spotlightLayerRef.current && map.hasLayer(spotlightLayerRef.current)) {
          spotlightLayerRef.current.setLatLngs(latlngs);
          spotlightLayerRef.current.setStyle({
            fillColor: targetColor,
            fillOpacity: targetOpacity
          });
          if (spotlightLayerRef.current.redraw) spotlightLayerRef.current.redraw();
        } else {
          const polygon = L.polygon(latlngs, {
            pane: 'spotlightPane',
            renderer: spotlightRendererRef.current,
            noClip: true,
            fillColor: targetColor,
            fillOpacity: targetOpacity,
            stroke: false,
            interactive: false,
            className: 'radar-spotlight-polygon'
          }).addTo(map);

          spotlightLayerRef.current = polygon;
        }
        return;
      }
    }

    // Unfocus: smooth fade out transition
    if (spotlightLayerRef.current) {
      const layer = spotlightLayerRef.current;
      layer.setStyle({ fillOpacity: 0 });
      const timer = setTimeout(() => {
        if (!focusedProvinceRef.current && spotlightLayerRef.current === layer) {
          if (mapRef.current && mapRef.current.hasLayer(layer)) {
            mapRef.current.removeLayer(layer);
          }
          spotlightLayerRef.current = null;
        }
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [focusedProvince, currentTheme]);

  // Keep outer ring aligned with viewport bounds on motion end
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const onMotionEnd = () => {
      if (focusedProvinceRef.current && spotlightLayerRef.current) {
        const holes = getProvinceHoles(focusedProvinceRef.current);
        if (holes.length > 0) {
          const outerRing = getOuterRing(map);
          spotlightLayerRef.current.setLatLngs([outerRing, ...holes]);
        }
      }
    };

    map.on('moveend zoomend', onMotionEnd);
    return () => {
      map.off('moveend zoomend', onMotionEnd);
    };
  }, []);

  // Render Regional Doppler Precipitation Cloud & Markers
  // Color the part/section of the Philippines according to campaign density
  useEffect(() => {
    if (!mapRef.current || !heatCloudGroupRef.current || !markersGroupRef.current) return;

    const map = mapRef.current;
    const heatGroup = heatCloudGroupRef.current;
    const markersGroup = markersGroupRef.current;
    heatGroup.clearLayers();
    markersGroup.clearLayers();
    clusterMarkersByProvinceRef.current.clear();

    // When a province is focused, hide national cluster badges (exact campaign pins will show instead)
    if (focusedProvince) {
      if (map.hasLayer(markersGroup)) {
        map.removeLayer(markersGroup);
      }
      if (map.hasLayer(heatGroup)) {
        map.removeLayer(heatGroup);
      }
      return;
    }

    // Ensure national layer groups are active on the map
    if (!map.hasLayer(markersGroup)) {
      map.addLayer(markersGroup);
    }
    if (!map.hasLayer(heatGroup)) {
      map.addLayer(heatGroup);
    }

    const currentZ = map.getZoom();

    // Dynamically aggregate clusters based on screen distance to guarantee ZERO overcrowding
    const rawClusters = aggregateClustersByScreenDistance(visibleClusters, currentZ, map);
    const clustersToRender = (rawClusters && rawClusters.length > 0) ? rawClusters : (visibleClusters || []);

    clustersToRender.forEach(cluster => {
      const { lat, lng, tier, campaigns: clusterCamps } = cluster;
      const count = clusterCamps.length;
      const isHub = Boolean(cluster.isMacroHub);
      const provName = cluster.name.split(',')[0].trim();
      const provKey = provName.toLowerCase();

      // ── Doppler Storm Beacon (Tactical Precision Node / Macro Hub) ──
      // Modern high-contrast tactical shield with tier color aura, alert icon, and directional ground pointer
      const markerHtml = `
        <div class="tactical-radar-node ${isHub ? 'macro-hub' : ''} tier-${tier.level}" style="--tier-color: ${tier.color}; --tier-glow: ${tier.glowColor};">
          <div class="node-sonar-pulse wave-1"></div>
          <div class="node-sonar-pulse wave-2"></div>
          <div class="node-badge-core">
            <span class="material-symbols-outlined node-icon">${isHub ? 'hub' : 'crisis_alert'}</span>
            <span class="node-count">${count}</span>
          </div>
          <div class="node-pointer-arrow"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'tactical-radar-node-wrapper',
        iconSize: isHub ? [54, 34] : [46, 30],
        iconAnchor: isHub ? [27, 34] : [23, 30]
      });

      const marker = L.marker([lat, lng], { icon: customIcon, interactive: true });

      // Map this marker for single canonical tooltip synchronization
      clusterMarkersByProvinceRef.current.set(provKey, marker);
      const canonicalProvLayer = resolveProvinceLayerForName(cluster.name);
      if (canonicalProvLayer?.feature?.properties?.name) {
        clusterMarkersByProvinceRef.current.set(canonicalProvLayer.feature.properties.name.toLowerCase().trim(), marker);
      }
      if (isHub && cluster.memberProvinces) {
        cluster.memberProvinces.forEach(m => {
          const memLayer = resolveProvinceLayerForName(m.name);
          if (memLayer?.feature?.properties?.name) {
            clusterMarkersByProvinceRef.current.set(memLayer.feature.properties.name.toLowerCase().trim(), marker);
          }
          const memKey = m.name.split(',')[0].trim().toLowerCase();
          clusterMarkersByProvinceRef.current.set(memKey, marker);
        });
      }

      const tooltipHtml = createSectorTooltipHtml({
        pName: cluster.name,
        regionName: cluster.regionName,
        count,
        tier,
        totalEth: cluster.totalRaised,
        isHub,
        memberProvinces: cluster.memberProvinces
      });

      // Adaptive Tooltip Bounds & Flip Logic: Ensures cluster card NEVER collides with or overlaps top/side borders
      const updateClusterTooltipBounds = () => {
        if (!mapRef.current) return;
        const pt = mapRef.current.latLngToContainerPoint([lat, lng]);
        const size = mapRef.current.getSize();
        const tt = marker.getTooltip();
        if (!tt) return;

        // Card height is ~155px. If pin is in the upper 225px of the map container, FLIP DOWN
        const flipDown = pt.y < 225;
        const targetDirection = flipDown ? 'bottom' : 'top';
        const cardHalfWidth = isHub ? 135 : 125;
        let offsetX = 0;
        if (pt.x < cardHalfWidth + 16) {
          offsetX = (cardHalfWidth + 16) - pt.x;
        } else if (pt.x > size.x - (cardHalfWidth + 16)) {
          offsetX = -(pt.x - (size.x - (cardHalfWidth + 16)));
        }
        const offsetY = flipDown ? (isHub ? 18 : 14) : (isHub ? -40 : -36);

        const curOffset = tt.options.offset || [0, 0];
        if (tt.options.direction !== targetDirection || curOffset[0] !== offsetX || curOffset[1] !== offsetY) {
          tt.options.direction = targetDirection;
          tt.options.offset = [offsetX, offsetY];
          if (tt.isOpen && tt.isOpen()) {
            tt.update();
          }
        }
      };

      marker._updateTooltipBounds = updateClusterTooltipBounds;

      marker.bindTooltip(tooltipHtml, {
        direction: 'top',
        offset: isHub ? [0, -40] : [0, -36],
        opacity: 0.98,
        className: 'province-leaflet-tooltip'
      });

      marker.on({
        mouseover: () => {
          updateClusterTooltipBounds();
          if (isMapMovingRef.current) return;
          const currentActiveL = activeLayerRef.current || 'terrain';
          const currentThemeMode = currentThemeRef.current || 'dark';
          const hoverColor = getHoverOutlineColor(currentActiveL, currentThemeMode);

          // Highlight underlying province polygon (black on terrain/osm, white on tactical/satellite)
          if (isHub && cluster.memberProvinces) {
            const memberLayers = [];
            cluster.memberProvinces.forEach(m => {
              const l = resolveProvinceLayerForName(m.name);
              if (l) memberLayers.push(l);
            });
            // Clear any layers not in this hub
            if (hoveredProvinceLayersRef.current) {
              hoveredProvinceLayersRef.current.forEach(hl => {
                if (!memberLayers.includes(hl)) {
                  resetProvinceLayer(hl);
                  hoveredProvinceLayersRef.current.delete(hl);
                }
              });
            }
            memberLayers.forEach(l => {
              setProvinceHoverHighlight(l, hoverColor);
            });
          } else {
            const provLayer = resolveProvinceLayerForName(cluster.name) || provinceLayersByNameRef.current.get(provKey);
            if (provLayer) {
              clearAllHoveredProvinces(provLayer);
              setProvinceHoverHighlight(provLayer, hoverColor);
            }
          }
        },
        mouseout: (e) => {
          const relTarget = e && e.originalEvent && e.originalEvent.relatedTarget;
          const markerEl = marker.getElement ? marker.getElement() : null;

          // If cursor is still inside this marker element or its tooltip, do NOT reset
          if (relTarget) {
            if (markerEl && (relTarget === markerEl || markerEl.contains(relTarget))) return;
            if (relTarget.closest && relTarget.closest('.province-leaflet-tooltip')) return;

            // If cursor moved directly onto the underlying province polygon, do NOT reset
            const provLayer = resolveProvinceLayerForName(cluster.name) || provinceLayersByNameRef.current.get(provKey);
            if (provLayer && provLayer._path && provLayer._path === relTarget) return;

            if (isHub && cluster.memberProvinces) {
              const isOverMemberPath = cluster.memberProvinces.some(m => {
                const l = resolveProvinceLayerForName(m.name);
                return l && l._path && l._path === relTarget;
              });
              if (isOverMemberPath) return;
            }
          }

          // Reset underlying province polygon style
          if (isHub && cluster.memberProvinces) {
            cluster.memberProvinces.forEach(m => {
              const l = resolveProvinceLayerForName(m.name);
              if (l) {
                resetProvinceLayer(l);
                if (hoveredProvinceLayersRef.current) hoveredProvinceLayersRef.current.delete(l);
              }
            });
          } else {
            const provLayer = resolveProvinceLayerForName(cluster.name) || provinceLayersByNameRef.current.get(provKey);
            if (provLayer) {
              resetProvinceLayer(provLayer);
              if (hoveredProvinceLayersRef.current) hoveredProvinceLayersRef.current.delete(provLayer);
            }
          }
        },
        click: (e) => {
          if (e && e.originalEvent) {
            L.DomEvent.stopPropagation(e.originalEvent);
          }
          if (marker.getTooltip()) marker.closeTooltip();
          if (mapRef.current) {
            mapRef.current.eachLayer(l => {
              if (typeof l.closeTooltip === 'function') {
                try { l.closeTooltip(); } catch (_) { }
              }
            });
          }

          isProvinceClickRef.current = true;
          setTimeout(() => {
            isProvinceClickRef.current = false;
          }, 150);

          // Save view before focus if not already focused
          if (!focusedProvinceRef.current && mapRef.current) {
            preFocusViewRef.current = {
              zoom: mapRef.current.getZoom(),
              center: mapRef.current.getCenter()
            };
          }

          if (cluster.isMacroHub) {
            // Clicking a regional macro hub smoothly zooms in to unpack the member provinces
            if (mapRef.current) {
              smoothNavigateTo([lat, lng], cluster.zoomTarget || 8.5);
            }
            return;
          }

          setSelectedCluster(cluster);
          const provName = cluster.name.split(',')[0].trim();
          setFocusedProvince(provName);
          focusedProvinceRef.current = provName;
          lastFocusCenterRef.current = [lat, lng];

          if (mapRef.current) {
            const provLayer = provinceLayersByNameRef.current.get(provName.toLowerCase());
            if (provLayer && provLayer.getBounds && provLayer.getBounds().isValid()) {
              const bounds = provLayer.getBounds();
              const optimalZoom = getProvinceOptimalZoom(bounds, mapRef.current);
              smoothNavigateTo(bounds.getCenter(), optimalZoom);
            } else {
              const currentZoom = mapRef.current.getZoom();
              const targetZoom = Math.max(currentZoom, 8.5);
              smoothNavigateTo([lat, lng], targetZoom);
            }
          }
        },
        tooltipopen: () => {
          updateClusterTooltipBounds();
        }
      });

      markersGroup.addLayer(marker);
    });

    // Re-check positioning of any open cluster tooltip when the map moves or zooms
    const handleMoveForClusterTooltips = () => {
      markersGroup.eachLayer(m => {
        if (typeof m._updateTooltipBounds === 'function') {
          const tt = m.getTooltip();
          if (tt && tt.isOpen && tt.isOpen()) {
            m._updateTooltipBounds();
          }
        }
      });
    };
    if (map) {
      map.on('move', handleMoveForClusterTooltips);
    }

    return () => {
      if (map) {
        map.off('move', handleMoveForClusterTooltips);
      }
    };
  }, [visibleClusters, currentTheme, currentZoomLevel, focusedProvince, activeLayer]);

  // Toggle Cluster Beacon Visibility & Suppress Province Tooltips on Focus Change
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Explicitly close all tooltips on the map
    map.eachLayer(l => {
      if (typeof l.closeTooltip === 'function') {
        try { l.closeTooltip(); } catch (_) { }
      }
    });

    if (focusedProvince) {
      // 1. Hide cluster markers & heat cloud
      if (markersGroupRef.current) {
        markersGroupRef.current.eachLayer(m => {
          if (typeof m.closeTooltip === 'function') {
            try { m.closeTooltip(); } catch (_) { }
          }
        });
        if (map.hasLayer(markersGroupRef.current)) {
          map.removeLayer(markersGroupRef.current);
        }
      }
      if (heatCloudGroupRef.current && map.hasLayer(heatCloudGroupRef.current)) {
        map.removeLayer(heatCloudGroupRef.current);
      }

      // 2. Unbind tooltips on all GeoJSON province layers
      // This completely strips Leaflet's internal mousemove/mouseover listeners for tooltips
      if (geoJsonLayerRef.current) {
        geoJsonLayerRef.current.eachLayer(l => {
          if (typeof l.closeTooltip === 'function') {
            try { l.closeTooltip(); } catch (_) { }
          }
          if (typeof l.getTooltip === 'function' && l.getTooltip()) {
            l._savedSectorTooltip = l.getTooltip();
            l.unbindTooltip();
          }
        });
      }
    } else {
      // Restore cluster markers & heat cloud
      if (markersGroupRef.current && !map.hasLayer(markersGroupRef.current)) {
        map.addLayer(markersGroupRef.current);
      }
      if (heatCloudGroupRef.current && !map.hasLayer(heatCloudGroupRef.current)) {
        map.addLayer(heatCloudGroupRef.current);
      }

      // Restore tooltips on GeoJSON province layers
      if (geoJsonLayerRef.current) {
        geoJsonLayerRef.current.eachLayer(l => {
          if (l._savedSectorTooltip && (!l.getTooltip || !l.getTooltip())) {
            l.bindTooltip(l._savedSectorTooltip);
            l._savedSectorTooltip = null;
          }
        });
      }
    }
  }, [focusedProvince]);

  // ── Render Exact Campaign Pin Locations in Focused Province ─────────────
  // "Clicking it reveals exact pin location on where the campaign really is in that exact province location"
  useEffect(() => {
    if (!mapRef.current || !campaignPinsGroupRef.current) return;
    const pinsGroup = campaignPinsGroupRef.current;
    pinsGroup.clearLayers();

    if (!focusedProvince) return;

    const provCamps = getProvinceCampaigns(focusedProvince, activeCampaigns);
    if (!provCamps || provCamps.length === 0) return;

    // Distance-based collision avoidance: ensure all placed pins have a minimum visual separation
    const placedPins = [];
    const MIN_PIN_DISTANCE_DEG = 0.038; // ~4.2km separation ensures zero disc overlap
    pinCoordsByCampIdRef.current.clear();

    provCamps.forEach((camp, idx) => {
      const campId = String(camp.id || camp.title);
      const baseCoords = resolveCampaignCoords(camp);
      let lat = baseCoords[0];
      let lng = baseCoords[1];

      // Detect if this pin is within colliding proximity of any already-placed pin
      let closeNeighbors = 0;
      for (const placed of placedPins) {
        const dLat = placed.lat - baseCoords[0];
        const dLng = placed.lng - baseCoords[1];
        const dist = Math.sqrt(dLat * dLat + dLng * dLng);
        if (dist < MIN_PIN_DISTANCE_DEG) {
          closeNeighbors++;
        }
      }

      if (closeNeighbors > 0) {
        // Multi-directional orbital distribution: spreads overlapping pins along clean radial offsets
        const angle = (closeNeighbors * (2 * Math.PI / Math.min(provCamps.length, 6))) + (idx * 0.85);
        const radius = 0.028 + (closeNeighbors * 0.016);
        lat = baseCoords[0] + Math.cos(angle) * radius;
        lng = baseCoords[1] + Math.sin(angle) * radius;
      }

      placedPins.push({ lat, lng });
      pinCoordsByCampIdRef.current.set(campId, [lat, lng]);

      const raised = parseFloat(camp.currentAmount || camp.raised_eth || 0) || 0;
      const target = parseFloat(camp.targetAmount || camp.target_eth || 0) || 0;
      const pct = target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 0;

      const ETH_TO_PHP = 170000;
      const raisedPhp = camp.raised_php || camp.currentAmountPhp || Math.round(raised * ETH_TO_PHP);
      const targetPhp = camp.target_php || camp.targetAmountPhp || Math.round(target * ETH_TO_PHP);

      const catMeta = getCampaignCategoryMeta(camp);
      const subLocation = resolveCampaignSubLocation(camp, focusedProvince);

      // 4-direction fan-out: each pin radiates its chip in a different direction
      // so nearby pins NEVER stack their chips on the same side (no vertical collision).
      const rawTitle = camp.title || 'Relief Mission';
      // Smart display title: strip generic noise words, keep specific identifiers legible
      const stripped = rawTitle.replace(/(operation|project)/gi, '').trim();
      const displayTitle = stripped.length > 20 ? stripped.slice(0, 18).trim() + '…' : stripped;

      const isThisBeaconSelected = Boolean(selectedBeaconRef.current && selectedBeaconRef.current === campId);
      const isOtherBeaconSelected = Boolean(selectedBeaconRef.current && selectedBeaconRef.current !== campId);

      // Resolve disaster aftermath photos if attached
      let pinDisasterPhotos = camp.disasterImages;
      if (!pinDisasterPhotos && (camp.disaster_images_json || camp.disasterImagesJson)) {
        try {
          const parsed = typeof (camp.disaster_images_json || camp.disasterImagesJson) === 'string'
            ? JSON.parse(camp.disaster_images_json || camp.disasterImagesJson)
            : (camp.disaster_images_json || camp.disasterImagesJson);
          if (Array.isArray(parsed) && parsed.length > 0) pinDisasterPhotos = parsed;
        } catch (_) {}
      }
      const firstPinPhoto = Array.isArray(pinDisasterPhotos) && pinDisasterPhotos.length > 0 ? pinDisasterPhotos[0] : null;
      const pinPhotoCount = Array.isArray(pinDisasterPhotos) ? pinDisasterPhotos.length : 0;

      const pinHtml = `
        <div class="exact-campaign-tactical-pin ${isThisBeaconSelected ? 'is-beacon-selected' : ''} ${isOtherBeaconSelected ? 'is-beacon-dimmed' : ''}" style="--pin-color: ${catMeta.color}; --glow-color: ${catMeta.glowColor}; animation-delay: ${idx * 90}ms;">
          <!-- Visual Beacon Head, Stem, and Reticle (Scales dynamically on zoom in) -->
          <div class="pin-visual-beacon">
            <!-- Visible Sonar Pulse Waves -->
            <div class="pin-pulse-wave wave-1"></div>
            <div class="pin-pulse-wave wave-2"></div>

            <!-- Compact Tactical Reticle -->
            <div class="pin-target-reticle" style="border-color: ${catMeta.color};"></div>

            <!-- Ground Marker Head & Anchor Stem -->
            <div class="pin-head-disc" style="background: ${catMeta.color}; border-color: #ffffff; color: #ffffff;">
              <span class="material-symbols-outlined pin-symbol" style="color: inherit;">${catMeta.icon}</span>
            </div>
            <div class="pin-beacon-stem" style="background: linear-gradient(to bottom, ${catMeta.color}, rgba(255,255,255,0.7));"></div>
            <div class="pin-anchor-dot" style="background: ${catMeta.color};"></div>
          </div>
          
          <!-- Mission HUD Card (Clean, Spacious, Essential Info Only) -->
          <div class="pin-tactical-hud-card">
            <div class="hud-expanded-view">
              <!-- Header: Category Badge & Live Status -->
              <div class="hud-exp-header">
                <div class="hud-exp-cat" style="background: ${catMeta.color}18; color: ${catMeta.color}; border: 1px solid ${catMeta.color}55;">
                  <span class="material-symbols-outlined" style="font-size: 14px; color: ${catMeta.color};">${catMeta.icon}</span>
                  <span>${catMeta.shortLabel}</span>
                </div>
                <div class="hud-exp-badge">
                  <span class="hud-status-pulse-dot"></span>
                  <span>ACTIVE</span>
                </div>
              </div>

              ${firstPinPhoto ? `
                <div class="hud-aftermath-thumb-wrap">
                  <img src="${firstPinPhoto}" alt="Disaster impact evidence" class="hud-aftermath-thumb-img" />
                  <span class="hud-aftermath-badge">
                    <span class="material-symbols-outlined" style="font-size: 11px;">photo_camera</span>
                    ${pinPhotoCount} Field Photo${pinPhotoCount > 1 ? 's' : ''}
                  </span>
                </div>
              ` : ''}

              <!-- Campaign Title -->
              <div class="hud-exp-title" title="${rawTitle}">${rawTitle}</div>

              <!-- Location & Verified Trust Pill -->
              <div class="hud-exp-meta-row">
                <div class="hud-exp-location" title="${subLocation && !subLocation.toLowerCase().includes((focusedProvince || '').toLowerCase()) ? `${subLocation}, ${focusedProvince}` : (subLocation || camp.locationRegion || focusedProvince)}">
                  <span class="material-symbols-outlined" style="font-size: 13px; color: var(--text-muted, #737373);">location_on</span>
                  <span>${subLocation && !subLocation.toLowerCase().includes((focusedProvince || '').toLowerCase()) ? `${subLocation}, ${focusedProvince}` : (subLocation || camp.locationRegion || focusedProvince)}</span>
                </div>
                <div class="hud-trust-pill" title="${camp.orgName || 'Verified NGO'}">
                  <span class="material-symbols-outlined" style="font-size: 12px;">verified</span>
                  <span>${camp.orgName || 'Verified NGO'}</span>
                </div>
              </div>

              <!-- Funding Progress & Amounts (PHP Primary) -->
              <div class="hud-exp-funding-box">
                <div class="hud-exp-stats">
                  <div class="hud-raised-group">
                    <span class="hud-exp-raised">₱${Number(raisedPhp).toLocaleString('en-US')}</span>
                    <span class="hud-exp-pct-tag">${pct}%</span>
                  </div>
                  <span class="hud-exp-goal">Goal: ₱${Number(targetPhp).toLocaleString('en-US')}</span>
                </div>
                <div class="hud-exp-prog-track">
                  <div class="hud-exp-prog-fill" style="width: ${pct}%; background: linear-gradient(90deg, ${catMeta.color}, #10b981);"></div>
                </div>
              </div>

              <!-- Primary Action Button -->
              <div class="hud-exp-btn-wrap">
                <button type="button" class="hud-campaign-redirect-btn" data-campaign-id="${camp.id || ''}" data-campaign-title="${encodeURIComponent(rawTitle)}">
                  <span class="material-symbols-outlined" style="font-size: 15px;">explore</span>
                  <span>View Campaign Details</span>
                  <span class="material-symbols-outlined hud-btn-arrow" style="font-size: 15px;">arrow_forward</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      const customPinIcon = L.divIcon({
        html: pinHtml,
        className: 'exact-tactical-pin-wrapper',
        iconSize: [40, 52],
        iconAnchor: [20, 52]
      });

      const pinMarker = L.marker([lat, lng], { icon: customPinIcon, interactive: true });
      pinMarker._campaignId = campId;
      pinMarker._campaignCoords = [lat, lng];

      if (isThisBeaconSelected) {
        pinMarker.setZIndexOffset(100000);
      }

      // Adaptive Bounds & Flip Logic: Ensures card NEVER gets cut off by the top border
      const updateCardBounds = () => {
        if (!mapRef.current) return;
        const el = pinMarker.getElement();
        const inner = el?.querySelector('.exact-campaign-tactical-pin');
        if (!inner) return;

        const pt = mapRef.current.latLngToContainerPoint([lat, lng]);
        const size = mapRef.current.getSize();

        // If beacon is within 225px of the top edge of map container, FLIP DOWN
        if (pt.y < 225) {
          inner.classList.add('card-flip-down');
        } else {
          inner.classList.remove('card-flip-down');
        }

        // Horizontal boundary checks: card width is ~264px (132px each side)
        if (pt.x < 140) {
          inner.classList.add('card-align-left');
          inner.classList.remove('card-align-right');
        } else if (pt.x > size.x - 140) {
          inner.classList.add('card-align-right');
          inner.classList.remove('card-align-left');
        } else {
          inner.classList.remove('card-align-left', 'card-align-right');
        }
      };

      pinMarker._updateCardBounds = updateCardBounds;

      // Hover: strictly triggered ONLY when entering the circular beacon head disc or the open card
      pinMarker.on('mouseover', (e) => {
        // While a beacon is already selected in focus mode, suppress hover mini-cards
        if (selectedBeaconRef.current) return;

        if (e && e.originalEvent && !e.originalEvent.target.closest('.pin-head-disc, .pin-visual-beacon, .hud-expanded-view')) {
          return;
        }

        // Close ALL other hover cards across all markers immediately so only ONE card is ever open!
        pinsGroup.eachLayer(otherMarker => {
          if (otherMarker !== pinMarker) {
            const otherEl = otherMarker.getElement();
            if (otherEl) {
              otherEl.classList.remove('is-marker-hovered');
              const otherInner = otherEl.querySelector('.exact-campaign-tactical-pin');
              if (otherInner && !otherInner.classList.contains('is-card-pinned')) {
                otherInner.classList.remove('is-card-hovered');
              }
            }
            if (!otherMarker.getElement()?.querySelector('.exact-campaign-tactical-pin.is-card-pinned')) {
              otherMarker.setZIndexOffset(0);
            }
          }
        });

        updateCardBounds();
        pinMarker.setZIndexOffset(100000);
        const el = pinMarker.getElement();
        if (el) el.classList.add('is-marker-hovered');
        const inner = el?.querySelector('.exact-campaign-tactical-pin');
        if (inner) inner.classList.add('is-card-hovered');
      });

      // Mouseout: hide card and restore normal z-index unless moving within this exact pin or pinned open
      pinMarker.on('mouseout', (e) => {
        if (selectedBeaconRef.current) return;

        const el = pinMarker.getElement();
        // If the mouse is still inside THIS marker's element, do nothing
        if (e && e.originalEvent && e.originalEvent.relatedTarget && el && el.contains(e.originalEvent.relatedTarget)) {
          return;
        }

        const inner = el?.querySelector('.exact-campaign-tactical-pin');
        if (inner && !inner.classList.contains('is-card-pinned')) {
          inner.classList.remove('is-card-hovered');
          if (el) el.classList.remove('is-marker-hovered');
          pinMarker.setZIndexOffset(0);
        }
      });

      // Click: Triggers Interactive Beacon Selection, Camera Zoom, Repositioning, and Expanded Card!
      // Fully responsive whether clicking the beacon head, reticle, hover card, or button!
      pinMarker.on('click', (e) => {
        if (e && e.originalEvent) {
          L.DomEvent.stopPropagation(e.originalEvent);
        }
        isProvinceClickRef.current = true;
        setTimeout(() => { isProvinceClickRef.current = false; }, 150);

        // If clicking the already-selected beacon, toggle it off / close focus
        if (selectedBeaconRef.current === campId) {
          handleCloseBeaconFocus();
        } else {
          // Select and focus this beacon
          handleSelectBeacon(camp, [lat, lng]);
        }
      });

      pinsGroup.addLayer(pinMarker);
    });

    // If a beacon is currently selected when pins are initialized or updated, re-apply isolation styling
    if (selectedBeaconRef.current) {
      updatePinIsolationStyles(selectedBeaconRef.current);
    }

    // Re-check positioning of any pinned card when the map moves or zooms
    const handleMoveForPinnedCards = () => {
      pinsGroup.eachLayer(m => {
        if (typeof m._updateCardBounds === 'function') {
          const el = m.getElement();
          if (el && el.querySelector('.exact-campaign-tactical-pin.is-card-pinned')) {
            m._updateCardBounds();
          }
        }
      });
    };

    // Close any unpinned hover card immediately when mouse moves outside all tactical pins
    const handleMapMouseMove = (e) => {
      if (selectedBeaconRef.current) return;
      if (e && e.originalEvent && !e.originalEvent.target.closest('.exact-tactical-pin-wrapper')) {
        pinsGroup.eachLayer(m => {
          const el = m.getElement();
          const inner = el?.querySelector('.exact-campaign-tactical-pin');
          if (inner && !inner.classList.contains('is-card-pinned') && inner.classList.contains('is-card-hovered')) {
            inner.classList.remove('is-card-hovered');
            if (el) el.classList.remove('is-marker-hovered');
            m.setZIndexOffset(0);
          }
        });
      }
    };

    const map = mapRef.current;
    map.on('move', handleMoveForPinnedCards);
    map.on('mousemove', handleMapMouseMove);

    return () => {
      map.off('move', handleMoveForPinnedCards);
      map.off('mousemove', handleMapMouseMove);
    };
  }, [focusedProvince, activeCampaigns]);

  // Campaign Redirect Button Click Handler (delegated from map container)
  useEffect(() => {
    if (!mapRef.current) return;
    const container = mapRef.current.getContainer();

    const handleRedirectClick = (e) => {
      const btn = e.target.closest('.hud-campaign-redirect-btn');
      if (!btn) return;

      e.preventDefault();
      e.stopPropagation();

      const campId = btn.getAttribute('data-campaign-id');
      const targetCamp = activeCampaigns.find(c => String(c.id || c.title) === String(campId));
      if (!targetCamp) return;

      const targetCoords = pinCoordsByCampIdRef.current.get(campId) || resolveCampaignCoords(targetCamp);
      handleSelectBeacon(targetCamp, targetCoords);
    };

    container.addEventListener('click', handleRedirectClick, true);
    return () => {
      container.removeEventListener('click', handleRedirectClick, true);
    };
  }, [activeCampaigns, onSelectCampaign]);

  // Unpin all campaign cards when clicking on empty map space (not on a pin or province)
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const unpinAll = (e) => {
      if (e && e.originalEvent && e.originalEvent.target && e.originalEvent.target.closest('.hud-campaign-redirect-btn')) {
        return;
      }
      document.querySelectorAll('.exact-campaign-tactical-pin.is-card-pinned').forEach(el => {
        el.classList.remove('is-card-pinned');
        el.classList.remove('is-card-hovered');
      });
    };

    map.on('click', unpinAll);
    return () => { map.off('click', unpinAll); };
  }, []); // Bind once on mount

  const handleResetFocus = () => {
    if (selectedBeaconRef.current) {
      handleCloseBeaconFocus();
    }
    setFocusedProvince(null);
    focusedProvinceRef.current = null;
    setSelectedCluster(null);
    setIsDossierOpen(false);

    // Return zoom and center to what it was before clicking on that province
    if (preFocusViewRef.current && mapRef.current) {
      const { zoom: returnZoom, center: returnCenter } = preFocusViewRef.current;
      smoothNavigateTo(returnCenter, returnZoom);
      preFocusViewRef.current = null;
    }
  };

  const handleFlyToCluster = (cluster) => {
    if (selectedBeaconRef.current) {
      handleCloseBeaconFocus();
    }
    setSelectedCluster(cluster);
    const provName = cluster.name.split(',')[0].trim();
    setFocusedProvince(provName);
    focusedProvinceRef.current = provName;
    lastFocusCenterRef.current = [cluster.lat, cluster.lng];
    setIsDossierOpen(false);
    if (mapRef.current) {
      const currentZoom = mapRef.current.getZoom();
      const targetZoom = Math.max(currentZoom, 8);
      smoothNavigateTo([cluster.lat, cluster.lng], targetZoom);
    }
  };

  const handleJumpRegion = (regionCode) => {
    if (selectedBeaconRef.current) {
      handleCloseBeaconFocus();
    }
    setFilterRegion(regionCode);
    setFocusedProvince(null);
    focusedProvinceRef.current = null;
    setSelectedCluster(null);
    preFocusViewRef.current = null;
    if (!mapRef.current) return;

    if (regionCode === 'ALL') {
      smoothNavigateTo([11.2, 123.8], 6);
    } else if (regionCode === 'LUZON') {
      smoothNavigateTo([15.2, 121.0], 7);
    } else if (regionCode === 'VISAYAS') {
      smoothNavigateTo([10.6, 124.0], 7.5);
    } else if (regionCode === 'MINDANAO') {
      smoothNavigateTo([7.8, 124.8], 7);
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(prev => !prev);
    [60, 180, 320].forEach(delay => {
      setTimeout(() => {
        if (mapRef.current) mapRef.current.invalidateSize();
      }, delay);
    });
  };

  // Manage body scroll lock and Escape key listener for fullscreen mode
  useEffect(() => {
    if (isFullscreen) {
      document.body.classList.add('radar-fullscreen-active');
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          setIsFullscreen(false);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      [60, 180, 320].forEach(delay => {
        setTimeout(() => {
          if (mapRef.current) mapRef.current.invalidateSize();
        }, delay);
      });
      return () => {
        document.body.classList.remove('radar-fullscreen-active');
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
        [60, 180, 320].forEach(delay => {
          setTimeout(() => {
            if (mapRef.current) mapRef.current.invalidateSize();
          }, delay);
        });
      };
    } else {
      document.body.classList.remove('radar-fullscreen-active');
      document.body.style.overflow = '';
      [60, 180, 320].forEach(delay => {
        setTimeout(() => {
          if (mapRef.current) mapRef.current.invalidateSize();
        }, delay);
      });
    }
  }, [isFullscreen]);

  // Manage Escape and Arrow keys to navigate/exit lightbox preview or beacon focus mode
  useEffect(() => {
    if (!selectedBeaconCampaign && activeLightboxIdx === null) return;
    const handleKeyDown = (e) => {
      if (activeLightboxIdx !== null) {
        if (e.key === 'Escape') {
          setActiveLightboxIdx(null);
        } else if (e.key === 'ArrowLeft') {
          setActiveLightboxIdx(prev => (prev > 0 ? prev - 1 : (lightboxPhotos.length - 1)));
        } else if (e.key === 'ArrowRight') {
          setActiveLightboxIdx(prev => (prev < lightboxPhotos.length - 1 ? prev + 1 : 0));
        }
        return;
      }
      if (e.key === 'Escape' && selectedBeaconCampaign) {
        handleCloseBeaconFocus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBeaconCampaign, activeLightboxIdx, lightboxPhotos.length]);

  return (
    <>
      {isFullscreen && (
        <div
          className="radar-fullscreen-backdrop"
          onClick={toggleFullscreen}
          title="Click to exit fullscreen"
          role="button"
          tabIndex={-1}
          aria-label="Exit fullscreen backdrop"
        />
      )}
      <div className={`bbdrts-radar-command ${isFullscreen ? 'radar-command-fullscreen' : ''} ${focusedProvince ? 'has-focused-province' : ''} ${selectedBeaconCampaign ? 'has-selected-beacon' : ''} ${className}`}>

        {/* ── Vercel / Linear Unified Command Bar (Single Sleek 48px Header) ── */}
        <div className="radar-unified-command-bar">
          <div className="radar-bar-left">
            <div className="radar-brand-badge">
              <span className="material-symbols-outlined radar-spin-icon">radar</span>
              <span className="radar-brand-title">Relief Radar</span>
              <span className="radar-live-pill">
                <span className="live-dot-ping"></span>
                <span>LIVE</span>
              </span>
            </div>

            <div className="radar-bar-divider" />

            {/* Regional Sector Segmented Control */}
            <div className="radar-region-segmented-control">
              <button
                type="button"
                className={`region-segment-btn ${filterRegion === 'ALL' ? 'active' : ''}`}
                onClick={() => handleJumpRegion('ALL')}
              >
                All ({clusters.length})
              </button>
              <button
                type="button"
                className={`region-segment-btn ${filterRegion === 'LUZON' ? 'active' : ''}`}
                onClick={() => handleJumpRegion('LUZON')}
              >
                Luzon
              </button>
              <button
                type="button"
                className={`region-segment-btn ${filterRegion === 'VISAYAS' ? 'active' : ''}`}
                onClick={() => handleJumpRegion('VISAYAS')}
              >
                Visayas
              </button>
              <button
                type="button"
                className={`region-segment-btn ${filterRegion === 'MINDANAO' ? 'active' : ''}`}
                onClick={() => handleJumpRegion('MINDANAO')}
              >
                Mindanao
              </button>
            </div>
          </div>

          <div className="radar-bar-right">
            {lowBandwidthMode && (
              <div className="data-saver-chip" title={wt.dataSaverDesc}>
                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>eco</span>
                <span>{wt.dataSaverRadar}</span>
              </div>
            )}
            {concludedCampaignCount > 0 && (
              <button
                type="button"
                className={`region-segment-btn ${includeConcluded ? 'active' : ''}`}
                onClick={() => setIncludeConcluded(prev => !prev)}
                aria-pressed={includeConcluded}
                title={includeConcluded ? 'Showing active + concluded operations on radar (click to show active only)' : 'Show concluded relief operations on the map'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  height: '28px',
                  padding: '0 10px',
                  borderRadius: '7px',
                  border: includeConcluded ? '1px solid rgba(16, 185, 129, 0.45)' : '1px solid var(--border)',
                  background: includeConcluded ? 'rgba(16, 185, 129, 0.14)' : 'var(--bg-inset)',
                  color: includeConcluded ? '#10b981' : 'var(--text-muted)',
                  fontSize: '0.70rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>task_alt</span>
                <span>{includeConcluded ? `Concluded Shown (${concludedCampaignCount})` : `Show Concluded (${concludedCampaignCount})`}</span>
              </button>
            )}

            {/* Active Telemetry Pill */}
            <div className="radar-telemetry-pill" title={includeConcluded ? 'Total active & concluded operations tracked' : 'Total active relief operations tracked'}>
              <span className="telemetry-pill-dot"></span>
              <span className="telemetry-pill-val">{totalTrackedCampaigns}</span>
              <span className="telemetry-pill-label">Causes</span>
            </div>

            <div className="radar-telemetry-pill time-pill" title="Philippine Standard Time (UTC+8)">
              <span className="telemetry-pill-time">{currentTime || '08:00 PST'}</span>
            </div>

            {/* Density Sim Toggle */}
            <button
              type="button"
              className={`radar-tool-icon-btn ${simulateDensity ? 'active' : ''}`}
              onClick={() => setSimulateDensity(!simulateDensity)}
              title={simulateDensity ? 'Simulated Missions Active (Click to switch to Real Only)' : 'Simulate Archipelago Density (1–30)'}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>hub</span>
              {simulateDensity && <span className="tool-active-dot"></span>}
            </button>

            {simulateDensity && (
              <button
                type="button"
                className="radar-tool-icon-btn"
                onClick={() => setSimSeed(prev => prev + 1)}
                title="Re-roll randomized campaign distribution"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>casino</span>
              </button>
            )}

            {/* Fullscreen Button */}
            {allowFullscreen && (
              <button
                type="button"
                className={`radar-tool-icon-btn ${isFullscreen ? 'active' : ''}`}
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Map'}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                  {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* ── Viewport ── */}
        <div className={`radar-map-viewport ${activeLayer === 'provinces' ? 'is-plain-white-mode' : ''} ${focusedProvince ? 'has-focused-province' : ''} ${selectedBeaconCampaign ? 'has-selected-beacon' : ''}`} style={{ height: isFullscreen ? 'calc(100vh - 48px)' : height }}>

          {/* ── FLOATING COMMAND HUD PANEL (LINEAR / APPLE GLASSMORPHISM) ── */}
          {/* Organizes all active crisis corridors, mission counts, and quick-jumps without cluttering the map */}
          {isCommandHudCollapsed ? (
            <div className="radar-command-hud-collapsed-wrap" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
              {focusedProvince ? (
                <div className="hud-collapsed-focus-pill">
                  <span className="focused-beacon-dot"></span>
                  <span className="hud-focus-pill-name">{focusedProvince}</span>
                  <span className="hud-focus-pill-count">
                    {getProvinceCampaigns(focusedProvince, activeCampaigns).length} Causes
                  </span>
                  <button
                    type="button"
                    className="hud-focus-pill-close"
                    onClick={handleResetFocus}
                    title="Clear Province Focus"
                    aria-label="Clear Province Focus"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="radar-command-hud-toggle-pill"
                  onClick={() => setIsCommandHudCollapsed(false)}
                  title="Expand Active Relief Areas"
                >
                  <span className="material-symbols-outlined hud-pill-icon">shield_with_heart</span>
                  <span className="hud-pill-label">Active Areas</span>
                  <span className="hud-pill-count">{sortedCorridors.length}</span>
                  <span className="material-symbols-outlined hud-pill-arrow">chevron_right</span>
                </button>
              )}
            </div>
          ) : (
            <div
              className="radar-command-hud"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
            >
              {/* HUD Header */}
              <div className="command-hud-header">
                <div className="hud-header-left">
                  <span className="hud-radar-pulse"></span>
                  <div>
                    <div className="hud-title">ACTIVE RELIEF AREAS</div>
                    <div className="hud-subtitle">
                      {sortedCorridors.length > 0
                        ? `${sortedCorridors.length} ${sortedCorridors.length === 1 ? 'Province' : 'Provinces'} Monitored`
                        : 'Archipelago Normal Monitoring'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="hud-collapse-btn"
                  onClick={() => setIsCommandHudCollapsed(true)}
                  title="Minimize HUD"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>close_fullscreen</span>
                </button>
              </div>

              {/* In-Focus Sector Pinning Banner */}
              {focusedProvince && (
                <div className="hud-focused-sector-card">
                  <div className="focused-card-top">
                    <div className="focused-card-label">
                      <span className="focused-beacon-dot"></span>
                      <span>SECTOR IN FOCUS</span>
                    </div>
                    <button
                      type="button"
                      className="focused-card-close"
                      onClick={handleResetFocus}
                      title="Exit Sector Focus"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>close</span>
                    </button>
                  </div>
                  <div className="focused-card-body">
                    <span className="focused-card-name">{focusedProvince}</span>
                    <span className="focused-card-badge">
                      {getProvinceCampaigns(focusedProvince, activeCampaigns).length} {getProvinceCampaigns(focusedProvince, activeCampaigns).length === 1 ? 'Mission' : 'Missions'}
                    </span>
                  </div>
                  <div className="focused-card-actions">
                    {getProvinceCampaigns(focusedProvince, activeCampaigns).length > 0 && (
                      <button
                        type="button"
                        className={`focused-dossier-action-btn ${isDossierOpen ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!selectedCluster && activeDossierCluster) {
                            setSelectedCluster(activeDossierCluster);
                          }
                          setIsDossierOpen(prev => !prev);
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                          {isDossierOpen ? 'visibility_off' : 'description'}
                        </span>
                        <span>{isDossierOpen ? 'Hide Dossier' : 'Open Dossier'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="focused-reset-action-btn"
                      onClick={handleResetFocus}
                    >
                      <span>Reset Focus</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Quick Search inside HUD */}
              {sortedCorridors.length > 2 && (
                <div className="command-hud-search-bar">
                  <span className="material-symbols-outlined hud-search-icon">search</span>
                  <input
                    type="text"
                    placeholder="Search active area..."
                    value={hudSearchQuery}
                    onChange={(e) => setHudSearchQuery(e.target.value)}
                    className="hud-search-input"
                  />
                  {hudSearchQuery && (
                    <button type="button" className="hud-search-clear" onClick={() => setHudSearchQuery('')}>
                      <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>close</span>
                    </button>
                  )}
                </div>
              )}

              {/* Areas Scroll List */}
              <div className="command-hud-body">
                {filteredCorridors.length === 0 ? (
                  <div className="command-hud-empty">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', opacity: 0.5 }}>travel_explore</span>
                    <span>No matching active areas</span>
                  </div>
                ) : (
                  filteredCorridors.map(c => {
                    const isFocused = focusedProvince?.toLowerCase() === c.name.toLowerCase();
                    const progressPct = c.totalTarget > 0 ? Math.min(100, Math.round((c.totalRaised / c.totalTarget) * 100)) : 0;
                    return (
                      <div
                        key={c.id}
                        className={`command-hud-sector-item ${isFocused ? 'is-focused' : ''}`}
                        onClick={() => handleFlyToCluster(c)}
                        onMouseEnter={() => setHoveredCorridorName(c.name)}
                        onMouseLeave={() => setHoveredCorridorName(null)}
                        style={{ '--sector-color': c.tier.color }}
                        title={`Click to navigate to ${c.name} & unpack relief stations`}
                      >
                        <div className="sector-header-row">
                          <div className="sector-name-col">
                            <span className="sector-status-dot" style={{ backgroundColor: c.tier.color, boxShadow: `0 0 8px ${c.tier.color}` }}></span>
                            <span className="sector-name">{c.name}</span>
                          </div>
                          <span
                            className="sector-tier-badge"
                            style={{
                              color: c.tier.color,
                              borderColor: `${c.tier.color}44`,
                              backgroundColor: `${c.tier.color}18`
                            }}
                          >
                            L{c.tier.level} · {c.tier.label.split(' ')[0]}
                          </span>
                        </div>

                        <div className="sector-metrics-row">
                          <span className="sector-missions-count">
                            <strong>{c.campaigns.length}</strong> {c.campaigns.length === 1 ? 'Mission' : 'Missions'}
                          </span>
                          <span className="sector-raised-eth">
                            ₱{Number(Math.round(c.totalRaised * 170000)).toLocaleString('en-US')}
                            {c.totalTarget > 0 ? ` / ₱${Number(Math.round(c.totalTarget * 170000)).toLocaleString('en-US')}` : ''}
                          </span>
                        </div>

                        <div className="sector-progress-track">
                          <div
                            className="sector-progress-fill"
                            style={{
                              width: `${progressPct > 0 ? progressPct : 12}%`,
                              backgroundColor: c.tier.color
                            }}
                          />
                        </div>

                        <div className="sector-action-hint">
                          <span>{isFocused ? 'In Tactical Focus' : 'Inspect Sector'}</span>
                          <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
                            {isFocused ? 'my_location' : 'north_east'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* HUD Footer status */}
              <div className="command-hud-footer">
                <span className="hud-footer-hint">Click an area to focus & view relief operations</span>
              </div>
            </div>
          )
          }

          {/* Leaflet Map Stage */}
          <div
            ref={containerRef}
            className={`radar-leaflet-stage ${activeLayer === 'provinces' ? 'is-plain-white-mode' : ''} ${activeLayer === 'satellite' ? 'is-satellite-mode' : ''} ${currentZoomLevel >= 13 ? 'is-ultra-zoom' : currentZoomLevel >= 11 ? 'is-deep-zoom' : ''}`}
          />

          {/* ── Segmented Basemap Dock (Floating Bottom-Right Beside Zoom Controls) ── */}
          <div
            className="radar-floating-basemap-dock"
            onMouseDown={(e) => {
              e.stopPropagation();
              isProvinceClickRef.current = true;
              setTimeout(() => { isProvinceClickRef.current = false; }, 250);
            }}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className={`basemap-dock-btn ${activeLayer === 'tactical' ? 'active' : ''}`}
              onClick={() => setActiveLayer('tactical')}
              title="Tactical Dark Canvas (Minimalist)"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>contrast</span>
              <span>Tactical</span>
            </button>
            <button
              type="button"
              className={`basemap-dock-btn ${activeLayer === 'terrain' ? 'active' : ''}`}
              onClick={() => setActiveLayer('terrain')}
              title="Physical Elevation & Topography (Terrain)"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>terrain</span>
              <span>Terrain</span>
            </button>
            <button
              type="button"
              className={`basemap-dock-btn ${activeLayer === 'satellite' ? 'active' : ''}`}
              onClick={() => setActiveLayer('satellite')}
              title="High-Resolution Satellite Photography"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>satellite_alt</span>
              <span>Satellite</span>
            </button>
            <button
              type="button"
              className={`basemap-dock-btn ${activeLayer === 'osm' ? 'active' : ''}`}
              onClick={() => setActiveLayer('osm')}
              title="Standard Street Map"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>map</span>
              <span>Street</span>
            </button>
            <button
              type="button"
              className={`basemap-dock-btn ${activeLayer === 'provinces' ? 'active' : ''}`}
              onClick={() => setActiveLayer('provinces')}
              title="Vector-only Province Boundaries (Zero external map tiles)"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>eco</span>
              <span>Vector</span>
            </button>
          </div>

          {/* ── Sleek Micro-Scale Severity Dock (Floating Bottom-Left) ── */}
          <div className="radar-micro-legend-dock" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={`micro-legend-pill ${isLegendExpanded ? 'is-expanded' : ''} ${focusedTier !== null ? 'has-filter' : ''}`}
              onClick={() => setIsLegendExpanded(prev => !prev)}
              title={isLegendExpanded ? 'Collapse Legend' : 'Expand Severity Scale'}
            >
              <span className="micro-legend-dot"></span>
              <span className="micro-legend-label">SEVERITY</span>
              <div className="micro-legend-bar">
                <span className="m-step tier-1" style={{ backgroundColor: DOPPLER_TIERS[1].color }}></span>
                <span className="m-step tier-2" style={{ backgroundColor: DOPPLER_TIERS[2].color }}></span>
                <span className="m-step tier-3" style={{ backgroundColor: DOPPLER_TIERS[3].color }}></span>
                <span className="m-step tier-4" style={{ backgroundColor: DOPPLER_TIERS[4].color }}></span>
                <span className="m-step tier-5" style={{ backgroundColor: DOPPLER_TIERS[5].color }}></span>
                <span className="m-step tier-6" style={{ backgroundColor: DOPPLER_TIERS[6].color }}></span>
              </div>
              <span className="micro-legend-tag">{focusedTier !== null ? `L${focusedTier}` : 'L1–L6'}</span>
              <span className="material-symbols-outlined micro-legend-arrow">
                {isLegendExpanded ? 'expand_more' : 'expand_less'}
              </span>
            </button>

            {/* Expanded Popover */}
            {isLegendExpanded && (
              <div className="micro-legend-popover">
                <div className="popover-header">
                  <span className="popover-title">SEVERITY SCALE</span>
                  {focusedTier !== null && (
                    <button type="button" className="popover-clear-btn" onClick={() => setFocusedTier(null)}>
                      Reset Filter
                    </button>
                  )}
                </div>
                <div className="popover-tiers-list">
                  {[1, 2, 3, 4, 5, 6].map(lvl => {
                    const t = DOPPLER_TIERS[lvl];
                    const isFocused = focusedTier === lvl;
                    const count = clusters.filter(c => c.tier.level === lvl).length;
                    return (
                      <div
                        key={lvl}
                        className={`popover-tier-row ${isFocused ? 'is-active' : ''}`}
                        onClick={() => setFocusedTier(focusedTier === lvl ? null : lvl)}
                      >
                        <span className="popover-tier-dot" style={{ backgroundColor: t.color }}></span>
                        <span className="popover-tier-lvl">L{lvl}</span>
                        <span className="popover-tier-label">{t.label}</span>
                        <span className="popover-tier-count">{count > 0 ? `${count} ${count === 1 ? 'province' : 'provinces'}` : '0'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Hotspot Dossier HUD Drawer (Guaranteed to work for activeDossierCluster) ── */}
          {activeDossierCluster && isDossierOpen && (
            <div className="radar-dossier-panel">
              <div className="dossier-panel-header">
                <div className="dossier-header-text">
                  <div
                    className={`dossier-tier-pill ${activeDossierCluster.tier?.badgeClass || ''}`}
                    style={{
                      borderColor: activeDossierCluster.tier?.color || 'var(--accent)',
                      color: activeDossierCluster.tier?.color || 'var(--accent)'
                    }}
                  >
                    <span>{activeDossierCluster.tier?.label || activeDossierCluster.tier?.rainDesc || 'Relief Operations'}</span>
                  </div>
                  <h3 className="dossier-location-title">{activeDossierCluster.name}</h3>
                  <div className="dossier-region-label">{activeDossierCluster.regionName}</div>
                  <div className="dossier-gps-tag">
                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>location_on</span>
                    <span>{activeDossierCluster.lat?.toFixed(4)}° N, {activeDossierCluster.lng?.toFixed(4)}° E</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="dossier-dismiss-btn"
                  onClick={() => setIsDossierOpen(false)}
                  title="Close Dossier"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                </button>
              </div>

              {/* Metrics */}
              <div className="dossier-metrics-strip">
                <div className="dossier-metric-cell">
                  <span className="dossier-num text-accent">{activeDossierCluster.campaigns.length}</span>
                  <span className="dossier-tag-label">Active Causes</span>
                </div>
                <div className="dossier-metric-cell">
                  <span className="dossier-num">₱{Number(Math.round((activeDossierCluster.totalRaised ?? 0) * 170000)).toLocaleString('en-US')}</span>
                  <span className="dossier-tag-label">Funds Raised</span>
                </div>
                <div className="dossier-metric-cell">
                  <span className="dossier-num">₱{Number(Math.round((activeDossierCluster.totalTarget ?? 0) * 170000)).toLocaleString('en-US')}</span>
                  <span className="dossier-tag-label">Target Goal</span>
                </div>
              </div>

              {/* Campaign Cards in this hotspot */}
              <div className="dossier-campaigns-body">
                <div className="dossier-subheading">
                  <span>Relief Missions in this Zone ({activeDossierCluster.campaigns.length})</span>
                </div>

                <div className="dossier-campaigns-scroll">
                  {activeDossierCluster.campaigns.map((c) => {
                    const raised = parseFloat(c.currentAmount || c.raised_eth || 0);
                    const target = parseFloat(c.targetAmount || c.target_eth || 0);
                    const pct = target > 0 ? Math.min(100, (raised / target) * 100).toFixed(1) : 0;

                    const campPhotos = c.disasterImages || (typeof c.disaster_images_json === 'string' ? (() => {
                      try { return JSON.parse(c.disaster_images_json || '[]'); } catch (_) { return []; }
                    })() : c.disaster_images_json) || [];

                    return (
                      <div key={c.id} className="dossier-card">
                        <div className="dossier-card-tags">
                          <span className="dossier-badge cat">{c.category || 'RELIEF'}</span>
                          <span className={`dossier-badge urgency ${c.urgency?.toLowerCase() || 'high'}`}>
                            {c.urgency || 'HIGH'}
                          </span>
                          <span className="dossier-badge org">{c.orgName || 'Accredited NGO'}</span>
                          {c.isSimulated && (
                            <span className="dossier-simulated-tag">SIMULATED MISSION</span>
                          )}
                        </div>

                        {campPhotos.length > 0 && (
                          <div
                            className="dossier-card-thumb-wrap"
                            onClick={(e) => {
                              e.stopPropagation();
                              openLightbox(campPhotos, 0);
                            }}
                            title="Click to view disaster aftermath field photo"
                          >
                            <img src={campPhotos[0]} alt="Disaster aftermath evidence" className="dossier-card-thumb" />
                            <span className="dossier-card-thumb-count">
                              <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>photo_camera</span>
                              {campPhotos.length} {campPhotos.length === 1 ? 'Field Photo' : 'Field Photos'}
                            </span>
                          </div>
                        )}

                        <h4 className="dossier-camp-title">{c.title}</h4>
                        <p className="dossier-camp-desc">{c.description?.slice(0, 115)}...</p>

                        <div className="dossier-funding-progress">
                          <div className="dossier-progress-track">
                            <div className="dossier-progress-bar" style={{ width: `${pct}%` }}></div>
                          </div>
                          <div className="dossier-progress-labels">
                            <span>₱{Number(Math.round(raised * 170000)).toLocaleString('en-US')} raised ({pct}%)</span>
                            <span>Target: ₱{Number(Math.round(target * 170000)).toLocaleString('en-US')}</span>
                          </div>
                        </div>

                        <div className="dossier-action-row">
                          <button
                            type="button"
                            className={`dossier-cta-btn ${c.isSimulated ? 'simulated-btn' : ''}`}
                            onClick={() => {
                              if (c.isSimulated) return;
                              if (onSelectCampaign) {
                                onSelectCampaign(c);
                              } else {
                                const el = document.getElementById(`campaign-${c.id}`) || document.getElementById('campaigns');
                                if (el) el.scrollIntoView({ behavior: 'smooth' });
                              }
                            }}
                          >
                            <span>{c.isSimulated ? 'Simulated Preview' : 'Support Mission'}</span>
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                              {c.isSimulated ? 'visibility' : 'arrow_forward'}
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* ── Expanded Tactical Beacon Dossier Card (Left-Aligned Beacon Focus Experience) ── */}
          {selectedBeaconCampaign && (() => {
            const rawCamp = selectedBeaconCampaign;
            const campId = String(rawCamp.id || rawCamp.title);
            // Ensure we always read the latest synced data from activeCampaigns if available
            const camp = activeCampaigns.find(c => String(c.id || c.title) === campId) || rawCamp;
            const catMeta = getCampaignCategoryMeta(camp);
            const subLocation = resolveCampaignSubLocation(camp, focusedProvince);
            const provCamps = focusedProvince ? getProvinceCampaigns(focusedProvince, activeCampaigns) : [];
            const currentIndex = provCamps.findIndex(c => String(c.id || c.title) === campId);
            const currentNum = currentIndex >= 0 ? currentIndex + 1 : 1;
            const totalCount = provCamps.length || 1;

            const raised = parseFloat(camp.currentAmount || camp.raised_eth || 0) || 0;
            const target = parseFloat(camp.targetAmount || camp.target_eth || 0) || 0;
            const pct = target > 0 ? ((raised / target) * 100).toFixed(1) : '0';
            const pctInt = Math.min(100, Math.round(parseFloat(pct)));

            const ETH_TO_PHP = 170000;
            const raisedPhp = camp.raised_php || camp.currentAmountPhp || Math.round(raised * ETH_TO_PHP);
            const targetPhp = camp.target_php || camp.targetAmountPhp || Math.round(target * ETH_TO_PHP);

            // Coordinates
            const coords = selectedBeaconCoords || (pinCoordsByCampIdRef.current ? pinCoordsByCampIdRef.current.get(campId) : null) || resolveCampaignCoords(camp);
            const latStr = coords && coords[0] ? coords[0].toFixed(4) : '10.1335';
            const lngStr = coords && coords[1] ? coords[1].toFixed(4) : '124.8736';

            const orgName = camp.orgName || camp.org_name || camp.organizationName || camp.beneficiary || 'Verified NGO';
            const urgencyLabel = (camp.urgency || 'HIGH PRIORITY').toUpperCase();

            // Real donors from blockchain and database multi-rail breakdown
            const realDonors = camp.totalBackers
              ?? camp.railBreakdown?.totalBackers
              ?? (((camp.railBreakdown?.eth?.count || 0) + (camp.railBreakdown?.gcash?.count || 0) + (camp.railBreakdown?.maya?.count || 0) + (camp.railBreakdown?.bank?.count || 0)) || null)
              ?? camp.donorsCount
              ?? camp.donorCount
              ?? (raised > 0 ? 1 : 0);
            const donorsCount = typeof realDonors === 'number' ? realDonors : (parseInt(realDonors, 10) || 0);

            // Real beneficiaries directly from database record
            const beneficiaries = camp.beneficiariesImpact
              || camp.beneficiaries_impact
              || camp.beneficiaries
              || 'Displaced Families in Impact Zone';

            const descText = camp.description || 'Emergency disaster response, relief distribution, and rehabilitation operation.';
            const isLongOverview = descText.length > 130;

            const provClean = focusedProvince || '';
            const displayLocation = subLocation && !subLocation.toLowerCase().includes(provClean.toLowerCase())
              ? `${subLocation}, ${provClean}`
              : (subLocation || camp.locationRegion || provClean || 'Philippines');

            const rawPhotos = camp.disasterImages || camp.disaster_images_json || camp.disasterImagesJson;
            let disasterPhotos = [];
            if (Array.isArray(rawPhotos)) {
              disasterPhotos = rawPhotos;
            } else if (typeof rawPhotos === 'string') {
              try {
                const p = JSON.parse(rawPhotos);
                if (Array.isArray(p)) disasterPhotos = p;
              } catch (_) {}
            }

            return (
              <div
                className="radar-beacon-dossier-card"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                {/* ── Minimalist Topbar ── */}
                <div className="beacon-dossier-topbar">
                  <div className="beacon-topbar-left">
                    <span
                      className="beacon-cat-pill"
                      style={{
                        backgroundColor: `${catMeta.color}18`,
                        borderColor: `${catMeta.color}35`,
                        color: catMeta.color
                      }}
                    >
                      <span className="material-symbols-outlined beacon-cat-icon">{catMeta.icon}</span>
                      <span>{catMeta.shortLabel}</span>
                    </span>
                    <span className="beacon-status-chip">
                      <span className="beacon-status-pulse"></span>
                      <span>Active</span>
                    </span>
                  </div>

                  <div className="beacon-topbar-right">
                    {totalCount > 1 && (
                      <div className="beacon-stepper-control">
                        <button
                          type="button"
                          className="beacon-stepper-btn"
                          onClick={() => handleStepBeacon(-1)}
                          title="Previous Cause in this Province"
                          aria-label="Previous Cause"
                        >
                          <span className="material-symbols-outlined">chevron_left</span>
                        </button>
                        <span className="beacon-stepper-text">
                          {currentNum} of {totalCount}
                        </span>
                        <button
                          type="button"
                          className="beacon-stepper-btn"
                          onClick={() => handleStepBeacon(1)}
                          title="Next Cause in this Province"
                          aria-label="Next Cause"
                        >
                          <span className="material-symbols-outlined">chevron_right</span>
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      className="beacon-dossier-close-btn"
                      onClick={handleCloseBeaconFocus}
                      title="Return to Province View (Esc)"
                      aria-label="Close Beacon Focus"
                    >
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>
                </div>

                {/* ── Spacious Card Content ── */}
                <div className="beacon-dossier-body">
                  {/* Title & Metadata */}
                  <div className="beacon-header-block">
                    <h2 className="beacon-dossier-title">{camp.title}</h2>
                    <div className="beacon-meta-subtitle">
                      <span className="material-symbols-outlined beacon-loc-icon">location_on</span>
                      <span>{displayLocation}</span>
                    </div>
                  </div>

                  {/* Clean Funding & Progress Section (Unboxed) */}
                  <div className="beacon-funding-section">
                    <div className="beacon-funding-row">
                      <div className="beacon-funding-amounts">
                        <div className="beacon-amounts-primary">
                          <span className="beacon-raised-num">₱{Number(raisedPhp).toLocaleString('en-US')}</span>
                        </div>
                        <span className="beacon-goal-label">
                          Goal: ₱{Number(targetPhp).toLocaleString('en-US')}
                        </span>
                      </div>
                      <span
                        className="beacon-pct-tag"
                        style={{
                          backgroundColor: `${catMeta.color}18`,
                          color: catMeta.color,
                          borderColor: `${catMeta.color}35`
                        }}
                      >
                        {pct}%
                      </span>
                    </div>

                    <div className="beacon-progress-track">
                      <div
                        className="beacon-progress-fill"
                        style={{
                          width: `${pctInt}%`,
                          background: 'linear-gradient(90deg, #0d9488 0%, #10b981 100%)'
                        }}
                      />
                    </div>

                    <div className="beacon-quick-stats">
                      <span className="beacon-stat-item">
                        <span className="material-symbols-outlined">group</span>
                        {donorsCount} {donorsCount === 1 ? 'donor' : 'donors'}
                      </span>
                      <span className="beacon-stat-sep">·</span>
                      <span className="beacon-stat-item">
                        <span className="material-symbols-outlined">family_restroom</span>
                        {beneficiaries}
                      </span>
                      <span className="beacon-stat-sep">·</span>
                      <span className="beacon-stat-item verified">
                        <span className="material-symbols-outlined">verified_user</span>
                        {orgName}
                      </span>
                    </div>
                  </div>

                  {/* Mission Narrative / Bio (Clean Prose) */}
                  <div className="beacon-overview-section">
                    <p className={`beacon-narrative-text ${isOverviewExpanded ? 'is-expanded' : 'is-clamped'}`}>
                      {descText}
                    </p>
                    {isLongOverview && (
                      <button
                        type="button"
                        className="beacon-overview-toggle-link"
                        onClick={() => setIsOverviewExpanded(prev => !prev)}
                      >
                        <span>{isOverviewExpanded ? 'Show less' : 'Show more...'}</span>
                        <span className="material-symbols-outlined">
                          {isOverviewExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>
                    )}
                  </div>

                  {/* ── Disaster Impact & Aftermath Evidence Photos (Placed below bio) ── */}
                  {disasterPhotos.length > 0 && (
                    <div className="beacon-aftermath-gallery">
                      <div className="beacon-aftermath-header">
                        <span className="beacon-aftermath-title">
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>photo_camera</span>
                          DISASTER IMPACT EVIDENCE
                        </span>
                        {disasterPhotos.length > 1 && (
                          <span className="beacon-aftermath-counter">
                            Photo {(activeDossierPhotoIdx || 0) + 1} of {disasterPhotos.length}
                          </span>
                        )}
                      </div>

                      <div
                        className="beacon-aftermath-hero-wrap"
                        onClick={() => openLightbox(disasterPhotos, activeDossierPhotoIdx || 0)}
                        title="Click to view full photo evidence in full-screen lightbox"
                      >
                        <img
                          src={disasterPhotos[activeDossierPhotoIdx || 0] || disasterPhotos[0]}
                          alt="Disaster aftermath evidence"
                          className="beacon-aftermath-hero-img"
                        />
                        <div className="beacon-aftermath-hero-overlay">
                          <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>zoom_in</span>
                          <span>Click to Enlarge</span>
                        </div>
                      </div>

                      {disasterPhotos.length > 1 && (() => {
                        const maxVisible = 6;
                        const hasOverflow = disasterPhotos.length > maxVisible;
                        const visiblePhotos = hasOverflow ? disasterPhotos.slice(0, maxVisible) : disasterPhotos;
                        const overflowCount = disasterPhotos.length - (maxVisible - 1);

                        return (
                          <div className="beacon-aftermath-thumbnails">
                            {visiblePhotos.map((photoUrl, pIdx) => {
                              const isOverflow = hasOverflow && pIdx === (maxVisible - 1);
                              const isActive = (activeDossierPhotoIdx || 0) === pIdx;

                              return (
                                <button
                                  key={pIdx}
                                  type="button"
                                  className={`beacon-aftermath-thumb-btn ${isActive ? 'is-active' : ''} ${isOverflow ? 'is-overflow' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveDossierPhotoIdx(pIdx);
                                    if (isOverflow) {
                                      openLightbox(disasterPhotos, pIdx);
                                    }
                                  }}
                                  title={isOverflow ? `+${overflowCount} more photo${overflowCount > 1 ? 's' : ''} (Click to view full gallery)` : `View photo ${pIdx + 1}`}
                                >
                                  <img src={photoUrl} alt={`Thumbnail ${pIdx + 1}`} />
                                  {isOverflow && (
                                    <div className="beacon-thumb-overflow-overlay">
                                      <span>+{overflowCount}</span>
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* ── Sleek Action Footer ── */}
                <div className="beacon-dossier-footer">
                  <button
                    type="button"
                    className="beacon-action-secondary"
                    onClick={handleCloseBeaconFocus}
                    title="Return to Province View"
                  >
                    <span className="material-symbols-outlined">arrow_back</span>
                    <span>Back</span>
                  </button>

                  <button
                    type="button"
                    className={`beacon-action-primary ${camp.isSimulated ? 'is-simulated' : ''}`}
                    onClick={() => {
                      if (camp.isSimulated) return;
                      if (onSelectCampaign) {
                        onSelectCampaign(camp);
                      } else {
                        const el = document.getElementById(`campaign-${camp.id}`) || document.getElementById('campaigns');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                    title={camp.isSimulated ? 'Simulated Campaign Preview' : 'Donate and Support this Campaign'}
                  >
                    <span className="material-symbols-outlined">
                      {camp.isSimulated ? 'visibility' : 'volunteer_activism'}
                    </span>
                    <span>{camp.isSimulated ? 'Simulated Preview' : 'Support Mission'}</span>
                  </button>
                </div>
              </div>
            );
          })()}

        </div>

      </div>

      {/* ── Disaster Aftermath Lightbox Modal (Root Document Body Portal) ── */}
      {typeof document !== 'undefined' && activeLightboxIdx !== null && lightboxPhotos.length > 0 && lightboxPhotos[activeLightboxIdx] && createPortal(
        <div
          className="disaster-lightbox-backdrop"
          onClick={() => setActiveLightboxIdx(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="disaster-lightbox-content" onClick={(e) => e.stopPropagation()}>
            {/* Top Bar: Counter & Close */}
            <div className="disaster-lightbox-top-bar">
              <div className="disaster-lightbox-pill">
                <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#10b981' }}>photo_library</span>
                <span>Photo {activeLightboxIdx + 1} of {lightboxPhotos.length}</span>
              </div>
              <button
                type="button"
                className="disaster-lightbox-close"
                onClick={() => setActiveLightboxIdx(null)}
                title="Close Preview (Esc)"
                aria-label="Close Preview"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Middle Main Row: Prev Button + Big Image + Next Button */}
            <div className="disaster-lightbox-stage">
              {lightboxPhotos.length > 1 && (
                <button
                  type="button"
                  className="disaster-lightbox-nav-btn prev"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveLightboxIdx(prev => (prev > 0 ? prev - 1 : (lightboxPhotos.length - 1)));
                  }}
                  title="Previous Photo (Left Arrow)"
                  aria-label="Previous Photo"
                >
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
              )}

              <div className="disaster-lightbox-img-frame">
                <img
                  src={lightboxPhotos[activeLightboxIdx]}
                  alt={`Disaster Aftermath Evidence #${activeLightboxIdx + 1}`}
                  className="disaster-lightbox-img"
                />
              </div>

              {lightboxPhotos.length > 1 && (
                <button
                  type="button"
                  className="disaster-lightbox-nav-btn next"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveLightboxIdx(prev => (prev < lightboxPhotos.length - 1 ? prev + 1 : 0));
                  }}
                  title="Next Photo (Right Arrow)"
                  aria-label="Next Photo"
                >
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              )}
            </div>

            {/* Bottom Caption */}
            <div className="disaster-lightbox-caption">
              <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#10b981' }}>verified</span>
              <span>Disaster Impact & Aftermath Evidence • Ground Photographic Verification</span>
            </div>

            {/* Bottom Carousel / Thumbnails Strip */}
            {lightboxPhotos.length > 1 && (
              <div className="disaster-lightbox-thumbs-strip" onClick={(e) => e.stopPropagation()}>
                {lightboxPhotos.map((thumbUrl, tIdx) => (
                  <button
                    key={tIdx}
                    type="button"
                    className={`disaster-lightbox-strip-thumb ${tIdx === activeLightboxIdx ? 'is-active' : ''}`}
                    onClick={() => setActiveLightboxIdx(tIdx)}
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
    </>
  );
}

class RadarErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.warn('DisasterRadarHeatmap ErrorBoundary caught an issue:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '24px',
          background: 'var(--bg-card, #0a0a0a)',
          border: '1px solid var(--border, #262626)',
          borderRadius: '14px',
          color: 'var(--text-primary, #ffffff)',
          textAlign: 'center'
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '36px', color: 'var(--warning, #f59e0b)' }}>warning</span>
          <h3 style={{ margin: '8px 0', fontSize: '1.1rem' }}>Relief Radar Initializing...</h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted, #737373)', marginBottom: '14px' }}>
            Updating geospatial telemetry feeds. Click below to reconnect.
          </p>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => this.setState({ hasError: false })}
          >
            Refresh Radar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function DisasterRadarHeatmap(props) {
  return (
    <RadarErrorBoundary>
      <DisasterRadarHeatmapInner {...props} />
    </RadarErrorBoundary>
  );
}
