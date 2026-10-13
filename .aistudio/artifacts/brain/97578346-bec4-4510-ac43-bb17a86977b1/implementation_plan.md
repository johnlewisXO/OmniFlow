# End-to-End RBAC Role Sync, Streamlined Google SSO & Multi-Role Org Approval Architecture

Deliver a production-grade identity, access control, and workspace onboarding system:
1. Fix end-to-end RBAC role persistence across frontend, Express backend, and Supabase database, preventing role reversion to `CLIENT_VIEWER` on refresh, and providing an explicit inline "Synced to DB" confirmation badge.
2. Replace cluttered test accounts on the Google SSO modal with a clean, focused single-click Google authentication flow utilizing Supabase OAuth.
3. Implement a complete Organization Join Request pipeline allowing Project Managers, Admins, and Owners to review and approve join requests, powered by real-time in-app approval banners and SMTP email alerts.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following product decisions were confirmed during consultation:
> - **Google SSO Flow**: Clean modal featuring a direct Google Workspace sign-in button using Supabase OAuth redirect, eliminating obsolete test credentials and redundant forms.
> - **Role Sync UI Feedback**: Inline badge reading **"Synced to DB"** with a green status indicator and toast notification when an Admin, Owner, or Project Manager modifies a team member's role.
> - **Join Request Notifications**: Both an in-app manager approval banner displayed to Project Managers, Admins, and Owners, plus transactional SMTP email alerts dispatched to leadership with 1-click review links.

- **Confirmed Decision 1**: Implement a resilient dual-layer role persistence bridge (Supabase Database + server-side `/api/users/role` endpoint) to ensure role promotions/demotions persist permanently across sessions and never revert to `CLIENT_VIEWER` on reload.
- **Confirmed Decision 2**: Streamline the Google SSO modal in `AuthPage.tsx` to a single direct Google account selector button connecting to Supabase OAuth.
- **Confirmed Decision 3**: Enable Project Managers, Admins, and Owners to approve or reject pending member join requests with customized role assignments, triggering real-time workspace admission and SMTP welcome emails.

---

## 1. System Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AUTHENTICATION & SSO                              │
│                                                                             │
│  [ Login / Signup Form ] ──(Click "Continue with Google")──►                │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    CLEAN GOOGLE SSO MODAL                             │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │ [G] Continue with Google Account (Supabase OAuth Redirect)      │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                     ORGANIZATION JOIN REQUEST PIPELINE                      │
│                                                                             │
│  New User (Email / Google) ──► Requests to Join Org (e.g. Acme Corp)       │
│                                      │                                      │
│                                      ▼                                      │
│                [ Persistent Store: /api/join-requests ]                     │
│                                      │                                      │
│             ┌────────────────────────┴────────────────────────┐             │
│             ▼                                                 ▼             │
│   [ SMTP Email Alert ]                              [ In-App Banner ]       │
│   Dispatched to PMs, Admins, & Owners               Visible to PM / Admin   │
│   "New join request from John Doe"                  "1 Pending Join Req"    │
│             │                                                 │             │
│             └────────────────────────┬────────────────────────┘             │
│                                      ▼                                      │
│                      [ Leadership Approves in UI ]                          │
│                                      │                                      │
│                                      ▼                                      │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                      END-TO-END RBAC PERSISTENCE                     │  │
│   │  1. Server updates role in persistent registry (/api/users/role)     │  │
│   │  2. Direct Supabase DB update: user_profiles.role = 'MEMBER'         │  │
│   │  3. Frontend receives { syncedToDb: true }                           │  │
│   │  4. UI displays animated "Synced to DB" badge + toast feedback        │  │
│   │  5. Realtime broadcast admits applicant into workspace instantly     │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Implementation Phases & Technical Scope

### Phase 1: End-to-End Role RBAC Persistence & "Synced to DB" Feedback
- **Problem**: When modifying a user's role in the Team Management UI, Row-Level Security (RLS) on Supabase's `user_profiles` restricts direct updates of another user's row from the client. As a result, the update remained in client-side memory, and upon page refresh or re-authentication, `ensureUserProfileForSession` retrieved the original database row (defaulting to `CLIENT_VIEWER` or unpromoted state).
- **Backend Architecture (`server.ts`)**:
  - Implement persistent endpoints:
    - `POST /api/users/role`: Accepts `{ userId, role, organizationId, actorId }`. Validates that `actorId` is an `OWNER`, `ADMIN`, or `PROJECT_MANAGER`. Updates the persistent user role registry and executes server-side sync with the database.
    - `GET /api/users/roles`: Retrieves all active role assignments and overrides for the organization.
