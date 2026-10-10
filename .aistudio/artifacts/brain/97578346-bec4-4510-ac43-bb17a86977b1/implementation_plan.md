# Omni Flow — Platform-Wide Glassmorphic UI/UX Modernization, Landing Page Redesign & Edge Functions Architecture

This plan defines a cohesive, end-to-end visual and architectural upgrade for **Omni Flow**: replacing the misaligned landing page with an obsidian glassmorphic showcase featuring interactive live product preview tabs, introducing mobile-first thumb-zone navigation (bottom dock + slide-over sheets) across all 12 workspace modules, and offloading heavy compute, AI synthesis, transactional notifications, automation triggers, and WebRTC TURN/transcription workloads to Supabase Edge Functions and server-side endpoints.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and design decisions incorporate your confirmed preferences from Phase 1 and establish the blueprint for execution once you approve.

- **Confirmed Decision 1 — Landing Page Direction**: **Obsidian Glassmorphic with Interactive Live Product Preview Tabs**. The broken CSS-globe landing page will be replaced with a structured, high-contrast obsidian canvas (`#070A12` to `#0F172A`), a strict 3-zone top navigation bar, an interactive multi-tab product stage (allowing visitors to test live interactive previews of Kanban & Sprints, AI Co-Pilot & Executive Reports, Teams Chat & 1080p HD Video Studio, and Workflow Automations directly in the hero), an asymmetric Bento capability grid, attributable customer impact metrics, a transparent tier comparison matrix, and a validated lead/waitlist capture flow.
- **Confirmed Decision 2 — Mobile-First Ergonomics & Workspace Shell**: **Bottom Thumb-Bar Dock + Slide-Over Sheet Drawers & Responsive Cards**. On mobile and tablet viewports (`< 1024px`), primary navigation moves into the natural thumb reach zone via a 5-slot glassmorphic bottom dock (Overview, Projects/Kanban, AI Co-Pilot, Chat & Meet, More Sheet) paired with a compact 52px top bar, while secondary panels, task inspectors, filters, and forms open as smooth bottom-up slide-over sheets with drag-handle affordances and $\ge 44 \times 44\text{px}$ touch hitboxes.
- **Confirmed Decision 3 — Supabase Edge Functions & Server Compute Integration**: All four high-demand domains will be architected with dedicated Edge Function / server-side execution pipelines:
  1. **AI Co-Pilot & Executive Report Synthesis** (`gemini-3.8-flash` & `gemini-3.1-pro-preview` server-side streaming & structured JSON synthesis).
  2. **Transactional Emails, Organization Invites & Join-Request Webhooks** (Brevo/SMTP dispatch via Edge Function with automatic fallback token links so sign-up and org approvals never block on client-side SMTP errors).
  3. **Scheduled Automation Triggers, SLA Breach Alerts & Audit Log Digests** (Server-authoritative rule evaluation and cron-compatible digest generation).
  4. **Live WebRTC TURN/ICE Credential Provisioning & Meeting Audio Transcription** (Ephemeral TURN credentials for NAT traversal + `gemini-3.5-transcribe` meeting audio summarization).

---

## 1. Overview & Core Concept

- **What It Does**: Transforms Omni Flow into a unified, studio-grade enterprise project intelligence and real-time collaboration platform where every view—from the public marketing experience to Kanban boards, sprint analytics, AI Co-Pilot, and 1080p WebRTC video calls—shares a disciplined obsidian-and-slate glassmorphic design language and native mobile ergonomics.
- **Target Audience / Persona**: Engineering leaders, product managers, organization owners, and cross-functional teams operating across desktop monitors and mobile devices who require zero-latency task execution, real-time presence, and executive visibility.
- **Key Value**: Eliminates visual misalignment, cramped mobile tables, and main-thread browser bottlenecks by pairing a cohesive 60-30-10 glassmorphic design system with resilient Edge Function offloading.

---

## 2. User Experience & Visual Design

### A. Visual Identity & Theme System

