import React, { useRef, useState } from 'react';
import { Image, Video, Paperclip, AlertCircle, X, FileText } from 'lucide-react';
import { MAX_IMAGE_SIZE_BYTES, MAX_VIDEO_SIZE_BYTES, MAX_DOCUMENT_SIZE_BYTES, ALLOWED_MIME_TYPES } from '../../lib/mediaValidation';

interface MediaAttachmentPickerProps {
  onFileSelected: (file: File, mediaType: 'image' | 'video' | 'document', previewUrl: string, durationMs?: number, width?: number, height?: number) => void;
  disabled?: boolean;
  documentEnabled?: boolean;
}

export default function MediaAttachmentPicker({ onFileSelected, disabled = false, documentEnabled = false }: MediaAttachmentPickerProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const documentInputRef = useRef<HTMLInputElement | null>(null);

  // Client-side Image compression helper (Preserves GIF as animated GIF without canvas conversion)
  const compressImage = async (file: File): Promise<{ compressedBlob: Blob; width: number; height: number }> => {
    // Preserve GIF as animated GIF directly
    if (file.type === 'image/gif') {
      return new Promise((resolve) => {
        const img = new window.Image();
        const url = URL.createObjectURL(file);
        img.src = url;
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve({ compressedBlob: file, width: img.width, height: img.height });
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve({ compressedBlob: file, width: 0, height: 0 });
        };
      });
    }

    return new Promise((resolve) => {
      const img = new window.Image();
      const url = URL.createObjectURL(file);
      img.src = url;

      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        const maxEdge = 1920;

        if (width > maxEdge || height > maxEdge) {
          if (width > height) {
            height = Math.round((height * maxEdge) / width);
            width = maxEdge;
          } else {
            width = Math.round((width * maxEdge) / height);
            height = maxEdge;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve({ compressedBlob: blob, width, height });
              } else {
                resolve({ compressedBlob: file, width: img.width, height: img.height });
              }
            },
            file.type === 'image/png' ? 'image/png' : 'image/jpeg',
            0.85
          );
        } else {
          resolve({ compressedBlob: file, width: img.width, height: img.height });
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ compressedBlob: file, width: 0, height: 0 });
      };
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    setShowMenu(false);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!ALLOWED_MIME_TYPES.image.includes(file.type)) {
      setErrorMsg('Invalid image type. Please choose JPEG, PNG, WEBP, or GIF.');
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setErrorMsg('Image size exceeds maximum limit of 10MB.');
      return;
    }

    try {
      const { compressedBlob, width, height } = await compressImage(file);
      const compressedFile = new File([compressedBlob], file.name, { type: compressedBlob.type || file.type });
      const previewUrl = URL.createObjectURL(compressedFile);
      onFileSelected(compressedFile, 'image', previewUrl, undefined, width, height);
    } catch (err) {
      const previewUrl = URL.createObjectURL(file);
      onFileSelected(file, 'image', previewUrl);
    }

    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    setShowMenu(false);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!ALLOWED_MIME_TYPES.video.includes(file.type)) {
      setErrorMsg('Invalid video type. Please choose MP4 or WebM.');
      return;
    }

    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      setErrorMsg('Video size exceeds maximum limit of 50MB.');
      return;
    }

    const previewUrl = URL.createObjectURL(file);

    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = previewUrl;

    video.onloadedmetadata = () => {
      const durationMs = Math.round(video.duration * 1000);
      if (durationMs > 5 * 60 * 1000) {
        setErrorMsg('Video exceeds maximum duration limit of 5 minutes.');
        URL.revokeObjectURL(previewUrl);
        return;
      }
      onFileSelected(file, 'video', previewUrl, durationMs, video.videoWidth, video.videoHeight);
    };

    video.onerror = () => {
      onFileSelected(file, 'video', previewUrl);
    };

    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const handleDocumentChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    setShowMenu(false);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const cleanType = file.type ? file.type.split(';')[0].trim().toLowerCase() : '';

    if (!cleanType || !ALLOWED_MIME_TYPES.document.includes(cleanType)) {
      setErrorMsg('Invalid document type. Allowed formats: PDF, DOCX, XLSX, PPTX, TXT, CSV.');
      return;
    }

    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      setErrorMsg('Document size exceeds maximum limit of 20MB.');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    onFileSelected(file, 'document', previewUrl);

    if (documentInputRef.current) documentInputRef.current.value = '';
  };

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setShowMenu(!showMenu)}
        aria-label="Attach photo, video, or document"
        className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer disabled:opacity-50"
      >
        <Paperclip className="w-5 h-5" />
      </button>

      {/* Hidden File Inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleImageChange}
        className="hidden"
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/webm"
        onChange={handleVideoChange}
        className="hidden"
      />
      <input
        ref={documentInputRef}
        type="file"
        accept=".pdf,.docx,.xlsx,.pptx,.txt,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv"
        onChange={handleDocumentChange}
        className="hidden"
      />

      {/* Popup Menu */}
      {showMenu && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
          <div className="absolute bottom-12 left-0 z-40 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-1.5 w-44 flex flex-col space-y-1 animate-scale-up">
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="flex items-center space-x-2.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-600 rounded-xl transition-all cursor-pointer text-left"
            >
              <Image className="w-4 h-4 text-purple-500" />
              <span>Photo</span>
            </button>
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              className="flex items-center space-x-2.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-600 rounded-xl transition-all cursor-pointer text-left"
            >
              <Video className="w-4 h-4 text-indigo-500" />
              <span>Video</span>
            </button>
            {documentEnabled && (
              <button
                type="button"
                onClick={() => documentInputRef.current?.click()}
                className="flex items-center space-x-2.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-600 rounded-xl transition-all cursor-pointer text-left"
              >
                <FileText className="w-4 h-4 text-emerald-500" />
                <span>Document</span>
              </button>
            )}
          </div>
        </>
      )}

      {/* Error Toast */}
      {errorMsg && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-rose-950 text-rose-200 text-xs font-bold px-4 py-2.5 rounded-2xl shadow-2xl flex items-center space-x-2 border border-rose-800 animate-bounce">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="ml-2 text-rose-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
