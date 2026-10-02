import { ChatMessage, ChatChannel, User } from '../types';
import { supabase } from './supabaseService';

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
    content: '🚀 Welcome to the new organization workspace! Real-time messaging, sprint planning, and task synchronization are now live.',
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
    content: 'Just deployed the real-time presence beacon! You can see live collaborator viewer bubbles and editing activity on cards.',
    reactions: { '🔥': ['seed-1', 'seed-2'], '❤️': ['seed-alex'] },
    created_at: new Date(Date.now() - 1800000).toISOString()
  }
];

const STORAGE_KEY_MESSAGES = 'omni_chat_messages';
const STORAGE_KEY_CHANNELS = 'omni_chat_channels';

class ChatService {
  private broadcastChannel: BroadcastChannel | null = null;
  private typingListeners = new Set<(channelOrUserId: string, user: User, isTyping: boolean) => void>();
  private messageListeners = new Set<(message: ChatMessage) => void>();

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('omni_chat_sync');
        this.broadcastChannel.onmessage = (event) => {
          const { type, payload } = event.data || {};
          if (type === 'NEW_MESSAGE' && payload) {
            this.messageListeners.forEach(listener => listener(payload));
          } else if (type === 'TYPING_STATUS' && payload) {
            this.typingListeners.forEach(listener => 
              listener(payload.targetId, payload.user, payload.isTyping)
            );
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel not supported for chat:', e);
      }
    }
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
      localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(updated));
    }

    // Try optional sync to Supabase if messages table exists
    try {
      if (params.channelId) {
        Promise.resolve(
          supabase.from('chat_messages').insert({
            id: message.id,
            sender_id: message.sender_id,
            channel_id: message.channel_id,
            content: message.content,
            created_at: message.created_at
          })
        ).catch(() => {});
      }
    } catch (e) {}

    // Broadcast in real-time across tabs & notify listeners
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type: 'NEW_MESSAGE', payload: message });
      } catch (e) {}
    }
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
      localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(all));
    }

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type: 'NEW_MESSAGE', payload: message });
      } catch (e) {}
    }
    this.messageListeners.forEach(listener => listener(message));
  }

  // Broadcast typing indicator
  broadcastTyping(targetId: string, user: User, isTyping: boolean): void {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'TYPING_STATUS',
          payload: { targetId, user, isTyping }
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
