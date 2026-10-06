import { ChatMessage, ChatChannel, User } from '../types';
import { supabase } from './supabaseService';
import collabService from './collabService';

export const DEFAULT_CHANNELS: ChatChannel[] = [
  {
    id: 'general',
    name: 'general',
    description: 'Company-wide announcements, casual discussions, and team updates',
    isPrivate: false,
    department: 'All Company',
    membersCount: 24,
  },
  {
    id: 'engineering',
    name: 'engineering',
    description: 'Architecture sync, bug triage, code reviews, and release engineering',
    isPrivate: false,
    department: 'Engineering',
    membersCount: 16,
  },
  {
    id: 'design-ux',
    name: 'design-ux',
    description: 'UI components, Figma mockups, design tokens, and user feedback',
    isPrivate: false,
    department: 'Design',
    membersCount: 8,
  },
  {
    id: 'sprint-planning',
    name: 'sprint-planning',
    description: 'Sprint backlog refinement, story point estimations, and velocity tracking',
    isPrivate: false,
    department: 'Agile & Product',
    membersCount: 18,
  },
  {
    id: 'leadership',
    name: 'leadership',
    description: 'Quarterly roadmap, budget approvals, and executive decisions',
    isPrivate: true,
    department: 'Executive',
    membersCount: 5,
  }
];

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-seed-1',
    sender_id: 'system',
    sender_name: 'Omni Flow Bot',
    sender_role: 'ADMIN',
    channel_id: 'general',
    content: '🚀 Welcome to the organization chat hub! Real-time messaging, cross-channel communication, and emoji reactions are now connected via Supabase Realtime.',
    reactions: { '🎉': ['seed-1'], '🚀': ['seed-2'] },
    created_at: new Date(Date.now() - 3600000 * 4).toISOString()
  },
  {
    id: 'msg-seed-2',
    sender_id: 'seed-alex',
    sender_name: 'Alex Rivera',
    sender_role: 'PROJECT_MANAGER',
    channel_id: 'sprint-planning',
    content: 'Sprint review tomorrow morning at 10 AM. Please make sure all completed deliverables are transitioned to Done on the Sprints board.',
    reactions: { '👍': ['seed-3'], '👀': ['seed-1'] },
    created_at: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: 'msg-seed-3',
    sender_id: 'seed-sarah',
    sender_name: 'Sarah Chen',
    sender_role: 'MEMBER',
    channel_id: 'engineering',
    content: 'Supabase Realtime WebSockets are active! Check your Supabase Realtime Logs under channel "omni_flow_chat_hub" to monitor live message events.',
    reactions: { '🔥': ['seed-1', 'seed-2'], '❤️': ['seed-alex'] },
    created_at: new Date(Date.now() - 1800000).toISOString()
  }
];

const STORAGE_KEY_MESSAGES = 'omni_chat_messages';
const STORAGE_KEY_CHANNELS = 'omni_chat_channels';

class ChatService {
  private broadcastChannel: BroadcastChannel | null = null;
  private supabaseChannel: any = null;
  private isChannelSubscribed = false;
  private readonly clientId: string =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : 'chat_' + Math.random().toString(36).substring(2, 10);
  private typingListeners = new Set<(channelOrUserId: string, user: User, isTyping: boolean) => void>();
  private messageListeners = new Set<(message: ChatMessage) => void>();
  private personAddedListeners = new Set<(user: User) => void>();

  constructor() {
    this.initBroadcastChannel();
    this.initSupabaseRealtime();
  }

