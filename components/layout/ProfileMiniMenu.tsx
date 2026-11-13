import React from 'react';
import { ICON_MAP } from '../../constants';
import { User } from '../../types';

export type AvailabilityStatus = 'available' | 'away' | 'busy';

export const StatusDynamicIcon: React.FC<{
  status: AvailabilityStatus;
  className?: string;
}> = ({ status, className = 'w-3.5 h-3.5' }) => {
  if (status === 'available') {
    return (
      <svg
        viewBox="0 0 16 16"
        fill="none"
        className={className}
        aria-label="Available"
      >
        <circle cx="8" cy="8" r="7" className="fill-emerald-500 stroke-white dark:stroke-[#141712]" strokeWidth="1.25" />
        <path
          d="M5.2 8.2L7.1 10.1L10.9 6.1"
          stroke="white"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (status === 'away') {
    return (
      <svg
        viewBox="0 0 16 16"
        fill="none"
        className={className}
        aria-label="Away"
      >
        <circle cx="8" cy="8" r="7" className="fill-amber-500 stroke-white dark:stroke-[#141712]" strokeWidth="1.25" />
        <path
          d="M8 4.6V8.2L10.3 9.7"
          stroke="white"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-label="Busy / DND"
    >
      <circle cx="8" cy="8" r="7" className="fill-rose-500 stroke-white dark:stroke-[#141712]" strokeWidth="1.25" />
      <path
        d="M5.2 8H10.8"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
};

interface ProfileMiniMenuProps {
  currentUser: User;
  currentOrganizationName?: string;
  normalizedRole: string;
  myStatus: AvailabilityStatus;
  onStatusChange: (status: AvailabilityStatus) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onNavigateProfile: () => void;
  onManageOrganization: () => void;
  canViewSystemLogs?: boolean;
  onOpenSystemLogs: () => void;
  onOpenShortcuts: () => void;
  onSignOut: () => void;
  onClose: () => void;
}

export const ProfileMiniMenu: React.FC<ProfileMiniMenuProps> = ({
  currentUser,
  currentOrganizationName,
  normalizedRole,
  myStatus,
  onStatusChange,
  darkMode,
  onToggleDarkMode,
  onNavigateProfile,
  onManageOrganization,
  canViewSystemLogs = false,
  onOpenSystemLogs,
  onOpenShortcuts,
  onSignOut,
  onClose,
}) => {
  return (
    <div className="text-xs">
      <div className="px-3.5 py-2.5 border-b border-[var(--border-hairline)]">
        <p className="font-bold text-[var(--text-primary)] truncate">
          {currentUser.full_name || currentUser.email}
        </p>
        <p className="text-[11px] text-[var(--text-muted)] truncate">{currentUser.email}</p>
        <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-secondary)] mt-1">
          {normalizedRole.replace(/_/g, ' ')} · {currentOrganizationName || 'Personal'}
        </p>
      </div>

      <div className="px-3 py-2 border-b border-[var(--border-hairline)] grid grid-cols-3 gap-1">
        {(['available', 'away', 'busy'] as const).map(st => (
          <button
            key={st}
            type="button"
            onClick={() => onStatusChange(st)}
            className={`py-1.5 px-1.5 rounded-lg text-[11px] font-medium capitalize border inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              myStatus === st
                ? 'bg-[var(--bg-sage)] border-[var(--border-strong)] text-[var(--text-primary)] font-semibold'
                : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)]'
            }`}
          >
            <StatusDynamicIcon status={st} className="w-3.5 h-3.5 shrink-0" />
            <span>{st}</span>
          </button>
        ))}
      </div>

      <div className="p-1.5 space-y-0.5">
        <button
          type="button"
          onClick={() => {
            onNavigateProfile();
            onClose();
          }}
          className="w-full flex items-center gap-2.5 text-left px-2.5 py-1.5 rounded-xl hover:bg-[var(--bg-sage)] text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          <ICON_MAP.UserCircleIcon className="w-4 h-4 shrink-0 text-[var(--text-secondary)]" />
          <span className="truncate">Profile &amp; Workspace Settings</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onManageOrganization();
            onClose();
          }}
          className="w-full flex items-center gap-2.5 text-left px-2.5 py-1.5 rounded-xl hover:bg-[var(--bg-sage)] text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          <ICON_MAP.BuildingOfficeIcon className="w-4 h-4 shrink-0 text-[var(--text-secondary)]" />
          <span className="truncate">Switch / Manage Organization</span>
        </button>

        <button
          type="button"
          onClick={onToggleDarkMode}
          className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl hover:bg-[var(--bg-sage)] text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2.5 truncate">
            {darkMode ? (
              <ICON_MAP.SunIcon className="w-4 h-4 shrink-0 text-[var(--text-secondary)]" />
            ) : (
              <ICON_MAP.MoonIcon className="w-4 h-4 shrink-0 text-[var(--text-secondary)]" />
            )}
            <span>Appearance</span>
          </span>
          <span className="text-[11px] font-mono text-[var(--text-muted)] shrink-0">
            {darkMode ? 'Dark' : 'Light'}
          </span>
        </button>

        {canViewSystemLogs && (
          <button
            type="button"
            onClick={() => {
              onOpenSystemLogs();
              onClose();
            }}
            className="w-full flex items-center gap-2.5 text-left px-2.5 py-1.5 rounded-xl hover:bg-[var(--bg-sage)] text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <ICON_MAP.TerminalIcon className="w-4 h-4 shrink-0 text-[var(--text-secondary)]" />
            <span className="truncate">System Log Monitor</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            onOpenShortcuts();
            onClose();
          }}
          className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl hover:bg-[var(--bg-sage)] text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2.5 truncate">
            <ICON_MAP.KeyboardIcon className="w-4 h-4 shrink-0 text-[var(--text-secondary)]" />
            <span>Keyboard Shortcuts</span>
          </span>
          <kbd className="font-mono text-[10px] text-[var(--text-muted)] shrink-0">?</kbd>
        </button>
      </div>

      <div className="px-1.5 pt-1 border-t border-[var(--border-hairline)]">
        <button
          type="button"
          onClick={() => {
            onClose();
            onSignOut();
          }}
          className="w-full flex items-center gap-2.5 text-left px-2.5 py-1.5 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 font-medium transition-colors cursor-pointer"
        >
          <ICON_MAP.LogoutIcon className="w-4 h-4 shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};
