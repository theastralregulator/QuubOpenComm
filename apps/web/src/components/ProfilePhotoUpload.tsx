import React, { useState, useRef } from 'react';
import { Camera, Upload, X, ZoomIn, ZoomOut, AlertCircle, Trash2, RefreshCw } from 'lucide-react';
import { dbService } from '../lib/supabase';

interface ProfilePhotoUploadProps {
  value: string;
  onChange: (url: string) => void;
  onFileChange?: (file: File | null) => void;
  userId: string;
  supabase: any;
  triggerToast?: (msg: string) => void;
}

export const ProfilePhotoUpload: React.FC<ProfilePhotoUploadProps> = ({
  value,
  onChange,
  onFileChange,
  userId,
  supabase,
  triggerToast
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(value || null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [originalFilename, setOriginalFilename] = useState<string>('profile.jpg');

  const prevBlobUrlRef = useRef<string | null>(null);

  React.useEffect(() => {
    return () => {
      if (prevBlobUrlRef.current) {
        URL.revokeObjectURL(prevBlobUrlRef.current);
      }
    };
  }, []);

  // Crop & zoom states
  const [zoom, setZoom] = useState(1.0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropContainerRef = useRef<HTMLDivElement>(null);

  // Helper to sanitize filename
  const sanitizeFilename = (filename: string): string => {
    const parts = filename.split('.');
    const ext = parts.length > 1 ? parts.pop()?.toLowerCase() || 'jpg' : 'jpg';
    const nameWithoutExt = parts.join('.');
    
    const sanitized = nameWithoutExt
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-_]/g, '');
      
    return `${sanitized || 'avatar'}.${ext}`;
  };

  // Validations
  const validateAndProcessFile = (file: File) => {
    setError(null);
    setOriginalFilename(file.name || 'profile.jpg');

    // Format validation
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Unsupported file type. Only JPG, JPEG, PNG, and WEBP formats are accepted.');
      return;
    }

    // Size validation (Max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size exceeds the 5 MB limit.');
      return;
    }

    // Resolution check
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        if (img.naturalWidth < 400 || img.naturalHeight < 400) {
          setError(`Image is too small (${img.naturalWidth}x${img.naturalHeight}px). Recommended resolution is at least 400x400 px.`);
          return;
        }

        // Open crop modal
        setImageSrc(img.src);
        setZoom(1.0);
        setPosition({ x: 0, y: 0 });
        setShowCropModal(true);
      };
      img.onerror = () => {
        setError('Failed to load selected image.');
      };
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndProcessFile(e.target.files[0]);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndProcessFile(e.dataTransfer.files[0]);
    }
  };

  // Panning handlers (Pointer events)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.preventDefault();
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleCropSave = async () => {
    if (!imageSrc) return;
    setIsUploading(true);
    setError(null);

    try {
      const img = new Image();
      img.src = imageSrc;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to create canvas context.');

      // Fill canvas with clean white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 512, 512);

      const viewportSize = 256;
      let displayWidth = viewportSize;
      let displayHeight = viewportSize;
      const imgAspect = img.width / img.height;

      // Handle CSS object-contain size mapping
      if (imgAspect > 1) {
        displayWidth = viewportSize;
        displayHeight = viewportSize / imgAspect;
      } else {
        displayWidth = viewportSize * imgAspect;
        displayHeight = viewportSize;
      }

      // Calculate the transformed center of the image in viewport space
      const centerX = viewportSize / 2 + position.x;
      const centerY = viewportSize / 2 + position.y;

      // Calculate the transformed top-left corner of the image
      const renderedLeft = centerX - (displayWidth * zoom) / 2;
      const renderedTop = centerY - (displayHeight * zoom) / 2;

      // The crop boundary is a 192x192 circle, centered in the 256x256 viewport
      const cropLeft = (viewportSize - 192) / 2; // 32
      const cropTop = (viewportSize - 192) / 2; // 32

      // Crop area coordinates relative to the rendered scaled image
      const cropXInImage = cropLeft - renderedLeft;
      const cropYInImage = cropTop - renderedTop;

      // Map back to original image scale
      const scale = img.naturalWidth / (displayWidth * zoom);

      const sx = cropXInImage * scale;
      const sy = cropYInImage * scale;
      const sWidth = 192 * scale;
      const sHeight = 192 * scale;

      ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, 512, 512);

      // Convert to blob and call callbacks
      canvas.toBlob(async (blob) => {
        if (!blob) {
          setError('Failed to generate cropped image.');
          setIsUploading(false);
          return;
        }

        try {
          const croppedFile = new File(
            [blob],
            `avatar-${Date.now()}.jpg`,
            {
              type: 'image/jpeg',
              lastModified: Date.now()
            }
          );

          const croppedPreviewUrl = URL.createObjectURL(croppedFile);

          // Revoke the old object URL if it exists
          if (prevBlobUrlRef.current) {
            URL.revokeObjectURL(prevBlobUrlRef.current);
          }
          prevBlobUrlRef.current = croppedPreviewUrl;

          // Call callbacks
          if (onFileChange) {
            onFileChange(croppedFile);
          }
          onChange(croppedPreviewUrl);
          setCroppedImage(croppedPreviewUrl);

          if (triggerToast) {
            triggerToast('Crop applied successfully.');
          }

          setIsUploading(false);
          setShowCropModal(false);
        } catch (cropErr: any) {
          console.error('Failed to create cropped file/URL:', cropErr);
          setError('Failed to generate cropped image.');
          setIsUploading(false);
        }
      }, 'image/jpeg', 0.90);

    } catch (err: any) {
      console.error(err);
      setError('An error occurred while cropping the image.');
      setIsUploading(false);
    }
  };

  const handleRemovePhoto = () => {
    if (prevBlobUrlRef.current) {
      URL.revokeObjectURL(prevBlobUrlRef.current);
      prevBlobUrlRef.current = null;
    }
    setCroppedImage(null);
    onChange('');
    if (onFileChange) {
      onFileChange(null);
    }
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (triggerToast) triggerToast('Profile photo removed.');
  };

  return (
    <div className="w-full flex flex-col items-center space-y-4 py-2" id="profile-photo-upload-container">
      {/* Upload Circle */}
      <div 
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="w-28 h-28 md:w-32 md:h-32 rounded-full border-2 border-dashed border-slate-300 dark:border-[#273449] flex flex-col items-center justify-center relative overflow-hidden transition-all bg-slate-50/50 dark:bg-zinc-950/40 cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/10 group focus:outline-none touch-manipulation"
        id="avatar-upload-area"
      >
        {croppedImage ? (
          <div className="w-full h-full relative group">
            <img 
              src={croppedImage} 
              alt="Profile avatar" 
              className="w-full h-full object-cover rounded-full" 
              referrerPolicy="no-referrer"
            />
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white space-y-1">
              <Camera className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Change</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-3 space-y-1.5 text-slate-400 dark:text-zinc-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-zinc-900 flex items-center justify-center shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <span className="text-[11px] font-black block">Upload Photo</span>
              <span className="text-[9px] font-medium block leading-none">JPG, PNG, WEBP</span>
            </div>
          </div>
        )}
      </div>

      <input 
        type="file" 
        ref={fileInputRef}
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Upload / Change & Delete buttons */}
      {croppedImage && (
        <div className="flex items-center space-x-3.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-1.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700/80 text-slate-700 dark:text-slate-200 text-[11px] font-bold rounded-lg transition-colors cursor-pointer flex items-center space-x-1.5"
            id="btn-change-photo"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Change Photo</span>
          </button>
          <button
            type="button"
            onClick={handleRemovePhoto}
            className="px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-[11px] font-bold rounded-lg transition-colors cursor-pointer flex items-center space-x-1.5"
            id="btn-remove-photo"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Remove</span>
          </button>
        </div>
      )}

      {/* Validation Error Banner */}
      {error && (
        <div className="w-full p-3 bg-rose-500/10 border border-rose-500/15 rounded-xl flex items-start space-x-2.5 text-rose-600 dark:text-rose-400 text-[11px] font-medium leading-relaxed animate-shake" id="photo-upload-error">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Drag & Drop Help message if no image */}
      {!croppedImage && !error && (
        <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium text-center max-w-xs">
          Drag & drop your image here or tap the circular area above. Recommended resolution: 400x400 px or higher (Max 5 MB).
        </p>
      )}

      {/* Crop Modal */}
      {showCropModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn" id="crop-modal-overlay">
          <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-[#273449] w-full max-w-sm overflow-hidden shadow-2xl p-5 sm:p-6 space-y-5 text-left relative" id="crop-modal-card">
            <div className="flex justify-between items-center pb-1">
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-mono tracking-widest font-extrabold text-indigo-600 dark:text-indigo-400 block">Step 2: Adjust Image</span>
                <h4 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">Crop & Reposition</h4>
              </div>
              <button 
                type="button" 
                onClick={() => setShowCropModal(false)}
                className="w-8 h-8 rounded-full bg-slate-50 dark:bg-zinc-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Interactive Crop Container */}
            <div 
              ref={cropContainerRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="relative w-64 h-64 mx-auto overflow-hidden bg-slate-950 rounded-2xl flex items-center justify-center cursor-move select-none touch-none border border-slate-200 dark:border-[#273449]"
              id="crop-interactive-viewport"
            >
              {imageSrc && (
                <img
                  src={imageSrc}
                  alt="Crop preview src"
                  style={{
                    transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                    transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                    maxHeight: '100%',
                    maxWidth: '100%',
                    pointerEvents: 'none'
                  }}
                  className="object-contain"
                />
              )}

              {/* Custom Square Crop Overlay Mask (1:1 Aspect Ratio) */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-48 h-48 rounded-2xl border-2 border-white shadow-[0_0_0_9999px_rgba(15,23,42,0.65)] relative">
                  {/* Subtle inner grid lines for alignment */}
                  <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none border border-white/20">
                    <div className="border-r border-white/10" />
                    <div className="border-r border-white/10" />
                    <div />
                  </div>
                </div>
              </div>
            </div>

            {/* Scale / Zoom controls */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-extrabold text-slate-500 dark:text-zinc-400 font-mono uppercase tracking-wider">
                <span>Zoom Level</span>
                <span>{Math.round(zoom * 100)}%</span>
              </div>
              <div className="flex items-center space-x-2.5">
                <button
                  type="button"
                  onClick={() => setZoom(prev => Math.max(1.0, prev - 0.1))}
                  className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700/80 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <input
                  type="range"
                  min="1.0"
                  max="3.0"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="flex-1 h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setZoom(prev => Math.min(3.0, prev + 0.1))}
                  className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700/80 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium text-center">
                Drag photo to reposition inside the 1:1 square crop area.
              </p>
            </div>

            {/* Crop modal action buttons */}
            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCropModal(false)}
                className="flex-1 h-10 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800/50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isUploading}
                onClick={handleCropSave}
                className="flex-1 h-10 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                id="btn-apply-crop"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Apply Crop</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
