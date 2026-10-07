
import React, { useState, useEffect, useCallback } from 'react';
// Fix: Corrected typo in useAppStore import path.
import { useAppStore } from '../../hooks/useAppStore';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { TaskPriority, TaskStatus, User, Task, UserPresence } from '../../types';
import { AITaskGenerator } from '../ai/AITaskGenerator';
import { ICON_MAP } from '../../constants';
import { collabService } from '../../services/collabService';

const formatEnumForDisplay = (enumValue: string): string => {
  if (!enumValue) return '';
  return enumValue
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
};

export const EditTaskModal: React.FC = () => {
  const {
    isEditTaskModalOpen,
    closeEditTaskModal,
    taskToEdit,
    updateTask,
    users,
    currentUser, 
    suggestedTaskTitles,
    setSuggestedTaskTitles,
    darkMode,
    isLoading: globalIsLoading, 
    error: globalError,
    setError: setGlobalError,
    isLoadingUsersForAssignment,
    usersForAssignmentError,
    updateUserPresence,
    presences
  } = useAppStore();

  const wasEditOpenRef = React.useRef(false);
  const [editingFieldLabel, setEditingFieldLabel] = useState<string>('details');

  useEffect(() => {
    if (isEditTaskModalOpen && taskToEdit) {
      wasEditOpenRef.current = true;
      collabService.requestRemotePresences();
      updateUserPresence(taskToEdit.id, undefined, { isEditing: true, editingField: editingFieldLabel, statusAction: 'editing_task' });
    } else if (!isEditTaskModalOpen && wasEditOpenRef.current) {
      wasEditOpenRef.current = false;
      const state = useAppStore.getState();
      if (state.isViewTaskModalOpen && state.taskToView) {
        updateUserPresence(state.taskToView.id, undefined, { isEditing: false });
      } else {
        updateUserPresence(undefined, undefined, { clearTask: true, isEditing: false });
      }
    }
  }, [isEditTaskModalOpen, taskToEdit?.id, editingFieldLabel, updateUserPresence]);

  const [title, setTitle] = useState('');
  const [aiHelperDescription, setAiHelperDescription] = useState('');
  const [mainDescription, setMainDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [status, setStatus] = useState<TaskStatus>(TaskStatus.TODO);
  const [assignee_id, setAssignee_id] = useState<string | undefined>(undefined);
  const [dueDate, setDueDate] = useState<string>('');
  const [localFormError, setLocalFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const SpinnerIcon = ICON_MAP.SpinnerIcon;

  const detectChanges = useCallback(() => {
    if (!taskToEdit) return false;
    if (title.trim() !== taskToEdit.title) return true;
    if ((mainDescription.trim() || undefined) !== (taskToEdit.description || undefined)) return true;
    if (priority !== taskToEdit.priority) return true;
    if (status !== taskToEdit.status) return true;
    if ((assignee_id || undefined) !== (taskToEdit.assignee_id || undefined)) return true;
    const currentDueDateForCompare = taskToEdit.dueDate ? new Date(taskToEdit.dueDate).toISOString().split('T')[0] : '';
    if ((dueDate || '') !== currentDueDateForCompare) return true;
    return false;
  }, [taskToEdit, title, mainDescription, priority, status, assignee_id, dueDate]);

  useEffect(() => {
    if (taskToEdit && isEditTaskModalOpen) { 
      setTitle(taskToEdit.title);
      setMainDescription(taskToEdit.description || '');
      setAiHelperDescription(taskToEdit.description || ''); 
      setPriority(taskToEdit.priority);
      setStatus(taskToEdit.status);
      setAssignee_id(taskToEdit.assignee_id || undefined);
      setDueDate(taskToEdit.dueDate ? new Date(taskToEdit.dueDate).toISOString().split('T')[0] : '');
      setSuggestedTaskTitles([]);
      setGlobalError(null);
      setLocalFormError(null);
      setHasChanges(false); 
    }
  }, [taskToEdit, isEditTaskModalOpen, setSuggestedTaskTitles, setGlobalError]);

  useEffect(() => {
    if (isEditTaskModalOpen) {
      setHasChanges(detectChanges());
    }
  }, [title, mainDescription, priority, status, assignee_id, dueDate, isEditTaskModalOpen, detectChanges]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalFormError(null);
    setGlobalError(null);
    
    if (!title.trim()) {
      setLocalFormError("Task title is required.");
      return;
    }
    if (!taskToEdit) {
      setLocalFormError("No task selected for editing.");
      return;
    }
    
    setIsSubmitting(true);

    const updates: Partial<Omit<Task, 'id' | 'created_at' | 'updated_at' | 'creator_id' | 'projectId'>> = {};
    if (title.trim() !== taskToEdit.title) updates.title = title.trim();
    if ((mainDescription.trim() || undefined) !== (taskToEdit.description || undefined)) updates.description = mainDescription.trim() || undefined;
    if (priority !== taskToEdit.priority) updates.priority = priority;
    if (status !== taskToEdit.status) updates.status = status;
    if ((assignee_id || undefined) !== (taskToEdit.assignee_id || undefined)) updates.assignee_id = assignee_id || undefined;
    
    const currentDueDateForCompare = taskToEdit.dueDate ? new Date(taskToEdit.dueDate).toISOString().split('T')[0] : undefined;
    if ((dueDate || undefined) !== currentDueDateForCompare) updates.dueDate = dueDate || undefined; // Send undefined if empty to clear it

    if (Object.keys(updates).length === 0) {
        setLocalFormError("No changes detected to save.");
        setIsSubmitting(false);
        return;
    }
    
    try {
      await updateTask(taskToEdit.id, updates);
      // closeModal is handled by store action on success
    } catch (err: any) {
      // Error is handled by the store and displayed via globalError
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuggestionSelect = (suggestedTitle: string) => {
    setTitle(suggestedTitle);
  };
  
  const labelClass = `block text-sm font-medium mb-1.5 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`;
  const selectWrapperClass = "relative";
  const selectArrowClass = `absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 ${darkMode ? 'text-slate-400' : 'text-slate-500'} pointer-events-none`;

  const displayError = localFormError || globalError;

  if (!isEditTaskModalOpen || !taskToEdit) return null;

  // Only show OTHER teammates active on this task — never include yourself
  const otherTaskParticipants: UserPresence[] = (() => {
    const map = new Map<string, UserPresence>();
    (presences || []).forEach(p => {
      if (p.currentTaskId !== taskToEdit.id) return;
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
  })();

  const modalTitleText = (
    <div className="flex items-center justify-between w-full pr-8 gap-2">
      <span className="text-gradient-accent truncate">{`Edit Task: ${taskToEdit.title}`}</span>
      {otherTaskParticipants.length > 0 && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {otherTaskParticipants.map(p => {
            const name = (p.userName || 'Teammate').split(' ')[0];
            return (
              <span
                key={p.userId}
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  p.isEditing
                    ? 'bg-blue-500/15 border-blue-500/30 text-blue-700 dark:text-blue-300'
                    : p.isTypingComment
                      ? 'bg-purple-500/15 border-purple-500/30 text-purple-700 dark:text-purple-300'
                      : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                }`}
              >
                {name} {p.isEditing ? `editing` : p.isTypingComment ? 'commenting' : 'viewing'}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <Modal isOpen={isEditTaskModalOpen} onClose={closeEditTaskModal} title={modalTitleText as unknown as string} size="xl">
      <form onSubmit={handleSubmit} className="space-y-5 p-1">
        <div>
          <label htmlFor="edit-task-title" className={labelClass}>Title <span className="text-status-error">*</span></label>
          <input
            type="text"
            id="edit-task-title"
            value={title}
            onFocus={() => setEditingFieldLabel('title')}
            onChange={(e) => { setTitle(e.target.value); setEditingFieldLabel('title'); if(localFormError && title.trim()) setLocalFormError(null);}}
            required
            placeholder="e.g., Finalize Q3 report"
            disabled={isSubmitting || globalIsLoading}
            className="w-full font-medium"
          />
        </div>

        <div>
          <label htmlFor="edit-task-description" className={labelClass}>Description</label>
          <textarea
            id="edit-task-description"
            rows={4}
            value={mainDescription}
            onFocus={() => setEditingFieldLabel('description')}
            onChange={(e) => { setMainDescription(e.target.value); setEditingFieldLabel('description'); }}
            placeholder="Add more details: user stories, acceptance criteria, links..."
            disabled={isSubmitting || globalIsLoading}
            className="w-full font-medium"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div className={selectWrapperClass}>
                <label htmlFor="edit-task-priority" className={labelClass}>Priority</label>
                <select id="edit-task-priority" value={priority} onFocus={() => setEditingFieldLabel('priority')} onChange={(e) => { setPriority(e.target.value as TaskPriority); setEditingFieldLabel('priority'); }} disabled={isSubmitting || globalIsLoading} className="font-medium appearance-none">
                    {Object.values(TaskPriority).map(p => <option key={p} value={p}>{formatEnumForDisplay(p)}</option>)}
                </select>
                <ICON_MAP.ChevronDownIcon className={selectArrowClass} />
            </div>
            <div className={selectWrapperClass}>
                <label htmlFor="edit-task-status" className={labelClass}>Status</label>
                <select id="edit-task-status" value={status} onFocus={() => setEditingFieldLabel('status')} onChange={(e) => { setStatus(e.target.value as TaskStatus); setEditingFieldLabel('status'); }} disabled={isSubmitting || globalIsLoading} className="font-medium appearance-none">
                    {Object.values(TaskStatus).map(s => <option key={s} value={s}>{formatEnumForDisplay(s)}</option>)}
                </select>
                 <ICON_MAP.ChevronDownIcon className={selectArrowClass} />
            </div>
        
            <div className={selectWrapperClass}>
                <label htmlFor="edit-task-assignee" className={labelClass}>Assignee</label>
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
                    <select id="edit-task-assignee" value={assignee_id || ''} onChange={(e) => setAssignee_id(e.target.value || undefined)} disabled={isSubmitting || globalIsLoading || users.length === 0} className="font-medium appearance-none">
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
                <label htmlFor="edit-task-due-date" className={labelClass}>Due Date</label>
                <input type="date" id="edit-task-due-date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={isSubmitting || globalIsLoading} className="font-medium"/>
            </div>
        </div>

        {displayError && <p className={`text-sm text-status-error text-center p-3 rounded-squircle-sm border border-status-error/40 bg-status-error/15`}>{displayError}</p>}

        <div className="flex flex-col sm:flex-row justify-end items-center space-y-3 sm:space-y-0 sm:space-x-4 pt-4 border-t border-[hsl(var(--panel-border))]"> {/* Reduced pt */}
          <Button type="button" variant="outline" onClick={closeEditTaskModal} disabled={isSubmitting || globalIsLoading} className="w-full sm:w-auto text-sm">Cancel</Button>
          <Button type="submit" variant="primary" disabled={isSubmitting || globalIsLoading || !title.trim() || !hasChanges} className="w-full sm:w-auto text-sm">
            {(isSubmitting || globalIsLoading) && <SpinnerIcon className="w-4 h-4 animate-spin mr-2" />}
            {isSubmitting || globalIsLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};