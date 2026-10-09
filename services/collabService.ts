import { supabase } from './supabaseService';
import { UserPresence, TaskComment, ChatMessage, User } from '../types';

export interface CollabCommentPayload {
  taskId: string;
  taskTitle: string;
  comment: TaskComment;
  sender: {
    id: string;
    name: string;
    avatar?: string;
  };
  mentionedUserIds: string[];
  assigneeId?: string;
}

export interface CollabTaskUpdatePayload {
  taskId: string;
  taskTitle: string;
  updates: Record<string, any>;
  actor: {
    id: string;
    name: string;
  };
}

export interface CollabUserStatusPayload {
  userId: string;
  userName: string;
  userEmail?: string;
  userAvatar?: string;
  availabilityStatus: 'available' | 'away' | 'busy';
  timestamp: string;
}

const ACTIVE_PRESENCES_STORAGE_KEY = 'omni_active_presences_v2';
const LAST_SEEN_STORAGE_KEY = 'omni_user_last_seen_v1';

export interface AccurateLastSeenInfo {
  isOnline: boolean;
  isAwayFromTab: boolean;
  statusLabel: string;
  lastSeenText: string;
  dotColorClass: string;
}

export const formatRelativeDuration = (timestampMs: number, nowMs = Date.now()): string => {
  const diffSec = Math.max(1, Math.floor((nowMs - timestampMs) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ${diffMin % 60}m ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
};

export const getStoredLastSeenForUser = (userId?: string, userEmail?: string): {
  lastActive?: string;
  tabHiddenSince?: string;
  isTabFocused?: boolean;
  organizationId?: string;
} | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LAST_SEEN_STORAGE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw);
    if (userId && map[userId]) return map[userId];
    if (userEmail && map[userEmail.toLowerCase()]) return map[userEmail.toLowerCase()];
  } catch {}
  return null;
};

export const formatAccurateLastSeen = (
  presence?: UserPresence | null,
  userId?: string,
  userEmail?: string,
  isSelf = false
): AccurateLastSeenInfo => {
  const now = Date.now();
  const stored = getStoredLastSeenForUser(userId || presence?.userId, userEmail || presence?.userEmail);

  if (isSelf && !presence) {
    return {
      isOnline: true,
      isAwayFromTab: false,
      statusLabel: 'Available',
      lastSeenText: 'Active now (This tab)',
      dotColorClass: 'bg-emerald-500',
    };
  }

  if (presence) {
    const avail = presence.availabilityStatus || 'available';
    const tabHiddenIso = presence.tabHiddenSince || (presence.isTabFocused === false ? presence.lastActive : undefined);
    const lastInteractionIso = presence.lastInteractionAt || presence.lastActive;
    const lastInteractionMs = lastInteractionIso ? new Date(lastInteractionIso).getTime() : now;
    const idleSec = Math.floor((now - lastInteractionMs) / 1000);

    // Check if user switched away from browser tab or has been idle on tab > 2 minutes
    const isTabAway = presence.isTabFocused === false && Boolean(tabHiddenIso);
    const tabAwayMs = tabHiddenIso ? new Date(tabHiddenIso).getTime() : now;
    const tabAwaySec = Math.max(1, Math.floor((now - tabAwayMs) / 1000));

    if (isTabAway && tabAwaySec >= 10) {
      return {
        isOnline: true,
        isAwayFromTab: true,
        statusLabel: 'Away from tab',
        lastSeenText: `Away from tab • Last seen ${formatRelativeDuration(tabAwayMs, now)}`,
        dotColorClass: 'bg-amber-400',
      };
    }

    if (idleSec >= 120 || avail === 'away') {
      return {
        isOnline: true,
        isAwayFromTab: true,
        statusLabel: 'Away',
        lastSeenText: `Idle • Last active ${formatRelativeDuration(lastInteractionMs, now)}`,
        dotColorClass: 'bg-amber-400',
      };
    }

    if (avail === 'busy') {
      return {
        isOnline: true,
        isAwayFromTab: false,
        statusLabel: 'Busy / DND',
        lastSeenText: 'Active now • Do Not Disturb',
        dotColorClass: 'bg-rose-500',
      };
    }

    return {
      isOnline: true,
      isAwayFromTab: false,
      statusLabel: 'Available',
      lastSeenText: idleSec < 25 ? 'Active right now' : `Active • ${idleSec}s ago`,
      dotColorClass: 'bg-emerald-500',
    };
  }

  // Offline user: check stored lastSeen timestamp
  if (stored?.lastActive) {
    const ms = new Date(stored.lastActive).getTime();
    if (!isNaN(ms)) {
      return {
        isOnline: false,
        isAwayFromTab: false,
        statusLabel: 'Offline',
        lastSeenText: `Last seen ${formatRelativeDuration(ms, now)}`,
        dotColorClass: 'bg-slate-400',
      };
    }
  }

  return {
    isOnline: false,
    isAwayFromTab: false,
    statusLabel: 'Offline',
    lastSeenText: 'Offline',
    dotColorClass: 'bg-slate-400',
  };
};

const normalizePriority = (raw?: string): string | undefined => {
  if (!raw) return undefined;
  const lower = String(raw).toLowerCase();
  if (lower === 'low') return 'Low';
  if (lower === 'medium') return 'Medium';
  if (lower === 'high') return 'High';
  if (lower === 'critical' || lower === 'urgent') return 'Critical';
  return raw;
};

class CollabService {
  private broadcastChannel: BroadcastChannel | null = null;
  private supabaseChannel: any = null;
  private dbChangesChannel: any = null;
  private isChannelSubscribed = false;
  private heartbeatTimer: any = null;
  private currentUser: User | null = null;
  private currentPresence: UserPresence | null = null;
  private onPresencesChangeCallbacks = new Set<(presences: UserPresence[]) => void>();
  private presencesMap = new Map<string, UserPresence>();
  private lastTrackedSignature = '';
  private lastTrackTime = 0;
  private trackTimer: ReturnType<typeof setTimeout> | null = null;
  private isTrackingInFlight = false;
  private readonly presenceTrackInterval = 15000;

