# Current Standards & Codebase Audit (`CURRENT_STANDARDS.md`)

> **Phase 0 Audit — Read-Only Snapshot**
> **Application:** Omni Flow (AI-Powered Enterprise Work Management Platform)
> **Precedence Rule:** Every standard marked **`BINDING`** is an established user/product requirement or working invariant that must be preserved unless explicitly superseded with user approval.

---

## 1. Tech Stack & Runtime Architecture
- **Frontend:** React `19.1.0`, TypeScript `~5.8.2`, Vite `6.2.0` (`@vitejs/plugin-react`).
- **Backend / Dev Server:** Express `5.2.1` (`server.ts`, running via `tsx server.ts` on port `3000`, mounting `vite.middlewares` in dev).
- **State & Storage:** Zustand-style unified store in `hooks/useAppStore.ts` (`2,500+` lines) backed by Supabase (`@supabase/supabase-js` `2.45.0`), `/api/*` Express endpoints + `.data/` JSON persistence (`user_roles.json`, `join_requests.json`, `organizations.json`, `billing_sandbox.json`), and `localStorage` offline/extension caches.
- **Animation & Charts:** Motion (`motion/react` `14.14.0`), Recharts `3.8.1`, `date-fns` `4.1.0`, `lodash` `4.17.23`, `react-mentions` `4.4.10`, `@google/genai` `1.46.0` (server-side AI routes in `server.ts`).
- **CSS Pipeline:** Tailwind CSS loaded via CDN (`https://cdn.tailwindcss.com`) with inline `tailwind.config` in `index.html`, paired with global design tokens and 4-layer Liquid Glass classes in `index.css`.

---

## 2. Brand, Aesthetic & Theme System

### 2.1 Established Visual Language (`BINDING`)
- **Nova Sculpted Bezel + Liquid Glass Shell:** Outer hardware-inspired dark bezel frame (`.nova-bezel-frame`) wrapping a rounded workspace stage (`.nova-workspace-shell`, `lg:rounded-[26px]`) with inline SVG S-curve bezel header dock (`Header.tsx`) and floating frosted glass sidebar rail (`Sidebar.tsx`).
- **OKLCH Adaptive Atmosphere (`utils/liquidGlassTheme.ts` + `index.css`):**
  - 6 curated adaptive palettes configured in `types.ts` (`WORKSPACE_ACCENT_PRESETS`) and generated dynamically via OKLCH CSS `@property` tokens:
    1. **Aurora (`lime`)** — Sage mist, botanical light & volt lime (`#4E6B24` light / `#CCF048` dark / `#34372F` bezel) — **Default Brand Identity** (`BINDING`).
    2. **Ocean (`cobalt`)** — Glacier mist, marine slate & crisp azure.
    3. **Ember (`terracotta`)** — Sandstone haze, desert dusk & burnt amber.
    4. **Forest (`emerald`)** — Mineral pine canopy, dew mist & jade.
    5. **Violet (`plum`)** — Twilight iris, deep indigo haze & amethyst.
    6. **Mono (`amber`)** — Architectural stone, graphite & pure glass.
  - **Dual Mode:** Light mode (calm warm stone base `#F4F5F0`) and Dark mode (`html.dark`, deep obsidian canvas `#0E1117`).
  - **Ambient Intensity:** 3 selectable levels (`subtle`, `balanced`, `vivid`) driving atmospheric corner fields (`--ambient-primary`, `--ambient-secondary`, `--ambient-tertiary`) while keeping the central 60–75% canvas calm.
  - **Auto-Cycle Toggle:** Daily (24-hour) automatic palette transition persisted in user preferences (`autoCyclePalette`).
- **4-Level Liquid Glass Depth Scale (`index.css`):**
  - **Glass 0:** `.sage-lime-ambient-mesh` + `.ambient-field-primary/secondary` (slow 32s–38s subtle atmospheric drift).
  - **Stage Veil:** `.frosted-shell-panel` (low-opacity neutral veil, pointer glint `--glint-x/--glint-y`, avoids double-blurring nested content).
  - **Glass 1:** `.glass-level-1`, `.frosted-rail-panel` (`blur(14px) saturate(120%)`) for navigation rail.
  - **Glass 2:** `.glass-level-2`, `.editorial-surface`, `.liquid-bezel-section`, `.liquid-glass-card` (`blur(20px) saturate(120%)`) for cards/panels with 135deg top-left specular rim mask (`::before`).
  - **Glass 3:** `.glass-level-3`, `.glass-bubble-control` (`blur(18–24px)`) for floating controls and tactile bubble buttons.
  - **Glass 4:** `.glass-level-4`, `.editorial-popover`, `.liquid-glass-overlay`, `.command-palette-surface` (`blur(28–36px)`) for popovers, modals, drawers, and Command Palette.
