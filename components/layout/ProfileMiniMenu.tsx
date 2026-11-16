import React from 'react';
import { motion } from 'motion/react';
import { ICON_MAP } from '../../constants';
import { AmbientIntensity, AvailabilityStatus, User, WorkspaceAccentId } from '../../types';
import { GLASS_SPRING } from '../shared/LiquidGlass';
import { PaletteEnvironmentSelector } from '../shared/PaletteEnvironmentSelector';

export type { AvailabilityStatus };

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
  accentColor: WorkspaceAccentId;
  onSelectAccent: (accent: WorkspaceAccentId) => void;
  ambientIntensity: AmbientIntensity;
  onSelectIntensity: (intensity: AmbientIntensity) => void;
  autoCyclePalette: boolean;
  onToggleAutoCyclePalette: () => void;
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
  accentColor,
  onSelectAccent,
  ambientIntensity,
  onSelectIntensity,
  autoCyclePalette,
  onToggleAutoCyclePalette,
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
        <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-secondary)] mt-1 truncate">
          {normalizedRole.replace(/_/g, ' ')} · {currentOrganizationName || 'Personal'}
        </p>
      </div>

      <div className="px-3 py-2 border-b border-[var(--border-hairline)] grid grid-cols-3 gap-1">
        {(['available', 'away', 'busy'] as const).map(st => {
          const isSelected = myStatus === st;
          return (
            <motion.button
              key={st}
              type="button"
              whileTap={{ scale: 0.95 }}
              transition={GLASS_SPRING.micro}
              onClick={() => onStatusChange(st)}
              className={`relative py-1.5 px-1.5 rounded-lg text-[11px] font-medium capitalize inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                isSelected
                  ? 'text-[var(--text-primary)] font-semibold'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)]'
              }`}
            >
              {isSelected && (
                <motion.span
                  layoutId="profile-status-active-pill"
                  transition={GLASS_SPRING.morph}
                  className="absolute inset-0 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent-border)] shadow-[inset_0_1px_0_var(--glass-highlight)]"
                  aria-hidden="true"
                />
              )}
              <StatusDynamicIcon status={st} className="relative z-10 w-3.5 h-3.5 shrink-0" />
              <span className="relative z-10">{st}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Grouped Atmosphere, Appearance (Light/Dark) & Daily Auto-Cycle Controls */}
      <div className="px-3 py-2.5 border-b border-[var(--border-hairline)] space-y-2">
        <PaletteEnvironmentSelector
          compact
          darkMode={darkMode}
          accentColor={accentColor}
          onSelectAccent={onSelectAccent}
          ambientIntensity={ambientIntensity}
          onSelectIntensity={onSelectIntensity}
        />

        <div className="space-y-1.5 pt-0.5">
          <motion.button
            type="button"
            whileTap={{ scale: 0.985 }}
            transition={GLASS_SPRING.micro}
            onClick={onToggleDarkMode}
            className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-[var(--surface-nested-subtle)] hover:bg-[var(--accent-subtle)] border border-[var(--border-hairline)] text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5 text-[11px] font-medium truncate">
              {darkMode ? (
                <ICON_MAP.MoonIcon className="w-3.5 h-3.5 shrink-0 text-[var(--accent-text)]" />
              ) : (
                <ICON_MAP.SunIcon className="w-3.5 h-3.5 shrink-0 text-amber-500" />
              )}
              <span>Appearance</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--surface-glass-2)] border border-[var(--glass-border)] text-[var(--text-primary)] shrink-0">
              {darkMode ? 'Dark' : 'Light'}
            </span>
          </motion.button>

          <motion.button
            type="button"
            role="switch"
            aria-checked={autoCyclePalette}
            whileTap={{ scale: 0.98 }}
            transition={GLASS_SPRING.micro}
            onClick={onToggleAutoCyclePalette}
            className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-[var(--surface-nested-subtle)] hover:bg-[var(--accent-subtle)] border border-[var(--border-hairline)] transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-primary)] truncate">
              <ICON_MAP.ClockIcon className="w-3.5 h-3.5 text-[var(--text-secondary)] shrink-0" />
              <span className="truncate">Auto-cycle theme · Daily</span>
            </span>
            <span
              className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors duration-200 ${
                autoCyclePalette ? 'bg-[var(--accent)]' : 'bg-[var(--border-strong)]'
              }`}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-[var(--bg-surface)] shadow-xs transition-transform duration-200 ${
                  autoCyclePalette ? 'translate-x-3.5' : 'translate-x-0.5'
                }`}
              />
            </span>
          </motion.button>
        </div>
      </div>

      <div className="p-1.5 space-y-0.5">
        <motion.button
          type="button"
          whileTap={{ scale: 0.985 }}
          transition={GLASS_SPRING.micro}
          onClick={() => {
            onNavigateProfile();
            onClose();
          }}
          className="w-full flex items-center gap-2.5 text-left px-2.5 py-1.5 rounded-xl hover:bg-[var(--bg-sage)] text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          <ICON_MAP.UserCircleIcon className="w-4 h-4 shrink-0 text-[var(--text-secondary)]" />
          <span className="truncate">Profile &amp; Workspace Settings</span>
        </motion.button>

        <motion.button
          type="button"
          whileTap={{ scale: 0.985 }}
          transition={GLASS_SPRING.micro}
          onClick={() => {
            onManageOrganization();
            onClose();
          }}
          className="w-full flex items-center gap-2.5 text-left px-2.5 py-1.5 rounded-xl hover:bg-[var(--bg-sage)] text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          <ICON_MAP.BuildingOfficeIcon className="w-4 h-4 shrink-0 text-[var(--text-secondary)]" />
          <span className="truncate">Switch / Manage Organization</span>
        </motion.button>

        {canViewSystemLogs && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.985 }}
            transition={GLASS_SPRING.micro}
            onClick={() => {
              onOpenSystemLogs();
              onClose();
            }}
            className="w-full flex items-center gap-2.5 text-left px-2.5 py-1.5 rounded-xl hover:bg-[var(--bg-sage)] text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <ICON_MAP.TerminalIcon className="w-4 h-4 shrink-0 text-[var(--text-secondary)]" />
            <span className="truncate">System Log Monitor</span>
          </motion.button>
        )}

        <motion.button
          type="button"
          whileTap={{ scale: 0.985 }}
          transition={GLASS_SPRING.micro}
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
        </motion.button>
      </div>

      <div className="px-1.5 pt-1 border-t border-[var(--border-hairline)]">
        <motion.button
          type="button"
          whileTap={{ scale: 0.985 }}
          transition={GLASS_SPRING.micro}
          onClick={() => {
            onClose();
            onSignOut();
          }}
          className="w-full flex items-center gap-2.5 text-left px-2.5 py-1.5 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 font-medium transition-colors cursor-pointer"
        >
          <ICON_MAP.LogoutIcon className="w-4 h-4 shrink-0" />
          <span>Sign Out</span>
        </motion.button>
      </div>
    </div>
  );
};
