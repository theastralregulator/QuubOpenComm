import React, { useState, useEffect } from 'react';
import { MapPin, Search, ChevronDown, Check, RefreshCw, AlertCircle, X, Globe, Building2 } from 'lucide-react';
import { COUNTRIES_DATA } from '../../lib/locationsData';
import {
  LocationData,
  getRegionsForCountry,
  isValidCoordinates,
  formatLocationSummary,
  searchDistricts,
  searchPlaces,
  reverseGeocodeLocation,
  PlaceSearchResult,
  DistrictSearchResult
} from '../../lib/locationService';

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

  // UX State
  const [manualExpanded, setManualExpanded] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Dedicated District Search State
  const [districtQuery, setDistrictQuery] = useState('');
  const [searchingDistricts, setSearchingDistricts] = useState(false);
  const [districtResults, setDistrictResults] = useState<DistrictSearchResult[]>([]);
  const [districtSearchHasRun, setDistrictSearchHasRun] = useState(false);
  const [showDistrictDropdown, setShowDistrictDropdown] = useState(false);

  // Locality Search State
  const [placeQuery, setPlaceQuery] = useState('');
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
  const [searchHasRun, setSearchHasRun] = useState(false);

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
  }, [value.country, value.state, value.city, value.district]);

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
    setValidationError(null);
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
    setPlaceQuery('');
    setSearchResults([]);
    setSearchHasRun(false);
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
    setPlaceQuery('');
    setSearchResults([]);
    setSearchHasRun(false);
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
    setPlaceQuery('');
    setSearchResults([]);
    setSearchHasRun(false);
    notifyChange(updated);
  };

  // Locality selection handler
  const handleSelectLocalityResult = (result: PlaceSearchResult) => {
    notifyChange(result.data);
    setSearchResults([]);
    setPlaceQuery('');
    setSearchHasRun(false);
    setManualExpanded(false);
  };

  // GPS Geolocation Handler — IMMEDIATELY closes manual panel & preserves old location on error
  const handleDetectLocation = () => {
    setGeoError(null);
    setValidationError(null);

    // Immediately close manual panel & transient search state
    setManualExpanded(false);
    setShowCountryDropdown(false);
    setShowStateDropdown(false);
    setShowDistrictDropdown(false);
    setDistrictQuery('');
    setDistrictResults([]);
    setDistrictSearchHasRun(false);
    setPlaceQuery('');
    setSearchResults([]);
    setSearchHasRun(false);

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
          const detectedData = await reverseGeocodeLocation(lat, lng);

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

  // District Search Action
  const handleExecuteDistrictSearch = async () => {
    if (!districtQuery.trim()) return;
    setSearchingDistricts(true);
    setDistrictSearchHasRun(true);
    setValidationError(null);

    try {
      const results = await searchDistricts(districtQuery, {
        countryCode: countryCode || 'IN',
        state: state
      });
      setDistrictResults(results);
    } catch (err) {
      console.warn('[LocationSelector] District search error:', err);
      setDistrictResults([]);
    } finally {
      setSearchingDistricts(false);
    }
  };

  // Locality Search Action
  const handleExecutePlaceSearch = async () => {
    if (!placeQuery.trim()) return;
    setSearchingPlaces(true);
    setSearchHasRun(true);
    setValidationError(null);

    try {
      const results = await searchPlaces(placeQuery, {
        countryCode: countryCode || 'IN',
        state: state,
        district: district
      });
      setSearchResults(results);
    } catch (err) {
      console.warn('[LocationSelector] Locality search error:', err);
      setSearchResults([]);
    } finally {
      setSearchingPlaces(false);
    }
  };

  // Done button validation
  const handleDoneManual = () => {
    if (!city && !district && !state) {
      if (placeQuery.trim() || districtQuery.trim()) {
        setValidationError("Please select a location from the search results.");
        return;
      }
    }
    setManualExpanded(false);
  };

  // Country-dependent region list
  const availableRegions = getRegionsForCountry(countryCode || country);
  const currentSummary = formatLocationSummary({ country, state, district, city });
  const hasSelectedLocation = Boolean((city || district || state) && country);

  return (
    <div className={`space-y-3 text-xs text-slate-800 dark:text-slate-200 ${className}`}>
      {/* ── 1. DEFAULT COMPACT UI ────────────────────────────────────── */}
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

        {/* Selected location summary banner */}
        {hasSelectedLocation && !manualExpanded && (
          <div className="flex items-center justify-between p-2.5 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-900/50 rounded-xl text-xs">
            <div className="flex items-center space-x-2 font-semibold text-indigo-950 dark:text-indigo-200 min-w-0 pr-2">
              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="truncate">{currentSummary}</span>
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
                setValidationError(null);
              }}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-bold transition-all cursor-pointer flex items-center space-x-1"
            >
              <span>Select location manually</span>
            </button>
          </div>
        )}
      </div>

      {/* ── 2. EXPANDED MANUAL LOCATION HIERARCHY ────────────────────── */}
      {manualExpanded && (
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4 shadow-sm text-left animate-fadeIn">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
              <Globe className="w-3.5 h-3.5 text-indigo-500" />
              <span>Manual Location Hierarchy</span>
            </span>
            <button
              type="button"
              onClick={() => setManualExpanded(false)}
              className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center space-x-1 cursor-pointer"
            >
              <span>Hide manual selection</span>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Validation Notice */}
          {validationError && (
            <div className="flex items-center space-x-2 p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-amber-700 dark:text-amber-300 rounded-xl text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Step 1 & 2: Country & State */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Country Selector */}
            <div className="space-y-1">
              <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">1. Country</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl text-left flex justify-between items-center text-xs font-semibold"
                >
                  <span className="truncate">{country || 'Select Country'}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
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
                        {countryCode === c.id && <Check className="w-3.5 h-3.5 text-indigo-500" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* State / Region Selector */}
            <div className="space-y-1">
              <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">2. State / Province / Region</label>
              <div className="relative">
                <button
                  type="button"
                  disabled={availableRegions.length === 0}
                  onClick={() => setShowStateDropdown(!showStateDropdown)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl text-left flex justify-between items-center text-xs font-semibold disabled:opacity-50"
                >
                  <span className="truncate">{state || (availableRegions.length > 0 ? 'Select State / Region' : 'N/A')}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
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
                        {state === s.name && <Check className="w-3.5 h-3.5 text-indigo-500" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Step 3: DEDICATED DISTRICT / COUNTY SELECTOR */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">
              3. District / County
            </label>
            <div className="relative">
              <button
                type="button"
                disabled={!state && availableRegions.length > 0}
                onClick={() => setShowDistrictDropdown(!showDistrictDropdown)}
                className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl text-left flex justify-between items-center text-xs font-semibold disabled:opacity-50"
              >
                <div className="flex items-center space-x-2 min-w-0 pr-2">
                  <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span className="truncate">{district ? `${district} District` : (state ? 'Select District / County' : 'Select State First')}</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>

              {/* District Search Panel */}
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
                      {searchingDistricts ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
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

          {/* Step 4: LOCALITY SELECTOR */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">
              4. City / Town / Village / Locality
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={placeQuery}
                  onChange={(e) => { setPlaceQuery(e.target.value); setValidationError(null); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      handleExecutePlaceSearch();
                    }
                  }}
                  placeholder="e.g. Kaduthuruthy, Pala, Whitefield..."
                  className="w-full h-10 px-3.5 pr-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                />
                {placeQuery && (
                  <button
                    type="button"
                    onClick={() => { setPlaceQuery(''); setSearchResults([]); setSearchHasRun(false); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                type="button"
                disabled={searchingPlaces || !placeQuery.trim()}
                onClick={handleExecutePlaceSearch}
                className="px-4 h-10 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shrink-0 flex items-center space-x-1.5"
              >
                {searchingPlaces ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Searching...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5" />
                    <span>Search</span>
                  </>
                )}
              </button>
            </div>

            {/* Locality Search Results */}
            {searchHasRun && (
              <div className="mt-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl max-h-52 overflow-y-auto p-1.5 space-y-1 shadow-md">
                {searchResults.length > 0 ? (
                  searchResults.map((res, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSelectLocalityResult(res)}
                      className="w-full p-2 text-left rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-colors cursor-pointer border border-transparent hover:border-indigo-200 dark:hover:border-indigo-900"
                    >
                      <p className="font-bold text-slate-900 dark:text-white text-xs">{res.data.city || res.data.district}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{res.formatted_summary}</p>
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-center text-slate-500 dark:text-slate-400 text-xs">
                    No matching localities found. Try refining your search query.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* OpenStreetMap Attribution & Close Action */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800/80 text-[10px] text-slate-400">
            <span>Location search powered by OpenStreetMap contributors</span>
            <button
              type="button"
              onClick={handleDoneManual}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs transition-all cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
