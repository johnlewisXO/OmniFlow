import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { Project, UserRole, normalizeUserRole } from '../../types';
import { ICON_MAP } from '../../constants';
import { PROJECT_TEMPLATES, ProjectTemplate } from '../../utils/projectTemplates';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (
    projectData: Pick<Project, 'name' | 'description'> & { templateId?: string }
  ) => Promise<Project | void>;
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
  const { currentUser, addToast } = useAppStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [localError, setLocalError] = useState<string | null>(null);
  const SpinnerIcon = ICON_MAP.SpinnerIcon;

  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setSelectedTemplateId('');
      setLocalError(null);
    }
  }, [isOpen]);

  const selectedTemplate: ProjectTemplate | undefined = PROJECT_TEMPLATES.find(
    t => t.id === selectedTemplateId
  );

  const handleSelectTemplate = (tplId: string) => {
    setSelectedTemplateId(tplId);
    if (!tplId) {
      return;
    }
    const tpl = PROJECT_TEMPLATES.find(t => t.id === tplId);
    if (tpl) {
      setName(tpl.name);
      setDescription(tpl.description);
      setLocalError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const projectData = {
      name: name.trim(),
      description: description.trim(),
      ...(selectedTemplateId ? { templateId: selectedTemplateId } : {}),
    };

    if (!projectData.name) {
      const msg = 'Project name is required.';
      setLocalError(msg);
      addToast('Validation Error', msg, 'error');
      return;
    }
    if (!currentUser) {
      const msg = 'User not logged in. Cannot create project.';
      setLocalError(msg);
      addToast('Authentication Required', msg, 'error');
      return;
    }

    try {
      await onCreateProject(projectData);
      addToast(
        selectedTemplate ? 'Project Created from Template' : 'Project Created',
        selectedTemplate
          ? `Created "${projectData.name}" with ${selectedTemplate.tasks.length} starter tasks.`
          : `Project "${projectData.name}" created successfully.`,
        'success'
      );
    } catch (err: any) {
      const errorMessage = err?.message || 'An unexpected error occurred during project creation.';
      setLocalError(errorMessage);
      addToast('Creation Failed', errorMessage, 'error');
    }
  };

  const normalizedRole = normalizeUserRole(currentUser?.role);
  const canCreateOrgProjects =
    normalizedRole === UserRole.OWNER ||
    normalizedRole === UserRole.ADMIN ||
    normalizedRole === UserRole.PROJECT_MANAGER;

  let createButtonText = selectedTemplate ? 'Create from Template' : 'Create Project';
  let createButtonDisabled = isLoading;

  if (isLoading) {
    createButtonText = selectedTemplate ? 'Provisioning...' : 'Creating...';
  } else if (!currentUser) {
    createButtonText = 'Login to Create';
    createButtonDisabled = true;
  } else if (currentUser.organization_id && !canCreateOrgProjects) {
    createButtonText = 'Permission Denied';
    createButtonDisabled = true;
  }

  const displayError = localError || storeError;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Project" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Optional Blueprint Template Selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-[var(--text-secondary)]">
              Starting Blueprint (Optional)
            </label>
            {selectedTemplate && (
              <button
                type="button"
                onClick={() => {
                  setSelectedTemplateId('');
                  setName('');
                  setDescription('');
                }}
                className="text-[11px] font-medium text-[var(--accent-text)] hover:underline cursor-pointer"
              >
                Switch to Blank
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleSelectTemplate('')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                selectedTemplateId === ''
                  ? 'border-[var(--accent)] bg-[var(--accent-subtle)] shadow-xs'
                  : 'border-[var(--border-hairline)] bg-[var(--surface-nested-subtle)] hover:border-[var(--border-strong)]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[var(--text-primary)]">Blank Project</span>
                <span className="text-[10px] font-mono text-[var(--text-muted)]">0 tasks</span>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 line-clamp-1">
                Clean board ready for custom sprints & tasks.
              </p>
            </button>

            {PROJECT_TEMPLATES.map(tpl => {
              const active = selectedTemplateId === tpl.id;
              const totalPts = tpl.tasks.reduce((sum, t) => sum + t.points, 0);
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handleSelectTemplate(tpl.id)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    active
                      ? 'border-[var(--accent)] bg-[var(--accent-subtle)] shadow-xs'
                      : 'border-[var(--border-hairline)] bg-[var(--surface-nested-subtle)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[var(--text-primary)] truncate">{tpl.name}</span>
                    <span className="text-[10px] font-mono text-[var(--accent-text)] shrink-0">
                      {tpl.tasks.length} tasks · {totalPts}p
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 line-clamp-1">
                    {tpl.category}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label htmlFor="project-name" className="block text-xs font-semibold mb-1.5 text-[var(--text-secondary)]">
            Project Name
          </label>
          <input
            type="text"
            id="project-name"
            className="w-full font-medium"
            value={name}
            onChange={e => {
              setName(e.target.value);
              if (localError) setLocalError(null);
            }}
            required
            placeholder="Enter project name"
            disabled={isLoading}
            aria-describedby={displayError && name.trim() === '' ? 'project-name-error' : undefined}
          />
        </div>

        <div>
          <label htmlFor="project-description" className="block text-xs font-semibold mb-1.5 text-[var(--text-secondary)]">
            Description (Optional)
          </label>
          <textarea
            id="project-description"
            className="w-full font-medium"
            rows={2}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Short objective or scope summary"
            disabled={isLoading}
          />
        </div>

        {selectedTemplate && (
          <div className="editorial-surface-subtle p-3 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--text-primary)]">
              <span>Included Starter Tasks ({selectedTemplate.tasks.length})</span>
              <span className="font-mono text-[var(--text-muted)]">
                ~{selectedTemplate.estimatedDays}d cadence
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {selectedTemplate.tasks.map((t, idx) => (
                <div key={idx} className="text-[11px] text-[var(--text-secondary)] truncate">
                  · {t.title} <span className="font-mono text-[var(--text-muted)]">({t.points}p)</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {displayError && (
          <p
            id="project-name-error"
            className="text-xs text-rose-600 dark:text-rose-400 text-center p-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10"
          >
            {displayError}
          </p>
        )}

        <div className="flex justify-end space-x-2.5 pt-3 border-t border-[var(--border-hairline)]">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={createButtonDisabled || !name.trim()}>
            {isLoading && <SpinnerIcon className="w-4 h-4 animate-spin" />}
            <span>{createButtonText}</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
};