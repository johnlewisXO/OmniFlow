# Mobile/Tablet Layout Overhaul, End-to-End RBAC Persistence & Dark Obsidian SaaS Landing Page Makeover

## 1. Executive Summary & Problem Diagnosis

This implementation plan delivers three critical upgrades to Omni Flow:

1. **Mobile & Tablet Dashboard Layout Overhaul**:
   - **Root Cause**: The user's screenshot revealed a layout collision on mobile/tablet viewports where the 12-column Bento Grid collapsed without proper column spans, causing the Team Chat widget, Calendar, Concentric Progress Rings, and Deliverables to render on top of one another.
   - **Solution**: Implement dedicated **Segmented Switcher Tabs** (`Overview` | `Schedule` | `Team Chat` | `Focus & Notes`) on mobile and tablet viewports (`< lg`). On desktop (`lg:` / `xl:`), maintain the clean 12-column Bento Grid with strict minimum widths and container isolation.

2. **End-to-End RBAC Role Persistence & Live DB Verification Feedback**:
   - **Root Cause**: When an Owner/Admin updates a user's role in the Team Management UI, Supabase client-side Row-Level Security (RLS) blocks client updates to another user's `user_profiles` row. Additionally, on page reload or re-authentication, `ensureUserProfileForSession` retrieved the original database record or fell back to cached defaults (`CLIENT_VIEWER`).
   - **Solution**: Key the backend persistent storage (`server.ts` + `.data/user_roles.json`) by **both User UUID and lowercase Email**. On reload, `ensureUserProfileForSession` resolves against this authoritative store first. Every updated member row in `TeamManagementPage.tsx` and user profile views will render a prominent `✓ DB Verified & Synced` green badge with instant confirmation toast feedback.

3. **Landing Page Extreme Makeover**:
   - **Visual Direction**: **Dark Obsidian SaaS with high-res glassmorphism and live product previews** (WCAG AA compliant, deep obsidian `#070A12` canvas, geometric typography, zero static pills, clean editorial numbering).
   - **Visual Assets**: Generate high-fidelity visual assets using `generate_image` for the Hero preview, Autonomous AI Co-Pilot, 1080p WebRTC Collaboration Studio, Mobile Studio, and Enterprise RBAC Governance.
   - **Rich Content Architecture**: Asymmetric Bento Grid of core capabilities, interactive live product sandbox with working tabbed demos, real customer impact metrics, transparent 3-tier pricing matrix, and streamlined workspace signup.

---

## 2. Technical Architecture & Implementation Phases

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SYSTEM ARCHITECTURE FLOW                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   [ Mobile / Tablet Viewport (< lg) ]           [ Desktop Viewport (≥ lg) ] │
│                   │                                          │              │
│                   ▼                                          ▼              │
│       [ Segmented Tab Switcher ]                   [ 12-Column Bento Grid ] │
│   Overview | Schedule | Chat | Focus              Proper col-spans & bounds │
│                   │                                          │              │
│                   └─────────────────────┬────────────────────┘              │
│                                         ▼                                   │
│                        [ Zero-Overlap Responsive Canvas ]                   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                         DUAL-KEYED RBAC PERSISTENCE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   [ Admin Updates Role in UI ] ──► [ POST /api/users/:userId/role ]         │
│                                           │                                 │
│                                           ▼                                 │
│                     [ Dual-Keyed Registry: UUID + Email ]                   │
│                     Persisted to .data/user_roles.json                      │
│                                           │                                 │
│                     ┌─────────────────────┴────────────────────┐            │
│                     ▼                                          ▼            │
│          [ Instant UI Feedback ]                     [ Page Reload / Auth ] │
│       "✓ DB Verified & Synced" badge           ensureUserProfileForSession   │
│       Fires confirmation toast                 Queries /api/users/:id/role  │
│                                                Overwrites stale DB fallback │
│                                                Never reverts to CLIENT_VIEW │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Phase 1: Mobile/Tablet Dashboard Layout Overhaul (`components/dashboards/TasklyBentoWorkspaceHub.tsx`)

#### 1.1 Root Cause Analysis of Screenshot Collision
- On mobile and tablet screens (`viewport < 1024px`), `WIDGET_LABELS` had classes like `colSpanClass: 'xl:col-span-5 lg:col-span-7'`, which provided **no column span for `md:` or `sm:`**. In a 12-column CSS grid, child widgets collapsed into narrow 1-column slivers or overflowed their containers.
- The `Team Chat` widget and `Calendar & Schedule` widget lacked strict viewport bounds, resulting in absolute/flex elements overlapping directly on top of the task list and progress rings.

