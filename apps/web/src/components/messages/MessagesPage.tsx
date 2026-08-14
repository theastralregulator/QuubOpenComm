import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, Send, ArrowLeft, ShieldAlert, 
  RefreshCw, AlertCircle, Search, X, Loader2, AlertTriangle,
  Mic, Image as ImageIcon, Video as VideoIcon
} from 'lucide-react';
import { supabase, dbService } from '../../lib/supabase';
import { unreadService } from '../../lib/unreadService';
import { ConversationViewModel, DbMessage } from '../../types';
import UserAvatar from '../common/UserAvatar';
import WorkContractBanner from '../contracts/WorkContractBanner';
import VoiceRecorder from './VoiceRecorder';
import MediaMessage from './MediaMessage';
import MediaAttachmentPicker from './MediaAttachmentPicker';

export interface ConversationGroup {
  participantId: string;
  participantName: string;
  participantAvatar: string | null;
  conversations: ConversationViewModel[];
  latestActivityTime: number;
  latestActivityFormatted: string;
  latestMessageText: string;
  totalUnread: number;
}

type PendingMessage = {
  id: string;
  text: string;
  status: 'sending' | 'failed';
};

interface MessagesPageProps {
  triggerToast: (msg: string) => void;
}

export default function MessagesPage({ triggerToast }: MessagesPageProps) {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationViewModel[]>([]);
  
  const handleSetConversations = (convList: ConversationViewModel[]) => {
    // 1. Group conversations by unique context key (otherParticipantId + conversationType + applicationId)
    const groupedByContext = new Map<string, ConversationViewModel[]>();

    for (const c of convList) {
      const key = `${c.otherParticipantId}-${c.conversationType}-${c.applicationId || 'null'}`;
      const group = groupedByContext.get(key) || [];
      group.push(c);
      groupedByContext.set(key, group);
    }

    // 2. Select canonical conversation for each context key
    const canonicalConversations: ConversationViewModel[] = [];
    for (const [_, group] of groupedByContext.entries()) {
      group.sort((a, b) => {
        const isArchivedA = Boolean(a.archivedAt);
        const isArchivedB = Boolean(b.archivedAt);
        // Priority 1: Active (non-archived) before archived
        if (isArchivedA !== isArchivedB) {
          return isArchivedA ? 1 : -1;
        }
        // Priority 2: Newest message/activity time
        const timeA = new Date(a.lastMessageTime || a.createdAt || 0).getTime();
        const timeB = new Date(b.lastMessageTime || b.createdAt || 0).getTime();
        if (timeA !== timeB) {
          return timeB - timeA;
        }
        // Priority 3: Stable ID tie-break
        return a.id.localeCompare(b.id);
      });

      canonicalConversations.push(group[0]);
    }

    setConversations(canonicalConversations);
  };
  const [loadingConvs, setLoadingConvs] = useState<boolean>(true);
  const [convsError, setConvsError] = useState<string | null>(null);

  const [messages, setMessages] = useState<DbMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  const [chatInput, setChatInput] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedParticipantGroup, setSelectedParticipantGroup] = useState<ConversationGroup | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchOpen) {
      searchInputRef.current?.focus();
    } else {
      setSearchQuery('');
    }
  }, [isSearchOpen]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Active conversation selection
  const activeConv = conversations.find(c => c.id === conversationId);

  // Media Messaging State
  const [mediaStatus, setMediaStatus] = useState<{ mediaMessagingEnabled: boolean; voiceEnabled: boolean; imageEnabled: boolean; videoEnabled: boolean }>({
    mediaMessagingEnabled: false,
    voiceEnabled: false,
    imageEnabled: false,
    videoEnabled: false
  });
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{ file: File; mediaType: 'image' | 'video'; previewUrl: string; durationMs?: number; width?: number; height?: number } | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  useEffect(() => {
    fetch('/api/media-status')
      .then(res => res.json())
      .then(data => {
        if (data && typeof data.mediaMessagingEnabled === 'boolean') {
          setMediaStatus(data);
        }
      })
      .catch(err => console.warn('Media status check error:', err));
  }, []);

  const handleUploadAndSendMedia = async (file: File, mediaType: 'image' | 'video' | 'audio', durationMs?: number, width?: number, height?: number) => {
    if (!conversationId || !activeConv) return;
    if (activeConv.archivedAt) {
      triggerToast('Cannot send media to an archived conversation.');
      return;
    }

    setIsUploadingMedia(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        triggerToast('Authentication required to upload media.');
        setIsUploadingMedia(false);
        return;
      }

      // Normalize MIME type defensively and ensure upload Blob has clean mime type
      const rawMime = file.type || (mediaType === 'audio' ? 'audio/webm' : mediaType === 'image' ? 'image/jpeg' : 'video/mp4');
      const cleanMimeType = rawMime.split(';')[0].trim().toLowerCase();
      const uploadFile = file.type !== cleanMimeType ? new Blob([file], { type: cleanMimeType }) : file;

      // Helper function to perform binary upload & finalization for a target
      const uploadAndFinalizeTarget = async (intentTarget: any) => {
        let targetHost = 'unknown';
        try {
          targetHost = new URL(intentTarget.uploadUrl).hostname;
        } catch (e) {}

        let putRes: Response;
        try {
          if (intentTarget.uploadMethod === 'POST' && intentTarget.formDataParams) {
            const formData = new FormData();
            Object.entries(intentTarget.formDataParams).forEach(([k, v]) => {
              formData.append(k, v as string);
            });
            formData.append('file', uploadFile);
            putRes = await fetch(intentTarget.uploadUrl, {
              method: 'POST',
              body: formData
            });
          } else {
            putRes = await fetch(intentTarget.uploadUrl, {
              method: 'PUT',
              headers: intentTarget.headers || { 'Content-Type': cleanMimeType },
              body: uploadFile
            });
          }
        } catch (err: any) {
          console.error('[MediaUpload] direct-upload-error', {
            provider: intentTarget.provider,
            hostname: targetHost,
            errorName: err?.name,
            errorMessage: err?.message
          });
          throw err;
        }

        if (!putRes.ok) {
          const errorText = await putRes.text().catch(() => '');
          let xmlCode = '';
          let cloudinaryMessage = '';

          try {
            const parsed = JSON.parse(errorText);
            if (parsed.error && parsed.error.message) {
              cloudinaryMessage = parsed.error.message;
            }
          } catch (e) {}

          const codeMatch = errorText.match(/<Code>(.*?)<\/Code>/i);
          if (codeMatch && codeMatch[1]) {
            xmlCode = codeMatch[1];
          }

          console.error('[MediaUpload] direct-upload-rejected', {
            provider: intentTarget.provider,
            hostname: targetHost,
            status: putRes.status,
            xmlCode: xmlCode || undefined,
            cloudinaryMessage: cloudinaryMessage || undefined
          });
          throw new Error(`Storage upload rejected (HTTP ${putRes.status}${xmlCode ? ` ${xmlCode}` : ''}${cloudinaryMessage ? `: ${cloudinaryMessage}` : ''})`);
        }

        // Finalize upload & create message record
        const previewText = mediaType === 'audio' ? 'Voice message' : mediaType === 'image' ? 'Photo' : 'Video';
        const finalizeRes = await fetch('/api/media-finalize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            intentId: intentTarget.intentId,
            conversationId,
            provider: intentTarget.provider,
            objectKey: intentTarget.objectKey,
            mediaType,
            mimeType: cleanMimeType,
            fileSizeBytes: uploadFile.size,
            durationMs,
            width,
            height,
            originalFilename: (file as File).name || undefined,
            previewText
          })
        });

        const finalizeData = await finalizeRes.json().catch(() => ({}));
        if (!finalizeRes.ok || !finalizeData.success) {
          throw new Error(finalizeData.error || 'Media finalization failed');
        }

        return true;
      };

      // 1. Initial Upload Intent (Server determines primary provider)
      const intentRes = await fetch('/api/media-upload-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          conversationId,
          mediaType,
          mimeType: cleanMimeType,
          fileSizeBytes: uploadFile.size,
          durationMs
        })
      });

      const primaryIntent = await intentRes.json().catch(() => ({}));
      if (!intentRes.ok || !primaryIntent.uploadUrl || !primaryIntent.intentId) {
        throw new Error(primaryIntent.error || 'Upload authorization failed');
      }

      // 2. Direct upload to primary target
      try {
        await uploadAndFinalizeTarget(primaryIntent);
      } catch (primaryErr: any) {
        console.warn('[MediaUpload] primary-attempt-failed', { intentId: primaryIntent.intentId, reason: primaryErr?.message });

        // 3. Single Controlled Server Fallback Retry
        const fallbackRes = await fetch('/api/media-upload-fallback-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ originalIntentId: primaryIntent.intentId })
        });

        const fallbackIntent = await fallbackRes.json().catch(() => ({}));
        if (!fallbackRes.ok || !fallbackIntent.uploadUrl || !fallbackIntent.intentId) {
          throw new Error(fallbackIntent.error || primaryErr?.message || 'Media upload failed. Please try again.');
        }

        console.info('[MediaUpload] executing-server-authorized-fallback', { fallbackProvider: fallbackIntent.provider });
        await uploadAndFinalizeTarget(fallbackIntent);
      }

      setSelectedMedia(null);
      setIsVoiceRecording(false);

    } catch (err: any) {
      console.error('[Media Send Flow Error]:', err);
      triggerToast('Media upload failed. Please try again.');
    } finally {
      setIsUploadingMedia(false);
    }
  };

  // 1. Authenticate user & load conversations
  const loadConversations = async (includeArchived = Boolean(conversationId)) => {
    setLoadingConvs(true);
    setConvsError(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        setCurrentUserId(null);
        setConvsError('Authentication required to access messages.');
        setLoadingConvs(false);
        return;
      }
      setCurrentUserId(user.id);

      const convList = await dbService.getMyConversations({ includeArchived });
      handleSetConversations(convList);
    } catch (err: any) {
      console.error('Error loading conversations:', err);
      setConvsError(err.message || 'Failed to load conversations.');
    } finally {
      setLoadingConvs(false);
    }
  };

  useEffect(() => {
    loadConversations(Boolean(conversationId));
  }, []);

  // 2. Load messages when conversationId changes
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    let isMounted = true;

    async function fetchMessages() {
      setLoadingMessages(true);
      setMessagesError(null);
      try {
        const msgs = await dbService.getConversationMessages(conversationId!);
        if (isMounted) {
          setMessages(msgs);
          // Mark conversation as read if active
          await dbService.markConversationRead(conversationId!);
          await unreadService.refresh(currentUserId);
          // Refresh conversation list to update unread badge counts
          const updatedConvs = await dbService.getMyConversations({ includeArchived: Boolean(conversationId) });
          if (isMounted) handleSetConversations(updatedConvs);
        }
      } catch (err: any) {
        console.error('Error fetching messages:', err);
        if (isMounted) setMessagesError(err.message || 'Failed to load messages.');
      } finally {
        if (isMounted) setLoadingMessages(false);
      }
    }

    fetchMessages();

    return () => {
      isMounted = false;
    };
  }, [conversationId]);

  // 3. Shared real-time subscriptions for messages and conversations
  useEffect(() => {
    if (!currentUserId) return;
    let isMounted = true;

    const refreshConversations = async () => {
      const updatedConvs = await dbService.getMyConversations({ includeArchived: Boolean(conversationId) });
      if (isMounted) handleSetConversations(updatedConvs);
    };

    const unsubscribeConversations = unreadService.subscribeConversationEvents(
      currentUserId,
      () => { void refreshConversations(); }
    );

    const unsubscribeMessages = unreadService.subscribeMessageEvents(
      currentUserId,
      async (event) => {
        const message = event.new as DbMessage;
        if (conversationId && message.conversation_id === conversationId) {
          if (event.eventType === 'INSERT') {
            setMessages((prev) => {
              if (prev.some((item) => item.id === message.id)) return prev;
              return [...prev, message];
            });

            if (message.sender_id !== currentUserId) {
              await dbService.markConversationRead(conversationId);
              await unreadService.refresh(currentUserId);
            }
          } else if (event.eventType === 'UPDATE') {
            setMessages((prev) => prev.map((item) => item.id === message.id ? message : item));
          } else if (event.eventType === 'DELETE') {
            setMessages((prev) => prev.filter((item) => item.id !== message.id));
          }
        }

        await refreshConversations();
      }
    );

    return () => {
      isMounted = false;
      unsubscribeConversations();
      unsubscribeMessages();
    };
  }, [conversationId, currentUserId]);

  // 4. Auto-scroll to bottom of thread
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loadingMessages]);

  // 5. Send Text Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!conversationId || activeConv?.archivedAt || !chatInput.trim() || isSending) return;

    const textToSend = chatInput.trim();
    const tempId = `temp-${Date.now()}`;
    
    setPendingMessages(prev => [...prev, { id: tempId, text: textToSend, status: 'sending' }]);
    setChatInput('');
    setIsSending(true);

    try {
      const sentMsg = await dbService.sendTextMessage(conversationId, textToSend);
      if (sentMsg) {
        setPendingMessages(prev => prev.filter(m => m.id !== tempId));
        setMessages((prev) => {
          if (prev.some((m) => m.id === sentMsg.id)) return prev;
          return [...prev, sentMsg];
        });
        // Refresh conversations list to update preview
        const updatedConvs = await dbService.getMyConversations({ includeArchived: Boolean(conversationId) });
        handleSetConversations(updatedConvs);
      }
    } catch (err: any) {
      console.error('Failed to send message:', err);
      setPendingMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
      triggerToast(err.message || 'Failed to send message.');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const archiveStatus = useMemo(() => {
    if (!activeConv) return null;
    if (activeConv.archivedAt) {
      return { message: 'This work conversation has been archived.', remaining: null };
    }
    if (!activeConv.archiveScheduledAt) return null;

    const reason = activeConv.archiveReason === 'cancelled' ? 'cancelled' : 'completed';
    const remainingMs = new Date(activeConv.archiveScheduledAt).getTime() - Date.now();
    const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
    const remaining = remainingMs > 0
      ? remainingMinutes >= 60
        ? `${Math.floor(remainingMinutes / 60)}h remaining`
        : `${remainingMinutes}m remaining`
      : 'soon';

    return {
      message: reason === 'cancelled'
        ? 'Work cancelled. This conversation will be archived within 24 hours.'
        : 'Work completed. This conversation will be archived within 24 hours.',
      remaining
    };
  }, [activeConv]);

  const inboxConversations = useMemo(
    () => conversations.filter((conversation) => !conversation.archivedAt),
    [conversations]
  );

  const groupedConversations = useMemo(() => {
    const groupMap = new Map<string, ConversationGroup>();

    inboxConversations.forEach(c => {
      const pid = c.otherParticipantId;
      const actTime = c.lastMessageAt ? new Date(c.lastMessageAt).getTime() : (c.createdAt ? new Date(c.createdAt).getTime() : 0);
      
      if (!groupMap.has(pid)) {
        groupMap.set(pid, {
          participantId: pid,
          participantName: c.otherParticipantName || 'OpenComm User',
          participantAvatar: c.otherParticipantAvatar || null,
          conversations: [c],
          latestActivityTime: actTime,
          latestActivityFormatted: c.lastMessageTime || '',
          latestMessageText: c.lastMessageText || '',
          totalUnread: c.unreadCount || 0
        });
      } else {
        const g = groupMap.get(pid)!;
        g.conversations.push(c);
        g.totalUnread += (c.unreadCount || 0);
        if (actTime > g.latestActivityTime) {
          g.latestActivityTime = actTime;
          g.latestActivityFormatted = c.lastMessageTime || '';
          g.latestMessageText = c.lastMessageText || '';
        }
      }
    });

    const groups = Array.from(groupMap.values());
    groups.forEach(g => {
      g.conversations.sort((a, b) => {
        const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return timeB - timeA;
      });
    });

    groups.sort((a, b) => b.latestActivityTime - a.latestActivityTime);
    return groups;
  }, [inboxConversations]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groupedConversations;
    const query = searchQuery.toLowerCase();
    
    return groupedConversations.filter(g => {
      if (g.participantName.toLowerCase().includes(query)) return true;
      
      return g.conversations.some(c => {
        const titleMatch = c.otherParticipantTitle?.toLowerCase().includes(query);
        const typeLabel = c.conversationType === 'worker_direct' ? 'direct worker enquiry' : 'job application';
        return titleMatch || typeLabel.includes(query) || c.lastMessageText?.toLowerCase().includes(query);
      });
    });
  }, [groupedConversations, searchQuery]);

  return (
    <div 
      className={`w-full max-w-[1200px] mx-auto flex flex-col text-left ${
        conversationId 
          ? 'fixed inset-0 z-40 bg-white dark:bg-[#0B0F19] md:relative md:z-auto md:h-[calc(100dvh-120px)] md:p-4' 
          : 'h-[calc(100dvh-120px)] p-0 md:p-4'
      }`}
      style={{ paddingBottom: conversationId ? 'env(safe-area-inset-bottom)' : undefined }}
    >

      {/* Main Container Card */}
      <div className="flex-1 bg-white dark:bg-[#0B0F19] md:border border-slate-200 dark:border-slate-800 md:rounded-[24px] overflow-hidden shadow-sm flex flex-col md:flex-row relative h-full min-h-0">
        
        {/* ================= LEFT PANE: INBOX LIST ================= */}
        <div className={`w-full md:w-[340px] lg:w-[380px] border-r border-slate-200 dark:border-slate-800/80 flex flex-col min-h-0 overflow-hidden shrink-0 bg-slate-50/50 dark:bg-[#080C14] ${
          conversationId ? 'hidden md:flex' : 'flex'
        }`}>
          
          {/* Inbox List Header */}
          <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-800/80 flex flex-col gap-2 shrink-0 bg-slate-50/70 dark:bg-[#080C14]">
            <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Messages
            </span>
            <button
              onClick={() => setIsSearchOpen(prev => !prev)}
              className={`p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
                isSearchOpen ? 'bg-slate-200 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400' : ''
              }`}
              title={isSearchOpen ? 'Close Search' : 'Search conversations'}
            >
              {isSearchOpen ? <X className="w-3.5 h-3.5" /> : <Search className="w-3.5 h-3.5" />}
            </button>
          </div>

            {/* Compact Animated Search Field */}
            <AnimatePresence>
              {isSearchOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden pt-1"
                >
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-3.5 w-3.5 text-slate-400" />
                    </div>
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search participant or job..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="block w-full pl-8 pr-8 py-1.5 border border-slate-200 dark:border-slate-700/80 rounded-xl bg-white dark:bg-[#111827] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-medium transition-all shadow-xs"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Conversations Scroll Area */}
          <div className="flex-1 min-h-0 overflow-y-auto touch-pan-y pb-24 md:pb-4 divide-y divide-slate-100 dark:divide-slate-800/50">
            {loadingConvs ? (
              <div className="p-4 space-y-4 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
                      <div className="h-3 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : convsError ? (
              <div className="p-6 text-center space-y-3">
                <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{convsError}</p>
                <button
                  onClick={() => loadConversations(Boolean(conversationId))}
                  className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg"
                >
                  Retry
                </button>
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="p-8 text-center space-y-3 my-auto">
                <Search className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No conversations found</h4>
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center space-y-3 my-auto">
                <MessageSquare className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No conversations yet</h4>
                <p className="text-xs text-slate-400 leading-relaxed max-w-[240px] mx-auto">
                  Apply for a job or contact a worker to start a conversation.
                </p>
                <div className="flex gap-2 justify-center pt-2">
                  <button onClick={() => navigate('/jobs')} className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-lg transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-500/20">Find Jobs</button>
                  <button onClick={() => navigate('/workers')} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg transition-colors hover:bg-slate-200 dark:hover:bg-slate-700">Browse Workers</button>
                </div>
              </div>
            ) : (
              filteredGroups.map((group) => {
                const isActive = group.conversations.some(c => c.id === conversationId);
                const isUnread = group.totalUnread > 0;
                const isMulti = group.conversations.length > 1;

                return (
                  <div
                    key={group.participantId}
                    onClick={() => {
                      if (isMulti) {
                        setSelectedParticipantGroup(group);
                      } else {
                        navigate(`/messages/${group.conversations[0].id}`);
                      }
                    }}
                    className={`p-3.5 sm:p-4 flex items-start gap-3 transition-all cursor-pointer relative border-l-4 ${
                      isActive
                        ? 'bg-indigo-50/80 dark:bg-indigo-500/10 border-indigo-600 dark:border-indigo-400 shadow-xs'
                        : 'border-transparent hover:bg-slate-100/70 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <UserAvatar
                      avatarUrl={group.participantAvatar}
                      fullName={group.participantName}
                      size="md"
                      className="shrink-0 mt-0.5 shadow-xs"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1 gap-1">
                        <h4 className={`text-xs sm:text-sm truncate ${isUnread ? 'font-black text-slate-900 dark:text-white' : 'font-bold text-slate-800 dark:text-slate-200'}`}>
                          {group.participantName}
                        </h4>
                        <span className={`text-[10px] shrink-0 ${isUnread ? 'font-bold text-indigo-600 dark:text-indigo-400' : 'font-semibold text-slate-400'}`}>
                          {group.latestActivityFormatted}
                        </span>
                      </div>
                      
                      {isMulti ? (
                        <p className="text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400 truncate mb-1">
                          {group.conversations.length} conversations
                        </p>
                      ) : (
                        <p 
                          className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate mb-1 max-w-[200px]" 
                          title={group.conversations[0].otherParticipantTitle || (group.conversations[0].conversationType === 'worker_direct' ? 'Direct Worker Enquiry' : 'Job Application')}
                        >
                          {group.conversations[0].otherParticipantTitle || (group.conversations[0].conversationType === 'worker_direct' ? 'Direct Worker Enquiry' : 'Job Application')}
                        </p>
                      )}
                      
                      <p className={`text-xs truncate ${isUnread ? 'font-bold text-slate-900 dark:text-slate-100' : 'font-medium text-slate-500 dark:text-slate-400'}`}>
                        {group.latestMessageText === 'No messages yet' ? 'Start the conversation' : group.latestMessageText}
                      </p>
                    </div>

                    {group.totalUnread > 0 && (
                      <span className="shrink-0 px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-black shadow-xs">
                        {group.totalUnread}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ================= RIGHT PANE: CHAT THREAD ================= */}
        <div className={`flex-1 flex flex-col h-full min-h-0 bg-white dark:bg-[#0B0F19] overflow-hidden ${
          !conversationId ? 'hidden md:flex' : 'flex'
        }`}>
          
          {conversationId && activeConv ? (
            <>
              {/* Thread Header - Fixed at Top */}
              <div className="px-3.5 py-3 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between bg-white dark:bg-[#0B0F19] shrink-0 z-10">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => navigate('/messages')}
                    className="md:hidden p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    title="Back to inbox"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <UserAvatar
                    avatarUrl={activeConv.otherParticipantAvatar}
                    fullName={activeConv.otherParticipantName}
                    size="md"
                    className="shrink-0"
                  />
                  <div className="min-w-0">
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate leading-tight">
                      {activeConv.otherParticipantName}
                    </h3>
                    <p 
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 truncate max-w-[300px]"
                      title={activeConv.otherParticipantTitle || (activeConv.conversationType === 'worker_direct' ? 'Direct Worker Enquiry' : 'Job Application')}
                    >
                      {activeConv.otherParticipantTitle || (activeConv.conversationType === 'worker_direct' ? 'Direct Worker Enquiry' : 'Job Application')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Work Contract Banner */}
              {activeConv?.workContractId && (
                <div className="shrink-0">
                  <WorkContractBanner contractId={activeConv.workContractId} />
                </div>
              )}

              {/* Safety Banner */}
              <div className="px-4 py-1.5 bg-slate-50 dark:bg-[#0E1320] border-b border-slate-100 dark:border-slate-800/60 text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center justify-center gap-1.5 shrink-0">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Keep communication professional and never share sensitive payment details.</span>
              </div>

              {archiveStatus && (
                <div className={`px-4 py-2 border-b text-[11px] font-semibold flex items-center justify-center gap-2 shrink-0 ${
                  activeConv.archivedAt
                    ? 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                    : 'bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/50 text-amber-700 dark:text-amber-300'
                }`}>
                  <span>{archiveStatus.message}</span>
                  {archiveStatus.remaining && <span className="font-bold whitespace-nowrap">({archiveStatus.remaining})</span>}
                </div>
              )}

              {/* Messages Thread Content - Only this section scrolls */}
              <div className="flex-1 min-h-0 p-3 sm:p-4 overflow-y-auto space-y-3 bg-slate-50/30 dark:bg-[#070A12]/30 touch-pan-y overscroll-contain">
                {loadingMessages ? (
                  <div className="p-8 space-y-4 animate-pulse">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                        <div className="h-12 w-64 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
                      </div>
                    ))}
                  </div>
                ) : messagesError ? (
                  <div className="p-6 text-center space-y-2">
                    <AlertCircle className="w-6 h-6 text-rose-500 mx-auto" />
                    <p className="text-xs text-rose-500 font-semibold">{messagesError}</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-xs font-medium">
                    No messages yet. Send a message to start the conversation!
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.sender_id === currentUserId;
                    const sentTime = msg.created_at
                      ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '';
                    const isRead = Boolean(msg.read_at) || msg.unread === false;

                    return (
                      <div
                        key={msg.id}
                        className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}
                      >
                        {!isMe && (
                          <UserAvatar
                            avatarUrl={msg.sender_avatar || activeConv.otherParticipantAvatar}
                            fullName={msg.sender_name}
                            size="sm"
                            className="shrink-0 mb-1"
                          />
                        )}
                        <div className={`max-w-[85%] sm:max-w-[70%] space-y-1 ${isMe ? 'items-end' : 'items-start'}`}>
                          {msg.message_type && msg.message_type !== 'text' ? (
                            <MediaMessage messageId={msg.id} mediaType={msg.message_type} isSelf={isMe} />
                          ) : (
                            <div
                              title={isMe ? (isRead ? 'Read' : 'Sent, not read') : undefined}
                              aria-label={isMe ? (isRead ? 'Read' : 'Sent, not read') : undefined}
                              className={`p-3 rounded-2xl text-xs font-medium leading-relaxed whitespace-pre-wrap break-words text-left transition-colors duration-300 ${
                                isMe
                                  ? isRead
                                    ? 'bg-blue-600 text-white rounded-br-xs shadow-xs'
                                    : 'bg-slate-600 text-white rounded-br-xs shadow-xs'
                                  : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700/60 rounded-bl-xs shadow-xs'
                              }`}
                            >
                              {msg.text}
                            </div>
                          )}
                          <div className={`flex items-center gap-1 text-[10px] font-semibold text-slate-400 ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <span>{sentTime}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                
                {/* Pending Messages Optimistic UI */}
                {pendingMessages.map((pMsg) => (
                  <div key={pMsg.id} className="flex items-end gap-2 justify-end">
                    <div className="max-w-[85%] sm:max-w-[70%] space-y-1 items-end relative">
                      <div className="flex items-center justify-end gap-2">
                        {pMsg.status === 'failed' && (
                          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" title="Failed to send" />
                        )}
                        <div
                          className={`p-3 rounded-2xl text-xs font-medium leading-relaxed whitespace-pre-wrap break-words text-left bg-slate-600 text-white rounded-br-xs shadow-xs transition-opacity duration-300 ${
                            pMsg.status === 'sending' ? 'opacity-70' : ''
                          }`}
                        >
                          {pMsg.text}
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-1 text-[10px] font-semibold text-slate-400">
                        {pMsg.status === 'sending' ? (
                          <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Sending...</span>
                        ) : (
                          <span className="text-rose-500">Failed</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                <div ref={messagesEndRef} />
              </div>

              {/* Redesigned Compact Composer with Media Support */}
              {activeConv.archivedAt ? (
                <div className="p-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-[#0E1320] text-center text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                  This work conversation has been archived.
                </div>
              ) : isVoiceRecording ? (
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
              ) : selectedMedia ? (
                <div className="p-3 border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0B0F19] shrink-0 flex items-center justify-between gap-3 animate-fade-in">
                  <div className="flex items-center space-x-3 min-w-0">
                    {selectedMedia.mediaType === 'image' ? (
                      <img src={selectedMedia.previewUrl} alt="Preview" className="w-12 h-12 object-cover rounded-xl border border-slate-200 dark:border-slate-700" />
                    ) : (
                      <div className="w-12 h-12 bg-indigo-900/40 text-indigo-400 rounded-xl flex items-center justify-center border border-indigo-700/50">
                        <VideoIcon className="w-6 h-6" />
                      </div>
                    )}
                    <div className="flex flex-col text-left truncate">
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">{selectedMedia.file.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{(selectedMedia.file.size / (1024 * 1024)).toFixed(2)} MB</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        URL.revokeObjectURL(selectedMedia.previewUrl);
                        setSelectedMedia(null);
                      }}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={isUploadingMedia}
                      onClick={() => {
                        void handleUploadAndSendMedia(
                          selectedMedia.file,
                          selectedMedia.mediaType,
                          selectedMedia.durationMs,
                          selectedMedia.width,
                          selectedMedia.height
                        );
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white rounded-xl text-xs font-extrabold flex items-center space-x-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isUploadingMedia ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Send</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSendMessage} className="p-2 sm:p-3 border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0B0F19] shrink-0">
                  <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-full px-3 py-1.5 focus-within:border-blue-500 transition-colors">
                    {/* Media Attachment Picker Button */}
                    <MediaAttachmentPicker
                      onFileSelected={(file, mediaType, previewUrl, durationMs, width, height) => {
                        if (!mediaStatus.mediaMessagingEnabled) {
                          triggerToast('Media messaging is temporarily unavailable.');
                          return;
                        }
                        setSelectedMedia({ file, mediaType, previewUrl, durationMs, width, height });
                      }}
                      disabled={!mediaStatus.mediaMessagingEnabled || isSending}
                    />

                    {/* Microphone Voice Recorder Button */}
                    <button
                      type="button"
                      disabled={!mediaStatus.mediaMessagingEnabled || isSending}
                      onClick={() => {
                        if (!mediaStatus.mediaMessagingEnabled) {
                          triggerToast('Media messaging is temporarily unavailable.');
                          return;
                        }
                        setIsVoiceRecording(true);
                      }}
                      title={mediaStatus.mediaMessagingEnabled ? 'Record Voice Note' : 'Media messaging is temporarily unavailable.'}
                      aria-label="Record Voice Note"
                      className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer disabled:opacity-40"
                    >
                      <Mic className="w-5 h-5" />
                    </button>

                    <textarea
                      ref={textareaRef}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      maxLength={4000}
                      rows={1}
                      placeholder="Type a message..."
                      className="flex-1 max-h-[100px] min-h-[36px] bg-transparent text-slate-900 dark:text-white text-xs sm:text-sm font-medium focus:outline-none resize-none px-1 py-2 leading-snug"
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim() || isSending}
                      className={`h-9 w-9 rounded-full text-white font-bold text-xs flex items-center justify-center transition-all shrink-0 ${
                        !chatInput.trim() || isSending
                          ? 'bg-slate-300 dark:bg-slate-800 cursor-not-allowed text-slate-500'
                          : 'bg-blue-600 hover:bg-blue-500 cursor-pointer shadow-xs active:scale-95'
                      }`}
                      title="Send Message"
                    >
                      {isSending ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4 ml-0.5" />
                      )}
                    </button>
                  </div>
                </form>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3 text-slate-400">
              <MessageSquare className="w-12 h-12 text-slate-300 dark:text-slate-700" />
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">Select a conversation</h3>
              <p className="text-xs max-w-sm leading-relaxed">
                Choose a conversation from the left menu or message an employer/applicant to start chatting.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* Context Picker Modal */}
      <AnimatePresence>
        {selectedParticipantGroup && (
          <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
              onClick={() => setSelectedParticipantGroup(null)}
            />
            <motion.div
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-md bg-white dark:bg-[#0B0F19] rounded-[32px] md:rounded-[24px] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-4 md:p-5 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <UserAvatar
                    avatarUrl={selectedParticipantGroup.participantAvatar}
                    fullName={selectedParticipantGroup.participantName}
                    size="sm"
                  />
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">Select context</h3>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {selectedParticipantGroup.conversations.length} conversations with {selectedParticipantGroup.participantName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedParticipantGroup(null)}
                  className="p-2 -mr-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain p-2">
                <div className="space-y-1">
                  {selectedParticipantGroup.conversations.map(conv => {
                    const isUnread = conv.unreadCount > 0;
                    return (
                      <button
                        key={conv.id}
                        onClick={() => {
                          setSelectedParticipantGroup(null);
                          navigate(`/messages/${conv.id}`);
                        }}
                        className="w-full text-left p-3.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group flex flex-col gap-1 border border-slate-100 dark:border-slate-800/60"
                      >
                        <div className="flex items-center justify-between w-full gap-2">
                          <span 
                            className="text-xs font-black text-slate-900 dark:text-white truncate flex-1"
                            title={conv.otherParticipantTitle || (conv.conversationType === 'worker_direct' ? 'Direct Worker Enquiry' : 'Job Application')}
                          >
                            {conv.otherParticipantTitle || (conv.conversationType === 'worker_direct' ? 'Direct Worker Enquiry' : 'Job Application')}
                          </span>
                          <span className={`text-[10px] ${isUnread ? 'font-bold text-blue-600 dark:text-blue-400' : 'font-semibold text-slate-400'}`}>
                            {conv.lastMessageTime}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                          {conv.conversationType === 'worker_direct' ? 'Direct Hire Enquiry' : 'Job Application'}
                        </span>
                        <div className="flex items-center justify-between w-full pt-0.5">
                          <span className={`text-xs truncate pr-4 ${isUnread ? 'font-bold text-slate-800 dark:text-slate-200' : 'font-medium text-slate-500 dark:text-slate-400'}`}>
                            {conv.lastMessageText === 'No messages yet' ? 'Start the conversation' : conv.lastMessageText}
                          </span>
                          {isUnread && (
                            <span className="shrink-0 px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-extrabold shadow-xs">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
