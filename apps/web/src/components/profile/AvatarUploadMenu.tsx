import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Image as ImageIcon, Trash2, X, Loader2 } from 'lucide-react';
import { dbService, supabase } from '../../lib/supabase';

interface AvatarUploadMenuProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSuccess: (newUrl: string | null) => void;
  onError: (errorMsg: string) => void;
  currentAvatarUrl?: string | null;
}

export default function AvatarUploadMenu({
  isOpen,
  onClose,
  userId,
  onSuccess,
  onError,
  currentAvatarUrl
}: AvatarUploadMenuProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const MAX_SIZE_MB = 5;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      onError('Unsupported file type. Please upload a JPEG, PNG, or WebP image.');
      return;
    }

    // Validate size
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      onError(`File size exceeds the ${MAX_SIZE_MB} MB limit.`);
      return;
    }

    // Generate local preview immediately
    const objectUrl = URL.createObjectURL(file);
    setLocalPreview(objectUrl);
    setIsUploading(true);

    try {
      console.log('Avatar Upload: Starting upload for', file.name);
      
      // We still use dbService to upload because it handles the storage API correctly
      // But we will intercept it to NOT call updateProfile by creating a raw upload.
      
      // 2. Upload to avatars bucket directly to avoid the buggy updateProfile
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${Date.now()}-profile.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      // retrieve the public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
        
      if (!urlData || !urlData.publicUrl) {
        throw new Error("Failed to get public URL after upload.");
      }
      
      const publicUrl = urlData.publicUrl;
      console.log('Avatar Upload: Public URL retrieved:', publicUrl);

      // 3. Call the existing RPC and await it fully
      console.log('Avatar Upload: Calling update_my_basic_profile with', { p_avatar_url: publicUrl });
      const { data, error } = await supabase.rpc('update_my_basic_profile', {
        p_avatar_url: publicUrl
      });

      // 4. Check the RPC response
      if (error) {
        console.error('Avatar Upload: RPC error:', error);
        throw error;
      }

      console.log('Avatar Upload: RPC response data:', data);

      if (!data || data.avatar_url !== publicUrl) {
        console.error('Avatar Upload: Mismatch! Expected', publicUrl, 'but got', data?.avatar_url);
        throw new Error("Database failed to persist the new avatar URL.");
      }

      console.log('Avatar Upload: Success! Database confirmed the new URL:', data.avatar_url);

      // 5. After the RPC succeeds, pass the new URL up
      onSuccess(publicUrl);
    } catch (err: any) {
      console.error('Avatar Upload: Exception caught:', err);
      onError(err.message || "Failed to upload profile picture.");
      setLocalPreview(null);
    } finally {
      setIsUploading(false);
      URL.revokeObjectURL(objectUrl);
      onClose();
    }
  };

  const handleRemove = async () => {
    setIsUploading(true);
    try {
      console.log('Avatar Upload: Removing avatar...');
      const { data, error } = await supabase.rpc('update_my_basic_profile', {
        p_avatar_url: ''
      });

      if (error) {
        console.error('Avatar Upload: Remove RPC error:', error);
        throw error;
      }

      console.log('Avatar Upload: Remove RPC response:', data);
      onSuccess(null);
    } catch (err: any) {
      console.error('Avatar Upload: Remove Exception caught:', err);
      onError(err.message || "Failed to remove profile picture.");
    } finally {
      setIsUploading(false);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !isUploading && onClose()}
            className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <motion.div
              initial={{ y: '100%', opacity: 1 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 1 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-sm bg-white dark:bg-[#111827] sm:rounded-3xl rounded-t-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
            >
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <span className="font-bold text-slate-900 dark:text-white">Update Profile Photo</span>
                {!isUploading && (
                  <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              <div className="p-4 space-y-2">
                {isUploading ? (
                  <div className="flex flex-col items-center justify-center py-8 space-y-4">
                    {localPreview ? (
                      <div className="relative">
                        <img src={localPreview} alt="Uploading preview" className="w-24 h-24 rounded-full object-cover opacity-50" />
                        <Loader2 className="w-8 h-8 text-purple-600 animate-spin absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                      </div>
                    ) : (
                      <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
                    )}
                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Uploading photo...</span>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => cameraInputRef.current?.click()}
                      className="w-full flex items-center space-x-3 p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                        <Camera className="w-5 h-5" />
                      </div>
                      <div>
                        <strong className="block text-sm text-slate-900 dark:text-white">Take Photo</strong>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Use your device camera</span>
                      </div>
                    </button>

                    <button
                      onClick={() => galleryInputRef.current?.click()}
                      className="w-full flex items-center space-x-3 p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <strong className="block text-sm text-slate-900 dark:text-white">Choose from Gallery</strong>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Upload an existing image</span>
                      </div>
                    </button>

                    {currentAvatarUrl && (
                      <button
                        onClick={handleRemove}
                        className="w-full flex items-center space-x-3 p-4 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400">
                          <Trash2 className="w-5 h-5" />
                        </div>
                        <div>
                          <strong className="block text-sm text-rose-600 dark:text-rose-400">Remove Photo</strong>
                          <span className="text-xs text-rose-500/70">Revert to default initials</span>
                        </div>
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Hidden inputs */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="hidden"
                onChange={handleFileSelect}
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileSelect}
              />
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
