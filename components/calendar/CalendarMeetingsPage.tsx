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
import { PageHeader, SegmentedTabs, HairlineCard, StatusDot } from '../shared/EditorialUI';

const CATEGORY_METADATA: Record<
  CalendarEventCategory,
  { label: string; accent: string; dotColor: string; defaultDurationMin: number }
> = {
  sprint_planning: {
    label: 'Sprint Planning & Prep',
    accent: 'border border-[#6F8254]/30 bg-[var(--bg-sage)] text-[var(--text-primary)]',
    dotColor: 'bg-[#6F8254] dark:bg-[var(--accent-lime)]',
    defaultDurationMin: 60,
  },
  sprint_retro: {
    label: 'Sprint Review & Retro',
    accent: 'border border-[var(--border-strong)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)]',
    dotColor: 'bg-[var(--text-primary)]',
    defaultDurationMin: 45,
  },
  project_update: {
    label: 'Project Update & Sync',
    accent: 'border border-emerald-600/30 bg-emerald-600/10 text-emerald-800 dark:text-emerald-300',
    dotColor: 'bg-emerald-600 dark:bg-emerald-400',
    defaultDurationMin: 45,
  },
  daily_standup: {
    label: 'Daily Standup',
    accent: 'border border-teal-600/30 bg-teal-600/10 text-teal-800 dark:text-teal-300',
    dotColor: 'bg-teal-600 dark:bg-teal-400',
    defaultDurationMin: 15,
  },
  one_on_one: {
    label: '1:1 Video Sync',
    accent: 'border border-amber-600/30 bg-amber-500/10 text-amber-800 dark:text-amber-300',
    dotColor: 'bg-amber-600 dark:bg-amber-400',
    defaultDurationMin: 30,
  },
  team_workshop: {
    label: 'Architecture & Workshop',
    accent: 'border border-rose-600/30 bg-rose-600/10 text-rose-800 dark:text-rose-300',
    dotColor: 'bg-rose-600 dark:bg-rose-400',
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
    <div className="p-4 sm:p-6 space-y-5 max-w-[1440px] mx-auto w-full text-[var(--text-primary)]">
      {/* 1. EDITORIAL HEADER BAR */}
      <PageHeader
        eyebrow="Schedule & Ceremonies · Video Rooms"
        title="Calendar & Team Meetings"
        subtitle="Coordinate sprint ceremonies, track attendance RSVPs, and launch instant video sync rooms."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedTabs
              size="sm"
              value={viewMode}
              onChange={setViewMode}
              options={[
                { id: 'month', label: 'Month' },
                { id: 'agenda', label: 'Agenda' },
                { id: 'sprint_prep', label: 'Planning' },
              ]}
            />

            <Button
              type="button"
              variant="secondary"
              size="sm"
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
            >
              <ICON_MAP.VideoCameraIcon className="w-3.5 h-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400" />
              <span>Instant Meet</span>
            </Button>

            <Button
              type="button"
              variant="lime"
              size="sm"
              onClick={() => openScheduleModalWithDefaults()}
            >
              <ICON_MAP.PlusIcon className="w-3.5 h-3.5 mr-1" />
              <span>New Meeting</span>
            </Button>
          </div>
        }
      />

      {/* 2. PENDING RSVP INVITATIONS BANNER */}
      {myPendingInvites.length > 0 && (
        <HairlineCard className="border-[var(--border-strong)] bg-[var(--bg-sage)]/45 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <StatusDot
              tone="lime"
              label={`Awaiting Your RSVP · ${myPendingInvites.length} pending ${myPendingInvites.length === 1 ? 'invitation' : 'invitations'}`}
              className="text-xs font-semibold text-[var(--text-primary)]"
            />
            <div className="text-sm font-bold text-[var(--text-primary)]">{myPendingInvites[0].title}</div>
            <div className="text-xs text-[var(--text-secondary)]">
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
            <Button
              type="button"
              variant="lime"
              size="sm"
              onClick={() => handleUserRsvp(myPendingInvites[0], 'going')}
            >
              Accept
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleUserRsvp(myPendingInvites[0], 'maybe')}
            >
              Maybe
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleUserRsvp(myPendingInvites[0], 'declined')}
              className="text-rose-600 dark:text-rose-400"
            >
              Decline
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedEventId(myPendingInvites[0].id)}
            >
              View Agenda
            </Button>
          </div>
        </HairlineCard>
      )}

      {/* 3. FILTER & MONTH CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setCurrentMonthDate(
                prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
              )
            }
            className="w-8 h-8 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-sage)] flex items-center justify-center text-xs cursor-pointer transition-colors"
            aria-label="Previous month"
          >
            ←
          </button>
          <h2 className="text-sm sm:text-base font-bold text-[var(--text-primary)] min-w-[150px] text-center">
            {currentMonthDate.toLocaleDateString([], { month: 'long', year: 'numeric' })}
          </h2>
          <button
            type="button"
            onClick={() =>
              setCurrentMonthDate(
                prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
              )
            }
            className="w-8 h-8 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-sage)] flex items-center justify-center text-xs cursor-pointer transition-colors"
            aria-label="Next month"
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
            className="px-3 py-1 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-sage)] text-xs font-medium text-[var(--text-primary)] cursor-pointer transition-colors"
          >
            Today
          </button>
        </div>

        <SegmentedTabs
          size="sm"
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={[
            { id: 'ALL', label: 'All' },
            { id: 'sprint_planning', label: 'Planning' },
            { id: 'project_update', label: 'Updates' },
            { id: 'daily_standup', label: 'Check-ins' },
            { id: 'one_on_one', label: '1:1s' },
          ]}
        />
      </div>

      {/* 4A. MONTH GRID VIEW */}
      {viewMode === 'month' && (
        <div className="editorial-surface overflow-hidden">
          <div className="grid grid-cols-7 border-b border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)]">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div
                key={day}
                className="py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] text-center"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 divide-x divide-y divide-[var(--border-hairline)]">
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
                  className={`min-h-[118px] p-2 transition-colors cursor-pointer flex flex-col justify-between ${
                    !cell.isCurrentMonth
                      ? 'opacity-40 bg-[var(--bg-surface-subtle)]'
                      : 'hover:bg-[var(--bg-surface-subtle)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-mono tabular-nums w-6 h-6 rounded-full flex items-center justify-center ${
                        cell.isToday
                          ? 'bg-[var(--accent-lime)] text-[var(--accent-ink)] font-bold'
                          : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      {cell.date.getDate()}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">
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
                          className={`px-2 py-1 rounded-lg text-[11px] font-medium truncate transition-opacity hover:opacity-85 ${catStyle.accent}`}
                          title={`${ev.title} (${new Date(ev.startTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })})`}
                        >
                          <span className="font-mono mr-1 opacity-75">
                            {new Date(ev.startTime).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <span>{ev.title}</span>
                          {myAtt?.rsvp === 'pending' && (
                            <span className="ml-1 text-amber-600 dark:text-amber-400 font-bold">· RSVP</span>
                          )}
                        </div>
                      );
                    })}

                    {dueTasks.slice(0, 1).map(t => (
                      <div
                        key={t.id}
                        onClick={e => e.stopPropagation()}
                        className="px-2 py-0.5 rounded text-[10px] text-[var(--text-muted)] truncate"
                      >
                        Due: {t.title}
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
            <HairlineCard padding="lg" className="text-center">
              <p className="text-sm text-[var(--text-muted)]">No scheduled meetings match the current filter.</p>
            </HairlineCard>
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
                  className="editorial-surface p-4 sm:p-5 hover:border-[var(--border-strong)] transition-colors cursor-pointer flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
                      <span className={`w-2 h-2 rounded-full ${catMeta.dotColor}`} />
                      <span className="font-semibold text-[var(--text-primary)]">{catMeta.label}</span>
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

                    <h3 className="text-base font-bold text-[var(--text-primary)]">{ev.title}</h3>

                    {ev.description && (
                      <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{ev.description}</p>
                    )}

                    <div className="flex items-center gap-3 pt-1 text-xs text-[var(--text-muted)]">
                      <div className="flex -space-x-1.5">
                        {ev.attendees.slice(0, 6).map(att => (
                          <div key={att.userId} className="ring-2 ring-[var(--bg-surface)] rounded-full">
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

                  <div
                    className="flex flex-wrap items-center gap-2 shrink-0"
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
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                            active
                              ? opt.id === 'going'
                                ? 'bg-[var(--accent-lime)] text-[var(--accent-ink)] border-[var(--border-strong)]'
                                : opt.id === 'maybe'
                                ? 'bg-amber-500 text-[#131511] border-amber-400'
                                : 'bg-rose-600 text-white border-rose-500'
                              : 'bg-[var(--bg-surface-subtle)] border-[var(--border-hairline)] text-[var(--text-secondary)] hover:bg-[var(--bg-sage)]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}

                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => handleLaunchCallFromEvent(ev, true)}
                    >
                      <ICON_MAP.VideoCameraIcon className="w-3.5 h-3.5 mr-1.5" />
                      <span>Join Video</span>
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 4C. SPRINT & PROJECT PREP STUDIO VIEW */}
      {viewMode === 'sprint_prep' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              Upcoming Sprint Ceremonies & Project Reviews
            </h3>
            {events.map(ev => (
              <HairlineCard key={ev.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold text-[var(--text-muted)]">
                      {CATEGORY_METADATA[ev.category]?.label} · Room {ev.meetingCode}
                    </div>
                    <h4 className="text-base font-bold text-[var(--text-primary)] mt-0.5">
                      {ev.title}
                    </h4>
                  </div>
                  <Button
                    type="button"
                    variant="lime"
                    size="sm"
                    onClick={() => handleLaunchCallFromEvent(ev, true)}
                  >
                    <ICON_MAP.VideoCameraIcon className="w-3.5 h-3.5 mr-1.5" />
                    <span>Launch Video Prep</span>
                  </Button>
                </div>

                {ev.prepNotes && (
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{ev.prepNotes}</p>
                )}

                <div className="space-y-1.5 pt-2 border-t border-[var(--border-hairline)]">
                  <div className="text-xs font-semibold text-[var(--text-secondary)]">
                    Prepared Agenda ({ev.agenda.filter(a => a.completed).length}/{ev.agenda.length} completed)
                  </div>
                  {ev.agenda.map(ag => (
                    <label
                      key={ag.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-hairline)] text-xs cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={ag.completed}
                          onChange={() => meetingAndCallService.toggleAgendaItem(ev.id, ag.id)}
                        />
                        <span className={ag.completed ? 'line-through text-[var(--text-muted)]' : ''}>
                          {ag.title}
                        </span>
                      </div>
                      <span className="font-mono text-[var(--text-muted)]">{ag.durationMinutes}m</span>
                    </label>
                  ))}
                </div>
              </HairlineCard>
            ))}
          </div>

          <div className="lg:col-span-5 space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
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
                <HairlineCard key={tpl.cat} padding="sm" className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-[var(--text-primary)]">{tpl.title}</h4>
                    <p className="text-[11px] text-[var(--text-secondary)]">{tpl.desc}</p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => openScheduleModalWithDefaults({ category: tpl.cat })}
                    className="shrink-0"
                  >
                    Schedule
                  </Button>
                </HairlineCard>
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
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setSelectedEventId(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 animate-modal-appear"
          >
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-[var(--border-hairline)]">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-[#6F8254] dark:text-[var(--accent-lime)]">
                  {CATEGORY_METADATA[selectedEvent.category]?.label} · Room{' '}
                  <span className="font-mono">{selectedEvent.meetingCode}</span>
                </div>
                <h3 className="text-lg font-bold">{selectedEvent.title}</h3>
                <div className="text-xs text-[var(--text-secondary)]">
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
                <Button
                  type="button"
                  variant="lime"
                  size="sm"
                  onClick={() => {
                    const ev = selectedEvent;
                    setSelectedEventId(null);
                    handleLaunchCallFromEvent(ev, true);
                  }}
                >
                  <ICON_MAP.VideoCameraIcon className="w-4 h-4 mr-1.5" />
                  <span>Join Video Call</span>
                </Button>
                <button
                  type="button"
                  onClick={() => setSelectedEventId(null)}
                  className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Your RSVP Bar */}
            <div className="p-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold">Your RSVP Response</div>
                  <div className="text-[11px] text-[var(--text-secondary)]">
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
                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                          active
                            ? opt.id === 'going'
                              ? 'bg-[var(--accent-lime)] text-[var(--accent-ink)] border-[var(--border-strong)]'
                              : opt.id === 'maybe'
                              ? 'bg-amber-500 text-[#131511] border-amber-400'
                              : 'bg-rose-600 text-white border-rose-500'
                            : 'bg-[var(--bg-surface-subtle)] border-[var(--border-hairline)] text-[var(--text-secondary)] hover:bg-[var(--bg-sage)]'
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
                  className="flex-1 px-3 py-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] text-xs outline-none"
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
                    className="px-3.5 py-1.5 rounded-full bg-[var(--accent-lime)] hover:bg-[var(--accent-lime-hover)] text-[var(--accent-ink)] text-xs font-semibold cursor-pointer whitespace-nowrap"
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
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Invited Attendees ({selectedEvent.attendees.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => handleSimulateTeammateRsvps(selectedEvent)}
                    className="text-[11px] font-semibold text-[#4E6126] dark:text-[#CCF048] hover:underline cursor-pointer"
                  >
                    Simulate Teammate RSVPs
                  </button>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
                  {selectedEvent.attendees.map(att => (
                    <div
                      key={att.userId}
                      className="p-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] flex items-center justify-between gap-2"
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
                    className="w-full py-2 px-3 rounded-xl border border-dashed border-[var(--border-strong)] text-[#4E6126] dark:text-[#CCF048] text-xs font-semibold hover:bg-[var(--bg-sage)] transition-colors cursor-pointer"
                  >
                    + Invite All Remaining Organization Members
                  </button>
                )}
              </div>

              {/* Right: Meeting Prep Agenda & Notes */}
              <div className="md:col-span-6 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Meeting Prep & Agenda ({selectedEvent.agenda.length})
                </h4>

                <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin">
                  {selectedEvent.agenda.map(ag => (
                    <label
                      key={ag.id}
                      className="p-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] flex items-center justify-between gap-2 text-xs cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={ag.completed}
                          onChange={() =>
                            meetingAndCallService.toggleAgendaItem(selectedEvent.id, ag.id)
                          }
                        />
                        <span className={`truncate ${ag.completed ? 'line-through text-[var(--text-muted)]' : ''}`}>
                          {ag.title}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-[var(--text-muted)] flex-shrink-0">
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
                    className="flex-1 px-3 py-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-xs outline-none"
                  />
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={newAgendaDuration}
                    onChange={e => setNewAgendaDuration(Number(e.target.value))}
                    className="w-16 px-2 py-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-xs font-mono"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-full bg-[var(--accent-lime)] hover:bg-[var(--accent-lime-hover)] text-[var(--accent-ink)] text-xs font-semibold cursor-pointer whitespace-nowrap"
                  >
                    + Add
                  </button>
                </form>

                {/* Shared Prep Notes */}
                <div className="pt-2">
                  <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">
                    Sprint / Project Prep Notes
                  </label>
                  <textarea
                    rows={3}
                    value={selectedEvent.prepNotes || ''}
                    onChange={e =>
                      meetingAndCallService.updateEventPrepNotes(selectedEvent.id, e.target.value)
                    }
                    placeholder="Pre-read context, sprint links, or questions for attendees..."
                    className="w-full p-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-xs outline-none resize-none"
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
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setIsScheduleModalOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 animate-modal-appear"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-hairline)]">
              <div>
                <h3 className="text-base font-bold">Schedule Team Meeting & Sprint Prep</h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Every invited attendee receives a Calendar & Teams Chat invite with live RSVP
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMeetingSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-[var(--text-secondary)]">Meeting Type</label>
                  <select
                    value={formCategory}
                    onChange={e => {
                      const nextCat = e.target.value as CalendarEventCategory;
                      setFormCategory(nextCat);
                      handleAutoPopulatePrepTemplate(nextCat, formProjectId, formSprintId);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)]"
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
                  <label className="block font-semibold mb-1 text-[var(--text-secondary)]">
                    Link Project / Sprint Context
                  </label>
                  <select
                    value={formProjectId}
                    onChange={e => {
                      setFormProjectId(e.target.value);
                      handleAutoPopulatePrepTemplate(formCategory, e.target.value, formSprintId);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)]"
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
                <label className="block font-semibold mb-1 text-[var(--text-secondary)]">Meeting Title</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="e.g. Sprint 5 Planning & Velocity Alignment"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-[var(--text-secondary)]">Date</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-[var(--text-secondary)]">Start Time</label>
                  <input
                    type="time"
                    required
                    value={formStartTime}
                    onChange={e => setFormStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-[var(--text-secondary)]">End Time</label>
                  <input
                    type="time"
                    required
                    value={formEndTime}
                    onChange={e => setFormEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] font-mono"
                  />
                </div>
              </div>

              {/* Invite Attendees with RSVP */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-[var(--text-secondary)]">
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
                    className="text-[11px] font-semibold text-[#4E6126] dark:text-[#CCF048] hover:underline cursor-pointer"
                  >
                    {formSelectedUserIds.length === orgTeammates.length
                      ? 'Clear Selection'
                      : 'Invite Entire Organization'}
                  </button>
                </div>

                <div className="max-h-36 overflow-y-auto p-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] space-y-1 scrollbar-thin">
                  {orgTeammates.map(u => {
                    const checked = formSelectedUserIds.includes(u.id);
                    return (
                      <label
                        key={u.id}
                        className="flex items-center justify-between p-1.5 rounded-lg hover:bg-[var(--bg-sage)] cursor-pointer"
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
                        <span className="text-[10px] text-[var(--text-muted)]">
                          {normalizeUserRole(u.role).replace(/_/g, ' ')}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Prep Notes */}
              <div>
                <label className="block font-semibold mb-1 text-[var(--text-secondary)]">
                  Meeting Prep Notes & Pre-Read Agenda
                </label>
                <textarea
                  rows={2}
                  value={formPrepNotes}
                  onChange={e => setFormPrepNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-hairline)]">
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
