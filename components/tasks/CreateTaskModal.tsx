import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { TaskPriority, TaskStatus, User, Task } from '../../types';
import { AITaskGenerator } from '../ai/AITaskGenerator';
import { ICON_MAP } from '../../constants';

const formatEnumForDisplay = (enumValue: string): string => {
  if (!enumValue) return '';
  return enumValue
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
};

export const CreateTaskModal: React.FC = () => {
  const {
    isModalOpen: isOpen,
    closeModal,
    createTask,
    activeProject,
    users,
    currentUser,
    suggestedTaskTitles,
    setSuggestedTaskTitles,
    darkMode,
    isLoading,
    error: globalError,
    setError: setGlobalError,
    isLoadingUsersForAssignment,
    usersForAssignmentError,
    parentTaskIdForNewTask,
    openViewTaskModal,
    tasks
  } = useAppStore();

  const [title, setTitle] = useState('');
  const [aiHelperDescription, setAiHelperDescription] = useState('');
  const [mainDescription, setMainDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [status, setStatus] = useState<TaskStatus>(TaskStatus.TODO);
  const [assignee_id, setAssignee_id] = useState<string | undefined>(undefined);
  const [dueDate, setDueDate] = useState<string>('');
  const [localFormError, setLocalFormError] = useState<string | null>(null);

  const SpinnerIcon = ICON_MAP.SpinnerIcon;
  const ResetIcon = ICON_MAP.CogIcon; // Using CogIcon as a generic reset/reload icon

  const resetFormFields = () => {
    setTitle('');
    setAiHelperDescription('');
    setMainDescription('');
    setPriority(TaskPriority.MEDIUM);
    setStatus(TaskStatus.TODO);
    setAssignee_id(currentUser?.id || undefined); 
    setDueDate('');
    setSuggestedTaskTitles([]);
    setGlobalError(null);
    setLocalFormError(null);
  };

  useEffect(() => {
    if (isOpen) {
      resetFormFields();
      if (currentUser) {
          setAssignee_id(currentUser.id);
      }
    }
  }, [isOpen, activeProject?.id, currentUser?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalFormError(null);
    setGlobalError(null);

    if (!title.trim()) {
        const msg = "Task title is required.";
        setLocalFormError(msg);
        return;
    }
    const parentTask = parentTaskIdForNewTask ? tasks.find(t => t.id === parentTaskIdForNewTask) : null;
    const targetProjectId = activeProject?.id || parentTask?.projectId;

    if (!targetProjectId) {
        const msg = "No active project selected to add the task to.";
        setLocalFormError(msg);
        return;
    }
    if (!currentUser) {
        const msg = "You must be logged in to create a task.";
        setLocalFormError(msg);
        return;
    }

    const taskData: Omit<Task, 'id' | 'position' | 'created_at' | 'updated_at' | 'creator_id'> = {
      title: title.trim(),
      description: mainDescription.trim() || undefined,
      priority,
      status,
      assignee_id: assignee_id,
      projectId: targetProjectId,
      dueDate: dueDate || undefined,
      parent_task_id: parentTaskIdForNewTask || undefined,
    };

    try {
      const createdTask = await createTask(taskData);
      if (createdTask) {
        openViewTaskModal(createdTask.id);
      }
    } catch (err: any) {
      // Error is set in the store
    }
  };

  const handleSuggestionSelect = (suggestedTitle: string) => {
    setTitle(suggestedTitle);
  };

  const handleResetForm = () => {
    resetFormFields();
  };

  const labelClass = `block text-sm font-medium mb-1.5 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`; 
  const selectWrapperClass = "relative";
  const selectArrowClass = `absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 ${darkMode ? 'text-slate-400' : 'text-slate-500'} pointer-events-none`;


  let createButtonText = 'Create Task';
  let createButtonDisabled = isLoading;

  const parentTask = parentTaskIdForNewTask ? tasks.find(t => t.id === parentTaskIdForNewTask) : null;
  const targetProjectId = activeProject?.id || parentTask?.projectId;

  if (isLoading) {
    createButtonText = 'Creating...';
  } else if (!currentUser) {
    createButtonText = 'Login to Create';
    createButtonDisabled = true;
  } else if (!targetProjectId) {
    createButtonText = 'Select Project to Create';
    createButtonDisabled = true;
  }

  const displayError = localFormError || globalError;
  const modalTitleText = activeProject ? <span className="text-gradient-accent">{`New Task in ${activeProject.name}`}</span> : parentTask ? <span className="text-gradient-accent">{`New Subtask in ${parentTask.title}`}</span> : <span className="text-gradient-accent">New Task</span>;


  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={closeModal} title={modalTitleText as unknown as string} size="xl">
      <form onSubmit={handleSubmit} className="space-y-5 p-1"> {/* Reduced vertical spacing for y-axis */}
        <div>
          <label htmlFor="task-title" className={labelClass}>Title <span className="text-status-error">*</span></label>
          <input
            type="text"
            id="task-title"
            value={title}
            onChange={(e) => { setTitle(e.target.value); if(localFormError && title.trim()) setLocalFormError(null);}}
            required
            placeholder="e.g., Design homepage mockups"
            disabled={isLoading}
            className="text-base" // Ensure inputs pick up global styles
          />
        </div>

        <AITaskGenerator
          description={aiHelperDescription}
          onDescriptionChange={setAiHelperDescription}
          onSuggestionSelect={handleSuggestionSelect}
        />

        <div>
          <label htmlFor="task-description" className={labelClass}>Description</label>
          <textarea
            id="task-description"
            rows={3} 
            value={mainDescription}
            onChange={(e) => setMainDescription(e.target.value)}
            placeholder="Add more details: user stories, acceptance criteria, links..."
            disabled={isLoading}
            className="text-base" // Ensure inputs pick up global styles
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4"> {/* Reduced y-gap */}
            <div className={selectWrapperClass}>
                <label htmlFor="task-priority" className={labelClass}>Priority</label>
                <select id="task-priority" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} disabled={isLoading} className="text-base appearance-none">
                    {Object.values(TaskPriority).map(p => <option key={p} value={p}>{formatEnumForDisplay(p)}</option>)}
                </select>
                <ICON_MAP.ChevronDownIcon className={selectArrowClass} />
            </div>
            <div className={selectWrapperClass}>
                <label htmlFor="task-status" className={labelClass}>Status</label>
                <select id="task-status" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} disabled={isLoading} className="text-base appearance-none">
                    {Object.values(TaskStatus).map(s => <option key={s} value={s}>{formatEnumForDisplay(s)}</option>)}
                </select>
                 <ICON_MAP.ChevronDownIcon className={selectArrowClass} />
            </div>
        
            <div className={selectWrapperClass}>
                <label htmlFor="task-assignee" className={labelClass}>Assignee</label>
                {isLoadingUsersForAssignment && (
                <div className={`flex items-center text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'} h-11 py-2.5 px-3.5 border border-transparent rounded-squircle-sm`}>
                    <SpinnerIcon className="w-4 h-4 mr-2 animate-spin text-accent" /> Loading assignees...
                </div>
                )}
                {usersForAssignmentError && !isLoadingUsersForAssignment && (
                    <p className="text-xs text-status-error h-11 flex items-center py-2.5 px-3.5">{usersForAssignmentError}</p>
                )}
                {!isLoadingUsersForAssignment && !usersForAssignmentError && (
                <>
                    <select id="task-assignee" value={assignee_id || ''}  onChange={(e) => setAssignee_id(e.target.value || undefined)} disabled={isLoading || users.length === 0} className="text-base appearance-none">
                        <option value="">Unassigned</option>
                        {users.map((user: User) => ( <option key={user.id} value={user.id}>{user.full_name || user.email}</option> ))}
                    </select>
                    <ICON_MAP.ChevronDownIcon className={selectArrowClass} />
                </>
                )}
                {!isLoadingUsersForAssignment && !usersForAssignmentError && users.length === 0 && (
                    <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'} h-11 flex items-center py-2.5 px-3.5`}>No users for assignment.</p>
                )}
            </div>

            <div>
                <label htmlFor="task-due-date" className={labelClass}>Due Date</label>
                <input type="date" id="task-due-date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={isLoading} className="text-base"/>
            </div>
        </div>


        {displayError && <p className={`text-sm text-status-error text-center p-3 rounded-squircle-sm border border-status-error/40 bg-status-error/15`}>{displayError}</p>}

        <div className="flex flex-col sm:flex-row justify-end items-center space-y-3 sm:space-y-0 sm:space-x-4 pt-4 border-t border-[hsl(var(--panel-border))]"> {/* Reduced pt */}
          <Button type="button" variant="ghost" onClick={handleResetForm} disabled={isLoading} className="w-full sm:w-auto text-sm" title="Reset Form">
            <ResetIcon className="w-4 h-4 mr-1.5" />
            Reset
          </Button>
          <div className="flex w-full sm:w-auto space-x-3">
            <Button type="button" variant="outline" onClick={closeModal} disabled={isLoading} className="w-1/2 sm:w-auto text-sm">Cancel</Button>
            <Button type="submit" variant="primary" disabled={createButtonDisabled || !title.trim()} className="w-1/2 sm:w-auto text-sm">
                {isLoading && <SpinnerIcon className="w-4 h-4 animate-spin mr-2" />}
                {createButtonText}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
