import React, { useState } from 'react';
import { Task, TaskStatus } from '../../types';
import { TaskCard } from './TaskCard';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';

interface KanbanColumnProps {
  status: TaskStatus;
  title: string;
  colorClass: string;
  tasksOverride?: Task[];
  wipLimit?: number;
  layoutMode?: 'grid' | 'snap';
  selectedTaskIds?: string[];
  focusedTaskId?: string | null;
  onToggleSelectTask?: (taskId: string, shiftKey?: boolean) => void;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  status,
  title,
  colorClass,
  tasksOverride,
  wipLimit,
  layoutMode = 'grid',
  selectedTaskIds = [],
  focusedTaskId = null,
  onToggleSelectTask,
}) => {
  const {
    activeProject,
    getTasksByProjectIdAndStatus,
    openModal,
    isLoadingTasks,
    moveTask,
  } = useAppStore();

  const PlusIcon = ICON_MAP.PlusIcon;
  const [isDragOver, setIsDragOver] = useState(false);
  const [dropIndicatorIndex, setDropIndicatorIndex] = useState<number | null>(null);

  if (!activeProject) return null;

  const tasksInColumn =
    tasksOverride !== undefined
      ? tasksOverride.filter(t => t.status === status)
      : getTasksByProjectIdAndStatus(activeProject.id, status);

  const isWipExceeded = wipLimit !== undefined && wipLimit > 0 && tasksInColumn.length > wipLimit;

  const dropIndicatorStyle = 'h-1 my-1 rounded-full bg-[var(--accent-lime)] transition-all duration-100';

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
      moveTask(draggedTaskId, originalStatus, originalPosition, newStatus, newVisualIndex);
    }
  };

  const responsiveWidthClass =
    layoutMode === 'snap'
      ? 'shrink-0 w-[85vw] sm:w-[310px] md:w-[320px] xl:flex-1 xl:min-w-[270px] xl:max-w-[360px] snap-start'
      : 'w-full min-w-0 max-w-none xl:flex-1 xl:min-w-[260px]';

  return (
    <div
      className={`${responsiveWidthClass} rounded-2xl p-3 sm:p-3.5 border transition-colors flex flex-col ${
        isDragOver
          ? 'bg-[var(--bg-sage)] border-dashed border-[var(--text-primary)]'
          : 'bg-[var(--bg-surface-subtle)] border-[var(--border-hairline)]'
      }`}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragLeave={handleDragLeave}
    >
      <div className="flex items-center justify-between px-1 pb-2.5 mb-2.5 border-b border-[var(--border-hairline)]">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full ${colorClass} shrink-0`} />
          <h2 className="font-bold text-xs sm:text-[13px] text-[var(--text-primary)] truncate">{title}</h2>
          <span
            className={`text-[11px] font-mono tabular-nums px-2 py-0.5 rounded-full shrink-0 ${
              isWipExceeded
                ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400 font-bold'
                : 'bg-[var(--bg-sage)] text-[var(--text-secondary)] font-semibold'
            }`}
          >
            {wipLimit && wipLimit > 0 ? `${tasksInColumn.length}/${wipLimit}` : tasksInColumn.length}
          </span>
        </div>

        <button
          type="button"
          onClick={() => openModal()}
          className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-sage)] transition-colors shrink-0 cursor-pointer"
          title={`Add task to ${title}`}
          disabled={!activeProject}
        >
          <PlusIcon className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 min-h-[260px] md:min-h-[320px] xl:min-h-[420px] space-y-2.5 pb-1 column-content-area">
        {isLoadingTasks && tasksInColumn.length === 0 && (
          <div className="text-center py-12">
            <ICON_MAP.SpinnerIcon className="w-7 h-7 mx-auto text-[var(--text-muted)] animate-spin" />
          </div>
        )}

        {!isLoadingTasks && tasksInColumn.length === 0 && !isDragOver && (
          <div className="text-center py-12 text-xs text-[var(--text-muted)]">
            <p>Drop tasks here or click + to add</p>
          </div>
        )}

        {tasksInColumn.map((task, index) => (
          <React.Fragment key={task.id}>
            {isDragOver && dropIndicatorIndex === index && <div className={dropIndicatorStyle} />}
            <TaskCard
              task={task}
              isSelected={selectedTaskIds.includes(task.id)}
              isFocused={focusedTaskId === task.id}
              onToggleSelect={onToggleSelectTask}
            />
          </React.Fragment>
        ))}

        {isDragOver && dropIndicatorIndex === tasksInColumn.length && tasksInColumn.length > 0 && (
          <div className={dropIndicatorStyle} />
        )}

        {isDragOver && tasksInColumn.length === 0 && (
          <div className="h-24 my-2 flex items-center justify-center border border-dashed border-[var(--border-strong)] rounded-xl">
            <p className="text-xs text-[var(--text-secondary)]">Drop here</p>
          </div>
        )}
      </div>
    </div>
  );
};