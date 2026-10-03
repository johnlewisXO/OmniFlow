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

class CollabService {
  private broadcastChannel: BroadcastChannel | null = null;
  private supabaseChannel: any = null;
  private isChannelSubscribed = false;
  private heartbeatTimer: any = null;
  private currentUser: User | null = null;
  private currentPresence: UserPresence | null = null;
  private onPresencesChangeCallbacks = new Set<(presences: UserPresence[]) => void>();
  private presencesMap = new Map<string, UserPresence>();
  public readonly sessionId: string =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : 'sess_' + Math.random().toString(36).substring(2, 10);

  constructor() {
    this.initBroadcastChannel();
    this.initSupabaseRealtime();
    this.startHeartbeat();
    this.initUnloadListener();
  }

  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  public syncCurrentUser(user: User | null) {
    const prevId = this.currentUser?.id;
    this.currentUser = user;

    if (user && user.id !== prevId) {
      this.updatePresence();
      if (this.supabaseChannel && this.canUseWebSocket() && this.currentPresence) {
        try {
          this.supabaseChannel.track(this.currentPresence).catch(() => {});
        } catch (e) {}
      }
    }
  }

  private canUseWebSocket(): boolean {
    if (!this.supabaseChannel || !this.isChannelSubscribed) return false;
    if (typeof this.supabaseChannel.canPush === 'function') {
      return this.supabaseChannel.canPush();
    }
    return this.supabaseChannel.state === 'joined';
  }

  private initBroadcastChannel() {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    try {
      this.broadcastChannel = new BroadcastChannel('omni_collab_sync');
      this.broadcastChannel.onmessage = (event) => {
        const { type, payload } = event.data || {};
        this.handleIncomingEvent(type, payload);
      };
    } catch (e) {
      console.warn('BroadcastChannel initialization error:', e);
    }
  }

