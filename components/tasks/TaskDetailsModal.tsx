import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../hooks/useAppStore';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { TaskPriority, TaskStatus, User, Task, TaskComment, TaskAttachment, TaskActivityLog, TaskCollaborator } from '../../types';
import { ICON_MAP } from '../../constants';
import supabaseService, { supabase } from '../../services/supabaseService';
import geminiService from '../../services/geminiService';

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
    deleteTask,
    users,
    currentUser,
    darkMode,
    activeProject,
    openEditTaskModal,
    tasks,
    error,
    openModal,
    openViewTaskModal
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'general' | 'qa' | 'admin'>('general');
  const [activityTab, setActivityTab] = useState<'comments' | 'history' | 'worklog'>('comments');
  
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [activityLogs, setActivityLogs] = useState<TaskActivityLog[]>([]);
  const [collaborators, setCollaborators] = useState<TaskCollaborator[]>([]);
  const [isAddingCollaborator, setIsAddingCollaborator] = useState(false);
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState('');
  
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState('');
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
  const [subtaskToDelete, setSubtaskToDelete] = useState<string | null>(null);
  const [selectedAttachment, setSelectedAttachment] = useState<TaskAttachment | null>(null);
  
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');

  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingAISubtasks, setIsGeneratingAISubtasks] = useState(false);

  const handleGenerateAISubtasks = async () => {
    if (!taskToView || !currentUser || isGeneratingAISubtasks) return;
    setIsGeneratingAISubtasks(true);
    try {
      const generated = await geminiService.generateSubtaskBreakdown(taskToView.title, taskToView.description);
      
      for (const item of generated) {
        await supabaseService.createTask({
          title: item.title,
          description: `AI-generated subtask for "${taskToView.title}"`,
          status: TaskStatus.TODO,
          priority: item.priority,
          projectId: taskToView.projectId,
          parent_task_id: taskToView.id,
          organization_id: taskToView.organization_id || currentUser.organization_id
        });
      }

      // Log audit event
      if (currentUser.organization_id) {
        await supabaseService.logAuditEvent({
          organization_id: currentUser.organization_id,
          actor_id: currentUser.id,
          actor_name: currentUser.full_name || currentUser.email,
          actor_email: currentUser.email,
          action: 'ai_subtask_generated',
          target_type: 'task',
          target_id: taskToView.id,
          target_name: taskToView.title,
          details: { subtasks_count: generated.length }
        });
      }

      // Refresh task view by calling fetchAllTasksForAllProjects if needed
      useAppStore.getState().fetchAllTasksForAllProjects();
    } catch (err: any) {
      console.error('Failed generating AI subtasks:', err);
      alert(err.message || 'Failed to generate AI subtasks.');
    } finally {
      setIsGeneratingAISubtasks(false);
    }
  };

  const [isActionsOpen, setIsActionsOpen] = useState(false);

  const [mentionState, setMentionState] = useState<{
    isOpen: boolean;
    search: string;
    startIndex: number;
    cursorIndex: number;
    selectedIndex: number;
  }>({
    isOpen: false,
    search: '',
    startIndex: -1,
    cursorIndex: -1,
    selectedIndex: 0,
  });

  const filteredMentionUsers = users.filter(u => 
    (u.full_name?.toLowerCase().includes(mentionState.search.toLowerCase()) || 
     u.email?.toLowerCase().includes(mentionState.search.toLowerCase()))
  );

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPosition = e.target.selectionStart;
    setNewComment(value);

    // Check if we are in a mention
    const textBeforeCursor = value.slice(0, cursorPosition);
    const match = textBeforeCursor.match(/@([a-zA-Z0-9_ ]*)$/);

    if (match) {
      setMentionState(prev => ({
        ...prev,
        isOpen: true,
        search: match[1],
        startIndex: match.index!,
        cursorIndex: cursorPosition,
      }));
    } else {
      setMentionState(prev => ({ ...prev, isOpen: false }));
    }
  };

  const commentTextareaRef = React.useRef<HTMLTextAreaElement>(null);

  const insertMention = (user: User) => {
    const beforeMention = newComment.slice(0, mentionState.startIndex);
    const afterMention = newComment.slice(mentionState.cursorIndex);
    const mentionText = `@${user.full_name || user.email} `;
    
    const newText = beforeMention + mentionText + afterMention;
    setNewComment(newText);
    setMentionState(prev => ({ ...prev, isOpen: false }));
    
    // Focus and set cursor position
    setTimeout(() => {
      if (commentTextareaRef.current) {
        commentTextareaRef.current.focus();
        const newCursorPos = mentionState.startIndex + mentionText.length;
        commentTextareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const renderCommentContent = (content: string) => {
    let elements: (string | React.ReactNode)[] = [content];
    
    // Sort users by name length descending to match longer names first (e.g. "John Doe" before "John")
    const sortedUsers = [...users].sort((a, b) => {
      const aName = a.full_name || a.email || '';
      const bName = b.full_name || b.email || '';
      return bName.length - aName.length;
    });

    sortedUsers.forEach(user => {
      const name = user.full_name || user.email;
      if (!name) return;
      
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(@${escapedName})(?![a-zA-Z0-9_])`, 'gi');
      
      elements = elements.flatMap((el, index) => {
        if (typeof el === 'string') {
          const parts = el.split(regex);
          if (parts.length === 1) return [el];
          
          const newElements: (string | React.ReactNode)[] = [];
          parts.forEach((part, i) => {
            if (part.toLowerCase() === `@${name.toLowerCase()}`) {
              newElements.push(<span key={`${user.id}-${index}-${i}`} className="text-accent font-medium bg-accent/10 px-1 rounded">{part}</span>);
            } else if (part) {
              newElements.push(part);
            }
          });
          return newElements;
        }
        return [el];
      });
    });
    
    return elements;
  };

  const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionState.isOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionState(prev => ({
          ...prev,
          selectedIndex: Math.min(prev.selectedIndex + 1, filteredMentionUsers.length - 1)
        }));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionState(prev => ({
          ...prev,
          selectedIndex: Math.max(prev.selectedIndex - 1, 0)
        }));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredMentionUsers[mentionState.selectedIndex]) {
          insertMention(filteredMentionUsers[mentionState.selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        setMentionState(prev => ({ ...prev, isOpen: false }));
      }
    }
  };

  const handleDeleteTask = async () => {
    if (!taskToView || !window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await useAppStore.getState().deleteTask(taskToView.id);
      closeViewTaskModal();
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  const subtasks = tasks.filter(t => t.parent_task_id === taskToView?.id).sort((a, b) => a.position - b.position);

  const SpinnerIcon = ICON_MAP.SpinnerIcon;

  useEffect(() => {
    if (isViewTaskModalOpen && taskToView) {
      fetchTaskDetails();
      setEditedTitle(taskToView.title);
      setEditedDescription(taskToView.description || '');
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
      
      if (attachmentsData) {
        const attachmentsWithSignedUrls = await Promise.all(attachmentsData.map(async (att: any) => {
          let signedUrl = '';
          try {
            const filePath = att.file_path;
            
            // Generate a signed URL valid for 1 hour
            const { data, error } = await supabase.storage
              .from('task-attachments')
              .createSignedUrl(filePath, 3600);
              
            if (error || !data?.signedUrl) {
              console.warn("Could not generate signed URL, falling back to public URL:", error);
              const { data: publicData } = supabase.storage.from('task-attachments').getPublicUrl(filePath);
              signedUrl = publicData.publicUrl;
            } else {
              signedUrl = data.signedUrl;
            }
          } catch (e) {
            console.error("Error generating signed URL for attachment:", e);
          }
          return { ...att, signedUrl };
        }));
        setAttachments(attachmentsWithSignedUrls as any);
      }

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
        
        // Find mentioned users
        const mentionedUsers = users.filter(u => {
            const name = u.full_name || u.email;
            if (!name) return false;
            // Escape special characters in name for regex
            const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`@${escapedName}(?![a-zA-Z0-9_])`, 'i');
            return regex.test(newComment);
        });

        // Send notifications to mentioned users
        for (const u of mentionedUsers) {
            if (u.id !== currentUser.id) {
                try {
                    await supabaseService.insertNotification({
                        id: crypto.randomUUID(),
                        user_id: u.id,
                        actor_id: currentUser.id,
                        sender_id: currentUser.id,
                        type: 'MENTION',
                        content: `${currentUser.full_name || currentUser.email} mentioned you in a comment on task "${taskToView.title}"`,
                        reference_id: taskToView.id,
                        is_read: false,
                        entity_type: 'task',
                        entity_id: taskToView.id,
                        title: 'You were mentioned in a comment',
                        message: `${currentUser.full_name || currentUser.email} mentioned you in a comment on task "${taskToView.title}"`,
                        read: false,
                        created_at: new Date().toISOString()
                    });
                    console.log("Successfully inserted mention notification for user", u.id);
                } catch (notifError) {
                    console.error("Failed to insert mention notification for user", u.id, notifError);
                }
            }
        }

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

  const handleSaveEditComment = async (commentId: string) => {
    if (!editCommentContent.trim()) return;
    try {
      const { error } = await supabase
        .from('task_comments')
        .update({ content: editCommentContent.trim() })
        .eq('id', commentId);
      if (error) throw error;
      
      setComments(comments.map(c => c.id === commentId ? { ...c, content: editCommentContent.trim() } : c));
      setEditingCommentId(null);
    } catch (error) {
      console.error("Error editing comment:", error);
    }
  };

  const handleDeleteComment = async () => {
    if (!commentToDelete) return;
    try {
      const { error } = await supabase
        .from('task_comments')
        .delete()
        .eq('id', commentToDelete);
      if (error) throw error;
      
      setComments(comments.filter(c => c.id !== commentToDelete));
      setCommentToDelete(null);
    } catch (error) {
      console.error("Error deleting comment:", error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !taskToView || !currentUser) return;

    // Check file size (e.g., max 25MB)
    if (file.size > 25 * 1024 * 1024) {
      alert("File size exceeds 25MB limit.");
      event.target.value = '';
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `${taskToView.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('task-attachments')
        .createSignedUrl(filePath, 3600);
        
      let signedUrl = signedUrlData?.signedUrl;
      if (signedUrlError || !signedUrl) {
        console.warn("Could not generate signed URL on upload, falling back to public URL:", signedUrlError);
        const { data: publicData } = supabase.storage.from('task-attachments').getPublicUrl(filePath);
        signedUrl = publicData.publicUrl;
      }

      const { data, error: dbError } = await supabase
        .from('task_attachments')
        .insert({
          task_id: taskToView.id,
          user_id: currentUser.id,
          file_name: file.name,
          file_path: filePath, // Store the path in DB
          file_type: file.type || 'application/octet-stream',
          file_size: file.size || 0
        })
        .select('*, user:user_profiles(*)')
        .single();

      if (dbError) throw dbError;
      if (data) {
        // Use the signed URL for the local state so it renders immediately
        const newAttachment = { ...data, signedUrl };
        setAttachments([newAttachment as any, ...attachments]);
        
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
      alert("Failed to upload file. Please try again.");
    } finally {
      setIsUploading(false);
      // Reset input value so the same file can be uploaded again if needed
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleUpdateTask = async (updates: Partial<Task>) => {
    if (!taskToView) return;
    try {
      await updateTask(taskToView.id, updates);
      // Update local state to reflect change immediately
      Object.assign(taskToView, updates);
      
      // Log activity
      if (currentUser) {
        await supabase.from('task_activity_logs').insert({
          task_id: taskToView.id,
          user_id: currentUser.id,
          action: 'task_updated',
          details: { updates }
        });
      }
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const handleTitleSave = () => {
    if (editedTitle.trim() && editedTitle !== taskToView?.title) {
      handleUpdateTask({ title: editedTitle.trim() });
    } else {
      setEditedTitle(taskToView?.title || '');
    }
    setIsEditingTitle(false);
  };

  const handleDescriptionSave = () => {
    if (editedDescription !== taskToView?.description) {
      handleUpdateTask({ description: editedDescription });
    }
    setIsEditingDescription(false);
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

  const parentTask = taskToView.parent_task_id ? tasks.find(t => t.id === taskToView.parent_task_id) : null;

  const modalTitle = (
    <div className="flex items-center text-sm text-slate-500 dark:text-slate-400 font-normal">
      {parentTask && (
        <button 
          onClick={() => openViewTaskModal(parentTask.id)}
          className="mr-3 p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          title="Back to parent task"
        >
          <ICON_MAP.ArrowLeftIcon className="w-4 h-4" />
        </button>
      )}
      <span>Projects</span>
      <span className="mx-2">/</span>
      <span>{activeProject?.name || 'Project'}</span>
      <span className="mx-2">/</span>
      {parentTask && (
        <>
          <span 
            className="cursor-pointer hover:underline hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            onClick={() => openViewTaskModal(parentTask.id)}
          >
            {parentTask.title}
          </span>
          <span className="mx-2">/</span>
        </>
      )}
      <span className="text-slate-800 dark:text-slate-200 font-medium">{taskToView.title}</span>
    </div>
  );

  return (
    <Modal isOpen={isViewTaskModalOpen} onClose={closeViewTaskModal} title={modalTitle as any} size="full">
      {error && (
        <div className={`p-4 mb-4 rounded-md text-sm text-center border ${darkMode ? 'bg-status-error/20 text-red-300 border-status-error/40' : 'bg-status-error/10 text-red-700 border-status-error/30'}`}>
            <strong>Error:</strong> {error}
        </div>
      )}
      <div className="flex flex-col md:flex-row md:h-full gap-6 min-w-0 min-h-0">
        
        {/* Left Column: Main Content */}
        <div className="w-full md:flex-1 flex flex-col min-w-0 md:overflow-y-auto pr-0 md:pr-2">
          
          <div className="flex items-center justify-between mb-6">
            {isEditingTitle ? (
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
                autoFocus
                className={`text-2xl font-semibold w-full bg-transparent border-b-2 border-accent focus:outline-none ${darkMode ? 'text-white' : 'text-slate-900'}`}
              />
            ) : (
              <h1 
                className="text-2xl font-semibold text-slate-900 dark:text-white cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded px-2 -ml-2 py-1 transition-colors"
                onClick={() => setIsEditingTitle(true)}
              >
                {taskToView.title}
              </h1>
            )}
          </div>

          <div className="flex items-center gap-2 mb-6">
            <label className="cursor-pointer relative group">
              <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} accept="image/jpeg,image/png,image/gif,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border ${darkMode ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-300 hover:bg-slate-50 text-slate-700'} transition-colors ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {isUploading ? <SpinnerIcon className="w-4 h-4 animate-spin" /> : <ICON_MAP.PaperClipIcon className="w-4 h-4" />}
                Attach
              </div>
              <div className="absolute top-full left-0 mt-2 w-64 p-2 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none">
                Supported formats: Images (JPEG, PNG, GIF), PDFs, Documents (DOCX, TXT). Max size: 10MB.
              </div>
            </label>
            <button 
              onClick={() => {
                openModal(taskToView.id);
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
            {[
              { id: 'general', label: 'General' },
              { id: 'qa', label: 'QA/Testing' },
              { id: 'admin', label: 'Admin' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-accent text-accent'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="space-y-8">
            {activeTab === 'general' && (
              <>
            {/* Description */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Description</h3>
              {isEditingDescription ? (
                <div className="space-y-2">
                  <textarea
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    className={`w-full p-3 rounded-lg border text-sm focus:ring-2 focus:ring-accent focus:border-transparent min-h-[100px] ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                    placeholder="Add a more detailed description..."
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleDescriptionSave} size="sm">Save</Button>
                    <Button variant="secondary" onClick={() => {
                      setEditedDescription(taskToView.description || '');
                      setIsEditingDescription(false);
                    }} size="sm">Cancel</Button>
                  </div>
                </div>
              ) : (
                <div 
                  className={`text-sm whitespace-pre-wrap cursor-pointer p-3 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-colors ${
                    taskToView.description ? 'text-slate-700 dark:text-slate-300' : 'text-slate-500 italic'
                  }`}
                  onClick={() => setIsEditingDescription(true)}
                >
                  {taskToView.description || 'Add a more detailed description...'}
                </div>
              )}
            </div>

            {/* Subtasks */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Subtasks</h3>
                  <button
                    onClick={handleGenerateAISubtasks}
                    disabled={isGeneratingAISubtasks}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border transition-all ${
                      darkMode ? 'bg-purple-950/50 border-purple-800 text-purple-300 hover:bg-purple-900/60' : 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100'
                    } ${isGeneratingAISubtasks ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title="Generate AI Subtask Breakdown with Gemini"
                  >
                    {isGeneratingAISubtasks ? (
                      <ICON_MAP.SpinnerIcon className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ICON_MAP.SparklesIcon className="w-3.5 h-3.5 text-purple-500" />
                    )}
                    {isGeneratingAISubtasks ? 'Thinking...' : 'AI Break Down'}
                  </button>
                </div>
                <button 
                  onClick={() => {
                    openModal(taskToView.id);
                  }}
                  className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  title="Create subtask"
                >
                  <ICON_MAP.PlusIcon className="w-4 h-4" />
                </button>
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
                    <div 
                      key={subtask.id} 
                      className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => openViewTaskModal(subtask.id)}>
                        <ICON_MAP.CheckCircleIcon className="w-4 h-4 text-accent" />
                        <span className="text-sm text-slate-700 dark:text-slate-300">{subtask.title}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <select
                          value={subtask.assignee_id || ''}
                          onChange={(e) => updateTask(subtask.id, { assignee_id: e.target.value || undefined })}
                          className={`appearance-none px-2 py-1 rounded-md text-xs border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-accent focus:ring-1 focus:ring-accent bg-transparent cursor-pointer ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}
                        >
                          <option value="">Unassigned</option>
                          {users.map(u => (
                            <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                          ))}
                        </select>
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          subtask.status === TaskStatus.DONE ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          subtask.status === TaskStatus.IN_PROGRESS ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                        }`}>
                          {formatEnumForDisplay(subtask.status)}
                        </span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSubtaskToDelete(subtask.id);
                          }}
                          className="p-1 text-slate-400 hover:text-red-500 transition-colors rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"
                          title="Delete Subtask"
                        >
                          <ICON_MAP.TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 italic">No subtasks yet.</p>
              )}
            </div>

            {/* Attachments */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Attachments ({attachments.length})</h3>
                <label className="cursor-pointer text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1" title="Upload attachment">
                  <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} accept="image/*,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,application/zip,application/x-rar-compressed,video/mp4,video/quicktime,video/webm" />
                  {isUploading ? <SpinnerIcon className="w-4 h-4 animate-spin" /> : <ICON_MAP.PlusIcon className="w-4 h-4" />}
                </label>
              </div>
              {attachments.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {attachments.map(att => (
                    <div key={att.id} className="relative group rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 aspect-video bg-slate-100 dark:bg-slate-800">
                      {att.file_type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(att.file_name) ? (
                        <img src={att.signedUrl} alt={att.file_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-2">
                          <ICON_MAP.DocumentTextIcon className="w-8 h-8 text-slate-400 mb-2" />
                          <span className="text-xs text-center truncate w-full px-2">{att.file_name}</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button onClick={() => setSelectedAttachment(att)} className="p-1.5 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-sm" title="View">
                          <ICON_MAP.EyeIcon className="w-4 h-4" />
                        </button>
                        <a href={att.signedUrl} download={att.file_name} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-sm" title="Download">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                          </svg>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <ICON_MAP.PaperClipIcon className="w-8 h-8 text-slate-400 mb-2" />
                  <p className="text-sm text-slate-500 mb-1">No attachments yet</p>
                  <label className="cursor-pointer text-sm text-accent hover:underline">
                    <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} accept="image/*,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,application/zip,application/x-rar-compressed,video/mp4,video/quicktime,video/webm" />
                    Click to upload
                  </label>
                </div>
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
                    <div className="flex-1 relative">
                      <textarea
                        ref={commentTextareaRef}
                        value={newComment}
                        onChange={handleCommentChange}
                        onKeyDown={handleCommentKeyDown}
                        placeholder="Add a comment... (Type @ to mention)"
                        className={`w-full p-3 rounded-lg border text-sm focus:ring-2 focus:ring-accent focus:border-transparent resize-none ${
                          darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                        }`}
                        rows={3}
                      />
                      {mentionState.isOpen && filteredMentionUsers.length > 0 && (
                        <div className={`absolute z-10 w-64 max-h-48 overflow-y-auto rounded-md shadow-lg border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} bottom-full mb-1 left-0`}>
                          {filteredMentionUsers.map((user, index) => (
                            <button
                              key={user.id}
                              onClick={() => insertMention(user)}
                              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                                index === mentionState.selectedIndex
                                  ? (darkMode ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-900')
                                  : (darkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-100')
                              }`}
                            >
                              <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                {user.avatar_url ? (
                                  <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-accent font-medium text-xs">{user.full_name?.charAt(0) || user.email?.charAt(0)}</span>
                                )}
                              </div>
                              <span className="truncate">{user.full_name || user.email}</span>
                            </button>
                          ))}
                        </div>
                      )}
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
                    <div key={comment.id} className="flex gap-3 group">
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
                          {currentUser?.id === comment.user_id && editingCommentId !== comment.id && (
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 ml-2">
                              <button 
                                onClick={() => {
                                  setEditingCommentId(comment.id);
                                  setEditCommentContent(comment.content);
                                }}
                                className="text-xs text-slate-500 hover:text-accent"
                              >
                                Edit
                              </button>
                              <button 
                                onClick={() => setCommentToDelete(comment.id)}
                                className="text-xs text-slate-500 hover:text-red-500"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                        {editingCommentId === comment.id ? (
                          <div className="mt-2">
                            <textarea
                              value={editCommentContent}
                              onChange={(e) => setEditCommentContent(e.target.value)}
                              className={`w-full p-3 rounded-lg border text-sm focus:ring-2 focus:ring-accent focus:border-transparent resize-none ${
                                darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                              }`}
                              rows={3}
                            />
                            <div className="flex justify-end gap-2 mt-2">
                              <Button variant="outline" size="sm" onClick={() => setEditingCommentId(null)}>Cancel</Button>
                              <Button size="sm" onClick={() => handleSaveEditComment(comment.id)} disabled={!editCommentContent.trim()}>Save</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                            {renderCommentContent(comment.content)}
                          </div>
                        )}
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
            </>
            )}

            {activeTab === 'qa' && (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Test Cases</h3>
                    <button className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                      <ICON_MAP.PlusIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 text-center">
                    <p className="text-sm text-slate-500 italic">No test cases linked to this task.</p>
                    <Button variant="secondary" size="sm" className="mt-2">Create Test Case</Button>
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Linked Bugs</h3>
                    <button className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                      <ICON_MAP.PlusIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 text-center">
                    <p className="text-sm text-slate-500 italic">No bugs linked to this task.</p>
                    <Button variant="secondary" size="sm" className="mt-2">Report Bug</Button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'admin' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Task Administration</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">Change Issue Type</p>
                        <p className="text-xs text-slate-500">Convert this task to a bug, epic, or story.</p>
                      </div>
                      <Button variant="secondary" size="sm">Change</Button>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">Move to Project</p>
                        <p className="text-xs text-slate-500">Transfer this task to another project.</p>
                      </div>
                      <Button variant="secondary" size="sm">Move</Button>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10">
                      <div>
                        <p className="text-sm font-medium text-red-700 dark:text-red-400">Delete Task</p>
                        <p className="text-xs text-red-600 dark:text-red-300">Permanently remove this task and all its data.</p>
                      </div>
                      <Button variant="danger" size="sm" onClick={handleDeleteTask}>Delete</Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Sidebar Details */}
        <div className="w-full md:w-80 flex-shrink-0 flex flex-col gap-6 md:overflow-y-auto">
          
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
            <div className="relative">
              <button 
                onClick={() => setIsActionsOpen(!isActionsOpen)}
                className={`px-3 py-2 rounded-md border ${darkMode ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-300 hover:bg-slate-50 text-slate-700'}`}
              >
                Actions <ICON_MAP.ChevronDownIcon className="w-4 h-4 inline ml-1" />
              </button>
              {isActionsOpen && (
                <div className={`absolute right-0 mt-1 w-48 rounded-md shadow-lg z-50 border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                  <div className="py-1">
                    <button onClick={() => { handleUpdateTask({ assignee_id: currentUser?.id }); setIsActionsOpen(false); }} className={`block w-full text-left px-4 py-2 text-sm ${darkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-100'}`}>Assign to me</button>
                    <button onClick={() => { 
                      navigator.clipboard.writeText(window.location.href); 
                      alert('Link copied to clipboard');
                      setIsActionsOpen(false); 
                    }} className={`block w-full text-left px-4 py-2 text-sm ${darkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-100'}`}>Copy link</button>
                    <div className={`my-1 border-t ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}></div>
                    <button onClick={() => { handleDeleteTask(); setIsActionsOpen(false); }} className={`block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20`}>Delete</button>
                  </div>
                </div>
              )}
            </div>
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
                <div className="w-2/3">
                  <select
                    value={taskToView.priority}
                    onChange={(e) => handleUpdateTask({ priority: e.target.value as TaskPriority })}
                    className={`w-full appearance-none px-2 py-1 rounded-md text-sm font-medium border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-accent focus:ring-1 focus:ring-accent bg-transparent cursor-pointer ${darkMode ? 'text-white' : 'text-slate-900'}`}
                  >
                    {Object.values(TaskPriority).map(p => (
                      <option key={p} value={p}>{formatEnumForDisplay(p)}</option>
                    ))}
                  </select>
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
                <div className="w-2/3">
                  <select
                    value={taskToView.assignee_id || ''}
                    onChange={(e) => handleUpdateTask({ assignee_id: e.target.value || undefined })}
                    className={`w-full appearance-none px-2 py-1 rounded-md text-sm border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-accent focus:ring-1 focus:ring-accent bg-transparent cursor-pointer ${darkMode ? 'text-white' : 'text-slate-900'}`}
                  >
                    <option value="">Unassigned</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                    ))}
                  </select>
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
                <div className="w-2/3">
                  <input
                    type="date"
                    value={taskToView.dueDate ? new Date(taskToView.dueDate).toISOString().split('T')[0] : ''}
                    onChange={(e) => handleUpdateTask({ dueDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                    className={`w-full px-2 py-1 rounded-md text-sm border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-accent focus:ring-1 focus:ring-accent bg-transparent cursor-pointer ${darkMode ? 'text-white' : 'text-slate-900'}`}
                  />
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

      {/* Attachment Viewer Overlay */}
      {selectedAttachment && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setSelectedAttachment(null)}>
          <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 right-0 p-4 flex gap-4 z-10">
              <a 
                href={selectedAttachment.signedUrl} 
                download={selectedAttachment.file_name}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                title="Download"
              >
                <ICON_MAP.DocumentTextIcon className="w-6 h-6" />
              </a>
              <button 
                onClick={() => setSelectedAttachment(null)}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                title="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="w-full h-full flex items-center justify-center overflow-hidden rounded-lg">
              {selectedAttachment.file_type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(selectedAttachment.file_name) ? (
                <img src={selectedAttachment.signedUrl} alt={selectedAttachment.file_name} className="max-w-full max-h-[80vh] object-contain" />
              ) : selectedAttachment.file_type === 'application/pdf' || /\.pdf$/i.test(selectedAttachment.file_name) ? (
                <iframe src={selectedAttachment.signedUrl} className="w-full h-[80vh] bg-white rounded-lg" title={selectedAttachment.file_name} />
              ) : (
                <div className="bg-white dark:bg-slate-800 p-8 rounded-xl flex flex-col items-center max-w-md text-center">
                  <ICON_MAP.DocumentTextIcon className="w-16 h-16 text-slate-400 mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2 break-all">{selectedAttachment.file_name}</h3>
                  <p className="text-sm text-slate-500 mb-6">Preview not available for this file type.</p>
                  <a 
                    href={selectedAttachment.signedUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-dark transition-colors"
                  >
                    Download File
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {commentToDelete && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={() => setCommentToDelete(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Delete Comment</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">Are you sure you want to delete this comment? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setCommentToDelete(null)}>Cancel</Button>
              <Button variant="danger" onClick={handleDeleteComment}>Delete</Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {subtaskToDelete && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={() => setSubtaskToDelete(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Delete Subtask</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">Are you sure you want to delete this subtask? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setSubtaskToDelete(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => {
                deleteTask(subtaskToDelete);
                setSubtaskToDelete(null);
              }}>Delete</Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </Modal>
  );
};
