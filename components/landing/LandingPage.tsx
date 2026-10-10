import React, { useState } from 'react';
import { LandingHeader } from './LandingHeader';
import { HeroSection } from './HeroSection';
import { LandingFooter } from './LandingFooter';
import { ICON_MAP } from '../../constants';

const IMPACT_METRICS = [
  {
    metric: '42%',
    unit: 'Faster Sprint Cycle Time in 90 Days',
    detail:
      'Measured across engineering organizations using AI Co-Pilot story-point estimation and automated WIP bottleneck alerts.',
    attribution: 'Regal Logistics · 38 Contributors',
  },
  {
    metric: '100%',
    unit: 'Multi-Role RBAC & Audit Traceability',
    detail:
      'Every organization join approval, role mutation, and task state transition is cryptographically logged with actor and timestamp.',
    attribution: 'Innovatech Enterprise · SOC2 Workflow',
  },
  {
    metric: '<35ms',
    unit: '1080p60 WebRTC & 48kHz Opus Latency',
    detail:
      'Hardware-level Acoustic Echo Cancellation with direct media track routing eliminates call screeching and context switching.',
    attribution: 'Distributed Product Teams · Global Mesh',
  },
];

const EDGE_FUNCTIONS_SHOWCASE = [
  {
    number: '01',
    fnName: 'ai-copilot-synthesis',
    title: 'AI Co-Pilot & Executive Report Synthesis',
    description:
      'Offloads multi-sprint roadmap generation, Fibonacci effort estimation, and portfolio risk radar to server-side Gemini 3.8 Flash & 3.1 Pro endpoints—keeping API keys off the client and browser frames at 60fps.',
    specs: 'Structured JSON Schema · <420ms TTFB · Zero Client Key Exposure',
  },
  {
    number: '02',
    fnName: 'transactional-notifications',
    title: 'Transactional Emails, Org Invites & Approval Webhooks',
    description:
      'Dispatches Brevo/SMTP organization invites and join-request approval notifications from the Edge with automatic tokenized invite link fallbacks so user onboarding never fails on SMTP rate limits.',
    specs: 'Brevo SMTP Relay · Tokenized Link Fallback · Instant Realtime Push',
  },
  {
    number: '03',
    fnName: 'automation-rule-engine',
    title: 'Scheduled SLA Breach Alerts & Audit Digests',
    description:
      'Evaluates organization-wide Trigger → Condition → Action rules deterministically on the server, escalating overdue deliverables and compiling weekly compliance audit digests.',
    specs: 'Cron & Webhook Compatible · Deterministic SLA Evaluation · CSV/PDF Ready',
  },
  {
    number: '04',
    fnName: 'webrtc-turn-and-scribe',
    title: 'Live WebRTC TURN/ICE Provisioning & Meeting Scribe',
    description:
      'Issues ephemeral STUN/TURN ICE credentials for 1080p/60fps video and screen-sharing across symmetric corporate NATs and extracts structured action items from call transcripts.',
    specs: '48kHz Opus Stereo · 1080p/720p Adaptive Bitrate · Action Item Extraction',
  },
];

