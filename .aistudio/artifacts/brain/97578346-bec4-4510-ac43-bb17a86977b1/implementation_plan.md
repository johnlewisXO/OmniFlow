# FigJam/Notion/Figma-Grade Whiteboard Studio, Authoritative State Persistence & Cross-App Integration

## 1. Overview & Objectives
We will elevate the **Collaborative Whiteboard Studio** across three interconnected pillars inspired by your FigJam, Notion, and Frame/Figma reference designs:

1. **FigJam, Notion & Figma Canvas UI & Tactile Interactions**:
   - **Floating Tactile Bottom Dock**: Inspired by your FigJam & Frame references—features a clean Select/Hand toggle, tactile Marker/Pen tool, Shape selector, stacked Sticky Note pad, Text (`T`), Smart Connector, Stamp/Emote wheel (`E`), and Comment Pin (`C`) tool.
   - **Floating Contextual Node Popover Bar**: Positioned directly above any selected node on the canvas (`Color Swatches`, `@Author / Mention Tag`, `Stamp Reaction`, `Duplicate`, `Convert to Task`, `Delete`), plus **Author Avatar + Name Badges (`@Name`)** docked on sticky notes and **Corner Reaction Stamp Stickers** (`👍`, `⭐`, `🔥`, `❤️`, `🚀`).
   - **Interactive Edge Connection Handles**: Hovering or selecting any node reveals 4 directional edge handles (`Top`, `Right`, `Bottom`, `Left`) that you can drag directly onto another node to draw a live curved Bezier connector arrow.
   - **Pinned Canvas Comment Threads**: Click anywhere with the Comment (`C`) tool to drop an avatar pin with an expandable popover conversation thread, timestamps, and live replies.
   - **Live Cursor Chat (`/`) & Emote/Stamp Wheel (`E`)**: Press `/` on the canvas to type a live speech bubble attached to your multiplayer cursor that broadcasts in real time to all teammates.

2. **Authoritative Multi-User State Sync, Late-Joiner Hydration & Version History**:
   - **Supabase Database Persistence + Late-Joiner Peer Handshake**:
     - Every board change is persisted to Supabase (`organizations` / `projects` shared metadata storage in `supabaseService`) AND cached locally with a monotonically increasing version number (`version`, `updatedAt`, `updatedBy`).
     - When any user opens the Whiteboard (or joins a call whiteboard) after changes were already made, the client immediately:
       1. Loads the latest authoritative board state from Supabase DB so prior edits are always visible even if no other user is currently online.
       2. Broadcasts a `whiteboard_request_state` event over Supabase Realtime (`collabService`); any active peer with a newer `version` responds with `whiteboard_full_sync` so in-flight live state is reconciled instantaneously.
   - **Multi-Page Boards & Bottom-Left Pages/Layers Pill**:
     - Bottom-left floating pill (`• Page 1 · N layers`) inspired by your 3rd reference image—expandable to switch between multiple pages within a board, add new pages, and inspect/focus canvas layers.
   - **Live Version History & 1-Click Revert**:
     - Top header auto-save status indicator (`Saved v14 · Synced`) and a **Version History Drawer** allowing teammates to create named snapshots or revert to any previous saved version in 1 click.

3. **Deep Cross-Platform Integration (Video Calls, Team Chat, Docs & Tasks)**:
   - **Live Co-Whiteboard Stage inside Video & Audio Calls (`VideoCallStudioModal.tsx`)**:
     - Adds a **"Whiteboard"** toggle button in the active Video/Audio Call toolbar. Clicking it opens the live shared Whiteboard Studio right inside the call stage alongside participant video tiles, synchronized in real time across everyone on the call.
   - **1-Click Follow Teammate Viewport (Spotlight / Follow Mode)**:
     - Click any active collaborator's avatar in the Whiteboard top bar to smoothly follow their pan/zoom viewport in real time as they present or draw.
   - **Share Interactive Board Cards to Team Chat & Link in Docs/Tasks**:
     - **"Share to Team Chat"** button in the Whiteboard header posts a rich, interactive Whiteboard card into the project's Team Chat channel with a 1-click **"Open Live Board"** action.
     - **Embed & Link in Project Docs & Task Inspector**: Attach and preview live project whiteboard canvases inside `ProjectDocsWikiPage.tsx` and `ViewTaskModal.tsx`.

---

