import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, Eye, Target, Users, CheckCircle2, ChevronDown, 
  HelpCircle, Mail, Globe, ArrowRight, Lock, Heart, Award, Sparkles, Briefcase, UserCheck, MapPin, Compass
} from 'lucide-react';
import OpenCommLogo from '../common/OpenCommLogo';

interface AboutPageProps {
  isLoggedIn?: boolean;
  onOpenAuth?: (tab: 'signin' | 'signup') => void;
}

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

const FAQS: FAQItem[] = [
  {
    id: 'faq-1',
    question: 'What is OpenComm?',
    answer: 'OpenComm is a modern professional marketplace and discovery platform connecting skilled professionals, job seekers, and clients directly in a transparent ecosystem.'
  },
  {
    id: 'faq-2',
    question: 'Is OpenComm free to use?',
    answer: 'Yes! Creating a basic account, browsing jobs, discovering professionals, and building your profile on OpenComm is free.'
  },
  {
    id: 'faq-3',
    question: 'Who can create an account?',
    answer: 'Anyone looking to discover jobs, offer professional services, build a portfolio, or hire skilled individuals can create an OpenComm account.'
  },
  {
    id: 'faq-4',
    question: 'What is a Basic Account?',
    answer: 'A Basic Account allows you to browse public opportunities, save jobs and worker profiles, send messages, and manage your account credentials.'
  },
  {
    id: 'faq-5',
    question: 'What is a Worker Account?',
    answer: 'A Worker Account enables you to publish a public professional profile, list your skills, experience, portfolio items, hourly rate, and receive client inquiries.'
  },
  {
    id: 'faq-6',
    question: 'Are company accounts available?',
    answer: 'Company and enterprise organization accounts are currently under active development and marked as Coming Soon.'
  },
  {
    id: 'faq-7',
    question: 'How does email verification work?',
    answer: 'When signing up, a 6-digit One-Time Password (OTP) is sent to your email address to confirm ownership before your profile is activated.'
  },
  {
    id: 'faq-8',
    question: 'Can I share my profile or job links?',
    answer: 'Yes! Each job listing and worker profile includes a quick share option to copy a direct link or share on social networks.'
  },
  {
    id: 'faq-9',
    question: 'Are my contact details public?',
    answer: 'No. OpenComm protects your personal email and phone number. Communication occurs safely through our platform messaging system.'
  },
  {
    id: 'faq-10',
    question: 'Can users message each other?',
    answer: 'Registered users can message professionals and opportunity posters directly through our secure platform chat system.'
  },
  {
    id: 'faq-11',
    question: 'How do I report a job or user?',
    answer: 'You can report any suspicious job listing, abusive message, or deceptive user profile using the "Report an Issue" link in the footer or directly on profile pages.'
  },
  {
    id: 'faq-12',
    question: 'Can I delete my account?',
    answer: 'Yes. You can request account deletion or data removal at any time through our Privacy Policy request form or by contacting support.'
  },
  {
    id: 'faq-13',
    question: 'How are files and chat attachments handled?',
    answer: 'Resume uploads and message attachments are sanitized and stored securely with strict permissions.'
  },
  {
    id: 'faq-14',
    question: 'Does OpenComm guarantee jobs or hiring?',
    answer: 'OpenComm provides verification tools and platform moderation, but does not guarantee employment, contract outcomes, or payment unless explicitly verified.'
  },
  {
    id: 'faq-15',
    question: 'How can I contact OpenComm support?',
    answer: 'You can reach our team anytime via email at support@opencomm.online or through our Contact & Grievance form.'
  }
];

