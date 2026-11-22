// ── Philippine Comprehensive Geographic Resolver for Frontend ──
// Synchronized with backend engine for 100% offline accuracy

export const PH_POSTAL_CODES = {
  // Southern Leyte (6600 - 6618)
  'maasin': '6600', 'maasin city': '6600',
  'macrohon': '6601',
  'padre burgos': '6602',
  'malitbog': '6603',
  'bontoc': '6606',
  'tomas oppus': '6605',
  'sogod': '6606',
  'silago': '6607',
  'hinunangan': '6608',
  'hinundayan': '6609',
  'anahawan': '6610',
  'san juan': '6611', 'cabalian': '6611',
  'liloan': '6612', 'lilo-an': '6612',
  'san francisco': '6613',
  'pintuyan': '6614',
  'libagon': '6615',
  'saint bernard': '6616', 'st. bernard': '6616',
  'san ricardo': '6617',
  'limasawa': '6618',

  // Leyte (6500 - 6544)
  'tacloban': '6500', 'tacloban city': '6500',
  'palo': '6501',
  'tanauan': '6502',
  'tolosa': '6503',
  'tabontabon': '6504',
  'dulag': '6505',
  'julita': '6506',
  'mayorga': '6507',
  'la paz': '6508',
  'macarthur': '6509',
  'abuyog': '6510',
  'javier': '6511',
  'mahaplag': '6512',
  'dagami': '6515',
  'pastrana': '6516',
  'santa fe': '6513',
  'alangalang': '6517',
  'jaro': '6527',
  'san miguel': '6518',
  'babatngon': '6520',
  'barugo': '6519',
  'carigara': '6529',
  'tunga': '6528',
  'capoocan': '6530',
  'leyte': '6533',
  'calubian': '6534',
  'san isidro': '6535',
  'tabango': '6536',
  'villaba': '6537',
  'palompon': '6538',
  'matag-ob': '6539',
  'isabel': '6544',
  'merida': '6543',
  'ormoc': '6541', 'ormoc city': '6541',
  'albuera': '6542',
  'burauen': '6514',
  'baybay': '6521', 'baybay city': '6521',
  'inopacan': '6522',
  'hindang': '6523',
  'hilongos': '6524',
  'bato': '6525',
  'matalom': '6526',

  // Biliran
  'naval': '6543', 'biliran': '6549', 'cabucgayan': '6550', 'caibiran': '6548',
  'culaba': '6547', 'kawayan': '6545', 'almeria': '6544', 'maripipi': '6546',

  // Samar
  'catbalogan': '6700', 'catbalogan city': '6700', 'calbayog': '6710', 'calbayog city': '6710',
  'basey': '6720', 'marabut': '6721', 'santa rita': '6718', 'pinabacdao': '6716',

  // Eastern Samar
  'borongan': '6800', 'borongan city': '6800', 'guiuan': '6809', 'salcedo': '6808',
  'mercedes': '6807', 'lawaan': '6813', 'balangiga': '6812', 'giporlos': '6811',

  // Northern Samar
  'catarman': '6400', 'allen': '6405', 'victoria': '6406', 'laoang': '6411',

  // Cebu
  'cebu city': '6000', 'cebu': '6000', 'mandaue': '6014', 'mandaue city': '6014',
  'lapu-lapu': '6015', 'lapu-lapu city': '6015', 'talisay': '6045', 'talisay city': '6045',
  'minglanilla': '6046', 'naga': '6037', 'naga city': '6037', 'san fernando': '6018',
  'carcar': '6019', 'carcar city': '6019', 'toledo': '6038', 'toledo city': '6038',
  'danao': '6004', 'danao city': '6004', 'bogo': '6010', 'bogo city': '6010',

  // Bohol
  'tagbilaran': '6300', 'tagbilaran city': '6300', 'panglao': '6340', 'dauis': '6341',
  'tubigon': '6329', 'carmen': '6319', 'jagna': '6308', 'ubay': '6315', 'talibon': '6325',

  // NCR
  'manila': '1000', 'city of manila': '1000',
  'quezon city': '1100', 'makati': '1200', 'makati city': '1200',
  'taguig': '1630', 'taguig city': '1630', 'pasig': '1600', 'pasig city': '1600',
  'mandaluyong': '1550', 'san juan': '1500', 'pasay': '1300', 'paranaque': '1700',
  'las pinas': '1740', 'muntinlupa': '1770', 'marikina': '1800', 'valenzuela': '1440',
  'malabon': '1470', 'navotas': '1485', 'caloocan': '1400',

  // Davao
  'davao': '8000', 'davao city': '8000', 'tagum': '8100', 'tagum city': '8100',

  // Northern Mindanao
  'cagayan de oro': '9000', 'cagayan de oro city': '9000', 'iligan': '9200',

  // Western Visayas
  'iloilo': '5000', 'iloilo city': '5000', 'bacolod': '6100', 'bacolod city': '6100'
};