- **Aesthetic Direction**: **Precision Obsidian Glassmorphism**—layered translucent surfaces (`backdrop-blur-xl`), crisp 1px specular hairline borders (`border-white/[0.08]` in dark mode, `border-slate-200/80` in light mode), single-elevation card depth, and zero visual clutter.
- **Color Palette & 60-30-10 Discipline**:
  - **60% Dominant Neutral Canvas**: Deep Obsidian (`#070A12` / `slate-950`) in dark mode; Crisp Alabaster (`#F8FAFC` / `slate-50`) in light mode.
  - **30% Structural Glass Surfaces**: Translucent slate panels (`bg-slate-900/65 backdrop-blur-xl` / `bg-white/80 backdrop-blur-xl`) with subtle top-edge luminance highlights and subdued secondary typography (`#94A3B8`).
  - **10% High-Intent Accent Budget**: Electric Indigo (`#6366F1` -> `#4F46E5`) reserved strictly for primary CTAs, active navigation indicators, and focused interactive states, paired with semantic status pairings (Emerald `#10B981` + label for nominal/completed, Amber `#F59E0B` + label for approaching SLA, Rose `#F43F5E` + label for blockers/overdue).
- **Typography & Tabular Discipline (2+1 Font Rule)**:
  - **Display & Headings**: `Plus Jakarta Sans` (`font-display`, tight tracking `-0.02em`, `text-wrap: balance` on all headlines, `clamp(2.25rem, 4vw, 3.75rem)` for hero display).
  - **Body & Dense UI Controls**: `DM Sans` / `Plus Jakarta Sans` (`14px–16px`, `leading-relaxed` for prose, single-line `whitespace-nowrap` on all buttons, tabs, and nav links).
  - **Telemetry, Timestamps, Sprint Velocity & Financials**: `JetBrains Mono` with `font-variant-numeric: tabular-nums` so counters, call timers, burndown metrics, and audit timestamps align vertically without jitter.
- **Zero-Pill & Anti-Slop Discipline**:
  - Static metadata (project keys, dates, read times, role labels in lists) renders as clean unboxed inline typography separated by middle dots (`·`), never wrapped in redundant pill badge sandwiches.
  - Thick left accent borders (`border-l-4`) and decorative pulsing dots on static headings are removed across the platform; live indicator dots are reserved strictly for active WebRTC streams and real-time presence heartbeats.

### B. Redesigned Landing Page Walkthrough (`Proposition -> Interactive Mechanism -> Proof -> Conversion`)

1. **Strict 3-Zone Glassmorphic Top Bar**:
   - **Zone 1 (Brand)**: Clean single-line `Omni Flow` wordmark with geometric mark (`whitespace-nowrap shrink-0`).
   - **Zone 2 (Navigation)**: 4 single-line links (`Product Tour`, `Capabilities`, `Architecture`, `Pricing`) with smooth scroll and subtle hover underlines.
   - **Zone 3 (Primary Action)**: Single primary CTA button (`Launch Workspace` / `Sign In`) plus a quiet theme toggle.
2. **Hero Section with Interactive Live Product Preview Studio**:
   - Centered high-impact value proposition with balanced typography, primary CTA (`Start Free Workspace`), and secondary interactive trigger (`Explore Live Demo`).
   - Immediately below the headline sits an interactive **Obsidian Glassmorphic Product Frame** with 4 switchable live preview tabs:
     - **01. Kanban & Sprint Velocity**: Interactive mini-board where visitors can drag/toggle task states and inspect real-time sprint burndown telemetry.
     - **02. AI Co-Pilot & Executive Scribe**: Interactive prompt selector demonstrating instant work-breakdown generation, risk radar detection, and 1-click board insertion.
     - **03. Teams Chat & 1080p HD Video Studio**: Live preview of multi-participant HD video tiles, 48kHz Opus voice waves, screen-share stage, and collaborative meeting notes.
     - **04. Triggers, Rules & Edge Automations**: Visual if-this-then-that rule builder showing automated SLA escalations and webhook dispatches.
3. **Asymmetric Bento Capabilities Grid**:
   - 2-row asymmetric layout (`col-span-2` marquee cards paired with `col-span-1` deep-dive cards) using numbered editorial headings (`01. Multi-Tenant RBAC & Approval Workflows`, `02. Predictive Sprint Intelligence`, `03. Low-Latency 1080p WebRTC Mesh`, `04. Edge-Executed Automation Engine`).
4. **Claim-to-Proof Adjacency & Attributable Case Studies**:
   - Placed directly beneath capabilities: 3 concrete organizational impact cards with explicit units and timeframes (e.g., `42% Faster Sprint Cycle Time in 90 Days`, `100% Audit Traceability Across Multi-Role Teams`, `Zero Context-Switching Between Video Standups & Task Boards`).
