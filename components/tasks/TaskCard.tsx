
import React, { useMemo } from 'react';
import { Task, User, TaskPriority, TaskStatus } from '../../types';
import { useAppStore } from '../../hooks/useAppStore';
import { Avatar } from '../shared/Avatar';
import { PRIORITY_STYLES, ICON_MAP } from '../../constants';

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
    highlightedTaskId,
    presences,
    currentUser
  } = useAppStore();
  
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

  // Users currently viewing this card
  const viewers = useMemo(() => {
    return presences.filter(p => p.currentTaskId === task.id && p.userId !== currentUser?.id);
  }, [presences, task.id, currentUser]);

  const activeEditors = useMemo(() => {
    return viewers.filter(v => v.isEditing);
  }, [viewers]);

  const activeTypers = useMemo(() => {
    return viewers.filter(v => v.isTypingComment);
  }, [viewers]);

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
                  ${isBlocked ? 'border-amber-400/60 dark:border-amber-500/50 bg-amber-50/20 dark:bg-amber-950/10' : ''}`}
      onClick={handleCardClick}
      draggable={true} 
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Top Badges: Blocked, Story Points, & Blinking Eye Viewer Circle */}
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
        </div>

        {/* Live Collaborator Presence with Blinking Eye Circle */}
        <div className="flex items-center gap-1.5">
          {activeEditors.length > 0 && (
            <span
              title={`${activeEditors.map(e => e.userName).join(', ')} is currently editing this task`}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-[10px] font-semibold animate-pulse"
            >
              <ICON_MAP.PencilIcon className="w-3 h-3" />
              <span>Editing</span>
            </span>
          )}

          {activeTypers.length > 0 && (
            <span
              title={`${activeTypers.map(e => e.userName).join(', ')} is commenting on this task`}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/30 text-purple-600 dark:text-purple-400 text-[10px] font-semibold animate-pulse"
            >
              <ICON_MAP.ChatBubbleLeftIcon className="w-3 h-3" />
              <span>Typing</span>
            </span>
          )}

          {viewers.length > 0 && (
            <div
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold shadow-xs transition-all"
              title={`${viewers.map(v => v.userName).join(', ')} currently viewing this task`}
            >
              {/* Blinking Eye Circle */}
              <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              <ICON_MAP.EyeIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-pulse flex-shrink-0" />
              <span>{viewers.length}</span>
              {/* Stacked Avatars */}
              <div className="flex -space-x-1 items-center ml-0.5">
                {viewers.slice(0, 3).map(v => (
                  <span
                    key={v.userId}
                    style={{ backgroundColor: v.color }}
                    className="w-4 h-4 rounded-full text-[8px] font-extrabold text-white flex items-center justify-center ring-1 ring-white dark:ring-slate-900 overflow-hidden shadow-xs"
                    title={v.userName}
                  >
                    {v.userAvatar ? <img src={v.userAvatar} alt="" className="w-full h-full object-cover" /> : v.userName.charAt(0).toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between items-start mb-2">
        <h3 className={`text-sm font-bold ${textColor} leading-snug mr-2`}>{task.title}</h3>
        <div className="flex items-center space-x-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
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
