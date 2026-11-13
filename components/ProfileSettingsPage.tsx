import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../hooks/useAppStore';
import supabaseService, { saveUserProfileExtension, getUserProfileExtensions, normalizeAppUser } from '../services/supabaseService';
import { collabService } from '../services/collabService';
import { ICON_MAP } from '../constants';
import { ActiveView, normalizeUserRole, UserProfilePreferences, WORKSPACE_ACCENT_PRESETS, WorkspaceAccentId } from '../types';
import { StatusDynamicIcon } from './layout/ProfileMiniMenu';
import { HairlineCard, StatusDot } from './shared/EditorialUI';
import { SlimProgressBar } from './charts/EditorialCharts';
import { Button } from './shared/Button';

type SettingsTabId = 'identity' | 'capacity' | 'notifications' | 'ai_copilot' | 'security';

const TIMEZONES = [
  'UTC (Coordinated Universal Time)',
  'America/Los_Angeles (PT - Pacific Time)',
  'America/Denver (MT - Mountain Time)',
  'America/Chicago (CT - Central Time)',
  'America/New_York (ET - Eastern Time)',
  'Europe/London (GMT/BST)',
  'Europe/Berlin (CET/CEST)',
  'Asia/Dubai (GST)',
  'Asia/Singapore (SGT)',
  'Asia/Tokyo (JST)',
  'Australia/Sydney (AEST)',
];

