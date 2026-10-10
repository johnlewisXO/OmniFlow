# Seamless Production Routing & Taskly Soft-Glass 32px Bento UI Redesign

This update establishes a seamless unauthenticated Landing-First routing pipeline with full bidirectional URL synchronization across all workspace views in production, paired with a comprehensive UI/UX transformation inspired by the **Taskly**, **Soft Glass**, **Krejo**, and **Mondays** reference designs featuring `32px` super-rounded bento architecture, concentric multi-ring completion gauges, pill KPI capsules, a live Meet/Chat/Timer bento row, a right-hand Calendar & Schedule rail, and a slide-over Task Inspector drawer.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> All core architectural and visual preferences from your clarification responses have been locked into this plan:

- **Confirmed Decision 1 — Always Show Landing Page First with Synced URL Routes**:
  - Unauthenticated users arriving at the application root (`/`, `#/`, or stale `#/app` without an active session or explicit login intent) or signing out are always routed to the **Landing Page** first.
  - Clicking **Log In** or **Start Free Workspace** transitions to `#/login` or `#/signup` with a prominent **Back to Home** navigation control so users are never trapped on the authentication screen.
  - Every authenticated workspace view synchronizes bidirectionally with clean URL routes (`#/app/overview`, `#/app/projects`, `#/app/kanban`, `#/app/sprints`, `#/app/my-tasks`, `#/app/chat`, `#/app/calendar`, `#/app/inbox`, `#/app/reports`, `#/app/team`, `#/app/automations`, `#/app/ai-copilot`, `#/app/profile`, `#/app/admin`), supported by browser Back/Forward history and production SPA fallback routing.
- **Confirmed Decision 2 — Taskly & Soft Glass Bento Aesthetic with `32px` Rounded Sections**:
  - Outer workspace shells, hero containers, and primary bento sections adopt `rounded-[32px]` (`2rem`) curvature with nested cards using mathematically proportioned `rounded-[24px]` (`1.5rem`) radii, soft glassmorphic translucency, and high-contrast pill-shaped active navigation states (`bg-slate-900 text-white dark:bg-indigo-500 rounded-full`).
- **Confirmed Decision 3 — Reference UI Widgets & Layout Patterns Across Dashboards & Boards**:
  - **Concentric Multi-Ring Project Completion Charts**: Multi-ring radial SVG gauge (`Done`, `In Progress`, `Backlog`) with rounded stroke caps (`strokeLinecap="round"`).
  - **Pill-Shaped KPI Capsules & Right-Hand Calendar/Schedule Rail**: Floating pill KPI counters (`rounded-full`) paired with an interactive monthly mini-calendar and daily schedule agenda rail.
  - **Inline Meet Preview, Team Chat, & Pastel Timer/Notes Bento Widgets**: Interactive bottom bento row on the workspace dashboard for instant 1080p video standup launch, quick team chat replies, a live Pomodoro/task focus timer (`20:00`), and quick sticky notes.
  - **Slide-Over Task Inspector Drawer on Board & List Views**: Clicking a task on the Kanban board or task list opens a sleek right-hand slide-over inspector drawer (`Mondays` style) with inline status/priority fields, assignee selector, description editor, and live comments thread.

---

## 1. Overview & Core Concept

- **What It Does**:
  1. Guarantees that unauthenticated visitors always experience the interactive **Omni Flow** Landing Page first before seeing the login/signup screen, while keeping every authenticated page, project board, and modal addressable via deterministic URLs in both development and production.
  2. Elevates the entire workspace UI into a cohesive `32px` super-rounded **Taskly & Soft Glass Bento** design system combining tactile pill controls, concentric radial charts, live collaboration bento widgets, and a non-disruptive slide-over task inspector.
- **Target Audience / Persona**: Executive Owners, Project Managers, Engineering & Design Contributors, and Client Viewers collaborating across desktop (`1440px+`) and mobile (`375px+`) viewports.
- **Key Value**: Eliminates routing dead-ends on first visit or sign-out, enables shareable deep links and browser history navigation across all 14 workspace modules, and brings executive metrics, video standups, team chat, focus timers, and task inspection into a unified, ultra-sleek bento workspace.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Unauthenticated Landing-First Flow**:
   - Visitor opens the production URL (`/`) $\rightarrow$ immediately lands on the **Landing Page** (even if a stale `#/app` hash existed from a prior logged-out tab, unless an active Supabase auth token/invite callback is in the URL).
   - Visitor explores interactive feature tabs and clicks **Log In** (`#/login`) or **Start Free Workspace** (`#/signup`) $\rightarrow$ `<AuthPage />` opens in the matching mode (`login` or `signup`) with a top-left **← Back to Home** pill button that returns to `/` in one click.
   - Upon sign-in or sign-up, the router transitions to `#/app/overview` (or the deep-linked target view).
   - Clicking **Sign Out** from the Sidebar or Header clears session state and immediately navigates to `#/` (Landing Page).
