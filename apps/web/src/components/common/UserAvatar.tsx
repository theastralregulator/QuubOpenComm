import React, { useState, useEffect } from 'react';
import { User } from 'lucide-react';

interface UserAvatarProps {
  userId?: string | null;
  avatarUrl?: string | null;
  fullName?: string | null;
  username?: string | null;
  loading?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  className?: string;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
  '2xl': 'w-24 h-24 text-2xl',
  '3xl': 'w-32 h-32 text-4xl',
};

export default function UserAvatar({
  userId,
  avatarUrl,
  fullName,
  username,
  loading = false,
  size = 'md',
  className = '',
}: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);

  // Reset image error and resolved URL whenever userId or avatarUrl changes
  useEffect(() => {
    setImgError(false);
    
    if (avatarUrl && avatarUrl.trim() !== '' && !avatarUrl.includes('api.dicebear.com') && !avatarUrl.includes('images.unsplash.com')) {
      setResolvedUrl(avatarUrl);
    } else {
      setResolvedUrl(null);
    }
  }, [userId, avatarUrl]);

  function getInitials() {
    const source = fullName?.trim() || username?.trim() || 'User';
    return source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('');
  }

  const containerClasses = `relative flex items-center justify-center rounded-full shrink-0 overflow-hidden ${sizeClasses[size]} ${className}`;

  if (loading) {
    return (
      <div className={`${containerClasses} bg-slate-200 dark:bg-slate-800 animate-pulse`} />
    );
  }

  if (resolvedUrl && !imgError) {
    return (
      <div className={`${containerClasses} bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700`}>
        <img
          src={resolvedUrl}
          alt={fullName || username || 'User avatar'}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  // Fallback to initials
  return (
    <div className={`${containerClasses} bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-semibold uppercase tracking-wider`}>
      {getInitials()}
    </div>
  );
}
