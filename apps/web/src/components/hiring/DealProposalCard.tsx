import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, CheckCircle2, XCircle, AlertTriangle, Clock, 
  Calendar, MapPin, DollarSign, Check, Loader2, Sparkles
} from 'lucide-react';
import { DealProposal } from '../../types';
import { formatINR } from '../../lib/currency';

interface DealProposalCardProps {
  proposal: DealProposal;
  currentUserId: string;
  clientId: string;
  workerId: string;
  onRespond: (proposalId: string, response: 'accept' | 'reject' | 'request_changes', reason?: string) => Promise<void>;
  isSubmitting: boolean;
}

export default function DealProposalCard({
  proposal,
  currentUserId,
  clientId,
  workerId,
  onRespond,
  isSubmitting
}: DealProposalCardProps) {
  const isClient = currentUserId === clientId;
  const isWorker = currentUserId === workerId;

  const myResponse = isClient ? proposal.client_response : proposal.worker_response;
  const otherResponse = isClient ? proposal.worker_response : proposal.client_response;

  const [modalType, setModalType] = useState<'request_changes' | 'reject' | null>(null);
  const [reason, setReason] = useState('');

  const handleResponseClick = async (resp: 'accept' | 'reject' | 'request_changes') => {
    if (resp === 'request_changes' || resp === 'reject') {
      setModalType(resp);
      return;
    }
    await onRespond(proposal.id, 'accept');
  };

  const handleModalSubmit = async () => {
    if (!modalType) return;
    await onRespond(proposal.id, modalType, reason);
    setModalType(null);
    setReason('');
  };

  return (
    <div className="bg-gradient-to-b from-purple-500/10 to-indigo-500/5 dark:from-purple-950/20 dark:to-slate-900/40 rounded-3xl border-2 border-purple-500/30 p-5 space-y-4 shadow-md text-left relative overflow-hidden">
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-500/20 pb-3">
        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-1 bg-purple-600 text-white font-extrabold text-[10px] rounded-lg uppercase tracking-wider font-mono">
            Final Deal Proposal v{proposal.version_number}
          </span>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Price: <strong className="text-purple-600 dark:text-purple-400 font-extrabold text-sm">{formatINR(proposal.final_price)}</strong> ({proposal.payment_type})
          </span>
        </div>

        <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${
          proposal.proposal_status === 'accepted' 
            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
            : proposal.proposal_status === 'changes_requested'
            ? 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30'
            : proposal.proposal_status === 'rejected'
            ? 'bg-rose-500/10 text-rose-600 border-rose-500/30'
            : proposal.proposal_status === 'superseded'
            ? 'bg-slate-500/10 text-slate-500 border-slate-500/30'
            : 'bg-amber-500/10 text-amber-600 border-amber-500/30'
        }`}>
          ● {proposal.proposal_status.replace('_', ' ')}
        </span>
      </div>

      {/* Scope Info */}
      <div className="space-y-1.5">
        <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
          {proposal.work_title}
        </h4>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
          {proposal.work_description}
        </p>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs bg-white/70 dark:bg-slate-900/70 p-3 rounded-2xl border border-purple-500/15">
        {proposal.work_date && (
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase font-mono block">Work Date</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{proposal.work_date}</span>
          </div>
        )}

        {proposal.start_time && (
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase font-mono block">Start Time</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{proposal.start_time}</span>
          </div>
        )}

        {proposal.duration && (
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase font-mono block">Duration</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{proposal.duration}</span>
          </div>
        )}

        {proposal.location && (
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase font-mono block">Location</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">{proposal.location}</span>
          </div>
        )}
      </div>

      {proposal.additional_terms && (
        <div className="text-xs text-slate-600 dark:text-slate-400 p-2.5 bg-purple-500/5 rounded-xl border border-purple-500/10">
          <strong>Additional Terms:</strong> {proposal.additional_terms}
        </div>
      )}

      {/* Responses Matrix */}
      <div className="pt-2 border-t border-purple-500/15 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500 font-medium">Employer:</span>
            <span className={`font-bold ${proposal.client_response === 'accepted' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}`}>
              {proposal.client_response === 'accepted' ? '✓ Accepted' : proposal.client_response}
            </span>
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500 font-medium">Worker:</span>
            <span className={`font-bold ${proposal.worker_response === 'accepted' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}`}>
              {proposal.worker_response === 'accepted' ? '✓ Accepted' : proposal.worker_response}
            </span>
          </div>
        </div>

        {/* Response Action Buttons for non-superseded/non-accepted */}
        {['pending', 'changes_requested'].includes(proposal.proposal_status) && myResponse !== 'accepted' && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleResponseClick('request_changes')}
              disabled={isSubmitting}
              className="px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 font-bold text-xs hover:bg-indigo-50 dark:hover:bg-indigo-950/30 cursor-pointer disabled:opacity-50"
            >
              Request Changes
            </button>
            <button
              onClick={() => handleResponseClick('reject')}
              disabled={isSubmitting}
              className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 font-bold text-xs hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer disabled:opacity-50"
            >
              Reject
            </button>
            <button
              onClick={() => handleResponseClick('accept')}
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs cursor-pointer disabled:opacity-50 flex items-center space-x-1"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
              <Check className="w-3.5 h-3.5" />
              <span>Accept Deal</span>
            </button>
          </div>
        )}

        {myResponse === 'accepted' && proposal.proposal_status !== 'accepted' && (
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            ✓ You Accepted — Waiting for other party
          </span>
        )}
      </div>

      {/* Response Reason Modal */}
      <AnimatePresence>
        {modalType && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 w-full max-w-md space-y-4 text-left shadow-2xl"
            >
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                {modalType === 'request_changes' ? 'Request Changes on Deal Proposal' : 'Reject Deal Proposal'}
              </h3>
              
              <div className="space-y-1">
                <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">
                  Reason / Feedback *
                </label>
                <textarea 
                  rows={3}
                  placeholder="Specify what needs to be changed (price, schedule, terms)..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button 
                  onClick={() => setModalType(null)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleModalSubmit}
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
                >
                  Submit Feedback
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
