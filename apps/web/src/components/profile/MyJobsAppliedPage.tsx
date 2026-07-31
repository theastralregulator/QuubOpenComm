import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Briefcase, MapPin, IndianRupee, Calendar, Clock, CheckCircle2, AlertCircle, MessageSquare, XCircle, Search } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase, dbService } from '../../lib/supabase';
import { formatSalaryRange } from '../../lib/currency';
import { getJobDateRangeInfo, formatDateDDMMYYYY } from '../../lib/deadline';
import { formatJobType } from '../../lib/jobType';

interface AppliedJobRecord {
  id: string; // application id
  job_id: string;
  proposed_rate: string | null;
  cover_letter: string | null;
  status: string;
  created_at: string;
  job: {
    id: string;
    title: string;
    description: string;
    location: string;
    salary_range: string;
    category: string;
    job_type: string | null;
    posted_by: string;
    created_at: string;
    application_deadline: string | null;
    is_active?: boolean;
  };
  employer: {
    id: string;
    full_name: string;
    avatar_url: string;
    verified: boolean;
  };
}

interface MyJobsAppliedPageProps {
  handleStartConversation: (applicationId: string) => void;
}

export default function MyJobsAppliedPage({ handleStartConversation }: MyJobsAppliedPageProps) {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<AppliedJobRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  const getInitials = (nameStr?: string) => {
    if (!nameStr) return 'EM';
    const parts = nameStr.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return nameStr.substring(0, 2).toUpperCase();
  };

  const fetchApplications = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) {
        setApplications([]);
        return;
      }

      // Step A: Fetch applications for current user
      const { data: applicationRows, error: applicationsError } = await dbService.getMyJobApplications(user.id);
      if (applicationsError) throw applicationsError;
      const rawApps = applicationRows || [];

      if (rawApps.length === 0) {
        setApplications([]);
        return;
      }

      // Step B: Fetch related jobs
      const jobIds = [...new Set(rawApps.map(row => row.job_id).filter(Boolean))];

      let jobMap: Record<string, any> = {};
      if (jobIds.length > 0) {
        const { data: jobRows, error: jobsError } = await supabase
          .from('jobs')
          .select(`
            id,
            title,
            description,
            location,
            salary_range,
            category,
            job_type,
            posted_by,
            is_active,
            created_at,
            application_deadline
          `)
          .in('id', jobIds);

        if (jobsError) console.error('[Jobs Applied] Jobs query error:', jobsError);
        if (jobRows) {
          jobMap = jobRows.reduce((acc, job) => {
            acc[job.id] = job;
            return acc;
          }, {} as Record<string, any>);
        }
      }

      // Step C: Fetch employer public profiles
      const employerIds = [...new Set(Object.values(jobMap).map(j => j.posted_by).filter(Boolean))];
      
      let employerMap: Record<string, any> = {};
      if (employerIds.length > 0) {
        const { data: employerRows, error: employerError } = await supabase
          .from('profile_directory')
          .select('id, full_name, company_name, avatar_url, city, state, verified, is_verified')
          .in('id', employerIds);
          
        if (employerError) {
          console.warn('[Jobs Applied] profile_directory query warning, attempting profiles fallback:', employerError);
          const { data: profilesFallback } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, verified')
            .in('id', employerIds);
          
          if (profilesFallback) {
            employerMap = profilesFallback.reduce((acc, emp) => {
              acc[emp.id] = {
                id: emp.id,
                full_name: emp.full_name || 'Employer',
                avatar_url: emp.avatar_url || '',
                verified: Boolean(emp.verified)
              };
              return acc;
            }, {} as Record<string, any>);
          }
        } else if (employerRows) {
          employerMap = employerRows.reduce((acc, emp) => {
            acc[emp.id] = {
              id: emp.id,
              full_name: emp.full_name || emp.company_name || 'Employer',
              avatar_url: emp.avatar_url || '',
              verified: Boolean(emp.verified || emp.is_verified)
            };
            return acc;
          }, {} as Record<string, any>);
        }
      }

      // Step D: Merge all datasets
      const mergedApplications: AppliedJobRecord[] = rawApps.map(app => {
        const job = jobMap[app.job_id];
        const employer = job?.posted_by ? employerMap[job.posted_by] : null;

        return {
          id: app.id,
          job_id: app.job_id,
          proposed_rate: app.proposed_rate || null,
          cover_letter: app.cover_letter || null,
          status: app.status || 'pending',
          created_at: app.created_at,
          job: {
            id: job?.id || app.job_id,
            title: job?.title || 'Job Listing',
            description: job?.description || '',
            location: job?.location || 'Remote',
            salary_range: job?.salary_range || 'Salary discussed during selection',
            category: job?.category || 'Professional',
            job_type: job?.job_type || null,
            posted_by: job?.posted_by || '',
            created_at: job?.created_at || app.created_at,
            application_deadline: job?.application_deadline || null,
            is_active: job?.is_active ?? true
          },
          employer: employer || { id: job?.posted_by || '', full_name: 'Employer', avatar_url: '', verified: false }
        };
      });

      setApplications(mergedApplications);
    } catch (err: any) {
      console.error('[Jobs Applied] Fetch error:', err);
      setError(err.message || 'Unable to load your applications. Please try again.');
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

    const handleFocusOrVisible = () => {
      if (document.visibilityState === 'visible') fetchApplications();
    };

    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);

    return () => {
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const handleWithdraw = async (appId: string) => {
    if (!window.confirm('Withdraw application?\nThis action may not be reversible. Are you sure you want to proceed?')) {
      return;
    }
    
    setWithdrawingId(appId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication required.");

      // Try RPC first
      const { error: rpcErr } = await supabase.rpc('withdraw_job_application', {
        p_application_id: appId
      });

      if (rpcErr) {
        // Fallback to direct update
        const { error: updateErr } = await supabase
          .from('job_applications')
          .update({ status: 'withdrawn', updated_at: new Date().toISOString() })
          .eq('id', appId)
          .eq('applicant_id', user.id);

        if (updateErr) throw updateErr;
      }
      
      setApplications(prev => prev.map(app => 
        app.id === appId ? { ...app, status: 'withdrawn' } : app
      ));
    } catch (err: any) {
      console.error('[Jobs Applied] Withdraw error:', err);
      alert("Failed to withdraw application: " + (err.message || "Please try again."));
    } finally {
      setWithdrawingId(null);
    }
  };

  const renderStatusPill = (status: string) => {
    let label = 'Applied · Pending';
    let styleClass = 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200/60';

    if (status === 'under_review') {
      label = 'Under Review';
      styleClass = 'bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 border-blue-200/60';
    } else if (status === 'shortlisted') {
      label = 'Shortlisted';
      styleClass = 'bg-purple-50 dark:bg-purple-950/30 text-purple-800 dark:text-purple-300 border-purple-200/60';
    } else if (status === 'accepted') {
      label = 'Accepted';
      styleClass = 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border-emerald-200/60';
    } else if (status === 'rejected') {
      label = 'Rejected';
      styleClass = 'bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border-rose-200/60';
    } else if (status === 'withdrawn') {
      label = 'Withdrawn';
      styleClass = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
    }

    return (
      <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold border ${styleClass}`}>
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>{label}</span>
      </span>
    );
  };

  return (
    <div className="w-full bg-[linear-gradient(180deg,#FAFBFF_0%,#F7F5FF_55%,#FAFCFF_100%)] dark:bg-[#080C14] min-h-screen text-left">
      <div className="w-full max-w-4xl mx-auto px-2.5 sm:px-4 pt-3 sm:pt-4 pb-[calc(110px+env(safe-area-inset-bottom))] space-y-4">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="flex items-center space-x-3">
            <button 
              type="button"
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl transition-colors cursor-pointer border border-slate-200/60 dark:border-slate-800"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            </button>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl sm:text-2xl font-black text-[#111827] dark:text-white tracking-tight">
                  Jobs Applied
                </h1>
                {!loading && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-[#6C4DFF]/10 text-[#6C4DFF] dark:text-purple-300 border border-[#6C4DFF]/20">
                    {applications.length} {applications.length === 1 ? 'Application' : 'Applications'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Track and manage your submitted job applications.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/jobs')}
            className="h-10 px-4 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#4F46E5] hover:opacity-95 text-white font-bold text-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs shrink-0"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Find Jobs</span>
          </button>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="space-y-3.5">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white dark:bg-[#111827] border border-[#ECEEF5] dark:border-slate-800 rounded-[22px] p-4 h-44 animate-pulse flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div className="flex space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800" />
                    <div className="space-y-2">
                      <div className="w-28 h-4 bg-slate-200 dark:bg-slate-800 rounded" />
                      <div className="w-16 h-3 bg-slate-200 dark:bg-slate-800 rounded" />
                    </div>
                  </div>
                  <div className="w-24 h-6 bg-slate-200 dark:bg-slate-800 rounded-full" />
                </div>
                <div className="w-3/4 h-5 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="w-1/2 h-4 bg-slate-200 dark:bg-slate-800 rounded" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 rounded-[22px] p-6 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
            <h3 className="text-base font-bold text-rose-700 dark:text-rose-300">Unable to load your applications</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto">{error}</p>
            <button 
              type="button"
              onClick={fetchApplications}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 font-bold text-xs transition-all cursor-pointer shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : applications.length === 0 ? (
          <div className="bg-white dark:bg-[#111827] border border-[#ECEEF5] dark:border-slate-800 rounded-[22px] p-8 sm:p-12 text-center space-y-4 shadow-xs">
            <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto">
              <Briefcase className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-bold text-[#0F172A] dark:text-white">You haven’t applied to any jobs yet.</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                Explore available job opportunities in the marketplace and submit applications to connect with employers.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/jobs')}
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-[#2563EB] to-[#4F46E5] text-white font-bold text-xs rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer"
            >
              <Search className="w-4 h-4" />
              <span>Find Jobs</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3.5">
            {applications.map(app => {
              const dateRangeInfo = getJobDateRangeInfo(app.job.created_at, app.job.application_deadline);
              const formattedSalary = formatSalaryRange(undefined, undefined, app.job.salary_range);
              const displayJobType = formatJobType(app.job.job_type);

              return (
                <motion.div
                  key={app.id}
                  whileHover={{ y: -2 }}
                  className="bg-[linear-gradient(180deg,#FFFFFF_0%,#FBF9FF_60%,#FAFBFF_100%)] dark:bg-[#111827] border border-[#ECEEF5] dark:border-[#273449]/40 rounded-[22px] p-3.5 sm:p-4 flex flex-col justify-between transition-all duration-300 relative overflow-hidden shadow-xs hover:shadow-md text-left"
                >
                  <div className="space-y-2.5">
                    {/* Top Row: Employer Avatar, Name & Status Pill */}
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center space-x-2.5 min-w-0">
                        {app.employer.avatar_url ? (
                          <img 
                            src={app.employer.avatar_url} 
                            alt={app.employer.full_name} 
                            referrerPolicy="no-referrer"
                            className="w-9 h-9 rounded-xl object-cover bg-slate-50 border border-slate-100 dark:border-slate-800 shrink-0" 
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#6C4DFF] to-[#4F46E5] text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                            {getInitials(app.employer.full_name)}
                          </div>
                        )}
                        <div className="min-w-0 text-left">
                          <h4 className="text-xs font-bold text-[#475569] dark:text-slate-300 truncate">
                            {app.employer.full_name}
                          </h4>
                          {app.employer.verified && (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-[#ECFDF5] dark:bg-emerald-950/40 border border-[#A7F3D0] dark:border-emerald-800/60 text-[#059669] dark:text-emerald-400 text-[10px] font-bold mt-0.5">
                              <CheckCircle2 className="w-3 h-3 text-[#059669] dark:text-emerald-400 shrink-0" />
                              <span>Verified</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Live Application Status Pill */}
                      <div className="shrink-0">
                        {renderStatusPill(app.status)}
                      </div>
                    </div>

                    {/* Job Title - UN-TRUNCATED 2-3 LINES */}
                    <h3 className="text-sm sm:text-base font-extrabold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight leading-snug whitespace-normal break-words overflow-visible text-left hover:text-[#2563EB] transition-colors cursor-pointer" onClick={() => navigate(`/jobs/${app.job_id}`)}>
                      {app.job.title}
                    </h3>

                    {/* Short Description */}
                    {app.job.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed text-left">
                        {app.job.description}
                      </p>
                    )}

                    {/* Meta Details: Location, Salary, Date Range & Application Date */}
                    <div className="space-y-1.5 text-xs text-[#475569] dark:text-slate-300 text-left pt-0.5">
                      <div className="flex items-center space-x-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                        <span className="whitespace-normal break-words">{app.job.location}</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <IndianRupee className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="font-semibold whitespace-normal break-words">{formattedSalary}</span>
                      </div>
                      <div className="flex items-center space-x-1.5" title={dateRangeInfo.tooltipText}>
                        <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border whitespace-normal break-words ${dateRangeInfo.badgeColorClass}`}>
                          {dateRangeInfo.rangeLabel}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1.5 text-slate-500 dark:text-slate-400 text-[11px] pt-0.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Applied on {formatDateDDMMYYYY(app.created_at)}</span>
                        {app.proposed_rate && (
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            · Rate: {app.proposed_rate}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Tags: Category & Job Type */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
                        {app.job.category || 'Professional'}
                      </span>
                      <span className="text-[10px] font-bold tracking-wide bg-slate-100 dark:bg-slate-800/60 text-[#475569] dark:text-slate-300 px-2 py-0.5 rounded-full">
                        {displayJobType}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Action Bar */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#273449]/30 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/jobs/${app.job_id}`)}
                      className="h-9 px-4 rounded-xl border border-slate-200 dark:border-[#273449] hover:bg-slate-50 dark:hover:bg-slate-800/50 text-xs font-bold text-[#475569] dark:text-slate-200 transition-all cursor-pointer flex items-center justify-center space-x-1"
                    >
                      <span>View Job</span>
                    </button>

                    <div className="flex items-center space-x-2">
                      {app.status === 'accepted' && (
                        <button
                          type="button"
                          onClick={() => handleStartConversation(app.id)}
                          className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-2xs"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Message Employer</span>
                        </button>
                      )}

                      {app.status !== 'withdrawn' && app.status !== 'rejected' && app.status !== 'accepted' && (
                        <button
                          type="button"
                          disabled={withdrawingId === app.id}
                          onClick={() => handleWithdraw(app.id)}
                          className="h-9 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 font-bold text-xs border border-rose-200 dark:border-rose-800/40 hover:bg-rose-100 transition-all cursor-pointer flex items-center justify-center space-x-1 disabled:opacity-50"
                        >
                          {withdrawingId === app.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                          <span>Withdraw</span>
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
