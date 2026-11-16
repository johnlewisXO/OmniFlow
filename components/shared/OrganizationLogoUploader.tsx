import React, { useRef, useState } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import supabaseService from '../../services/supabaseService';
import { UserRole, normalizeUserRole } from '../../types';
import { ICON_MAP } from '../../constants';
import { Button } from './Button';

const ALLOWED_LOGO_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/svg+xml',
]);

const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

/**
 * Subtle default Liquid Glass brand mark rendered whenever no custom
 * organization logo has been uploaded. Renders zero organization text.
 */
export const DefaultGlassBrandMark: React.FC<{ className?: string }> = ({
  className = 'w-5 h-5',
}) => (
  <svg
    viewBox="0 0 28 28"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="glass-mark-grad" x1="3" y1="2" x2="25" y2="26" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="currentColor" stopOpacity="0.95" />
        <stop offset="100%" stopColor="currentColor" stopOpacity="0.45" />
      </linearGradient>
    </defs>
    {/* Outer sculpted glass chamfered square */}
    <rect
      x="3"
      y="3"
      width="22"
      height="22"
      rx="6.5"
      stroke="url(#glass-mark-grad)"
      strokeWidth="1.7"
      fill="currentColor"
      fillOpacity="0.08"
    />
    {/* Interlocking translucent refraction layers */}
    <rect
      x="7.5"
      y="7.5"
      width="8.5"
      height="8.5"
      rx="2.8"
      fill="currentColor"
      fillOpacity="0.82"
    />
    <rect
      x="12"
      y="12"
      width="8.5"
      height="8.5"
      rx="2.8"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="currentColor"
      fillOpacity="0.18"
    />
  </svg>
);

export const OrganizationLogoUploader: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const {
    currentUser,
    currentOrganization,
    updateOrganizationSettings,
    isUpdatingOrgSettings,
    addToast,
  } = useAppStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const role = normalizeUserRole(currentUser?.role);
  const canManageLogo = role === UserRole.OWNER || role === UserRole.ADMIN;
  const activeLogoUrl = currentOrganization?.logoUrl || currentOrganization?.logo_url || '';

  if (!canManageLogo) {
    return null;
  }

  const persistLogo = async (nextUrl: string) => {
    await updateOrganizationSettings({
      orgDisplayName: currentOrganization?.name || 'Omni Flow Enterprise Workspace',
      corporateDomain:
        currentOrganization?.corporateDomain ||
        currentOrganization?.domain ||
        currentOrganization?.corporate_domain,
      defaultSprintDurationDays:
        currentOrganization?.defaultSprintDurationDays ||
        currentOrganization?.default_sprint_duration_days ||
        14,
      defaultTaskStatus: currentOrganization?.defaultTaskStatus,
      autoAssignCreator: currentOrganization?.autoAssignCreator ?? true,
      requireAcceptanceChecklist: currentOrganization?.requireAcceptanceChecklist ?? true,
      enablePublicInviteLinks: currentOrganization?.enablePublicInviteLinks ?? true,
      logoUrl: nextUrl,
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setErrorMsg(null);
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const isMimeAllowed = ALLOWED_LOGO_MIME_TYPES.has(file.type) || ['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext);

    if (!isMimeAllowed) {
      setErrorMsg('Unsupported format. Please upload PNG, JPG, WebP, or SVG.');
      return;
    }

    if (file.size > MAX_LOGO_SIZE_BYTES) {
      setErrorMsg('Logo image exceeds 2MB limit. Choose a lighter asset.');
      return;
    }

    const orgId = currentOrganization?.id || currentUser?.organization_id || 'org-enterprise-workspace';
    setIsUploading(true);
    try {
      const uploadedUrl = await supabaseService.uploadOrganizationLogo(orgId, file);
      await persistLogo(uploadedUrl);
      addToast(
        'Organization Logo Updated',
        'Workspace brand mark updated in the top bar and side navigation.',
        'success'
      );
    } catch (err: any) {
      const msg = err?.message || 'Failed to upload organization logo.';
      setErrorMsg(msg);
      addToast('Logo Upload Failed', msg, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleResetLogo = async () => {
    setErrorMsg(null);
    setIsUploading(true);
    try {
      await persistLogo('');
      addToast(
        'Brand Mark Reset',
        'Reverted to the default Liquid Glass workspace brand mark.',
        'info'
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not reset logo.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border border-[var(--glass-border)] bg-[var(--surface-nested-subtle)] backdrop-blur-md ${
        compact ? 'p-3.5' : 'p-4'
      } space-y-3`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className="w-14 h-14 rounded-2xl border border-[var(--glass-border-strong)] bg-[var(--surface-glass-2)] shadow-[inset_0_1px_0_var(--glass-highlight)] flex items-center justify-center overflow-hidden shrink-0 text-[var(--accent-text)]"
            aria-label={activeLogoUrl ? 'Uploaded organization logo preview' : 'Default glass brand mark preview'}
          >
            {activeLogoUrl ? (
              <img
                src={activeLogoUrl}
                alt="Organization logo"
                className="w-full h-full object-contain p-1.5"
              />
            ) : (
              <DefaultGlassBrandMark className="w-7 h-7" />
            )}
          </div>

          <div className="min-w-0">
            <div className="text-xs font-bold text-[var(--text-primary)]">
              Organization Logo &amp; Brand Mark
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">
              Displayed in the top header (when no project or task is open) and side menu. PNG, JPG, WebP, or SVG up to 2MB.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={handleFileChange}
            className="hidden"
            aria-label="Upload organization logo file"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            isLoading={isUploading || isUpdatingOrgSettings}
            onClick={() => fileInputRef.current?.click()}
          >
            <ICON_MAP.PaperClipIcon className="w-3.5 h-3.5 text-[var(--accent-text)]" />
            <span>{activeLogoUrl ? 'Replace Logo' : 'Upload Logo'}</span>
          </Button>

          {activeLogoUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isUploading || isUpdatingOrgSettings}
              onClick={handleResetLogo}
              className="text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {errorMsg && (
        <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400" role="alert">
          {errorMsg}
        </p>
      )}
    </div>
  );
};
