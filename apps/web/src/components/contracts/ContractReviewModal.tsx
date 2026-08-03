import React, { useState } from 'react';
import { Star, X, Check, Loader2, ThumbsUp, AlertCircle } from 'lucide-react';
import { dbService } from '../../lib/supabase';

interface ContractReviewModalProps {
  contractId: string;
  myRole: 'client' | 'worker';
  otherPartyName: string;
  workTitle: string;
  existingReview?: any | null;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function ContractReviewModal({
  contractId,
  myRole,
  otherPartyName,
  workTitle,
  existingReview,
  onClose,
  onSuccess
}: ContractReviewModalProps) {
  const isEditing = !!existingReview;

  const [rating, setRating] = useState<number>(existingReview?.rating || 5);
  const [title, setTitle] = useState<string>(existingReview?.title || '');
  const [comment, setComment] = useState<string>(existingReview?.comment || '');
  const [communicationRating, setCommunicationRating] = useState<number>(existingReview?.communication_rating || 5);
  const [workQualityRating, setWorkQualityRating] = useState<number>(existingReview?.work_quality_rating || 5);
  const [professionalismRating, setProfessionalismRating] = useState<number>(existingReview?.professionalism_rating || 5);
  const [punctualityRating, setPunctualityRating] = useState<number>(existingReview?.punctuality_rating || 5);
  const [wouldRecommend, setWouldRecommend] = useState<boolean>(
    existingReview?.would_recommend !== undefined ? existingReview.would_recommend : true
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1 || rating > 5) {
      setError('Please select an overall star rating (1-5).');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (isEditing) {
        await dbService.updateMyContractReview(existingReview.id, {
          rating,
          title: title.trim() || undefined,
          comment: comment.trim() || undefined,
          communication_rating: communicationRating,
          work_quality_rating: workQualityRating,
          professionalism_rating: professionalismRating,
          punctuality_rating: punctualityRating,
          would_recommend: wouldRecommend
        });
        onSuccess('Review updated successfully!');
      } else {
        await dbService.submitContractReview({
          contract_id: contractId,
          rating,
          title: title.trim() || undefined,
          comment: comment.trim() || undefined,
          communication_rating: communicationRating,
          work_quality_rating: workQualityRating,
          professionalism_rating: professionalismRating,
          punctuality_rating: punctualityRating,
          would_recommend: wouldRecommend
        });
        onSuccess('Thank you! Your review has been submitted.');
      }
      onClose();
    } catch (err: any) {
      console.error('Submit review error:', err);
      setError(err.message || 'Failed to submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStarSelector = (value: number, onChange: (v: number) => void, label: string, size = 'md') => (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{label}</span>
        <span className="text-xs font-extrabold text-amber-500">{value} / 5</span>
      </div>
      <div className="flex items-center space-x-1.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="p-1 hover:scale-110 transition-transform cursor-pointer"
          >
            <Star
              className={`${size === 'lg' ? 'w-7 h-7' : 'w-5 h-5'} ${
                star <= value ? 'text-amber-400 fill-amber-400' : 'text-slate-200 dark:text-slate-800'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs text-left overflow-y-auto">
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden my-8">

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              {isEditing ? 'Edit Your Review' : 'Rate Your Experience'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              For <span className="font-semibold text-slate-800 dark:text-slate-200">{workTitle}</span> with <span className="font-semibold text-purple-600 dark:text-purple-400">{otherPartyName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Main Star Rating */}
          <div className="p-4 bg-amber-500/5 dark:bg-amber-950/10 border border-amber-500/20 rounded-2xl text-center space-y-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Overall Work Rating
            </span>
            <div className="flex justify-center items-center space-x-2 pt-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-1 hover:scale-125 transition-transform cursor-pointer"
                >
                  <Star
                    className={`w-8 h-8 ${
                      star <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300 dark:text-slate-700'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Sub-Ratings Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {renderStarSelector(
              communicationRating,
              setCommunicationRating,
              myRole === 'client' ? 'Communication & Responsiveness' : 'Communication & Scope Clarity'
            )}

            {renderStarSelector(
              workQualityRating,
              setWorkQualityRating,
              myRole === 'client' ? 'Work Quality & Output' : 'Payment & Transaction Experience'
            )}

            {renderStarSelector(
              professionalismRating,
              setProfessionalismRating,
              'Professional Conduct'
            )}

            {renderStarSelector(
              punctualityRating,
              setPunctualityRating,
              myRole === 'client' ? 'Punctuality & Schedule' : 'Response & Feedback Time'
            )}
          </div>

          {/* Recommendation Checkbox */}
          <div className="pt-2">
            <label className="flex items-center space-x-3 p-3 border border-slate-200 dark:border-slate-800 rounded-2xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
              <input
                type="checkbox"
                checked={wouldRecommend}
                onChange={(e) => setWouldRecommend(e.target.checked)}
                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
              />
              <div className="flex items-center space-x-2">
                <ThumbsUp className={`w-4 h-4 ${wouldRecommend ? 'text-purple-600' : 'text-slate-400'}`} />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  I would recommend working with {otherPartyName}
                </span>
              </div>
            </label>
          </div>

          {/* Short Title */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Headline / Summary Title (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Excellent communication and high quality work!"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Detailed Feedback */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Detailed Written Feedback (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="Describe your overall experience working together..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={2000}
              className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 resize-none"
            />
            <span className="text-[10px] text-slate-400 block text-right">{comment.length} / 2000</span>
          </div>

          {/* Submit Action */}
          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-purple-600 text-white text-xs font-extrabold shadow-md cursor-pointer hover:opacity-95 disabled:opacity-50 flex items-center space-x-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>{isEditing ? 'Update Review' : 'Submit Review'}</span>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
