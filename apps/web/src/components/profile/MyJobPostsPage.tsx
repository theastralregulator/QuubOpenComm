import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Briefcase, Plus, AlertCircle } from 'lucide-react';
import { supabase, dbService } from '../../lib/supabase';
import MyJobCard, { MyJobItem, OwnerProfile } from './MyJobCard';

export default function MyJobPostsPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<MyJobItem[]>([]);
  const [ownerProfile, setOwnerProfile] = useState<OwnerProfile>({});
  const [appCountsMap, setAppCountsMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const user = userData?.user;
      if (!user) {
        setJobs([]);
        return;
      }

      // Step A: Fetch jobs posted by current user
      const { data: jobRows, error: fetchError } = await supabase
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
        .eq('posted_by', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      const rawJobs: MyJobItem[] = (jobRows || []).map(d => ({
        id: d.id,
        title: d.title || 'Untitled Post',
        description: d.description || '',
        location: d.location || 'Remote',
        salary_range: d.salary_range || 'Salary discussed during selection',
        category: d.category || 'Professional',
        job_type: d.job_type || null,
        posted_by: d.posted_by,
        created_at: d.created_at,
        application_deadline: d.application_deadline || null,
        is_active: d.is_active !== undefined ? d.is_active : true,
      }));

      setJobs(rawJobs);

      // Step B: Single Batched query for application counts across all owner jobs
      if (rawJobs.length > 0) {
        const jobIds = rawJobs.map(j => j.id);
        const { data: appRows, error: appErr } = await supabase
          .from('job_applications')
          .select('job_id')
          .in('job_id', jobIds);

        if (!appErr && appRows) {
          const counts: Record<string, number> = {};
          appRows.forEach((row: any) => {
            counts[row.job_id] = (counts[row.job_id] || 0) + 1;
          });
          setAppCountsMap(counts);
        }
      }

      // Step C: Fetch owner profile details
      const { data: profileDir } = await supabase
        .from('profile_directory')
        .select('full_name, company_name, avatar_url, verified, is_verified')
        .eq('id', user.id)
        .maybeSingle();

      if (profileDir) {
        setOwnerProfile({
          full_name: profileDir.full_name || profileDir.company_name || 'My Profile',
          avatar_url: profileDir.avatar_url || '',
          verified: Boolean(profileDir.verified || profileDir.is_verified),
        });
      } else {
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name, avatar_url, verified')
          .eq('id', user.id)
          .maybeSingle();
          
        if (prof) {
          setOwnerProfile({
            full_name: prof.full_name || 'My Profile',
            avatar_url: prof.avatar_url || '',
            verified: Boolean(prof.verified),
          });
        }
      }
    } catch (err: any) {
      console.error('[My Job Posts] Fetch error:', err);
      setError(err.message || "Unable to load your job posts. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleEdit = (jobId: string) => {
    navigate(`/jobs/edit/${jobId}`);
  };

  const handleView = (jobId: string) => {
    navigate(`/jobs/${jobId}`);
  };

  const handleDelete = async (jobId: string) => {
    try {
      await dbService.deleteMyJob(jobId);
      setJobs(prev => prev.filter(j => j.id !== jobId));
    } catch (err: any) {
      alert("Failed to delete job: " + err.message);
    }
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
                  My Job Posts
                </h1>
                {!loading && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-[#6C4DFF]/10 text-[#6C4DFF] dark:text-purple-300 border border-[#6C4DFF]/20">
                    {jobs.length} {jobs.length === 1 ? 'Job Post' : 'Job Posts'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Manage your posted opportunities, view applicants, and track status.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/jobs?action=post')}
            className="h-10 px-4 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#4F46E5] hover:opacity-95 text-white font-bold text-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Post a Job</span>
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
            <h3 className="text-base font-bold text-rose-700 dark:text-rose-300">Failed to load your jobs</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto">{error}</p>
            <button 
              type="button"
              onClick={fetchJobs}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 font-bold text-xs transition-all cursor-pointer shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : jobs.length === 0 ? (
          <div className="bg-white dark:bg-[#111827] border border-[#ECEEF5] dark:border-slate-800 rounded-[22px] p-8 sm:p-12 text-center space-y-4 shadow-xs">
            <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto">
              <Briefcase className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-bold text-[#0F172A] dark:text-white">You haven’t posted any jobs yet.</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                Create a job post to find the right talent for your projects. Your listings will appear here so you can track and manage them easily.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/jobs?action=post')}
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-[#2563EB] to-[#4F46E5] text-white font-bold text-xs rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Post a Job</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3.5">
            {jobs.map(job => (
              <MyJobCard 
                key={job.id} 
                job={job}
                ownerProfile={ownerProfile}
                applicationCount={appCountsMap[job.id] || 0}
                onEdit={handleEdit}
                onView={handleView}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
