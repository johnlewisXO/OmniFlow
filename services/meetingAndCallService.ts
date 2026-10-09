import {
  CalendarEvent,
  CalendarEventCategory,
  CalendarAttendee,
  MeetingAgendaItem,
  RsvpStatus,
  User,
  UserRole,
  VideoCallSession,
  VideoCallParticipant,
  Project,
  Sprint,
  Task,
} from '../types';
import { supabase } from './supabaseService';
import chatService from './chatService';
import emailNotificationService from './emailNotificationService';
import { collabService } from './collabService';

const STORAGE_KEY_CALENDAR_EVENTS = 'omni_calendar_events_v2';
const STORAGE_KEY_ACTIVE_CALLS = 'omni_active_video_calls_v3';

export interface IncomingCallInvite {
  callId: string;
  meetingCode: string;
  title: string;
  type: 'direct' | 'channel' | 'scheduled';
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  callerRole?: UserRole;
  targetUserIds: string[];
  channelId?: string;
  directUserId?: string;
  calendarEventId?: string;
  timestamp: string;
}

export interface LiveCallReaction {
  id: string;
  callId: string;
  senderId: string;
  senderName: string;
  emoji: string;
  timestamp: number;
}

type CalendarListener = (events: CalendarEvent[]) => void;
type CallStateListener = (state: {
  activeCall: VideoCallSession | null;
  ongoingOrgCalls: VideoCallSession[];
  incomingInvite: IncomingCallInvite | null;
  isMinimized: boolean;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  remoteScreenFrames: Map<string, string>;
  remoteCameraFrames: Map<string, string>;
  reactions: LiveCallReaction[];
}) => void;

export const generateMeetingCode = (): string => {
  const seg = () =>
    Math.random()
      .toString(36)
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 3)
      .padEnd(3, 'x');
  return `omni-${seg()}-${seg()}`;
};

class MeetingAndCallService {
  private events: CalendarEvent[] = [];
  private ongoingCalls = new Map<string, VideoCallSession>();
  private activeCallId: string | null = null;
  private isMinimized = false;
  private incomingInvite: IncomingCallInvite | null = null;

  private calendarListeners = new Set<CalendarListener>();
  private callListeners = new Set<CallStateListener>();

  private broadcastChannel: BroadcastChannel | null = null;
  private supabaseChannel: any = null;

  // WebRTC & Real-Time Media Transport state
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private remoteStreams = new Map<string, MediaStream>();
  private remoteScreenFrames = new Map<string, string>();
  private remoteCameraFrames = new Map<string, string>();
  private participantHeartbeats = new Map<string, number>();
  private peerConnections = new Map<string, RTCPeerConnection>();
  private reactions: LiveCallReaction[] = [];
  private audioContext: AudioContext | null = null;
  private audioMonitorInterval: ReturnType<typeof setInterval> | null = null;
  private callCleanupInterval: ReturnType<typeof setInterval> | null = null;
  private screenFrameInterval: ReturnType<typeof setInterval> | null = null;
  private cameraFrameInterval: ReturnType<typeof setInterval> | null = null;
  private lastSupabaseScreenBroadcast = 0;
  private lastSupabaseCameraBroadcast = 0;

  constructor() {
    this.loadStoredEvents();
    this.loadStoredOngoingCalls();
    this.initRealtimeChannels();
    this.initStorageSync();
  }

  public isUserOnlineInOrg(userId: string): boolean {
    if (!userId) return false;
    if (this.localUserId && userId === this.localUserId) return true;
    const hb = this.participantHeartbeats.get(userId);
    if (hb && Date.now() - hb < 25000) return true;
    const presences = collabService.getActivePresences();
    return presences.some(p => p.userId === userId);
  }

