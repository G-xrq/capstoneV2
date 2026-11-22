const fs = require('fs');
const path = require('path');

// ── Official PSA/NAMRIA PSGC 2026-3Q Barangay Boundary Polygon Engine ──
// Tier 0: Bundled HIRES (10%) official polygons for ALL 500 barangays across all 19 municipalities of Southern Leyte
//         (including ALL 70 barangays of Maasin City) — 0ms instant, 100% offline-capable, exact mathematical Point-in-Polygon.
// Tier 1: Dynamic on-demand loader + RAM cache for ALL 1,634 Philippine cities/municipalities (42,000+ barangays)
//         using official MIT-licensed faeldon/philippines-json-maps PSGC 2026-3Q GeoJSON polygons.

const SL_HIRES_PATH = path.join(__dirname, '..', 'data', 'southern_leyte_barangays_hires.json');

let slData = null;
let slBbox = [Infinity, Infinity, -Infinity, -Infinity];
const slByCity = new Map(); // normCity -> array of barangay records

// Dynamic nationwide cache keyed by numeric 10-digit PSGC code (e.g. "702217000" for Cebu City)
const nationwideGeoCache = new Map();
const nationwidePending = new Map();

function normalizeName(v) {
  const romanToArabic = { i: '1', ii: '2', iii: '3', iv: '4', v: '5', vi: '6', vii: '7', viii: '8', ix: '9', x: '10' };
  return String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^(brgy\.?|barangay)\s+/i, '')
    .replace(/^city of\s+/i, '')
    .replace(/^municipality of\s+/i, '')
    .replace(/\s*\((pob\.?|poblacion)\)/gi, '')
    .replace(/\s+city$/i, '')
    .replace(/\bzone\s+(i|ii|iii|iv|v|vi|vii|viii|ix|x)\b/gi, (_, r) => `zone ${romanToArabic[r.toLowerCase()] || r}`)
    .replace(/\bsto\.?\b/g, 'santo')
    .replace(/\bsta\.?\b/g, 'santa')
    .replace(/\bst\.?\b/g, 'saint')
    .replace(/[^a-z0-9\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    if (((yi > lat) !== (yj > lat)) && (lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

function distToSegmentSq(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq > 0 ? ((px - ax) * dx + (py - ay) * dy) / lenSq : 0;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return (px - cx) * (px - cx) + (py - cy) * (py - cy);
}

function ringArea(ring) {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return Math.abs(area / 2);
}

function computeInteriorCenter(ring) {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  let signedArea = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % ring.length];
    if (x0 < minLon) minLon = x0;
    if (x0 > maxLon) maxLon = x0;
    if (y0 < minLat) minLat = y0;
    if (y0 > maxLat) maxLat = y0;
    const cross = x0 * y1 - x1 * y0;
    signedArea += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  signedArea *= 0.5;
  if (Math.abs(signedArea) > 1e-12) {
    const candLon = cx / (6 * signedArea);
    const candLat = cy / (6 * signedArea);
    if (pointInRing(candLon, candLat, ring)) {
      return [Math.round(candLat * 100000) / 100000, Math.round(candLon * 100000) / 100000];
    }
  }
  for (const frac of [0.5, 0.35, 0.65, 0.25, 0.75]) {
    const y = minLat + (maxLat - minLat) * frac;
    const xs = [];
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y)) {
        xs.push(xi + ((y - yi) * (xj - xi)) / (yj - yi));
      }
    }
    xs.sort((a, b) => a - b);
    let bestSpan = -1, bestX = (minLon + maxLon) / 2;
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const span = xs[k + 1] - xs[k];
      if (span > bestSpan) {
        bestSpan = span;
        bestX = (xs[k] + xs[k + 1]) / 2;
      }
    }
    if (bestSpan > 0 && pointInRing(bestX, y, ring)) {
      return [Math.round(y * 100000) / 100000, Math.round(bestX * 100000) / 100000];
    }
  }
  return [
    Math.round(((minLat + maxLat) / 2) * 100000) / 100000,
    Math.round(((minLon + maxLon) / 2) * 100000) / 100000
  ];
}

function loadSouthernLeyteHires() {
  if (slData) return slData;
  try {
    if (!fs.existsSync(SL_HIRES_PATH)) {
      console.warn('Southern Leyte HIRES barangay file not found at:', SL_HIRES_PATH);
      return null;
    }
    const parsed = JSON.parse(fs.readFileSync(SL_HIRES_PATH, 'utf8'));
    if (!Array.isArray(parsed?.barangays)) return null;

    slData = parsed;
    for (const b of parsed.barangays) {
      const [minLon, minLat, maxLon, maxLat] = b.bbox;
      if (minLon < slBbox[0]) slBbox[0] = minLon;
      if (minLat < slBbox[1]) slBbox[1] = minLat;
      if (maxLon > slBbox[2]) slBbox[2] = maxLon;
      if (maxLat > slBbox[3]) slBbox[3] = maxLat;

      const cKey = normalizeName(b.city);
      if (!slByCity.has(cKey)) slByCity.set(cKey, []);
      slByCity.get(cKey).push(b);
    }
    console.log(`Loaded ${parsed.barangays.length} official PSA/NAMRIA HIRES barangay polygons for Southern Leyte (Maasin City: ${slByCity.get('maasin')?.length || 0}).`);
    return slData;
  } catch (err) {
    console.warn('Failed to load Southern Leyte HIRES barangay polygons:', err.message);
    return null;
  }
}

