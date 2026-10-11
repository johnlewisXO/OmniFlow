# Interactive Sidebar, Enriched Reports & Real-Time Collaborative Whiteboard Studio

## 1. Overview & Objectives
We will upgrade **Omni Flow** across three core areas based on your selections:

1. **Interactive, Reorderable & Badge-Driven Sidebar (`Sidebar.tsx`)**:
   - **Live Activity & Update Badges**: Real-time numeric counters and subtle pulse indicators for **Inbox** (unread notifications), **Team Chat** (recent unread messages), **My Tasks** (assigned active/due tasks), **Team Management** (recent team/role/invite updates), and **Triage & Intake** (queued triage items). Visiting a section automatically clears its transient "recent update" pulse while preserving live actionable counts.
   - **Pinned Favorites & Drag-and-Drop Reordering**: Star/pin any navigation item into a top **Favorites** section and drag-and-drop items to customize order (persisted per user in `localStorage` and user preferences).
   - **Collapsible Category Groups & Quick Filter**: Organize navigation into collapsible groups (**Workspace**, **Execution**, **Strategy**, **Admin**), add a compact **Quick Filter** input inside the sidebar, and render rich hover tooltips with badge counts when the sidebar is collapsed.

2. **Enriched Reports & Performance Analytics (`ReportsPage.tsx`)**:
   - **Advanced Interactive Charts**:
     - **Cumulative Flow & Velocity Area Chart**: Tracks To Do, In Progress, In Review, and Done trends over time.
     - **Sprint Burnup / Burndown & Story Point Velocity**: Compares ideal vs. actual remaining story points and completed velocity across sprints.
     - **Cycle Time & Priority Distribution**: Breakdown of task completion speed, bottlenecks, and workload efficiency per teammate.
   - **Interactive Chart Drill-Down**: Clicking any chart bar, pie slice, or data point opens an interactive **Drill-Down Task Drawer** filtering the exact tasks behind that metric so users can inspect or open them immediately.
   - **Customizable Report Widget Builder**: Toggle visibility, reorder report widgets, and compare time windows (`Last 7 Days`, `Last 30 Days`, `Last 90 Days`, `All Time`).
   - **Multi-Format Export Engine**: 1-click export of enriched analytics and task tables to **CSV**, **Excel (`.xls` Spreadsheet XML/TSV)**, **Structured JSON**, **Executive Markdown (`.md`)**, and **Print / PDF Snapshot**.

3. **Figma / FigJam-Style Real-Time Collaborative Whiteboard (`components/whiteboard/WhiteboardStudioPage.tsx`)**:
   - **Infinite Pan & Zoom Vector Canvas**: Smooth 60fps HTML5/SVG hybrid infinite canvas with grid/dot-matrix background, zoom controls (`25%–400%`), minimap/fit-to-screen, and keyboard shortcuts (`V` Select, `H` Hand/Pan, `F` Frame, `R` Rectangle, `O` Circle/Diamond, `S` Sticky Note, `T` Text, `D` Doc/Spec Card, `C` Connector Arrow, `P` Freehand Pen).
   - **Rich Design & Annotation Nodes**:
     - **Frames & Sections**, **Geometric Shapes**, **Color-Coded Sticky Notes** (with author badge & emoji reactions), **Freehand Vector Pen Strokes**, **Smart Connectors/Arrows** linking nodes, and **Embedded Rich Doc/Spec Cards**.
   - **1-Click "Convert to Kanban Task"**: Select any Sticky Note, Frame, or Doc Card on the canvas and click **"Convert to Task"** to create a real Supabase task in the active project, displaying a live synced status badge directly on the canvas node.
   - **Real-Time Multiplayer Collaboration (`collabService.ts`)**:
     - Broadcast and render **live teammate cursors** (`x, y, userName, color, tool`), live node selection rings, and real-time delta updates (`whiteboard:node_upserted`, `whiteboard:node_deleted`, `whiteboard:cursor_moved`) over Supabase Realtime + `BroadcastChannel` with idempotent state reconciliation.
   - **Starter Templates & Board Export**:
     - Instant 1-click templates: **System Architecture Diagram**, **Sprint Retrospective (Went Well / To Improve / Action Items)**, **Product User Flow**, and **Brainstorming Canvas**.
     - Export the whiteboard to **High-Res PNG**, **Clean Vector SVG**, or **Portable Board JSON**.

