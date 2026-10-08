import { User, UserRole, ActiveView } from '../types';
import supabaseService, { supabase, getUserProfileExtensions, saveUserProfileExtension } from './supabaseService';

export type EmailCategory =
  | 'EMAIL_VERIFICATION'
  | 'ORGANIZATION_INVITE'
  | 'TASK_ASSIGNED'
  | 'MENTION'
  | 'TASK_DUE_ALERT'
  | 'ROLE_UPDATED'
  | 'DIRECT_MESSAGE'
  | 'SECURITY_ALERT';

export interface OutboxEmailItem {
  id: string;
  toEmail: string;
  toName: string;
  subject: string;
  category: EmailCategory;
  preheader: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  ctaAction?: {
    type: 'verify_email' | 'accept_invite' | 'open_task' | 'open_chat' | 'open_view';
    targetId?: string;
    view?: ActiveView;
    token?: string;
    otpCode?: string;
  };
  status: 'delivered' | 'opened' | 'queued';
  createdAt: string;
  metadata?: Record<string, any>;
}

const OUTBOX_STORAGE_KEY = 'omni_email_outbox_v1';
const OTP_STORAGE_KEY = 'omni_email_verification_otps';

const listeners = new Set<(emails: OutboxEmailItem[]) => void>();

const loadOutbox = (): OutboxEmailItem[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OUTBOX_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveOutbox = (items: OutboxEmailItem[]) => {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = items.slice(0, 100);
    localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(trimmed));
    listeners.forEach(cb => cb(trimmed));
  } catch (e) {
    console.warn('[emailNotificationService] Failed to save outbox:', e);
  }
};

