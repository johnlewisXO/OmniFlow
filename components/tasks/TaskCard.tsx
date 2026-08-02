
import React from 'react';
import { Task, User, TaskPriority } from '../../types';
// Fix: Corrected typo in useAppStore import path.
import { useAppStore } from '../../hooks/useAppStore';
import { Avatar } from '../shared/Avatar';
import { PRIORITY_STYLES, ICON_MAP } from '../../constants';

interface TaskCardProps {
  task: Task;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task }) => {
  const { 
    users, 
    darkMode, 
    deleteTask: deleteTaskAction, 
    openViewTaskModal,
    highlightedTaskId 
  } = useAppStore();
  
  const assignee = users.find(user => user.id === task.assignee_id); 

  const PriorityIconComponent = PRIORITY_STYLES[task.priority].icon;
  const priorityColor = PRIORITY_STYLES[task.priority].color;

  const cardBackgroundStyle = { backgroundColor: 'var(--card-background)', borderColor: 'var(--card-border)' };
  const textColor = darkMode ? 'text-slate-200' : 'text-slate-700';
  const subTextColor = darkMode ? 'text-slate-400' : 'text-slate-500';

  const isHighlighted = highlightedTaskId === task.id;

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
    targetElement.classList.add('opacity-50', 'shadow-glass-lg', 'scale-105', 'rotate-1'); // Add a slight rotation

    // Custom drag image for better visual feedback (optional but nice)
    const dragImage = targetElement.cloneNode(true) as HTMLElement;
    dragImage.style.position = "absolute";
    dragImage.style.top = "-1000px"; 
    dragImage.style.width = targetElement.offsetWidth + "px";
    dragImage.style.height = targetElement.offsetHeight + "px";
    dragImage.style.transform = 'rotate(3deg) scale(1.03)'; // Consistent with hover/active effect
    dragImage.style.boxShadow = '0 12px 40px 0 hsla(var(--shadow-color-rgb), 0.15)'; // Emphasize floating
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, targetElement.offsetWidth / 2, 20); // Center horizontally, slight offset vertically
    
    // Cleanup the cloned drag image element after a short delay
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
      className={`p-4 rounded-squircle-md shadow-glass border cursor-grab hover:shadow-glass-lg active:cursor-grabbing active:opacity-75 transition-all duration-300 ease-out transform hover:scale-[1.02] hover:-translate-y-0.5
                  ${isHighlighted ? (darkMode ? 'ring-2 ring-accent-light shadow-accent-light/20' : 'ring-2 ring-accent shadow-accent/20') : ''}`}
      onClick={handleCardClick}
      draggable={true} 
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex justify-between items-start mb-2.5">
        <h3 className={`text-md font-semibold ${textColor} leading-tight mr-2`}>{task.title}</h3>
        <div className="flex items-center space-x-1 flex-shrink-0">
            <button
                onClick={handleDelete}
                title="Delete task"
                className={`p-1.5 rounded-squircle-sm ${darkMode ? 'text-slate-400 hover:bg-status-error/30 hover:text-red-300' : 'text-slate-500 hover:bg-status-error/20 hover:text-red-600'} transition-colors`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12.56 0c.342.052.682.107 1.022.166m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09.991-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
            </button>
        </div>
      </div>
      {task.description && (
        <p className={`text-xs ${subTextColor} mb-3 leading-relaxed truncate-2-lines`}>
          {task.description}
        </p>
      )}
      <div className={`flex items-center justify-between text-xs ${subTextColor}`}>
        <div className="flex items-center space-x-1.5">
          <PriorityIconComponent className={`w-4 h-4 ${priorityColor}`} />
          <span className={`${priorityColor} font-medium`}>{task.priority}</span>
        </div>
        <div className="flex">
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