## 2. Visual & Spatial Architecture (Frontend Design Guidelines)
- **Canvas Surface**: High-contrast radial dot matrix (`#e2e8f0` in light mode, `#1e293b` in dark mode) with 60% neutral workspace canvas, 30% crisp elevated floating controls, and 10% semantic accent highlights.
- **Floating HUD Governance**:
  - Top bar maintains a clean 3-zone layout: Board/Page breadcrumb selector & sync version on the left, active collaborator avatars (with click-to-follow spotlight) + Cursor Chat/Stamp menu + Share to Chat CTA on the right.
  - Bottom bar houses the bottom-left **Pages & Layers pill** (`• Page 1 · N layers`) and the centered **Tactile Tool Dock**.
- **Typography & Tabular Numerals**: Zoom percentages (`100%`), version counters (`v14`), coordinates, and layer counts use `tabular-nums` (`font-mono`) to prevent layout jitter.

---

## 3. File-by-File Implementation Steps

1. **`types.ts`**:
   - Extend `WhiteboardNode` with `authorAvatar?: string`, `mentionTag?: string`, `linkedDocId?: string`.
   - Add `WhiteboardCommentThread` (pin `id`, `x`, `y`, `authorId`, `authorName`, `authorAvatar`, `resolved`, `messages` array).
   - Add `WhiteboardPage` (`id`, `name`, `nodes`, `connectors`, `strokes`, `comments`) and `WhiteboardVersionSnapshot` (`id`, `version`, `label`, `createdAt`, `authorName`, `boardState`).
   - Extend `WhiteboardBoard` with `version: number`, `updatedBy?: string`, `pages?: WhiteboardPage[]`, `activePageId?: string`, `comments?: WhiteboardCommentThread[]`, and `history?: WhiteboardVersionSnapshot[]`.
   - Extend `WhiteboardCursor` with `cursorChat?: string`, `emote?: string`, `zoom?: number`, `panX?: number`, `panY?: number` (for 1-click Follow/Spotlight mode).

2. **`services/supabaseService.ts` & `services/collabService.ts`**:
   - Add `fetchSharedWhiteboardState(organizationId, projectId)` and `saveSharedWhiteboardState(organizationId, projectId, boards)` in `supabaseService.ts` using Supabase persistent storage so late-joining users always load the latest saved board state from the cloud database.
   - Add `whiteboard_request_state` and `whiteboard_full_sync` broadcast events in `collabService.ts` so active peers also hydrate late joiners with any sub-second in-memory state, plus cursor chat and viewport pan/zoom coordinates.

3. **`components/whiteboard/WhiteboardStudioPage.tsx`**:
   - Upgrade the canvas with:
     - **Tactile FigJam/Frame Bottom Dock** (Select, Pan, Frame, Sticky Note Stack, Shapes, Text, Connector, Pen, Comment Pin, Stamp Wheel).
     - **Floating Node Context Bar** above the selected node (Color palette, `@Tag` pill editor, Stamp stickers, Duplicate, Convert to Task, Link to Doc, Delete).
     - **Interactive 4-Edge Connection Handles** on every node to drag-connect curved Bezier arrows between nodes.
     - **Pinned Canvas Comment Threads** with reply inputs and resolve toggles.
     - **Live Cursor Chat (`/` hotkey)** floating input & remote cursor speech bubbles.
     - **Bottom-Left Pages & Layers Pill** supporting multi-page boards and layer list inspection.
     - **Authoritative DB Sync + Version History Drawer** with 1-click snapshot restore and **"Share to Team Chat"** modal/action.
     - **Embedded `compactMode` prop** so the exact same live whiteboard can render inside `VideoCallStudioModal`, `ProjectDocsWikiPage`, or `ViewTaskModal`.

4. **`components/chat/VideoCallStudioModal.tsx` & `components/chat/TeamsChatPage.tsx`**:
   - Add a **Live Co-Whiteboard** toggle in `VideoCallStudioModal.tsx` that opens the interactive `WhiteboardStudioPage` (`compactMode`) inside the call stage while keeping participant video/audio active.
   - Support rendering shared Whiteboard cards in `TeamsChatPage.tsx` so teammates can click **"Open Live Whiteboard"** directly from a chat message.

5. **`components/docs/ProjectDocsWikiPage.tsx` & `components/tasks/ViewTaskModal.tsx`**:
   - Add an embedded **Linked Whiteboard Canvas Preview** section in Project Docs and Task Inspector with 1-click launch into the linked board.
