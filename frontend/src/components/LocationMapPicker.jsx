import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import './DisasterRadarHeatmap.css';
import PH_PROVINCES from '../data/philippines_provinces.json';
import { API_URL } from '../config';
import { getRegionForProvince } from '../data/philippineGeoData';

// Point-in-polygon check for Philippine provinces
function pointInPolygon(point, vs) {
  const x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function findPhilippineProvince(lat, lon) {
  if (!PH_PROVINCES?.features) return null;
  // 1. Exact Point-in-polygon check
  for (const f of PH_PROVINCES.features) {
    const geom = f.geometry;
    if (geom.type === 'Polygon') {
      if (pointInPolygon([lon, lat], geom.coordinates[0])) {
        return { name: f.properties.name === 'Metropolitan Manila' ? 'Metro Manila' : f.properties.name, region: f.properties.region };
      }
    } else if (geom.type === 'MultiPolygon') {
      for (const poly of geom.coordinates) {
        if (pointInPolygon([lon, lat], poly[0])) {
          return { name: f.properties.name === 'Metropolitan Manila' ? 'Metro Manila' : f.properties.name, region: f.properties.region };
        }
      }
    }
  }

  // 2. Nearest Centroid Fallback (for coastal waters, bays, ports, shores, and rural offshore clicks)
  let closestProv = null;
  let minDistanceSq = Infinity;

  for (const f of PH_PROVINCES.features) {
    const geom = f.geometry;
    let ring = null;
    if (geom.type === 'Polygon') {
      ring = geom.coordinates[0];
    } else if (geom.type === 'MultiPolygon') {
      ring = geom.coordinates[0]?.[0];
    }
    if (!ring || ring.length === 0) continue;

    let sumLon = 0, sumLat = 0, count = 0;
    const step = Math.max(1, Math.floor(ring.length / 10));
    for (let i = 0; i < ring.length; i += step) {
      sumLon += ring[i][0];
      sumLat += ring[i][1];
      count++;
    }
    if (count === 0) continue;
    const cLon = sumLon / count;
    const cLat = sumLat / count;

    const dSq = (lat - cLat) * (lat - cLat) + (lon - cLon) * (lon - cLon);
    if (dSq < minDistanceSq) {
      minDistanceSq = dSq;
      closestProv = {
        name: f.properties.name === 'Metropolitan Manila' ? 'Metro Manila' : f.properties.name,
        region: f.properties.region
      };
    }
  }

  if (closestProv && lat >= 4.0 && lat <= 22.0 && lon >= 116.0 && lon <= 128.0) {
    return closestProv;
  }
  return closestProv;
}

// Classic Google Maps-Style Red Location Pin with Ground Contact Radar Beacon Pulse
const createRedLocationPinIcon = () => {
  return L.divIcon({
    className: 'bbdrts-red-map-pin',
    html: `
      <div style="position: relative; width: 44px; height: 50px; display: flex; align-items: flex-start; justify-content: center; cursor: grab; pointer-events: auto;">
        <!-- Pulsing Ground Radar Beacon Rings at the Needle Contact Point -->
        <div style="position: absolute; left: 50%; top: 42px; transform: translate(-50%, -50%); width: 36px; height: 20px; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 1;">
          <div class="pin-ground-ripple ripple-1"></div>
          <div class="pin-ground-ripple ripple-2"></div>
          <div class="pin-ground-anchor-dot"></div>
        </div>
        <!-- Canonical Curved Red Pin Body -->
        <div style="position: relative; width: 30px; height: 42px; z-index: 2; filter: drop-shadow(0 3px 6px rgba(0,0,0,0.38));">
          <svg width="30" height="42" viewBox="0 0 30 42" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 0C6.716 0 0 6.716 0 15c0 10.5 15 27 15 27s15-16.5 15-27c0-8.284-6.716-15-15-15z" fill="#EA4335" stroke="#B31412" stroke-width="0.8"/>
            <circle cx="15" cy="15" r="5" fill="#FFFFFF"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [44, 50],
    iconAnchor: [22, 42],
    popupAnchor: [0, -42]
  });
};

// Themed Leaflet divIcon with glowing pulse matching system accent
const createThemedMarkerIcon = (accent = '#22c55e') => {
  return L.divIcon({
    className: 'bbdrts-custom-map-pin',
    html: `
      <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; cursor: grab; transform: translate(-17px, -17px);">
        <div style="position: absolute; width: 32px; height: 32px; border-radius: 50%; background: ${accent}; opacity: 0.35; animation: pinPulseGlow 2s infinite ease-out;"></div>
        <div style="width: 20px; height: 20px; border-radius: 50%; background: ${accent}; border: 2.5px solid #ffffff; box-shadow: 0 0 14px ${accent}; display: flex; align-items: center; justify-content: center; z-index: 2;">
          <div style="width: 6px; height: 6px; border-radius: 50%; background: #ffffff;"></div>
        </div>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17]
  });
};

