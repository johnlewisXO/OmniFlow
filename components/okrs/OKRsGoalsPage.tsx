import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { OKRObjective, OKRKeyResult, TaskStatus } from '../../types';
import { ICON_MAP } from '../../constants';
import { Button } from '../shared/Button';
import soundService from '../../services/soundService';
import {
  PageHeader,
  InlineKpiStrip,
  HairlineCard,
  StatusDot,
} from '../shared/EditorialUI';
import { RadialProgressRing, SlimProgressBar } from '../charts/EditorialCharts';

const OKRS_STORAGE_KEY = 'omni_flow_okrs_goals_v1';

const DEFAULT_OKRS: OKRObjective[] = [
  {
    id: 'okr-q4-velocity',
    title: 'Accelerate Engineering Delivery & Sprint Predictability',
    quarter: 'Q4 2026',
    ownerId: 'system',
    ownerName: 'Engineering & Product Leadership',
    department: 'Engineering',
    status: 'on_track',
    description:
      'Increase sprint completion velocity, eliminate review bottlenecks, and automate repetitive triage workflows.',
    keyResults: [
      {
        id: 'kr-1',
        title: 'Achieve 85%+ Sprint Task Completion Rate across active projects',
        targetValue: 85,
        currentValue: 68,
        unit: '%',
        autoRollupFromProject: true,
      },
      {
        id: 'kr-2',
        title: 'Deliver 120+ Story Points across Q4 product milestones',
        targetValue: 120,
        currentValue: 74,
        unit: 'pts',
        autoRollupFromProject: true,
      },
      {
        id: 'kr-3',
        title: 'Reduce In-Review QA turnaround time to under 180 minutes',
        targetValue: 100,
        currentValue: 82,
        unit: '%',
      },
    ],
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'okr-q4-ux',
    title: 'Deliver Best-in-Class Multi-Device Workspace Experience',
    quarter: 'Q4 2026',
    ownerId: 'system',
    ownerName: 'Design Systems & Frontend Guild',
    department: 'Product & Design',
    status: 'on_track',
    description:
      'Ensure zero-friction flows across desktop, tablet, and mobile viewports with calm editorial clarity.',
    keyResults: [
      {
        id: 'kr-ux-1',
        title: 'Ship unified Editorial Stone & Sage system across all workspace modules',
        targetValue: 6,
        currentValue: 6,
        unit: 'tasks',
      },
      {
        id: 'kr-ux-2',
        title: 'Resolve 100% of high-priority customer triage escalations within SLA',
        targetValue: 100,
        currentValue: 90,
        unit: '%',
      },
    ],
    updatedAt: new Date().toISOString(),
  },
];

