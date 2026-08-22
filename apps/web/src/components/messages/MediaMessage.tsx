import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Image as ImageIcon, Film, Mic, AlertCircle, X, Maximize2, Download, ExternalLink, FileText, FileSpreadsheet, FileCode } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface MediaMessageProps {
  messageId: string;
  mediaType: 'image' | 'video' | 'audio' | 'document' | string;
  isSelf: boolean;
  isRead: boolean;
  width?: number;
  height?: number;
  durationMs?: number;
}

interface MediaAccessDetails {
  accessUrl: string;
  mediaType: string;
  mimeType: string;
  fileSizeBytes: number;
  durationMs?: number;
  width?: number;
  height?: number;
  expired?: boolean;
}

// In-memory cache for presigned GET access URLs (Key: messageId -> { details, expiresAt })
const accessCache = new Map<string, { details: MediaAccessDetails; expiresAt: number }>();

export default function MediaMessage({ messageId, mediaType, isSelf, isRead, width, height, durationMs }: MediaMessageProps) {
  const [accessDetails, setAccessDetails] = useState<MediaAccessDetails | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);

  // Download State
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Audio Player State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [durationSec, setDurationSec] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let isSubscribed = true;

    async function loadMediaAccess() {
      // 1. Check client cache
      const cached = accessCache.get(messageId);
      if (cached && cached.expiresAt > Date.now()) {
        setAccessDetails(cached.details);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorState(null);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          setErrorState('Authentication required to view media');
          setIsLoading(false);
          return;
        }

        const res = await fetch('/api/media-access', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ messageId, mode: 'view' })
        });

        const data = await res.json();

        if (!isSubscribed) return;

        if (res.status === 410 || data.expired) {
          setAccessDetails({ expired: true } as MediaAccessDetails);
          setIsLoading(false);
          return;
        }

        if (!res.ok || !data.accessUrl) {
          setErrorState(data.error || 'Failed to load media authorization');
          setIsLoading(false);
          return;
        }

        const details: MediaAccessDetails = {
          accessUrl: data.accessUrl,
          mediaType: data.mediaType,
          mimeType: data.mimeType,
          fileSizeBytes: data.fileSizeBytes,
          durationMs: data.durationMs || durationMs,
          width: data.width || width,
          height: data.height || height
        };

        // Cache for 10 minutes (600,000 ms)
        accessCache.set(messageId, { details, expiresAt: Date.now() + 600 * 1000 });
        setAccessDetails(details);

      } catch (err: any) {
        if (isSubscribed) {
          console.error('Error fetching media access URL:', err);
          setErrorState('Media load error');
        }
      } finally {
        if (isSubscribed) setIsLoading(false);
      }
    }

    loadMediaAccess();

    return () => {
      isSubscribed = false;
    };
  }, [messageId, width, height, durationMs]);

  // Lightbox keyboard ESC handling
  useEffect(() => {
    if (!isLightboxOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsLightboxOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLightboxOpen]);

  const toggleAudioPlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTimeSec(Math.floor(audioRef.current.currentTime));
      if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
        setDurationSec(Math.floor(audioRef.current.duration));
      }
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    setDownloadError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setDownloadError('Authentication required');
        setIsDownloading(false);
        return;
      }

      const res = await fetch('/api/media-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ messageId, mode: 'download' })
      });

      const data = await res.json();

      if (!res.ok || !data.accessUrl) {
        setDownloadError(data.error || 'Unable to download video.');
        setIsDownloading(false);
        return;
      }

      // Trigger actual file download via temporary anchor element
      const a = document.createElement('a');
      a.href = data.accessUrl;
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error triggering video download:', err);
      setDownloadError('Unable to download video.');
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    if (mediaType === 'image') {
      const hasDimensions = Boolean(width && height && width > 0 && height > 0);
      return (
        <div
          style={{ aspectRatio: hasDimensions ? `${width} / ${height}` : undefined }}
          className="w-full max-w-[280px] sm:max-w-[320px] min-h-[180px] max-h-[260px] rounded-2xl bg-slate-200/80 dark:bg-slate-800/80 animate-pulse flex flex-col items-center justify-center p-4 space-y-2 border border-slate-300/40 dark:border-slate-700/40"
        >
          <ImageIcon className="w-6 h-6 text-slate-400 dark:text-slate-500" />
          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">Loading photo...</span>
        </div>
      );
    }

    if (mediaType === 'video') {
      return (
        <div className="w-full max-w-[280px] sm:max-w-[320px] h-[110px] rounded-2xl bg-slate-200/80 dark:bg-slate-800/80 animate-pulse flex items-center space-x-3 p-3 border border-slate-300/40 dark:border-slate-700/40">
          <div className="w-10 h-10 rounded-xl bg-slate-300 dark:bg-slate-700 shrink-0 flex items-center justify-center">
            <Film className="w-5 h-5 text-slate-400" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 bg-slate-300 dark:bg-slate-700 rounded" />
            <div className="h-2.5 w-16 bg-slate-300 dark:bg-slate-700 rounded" />
          </div>
        </div>
      );
    }

    if (mediaType === 'audio') {
      return (
        <div className="w-[240px] h-[64px] rounded-2xl bg-slate-200/80 dark:bg-slate-800/80 animate-pulse flex items-center space-x-3 p-3 border border-slate-300/40 dark:border-slate-700/40">
          <div className="w-9 h-9 rounded-full bg-slate-300 dark:bg-slate-700 shrink-0 flex items-center justify-center">
            <Mic className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="h-3 w-20 bg-slate-300 dark:bg-slate-700 rounded" />
            <div className="h-1.5 w-full bg-slate-300 dark:bg-slate-700 rounded-full" />
          </div>
        </div>
      );
    }

    return (
      <div className="w-[260px] h-[72px] rounded-2xl bg-slate-200/80 dark:bg-slate-800/80 animate-pulse flex items-center space-x-3 p-3 border border-slate-300/40 dark:border-slate-700/40">
        <div className="w-10 h-10 rounded-xl bg-slate-300 dark:bg-slate-700 shrink-0 flex items-center justify-center">
          <FileText className="w-5 h-5 text-slate-400" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="h-3 w-28 bg-slate-300 dark:bg-slate-700 rounded" />
          <div className="h-2.5 w-16 bg-slate-300 dark:bg-slate-700 rounded" />
        </div>
      </div>
    );
  }

  if (accessDetails?.expired) {
    return (
      <div className="flex items-center space-x-2 py-2 px-3 bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs text-slate-500 dark:text-slate-400">
        <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
        <span className="font-medium italic">Media expired</span>
      </div>
    );
  }

  if (errorState || !accessDetails?.accessUrl) {
    return (
      <div className="flex items-center space-x-2 py-2 px-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-xl text-xs text-rose-600 dark:text-rose-400">
        <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
        <span>{errorState || 'Media unavailable'}</span>
      </div>
    );
  }

  // 1. AUDIO / VOICE NOTE
  if (mediaType === 'audio' || accessDetails.mediaType === 'audio') {
    const totalDuration = accessDetails.durationMs ? Math.floor(accessDetails.durationMs / 1000) : durationSec;
    const progressPercent = totalDuration > 0 ? (currentTimeSec / totalDuration) * 100 : 0;

    return (
      <div
        title={isSelf ? (isRead ? 'Read' : 'Sent, not read') : undefined}
        aria-label={isSelf ? (isRead ? 'Read' : 'Sent, not read') : undefined}
        className={`p-2.5 rounded-2xl flex flex-col space-y-2 min-w-[200px] max-w-[280px] transition-colors duration-300 ${
          isSelf
            ? isRead
              ? 'bg-blue-600 text-white rounded-br-xs shadow-xs'
              : 'bg-slate-600 text-white rounded-br-xs shadow-xs'
            : 'bg-slate-100 dark:bg-[#1E293B] text-slate-900 dark:text-white border border-slate-200/60 dark:border-slate-800 rounded-bl-xs shadow-xs'
        }`}
      >
        <div className="flex items-center space-x-2.5">
          <button
            onClick={toggleAudioPlay}
            aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-sm ${
              isSelf
                ? isRead
                  ? 'bg-white text-blue-700 hover:bg-blue-50'
                  : 'bg-white text-slate-800 hover:bg-slate-100'
                : 'bg-blue-600 text-white hover:bg-blue-500'
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between text-[11px] font-mono font-bold mb-1 opacity-90">
              <span className="flex items-center space-x-1">
                <Mic className="w-3 h-3" />
                <span>Voice Message</span>
              </span>
              <span>{formatSeconds(isPlaying ? currentTimeSec : totalDuration)}</span>
            </div>

            {/* Custom Progress Bar */}
            <div
              className={`w-full h-1.5 rounded-full overflow-hidden cursor-pointer relative ${
                isSelf ? 'bg-white/30' : 'bg-slate-200 dark:bg-slate-700'
              }`}
              onClick={(e) => {
                if (!audioRef.current || !totalDuration) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const clickPos = (e.clientX - rect.left) / rect.width;
                audioRef.current.currentTime = clickPos * totalDuration;
              }}
            >
              <div
                className={`h-full transition-all duration-100 ${isSelf ? 'bg-white' : 'bg-blue-600 dark:bg-blue-400'}`}
                style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
              />
            </div>
          </div>
        </div>

        <audio
          ref={audioRef}
          src={accessDetails.accessUrl}
          onTimeUpdate={handleAudioTimeUpdate}
          onEnded={() => {
            setIsPlaying(false);
            setCurrentTimeSec(0);
          }}
          className="hidden"
        />
      </div>
    );
  }

  // 2. IMAGE
  if (mediaType === 'image' || accessDetails.mediaType === 'image') {
    return (
      <>
        <div
          title={isSelf ? (isRead ? 'Read' : 'Sent, not read') : undefined}
          aria-label={isSelf ? (isRead ? 'Read' : 'Sent, not read') : undefined}
          className={`relative group overflow-hidden rounded-2xl border p-1 max-w-[280px] sm:max-w-[320px] transition-colors duration-300 ${
            isSelf
              ? isRead
                ? 'bg-blue-600 border-blue-500 rounded-br-xs shadow-xs'
                : 'bg-slate-600 border-slate-500 rounded-br-xs shadow-xs'
              : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-bl-xs shadow-xs'
          }`}
        >
          <img
            src={accessDetails.accessUrl}
            alt="Attachment"
            loading="lazy"
            onClick={() => setIsLightboxOpen(true)}
            className="w-full h-auto max-h-[260px] object-cover rounded-xl cursor-pointer hover:opacity-95 transition-opacity"
          />
          <button
            onClick={() => setIsLightboxOpen(true)}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 cursor-pointer"
            title="Open Image Lightbox"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Full-screen Lightbox Modal */}
        {isLightboxOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
            onClick={() => setIsLightboxOpen(false)}
          >
            <div className="relative max-w-4xl max-h-[90vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
              <img
                src={accessDetails.accessUrl}
                alt="Full size attachment"
                className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
              />
              <button
                onClick={() => setIsLightboxOpen(false)}
                className="absolute -top-10 right-0 p-2 text-white/80 hover:text-white bg-slate-800/60 rounded-full hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // 3. VIDEO (Split Actions: Open Video vs Download)
  if (mediaType === 'video' || accessDetails.mediaType === 'video') {
    const durationText = accessDetails.durationMs ? `${Math.floor(accessDetails.durationMs / 1000)}s` : '';
    const sizeMb = accessDetails.fileSizeBytes ? (accessDetails.fileSizeBytes / (1024 * 1024)).toFixed(1) : '';

    return (
      <div
        title={isSelf ? (isRead ? 'Read' : 'Sent, not read') : undefined}
        aria-label={isSelf ? (isRead ? 'Read' : 'Sent, not read') : undefined}
        className={`p-3 rounded-2xl flex flex-col space-y-2.5 max-w-[280px] sm:max-w-[320px] transition-colors duration-300 ${
          isSelf
            ? isRead
              ? 'bg-blue-600 text-white rounded-br-xs shadow-xs'
              : 'bg-slate-600 text-white rounded-br-xs shadow-xs'
            : 'bg-slate-100 dark:bg-[#1E293B] text-slate-900 dark:text-white border border-slate-200/60 dark:border-slate-800 rounded-bl-xs shadow-xs'
        }`}
      >
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isSelf ? 'bg-white/20 text-white' : 'bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
          }`}>
            <Film className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0 text-left">
            <h4 className="text-xs font-bold truncate">Video Attachment</h4>
            <div className="flex items-center space-x-2 text-[10px] opacity-80 font-mono">
              {durationText && <span>{durationText}</span>}
              {durationText && sizeMb && <span>•</span>}
              {sizeMb && <span>{sizeMb} MB</span>}
            </div>
          </div>
        </div>

        <div className="pt-1 flex items-center space-x-2">
          {/* Action 1: Open Video (View Mode - 15-min expiring URL in new tab) */}
          <a
            href={accessDetails.accessUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-sm ${
              isSelf
                ? isRead
                  ? 'bg-white text-blue-700 hover:bg-blue-50'
                  : 'bg-white text-slate-800 hover:bg-slate-100'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
            title="Open video in new tab"
          >
            <Play className="w-3.5 h-3.5 fill-current shrink-0" />
            <span>Open Video</span>
          </a>

          {/* Action 2: Download Video (Download Mode with Content-Disposition override) */}
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className={`py-1.5 px-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-sm disabled:opacity-50 ${
              isSelf
                ? 'bg-white/20 text-white hover:bg-white/30 border border-white/20'
                : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 border border-slate-300/50 dark:border-slate-600/50'
            }`}
            title="Download video file"
          >
            {isDownloading ? (
              <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
            ) : (
              <Download className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>Download</span>
          </button>
        </div>

        {downloadError && (
          <div className="text-[10px] text-rose-300 dark:text-rose-400 font-medium px-1">
            {downloadError}
          </div>
        )}
      </div>
    );
  }

  // 4. DOCUMENT
  if (mediaType === 'document' || accessDetails.mediaType === 'document') {
    const sizeMb = accessDetails.fileSizeBytes ? (accessDetails.fileSizeBytes / (1024 * 1024)).toFixed(1) : '';
    const sizeKb = accessDetails.fileSizeBytes ? Math.round(accessDetails.fileSizeBytes / 1024) : 0;
    const formattedSize = Number(sizeMb) >= 1 ? `${sizeMb} MB` : `${sizeKb} KB`;

    const mime = accessDetails.mimeType || '';
    const isPdf = mime.includes('pdf');
    const isSpreadsheet = mime.includes('excel') || mime.includes('spreadsheet') || mime.includes('csv');
    const isCodeOrTxt = mime.includes('text/plain') || mime.includes('text/csv');

    const typeLabel = isPdf ? 'PDF Document' : isSpreadsheet ? 'Spreadsheet' : isCodeOrTxt ? 'Text File' : 'Document';

    return (
      <div
        title={isSelf ? (isRead ? 'Read' : 'Sent, not read') : undefined}
        aria-label={isSelf ? (isRead ? 'Read' : 'Sent, not read') : undefined}
        className={`p-3 rounded-2xl flex flex-col space-y-2.5 max-w-[280px] sm:max-w-[320px] transition-colors duration-300 ${
          isSelf
            ? isRead
              ? 'bg-blue-600 text-white rounded-br-xs shadow-xs'
              : 'bg-slate-600 text-white rounded-br-xs shadow-xs'
            : 'bg-slate-100 dark:bg-[#1E293B] text-slate-900 dark:text-white border border-slate-200/60 dark:border-slate-800 rounded-bl-xs shadow-xs'
        }`}
      >
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isSelf ? 'bg-white/20 text-white' : 'bg-emerald-600/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
          }`}>
            {isSpreadsheet ? (
              <FileSpreadsheet className="w-5 h-5" />
            ) : isCodeOrTxt ? (
              <FileCode className="w-5 h-5" />
            ) : (
              <FileText className="w-5 h-5" />
            )}
          </div>

          <div className="flex-1 min-w-0 text-left">
            <h4 className="text-xs font-bold truncate">{typeLabel}</h4>
            <div className="flex items-center space-x-2 text-[10px] opacity-80 font-mono">
              <span>{formattedSize}</span>
            </div>
          </div>
        </div>

        <div className="pt-1 flex items-center space-x-2">
          {/* For PDF: Open in new tab + Download */}
          {isPdf ? (
            <>
              <a
                href={accessDetails.accessUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-sm ${
                  isSelf
                    ? isRead
                      ? 'bg-white text-blue-700 hover:bg-blue-50'
                      : 'bg-white text-slate-800 hover:bg-slate-100'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
                title="Open PDF in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                <span>Open</span>
              </a>

              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className={`py-1.5 px-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-sm disabled:opacity-50 ${
                  isSelf
                    ? 'bg-white/20 text-white hover:bg-white/30 border border-white/20'
                    : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 border border-slate-300/50 dark:border-slate-600/50'
                }`}
                title="Download document"
              >
                {isDownloading ? (
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
                ) : (
                  <Download className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>Download</span>
              </button>
            </>
          ) : (
            /* For non-PDF documents: Download action */
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-sm disabled:opacity-50 ${
                isSelf
                  ? isRead
                    ? 'bg-white text-blue-700 hover:bg-blue-50'
                    : 'bg-white text-slate-800 hover:bg-slate-100'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
              title="Download document"
            >
              {isDownloading ? (
                <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
              ) : (
                <Download className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>Download Document</span>
            </button>
          )}
        </div>

        {downloadError && (
          <div className="text-[10px] text-rose-300 dark:text-rose-400 font-medium px-1">
            {downloadError}
          </div>
        )}
      </div>
    );
  }

  return null;
}
