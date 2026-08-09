import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck, FileText, ArrowLeft, Calendar, Clock, MapPin,
  CheckCircle2, MessageSquare, AlertCircle, Loader2, UserCheck, DollarSign,
  XCircle, AlertTriangle, Check, RefreshCw, Star
} from 'lucide-react';
import { supabase, dbService } from '../../lib/supabase';
import { formatINR } from '../../lib/currency';
import UserAvatar from '../common/UserAvatar';
import WorkflowTimeline, { getWorkflowTimelineSteps } from '../common/WorkflowTimeline';
import ContractReviewModal from './ContractReviewModal';

interface WorkContractPageProps {
  triggerToast: (msg: string) => void;
}

export default function WorkContractPage({ triggerToast }: WorkContractPageProps) {
  const { contractId } = useParams<{ contractId: string }>();
  const navigate = useNavigate();

  const [contract, setContract] = useState<any | null>(null);
  const [clientProfile, setClientProfile] = useState<any | null>(null);
  const [workerProfile, setWorkerProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Modal State
  const [activeModal, setActiveModal] = useState<
    'cancel_request' | 'cancel_respond_accept' | 'cancel_respond_reject' |
    'complete_request' | 'complete_respond_accept' | 'complete_respond_reject' | null
  >(null);
  const [modalReasonInput, setModalReasonInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Review State
  const [reviewEligibility, setReviewEligibility] = useState<any | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);

  useEffect(() => {
    async function fetchContract() {
      if (!contractId) return;
      setLoading(true);
      setError(null);
      try {
        if (supabase) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) setCurrentUserId(user.id);
        }

        const data = await dbService.getWorkContractById(contractId);
        if (!data) {
          throw new Error('Work contract not found.');
        }

        setContract(data);

        // Fetch client and worker profiles for avatars and full names
        if (supabase) {
          const { data: cp } = await supabase.from('profile_directory').select('id, full_name, avatar_url').eq('id', data.client_id).maybeSingle();
          const { data: wp } = await supabase.from('profile_directory').select('id, full_name, avatar_url').eq('id', data.worker_id).maybeSingle();
          setClientProfile(cp);
          setWorkerProfile(wp);
        }

        // Fetch review eligibility if completed
        if (data.status === 'completed') {
          try {
            const elig = await dbService.getContractReviewEligibility(data.id);
            setReviewEligibility(elig);
          } catch (e) {
            console.warn('Could not load review eligibility:', e);
          }
        }
      } catch (err: any) {
        console.error('Failed to load work contract:', err);
        setError(err.message || 'Failed to load contract details.');
      } finally {
        setLoading(false);
      }
    }
    fetchContract();
  }, [contractId]);

  const refreshContract = async () => {
    if (!contractId) return;
    try {
      const data = await dbService.getWorkContractById(contractId);
      if (data) setContract(data);
    } catch (err) {
      console.error('Error refreshing contract:', err);
    }
  };

  // Action Handlers
  const handleRequestCancellation = async () => {
    if (!modalReasonInput.trim()) {
      triggerToast('Please provide a reason for cancellation.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await dbService.requestContractCancellation(contract.id, modalReasonInput.trim());
      triggerToast(res.message || 'Cancellation requested.');
      setActiveModal(null);
      setModalReasonInput('');
      await refreshContract();
    } catch (err: any) {
      triggerToast(err.message || 'Failed to request cancellation.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRespondCancellation = async (response: 'accept' | 'reject') => {
    if (response === 'reject' && !modalReasonInput.trim()) {
      triggerToast('Please provide a reason for rejecting cancellation.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await dbService.respondToContractCancellation(
        contract.id,
        response,
        response === 'reject' ? modalReasonInput.trim() : undefined
      );
      triggerToast(res.message || `Cancellation ${response}ed.`);
      setActiveModal(null);
      setModalReasonInput('');
      await refreshContract();
    } catch (err: any) {
      triggerToast(err.message || 'Failed to respond to cancellation.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestCompletion = async () => {
    setActionLoading(true);
    try {
      const res = await dbService.requestContractCompletion(contract.id, modalReasonInput.trim());
      triggerToast(res.message || 'Completion requested.');
      setActiveModal(null);
      setModalReasonInput('');
      await refreshContract();
    } catch (err: any) {
      triggerToast(err.message || 'Failed to request completion.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRespondCompletion = async (response: 'accept' | 'reject') => {
    if (response === 'reject' && !modalReasonInput.trim()) {
      triggerToast('Please provide a reason or issue description.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await dbService.respondToContractCompletion(
        contract.id,
        response,
        response === 'reject' ? modalReasonInput.trim() : undefined
      );
      triggerToast(res.message || `Completion ${response}ed.`);
      setActiveModal(null);
      setModalReasonInput('');
      await refreshContract();
    } catch (err: any) {
      triggerToast(err.message || 'Failed to respond to completion.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto py-8 px-4 space-y-6 animate-pulse text-left">
        <div className="h-8 w-36 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="w-full max-w-md mx-auto py-12 px-4 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Contract Not Found</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">{error || 'Unable to load contract.'}</p>
        <button onClick={() => navigate('/profile/hire-requests')} className="px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold cursor-pointer">
          Back to Hire Requests
        </button>
      </div>
    );
  }

  const isClient = currentUserId === contract.client_id;
  const isWorker = currentUserId === contract.worker_id;

  const getContractBadge = (status: string) => {
    switch (status) {
      case 'active':
        return { label: 'Work Active', class: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
      case 'cancellation_requested':
        return { label: 'Cancellation Requested', class: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' };
      case 'cancelled':
        return { label: 'Work Cancelled', class: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' };
      case 'completion_requested':
        return { label: 'Completion Awaiting Confirmation', class: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' };
      case 'completed':
        return { label: 'Work Completed', class: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' };
      case 'disputed':
        return { label: 'Under Review', class: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' };
      default:
        return { label: status, class: 'bg-slate-500/10 text-slate-600 border-slate-500/20' };
    }
  };

  const badge = getContractBadge(contract.status);

  return (
    <div className="w-full max-w-4xl mx-auto py-6 sm:py-8 px-3 sm:px-6 space-y-6 text-left">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer shadow-xs transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Confirmed Work
              </h1>
              <span className={`inline-flex items-center text-[11px] font-extrabold px-3 py-1 rounded-full border ${badge.class}`}>
                ● {badge.label}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Contract ID: <span className="font-mono text-slate-400">{contract.id.slice(0, 8)}...</span>
            </p>
          </div>
        </div>

        {contract.permanent_conversation_id && (
          <button
            onClick={() => navigate(`/messages/${contract.permanent_conversation_id}`)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-extrabold shadow-xs cursor-pointer flex items-center space-x-1.5 shrink-0"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Open Main Chat</span>
          </button>
        )}
      </div>

      {/* Workflow Timeline */}
      <WorkflowTimeline steps={getWorkflowTimelineSteps(contract.job_application_id ? 'job_application' : 'hire_request', contract.status === 'completed' ? 'completed' : 'confirmed')} />

      {/* Dynamic Lifecycle Banners */}
      {contract.status === 'cancellation_requested' && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-5 space-y-2">
          <div className="flex items-center space-x-2 text-amber-700 dark:text-amber-300 font-extrabold text-xs uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Mutual Cancellation Requested</span>
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-300">
            {contract.cancellation_requested_by === currentUserId
              ? `You requested contract cancellation on ${new Date(contract.cancellation_requested_at).toLocaleString()}. Reason: "${contract.cancellation_reason}". Awaiting response from the other party.`
              : `The other party requested contract cancellation. Reason: "${contract.cancellation_reason}". Please accept or reject below.`
            }
          </p>
        </div>
      )}

      {contract.status === 'completion_requested' && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-3xl p-5 space-y-2">
          <div className="flex items-center space-x-2 text-blue-700 dark:text-blue-300 font-extrabold text-xs uppercase tracking-wider">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Work Completion Marked</span>
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-300">
            {contract.completion_requested_by === currentUserId
              ? `You marked the work as completed on ${new Date(contract.completion_requested_at).toLocaleString()}.${contract.completion_note ? ' Note: "' + contract.completion_note + '".' : ''} Awaiting confirmation from the other party.`
              : `The other party marked the work as completed.${contract.completion_note ? ' Note: "' + contract.completion_note + '".' : ''} Please confirm completion or report an issue below.`
            }
          </p>
        </div>
      )}

      {contract.status === 'active' && contract.cancellation_rejection_reason && (
        <div className="bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-3xl p-4 text-xs text-slate-600 dark:text-slate-400">
          <span className="font-bold text-slate-800 dark:text-slate-200">Previous cancellation request was rejected:</span> "{contract.cancellation_rejection_reason}"
        </div>
      )}

      {contract.status === 'active' && contract.completion_rejection_reason && (
        <div className="bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-3xl p-4 text-xs text-slate-600 dark:text-slate-400">
          <span className="font-bold text-slate-800 dark:text-slate-200">Previous completion request was rejected / issue reported:</span> "{contract.completion_rejection_reason}"
        </div>
      )}

      {contract.status === 'cancelled' && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-3xl p-5 space-y-1">
          <div className="flex items-center space-x-2 text-rose-700 dark:text-rose-400 font-extrabold text-xs uppercase tracking-wider">
            <XCircle className="w-4 h-4 shrink-0" />
            <span>Contract Mutually Cancelled</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            This work contract was mutually cancelled on {new Date(contract.cancelled_at || contract.updated_at).toLocaleString()}. Contract records and chat history remain preserved.
          </p>
        </div>
      )}

      {contract.status === 'completed' && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-5 space-y-1">
          <div className="flex items-center space-x-2 text-emerald-700 dark:text-emerald-400 font-extrabold text-xs uppercase tracking-wider">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Contract Mutually Completed</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            This work contract was mutually confirmed as completed on {new Date(contract.completed_at || contract.updated_at).toLocaleString()}. Contract records and chat history remain preserved.
          </p>
        </div>
      )}

      {/* Parties Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div
          onClick={() => navigate(`/profile/${contract.client_id}`)}
          className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 p-5 flex items-center space-x-3 shadow-xs cursor-pointer hover:border-purple-500/30 transition-all group"
        >
          <UserAvatar avatarUrl={clientProfile?.avatar_url} fullName={clientProfile?.full_name || 'Client'} size="lg" />
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Client (Employer)</span>
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
              {clientProfile?.full_name || 'Client'}
            </h4>
            <p className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold">View Profile →</p>
          </div>
        </div>

        <div
          onClick={() => navigate(`/profile/${contract.worker_id}`)}
          className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 p-5 flex items-center space-x-3 shadow-xs cursor-pointer hover:border-purple-500/30 transition-all group"
        >
          <UserAvatar avatarUrl={workerProfile?.avatar_url} fullName={workerProfile?.full_name || 'Worker'} size="lg" />
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Worker (Contractor)</span>
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
              {workerProfile?.full_name || 'Worker'}
            </h4>
            <p className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold">View Profile →</p>
          </div>
        </div>
      </div>

      {/* Contract Terms Container */}
      <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-5">

        <div className="border-b border-slate-100 dark:border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Agreed Project Title</span>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
              {contract.work_title}
            </h2>
          </div>

          <div className="bg-purple-500/10 border border-purple-500/20 px-4 py-2 rounded-2xl text-right">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono block">Final Price</span>
            <strong className="text-base font-extrabold text-purple-600 dark:text-purple-400">
              {formatINR(contract.final_price)} ({contract.payment_type})
            </strong>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Work Scope & Deliverables</h4>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            {contract.work_description}
          </p>
        </div>

        {/* Schedule & Location Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
            <span className="text-[9px] font-bold text-slate-400 uppercase font-mono block">Work Date</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{contract.work_date || 'Flexible'}</span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
            <span className="text-[9px] font-bold text-slate-400 uppercase font-mono block">Start Time</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{contract.start_time || 'N/A'}</span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
            <span className="text-[9px] font-bold text-slate-400 uppercase font-mono block">Duration</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{contract.duration || 'N/A'}</span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
            <span className="text-[9px] font-bold text-slate-400 uppercase font-mono block">Location</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">{contract.location || 'Remote / N/A'}</span>
          </div>
        </div>

        {contract.additional_terms && (
          <div className="space-y-1 pt-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Additional Terms & Clauses</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 italic bg-purple-500/5 p-3 rounded-2xl border border-purple-500/10">
              {contract.additional_terms}
            </p>
          </div>
        )}

        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[11px] text-slate-500 dark:text-slate-400">
          <span>Confirmed: {new Date(contract.confirmed_at).toLocaleString()}</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Mutually Signed & Locked
          </span>
        </div>
      </div>

      {/* Action Buttons Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        {/* Main Chat Button Always Available */}
        {contract.permanent_conversation_id ? (
          <button
            onClick={() => navigate(`/messages/${contract.permanent_conversation_id}`)}
            className="px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-extrabold text-xs rounded-xl shadow-xs cursor-pointer hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors flex items-center space-x-2"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Open Main Chat</span>
          </button>
        ) : <div />}

        {/* Dynamic Lifecycle Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Active Actions */}
          {contract.status === 'active' && (isClient || isWorker) && (
            <>
              <button
                onClick={() => {
                  setModalReasonInput('');
                  setActiveModal('cancel_request');
                }}
                className="px-4 py-2.5 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold text-xs rounded-xl cursor-pointer hover:bg-rose-100 transition-colors flex items-center space-x-1.5"
              >
                <XCircle className="w-4 h-4" />
                <span>Request Cancellation</span>
              </button>

              <button
                onClick={() => {
                  setModalReasonInput('');
                  setActiveModal('complete_request');
                }}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer transition-colors flex items-center space-x-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Mark Work as Completed</span>
              </button>
            </>
          )}

          {/* Cancellation Response Actions */}
          {contract.status === 'cancellation_requested' && contract.cancellation_requested_by !== currentUserId && (
            <>
              <button
                onClick={() => {
                  setModalReasonInput('');
                  setActiveModal('cancel_respond_reject');
                }}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Reject Cancellation
              </button>
              <button
                onClick={() => setActiveModal('cancel_respond_accept')}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer transition-colors flex items-center space-x-1.5"
              >
                <XCircle className="w-4 h-4" />
                <span>Accept Cancellation</span>
              </button>
            </>
          )}

          {/* Completion Response Actions */}
          {contract.status === 'completion_requested' && contract.completion_requested_by !== currentUserId && (
            <>
              <button
                onClick={() => {
                  setModalReasonInput('');
                  setActiveModal('complete_respond_reject');
                }}
                className="px-4 py-2.5 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold text-xs rounded-xl cursor-pointer hover:bg-rose-100 transition-colors"
              >
                Report Issue / Reject
              </button>
              <button
                onClick={() => setActiveModal('complete_respond_accept')}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer transition-colors flex items-center space-x-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm Completion</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Rate Your Experience / Review Summary Card */}
      {contract.status === 'completed' && reviewEligibility && (
        <div className="bg-amber-500/5 dark:bg-amber-950/10 border border-amber-500/20 rounded-3xl p-5 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-extrabold text-amber-700 dark:text-amber-300 uppercase tracking-wider flex items-center space-x-1.5">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span>{reviewEligibility.has_reviewed ? 'Your Submitted Review' : 'Rate Your Experience'}</span>
            </span>
            {reviewEligibility.has_reviewed && reviewEligibility.review && (
              <div className="flex items-center space-x-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-3.5 h-3.5 ${
                      s <= reviewEligibility.review.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300 dark:text-slate-700'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {reviewEligibility.has_reviewed && reviewEligibility.review ? (
            <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
              {reviewEligibility.review.title && (
                <h4 className="font-bold text-slate-900 dark:text-white">"{reviewEligibility.review.title}"</h4>
              )}
              {reviewEligibility.review.comment && (
                <p className="text-slate-600 dark:text-slate-400">{reviewEligibility.review.comment}</p>
              )}
              <div className="flex justify-end pt-1">
                {reviewEligibility.can_edit && (
                  <button
                    onClick={() => setShowReviewModal(true)}
                    className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-xs cursor-pointer shadow-xs"
                  >
                    Edit Review
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                Leave verified feedback for {reviewEligibility.other_party_name} on this completed contract.
              </p>
              <button
                onClick={() => setShowReviewModal(true)}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl font-extrabold text-xs shadow-md cursor-pointer shrink-0"
              >
                Rate Experience
              </button>
            </div>
          )}
        </div>
      )}

      {/* Contract Review Modal */}
      {showReviewModal && reviewEligibility && (
        <ContractReviewModal
          contractId={contract.id}
          myRole={reviewEligibility.my_role || (contract.client_id === currentUserId ? 'client' : 'worker')}
          otherPartyName={reviewEligibility.other_party_name || 'User'}
          workTitle={contract.work_title}
          existingReview={reviewEligibility.review}
          onClose={() => setShowReviewModal(false)}
          onSuccess={async (msg) => {
            triggerToast(msg);
            const elig = await dbService.getContractReviewEligibility(contract.id);
            setReviewEligibility(elig);
          }}
        />
      )}

      {/* Confirmation Modals */}
      <AnimatePresence>
        {activeModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full shadow-2xl space-y-4 text-left"
            >
              {/* Modal: Request Cancellation */}
              {activeModal === 'cancel_request' && (
                <>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-rose-500" />
                    <span>Request Contract Cancellation</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    This will send a mutual cancellation request to the other party. The contract will become cancelled only after both parties agree.
                  </p>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase font-mono block">Cancellation Reason (Required)</label>
                    <textarea
                      rows={3}
                      value={modalReasonInput}
                      onChange={(e) => setModalReasonInput(e.target.value)}
                      placeholder="Explain why you are requesting to cancel this contract..."
                      className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      onClick={() => setActiveModal(null)}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRequestCancellation}
                      disabled={actionLoading || !modalReasonInput.trim()}
                      className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                    >
                      {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Submit Request</span>
                    </button>
                  </div>
                </>
              )}

              {/* Modal: Accept Cancellation */}
              {activeModal === 'cancel_respond_accept' && (
                <>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-rose-500" />
                    <span>Accept Cancellation</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Are you sure you want to accept the cancellation request? The contract status will become <strong className="text-rose-600">Cancelled</strong>. Contract history will remain preserved.
                  </p>
                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      onClick={() => setActiveModal(null)}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Go Back
                    </button>
                    <button
                      onClick={() => handleRespondCancellation('accept')}
                      disabled={actionLoading}
                      className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center space-x-1.5"
                    >
                      {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Confirm Cancellation</span>
                    </button>
                  </div>
                </>
              )}

              {/* Modal: Reject Cancellation */}
              {activeModal === 'cancel_respond_reject' && (
                <>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    <span>Reject Cancellation</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    This will reject the cancellation request and keep the contract in <strong className="text-emerald-600">Active</strong> status.
                  </p>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase font-mono block">Rejection Reason (Required)</label>
                    <textarea
                      rows={3}
                      value={modalReasonInput}
                      onChange={(e) => setModalReasonInput(e.target.value)}
                      placeholder="Explain why you are rejecting the cancellation..."
                      className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      onClick={() => setActiveModal(null)}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleRespondCancellation('reject')}
                      disabled={actionLoading || !modalReasonInput.trim()}
                      className="px-5 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                    >
                      {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Reject Request</span>
                    </button>
                  </div>
                </>
              )}

              {/* Modal: Request Completion */}
              {activeModal === 'complete_request' && (
                <>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <span>Mark Work as Completed</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    This will send a completion confirmation request to the other party. The contract will become <strong className="text-emerald-600">Completed</strong> after both parties confirm.
                  </p>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase font-mono block">Completion Note / Remarks (Optional)</label>
                    <textarea
                      rows={3}
                      value={modalReasonInput}
                      onChange={(e) => setModalReasonInput(e.target.value)}
                      placeholder="Add any completion notes or instructions..."
                      className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      onClick={() => setActiveModal(null)}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRequestCompletion}
                      disabled={actionLoading}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center space-x-1.5"
                    >
                      {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Send Completion Request</span>
                    </button>
                  </div>
                </>
              )}

              {/* Modal: Confirm Completion */}
              {activeModal === 'complete_respond_accept' && (
                <>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <span>Confirm Work Completion</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Are you sure all work deliverables are satisfactory? Confirming will transition the contract status to <strong className="text-purple-600">Completed</strong>.
                  </p>
                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      onClick={() => setActiveModal(null)}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Go Back
                    </button>
                    <button
                      onClick={() => handleRespondCompletion('accept')}
                      disabled={actionLoading}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center space-x-1.5"
                    >
                      {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Confirm & Complete</span>
                    </button>
                  </div>
                </>
              )}

              {/* Modal: Reject Completion / Report Issue */}
              {activeModal === 'complete_respond_reject' && (
                <>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-rose-500" />
                    <span>Report Issue / Reject Completion</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Rejecting completion will keep the contract in <strong className="text-emerald-600">Active</strong> status so remaining issues can be resolved.
                  </p>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase font-mono block">Issue Description / Reason (Required)</label>
                    <textarea
                      rows={3}
                      value={modalReasonInput}
                      onChange={(e) => setModalReasonInput(e.target.value)}
                      placeholder="Explain what work remains incomplete or needs revision..."
                      className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      onClick={() => setActiveModal(null)}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleRespondCompletion('reject')}
                      disabled={actionLoading || !modalReasonInput.trim()}
                      className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                    >
                      {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Report Issue & Reject</span>
                    </button>
                  </div>
                </>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
