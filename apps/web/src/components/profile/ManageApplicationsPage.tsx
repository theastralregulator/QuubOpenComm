import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, X, MessageSquare, ExternalLink, ShieldCheck, RefreshCw, AlertCircle, Bookmark, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ApplicantData {
  id: string; // application id
  applicant_id: string;
  proposed_rate: string;
  cover_letter: string;
  status: string;
  created_at: string;
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
  const [jobTitle, setJobTitle] = useState('Job Applications');
  const [applications, setApplications] = useState<ApplicantData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'shortlisted' | 'accepted' | 'rejected'>('all');
  const [expandedCovers, setExpandedCovers] = useState<Record<string, boolean>>({});

  // Modal / Confirm state
  const [confirmAction, setConfirmAction] = useState<{ type: 'accept' | 'reject'; appId: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchApplications();

    if (!jobId) return;

    // Realtime subscription
    const channel = supabase.channel(`public:job_applications:job_id=${jobId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'job_applications',
        filter: `job_id=eq.${jobId}`
      }, (payload) => {
        // Trigger a full refetch on any change to ensure consistency 
        // with joined profile data, or manually merge it.
        fetchApplications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId]);

  const fetchApplications = async () => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      // Verify ownership & get job title
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('title, posted_by')
        .eq('id', jobId)
        .single();
        
      if (jobError || !jobData) throw new Error('This job is unavailable.');
      if (jobData.posted_by !== userData.user.id) throw new Error('You are not authorized to manage applications for this job.');

      setJobTitle(jobData.title);

      // Fetch applications joined with profile_directory
      const { data: appsData, error: appsError } = await supabase
        .from('job_applications')
        .select(`
          id, applicant_id, proposed_rate, cover_letter, status, created_at
        `)
        .eq('job_id', jobId)
        .order('created_at', { ascending: false });

      if (appsError) throw appsError;

      const rawApps = appsData || [];
      const applicantIds = [...new Set(rawApps.map(a => a.applicant_id))];
      
      let profileMap: Record<string, any> = {};
      
      if (applicantIds.length > 0) {
        const { data: profData, error: profError } = await supabase
          .from('profile_directory')
          .select('id, username, full_name, avatar_url, city, state, country, profile_type, bio, preferred_language')
          .in('id', applicantIds);
          
        if (profError) {
          if (import.meta.env.DEV) console.error('Profile fetch error:', profError);
        } else if (profData) {
          profileMap = profData.reduce((acc, curr) => {
            acc[curr.id] = curr;
            return acc;
          }, {} as Record<string, any>);
        }
      }

      const mergedApps: ApplicantData[] = rawApps.map(app => {
        const p = profileMap[app.applicant_id];
        let location = 'Location not provided';
        if (p) {
          location = [p.city, p.state, p.country].filter(Boolean).join(', ') || location;
        }

        return {
          id: app.id,
          applicant_id: app.applicant_id,
          proposed_rate: app.proposed_rate,
          cover_letter: app.cover_letter,
          status: app.status,
          created_at: app.created_at,
          profile: {
            full_name: p?.full_name || 'Unknown Applicant',
            avatar_url: p?.avatar_url || '',
            location,
            profile_type: p?.profile_type || 'normal',
            bio: p?.bio || '',
            preferred_language: p?.preferred_language || '',
            username: p?.username || ''
          }
        };
      });

      setApplications(mergedApps);
    } catch (err: any) {
      setError(err.message || "Failed to load applications");
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
      
      // If shortlisted, show toast directly instead of modal since there is no confirm modal for shortlist
      if (newStatus === 'shortlisted' || newStatus === 'pending') {
        // success toast could go here if we had triggerToast in props, we'll just silently update
      }
    } catch (err: any) {
      alert("Failed to update status: " + err.message);
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted':
        return <span className="px-3 py-1 text-[11px] uppercase tracking-wider font-extrabold rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Accepted</span>;
      case 'rejected':
        return <span className="px-3 py-1 text-[11px] uppercase tracking-wider font-extrabold rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">Rejected</span>;
      case 'shortlisted':
        return <span className="px-3 py-1 text-[11px] uppercase tracking-wider font-extrabold rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">Shortlisted</span>;
      case 'withdrawn':
        return <span className="px-3 py-1 text-[11px] uppercase tracking-wider font-extrabold rounded-lg bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400">Withdrawn</span>;
      case 'pending':
      case 'under_review':
      default:
        return <span className="px-3 py-1 text-[11px] uppercase tracking-wider font-extrabold rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Pending</span>;
    }
  };

  const toggleCover = (id: string) => {
    setExpandedCovers(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getInitials = (name: string) => {
    if (!name || name === 'Unknown Applicant') return 'UA';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const counts = {
    all: applications.length,
    pending: applications.filter(a => a.status === 'pending' || a.status === 'under_review').length,
    shortlisted: applications.filter(a => a.status === 'shortlisted').length,
    accepted: applications.filter(a => a.status === 'accepted').length,
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
    return app.status === filterStatus;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#050810] text-slate-900 dark:text-slate-100 py-6 px-4 sm:px-6 lg:px-8 pt-24 pb-[calc(100px+env(safe-area-inset-bottom))]">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Sticky Header */}
        <div className="sticky top-[72px] z-20 bg-slate-50/90 dark:bg-[#050810]/90 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 pb-4 pt-2 -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex flex-col space-y-5">
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => jobId ? navigate(`/jobs/${jobId}`) : navigate('/jobs')}
                className="p-2.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors bg-white dark:bg-[#0B0F19] shadow-sm border border-slate-200 dark:border-slate-800"
                title="Back to Job Details"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  Manage Applications
                </h1>
                <div className="flex items-center space-x-2 mt-0.5">
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{jobTitle}</span>
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{counts.all} total</span>
                </div>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-hide">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setFilterStatus(tab.id as any)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                    filterStatus === tab.id 
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md' 
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 dark:bg-[#0B0F19] dark:text-slate-400 dark:border-slate-800 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] ${
                    filterStatus === tab.id
                      ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 rounded-[24px] p-6 h-48 animate-pulse flex flex-col justify-between shadow-sm" />
            ))}
          </div>
        ) : error ? (
          <div className="bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800 rounded-[24px] p-8 text-center space-y-4 shadow-sm">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
            <h3 className="text-lg font-bold text-rose-600 dark:text-rose-400">Error loading applications</h3>
            <p className="text-slate-600 dark:text-slate-400">{error}</p>
          </div>
        ) : filteredApps.length === 0 ? (
          <div className="bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 rounded-[24px] p-12 text-center space-y-6 shadow-sm">
            <div className="w-16 h-16 bg-slate-50 dark:bg-[#111827] text-slate-400 dark:text-slate-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100 dark:border-slate-800">
              <Check className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">No applications found.</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mx-auto">
                {filterStatus === 'all' 
                  ? "When talented workers apply to your posting, they will appear here."
                  : `There are currently no applications matching the '${tabs.find(t => t.id === filterStatus)?.label}' filter.`}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {filteredApps.map(app => {
              const isExpanded = expandedCovers[app.id];
              return (
                <div key={app.id} className="bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 rounded-[24px] p-5 sm:p-7 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-shadow">
                  {/* Header Row */}
                  <div className="flex flex-col sm:flex-row gap-5 items-start">
                    <div className="flex items-start gap-4 flex-1 w-full">
                      <button 
                        onClick={() => navigate(`/profile/${app.applicant_id}`)}
                        className="w-14 h-14 sm:w-16 sm:h-16 rounded-full shrink-0 overflow-hidden border-2 border-white dark:border-slate-800 shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold text-lg cursor-pointer"
                      >
                        {app.profile.avatar_url ? (
                          <img 
                            src={app.profile.avatar_url} 
                            alt="Avatar" 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          getInitials(app.profile.full_name)
                        )}
                      </button>
                      
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex justify-between items-start gap-2">
                          <div className="space-y-1 w-full pr-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <button 
                                onClick={() => navigate(`/profile/${app.applicant_id}`)}
                                className="font-extrabold text-slate-900 dark:text-white text-lg leading-tight hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-left"
                              >
                                {app.profile.full_name}
                              </button>
                              
                              {app.profile.profile_type === 'worker' ? (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400">
                                  WORKER
                                </span>
                              ) : app.profile.profile_type === 'company' ? (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                                  COMPANY
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400">
                                  BASIC
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">{app.profile.location}</p>
                            <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                              Applied {new Date(app.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                          <div className="shrink-0 mt-1 sm:mt-0">
                            {renderStatusBadge(app.status)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 space-y-4">
                    {/* Rate & Cover Letter */}
                    {app.proposed_rate && (
                      <div className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-50 dark:bg-[#111827] border border-slate-100 dark:border-slate-800 rounded-xl">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Proposed Rate:</span>
                        <span className="text-sm font-black text-slate-900 dark:text-white">{app.proposed_rate}</span>
                      </div>
                    )}
                    
                    {app.cover_letter && (
                      <div className="p-4 sm:p-5 bg-slate-50 dark:bg-[#111827] rounded-[20px] border border-slate-100 dark:border-slate-800 relative">
                        <div className={`text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-pre-wrap ${!isExpanded ? 'line-clamp-4' : ''}`}>
                          {app.cover_letter}
                        </div>
                        {app.cover_letter.length > 200 && (
                          <button
                            onClick={() => toggleCover(app.id)}
                            className="mt-3 text-xs font-extrabold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 transition-colors"
                          >
                            {isExpanded ? (
                              <><ChevronUp className="w-4 h-4" /> Show Less</>
                            ) : (
                              <><ChevronDown className="w-4 h-4" /> Read More</>
                            )}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800/60">
                      <div className="flex flex-col gap-3">
                        {/* Primary Nav Row */}
                        <div className="flex gap-3 w-full">
                          <button
                            onClick={() => navigate(`/profile/${app.applicant_id}`)}
                            className="flex-1 flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-sm font-bold rounded-xl transition-all cursor-pointer"
                          >
                            <ExternalLink className="w-4 h-4" />
                            <span>View Profile</span>
                          </button>
                          
                          {app.status === 'accepted' && (
                            <button
                              onClick={() => handleStartConversation(app.id)}
                              className="flex-1 flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-sm font-bold rounded-xl transition-all cursor-pointer"
                            >
                              <MessageSquare className="w-4 h-4" />
                              <span>Message Applicant</span>
                            </button>
                          )}
                        </div>

                        {/* Decision Row */}
                        <div className="flex flex-col sm:flex-row gap-3 w-full">
                          {app.status === 'pending' || app.status === 'under_review' ? (
                            <>
                              <button
                                onClick={() => updateStatus(app.id, 'shortlisted')}
                                disabled={actionLoading}
                                className="flex-1 flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-purple-50 dark:bg-purple-500/10 hover:bg-purple-100 dark:hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 text-sm font-bold rounded-xl transition-all cursor-pointer"
                              >
                                <Bookmark className="w-4 h-4" />
                                <span>Shortlist</span>
                              </button>
                              <button
                                onClick={() => setConfirmAction({ type: 'accept', appId: app.id })}
                                disabled={actionLoading}
                                className="flex-[2] flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-bold rounded-xl transition-all cursor-pointer"
                              >
                                <Check className="w-4 h-4" />
                                <span>Accept</span>
                              </button>
                              <button
                                onClick={() => setConfirmAction({ type: 'reject', appId: app.id })}
                                disabled={actionLoading}
                                className="flex-[2] flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-sm font-bold rounded-xl transition-all cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                                <span>Reject</span>
                              </button>
                            </>
                          ) : app.status === 'shortlisted' ? (
                            <>
                              <button
                                onClick={() => updateStatus(app.id, 'pending')}
                                disabled={actionLoading}
                                className="flex-1 flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-xl transition-all cursor-pointer"
                              >
                                <RefreshCw className="w-4 h-4" />
                                <span>To Pending</span>
                              </button>
                              <button
                                onClick={() => setConfirmAction({ type: 'accept', appId: app.id })}
                                disabled={actionLoading}
                                className="flex-[2] flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-bold rounded-xl transition-all cursor-pointer"
                              >
                                <Check className="w-4 h-4" />
                                <span>Accept</span>
                              </button>
                              <button
                                onClick={() => setConfirmAction({ type: 'reject', appId: app.id })}
                                disabled={actionLoading}
                                className="flex-[2] flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-sm font-bold rounded-xl transition-all cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                                <span>Reject</span>
                              </button>
                            </>
                          ) : app.status === 'rejected' ? (
                            <button
                                onClick={() => updateStatus(app.id, 'pending')}
                                disabled={actionLoading}
                                className="flex-1 flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-xl transition-all cursor-pointer"
                              >
                                <RefreshCw className="w-4 h-4" />
                                <span>Restore to Pending</span>
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation Dialogs */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6 text-center animate-fade-in-up">
            <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center shadow-inner ${confirmAction.type === 'accept' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400'}`}>
              {confirmAction.type === 'accept' ? <Check className="w-8 h-8" /> : <X className="w-8 h-8" />}
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                {confirmAction.type === 'accept' ? 'Accept Application?' : 'Reject Application?'}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                {confirmAction.type === 'accept' 
                  ? 'They will be notified that their application was accepted and you can begin messaging.' 
                  : 'This application will be marked as rejected.'}
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setConfirmAction(null)}
                disabled={actionLoading}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => updateStatus(confirmAction.appId, confirmAction.type === 'accept' ? 'accepted' : 'rejected')}
                disabled={actionLoading}
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-white transition-all shadow-md cursor-pointer ${
                  confirmAction.type === 'accept' 
                    ? 'bg-emerald-600 hover:bg-emerald-500 hover:shadow-emerald-500/20' 
                    : 'bg-rose-600 hover:bg-rose-500 hover:shadow-rose-500/20'
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
