import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Trash2, Send, AlertCircle } from 'lucide-react';

interface VoiceRecorderProps {
  onSendVoiceNote: (audioBlob: Blob, durationMs: number) => void;
  onCancel: () => void;
  disabled?: boolean;
}

export default function VoiceRecorder({ onSendVoiceNote, onCancel, disabled = false }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const startTimeRef = useRef<number>(0);

  // Maximum voice note duration: 5 minutes = 300 seconds
  const MAX_DURATION_SEC = 300;

  useEffect(() => {
    startRecording();
    return () => {
      stopTimer();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, []);

  const startTimer = () => {
    stopTimer();
    setRecordingTime(0);
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setRecordingTime(elapsedSec);

      if (elapsedSec >= MAX_DURATION_SEC) {
        handleStopRecording();
      }
    }, 500);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecording = async () => {
    setErrorMessage(null);
    audioChunksRef.current = [];

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMessage('Microphone recording is not supported in your browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Determine supported MIME type
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        } else {
          mimeType = '';
        }
      }

      const options = mimeType ? { mimeType } : undefined;
      const recorder = new MediaRecorder(stream, options);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const finalMime = recorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: finalMime });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        // Stop all audio tracks to release microphone
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start(200); // Collect data every 200ms
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      startTimer();

    } catch (err: any) {
      console.error('Microphone access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Microphone permission was denied. Please allow access in browser settings.');
      } else {
        setErrorMessage(err.message || 'Could not start microphone recording.');
      }
    }
  };

  const handleStopRecording = () => {
    stopTimer();
    setIsRecording(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const togglePreviewPlay = () => {
    if (!audioPlayerRef.current || !audioUrl) return;
    if (isPlaying) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSend = () => {
    if (!audioBlob) return;
    const durationMs = recordingTime * 1000;
    onSendVoiceNote(audioBlob, durationMs);
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainderSecs = sec % 60;
    return `${mins}:${remainderSecs < 10 ? '0' : ''}${remainderSecs}`;
  };

  if (errorMessage) {
    return (
      <div className="flex items-center justify-between p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl text-xs text-rose-700 dark:text-rose-300 w-full animate-fade-in">
        <div className="flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{errorMessage}</span>
        </div>
        <button
          onClick={onCancel}
          className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 rounded-lg font-bold hover:bg-slate-50 transition-all cursor-pointer"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between bg-slate-900 dark:bg-slate-950 text-white p-3 rounded-2xl w-full shadow-lg border border-purple-500/30 animate-scale-up">
      {isRecording ? (
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
          </span>
          <div className="flex items-center space-x-2">
            <Mic className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-mono font-extrabold text-purple-300 tracking-wider">
              {formatSeconds(recordingTime)}
            </span>
            <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
              (Max 5:00)
            </span>
          </div>
          {/* Animated Waveform Visualizer simulation */}
          <div className="flex items-center space-x-0.5 flex-1 max-w-[120px] sm:max-w-[180px] h-4">
            {[40, 70, 30, 90, 50, 80, 40, 100, 60, 30, 80, 50].map((h, i) => (
              <span
                key={i}
                className="w-1 bg-purple-400/80 rounded-full animate-pulse"
                style={{
                  height: `${Math.max(20, (h * (recordingTime % 3 + 1)) / 3)}%`,
                  animationDelay: `${i * 0.1}s`
                }}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <button
            onClick={togglePreviewPlay}
            aria-label={isPlaying ? 'Pause voice note preview' : 'Play voice note preview'}
            className="w-8 h-8 rounded-full bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <div className="flex flex-col text-left">
            <span className="text-xs font-bold text-slate-200">Voice Note Ready</span>
            <span className="text-[10px] text-slate-400 font-mono">{formatSeconds(recordingTime)}</span>
          </div>
          {audioUrl && (
            <audio
              ref={audioPlayerRef}
              src={audioUrl}
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            />
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center space-x-2 shrink-0 ml-2">
        {isRecording ? (
          <>
            <button
              onClick={onCancel}
              title="Cancel Recording"
              aria-label="Cancel Recording"
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleStopRecording}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-md transition-all cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Done</span>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onCancel}
              title="Discard Voice Note"
              aria-label="Discard Voice Note"
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-all cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleSend}
              disabled={disabled || !audioBlob}
              className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white rounded-xl text-xs font-extrabold flex items-center space-x-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send Voice Note</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