  private lastBroadcastSignature = '';
  private lastBroadcastTime = 0;
  private broadcastTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly presenceBroadcastInterval = 600;

  private lastPresenceReplyTime = 0;
  private lastRequestRemoteTime = 0;
  private isTabFocused = true;
  private tabHiddenSince: string | undefined = undefined;
  private lastInteractionAt: string = new Date().toISOString();
  private lastActivityUpdateMs = 0;
  private recentCommentIds = new Set<string>();
  private recentTaskUpdates = new Map<string, number>();
  public readonly sessionId: string =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : 'sess_' + Math.random().toString(36).substring(2, 10);

  constructor() {
    this.hydrateStoredPresences();
    this.initBroadcastChannel();
    this.initSupabaseRealtime();
    this.initTabAndActivityTracking();
    this.startHeartbeat();
    this.initUnloadListener();
  }

  private persistUserLastSeen(p: UserPresence) {
    if (typeof window === 'undefined' || !p?.userId) return;
    try {
      const raw = localStorage.getItem(LAST_SEEN_STORAGE_KEY);
      const map = raw ? JSON.parse(raw) : {};
      const entry = {
        lastActive: p.lastInteractionAt || p.lastActive || new Date().toISOString(),
        tabHiddenSince: p.tabHiddenSince,
        isTabFocused: p.isTabFocused ?? true,
        organizationId: p.organizationId,
      };
      map[p.userId] = entry;
      if (p.userEmail) map[p.userEmail.toLowerCase()] = entry;
      localStorage.setItem(LAST_SEEN_STORAGE_KEY, JSON.stringify(map));
    } catch {}
  }

  private initTabAndActivityTracking() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const handleVisibilityOrFocusChange = (focused: boolean) => {
      const nowIso = new Date().toISOString();
      if (!focused) {
        if (this.isTabFocused) {
          this.isTabFocused = false;
          this.tabHiddenSince = nowIso;
          if (this.currentUser) {
            this.updatePresence();
          }
        }
      } else {
        this.isTabFocused = true;
        this.tabHiddenSince = undefined;
        this.lastInteractionAt = nowIso;
        this.lastActivityUpdateMs = Date.now();
        if (this.currentUser) {
          this.updatePresence();
        }
      }
    };

    document.addEventListener('visibilitychange', () => {
      handleVisibilityOrFocusChange(document.visibilityState === 'visible');
    });

    window.addEventListener('focus', () => handleVisibilityOrFocusChange(true));
    window.addEventListener('blur', () => {
      // If document is hidden or window blurred, mark tab unfocused
      if (document.visibilityState === 'hidden') {
        handleVisibilityOrFocusChange(false);
      } else {
        this.isTabFocused = false;
        this.tabHiddenSince = new Date().toISOString();
        if (this.currentUser) {
          this.updatePresence();
        }
      }
    });

    const recordUserInteraction = () => {
      const now = Date.now();
      if (!this.isTabFocused) {
        handleVisibilityOrFocusChange(true);
        return;
      }
      if (now - this.lastActivityUpdateMs > 10000) {
        this.lastActivityUpdateMs = now;
        this.lastInteractionAt = new Date(now).toISOString();
        if (this.currentPresence) {
          this.currentPresence.lastInteractionAt = this.lastInteractionAt;
          this.currentPresence.isTabFocused = true;
          this.currentPresence.tabHiddenSince = undefined;
          this.persistUserLastSeen(this.currentPresence);
        }
      }
    };