export const OKRsGoalsPage: React.FC = () => {
  const { projects, tasks, currentUser, addToast, setActiveProject, setActiveView } = useAppStore();

  const [objectives, setObjectives] = useState<OKRObjective[]>(() => {
    try {
      const raw = localStorage.getItem(OKRS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_OKRS;
  });

  const [filterQuarter, setFilterQuarter] = useState<string>('all');
  const [isCreatingOkr, setIsCreatingOkr] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDepartment, setNewDepartment] = useState('Engineering');
  const [newQuarter, setNewQuarter] = useState('Q4 2026');
  const [newDescription, setNewDescription] = useState('');
  const [newKrTitle, setNewKrTitle] = useState('');
  const [linkedProjectId, setLinkedProjectId] = useState<string>('');

  const saveObjectives = (updated: OKRObjective[]) => {
    setObjectives(updated);
    try {
      localStorage.setItem(OKRS_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  };

  const liveWorkspaceRollup = useMemo(() => {
    const totalTasks = tasks.length;
    const doneTasks = tasks.filter(t => t.status === TaskStatus.DONE).length;
    const completionPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
    const completedStoryPoints = tasks
      .filter(t => t.status === TaskStatus.DONE)
      .reduce((acc, t) => acc + (t.story_points || 2), 0);
    return { totalTasks, doneTasks, completionPct, completedStoryPoints };
  }, [tasks]);

  const computeKrProgress = (kr: OKRKeyResult): { current: number; pct: number } => {
    if (kr.linkedProjectId) {
      const projTasks = tasks.filter(t => t.projectId === kr.linkedProjectId);
      if (projTasks.length > 0) {
        const doneCount = projTasks.filter(t => t.status === TaskStatus.DONE).length;
        const pct = Math.min(100, Math.round((doneCount / projTasks.length) * 100));
        return { current: pct, pct };
      }
    }
    if (kr.autoRollupFromProject && tasks.length > 0) {
      if (kr.unit === '%') {
        const val = Math.max(kr.currentValue, liveWorkspaceRollup.completionPct);
        return { current: val, pct: Math.min(100, Math.round((val / Math.max(1, kr.targetValue)) * 100)) };
      }
      if (kr.unit === 'pts') {
        const val = kr.currentValue + liveWorkspaceRollup.completedStoryPoints;
        return { current: val, pct: Math.min(100, Math.round((val / Math.max(1, kr.targetValue)) * 100)) };
      }
    }
    const pct = Math.min(100, Math.round((kr.currentValue / Math.max(1, kr.targetValue)) * 100));
    return { current: kr.currentValue, pct };
  };

  const handleCreateObjective = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const created: OKRObjective = {
      id: `okr-${Date.now()}`,
      title: newTitle.trim(),
      quarter: newQuarter,
      ownerId: currentUser?.id || 'system',
      ownerName: currentUser?.full_name || currentUser?.email || 'Objective Lead',
      department: newDepartment,
      status: 'on_track',
      description: newDescription.trim() || 'Strategic objective linked to workspace execution milestones.',
      keyResults: [
        {
          id: `kr-${Date.now()}`,
          title: newKrTitle.trim() || 'Deliver 100% of linked project sprint deliverables',
          targetValue: 100,
          currentValue: 25,
          unit: '%',
          linkedProjectId: linkedProjectId || undefined,
          autoRollupFromProject: Boolean(linkedProjectId),
        },
      ],
      updatedAt: new Date().toISOString(),
    };
    saveObjectives([created, ...objectives]);
    setNewTitle('');
    setNewDescription('');
    setNewKrTitle('');
    setIsCreatingOkr(false);
    soundService.play('task_create');
    addToast('Objective Created', `Added "${created.title}" to ${created.quarter} OKRs.`, 'success');
  };

  const handleIncrementKr = (objId: string, krId: string, delta: number) => {
    const next = objectives.map(obj => {
      if (obj.id !== objId) return obj;
      const updatedKrs = obj.keyResults.map(kr => {
        if (kr.id !== krId) return kr;
        const nextVal = Math.max(0, Math.min(kr.targetValue, kr.currentValue + delta));
        return { ...kr, currentValue: nextVal };
      });
      return { ...obj, keyResults: updatedKrs, updatedAt: new Date().toISOString() };
    });
    saveObjectives(next);
    soundService.play('state_updated');
  };

  const filteredObjectives = useMemo(() => {
    return objectives.filter(o => (filterQuarter === 'all' ? true : o.quarter === filterQuarter));
  }, [objectives, filterQuarter]);

  const overallOkrProgress = useMemo(() => {
    if (filteredObjectives.length === 0) return 0;
    let sum = 0;
    let count = 0;
    filteredObjectives.forEach(obj => {
      obj.keyResults.forEach(kr => {
        sum += computeKrProgress(kr).pct;
        count += 1;
      });
    });
    return count > 0 ? Math.round(sum / count) : 0;
  }, [filteredObjectives, tasks]);

  return (
    <div className="p-4 sm:p-6 max-w-[1440px] mx-auto space-y-5">
      <PageHeader
        eyebrow="Strategic Alignment"
        title="OKRs & Company Goals"
        subtitle="Track quarterly Objectives & Key Results with automatic progress rollups from active projects."
        actions={
          <>
            <select
              value={filterQuarter}
              onChange={e => setFilterQuarter(e.target.value)}
              className="px-3 py-1.5 rounded-full border text-xs font-medium cursor-pointer"
            >
              <option value="all">All Quarters</option>
              <option value="Q4 2026">Q4 2026</option>
              <option value="Q1 2027">Q1 2027</option>
            </select>
            <Button variant="primary" size="sm" onClick={() => setIsCreatingOkr(prev => !prev)}>
              <ICON_MAP.PlusIcon className="w-3.5 h-3.5" />
              New Objective
            </Button>
          </>
        }
      />

      <InlineKpiStrip
        items={[
          {
            id: 'attainment',
            label: 'Overall OKR Attainment',
            value: `${overallOkrProgress}%`,
            sublabel: 'Weighted KR average',
            visual: (
              <RadialProgressRing
                value={overallOkrProgress}
                size={36}
                strokeWidth={4}
                tone="lime"
                showLabel={false}
              />
            ),
          },
          {
            id: 'objectives',
            label: 'Active Objectives',
            value: filteredObjectives.length,
            sublabel: 'Initiatives synced',
            tone: 'success',
          },
          {
            id: 'velocity',
            label: 'Task Velocity Rollup',
            value: `${liveWorkspaceRollup.doneTasks}/${liveWorkspaceRollup.totalTasks}`,
            sublabel: `${liveWorkspaceRollup.completedStoryPoints} pts shipped`,
            tone: 'default',
          },
          {
            id: 'projects',
            label: 'Linked Projects',
            value: projects.length,
            sublabel: 'Feeding live KRs',
            tone: 'lime',
          },
        ]}
      />

      {isCreatingOkr && (
        <HairlineCard padding="lg" className="animate-fadeIn">
          <form onSubmit={handleCreateObjective} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                Create Strategic Objective & Key Result
              </h3>
              <button
                type="button"
                onClick={() => setIsCreatingOkr(false)}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                Cancel
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                required
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="Objective title (e.g., Scale Enterprise Reliability in Q4)"
                className="md:col-span-2 px-3.5 py-2 rounded-xl border text-xs"
              />
              <div className="flex gap-2">
                <select
                  value={newDepartment}
                  onChange={e => setNewDepartment(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border text-xs"
                >
                  <option value="Engineering">Engineering</option>
                  <option value="Product & Design">Product & Design</option>
                  <option value="Operations">Operations</option>
                  <option value="Growth">Growth</option>
                </select>
                <select
                  value={newQuarter}
                  onChange={e => setNewQuarter(e.target.value)}
                  className="px-3 py-2 rounded-xl border text-xs"
                >
                  <option value="Q4 2026">Q4 2026</option>
                  <option value="Q1 2027">Q1 2027</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                value={newKrTitle}
                onChange={e => setNewKrTitle(e.target.value)}
                placeholder="Primary Key Result..."
                className="px-3.5 py-2 rounded-xl border text-xs"
              />
              <select
                value={linkedProjectId}
                onChange={e => setLinkedProjectId(e.target.value)}
                className="px-3 py-2 rounded-xl border text-xs"
              >
                <option value="">Link to Project for Auto-Rollup (Optional)</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    Auto-Rollup: {p.name}
                  </option>
                ))}
              </select>
              <div className="flex justify-end">
                <Button type="submit" variant="primary" size="sm">
                  Save Objective
                </Button>
              </div>
            </div>
          </form>
        </HairlineCard>
      )}

      {/* Objectives List */}
      <div className="space-y-4">
        {filteredObjectives.map(obj => {
          const krScores = obj.keyResults.map(kr => computeKrProgress(kr).pct);
          const objProgress =
            krScores.length > 0 ? Math.round(krScores.reduce((a, b) => a + b, 0) / krScores.length) : 0;
          const statusTone = objProgress >= 70 ? 'success' : objProgress >= 40 ? 'warning' : 'danger';
          const statusText = objProgress >= 70 ? 'On Track' : objProgress >= 40 ? 'In Progress' : 'Needs Focus';

          return (
            <HairlineCard key={obj.id} padding="lg" className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] flex-wrap">
                    <span className="font-mono font-semibold text-[var(--text-primary)]">{obj.quarter}</span>
                    <span>·</span>
                    <span>{obj.department}</span>
                    <span>·</span>
                    <span>Lead: {obj.ownerName}</span>
                    <span>·</span>
                    <StatusDot tone={statusTone} label={statusText} />
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">{obj.title}</h2>
                  <p className="text-xs text-[var(--text-secondary)]">{obj.description}</p>
                </div>

                <RadialProgressRing
                  value={objProgress}
                  size={56}
                  strokeWidth={5}
                  tone={objProgress >= 70 ? 'success' : 'charcoal'}
                />
              </div>

              <div className="divide-y divide-[var(--border-hairline)] border border-[var(--border-hairline)] rounded-xl overflow-hidden">
                {obj.keyResults.map(kr => {
                  const { current, pct } = computeKrProgress(kr);
                  const linkedProj = kr.linkedProjectId
                    ? projects.find(p => p.id === kr.linkedProjectId)
                    : undefined;

                  return (
                    <div
                      key={kr.id}
                      className="p-3.5 bg-[var(--bg-surface-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs sm:text-[13px] font-semibold text-[var(--text-primary)]">
                            {kr.title}
                          </span>
                          {linkedProj && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveProject(linkedProj);
                                setActiveView('kanban');
                              }}
                              className="text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline cursor-pointer"
                            >
                              · {linkedProj.name} →
                            </button>
                          )}
                        </div>
                        <div className="max-w-md">
                          <SlimProgressBar value={pct} tone={pct >= 75 ? 'sage' : 'charcoal'} />
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-mono tabular-nums font-semibold text-[var(--text-primary)]">
                          {current}/{kr.targetValue} {kr.unit} ({pct}%)
                        </span>
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="sm" onClick={() => handleIncrementKr(obj.id, kr.id, -5)}>
                            -5
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleIncrementKr(obj.id, kr.id, 5)}>
                            +5
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </HairlineCard>
          );
        })}
      </div>
    </div>
  );
};
