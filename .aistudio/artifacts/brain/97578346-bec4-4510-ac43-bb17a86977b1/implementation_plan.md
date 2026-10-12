# Workspace UI Simplification & Role-Tailored Dashboard Architecture

Streamline the entire platform interface by removing redundant header clutter, isolating top-nav presence to external teammates, consolidating secondary tools into an on-demand slide-over drawer, and restructuring dashboards into role-tailored, high-clarity Bento grids.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following design decisions were aligned and confirmed via interactive consultation:
> - **Dashboard Simplification Strategy**: Clean Bento layout displaying role-tailored, high-priority widgets only (reducing cognitive load for each specific role).
> - **Visual Aesthetics & Rounding**: Soft pill capsules, generous rounded cards (`28px`–`32px`), unified high-contrast charts, and single-elevation surfaces adhering to the Universal Frontend Design Constitution.
> - **Secondary Utilities Placement**: The removed tools (`Split`, `Huddle`, `Graph`, `Scratchpad`) will reside inside a discreet slide-over "Quick Utilities" drawer accessible from a single header button or Command Palette (`⌘K`), keeping the primary top bar clean and minimal.

- **Confirmed Decision 1**: Filter the header avatar stack to strictly exclude the current logged-in user, showing only *other* active team members in their organization.
- **Confirmed Decision 2**: Remove the four static button clusters (`◫ Split`, `🎧 Huddle`, `🕸️ Graph`, `📓 Scratchpad`) from the header top bar.
- **Confirmed Decision 3**: Deliver role-specific dashboard views: Executive/Owner (Portfolio & Goals), Project Manager (Sprint Velocity & Workload), Member/Engineer (My Tasks & Focus), Admin (Governance & Directory), and Client (Milestones & Deliverables).

---

## 1. Overview & Core Concept

### What It Does
1. **Header Cleanup & Organization Teammates Isolation**: Refactors the top navigation bar into a clean 3-zone contract. The presence avatar stack strictly excludes the current logged-in user, showing only other teammates currently active in the organization.
2. **Header Decluttering**: Eliminates the four bulky utility buttons (`Split`, `Huddle`, `Graph`, `Scratchpad`) from the top navigation bar. In their place, a single sleek `⚡ Quick Utilities` icon button opens an animated slide-over drawer housing these multitasking tools.
3. **Role-Tailored Bento Dashboards**: Restructures `TasklyBentoWorkspaceHub` so each user role (`OWNER`, `ADMIN`, `PROJECT_MANAGER`, `MEMBER`, `CLIENT_VIEWER`) receives an intentional, uncluttered view of only the metrics and widgets relevant to their daily workflow.
4. **Visual Polish & Anti-Clutter Pass**: Refactors card geometry across all pages to generous 28px/32px super-rounded corners, clean hairline borders (`border-white/10` in dark mode, `border-slate-200/80` in light mode), unboxed text metadata, and unified interactive charts.

### Target Audience & Persona Workflows
- **Owner / Executive**: High-level portfolio progress, company delivery velocity, OKR rollups, and macro financial/time metrics without individual ticket clutter.
- **Project Manager**: Sprint burndown trajectory, column WIP bottlenecks, team capacity balance, and milestone delivery dates.
- **Engineer / Member**: "My Assigned Tasks" priority queue, integrated focus timer, active sprint items, and recent review requests.
- **Admin**: Member provisioning, security audit events, seat allocations, and RBAC matrix governance.
- **Client / Stakeholder**: Milestone roadmap, completed deliverables, and review items without internal agile overhead.

---

## 2. Technical Architecture & Component Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             TOP NAVIGATION BAR                              │
│ ┌──────────────────────┐  ┌─────────────────────────┐  ┌──────────────────┐ │
│ │ Project Breadcrumb / │  │ Teammates Presence (Ex- │  │ Single Utilities │ │
│ │ Search Command (⌘K)  │  │ cludes Current User)    │  │ Drawer + Profile │ │
│ └──────────────────────┘  └─────────────────────────┘  └─────────┬────────┘ │
└──────────────────────────────────────────────────────────────────┼──────────┘
                                                                   │ (Click)
                                                                   ▼
                                          ┌───────────────────────────────────┐
                                          │     QUICK UTILITIES DRAWER        │
                                          │ ┌───────────┐       ┌───────────┐ │
                                          │ │ ◫ Split   │       │ 🎧 Huddle │ │
                                          │ └───────────┘       └───────────┘ │
                                          │ ┌───────────┐       ┌───────────┐ │
                                          │ │ 🕸️ Graph   │       │ 📓 Notes  │ │
                                          │ └───────────┘       └───────────┘ │
                                          └───────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         ROLE-TAILORED BENTO CANVAS                          │
