import React from 'react';
import { motion } from 'motion/react';
import { Bookmark, Star, MapPin, Trash2, MessageSquare, Award, Inbox, CheckCircle2 } from 'lucide-react';
import { Worker } from '../../types';

interface SavedWorkersPageProps {
  workers: Worker[];
  toggleWorkerBookmark: (id: string, e: React.MouseEvent) => void;
  onOpenMessage: (name: string) => void;
  onOpenHire: (worker: Worker, e: React.MouseEvent) => void;
  onExplore: () => void;
}

export default function SavedWorkersPage({
  workers,
  toggleWorkerBookmark,
  onOpenMessage,
  onOpenHire,
  onExplore,
}: SavedWorkersPageProps) {
  const savedList = workers.filter(w => (w as any).bookmarked);

  return (
    <div className="w-full text-left" id="saved-workers-container">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white flex items-center">
          <Bookmark className="w-7 h-7 mr-2.5 text-purple-500 fill-current" />
          Saved Professionals
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Keep track of local skilled providers and contractors you have bookmarked.
        </p>
      </div>

      {savedList.length === 0 ? (
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#273449] rounded-2xl p-12 text-center max-w-lg mx-auto mt-8 shadow-xs">
          <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 mx-auto mb-4">
            <Inbox className="w-8 h-8" />
          </div>
          <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">You have not saved any workers yet.</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-xs mx-auto leading-relaxed">
            Discover verified experts and click the bookmark icon on any worker profile card to save them here.
          </p>
          <button 
            onClick={onExplore}
            className="mt-5 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer hover:scale-103 active:scale-97"
          >
            Explore Active Workers
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl">
          {savedList.map((worker) => (
            <motion.div
              key={worker.id}
              layoutId={`saved-worker-card-${worker.id}`}
              className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#273449]/70 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-4 text-left shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start space-x-3.5">
                <img 
                  src={worker.photo} 
                  alt={worker.name} 
                  referrerPolicy="no-referrer"
                  className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-slate-800 shrink-0"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">{worker.name}</span>
                    {worker.verified && (
                      <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[8px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
                        <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> VERIFIED
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 font-mono uppercase tracking-wide leading-none">{worker.title}</p>
                  
                  <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-[10px] font-mono text-slate-500 dark:text-slate-400 pt-1">
                    <span className="flex items-center text-amber-500 font-bold"><Star className="w-3 h-3 mr-0.5 fill-current" /> {worker.rating}</span>
                    <span className="flex items-center"><MapPin className="w-3 h-3 mr-0.5" /> {worker.location}</span>
                    <span className="flex items-center"><Award className="w-3 h-3 mr-0.5" /> {worker.experience} yrs</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-3.5 mt-1 shrink-0">
                <button
                  onClick={(e) => toggleWorkerBookmark(worker.id, e)}
                  className="px-2.5 py-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                  title="Remove Bookmark"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Remove</span>
                </button>

                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => onOpenMessage(worker.name)}
                    className="p-2.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer"
                    title="Send Message"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>

                  <button 
                    onClick={(e) => onOpenHire(worker, e)}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-xs font-bold shadow-xs hover:opacity-95 transition-all cursor-pointer hover:scale-103 active:scale-97"
                  >
                    Hire Pro (${worker.hourlyRate}/hr)
                  </button>
                </div>
              </div>

            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
