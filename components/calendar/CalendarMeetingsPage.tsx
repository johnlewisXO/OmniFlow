import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import {
  CalendarEvent,
  CalendarEventCategory,
  MeetingAgendaItem,
  RsvpStatus,
  User,
  normalizeUserRole,
} from '../../types';
import { ICON_MAP } from '../../constants';
import { Avatar } from '../shared/Avatar';
import { Button } from '../shared/Button';
import meetingAndCallService from '../../services/meetingAndCallService';

const CATEGORY_METADATA: Record<
  CalendarEventCategory,
  { label: string; accent: string; dotColor: string; defaultDurationMin: number }
> = {
  sprint_planning: {
    label: 'Sprint Planning & Prep',
    accent: 'border-l-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
    dotColor: 'bg-indigo-500',
    defaultDurationMin: 60,
  },
  sprint_retro: {
    label: 'Sprint Review & Retro',
    accent: 'border-l-purple-500 bg-purple-500/10 text-purple-700 dark:text-purple-300',
    dotColor: 'bg-purple-500',
    defaultDurationMin: 45,
  },
  project_update: {
    label: 'Project Update & Sync',
    accent: 'border-l-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    dotColor: 'bg-emerald-500',
    defaultDurationMin: 45,
  },
  daily_standup: {
    label: 'Daily Standup',
    accent: 'border-l-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300',
    dotColor: 'bg-sky-500',
    defaultDurationMin: 15,
  },
  one_on_one: {
    label: '1:1 Video Sync',
    accent: 'border-l-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    dotColor: 'bg-amber-500',
    defaultDurationMin: 30,
  },
  team_workshop: {
    label: 'Architecture & Workshop',
    accent: 'border-l-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300',
    dotColor: 'bg-rose-500',
    defaultDurationMin: 60,
  },
};

