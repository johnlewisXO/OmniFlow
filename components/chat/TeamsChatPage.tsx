import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { User, ChatMessage, ChatChannel, UserRole, UserPresence } from '../../types';
import chatService, { getE2EEKeyFingerprint } from '../../services/chatService';
import { collabService } from '../../services/collabService';
import { supabase } from '../../services/supabaseService';
import { Avatar } from '../shared/Avatar';
import { Button } from '../shared/Button';

const EMOJI_OPTIONS = ['👍', '❤️', '🚀', '🎉', '👀', '🔥', '👏', '💡'];

const SUGGESTED_COLLEAGUES: Array<{ id: string; full_name: string; email: string; role: UserRole }> = [
  { id: 'seed-alex', full_name: 'Alex Rivera', email: 'alex.rivera@workspace.live', role: UserRole.PROJECT_MANAGER },
  { id: 'seed-sarah', full_name: 'Sarah Chen', email: 'sarah.chen@workspace.live', role: UserRole.DEVELOPER },
  { id: 'seed-marcus', full_name: 'Marcus Vance', email: 'marcus.vance@workspace.live', role: UserRole.DEVELOPER },
  { id: 'seed-elena', full_name: 'Elena Rostova', email: 'elena.rostova@workspace.live', role: UserRole.DESIGNER },
  { id: 'seed-david', full_name: 'David Kim', email: 'david.kim@workspace.live', role: UserRole.QA_ENGINEER },
  { id: 'seed-priya', full_name: 'Priya Patel', email: 'priya.patel@workspace.live', role: UserRole.PROJECT_MANAGER },
];