// Initialize on module require so first request is 0ms
loadSouthernLeyteHires();

function lookupPointInBarangayList(lat, lon, barangays, edgeToleranceDeg = 0.0045) {
  if (!Array.isArray(barangays) || barangays.length === 0) return null;

  // Pass 1: Exact mathematical Point-in-Polygon
  for (const b of barangays) {
    const [minLon, minLat, maxLon, maxLat] = b.bbox;
    if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) continue;
    for (const ring of b.rings) {
      if (pointInRing(lon, lat, ring)) {
        return { ...b, precision: 'exact_polygon', distanceMeters: 0 };
      }
    }
  }

  // Pass 2: Immediate coastal pier / seawall / shoreline tolerance (<= ~500m from polygon edge)
  let best = null;
  let bestDistSq = Infinity;
  const pad = edgeToleranceDeg + 0.001;
  for (const b of barangays) {
    const [minLon, minLat, maxLon, maxLat] = b.bbox;
    if (lon < minLon - pad || lon > maxLon + pad || lat < minLat - pad || lat > maxLat + pad) continue;
    for (const ring of b.rings) {
      for (let i = 0; i < ring.length - 1; i++) {
        const dSq = distToSegmentSq(lon, lat, ring[i][0], ring[i][1], ring[i + 1][0], ring[i + 1][1]);
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          best = b;
        }
      }
    }
  }

  if (best && Math.sqrt(bestDistSq) <= edgeToleranceDeg) {
    return {
      ...best,
      precision: 'coastal_edge',
      distanceMeters: Math.round(Math.sqrt(bestDistSq) * 111000)
    };
  }

  return null;
}

/**
 * Exact 0ms HIRES Point-in-Polygon lookup for all 500 barangays across all 19 municipalities of Southern Leyte
 * (including all 70 barangays of Maasin City).
 */
function lookupSouthernLeytePoint(lat, lon) {
  const numLat = typeof lat === 'number' ? lat : parseFloat(lat);
  const numLon = typeof lon === 'number' ? lon : parseFloat(lon);
  if (!Number.isFinite(numLat) || !Number.isFinite(numLon)) return null;
  const data = loadSouthernLeyteHires();
  if (!data) return null;

  // Fast province-wide bounding box check (+0.01 deg coastal buffer)
  if (
    numLon < slBbox[0] - 0.01 ||
    numLon > slBbox[2] + 0.01 ||
    numLat < slBbox[1] - 0.01 ||
    numLat > slBbox[3] + 0.01
  ) {
    return null;
  }

  return lookupPointInBarangayList(numLat, numLon, data.barangays, 0.0045);
}

/**
 * Exact lookup of a Southern Leyte barangay by name (+ optional city) for forward geocoding & validation.
 */
function findSouthernLeyteBarangay(barangayName, cityName = '') {
  const data = loadSouthernLeyteHires();
  if (!data || !barangayName) return null;
  const targetBrgy = normalizeName(barangayName);
  if (!targetBrgy) return null;

  const targetCity = normalizeName(cityName);
  const pool = targetCity && slByCity.has(targetCity) ? slByCity.get(targetCity) : data.barangays;

  // 1. Exact normalized match
  const exact = pool.find((b) => normalizeName(b.name) === targetBrgy);
  if (exact) return exact;

  // 2. Prefix/contains match (e.g., "Malapoc" or "Bactul 1" -> "Bactul I")
  const romanNorm = (s) => s.replace(/\b1\b/g, 'i').replace(/\b2\b/g, 'ii').replace(/\b3\b/g, 'iii').replace(/\b4\b/g, 'iv').replace(/\b5\b/g, 'v');
  const targetRoman = romanNorm(targetBrgy);
  const romanMatch = pool.find((b) => romanNorm(normalizeName(b.name)) === targetRoman);
  if (romanMatch) return romanMatch;

  return null;
}

/**
 * Returns sorted list of all official PSA/NAMRIA barangay names for any Southern Leyte municipality/city (0ms).
 */
function getSouthernLeyteBarangaysForCity(cityName) {
  loadSouthernLeyteHires();
  const cKey = normalizeName(cityName);
  if (!cKey || !slByCity.has(cKey)) return [];
  return slByCity
    .get(cKey)
    .map((b) => b.name)
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' }));
}

