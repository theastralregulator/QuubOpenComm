import React, { useState, useEffect } from 'react';
import { Star, EyeOff, ShieldCheck, Flag, Search, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase, dbService } from '../../lib/supabase';

export default function AdminReviews() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  
  // Moderation Modal
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [reasonInput, setReasonInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('contract_reviews')
        .select(`
          id, rating, title, comment, is_public, created_at,
          reviewer:reviewer_id (full_name),
          reviewee:reviewee_id (full_name),
          contract:contract_id (work_title)
        `)
        .order('created_at', { ascending: false });

      if (err) throw err;
      setReviews(data || []);
    } catch (err: any) {
      console.error('Fetch reviews error:', err);
      setError(err.message || 'Failed to load reviews.');
    } finally {
      setLoading(false);
    }
  };

  const handleHideReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReviewId || !reasonInput.trim()) return;
    setSubmitting(true);
    try {
      await dbService.adminHideReview(selectedReviewId, reasonInput.trim());
      setToastMsg('Review hidden successfully.');
      setSelectedReviewId(null);
      setReasonInput('');
      await fetchReviews();
    } catch (err: any) {
      console.error('Hide review error:', err);
      setError(err.message || 'Failed to hide review.');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = reviews.filter(r => {
    return (
      (r.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.comment || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.reviewer?.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.reviewee?.full_name || '').toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="space-y-6 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">Ratings & Reviews Moderation</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">Moderate platform feedback, hide policy-violating reviews, and enforce community standards</p>
        </div>
        <button
          onClick={fetchReviews}
          className="px-3.5 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 flex items-center space-x-1.5 self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {toastMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs text-emerald-700 dark:text-emerald-300 font-bold flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs text-rose-700 dark:text-rose-300 font-bold flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search by reviewer, reviewee, or keyword..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-900 dark:text-white"
        />
      </div>

      {/* Reviews Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-2 p-8 text-center text-slate-400 text-xs">Loading reviews...</div>
        ) : filtered.length === 0 ? (
          <div className="col-span-2 p-8 text-center text-slate-400 text-xs">No reviews found.</div>
        ) : (
          filtered.map((rev) => (
            <div key={rev.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3 shadow-2xs">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
                    Work: {rev.contract?.work_title || 'Contract'}
                  </span>
                  <div className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                    {rev.reviewer?.full_name || 'Reviewer'} → <span className="text-purple-600 dark:text-purple-400">{rev.reviewee?.full_name || 'Reviewee'}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-3.5 h-3.5 ${
                        star <= rev.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200 dark:text-slate-800'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {rev.title && (
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">"{rev.title}"</h4>
              )}

              {rev.comment && (
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{rev.comment}</p>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800 text-[10px]">
                <span className={`px-2 py-0.5 rounded-full font-bold ${
                  rev.is_public ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                }`}>
                  {rev.is_public ? 'Public' : 'Hidden by Admin'}
                </span>

                {rev.is_public && (
                  <button
                    onClick={() => {
                      setSelectedReviewId(rev.id);
                      setReasonInput('');
                    }}
                    className="px-3 py-1 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 rounded-lg font-bold flex items-center space-x-1 cursor-pointer hover:bg-rose-100"
                  >
                    <EyeOff className="w-3 h-3" />
                    <span>Hide Review</span>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Hide Modal */}
      {selectedReviewId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
              <EyeOff className="w-4 h-4 text-rose-500" />
              <span>Hide Review</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Hiding a review removes it from public display. A mandatory audit log entry will be created.
            </p>

            <form onSubmit={handleHideReview} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Mandatory Moderation Reason</label>
                <textarea
                  rows={3}
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  placeholder="Explain why this review is being hidden..."
                  className="w-full p-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white resize-none"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedReviewId(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !reasonInput.trim()}
                  className="px-5 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl disabled:opacity-50"
                >
                  {submitting ? 'Hiding...' : 'Confirm Hide'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
