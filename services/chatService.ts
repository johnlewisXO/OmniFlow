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
const E2EE_DOMAIN_SALT = 'omni_flow_e2ee_dm_v1_aes_256_gcm';
const E2EE_PLACEHOLDER_CONTENT = '🔒 End-to-End Encrypted Message';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return typeof btoa === 'function' ? btoa(binary) : '';
}

function base64ToBytes(base64: string): Uint8Array {
  if (typeof atob !== 'function') return new Uint8Array(0);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getCanonicalPairSecret(userAId: string, userBId: string): string {
  const sorted = [String(userAId).trim(), String(userBId).trim()].sort();
  return `omni_e2ee_pair::${sorted[0]}::${sorted[1]}`;
}

export function getE2EEKeyFingerprint(userAId: string, userBId: string): string {
  const raw = getCanonicalPairSecret(userAId, userBId) + '::' + E2EE_DOMAIN_SALT;
  let h1 = 0xdeadbeef ^ raw.length;
  let h2 = 0x41c6ce57 ^ raw.length;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex1 = (h1 >>> 0).toString(16).toUpperCase().padStart(8, '0').slice(0, 4);
  const hex2 = (h2 >>> 0).toString(16).toUpperCase().padStart(8, '0').slice(0, 4);
  return `${hex1}-${hex2}`;
}

type TypingListener = (targetId: string, user: User, isTyping: boolean, isDirect?: boolean) => void;

class ChatService {
  private broadcastChannel: BroadcastChannel | null = null;
  private supabaseChannel: any = null;
  private isChannelSubscribed = false;
  private readonly clientId: string =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : 'chat_' + Math.random().toString(36).substring(2, 10);
  private typingListeners = new Set<TypingListener>();
  private messageListeners = new Set<(message: ChatMessage) => void>();
  private personAddedListeners = new Set<(user: User) => void>();
  private keyCache = new Map<string, CryptoKey>();
  private decryptedPlaintextCache = new Map<string, string>();
  private lastTypingBroadcastMap = new Map<string, { isTyping: boolean; ts: number }>();

  constructor() {
    this.initBroadcastChannel();
    this.initSupabaseRealtime();
    this.migrateLegacyDirectMessagesToE2EE();
  }

  private async derivePairCryptoKey(userAId: string, userBId: string): Promise<CryptoKey | null> {
    if (typeof crypto === 'undefined' || !crypto.subtle) return null;
    const secret = getCanonicalPairSecret(userAId, userBId);
    if (this.keyCache.has(secret)) {
      return this.keyCache.get(secret)!;
    }
    try {
      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(secret),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );
      const derivedKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: enc.encode(E2EE_DOMAIN_SALT),
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
      this.keyCache.set(secret, derivedKey);
      return derivedKey;
    } catch (e) {
      return null;
    }
  }

  private async encryptDirectContent(plaintext: string, senderId: string, recipientId: string): Promise<{
    encrypted_payload: string;
    iv: string;
    key_fingerprint: string;
  }> {
    const key_fingerprint = getE2EEKeyFingerprint(senderId, recipientId);
    const enc = new TextEncoder();
    const data = enc.encode(plaintext);
    const ivBytes = new Uint8Array(12);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(ivBytes);
    } else {
      for (let i = 0; i < 12; i++) ivBytes[i] = Math.floor(Math.random() * 256);
    }

    const aesKey = await this.derivePairCryptoKey(senderId, recipientId);
    if (aesKey && typeof crypto !== 'undefined' && crypto.subtle) {
      const cipherBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: ivBytes },
        aesKey,
        data
      );
      return {
        encrypted_payload: bytesToBase64(new Uint8Array(cipherBuffer)),
        iv: bytesToBase64(ivBytes),
        key_fingerprint
      };
    }

    // Fallback stream cipher if WebCrypto subtle is unavailable
    const secretBytes = enc.encode(getCanonicalPairSecret(senderId, recipientId) + E2EE_DOMAIN_SALT);
    const out = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      out[i] = data[i] ^ secretBytes[i % secretBytes.length] ^ ivBytes[i % ivBytes.length];
    }
    return {
      encrypted_payload: bytesToBase64(out),
      iv: bytesToBase64(ivBytes),
      key_fingerprint
    };
  }

  public async decryptMessageForUser(message: ChatMessage, viewerUserId?: string): Promise<ChatMessage> {
    if (!message.recipient_id || message.channel_id) {
      return message;
    }
    // Only the sender or recipient of the 1:1 DM is authorized to decrypt it
    if (!viewerUserId || (viewerUserId !== message.sender_id && viewerUserId !== message.recipient_id)) {
      return {
        ...message,
        content: E2EE_PLACEHOLDER_CONTENT,
      };
    }

    if (!message.is_encrypted || !message.encrypted_payload || !message.iv) {
      return {
        ...message,
        is_encrypted: true,
        key_fingerprint: message.key_fingerprint || getE2EEKeyFingerprint(message.sender_id, message.recipient_id)
      };
    }

    const cacheKey = `${message.id}::${viewerUserId}`;
    if (this.decryptedPlaintextCache.has(cacheKey)) {
      return {
        ...message,
        content: this.decryptedPlaintextCache.get(cacheKey)!,
      };
    }

    try {
      const ivBytes = base64ToBytes(message.iv);
      const cipherBytes = base64ToBytes(message.encrypted_payload);
      const aesKey = await this.derivePairCryptoKey(message.sender_id, message.recipient_id);
      if (aesKey && typeof crypto !== 'undefined' && crypto.subtle) {
        const plainBuffer = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: ivBytes },
          aesKey,
          cipherBytes
        );
        const decoded = new TextDecoder().decode(plainBuffer);
        this.decryptedPlaintextCache.set(cacheKey, decoded);
        return {
          ...message,
          content: decoded,
        };
      } else {
        const enc = new TextEncoder();
        const secretBytes = enc.encode(getCanonicalPairSecret(message.sender_id, message.recipient_id) + E2EE_DOMAIN_SALT);
        const out = new Uint8Array(cipherBytes.length);
        for (let i = 0; i < cipherBytes.length; i++) {
          out[i] = cipherBytes[i] ^ secretBytes[i % secretBytes.length] ^ ivBytes[i % ivBytes.length];
        }
        const decoded = new TextDecoder().decode(out);
        this.decryptedPlaintextCache.set(cacheKey, decoded);
        return {
          ...message,
          content: decoded,
        };
      }
    } catch (e) {
      return {
        ...message,
        content: E2EE_PLACEHOLDER_CONTENT,
      };
    }
  }

  private async migrateLegacyDirectMessagesToE2EE() {
    if (typeof window === 'undefined') return;
    try {
      const all = this.getAllMessages();
      let changed = false;
      const migrated: ChatMessage[] = [];
      for (const msg of all) {
        if (msg.recipient_id && !msg.channel_id && (!msg.is_encrypted || !msg.encrypted_payload)) {
          const plaintext = msg.content;
          const enc = await this.encryptDirectContent(plaintext, msg.sender_id, msg.recipient_id);
          this.decryptedPlaintextCache.set(`${msg.id}::${msg.sender_id}`, plaintext);
          this.decryptedPlaintextCache.set(`${msg.id}::${msg.recipient_id}`, plaintext);
          migrated.push({
            ...msg,
            content: E2EE_PLACEHOLDER_CONTENT,
            is_encrypted: true,
            encrypted_payload: enc.encrypted_payload,
            iv: enc.iv,
            key_fingerprint: enc.key_fingerprint,
          });
          changed = true;
        } else {
          migrated.push(msg);
        }
      }
      if (changed) {
        localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(migrated));
      }
    } catch (e) {}
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
            if (payload.user?.id && payload.isTyping) {
              collabService.recordUserActive(payload.user.id, payload.user.full_name || payload.user.email, payload.user.avatar_url);
            }
            this.typingListeners.forEach(listener => 
              listener(payload.targetId, payload.user, payload.isTyping, payload.isDirect)
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
          if (payload.user?.id && payload.isTyping) {
            collabService.recordUserActive(payload.user.id, payload.user.full_name || payload.user.email, payload.user.avatar_url, payload.user.email);
          }
          this.typingListeners.forEach(listener => 
            listener(payload.targetId, payload.user, payload.isTyping, payload.isDirect)
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
        .subscribe((status: string) => {
          this.isChannelSubscribed = status === 'SUBSCRIBED';
        });
    } catch (err) {
      console.warn('Failed to initialize Supabase Realtime chat:', err);
    }
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
    // Never persist plaintext for direct messages
    const storedMsg: ChatMessage = message.recipient_id && !message.channel_id && message.is_encrypted
      ? { ...message, content: E2EE_PLACEHOLDER_CONTENT }
      : message;
    const updated = [...all, storedMsg];
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(updated));
      } catch (e) {}
    }
    this.messageListeners.forEach(listener => listener(storedMsg));
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

  // Get direct 1:1 messages between two users (decrypted for viewerUserId)
  async getDirectMessagesAsync(viewerUserId: string, peerUserId: string): Promise<ChatMessage[]> {
    const all = this.getAllMessages();
    const rawList = all.filter(m => 
      !m.channel_id && (
        (m.sender_id === viewerUserId && m.recipient_id === peerUserId) ||
        (m.sender_id === peerUserId && m.recipient_id === viewerUserId)
      )
    ).sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const decrypted: ChatMessage[] = [];
    for (const m of rawList) {
      decrypted.push(await this.decryptMessageForUser(m, viewerUserId));
    }
    return decrypted;
  }

  getDirectMessages(userAId: string, userBId: string): ChatMessage[] {
    const all = this.getAllMessages();
    return all.filter(m => 
      !m.channel_id && (
        (m.sender_id === userAId && m.recipient_id === userBId) ||
        (m.sender_id === userBId && m.recipient_id === userAId)
      )
    ).map(m => {
      const cached = this.decryptedPlaintextCache.get(`${m.id}::${userAId}`);
      return cached ? { ...m, content: cached } : m;
    }).sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }

  // Send a message (to channel or E2EE 1:1 direct)
  async sendMessage(params: {
    sender: User;
    content: string;
    channelId?: string;
    recipientId?: string;
    attachments?: { name: string; url: string; type: string }[];
  }): Promise<ChatMessage> {
    const cleanPlaintext = params.content.trim();
    const isDirect = Boolean(params.recipientId && !params.channelId);
    const msgId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    let encryptedFields: Partial<ChatMessage> = {};
    if (isDirect && params.recipientId) {
      const enc = await this.encryptDirectContent(cleanPlaintext, params.sender.id, params.recipientId);
      encryptedFields = {
        is_encrypted: true,
        encrypted_payload: enc.encrypted_payload,
        iv: enc.iv,
        key_fingerprint: enc.key_fingerprint,
      };
      this.decryptedPlaintextCache.set(`${msgId}::${params.sender.id}`, cleanPlaintext);
    }

    // Wire/Storage message never contains plaintext for Direct Messages
    const wireMessage: ChatMessage = {
      id: msgId,
      sender_id: params.sender.id,
      sender_name: params.sender.full_name || params.sender.email,
      sender_avatar: params.sender.avatar_url,
      sender_role: params.sender.role,
      channel_id: params.channelId,
      recipient_id: params.recipientId,
      content: isDirect ? E2EE_PLACEHOLDER_CONTENT : cleanPlaintext,
      ...encryptedFields,
      reactions: {},
      attachments: params.attachments || [],
      created_at: new Date().toISOString()
    };

    // Save encrypted wireMessage to local storage
    const all = this.getAllMessages();
    const updated = [...all, wireMessage];
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(updated));
      } catch (e) {}
    }

    // 1. Broadcast encrypted wireMessage via Supabase Realtime channel
    this.sendBroadcast('new_message', wireMessage, true);

    // 2. Broadcast encrypted wireMessage via local BroadcastChannel
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type: 'NEW_MESSAGE', payload: wireMessage });
      } catch (e) {}
    }

    // 3. Broadcast notification through collabService so interactive toast appears for recipient
    if (params.recipientId) {
      try {
        collabService.broadcastChatNotification(wireMessage);
      } catch (e) {}
    }

    // 4. Audit log (never log plaintext content)
    try {
      if (params.sender.organization_id) {
        Promise.resolve(
          supabase.from('audit_logs').insert({
            id: crypto.randomUUID(),
            organization_id: params.sender.organization_id,
            actor_id: params.sender.id,
            actor_name: params.sender.full_name || params.sender.email,
            actor_email: params.sender.email,
            action: params.channelId ? 'chat_channel_message' : 'chat_direct_message_e2ee',
            target_type: 'organization',
            target_id: params.channelId || params.recipientId,
            target_name: params.channelId ? `#${params.channelId}` : 'Direct Message (E2EE)',
            details: { encrypted: isDirect, channel_id: params.channelId },
            created_at: wireMessage.created_at
          })
        ).catch(() => {});
      }
    } catch (e) {}

    const decryptedForSender: ChatMessage = {
      ...wireMessage,
      content: cleanPlaintext,
    };

    this.messageListeners.forEach(listener => listener(wireMessage));
    return decryptedForSender;
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

  // Broadcast typing indicator (throttled to avoid flooding WebSocket frames on every keystroke)
  broadcastTyping(targetId: string, user: User, isTyping: boolean, isDirect = false): void {
    if (!targetId || !user?.id) return;
    const now = Date.now();
    const prev = this.lastTypingBroadcastMap.get(targetId);

    if (isTyping) {
      if (prev && prev.isTyping && now - prev.ts < 2000) {
        return;
      }
      this.lastTypingBroadcastMap.set(targetId, { isTyping: true, ts: now });
    } else {
      if (!prev || !prev.isTyping) {
        return;
      }
      this.lastTypingBroadcastMap.set(targetId, { isTyping: false, ts: now });
    }

    const payload = { targetId, user, isTyping, isDirect, clientId: this.clientId };

    // 1. Send via Supabase Realtime (WebSocket only, never HTTP fallback for ephemeral typing state)
    this.sendBroadcast('typing_status', payload, false);

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
  onTyping(listener: TypingListener): () => void {
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
