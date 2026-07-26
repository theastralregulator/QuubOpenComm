import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Briefcase, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { dbService } from '../../lib/supabase';
import MyJobCard from './MyJobCard';
import { Job } from '../../types';

export default function MyJobPostsPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        throw new Error("You must be logged in to view your jobs.");
      }

      const { data, error: fetchError } = await supabase
        .from('jobs')
        .select('*')
        .eq('posted_by', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // map DB fields to our frontend Job type
      const mappedJobs: Job[] = (data || []).map(d => ({
        id: d.id,
        title: d.title,
        description: d.description,
        salary: d.salary_range || 'N/A',
        location: d.location || 'Remote',
        category: d.category,
        requirements: d.requirements || [],
        datePosted: d.created_at,
        posted_by: d.posted_by,
        created_at: d.created_at,
        is_active: d.is_active,
        employment_type: d.employment_type || 'Contract'
      }));

      setJobs(mappedJobs);
    } catch (err: any) {
      setError(err.message || "An error occurred while fetching your jobs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleEdit = (jobId: string) => {
    // Navigate to job posting form in edit mode or trigger an edit modal
    // Assuming there's a route for editing, if not we navigate to post-job with id
    navigate(`/jobs/edit/${jobId}`);
  };

  const handleView = (jobId: string) => {
    navigate(`/jobs/${jobId}`);
  };

  const handleChangeStatus = async (jobId: string, isActive: boolean) => {
    try {
      await dbService.updateMyJobStatus(jobId, isActive);
      // update local state to reflect
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, is_active: isActive } : j));
    } catch (err: any) {
      alert("Failed to update status: " + err.message);
    }
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
              My Job Posts
            </h1>
          </div>
          <button
            onClick={() => navigate('/jobs?action=post')}
            className="flex items-center justify-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Post a Job</span>
          </button>
        </div>

        {/* State Content */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 h-40 animate-pulse flex flex-col justify-between">
                <div className="flex justify-between">
                  <div className="w-1/2 h-6 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full" />
                </div>
                <div className="w-1/3 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="w-2/3 h-4 bg-slate-200 dark:bg-slate-700 rounded mt-4" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800 rounded-3xl p-8 text-center space-y-4">
            <h3 className="text-lg font-bold text-rose-600 dark:text-rose-400">Failed to load jobs</h3>
            <p className="text-slate-600 dark:text-slate-400">{error}</p>
            <button 
              onClick={fetchJobs}
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 font-bold transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry</span>
            </button>
          </div>
        ) : jobs.length === 0 ? (
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-6 shadow-sm">
            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <Briefcase className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">You haven’t posted any jobs yet.</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mx-auto">
                Create a job post to find the right talent for your projects. Your listings will appear here so you can track and manage them easily.
              </p>
            </div>
            <button
              onClick={() => navigate('/jobs?action=post')}
              className="inline-flex items-center space-x-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg"
            >
              <Plus className="w-5 h-5" />
              <span>Post a Job</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map(job => (
              <MyJobCard 
                key={job.id} 
                job={job} 
                onEdit={handleEdit}
                onView={handleView}
                onChangeStatus={handleChangeStatus}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
