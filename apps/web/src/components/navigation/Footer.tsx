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
      window.scrollTo(0, 0);
    }
  };

  return (
    <footer className="w-full bg-slate-50 dark:bg-zinc-950/80 border-t border-slate-200/60 dark:border-zinc-800/60 mt-16 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo & Description */}
          <div className="space-y-3.5 md:col-span-2">
            <OpenCommLogo variant="footer" onClick={(e?: any) => handleLinkClick('/', e)} />
            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed max-w-sm">
              OpenComm helps people discover trusted professionals, meaningful work, and better opportunities.
            </p>
            <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
              &copy; {new Date().getFullYear()} OpenComm. All rights reserved.
            </p>
          </div>

          {/* Legal Links */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-mono">
              Legal & Policies
            </h4>
            <ul className="space-y-2 text-xs font-semibold text-slate-600 dark:text-zinc-300">
              <li>
                <a
                  href="/terms"
                  onClick={(e) => handleLinkClick('/terms', e)}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center space-x-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Terms of Service</span>
                </a>
              </li>
              <li>
                <a
                  href="/privacy"
                  onClick={(e) => handleLinkClick('/privacy', e)}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center space-x-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Privacy Policy</span>
                </a>
              </li>
              <li>
                <a
                  href="/cookie-policy"
                  onClick={(e) => handleLinkClick('/cookie-policy', e)}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center space-x-1.5"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Cookie Policy</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Support & Community */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-mono">
              Help & Resources
            </h4>
            <ul className="space-y-2 text-xs font-semibold text-slate-600 dark:text-zinc-300">
              <li>
                <a
                  href="/about"
                  onClick={(e) => handleLinkClick('/about', e)}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center space-x-1.5"
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>About OpenComm</span>
                </a>
              </li>
              <li>
                <a
                  href="/community-guidelines"
                  onClick={(e) => handleLinkClick('/community-guidelines', e)}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center space-x-1.5"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Community Guidelines</span>
                </a>
              </li>
              <li>
                <a
                  href="/contact"
                  onClick={(e) => handleLinkClick('/contact', e)}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center space-x-1.5"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Contact & Grievance</span>
                </a>
              </li>
              <li>
                <a
                  href="/contact"
                  onClick={(e) => handleLinkClick('/contact', e)}
                  className="hover:text-red-500 dark:hover:text-red-400 transition-colors flex items-center space-x-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-red-500" />
                  <span>Report an Issue</span>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