- **Anti-Nesting Class:** `.editorial-surface-subtle` (hairline wash with zero extra `backdrop-filter`).

### 2.2 Logo & Header Context Rules
- **Logo Assets Currently Observed:**
  - Sidebar renders a monogram square (`OF`) + `APP_TITLE` (`Omni Flow`) + `currentOrganization?.name`.
  - Top Header currently displays `currentOrganization?.name || 'Personal Workspace'` when no project/task is active (`Header.tsx:213-217`), with a `BuildingOfficeIcon`.
  - Organization type (`types.ts:258-274`) currently has `id`, `name`, `slug`, `domain`, `corporateDomain`, `defaultSprintDurationDays`, `settings`, etc. — **no `logo_url` / `logoUrl` field exists yet**, and `supabaseService.ts` has `uploadAvatar(userId, file)` (avatars bucket + Base64 fallback) but no `uploadOrganizationLogo` helper or logo persistence field in `server.ts`.
- **New `BINDING` User Requirement for Header & Logo:**
  1. Top header must **never** display the company/organization name text.
  2. When **inside a task or project**, top header displays **only the task title or project name**, truncated cleanly and mobile-friendly.
  3. Owners (`OWNER`) and Admins (`ADMIN`) must be able to **upload an organization logo** (validated image formats), displayed in the **Sidebar** AND in the **Top Header (only when NOT inside a project/task)**.

### 2.3 Typography, Spacing, Radii, Shadows & Icons
- **Fonts (`index.html` + `index.css`):**
  - Headings (`h1–h6`): `"Plus Jakarta Sans"` (`letter-spacing: -0.025em`, `text-wrap: balance`).
  - Body Prose: `"DM Sans"` (`0.875rem` / `14px` base, `line-height: 1.5`, `letter-spacing: -0.008em`).
  - Numeric / Telemetry / Mono: `"JetBrains Mono"` via `.font-mono` and `.tabular-nums` (`font-variant-numeric: tabular-nums`).
- **Radii Scale:**
  - Outer Shell: `26px` (`lg:rounded-[26px]`).
  - Panels/Cards: `20px` (`rounded-[20px]`, `rounded-2xl`).
  - Modals/Sheets: `24px` (`rounded-[24px]`).
  - Nested Subtle Boxes: `16px` (`rounded-2xl` / `.editorial-surface-subtle`).
  - Popovers: `18px` (`rounded-[18px]`).
  - Inputs: `12px` (`rounded-[12px]`).
  - Controls/Tabs/Buttons: Pill `rounded-full` (standard `<Button>` & `SegmentedTabs`) or `rounded-xl` (some ad-hoc icon buttons).
- **Icon Set:** Custom SVG library in `constants.tsx` (`ICON_MAP`, Heroicons v2 outline/solid style inline SVGs).
- **Motion System (`components/shared/LiquidGlass.tsx`):** Calibrated `GLASS_SPRING` presets (`micro`, `snappy`, `spatial`, `morph`, `collapse`, `viewSwap`, `scrim`) wrapped in root `<MotionConfig reducedMotion="user">`.

---

## 3. Component Inventory (`components/`)