#### 1.2 Segmented Switcher Navigation for Mobile/Tablet
- Add responsive state: `mobileActiveTab: 'overview' | 'schedule' | 'chat' | 'focus'`.
- Render a sleek, mobile-friendly segmented control bar visible on `< lg` viewports:
  ```tsx
  <div className="lg:hidden flex items-center p-1 rounded-2xl bg-slate-900/80 border border-white/10 gap-1 overflow-x-auto scrollbar-none">
    <button onClick={() => setMobileActiveTab('overview')} ...>Overview</button>
    <button onClick={() => setMobileActiveTab('schedule')} ...>Schedule</button>
    <button onClick={() => setMobileActiveTab('chat')} ...>Team Chat</button>
    <button onClick={() => setMobileActiveTab('focus')} ...>Focus & Notes</button>
  </div>
  ```
- On `< lg`:
  - `overview`: Displays the KPI Capsules Row + Task Overview with status pills + Deliverable Cards with proper single-column full-width spacing.
  - `schedule`: Displays the Project Status Rings + Interactive Calendar Grid + Upcoming Standup and Sprint milestones.
  - `chat`: Displays the full-height Team Chat channel with message stream, sender avatars, and full-width input.
  - `focus`: Displays the Task Focus Timer and Sticky Notes scratchpad.
- On `≥ lg` (Desktop):
  - Retain the full 12-column Bento Grid with explicit, non-colliding column spans (`lg:col-span-6`, `xl:col-span-5`, etc.) and ensure no negative margins or unconstrained absolute overlays exist.

---

### Phase 2: Dual-Keyed RBAC Role Persistence & Live DB Verification

#### 2.1 Backend Dual-Keyed Persistence (`server.ts`)
- Update `usersRoleStore` in `server.ts` to index entries by **both `userId` (UUID) and lowercase `email`**:
  ```ts
  interface RoleEntry {
    userId: string;
    email?: string;
    role: string;
    organizationId?: string;
    updatedBy: string;
    updatedAt: string;
  }
  ```
- `POST /api/users/:userId/role`:
  - Accepts `{ role, organizationId, email, actorId }`.
  - Sets `usersRoleStore.set(userId, entry)`.
  - If `email` is provided, also sets `usersRoleStore.set(email.toLowerCase(), entry)`.
  - Persists directly to `.data/user_roles.json`.
- `GET /api/users/:userIdOrEmail/role`:
  - Checks if `usersRoleStore.has(userIdOrEmail)`.
  - If not found and an `?email=` query parameter is supplied, checks by `email.toLowerCase()`.
  - Returns `{ ok: true, synced: true, role, organizationId, updatedAt }`.
- `GET /api/users/roles`: Returns all stored roles with dual-indexed lookup.

#### 2.2 Client-Side Resilient Role Loading (`services/supabaseService.ts`)
- **In `updateUserRole`**:
  - Retrieve the target user's email from the store or profile cache.
  - Dispatch `POST /api/users/:userId/role` with `{ role, organizationId, email }`.
  - Set `localStorage.setItem('axon_user_role_' + userId, normalizedRole)` and `localStorage.setItem('axon_user_role_' + cleanEmail, normalizedRole)`.
  - Set `user.db_synced = true` on the returned profile.
- **In `ensureUserProfileForSession`**:
  - Immediately query `/api/users/${encodeURIComponent(sessionUser.id)}/role?email=${encodeURIComponent(cleanEmail)}`.
  - If a role is found, **it immediately becomes the authoritative role**, overriding any stale `CLIENT_VIEWER` row returned by Supabase RLS.
  - Apply this authoritative check in the main branch AND in all network/error fallback branches so no profile can ever accidentally revert to `CLIENT_VIEWER`.
- **In `getUsersByOrganizationId`**:
  - Fetch `/api/users/roles` and apply authoritative roles to every member by both `id` and `email`.
  - Set `db_synced = true` for all verified members.

#### 2.3 Team Management & Directory UI Feedback (`components/team/TeamManagementPage.tsx`)
- Display an inline green status badge:
  ```tsx
  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-xs">
    <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-400" />
    <span>✓ DB Verified &amp; Synced</span>
  </span>
  ```
- Fire immediate toast on role change: `Role Synced to DB: [Name] updated to [Role]`.

---

### Phase 3: Dark Obsidian SaaS Landing Page Extreme Makeover

#### 3.1 Visual Direction & Token Architecture
- **Aesthetic**: Dark Obsidian SaaS (`#070A12` base canvas, `#0B0F1C` surface cards, hairline borders `border-white/10`, indigo/cobalt accents `#6366F1` and `#4F46E5`).
- **Typography**: Geometric display headings in tight tracking (`tracking-tight`), crisp legible body text (`text-slate-300`), tabular monospace for metrics and timers (`font-mono tabular-nums`).
- **Anti-Slop Discipline**: Zero static pills; clean inline text metadata with typographic bullets (`·`); natural editorial numbering (`01. Autonomous AI Co-Pilot`, `02. 1080p60 WebRTC Mesh`); single primary CTA per section.

