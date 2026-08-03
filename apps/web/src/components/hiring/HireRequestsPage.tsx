import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Briefcase, ArrowLeft, CheckCircle2, XCircle, Ban, MessageSquare, 
  Clock, Calendar, FileText, ChevronRight, AlertCircle, RefreshCw, 
  ShieldCheck, AlertTriangle, Eye, Loader2
} from 'lucide-react';
import { supabase, dbService } from '../../lib/supabase';
import { formatINR } from '../../lib/currency';
import UserAvatar from '../common/UserAvatar';

interface HireRequestsPageProps {
  triggerToast: (msg: string) => void;
}

export function getStatusBadge(status: string) {
  switch (status) {
    case 'pending':
      return { label: 'Waiting for Review', class: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' };
    case 'under_review':
      return { label: 'Under Review', class: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' };
    case 'shortlisted':
      return { label: 'Shortlisted', class: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' };
    case 'negotiating':
      return { label: 'Discussing Details', class: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' };
    case 'proposal_pending':
      return { label: 'Waiting for Confirmation', class: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' };
    case 'changes_requested':
      return { label: 'Revision Requested', class: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' };
    case 'confirmed':
      return { label: 'Work Confirmed', class: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
    case 'accepted':
      return { label: 'Work Accepted', class: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
    case 'rejected':
      return { label: 'Declined', class: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' };
    case 'withdrawn':
      return { label: 'Withdrawn', class: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' };
    case 'cancelled':
      return { label: 'Cancelled', class: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' };
    case 'completed':
      return { label: 'Work Completed', class: 'bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 border-emerald-600/20' };
    default:
      return { label: status, class: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' };
  }
}

export default function HireRequestsPage({ triggerToast }: HireRequestsPageProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTabParam = searchParams.get('tab') === 'sent' ? 'sent' : 'received';
  const [activeTab, setActiveTab] = useState<'received' | 'sent'>(activeTabParam);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hasWorkerProfile, setHasWorkerProfile] = useState<boolean | null>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal action states
  const [actionModal, setActionModal] = useState<{
    type: 'decline' | 'withdraw';
    requestId: string;
    workTitle: string;
  } | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUserId(user.id);
          const { data: wp } = await supabase
            .from('worker_profiles')
            .select('id')
            .eq('id', user.id)
            .maybeSingle();

          const isWorker = Boolean(wp);
          setHasWorkerProfile(isWorker);

          if (!isWorker) {
            setActiveTab('sent');
          }
        }
      }
      const data = await dbService.getCurrentUserHiringRequests();
      setRequests(data);
    } catch (err: any) {
      console.error('Failed to load hiring requests:', err);
      setError(err.message || 'Failed to load hiring requests.');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab: 'received' | 'sent') => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const handleAccept = async (requestId: string) => {
    try {
      const res = await dbService.acceptHiringRequest(requestId);
      triggerToast('Hiring request accepted! Entering negotiation room.');
      navigate(`/hire-requests/${requestId}/negotiation`);
    } catch (err: any) {
      triggerToast(err.message || 'Failed to accept request.');
    }
  };

  const handleDeclineSubmit = async () => {
    if (!actionModal) return;
    setActionSubmitting(true);
    try {
      await dbService.declineHiringRequest(actionModal.requestId, actionReason);
      triggerToast('Hiring request declined.');
      setActionModal(null);
      setActionReason('');
      fetchRequests();
    } catch (err: any) {
      triggerToast(err.message || 'Failed to decline request.');
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleWithdrawSubmit = async () => {
    if (!actionModal) return;
    setActionSubmitting(true);
    try {
      await dbService.withdrawHiringRequest(actionModal.requestId, actionReason);
      triggerToast('Hiring request withdrawn.');
      setActionModal(null);
      setActionReason('');
      fetchRequests();
    } catch (err: any) {
      triggerToast(err.message || 'Failed to withdraw request.');
    } finally {
      setActionSubmitting(false);
    }
  };

  const receivedRequests = requests.filter(r => r.worker_id === currentUserId);
  const sentRequests = requests.filter(r => r.client_id === currentUserId);
  const effectiveTab = hasWorkerProfile === false ? 'sent' : activeTab;
  const displayedRequests = effectiveTab === 'received' ? receivedRequests : sentRequests;

  return (
    <div className="w-full max-w-5xl mx-auto py-6 sm:py-8 px-3 sm:px-6 space-y-6 text-left">
      
      {/* Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => navigate('/profile')}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer shadow-xs transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Briefcase className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              Direct Hire Requests
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {hasWorkerProfile === false
                ? 'Track direct hire requests sent to contractors, negotiate terms, and confirm work contracts.'
                : 'Manage incoming proposals, negotiate terms, and confirm work contracts.'}
            </p>
          </div>
        </div>

        <button 
          onClick={fetchRequests}
          disabled={loading}
          className="self-start sm:self-auto px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5 cursor-pointer shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-2">
        {hasWorkerProfile !== false && (
          <button
            onClick={() => handleTabChange('received')}
            className={`pb-3 px-4 font-bold text-xs sm:text-sm flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
              effectiveTab === 'received'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Received Requests</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 font-extrabold">
              {receivedRequests.length}
            </span>
          </button>
        )}

        <button
          onClick={() => handleTabChange('sent')}
          className={`pb-3 px-4 font-bold text-xs sm:text-sm flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
            effectiveTab === 'sent'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>Sent Requests</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 font-extrabold">
            {sentRequests.length}
          </span>
        </button>
      </div>

      {/* Content Section */}
      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-36 bg-slate-100 dark:bg-slate-800/60 rounded-3xl" />
          ))}
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{error}</p>
          <button 
            onClick={fetchRequests}
            className="px-4 py-2 bg-purple-600 text-white rounded-xl font-bold text-xs cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : displayedRequests.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
          <Briefcase className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            No {effectiveTab === 'received' ? 'received' : 'sent'} hire requests found
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {effectiveTab === 'received'
              ? 'When clients discover your worker profile and send hire offers, they will appear here.'
              : 'Browse certified service providers in the Worker Directory to initiate direct hiring offers.'}
          </p>
          {effectiveTab === 'sent' && (
            <button
              onClick={() => navigate('/workers')}
              className="mt-2 px-5 py-2.5 bg-gradient-to-r from-[#7C3AED] to-purple-600 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer"
            >
              Browse Workers
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {displayedRequests.map((req) => {
            const isWorker = currentUserId === req.worker_id;
            const otherPartyName = isWorker ? req.client_name : req.worker_name;
            const otherPartyAvatar = isWorker ? req.client_avatar : req.worker_avatar;
            const otherPartyId = isWorker ? req.client_id : req.worker_id;
            const badge = getStatusBadge(req.status);

            return (
              <div 
                key={req.id}
                className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4 hover:border-purple-500/30 transition-all"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                  <div 
                    onClick={() => navigate(`/profile/${otherPartyId}`)}
                    className="flex items-center space-x-3 cursor-pointer group"
                  >
                    <UserAvatar avatarUrl={otherPartyAvatar} fullName={otherPartyName} size="md" />
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                          {otherPartyName}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">
                          ({isWorker ? 'Client' : 'Worker'})
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Requested {new Date(req.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <span className={`inline-flex items-center text-xs font-extrabold px-3 py-1 rounded-full border self-start sm:self-auto ${badge.class}`}>
                    ● {badge.label}
                  </span>
                </div>

                {/* Body Details */}
                <div className="space-y-1.5">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    {req.work_title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                    {req.description}
                  </p>
                </div>

                {/* Meta Cards */}
                <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/60">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-mono">Proposed Budget</span>
                    <strong className="text-purple-600 dark:text-purple-400 font-extrabold">{formatINR(req.budget)}</strong>
                  </div>

                  {req.preferred_date && (
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-mono">Preferred Date</span>
                      <span>{req.preferred_date}</span>
                    </div>
                  )}

                  {req.message && (
                    <div className="flex-1 min-w-[200px]">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-mono">Details / Note</span>
                      <span className="text-slate-500 dark:text-slate-400 text-[11px] truncate block">{req.message}</span>
                    </div>
                  )}
                </div>

                {/* Action Row */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                  <button
                    onClick={() => navigate(`/hire-requests/${req.id}`)}
                    className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center space-x-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Full Request Details</span>
                  </button>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Worker Pending Actions */}
                    {isWorker && req.status === 'pending' && (
                      <>
                        <button
                          onClick={() => setActionModal({ type: 'decline', requestId: req.id, workTitle: req.work_title })}
                          className="px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 font-bold text-xs cursor-pointer"
                        >
                          Decline Request
                        </button>
                        <button
                          onClick={() => handleAccept(req.id)}
                          className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-purple-600 text-white font-extrabold text-xs hover:opacity-95 shadow-xs cursor-pointer"
                        >
                          Accept Request
                        </button>
                      </>
                    )}

                    {/* Client Pending Actions */}
                    {!isWorker && req.status === 'pending' && (
                      <button
                        onClick={() => setActionModal({ type: 'withdraw', requestId: req.id, workTitle: req.work_title })}
                        className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-xs cursor-pointer"
                      >
                        Withdraw Request
                      </button>
                    )}

                    {/* Negotiation Room Actions */}
                    {['negotiating', 'proposal_pending', 'changes_requested'].includes(req.status) && (
                      <button
                        onClick={() => navigate(`/hire-requests/${req.id}/negotiation`)}
                        className="px-5 py-2 rounded-xl bg-purple-600 text-white font-extrabold text-xs hover:bg-purple-700 shadow-xs flex items-center space-x-1.5 cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>
                          {req.status === 'proposal_pending' ? 'Review Work Agreement' : 'Discuss Details'}
                        </span>
                      </button>
                    )}

                    {/* Confirmed Contract Actions */}
                    {req.status === 'confirmed' && (
                      <>
                        {req.work_contract_id && (
                          <button
                            onClick={() => navigate(`/work-contracts/${req.work_contract_id}`)}
                            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold text-xs cursor-pointer"
                          >
                            View Confirmed Work
                          </button>
                        )}
                        {req.permanent_conversation_id && (
                          <button
                            onClick={() => navigate(`/messages/${req.permanent_conversation_id}`)}
                            className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-extrabold text-xs shadow-xs flex items-center space-x-1.5 cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Open Main Chat</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modals */}
      <AnimatePresence>
        {actionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 w-full max-w-md space-y-4 text-left shadow-2xl"
            >
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                {actionModal.type === 'decline' ? 'Decline Hiring Request' : 'Withdraw Hiring Request'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Are you sure you want to {actionModal.type} the request for <strong>"{actionModal.workTitle}"</strong>?
              </p>

              <div className="space-y-1">
                <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">
                  Reason (Optional)
                </label>
                <textarea 
                  rows={2}
                  placeholder="Provide brief context..."
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button 
                  onClick={() => setActionModal(null)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={actionModal.type === 'decline' ? handleDeclineSubmit : handleWithdrawSubmit}
                  disabled={actionSubmitting}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer disabled:opacity-50 flex items-center space-x-1"
                >
                  {actionSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                  <span>Confirm {actionModal.type === 'decline' ? 'Decline' : 'Withdraw'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
