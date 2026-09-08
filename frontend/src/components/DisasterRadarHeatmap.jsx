import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import PH_PROVINCES_GEOJSON from '../data/philippines_provinces.json';
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

// ── Disaster Severity Alert Scale (6-Tier Priority System) ──
const DOPPLER_TIERS = {
  1: {
    level: 1,
    label: 'Emerging Need',
    rainDesc: 'Level 1: Emerging Need (1 Cause)',
    rangeTag: '1 Cause',
    min: 1,
    max: 1,
    color: '#0284c7', // Sky Blue
    glowColor: 'rgba(2, 132, 199, 0.45)',
    badgeBg: '#38bdf8',
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
    color: '#facc15', // Warm Yellow
    glowColor: 'rgba(250, 204, 21, 0.45)',
    badgeBg: '#facc15',
    badgeText: '#000000',
    pulseSpeed: '2.6s',
    cloudRadius: 12000,
    coreRadius: 4800,
    badgeClass: 'tier-yellow'
  },
  3: {
    level: 3,
    label: 'High Relief Operations',
    rainDesc: 'Level 3: High Relief Need (4–6 Causes)',
    rangeTag: '4–6 Causes',
    min: 4,
    max: 6,
    color: '#fb923c', // Vibrant Orange
    glowColor: 'rgba(251, 146, 60, 0.5)',
    badgeBg: '#fb923c',
    badgeText: '#000000',
    pulseSpeed: '2.0s',
    cloudRadius: 15000,
    coreRadius: 6200,
    badgeClass: 'tier-orange'
  },
  4: {
    level: 4,
    label: 'Severe Emergency Zone',
    rainDesc: 'Level 4: Severe Emergency (7–11 Causes)',
    rangeTag: '7–11 Causes',
    min: 7,
    max: 11,
    color: '#ef4444', // Crimson Red
    glowColor: 'rgba(239, 68, 68, 0.55)',
    badgeBg: '#ef4444',
    badgeText: '#ffffff',
    pulseSpeed: '1.6s',
    cloudRadius: 19000,
    coreRadius: 7800,
    badgeClass: 'tier-red'
  },
  5: {
    level: 5,
    label: 'Critical Multi-Sector Crisis',
    rainDesc: 'Level 5: Critical Crisis (12–19 Causes)',
    rangeTag: '12–19 Causes',
    min: 12,
    max: 19,
    color: '#8b5cf6', // Electric Purple / Violet
    glowColor: 'rgba(139, 92, 246, 0.65)',
    badgeBg: '#8b5cf6',
    badgeText: '#ffffff',
    pulseSpeed: '1.2s',
    cloudRadius: 23000,
    coreRadius: 9500,
    badgeClass: 'tier-purple'
  },
  6: {
    level: 6,
    label: 'Catastrophic Epicenter',
    rainDesc: 'Level 6: Maximum Catastrophe (20+ Causes)',
    rangeTag: '20+ Causes',
    min: 20,
    max: Infinity,
    color: '#09090b', // Obsidian Black
    glowColor: 'rgba(9, 9, 11, 0.9)',
    badgeBg: '#09090b',
    badgeText: '#ffffff',
    borderColor: 'rgba(255, 255, 255, 0.65)',
    pulseSpeed: '0.9s',
    cloudRadius: 28000,
    coreRadius: 11500,
    badgeClass: 'tier-black'
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

  const text = `${campaign.locationRegion || ''} ${campaign.title || ''} ${campaign.description || ''}`.toLowerCase();
  for (const [key, val] of Object.entries(PH_LOCATIONS)) {
    if (text.includes(key)) {
      return [val.lat, val.lng];
    }
  }

  return [10.2500, 124.9500];
};

const getClusterKey = (campaign, coords) => {
  const text = `${campaign.locationRegion || ''} ${campaign.title || ''}`.toLowerCase();
  for (const [key, val] of Object.entries(PH_LOCATIONS)) {
    if (text.includes(key)) {
      return val.name;
    }
  }
  return `${coords[0].toFixed(1)}°N, ${coords[1].toFixed(1)}°E`;
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
  const text = `${campaign?.locationRegion || ''} ${campaign?.title || ''} ${campaign?.description || ''}`.toLowerCase();

  // 1. Direct match with GeoJSON province name (sorted descending by key length to match longest/most specific first)
  const sortedProvCentroids = Object.entries(PROVINCE_CENTROIDS).sort((a, b) => b[0].length - a[0].length);
  for (const [pKey, pData] of sortedProvCentroids) {
    if (pKey === 'leyte' && text.includes('southern leyte')) continue;
    if (pKey === 'samar' && (text.includes('eastern samar') || text.includes('northern samar'))) continue;
    if (pKey === 'davao del sur' && text.includes('davao occidental')) continue;
    if (text.includes(pKey)) {
      return pData;
    }
  }

  // 2. City / Municipality lookup from PH_LOCATIONS (sorted descending by key length)
  const sortedLocations = Object.entries(PH_LOCATIONS).sort((a, b) => b[0].length - a[0].length);
  for (const [locKey, locVal] of sortedLocations) {
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
  const text = `${camp?.title || ''} ${camp?.description || ''}`.toLowerCase();

  // 1. Flood Relief (Electric Ocean Teal)
  if (cat === 'FLOOD' || /flood|baha|inundat|overflow|water level/i.test(text)) {
    return {
      key: 'FLOOD',
      label: 'Flood Relief',
      shortLabel: 'FLOOD',
      icon: 'flood',
      color: '#06b6d4',             // Ocean Teal / Cyan
      glowColor: 'rgba(6, 182, 212, 0.5)',
      badgeBg: 'rgba(6, 182, 212, 0.16)',
      badgeText: '#22d3ee',
      pillBorder: 'rgba(6, 182, 212, 0.45)'
    };
  }
  // 2. Typhoon / Cyclone (Atmospheric Storm Blue)
  if (cat === 'TYPHOON' || /typhoon|bagyo|storm|odette|salin|cyclone|tropical/i.test(text)) {
    return {
      key: 'TYPHOON',
      label: 'Typhoon Relief',
      shortLabel: 'TYPHOON',
      icon: 'cyclone',
      color: '#0284c7',             // Atmospheric Storm Blue (--accent-blue)
      glowColor: 'rgba(2, 132, 199, 0.5)',
      badgeBg: 'rgba(2, 132, 199, 0.16)',
      badgeText: '#38bdf8',
      pillBorder: 'rgba(56, 189, 248, 0.45)'
    };
  }
  // 3. Medical Aid (Crimson Red)
  if (cat === 'MEDICAL' || /medical|hygiene|medicine|doctor|clinic|sanitation|hospital/i.test(text)) {
    return {
      key: 'MEDICAL',
      label: 'Medical Aid',
      shortLabel: 'MEDICAL',
      icon: 'medical_services',
      color: '#ef4444',             // Crimson Red (--danger)
      glowColor: 'rgba(239, 68, 68, 0.5)',
      badgeBg: 'rgba(239, 68, 68, 0.16)',
      badgeText: '#f87171',
      pillBorder: 'rgba(239, 68, 68, 0.45)'
    };
  }
  // 4. Food & Water Aid (Amber Gold)
  if (cat === 'FOOD_WATER' || cat === 'FOOD' || /food|water|meal|rice|nutrition|ration|hunger/i.test(text)) {
    return {
      key: 'FOOD',
      label: 'Food & Water Aid',
      shortLabel: 'FOOD AID',
      icon: 'water_drop',
      color: '#f59e0b',             // Warm Amber Gold (--accent-orange)
      glowColor: 'rgba(245, 158, 11, 0.5)',
      badgeBg: 'rgba(245, 158, 11, 0.16)',
      badgeText: '#fbbf24',
      pillBorder: 'rgba(245, 158, 11, 0.45)'
    };
  }
  // 5. Shelter / Reconstruction (Emerald Green)
  if (cat === 'SHELTER' || /shelter|reconstruct|rebuild|roof|lumber|housing|evacuat/i.test(text)) {
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
  // 6. Default / General Emergency: Theme Accent (#22c55e)
  return {
    key: 'EMERGENCY',
    label: 'Emergency Relief',
    shortLabel: 'RELIEF',
    icon: 'emergency',
    color: '#22c55e',               // Theme Green Accent (--accent)
    glowColor: 'rgba(34, 197, 94, 0.5)',
    badgeBg: 'rgba(34, 197, 94, 0.16)',
    badgeText: '#4ade80',
    pillBorder: 'rgba(34, 197, 94, 0.45)'
  };
};

const resolveCampaignSubLocation = (camp, defaultLoc) => {
  const text = `${camp?.locationRegion || ''} ${camp?.title || ''} ${camp?.description || ''}`.toLowerCase();
  for (const [key, val] of Object.entries(PH_LOCATIONS)) {
    if (text.includes(key)) {
      const parts = val.name.split(',');
      return parts[0].trim();
    }
  }
  return camp?.locationRegion || defaultLoc || 'Disaster Zone';
};

const getProvinceCampaigns = (provinceName, allCampaigns) => {
  if (!provinceName || !allCampaigns || !allCampaigns.length) return [];
  const norm = provinceName.toLowerCase().trim();
  return allCampaigns.filter(c => {
    const text = `${c.locationRegion || ''} ${c.title || ''} ${c.description || ''}`.toLowerCase();
    if (norm === 'southern leyte') {
      return text.includes('southern leyte') || text.includes('maasin') || text.includes('macrohon') || text.includes('sogod') || text.includes('combado') || text.includes('limasawa') || text.includes('padre burgos') || text.includes('bontoc') || text.includes('malitbog');
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
    if (norm === 'cebu') return text.includes('cebu') || text.includes('mandaue') || text.includes('lapu-lapu') || text.includes('talisay');
    if (norm === 'albay') return text.includes('albay') || text.includes('legazpi') || text.includes('mayon') || text.includes('daraga') || text.includes('tabaco');
    if (norm === 'camarines sur') return text.includes('camarines sur') || text.includes('naga city') || text.includes('pili');
    if (norm === 'camarines norte') return text.includes('camarines norte') || text.includes('daet');
    if (norm === 'catanduanes') return text.includes('catanduanes') || text.includes('virac');
    if (norm === 'sorsogon') return text.includes('sorsogon');
    if (norm === 'masbate') return text.includes('masbate');
    if (norm === 'isabela') return text.includes('isabela') || text.includes('ilagan');
    if (norm === 'cagayan') return text.includes('cagayan') || text.includes('tuguegarao');
    if (norm === 'benguet') return text.includes('benguet') || text.includes('baguio');
    if (norm === 'pangasinan') return text.includes('pangasinan') || text.includes('dagupan');
    if (norm === 'pampanga') return text.includes('pampanga') || text.includes('san fernando') || text.includes('angeles');
    if (norm === 'bulacan') return text.includes('bulacan') || text.includes('malolos');
    if (norm === 'cavite') return text.includes('cavite') || text.includes('tagaytay') || text.includes('dasmarinas');
    if (norm === 'laguna') return text.includes('laguna') || text.includes('calamba') || text.includes('santa rosa');
    if (norm === 'batangas') return text.includes('batangas') || text.includes('lipa');
    if (norm === 'rizal') return text.includes('rizal') || text.includes('antipolo');
    if (norm === 'quezon') return text.includes('quezon province') || text.includes('lucena');
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

    // Random roll for desired mission count ranging across all 6 Doppler tiers (1 to 30)
    const roll = rand();
    let targetCount = 0;
    if (roll < 0.10) {
      // ~10% of provinces left clear to create natural geographical contrast
      targetCount = 0;
    } else if (roll < 0.28) {
      // Tier 1: 1 cause (Emerging)
      targetCount = 1;
    } else if (roll < 0.50) {
      // Tier 2: 2-3 causes (Moderate)
      targetCount = 2 + Math.floor(rand() * 2);
    } else if (roll < 0.70) {
      // Tier 3: 4-6 causes (High)
      targetCount = 4 + Math.floor(rand() * 3);
    } else if (roll < 0.85) {
      // Tier 4: 7-11 causes (Severe)
      targetCount = 7 + Math.floor(rand() * 5);
    } else if (roll < 0.94) {
      // Tier 5: 12-19 causes (Critical)
      targetCount = 12 + Math.floor(rand() * 8);
    } else {
      // Tier 6: 20-30 causes (Catastrophic Epicenter)
      targetCount = 20 + Math.floor(rand() * 11);
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
        isSimulated: true
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
    return {
      base: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
      labels: null,
      maxZoom: 18
    };
  }
  if (activeLayer === 'osm') {
    return {
      base: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      labels: null,
      maxZoom: 19
    };
  }

  // Tactical Basemap adapts seamlessly to Dark vs Light theme
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

function DisasterRadarHeatmapInner({
  campaigns = [],
  onSelectCampaign,
  className = '',
  title = 'Philippine Disaster Relief Radar Heatmap',
  height = '620px',
  allowFullscreen = true,
  theme: propTheme,
  defaultLayer = 'terrain'
}) {
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

  const [currentTheme, setCurrentTheme] = useState(() => {
    return propTheme || document.documentElement.getAttribute('data-theme') || 'dark';
  });

  const [activeLayer, setActiveLayer] = useState(defaultLayer); // 'provinces' | 'satellite' | 'terrain' | 'tactical' | 'osm'
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [focusedProvince, setFocusedProvince] = useState(null);
  const focusedProvinceRef = useRef(null);
  const isProvinceClickRef = useRef(false);
  const lastFocusCenterRef = useRef([11.2, 123.8]);
  const [simulateDensity, setSimulateDensity] = useState(true);
  const [simSeed, setSimSeed] = useState(1);

  // Active campaigns combining real on-chain campaigns with simulated density missions
  const activeCampaigns = useMemo(() => {
    if (!simulateDensity) return campaigns || [];
    const simulated = generateSimulatedMissions(simSeed, campaigns || []);
    return [...(campaigns || []), ...simulated];
  }, [campaigns, simulateDensity, simSeed]);

  const activeLayerRef = useRef(activeLayer);
  activeLayerRef.current = activeLayer;
  const campaignsRef = useRef(activeCampaigns);
  campaignsRef.current = activeCampaigns;
  const isMapMovingRef = useRef(false);

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
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [legendCollapsed, setLegendCollapsed] = useState(false);
  const [filterRegion, setFilterRegion] = useState('ALL');
  const [focusedTier, setFocusedTier] = useState(null);
  const [radarSweepActive, setRadarSweepActive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  // Synchronize Theme Changes (Dark, Light, Cyber)
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

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current) return;

    if (!mapRef.current) {
      const map = L.map(containerRef.current, {
        center: [11.2, 123.8],
        zoom: 6,
        minZoom: 5,
        maxZoom: 17,
        zoomControl: false,
        attributionControl: false,
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
          // Camera remains completely steady at current zoom and center
        }
      });

      // Track movement states to prevent mid-flight hover recalculations that offset vector paths
      map.on('movestart zoomstart', () => {
        isMapMovingRef.current = true;
      });

      // Automatic vector synchronization on motion end (guarantees zero coordinate drift)
      map.on('moveend zoomend', () => {
        isMapMovingRef.current = false;
        const currentFocused = focusedProvinceRef.current;
        const currentZ = map.getZoom();
        const activeL = activeLayerRef.current;
        const camps = campaignsRef.current;

        // Dynamic zoom classes on container for deep-zoom beacon scaling
        if (containerRef.current) {
          containerRef.current.classList.toggle('is-deep-zoom', currentZ >= 11 && currentZ < 13);
          containerRef.current.classList.toggle('is-ultra-zoom', currentZ >= 13);
        }

        if (geoJsonLayerRef.current) {
          geoJsonLayerRef.current.eachLayer((layer) => {
            if (typeof layer.redraw === 'function') {
              layer.redraw();
            }
            const feature = layer.feature;
            if (feature) {
              const pName = feature.properties?.name || '';
              const isThisFocused = Boolean(currentFocused && (pName.toLowerCase() === currentFocused.toLowerCase()));
              layer.setStyle(getProvinceStyle(feature, currentFocused, activeL, camps, currentZ));
              if (isThisFocused) {
                layer.bringToFront();
              }
            }
          });
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

  // Helper function to calculate style for any province without rebuilding layers
  function getProvinceStyle(feature, currentFocused, currentLayer, currentCampaigns, zoomLevel) {
    const pName = feature.properties?.name || '';
    const provCamps = getProvinceCampaigns(pName, currentCampaigns);
    const count = provCamps.length;
    const isPlainWhite = currentLayer === 'provinces';
    const hasFocus = Boolean(currentFocused);
    const isThisFocused = Boolean(hasFocus && (currentFocused.toLowerCase() === pName.toLowerCase()));

    const z = typeof zoomLevel === 'number' ? zoomLevel : (mapRef.current ? mapRef.current.getZoom() : 6);
    const isZoomedOut = z <= 6.5;

    // ── IF A PROVINCE IS FOCUSED AND THIS IS NOT THE ONE: GRAYED OUT & DIMMED ──
    if (hasFocus && !isThisFocused) {
      return {
        fillColor: isPlainWhite ? '#cbd5e1' : '#090d16',
        fillOpacity: isPlainWhite ? 0.30 : 0.28,
        color: isPlainWhite ? '#94a3b8' : 'rgba(100, 116, 139, 0.25)',
        weight: 0.6,
        opacity: 0.30
      };
    }

    // ── 1. PLAIN WHITE (PROVINCES) VIEW ──
    if (isPlainWhite) {
      if (count > 0) {
        const tier = getTier(count);
        return {
          fillColor: tier.color,
          fillOpacity: 1.0,
          color: isThisFocused ? (tier.level === 6 ? '#ffffff' : '#000000') : (tier.level === 6 ? '#ffffff' : '#000000'),
          weight: isThisFocused ? 4.5 : (isZoomedOut ? 1.2 : 1.8),
          opacity: 1.0
        };
      }

      // Unaffected province: 100% Solid White with clean border (Black when focused)
      return {
        fillColor: '#ffffff',
        fillOpacity: 1.0,
        color: isThisFocused ? '#000000' : '#64748b',
        weight: isThisFocused ? 4.5 : (isZoomedOut ? 0.75 : 1.0),
        opacity: 0.95
      };
    }

    // ── 2. SATELLITE VIEW (CLEAN DYNAMIC BORDERS) ──
    if (currentLayer === 'satellite') {
      if (count > 0) {
        const tier = getTier(count);
        return {
          fillColor: tier.color,
          fillOpacity: isThisFocused ? 0.12 : (tier.level === 6 ? 0.38 : 0.22),
          color: isThisFocused ? '#ffffff' : (tier.level === 6 ? '#ffffff' : tier.color),
          weight: isThisFocused ? 4.0 : (isZoomedOut ? 1.0 : 1.8),
          opacity: 1.0
        };
      }

      // Unaffected province in Satellite View:
      return {
        fillColor: isThisFocused ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
        fillOpacity: isThisFocused ? 0.12 : 0,
        color: isThisFocused ? '#ffffff' : (isZoomedOut ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.80)'),
        weight: isThisFocused ? 4.0 : (isZoomedOut ? 0.65 : 1.3),
        opacity: 1.0
      };
    }

    // ── 3. NON-PLAIN-WHITE VIEWS (Terrain, OSM, Tactical) ──
    if (count > 0) {
      const tier = getTier(count);
      return {
        fillColor: tier.color,
        fillOpacity: isThisFocused ? 0.12 : (tier.level === 6 ? 0.35 : 0.20),
        color: isThisFocused ? '#ffffff' : (tier.level === 6 ? '#000000' : tier.color),
        weight: isThisFocused ? 4.0 : (isZoomedOut ? 1.2 : 1.8),
        opacity: 1.0
      };
    }

    // Unaffected province on Terrain/Tactical/OSM
    return {
      fillColor: isThisFocused ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
      fillOpacity: isThisFocused ? 0.12 : 0,
      color: isThisFocused ? '#ffffff' : 'rgba(255, 255, 255, 0.55)',
      weight: isThisFocused ? 4.0 : (isZoomedOut ? 0.65 : 1.2),
      opacity: 1.0
    };
  }

  // ── Initialize Philippine Provinces GeoJSON Layer (BUILT ONCE, ZERO FLICKER) ──
  useEffect(() => {
    if (!mapRef.current || !provinceGeoGroupRef.current) return;
    const geoGroup = provinceGeoGroupRef.current;
    geoGroup.clearLayers();

    const geoJsonLayer = L.geoJSON(PH_PROVINCES_GEOJSON, {
      style: (feature) => getProvinceStyle(feature, focusedProvinceRef.current, activeLayer, activeCampaigns, mapRef.current ? mapRef.current.getZoom() : 6),
      onEachFeature: (feature, layer) => {
        const pName = feature.properties?.name || 'Province';
        const provCamps = getProvinceCampaigns(pName, activeCampaigns);
        const count = provCamps.length;
        const tier = count > 0 ? getTier(count) : null;
        const totalEth = provCamps.reduce((acc, c) => acc + (parseFloat(c.currentAmount || c.raised_eth || 0) || 0), 0);
        const totalTargetEth = provCamps.reduce((acc, c) => acc + (parseFloat(c.targetAmount || c.target_eth || 0) || 0), 0);

        // Only bind tooltips for provinces with active campaigns to prevent mousemove lag
        if (count > 0) {
          const tooltipHtml = `
            <div class="province-tooltip-card">
              <div class="prov-tooltip-header">
                <span class="material-symbols-outlined prov-tooltip-pin-icon">location_on</span>
                <span class="prov-tooltip-title">${pName}</span>
              </div>
              <div class="prov-tooltip-badge" style="--badge-tier: ${tier.color}; background: ${tier.color}1f; color: ${tier.color}; border: 1px solid ${tier.color}55;">
                <span class="prov-badge-pulse-dot" style="background: ${tier.color};"></span>
                <span>${tier.rainDesc}</span>
              </div>
              <div class="prov-tooltip-stats-grid">
                <div class="prov-stat-cardlet">
                  <span class="prov-stat-k">Relief Operations</span>
                  <span class="prov-stat-v text-accent"><strong>${count}</strong> Active ${count === 1 ? 'Cause' : 'Causes'}</span>
                </div>
                <div class="prov-stat-cardlet">
                  <span class="prov-stat-k">Funds Mobilized</span>
                  <span class="prov-stat-v"><strong>${totalEth.toFixed(2)} ETH</strong></span>
                </div>
              </div>
              <div class="prov-tooltip-action-cue">
                <span>Focus & Reveal Mission Pins</span>
                <span class="material-symbols-outlined" style="font-size: 13px;">arrow_forward</span>
              </div>
            </div>
          `;

          layer.bindTooltip(tooltipHtml, {
            sticky: false,
            direction: 'top',
            opacity: 0.96,
            className: 'province-leaflet-tooltip'
          });
        }

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
            const isThisFocused = Boolean(currentFocused && (currentFocused.toLowerCase() === pName.toLowerCase()));

            // If this province is already focused, suppress its tooltip entirely —
            // the mission pins are already visible; the "Click to focus" tooltip is misleading.
            if (isThisFocused) {
              if (layer.getTooltip()) layer.closeTooltip();
              return; // Also skip hover highlight for the focused province border
            }

            const isSat = activeLayer === 'satellite';
            const currentZ = mapRef.current ? mapRef.current.getZoom() : 6;
            const isZoomedOut = currentZ <= 6.5;
            e.target.setStyle({
              weight: count > 0
                ? (isSat ? (isZoomedOut ? 1.4 : 2.2) : (isZoomedOut ? 1.6 : 2.2))
                : (isSat ? (isZoomedOut ? 1.0 : 1.8) : (isZoomedOut ? 1.2 : 1.6)),
              color: isSat ? '#ffffff' : '#000000',
              opacity: 1.0
            });
          },
          mouseout: (e) => {
            if (isMapMovingRef.current) return; // Prevent mid-animation style recalculations that displace vector paths
            const currentFocused = focusedProvinceRef.current;
            const isThisFocused = Boolean(currentFocused && (currentFocused.toLowerCase() === pName.toLowerCase()));
            // NEVER reset the bold border of the currently focused province - it stays until next province!
            if (!isThisFocused) {
              const freshStyle = getProvinceStyle(feature, currentFocused, activeLayer, activeCampaigns, mapRef.current ? mapRef.current.getZoom() : 6);
              e.target.setStyle(freshStyle);
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

            // Close tooltip immediately — prevents the info card from flashing on click
            if (layer.getTooltip()) layer.closeTooltip();

            isProvinceClickRef.current = true;
            setTimeout(() => {
              isProvinceClickRef.current = false;
            }, 150);

            setFocusedProvince(pName);
            focusedProvinceRef.current = pName;
            // Do NOT open a dossier/cluster card on province click — mission pins are revealed instead
            setSelectedCluster(null);

            const bounds = layer.getBounds();
            if (mapRef.current && bounds && bounds.isValid()) {
              const center = bounds.getCenter();
              lastFocusCenterRef.current = [center.lat, center.lng];
              const currentZoom = mapRef.current.getZoom();
              const targetZoom = Math.max(currentZoom, 8);
              smoothNavigateTo(center, targetZoom);
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
  }, [activeLayer, activeCampaigns]);

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

      if (isThisFocused && !isMapMovingRef.current) {
        layer.bringToFront();
      }
    });
  }, [focusedProvince, activeLayer, activeCampaigns]);

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
    const targetOpacity = currentTheme === 'light' ? 0.40 : (currentTheme === 'cyber' ? 0.65 : 0.55);
    const targetColor = currentTheme === 'light' ? '#0f172a' : '#020617';

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

    const heatGroup = heatCloudGroupRef.current;
    const markersGroup = markersGroupRef.current;
    heatGroup.clearLayers();
    markersGroup.clearLayers();

    // When a province is focused, hide wide cluster beacons so exact pins are clear
    const clustersToRender = focusedProvince ? [] : visibleClusters;

    clustersToRender.forEach(cluster => {
      const { lat, lng, tier, campaigns: clusterCamps } = cluster;
      const count = clusterCamps.length;

      // ── 1. Regional Doppler Radar Precipitation Cloud (Shades that section of the Philippines) ──
      // Outer precipitation dispersion blanket (compact localized halo)
      const cloudDispersion = L.circle([lat, lng], {
        radius: tier.cloudRadius,
        color: tier.color,
        fillColor: tier.color,
        fillOpacity: currentTheme === 'light' ? 0.18 : 0.12,
        weight: 1,
        dashArray: '3, 6',
        interactive: false
      });

      // Mid-density rain band
      const cloudMid = L.circle([lat, lng], {
        radius: tier.cloudRadius * 0.65,
        color: tier.color,
        fillColor: tier.color,
        fillOpacity: currentTheme === 'light' ? 0.25 : 0.18,
        weight: 1.2,
        interactive: false
      });

      // Epicenter storm density core
      const cloudCore = L.circle([lat, lng], {
        radius: tier.coreRadius,
        color: tier.color,
        fillColor: tier.color,
        fillOpacity: currentTheme === 'light' ? 0.38 : 0.28,
        weight: 1.5,
        interactive: false
      });

      if (activeLayer !== 'provinces') {
        heatGroup.addLayer(cloudDispersion);
        heatGroup.addLayer(cloudMid);
        heatGroup.addLayer(cloudCore);
      }

      // Dynamic pulse speed based on cause count: more causes -> faster double-beep repeat rate
      const dynamicSpeedSec = Math.max(1.0, 2.8 - Math.log2(Math.max(1, count)) * 0.5).toFixed(2);
      const pulseSpeed = `${dynamicSpeedSec}s`;
      // Millisecond delay between 1st beep and 2nd beep (300ms)
      const followDelay = '0.30s';

      // ── 2. Doppler Storm Beacon Icon ──
      const markerHtml = `
        <div class="doppler-radar-beacon ${tier.badgeClass}" style="--tier-color: ${tier.color}; --pulse-speed: ${pulseSpeed}; --follow-delay: ${followDelay};">
          <div class="beacon-ring ring-1"></div>
          <div class="beacon-ring ring-2"></div>
          <div class="beacon-core" style="background: ${tier.badgeBg}; color: ${tier.badgeText}; border-color: ${currentTheme === 'light' ? '#ffffff' : '#111111'};">
            <span class="beacon-count">${count}</span>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'radar-beacon-div-icon',
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      const marker = L.marker([lat, lng], { icon: customIcon, interactive: true });

      marker.on('click', (e) => {
        if (e && e.originalEvent) {
          L.DomEvent.stopPropagation(e.originalEvent);
        }
        isProvinceClickRef.current = true;
        setTimeout(() => {
          isProvinceClickRef.current = false;
        }, 150);

        setSelectedCluster(cluster);
        const provName = cluster.name.split(',')[0].trim();
        setFocusedProvince(provName);
        focusedProvinceRef.current = provName;
        lastFocusCenterRef.current = [lat, lng];
        if (mapRef.current) {
          const currentZoom = mapRef.current.getZoom();
          const targetZoom = Math.max(currentZoom, 8);
          smoothNavigateTo([lat, lng], targetZoom);
        }
      });

      marker.bindTooltip(`
        <div class="doppler-tooltip-card">
          <div class="tooltip-loc-title" style="color: ${tier.color};">${cluster.name}</div>
          <div class="tooltip-reg-sub">${cluster.regionName}</div>
          <div class="tooltip-meta-grid">
            <div><span class="k">Alert Level:</span> <strong style="color: ${tier.color};">${tier.label}</strong></div>
            <div><span class="k">Relief Operations:</span> <strong>${count} Active Cause${count > 1 ? 's' : ''}</strong></div>
            <div><span class="k">Raised:</span> <strong>${cluster.totalRaised.toFixed(2)} ETH</strong></div>
          </div>
        </div>
      `, {
        direction: 'top',
        offset: [0, -26],
        opacity: 0.98,
        className: 'doppler-tooltip-wrapper'
      });

      markersGroup.addLayer(marker);
    });
  }, [visibleClusters, currentTheme]);

  // Toggle Cluster Beacon Visibility on Focus Change without destroying layers
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    if (focusedProvince) {
      if (markersGroupRef.current && map.hasLayer(markersGroupRef.current)) {
        map.removeLayer(markersGroupRef.current);
      }
      if (heatCloudGroupRef.current && map.hasLayer(heatCloudGroupRef.current)) {
        map.removeLayer(heatCloudGroupRef.current);
      }
    } else {
      if (markersGroupRef.current && !map.hasLayer(markersGroupRef.current)) {
        map.addLayer(markersGroupRef.current);
      }
      if (heatCloudGroupRef.current && !map.hasLayer(heatCloudGroupRef.current)) {
        map.addLayer(heatCloudGroupRef.current);
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

    provCamps.forEach((camp, idx) => {
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

      const raised = parseFloat(camp.currentAmount || camp.raised_eth || 0) || 0;
      const target = parseFloat(camp.targetAmount || camp.target_eth || 0) || 0;
      const pct = target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 0;

      const catMeta = getCampaignCategoryMeta(camp);
      const subLocation = resolveCampaignSubLocation(camp, focusedProvince);

      // 4-direction fan-out: each pin radiates its chip in a different direction
      // so nearby pins NEVER stack their chips on the same side (no vertical collision).
      const POS_CYCLE = ['tag-pos-top', 'tag-pos-right', 'tag-pos-top-high', 'tag-pos-left'];
      const tagPosClass = POS_CYCLE[idx % POS_CYCLE.length];

      const rawTitle = camp.title || 'Relief Mission';
      // Smart display title: strip generic noise words, keep specific identifiers legible
      const stripped = rawTitle.replace(/(operation|project)/gi, '').trim();
      const displayTitle = stripped.length > 20 ? stripped.slice(0, 18).trim() + '…' : stripped;

      const pinHtml = `
        <div class="exact-campaign-tactical-pin" style="--pin-color: ${catMeta.color}; --glow-color: ${catMeta.glowColor}; animation-delay: ${idx * 90}ms;">
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
          
          <!-- Mission HUD Card (shown via JS class, never via CSS :hover alone) -->
          <div class="pin-tactical-hud-card ${tagPosClass}">
            <!-- Hover Super-HUD Dossier Card -->
            <div class="hud-expanded-view">
              <div class="hud-exp-header">
                <span class="hud-exp-cat" style="color: ${catMeta.color}; background: ${catMeta.color}1f; border: 1px solid ${catMeta.color}45;">
                  <span class="material-symbols-outlined" style="font-size: 11px;">${catMeta.icon}</span>
                  ${catMeta.label}
                </span>
                <span class="hud-exp-badge">ACTIVE</span>
              </div>
              <div class="hud-exp-title">${rawTitle}</div>
              <div class="hud-exp-location">
                <span class="material-symbols-outlined" style="font-size: 11px; color: ${catMeta.color};">location_on</span>
                <span>${subLocation ? `${subLocation}, ${focusedProvince}` : (camp.locationRegion || focusedProvince)}</span>
              </div>
              <div class="hud-exp-prog-track">
                <div class="hud-exp-prog-fill" style="width: ${pct}%; background: linear-gradient(90deg, ${catMeta.color}, var(--accent, #22c55e));"></div>
              </div>
              <div class="hud-exp-stats">
                <span class="hud-exp-raised" style="color: var(--accent, #22c55e);">${raised.toFixed(2)} ETH (${pct}%)</span>
                <span class="hud-exp-goal">Goal: ${target.toFixed(2)} ETH</span>
              </div>

              <!-- Action Button to Redirect to Campaign -->
              <div class="hud-exp-btn-wrap">
                <button type="button" class="hud-campaign-redirect-btn" data-campaign-id="${camp.id || ''}" data-campaign-title="${encodeURIComponent(rawTitle)}">
                  <span class="material-symbols-outlined" style="font-size: 13px;">volunteer_activism</span>
                  <span>View Campaign</span>
                  <span class="material-symbols-outlined" style="font-size: 12px;">arrow_forward</span>
                </button>
              </div>

              <div class="hud-exp-footer">
                <span class="pin-status-icon">📌</span>
                <span>Click to pin open · click again to close</span>
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

      // Hover: strictly triggered ONLY when entering the mini circle icon itself or the open card
      pinMarker.on('mouseover', (e) => {
        if (e && e.originalEvent && !e.originalEvent.target.closest('.pin-head-disc, .hud-expanded-view')) {
          return;
        }
        pinMarker.setZIndexOffset(100000);
        const el = pinMarker.getElement();
        if (el) el.classList.add('is-marker-hovered');
        const inner = el?.querySelector('.exact-campaign-tactical-pin');
        if (inner) inner.classList.add('is-card-hovered');
      });

      // Mouseout: hide card and restore normal z-index unless moving between disc and card or pinned open
      pinMarker.on('mouseout', (e) => {
        if (e && e.originalEvent && e.originalEvent.relatedTarget && e.originalEvent.relatedTarget.closest('.exact-campaign-tactical-pin')) {
          return;
        }
        const el = pinMarker.getElement();
        const inner = el?.querySelector('.exact-campaign-tactical-pin');
        if (inner && !inner.classList.contains('is-card-pinned')) {
          inner.classList.remove('is-card-hovered');
          if (el) el.classList.remove('is-marker-hovered');
          pinMarker.setZIndexOffset(0);
        }
      });

      // Click: ONLY clickable on the mini circle icon beacon itself!
      // Clicks anywhere outside the circle pass through to the map.
      pinMarker.on('click', (e) => {
        if (e && e.originalEvent) {
          if (e.originalEvent.target.closest('.hud-campaign-redirect-btn')) {
            return; // Let redirect handler handle it
          }
          // The ONLY clickable element on the beacon is the mini circle icon itself!
          if (!e.originalEvent.target.closest('.pin-head-disc')) {
            return;
          }
          L.DomEvent.stopPropagation(e.originalEvent);
        }
        isProvinceClickRef.current = true;
        setTimeout(() => { isProvinceClickRef.current = false; }, 150);

        const el = pinMarker.getElement();
        const inner = el?.querySelector('.exact-campaign-tactical-pin');
        if (!inner) return;

        const isCurrentlyPinned = inner.classList.contains('is-card-pinned');

        // Unpin every other pin first and reset their z-index offsets
        pinsGroup.eachLayer(otherMarker => {
          if (otherMarker !== pinMarker) {
            otherMarker.setZIndexOffset(0);
            const otherEl = otherMarker.getElement();
            if (otherEl) {
              otherEl.classList.remove('is-marker-pinned', 'is-marker-hovered');
              const otherInner = otherEl.querySelector('.exact-campaign-tactical-pin');
              if (otherInner) {
                otherInner.classList.remove('is-card-pinned', 'is-card-hovered');
              }
            }
          }
        });

        if (isCurrentlyPinned) {
          // Already pinned → unpin (toggle off)
          inner.classList.remove('is-card-pinned');
          inner.classList.remove('is-card-hovered');
          if (el) el.classList.remove('is-marker-pinned', 'is-marker-hovered');
          pinMarker.setZIndexOffset(0);
        } else {
          // Pin it open at top-most z-index
          inner.classList.add('is-card-pinned');
          inner.classList.add('is-card-hovered');
          if (el) el.classList.add('is-marker-pinned', 'is-marker-hovered');
          pinMarker.setZIndexOffset(100000);
        }
      });

      pinsGroup.addLayer(pinMarker);
    });
  }, [focusedProvince, activeCampaigns, activeLayer, currentTheme]);

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
      const targetCamp = activeCampaigns.find(c => String(c.id) === String(campId));

      if (targetCamp?.isSimulated) {
        return; // Simulated preview only
      }

      if (onSelectCampaign && targetCamp) {
        onSelectCampaign(targetCamp);
      } else {
        const targetEl = document.getElementById(`campaign-${campId}`) || document.getElementById('campaigns');
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth' });
        }
      }
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
    setFocusedProvince(null);
    focusedProvinceRef.current = null;
    setSelectedCluster(null);
    setIsDossierOpen(false);
    // User requirement: "I changed my mind, unfocusing on a country doesn't zoom out even a little"
    // Camera stays completely steady at current zoom and position
  };

  const handleFlyToCluster = (cluster) => {
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
    setFilterRegion(regionCode);
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
      <div className={`bbdrts-radar-command ${isFullscreen ? 'radar-command-fullscreen' : ''} ${className}`}>

        {/* ── Topbar (Executive Branding, Telemetry, & Radar Master Actions) ── */}
        <div className="radar-cmd-topbar">
          <div className="radar-cmd-branding">
            <div className="radar-icon-frame">
              <span className="material-symbols-outlined radar-spin-symbol">radar</span>
            </div>
            <div>
              <div className="radar-title-row">
                <span className="radar-main-title">Philippine Disaster Relief Radar Heatmap</span>
                <span className="radar-status-badge">
                  <span className="radar-status-dot"></span>
                  LIVE ARCHIPELAGO RADAR
                </span>
              </div>
              <div className="radar-sub-desc">
                Geospatial Relief Operations & Hotspot Density · Real-Time Disaster Concentration Across Philippine Provinces
              </div>
            </div>
          </div>

          <div className="radar-telemetry-cluster">
            <div className="radar-telemetry-item">
              <span className="telemetry-k">Philippine Time (PST / UTC+8)</span>
              <span className="telemetry-v telemetry-time">{currentTime || '01:00:00'}</span>
            </div>
            <div className="radar-telemetry-item">
              <span className="telemetry-k">Active Causes</span>
              <div className="telemetry-badge-metric">
                <span className="telemetry-metric-dot"></span>
                <span className="telemetry-v text-accent">{totalTrackedCampaigns}</span>
              </div>
            </div>

            {/* Density Simulation (1-30 Beacons) Toggle & Re-Roll Control */}
            <div className="radar-sim-deck-controls">
              <button
                type="button"
                className={`radar-sim-switch ${simulateDensity ? 'is-active' : ''}`}
                onClick={() => setSimulateDensity(!simulateDensity)}
                title={simulateDensity ? 'Switch to real campaigns only' : 'Simulate archipelago campaign density (1 to 30)'}
              >
                <span className="material-symbols-outlined sim-switch-icon">hub</span>
                <span className="sim-switch-label">DENSITY SIM (1–30)</span>
                <span className={`sim-switch-pill ${simulateDensity ? 'on' : 'off'}`}>
                  <span className="sim-pill-dot"></span>
                  {simulateDensity ? 'SIMULATED' : 'REAL ONLY'}
                </span>
              </button>

              {simulateDensity && (
                <button
                  type="button"
                  className="radar-reroll-btn"
                  onClick={() => setSimSeed(prev => prev + 1)}
                  title="Re-roll randomized province campaign counts"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>casino</span>
                  <span>Re-roll</span>
                </button>
              )}
            </div>

            {/* Tactical Doppler Sweep Master Switch */}
            <button
              type="button"
              className={`radar-sweep-switch ${radarSweepActive ? 'is-active' : ''}`}
              onClick={() => setRadarSweepActive(!radarSweepActive)}
              title={radarSweepActive ? 'Deactivate Doppler Radar Sweep' : 'Activate Doppler Radar Sweep'}
            >
              <span className="material-symbols-outlined sweep-switch-icon">sensors</span>
              <span className="sweep-switch-label">RADAR SWEEP</span>
              <span className={`sweep-switch-pill ${radarSweepActive ? 'on' : 'off'}`}>
                <span className="sweep-pill-dot"></span>
                {radarSweepActive ? 'LIVE' : 'OFF'}
              </span>
            </button>

            {allowFullscreen && (
              <div className="radar-fullscreen-btn-wrap">
                <button
                  type="button"
                  className={`radar-btn-fullscreen ${isFullscreen ? 'is-active' : ''}`}
                  onClick={toggleFullscreen}
                  title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Fullscreen Map'}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
                  </span>
                </button>
                {isFullscreen && (
                  <button
                    type="button"
                    className="radar-btn-exit-fullscreen"
                    onClick={toggleFullscreen}
                    title="Exit Fullscreen (Esc)"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
                    <span>Exit</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Unified Command Deck: Sector Quick-Jumps & Active Hotspots (Single Sleek Bar) ── */}
        <div className="radar-cmd-deck">
          <div className="deck-group sector-group">
            <span className="deck-label">Sector:</span>
            <div className="deck-pill-group">
              <button
                type="button"
                className={`deck-btn-pill ${filterRegion === 'ALL' ? 'active' : ''}`}
                onClick={() => handleJumpRegion('ALL')}
              >
                All Philippines ({clusters.length})
              </button>
              <button
                type="button"
                className={`deck-btn-pill ${filterRegion === 'LUZON' ? 'active' : ''}`}
                onClick={() => handleJumpRegion('LUZON')}
              >
                Luzon
              </button>
              <button
                type="button"
                className={`deck-btn-pill ${filterRegion === 'VISAYAS' ? 'active' : ''}`}
                onClick={() => handleJumpRegion('VISAYAS')}
              >
                Visayas
              </button>
              <button
                type="button"
                className={`deck-btn-pill ${filterRegion === 'MINDANAO' ? 'active' : ''}`}
                onClick={() => handleJumpRegion('MINDANAO')}
              >
                Mindanao
              </button>
            </div>
          </div>

          {/* Hotspots temporarily disabled/commented out for the meantime */}
          {/*
        <div className="deck-divider" />

        <div className="deck-group hotspots-group">
          <span className="deck-label">Hotspots:</span>
          <div className="deck-chips-scroll">
            {clusters.map((c) => {
              const isChipActive = (selectedCluster?.id === c.id || focusedProvince?.toLowerCase() === c.name.toLowerCase());
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`quick-hotspot-chip ${c.tier.badgeClass} ${isChipActive ? 'active' : ''}`}
                  onClick={() => handleFlyToCluster(c)}
                  style={{ '--chip-accent': c.tier.color }}
                >
                  <span className="chip-beacon-dot" style={{ background: c.tier.color }}></span>
                  <span className="chip-name">{c.name}</span>
                  <span className="chip-badge">{c.campaigns.length} Cause{c.campaigns.length > 1 ? 's' : ''}</span>
                  <span
                    className="chip-tier-tag"
                    style={{
                      color: c.tier.color,
                      borderColor: `${c.tier.color}44`,
                      backgroundColor: `${c.tier.color}18`
                    }}
                  >
                    {c.tier.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        */}
        </div>

        {/* ── Viewport ── */}
        <div className={`radar-map-viewport ${activeLayer === 'provinces' ? 'is-plain-white-mode' : ''} ${focusedProvince ? 'has-focused-province' : ''}`} style={{ height: isFullscreen ? 'calc(100vh - 120px)' : height }}>

          {/* Tactical Sector Focus Control Strip */}
          {focusedProvince && (
            <div className="radar-focus-control-strip">
              <div className="focus-indicator">
                <span className="focus-radar-pulse"></span>
                <span className="focus-label">Sector Focus:</span>
                <strong className="focus-province-name">{focusedProvince}</strong>
                <span className="focus-missions-badge">
                  <span className="focus-missions-dot"></span>
                  {getProvinceCampaigns(focusedProvince, activeCampaigns).length} Active Mission{getProvinceCampaigns(focusedProvince, activeCampaigns).length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="focus-actions">
                {getProvinceCampaigns(focusedProvince, activeCampaigns).length > 0 && (
                  <button
                    type="button"
                    className={`focus-dossier-btn ${isDossierOpen ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!selectedCluster && activeDossierCluster) {
                        setSelectedCluster(activeDossierCluster);
                      }
                      setIsDossierOpen(prev => !prev);
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                      {isDossierOpen ? 'visibility_off' : 'description'}
                    </span>
                    <span>{isDossierOpen ? 'Hide Dossier' : `View Dossier (${getProvinceCampaigns(focusedProvince, activeCampaigns).length})`}</span>
                  </button>
                )}
                <button
                  type="button"
                  className="focus-reset-btn"
                  onClick={handleResetFocus}
                  title="Deactivate Sector Focus"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
                  <span>Reset Focus</span>
                </button>
              </div>
            </div>
          )}

          {/* Leaflet Map Stage */}
          <div ref={containerRef} className={`radar-leaflet-stage ${activeLayer === 'provinces' ? 'is-plain-white-mode' : ''} ${activeLayer === 'satellite' ? 'is-satellite-mode' : ''}`} />

          {/* Authentic Circular Doppler Radar Scanner Beam */}
          {radarSweepActive && (
            <div className="doppler-sweep-container">
              <div className="doppler-sweep-scanner"></div>
            </div>
          )}

          {/* ── Google Maps-Style Floating Basemap Layer Switcher (Bottom Right beside Zoom Controls) ── */}
          <div className="radar-floating-basemap-control">
            <div className="floating-basemap-pill-group">
              <button
                type="button"
                className={`floating-basemap-btn ${activeLayer === 'provinces' ? 'active' : ''}`}
                onClick={() => setActiveLayer('provinces')}
                title="Plain Terrain with Provincial Heat Borders"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>grid_view</span>
                <span>Plain</span>
              </button>
              <button
                type="button"
                className={`floating-basemap-btn ${activeLayer === 'satellite' ? 'active' : ''}`}
                onClick={() => setActiveLayer('satellite')}
                title="High-Resolution Satellite Photography"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>satellite_alt</span>
                <span>Satellite</span>
              </button>
              <button
                type="button"
                className={`floating-basemap-btn ${activeLayer === 'terrain' ? 'active' : ''}`}
                onClick={() => setActiveLayer('terrain')}
                title="Physical Elevation Topography"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>terrain</span>
                <span>Terrain</span>
              </button>
              <button
                type="button"
                className={`floating-basemap-btn ${activeLayer === 'tactical' ? 'active' : ''}`}
                onClick={() => setActiveLayer('tactical')}
                title="Tactical Command Canvas"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>contrast</span>
                <span>Tactical</span>
              </button>
              <button
                type="button"
                className={`floating-basemap-btn ${activeLayer === 'osm' ? 'active' : ''}`}
                onClick={() => setActiveLayer('osm')}
                title="Standard Street Map"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>map</span>
                <span>Street</span>
              </button>
            </div>
          </div>

          {/* ── Meteorological Doppler Precipitation Legend (Strict Storm News Scale) ── */}
          <div className={`doppler-storm-legend-card ${legendCollapsed ? 'collapsed' : ''}`}>
            <div className="storm-legend-header">
              <div className="storm-legend-title">
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--accent)' }}>crisis_alert</span>
                <span>Disaster Severity Legend</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {focusedTier !== null && !legendCollapsed && (
                  <button type="button" className="legend-clear-btn" onClick={() => setFocusedTier(null)}>
                    Clear ✕
                  </button>
                )}
                <button
                  type="button"
                  className="legend-collapse-toggle"
                  onClick={() => setLegendCollapsed(!legendCollapsed)}
                  title={legendCollapsed ? 'Expand Legend' : 'Collapse Legend'}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                    {legendCollapsed ? 'expand_less' : 'expand_more'}
                  </span>
                </button>
              </div>
            </div>

            {!legendCollapsed && (
              <>
                {/* Continuous Doppler Gradient Meter (7 Tiers from Calm White to Code Black) */}
                <div className="storm-gradient-bar">
                  <div className="bar-step tier-0" title="0 Causes: Clear"></div>
                  <div className="bar-step tier-1" title="1 Cause: Sky Blue (Light)"></div>
                  <div className="bar-step tier-2" title="2–3 Causes: Yellow (Moderate)"></div>
                  <div className="bar-step tier-3" title="4–6 Causes: Orange (Heavy)"></div>
                  <div className="bar-step tier-4" title="7–11 Causes: Red (Severe)"></div>
                  <div className="bar-step tier-5" title="12–19 Causes: Violet (Crisis)"></div>
                  <div className="bar-step tier-6" title="20+ Causes: Black (Catastrophic)"></div>
                </div>

                {/* Interactive Tier Rows */}
                <div className="storm-tiers-list">
                  <div className="storm-tier-item clear-tier">
                    <span className="tier-bullet" style={{ background: '#ffffff', border: '1px solid #94a3b8' }}></span>
                    <span className="tier-causes-tag">0</span>
                    <span className="tier-desc-name" style={{ color: currentTheme === 'light' ? '#64748b' : '#94a3b8' }}>
                      Clear Terrain
                    </span>
                  </div>

                  {[1, 2, 3, 4, 5, 6].map((lvl) => {
                    const t = DOPPLER_TIERS[lvl];
                    const isFocused = focusedTier === lvl;
                    const matches = clusters.filter(c => c.tier.level === lvl).length;
                    const tagText = t.rangeTag.replace(' Causes', '').replace(' Cause', '');

                    return (
                      <div
                        key={lvl}
                        className={`storm-tier-item ${isFocused ? 'focused' : ''} ${t.badgeClass || ''}`}
                        onClick={() => setFocusedTier(focusedTier === lvl ? null : lvl)}
                      >
                        <span
                          className="tier-bullet"
                          style={{
                            background: t.color,
                            border: t.borderColor || `1px solid ${t.color}`,
                            boxShadow: lvl === 6 ? '0 0 4px rgba(0,0,0,0.8)' : 'none'
                          }}
                        ></span>
                        <span className="tier-causes-tag">{tagText}</span>
                        <span className="tier-desc-name" style={{ color: lvl === 6 ? '#f8fafc' : t.color }}>
                          {t.label}
                        </span>
                        {matches > 0 && <span className="tier-match-count">({matches})</span>}
                      </div>
                    );
                  })}
                </div>
              </>
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
                  <span className="dossier-num">{((activeDossierCluster.totalRaised ?? 0)).toFixed(2)} ETH</span>
                  <span className="dossier-tag-label">Funds Raised</span>
                </div>
                <div className="dossier-metric-cell">
                  <span className="dossier-num">{((activeDossierCluster.totalTarget ?? 0)).toFixed(2)} ETH</span>
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

                        <h4 className="dossier-camp-title">{c.title}</h4>
                        <p className="dossier-camp-desc">{c.description?.slice(0, 115)}...</p>

                        <div className="dossier-funding-progress">
                          <div className="dossier-progress-track">
                            <div className="dossier-progress-bar" style={{ width: `${pct}%` }}></div>
                          </div>
                          <div className="dossier-progress-labels">
                            <span>{raised.toFixed(2)} ETH raised ({pct}%)</span>
                            <span>Target: {target.toFixed(2)} ETH</span>
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

        </div>

      </div>
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
          background: 'var(--bg-card, #222222)',
          border: '1px solid var(--border, rgba(255,255,255,0.08))',
          borderRadius: '16px',
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