5. **Audience-Named Pricing Matrix & Interactive FAQ + Lead Capture**:
   - Clear tier comparison (`For Early-Stage Teams`, `For Scaling Engineering Orgs`, `For Enterprise Operations`) with monthly/annual segmented toggle placed inside the pricing section, followed by an accordion FAQ and a validated enterprise inquiry form.

### C. Platform-Wide Feature-by-Feature UI/UX & Mobile Refinement Breakdown

| Platform Module | Current Pain Points | Glassmorphic & Mobile-First Refinements |
| :--- | :--- | :--- |
| **1. Global App Shell, Header & Navigation** | Desktop sidebar overlaps or requires hamburger hunting on mobile; header crowds breadcrumbs, status, and actions on small screens. | **Desktop**: Sleek 256px collapsible obsidian/alabaster glass sidebar + 1-row contextual breadcrumb header. **Mobile (`< 1024px`)**: Compact 52px sticky top bar + **Fixed 5-Slot Bottom Thumb-Bar Dock** (`Overview`, `Projects`, `AI Co-Pilot`, `Chat & Meet`, `More` slide-up sheet). Aggregate sticky height strictly $\le 15\%$ of viewport. |
| **2. Authentication & Organization Onboarding Gate** | Sign-up confirmation errors when SMTP lags; org join-request waiting screen feels static. | Glassmorphic split-card auth layout; resilient sign-up feedback that gracefully handles SMTP confirmation states; real-time animated status tracker on the **Pending Organization Approval** screen with instant auto-unlock when an Owner/PM approves. |
| **3. Executive Overview Dashboard** | Stat cards use inconsistent heights and thick left borders; widgets stack awkwardly on mobile. | Unified 4-column metric strip (`tabular-nums`) with micro SVG sparklines; 2-column asymmetric Bento grid for *My Priority Queue*, *Active Sprint Pulse*, *Team Presence*, and *Recent Activity*; horizontal swipeable summary cards on mobile. |
| **4. Projects Overview & Portfolio Grid** | Dense project cards with multi-row pill clutter; table/grid toggle lacks mobile polish. | Clean project cards leading with Project Title, progress bar, unboxed metadata (`12 open tasks · 84% complete · Due Oct 24`), and member avatar stack; instant client-side search and segmented status filter (`All · Active · At Risk · Completed`). |
| **5. Kanban Board & Task Detail Drawer** | Horizontal board scrolling on mobile is difficult to navigate; task modals feel cramped on phones. | **Desktop**: Smooth multi-column glassmorphic lanes with subtle drop-zone highlights and compact cards. **Mobile**: Segmented column switcher (`To Do | In Progress | Review | Done`) with swipe gestures so users view one full-width lane at a time; Task Detail opens as a full-height slide-over sheet with pinned bottom save/action bar. |
| **6. Sprints & Velocity Planner** | Burndown charts and backlog tables overflow narrow screens. | Responsive SVG burndown/velocity area charts with touch tooltips; split backlog-to-sprint planner that converts into a tabbed sheet (`Active Sprint` vs `Backlog Queue`) on mobile with 1-tap sprint assignment. |
| **7. My Tasks & Personal Focus Queue** | Table rows clip on mobile viewports; bulk actions are hard to reach. | Adaptive view: High-density 40px tabular grid on desktop; converts automatically to 64px interactive tap-list rows on mobile with quick-complete checkboxes ($\ge 44\text{px}$ hitbox) and a floating bottom action bar when items are selected. |
| **8. Calendar & Meetings Hub** | Month grid cells become unreadable on 375px screens; scheduling modal is tall. | Responsive calendar with **Month Grid** on desktop and **Horizontal Day Scroller + Agenda Timeline** on mobile; 1-tap `"Join 1080p Studio"` button on scheduled meetings with live participant avatars. |
| **9. Teams Chat & 1080p Video Call Studio** | Chat channel list and message thread compete for width on tablets/phones. | Master-detail split on desktop; single-pane navigation (`Channel List` $\rightarrow$ `Full-Screen Thread` with back button) on mobile; Video Call Studio features floating glassmorphic icon dock, 1080p/720p HD selector, Echo Guard toggle, and bottom-sheet drawers for mobile In-Call Chat & AI Notes. |
| **10. AI Co-Pilot & Executive PM Assistant** | Prompt responses and generated task lists need cleaner visual hierarchy and streaming feedback. | Glassmorphic command studio with curated prompt templates (*Sprint Risk Audit*, *Generate Work Breakdown*, *Executive Weekly Brief*), structured task preview cards with 1-click `"Add Selected to Project"`, and server-side Edge execution. |
| **11. Triggers & Rules (Task Automations)** | Rule cards look mechanical; creating rules on mobile requires excessive scrolling. | Visual `Trigger -> Condition -> Action` flow cards with clean toggle switches, execution counters (`tabular-nums`), and a guided 3-step slide-over rule builder. |
| **12. Inbox, Reports, Team RBAC & Audit Logs** | Wide admin tables (`Team Management`, `User Logs`) cause horizontal page overflow on mobile. | **Inbox**: Segmented filter (`All · Unread · Approvals · Mentions`) with inline 1-tap `Approve / Decline` for Org Join Requests. **Reports & Admin Tables**: Responsive data cards on mobile + exportable CSV/PDF executive summaries and role-permission matrices. |

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Hybrid Edge Function + Express Server Execution Layer**:
  - *Chosen Approach*: Provide both portable **Supabase Edge Functions** (Deno TypeScript modules in `supabase/functions/*` ready for `supabase functions deploy`) AND mirrored **Server-Side Express Routes** (`/api/edge/*` in `server.ts`) with automatic client fallback via a unified `edgeFunctionService.ts`.
  - *Why*: Ensures every demanding workflow (AI synthesis, transactional emails/invites, automation evaluation, and TURN/ICE provisioning) executes server-side immediately in the AI Studio preview & Cloud Run production environment while giving you drop-in Supabase Edge Functions for your Supabase project.
  - *Alternatives Considered*: Relying solely on client-side `supabase.functions.invoke()` without server routes—rejected because un-deployed Edge Functions in a user's external Supabase project would fail with 404/CORS until manually deployed via CLI.