  private loadStoredEvents() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CALENDAR_EVENTS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.events = parsed;
        }
      }
    } catch (e) {}
  }

  private persistEvents() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_CALENDAR_EVENTS, JSON.stringify(this.events));
    } catch (e) {}
    this.notifyCalendarListeners();
    window.dispatchEvent(new CustomEvent('omni_calendar_events_updated', { detail: this.events }));
  }

  private loadStoredOngoingCalls() {
    if (typeof window === 'undefined') return;
    try {
      // Remove legacy v1/v2 keys that had simulated participants
      localStorage.removeItem('omni_active_video_calls_v1');
      localStorage.removeItem('omni_active_video_calls_v2');
      const raw = localStorage.getItem(STORAGE_KEY_ACTIVE_CALLS);
      if (raw) {
        const parsed = JSON.parse(raw) as VideoCallSession[];
        const now = Date.now();
        if (Array.isArray(parsed)) {
          parsed.forEach(c => {
            if (c && c.id && now - new Date(c.startedAt).getTime() < 30 * 60 * 1000) {
              this.ongoingCalls.set(c.id, c);
            }
          });
        }
      }
    } catch (e) {}
  }

  private persistOngoingCalls() {
    if (typeof window === 'undefined') return;
    try {
      const list = Array.from(this.ongoingCalls.values());
      localStorage.setItem(STORAGE_KEY_ACTIVE_CALLS, JSON.stringify(list));
    } catch (e) {}
    this.notifyCallListeners();
  }

  private initStorageSync() {
    if (typeof window === 'undefined') return;
    window.addEventListener('storage', (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_CALENDAR_EVENTS && e.newValue) {
        try {
          this.events = JSON.parse(e.newValue);
          this.notifyCalendarListeners();
        } catch {}
      } else if (e.key === STORAGE_KEY_ACTIVE_CALLS && e.newValue) {
        try {
          const list = JSON.parse(e.newValue) as VideoCallSession[];
          this.ongoingCalls.clear();
          list.forEach(c => this.ongoingCalls.set(c.id, c));
          this.notifyCallListeners();
        } catch {}
      }
    });

    this.callCleanupInterval = setInterval(() => {
      const now = Date.now();
      let changed = false;
      this.reactions = this.reactions.filter(r => {
        const keep = now - r.timestamp < 4200;
        if (!keep) changed = true;
        return keep;
      });

      // Broadcast active call heartbeat for local connected user & prune offline/unanswered participants
      if (this.activeCallId && this.localUserId) {
        this.participantHeartbeats.set(this.localUserId, now);
        this.broadcastPacket('CALL_HEARTBEAT', {
          callId: this.activeCallId,
          userId: this.localUserId,
          ts: now,
        });

        const activeCall = this.ongoingCalls.get(this.activeCallId);
        if (activeCall) {
          let participantsChanged = false;
          const nextParticipants = activeCall.participants.map(p => {
            if (p.userId === this.localUserId) return p;

            // Timeout unanswered ringing participants after 45 seconds
            if (p.connectionState === 'ringing') {
              const invitedMs = p.joinedAt ? new Date(p.joinedAt).getTime() : now;
              if (now - invitedMs > 45000) {
                participantsChanged = true;
                return { ...p, connectionState: 'left' as const };
              }
            }

            // Ensure connected remote participants are actually online or sending heartbeats
            if (p.connectionState === 'connected') {
              const hb = this.participantHeartbeats.get(p.userId) || 0;
              const joinedMs = p.joinedAt ? new Date(p.joinedAt).getTime() : 0;
              const isOnlineInCollab = this.isUserOnlineInOrg(p.userId);
              const recentlyJoined = now - joinedMs < 20000;
              if (now - hb > 25000 && !isOnlineInCollab && !recentlyJoined) {
                participantsChanged = true;
                this.remoteScreenFrames.delete(p.userId);
                this.remoteCameraFrames.delete(p.userId);
                return { ...p, connectionState: 'left' as const, isScreenSharing: false, isSpeaking: false };
              }
            }
            return p;
          });

          if (participantsChanged) {
            const updated = { ...activeCall, participants: nextParticipants };
            this.ongoingCalls.set(activeCall.id, updated);
            this.persistOngoingCalls();
            changed = false;
          }
        }
      }

      if (changed) {
        this.notifyCallListeners();
      }
    }, 2500);
  }

  private initRealtimeChannels() {
    if (typeof window === 'undefined') return;

    if ('BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('omni_meetings_live_v1');
        this.broadcastChannel.onmessage = event => {
          if (event?.data) {
            this.handleRealtimePacket(event.data);
          }
        };
      } catch (e) {}
    }

    try {
      this.supabaseChannel = supabase
        .channel('omni_meetings_realtime_v1', {
          config: { broadcast: { self: false } },
        })
        .on('broadcast', { event: 'meeting_signal' }, payload => {
          if (payload?.payload) {
            this.handleRealtimePacket(payload.payload);
          }
        })
        .subscribe();
    } catch (e) {}
  }

  private broadcastPacket(type: string, payload: any, localOnly = false) {
    const packet = { type, payload, ts: Date.now() };
    try {
      this.broadcastChannel?.postMessage(packet);
    } catch (e) {}
    if (!localOnly) {
      try {
        if (this.supabaseChannel) {
          this.supabaseChannel.send({
            type: 'broadcast',
            event: 'meeting_signal',
            payload: packet,
          });
        }
      } catch (e) {}
    }
  }

  private handleRealtimePacket(packet: { type: string; payload: any }) {
    if (!packet || !packet.type) return;
    const { type, payload } = packet;

    switch (type) {
      case 'CALENDAR_EVENT_UPSERT': {
        const ev = payload as CalendarEvent;
        if (!ev || !ev.id) return;
        const idx = this.events.findIndex(e => e.id === ev.id);
        const isNew = idx < 0;
        if (idx >= 0) {
          this.events[idx] = ev;
        } else {
          this.events = [ev, ...this.events];
        }
        this.persistEvents();
        if (isNew) {
          window.dispatchEvent(new CustomEvent('omni_remote_calendar_invite', { detail: ev }));
        }
        break;
      }

      case 'CALENDAR_EVENT_DELETED': {
        const { eventId } = payload || {};
        if (!eventId) return;
        this.events = this.events.filter(e => e.id !== eventId);
        this.persistEvents();
        break;
      }

      case 'CALENDAR_RSVP_UPDATED': {
        const { eventId, attendee, eventTitle } = payload || {};
        const target = this.events.find(e => e.id === eventId);
        if (target && attendee) {
          const existingIdx = target.attendees.findIndex(a => a.userId === attendee.userId);
          if (existingIdx >= 0) {
            target.attendees[existingIdx] = attendee;
          } else {
            target.attendees.push(attendee);
          }
          this.persistEvents();
          window.dispatchEvent(
            new CustomEvent('omni_remote_rsvp_updated', {
              detail: { eventId, eventTitle: eventTitle || target.title, attendee, organizerId: target.organizerId },
            })
          );
        }
        break;
      }

      case 'CALL_HEARTBEAT': {
        const { callId, userId, ts } = payload || {};
        if (userId) {
          this.participantHeartbeats.set(userId, ts || Date.now());
        }
        if (callId && this.activeCallId === callId && userId && userId !== this.localUserId) {
          const call = this.ongoingCalls.get(callId);
          if (call && !this.peerConnections.has(userId)) {
            this.initiateWebRTCMeshForCall(call, this.localUserId || call.hostId);
          }
        }
        break;
      }

      case 'CALL_SESSION_SYNC': {
        const session = payload as VideoCallSession;
        if (!session || !session.id) return;
        session.participants.forEach(p => {
          if (p.connectionState === 'connected') {
            this.participantHeartbeats.set(p.userId, Date.now());
          } else {
            this.remoteScreenFrames.delete(p.userId);
            this.remoteCameraFrames.delete(p.userId);
          }
          if (!p.isScreenSharing) {
            this.remoteScreenFrames.delete(p.userId);
          }
          if (p.isCameraOff) {
            this.remoteCameraFrames.delete(p.userId);
          }
        });
        if (session.participants.filter(p => p.connectionState === 'connected' || p.connectionState === 'ringing').length === 0) {
          this.ongoingCalls.delete(session.id);
          if (this.activeCallId === session.id) {
            this.cleanupLocalCallState();
          }
        } else {
          this.ongoingCalls.set(session.id, session);
          if (this.activeCallId === session.id && this.localUserId) {
            this.initiateWebRTCMeshForCall(session, this.localUserId);
          }
        }
        this.persistOngoingCalls();
        break;
      }

      case 'CALL_DECLINED': {
        const { callId, userId, userName } = payload || {};
        if (!callId || !userId) return;
        const call = this.ongoingCalls.get(callId);
        if (call) {
          const updatedParticipants = call.participants.map(p =>
            p.userId === userId ? { ...p, connectionState: 'declined' as const, isSpeaking: false } : p
          );
          const declineMsg = {
            id: `cmsg-decline-${Date.now()}`,
            senderId: userId,
            senderName: userName || 'Teammate',
            text: `${userName || 'Teammate'} declined the call.`,
            timestamp: new Date().toISOString(),
          };
          const updatedCall: VideoCallSession = {
            ...call,
            participants: updatedParticipants,
            chatMessages: [...call.chatMessages, declineMsg],
          };
          this.ongoingCalls.set(callId, updatedCall);
          this.persistOngoingCalls();
        }
        window.dispatchEvent(
          new CustomEvent('omni_remote_call_declined', {
            detail: { callId, userId, userName: userName || 'Teammate' },
          })
        );
        break;
      }

      case 'CALL_SCREEN_FRAME': {
        const { callId, userId, frame } = payload || {};
        if (!callId || callId !== this.activeCallId || !userId || !frame) return;
        this.remoteScreenFrames.set(userId, frame);
        this.participantHeartbeats.set(userId, Date.now());
        this.notifyCallListeners();
        break;
      }

      case 'CALL_SCREEN_STOPPED': {
        const { callId, userId } = payload || {};
        if (!callId || !userId) return;
        this.remoteScreenFrames.delete(userId);
        this.notifyCallListeners();
        break;
      }

      case 'CALL_CAMERA_FRAME': {
        const { callId, userId, frame } = payload || {};
        if (!callId || callId !== this.activeCallId || !userId || !frame) return;
        this.remoteCameraFrames.set(userId, frame);
        this.participantHeartbeats.set(userId, Date.now());
        this.notifyCallListeners();
        break;
      }

      case 'CALL_CAMERA_STOPPED': {
        const { callId, userId } = payload || {};
        if (!callId || !userId) return;
        this.remoteCameraFrames.delete(userId);
        this.notifyCallListeners();
        break;
      }

      case 'CALL_SESSION_ENDED': {
        const { callId } = payload || {};
        if (!callId) return;
        this.ongoingCalls.delete(callId);
        if (this.activeCallId === callId) {
          this.cleanupLocalCallState();
        }
        if (this.incomingInvite?.callId === callId) {
          this.incomingInvite = null;
        }
        this.persistOngoingCalls();
        break;
      }

      case 'CALL_INVITE_RINGING': {
        const invite = payload as IncomingCallInvite;
        if (!invite || !invite.callId) return;
        window.dispatchEvent(new CustomEvent('omni_incoming_call_invite', { detail: invite }));
        break;
      }

      case 'CALL_REACTION': {
        const reaction = payload as LiveCallReaction;
        if (!reaction || reaction.callId !== this.activeCallId) return;
        if (!this.reactions.some(r => r.id === reaction.id)) {
          this.reactions = [...this.reactions, reaction];
          this.notifyCallListeners();
        }
        break;
      }

      case 'WEBRTC_SIGNAL': {
        this.handleWebRTCSignal(payload);
        break;
      }
    }
  }

  // ============================================================================
  // CALENDAR & RSVP MANAGEMENT
  // ============================================================================

  public ensureSeededEvents(
    currentUser: User | null,
    orgUsers: User[],
    projects: Project[],
    sprints: Sprint[]
  ): CalendarEvent[] {
    if (!currentUser) return this.events;
    if (this.events.length > 0) return this.events;

    const now = new Date();
    const todayAt = (hours: number, minutes = 0, dayOffset = 0) => {
      const d = new Date(now);
      d.setDate(d.getDate() + dayOffset);
      d.setHours(hours, minutes, 0, 0);
      return d.toISOString();
    };

    const colleagues = orgUsers.filter(
      u => u.id !== currentUser.id && (!currentUser.organization_id || u.organization_id === currentUser.organization_id)
    );

    const buildAttendees = (organizer: User, invitees: User[], defaultStatuses?: RsvpStatus[]): CalendarAttendee[] => {
      const list: CalendarAttendee[] = [
        {
          userId: organizer.id,
          name: organizer.full_name || organizer.email.split('@')[0],
          email: organizer.email,
          avatar: organizer.avatar_url,
          role: organizer.role,
          rsvp: 'going',
          rsvpNote: 'Organizer & Host',
          respondedAt: new Date().toISOString(),
        },
      ];
      invitees.forEach((u, idx) => {
        if (!list.some(a => a.userId === u.id)) {
          list.push({
            userId: u.id,
            name: u.full_name || u.email.split('@')[0],
            email: u.email,
            avatar: u.avatar_url,
            role: u.role,
            rsvp: defaultStatuses?.[idx] || (idx === 0 ? 'pending' : 'going'),
            respondedAt: defaultStatuses?.[idx] && defaultStatuses[idx] !== 'pending' ? new Date().toISOString() : undefined,
          });
        }
      });
      return list;
    };

    const primaryProject = projects[0];
    const activeSprint = sprints.find(s => s.status === 'active') || sprints[0];
    const leadColleague = colleagues[0] || currentUser;

    const seeded: CalendarEvent[] = [
      {
        id: 'evt-sprint-planning-seed',
        title: activeSprint ? `${activeSprint.name} — Sprint Planning & Capacity Prep` : 'Sprint Planning & Velocity Calibration',
        description:
          'Review backlog story points, finalize dependency chains, confirm individual weekly capacity, and lock sprint commitments.',
        category: 'sprint_planning',
        startTime: todayAt(11, 0, 0),
        endTime: todayAt(12, 0, 0),
        organizerId: leadColleague.id,
        organizerName: leadColleague.full_name || leadColleague.email,
        organizerEmail: leadColleague.email,
        organizerAvatar: leadColleague.avatar_url,
        organizationId: currentUser.organization_id,
        projectId: primaryProject?.id,
        sprintId: activeSprint?.id,
        channelId: 'chan-engineering',
        meetingCode: generateMeetingCode(),
        attendees: buildAttendees(
          leadColleague,
          [currentUser, ...colleagues.slice(1, 4)],
          ['pending', 'going', 'going', 'maybe']
        ),
        agenda: [
          {
            id: 'ag-1',
            title: 'Review previous sprint velocity & carryover items',
            durationMinutes: 15,
            completed: true,
            presenterName: leadColleague.full_name || 'Sprint Lead',
          },
          {
            id: 'ag-2',
            title: 'Walk through high-priority backlog tickets & Fibonacci story points',
            durationMinutes: 25,
            completed: false,
            presenterName: currentUser.full_name || currentUser.email,
          },
          {
            id: 'ag-3',
            title: 'Identify technical blockers, API dependencies & QA owners',
            durationMinutes: 20,
            completed: false,
          },
        ],
        prepNotes:
          'Please ensure all P0/P1 tickets have story point estimates and acceptance criteria before joining the call.',
        recurrence: 'biweekly',
        created_at: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: 'evt-project-update-seed',
        title: primaryProject ? `${primaryProject.name} — Executive Project Update & Demo` : 'Stakeholder Project Health & Milestone Sync',
        description:
          'Live walkthrough of deliverable progress, risk mitigation status, and upcoming release milestones across engineering and product.',
        category: 'project_update',
        startTime: todayAt(15, 0, 1),
        endTime: todayAt(15, 45, 1),
        organizerId: currentUser.id,
        organizerName: currentUser.full_name || currentUser.email,
        organizerEmail: currentUser.email,
        organizerAvatar: currentUser.avatar_url,
        organizationId: currentUser.organization_id,
        projectId: primaryProject?.id,
        channelId: 'chan-product',
        meetingCode: generateMeetingCode(),
        attendees: buildAttendees(currentUser, colleagues.slice(0, 4), ['going', 'going', 'pending', 'maybe']),
        agenda: [
          {
            id: 'ag-p1',
            title: 'Executive KPI review & release burn-up trajectory',
            durationMinutes: 15,
            completed: false,
            presenterName: currentUser.full_name || currentUser.email,
          },
          {
            id: 'ag-p2',
            title: 'Live feature demonstration & QA sign-off',
            durationMinutes: 20,
            completed: false,
          },
          {
            id: 'ag-p3',
            title: 'Stakeholder Q&A and next-week priorities',
            durationMinutes: 10,
            completed: false,
          },
        ],
        prepNotes: 'Prepare live screen share of the staging environment and updated burndown metrics.',
        recurrence: 'weekly',
        created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
      },
      {
        id: 'evt-daily-standup-seed',
        title: 'Daily Engineering & Product Standup',
        description: 'Quick 15-minute sync on yesterday progress, today focus, and any active blockers.',
        category: 'daily_standup',
        startTime: todayAt(9, 30, 0),
        endTime: todayAt(9, 45, 0),
        organizerId: currentUser.id,
        organizerName: currentUser.full_name || currentUser.email,
        organizerEmail: currentUser.email,
        organizerAvatar: currentUser.avatar_url,
        organizationId: currentUser.organization_id,
        channelId: 'chan-general',
        meetingCode: generateMeetingCode(),
        attendees: buildAttendees(currentUser, colleagues.slice(0, 5), ['going', 'going', 'going', 'going']),
        agenda: [
          { id: 'ag-s1', title: 'Round-robin updates (Yesterday / Today / Blockers)', durationMinutes: 12, completed: true },
          { id: 'ag-s2', title: 'Unblock critical path dependencies', durationMinutes: 3, completed: false },
        ],
        prepNotes: 'Keep updates crisp (under 90 seconds per person). Flag blockers early.',
        recurrence: 'daily',
        created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
      },
    ];

    this.events = seeded;
    this.persistEvents();
    return this.events;
  }

  public getEvents(): CalendarEvent[] {
    return [...this.events].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
  }

  public getEventById(eventId: string): CalendarEvent | undefined {
    return this.events.find(e => e.id === eventId);
  }

  public subscribeCalendar(listener: CalendarListener): () => void {
    this.calendarListeners.add(listener);
    listener(this.getEvents());
    return () => {
      this.calendarListeners.delete(listener);
    };
  }

  private notifyCalendarListeners() {
    const sorted = this.getEvents();
    this.calendarListeners.forEach(l => {
      try {
        l(sorted);
      } catch (e) {}
    });
  }

  public async scheduleMeeting(params: {
    title: string;
    description?: string;
    category: CalendarEventCategory;
    startTime: string;
    endTime: string;
    organizer: User;
    invitedUsers: User[];
    projectId?: string;
    sprintId?: string;
    channelId?: string;
    directUserId?: string;
    agenda?: MeetingAgendaItem[];
    prepNotes?: string;
    linkedTaskIds?: string[];
    recurrence?: 'none' | 'daily' | 'weekly' | 'biweekly';
    postToChat?: boolean;
  }): Promise<CalendarEvent> {
    const {
      title,
      description,
      category,
      startTime,
      endTime,
      organizer,
      invitedUsers,
      projectId,
      sprintId,
      channelId,
      directUserId,
      agenda = [],
      prepNotes = '',
      linkedTaskIds = [],
      recurrence = 'none',
      postToChat = true,
    } = params;

    const attendeesMap = new Map<string, CalendarAttendee>();
    attendeesMap.set(organizer.id, {
      userId: organizer.id,
      name: organizer.full_name || organizer.email.split('@')[0],
      email: organizer.email,
      avatar: organizer.avatar_url,
      role: organizer.role,
      rsvp: 'going',
      rsvpNote: 'Organizer',
      respondedAt: new Date().toISOString(),
    });

    invitedUsers.forEach(u => {
      if (u && u.id && u.id !== organizer.id) {
        attendeesMap.set(u.id, {
          userId: u.id,
          name: u.full_name || u.email.split('@')[0],
          email: u.email,
          avatar: u.avatar_url,
          role: u.role,
          rsvp: 'pending',
        });
      }
    });

    const newEvent: CalendarEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: title.trim(),
      description: description?.trim() || '',
      category,
      startTime,
      endTime,
      organizerId: organizer.id,
      organizerName: organizer.full_name || organizer.email,
      organizerEmail: organizer.email,
      organizerAvatar: organizer.avatar_url,
      organizationId: organizer.organization_id,
      projectId,
      sprintId,
      channelId: channelId || (!directUserId ? 'chan-general' : undefined),
      directUserId,
      meetingCode: generateMeetingCode(),
      attendees: Array.from(attendeesMap.values()),
      agenda,
      prepNotes,
      linkedTaskIds,
      recurrence,
      created_at: new Date().toISOString(),
    };

    this.events = [newEvent, ...this.events];
    this.persistEvents();
    this.broadcastPacket('CALENDAR_EVENT_UPSERT', newEvent);

    // Post interactive Meeting Invite Card in Teams Chat so attendees can RSVP directly from Chat
    if (postToChat) {
      const inviteSummaryPayload = {
        eventId: newEvent.id,
        title: newEvent.title,
        category: newEvent.category,
        startTime: newEvent.startTime,
        endTime: newEvent.endTime,
        meetingCode: newEvent.meetingCode,
        organizerId: newEvent.organizerId,
        organizerName: newEvent.organizerName,
        attendeeCount: newEvent.attendees.length,
      };
      const formattedChatContent = `[MEETING_INVITE:${JSON.stringify(inviteSummaryPayload)}] 📅 Scheduled "${newEvent.title}" for ${new Date(
        newEvent.startTime
      ).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })} · Room: ${newEvent.meetingCode}`;

      try {
        await chatService.sendMessage({
          sender: organizer,
          content: formattedChatContent,
          channelId: directUserId ? undefined : newEvent.channelId || 'chan-general',
          recipientId: directUserId || undefined,
        });
      } catch (e) {}
    }

    // Dispatch email invitations to all invited teammates
    invitedUsers.forEach(invitee => {
      if (invitee.id !== organizer.id && invitee.email) {
        Promise.resolve(
          emailNotificationService.sendImportantUpdateEmail({
            recipient: invitee,
            category: 'SPRINT_ALERT',
            subject: `Meeting Invitation: ${newEvent.title} (${new Date(newEvent.startTime).toLocaleDateString()})`,
            heading: `📅 ${organizer.full_name || organizer.email} invited you to a meeting`,
            details: `"${newEvent.title}" is scheduled for ${new Date(newEvent.startTime).toLocaleString([], {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}. Video Room: ${newEvent.meetingCode}. Please RSVP (Going / Maybe / Decline) in Calendar or Teams Chat.`,
            ctaLabel: 'Review Agenda & RSVP',
            ctaAction: { type: 'open_view', view: 'calendar_view' },
          })
        ).catch(() => {});
      }
    });

    return newEvent;
  }

  public updateRsvp(
    eventId: string,
    user: User,
    rsvp: RsvpStatus,
    rsvpNote?: string
  ): CalendarEvent | null {
    const idx = this.events.findIndex(e => e.id === eventId);
    if (idx < 0) return null;

    const target = { ...this.events[idx], attendees: [...this.events[idx].attendees] };
    const updatedAttendee: CalendarAttendee = {
      userId: user.id,
      name: user.full_name || user.email.split('@')[0],
      email: user.email,
      avatar: user.avatar_url,
      role: user.role,
      rsvp,
      rsvpNote: rsvpNote?.trim() || undefined,
      respondedAt: new Date().toISOString(),
    };

    const existingIdx = target.attendees.findIndex(a => a.userId === user.id);
    if (existingIdx >= 0) {
      target.attendees[existingIdx] = updatedAttendee;
    } else {
      target.attendees.push(updatedAttendee);
    }

    this.events[idx] = target;
    this.persistEvents();

    this.broadcastPacket('CALENDAR_RSVP_UPDATED', {
      eventId,
      eventTitle: target.title,
      attendee: updatedAttendee,
    });

    return target;
  }

  public inviteUsersToCalendarEvent(eventId: string, usersToInvite: User[], inviter: User): CalendarEvent | null {
    const idx = this.events.findIndex(e => e.id === eventId);
    if (idx < 0) return null;

    const target = { ...this.events[idx], attendees: [...this.events[idx].attendees] };
    usersToInvite.forEach(u => {
      if (u && u.id && !target.attendees.some(a => a.userId === u.id)) {
        target.attendees.push({
          userId: u.id,
          name: u.full_name || u.email.split('@')[0],
          email: u.email,
          avatar: u.avatar_url,
          role: u.role,
          rsvp: 'pending',
        });

        if (u.email) {
          Promise.resolve(
            emailNotificationService.sendImportantUpdateEmail({
              recipient: u,
              category: 'SPRINT_ALERT',
              subject: `Meeting Invitation: ${target.title}`,
              heading: `📅 ${inviter.full_name || inviter.email} added you to "${target.title}"`,
              details: `Scheduled for ${new Date(target.startTime).toLocaleString()}. Video Room: ${target.meetingCode}. Please RSVP in Calendar or Teams Chat.`,
              ctaLabel: 'Open Calendar & RSVP',
              ctaAction: { type: 'open_view', view: 'calendar_view' },
            })
          ).catch(() => {});
        }
      }
    });

    this.events[idx] = target;
    this.persistEvents();
    this.broadcastPacket('CALENDAR_EVENT_UPSERT', target);
    return target;
  }

  public toggleAgendaItem(eventId: string, agendaItemId: string): CalendarEvent | null {
    const idx = this.events.findIndex(e => e.id === eventId);
    if (idx < 0) return null;
    const target = {
      ...this.events[idx],
      agenda: this.events[idx].agenda.map(item =>
        item.id === agendaItemId ? { ...item, completed: !item.completed } : item
      ),
    };
    this.events[idx] = target;
    this.persistEvents();
    this.broadcastPacket('CALENDAR_EVENT_UPSERT', target);
    return target;
  }

  public addAgendaItem(
    eventId: string,
    item: Omit<MeetingAgendaItem, 'id' | 'completed'>
  ): CalendarEvent | null {
    const idx = this.events.findIndex(e => e.id === eventId);
    if (idx < 0) return null;
    const newItem: MeetingAgendaItem = {
      id: `ag-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      completed: false,
      ...item,
    };
    const target = {
      ...this.events[idx],
      agenda: [...this.events[idx].agenda, newItem],
    };
    this.events[idx] = target;
    this.persistEvents();
    this.broadcastPacket('CALENDAR_EVENT_UPSERT', target);
    return target;
  }

  public updateEventPrepNotes(eventId: string, prepNotes: string): CalendarEvent | null {
    const idx = this.events.findIndex(e => e.id === eventId);
    if (idx < 0) return null;
    const target = { ...this.events[idx], prepNotes };
    this.events[idx] = target;
    this.persistEvents();
    this.broadcastPacket('CALENDAR_EVENT_UPSERT', target);
    return target;
  }

  public deleteCalendarEvent(eventId: string): void {
    this.events = this.events.filter(e => e.id !== eventId);
    this.persistEvents();
    this.broadcastPacket('CALENDAR_EVENT_DELETED', { eventId });
  }

  // ============================================================================
  // VIDEO CALLING & WEBRTC SIGNALING ENGINE
  // ============================================================================

  public subscribeCallState(listener: CallStateListener): () => void {
    this.callListeners.add(listener);
    listener(this.getCallStateSnapshot());
    return () => {
      this.callListeners.delete(listener);
    };
  }

  public getCallStateSnapshot() {
    return {
      activeCall: this.activeCallId ? this.ongoingCalls.get(this.activeCallId) || null : null,
      ongoingOrgCalls: Array.from(this.ongoingCalls.values()),
      incomingInvite: this.incomingInvite,
      isMinimized: this.isMinimized,
      localStream: this.localStream,
      screenStream: this.screenStream,
      remoteStreams: new Map(this.remoteStreams),
      remoteScreenFrames: new Map(this.remoteScreenFrames),
      remoteCameraFrames: new Map(this.remoteCameraFrames),
      reactions: [...this.reactions],
    };
  }

  private notifyCallListeners() {
    const snap = this.getCallStateSnapshot();
    this.callListeners.forEach(l => {
      try {
        l(snap);
      } catch (e) {}
    });
  }

  public setMinimized(minimized: boolean) {
    this.isMinimized = minimized;
    this.notifyCallListeners();
  }

  public setIncomingInvite(invite: IncomingCallInvite | null) {
    this.incomingInvite = invite;
    this.notifyCallListeners();
  }

  public declineCall(callId: string, decliningUser: User) {
    if (this.incomingInvite?.callId === callId) {
      this.incomingInvite = null;
    }
    const userName = decliningUser.full_name || decliningUser.email.split('@')[0];
    const existing = this.ongoingCalls.get(callId);
    if (existing) {
      const hasUser = existing.participants.some(p => p.userId === decliningUser.id);
      const updatedParticipants = hasUser
        ? existing.participants.map(p =>
            p.userId === decliningUser.id
              ? { ...p, connectionState: 'declined' as const, isSpeaking: false, isScreenSharing: false }
              : p
          )
        : [
            ...existing.participants,
            {
              userId: decliningUser.id,
              name: userName,
              email: decliningUser.email,
              avatar: decliningUser.avatar_url,
              role: decliningUser.role,
              isMicMuted: true,
              isCameraOff: true,
              isScreenSharing: false,
              isHandRaised: false,
              isSpeaking: false,
              joinedAt: new Date().toISOString(),
              connectionState: 'declined' as const,
            },
          ];

      const declineChatMsg = {
        id: `cmsg-decline-${Date.now()}`,
        senderId: decliningUser.id,
        senderName: userName,
        senderAvatar: decliningUser.avatar_url,
        text: `${userName} declined the call.`,
        timestamp: new Date().toISOString(),
      };

      const updatedCall: VideoCallSession = {
        ...existing,
        participants: updatedParticipants,
        chatMessages: [...existing.chatMessages, declineChatMsg],
      };
      this.ongoingCalls.set(callId, updatedCall);
      this.persistOngoingCalls();
      this.broadcastPacket('CALL_SESSION_SYNC', updatedCall);
    }

    this.broadcastPacket('CALL_DECLINED', {
      callId,
      userId: decliningUser.id,
      userName,
      timestamp: new Date().toISOString(),
    });
    this.notifyCallListeners();
  }

  private liveMicLevel = 0;
  private localUserId: string | null = null;
  private selectedVideoDeviceId: string | undefined = undefined;
  private selectedAudioDeviceId: string | undefined = undefined;

  public getLiveMicLevel(): number {
    return this.liveMicLevel;
  }

  public getSelectedDevices() {
    return {
      videoDeviceId: this.selectedVideoDeviceId,
      audioDeviceId: this.selectedAudioDeviceId,
    };
  }

  public async switchMediaDevices(videoDeviceId?: string, audioDeviceId?: string, currentUserId?: string): Promise<MediaStream | null> {
    if (videoDeviceId !== undefined) this.selectedVideoDeviceId = videoDeviceId || undefined;
    if (audioDeviceId !== undefined) this.selectedAudioDeviceId = audioDeviceId || undefined;

    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }

    const call = this.activeCallId ? this.ongoingCalls.get(this.activeCallId) : null;
    const me = call?.participants.find(p => p.userId === (currentUserId || this.localUserId));
    const wantVideo = me ? !me.isCameraOff : true;
    const wantAudio = me ? !me.isMicMuted : true;

    return this.acquireLocalMedia(wantVideo, wantAudio);
  }

  public playTestSpeakerSound(): void {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.14);
        gain.gain.setValueAtTime(0.001, ctx.currentTime + i * 0.14);
        gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + i * 0.14 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.14 + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.14);
        osc.stop(ctx.currentTime + i * 0.14 + 0.46);
      });
    } catch (e) {
      console.warn('Speaker test sound error:', e);
    }
  }

  public async acquireLocalMedia(withVideo = true, withAudio = true): Promise<MediaStream | null> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return null;
    }

    const videoConstraint: boolean | MediaTrackConstraints = withVideo
      ? this.selectedVideoDeviceId
        ? { deviceId: { exact: this.selectedVideoDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
      : false;

    const audioConstraint: boolean | MediaTrackConstraints = withAudio
      ? this.selectedAudioDeviceId
        ? { deviceId: { exact: this.selectedAudioDeviceId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        : { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      : false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraint,
        audio: audioConstraint,
      });
      if (this.localStream && this.localStream !== stream) {
        this.localStream.getTracks().forEach(t => t.stop());
      }
      this.localStream = stream;
      this.startAudioActivityMonitor(stream);
      if (withVideo && stream.getVideoTracks().length > 0 && this.localUserId) {
        this.startCameraFrameBroadcastLoop(this.localUserId);
      }
      this.notifyCallListeners();
      return stream;
    } catch (_firstErr) {
      try {
        const basicStream = await navigator.mediaDevices.getUserMedia({
          video: withVideo,
          audio: withAudio,
        });
        if (this.localStream && this.localStream !== basicStream) {
          this.localStream.getTracks().forEach(t => t.stop());
        }
        this.localStream = basicStream;
        this.startAudioActivityMonitor(basicStream);
        if (withVideo && basicStream.getVideoTracks().length > 0 && this.localUserId) {
          this.startCameraFrameBroadcastLoop(this.localUserId);
        }
        this.notifyCallListeners();
        return basicStream;
      } catch (_secondErr) {
        const combinedTracks: MediaStreamTrack[] = [];
        if (withVideo) {
          try {
            const vStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            combinedTracks.push(...vStream.getVideoTracks());
          } catch {}
        }
        if (withAudio) {
          try {
            const aStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
            combinedTracks.push(...aStream.getAudioTracks());
          } catch {}
        }
        if (combinedTracks.length > 0) {
          const mergedStream = new MediaStream(combinedTracks);
          if (this.localStream && this.localStream !== mergedStream) {
            this.localStream.getTracks().forEach(t => t.stop());
          }
          this.localStream = mergedStream;
          this.startAudioActivityMonitor(mergedStream);
          if (withVideo && mergedStream.getVideoTracks().length > 0 && this.localUserId) {
            this.startCameraFrameBroadcastLoop(this.localUserId);
          }
          this.notifyCallListeners();
          return mergedStream;
        }
      }
      return null;
    }
  }

  private startScreenFrameBroadcastLoop(presenterUserId: string) {
    if (this.screenFrameInterval) {
      clearInterval(this.screenFrameInterval);
      this.screenFrameInterval = null;
    }
    if (typeof document === 'undefined' || !this.screenStream) return;

    const videoTrack = this.screenStream.getVideoTracks()[0];
    if (!videoTrack || videoTrack.readyState !== 'live') return;

    const offscreenVideo = document.createElement('video');
    offscreenVideo.muted = true;
    offscreenVideo.playsInline = true;
    offscreenVideo.autoplay = true;
    offscreenVideo.srcObject = this.screenStream;
    offscreenVideo.play().catch(() => {});

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    this.screenFrameInterval = setInterval(() => {
      if (!this.activeCallId || !this.screenStream || !ctx) {
        if (this.screenFrameInterval) {
          clearInterval(this.screenFrameInterval);
          this.screenFrameInterval = null;
        }
        return;
      }
      const track = this.screenStream.getVideoTracks()[0];
      if (!track || track.readyState !== 'live' || !track.enabled) return;

      const vw = offscreenVideo.videoWidth || 1280;
      const vh = offscreenVideo.videoHeight || 720;
      if (vw === 0 || vh === 0) return;

      const targetW = Math.min(1280, vw);
      const targetH = Math.round((targetW / vw) * vh);
      if (canvas.width !== targetW) canvas.width = targetW;
      if (canvas.height !== targetH) canvas.height = targetH;

      try {
        ctx.drawImage(offscreenVideo, 0, 0, targetW, targetH);
        const now = Date.now();
        const sendToSupabase = now - this.lastSupabaseScreenBroadcast >= 850;
        const frame = canvas.toDataURL('image/jpeg', sendToSupabase ? 0.58 : 0.68);
        if (sendToSupabase) {
          this.lastSupabaseScreenBroadcast = now;
        }
        this.broadcastPacket(
          'CALL_SCREEN_FRAME',
          {
            callId: this.activeCallId,
            userId: presenterUserId,
            frame,
          },
          !sendToSupabase
        );
      } catch {}
    }, 320);
  }

  private startCameraFrameBroadcastLoop(userId: string) {
    if (this.cameraFrameInterval) {
      clearInterval(this.cameraFrameInterval);
      this.cameraFrameInterval = null;
    }
    if (typeof document === 'undefined' || !this.localStream) return;

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (!videoTrack || videoTrack.readyState !== 'live') return;

    const offscreenVideo = document.createElement('video');
    offscreenVideo.muted = true;
    offscreenVideo.playsInline = true;
    offscreenVideo.autoplay = true;
    offscreenVideo.srcObject = this.localStream;
    offscreenVideo.play().catch(() => {});

    const canvas = document.createElement('canvas');
    canvas.width = 420;
    canvas.height = 236;
    const ctx = canvas.getContext('2d');

    this.cameraFrameInterval = setInterval(() => {
      if (!this.activeCallId || !this.localStream || !ctx) {
        if (this.cameraFrameInterval) {
          clearInterval(this.cameraFrameInterval);
          this.cameraFrameInterval = null;
        }
        return;
      }
      const track = this.localStream.getVideoTracks()[0];
      if (!track || track.readyState !== 'live' || !track.enabled) return;

      if (offscreenVideo.videoWidth === 0 || offscreenVideo.videoHeight === 0) return;

      try {
        ctx.drawImage(offscreenVideo, 0, 0, canvas.width, canvas.height);
        const now = Date.now();
        const sendToSupabase = now - this.lastSupabaseCameraBroadcast >= 1100;
        const frame = canvas.toDataURL('image/jpeg', 0.55);
        if (sendToSupabase) {
          this.lastSupabaseCameraBroadcast = now;
        }
        this.broadcastPacket(
          'CALL_CAMERA_FRAME',
          {
            callId: this.activeCallId,
            userId,
            frame,
          },
          !sendToSupabase
        );
      } catch {}
    }, 450);
  }

  private startAudioActivityMonitor(stream: MediaStream) {
    if (this.audioMonitorInterval) clearInterval(this.audioMonitorInterval);
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      this.liveMicLevel = 0;
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (this.audioContext && this.audioContext.state !== 'closed') {
        try {
          this.audioContext.close();
        } catch {}
      }
      this.audioContext = new AudioCtx();
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }
      const source = this.audioContext.createMediaStreamSource(stream);
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.65;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      this.audioMonitorInterval = setInterval(() => {
        const activeTrack = stream.getAudioTracks()[0];
        if (!activeTrack || !activeTrack.enabled || activeTrack.readyState !== 'live') {
          this.liveMicLevel = 0;
          return;
        }
        if (this.audioContext?.state === 'suspended') {
          this.audioContext.resume().catch(() => {});
        }
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        this.liveMicLevel = Math.min(100, Math.round((avg / 65) * 100));
        const isSpeakingNow = avg > 12;

        if (!this.activeCallId) return;
        const call = this.ongoingCalls.get(this.activeCallId);
        if (!call) return;

        const targetUid = this.localUserId || call.hostId;
        const me = call.participants.find(p => p.userId === targetUid);
        if (me && !me.isMicMuted && me.isSpeaking !== isSpeakingNow) {
          const updatedParticipants = call.participants.map(p =>
            p.userId === targetUid ? { ...p, isSpeaking: isSpeakingNow } : p
          );
          this.ongoingCalls.set(call.id, { ...call, participants: updatedParticipants });
          this.notifyCallListeners();
        }
      }, 180);
    } catch (e) {}
  }

  public async startOrJoinCall(params: {
    currentUser: User;
    title: string;
    type: 'direct' | 'channel' | 'scheduled';
    meetingCode?: string;
    channelId?: string;
    directUser?: User;
    invitedUsers?: User[];
    calendarEvent?: CalendarEvent;
    projectId?: string;
    sprintId?: string;
    initialVideo?: boolean;
    initialAudio?: boolean;
    postCallCardToChat?: boolean;
  }): Promise<VideoCallSession> {
    const {
      currentUser,
      title,
      type,
      meetingCode,
      channelId,
      directUser,
      invitedUsers = [],
      calendarEvent,
      projectId,
      sprintId,
      initialVideo = true,
      initialAudio = true,
      postCallCardToChat = true,
    } = params;

    // Check if there is an active, live call for this meetingCode, calendarEventId, or channel/DM
    let existingCall: VideoCallSession | undefined;
    this.ongoingCalls.forEach(c => {
      if (
        (meetingCode && c.meetingCode === meetingCode) ||
        (calendarEvent && c.calendarEventId === calendarEvent.id) ||
        (type === 'channel' && channelId && c.channelId === channelId) ||
        (type === 'direct' && directUser && c.directUserId === directUser.id)
      ) {
        // Verify if the existing call actually has any live online connected participant
        const hasLiveRemoteConnected = c.participants.some(
          p =>
            p.userId !== currentUser.id &&
            p.connectionState === 'connected' &&
            this.isUserOnlineInOrg(p.userId)
        );
        const isRingingMe = c.participants.some(
          p => p.userId === currentUser.id && p.connectionState === 'ringing'
        );
        if (hasLiveRemoteConnected || isRingingMe || Boolean(meetingCode)) {
          existingCall = c;
        } else {
          // Stale call with no live participants -> remove it
          this.ongoingCalls.delete(c.id);
        }
      }
    });

    this.localUserId = currentUser.id;
    this.participantHeartbeats.set(currentUser.id, Date.now());
    await this.acquireLocalMedia(initialVideo, initialAudio);
    const hasVideoTrack = Boolean(this.localStream && this.localStream.getVideoTracks().length > 0 && initialVideo);
    const hasAudioTrack = Boolean(this.localStream && this.localStream.getAudioTracks().length > 0 && initialAudio);

    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(t => {
        t.enabled = Boolean(initialVideo);
      });
      this.localStream.getAudioTracks().forEach(t => {
        t.enabled = Boolean(initialAudio);
      });
    }

    if (hasVideoTrack) {
      this.startCameraFrameBroadcastLoop(currentUser.id);
    }

    const selfParticipant: VideoCallParticipant = {
      userId: currentUser.id,
      name: currentUser.full_name || currentUser.email.split('@')[0],
      email: currentUser.email,
      avatar: currentUser.avatar_url,
      role: currentUser.role,
      isMicMuted: !initialAudio || !hasAudioTrack,
      isCameraOff: !initialVideo || !hasVideoTrack,
      isScreenSharing: false,
      isHandRaised: false,
      isSpeaking: false,
      joinedAt: new Date().toISOString(),
      connectionState: 'connected',
      backgroundMode: 'none',
    };

    if (existingCall) {
      // Filter out any offline ghost participants who are not actually online
      const validParticipants = existingCall.participants.filter(
        p =>
          p.userId === currentUser.id ||
          p.connectionState === 'ringing' ||
          p.connectionState === 'declined' ||
          (p.connectionState === 'connected' && this.isUserOnlineInOrg(p.userId))
      );
      const myIdx = validParticipants.findIndex(p => p.userId === currentUser.id);
      if (myIdx >= 0) {
        validParticipants[myIdx] = { ...selfParticipant, connectionState: 'connected' };
      } else {
        validParticipants.push(selfParticipant);
      }

      const joinMsg = {
        id: `cmsg-join-${Date.now()}`,
        senderId: currentUser.id,
        senderName: selfParticipant.name,
        senderAvatar: currentUser.avatar_url,
        text: `${selfParticipant.name} joined the call.`,
        timestamp: new Date().toISOString(),
      };

      const updatedCall: VideoCallSession = {
        ...existingCall,
        participants: validParticipants,
        chatMessages: [...existingCall.chatMessages, joinMsg],
      };
      this.ongoingCalls.set(updatedCall.id, updatedCall);
      this.activeCallId = updatedCall.id;
      this.isMinimized = false;
      this.incomingInvite = null;
      this.persistOngoingCalls();
      this.broadcastPacket('CALL_SESSION_SYNC', updatedCall);
      this.broadcastPacket('CALL_HEARTBEAT', {
        callId: updatedCall.id,
        userId: currentUser.id,
        ts: Date.now(),
      });
      this.initiateWebRTCMeshForCall(updatedCall, currentUser.id);
      return updatedCall;
    }

    // Create new call session:
    // IMPORTANT: Never mark unjoined or offline users as 'connected'!
    // Only ring target users who are explicitly called (1:1 directUser or online invitedUsers).
    const targetsMap = new Map<string, User>();
    if (directUser && directUser.id !== currentUser.id) {
      targetsMap.set(directUser.id, directUser);
    }
    invitedUsers.forEach(u => {
      if (u && u.id && u.id !== currentUser.id) {
        // For channel/scheduled calls, only auto-ring teammates who are currently online in the workspace
        if (type === 'direct' || this.isUserOnlineInOrg(u.id)) {
          targetsMap.set(u.id, u);
        }
      }
    });

    const initialParticipants: VideoCallParticipant[] = [selfParticipant];
    targetsMap.forEach(u => {
      initialParticipants.push({
        userId: u.id,
        name: u.full_name || u.email.split('@')[0],
        email: u.email,
        avatar: u.avatar_url,
        role: u.role,
        isMicMuted: true,
        isCameraOff: true,
        isScreenSharing: false,
        isHandRaised: false,
        isSpeaking: false,
        joinedAt: new Date().toISOString(),
        connectionState: 'ringing',
        backgroundMode: 'studio',
      });
    });

    const initialNotes = calendarEvent?.prepNotes
      ? `# ${calendarEvent.title} — Meeting Notes\n${calendarEvent.prepNotes}\n\n`
      : `# ${title} — Shared Meeting Notes\n• Key discussion points & architectural decisions\n`;

    const newSession: VideoCallSession = {
      id: `call-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      meetingCode: meetingCode || calendarEvent?.meetingCode || generateMeetingCode(),
      title,
      type,
      channelId,
      directUserId: directUser?.id,
      calendarEventId: calendarEvent?.id,
      projectId: projectId || calendarEvent?.projectId,
      sprintId: sprintId || calendarEvent?.sprintId,
      hostId: currentUser.id,
      hostName: currentUser.full_name || currentUser.email.split('@')[0],
      organizationId: currentUser.organization_id,
      startedAt: new Date().toISOString(),
      participants: initialParticipants,
      sharedNotes: initialNotes,
      actionItems: (calendarEvent?.agenda || []).map(ag => ({
        id: `act-${ag.id}`,
        text: ag.title,
        assigneeName: ag.presenterName,
        completed: ag.completed,
      })),
      chatMessages: [
        {
          id: `cmsg-${Date.now()}`,
          senderId: currentUser.id,
          senderName: currentUser.full_name || currentUser.email.split('@')[0],
          senderAvatar: currentUser.avatar_url,
          text: `Started video meeting "${title}" (Room: ${
            meetingCode || calendarEvent?.meetingCode || 'live'
          }).`,
          timestamp: new Date().toISOString(),
        },
      ],
      transcript: [
        {
          id: `tr-${Date.now()}`,
          speakerName: currentUser.full_name || currentUser.email.split('@')[0],
          text: `Joined ${title}.`,
          timestamp: new Date().toISOString(),
        },
      ],
    };

    this.ongoingCalls.set(newSession.id, newSession);
    this.activeCallId = newSession.id;
    this.isMinimized = false;
    this.incomingInvite = null;
    this.persistOngoingCalls();
    this.broadcastPacket('CALL_SESSION_SYNC', newSession);

    // Ring target teammates across tabs / Realtime (NO fake auto-connect timer!)
    if (targetsMap.size > 0) {
      const invitePayload: IncomingCallInvite = {
        callId: newSession.id,
        meetingCode: newSession.meetingCode,
        title: newSession.title,
        type: newSession.type,
        callerId: currentUser.id,
        callerName: currentUser.full_name || currentUser.email,
        callerAvatar: currentUser.avatar_url,
        callerRole: currentUser.role,
        targetUserIds: Array.from(targetsMap.keys()),
        channelId: newSession.channelId,
        directUserId: newSession.directUserId,
        calendarEventId: newSession.calendarEventId,
        timestamp: new Date().toISOString(),
      };
      this.broadcastPacket('CALL_INVITE_RINGING', invitePayload);
    }

    // Post interactive Call Card to Teams Chat
    if (postCallCardToChat && (channelId || directUser?.id)) {
      const callMeta = {
        callId: newSession.id,
        meetingCode: newSession.meetingCode,
        title: newSession.title,
        type: newSession.type,
        hostName: newSession.hostName,
      };
      const chatText = `[VIDEO_CALL:${JSON.stringify(callMeta)}] 📹 Started live video call "${
        newSession.title
      }" · Room ${newSession.meetingCode}`;
      chatService
        .sendMessage({
          sender: currentUser,
          content: chatText,
          channelId: directUser ? undefined : channelId,
          recipientId: directUser?.id,
        })
        .catch(() => {});
    }

    return newSession;
  }

  public inviteTeammatesToActiveCall(teammates: User[], inviter: User): VideoCallSession | null {
    if (!this.activeCallId) return null;
    const call = this.ongoingCalls.get(this.activeCallId);
    if (!call) return null;

    const newlyInvitedIds: string[] = [];
    const updatedParticipants = [...call.participants];

    teammates.forEach(u => {
      if (!u || !u.id) return;
      const existingIdx = updatedParticipants.findIndex(p => p.userId === u.id);
      if (existingIdx < 0) {
        newlyInvitedIds.push(u.id);
        updatedParticipants.push({
          userId: u.id,
          name: u.full_name || u.email.split('@')[0],
          email: u.email,
          avatar: u.avatar_url,
          role: u.role,
          isMicMuted: true,
          isCameraOff: true,
          isScreenSharing: false,
          isHandRaised: false,
          isSpeaking: false,
          joinedAt: new Date().toISOString(),
          connectionState: 'ringing',
          backgroundMode: 'studio',
        });
      } else if (updatedParticipants[existingIdx].connectionState !== 'connected') {
        newlyInvitedIds.push(u.id);
        updatedParticipants[existingIdx] = {
          ...updatedParticipants[existingIdx],
          joinedAt: new Date().toISOString(),
          connectionState: 'ringing',
        };
      }
    });

    if (newlyInvitedIds.length === 0) return call;

    const systemChatMsg = {
      id: `cmsg-${Date.now()}`,
      senderId: inviter.id,
      senderName: inviter.full_name || inviter.email.split('@')[0],
      senderAvatar: inviter.avatar_url,
      text: `Ringing ${teammates.map(t => t.full_name || t.email.split('@')[0]).join(', ')}...`,
      timestamp: new Date().toISOString(),
    };

    const updatedCall: VideoCallSession = {
      ...call,
      participants: updatedParticipants,
      chatMessages: [...call.chatMessages, systemChatMsg],
    };

    this.ongoingCalls.set(call.id, updatedCall);
    this.persistOngoingCalls();
    this.broadcastPacket('CALL_SESSION_SYNC', updatedCall);

    const invitePayload: IncomingCallInvite = {
      callId: updatedCall.id,
      meetingCode: updatedCall.meetingCode,
      title: updatedCall.title,
      type: updatedCall.type,
      callerId: inviter.id,
      callerName: inviter.full_name || inviter.email,
      callerAvatar: inviter.avatar_url,
      callerRole: inviter.role,
      targetUserIds: newlyInvitedIds,
      channelId: updatedCall.channelId,
      directUserId: updatedCall.directUserId,
      calendarEventId: updatedCall.calendarEventId,
      timestamp: new Date().toISOString(),
    };
    this.broadcastPacket('CALL_INVITE_RINGING', invitePayload);

    return updatedCall;
  }

  public async toggleMic(currentUserId: string): Promise<boolean> {
    if (!this.activeCallId) return false;
    const call = this.ongoingCalls.get(this.activeCallId);
    if (!call) return false;

    const me = call.participants.find(p => p.userId === currentUserId);
    const nextMuted = me ? !me.isMicMuted : false;

    if (!nextMuted && (!this.localStream || this.localStream.getAudioTracks().length === 0)) {
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: this.selectedAudioDeviceId
            ? { deviceId: { exact: this.selectedAudioDeviceId }, echoCancellation: true, noiseSuppression: true }
            : { echoCancellation: true, noiseSuppression: true },
          video: false,
        });
        if (this.localStream) {
          audioStream.getAudioTracks().forEach(t => this.localStream!.addTrack(t));
        } else {
          this.localStream = audioStream;
        }
        this.startAudioActivityMonitor(this.localStream);
      } catch (e) {
        console.warn('Microphone access error:', e);
      }
    }

    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !nextMuted;
      });
    }
    if (nextMuted) {
      this.liveMicLevel = 0;
    }

    const updatedParticipants = call.participants.map(p => {
      if (p.userId === currentUserId) {
        return { ...p, isMicMuted: nextMuted, isSpeaking: nextMuted ? false : p.isSpeaking };
      }
      return p;
    });

    const updatedCall = { ...call, participants: updatedParticipants };
    this.ongoingCalls.set(call.id, updatedCall);
    this.persistOngoingCalls();
    this.broadcastPacket('CALL_SESSION_SYNC', updatedCall);
    return nextMuted;
  }

  public async toggleCamera(currentUserId: string): Promise<boolean> {
    if (!this.activeCallId) return false;
    const call = this.ongoingCalls.get(this.activeCallId);
    if (!call) return false;

    const me = call.participants.find(p => p.userId === currentUserId);
    const nextCameraOff = me ? !me.isCameraOff : false;

    if (!nextCameraOff) {
      const liveVideoTracks = this.localStream
        ? this.localStream.getVideoTracks().filter(t => t.readyState === 'live')
        : [];
      if (liveVideoTracks.length === 0) {
        try {
          const camStream = await navigator.mediaDevices.getUserMedia({
            video: this.selectedVideoDeviceId
              ? { deviceId: { exact: this.selectedVideoDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
              : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
            audio: false,
          });
          if (this.localStream) {
            this.localStream.getVideoTracks().forEach(oldT => {
              oldT.stop();
              this.localStream?.removeTrack(oldT);
            });
            camStream.getVideoTracks().forEach(newT => {
              newT.enabled = true;
              this.localStream!.addTrack(newT);
            });
            this.localStream = new MediaStream(this.localStream.getTracks());
          } else {
            this.localStream = camStream;
          }
          const newVideoTrack = camStream.getVideoTracks()[0];
          if (newVideoTrack && !this.screenStream) {
            this.peerConnections.forEach(pc => {
              const sender = pc.getSenders().find(s => s.track?.kind === 'video');
              if (sender) {
                sender.replaceTrack(newVideoTrack).catch(() => {});
              } else if (this.localStream) {
                pc.addTrack(newVideoTrack, this.localStream);
              }
            });
          }
        } catch (err) {
          console.warn('Camera access failed:', err);
          return true;
        }
      } else if (this.localStream) {
        this.localStream.getVideoTracks().forEach(track => {
          track.enabled = true;
        });
      }
      this.startCameraFrameBroadcastLoop(currentUserId);
    } else {
      if (this.localStream) {
        this.localStream.getVideoTracks().forEach(track => {
          track.enabled = false;
        });
      }
      if (this.cameraFrameInterval) {
        clearInterval(this.cameraFrameInterval);
        this.cameraFrameInterval = null;
      }
      this.broadcastPacket('CALL_CAMERA_STOPPED', {
        callId: call.id,
        userId: currentUserId,
      });
    }

    const updatedParticipants = call.participants.map(p =>
      p.userId === currentUserId ? { ...p, isCameraOff: nextCameraOff } : p
    );

    const updatedCall = { ...call, participants: updatedParticipants };
    this.ongoingCalls.set(call.id, updatedCall);
    this.persistOngoingCalls();
    this.broadcastPacket('CALL_SESSION_SYNC', updatedCall);
    this.initiateWebRTCMeshForCall(updatedCall, currentUserId);
    return nextCameraOff;
  }

  public async toggleScreenShare(currentUserId: string): Promise<boolean> {
    if (!this.activeCallId) return false;
    const call = this.ongoingCalls.get(this.activeCallId);
    if (!call) return false;

    const me = call.participants.find(p => p.userId === currentUserId);
    const currentlySharing = Boolean(me?.isScreenSharing);

    if (currentlySharing) {
      this.stopScreenShare(currentUserId);
      return false;
    } else {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        return false;
      }
      let displayStream: MediaStream | null = null;
      try {
        try {
          displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              cursor: 'always',
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              frameRate: { ideal: 30 },
            } as any,
            audio: true,
          });
        } catch (firstErr: any) {
          if (firstErr?.name === 'NotAllowedError' || firstErr?.name === 'AbortError') {
            return false;
          }
          displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
          });
        }
      } catch (_err: any) {
        return false;
      }

      if (!displayStream || displayStream.getVideoTracks().length === 0) {
        return false;
      }

      this.screenStream = displayStream;
      const screenTrack = displayStream.getVideoTracks()[0];
      if (screenTrack) {
        screenTrack.addEventListener('ended', () => {
          this.stopScreenShare(currentUserId);
        });
        // Transmit screen track to WebRTC peers
        this.peerConnections.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(screenTrack).catch(() => {});
          } else if (this.screenStream) {
            pc.addTrack(screenTrack, this.screenStream);
          }
        });
      }

      const updatedParticipants = call.participants.map(p =>
        p.userId === currentUserId ? { ...p, isScreenSharing: true } : { ...p, isScreenSharing: false }
      );
      const updatedCall = { ...call, participants: updatedParticipants };
      this.ongoingCalls.set(call.id, updatedCall);
      this.persistOngoingCalls();
      this.broadcastPacket('CALL_SESSION_SYNC', updatedCall);
      this.startScreenFrameBroadcastLoop(currentUserId);
      this.initiateWebRTCMeshForCall(updatedCall, currentUserId);
      return true;
    }
  }

  private stopScreenShare(currentUserId: string) {
    if (this.screenFrameInterval) {
      clearInterval(this.screenFrameInterval);
      this.screenFrameInterval = null;
    }
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(t => t.stop());
      this.screenStream = null;
    }
    // Restore camera video track to WebRTC peers if camera is active
    const camTrack = this.localStream?.getVideoTracks().find(t => t.readyState === 'live' && t.enabled);
    if (camTrack) {
      this.peerConnections.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(camTrack).catch(() => {});
        }
      });
    }
    if (!this.activeCallId) return;
    const call = this.ongoingCalls.get(this.activeCallId);
    if (!call) return;
    const updatedParticipants = call.participants.map(p =>
      p.userId === currentUserId ? { ...p, isScreenSharing: false } : p
    );
    const updatedCall = { ...call, participants: updatedParticipants };
    this.ongoingCalls.set(call.id, updatedCall);
    this.persistOngoingCalls();
    this.broadcastPacket('CALL_SCREEN_STOPPED', {
      callId: call.id,
      userId: currentUserId,
    });
    this.broadcastPacket('CALL_SESSION_SYNC', updatedCall);
  }

  public toggleRaiseHand(currentUserId: string): boolean {
    if (!this.activeCallId) return false;
    const call = this.ongoingCalls.get(this.activeCallId);
    if (!call) return false;

    let nextHand = false;
    const updatedParticipants = call.participants.map(p => {
      if (p.userId === currentUserId) {
        nextHand = !p.isHandRaised;
        return { ...p, isHandRaised: nextHand };
      }
      return p;
    });

    const updatedCall = { ...call, participants: updatedParticipants };
    this.ongoingCalls.set(call.id, updatedCall);
    this.persistOngoingCalls();
    this.broadcastPacket('CALL_SESSION_SYNC', updatedCall);
    return nextHand;
  }

  public sendReaction(sender: User, emoji: string) {
    if (!this.activeCallId) return;
    const reaction: LiveCallReaction = {
      id: `react-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      callId: this.activeCallId,
      senderId: sender.id,
      senderName: sender.full_name || sender.email.split('@')[0],
      emoji,
      timestamp: Date.now(),
    };
    this.reactions = [...this.reactions, reaction];
    this.notifyCallListeners();
    this.broadcastPacket('CALL_REACTION', reaction);
  }

  public sendInCallChatMessage(sender: User, text: string) {
    if (!this.activeCallId || !text.trim()) return;
    const call = this.ongoingCalls.get(this.activeCallId);
    if (!call) return;

    const msg = {
      id: `cmsg-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      senderId: sender.id,
      senderName: sender.full_name || sender.email.split('@')[0],
      senderAvatar: sender.avatar_url,
      text: text.trim(),
      timestamp: new Date().toISOString(),
    };

    const updatedCall: VideoCallSession = {
      ...call,
      chatMessages: [...call.chatMessages, msg],
    };
    this.ongoingCalls.set(call.id, updatedCall);
    this.persistOngoingCalls();
    this.broadcastPacket('CALL_SESSION_SYNC', updatedCall);
  }

  public addTranscriptLine(speakerName: string, text: string) {
    if (!this.activeCallId || !text.trim()) return;
    const call = this.ongoingCalls.get(this.activeCallId);
    if (!call) return;

    const entry = {
      id: `tr-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      speakerName,
      text: text.trim(),
      timestamp: new Date().toISOString(),
    };

    const updatedCall: VideoCallSession = {
      ...call,
      transcript: [...call.transcript.slice(-60), entry],
    };
    this.ongoingCalls.set(call.id, updatedCall);
    this.persistOngoingCalls();
    this.broadcastPacket('CALL_SESSION_SYNC', updatedCall);
  }

  public updateSharedNotes(notes: string) {
    if (!this.activeCallId) return;
    const call = this.ongoingCalls.get(this.activeCallId);
    if (!call) return;
    const updatedCall: VideoCallSession = { ...call, sharedNotes: notes };
    this.ongoingCalls.set(call.id, updatedCall);
    this.persistOngoingCalls();
    this.broadcastPacket('CALL_SESSION_SYNC', updatedCall);
  }

  public addCallActionItem(text: string, assignee?: User) {
    if (!this.activeCallId || !text.trim()) return;
    const call = this.ongoingCalls.get(this.activeCallId);
    if (!call) return;

    const newItem = {
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      text: text.trim(),
      assigneeId: assignee?.id,
      assigneeName: assignee ? assignee.full_name || assignee.email.split('@')[0] : undefined,
      completed: false,
    };

    const updatedCall: VideoCallSession = {
      ...call,
      actionItems: [...call.actionItems, newItem],
    };
    this.ongoingCalls.set(call.id, updatedCall);
    this.persistOngoingCalls();
    this.broadcastPacket('CALL_SESSION_SYNC', updatedCall);
  }

  public toggleCallActionItem(itemId: string) {
    if (!this.activeCallId) return;
    const call = this.ongoingCalls.get(this.activeCallId);
    if (!call) return;

    const updatedCall: VideoCallSession = {
      ...call,
      actionItems: call.actionItems.map(item =>
        item.id === itemId ? { ...item, completed: !item.completed } : item
      ),
    };
    this.ongoingCalls.set(call.id, updatedCall);
    this.persistOngoingCalls();
    this.broadcastPacket('CALL_SESSION_SYNC', updatedCall);
  }

  public markActionItemConverted(itemId: string, taskId: string) {
    if (!this.activeCallId) return;
    const call = this.ongoingCalls.get(this.activeCallId);
    if (!call) return;

    const updatedCall: VideoCallSession = {
      ...call,
      actionItems: call.actionItems.map(item =>
        item.id === itemId ? { ...item, convertedTaskId: taskId, completed: true } : item
      ),
    };
    this.ongoingCalls.set(call.id, updatedCall);
    this.persistOngoingCalls();
    this.broadcastPacket('CALL_SESSION_SYNC', updatedCall);
  }

  public leaveCall(currentUserId: string) {
    if (!this.activeCallId) return;
    const call = this.ongoingCalls.get(this.activeCallId);
    const callId = this.activeCallId;
    this.cleanupLocalCallState();

    if (call) {
      const remaining = call.participants.filter(p => p.userId !== currentUserId);
      const anyConnectedOrRinging = remaining.some(
        p => p.connectionState === 'connected' || p.connectionState === 'ringing'
      );
      if (!anyConnectedOrRinging) {
        this.ongoingCalls.delete(callId);
        this.broadcastPacket('CALL_SESSION_ENDED', { callId });
      } else {
        const updatedCall = { ...call, participants: remaining };
        this.ongoingCalls.set(callId, updatedCall);
        this.broadcastPacket('CALL_SESSION_SYNC', updatedCall);
      }
      this.persistOngoingCalls();
    }
  }

  public endCallForAll() {
    if (!this.activeCallId) return;
    const callId = this.activeCallId;
    this.cleanupLocalCallState();
    this.ongoingCalls.delete(callId);
    this.persistOngoingCalls();
    this.broadcastPacket('CALL_SESSION_ENDED', { callId });
  }

  private cleanupLocalCallState() {
    this.activeCallId = null;
    this.isMinimized = false;
    if (this.audioMonitorInterval) {
      clearInterval(this.audioMonitorInterval);
      this.audioMonitorInterval = null;
    }
    if (this.screenFrameInterval) {
      clearInterval(this.screenFrameInterval);
      this.screenFrameInterval = null;
    }
    if (this.cameraFrameInterval) {
      clearInterval(this.cameraFrameInterval);
      this.cameraFrameInterval = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(t => t.stop());
      this.screenStream = null;
    }
    this.peerConnections.forEach(pc => {
      try {
        pc.close();
      } catch {}
    });
    this.peerConnections.clear();
    this.remoteStreams.clear();
    this.remoteScreenFrames.clear();
    this.remoteCameraFrames.clear();
    this.notifyCallListeners();
  }

  // ============================================================================
  // WEBRTC MESH PEER CONNECTION SIGNALING
  // ============================================================================

  private getOrCreatePeerConnection(remoteUserId: string, callId: string, myUserId: string): RTCPeerConnection | null {
    if (typeof RTCPeerConnection === 'undefined') return null;
    const existing = this.peerConnections.get(remoteUserId);
    if (existing) return existing;

    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });

      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          pc.addTrack(track, this.localStream!);
        });
      }
      if (this.screenStream) {
        const screenTrack = this.screenStream.getVideoTracks()[0];
        if (screenTrack) {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(screenTrack).catch(() => {});
          } else {
            pc.addTrack(screenTrack, this.screenStream);
          }
        }
      }

      pc.onicecandidate = event => {
        if (event.candidate) {
          this.broadcastPacket('WEBRTC_SIGNAL', {
            callId,
            fromUserId: myUserId,
            toUserId: remoteUserId,
            signalType: 'ice-candidate',
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.ontrack = event => {
        if (event.streams && event.streams[0]) {
          this.remoteStreams.set(remoteUserId, event.streams[0]);
          this.notifyCallListeners();
        }
      };

      this.peerConnections.set(remoteUserId, pc);
      return pc;
    } catch (e) {
      return null;
    }
  }

  private async initiateWebRTCMeshForCall(call: VideoCallSession, myUserId: string) {
    for (const p of call.participants) {
      if (p.userId !== myUserId && p.connectionState === 'connected') {
        const pc = this.getOrCreatePeerConnection(p.userId, call.id, myUserId);
        if (pc) {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            this.broadcastPacket('WEBRTC_SIGNAL', {
              callId: call.id,
              fromUserId: myUserId,
              toUserId: p.userId,
              signalType: 'offer',
              sdp: offer,
            });
          } catch {}
        }
      }
    }
  }

  private async handleWebRTCSignal(payload: any) {
    if (!payload || !this.activeCallId || payload.callId !== this.activeCallId) return;
    const call = this.ongoingCalls.get(this.activeCallId);
    if (!call) return;

    const { fromUserId, toUserId, signalType, sdp, candidate } = payload;
    if (this.localUserId && toUserId && toUserId !== this.localUserId) return;
    const pc = this.getOrCreatePeerConnection(fromUserId, this.activeCallId, this.localUserId || toUserId);
    if (!pc) return;

    try {
      if (signalType === 'offer' && sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.broadcastPacket('WEBRTC_SIGNAL', {
          callId: this.activeCallId,
          fromUserId: this.localUserId || toUserId,
          toUserId: fromUserId,
          signalType: 'answer',
          sdp: answer,
        });
      } else if (signalType === 'answer' && sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      } else if (signalType === 'ice-candidate' && candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (e) {}
  }
}

export const meetingAndCallService = new MeetingAndCallService();
export default meetingAndCallService;
