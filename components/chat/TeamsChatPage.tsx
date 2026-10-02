import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { User, ChatMessage, ChatChannel, UserRole } from '../../types';
import chatService, { DEFAULT_CHANNELS } from '../../services/chatService';
import { Avatar } from '../shared/Avatar';
import { Button } from '../shared/Button';

const EMOJI_OPTIONS = ['👍', '❤️', '🚀', '🎉', '👀', '🔥', '👏', '💡'];

export const TeamsChatPage: React.FC = () => {
  const { users, currentUser, darkMode, activeProject, presences } = useAppStore();

  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string>('general');
  const [activeDirectUserId, setActiveDirectUserId] = useState<string | null>(null);
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  
  // Real-time typing indicators
  const [typingUsers, setTypingUsers] = useState<{ [targetId: string]: string[] }>({});
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // New channel modal
  const [isNewChannelModalOpen, setIsNewChannelModalOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [newChannelDept, setNewChannelDept] = useState('Engineering');

  // Realtime guide modal
  const [showRealtimeGuide, setShowRealtimeGuide] = useState(false);

  // User presence status
  const [myStatus, setMyStatus] = useState<'available' | 'away' | 'busy'>('available');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load channels on mount
  useEffect(() => {
    setChannels(chatService.getChannels());
  }, []);

  // Load messages when channel or direct user changes
  useEffect(() => {
    if (activeDirectUserId && currentUser) {
      setMessages(chatService.getDirectMessages(currentUser.id, activeDirectUserId));
    } else if (activeChannelId) {
      setMessages(chatService.getChannelMessages(activeChannelId));
    }
  }, [activeChannelId, activeDirectUserId, currentUser]);

  // Real-time message subscription
  useEffect(() => {
    const unsubscribeMessages = chatService.onMessage((incomingMessage) => {
      if (activeDirectUserId && currentUser) {
        if (
          (incomingMessage.sender_id === activeDirectUserId && incomingMessage.recipient_id === currentUser.id) ||
          (incomingMessage.sender_id === currentUser.id && incomingMessage.recipient_id === activeDirectUserId)
        ) {
          setMessages(prev => {
            if (prev.some(m => m.id === incomingMessage.id)) {
              return prev.map(m => m.id === incomingMessage.id ? incomingMessage : m);
            }
            return [...prev, incomingMessage];
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

    const unsubscribeTyping = chatService.onTyping((targetId, user, isTyping) => {
      setTypingUsers(prev => {
        const currentList = prev[targetId] || [];
        const userName = user.full_name || user.email;
        if (isTyping) {
          if (!currentList.includes(userName)) {
            return { ...prev, [targetId]: [...currentList, userName] };
          }
        } else {
          return { ...prev, [targetId]: currentList.filter(n => n !== userName) };
        }
        return prev;
      });
    });

    return () => {
      unsubscribeMessages();
      unsubscribeTyping();
    };
  }, [activeChannelId, activeDirectUserId, currentUser]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle typing input
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setInputText(text);

    if (!currentUser) return;
    const targetId = activeDirectUserId || activeChannelId;

    if (text.trim().length > 0) {
      chatService.broadcastTyping(targetId, currentUser, true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        chatService.broadcastTyping(targetId, currentUser, false);
      }, 2500);
    } else {
      chatService.broadcastTyping(targetId, currentUser, false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !currentUser) return;

    const content = inputText.trim();
    setInputText('');

    const targetId = activeDirectUserId || activeChannelId;
    chatService.broadcastTyping(targetId, currentUser, false);

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

  // Other users in organization (for DMs)
  const directMessageUsers = useMemo(() => {
    return users.filter(u => u.id !== currentUser?.id);
  }, [users, currentUser]);

  const activeChannel = channels.find(c => c.id === activeChannelId);
  const activeDirectUser = users.find(u => u.id === activeDirectUserId);

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

  // Current typing names for active view
  const currentTargetId = activeDirectUserId || activeChannelId;
  const currentTyping = typingUsers[currentTargetId] || [];

  return (
    <div className={`flex-1 flex flex-col h-full overflow-hidden ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
      
      {/* 1. Analytics & Collab Header Hero */}
      <div className="p-4 md:p-6 pb-0 flex-shrink-0">
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 shadow-xl border border-indigo-900/60 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#818cf8_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-400/30">
                  <ICON_MAP.ChatBubbleLeftIcon className="w-5 h-5" />
                </span>
                <span className="text-xs font-bold tracking-wider uppercase text-indigo-300">
                  Real-Time Workspace Messaging & Channels
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Live Sync
                </span>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white">
                Teams Hub & Chat
              </h1>
              <p className="text-xs text-indigo-200/80 max-w-xl">
                Collaborate instantly across engineering, design, and sprints. Direct messages, group channels, and real-time typing indicators.
              </p>
            </div>

            {/* Quick Actions & Testing Helper */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Presence Selector */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-xs">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  myStatus === 'available' ? 'bg-emerald-400' :
                  myStatus === 'away' ? 'bg-amber-400' : 'bg-rose-400'
                }`} />
                <select
                  value={myStatus}
                  onChange={e => setMyStatus(e.target.value as any)}
                  className="bg-transparent text-white text-xs font-semibold focus:outline-hidden cursor-pointer"
                >
                  <option value="available" className="bg-slate-900 text-white">Available</option>
                  <option value="away" className="bg-slate-900 text-white">Away</option>
                  <option value="busy" className="bg-slate-900 text-white">Busy / DND</option>
                </select>
              </div>

              {/* Real-time Guide Button */}
              <button
                onClick={() => setShowRealtimeGuide(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold shadow-md shadow-indigo-500/30 transition-all active:scale-95 cursor-pointer"
              >
                <ICON_MAP.BoltIcon className="w-3.5 h-3.5 text-amber-300" />
                <span>How to Test Real-Time</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-indigo-800/40 text-xs">
            <div>
              <span className="text-indigo-300 uppercase tracking-wider text-[10px] font-semibold">Active Channels</span>
              <p className="text-lg font-bold text-white mt-0.5">{channels.length} channels</p>
            </div>
            <div>
              <span className="text-indigo-300 uppercase tracking-wider text-[10px] font-semibold">Colleagues in Org</span>
              <p className="text-lg font-bold text-emerald-400 mt-0.5">{users.length} teammates</p>
            </div>
            <div>
              <span className="text-indigo-300 uppercase tracking-wider text-[10px] font-semibold">Active Project</span>
              <p className="text-lg font-bold text-indigo-200 mt-0.5 truncate">{activeProject?.name || 'Omni Workspace'}</p>
            </div>
            <div>
              <span className="text-indigo-300 uppercase tracking-wider text-[10px] font-semibold">Live WebSockets</span>
              <p className="text-lg font-bold text-emerald-300 mt-0.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Connected
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main MS Teams Split Layout */}
      <div className="flex-1 flex p-4 md:p-6 min-h-0 min-w-0 gap-4 overflow-hidden">
        
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
              </div>

              <div className="space-y-0.5">
                {filteredUsers.length === 0 ? (
                  <p className="px-3 py-2 text-[11px] text-slate-400 italic">No colleagues found</p>
                ) : (
                  filteredUsers.map(user => {
                    const isActive = activeDirectUserId === user.id;
                    const isOnline = presences.some(p => p.userId === user.id);

                    return (
                      <button
                        key={user.id}
                        onClick={() => {
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
                            <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-800 ${
                              isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                            }`} />
                          </div>
                          <div className="truncate">
                            <span className="block truncate">{user.full_name || user.email}</span>
                            <span className={`text-[10px] block truncate font-normal ${isActive ? 'text-indigo-200' : 'text-slate-400'}`}>
                              {user.role ? user.role.replace(/_/g, ' ') : 'Member'}
                            </span>
                          </div>
                        </div>

                        {isOnline && (
                          <span className={`w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0 ${isActive ? 'bg-white' : ''}`} />
                        )}
                      </button>
                    );
                  })
                )}
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
              {activeDirectUser ? (
                <>
                  <div className="relative">
                    <Avatar user={activeDirectUser} size="md" />
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-black text-slate-900 dark:text-white truncate">
                        {activeDirectUser.full_name || activeDirectUser.email}
                      </h2>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                        {activeDirectUser.role ? activeDirectUser.role.replace(/_/g, ' ') : 'Member'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      Direct 1:1 conversation · {activeDirectUser.email}
                    </p>
                  </div>
                </>
              ) : activeChannel ? (
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

      {/* 4. Real-Time Testing Guide Modal */}
      {showRealtimeGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500">
                  <ICON_MAP.BoltIcon className="w-5 h-5" />
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  How to Test Real-Time Collaboration
                </h3>
              </div>
              <button
                onClick={() => setShowRealtimeGuide(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 space-y-1">
                <p className="font-bold text-indigo-900 dark:text-indigo-200">
                  ⚡ Two-Window Instant Verification:
                </p>
                <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
                  You can verify every real-time feature in seconds using two browser windows side by side.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                  <p><strong>Open a Second Tab or Incognito Window:</strong> Navigate to this same app URL so you have two active clients open.</p>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                  <p><strong>Watch the Blinking Eye Viewer Circle:</strong> In Tab 1, open any task card modal. In Tab 2, immediately notice the glowing blinking eye circle appear on that exact card with live viewer count.</p>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                  <p><strong>Live Typing & Comments:</strong> Type in the task comments or Teams Chat input. Tab 2 will instantly show the "Typing..." animated bouncing indicator.</p>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
                  <p><strong>Sprint Planning & Task Moves:</strong> Move a backlog task to Active Sprint or change task status. The other tab updates automatically without page reloads.</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-700">
              <Button variant="primary" size="sm" onClick={() => setShowRealtimeGuide(false)}>
                Got it, let's collaborate!
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
export default TeamsChatPage;
