import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, SlidersHorizontal, MapPin, Star, Bookmark, MessageSquare, 
  CheckCircle, ChevronDown, Sparkles, X, UserCheck, Eye, Calendar,
  Briefcase, Award, CheckCircle2, ThumbsUp, Heart, Filter, ArrowLeft, 
  BadgeCheck, MessageCircle, Clock, ShieldCheck, Globe, StarHalf, Users, DollarSign
} from 'lucide-react';
import { Worker } from '../../types';
import WorkerCard from '../cards/WorkerCard';
import { analytics } from '../../lib/analytics';

interface WorkersPageProps {
  workers: Worker[];
  toggleWorkerBookmark: (id: string, e: React.MouseEvent) => void;
  onOpenMessage: (name: string) => void;
  onOpenHire: (worker: Worker, e: React.MouseEvent) => void;
  selectedCategory: string | null;
  setSelectedCategory: (cat: string | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  triggerToast: (msg: string) => void;
  isLoggedIn?: boolean;
  onOpenAuth?: (tab: 'signin' | 'signup' | 'locked') => void;
}

export default function WorkersPage({
  workers,
  toggleWorkerBookmark,
  onOpenMessage,
  onOpenHire,
  selectedCategory,
  setSelectedCategory,
  searchQuery,
  setSearchQuery,
  triggerToast,
  isLoggedIn = false,
  onOpenAuth,
}: WorkersPageProps) {
  const { workerId } = useParams();
  const navigate = useNavigate();
  // --- ADDITIONAL FILTER STATES ---
  const [locationFilter, setLocationFilter] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState('All'); // All, Available Now, Part-time, Full-time
  const [minExperience, setMinExperience] = useState(0); // years
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sortBy, setSortBy] = useState('rating'); // rating, rate, experience
  const [remoteFilter, setRemoteFilter] = useState('All'); // All, Remote, On-site
  const [maxHourlyRate, setMaxHourlyRate] = useState(150); // up to $150
  const [ratingFilter, setRatingFilter] = useState('All'); // All, 4.5+, 4.8+, 5.0
  
  // --- UI TOGGLES ---
  const [showFiltersDrawer, setShowFiltersDrawer] = useState(false);
  const [selectedWorkerProfile, setSelectedWorkerProfile] = useState<Worker | null>(null);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Sync worker profile state with URL route parameter
  useEffect(() => {
    if (workerId) {
      const worker = workers.find(w => w.id === workerId);
      if (worker) {
        setSelectedWorkerProfile(worker);
      } else {
        setSelectedWorkerProfile(null);
        triggerToast("Worker profile not found.");
        navigate('/workers', { replace: true });
      }
    } else {
      setSelectedWorkerProfile(null);
    }
  }, [workerId, workers]);

  // Track selected worker profile view in Google Analytics
  useEffect(() => {
    if (selectedWorkerProfile) {
      analytics.trackProfileViewed('worker', selectedWorkerProfile.id, selectedWorkerProfile.name);
    }
  }, [selectedWorkerProfile]);

  const requireAuthGuard = (action: string, callback: () => void) => {
    if (isLoggedIn) {
      callback();
    } else {
      onOpenAuth?.('locked');
    }
  };

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Category list
  const categoriesList = ['All', 'Developer', 'Designer', 'Electrician', 'Carpenter', 'Driver', 'Chef', 'Teacher', 'Photographer', 'Mechanic', 'Cleaner'];

  // Popular suggested searches
  const suggestions = ['Figma', 'React', 'Electrician', 'Carpenter', 'Remote', 'San Francisco'];

  // Handle suggestion click
  const handleSuggestionClick = (term: string) => {
    setSearchQuery(term);
    setIsSearchFocused(false);
    triggerToast(`Searching for "${term}"`);
    analytics.trackSearch(term);
  };

