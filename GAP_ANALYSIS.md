# UI/UX Modernization & Liquid Glass Gap Analysis (`GAP_ANALYSIS.md`)

> **Phase 0 Audit — Read-Only Planning Artifact**
> Ranks every gap between `CURRENT_STANDARDS.md`, the User's Direct Requests (Button Unification, Header Context & Org Logo, Broad Liquid Glass Refinement), and Target Design Rules A–H by **User Impact** and **Effort**, mapped to a safe 5-phase delivery plan.

---

## 1. Direct User Requirements Audit

### 1.1 Button System Unification (Screenshots `image_4d806b3e`, `image_3c37fee8`, `image_eba548cf`)
- **Observed Root Causes:**
  1. **Fragmented Implementation Ratio:** Only **205** actions use the shared `<Button>` (`components/shared/Button.tsx`), while **450 raw `<button>` tags** bypass it completely with ad-hoc Tailwind classes.
  2. **Flat Non-Glass Row Actions (`image_eba548cf.png` / `InboxPage.tsx:467-495`):** Quick-action buttons (`→`, `✓`) use `p-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)]` — flat static boxes lacking `.glass-bubble-control` refraction, top-left specular rim, consistent radius (`rounded-xl` vs. `rounded-full`), `motion.button` spring tap feedback, and `focus-visible` halo.
  3. **Solid Primary Pills vs. Glass Accent Buttons (`image_4d806b3e.png` & `image_3c37fee8.png`):** Header `+` CTA and `<Button variant="primary" | "lime">` render flat/semi-flat accent backgrounds whose luminance/hover highlights differ from raw `<button>` pills (`bg-[#191B17] dark:bg-[#CCF048]` in `Avatar.tsx`, `EmailOutboxAndVerifyModal.tsx`, `CreateOrJoinOrganizationModal.tsx`). Hover/focus-visible/active/disabled/loading states vary widely per view.
  4. **Inconsistent Legacy Button Styles:** Off-palette colors (`bg-slate-800`, `border-slate-700`, `bg-[#191B17]`, `#CCF048` ignoring non-Aurora themes like Ocean/Violet/Ember) break palette cohesion whenever users switch themes.
- **Target State:** Extend `<Button>` + create an `<IconButton>` / `<GlassButton>` variant family supporting normalized **Glass** surfaces across `primary` (luminous specular accent glass), `lime` (adaptive highlight accent), `secondary` (Glass 3 frosted), `outline` (`glass-bubble-control`), `ghost` (glass hover bloom), and `danger` (translucent crimson glass) — with unified spring micro-physics (`GLASS_SPRING.micro`), `loading` spinner state, minimum accessible focus-visible rings, and elimination of off-palette hardcoded hex overrides on workspace controls.

### 1.2 Header Title Rule & Owner/Admin Organization Logo Upload
- **Observed Gaps:**
  1. **Company Name Leak in Header (`Header.tsx:213-217`):** When no project or task is open, `Header.tsx` currently displays `currentOrganization?.name || 'Personal Workspace'` alongside a generic `BuildingOfficeIcon`.
  2. **Header Title Truncation & Mobile Safety:** Long task or project titles need strict `min-w-0 flex-1` + `truncate` containment on both desktop bezel shoulder and compact `< lg` mobile header so utility buttons and centered tabs never collide or clip.
  3. **Missing Organization Logo Support:**
     - `types.ts` (`Organization`) lacks `logo_url` / `logoUrl`.
     - `server.ts` (`/api/organizations`, `/api/organizations/:id`) and `services/supabaseService.ts` do not persist or upload an organization logo (though `supabaseService.uploadAvatar` already proves the storage-bucket + Base64 fallback pattern).
     - `AdminDashboard.tsx` (`Governance & Defaults`) and `OwnerDashboard.tsx` do not provide an Owner/Admin logo uploader (`PNG`, `JPG/JPEG`, `WebP`, `SVG`, size/format validation, preview, remove/reset).
     - `Sidebar.tsx` (`275-287`) hardcodes an `OF` monogram box instead of rendering the organization's uploaded logo (keeping a crisp fallback mark if no logo is set), and `Header.tsx` does not display the org logo when outside a project/task.

