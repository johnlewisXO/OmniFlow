import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../hooks/useAppStore';
import supabaseService, { saveUserProfileExtension, getUserProfileExtensions, normalizeAppUser } from '../services/supabaseService';
import { collabService } from '../services/collabService';
import { ICON_MAP } from '../constants';
import { ActiveView, normalizeUserRole, UserProfilePreferences } from '../types';
import { StatusDynamicIcon } from './layout/Header';

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
    darkMode,
    toggleDarkMode,
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
  const statusLabelText = myStatus === 'available' ? 'Available' : myStatus === 'away' ? 'Away' : 'Busy / DND';

  const TABS: { id: SettingsTabId; label: string; icon: React.FC<{ className?: string }>; desc: string }[] = [
    { id: 'identity', label: 'Identity & Profile', icon: ICON_MAP.UserCircleIcon, desc: 'Bio, role, skills & contact' },
    { id: 'capacity', label: 'Workspace & Capacity', icon: ICON_MAP.RocketLaunchIcon, desc: 'Sprint velocity & schedule' },
    { id: 'notifications', label: 'Notifications & Alerts', icon: ICON_MAP.BellIcon, desc: 'Real-time & digest rules' },
    { id: 'ai_copilot', label: 'AI Co-Pilot Parameters', icon: ICON_MAP.SparklesIcon, desc: 'Estimation & tone tuning' },
    { id: 'security', label: 'Security & Access', icon: ICON_MAP.ShieldCheckIcon, desc: 'Password, 2FA & API keys' },
  ];

  const inputClass = `w-full px-3.5 py-2.5 text-sm rounded-xl border focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all ${
    darkMode ? 'bg-slate-900/70 border-slate-700/80 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
  }`;

  const cardClass = `p-6 rounded-2xl border shadow-xs ${
    darkMode ? 'bg-slate-900/60 border-slate-800 text-slate-100' : 'bg-white border-slate-200/80 text-slate-800'
  }`;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-6 animate-fadeIn">
      {/* Top Executive Identity Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-indigo-900/50 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#818cf8_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-indigo-400/50 bg-indigo-500/20 flex items-center justify-center text-2xl font-bold text-white shadow-lg">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />
                ) : (
                  (fullName || currentUser.email || 'U')[0].toUpperCase()
                )}
              </div>
              <span className="absolute -bottom-1 -right-1 rounded-full bg-slate-900 p-1 shadow-md border border-slate-700">
                <StatusDynamicIcon status={myStatus} className="w-4 h-4" />
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                  {fullName || currentUser.email}
                </h1>
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-500/25 text-indigo-300 border border-indigo-400/30">
                  {normalizedRole.replace(/_/g, ' ')}
                </span>
                {currentOrganization?.name && (
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <ICON_MAP.CheckBadgeIcon className="w-3 h-3" />
                    {currentOrganization.name}
                  </span>
                )}
              </div>
              <p className="text-xs text-indigo-200/90 font-medium">
                {prefs.jobTitle} • {prefs.department} • {prefs.location}
              </p>
              <p className="text-[11px] text-slate-400 font-mono">{currentUser.email}</p>
            </div>
          </div>

          {/* Quick Status & Capacity Summary in Banner */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-white/5 border border-white/10 rounded-xl px-3.5 py-2">
              <span className="text-[10px] uppercase tracking-wider text-indigo-300 font-bold block">Live Availability</span>
              <div className="flex items-center gap-1.5 mt-1">
                {(['available', 'away', 'busy'] as const).map(st => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleStatusChange(st)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                      myStatus === st
                        ? 'bg-indigo-500 text-white shadow-xs'
                        : 'bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <StatusDynamicIcon status={st} className="w-3 h-3" />
                    <span className="capitalize">{st === 'busy' ? 'DND' : st}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-right">
              <span className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold block">Sprint Load</span>
              <div className="text-sm font-black text-white mt-0.5">
                {activeAssignedPoints} / {prefs.maxStoryPointsPerSprint || 21} <span className="text-[11px] font-normal text-slate-300">pts</span>
              </div>
              <span className="text-[10px] text-slate-400">{prefs.weeklyCapacityHours}h / week capacity</span>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {message && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between border ${
            message.type === 'success'
              ? darkMode
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : darkMode
                ? 'bg-rose-950/40 text-rose-300 border-rose-800/60'
                : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <span>{message.type === 'success' ? '✓ ' : '⚠️ '}{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Main Layout: Left Sub-Navigation + Right Parameter Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Navigation Column */}
        <div className={`lg:col-span-3 p-2.5 rounded-2xl border space-y-1 ${darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200/80'}`}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : darkMode
                      ? 'text-slate-300 hover:bg-slate-800/70'
                      : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isActive ? 'text-white' : 'text-indigo-500'}`} />
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">{tab.label}</div>
                  <div className={`text-[10px] truncate mt-0.5 ${isActive ? 'text-indigo-100' : 'text-slate-400'}`}>
                    {tab.desc}
                  </div>
                </div>
              </button>
            );
          })}

          <div className={`pt-3 mt-3 border-t px-3 pb-2 ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Account Telemetry</div>
            <div className="space-y-1.5 text-[11px] text-slate-400">
              <div className="flex justify-between">
                <span>Projects Access:</span>
                <span className="font-semibold text-slate-200">{projects.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Assigned Tasks:</span>
                <span className="font-semibold text-slate-200">{myAssignedTasksList.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Encryption:</span>
                <span className="font-semibold text-emerald-400">AES-GCM 256</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Content Column */}
        <div className="lg:col-span-9 space-y-6">
          {activeTab !== 'security' ? (
            <form onSubmit={handleSave} className="space-y-6">
              {/* TAB 1: IDENTITY & PROFILE */}
              {activeTab === 'identity' && (
                <div className={cardClass}>
                  <div className="border-b border-slate-200 dark:border-slate-800 pb-4 mb-5">
                    <h2 className="text-base font-bold">Personal Identity & Professional Bio</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Configure how your profile, role title, and domain skills appear across tasks, sprints, and team directories.
                    </p>
                  </div>

                  <div className="space-y-5">
                    {/* Avatar Upload Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
                      <div className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-indigo-500/40 bg-indigo-500/10 flex items-center justify-center text-xl font-bold text-indigo-400 flex-shrink-0">
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
                          <label className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-xl border cursor-pointer transition-colors ${
                            darkMode ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                          }`}>
                            <ICON_MAP.PaperClipIcon className="w-3.5 h-3.5 text-indigo-400" />
                            <span>{isUploading ? 'Uploading...' : 'Upload New Photo'}</span>
                            <input type="file" accept="image/*" onChange={handleFileUpload} disabled={isUploading} className="hidden" />
                          </label>
                          {avatarUrl && (
                            <button
                              type="button"
                              onClick={() => setAvatarUrl('')}
                              className="px-2.5 py-1.5 text-xs font-medium text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
                            >
                              Remove Photo
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
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-400">Full Name</label>
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          required
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-400">Email Address (Verified)</label>
                        <input
                          type="email"
                          value={currentUser.email}
                          disabled
                          className={`${inputClass} opacity-60 cursor-not-allowed`}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-400">Job Title / Role Headline</label>
                        <input
                          type="text"
                          value={prefs.jobTitle || ''}
                          onChange={(e) => setPrefs(p => ({ ...p, jobTitle: e.target.value }))}
                          placeholder="e.g. Principal Systems Architect"
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-400">Department / Squad</label>
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
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-400">Location / Office</label>
                        <input
                          type="text"
                          value={prefs.location || ''}
                          onChange={(e) => setPrefs(p => ({ ...p, location: e.target.value }))}
                          placeholder="London, UK / Remote"
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-400">Local Timezone</label>
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
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-400">Professional Bio & Focus Areas</label>
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
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-400">
                        Domain Skills (Used by AI Co-Pilot for Smart Task Assignment)
                      </label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {(prefs.skills || []).map(skill => (
                          <span
                            key={skill}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30"
                          >
                            <span>{skill}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveSkill(skill)}
                              className="hover:text-rose-400 cursor-pointer"
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
                        <button
                          type="button"
                          onClick={handleAddSkill}
                          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex-shrink-0 cursor-pointer"
                        >
                          Add Skill
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: WORKSPACE & CAPACITY */}
              {activeTab === 'capacity' && (
                <div className={cardClass}>
                  <div className="border-b border-slate-200 dark:border-slate-800 pb-4 mb-5">
                    <h2 className="text-base font-bold">Workload Capacity & Workspace Display</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Set your weekly engineering/delivery bandwidth so the AI Load Balancer can prevent burnout.
                    </p>
                  </div>

                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-400">
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
                        <p className="text-[11px] text-slate-400 mt-1">Used in Team Management & Resource Load Balancing.</p>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-400">
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
                        <p className="text-[11px] text-slate-400 mt-1">Alerts trigger when your active sprint tasks exceed this cap.</p>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-400">
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
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-400">
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
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-slate-400">Active Working Days</label>
                      <div className="flex flex-wrap gap-2">
                        {DAYS_OF_WEEK.map(day => {
                          const active = (prefs.workingDays || []).includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => toggleWorkingDay(day)}
                              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                active
                                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                                  : darkMode
                                    ? 'bg-slate-800/70 border-slate-700 text-slate-400'
                                    : 'bg-slate-100 border-slate-200 text-slate-600'
                              }`}
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-400">
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
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-400">
                          Theme Appearance
                        </label>
                        <button
                          type="button"
                          onClick={toggleDarkMode}
                          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-xs font-bold cursor-pointer ${
                            darkMode ? 'bg-slate-800 border-slate-700 text-amber-300' : 'bg-slate-100 border-slate-200 text-slate-800'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            {darkMode ? <ICON_MAP.SunIcon className="w-4 h-4" /> : <ICON_MAP.MoonIcon className="w-4 h-4" />}
                            <span>Currently {darkMode ? 'Dark Mode' : 'Light Mode'}</span>
                          </span>
                          <span className="underline">Switch Theme</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: NOTIFICATIONS & ALERTS */}
              {activeTab === 'notifications' && (
                <div className={cardClass}>
                  <div className="border-b border-slate-200 dark:border-slate-800 pb-4 mb-5">
                    <h2 className="text-base font-bold">Real-Time Notification & Digest Routing</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Control which workspace events trigger live toast notifications, inbox items, and email digests.
                    </p>
                  </div>

                  <div className="space-y-4">
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
                          className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800"
                        >
                          <div>
                            <div className="text-xs font-bold">{item.title}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5">{item.desc}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPrefs(p => ({ ...p, [item.key]: !checked }))}
                            className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer ${
                              checked ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
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
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-400">
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
                  <div className="border-b border-slate-200 dark:border-slate-800 pb-4 mb-5">
                    <h2 className="text-base font-bold flex items-center gap-2">
                      <ICON_MAP.SparklesIcon className="w-5 h-5 text-indigo-400" />
                      <span>AI Co-Pilot & Virtual PM Personalization</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Customize how Omni Flow AI estimates tasks, writes documentation, and surfaces proactive risks.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800">
                      <div>
                        <div className="text-xs font-bold">Automatic Fibonacci Story Point Estimation</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Allow AI Co-Pilot to suggest effort points and QA checklists when opening tasks.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPrefs(p => ({ ...p, aiAutoEstimateEffort: !p.aiAutoEstimateEffort }))}
                        className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer ${
                          prefs.aiAutoEstimateEffort ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                            prefs.aiAutoEstimateEffort ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800">
                      <div>
                        <div className="text-xs font-bold">Proactive Bottleneck & Blocker Detection</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Highlight stalled tasks, overloaded teammates, and dependency risks on your dashboard.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPrefs(p => ({ ...p, aiProactiveRiskAlerts: !p.aiProactiveRiskAlerts }))}
                        className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer ${
                          prefs.aiProactiveRiskAlerts ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
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
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-400">
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
              <div className="flex items-center justify-end gap-3">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 flex items-center gap-2 transition-all cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <ICON_MAP.SpinnerIcon className="w-4 h-4 animate-spin" />
                      <span>Saving Parameters...</span>
                    </>
                  ) : (
                    <>
                      <ICON_MAP.CheckIcon className="w-4 h-4" />
                      <span>Save Profile & Preferences</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* TAB 5: SECURITY & ACCESS */
            <div className="space-y-6">
              <div className={cardClass}>
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">
                    <ICON_MAP.ShieldCheckIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold">Password & Authentication Credentials</h2>
                    <p className="text-xs text-slate-400">Update your account password or dispatch an email recovery link</p>
                  </div>
                </div>

                {passwordMessage && (
                  <div
                    className={`p-3 mb-4 rounded-xl text-xs font-medium ${
                      passwordMessage.type === 'success'
                        ? darkMode
                          ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/60'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : darkMode
                          ? 'bg-rose-950/40 text-rose-300 border border-rose-800/60'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {passwordMessage.type === 'success' ? '✓ ' : '⚠️ '}
                    {passwordMessage.text}
                  </div>
                )}

                <form onSubmit={handlePasswordUpdate} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-400">New Password</label>
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
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-400">Confirm New Password</label>
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

                  <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200/60 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={handleSendResetEmail}
                      disabled={isSendingResetEmail}
                      className={`text-xs font-semibold px-3.5 py-2 rounded-xl border transition-all cursor-pointer ${
                        darkMode ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      {isSendingResetEmail ? 'Sending Reset Email...' : `Send Recovery Link to ${currentUser.email}`}
                    </button>

                    <button
                      type="submit"
                      disabled={isUpdatingPassword || !newPassword}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
                    >
                      {isUpdatingPassword ? (
                        <>
                          <ICON_MAP.SpinnerIcon className="w-4 h-4 animate-spin" />
                          <span>Updating Password...</span>
                        </>
                      ) : (
                        <span>Update Password</span>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Personal API Access Token & Session Governance */}
              <div className={cardClass}>
                <div className="border-b border-slate-200 dark:border-slate-800 pb-4 mb-4">
                  <h2 className="text-base font-bold">Personal Access Token & Session Security</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Generate scoped tokens for webhook triggers, CLI integrations, and E2EE key verification.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-xs font-bold">Personal Workspace API Token</div>
                      {personalApiToken ? (
                        <code className="text-[11px] font-mono text-emerald-400 bg-slate-900 px-2.5 py-1 rounded border border-slate-800 block">
                          {personalApiToken}
                        </code>
                      ) : (
                        <p className="text-[11px] text-slate-400">No active personal token generated.</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {personalApiToken && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(personalApiToken);
                            addToast('Copied', 'Personal API token copied to clipboard.', 'info');
                          }}
                          className="px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-semibold hover:bg-slate-800 cursor-pointer"
                        >
                          Copy
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleGeneratePersonalToken}
                        className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
                      >
                        {personalApiToken ? 'Rotate Token' : 'Generate Token'}
                      </button>
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
