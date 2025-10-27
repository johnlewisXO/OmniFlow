
import React, { useState, useEffect } from 'react';
// Fix: Corrected typo in useAppStore import path.
import { useAppStore } from '../../hooks/useAppStore';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { Project, UserRole } from '../../types';
import { ICON_MAP } from '../../constants'; // For potential spinner

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (projectData: Pick<Project, 'name' | 'description'>) => Promise<Project | void>;
  isLoading: boolean;
  error: string | null; 
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onCreateProject,
  isLoading,
  error: storeError, 
}) => {
  const { darkMode, currentUser } = useAppStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const SpinnerIcon = ICON_MAP.SpinnerIcon;

  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setLocalError(null); 
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null); 
    const projectData = { name: name.trim(), description: description.trim() };
    console.log('[CreateProjectModal] handleSubmit initiated. Data:', projectData);

    if (!projectData.name) {
      const msg = "Project name is required.";
      console.error('[CreateProjectModal] Validation Error:', msg);
      setLocalError(msg);
      return;
    }
    if (!currentUser) {
      const msg = "User not logged in. Cannot create project.";
      console.error('[CreateProjectModal] Auth Error:', msg);
      setLocalError(msg); 
      return;
    }

    try {
      console.log('[CreateProjectModal] Calling onCreateProject with:', projectData);
      await onCreateProject(projectData);
      console.log('[CreateProjectModal] onCreateProject call completed (further success/error handling in store action).');
    } catch (err: any) {
      const errorMessage = err.message || "An unexpected error occurred during project creation.";
      console.error("[CreateProjectModal] Error caught after calling onCreateProject:", errorMessage, err);
    }
  };
  
  const labelClass = `block text-sm font-medium mb-1.5`;
  // Inputs will inherit global styles

  let createButtonText = 'Create Project';
  let createButtonDisabled = isLoading;
  
  const canCreateOrgProjects = currentUser?.role === UserRole.OWNER || currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.PROJECT_MANAGER;

  if (isLoading) {
    createButtonText = 'Creating...';
  } else if (!currentUser) {
    createButtonText = 'Login to Create';
    createButtonDisabled = true;
  } else if (currentUser.organization_id) {
    if (!canCreateOrgProjects) {
        createButtonText = 'Permission Denied'; 
        createButtonDisabled = true;
    } else {
        createButtonText = 'Create Org Project';
    }
  } else {
    createButtonText = 'Create Personal Project';
  }

  const displayError = localError || storeError;
  const modalTitle = <span className="text-gradient-accent">Create New Project</span>;


  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle as unknown as string} size="md">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="project-name" className={labelClass}>Project Name</label>
          <input
            type="text"
            id="project-name"
            value={name}
            onChange={(e) => { setName(e.target.value); if(localError) setLocalError(null); }}
            required
            placeholder="Enter project name"
            disabled={isLoading}
            aria-describedby={displayError && name.trim() === '' ? "project-name-error" : undefined}
          />
        </div>
        <div>
          <label htmlFor="project-description" className={labelClass}>Description (Optional)</label>
          <textarea
            id="project-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a short description for your project"
            disabled={isLoading}
          />
        </div>

        {displayError && (
            <p id="project-name-error" className={`text-xs text-status-error text-center p-2.5 rounded-squircle-sm border border-status-error/30 bg-status-error/10`}>
                {displayError}
            </p>
        )}

        <div className="flex justify-end space-x-3 pt-3 border-t border-[var(--panel-border)]">
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={createButtonDisabled || !name.trim()}>
            {isLoading && <SpinnerIcon className="w-5 h-5 animate-spin mr-2" />}
            {createButtonText}
          </Button>
        </div>
      </form>
    </Modal>
  );
};