const PRICING_PLANS = [
  {
    audience: 'For Early-Stage Teams',
    name: 'Starter Workspace',
    monthlyPrice: '$0',
    annualPrice: '$0',
    period: 'Forever Free · Up to 5 Members',
    description:
      'Complete core Kanban boards, personal task command center, and real-time team chat for fast-moving startup squads.',
    features: [
      'Up to 3 active projects & unlimited tasks',
      'Kanban, List, and Sprint Backlog views',
      'AI Task Title & Subtask Breakdown assistant',
      'Teams Chat & 720p HD Video Standups',
      'Mobile thumb-bar navigation & dark mode',
    ],
    ctaText: 'Start Free Workspace',
    ctaHref: '#/app',
    highlighted: false,
  },
  {
    audience: 'For Scaling Engineering Orgs',
    name: 'Pro Studio',
    monthlyPrice: '$12',
    annualPrice: '$9',
    period: 'per user / month',
    description:
      'Full autonomous AI Project Manager Studio, 1080p60 WebRTC video + screen share, and automated workflow triggers.',
    features: [
      'Unlimited projects, sprints & velocity burndown',
      'AI Initiative Blueprint Architect & Risk Radar',
      '1080p/60fps Video Studio + 48kHz Opus Echo Guard',
      'Automated Triggers, SLA escalations & WIP limits',
      'Owner & Project Manager Org Join Approval gate',
    ],
    ctaText: 'Launch Pro Studio',
    ctaHref: '#/app',
    highlighted: true,
  },
  {
    audience: 'For Enterprise Operations',
    name: 'Enterprise Cloud',
    monthlyPrice: 'Custom',
    annualPrice: 'Custom',
    period: 'Dedicated SLA & Custom Terms',
    description:
      'Dedicated Supabase Edge Function throughput, full compliance audit log exports, and custom RBAC governance.',
    features: [
      'Everything in Pro Studio + unlimited seats',
      'Dedicated Supabase Edge Function compute & webhooks',
      'Full immutable Audit Log ledger & CSV/PDF digests',
      'Custom TURN/ICE enterprise relay & SSO readiness',
      'Priority architectural onboarding & 99.95% SLA',
    ],
    ctaText: 'Request Enterprise Briefing',
    ctaHref: '#enterprise-contact',
    highlighted: false,
  },
];

const FAQ_ITEMS = [
  {
    q: 'How does the Organization Join Approval flow work for new members?',
    a: 'When a user signs up or requests to join an existing organization (such as regal-logistics), their request is routed to Organization Owners and Project Managers in real time. Once approved via the Inbox or Team Directory, the member’s dashboard unlocks automatically without requiring a page reload.',
  },
  {
    q: 'How does Omni Flow prevent audio echo and screeching on 1080p video calls?',
    a: 'Omni Flow streams the hardware microphone track directly to WebRTC with native browser Acoustic Echo Cancellation (AEC), noise suppression, and 48kHz Opus encoding—without intermediate WebAudio delay buffers—plus an optional Same-Room Echo Guard for multi-device testing.',
  },
  {
    q: 'Where are Supabase Edge Functions used across the platform?',
    a: 'Heavy operations—including AI Co-Pilot blueprint synthesis, transactional Brevo/SMTP email invites, scheduled SLA automation evaluations, and WebRTC TURN/ICE credential provisioning—run through our Edge Function pipeline (/api/edge/* and supabase/functions/*).',
  },
  {
    q: 'Is the workspace optimized for mobile phones and tablets?',
    a: 'Yes. On viewports under 1024px, Omni Flow transitions to a 5-slot glassmorphic bottom thumb-bar dock, single-lane swipeable Kanban switcher, and slide-over sheet drawers with 44x44px touch targets.',
  },
];