2. **Taskly & Soft Glass Bento Workspace Flow**:
   - **Sidebar & Header**: Floating `rounded-[32px]` glass sidebar with high-contrast dark/indigo pill active indicators (`rounded-full`), paired with a pill search bar (`⌘K`), live presence avatars, and segmented view switchers.
   - **Dashboard Bento Grid**:
     - **Top Pill KPI Capsules**: Horizontal row of `rounded-full` frosted capsules displaying *Active Projects*, *In-Flight Tasks*, *Completed Deliverables*, and *Team Members* with soft tinted icon badges.
     - **Center-Left Task Overview & Status Filter Pills**: Interactive segmented status pills (`To Do`, `In Progress`, `Under Review`, `Completed`) with `+` quick-add buttons and `rounded-[28px]` task cards featuring priority/due-date indicators, subtask progress, and avatar stacks.
     - **Concentric Multi-Ring Completion Gauge**: Dedicated `rounded-[32px]` analytics card rendering 3 concentric SVG progress rings (*Project Done %* in violet `#8B5CF6`, *In Progress %* in coral `#F97316`, *Backlog %* in sky blue `#38BDF8`).
     - **Bottom Collaboration Bento Row**:
       - **Meet Schedule Live Preview Card**: Shows next scheduled team sync with camera preview toggle, mic/cam quick states, and **Join Meet** button launching the 1080p WebRTC studio.
       - **Inline Team Chat Card**: Live message stream from the organization chat channel with an inline input box and instant **Send** button.
       - **Pastel Gradient Focus Timer & Quick Notes Stack**: Lavender-gradient interactive countdown/stopwatch timer (`20:00` with Start/Pause/Reset) stacked above a rose-gradient editable Sticky Notes card persisted to workspace storage.
     - **Right-Hand Calendar & Today's Schedule Rail**: Interactive month calendar grid with highlighted event dates and a chronological **Schedule** timeline with 1-click meeting join pills.
3. **Slide-Over Task Inspector Drawer (`Mondays` Pattern)**:
   - Clicking any task card in the **Kanban Board**, **My Tasks**, or **Dashboard Task Overview** opens a smooth right-hand slide-over inspector drawer (`rounded-l-[32px]`) alongside the board—allowing instant editing of title, assignee, due date, project, status, priority, description, and live comments without losing board context (with an expand button to open the full modal view when desired).

### Visual Identity & Theme
- **Aesthetic Direction**: **Taskly & Soft Glass Bento** — tactile super-rounded surfaces (`32px` outer containers, `24px` inner cards, `9999px` interactive filter pills), airy whitespace, soft lavender/pearl glass in Light Mode, and deep obsidian/indigo glass in Dark Mode.
- **Color Palette & Mood**:
  - *Light Mode Canvas*: Soft pearl-lavender ambient mesh (`#F4F3FB` $\rightarrow$ `#EEF2FF`) with crisp frosted white bento surfaces (`rgba(255, 255, 255, 0.86)`) and subtle `1px solid rgba(255, 255, 255, 0.9)` borders.
  - *Dark Mode Canvas*: Deep obsidian slate (`#0B0D17` $\rightarrow$ `#121526`) with translucent midnight glass (`rgba(22, 27, 46, 0.78)`) and `1px solid rgba(255, 255, 255, 0.08)` borders.
  - *Accent Tokens*: Primary Electric Violet (`#6957FF`), Coral Progress (`#F97316`), Sky Backlog (`#38BDF8`), Emerald Nominal (`#10B981`), and glossy Obsidian Pill (`#111827`).
- **Typography & Hierarchy**:
  - *Display & Headings*: `Plus Jakarta Sans` (SemiBold/ExtraBold, tight tracking `-0.025em`, `text-wrap: balance`).
  - *Body & Controls*: `Plus Jakarta Sans` / `DM Sans` with single-line button/tab labels (`whitespace-nowrap shrink-0`).
  - *Metrics, Timers & Counters*: `JetBrains Mono` / `tabular-nums` for zero layout jitter on live timers, ring percentages, and KPI capsules.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Deterministic Hash + Path Router with Unauthenticated Landing Guard**
  - *Chosen Approach*: Map every route (`#/` $\rightarrow$ Landing, `#/login` & `#/signup` $\rightarrow$ AuthPage with mode & Back-to-Home button, `#/app/<view>` $\rightarrow$ Authenticated Workspace views) and add an unauthenticated session guard so stale `#/app/*` URLs without an explicit login click or OAuth/email token automatically show the Landing Page first. Also configure Express `server.ts` to normalize clean pathname requests (`/login`, `/signup`, `/app/*`) into the SPA entry point.
  - *Why*: Guarantees zero 404s on refresh in Cloud Run production while ensuring first-time or signed-out users always see the Landing Page before the Login screen.
