import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Compass, Home, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-16 text-center">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="max-w-md w-full space-y-8 bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#273449]/40 p-8 sm:p-10 rounded-3xl shadow-xl"
      >
        {/* Brand logo style 404 badge */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#2563EB] to-[#7C3AED] flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Compass className="w-8 h-8 text-white animate-spin-slow" />
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-6xl font-black bg-gradient-to-r from-[#2563EB] to-[#7C3AED] bg-clip-text text-transparent tracking-tight">
            404
          </h1>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Page not found
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
            Sorry, the page you are looking for doesn't exist, was removed, or is temporarily unavailable.
          </p>
        </div>

        <div className="pt-4 grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center space-x-2 h-11 rounded-xl border border-slate-200 dark:border-[#273449] hover:bg-slate-50 dark:hover:bg-slate-800/50 text-xs font-bold text-[#475569] dark:text-slate-200 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go Back</span>
          </button>
          
          <button
            onClick={() => navigate('/')}
            className="flex items-center justify-center space-x-2 h-11 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#2563EB] to-[#7C3AED] hover:opacity-95 shadow-md shadow-blue-500/15 hover:shadow-blue-500/25 transition-all cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Go Home</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
