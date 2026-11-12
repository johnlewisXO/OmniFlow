import React, { useMemo, useState, useEffect } from 'react';
import { Task, TaskPriority, TaskStatus, UserPresence } from '../../types';
import { useAppStore } from '../../hooks/useAppStore';
import { Avatar } from '../shared/Avatar';
import { PRIORITY_STYLES, ICON_MAP } from '../../constants';
import { collabService } from '../../services/collabService';
import soundService from '../../services/soundService';
import { SlimProgressBar } from '../charts/EditorialCharts';

interface TaskCardProps {
  task: Task;
  isSelected?: boolean;
  isFocused?: boolean;
  onToggleSelect?: (taskId: string, shiftKey?: boolean) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  isSelected = false,
  isFocused = false,
  onToggleSelect,
}) => {
  const {
    users,
    tasks,
    deleteTask: deleteTaskAction,
    openViewTaskModal,
    openEditTaskModal,
    highlightedTaskId,
    presences,
    currentUser,
    activeTimer,
    startTaskTimer,
  } = useAppStore();

  const [recentRemoteBroadcast, setRecentRemoteBroadcast] = useState<{ actorName: string; summary: string } | null>(null);

  useEffect(() => {
    const handleRemoteUpdate = (e: CustomEvent) => {
      const payload = e.detail;
      if (!payload || payload.taskId !== task.id) return;
      if (payload.actor?.id && payload.actor.id !== currentUser?.id && payload.actor.id !== 'remote') {
        const actorName = (payload.actor.name || 'Teammate').split(' ')[0];
        let summary = 'updated ticket';
        if (payload.updates?.status) {
          summary = `moved to ${String(payload.updates.status).replace(/_/g, ' ')}`;
        } else if (payload.updates?.priority) {
          summary = `set priority ${payload.updates.priority}`;
        } else if (payload.updates?.title) {
          summary = 'updated title';
        }
        setRecentRemoteBroadcast({ actorName, summary });
      }
    };
    window.addEventListener('omni_remote_task_updated', handleRemoteUpdate as EventListener);
    return () => window.removeEventListener('omni_remote_task_updated', handleRemoteUpdate as EventListener);
  }, [task.id, currentUser?.id]);

  useEffect(() => {
    if (!recentRemoteBroadcast) return;
    const t = setTimeout(() => setRecentRemoteBroadcast(null), 5000);
    return () => clearTimeout(t);
  }, [recentRemoteBroadcast]);

  const assignee = users.find(user => user.id === task.assignee_id);
  const priorityStyle = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES[TaskPriority.MEDIUM];
  const PriorityIconComponent = priorityStyle.icon;

  const isHighlighted = highlightedTaskId === task.id;

  const isBlocked = useMemo(() => {
    if (!task.blockedBy || task.blockedBy.length === 0) return false;
    return task.blockedBy.some(blockerId => {
      const blocker = tasks.find(t => t.id === blockerId);
      return blocker && blocker.status !== TaskStatus.DONE;
    });
  }, [task.blockedBy, tasks]);

  const checklistStats = useMemo(() => {
    if (!task.checklist || task.checklist.length === 0) return null;
    const completed = task.checklist.filter(i => i.completed).length;
    const total = task.checklist.length;
    return { completed, total, percent: Math.round((completed / total) * 100) };
  }, [task.checklist]);

  const viewers = useMemo(() => {
    const map = new Map<string, UserPresence>();
    presences.forEach(p => {
      if (p.currentTaskId !== task.id) return;
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
  }, [presences, task.id, currentUser?.id]);

  const activeEditors = useMemo(() => viewers.filter(v => v.isEditing), [viewers]);
  const activeTypers = useMemo(() => viewers.filter(v => v.isTypingComment), [viewers]);

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    openEditTaskModal(task.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete task: "${task.title}"?`)) {
      deleteTaskAction(task.id);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (e.shiftKey && onToggleSelect) {
      e.preventDefault();
      e.stopPropagation();
      onToggleSelect(task.id, true);
      return;
    }
    openViewTaskModal(task.id);
  };

  const isTimingThisTask = activeTimer?.taskId === task.id;

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    soundService.play('drag_pickup');
    e.dataTransfer.setData('taskId', task.id);
    e.dataTransfer.setData('originalStatus', task.status);
    e.dataTransfer.setData('originalPosition', task.position.toString());
    e.dataTransfer.effectAllowed = 'move';

    const targetElement = e.target as HTMLDivElement;
    targetElement.classList.add('opacity-50', 'scale-[1.02]');

    const dragImage = targetElement.cloneNode(true) as HTMLElement;
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    dragImage.style.width = targetElement.offsetWidth + 'px';
    dragImage.style.height = targetElement.offsetHeight + 'px';
    dragImage.style.transform = 'rotate(2deg) scale(1.02)';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, targetElement.offsetWidth / 2, 20);

    setTimeout(() => {
      if (document.body.contains(dragImage)) {
        document.body.removeChild(dragImage);
      }
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    (e.target as HTMLDivElement).classList.remove('opacity-50', 'scale-[1.02]');
  };

  const priorityDotColor =
    task.priority === TaskPriority.CRITICAL
      ? 'bg-rose-600'
      : task.priority === TaskPriority.HIGH
      ? 'bg-amber-500'
      : task.priority === TaskPriority.MEDIUM
      ? 'bg-[#7A8F5B]'
      : 'bg-[var(--text-muted)]';

  return (
    <div
      data-task-id={task.id}
      className={`editorial-surface p-3.5 cursor-grab active:cursor-grabbing transition-all duration-150 ease-out hover:border-[var(--border-strong)] relative group ${
        isSelected ? 'ring-2 ring-[var(--text-primary)] border-[var(--text-primary)]' : ''
      } ${isFocused && !isSelected ? 'ring-2 ring-[var(--accent-lime)]' : ''} ${
        isHighlighted ? 'ring-2 ring-emerald-500/70' : ''
      } ${isBlocked ? 'border-amber-500/50' : ''}`}
      onClick={handleCardClick}
      draggable={true}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Top Meta Line + Quick Hover Actions */}
      <div className="flex items-center justify-between gap-2 mb-2 min-h-[18px]">
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] min-w-0 flex-wrap">
          {onToggleSelect && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onToggleSelect(task.id, e.shiftKey);
              }}
              title="Select task (Shift+Click or X)"
              className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                isSelected
                  ? 'bg-[var(--text-primary)] border-[var(--text-primary)] text-[var(--bg-surface)] opacity-100'
                  : 'border-[var(--border-strong)] opacity-0 group-hover:opacity-100 focus:opacity-100'
              }`}
            >
              {isSelected && <ICON_MAP.CheckIcon className="w-2.5 h-2.5 stroke-[3]" />}
            </button>
          )}

          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${priorityDotColor}`} />
          <span className="font-medium text-[var(--text-secondary)] capitalize">
            {task.priority?.toLowerCase()}
          </span>

          {task.story_points !== undefined && (
            <>
              <span>·</span>
              <span className="font-mono tabular-nums">{task.story_points}p</span>
            </>
          )}

          {isBlocked && (
            <>
              <span>·</span>
              <span className="font-semibold text-amber-700 dark:text-amber-400">Blocked</span>
            </>
          )}

          {isTimingThisTask && (
            <>
              <span>·</span>
              <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">Timing</span>
            </>
          )}
        </div>

        {/* Hover Actions */}
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              startTaskTimer(task);
            }}
            title="Start Focus Timer"
            className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-sage)] transition-colors cursor-pointer"
          >
            <ICON_MAP.ClockIcon className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleEdit}
            title="Edit task"
            className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-sage)] transition-colors cursor-pointer"
          >
            <ICON_MAP.PencilIcon className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            title="Delete task"
            className="p-1 rounded-md text-[var(--text-muted)] hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
          >
            <ICON_MAP.TrashIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Live Presence Banner (Only when another teammate is actively viewing/editing) */}
      {viewers.length > 0 && (() => {
        const primaryEditor = activeEditors[0];
        const primaryTyper = activeTypers[0];
        const primaryViewer = viewers[0];
        const firstName = ((primaryEditor || primaryTyper || primaryViewer)?.userName || 'Teammate').split(' ')[0];
        const label = primaryEditor
          ? `${firstName} editing`
          : primaryTyper
          ? `${firstName} commenting`
          : viewers.length === 1
          ? `${firstName} viewing`
          : `${viewers.length} viewing`;
        return (
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>{label}</span>
          </div>
        );
      })()}

      {/* Task Title & Concise Description */}
      <h3 className="text-[13px] font-semibold text-[var(--text-primary)] leading-snug mb-1.5">
        {task.title}
      </h3>

      {task.description && (
        <p className="text-[11px] text-[var(--text-secondary)] mb-2.5 leading-relaxed line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Checklist Slim Progress */}
      {checklistStats && (
        <div className="mb-2.5 space-y-1">
          <div className="flex justify-between text-[10px] font-mono tabular-nums text-[var(--text-muted)]">
            <span>Checklist</span>
            <span>
              {checklistStats.completed}/{checklistStats.total}
            </span>
          </div>
          <SlimProgressBar
            value={checklistStats.percent}
            tone={checklistStats.percent === 100 ? 'sage' : 'charcoal'}
            heightClass="h-1"
          />
        </div>
      )}

      {/* Clean Footer: Due date / priority icon + Assignee Avatar */}
      <div className="flex items-center justify-between pt-2.5 mt-1 border-t border-[var(--border-hairline)] text-[11px] text-[var(--text-muted)]">
        <div className="flex items-center gap-2 min-w-0 font-mono tabular-nums">
          <PriorityIconComponent className={`w-3.5 h-3.5 shrink-0 ${priorityStyle.color}`} />
          {task.due_date ? (
            <span className="truncate">{new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
          ) : (
            <span className="truncate font-sans">{task.status.replace(/_/g, ' ')}</span>
          )}
        </div>

        <div className="flex items-center shrink-0">
          {assignee ? (
            <Avatar user={assignee} size="xs" />
          ) : task.assignee_id ? (
            <div className="w-5 h-5 rounded-full bg-[var(--bg-sage)] animate-pulse" />
          ) : null}
        </div>
      </div>
    </div>
  );
};
