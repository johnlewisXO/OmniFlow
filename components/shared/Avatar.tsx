
import React from 'react';
import { User } from '../../types';
import { ICON_MAP } from '../../constants';

interface AvatarProps {
  user?: User;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ user, size = 'md', className }) => {
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
  };

  const UserIcon = ICON_MAP.UserCircleIcon;
  const displayName = user?.full_name || user?.email || 'User';

  if (!user || !user.avatar_url) {
    const nameForInitials = user?.full_name || user?.email || '';
    const initials = nameForInitials 
      ? nameForInitials.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase() 
      : <UserIcon className="w-full h-full p-1"/>;
      
    return (
      <div
        className={`flex items-center justify-center rounded-full bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-200 ${sizeClasses[size]} ${className || ''}`}
        title={displayName}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={user.avatar_url}
      alt={displayName}
      title={displayName}
      className={`rounded-full object-cover ${sizeClasses[size]} ${className || ''}`}
    />
  );
};