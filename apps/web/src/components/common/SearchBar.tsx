import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function SearchBar({
  value,
  onChange,
  onClear,
  onSubmit,
}: SearchBarProps) {
  return (
    <form onSubmit={onSubmit} className="mb-6 sm:mb-8 w-full max-w-full sm:max-w-[92%] md:max-w-[80%] lg:max-w-[75%] mx-auto transition-all">
      <div className="relative h-[52px] rounded-[16px] bg-white dark:bg-[#1C152B] border border-slate-200/90 dark:border-purple-500/15 shadow-[0_10px_25px_rgba(20,20,40,0.05)] dark:shadow-[0_12px_30px_rgba(0,0,0,0.25)] hover:border-[#7C3AED]/35 px-3.5 flex items-center transition-all duration-300 focus-within:border-[#7C3AED] focus-within:ring-4 focus-within:ring-[#7C3AED]/10 focus-within:shadow-[0_12px_30px_rgba(124,58,237,0.15)]">
        
        {/* Prominent Search Icon */}
        <Search className="w-5 h-5 text-slate-400 dark:text-purple-400/75 ml-1.5 mr-3 shrink-0 transition-colors duration-300 focus-within:text-[#7C3AED]" />
        
        <input 
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search jobs, workers, companies, or skills..."
          className="w-full h-full bg-transparent border-none focus:outline-none focus:ring-0 text-xs sm:text-sm text-[#0F172A] dark:text-[#F8FAFC] placeholder-slate-400/90 dark:placeholder-slate-500/90 font-medium px-1 font-sans"
        />
        
        {value && (
          <button 
            type="button"
            onClick={onClear}
            className="p-1.5 mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
            title="Clear Search"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Search button: full text on desktop, compact icon on mobile */}
        <button
          type="submit"
          className="h-9 px-4 sm:h-9.5 sm:px-5 rounded-[12px] bg-gradient-to-r from-[#2563EB] to-[#7C3AED] hover:opacity-95 text-white text-xs sm:text-xs font-bold tracking-wide shadow-[0_8px_25px_rgba(124,58,237,0.25)] hover:-translate-y-0.5 transition-all shrink-0 cursor-pointer flex items-center justify-center space-x-1"
        >
          <Search className="w-4 h-4 sm:hidden shrink-0" />
          <span className="hidden sm:inline">Search</span>
        </button>
      </div>
    </form>
  );
}
