
import React, { useMemo, useState, useEffect } from 'react';
import { Task, User, TaskPriority, TaskStatus, UserPresence } from '../../types';
import { useAppStore } from '../../hooks/useAppStore';
import { Avatar } from '../shared/Avatar';
import { PRIORITY_STYLES, ICON_MAP } from '../../constants';
import { collabService } from '../../services/collabService';

interface TaskCardProps {
  task: Task;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task }) => {
  const { 
    users, 
    tasks,
    darkMode, 
    deleteTask: deleteTaskAction, 
    openViewTaskModal,
    openEditTaskModal,
    highlightedTaskId,
    presences,
    currentUser
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

  const PriorityIconComponent = PRIORITY_STYLES[task.priority].icon;
  const priorityColor = PRIORITY_STYLES[task.priority].color;

  const cardBackgroundStyle = { backgroundColor: 'var(--card-background)', borderColor: 'var(--card-border)' };
  const textColor = darkMode ? 'text-slate-200' : 'text-slate-700';
  const subTextColor = darkMode ? 'text-slate-400' : 'text-slate-500';

  const isHighlighted = highlightedTaskId === task.id;

  // Check if blocked by any unresolved task
  const isBlocked = useMemo(() => {
    if (!task.blockedBy || task.blockedBy.length === 0) return false;
    return task.blockedBy.some(blockerId => {
      const blocker = tasks.find(t => t.id === blockerId);
      return blocker && blocker.status !== TaskStatus.DONE;
    });
  }, [task.blockedBy, tasks]);

  // Checklist stats
  const checklistStats = useMemo(() => {
    if (!task.checklist || task.checklist.length === 0) return null;
    const completed = task.checklist.filter(i => i.completed).length;
    const total = task.checklist.length;
    return { completed, total, percent: Math.round((completed / total) * 100) };
  }, [task.checklist]);

  // OTHER users currently active on this card (viewing, editing, or typing a comment), deduplicated by userId
  // Never include the current user themselves
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

  const activeEditors = useMemo(() => {
    return viewers.filter(v => v.isEditing);
  }, [viewers]);

  const activeTypers = useMemo(() => {
    return viewers.filter(v => v.isTypingComment);
  }, [viewers]);

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

  const handleCardClick = () => {
    openViewTaskModal(task.id);
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('taskId', task.id);
    e.dataTransfer.setData('originalStatus', task.status);
    e.dataTransfer.setData('originalPosition', task.position.toString());
    e.dataTransfer.effectAllowed = 'move';
    
    const targetElement = e.target as HTMLDivElement;
    targetElement.classList.add('opacity-50', 'shadow-glass-lg', 'scale-105', 'rotate-1');

    const dragImage = targetElement.cloneNode(true) as HTMLElement;
    dragImage.style.position = "absolute";
    dragImage.style.top = "-1000px"; 
    dragImage.style.width = targetElement.offsetWidth + "px";
    dragImage.style.height = targetElement.offsetHeight + "px";
    dragImage.style.transform = 'rotate(3deg) scale(1.03)';
    dragImage.style.boxShadow = '0 12px 40px 0 hsla(var(--shadow-color-rgb), 0.15)';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, targetElement.offsetWidth / 2, 20);
    
    setTimeout(() => {
        if (document.body.contains(dragImage)) {
            document.body.removeChild(dragImage);
        }
    }, 0);
  };
  
  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    (e.target as HTMLDivElement).classList.remove('opacity-50', 'shadow-glass-lg', 'scale-105', 'rotate-1');
  };

  return (
    <div
      data-task-id={task.id} 
      style={cardBackgroundStyle}
      className={`p-3.5 sm:p-4 rounded-xl shadow-glass border cursor-grab hover:shadow-glass-lg active:cursor-grabbing active:opacity-75 transition-all duration-200 ease-out transform hover:scale-[1.015] hover:-translate-y-0.5 relative group
                  ${isHighlighted ? (darkMode ? 'ring-2 ring-accent-light shadow-accent-light/20' : 'ring-2 ring-accent shadow-accent/20') : ''}
                  ${activeEditors.length > 0 ? 'ring-1 ring-blue-500/50 border-blue-500/40' : activeTypers.length > 0 ? 'ring-1 ring-purple-500/50 border-purple-500/40' : viewers.length > 0 ? 'ring-1 ring-emerald-500/30 border-emerald-500/30' : ''}
                  ${isBlocked ? 'border-amber-400/60 dark:border-amber-500/50 bg-amber-50/20 dark:bg-amber-950/10' : ''}`}
      onClick={handleCardClick}
      draggable={true} 
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Top Badges: Blocked, Story Points, & Live Presence Count (Other Users Only) */}
      <div className="flex items-center justify-between gap-1.5 mb-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {isBlocked && (
            <span
              title="This task is blocked by unfinished prerequisite tasks."
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 animate-pulse"
            >
              <ICON_MAP.ExclamationTriangleIcon className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              Blocked
            </span>
          )}

          {task.story_points !== undefined && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
              {task.story_points} pts
            </span>
          )}

          {recentRemoteBroadcast && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 animate-pulse">
              <ICON_MAP.BoltIcon className="w-2.5 h-2.5" />
              {recentRemoteBroadcast.actorName} {recentRemoteBroadcast.summary}
            </span>
          )}
        </div>

        {/* Compact Live Presence Indicator (Only shown when OTHER people are active on this task) */}
        {viewers.length > 0 && (
          <div
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold shadow-xs transition-all"
            title={`${viewers.map(v => v.userName).join(', ')} active on this task`}
          >
            <span className="relative flex h-2 w-2 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            <div className="flex -space-x-1">
              {viewers.slice(0, 3).map(v => (
                <span
                  key={v.userId}
                  style={{ backgroundColor: v.color || '#10b981' }}
                  className="w-3.5 h-3.5 rounded-full ring-1 ring-white dark:ring-slate-900 text-[8px] font-extrabold text-white flex items-center justify-center overflow-hidden"
                >
                  {v.userAvatar ? <img src={v.userAvatar} alt="" className="w-full h-full object-cover" /> : (v.userName || 'U').charAt(0).toUpperCase()}
                </span>
              ))}
            </div>
            <span>{viewers.length} active</span>
          </div>
        )}
      </div>

      {/* Detailed Real-Time User Activity Chips (Other People Viewing, Editing, or Typing a Comment) */}
      {viewers.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-1.5 p-1.5 rounded-lg bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70">
          {viewers.map(v => {
            const displayName = (v.userName || 'Teammate').split(' ')[0];
            return (
              <React.Fragment key={v.userId}>
                {!v.isEditing && !v.isTypingComment && (
                  <span
                    title={`${v.userName} is viewing this task`}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold"
                  >
                    <span
                      style={{ backgroundColor: v.color || '#10b981' }}
                      className="w-3.5 h-3.5 rounded-full text-[8px] font-extrabold text-white flex items-center justify-center overflow-hidden flex-shrink-0"
                    >
                      {v.userAvatar ? <img src={v.userAvatar} alt="" className="w-full h-full object-cover" /> : displayName.charAt(0).toUpperCase()}
                    </span>
                    <ICON_MAP.EyeIcon className="w-2.5 h-2.5 flex-shrink-0" />
                    <span className="truncate max-w-[130px]">{displayName} · Viewing</span>
                  </span>
                )}
                {v.isEditing && (
                  <span
                    title={`${v.userName} is currently editing ${v.editingField || 'this task'}`}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/30 text-blue-700 dark:text-blue-300 text-[10px] font-bold animate-pulse"
                  >
                    <span
                      style={{ backgroundColor: v.color || '#3b82f6' }}
                      className="w-3.5 h-3.5 rounded-full text-[8px] font-extrabold text-white flex items-center justify-center overflow-hidden flex-shrink-0"
                    >
                      {v.userAvatar ? <img src={v.userAvatar} alt="" className="w-full h-full object-cover" /> : displayName.charAt(0).toUpperCase()}
                    </span>
                    <ICON_MAP.PencilIcon className="w-2.5 h-2.5 flex-shrink-0" />
                    <span className="truncate max-w-[140px]">
                      {displayName} · Editing{v.editingField ? ` ${v.editingField}` : ''}
                    </span>
                  </span>
                )}
                {v.isTypingComment && (
                  <span
                    title={`${v.userName} is typing a comment on this task`}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/30 text-purple-700 dark:text-purple-300 text-[10px] font-bold animate-pulse"
                  >
                    <span
                      style={{ backgroundColor: v.color || '#8b5cf6' }}
                      className="w-3.5 h-3.5 rounded-full text-[8px] font-extrabold text-white flex items-center justify-center overflow-hidden flex-shrink-0"
                    >
                      {v.userAvatar ? <img src={v.userAvatar} alt="" className="w-full h-full object-cover" /> : displayName.charAt(0).toUpperCase()}
                    </span>
                    <ICON_MAP.ChatBubbleLeftIcon className="w-2.5 h-2.5 flex-shrink-0" />
                    <span className="truncate max-w-[145px]">{displayName} · Typing comment...</span>
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

      <div className="flex justify-between items-start mb-2">
        <h3 className={`text-sm font-bold ${textColor} leading-snug mr-2`}>{task.title}</h3>
        <div className="flex items-center space-x-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
                onClick={handleEdit}
                title="Edit task"
                className={`p-1 rounded-squircle-sm ${darkMode ? 'text-slate-400 hover:bg-blue-500/20 hover:text-blue-300' : 'text-slate-500 hover:bg-blue-500/15 hover:text-blue-600'} transition-colors cursor-pointer`}
            >
              <ICON_MAP.PencilIcon className="w-3.5 h-3.5" />
            </button>
            <button
                onClick={handleDelete}
                title="Delete task"
                className={`p-1 rounded-squircle-sm ${darkMode ? 'text-slate-400 hover:bg-status-error/30 hover:text-red-300' : 'text-slate-500 hover:bg-status-error/20 hover:text-red-600'} transition-colors cursor-pointer`}
            >
              <ICON_MAP.TrashIcon className="w-3.5 h-3.5" />
            </button>
        </div>
      </div>

      {task.description && (
        <p className={`text-xs ${subTextColor} mb-2.5 leading-relaxed line-clamp-2`}>
          {task.description}
        </p>
      )}

      {/* Checklist Progress Bar */}
      {checklistStats && (
        <div className="mb-3 space-y-1 bg-slate-100/60 dark:bg-slate-800/60 p-1.5 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
          <div className="flex justify-between text-[10px] font-semibold text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <ICON_MAP.CheckIcon className="w-3 h-3 text-primary" />
              Checklist
            </span>
            <span>{checklistStats.completed}/{checklistStats.total}</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                checklistStats.percent === 100 ? 'bg-emerald-500' : 'bg-primary'
              }`}
              style={{ width: `${checklistStats.percent}%` }}
            />
          </div>
        </div>
      )}

      <div className={`flex items-center justify-between text-xs ${subTextColor} pt-1 border-t border-slate-100 dark:border-slate-800/80`}>
        <div className="flex items-center space-x-1.5">
          <PriorityIconComponent className={`w-3.5 h-3.5 ${priorityColor}`} />
          <span className={`${priorityColor} text-[11px] font-semibold`}>{task.priority}</span>
        </div>
        <div className="flex items-center space-x-1">
          {assignee && (
            <Avatar user={assignee} size="sm" className={`border-2 ${darkMode ? 'border-slate-700/30' : 'border-white/30'}`} />
          )}
          {!assignee && task.assignee_id && ( 
             <div className={`w-6 h-6 rounded-full bg-slate-500/30 dark:bg-slate-600/40 animate-pulse border-2 ${darkMode ? 'border-slate-700/30' : 'border-white/30'}`} title="Loading assignee..."></div>
          )}
        </div>
      </div>
    </div>
  );
};
