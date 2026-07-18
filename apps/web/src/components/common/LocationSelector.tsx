import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Search, ChevronDown, Check, RefreshCw, AlertCircle } from 'lucide-react';
import { COUNTRIES_DATA, CountryOption, StateOption, DistrictOption, CityOption } from '../../lib/locationsData';

export interface LocationData {
  country: string;
  country_code: string;
  state: string;
  state_code: string;
  district: string;
  city: string;
  latitude?: number;
  longitude?: number;
}

interface LocationSelectorProps {
  value?: Partial<LocationData>;
  onChange: (data: LocationData) => void;
  className?: string;
}

export default function LocationSelector({ value = {}, onChange, className = '' }: LocationSelectorProps) {
  // Current selections
  const [selectedCountry, setSelectedCountry] = useState<CountryOption | null>(null);
  const [selectedState, setSelectedState] = useState<StateOption | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictOption | null>(null);
  const [selectedCity, setSelectedCity] = useState<CityOption | null>(null);

  // Search filter strings
  const [countrySearch, setCountrySearch] = useState('');
  const [stateSearch, setStateSearch] = useState('');
  const [districtSearch, setDistrictSearch] = useState('');
  const [citySearch, setCitySearch] = useState('');

  // Dropdown open states
  const [countryOpen, setCountryOpen] = useState(false);
  const [stateOpen, setStateOpen] = useState(false);
  const [districtOpen, setDistrictOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);

  // Manual fallback override state
  const [isManual, setIsManual] = useState(false);
  const [manualCountry, setManualCountry] = useState(value.country || '');
  const [manualCountryCode, setManualCountryCode] = useState(value.country_code || '');
  const [manualState, setManualState] = useState(value.state || '');
  const [manualStateCode, setManualStateCode] = useState(value.state_code || '');
  const [manualDistrict, setManualDistrict] = useState(value.district || '');
  const [manualCity, setManualCity] = useState(value.city || '');
  const [manualLat, setManualLat] = useState<number | undefined>(value.latitude);
  const [manualLng, setManualLng] = useState<number | undefined>(value.longitude);

  // Geolocation states
  const [detecting, setDetecting] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Refs for closing dropdowns on outside click
  const countryRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<HTMLDivElement>(null);
  const districtRef = useRef<HTMLDivElement>(null);
  const cityRef = useRef<HTMLDivElement>(null);

  // Sync initial or updated prop values
  useEffect(() => {
    if (!value || isManual) return;

    // Check if matching in static dataset
    const matchedCountry = COUNTRIES_DATA.find(c => c.id === value.country_code || c.name.toLowerCase() === value.country?.toLowerCase()) || null;
    let matchedState: StateOption | null = null;
    let matchedDistrict: DistrictOption | null = null;
    let matchedCity: CityOption | null = null;

    if (matchedCountry) {
      matchedState = matchedCountry.states.find(s => s.id === value.state_code || s.name.toLowerCase() === value.state?.toLowerCase()) || null;
      if (matchedState) {
        matchedDistrict = matchedState.districts.find(d => d.name.toLowerCase() === value.district?.toLowerCase()) || null;
        if (matchedDistrict) {
          matchedCity = matchedDistrict.cities.find(c => c.name.toLowerCase() === value.city?.toLowerCase()) || null;
        }
      }
    }

    // If we have some values but they don't match static data, fallback to manual mode automatically
    const hasValue = value.country || value.state || value.city;
    if (hasValue && !matchedCountry) {
      setIsManual(true);
      setManualCountry(value.country || '');
      setManualCountryCode(value.country_code || '');
      setManualState(value.state || '');
      setManualStateCode(value.state_code || '');
      setManualDistrict(value.district || '');
      setManualCity(value.city || '');
      setManualLat(value.latitude);
      setManualLng(value.longitude);
    } else {
      setSelectedCountry(matchedCountry);
      setSelectedState(matchedState);
      setSelectedDistrict(matchedDistrict);
      setSelectedCity(matchedCity);
    }
  }, [value.country_code, value.state_code, value.district, value.city]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (countryRef.current && !countryRef.current.contains(event.target as Node)) setCountryOpen(false);
      if (stateRef.current && !stateRef.current.contains(event.target as Node)) setStateOpen(false);
      if (districtRef.current && !districtRef.current.contains(event.target as Node)) setDistrictOpen(false);
      if (cityRef.current && !cityRef.current.contains(event.target as Node)) setCityOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update callbacks
  const updateLocation = (
    countryObj: CountryOption | null,
    stateObj: StateOption | null,
    districtObj: DistrictOption | null,
    cityObj: CityOption | null
  ) => {
    if (!countryObj) {
      onChange({
        country: '',
        country_code: '',
        state: '',
        state_code: '',
        district: '',
        city: '',
        latitude: undefined,
        longitude: undefined
      });
      return;
    }

    onChange({
      country: countryObj.name,
      country_code: countryObj.id,
      state: stateObj ? stateObj.name : '',
      state_code: stateObj ? stateObj.id : '',
      district: districtObj ? districtObj.name : '',
      city: cityObj ? cityObj.name : '',
      latitude: cityObj ? cityObj.lat : undefined,
      longitude: cityObj ? cityObj.lng : undefined
    });
  };

  const handleManualChange = (updates: Partial<LocationData>) => {
    const updated = {
      country: updates.country !== undefined ? updates.country : manualCountry,
      country_code: updates.country_code !== undefined ? updates.country_code : manualCountryCode,
      state: updates.state !== undefined ? updates.state : manualState,
      state_code: updates.state_code !== undefined ? updates.state_code : manualStateCode,
      district: updates.district !== undefined ? updates.district : manualDistrict,
      city: updates.city !== undefined ? updates.city : manualCity,
      latitude: updates.latitude !== undefined ? updates.latitude : manualLat,
      longitude: updates.longitude !== undefined ? updates.longitude : manualLng
    };

    setManualCountry(updated.country);
    setManualCountryCode(updated.country_code);
    setManualState(updated.state);
    setManualStateCode(updated.state_code);
    setManualDistrict(updated.district);
    setManualCity(updated.city);
    setManualLat(updated.latitude);
    setManualLng(updated.longitude);

    onChange(updated as LocationData);
  };

  // Geo Detection
  const handleDetectLocation = () => {
    setGeoError(null);
    setDetecting(true);

    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      setDetecting(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        // Approximate location only (round to 3 decimals to protect exact coords)
        const approxLat = Math.round(latitude * 1000) / 1000;
        const approxLng = Math.round(longitude * 1000) / 1000;

        try {
          // Reverse geocode using Nominatim (no api key required, perfectly secure for frontend)
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${approxLat}&lon=${approxLng}&accept-language=en`,
            { headers: { 'User-Agent': 'OpenComm-Applet' } }
          );
          if (!res.ok) throw new Error("Lookup response not ok");
          const data = await res.json();

          if (data && data.address) {
            const addr = data.address;
            const countryName = addr.country || '';
            const countryCode = (addr.country_code || '').toUpperCase();
            const stateName = addr.state || addr.province || addr.region || '';
            const districtName = addr.county || addr.district || addr.suburb || '';
            const cityName = addr.city || addr.town || addr.village || addr.municipality || addr.hamlet || '';

            // Switch to manual mode so detected geocoded items are fully editable
            setIsManual(true);
            handleManualChange({
              country: countryName,
              country_code: countryCode,
              state: stateName,
              state_code: countryCode === 'US' ? (stateCodeMap[stateName.toLowerCase()] || '') : '',
              district: districtName,
              city: cityName,
              latitude: approxLat,
              longitude: approxLng
            });
          } else {
            setGeoError("Unable to detect your location.");
          }
        } catch (err) {
          setGeoError("Unable to detect your location.");
        } finally {
          setDetecting(false);
        }
      },
      (error) => {
        setDetecting(false);
        if (error.code === error.PERMISSION_DENIED) {
          setGeoError("Location permission was denied.");
        } else if (error.code === error.TIMEOUT) {
          setGeoError("Location lookup timed out.");
        } else {
          setGeoError("Unable to detect your location.");
        }
      },
      { timeout: 8000 }
    );
  };

  // Filter static datasets
  const filteredCountries = COUNTRIES_DATA.filter(c =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
    c.id.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const filteredStates = selectedCountry
    ? selectedCountry.states.filter(s => s.name.toLowerCase().includes(stateSearch.toLowerCase()))
    : [];

  const filteredDistricts = selectedState
    ? selectedState.districts.filter(d => d.name.toLowerCase().includes(districtSearch.toLowerCase()))
    : [];

  const filteredCities = selectedDistrict
    ? selectedDistrict.cities.filter(c => c.name.toLowerCase().includes(citySearch.toLowerCase()))
    : [];

  return (
    <div className={`space-y-4 text-xs text-slate-800 dark:text-slate-200 ${className}`}>
      {/* Geolocation Button */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl">
        <div className="flex items-center space-x-2">
          <MapPin className="w-4 h-4 text-indigo-500 shrink-0" />
          <div className="text-left">
            <p className="font-bold text-[11px] text-slate-900 dark:text-white">Smart Geo-Location</p>
            <p className="text-[10px] text-slate-400">Detect automatic values or use custom entries.</p>
          </div>
        </div>
        <button
          type="button"
          disabled={detecting}
          onClick={handleDetectLocation}
          className="flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white font-bold rounded-xl text-[10px] transition-all cursor-pointer shadow-xs"
        >
          {detecting ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Detecting location...</span>
            </>
          ) : (
            <>
              <MapPin className="w-3.5 h-3.5" />
              <span>Use my current location</span>
            </>
          )}
        </button>
      </div>

      {geoError && (
        <div className="flex items-center space-x-1.5 p-2.5 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-[10px] font-semibold text-left">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{geoError}. Please select your location manually.</span>
        </div>
      )}

      {/* Manual toggle links */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            setIsManual(!isManual);
            if (!isManual) {
              // Copy current dropdown selects into manual state
              setManualCountry(selectedCountry?.name || '');
              setManualCountryCode(selectedCountry?.id || '');
              setManualState(selectedState?.name || '');
              setManualStateCode(selectedState?.id || '');
              setManualDistrict(selectedDistrict?.name || '');
              setManualCity(selectedCity?.name || '');
              setManualLat(selectedCity?.lat);
              setManualLng(selectedCity?.lng);
            }
          }}
          className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
        >
          {isManual ? "Switch to Interactive Dropdowns" : "Can't find location? Type custom name"}
        </button>
      </div>

      {isManual ? (
        /* Manual fallback inputs */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1">
            <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">Country</label>
            <input
              type="text"
              required
              placeholder="e.g. United States"
              value={manualCountry}
              onChange={(e) => handleManualChange({ country: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="space-y-1">
            <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">State / Province</label>
            <input
              type="text"
              required
              placeholder="e.g. Texas"
              value={manualState}
              onChange={(e) => handleManualChange({ state: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="space-y-1">
            <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">District / County</label>
            <input
              type="text"
              placeholder="e.g. Travis County"
              value={manualDistrict}
              onChange={(e) => handleManualChange({ district: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="space-y-1">
            <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">City / Place / Locality</label>
            <input
              type="text"
              required
              placeholder="e.g. Austin"
              value={manualCity}
              onChange={(e) => handleManualChange({ city: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      ) : (
        /* Dependent dropdown hierarchy */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          
          {/* 1. Country Selection */}
          <div className="space-y-1 text-left" ref={countryRef}>
            <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">Country</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setCountryOpen(!countryOpen)}
                className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-left flex justify-between items-center text-slate-800 dark:text-slate-200"
              >
                <span className="truncate">{selectedCountry ? selectedCountry.name : "Select Country"}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>
              {countryOpen && (
                <div className="absolute z-30 mt-1 w-full bg-white dark:bg-[#1f2937] border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                  <div className="p-2 border-b border-slate-100 dark:border-slate-700 flex items-center space-x-1.5 sticky top-0 bg-white dark:bg-[#1f2937]">
                    <Search className="w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search Country..."
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      className="w-full bg-transparent text-[11px] outline-none text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div className="py-1">
                    {filteredCountries.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedCountry(c);
                          setSelectedState(null);
                          setSelectedDistrict(null);
                          setSelectedCity(null);
                          setCountryOpen(false);
                          setCountrySearch('');
                          updateLocation(c, null, null, null);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex justify-between items-center text-[11px]"
                      >
                        <span>{c.name}</span>
                        {selectedCountry?.id === c.id && <Check className="w-3.5 h-3.5 text-indigo-500" />}
                      </button>
                    ))}
                    {filteredCountries.length === 0 && (
                      <div className="px-3 py-2 text-slate-400 text-center text-[10px]">No matches found.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 2. State Selection */}
          <div className="space-y-1 text-left" ref={stateRef}>
            <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">State / Province</label>
            <div className="relative">
              <button
                type="button"
                disabled={!selectedCountry}
                onClick={() => setStateOpen(!stateOpen)}
                className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-left flex justify-between items-center disabled:opacity-50 text-slate-800 dark:text-slate-200"
              >
                <span className="truncate">
                  {!selectedCountry ? "Select Country First" : selectedState ? selectedState.name : "Select State"}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>
              {stateOpen && selectedCountry && (
                <div className="absolute z-30 mt-1 w-full bg-white dark:bg-[#1f2937] border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                  <div className="p-2 border-b border-slate-100 dark:border-slate-700 flex items-center space-x-1.5 sticky top-0 bg-white dark:bg-[#1f2937]">
                    <Search className="w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search State..."
                      value={stateSearch}
                      onChange={(e) => setStateSearch(e.target.value)}
                      className="w-full bg-transparent text-[11px] outline-none text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div className="py-1">
                    {filteredStates.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSelectedState(s);
                          setSelectedDistrict(null);
                          setSelectedCity(null);
                          setStateOpen(false);
                          setStateSearch('');
                          updateLocation(selectedCountry, s, null, null);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex justify-between items-center text-[11px]"
                      >
                        <span>{s.name}</span>
                        {selectedState?.id === s.id && <Check className="w-3.5 h-3.5 text-indigo-500" />}
                      </button>
                    ))}
                    {filteredStates.length === 0 && (
                      <div className="px-3 py-2 text-slate-400 text-center text-[10px]">No matches found.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3. District Selection */}
          <div className="space-y-1 text-left" ref={districtRef}>
            <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">District / County</label>
            <div className="relative">
              <button
                type="button"
                disabled={!selectedState}
                onClick={() => setDistrictOpen(!districtOpen)}
                className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-left flex justify-between items-center disabled:opacity-50 text-slate-800 dark:text-slate-200"
              >
                <span className="truncate">
                  {!selectedState ? "Select State First" : selectedDistrict ? selectedDistrict.name : "Select District"}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>
              {districtOpen && selectedState && (
                <div className="absolute z-30 mt-1 w-full bg-white dark:bg-[#1f2937] border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                  <div className="p-2 border-b border-slate-100 dark:border-slate-700 flex items-center space-x-1.5 sticky top-0 bg-white dark:bg-[#1f2937]">
                    <Search className="w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search District..."
                      value={districtSearch}
                      onChange={(e) => setDistrictSearch(e.target.value)}
                      className="w-full bg-transparent text-[11px] outline-none text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div className="py-1">
                    {filteredDistricts.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          setSelectedDistrict(d);
                          setSelectedCity(null);
                          setDistrictOpen(false);
                          setDistrictSearch('');
                          updateLocation(selectedCountry, selectedState, d, null);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex justify-between items-center text-[11px]"
                      >
                        <span>{d.name}</span>
                        {selectedDistrict?.id === d.id && <Check className="w-3.5 h-3.5 text-indigo-500" />}
                      </button>
                    ))}
                    {filteredDistricts.length === 0 && (
                      <div className="px-3 py-2 text-slate-400 text-center text-[10px]">No matches found.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 4. City / Place Selection */}
          <div className="space-y-1 text-left" ref={cityRef}>
            <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">City / Place / Locality</label>
            <div className="relative">
              <button
                type="button"
                disabled={!selectedDistrict}
                onClick={() => setCityOpen(!cityOpen)}
                className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-left flex justify-between items-center disabled:opacity-50 text-slate-800 dark:text-slate-200"
              >
                <span className="truncate">
                  {!selectedDistrict ? "Select District First" : selectedCity ? selectedCity.name : "Select City / Place"}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>
              {cityOpen && selectedDistrict && (
                <div className="absolute z-30 mt-1 w-full bg-white dark:bg-[#1f2937] border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                  <div className="p-2 border-b border-slate-100 dark:border-slate-700 flex items-center space-x-1.5 sticky top-0 bg-white dark:bg-[#1f2937]">
                    <Search className="w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search City..."
                      value={citySearch}
                      onChange={(e) => setCitySearch(e.target.value)}
                      className="w-full bg-transparent text-[11px] outline-none text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div className="py-1">
                    {filteredCities.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedCity(c);
                          setCityOpen(false);
                          setCitySearch('');
                          updateLocation(selectedCountry, selectedState, selectedDistrict, c);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex justify-between items-center text-[11px]"
                      >
                        <span>{c.name}</span>
                        {selectedCity?.id === c.id && <Check className="w-3.5 h-3.5 text-indigo-500" />}
                      </button>
                    ))}
                    {filteredCities.length === 0 && (
                      <div className="px-3 py-2 text-slate-400 text-center text-[10px]">No matches found.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

const stateCodeMap: { [key: string]: string } = {
  'texas': 'TX',
  'california': 'CA',
  'new york': 'NY',
  'karnataka': 'KA',
  'maharashtra': 'MH',
  'ontario': 'ON',
  'british columbia': 'BC',
  'england': 'ENG'
};