  private initSupabaseRealtime() {
    if (typeof window === 'undefined') return;
    try {
      this.supabaseChannel = supabase.channel('omni_flow_collab_hub', {
        config: {
          presence: {
            key: this.sessionId,
          },
          broadcast: { self: false }
        }
      });

      this.supabaseChannel
        // Handle presence sync from Supabase
        .on('presence', { event: 'sync' }, () => {
          if (!this.supabaseChannel) return;
          const state = this.supabaseChannel.presenceState();
          const now = Date.now();

          Object.values(state).forEach((presList: any) => {
            if (Array.isArray(presList)) {
              presList.forEach((pres: any) => {
                if (pres && pres.userId && pres.sessionId !== this.sessionId) {
                  const key = pres.sessionId || pres.userId;
                  this.presencesMap.set(key, { ...(pres as UserPresence), lastSeenLocally: now });
                }
              });
            }
          });

          this.notifyPresencesChange();
        })
        .on('presence', { event: 'join' }, ({ newPresences }: any) => {
          const now = Date.now();
          if (Array.isArray(newPresences)) {
            newPresences.forEach((pres: any) => {
              if (pres && pres.userId && pres.sessionId !== this.sessionId) {
                const key = pres.sessionId || pres.userId;
                this.presencesMap.set(key, { ...(pres as UserPresence), lastSeenLocally: now });
              }
            });
            this.notifyPresencesChange();
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
        // Broadcast events
        .on('broadcast', { event: 'collab_presence' }, ({ payload }: { payload: UserPresence }) => {
          if (payload && payload.userId && payload.sessionId !== this.sessionId) {
            const key = payload.sessionId || payload.userId;
            this.presencesMap.set(key, { ...payload, lastSeenLocally: Date.now() });
            this.notifyPresencesChange();
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
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_comments' }, async (payload: any) => {
          const newComment = payload.new;
          if (!newComment || !newComment.task_id) return;
          if (newComment.user_id === this.currentUser?.id) return;

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
        .on('broadcast', { event: 'chat_message_notification' }, ({ payload }: { payload: ChatMessage }) => {
          this.handleChatMessageNotification(payload);
        })
        .subscribe((status: string) => {
          this.isChannelSubscribed = status === 'SUBSCRIBED';
          if (status === 'SUBSCRIBED' && this.currentPresence) {
            if (this.canUseWebSocket()) {
              this.supabaseChannel.track(this.currentPresence).catch(() => {});
            }
            this.sendBroadcast('collab_presence', this.currentPresence, true);
          }
        });
    } catch (err) {
      console.warn('Failed initializing Supabase collab hub:', err);
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
      const pres = payload as UserPresence;
      if (pres.sessionId !== this.sessionId) {
        const key = pres.sessionId || pres.userId;
        this.presencesMap.set(key, { ...pres, lastSeenLocally: Date.now() });
        this.notifyPresencesChange();
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
    } else if (type === 'CHAT_NOTIFICATION' && payload) {
      this.handleChatMessageNotification(payload);
    }
  }

  private handleTaskCommentAdded(payload: CollabCommentPayload) {
    if (!payload || !payload.comment) return;

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

    // Mark actor as online
    if (payload.actor?.id) {
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

  public recordUserActive(userId: string, userName?: string, userAvatar?: string) {
    if (!userId) return;

    // Find any existing session for this userId
    let existingKey = userId;
    let existing: UserPresence | undefined = this.presencesMap.get(userId);
    if (!existing) {
      this.presencesMap.forEach((val, key) => {
        if (val.userId === userId) {
          existingKey = key;
          existing = val;
        }
      });
    }

    const updated: UserPresence = {
      userId,
      sessionId: existing?.sessionId || userId,
      userName: userName || existing?.userName || 'Teammate',
      userAvatar: userAvatar || existing?.userAvatar,
      currentTaskId: existing?.currentTaskId,
      currentProjectId: existing?.currentProjectId,
      currentView: existing?.currentView,
      isEditing: existing?.isEditing || false,
      editingField: existing?.editingField,
      isTypingComment: existing?.isTypingComment || false,
      lastActive: new Date().toISOString(),
      lastSeenLocally: Date.now(),
      color: existing?.color || '#6366f1',
    };

    this.presencesMap.set(existingKey, updated);
    this.notifyPresencesChange();
  }

  public updatePresence(
    taskId?: string,
    view?: string,
    flags?: { isEditing?: boolean; editingField?: string; isTypingComment?: boolean; statusAction?: string; projectId?: string; clearTask?: boolean }
  ) {
    if (!this.currentUser) return;

    const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#14b8a6', '#f97316'];
    const userColor = colors[Math.abs(this.currentUser.id.charCodeAt(0) + (this.currentUser.id.charCodeAt(1) || 0)) % colors.length];

    const resolvedTaskId = flags?.clearTask
      ? undefined
      : (taskId !== undefined ? taskId : this.currentPresence?.currentTaskId);

    this.currentPresence = {
      userId: this.currentUser.id,
      sessionId: this.sessionId,
      userName: this.currentUser.full_name || this.currentUser.email || 'You',
      userAvatar: this.currentUser.avatar_url,
      currentTaskId: resolvedTaskId,
      currentProjectId: flags?.projectId ?? this.currentPresence?.currentProjectId,
      currentView: view ?? this.currentPresence?.currentView,
      isEditing: resolvedTaskId ? (flags?.isEditing !== undefined ? flags.isEditing : (this.currentPresence?.isEditing || false)) : false,
      editingField: resolvedTaskId ? (flags?.editingField !== undefined ? flags.editingField : this.currentPresence?.editingField) : undefined,
      isTypingComment: resolvedTaskId ? (flags?.isTypingComment !== undefined ? flags.isTypingComment : (this.currentPresence?.isTypingComment || false)) : false,
      statusAction: flags?.statusAction ?? this.currentPresence?.statusAction,
      lastActive: new Date().toISOString(),
      lastSeenLocally: Date.now(),
      color: userColor,
    };

    // Keep self in map under this tab's sessionId
    this.presencesMap.set(this.sessionId, this.currentPresence);
    this.notifyPresencesChange();

    // Broadcast across tabs
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'PRESENCE_BROADCAST',
          payload: this.currentPresence
        });
      } catch (e) {}
    }

    // Broadcast across devices / networks via Supabase Realtime
    if (this.supabaseChannel) {
      try {
        if (this.canUseWebSocket()) {
          this.supabaseChannel.track(this.currentPresence).catch(() => {});
        }
        this.sendBroadcast('collab_presence', this.currentPresence, true);
      } catch (e) {}
    }
  }

  public broadcastCommentAdded(payload: CollabCommentPayload) {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type: 'TASK_COMMENT_ADDED', payload });
      } catch (e) {}
    }
    this.sendBroadcast('task_comment_added', payload, true);
  }

  public broadcastCommentUpdated(taskId: string, commentId: string, content: string) {
    const payload = { taskId, commentId, content };
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type: 'TASK_COMMENT_UPDATED', payload });
      } catch (e) {}
    }
    this.sendBroadcast('task_comment_updated', payload, true);
  }

  public broadcastCommentDeleted(taskId: string, commentId: string) {
    const payload = { taskId, commentId };
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type: 'TASK_COMMENT_DELETED', payload });
      } catch (e) {}
    }
    this.sendBroadcast('task_comment_deleted', payload, true);
  }

  public broadcastTaskUpdated(payload: CollabTaskUpdatePayload) {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type: 'TASK_UPDATED', payload });
      } catch (e) {}
    }
    this.sendBroadcast('task_updated', payload, true);
  }

  public broadcastChatNotification(message: ChatMessage) {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type: 'CHAT_NOTIFICATION', payload: message });
      } catch (e) {}
    }
    this.sendBroadcast('chat_message_notification', message, true);
  }

  public onPresencesChange(callback: (presences: UserPresence[]) => void): () => void {
    this.onPresencesChangeCallbacks.add(callback);
    callback(this.getActivePresences());
    return () => {
      this.onPresencesChangeCallbacks.delete(callback);
    };
  }

  public getActivePresences(): UserPresence[] {
    const now = Date.now();
    const active: UserPresence[] = [];

    this.presencesMap.forEach((p, key) => {
      if (key === this.sessionId || p.sessionId === this.sessionId) {
        active.push(p);
        return;
      }
      const lastSeen = p.lastSeenLocally || (p.lastActive ? new Date(p.lastActive).getTime() : now);
      const age = now - lastSeen;
      // Keep user visible as active if seen within last 45 seconds (resistant to clock skew)
      if (age < 45000) {
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

      // Clean expired remote presences (> 45s)
      let changed = false;
      this.presencesMap.forEach((p, key) => {
        if (key === this.sessionId || p.sessionId === this.sessionId) return;
        const lastSeen = p.lastSeenLocally || (p.lastActive ? new Date(p.lastActive).getTime() : now);
        const age = now - lastSeen;
        if (age >= 45000) {
          this.presencesMap.delete(key);
          changed = true;
        }
      });

      if (changed) {
        this.notifyPresencesChange();
      }

      // Re-broadcast self presence
      if (this.currentUser && this.currentPresence) {
        this.currentPresence.lastActive = new Date(now).toISOString();
        this.currentPresence.lastSeenLocally = now;
        if (this.broadcastChannel) {
          try {
            this.broadcastChannel.postMessage({
              type: 'PRESENCE_BROADCAST',
              payload: this.currentPresence
            });
          } catch (e) {}
        }
        if (this.supabaseChannel && this.canUseWebSocket()) {
          try {
            this.supabaseChannel.track(this.currentPresence).catch(() => {});
            this.sendBroadcast('collab_presence', this.currentPresence, false);
          } catch (e) {}
        }
      }
    }, 4000);
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
          this.supabaseChannel.untrack();
          this.sendBroadcast('collab_leave', { userId, sessionId: this.sessionId }, false);
        } catch (e) {}
      }
    });
  }
}

export const collabService = new CollabService();
export default collabService;
