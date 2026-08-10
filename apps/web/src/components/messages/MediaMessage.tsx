import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Image as ImageIcon, Film, Mic, AlertCircle, X, Maximize2, Volume2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface MediaMessageProps {
  messageId: string;
  mediaType: 'image' | 'video' | 'audio' | string;
  isSelf: boolean;
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

export default function MediaMessage({ messageId, mediaType, isSelf }: MediaMessageProps) {
  const [accessDetails, setAccessDetails] = useState<MediaAccessDetails | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);

  // Audio Player State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [durationSec, setDurationSec] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Video Player State
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

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
          body: JSON.stringify({ messageId })
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
          durationMs: data.durationMs,
          width: data.width,
          height: data.height
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
  }, [messageId]);

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

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2 py-2 px-3 bg-slate-100/50 dark:bg-slate-800/50 rounded-xl text-xs text-slate-400 animate-pulse">
        <div className="w-3.5 h-3.5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        <span>Loading media...</span>
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
      <div className={`p-2.5 rounded-2xl flex flex-col space-y-2 min-w-[200px] max-w-[280px] ${
        isSelf 
          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white' 
          : 'bg-slate-100 dark:bg-[#1E293B] text-slate-900 dark:text-white border border-slate-200/60 dark:border-slate-800'
      }`}>
        <div className="flex items-center space-x-2.5">
          <button
            onClick={toggleAudioPlay}
            aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-sm ${
              isSelf ? 'bg-white text-purple-700 hover:bg-purple-50' : 'bg-purple-600 text-white hover:bg-purple-500'
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
                className={`h-full transition-all duration-100 ${isSelf ? 'bg-white' : 'bg-purple-600 dark:bg-purple-400'}`}
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
        <div className="relative group overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 max-w-[280px] sm:max-w-[320px]">
          <img
            src={accessDetails.accessUrl}
            alt="Attachment"
            loading="lazy"
            onClick={() => setIsLightboxOpen(true)}
            className="w-full h-auto max-h-[260px] object-cover rounded-2xl cursor-pointer hover:opacity-95 transition-opacity"
          />
          <button
            onClick={() => setIsLightboxOpen(true)}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 cursor-pointer"
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

  // 3. VIDEO
  if (mediaType === 'video' || accessDetails.mediaType === 'video') {
    const durationText = accessDetails.durationMs ? `${Math.floor(accessDetails.durationMs / 1000)}s` : '';

    return (
      <div className="relative group overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-black max-w-[280px] sm:max-w-[340px]">
        {!isVideoPlaying ? (
          <div className="relative flex items-center justify-center min-h-[160px]">
            <video
              src={accessDetails.accessUrl}
              preload="metadata"
              className="w-full h-auto max-h-[240px] object-cover opacity-80"
            />
            <button
              onClick={() => {
                setIsVideoPlaying(true);
                setTimeout(() => videoRef.current?.play(), 100);
              }}
              aria-label="Play video"
              className="absolute w-12 h-12 rounded-full bg-purple-600/90 hover:bg-purple-500 text-white flex items-center justify-center transition-all cursor-pointer shadow-lg hover:scale-110"
            >
              <Play className="w-6 h-6 ml-1" />
            </button>
            {durationText && (
              <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/70 text-white text-[10px] font-mono font-bold">
                {durationText}
              </span>
            )}
          </div>
        ) : (
          <video
            ref={videoRef}
            src={accessDetails.accessUrl}
            controls
            autoPlay
            onEnded={() => setIsVideoPlaying(false)}
            className="w-full h-auto max-h-[280px] rounded-2xl"
          />
        )}
      </div>
    );
  }

  return null;
}