// Basemap configurations matching Philippine Relief Radar (0 API key requirement)
const BASEMAP_CONFIGS = {
  terrain: {
    name: 'Terrain',
    icon: 'terrain',
    url: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    maxZoom: 18,
    attribution: '&copy; Google'
  },
  satellite: {
    name: 'Satellite',
    icon: 'satellite_alt',
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    maxZoom: 20,
    attribution: '&copy; Google'
  },
  street: {
    name: 'Street',
    icon: 'map',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }
};

export default function LocationMapPicker({
  address = '',
  gps = '',
  onChangeAddress,
  onChangeGranularAddress,
  onChangeGps,
  onLocationFound,
  onSearchStatus,
  readOnly = false,
  height = '320px',
  hideTip = false,
  hideSearch = false,
  searchTrigger = 0,
  theme = 'dark',
  markerShape = 'redPin',
  defaultLayer = 'street'
}) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const markerRef = useRef(null);
  const tileLayerRef = useRef(null);
  const [activeMapLayer, setActiveMapLayer] = useState(defaultLayer);
  const [geocoding, setGeocoding] = useState(false);
  const [searchInput, setSearchInput] = useState(address || '');

  useEffect(() => {
    if (address) setSearchInput(address);
  }, [address]);

  // Parse default coordinates (Fallback: Maasin City, Southern Leyte: 10.1333, 124.8667)
  const parseCoords = (gpsStr) => {
    if (!gpsStr) return [10.1333, 124.8667];
    const match = gpsStr.match(/(-?\d+\.\d+).*?(-?\d+\.\d+)/);
    if (match) {
      return [parseFloat(match[1]), parseFloat(match[2])];
    }
    return [10.1333, 124.8667];
  };

  const initialCoords = parseCoords(gps);

  const getMarkerIcon = () => {
    if (markerShape === 'redPin' || markerShape === 'pin') {
      return createRedLocationPinIcon();
    }
    const accentColor = theme === 'cyber' ? '#00ffa3' : (theme === 'light' ? '#16a34a' : '#22c55e');
    return createThemedMarkerIcon(accentColor);
  };

  const handleSwitchLayer = (layerKey) => {
    if (!mapRef.current || !BASEMAP_CONFIGS[layerKey]) return;
    setActiveMapLayer(layerKey);
    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
    }
    const cfg = BASEMAP_CONFIGS[layerKey];
    const newTiles = L.tileLayer(cfg.url, {
      maxZoom: cfg.maxZoom,
      attribution: cfg.attribution,
      updateWhenIdle: true
    }).addTo(mapRef.current);
    tileLayerRef.current = newTiles;
  };

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current) return;

    if (!mapRef.current) {
      const map = L.map(containerRef.current, {
        center: initialCoords,
        zoom: 13,
        zoomControl: false,
        attributionControl: false
      });

      // Bottom-right zoom control matching Relief Radar
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Default to Street layer (or specified defaultLayer)
      const initialCfg = BASEMAP_CONFIGS[defaultLayer] || BASEMAP_CONFIGS['street'];
      const tiles = L.tileLayer(initialCfg.url, {
        maxZoom: initialCfg.maxZoom,
        attribution: initialCfg.attribution,
        updateWhenIdle: true
      }).addTo(map);
      tileLayerRef.current = tiles;

      const marker = L.marker(initialCoords, {
        icon: getMarkerIcon(),
        draggable: !readOnly
      }).addTo(map);

      markerRef.current = marker;
      mapRef.current = map;

      // Ensure map tiles render properly after DOM container sizing and stay centered on pin
      [100, 250, 500].forEach(delay => {
        setTimeout(() => {
          if (mapRef.current && markerRef.current) {
            mapRef.current.invalidateSize();
            const currentLatLng = markerRef.current.getLatLng();
            if (currentLatLng) {
              mapRef.current.setView(currentLatLng, mapRef.current.getZoom(), { animate: false });
            }
          }
        }, delay);
      });

      // Handle map click
      if (!readOnly) {
        const updateFromReverseData = (data, lat, lng) => {
          // If backend returned pre-parsed Philippine address, use it directly
          if (data?.parsed) {
            const p = data.parsed;
            const region = p.region || getRegionForProvince(p.province) || '';
            const formattedAddress = [p.street, p.barangay, p.city, p.province, region ? `(${region})` : '', p.zip, p.country || 'Philippines'].filter(Boolean).join(', ');
            if (onChangeAddress) {
              onChangeAddress(formattedAddress || data?.display_name || '');
            }
            if (onChangeGranularAddress) {
              onChangeGranularAddress({
                street: p.street || '',
                barangay: p.barangay || '',
                city: p.city || '',
                province: p.province || '',
                region: region,
                country: p.country || 'Philippines',
                zip: p.zip || '',
                landmark: p.landmark || '',
                fullAddress: formattedAddress
              });
            }
            return;
          }

          const a = data?.address || data?.properties || {};

          // 1. Street / Building / House No.
          const roadPart = a.road || a.street || a.pedestrian || a.footway || a.path || a.residential || a.highway || '';
          let street = '';
          if (a.house_number && roadPart) {
            street = `${a.house_number} ${roadPart}`;
          } else if (roadPart) {
            street = roadPart;
          } else if (a.building && a.building !== 'yes') {
            street = a.building;
          }

          // 2. Accurate Province resolution via Philippine boundary polygons
          const polyProvince = (lat != null && lng != null) ? findPhilippineProvince(lat, lng) : null;
          let province = polyProvince ? polyProvince.name : '';
          let region = polyProvince ? polyProvince.region : '';
          if (province === 'Metropolitan Manila') province = 'Metro Manila';

          if (!province) {
            const isRegion = /^(National Capital Region|Eastern Visayas|Central Visayas|Western Visayas|Ilocos Region|Cagayan Valley|Central Luzon|Calabarzon|Mimaropa|Bicol Region|Zamboanga Peninsula|Northern Mindanao|Davao Region|Soccsksargen|Caraga|BARMM|Bangsamoro|Cordillera)/i;
            if (a.province) province = a.province;
            else if (a.state && !isRegion.test(a.state)) province = a.state;
            else if (a.county && !/^(brgy|barangay|district|zone)/i.test(a.county)) province = a.county;
            else if (a.state) province = a.state;
            else if (a.region) province = a.region;
          }

          if (!region) {
            region = a.region || getRegionForProvince(province) || '';
          }

          // 3. Barangay (village, quarter, suburb, neighbourhood, hamlet, or county if it's a brgy)
          const bCandidates = [
            a.quarter,
            a.village,
            a.suburb,
            (a.county && /^(brgy|barangay|zone|poblacion)/i.test(a.county)) ? a.county : null,
            a.neighbourhood,
            a.hamlet,
            a.subdistrict
          ].filter(Boolean);

          let barangay = bCandidates.find(c => /^(brgy|barangay|poblacion|zone)/i.test(c)) || '';
          if (!barangay) {
            barangay = a.village || a.quarter || a.suburb || a.hamlet || a.neighbourhood || '';
            if (!barangay && a.county && a.county.toLowerCase() !== province.toLowerCase()) {
              barangay = a.county;
            }
          }

          // If street is empty but there is a neighbourhood/hamlet different from barangay
          if (!street && (a.neighbourhood || a.hamlet) && (a.neighbourhood || a.hamlet).toLowerCase() !== barangay.toLowerCase()) {
            street = a.neighbourhood || a.hamlet || '';
          }

          // 4. Municipality / City
          let city = a.city || a.town || a.municipality || '';
          if (!city && a.city_district && a.city_district.toLowerCase() !== barangay.toLowerCase()) {
            city = a.city_district;
          }

          // 5. Postal Code
          let zip = a.postcode || a.zip || a.postal_code || '';

          // 6. Country
          let country = a.country || 'Philippines';

          // Prevent exact duplicates
          if (street && barangay && street.trim().toLowerCase() === barangay.trim().toLowerCase()) {
            street = '';
          }
          if (barangay && city && barangay.trim().toLowerCase() === city.trim().toLowerCase()) {
            const alt = bCandidates.find(c => c.toLowerCase() !== city.toLowerCase());
            barangay = alt || '';
          }

          // 7. Landmark suggestion
          let landmark = '';
          if (a.amenity || a.historic || a.leisure || a.tourism || a.office || a.shop) {
            landmark = a.name || a.amenity || a.tourism || a.leisure || a.historic || a.office || a.shop || '';
          } else if (data.name && data.name !== roadPart && data.name !== barangay && data.name !== city && data.name !== province) {
            landmark = data.name;
          }

          const formattedAddress = [street, barangay, city, province, region ? `(${region})` : '', zip, country].filter(Boolean).join(', ');

          if (onChangeAddress) {
            onChangeAddress(formattedAddress || data?.display_name || '');
          }

          if (onChangeGranularAddress) {
            onChangeGranularAddress({
              street,
              barangay,
              city,
              province,
              region,
              country,
              zip,
              landmark,
              fullAddress: formattedAddress
            });
          }
        };

        const performReverseGeocode = async (lat, lng) => {
          const latFormatted = lat.toFixed(4);
          const lngFormatted = lng.toFixed(4);
          const newGps = `${latFormatted}° N, ${lngFormatted}° E`;

          setGeocoding(true);

          // Priority 1: Backend proxy (/api/geocode/reverse) - fast, resilient, zero-CORS, polygon-augmented
          try {
            const res = await fetch(`${API_URL}/api/geocode/reverse?lat=${lat}&lon=${lng}`);
            if (res.ok) {
              const data = await res.json();
              if (data && (data.parsed || data.address || data.display_name)) {
                updateFromReverseData(data, lat, lng);
                setGeocoding(false);
                return;
              }
            }
          } catch (e) {
            // continue
          }

          // Priority 2: Direct Nominatim with zoom=18 (precise) then zoom=14 (admin level)
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&zoom=18&lat=${lat}&lon=${lng}`);
            if (res.ok) {
              const data = await res.json();
              if (data && (data.address || data.display_name)) {
                updateFromReverseData(data, lat, lng);
                setGeocoding(false);
                return;
              }
            }
          } catch (err) {
            console.warn('Nominatim reverse zoom 18 error:', err);
          }

          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&zoom=14&lat=${lat}&lon=${lng}`);
            if (res.ok) {
              const data = await res.json();
              if (data && (data.address || data.display_name)) {
                updateFromReverseData(data, lat, lng);
                setGeocoding(false);
                return;
              }
            }
          } catch (err) {
            console.warn('Nominatim reverse zoom 14 error:', err);
          }

          // Priority 3: Photon API
          try {
            const photonRes = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`);
            if (photonRes.ok) {
              const photonData = await photonRes.json();
              if (photonData?.features?.length > 0) {
                const props = photonData.features[0].properties;
                updateFromReverseData({
                  address: {
                    road: props.street || props.name || '',
                    city: props.city || '',
                    county: props.district || '',
                    state: props.state || '',
                    country: props.country || 'Philippines',
                    postcode: props.postcode || ''
                  },
                  display_name: [props.name, props.city, props.state, props.country].filter(Boolean).join(', ')
                }, lat, lng);
                setGeocoding(false);
                return;
              }
            }
          } catch (e) {
            console.warn('Photon reverse error:', e);
          }

          // Fallback if all fail: use offline Philippine boundary polygon with nearest centroid
          const polyFallback = findPhilippineProvince(lat, lng);
          const provFallback = polyFallback ? (polyFallback.name === 'Metropolitan Manila' ? 'Metro Manila' : polyFallback.name) : '';
          const regFallback = polyFallback ? polyFallback.region : (getRegionForProvince(provFallback) || '');
          updateFromReverseData({
            parsed: {
              street: '',
              barangay: '',
              city: '',
              province: provFallback,
              region: regFallback,
              country: 'Philippines',
              zip: '',
              landmark: ''
            },
            display_name: provFallback ? `${provFallback}, Philippines (${newGps})` : `Selected Location (${newGps})`
          }, lat, lng);
          setGeocoding(false);
        };

        map.on('click', (e) => {
          const { lat, lng } = e.latlng;
          marker.setLatLng([lat, lng]);
          map.panTo([lat, lng]);

          const latFormatted = lat.toFixed(4);
          const lngFormatted = lng.toFixed(4);
          if (onChangeGps) onChangeGps(`${latFormatted}° N, ${lngFormatted}° E`);

          performReverseGeocode(lat, lng);
        });

        marker.on('dragend', (e) => {
          const { lat, lng } = e.target.getLatLng();
          const latFormatted = lat.toFixed(4);
          const lngFormatted = lng.toFixed(4);
          if (onChangeGps) onChangeGps(`${latFormatted}° N, ${lngFormatted}° E`);

          performReverseGeocode(lat, lng);
        });
      }
    }

    let resizeObserver = null;
    if (containerRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        if (mapRef.current && markerRef.current) {
          mapRef.current.invalidateSize();
          const currentLatLng = markerRef.current.getLatLng();
          if (currentLatLng) {
            mapRef.current.setView(currentLatLng, mapRef.current.getZoom(), { animate: false });
          }
        }
      });
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update map when GPS prop changes externally
  useEffect(() => {
    if (mapRef.current && markerRef.current && gps) {
      const coords = parseCoords(gps);
      markerRef.current.setLatLng(coords);
      mapRef.current.setView(coords, mapRef.current.getZoom(), { animate: false });
    }
  }, [gps]);

  // Forward Geocode: Input -> Map Pin
  const handleAddressSearch = async (targetQuery) => {
    const isObj = targetQuery && typeof targetQuery === 'object';
    const structured = isObj ? targetQuery.structured : null;
    const rawQuery = (isObj ? targetQuery.query : targetQuery) || searchInput || address;

    let cleanQuery = (rawQuery || '').replace(/\(Landmark:[^)]*\)/gi, '').replace(/\s+/g, ' ').trim();

    if (!cleanQuery && !structured?.city && !structured?.province) return;

    setGeocoding(true);

    const applyResult = (lat, lon, top) => {
      const latFormatted = lat.toFixed(4);
      const lngFormatted = lon.toFixed(4);
      const newGps = `${latFormatted}° N, ${lngFormatted}° E`;

      if (mapRef.current && markerRef.current) {
        markerRef.current.setLatLng([lat, lon]);
        mapRef.current.setView([lat, lon], 16);
      }

      if (onChangeGps) onChangeGps(newGps);
      if (onChangeAddress && top?.display_name) {
        onChangeAddress(top.display_name);
      }
    };

    // Priority 1: Structured backend proxy search
    if (structured && (structured.city || structured.province || structured.state || structured.barangay || structured.street)) {
      try {
        const params = new URLSearchParams();
        if (structured.city) params.set('city', structured.city.trim());
        if (structured.province || structured.state) params.set('state', (structured.province || structured.state).trim());
        if (structured.barangay) params.set('barangay', structured.barangay.trim());
        if (structured.street) params.set('street', structured.street.trim());
        if (structured.country) params.set('country', structured.country.trim());
        if (cleanQuery) params.set('q', cleanQuery);

        const res = await fetch(`http://localhost:3001/api/geocode/search?${params.toString()}`);
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0) {
            const top = list[0];
            applyResult(parseFloat(top.lat), parseFloat(top.lon), top);
            if (onLocationFound) onLocationFound(top, { lat: parseFloat(top.lat), lon: parseFloat(top.lon) });
            if (onSearchStatus) onSearchStatus({ success: true, result: top });
            setGeocoding(false);
            return;
          }
        }
      } catch (e) {
        // continue
      }
    }

    // Priority 2: Freeform candidate queries
    const queryParts = cleanQuery.split(',').map(s => s.trim()).filter(Boolean);
    const searchQueries = [cleanQuery];
    if (queryParts.length >= 3) {
      searchQueries.push(queryParts.slice(1).join(', '));
      searchQueries.push(queryParts.slice(-2).join(', '));
    } else if (queryParts.length === 2) {
      searchQueries.push(queryParts.join(', '));
    }

    for (const q of searchQueries) {
      try {
        const res = await fetch(`http://localhost:3001/api/geocode/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0) {
            const top = list[0];
            applyResult(parseFloat(top.lat), parseFloat(top.lon), top);
            if (onLocationFound) onLocationFound(top, { lat: parseFloat(top.lat), lon: parseFloat(top.lon) });
            if (onSearchStatus) onSearchStatus({ success: true, result: top });
            setGeocoding(false);
            return;
          }
        }
      } catch (e) {
        // continue
      }

      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=ph&limit=1&q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0) {
            const top = list[0];
            applyResult(parseFloat(top.lat), parseFloat(top.lon), top);
            if (onLocationFound) onLocationFound(top, { lat: parseFloat(top.lat), lon: parseFloat(top.lon) });
            if (onSearchStatus) onSearchStatus({ success: true, result: top });
            setGeocoding(false);
            return;
          }
        }
      } catch (e) {
        // continue
      }
    }

    if (onSearchStatus) onSearchStatus({ success: false, query: cleanQuery });
    setGeocoding(false);
  };

  useEffect(() => {
    if (searchTrigger) {
      handleAddressSearch(searchTrigger);
    }
  }, [searchTrigger]);

  // Live theme / markerShape listener: switch marker icon seamlessly
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    markerRef.current.setIcon(getMarkerIcon());
  }, [theme, markerShape]);

  return (
    <div style={{ width: '100%', height: height || '100%', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        .bbdrts-red-map-pin {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }
        .pin-ground-ripple {
          position: absolute;
          width: 26px;
          height: 12px;
          border-radius: 50%;
          border: 1.5px solid #EA4335;
          background: rgba(234, 67, 53, 0.16);
          animation: groundRipplePulse 2s cubic-bezier(0.2, 0.9, 0.4, 1) infinite;
          pointer-events: none;
        }
        .pin-ground-ripple.ripple-2 {
          animation-delay: 0.9s;
        }
        .pin-ground-anchor-dot {
          position: absolute;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #EA4335;
          border: 1px solid #ffffff;
          box-shadow: 0 0 6px #EA4335;
          pointer-events: none;
        }
        @keyframes groundRipplePulse {
          0% {
            transform: scale(0.2);
            opacity: 0.95;
          }
          65% {
            transform: scale(1.6);
            opacity: 0.3;
          }
          100% {
            transform: scale(2.4);
            opacity: 0;
          }
        }
        @keyframes pinPulseGlow {
          0% { transform: scale(0.6); opacity: 0.9; }
          70% { transform: scale(2.2); opacity: 0; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        .leaflet-control-zoom,
        .leaflet-bar {
          border: 1px solid rgba(255, 255, 255, 0.12) !important;
          border-radius: 8px !important;
          overflow: hidden !important;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5) !important;
          background: transparent !important;
        }
        .leaflet-control-zoom a,
        .leaflet-bar a {
          background-color: var(--bg-card, #16181e) !important;
          color: var(--text-primary, #ffffff) !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
          width: 30px !important;
          height: 30px !important;
          line-height: 30px !important;
          font-size: 15px !important;
          opacity: 1 !important;
          visibility: visible !important;
          transition: all 0.15s ease !important;
        }
        .leaflet-control-zoom a:last-child,
        .leaflet-bar a:last-child {
          border-bottom: none !important;
        }
        .leaflet-control-zoom a:hover,
        .leaflet-bar a:hover {
          background-color: var(--accent, #22c55e) !important;
          color: #05070a !important;
          opacity: 1 !important;
          visibility: visible !important;
        }
        [data-theme="light"] .leaflet-control-zoom,
        [data-theme="light"] .leaflet-bar {
          border: 1px solid rgba(0, 0, 0, 0.12) !important;
        }
        [data-theme="light"] .leaflet-control-zoom a,
        [data-theme="light"] .leaflet-bar a {
          background-color: #ffffff !important;
          color: #1e293b !important;
          border-bottom: 1px solid rgba(0, 0, 0, 0.08) !important;
        }
        [data-theme="light"] .leaflet-control-zoom a:hover,
        [data-theme="light"] .leaflet-bar a:hover {
          background-color: #16a34a !important;
          color: #ffffff !important;
        }
      `}</style>
      {!readOnly && !hideSearch && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <span
              className="material-symbols-outlined"
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '18px',
                color: 'var(--text-muted)'
              }}
            >
              search
            </span>
            <input
              type="text"
              className="input"
              placeholder="Search municipality, barangay, or landmark (e.g., Maasin City, Southern Leyte)..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddressSearch(searchInput))}
              style={{ width: '100%', paddingLeft: '38px', paddingRight: '36px', fontSize: '0.88rem' }}
            />
            {geocoding && (
              <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}>
                <div className="spinner spinner-light" style={{ width: '16px', height: '16px' }} />
              </div>
            )}
          </div>
          <button
            type="button"
            className="btn"
            onClick={() => handleAddressSearch(searchInput)}
            disabled={geocoding}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.82rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              background: '#ffffff',
              color: '#0f172a',
              border: '1.5px solid #cbd5e1',
              boxShadow: '0 1px 4px rgba(0,0,0,0.1)'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: '#16a34a' }}>explore</span> Find Location
          </button>
        </div>
      )}

      <div
        style={{
          position: 'relative',
          width: '100%',
          flex: 1,
          height: height || '100%',
          minHeight: height || '320px',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid var(--border)'
        }}
      >
        <div
          ref={containerRef}
          style={{
            width: '100%',
            height: '100%',
            minHeight: height || '320px',
            zIndex: 1
          }}
        />

        {/* Floating Basemap Selector: Terrain (default), Satellite, Street */}
        {!readOnly && (
          <div
            className="radar-floating-basemap-control"
            style={{
              position: 'absolute',
              bottom: '14px',
              right: '54px',
              zIndex: 10
            }}
          >
          <div className="floating-basemap-pill-group">
            <button
              type="button"
              className={`floating-basemap-btn ${activeMapLayer === 'terrain' ? 'active' : ''}`}
              onClick={() => handleSwitchLayer('terrain')}
              title="Terrain Topography (Default)"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>terrain</span>
              <span>Terrain</span>
            </button>
            <button
              type="button"
              className={`floating-basemap-btn ${activeMapLayer === 'satellite' ? 'active' : ''}`}
              onClick={() => handleSwitchLayer('satellite')}
              title="Satellite Photography"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>satellite_alt</span>
              <span>Satellite</span>
            </button>
            <button
              type="button"
              className={`floating-basemap-btn ${activeMapLayer === 'street' ? 'active' : ''}`}
              onClick={() => handleSwitchLayer('street')}
              title="Street Map"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>map</span>
              <span>Street</span>
            </button>
          </div>
        </div>
        )}
      </div>
      {!readOnly && !hideTip && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)' }}>
          <span>💡 <strong>Tip:</strong> Click anywhere on the map or drag the pin to set exact location.</span>
          <span style={{ color: 'var(--accent, #22c55e)', fontWeight: 700, background: 'var(--accent-dim, rgba(34,197,94,0.12))', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--accent-glow, rgba(34,197,94,0.25))' }}>
            GPS: {gps || 'Not selected'}
          </span>
        </div>
      )}
    </div>
  );
}
