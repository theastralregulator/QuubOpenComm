import React from 'react';
import { FileText, ShieldAlert, ArrowLeft } from 'lucide-react';

export const TERMS_VERSION = "2026-07-19-v1";

interface TermsPageProps {
  navigate?: (path: string) => void;
}

export default function TermsPage({ navigate }: TermsPageProps) {
  return (
    <div className="max-w-[1000px] mx-auto py-8 sm:py-12 px-5 sm:px-8 lg:px-10 text-left animate-fadeIn pb-[calc(110px+env(safe-area-inset-bottom))]">
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
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              OpenComm Terms of Service
            </h1>
            <p className="text-[10px] sm:text-xs text-slate-400 dark:text-zinc-500 font-mono font-bold mt-1">
              VERSION: {TERMS_VERSION} | EFFECTIVE DATE: July 19, 2026
            </p>
          </div>
        </div>

        {/* Warning Callout Box */}
        <div className="p-4 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start space-x-3 text-[11px] sm:text-xs text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong>CRITICAL RELATIONSHIP NOTICES:</strong>
            <p>
              OpenComm does not employ workers, nor does it guarantee the authenticity, safety, or legality of any posted opportunities or user profiles unless explicitly marked as verified. All users must independently assess and verify the suitability, licensing, and qualifications of counter-parties.
            </p>
          </div>
        </div>

        {/* Terms Content */}
        <div className="text-xs sm:text-sm text-slate-600 dark:text-zinc-300 space-y-6 leading-relaxed font-medium">
          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">1. Introduction</h2>
            <p>Welcome to OpenComm. These Terms of Service ("Terms") govern your access to and use of the OpenComm website, services, mobile application, and related software platforms (collectively, the "Platform").</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">2. Acceptance of Terms</h2>
            <p>By creating an account, clicking "I Agree," or accessing the Platform, you acknowledge that you have read, understood, and agreed to be bound by these Terms and our Privacy Policy. If you do not agree, you must immediately cease using the Platform.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">3. Eligibility and Minimum Age</h2>
            <p>You must be at least 18 years old (or the legal age of majority in your jurisdiction) to register an account or use the Platform. By using the Platform, you represent and warrant that you possess the legal capacity to enter into a binding agreement.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">4. Account Registration</h2>
            <p>To use most features, you must register for an account. You agree to provide accurate, current, and complete information during registration and to keep this info updated at all times.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">5. Email Verification</h2>
            <p>All users must complete email verification via a One-Time Password (OTP) or magic link to activate full interactive features, such as posting service listings or contacting other users. Unverified users will have strictly restricted functionality.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">6. Account Security</h2>
            <p>You are solely responsible for maintaining the confidentiality of your account credentials. You agree to immediately notify OpenComm of any unauthorized use or security breach of your account.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">7. Worker Accounts</h2>
            <p>Worker accounts are for individual professionals offering skills, trades, or services. Workers can create public profiles, showcase achievements, upload portfolios, and apply for jobs.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">8. Company/Employer Accounts and Coming Soon Status</h2>
            <p className="text-amber-700 dark:text-amber-400">
              <strong>NOTICE:</strong> Company/Employer account registration, company profiles, and employer management tools are currently <strong>DISABLED ("Coming Soon")</strong>. No company profiles or employer listings are active at this time. Users may not register as employers until this feature is officially launched.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">9. User Responsibilities</h2>
            <p>You are solely responsible for your interactions, posts, messages, and relationships initiated through the Platform. You must act in good faith and treat others with dignity and respect.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">10. Accurate Information Obligations</h2>
            <p>You warrant that all certifications, credentials, skills, work experience, and identity information uploaded to your profile are true, complete, and not misleading.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">11. Job Listings</h2>
            <p>Employers (when active) must not post misleading, discriminatory, exploitative, unsafe, or unlawful job listings. OpenComm reserves the right to review and remove listings at its sole discretion.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">12. Applications and Hiring</h2>
            <p>Submitting a job application or bid does not guarantee an interview, hire, or response. All hiring decisions are made independently by the parties involved.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">13. Independent Relationship Between Users</h2>
            <p>Any service agreement, employment agreement, contract, or arrangement made between users is solely between those users. OpenComm is not a party to such agreements.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">14. OpenComm is an Intermediary, Not an Employer</h2>
            <p>OpenComm functions strictly as a technology intermediary / local marketplace. OpenComm does not employ workers, contract out work, or act as an employment agency.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">15. No Guarantee of Outcomes</h2>
            <p>OpenComm offers no guarantees regarding the placement of jobs, hiring success, payment execution, user identities, the quality of services, or safety of work environments.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">16. Worker Profile Content</h2>
            <p>By creating a worker profile, you authorize OpenComm to display approved professional details publicly to other platform visitors and potential clients.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">17. Resume and Portfolio Content</h2>
            <p>Resumes uploaded to the Platform are private by default and only shared with authorized entities in the hiring flow. Portfolios may be displayed publicly based on your selection.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">18. Prohibited Content</h2>
            <p>You may not post content that is obscene, defamatory, hateful, abusive, sexually explicit, or that infringes on third-party intellectual property rights.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">19. Prohibited Conduct</h2>
            <p>You agree not to bypass platform security measures, spam other users, or attempt client-side manipulation of account data or parameters.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">20. Fraud, Impersonation, and Harassment</h2>
            <p>Impersonating others, creating duplicate scam accounts, conducting advance-fee fraud, harassment, discrimination, or engaging in illegal activity will result in immediate termination.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">21. Communication Rules</h2>
            <p>Messages, chats, and comments on the Platform must remain professional and free of threats, slurs, or harassment.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">22. Contact-Information Sharing</h2>
            <p>Sharing personal contact details (such as phone numbers or emails) in public fields prior to establishing an official contract or connection request is prohibited to prevent spam and abuse.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">23. Payments and Escrow Status</h2>
            <p><strong>NOTICE:</strong> Platform-integrated payments, billing, and escrow systems are <strong>NOT YET ACTIVE</strong>. All payments between workers and clients must be negotiated and settled outside the platform.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">24. Platform Fees</h2>
            <p>Using basic marketplace search and profile directories is currently <strong>FREE</strong>. OpenComm reserves the right to introduce premium plans, transaction fees, or posting charges in the future.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">25. Taxes and Legal Responsibilities</h2>
            <p>Users are solely responsible for calculating, reporting, and paying any income taxes, local trade taxes, or social contributions arising from service transactions initiated here.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">26. Background Checks and Licences</h2>
            <p>OpenComm does not conduct background checks or license verifications. Users must perform their own due diligence before hiring or performing services.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">27. Intellectual Property</h2>
            <p>All brand graphics, logos, layouts, and code of OpenComm are the exclusive intellectual property of OpenComm and protected under global trademark and copyright laws.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">28. User-Content Licence</h2>
            <p>By posting details, bios, or portfolios, you grant OpenComm a non-exclusive, worldwide, royalty-free, transferable license to display and distribute that content for platform promotional purposes.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">29. Copyright Complaints</h2>
            <p>If you believe content on the platform infringes your copyrights, please notify our grievance support channel immediately with details.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">30. Privacy and Data Handling</h2>
            <p>Use of the platform is also governed by our Privacy Policy, which details how we collect, store, and process your personal and geolocation records.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">31. Suspension and Termination</h2>
            <p>OpenComm reserves the right to suspend or delete accounts that violate these Terms, breach security, or engage in suspicious behavior, without prior warning.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">32. Account Deletion</h2>
            <p>You may request permanent deletion of your profile and data through the Contact/Grievance form. Deletion processes are completed in accordance with our data retention schedules.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">33. Reporting Users and Jobs</h2>
            <p>If you encounter fraudulent listings, abusive profiles, or scam behaviors, you should use our report buttons or submit a ticket through the Grievance center.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">34. Platform Availability</h2>
            <p>OpenComm does not guarantee uninterrupted runtime. The Platform is provided "as is" and "as available" for maintenance, upgrades, and hosting adjustments.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">35. Third-Party Links</h2>
            <p>Our platform may contain links to external portfolio websites, GitHub, or LinkedIn. We are not responsible for the privacy or safety practices of those third-party sites.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">36. Disclaimers</h2>
            <p>OpenComm disclaims all warranties, express or implied, including commercial suitability, non-infringement, or qualification of contractors.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">37. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, OpenComm shall not be liable for any indirect, incidental, or consequential damages, or loss of earnings arising from user contracts.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">38. Indemnity</h2>
            <p>You agree to indemnify and hold harmless OpenComm, its directors, and staff against any legal claims, liabilities, or disputes arising from your platform actions or contracts.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">39. Governing Law</h2>
            <p>These Terms shall be interpreted and governed in accordance with the laws of the jurisdiction where the platform operates, without regard to conflict of law principles.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">40. Dispute Resolution</h2>
            <p>Any dispute arising out of your relationship with the Platform shall first be addressed through amicable resolution with our Grievance channels before seeking arbitration.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">41. Grievance Redressal</h2>
            <p>If you have any complaints regarding content, privacy violations, or data handling, you can contact our dedicated Grievance portal. Details are available on the Grievance Page.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">42. Changes to Terms</h2>
            <p>OpenComm reserves the right to modify these Terms. Material updates will prompt users for consent upon their next login. Continued use implies consent.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">43. Contact Information</h2>
            <p>For questions or support related to these Terms, please submit a query via the Grievance Support center or email us at our placeholder support address.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">44. Effective Date</h2>
            <p>These Terms are effective as of July 19, 2026 and supersede all prior understandings.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">45. Version Number</h2>
            <p>Platform Reference: {TERMS_VERSION}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