  // --- ACTIVE FILTER COUNT CALCULATION ---
  const getActiveFiltersCount = () => {
    let count = 0;
    if (locationFilter) count++;
    if (availabilityFilter !== 'All') count++;
    if (minExperience > 0) count++;
    if (verifiedOnly) count++;
    if (remoteFilter !== 'All') count++;
    if (maxHourlyRate < 150) count++;
    if (ratingFilter !== 'All') count++;
    return count;
  };

  const activeFiltersCount = getActiveFiltersCount();

  // Reset all filters helper
  const handleResetFilters = () => {
    setLocationFilter('');
    setAvailabilityFilter('All');
    setMinExperience(0);
    setVerifiedOnly(false);
    setRemoteFilter('All');
    setMaxHourlyRate(150);
    setRatingFilter('All');
    setSelectedCategory(null);
    setSearchQuery('');
    setShowSavedOnly(false);
    triggerToast('All filters have been reset');
  };

  // --- FILTER & MATCH LOGIC ---
  const filteredWorkers = workers.filter(worker => {
    // 1. Search filter
    const matchesSearch = !searchQuery || 
      worker.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      worker.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      worker.bio.toLowerCase().includes(searchQuery.toLowerCase()) ||
      worker.skills.some(s => s.toLowerCase().includes(searchQuery.toLowerCase())) ||
      worker.location.toLowerCase().includes(searchQuery.toLowerCase());

    // 2. Category / Profession filter
    let matchesCategory = !selectedCategory || selectedCategory === 'All';
    if (selectedCategory && selectedCategory !== 'All') {
      const catLower = selectedCategory.toLowerCase();
      matchesCategory = worker.title.toLowerCase().includes(catLower) || 
        (selectedCategory === 'Developer' && worker.title.toLowerCase().includes('dev')) ||
        (selectedCategory === 'Designer' && worker.title.toLowerCase().includes('design')) ||
        (selectedCategory === 'Electrician' && worker.title.toLowerCase().includes('electric')) ||
        (selectedCategory === 'Carpenter' && worker.title.toLowerCase().includes('wood')) ||
        (selectedCategory === 'Photographer' && worker.title.toLowerCase().includes('photograph')) ||
        worker.skills.some(s => s.toLowerCase().includes(catLower));
    }

    // 3. Location filter
    const matchesLocation = !locationFilter || worker.location.toLowerCase().includes(locationFilter.toLowerCase());

    // 4. Availability filter
    const matchesAvailability = availabilityFilter === 'All' || worker.availability === availabilityFilter;

    // 5. Experience filter
    const matchesExperience = worker.experience >= minExperience;

    // 6. Verified filter
    const matchesVerified = !verifiedOnly || worker.verified;

    // 7. Remote/On-site filter
    const isRemoteWorker = worker.location.toLowerCase().includes('remote') || worker.bio.toLowerCase().includes('remote');
    const matchesRemote = remoteFilter === 'All' || 
      (remoteFilter === 'Remote' && isRemoteWorker) ||
      (remoteFilter === 'On-site' && !isRemoteWorker);

    // 8. Max Hourly Rate filter
    const matchesPrice = worker.hourlyRate <= maxHourlyRate;

    // 9. Min Rating filter
    const ratingThreshold = ratingFilter === 'All' ? 0 : parseFloat(ratingFilter);
    const matchesRating = worker.rating >= ratingThreshold;

    // 10. Saved only filter
    const matchesSaved = !showSavedOnly || (worker as any).bookmarked;

    return matchesSearch && matchesCategory && matchesLocation && matchesAvailability && 
           matchesExperience && matchesVerified && matchesRemote && matchesPrice && 
           matchesRating && matchesSaved;
  });

  // --- SORT LOGIC ---
  const sortedWorkers = [...filteredWorkers].sort((a, b) => {
    if (sortBy === 'rating') {
      return b.rating - a.rating;
    } else if (sortBy === 'rate') {
      return a.hourlyRate - b.hourlyRate; // Lowest rate first
    } else if (sortBy === 'experience') {
      return b.experience - a.experience; // Most experienced first
    }
    return 0;
  });