### 1.3 Platform-Wide Liquid Glass Refinement
- **Observed Gaps:**
  - `EditorialUI` and `LiquidGlass` establish a strong 4-level optical system, but legacy views (`TaskCard.tsx`, `KanbanColumn.tsx`, `TaskListView.tsx`, `GanttTimelineView.tsx`, `TeamManagementPage.tsx`, `ProfileSettingsPage.tsx`, `TeamsChatPage.tsx`, `CreateOrJoinOrganizationModal.tsx`) mix raw `bg-slate-800/900` / `bg-white` / `bg-[var(--bg-surface)]` opaque boxes with glass panels, creating visual "seams".
  - `Sidebar.tsx` still displays the hardcoded `OF` badge + `APP_TITLE` instead of integrating the uploaded org logo cleanly.
  - Popover/dropdown layers inside `ReportsPage`, `CreateOrJoinOrganizationModal`, `Avatar` hover cards (`bg-slate-900/95` hardcoded slate instead of `.editorial-popover`), and `TaskDetailsModal` bypass `.editorial-popover` / `.glass-level-3` / `.glass-level-4`.

---

## 2. Systematic Gap Analysis vs. Target Rules (A–H)

| Rule / Domain | Current State | Gap & Risk | Priority (Impact × Effort) |
| :--- | :--- | :--- | :--- |
| **User Req 1: Unified Glass Button System** | 205 `<Button>` vs 450 raw `<button>`; flat row actions (`InboxPage`); hardcoded `#191B17`/`#CCF048`/`bg-slate-*` buttons ignore selected OKLCH palette. | Visual inconsistency, missing spring press/focus states, weak glass identity on controls. | **Critical Impact × M Effort** |
| **User Req 2: Header Context & Org Logo** | Header shows company name when idle; no `logo_url` field/upload for `OWNER`/`ADMIN`; Sidebar shows `OF` badge. | Violates explicit branding rule; missing org logo customization & clean idle header state. | **Critical Impact × M Effort** |
| **Rule A: Decision-First Dashboards** | Dashboards lead with KPIs, Focus Tasks, Health gauge & Heatmap, but multi-tab wrappers (`OwnerDashboard`, `AdminDashboard`) + `TeamManagementPage` contain dense forms mixed with telemetry, and KPI counts are scattered. | Users spend extra clicks hunting overdue/blocked items across tabs; action bar placement varies per dashboard. | **High Impact × M Effort** |
| **Rule B: Charts & PM Views** | **Direct Violation:** `ReportsPage.tsx:814` and `GanttTimelineView.tsx:468` render **Recharts `<PieChart>` / Donut** (`innerRadius/outerRadius`). `EditorialCharts.tsx` also defines `RadialProgressRing` & `RadialHealthTickArc` (semi-circle gauge). | Pie/donut/radial gauges violate Rule B ("Strictly avoid pie/donut charts, 3D charts, gauges"). *Note: Precedence check needed in Open Questions regarding the Nova circular ring & tick arc.* | **High Impact × S/M Effort** |
| **Rule C: Visual System & Anti-Nesting** | OKLCH CSS tokens exist (`index.css`), but legacy dark/light surfaces use hardcoded `slate-*` or `#CCF048` (`Avatar.tsx`, `CreateOrJoinOrganizationModal.tsx`, `SystemLogMonitorModal.tsx`, `GanttTimelineView.tsx`). | Split-theme mismatch when switching Ocean/Ember/Violet/Forest/Mono palettes; subtle nested border stacks. | **High Impact × M Effort** |
| **Rule D: Mobile-First Responsive (320px+)** | Kanban, Gantt timeline, Workload tables, and Whiteboards use fixed min-widths (`min-w-[680px]` etc.) requiring horizontal scroll without mobile card fallbacks; header tab bar overflows on narrow phones; touch targets `< 44px` on `sm` icon buttons (`h-8`, `p-1.5`, `32px`). | Cramped touch hitboxes (`< 44px`) on mobile & horizontal table overflow under 480px. | **High Impact × L Effort** |
| **Rule E: WCAG 2.2 AA Accessibility** | Missing `<main>` landmark & "Skip to content" link; modals/drawers lack keyboard focus trapping; clickable `<div onClick>` cards (Inbox rows, Task cards) lack `button`/link semantics & keyboard activation; missing ARIA live region for async toasts/filters; raw `window.confirm` in 3 task files. | Keyboard & screen-reader blockers; WCAG 2.2 AA non-compliance on modals, interactive rows, and touch focus rings. | **Critical Impact × M Effort** |
| **Rule F: States, Error & Destructive Safety** | Loading uses coarse pulse skeletons; partial/offline sync status isn't surfaced as a structured retry banner; `TaskCard`/`TaskListView`/`TaskDetailsModal` call `window.confirm()`; read-only `CLIENT_VIEWER` screens lack standardized empty/no-permission explanations across some subviews. | Abrupt native browser confirm dialogs (violates runtime iframe best practices & UX), missing inline retry/no-permission banners. | **High Impact × S Effort** |
| **Rule G: Interaction Patterns** | `CommandPalette`, Undo store (`triggerUndo`), drag-and-drop & segmented tabs work, but URL query params don't always sync active filter/sort state; table rows lack unified bulk-selection glass bars; inline edit states lack standardized save/cancel affordances. | Filter/sort state lost on refresh; inconsistent bulk actions between TaskListView and Kanban. | **Medium Impact × M Effort** |
| **Rule H: Performance & Quality Gates** | Pre-existing `tsc --noEmit` errors in 10 files (`ReportsPage.tsx`, `CommandPalette.tsx`, `WhiteboardStudioPage.tsx`, `hooks/useAppStore.ts`, `automationEngine.ts`, etc.). No component stories (`Button`, dashboards, forms), no automated keyboard/axe/visual checks, no `React.lazy` code splitting on heavy routes (`Whiteboard`, `Reports`, `VideoCall`). | Bundle size bloat (Recharts + AI + Whiteboard eagerly loaded), undetected TypeScript regressions, unverified a11y. | **High Impact × M Effort** |

