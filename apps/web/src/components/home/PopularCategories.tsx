import React from 'react';
import { motion } from 'motion/react';
import { 
  Code, Palette, Zap, Hammer, Car, Utensils, 
  GraduationCap, Camera, Wrench, Sparkles 
} from 'lucide-react';

interface PopularCategoriesProps {
  onCategorySelect: (categoryName: string) => void;
  selectedCategory: string | null;
}

export default function PopularCategories({
  onCategorySelect,
  selectedCategory,
}: PopularCategoriesProps) {
  const categoriesList = [
    { name: 'Developer', icon: Code, count: 142, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-950/30' },
    { name: 'Designer', icon: Palette, count: 98, color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-950/30' },
    { name: 'Electrician', icon: Zap, count: 34, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-950/30' },
    { name: 'Carpenter', icon: Hammer, count: 27, color: 'text-orange-500 bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-950/30' },
    { name: 'Driver', icon: Car, count: 56, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-950/30' },
    { name: 'Chef', icon: Utensils, count: 41, color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-950/30' },
    { name: 'Teacher', icon: GraduationCap, count: 73, color: 'text-sky-500 bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-950/30' },
    { name: 'Photographer', icon: Camera, count: 48, color: 'text-violet-500 bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-950/30' },
    { name: 'Mechanic', icon: Wrench, count: 19, color: 'text-zinc-500 bg-zinc-50 dark:bg-zinc-950/20 border-zinc-200 dark:border-zinc-950/30' },
    { name: 'Cleaner', icon: Sparkles, count: 62, color: 'text-teal-500 bg-teal-50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-950/30' },
  ];

  return (
    <div className="mb-10 w-full text-left">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">
          Popular Categories
        </h3>
        {selectedCategory && (
          <button
            onClick={() => onCategorySelect('')}
            className="text-xs text-blue-500 hover:underline cursor-pointer"
          >
            Clear category filter
          </button>
        )}
      </div>

      {/* 2 columns on mobile, 5 columns on desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {categoriesList.map((cat) => {
          const IconComponent = cat.icon;
          const isSelected = selectedCategory === cat.name;

          return (
            <motion.div
              key={cat.name}
              whileHover={{ y: -2, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onCategorySelect(cat.name)}
              className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all duration-200 flex items-center space-x-3 ${
                isSelected 
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 border-transparent text-white shadow-md' 
                  : 'bg-white dark:bg-[#111827] border-slate-200 dark:border-[#273449]/70 hover:border-slate-300 dark:hover:border-slate-700 text-slate-800 dark:text-slate-200'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <div className={`p-2 rounded-xl shrink-0 ${
                isSelected 
                  ? 'bg-white/20 text-white' 
                  : cat.color
              }`}>
                <IconComponent className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="block text-xs sm:text-sm font-semibold truncate leading-tight">
                  {cat.name}
                </span>
                <span className={`block text-[10px] mt-0.5 ${
                  isSelected ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'
                }`}>
                  {cat.count} listings
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