  const totalSavedCount = workers.filter(w => (w as any).bookmarked).length;

  return (
    <div className="w-full text-left font-sans max-w-7xl mx-auto px-1 sm:px-2 pb-[calc(110px+env(safe-area-inset-bottom))]" id="workers-discovery-container">
      
      {/* 1. Page Title & Subtitle */}
      <div className="space-y-1.5 mt-2">
        <div className="flex items-center space-x-2 bg-indigo-500/10 dark:bg-indigo-500/15 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full shadow-xs w-fit">
          <Users className="w-3.5 h-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-widest font-mono">TALENT NETWORK</span>
        </div>
        <h1 className="text-2xl sm:text-[28px] md:text-[34px] font-sans font-bold text-slate-900 dark:text-white flex items-center tracking-tight gap-2">
          <Users className="w-7 h-7 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span>Discover Professionals</span>
        </h1>
        <p className="text-[15px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
          Browse skilled professionals and connect with trusted talent.
        </p>
      </div>

      {/* 4. Sort + Action Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
        
        {/* Sort and Saved Toggle */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">Sort:</span>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="appearance-none text-xs font-semibold pl-1 pr-6 py-1 bg-transparent text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
              >
                <option value="rating">Top Rated</option>
                <option value="rate">Lowest Rate</option>
                <option value="experience">Experience</option>
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <span className="text-slate-300 dark:text-slate-800">|</span>

          {/* Saved Toggle Shortcut */}
          <button
            onClick={() => {
              setShowSavedOnly(!showSavedOnly);
              triggerToast(showSavedOnly ? "Showing all professionals" : "Showing saved professionals only");
            }}
            className={`text-xs font-semibold flex items-center space-x-1 transition-colors cursor-pointer ${
              showSavedOnly 
                ? 'text-purple-600 dark:text-purple-400 font-bold' 
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            <Bookmark className={`w-3.5 h-3.5 ${showSavedOnly ? 'fill-current text-purple-600 dark:text-purple-400' : 'text-slate-400'}`} />
            <span>Saved ({totalSavedCount})</span>
          </button>
        </div>

        {/* Matching Count Tag */}
        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
          {totalSavedCount} saved expert{totalSavedCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* 2. DYNAMIC FULL-WIDTH SEARCH BAR & RECOMMENDATIONS */}
      <div className="relative my-4">
        <div className="relative rounded-[16px] bg-white dark:bg-[#1C152B] border border-slate-200/95 dark:border-purple-500/15 p-1 flex items-center h-[52px] shadow-[0_10px_25px_rgba(20,20,40,0.05)] dark:shadow-[0_12px_30px_rgba(0,0,0,0.25)] transition-all focus-within:border-[#7C3AED] focus-within:ring-4 focus-within:ring-[#7C3AED]/10">
          <Search className="w-5 h-5 text-slate-400 dark:text-purple-400/75 ml-3.5 mr-2.5 shrink-0" />
          <input 
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
            placeholder="Search name, profession, skill or location..."
            className="w-full py-1.5 text-xs sm:text-sm bg-transparent border-none focus:outline-none focus:ring-0 text-slate-900 dark:text-slate-50 placeholder-slate-400/90 dark:placeholder-slate-500/90 font-medium font-sans"
          />
          
          {searchQuery && (
            <button 
              type="button"
              onClick={() => setSearchQuery('')}
              className="p-1.5 mr-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Dedicated Filter Trigger */}
          <button
            onClick={() => setShowFiltersDrawer(true)}
            className={`h-9 px-3.5 rounded-lg flex items-center space-x-1.5 text-xs font-semibold transition-all cursor-pointer shrink-0 ${
              activeFiltersCount > 0
                ? 'bg-gradient-to-r from-[#2563EB] to-[#7C3AED] text-white shadow-[0_8px_25px_rgba(124,58,237,0.25)] hover:-translate-y-0.5'
                : 'bg-slate-50 dark:bg-[#2C243A] text-slate-700 dark:text-purple-200/95 border border-slate-200/80 dark:border-purple-500/10 hover:bg-slate-100 dark:hover:bg-purple-950/45'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
            {activeFiltersCount > 0 && (
              <span className="bg-white text-indigo-600 w-4.5 h-4.5 rounded-full flex items-center justify-center text-[10px] font-extrabold">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        {/* Inline popular search tags appearing on focus */}
        <AnimatePresence>
          {isSearchFocused && !searchQuery && (
            <motion.div 
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="absolute left-0 right-0 mt-1.5 p-3 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg z-20"
            >
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono">POPULAR SEARCHES:</span>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {suggestions.map((term) => (
                  <button
                    key={term}
                    onClick={() => handleSuggestionClick(term)}
                    className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-300 rounded-lg transition-colors cursor-pointer"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. CATEGORY SCROLLABLE CHIPS */}
      <div className="w-full overflow-x-auto whitespace-nowrap flex items-center space-x-1.5 pb-1 scrollbar-none">
        {categoriesList.map((cat) => {
          const isSelected = selectedCategory === cat || (cat === 'All' && !selectedCategory);
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat === 'All' ? null : cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-normal border transition-all cursor-pointer shrink-0 ${
                isSelected 
                  ? 'bg-blue-600 border-blue-600 text-white shadow-sm' 
                  : 'bg-white dark:bg-[#111827] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Active Filter summary tags if any are active */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-3 text-xs text-slate-500 dark:text-slate-400">
          {locationFilter && (
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[11px]">
              <span className="inline-flex items-center"><MapPin className="w-3 h-3 text-indigo-500 mr-1" />{locationFilter}</span>
              <button onClick={() => setLocationFilter('')} className="hover:text-red-500 ml-1"><X className="w-3 h-3" /></button>
            </span>
          )}
          {availabilityFilter !== 'All' && (
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[11px]">
              <span className="inline-flex items-center"><Clock className="w-3 h-3 text-indigo-500 mr-1" />{availabilityFilter}</span>
              <button onClick={() => setAvailabilityFilter('All')} className="hover:text-red-500 ml-1"><X className="w-3 h-3" /></button>
            </span>
          )}
          {minExperience > 0 && (
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[11px]">
              <span className="inline-flex items-center"><Award className="w-3 h-3 text-indigo-500 mr-1" />{minExperience}+ Yrs</span>
              <button onClick={() => setMinExperience(0)} className="hover:text-red-500 ml-1"><X className="w-3 h-3" /></button>
            </span>
          )}
          {verifiedOnly && (
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[11px]">
              <span className="inline-flex items-center"><ShieldCheck className="w-3 h-3 text-indigo-500 mr-1" />Verified</span>
              <button onClick={() => setVerifiedOnly(false)} className="hover:text-red-500 ml-1"><X className="w-3 h-3" /></button>
            </span>
          )}
          {remoteFilter !== 'All' && (
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[11px]">
              <span className="inline-flex items-center"><Globe className="w-3 h-3 text-indigo-500 mr-1" />{remoteFilter}</span>
              <button onClick={() => setRemoteFilter('All')} className="hover:text-red-500 ml-1"><X className="w-3 h-3" /></button>
            </span>
          )}
          {maxHourlyRate < 150 && (
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[11px]">
              <span className="inline-flex items-center"><DollarSign className="w-3 h-3 text-indigo-500 mr-1" />Max ${maxHourlyRate}/hr</span>
              <button onClick={() => setMaxHourlyRate(150)} className="hover:text-red-500 ml-1"><X className="w-3 h-3" /></button>
            </span>
          )}
          {ratingFilter !== 'All' && (
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[11px]">
              <span className="inline-flex items-center"><Star className="w-3 h-3 text-amber-500 fill-amber-400 mr-1" />{ratingFilter}+ Rating</span>
              <button onClick={() => setRatingFilter('All')} className="hover:text-red-500 ml-1"><X className="w-3 h-3" /></button>
            </span>
          )}
          <button 
            onClick={handleResetFilters}
            className="text-xs text-indigo-500 dark:text-indigo-400 hover:underline font-bold ml-1 cursor-pointer"
          >
            Clear All
          </button>
        </div>
      )}

      {/* 4. WORKERS VERTICAL GRID (2 cols Desktop, 1 Mobile) */}
      <div className="mt-4">
        {sortedWorkers.length === 0 ? (
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center text-slate-500 dark:text-slate-400 max-w-lg mx-auto shadow-sm mt-6">
            <div className="bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserCheck className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">No professionals found</h3>
            <p className="text-xs mt-2 text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
              We couldn't find any professionals matching your exact criteria. Try removing some filters or resetting.
            </p>
            <button 
              onClick={handleResetFilters}
              className="mt-5 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-xs hover:opacity-95 transition-all cursor-pointer shadow-md"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
              {sortedWorkers.map((worker) => {
                const isBookmarked = (worker as any).bookmarked || false;
                return (
                  <WorkerCard
                    key={worker.id}
                    id={worker.id}
                    name={worker.name}
                    avatarUrl={worker.photo}
                    verified={worker.verified}
                    professionalTitle={worker.title}
                    rating={worker.rating}
                    experienceYears={worker.experience}
                    hourlyRate={worker.hourlyRate}
                    shortBio={worker.bio}
                    location={worker.location}
                    availability={worker.availability}
                    saved={isBookmarked}
                    onSave={toggleWorkerBookmark}
                    onViewProfile={() => navigate(`/workers/${worker.id}`)}
                    onMessage={() => {
                      requireAuthGuard('Message Worker', () => onOpenMessage(worker.name));
                    }}
                  />
                );
              })}
            </div>
        )}
      </div>

      {/* 5. UNIFIED FILTERS DRAWER (Popover on Desktop, Bottom Sheet on Mobile) */}
      <AnimatePresence>
        {showFiltersDrawer && (
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 dark:bg-slate-950/60 backdrop-blur-xs">
            {/* Click-out backdrop */}
            <div className="absolute inset-0" onClick={() => setShowFiltersDrawer(false)} />
            
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="absolute top-0 bottom-0 right-0 w-full max-w-md bg-white dark:bg-[#111827] border-l border-slate-200 dark:border-[#1E293B] shadow-2xl flex flex-col z-30"
            >
              {/* Drawer Header */}
              <div className="p-5 border-b border-slate-100 dark:border-[#1E293B] flex justify-between items-center bg-slate-50/50 dark:bg-[#0F172A]/40">
                <div className="flex items-center space-x-2">
                  <Filter className="w-4 h-4 text-indigo-500" />
                  <span className="font-display font-extrabold text-sm sm:text-base text-slate-900 dark:text-white uppercase tracking-wider">Refine Discovery</span>
                </div>
                <button 
                  onClick={() => setShowFiltersDrawer(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 text-left">
                {/* Max Hourly Rate slider */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">Max Hourly Rate</label>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 font-mono">${maxHourlyRate}/hr</span>
                  </div>
                  <input 
                    type="range"
                    min="20"
                    max="150"
                    step="5"
                    value={maxHourlyRate}
                    onChange={(e) => setMaxHourlyRate(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                    <span>$20/hr</span>
                    <span>$150/hr</span>
                  </div>
                </div>

                {/* Location Input */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">Target Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text"
                      value={locationFilter}
                      onChange={(e) => setLocationFilter(e.target.value)}
                      placeholder="e.g. San Francisco or Remote"
                      className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-950 dark:text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Remote / On-Site filter (Segmented Control) */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">Working Method</label>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl">
                    {['All', 'Remote', 'On-site'].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setRemoteFilter(opt)}
                        className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          remoteFilter === opt 
                            ? 'bg-white dark:bg-[#1E293B] text-indigo-600 dark:text-white shadow-xs' 
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Min Rating filter */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">Minimum Rating</label>
                  <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl">
                    {['All', '4.5', '4.8', '5.0'].map((val) => (
                      <button
                        key={val}
                        onClick={() => setRatingFilter(val)}
                        className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          ratingFilter === val 
                            ? 'bg-white dark:bg-[#1E293B] text-indigo-600 dark:text-white shadow-xs' 
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                        }`}
                      >
                        {val === 'All' ? 'All' : `${val}+ Stars`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Min Experience Range slider */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">Minimum Experience</label>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 font-mono">{minExperience}+ yrs</span>
                  </div>
                  <input 
                    type="range"
                    min="0"
                    max="15"
                    value={minExperience}
                    onChange={(e) => setMinExperience(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                    <span>Entry (0)</span>
                    <span>Expert (15+)</span>
                  </div>
                </div>

                {/* Availability Checklist */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">Availability State</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['All', 'Available Now', 'Part-time', 'Full-time'].map((av) => (
                      <button
                        key={av}
                        onClick={() => setAvailabilityFilter(av)}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold text-center border transition-all cursor-pointer ${
                          availabilityFilter === av 
                            ? 'bg-indigo-500/10 border-indigo-500 text-indigo-600 dark:text-indigo-400' 
                            : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-[#1E293B] text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {av}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Verified Only Quality Seal */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">Vetting Check</label>
                  <button
                    onClick={() => setVerifiedOnly(!verifiedOnly)}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold border flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                      verifiedOnly 
                        ? 'bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400 font-bold' 
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-[#1E293B] text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>Verified Pros Only</span>
                  </button>
                </div>
              </div>

              {/* Drawer Footer Actions */}
              <div className="p-5 border-t border-slate-100 dark:border-[#1E293B] flex gap-3 bg-slate-50/50 dark:bg-[#0F172A]/40">
                <button
                  onClick={handleResetFilters}
                  className="w-1/3 py-3 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 text-center hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  Clear All
                </button>
                <button
                  onClick={() => setShowFiltersDrawer(false)}
                  className="w-2/3 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs font-bold text-center shadow-md hover:opacity-95 cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-all"
                >
                  Apply ({sortedWorkers.length} Matches)
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. IMMERSIVE WORKER PROFILE DETAIL PANEL (Full-page slideover drawer) */}
      <AnimatePresence>
        {selectedWorkerProfile && (
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 dark:bg-slate-950/70 backdrop-blur-md">
            {/* Backdrop click to close */}
            <div className="absolute inset-0" onClick={() => workerId ? navigate('/workers') : setSelectedWorkerProfile(null)} />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 190 }}
              className="absolute top-0 bottom-0 right-0 w-full max-w-2xl bg-slate-50 dark:bg-[#0B1020] shadow-2xl flex flex-col z-40 overflow-hidden"
            >
              {/* Header Floating Action */}
              <div className="absolute top-4 left-4 z-50">
                <button
                  onClick={() => workerId ? navigate('/workers') : setSelectedWorkerProfile(null)}
                  className="p-2.5 bg-white/90 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-full shadow-lg border border-slate-200/50 dark:border-slate-800 flex items-center justify-center cursor-pointer transition-all hover:scale-105"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  <span className="text-xs font-bold pr-1">Back to Discovery</span>
                </button>
              </div>

              {/* Scrollable Container */}
              <div className="flex-1 overflow-y-auto pb-24">
                
                {/* 1. Profile Banner Hero */}
                <div className="h-44 sm:h-52 bg-gradient-to-tr from-blue-600/20 via-indigo-600/10 to-purple-600/30 dark:from-blue-950/60 dark:via-indigo-950/40 dark:to-purple-950/50 relative overflow-hidden flex items-end">
                  <div className="absolute inset-0 bg-grid-pattern opacity-10" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-50 dark:from-[#0B1020] to-transparent" />
                </div>

                {/* 2. Overlapping Profile Identity */}
                <div className="px-6 -mt-16 sm:-mt-20 relative z-10 text-left">
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <img 
                      src={selectedWorkerProfile.photo} 
                      alt={selectedWorkerProfile.name} 
                      referrerPolicy="no-referrer"
                      className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-4 border-slate-50 dark:border-[#0B1020] shadow-xl"
                    />
                    
                    {/* Top action flags */}
                    <div className="flex space-x-2 pb-1">
                      {selectedWorkerProfile.verified && (
                        <span className="inline-flex items-center px-3 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-extrabold border border-blue-500/10">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-blue-500" />
                          Verified Expert
                        </span>
                      )}
                      <span className="inline-flex items-center px-3 py-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl text-xs font-extrabold border border-purple-500/10">
                        {selectedWorkerProfile.availability}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <h2 className="text-2xl sm:text-3xl font-display font-black text-slate-900 dark:text-white leading-tight">
                      {selectedWorkerProfile.name}
                    </h2>
                    <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest font-mono mt-1">
                      {selectedWorkerProfile.title}
                    </p>
                    
                    <div className="flex items-center space-x-2 text-xs text-slate-400 mt-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-medium text-slate-600 dark:text-slate-300">{selectedWorkerProfile.location}</span>
                    </div>
                  </div>
                </div>

                {/* 3. Horizontal Stats Summary Cards */}
                <div className="px-6 grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
                  <div className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-[#1E293B] p-3.5 rounded-2xl shadow-xs text-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Hourly Rate</span>
                    <strong className="block text-lg font-black text-slate-900 dark:text-white mt-1">${selectedWorkerProfile.hourlyRate}/hr</strong>
                  </div>
                  <div className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-[#1E293B] p-3.5 rounded-2xl shadow-xs text-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Expert Rating</span>
                    <div className="flex items-center justify-center space-x-1 mt-1 text-amber-500">
                      <Star className="w-4 h-4 fill-current text-amber-400" />
                      <strong className="text-lg font-black text-slate-900 dark:text-white">{selectedWorkerProfile.rating.toFixed(1)}</strong>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-[#1E293B] p-3.5 rounded-2xl shadow-xs text-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Experience</span>
                    <strong className="block text-lg font-black text-slate-900 dark:text-white mt-1">{selectedWorkerProfile.experience} Years</strong>
                  </div>
                  <div className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-[#1E293B] p-3.5 rounded-2xl shadow-xs text-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Escrows Done</span>
                    <strong className="block text-lg font-black text-slate-900 dark:text-white mt-1">{selectedWorkerProfile.completedWorks} Jobs</strong>
                  </div>
                </div>

                {/* 4. Professional Details Sections */}
                <div className="px-6 mt-6 space-y-6 text-left">
                  
                  {/* Bio */}
                  <div className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-[#1E293B] p-5 rounded-2xl">
                    <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono mb-2.5">About Professional</h3>
                    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-normal whitespace-pre-line">
                      {selectedWorkerProfile.bio}
                    </p>
                  </div>

                  {/* Skills Tag Cloud */}
                  <div className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-[#1E293B] p-5 rounded-2xl">
                    <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono mb-3">Skills & Verified Tools</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedWorkerProfile.skills.map((skill, index) => (
                        <span 
                          key={index} 
                          className="px-3.5 py-1.5 bg-indigo-500/5 dark:bg-indigo-500/10 text-xs font-mono font-medium text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-500/10"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Mock Experience History */}
                  <div className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-[#1E293B] p-5 rounded-2xl space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono border-b border-slate-100 dark:border-slate-800 pb-2 mb-1">Work & Engagement History</h3>
                    
                    <div className="flex space-x-3 text-left">
                      <div className="pt-1.5"><Briefcase className="w-4 h-4 text-slate-400" /></div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">Independent Escrow Contractor</h4>
                        <p className="text-[11px] text-indigo-500 font-bold">OpenComm Marketplace &bull; 2024 - Present</p>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">Conducted numerous contracts matching requirements, building smart contracts, performing local electrician diagnostics, and designing high-performing UX frameworks.</p>
                      </div>
                    </div>

                    <div className="flex space-x-3 text-left pt-2">
                      <div className="pt-1.5"><Clock className="w-4 h-4 text-slate-400" /></div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">Senior Professional Consultant</h4>
                        <p className="text-[11px] text-slate-400">Previous Corporate Engagements &bull; 2018 - 2024</p>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">Operated high-end engineering frameworks, building digital structures, maintaining safe electricity loads, or crafting wood structures for bespoke houses.</p>
                      </div>
                    </div>
                  </div>

                  {/* Mock Client Reviews */}
                  <div className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-[#1E293B] p-5 rounded-2xl space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono border-b border-slate-100 dark:border-slate-800/80 pb-2 mb-1">
                      Verified Client Reviews
                    </h3>

                    {/* Testimonial 1 */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <div className="bg-indigo-600 text-white font-mono text-[9px] w-5 h-5 rounded-full flex items-center justify-center font-bold">R</div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white">Rahul Sharma</span>
                        </div>
                        <div className="flex text-amber-400">
                          <Star className="w-3 h-3 fill-current" />
                          <Star className="w-3 h-3 fill-current" />
                          <Star className="w-3 h-3 fill-current" />
                          <Star className="w-3 h-3 fill-current" />
                          <Star className="w-3 h-3 fill-current" />
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 italic pl-6 leading-relaxed">
                        "Outstanding craft! Handled our payment milestone integration ahead of schedule and with perfect detail. Would hire again."
                      </p>
                    </div>

                    {/* Testimonial 2 */}
                    <div className="space-y-1.5 pt-3 border-t border-slate-50 dark:border-slate-800/60">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <div className="bg-purple-600 text-white font-mono text-[9px] w-5 h-5 rounded-full flex items-center justify-center font-bold">E</div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white">Emily Chen</span>
                        </div>
                        <div className="flex text-amber-400">
                          <Star className="w-3 h-3 fill-current" />
                          <Star className="w-3 h-3 fill-current" />
                          <Star className="w-3 h-3 fill-current" />
                          <Star className="w-3 h-3 fill-current" />
                          <Star className="w-3 h-3 fill-current" />
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 italic pl-6 leading-relaxed">
                        "Superb communicator and extremely professional. The work exceeds expectations. Thank you!"
                      </p>
                    </div>
                  </div>

                </div>

              </div>

              {/* Drawer Sticky Footer Actions */}
              <div className="absolute bottom-0 left-0 right-0 p-5 bg-white dark:bg-[#111827] border-t border-slate-200 dark:border-[#1E293B] shadow-2xl flex items-center justify-between gap-4">
                <div className="text-left">
                  <span className="text-[9px] text-slate-400 uppercase tracking-widest font-mono font-bold block">HOURLY RATE</span>
                  <div className="flex items-baseline">
                    <strong className="text-xl font-extrabold text-slate-950 dark:text-white">${selectedWorkerProfile.hourlyRate}</strong>
                    <span className="text-[10px] text-slate-400 font-mono">/hr</span>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button 
                    onClick={() => {
                      requireAuthGuard('Message Worker', () => {
                        setSelectedWorkerProfile(null);
                        onOpenMessage(selectedWorkerProfile.name);
                      });
                    }}
                    className="px-4 py-3 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 transition-all flex items-center space-x-1 cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4 text-slate-400" />
                    <span>Send Message</span>
                  </button>

                  <button 
                    onClick={(e) => {
                      requireAuthGuard('Hire Worker', () => {
                        setSelectedWorkerProfile(null);
                        onOpenHire(selectedWorkerProfile, e);
                      });
                    }}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-extrabold shadow-md transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Send Hiring Request
                  </button>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