export default function AboutPage({ isLoggedIn = false, onOpenAuth }: AboutPageProps) {
  const navigate = useNavigate();
  const [openFaqId, setOpenFaqId] = useState<string | null>('faq-1');

  const toggleFaq = (id: string) => {
    setOpenFaqId(prev => (prev === id ? null : id));
  };

  return (
    <div className="w-full text-left font-sans max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-12 pb-[calc(110px+env(safe-area-inset-bottom))]">
      
      {/* Page Header */}
      <div className="space-y-4 border-b border-slate-200/80 dark:border-zinc-800/80 pb-8">
        <div className="flex items-center space-x-2 bg-indigo-500/10 dark:bg-indigo-500/15 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full shadow-xs w-fit">
          <Sparkles className="w-3.5 h-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-widest font-mono">PLATFORM OVERVIEW</span>
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-display font-black tracking-tight text-slate-900 dark:text-white leading-tight">
          About OpenComm
        </h1>
        <p className="text-base sm:text-lg text-slate-600 dark:text-zinc-300 font-medium leading-relaxed max-w-3xl">
          OpenComm is a professional marketplace built to help people discover work opportunities, find skilled professionals, and build trusted work connections.
        </p>
      </div>

      {/* A. Introduction & Overview */}
      <section className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <Globe className="w-6 h-6 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span>Building Transparent Work Connections</span>
        </h2>
        <p className="text-sm sm:text-base text-slate-600 dark:text-zinc-300 leading-relaxed max-w-4xl">
          Finding reliable work or discovering qualified talent should not be complicated by fragmented platforms, hidden contact details, or unverified listings. OpenComm bridges the gap between skilled workers and quality opportunities by offering a clean, direct, and transparent marketplace environment.
        </p>
      </section>

      {/* B. Our Vision */}
      <section className="p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10 border border-indigo-500/20 dark:border-indigo-500/20 space-y-3">
        <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400">
          <Eye className="w-5 h-5" />
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">Our Vision</h2>
        </div>
        <p className="text-sm sm:text-base font-semibold text-slate-800 dark:text-zinc-100 leading-relaxed">
          To make trusted work opportunities and professional connections easier to access for everyone.
        </p>
      </section>

      {/* C. Our Mission */}
      <section className="space-y-4">
        <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400">
          <Target className="w-5 h-5" />
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Our Mission</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {[
            'Help workers create professional visibility and showcase verified skills.',
            'Help people discover suitable job opportunities and local work.',
            'Help clients find skilled professionals and trusted contractors.',
            'Support secure and transparent communication across all stages.',
            'Reduce friction in local and digital work connections.'
          ].map((item, idx) => (
            <div key={idx} className="flex items-start space-x-3 p-4 rounded-xl bg-slate-50 dark:bg-zinc-900/50 border border-slate-200/60 dark:border-zinc-800/60">
              <CheckCircle2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <span className="text-xs sm:text-sm font-medium text-slate-700 dark:text-zinc-300 leading-relaxed">{item}</span>
            </div>
          ))}
        </div>
      </section>

      {/* D. Why OpenComm Exists */}
      <section className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Why OpenComm Exists</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Skilled Workers Need Visibility</h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              Many talented individuals struggle to present their capabilities effectively to clients without paying excessive upfront fees.
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Clients Struggle to Find Talent</h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              Finding verified contractors or specialized professionals requires navigating fragmented directories and unverified groups.
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Fragmented Communication</h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              Existing work discussions often get lost across personal messaging apps without record or protection.
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Unified Solution</h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              OpenComm brings professional profiles, job discovery, direct search, and secure communication together in one platform.
            </p>
          </div>
        </div>
      </section>

      {/* E. Who Is OpenComm For? */}
      <section className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <Users className="w-6 h-6 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span>Who Is OpenComm For?</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { title: 'Job Seekers', desc: 'Discover verified jobs.' },
            { title: 'Freelancers', desc: 'Showcase portfolios & clients.' },
            { title: 'Skilled Workers', desc: 'Highlight technical trades.' },
            { title: 'Local Pros', desc: 'On-demand services nearby.' },
            { title: 'Students', desc: 'Build initial experience.' },
            { title: 'Employers', desc: 'Post opportunities & hire.' },
            { title: 'Companies', desc: 'Enterprise management.', comingSoon: true }
          ].map((user, idx) => (
            <div key={idx} className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/60 dark:border-zinc-800/60 space-y-1.5 text-left relative overflow-hidden">
              {user.comingSoon && (
                <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-mono">
                  Coming Soon
                </span>
              )}
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">{user.title}</h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-normal">{user.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* F. What You Can Do on OpenComm */}
      <section className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">What You Can Do on OpenComm</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[
            { title: 'Create a Basic Account', status: 'Available' },
            { title: 'Build a Worker Profile', status: 'Available' },
            { title: 'Discover Verified Jobs', status: 'Available' },
            { title: 'Discover Professionals', status: 'Available' },
            { title: 'View Detailed Profiles', status: 'Available' },
            { title: 'Share Links & Portfolios', status: 'Available' },
            { title: 'Apply for Jobs', status: 'Available' },
            { title: 'Platform Messaging', status: 'Available' },
            { title: 'Save Opportunities', status: 'Available' },
            { title: 'Manage Account Details', status: 'Available' },
            { title: 'Company Organization Accounts', status: 'Coming Soon' },
            { title: 'Automated Escrow Contracts', status: 'Coming Soon' }
          ].map((feature, idx) => (
            <div key={idx} className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs">
              <span className="font-semibold text-slate-800 dark:text-zinc-200">{feature.title}</span>
              <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider font-mono ${
                feature.status === 'Available'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
              }`}>
                {feature.status}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* G. Trust and Safety */}
      <section className="p-6 rounded-2xl bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 dark:border-blue-500/20 space-y-3">
        <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
          <ShieldCheck className="w-6 h-6" />
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Trust and Safety</h2>
        </div>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">
          OpenComm prioritizes user safety through email verification, protected contact details, platform chat, and active moderation reporting.
        </p>
        <p className="text-[11px] sm:text-xs text-slate-500 dark:text-zinc-400 leading-relaxed font-medium bg-white/60 dark:bg-zinc-900/60 p-3 rounded-xl border border-blue-500/10">
          <strong>Notice:</strong> OpenComm provides verification tools and platform moderation, but does not guarantee identity, job quality, payment, or contract outcomes unless explicitly verified.
        </p>
      </section>

      {/* H. Our Values */}
      <section className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Our Values</h2>
        <div className="flex flex-wrap gap-2.5">
          {['Trust', 'Accessibility', 'Opportunity', 'Privacy', 'Professionalism', 'Fairness', 'Community'].map((val, idx) => (
            <span key={idx} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-bold text-indigo-600 dark:text-indigo-400 shadow-xs">
              {val}
            </span>
          ))}
        </div>
      </section>

      {/* I. How It Works */}
      <section className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">How OpenComm Works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { step: '01', title: 'Create an Account', desc: 'Sign up for a free basic account and verify your email address.' },
            { step: '02', title: 'Explore or Build Profile', desc: 'Browse job opportunities or create your worker profile.' },
            { step: '03', title: 'Connect Securely', desc: 'Send direct messages and discuss project requirements.' },
            { step: '04', title: 'Collaborate & Grow', desc: 'Deliver quality work, build reputation, and expand network.' }
          ].map((st, idx) => (
            <div key={idx} className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-2 relative">
              <span className="text-2xl font-black font-mono text-indigo-500/30 dark:text-indigo-400/20">{st.step}</span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{st.title}</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">{st.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Future Roadmap */}
      <section className="p-6 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 space-y-4">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <Compass className="w-6 h-6 text-purple-600 dark:text-purple-400 shrink-0" />
          <span>Future Roadmap</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 space-y-1">
            <span className="px-2 py-0.5 text-[9px] font-bold font-mono uppercase bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded w-fit block">Phase 1</span>
            <h3 className="font-bold text-slate-900 dark:text-white">Expanded Discovery</h3>
            <p className="text-slate-500 dark:text-zinc-400">Enhanced filtering, saved searches, and real-time candidate recommendations.</p>
          </div>
          <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 space-y-1">
            <span className="px-2 py-0.5 text-[9px] font-bold font-mono uppercase bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded w-fit block">Phase 2</span>
            <h3 className="font-bold text-slate-900 dark:text-white">Company Organization Accounts</h3>
            <p className="text-slate-500 dark:text-zinc-400">Multi-user corporate accounts, team hiring dashboards, and company profiles.</p>
          </div>
          <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 space-y-1">
            <span className="px-2 py-0.5 text-[9px] font-bold font-mono uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded w-fit block">Phase 3</span>
            <h3 className="font-bold text-slate-900 dark:text-white">Automated Milestone Escrow</h3>
            <p className="text-slate-500 dark:text-zinc-400">Integrated milestone escrow payments and deliverables tracking.</p>
          </div>
        </div>
      </section>

      {/* J. Frequently Asked Questions */}
      <section className="space-y-4">
        <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400">
          <HelpCircle className="w-6 h-6" />
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Frequently Asked Questions</h2>
        </div>
        
        <div className="space-y-2.5">
          {FAQS.map(faq => {
            const isOpen = openFaqId === faq.id;
            return (
              <div 
                key={faq.id} 
                className="rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 overflow-hidden transition-all"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(faq.id)}
                  aria-expanded={isOpen}
                  className="w-full px-5 py-4 text-left font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                >
                  <span>{faq.question}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180 text-indigo-500' : ''}`} />
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 pt-1 text-xs text-slate-600 dark:text-zinc-400 leading-relaxed border-t border-slate-100 dark:border-zinc-800/60">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* K. Contact Details */}
      <section className="p-6 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <Mail className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <span>Contact OpenComm</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1">
            <span className="text-slate-400 font-mono uppercase text-[10px] tracking-wider block font-bold">Support Email</span>
            <a href="mailto:support@opencomm.online" className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
              support@opencomm.online
            </a>
          </div>
          <div className="space-y-1">
            <span className="text-slate-400 font-mono uppercase text-[10px] tracking-wider block font-bold">Official Website</span>
            <a href="https://opencomm.online" target="_blank" rel="noopener noreferrer" className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
              opencomm.online
            </a>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 pt-2 text-xs font-semibold">
          <Link to="/contact" className="text-indigo-600 dark:text-indigo-400 hover:underline">Contact & Grievance</Link>
          <span className="text-slate-300 dark:text-zinc-700">•</span>
          <Link to="/privacy" className="text-indigo-600 dark:text-indigo-400 hover:underline">Privacy Request</Link>
          <span className="text-slate-300 dark:text-zinc-700">•</span>
          <Link to="/contact" className="text-rose-600 dark:text-rose-400 hover:underline">Report an Issue</Link>
        </div>
      </section>

      {/* L. Refined End-of-Page CTA */}
      <section className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white text-center space-y-4 shadow-xl border border-white/10 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight relative z-10">
          Ready to build better work connections?
        </h2>
        <p className="text-xs sm:text-sm max-w-xl mx-auto text-blue-100 font-medium leading-relaxed relative z-10">
          Join OpenComm today to discover opportunities, find skilled professionals, and connect securely.
        </p>
        
        <div className="flex flex-wrap justify-center items-center gap-3 pt-3 relative z-10">
          {!isLoggedIn ? (
            <>
              {onOpenAuth && (
                <button
                  type="button"
                  onClick={() => onOpenAuth('signin')}
                  className="px-6 h-11 rounded-xl text-xs sm:text-sm font-bold text-white bg-white/15 hover:bg-white/25 border border-white/20 shadow-md active:scale-98 transition-all cursor-pointer backdrop-blur-md"
                >
                  Sign In
                </button>
              )}
              {onOpenAuth && (
                <button
                  type="button"
                  onClick={() => onOpenAuth('signup')}
                  className="px-6 h-11 rounded-xl text-xs sm:text-sm font-bold text-slate-900 bg-white hover:bg-slate-100 shadow-md active:scale-98 transition-all cursor-pointer"
                >
                  Create Account
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => navigate('/jobs')}
                className="px-6 h-11 rounded-xl text-xs sm:text-sm font-bold text-slate-900 bg-white hover:bg-slate-100 shadow-md active:scale-98 transition-all cursor-pointer"
              >
                Browse Jobs
              </button>
              <button
                type="button"
                onClick={() => navigate('/workers')}
                className="px-6 h-11 rounded-xl text-xs sm:text-sm font-bold text-white bg-white/15 hover:bg-white/25 border border-white/20 shadow-md active:scale-98 transition-all cursor-pointer backdrop-blur-md"
              >
                Find Professionals
              </button>
            </>
          )}
        </div>
      </section>

    </div>
  );
}
