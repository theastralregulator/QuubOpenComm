import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Briefcase, ArrowLeft, ShieldCheck, Calendar, MapPin, Clock, 
  MessageSquare, FileText, CheckCircle2, AlertCircle, Loader2, Lock, Eye
} from 'lucide-react';
import { dbService, supabase } from '../../lib/supabase';
import { formatINR } from '../../lib/currency';
import UserAvatar from '../common/UserAvatar';
import { getStatusBadge } from './HireRequestsPage';

interface HireRequestDetailsPageProps {
  triggerToast: (msg: string) => void;
}

export default function HireRequestDetailsPage({ triggerToast }: HireRequestDetailsPageProps) {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();

  const [details, setDetails] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!requestId) return;
      setLoading(true);
      setError(null);
      try {
        if (supabase) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) setCurrentUserId(user.id);
        }
        const data = await dbService.getHireWorkflowDetails(requestId);
        setDetails(data);
      } catch (err: any) {
        console.error('Failed to load hire request details:', err);
        setError(err.message || 'Failed to load request details.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [requestId]);

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto py-8 px-4 space-y-6 animate-pulse text-left">
        <div className="h-8 w-32 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
      </div>
    );
  }

  if (error || !details || !details.hiring_request) {
    return (
      <div className="w-full max-w-xl mx-auto py-12 px-4 text-center space-y-4">
        <div className="w-12 h-12 bg-rose-500/10 rounded-2xl flex items-center justify-center mx-auto text-rose-500">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Access Denied or Not Found</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {error || 'You do not have authorization to view this hiring request.'}
        </p>
        <button 
          onClick={() => navigate('/profile/hire-requests')}
          className="px-5 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold cursor-pointer"
        >
          Back to Hire Requests
        </button>
      </div>
    );
  }

  const req = details.hiring_request;
  const activeProposal = details.active_proposal;
  const contract = details.work_contract;

  const isClient = currentUserId === req.client_id;
  const isWorker = currentUserId === req.worker_id;

  const badge = getStatusBadge(req.status);

  return (
    <div className="w-full max-w-4xl mx-auto py-6 sm:py-8 px-3 sm:px-6 space-y-6 text-left">
      
      {/* Header Navigation */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => navigate('/profile/hire-requests')}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer shadow-xs transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Request Details
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ID: <span className="font-mono">{req.id.slice(0, 8)}...</span>
            </p>
          </div>
        </div>

        <span className={`inline-flex items-center text-xs font-extrabold px-3 py-1 rounded-full border ${badge.class}`}>
          ● {badge.label}
        </span>
      </div>

      {/* Participants Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 p-5 flex items-center space-x-3 shadow-xs">
          <UserAvatar avatarUrl={null} fullName={req.client_name} size="lg" />
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Client (Employer)</span>
            <h4 
              onClick={() => navigate(`/profile/${req.client_id}`)}
              className="text-sm font-extrabold text-slate-900 dark:text-white hover:text-purple-600 dark:hover:text-purple-400 cursor-pointer"
            >
              {req.client_name}
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Initiator</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 p-5 flex items-center space-x-3 shadow-xs">
          <UserAvatar avatarUrl={null} fullName={req.worker_name} size="lg" />
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Worker (Contractor)</span>
            <h4 
              onClick={() => navigate(`/profile/${req.worker_id}`)}
              className="text-sm font-extrabold text-slate-900 dark:text-white hover:text-purple-600 dark:hover:text-purple-400 cursor-pointer"
            >
              {req.worker_name}
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Assigned Professional</p>
          </div>
        </div>
      </div>

      {/* Request Content */}
      <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex justify-between items-center">
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
            {req.work_title}
          </h2>
          <span className="text-base font-extrabold text-purple-600 dark:text-purple-400">
            {formatINR(req.budget)}
          </span>
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Work Scope & Description</h4>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
            {req.description}
          </p>
        </div>

        {req.message && (
          <div className="p-3.5 bg-slate-50 dark:bg-slate-900/70 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Note / Meta Info</span>
            <p className="text-xs text-slate-600 dark:text-slate-400">{req.message}</p>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
          <div>
            <span className="text-[10px] text-slate-400 font-mono block">PREFERRED DATE</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{req.preferred_date || 'Flexible'}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-mono block">REQUESTED AT</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{new Date(req.created_at).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-mono block">YOUR ROLE</span>
            <span className="font-bold text-purple-600 dark:text-purple-400">{isClient ? 'Client (Employer)' : 'Worker (Contractor)'}</span>
          </div>
        </div>
      </div>

      {/* Active Proposal Card Summary */}
      {activeProposal && (
        <div className="bg-purple-500/5 dark:bg-purple-950/10 border border-purple-500/20 rounded-3xl p-5 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-extrabold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
              Active Final Deal Proposal (v{activeProposal.version_number})
            </span>
            <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
              ₹{activeProposal.final_price} ({activeProposal.payment_type})
            </span>
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
            {activeProposal.work_title}
          </p>
          <div className="flex justify-end pt-1">
            <button
              onClick={() => navigate(`/hire-requests/${req.id}/negotiation`)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs cursor-pointer shadow-xs"
            >
              Open Proposal in Negotiation Room
            </button>
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
        {['negotiating', 'proposal_pending', 'changes_requested'].includes(req.status) && (
          <button
            onClick={() => navigate(`/hire-requests/${req.id}/negotiation`)}
            className="px-6 py-3 bg-gradient-to-r from-[#7C3AED] to-purple-600 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer hover:scale-[1.01] transition-transform flex items-center space-x-2"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Open Temporary Negotiation Room</span>
          </button>
        )}

        {req.status === 'confirmed' && req.work_contract_id && (
          <button
            onClick={() => navigate(`/work-contracts/${req.work_contract_id}`)}
            className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer hover:scale-[1.01] transition-transform flex items-center space-x-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>View Confirmed Work Contract</span>
          </button>
        )}
      </div>

    </div>
  );
}