const LandingPage: React.FC = () => {
  const [billingCycle, setBillingCycle] = useState<'annual' | 'monthly'>('annual');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadOrg, setLeadOrg] = useState('');
  const [leadSubmitted, setLeadSubmitted] = useState(false);

  const handleLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadEmail.trim()) return;
    setLeadSubmitted(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#070A12] text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
      <LandingHeader />

      <main className="flex-grow">
        {/* 1. Hero & Interactive 4-Tab Live Product Studio */}
        <HeroSection />

        {/* 2. Claim-to-Proof Adjacency: Attributable Impact Metrics */}
        <section className="py-16 border-y border-white/[0.07] bg-[#090D18]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {IMPACT_METRICS.map((item, idx) => (
                <div
                  key={idx}
                  className="p-6 rounded-2xl bg-slate-900/60 border border-white/[0.08] flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="font-mono tabular-nums text-3xl sm:text-4xl font-extrabold text-white">
                      {item.metric}
                    </div>
                    <div className="text-sm font-bold text-indigo-300">{item.unit}</div>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                      {item.detail}
                    </p>
                  </div>
                  <div className="pt-3 border-t border-white/[0.06] text-xs font-mono text-slate-400">
                    Verified · {item.attribution}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3. Asymmetric Bento Capabilities Grid */}
        <section id="capabilities" className="py-20 md:py-28 bg-[#070A12]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="max-w-3xl space-y-3">
              <div className="text-xs font-mono uppercase tracking-widest text-indigo-400">
                Platform Architecture &amp; Ergonomics
              </div>
              <h2
                className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight"
                style={{ textWrap: 'balance' } as React.CSSProperties}
              >
                Engineered for High-Velocity Execution Across Desktop and Mobile.
              </h2>
              <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
                Every module adheres to a strict 60-30-10 obsidian glassmorphic hierarchy, tabular
                numeric discipline, and native mobile thumb-zone navigation.
              </p>
            </div>

            {/* Asymmetric 2-Row Bento Grid (col-span-2 + col-span-1) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Row 1, Card 1 (Span 2) */}
              <div className="lg:col-span-2 p-6 sm:p-8 rounded-2xl bg-slate-900/65 border border-white/[0.08] flex flex-col justify-between space-y-6">
                <div className="space-y-2">
                  <span className="text-xs font-mono text-indigo-400">
                    01. Multi-Tenant RBAC &amp; Approval Governance
                  </span>
                  <h3 className="text-xl sm:text-2xl font-bold text-white">
                    Deterministic Session Persistence &amp; Instant Organization Approval Gates
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
                    Owners, Admins, Project Managers, Members, and Client Viewers operate within
                    role-tailored command centers. Join requests notify Owners &amp; PMs in real
                    time and unlock the requester’s workspace immediately upon approval.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  {[
                    { role: 'OWNER / ADMIN', scope: 'Full Org Governance · RBAC & Audit Ledger' },
                    { role: 'PROJECT MANAGER', scope: 'Sprint Planning · Join Approvals · Automations' },
                    { role: 'MEMBER / VIEWER', scope: 'Kanban Execution · My Tasks · HD Video Calls' },
                  ].map((r, i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.07]"
                    >
                      <div className="text-[11px] font-mono font-bold text-indigo-400">
                        {r.role}
                      </div>
                      <div className="text-xs text-slate-300 mt-1">{r.scope}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Row 1, Card 2 (Span 1) */}
              <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/65 border border-white/[0.08] flex flex-col justify-between space-y-6">
                <div className="space-y-2">
                  <span className="text-xs font-mono text-emerald-400">
                    02. Mobile-First Thumb Zone
                  </span>
                  <h3 className="text-xl font-bold text-white">
                    5-Slot Bottom Dock &amp; Slide-Over Sheets
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    On phones and tablets, navigation shifts to a fixed glassmorphic bottom dock
                    paired with single-column swipeable Kanban lanes and 44px touch targets.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#070A12] border border-white/[0.08] flex items-center justify-around text-[11px] font-medium text-slate-300">
                  <span className="text-indigo-400 font-bold">Overview</span>
                  <span>Projects</span>
                  <span>Co-Pilot</span>
                  <span>Chat</span>
                  <span>More ↑</span>
                </div>
              </div>

              {/* Row 2, Card 3 (Span 1) */}
              <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/65 border border-white/[0.08] flex flex-col justify-between space-y-6">
                <div className="space-y-2">
                  <span className="text-xs font-mono text-indigo-400">
                    03. Predictive Sprint Velocity
                  </span>
                  <h3 className="text-xl font-bold text-white">
                    Fibonacci Burndown &amp; Capacity Rebalancing
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Track real-time story points across active sprints and let the AI Capacity
                    Balancer redistribute overloaded queues in one click.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.07] font-mono text-xs text-slate-300 flex items-center justify-between">
                  <span>Sprint 14 Burndown</span>
                  <span className="text-emerald-400 font-bold">92% On Track</span>
                </div>
              </div>

              {/* Row 2, Card 4 (Span 2) */}
              <div className="lg:col-span-2 p-6 sm:p-8 rounded-2xl bg-slate-900/65 border border-white/[0.08] flex flex-col justify-between space-y-6">
                <div className="space-y-2">
                  <span className="text-xs font-mono text-indigo-400">
                    04. Studio-Grade 1080p WebRTC &amp; Team Chat
                  </span>
                  <h3 className="text-xl sm:text-2xl font-bold text-white">
                    Lossless 48kHz Opus Audio, 1080p60 Screen Share &amp; Live AI Call Scribe
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
                    Launch instant video calls from any channel or calendar event. Switch between
                    1080p and 720p HD on the fly, share full-motion 60fps application windows, and
                    convert call discussions into assigned Kanban tasks without leaving the call.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-300">
                  <span className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08]">
                    48kHz Stereo Opus (128 kbps)
                  </span>
                  <span className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08]">
                    Hardware AEC + Echo Guard
                  </span>
                  <span className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08]">
                    Resilient In-Call Chat &amp; Captions
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Supabase Edge Functions & Compute Architecture Section */}
        <section
          id="edge-architecture"
          className="py-20 md:py-28 border-t border-white/[0.07] bg-[#090D18]"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div className="max-w-3xl space-y-3">
                <div className="text-xs font-mono uppercase tracking-widest text-indigo-400">
                  Supabase Edge Functions &amp; Server Compute
                </div>
                <h2
                  className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight"
                  style={{ textWrap: 'balance' } as React.CSSProperties}
                >
                  Demanding Workflows Offloaded to the Edge.
                </h2>
                <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
                  Heavy AI synthesis, transactional SMTP/Brevo email delivery, SLA rule evaluation,
                  and WebRTC TURN provisioning execute on server-side Edge endpoints so your
                  workspace UI stays instantaneous.
                </p>
              </div>
              <a
                href="#/app"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs sm:text-sm font-semibold text-white whitespace-nowrap self-start"
              >
                <span>Inspect Live Edge Telemetry in App</span>
                <span aria-hidden="true">→</span>
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {EDGE_FUNCTIONS_SHOWCASE.map(fn => (
                <div
                  key={fn.fnName}
                  className="p-6 rounded-2xl bg-slate-900/70 border border-white/[0.08] flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-indigo-400">
                        {fn.number}. supabase/functions/{fn.fnName}
                      </span>
                      <span className="text-emerald-400">● ACTIVE</span>
                    </div>
                    <h3 className="text-lg font-bold text-white">{fn.title}</h3>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      {fn.description}
                    </p>
                  </div>
                  <div className="pt-3 border-t border-white/[0.06] text-[11px] font-mono text-slate-400">
                    {fn.specs}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Audience-Named Pricing Matrix */}
        <section id="pricing" className="py-20 md:py-28 border-t border-white/[0.07] bg-[#070A12]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-3 max-w-2xl">
                <div className="text-xs font-mono uppercase tracking-widest text-indigo-400">
                  Transparent Workspace Tiers
                </div>
                <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                  Scale From First Sprint to Global Enterprise.
                </h2>
              </div>

              {/* Billing Cycle Toggle placed strictly inside Pricing */}
              <div className="inline-flex items-center p-1 rounded-xl bg-slate-900 border border-white/10 self-start">
                <button
                  type="button"
                  onClick={() => setBillingCycle('annual')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    billingCycle === 'annual'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Annual Billing (Save 25%)
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    billingCycle === 'monthly'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Monthly
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {PRICING_PLANS.map(plan => (
                <div
                  key={plan.name}
                  className={`p-6 sm:p-8 rounded-2xl border flex flex-col justify-between space-y-6 ${
                    plan.highlighted
                      ? 'bg-slate-900/90 border-indigo-500/60 shadow-2xl shadow-indigo-950/40'
                      : 'bg-slate-900/50 border-white/[0.08]'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="text-xs font-mono text-indigo-400">{plan.audience}</div>
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                      {plan.highlighted && (
                        <span className="text-[11px] font-mono font-semibold text-emerald-400">
                          Recommended
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono tabular-nums text-4xl font-extrabold text-white">
                        {billingCycle === 'annual' ? plan.annualPrice : plan.monthlyPrice}
                      </span>
                      <span className="text-xs text-slate-400">{plan.period}</span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      {plan.description}
                    </p>

                    <ul className="space-y-2.5 pt-3 border-t border-white/[0.07] text-xs sm:text-sm text-slate-200">
                      {plan.features.map((feat, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <ICON_MAP.CheckIcon className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <a
                    href={plan.ctaHref}
                    className={`w-full py-3 px-4 rounded-xl text-center text-xs sm:text-sm font-semibold transition-all ${
                      plan.highlighted
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25'
                        : 'bg-white/[0.06] hover:bg-white/[0.12] text-white border border-white/10'
                    }`}
                  >
                    {plan.ctaText} →
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 6. FAQ & Validated Enterprise Lead Capture */}
        <section
          id="enterprise-contact"
          className="py-20 md:py-24 border-t border-white/[0.07] bg-[#090D18]"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* FAQ Column */}
            <div className="lg:col-span-7 space-y-6">
              <div className="space-y-2">
                <div className="text-xs font-mono uppercase tracking-widest text-indigo-400">
                  Technical &amp; Operational FAQ
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                  Frequently Asked Questions
                </h2>
              </div>

              <div className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
                {FAQ_ITEMS.map((item, idx) => (
                  <details key={idx} className="group py-4">
                    <summary className="flex items-center justify-between gap-4 cursor-pointer list-none text-sm sm:text-base font-semibold text-white group-hover:text-indigo-300">
                      <span>{item.q}</span>
                      <ICON_MAP.ChevronDownIcon className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform shrink-0" />
                    </summary>
                    <p className="mt-2.5 text-xs sm:text-sm text-slate-300 leading-relaxed">
                      {item.a}
                    </p>
                  </details>
                ))}
              </div>
            </div>

            {/* Enterprise Briefing / Fast-Track Setup Card */}
            <div className="lg:col-span-5">
              <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/80 border border-white/10 space-y-5">
                <div className="space-y-1.5">
                  <div className="text-xs font-mono text-indigo-400">
                    Direct Architecture &amp; Onboarding
                  </div>
                  <h3 className="text-xl font-bold text-white">
                    Deploy Omni Flow for Your Organization
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Launch your workspace immediately or request custom Edge Function and SSO
                    provisioning for your engineering team.
                  </p>
                </div>

                {leadSubmitted ? (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs sm:text-sm text-emerald-300 space-y-2">
                    <div className="font-bold text-white">
                      Organization Provisioning Request Logged
                    </div>
                    <p>
                      We’ve prepared your workspace configuration for{' '}
                      <strong>{leadOrg || leadEmail}</strong>. You can enter the live studio right
                      now.
                    </p>
                    <a
                      href="#/app"
                      className="inline-block mt-2 px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold text-xs"
                    >
                      Open Live Workspace →
                    </a>
                  </div>
                ) : (
                  <form onSubmit={handleLeadSubmit} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Work Email
                      </label>
                      <input
                        type="email"
                        required
                        value={leadEmail}
                        onChange={e => setLeadEmail(e.target.value)}
                        placeholder="you@company.com"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#070A12] border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Organization Name
                      </label>
                      <input
                        type="text"
                        value={leadOrg}
                        onChange={e => setLeadOrg(e.target.value)}
                        placeholder="e.g. Regal Logistics"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#070A12] border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-indigo-600/25 cursor-pointer transition-all"
                    >
                      Request Custom Onboarding
                    </button>
                    <div className="text-center pt-1">
                      <a
                        href="#/app"
                        className="text-xs text-slate-400 hover:text-white underline"
                      >
                        Or jump straight into your workspace now →
                      </a>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
};

export default LandingPage;
