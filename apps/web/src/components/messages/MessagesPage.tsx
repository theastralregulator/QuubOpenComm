import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, Send, ArrowLeft, ShieldAlert, CheckCircle2, 
  RefreshCw, AlertCircle, Search, X
} from 'lucide-react';
import { supabase, dbService } from '../../lib/supabase';
import { ConversationViewModel, DbMessage } from '../../types';
import UserAvatar from '../common/UserAvatar';

interface MessagesPageProps {
  triggerToast: (msg: string) => void;
}

export default function MessagesPage({ triggerToast }: MessagesPageProps) {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationViewModel[]>([]);
  const [loadingConvs, setLoadingConvs] = useState<boolean>(true);
  const [convsError, setConvsError] = useState<string | null>(null);

  const [messages, setMessages] = useState<DbMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  const [chatInput, setChatInput] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');

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
      setConversations(convList);
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
          await dbService.markConversationRead(conversationId!);
          // Refresh conversation list to update unread badge counts
          const updatedConvs = await dbService.getMyConversations();
          if (isMounted) setConversations(updatedConvs);
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
          setConversations(updatedConvs);
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
              await dbService.markConversationRead(conversationId);
            }

            // Refresh conversations preview
            const updatedConvs = await dbService.getMyConversations();
            setConversations(updatedConvs);
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
    setIsSending(true);

    try {
      const sentMsg = await dbService.sendTextMessage(conversationId, textToSend);
      if (sentMsg) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === sentMsg.id)) return prev;
          return [...prev, sentMsg];
        });
        setChatInput('');
        // Refresh conversations list to update preview
        const updatedConvs = await dbService.getMyConversations();
        setConversations(updatedConvs);
      }
    } catch (err: any) {
      console.error('Failed to send message:', err);
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

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const query = searchQuery.toLowerCase();
    return conversations.filter(c => {
      const nameMatch = c.otherParticipantName?.toLowerCase().includes(query);
      const titleMatch = c.otherParticipantTitle?.toLowerCase().includes(query);
      const typeLabel = c.conversationType === 'worker_direct' ? 'direct worker enquiry' : 'job application';
      const typeMatch = typeLabel.includes(query);
      const textMatch = c.lastMessageText?.toLowerCase().includes(query);
      return nameMatch || titleMatch || typeMatch || textMatch;
    });
  }, [conversations, searchQuery]);

  return (
    <div 
      className="w-full max-w-[1200px] mx-auto min-h-0 overflow-hidden flex flex-col p-0 md:p-4 text-left"
      style={{ height: 'calc(100dvh - 120px)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Page Header */}
      <div className="flex items-center justify-between mb-3 px-2">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          <span>Messages</span>
        </h1>
        <button
          onClick={loadConversations}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Refresh Inbox"
        >
          <RefreshCw className={`w-4 h-4 ${loadingConvs ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Main Container Card */}
      <div className="flex-1 bg-white dark:bg-[#0B0F19] md:border border-slate-200 dark:border-slate-800 md:rounded-[24px] overflow-hidden shadow-sm flex flex-col md:flex-row relative h-full">
        
        {/* ================= LEFT PANE: INBOX LIST ================= */}
        <div className={`w-full md:w-[340px] lg:w-[380px] border-r border-slate-200 dark:border-slate-800/80 flex flex-col min-h-0 overflow-hidden shrink-0 bg-slate-50/50 dark:bg-[#080C14] ${
          conversationId ? 'hidden md:flex' : 'flex'
        }`}>
          
          {/* Inbox List Header */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800/80 flex flex-col gap-3 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Conversations</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {filteredConversations.length}
              </span>
            </div>
            
            {/* Search Bar */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-9 pr-8 py-2 border border-slate-200 dark:border-slate-700 rounded-xl leading-5 bg-white dark:bg-[#111827] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all shadow-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
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
            ) : filteredConversations.length === 0 ? (
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
              filteredConversations.map((conv) => {
                const isActive = conv.id === conversationId;
                const isUnread = conv.unreadCount > 0;
                return (
                  <div
                    key={conv.id}
                    onClick={() => navigate(`/messages/${conv.id}`)}
                    className={`p-4 flex items-start gap-3 transition-colors cursor-pointer relative border-l-4 ${
                      isActive
                        ? 'bg-indigo-50/70 dark:bg-indigo-500/10 border-indigo-600 dark:border-indigo-400'
                        : 'border-transparent hover:bg-slate-100/60 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <UserAvatar
                      avatarUrl={conv.otherParticipantAvatar}
                      fullName={conv.otherParticipantName}
                      size="md"
                      className="shrink-0 mt-0.5 shadow-sm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className={`text-sm truncate ${isUnread ? 'font-black text-slate-900 dark:text-white' : 'font-bold text-slate-900 dark:text-white'}`}>
                          {conv.otherParticipantName}
                        </h4>
                        <span className={`text-[10px] shrink-0 ml-2 ${isUnread ? 'font-bold text-blue-600 dark:text-blue-400' : 'font-semibold text-slate-400'}`}>
                          {conv.lastMessageTime}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 truncate mb-1">
                        {conv.conversationType === 'worker_direct' 
                          ? `Direct Worker Enquiry${conv.otherParticipantTitle ? ` · ${conv.otherParticipantTitle}` : ''}` 
                          : `Job Application${conv.otherParticipantTitle && conv.otherParticipantTitle !== 'Job Opportunity' ? ` · ${conv.otherParticipantTitle}` : ''}`}
                      </p>
                      <p className={`text-xs truncate ${isUnread ? 'font-bold text-slate-800 dark:text-slate-200' : 'font-medium text-slate-500 dark:text-slate-400'}`}>
                        {conv.lastMessageText === 'No messages yet' ? 'Start the conversation' : conv.lastMessageText}
                      </p>
                    </div>

                    {conv.unreadCount > 0 && (
                      <span className="shrink-0 px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-extrabold shadow-sm">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ================= RIGHT PANE: CHAT THREAD ================= */}
        <div className={`flex-1 flex flex-col bg-white dark:bg-[#0B0F19] ${
          !conversationId ? 'hidden md:flex' : 'flex'
        }`}>
          
          {conversationId && activeConv ? (
            <>
              {/* Thread Header */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between bg-white/80 dark:bg-[#0B0F19]/80 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => navigate('/messages')}
                    className="md:hidden p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
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
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate leading-tight">
                      {activeConv.otherParticipantName}
                    </h3>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5">
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                        {activeConv.conversationType === 'worker_direct' ? 'Direct Worker Enquiry' : 'Job Application'}
                      </span>
                      {activeConv.otherParticipantTitle && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                          <span>{activeConv.otherParticipantTitle}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Safety Banner */}
              <div className="px-4 py-2 bg-slate-50 dark:bg-[#0E1320] border-b border-slate-100 dark:border-slate-800/60 text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center justify-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Keep communication professional and never share sensitive payment details.</span>
              </div>

              {/* Messages Thread Content */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/30 dark:bg-[#070A12]/30">
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
                            className={`p-3.5 rounded-[18px] text-xs font-medium leading-relaxed whitespace-pre-wrap break-words text-left ${
                              isMe
                                ? 'bg-blue-600 text-white rounded-br-xs shadow-sm'
                                : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700/60 rounded-bl-xs shadow-xs'
                            }`}
                          >
                            {msg.text}
                          </div>
                          <div className={`flex items-center gap-1 text-[10px] font-semibold text-slate-400 ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <span>{sentTime}</span>
                            {isMe && (
                              <span className="shrink-0">
                                {msg.read_at || msg.unread === false ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-[#38bdf8] fill-[#38bdf8]/20" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer */}
              <form onSubmit={handleSendMessage} className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0B0F19] shrink-0 safe-area-bottom">
                <div className="flex items-end gap-2 bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-2 focus-within:border-blue-500 transition-colors">
                  <textarea
                    ref={textareaRef}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    maxLength={4000}
                    placeholder="Write a message... (Press Enter to send, Shift+Enter for new line)"
                    className="flex-1 max-h-[120px] min-h-[48px] bg-transparent text-slate-900 dark:text-white text-sm font-medium focus:outline-none resize-none px-2 py-3"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || isSending}
                    className={`h-12 w-12 rounded-xl text-white font-bold text-xs flex items-center justify-center transition-all shrink-0 mb-0.5 ${
                      !chatInput.trim() || isSending
                        ? 'bg-slate-300 dark:bg-slate-800 cursor-not-allowed text-slate-500'
                        : 'bg-blue-600 hover:bg-blue-500 cursor-pointer shadow-sm'
                    }`}
                  >
                    {isSending ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5 ml-0.5" />
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
    </div>
  );
}
