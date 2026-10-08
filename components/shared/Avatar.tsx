import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { User, normalizeUserRole, TaskStatus } from '../../types';
import { ICON_MAP } from '../../constants';
import { useAppStore } from '../../hooks/useAppStore';
import { getE2EEKeyFingerprint } from '../../services/chatService';
import { getUserProfileExtensions } from '../../services/supabaseService';

interface AvatarProps {
  user?: User;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disableHoverCard?: boolean;
}

const VIEW_LABELS: Record<string, string> = {
  overview: 'Executive Dashboard',
  kanban: 'Kanban Board',
  projects_overview: 'Projects Portfolio',
  sprints_view: 'Sprint Planning',
  my_tasks_view: 'My Tasks',
  team_chat_view: 'Teams Hub & Chat',
  team_management: 'Team & RBAC Directory',
  ai_copilot_view: 'AI Project Manager Studio',
  task_automations: 'Workflow Automations',
  reports_view: 'Analytics & Reports',
  inbox_view: 'Notification Inbox',
  profile_settings: 'Profile Settings',
};

export const Avatar: React.FC<AvatarProps> = ({
  user,
  size = 'md',
  className,
  disableHoverCard = false,
}) => {
  const {
    presences,
    tasks,
    currentUser,
    darkMode,
    setActiveView,
    openViewTaskModal,
    addToast,
  } = useAppStore();

  const [isHovered, setIsHovered] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; placement: 'top' | 'bottom' }>({
    top: 0,
    left: 0,
    placement: 'bottom',
  });

  const triggerRef = useRef<HTMLDivElement | null>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
  };

  useEffect(() => {
    return () => {
      if (openTimerRef.current) clearTimeout(openTimerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const updatePopupPosition = () => {
    if (!triggerRef.current || typeof window === 'undefined') return;
    const rect = triggerRef.current.getBoundingClientRect();
    const cardW = 296;
    const cardH = 240;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = rect.left + rect.width / 2 - cardW / 2;
    left = Math.max(12, Math.min(vw - cardW - 12, left));

    let placement: 'top' | 'bottom' = 'bottom';
    let top = rect.bottom + 10;
    if (top + cardH > vh - 12 && rect.top > cardH + 16) {
      placement = 'top';
      top = rect.top - cardH - 10;
    }

    setCoords({ top: Math.round(top), left: Math.round(left), placement });
  };

  const handleMouseEnter = () => {
    if (disableHoverCard || !user) return;
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    openTimerRef.current = setTimeout(() => {
      updatePopupPosition();
      setIsHovered(true);
    }, 220);
  };

  const handleMouseLeave = () => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    closeTimerRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 180);
  };

  const UserIcon = ICON_MAP.UserCircleIcon;
  const displayName = user?.full_name || user?.email || 'User';

  const renderAvatarVisual = () => {
    if (!user || !user.avatar_url) {
      const nameForInitials = user?.full_name || user?.email || '';
      const initials = nameForInitials ? (
        nameForInitials
          .split(' ')
          .map(n => n[0])
          .join('')
          .substring(0, 2)
          .toUpperCase()
      ) : (
        <UserIcon className="w-full h-full p-1" />
      );

      return (
        <div
          className={`flex items-center justify-center rounded-full bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold select-none ${sizeClasses[size]} ${className || ''}`}
        >
          {initials}
        </div>
      );
    }

    return (
      <img
        src={user.avatar_url}
        alt={displayName}
        className={`rounded-full object-cover select-none ${sizeClasses[size]} ${className || ''}`}
      />
    );
  };

  if (disableHoverCard || !user) {
    return renderAvatarVisual();
  }

  // Compute live collaboration & profile details for the hovered user
  const userEmailLower = (user.email || '').toLowerCase();
  const userNameLower = (user.full_name || '').toLowerCase();
  const presence = (presences || []).find(
    p =>
      p.userId === user.id ||
      (userEmailLower && p.userEmail && p.userEmail.toLowerCase() === userEmailLower) ||
      (userNameLower && p.userName && p.userName.toLowerCase() === userNameLower)
  );

  const isMe = currentUser?.id === user.id;
  const isOnline = isMe || Boolean(presence);

  let availability: 'available' | 'away' | 'busy' = presence?.availabilityStatus || 'available';
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('omni_team_statuses');
      const map = raw ? JSON.parse(raw) : {};
      if (map[user.id]) availability = map[user.id];
      else if (userEmailLower && map[userEmailLower]) availability = map[userEmailLower];
    } catch (e) {}
  }

  const ext = getUserProfileExtensions(user.id);
  const roleLabel = normalizeUserRole(ext.roleOverride || user.role).replace(/_/g, ' ');
  const department = user.department || ext.department || ext.preferences?.department || 'Engineering';
  const jobTitle = user.job_title || ext.job_title || ext.preferences?.jobTitle || roleLabel;
  const capacityHours = user.weekly_capacity_hours ?? ext.weekly_capacity_hours ?? 40;

  const userTasks = (tasks || []).filter(t => t.assignee_id === user.id);
  const inProgressCount = userTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length;
  const completedCount = userTasks.filter(t => t.status === TaskStatus.DONE).length;

  const focusedTask = presence?.currentTaskId
    ? (tasks || []).find(t => t.id === presence.currentTaskId)
    : undefined;

  const activeViewLabel = presence?.currentView
    ? VIEW_LABELS[presence.currentView] || presence.currentView.replace(/_/g, ' ')
    : isMe
    ? 'Current Session (You)'
    : 'Workspace';

  const statusColor = !isOnline
    ? 'bg-slate-400'
    : availability === 'away'
    ? 'bg-amber-400'
    : availability === 'busy'
    ? 'bg-rose-500'
    : 'bg-emerald-500';

  const statusBadgeText = !isOnline
    ? 'Offline'
    : availability === 'away'
    ? 'Away'
    : availability === 'busy'
    ? 'Busy / DND'
    : 'Available';

  const isSameOrg =
    !currentUser?.organization_id ||
    !user.organization_id ||
    user.organization_id === currentUser.organization_id;

  const keyFingerprint = currentUser ? getE2EEKeyFingerprint(currentUser.id, user.id) : 'AES-256';

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="inline-flex items-center justify-center"
      >
        {renderAvatarVisual()}
      </div>

      {isHovered &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            onMouseEnter={() => {
              if (closeTimerRef.current) {
                clearTimeout(closeTimerRef.current);
                closeTimerRef.current = null;
              }
            }}
            onMouseLeave={handleMouseLeave}
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: '296px',
              zIndex: 9999,
            }}
            className={`rounded-2xl border p-3.5 shadow-2xl backdrop-blur-xl animate-popup-in text-left ${
              darkMode
                ? 'bg-slate-900/95 border-slate-700/90 text-slate-100 shadow-black/60'
                : 'bg-white/95 border-slate-200/90 text-slate-900 shadow-slate-900/15'
            }`}
          >
            {/* Top Identity Row */}
            <div className="flex items-start gap-3">
              <div className="relative flex-shrink-0">
                <Avatar user={user} size="lg" disableHoverCard />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-white dark:ring-slate-900 ${statusColor}`}
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1.5">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {displayName} {isMe && <span className="text-[10px] text-indigo-400">(You)</span>}
                  </h4>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold flex-shrink-0 ${
                      !isOnline
                        ? 'bg-slate-500/15 text-slate-400'
                        : availability === 'away'
                        ? 'bg-amber-500/15 text-amber-500'
                        : availability === 'busy'
                        ? 'bg-rose-500/15 text-rose-500'
                        : 'bg-emerald-500/15 text-emerald-500'
                    }`}
                  >
                    ● {statusBadgeText}
                  </span>
                </div>

                <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 truncate mt-0.5">
                  {jobTitle} · {department}
                </p>

                {user.email && (
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">{user.email}</p>
                )}

                <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
                    {roleLabel}
                  </span>
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <ICON_MAP.ShieldCheckIcon className="w-2.5 h-2.5" />
                    E2EE {keyFingerprint}
                  </span>
                </div>
              </div>
            </div>

            {/* Live Collab Activity Box */}
            <div
              className={`mt-3 p-2.5 rounded-xl border text-[11px] space-y-1.5 ${
                darkMode
                  ? 'bg-slate-800/70 border-slate-700/70'
                  : 'bg-slate-50/90 border-slate-200/70'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <span>Live Collaboration Status</span>
                <span>{capacityHours}h/wk cap</span>
              </div>

              {isOnline ? (
                <div className="text-xs font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping flex-shrink-0" />
                  <span className="truncate">
                    {presence?.isTypingComment
                      ? '✍️ Typing a task comment...'
                      : presence?.isEditing
                      ? `✏️ Editing ${presence.editingField || 'task'}...`
                      : focusedTask
                      ? `👁️ Viewing "${focusedTask.title}"`
                      : `📍 Active in ${activeViewLabel}`}
                  </span>
                </div>
              ) : (
                <div className="text-[11px] text-slate-400">
                  Currently offline · Async notifications enabled
                </div>
              )}

              {/* Task & Workload Metrics */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60 text-[10px] text-slate-500 dark:text-slate-400">
                <span>
                  <strong className="text-slate-800 dark:text-slate-200">{userTasks.length}</strong> assigned
                </span>
                <span>
                  <strong className="text-amber-500">{inProgressCount}</strong> in progress
                </span>
                <span>
                  <strong className="text-emerald-500">{completedCount}</strong> done
                </span>
              </div>
            </div>

            {/* Quick Collaboration Actions */}
            {!isMe && (
              <div className="mt-2.5 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsHovered(false);
                    setActiveView('team_chat_view');
                    setTimeout(() => {
                      if (isSameOrg) {
                        window.dispatchEvent(
                          new CustomEvent('omni_select_chat_contact', { detail: { userId: user.id } })
                        );
                      } else {
                        addToast(
                          'External User',
                          'Send an organization invite link in Teams Chat to message external users.',
                          'info'
                        );
                      }
                    }, 90);
                  }}
                  className="flex-1 py-1.5 px-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ICON_MAP.ChatBubbleLeftIcon className="w-3.5 h-3.5" />
                  <span>{isSameOrg ? 'Direct Message' : 'Invite to Org'}</span>
                </button>

                {focusedTask && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsHovered(false);
                      openViewTaskModal(focusedTask);
                    }}
                    className={`py-1.5 px-2.5 rounded-xl border text-[11px] font-bold transition-colors cursor-pointer ${
                      darkMode
                        ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200'
                        : 'border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                    title={`Open "${focusedTask.title}"`}
                  >
                    Jump to Task
                  </button>
                )}
              </div>
            )}
          </div>,
          document.body
        )}
    </>
  );
};
