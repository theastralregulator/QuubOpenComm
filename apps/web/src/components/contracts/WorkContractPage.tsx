import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  ShieldCheck, FileText, ArrowLeft, Calendar, Clock, MapPin, 
  CheckCircle2, MessageSquare, AlertCircle, Loader2, UserCheck, DollarSign
} from 'lucide-react';
import { supabase, dbService } from '../../lib/supabase';
import { formatINR } from '../../lib/currency';
import UserAvatar from '../common/UserAvatar';

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

  useEffect(() => {
    async function fetchContract() {
      if (!contractId) return;
      setLoading(true);
      setError(null);
      try {
        const data = await dbService.getWorkContractById(contractId);
        if (!data) {
          throw new Error('Work contract not found.');
        }

        setContract(data);

        // Fetch client and worker names/avatars
        const { data: cp } = await supabase.from('profiles').select('id, full_name, avatar_url').eq('id', data.client_id).single();
        const { data: wp } = await supabase.from('profiles').select('id, full_name, avatar_url').eq('id', data.worker_id).single();
        
        setClientProfile(cp);
        setWorkerProfile(wp);
      } catch (err: any) {
        console.error('Failed to load work contract:', err);
        setError(err.message || 'Failed to load contract details.');
      } finally {
        setLoading(false);
      }
    }
    fetchContract();
  }, [contractId]);

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
        <button onClick={() => navigate('/profile/hire-requests')} className="px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold">
          Back to Hire Requests
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto py-6 sm:py-8 px-3 sm:px-6 space-y-6 text-left">
      
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => navigate('/profile/hire-requests')}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              Work Contract
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              Contract ID: {contract.id.slice(0, 13)}...
            </p>
          </div>
        </div>

        <span className="inline-flex items-center text-xs font-extrabold px-3.5 py-1 rounded-full border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
          ● Contract Active
        </span>
      </div>

      {/* Parties Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div 
          onClick={() => navigate(`/profile/${contract.client_id}`)}
          className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 p-5 flex items-center space-x-3 shadow-xs cursor-pointer hover:border-purple-500/30 transition-all"
        >
          <UserAvatar avatarUrl={clientProfile?.avatar_url} fullName={clientProfile?.full_name || 'Client'} size="lg" />
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Client (Employer)</span>
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
              {clientProfile?.full_name || 'Client'}
            </h4>
            <p className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold">View Profile →</p>
          </div>
        </div>

        <div 
          onClick={() => navigate(`/profile/${contract.worker_id}`)}
          className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 p-5 flex items-center space-x-3 shadow-xs cursor-pointer hover:border-purple-500/30 transition-all"
        >
          <UserAvatar avatarUrl={workerProfile?.avatar_url} fullName={workerProfile?.full_name || 'Worker'} size="lg" />
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Worker (Contractor)</span>
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
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

      {/* Footer Action */}
      <div className="flex justify-end pt-2">
        {contract.permanent_conversation_id && (
          <button
            onClick={() => navigate(`/messages/${contract.permanent_conversation_id}`)}
            className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer hover:scale-[1.01] transition-transform flex items-center space-x-2"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Open Permanent Main Chat Thread</span>
          </button>
        )}
      </div>

    </div>
  );
}
