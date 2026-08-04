import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, Send, ArrowLeft, ShieldAlert, 
  RefreshCw, AlertCircle, Search, X, Loader2, AlertTriangle
} from 'lucide-react';
import { supabase, dbService } from '../../lib/supabase';
import { ConversationViewModel, DbMessage } from '../../types';
import UserAvatar from '../common/UserAvatar';
import WorkContractBanner from '../contracts/WorkContractBanner';

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
  onUnreadMessagesChanged?: () => void;
}

export default function MessagesPage({ triggerToast, onUnreadMessagesChanged }: MessagesPageProps) {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationViewModel[]>([]);
  
  const handleSetConversations = (convList: ConversationViewModel[]) => {
    // Deduplicate exact duplicates by ID (keep latest which is the nature of Map overwriting)
    const uniqueConversations = Array.from(
      new Map(convList.map(c => [c.id, c])).values()
    );

    // Detect and log exact context duplicate DB rows
    const contextMap = new Map<string, string[]>();
    for (const c of uniqueConversations) {
      const key = `${c.otherParticipantId}-${c.conversationType}-${c.applicationId || 'null'}`;
      const existing = contextMap.get(key) || [];
      existing.push(c.id);
      contextMap.set(key, existing);
    }
    const duplicateContexts = Array.from(contextMap.entries()).filter(([_, ids]) => ids.length > 1);
    if (duplicateContexts.length > 0) {
      console.warn('[Messages] Exact duplicate contexts found for review (IDs):', duplicateContexts);
    }

    setConversations(uniqueConversations);
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

  // 1. Authenticate user & load conversations
  const loadConversations = async () => {
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

      const convList = await dbService.getMyConversations();
      handleSetConversations(convList);
    } catch (err: any) {
      console.error('Error loading conversations:', err);
      setConvsError(err.message || 'Failed to load conversations.');
    } finally {
      setLoadingConvs(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  // Active conversation selection
  const activeConv = conversations.find(c => c.id === conversationId);

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
          const markedRead = await dbService.markConversationRead(conversationId!);
          if (markedRead) onUnreadMessagesChanged?.();
          // Refresh conversation list to update unread badge counts
          const updatedConvs = await dbService.getMyConversations();
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

  // 3. Real-time Subscriptions for messages and conversations
  useEffect(() => {
    if (!supabase) return;

    // Realtime channel for inbox conversation updates
    const convsChannel = supabase
      .channel('public:conversations:realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        async () => {
          const updatedConvs = await dbService.getMyConversations();
          handleSetConversations(updatedConvs);
        }
      )
      .subscribe();

    let messagesChannel: any = null;
    if (conversationId) {
      messagesChannel = supabase
        .channel(`public:messages:conv=${conversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`
          },
          async (payload: any) => {
            const newMsg = payload.new as DbMessage;
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });

            // Mark read if sent by recipient
            if (currentUserId && newMsg.sender_id !== currentUserId) {
              const markedRead = await dbService.markConversationRead(conversationId);
              if (markedRead) onUnreadMessagesChanged?.();
            }

            // Refresh conversations preview
            const updatedConvs = await dbService.getMyConversations();
            handleSetConversations(updatedConvs);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`
          },
          (payload: any) => {
            const updatedMsg = payload.new as DbMessage;
            setMessages((prev) => prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m)));
          }
        )
        .subscribe();
    }

    return () => {
      if (convsChannel) supabase.removeChannel(convsChannel);
      if (messagesChannel) supabase.removeChannel(messagesChannel);
    };
  }, [conversationId, currentUserId]);

  // 4. Auto-scroll to bottom of thread
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loadingMessages]);

  // 5. Send Text Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!conversationId || !chatInput.trim() || isSending) return;

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
        const updatedConvs = await dbService.getMyConversations();
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

  const groupedConversations = useMemo(() => {
    const groupMap = new Map<string, ConversationGroup>();

    conversations.forEach(c => {
      const pid = c.otherParticipantId;
      const actTime = c.createdAt ? new Date(c.createdAt).getTime() : 0;
      
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
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
    });

    groups.sort((a, b) => b.latestActivityTime - a.latestActivityTime);
    return groups;
  }, [conversations]);

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
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y pb-4 divide-y divide-slate-100 dark:divide-slate-800/50">
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
                  onClick={loadConversations}
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
                          {group.conversations.map(c => c.otherParticipantTitle || (c.conversationType === 'worker_direct' ? 'Direct Worker Enquiry' : 'Job Application')).join(' • ')}
                        </p>
                      ) : (
                        <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate mb-1">
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
                    <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 truncate">
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

              {/* Redesigned Compact Composer - Fixed at Bottom */}
              <form onSubmit={handleSendMessage} className="p-2 sm:p-3 border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0B0F19] shrink-0">
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-full px-3 py-1.5 focus-within:border-blue-500 transition-colors">
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
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-black text-slate-900 dark:text-white truncate">
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
