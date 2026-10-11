import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { Button } from '../shared/Button';
import { Avatar } from '../shared/Avatar';
import { AnimatedPopover } from '../shared/Modal';
import { collabService, formatAccurateLastSeen } from '../../services/collabService';
import soundService from '../../services/soundService';
import { UserPresence, normalizeUserRole, WORKSPACE_ACCENT_PRESETS, WorkspaceAccentId } from '../../types';

export const StatusDynamicIcon: React.FC<{ status: 'available' | 'away' | 'busy'; className?: string }> = ({ status, className = 'w-4 h-4' }) => {
  if (status === 'available') {
    return (
      <span className={`relative inline-flex items-center justify-center ${className}`}>
        <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 opacity-60"></span>
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-emerald-500">
          <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
        </svg>
      </span>
    );
  }
  if (status === 'away') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-amber-400`}>
        <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-rose-500`}>
      <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-3.75 9a.75.75 0 000 1.5h7.5a.75.75 0 000-1.5h-7.5z" clipRule="evenodd" />
    </svg>
  );
};

export const Header: React.FC = () => {
  const { 
    darkMode, 
    toggleDarkMode, 
    accentColor,
    setAccentColor,
    activeProject, 
    openModal, 
    currentUser, 
    currentOrganization,
    signOut,
    notifications,
    setActiveView,
    addToast,
    toggleMobileSidebar,
    openCommandPalette,
    openShortcutsModal,
    presences,
    users,
    activeTimer,
    pauseTaskTimer,
    resumeTaskTimer,
    stopAndLogTaskTimer,
    tasks,
    openViewTaskModal,
  } = useAppStore();

  const [lastSeenTick, setLastSeenTick] = useState(0);
  const [timerTick, setTimerTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setLastSeenTick(v => v + 1), 10000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!activeTimer?.isRunning) return;
    const t = setInterval(() => setTimerTick(v => v + 1), 1000);
    return () => clearInterval(t);
  }, [activeTimer?.isRunning]);

  const formattedFocusTimer = useMemo(() => {
    if (!activeTimer) return '00:00:00';
    const liveSeconds = activeTimer.isRunning
      ? Math.max(0, Math.floor((Date.now() - activeTimer.startedAt) / 1000))
      : 0;
    const total = Math.max(0, (activeTimer.accumulatedSeconds || 0) + liveSeconds);
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    return [hrs, mins, secs].map(v => String(v).padStart(2, '0')).join(':');
  }, [activeTimer, timerTick]);

  const [myStatus, setMyStatus] = useState<'available' | 'away' | 'busy'>(() => {
    if (typeof window !== 'undefined' && currentUser?.id) {
      try {
        const raw = localStorage.getItem('omni_team_statuses');
        const map = raw ? JSON.parse(raw) : {};
        if (map[currentUser.id]) return map[currentUser.id];
      } catch (e) {}
    }
    return 'available';
  });

  const [isStatusPopoverOpen, setIsStatusPopoverOpen] = useState(false);
  const statusPopoverRef = useRef<HTMLDivElement>(null);

  // UI Sound Preference & Live Visual State Sync Indicator
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => soundService.isEnabled());
  const [recentStateUpdateLabel, setRecentStateUpdateLabel] = useState<string | null>(null);
  const stateUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onSoundPref = (e: CustomEvent) => {
      if (e.detail && typeof e.detail.enabled === 'boolean') {
        setSoundEnabled(e.detail.enabled);
      }
    };
    const onStateUpdated = (e: CustomEvent) => {
      const label = e.detail?.label || 'Synced';
      setRecentStateUpdateLabel(label);
      if (stateUpdateTimerRef.current) clearTimeout(stateUpdateTimerRef.current);
      stateUpdateTimerRef.current = setTimeout(() => {
        setRecentStateUpdateLabel(null);
      }, 2200);
    };
    window.addEventListener('omni_sound_pref_changed', onSoundPref as EventListener);
    window.addEventListener('omni_state_updated', onStateUpdated as EventListener);
    return () => {
      window.removeEventListener('omni_sound_pref_changed', onSoundPref as EventListener);
      window.removeEventListener('omni_state_updated', onStateUpdated as EventListener);
      if (stateUpdateTimerRef.current) clearTimeout(stateUpdateTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const handleStatusSync = (e: CustomEvent) => {
      const payload = e.detail;
      if (payload && currentUser && payload.userId === currentUser.id) {
        setMyStatus(payload.availabilityStatus);
      }
    };
    window.addEventListener('omni_remote_user_status_changed', handleStatusSync as EventListener);
    return () => window.removeEventListener('omni_remote_user_status_changed', handleStatusSync as EventListener);
  }, [currentUser?.id]);

  const handleStatusChange = (newStatus: 'available' | 'away' | 'busy') => {
    setMyStatus(newStatus);
    setIsStatusPopoverOpen(false);
    collabService.broadcastUserStatusChanged(newStatus);
    const label = newStatus === 'available' ? 'Available' : newStatus === 'away' ? 'Away' : 'Busy / DND';
    addToast('Status Broadcast Live', `Your status is now "${label}" across all connected teammates.`, 'info');
  };

  // Deduplicated presences by userId for the header bar, strictly isolated to currentUser.organization_id
  const uniquePresences = useMemo(() => {
    const myOrgId = currentUser?.organization_id;
    if (!currentUser || !myOrgId) return [];

    const map = new Map<string, UserPresence>();
    presences.forEach(p => {
      if (!p || !p.userId) return;
      // Enforce strict multi-tenant organization isolation
      const isSelf = p.userId === currentUser.id;
      const matchesOrgId = p.organizationId === myOrgId;
      const isKnownOrgMember = users.some(
        u =>
          u.organization_id === myOrgId &&
          (u.id === p.userId ||
            (u.email && p.userEmail && u.email.toLowerCase() === p.userEmail.toLowerCase()))
      );

      if (!isSelf && !matchesOrgId && !isKnownOrgMember) {
        return;
      }
      if (p.organizationId && p.organizationId !== myOrgId) {
        return;
      }

      const existing = map.get(p.userId);
      if (!existing) {
        map.set(p.userId, p);
      } else {
        map.set(p.userId, {
          ...existing,
          ...p,
          availabilityStatus: p.availabilityStatus || existing.availabilityStatus,
          currentTaskId: p.currentTaskId || existing.currentTaskId,
          isEditing: Boolean(existing.isEditing || p.isEditing),
        });
      }
    });
    return Array.from(map.values());
  }, [presences, currentUser?.id, currentUser?.organization_id, users, lastSeenTick]);

  const handleAddTaskClick = () => {
    if (!activeProject) {
      addToast('Select a Project Required', 'Please select or create a project from the sidebar to start adding tasks.', 'warning');
      return;
    }
    openModal();
  };

  const [isProfileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  const SunIcon = ICON_MAP.SunIcon;
  const MoonIcon = ICON_MAP.MoonIcon;
  const PlusIcon = ICON_MAP.PlusIcon;
  const LogoutIcon = ICON_MAP.LogoutIcon;
  const BellIcon = ICON_MAP.BellIcon;
  const Bars3Icon = ICON_MAP.Bars3Icon;

  const subTextColor = darkMode ? 'text-slate-400' : 'text-slate-500';
  const unreadCount = notifications.filter(n => !n.read).length;
  const activeAccentPreset = WORKSPACE_ACCENT_PRESETS.find(p => p.id === accentColor) || WORKSPACE_ACCENT_PRESETS[0];

  const handleLogout = async () => {
    try {
      await signOut();
      setProfileMenuOpen(false);
    } catch (error) {
      console.error("Failed to sign out from header:", error);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileMenuRef.current && 
        !profileMenuRef.current.contains(event.target as Node) &&
        avatarButtonRef.current && 
        !avatarButtonRef.current.contains(event.target as Node)
      ) {
        setProfileMenuOpen(false);
      }
      if (statusPopoverRef.current && !statusPopoverRef.current.contains(event.target as Node)) {
        setIsStatusPopoverOpen(false);
      }
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setIsThemeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const normalizedRole = normalizeUserRole(currentUser?.role);
  const statusLabelText = myStatus === 'available' ? 'Available' : myStatus === 'away' ? 'Away' : 'Busy / DND';

  return (
    <header className="workspace-header glass-panel rounded-full px-3 sm:px-5 py-2 relative z-20">
      <div className="flex items-center justify-between gap-2 sm:gap-3 min-w-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {/* Mobile Hamburger Button */}
          <button
            onClick={toggleMobileSidebar}
            className={`md:hidden p-2 rounded-full transition-all flex-shrink-0 ${
              darkMode ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            aria-label="Open sidebar navigation"
          >
            <Bars3Icon className="w-5 h-5" />
          </button>

          <div className="min-w-0 flex-1 sm:flex-initial">
            <h1 className="text-sm sm:text-base md:text-lg font-bold text-gradient-accent tracking-tight truncate max-w-[145px] sm:max-w-[220px] md:max-w-[280px]">
              {activeProject ? activeProject.name : 'Workspace Studio'}
            </h1>
            {activeProject && (
              <p className={`text-[10px] ${subTextColor} truncate hidden lg:block`}>
                {activeProject.name} · Live Sprint Board
              </p>
            )}
          </div>

          {/* Pill Search Bar Trigger on Desktop (lg+) */}
          <button
            type="button"
            onClick={openCommandPalette}
            className={`hidden lg:flex items-center justify-between gap-4 px-3.5 py-1.5 rounded-full border text-xs transition-all cursor-pointer ml-2 min-w-[220px] xl:min-w-[270px] ${
              darkMode
                ? 'bg-slate-900/70 hover:bg-slate-800/90 border-white/10 text-slate-400'
                : 'bg-slate-100/80 hover:bg-white border-slate-200/80 text-slate-500 shadow-2xs'
            }`}
          >
            <span className="flex items-center gap-2 truncate">
              <ICON_MAP.SparklesIcon className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
              <span>Search tasks, projects, or Co-Pilot...</span>
            </span>
            <kbd className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
              darkMode ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-600 border border-slate-200'
            }`}>
              ⌘K
            </kbd>
          </button>
        </div>

        <div className="flex items-center space-x-1 sm:space-x-1.5 md:space-x-2 flex-shrink-0">
          {/* Minimal Team Presence Avatars */}
          {uniquePresences.length > 0 && (
            <div className="hidden lg:flex items-center -space-x-1.5 mr-1">
              {uniquePresences.slice(0, 4).map((p) => {
                const lsInfo = formatAccurateLastSeen(
                  p,
                  p.userId,
                  p.userEmail,
                  p.userId === currentUser?.id
                );
                const matchedOrgUser = users.find(
                  u =>
                    u.id === p.userId ||
                    (u.email && p.userEmail && u.email.toLowerCase() === p.userEmail.toLowerCase())
                );
                return (
                  <div
                    key={p.userId}
                    className="relative inline-block ring-2 ring-white dark:ring-slate-900 rounded-full"
                    title={`${p.userName} • ${lsInfo.statusLabel}`}
                  >
                    <Avatar
                      user={
                        matchedOrgUser || {
                          id: p.userId,
                          full_name: p.userName,
                          email: p.userEmail || '',
                          avatar_url: p.userAvatar,
                          organization_id: p.organizationId || currentUser?.organization_id,
                        }
                      }
                      size="sm"
                    />
                    <span
                      className={`absolute bottom-0 right-0 w-2 h-2 rounded-full ring-1 ring-white dark:ring-slate-900 pointer-events-none ${lsInfo.dotColorClass}`}
                    />
                  </div>
                );
              })}
              {uniquePresences.length > 4 && (
                <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] font-bold flex items-center justify-center text-slate-600 dark:text-slate-300 ring-2 ring-white dark:ring-slate-900">
                  +{uniquePresences.length - 4}
                </span>
              )}
            </div>
          )}

          {/* Compact Search Button on Mobile & Tablet (< lg) */}
          <button
            data-tour-id="tour-header-command"
            onClick={openCommandPalette}
            className={`lg:hidden p-2 rounded-full transition-all border cursor-pointer ${
              darkMode 
                ? 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-300' 
                : 'bg-slate-100/90 hover:bg-slate-200/90 border-slate-200 text-slate-600'
            }`}
            title="Search or Command Palette (⌘K)"
            aria-label="Open Command Palette"
          >
            <ICON_MAP.SearchIcon className="w-4 h-4" />
          </button>

          {/* Keyboard Shortcuts Button (Desktop only) */}
          <button
            onClick={openShortcutsModal}
            className={`hidden xl:inline-flex p-2 rounded-xl border transition-all text-xs font-medium cursor-pointer ${
              darkMode 
                ? 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-400 hover:text-slate-200' 
                : 'bg-slate-100/90 hover:bg-slate-200/90 border-slate-200 text-slate-500 hover:text-slate-800'
            }`}
            title="Keyboard Shortcuts (?)"
            aria-label="Keyboard Shortcuts"
          >
            <ICON_MAP.KeyboardIcon className="w-4 h-4" />
          </button>

          {/* Persistent Header Active-Task Focus Timer Capsule */}
          {activeTimer && (
            <div
              className={`inline-flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 rounded-full border text-xs transition-all shadow-xs ${
                activeTimer.isRunning
                  ? darkMode
                    ? 'bg-indigo-950/85 border-indigo-500/50 text-indigo-200'
                    : 'bg-indigo-50 border-indigo-300 text-indigo-900'
                  : darkMode
                  ? 'bg-amber-950/60 border-amber-500/40 text-amber-200'
                  : 'bg-amber-50 border-amber-300 text-amber-900'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  const found = tasks.find(t => t.id === activeTimer.taskId);
                  if (found) openViewTaskModal(found);
                  else setActiveView('workload_capacity_view');
                }}
                className="flex items-center gap-1.5 min-w-0 cursor-pointer hover:opacity-80"
                title={`Focusing on: ${activeTimer.taskTitle} (Click to inspect)`}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    activeTimer.isRunning ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'
                  }`}
                />
                <span className="hidden xl:inline max-w-[130px] truncate font-semibold text-[11px]">
                  {activeTimer.taskTitle}
                </span>
                <span className="font-mono font-bold tabular-nums text-[11px] tracking-tight">
                  {formattedFocusTimer}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  soundService.play('click_soft');
                  if (activeTimer.isRunning) pauseTaskTimer();
                  else resumeTaskTimer();
                }}
                className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white/15 hover:bg-white/25 dark:bg-slate-800/80 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                title={activeTimer.isRunning ? 'Pause Focus Timer' : 'Resume Focus Timer'}
              >
                {activeTimer.isRunning ? 'Pause' : 'Resume'}
              </button>
              <button
                type="button"
                onClick={() => {
                  soundService.play('task_complete');
                  stopAndLogTaskTimer();
                }}
                className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 hover:bg-emerald-600 text-white transition-colors cursor-pointer"
                title="Stop Timer & Log Work Hours to Task"
              >
                Log
              </button>
            </div>
          )}

          {/* Live Visual State-Update Sync Indicator */}
          {recentStateUpdateLabel && (
            <div
              key={recentStateUpdateLabel}
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-600 dark:text-emerald-300 text-[10px] font-bold animate-state-badge pointer-events-none"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              <span className="max-w-[120px] truncate">{recentStateUpdateLabel}</span>
            </div>
          )}

          {/* UI Sound Effects Toggle Button (sm+) */}
          <button
            type="button"
            onClick={() => {
              const next = soundService.toggleEnabled();
              setSoundEnabled(next);
            }}
            className={`hidden sm:inline-flex p-2 rounded-full transition-all cursor-pointer ${
              soundEnabled
                ? darkMode
                  ? 'hover:bg-slate-800 text-indigo-400 hover:text-indigo-300'
                  : 'hover:bg-slate-200 text-indigo-600 hover:text-indigo-700'
                : darkMode
                ? 'hover:bg-slate-800 text-slate-500'
                : 'hover:bg-slate-200 text-slate-400'
            }`}
            title={soundEnabled ? 'UI Sounds On (Click to mute)' : 'UI Sounds Muted (Click to enable)'}
            aria-label={soundEnabled ? 'Mute UI sounds' : 'Enable UI sounds'}
          >
            <ICON_MAP.SpeakerWaveIcon className={`w-4 h-4 ${!soundEnabled ? 'opacity-45' : ''}`} />
          </button>

          {/* Workspace Color Accent & Theme Picker Popover */}
          <div className="relative" ref={themeMenuRef}>
            <button
              type="button"
              onClick={() => {
                soundService.play('click_soft');
                setIsThemeMenuOpen(prev => !prev);
              }}
              className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-full border transition-all cursor-pointer ${
                darkMode
                  ? 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-200'
                  : 'bg-slate-100/90 hover:bg-slate-200/80 border-slate-200 text-slate-700'
              }`}
              title="Customize Workspace Theme & Color Accent"
              aria-label="Customize Workspace Theme & Color Accent"
            >
              <span className={`w-3.5 h-3.5 rounded-full bg-gradient-to-br ${activeAccentPreset.swatchClass} ring-1 ring-white/40 shrink-0`} />
              {darkMode ? <SunIcon className="w-3.5 h-3.5 text-amber-400" /> : <MoonIcon className="w-3.5 h-3.5 text-slate-600" />}
            </button>

            <AnimatedPopover
              isOpen={isThemeMenuOpen}
              direction="down"
              className={`absolute right-0 mt-2.5 w-64 rounded-2xl shadow-2xl p-3.5 z-50 border backdrop-blur-xl ${
                darkMode ? 'bg-slate-900/95 border-slate-700/80 text-slate-100' : 'bg-white/95 border-slate-200/90 text-slate-800'
              }`}
            >
              <div className="space-y-3">
                {/* Light / Dark Mode Switch */}
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/70 dark:border-slate-800">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Theme Mode</span>
                  <div className="flex items-center gap-1 p-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => {
                        if (darkMode) {
                          soundService.play('click_soft');
                          toggleDarkMode();
                        }
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                        !darkMode ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <SunIcon className="w-3 h-3 text-amber-500" />
                      <span>Light</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!darkMode) {
                          soundService.play('click_soft');
                          toggleDarkMode();
                        }
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                        darkMode ? 'bg-slate-700 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      <MoonIcon className="w-3 h-3 text-indigo-400" />
                      <span>Dark</span>
                    </button>
                  </div>
                </div>

                {/* 6 Curated Color Accents */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Workspace Accent</span>
                    <span className="text-[10px] font-semibold text-indigo-500">{activeAccentPreset.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {WORKSPACE_ACCENT_PRESETS.map((preset) => {
                      const isSelected = accentColor === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            soundService.play('click_soft');
                            setAccentColor(preset.id as WorkspaceAccentId);
                            addToast('Accent Updated', `Workspace accent set to ${preset.name}.`, 'info');
                          }}
                          className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-all cursor-pointer ${
                            isSelected
                              ? darkMode
                                ? 'bg-slate-800 border-white/40 ring-1 ring-white/25'
                                : 'bg-slate-100 border-slate-900/30 ring-1 ring-slate-900/10'
                              : darkMode
                              ? 'border-slate-800 hover:bg-slate-800/60'
                              : 'border-slate-200/70 hover:bg-slate-50'
                          }`}
                        >
                          <span
                            className={`w-4 h-4 rounded-full bg-gradient-to-br ${preset.swatchClass} flex items-center justify-center text-white shrink-0`}
                          >
                            {isSelected && <ICON_MAP.CheckIcon className="w-2.5 h-2.5 stroke-[3]" />}
                          </span>
                          <span className="text-[11px] font-bold truncate">{preset.name.split(' ')[1] || preset.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </AnimatedPopover>
          </div>

          <button
            onClick={() => setActiveView('inbox_view')}
            className={`relative p-2 rounded-full transition-colors cursor-pointer ${darkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-700'}`}
            aria-label="Notifications"
          >
            <BellIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
            )}
          </button>

          <Button 
            variant="primary" 
            size="sm" 
            onClick={handleAddTaskClick}
            disabled={!currentUser}
            title={!activeProject ? "Select a project to add tasks" : (!currentUser ? "Login to add tasks" : "Add new task")}
            className="px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold shrink-0"
          >
            <PlusIcon className="w-4 h-4 sm:mr-1" /> 
            <span className="hidden md:inline">Add Task</span>
          </Button>
          
          {/* Rich Profile Dropdown Menu */}
          <div className="relative" ref={profileMenuRef} data-tour-id="tour-header-profile">
            {currentUser ? (
              <button 
                ref={avatarButtonRef}
                onClick={() => setProfileMenuOpen(prev => !prev)}
                aria-expanded={isProfileMenuOpen}
                aria-haspopup="true"
                className="relative rounded-full focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 ring-offset-background cursor-pointer"
              >
                <Avatar user={currentUser} size="md" />
                <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-white dark:bg-slate-900 p-0.5 shadow-xs">
                  <StatusDynamicIcon status={myStatus} className="w-2.5 h-2.5" />
                </span>
              </button>
            ) : (
              <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center ${darkMode ? 'bg-slate-700/70 text-slate-400' : 'bg-slate-300/70 text-slate-500'} border ${darkMode ? 'border-slate-600' : 'border-slate-400'}`} title="Not logged in">
                <ICON_MAP.UserCircleIcon className="w-5 h-5" />
              </div>
            )}

            <AnimatedPopover
              isOpen={Boolean(isProfileMenuOpen && currentUser)}
              direction="down"
              className={`absolute right-0 mt-2.5 w-72 rounded-2xl shadow-2xl py-2 z-50 border backdrop-blur-xl ${
                darkMode ? 'bg-slate-900/95 border-slate-700/80 text-slate-100' : 'bg-white/95 border-slate-200/90 text-slate-800'
              }`}
            >
              {currentUser && (
                <>
                {/* User Identity Header */}
                <div className={`px-4 py-3 border-b ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar user={currentUser} size="md" />
                      <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-white dark:bg-slate-900 p-0.5">
                        <StatusDynamicIcon status={myStatus} className="w-3 h-3" />
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate">{currentUser.full_name || currentUser.email}</p>
                      <p className="text-[11px] text-slate-400 truncate">{currentUser.email}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                          {normalizedRole.replace(/_/g, ' ')}
                        </span>
                        {currentOrganization?.name && (
                          <span className="text-[10px] text-slate-400 truncate">• {currentOrganization.name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dynamic Status Selector inside Profile Menu */}
                <div className={`px-3 py-2 border-b ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                  <div className="flex items-center justify-between px-1 mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Live Status</span>
                    <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                      <StatusDynamicIcon status={myStatus} className="w-3 h-3" />
                      {statusLabelText}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {(['available', 'away', 'busy'] as const).map((st) => {
                      const active = myStatus === st;
                      const label = st === 'available' ? 'Online' : st === 'away' ? 'Away' : 'Busy';
                      return (
                        <button
                          key={st}
                          onClick={() => handleStatusChange(st)}
                          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                            active
                              ? darkMode
                                ? 'bg-indigo-500/20 border-indigo-500/50 text-white shadow-xs'
                                : 'bg-indigo-50 border-indigo-300 text-indigo-800 shadow-xs'
                              : darkMode
                                ? 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
                                : 'bg-slate-50 border-slate-200/70 text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <StatusDynamicIcon status={st} className="w-3.5 h-3.5" />
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Navigation & Quick Workspace Links */}
                <div className="py-1 px-1.5 space-y-0.5">
                  <button
                    onClick={() => {
                      setActiveView('profile_settings');
                      setProfileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                      darkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <ICON_MAP.UserCircleIcon className="w-4 h-4 text-indigo-400" />
                      <span>Profile & Workspace Settings</span>
                    </span>
                    <span className="text-[10px] text-slate-400">⚙️</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveView('my_tasks_view');
                      setProfileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                      darkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <ICON_MAP.ClipboardListIcon className="w-4 h-4 text-emerald-400" />
                      <span>My Assigned Tasks</span>
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveView('ai_copilot_view');
                      setProfileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                      darkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <ICON_MAP.SparklesIcon className="w-4 h-4 text-purple-400" />
                      <span>AI Co-Pilot & Virtual PM</span>
                    </span>
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400">AI</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveView('team_management');
                      setProfileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                      darkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <ICON_MAP.UserGroupIcon className="w-4 h-4 text-sky-400" />
                      <span>Team & RBAC Directory</span>
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveView('inbox_view');
                      setProfileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                      darkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <BellIcon className="w-4 h-4 text-amber-400" />
                      <span>Inbox & Notifications</span>
                    </span>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-500 text-white">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                </div>

                {/* Preferences & Utilities */}
                <div className={`py-1.5 px-3 border-t ${darkMode ? 'border-slate-800' : 'border-slate-100'} space-y-2`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Workspace Accent</span>
                    <button
                      type="button"
                      onClick={toggleDarkMode}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 cursor-pointer ${
                        darkMode ? 'bg-slate-800 border-slate-700 text-amber-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      {darkMode ? <SunIcon className="w-3 h-3" /> : <MoonIcon className="w-3 h-3" />}
                      <span>{darkMode ? 'Dark' : 'Light'}</span>
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-1.5 pb-1">
                    {WORKSPACE_ACCENT_PRESETS.map((preset) => {
                      const isSelected = accentColor === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            soundService.play('click_soft');
                            setAccentColor(preset.id as WorkspaceAccentId);
                            addToast('Accent Updated', `Workspace accent set to ${preset.name}.`, 'info');
                          }}
                          title={preset.name}
                          className={`w-7 h-7 rounded-full bg-gradient-to-br ${preset.swatchClass} flex items-center justify-center text-white transition-transform cursor-pointer ${
                            isSelected ? 'scale-110 ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-slate-900' : 'opacity-80 hover:opacity-100 hover:scale-105'
                          }`}
                        >
                          {isSelected && <ICON_MAP.CheckIcon className="w-3.5 h-3.5 stroke-[2.5]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className={`py-1 px-1.5 border-t ${darkMode ? 'border-slate-800' : 'border-slate-100'} space-y-0.5`}>
                  <button
                    onClick={() => {
                      openCommandPalette();
                      setProfileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                      darkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <ICON_MAP.SearchIcon className="w-4 h-4 text-slate-400" />
                      <span>AI Command Centre</span>
                    </span>
                    <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800/50 text-slate-400 border border-slate-700/50">⌘K</kbd>
                  </button>

                  {(normalizeUserRole(currentUser.role) === 'OWNER' || normalizeUserRole(currentUser.role) === 'PROJECT_MANAGER') && (
                    <button
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('omni_open_system_log_monitor'));
                        setProfileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                        darkMode ? 'text-emerald-300 hover:bg-slate-800' : 'text-emerald-700 hover:bg-emerald-50/70'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <ICON_MAP.TerminalIcon className="w-4 h-4 text-emerald-400" />
                        <span>Exception & Console Log Monitor</span>
                      </span>
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                        {normalizeUserRole(currentUser.role) === 'OWNER' ? 'OWNER' : 'PM'}
                      </span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('omni_open_email_center', { detail: { tab: 'verify' } }));
                      setProfileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                      darkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <ICON_MAP.ShieldCheckIcon className="w-4 h-4 text-emerald-400" />
                      <span>Email Verification & Outbox</span>
                    </span>
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                      SMTP
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('omni_open_ai_guide'));
                      window.dispatchEvent(new CustomEvent('omni_open_ai_platform_guide'));
                      setProfileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                      darkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <ICON_MAP.SparklesIcon className="w-4 h-4 text-indigo-400" />
                      <span>Interactive AI Platform Guide</span>
                    </span>
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400">Tour</span>
                  </button>

                  <button
                    onClick={() => {
                      openShortcutsModal();
                      setProfileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                      darkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <ICON_MAP.KeyboardIcon className="w-4 h-4 text-slate-400" />
                      <span>Keyboard Shortcuts</span>
                    </span>
                    <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800/50 text-slate-400 border border-slate-700/50">?</kbd>
                  </button>
                </div>

                {/* Sign out */}
                <div className={`pt-1 px-1.5 border-t ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                  <button
                    onClick={handleLogout}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                      darkMode ? 'text-rose-400 hover:bg-rose-500/15' : 'text-rose-600 hover:bg-rose-50'
                    } transition-colors`}
                  >
                    <LogoutIcon className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
                </>
              )}
            </AnimatedPopover>
          </div>
        </div>
      </div>
    </header>
  );
};
