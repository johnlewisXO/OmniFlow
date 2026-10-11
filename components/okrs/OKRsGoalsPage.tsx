import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { OKRObjective, OKRKeyResult, TaskStatus } from '../../types';
import { ICON_MAP } from '../../constants';
import { Button } from '../shared/Button';
import soundService from '../../services/soundService';

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
    description: 'Increase sprint completion velocity, eliminate review bottlenecks, and automate repetitive triage workflows.',
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
    description: 'Ensure zero-friction flows across desktop, tablet 2x2 grids, and mobile viewports with personalized workspace themes.',
    keyResults: [
      {
        id: 'kr-ux-1',
        title: 'Ship 6 persisted workspace color accents for Dark & Light modes',
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
  const { darkMode, projects, tasks, currentUser, addToast, setActiveProject, setActiveView } = useAppStore();

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
  const [newKrTarget, setNewKrTarget] = useState(100);
  const [linkedProjectId, setLinkedProjectId] = useState<string>('');

  const saveObjectives = (updated: OKRObjective[]) => {
    setObjectives(updated);
    try {
      localStorage.setItem(OKRS_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  };

  // Live workspace metrics for automatic rollup calculation
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
          targetValue: newKrTarget || 100,
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
    <div className="flex-1 flex flex-col p-4 sm:p-6 space-y-5 max-w-[1600px] mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent mb-1">
            <ICON_MAP.FlagIcon className="w-4 h-4" />
            <span>Strategic Alignment & Milestone Rollups</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            OKRs, Company Goals & Initiative Rollups
          </h1>
          <p className={`text-xs sm:text-sm mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Track company-wide Objectives & Key Results with real-time progress rolled up from active projects and sprints.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterQuarter}
            onChange={e => setFilterQuarter(e.target.value)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold outline-none ${
              darkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            <option value="all">All Quarters</option>
            <option value="Q4 2026">Q4 2026</option>
            <option value="Q1 2027">Q1 2027</option>
          </select>
          <Button variant="primary" size="sm" onClick={() => setIsCreatingOkr(prev => !prev)}>
            <ICON_MAP.PlusIcon className="w-4 h-4 mr-1.5" />
            New Objective
          </Button>
        </div>
      </div>

      {/* Top 4 Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200/80'}`}>
          <span className="text-xs text-slate-400 font-medium">Overall OKR Attainment</span>
          <div className="text-2xl font-bold font-mono tabular-nums text-accent mt-1">{overallOkrProgress}%</div>
          <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mt-2">
            <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${overallOkrProgress}%` }} />
          </div>
        </div>
        <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200/80'}`}>
          <span className="text-xs text-slate-400 font-medium">Active Objectives</span>
          <div className="text-2xl font-bold font-mono tabular-nums mt-1">{filteredObjectives.length}</div>
          <span className="text-[11px] text-emerald-500 font-medium">All initiatives synced</span>
        </div>
        <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200/80'}`}>
          <span className="text-xs text-slate-400 font-medium">Workspace Task Velocity</span>
          <div className="text-2xl font-bold font-mono tabular-nums mt-1">
            {liveWorkspaceRollup.doneTasks}/{liveWorkspaceRollup.totalTasks}
          </div>
          <span className="text-[11px] text-slate-400">Completed tasks rolling up</span>
        </div>
        <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200/80'}`}>
          <span className="text-xs text-slate-400 font-medium">LinkedProjects</span>
          <div className="text-2xl font-bold font-mono tabular-nums mt-1">{projects.length}</div>
          <span className="text-[11px] text-slate-400">Live sprint boards feeding KRs</span>
        </div>
      </div>

      {/* Create Objective Drawer Form */}
      {isCreatingOkr && (
        <form
          onSubmit={handleCreateObjective}
          className={`p-5 rounded-[28px] border space-y-4 animate-fadeIn ${
            darkMode ? 'bg-slate-900/80 border-slate-700' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">Create Strategic Objective & Key Result</h3>
            <button type="button" onClick={() => setIsCreatingOkr(false)} className="text-xs text-slate-400 hover:text-slate-200">
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
              className={`md:col-span-2 px-3.5 py-2 rounded-xl border text-xs outline-none ${
                darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
              }`}
            />
            <div className="flex gap-2">
              <select
                value={newDepartment}
                onChange={e => setNewDepartment(e.target.value)}
                className={`flex-1 px-3 py-2 rounded-xl border text-xs outline-none ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-800'
                }`}
              >
                <option value="Engineering">Engineering</option>
                <option value="Product & Design">Product & Design</option>
                <option value="Operations">Operations</option>
                <option value="Growth">Growth</option>
              </select>
              <select
                value={newQuarter}
                onChange={e => setNewQuarter(e.target.value)}
                className={`px-3 py-2 rounded-xl border text-xs outline-none ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-800'
                }`}
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
              placeholder="Primary Key Result (e.g., Ship 100% of Sprint 4 Tasks)"
              className={`px-3.5 py-2 rounded-xl border text-xs outline-none ${
                darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
              }`}
            />
            <select
              value={linkedProjectId}
              onChange={e => setLinkedProjectId(e.target.value)}
              className={`px-3 py-2 rounded-xl border text-xs outline-none ${
                darkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-800'
              }`}
            >
              <option value="">Link to Project for Auto-Rollup (Optional)</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  Auto-Rollup Project: {p.name}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <Button type="submit" variant="primary" size="sm">
                Save Objective
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* Objectives List */}
      <div className="space-y-4">
        {filteredObjectives.map(obj => {
          const krScores = obj.keyResults.map(kr => computeKrProgress(kr).pct);
          const objProgress =
            krScores.length > 0 ? Math.round(krScores.reduce((a, b) => a + b, 0) / krScores.length) : 0;

          return (
            <div
              key={obj.id}
              className={`rounded-[28px] border p-5 sm:p-6 space-y-4 ${
                darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200/80'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="font-semibold text-accent">{obj.quarter}</span>
                    <span>·</span>
                    <span>{obj.department}</span>
                    <span>·</span>
                    <span>Lead: {obj.ownerName}</span>
                    <span>·</span>
                    <span className="text-emerald-500 font-semibold">
                      {objProgress >= 70 ? 'On Track' : objProgress >= 40 ? 'In Progress' : 'Needs Focus'}
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-bold">{obj.title}</h2>
                  <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{obj.description}</p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block">Objective Progress</span>
                    <span className="text-xl font-bold font-mono tabular-nums text-accent">{objProgress}%</span>
                  </div>
                </div>
              </div>

              {/* Key Results Rollup Rows */}
              <div className="space-y-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                {obj.keyResults.map(kr => {
                  const { current, pct } = computeKrProgress(kr);
                  const linkedProj = kr.linkedProjectId
                    ? projects.find(p => p.id === kr.linkedProjectId)
                    : undefined;

                  return (
                    <div
                      key={kr.id}
                      className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        darkMode ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50/70 border-slate-200/70'
                      }`}
                    >
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs sm:text-sm font-semibold">{kr.title}</span>
                          {linkedProj && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveProject(linkedProj);
                                setActiveView('kanban');
                              }}
                              className="text-[11px] font-semibold text-accent hover:underline cursor-pointer"
                            >
                              · Linked to {linkedProj.name} →
                            </button>
                          )}
                        </div>
                        <div className="w-full max-w-md h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-mono tabular-nums font-bold">
                          {current} / {kr.targetValue} {kr.unit} ({pct}%)
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleIncrementKr(obj.id, kr.id, -5)}
                            className={`px-2 py-1 rounded-lg border text-xs font-bold cursor-pointer ${
                              darkMode ? 'border-slate-700 hover:bg-slate-700' : 'border-slate-200 hover:bg-slate-200'
                            }`}
                            title="Decrease progress"
                          >
                            -5
                          </button>
                          <button
                            type="button"
                            onClick={() => handleIncrementKr(obj.id, kr.id, 5)}
                            className={`px-2 py-1 rounded-lg border text-xs font-bold cursor-pointer ${
                              darkMode ? 'border-slate-700 hover:bg-slate-700' : 'border-slate-200 hover:bg-slate-200'
                            }`}
                            title="Increase progress"
                          >
                            +5
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
