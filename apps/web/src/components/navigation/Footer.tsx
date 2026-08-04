import React from 'react';
import { ShieldCheck, Mail, HelpCircle, FileText, Lock, Globe, Info } from 'lucide-react';
import OpenCommLogo from '../common/OpenCommLogo';

interface FooterProps {
  navigate?: (path: string) => void;
}

export default function Footer({ navigate }: FooterProps) {
  const handleLinkClick = (path: string, e: React.MouseEvent) => {
    if (navigate) {
      e.preventDefault();
      navigate(path);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <footer className="w-full bg-white dark:bg-[#080B18] border-t border-slate-200/70 dark:border-[#273449]/40 mt-12 py-6 transition-all duration-300">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center space-x-2">
            <OpenCommLogo variant="footer" onClick={(e?: any) => handleLinkClick('/', e)} />
          </div>

          {/* Core Navigation Links */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <a
              href="/about"
              onClick={(e) => handleLinkClick('/about', e)}
              className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              About Us
            </a>
            <a
              href="/terms"
              onClick={(e) => handleLinkClick('/terms', e)}
              className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              Terms
            </a>
            <a
              href="/privacy"
              onClick={(e) => handleLinkClick('/privacy', e)}
              className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              Privacy
            </a>
            <a
              href="/contact"
              onClick={(e) => handleLinkClick('/contact', e)}
              className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              Contact
            </a>
          </div>

          {/* Copyright String */}
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 text-center sm:text-right">
            &copy; 2026 OpenComm. All rights reserved.
          </p>

        </div>
      </div>
    </footer>
  );
}
