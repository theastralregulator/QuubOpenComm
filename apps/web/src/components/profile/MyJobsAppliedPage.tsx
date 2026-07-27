import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Briefcase, Search, ExternalLink, IndianRupee, MapPin, Building, AlertCircle, MessageSquare } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatSalaryRange } from '../../lib/currency';

interface AppliedJob {
  id: string; // application id
  job_id: string;
  proposed_rate: string;
  cover_letter: string;
  status: string;
  created_at: string;
  job: {
    id: string;
    title: string;
    location: string;
    salary_range: string;
    posted_by: string;
    is_active?: boolean;
  };
  employer?: {
    full_name: string;
    avatar_url: string;
  };
}

interface MyJobsAppliedPageProps {
  handleStartConversation: (contactId: string, contactName: string, contactPhoto: string) => void;
}

export default function MyJobsAppliedPage({ handleStartConversation }: MyJobsAppliedPageProps) {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<AppliedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  const fetchApplications = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) {
        throw new Error("You must be logged in to view your applications.");
      }

      console.log("Fetching applications for user:", user.id);

      // Step A: Fetch applications only
      const { data: applicationRows, error: applicationsError } = await supabase
        .from('job_applications')
        .select(`
          id,
          job_id,
          applicant_id,
          proposed_rate,
          cover_letter,
          status,
          created_at
        `)
        .eq('applicant_id', user.id)
        .order('created_at', { ascending: false });

      if (applicationsError) throw applicationsError;

      const rawApps = applicationRows || [];
      console.log("Application row count:", rawApps.length);

      if (rawApps.length === 0) {
        setApplications([]);
        return;
      }

      // Step B: Fetch jobs separately
      const jobIds = [...new Set(rawApps.map(row => row.job_id))];
      console.log("Job IDs to fetch:", jobIds);

      const { data: jobRows, error: jobsError } = await supabase
        .from('jobs')
        .select(`
          id,
          title,
          location,
          salary_range,
          posted_by,
          is_active,
          created_at
        `)
        .in('id', jobIds);

      if (jobsError) throw jobsError;

      const fetchedJobs = jobRows || [];
      console.log("Fetched jobs count:", fetchedJobs.length);
      
      const jobMap = fetchedJobs.reduce((acc, job) => {
        acc[job.id] = job;
        return acc;
      }, {} as Record<string, any>);

      // Step C: Fetch employer profiles
      const employerIds = [...new Set(fetchedJobs.filter(j => j.posted_by).map(job => job.posted_by))];
      
      let employerMap: Record<string, any> = {};
      if (employerIds.length > 0) {
        const { data: employerRows, error: employerError } = await supabase
          .from('profile_directory')
          .select('id, full_name, avatar_url')
          .in('id', employerIds);
          
        if (employerError) {
          console.error("Error fetching employers:", employerError);
        } else if (employerRows) {
          employerMap = employerRows.reduce((acc, emp) => {
            acc[emp.id] = emp;
            return acc;
          }, {} as Record<string, any>);
        }
      }

      // Step D: Merge all datasets
      const mergedApplications: AppliedJob[] = rawApps.map(app => {
        const job = jobMap[app.job_id];
        const employer = job?.posted_by ? employerMap[job.posted_by] : null;

        return {
          id: app.id,
          job_id: app.job_id,
          proposed_rate: app.proposed_rate,
          cover_letter: app.cover_letter,
          status: app.status,
          created_at: app.created_at,
          job: {
            id: job?.id || app.job_id,
            title: job?.title || 'Unknown Job',
            location: job?.location || 'Remote',
            salary_range: job?.salary_range || 'Contract',
            posted_by: job?.posted_by || '',
            is_active: job?.is_active ?? false
          },
          employer: employer || { full_name: 'Employer', avatar_url: '' }
        };
      });

      console.log("Merged applications count:", mergedApplications.length);
      setApplications(mergedApplications);
    } catch (err: any) {
      console.error("Error fetching applications:", err);
      setError(err.message || "An error occurred while fetching your applications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let channel: any;
    
    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      channel = supabase
        .channel(`job-applications-${user.id}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'job_applications',
          filter: `applicant_id=eq.${user.id}`
        }, fetchApplications)
        .subscribe();
    };
    
    setup();
    fetchApplications();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const handleViewJob = (jobId: string) => {
    navigate(`/jobs/${jobId}`);
  };

  const handleWithdraw = async (appId: string) => {
    if (!confirm('Are you sure you want to withdraw this application?')) return;
    
    setWithdrawingId(appId);
    try {
      const { error } = await supabase.rpc('withdraw_job_application', {
        p_application_id: appId
      });

      if (error) throw error;
      
      setApplications(prev => prev.map(app => 
        app.id === appId ? { ...app, status: 'withdrawn' } : app
      ));
    } catch (err: any) {
      alert("Failed to withdraw application: " + err.message);
    } finally {
      setWithdrawingId(null);
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
      case 'under_review':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">Reviewed</span>;
      case 'withdrawn':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-400">Withdrawn</span>;
      case 'pending':
      default:
        return <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400">Pending</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 py-6 px-4 sm:px-6 lg:px-8 pt-24 pb-[calc(100px+env(safe-area-inset-bottom))]">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => navigate('/profile')}
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </button>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Jobs Applied
            </h1>
          </div>
          <button
            onClick={() => navigate('/jobs')}
            className="flex items-center justify-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-sm"
          >
            <Search className="w-4 h-4" />
            <span>Find Jobs</span>
          </button>
        </div>

        {/* State Content */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 h-32 animate-pulse flex flex-col justify-between" />
            ))}
          </div>
        ) : error ? (
          <div className="bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800 rounded-3xl p-8 text-center space-y-4">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
            <h3 className="text-lg font-bold text-rose-600 dark:text-rose-400">Failed to load applications</h3>
            <p className="text-slate-600 dark:text-slate-400">{error}</p>
            <button 
              onClick={fetchApplications}
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 font-bold transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry</span>
            </button>
          </div>
        ) : applications.length === 0 ? (
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-6 shadow-sm">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <Briefcase className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">You haven’t applied to any jobs yet.</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mx-auto">
                Discover your next big opportunity. When you apply, you can track your applications here.
              </p>
            </div>
            <button
              onClick={() => navigate('/jobs')}
              className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-sm"
            >
              Explore Opportunities
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map(app => {
              const employerName = app.employer?.full_name || 'Verified Employer';
              
              return (
                <div key={app.id} className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 md:p-6 transition-all shadow-sm hover:shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="flex items-center justify-between md:justify-start md:gap-4 w-full">
                      <div className="flex items-center gap-3 truncate">
                        <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white truncate">
                          {app.job?.title || 'Unknown Job'}
                        </h3>
                        {app.job?.is_active === false && (
                          <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider border border-slate-200 dark:border-slate-700">
                            Closed
                          </span>
                        )}
                      </div>
                      <div className="md:hidden shrink-0">
                        {renderStatusBadge(app.status)}
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-slate-500 dark:text-slate-400">
                      <div className="flex items-center space-x-1.5">
                        <Building className="w-4 h-4 shrink-0" />
                        <span className="truncate max-w-[120px]">{employerName}</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <MapPin className="w-4 h-4 shrink-0" />
                        <span className="truncate max-w-[100px]">{app.job?.location || 'Remote'}</span>
                      </div>
                      {app.proposed_rate && (
                        <div className="flex items-center space-x-1.5">
                          <IndianRupee className="w-4 h-4 shrink-0" />
                          <span>{app.proposed_rate}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="text-xs text-slate-400 dark:text-slate-500">
                      Applied on {new Date(app.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between md:justify-end gap-3 pt-4 md:pt-0 border-t border-slate-100 dark:border-slate-800 md:border-t-0 mt-4 md:mt-0">
                    <div className="hidden md:block shrink-0 mr-2">
                      {renderStatusBadge(app.status)}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {app.status === 'accepted' && (
                        <button
                          onClick={() => handleStartConversation(app.job?.posted_by, employerName, app.employer?.avatar_url || '')}
                          className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-sm font-bold rounded-lg transition-colors"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Message Employer</span>
                        </button>
                      )}
                      {(app.status === 'pending' || app.status === 'under_review') && (
                        <button
                          onClick={() => handleWithdraw(app.id)}
                          disabled={withdrawingId === app.id}
                          className="px-4 py-2 text-sm font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {withdrawingId === app.id ? '...' : 'Withdraw'}
                        </button>
                      )}
                      <button
                        onClick={() => handleViewJob(app.job_id)}
                        className="flex items-center space-x-1.5 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-sm font-bold rounded-lg transition-colors"
                      >
                        <span>View Job</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