- **Client Service Layer (`services/supabaseService.ts`)**:
  - Update `updateUserRole`: Call `/api/users/role` first, followed by best-effort Supabase client update. Return `{ success: boolean, syncedToDb: boolean, role: UserRole }`.
  - Update `ensureUserProfileForSession` and `getUserProfile`: Query role overrides from `/api/users/roles` so any role set by an administrator immediately overrides any stale fallback on page reload.
- **Team Management UI (`components/team/TeamManagementPage.tsx`)**:
  - Add state tracking for newly updated roles: `syncedUserIds: Record<string, boolean>`.
  - Render an inline green pill badge: `✓ Synced to DB` next to the updated member's role in the table/directory.
  - Display feedback toast: `Role Synced to DB: [User Name] updated to [Role]`.

---

### Phase 2: Streamlined Google SSO Modal
- **Problem**: The existing Google SSO modal displayed mock test accounts (`Alex Morgan`, `Jordan Taylor`), plus manual full-name and email input fields, burying the actual Google OAuth flow.
- **Refactor (`components/auth/AuthPage.tsx`)**:
  - Simplify the modal into a clean, modern dialog adhering to official Google Workspace styling:
    - Branded Google logo and clean header: "Sign in with Google Workspace".
    - Single primary action button: `Continue with Google Account` that triggers `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: getProductionBaseUrl() } })`.
    - Clean subtext explaining secure SSO authentication without mock inputs or confusing form fields.

---

### Phase 3: Production-Grade Organization Join Request & Multi-Role Approval
- **Problem**: When new users sign up via email or Google SSO and request to join an existing organization, leaders (PMs, Admins, Owners) need an immediate, foolproof way to review, approve, and grant appropriate roles.
- **Approval Flow & Hierarchy**:
  - Roles eligible to approve: `OWNER`, `ADMIN`, and `PROJECT_MANAGER`.
  - `OWNER` can assign any role up to `ADMIN` or transfer `OWNER`.
  - `ADMIN` and `PROJECT_MANAGER` can assign `PROJECT_MANAGER`, `MEMBER`, or `CLIENT_VIEWER`.
- **In-App Manager Approval Banner (`App.tsx` & `components/dashboards/`)**:
  - When active user is `OWNER`, `ADMIN`, or `PROJECT_MANAGER` and there are pending join requests for their organization:
    - Render a sleek floating alert banner at the top of the workspace:
      `🔔 Join Request: [Requester Name] requested to join [Org Name] as [Role] — [Review & Approve]`.
- **Team Management Join Requests Tab (`components/team/TeamManagementPage.tsx`)**:
  - Add or enrich the "Join Requests" sub-tab with count pill `Join Requests (N)`.
  - Provide an interactive card for each applicant:
    - Applicant name, email, avatar, request timestamp, and custom note.
    - Role selector dropdown allowing the approver to change the assigned role (e.g., from `MEMBER` to `PROJECT_MANAGER`).
    - Two clear action buttons: `Approve Access` and `Decline`.
- **SMTP Email Alert Dispatch (`services/emailNotificationService.ts` & `server.ts`)**:
  - When a user submits a join request:
    - Query all PMs, Admins, and Owners of that organization.
    - Dispatch transactional email: `[Omni Flow] New Workspace Join Request: [Applicant Name]`.
    - Include direct 1-click CTA: `Review Join Request in Workspace`.
  - When approved:
    - Dispatch welcome email to the applicant: `Welcome to [Organization Name]! Your request has been approved.`.
    - Broadcast real-time event across channels so if the applicant has the modal open, it auto-admits them into the workspace.

---

## 3. Verification Plan

1. **RBAC Persistence & Reload Test**:
   - Log in as Owner/Admin/PM.
   - Change a team member's role from `CLIENT_VIEWER` to `MEMBER` (or `PROJECT_MANAGER`).
   - Verify the `✓ Synced to DB` inline badge appears and the confirmation toast fires.
   - Hard refresh the page (`F5` / reload) and verify the user's role remains `MEMBER`/`PROJECT_MANAGER` and does not revert to `CLIENT_VIEWER`.
2. **Google SSO Modal Test**:
   - Navigate to login or signup.
   - Click "Continue with Google".
   - Verify the modal shows only the clean direct Google SSO button and no mock account forms.
3. **Organization Join Request & Approval Test**:
   - Submit a join request as a newly signed-up user.
   - Verify the in-app notification banner appears for Project Managers, Admins, and Owners.
   - Check that the join request appears in `TeamManagementPage.tsx` with role selection.
   - Approve the request, verify the applicant receives real-time admission and that their role persists in the database.
4. **Applet Compilation**:
   - Run `compile_applet` to ensure TypeScript compilation passes with zero errors.