export const TeamsChatPage: React.FC = () => {
  const {
    users,
    setUsers,
    currentUser,
    darkMode,
    presences,
    updateUserPresence,
    fetchUsersForAssignmentList,
    addToast
  } = useAppStore();

  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string>('general');
  const [activeDirectUserId, setActiveDirectUserId] = useState<string | null>(null);
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  
  // Real-time typing indicators keyed by channelId (for channels) or senderUserId (for DMs)
  const [typingUsers, setTypingUsers] = useState<{ [targetId: string]: string[] }>({});
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // New channel modal
  const [isNewChannelModalOpen, setIsNewChannelModalOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [newChannelDept, setNewChannelDept] = useState('Engineering');

  // Add Person / Direct Message modal
  const [isAddPersonModalOpen, setIsAddPersonModalOpen] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonEmail, setNewPersonEmail] = useState('');
  const [newPersonRole, setNewPersonRole] = useState<UserRole>(UserRole.DEVELOPER);
  const [directorySearch, setDirectorySearch] = useState('');
  const [customPeopleVersion, setCustomPeopleVersion] = useState(0);
  const remoteTypingTimeoutsRef = useRef<{ [key: string]: NodeJS.Timeout }>({});

  // Ensure all available users and live presences are fetched on mount
  useEffect(() => {
    fetchUsersForAssignmentList().catch(() => {});
    collabService.requestRemotePresences();
  }, [fetchUsersForAssignmentList]);

  const [teamStatuses, setTeamStatuses] = useState<Record<string, 'available' | 'away' | 'busy'>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('omni_team_statuses');
        return raw ? JSON.parse(raw) : {};
      } catch (e) {}
    }
    return {};
  });

  useEffect(() => {
    const handleRemoteStatusChange = (e: CustomEvent) => {
      const payload = e.detail;
      if (!payload || !payload.userId) return;
      setTeamStatuses(prev => {
        const next = { ...prev, [payload.userId]: payload.availabilityStatus };
        if (payload.userEmail) next[payload.userEmail.toLowerCase()] = payload.availabilityStatus;
        return next;
      });
    };
    window.addEventListener('omni_remote_user_status_changed', handleRemoteStatusChange as EventListener);
    return () => window.removeEventListener('omni_remote_user_status_changed', handleRemoteStatusChange as EventListener);
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Announce chat presence
  useEffect(() => {
    updateUserPresence(undefined, 'team_chat_view', {
      statusAction: 'chatting',
    });
  }, [activeDirectUserId, activeChannelId, updateUserPresence]);

  // Handle direct contact selection via interactive toast clicks
  useEffect(() => {
    const handleSelectContact = (e: any) => {
      if (e.detail?.userId) {
        setActiveDirectUserId(e.detail.userId);
        setActiveChannelId('');
      }
    };
    window.addEventListener('omni_select_chat_contact', handleSelectContact);
    return () => window.removeEventListener('omni_select_chat_contact', handleSelectContact);
  }, []);

  // Load channels on mount
  useEffect(() => {
    setChannels(chatService.getChannels());
  }, []);

  // Load and decrypt messages when channel or direct user changes
  useEffect(() => {
    let isCancelled = false;
    if (activeDirectUserId && currentUser) {
      chatService.getDirectMessagesAsync(currentUser.id, activeDirectUserId).then(decrypted => {
        if (!isCancelled) {
          setMessages(decrypted);
        }
      });
    } else if (activeChannelId) {
      setMessages(chatService.getChannelMessages(activeChannelId));
    }
    return () => {
      isCancelled = true;
    };
  }, [activeChannelId, activeDirectUserId, currentUser]);

  // Real-time message & typing subscription
  useEffect(() => {
    const unsubscribeMessages = chatService.onMessage(async (incomingMessage) => {
      if (activeDirectUserId && currentUser) {
        if (
          (incomingMessage.sender_id === activeDirectUserId && incomingMessage.recipient_id === currentUser.id) ||
          (incomingMessage.sender_id === currentUser.id && incomingMessage.recipient_id === activeDirectUserId)
        ) {
          const decryptedMsg = await chatService.decryptMessageForUser(incomingMessage, currentUser.id);
          setMessages(prev => {
            if (prev.some(m => m.id === decryptedMsg.id)) {
              return prev.map(m => m.id === decryptedMsg.id ? decryptedMsg : m);
            }
            return [...prev, decryptedMsg];
          });
        }
      } else if (activeChannelId && incomingMessage.channel_id === activeChannelId) {
        setMessages(prev => {
          if (prev.some(m => m.id === incomingMessage.id)) {
            return prev.map(m => m.id === incomingMessage.id ? incomingMessage : m);
          }
          return [...prev, incomingMessage];
        });
      }
    });

    const unsubscribeTyping = chatService.onTyping((targetId, user, isTyping, isDirect) => {
      if (!user || !user.id) return;
      // Never show the current logged-in user's own typing indicator
      if (currentUser && user.id === currentUser.id) return;

      const userName = user.full_name || user.email || 'Teammate';
      const isChannelTarget = !isDirect && channels.some(c => c.id === targetId);

      const keysToUpdate = new Set<string>();

      if (isChannelTarget) {
        // Channel typing: only associate with the channel ID, never with a DM user ID
        if (targetId) keysToUpdate.add(targetId);
      } else {
        // 1:1 Direct Message typing:
        // targetId is the recipient's user ID; user.id is the sender who is typing.
        // ONLY the intended recipient (currentUser) should see this typing indicator!
        if (!currentUser) return;
        const isIntendedForCurrentUser =
          targetId === currentUser.id ||
          (Boolean(currentUser.email) &&
            users.some(u => u.id === targetId && u.email?.toLowerCase() === currentUser.email.toLowerCase()));

        if (!isIntendedForCurrentUser) {
          return;
        }

        // Record typing ONLY under the SENDER's user ID (user.id), NEVER under targetId!
        keysToUpdate.add(user.id);
        const senderEmailLower = user.email?.toLowerCase();
        if (senderEmailLower) {
          users.forEach(u => {
            if (u.email?.toLowerCase() === senderEmailLower) {
              keysToUpdate.add(u.id);
            }
          });
        }
      }

      if (keysToUpdate.size === 0) return;

      const applyTypingState = (typingFlag: boolean) => {
        setTypingUsers(prev => {
          const next = { ...prev };
          keysToUpdate.forEach(key => {
            const currentList = next[key] || [];
            next[key] = typingFlag
              ? (currentList.includes(userName) ? currentList : [...currentList, userName])
              : currentList.filter(n => n !== userName);
          });
          return next;
        });
      };

      applyTypingState(isTyping);

      const timeoutKey = `${user.id}_${targetId}`;
      if (remoteTypingTimeoutsRef.current[timeoutKey]) {
        clearTimeout(remoteTypingTimeoutsRef.current[timeoutKey]);
      }
      if (isTyping) {
        remoteTypingTimeoutsRef.current[timeoutKey] = setTimeout(() => {
          applyTypingState(false);
        }, 3500);
      }
    });

    const unsubscribePersonAdded = chatService.onPersonAdded((addedUser) => {
      setCustomPeopleVersion(v => v + 1);
      setUsers(users.some(u => u.id === addedUser.id) ? users : [...users, addedUser]);
    });

    return () => {
      unsubscribeMessages();
      unsubscribeTyping();
      unsubscribePersonAdded();
    };
  }, [activeChannelId, activeDirectUserId, currentUser, users, channels, setUsers]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle typing input
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setInputText(text);

    if (!currentUser) return;
    const isDirect = Boolean(activeDirectUserId);
    const targetId = activeDirectUserId || activeChannelId;
    if (!targetId) return;

    if (text.trim().length > 0) {
      chatService.broadcastTyping(targetId, currentUser, true, isDirect);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        chatService.broadcastTyping(targetId, currentUser, false, isDirect);
      }, 2500);
    } else {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      chatService.broadcastTyping(targetId, currentUser, false, isDirect);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !currentUser) return;

    const content = inputText.trim();
    setInputText('');

    const isDirect = Boolean(activeDirectUserId);
    const targetId = activeDirectUserId || activeChannelId;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (targetId) {
      chatService.broadcastTyping(targetId, currentUser, false, isDirect);
    }

    const newMsg = await chatService.sendMessage({
      sender: currentUser,
      content,
      channelId: activeDirectUserId ? undefined : activeChannelId,
      recipientId: activeDirectUserId || undefined,
    });

    setMessages(prev => {
      if (prev.some(m => m.id === newMsg.id)) return prev;
      return [...prev, newMsg];
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleAddReaction = (messageId: string, emoji: string) => {
    if (!currentUser) return;
    chatService.toggleReaction(messageId, emoji, currentUser.id);
  };

  const handleCreateChannelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    const created = chatService.createChannel({
      name: newChannelName.trim(),
      description: newChannelDesc.trim() || 'Custom team channel',
      department: newChannelDept,
      isPrivate: false,
    });

    setChannels(chatService.getChannels());
    setActiveChannelId(created.id);
    setActiveDirectUserId(null);
    setIsNewChannelModalOpen(false);
    setNewChannelName('');
    setNewChannelDesc('');
  };

  // Other users in organization + custom added people + online presences (so any colleague can be messaged)
  const directMessageUsers = useMemo(() => {
    const map = new Map<string, User>();
    users.forEach(u => {
      if (u.id !== currentUser?.id) {
        map.set(u.id, u);
      }
    });

    // Load custom added people from localStorage immediately
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('omni_custom_team_members');
        if (raw) {
          const customList: User[] = JSON.parse(raw);
          if (Array.isArray(customList)) {
            customList.forEach(cu => {
              if (cu && cu.id && cu.id !== currentUser?.id && !map.has(cu.id)) {
                map.set(cu.id, cu);
              }
            });
          }
        }
      } catch (e) {}
    }

    presences.forEach(p => {
      if (p.userId && p.userId !== currentUser?.id && !map.has(p.userId)) {
        const pEmail = p.userEmail?.toLowerCase();
        const pName = p.userName?.toLowerCase();
        const alreadyExists = Array.from(map.values()).some(
          existing =>
            (pEmail && existing.email?.toLowerCase() === pEmail) ||
            (pName && existing.full_name?.toLowerCase() === pName)
        );
        if (!alreadyExists) {
          map.set(p.userId, {
            id: p.userId,
            supabase_auth_id: p.userId,
            full_name: p.userName || 'Online Teammate',
            email: p.userEmail || `${(p.userName || 'user').toLowerCase().replace(/\s+/g, '.')}@workspace.live`,
            avatar_url: p.userAvatar,
            role: UserRole.MEMBER,
            organization_id: currentUser?.organization_id,
          });
        }
      }
    });
    return Array.from(map.values());
  }, [users, presences, currentUser, customPeopleVersion]);

  const findPresenceForUser = (user?: User | null): UserPresence | undefined => {
    if (!user) return undefined;
    const uEmail = user.email?.toLowerCase();
    const uName = user.full_name?.toLowerCase();
    return presences.find(
      p =>
        p.userId === user.id ||
        (uEmail && p.userEmail && p.userEmail.toLowerCase() === uEmail) ||
        (uName && p.userName && p.userName.toLowerCase() === uName)
    );
  };

  const getAvailabilityForUser = (user?: User | null, presence?: UserPresence): 'available' | 'away' | 'busy' => {
    if (presence?.availabilityStatus) return presence.availabilityStatus;
    if (user) {
      if (teamStatuses[user.id]) return teamStatuses[user.id];
      if (user.email && teamStatuses[user.email.toLowerCase()]) return teamStatuses[user.email.toLowerCase()];
    }
    return 'available';
  };

  const activeChannel = channels.find(c => c.id === activeChannelId);
  const activeDirectUser = directMessageUsers.find(u => u.id === activeDirectUserId) || users.find(u => u.id === activeDirectUserId);

  const addPersonRecord = async (nameInput: string, emailInput: string, roleInput: UserRole, keepModalOpen = false) => {
    const cleanName = nameInput.trim();
    if (!cleanName) return;

    const cleanEmail = emailInput.trim()
      ? emailInput.trim().toLowerCase()
      : `${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@workspace.live`;

    // Check if user already exists in current list by email or name
    const existing = directMessageUsers.find(
      u => u.email.toLowerCase() === cleanEmail || (u.full_name && u.full_name.toLowerCase() === cleanName.toLowerCase())
    );
    if (existing) {
      setActiveDirectUserId(existing.id);
      if (!keepModalOpen) setIsAddPersonModalOpen(false);
      setNewPersonName('');
      setNewPersonEmail('');
      addToast('Opened Direct Chat', `Switched to conversation with ${existing.full_name || existing.email}.`, 'info');
      return;
    }

    // Check if user exists in Supabase user_profiles by email
    let addedUser: User | null = null;
    try {
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (existingProfile) {
        addedUser = existingProfile as User;
      }
    } catch (err) {}

    if (!addedUser) {
      addedUser = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        full_name: cleanName,
        email: cleanEmail,
        role: roleInput,
        organization_id: currentUser?.organization_id,
      };
    }

    // Persist in localStorage custom team members so they stay available across the app
    try {
      const raw = localStorage.getItem('omni_custom_team_members');
      const customList: User[] = raw ? JSON.parse(raw) : [];
      if (!customList.some(u => u.id === addedUser!.id || u.email.toLowerCase() === cleanEmail)) {
        customList.push(addedUser);
        localStorage.setItem('omni_custom_team_members', JSON.stringify(customList));
      }
    } catch (err) {}

    setCustomPeopleVersion(v => v + 1);
    const updatedUsers = users.some(u => u.id === addedUser!.id) ? users : [...users, addedUser];
    setUsers(updatedUsers);
    chatService.broadcastPersonAdded(addedUser);
    setActiveDirectUserId(addedUser.id);
    if (!keepModalOpen) {
      setIsAddPersonModalOpen(false);
    }
    setNewPersonName('');
    setNewPersonEmail('');
    addToast('Person Added', `${addedUser.full_name} has been added to your Direct Messages.`, 'success');
  };

  const handleAddPersonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await addPersonRecord(newPersonName, newPersonEmail, newPersonRole, false);
  };

  // Filter channels and users
  const filteredChannels = useMemo(() => {
    if (!searchFilter.trim()) return channels;
    return channels.filter(c => c.name.toLowerCase().includes(searchFilter.toLowerCase()));
  }, [channels, searchFilter]);

  const filteredUsers = useMemo(() => {
    if (!searchFilter.trim()) return directMessageUsers;
    const q = searchFilter.toLowerCase();
    return directMessageUsers.filter(u => 
      (u.full_name && u.full_name.toLowerCase().includes(q)) ||
      u.email.toLowerCase().includes(q)
    );
  }, [directMessageUsers, searchFilter]);

  // Current typing names for active view (for DMs, only if peer user is actually online)
  const currentTargetId = activeDirectUserId || activeChannelId;
  const isCurrentDirectPeerOnline = activeDirectUser ? Boolean(findPresenceForUser(activeDirectUser)) : true;
  const currentTyping = isCurrentDirectPeerOnline ? (typingUsers[currentTargetId] || []) : [];

  return (
    <div className={`flex-1 flex flex-col min-h-full pb-6 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
      
      {/* 1. Refined, Minimal Workspace Chat Header */}
      <div className="px-4 md:px-6 pt-4 pb-0">
        <div className={`rounded-2xl px-5 py-3.5 border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          darkMode ? 'bg-slate-800/70 border-slate-700/80' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center gap-3 min-w-0">
            <span className="p-2 rounded-xl bg-indigo-500/15 text-indigo-500 dark:text-indigo-400 flex-shrink-0">
              <ICON_MAP.ChatBubbleLeftIcon className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                  Teams Hub & Chat
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <ICON_MAP.ShieldCheckIcon className="w-3 h-3" />
                  E2EE Direct Messages
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {channels.length} channels · {directMessageUsers.length + 1} members · End-to-end encrypted 1:1 conversations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setIsNewChannelModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                darkMode
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
              }`}
            >
              <ICON_MAP.PlusIcon className="w-3.5 h-3.5" />
              <span>New Channel</span>
            </button>

            <button
              onClick={() => setIsAddPersonModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <ICON_MAP.UserPlusIcon className="w-3.5 h-3.5" />
              <span>+ Direct Message</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Main MS Teams Split Layout */}
      <div className="flex p-4 md:p-6 h-[calc(100vh-5.5rem)] min-h-[620px] min-w-0 gap-4 overflow-hidden">
        
        {/* Left Sidebar: Channels & Direct Messages (320px) */}
        <div className={`w-72 md:w-80 flex flex-col flex-shrink-0 rounded-2xl border shadow-sm overflow-hidden ${
          darkMode ? 'bg-slate-800/60 border-slate-700/80' : 'bg-white border-slate-200'
        }`}>
          {/* Channel Search & Add */}
          <div className="p-3 border-b border-slate-200/80 dark:border-slate-700/80 space-y-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Find channels or people..."
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                  darkMode ? 'bg-slate-900/60 border-slate-700 text-white placeholder-slate-400' : 'bg-slate-100 border-slate-200 text-slate-900 placeholder-slate-400'
                }`}
              />
              <ICON_MAP.SearchIcon className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          {/* Navigation List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-4 scrollbar-thin">
            
            {/* Channels Section */}
            <div>
              <div className="flex items-center justify-between px-2 mb-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Channels ({filteredChannels.length})
                </span>
                <button
                  onClick={() => setIsNewChannelModalOpen(true)}
                  title="Create New Channel"
                  className="p-1 rounded-md text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer"
                >
                  <ICON_MAP.PlusIcon className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-0.5">
                {filteredChannels.map(channel => {
                  const isActive = !activeDirectUserId && activeChannelId === channel.id;
                  return (
                    <button
                      key={channel.id}
                      onClick={() => {
                        setActiveChannelId(channel.id);
                        setActiveDirectUserId(null);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className={`text-sm ${isActive ? 'text-white' : 'text-indigo-500'}`}>#</span>
                        <span className="truncate">{channel.name}</span>
                      </div>
                      {channel.isPrivate && (
                        <ICON_MAP.ShieldCheckIcon className="w-3.5 h-3.5 opacity-60 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Direct Messages (1:1) Section */}
            <div>
              <div className="px-2 mb-1 flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Direct Messages ({filteredUsers.length})
                </span>
                <button
                  onClick={() => setIsAddPersonModalOpen(true)}
                  title="Add Person to Direct Messages"
                  className="p-1 rounded-md text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer"
                >
                  <ICON_MAP.PlusIcon className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-0.5">
                {filteredUsers.length === 0 ? (
                  <div className="px-3 py-2 space-y-2">
                    <p className="text-[11px] text-slate-400 italic">No colleagues found</p>
                    <button
                      onClick={() => setIsAddPersonModalOpen(true)}
                      className="w-full py-1.5 px-2.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <ICON_MAP.PlusIcon className="w-3.5 h-3.5" />
                      Add Person
                    </button>
                  </div>
                ) : (
                  filteredUsers.map(user => {
                    const isActive = activeDirectUserId === user.id;
                    const userPresence = findPresenceForUser(user);
                    const isOnline = Boolean(userPresence);
                    const isUserTyping = isOnline && Boolean(typingUsers[user.id] && typingUsers[user.id].length > 0);
                    const userAvailability: 'available' | 'away' | 'busy' = getAvailabilityForUser(user, userPresence);
                    const statusDotClass = !isOnline
                      ? 'bg-slate-400'
                      : userAvailability === 'away'
                        ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.85)]'
                        : userAvailability === 'busy'
                          ? 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.85)]'
                          : 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]';
                    const statusLabel =
                      userAvailability === 'away'
                        ? 'Away'
                        : userAvailability === 'busy'
                          ? 'Busy / DND'
                          : 'Available';

                    return (
                      <button
                        key={user.id}
                        onClick={() => {
                          if (currentUser && (activeDirectUserId || activeChannelId)) {
                            chatService.broadcastTyping(
                              activeDirectUserId || activeChannelId,
                              currentUser,
                              false,
                              Boolean(activeDirectUserId)
                            );
                          }
                          setActiveDirectUserId(user.id);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left ${
                          isActive
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <div className="relative flex-shrink-0">
                            <Avatar user={user} size="sm" />
                            <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-800 ${statusDotClass}`} />
                          </div>
                          <div className="truncate">
                            <span className="block truncate">{user.full_name || user.email}</span>
                            <span className={`text-[10px] block truncate font-normal ${
                              isUserTyping
                                ? (isActive ? 'text-amber-200 font-bold animate-pulse' : 'text-indigo-500 dark:text-indigo-400 font-bold animate-pulse')
                                : (isActive ? 'text-indigo-200' : 'text-slate-400')
                            }`}>
                              {isUserTyping
                                ? '✍️ Typing...'
                                : isOnline
                                  ? `${statusLabel}${userPresence?.currentTaskId ? ' · Viewing task' : userPresence?.currentView === 'team_chat_view' ? ' · In chat' : ''}`
                                  : (user.role ? user.role.replace(/_/g, ' ') : 'Member')}
                            </span>
                          </div>
                        </div>

                        {isOnline && (
                          <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold flex-shrink-0 ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : userAvailability === 'away'
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                : userAvailability === 'busy'
                                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                                  : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          }`}>
                            {statusLabel}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}

                <div className="pt-1.5 px-1">
                  <button
                    type="button"
                    onClick={() => setIsAddPersonModalOpen(true)}
                    className="w-full py-1.5 px-2.5 rounded-xl border border-dashed border-indigo-400/50 hover:border-indigo-500 bg-indigo-500/5 hover:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ICON_MAP.UserPlusIcon className="w-3.5 h-3.5" />
                    <span>+ Add Another Person</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Main Pane: Active Conversation */}
        <div className={`flex-1 flex flex-col min-w-0 rounded-2xl border shadow-sm overflow-hidden ${
          darkMode ? 'bg-slate-800/40 border-slate-700/80' : 'bg-white border-slate-200'
        }`}>
          
          {/* Conversation Header */}
          <div className="p-4 border-b border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/40">
            <div className="flex items-center gap-3 min-w-0">
              {activeDirectUser ? (() => {
                const directPresence = findPresenceForUser(activeDirectUser);
                const isDirectUserOnline = Boolean(directPresence);
                const directTypingList = typingUsers[activeDirectUser.id] || [];
                const isDirectUserTyping = isDirectUserOnline && directTypingList.length > 0;
                const directAvailability: 'available' | 'away' | 'busy' = getAvailabilityForUser(activeDirectUser, directPresence);
                const e2eeFingerprint = currentUser ? getE2EEKeyFingerprint(currentUser.id, activeDirectUser.id) : '';
                const directDotClass = !isDirectUserOnline
                  ? 'bg-slate-400'
                  : directAvailability === 'away'
                    ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]'
                    : directAvailability === 'busy'
                      ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)]'
                      : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)] animate-pulse';
                const directStatusText =
                  directAvailability === 'away'
                    ? 'Away'
                    : directAvailability === 'busy'
                      ? 'Busy / DND'
                      : 'Available';
                return (
                  <>
                    <div className="relative flex-shrink-0">
                      <Avatar user={activeDirectUser} size="md" />
                      <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-white dark:ring-slate-900 ${directDotClass}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm font-black text-slate-900 dark:text-white truncate">
                          {activeDirectUser.full_name || activeDirectUser.email}
                        </h2>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                          {activeDirectUser.role ? activeDirectUser.role.replace(/_/g, ' ') : 'Member'}
                        </span>
                        <span
                          title={`End-to-End Encrypted with AES-256-GCM (Key Fingerprint: ${e2eeFingerprint})`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25"
                        >
                          <ICON_MAP.ShieldCheckIcon className="w-3 h-3" />
                          <span>E2EE · {e2eeFingerprint}</span>
                        </span>
                        {isDirectUserOnline && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            directAvailability === 'away'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30'
                              : directAvailability === 'busy'
                                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30'
                                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              directAvailability === 'away' ? 'bg-amber-400' : directAvailability === 'busy' ? 'bg-rose-500' : 'bg-emerald-500'
                            }`} />
                            {directStatusText}
                          </span>
                        )}
                        {isDirectUserTyping && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 animate-pulse">
                            ✍️ Typing...
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                        {isDirectUserTyping ? (
                          <span className="text-indigo-600 dark:text-indigo-400 font-bold animate-pulse">
                            {activeDirectUser.full_name || activeDirectUser.email} is typing a message...
                          </span>
                        ) : isDirectUserOnline ? (
                          <>
                            <span className={`w-1.5 h-1.5 rounded-full inline-block ${
                              directAvailability === 'away' ? 'bg-amber-400' : directAvailability === 'busy' ? 'bg-rose-500' : 'bg-emerald-500 animate-ping'
                            }`} />
                            <span className={`font-bold ${
                              directAvailability === 'away'
                                ? 'text-amber-600 dark:text-amber-400'
                                : directAvailability === 'busy'
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-emerald-600 dark:text-emerald-400'
                            }`}>
                              {directStatusText}{directPresence?.currentTaskId ? ' · Viewing task' : directPresence?.currentView === 'team_chat_view' ? ' · In Chat' : ''}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
                            <span className="text-slate-400 font-medium">Offline</span>
                          </>
                        )}
                        <span>·</span>
                        <span className="truncate">{activeDirectUser.email}</span>
                      </p>
                    </div>
                  </>
                );
              })() : activeChannel ? (
                <>
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-black text-lg flex items-center justify-center flex-shrink-0">
                    #
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-black text-slate-900 dark:text-white truncate">
                        #{activeChannel.name}
                      </h2>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {activeChannel.department}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {activeChannel.description}
                    </p>
                  </div>
                </>
              ) : null}
            </div>

            {/* Header Right: Real-time presence avatars */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-400 hidden sm:inline">Active Collabs:</span>
              <div className="flex -space-x-1.5 items-center">
                {users.slice(0, 4).map(u => (
                  <div key={u.id} className="ring-2 ring-white dark:ring-slate-900 rounded-full" title={u.full_name || u.email}>
                    <Avatar user={u} size="sm" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 scrollbar-thin">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                  <ICON_MAP.ChatBubbleLeftIcon className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {activeDirectUser ? `Direct message with ${activeDirectUser.full_name || activeDirectUser.email}` : `Welcome to #${activeChannel?.name}`}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                  Send a message to kick off the discussion. Messages and emoji reactions sync instantly across all devices.
                </p>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isMe = msg.sender_id === currentUser?.id;
                const formattedTime = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 group transition-all ${isMe ? 'flex-row-reverse' : ''}`}
                  >
                    {/* User Avatar */}
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center flex-shrink-0 overflow-hidden shadow-xs ring-1 ring-slate-200 dark:ring-slate-700">
                      {msg.sender_avatar ? (
                        <img src={msg.sender_avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        (msg.sender_name || 'U').charAt(0).toUpperCase()
                      )}
                    </div>

                    {/* Bubble Content */}
                    <div className={`space-y-1 max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className={`flex items-center gap-2 text-[10px] ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {isMe ? 'You' : msg.sender_name}
                        </span>
                        {msg.sender_role && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {msg.sender_role.replace(/_/g, ' ')}
                          </span>
                        )}
                        <span className="text-slate-400">{formattedTime}</span>
                        {(msg.is_encrypted || msg.recipient_id) && (
                          <span
                            title={`End-to-End Encrypted (AES-256-GCM${msg.key_fingerprint ? ` · Key ${msg.key_fingerprint}` : ''})`}
                            className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400"
                          >
                            <ICON_MAP.ShieldCheckIcon className="w-3 h-3" />
                            E2EE
                          </span>
                        )}
                      </div>

                      <div
                        className={`p-3.5 rounded-2xl text-xs leading-relaxed break-words shadow-xs ${
                          isMe
                            ? 'bg-indigo-600 text-white rounded-tr-xs'
                            : 'bg-slate-100 dark:bg-slate-700/80 text-slate-900 dark:text-slate-100 rounded-tl-xs'
                        }`}
                      >
                        {msg.content}
                      </div>

                      {/* Emoji Reactions Bar */}
                      <div className={`flex items-center gap-1.5 flex-wrap pt-0.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        {msg.reactions && Object.entries(msg.reactions).map(([emoji, userIds]) => {
                          if (userIds.length === 0) return null;
                          const hasReacted = userIds.includes(currentUser?.id || '');
                          return (
                            <button
                              key={emoji}
                              onClick={() => handleAddReaction(msg.id, emoji)}
                              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1 border transition-all cursor-pointer ${
                                hasReacted
                                  ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-400 text-indigo-700 dark:text-indigo-300'
                                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              <span>{emoji}</span>
                              <span className="text-[10px] font-bold">{userIds.length}</span>
                            </button>
                          );
                        })}

                        {/* Quick Add Reaction Hover Trigger */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                          {EMOJI_OPTIONS.slice(0, 4).map(emoji => (
                            <button
                              key={emoji}
                              onClick={() => handleAddReaction(msg.id, emoji)}
                              className="w-5 h-5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-xs transition-colors cursor-pointer"
                              title={`React with ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Typing Indicator Bar */}
          {currentTyping.length > 0 && (
            <div className="px-4 py-1.5 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200/60 dark:border-slate-800 flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 animate-pulse">
              <span className="flex space-x-1">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
              <span>{currentTyping.join(', ')} {currentTyping.length === 1 ? 'is' : 'are'} typing...</span>
            </div>
          )}

          {/* Modern Input Bar */}
          <div className="p-3 md:p-4 border-t border-slate-200/80 dark:border-slate-700/80 bg-slate-50/40 dark:bg-slate-900/30">
            <form onSubmit={handleSendMessage} className="space-y-2">
              <div className="relative">
                <textarea
                  value={inputText}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  rows={2}
                  placeholder={
                    activeDirectUser
                      ? `Message ${activeDirectUser.full_name || activeDirectUser.email}... (Enter to send, Shift+Enter for newline)`
                      : `Message #${activeChannel?.name || 'channel'}... (Enter to send, Shift+Enter for newline)`
                  }
                  className={`w-full p-3 pr-24 rounded-xl border text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500 resize-none ${
                    darkMode ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-400' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                />

                <div className="absolute right-2.5 bottom-3 flex items-center gap-1.5">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={!inputText.trim()}
                    className="rounded-lg gap-1.5"
                  >
                    <span>Send</span>
                    <ICON_MAP.ArrowRightIcon className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Quick Emojis strip */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                <div className="flex items-center gap-1">
                  <span>Quick react:</span>
                  {EMOJI_OPTIONS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setInputText(prev => prev + emoji)}
                      className="hover:scale-125 transition-transform p-0.5 cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <span>Markdown & code formatting supported</span>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* 3. New Channel Modal */}
      {isNewChannelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ICON_MAP.ChatBubbleLeftIcon className="w-5 h-5 text-indigo-500" />
                Create New Channel
              </h3>
              <button
                onClick={() => setIsNewChannelModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateChannelSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Channel Name</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">#</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. mobile-release, product-ops"
                    value={newChannelName}
                    onChange={e => setNewChannelName(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Department / Category</label>
                <select
                  value={newChannelDept}
                  onChange={e => setNewChannelDept(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:outline-hidden"
                >
                  <option value="Engineering">Engineering</option>
                  <option value="Product">Product</option>
                  <option value="Design">Design</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Operations">Operations</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="What is this channel about?"
                  value={newChannelDesc}
                  onChange={e => setNewChannelDesc(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsNewChannelModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit">
                  Create Channel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Add Person / Start Direct Message Modal */}
      {isAddPersonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500">
                  <ICON_MAP.UserPlusIcon className="w-5 h-5" />
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Add Person & Start Direct Chat
                </h3>
              </div>
              <button
                onClick={() => setIsAddPersonModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            {directMessageUsers.length > 0 && (
              <div className="space-y-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Quick Select Existing Person ({directMessageUsers.length})
                </label>
                <input
                  type="text"
                  placeholder="Filter existing people..."
                  value={directorySearch}
                  onChange={e => setDirectorySearch(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                />
                <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                  {directMessageUsers
                    .filter(u =>
                      !directorySearch.trim() ||
                      (u.full_name && u.full_name.toLowerCase().includes(directorySearch.toLowerCase())) ||
                      u.email.toLowerCase().includes(directorySearch.toLowerCase())
                    )
                    .map(u => {
                      const online = presences.some(p => p.userId === u.id);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setActiveDirectUserId(u.id);
                            setIsAddPersonModalOpen(false);
                          }}
                          className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-slate-700/60 text-left transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <Avatar user={u} size="sm" />
                            <div className="truncate">
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{u.full_name || u.email}</p>
                              <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            online ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                          }`}>
                            {online ? 'Online' : 'Message'}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Suggested Colleagues to Quick-Add */}
            {(() => {
              const availableSuggestions = SUGGESTED_COLLEAGUES.filter(
                sc => !directMessageUsers.some(u => u.email.toLowerCase() === sc.email.toLowerCase() || (u.full_name && u.full_name.toLowerCase() === sc.full_name.toLowerCase()))
              );
              if (availableSuggestions.length === 0) return null;
              return (
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Quick Add Colleagues
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {availableSuggestions.map(sc => (
                      <button
                        key={sc.id}
                        type="button"
                        onClick={() => addPersonRecord(sc.full_name, sc.email, sc.role, true)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        <ICON_MAP.PlusIcon className="w-3 h-3" />
                        <span>{sc.full_name}</span>
                        <span className="text-[9px] opacity-70">({sc.role.replace(/_/g, ' ')})</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            <form onSubmit={handleAddPersonSubmit} className="space-y-3 text-xs pt-2 border-t border-slate-100 dark:border-slate-700">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Add New Person by Details
              </p>
              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah Jenkins"
                  value={newPersonName}
                  onChange={e => setNewPersonName(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Email Address <span className="text-slate-400 font-normal">(optional)</span></label>
                <input
                  type="email"
                  placeholder="e.g. sarah@company.com (auto-generated if blank)"
                  value={newPersonEmail}
                  onChange={e => setNewPersonEmail(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Role</label>
                <select
                  value={newPersonRole}
                  onChange={e => setNewPersonRole(e.target.value as UserRole)}
                  className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={UserRole.DEVELOPER}>Developer</option>
                  <option value={UserRole.DESIGNER}>Designer</option>
                  <option value={UserRole.PROJECT_MANAGER}>Project Manager</option>
                  <option value={UserRole.QA_ENGINEER}>QA Engineer</option>
                  <option value={UserRole.MEMBER}>Team Member</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsAddPersonModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  disabled={!newPersonName.trim()}
                  onClick={() => addPersonRecord(newPersonName, newPersonEmail, newPersonRole, true)}
                >
                  + Add & Add Another
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={!newPersonName.trim()}>
                  Add & Start Chat
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
export default TeamsChatPage;
