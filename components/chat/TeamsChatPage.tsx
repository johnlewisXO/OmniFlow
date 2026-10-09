import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import {
  User,
  ChatMessage,
  ChatChannel,
  UserRole,
  normalizeUserRole,
  UserPresence,
  CalendarEvent,
  CalendarEventCategory,
  RsvpStatus,
  VideoCallSession,
} from '../../types';
import chatService, { getE2EEKeyFingerprint } from '../../services/chatService';
import { collabService, formatAccurateLastSeen } from '../../services/collabService';
import supabaseService, { supabase, saveUserProfileExtension } from '../../services/supabaseService';
import emailNotificationService from '../../services/emailNotificationService';
import meetingAndCallService from '../../services/meetingAndCallService';
import { Avatar } from '../shared/Avatar';
import { Button } from '../shared/Button';

const EMOJI_OPTIONS = ['👍', '❤️', '🚀', '🎉', '👀', '🔥', '👏', '💡'];

const SUGGESTED_COLLEAGUES: Array<{ id: string; full_name: string; email: string; role: UserRole }> = [
  { id: 'seed-alex', full_name: 'Alex Rivera', email: 'alex.rivera@workspace.live', role: UserRole.PROJECT_MANAGER },
  { id: 'seed-sarah', full_name: 'Sarah Chen', email: 'sarah.chen@workspace.live', role: UserRole.MEMBER },
  { id: 'seed-marcus', full_name: 'Marcus Vance', email: 'marcus.vance@workspace.live', role: UserRole.MEMBER },
  { id: 'seed-elena', full_name: 'Elena Rostova', email: 'elena.rostova@workspace.live', role: UserRole.MEMBER },
  { id: 'seed-david', full_name: 'David Kim', email: 'david.kim@workspace.live', role: UserRole.MEMBER },
  { id: 'seed-priya', full_name: 'Priya Patel', email: 'priya.patel@workspace.live', role: UserRole.PROJECT_MANAGER },
];

const safeEmail = (u?: Partial<User> | null): string => {
  if (!u) return '';
  if (typeof u.email === 'string' && u.email.trim()) return u.email.trim();
  if (typeof u.full_name === 'string' && u.full_name.trim()) {
    return `${u.full_name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '.')}@workspace.live`;
  }
  return `${u.id || 'member'}@workspace.live`;
};

const safeName = (u?: Partial<User> | null): string => {
  if (!u) return 'Teammate';
  if (typeof u.full_name === 'string' && u.full_name.trim()) return u.full_name.trim();
  if (typeof u.email === 'string' && u.email.trim()) return u.email.split('@')[0];
  return 'Teammate';
};

const sanitizeUserRecord = (u: Partial<User> & { id: string }, fallbackOrgId?: string): User => {
  return {
    id: String(u.id),
    supabase_auth_id: u.supabase_auth_id || String(u.id),
    full_name: safeName(u),
    email: safeEmail(u),
    avatar_url: u.avatar_url,
    role: normalizeUserRole(u.role),
    organization_id: u.organization_id || fallbackOrgId,
  };
};

