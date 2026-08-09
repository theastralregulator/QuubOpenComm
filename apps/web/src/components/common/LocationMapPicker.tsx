import React, { useEffect, useRef, useState } from 'react';
import { MapPin, X, Check, Navigation, AlertCircle } from 'lucide-react';
import L from 'leaflet';
import { isValidCoordinates, reportLocationTelemetry } from '../../lib/locationService';

interface LocationMapPickerProps {
  initialLat?: number;
  initialLng?: number;
  districtName?: string;
  stateName?: string;
  countryName?: string;
  countryCode?: string;
  onConfirm: (lat: number, lng: number) => void;
  onCancel: () => void;
}

// Fallback center coordinates for supported countries
const COUNTRY_FALLBACK_CENTERS: Record<string, [number, number]> = {
  IN: [20.5937, 78.9629],
  US: [37.0902, -95.7129],
  CA: [56.1304, -106.3468],
  GB: [55.3781, -3.4360],
  AE: [23.4241, 53.8478]
};

export default function LocationMapPicker({
  initialLat,
  initialLng,
  districtName,
  stateName,
  countryName,
  countryCode = 'IN',
  onConfirm,
  onCancel
}: LocationMapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Default initial coordinates priority
  const defaultCenter: [number, number] = isValidCoordinates(initialLat, initialLng)
    ? [initialLat!, initialLng!]
    : (COUNTRY_FALLBACK_CENTERS[countryCode.toUpperCase()] || [20.5937, 78.9629]);

  const defaultZoom = isValidCoordinates(initialLat, initialLng) ? 14 : 11;

  const [currentLat, setCurrentLat] = useState<number>(defaultCenter[0]);
  const [currentLng, setCurrentLng] = useState<number>(defaultCenter[1]);
  const [confirming, setConfirming] = useState(false);
  const [tileErrorNotice, setTileErrorNotice] = useState(false);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize Leaflet map instance
    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: defaultZoom,
      zoomControl: true,
      attributionControl: true
    });

    // OSM Tile Layer with mandatory attribution and sampled telemetry
    let reportedTileSuccess = false;
    let reportedTileError = false;

    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
    });

    tileLayer.on('tileload', () => {
      if (!reportedTileSuccess) {
        reportedTileSuccess = true;
        reportLocationTelemetry({
          service: 'osm_tiles',
          eventType: 'success',
          source: 'map_tiles'
        });
      }
    });

    tileLayer.on('tileerror', () => {
      setTileErrorNotice(true);
      if (!reportedTileError) {
        reportedTileError = true;
        reportLocationTelemetry({
          service: 'osm_tiles',
          eventType: 'tile_error',
          source: 'map_tiles'
        });
      }
    });

    tileLayer.addTo(map);

    mapInstanceRef.current = map;

    // Update coordinate badge on map pan/zoom
    const updateCenterCoords = () => {
      const center = map.getCenter();
      setCurrentLat(center.lat);
      setCurrentLng(center.lng);
    };

    map.on('moveend', updateCenterCoords);
    map.on('zoomend', updateCenterCoords);

    // Invalidate map size after render to fix Leaflet container sizing
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      map.off('moveend', updateCenterCoords);
      map.off('zoomend', updateCenterCoords);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  const handleConfirm = () => {
    setConfirming(true);
    onConfirm(currentLat, currentLng);
  };

  const contextTitle = [districtName, stateName, countryName].filter(Boolean).join(', ');

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 text-slate-900 dark:text-white animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-3xl flex flex-col h-[85vh] max-h-[700px] overflow-hidden">
        
        {/* Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-950/50">
          <div className="space-y-0.5">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>Choose Exact Location on Map</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate max-w-md">
              {contextTitle ? `Target Area: ${contextTitle}` : 'Move the map to place the pin on the exact location.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Map Viewport Area */}
        <div className="relative flex-1 bg-slate-100 dark:bg-slate-950 overflow-hidden">
          {/* Leaflet Container */}
          <div ref={mapContainerRef} className="w-full h-full z-10" />

          {/* Tile Error Notice */}
          {tileErrorNotice && (
            <div className="absolute top-3 left-3 z-20 px-3 py-1.5 bg-amber-900/90 backdrop-blur-md text-amber-100 rounded-xl text-xs font-semibold shadow-md flex items-center space-x-1.5 border border-amber-700/50">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Map tile service temporarily unavailable</span>
            </div>
          )}

          {/* Fixed Center Pin Overlay */}
          <div className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center">
            <div className="relative -translate-y-1/2 flex flex-col items-center">
              {/* Custom SVG Pin Icon */}
              <div className="relative drop-shadow-lg">
                <MapPin className="w-10 h-10 text-indigo-600 fill-indigo-500 stroke-white stroke-2" />
              </div>
              {/* Target Dot */}
              <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full border-2 border-white shadow-md -mt-1 animate-ping" />
              <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full border-2 border-white shadow-md -mt-2.5" />
            </div>
          </div>

          {/* Coordinate Badge Overlay */}
          <div className="absolute top-3 right-3 z-20 px-3 py-1.5 bg-slate-900/80 backdrop-blur-md text-white rounded-xl text-[10px] font-mono font-bold shadow-md flex items-center space-x-2 pointer-events-none">
            <Navigation className="w-3 h-3 text-indigo-400" />
            <span>{currentLat.toFixed(4)}, {currentLng.toFixed(4)}</span>
          </div>

          {/* Map Subtitle Helper Banner */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 px-4 py-2 bg-slate-900/90 backdrop-blur-md text-white rounded-full text-xs font-semibold shadow-lg text-center max-w-[90%] pointer-events-none border border-slate-700/50">
            <span>Drag map underneath pin to set exact work/home spot</span>
          </div>
        </div>

        {/* Sticky Action Bar */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>Coordinates will save exact map pin location</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              disabled={confirming}
              onClick={onCancel}
              className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold rounded-xl text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={confirming}
              onClick={handleConfirm}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer flex items-center space-x-1.5"
            >
              {confirming ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Confirming location...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Confirm Location</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
