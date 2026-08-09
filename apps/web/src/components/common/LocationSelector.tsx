import React, { useState, useEffect } from 'react';
import { MapPin, Search, ChevronDown, Check, RefreshCw, AlertCircle, X, Globe, Building2, Map } from 'lucide-react';
import { COUNTRIES_DATA } from '../../lib/locationsData';
import {
  LocationData,
  getRegionsForCountry,
  isValidCoordinates,
  formatLocationSummary,
  searchDistricts,
  reverseGeocodeLocation,
  DistrictSearchResult
} from '../../lib/locationService';
import LocationMapPicker from './LocationMapPicker';

export type { LocationData };

interface LocationSelectorProps {
  value?: Partial<LocationData>;
  onChange: (data: LocationData) => void;
  className?: string;
  label?: string;
}

export default function LocationSelector({
  value = {},
  onChange,
  className = '',
  label = 'Your Location'
}: LocationSelectorProps) {
  // Current persistent values
  const [country, setCountry] = useState(value.country || 'India');
  const [countryCode, setCountryCode] = useState(value.country_code || 'IN');
  const [state, setState] = useState(value.state || '');
  const [stateCode, setStateCode] = useState(value.state_code || '');
  const [district, setDistrict] = useState(value.district || '');
  const [city, setCity] = useState(value.city || '');
  const [latitude, setLatitude] = useState<number | undefined>(value.latitude);
  const [longitude, setLongitude] = useState<number | undefined>(value.longitude);

  // UX & Modal States
  const [manualExpanded, setManualExpanded] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [boundaryWarning, setBoundaryWarning] = useState<string | null>(null);
  const [pendingLocationData, setPendingLocationData] = useState<LocationData | null>(null);
  const [providerUnavailable, setProviderUnavailable] = useState(false);

  // Dedicated District Search State
  const [districtQuery, setDistrictQuery] = useState('');
  const [searchingDistricts, setSearchingDistricts] = useState(false);
  const [districtResults, setDistrictResults] = useState<DistrictSearchResult[]>([]);
  const [districtSearchHasRun, setDistrictSearchHasRun] = useState(false);
  const [showDistrictDropdown, setShowDistrictDropdown] = useState(false);

  // Dropdown UI states
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [showStateDropdown, setShowStateDropdown] = useState(false);

  // Sync props
  useEffect(() => {
    if (value.country) setCountry(value.country);
    if (value.country_code) setCountryCode(value.country_code);
    if (value.state !== undefined) setState(value.state || '');
    if (value.state_code !== undefined) setStateCode(value.state_code || '');
    if (value.district !== undefined) setDistrict(value.district || '');
    if (value.city !== undefined) setCity(value.city || '');
    if (value.latitude !== undefined) setLatitude(value.latitude);
    if (value.longitude !== undefined) setLongitude(value.longitude);
  }, [value.country, value.state, value.city, value.district, value.latitude, value.longitude]);

  // Emit normalized updates
  const notifyChange = (updated: LocationData) => {
    setCountry(updated.country);
    setCountryCode(updated.country_code);
    setState(updated.state);
    setStateCode(updated.state_code);
    setDistrict(updated.district);
    setCity(updated.city);
    setLatitude(updated.latitude);
    setLongitude(updated.longitude);
    setBoundaryWarning(null);
    setPendingLocationData(null);
    setProviderUnavailable(false);
    onChange(updated);
  };

  // Country change resets full hierarchy
  const handleCountryChange = (cName: string, cCode: string) => {
    const updated: LocationData = {
      country: cName,
      country_code: cCode,
      state: '',
      state_code: '',
      district: '',
      city: '',
      latitude: undefined,
      longitude: undefined
    };
    setShowCountryDropdown(false);
    setShowStateDropdown(false);
    setShowDistrictDropdown(false);
    setDistrictQuery('');
    setDistrictResults([]);
    setDistrictSearchHasRun(false);
    notifyChange(updated);
  };

  // State change resets district & locality
  const handleStateChange = (sName: string, sCode: string) => {
    const updated: LocationData = {
      country,
      country_code: countryCode,
      state: sName,
      state_code: sCode,
      district: '',
      city: '',
      latitude: undefined,
      longitude: undefined
    };
    setShowStateDropdown(false);
    setShowDistrictDropdown(false);
    setDistrictQuery('');
    setDistrictResults([]);
    setDistrictSearchHasRun(false);
    notifyChange(updated);
  };

  // District selection handler
  const handleSelectDistrictResult = (res: DistrictSearchResult) => {
    const updated: LocationData = {
      country: res.data.country || country,
      country_code: res.data.country_code || countryCode,
      state: res.data.state || state,
      state_code: res.data.state_code || stateCode,
      district: res.data.district,
      city: '',
      latitude: res.data.latitude,
      longitude: res.data.longitude
    };
    setShowDistrictDropdown(false);
    setDistrictQuery('');
    setDistrictResults([]);
    setDistrictSearchHasRun(false);
    notifyChange(updated);
  };

  // District Search Action
  const handleExecuteDistrictSearch = async () => {
    if (!districtQuery.trim()) return;
    setSearchingDistricts(true);
    setDistrictSearchHasRun(true);
    setProviderUnavailable(false);

    try {
      const results = await searchDistricts(districtQuery, {
        countryCode: countryCode || 'IN',
        state: state
      });
      setDistrictResults(results);
    } catch (err) {
      console.warn('[LocationSelector] District search provider error:', err);
      setDistrictResults([]);
      setProviderUnavailable(true);
    } finally {
      setSearchingDistricts(false);
    }
  };

  // Map Pin Confirmed Handler (Reverse Geocodes ONCE for locality display label)
  const handleMapPinConfirmed = async (pinnedLat: number, pinnedLng: number) => {
    setShowMapPicker(false);
    setProviderUnavailable(false);

    try {
      const reverseResult = await reverseGeocodeLocation(pinnedLat, pinnedLng, 'map_confirm');

      // Preserve manually selected hierarchy as authoritative
      const newCity = reverseResult?.city || city || '';
      const detectedDistrict = reverseResult?.district || '';

      const updated: LocationData = {
        country: country,
        country_code: countryCode,
        state: state,
        state_code: stateCode,
        district: district,
        city: newCity,
        latitude: pinnedLat,
        longitude: pinnedLng
      };

      // District boundary safety check
      if (district && detectedDistrict && !detectedDistrict.toLowerCase().includes(district.toLowerCase()) && !district.toLowerCase().includes(detectedDistrict.toLowerCase())) {
        setBoundaryWarning(`The selected pin appears to be outside ${district} district (detected ${detectedDistrict}).`);
        setPendingLocationData(updated);
        return;
      }

      notifyChange(updated);
      setManualExpanded(false);
    } catch (err) {
      // Network failure fallback: preserve pin coordinates cleanly!
      const fallbackData: LocationData = {
        country,
        country_code: countryCode,
        state,
        state_code: stateCode,
        district,
        city,
        latitude: pinnedLat,
        longitude: pinnedLng
      };
      notifyChange(fallbackData);
      setManualExpanded(false);
      setGeoError("Exact pin saved. Address details could not be loaded.");
    }
  };

  // GPS Geolocation Handler — IMMEDIATELY closes manual panel & preserves old location on error
  const handleDetectLocation = () => {
    setGeoError(null);
    setBoundaryWarning(null);
    setProviderUnavailable(false);

    // Immediately close manual panel & transient search state
    setManualExpanded(false);
    setShowMapPicker(false);
    setShowCountryDropdown(false);
    setShowStateDropdown(false);
    setShowDistrictDropdown(false);
    setDistrictQuery('');
    setDistrictResults([]);
    setDistrictSearchHasRun(false);

    setDetecting(true);

    if (!navigator.geolocation) {
      setGeoError("Location permission was denied. You can select your location manually.");
      setDetecting(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude: lat, longitude: lng } = position.coords;
          const detectedData = await reverseGeocodeLocation(lat, lng, 'gps');

          if (detectedData) {
            notifyChange(detectedData);
          } else {
            setGeoError("Could not detect location automatically. You can select your location manually.");
          }
        } catch (err) {
          setGeoError("Could not detect location automatically. You can select your location manually.");
        } finally {
          setDetecting(false);
        }
      },
      (error) => {
        setDetecting(false);
        if (error.code === error.PERMISSION_DENIED) {
          setGeoError("Location permission was denied. You can select your location manually.");
        } else if (error.code === error.TIMEOUT) {
          setGeoError("Location lookup timed out. You can select your location manually.");
        } else {
          setGeoError("Could not detect location automatically. You can select your location manually.");
        }
      },
      { timeout: 10000 }
    );
  };

  // Country-dependent region list
  const availableRegions = getRegionsForCountry(countryCode || country);

  // REAL LOCATION COMPLETION RULE:
  // Country alone MUST NOT count as completed! Require completed manual hierarchy or GPS coordinates.
  const isLocationCompleted = Boolean(
    country && (
      (state && district && isValidCoordinates(latitude, longitude)) ||
      (city && isValidCoordinates(latitude, longitude))
    )
  );

  const rawSummary = formatLocationSummary({ country, state, district, city });
  const completedSummary = rawSummary && rawSummary !== country ? rawSummary : (district && state ? `${district} District, ${state}` : 'Exact location pinned');

  return (
    <div className={`space-y-3 text-xs text-slate-800 dark:text-slate-200 ${className}`}>
      {/* ── 1. BASE LOCATION COMPACT CARD ────────────────────────────── */}
      <div className="p-3.5 bg-slate-50 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl space-y-2.5 text-left">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-indigo-500 shrink-0" />
            <span className="font-bold text-xs text-slate-900 dark:text-white">{label}</span>
          </div>
          <button
            type="button"
            disabled={detecting}
            onClick={handleDetectLocation}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-xs"
          >
            {detecting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Locating...</span>
              </>
            ) : (
              <>
                <MapPin className="w-3.5 h-3.5" />
                <span>Use my current location</span>
              </>
            )}
          </button>
        </div>

        {/* Selected location summary banner (ONLY rendered when location is TRULY completed) */}
        {isLocationCompleted && !manualExpanded && (
          <div className="flex items-center justify-between p-2.5 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-900/50 rounded-xl text-xs">
            <div className="flex items-center space-x-2 font-semibold text-indigo-950 dark:text-indigo-200 min-w-0 pr-2">
              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="truncate">{completedSummary}</span>
            </div>
            <button
              type="button"
              onClick={() => setManualExpanded(true)}
              className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0 ml-2 cursor-pointer"
            >
              Change
            </button>
          </div>
        )}

        {/* Error notification banner */}
        {geoError && (
          <div className="flex items-center space-x-2 p-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-medium text-left">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{geoError}</span>
          </div>
        )}

        {/* Toggle Manual Controls */}
        {!manualExpanded && (
          <div className="pt-0.5 flex justify-center">
            <button
              type="button"
              onClick={() => {
                setManualExpanded(true);
                setGeoError(null);
              }}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-bold transition-all cursor-pointer flex items-center space-x-1"
            >
              <span>Select location manually</span>
            </button>
          </div>
        )}
      </div>

      {/* ── 2. EXPANDED MANUAL LOCATION SELECTION ────────────────────── */}
      {manualExpanded && (
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3.5 shadow-xs text-left animate-fadeIn">
          {/* Simplified Manual Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
              <Globe className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>Manual Location Selection</span>
            </span>
            <button
              type="button"
              onClick={() => setManualExpanded(false)}
              className="text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center space-x-1 cursor-pointer"
            >
              <span>Hide manual selection</span>
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Provider Failure / Unavailable Alert State */}
          {providerUnavailable && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-xl space-y-2 text-xs">
              <div className="flex items-start space-x-2 text-amber-900 dark:text-amber-200 font-semibold">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold text-slate-900 dark:text-white">Location service temporarily unavailable</p>
                  <p className="text-[11px] font-normal text-amber-800 dark:text-amber-300">
                    We couldn't load manual location services right now. Please try again later or use your current location.
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setProviderUnavailable(false);
                    handleExecuteDistrictSearch();
                  }}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-xs cursor-pointer flex items-center space-x-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry</span>
                </button>
                <button
                  type="button"
                  onClick={handleDetectLocation}
                  className="px-3 py-1.5 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100 font-bold rounded-lg text-xs hover:bg-amber-100 dark:hover:bg-amber-900/50 cursor-pointer flex items-center space-x-1"
                >
                  <MapPin className="w-3 h-3 text-indigo-500" />
                  <span>Use my current location</span>
                </button>
              </div>
            </div>
          )}

          {/* District Boundary Warning Notice */}
          {boundaryWarning && pendingLocationData && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-xl space-y-2 text-xs">
              <div className="flex items-start space-x-2 text-amber-800 dark:text-amber-200 font-semibold">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span>{boundaryWarning}</span>
              </div>
              <div className="flex items-center space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowMapPicker(true)}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-xs cursor-pointer"
                >
                  Choose Again
                </button>
                <button
                  type="button"
                  onClick={() => notifyChange(pendingLocationData)}
                  className="px-3 py-1.5 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100 font-bold rounded-lg text-xs hover:bg-amber-100 dark:hover:bg-amber-900/50 cursor-pointer"
                >
                  Use This Location Anyway
                </button>
              </div>
            </div>
          )}

          {/* Clean 2-Column Row for Country & State */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Country Selector */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Country</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                  className="w-full h-10 px-3.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl text-left flex justify-between items-center text-xs font-semibold text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                >
                  <span className="truncate">{country || 'Select Country'}</span>
                  <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
                {showCountryDropdown && (
                  <div className="absolute z-30 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg max-h-48 overflow-y-auto p-1">
                    {COUNTRIES_DATA.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleCountryChange(c.name, c.id)}
                        className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-medium flex justify-between items-center cursor-pointer"
                      >
                        <span>{c.name}</span>
                        {countryCode === c.id && <Check className="w-4 h-4 text-indigo-500" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* State / Region Selector */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">State / Province / Region</label>
              <div className="relative">
                <button
                  type="button"
                  disabled={availableRegions.length === 0}
                  onClick={() => setShowStateDropdown(!showStateDropdown)}
                  className="w-full h-10 px-3.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl text-left flex justify-between items-center text-xs font-semibold text-slate-900 dark:text-white disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                >
                  <span className="truncate">{state || (availableRegions.length > 0 ? 'Select State / Region' : 'N/A')}</span>
                  <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
                {showStateDropdown && availableRegions.length > 0 && (
                  <div className="absolute z-30 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg max-h-48 overflow-y-auto p-1">
                    {availableRegions.map((s) => (
                      <button
                        key={s.code}
                        type="button"
                        onClick={() => handleStateChange(s.name, s.code)}
                        className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-medium flex justify-between items-center cursor-pointer"
                      >
                        <span>{s.name}</span>
                        {state === s.name && <Check className="w-4 h-4 text-indigo-500" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* District Selector Row */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">District / County</label>
            <div className="relative">
              <button
                type="button"
                disabled={!state && availableRegions.length > 0}
                onClick={() => setShowDistrictDropdown(!showDistrictDropdown)}
                className="w-full h-10 px-3.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl text-left flex justify-between items-center text-xs font-semibold text-slate-900 dark:text-white disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
              >
                <div className="flex items-center space-x-2 min-w-0 pr-2">
                  <Building2 className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span className="truncate">{district ? `${district} District` : (state ? 'Select District / County' : 'Select state first')}</span>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
              </button>

              {/* District Search Dropdown Panel */}
              {showDistrictDropdown && (
                <div className="absolute z-30 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-3 space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={districtQuery}
                      onChange={(e) => setDistrictQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.stopPropagation();
                          handleExecuteDistrictSearch();
                        }
                      }}
                      placeholder="Search district (e.g. Kottayam, Ernakulam...)"
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      disabled={searchingDistricts || !districtQuery.trim()}
                      onClick={handleExecuteDistrictSearch}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs cursor-pointer flex items-center space-x-1"
                    >
                      {searchingDistricts ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                      <span>Search</span>
                    </button>
                  </div>

                  {districtSearchHasRun && (
                    <div className="max-h-40 overflow-y-auto space-y-1 border-t border-slate-100 dark:border-slate-800 pt-1.5">
                      {districtResults.length > 0 ? (
                        districtResults.map((res, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelectDistrictResult(res)}
                            className="w-full p-2 text-left hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-lg text-xs cursor-pointer"
                          >
                            <p className="font-bold text-slate-900 dark:text-white">{res.data.district} District</p>
                            <p className="text-[10px] text-slate-500 truncate">{res.formatted_summary}</p>
                          </button>
                        ))
                      ) : (
                        <p className="p-2 text-center text-slate-500 text-xs">No matching districts found.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Exact Location Row */}
          <div className="space-y-1 pt-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Exact Location</label>
            <button
              type="button"
              disabled={!district && availableRegions.length > 0}
              onClick={() => setShowMapPicker(true)}
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 text-white disabled:text-slate-400 font-bold rounded-xl text-xs transition-all cursor-pointer shadow-xs flex items-center justify-center space-x-2"
            >
              <Map className="w-4 h-4 text-indigo-200 shrink-0" />
              <span>Choose exact location on map</span>
            </button>
            <p className="text-[11px] text-slate-400 text-center font-medium pt-0.5">
              {district ? `Map will open centered on ${district} district` : 'Select state and district to choose location'}
            </p>
          </div>
        </div>
      )}

      {/* Interactive Leaflet Map Picker Modal */}
      {showMapPicker && (
        <LocationMapPicker
          initialLat={latitude}
          initialLng={longitude}
          districtName={district}
          stateName={state}
          countryName={country}
          countryCode={countryCode}
          onConfirm={handleMapPinConfirmed}
          onCancel={() => setShowMapPicker(false)}
        />
      )}
    </div>
  );
}
