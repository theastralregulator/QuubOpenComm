import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Send, MessageSquare, Check, X, ShieldAlert, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Message, Conversation } from '../../types';
import { analytics } from '../../lib/analytics';
import UserAvatar from '../common/UserAvatar';

interface MessagesPageProps {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  conversations: Conversation[];
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  username: string;
  userPhoto: string;
  triggerToast: (msg: string) => void;
}

export default function MessagesPage({
  messages,
  setMessages,
  conversations,
  setConversations,
  username,
  userPhoto,
  triggerToast,
}: MessagesPageProps) {
  const { conversationId } = useParams();
  const navigate = useNavigate();

  // Select active conversation ID
  const [activeConversationId, setActiveConversationId] = useState<string>('');
  const [chatInput, setChatInput] = useState('');
  const [isTypingReply, setIsTypingReply] = useState(false);
  const [mobileActiveThreadOpen, setMobileActiveThreadOpen] = useState(false); // Mobile drill-down
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fallback to first conversation if active conversation is not set
  const activeConv = conversations.find(c => c.id === activeConversationId) || conversations[0];
  const activeContact = activeConv?.memberName || 'Sarah Jenkins';

  // Initialize and sync activeConversationId with URL route param
  useEffect(() => {
    if (conversationId) {
      setActiveConversationId(conversationId);
      setMobileActiveThreadOpen(true);
    } else if (conversations.length > 0 && !activeConversationId) {
      setActiveConversationId(conversations[0].id);
    }
  }, [conversationId, conversations, activeConversationId]);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeConversationId, isTypingReply]);

  // Filter messages for currently chosen conversation
  const activeChatMessages = messages.filter(m => m.conversationId === activeConv?.id);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeConv) return;

    const currentConvId = activeConv.id;
    const sentText = chatInput;

    const userMsg: Message = {
      id: `msg-sent-${Date.now()}`,
      conversationId: currentConvId,
      senderName: username,
      senderAvatar: userPhoto,
      text: sentText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      unread: false,
      role: 'user'
    };

    // Append message
    setMessages(prev => [...prev, userMsg]);
    setChatInput('');

    // Update conversation metadata
    setConversations(prev => prev.map(c => {
      if (c.id === currentConvId) {
        return {
          ...c,
          lastMessageText: sentText,
          lastMessageTime: 'Just now',
          unreadCount: 0
        };
      }
      return c;
    }));

    setIsTypingReply(true);

    // Simulate direct contact response
    setTimeout(() => {
      let replyText = "Perfect, thank you! I am reviewing your scope details and will send a formal proposal by tomorrow morning.";
      if (activeContact === 'Sarah Jenkins') {
        replyText = "Hey Akhil! Yes, I reviewed your project posting. My experience in Figma & Framer matches this perfectly. Let's align on a short call tomorrow?";
      } else if (activeContact === 'David Chen') {
        replyText = "Excellent choice of tech stack! I am fully available to consult on your responsive Next.js/React layout adjustments. Let me know when you are free!";
      } else if (activeContact === 'Marcus Thorne') {
        replyText = "Safety diagnostics are critical. I have my certifications up to date and can stop by the Austin commercial site this Saturday.";
      } else if (activeContact === 'Carlos Mendez') {
        replyText = "Custom oak inlays are my specialty. I will draft a quick structural blueprint and send it over here shortly.";
      }

      const replyMsg: Message = {
        id: `msg-recv-${Date.now()}`,
        conversationId: currentConvId,
        senderName: activeContact,
        senderAvatar: activeConv.memberAvatar,
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        unread: false,
        role: 'assistant'
      };

      setMessages(prev => [...prev, replyMsg]);
      setIsTypingReply(false);

      setConversations(prev => prev.map(c => {
        if (c.id === currentConvId) {
          return {
            ...c,
            lastMessageText: replyText,
            lastMessageTime: 'Just now'
          };
        }
        return c;
      }));

      triggerToast(`New message from ${activeContact}!`);
    }, 1500);
  };

  const selectConversation = (id: string) => {
    navigate(`/messages/${id}`);
    
    // Track chat opened
    const selectedConv = conversations.find(c => c.id === id);
    if (selectedConv) {
      analytics.trackChatOpened(selectedConv.memberName);
    }
    
    // Clear unread count
    setConversations(prev => prev.map(c => {
      if (c.id === id) {
        return { ...c, unreadCount: 0 };
      }
      return c;
    }));
  };

  return (
    <div className="w-full text-left max-w-6xl mx-auto" id="messages-page-view">
      
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white flex items-center">
          <MessageSquare className="w-7 h-7 mr-2.5 text-emerald-500" />
          Messages Inbox
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Coordinate directly with contractors, discuss project requirements, and lock milestones.
        </p>
      </div>

      {/* CHAT INTERFACE WINDOW */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#273449] rounded-2xl overflow-hidden shadow-sm h-[580px] flex">
        
        {/* LEFT PANEL: CONTACTS THREADS (Hidden on mobile if conversation is maximized) */}
        <div className={`w-full md:w-80 shrink-0 border-r border-slate-200 dark:border-[#273449] flex flex-col h-full bg-slate-50/30 dark:bg-slate-900/10 ${
          mobileActiveThreadOpen ? 'hidden md:flex' : 'flex'
        }`}>
          <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/60 font-semibold text-xs tracking-wider uppercase text-slate-400 dark:text-slate-500 font-mono">
            Conversations
          </div>
          
          <div className="overflow-y-auto flex-1 divide-y divide-slate-100 dark:divide-slate-800/40">
            {conversations.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-8 italic font-semibold">No active approved message threads.</p>
            ) : (
              conversations.map((conv) => {
                const isSelected = activeConv?.id === conv.id;
                
                return (
                  <div
                    key={conv.id}
                    onClick={() => selectConversation(conv.id)}
                    className={`p-4 transition-all flex items-center space-x-3.5 cursor-pointer text-left relative ${
                      isSelected 
                        ? 'bg-blue-50/60 dark:bg-blue-950/20 border-l-4 border-blue-600' 
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <UserAvatar
                      avatarUrl={conv.memberAvatar}
                      fullName={conv.memberName}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">{conv.memberName}</span>
                        <span className="text-[9px] text-slate-400 shrink-0 font-mono">
                          {conv.lastMessageTime}
                        </span>
                      </div>
                      <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 font-mono uppercase truncate leading-none mb-1">
                        {conv.memberTitle}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-medium">
                        {conv.lastMessageText}
                      </p>
                    </div>

                    {conv.unreadCount > 0 && (
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 bg-blue-600 text-[9px] text-white font-black flex items-center justify-center rounded-full">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT PANEL: CONVERSATION CONTENT (Hidden on mobile if looking at inbox list) */}
        <div className={`flex-1 flex flex-col h-full bg-white dark:bg-[#111827] ${
          !mobileActiveThreadOpen ? 'hidden md:flex' : 'flex'
        }`}>
          {activeConv ? (
            <>
              {/* Conversation Header */}
              <div className="px-4 py-3 border-b border-slate-200 dark:border-[#273449] flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center space-x-3 text-left">
                  {/* Back Button for mobile */}
                  <button 
                    onClick={() => setMobileActiveThreadOpen(false)}
                    className="md:hidden p-1.5 -ml-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0 cursor-pointer"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  <UserAvatar
                    avatarUrl={activeConv.memberAvatar}
                    fullName={activeContact}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <span className="block font-bold text-sm text-slate-900 dark:text-white truncate">{activeContact}</span>
                    <span className="block text-[10px] font-bold text-indigo-600 dark:text-indigo-400 font-mono uppercase truncate leading-none mt-0.5">
                      {activeConv.memberTitle}
                    </span>
                  </div>
                </div>

                {/* Escrow badge */}
                <div className="hidden lg:flex items-center space-x-1.5 px-3 py-1 bg-emerald-500/5 border border-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold rounded-lg uppercase tracking-wide font-mono shrink-0">
                  <Check className="w-3 h-3" />
                  <span>Escrow Protected</span>
                </div>
              </div>

              {/* Messages Stream */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/20 dark:bg-slate-900/10">
                <div className="p-3 bg-blue-500/5 border border-blue-500/10 text-[11px] text-blue-600 dark:text-blue-400 rounded-2xl max-w-lg mx-auto text-center leading-relaxed">
                  👋 <strong>Escrow Protected Thread:</strong> Your messages with {activeContact} are fully encrypted. Let's build something together!
                </div>

                {activeChatMessages.map((m) => {
                  const isMe = m.role === 'user';
                  return (
                    <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} text-left`}>
                      <div className="flex items-start space-x-2.5 max-w-[85%]">
                        {!isMe && (
                          <UserAvatar
                            avatarUrl={m.senderAvatar}
                            fullName={m.senderName}
                            size="sm"
                          />
                        )}
                        
                        <div className={`p-3.5 rounded-2xl text-xs leading-relaxed shadow-xs ${
                          isMe 
                            ? 'bg-blue-600 text-white rounded-tr-none' 
                            : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-800/80 rounded-tl-none'
                        }`}>
                          <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                            {m.senderName}
                          </span>
                          <p className="font-medium whitespace-pre-wrap">{m.text}</p>
                          <span className="block text-[8px] opacity-65 text-right mt-1.5 font-mono">{m.timestamp}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {isTypingReply && (
                  <div className="flex justify-start text-left">
                    <div className="flex items-center space-x-2 bg-white dark:bg-slate-900 px-4 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-800/80 rounded-tl-none shadow-xs">
                      <div className="flex space-x-1 shrink-0">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold pl-1">{activeContact} is typing...</span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Footer */}
              <form onSubmit={handleSendMessage} className="p-3.5 border-t border-slate-200 dark:border-[#273449] bg-slate-50 dark:bg-slate-900/60 flex items-center space-x-2 shrink-0">
                <input 
                  type="text"
                  placeholder={`Send a direct message to ${activeContact}...`}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={isTypingReply}
                  className="flex-1 text-xs px-3.5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-950 dark:text-white focus:outline-none focus:border-blue-500 placeholder-slate-400 dark:placeholder-slate-500 font-medium"
                />
                
                <button 
                  type="submit"
                  disabled={!chatInput.trim() || isTypingReply}
                  className="p-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 disabled:dark:bg-slate-800 disabled:text-slate-400 text-white rounded-xl transition-all cursor-pointer hover:scale-103 active:scale-97"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <MessageSquare className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-xs font-semibold">Select a thread or approve an application request to start messaging.</p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