- **Decision 2: Unified `32px` Bento Radius Scale (`r_outer = 32px`, `r_inner = 24px`)**
  - *Chosen Approach*: Upgrade `.glass-panel`, `.glass-card`, sidebar shells, and dashboard bento containers to `rounded-[32px]` (`2rem`) and child cards to `rounded-[24px]` (`1.5rem`).
  - *Why*: Directly matches the soft, modern curvature of the **Taskly**, **Krejo**, and **Soft Lavender Dashboard** reference images while maintaining strict nested radius math ($r_{\text{inner}} = r_{\text{outer}} - \text{padding}$).
- **Decision 3: Slide-Over Task Inspector Drawer + Full Modal Option**
  - *Chosen Approach*: Provide a slide-over right-hand Task Inspector sheet (`w-full max-w-[460px] rounded-l-[32px]`) for rapid side-by-side task inspection and commenting on board/list views, while preserving the expand-to-modal toggle for deep editing.
  - *Why*: Matches the **Mondays** reference workflow so users can inspect and update multiple tasks rapidly without obscuring the board.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     Browser URL & Express Production Server                  │
│  / or #/ (Landing)  │  #/login & #/signup (Auth)  │  #/app/:view (Workspace) │
└──────────┬─────────────────────────┬────────────────────────────┬────────────┘
           │                         │                            │
           ▼                         ▼                            ▼
┌─────────────────────┐   ┌─────────────────────┐   ┌──────────────────────────┐
│    LandingPage      │   │      AuthPage       │   │      MainAppLayout       │
│  • Hero & Live Tabs │──▶│  • Mode: login/join │──▶│  • 32px Glass Sidebar    │
│  • Pricing & Edge   │◀──│  • "← Back to Home" │   │  • Pill Search Header    │
└─────────────────────┘   └─────────────────────┘   └─────────────┬────────────┘
                                                                  │
        ┌─────────────────────────────────────────────────────────┴──────┐
        ▼                                                                ▼
┌───────────────────────────────────────────┐   ┌──────────────────────────────┐
│     Taskly & Soft Glass Bento Hub         │   │  Kanban & Task List Views    │
│  • Pill KPI Capsules (rounded-full)       │   │  • Status Pill Switcher      │
│  • Concentric 3-Ring Completion Gauge     │   │  • 28px Task Cards           │
│  • Status Filter Pills + 28px Task Cards  │   │  • Right Slide-Over Task     │
│  • Live Meet Preview + Inline Team Chat   │   │    Inspector Drawer          │
│  • Pastel Focus Timer (20:00) & Notes     │   │    (Assignee, Status, Chat)  │
│  • Right-Hand Calendar & Schedule Rail    │   └──────────────────────────────┘
└───────────────────────────────────────────┘
```

### Interactive Component & State Mapping
- **Bidirectional URL Router (`App.tsx` & `useAppStore.ts`)**:
  - `setActiveView(view)` updates `window.location.hash = '#/app/' + viewSlug` when authenticated.
  - Browser `hashchange` and `popstate` listeners parse `#/app/:viewSlug` and update `activeView` in `useAppStore`.
  - `signOut()` clears user state and sets `window.location.hash = '#/'` so the user lands directly on the Landing Page.
  - Unauthenticated guard: if `!currentUser` and `currentRoute.startsWith('#/app')` without `explicitAuthIntent` or callback tokens (`access_token=`, `token_hash=`, `join-token=`), automatically route to `'/'` (Landing Page).
- **Concentric Multi-Ring Completion Chart**:
  - Computes real percentages from `tasks` (`DONE`, `IN_PROGRESS` + `REVIEW`, `TODO`) and renders three concentric `<circle>` arcs with `strokeLinecap="round"` and smooth stroke-dashoffset transitions.
- **Inline Meet, Chat, Timer & Notes Bento Widgets**:
  - **Meet Schedule Widget**: Reads upcoming meetings from calendar state and triggers the existing `omni_start_video_call` custom event to open the 1080p `VideoCallStudioModal`.
  - **Inline Team Chat Widget**: Reads/sends real organization messages via `supabaseService` / `collabService` and links to full `team_chat_view`.
  - **Focus Timer & Notes Widget**: Interactive `20:00` countdown timer (`Start`, `Pause`, `Reset`, `+5m`) with tabular numerals and an editable sticky note persisted to `localStorage`.
- **Slide-Over Task Inspector Drawer**:
  - Synchronizes directly with `taskToView` in `useAppStore`, supporting live status/priority dropdown changes, assignee reassignment, description auto-save, and real-time task comment posting.
