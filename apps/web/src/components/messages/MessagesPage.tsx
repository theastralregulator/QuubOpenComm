import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  MessageSquare, Send, ArrowLeft, ShieldAlert, 
  RefreshCw, AlertCircle, Search, X, Loader2, AlertTriangle,
  Mic, Image as ImageIcon, Video as VideoIcon, FileText,
  Trash2, Reply, SmilePlus, FolderOpen, MoreHorizontal, CornerDownRight, Sparkles
} from 'lucide-react';
import { supabase, dbService } from '../../lib/supabase';
import { unreadService } from '../../lib/unreadService';
import { ConversationViewModel, DbMessage, DbMessageReaction } from '../../types';
import UserAvatar from '../common/UserAvatar';
import WorkContractBanner from '../contracts/WorkContractBanner';
import VoiceRecorder from './VoiceRecorder';
import MediaMessage from './MediaMessage';
import MediaAttachmentPicker from './MediaAttachmentPicker';
import { MediaFilesPanel } from './MediaFilesPanel';
import { getPublicProfilesByIds } from '../../lib/profileService';

function formatDateSeparator(isoString?: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) return 'Today';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return 'Yesterday';

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

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

function areMessageListsEquivalent(prev: DbMessage[], next: DbMessage[]): boolean {
  if (prev === next) return true;
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i++) {
    const a = prev[i];
    const b = next[i];
    if (
      a.id !== b.id ||
      a.text !== b.text ||
      a.deleted_at !== b.deleted_at ||
      a.read_at !== b.read_at ||
      a.unread !== b.unread ||
      a.message_type !== b.message_type ||
      a.reply_to_message_id !== b.reply_to_message_id
    ) {
      return false;
    }
  }
  return true;
}

