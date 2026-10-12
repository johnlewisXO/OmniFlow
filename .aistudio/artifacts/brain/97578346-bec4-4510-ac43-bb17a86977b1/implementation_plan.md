# Icon-First UI Transformation, Obsidian/Alabaster Theme Palette, Enriched Notifications & Modern Teams Hub

## 1. Overview & Objectives
We will upgrade **Omni Flow** across five interconnected areas based on your design references and selections:

1. **Global Search Input Icon & Text Overlap Fix (`index.html` & All Search Inputs)**:
   - **Root Cause Identified**: In `index.html`, the global CSS rule `input:not([type="checkbox"])... { padding: 0.75rem 1.1rem !important; }` forced a fixed `1.1rem` (`17.6px`) left padding on all inputs, overriding Tailwind's `pl-8`, `pl-9`, `pl-10`, and `pl-11` classes and causing placeholder/input text to collide with left-positioned magnifying glass icons (`left-3`).
   - **Fix**: Remove `!important` from horizontal input padding in `index.html`, add explicit `.pl-8` / `.pl-9` / `.pl-10` / `.pl-11` / `.pr-9` / `.pr-10` utility preservation rules, and audit every search input across `TeamsChatPage`, `Header`, `Sidebar`, `KanbanBoard`, `InboxPage`, `TeamManagementPage`, `ReportsPage`, `ProjectDocsWikiPage`, and `TriageIntakePage` so icons and text have crisp, non-overlapping spacing.

2. **True Obsidian Black Dark Mode & Studio Alabaster Light Mode (`index.html` & Component Surfaces)**:
   - **Dark Mode (Obsidian Black)**: Inspired by your "HYPER" dark mode reference and modern Linear/Vercel dark themes—uses a deep pitch-black/obsidian canvas (`#050507` / `#000000` base), sleek carbon-black elevated panels (`rgba(12, 13, 18, 0.88)`), and crisp hairline borders (`rgba(255, 255, 255, 0.08)`).
   - **Light Mode (Studio Alabaster)**: Inspired by your "Snazzy Studio", "7CHAT", and "Sofia" references—uses a warm, gallery-clean Studio Alabaster background (`#F4F4F6` / `#F6F5F2`) paired with pure `#FFFFFF` cards and subtle `rgba(15, 23, 42, 0.07)` borders for effortless visual hierarchy.

3. **Icon-First UI Across Dashboards, Analytics Cards & Toolbars**:
   - **Bento & KPI Cards (`TasklyBentoWorkspaceHub.tsx`, `ReportsPage.tsx`, `InboxPage.tsx`)**: Replace wordy multi-line subtitles and verbose button labels with compact, high-signal icon badges, `tabular-nums` primary metrics, and clean 1-line labels with hover tooltips.
   - **Action Toolbars (`KanbanBoard.tsx`, `Header.tsx`, `ReportsPage.tsx`, `ProjectDocsWikiPage.tsx`, `OKRsGoalsPage.tsx`, `TriageIntakePage.tsx`, `WorkloadCapacityPage.tsx`)**: Convert secondary action buttons, view mode switchers, and export/customize controls into **icon-first buttons** with instant hover tooltips (`title` + custom tooltip pills), keeping concise text only on primary CTAs.

4. **Enriched Notification Feed (`InboxPage.tsx`, `Header.tsx`) & Live Toasts (`App.tsx`)**:
   - **Rich Metadata & Diff Pills**: Each notification item and live toast displays:
     - **Actor Avatar / Category Icon Badge** (`Task`, `Mention`, `Chat`, `Sprint`, `Team`, `Security`, `Calendar`).
     - **Contextual Entity Pill** (Project name, `#channel`, or Role badge) + **Status/Priority Diff Transition** (e.g., `To Do → In Progress` or `Priority: Critical`) when applicable.
     - **Relative + Exact Timestamp** (`2m ago · 14:32`).
   - **1-Click Inline Quick Actions**: Hovering or viewing any notification/toast provides instant icon-first actions: **Open Target (`↗`)**, **Quick Reply / View Thread (`💬`)**, **1-Click Undo (`↶`)**, and **Mark Read (`✓`)**.