---

## 3. Ranked Implementation Backlog (Impact × Effort)

| Rank | Deliverable | Impact | Effort | Phase |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Replace `window.confirm()` with styled Liquid Glass Confirm / Undo Toast flows & add `<main>` + Skip link + Modal Focus Trap + Focus Rings | Critical | S/M | Phase 1 |
| 2 | Resolve pre-existing `tsc --noEmit` errors & establish clean baseline (`npm run lint`) | Critical | S | Phase 1 |
| 3 | Unify Button & IconButton Liquid Glass Design System across `<Button>` + 450 raw `<button>` instances | Critical | M | Phase 2 |
| 4 | Header Title Context Fix + Owner/Admin Organization Logo Upload (`OWNER`/`ADMIN` only, `PNG/JPG/WebP/SVG`) + Sidebar & Header Logo display | Critical | M | Phase 2 |
| 5 | Purge hardcoded `slate-*` / `#CCF048` / `#191B17` legacy button/card overrides across Inbox, Avatar hover cards, Modals, Team, Automations, and Reports | High | M | Phase 3 |
| 6 | Upgrade Charts & PM Views for Rule B compliance (replace `<PieChart>` donuts with horizontal stacked/bullet/bar comparisons) & glass chart framing | High | S/M | Phase 3 |
| 7 | Mobile-First 320px+ Reflow, `>= 44px` touch targets on `< lg`, and table-to-card/timeline adaptations + complete Loading/Empty/Error/No-Permission states | High | L | Phase 4 |
| 8 | Lazy route splitting (`React.lazy`), automated Playwright + axe-core + keyboard checks across key views | High | M | Phase 5 |