│                                                                             │
│  [Role KPI Strip: 4 Focused Tabular Metric Capsules with Icons & Trends]     │
│                                                                             │
│  ┌───────────────────────────────┐     ┌──────────────────────────────────┐ │
│  │ Primary Role Module           │     │ Secondary Role Module            │ │
│  │ (e.g. My Tasks Queue for      │     │ (e.g. Velocity Gauge for PM;     │ │
│  │ Members; Portfolio for Execs) │     │ OKR Progress for Execs)          │ │
│  └───────────────────────────────┘     └──────────────────────────────────┘ │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Compact Strategic Quick-Nav (Docs, Whiteboard, Heatmap, Triage)        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Implementation Phases & Scope

### Phase 1: Header Decluttering & Logged-In User Filtering
- **File**: `components/layout/Header.tsx`
- **Actions**:
  1. Filter `uniquePresences` to explicitly exclude `p.userId === currentUser.id` and email matches with `currentUser.email`. Ensure the tooltip reads "Other active teammates in [Org Name]".
  2. Remove the inline `Next-Gen Spatial Multitasking & UX Quick Bar` containing `◫ Split`, `🎧 Huddle`, `🕸️ Graph`, and `📓 Scratchpad`.
  3. Introduce a compact, elegant icon button (`SparklesIcon` or `Squares2X2Icon`) with tooltip "Quick Utilities & Tools" that opens the slide-over drawer.
  4. Ensure the Top Navigation adheres strictly to the single-row, three-zone contract with clean hairline borders and no overflowing badges.

### Phase 2: Slide-Over Quick Utilities Drawer
- **Files**: `components/layout/Header.tsx`, `components/shared/QuickUtilitiesDrawer.tsx`
- **Actions**:
  1. Create a dedicated `QuickUtilitiesDrawer` component with an animated backdrop and slide-over panel.
  2. House the 4 secondary tools with rich descriptions, keyboard shortcuts, and launch buttons:
     - **Split Dual-Pane Multitasking** (`⌘\`)
     - **Ambient Voice & Screen Huddle**
     - **Knowledge Backlinks & Graph**
     - **Personal Scratchpad & Quick Notes** (`⌘J`)
  3. Ensure each button cleanly dispatches the existing window custom events (`omni_toggle_split_pane`, `omni_toggle_ambient_huddle`, `omni_toggle_knowledge_graph`, `omni_toggle_scratchpad`).

### Phase 3: Role-Tailored Dashboard Bento Layouts
- **File**: `components/dashboards/TasklyBentoWorkspaceHub.tsx`
- **Actions**:
  1. Define curated default widget sets and order per role:
     - **Owner / Exec**: `['project_status', 'calendar_schedule', 'task_overview', 'team_chat']`
     - **Project Manager**: `['project_status', 'task_overview', 'calendar_schedule', 'team_chat']`
     - **Member / Engineer**: `['task_overview', 'focus_timer_notes', 'team_chat', 'calendar_schedule']`
     - **Client / Viewer**: `['project_status', 'calendar_schedule', 'task_overview']`
  2. Remove noisy micro-labels, redundant headers, and decorative pulsing dots.
  3. Simplify the top KPI strip into 4 crisp, non-cluttered capsules with clear icons, tabular numbers, and clean sub-labels.
  4. Polish the bottom strategic module cards to be sleek, unified 1-line cards with clear icons and metric badges.

### Phase 4: Across-the-Board UI Simplification & Roundness Alignment
- **Files**: `components/tasks/KanbanBoard.tsx`, `components/reports/ReportsPage.tsx`, `components/team/TeamManagementPage.tsx`
- **Actions**:
  1. Standardize card and container border radius to generous `rounded-[28px]` or `rounded-[32px]` for major sections and `rounded-2xl` for child items.
  2. Verify that metadata uses clean unboxed text rather than layered pill badges.
  3. Ensure dark mode surfaces consistently use True Obsidian Black (`#050507` / `#0C0C10`) with `border-white/10`, and light mode surfaces use Studio Alabaster (`#F4F4F6` / `#FFFFFF`) with `border-slate-200/80`.

---

## 4. Verification & Testing Plan

1. **Top Nav Avatar Stack Verification**:
   - Verify that when logged in as user `A`, user `A`'s own avatar does NOT appear in the top-nav avatar stack.
   - Verify that other active members from the same organization appear with live presence dots.
2. **Header Tool Buttons Check**:
   - Confirm that the buttons `◫ Split`, `🎧 Huddle`, `🕸️ Graph`, and `📓 Scratchpad` are no longer in the header bar.
   - Confirm that clicking the Quick Utilities button opens the slide-over drawer and each action triggers its corresponding feature.
3. **Role-Based Dashboard Check**:
   - Switch user roles (e.g. Owner vs Member vs PM vs Client) and verify that the dashboard rearranges to display only relevant widgets and KPIs without clutter.
4. **Compilation & Responsive Check**:
   - Run `compile_applet` to ensure zero TypeScript or bundling errors.
   - Verify layout on mobile (<768px), tablet (768px-1024px), and desktop (>1024px).