5. **Modernized Teams Hub (`TeamsChatPage.tsx`) — Mobile, Tablet & Desktop**:
   - **Channels & DMs Default View on Mobile & Tablet**: Initialize `mobilePaneView` to `'list'` so mobile and tablet users land directly on the Channels & Direct Messages directory first, and tapping any channel or teammate smoothly opens the conversation with a prominent `←` back button and unread badge counter.
   - **Left Directory Pane Upgrades (Inspired by "Snazzy Studio", "7CHAT" & "Sofia" Screenshots)**:
     - **"Online Now" Horizontal Avatar Strip** at the top of the directory for 1-tap direct messaging with online teammates.
     - **Pinned Favourites Section** (star any channel or DM to pin it to `Favourites`) + collapsible `Channels` and `Direct Messages` groups with last-message previews, timestamps, and unread count badges.
   - **Center Conversation Pane Upgrades**:
     - **Header Sub-Tabs (`Messages | Canvas | Files & Links`)**: Switch seamlessly between the live message stream, an embedded project **Co-Whiteboard Canvas**, and a **Shared Files & Links** gallery right inside the channel/DM!
     - **Inline Quote-Reply Blocks (`↩`)**: Click the reply icon on any message to quote-reply with a styled vertical quote bar (matching the "Sofia Petrovna" reference screenshot), plus rich link/board cards and icon-first composer actions (`⚡`, `😊`, `@`, `📎`, `📹`, `🎙️`, `➤`).
   - **Right Collapsible "Details" Inspector Drawer (Inspired by "Snazzy Studio" & "HYPER" Screenshots)**:
     - Toggleable **Details (`ⓘ`)** drawer on desktop/tablet with segmented tabs (`Info | Pins | Files | Tasks`) displaying channel creator, creation date, active status, linked project tasks, pinned messages, shared media grid, and member photo cards.

---

## 2. Visual & Spatial Architecture (Frontend Design Guidelines)
- **60-30-10 Surface & Contrast Discipline**:
  - Dark Mode: 60% `#050507` obsidian canvas, 30% `#0D0F14` carbon panels with `1px solid rgba(255,255,255,0.08)`, 10% workspace accent (`var(--accent-hex)`).
  - Light Mode: 60% `#F4F4F6` studio alabaster canvas, 30% `#FFFFFF` elevated panels with `1px solid rgba(15,23,42,0.07)`, 10% workspace accent.
- **Icon-First & Single-Line Discipline**: All toolbar controls use icon-only or icon + 1-word single-line buttons (`whitespace-nowrap shrink-0`) with accessible tooltips. All metrics, counters, and timestamps enforce `tabular-nums`.

---

## 3. File-by-File Implementation Steps

1. **`index.html`**:
   - Fix global input padding override so `.pl-8`, `.pl-9`, `.pl-10`, `.pl-11`, `.pl-12` and search inputs never overlap icons.
   - Upgrade `html.dark` and `:root` (light mode) CSS variables and `.glass-panel` / `aside` / `header` surfaces to the **True Obsidian Black** (`#050507` / `#0C0E14`) and **Studio Alabaster** (`#F4F4F6` / `#FFFFFF`) aesthetic while preserving all 6 user-selectable workspace accents.

2. **`components/chat/TeamsChatPage.tsx`**:
   - Set default `mobilePaneView` to `'list'` so Channels/DMs selection is the default view on mobile & tablet.
   - Add the **"Online Now" horizontal avatar strip** and **Favourites** group in the left sidebar.
   - Add **Conversation Header Sub-Tabs (`Messages | Canvas | Files`)**, **Message Quote-Reply (`replyingToMessage`)** with inline quoted message blocks, and an **Icon-First Composer Toolbar**.
   - Add the collapsible right **Channel/DM Details Inspector Drawer (`Info | Pins | Files | Tasks`)** with member cards, shared media, and linked project tasks.

3. **`App.tsx` & `components/inbox/InboxPage.tsx` & `components/layout/Header.tsx`**:
   - Upgrade `ToastContainer` in `App.tsx` and notification feed cards in `InboxPage.tsx` & `Header.tsx` with enriched metadata (actor avatar/initials, category icon badge, project/channel context tag, status/priority diff pill, exact + relative time, and icon-first quick action buttons).
   - Ensure all search bars in `Header.tsx`, `Sidebar.tsx`, and `InboxPage.tsx` have proper icon spacing (`pl-10`).

4. **`components/dashboards/TasklyBentoWorkspaceHub.tsx`, `components/reports/ReportsPage.tsx`, `components/tasks/KanbanBoard.tsx`**:
   - Streamline KPI capsules, Bento cards, and action toolbars to an **icon-first** presentation with concise labels, feature-accurate icons, and hover tooltips.
