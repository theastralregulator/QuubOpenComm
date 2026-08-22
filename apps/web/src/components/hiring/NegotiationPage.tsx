import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageSquare, Send, ArrowLeft, ShieldAlert, Lock, CheckCircle2,
  FileText, Info, Loader2, Sparkles, AlertCircle, RefreshCw, Eye,
  MoreHorizontal, Reply, SmilePlus, Trash2, Mic, FolderOpen, CornerDownRight, X, AlertTriangle, Video
} from 'lucide-react';
import { supabase, dbService } from '../../lib/supabase';
import UserAvatar from '../common/UserAvatar';
import { getStatusBadge } from './HireRequestsPage';
import FinalDealForm from './FinalDealForm';
import DealProposalCard from './DealProposalCard';
import WorkflowTimeline, { getWorkflowTimelineSteps } from '../common/WorkflowTimeline';
import MediaMessage from '../messages/MediaMessage';
import MediaAttachmentPicker from '../messages/MediaAttachmentPicker';
import VoiceRecorder from '../messages/VoiceRecorder';
import { MediaFilesPanel } from '../messages/MediaFilesPanel';

interface NegotiationPageProps {
  triggerToast: (msg: string) => void;
}

function formatDateSeparator(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  if (isToday) return 'Today';
  if (isYesterday) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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

  // V2 Feature Flag State
  const [negotiationChatV2Enabled, setNegotiationChatV2Enabled] = useState(false);

  // V2 Advanced Thread State
  const [replyingToMessage, setReplyingToMessage] = useState<any | null>(null);
  const [activeMenuMsgId, setActiveMenuMsgId] = useState<string | null>(null);
  const [activeReactionPickerMsgId, setActiveReactionPickerMsgId] = useState<string | null>(null);
  const [deleteConfirmMessage, setDeleteConfirmMessage] = useState<any | null>(null);
  const [isDeletingMessage, setIsDeletingMessage] = useState(false);
  const [isMediaPanelOpen, setIsMediaPanelOpen] = useState(false);
  const [messageReactions, setMessageReactions] = useState<Record<string, any[]>>({});
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [isOtherUserOnline, setIsOtherUserOnline] = useState(false);

  // Media upload state
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{ file: File; mediaType: 'image' | 'video' | 'document'; previewUrl: string; durationMs?: number; width?: number; height?: number } | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  // Layout & Scroll refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesContentRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const initialUnreadMessageIdRef = useRef<string | null>(null);
  const initialScrollCompletedRef = useRef<boolean>(false);
  const initialScrollModeRef = useRef<'unread' | 'latest' | null>(null);
  const initialPinToBottomRef = useRef<boolean>(true);
  const pinTimeoutRef = useRef<any>(null);

  // Long press refs
  const longPressTimerRef = useRef<any>(null);
  const longPressStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const typingTimeoutRef = useRef<any>(null);
  const typingExpirationsRef = useRef<Map<string, any>>(new Map());
  const lastTypingSentRef = useRef<number>(0);

  // Check Feature Flag
  useEffect(() => {
    fetch('/api/negotiation-chat-status')
      .then(res => res.json())
      .then(data => {
        if (data && typeof data.negotiationChatV2Enabled === 'boolean') {
          setNegotiationChatV2Enabled(data.negotiationChatV2Enabled);
        }
      })
      .catch(err => console.warn('Negotiation chat status error:', err));
  }, []);

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
      let data: any = null;
      if (isJobApp && applicationId) {
        data = await dbService.getApplicationWorkflowDetails(applicationId);
      } else if (requestId) {
        data = await dbService.getHireWorkflowDetails(requestId);
      }
      setDetails(data);

      // Pre-capture unread if V2 enabled
      if (data?.negotiation_messages) {
        const rawMsgs = data.negotiation_messages || [];
        const sorted = [...rawMsgs].sort(
          (a: any, b: any) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
        );
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const firstUnread = sorted.find(
            (m: any) => m.sender_id !== user.id && m.unread === true && !m.deleted_at
          );
          initialUnreadMessageIdRef.current = firstUnread?.id || null;
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch negotiation details:', err);
      setError(err.message || 'Failed to load room details.');
    } finally {
      setLoading(false);
    }
  };

  // Realtime subscription for negotiation messages (INSERT & UPDATE)
  useEffect(() => {
    if (!details?.negotiation_room?.id || !supabase) return;

    const roomId = details.negotiation_room.id;
    const channelName = `hire_negotiation_${roomId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'negotiation_messages',
          filter: `negotiation_room_id=eq.${roomId}`
        },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
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
          } else if (payload.eventType === 'UPDATE') {
            const updatedMsg = payload.new;
            setDetails((prev: any) => {
              if (!prev) return prev;
              const existing = prev.negotiation_messages || [];
              return {
                ...prev,
                negotiation_messages: existing.map((m: any) => m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m)
              };
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [details?.negotiation_room?.id]);

  // Single Private Realtime Channel Ref & Presence Tracking Status
  const negotiationRealtimeChannelRef = useRef<any>(null);
  const trackedPresenceRef = useRef<boolean>(false);

  // V2 Private Realtime Channel (Typing, Reactions, Online Status)
  useEffect(() => {
    if (!negotiationChatV2Enabled || !details?.negotiation_room?.id || !currentUserId) return;

    const roomId = details.negotiation_room.id;
    const channel = supabase.channel(`negotiation:${roomId}`, {
      config: { private: true }
    });

    negotiationRealtimeChannelRef.current = channel;

    channel
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { userId, typing } = payload.payload || {};
        if (!userId || userId === currentUserId) return;

        if (typing) {
          setTypingUsers((prev) => new Map(prev).set(userId, 'Typing…'));
          if (typingExpirationsRef.current.has(userId)) {
            clearTimeout(typingExpirationsRef.current.get(userId));
          }
          const timer = setTimeout(() => {
            setTypingUsers((prev) => {
              const next = new Map(prev);
              next.delete(userId);
              return next;
            });
            typingExpirationsRef.current.delete(userId);
          }, 3000);
          typingExpirationsRef.current.set(userId, timer);
        } else {
          if (typingExpirationsRef.current.has(userId)) {
            clearTimeout(typingExpirationsRef.current.get(userId));
            typingExpirationsRef.current.delete(userId);
          }
          setTypingUsers((prev) => {
            const next = new Map(prev);
            next.delete(userId);
            return next;
          });
        }
      })
      .on('broadcast', { event: 'reaction_changed' }, () => {
        void fetchReactions();
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const otherPartyId = isJobApp
          ? (currentUserId === details?.job?.posted_by ? details?.job_application?.applicant_id : details?.job?.posted_by)
          : (currentUserId === details?.hiring_request?.client_id ? details?.hiring_request?.worker_id : details?.hiring_request?.client_id);

        let otherOnline = false;
        if (otherPartyId) {
          for (const key in state) {
            const presences = state[key] as any[];
            if (presences.some((p) => p.userId === otherPartyId)) {
              otherOnline = true;
              break;
            }
          }
        }
        setIsOtherUserOnline(otherOnline);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Check online status privacy setting before tracking presence
          dbService.getMyUserSettings()
            .then((settings) => {
              const showOnline = settings?.showOnlineStatus !== false;
              if (showOnline) {
                channel.track({ userId: currentUserId, onlineAt: new Date().toISOString() })
                  .then(() => { trackedPresenceRef.current = true; })
                  .catch(() => {});
              }
            })
            .catch(() => {
              // Fail closed: do not publish presence if retrieval fails
              trackedPresenceRef.current = false;
            });
        }
      });

    const fetchReactions = async () => {
      try {
        const { data } = await supabase
          .from('negotiation_message_reactions')
          .select('*')
          .eq('negotiation_room_id', roomId);
        const grouped: Record<string, any[]> = {};
        (data || []).forEach((r: any) => {
          if (!grouped[r.message_id]) grouped[r.message_id] = [];
          grouped[r.message_id].push(r);
        });
        setMessageReactions(grouped);
      } catch (_) {}
    };

    void fetchReactions();

    return () => {
      // Async cleanup IIFE
      (async () => {
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = null;
        }
        try {
          if (channel) {
            channel.send({
              type: 'broadcast',
              event: 'typing',
              payload: { userId: currentUserId, typing: false }
            }).catch(() => {});

            if (trackedPresenceRef.current) {
              await channel.untrack().catch(() => {});
              trackedPresenceRef.current = false;
            }
            await supabase.removeChannel(channel).catch(() => {});
          }
        } catch (_) {}
      })();
      negotiationRealtimeChannelRef.current = null;
    };
  }, [negotiationChatV2Enabled, details?.negotiation_room?.id, currentUserId]);

  // V1 Fallback Auto-Scroll
  useEffect(() => {
    if (!negotiationChatV2Enabled) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [details?.negotiation_messages, negotiationChatV2Enabled]);

  // V2 Initial Scroll Positioning Effect
  useEffect(() => {
    if (!negotiationChatV2Enabled || loading || !details?.negotiation_messages) return;
    const container = messagesContainerRef.current;
    if (!container || initialScrollCompletedRef.current) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (initialScrollCompletedRef.current) return;
        const unreadId = initialUnreadMessageIdRef.current;
        const unreadEl = unreadId ? document.getElementById(`msg-${unreadId}`) : null;

        if (unreadEl) {
          initialScrollModeRef.current = 'unread';
          unreadEl.scrollIntoView({ behavior: 'auto', block: 'start' });
        } else {
          initialScrollModeRef.current = 'latest';
          container.scrollTop = container.scrollHeight;
        }

        initialScrollCompletedRef.current = true;

        if (details?.negotiation_room?.id) {
          supabase.rpc('mark_negotiation_room_read', { p_room_id: details.negotiation_room.id }).catch(() => {});
        }
      });
    });
  }, [negotiationChatV2Enabled, loading, details?.negotiation_messages]);

  // Pointer events for long press
  const handleBubblePointerDown = (msg: any, e: React.PointerEvent) => {
    if (!negotiationChatV2Enabled || room?.status === 'locked') return;
    if (msg.deleted_at || msg.message_type === 'system' || msg.message_type === 'proposal_event' || msg.message_type === 'status_event') return;
    if (e.button !== undefined && e.button !== 0) return;

    longPressStartPosRef.current = { x: e.clientX, y: e.clientY };
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

    longPressTimerRef.current = setTimeout(() => {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate(10); } catch (_) {}
      }
      setActiveMenuMsgId(null);
      setActiveReactionPickerMsgId(msg.id);
      longPressTimerRef.current = null;
    }, 500);
  };

  const handleBubblePointerMove = (e: React.PointerEvent) => {
    if (!longPressTimerRef.current || !longPressStartPosRef.current) return;
    const dist = Math.hypot(e.clientX - longPressStartPosRef.current.x, e.clientY - longPressStartPosRef.current.y);
    if (dist > 10) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleBubblePointerUpOrCancel = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const sendTypingStatus = (typing: boolean) => {
    if (!negotiationChatV2Enabled || !details?.negotiation_room?.id || room?.status !== 'active') return;
    if (negotiationRealtimeChannelRef.current) {
      negotiationRealtimeChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: currentUserId, typing }
      }).catch(() => {});
    }
  };

  const handleChatInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);
    if (!negotiationChatV2Enabled || room?.status !== 'active') return;

    if (val.trim() === '') {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      sendTypingStatus(false);
      return;
    }

    const now = Date.now();
    if (now - lastTypingSentRef.current > 1000) {
      sendTypingStatus(true);
      lastTypingSentRef.current = now;
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingStatus(false);
    }, 2000);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || sending || !details?.negotiation_room?.id) return;

    const textToSend = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      if (negotiationChatV2Enabled) {
        const { data: res, error: sendErr } = await supabase.rpc('send_negotiation_message_v2', {
          p_room_id: details.negotiation_room.id,
          p_text: textToSend,
          p_reply_to_message_id: replyingToMessage?.id || null
        });

        if (sendErr || !res?.success) {
          throw new Error(sendErr?.message || res?.error || 'Failed to send negotiation message');
        }
        setReplyingToMessage(null);
      } else {
        await dbService.sendNegotiationMessage(details.negotiation_room.id, textToSend);
      }
    } catch (err: any) {
      triggerToast(err.message || 'Failed to send message.');
      setInputText(textToSend);
    } finally {
      setSending(false);
    }
  };

  const handleToggleReaction = async (msg: any, emoji: string) => {
    if (!details?.negotiation_room?.id) return;
    try {
      await supabase.rpc('toggle_negotiation_message_reaction', {
        p_message_id: msg.id,
        p_room_id: details.negotiation_room.id,
        p_emoji: emoji
      });
    } catch (err: any) {
      triggerToast(err.message || 'Failed to toggle reaction.');
    }
  };

  const handleUploadAndSendMedia = async (
    file: File,
    mediaType: 'image' | 'video' | 'document' | 'audio',
    durationMs?: number,
    width?: number,
    height?: number
  ) => {
    if (!details?.negotiation_room?.id) return;
    setIsUploadingMedia(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Authentication required.');

      const initRes = await fetch('/api/negotiation-media-upload-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          roomId: details.negotiation_room.id,
          mediaType,
          mimeType: file.type || (mediaType === 'audio' ? 'audio/webm' : 'application/octet-stream'),
          fileSizeBytes: file.size,
          durationMs,
          replyToMessageId: replyingToMessage?.id || null
        })
      });

      let intentData = await initRes.json();
      if (!initRes.ok) {
        const fallbackRes = await fetch('/api/negotiation-media-upload-fallback-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            roomId: details.negotiation_room.id,
            mediaType,
            mimeType: file.type || 'application/octet-stream',
            fileSizeBytes: file.size,
            durationMs,
            replyToMessageId: replyingToMessage?.id || null
          })
        });
        intentData = await fallbackRes.json();
        if (!fallbackRes.ok) throw new Error(intentData.error || 'Failed to initialize upload intent.');
      }

      if (intentData.provider === 'b2' && intentData.uploadUrl) {
        await fetch(intentData.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } });
      } else if (intentData.formData && intentData.uploadUrl) {
        const fd = new FormData();
        Object.entries(intentData.formData).forEach(([k, v]) => fd.append(k, v as string));
        fd.append('file', file);
        await fetch(intentData.uploadUrl, { method: 'POST', body: fd });
      }

      const finRes = await fetch('/api/negotiation-media-finalize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          intentId: intentData.intentId,
          roomId: details.negotiation_room.id,
          durationMs,
          width,
          height,
          originalFilename: file.name
        })
      });

      const finData = await finRes.json();
      if (!finRes.ok) throw new Error(finData.error || 'Failed to finalize media upload.');

      setSelectedMedia(null);
      setIsVoiceRecording(false);
      setReplyingToMessage(null);
      triggerToast('Media sent successfully');
    } catch (err: any) {
      triggerToast(err.message || 'Media upload failed.');
    } finally {
      setIsUploadingMedia(false);
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
        triggerToast('🎉 Agreement confirmed! Main chat thread unlocked.');
        if (res?.work_contract_id) {
          navigate(`/work-contracts/${res.work_contract_id}`);
        } else {
          await fetchWorkflowDetails();
        }
      } else {
        triggerToast(`Response submitted (${response.replace('_', ' ')}).`);
        await fetchWorkflowDetails();
      }
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
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Unable to access discussion room</h3>
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
  const rawMessages = details.negotiation_messages || [];
  const sortedMessages = [...rawMessages].sort(
    (a: any, b: any) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
  );

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
                {negotiationChatV2Enabled && isOtherUserOnline && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/50">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Online
                  </span>
                )}
                <span className="text-[10px] font-bold text-slate-400">({isClient ? (isJobApp ? 'Applicant' : 'Worker') : (isJobApp ? 'Employer' : 'Client')})</span>
              </div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate max-w-xs">
                {workTitle}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2.5 self-start sm:self-auto">
          {negotiationChatV2Enabled && (
            <button
              onClick={() => setIsMediaPanelOpen(true)}
              className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs font-medium border border-slate-200 dark:border-slate-800"
              title="Media & Files"
            >
              <FolderOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Media & Files</span>
            </button>
          )}

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

      {/* Visual Workflow Timeline */}
      <WorkflowTimeline steps={getWorkflowTimelineSteps(isJobApp ? 'job_application' : 'hire_request', req.status)} />

      {/* Temporary Notice Banner */}
      <div className="p-3.5 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-xs text-purple-800 dark:text-purple-300 leading-relaxed font-medium flex items-start space-x-2.5">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-purple-600 dark:text-purple-400" />
        <span>
          <strong>Discussion & Planning:</strong> Discuss scope, pricing, and timing here. Once both parties confirm the work agreement, main chat unlocks.
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
            <span>{activeProposal ? 'Update Work Agreement' : 'Send Work Agreement'}</span>
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
        <div ref={messagesContainerRef} className="flex-1 p-4 overflow-y-auto space-y-3">
          {sortedMessages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center p-6 text-slate-400 text-xs">
              <div>
                <MessageSquare className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p>No negotiation messages yet. Start discussing terms below.</p>
              </div>
            </div>
          ) : !negotiationChatV2Enabled ? (
            /* V1 Basic Thread Rendering */
            sortedMessages.map((msg: any) => {
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
          ) : (
            /* V2 Feature-Rich Thread Rendering */
            <div ref={messagesContentRef} className="space-y-3">
              {sortedMessages.map((msg: any, idx: number) => {
                const isMine = msg.sender_id === currentUserId;
                const sentTime = msg.created_at
                  ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '';
                const isRead = Boolean(msg.read_at) || msg.unread === false;
                const isDeleted = Boolean(msg.deleted_at);
                const isFirstUnread = initialUnreadMessageIdRef.current && msg.id === initialUnreadMessageIdRef.current;

                const prevMsg = idx > 0 ? sortedMessages[idx - 1] : null;
                const currentDateStr = msg.created_at ? new Date(msg.created_at).toDateString() : '';
                const prevDateStr = prevMsg?.created_at ? new Date(prevMsg.created_at).toDateString() : '';
                const showDateSeparator = currentDateStr !== prevDateStr && currentDateStr !== '';

                const isSystem = msg.message_type === 'system' || msg.message_type === 'proposal_event' || msg.message_type === 'status_event';

                if (isSystem) {
                  return (
                    <React.Fragment key={msg.id}>
                      {isFirstUnread && (
                        <div id="new-messages-separator" className="flex items-center justify-center my-4">
                          <div className="flex-1 border-t border-purple-300/50 dark:border-purple-800/50" />
                          <span className="px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-950/60 text-[10px] font-extrabold text-purple-600 dark:text-purple-400 uppercase tracking-wider border border-purple-200 dark:border-purple-800/60 shadow-2xs">
                            New messages
                          </span>
                          <div className="flex-1 border-t border-purple-300/50 dark:border-purple-800/50" />
                        </div>
                      )}
                      {showDateSeparator && (
                        <div className="flex justify-center my-4">
                          <span className="px-3 py-1 rounded-full bg-slate-200/60 dark:bg-slate-800/60 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border border-slate-300/40 dark:border-slate-700/40">
                            {formatDateSeparator(msg.created_at)}
                          </span>
                        </div>
                      )}
                      <div id={`msg-${msg.id}`} className="flex justify-center my-3 text-center px-4">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 text-[11px] font-semibold border border-purple-500/15 max-w-[90%] break-words">
                          <Sparkles className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                          <span>{msg.text}</span>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                }

                const replyParent = msg.reply_to_message_id
                  ? sortedMessages.find((m: any) => m.id === msg.reply_to_message_id)
                  : null;

                const rxList = messageReactions[msg.id] || [];
                const rxCounts: Record<string, { count: number; hasMine: boolean }> = {};
                rxList.forEach((r: any) => {
                  if (!rxCounts[r.emoji]) rxCounts[r.emoji] = { count: 0, hasMine: false };
                  rxCounts[r.emoji].count += 1;
                  if (r.user_id === currentUserId) rxCounts[r.emoji].hasMine = true;
                });

                return (
                  <React.Fragment key={msg.id}>
                    {isFirstUnread && (
                      <div id="new-messages-separator" className="flex items-center justify-center my-4">
                        <div className="flex-1 border-t border-purple-300/50 dark:border-purple-800/50" />
                        <span className="px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-950/60 text-[10px] font-extrabold text-purple-600 dark:text-purple-400 uppercase tracking-wider border border-purple-200 dark:border-purple-800/60 shadow-2xs">
                          New messages
                        </span>
                        <div className="flex-1 border-t border-purple-300/50 dark:border-purple-800/50" />
                      </div>
                    )}
                    {showDateSeparator && (
                      <div className="flex justify-center my-4">
                        <span className="px-3 py-1 rounded-full bg-slate-200/60 dark:bg-slate-800/60 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border border-slate-300/40 dark:border-slate-700/40">
                          {formatDateSeparator(msg.created_at)}
                        </span>
                      </div>
                    )}
                    <div
                      id={`msg-${msg.id}`}
                      className={`flex items-end gap-2 group relative rounded-2xl p-1 ${isMine ? 'justify-end' : 'justify-start'}`}
                    >
                      {!isMine && (
                        <UserAvatar avatarUrl={otherPartyAvatar} fullName={otherPartyName} size="sm" className="shrink-0 mb-1" />
                      )}
                      <div className={`max-w-[85%] sm:max-w-[70%] space-y-1 relative ${isMine ? 'items-end' : 'items-start'}`}>

                        {/* Quoted Reply Block */}
                        {msg.reply_to_message_id && (
                          <div className="p-2 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border-l-3 border-purple-500 text-[11px] text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                            <CornerDownRight className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                            <div className="truncate">
                              {replyParent ? (
                                replyParent.deleted_at ? (
                                  <span className="italic text-slate-400">Deleted message</span>
                                ) : (
                                  <span>{replyParent.text}</span>
                                )
                              ) : (
                                <span className="italic text-slate-400">Quoted message</span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Deleted Message Bubble OR Normal Message */}
                        {isDeleted ? (
                          <div className="p-2.5 px-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs italic font-medium flex items-center gap-1.5 border border-slate-200/60 dark:border-slate-800/60">
                            <Trash2 className="w-3.5 h-3.5 stroke-[1.5]" />
                            <span>This message was deleted</span>
                          </div>
                        ) : (
                          <div
                            className="relative group/bubble"
                            onPointerDown={(e) => handleBubblePointerDown(msg, e)}
                            onPointerMove={handleBubblePointerMove}
                            onPointerUp={handleBubblePointerUpOrCancel}
                            onPointerCancel={handleBubblePointerUpOrCancel}
                          >
                            {msg.media_type && msg.media_type !== 'text' ? (
                              <MediaMessage
                                messageId={msg.id}
                                mediaType={msg.media_type}
                                isSelf={isMine}
                                isRead={isRead}
                                endpoint="/api/negotiation-media-access"
                                width={(msg as any).media_metadata?.width}
                                height={(msg as any).media_metadata?.height}
                                durationMs={(msg as any).media_metadata?.duration_ms}
                              />
                            ) : (
                              <div
                                className={`p-3 rounded-2xl text-xs font-medium leading-relaxed whitespace-pre-wrap break-words text-left transition-colors duration-300 ${
                                  isMine
                                    ? isRead
                                      ? 'bg-blue-600 text-white rounded-br-xs shadow-xs'
                                      : 'bg-slate-600 text-white rounded-br-xs shadow-xs'
                                    : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700/60 rounded-bl-xs shadow-xs'
                                }`}
                              >
                                {msg.text}
                              </div>
                            )}

                            {/* Action Menu Trigger */}
                            {!isRoomLocked && (
                              <div className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-100 sm:opacity-0 group-hover/bubble:opacity-100 transition-opacity z-20 ${
                                isMine ? '-left-14' : '-right-14'
                              }`}>
                                <div className="relative">
                                  <button
                                    onClick={() => setActiveMenuMsgId(activeMenuMsgId === msg.id ? null : msg.id)}
                                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 shadow-xs border border-slate-200 dark:border-slate-700"
                                    title="Actions"
                                  >
                                    <MoreHorizontal className="w-3.5 h-3.5" />
                                  </button>

                                  {activeMenuMsgId === msg.id && (
                                    <div className={`absolute bottom-full mb-1 ${isMine ? 'right-0' : 'left-0'} bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-1 z-30 min-w-[120px] flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100`}>
                                      <button
                                        onClick={() => {
                                          setReplyingToMessage(msg);
                                          setActiveMenuMsgId(null);
                                          textareaRef.current?.focus();
                                        }}
                                        className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                      >
                                        <Reply className="w-3.5 h-3.5 text-blue-500" />
                                        <span>Reply</span>
                                      </button>

                                      <button
                                        onClick={() => {
                                          setActiveReactionPickerMsgId(activeReactionPickerMsgId === msg.id ? null : msg.id);
                                          setActiveMenuMsgId(null);
                                        }}
                                        className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                      >
                                        <SmilePlus className="w-3.5 h-3.5 text-amber-500" />
                                        <span>React</span>
                                      </button>

                                      {isMine && !isDeleted && (
                                        <button
                                          onClick={() => {
                                            setDeleteConfirmMessage(msg);
                                            setActiveMenuMsgId(null);
                                          }}
                                          className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                          <span>Delete</span>
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Reaction Picker Bar */}
                            {activeReactionPickerMsgId === msg.id && !isRoomLocked && (
                              <div className={`absolute bottom-full mb-2 ${isMine ? 'right-0' : 'left-0'} bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-xl p-1.5 z-40 flex items-center gap-1 animate-in zoom-in-95 duration-100`}>
                                {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                                  <button
                                    key={emoji}
                                    onClick={() => {
                                      void handleToggleReaction(msg, emoji);
                                      setActiveReactionPickerMsgId(null);
                                    }}
                                    className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-base transition-transform hover:scale-125"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Grouped Reaction Chips */}
                        {!isDeleted && Object.keys(rxCounts).length > 0 && (
                          <div className={`flex flex-wrap gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                            {Object.entries(rxCounts).map(([emoji, data]) => (
                              <button
                                key={emoji}
                                disabled={isRoomLocked}
                                onClick={() => void handleToggleReaction(msg, emoji)}
                                className={`px-2 py-0.5 rounded-full text-[11px] font-medium flex items-center gap-1 border transition-all ${
                                  data.hasMine
                                    ? 'bg-purple-100 dark:bg-purple-950/60 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 font-bold'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                                }`}
                              >
                                <span>{emoji}</span>
                                <span>{data.count}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Timestamp & Read Status */}
                        {!isDeleted && (
                          <div className={`flex items-center gap-1 text-[10px] font-semibold text-slate-400 ${isMine ? 'justify-end' : 'justify-start'}`}>
                            <span>{sentTime}</span>
                            {isMine && (
                              <>
                                <span>·</span>
                                <span className={isRead ? 'text-blue-500 font-bold' : 'text-slate-400'}>
                                  {isRead ? 'Read' : 'Sent'}
                                </span>
                              </>
                            )}
                          </div>
                        )}

                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Typing Bar (V2) */}
        {negotiationChatV2Enabled && (
          <div className="h-6 px-4 py-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 italic flex items-center gap-1.5 shrink-0 transition-opacity duration-150 border-t border-slate-100 dark:border-slate-800/40">
            {typingUsers.size > 0 ? (
              <>
                <span className="flex gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
                <span>Typing…</span>
              </>
            ) : null}
          </div>
        )}

        {/* Quoted Reply Bar in Composer */}
        {negotiationChatV2Enabled && replyingToMessage && !isRoomLocked && (
          <div className="p-2 px-3 bg-purple-50 dark:bg-purple-950/40 border-t border-purple-100 dark:border-purple-900/50 flex items-center justify-between gap-2 shrink-0 animate-in slide-in-from-bottom-2 duration-150">
            <div className="flex items-center gap-2 min-w-0">
              <Reply className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
              <div className="min-w-0 text-xs">
                <span className="font-semibold text-slate-900 dark:text-white mr-1.5">
                  Replying to message
                </span>
                <span className="text-slate-500 dark:text-slate-400 truncate block sm:inline">
                  {replyingToMessage.text}
                </span>
              </div>
            </div>
            <button
              onClick={() => setReplyingToMessage(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Composer Row */}
        {isRoomLocked ? (
          <div className="p-3 bg-slate-100 dark:bg-slate-900 text-center text-xs font-bold text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 flex items-center justify-center space-x-1.5">
            <Lock className="w-3.5 h-3.5" />
            <span>Negotiation Room Locked</span>
          </div>
        ) : isVoiceRecording && negotiationChatV2Enabled ? (
          <div className="p-2 sm:p-3 border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0B0F19] shrink-0">
            <VoiceRecorder
              onSendVoiceNote={(blob, durationMs) => {
                const file = new File([blob], 'voice_note.webm', { type: blob.type || 'audio/webm' });
                void handleUploadAndSendMedia(file, 'audio', durationMs);
              }}
              onCancel={() => setIsVoiceRecording(false)}
              disabled={isUploadingMedia}
            />
          </div>
        ) : selectedMedia && negotiationChatV2Enabled ? (
          <div className="p-3 border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0B0F19] shrink-0 flex items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center space-x-3 min-w-0">
              {selectedMedia.mediaType === 'image' ? (
                <img src={selectedMedia.previewUrl} alt="Preview" className="w-12 h-12 object-cover rounded-xl border border-slate-200 dark:border-slate-700" />
              ) : selectedMedia.mediaType === 'document' ? (
                <div className="w-12 h-12 bg-emerald-900/40 text-emerald-400 rounded-xl flex items-center justify-center border border-emerald-700/50">
                  <FileText className="w-6 h-6" />
                </div>
              ) : (
                <div className="w-12 h-12 bg-purple-900/40 text-purple-400 rounded-xl flex items-center justify-center border border-purple-700/50">
                  <Video className="w-6 h-6" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {selectedMedia.file.name}
                </p>
                <p className="text-[10px] text-slate-400">
                  {(selectedMedia.file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                disabled={isUploadingMedia}
                onClick={() => {
                  if (selectedMedia.previewUrl) URL.revokeObjectURL(selectedMedia.previewUrl);
                  setSelectedMedia(null);
                }}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={isUploadingMedia}
                onClick={() => handleUploadAndSendMedia(selectedMedia.file, selectedMedia.mediaType, selectedMedia.durationMs, selectedMedia.width, selectedMedia.height)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center space-x-1.5 disabled:opacity-50"
              >
                {isUploadingMedia ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center space-x-2 bg-slate-50/50 dark:bg-slate-900/50">
            {negotiationChatV2Enabled && (
              <MediaAttachmentPicker
                onFileSelected={(file, mediaType, previewUrl, durationMs, width, height) => {
                  setSelectedMedia({ file, mediaType: mediaType as any, previewUrl, durationMs, width, height });
                }}
                disabled={sending || isUploadingMedia}
                documentEnabled={true}
              />
            )}
            <input
              ref={textareaRef as any}
              type="text"
              placeholder="Type message to negotiate terms..."
              value={inputText}
              onChange={handleChatInputChange}
              onBlur={() => sendTypingStatus(false)}
              disabled={sending}
              maxLength={5000}
              className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-purple-500"
            />
            {negotiationChatV2Enabled && (
              <button
                type="button"
                onClick={() => setIsVoiceRecording(true)}
                className="p-2 text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors shrink-0"
                title="Record voice note"
              >
                <Mic className="w-4 h-4" />
              </button>
            )}
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

      {/* Media & Files Panel Drawer for Negotiation Chat */}
      {negotiationChatV2Enabled && details?.negotiation_room?.id && (
        <MediaFilesPanel
          isOpen={isMediaPanelOpen}
          onClose={() => setIsMediaPanelOpen(false)}
          conversationId={details.negotiation_room.id}
          accessEndpoint="/api/negotiation-media-access"
          onJumpToMessage={(msgId) => {
            const el = document.getElementById(`msg-${msgId}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setIsMediaPanelOpen(false);
          }}
          itemsFetcher={async (roomId) => {
            const { data } = await supabase
              .from('negotiation_messages')
              .select('id, media_type, media_metadata, created_at, text')
              .eq('negotiation_room_id', roomId)
              .not('media_type', 'is', null)
              .is('deleted_at', null)
              .order('created_at', { ascending: false });

            return (data || []).map((m: any) => ({
              media_id: m.id,
              message_id: m.id,
              conversation_id: roomId,
              media_type: m.media_type,
              mime_type: m.media_metadata?.mime_type || 'application/octet-stream',
              file_size_bytes: m.media_metadata?.file_size_bytes || 0,
              created_at: m.created_at,
              original_filename: m.media_metadata?.original_filename || m.text
            }));
          }}
        />
      )}

      {/* Delete Confirmation Modal for Negotiation Chat */}
      {negotiationChatV2Enabled && deleteConfirmMessage && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4 text-left">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950/50">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Delete message?</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Delete this negotiation message for everyone?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                disabled={isDeletingMessage}
                onClick={() => setDeleteConfirmMessage(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={isDeletingMessage}
                onClick={async () => {
                  setIsDeletingMessage(true);
                  try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session?.access_token) throw new Error('Authentication required.');

                    const res = await fetch('/api/negotiation-message-delete', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                      },
                      body: JSON.stringify({ messageId: deleteConfirmMessage.id })
                    });

                    const data = await res.json().catch(() => ({}));
                    if (!res.ok || !data.success) {
                      throw new Error(data.error || 'Failed to delete message.');
                    }

                    triggerToast('Message deleted');
                    setDeleteConfirmMessage(null);
                  } catch (err: any) {
                    triggerToast(err.message || 'Failed to delete message.');
                  } finally {
                    setIsDeletingMessage(false);
                  }
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDeletingMessage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