export default function MessagesPage({ triggerToast }: MessagesPageProps) {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationViewModel[]>([]);

  const handleSetConversations = (convList: ConversationViewModel[]) => {
    const groupedByContext = new Map<string, ConversationViewModel[]>();

    for (const c of convList) {
      const key = `${c.otherParticipantId}-${c.conversationType}-${c.applicationId || 'null'}`;
      const group = groupedByContext.get(key) || [];
      group.push(c);
      groupedByContext.set(key, group);
    }

    const canonicalConversations: ConversationViewModel[] = [];
    for (const [_, group] of groupedByContext.entries()) {
      group.sort((a, b) => {
        const isArchivedA = Boolean(a.archivedAt);
        const isArchivedB = Boolean(b.archivedAt);
        if (isArchivedA !== isArchivedB) {
          return isArchivedA ? 1 : -1;
        }
        const timeA = new Date(a.lastMessageTime || a.createdAt || 0).getTime();
        const timeB = new Date(b.lastMessageTime || b.createdAt || 0).getTime();
        if (timeA !== timeB) {
          return timeB - timeA;
        }
        return a.id.localeCompare(b.id);
      });

      const currentInGroup = conversationId ? group.find(c => c.id === conversationId) : null;
      canonicalConversations.push(currentInGroup || group[0]);
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

  // Chat Interactions V1 Feature Gate State (Default FALSE)
  const [chatInteractionsEnabled, setChatInteractionsEnabled] = useState<boolean>(false);

  // New Chat Interactions State
  const [replyingToMessage, setReplyingToMessage] = useState<DbMessage | null>(null);
  const [messageReactions, setMessageReactions] = useState<Record<string, DbMessageReaction[]>>({});
  const [isMediaPanelOpen, setIsMediaPanelOpen] = useState<boolean>(false);
  const [deleteConfirmMessage, setDeleteConfirmMessage] = useState<DbMessage | null>(null);
  const [isDeletingMessage, setIsDeletingMessage] = useState<boolean>(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [activeMenuMsgId, setActiveMenuMsgId] = useState<string | null>(null);
  const [activeReactionPickerMsgId, setActiveReactionPickerMsgId] = useState<string | null>(null);

  // Typing & Presence State (typingUsers is Map<userId, displayName>)
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [isOtherUserOnline, setIsOtherUserOnline] = useState<boolean>(false);
  const [currentUserDisplayName, setCurrentUserDisplayName] = useState<string | null>(null);
  const lastTypingSentRef = useRef<number>(0);
  const typingTimeoutRef = useRef<any>(null);
  const conversationRealtimeChannelRef = useRef<any>(null);
  const activeMessagesRealtimeChannelRef = useRef<any>(null);
  const refreshConversationsDebouncedRef = useRef<any>(null);
  const typingExpirationsRef = useRef<Map<string, any>>(new Map());

  // Realtime Version & Forced Scroll Refs
  const realtimeMessageVersionRef = useRef<number>(0);
  const forceScrollToMessageIdRef = useRef<string | null>(null);

  // Conversation Refresh Queue & Generation Refs
  const conversationRefreshGenerationRef = useRef<number>(0);
  const refreshInFlightRef = useRef<boolean>(false);
  const refreshPendingRef = useRef<boolean>(false);

  // Scroll & Container Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesContentRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastAutoScrolledMessageIdRef = useRef<string | null>(null);

  // Single Deterministic Initial Scroll Controller Refs
  const initialUnreadMessageIdRef = useRef<string | null>(null);
  const initialScrollCompletedRef = useRef<boolean>(false);
  const initialScrollModeRef = useRef<'unread' | 'latest' | null>(null);
  const initialPinToBottomRef = useRef<boolean>(true);
  const pinTimeoutRef = useRef<any>(null);

  // Current User Identity Ref (to prevent cross-account stale typing names)
  const currentUserIdentityRef = useRef<{ userId: string; displayName: string } | null>(null);

  // Stable Synchronized Messages Ref for Channel Handlers
  const messagesRef = useRef<DbMessage[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const [mediaStatus, setMediaStatus] = useState<{ mediaMessagingEnabled: boolean; voiceEnabled: boolean; imageEnabled: boolean; videoEnabled: boolean; documentEnabled?: boolean }>({
    mediaMessagingEnabled: false,
    voiceEnabled: false,
    imageEnabled: false,
    videoEnabled: false,
    documentEnabled: false
  });
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{ file: File; mediaType: 'image' | 'video' | 'document'; previewUrl: string; durationMs?: number; width?: number; height?: number } | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  // Fetch Chat Interactions V1 Capability
  useEffect(() => {
    fetch('/api/chat-status')
      .then(res => res.json())
      .then(data => {
        if (data && typeof data.chatInteractionsEnabled === 'boolean') {
          setChatInteractionsEnabled(data.chatInteractionsEnabled);
        }
      })
      .catch(err => console.warn('Chat status check error:', err));
  }, []);

  // Search Input Focus/Clear Effect
  useEffect(() => {
    if (isSearchOpen) {
      searchInputRef.current?.focus();
    } else {
      setSearchQuery('');
    }
  }, [isSearchOpen]);

  // Conversation Switch Reset Effect
  const previousConversationIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (previousConversationIdRef.current !== conversationId) {
      initialUnreadMessageIdRef.current = null;
      initialScrollCompletedRef.current = false;
      initialScrollModeRef.current = null;
      initialPinToBottomRef.current = true;
      lastAutoScrolledMessageIdRef.current = null;
      setReplyingToMessage(null);
      setActiveMenuMsgId(null);
      setActiveReactionPickerMsgId(null);
      previousConversationIdRef.current = conversationId;
    }
  }, [conversationId]);

  // Stable Active Conversation State (ID-Safe)
  const [stableActiveConv, setStableActiveConv] = useState<ConversationViewModel | null>(null);

  useEffect(() => {
    if (!conversationId) {
      setStableActiveConv(null);
      return;
    }
    const found = conversations.find(c => c.id === conversationId);
    if (found) {
      setStableActiveConv(found);
    }
  }, [conversations, conversationId]);

  const liveActiveConv = conversations.find(c => c.id === conversationId);
  const activeConv = stableActiveConv?.id === conversationId ? stableActiveConv : liveActiveConv;

  // Load Current User Canonical Authenticated Profile Identity (Reset on Account Switch)
  useEffect(() => {
    let isMounted = true;
    if (!currentUserId) {
      setCurrentUserDisplayName(null);
      currentUserIdentityRef.current = null;
      return;
    }

    // Immediately reset on user ID change
    setCurrentUserDisplayName(null);
    currentUserIdentityRef.current = null;

    const isGenericName = (n?: string | null) => {
      if (!n) return true;
      const trimmed = n.trim();
      return !trimmed || trimmed === 'User' || trimmed === 'OpenComm User';
    };

    async function loadSelfIdentity() {
      let resolvedName: string | null = null;

      // 1. Primary: dbService.getProfile(currentUserId).full_name
      try {
        const prof = await dbService.getProfile(currentUserId!);
        if (prof) {
          const fn = (prof.full_name || (prof as any).name || (prof as any).fullName || '').trim();
          if (!isGenericName(fn)) {
            resolvedName = fn;
          }
        }
      } catch (err) {
        console.warn('Error fetching own profile via dbService:', err);
      }

      // 2. Fallback: Supabase Auth current user metadata
      if (!resolvedName) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user && user.id === currentUserId) {
            const meta = user.user_metadata || {};
            const metaName = (meta.full_name || meta.name || meta.display_name || meta.fullName || '').trim();
            if (!isGenericName(metaName)) {
              resolvedName = metaName;
            }
          }
        } catch (err) {
          console.warn('Error fetching user metadata:', err);
        }
      }

      if (!isMounted) return;

      if (resolvedName && !isGenericName(resolvedName)) {
        setCurrentUserDisplayName(resolvedName);
        currentUserIdentityRef.current = { userId: currentUserId!, displayName: resolvedName };
      }
    }

    void loadSelfIdentity();

    return () => {
      isMounted = false;
    };
  }, [currentUserId]);

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

  const handleUploadAndSendMedia = async (file: File, mediaType: 'image' | 'video' | 'audio' | 'document', durationMs?: number, width?: number, height?: number) => {
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

      let cleanMimeType = file.type ? file.type.split(';')[0].trim().toLowerCase() : '';
      if (!cleanMimeType) {
        if (mediaType === 'audio') cleanMimeType = 'audio/webm';
        else if (mediaType === 'image') cleanMimeType = 'image/jpeg';
        else if (mediaType === 'video') cleanMimeType = 'video/mp4';
        else {
          triggerToast('Document file type could not be verified. Upload cancelled.');
          setIsUploadingMedia(false);
          return;
        }
      }

      const uploadFile = file.type !== cleanMimeType ? new Blob([file], { type: cleanMimeType }) : file;

      const uploadToStorage = async (intentTarget: any) => {
        let putRes: Response;
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

        if (!putRes.ok) {
          throw new Error(`Storage upload rejected (HTTP ${putRes.status})`);
        }
      };

      const finalizeUploadedIntent = async (intentTarget: any) => {
        const previewText = mediaType === 'audio' ? 'Voice message' : mediaType === 'image' ? 'Photo' : mediaType === 'document' ? 'Document' : 'Video';
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

        return finalizeData;
      };

      const intentBody: any = {
        conversationId,
        mediaType,
        mimeType: cleanMimeType,
        fileSizeBytes: uploadFile.size,
        durationMs
      };
      if (chatInteractionsEnabled && replyingToMessage?.id) {
        intentBody.replyToMessageId = replyingToMessage.id;
      }

      const intentRes = await fetch('/api/media-upload-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(intentBody)
      });

      const primaryIntent = await intentRes.json().catch(() => ({}));
      if (!intentRes.ok || !primaryIntent.uploadUrl || !primaryIntent.intentId) {
        throw new Error(primaryIntent.error || 'Upload authorization failed');
      }

      let activeTarget = primaryIntent;

      try {
        await uploadToStorage(primaryIntent);
      } catch (primaryErr: any) {
        const fallbackRes = await fetch('/api/media-upload-fallback-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ originalIntentId: primaryIntent.intentId })
        });

        const fallbackIntent = await fallbackRes.json().catch(() => ({}));
        if (!fallbackRes.ok || !fallbackIntent.uploadUrl) {
          throw new Error('Primary and fallback storage upload failed');
        }

        activeTarget = fallbackIntent;
        await uploadToStorage(fallbackIntent);
      }

      await finalizeUploadedIntent(activeTarget);

      setSelectedMedia(null);
      setIsVoiceRecording(false);
      setReplyingToMessage(null);

      // Safe version-guarded silent reconciliation (Realtime INSERT handles instant UI display)
      void refreshActiveConversationMessages(conversationId);

    } catch (err: any) {
      console.error('Media upload error:', err);
      triggerToast(err.message || 'Media upload failed.');
    } finally {
      setIsUploadingMedia(false);
    }
  };

  useEffect(() => {
    async function initAuth() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUserId(user.id);
        }
      } catch (err) {
        console.error('Failed to get current user:', err);
      }
    }
    initAuth();
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    let isMounted = true;
    setLoadingConvs(true);

    async function loadConversations() {
      try {
        const convList = await dbService.getMyConversations({ includeArchived: Boolean(conversationId) });
        if (isMounted) {
          handleSetConversations(convList);
          setLoadingConvs(false);
        }
      } catch (err: any) {
        console.error('Error loading conversations:', err);
        if (isMounted) {
          setConvsError('Failed to load conversations');
          setLoadingConvs(false);
        }
      }
    }

    loadConversations();

    return () => {
      isMounted = false;
    };
  }, [currentUserId, conversationId]);

  useEffect(() => {
    if (!conversationId || !currentUserId) {
      setMessages([]);
      return;
    }

    let isMounted = true;
    setLoadingMessages(true);
    setMessagesError(null);

    async function fetchMessages() {
      try {
        const data = await dbService.getConversationMessages(conversationId!);
        if (isMounted) {
          const sorted = [...(data || [])].sort(
            (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
          );

          // BEFORE marking read, calculate firstUnreadIncoming
          const firstUnreadIncoming = sorted.find(
            (m) => m.sender_id !== currentUserId && (m.unread === true || Boolean((m as any).unread)) && !m.deleted_at
          );
          initialUnreadMessageIdRef.current = firstUnreadIncoming?.id || null;

          setMessages(sorted);
          setLoadingMessages(false);
        }
      } catch (err: any) {
        console.error('Error fetching messages:', err);
        if (isMounted) {
          setMessagesError('Failed to load thread messages');
          setLoadingMessages(false);
        }
      }
    }

    fetchMessages();

    return () => {
      isMounted = false;
    };
  }, [conversationId, currentUserId]);

  // User Settings Preference for Online Status (Fail-Closed: Defaults to false on error/unresolved)
  const [showOnlineStatus, setShowOnlineStatus] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (!currentUserId) return;
    dbService.getMyUserSettings().then(res => {
      if (isMounted) {
        setShowOnlineStatus(res?.showOnlineStatus ?? false);
      }
    }).catch(() => {
      if (isMounted) setShowOnlineStatus(false);
    });
    return () => { isMounted = false; };
  }, [currentUserId]);

  // Local Summary Patch Helper (NO full getMyConversations refetch for active chat)
  const patchLocalConversationSummary = useCallback(
    (targetConvId: string, lastText: string, createdIsoTime: string) => {
      const formattedTime = new Date(createdIsoTime).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== targetConvId) return c;
          return {
            ...c,
            lastMessageText: lastText,
            lastMessageAt: createdIsoTime,
            lastMessageTime: formattedTime,
            unreadCount: c.id === conversationId ? 0 : c.unreadCount
          };
        })
      );
    },
    [conversationId]
  );

  // Silent Reconciliation Helper for Active Conversation Messages (Version & Equivalence Checked)
  const refreshActiveConversationMessages = useCallback(
    async (targetConvId?: string) => {
      const convId = targetConvId || conversationId;
      if (!convId) return;

      const startVersion = realtimeMessageVersionRef.current;

      try {
        const latest = await dbService.getConversationMessages(convId);

        // Stale Reconciliation Guard
        if (startVersion !== realtimeMessageVersionRef.current) {
          return;
        }

        setMessages((prev) => {
          const latestIds = new Set(latest.map((m) => m.id));
          const missingPrevId = prev.some((m) => !m.id.startsWith('temp-') && !latestIds.has(m.id));
          if (missingPrevId) {
            return prev;
          }

          if (areMessageListsEquivalent(prev, latest)) return prev;
          return latest;
        });
      } catch (err) {
        console.error('Error in silent active conversation message reconciliation:', err);
      }
    },
    [conversationId]
  );

  // Debounced & Queue-Protected Conversation List Refresh Helper
  const refreshConversationsList = useCallback(async () => {
    if (!currentUserId) return;
    if (refreshInFlightRef.current) {
      refreshPendingRef.current = true;
      return;
    }

    refreshInFlightRef.current = true;
    const gen = ++conversationRefreshGenerationRef.current;

    try {
      const updatedConvs = await dbService.getMyConversations({ includeArchived: Boolean(conversationId) });
      if (gen === conversationRefreshGenerationRef.current) {
        handleSetConversations(updatedConvs);
      }
    } catch (err) {
      console.warn('Error refreshing conversation list:', err);
    } finally {
      refreshInFlightRef.current = false;
      if (refreshPendingRef.current) {
        refreshPendingRef.current = false;
        void refreshConversationsList();
      }
    }
  }, [currentUserId, conversationId]);

  const triggerDebouncedConversationRefresh = useCallback(() => {
    if (refreshConversationsDebouncedRef.current) {
      clearTimeout(refreshConversationsDebouncedRef.current);
    }
    refreshConversationsDebouncedRef.current = setTimeout(() => {
      void refreshConversationsList();
    }, 600);
  }, [refreshConversationsList]);

  // Dedicated Active Conversation Realtime Postgres Changes Channel
  useEffect(() => {
    if (!conversationId || !currentUserId) return;

    const channelTopic = `opencomm:messages:${conversationId}`;
    const channel = supabase.channel(channelTopic);

    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const message = payload.new as DbMessage;
          if (!message || message.conversation_id !== conversationId) return;

          realtimeMessageVersionRef.current += 1;
          forceScrollToMessageIdRef.current = message.id;

          setMessages((prev) => {
            let nextList: DbMessage[];
            if (prev.some((m) => m.id === message.id)) {
              nextList = prev.map((m) => (m.id === message.id ? message : m));
            } else {
              nextList = [...prev, message];
            }
            return nextList.sort(
              (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
            );
          });

          // Asynchronous non-blocking mark read and global unread refresh
          if (message.sender_id !== currentUserId) {
            void dbService
              .markConversationRead(conversationId)
              .then(() => unreadService.refresh(currentUserId))
              .catch((e) => console.warn('Async mark read error on INSERT:', e));
          }

          // Patch summary locally (NO full getMyConversations refetch for active conversation)
          patchLocalConversationSummary(
            conversationId,
            message.text || 'Media message',
            message.created_at || new Date().toISOString()
          );
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
        (payload) => {
          const message = payload.new as DbMessage;
          if (!message || message.conversation_id !== conversationId) return;

          realtimeMessageVersionRef.current += 1;

          setMessages((prev) => {
            const index = prev.findIndex((m) => m.id === message.id);
            if (index === -1) return prev;

            const existing = prev[index];
            if (
              existing.text === message.text &&
              existing.deleted_at === message.deleted_at &&
              existing.read_at === message.read_at &&
              existing.unread === message.unread &&
              existing.reply_to_message_id === message.reply_to_message_id &&
              existing.message_type === message.message_type
            ) {
              return prev;
            }

            const next = [...prev];
            next[index] = { ...existing, ...message };
            return next;
          });
        }
      );

    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        activeMessagesRealtimeChannelRef.current = channel;
        void refreshActiveConversationMessages(conversationId);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        if (err) console.warn(`Dedicated messages channel ${status}:`, err.message || err);
      }
    });

    return () => {
      if (refreshConversationsDebouncedRef.current) {
        clearTimeout(refreshConversationsDebouncedRef.current);
      }
      supabase.removeChannel(channel);
      activeMessagesRealtimeChannelRef.current = null;
    };
  }, [conversationId, currentUserId, refreshActiveConversationMessages, patchLocalConversationSummary]);

  // Lightweight Reconciliation on Visibility / Focus Recovery
  useEffect(() => {
    if (!conversationId || !currentUserId) return;

    let lastReconcileTime = 0;

    const handleVisibilityOrFocus = () => {
      const now = Date.now();
      if (now - lastReconcileTime < 3000) return;
      if (document.visibilityState === 'visible') {
        lastReconcileTime = now;
        void refreshActiveConversationMessages(conversationId);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [conversationId, currentUserId, refreshActiveConversationMessages]);

  // Canonical Reaction Refresh Helper
  const refreshConversationReactions = useCallback(async (targetConvId?: string) => {
    const convId = targetConvId || conversationId;
    if (!convId) return;
    try {
      const rxData = await dbService.getConversationReactions(convId);
      const grouped: Record<string, DbMessageReaction[]> = {};
      (rxData || []).forEach((r: any) => {
        if (!grouped[r.message_id]) grouped[r.message_id] = [];
        grouped[r.message_id].push(r);
      });
      setMessageReactions(grouped);
    } catch (err) {
      console.error('Error refreshing reactions:', err);
    }
  }, [conversationId]);

  // Single-Channel Realtime Broadcast (Typing & Reactions) & Presence (Online Status)
  useEffect(() => {
    if (!chatInteractionsEnabled || !conversationId || !currentUserId || activeConv?.archivedAt) {
      setTypingUsers(new Map());
      setIsOtherUserOnline(false);
      return;
    }

    const channel = supabase.channel(`conversation:${conversationId}`, {
      config: { private: true }
    });

    channel
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { conversationId: topicConvId, userId, senderName, typing } = payload.payload || {};
        if (!userId || userId === currentUserId) return;
        if (topicConvId && topicConvId !== conversationId) return;

        if (typing) {
          const isGeneric = (n?: string | null) => !n || !n.trim() || n.trim() === 'User' || n.trim() === 'OpenComm User';

          const resolveName = async () => {
            // 1. valid payload.senderName
            if (senderName && typeof senderName === 'string' && !isGeneric(senderName)) {
              return senderName.trim();
            }

            // 2. valid local message sender_name where message.sender_id === userId
            const matchingMsg = messagesRef.current.find((m) => m.sender_id === userId && !isGeneric(m.sender_name));
            if (matchingMsg && matchingMsg.sender_name && !isGeneric(matchingMsg.sender_name)) {
              return matchingMsg.sender_name.trim();
            }

            // 3. fetch exact payload.userId public profile if necessary
            try {
              const profileMap = await getPublicProfilesByIds([userId]);
              const p = profileMap.get(userId);
              if (p && (p.fullName || p.name) && !isGeneric(p.fullName || p.name)) {
                return (p.fullName || p.name)!.trim();
              }
            } catch (err) {
              // Ignore fetch error
            }

            // 4. activeConv.otherParticipantName ONLY IF activeConv.otherParticipantId === userId
            if (activeConv && activeConv.otherParticipantId === userId && !isGeneric(activeConv.otherParticipantName)) {
              return activeConv.otherParticipantName.trim();
            }

            // 5. "User"
            return 'User';
          };

          void resolveName().then((resolvedName) => {
            if (!resolvedName || userId === currentUserId) return;

            setTypingUsers((prev) => new Map(prev).set(userId, resolvedName));

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
          });
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
      .on('broadcast', { event: 'reaction_changed' }, (payload) => {
        const { conversationId: targetConvId } = payload.payload || {};
        if (targetConvId && targetConvId === conversationId) {
          void refreshConversationReactions(conversationId);
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        let otherOnline = false;
        const otherParticipantId = activeConv?.otherParticipantId;
        if (otherParticipantId) {
          for (const key in state) {
            const presences = state[key] as any[];
            if (presences.some((p) => p.userId === otherParticipantId)) {
              otherOnline = true;
              break;
            }
          }
        }
        setIsOtherUserOnline(otherOnline);
      });

    const initRealtimeAuthAndSubscribe = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          await supabase.realtime.setAuth(session.access_token);
        }
      } catch (e) {
        console.warn('Realtime setAuth warning:', e);
      }

      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          conversationRealtimeChannelRef.current = channel;
          if (showOnlineStatus === true) {
            await channel.track({ userId: currentUserId, onlineAt: new Date().toISOString() });
          }
        }
      });
    };

    void initRealtimeAuthAndSubscribe();

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingExpirationsRef.current.forEach((t) => clearTimeout(t));
      typingExpirationsRef.current.clear();

      if (conversationRealtimeChannelRef.current) {
        conversationRealtimeChannelRef.current
          .send({
            type: 'broadcast',
            event: 'typing',
            payload: { conversationId, userId: currentUserId, senderName: currentUserDisplayName || undefined, typing: false }
          })
          .catch(() => {});
        conversationRealtimeChannelRef.current.untrack().catch(() => {});
      }

      supabase.removeChannel(channel);
      conversationRealtimeChannelRef.current = null;
      setTypingUsers(new Map());
      setIsOtherUserOnline(false);
      lastTypingSentRef.current = 0;
    };
  }, [
    chatInteractionsEnabled,
    conversationId,
    currentUserId,
    currentUserDisplayName,
    activeConv?.otherParticipantId,
    activeConv?.otherParticipantName,
    activeConv?.archivedAt,
    showOnlineStatus,
    refreshConversationReactions
  ]);

  // Initial Reactions Fetching
  useEffect(() => {
    if (!chatInteractionsEnabled || !conversationId) {
      setMessageReactions({});
      return;
    }
    void refreshConversationReactions(conversationId);
  }, [chatInteractionsEnabled, conversationId, refreshConversationReactions]);

  const handleToggleReaction = async (msg: any, emoji: string) => {
    if (!conversationId || !chatInteractionsEnabled) return;
    try {
      await dbService.toggleMessageReaction(msg.id, conversationId, emoji);
      await refreshConversationReactions(conversationId);

      if (conversationRealtimeChannelRef.current) {
        try {
          await conversationRealtimeChannelRef.current.send({
            type: 'broadcast',
            event: 'reaction_changed',
            payload: {
              conversationId,
              messageId: msg.id
            }
          });
        } catch (bErr) {
          console.warn('Reaction broadcast warning:', bErr);
        }
      }
    } catch (err: any) {
      console.error('Failed to toggle reaction:', err);
      setMessagesError(err?.message || 'Failed to update reaction.');
      setTimeout(() => setMessagesError(null), 3000);
    }
  };

  const sendTypingStatus = (typing: boolean) => {
    if (!chatInteractionsEnabled || !conversationId || !currentUserId || activeConv?.archivedAt) return;
    if (conversationRealtimeChannelRef.current) {
      const identity = currentUserIdentityRef.current;
      const isGeneric = (n?: string | null) => !n || !n.trim() || n.trim() === 'User' || n.trim() === 'OpenComm User';

      const validName = (identity && identity.userId === currentUserId && !isGeneric(identity.displayName))
        ? identity.displayName.trim()
        : (!isGeneric(currentUserDisplayName) ? currentUserDisplayName!.trim() : null);

      if (typing && !validName) {
        // DO NOT broadcast a knowingly incorrect "OpenComm User" senderName
        return;
      }

      conversationRealtimeChannelRef.current
        .send({
          type: 'broadcast',
          event: 'typing',
          payload: {
            conversationId,
            userId: currentUserId,
            senderName: validName || undefined,
            typing
          }
        })
        .catch(() => {});
    }
  };

  const handleChatInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setChatInput(val);
    if (!chatInteractionsEnabled || activeConv?.archivedAt) return;

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

  useEffect(() => {
    if (!currentUserId) return;
    let isMounted = true;

    const refreshConversations = async () => {
      const updatedConvs = await dbService.getMyConversations({ includeArchived: Boolean(conversationId) });
      if (isMounted) handleSetConversations(updatedConvs);
    };

    const unsubscribeConversations = unreadService.subscribeConversationEvents(
      currentUserId,
      (event) => {
        const eventConvId = (event?.new as any)?.conversation_id || (event?.new as any)?.id || (event?.old as any)?.id;
        if (eventConvId && eventConvId === conversationId) {
          // Skip full getMyConversations refetch for active conversation row changes
          return;
        }
        void refreshConversations();
      }
    );

    return () => {
      isMounted = false;
      unsubscribeConversations();
    };
  }, [conversationId, currentUserId]);

  // Single Deterministic Initial Position Controller
  useLayoutEffect(() => {
    if (!conversationId || loadingMessages || messages.length === 0) return;
    if (!messagesContainerRef.current || !messagesContentRef.current) return;
    if (activeConv?.id !== conversationId) return;
    if (initialScrollCompletedRef.current) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (initialScrollCompletedRef.current) return;
        const container = messagesContainerRef.current;
        if (!container) return;

        const unreadId = initialUnreadMessageIdRef.current;
        let unreadEl: HTMLElement | null = null;
        if (unreadId) {
          unreadEl = document.getElementById('new-messages-separator') || document.getElementById(`msg-${unreadId}`);
        }

        if (unreadEl) {
          initialScrollModeRef.current = 'unread';
          unreadEl.scrollIntoView({ behavior: 'auto', block: 'start' });
        } else {
          initialScrollModeRef.current = 'latest';
          container.scrollTop = container.scrollHeight;
          const lastMessage = messages[messages.length - 1];
          if (lastMessage) {
            lastAutoScrolledMessageIdRef.current = lastMessage.id;
          }
        }

        initialScrollCompletedRef.current = true;

        // Mark read AFTER initial positioning is established
        if (conversationId && currentUserId) {
          dbService
            .markConversationRead(conversationId)
            .then(() => unreadService.refresh(currentUserId))
            .catch((err) => console.warn('markConversationRead error:', err));
        }
      });
    });
  }, [messages, loadingMessages, conversationId, activeConv?.id, currentUserId]);

  // Initial Media/Layout Settling Effect on INNER CONTENT WRAPPER (messagesContentRef)
  useEffect(() => {
    if (!conversationId || loadingMessages || messages.length === 0) return;
    const container = messagesContainerRef.current;
    const content = messagesContentRef.current;
    if (!container || !content) return;

    if (pinTimeoutRef.current) clearTimeout(pinTimeoutRef.current);
    initialPinToBottomRef.current = true;

    const reAnchorPosition = () => {
      if (!initialPinToBottomRef.current || !container) return;

      if (initialScrollModeRef.current === 'latest') {
        container.scrollTop = container.scrollHeight;
      } else if (initialScrollModeRef.current === 'unread') {
        const unreadId = initialUnreadMessageIdRef.current;
        const unreadEl = unreadId ? (document.getElementById('new-messages-separator') || document.getElementById(`msg-${unreadId}`)) : null;
        if (unreadEl) {
          unreadEl.scrollIntoView({ behavior: 'auto', block: 'start' });
        } else {
          container.scrollTop = container.scrollHeight;
        }
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      if (initialPinToBottomRef.current) {
        reAnchorPosition();
      }
    });

    resizeObserver.observe(content);

    const handleUserScroll = () => {
      if (!initialPinToBottomRef.current) return;
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      if (distanceFromBottom > 80 || container.scrollTop < 10) {
        initialPinToBottomRef.current = false;
      }
    };

    container.addEventListener('scroll', handleUserScroll, { passive: true });

    pinTimeoutRef.current = setTimeout(() => {
      initialPinToBottomRef.current = false;
    }, 1500);

    return () => {
      resizeObserver.disconnect();
      container.removeEventListener('scroll', handleUserScroll);
      if (pinTimeoutRef.current) clearTimeout(pinTimeoutRef.current);
    };
  }, [conversationId, loadingMessages, messages.length]);

  // Smart Auto-Scroll Effect for Subsequent Realtime Messages
  useEffect(() => {
    if (loadingMessages || messages.length === 0 || !initialScrollCompletedRef.current) return;

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;

    const isNewMessage = lastMessage.id !== lastAutoScrolledMessageIdRef.current;
    const isForced = forceScrollToMessageIdRef.current === lastMessage.id;

    if (isNewMessage || isForced) {
      const container = messagesContainerRef.current;
      let isNearBottom = true;
      if (container) {
        const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        isNearBottom = distanceFromBottom <= 150;
      }

      const isMe = lastMessage.sender_id === currentUserId;
      if (isForced || isMe || isNearBottom) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }

      lastAutoScrolledMessageIdRef.current = lastMessage.id;
      forceScrollToMessageIdRef.current = null;
    }
  }, [messages, loadingMessages, currentUserId]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!conversationId || activeConv?.archivedAt || !chatInput.trim() || isSending) return;

    sendTypingStatus(false);
    const textToSend = chatInput.trim();
    const tempId = `temp-${Date.now()}`;

    setPendingMessages(prev => [...prev, { id: tempId, text: textToSend, status: 'sending' }]);
    setChatInput('');
    setIsSending(true);

    try {
      const replyId = chatInteractionsEnabled ? replyingToMessage?.id : undefined;
      const sentMsg = await dbService.sendTextMessage(conversationId, textToSend, replyId);
      if (sentMsg) {
        setPendingMessages(prev => prev.filter(m => m.id !== tempId));
        setMessages((prev) => {
          if (prev.some((m) => m.id === sentMsg.id)) return prev;
          return [...prev, sentMsg];
        });
        setReplyingToMessage(null);
        patchLocalConversationSummary(conversationId, textToSend, sentMsg.created_at || new Date().toISOString());
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

  const handleJumpToMessage = (targetMsgId: string) => {
    const el = document.getElementById(`msg-${targetMsgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(targetMsgId);
      setTimeout(() => setHighlightedMessageId(null), 2500);
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

  const sortedMessages = useMemo(() => {
    return [...messages].sort(
      (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
    );
  }, [messages]);

  return (
    <div 
      className={`w-full max-w-[1200px] mx-auto flex flex-col text-left ${
        conversationId 
          ? 'fixed inset-0 z-40 bg-white dark:bg-[#0B0F19] md:relative md:z-auto md:h-[calc(100dvh-120px)] md:p-4' 
          : 'h-[calc(100dvh-120px)] p-0 md:p-4'
      }`}
      style={{ paddingBottom: conversationId ? 'env(safe-area-inset-bottom)' : undefined }}
    >
      <div className="flex-1 bg-white dark:bg-[#0B0F19] md:border border-slate-200 dark:border-slate-800 md:rounded-[24px] overflow-hidden shadow-sm flex flex-col md:flex-row relative h-full min-h-0">

        {/* ================= LEFT PANE: INBOX LIST ================= */}
        <div className={`w-full md:w-[340px] lg:w-[380px] border-r border-slate-200 dark:border-slate-800/80 flex flex-col min-h-0 overflow-hidden shrink-0 bg-slate-50/50 dark:bg-[#080C14] ${
          conversationId ? 'hidden md:flex' : 'flex'
        }`}>
          <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-800/80 flex flex-col gap-2 shrink-0 bg-slate-50/70 dark:bg-[#080C14]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Conversations</span>
              <button
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors"
                title="Search conversations"
              >
                {isSearchOpen ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
              </button>
            </div>

            {isSearchOpen && (
              <div className="relative animate-in fade-in slide-in-from-top-1 duration-150">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search messages or people..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/40">
            {loadingConvs ? (
              <div className="p-4 space-y-3 animate-pulse">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-24" />
                      <div className="h-2.5 bg-slate-200 dark:bg-slate-800 rounded w-36" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No conversations found.
              </div>
            ) : (
              filteredGroups.map(group => {
                const isSelected = activeConv?.otherParticipantId === group.participantId;
                const activeInGroup = group.conversations.find(c => c.id === conversationId) || group.conversations[0];

                return (
                  <div
                    key={group.participantId}
                    onClick={() => {
                      setSelectedParticipantGroup(group);
                      setStableActiveConv(activeInGroup);
                      navigate(`/messages/${activeInGroup.id}`);
                    }}
                    className={`p-3.5 flex items-center gap-3 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-purple-50/80 dark:bg-purple-950/30 border-l-4 border-purple-600'
                        : 'hover:bg-slate-100/60 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <UserAvatar
                      avatarUrl={group.participantAvatar}
                      fullName={group.participantName}
                      size="md"
                      className="shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {group.participantName}
                        </h4>
                        {group.latestActivityFormatted && (
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {group.latestActivityFormatted}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {group.latestMessageText || 'No messages yet'}
                      </p>
                    </div>

                    {group.totalUnread > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-purple-600 text-white text-[10px] font-bold shrink-0">
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
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate leading-tight">
                        {activeConv.otherParticipantName}
                      </h3>
                      {chatInteractionsEnabled && isOtherUserOnline && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/50">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Online
                        </span>
                      )}
                    </div>
                    <p 
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 truncate max-w-[300px]"
                      title={activeConv.otherParticipantTitle || (activeConv.conversationType === 'worker_direct' ? 'Direct Worker Enquiry' : 'Job Application')}
                    >
                      {activeConv.otherParticipantTitle || (activeConv.conversationType === 'worker_direct' ? 'Direct Worker Enquiry' : 'Job Application')}
                    </p>
                  </div>
                </div>

                {chatInteractionsEnabled && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsMediaPanelOpen(true)}
                      className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs font-medium border border-slate-200 dark:border-slate-800"
                      title="Media & Files"
                    >
                      <FolderOpen className="w-4 h-4" />
                      <span className="hidden sm:inline">Media & Files</span>
                    </button>
                  </div>
                )}
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

              {/* Messages Thread Content */}
              <div ref={messagesContainerRef} className="flex-1 min-h-0 p-3 sm:p-4 overflow-y-auto space-y-3 bg-slate-50/30 dark:bg-[#070A12]/30 touch-pan-y overscroll-contain">
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
                ) : sortedMessages.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-xs font-medium">
                    No messages yet. Send a message to start the conversation!
                  </div>
                ) : (
                  <div ref={messagesContentRef} className="space-y-3">
                    {sortedMessages.map((msg, idx) => {
                      const isMe = msg.sender_id === currentUserId;
                      const sentTime = msg.created_at
                        ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '';
                      const isRead = Boolean(msg.read_at) || msg.unread === false;
                      const isDeleted = chatInteractionsEnabled && Boolean(msg.deleted_at);

                      const prevMsg = idx > 0 ? sortedMessages[idx - 1] : null;
                      const currentDateStr = msg.created_at ? new Date(msg.created_at).toDateString() : '';
                      const prevDateStr = prevMsg?.created_at ? new Date(prevMsg.created_at).toDateString() : '';
                      const showDateSeparator = currentDateStr !== prevDateStr && currentDateStr !== '';

                      const isFirstUnread = initialUnreadMessageIdRef.current && msg.id === initialUnreadMessageIdRef.current;
                      const isSystemMsg = msg.role === 'system' || msg.role === 'assistant' || msg.message_type === 'system' || msg.message_type === 'workflow';

                      if (isSystemMsg) {
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
                              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/80 text-[11px] font-medium text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60 shadow-2xs max-w-[90%] break-words">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                <span>{msg.text}</span>
                              </div>
                            </div>
                          </React.Fragment>
                        );
                      }

                      const replyParent = (chatInteractionsEnabled && msg.reply_to_message_id)
                        ? sortedMessages.find(m => m.id === msg.reply_to_message_id)
                        : null;

                      const rxList = chatInteractionsEnabled ? (messageReactions[msg.id] || []) : [];
                      const rxCounts: Record<string, { count: number; hasMine: boolean }> = {};
                      rxList.forEach(r => {
                        if (!rxCounts[r.emoji]) rxCounts[r.emoji] = { count: 0, hasMine: false };
                        rxCounts[r.emoji].count += 1;
                        if (r.user_id === currentUserId) rxCounts[r.emoji].hasMine = true;
                      });

                      const isHighlighted = chatInteractionsEnabled && highlightedMessageId === msg.id;

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
                            className={`flex items-end gap-2 group relative transition-colors duration-500 rounded-2xl p-1 ${
                              isHighlighted ? 'bg-amber-100/60 dark:bg-amber-950/40 ring-2 ring-amber-400' : ''
                            } ${isMe ? 'justify-end' : 'justify-start'}`}
                          >
                            {!isMe && (
                              <UserAvatar
                                avatarUrl={msg.sender_avatar || activeConv.otherParticipantAvatar}
                                fullName={msg.sender_name}
                                size="sm"
                                className="shrink-0 mb-1"
                              />
                            )}
                            <div className={`max-w-[85%] sm:max-w-[70%] space-y-1 relative ${isMe ? 'items-end' : 'items-start'}`}>

                              {/* Quoted Reply Block */}
                              {chatInteractionsEnabled && msg.reply_to_message_id && (
                                <div
                                  onClick={() => handleJumpToMessage(msg.reply_to_message_id!)}
                                  className="cursor-pointer p-2 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border-l-3 border-purple-500 text-[11px] text-slate-600 dark:text-slate-300 mb-1 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors flex items-center gap-1.5"
                                >
                                  <CornerDownRight className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                                  <div className="truncate">
                                    {replyParent ? (
                                      replyParent.deleted_at ? (
                                        <span className="italic text-slate-400">Deleted message</span>
                                      ) : (
                                        <>
                                          <span className="font-semibold text-slate-900 dark:text-white mr-1.5">
                                            {replyParent.sender_name}:
                                          </span>
                                          <span>{replyParent.text}</span>
                                        </>
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
                                <div className="relative group/bubble">
                                  {msg.message_type && msg.message_type !== 'text' ? (
                                    <MediaMessage
                                      messageId={msg.id}
                                      mediaType={msg.message_type}
                                      isSelf={isMe}
                                      isRead={isRead}
                                      width={(msg as any).width || (msg as any).media_width || (msg as any).media_metadata?.width}
                                      height={(msg as any).height || (msg as any).media_height || (msg as any).media_metadata?.height}
                                      durationMs={(msg as any).duration_ms || (msg as any).media_duration_ms || (msg as any).media_metadata?.duration_ms}
                                    />
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

                                  {/* Per-Message Action Trigger & Menu */}
                                  {chatInteractionsEnabled && (isMe ? (msg.role === 'user' && !isDeleted) : (!activeConv.archivedAt)) && (
                                    <div className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-100 sm:opacity-0 group-hover/bubble:opacity-100 transition-opacity z-20 ${
                                      isMe ? '-left-14' : '-right-14'
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
                                          <div className={`absolute bottom-full mb-1 ${isMe ? 'right-0' : 'left-0'} bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-1 z-30 min-w-[120px] flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100`}>
                                            {!activeConv.archivedAt && (
                                              <>
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
                                              </>
                                            )}

                                            {isMe && msg.role === 'user' && !isDeleted && (
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
                                  {chatInteractionsEnabled && activeReactionPickerMsgId === msg.id && (
                                    <div className={`absolute bottom-full mb-2 ${isMe ? 'right-0' : 'left-0'} bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-xl p-1.5 z-40 flex items-center gap-1 animate-in zoom-in-95 duration-100`}>
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
                              {chatInteractionsEnabled && !isDeleted && Object.keys(rxCounts).length > 0 && (
                                <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                  {Object.entries(rxCounts).map(([emoji, data]) => (
                                    <button
                                      key={emoji}
                                      disabled={activeConv.archivedAt}
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

                              {/* Timestamp & Read/Sent Status */}
                              {!isDeleted && (
                                <div className={`flex items-center gap-1 text-[10px] font-semibold text-slate-400 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                  <span>{sentTime}</span>
                                  {isMe && (
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
                )}
              </div>

              {/* Reserved Typing Status Row (Fixed Height h-6) */}
              {chatInteractionsEnabled && (
                <div className="h-6 px-4 py-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 italic flex items-center gap-1.5 shrink-0 transition-opacity duration-150">
                  {typingUsers.size > 0 ? (
                    <>
                      <span className="flex gap-0.5">
                        <span className="w-1 h-1 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1 h-1 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1 h-1 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                      <span>{Array.from(typingUsers.values()).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing…</span>
                    </>
                  ) : null}
                </div>
              )}

              {/* Quoted Reply Bar in Composer */}
              {chatInteractionsEnabled && replyingToMessage && !activeConv.archivedAt && (
                <div className="p-2 px-3 bg-purple-50 dark:bg-purple-950/40 border-b border-purple-100 dark:border-purple-900/50 flex items-center justify-between gap-2 shrink-0 animate-in slide-in-from-bottom-2 duration-150">
                  <div className="flex items-center gap-2 min-w-0">
                    <Reply className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                    <div className="min-w-0 text-xs">
                      <span className="font-semibold text-slate-900 dark:text-white mr-1.5">
                        Replying to {replyingToMessage.sender_name}
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

              {/* Composer */}
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
                    ) : selectedMedia.mediaType === 'document' ? (
                      <div className="w-12 h-12 bg-emerald-900/40 text-emerald-400 rounded-xl flex items-center justify-center border border-emerald-700/50">
                        <FileText className="w-6 h-6" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 bg-purple-900/40 text-purple-400 rounded-xl flex items-center justify-center border border-purple-700/50">
                        <VideoIcon className="w-6 h-6" />
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
                <form onSubmit={handleSendMessage} className="p-2.5 sm:p-3 border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0B0F19] shrink-0">
                  <div className="flex items-end gap-2 bg-slate-50 dark:bg-[#080C14] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-1.5 focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/20 transition-all">
                    <MediaAttachmentPicker
                      onFileSelected={(file, mediaType, previewUrl, durationMs, width, height) => {
                        setSelectedMedia({ file, mediaType: mediaType as any, previewUrl, durationMs, width, height });
                      }}
                      disabled={isSending || isUploadingMedia}
                      documentEnabled={mediaStatus.documentEnabled}
                    />

                    <textarea
                      ref={textareaRef}
                      value={chatInput}
                      onChange={handleChatInputChange}
                      onBlur={() => sendTypingStatus(false)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message..."
                      rows={1}
                      className="flex-1 bg-transparent border-0 resize-none max-h-32 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none p-1.5"
                    />

                    {mediaStatus.voiceEnabled && (
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
                      disabled={!chatInput.trim() || isSending}
                      className="p-2 rounded-xl bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 disabled:hover:bg-purple-600 transition-colors shrink-0 shadow-xs"
                      title="Send message"
                    >
                      {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                </form>
              )}
            </>
          ) : conversationId ? (
            <div className="flex-1 flex flex-col h-full min-h-0 bg-white dark:bg-[#0B0F19] overflow-hidden animate-pulse">
              {/* Header Loading Shell */}
              <div className="px-3.5 py-3 border-b border-slate-200 dark:border-slate-800/80 flex items-center gap-3 bg-white dark:bg-[#0B0F19]">
                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3.5 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-2.5 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
                </div>
              </div>
              {/* Content Loading Shell */}
              <div className="flex-1 p-4 space-y-4">
                <div className="h-10 w-48 bg-slate-200/60 dark:bg-slate-800/60 rounded-2xl" />
                <div className="h-12 w-64 bg-slate-200/60 dark:bg-slate-800/60 rounded-2xl ml-auto" />
                <div className="h-10 w-56 bg-slate-200/60 dark:bg-slate-800/60 rounded-2xl" />
              </div>
              {/* Composer Loading Shell */}
              <div className="p-3 border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0B0F19]">
                <div className="h-10 w-full bg-slate-100 dark:bg-slate-800 rounded-2xl" />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 dark:bg-[#080C14]/50">
              <div className="w-16 h-16 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Your OpenComm Messages</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                Select a conversation from the left pane to view messages, media, and file attachments.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* Media & Files Panel Drawer */}
      {chatInteractionsEnabled && (
        <MediaFilesPanel
          isOpen={isMediaPanelOpen}
          onClose={() => setIsMediaPanelOpen(false)}
          conversationId={conversationId || ''}
          onJumpToMessage={handleJumpToMessage}
        />
      )}

      {/* Delete Confirmation Modal */}
      {chatInteractionsEnabled && deleteConfirmMessage && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950/50">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Delete message?</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Delete this message for everyone? Attached media (if any) will be permanently deleted.
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
                    await dbService.deleteMessage(deleteConfirmMessage.id);
                    setMessages(prev => prev.map(m => m.id === deleteConfirmMessage.id ? { ...m, text: 'This message was deleted', deleted_at: new Date().toISOString() } : m));
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
    </div>
  );
}
