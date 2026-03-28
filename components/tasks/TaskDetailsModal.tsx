import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { TaskPriority, TaskStatus, User, Task, TaskComment, TaskAttachment, TaskActivityLog } from '../../types';
import { ICON_MAP } from '../../constants';
import supabaseService, { supabase } from '../../services/supabaseService';

const formatEnumForDisplay = (enumValue: string): string => {
  if (!enumValue) return '';
  return enumValue
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
};

export const TaskDetailsModal: React.FC = () => {
  const {
    isViewTaskModalOpen,
    closeViewTaskModal,
    taskToView,
    updateTask,
    users,
    currentUser,
    darkMode,
    activeProject,
    openEditTaskModal
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'general' | 'qa' | 'admin'>('general');
  const [activityTab, setActivityTab] = useState<'comments' | 'history' | 'worklog'>('comments');
  
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [activityLogs, setActivityLogs] = useState<TaskActivityLog[]>([]);
  const [collaborators, setCollaborators] = useState<TaskCollaborator[]>([]);
  const [isAddingCollaborator, setIsAddingCollaborator] = useState(false);
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState('');
  
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const SpinnerIcon = ICON_MAP.SpinnerIcon;

  useEffect(() => {
    if (isViewTaskModalOpen && taskToView) {
      fetchTaskDetails();
    }
  }, [isViewTaskModalOpen, taskToView]);

  const fetchTaskDetails = async () => {
    if (!taskToView) return;
    try {
      // Fetch comments
      const { data: commentsData } = await supabase
        .from('task_comments')
        .select('*, user:user_profiles(*)')
        .eq('task_id', taskToView.id)
        .order('created_at', { ascending: true });
      if (commentsData) setComments(commentsData as any);

      // Fetch attachments
      const { data: attachmentsData } = await supabase
        .from('task_attachments')
        .select('*, user:user_profiles(*)')
        .eq('task_id', taskToView.id)
        .order('created_at', { ascending: false });
      if (attachmentsData) setAttachments(attachmentsData as any);

      // Fetch subtasks
      const { data: subtasksData } = await supabase
        .from('tasks')
        .select('*')
        .eq('parent_task_id', taskToView.id)
        .order('position', { ascending: true });
      if (subtasksData) setSubtasks(subtasksData as any);

      // Fetch collaborators
      const { data: collaboratorsData } = await supabase
        .from('task_collaborators')
        .select('*, user:user_profiles(*)')
        .eq('task_id', taskToView.id);
      if (collaboratorsData) {
        setCollaborators(collaboratorsData as any);
      }

      // Fetch activity logs
      const { data: logsData } = await supabase
        .from('task_activity_logs')
        .select('*, user:user_profiles(*)')
        .eq('task_id', taskToView.id)
        .order('created_at', { ascending: false });
      if (logsData) setActivityLogs(logsData as any);

    } catch (error) {
      console.error("Error fetching task details:", error);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !taskToView || !currentUser) return;
    setIsSubmittingComment(true);
    try {
      const { data, error } = await supabase
        .from('task_comments')
        .insert({
          task_id: taskToView.id,
          user_id: currentUser.id,
          content: newComment.trim()
        })
        .select('*, user:user_profiles(*)')
        .single();
        
      if (error) throw error;
      if (data) {
        setComments([...comments, data as any]);
        setNewComment('');
        
        // Log activity
        await supabase.from('task_activity_logs').insert({
          task_id: taskToView.id,
          user_id: currentUser.id,
          action: 'comment_added'
        });
      }
    } catch (error) {
      console.error("Error adding comment:", error);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !taskToView || !currentUser) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${taskToView.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('task-attachments')
        .getPublicUrl(filePath);

      const { data, error: dbError } = await supabase
        .from('task_attachments')
        .insert({
          task_id: taskToView.id,
          user_id: currentUser.id,
          file_name: file.name,
          file_url: publicUrl,
          file_type: file.type,
          file_size: file.size
        })
        .select('*, user:user_profiles(*)')
        .single();

      if (dbError) throw dbError;
      if (data) {
        setAttachments([data as any, ...attachments]);
        
        // Log activity
        await supabase.from('task_activity_logs').insert({
          task_id: taskToView.id,
          user_id: currentUser.id,
          action: 'attachment_added',
          details: { file_name: file.name }
        });
      }
    } catch (error) {
      console.error("Error uploading file:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (!taskToView || !currentUser) return;
    try {
      await updateTask(taskToView.id, { status: newStatus });
      
      // Log activity
      await supabase.from('task_activity_logs').insert({
        task_id: taskToView.id,
        user_id: currentUser.id,
        action: 'status_changed',
        details: { old_status: taskToView.status, new_status: newStatus }
      });
      
      // Update local state to reflect change immediately
      taskToView.status = newStatus;
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleAddCollaborator = async () => {
    if (!selectedCollaboratorId || !taskToView || !currentUser) return;
    try {
      const { data, error } = await supabase
        .from('task_collaborators')
        .insert({
          task_id: taskToView.id,
          user_id: selectedCollaboratorId,
          role: 'editor'
        })
        .select('*, user:user_profiles(*)')
        .single();

      if (error) throw error;
      if (data) {
        setCollaborators([...collaborators, data as any]);
        setIsAddingCollaborator(false);
        setSelectedCollaboratorId('');
        
        // Log activity
        await supabase.from('task_activity_logs').insert({
          task_id: taskToView.id,
          user_id: currentUser.id,
          action: 'collaborator_added',
          details: { collaborator_id: selectedCollaboratorId }
        });
      }
    } catch (error) {
      console.error("Error adding collaborator:", error);
    }
  };

  if (!isViewTaskModalOpen || !taskToView) return null;

  const modalTitle = (
    <div className="flex items-center text-sm text-slate-500 dark:text-slate-400 font-normal">
      <span>Projects</span>
      <span className="mx-2">/</span>
      <span>{activeProject?.name || 'Project'}</span>
      <span className="mx-2">/</span>
      <span className="text-slate-800 dark:text-slate-200 font-medium">{taskToView.title}</span>
    </div>
  );

  return (
    <Modal isOpen={isViewTaskModalOpen} onClose={closeViewTaskModal} title={modalTitle as any} size="full">
      <div className="flex flex-col md:flex-row h-full gap-6">
        
        {/* Left Column: Main Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto pr-2">
          
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{taskToView.title}</h1>
            <button 
              onClick={() => openEditTaskModal(taskToView.id)}
              className={`p-2 rounded-md border ${darkMode ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-300 hover:bg-slate-50 text-slate-700'}`}
              title="Edit Task"
            >
              <ICON_MAP.PencilIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 mb-6">
            <label className="cursor-pointer">
              <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border ${darkMode ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-300 hover:bg-slate-50 text-slate-700'} transition-colors`}>
                {isUploading ? <SpinnerIcon className="w-4 h-4 animate-spin" /> : <ICON_MAP.PaperClipIcon className="w-4 h-4" />}
                Attach
              </div>
            </label>
            <button 
              onClick={() => {
                closeViewTaskModal();
                useAppStore.getState().openModal(taskToView.id);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border ${darkMode ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-300 hover:bg-slate-50 text-slate-700'} transition-colors`}
            >
              <ICON_MAP.PlusIcon className="w-4 h-4" />
              Create subtask
            </button>
            <button className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border ${darkMode ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-300 hover:bg-slate-50 text-slate-700'} transition-colors`}>
              <ICON_MAP.LinkIcon className="w-4 h-4" />
              Link issue
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-700 mb-6">
            {['General', 'QA Testing', 'Admin'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab.toLowerCase() as any)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.toLowerCase()
                    ? 'border-accent text-accent'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="space-y-8">
            {/* Description */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Description</h3>
              <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                {taskToView.description || 'No description provided.'}
              </div>
            </div>

            {/* Attachments */}
            {attachments.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Attachments ({attachments.length})</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {attachments.map(att => (
                    <div key={att.id} className="relative group rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 aspect-video bg-slate-100 dark:bg-slate-800">
                      {att.file_type?.startsWith('image/') ? (
                        <img src={att.file_url} alt={att.file_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-2">
                          <ICON_MAP.DocumentTextIcon className="w-8 h-8 text-slate-400 mb-2" />
                          <span className="text-xs text-center truncate w-full px-2">{att.file_name}</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-sm">
                          <ICON_MAP.EyeIcon className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Subtasks */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Subtasks</h3>
                <button className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"><ICON_MAP.PlusIcon className="w-4 h-4" /></button>
              </div>
              {subtasks.length > 0 ? (
                <div className="space-y-2">
                  {/* Progress bar */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-accent" 
                        style={{ width: `${(subtasks.filter(s => s.status === TaskStatus.DONE).length / subtasks.length) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500">{Math.round((subtasks.filter(s => s.status === TaskStatus.DONE).length / subtasks.length) * 100)}% Done</span>
                  </div>
                  {/* Subtask list */}
                  {subtasks.map(subtask => (
                    <div key={subtask.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
                      <div className="flex items-center gap-3">
                        <ICON_MAP.CheckCircleIcon className="w-4 h-4 text-accent" />
                        <span className="text-sm text-slate-700 dark:text-slate-300">{subtask.title}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          subtask.status === TaskStatus.DONE ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          subtask.status === TaskStatus.IN_PROGRESS ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                        }`}>
                          {formatEnumForDisplay(subtask.status)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 italic">No subtasks yet.</p>
              )}
            </div>

            {/* Activity */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Activity</h3>
              
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500">Show:</span>
                  {['Comments', 'History', 'Work log'].map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActivityTab(tab.toLowerCase().replace(' ', '') as any)}
                      className={`px-3 py-1 rounded-full transition-colors ${
                        activityTab === tab.toLowerCase().replace(' ', '')
                          ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200 font-medium'
                          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <button className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1">
                  Oldest first <ICON_MAP.ChevronDownIcon className="w-3 h-3" />
                </button>
              </div>

              {activityTab === 'comments' && (
                <div className="space-y-6">
                  {/* Comment Input */}
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {currentUser?.avatar_url ? (
                        <img src={currentUser.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-accent font-medium text-sm">{currentUser?.full_name?.charAt(0) || currentUser?.email?.charAt(0)}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Add a comment..."
                        className={`w-full p-3 rounded-lg border text-sm focus:ring-2 focus:ring-accent focus:border-transparent resize-none ${
                          darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                        }`}
                        rows={3}
                      />
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs text-slate-500">Pro tip: press <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">M</kbd> to comment</span>
                        <Button onClick={handleAddComment} disabled={!newComment.trim() || isSubmittingComment} size="sm">
                          {isSubmittingComment ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Comments List */}
                  {comments.map(comment => (
                    <div key={comment.id} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {comment.user?.avatar_url ? (
                          <img src={comment.user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-slate-600 dark:text-slate-300 font-medium text-sm">
                            {comment.user?.full_name?.charAt(0) || comment.user?.email?.charAt(0) || '?'}
                          </span>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="font-medium text-sm text-slate-900 dark:text-white">
                            {comment.user?.full_name || comment.user?.email || 'Unknown User'}
                          </span>
                          <span className="text-xs text-slate-500">
                            {new Date(comment.created_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                          {comment.content}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activityTab === 'history' && (
                <div className="space-y-4">
                  {activityLogs.map(log => (
                    <div key={log.id} className="flex items-start gap-3 text-sm">
                      <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <ICON_MAP.ClockIcon className="w-3 h-3 text-slate-500" />
                      </div>
                      <div>
                        <span className="font-medium text-slate-900 dark:text-white mr-1">
                          {log.user?.full_name || log.user?.email || 'Unknown'}
                        </span>
                        <span className="text-slate-600 dark:text-slate-400">
                          {log.action === 'status_changed' && `changed status from ${formatEnumForDisplay(log.details?.old_status)} to ${formatEnumForDisplay(log.details?.new_status)}`}
                          {log.action === 'comment_added' && 'added a comment'}
                          {log.action === 'attachment_added' && `attached ${log.details?.file_name}`}
                          {log.action === 'created' && 'created the task'}
                        </span>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {new Date(log.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                  {activityLogs.length === 0 && <p className="text-sm text-slate-500 italic">No history available.</p>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Sidebar Details */}
        <div className="w-full md:w-80 flex-shrink-0 flex flex-col gap-6">
          
          {/* Status & Actions */}
          <div className="flex items-center gap-2">
            <select
              value={taskToView.status}
              onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
              className={`flex-1 appearance-none px-3 py-2 rounded-md text-sm font-medium border focus:outline-none focus:ring-2 focus:ring-accent ${
                taskToView.status === TaskStatus.DONE ? 'bg-green-600 text-white border-green-700' :
                taskToView.status === TaskStatus.IN_PROGRESS ? 'bg-blue-600 text-white border-blue-700' :
                'bg-slate-200 text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-slate-600'
              }`}
            >
              {Object.values(TaskStatus).map(s => <option key={s} value={s}>{formatEnumForDisplay(s)}</option>)}
            </select>
            <button className={`px-3 py-2 rounded-md border ${darkMode ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-300 hover:bg-slate-50 text-slate-700'}`}>
              Actions <ICON_MAP.ChevronDownIcon className="w-4 h-4 inline ml-1" />
            </button>
          </div>

          {/* Pinned Fields */}
          <div className={`rounded-lg border ${darkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-white'}`}>
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Pinned fields</h3>
              <ICON_MAP.ChevronDownIcon className="w-4 h-4 text-slate-500" />
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center">
                <span className="w-1/3 text-sm text-slate-500">Priority</span>
                <div className="w-2/3 flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
                  <ICON_MAP.ExclamationIcon className={`w-4 h-4 ${
                    taskToView.priority === TaskPriority.CRITICAL ? 'text-red-500' :
                    taskToView.priority === TaskPriority.HIGH ? 'text-orange-500' :
                    taskToView.priority === TaskPriority.MEDIUM ? 'text-yellow-500' : 'text-blue-500'
                  }`} />
                  {formatEnumForDisplay(taskToView.priority)}
                </div>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className={`rounded-lg border ${darkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-white'}`}>
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Details</h3>
              <ICON_MAP.ChevronDownIcon className="w-4 h-4 text-slate-500" />
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center">
                <span className="w-1/3 text-sm text-slate-500">Assignee</span>
                <div className="w-2/3 flex items-center gap-2 text-sm text-slate-900 dark:text-white">
                  <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
                    {users.find(u => u.id === taskToView.assignee_id)?.avatar_url ? (
                      <img src={users.find(u => u.id === taskToView.assignee_id)?.avatar_url} alt="Assignee" className="w-full h-full object-cover" />
                    ) : (
                      <ICON_MAP.UserCircleIcon className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                  {users.find(u => u.id === taskToView.assignee_id)?.full_name || 'Unassigned'}
                </div>
              </div>
              
              <div className="flex items-center">
                <span className="w-1/3 text-sm text-slate-500">Reporter</span>
                <div className="w-2/3 flex items-center gap-2 text-sm text-slate-900 dark:text-white">
                  <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
                    {users.find(u => u.id === taskToView.creator_id)?.avatar_url ? (
                      <img src={users.find(u => u.id === taskToView.creator_id)?.avatar_url} alt="Reporter" className="w-full h-full object-cover" />
                    ) : (
                      <ICON_MAP.UserCircleIcon className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                  {users.find(u => u.id === taskToView.creator_id)?.full_name || 'Unknown'}
                </div>
              </div>

              <div className="flex items-center">
                <span className="w-1/3 text-sm text-slate-500">Due Date</span>
                <div className="w-2/3 text-sm text-slate-900 dark:text-white">
                  {taskToView.dueDate ? new Date(taskToView.dueDate).toLocaleDateString() : 'None'}
                </div>
              </div>

              <div className="flex items-start">
                <span className="w-1/3 text-sm text-slate-500 mt-1">Collaborators</span>
                <div className="w-2/3 flex flex-wrap gap-1">
                  {/* Main Assignee */}
                  {users.find(u => u.id === taskToView.assignee_id) && (
                    <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden border-2 border-accent" title={`Assignee: ${users.find(u => u.id === taskToView.assignee_id)?.full_name}`}>
                      {users.find(u => u.id === taskToView.assignee_id)?.avatar_url ? (
                        <img src={users.find(u => u.id === taskToView.assignee_id)?.avatar_url} alt="Assignee" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-medium">{users.find(u => u.id === taskToView.assignee_id)?.full_name?.charAt(0)}</span>
                      )}
                    </div>
                  )}
                  {/* Other Collaborators */}
                  {collaborators.map(collab => {
                    const user = users.find(u => u.id === collab.user_id);
                    if (!user || user.id === taskToView.assignee_id) return null;
                    return (
                      <div key={collab.user_id} className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-white dark:border-slate-800" title={`${collab.role}: ${user.full_name}`}>
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="Collaborator" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{user.full_name?.charAt(0) || '?'}</span>
                        )}
                      </div>
                    );
                  })}
                  <button 
                    onClick={() => setIsAddingCollaborator(!isAddingCollaborator)}
                    className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors" 
                    title="Add Collaborator"
                  >
                    <ICON_MAP.PlusIcon className="w-3 h-3" />
                  </button>
                </div>
              </div>
              
              {isAddingCollaborator && (
                <div className="flex items-center gap-2 mt-2">
                  <select
                    value={selectedCollaboratorId}
                    onChange={(e) => setSelectedCollaboratorId(e.target.value)}
                    className={`flex-1 p-1.5 rounded-md border text-sm focus:ring-2 focus:ring-accent focus:border-transparent ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="">Select user...</option>
                    {users.filter(u => u.id !== taskToView.assignee_id && !collaborators.some(c => c.user_id === u.id)).map(user => (
                      <option key={user.id} value={user.id}>{user.full_name || user.email}</option>
                    ))}
                  </select>
                  <Button onClick={handleAddCollaborator} disabled={!selectedCollaboratorId} size="sm">Add</Button>
                </div>
              )}
            </div>
          </div>

          {/* Metadata */}
          <div className="text-xs text-slate-500 space-y-1">
            <p>Created {taskToView.created_at ? new Date(taskToView.created_at).toLocaleString() : 'Unknown'}</p>
            <p>Updated {taskToView.updated_at ? new Date(taskToView.updated_at).toLocaleString() : 'Unknown'}</p>
          </div>

        </div>
      </div>
    </Modal>
  );
};
