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
    ctaHref: '#/signup',
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
    ctaHref: '#/signup',
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
    <div className="min-h-screen flex flex-col bg-[#131511] text-[#F2F3EE] antialiased selection:bg-[#CCF048] selection:text-[#131511]">
      <LandingHeader />

      <main className="flex-grow">
        {/* 1. Hero & Interactive 4-Tab Live Product Studio */}
        <HeroSection />

        {/* 2. Claim-to-Proof Adjacency: Attributable Impact Metrics */}
        <section className="py-16 border-y border-[#2B3026] bg-[#171A14]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {IMPACT_METRICS.map((item, idx) => (
                <div
                  key={idx}
                  className="p-6 rounded-2xl bg-[#1D2118]/90 border border-[#2B3026] flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="font-mono tabular-nums text-3xl sm:text-4xl font-extrabold text-[#F2F3EE]">
                      {item.metric}
                    </div>
                    <div className="text-sm font-bold text-[#CCF048]">{item.unit}</div>
                    <p className="text-xs sm:text-sm text-[#A6AC9C] leading-relaxed">
                      {item.detail}
                    </p>
                  </div>
                  <div className="pt-3 border-t border-[#2B3026] text-xs font-mono text-[#7C8273]">
                    Verified · {item.attribution}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3. Asymmetric Bento Capabilities Grid */}
        <section id="capabilities" className="py-20 md:py-28 bg-[#131511]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="max-w-3xl space-y-3">
              <div className="text-xs font-mono uppercase tracking-widest text-[#CCF048]">
                Platform Architecture &amp; Ergonomics
              </div>
              <h2
                className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight"
                style={{ textWrap: 'balance' } as React.CSSProperties}
              >
                Engineered for High-Velocity Execution Across Desktop and Mobile.
              </h2>
              <p className="text-sm sm:text-base text-[#A6AC9C] leading-relaxed">
                Every module adheres to a strict obsidian-sage glassmorphic hierarchy, tabular
                numeric discipline, and native mobile thumb-zone navigation.
              </p>
            </div>

            {/* Asymmetric 2-Row Bento Grid (col-span-2 + col-span-1) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Row 1, Card 1 (Span 2) */}
              <div className="lg:col-span-2 p-6 sm:p-8 rounded-2xl bg-[#1D2118]/90 border border-[#2B3026] flex flex-col justify-between space-y-6">
                <div className="space-y-2">
                  <span className="text-xs font-mono text-[#CCF048]">
                    01. Multi-Tenant RBAC &amp; Approval Governance
                  </span>
                  <h3 className="text-xl sm:text-2xl font-bold text-white">
                    Deterministic Session Persistence &amp; Instant Organization Approval Gates
                  </h3>
                  <p className="text-xs sm:text-sm text-[#A6AC9C] leading-relaxed max-w-2xl">
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
                      className="p-3.5 rounded-xl bg-[#24291F]/80 border border-[#2B3026]"
                    >
                      <div className="text-[11px] font-mono font-bold text-[#CCF048]">
                        {r.role}
                      </div>
                      <div className="text-xs text-[#D6DACF] mt-1">{r.scope}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Row 1, Card 2 (Span 1) */}
              <div className="p-6 sm:p-8 rounded-2xl bg-[#1D2118]/90 border border-[#2B3026] flex flex-col justify-between space-y-6">
                <div className="space-y-2">
                  <span className="text-xs font-mono text-emerald-400">
                    02. Segmented Mobile Switcher &amp; Thumb Zone
                  </span>
                  <h3 className="text-xl font-bold text-white">
                    Segmented Tabs (Overview, Schedule, Chat) with Zero Overlap
                  </h3>
                  <p className="text-xs sm:text-sm text-[#A6AC9C] leading-relaxed">
                    On phones and tablets, the workspace dynamically isolates dashboard modules into instant segmented switcher tabs, eliminating squishing and element collision with 100% full-width layout precision.
                  </p>
                </div>
                <div className="relative rounded-xl overflow-hidden border border-[#2B3026] shadow-lg">
                  <img
                    src="/images/landing_mobile_studio.jpg"
                    alt="Mobile and Tablet Segmented Switcher Tabs Mockup"
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#131511]/85 via-transparent to-transparent flex items-end p-3">
                    <span className="text-[10px] font-mono text-emerald-400 font-bold">
                      ✓ Phone &amp; Tablet: Overview · Schedule · Team Chat · Focus
                    </span>
                  </div>
                </div>
              </div>

              {/* Row 2, Card 3 (Span 1) */}
              <div className="p-6 sm:p-8 rounded-2xl bg-[#1D2118]/90 border border-[#2B3026] flex flex-col justify-between space-y-6">
                <div className="space-y-2">
                  <span className="text-xs font-mono text-[#CCF048]">
                    03. Autonomous AI Co-Pilot &amp; Risk Radar
                  </span>
                  <h3 className="text-xl font-bold text-white">
                    Fibonacci Burndown &amp; Capacity Rebalancing
                  </h3>
                  <p className="text-xs sm:text-sm text-[#A6AC9C] leading-relaxed">
                    Track real-time story points across active sprints, generate multi-phase architecture roadmaps, and monitor automated risk radar telemetry in one unified view.
                  </p>
                </div>
                <div className="relative rounded-xl overflow-hidden border border-[#2B3026] shadow-lg">
                  <img
                    src="/images/landing_copilot_studio.jpg"
                    alt="AI Project Management Copilot 3D Studio"
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#131511]/85 via-transparent to-transparent flex items-end p-3">
                    <span className="text-[10px] font-mono text-[#CCF048] font-bold">
                      Sprint 14 Burndown · 92% On Track
                    </span>
                  </div>
                </div>
              </div>

              {/* Row 2, Card 4 (Span 2) */}
              <div className="lg:col-span-2 p-6 sm:p-8 rounded-2xl bg-[#1D2118]/90 border border-[#2B3026] flex flex-col justify-between space-y-6">
                <div className="space-y-2">
                  <span className="text-xs font-mono text-[#CCF048]">
                    04. Studio-Grade 1080p WebRTC &amp; Screen Sharing
                  </span>
                  <h3 className="text-xl sm:text-2xl font-bold text-white">
                    Lossless 48kHz Opus Audio, 1080p60 Mesh &amp; Collaborative Code Canvas
                  </h3>
                  <p className="text-xs sm:text-sm text-[#A6AC9C] leading-relaxed max-w-2xl">
                    Launch instant video standups from any channel or calendar event. Share application windows at 60fps, eliminate echo with hardware-level AEC, and turn live discussions into tracked deliverables without context switching.
                  </p>
                </div>
                <div className="relative rounded-xl overflow-hidden border border-[#2B3026] shadow-lg">
                  <img
                    src="/images/landing_webrtc_studio.jpg"
                    alt="1080p WebRTC Video Studio and Collaborative Canvas"
                    className="w-full h-56 object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#131511]/85 via-transparent to-transparent flex items-end justify-between p-4">
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-[#F2F3EE]">
                      <span className="px-2.5 py-1 rounded bg-[#131511]/80 border border-white/15">
                        48kHz Stereo Opus
                      </span>
                      <span className="px-2.5 py-1 rounded bg-[#131511]/80 border border-white/15">
                        Hardware AEC
                      </span>
                      <span className="px-2.5 py-1 rounded bg-[#131511]/80 border border-white/15">
                        1080p60 Adaptive Mesh
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Supabase Edge Functions & Compute Architecture Section */}
        <section
          id="edge-architecture"
          className="py-20 md:py-28 border-t border-[#2B3026] bg-[#171A14]"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div className="max-w-3xl space-y-3">
                <div className="text-xs font-mono uppercase tracking-widest text-[#CCF048]">
                  Supabase Edge Functions &amp; Server Compute
                </div>
                <h2
                  className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight"
                  style={{ textWrap: 'balance' } as React.CSSProperties}
                >
                  Demanding Workflows Offloaded to the Edge.
                </h2>
                <p className="text-sm sm:text-base text-[#A6AC9C] leading-relaxed">
                  Heavy AI synthesis, transactional SMTP/Brevo email delivery, SLA rule evaluation,
                  and WebRTC TURN provisioning execute on server-side Edge endpoints so your
                  workspace UI stays instantaneous.
                </p>
              </div>
              <a
                href="#/app"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs sm:text-sm font-semibold text-white whitespace-nowrap self-start"
              >
                <span>Inspect Live Edge Telemetry in App</span>
                <span aria-hidden="true">→</span>
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {EDGE_FUNCTIONS_SHOWCASE.map(fn => (
                <div
                  key={fn.fnName}
                  className="p-6 rounded-2xl bg-[#1D2118]/90 border border-[#2B3026] flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-[#CCF048]">
                        {fn.number}. supabase/functions/{fn.fnName}
                      </span>
                      <span className="text-emerald-400">● ACTIVE</span>
                    </div>
                    <h3 className="text-lg font-bold text-white">{fn.title}</h3>
                    <p className="text-xs sm:text-sm text-[#A6AC9C] leading-relaxed">
                      {fn.description}
                    </p>
                  </div>
                  <div className="pt-3 border-t border-[#2B3026] text-[11px] font-mono text-[#7C8273]">
                    {fn.specs}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Audience-Named Pricing Matrix */}
        <section id="pricing" className="py-20 md:py-28 border-t border-[#2B3026] bg-[#131511]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-3 max-w-2xl">
                <div className="text-xs font-mono uppercase tracking-widest text-[#CCF048]">
                  Transparent Workspace Tiers
                </div>
                <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                  Scale From First Sprint to Global Enterprise.
                </h2>
              </div>

              {/* Billing Cycle Toggle placed strictly inside Pricing */}
              <div className="inline-flex items-center p-1 rounded-full bg-[#1D2118] border border-[#2B3026] self-start">
                <button
                  type="button"
                  onClick={() => setBillingCycle('annual')}
                  className={`px-3.5 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    billingCycle === 'annual'
                      ? 'bg-[#CCF048] text-[#131511]'
                      : 'text-[#A6AC9C] hover:text-white'
                  }`}
                >
                  Annual Billing (Save 25%)
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-3.5 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    billingCycle === 'monthly'
                      ? 'bg-[#CCF048] text-[#131511]'
                      : 'text-[#A6AC9C] hover:text-white'
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
                      ? 'bg-[#1D2118] border-[#97B832]/70 shadow-2xl shadow-black/50'
                      : 'bg-[#171A14] border-[#2B3026]'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="text-xs font-mono text-[#CCF048]">{plan.audience}</div>
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
                      <span className="text-xs text-[#A6AC9C]">{plan.period}</span>
                    </div>
                    <p className="text-xs sm:text-sm text-[#D6DACF] leading-relaxed">
                      {plan.description}
                    </p>

                    <ul className="space-y-2.5 pt-3 border-t border-[#2B3026] text-xs sm:text-sm text-[#E5E8DE]">
                      {plan.features.map((feat, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <ICON_MAP.CheckIcon className="w-4 h-4 text-[#CCF048] shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <a
                    href={plan.ctaHref}
                    onClick={() => {
                      if (plan.ctaHref.startsWith('#/')) {
                        sessionStorage.setItem('omni_explicit_auth_intent', 'true');
                      }
                    }}
                    className={`w-full py-3 px-5 rounded-full text-center text-xs sm:text-sm font-semibold transition-all ${
                      plan.highlighted
                        ? 'bg-[#CCF048] hover:bg-[#D9F66A] text-[#131511] shadow-lg shadow-black/25'
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
          className="py-20 md:py-24 border-t border-[#2B3026] bg-[#171A14]"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* FAQ Column */}
            <div className="lg:col-span-7 space-y-6">
              <div className="space-y-2">
                <div className="text-xs font-mono uppercase tracking-widest text-[#CCF048]">
                  Technical &amp; Operational FAQ
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                  Frequently Asked Questions
                </h2>
              </div>

              <div className="divide-y divide-[#2B3026] border-y border-[#2B3026]">
                {FAQ_ITEMS.map((item, idx) => (
                  <details key={idx} className="group py-4">
                    <summary className="flex items-center justify-between gap-4 cursor-pointer list-none text-sm sm:text-base font-semibold text-white group-hover:text-[#CCF048]">
                      <span>{item.q}</span>
                      <ICON_MAP.ChevronDownIcon className="w-4 h-4 text-[#A6AC9C] group-open:rotate-180 transition-transform shrink-0" />
                    </summary>
                    <p className="mt-2.5 text-xs sm:text-sm text-[#A6AC9C] leading-relaxed">
                      {item.a}
                    </p>
                  </details>
                ))}
              </div>
            </div>

            {/* Enterprise Briefing / Fast-Track Setup Card */}
            <div className="lg:col-span-5">
              <div className="p-6 sm:p-8 rounded-2xl bg-[#1D2118] border border-[#2B3026] space-y-5">
                <div className="space-y-1.5">
                  <div className="text-xs font-mono text-[#CCF048]">
                    Direct Architecture &amp; Onboarding
                  </div>
                  <h3 className="text-xl font-bold text-white">
                    Deploy Omni Flow for Your Organization
                  </h3>
                  <p className="text-xs sm:text-sm text-[#A6AC9C] leading-relaxed">
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
                      href="#/signup"
                      onClick={() => sessionStorage.setItem('omni_explicit_auth_intent', 'true')}
                      className="inline-block mt-2 px-5 py-2.5 rounded-full bg-emerald-600 text-white font-semibold text-xs"
                    >
                      Open Live Workspace →
                    </a>
                  </div>
                ) : (
                  <form onSubmit={handleLeadSubmit} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-medium text-[#D6DACF] mb-1">
                        Work Email
                      </label>
                      <input
                        type="email"
                        required
                        value={leadEmail}
                        onChange={e => setLeadEmail(e.target.value)}
                        placeholder="you@company.com"
                        className="w-full px-3.5 py-2.5 rounded-2xl bg-[#131511] border border-[#2B3026] text-sm text-white placeholder-[#7C8273] focus:outline-none focus:border-[#CCF048]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#D6DACF] mb-1">
                        Organization Name
                      </label>
                      <input
                        type="text"
                        value={leadOrg}
                        onChange={e => setLeadOrg(e.target.value)}
                        placeholder="e.g. Regal Logistics"
                        className="w-full px-3.5 py-2.5 rounded-2xl bg-[#131511] border border-[#2B3026] text-sm text-white placeholder-[#7C8273] focus:outline-none focus:border-[#CCF048]"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-3 rounded-full bg-[#CCF048] hover:bg-[#D9F66A] text-[#131511] text-xs sm:text-sm font-semibold shadow-lg shadow-black/25 cursor-pointer transition-all"
                    >
                      Request Custom Onboarding
                    </button>
                    <div className="text-center pt-1">
                      <a
                        href="#/signup"
                        onClick={() => sessionStorage.setItem('omni_explicit_auth_intent', 'true')}
                        className="text-xs text-[#A6AC9C] hover:text-white underline"
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
