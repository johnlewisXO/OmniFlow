
import React, { useState } from 'react';
import { Task, TaskStatus } from '../../types';
import { TaskCard } from './TaskCard';
// Fix: Corrected typo in useAppStore import path.
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';

interface KanbanColumnProps {
  status: TaskStatus; 
  title: string;
  colorClass: string;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({ status, title, colorClass }) => {
  const { 
    activeProject, 
    getTasksByProjectIdAndStatus, 
    openModal, 
    darkMode,
    isLoadingTasks,
    moveTask,
  } = useAppStore();
  
  const PlusIcon = ICON_MAP.PlusIcon;
  const [isDragOver, setIsDragOver] = useState(false);
  const [dropIndicatorIndex, setDropIndicatorIndex] = useState<number | null>(null);


  if (!activeProject) return null;

  const tasksInColumn = getTasksByProjectIdAndStatus(activeProject.id, status);

  const columnBackgroundStyle = { backgroundColor: 'hsl(var(--panel-background))', borderColor: 'hsl(var(--panel-border))' };
  const textColor = darkMode ? 'text-slate-200' : 'text-slate-700';
  const countBg = darkMode ? 'bg-slate-700/70' : 'bg-slate-300/70';
  const countText = darkMode ? 'text-slate-300' : 'text-slate-600';
  const buttonHoverBg = darkMode ? 'hover:bg-accent/20' : 'hover:bg-accent/15';
  const dragOverColumnBorderStyle = isDragOver ? `border-2 border-dashed ${darkMode ? 'border-accent-light/70' : 'border-accent/70'}` : 'border';
  const dropIndicatorStyle = `h-1.5 my-1 rounded-full bg-accent ${darkMode ? 'opacity-70' : 'opacity-90'} transition-all duration-100`;


  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) setIsDragOver(true);

    const columnContent = e.currentTarget.querySelector('.column-content-area') as HTMLElement;
    if (!columnContent) return;

    const taskCards = Array.from(columnContent.querySelectorAll<HTMLElement>('[data-task-id]'));
    const mouseY = e.clientY;
    
    let newDropIndex = taskCards.length; 

    for (let i = 0; i < taskCards.length; i++) {
      const cardRect = taskCards[i].getBoundingClientRect();
      const cardMidY = cardRect.top + cardRect.height / 2;
      if (mouseY < cardMidY) {
        newDropIndex = i;
        break;
      }
    }
    setDropIndicatorIndex(newDropIndex);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
        setIsDragOver(false);
        setDropIndicatorIndex(null);
    }
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    setDropIndicatorIndex(null);
    if (!activeProject) return;

    const draggedTaskId = e.dataTransfer.getData('taskId');
    const originalStatus = e.dataTransfer.getData('originalStatus') as TaskStatus;
    const originalPosition = parseInt(e.dataTransfer.getData('originalPosition'), 10);
    const newStatus = status; 
    
    const newVisualIndex = dropIndicatorIndex !== null ? dropIndicatorIndex : tasksInColumn.length;
    
    if (draggedTaskId) {
      console.log(`[KanbanColumn Drop] TaskID: ${draggedTaskId}, OriginalStatus: ${originalStatus}, OriginalPos: ${originalPosition}, NewStatus: ${newStatus}, NewVisualIndex: ${newVisualIndex}`);
      moveTask(draggedTaskId, originalStatus, originalPosition, newStatus, newVisualIndex);
    } else {
      console.warn("[KanbanColumn Drop] No taskId found in dataTransfer.");
    }
  };


  return (
    <div 
      style={columnBackgroundStyle}
      className={`w-full md:flex-1 md:min-w-[300px] md:max-w-[340px] rounded-squircle-lg p-3 md:p-4 shadow-glass ${dragOverColumnBorderStyle} transition-all duration-200 flex flex-col`}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragLeave={handleDragLeave}
    >
      <div className={`flex items-center justify-between px-1 py-2 mb-3.5 rounded-md`}>
        <div className="flex items-center space-x-2.5">
          <span className={`w-3 h-3 rounded-full ${colorClass} shadow-sm`}></span>
          <h2 className={`font-semibold text-md ${textColor}`}>{title}</h2>
          <span className={`text-xs font-medium ${countText} ${countBg} px-2.5 py-1 rounded-full shadow-sm`}>
            {tasksInColumn.length}
          </span>
        </div>
        <button 
          onClick={() => openModal()} 
          className={`${darkMode ? 'text-slate-400 hover:text-accent-light' : 'text-slate-500 hover:text-accent'} p-1.5 rounded-squircle-sm ${buttonHoverBg} transition-colors`}
          title={`Add task to ${title}`}
          disabled={!activeProject}
        >
          <PlusIcon className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 min-h-[150px] md:h-[calc(100vh-12rem-90px)] overflow-y-auto space-y-0 px-1 pb-2 scrollbar-thin column-content-area"> {/* Adjusted height */}
        {isLoadingTasks && tasksInColumn.length === 0 && (
          <div className="text-center py-12">
             <ICON_MAP.SpinnerIcon className={`w-10 h-10 mx-auto ${darkMode ? 'text-accent-light/70' : 'text-accent/70'} animate-spin`} />
          </div>
        )}
        {!isLoadingTasks && tasksInColumn.length === 0 && !isDragOver && (
          <div className="text-center py-12 text-sm opacity-60">
            <p>Drop tasks here</p>
            <p>or click '+' to add.</p>
          </div>
        )}
        
        {tasksInColumn.map((task, index) => (
          <React.Fragment key={task.id}>
            {isDragOver && dropIndicatorIndex === index && (
              <div className={dropIndicatorStyle}></div>
            )}
            <TaskCard task={task} />
          </React.Fragment>
        ))}
        {isDragOver && dropIndicatorIndex === tasksInColumn.length && tasksInColumn.length > 0 && (
           <div className={dropIndicatorStyle}></div>
        )}
         {isDragOver && tasksInColumn.length === 0 && ( 
            <div className={`h-24 my-2 flex items-center justify-center border-2 border-dashed ${darkMode ? 'border-accent-light/50' : 'border-accent/50'} rounded-squircle-md`}>
                <p className={`text-sm ${darkMode ? 'text-accent-light/80' : 'text-accent/80'}`}>Drop here</p>
            </div>
        )}

      </div>
    </div>
  );
};