- **Decision 2 — Mobile Lane Switcher vs. Zoomed-Out Horizontal Kanban**:
  - *Chosen Approach*: On mobile screens (`< 768px`), provide a sticky segmented lane bar (`To Do (4) | In Progress (3) | Review (2) | Done (8)`) with horizontal swipe support rather than forcing 4 narrow columns side-by-side.
  - *Why*: Eliminates two-dimensional scrolling fatigue and guarantees every task card has full horizontal legibility and $44\text{px}$ touch targets.
- **Decision 3 — Lossless Hardware AEC + Optional Echo Guard for WebRTC**:
  - *Chosen Approach*: Keep the raw 48kHz Opus hardware microphone track un-buffered by intermediate WebAudio compressors, and apply acoustic ducking on the receiving speaker element when Echo Guard is enabled.
  - *Why*: Preserves bit-exact browser Acoustic Echo Cancellation reference timing while preventing feedback loops when two devices are tested in the same room.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### A. System Architecture & Edge Function Pipeline Diagram

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                           OMNI FLOW CLIENT APPLICATION                               │
│                                                                                      │
│  ┌──────────────────────────────┐    ┌────────────────────────────────────────────┐  │
│  │  Obsidian Glass Landing Page │    │     Responsive Workspace Shell             │  │
│  │  • 3-Zone Top Bar Contract   │    │  • Desktop: 256px Glass Sidebar + Header   │  │
│  │  • Interactive 4-Tab Studio  │    │  • Mobile: 52px Top Bar + 5-Slot Thumb Bar │  │
│  │  • Asymmetric Bento Grid     │    │  • Slide-Over Bottom Sheets & Drawers      │  │
│  └──────────────┬───────────────┘    └─────────────────────┬──────────────────────┘  │
│                 │                                          │                         │
│                 ▼                                          ▼                         │
│  ┌────────────────────────────────────────────────────────────────────────────────┐  │
│  │                     Unified State & Real-Time Service Layer                    │  │
│  │   useAppStore  │  supabaseService  │  meetingAndCallService  │  edgeService    │  │
│  └──────┬───────────────────┬──────────────────────┬────────────────────┬─────────┘  │
└─────────┼───────────────────┼──────────────────────┼────────────────────┼────────────┘
          │                   │                      │                    │
          ▼                   ▼                      ▼                    ▼