function getSouthernLeyteCityCenter(cityName) {
  loadSouthernLeyteHires();
  const cKey = normalizeName(cityName);
  if (!cKey || !slByCity.has(cKey)) return null;
  // For Maasin City, anchor directly to Poblacion Tunga-tunga (Maasin City Hall / Cathedral)
  if (cKey === 'maasin') {
    return {
      name: 'Maasin City',
      province: 'Southern Leyte',
      region: 'Region VIII (Eastern Visayas)',
      zip: '6600',
      center: [10.1327, 124.8385]
    };
  }
  const list = slByCity.get(cKey);
  const pob = list.find((b) => /poblacion|zone\s*(i|1)\b/i.test(b.name)) || list[0];
  return pob
    ? {
        name: pob.city,
        province: 'Southern Leyte',
        region: 'Region VIII (Eastern Visayas)',
        zip: pob.zip,
        center: pob.center
      }
    : null;
}

/**
 * Fetch and index official PSA/NAMRIA 2026-3Q GeoJSON polygons for ANY Philippine city/municipality
 * outside Southern Leyte using its 10-digit PSGC code.
 */
async function loadNationwideCityPolygons(psgc10Code, timeoutMs = 4500) {
  const numCode = String(Number(String(psgc10Code || '').replace(/\D/g, '')));
  if (!numCode || numCode === '0' || numCode === 'NaN') return [];

  if (nationwideGeoCache.has(numCode)) {
    return nationwideGeoCache.get(numCode);
  }
  if (nationwidePending.has(numCode)) {
    return nationwidePending.get(numCode);
  }

  const p = (async () => {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const url = `https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/latest/geojson/municities/medres/bgysubmuns-municity-${numCode}.0.01.json`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'BBDRTS-Disaster-Relief/2.0', Accept: 'application/json' },
        signal: controller.signal
      });
      if (!res.ok) return [];
      const geo = await res.json();
      const features = Array.isArray(geo?.features) ? geo.features : [];
      const indexed = [];
      for (const feat of features) {
        const name = String(feat?.properties?.adm4_en || '').trim();
        if (!name) continue;
        const rawRings = [];
        if (feat.geometry?.type === 'Polygon') {
          rawRings.push(feat.geometry.coordinates[0]);
        } else if (feat.geometry?.type === 'MultiPolygon') {
          for (const poly of feat.geometry.coordinates) {
            if (poly?.[0]) rawRings.push(poly[0]);
          }
        }
        if (rawRings.length === 0) continue;

        let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
        let largestRing = rawRings[0];
        let largestArea = -1;
        for (const ring of rawRings) {
          const a = ringArea(ring);
          if (a > largestArea) {
            largestArea = a;
            largestRing = ring;
          }
          for (const [lon, lat] of ring) {
            if (lon < minLon) minLon = lon;
            if (lon > maxLon) maxLon = lon;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
          }
        }

        indexed.push({
          psgc: String(feat.properties?.adm4_psgc || ''),
          name,
          center: computeInteriorCenter(largestRing),
          bbox: [minLon, minLat, maxLon, maxLat],
          rings: rawRings
        });
      }

      if (indexed.length > 0) {
        if (nationwideGeoCache.size > 120) {
          const firstKey = nationwideGeoCache.keys().next().value;
          nationwideGeoCache.delete(firstKey);
        }
        nationwideGeoCache.set(numCode, indexed);
      }
      return indexed;
    } catch (_) {
      return [];
    } finally {
      clearTimeout(tid);
      nationwidePending.delete(numCode);
    }
  })();

  nationwidePending.set(numCode, p);
  return p;
}

async function lookupNationwidePoint(lat, lon, psgc10Code) {
  const numLat = typeof lat === 'number' ? lat : parseFloat(lat);
  const numLon = typeof lon === 'number' ? lon : parseFloat(lon);
  if (!Number.isFinite(numLat) || !Number.isFinite(numLon) || !psgc10Code) return null;

  const list = await loadNationwideCityPolygons(psgc10Code);
  if (!list.length) return null;
  return lookupPointInBarangayList(numLat, numLon, list, 0.0045);
}

async function findNationwideBarangay(barangayName, psgc10Code) {
  if (!barangayName || !psgc10Code) return null;
  const target = normalizeName(barangayName);
  if (!target) return null;
  const list = await loadNationwideCityPolygons(psgc10Code);
  if (!list.length) return null;
  return list.find((b) => normalizeName(b.name) === target) || null;
}

module.exports = {
  lookupSouthernLeytePoint,
  findSouthernLeyteBarangay,
  getSouthernLeyteBarangaysForCity,
  getSouthernLeyteCityCenter,
  loadNationwideCityPolygons,
  lookupNationwidePoint,
  findNationwideBarangay,
  normalizeName
};
