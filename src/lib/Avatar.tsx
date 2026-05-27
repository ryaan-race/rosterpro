import React, { useState } from 'react';
import { User, Users } from 'lucide-react';
import { cn } from './utils';

interface AvatarProps {
  key?: React.Key;
  src?: string | null;
  alt?: string;
  className?: string;
  fallback?: 'user' | 'users' | 'initials';
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Avatar({ src, alt, className, fallback = 'user', name, size = 'md' }: AvatarProps) {
  const [error, setError] = useState(false);

  const sizeClasses = {
    sm: 'w-8 h-8 rounded-lg text-[10px]',
    md: 'w-10 h-10 rounded-xl text-xs',
    lg: 'w-12 h-12 rounded-2xl text-sm',
    xl: 'w-24 h-24 rounded-[2rem] text-xl',
  };

  const showPlaceholder = error || !src;

  const getInitials = (n?: string) => {
    if (!n) return '';
    return n.split(' ').map(part => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className={cn(
      "relative flex items-center justify-center overflow-hidden bg-slate-100 text-slate-400 shrink-0",
      sizeClasses[size],
      className
    )}>
      {showPlaceholder ? (
        fallback === 'initials' && name ? (
          <span className="font-black uppercase tracking-tighter text-indigo-600 bg-indigo-50 w-full h-full flex items-center justify-center">
            {getInitials(name)}
          </span>
        ) : fallback === 'users' ? (
          <Users className="w-1/2 h-1/2 opacity-50" />
        ) : (
          <User className="w-1/2 h-1/2 opacity-50" />
        )
      ) : (
        <img
          src={src!}
          alt={alt || "Avatar"}
          className="w-full h-full object-cover"
          onError={() => setError(true)}
          referrerPolicy="no-referrer"
        />
      )}
    </div>
  );
}