---

## 4. Phased Delivery Plan (Feature-Flagged & Reversible)

- **Phase 1 — Foundation, Accessibility & Baseline Hygiene** *(Next upon approval)*
  - Add `<main id="main-content">`, Skip-to-Content link, accessible focus trapping in `Modal.tsx` & `QuickUtilitiesDrawer.tsx`, and standardized `:focus-visible` ring tokens (`>= 3:1` contrast in Light & Dark across all 6 palettes).
  - Replace all 3 `window.confirm()` calls (`TaskCard`, `TaskListView`, `TaskDetailsModal`) with an accessible Glass Confirm Dialog / Undo Toast flow.
  - Fix pre-existing TypeScript errors reported by `tsc --noEmit` so CI lint passes cleanly before touching components.
- **Phase 2 — Unified Glass Button System, Header Context & Organization Logo**
  - Upgrade `components/shared/Button.tsx` (adding unified `IconButton`, loading spinner state, adaptive glass highlights, spring physics, and touch-safe sizing on `< lg`).
  - Sweep high-traffic components (`InboxPage`, `Header`, `Sidebar`, `Avatar`, `ProfileMiniMenu`, `AdminDashboard`, `OwnerDashboard`, `TaskCard`, `TaskDetailsModal`, `MyTasksPage`, `CreateOrJoinOrganizationModal`) migrating ad-hoc `<button>` pills/squares onto shared `<Button>` / `<IconButton>`.
  - Add `logo_url` to `Organization` (`types.ts`), `/api/organizations/:id/logo` or PATCH support (`server.ts`), `supabaseService.uploadOrganizationLogo` (`services/supabaseService.ts`), Owner/Admin upload control (`AdminDashboard.tsx` Governance + `OwnerDashboard.tsx`), Sidebar brand display (`Sidebar.tsx`), and Header rule (`Header.tsx`: **never** show company name; show uploaded org logo when idle, and ONLY truncated task/project title when active).
- **Phase 3 — Broad Liquid Glass Refinement, Theme Purity & Rule B Charts**
  - Replace hardcoded `slate-*` / `#CCF048` / `#191B17` styles in workspace components (`Avatar.tsx`, `SystemLogMonitorModal.tsx`, `EmailOutboxAndVerifyModal.tsx`, `CreateOrJoinOrganizationModal.tsx`, `GanttTimelineView.tsx`, etc.) with adaptive CSS variable tokens (`--surface-glass-*`, `--accent-*`, `.editorial-popover`).
  - Replace Recharts `<PieChart>` donuts (`ReportsPage.tsx`, `GanttTimelineView.tsx`) with horizontal bar/stacked distribution bars paired with tabular numerals and glass tooltips (pending Open Question confirmation for `RadialProgressRing` / `RadialHealthTickArc`).
- **Phase 4 — Mobile-First Responsiveness (320px+), Empty/Error/Permission States & Keyboard Rows**
  - Ensure all `< lg` interactive controls meet `44×44px` hit areas, optimize `Header` & `MobileBottomNav` height budget (`<= 15%` viewport), convert `InboxPage` & task rows from clickable `<div>`s to semantic interactive elements, and enforce standardized Skeleton / Empty / Error-Retry / No-Permission states across views.
- **Phase 5 — Code Splitting & Verification Harness**
  - Lazy-load heavy views (`WhiteboardStudioPage`, `ReportsPage`, `VideoCallStudioModal`, `AsyncClipsStudioPage`, `AIProjectManagerStudio`) behind `<Suspense>` glass skeletons.
  - Run full verification: `npm run lint` (`tsc --noEmit`), `npm run build`, headless Chromium visual/layout/contrast/keyboard & axe checks across Light + Dark and 3+ palettes on desktop `1440px` and mobile `375px`.