| Category | Component / File | Role & Observed Implementation Status |
| :--- | :--- | :--- |
| **Core Actions & Primitives** | `shared/Button.tsx` | Canonical `<Button>` (`motion.button`, `rounded-full`, variants: `primary`, `lime`, `secondary`, `outline`, `ghost`, `danger`; sizes: `sm`, `md`, `lg`, `icon`; tap `scale: 0.96`). Used **205 times across 34 files** vs. **450 raw `<button>` tags**. |
| **Layout & Glass** | `shared/LiquidGlass.tsx` | `LiquidGlassShell`, `GlassSurface`, `GlassBubble`, `FluidCollapse`, `GlassPopoverContainer`, `AnimatedViewStage`, `FloatingGlassDock`. |
| **Editorial UI** | `shared/EditorialUI.tsx` | `PageHeader`, `InlineKpiStrip`, `SegmentedTabs` (uses `motion.span layoutId`), `HairlineCard`, `LiquidBezelSection`, `SlideOverDrawer`, `StatusDot`. |
| **Overlays & Navigation** | `shared/Modal.tsx`, `shared/QuickUtilitiesDrawer.tsx`, `layout/CommandPalette.tsx`, `layout/Header.tsx`, `layout/Sidebar.tsx`, `layout/MobileBottomNav.tsx`, `layout/ProfileMiniMenu.tsx` | `AnimatePresence` + `GLASS_SPRING` animated modals/drawers/popovers. Header bezel uses inline SVGs; Sidebar uses hover-to-expand + pin toggle; MobileBottomNav provides bottom dock + "More" sheet. |
| **Identity & Presence** | `shared/Avatar.tsx`, `shared/TaskLivePresenceBadge.tsx`, `projects/ProjectLiveCollabBar.tsx`, `layout/AmbientHuddleBar.tsx` | Avatar with `xs/sm/md/lg`, rich portal hover card with live status & direct call/DM buttons (contains raw buttons with hardcoded `#191B17` / `#CCF048`). |
| **Charts** | `charts/EditorialCharts.tsx` | `RadialProgressRing`, `RadialHealthTickArc` (32-tick gauge), `HatchedActivityHeatmap`, `SlimProgressBar`, `MilestonePhaseTimeline`, plus Recharts (`BarChart`, `AreaChart`, `PieChart`) inside `ReportsPage.tsx`, `GanttTimelineView.tsx`, `TeamWorkloadWidget.tsx`. |
| **Role Dashboards** | `dashboards/OwnerDashboard.tsx`, `AdminDashboard.tsx`, `ProjectManagerDashboard.tsx`, `MemberDashboard.tsx`, `ClientViewerDashboard.tsx`, `TasklyBentoWorkspaceHub.tsx` | Role-gated entry overview dashboards with tab navigation (`OwnerTab`, `activeAdminTab`), Billing Sandbox modal, KPI strips, and Bento widgets. |
| **Work & Delivery Views** | `projects/ProjectsOverviewPage.tsx`, `tasks/KanbanBoard.tsx`, `tasks/MyTasksPage.tsx`, `tasks/TaskListView.tsx`, `tasks/GanttTimelineView.tsx`, `sprints/SprintPlanningView.tsx`, `roadmap/GanttRoadmapPage.tsx`, `triage/TriageIntakePage.tsx` | Full multi-view task/project/sprint system; `TaskDetailsModal.tsx`, `CreateTaskModal.tsx`, `EditTaskModal.tsx`, `CreateProjectModal.tsx`. |
| **Comms, Strategy & Admin** | `inbox/InboxPage.tsx`, `chat/TeamsChatPage.tsx`, `chat/VideoCallStudioModal.tsx`, `calendar/CalendarMeetingsPage.tsx`, `team/TeamManagementPage.tsx`, `workload/WorkloadCapacityPage.tsx`, `reports/ReportsPage.tsx`, `okrs/OKRsGoalsPage.tsx`, `docs/ProjectDocsWikiPage.tsx`, `whiteboard/WhiteboardStudioPage.tsx`, `clips/AsyncClipsStudioPage.tsx`, `portal/ClientPortalChangelogPage.tsx`, `automations/TaskAutomationsDashboard.tsx`, `ai/AIProjectManagerStudio.tsx`, `ProfileSettingsPage.tsx`, `billing/BillingSandboxModal.tsx` | Rich module coverage across comms, AI, reporting, docs, whiteboard, async clips, and RBAC directory. |
| **Public / Auth** | `landing/*`, `auth/AuthPage.tsx`, `auth/CreateOrJoinOrganizationModal.tsx` | Landing page uses dark `#131511` / `#CCF048` Nova branding (`LandingHeader`, `HeroSection`, `PricingTierCard`, `LandingFooter`). |

---

## 4. Layout, Navigation & Breakpoints
- **Breakpoints:** Mobile `< 640px`, Tablet `sm/md` (`640px–1023px`), Desktop `lg+` (`1024px+`), Wide `xl`/`2xl` (`1280px+`, `1536px+`).
- **Desktop (`lg+`):** Nova outer bezel (`p-3 xl:p-3.5`) → Rounded shell → `Header` (62px bezel + inline S-curves + floating `SegmentedTabs` dock) → Flex row with collapsible `Sidebar` (`68px` rail / `256px` expanded in-flow push) + `.frosted-shell-panel` content stage (`rounded-[20px]`).
- **Mobile (`< lg`):** Compact top header with drawer hamburger, title, search/bell/CTA, scrollable horizontal `SegmentedTabs`, plus fixed bottom navigation (`MobileBottomNav`, `h-15` = 60px) with `More` bottom sheet. Main scroll container applies `pb-16 lg:pb-0` to avoid bottom nav overlap.

---