---

## 2. Design & Architectural Standards
- **Single-Elevation Glass & Crisp Borders**: Maintain the 32px soft-glass workspace container (`rounded-[32px]`) and 1px structural borders (`border-slate-200/80 dark:border-slate-800/80`) synced with the user's active workspace accent (`--primary`, `--primary-rgb`).
- **Tabular Numerals (`tabular-nums`)**: Enforce `font-mono tabular-nums` on all sidebar badges, report KPI counters, burnup metrics, and canvas zoom/coordinate readouts.
- **Zero Infinite Sync Loops**: Track `isRemoteUpdate` on whiteboard events and use idempotent node upserts (`id` + `updatedAt` timestamp comparison) so concurrent multi-user edits never loop or duplicate.

---

## 3. Technical Implementation Steps

### Phase 1: Types, Navigation & Real-Time Whiteboard Sync (`types.ts`, `constants.tsx`, `services/collabService.ts`)
1. Add `'whiteboard_view'` to `ActiveView` in `types.ts` and register **Whiteboard Studio** in `constants.tsx` (`SIDENAV_ITEMS` & `ALL_ACTIVE_VIEWS`), `App.tsx` (`#/app/whiteboard`), and `CommandPalette.tsx`.
2. Define whiteboard data structures (`WhiteboardNode`, `WhiteboardConnector`, `WhiteboardStroke`, `WhiteboardBoard`, `WhiteboardCursor`) in `types.ts`.
3. Extend `collabService.ts` with real-time whiteboard broadcast & subscription methods (`broadcastWhiteboardDelta`, `broadcastWhiteboardCursor`) over Supabase Realtime and cross-tab channel sync.

### Phase 2: Interactive Sidebar with Live Badges, Favorites & Drag Reordering (`components/layout/Sidebar.tsx`)
1. Compute live badge counts and recent-update indicators from `useAppStore`:
   - **Inbox**: Unread notification count (`notifications.filter(n => !n.read).length`).
   - **My Tasks**: Active incomplete tasks assigned to `currentUser`.
   - **Teams Chat**: Unread/recent chat indicator.
   - **Team Management**: Recent team/role/invite updates badge.
   - **Triage & Intake**: Open triage queue count.
2. Add **Favorites Pinning** (star icon on hover), **Drag-and-Drop Reordering** (HTML5 drag-and-drop with visual drop indicator), **Collapsible Category Groups** (*Workspace*, *Execution*, *Strategy & Docs*, *Admin*), **Quick Sidebar Filter Input**, and **Collapsed Hover Preview Tooltips**.

### Phase 3: Enriched Reports & Performance Analytics (`components/reports/ReportsPage.tsx`)
1. Upgrade the analytics engine with **Period-over-Period Comparison** (`7d`, `30d`, `90d`, `All`), **Cumulative Flow AreaChart**, **Sprint Burnup/Burndown ComposedChart**, **Cycle Time & Story Point Throughput**, and **Assignee Efficiency Matrix**.
2. Implement **Interactive Chart Drill-Down**: clicking any bar, slice, or series opens a slide-over/modal table of the exact matching tasks with 1-click task inspection.
3. Add a **Customize Report Widgets** drawer to toggle and reorder report sections.
4. Build the **Multi-Format Export Menu** supporting **CSV**, **Excel (`.xls`)**, **JSON**, **Executive Markdown (`.md`)**, and **PDF / Print**.

### Phase 4: Figma / FigJam-Style Collaborative Whiteboard Studio (`components/whiteboard/WhiteboardStudioPage.tsx`)
1. Build the infinite pan/zoom canvas with floating FigJam/Figma-style bottom toolbar (`Select`, `Pan`, `Frame`, `Rectangle`, `Diamond`, `Circle`, `Sticky Note`, `Text`, `Doc/Spec Card`, `Connector Arrow`, `Freehand Pen`), style inspector (accent colors, stroke width, typography), and zoom/minimap HUD.
2. Implement **Live Multiplayer Cursors**, node drag/resize handles, inline text/markdown editing, emoji reactions on stickies, and **1-Click "Convert to Kanban Task"** with live task status pill sync.
3. Add **1-Click Templates** (*System Architecture*, *Sprint Retro*, *User Journey Flow*) and **Export to PNG, SVG, and JSON**.