export const TeamsChatPage: React.FC = () => {
  const {
    users,
    setUsers,
    currentUser,
    darkMode,
    presences,
    updateUserPresence,
    fetchUsersForAssignmentList,
    addToast,
    setActiveView,
  } = useAppStore();

  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [ongoingOrgCalls, setOngoingOrgCalls] = useState<VideoCallSession[]>([]);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [schedTitle, setSchedTitle] = useState('');
  const [schedCategory, setSchedCategory] = useState<CalendarEventCategory>('sprint_planning');
  const [schedDate, setSchedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [schedStart, setSchedStart] = useState('14:00');
  const [schedEnd, setSchedEnd] = useState('14:45');
  const [schedNotes, setSchedNotes] = useState('');

  useEffect(() => {
    const unsubCal = meetingAndCallService.subscribeCalendar(evts => setCalendarEvents(evts));
    const unsubCall = meetingAndCallService.subscribeCallState(st => setOngoingOrgCalls(st.ongoingOrgCalls));
    return () => {
      unsubCal();
      unsubCall();
    };
  }, []);

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
  const [newChannelIsPrivate, setNewChannelIsPrivate] = useState(false);
  const [selectedNewChannelMemberIds, setSelectedNewChannelMemberIds] = useState<string[]>([]);

  // Channel Member Management modal
  const [isChannelMembersModalOpen, setIsChannelMembersModalOpen] = useState(false);
  const [channelMemberSearch, setChannelMemberSearch] = useState('');
  const [quickChannelPersonName, setQuickChannelPersonName] = useState('');
  const [quickChannelPersonEmail, setQuickChannelPersonEmail] = useState('');

  // Add Person / Direct Message modal
  const [isAddPersonModalOpen, setIsAddPersonModalOpen] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonEmail, setNewPersonEmail] = useState('');
  const [newPersonRole, setNewPersonRole] = useState<UserRole>(UserRole.MEMBER);
  const [directorySearch, setDirectorySearch] = useState('');
  const [customPeopleVersion, setCustomPeopleVersion] = useState(0);
  const [generatedInviteLinkInfo, setGeneratedInviteLinkInfo] = useState<{
    name: string;
    email: string;
    role: UserRole;
    inviteUrl: string;
    token: string;
  } | null>(null);
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
        if (payload.userEmail) next[String(payload.userEmail).toLowerCase()] = payload.availabilityStatus;
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

  // Load channels on mount & subscribe to real-time channel updates
  useEffect(() => {
    setChannels(chatService.getChannels());
    const unsubChannels = chatService.onChannelsChanged(updated => {
      setChannels(updated);
    });
    return () => unsubChannels();
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
    const unsubscribeMessages = chatService.onMessage(async incomingMessage => {
      if (activeDirectUserId && currentUser) {
        if (
          (incomingMessage.sender_id === activeDirectUserId && incomingMessage.recipient_id === currentUser.id) ||
          (incomingMessage.sender_id === currentUser.id && incomingMessage.recipient_id === activeDirectUserId)
        ) {
          const decryptedMsg = await chatService.decryptMessageForUser(incomingMessage, currentUser.id);
          setMessages(prev => {
            if (prev.some(m => m.id === decryptedMsg.id)) {
              return prev.map(m => (m.id === decryptedMsg.id ? decryptedMsg : m));
            }
            return [...prev, decryptedMsg];
          });
        }
      } else if (activeChannelId && incomingMessage.channel_id === activeChannelId) {
        setMessages(prev => {
          if (prev.some(m => m.id === incomingMessage.id)) {
            return prev.map(m => (m.id === incomingMessage.id ? incomingMessage : m));
          }
          return [...prev, incomingMessage];
        });
      }
    });

    const unsubscribeTyping = chatService.onTyping((targetId, user, isTyping, isDirect) => {
      if (!user || !user.id) return;
      if (currentUser && user.id === currentUser.id) return;

      const userName = safeName(user);
      const isChannelTarget = !isDirect && channels.some(c => c.id === targetId);
      const keysToUpdate = new Set<string>();

      if (isChannelTarget) {
        if (targetId) keysToUpdate.add(targetId);
      } else {
        if (!currentUser) return;
        const myEmailLower = safeEmail(currentUser).toLowerCase();
        const isIntendedForCurrentUser =
          targetId === currentUser.id ||
          (Boolean(myEmailLower) &&
            users.some(u => u.id === targetId && safeEmail(u).toLowerCase() === myEmailLower));

        if (!isIntendedForCurrentUser) {
          return;
        }

        keysToUpdate.add(user.id);
        const senderEmailLower = safeEmail(user).toLowerCase();
        if (senderEmailLower) {
          users.forEach(u => {
            if (safeEmail(u).toLowerCase() === senderEmailLower) {
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
              ? currentList.includes(userName)
                ? currentList
                : [...currentList, userName]
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

    const unsubscribePersonAdded = chatService.onPersonAdded(addedUser => {
      if (!addedUser || !addedUser.id) return;
      const cleanUser = sanitizeUserRecord(addedUser, currentUser?.organization_id);
      setCustomPeopleVersion(v => v + 1);
      const currentUsersList = useAppStore.getState().users || [];
      if (!currentUsersList.some(u => u.id === cleanUser.id)) {
        setUsers([...currentUsersList, cleanUser]);
      }
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

  // Strictly organization-verified colleagues for 1:1 Direct Messages and Channels
  const directMessageUsers = useMemo(() => {
    const map = new Map<string, User>();
    const myOrgId = currentUser?.organization_id;
    if (!myOrgId) return [];

    (users || []).forEach(u => {
      if (u && u.id && u.id !== currentUser?.id) {
        if (u.organization_id === myOrgId) {
          map.set(u.id, sanitizeUserRecord(u, myOrgId));
        }
      }
    });

    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('omni_custom_team_members');
        if (raw) {
          const customList: User[] = JSON.parse(raw);
          if (Array.isArray(customList)) {
            customList.forEach(cu => {
              if (cu && cu.id && cu.id !== currentUser?.id && !map.has(cu.id)) {
                if (cu.organization_id === myOrgId) {
                  map.set(cu.id, sanitizeUserRecord(cu, myOrgId));
                }
              }
            });
          }
        }
      } catch (e) {}
    }

    (presences || []).forEach(p => {
      if (p && p.userId && p.userId !== currentUser?.id && !map.has(p.userId)) {
        const pEmail = (p.userEmail || '').toLowerCase();
        const pName = (p.userName || '').toLowerCase();
        const matchingOrgUser = (users || []).find(
          u =>
            u.id === p.userId ||
            (pEmail && safeEmail(u).toLowerCase() === pEmail) ||
            (pName && safeName(u).toLowerCase() === pName)
        );
        if (matchingOrgUser && matchingOrgUser.organization_id === myOrgId) {
          map.set(matchingOrgUser.id, sanitizeUserRecord(matchingOrgUser, myOrgId));
        }
      }
    });
    return Array.from(map.values());
  }, [users, presences, currentUser, customPeopleVersion]);

  // Users discovered on the platform who are NOT in the current user's organization (must receive an invite link first)
  const externalNonOrgUsers = useMemo(() => {
    const myOrgId = currentUser?.organization_id;
    if (!myOrgId) return [];
    const orgIds = new Set(directMessageUsers.map(u => u.id));
    const orgEmails = new Set(directMessageUsers.map(u => safeEmail(u).toLowerCase()));
    return (users || []).filter(
      u =>
        u &&
        u.id &&
        u.id !== currentUser?.id &&
        u.organization_id !== myOrgId &&
        !orgIds.has(u.id) &&
        !orgEmails.has(safeEmail(u).toLowerCase())
    );
  }, [users, directMessageUsers, currentUser]);

  const handleCreateChannelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    const initialMemberIds = Array.from(
      new Set([
        ...(currentUser?.id ? [currentUser.id] : []),
        ...selectedNewChannelMemberIds,
      ])
    );

    const created = chatService.createChannel({
      name: newChannelName.trim(),
      description: newChannelDesc.trim() || 'Team collaboration channel',
      department: newChannelDept,
      isPrivate: newChannelIsPrivate,
      memberIds: initialMemberIds,
      membersCount: Math.max(initialMemberIds.length, 1),
    });

    setChannels(chatService.getChannels());
    setActiveChannelId(created.id);
    setActiveDirectUserId(null);
    setIsNewChannelModalOpen(false);
    setNewChannelName('');
    setNewChannelDesc('');
    setNewChannelIsPrivate(false);
    setSelectedNewChannelMemberIds([]);
    addToast(
      'Channel Created',
      `#${created.name} is live with ${initialMemberIds.length} member(s).`,
      'success'
    );
  };

  const findPresenceForUser = (user?: User | null): UserPresence | undefined => {
    if (!user) return undefined;
    const uEmail = safeEmail(user).toLowerCase();
    const uName = safeName(user).toLowerCase();
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
      const emailKey = safeEmail(user).toLowerCase();
      if (emailKey && teamStatuses[emailKey]) return teamStatuses[emailKey];
    }
    return 'available';
  };

  const activeChannel = channels.find(c => c.id === activeChannelId);
  const activeDirectUser =
    directMessageUsers.find(u => u.id === activeDirectUserId) ||
    (users || []).find(u => u.id === activeDirectUserId);

  // Members in the currently active channel
  const activeChannelMembers = useMemo(() => {
    if (!activeChannel) return [];
    const allOrgUsers = [
      ...(currentUser ? [sanitizeUserRecord(currentUser, currentUser.organization_id)] : []),
      ...directMessageUsers,
    ];
    if (activeChannel.memberIds && activeChannel.memberIds.length > 0) {
      const idSet = new Set(activeChannel.memberIds);
      const matched = allOrgUsers.filter(u => idSet.has(u.id));
      return matched.length > 0 ? matched : allOrgUsers;
    }
    return allOrgUsers;
  }, [activeChannel, currentUser, directMessageUsers]);

  const handleToggleChannelMember = (targetUser: User) => {
    if (!activeChannel) return;
    const currentMemberIds =
      activeChannel.memberIds && activeChannel.memberIds.length > 0
        ? [...activeChannel.memberIds]
        : activeChannelMembers.map(u => u.id);

    const isMember = currentMemberIds.includes(targetUser.id);
    let nextIds: string[];
    if (isMember) {
      if (targetUser.id === currentUser?.id && currentMemberIds.length <= 1) {
        addToast('Cannot Remove Last Member', 'A channel must have at least one member.', 'warning');
        return;
      }
      nextIds = currentMemberIds.filter(id => id !== targetUser.id);
      addToast('Removed from Channel', `${safeName(targetUser)} was removed from #${activeChannel.name}.`, 'info');
    } else {
      nextIds = [...currentMemberIds, targetUser.id];
      addToast('Added to Channel', `${safeName(targetUser)} was added to #${activeChannel.name}.`, 'success');
    }

    const updated = chatService.updateChannelMembers(activeChannel.id, nextIds);
    if (updated) {
      setChannels(chatService.getChannels());
    }
  };

  const generateInviteForNonOrgUser = async (
    nameInput: string,
    emailInput: string,
    roleInput: UserRole
  ) => {
    if (!currentUser) return;
    const cleanName = (nameInput || '').trim() || emailInput.split('@')[0] || 'Invitee';
    const cleanEmail = (emailInput || '').trim()
      ? emailInput.trim().toLowerCase()
      : `${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@external.org`;
    const normalizedRole = normalizeUserRole(roleInput);

    const invitation = await supabaseService.createInvitation({
      organization_id: currentUser.organization_id || 'org-default',
      email: cleanEmail,
      role: normalizedRole,
      invited_by: currentUser.id,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const orgName = useAppStore.getState().currentOrganization?.name || 'Omni Flow Workspace';
    const { inviteUrl } = await emailNotificationService.sendOrganizationInviteEmail({
      inviter: currentUser,
      organizationName: orgName,
      recipientEmail: cleanEmail,
      recipientName: cleanName,
      role: normalizedRole,
      inviteToken: invitation.token,
    });

    setGeneratedInviteLinkInfo({
      name: cleanName,
      email: cleanEmail,
      role: normalizedRole,
      inviteUrl,
      token: invitation.token,
    });

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(inviteUrl);
      }
    } catch (e) {}

    addToast(
      'Invite Link Generated & Sent',
      `${cleanName} (${cleanEmail}) is outside your organization. Invite link copied & emailed!`,
      'info'
    );
  };

  const handleSimulateInviteAccept = (inviteInfo: {
    name: string;
    email: string;
    role: UserRole;
    inviteUrl: string;
    token: string;
  }) => {
    if (!currentUser) return;
    const newId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

    const joinedUser = sanitizeUserRecord(
      {
        id: newId,
        full_name: inviteInfo.name,
        email: inviteInfo.email,
        role: inviteInfo.role,
        organization_id: currentUser.organization_id,
      },
      currentUser.organization_id
    );

    saveUserProfileExtension(newId, {
      organization_id: currentUser.organization_id,
      roleOverride: inviteInfo.role,
      emailVerified: true,
    });

    try {
      const raw = localStorage.getItem('omni_custom_team_members');
      const customList: User[] = raw ? JSON.parse(raw) : [];
      if (!customList.some(u => safeEmail(u).toLowerCase() === inviteInfo.email.toLowerCase())) {
        customList.push(joinedUser);
        localStorage.setItem('omni_custom_team_members', JSON.stringify(customList));
      }
    } catch (e) {}

    setCustomPeopleVersion(v => v + 1);
    const latestUsers = useAppStore.getState().users || [];
    const existingIdx = latestUsers.findIndex(
      u => safeEmail(u).toLowerCase() === inviteInfo.email.toLowerCase()
    );
    if (existingIdx >= 0) {
      const updated = [...latestUsers];
      updated[existingIdx] = { ...updated[existingIdx], organization_id: currentUser.organization_id };
      setUsers(updated);
      setActiveDirectUserId(updated[existingIdx].id);
    } else {
      setUsers([...latestUsers, joinedUser]);
      setActiveDirectUserId(joinedUser.id);
    }

    chatService.broadcastPersonAdded(joinedUser);
    setActiveChannelId('');
    setGeneratedInviteLinkInfo(null);
    setNewPersonName('');
    setNewPersonEmail('');
    setIsAddPersonModalOpen(false);
    addToast(
      'Teammate Joined Organization!',
      `${inviteInfo.name} accepted the invite link and is now in your E2EE Direct Messages.`,
      'success'
    );
  };

  const addPersonRecord = async (
    nameInput: string,
    emailInput: string,
    roleInput: UserRole,
    keepModalOpen = false,
    addToChannelId?: string
  ) => {
    try {
      const cleanName = (nameInput || '').trim();
      if (!cleanName) return;

      const cleanEmail = (emailInput || '').trim()
        ? emailInput.trim().toLowerCase()
        : `${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@workspace.live`;

      const normalizedRole = normalizeUserRole(roleInput);

      // 1. Check if user is ALREADY in our organization's Direct Message directory
      const existingInOrg = directMessageUsers.find(
        u =>
          safeEmail(u).toLowerCase() === cleanEmail ||
          safeName(u).toLowerCase() === cleanName.toLowerCase()
      );

      if (existingInOrg) {
        if (addToChannelId) {
          const targetChan = channels.find(c => c.id === addToChannelId);
          if (targetChan) {
            const currentIds =
              targetChan.memberIds && targetChan.memberIds.length > 0
                ? targetChan.memberIds
                : activeChannelMembers.map(m => m.id);
            if (!currentIds.includes(existingInOrg.id)) {
              chatService.updateChannelMembers(addToChannelId, [...currentIds, existingInOrg.id]);
              setChannels(chatService.getChannels());
            }
            addToast('Added to Channel', `${safeName(existingInOrg)} is now in #${targetChan.name}.`, 'success');
          }
          setQuickChannelPersonName('');
          setQuickChannelPersonEmail('');
          return;
        }

        setActiveDirectUserId(existingInOrg.id);
        setActiveChannelId('');
        if (!keepModalOpen) setIsAddPersonModalOpen(false);
        setNewPersonName('');
        setNewPersonEmail('');
        addToast('Opened Direct Chat', `Switched to conversation with ${safeName(existingInOrg)}.`, 'info');
        return;
      }

      // 2. Check if user exists in Supabase user_profiles AND belongs to our organization
      try {
        const { data: existingProfile } = await supabase
          .from('user_profiles')
          .select('*')
          .or(`email.ilike.${cleanEmail},full_name.ilike.${cleanName}`)
          .maybeSingle();

        if (
          existingProfile &&
          existingProfile.id &&
          currentUser?.organization_id &&
          existingProfile.organization_id === currentUser.organization_id
        ) {
          const orgMember = sanitizeUserRecord(
            {
              ...existingProfile,
              email: existingProfile.email || cleanEmail,
              full_name: existingProfile.full_name || cleanName,
              role: normalizeUserRole(existingProfile.role || normalizedRole),
            },
            currentUser.organization_id
          );
          const latestUsers = useAppStore.getState().users || [];
          if (!latestUsers.some(u => u.id === orgMember.id)) {
            setUsers([...latestUsers, orgMember]);
          }
          setActiveDirectUserId(orgMember.id);
          setActiveChannelId('');
          if (!keepModalOpen) setIsAddPersonModalOpen(false);
          addToast('Direct Chat Ready', `Started E2EE Direct Message with ${orgMember.full_name}.`, 'success');
          return;
        }
      } catch (err) {}

      // 3. User is NOT part of the current organization -> Generate & Send Organization Invite Link!
      await generateInviteForNonOrgUser(cleanName, cleanEmail, normalizedRole);
    } catch (err: any) {
      console.error('[TeamsChatPage] Error adding/inviting person to DM:', err);
      addToast('Could Not Process Request', err?.message || 'An unexpected error occurred.', 'error');
    }
  };

  const handleAddPersonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await addPersonRecord(newPersonName, newPersonEmail, newPersonRole, false);
  };

  const handleQuickAddPersonToChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickChannelPersonName.trim() || !activeChannel) return;
    await addPersonRecord(
      quickChannelPersonName,
      quickChannelPersonEmail,
      UserRole.MEMBER,
      true,
      activeChannel.id
    );
  };

  // Filter channels and users safely
  const filteredChannels = useMemo(() => {
    if (!searchFilter.trim()) return channels;
    const q = searchFilter.toLowerCase();
    return channels.filter(c => (c.name || '').toLowerCase().includes(q));
  }, [channels, searchFilter]);

  const filteredUsers = useMemo(() => {
    if (!searchFilter.trim()) return directMessageUsers;
    const q = searchFilter.toLowerCase();
    return directMessageUsers.filter(
      u => safeName(u).toLowerCase().includes(q) || safeEmail(u).toLowerCase().includes(q)
    );
  }, [directMessageUsers, searchFilter]);

  // Separate users into "Not Messaged Yet" and "Existing Conversations" for the Add DM Modal
  const { unmessagedUsers, messagedUsers } = useMemo(() => {
    const q = directorySearch.trim().toLowerCase();
    const matching = directMessageUsers.filter(
      u => !q || safeName(u).toLowerCase().includes(q) || safeEmail(u).toLowerCase().includes(q)
    );
    const unmessaged: User[] = [];
    const messaged: User[] = [];
    matching.forEach(u => {
      if (currentUser && chatService.hasDirectConversationHistory(currentUser.id, u.id)) {
        messaged.push(u);
      } else {
        unmessaged.push(u);
      }
    });
    return { unmessagedUsers: unmessaged, messagedUsers: messaged };
  }, [directMessageUsers, directorySearch, currentUser, messages]);

  const currentTargetId = activeDirectUserId || activeChannelId;
  const isCurrentDirectPeerOnline = activeDirectUser ? Boolean(findPresenceForUser(activeDirectUser)) : true;
  const currentTyping = isCurrentDirectPeerOnline ? typingUsers[currentTargetId] || [] : [];

  return (
    <div className={`flex-1 flex flex-col min-h-full pb-6 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
      {/* 1. Workspace Chat Header */}
      <div className="px-4 md:px-6 pt-4 pb-0">
        <div
          className={`rounded-2xl px-5 py-3.5 border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            darkMode ? 'bg-slate-800/70 border-slate-700/80' : 'bg-white border-slate-200'
          }`}
        >
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

          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveView('calendar_view')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                darkMode
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                  : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
              }`}
            >
              <ICON_MAP.CalendarIcon className="w-3.5 h-3.5 text-indigo-500" />
              <span>Calendar & RSVPs</span>
            </button>

            {!activeDirectUserId && activeChannel && (
              <button
                type="button"
                onClick={() => setIsChannelMembersModalOpen(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  darkMode
                    ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-indigo-300'
                    : 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-700'
                }`}
              >
                <ICON_MAP.UsersIcon className="w-3.5 h-3.5" />
                <span>Channel Members ({activeChannelMembers.length})</span>
              </button>
            )}

            <button
              type="button"
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
              type="button"
              onClick={() => setIsAddPersonModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <ICON_MAP.UserPlusIcon className="w-3.5 h-3.5" />
              <span>+ Direct Message</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Main Split Layout */}
      <div className="flex p-4 md:p-6 h-[calc(100vh-5.5rem)] min-h-[620px] min-w-0 gap-4 overflow-hidden">
        {/* Left Sidebar: Channels & Direct Messages */}
        <div
          className={`w-72 md:w-80 flex flex-col flex-shrink-0 rounded-2xl border shadow-sm overflow-hidden ${
            darkMode ? 'bg-slate-800/60 border-slate-700/80' : 'bg-white border-slate-200'
          }`}
        >
          {/* Channel Search */}
          <div className="p-3 border-b border-slate-200/80 dark:border-slate-700/80 space-y-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Find channels or people..."
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                  darkMode
                    ? 'bg-slate-900/60 border-slate-700 text-white placeholder-slate-400'
                    : 'bg-slate-100 border-slate-200 text-slate-900 placeholder-slate-400'
                }`}
              />
              <ICON_MAP.SearchIcon className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          {/* Navigation List */}
          <div data-bubble-scroll="true" className="flex-1 overflow-y-auto p-2 space-y-4 scrollbar-thin">
            {/* Channels Section */}
            <div>
              <div className="flex items-center justify-between px-2 mb-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Channels ({filteredChannels.length})
                </span>
                <button
                  type="button"
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
                  const memberCount =
                    channel.memberIds && channel.memberIds.length > 0
                      ? channel.memberIds.length
                      : directMessageUsers.length + 1;
                  return (
                    <button
                      key={channel.id}
                      type="button"
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
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={`text-[10px] font-mono ${isActive ? 'text-indigo-200' : 'text-slate-400'}`}>
                          {memberCount}
                        </span>
                        {channel.isPrivate && (
                          <ICON_MAP.ShieldCheckIcon className="w-3.5 h-3.5 opacity-60 flex-shrink-0" />
                        )}
                      </div>
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
                  type="button"
                  onClick={() => setIsAddPersonModalOpen(true)}
                  title="Start New Direct Message or Add Person"
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
                      type="button"
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
                    const lsInfo = formatAccurateLastSeen(userPresence, user.id, user.email, false);
                    const isUserTyping = isOnline && Boolean(typingUsers[user.id] && typingUsers[user.id].length > 0);
                    const userAvailability: 'available' | 'away' | 'busy' = lsInfo.isAwayFromTab
                      ? 'away'
                      : getAvailabilityForUser(user, userPresence);
                    const hasHistory = currentUser
                      ? chatService.hasDirectConversationHistory(currentUser.id, user.id)
                      : false;
                    const statusDotClass = !isOnline
                      ? 'bg-slate-400'
                      : userAvailability === 'away'
                      ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.85)]'
                      : userAvailability === 'busy'
                      ? 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.85)]'
                      : 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]';
                    const statusLabel = lsInfo.isAwayFromTab
                      ? 'Away from tab'
                      : userAvailability === 'away'
                      ? 'Away'
                      : userAvailability === 'busy'
                      ? 'Busy / DND'
                      : 'Available';

                    return (
                      <button
                        key={user.id}
                        type="button"
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
                          setActiveChannelId('');
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
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-800 ${statusDotClass}`}
                            />
                          </div>
                          <div className="truncate">
                            <span className="block truncate">{safeName(user)}</span>
                            <span
                              className={`text-[10px] block truncate font-normal ${
                                isUserTyping
                                  ? isActive
                                    ? 'text-amber-200 font-bold animate-pulse'
                                    : 'text-indigo-500 dark:text-indigo-400 font-bold animate-pulse'
                                  : isActive
                                  ? 'text-indigo-200'
                                  : 'text-slate-400'
                              }`}
                            >
                              {isUserTyping
                                ? '✍️ Typing...'
                                : isOnline
                                ? lsInfo.isAwayFromTab
                                  ? lsInfo.lastSeenText
                                  : `${statusLabel} · ${lsInfo.lastSeenText}`
                                : !hasHistory
                                ? `New · ${lsInfo.lastSeenText}`
                                : lsInfo.lastSeenText}
                            </span>
                          </div>
                        </div>

                        {isOnline && (
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold flex-shrink-0 ${
                              isActive
                                ? 'bg-white/20 text-white'
                                : userAvailability === 'away'
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                : userAvailability === 'busy'
                                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
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
        <div
          className={`flex-1 flex flex-col min-w-0 rounded-2xl border shadow-sm overflow-hidden ${
            darkMode ? 'bg-slate-800/40 border-slate-700/80' : 'bg-white border-slate-200'
          }`}
        >
          {/* Conversation Header */}
          <div className="p-4 border-b border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/40">
            <div className="flex items-center gap-3 min-w-0">
              {activeDirectUser ? (
                (() => {
                  const directPresence = findPresenceForUser(activeDirectUser);
                  const isDirectUserOnline = Boolean(directPresence);
                  const directLsInfo = formatAccurateLastSeen(
                    directPresence,
                    activeDirectUser.id,
                    activeDirectUser.email,
                    false
                  );
                  const directTypingList = typingUsers[activeDirectUser.id] || [];
                  const isDirectUserTyping = isDirectUserOnline && directTypingList.length > 0;
                  const directAvailability: 'available' | 'away' | 'busy' = directLsInfo.isAwayFromTab
                    ? 'away'
                    : getAvailabilityForUser(activeDirectUser, directPresence);
                  const e2eeFingerprint = currentUser
                    ? getE2EEKeyFingerprint(currentUser.id, activeDirectUser.id)
                    : '';
                  const directDotClass = !isDirectUserOnline
                    ? 'bg-slate-400'
                    : directAvailability === 'away'
                    ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]'
                    : directAvailability === 'busy'
                    ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)]'
                    : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)] animate-pulse';
                  const directStatusText = directLsInfo.isAwayFromTab
                    ? 'Away from tab'
                    : directAvailability === 'away'
                    ? 'Away'
                    : directAvailability === 'busy'
                    ? 'Busy / DND'
                    : 'Available';
                  return (
                    <>
                      <div className="relative flex-shrink-0">
                        <Avatar user={activeDirectUser} size="md" />
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-white dark:ring-slate-900 ${directDotClass}`}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-sm font-black text-slate-900 dark:text-white truncate">
                            {safeName(activeDirectUser)}
                          </h2>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                            {normalizeUserRole(activeDirectUser.role).replace(/_/g, ' ')}
                          </span>
                          <span
                            title={`End-to-End Encrypted with AES-256-GCM (Key Fingerprint: ${e2eeFingerprint})`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25"
                          >
                            <ICON_MAP.ShieldCheckIcon className="w-3 h-3" />
                            <span>E2EE · {e2eeFingerprint}</span>
                          </span>
                          {isDirectUserOnline && (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                directAvailability === 'away'
                                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30'
                                  : directAvailability === 'busy'
                                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30'
                                  : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  directAvailability === 'away'
                                    ? 'bg-amber-400'
                                    : directAvailability === 'busy'
                                    ? 'bg-rose-500'
                                    : 'bg-emerald-500'
                                }`}
                              />
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
                              {safeName(activeDirectUser)} is typing a message...
                            </span>
                          ) : isDirectUserOnline ? (
                            <>
                              <span
                                className={`w-1.5 h-1.5 rounded-full inline-block ${
                                  directAvailability === 'away'
                                    ? 'bg-amber-400'
                                    : directAvailability === 'busy'
                                    ? 'bg-rose-500'
                                    : 'bg-emerald-500 animate-ping'
                                }`}
                              />
                              <span
                                className={`font-bold ${
                                  directAvailability === 'away'
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : directAvailability === 'busy'
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : 'text-emerald-600 dark:text-emerald-400'
                                }`}
                              >
                                {directStatusText} · {directLsInfo.lastSeenText}
                                {directPresence?.currentTaskId
                                  ? ' · Viewing task'
                                  : directPresence?.currentView === 'team_chat_view'
                                  ? ' · In Chat'
                                  : ''}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
                              <span className="text-slate-400 font-medium">
                                Offline · {directLsInfo.lastSeenText}
                              </span>
                            </>
                          )}
                          <span>·</span>
                          <span className="truncate">{safeEmail(activeDirectUser)}</span>
                        </p>
                      </div>
                    </>
                  );
                })()
              ) : activeChannel ? (
                <>
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-black text-lg flex items-center justify-center flex-shrink-0">
                    #
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-sm font-black text-slate-900 dark:text-white truncate">
                        #{activeChannel.name}
                      </h2>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {activeChannel.department}
                      </span>
                      {activeChannel.isPrivate && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                          Private Group
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {activeChannel.description}
                    </p>
                  </div>
                </>
              ) : null}
            </div>

            {/* Header Right: Video Call, Audio Call, Schedule Meeting, Channel Members */}
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
              {/* Start Video Call (1:1 DM or Channel Group Call) */}
              <button
                type="button"
                onClick={() => {
                  if (!currentUser) return;
                  window.dispatchEvent(
                    new CustomEvent('omni_start_video_call', {
                      detail: {
                        title: activeDirectUser
                          ? `1:1 Video Call with ${safeName(activeDirectUser)}`
                          : `#${activeChannel?.name || 'general'} Team Video Huddle`,
                        type: activeDirectUser ? 'direct' : 'channel',
                        channelId: activeDirectUser ? undefined : activeChannel?.id,
                        directUser: activeDirectUser || undefined,
                        invitedUsers: activeDirectUser
                          ? [activeDirectUser]
                          : activeChannelMembers.filter(m => m.id !== currentUser.id),
                        initialVideo: true,
                        initialAudio: true,
                        showLobby: false,
                      },
                    })
                  );
                }}
                title={
                  activeDirectUser
                    ? `Start 1:1 Video Call with ${safeName(activeDirectUser)} (can add more people mid-call)`
                    : `Start Channel Video Call in #${activeChannel?.name}`
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <ICON_MAP.VideoCameraIcon className="w-3.5 h-3.5" />
                <span>{activeDirectUser ? '1:1 Video Call' : 'Meet Now'}</span>
              </button>

              {/* Audio Call Button */}
              <button
                type="button"
                onClick={() => {
                  if (!currentUser) return;
                  window.dispatchEvent(
                    new CustomEvent('omni_start_video_call', {
                      detail: {
                        title: activeDirectUser
                          ? `Voice Call with ${safeName(activeDirectUser)}`
                          : `#${activeChannel?.name || 'general'} Voice Huddle`,
                        type: activeDirectUser ? 'direct' : 'channel',
                        channelId: activeDirectUser ? undefined : activeChannel?.id,
                        directUser: activeDirectUser || undefined,
                        invitedUsers: activeDirectUser
                          ? [activeDirectUser]
                          : activeChannelMembers.filter(m => m.id !== currentUser.id),
                        initialVideo: false,
                        initialAudio: true,
                        showLobby: false,
                      },
                    })
                  );
                }}
                title="Start Voice-First Call"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                  darkMode
                    ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                    : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                <ICON_MAP.PhoneIcon className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Audio</span>
              </button>

              {/* Schedule Meeting & RSVP Button */}
              <button
                type="button"
                onClick={() => {
                  setSchedTitle(
                    activeDirectUser
                      ? `1:1 Sync: ${safeName(currentUser)} & ${safeName(activeDirectUser)}`
                      : `#${activeChannel?.name || 'team'} Sprint & Project Sync`
                  );
                  setSchedCategory(activeDirectUser ? 'one_on_one' : 'sprint_planning');
                  setSchedNotes(
                    activeDirectUser
                      ? 'Agenda: Quick 1:1 alignment on current sprint priorities and blockers.'
                      : 'Agenda: Review sprint progress, upcoming deliverables, and team blockers.'
                  );
                  setIsScheduleModalOpen(true);
                }}
                title="Schedule Calendar Meeting & Send RSVP Invites"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                  darkMode
                    ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-indigo-300'
                    : 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-700'
                }`}
              >
                <ICON_MAP.CalendarIcon className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Schedule</span>
              </button>

              {!activeDirectUser && activeChannel && (
                <button
                  type="button"
                  onClick={() => setIsChannelMembersModalOpen(true)}
                  title="Add or manage people in this channel"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <ICON_MAP.UserPlusIcon className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">+ Add to #{activeChannel.name}</span>
                </button>
              )}

              <div className="flex -space-x-1.5 items-center">
                {(activeDirectUser ? [activeDirectUser] : activeChannelMembers.slice(0, 5)).map(u => (
                  <div
                    key={u.id}
                    className="ring-2 ring-white dark:ring-slate-900 rounded-full"
                    title={safeName(u)}
                  >
                    <Avatar user={u} size="sm" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Active Video Call Banner in Current Conversation */}
          {(() => {
            const activeConvCall = ongoingOrgCalls.find(c =>
              activeDirectUser
                ? c.directUserId === activeDirectUser.id
                : c.channelId === activeChannel?.id
            );
            if (!activeConvCall) return null;
            return (
              <div className="px-4 py-2.5 bg-emerald-600/15 border-b border-emerald-500/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping flex-shrink-0" />
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 truncate">
                    Live Video Call: {activeConvCall.title}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 hidden sm:inline">
                    · {activeConvCall.participants.length} in call · {activeConvCall.meetingCode}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!currentUser) return;
                    meetingAndCallService.startOrJoinCall({
                      currentUser,
                      title: activeConvCall.title,
                      type: activeConvCall.type,
                      meetingCode: activeConvCall.meetingCode,
                      channelId: activeConvCall.channelId,
                      postCallCardToChat: false,
                    });
                  }}
                  className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer flex-shrink-0"
                >
                  <ICON_MAP.VideoCameraIcon className="w-3.5 h-3.5" />
                  <span>Join Call</span>
                </button>
              </div>
            );
          })()}

          {/* Messages Stream */}
          <div data-bubble-scroll="true" className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 scrollbar-thin">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                  <ICON_MAP.ChatBubbleLeftIcon className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {activeDirectUser
                    ? `Direct message with ${safeName(activeDirectUser)}`
                    : `Welcome to #${activeChannel?.name}`}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                  {activeDirectUser
                    ? 'Your 1:1 messages are End-to-End Encrypted with AES-256-GCM. Send a message below to start the conversation.'
                    : 'Send a message to kick off the discussion or add teammates to this channel.'}
                </p>
              </div>
            ) : (
              messages.map(msg => {
                const isMe = msg.sender_id === currentUser?.id;
                const formattedTime = new Date(msg.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 group transition-all ${isMe ? 'flex-row-reverse' : ''}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center flex-shrink-0 overflow-hidden shadow-xs ring-1 ring-slate-200 dark:ring-slate-700">
                      {msg.sender_avatar ? (
                        <img src={msg.sender_avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        (msg.sender_name || 'U').charAt(0).toUpperCase()
                      )}
                    </div>

                    <div className={`space-y-1 max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className={`flex items-center gap-2 text-[10px] ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {isMe ? 'You' : msg.sender_name}
                        </span>
                        {msg.sender_role && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {normalizeUserRole(msg.sender_role).replace(/_/g, ' ')}
                          </span>
                        )}
                        <span className="text-slate-400">{formattedTime}</span>
                        {(msg.is_encrypted || msg.recipient_id) && (
                          <span
                            title={`End-to-End Encrypted (AES-256-GCM${
                              msg.key_fingerprint ? ` · Key ${msg.key_fingerprint}` : ''
                            })`}
                            className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400"
                          >
                            <ICON_MAP.ShieldCheckIcon className="w-3 h-3" />
                            E2EE
                          </span>
                        )}
                      </div>

                      {(() => {
                        const rawContent = msg.content || '';
                        if (rawContent.startsWith('[MEETING_INVITE:')) {
                          const closeBracket = rawContent.indexOf(']');
                          let parsedMeta: any = null;
                          if (closeBracket > 0) {
                            try {
                              parsedMeta = JSON.parse(rawContent.slice(16, closeBracket));
                            } catch {}
                          }
                          const liveEvent =
                            (parsedMeta?.eventId &&
                              calendarEvents.find(e => e.id === parsedMeta.eventId)) ||
                            null;
                          const title = liveEvent?.title || parsedMeta?.title || 'Scheduled Meeting';
                          const startTime = liveEvent?.startTime || parsedMeta?.startTime;
                          const meetingCode = liveEvent?.meetingCode || parsedMeta?.meetingCode || 'omni-live';
                          const organizerName =
                            liveEvent?.organizerName || parsedMeta?.organizerName || msg.sender_name;
                          const myRsvp = liveEvent?.attendees.find(
                            a => a.userId === currentUser?.id
                          )?.rsvp;
                          const goingCount = liveEvent
                            ? liveEvent.attendees.filter(a => a.rsvp === 'going').length
                            : 1;
                          const maybeCount = liveEvent
                            ? liveEvent.attendees.filter(a => a.rsvp === 'maybe').length
                            : 0;
                          const pendingCount = liveEvent
                            ? liveEvent.attendees.filter(a => a.rsvp === 'pending').length
                            : 0;

                          return (
                            <div
                              className={`p-4 rounded-2xl border shadow-sm space-y-3 min-w-[270px] sm:min-w-[330px] ${
                                darkMode
                                  ? 'bg-slate-900/95 border-indigo-500/40 text-slate-100'
                                  : 'bg-white border-indigo-200 text-slate-900'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-0.5">
                                  <div className="text-[10px] font-semibold text-indigo-500">
                                    Calendar Meeting Invite · Room {meetingCode}
                                  </div>
                                  <h4 className="text-sm font-bold">{title}</h4>
                                  {startTime && (
                                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                                      {new Date(startTime).toLocaleString([], {
                                        weekday: 'short',
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </div>
                                  )}
                                  <div className="text-[11px] text-slate-400">
                                    Requested by {organizerName} · {goingCount} Going · {maybeCount} Maybe ·{' '}
                                    {pendingCount} Pending
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!currentUser) return;
                                    window.dispatchEvent(
                                      new CustomEvent('omni_start_video_call', {
                                        detail: {
                                          title,
                                          type: 'scheduled',
                                          meetingCode,
                                          calendarEvent: liveEvent || undefined,
                                          invitedUsers: activeDirectUser
                                            ? [activeDirectUser]
                                            : activeChannelMembers.filter(m => m.id !== currentUser.id),
                                          showLobby: true,
                                        },
                                      })
                                    );
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 flex-shrink-0 cursor-pointer"
                                >
                                  <ICON_MAP.VideoCameraIcon className="w-3.5 h-3.5" />
                                  <span>Join Call</span>
                                </button>
                              </div>

                              {/* Interactive RSVP Buttons inside Chat Card */}
                              {liveEvent && currentUser && (
                                <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2">
                                  <span className="text-[11px] font-semibold text-slate-400">
                                    Your RSVP:
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    {(
                                      [
                                        { id: 'going', label: '✓ Going' },
                                        { id: 'maybe', label: '? Maybe' },
                                        { id: 'declined', label: '✕ Decline' },
                                      ] as const
                                    ).map(opt => {
                                      const active = myRsvp === opt.id;
                                      return (
                                        <button
                                          key={opt.id}
                                          type="button"
                                          onClick={() => {
                                            meetingAndCallService.updateRsvp(
                                              liveEvent.id,
                                              currentUser,
                                              opt.id
                                            );
                                            addToast(
                                              'RSVP Updated',
                                              `Responded "${opt.label}" to "${liveEvent.title}".`,
                                              'success'
                                            );
                                          }}
                                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                                            active
                                              ? opt.id === 'going'
                                                ? 'bg-emerald-600 text-white border-emerald-500'
                                                : opt.id === 'maybe'
                                                ? 'bg-amber-500 text-slate-950 border-amber-400'
                                                : 'bg-rose-600 text-white border-rose-500'
                                              : darkMode
                                              ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                                              : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                                          }`}
                                        >
                                          {opt.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        }

                        if (rawContent.startsWith('[VIDEO_CALL:')) {
                          const closeBracket = rawContent.indexOf(']');
                          let parsedCall: any = null;
                          if (closeBracket > 0) {
                            try {
                              parsedCall = JSON.parse(rawContent.slice(12, closeBracket));
                            } catch {}
                          }
                          const callTitle = parsedCall?.title || 'Team Video Call';
                          const meetingCode = parsedCall?.meetingCode || 'omni-live';

                          return (
                            <div
                              className={`p-3.5 rounded-2xl border shadow-xs flex items-center justify-between gap-4 min-w-[260px] ${
                                darkMode
                                  ? 'bg-slate-900/95 border-emerald-500/40 text-white'
                                  : 'bg-emerald-50/60 border-emerald-200 text-slate-900'
                              }`}
                            >
                              <div className="space-y-0.5">
                                <div className="text-[10px] font-semibold text-emerald-500">
                                  Live Video Room · {meetingCode}
                                </div>
                                <div className="text-xs font-bold">{callTitle}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!currentUser) return;
                                  window.dispatchEvent(
                                    new CustomEvent('omni_start_video_call', {
                                      detail: {
                                        title: callTitle,
                                        type: activeDirectUser ? 'direct' : 'channel',
                                        meetingCode,
                                        channelId: activeDirectUser ? undefined : activeChannel?.id,
                                        directUser: activeDirectUser || undefined,
                                        invitedUsers: activeDirectUser
                                          ? [activeDirectUser]
                                          : activeChannelMembers.filter(m => m.id !== currentUser.id),
                                        postCallCardToChat: false,
                                      },
                                    })
                                  );
                                }}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer flex-shrink-0"
                              >
                                <ICON_MAP.VideoCameraIcon className="w-3.5 h-3.5" />
                                <span>Join Video</span>
                              </button>
                            </div>
                          );
                        }

                        return (
                          <div
                            className={`p-3.5 rounded-2xl text-xs leading-relaxed break-words shadow-xs transition-transform duration-200 ${
                              isMe
                                ? 'bg-indigo-600 text-white rounded-tr-xs'
                                : 'bg-slate-100 dark:bg-slate-700/80 text-slate-900 dark:text-slate-100 rounded-tl-xs'
                            }`}
                          >
                            {msg.content}
                          </div>
                        );
                      })()}

                      {/* Emoji Reactions Bar */}
                      <div
                        className={`flex items-center gap-1.5 flex-wrap pt-0.5 ${
                          isMe ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {msg.reactions &&
                          Object.entries(msg.reactions).map(([emoji, userIds]) => {
                            if (userIds.length === 0) return null;
                            const hasReacted = userIds.includes(currentUser?.id || '');
                            return (
                              <button
                                key={emoji}
                                type="button"
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

                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                          {EMOJI_OPTIONS.slice(0, 4).map(emoji => (
                            <button
                              key={emoji}
                              type="button"
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
              <span>
                {currentTyping.join(', ')} {currentTyping.length === 1 ? 'is' : 'are'} typing...
              </span>
            </div>
          )}

          {/* Input Bar */}
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
                      ? `Message ${safeName(activeDirectUser)}... (Enter to send, Shift+Enter for newline)`
                      : `Message #${activeChannel?.name || 'channel'}... (Enter to send, Shift+Enter for newline)`
                  }
                  className={`w-full p-3 pr-24 rounded-xl border text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500 resize-none ${
                    darkMode
                      ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-400'
                      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
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

      {/* 3. Create New Channel & Add Members Modal */}
      {isNewChannelModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => setIsNewChannelModalOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-modal-appear"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ICON_MAP.ChatBubbleLeftIcon className="w-5 h-5 text-indigo-500" />
                Create New Channel / Group
              </h3>
              <button
                type="button"
                onClick={() => setIsNewChannelModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateChannelSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Channel Name</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">#</span>
                    <input
                      type="text"
                      required
                      placeholder="e.g. mobile-release"
                      value={newChannelName}
                      onChange={e => setNewChannelName(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Department</label>
                  <select
                    value={newChannelDept}
                    onChange={e => setNewChannelDept(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Product">Product</option>
                    <option value="Design">Design</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Operations">Operations</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Description</label>
                <input
                  type="text"
                  placeholder="What is this channel or group for?"
                  value={newChannelDesc}
                  onChange={e => setNewChannelDesc(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* Select Initial Channel Members */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Add Team Members ({selectedNewChannelMemberIds.length} selected)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedNewChannelMemberIds.length === directMessageUsers.length) {
                        setSelectedNewChannelMemberIds([]);
                      } else {
                        setSelectedNewChannelMemberIds(directMessageUsers.map(u => u.id));
                      }
                    }}
                    className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    {selectedNewChannelMemberIds.length === directMessageUsers.length ? 'Clear All' : 'Select All'}
                  </button>
                </div>
                <div className="max-h-36 overflow-y-auto p-2 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1 scrollbar-thin">
                  {directMessageUsers.map(u => {
                    const checked = selectedNewChannelMemberIds.includes(u.id);
                    return (
                      <label
                        key={u.id}
                        className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 cursor-pointer"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setSelectedNewChannelMemberIds(prev =>
                                checked ? prev.filter(id => id !== u.id) : [...prev, u.id]
                              );
                            }}
                          />
                          <Avatar user={u} size="sm" />
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {safeName(u)}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {normalizeUserRole(u.role).replace(/_/g, ' ')}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newChannelIsPrivate}
                  onChange={e => setNewChannelIsPrivate(e.target.checked)}
                />
                <span className="text-slate-700 dark:text-slate-300 font-medium">
                  Make this a private invite-only group channel
                </span>
              </label>

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

      {/* 4. Manage / Add People to Active Channel Modal */}
      {isChannelMembersModalOpen && activeChannel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => setIsChannelMembersModalOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-modal-appear"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ICON_MAP.UsersIcon className="w-5 h-5 text-indigo-500" />
                  <span>Manage Members in #{activeChannel.name}</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Add or remove teammates from this channel. Updates sync in real time.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsChannelMembersModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <input
              type="text"
              placeholder="Search teammates to add or remove..."
              value={channelMemberSearch}
              onChange={e => setChannelMemberSearch(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600"
            />

            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
              {directMessageUsers
                .filter(
                  u =>
                    !channelMemberSearch.trim() ||
                    safeName(u).toLowerCase().includes(channelMemberSearch.toLowerCase()) ||
                    safeEmail(u).toLowerCase().includes(channelMemberSearch.toLowerCase())
                )
                .map(u => {
                  const inChannel = activeChannelMembers.some(m => m.id === u.id);
                  return (
                    <div
                      key={u.id}
                      className="flex items-center justify-between p-2 rounded-xl border border-slate-200/60 dark:border-slate-700/60"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Avatar user={u} size="sm" />
                        <div className="truncate">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {safeName(u)}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">{safeEmail(u)}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleChannelMember(u)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          inChannel
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-rose-500/15 hover:text-rose-500'
                            : 'bg-indigo-600 text-white hover:bg-indigo-500'
                        }`}
                      >
                        {inChannel ? '✓ In Channel' : '+ Add to Channel'}
                      </button>
                    </div>
                  );
                })}
            </div>

            {/* Quick Add Brand-New Person directly to Channel */}
            <form
              onSubmit={handleQuickAddPersonToChannel}
              className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2.5 text-xs"
            >
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Add New Person Directly to #{activeChannel.name}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  placeholder="Full Name (e.g. Jordan Lee)"
                  value={quickChannelPersonName}
                  onChange={e => setQuickChannelPersonName(e.target.value)}
                  className="p-2 rounded-xl border text-xs"
                />
                <input
                  type="email"
                  placeholder="Email (optional)"
                  value={quickChannelPersonEmail}
                  onChange={e => setQuickChannelPersonEmail(e.target.value)}
                  className="p-2 rounded-xl border text-xs"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsChannelMembersModalOpen(false)}>
                  Done
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={!quickChannelPersonName.trim()}>
                  + Add Person to #{activeChannel.name}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Add Person / Start Direct Message Modal */}
      {isAddPersonModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => setIsAddPersonModalOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-modal-appear max-h-[90vh] overflow-y-auto scrollbar-thin"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500">
                  <ICON_MAP.UserPlusIcon className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Start Direct Message or Add Teammate
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Message anyone in your organization or add a new colleague to E2EE Direct Messages.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddPersonModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {directMessageUsers.length > 0 && (
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Search teammates by name or email..."
                  value={directorySearch}
                  onChange={e => setDirectorySearch(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                />

                {/* Section A: Users you haven't messaged yet */}
                {unmessagedUsers.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      Start New Conversation · Not Messaged Yet ({unmessagedUsers.length})
                    </label>
                    <div className="max-h-36 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                      {unmessagedUsers.map(u => {
                        const online = Boolean(findPresenceForUser(u));
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              setActiveDirectUserId(u.id);
                              setActiveChannelId('');
                              setIsAddPersonModalOpen(false);
                              addToast('Direct Chat Ready', `Started E2EE chat with ${safeName(u)}.`, 'success');
                            }}
                            className="w-full flex items-center justify-between p-2 rounded-xl bg-indigo-500/5 hover:bg-indigo-500/15 border border-indigo-500/20 text-left transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              <Avatar user={u} size="sm" />
                              <div className="truncate">
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                                  {safeName(u)}
                                </p>
                                <p className="text-[10px] text-slate-400 truncate">{safeEmail(u)}</p>
                              </div>
                            </div>
                            <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[10px] font-bold flex-shrink-0">
                              {online ? '● Start Chat' : 'Start Chat →'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Section B: Existing Direct Message Contacts */}
                {messagedUsers.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Active Conversations ({messagedUsers.length})
                    </label>
                    <div className="max-h-28 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                      {messagedUsers.map(u => {
                        const online = Boolean(findPresenceForUser(u));
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              setActiveDirectUserId(u.id);
                              setActiveChannelId('');
                              setIsAddPersonModalOpen(false);
                            }}
                            className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/60 text-left transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              <Avatar user={u} size="sm" />
                              <div className="truncate">
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                                  {safeName(u)}
                                </p>
                                <p className="text-[10px] text-slate-400 truncate">{safeEmail(u)}</p>
                              </div>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                online
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                              }`}
                            >
                              {online ? 'Online' : 'Open Chat'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Non-Organization Users Detected on Platform (Require Invite Link) */}
            {externalNonOrgUsers.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-700">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Outside Your Organization · Invite Link Required ({externalNonOrgUsers.length})
                </label>
                <div className="max-h-28 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                  {externalNonOrgUsers.map(extUser => (
                    <div
                      key={extUser.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-amber-500/5 border border-amber-500/20"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Avatar user={extUser} size="sm" />
                        <div className="truncate">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                            {safeName(extUser)}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {safeEmail(extUser)} · Not in Organization
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          generateInviteForNonOrgUser(
                            safeName(extUser),
                            safeEmail(extUser),
                            normalizeUserRole(extUser.role)
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold flex-shrink-0 cursor-pointer"
                      >
                        Send Invite Link
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggested External Colleagues to Invite via Link */}
            {(() => {
              const availableSuggestions = SUGGESTED_COLLEAGUES.filter(
                sc =>
                  !directMessageUsers.some(
                    u =>
                      safeEmail(u).toLowerCase() === sc.email.toLowerCase() ||
                      safeName(u).toLowerCase() === sc.full_name.toLowerCase()
                  )
              );
              if (availableSuggestions.length === 0) return null;
              return (
                <div className="space-y-1.5 pt-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    External Contacts · Click to Generate Invite Link
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {availableSuggestions.map(sc => (
                      <button
                        key={sc.id}
                        type="button"
                        onClick={() => generateInviteForNonOrgUser(sc.full_name, sc.email, sc.role)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        <ICON_MAP.PlusIcon className="w-3 h-3" />
                        <span>Invite {sc.full_name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Generated Organization Invite Link Callout */}
            {generatedInviteLinkInfo && (
              <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 space-y-2.5 animate-popup-in">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-300">
                      External User · Organization Invite Link Required
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white mt-1">
                      Invite Link Created for {generatedInviteLinkInfo.name} ({generatedInviteLinkInfo.email})
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Only organization members can join Direct Messages. Share this invite link (also emailed to them) so they can join your organization:
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGeneratedInviteLinkInfo(null)}
                    className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    readOnly
                    value={generatedInviteLinkInfo.inviteUrl}
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[10px]"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard?.writeText(generatedInviteLinkInfo.inviteUrl);
                      addToast('Invite Link Copied', 'Copied organization invite URL to clipboard.', 'success');
                    }}
                  >
                    Copy Link
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('omni_open_email_center', { detail: { tab: 'outbox' } }));
                    }}
                    className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    ✉️ View Sent Invite Email in Outbox →
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSimulateInviteAccept(generatedInviteLinkInfo)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold cursor-pointer"
                  >
                    ⚡ Simulate {generatedInviteLinkInfo.name} Accepting Invite
                  </button>
                </div>
              </div>
            )}

            <form
              onSubmit={handleAddPersonSubmit}
              className="space-y-3 text-xs pt-2 border-t border-slate-100 dark:border-slate-700"
            >
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Find Org Member or Send External Invite Link
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  If the person is already in your organization, chat opens immediately. Otherwise, an Organization Invite Link will be generated and emailed.
                </p>
              </div>
              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah Jenkins"
                  value={newPersonName}
                  onChange={e => setNewPersonName(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. sarah@company.com"
                  value={newPersonEmail}
                  onChange={e => setNewPersonEmail(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Role Upon Joining</label>
                <select
                  value={newPersonRole}
                  onChange={e => setNewPersonRole(normalizeUserRole(e.target.value))}
                  className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                >
                  <option value={UserRole.MEMBER}>Member</option>
                  <option value={UserRole.PROJECT_MANAGER}>Project Manager</option>
                  <option value={UserRole.ADMIN}>Administrator</option>
                  <option value={UserRole.CLIENT_VIEWER}>Client Viewer</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsAddPersonModalOpen(false)}>
                  Close
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={!newPersonName.trim()}>
                  Start Chat or Generate Invite Link
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Quick Schedule Meeting & Send RSVP Invite Modal */}
      {isScheduleModalOpen && currentUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => setIsScheduleModalOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-modal-appear"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ICON_MAP.CalendarIcon className="w-5 h-5 text-indigo-500" />
                  <span>
                    {activeDirectUser
                      ? `Schedule 1:1 Meeting with ${safeName(activeDirectUser)}`
                      : `Schedule Channel Meeting in #${activeChannel?.name || 'general'}`}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Sends Calendar + Chat invites so all attendees can RSVP (Going / Maybe / Decline)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async e => {
                e.preventDefault();
                if (!schedTitle.trim()) return;
                const startIso = new Date(`${schedDate}T${schedStart}:00`).toISOString();
                const endIso = new Date(`${schedDate}T${schedEnd}:00`).toISOString();
                const invitees = activeDirectUser
                  ? [activeDirectUser]
                  : activeChannelMembers.filter(m => m.id !== currentUser.id);

                const created = await meetingAndCallService.scheduleMeeting({
                  title: schedTitle.trim(),
                  description: schedNotes.trim(),
                  category: schedCategory,
                  startTime: startIso,
                  endTime: endIso,
                  organizer: currentUser,
                  invitedUsers: invitees,
                  channelId: activeDirectUser ? undefined : activeChannel?.id,
                  directUserId: activeDirectUser?.id,
                  prepNotes: schedNotes.trim(),
                  agenda: [
                    {
                      id: `ag-${Date.now()}-1`,
                      title: 'Kickoff & Sprint / Project Status Alignment',
                      durationMinutes: 15,
                      completed: false,
                      presenterName: safeName(currentUser),
                    },
                    {
                      id: `ag-${Date.now()}-2`,
                      title: 'Blockers, Decisions & Next Steps',
                      durationMinutes: 15,
                      completed: false,
                    },
                  ],
                  postToChat: true,
                });

                setMessages(
                  chatService.getMessages(
                    activeChannelId,
                    activeDirectUserId || undefined,
                    currentUser.id
                  )
                );
                setIsScheduleModalOpen(false);
                addToast(
                  'Meeting Scheduled & RSVP Sent',
                  `Invited ${invitees.length} ${
                    invitees.length === 1 ? 'person' : 'people'
                  } to "${created.title}".`,
                  'success'
                );
              }}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Meeting Title *
                </label>
                <input
                  type="text"
                  required
                  value={schedTitle}
                  onChange={e => setSchedTitle(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Meeting Category
                  </label>
                  <select
                    value={schedCategory}
                    onChange={e => setSchedCategory(e.target.value as CalendarEventCategory)}
                    className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                  >
                    <option value="sprint_planning">Sprint Planning & Prep</option>
                    <option value="project_update">Project Update & Review</option>
                    <option value="sprint_retro">Sprint Retrospective</option>
                    <option value="one_on_one">1:1 Sync</option>
                    <option value="daily_standup">Daily Standup</option>
                    <option value="team_workshop">Architecture Workshop</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={schedDate}
                    onChange={e => setSchedDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Start Time
                  </label>
                  <input
                    type="time"
                    required
                    value={schedStart}
                    onChange={e => setSchedStart(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    End Time
                  </label>
                  <input
                    type="time"
                    required
                    value={schedEnd}
                    onChange={e => setSchedEnd(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Meeting Agenda & Sprint Prep Notes
                </label>
                <textarea
                  rows={2}
                  value={schedNotes}
                  onChange={e => setSchedNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 resize-none"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    setIsScheduleModalOpen(false);
                    setActiveView('calendar_view');
                  }}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  Open Full Calendar View →
                </button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => setIsScheduleModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" type="submit">
                    Send Invite & Request RSVP
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default TeamsChatPage;
