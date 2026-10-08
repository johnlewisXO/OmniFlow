import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { Modal } from './Modal';
import { Button } from './Button';
import emailNotificationService, { OutboxEmailItem } from '../../services/emailNotificationService';
import supabaseService, { saveUserProfileExtension } from '../../services/supabaseService';
import { UserRole } from '../../types';

interface EmailOutboxAndVerifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'verify' | 'outbox';
}

export const EmailOutboxAndVerifyModal: React.FC<EmailOutboxAndVerifyModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'verify',
}) => {
  const {
    currentUser,
    setCurrentUser,
    darkMode,
    addToast,
    setActiveView,
    tasks,
    openViewTaskModal,
    setUsers,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'verify' | 'outbox'>(initialTab);
  const [emails, setEmails] = useState<OutboxEmailItem[]>([]);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [relayWebhookUrl, setRelayWebhookUrl] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('omni_email_webhook_url') || '';
    }
    return '';
  });

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    setIsVerified(emailNotificationService.isUserEmailVerified(currentUser));
    if (currentUser?.id) {
      const pending = emailNotificationService.getPendingOtpForUser(currentUser.id);
      if (pending) setGeneratedOtp(pending);
    }
  }, [currentUser, isOpen]);

  useEffect(() => {
    const unsub = emailNotificationService.subscribeOutbox(list => {
      setEmails(list);
      if (list.length > 0 && !selectedEmailId) {
        setSelectedEmailId(list[0].id);
      }
    });
    return () => unsub();
  }, [selectedEmailId]);

  const handleSendVerificationCode = async () => {
    if (!currentUser) return;
    setIsSendingCode(true);
    try {
      const { otpCode, emailItem } = await emailNotificationService.sendVerificationEmail(currentUser);
      setGeneratedOtp(otpCode);
      setSelectedEmailId(emailItem.id);
      addToast(
        'Verification Email Sent',
        `6-digit verification code (${otpCode}) sent to ${currentUser.email}.`,
        'info'
      );
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyCodeSubmit = async (e?: React.FormEvent, codeOverride?: string) => {
    if (e) e.preventDefault();
    if (!currentUser) return;
    const codeToUse = (codeOverride ?? otpInput).trim();
    const ok = await emailNotificationService.verifyUserEmail(currentUser, codeToUse || undefined);
    if (!ok) {
      addToast('Invalid Code', 'The 6-digit verification code did not match. Please check the code and try again.', 'error');
      return;
    }
    setIsVerified(true);
    setOtpInput('');
    setCurrentUser({
      ...currentUser,
      preferences: {
        ...(currentUser.preferences || {}),
      },
    });
    addToast('Email Verified', `${currentUser.email} is now verified for workspace security and alerts!`, 'success');
  };

  const handleSendTestUpdateEmail = () => {
    if (!currentUser) return;
    const item = emailNotificationService.sendImportantUpdateEmail({
      recipient: currentUser,
      category: 'TASK_ASSIGNED',
      subject: 'Important Update: High-Priority Sprint Deliverable Assigned',
      heading: '⚡ High-Priority Task Assigned to You',
      details: `${currentUser.full_name || currentUser.email}, you have been assigned to review the Q4 Production Release Readiness checklist. Due within 24 hours.`,
      ctaLabel: 'Open My Tasks in Workspace',
      ctaAction: {
        type: 'open_view',
        view: 'my_tasks_view',
      },
    });
    if (item) {
      setSelectedEmailId(item.id);
      setActiveTab('outbox');
      addToast('Test Email Dispatched', `Delivered to ${currentUser.email} in Live Email Outbox.`, 'success');
    } else {
      addToast('Email Notifications Muted', 'Enable email notifications in Profile Settings first.', 'warning');
    }
  };

  const handleEmailCtaClick = async (email: OutboxEmailItem) => {
    emailNotificationService.markEmailOpened(email.id);
    const action = email.ctaAction;
    if (!action) return;

    if (action.type === 'verify_email' && currentUser) {
      await handleVerifyCodeSubmit(undefined, action.otpCode || action.token);
      return;
    }

    if (action.type === 'accept_invite' && email.metadata && currentUser) {
      // Simulate external invitee accepting the organization invite so they join the org immediately
      const meta = email.metadata;
      const newMemberId = `invited_${Date.now().toString(36)}`;
      const newOrgMember = {
        id: newMemberId,
        supabase_auth_id: newMemberId,
        full_name: meta.recipientName || meta.recipientEmail.split('@')[0],
        email: meta.recipientEmail,
        role: (meta.role as UserRole) || UserRole.MEMBER,
        organization_id: currentUser.organization_id,
      };
      saveUserProfileExtension(newMemberId, {
        organization_id: currentUser.organization_id,
        roleOverride: newOrgMember.role,
        emailVerified: true,
      });
      try {
        const raw = localStorage.getItem('omni_custom_team_members');
        const list = raw ? JSON.parse(raw) : [];
        if (!list.some((u: any) => u.email?.toLowerCase() === newOrgMember.email.toLowerCase())) {
          list.push(newOrgMember);
          localStorage.setItem('omni_custom_team_members', JSON.stringify(list));
        }
      } catch (e) {}

      const currentUsers = useAppStore.getState().users || [];
      if (!currentUsers.some(u => u.email?.toLowerCase() === newOrgMember.email.toLowerCase())) {
        setUsers([...currentUsers, newOrgMember]);
      }

      addToast(
        'Invite Accepted!',
        `${newOrgMember.full_name} accepted the invite link and joined your organization! You can now DM them.`,
        'success'
      );
      onClose();
      return;
    }

    if (action.type === 'open_task' && action.targetId) {
      const t = tasks.find(task => task.id === action.targetId);
      if (t) {
        openViewTaskModal(t);
        onClose();
        return;
      }
    }

    if (action.type === 'open_chat' && action.targetId) {
      setActiveView('team_chat_view');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('omni_select_chat_contact', { detail: { userId: action.targetId } }));
      }, 90);
      onClose();
      return;
    }

    if (action.type === 'open_view' && action.view) {
      setActiveView(action.view);
      onClose();
    }
  };

  const selectedEmail = emails.find(e => e.id === selectedEmailId) || emails[0] || null;
  const authProvider = emailNotificationService.getUserAuthProvider(currentUser);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Email Verification & Notification Center"
      size="3xl"
    >
      <div className="space-y-4 text-xs">
        {/* Top Mode Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-700/80">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('verify')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'verify'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ICON_MAP.ShieldCheckIcon className="w-3.5 h-3.5" />
              <span>Email Verification</span>
              {isVerified ? (
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px]">
                  Verified
                </span>
              ) : (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[9px]">
                  Unverified
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('outbox')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'outbox'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ICON_MAP.InboxIcon className="w-3.5 h-3.5" />
              <span>Live Email Outbox ({emails.length})</span>
            </button>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleSendTestUpdateEmail}
          >
            + Send Test Notification Email
          </Button>
        </div>

        {activeTab === 'verify' ? (
          <div className="space-y-4">
            {/* Current Status Banner */}
            <div
              className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                isVerified
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`p-2.5 rounded-xl flex-shrink-0 ${
                    isVerified ? 'bg-emerald-500/20 text-emerald-500' : 'bg-amber-500/20 text-amber-500'
                  }`}
                >
                  <ICON_MAP.ShieldCheckIcon className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold">
                      {isVerified ? 'Email Identity Verified' : 'Email Verification Recommended'}
                    </h4>
                    {authProvider === 'google' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-600 dark:text-indigo-300">
                        Google SSO Verified
                      </span>
                    )}
                  </div>
                  <p className="text-xs opacity-85 mt-0.5">
                    Account email: <strong>{currentUser?.email}</strong>
                  </p>
                  <p className="text-[11px] opacity-75 mt-1">
                    {isVerified
                      ? 'Your email is verified for E2EE direct message identity, audit alerts, and important workspace updates.'
                      : 'Send a 6-digit verification code or click Verify below to confirm your workspace email address.'}
                  </p>
                </div>
              </div>

              {!isVerified && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={isSendingCode}
                    onClick={handleSendVerificationCode}
                  >
                    {isSendingCode ? 'Sending...' : 'Send 6-Digit Code'}
                  </Button>
                </div>
              )}
            </div>

            {/* Verification Input & 1-Click Test Card */}
            {!isVerified && (
              <div
                className={`p-4 rounded-2xl border space-y-3 ${
                  darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h5 className="font-bold text-slate-900 dark:text-white">
                    Enter 6-Digit Verification Code
                  </h5>
                  {generatedOtp && (
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 font-mono text-xs font-bold">
                      Latest Code: {generatedOtp}
                    </span>
                  )}
                </div>

                <form onSubmit={e => handleVerifyCodeSubmit(e)} className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="e.g. 482910"
                    value={otpInput}
                    onChange={e => setOtpInput(e.target.value)}
                    className="w-44 px-3.5 py-2 rounded-xl border font-mono text-sm tracking-widest uppercase text-center"
                  />
                  <Button type="submit" variant="primary" size="sm" disabled={!otpInput.trim()}>
                    Verify Code
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleVerifyCodeSubmit(undefined, generatedOtp || 'INSTANT_VERIFY')}
                  >
                    ⚡ 1-Click Instant Verify (Test Mode)
                  </Button>
                </form>
              </div>
            )}

            {/* Webhook / External Email Relay Config */}
            <div
              className={`p-4 rounded-2xl border space-y-2.5 ${
                darkMode ? 'bg-slate-800/40 border-slate-700/80' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="font-bold text-slate-900 dark:text-white">
                    Email Notification Delivery & Webhook Relay
                  </h5>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Important updates (Task Assignments, @Mentions, Due Dates, Role Changes, Org Invites) are delivered to the Live Email Outbox and optionally forwarded to your Resend / SendGrid / Zapier webhook URL.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="url"
                  placeholder="Optional: https://api.yourdomain.com/webhooks/email-relay"
                  value={relayWebhookUrl}
                  onChange={e => setRelayWebhookUrl(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-xl border text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('omni_email_webhook_url', relayWebhookUrl.trim());
                    }
                    addToast('Email Relay Saved', 'External email webhook endpoint updated.', 'success');
                  }}
                >
                  Save Relay
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* Live Email Outbox Split View */
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 min-h-[340px]">
            <div
              className={`md:col-span-5 rounded-2xl border overflow-y-auto max-h-[380px] divide-y ${
                darkMode
                  ? 'bg-slate-900/50 border-slate-700 divide-slate-800'
                  : 'bg-slate-50 border-slate-200 divide-slate-200/70'
              }`}
            >
              {emails.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-2">
                  <ICON_MAP.InboxIcon className="w-8 h-8 mx-auto opacity-50" />
                  <p className="font-semibold">No emails sent yet</p>
                  <p className="text-[11px]">
                    Click "+ Send Test Notification Email" above or assign a task/invite a user to inspect live emails here.
                  </p>
                </div>
              ) : (
                emails.map(item => {
                  const active = selectedEmail?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelectedEmailId(item.id);
                        emailNotificationService.markEmailOpened(item.id);
                      }}
                      className={`w-full p-3 text-left transition-colors cursor-pointer ${
                        active
                          ? 'bg-indigo-600/15 dark:bg-indigo-500/20'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
                          {item.category.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="font-bold text-slate-900 dark:text-white truncate mt-1">
                        {item.subject}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        To: {item.toEmail}
                      </p>
                    </button>
                  );
                })
              )}
            </div>

            <div
              className={`md:col-span-7 rounded-2xl border p-4 flex flex-col justify-between ${
                darkMode ? 'bg-slate-900/80 border-slate-700' : 'bg-white border-slate-200'
              }`}
            >
              {selectedEmail ? (
                <div className="space-y-3">
                  <div className="pb-3 border-b border-slate-200 dark:border-slate-800 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                        ● {selectedEmail.status.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(selectedEmail.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {selectedEmail.subject}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      To: <strong>{selectedEmail.toName}</strong> &lt;{selectedEmail.toEmail}&gt;
                    </p>
                  </div>

                  <div
                    className={`p-3.5 rounded-xl border text-xs ${
                      darkMode ? 'bg-slate-800/60 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                    dangerouslySetInnerHTML={{ __html: selectedEmail.bodyHtml }}
                  />

                  {selectedEmail.ctaLabel && (
                    <div className="pt-2 flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => handleEmailCtaClick(selectedEmail)}
                      >
                        {selectedEmail.ctaLabel} →
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  Select an email on the left to preview its content and test its action link.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
export default EmailOutboxAndVerifyModal;
