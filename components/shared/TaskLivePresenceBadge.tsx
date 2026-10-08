import React, { useMemo, useState, useEffect } from 'react';
import { UserPresence } from '../../types';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { collabService } from '../../services/collabService';

interface TaskLivePresenceBadgeProps {
  taskId: string;
  compact?: boolean;
  showBroadcastFlash?: boolean;
}

export const TaskLivePresenceBadge: React.FC<TaskLivePresenceBadgeProps> = ({
  taskId,
  compact = false,
  showBroadcastFlash = true,
}) => {
  const { presences, currentUser } = useAppStore();
  const [recentRemoteBroadcast, setRecentRemoteBroadcast] = useState<{ actorName: string; summary: string } | null>(null);

  useEffect(() => {
    if (!showBroadcastFlash) return;
    const handleRemoteUpdate = (e: CustomEvent) => {
      const payload = e.detail;
      if (!payload || payload.taskId !== taskId) return;
      if (payload.actor?.id && payload.actor.id !== currentUser?.id && payload.actor.id !== 'remote') {
        const actorName = (payload.actor.name || 'Teammate').split(' ')[0];
        let summary = 'updated';
        if (payload.updates?.status) {
          summary = `moved to ${String(payload.updates.status).replace(/_/g, ' ')}`;
        } else if (payload.updates?.priority) {
          summary = `priority ${payload.updates.priority}`;
        } else if (payload.updates?.title) {
          summary = 'edited title';
        }
        setRecentRemoteBroadcast({ actorName, summary });
      }
    };
    window.addEventListener('omni_remote_task_updated', handleRemoteUpdate as EventListener);
    return () => window.removeEventListener('omni_remote_task_updated', handleRemoteUpdate as EventListener);
  }, [taskId, currentUser?.id, showBroadcastFlash]);

  useEffect(() => {
    if (!recentRemoteBroadcast) return;
    const t = setTimeout(() => setRecentRemoteBroadcast(null), 4500);
    return () => clearTimeout(t);
  }, [recentRemoteBroadcast]);

  const viewers = useMemo(() => {
    const map = new Map<string, UserPresence>();
    (presences || []).forEach(p => {
      if (p.currentTaskId !== taskId) return;
      if (currentUser && p.userId === currentUser.id) return;
      if (p.sessionId && p.sessionId === collabService.sessionId) return;
      const existing = map.get(p.userId);
      if (!existing) {
        map.set(p.userId, { ...p });
      } else {
        map.set(p.userId, {
          ...existing,
          isEditing: Boolean(existing.isEditing || p.isEditing),
          editingField: p.editingField || existing.editingField,
          isTypingComment: Boolean(existing.isTypingComment || p.isTypingComment),
        });
      }
    });
    return Array.from(map.values());
  }, [presences, taskId, currentUser?.id]);

  const activeEditors = useMemo(() => viewers.filter(v => v.isEditing), [viewers]);
  const activeTypers = useMemo(() => viewers.filter(v => v.isTypingComment), [viewers]);

  if (viewers.length === 0 && !recentRemoteBroadcast) return null;

  const primaryEditor = activeEditors[0];
  const primaryTyper = activeTypers[0];
  const primaryViewer = viewers[0];
  const firstName = ((primaryEditor || primaryTyper || primaryViewer)?.userName || 'Teammate').split(' ')[0];

  const pillTone = primaryEditor
    ? 'bg-blue-500/15 border-blue-500/30 text-blue-700 dark:text-blue-300'
    : primaryTyper
      ? 'bg-purple-500/15 border-purple-500/30 text-purple-700 dark:text-purple-300'
      : viewers.length > 0
        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
        : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-700 dark:text-indigo-300';

  const tooltip = viewers.length > 0
    ? viewers
        .map(v => `${v.userName}: ${v.isEditing ? `Editing${v.editingField ? ` ${v.editingField}` : ''}` : v.isTypingComment ? 'Commenting' : 'Viewing'}`)
        .join(' • ')
    : recentRemoteBroadcast
      ? `${recentRemoteBroadcast.actorName} ${recentRemoteBroadcast.summary}`
      : '';

  return (
    <div
      className={`inline-flex items-center gap-1.5 ${compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'} rounded-full border font-medium shadow-xs transition-all flex-shrink-0 ${pillTone}`}
      title={tooltip}
      onClick={e => e.stopPropagation()}
    >
      {viewers.length > 0 ? (
        <>
          <div className="flex -space-x-1">
            {viewers.slice(0, 3).map(v => (
              <span
                key={v.userId}
                style={{ backgroundColor: v.color || '#10b981' }}
                className={`${compact ? 'w-3 h-3 text-[7px]' : 'w-3.5 h-3.5 text-[8px]'} rounded-full ring-1 ring-white dark:ring-slate-900 font-semibold text-white flex items-center justify-center overflow-hidden`}
              >
                {v.userAvatar ? (
                  <img src={v.userAvatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  (v.userName || 'U').charAt(0).toUpperCase()
                )}
              </span>
            ))}
          </div>
          {primaryEditor ? (
            <>
              <ICON_MAP.PencilIcon className="w-2.5 h-2.5 flex-shrink-0" />
              <span className="truncate max-w-[110px]">
                {compact ? 'Editing' : `${firstName} editing`}{viewers.length > 1 ? ` +${viewers.length - 1}` : ''}
              </span>
            </>
          ) : primaryTyper ? (
            <>
              <ICON_MAP.ChatBubbleLeftIcon className="w-2.5 h-2.5 flex-shrink-0" />
              <span className="truncate max-w-[110px]">
                {compact ? 'Commenting' : `${firstName} commenting`}{viewers.length > 1 ? ` +${viewers.length - 1}` : ''}
              </span>
            </>
          ) : (
            <>
              <ICON_MAP.EyeIcon className="w-2.5 h-2.5 flex-shrink-0" />
              <span className="truncate max-w-[110px]">
                {compact
                  ? `${viewers.length}`
                  : viewers.length === 1
                    ? `${firstName} viewing`
                    : `${viewers.length} viewing`}
              </span>
            </>
          )}
        </>
      ) : recentRemoteBroadcast ? (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
          <span className="truncate max-w-[130px]">
            {recentRemoteBroadcast.actorName} {recentRemoteBroadcast.summary}
          </span>
        </>
      ) : null}
    </div>
  );
};

export const useTaskPresenceHighlight = (taskId: string) => {
  const { presences, currentUser } = useAppStore();

  return useMemo(() => {
    let hasEditor = false;
    let hasTyper = false;
    let hasViewer = false;

    (presences || []).forEach(p => {
      if (p.currentTaskId !== taskId) return;
      if (currentUser && p.userId === currentUser.id) return;
      if (p.sessionId && p.sessionId === collabService.sessionId) return;
      hasViewer = true;
      if (p.isEditing) hasEditor = true;
      if (p.isTypingComment) hasTyper = true;
    });

    const ringClass = hasEditor
      ? 'ring-1 ring-blue-500/50 border-blue-500/40'
      : hasTyper
        ? 'ring-1 ring-purple-500/50 border-purple-500/40'
        : hasViewer
          ? 'ring-1 ring-emerald-500/30 border-emerald-500/30'
          : '';

    return { hasEditor, hasTyper, hasViewer, ringClass };
  }, [presences, taskId, currentUser?.id]);
};
