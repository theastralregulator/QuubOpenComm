import React from 'react';
import { Lock, ShieldAlert, ArrowLeft } from 'lucide-react';

export const PRIVACY_VERSION = "2026-07-19-v1";

interface PrivacyPageProps {
  navigate?: (path: string) => void;
}

export default function PrivacyPage({ navigate }: PrivacyPageProps) {
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
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              OpenComm Privacy Policy
            </h1>
            <p className="text-[10px] sm:text-xs text-slate-400 dark:text-zinc-500 font-mono font-bold mt-1">
              VERSION: {PRIVACY_VERSION} | EFFECTIVE DATE: July 19, 2026
            </p>
          </div>
        </div>

        {/* Location & Resume Callouts */}
        <div className="p-4 bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/20 rounded-2xl space-y-3 text-[11px] sm:text-xs text-slate-700 dark:text-zinc-300 font-medium leading-relaxed">
          <div className="flex items-start space-x-2 text-indigo-600 dark:text-indigo-400 font-bold">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>CRITICAL DISCLOSURES</span>
          </div>
          <div className="space-y-2">
            <p>
              <strong>Location Handling:</strong> Geolocation permission is requested strictly on-demand when clicking "Use my current location." Permission denial does not block signup. Exact GPS coordinates are never displayed publicly. Users are allowed to manually edit location names before saving.
            </p>
            <p>
              <strong>Resume Protection:</strong> Resumes uploaded to OpenComm are private by default. Resumes are not revealed on public search profiles. Access to resume files is strictly limited to the owner and authorized entities in the hiring flow via authenticated signed URLs.
            </p>
          </div>
        </div>

        {/* Privacy Policy Content */}
        <div className="text-xs sm:text-sm text-slate-600 dark:text-zinc-300 space-y-6 leading-relaxed font-medium">
          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">1. Introduction</h2>
            <p>At OpenComm, we value your privacy. This policy describes how we collect, store, share, and protect personal data associated with your use of the Platform.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">2. Scope</h2>
            <p>This policy applies to all accounts registered on the Platform, including workers and basic profiles, as well as general platform visitors.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">3. Data Controller / Fiduciary</h2>
            <p>For questions related to data processing, OpenComm serves as the data processor or data fiduciary. Placeholders for our official regulatory entity are active until formal legal entities are declared.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">4. Information Provided by Users</h2>
            <p>We collect personal information that you explicitly submit, such as name, email address, phone number, location selections, and bio records.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">5. Account Information</h2>
            <p>Registration fields including passwords (hashed securely by Supabase Auth), emails, phone numbers, and account types are stored securely.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">6. Profile and Professional Information</h2>
            <p>Worker profile details, including professional titles, primary job categories, and profile pictures are displayed on public pages to enable discovery.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">7. Resume, Education, and Work History</h2>
            <p>We collect work history details, qualifications, and optional resume files to populate your profile. Resumes are kept confidential within the private resumes bucket.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">8. Job Applications</h2>
            <p>When applying to a job, your application content, cover notes, bids, and profile summary are shared with the respective employer or posting client.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">9. Messages and Interactions</h2>
            <p>We store chat text and attachments exchanged during active work/hiring conversations. These are accessible only to the members of the conversation thread.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">10. Contact Details</h2>
            <p>Contact details are hidden from public searches and only shared once a mutual connection, accepted application, or hiring agreement is initiated.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">11. Location Information</h2>
            <p>We collect city, state, country, and optional coordinates. Exact location coordinates are processed only to measure distance parameters and never shown to the public.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">12. Geolocation Permission</h2>
            <p>Permission for location tracking is entirely optional. Declining permission does not block account registration. You can manually enter your preferred base location.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">13. Automatically Collected Technical Information</h2>
            <p>Our servers record browser types, device models, operating systems, and network logs to optimize service performance.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">14. Device, Log, and Cookie Information</h2>
            <p>We use essential session-storage and cookie tokens to preserve theme preferences, auth sessions, and tracking parameters.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">15. Google Analytics Usage</h2>
            <p>We integrate Google Analytics to track user interaction rates. Custom analytical trackers log signup actions and worker profile additions for volume counts.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">16. Supabase Usage</h2>
            <p>All database tables, user sessions, security groups, and storage bucket uploads are operated and hosted through Supabase Cloud infrastructure.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">17. Resend Email Delivery</h2>
            <p>We use the Resend service to dispatch email OTP verification codes and link tokens securely to user accounts.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">18. Vercel Hosting</h2>
            <p>The OpenComm web application files, frontend assets, and static pages are hosted and deployed via Vercel.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">19. Why Information is Processed</h2>
            <p>We process information to facilitate search discovery, job applications, account verification, and professional matchmaking.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">20. Legal Grounds for Processing</h2>
            <p>Data processing is conducted based on user consent given at signup, execution of contracts, and legitimate interest in platform security.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">21. Public Profile Information</h2>
            <p>Public profiles display names, avatars, bios, skills, and portfolio items. Resumes and specific contact fields are excluded from this view.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">22. Private Profile Information</h2>
            <p>Private data includes billing details (when applicable), resume files, exact GPS locations, and messages.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">23. Sharing with Employers/Workers</h2>
            <p>When you apply or request a contact, your application metadata and specified communication paths are shared with the target user.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">24. Vendors and Service Providers</h2>
            <p>We share details with Supabase, Resend, and Analytics vendors strictly to operate the technical requirements of the platform.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">25. Legal Disclosures</h2>
            <p>We may share user records if required by courts, regulatory authorities, or governing laws during authorized investigations.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">26. Fraud and Security</h2>
            <p>We analyze interaction behaviors, emails, and signup IPs to identify spam rings, duplicate accounts, and fraudulent activity.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">27. Data Retention</h2>
            <p>We retain active records as long as your account remains active. Inactive logs are subject to periodic cleanup routines.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">28. Account Deletion</h2>
            <p>Upon requesting account deletion, public listings are deactivated, and database rows are queued for deletion within our policy terms.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">29. Resume Deletion</h2>
            <p>Deleting your resume file deletes the file from the storage nodes and drops references from database records.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">30. User Rights and Requests</h2>
            <p>Users have the right to request copy records, access logs, correct profile files, and withdraw privacy consents.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">31. Access and Correction</h2>
            <p>You can edit your profile details at any time by navigating to your settings or profile dashboard.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">32. Withdrawal of Consent</h2>
            <p>You may request withdrawal of consent by initiating account deletion. This will terminate your ability to access platform services.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">33. Grievance Redressal</h2>
            <p>Grievances regarding data handling can be registered with our Grievance officer through the Contact portal.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">34. Cookies Policy</h2>
            <p>We use essential cookies to maintain user session data. Refer to the Cookie Policy for controls and configurations.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">35. Analytics Opt-out</h2>
            <p>Users can disable analytical tracking by configuring their web browser settings or installing opt-out add-ons.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">36. Minimum Age</h2>
            <p>We do not knowingly collect personal details from children under the age of 18. Registered accounts of minors will be removed.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">37. International Processing</h2>
            <p>Our database nodes operate globally. By submitting records, you consent to secure data transfers across cloud regions.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">38. Security Safeguards</h2>
            <p>We employ administrative access controls, RLS database boundaries, and security audits to prevent data leakage.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">39. Data-Breach Response</h2>
            <p>In case of a detected security breach, affected users will be notified through register alerts in accordance with legal timelines.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">40. Policy Changes</h2>
            <p>We may update this Privacy Policy periodically. Significant changes will require renewal of your consent upon next login.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">41. Contact Details</h2>
            <p>Support queries or data deletion requests can be submitted through our Contact Page.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">42. Effective Date</h2>
            <p>This Privacy Policy is effective starting July 19, 2026.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">43. Version Number</h2>
            <p>Platform Reference: {PRIVACY_VERSION}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