const DEPARTMENTS = [
  'Engineering',
  'Product & Design',
  'Architecture & Platform',
  'Data & AI',
  'Quality Assurance',
  'Operations & PMO',
  'Executive Leadership',
  'Customer Success',
];

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const ProfileSettingsPage: React.FC = () => {
  const {
    currentUser,
    currentOrganization,
    openOrganizationModal,
    darkMode,
    toggleDarkMode,
    accentColor,
    setAccentColor,
    setCurrentUser,
    addToast,
    tasks,
    myTasks,
    projects,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<SettingsTabId>('identity');

  // Basic Identity State
  const [fullName, setFullName] = useState(currentUser?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatar_url || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Live Status
  const [myStatus, setMyStatus] = useState<'available' | 'away' | 'busy'>(() => {
    if (typeof window !== 'undefined' && currentUser?.id) {
      try {
        const raw = localStorage.getItem('omni_team_statuses');
        const map = raw ? JSON.parse(raw) : {};
        if (map[currentUser.id]) return map[currentUser.id];
      } catch (e) {}
    }
    return 'available';
  });

  // Extended Profile Preferences State
  const [prefs, setPrefs] = useState<UserProfilePreferences>(() => {
    const ext = currentUser?.id ? getUserProfileExtensions(currentUser.id) : {};
    const existingPrefs: UserProfilePreferences = ext.preferences || currentUser?.preferences || {};
    return {
      jobTitle: existingPrefs.jobTitle || currentUser?.job_title || 'Senior Product Engineer',
      department: existingPrefs.department || currentUser?.department || 'Engineering',
      phone: existingPrefs.phone || '',
      location: existingPrefs.location || 'San Francisco, CA',
      timezone: existingPrefs.timezone || 'America/Los_Angeles (PT - Pacific Time)',
      bio: existingPrefs.bio || 'Building resilient distributed systems and collaborative workflows.',
      skills: existingPrefs.skills || ['TypeScript', 'React', 'System Architecture', 'Agile Delivery'],
      githubUrl: existingPrefs.githubUrl || '',
      linkedinUrl: existingPrefs.linkedinUrl || '',
      weeklyCapacityHours: existingPrefs.weeklyCapacityHours ?? currentUser?.weekly_capacity_hours ?? 40,
      maxStoryPointsPerSprint: existingPrefs.maxStoryPointsPerSprint ?? 21,
      workingHoursStart: existingPrefs.workingHoursStart || '09:00',
      workingHoursEnd: existingPrefs.workingHoursEnd || '17:30',
      workingDays: existingPrefs.workingDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      defaultLandingView: existingPrefs.defaultLandingView || 'overview',
      compactDensity: existingPrefs.compactDensity ?? false,
      emailDigestFrequency: existingPrefs.emailDigestFrequency || 'daily',
      notifyOnTaskAssigned: existingPrefs.notifyOnTaskAssigned ?? true,
      notifyOnMentions: existingPrefs.notifyOnMentions ?? true,
      notifyOnSprintEvents: existingPrefs.notifyOnSprintEvents ?? true,
      notifyOnDirectMessages: existingPrefs.notifyOnDirectMessages ?? true,
      soundAlertsEnabled: existingPrefs.soundAlertsEnabled ?? true,
      aiAutoEstimateEffort: existingPrefs.aiAutoEstimateEffort ?? true,
      aiProactiveRiskAlerts: existingPrefs.aiProactiveRiskAlerts ?? true,
      aiWritingTone: existingPrefs.aiWritingTone || 'executive',
      twoFactorEnabled: existingPrefs.twoFactorEnabled ?? false,
      sessionTimeoutMinutes: existingPrefs.sessionTimeoutMinutes ?? 120,
    };
  });

  const [newSkillInput, setNewSkillInput] = useState('');

  // Security / Password update states
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isSendingResetEmail, setIsSendingResetEmail] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Personal API Token generator for CLI/Webhooks
  const [personalApiToken, setPersonalApiToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined' && currentUser?.id) {
      return localStorage.getItem(`omni_pat_${currentUser.id}`);
    }
    return null;
  });

  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.full_name || '');
      setAvatarUrl(currentUser.avatar_url || '');
      const ext = getUserProfileExtensions(currentUser.id);
      if (ext.preferences) {
        setPrefs(prev => ({ ...prev, ...ext.preferences }));
      }
    }
  }, [currentUser?.id]);

  const handleStatusChange = (newStatus: 'available' | 'away' | 'busy') => {
    setMyStatus(newStatus);
    collabService.broadcastUserStatusChanged(newStatus);
    const label = newStatus === 'available' ? 'Available' : newStatus === 'away' ? 'Away' : 'Busy / DND';
    addToast('Status Updated', `Your live status is now "${label}".`, 'info');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please upload a valid image file (PNG, JPG, WebP, SVG).' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image file size must be less than 5MB.' });
      return;
    }

    setIsUploading(true);
    setMessage(null);

    try {
      const uploadedUrl = await supabaseService.uploadAvatar(currentUser.id, file);
      setAvatarUrl(uploadedUrl);
      setMessage({ type: 'success', text: 'Avatar uploaded! Click "Save Profile & Preferences" to apply.' });
    } catch (err: any) {
      console.error('Failed uploading avatar:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to upload image.' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddSkill = () => {
    const trimmed = newSkillInput.trim();
    if (!trimmed) return;
    const currentSkills = prefs.skills || [];
    if (!currentSkills.includes(trimmed)) {
      setPrefs(p => ({ ...p, skills: [...currentSkills, trimmed] }));
    }
    setNewSkillInput('');
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setPrefs(p => ({ ...p, skills: (p.skills || []).filter(s => s !== skillToRemove) }));
  };

  const toggleWorkingDay = (day: string) => {
    const current = prefs.workingDays || [];
    const updated = current.includes(day)
      ? current.filter(d => d !== day)
      : [...current, day];
    setPrefs(p => ({ ...p, workingDays: updated }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const updates = {
        full_name: fullName.trim() || currentUser.email,
        avatar_url: avatarUrl,
      };

      // Save extended profile attributes locally and broadcast to team
      saveUserProfileExtension(currentUser.id, {
        full_name: updates.full_name,
        avatar_url: updates.avatar_url,
        department: prefs.department,
        job_title: prefs.jobTitle,
        weekly_capacity_hours: prefs.weeklyCapacityHours,
        preferences: prefs,
      });

      const { error } = await supabaseService.client
        .from('user_profiles')
        .update(updates)
        .eq('id', currentUser.id);

      if (error) {
        console.warn('Supabase user_profiles update notice:', error.message);
      }

      // Also update auth user metadata
      try {
        await supabaseService.client.auth.updateUser({
          data: {
            full_name: updates.full_name,
            avatar_url: updates.avatar_url,
            job_title: prefs.jobTitle,
            department: prefs.department,
          },
        });
      } catch (authErr) {}

      const updatedAppUser = normalizeAppUser({
        ...currentUser,
        ...updates,
        department: prefs.department,
        job_title: prefs.jobTitle,
        weekly_capacity_hours: prefs.weeklyCapacityHours,
        preferences: prefs,
      });

      setCurrentUser(updatedAppUser);

      // Broadcast profile/metadata changes in real-time to connected teammates
      collabService.broadcastTeamMemberUpdated({
        userId: currentUser.id,
        userName: updates.full_name,
        updates: {
          full_name: updates.full_name,
          avatar_url: updates.avatar_url,
          department: prefs.department,
          job_title: prefs.jobTitle,
          weekly_capacity_hours: prefs.weeklyCapacityHours,
        },
        actor: {
          id: currentUser.id,
          name: updates.full_name,
        },
      });

      setMessage({ type: 'success', text: 'Your profile, capacity parameters, and workspace preferences have been saved.' });
      addToast('Settings Saved', 'Your profile and workspace parameters are live across the platform.', 'success');
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to update profile.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'New password must be at least 6 characters long.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Passwords do not match. Please verify.' });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await supabaseService.updateUserPassword(newPassword);
      setPasswordMessage({ type: 'success', text: 'Password successfully updated! Use your new password on next login.' });
      addToast('Password Updated', 'Your security password has been changed successfully.', 'success');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordMessage({ type: 'error', text: err.message || 'Failed to update password.' });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (!currentUser?.email) return;
    setIsSendingResetEmail(true);
    setPasswordMessage(null);
    try {
      await supabaseService.sendPasswordResetEmail(currentUser.email);
      setPasswordMessage({ type: 'success', text: `A secure password reset link has been dispatched to ${currentUser.email}.` });
      addToast('Reset Link Dispatched', `Password reset link sent to ${currentUser.email}`, 'success');
    } catch (err: any) {
      setPasswordMessage({ type: 'error', text: err.message || 'Failed to send reset link.' });
    } finally {
      setIsSendingResetEmail(false);
    }
  };

  const handleGeneratePersonalToken = () => {
    if (!currentUser) return;
    const token = `omni_pat_${currentUser.id.slice(0, 6)}_${Math.random().toString(36).substring(2, 14)}${Date.now().toString(36)}`;
    setPersonalApiToken(token);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`omni_pat_${currentUser.id}`, token);
    }
    addToast('API Token Generated', 'Personal Access Token created for CLI & Webhook authentication.', 'success');
  };

  const myAssignedTasksList = useMemo(() => {
    if (!currentUser) return [];
    const combined = [...tasks, ...myTasks];
    const map = new Map<string, any>();
    combined.forEach(t => {
      if (t.assignee_id === currentUser.id) map.set(t.id, t);
    });
    return Array.from(map.values());
  }, [tasks, myTasks, currentUser?.id]);

  const activeAssignedPoints = useMemo(() => {
    return myAssignedTasksList
      .filter(t => t.status !== 'done')
      .reduce((acc, t) => acc + (t.story_points || 1), 0);
  }, [myAssignedTasksList]);

  if (!currentUser) return null;

  const normalizedRole = normalizeUserRole(currentUser.role);
  const workloadPct = Math.min(
    100,
    Math.round((activeAssignedPoints / Math.max(1, prefs.maxStoryPointsPerSprint || 21)) * 100)
  );

  const TABS: { id: SettingsTabId; label: string; icon: React.FC<{ className?: string }>; desc: string }[] = [
    { id: 'identity', label: 'Identity & Profile', icon: ICON_MAP.UserCircleIcon, desc: 'Bio, role, skills & contact' },
    { id: 'capacity', label: 'Work Schedule', icon: ICON_MAP.RocketLaunchIcon, desc: 'Hours & weekly capacity' },
    { id: 'notifications', label: 'Notifications', icon: ICON_MAP.BellIcon, desc: 'Alerts & updates' },
    { id: 'ai_copilot', label: 'AI Settings', icon: ICON_MAP.SparklesIcon, desc: 'Tone & assistance' },
    { id: 'security', label: 'Security & Password', icon: ICON_MAP.ShieldCheckIcon, desc: 'Password & account safety' },
  ];

  const inputClass =
    'w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--text-primary)]/20 focus:border-[var(--border-strong)] transition-colors';

  const cardClass =
    'editorial-surface p-5 sm:p-6 text-[var(--text-primary)] transition-colors';

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-5 animate-fadeIn text-[var(--text-primary)]">
      {/* Top Editorial Identity Card */}
      <HairlineCard className="p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative group shrink-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border border-[var(--border-strong)] bg-[var(--bg-sage)] flex items-center justify-center text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />
                ) : (
                  (fullName || currentUser.email || 'U')[0].toUpperCase()
                )}
              </div>
              <span className="absolute -bottom-1 -right-1 rounded-full bg-[var(--bg-surface)] p-1 border border-[var(--border-hairline)] shadow-xs">
                <StatusDynamicIcon status={myStatus} className="w-3.5 h-3.5" />
              </span>
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-[var(--text-primary)] truncate">
                  {fullName || currentUser.email}
                </h1>
                <StatusDot
                  tone="lime"
                  label={normalizedRole.replace(/_/g, ' ')}
                  className="capitalize font-semibold text-[var(--text-primary)]"
                />
                {currentOrganization?.name && (
                  <>
                    <span className="text-[var(--text-muted)] text-xs">·</span>
                    <span className="text-xs font-medium text-[var(--text-secondary)] flex items-center gap-1">
                      <ICON_MAP.CheckBadgeIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      {currentOrganization.name}
                    </span>
                  </>
                )}
              </div>
              <p className="text-xs text-[var(--text-secondary)] font-medium truncate">
                {prefs.jobTitle} · {prefs.department} · {prefs.location}
              </p>
              <p className="text-[11px] text-[var(--text-muted)] font-mono truncate">{currentUser.email}</p>
            </div>
          </div>

          {/* Quick Status & Capacity Summary */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="bg-[var(--bg-surface-subtle)] border border-[var(--border-hairline)] rounded-2xl px-3.5 py-2.5">
              <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold block">
                Live Status
              </span>
              <div className="flex items-center gap-1 mt-1.5">
                {(['available', 'away', 'busy'] as const).map(st => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleStatusChange(st)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                      myStatus === st
                        ? 'bg-[var(--accent-lime)] text-[var(--accent-ink)] font-bold'
                        : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)]'
                    }`}
                  >
                    <StatusDynamicIcon status={st} className="w-3 h-3" />
                    <span className="capitalize">{st === 'busy' ? 'DND' : st}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-[var(--bg-surface-subtle)] border border-[var(--border-hairline)] rounded-2xl px-4 py-2.5 min-w-[140px]">
              <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold block">
                Work Load
              </span>
              <div className="text-sm font-bold font-mono tabular-nums text-[var(--text-primary)] mt-0.5">
                {activeAssignedPoints} / {prefs.maxStoryPointsPerSprint || 21}{' '}
                <span className="text-[11px] font-normal text-[var(--text-muted)]">pts</span>
              </div>
              <SlimProgressBar
                value={workloadPct}
                tone={workloadPct > 85 ? 'warning' : 'lime'}
                heightClass="h-1"
                className="mt-1.5"
              />
            </div>
          </div>
        </div>
      </HairlineCard>

      {/* Feedback Banner */}
      {message && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center justify-between border ${
            message.type === 'success'
              ? 'bg-[var(--bg-sage)] text-emerald-700 dark:text-emerald-300 border-[var(--border-hairline)]'
              : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/50'
          }`}
        >
          <span>{message.type === 'success' ? '✓ ' : '⚠️ '}{message.text}</span>
          <button type="button" onClick={() => setMessage(null)} className="text-xs opacity-60 hover:opacity-100 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Main Layout: Left Sub-Navigation + Right Parameter Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Navigation Column */}
        <HairlineCard padding="sm" className="lg:col-span-3 space-y-1">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[var(--bg-sage)] text-[var(--text-primary)] border border-[var(--border-hairline)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)] border border-transparent'
                }`}
              >
                <Icon
                  className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                    isActive ? 'text-[#6F8254] dark:text-[var(--accent-lime)]' : 'text-[var(--text-muted)]'
                  }`}
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">{tab.label}</div>
                  <div className="text-[10px] truncate mt-0.5 text-[var(--text-muted)]">
                    {tab.desc}
                  </div>
                </div>
              </button>
            );
          })}

          <div className="pt-3 mt-3 border-t border-[var(--border-hairline)] px-3 pb-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
              Your Activity
            </div>
            <div className="space-y-1.5 text-[11px] text-[var(--text-secondary)]">
              <div className="flex justify-between">
                <span>Projects Access</span>
                <span className="font-mono font-semibold text-[var(--text-primary)]">{projects.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Assigned Tasks</span>
                <span className="font-mono font-semibold text-[var(--text-primary)]">{myAssignedTasksList.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Privacy</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">Encrypted</span>
              </div>
            </div>
          </div>
        </HairlineCard>

        {/* Right Content Column */}
        <div className="lg:col-span-9 space-y-6">
          {activeTab !== 'security' ? (
            <form onSubmit={handleSave} className="space-y-6">
              {/* TAB 1: IDENTITY & PROFILE */}
              {activeTab === 'identity' && (
                <div className={cardClass}>
                  <div className="border-b border-[var(--border-hairline)] pb-4 mb-5">
                    <h2 className="text-base font-bold">Personal Identity & Professional Bio</h2>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      Configure how your profile, role title, and domain skills appear across tasks, sprints, and team directories.
                    </p>
                  </div>

                  <div className="space-y-5">
                    {/* Avatar Upload Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)]">
                      <div className="relative w-16 h-16 rounded-2xl overflow-hidden border border-[var(--border-strong)] bg-[var(--bg-sage)] flex items-center justify-center text-xl font-bold text-[var(--text-primary)] flex-shrink-0">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          (fullName || currentUser.email || 'U')[0].toUpperCase()
                        )}
                        {isUploading && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <ICON_MAP.SpinnerIcon className="w-5 h-5 text-white animate-spin" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-sage)] cursor-pointer transition-colors">
                            <ICON_MAP.PaperClipIcon className="w-3.5 h-3.5 text-[#6F8254] dark:text-[var(--accent-lime)]" />
                            <span>{isUploading ? 'Uploading...' : 'Upload'}</span>
                            <input type="file" accept="image/*" onChange={handleFileUpload} disabled={isUploading} className="hidden" />
                          </label>
                          {avatarUrl && (
                            <button
                              type="button"
                              onClick={() => setAvatarUrl('')}
                              className="px-2.5 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 rounded-full transition-colors cursor-pointer"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <input
                          type="url"
                          value={avatarUrl}
                          onChange={(e) => setAvatarUrl(e.target.value)}
                          placeholder="Or paste direct image URL (https://...)"
                          className={inputClass}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-muted)]">Full Name</label>
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          required
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-muted)]">Email Address (Verified)</label>
                        <input
                          type="email"
                          value={currentUser.email}
                          disabled
                          className={`${inputClass} opacity-60 cursor-not-allowed`}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-muted)]">Job Title / Role Headline</label>
                        <input
                          type="text"
                          value={prefs.jobTitle || ''}
                          onChange={(e) => setPrefs(p => ({ ...p, jobTitle: e.target.value }))}
                          placeholder="e.g. Principal Systems Architect"
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-muted)]">Department / Squad</label>
                        <select
                          value={prefs.department || 'Engineering'}
                          onChange={(e) => setPrefs(p => ({ ...p, department: e.target.value }))}
                          className={inputClass}
                        >
                          {DEPARTMENTS.map(dept => (
                            <option key={dept} value={dept}>{dept}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-muted)]">Location / Office</label>
                        <input
                          type="text"
                          value={prefs.location || ''}
                          onChange={(e) => setPrefs(p => ({ ...p, location: e.target.value }))}
                          placeholder="London, UK / Remote"
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-muted)]">Local Timezone</label>
                        <select
                          value={prefs.timezone || TIMEZONES[0]}
                          onChange={(e) => setPrefs(p => ({ ...p, timezone: e.target.value }))}
                          className={inputClass}
                        >
                          {TIMEZONES.map(tz => (
                            <option key={tz} value={tz}>{tz}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-muted)]">Professional Bio & Focus Areas</label>
                      <textarea
                        rows={3}
                        value={prefs.bio || ''}
                        onChange={(e) => setPrefs(p => ({ ...p, bio: e.target.value }))}
                        placeholder="Share your responsibilities, current OKRs, or preferred communication style..."
                        className={inputClass}
                      />
                    </div>

                    {/* Domain Skills */}
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-muted)]">
                        Domain Skills (Used by AI Co-Pilot for Smart Task Assignment)
                      </label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {(prefs.skills || []).map(skill => (
                          <span
                            key={skill}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--bg-sage)] text-[var(--text-primary)] border border-[var(--border-hairline)]"
                          >
                            <span>{skill}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveSkill(skill)}
                              className="hover:text-rose-500 cursor-pointer"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newSkillInput}
                          onChange={(e) => setNewSkillInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddSkill();
                            }
                          }}
                          placeholder="Add a skill (e.g. Kubernetes, GraphQL, Product Strategy) and press Enter"
                          className={inputClass}
                        />
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={handleAddSkill}
                          className="shrink-0"
                        >
                          Add Skill
                        </Button>
                      </div>
                    </div>

                    {/* Workspace Theme & Color Accent Swatches */}
                    <div className="pt-5 border-t border-[var(--border-hairline)]">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                        <div>
                          <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                            Workspace Theme & Color Accent
                          </h3>
                          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                            Personalize your workspace accent color and Dark/Light mode. Saved automatically for your next session.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={toggleDarkMode}
                          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] hover:bg-[var(--bg-sage)] text-xs font-semibold text-[var(--text-primary)] transition-colors cursor-pointer shrink-0"
                        >
                          {darkMode ? <ICON_MAP.SunIcon className="w-4 h-4 text-amber-400" /> : <ICON_MAP.MoonIcon className="w-4 h-4" />}
                          <span>{darkMode ? 'Dark Mode Active' : 'Light Mode Active'}</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {WORKSPACE_ACCENT_PRESETS.map((preset) => {
                          const isSelected = accentColor === preset.id;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => {
                                setAccentColor(preset.id as WorkspaceAccentId);
                                setPrefs((p) => ({ ...p, accentColor: preset.id as WorkspaceAccentId }));
                                addToast('Accent Updated', `Workspace accent set to ${preset.name}.`, 'info');
                              }}
                              className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-[var(--bg-sage)] border-[var(--border-strong)]'
                                  : 'bg-[var(--bg-surface-subtle)] border-[var(--border-hairline)] hover:border-[var(--border-strong)]'
                              }`}
                            >
                              <span
                                className={`w-7 h-7 rounded-full bg-gradient-to-br ${preset.swatchClass} flex items-center justify-center text-white shadow-xs shrink-0`}
                              >
                                {isSelected && <ICON_MAP.CheckIcon className="w-3.5 h-3.5 stroke-[2.5]" />}
                              </span>
                              <div className="min-w-0">
                                <div className="text-xs font-bold truncate text-[var(--text-primary)]">{preset.name}</div>
                                <div className="text-[10px] text-[var(--text-muted)] truncate">{preset.tagline}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Active Organization & Workspace Switching Section */}
                    <div className="pt-5 border-t border-[var(--border-hairline)] space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                            Organization & Active Workspace
                          </h3>
                          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                            Manage which organization you are active in or switch between company workspaces.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="lime"
                            size="sm"
                            onClick={() => openOrganizationModal('join')}
                          >
                            ⇄ Switch Organization
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => openOrganizationModal('create')}
                          >
                            + Create Workspace
                          </Button>
                        </div>
                      </div>

                      <div className="p-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">Current Active Workspace</span>
                          <div className="text-sm font-bold flex items-center gap-2">
                            <span>{currentOrganization?.name || 'Personal Workspace'}</span>
                            {currentOrganization?.slug && (
                              <span className="text-[11px] font-mono text-[var(--text-muted)]">/{currentOrganization.slug}</span>
                            )}
                          </div>
                          <span className="text-[11px] text-[var(--text-secondary)]">
                            Your role: <strong className="text-[var(--text-primary)] capitalize">{normalizedRole.replace(/_/g, ' ')}</strong>
                          </span>
                        </div>
                        <StatusDot tone="success" label="Active Session" className="font-semibold text-emerald-700 dark:text-emerald-400" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: WORKSPACE & CAPACITY */}
              {activeTab === 'capacity' && (
                <div className={cardClass}>
                  <div className="border-b border-[var(--border-hairline)] pb-4 mb-5">
                    <h2 className="text-base font-bold">Workload Capacity & Workspace Display</h2>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      Set your weekly engineering/delivery bandwidth so the AI Load Balancer can prevent burnout.
                    </p>
                  </div>

                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-muted)]">
                          Weekly Capacity (Hours / Week)
                        </label>
                        <input
                          type="number"
                          min={5}
                          max={80}
                          value={prefs.weeklyCapacityHours ?? 40}
                          onChange={(e) => setPrefs(p => ({ ...p, weeklyCapacityHours: Number(e.target.value) }))}
                          className={inputClass}
                        />
                        <p className="text-[11px] text-[var(--text-muted)] mt-1">Used in Team Management & Resource Load Balancing.</p>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-muted)]">
                          Target Sprint Velocity (Max Story Points)
                        </label>
                        <input
                          type="number"
                          min={3}
                          max={100}
                          value={prefs.maxStoryPointsPerSprint ?? 21}
                          onChange={(e) => setPrefs(p => ({ ...p, maxStoryPointsPerSprint: Number(e.target.value) }))}
                          className={inputClass}
                        />
                        <p className="text-[11px] text-[var(--text-muted)] mt-1">Alerts trigger when your active sprint tasks exceed this cap.</p>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-muted)]">
                          Working Hours Start
                        </label>
                        <input
                          type="time"
                          value={prefs.workingHoursStart || '09:00'}
                          onChange={(e) => setPrefs(p => ({ ...p, workingHoursStart: e.target.value }))}
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-muted)]">
                          Working Hours End
                        </label>
                        <input
                          type="time"
                          value={prefs.workingHoursEnd || '17:30'}
                          onChange={(e) => setPrefs(p => ({ ...p, workingHoursEnd: e.target.value }))}
                          className={inputClass}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider mb-2 text-[var(--text-muted)]">Active Working Days</label>
                      <div className="flex flex-wrap gap-2">
                        {DAYS_OF_WEEK.map(day => {
                          const active = (prefs.workingDays || []).includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => toggleWorkingDay(day)}
                              className={`px-3.5 py-2 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
                                active
                                  ? 'bg-[var(--accent-lime)] text-[var(--accent-ink)] border-[var(--border-strong)]'
                                  : 'bg-[var(--bg-surface-subtle)] border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                              }`}
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[var(--border-hairline)]">
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-muted)]">
                          Default Workspace Landing View
                        </label>
                        <select
                          value={prefs.defaultLandingView || 'overview'}
                          onChange={(e) => setPrefs(p => ({ ...p, defaultLandingView: e.target.value as ActiveView }))}
                          className={inputClass}
                        >
                          <option value="overview">Executive Overview</option>
                          <option value="ai_copilot_view">AI Co-Pilot & Virtual PM Studio</option>
                          <option value="projects_overview">Projects Portfolio</option>
                          <option value="sprints_view">Agile Sprints</option>
                          <option value="my_tasks_view">My Assigned Tasks</option>
                          <option value="team_chat_view">Teams Chat</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-muted)]">
                          Theme Appearance
                        </label>
                        <button
                          type="button"
                          onClick={toggleDarkMode}
                          className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] hover:bg-[var(--bg-sage)] text-xs font-bold text-[var(--text-primary)] cursor-pointer transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            {darkMode ? <ICON_MAP.SunIcon className="w-4 h-4 text-amber-400" /> : <ICON_MAP.MoonIcon className="w-4 h-4" />}
                            <span>Currently {darkMode ? 'Dark Mode' : 'Light Mode'}</span>
                          </span>
                          <span className="underline">Switch Theme</span>
                        </button>
                      </div>
                    </div>

                    {/* Workspace Color Accent Swatches */}
                    <div className="pt-4 border-t border-[var(--border-hairline)]">
                      <div className="flex items-center justify-between mb-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                            Workspace Color Accent (Persisted Across Sessions)
                          </label>
                          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                            Choose your signature accent palette for buttons, active states, and focus rings in both Light and Dark modes.
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
                        {WORKSPACE_ACCENT_PRESETS.map((preset) => {
                          const isSelected = accentColor === preset.id;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => {
                                setAccentColor(preset.id as WorkspaceAccentId);
                                setPrefs((p) => ({ ...p, accentColor: preset.id as WorkspaceAccentId }));
                                addToast('Accent Updated', `Workspace accent set to ${preset.name}.`, 'info');
                              }}
                              className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-[var(--bg-sage)] border-[var(--border-strong)]'
                                  : 'bg-[var(--bg-surface-subtle)] border-[var(--border-hairline)] hover:border-[var(--border-strong)]'
                              }`}
                            >
                              <span
                                className={`w-8 h-8 rounded-full bg-gradient-to-br ${preset.swatchClass} flex items-center justify-center text-white shadow-xs shrink-0`}
                              >
                                {isSelected && <ICON_MAP.CheckIcon className="w-4 h-4 stroke-[2.5]" />}
                              </span>
                              <div className="min-w-0">
                                <div className="text-xs font-bold truncate text-[var(--text-primary)]">{preset.name}</div>
                                <div className="text-[10px] text-[var(--text-muted)] truncate">{preset.tagline}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: NOTIFICATIONS & ALERTS */}
              {activeTab === 'notifications' && (
                <div className={cardClass}>
                  <div className="border-b border-[var(--border-hairline)] pb-4 mb-5">
                    <h2 className="text-base font-bold">Real-Time Notification & Digest Routing</h2>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      Control which workspace events trigger live toast notifications, inbox items, and email digests.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {[
                      {
                        key: 'notifyOnTaskAssigned',
                        title: 'Task Assignment & Ownership Changes',
                        desc: 'Notify me immediately when a task or ticket is assigned to me.',
                      },
                      {
                        key: 'notifyOnMentions',
                        title: '@Mentions in Task Comments & Discussions',
                        desc: 'High-priority alert whenever a teammate tags you in a ticket thread.',
                      },
                      {
                        key: 'notifyOnSprintEvents',
                        title: 'Sprint Lifecycle & Deadline Warnings',
                        desc: 'Receive alerts when sprints start, complete, or tasks become overdue.',
                      },
                      {
                        key: 'notifyOnDirectMessages',
                        title: 'Encrypted Direct Messages (E2EE Chat)',
                        desc: 'Show real-time banner when receiving direct messages in Teams Chat.',
                      },
                      {
                        key: 'soundAlertsEnabled',
                        title: 'Subtle Audio Chimes for Critical Events',
                        desc: 'Play a soft notification sound on critical blocker alerts.',
                      },
                    ].map(item => {
                      const checked = Boolean((prefs as any)[item.key]);
                      return (
                        <div
                          key={item.key}
                          className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)]"
                        >
                          <div>
                            <div className="text-xs font-bold text-[var(--text-primary)]">{item.title}</div>
                            <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">{item.desc}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPrefs(p => ({ ...p, [item.key]: !checked }))}
                            className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer shrink-0 ${
                              checked ? 'bg-[var(--accent-lime)]' : 'bg-[var(--border-strong)]'
                            }`}
                          >
                            <div
                              className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                                checked ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      );
                    })}

                    <div className="pt-3">
                      <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-muted)]">
                        Automated Email Digest Summary
                      </label>
                      <select
                        value={prefs.emailDigestFrequency || 'daily'}
                        onChange={(e) => setPrefs(p => ({ ...p, emailDigestFrequency: e.target.value as any }))}
                        className={inputClass}
                      >
                        <option value="instant">Instant (As events happen)</option>
                        <option value="daily">Daily Morning Executive Briefing (8:00 AM)</option>
                        <option value="weekly">Weekly Friday Sprint Wrap-up</option>
                        <option value="off">Disabled (In-app notifications only)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: AI CO-PILOT PARAMETERS */}
              {activeTab === 'ai_copilot' && (
                <div className={cardClass}>
                  <div className="border-b border-[var(--border-hairline)] pb-4 mb-5">
                    <h2 className="text-base font-bold flex items-center gap-2">
                      <ICON_MAP.SparklesIcon className="w-5 h-5 text-[#6F8254] dark:text-[var(--accent-lime)]" />
                      <span>AI Co-Pilot & Virtual PM Personalization</span>
                    </h2>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      Customize how Omni Flow AI estimates tasks, writes documentation, and surfaces proactive risks.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)]">
                      <div>
                        <div className="text-xs font-bold">Automatic Fibonacci Story Point Estimation</div>
                        <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                          Allow AI Co-Pilot to suggest effort points and QA checklists when opening tasks.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPrefs(p => ({ ...p, aiAutoEstimateEffort: !p.aiAutoEstimateEffort }))}
                        className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer shrink-0 ${
                          prefs.aiAutoEstimateEffort ? 'bg-[var(--accent-lime)]' : 'bg-[var(--border-strong)]'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                            prefs.aiAutoEstimateEffort ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)]">
                      <div>
                        <div className="text-xs font-bold">Proactive Bottleneck & Blocker Detection</div>
                        <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                          Highlight stalled tasks, overloaded teammates, and dependency risks on your dashboard.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPrefs(p => ({ ...p, aiProactiveRiskAlerts: !p.aiProactiveRiskAlerts }))}
                        className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer shrink-0 ${
                          prefs.aiProactiveRiskAlerts ? 'bg-[var(--accent-lime)]' : 'bg-[var(--border-strong)]'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                            prefs.aiProactiveRiskAlerts ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="pt-2">
                      <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-muted)]">
                        Default AI Documentation & Spec Writing Tone
                      </label>
                      <select
                        value={prefs.aiWritingTone || 'executive'}
                        onChange={(e) => setPrefs(p => ({ ...p, aiWritingTone: e.target.value as any }))}
                        className={inputClass}
                      >
                        <option value="executive">Executive & Action-Oriented (Crisp PRDs & Stakeholder Briefs)</option>
                        <option value="technical">Deep Technical & Architectural (Detailed Acceptance Criteria)</option>
                        <option value="concise">Ultra-Concise Bullet Points (Linear-style Minimalist)</option>
                        <option value="friendly">Collaborative & Coaching Tone</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Save Bar for Identity / Capacity / Notifications / AI */}
              <div className="sticky bottom-3 z-20 p-3.5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-md">
                <div className="text-xs text-[var(--text-secondary)]">
                  Changes save immediately across your profile and workspace.
                </div>
                <div className="flex items-center gap-2 sm:pr-14">
                  <Button
                    type="submit"
                    variant="lime"
                    size="sm"
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <ICON_MAP.SpinnerIcon className="w-3.5 h-3.5 animate-spin mr-1.5" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <ICON_MAP.CheckIcon className="w-3.5 h-3.5 mr-1.5" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          ) : (
            /* TAB 5: SECURITY & ACCESS */
            <div className="space-y-5">
              <div className={cardClass}>
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[var(--border-hairline)]">
                  <div className="w-9 h-9 rounded-full bg-[var(--bg-sage)] text-[#6F8254] dark:text-[var(--accent-lime)] flex items-center justify-center">
                    <ICON_MAP.ShieldCheckIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold">Password & Authentication Credentials</h2>
                    <p className="text-xs text-[var(--text-secondary)]">Update your account password or dispatch an email recovery link</p>
                  </div>
                </div>

                {passwordMessage && (
                  <div
                    className={`p-3 mb-4 rounded-xl text-xs font-medium border ${
                      passwordMessage.type === 'success'
                        ? 'bg-[var(--bg-sage)] text-emerald-700 dark:text-emerald-300 border-[var(--border-hairline)]'
                        : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/50'
                    }`}
                  >
                    {passwordMessage.type === 'success' ? '✓ ' : '⚠️ '}
                    {passwordMessage.text}
                  </div>
                )}

                <form onSubmit={handlePasswordUpdate} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-muted)]">New Password</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        minLength={6}
                        required
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-muted)]">Confirm New Password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-type password"
                        minLength={6}
                        required
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[var(--border-hairline)]">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleSendResetEmail}
                      disabled={isSendingResetEmail}
                    >
                      {isSendingResetEmail ? 'Sending Reset Email...' : `Send Recovery Link to ${currentUser.email}`}
                    </Button>

                    <Button
                      type="submit"
                      variant="lime"
                      size="sm"
                      disabled={isUpdatingPassword || !newPassword}
                    >
                      {isUpdatingPassword ? (
                        <>
                          <ICON_MAP.SpinnerIcon className="w-3.5 h-3.5 animate-spin mr-1.5" />
                          <span>Updating Password...</span>
                        </>
                      ) : (
                        <span>Update Password</span>
                      )}
                    </Button>
                  </div>
                </form>
              </div>

              {/* Personal API Access Token & Session Governance */}
              <div className={cardClass}>
                <div className="border-b border-[var(--border-hairline)] pb-4 mb-4">
                  <h2 className="text-base font-bold">Personal Access Token & Session Security</h2>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Generate scoped tokens for webhook triggers, CLI integrations, and E2EE key verification.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="text-xs font-bold">Personal Workspace API Token</div>
                      {personalApiToken ? (
                        <code className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 bg-[var(--bg-surface)] px-2.5 py-1 rounded border border-[var(--border-hairline)] block truncate">
                          {personalApiToken}
                        </code>
                      ) : (
                        <p className="text-[11px] text-[var(--text-muted)]">No active personal token generated.</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {personalApiToken && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(personalApiToken);
                            addToast('Copied', 'Personal API token copied to clipboard.', 'info');
                          }}
                        >
                          Copy
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={handleGeneratePersonalToken}
                      >
                        {personalApiToken ? 'Rotate Token' : 'Generate Token'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
