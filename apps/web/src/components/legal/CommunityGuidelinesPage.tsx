import React from 'react';
import { HelpCircle, Shield, ArrowLeft } from 'lucide-react';

interface CommunityGuidelinesPageProps {
  navigate?: (path: string) => void;
}

export default function CommunityGuidelinesPage({ navigate }: CommunityGuidelinesPageProps) {
  return (
    <div className="max-w-[1000px] w-[min(100%-2rem,1000px)] sm:w-[min(100%-3rem,1000px)] mx-auto py-8 sm:py-12 px-4 sm:px-6 md:px-8 text-left animate-fadeIn">
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
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              OpenComm Community Guidelines
            </h1>
            <p className="text-[10px] sm:text-xs text-slate-400 dark:text-zinc-500 font-mono font-bold mt-1">
              EFFECTIVE DATE: July 19, 2026
            </p>
          </div>
        </div>

        <div className="text-xs sm:text-sm text-slate-600 dark:text-zinc-300 space-y-6 leading-relaxed font-medium">
          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center space-x-2">
              <Shield className="w-4 h-4 text-indigo-600" />
              <span>1. Professional and Respectful Conduct</span>
            </h2>
            <p>We require all users to maintain a professional, respectful, and polite demeanor in all communications, listings, and feedback. Abusive speech, harassment, threats, and insults are strictly prohibited.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center space-x-2">
              <Shield className="w-4 h-4 text-indigo-600" />
              <span>2. Genuine Profiles and Veracity</span>
            </h2>
            <p>All users must represent their professional identities honestly. Fake profile photos, stolen portfolios, inflated certifications, or falsified skills violate platform policies. Your credentials must be accurate.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center space-x-2">
              <Shield className="w-4 h-4 text-indigo-600" />
              <span>3. Genuine Jobs Only</span>
            </h2>
            <p>Employers (when active) must post genuine, active opportunities only. Multi-level marketing (MLM), pyramid schemes, commission-only scams without base pay, or listings aimed solely at collecting contact records are strictly banned.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center space-x-2">
              <Shield className="w-4 h-4 text-indigo-600" />
              <span>4. Zero Tolerance for Discrimination</span>
            </h2>
            <p>OpenComm prohibits discrimination in hiring, listing, or contracting based on race, religion, gender, sexual orientation, disability, nationality, or age. All opportunities must be open and fair.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center space-x-2">
              <Shield className="w-4 h-4 text-indigo-600" />
              <span>5. Safety and Legal Protections</span>
            </h2>
            <p>We maintain strict safety rules to protect members of our community. The following are absolutely prohibited and will result in immediate law-enforcement reports where applicable:</p>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li>No harassment or cyber-bullying.</li>
              <li>No sexual exploitation or inappropriate advances.</li>
              <li>No child labor or forced labor.</li>
              <li>No unsafe, exploitative, or unlawful work environments.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center space-x-2">
              <Shield className="w-4 h-4 text-indigo-600" />
              <span>6. Scams and Financial Protection</span>
            </h2>
            <p>Do not conduct advance-fee scams, check-cashing schemes, or fee collection from job applicants. Any requests for deposits, setup fees, or purchasing specific equipment from a third-party seller as a condition of employment represent fraud.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center space-x-2">
              <Shield className="w-4 h-4 text-indigo-600" />
              <span>7. Technical Abuse and Security</span>
            </h2>
            <p>Users must not distribute malware, conduct phishing attempts, send automated spam messages, or engage in unauthorized scraping of platform directories or profiles.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center space-x-2">
              <Shield className="w-4 h-4 text-indigo-600" />
              <span>8. Doxxing and Contact Protection</span>
            </h2>
            <p>Do not publish private contact details, home addresses, phone numbers, or private communications of other users without their explicit consent. Violating contact boundaries is prohibited.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center space-x-2">
              <Shield className="w-4 h-4 text-indigo-600" />
              <span>9. Prohibited Services</span>
            </h2>
            <p>You may not list dangerous, regulated, or prohibited services. This includes selling firearms, illicit drugs, dangerous chemicals, or illegal items.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center space-x-2">
              <Shield className="w-4 h-4 text-indigo-600" />
              <span>10. Reporting and Enforcement Process</span>
            </h2>
            <p>If you observe violations of these guidelines, please click the "Report" button on the job or profile, or submit a request via our Grievance form. Penalties for violations range from initial warnings to permanent account deactivation and blocklists.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
