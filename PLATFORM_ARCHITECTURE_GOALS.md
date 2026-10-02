# Omni Flow Enterprise Platform Architecture Goals

## 1. Executive Summary & Vision
Omni Flow is an enterprise-grade Project & Task Management Platform designed with the versatility, speed, and ergonomics of Jira, Linear, and Asana. The architecture is engineered to provide sub-100ms response times, optimistic updates, seamless multi-tenant isolation, real-time collaboration, and enterprise-grade role-based access control (RBAC).

---

## 2. Core Architecture Principles

### 2.1 Hexagonal & Modular Design
- **Separation of Concerns:** Business domain logic is decoupled from presentation and storage adapters.
- **Service Layer Abstraction:** All Supabase database queries, Gemini AI operations, and local state caching flow through dedicated, strongly typed service abstractions (`/services/supabaseService.ts`, `/services/geminiService.ts`, `/services/aiService.ts`).
- **Store Centralization:** Global state is orchestrated via Zustand with reactive event emission (`useAppStore.ts`), handling optimistic updates, offline caching, and automatic error recovery.

### 2.2 Enterprise RBAC Matrix & Organization Multi-Tenancy
| Role | Organization Scope | Project Scope | Task Scope | User & Audit Logs |
| :--- | :--- | :--- | :--- | :--- |
| **OWNER** | Full control, billing, invitations, org deletion | Create, edit, delete, archive all projects | Full CRUD on all tasks | Manage members, assign roles, view full audit logs |
| **ADMIN** | Invite members, manage integrations | Manage all organization projects | Full CRUD on all tasks | Manage members, view audit logs |
| **PROJECT_MANAGER** | View organization profile | Create & manage assigned projects | Create, assign, edit tasks across assigned projects | View team members, generate reports |
| **MEMBER** | View organization profile | View accessible projects | Create tasks, update status, comment, log work | View team members |
| **CLIENT_VIEWER** | View organization profile | View assigned projects (read-only) | View tasks and attachments (read-only) | No management access |

---

## 3. High-Performance Frontend & UI/UX Standards

### 3.1 Views & Workflows
- **Overview Dashboard:** Executive KPI summaries, personalized "My Upcoming Tasks", interactive milestone velocity curves, and team capacity distribution.
- **Kanban Board:** Multi-swimlane grouping (Assignee, Priority, Status), custom WIP (Work-in-Progress) limit guards, drag-and-drop column sorting, and instant quick-filters.
- **My Tasks View:** Categorized sections for *Overdue*, *Due Today*, *Upcoming*, and *Completed* tasks with AI-powered task summarization.
- **Gantt / Timeline & List Views:** Precision schedule visualization and tabular task editing.
- **Task Automations & Triggers Engine:** Visual rule builder enabling no-code triggers (`status_change`, `priority_change`, `due_date_approaching`) and automated actions (`assign_user`, `set_status`, `send_notification`, `add_comment`).
- **Command Palette (`Cmd+K` / `Ctrl+K`):** Instant global search across tasks, projects, actions, theme toggles, and view switching.

### 3.2 Responsive & Zero-Overflow Layouts
- Fully responsive across Desktop ($1280px+$), Tablet ($768px - $1024px$), and Mobile ($<768px$).
- Clean container queries and `ResponsiveContainer` aspect scaling preventing any horizontal overflow or graph clipping on small viewports.
- Touch-friendly action hit targets ($\ge 44px$) with desktop hover states and accessible ARIA attributes.

---

## 4. Backend, Persistence & Security Architecture

### 4.1 Persistence Layer
- **Relational Schema:** PostgreSQL managed via Supabase with strict relational integrity between `organizations`, `user_profiles`, `projects`, `tasks`, `task_comments`, `task_attachments`, `task_collaborators`, and `audit_logs`.
- **Row-Level Security (RLS):** All data queries are scoped by `organization_id` ensuring tenant isolation.
- **Offline & Optimistic Fallbacks:** Local storage sync with background reconciling ensures zero data loss during network disruptions.

### 4.2 Security & Audit Trail
- **Audit Logging:** Every critical administrative, invitation, permission, and task operation writes immutable entries with actor metadata to `audit_logs`.
- **JWT Authentication:** Secure token exchange with password policy enforcement and role verification.

---

## 5. Continuous Improvement & Quality Assurance
1. **Zero TypeScript Drift:** Regular verification via `tsc --noEmit` and strict type validation across all components and hooks.
2. **Sub-second Build Pipeline:** Vite bundling + esbuild backend bundling for production deployment readiness.
3. **Accessibility Compliance:** WCAG AA color contrast, keyboard-navigable dialogs, and focus traps.
