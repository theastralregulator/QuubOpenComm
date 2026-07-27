import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, X, MessageSquare, ExternalLink, ShieldCheck, RefreshCw, AlertCircle, Bookmark } from 'lucide-react';
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
    verification_level: string;
  };
}

interface ManageApplicationsPageProps {
  handleStartConversation: (contactId: string, contactName: string, contactPhoto: string) => void;
}

export default function ManageApplicationsPage({ handleStartConversation }: ManageApplicationsPageProps) {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [jobTitle, setJobTitle] = useState('Job Applications');
  const [applications, setApplications] = useState<ApplicantData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        
      if (jobError || !jobData) throw new Error('Job not found');
      if (jobData.posted_by !== userData.user.id) throw new Error('Unauthorized');

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
          .select('id, full_name, avatar_url, location, profile_type, verification_level')
          .in('id', applicantIds);
          
        if (!profError && profData) {
          profileMap = profData.reduce((acc, curr) => {
            acc[curr.id] = curr;
            return acc;
          }, {} as Record<string, any>);
        }
      }

      const mergedApps: ApplicantData[] = rawApps.map(app => ({
        id: app.id,
        applicant_id: app.applicant_id,
        proposed_rate: app.proposed_rate,
        cover_letter: app.cover_letter,
        status: app.status,
        created_at: app.created_at,
        profile: profileMap[app.applicant_id] || {
          full_name: 'Unknown Applicant',
          avatar_url: '',
          location: 'Unknown',
          profile_type: 'normal',
          verification_level: 'none'
        }
      }));

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
        return <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">Accepted</span>;
      case 'rejected':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400">Rejected</span>;
      case 'shortlisted':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400">Shortlisted</span>;
      case 'withdrawn':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-400">Withdrawn</span>;
      case 'pending':
      case 'under_review':
      default:
        return <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">Pending</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 py-6 px-4 sm:px-6 lg:px-8 pt-24 pb-[calc(100px+env(safe-area-inset-bottom))]">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => navigate('/profile')}
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                Manage Applications
              </h1>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
                {jobTitle}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 h-48 animate-pulse flex flex-col justify-between" />
            ))}
          </div>
        ) : error ? (
          <div className="bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800 rounded-3xl p-8 text-center space-y-4">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
            <h3 className="text-lg font-bold text-rose-600 dark:text-rose-400">Error loading applications</h3>
            <p className="text-slate-600 dark:text-slate-400">{error}</p>
          </div>
        ) : applications.length === 0 ? (
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-6 shadow-sm">
            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">No applications yet.</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mx-auto">
                When talented workers apply to your posting, they will appear here.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {applications.map(app => (
              <div key={app.id} className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row gap-6">
                  {/* Left Column: Profile Info */}
                  <div className="flex items-start gap-4 sm:w-1/3 shrink-0">
                    <img 
                      src={app.profile.avatar_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=120&h=120&q=80'} 
                      alt="Avatar" 
                      className="w-16 h-16 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-bold text-slate-900 dark:text-white text-lg leading-tight">{app.profile.full_name}</h4>
                        {app.profile.verification_level === 'verified' && (
                          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                        )}
                        {app.profile.profile_type === 'worker' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                            PRO
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{app.profile.location || 'Remote'}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 pt-1">Applied: {new Date(app.created_at).toLocaleDateString()}</p>
                      <div className="pt-2">{renderStatusBadge(app.status)}</div>
                    </div>
                  </div>

                  {/* Right Column: Application Details */}
                  <div className="flex-1 space-y-4">
                    {app.proposed_rate && (
                      <div className="inline-flex items-center space-x-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700 rounded-lg">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Rate:</span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">{app.proposed_rate}</span>
                      </div>
                    )}
                    
                    {app.cover_letter && (
                      <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{app.cover_letter}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <button
                        onClick={() => navigate(`/profile/${app.applicant_id}`)}
                        className="flex items-center space-x-1.5 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-sm font-bold rounded-xl transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>View Profile</span>
                      </button>

                      <button
                        onClick={() => handleStartConversation(app.applicant_id, app.profile.full_name, app.profile.avatar_url)}
                        className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-sm font-bold rounded-xl transition-colors"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>Message</span>
                      </button>

                      {(app.status === 'pending' || app.status === 'under_review') && (
                        <button
                          onClick={() => updateStatus(app.id, 'shortlisted')}
                          disabled={actionLoading}
                          className="flex items-center space-x-1.5 px-4 py-2 bg-purple-50 dark:bg-purple-500/10 hover:bg-purple-100 dark:hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 text-sm font-bold rounded-xl transition-colors"
                        >
                          <Bookmark className="w-4 h-4" />
                          <span>Shortlist</span>
                        </button>
                      )}

                      {(app.status === 'pending' || app.status === 'shortlisted' || app.status === 'under_review') && (
                        <>
                          <button
                            onClick={() => setConfirmAction({ type: 'accept', appId: app.id })}
                            disabled={actionLoading}
                            className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-bold rounded-xl transition-colors"
                          >
                            <Check className="w-4 h-4" />
                            <span>Accept</span>
                          </button>

                          <button
                            onClick={() => setConfirmAction({ type: 'reject', appId: app.id })}
                            disabled={actionLoading}
                            className="flex items-center space-x-1.5 px-4 py-2 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-sm font-bold rounded-xl transition-colors"
                          >
                            <X className="w-4 h-4" />
                            <span>Reject</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Dialogs */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6 text-center animate-fade-in-up">
            <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${confirmAction.type === 'accept' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400'}`}>
              {confirmAction.type === 'accept' ? <Check className="w-8 h-8" /> : <X className="w-8 h-8" />}
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {confirmAction.type === 'accept' ? 'Hire this worker?' : 'Reject this application?'}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                {confirmAction.type === 'accept' 
                  ? 'They will be notified that their application was accepted.' 
                  : 'This application will be permanently marked as rejected.'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                disabled={actionLoading}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => updateStatus(confirmAction.appId, confirmAction.type === 'accept' ? 'accepted' : 'rejected')}
                disabled={actionLoading}
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-white transition-colors ${
                  confirmAction.type === 'accept' 
                    ? 'bg-emerald-600 hover:bg-emerald-700' 
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {actionLoading ? 'Saving...' : (confirmAction.type === 'accept' ? 'Hire Worker' : 'Reject')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
