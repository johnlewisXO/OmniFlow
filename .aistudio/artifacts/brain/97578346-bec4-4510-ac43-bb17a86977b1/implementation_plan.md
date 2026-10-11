# Tablet & Mobile Responsiveness, Custom Color Accents & Automation Engine Fixes

## 1. Overview & Objectives
We will resolve the tablet and mobile layout crowding seen in your screenshots, introduce 6 customizable workspace color accents for both Dark and Light modes with cross-session persistence, and overhaul the Task Automation Engine so all enabled presets and custom trigger rules execute real task mutations, comments, notifications, and live feedback toasts.

---

## 2. Customizable Workspace Color Accents (Dark & Light Mode + Persistence)
- **6 Curated Accent Palettes**:
  - **Electric Violet** (`#7c3aed` / `#8b5cf6` — default brand theme)
  - **Ocean Cyan** (`#0284c7` / `#06b6d4`)
  - **Emerald Mint** (`#059669` / `#10b981`)
  - **Sunset Coral** (`#e11d48` / `#f43f5e`)
  - **Amber Gold** (`#d97706` / `#f59e0b`)
  - **Cobalt Blue** (`#2563eb` / `#3b82f6`)
- **Adaptive Dark & Light Mode Variables**:
  - Apply dynamic CSS custom properties (`--accent-primary`, `--accent-hover`, `--accent-soft`, `--accent-glow`, `--accent-border`) on the root document element (`document.documentElement`) tailored for both Light and Dark modes, seamlessly theming primary buttons, active sidebar pills, focus rings, progress indicators, and badges across the workspace.
- **Header & Profile Settings Pickers**:
  - Add a quick **Theme & Accent** popover in the top `Header` right next to the Dark/Light mode toggle, plus a full **Workspace Appearance & Accent** card in `ProfileSettingsPage`.
- **Cross-Session & Account Persistence**:
  - Persist the selected accent and theme mode to `localStorage` (`omniflow_accent_color`, `omniflow_theme_mode`) for instant zero-flash load, and sync it to the user's profile (`preferences.accentColor` and `preferences.themeMode`) in Supabase/store so it follows the user across logins and sessions.

---

## 3. Tablet & Mobile Responsive Layout Overhaul
- **Compact Mobile & Tablet Header (`Header.tsx`)**:
  - Consolidate secondary header actions on mobile and tablet (`< 1024px`) so the Project Selector, Search trigger, and Quick Add button fit cleanly on a single row without wrapping or overflowing.
- **Collapsible Filter & Search Drawer (`KanbanBoard.tsx`)**:
  - Replace the tall stacked mobile/tablet toolbar (Search input, Priority dropdown, Assignee filter, Sprint selector, Clear button) with a single slim control bar featuring the View Switcher (`Board` / `List` / `Calendar`), a **Filters & Search** toggle button with an active filter badge count, and the **Automations** trigger button.
- **Tablet Kanban Column Layouts (`KanbanBoard.tsx` & `KanbanColumn.tsx`)**:
  - Support both **Snap-Scroll Horizontal Columns** and a **2x2 Grid Layout** toggle on tablet viewports (`768px–1279px`), eliminating the cramped 4-column squeeze where task cards became narrow vertical strips.
- **Slide-Over Task Inspector Overlay (`App.tsx` & `TaskDetailsModal.tsx`)**:
  - Convert the inline right-hand Task Inspector panel into a smooth slide-over overlay drawer on mobile and tablet screens (`< 1280px`) so it never pushes the Kanban board off-screen or renders awkwardly at the bottom of the page.

---

## 4. End-to-End Task Automation & Trigger Engine Fixes
- **Root Cause Resolution**:
  - `processTaskAutomationRules` was previously only invoked inside `KanbanBoard` drag-and-drop, meaning task updates from the Task Details modal, quick-status menus, task creation, or due-date checks never triggered automations. Furthermore, several preset templates in `TaskAutomationsDashboard` and `AutomatedTriggersModal` had mismatched trigger/action definitions or skipped execution when a task already had an assignee.
- **Unified Store-Level Execution (`useAppStore.ts` & `automationEngine.ts`)**:
  - Wire `processTaskAutomationRules` directly into `createTask`, `updateTask`, and `moveTask` in `useAppStore.ts`, plus run an automatic overdue/due-soon sweep when tasks load.
  - Ensure every preset rule and custom trigger executes real state & database updates:
    1. **Auto-Assign Lead Reviewer on In Review**: Reassigns to the designated lead/admin reviewer (or swaps to another available reviewer if the current assignee is the author), posts an automated review handoff comment, and dispatches an in-app notification.
    2. **Escalate Priority When Due Within 24h / Overdue**: Evaluates tasks due within 24 hours or overdue, upgrades priority to `HIGH` or `URGENT`, persists the change, and notifies the assignee.
    3. **Celebrate & Timestamp Completed Tasks / Unblock Dependents**: Stamps completion metadata, posts a verified completion log comment, and automatically unblocks any tasks waiting on the completed task.
    4. **Post Quality Review Checklist Comment**: Automatically appends a real structured QA checklist comment into the task's `comments` thread (`addComment`) when moved to `IN_REVIEW`.
    5. **Urgent Task Alert**: Immediately dispatches high-priority notifications and sound feedback when a task is created or updated to `URGENT`.
- **Live Feedback Toasts & Execution Logs**:
  - Display a clear, non-intrusive live toast banner (`⚡ Automation Triggered: [Rule Name] — [Summary of Action]`) with subtle sound feedback whenever a rule fires, and increment the rule's `triggerCount` and `lastTriggeredAt` timestamp in real time.