┌───────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────────┐
│  Supabase Auth &  │ │ Supabase Realtime│ │ WebRTC P2P Mesh  │ │  Edge & Server API   │
│  PostgreSQL DB    │ │ Broadcast &      │ │ 1080p/60fps Video│ │  Compute Layer       │
│  • user_profiles  │ │ Presence         │ │ 48kHz Opus Audio │ │                      │
│  • projects/tasks │ │ • Live cursors   │ │ • Video-only DOM │ │ 1. ai-copilot-exec   │
│  • notifications  │ │ • Org join sync  │ │ • RemoteAudio    │ │ 2. transactional-mail│
│  • audit_logs     │ │ • Call signaling │ │ • Echo Guard     │ │ 3. automation-runner │
└───────────────────┘ └──────────────────┘ └──────────────────┘ │ 4. turn-credentials  │
                                                                └──────────────────────┘
```

### B. Where & How Edge Functions Integrate for Demanding Processes

We will implement a unified **`edgeFunctionService`** backed by both `supabase/functions/<name>/index.ts` (for Supabase Edge deployment) and `/api/edge/<name>` in `server.ts` (for immediate full-stack execution):

1. **`ai-copilot-synthesis` (AI Co-Pilot, Sprint Risk Radar & Executive Reports)**:
   - **Why Offload**: Aggregating hundreds of tasks, sprint velocities, and audit logs and calling `@google/genai` (`gemini-3.8-flash` for rapid task breakdowns/summaries and `gemini-3.1-pro-preview` for deep executive risk analysis) belongs on the server/edge so API keys remain strictly server-side (`process.env.GEMINI_API_KEY`) and large prompt payloads are compressed off the client thread.
   - **Capabilities**: Structured JSON task generation (`Type.ARRAY` schema), executive markdown report compilation, and meeting transcript action-item extraction.
2. **`transactional-notifications` (Emails, Org Invites & Join-Request Webhooks)**:
   - **Why Offload**: When a user requests to join an organization, or an Owner/PM approves a request or sends an email invite, dispatching transactional emails via Brevo/SMTP or webhooks from the Edge prevents client-side CORS failures and ensures sign-up never crashes if an SMTP rate limit is hit.
   - **Capabilities**: Sends formatted HTML approval/invite notifications, logs delivery audit events, and returns instant tokenized invite links as a zero-downtime fallback.
3. **`automation-rule-engine` (Scheduled SLA Checks, Trigger Evaluation & Audit Digests)**:
   - **Why Offload**: Evaluating complex `Trigger -> Condition -> Action` rules (e.g., auto-escalating overdue tasks to `CRITICAL`, notifying Project Managers when sprint scope creeps $>20\%$, or compiling weekly compliance audit digests) requires deterministic server-side execution rather than relying on a user having a browser tab open.
   - **Capabilities**: Evaluates active organization rules against task mutations, executes batch task updates, and generates downloadable compliance audit digests.
4. **`webrtc-turn-and-scribe` (Ephemeral TURN/ICE Credentials & Audio Transcription)**:
   - **Why Offload**: Corporate firewalls and symmetric NATs occasionally block direct P2P STUN connections on 1080p video calls, requiring dynamic ICE/TURN server configuration, and post-call audio recordings require server-side `gemini-3.5-transcribe` processing.
   - **Capabilities**: Issues low-latency ICE/STUN/TURN configuration payloads and processes uploaded meeting audio snippets into structured speaker transcripts and action items.

### C. Interactive Component & State Mapping

- **Landing Page Interactive Preview Tabs**: Clicking any of the 4 studio tabs (`Kanban`, `AI Co-Pilot`, `1080p Video Meet`, `Automations`) updates local preview state and allows visitors to interact with live sample tasks, trigger a sample AI breakdown, toggle simulated HD call layouts, or test an automation rule before clicking `Launch Workspace`.
- **Mobile Bottom Thumb-Bar & Slide-Over Sheets**:
  - Tapping `Overview`, `Projects`, `AI Co-Pilot`, or `Chat & Meet` switches `activeView` immediately with zero layout shift.
  - Tapping `More` opens a glassmorphic bottom sheet (`rounded-t-3xl`) providing 1-tap access to `Sprints`, `Calendar`, `My Tasks`, `Triggers & Rules`, `Inbox`, `Reports`, `Team Management`, `User Logs`, and `Profile Settings`.
- **Full-Stack Server Entry (`server.ts`)**: Mounts Express JSON routes (`/api/edge/ai-copilot`, `/api/edge/notifications`, `/api/edge/automations`, `/api/edge/webrtc-ice`) alongside Vite middleware in development and static `dist` serving in production on port 3000.