    window.addEventListener('mousemove', recordUserInteraction, { passive: true });
    window.addEventListener('keydown', recordUserInteraction, { passive: true });
    window.addEventListener('mousedown', recordUserInteraction, { passive: true });
    window.addEventListener('touchstart', recordUserInteraction, { passive: true });
  }

  private hydrateStoredPresences() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(ACTIVE_PRESENCES_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, UserPresence>;
      const now = Date.now();
      Object.entries(parsed).forEach(([key, pres]) => {
        if (pres && pres.userId && key !== this.sessionId && pres.sessionId !== this.sessionId) {
          const lastSeen = pres.lastSeenLocally || (pres.lastActive ? new Date(pres.lastActive).getTime() : 0);
          if (now - lastSeen < 60000) {
            this.presencesMap.set(key, pres);
          }
        }
      });
    } catch (e) {}
  }

  private persistActivePresencesToStorage() {
    if (typeof window === 'undefined') return;
    try {
      const now = Date.now();
      const mapObj: Record<string, UserPresence> = {};
      try {
        const existingRaw = localStorage.getItem(ACTIVE_PRESENCES_STORAGE_KEY);
        if (existingRaw) {
          const parsed = JSON.parse(existingRaw) as Record<string, UserPresence>;
          Object.entries(parsed).forEach(([k, v]) => {
            const lastSeen = v?.lastSeenLocally || (v?.lastActive ? new Date(v.lastActive).getTime() : 0);
            if (now - lastSeen < 60000) {
              mapObj[k] = v;
            }
          });
        }
      } catch (e) {}
      this.presencesMap.forEach((v, k) => {
        const lastSeen = v.lastSeenLocally || (v.lastActive ? new Date(v.lastActive).getTime() : now);
        if (now - lastSeen < 60000) {
          mapObj[k] = v;
        }
      });
      localStorage.setItem(ACTIVE_PRESENCES_STORAGE_KEY, JSON.stringify(mapObj));
    } catch (e) {}
  }

  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  public syncCurrentUser(user: User | null) {
    const prevId = this.currentUser?.id;
    this.currentUser = user;

    if (user) {
      this.updatePresence();
      if (user.id !== prevId) {
        this.requestRemotePresences();
      }
    }
  }

  public requestRemotePresences() {
    const now = Date.now();
    if (now - this.lastRequestRemoteTime < 5000) return;
    this.lastRequestRemoteTime = now;
    const reqPayload = {
      requesterSessionId: this.sessionId,
      requesterUserId: this.currentUser?.id,
      presence: this.currentPresence || undefined,
      ts: now,
    };
    this.emitLocalPacket('PRESENCE_REQUEST', reqPayload);
    this.sendBroadcast('collab_presence_request', reqPayload, false);
  }

  private canUseWebSocket(): boolean {
    if (!this.supabaseChannel || !this.isChannelSubscribed) return false;
    if (typeof this.supabaseChannel._canPush === 'function') {
      return this.supabaseChannel._canPush();
    }
    if (typeof this.supabaseChannel.canPush === 'function') {
      return this.supabaseChannel.canPush();
    }
    return this.supabaseChannel.state === 'joined' && Boolean(this.supabaseChannel.socket?.isConnected?.());
  }

  private getPresenceSignature(p: UserPresence | null): string {
    if (!p) return '';
    return [
      p.userId,
      p.organizationId || '',
      p.currentProjectId || '',
      p.currentView || '',
      p.availabilityStatus || 'available',
      p.isTabFocused === false ? '0' : '1',
    ].join('|');
  }

  private getTrackablePresence(p: UserPresence) {
    return {
      userId: p.userId,
      sessionId: p.sessionId,
      organizationId: p.organizationId,
      userName: p.userName,
      userEmail: p.userEmail,
      userAvatar: p.userAvatar,
      currentProjectId: p.currentProjectId,
      currentView: p.currentView,
      availabilityStatus: p.availabilityStatus,
      isTabFocused: p.isTabFocused,
      tabHiddenSince: p.tabHiddenSince,
      lastInteractionAt: p.lastInteractionAt,
      color: p.color,
    };
  }

  private getBroadcastSignature(p: UserPresence | null): string {
    if (!p) return '';
    return [
      p.userId,
      p.organizationId || '',
      p.currentTaskId || '',
      p.currentProjectId || '',
      p.currentView || '',
      p.isEditing ? 1 : 0,
      p.editingField || '',
      p.isTypingComment ? 1 : 0,
      p.availabilityStatus || 'available',
      p.isTabFocused === false ? 0 : 1,
      p.tabHiddenSince || '',
      p.statusAction || '',
    ].join('|');
  }

  private syncPresenceTrackThrottled(force = false) {
    if (
      !this.supabaseChannel ||
      !this.currentPresence ||
      !this.isChannelSubscribed ||
      !this.canUseWebSocket()
    ) {
      return;
    }

    const signature = this.getPresenceSignature(this.currentPresence);

    if (!force && signature === this.lastTrackedSignature) {
      return;
    }

    const now = Date.now();
    const elapsed = now - this.lastTrackTime;
    const delay = Math.max(0, this.presenceTrackInterval - elapsed);

    const performTrack = async () => {
      if (
        !this.supabaseChannel ||
        !this.currentPresence ||
        !this.isChannelSubscribed ||
        !this.canUseWebSocket() ||
        this.isTrackingInFlight
      ) {
        return;
      }

      const latestPresence = this.getTrackablePresence(this.currentPresence);
      const latestSignature = this.getPresenceSignature(this.currentPresence);

      if (!force && latestSignature === this.lastTrackedSignature) {
        return;
      }

      this.isTrackingInFlight = true;
      try {
        const res = await this.supabaseChannel.track(latestPresence);
        if (!res || res === 'ok' || res?.status === 'ok') {
          this.lastTrackedSignature = latestSignature;
          this.lastTrackTime = Date.now();
        }
      } catch (e) {
        // Leave lastTrackedSignature unchanged so trailing retry can succeed later
      } finally {
        this.isTrackingInFlight = false;
      }
    };

    if (delay === 0) {
      if (this.trackTimer) {
        clearTimeout(this.trackTimer);
        this.trackTimer = null;
      }
      void performTrack();
    } else if (!this.trackTimer) {
      this.trackTimer = setTimeout(() => {
        this.trackTimer = null;
        void performTrack();
      }, delay + 50);
    }
  }

  private syncPresenceBroadcastThrottled(force = false) {
    if (!this.currentPresence) return;

    const sig = this.getBroadcastSignature(this.currentPresence);
    const now = Date.now();
    if (!force && sig === this.lastBroadcastSignature && now - this.lastBroadcastTime < 12000) {
      return;
    }

    const elapsed = now - this.lastBroadcastTime;
    const delay = force ? 0 : Math.max(0, this.presenceBroadcastInterval - elapsed);

    const performBroadcast = () => {
      if (!this.currentPresence) return;
      const latestSig = this.getBroadcastSignature(this.currentPresence);
      const currentNow = Date.now();
      if (!force && latestSig === this.lastBroadcastSignature && currentNow - this.lastBroadcastTime < 12000) {
        return;
      }
      this.lastBroadcastSignature = latestSig;
      this.lastBroadcastTime = currentNow;
      this.sendBroadcast('collab_presence', this.currentPresence, false);
    };

    if (delay === 0) {
      if (this.broadcastTimer) {
        clearTimeout(this.broadcastTimer);
        this.broadcastTimer = null;
      }
      performBroadcast();
    } else if (!this.broadcastTimer) {
      this.broadcastTimer = setTimeout(() => {
        this.broadcastTimer = null;
        performBroadcast();
      }, delay);
    }
  }

  private initBroadcastChannel() {
    if (typeof window === 'undefined') return;
    try {
      if ('BroadcastChannel' in window) {
        this.broadcastChannel = new BroadcastChannel('omni_collab_sync');
        this.broadcastChannel.onmessage = (event) => {
          const { type, payload } = event.data || {};
          this.handleIncomingEvent(type, payload);
        };
      }
      window.addEventListener('storage', (event) => {
        if (event.key === 'omni_collab_realtime_pkt' && event.newValue) {
          try {
            const parsed = JSON.parse(event.newValue);
            if (parsed && parsed.sessionId !== this.sessionId) {
              this.handleIncomingEvent(parsed.type, parsed.payload);
            }
          } catch (e) {}
        } else if (event.key === ACTIVE_PRESENCES_STORAGE_KEY && event.newValue) {
          this.hydrateStoredPresences();
          this.notifyPresencesChange();
        }
      });
    } catch (e) {
      console.warn('BroadcastChannel initialization error:', e);
    }
  }

  private initSupabaseRealtime() {
    if (typeof window === 'undefined') return;
    try {
      // 1. Pure broadcast + presence channel (no postgres_changes so subscription never stalls)
      this.supabaseChannel = supabase.channel('omni_flow_collab_hub', {
        config: {
          presence: {
            key: this.sessionId,
          },
          broadcast: { self: false }
        }
      });

      this.supabaseChannel
        .on('presence', { event: 'sync' }, () => {
          if (!this.supabaseChannel) return;
          const state = this.supabaseChannel.presenceState();
          const now = Date.now();

          Object.values(state).forEach((presList: any) => {
            if (Array.isArray(presList)) {
              presList.forEach((pres: any) => {
                if (pres && pres.userId && pres.sessionId !== this.sessionId) {
                  const key = pres.sessionId || pres.userId;
                  const existing = this.presencesMap.get(key);
                  this.presencesMap.set(key, {
                    ...existing,
                    ...(pres as UserPresence),
                    currentTaskId: existing?.currentTaskId,
                    isEditing: existing?.isEditing,
                    editingField: existing?.editingField,
                    isTypingComment: existing?.isTypingComment,
                    statusAction: existing?.statusAction,
                    lastSeenLocally: now,
                  });
                }
              });
            }
          });

          this.notifyPresencesChange();
        })
        .on('presence', { event: 'join' }, ({ newPresences }: any) => {
          const now = Date.now();
          let joinedOther = false;
          if (Array.isArray(newPresences)) {
            newPresences.forEach((pres: any) => {
              if (pres && pres.userId && pres.sessionId !== this.sessionId) {
                const key = pres.sessionId || pres.userId;
                const existing = this.presencesMap.get(key);
                this.presencesMap.set(key, {
                  ...existing,
                  ...(pres as UserPresence),
                  currentTaskId: existing?.currentTaskId,
                  isEditing: existing?.isEditing,
                  editingField: existing?.editingField,
                  isTypingComment: existing?.isTypingComment,
                  statusAction: existing?.statusAction,
                  lastSeenLocally: now,
                });
                joinedOther = true;
              }
            });
            if (joinedOther) {
              this.notifyPresencesChange();
            }
          }
          if (joinedOther && this.currentPresence && now - this.lastPresenceReplyTime > 4000) {
            this.lastPresenceReplyTime = now;
            this.sendBroadcast('collab_presence', this.currentPresence, false);
          }
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }: any) => {
          if (Array.isArray(leftPresences)) {
            leftPresences.forEach((pres: any) => {
              if (pres && (pres.sessionId || pres.userId)) {
                const key = pres.sessionId || pres.userId;
                this.presencesMap.delete(key);
              }
            });
            this.notifyPresencesChange();
          }
        })
        .on('broadcast', { event: 'collab_presence' }, ({ payload }: { payload: UserPresence }) => {
          this.ingestRemotePresence(payload);
        })
        .on('broadcast', { event: 'collab_presence_request' }, ({ payload }: any) => {
          if (payload?.presence) {
            this.ingestRemotePresence(payload.presence);
          }
          const now = Date.now();
          if (payload?.requesterSessionId !== this.sessionId && this.currentPresence && now - this.lastPresenceReplyTime > 4000) {
            this.lastPresenceReplyTime = now;
            this.sendBroadcast('collab_presence', this.currentPresence, false);
          }
        })
        .on('broadcast', { event: 'collab_leave' }, ({ payload }: { payload: { userId: string; sessionId?: string } }) => {
          if (payload) {
            if (payload.sessionId) {
              this.presencesMap.delete(payload.sessionId);
            } else if (payload.userId) {
              this.presencesMap.delete(payload.userId);
            }
            this.notifyPresencesChange();
          }
        })
        .on('broadcast', { event: 'task_comment_added' }, ({ payload }: { payload: CollabCommentPayload }) => {
          this.handleTaskCommentAdded(payload);
        })
        .on('broadcast', { event: 'task_comment_updated' }, ({ payload }: any) => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('omni_task_comment_updated', { detail: payload }));
          }
        })
        .on('broadcast', { event: 'task_comment_deleted' }, ({ payload }: any) => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('omni_task_comment_deleted', { detail: payload }));
          }
        })
        .on('broadcast', { event: 'task_updated' }, ({ payload }: { payload: CollabTaskUpdatePayload }) => {
          this.handleTaskUpdated(payload);
        })
        .on('broadcast', { event: 'task_created' }, ({ payload }: any) => {
          if (typeof window !== 'undefined' && payload) {
            window.dispatchEvent(new CustomEvent('omni_remote_task_created', { detail: payload }));
          }
        })
        .on('broadcast', { event: 'task_deleted' }, ({ payload }: any) => {
          if (typeof window !== 'undefined' && payload) {
            window.dispatchEvent(new CustomEvent('omni_remote_task_deleted', { detail: payload }));
          }
        })
        .on('broadcast', { event: 'user_status_changed' }, ({ payload }: { payload: CollabUserStatusPayload }) => {
          this.handleUserStatusChanged(payload);
        })
        .on('broadcast', { event: 'chat_message_notification' }, ({ payload }: { payload: ChatMessage }) => {
          this.handleChatMessageNotification(payload);
        })
        .on('broadcast', { event: 'team_member_updated' }, ({ payload }: any) => {
          if (typeof window !== 'undefined' && payload) {
            window.dispatchEvent(new CustomEvent('omni_remote_team_member_updated', { detail: payload }));
          }
        })
        .on('broadcast', { event: 'team_member_removed' }, ({ payload }: any) => {
          if (typeof window !== 'undefined' && payload) {
            window.dispatchEvent(new CustomEvent('omni_remote_team_member_removed', { detail: payload }));
          }
        })
        .subscribe((status: string) => {
          this.isChannelSubscribed = status === 'SUBSCRIBED';
          if (status === 'SUBSCRIBED') {
            if (this.currentPresence) {
              this.syncPresenceTrackThrottled();
              this.syncPresenceBroadcastThrottled(true);
            }
            this.requestRemotePresences();
          }
        });

      // 2. Separate channel for database table changes so RLS/publication config never blocks realtime broadcasts
      this.dbChangesChannel = supabase.channel('omni_flow_db_changes_hub');
      this.dbChangesChannel
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_comments' }, async (payload: any) => {
          const newComment = payload.new;
          if (!newComment || !newComment.task_id) return;
          if (newComment.user_id === this.currentUser?.id) return;
          if (newComment.id && this.recentCommentIds.has(newComment.id)) return;

          let senderName = 'Teammate';
          let senderAvatar: string | undefined = undefined;
          try {
            const { data: prof } = await supabase.from('user_profiles').select('*').eq('id', newComment.user_id).single();
            if (prof) {
              senderName = prof.full_name || prof.email || 'Teammate';
              senderAvatar = prof.avatar_url;
            }
          } catch (e) {}

          let taskTitle = 'Task';
          let assigneeId: string | undefined = undefined;
          try {
            const { data: taskData } = await supabase.from('tasks').select('title, assignee_id').eq('id', newComment.task_id).single();
            if (taskData) {
              taskTitle = taskData.title;
              assigneeId = taskData.assignee_id;
            }
          } catch (e) {}

          const fullComment = {
            ...newComment,
            user: {
              id: newComment.user_id,
              full_name: senderName,
              avatar_url: senderAvatar
            }
          };

          this.handleTaskCommentAdded({
            taskId: newComment.task_id,
            taskTitle,
            comment: fullComment,
            sender: {
              id: newComment.user_id,
              name: senderName,
              avatar: senderAvatar
            },
            mentionedUserIds: [],
            assigneeId
          });
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks' }, (payload: any) => {
          const updatedRow = payload.new;
          if (!updatedRow || !updatedRow.id) return;
          const lastHandled = this.recentTaskUpdates.get(updatedRow.id) || 0;
          if (Date.now() - lastHandled < 3000) return;

          const mappedUpdates: Record<string, any> = {
            ...updatedRow,
            projectId: updatedRow.project_id || updatedRow.projectId,
            dueDate: updatedRow.due_date || updatedRow.dueDate,
            sprintId: updatedRow.sprint_id || updatedRow.sprintId,
          };
          if (mappedUpdates.priority) {
            mappedUpdates.priority = normalizePriority(mappedUpdates.priority);
          }
          this.handleTaskUpdated({
            taskId: updatedRow.id,
            taskTitle: updatedRow.title || 'Task',
            updates: mappedUpdates,
            actor: { id: 'remote', name: 'Teammate' }
          });
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_profiles' }, (payload: any) => {
          const updatedProfile = payload.new;
          if (!updatedProfile || !updatedProfile.id) return;
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('omni_remote_team_member_updated', {
              detail: {
                userId: updatedProfile.id,
                updates: updatedProfile,
                actor: { id: 'remote', name: 'Workspace Admin' }
              }
            }));
          }
        })
        .subscribe();
    } catch (err) {
      console.warn('Failed initializing Supabase collab hub:', err);
    }
  }

  public ingestRemotePresence(payload: UserPresence) {
    if (!payload || !payload.userId || payload.sessionId === this.sessionId) return;
    const key = payload.sessionId || payload.userId;
    const enriched: UserPresence = { ...payload, lastSeenLocally: Date.now() };
    this.presencesMap.set(key, enriched);
    this.persistUserLastSeen(enriched);
    this.persistActivePresencesToStorage();
    this.notifyPresencesChange();
  }

  public ingestRemoteEventFromBridge(event: string, payload: any) {
    if (!event) return;
    if (event === 'collab_presence') {
      this.ingestRemotePresence(payload);
    } else if (event === 'collab_presence_request') {
      if (payload?.presence) {
        this.ingestRemotePresence(payload.presence);
      }
      const now = Date.now();
      if (payload?.requesterSessionId !== this.sessionId && this.currentPresence && now - this.lastPresenceReplyTime > 2500) {
        this.lastPresenceReplyTime = now;
        this.sendBroadcast('collab_presence', this.currentPresence, false);
      }
    } else if (event === 'user_status_changed') {
      this.handleUserStatusChanged(payload);
    } else if (event === 'task_updated') {
      this.handleTaskUpdated(payload);
    } else if (event === 'task_comment_added') {
      this.handleTaskCommentAdded(payload);
    }
  }

  private sendBroadcast(event: string, payload: any, allowHttpFallback = true) {
    if (!this.supabaseChannel) return;
    try {
      if (this.canUseWebSocket()) {
        this.supabaseChannel.send({
          type: 'broadcast',
          event,
          payload
        }).catch(() => {});
      } else if (allowHttpFallback && typeof this.supabaseChannel.httpSend === 'function') {
        this.supabaseChannel.httpSend(event, payload).catch(() => {});
      }
    } catch (e) {}
  }

  private handleIncomingEvent(type: string, payload: any) {
    if (!type) return;

    if (type === 'PRESENCE_BROADCAST' && payload) {
      this.ingestRemotePresence(payload as UserPresence);
    } else if (type === 'PRESENCE_REQUEST' && payload) {
      if (payload.presence) {
        this.ingestRemotePresence(payload.presence as UserPresence);
      }
      if (payload.requesterSessionId !== this.sessionId && this.currentPresence) {
        this.emitLocalPacket('PRESENCE_BROADCAST', this.currentPresence);
        this.syncPresenceBroadcastThrottled();
      }
    } else if (type === 'PRESENCE_LEAVE' && payload) {
      if (payload.sessionId) {
        this.presencesMap.delete(payload.sessionId);
      } else if (payload.userId) {
        this.presencesMap.delete(payload.userId);
      }
      this.notifyPresencesChange();
    } else if (type === 'TASK_COMMENT_ADDED' && payload) {
      this.handleTaskCommentAdded(payload);
    } else if (type === 'TASK_COMMENT_UPDATED' && payload) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('omni_task_comment_updated', { detail: payload }));
      }
    } else if (type === 'TASK_COMMENT_DELETED' && payload) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('omni_task_comment_deleted', { detail: payload }));
      }
    } else if (type === 'TASK_UPDATED' && payload) {
      this.handleTaskUpdated(payload);
    } else if (type === 'TASK_CREATED' && payload) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('omni_remote_task_created', { detail: payload }));
      }
    } else if (type === 'TASK_DELETED' && payload) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('omni_remote_task_deleted', { detail: payload }));
      }
    } else if (type === 'USER_STATUS_CHANGED' && payload) {
      this.handleUserStatusChanged(payload);
    } else if (type === 'CHAT_NOTIFICATION' && payload) {
      this.handleChatMessageNotification(payload);
    } else if (type === 'TEAM_MEMBER_UPDATED' && payload) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('omni_remote_team_member_updated', { detail: payload }));
      }
    } else if (type === 'TEAM_MEMBER_REMOVED' && payload) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('omni_remote_team_member_removed', { detail: payload }));
      }
    }
  }

  private handleTaskCommentAdded(payload: CollabCommentPayload) {
    if (!payload || !payload.comment) return;
    if (payload.comment.id) {
      if (this.recentCommentIds.has(payload.comment.id)) return;
      this.recentCommentIds.add(payload.comment.id);
      if (this.recentCommentIds.size > 200) {
        const first = this.recentCommentIds.values().next().value;
        if (first) this.recentCommentIds.delete(first);
      }
    }

    // Mark sender as online right now
    if (payload.sender?.id) {
      this.recordUserActive(payload.sender.id, payload.sender.name, payload.sender.avatar);
    }

    // Dispatch custom event for TaskDetailsModal to append the comment in real-time
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('omni_task_comment_added', {
        detail: {
          taskId: payload.taskId,
          comment: payload.comment,
        }
      }));

      // Dispatch event for App notifications/toasts
      window.dispatchEvent(new CustomEvent('omni_remote_comment_notification', {
        detail: payload
      }));
    }
  }

  private handleTaskUpdated(payload: CollabTaskUpdatePayload) {
    if (!payload || !payload.taskId) return;
    this.recentTaskUpdates.set(payload.taskId, Date.now());

    // Mark actor as online
    if (payload.actor?.id && payload.actor.id !== 'remote') {
      this.recordUserActive(payload.actor.id, payload.actor.name);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('omni_remote_task_updated', { detail: payload }));
    }
  }

  private handleChatMessageNotification(message: ChatMessage) {
    if (!message || !message.sender_id) return;

    // Mark sender as online
    this.recordUserActive(message.sender_id, message.sender_name, message.sender_avatar);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('omni_remote_chat_notification', { detail: message }));
    }
  }

  private handleUserStatusChanged(payload: CollabUserStatusPayload) {
    if (!payload || !payload.userId) return;

    // Update all matching presence entries for this user
    let found = false;
    this.presencesMap.forEach((val, key) => {
      if (
        val.userId === payload.userId ||
        (payload.userEmail && val.userEmail && val.userEmail.toLowerCase() === payload.userEmail.toLowerCase()) ||
        (payload.userName && val.userName && val.userName.toLowerCase() === payload.userName.toLowerCase())
      ) {
        this.presencesMap.set(key, {
          ...val,
          userName: payload.userName || val.userName,
          userEmail: payload.userEmail || val.userEmail,
          userAvatar: payload.userAvatar || val.userAvatar,
          availabilityStatus: payload.availabilityStatus,
          lastActive: new Date().toISOString(),
          lastSeenLocally: Date.now(),
        });
        found = true;
      }
    });

    if (!found) {
      this.presencesMap.set(payload.userId, {
        userId: payload.userId,
        sessionId: payload.userId,
        userName: payload.userName || 'Teammate',
        userEmail: payload.userEmail,
        userAvatar: payload.userAvatar,
        availabilityStatus: payload.availabilityStatus,
        lastActive: new Date().toISOString(),
        lastSeenLocally: Date.now(),
        color: '#6366f1',
      });
    }

    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('omni_team_statuses');
        const map = raw ? JSON.parse(raw) : {};
        map[payload.userId] = payload.availabilityStatus;
        if (payload.userEmail) map[payload.userEmail.toLowerCase()] = payload.availabilityStatus;
        localStorage.setItem('omni_team_statuses', JSON.stringify(map));
      } catch (e) {}

      window.dispatchEvent(new CustomEvent('omni_remote_user_status_changed', { detail: payload }));
    }

    this.persistActivePresencesToStorage();
    this.notifyPresencesChange();
  }

  private emitLocalPacket(type: string, payload: any) {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type, payload });
      } catch (e) {}
    }
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          'omni_collab_realtime_pkt',
          JSON.stringify({ type, payload, sessionId: this.sessionId, ts: Date.now() })
        );
      } catch (e) {}
    }
  }

  public recordUserActive(userId: string, userName?: string, userAvatar?: string, userEmail?: string) {
    if (!userId) return;

    // Find any existing session for this userId
    let existingKey = userId;
    let existing: UserPresence | undefined = this.presencesMap.get(userId);
    if (!existing) {
      this.presencesMap.forEach((val, key) => {
        if (val.userId === userId || (userEmail && val.userEmail && val.userEmail.toLowerCase() === userEmail.toLowerCase())) {
          existingKey = key;
          existing = val;
        }
      });
    }

    const updated: UserPresence = {
      userId,
      sessionId: existing?.sessionId || userId,
      userName: userName || existing?.userName || 'Teammate',
      userEmail: userEmail || existing?.userEmail,
      userAvatar: userAvatar || existing?.userAvatar,
      currentTaskId: existing?.currentTaskId,
      currentProjectId: existing?.currentProjectId,
      currentView: existing?.currentView,
      isEditing: existing?.isEditing || false,
      editingField: existing?.editingField,
      isTypingComment: existing?.isTypingComment || false,
      availabilityStatus: existing?.availabilityStatus || 'available',
      lastActive: new Date().toISOString(),
      lastSeenLocally: Date.now(),
      color: existing?.color || '#6366f1',
    };

    this.presencesMap.set(existingKey, updated);
    this.persistActivePresencesToStorage();
    this.notifyPresencesChange();
  }

  public updatePresence(
    taskId?: string,
    view?: string,
    flags?: {
      isEditing?: boolean;
      editingField?: string;
      isTypingComment?: boolean;
      statusAction?: string;
      availabilityStatus?: 'available' | 'away' | 'busy';
      projectId?: string;
      clearTask?: boolean;
    }
  ) {
    if (!this.currentUser) return;

    const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#14b8a6', '#f97316'];
    const userColor = colors[Math.abs(this.currentUser.id.charCodeAt(0) + (this.currentUser.id.charCodeAt(1) || 0)) % colors.length];

    const resolvedTaskId = flags?.clearTask
      ? undefined
      : (taskId !== undefined ? taskId : this.currentPresence?.currentTaskId);

    let savedAvailability: 'available' | 'away' | 'busy' = 'available';
    if (typeof window !== 'undefined') {
      try {
        const mapRaw = localStorage.getItem('omni_team_statuses');
        const map = mapRaw ? JSON.parse(mapRaw) : {};
        if (map[this.currentUser.id]) {
          savedAvailability = map[this.currentUser.id];
        }
      } catch (e) {}
    }

    const resolvedAvailability =
      flags?.availabilityStatus ?? this.currentPresence?.availabilityStatus ?? savedAvailability;

    if (flags?.availabilityStatus && typeof window !== 'undefined') {
      try {
        const mapRaw = localStorage.getItem('omni_team_statuses');
        const map = mapRaw ? JSON.parse(mapRaw) : {};
        map[this.currentUser.id] = flags.availabilityStatus;
        if (this.currentUser.email) map[this.currentUser.email.toLowerCase()] = flags.availabilityStatus;
        localStorage.setItem('omni_team_statuses', JSON.stringify(map));
      } catch (e) {}
    }

    this.currentPresence = {
      userId: this.currentUser.id,
      sessionId: this.sessionId,
      organizationId: this.currentUser.organization_id,
      userName: this.currentUser.full_name || this.currentUser.email || 'You',
      userEmail: this.currentUser.email,
      userAvatar: this.currentUser.avatar_url,
      currentTaskId: resolvedTaskId,
      currentProjectId: flags?.projectId ?? this.currentPresence?.currentProjectId,
      currentView: view ?? this.currentPresence?.currentView,
      isEditing: resolvedTaskId ? (flags?.isEditing !== undefined ? flags.isEditing : (this.currentPresence?.isEditing || false)) : false,
      editingField: resolvedTaskId ? (flags?.editingField !== undefined ? flags.editingField : this.currentPresence?.editingField) : undefined,
      isTypingComment: resolvedTaskId ? (flags?.isTypingComment !== undefined ? flags.isTypingComment : (this.currentPresence?.isTypingComment || false)) : false,
      statusAction: flags?.statusAction ?? this.currentPresence?.statusAction,
      availabilityStatus: resolvedAvailability,
      isTabFocused: this.isTabFocused,
      tabHiddenSince: this.tabHiddenSince,
      lastInteractionAt: this.lastInteractionAt,
      lastActive: new Date().toISOString(),
      lastSeenLocally: Date.now(),
      color: userColor,
    };

    // Keep self in map under this tab's sessionId
    this.presencesMap.set(this.sessionId, this.currentPresence);
    this.persistUserLastSeen(this.currentPresence);
    this.persistActivePresencesToStorage();
    this.notifyPresencesChange();

    // Broadcast across tabs & windows
    this.emitLocalPacket('PRESENCE_BROADCAST', this.currentPresence);

    // 1. Track only slowly-changing session state in Supabase Presence (15s trailing throttle)
    this.syncPresenceTrackThrottled();

    // 2. Broadcast fast-changing collaborative activity via lightweight Supabase Broadcast
    this.syncPresenceBroadcastThrottled();
  }

  public broadcastUserStatusChanged(availabilityStatus: 'available' | 'away' | 'busy') {
    if (!this.currentUser) return;
    const payload: CollabUserStatusPayload = {
      userId: this.currentUser.id,
      userName: this.currentUser.full_name || this.currentUser.email || 'Teammate',
      userEmail: this.currentUser.email,
      userAvatar: this.currentUser.avatar_url,
      availabilityStatus,
      timestamp: new Date().toISOString(),
    };
    this.updatePresence(undefined, undefined, {
      availabilityStatus,
      statusAction: `status_${availabilityStatus}`,
    });
    this.emitLocalPacket('USER_STATUS_CHANGED', payload);
    this.sendBroadcast('user_status_changed', payload, true);
  }

  public broadcastCommentAdded(payload: CollabCommentPayload) {
    if (payload?.comment?.id) {
      this.recentCommentIds.add(payload.comment.id);
    }
    this.emitLocalPacket('TASK_COMMENT_ADDED', payload);
    this.sendBroadcast('task_comment_added', payload, true);
  }

  public broadcastCommentUpdated(taskId: string, commentId: string, content: string) {
    const payload = { taskId, commentId, content };
    this.emitLocalPacket('TASK_COMMENT_UPDATED', payload);
    this.sendBroadcast('task_comment_updated', payload, true);
  }

  public broadcastCommentDeleted(taskId: string, commentId: string) {
    const payload = { taskId, commentId };
    this.emitLocalPacket('TASK_COMMENT_DELETED', payload);
    this.sendBroadcast('task_comment_deleted', payload, true);
  }

  public broadcastTaskUpdated(payload: CollabTaskUpdatePayload) {
    if (payload?.taskId) {
      this.recentTaskUpdates.set(payload.taskId, Date.now());
    }
    this.emitLocalPacket('TASK_UPDATED', payload);
    this.sendBroadcast('task_updated', payload, true);
  }

  public broadcastTaskCreated(task: any, actor: { id: string; name: string }) {
    const payload = { task, actor };
    this.emitLocalPacket('TASK_CREATED', payload);
    this.sendBroadcast('task_created', payload, true);
  }

  public broadcastTaskDeleted(taskId: string, taskTitle: string, actor: { id: string; name: string }) {
    const payload = { taskId, taskTitle, actor };
    this.emitLocalPacket('TASK_DELETED', payload);
    this.sendBroadcast('task_deleted', payload, true);
  }

  public broadcastChatNotification(message: ChatMessage) {
    this.emitLocalPacket('CHAT_NOTIFICATION', message);
    this.sendBroadcast('chat_message_notification', message, true);
  }

  public broadcastTeamMemberUpdated(payload: { userId: string; userName?: string; updates: Record<string, any>; actor: { id: string; name: string } }) {
    this.emitLocalPacket('TEAM_MEMBER_UPDATED', payload);
    this.sendBroadcast('team_member_updated', payload, true);
  }

  public broadcastTeamMemberRemoved(payload: { userId: string; userName?: string; actor: { id: string; name: string } }) {
    this.emitLocalPacket('TEAM_MEMBER_REMOVED', payload);
    this.sendBroadcast('team_member_removed', payload, true);
  }

  public onPresencesChange(callback: (presences: UserPresence[]) => void): () => void {
    this.onPresencesChangeCallbacks.add(callback);
    callback(this.getActivePresences());
    return () => {
      this.onPresencesChangeCallbacks.delete(callback);
    };
  }

  public getActivePresences(): UserPresence[] {
    // Security: If the current user is not authenticated or does not belong to an organization yet,
    // never expose online presences of other users.
    const myOrgId = this.currentUser?.organization_id;
    if (!this.currentUser || !myOrgId) {
      return this.currentPresence ? [this.currentPresence] : [];
    }

    const now = Date.now();
    const active: UserPresence[] = [];

    this.presencesMap.forEach((p, key) => {
      if (key === this.sessionId || p.sessionId === this.sessionId) {
        active.push(p);
        return;
      }
      // Enforce strict organization isolation: if the remote presence has an organizationId,
      // it MUST match the current user's organizationId.
      if (p.organizationId && p.organizationId !== myOrgId) {
        return;
      }
      const lastSeen = p.lastSeenLocally || (p.lastActive ? new Date(p.lastActive).getTime() : now);
      const age = now - lastSeen;
      // Keep user visible as active if seen within last 90 seconds
      if (age < 90000) {
        active.push(p);
      }
    });

    return active;
  }

  private notifyPresencesChange() {
    const list = this.getActivePresences();
    this.onPresencesChangeCallbacks.forEach(cb => cb(list));
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();

      // Clean expired remote presences (> 90s)
      let changed = false;
      this.presencesMap.forEach((p, key) => {
        if (key === this.sessionId || p.sessionId === this.sessionId) return;
        const lastSeen = p.lastSeenLocally || (p.lastActive ? new Date(p.lastActive).getTime() : now);
        const age = now - lastSeen;
        if (age >= 90000) {
          this.presencesMap.delete(key);
          changed = true;
        }
      });

      if (changed) {
        this.notifyPresencesChange();
      }

      // Lightweight keep-alive broadcast (without calling .track() repeatedly so we never hit Supabase presence rate limits)
      if (this.currentUser && this.currentPresence) {
        this.currentPresence.lastActive = new Date(now).toISOString();
        this.currentPresence.lastSeenLocally = now;
        this.presencesMap.set(this.sessionId, this.currentPresence);
        this.persistActivePresencesToStorage();
        if (this.broadcastChannel) {
          try {
            this.broadcastChannel.postMessage({
              type: 'PRESENCE_BROADCAST',
              payload: this.currentPresence
            });
          } catch (e) {}
        }
        if (this.supabaseChannel && this.canUseWebSocket()) {
          this.lastBroadcastTime = now;
          this.sendBroadcast('collab_presence', this.currentPresence, false);
        }
      }
    }, 15000);
  }

  private initUnloadListener() {
    if (typeof window === 'undefined') return;
    window.addEventListener('beforeunload', () => {
      if (!this.currentUser) return;
      const userId = this.currentUser.id;
      if (this.broadcastChannel) {
        try {
          this.broadcastChannel.postMessage({ type: 'PRESENCE_LEAVE', payload: { userId, sessionId: this.sessionId } });
        } catch (e) {}
      }
      if (this.supabaseChannel && this.canUseWebSocket()) {
        try {
          this.sendBroadcast('collab_leave', { userId, sessionId: this.sessionId }, false);
        } catch (e) {}
      }
    });
  }
}

export const collabService = new CollabService();
export default collabService;