  private initBroadcastChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('omni_chat_sync');
        this.broadcastChannel.onmessage = (event) => {
          const { type, payload } = event.data || {};
          if (type === 'NEW_MESSAGE' && payload) {
            collabService.recordUserActive(payload.sender_id, payload.sender_name, payload.sender_avatar);
            this.handleIncomingRemoteMessage(payload);
          } else if (type === 'TYPING_STATUS' && payload) {
            if (payload.clientId && payload.clientId === this.clientId) return;
            if (payload.user?.id) {
              collabService.recordUserActive(payload.user.id, payload.user.full_name || payload.user.email, payload.user.avatar_url);
            }
            this.typingListeners.forEach(listener => 
              listener(payload.targetId, payload.user, payload.isTyping)
            );
          } else if (type === 'REACTION_UPDATE' && payload) {
            this.handleIncomingRemoteReaction(payload.messageId, payload.emoji, payload.userId);
          } else if (type === 'PERSON_ADDED' && payload) {
            this.handleIncomingPersonAdded(payload);
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel not supported for chat:', e);
      }
    }
  }

  private initSupabaseRealtime() {
    if (typeof window === 'undefined') return;
    try {
      this.supabaseChannel = supabase.channel('omni_flow_chat_hub', {
        config: {
          broadcast: { self: false }
        }
      });

      this.supabaseChannel
        .on('broadcast', { event: 'new_message' }, ({ payload }: { payload: ChatMessage }) => {
          if (!payload || !payload.id) return;
          collabService.recordUserActive(payload.sender_id, payload.sender_name, payload.sender_avatar);
          this.handleIncomingRemoteMessage(payload);
        })
        .on('broadcast', { event: 'typing_status' }, ({ payload }: any) => {
          if (!payload) return;
          if (payload.clientId && payload.clientId === this.clientId) return;
          if (payload.user?.id) {
            collabService.recordUserActive(payload.user.id, payload.user.full_name || payload.user.email, payload.user.avatar_url, payload.user.email);
          }
          this.typingListeners.forEach(listener => 
            listener(payload.targetId, payload.user, payload.isTyping)
          );
        })
        .on('broadcast', { event: 'reaction_toggle' }, ({ payload }: any) => {
          if (!payload) return;
          this.handleIncomingRemoteReaction(payload.messageId, payload.emoji, payload.userId);
        })
        .on('broadcast', { event: 'person_added' }, ({ payload }: any) => {
          if (!payload || !payload.id) return;
          this.handleIncomingPersonAdded(payload);
        })
        .on('broadcast', { event: 'collab_presence' }, ({ payload }: any) => {
          collabService.ingestRemoteEventFromBridge('collab_presence', payload);
        })
        .on('broadcast', { event: 'collab_presence_request' }, ({ payload }: any) => {
          collabService.ingestRemoteEventFromBridge('collab_presence_request', payload);
        })
        .on('broadcast', { event: 'user_status_changed' }, ({ payload }: any) => {
          collabService.ingestRemoteEventFromBridge('user_status_changed', payload);
        })
        .on('broadcast', { event: 'task_updated' }, ({ payload }: any) => {
          collabService.ingestRemoteEventFromBridge('task_updated', payload);
        })
        .on('broadcast', { event: 'task_comment_added' }, ({ payload }: any) => {
          collabService.ingestRemoteEventFromBridge('task_comment_added', payload);
        })
        .subscribe((status: string) => {
          this.isChannelSubscribed = status === 'SUBSCRIBED';
          if (status === 'SUBSCRIBED') {
            collabService.requestRemotePresences();
          }
        });

      window.addEventListener('omni_collab_bridge_out', ((e: CustomEvent) => {
        const { event, payload } = e.detail || {};
        if (event && payload) {
          this.sendBroadcast(event, payload, true);
        }
      }) as EventListener);
    } catch (err) {
      console.warn('Failed to initialize Supabase Realtime chat:', err);
    }
  }

  private canUseWebSocket(): boolean {
    if (!this.supabaseChannel || !this.isChannelSubscribed) return false;
    if (typeof this.supabaseChannel.canPush === 'function') {
      return this.supabaseChannel.canPush();
    }
    return this.supabaseChannel.state === 'joined';
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

  private handleIncomingPersonAdded(user: User) {
    if (!user || !user.id) return;
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('omni_custom_team_members');
        const customList: User[] = raw ? JSON.parse(raw) : [];
        if (!customList.some(u => u.id === user.id || (u.email && user.email && u.email.toLowerCase() === user.email.toLowerCase()))) {
          customList.push(user);
          localStorage.setItem('omni_custom_team_members', JSON.stringify(customList));
        }
      } catch (e) {}
    }
    this.personAddedListeners.forEach(listener => listener(user));
  }

  private handleIncomingRemoteMessage(message: ChatMessage) {
    const all = this.getAllMessages();
    if (all.some(m => m.id === message.id)) return;
    const updated = [...all, message];
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(updated));
      } catch (e) {}
    }
    this.messageListeners.forEach(listener => listener(message));
  }

  private handleIncomingRemoteReaction(messageId: string, emoji: string, userId: string) {
    const all = this.getAllMessages();
    const message = all.find(m => m.id === messageId);
    if (!message) return;

    if (!message.reactions) message.reactions = {};
    const existingUsers = message.reactions[emoji] || [];

    if (existingUsers.includes(userId)) {
      message.reactions[emoji] = existingUsers.filter(id => id !== userId);
      if (message.reactions[emoji].length === 0) {
        delete message.reactions[emoji];
      }
    } else {
      message.reactions[emoji] = [...existingUsers, userId];
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(all));
      } catch (e) {}
    }
    this.messageListeners.forEach(listener => listener(message));
  }

  // Load channels
  getChannels(): ChatChannel[] {
    if (typeof window === 'undefined') return DEFAULT_CHANNELS;
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CHANNELS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    localStorage.setItem(STORAGE_KEY_CHANNELS, JSON.stringify(DEFAULT_CHANNELS));
    return DEFAULT_CHANNELS;
  }

  // Save new channel
  createChannel(channel: Omit<ChatChannel, 'id'>): ChatChannel {
    const channels = this.getChannels();
    const newChan: ChatChannel = {
      id: channel.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
      ...channel,
      membersCount: 1,
    };
    const updated = [...channels, newChan];
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_CHANNELS, JSON.stringify(updated));
    }
    return newChan;
  }

  // Get messages for a channel
  getChannelMessages(channelId: string): ChatMessage[] {
    const all = this.getAllMessages();
    return all.filter(m => m.channel_id === channelId).sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }

  // Get direct 1:1 messages between two users
  getDirectMessages(userAId: string, userBId: string): ChatMessage[] {
    const all = this.getAllMessages();
    return all.filter(m => 
      !m.channel_id && (
        (m.sender_id === userAId && m.recipient_id === userBId) ||
        (m.sender_id === userBId && m.recipient_id === userAId)
      )
    ).sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }

  // Send a message (to channel or 1:1 direct)
  async sendMessage(params: {
    sender: User;
    content: string;
    channelId?: string;
    recipientId?: string;
    attachments?: { name: string; url: string; type: string }[];
  }): Promise<ChatMessage> {
    const message: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sender_id: params.sender.id,
      sender_name: params.sender.full_name || params.sender.email,
      sender_avatar: params.sender.avatar_url,
      sender_role: params.sender.role,
      channel_id: params.channelId,
      recipient_id: params.recipientId,
      content: params.content.trim(),
      reactions: {},
      attachments: params.attachments || [],
      created_at: new Date().toISOString()
    };

    // Save to local storage
    const all = this.getAllMessages();
    const updated = [...all, message];
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(updated));
      } catch (e) {}
    }

    // 1. Broadcast via Supabase Realtime channel (Cross-browser, Incognito, and Cross-device)
    this.sendBroadcast('new_message', message, true);

    // 2. Broadcast via local BroadcastChannel
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type: 'NEW_MESSAGE', payload: message });
      } catch (e) {}
    }

    // 3. Broadcast notification through collabService so interactive toast appears across app
    if (params.recipientId) {
      try {
        collabService.broadcastChatNotification(message);
      } catch (e) {}
    }

    // Keep sender registered as active
    collabService.updatePresence(undefined, 'team_chat_view', { statusAction: 'chatting' });

    // 3. Try to log into audit_logs or chat_messages in Supabase for log inspection
    try {
      if (params.sender.organization_id) {
        Promise.resolve(
          supabase.from('audit_logs').insert({
            id: crypto.randomUUID(),
            organization_id: params.sender.organization_id,
            actor_id: params.sender.id,
            actor_name: params.sender.full_name || params.sender.email,
            actor_email: params.sender.email,
            action: params.channelId ? 'chat_channel_message' : 'chat_direct_message',
            target_type: 'organization',
            target_id: params.channelId || params.recipientId,
            target_name: params.channelId ? `#${params.channelId}` : 'Direct Message',
            details: { content_length: message.content.length, channel_id: params.channelId },
            created_at: message.created_at
          })
        ).catch(() => {});
      }
    } catch (e) {}

    this.messageListeners.forEach(listener => listener(message));
    return message;
  }

  // Add or toggle emoji reaction
  toggleReaction(messageId: string, emoji: string, userId: string): void {
    const all = this.getAllMessages();
    const message = all.find(m => m.id === messageId);
    if (!message) return;

    if (!message.reactions) message.reactions = {};
    const existingUsers = message.reactions[emoji] || [];

    if (existingUsers.includes(userId)) {
      message.reactions[emoji] = existingUsers.filter(id => id !== userId);
      if (message.reactions[emoji].length === 0) {
        delete message.reactions[emoji];
      }
    } else {
      message.reactions[emoji] = [...existingUsers, userId];
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(all));
      } catch (e) {}
    }

    // Broadcast via Supabase Realtime
    this.sendBroadcast('reaction_toggle', { messageId, emoji, userId }, true);

    // Broadcast via local BroadcastChannel
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'REACTION_UPDATE',
          payload: { messageId, emoji, userId }
        });
      } catch (e) {}
    }

    this.messageListeners.forEach(listener => listener(message));
  }

  // Broadcast typing indicator
  broadcastTyping(targetId: string, user: User, isTyping: boolean): void {
    if (isTyping) {
      collabService.updatePresence(undefined, 'team_chat_view', { statusAction: 'typing' });
    }

    const payload = { targetId, user, isTyping, clientId: this.clientId };

    // 1. Send via Supabase Realtime (with REST fallback if socket still connecting)
    this.sendBroadcast('typing_status', payload, true);

    // 2. Send via local BroadcastChannel
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'TYPING_STATUS',
          payload
        });
      } catch (e) {}
    }
  }

  // Broadcast newly added person across tabs and teammates
  broadcastPersonAdded(user: User): void {
    this.sendBroadcast('person_added', user, true);
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'PERSON_ADDED',
          payload: user
        });
      } catch (e) {}
    }
  }

  // Subscribe to new messages
  onMessage(listener: (message: ChatMessage) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  // Subscribe to typing state
  onTyping(listener: (targetId: string, user: User, isTyping: boolean) => void): () => void {
    this.typingListeners.add(listener);
    return () => this.typingListeners.delete(listener);
  }

  // Subscribe to person added
  onPersonAdded(listener: (user: User) => void): () => void {
    this.personAddedListeners.add(listener);
    return () => this.personAddedListeners.delete(listener);
  }

  private getAllMessages(): ChatMessage[] {
    if (typeof window === 'undefined') return INITIAL_MESSAGES;
    try {
      const stored = localStorage.getItem(STORAGE_KEY_MESSAGES);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(INITIAL_MESSAGES));
    return INITIAL_MESSAGES;
  }
}

export const chatService = new ChatService();
export default chatService;
