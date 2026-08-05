import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Check, X, MessageSquare, ExternalLink, RefreshCw, AlertCircle, Bookmark, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase, dbService } from '../../lib/supabase';
import { unreadService } from '../../lib/unreadService';
import { getPublicProfilesByIds } from '../../lib/profileService';
import { smartBack, FALLBACK_ROUTES, SESSION_STORAGE_KEYS } from '../../lib/navigation';

interface ApplicantData {
  id: string; // application id
  applicant_id: string;
  proposed_rate: string;
  cover_letter: string;
  status: string;
  created_at: string;
  negotiation_room_id?: string | null;
  active_proposal_id?: string | null;
  work_contract_id?: string | null;
  permanent_conversation_id?: string | null;
  profile: {
    full_name: string;
    avatar_url: string;
    location: string;
    profile_type: string;
    bio: string;
    preferred_language: string;
    username: string;
  };
}

interface ManageApplicationsPageProps {
  handleStartConversation: (applicationId: string) => void;
}

export default function ManageApplicationsPage({ handleStartConversation }: ManageApplicationsPageProps) {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [jobTitle, setJobTitle] = useState<string | null>(null);
  const [applications, setApplications] = useState<ApplicantData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'shortlisted' | 'accepted' | 'rejected'>('all');
  const [expandedCovers, setExpandedCovers] = useState<Record<string, boolean>>({});

  // Modal / Confirm state
  const [confirmAction, setConfirmAction] = useState<{ type: 'accept' | 'reject'; appId: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const handleBack = () => {
    const storageKey = jobId ? SESSION_STORAGE_KEYS.manageApplications(jobId) : undefined;
    smartBack(navigate, location, FALLBACK_ROUTES.MANAGE_APPLICATIONS, storageKey);
  };

  useEffect(() => {
    fetchApplications();

    if (!jobId) return;

    let cancelled = false;
    let unsubscribe = () => {};

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || cancelled) return;
      unsubscribe = unreadService.subscribeWorkflowEvents(user.id, (event) => {
        const application = event.new.job_id ? event.new : event.old;
        if (event.table === 'job_applications' && application.job_id === jobId) {
          void fetchApplications();
        }
      });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [jobId]);

  const fetchApplications = async () => {
    if (!jobId) {
      setError('No job specified.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated.');

      // Verify job ownership & fetch title
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('title, posted_by')
        .eq('id', jobId)
        .single();

      if (jobError || !jobData) {
        throw new Error('This job listing could not be found.');
      }

      if (jobData.posted_by !== userData.user.id) {
        throw new Error('You do not have permission to manage applications for this job.');
      }

      setJobTitle(jobData.title);

      // Fetch applications
      const { data: appsData, error: appsError } = await supabase
        .from('job_applications')
        .select(`
          id, applicant_id, proposed_rate, cover_letter, status, created_at,
          negotiation_room_id, active_proposal_id, work_contract_id, permanent_conversation_id
        `)
        .eq('job_id', jobId)
        .order('created_at', { ascending: false });

      if (appsError) throw appsError;

      const rawApps = appsData || [];
      const applicantIds = [...new Set(rawApps.map(a => a.applicant_id).filter(Boolean))] as string[];

      const profilesMap = await getPublicProfilesByIds(applicantIds);

      const mergedApps: ApplicantData[] = rawApps.map(app => {
        const canonical = profilesMap.get(app.applicant_id);
        let location = 'Location not provided';
        if (canonical) {
          location = [canonical.city, canonical.state, canonical.country].filter(Boolean).join(', ') || location;
        }

        return {
          id: app.id,
          applicant_id: app.applicant_id,
          proposed_rate: app.proposed_rate,
          cover_letter: app.cover_letter,
          status: app.status,
          created_at: app.created_at,
          negotiation_room_id: app.negotiation_room_id,
          active_proposal_id: app.active_proposal_id,
          work_contract_id: app.work_contract_id,
          permanent_conversation_id: app.permanent_conversation_id,
          profile: {
            full_name: canonical?.name || 'OpenComm User',
            avatar_url: canonical?.avatarUrl || '',
            location,
            profile_type: canonical?.profileType || 'normal',
            bio: canonical?.bio || '',
            preferred_language: '',
            username: ''
          }
        };
      });

      setApplications(mergedApps);
    } catch (err: any) {
      setError(err.message || "Failed to load applications for this job.");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (appId: string, newStatus: string) => {
    setActionLoading(true);
    try {
      const { error } = await supabase.rpc('update_job_application_status', {
        p_app_id: appId,
        p_status: newStatus
      });
      if (error) throw error;

      setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: newStatus } : a));
    } catch (err: any) {
      alert("Failed to update application status: " + err.message);
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  };

  const handleStartNegotiation = async (appId: string) => {
    setActionLoading(true);
    try {
      await dbService.startJobApplicationNegotiation(appId);
      navigate(`/applications/${appId}/negotiation`);
    } catch (err: any) {
      alert("Failed to start negotiation: " + (err.message || "Please try again."));
    } finally {
      setActionLoading(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted':
        return <span className="px-2.5 py-0.5 text-[10px] uppercase tracking-wider font-extrabold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">Accepted</span>;
      case 'confirmed':
        return <span className="px-2.5 py-0.5 text-[10px] uppercase tracking-wider font-extrabold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">Work Confirmed</span>;
      case 'negotiating':
        return <span className="px-2.5 py-0.5 text-[10px] uppercase tracking-wider font-extrabold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40">Negotiating</span>;
      case 'proposal_pending':
        return <span className="px-2.5 py-0.5 text-[10px] uppercase tracking-wider font-extrabold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">Proposal Pending</span>;
      case 'changes_requested':
        return <span className="px-2.5 py-0.5 text-[10px] uppercase tracking-wider font-extrabold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">Changes Requested</span>;
      case 'completed':
        return <span className="px-2.5 py-0.5 text-[10px] uppercase tracking-wider font-extrabold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">Completed</span>;
      case 'cancelled':
        return <span className="px-2.5 py-0.5 text-[10px] uppercase tracking-wider font-extrabold rounded-full bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border border-slate-300 dark:border-slate-700">Cancelled</span>;
      case 'rejected':
        return <span className="px-2.5 py-0.5 text-[10px] uppercase tracking-wider font-extrabold rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40">Rejected</span>;
      case 'shortlisted':
        return <span className="px-2.5 py-0.5 text-[10px] uppercase tracking-wider font-extrabold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40">Shortlisted</span>;
      case 'withdrawn':
        return <span className="px-2.5 py-0.5 text-[10px] uppercase tracking-wider font-extrabold rounded-full bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border border-slate-300 dark:border-slate-700">Withdrawn</span>;
      case 'pending':
      case 'under_review':
      default:
        return <span className="px-2.5 py-0.5 text-[10px] uppercase tracking-wider font-extrabold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">Pending</span>;
    }
  };

  const toggleCover = (id: string) => {
    setExpandedCovers(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getInitials = (name: string) => {
    if (!name || name === 'Unknown Applicant' || name === 'OpenComm User') return 'OU';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const counts = {
    all: applications.length,
    pending: applications.filter(a => a.status === 'pending' || a.status === 'under_review').length,
    shortlisted: applications.filter(a => a.status === 'shortlisted').length,
    accepted: applications.filter(a => a.status === 'accepted' || a.status === 'confirmed').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
  };

  const tabs = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'pending', label: 'Pending', count: counts.pending },
    { id: 'shortlisted', label: 'Shortlisted', count: counts.shortlisted },
    { id: 'accepted', label: 'Accepted', count: counts.accepted },
    { id: 'rejected', label: 'Rejected', count: counts.rejected },
  ] as const;

  const filteredApps = applications.filter(app => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'pending') return app.status === 'pending' || app.status === 'under_review';
    if (filterStatus === 'accepted') return app.status === 'accepted' || app.status === 'confirmed' || app.status === 'completed';
    return app.status === filterStatus;
  });

  return (
    <div className="w-full bg-[linear-gradient(180deg,#FAFBFF_0%,#F7F5FF_55%,#FAFCFF_100%)] dark:bg-[#080C14] min-h-screen text-left">
      <div className="w-full max-w-4xl mx-auto px-2.5 sm:px-4 pt-3 sm:pt-4 pb-[calc(110px+env(safe-area-inset-bottom))] space-y-4">

        {/* Header Section */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handleBack}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl transition-colors cursor-pointer border border-slate-200/60 dark:border-slate-800 shrink-0"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            </button>

            <div className="flex items-center space-x-2.5 min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-black text-[#111827] dark:text-white tracking-tight shrink-0">
                Manage Applications
              </h1>
              {!loading && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-[#6C4DFF]/10 text-[#6C4DFF] dark:text-purple-300 border border-[#6C4DFF]/20 shrink-0">
                  {counts.all} {counts.all === 1 ? 'Applicant' : 'Applicants'}
                </span>
              )}
            </div>
          </div>

          {jobTitle && (
            <div className="bg-white dark:bg-[#111827] border border-slate-200/60 dark:border-slate-800/80 rounded-2xl p-3 sm:p-3.5 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-0.5">
                Job Posting
              </span>
              <h2 className="text-sm sm:text-base font-extrabold text-[#0F172A] dark:text-white tracking-tight leading-snug whitespace-normal break-words">
                {jobTitle}
              </h2>
            </div>
          )}

          {!loading && !error && (
            <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-hide shrink-0 pt-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterStatus(tab.id as any)}
                  className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                    filterStatus === tab.id
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xs'
                      : 'bg-white dark:bg-[#111827] text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-extrabold ${
                    filterStatus === tab.id
                      ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="space-y-3.5">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white dark:bg-[#111827] border border-[#ECEEF5] dark:border-slate-800 rounded-[22px] p-4 h-44 animate-pulse flex flex-col justify-between" />
            ))}
          </div>
        ) : error ? (
          <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 rounded-[22px] p-6 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
            <h3 className="text-base font-bold text-rose-700 dark:text-rose-300">Unable to load applications</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto">{error}</p>
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 font-bold text-xs transition-all cursor-pointer shadow-2xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to My Job Posts</span>
            </button>
          </div>
        ) : filteredApps.length === 0 ? (
          <div className="bg-white dark:bg-[#111827] border border-[#ECEEF5] dark:border-slate-800 rounded-[22px] p-8 sm:p-12 text-center space-y-4 shadow-xs">
            <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto">
              <Check className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-bold text-[#0F172A] dark:text-white">No applications found.</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                {filterStatus === 'all'
                  ? "When job seekers apply to this posting, their applications will appear here."
                  : `There are currently no applications matching the '${tabs.find(t => t.id === filterStatus)?.label}' filter.`}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3.5">
            {filteredApps.map(app => {
              const isExpanded = expandedCovers[app.id];
              return (
                <div
                  key={app.id}
                  className="bg-[linear-gradient(180deg,#FFFFFF_0%,#FBF9FF_60%,#FAFBFF_100%)] dark:bg-[#111827] border border-[#ECEEF5] dark:border-[#273449]/40 rounded-[22px] p-3.5 sm:p-4 flex flex-col justify-between transition-all duration-300 relative overflow-hidden shadow-xs hover:shadow-md text-left"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center space-x-3 min-w-0 cursor-pointer group" onClick={() => navigate(`/profile/${app.applicant_id}`)}>
                        {app.profile.avatar_url ? (
                          <img
                            src={app.profile.avatar_url}
                            alt={app.profile.full_name}
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-xl object-cover bg-slate-50 border border-slate-100 dark:border-slate-800 shrink-0 group-hover:brightness-95 transition-all"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6C4DFF] to-[#4F46E5] text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                            {getInitials(app.profile.full_name)}
                          </div>
                        )}
                        <div className="min-w-0 text-left">
                          <h3 className="text-sm font-extrabold text-[#0F172A] dark:text-white truncate group-hover:text-[#2563EB] transition-colors">
                            {app.profile.full_name}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-medium">
                            {app.profile.location}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                            Applied on {new Date(app.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {renderStatusBadge(app.status)}
                      </div>
                    </div>

                    {app.proposed_rate && (
                      <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-xl text-xs">
                        <span className="font-semibold text-slate-500 dark:text-slate-400">Proposed Rate:</span>
                        <span className="font-extrabold text-slate-900 dark:text-white">{app.proposed_rate}</span>
                      </div>
                    )}

                    {app.cover_letter && (
                      <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800/60 text-xs">
                        <p className={`font-medium text-slate-700 dark:text-slate-300 whitespace-pre-wrap ${!isExpanded ? 'line-clamp-3' : ''}`}>
                          {app.cover_letter}
                        </p>
                        {app.cover_letter.length > 160 && (
                          <button
                            type="button"
                            onClick={() => toggleCover(app.id)}
                            className="mt-1.5 text-[11px] font-bold text-[#2563EB] dark:text-blue-400 hover:underline flex items-center space-x-0.5 cursor-pointer"
                          >
                            {isExpanded ? (
                              <><ChevronUp className="w-3 h-3" /><span>Show Less</span></>
                            ) : (
                              <><ChevronDown className="w-3 h-3" /><span>Read More</span></>
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions Section */}
                  <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/profile/${app.applicant_id}`)}
                        className="h-9 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all cursor-pointer flex items-center justify-center space-x-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>View Profile</span>
                      </button>

                      {app.status === 'accepted' && (
                        <button
                          type="button"
                          onClick={() => handleStartConversation(app.id)}
                          className="h-9 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-2xs"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Message</span>
                        </button>
                      )}

                      {app.permanent_conversation_id && app.status !== 'accepted' && (
                        <button
                          type="button"
                          onClick={() => navigate(`/messages/${app.permanent_conversation_id}`)}
                          className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-2xs"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Open Main Chat</span>
                        </button>
                      )}

                      {app.work_contract_id && (
                        <button
                          type="button"
                          onClick={() => navigate(`/work-contracts/${app.work_contract_id}`)}
                          className="h-9 px-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-bold text-xs transition-all flex items-center justify-center space-x-1 cursor-pointer"
                        >
                          <span>View Contract</span>
                        </button>
                      )}
                    </div>

                    {/* Decision Action Buttons */}
                    <div className="flex items-center space-x-1.5">
                      {app.status === 'pending' || app.status === 'under_review' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => updateStatus(app.id, 'shortlisted')}
                            disabled={actionLoading}
                            className="h-9 px-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 font-bold text-xs border border-purple-200 dark:border-purple-800/40 hover:bg-purple-100 transition-all cursor-pointer flex items-center space-x-1 disabled:opacity-50"
                          >
                            <Bookmark className="w-3.5 h-3.5" />
                            <span>Shortlist</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartNegotiation(app.id)}
                            disabled={actionLoading}
                            className="h-9 px-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white font-extrabold text-xs transition-all cursor-pointer flex items-center space-x-1 shadow-2xs disabled:opacity-50"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Start Negotiation</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmAction({ type: 'reject', appId: app.id })}
                            disabled={actionLoading}
                            className="h-9 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 font-bold text-xs border border-rose-200 dark:border-rose-800/40 hover:bg-rose-100 transition-all cursor-pointer flex items-center space-x-1 disabled:opacity-50"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </>
                      ) : app.status === 'shortlisted' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => updateStatus(app.id, 'pending')}
                            disabled={actionLoading}
                            className="h-9 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-all cursor-pointer flex items-center space-x-1 disabled:opacity-50"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>To Pending</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartNegotiation(app.id)}
                            disabled={actionLoading}
                            className="h-9 px-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white font-extrabold text-xs transition-all cursor-pointer flex items-center space-x-1 shadow-2xs disabled:opacity-50"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Start Negotiation</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmAction({ type: 'reject', appId: app.id })}
                            disabled={actionLoading}
                            className="h-9 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 font-bold text-xs border border-rose-200 dark:border-rose-800/40 hover:bg-rose-100 transition-all cursor-pointer flex items-center space-x-1 disabled:opacity-50"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </>
                      ) : app.status === 'negotiating' || app.status === 'proposal_pending' || app.status === 'changes_requested' ? (
                        <button
                          type="button"
                          onClick={() => navigate(`/applications/${app.id}/negotiation`)}
                          className="h-9 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs transition-all cursor-pointer flex items-center space-x-1 shadow-2xs"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>{app.status === 'proposal_pending' ? 'Review Final Deal' : 'Open Negotiation'}</span>
                        </button>
                      ) : app.status === 'rejected' ? (
                        <button
                          type="button"
                          onClick={() => updateStatus(app.id, 'pending')}
                          disabled={actionLoading}
                          className="h-9 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-all cursor-pointer flex items-center space-x-1 disabled:opacity-50"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Restore</span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#111827] rounded-2xl p-5 sm:p-6 max-w-xs w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 text-center animate-fade-in-up">
            <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center shadow-xs ${confirmAction.type === 'accept' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'}`}>
              {confirmAction.type === 'accept' ? <Check className="w-6 h-6" /> : <X className="w-6 h-6" />}
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-[#0F172A] dark:text-white">
                {confirmAction.type === 'accept' ? 'Accept Application?' : 'Reject Application?'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {confirmAction.type === 'accept'
                  ? 'The applicant will be notified and messaging will be enabled.'
                  : 'This application will be marked as rejected.'}
              </p>
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                disabled={actionLoading}
                className="flex-1 py-2 px-3 rounded-xl font-bold text-xs text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => updateStatus(confirmAction.appId, confirmAction.type === 'accept' ? 'accepted' : 'rejected')}
                disabled={actionLoading}
                className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs text-white transition-all shadow-xs cursor-pointer ${
                  confirmAction.type === 'accept'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {actionLoading ? 'Saving...' : (confirmAction.type === 'accept' ? 'Accept' : 'Reject')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
