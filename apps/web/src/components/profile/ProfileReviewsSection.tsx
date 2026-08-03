import React, { useState, useEffect } from 'react';
import { Star, ShieldCheck, ThumbsUp, AlertCircle, Flag, MessageSquare, Briefcase, Award, CheckCircle2 } from 'lucide-react';
import { dbService } from '../../lib/supabase';
import UserAvatar from '../common/UserAvatar';

interface ProfileReviewsSectionProps {
  profileId: string;
  fullName?: string;
  triggerToast?: (msg: string) => void;
}

export default function ProfileReviewsSection({ profileId, fullName = 'User', triggerToast }: ProfileReviewsSectionProps) {
  const [summary, setSummary] = useState<any | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Report Modal State
  const [reportingReviewId, setReportingReviewId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('Inappropriate Content');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  useEffect(() => {
    if (!profileId) return;
    loadData();
  }, [profileId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sumData, revList] = await Promise.all([
        dbService.getProfileRatingSummary(profileId),
        dbService.getReviewsForProfile(profileId, 20)
      ]);
      setSummary(sumData);
      setReviews(revList);
    } catch (err) {
      console.error('Failed to load reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingReviewId) return;
    setSubmittingReport(true);
    try {
      await dbService.reportContractReview(reportingReviewId, reportReason, reportDetails);
      if (triggerToast) triggerToast('Report submitted for moderation review.');
      setReportingReviewId(null);
      setReportDetails('');
    } catch (err: any) {
      console.error('Report error:', err);
      if (triggerToast) triggerToast(err.message || 'Failed to submit report.');
    } finally {
      setSubmittingReport(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 animate-pulse">
        <div className="h-6 w-40 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
      </div>
    );
  }

  const badges = summary?.badges || {};
  const hasBadges = Object.values(badges).some(Boolean);

  return (
    <div className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 space-y-6 text-left shadow-2xs">

      {/* Section Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
            Client & Professional Reviews
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Verified feedback from completed work contracts
          </p>
        </div>

        {summary && (
          <div className="flex items-center space-x-1 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span className="text-sm font-extrabold text-amber-600 dark:text-amber-400">
              {summary.average_rating > 0 ? summary.average_rating : 'New'}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
              ({summary.total_reviews})
            </span>
          </div>
        )}
      </div>

      {/* Trust Badges */}
      {hasBadges && (
        <div className="flex flex-wrap items-center gap-2">
          {badges.is_new && (
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>New Member</span>
            </span>
          )}

          {badges.has_5plus_works && (
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>5+ Completed Works</span>
            </span>
          )}

          {badges.is_highly_rated && (
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Award className="w-3.5 h-3.5 text-amber-500" />
              <span>Highly Rated ⭐</span>
            </span>
          )}

          {badges.is_top_recommended && (
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <ThumbsUp className="w-3.5 h-3.5" />
              <span>90%+ Recommended</span>
            </span>
          )}

          {badges.top_communication && (
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Top Communication</span>
            </span>
          )}
        </div>
      )}

      {/* Summary Card */}
      {summary && summary.total_reviews > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-4 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 pb-4 md:pb-0 md:pr-4">
            <div className="text-center shrink-0">
              <div className="text-3xl font-black text-slate-900 dark:text-white">
                {summary.average_rating}
              </div>
              <div className="flex justify-center items-center space-x-0.5 mt-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-3.5 h-3.5 ${
                      star <= Math.round(summary.average_rating)
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-slate-300 dark:text-slate-700'
                    }`}
                  />
                ))}
              </div>
              <span className="text-[10px] text-slate-400 block mt-1 font-mono">
                {summary.total_reviews} {summary.total_reviews === 1 ? 'review' : 'reviews'}
              </span>
            </div>

            <div className="flex-1 space-y-1 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex justify-between font-bold">
                <span>Completed Works:</span>
                <span className="text-slate-900 dark:text-white font-extrabold">{summary.completed_works}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Would Recommend:</span>
                <span className="text-purple-600 dark:text-purple-400 font-extrabold">{summary.recommendation_percentage}%</span>
              </div>
            </div>
          </div>

          {/* Sub-Ratings Breakdown */}
          <div className="space-y-2 text-xs">
            <div>
              <div className="flex justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400">
                <span>Communication</span>
                <span>{summary.communication_average} / 5</span>
              </div>
              <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mt-0.5">
                <div
                  className="h-full bg-purple-600 rounded-full"
                  style={{ width: `${(summary.communication_average / 5) * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400">
                <span>Work Quality</span>
                <span>{summary.work_quality_average} / 5</span>
              </div>
              <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mt-0.5">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${(summary.work_quality_average / 5) * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400">
                <span>Professionalism</span>
                <span>{summary.professionalism_average} / 5</span>
              </div>
              <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mt-0.5">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${(summary.professionalism_average / 5) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs space-y-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
          <Star className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
          <p className="font-bold text-slate-700 dark:text-slate-300">No reviews yet</p>
          <p className="text-[11px]">Reviews appear here automatically after completed work contracts.</p>
        </div>
      ) : (
        <div className="space-y-4 divide-y divide-slate-100 dark:divide-slate-800/60">
          {reviews.map((rev) => (
            <div key={rev.id} className="pt-4 first:pt-0 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <UserAvatar avatarUrl={rev.reviewer_avatar_url} fullName={rev.reviewer_name} size="md" />
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                      {rev.reviewer_name}
                    </h4>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {rev.reviewer_role === 'client' ? 'Client' : 'Worker'} • {new Date(rev.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-1 shrink-0">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-3.5 h-3.5 ${
                        s <= rev.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200 dark:text-slate-800'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {rev.work_title && (
                <div className="text-[10px] font-bold text-purple-600 dark:text-purple-400 font-mono">
                  Work: {rev.work_title}
                </div>
              )}

              {rev.title && (
                <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                  "{rev.title}"
                </h5>
              )}

              {rev.comment && (
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                  {rev.comment}
                </p>
              )}

              <div className="flex items-center justify-between text-[10px] pt-1">
                {rev.would_recommend && (
                  <span className="text-purple-600 dark:text-purple-400 font-bold flex items-center space-x-1">
                    <ThumbsUp className="w-3 h-3" />
                    <span>Recommends this user</span>
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => setReportingReviewId(rev.id)}
                  className="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer flex items-center space-x-1 ml-auto"
                >
                  <Flag className="w-3 h-3" />
                  <span>Report</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Report Modal */}
      {reportingReviewId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs text-left">
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Report Review
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Reports are confidentially sent for moderation review.
            </p>

            <form onSubmit={handleReportSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Reason</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs"
                >
                  <option value="Inappropriate Content">Inappropriate Content</option>
                  <option value="Spam / Harassment">Spam / Harassment</option>
                  <option value="False Information">False Information</option>
                  <option value="Off-topic">Off-topic</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Details (Optional)</label>
                <textarea
                  rows={3}
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Provide additional details..."
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs resize-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReportingReviewId(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReport}
                  className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-extrabold"
                >
                  {submittingReport ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
