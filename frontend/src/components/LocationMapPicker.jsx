import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';

// Fix default marker icon paths in Leaflet bundlers
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export default function LocationMapPicker({
  address = '',
  gps = '',
  onChangeAddress,
  onChangeGranularAddress,
  onChangeGps,
  readOnly = false,
  height = '240px',
  hideTip = false,
  hideSearch = false,
  searchTrigger = 0
}) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const markerRef = useRef(null);
  const [geocoding, setGeocoding] = useState(false);

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

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current) return;

    if (!mapRef.current) {
      const map = L.map(containerRef.current, {
        center: initialCoords,
        zoom: 13,
        zoomControl: true
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      const marker = L.marker(initialCoords, {
        icon: defaultIcon,
        draggable: !readOnly
      }).addTo(map);

      markerRef.current = marker;
      mapRef.current = map;

      // Ensure map tiles render properly after DOM container sizing
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      }, 100);
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      }, 500);

      // Handle map click
      // Handle map click
      if (!readOnly) {
        const updateFromReverseData = (data, formatted, lat, lng) => {
          isMapClickingRef.current = true;
          if (onChangeAddress) onChangeAddress(formatted);

          const addr = data?.address || data?.properties || {};
          // Street strictly extracts road/street/house_number/building/pedestrian/amenity (DO NOT use generic addr.name)
          let street = addr.road || addr.street || addr.house_number || addr.building || addr.pedestrian || addr.amenity || '';
          let city = addr.city || addr.town || addr.municipality || addr.city_district || addr.county || '';

          // Reordered Barangay Tag Priority: Suburb/Village/Quarter/Neighbourhood > District
          let barangay = addr.suburb || addr.village || addr.quarter || addr.neighbourhood || addr.hamlet || addr.subdistrict || '';
          if (!barangay && addr.district && addr.district.toLowerCase() !== city.toLowerCase()) {
            barangay = addr.district;
          }

          let province = addr.state || addr.region || addr.province || addr.state_district || '';
          let country = addr.country || 'Philippines';
          let zip = addr.postcode || addr.zip || addr.postal_code || '';

          if (formatted && formatted.includes(',')) {
            const parts = formatted.split(',').map(s => s.trim()).filter(Boolean);
            const numPart = parts.find(p => /^\d{4,6}$/.test(p));
            if (numPart && !zip) zip = numPart;

            const cleanParts = parts.filter(p => !/^\d{4,6}$/.test(p));
            const n = cleanParts.length;

            // Robust right-to-left (backwards) Philippine address parser:
            // [Street / Building, Barangay, Municipality / City, Province, Country]
            if (n >= 5) {
              if (!country) country = cleanParts[n - 1];
              if (!province) province = cleanParts[n - 2];
              if (!city) city = cleanParts[n - 3];
              if (!barangay) barangay = cleanParts[n - 4];
              if (!street) street = cleanParts.slice(0, n - 4).join(', ');
            } else if (n === 4) {
              if (!country) country = cleanParts[3];
              if (!province) province = cleanParts[2];
              if (!city) city = cleanParts[1];
              if (!barangay) barangay = cleanParts[0];
            } else if (n === 3) {
              if (!country) country = cleanParts[2];
              if (!province) province = cleanParts[1];
              if (!city) city = cleanParts[0];
            } else if (n === 2) {
              if (!province) province = cleanParts[1];
              if (!city) city = cleanParts[0];
            }
          }

          // Strict Duplicate Filtering to ensure Street, Barangay, and City never mirror each other
          if (street && barangay && street.trim().toLowerCase() === barangay.trim().toLowerCase()) {
            street = '';
          }
          if (street && city && street.trim().toLowerCase() === city.trim().toLowerCase()) {
            street = '';
          }
          if (barangay && city && barangay.trim().toLowerCase() === city.trim().toLowerCase()) {
            barangay = '';
          }

          if (onChangeGranularAddress) {
            onChangeGranularAddress({ street, barangay, city, province, country, zip, fullAddress: formatted });
          }
        };

        const performReverseGeocode = async (lat, lng) => {
          const latFormatted = lat.toFixed(4);
          const lngFormatted = lng.toFixed(4);
          const newGps = `${latFormatted}° N, ${lngFormatted}° E`;

          setGeocoding(true);

          // Priority 1: OpenStreetMap Nominatim zoom=18 for pinpoint Barangay resolution
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&zoom=18&lat=${lat}&lon=${lng}`);
            if (res.ok) {
              const data = await res.json();
              if (data && data.address) {
                updateFromReverseData(data, data.display_name, lat, lng);
                return;
              }
            }
          } catch (err) {
            console.warn('Nominatim reverse error:', err);
          }

          // Priority 2: Photon API Fallback
          try {
            const photonRes = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`);
            if (photonRes.ok) {
              const photonData = await photonRes.json();
              if (photonData?.features?.length > 0) {
                const props = photonData.features[0].properties;
                const formatted = [props.name, props.district, props.city, props.state, props.country].filter(Boolean).join(', ');
                updateFromReverseData({ properties: props }, formatted || `Selected Location (${newGps})`, lat, lng);
                return;
              }
            }
          } catch (e) {
            console.warn('Photon reverse error:', e);
          }

          // Fallback if both APIs fail
          updateFromReverseData({}, `Selected Pin (${newGps})`, lat, lng);
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

    return () => {
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
      mapRef.current.panTo(coords);
    }
  }, [gps]);

  // Forward Geocode Dual-Engine: Input -> Map Pin
  const handleAddressSearch = async (targetQuery) => {
    const searchQuery = targetQuery || address;
    if (!searchQuery || !searchQuery.trim() || readOnly) return;

    const queryStr = searchQuery.trim();
    setGeocoding(true);

    try {
      // Engine 1: Photon API Search (Fast, 0 Rate Limit)
      const photonRes = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(queryStr)}&limit=1`);
      if (photonRes.ok) {
        const photonData = await photonRes.json();
        if (photonData?.features?.length > 0) {
          const coords = photonData.features[0].geometry.coordinates; // [lon, lat]
          const lon = coords[0];
          const lat = coords[1];
          const latFormatted = lat.toFixed(4);
          const lngFormatted = lon.toFixed(4);
          const newGps = `${latFormatted}° N, ${lngFormatted}° E`;

          if (mapRef.current && markerRef.current) {
            markerRef.current.setLatLng([lat, lon]);
            mapRef.current.setView([lat, lon], 16);
          }

          if (onChangeGps) onChangeGps(newGps);
          setGeocoding(false);
          return;
        }
      }
    } catch (e) {
      console.warn('Photon search error:', e);
    }

    // Engine 2: Nominatim Progressive Fallback Loop
    let searchAttempts = [queryStr];
    if (queryStr.includes(',')) {
      const parts = queryStr.split(',').map(p => p.trim()).filter(Boolean);
      for (let i = 1; i < parts.length; i++) {
        const sub = parts.slice(i).join(', ');
        if (sub.length >= 3 && !searchAttempts.includes(sub)) {
          searchAttempts.push(sub);
        }
      }
    }

    try {
      let data = [];
      for (const attempt of searchAttempts) {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(attempt)}`);
          if (res.ok) {
            const resData = await res.json();
            if (resData && resData.length > 0) {
              data = resData;
              break;
            }
          }
        } catch (e) {
          console.warn('Nominatim attempt error:', e);
        }
      }

      if (data && data.length > 0) {
        const top = data[0];
        const lat = parseFloat(top.lat);
        const lon = parseFloat(top.lon);
        const latFormatted = lat.toFixed(4);
        const lngFormatted = lon.toFixed(4);
        const newGps = `${latFormatted}° N, ${lngFormatted}° E`;

        if (mapRef.current && markerRef.current) {
          markerRef.current.setLatLng([lat, lon]);
          mapRef.current.setView([lat, lon], 16);
        }

        if (onChangeGps) onChangeGps(newGps);
      }
    } catch (err) {
      console.warn('Geocoding error:', err);
    } finally {
      setGeocoding(false);
    }
  };

  const isMapClickingRef = useRef(false);
  const debounceTimerRef = useRef(null);

  // Auto-geocode address when user types in granular address fields (300ms instant debounce)
  useEffect(() => {
    if (readOnly || !address || !address.trim() || address.trim().length < 3) return;

    if (isMapClickingRef.current) {
      isMapClickingRef.current = false;
      return;
    }

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      handleAddressSearch(address);
    }, 300);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [address]);

  useEffect(() => {
    if (searchTrigger) {
      const targetQuery = typeof searchTrigger === 'object' ? searchTrigger.query : address;
      if (targetQuery && targetQuery.trim()) {
        handleAddressSearch(targetQuery);
      }
    }
  }, [searchTrigger]);

  return (
    <div style={{ width: '100%' }}>
      {!readOnly && !hideSearch && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type="text"
              className="input"
              placeholder="Search specific address or click anywhere on map below..."
              value={address}
              onChange={(e) => onChangeAddress && onChangeAddress(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddressSearch())}
              style={{ width: '100%', paddingRight: '36px', fontSize: '0.88rem' }}
            />
            {geocoding && (
              <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}>
                <div className="spinner spinner-light" style={{ width: '16px', height: '16px' }} />
              </div>
            )}
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleAddressSearch}
            disabled={geocoding}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>search</span> Find Location
          </button>
        </div>
      )}

      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: height && height !== '100%' ? height : '300px',
          minHeight: '300px',
          borderRadius: '12px',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          overflow: 'hidden',
          zIndex: 1
        }}
      />
      {!readOnly && !hideTip && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '0.75rem', color: '#94a3b8' }}>
          <span>💡 <strong>Tip:</strong> Click anywhere on the map or drag the pin to set exact location.</span>
          <span style={{ color: '#38bdf8', fontWeight: 600 }}>GPS: {gps || 'Not selected'}</span>
        </div>
      )}
    </div>
  );
}
