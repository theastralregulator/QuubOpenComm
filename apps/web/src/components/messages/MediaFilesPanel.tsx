import React, { useState, useEffect } from 'react';
import { X, Image, FileText, Video, Mic, ExternalLink, ArrowDownLeft, File, Loader2 } from 'lucide-react';
import { SharedMediaItem } from '../../types';
import { supabase, dbService } from '../../lib/supabase';

interface MediaFilesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  onJumpToMessage: (messageId: string) => void;
}

export const MediaFilesPanel: React.FC<MediaFilesPanelProps> = ({
  isOpen,
  onClose,
  conversationId,
  onJumpToMessage
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'media' | 'files' | 'voice'>('all');
  const [items, setItems] = useState<SharedMediaItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [accessingMediaId, setAccessingMediaId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !conversationId) return;

    let mounted = true;
    setLoading(true);

    dbService.getConversationSharedMedia(conversationId)
      .then(data => {
        if (mounted) {
          setItems(data || []);
          setLoading(false);
        }
      })
      .catch(err => {
        console.error('Failed to load conversation shared media:', err);
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, conversationId]);

  if (!isOpen) return null;

  const filteredItems = items.filter(item => {
    if (activeTab === 'media') return item.media_type === 'image' || item.media_type === 'video';
    if (activeTab === 'files') return item.media_type === 'document';
    if (activeTab === 'voice') return item.media_type === 'audio';
    return true;
  });

  const handleOpenMedia = async (item: SharedMediaItem, mode: 'view' | 'download' = 'view') => {
    try {
      setAccessingMediaId(item.media_id);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert('Authentication required.');
        return;
      }

      const res = await fetch('/api/media-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ messageId: item.message_id, mode })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.accessUrl) {
        throw new Error(data.error || 'Failed to generate access link');
      }

      window.open(data.accessUrl, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      alert(err.message || 'Unable to generate access link for media item.');
    } finally {
      setAccessingMediaId(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDuration = (ms?: number | null) => {
    if (!ms) return '';
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end transition-opacity">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-200">

        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
              <File className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Media & Files</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{items.length} shared items</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-4 gap-1 bg-slate-50/50 dark:bg-slate-900/30">
          {(['all', 'media', 'files', 'voice'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2.5 px-3 text-xs font-medium border-b-2 capitalize transition-colors ${
                activeTab === tab
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400 dark:border-purple-400 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
              <span className="text-xs">Loading shared media...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-slate-400">
              <File className="w-8 h-8 stroke-1 text-slate-300 dark:text-slate-600" />
              <span className="text-xs font-medium">No shared items found in this section</span>
            </div>
          ) : (
            filteredItems.map(item => {
              const isMedia = item.media_type === 'image' || item.media_type === 'video';
              const isDoc = item.media_type === 'document';
              const isAudio = item.media_type === 'audio';

              return (
                <div
                  key={item.media_id}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
                      {item.media_type === 'image' && <Image className="w-5 h-5 text-blue-500" />}
                      {item.media_type === 'video' && <Video className="w-5 h-5 text-purple-500" />}
                      {item.media_type === 'audio' && <Mic className="w-5 h-5 text-emerald-500" />}
                      {item.media_type === 'document' && <FileText className="w-5 h-5 text-amber-500" />}
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                        {item.original_filename || (
                          isAudio ? 'Voice Message' :
                          isMedia ? (item.media_type === 'image' ? 'Photo' : 'Video') :
                          isDoc ? 'Document' : 'Attachment'
                        )}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        <span>{formatBytes(item.file_size_bytes)}</span>
                        {item.duration_ms ? <span>• {formatDuration(item.duration_ms)}</span> : null}
                        <span>• {new Date(item.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => {
                        onJumpToMessage(item.message_id);
                        onClose();
                      }}
                      title="Jump to message in chat"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      <ArrowDownLeft className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleOpenMedia(item, isDoc ? 'download' : 'view')}
                      disabled={accessingMediaId === item.media_id}
                      title={isDoc ? 'Download document' : 'Open media'}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                    >
                      {accessingMediaId === item.media_id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                      ) : (
                        <ExternalLink className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
};
