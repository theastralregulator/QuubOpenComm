import React from 'react';
import { Globe, Shield, ArrowLeft } from 'lucide-react';

interface CookiePolicyPageProps {
  navigate?: (path: string) => void;
}

export default function CookiePolicyPage({ navigate }: CookiePolicyPageProps) {
  return (
    <div className="max-w-4xl mx-auto py-8 sm:py-12 px-4 sm:px-6 lg:px-8 text-left animate-fadeIn">
      {navigate && (
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center space-x-2 text-xs font-bold text-slate-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors mb-6 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </button>
      )}

      <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-6 sm:p-10 shadow-xl space-y-8 relative overflow-hidden">
        {/* Decorative Top Accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-600 to-indigo-600" />

        <div className="flex items-center space-x-4 border-b border-slate-100 dark:border-zinc-800 pb-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/15 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              OpenComm Cookie Policy
            </h1>
            <p className="text-[10px] sm:text-xs text-slate-400 dark:text-zinc-500 font-mono font-bold mt-1">
              EFFECTIVE DATE: July 19, 2026
            </p>
          </div>
        </div>

        <div className="text-xs sm:text-sm text-slate-600 dark:text-zinc-300 space-y-6 leading-relaxed font-medium">
          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">1. Introduction</h2>
            <p>OpenComm uses cookies and local storage to personalize your browsing experience, keep you logged in, and analyze Platform usage traffic.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">2. Essential Cookies and Storage</h2>
            <p>Essential tokens are required for the security, stability, and core operations of the Platform. These cannot be disabled because they maintain your secure login state and prevent cross-site request forgery. They do not store any personal identity details.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">3. Authentication and Session Storage</h2>
            <p>When you log in, Supabase Auth stores user tokens inside your browser local storage. This allows your session to stay active as you navigate between pages without prompting for your credentials repeatedly. Disabling local storage will prevent you from signing in.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">4. Preference Storage</h2>
            <p>We use local storage keys (such as theme and user configuration options) to remember settings, including whether you prefer Light Mode or Dark Mode, so the interface remains consistent across sessions.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">5. Analytics Cookies</h2>
            <p>With your consent, Google Analytics sets cookies to gather data about how many users visit specific pages, how long they stay, and what buttons they interact with. This data is strictly aggregated and anonymized.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">6. Third-Party Services</h2>
            <p>Our hosting provider (Vercel) and database engine (Supabase) may place functional cookies or session tokens to deliver web content securely and optimize load balancing.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">7. How Users Can Control Cookies</h2>
            <p>Most web browsers allow you to manage cookies through their settings panel. You can block all cookies, delete existing cookies, or choose which types are permitted. Please note that blocking essential authentication cookies will prevent you from signing in to OpenComm.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
