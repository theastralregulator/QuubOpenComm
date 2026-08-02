import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageSquare, Send, ArrowLeft, ShieldAlert, Lock, CheckCircle2,
  FileText, Info, Loader2, Sparkles, AlertCircle, RefreshCw, Eye
} from 'lucide-react';
import { supabase, dbService } from '../../lib/supabase';
import UserAvatar from '../common/UserAvatar';
import { getStatusBadge } from './HireRequestsPage';
import FinalDealForm from './FinalDealForm';
import DealProposalCard from './DealProposalCard';

interface NegotiationPageProps {
  triggerToast: (msg: string) => void;
}

export default function NegotiationPage({ triggerToast }: NegotiationPageProps) {
  const { requestId, applicationId } = useParams<{ requestId?: string; applicationId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const isJobApp = Boolean(applicationId || location.pathname.includes('/applications/'));
  const targetId = isJobApp ? applicationId : requestId;

  const [details, setDetails] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [respondingProposal, setRespondingProposal] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchWorkflowDetails();
  }, [requestId, applicationId]);

  const fetchWorkflowDetails = async () => {
    if (!targetId) return;
    setLoading(true);
    setError(null);
    try {
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setCurrentUserId(user.id);
      }
      if (isJobApp && applicationId) {
        const data = await dbService.getApplicationWorkflowDetails(applicationId);
        setDetails(data);
      } else if (requestId) {
        const data = await dbService.getHireWorkflowDetails(requestId);
        setDetails(data);
      }
    } catch (err: any) {
      console.error('Failed to fetch negotiation details:', err);
      setError(err.message || 'Failed to load negotiation room.');
    } finally {
      setLoading(false);
    }
  };

  // Realtime subscription for temporary negotiation messages
  useEffect(() => {
    if (!details?.negotiation_room?.id || !supabase) return;

    const roomId = details.negotiation_room.id;
    const channelName = `hire_negotiation_${roomId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'negotiation_messages',
          filter: `negotiation_room_id=eq.${roomId}`
        },
        (payload: any) => {
          const newMsg = payload.new;
          setDetails((prev: any) => {
            if (!prev) return prev;
            const existing = prev.negotiation_messages || [];
            if (existing.some((m: any) => m.id === newMsg.id)) return prev;
            return {
              ...prev,
              negotiation_messages: [...existing, newMsg]
            };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [details?.negotiation_room?.id]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [details?.negotiation_messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || sending || !details?.negotiation_room?.id) return;

    const textToSend = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      await dbService.sendNegotiationMessage(details.negotiation_room.id, textToSend);
    } catch (err: any) {
      triggerToast(err.message || 'Failed to send message.');
      setInputText(textToSend);
    } finally {
      setSending(false);
    }
  };

  const handleRespondToProposal = async (
    proposalId: string,
    response: 'accept' | 'reject' | 'request_changes',
    reason?: string
  ) => {
    setRespondingProposal(true);
    try {
      const res = await dbService.respondToDealProposal(proposalId, response, reason);
      if (res?.both_accepted || res?.confirmed) {
        triggerToast('🎉 Deal confirmed! Work contract and permanent chat thread unlocked.');
      } else {
        triggerToast(`Proposal response submitted (${response.replace('_', ' ')}).`);
      }
      await fetchWorkflowDetails();
    } catch (err: any) {
      triggerToast(err.message || 'Failed to respond to proposal.');
    } finally {
      setRespondingProposal(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto py-8 px-4 space-y-4 animate-pulse text-left">
        <div className="h-10 w-48 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
      </div>
    );
  }

  const req = isJobApp ? details?.job_application : details?.hiring_request;
  const job = isJobApp ? details?.job : null;

  if (error || !details || !req) {
    return (
      <div className="w-full max-w-md mx-auto py-12 px-4 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Unable to access negotiation room</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">{error || 'Room not found or unauthorized.'}</p>
        <button
          onClick={() => isJobApp ? navigate('/profile/jobs-applied') : navigate('/profile/hire-requests')}
          className="px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold"
        >
          {isJobApp ? 'Back to Applied Jobs' : 'Back to Hire Requests'}
        </button>
      </div>
    );
  }

  const room = details.negotiation_room;
  const activeProposal = details.active_proposal;
  const contract = details.work_contract;
  const messages = details.negotiation_messages || [];

  const isClient = isJobApp
    ? currentUserId === job?.posted_by
    : currentUserId === req.client_id;

  const otherPartyName = isJobApp
    ? (isClient ? (details.applicant_profile?.full_name || 'Applicant') : (details.employer_profile?.full_name || 'Employer'))
    : (isClient ? req.worker_name : req.client_name);

  const otherPartyId = isJobApp
    ? (isClient ? req.applicant_id : job?.posted_by)
    : (isClient ? req.worker_id : req.client_id);

  const otherPartyAvatar = isJobApp
    ? (isClient ? details.applicant_profile?.avatar_url : details.employer_profile?.avatar_url)
    : (isClient ? details.worker_profile?.avatar_url : details.client_profile?.avatar_url);

  const workTitle = isJobApp ? (job?.title || 'Job Application') : req.work_title;
  const clientId = isJobApp ? job?.posted_by : req.client_id;
  const workerId = isJobApp ? req.applicant_id : req.worker_id;

  const badge = getStatusBadge(req.status);
  const isRoomLocked = room?.status === 'locked' || req.status === 'confirmed';

  return (
    <div className="w-full max-w-4xl mx-auto py-4 sm:py-6 px-2 sm:px-6 space-y-4 text-left">

      {/* Header Bar */}
      <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => isJobApp ? navigate(job?.id ? `/jobs/${job.id}/applications` : '/profile/jobs-applied') : navigate('/profile/hire-requests')}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div
            onClick={() => otherPartyId && navigate(`/profile/${otherPartyId}`)}
            className="flex items-center space-x-3 cursor-pointer group"
          >
            <UserAvatar avatarUrl={otherPartyAvatar} fullName={otherPartyName} size="md" />
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-sm text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                  {otherPartyName}
                </span>
                <span className="text-[10px] font-bold text-slate-400">({isClient ? (isJobApp ? 'Applicant' : 'Worker') : (isJobApp ? 'Employer' : 'Client')})</span>
              </div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate max-w-xs">
                {workTitle}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2.5 self-start sm:self-auto">
          <span className={`inline-flex items-center text-xs font-extrabold px-3 py-1 rounded-full border ${badge.class}`}>
            ● {badge.label}
          </span>
          {!isJobApp && (
            <button
              onClick={() => navigate(`/hire-requests/${req.id}`)}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              title="View Details"
            >
              <Eye className="w-4 h-4" />
            </button>
          )}
          {isJobApp && job?.id && (
            <button
              onClick={() => navigate(`/jobs/${job.id}`)}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              title="View Job"
            >
              <Eye className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Temporary Notice Banner */}
      <div className="p-3.5 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-xs text-purple-800 dark:text-purple-300 leading-relaxed font-medium flex items-start space-x-2.5">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-purple-600 dark:text-purple-400" />
        <span>
          <strong>Temporary Negotiation Room:</strong> Discuss scope, pricing, and terms here. The permanent main chat unlocks only after both parties accept the final deal.
        </span>
      </div>

      {/* Confirmed Contract Success Banner (If Confirmed) */}
      {req.status === 'confirmed' && (
        <div className="bg-gradient-to-r from-emerald-500/15 to-teal-500/10 border-2 border-emerald-500/30 rounded-3xl p-5 space-y-3">
          <div className="flex items-center space-x-2 text-emerald-700 dark:text-emerald-300 font-extrabold text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span>Work Deal Confirmed & Work Contract Active!</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Congratulations! Both parties have accepted the deal terms. The negotiation room is now locked, and your permanent chat thread is open.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {(contract?.id || req.work_contract_id) && (
              <button
                onClick={() => navigate(`/work-contracts/${contract?.id || req.work_contract_id}`)}
                className="px-4 py-2 bg-white dark:bg-slate-900 border border-emerald-500/30 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold cursor-pointer"
              >
                View Confirmed Contract
              </button>
            )}
            {(req.permanent_conversation_id || contract?.permanent_conversation_id) && (
              <button
                onClick={() => navigate(`/messages/${req.permanent_conversation_id || contract?.permanent_conversation_id}`)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-xs cursor-pointer flex items-center space-x-1.5"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Open Permanent Main Chat</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Active Proposal View / Prepare Final Deal Action */}
      {!isRoomLocked && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowProposalForm(true)}
            className="px-5 py-2.5 bg-gradient-to-r from-[#7C3AED] to-purple-600 text-white font-extrabold text-xs rounded-xl shadow-xs hover:opacity-95 cursor-pointer flex items-center space-x-1.5"
          >
            <FileText className="w-4 h-4" />
            <span>{activeProposal ? 'Update / Resubmit Proposal' : 'Prepare Final Deal Proposal'}</span>
          </button>
        </div>
      )}

      {/* Active Deal Proposal Card Component */}
      {activeProposal && (
        <DealProposalCard
          proposal={activeProposal}
          currentUserId={currentUserId || ''}
          clientId={clientId}
          workerId={workerId}
          onRespond={handleRespondToProposal}
          isSubmitting={respondingProposal}
        />
      )}

      {/* Chat Thread Box */}
      <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-col h-[480px] shadow-xs overflow-hidden">

        {/* Messages List */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center p-6 text-slate-400 text-xs">
              <div>
                <MessageSquare className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p>No negotiation messages yet. Start discussing terms below.</p>
              </div>
            </div>
          ) : (
            messages.map((msg: any) => {
              const isMine = msg.sender_id === currentUserId;
              const isSystem = msg.message_type === 'system' || msg.message_type === 'proposal_event' || msg.message_type === 'status_event';

              if (isSystem) {
                return (
                  <div key={msg.id} className="text-center my-2">
                    <span className="inline-block px-3 py-1 bg-purple-500/10 text-purple-700 dark:text-purple-300 rounded-full text-[11px] font-semibold border border-purple-500/15 max-w-md">
                      {msg.text}
                    </span>
                  </div>
                );
              }

              return (
                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-xs ${
                    isMine
                      ? 'bg-purple-600 text-white rounded-br-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-bl-xs'
                  }`}>
                    <p className="whitespace-pre-line leading-relaxed">{msg.text}</p>
                    <span className={`text-[9px] block text-right mt-1 font-mono ${
                      isMine ? 'text-purple-200' : 'text-slate-400'
                    }`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Composer Row */}
        {isRoomLocked ? (
          <div className="p-3 bg-slate-100 dark:bg-slate-900 text-center text-xs font-bold text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 flex items-center justify-center space-x-1.5">
            <Lock className="w-3.5 h-3.5" />
            <span>Negotiation Room Locked</span>
          </div>
        ) : (
          <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center space-x-2 bg-slate-50/50 dark:bg-slate-900/50">
            <input
              type="text"
              placeholder="Type message to negotiate terms..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={sending}
              maxLength={5000}
              className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-purple-500"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || sending}
              className="h-10 px-4 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer disabled:opacity-40 flex items-center justify-center shrink-0"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
        )}
      </div>

      {/* Prepare Final Deal Proposal Modal */}
      <AnimatePresence>
        {showProposalForm && (
          <FinalDealForm
            requestId={!isJobApp ? req.id : undefined}
            applicationId={isJobApp ? req.id : undefined}
            initialTitle={workTitle}
            initialDescription={isJobApp ? job?.description : req.description}
            initialBudget={isJobApp ? undefined : req.budget}
            onClose={() => setShowProposalForm(false)}
            onSuccess={() => fetchWorkflowDetails()}
            triggerToast={triggerToast}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