export const emailNotificationService = {
  getOutboxEmails: (recipientEmail?: string): OutboxEmailItem[] => {
    const all = loadOutbox();
    if (!recipientEmail) return all;
    const clean = recipientEmail.trim().toLowerCase();
    return all.filter(item => item.toEmail.toLowerCase() === clean || item.category === 'ORGANIZATION_INVITE');
  },

  subscribeOutbox: (callback: (emails: OutboxEmailItem[]) => void) => {
    listeners.add(callback);
    callback(loadOutbox());
    return () => {
      listeners.delete(callback);
    };
  },

  markEmailOpened: (emailId: string) => {
    const current = loadOutbox();
    const updated = current.map(item =>
      item.id === emailId ? { ...item, status: 'opened' as const } : item
    );
    saveOutbox(updated);
  },

  clearOutbox: () => {
    saveOutbox([]);
  },

  isUserEmailVerified: (user?: User | null): boolean => {
    if (!user?.id) return false;
    const ext = getUserProfileExtensions(user.id);
    if (ext.emailVerified === true || ext.authProvider === 'google') {
      return true;
    }
    return false;
  },

  getUserAuthProvider: (user?: User | null): 'email' | 'google' => {
    if (!user?.id) return 'email';
    const ext = getUserProfileExtensions(user.id);
    return ext.authProvider === 'google' ? 'google' : 'email';
  },

  getPendingOtpForUser: (userId: string): string | null => {
    if (typeof window === 'undefined' || !userId) return null;
    try {
      const raw = localStorage.getItem(OTP_STORAGE_KEY);
      const map = raw ? JSON.parse(raw) : {};
      return map[userId]?.code || null;
    } catch {
      return null;
    }
  },

  sendVerificationEmail: async (user: User): Promise<{ otpCode: string; verifyUrl: string; emailItem: OutboxEmailItem }> => {
    const otpCode = String(Math.floor(100000 + Math.random() * 900000));
    const token = `ver_${user.id.slice(0, 8)}_${Date.now().toString(36)}`;
    const origin = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : 'https://omniflow.app/';
    const verifyUrl = `${origin}#/app?verify-email=${token}&uid=${encodeURIComponent(user.id)}`;

    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(OTP_STORAGE_KEY);
        const map = raw ? JSON.parse(raw) : {};
        map[user.id] = { code: otpCode, token, email: user.email, createdAt: Date.now() };
        localStorage.setItem(OTP_STORAGE_KEY, JSON.stringify(map));
      } catch (e) {}
    }

    // Also attempt real Supabase confirmation email resend in background
    try {
      await supabase.auth.resend({
        type: 'signup',
        email: user.email,
        options: {
          emailRedirectTo: verifyUrl,
        },
      });
    } catch (e) {
      // Safe fallback when Supabase rate-limits or auto-confirm is active
    }

    const emailItem = emailNotificationService.sendEmail({
      toEmail: user.email,
      toName: user.full_name || user.email.split('@')[0],
      subject: `[Omni Flow] Verify your email address (Code: ${otpCode})`,
      category: 'EMAIL_VERIFICATION',
      preheader: `Your 6-digit verification code is ${otpCode}. Click to verify your workspace identity.`,
      bodyHtml: `
        <div style="font-family: Inter, sans-serif; line-height: 1.6;">
          <p>Hi <strong>${user.full_name || user.email}</strong>,</p>
          <p>Please verify your email address to unlock full security notifications, E2EE identity verification, and workspace alerts.</p>
          <div style="margin: 16px 0; padding: 14px 18px; border-radius: 12px; background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.3); text-align: center;">
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #6366f1; font-weight: 700;">6-Digit Verification Code</div>
            <div style="font-size: 24px; font-weight: 800; letter-spacing: 0.25em; margin-top: 4px;">${otpCode}</div>
          </div>
          <p style="font-size: 12px; color: #64748b;">Or click the button below to verify your email address immediately.</p>
        </div>
      `,
      ctaLabel: '✓ Verify Email Address Now',
      ctaUrl: verifyUrl,
      ctaAction: {
        type: 'verify_email',
        targetId: user.id,
        token,
        otpCode,
      },
    });

    return { otpCode, verifyUrl, emailItem };
  },

  verifyUserEmail: async (user: User, codeOrToken?: string): Promise<boolean> => {
    if (!user?.id) return false;
    if (codeOrToken) {
      try {
        const raw = localStorage.getItem(OTP_STORAGE_KEY);
        const map = raw ? JSON.parse(raw) : {};
        const record = map[user.id];
        const cleanInput = codeOrToken.trim();
        if (
          record &&
          cleanInput !== record.code &&
          cleanInput !== record.token &&
          !cleanInput.startsWith('ver_')
        ) {
          return false;
        }
      } catch (e) {}
    }

    saveUserProfileExtension(user.id, {
      emailVerified: true,
      emailVerifiedAt: new Date().toISOString(),
    });

    if (user.organization_id) {
      await supabaseService.logAuditEvent({
        organization_id: user.organization_id,
        actor_id: user.id,
        actor_name: user.full_name || user.email,
        actor_email: user.email,
        action: 'email_verified',
        target_type: 'user',
        target_id: user.id,
        target_name: user.email,
        details: { verified_at: new Date().toISOString() },
      });
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('omni_email_verified', { detail: { userId: user.id } }));
    }
    return true;
  },

  sendOrganizationInviteEmail: async (params: {
    inviter: User;
    organizationName: string;
    recipientEmail: string;
    recipientName?: string;
    role: UserRole;
    inviteToken: string;
  }): Promise<{ inviteUrl: string; emailItem: OutboxEmailItem }> => {
    const origin = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : 'https://omniflow.app/';
    const inviteUrl = `${origin}#/app?join-token=${params.inviteToken}`;
    const displayRecipient = params.recipientName || params.recipientEmail.split('@')[0];

    const emailItem = emailNotificationService.sendEmail({
      toEmail: params.recipientEmail,
      toName: displayRecipient,
      subject: `${params.inviter.full_name || params.inviter.email} invited you to join ${params.organizationName} on Omni Flow`,
      category: 'ORGANIZATION_INVITE',
      preheader: `Join ${params.organizationName} as ${params.role.replace(/_/g, ' ')} to collaborate on projects and E2EE Direct Messages.`,
      bodyHtml: `
        <div style="font-family: Inter, sans-serif; line-height: 1.6;">
          <p>Hi <strong>${displayRecipient}</strong>,</p>
          <p><strong>${params.inviter.full_name || params.inviter.email}</strong> has invited you to join the <strong>${params.organizationName}</strong> workspace on Omni Flow so you can collaborate in E2EE Direct Messages, channels, and project boards.</p>
          <div style="margin: 14px 0; padding: 12px 16px; border-radius: 10px; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); font-size: 12px;">
            <div><strong>Organization:</strong> ${params.organizationName}</div>
            <div><strong>Assigned Role:</strong> ${params.role.replace(/_/g, ' ')}</div>
            <div style="margin-top: 6px; word-break: break-all;"><strong>Invite Link:</strong> <code>${inviteUrl}</code></div>
          </div>
        </div>
      `,
      ctaLabel: 'Accept Organization Invite',
      ctaUrl: inviteUrl,
      ctaAction: {
        type: 'accept_invite',
        token: params.inviteToken,
      },
      metadata: {
        inviteToken: params.inviteToken,
        organizationName: params.organizationName,
        recipientEmail: params.recipientEmail,
        recipientName: displayRecipient,
        role: params.role,
      },
    });

    return { inviteUrl, emailItem };
  },

  sendImportantUpdateEmail: (params: {
    recipient: User;
    category: EmailCategory;
    subject: string;
    heading: string;
    details: string;
    ctaLabel?: string;
    ctaAction?: OutboxEmailItem['ctaAction'];
  }): OutboxEmailItem | null => {
    const ext = getUserProfileExtensions(params.recipient.id);
    const prefs = ext.preferences || params.recipient.preferences || {};

    // Respect user's email notification preferences
    if (prefs.emailDigestFrequency === 'off') return null;
    if (params.category === 'TASK_ASSIGNED' && prefs.notifyOnTaskAssigned === false) return null;
    if (params.category === 'MENTION' && prefs.notifyOnMentions === false) return null;
    if (params.category === 'DIRECT_MESSAGE' && prefs.notifyOnDirectMessages === false) return null;

    return emailNotificationService.sendEmail({
      toEmail: params.recipient.email,
      toName: params.recipient.full_name || params.recipient.email,
      subject: `[Omni Flow] ${params.subject}`,
      category: params.category,
      preheader: params.details.slice(0, 110),
      bodyHtml: `
        <div style="font-family: Inter, sans-serif; line-height: 1.6;">
          <p style="font-size: 14px; font-weight: 700; margin-bottom: 6px;">${params.heading}</p>
          <p style="font-size: 13px;">${params.details}</p>
        </div>
      `,
      ctaLabel: params.ctaLabel || 'Open in Workspace',
      ctaAction: params.ctaAction,
    });
  },

  sendEmail: (payload: Omit<OutboxEmailItem, 'id' | 'status' | 'createdAt'>): OutboxEmailItem => {
    const newItem: OutboxEmailItem = {
      ...payload,
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `email_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      status: 'delivered',
      createdAt: new Date().toISOString(),
    };

    const current = loadOutbox();
    saveOutbox([newItem, ...current]);

    // Optional external webhook relay if configured in workspace settings
    if (typeof window !== 'undefined') {
      try {
        const customRelayUrl = localStorage.getItem('omni_email_webhook_url');
        if (customRelayUrl && customRelayUrl.startsWith('http')) {
          fetch(customRelayUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newItem),
          }).catch(() => {});
        }
      } catch (e) {}
    }

    return newItem;
  },
};

export default emailNotificationService;
