import React, { useState } from 'react';
import { ICON_MAP } from '../../constants';
import { useAppStore } from '../../hooks/useAppStore';

type StudioTabId = 'kanban' | 'copilot' | 'video' | 'automations';

interface DemoTask {
  id: string;
  key: string;
  title: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'Critical' | 'High' | 'Medium';
  points: number;
  assignee: string;
}

const INITIAL_DEMO_TASKS: DemoTask[] = [
  {
    id: 't1',
    key: 'OMN-104',
    title: 'Zero-latency 48kHz Opus WebRTC audio pipeline',
    status: 'done',
    priority: 'Critical',
    points: 8,
    assignee: 'SC',
  },
  {
    id: 't2',
    key: 'OMN-108',
    title: 'Multi-tenant RBAC organization join approval gate',
    status: 'done',
    priority: 'High',
    points: 5,
    assignee: 'JL',
  },
  {
    id: 't3',
    key: 'OMN-112',
    title: 'Supabase Edge Function SLA breach escalation',
    status: 'in_progress',
    priority: 'Critical',
    points: 5,
    assignee: 'MR',
  },
  {
    id: 't4',
    key: 'OMN-115',
    title: 'Mobile bottom thumb-bar & slide-over task inspector',
    status: 'in_progress',
    priority: 'High',
    points: 5,
    assignee: 'EW',
  },
  {
    id: 't5',
    key: 'OMN-119',
    title: 'Executive portfolio PDF & CSV compliance digest',
    status: 'review',
    priority: 'Medium',
    points: 3,
    assignee: 'SC',
  },
  {
    id: 't6',
    key: 'OMN-121',
    title: '1080p/60fps screen-share native track optimization',
    status: 'todo',
    priority: 'High',
    points: 5,
    assignee: 'JL',
  },
];

