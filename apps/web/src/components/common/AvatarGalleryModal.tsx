import React, { useState } from 'react';
import { X, Search, Check, Sparkles, User } from 'lucide-react';
import { PRESET_AVATARS, PresetAvatar } from '../../data/presetAvatars';

interface AvatarGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAvatar: (avatarUrl: string) => void;
  selectedAvatarUrl?: string;
}

export default function AvatarGalleryModal({
  isOpen,
  onClose,
  onSelectAvatar,
  selectedAvatarUrl
}: AvatarGalleryModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');
  const [tempSelected, setTempSelected] = useState<string>(selectedAvatarUrl || PRESET_AVATARS[0].url);

  if (!isOpen) return null;

  const filteredAvatars = PRESET_AVATARS.filter(avatar => {
    const matchesGender = genderFilter === 'all' || avatar.gender === genderFilter || avatar.gender === 'neutral';
    const matchesSearch = 
      avatar.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      avatar.profession.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesGender && matchesSearch;
  });

  const handleConfirm = () => {
    onSelectAvatar(tempSelected);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden relative text-left">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50/50 dark:bg-zinc-950/40">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/10 dark:bg-indigo-500/15 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">Choose Professional Avatar</h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">Select from 50+ modern, commercial-safe professional avatars</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Gender Filter Controls */}
        <div className="p-4 border-b border-slate-100 dark:border-zinc-800 space-y-3 bg-white dark:bg-zinc-900">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search profession e.g. Developer, Designer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Gender Filter Pills */}
            <div className="flex bg-slate-100 dark:bg-zinc-950 p-1 rounded-xl w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setGenderFilter('all')}
                className={`flex-1 sm:flex-none px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  genderFilter === 'all'
                    ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All ({PRESET_AVATARS.length})
              </button>
              <button
                type="button"
                onClick={() => setGenderFilter('female')}
                className={`flex-1 sm:flex-none px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  genderFilter === 'female'
                    ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Female
              </button>
              <button
                type="button"
                onClick={() => setGenderFilter('male')}
                className={`flex-1 sm:flex-none px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  genderFilter === 'male'
                    ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Male
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Avatars Grid */}
        <div className="p-4 overflow-y-auto flex-1 max-h-[420px] scrollbar-thin">
          {filteredAvatars.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-zinc-500 space-y-2">
              <User className="w-8 h-8 mx-auto opacity-50" />
              <p className="text-xs font-semibold">No avatars found matching "{searchQuery}".</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {filteredAvatars.map((avatar) => {
                const isSelected = tempSelected === avatar.url;
                return (
                  <button
                    key={avatar.id}
                    type="button"
                    onClick={() => setTempSelected(avatar.url)}
                    className={`group relative p-2.5 rounded-2xl border transition-all flex flex-col items-center cursor-pointer ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-500/10 dark:bg-indigo-500/15 ring-2 ring-indigo-500/30'
                        : 'border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/40 hover:border-indigo-400 dark:hover:border-zinc-700'
                    }`}
                  >
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden bg-white dark:bg-zinc-800 p-1 mb-1.5 shadow-xs transition-transform group-hover:scale-105">
                      <img
                        src={avatar.url}
                        alt={avatar.name}
                        className="w-full h-full object-cover rounded-full"
                        loading="lazy"
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200 truncate w-full text-center leading-tight">
                      {avatar.name.split(' ')[0]}
                    </span>
                    <span className="text-[8px] text-slate-400 dark:text-zinc-500 truncate w-full text-center">
                      {avatar.profession}
                    </span>

                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                        <Check className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/40 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="w-9 h-9 rounded-full overflow-hidden border border-indigo-500/30 bg-white dark:bg-zinc-800 p-0.5">
              <img src={tempSelected} alt="Selected preview" className="w-full h-full object-cover rounded-full" />
            </div>
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Avatar Selected</span>
          </div>

          <div className="flex space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer flex items-center space-x-1.5"
            >
              <span>Use This Avatar</span>
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