export const CalendarMeetingsPage: React.FC = () => {
  const {
    currentUser,
    users,
    projects,
    sprints,
    tasks,
    darkMode,
    addToast,
    addNotification,
    fetchUsersForAssignmentList,
  } = useAppStore();

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [viewMode, setViewMode] = useState<'month' | 'agenda' | 'sprint_prep'>('month');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | CalendarEventCategory>('ALL');
  const [currentMonthDate, setCurrentMonthDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  // Selected Event Details & RSVP Modal
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [rsvpNoteInput, setRsvpNoteInput] = useState('');
  const [newAgendaTitle, setNewAgendaTitle] = useState('');
  const [newAgendaDuration, setNewAgendaDuration] = useState(15);

  // Schedule New Meeting Modal
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<CalendarEventCategory>('sprint_planning');
  const [formDescription, setFormDescription] = useState('');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formStartTime, setFormStartTime] = useState('11:00');
  const [formEndTime, setFormEndTime] = useState('12:00');
  const [formProjectId, setFormProjectId] = useState('');
  const [formSprintId, setFormSprintId] = useState('');
  const [formRecurrence, setFormRecurrence] = useState<'none' | 'daily' | 'weekly' | 'biweekly'>('none');
  const [formSelectedUserIds, setFormSelectedUserIds] = useState<string[]>([]);
  const [formPrepNotes, setFormPrepNotes] = useState('');
  const [formAgendaItems, setFormAgendaItems] = useState<MeetingAgendaItem[]>([]);
  const [formChannelId, setFormChannelId] = useState('chan-general');
  const [formDirectUserId, setFormDirectUserId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (currentUser && users.length === 0) {
      fetchUsersForAssignmentList();
    }
  }, [currentUser?.id]);

  // Seed & subscribe to calendar events
  useEffect(() => {
    if (currentUser) {
      meetingAndCallService.ensureSeededEvents(currentUser, users, projects, sprints);
    }
    const unsubscribe = meetingAndCallService.subscribeCalendar(updated => {
      setEvents(updated);
    });
    return () => unsubscribe();
  }, [currentUser?.id, users.length, projects.length, sprints.length]);

  // Listen for remote calendar invites and RSVP updates
  useEffect(() => {
    const handleRemoteInvite = (e: CustomEvent<CalendarEvent>) => {
      const ev = e.detail;
      if (!currentUser || !ev || ev.organizerId === currentUser.id) return;
      const isInvited = ev.attendees.some(a => a.userId === currentUser.id);
      if (isInvited) {
        addToast(
          'New Meeting Invitation',
          `${ev.organizerName} invited you to "${ev.title}". Please RSVP.`,
          'info',
          { entity_type: 'system', entity_id: ev.id }
        );
      }
    };

    const handleRemoteRsvp = (e: CustomEvent) => {
      const detail = e.detail;
      if (!currentUser || !detail) return;
      if (detail.attendee?.userId !== currentUser.id) {
        addToast(
          'Meeting RSVP Updated',
          `${detail.attendee?.name} responded "${String(detail.attendee?.rsvp).toUpperCase()}" to "${detail.eventTitle}".`,
          'info'
        );
      }
    };

    window.addEventListener('omni_remote_calendar_invite', handleRemoteInvite as EventListener);
    window.addEventListener('omni_remote_rsvp_updated', handleRemoteRsvp as EventListener);
    return () => {
      window.removeEventListener('omni_remote_calendar_invite', handleRemoteInvite as EventListener);
      window.removeEventListener('omni_remote_rsvp_updated', handleRemoteRsvp as EventListener);
    };
  }, [currentUser?.id, addToast]);

  const orgTeammates = useMemo(() => {
    if (!currentUser) return [];
    return (users || []).filter(
      u =>
        u &&
        u.id &&
        u.id !== currentUser.id &&
        (!currentUser.organization_id || u.organization_id === currentUser.organization_id)
    );
  }, [users, currentUser]);

  const selectedEvent = useMemo(() => {
    if (!selectedEventId) return null;
    return events.find(e => e.id === selectedEventId) || null;
  }, [events, selectedEventId]);

  const filteredEvents = useMemo(() => {
    return events.filter(ev => {
      if (categoryFilter !== 'ALL' && ev.category !== categoryFilter) return false;
      return true;
    });
  }, [events, categoryFilter]);

  const myPendingInvites = useMemo(() => {
    if (!currentUser) return [];
    return events.filter(ev =>
      ev.attendees.some(a => a.userId === currentUser.id && a.rsvp === 'pending')
    );
  }, [events, currentUser?.id]);

  // Populate smart sprint/project prep agenda template
  const handleAutoPopulatePrepTemplate = (
    cat: CalendarEventCategory,
    projId: string,
    sprId: string
  ) => {
    const targetProject = projects.find(p => p.id === projId) || projects[0];
    const targetSprint = sprints.find(s => s.id === sprId) || sprints[0];
    const projectTasks = tasks.filter(
      t => (!projId || t.projectId === projId) && t.status !== 'done'
    );

    if (cat === 'sprint_planning') {
      setFormTitle(
        targetSprint
          ? `${targetSprint.name} — Sprint Planning & Scope Alignment`
          : 'Upcoming Sprint Planning & Capacity Calibration'
      );
      setFormPrepNotes(
        `Sprint Goal: ${
          targetSprint?.goal || 'Deliver core high-priority user stories with zero critical regressions.'
        }\nReview team weekly capacity hours and story point estimates before committing.`
      );
      setFormAgendaItems([
        {
          id: `ag-tpl-1`,
          title: 'Review team availability, PTO & weekly story point capacity',
          durationMinutes: 10,
          completed: false,
          presenterName: currentUser?.full_name || currentUser?.email,
        },
        {
          id: `ag-tpl-2`,
          title: `Prioritize top ${Math.min(5, Math.max(3, projectTasks.length))} backlog items for ${
            targetProject?.name || 'Active Project'
          }`,
          durationMinutes: 25,
          completed: false,
        },
        {
          id: `ag-tpl-3`,
          title: 'Dependency mapping, blocker mitigation & final sprint commitment',
          durationMinutes: 20,
          completed: false,
        },
      ]);
    } else if (cat === 'project_update') {
      setFormTitle(
        targetProject
          ? `${targetProject.name} — Project Update & Milestone Review`
          : 'Cross-Functional Project Update & Stakeholder Sync'
      );
      setFormPrepNotes(
        'Prepare live status update on in-progress deliverables, risks, and upcoming milestone dates.'
      );
      setFormAgendaItems([
        {
          id: 'ag-pu-1',
          title: 'Milestone completion status & velocity health check',
          durationMinutes: 15,
          completed: false,
        },
        {
          id: 'ag-pu-2',
          title: 'Live product demo of completed sprint stories',
          durationMinutes: 20,
          completed: false,
        },
        {
          id: 'ag-pu-3',
          title: 'Risk register review & stakeholder sign-off',
          durationMinutes: 10,
          completed: false,
        },
      ]);
    } else if (cat === 'sprint_retro') {
      setFormTitle(
        targetSprint ? `${targetSprint.name} — Retrospective & Continuous Improvement` : 'Sprint Retrospective'
      );
      setFormPrepNotes('Share what went well, what slowed us down, and concrete action items for next sprint.');
      setFormAgendaItems([
        { id: 'ag-ret-1', title: 'Wins & What Went Well across the team', durationMinutes: 15, completed: false },
        { id: 'ag-ret-2', title: 'Friction points, bottlenecks & scope changes', durationMinutes: 15, completed: false },
        { id: 'ag-ret-3', title: 'Commit to 3 measurable process improvements', durationMinutes: 15, completed: false },
      ]);
    }
  };

  const openScheduleModalWithDefaults = (opts?: {
    dateStr?: string;
    category?: CalendarEventCategory;
    preselectedUserIds?: string[];
    title?: string;
    channelId?: string;
    directUserId?: string;
  }) => {
    const defaultIds =
      opts?.preselectedUserIds || orgTeammates.map(u => u.id);
    setFormDate(opts?.dateStr || new Date().toISOString().slice(0, 10));
    setFormCategory(opts?.category || 'sprint_planning');
    setFormSelectedUserIds(defaultIds);
    setFormChannelId(opts?.channelId || 'chan-general');
    setFormDirectUserId(opts?.directUserId);
    const defaultProjId = projects[0]?.id || '';
    const defaultSprId = sprints[0]?.id || '';
    setFormProjectId(defaultProjId);
    setFormSprintId(defaultSprId);

    if (opts?.title) {
      setFormTitle(opts.title);
      setFormAgendaItems([
        {
          id: 'ag-init-1',
          title: 'Kickoff alignment & key objectives',
          durationMinutes: 15,
          completed: false,
        },
        {
          id: 'ag-init-2',
          title: 'Action items & ownership',
          durationMinutes: 15,
          completed: false,
        },
      ]);
    } else {
      handleAutoPopulatePrepTemplate(
        opts?.category || 'sprint_planning',
        defaultProjId,
        defaultSprId
      );
    }
    setIsScheduleModalOpen(true);
  };

  const handleCreateMeetingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !formTitle.trim()) return;

    const startIso = new Date(`${formDate}T${formStartTime}:00`).toISOString();
    const endIso = new Date(`${formDate}T${formEndTime}:00`).toISOString();
    const invitedUsers = orgTeammates.filter(u => formSelectedUserIds.includes(u.id));

    const created = await meetingAndCallService.scheduleMeeting({
      title: formTitle,
      description: formDescription,
      category: formCategory,
      startTime: startIso,
      endTime: endIso,
      organizer: currentUser,
      invitedUsers,
      projectId: formProjectId || undefined,
      sprintId: formSprintId || undefined,
      channelId: formChannelId,
      directUserId: formDirectUserId,
      agenda: formAgendaItems,
      prepNotes: formPrepNotes,
      recurrence: formRecurrence,
      postToChat: true,
    });

    // Notify invited users in the notification store
    invitedUsers.forEach(u => {
      addNotification({
        user_id: u.id,
        type: 'CALENDAR_INVITE',
        title: `Meeting Invite: ${created.title}`,
        message: `${currentUser.full_name || currentUser.email} invited you to "${created.title}" on ${new Date(
          created.startTime
        ).toLocaleString([], {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}. Click to RSVP.`,
        entity_type: 'system',
        entity_id: created.id,
      });
    });

    addToast(
      'Meeting Scheduled & Invites Sent',
      `"${created.title}" added to Calendar. Invitations with RSVP dispatched to ${invitedUsers.length} teammates.`,
      'success'
    );
    setIsScheduleModalOpen(false);
    setSelectedEventId(created.id);
  };

  const handleUserRsvp = (event: CalendarEvent, status: RsvpStatus, customNote?: string) => {
    if (!currentUser) return;
    meetingAndCallService.updateRsvp(event.id, currentUser, status, customNote ?? rsvpNoteInput);
    const label = status === 'going' ? 'Going (Accepted)' : status === 'maybe' ? 'Maybe (Tentative)' : 'Declined';
    addToast('RSVP Recorded', `Your RSVP for "${event.title}" is now "${label}".`, 'success');
  };

  const handleSimulateTeammateRsvps = (event: CalendarEvent) => {
    const pendingAttendees = event.attendees.filter(
      a => a.userId !== currentUser?.id && a.rsvp === 'pending'
    );
    const targets =
      pendingAttendees.length > 0
        ? pendingAttendees
        : event.attendees.filter(a => a.userId !== currentUser?.id);

    if (targets.length === 0) {
      addToast('No Other Attendees', 'Invite teammates to this event first.', 'info');
      return;
    }

    targets.forEach((att, idx) => {
      const userObj: User = {
        id: att.userId,
        supabase_auth_id: att.userId,
        email: att.email,
        full_name: att.name,
        avatar_url: att.avatar,
        role: att.role,
      };
      const simulatedStatus: RsvpStatus = idx % 3 === 2 ? 'maybe' : 'going';
      const simulatedNote =
        simulatedStatus === 'going'
          ? 'Confirmed! Prepared sprint updates.'
          : 'Tentative — wrapping up deployment check.';
      meetingAndCallService.updateRsvp(event.id, userObj, simulatedStatus, simulatedNote);
    });

    addToast(
      'Teammate RSVPs Received',
      `${targets.length} teammates responded to "${event.title}".`,
      'success'
    );
  };

  const handleLaunchCallFromEvent = (event: CalendarEvent, showLobby = true) => {
    if (!currentUser) return;
    const invitedUsers = orgTeammates.filter(u =>
      event.attendees.some(a => a.userId === u.id)
    );
    window.dispatchEvent(
      new CustomEvent('omni_start_video_call', {
        detail: {
          title: event.title,
          type: 'scheduled',
          meetingCode: event.meetingCode,
          channelId: event.channelId,
          invitedUsers,
          calendarEvent: event,
          projectId: event.projectId,
          sprintId: event.sprintId,
          showLobby,
        },
      })
    );
  };

  // Build Month Calendar Grid cells
  const calendarDays = useMemo(() => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: { date: Date; dateStr: string; isCurrentMonth: boolean; isToday: boolean }[] = [];
    const todayStr = new Date().toISOString().slice(0, 10);

    // Previous month padding
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthDays - i);
      const dateStr = d.toISOString().slice(0, 10);
      cells.push({ date: d, dateStr, isCurrentMonth: false, isToday: dateStr === todayStr });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const dateStr = d.toISOString().slice(0, 10);
      cells.push({ date: d, dateStr, isCurrentMonth: true, isToday: dateStr === todayStr });
    }

    // Next month padding to 35 or 42 cells
    const totalCells = cells.length <= 35 ? 35 : 42;
    let nextDay = 1;
    while (cells.length < totalCells) {
      const d = new Date(year, month + 1, nextDay++);
      const dateStr = d.toISOString().slice(0, 10);
      cells.push({ date: d, dateStr, isCurrentMonth: false, isToday: dateStr === todayStr });
    }

    return cells;
  }, [currentMonthDate]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto w-full">
      {/* 1. TOP HEADER BAR */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Calendar, Meetings & Sprint Prep
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Schedule team meetings, prepare sprint agendas, manage attendee RSVPs, and launch HD video rooms.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Segmented View Toggle */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/70">
            {(
              [
                { id: 'month', label: 'Month Grid' },
                { id: 'agenda', label: 'Agenda & RSVPs' },
                { id: 'sprint_prep', label: 'Sprint & Project Prep' },
              ] as const
            ).map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setViewMode(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  viewMode === tab.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              if (!currentUser) return;
              window.dispatchEvent(
                new CustomEvent('omni_start_video_call', {
                  detail: {
                    title: `${currentUser.full_name || 'Team'}'s Instant Video Sync`,
                    type: 'channel',
                    channelId: 'chan-general',
                    invitedUsers: orgTeammates,
                    showLobby: true,
                  },
                })
              );
            }}
            className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              darkMode
                ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-emerald-400'
                : 'bg-white hover:bg-slate-50 border-slate-200 text-emerald-700'
            }`}
          >
            <ICON_MAP.VideoCameraIcon className="w-4 h-4" />
            <span>Meet Now</span>
          </button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => openScheduleModalWithDefaults()}
            className="rounded-xl gap-1.5 py-2 px-4"
          >
            <ICON_MAP.PlusIcon className="w-4 h-4" />
            <span>Schedule Meeting</span>
          </Button>
        </div>
      </div>

      {/* 2. PENDING RSVP INVITATIONS BANNER */}
      {myPendingInvites.length > 0 && (
        <div
          className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
            darkMode
              ? 'bg-indigo-950/30 border-indigo-500/30 text-slate-100'
              : 'bg-indigo-50/70 border-indigo-200 text-slate-900'
          }`}
        >
          <div className="space-y-1">
            <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
              Awaiting Your RSVP ({myPendingInvites.length}{' '}
              {myPendingInvites.length === 1 ? 'invitation' : 'invitations'})
            </div>
            <div className="text-sm font-bold">{myPendingInvites[0].title}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Invited by {myPendingInvites[0].organizerName} ·{' '}
              {new Date(myPendingInvites[0].startTime).toLocaleString([], {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              · Room {myPendingInvites[0].meetingCode}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleUserRsvp(myPendingInvites[0], 'going')}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Accept (Going)
            </button>
            <button
              type="button"
              onClick={() => handleUserRsvp(myPendingInvites[0], 'maybe')}
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-semibold transition-colors cursor-pointer"
            >
              Maybe
            </button>
            <button
              type="button"
              onClick={() => handleUserRsvp(myPendingInvites[0], 'declined')}
              className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-300 border border-rose-500/30 text-xs font-semibold transition-colors cursor-pointer"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={() => setSelectedEventId(myPendingInvites[0].id)}
              className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
            >
              View Agenda
            </button>
          </div>
        </div>
      )}

      {/* 3. FILTER & MONTH CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() =>
              setCurrentMonthDate(
                prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
              )
            }
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs cursor-pointer"
          >
            ←
          </button>
          <h2 className="text-base font-bold text-slate-900 dark:text-white min-w-[160px] text-center">
            {currentMonthDate.toLocaleDateString([], { month: 'long', year: 'numeric' })}
          </h2>
          <button
            type="button"
            onClick={() =>
              setCurrentMonthDate(
                prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
              )
            }
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs cursor-pointer"
          >
            →
          </button>
          <button
            type="button"
            onClick={() => {
              const d = new Date();
              d.setDate(1);
              setCurrentMonthDate(d);
            }}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
          >
            Today
          </button>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'ALL', label: 'All Events' },
              { id: 'sprint_planning', label: 'Sprint Planning' },
              { id: 'project_update', label: 'Project Updates' },
              { id: 'daily_standup', label: 'Standups' },
              { id: 'one_on_one', label: '1:1 Syncs' },
            ] as const
          ).map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                categoryFilter === cat.id
                  ? 'bg-indigo-600 text-white'
                  : darkMode
                  ? 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4A. MONTH GRID VIEW */}
      {viewMode === 'month' && (
        <div
          className={`rounded-2xl border overflow-hidden ${
            darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div
                key={day}
                className="py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400 text-center"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Cells */}
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-200/70 dark:divide-slate-800/80">
            {calendarDays.map(cell => {
              const dayEvents = filteredEvents.filter(
                ev => ev.startTime.slice(0, 10) === cell.dateStr
              );
              const dueTasks = tasks.filter(
                t => (t.dueDate || t.due_date || '').slice(0, 10) === cell.dateStr
              );

              return (
                <div
                  key={cell.dateStr}
                  onClick={() => openScheduleModalWithDefaults({ dateStr: cell.dateStr })}
                  className={`min-h-[120px] p-2 transition-colors cursor-pointer flex flex-col justify-between ${
                    !cell.isCurrentMonth
                      ? 'opacity-40 bg-slate-50/40 dark:bg-slate-950/30'
                      : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-mono tabular-nums w-6 h-6 rounded-full flex items-center justify-center ${
                        cell.isToday
                          ? 'bg-indigo-600 text-white font-bold'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {cell.date.getDate()}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        {dayEvents.length} {dayEvents.length === 1 ? 'mtg' : 'mtgs'}
                      </span>
                    )}
                  </div>

                  <div className="mt-1.5 space-y-1 flex-1">
                    {dayEvents.slice(0, 3).map(ev => {
                      const catStyle =
                        CATEGORY_METADATA[ev.category] || CATEGORY_METADATA.sprint_planning;
                      const myAtt = ev.attendees.find(a => a.userId === currentUser?.id);
                      return (
                        <div
                          key={ev.id}
                          onClick={e => {
                            e.stopPropagation();
                            setSelectedEventId(ev.id);
                          }}
                          className={`px-2 py-1 rounded-md border-l-2 text-[11px] font-medium truncate transition-transform hover:scale-[1.01] ${catStyle.accent}`}
                          title={`${ev.title} (${new Date(ev.startTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })})`}
                        >
                          <span className="font-mono mr-1">
                            {new Date(ev.startTime).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <span>{ev.title}</span>
                          {myAtt?.rsvp === 'pending' && (
                            <span className="ml-1 text-amber-500 font-bold">· RSVP</span>
                          )}
                        </div>
                      );
                    })}

                    {dueTasks.slice(0, 1).map(t => (
                      <div
                        key={t.id}
                        onClick={e => e.stopPropagation()}
                        className="px-2 py-0.5 rounded text-[10px] text-slate-500 dark:text-slate-400 truncate"
                      >
                        🎯 Due: {t.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4B. AGENDA & RSVP STREAM VIEW */}
      {viewMode === 'agenda' && (
        <div className="space-y-3">
          {filteredEvents.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-slate-200 dark:border-slate-800">
              <p className="text-sm text-slate-500">No scheduled meetings match the current filter.</p>
            </div>
          ) : (
            filteredEvents.map(ev => {
              const catMeta = CATEGORY_METADATA[ev.category] || CATEGORY_METADATA.sprint_planning;
              const goingCount = ev.attendees.filter(a => a.rsvp === 'going').length;
              const maybeCount = ev.attendees.filter(a => a.rsvp === 'maybe').length;
              const pendingCount = ev.attendees.filter(a => a.rsvp === 'pending').length;
              const myAttendee = ev.attendees.find(a => a.userId === currentUser?.id);

              return (
                <div
                  key={ev.id}
                  onClick={() => setSelectedEventId(ev.id)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                    darkMode
                      ? 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className={`w-2 h-2 rounded-full ${catMeta.dotColor}`} />
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {catMeta.label}
                      </span>
                      <span>·</span>
                      <span className="font-mono">
                        {new Date(ev.startTime).toLocaleDateString([], {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        {new Date(ev.startTime).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        –{' '}
                        {new Date(ev.endTime).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span>·</span>
                      <span>Invited by {ev.organizerName}</span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {ev.title}
                    </h3>

                    {ev.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                        {ev.description}
                      </p>
                    )}

                    <div className="flex items-center gap-3 pt-1 text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex -space-x-1.5">
                        {ev.attendees.slice(0, 6).map(att => (
                          <div key={att.userId} className="ring-2 ring-white dark:ring-slate-900 rounded-full">
                            <Avatar
                              user={{
                                id: att.userId,
                                supabase_auth_id: att.userId,
                                email: att.email,
                                full_name: att.name,
                                avatar_url: att.avatar,
                                role: att.role,
                              }}
                              size="sm"
                            />
                          </div>
                        ))}
                      </div>
                      <span>
                        {goingCount} Going · {maybeCount} Maybe · {pendingCount} Awaiting RSVP
                      </span>
                    </div>
                  </div>

                  {/* Quick RSVP + Join Video Call Actions */}
                  <div
                    className="flex flex-wrap items-center gap-2 flex-shrink-0"
                    onClick={e => e.stopPropagation()}
                  >
                    {(
                      [
                        { id: 'going', label: 'Going' },
                        { id: 'maybe', label: 'Maybe' },
                        { id: 'declined', label: 'Decline' },
                      ] as const
                    ).map(opt => {
                      const active = myAttendee?.rsvp === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleUserRsvp(ev, opt.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
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

                    <button
                      type="button"
                      onClick={() => handleLaunchCallFromEvent(ev, true)}
                      className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <ICON_MAP.VideoCameraIcon className="w-3.5 h-3.5" />
                      <span>Join Video</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 4C. SPRINT & PROJECT PREP STUDIO VIEW */}
      {viewMode === 'sprint_prep' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Upcoming Sprint Ceremonies & Project Reviews
            </h3>
            {events.map(ev => (
              <div
                key={ev.id}
                className={`p-5 rounded-2xl border space-y-3 ${
                  darkMode ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-indigo-500 font-semibold">
                      {CATEGORY_METADATA[ev.category]?.label} · Room {ev.meetingCode}
                    </div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                      {ev.title}
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLaunchCallFromEvent(ev, true)}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <ICON_MAP.VideoCameraIcon className="w-3.5 h-3.5" />
                    <span>Launch Video Prep</span>
                  </button>
                </div>

                {ev.prepNotes && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {ev.prepNotes}
                  </p>
                )}

                <div className="space-y-1.5 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Prepared Agenda ({ev.agenda.filter(a => a.completed).length}/{ev.agenda.length} completed)
                  </div>
                  {ev.agenda.map(ag => (
                    <label
                      key={ag.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={ag.completed}
                          onChange={() => meetingAndCallService.toggleAgendaItem(ev.id, ag.id)}
                        />
                        <span className={ag.completed ? 'line-through text-slate-400' : ''}>
                          {ag.title}
                        </span>
                      </div>
                      <span className="font-mono text-slate-400">{ag.durationMinutes}m</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Right Quick Ceremony Templates */}
          <div className="lg:col-span-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              1-Click Ceremony & Meeting Templates
            </h3>
            <div className="space-y-3">
              {(
                [
                  {
                    cat: 'sprint_planning' as CalendarEventCategory,
                    title: 'Schedule Sprint Planning & Backlog Prep',
                    desc: 'Auto-imports active backlog items, velocity target, and capacity check into the meeting agenda.',
                  },
                  {
                    cat: 'project_update' as CalendarEventCategory,
                    title: 'Schedule Executive Project Update',
                    desc: 'Invites project stakeholders with milestone progress, risk register, and live demo slots.',
                  },
                  {
                    cat: 'sprint_retro' as CalendarEventCategory,
                    title: 'Schedule Sprint Retrospective',
                    desc: 'Structured agenda for Wins, Bottlenecks, and concrete next-sprint improvements.',
                  },
                  {
                    cat: 'one_on_one' as CalendarEventCategory,
                    title: 'Schedule 1:1 Teammate Coaching Sync',
                    desc: 'Private 1:1 video room with shared talking points and career/workload check-in.',
                  },
                ] as const
              ).map(tpl => (
                <div
                  key={tpl.cat}
                  className={`p-4 rounded-2xl border flex items-start justify-between gap-4 ${
                    darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">{tpl.title}</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{tpl.desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openScheduleModalWithDefaults({ category: tpl.cat })}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex-shrink-0 cursor-pointer"
                  >
                    Schedule
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          5. EVENT DETAILS, RSVP & SPRINT PREP MODAL
         ======================================================================== */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setSelectedEventId(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className={`rounded-2xl border shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 animate-modal-appear ${
              darkMode
                ? 'bg-slate-900 border-slate-800 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-indigo-500">
                  {CATEGORY_METADATA[selectedEvent.category]?.label} · Room{' '}
                  <span className="font-mono">{selectedEvent.meetingCode}</span>
                </div>
                <h3 className="text-lg font-bold">{selectedEvent.title}</h3>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {new Date(selectedEvent.startTime).toLocaleString([], {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  –{' '}
                  {new Date(selectedEvent.endTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  · Organized by <strong>{selectedEvent.organizerName}</strong>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const ev = selectedEvent;
                    setSelectedEventId(null);
                    handleLaunchCallFromEvent(ev, true);
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <ICON_MAP.VideoCameraIcon className="w-4 h-4" />
                  <span>Join Video Call</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedEventId(null)}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Your RSVP Bar */}
            <div
              className={`p-4 rounded-xl border space-y-3 ${
                darkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold">Your RSVP Response</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Let {selectedEvent.organizerName} and the team know your attendance status
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {(
                    [
                      { id: 'going', label: '✓ Going' },
                      { id: 'maybe', label: '? Maybe' },
                      { id: 'declined', label: '✕ Decline' },
                    ] as const
                  ).map(opt => {
                    const myRsvp = selectedEvent.attendees.find(
                      a => a.userId === currentUser?.id
                    )?.rsvp;
                    const active = myRsvp === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleUserRsvp(selectedEvent, opt.id)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                          active
                            ? opt.id === 'going'
                              ? 'bg-emerald-600 text-white border-emerald-500'
                              : opt.id === 'maybe'
                              ? 'bg-amber-500 text-slate-950 border-amber-400'
                              : 'bg-rose-600 text-white border-rose-500'
                            : darkMode
                            ? 'bg-slate-800 border-slate-700 text-slate-300'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={rsvpNoteInput}
                  onChange={e => setRsvpNoteInput(e.target.value)}
                  placeholder="Optional RSVP note (e.g. 'Will demo Sprint 4 API', 'Joining 5m late')..."
                  className={`flex-1 px-3 py-1.5 rounded-xl border text-xs outline-none ${
                    darkMode
                      ? 'bg-slate-900 border-slate-800 text-white placeholder-slate-500'
                      : 'bg-white border-slate-200 text-slate-900'
                  }`}
                />
                {rsvpNoteInput.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      const currentStatus =
                        selectedEvent.attendees.find(a => a.userId === currentUser?.id)?.rsvp ||
                        'going';
                      handleUserRsvp(selectedEvent, currentStatus, rsvpNoteInput);
                      setRsvpNoteInput('');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
                  >
                    Save Note
                  </button>
                )}
              </div>
            </div>

            {/* Two-Column Body: Attendees & RSVPs vs Agenda & Prep */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* Left: Attendee List & RSVP Statuses */}
              <div className="md:col-span-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Invited Attendees ({selectedEvent.attendees.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => handleSimulateTeammateRsvps(selectedEvent)}
                    className="text-[11px] font-semibold text-indigo-500 hover:underline cursor-pointer"
                  >
                    Simulate Teammate RSVPs
                  </button>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
                  {selectedEvent.attendees.map(att => (
                    <div
                      key={att.userId}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                        darkMode
                          ? 'bg-slate-950/40 border-slate-800'
                          : 'bg-slate-50/70 border-slate-200/70'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar
                          user={{
                            id: att.userId,
                            supabase_auth_id: att.userId,
                            email: att.email,
                            full_name: att.name,
                            avatar_url: att.avatar,
                            role: att.role,
                          }}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold truncate">
                            {att.name} {att.userId === selectedEvent.organizerId ? '(Organizer)' : ''}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {att.rsvpNote || att.email}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`text-[11px] font-semibold capitalize ${
                          att.rsvp === 'going'
                            ? 'text-emerald-500'
                            : att.rsvp === 'maybe'
                            ? 'text-amber-500'
                            : att.rsvp === 'declined'
                            ? 'text-rose-500'
                            : 'text-slate-400'
                        }`}
                      >
                        {att.rsvp === 'pending' ? 'Awaiting RSVP' : att.rsvp}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Quick Invite Remaining Org Members */}
                {orgTeammates.some(
                  u => !selectedEvent.attendees.some(a => a.userId === u.id)
                ) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!currentUser) return;
                      const missing = orgTeammates.filter(
                        u => !selectedEvent.attendees.some(a => a.userId === u.id)
                      );
                      meetingAndCallService.inviteUsersToCalendarEvent(
                        selectedEvent.id,
                        missing,
                        currentUser
                      );
                      addToast(
                        'Invited Remaining Teammates',
                        `Sent invitations to ${missing.length} additional teammates.`,
                        'success'
                      );
                    }}
                    className="w-full py-2 px-3 rounded-xl border border-dashed border-indigo-500/40 text-indigo-500 text-xs font-semibold hover:bg-indigo-500/10 transition-colors cursor-pointer"
                  >
                    + Invite All Remaining Organization Members
                  </button>
                )}
              </div>

              {/* Right: Meeting Prep Agenda & Notes */}
              <div className="md:col-span-6 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Meeting Prep & Agenda ({selectedEvent.agenda.length})
                </h4>

                <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin">
                  {selectedEvent.agenda.map(ag => (
                    <label
                      key={ag.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs cursor-pointer ${
                        darkMode
                          ? 'bg-slate-950/40 border-slate-800'
                          : 'bg-slate-50/70 border-slate-200/70'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={ag.completed}
                          onChange={() =>
                            meetingAndCallService.toggleAgendaItem(selectedEvent.id, ag.id)
                          }
                        />
                        <span className={`truncate ${ag.completed ? 'line-through text-slate-400' : ''}`}>
                          {ag.title}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-400 flex-shrink-0">
                        {ag.durationMinutes}m
                      </span>
                    </label>
                  ))}
                </div>

                {/* Add Agenda Item */}
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    if (!newAgendaTitle.trim()) return;
                    meetingAndCallService.addAgendaItem(selectedEvent.id, {
                      title: newAgendaTitle.trim(),
                      durationMinutes: Number(newAgendaDuration) || 15,
                      presenterName: currentUser?.full_name || currentUser?.email,
                    });
                    setNewAgendaTitle('');
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={newAgendaTitle}
                    onChange={e => setNewAgendaTitle(e.target.value)}
                    placeholder="Add agenda topic..."
                    className={`flex-1 px-3 py-1.5 rounded-xl border text-xs outline-none ${
                      darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200'
                    }`}
                  />
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={newAgendaDuration}
                    onChange={e => setNewAgendaDuration(Number(e.target.value))}
                    className={`w-16 px-2 py-1.5 rounded-xl border text-xs font-mono ${
                      darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200'
                    }`}
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
                  >
                    + Add
                  </button>
                </form>

                {/* Shared Prep Notes */}
                <div className="pt-2">
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Sprint / Project Prep Notes
                  </label>
                  <textarea
                    rows={3}
                    value={selectedEvent.prepNotes || ''}
                    onChange={e =>
                      meetingAndCallService.updateEventPrepNotes(selectedEvent.id, e.target.value)
                    }
                    placeholder="Pre-read context, sprint links, or questions for attendees..."
                    className={`w-full p-2.5 rounded-xl border text-xs outline-none resize-none ${
                      darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200'
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          6. SCHEDULE NEW MEETING & SPRINT PREP MODAL
         ======================================================================== */}
      {isScheduleModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setIsScheduleModalOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className={`rounded-2xl border shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 animate-modal-appear ${
              darkMode
                ? 'bg-slate-900 border-slate-800 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold">Schedule Team Meeting & Sprint Prep</h3>
                <p className="text-xs text-slate-400">
                  Every invited attendee receives a Calendar & Teams Chat invite with live RSVP
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMeetingSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-slate-400">Meeting Type</label>
                  <select
                    value={formCategory}
                    onChange={e => {
                      const nextCat = e.target.value as CalendarEventCategory;
                      setFormCategory(nextCat);
                      handleAutoPopulatePrepTemplate(nextCat, formProjectId, formSprintId);
                    }}
                    className={`w-full px-3 py-2 rounded-xl border ${
                      darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <option value="sprint_planning">Sprint Planning & Prep</option>
                    <option value="project_update">Project Update & Stakeholder Review</option>
                    <option value="sprint_retro">Sprint Review & Retrospective</option>
                    <option value="daily_standup">Daily Standup</option>
                    <option value="one_on_one">1:1 Video Sync</option>
                    <option value="team_workshop">Architecture & Team Workshop</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-slate-400">
                    Link Project / Sprint Context
                  </label>
                  <select
                    value={formProjectId}
                    onChange={e => {
                      setFormProjectId(e.target.value);
                      handleAutoPopulatePrepTemplate(formCategory, e.target.value, formSprintId);
                    }}
                    className={`w-full px-3 py-2 rounded-xl border ${
                      darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <option value="">General Organization Workspace</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>
                        Project: {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-400">Meeting Title</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="e.g. Sprint 5 Planning & Velocity Alignment"
                  className={`w-full px-3 py-2 rounded-xl border ${
                    darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-slate-400">Date</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border font-mono ${
                      darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-slate-400">Start Time</label>
                  <input
                    type="time"
                    required
                    value={formStartTime}
                    onChange={e => setFormStartTime(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border font-mono ${
                      darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-slate-400">End Time</label>
                  <input
                    type="time"
                    required
                    value={formEndTime}
                    onChange={e => setFormEndTime(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border font-mono ${
                      darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>
              </div>

              {/* Invite Attendees with RSVP */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-slate-400">
                    Invite Organization Teammates ({formSelectedUserIds.length} invited — will receive RSVP request)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (formSelectedUserIds.length === orgTeammates.length) {
                        setFormSelectedUserIds([]);
                      } else {
                        setFormSelectedUserIds(orgTeammates.map(u => u.id));
                      }
                    }}
                    className="text-[11px] font-semibold text-indigo-500 hover:underline cursor-pointer"
                  >
                    {formSelectedUserIds.length === orgTeammates.length
                      ? 'Clear Selection'
                      : 'Invite Entire Organization'}
                  </button>
                </div>

                <div
                  className={`max-h-36 overflow-y-auto p-2 rounded-xl border space-y-1 scrollbar-thin ${
                    darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  {orgTeammates.map(u => {
                    const checked = formSelectedUserIds.includes(u.id);
                    return (
                      <label
                        key={u.id}
                        className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-800/40 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setFormSelectedUserIds(prev =>
                                checked ? prev.filter(id => id !== u.id) : [...prev, u.id]
                              )
                            }
                          />
                          <Avatar user={u} size="sm" showHoverCard={false} />
                          <span className="font-semibold">{u.full_name || u.email}</span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {normalizeUserRole(u.role).replace(/_/g, ' ')}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Prep Notes */}
              <div>
                <label className="block font-semibold mb-1 text-slate-400">
                  Meeting Prep Notes & Pre-Read Agenda
                </label>
                <textarea
                  rows={2}
                  value={formPrepNotes}
                  onChange={e => setFormPrepNotes(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border resize-none ${
                    darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsScheduleModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Schedule & Send Invites to All Attendees
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarMeetingsPage;