export const HeroSection: React.FC = () => {
  const { currentUser } = useAppStore();
  const [activeTab, setActiveTab] = useState<StudioTabId>('kanban');
  const [demoTasks, setDemoTasks] = useState<DemoTask[]>(INITIAL_DEMO_TASKS);
  const [selectedPromptIdx, setSelectedPromptIdx] = useState(0);
  const [echoGuardActive, setEchoGuardActive] = useState(true);
  const [hdMode, setHdMode] = useState<'1080p' | '720p'>('1080p');
  const [activeRuleIds, setActiveRuleIds] = useState<Record<string, boolean>>({
    r1: true,
    r2: true,
    r3: true,
  });

  const cycleTaskStatus = (id: string) => {
    const order: DemoTask['status'][] = ['todo', 'in_progress', 'review', 'done'];
    setDemoTasks(prev =>
      prev.map(t => {
        if (t.id !== id) return t;
        const nextIdx = (order.indexOf(t.status) + 1) % order.length;
        return { ...t, status: order[nextIdx] };
      })
    );
  };

  const completedPoints = demoTasks
    .filter(t => t.status === 'done')
    .reduce((sum, t) => sum + t.points, 0);
  const totalPoints = demoTasks.reduce((sum, t) => sum + t.points, 0);
  const velocityPct = Math.round((completedPoints / Math.max(1, totalPoints)) * 100);

  const sampleBlueprints = [
    {
      prompt: 'Launch Q4 Enterprise Mobile App with Offline Sync & Biometric Auth',
      confidence: '94%',
      riskScore: '18 / 100 (Low)',
      sprints: '3 Sprints · 42 Story Pts',
      tasks: [
        { title: 'Passkey & WebAuthn enclave bridge', pts: 8, priority: 'Critical' },
        { title: 'IndexedDB optimistic mutation queue', pts: 5, priority: 'High' },
        { title: 'Bottom thumb-zone navigation shell', pts: 5, priority: 'High' },
      ],
    },
    {
      prompt: 'SOC2 Type II Automated Audit Trail & Multi-Role Access Hardening',
      confidence: '97%',
      riskScore: '12 / 100 (Low)',
      sprints: '2 Sprints · 29 Story Pts',
      tasks: [
        { title: 'Organization Owner & PM approval gate enforcement', pts: 5, priority: 'Critical' },
        { title: 'Immutable actor/target audit event ledger', pts: 8, priority: 'Critical' },
        { title: 'Scheduled Edge Function compliance digest export', pts: 3, priority: 'Medium' },
      ],
    },
  ];

  const studioTabs: { id: StudioTabId; number: string; label: string }[] = [
    { id: 'kanban', number: '01', label: 'Kanban & Sprint Velocity' },
    { id: 'copilot', number: '02', label: 'AI Co-Pilot & Blueprints' },
    { id: 'video', number: '03', label: '1080p HD Video & Chat' },
    { id: 'automations', number: '04', label: 'Edge Rules & SLA Engine' },
  ];

  return (
    <section
      id="product-studio"
      className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden bg-[#070A12]"
    >
      {/* Subtle Radial Obsidian Atmosphere */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.16) 0%, rgba(15, 23, 42, 0.06) 45%, transparent 75%)',
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Hero Proposition */}
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <p className="text-xs sm:text-sm font-medium tracking-widest uppercase text-indigo-400">
            Enterprise Project Intelligence · Real-Time 1080p Collaboration · Edge Compute
          </p>

          <h1
            className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.08]"
            style={{ textWrap: 'balance' } as React.CSSProperties}
          >
            Command Every Sprint, Standup, and Deliverable in One Glassmorphic Studio.
          </h1>

          <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto">
            Omni Flow unifies multi-tenant Kanban execution, autonomous AI project blueprints,
            lossless 48kHz Opus &amp; 1080p WebRTC video calls, and Supabase Edge Function
            automations—engineered for desktop precision and mobile thumb-zone speed.
          </p>

          {/* Primary & Secondary CTAs */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <a
              href="#/app"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-xl shadow-indigo-600/30 border border-indigo-400/30 transition-all whitespace-nowrap"
            >
              <span>{currentUser ? 'Enter Workspace Studio' : 'Start Free Workspace'}</span>
              <span aria-hidden="true">→</span>
            </a>
            <a
              href="#capabilities"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 text-sm font-medium border border-white/10 transition-all whitespace-nowrap"
            >
              <span>Explore Platform Architecture</span>
            </a>
          </div>

          <div className="pt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-slate-400">
            <span>Multi-Role RBAC &amp; Approval Gates</span>
            <span aria-hidden="true">·</span>
            <span>Lossless 48kHz Opus + 1080p60 WebRTC</span>
            <span aria-hidden="true">·</span>
            <span>Supabase Edge Function Compute</span>
          </div>
        </div>

        {/* Interactive Live Product Preview Studio */}
        <div className="mt-12 md:mt-16 rounded-2xl border border-white/10 bg-slate-900/65 backdrop-blur-2xl shadow-2xl shadow-black/70 overflow-hidden">
          {/* Studio Window Header & Interactive Tab Bar */}
          <div className="px-4 sm:px-6 py-3.5 border-b border-white/[0.08] bg-[#0B0F1C]/90 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
              </div>
              <span className="text-xs font-mono text-slate-400 truncate">
                omniflow.studio / interactive-preview
              </span>
            </div>

            {/* 4 Switchable Studio Preview Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 lg:pb-0">
              {studioTabs.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                    activeTab === tab.id
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                  }`}
                >
                  <span className="font-mono text-[11px] opacity-75">{tab.number}.</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Studio Stage Body */}
          <div className="p-4 sm:p-6 lg:p-8 bg-gradient-to-b from-[#0B101E]/90 to-[#070A12]/95 min-h-[420px]">
            {/* TAB 01: Interactive Kanban & Sprint Velocity */}
            {activeTab === 'kanban' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/[0.07]">
                  <div>
                    <div className="text-xs text-indigo-400 font-medium">
                      Interactive Preview · Click any task card below to advance its workflow stage
                    </div>
                    <h3 className="text-lg font-bold text-white mt-0.5">
                      Sprint 14 — Core Platform &amp; Edge Modernization
                    </h3>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
                    <div className="px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-slate-200">
                      Velocity: <strong className="text-emerald-400">{completedPoints}</strong> /{' '}
                      {totalPoints} pts ({velocityPct}%)
                    </div>
                    <div className="hidden sm:block w-28 h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${velocityPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {(
                    [
                      { id: 'todo', label: 'To Do' },
                      { id: 'in_progress', label: 'In Progress' },
                      { id: 'review', label: 'In Review' },
                      { id: 'done', label: 'Done' },
                    ] as const
                  ).map(lane => {
                    const laneTasks = demoTasks.filter(t => t.status === lane.id);
                    return (
                      <div
                        key={lane.id}
                        className="rounded-xl bg-white/[0.02] border border-white/[0.07] p-3.5 flex flex-col gap-2.5 min-h-[260px]"
                      >
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-300 pb-2 border-b border-white/[0.06]">
                          <span>{lane.label}</span>
                          <span className="font-mono tabular-nums text-slate-400">
                            {laneTasks.length}
                          </span>
                        </div>

                        {laneTasks.map(task => (
                          <button
                            key={task.id}
                            type="button"
                            onClick={() => cycleTaskStatus(task.id)}
                            className="w-full text-left p-3 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-white/[0.08] hover:border-indigo-500/40 transition-all group cursor-pointer space-y-2"
                          >
                            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono tabular-nums">
                              <span>
                                {task.key} · {task.priority}
                              </span>
                              <span className="text-indigo-400 font-semibold">
                                {task.points} pts
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-slate-100 group-hover:text-white leading-snug">
                              {task.title}
                            </p>
                            <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
                              <span>Click to advance stage →</span>
                              <span className="w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 flex items-center justify-center font-bold">
                                {task.assignee}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 02: Interactive AI Co-Pilot & Executive Scribe */}
            {activeTab === 'copilot' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-5 space-y-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                    Server-Side Gemini 3.8 Flash &amp; Pro Synthesis
                  </div>
                  <h3 className="text-xl font-bold text-white">
                    Natural Language Goal → Multi-Sprint Execution Blueprint
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Select an initiative below to preview how the AI Co-PilotEdge Function
                    synthesizes Fibonacci story points, release gates, and risk mitigations.
                  </p>

                  <div className="space-y-2.5 pt-1">
                    {sampleBlueprints.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedPromptIdx(idx)}
                        className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                          selectedPromptIdx === idx
                            ? 'bg-indigo-600/15 border-indigo-500/50 text-white'
                            : 'bg-white/[0.02] border-white/[0.08] text-slate-300 hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="text-[11px] font-mono text-indigo-400 mb-1">
                          Prompt Template 0{idx + 1}
                        </div>
                        <div className="text-xs sm:text-sm font-semibold leading-snug">
                          “{item.prompt}”
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-7 rounded-xl bg-white/[0.03] border border-white/10 p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/[0.08]">
                    <div>
                      <span className="text-xs font-mono text-emerald-400">
                        ● Synthesized via /api/edge/ai-copilot-synthesis
                      </span>
                      <h4 className="text-base font-bold text-white mt-0.5">
                        {sampleBlueprints[selectedPromptIdx].prompt}
                      </h4>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-slate-300">
                      Confidence: {sampleBlueprints[selectedPromptIdx].confidence} · Risk:{' '}
                      {sampleBlueprints[selectedPromptIdx].riskScore}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {sampleBlueprints[selectedPromptIdx].tasks.map((t, i) => (
                      <div
                        key={i}
                        className="p-3.5 rounded-xl bg-slate-900/90 border border-white/[0.07] flex items-center justify-between gap-4"
                      >
                        <div>
                          <div className="text-xs sm:text-sm font-semibold text-white">
                            {t.title}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Priority: {t.priority} · Auto-assigned by workload balancer
                          </div>
                        </div>
                        <span className="font-mono tabular-nums text-xs font-bold text-indigo-400 shrink-0">
                          {t.pts} pts
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 flex items-center justify-between text-xs text-slate-400">
                    <span>{sampleBlueprints[selectedPromptIdx].sprints}</span>
                    <a
                      href="#/app"
                      className="text-indigo-400 hover:text-indigo-300 font-semibold"
                    >
                      Deploy Blueprint in Workspace →
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 03: Teams Chat & 1080p HD Video Studio */}
            {activeTab === 'video' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                <div className="lg:col-span-7 grid grid-cols-2 gap-3.5">
                  {[
                    {
                      name: 'Sarah Chen',
                      role: 'Principal Architect · Host',
                      speaking: true,
                      stream: `${hdMode} 60fps · 48kHz Opus`,
                    },
                    {
                      name: 'Marcus Vance',
                      role: 'Product Lead · Screen Sharing',
                      speaking: false,
                      stream: `${hdMode} Native Track`,
                    },
                  ].map((peer, idx) => (
                    <div
                      key={idx}
                      className={`rounded-xl p-4 bg-slate-900/95 border ${
                        peer.speaking ? 'border-emerald-500/50' : 'border-white/10'
                      } flex flex-col justify-between h-52 relative overflow-hidden`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
                        <span>{peer.stream}</span>
                        {peer.speaking && (
                          <span className="inline-flex items-center gap-1.5 text-emerald-400">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                            Speaking
                          </span>
                        )}
                      </div>

                      <div className="my-auto flex items-center justify-center">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-400/30 flex items-center justify-center text-lg font-bold text-indigo-300">
                          {peer.name
                            .split(' ')
                            .map(n => n[0])
                            .join('')}
                        </div>
                      </div>

                      <div>
                        <div className="text-sm font-bold text-white">{peer.name}</div>
                        <div className="text-[11px] text-slate-400">{peer.role}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="lg:col-span-5 space-y-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                    Lossless Hardware AEC · Zero Echo Pipeline
                  </div>
                  <h3 className="text-xl font-bold text-white">
                    Studio-Grade 1080p Video &amp; Same-Room Echo Guard
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Direct hardware microphone routing preserves browser Acoustic Echo Cancellation
                    reference timing, paired with 4.2 Mbps 1080p video encoding and real-time in-call
                    chat &amp; AI meeting transcription.
                  </p>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setHdMode(prev => (prev === '1080p' ? '720p' : '1080p'))}
                      className="px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-mono text-white cursor-pointer"
                    >
                      Resolution: <strong>{hdMode} HD</strong> (Toggle)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEchoGuardActive(prev => !prev)}
                      className={`px-3.5 py-2 rounded-xl border text-xs font-mono cursor-pointer ${
                        echoGuardActive
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                          : 'bg-white/[0.04] border-white/10 text-slate-400'
                      }`}
                    >
                      Echo Guard: <strong>{echoGuardActive ? 'ACTIVE' : 'STANDARD'}</strong>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 04: Triggers, Rules & Edge Automations */}
            {activeTab === 'automations' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/[0.08]">
                  <div>
                    <div className="text-xs text-indigo-400 font-medium">
                      Deterministic Server-Side Evaluation · Click any rule to toggle state
                    </div>
                    <h3 className="text-lg font-bold text-white mt-0.5">
                      Automated Workflow Triggers &amp; SLA Escalation Engine
                    </h3>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-emerald-400">
                    Edge Runtime: Nominal (14ms avg)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    {
                      id: 'r1',
                      trigger: 'WHEN Task Due Date < Now',
                      condition: 'IF Status != Done',
                      action: 'Escalate Priority → Critical & Notify PM',
                      runs: '142 executions',
                    },
                    {
                      id: 'r2',
                      trigger: 'WHEN Org Join Request Submitted',
                      condition: 'IF Target Org = Active',
                      action: 'Dispatch Brevo Edge Email + Inbox Approval Card',
                      runs: '38 executions',
                    },
                    {
                      id: 'r3',
                      trigger: 'WHEN Sprint Scope Creeps > 20%',
                      condition: 'IF Active Story Points > Capacity',
                      action: 'Trigger AI Co-Pilot Workload Rebalancer',
                      runs: '19 executions',
                    },
                  ].map(rule => {
                    const enabled = activeRuleIds[rule.id];
                    return (
                      <div
                        key={rule.id}
                        onClick={() =>
                          setActiveRuleIds(prev => ({ ...prev, [rule.id]: !prev[rule.id] }))
                        }
                        className={`p-4 rounded-xl border transition-all cursor-pointer space-y-3 ${
                          enabled
                            ? 'bg-slate-900/90 border-indigo-500/40'
                            : 'bg-slate-900/40 border-white/[0.06] opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono text-indigo-400">{rule.runs}</span>
                          <span
                            className={`font-mono text-[11px] font-bold ${
                              enabled ? 'text-emerald-400' : 'text-slate-500'
                            }`}
                          >
                            {enabled ? '● ENABLED' : '○ PAUSED'}
                          </span>
                        </div>
                        <div className="space-y-1.5 text-xs">
                          <div className="font-semibold text-white">{rule.trigger}</div>
                          <div className="text-slate-400">{rule.condition}</div>
                          <div className="text-indigo-300 font-medium">→ {rule.action}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