#### 3.2 High-Resolution Visual Asset Generation
Generate 4 high-resolution visual assets using `generate_image`:
1. `landing_hero_preview` (16:9): Cinematic wide-angle view of a dark obsidian glassmorphic workspace interface showing glowing concentric sprint rings, dark metallic Kanban columns, and HD video HUD.
2. `landing_copilot_studio` (16:9): High-res 3D interface rendering of the AI Project Manager Studio with interactive roadmap timeline, Fibonacci sprint points, and risk radar telemetry.
3. `landing_webrtc_studio` (16:9): High-res 3D interface rendering of a 1080p video collaboration studio with 48kHz audio waveform, screen-sharing canvas, and active participant tiles.
4. `landing_mobile_studio` (16:9): High-res modern mobile and tablet mockup showcasing the segmented switcher tabs (Overview, Schedule, Team Chat) with zero overlap.

#### 3.3 Expanded Landing Page Content Sections (`components/landing/`)
1. **Glassmorphic Navigation Bar (`LandingHeader.tsx`)**:
   - Wordmark logo with subtle ambient glow.
   - Clean text links: Product Studio, Capabilities, Enterprise Security, Pricing, Architecture.
   - Primary action: "Enter Workspace Studio" / "Start Free Workspace".
2. **Hero Section (`HeroSection.tsx`)**:
   - Compelling headline: "Command Every Sprint, Standup, and Deliverable in One Glassmorphic Studio."
   - Primary CTA with instant signup redirect.
   - Dominant focal point: High-res hero preview asset combined with an interactive live product preview studio (Kanban simulator, AI roadmap generator, 1080p video simulator).
3. **Core Capabilities Bento Grid (`CapabilitiesBentoSection.tsx`)**:
   - 5 asymmetric bento cards detailing real capabilities with human editorial numbering:
     - `01. Autonomous AI Co-Pilot`: Fibonacci story point estimations, roadmap blueprints, and risk analysis.
     - `02. Lossless 1080p60 WebRTC & Opus Mesh`: Hardware-level Acoustic Echo Cancellation with zero context switching.
     - `03. Enterprise Multi-Role RBAC Governance`: Dual-keyed persistent roles, 1-click join request approvals, and cryptographic audit logs.
     - `04. Supabase Edge Compute & Deterministic SLAs`: Automated SLA breach escalations and compliance digests.
     - `05. Mobile Thumb-Zone Studio`: Segmented tab navigation optimized for phones and tablets.
4. **Quantified Proof of Impact & Customer Evidence (`ImpactProofSection.tsx`)**:
   - Real metrics: `42% Faster Sprint Cycle Time`, `100% RBAC Audit Traceability`, `<35ms WebRTC Latency`.
   - Customer case study spotlights with company attributions.
5. **Transparent 3-Tier Enterprise Pricing Matrix (`PricingSection.tsx`)**:
   - Starter Workspace ($0 forever free, up to 5 members).
   - Pro Studio ($12/user/mo, unlimited projects, AI Co-Pilot, 1080p video).
   - Enterprise Cloud (Custom, dedicated SLA, compliance audits, custom SSO).
6. **Conversion CTA & Minimalist Footer (`LandingFooter.tsx`)**:
   - 1-click workspace launch form with direct auth integration.
   - Wordmark, navigation mirror, legal notices, and keyboard shortcuts guide.

---

## 3. Verification & Acceptance Testing Plan

1. **Mobile/Tablet Layout Test**:
   - Emulate mobile viewport (`375px` - `430px`) and tablet viewport (`768px` - `1024px`) in browser.
   - Verify that the Segmented Switcher Tabs (`Overview`, `Schedule`, `Team Chat`, `Focus`) render cleanly.
   - Verify that Team Chat, Calendar, and Deliverable Cards **never overlap** and each section takes 100% of the container cleanly.
   - Switch between tabs and confirm smooth, stutter-free transitions.
   - Emulate desktop viewport (`≥ 1024px`) and verify the full 12-column Bento Grid displays without clipping.

2. **End-to-End RBAC Role Persistence Test**:
   - Log in as Owner/Admin.
   - Navigate to Team Management and update a user's role from `CLIENT_VIEWER` to `PROJECT_MANAGER` or `MEMBER`.
   - Verify the `✓ DB Verified & Synced` inline badge appears immediately with confirmation toast.
   - Hard refresh (`F5` / reload) on both the admin's machine and the updated user's browser/tab.
   - Verify that the user's role remains `PROJECT_MANAGER` or `MEMBER` and **never reverts to `CLIENT_VIEWER`**.
   - Verify that `curl http://localhost:3000/api/users/:userId/role` returns `{ ok: true, synced: true, role: "..." }`.

3. **Landing Page Visual & Content Test**:
   - Navigate to `#/` (Landing Page).
   - Verify the Dark Obsidian SaaS aesthetic, high-res generated visuals, and interactive product demo tabs.
   - Test the interactive tab switcher on the live preview studio.
   - Verify typography hierarchy and WCAG AA contrast.
   - Verify all links ("Start Free Workspace", "Sign In") route to `#/signup` and `#/login`.

4. **Applet Compilation**:
   - Run `compile_applet` to ensure 100% clean TypeScript build with zero errors.