## 5. Naming, Structure, State, Data Formats & i18n
- **Folder Structure:** Flat root modules (`App.tsx`, `types.ts`, `constants.tsx`, `index.tsx`, `index.css`, `server.ts`), feature directories under `components/<domain>/`, unified Zustand store in `hooks/useAppStore.ts`, external & API services in `services/*`, pure helpers in `utils/*`.
- **Naming Conventions:** PascalCase `.tsx` components (`*Page.tsx`, `*Modal.tsx`, `*Widget.tsx`, `*Dashboard.tsx`), camelCase services (`*Service.ts`), Zustand hook (`useAppStore`), `UPPER_SNAKE_CASE` enums/constants (`TaskStatus`, `UserRole`, `ICON_MAP`).
- **State Management:** Single reactive store in `hooks/useAppStore.ts` managing auth/session, org, projects, tasks, sprints, notifications, real-time presence (`collabService`), UI toggles (`darkMode`, `accentColor`, `ambientIntensity`, `autoCyclePalette`, `isSidebarPinned`), timers, and undo snapshots (`lastUndoAction`).
- **Dates & Numbers:** Mix of `date-fns` (`format`, `formatDistanceToNow`, `isBefore`, `isToday`) and native `new Date(...).toLocaleDateString()` / `toLocaleTimeString()` across views. Numerals increasingly use `.tabular-nums` / `.font-mono`, though inconsistently on secondary tables/cards.
- **i18n:** English-only strings hardcoded inline across components; no `i18n` framework or locale formatting abstraction configured yet.

---

## 6. Accessibility, Testing, Linting & Critical Invariants

### 6.1 Accessibility Baseline
- **Present:** `aria-label` on icon buttons in Header/Modal/Sidebar/MobileNav; `role="dialog"` + `aria-modal="true"` + Escape close on `Modal.tsx` and `QuickUtilitiesDrawer.tsx`; `role="tablist"` / `role="tab"` + `aria-selected` in `SegmentedTabs`; `:focus-visible` outlines on `<Button>` and inputs; `@media (prefers-reduced-motion: reduce)` CSS overrides + `<MotionConfig reducedMotion="user">`.
- **Deficits Identified:**
  - **No semantic `<main>` landmark** inside the authenticated workspace (`App.tsx` renders a scrollable `<div>` instead of `<main id="main-content">`).
  - **No "Skip to main content" link** (`skip-to-content`).
  - **No focus trap** inside `Modal.tsx` / `QuickUtilitiesDrawer.tsx` / `MobileBottomNav` drawer (Escape works, but `Tab` escapes to background DOM).
  - **Inconsistent `focus-visible` rings** on raw `<button>` controls and clickable `<div>` rows (e.g., `InboxPage` notification rows use clickable `<div onClick>` instead of keyboard-accessible links/buttons).
  - **Native `window.confirm(...)` blocking dialogs** still present in `TaskCard.tsx:120`, `TaskListView.tsx:653`, and `TaskDetailsModal.tsx:396`.

### 6.2 Linting & Test Tooling
- `package.json` defines `"lint": "tsc --noEmit"` only — no ESLint, Stylelint, Prettier, Vitest, Playwright, or axe-core runner installed.
- Baseline `npm run lint` (`tsc --noEmit`) currently reports pre-existing type errors across `CommandPalette.tsx`, `ClientPortalChangelogPage.tsx`, `ReportsPage.tsx`, `EmailOutboxAndVerifyModal.tsx`, `GanttTimelineView.tsx`, `TaskListView.tsx`, `WhiteboardStudioPage.tsx`, `hooks/useAppStore.ts`, `services/automationEngine.ts`, and `services/meetingAndCallService.ts`.

### 6.3 Existing User Flows & Shortcuts That MUST NOT Break (`BINDING`)
- **Hash Routing & Auth Guard (`App.tsx`):** `/` (Landing-first unauthenticated guard), `#/login`, `#/signup`, `#/forgot-password`, `#/reset-password`, `#/app`, `#/app/<view-slug>`, OAuth/signup callback tokens (`access_token=`, `token_hash=`, `join-token=`, `invite=`).
- **Global Keyboard Shortcuts (`App.tsx:770-803`):**
  - `Cmd/Ctrl + K`: Toggle Command Palette
  - `C`: Quick Create Task modal (when not typing in inputs)
  - `B`: Toggle Sidebar / Mobile Drawer
  - `Escape`: Close top modal/drawer/popover
- **Core Workflows:** Role-based dashboards (`OWNER`, `ADMIN`, `PROJECT_MANAGER`, `MEMBER`, `CLIENT_VIEWER`), Organization search/join/create approval flow, Kanban drag-and-drop & task details modal, Undo banner/button (`lastUndoAction` / `triggerUndo`), Focus timer (`startTaskTimer`, `pauseTaskTimer`, `stopAndLogTaskTimer`), 6 Liquid Glass palettes + daily auto-cycle + light/dark mode + live availability sync across Header, Sidebar, and Profile Settings.