export const PH_MUNICIPALITY_ANCHORS = [
  // ── Southern Leyte (All 19/19) ──
  { name: 'Maasin City', province: 'Southern Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.1333, lon: 124.8667, zip: '6600', barangay: 'Tunga-tunga', street: 'R. Kangleon Street' },
  { name: 'Macrohon', province: 'Southern Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.0833, lon: 124.9333, zip: '6601', barangay: 'San Joaquin', street: 'San Joaquin Road' },
  { name: 'Padre Burgos', province: 'Southern Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.0500, lon: 125.0167, zip: '6602', barangay: 'Poblacion', street: 'National Coastal Highway' },
  { name: 'Limasawa', province: 'Southern Leyte', region: 'Eastern Visayas (Region VIII)', lat: 9.9167, lon: 125.0667, zip: '6618', barangay: 'Magallanes', street: 'First Mass Shrine Road' },
  { name: 'Malitbog', province: 'Southern Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.1667, lon: 125.0000, zip: '6603', barangay: 'San Jose', street: 'Rizal Street' },
  { name: 'Tomas Oppus', province: 'Southern Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.2500, lon: 124.9833, zip: '6605', barangay: 'Punong', street: 'SLSU Campus Road' },
  { name: 'Bontoc', province: 'Southern Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.3667, lon: 124.9667, zip: '6606', barangay: 'Casao', street: 'Sogod-Bontoc Road' },
  { name: 'Sogod', province: 'Southern Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.3833, lon: 124.9833, zip: '6606', barangay: 'Zone III', street: 'Concepcion Street' },
  { name: 'Libagon', province: 'Southern Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.3000, lon: 125.0500, zip: '6615', barangay: 'Poblacion', street: 'Sogod Bay Coastal Road' },
  { name: 'Liloan', province: 'Southern Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.1667, lon: 125.1333, zip: '6612', barangay: 'Tabugon', street: 'Wawa Strait Bridge Road' },
  { name: 'San Francisco', province: 'Southern Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.0500, lon: 125.1667, zip: '6613', barangay: 'Tuno', street: 'Panaon Island Highway' },
  { name: 'Pintuyan', province: 'Southern Leyte', region: 'Eastern Visayas (Region VIII)', lat: 9.9667, lon: 125.2500, zip: '6614', barangay: 'Poblacion Ubos', street: 'National Road' },
  { name: 'San Ricardo', province: 'Southern Leyte', region: 'Eastern Visayas (Region VIII)', lat: 9.9000, lon: 125.2833, zip: '6617', barangay: 'San Antonio', street: 'Benit Ferry Port Road' },
  { name: 'Saint Bernard', province: 'Southern Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.3333, lon: 125.1333, zip: '6616', barangay: 'Manlico', street: 'Municipal Hall Access Road' },
  { name: 'San Juan', province: 'Southern Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.2667, lon: 125.1833, zip: '6611', barangay: 'Poblacion', street: 'Cabalian Bay Highway' },
  { name: 'Anahawan', province: 'Southern Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.3500, lon: 125.2500, zip: '6610', barangay: 'Poblacion', street: 'Municipal Main Street' },
  { name: 'Hinundayan', province: 'Southern Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.3500, lon: 125.2667, zip: '6609', barangay: 'Poblacion', street: 'Labrador Street' },
  { name: 'Hinunangan', province: 'Southern Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.4000, lon: 125.2000, zip: '6608', barangay: 'Poblacion', street: 'Maharlika Highway' },
  { name: 'Silago', province: 'Southern Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.5333, lon: 125.1667, zip: '6607', barangay: 'Poblacion', street: 'Silago-Abuyog Highway' },

  // ── Leyte Province ──
  { name: 'Bato', province: 'Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.3333, lon: 124.7833, zip: '6525', barangay: 'Dolho', street: 'Bato Port Road' },
  { name: 'Hilongos', province: 'Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.3733, lon: 124.7500, zip: '6524', barangay: 'Atabay', street: 'C.V. Alcuino Street' },
  { name: 'Hindang', province: 'Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.4333, lon: 124.7333, zip: '6523', barangay: 'Poblacion', street: 'National Highway' },
  { name: 'Inopacan', province: 'Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.5000, lon: 124.7500, zip: '6522', barangay: 'Poblacion', street: 'Cuatro Islas Wharf Road' },
  { name: 'Baybay City', province: 'Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.6767, lon: 124.8000, zip: '6521', barangay: 'Poblacion', street: 'VSU Campus Road / R. Magsaysay' },
  { name: 'Albuera', province: 'Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.9167, lon: 124.7000, zip: '6542', barangay: 'Mahayag', street: 'Ormoc-Baybay Highway' },
  { name: 'Ormoc City', province: 'Leyte', region: 'Eastern Visayas (Region VIII)', lat: 11.0050, lon: 124.6075, zip: '6541', barangay: 'MacArthur', street: 'Bonifacio Street' },
  { name: 'Merida', province: 'Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.9167, lon: 124.5333, zip: '6543', barangay: 'Poblacion', street: 'Coastal Highway' },
  { name: 'Isabel', province: 'Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.9333, lon: 124.4333, zip: '6544', barangay: 'Poblacion', street: 'PASAR Industrial Road' },
  { name: 'Palompon', province: 'Leyte', region: 'Eastern Visayas (Region VIII)', lat: 11.0500, lon: 124.3833, zip: '6538', barangay: 'Poblacion', street: 'Kalanggaman Wharf Road' },
  { name: 'Carigara', province: 'Leyte', region: 'Eastern Visayas (Region VIII)', lat: 11.3000, lon: 124.6833, zip: '6529', barangay: 'Poblacion', street: 'Ponong Street' },
  { name: 'Palo', province: 'Leyte', region: 'Eastern Visayas (Region VIII)', lat: 11.1600, lon: 124.9900, zip: '6501', barangay: 'Poblacion', street: 'MacArthur Park Boulevard' },
  { name: 'Tacloban City', province: 'Leyte', region: 'Eastern Visayas (Region VIII)', lat: 11.2433, lon: 125.0047, zip: '6500', barangay: 'Barangay 25', street: 'P. Zamora Street' },
  { name: 'Tanauan', province: 'Leyte', region: 'Eastern Visayas (Region VIII)', lat: 11.1167, lon: 125.0167, zip: '6502', barangay: 'Poblacion', street: 'San Vicente Street' },
  { name: 'Tolosa', province: 'Leyte', region: 'Eastern Visayas (Region VIII)', lat: 11.0667, lon: 125.0333, zip: '6503', barangay: 'Poblacion', street: 'National Highway' },
  { name: 'Dulag', province: 'Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.9500, lon: 125.0333, zip: '6505', barangay: 'Poblacion', street: 'Liberation Street' },
  { name: 'Mayorga', province: 'Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.8333, lon: 125.0000, zip: '6507', barangay: 'Poblacion', street: 'Maharlika Highway' },
  { name: 'MacArthur', province: 'Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.8000, lon: 124.9833, zip: '6509', barangay: 'Poblacion', street: 'National Highway' },
  { name: 'Abuyog', province: 'Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.7500, lon: 125.0167, zip: '6510', barangay: 'Poblacion', street: 'Roxas Street' },
  { name: 'Javier', province: 'Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.6000, lon: 124.9333, zip: '6511', barangay: 'Poblacion', street: 'Javier-Mahaplag Road' },
  { name: 'Mahaplag', province: 'Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.6000, lon: 124.8667, zip: '6512', barangay: 'Poblacion', street: 'Maharlika Highway' },
  { name: 'Matalom', province: 'Leyte', region: 'Eastern Visayas (Region VIII)', lat: 10.2833, lon: 124.7833, zip: '6526', barangay: 'Poblacion', street: 'Canigao Island Port Road' },

  // ── Biliran ──
  { name: 'Naval', province: 'Biliran', region: 'Eastern Visayas (Region VIII)', lat: 11.5500, lon: 124.4000, zip: '6543', barangay: 'Poblacion', street: 'Castin Street' },
  { name: 'Biliran', province: 'Biliran', region: 'Eastern Visayas (Region VIII)', lat: 11.4667, lon: 124.4833, zip: '6549', barangay: 'Poblacion', street: 'Biliran Bridge Road' },

  // ── Cebu ──
  { name: 'Cebu City', province: 'Cebu', region: 'Central Visayas (Region VII)', lat: 10.3157, lon: 123.8854, zip: '6000', barangay: 'Capitol Site', street: 'Osmeña Boulevard' },
  { name: 'Mandaue City', province: 'Cebu', region: 'Central Visayas (Region VII)', lat: 10.3333, lon: 123.9333, zip: '6014', barangay: 'Centro', street: 'A.C. Cortes Avenue' },
  { name: 'Lapu-Lapu City', province: 'Cebu', region: 'Central Visayas (Region VII)', lat: 10.3103, lon: 123.9494, zip: '6015', barangay: 'Poblacion', street: 'M.L. Quezon National Highway' },
  { name: 'Talisay City', province: 'Cebu', region: 'Central Visayas (Region VII)', lat: 10.2500, lon: 123.8500, zip: '6045', barangay: 'Poblacion', street: 'Cebu South Coastal Road' },
  { name: 'Bogo City', province: 'Cebu', region: 'Central Visayas (Region VII)', lat: 11.0500, lon: 124.0000, zip: '6010', barangay: 'Poblacion', street: 'R. Fernan Street' },

  // ── Bohol ──
  { name: 'Tagbilaran City', province: 'Bohol', region: 'Central Visayas (Region VII)', lat: 9.6500, lon: 123.8500, zip: '6300', barangay: 'Poblacion', street: 'Carlos P. Garcia Avenue' },
  { name: 'Panglao', province: 'Bohol', region: 'Central Visayas (Region VII)', lat: 9.5800, lon: 123.7500, zip: '6340', barangay: 'Tawala', street: 'Alona Beach Road' },
  { name: 'Tubigon', province: 'Bohol', region: 'Central Visayas (Region VII)', lat: 9.9500, lon: 123.9600, zip: '6329', barangay: 'Poblacion', street: 'Tubigon Port Road' },

  // ── NCR Manila ──
  { name: 'Manila', province: 'Metro Manila', region: 'National Capital Region (NCR)', lat: 14.5995, lon: 120.9842, zip: '1000', barangay: 'Ermita', street: 'Roxas Boulevard' },
  { name: 'Quezon City', province: 'Metro Manila', region: 'National Capital Region (NCR)', lat: 14.6760, lon: 121.0437, zip: '1100', barangay: 'Central', street: 'Elliptical Road' },
  { name: 'Makati City', province: 'Metro Manila', region: 'National Capital Region (NCR)', lat: 14.5547, lon: 121.0244, zip: '1200', barangay: 'Bel-Air', street: 'Ayala Avenue' },

  // ── Davao ──
  { name: 'Davao City', province: 'Davao del Sur', region: 'Davao Region (Region XI)', lat: 7.0731, lon: 125.6128, zip: '8000', barangay: 'Poblacion District', street: 'San Pedro Street' },

  // ── Iloilo ──
  { name: 'Iloilo City', province: 'Iloilo', region: 'Western Visayas (Region VI)', lat: 10.7202, lon: 122.5621, zip: '5000', barangay: 'City Proper', street: 'Calle Real / J.M. Basa' }
];

export function findNearestPhilippineAnchor(lat, lon) {
  let nearest = null;
  let minDist = Infinity;
  for (const m of PH_MUNICIPALITY_ANCHORS) {
    const dLat = lat - m.lat;
    const dLon = lon - m.lon;
    const distSq = dLat * dLat + dLon * dLon;
    if (distSq < minDist) {
      minDist = distSq;
      nearest = m;
    }
  }
  return nearest;
}

// Complete 82 Philippine Provinces -> Official PSGC Region Map (17 Regions + NCR + NIR)
const PH_PROVINCE_TO_REGION = {
  // NCR
  'metro manila': 'National Capital Region (NCR)',
  'metropolitan manila': 'National Capital Region (NCR)',
  'ncr': 'National Capital Region (NCR)',
  'manila': 'National Capital Region (NCR)',
  // CAR
  'abra': 'Cordillera Administrative Region (CAR)',
  'apayao': 'Cordillera Administrative Region (CAR)',
  'benguet': 'Cordillera Administrative Region (CAR)',
  'ifugao': 'Cordillera Administrative Region (CAR)',
  'kalinga': 'Cordillera Administrative Region (CAR)',
  'mountain province': 'Cordillera Administrative Region (CAR)',
  // Region I
  'ilocos norte': 'Region I (Ilocos Region)',
  'ilocos sur': 'Region I (Ilocos Region)',
  'la union': 'Region I (Ilocos Region)',
  'pangasinan': 'Region I (Ilocos Region)',
  // Region II
  'batanes': 'Region II (Cagayan Valley)',
  'cagayan': 'Region II (Cagayan Valley)',
  'isabela': 'Region II (Cagayan Valley)',
  'nueva vizcaya': 'Region II (Cagayan Valley)',
  'quirino': 'Region II (Cagayan Valley)',
  // Region III
  'aurora': 'Region III (Central Luzon)',
  'bataan': 'Region III (Central Luzon)',
  'bulacan': 'Region III (Central Luzon)',
  'nueva ecija': 'Region III (Central Luzon)',
  'pampanga': 'Region III (Central Luzon)',
  'tarlac': 'Region III (Central Luzon)',
  'zambales': 'Region III (Central Luzon)',
  // Region IV-A
  'batangas': 'Region IV-A (CALABARZON)',
  'cavite': 'Region IV-A (CALABARZON)',
  'laguna': 'Region IV-A (CALABARZON)',
  'quezon': 'Region IV-A (CALABARZON)',
  'rizal': 'Region IV-A (CALABARZON)',
  // MIMAROPA
  'marinduque': 'MIMAROPA Region',
  'occidental mindoro': 'MIMAROPA Region',
  'oriental mindoro': 'MIMAROPA Region',
  'palawan': 'MIMAROPA Region',
  'romblon': 'MIMAROPA Region',
  // Region V
  'albay': 'Region V (Bicol Region)',
  'camarines norte': 'Region V (Bicol Region)',
  'camarines sur': 'Region V (Bicol Region)',
  'catanduanes': 'Region V (Bicol Region)',
  'masbate': 'Region V (Bicol Region)',
  'sorsogon': 'Region V (Bicol Region)',
  // Region VI
  'aklan': 'Region VI (Western Visayas)',
  'antique': 'Region VI (Western Visayas)',
  'capiz': 'Region VI (Western Visayas)',
  'guimaras': 'Region VI (Western Visayas)',
  'iloilo': 'Region VI (Western Visayas)',
  // NIR
  'negros occidental': 'Negros Island Region (NIR)',
  'negros oriental': 'Negros Island Region (NIR)',
  'siquijor': 'Negros Island Region (NIR)',
  // Region VII
  'bohol': 'Region VII (Central Visayas)',
  'cebu': 'Region VII (Central Visayas)',
  // Region VIII
  'biliran': 'Region VIII (Eastern Visayas)',
  'eastern samar': 'Region VIII (Eastern Visayas)',
  'leyte': 'Region VIII (Eastern Visayas)',
  'northern samar': 'Region VIII (Eastern Visayas)',
  'samar': 'Region VIII (Eastern Visayas)',
  'western samar': 'Region VIII (Eastern Visayas)',
  'southern leyte': 'Region VIII (Eastern Visayas)',
  // Region IX
  'zamboanga del norte': 'Region IX (Zamboanga Peninsula)',
  'zamboanga del sur': 'Region IX (Zamboanga Peninsula)',
  'zamboanga sibugay': 'Region IX (Zamboanga Peninsula)',
  // Region X
  'bukidnon': 'Region X (Northern Mindanao)',
  'camiguin': 'Region X (Northern Mindanao)',
  'lanao del norte': 'Region X (Northern Mindanao)',
  'misamis occidental': 'Region X (Northern Mindanao)',
  'misamis oriental': 'Region X (Northern Mindanao)',
  // Region XI
  'davao de oro': 'Region XI (Davao Region)',
  'compostela valley': 'Region XI (Davao Region)',
  'davao del norte': 'Region XI (Davao Region)',
  'davao del sur': 'Region XI (Davao Region)',
  'davao occidental': 'Region XI (Davao Region)',
  'davao oriental': 'Region XI (Davao Region)',
  // Region XII
  'cotabato': 'Region XII (SOCCSKSARGEN)',
  'north cotabato': 'Region XII (SOCCSKSARGEN)',
  'sarangani': 'Region XII (SOCCSKSARGEN)',
  'south cotabato': 'Region XII (SOCCSKSARGEN)',
  'sultan kudarat': 'Region XII (SOCCSKSARGEN)',
  // Region XIII (Caraga)
  'agusan del norte': 'Region XIII (Caraga)',
  'agusan del sur': 'Region XIII (Caraga)',
  'dinagat islands': 'Region XIII (Caraga)',
  'surigao del norte': 'Region XIII (Caraga)',
  'surigao del sur': 'Region XIII (Caraga)',
  // BARMM
  'basilan': 'Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)',
  'lanao del sur': 'Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)',
  'maguindanao': 'Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)',
  'maguindanao del norte': 'Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)',
  'maguindanao del sur': 'Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)',
  'sulu': 'Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)',
  'tawi-tawi': 'Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)'
};

export function resolvePhilippineZip(city, province) {
  if (!city) return '';
  const c = String(city || '').toLowerCase().trim();
  const cClean = c.replace(/^city of\s+/i, '').replace(/\s+city$/i, '').trim();
  const p = String(province || '').toLowerCase().trim();

  // Disambiguate towns that exist in multiple provinces (e.g. Liloan, San Juan, San Fernando)
  if (p) {
    const disambig = `${cClean} (${p})`;
    if (PH_POSTAL_CODES[disambig]) return PH_POSTAL_CODES[disambig];
    if (cClean === 'liloan' && p.includes('cebu')) return '6002';
    if (cClean === 'liloan' && p.includes('southern leyte')) return '6612';
    if (cClean === 'san juan' && (p.includes('manila') || p.includes('ncr'))) return '1500';
    if (cClean === 'san juan' && p.includes('southern leyte')) return '6611';
    if (cClean === 'san fernando' && p.includes('pampanga')) return '2000';
    if (cClean === 'san fernando' && p.includes('cebu')) return '6018';
    if (cClean === 'san fernando' && p.includes('la union')) return '2500';
    if (cClean === 'naga' && p.includes('camarines sur')) return '4400';
    if (cClean === 'naga' && p.includes('cebu')) return '6037';
  }

  if (PH_POSTAL_CODES[c]) return PH_POSTAL_CODES[c];
  if (PH_POSTAL_CODES[cClean]) return PH_POSTAL_CODES[cClean];
  return '';
}

export function getRegionForProvinceName(provinceName) {
  if (!provinceName) return '';
  const p = String(provinceName).toLowerCase().replace(/^province of\s+/i, '').trim();
  if (PH_PROVINCE_TO_REGION[p]) return PH_PROVINCE_TO_REGION[p];
  // Match longest province key first so "southern leyte" wins over "leyte", "davao del sur" over "davao"
  const keys = Object.keys(PH_PROVINCE_TO_REGION).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (p.includes(k)) return PH_PROVINCE_TO_REGION[k];
  }
  return '';
}

// Official Barangay Registry for Philippine Municipalities (Priority: Southern Leyte & Eastern/Central Visayas)
export const PH_MUNICIPALITY_BARANGAYS = {
  'maasin city': [
    'Abgao', 'Acasia', 'Asuncion', 'Bactul I', 'Bactul II', 'Badiang', 'Bagtican', 'Basak', 'Bato I', 'Bato II',
    'Batuan', 'Baugo', 'Bilibol', 'Bogo', 'Cabadiangan', 'Cabulihan', 'Cagnituan', 'Cambooc', 'Cansirong', 'Canturing',
    'Canyuom', 'Combado', 'Dongon', 'Gawisan', 'Guadalupe', 'Hanginan', 'Hantag', 'Hinapu Daku', 'Hinapu Gamay', 'Ibarra',
    'Isagani', 'Laboon', 'Lanao', 'Lib-og', 'Libertad', 'Libhu', 'Lonoy', 'Lunas', 'Mahayahay', 'Malapoc Norte',
    'Malapoc Sur', 'Mambajao', 'Manhilo', 'Mantahan', 'Maria Clara', 'Matin-ao', 'Nasaug', 'Nati', 'Nonok Norte', 'Nonok Sur',
    'Panan-awan', 'Pansaan', 'Pasay', 'Pinascohan', 'Rizal', 'San Agustin', 'San Isidro', 'San Jose', 'San Rafael', 'Santa Cruz',
    'Santa Rosa', 'Santo Niño', 'Santo Rosario', 'Soro-soro', 'Tagnipa', 'Tam-is', 'Tawid', 'Tigbawan', 'Tomoy-tomoy', 'Tunga-tunga'
  ],
  'sogod': [
    'Zone I', 'Zone II', 'Zone III', 'Zone IV', 'Zone V',
    'Benit', 'Buac Daku', 'Buac Gamay', 'Cabadbaran', 'Concepcion', 'Consolacion', 'Dagsa', 'Hibunawan',
    'Hindangan', 'Hipgasan', 'Kahupian', 'Kanangkaan', 'Kauswagan', 'La Purisima Concepcion', 'Libas',
    'Lum-an', 'Mabicay', 'Mac', 'Magatas', 'Mahayahay', 'Malinao', 'Maria Plana', 'Milagroso', 'Pancho Villa',
    'Pandan', 'Rizal', 'San Francisco Mabuhay', 'San Isidro', 'San Jose', 'San Juan', 'San Miguel', 'San Pedro',
    'San Roque', 'San Vicente', 'Santa Cecilia', 'Santa Maria', 'Suba', 'Tampoong'
  ],
  'macrohon': [
    'Aguinaldo', 'Amparo', 'Buscayan', 'Cambaro', 'Canlusay', 'Flordeliz', 'Ichon', 'Ilihan', 'Laray',
    'Lower Villa', 'Mabini', 'Mohon', 'Molopolo', 'Poblacion', 'Rizal', 'Salvador', 'San Bernardo',
    'San Joaquin', 'San Roque', 'Santa Cruz', 'Santo Niño', 'Upper Villa'
  ],
  'malitbog': [
    'Abgao', 'Aurora', 'Benit', 'Ca-presan', 'Candatag', 'Cantamuac', 'Caraatan', 'Concepcion', 'Guerron',
    'Juangon', 'Kauswagan', 'Lambonao', 'Maningning', 'Mauhay', 'New Katipunan', 'Pancil', 'Pasil',
    'Poblacion', 'Sabang', 'San Antonio', 'San Jose', 'San Vicente', 'Sangahon', 'Santa Cruz', 'Santo Niño',
    'Tigbawan', 'Timba'
  ],
  'limasawa': [
    'Cabulihan', 'Lugsongan', 'Magallanes', 'San Agustin', 'San Bernardo', 'Triana'
  ],
  'bontoc': [
    'Bontoc Viejo', 'Cawayanan', 'Divisoria', 'Esperanza', 'Guinsangaan', 'Hibatunan', 'Hilaan', 'Himakilo',
    'Hitom-og', 'Lanao', 'Olango', 'Poblacion', 'Pamigsian', 'Sampao', 'San Ramon', 'San Vicente', 'Santa Cruz',
    'Santo Niño', 'Taa', 'Talisay', 'Union'
  ],
  'tomas oppus': [
    'Anislagon', 'Banday', 'Bogo', 'Cabascan', 'Camagtukan', 'Canlupao', 'Carnaga', 'Cawayan', 'Hinagtikan',
    'Hinapu', 'Luan', 'Ma-alngag', 'Mag-ata', 'Maslog', 'Poblacion', 'Punong', 'San Antonio', 'San Isidro',
    'San Miguel', 'San Roque', 'Tinago'
  ],
  'saint bernard': [
    'Atuyan', 'Ayahag', 'Bolodbolod', 'Cabac-an', 'Carnaga', 'Catmon', 'Guinsaugon', 'Hinatunan', 'Himbangan',
    'Kauswagan', 'Libas', 'Lipanto', 'Magatas', 'Mahayahay', 'Mahayag', 'Malinao', 'Manlico', 'Nueva Esperanza',
    'Panian', 'Poblacion', 'San Isidro', 'Santa Cruz', 'Santo Niño', 'Tabontabon', 'Tambis I', 'Tambis II'
  ],
  'liloan': [
    'Amaga', 'Bitu-on', 'Calian', 'Catig', 'Candayuman', 'Estela', 'Fatima', 'Gud-an', 'Guimbun-an',
    'Himay-angan', 'Ilag', 'Magaupas', 'Malangza', 'Molopolo', 'Panduran', 'Poblacion', 'Pres. Quezon',
    'Pres. Roxas', 'San Roque', 'San Vicente', 'Tabugon', 'Tambis'
  ],
  'san francisco': [
    'Anislagon', 'Bungtod', 'Central', 'Causwagan', 'Dakit', 'Gabi', 'Habay', 'Linongon', 'Marayag',
    'Napantao', 'Pinut-an', 'Poblacion', 'Punta', 'Santa Cruz', 'Santa Paz', 'Sudmon', 'Tuno', 'Ubos'
  ],
  'pintuyan': [
    'Batu', 'Bulawan', 'Canlawis', 'Catbawan', 'Manglit', 'Nueva Estrella', 'Poblacion Ibabao', 'Poblacion Ubos',
    'Ponod', 'San Roque', 'Santa Cruz', 'Tapon'
  ],
  'san ricardo': [
    'Benit', 'Bitoon', 'Cabutan', 'Camang', 'Esperanza', 'Kinachawa', 'Poblacion', 'Sa-re', 'San Antonio',
    'San Ramon', 'Timba'
  ],
  'san juan': [
    'Agay-ayan', 'Basak', 'Bobon A', 'Bobon B', 'Dayanog', 'Garrido', 'Minoyan', 'Osao', 'Pong-on',
    'San Jose', 'San Roque', 'Santa Cruz', 'Santo Niño', 'Somoje', 'Sudmon', 'Timba'
  ],
  'anahawan': [
    'Amagusan', 'Calintaan', 'Canlabian', 'Cogon', 'Kagingking', 'Lewing', 'Lo-ok', 'Mahalo', 'Mainit',
    'Manigawong', 'Poblacion', 'San Vicente', 'Tagup-an'
  ],
  'hinundayan': [
    'Amoglar', 'Anislagon', 'Baculod', 'Biasong', 'Bugho', 'Cabulisan', 'Central', 'Hubasan', 'Labrador',
    'Lungsodaan', 'Naval-an', 'Plaridel', 'Poblacion', 'Sag-od', 'San Roque', 'Santo Niño'
  ],
  'hinunangan': [
    'Ambacon', 'Badiangon', 'Bangcas A', 'Bangcas B', 'Biasong', 'Calag-itan', 'Canipaan', 'Catublian',
    'Ilag', 'Ingan', 'Labrador', 'Lumbog', 'Manlico', 'Nava', 'Nueva Esperanza', 'Otikon', 'Palale',
    'Panalaron', 'Patong', 'Poblacion', 'Pondol', 'Salog', 'San Isidro', 'Santo Niño', 'Talisay', 'Tuburan'
  ],
  'silago': [
    'Balagawan', 'Catmon', 'Hingatungan', 'Katipunan', 'Lagoma', 'Mercedes', 'Poblacion', 'Puntana',
    'Salvacion', 'San Bernardo', 'San Isidro', 'Sap-ang', 'Sudmon', 'Tuba-on', 'Tubod'
  ],
  'padre burgos': [
    'Buenavista', 'Bunga', 'Cantutang', 'Dinahugan', 'Lungsodaan', 'Poblacion', 'San Juan', 'Santa Sofia',
    'Santo Rosario', 'Tangkaan'
  ],
  'libagon': [
    'Biasong', 'Bogasong', 'Cawayan', 'Gakat', 'Jubas', 'Magallanes', 'Mayuga', 'Nahaong', 'Nahulid',
    'Otikon', 'Pangi', 'Poblacion', 'Punta', 'Talisay'
  ],
  'tacloban city': [
    'Poblacion', 'San Jose', 'Marasbaras', 'Abucay', 'Sagkahan', 'Caibaan', 'Utap', 'Apitong', 'Bagacay',
    'Diit', 'Suhi', 'Tagapuro', 'Cabalawan', 'V&G Subdivision', 'Naga-Naga', 'Santo Niño', 'Barangay 1', 'Barangay 2',
    'Barangay 25', 'Barangay 83', 'Barangay 88'
  ],
  'ormoc city': [
    'Poblacion', 'Cogon', 'Can-adieng', 'Linao', 'Tambulilid', 'Valencia', 'Camp Downes', 'San Pablo',
    'Ipil', 'Bantigue', 'Naungan', 'Alegria', 'Bagong Buhay', 'Cabintan', 'Concepcion', 'Dolores',
    'Don Felipe Larrazabal', 'Juaton', 'Licuma', 'Mabini', 'Macabug', 'Malbasag', 'Luna', 'San Jose', 'Sumangga'
  ],
  'baybay city': [
    'Zone 1', 'Zone 2', 'Zone 3', 'Zone 4', 'Zone 5', 'Pangangan', 'Pomponan', 'Gabu', 'Guadalupe',
    'Mailhi', 'Caridad', 'Plaridel', 'Punta', 'Bunga', 'Candadam', 'Hibunawan', 'Jaena', 'Kilim', 'Maybog', 'Poblacion'
  ],
  'cebu city': [
    'Capitol Site', 'Lahug', 'Mabolo', 'Guadalupe', 'Banilad', 'Talamban', 'Kasambagan', 'Zapatera',
    'Kamputhaw', 'Poblacion Pardo', 'Basak San Nicolas', 'Tisa', 'Labangon', 'Punta Princesa'
  ]
};

// Micro-anchors for precise barangay & road coordinates within Southern Leyte
export const PH_BARANGAY_MICRO_ANCHORS = [
  // Maasin City
  { city: 'Maasin City', barangay: 'Tunga-tunga', lat: 10.1333, lon: 124.8667, street: 'R. Kangleon Street' },
  { city: 'Maasin City', barangay: 'Abgao', lat: 10.1310, lon: 124.8620, street: 'Tomas Oppus Street' },
  { city: 'Maasin City', barangay: 'Mantahan', lat: 10.1380, lon: 124.8720, street: 'E. Quirino Street' },
  { city: 'Maasin City', barangay: 'Combado', lat: 10.1410, lon: 124.8770, street: 'Combado Coastal Road' },
  { city: 'Maasin City', barangay: 'Asuncion', lat: 10.1290, lon: 124.8640, street: 'Asuncion Barangay Road' },
  { city: 'Maasin City', barangay: 'Canturing', lat: 10.1240, lon: 124.8450, street: 'Canturing Coastal Highway' },
  { city: 'Maasin City', barangay: 'Mambajao', lat: 10.1180, lon: 124.8390, street: 'Mambajao Access Road' },
  { city: 'Maasin City', barangay: 'Guadalupe', lat: 10.1600, lon: 124.8600, street: 'Guadalupe Shrine Road' },
  { city: 'Maasin City', barangay: 'Ibarra', lat: 10.1460, lon: 124.8850, street: 'Ibarra Highway' },

  // Sogod
  { city: 'Sogod', barangay: 'Zone IV', lat: 10.3850, lon: 124.9818, street: 'Bagares Street' },
  { city: 'Sogod', barangay: 'Zone III', lat: 10.3864, lon: 124.9841, street: 'L. Regis Street' },
  { city: 'Sogod', barangay: 'Zone II', lat: 10.3840, lon: 124.9830, street: 'Concepcion Street' },
  { city: 'Sogod', barangay: 'Zone I', lat: 10.3830, lon: 124.9810, street: 'Osmeña Street' },
  { city: 'Sogod', barangay: 'Zone V', lat: 10.3880, lon: 124.9860, street: 'Rizal Street' },
  { city: 'Sogod', barangay: 'Suba', lat: 10.3810, lon: 124.9800, street: 'Suba Coastal Road' },
  { city: 'Sogod', barangay: 'Tampoong', lat: 10.3800, lon: 124.9850, street: 'Tampoong Wharf Road' },
  { city: 'Sogod', barangay: 'Consolacion', lat: 10.3950, lon: 124.9900, street: 'Maharlika Highway' },
  { city: 'Sogod', barangay: 'Kahupian', lat: 10.4300, lon: 124.9950, street: 'Pan-Philippine Highway (AH26)' },
  { city: 'Sogod', barangay: 'San Jose', lat: 10.3750, lon: 124.9700, street: 'San Jose Barangay Road' },

  // Macrohon
  { city: 'Macrohon', barangay: 'San Joaquin', lat: 10.0833, lon: 124.9333, street: 'San Joaquin Coastal Road' },
  { city: 'Macrohon', barangay: 'Poblacion', lat: 10.0750, lon: 124.9300, street: 'Rizal Street' },
  { city: 'Macrohon', barangay: 'Ichon', lat: 10.0650, lon: 124.9380, street: 'National Coastal Highway' },
  { city: 'Macrohon', barangay: 'Molopolo', lat: 10.0550, lon: 124.9450, street: 'Molopolo Beach Road' },

  // Limasawa
  { city: 'Limasawa', barangay: 'Magallanes', lat: 9.9328, lon: 125.0747, street: 'First Mass Shrine Road' },
  { city: 'Limasawa', barangay: 'Triana', lat: 9.9150, lon: 125.0600, street: 'Triana Ferry Port Road' },
  { city: 'Limasawa', barangay: 'Lugsongan', lat: 9.9250, lon: 125.0680, street: 'Limasawa Coastal Road' },

  // Saint Bernard
  { city: 'Saint Bernard', barangay: 'Manlico', lat: 10.2833, lon: 125.1333, street: 'Municipal Hall Access Road' },
  { city: 'Saint Bernard', barangay: 'Poblacion', lat: 10.2800, lon: 125.1300, street: 'National Highway' },
  { city: 'Saint Bernard', barangay: 'Guinsaugon', lat: 10.3100, lon: 125.1500, street: 'Memorial Park Access Road' },

  // Liloan
  { city: 'Liloan', barangay: 'Poblacion', lat: 10.1583, lon: 125.1281, street: 'Wawa Strait Bridge Road' },
  { city: 'Liloan', barangay: 'San Roque', lat: 10.1650, lon: 125.1350, street: 'Maharlika Highway' },
  { city: 'Liloan', barangay: 'Tabugon', lat: 10.1500, lon: 125.1200, street: 'Liloan Ferry Terminal Road' }
];

export function resolveAccurateBarangayAndStreet(rawAddress, dataName, city, province, lat, lon) {
  const a = rawAddress || {};
  const cityCleanLower = String(city || '').toLowerCase().replace(/^city of\s+/i, '').replace(/\s+city$/i, '').trim();
  const provCleanLower = String(province || '').toLowerCase().trim();
  const knownBarangays =
    PH_MUNICIPALITY_BARANGAYS[String(city || '').toLowerCase().trim()] ||
    PH_MUNICIPALITY_BARANGAYS[cityCleanLower] ||
    PH_MUNICIPALITY_BARANGAYS[`${cityCleanLower} city`] ||
    [];

  const rawCandidates = [
    a.quarter,
    a.suburb,
    a.village,
    a.neighbourhood,
    a.hamlet,
    a.subdistrict,
    a.city_district
  ]
    .filter(Boolean)
    .map((c) =>
      String(c)
        .trim()
        .replace(/^Zone\s+(\d+)$/i, (_, n) => {
          const num = parseInt(n, 10);
          const romans = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
          return `Zone ${romans[num] || num}`;
        })
    )
    .filter((c) => {
      const low = c.toLowerCase().replace(/^(brgy\.?|barangay)\s*/i, '').trim();
      if (!low || low.length < 2) return false;
      if (low === cityCleanLower || low === String(city || '').toLowerCase().trim()) return false;
      if (provCleanLower && low === provCleanLower) return false;
      if (/^(philippines|region\s+[ivx0-9]+)/i.test(low)) return false;
      return true;
    });

  let detectedBarangay = '';
  let usedIndex = -1;

  if (knownBarangays.length > 0) {
    const sortedKnown = [...knownBarangays].sort((x, y) => y.length - x.length);
    for (let i = 0; i < rawCandidates.length; i++) {
      const candClean = rawCandidates[i].toLowerCase().replace(/^(brgy\.?|barangay)\s*/i, '').trim();
      const matched = sortedKnown.find((b) => {
        const bLower = b.toLowerCase().replace(/\s*\(poblacion\)|\s*\(pob\.?\)/i, '').trim();
        return bLower === candClean;
      });
      if (matched) {
        detectedBarangay = matched;
        usedIndex = i;
        break;
      }
    }
  }

  if (!detectedBarangay && rawCandidates.length > 0) {
    const best = rawCandidates.find((c) => !/\b(congressional|legislative)\s+district\b/i.test(c)) || rawCandidates[0];
    detectedBarangay = best.replace(/^(brgy\.?|barangay)\s+/i, '').trim();
    usedIndex = rawCandidates.indexOf(best);
  }

  // NOTE: NEVER guess barangay from approximate lat/lon micro-anchors!
  if (/^zone\s+(\d+)$/i.test(detectedBarangay)) {
    const num = parseInt(detectedBarangay.replace(/\D/g, ''), 10);
    const roman = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][num] || num;
    detectedBarangay = `Zone ${roman}`;
  }

  const rawRoad = a.road || a.street || a.pedestrian || a.footway || a.path || a.residential || a.highway || '';
  let street = '';

  if (rawRoad) {
    street = a.house_number ? `${a.house_number} ${rawRoad}` : rawRoad;
  }

  if (!street) {
    for (let i = 0; i < rawCandidates.length; i++) {
      if (i === usedIndex) continue;
      const cand = rawCandidates[i];
      if (/^(purok|sitio)\b/i.test(cand)) {
        street = cand;
        break;
      }
    }
  }

  return { barangay: detectedBarangay, street };
}

export function resolvePhilippineGeo(lat, lon) {
  const numLat = typeof lat === 'number' ? lat : parseFloat(lat);
  const numLon = typeof lon === 'number' ? lon : parseFloat(lon);
  const anchor = findNearestPhilippineAnchor(numLat, numLon);
  const anchorDist = anchor ? Math.hypot(numLat - anchor.lat, numLon - anchor.lon) : Infinity;

  const useAnchor = Boolean(anchor && anchorDist <= 0.15);
  const prov = useAnchor ? anchor.province : '';
  const city = useAnchor ? anchor.name : '';
  const reg = prov ? getRegionForProvinceName(prov) : '';
  const zip = useAnchor ? (anchor.zip || resolvePhilippineZip(city, prov)) : '';

  // Offline mode NEVER fabricates barangay or street from rough lat/lon anchors
  const barangay = '';
  const street = '';

  const fullAddress = [city, prov, reg, zip, 'Philippines'].filter(Boolean).join(', ');

  return {
    street,
    barangay,
    city,
    province: prov,
    region: reg,
    country: 'Philippines',
    zip,
    landmark: '',
    fullAddress
  };
}
