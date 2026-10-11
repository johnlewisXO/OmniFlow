import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import {
  WhiteboardNode,
  WhiteboardNodeType,
  WhiteboardConnector,
  WhiteboardStroke,
  WhiteboardBoard,
  WhiteboardCursor,
  WhiteboardCommentThread,
  WhiteboardPage,
  WhiteboardVersionSnapshot,
  TaskPriority,
  TaskStatus,
} from '../../types';
import { ICON_MAP } from '../../constants';
import { collabService } from '../../services/collabService';
import supabaseService from '../../services/supabaseService';
import chatService from '../../services/chatService';
import soundService from '../../services/soundService';

export type WhiteboardTool =
  | 'select'
  | 'pan'
  | 'frame'
  | 'sticky'
  | 'rectangle'
  | 'diamond'
  | 'circle'
  | 'text'
  | 'doc_card'
  | 'connector'
  | 'pen'
  | 'comment'
  | 'stamp';

const NODE_COLORS = [
  { id: 'sky', label: 'Ice Sky', hex: '#0ea5e9', pastelBg: '#e0f2fe', pastelBorder: '#7dd3fc', darkBg: '#0c4a6e' },
  { id: 'butter', label: 'Warm Butter', hex: '#eab308', pastelBg: '#fef9c3', pastelBorder: '#fde047', darkBg: '#422006' },
  { id: 'lavender', label: 'Soft Lavender', hex: '#8b5cf6', pastelBg: '#f3e8ff', pastelBorder: '#d8b4fe', darkBg: '#2e1065' },
  { id: 'coral', label: 'Blush Coral', hex: '#f43f5e', pastelBg: '#ffe4e6', pastelBorder: '#fda4af', darkBg: '#4c0519' },
  { id: 'mint', label: 'Fresh Mint', hex: '#10b981', pastelBg: '#d1fae5', pastelBorder: '#6ee7b7', darkBg: '#064e3b' },
  { id: 'slate', label: 'Clean Slate', hex: '#64748b', pastelBg: '#f8fafc', pastelBorder: '#cbd5e1', darkBg: '#1e293b' },
];

const STAMP_EMOJIS = ['👍', '⭐', '🔥', '❤️', '🚀', '☹️'];

const buildArchitectureTemplate = (projectId?: string): WhiteboardBoard => ({
  id: `wb-arch-${projectId || 'default'}`,
  name: 'Community Portal & Architecture Spec',
  projectId,
  version: 1,
  updatedBy: 'Takumi',
  updatedAt: new Date().toISOString(),
  nodes: [
    {
      id: 'node-sticky-1',
      type: 'sticky',
      x: 110,
      y: 230,
      width: 210,
      height: 185,
      title: 'Sprint ETA',
      content: 'ETA on Thursday next week for edge gateway rollout.',
      color: '#eab308',
      authorName: 'Takumi',
      mentionTag: 'Milestone',
      reactions: { '👍': 2 },
      updatedAt: Date.now() - 60000,
    },
    {
      id: 'node-sticky-2',
      type: 'sticky',
      x: 380,
      y: 120,
      width: 230,
      height: 190,
      title: 'Product North Star',
      content: 'HWM build the best in class productivity tool with live co-whiteboarding?',
      color: '#0ea5e9',
      authorName: 'Takumi',
      mentionTag: '@Takumi',
      reactions: { '👍': 3, '⭐': 1 },
      updatedAt: Date.now() - 50000,
    },
    {
      id: 'node-sticky-3',
      type: 'sticky',
      x: 420,
      y: 365,
      width: 275,
      height: 175,
      title: 'Retention Metric',
      content: '-3% MAU caused by the summer vacation season. Unfortunately, we also noted a 2% churn this month...',
      color: '#8b5cf6',
      authorName: 'Aiko',
      mentionTag: 'Data',
      reactions: { '☹️': 1 },
      updatedAt: Date.now() - 40000,
    },
    {
      id: 'node-sticky-4',
      type: 'sticky',
      x: 680,
      y: 195,
      width: 265,
      height: 180,
      title: 'Quality OKRs',
      content: 'I wonder about the quality metrics we set for this month. Does it align with Q4 targets?',
      color: '#f43f5e',
      authorName: 'Marta K.',
      mentionTag: 'QA Spec',
      reactions: { '🔥': 2 },
      updatedAt: Date.now() - 30000,
    },
    {
      id: 'node-doc-1',
      type: 'doc_card',
      x: 1010,
      y: 140,
      width: 310,
      height: 255,
      title: 'Welcome back · Release v2.4',
      content:
        '• Real-time Supabase cloud board persistence\n• Late-joiner peer state handshake\n• Pinned canvas comment threads\n• 1-click convert sticky note to Kanban task',
      color: '#10b981',
      authorName: 'Marta K.',
      mentionTag: 'NEW',
      reactions: { '🚀': 4 },
      updatedAt: Date.now() - 20000,
    },
  ],
  connectors: [
    {
      id: 'conn-1',
      fromNodeId: 'node-sticky-2',
      toNodeId: 'node-sticky-4',
      fromSide: 'right',
      toSide: 'left',
      label: 'Metrics sync',
      color: '#64748b',
      style: 'solid',
    },
    {
      id: 'conn-2',
      fromNodeId: 'node-sticky-4',
      toNodeId: 'node-doc-1',
      fromSide: 'right',
      toSide: 'left',
      label: 'Spec Card',
      color: '#10b981',
      style: 'dashed',
    },
  ],
  strokes: [],
  comments: [
    {
      id: 'comment-seed-1',
      x: 1085,
      y: 115,
      authorId: 'seed-marta',
      authorName: 'Marta K.',
      color: '#8b5cf6',
      resolved: false,
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      replies: [
        {
          id: 'rep-1',
          authorId: 'seed-marta',
          authorName: 'Marta K.',
          text: 'Can we bump the gradient contrast a touch? The orange gets lost on smaller screens.',
          createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        },
      ],
    },
  ],
});

const buildRetroTemplate = (projectId?: string): WhiteboardBoard => ({
  id: `wb-retro-${projectId || 'default'}`,
  name: 'Sprint Retrospective & Action Items',
  projectId,
  version: 1,
  updatedBy: 'Sprint Lead',
  updatedAt: new Date().toISOString(),
  nodes: [
    {
      id: 'retro-frame-1',
      type: 'frame',
      x: 70,
      y: 80,
      width: 320,
      height: 380,
      title: 'What Went Well',
      content: 'Wins, velocity highlights & smooth handoffs',
      color: '#10b981',
      authorName: 'Scrum Master',
      updatedAt: Date.now() - 50000,
    },
    {
      id: 'retro-sticky-1',
      type: 'sticky',
      x: 95,
      y: 155,
      width: 265,
      height: 135,
      title: 'Zero-Downtime Release',
      content: 'Database migration and new Kanban bulk actions shipped ahead of schedule.',
      color: '#10b981',
      authorName: 'Alex Rivera',
      mentionTag: '@Alex',
      reactions: { '🚀': 5, '👍': 3 },
      updatedAt: Date.now() - 40000,
    },
    {
      id: 'retro-frame-2',
      type: 'frame',
      x: 420,
      y: 80,
      width: 320,
      height: 380,
      title: 'Needs Improvement',
      content: 'Bottlenecks, flaky tests & scope creep',
      color: '#eab308',
      authorName: 'Scrum Master',
      updatedAt: Date.now() - 35000,
    },
    {
      id: 'retro-sticky-2',
      type: 'sticky',
      x: 445,
      y: 155,
      width: 265,
      height: 135,
      title: 'PR Review Latency',
      content: 'Cross-team PR reviews took >24h mid-sprint. Let us add SLA automation.',
      color: '#eab308',
      authorName: 'Sarah Chen',
      mentionTag: 'Process',
      reactions: { '🔥': 3 },
      updatedAt: Date.now() - 30000,
    },
    {
      id: 'retro-frame-3',
      type: 'frame',
      x: 770,
      y: 80,
      width: 320,
      height: 380,
      title: 'Next Sprint Commitments',
      content: 'Concrete owners & convertible Kanban tasks',
      color: '#8b5cf6',
      authorName: 'Scrum Master',
      updatedAt: Date.now() - 25000,
    },
    {
      id: 'retro-sticky-3',
      type: 'sticky',
      x: 795,
      y: 155,
      width: 265,
      height: 135,
      title: 'Automate Triage Routing',
      content: 'Connect critical bug intake directly to on-call engineer with Slack/Inbox ping.',
      color: '#8b5cf6',
      authorName: 'Jordan Lee',
      mentionTag: 'Action',
      reactions: { '⭐': 4 },
      updatedAt: Date.now() - 20000,
    },
  ],
  connectors: [
    {
      id: 'retro-conn-1',
      fromNodeId: 'retro-sticky-2',
      toNodeId: 'retro-sticky-3',
      fromSide: 'right',
      toSide: 'left',
      label: 'Action Item',
      color: '#8b5cf6',
      style: 'solid',
    },
  ],
  strokes: [],
  comments: [],
});

const buildUserFlowTemplate = (projectId?: string): WhiteboardBoard => ({
  id: `wb-flow-${projectId || 'default'}`,
  name: 'Customer Onboarding & Checkout Flow',
  projectId,
  version: 1,
  updatedBy: 'Product Design',
  updatedAt: new Date().toISOString(),
  nodes: [
    {
      id: 'flow-1',
      type: 'circle',
      x: 90,
      y: 190,
      width: 170,
      height: 120,
      title: 'Landing Visit',
      content: 'Organic / Referral CTA click',
      color: '#0ea5e9',
      authorName: 'Growth PM',
      updatedAt: Date.now() - 40000,
    },
    {
      id: 'flow-2',
      type: 'rectangle',
      x: 340,
      y: 190,
      width: 220,
      height: 120,
      title: 'Workspace Setup',
      content: 'OAuth SSO or Magic Link + Team Invite',
      color: '#8b5cf6',
      authorName: 'UX Lead',
      updatedAt: Date.now() - 35000,
    },
    {
      id: 'flow-3',
      type: 'diamond',
      x: 640,
      y: 180,
      width: 220,
      height: 140,
      title: 'Template Picked?',
      content: 'Kanban vs Sprint vs Whiteboard',
      color: '#eab308',
      authorName: 'UX Lead',
      updatedAt: Date.now() - 30000,
    },
    {
      id: 'flow-4',
      type: 'doc_card',
      x: 940,
      y: 145,
      width: 290,
      height: 210,
      title: 'Activated Workspace',
      content: '• First 3 tasks created\n• Teammate invited\n• Automation preset enabled\n• Conversion goal: >68%',
      color: '#10b981',
      authorName: 'Product Lead',
      mentionTag: 'KPI Target',
      reactions: { '🚀': 3 },
      updatedAt: Date.now() - 20000,
    },
  ],
  connectors: [
    { id: 'f-c1', fromNodeId: 'flow-1', toNodeId: 'flow-2', label: 'Sign Up', color: '#0ea5e9', style: 'solid' },
    { id: 'f-c2', fromNodeId: 'flow-2', toNodeId: 'flow-3', label: 'Complete Profile', color: '#8b5cf6', style: 'solid' },
    { id: 'f-c3', fromNodeId: 'flow-3', toNodeId: 'flow-4', label: 'Yes (82%)', color: '#10b981', style: 'solid' },
  ],
  strokes: [],
  comments: [],
});

export interface WhiteboardStudioPageProps {
  compactMode?: boolean;
  projectIdOverride?: string;
  onCloseCompact?: () => void;
}

export const WhiteboardStudioPage: React.FC<WhiteboardStudioPageProps> = ({
  compactMode = false,
  projectIdOverride,
  onCloseCompact,
}) => {
  const {
    darkMode,
    projects,
    activeProject,
    currentUser,
    currentOrganization,
    tasks,
    createTask,
    openViewTaskModal,
    setActiveView,
    addToast,
  } = useAppStore();

  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    projectIdOverride || activeProject?.id || projects[0]?.id || 'default'
  );

  useEffect(() => {
    if (projectIdOverride) {
      setSelectedProjectId(projectIdOverride);
    } else if (activeProject?.id && selectedProjectId === 'default') {
      setSelectedProjectId(activeProject.id);
    }
  }, [projectIdOverride, activeProject?.id, selectedProjectId]);

  const scopeKey = useMemo(() => {
    const orgPart = currentOrganization?.id || currentUser?.organization_id || 'global';
    const projPart = selectedProjectId || 'default';
    return `${orgPart}__${projPart}`;
  }, [currentOrganization?.id, currentUser?.organization_id, selectedProjectId]);

  const localStorageKey = `omni_whiteboard_v3_${scopeKey}`;

  const [boards, setBoards] = useState<WhiteboardBoard[]>(() => {
    try {
      const saved = localStorage.getItem(localStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        if (parsed?.boards && Array.isArray(parsed.boards) && parsed.boards.length > 0) {
          return parsed.boards;
        }
      }
    } catch {}
    return [
      buildArchitectureTemplate(selectedProjectId),
      buildRetroTemplate(selectedProjectId),
      buildUserFlowTemplate(selectedProjectId),
    ];
  });

  const [activeBoardId, setActiveBoardId] = useState<string>(() => boards[0]?.id || '');
  const [boardVersion, setBoardVersion] = useState<number>(() => boards[0]?.version || 1);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'loading'>('synced');
  const [lastUpdatedBy, setLastUpdatedBy] = useState<string>(
    boards[0]?.updatedBy || currentUser?.full_name || 'Teammate'
  );

  const boardsRef = useRef(boards);
  boardsRef.current = boards;
  const activeBoardIdRef = useRef(activeBoardId);
  activeBoardIdRef.current = activeBoardId;
  const boardVersionRef = useRef(boardVersion);
  boardVersionRef.current = boardVersion;

  // Tool & Canvas Viewport State
  const [activeTool, setActiveTool] = useState<WhiteboardTool>('select');
  const [selectedColor, setSelectedColor] = useState<string>('#0ea5e9');
  const [selectedStamp, setSelectedStamp] = useState<string>('👍');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [connectorStartNodeId, setConnectorStartNodeId] = useState<string | null>(null);
  const [draggingEdgeConnector, setDraggingEdgeConnector] = useState<{
    fromNodeId: string;
    fromSide: 'top' | 'right' | 'bottom' | 'left';
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  const [zoom, setZoom] = useState<number>(compactMode ? 0.85 : 1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 30, y: 20 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panOrigin, setPanOrigin] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [gridStyle, setGridStyle] = useState<'dots' | 'grid'>('dots');

  // Popovers & Drawers
  const [showShapeMenu, setShowShapeMenu] = useState<boolean>(false);
  const [showStampMenu, setShowStampMenu] = useState<boolean>(false);
  const [showEmoteMenu, setShowEmoteMenu] = useState<boolean>(false);
  const [showPagesDrawer, setShowPagesDrawer] = useState<boolean>(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [shareChannelId, setShareChannelId] = useState<string>('general');
  const [shareNote, setShareNote] = useState<string>('');
  const [snapshotLabelInput, setSnapshotLabelInput] = useState<string>('');

  // Pinned Comment Thread State
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [commentReplyDraft, setCommentReplyDraft] = useState<string>('');

  // Live Cursor Chat (`/` hotkey) State
  const [isCursorChatOpen, setIsCursorChatOpen] = useState<boolean>(false);
  const [cursorChatText, setCursorChatText] = useState<string>('');
  const [localCursorPos, setLocalCursorPos] = useState<{ x: number; y: number }>({ x: 420, y: 280 });
  const [followingUserId, setFollowingUserId] = useState<string | null>(null);

  // Node dragging & resizing
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [resizingNodeId, setResizingNodeId] = useState<string | null>(null);

  // Freehand Pen Drawing State
  const [activeStroke, setActiveStroke] = useState<{ x: number; y: number }[] | null>(null);

  // Live Multiplayer Cursors
  const [remoteCursors, setRemoteCursors] = useState<Record<string, WhiteboardCursor>>({});
  const canvasRef = useRef<HTMLDivElement>(null);
  const lastCursorBroadcastRef = useRef<number>(0);

  const activeBoard = useMemo(
    () => boards.find(b => b.id === activeBoardId) || boards[0],
    [boards, activeBoardId]
  );

  // Persist locally & to Supabase Cloud Storage on authoritative changes
  const persistAuthoritativeState = useCallback(
    (
      nextBoards: WhiteboardBoard[],
      nextActiveBoardId?: string,
      incrementVersion = true,
      broadcastFull = false
    ) => {
      const nextVer = incrementVersion ? boardVersionRef.current + 1 : boardVersionRef.current;
      const actorName =
        currentUser?.full_name || currentUser?.email?.split('@')[0] || 'Teammate';
      const nowIso = new Date().toISOString();

      const stampedBoards = nextBoards.map(b =>
        b.id === (nextActiveBoardId || activeBoardIdRef.current)
          ? { ...b, version: nextVer, updatedBy: actorName, updatedAt: nowIso }
          : b
      );

      boardVersionRef.current = nextVer;
      setBoardVersion(nextVer);
      setLastUpdatedBy(actorName);
      setSyncStatus('syncing');

      const payload = {
        boards: stampedBoards,
        activeBoardId: nextActiveBoardId || activeBoardIdRef.current,
        version: nextVer,
        updatedAt: nowIso,
        updatedBy: actorName,
      };

      try {
        localStorage.setItem(localStorageKey, JSON.stringify(payload));
      } catch {}

      supabaseService
        .saveSharedWhiteboardState(scopeKey, payload)
        .finally(() => {
          setSyncStatus('synced');
        });

      if (broadcastFull && currentUser) {
        collabService.broadcastWhiteboardFullSync({
          scopeKey,
          boards: stampedBoards,
          activeBoardId: nextActiveBoardId || activeBoardIdRef.current,
          version: nextVer,
          updatedAt: nowIso,
          actorId: currentUser.id,
          actorName,
        });
      }

      return stampedBoards;
    },
    [currentUser, localStorageKey, scopeKey]
  );

  // Hydrate from Supabase Cloud + Request Live Peer State on Mount / Project Switch
  useEffect(() => {
    let cancelled = false;
    setSyncStatus('loading');

    const hydrateBoard = async () => {
      // 1. Check local cache for this scopeKey first
      let initialBoards: WhiteboardBoard[] | null = null;
      let initialVer = 0;
      try {
        const raw = localStorage.getItem(localStorageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            initialBoards = parsed;
            initialVer = Math.max(...parsed.map((b: WhiteboardBoard) => b.version || 1));
          } else if (parsed?.boards && Array.isArray(parsed.boards) && parsed.boards.length > 0) {
            initialBoards = parsed.boards;
            initialVer = Number(parsed.version || 1);
          }
        }
      } catch {}

      if (!initialBoards) {
        initialBoards = [
          buildArchitectureTemplate(selectedProjectId),
          buildRetroTemplate(selectedProjectId),
          buildUserFlowTemplate(selectedProjectId),
        ];
      }

      if (!cancelled) {
        setBoards(initialBoards);
        setActiveBoardId(prev =>
          initialBoards!.some(b => b.id === prev) ? prev : initialBoards![0].id
        );
        setBoardVersion(initialVer || 1);
      }

      // 2. Fetch authoritative state from Supabase Cloud Storage
      const cloudState = await supabaseService.fetchSharedWhiteboardState(scopeKey);
      if (!cancelled && cloudState && Array.isArray(cloudState.boards) && cloudState.boards.length > 0) {
        const cloudVer = Number(cloudState.version || 1);
        if (cloudVer >= initialVer) {
          setBoards(cloudState.boards);
          setActiveBoardId(prev =>
            cloudState.boards.some((b: WhiteboardBoard) => b.id === prev)
              ? prev
              : cloudState.activeBoardId || cloudState.boards[0].id
          );
          setBoardVersion(cloudVer);
          boardVersionRef.current = cloudVer;
          if (cloudState.updatedBy) setLastUpdatedBy(cloudState.updatedBy);
          try {
            localStorage.setItem(localStorageKey, JSON.stringify(cloudState));
          } catch {}
        }
      }

      if (!cancelled) {
        setSyncStatus('synced');
      }

      // 3. Broadcast late-joiner state handshake request to any active peers on the canvas
      if (currentUser) {
        collabService.requestWhiteboardState({
          scopeKey,
          requesterId: currentUser.id,
          requesterName: currentUser.full_name || currentUser.email,
          knownVersion: boardVersionRef.current,
        });
      }
    };

    hydrateBoard();
    return () => {
      cancelled = true;
    };
  }, [scopeKey, selectedProjectId, localStorageKey, currentUser]);

  // Listen for remote whiteboard deltas, late-joiner state requests, full syncs, and cursors
  useEffect(() => {
    const handleRemoteDelta = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail.actorId === currentUser?.id) return;

      if (detail.version && detail.version > boardVersionRef.current) {
        boardVersionRef.current = detail.version;
        setBoardVersion(detail.version);
      }
      if (detail.actorName) {
        setLastUpdatedBy(detail.actorName);
      }

      setBoards(prev => {
        const next = prev.map(board => {
          if (board.id !== detail.boardId) return board;
          if (detail.action === 'replace_board' && detail.board) {
            return detail.board;
          }
          if (detail.action === 'upsert_node' && detail.node) {
            const exists = board.nodes.some(n => n.id === detail.node.id);
            return {
              ...board,
              version: detail.version || (board.version || 1) + 1,
              updatedBy: detail.actorName,
              updatedAt: new Date().toISOString(),
              nodes: exists
                ? board.nodes.map(n => (n.id === detail.node.id ? detail.node : n))
                : [...board.nodes, detail.node],
            };
          }
          if (detail.action === 'delete_node' && detail.nodeId) {
            return {
              ...board,
              nodes: board.nodes.filter(n => n.id !== detail.nodeId),
              connectors: board.connectors.filter(
                c => c.fromNodeId !== detail.nodeId && c.toNodeId !== detail.nodeId
              ),
            };
          }
          if (detail.action === 'upsert_connector' && detail.connector) {
            const exists = board.connectors.some(c => c.id === detail.connector.id);
            return {
              ...board,
              connectors: exists
                ? board.connectors.map(c =>
                    c.id === detail.connector.id ? detail.connector : c
                  )
                : [...board.connectors, detail.connector],
            };
          }
          if (detail.action === 'delete_connector' && detail.connectorId) {
            return {
              ...board,
              connectors: board.connectors.filter(c => c.id !== detail.connectorId),
            };
          }
          if (detail.action === 'add_stroke' && detail.stroke) {
            return {
              ...board,
              strokes: [...board.strokes, detail.stroke],
            };
          }
          if (detail.action === 'upsert_comment' && detail.comment) {
            const existingComments = board.comments || [];
            const exists = existingComments.some(c => c.id === detail.comment.id);
            return {
              ...board,
              comments: exists
                ? existingComments.map(c => (c.id === detail.comment.id ? detail.comment : c))
                : [...existingComments, detail.comment],
            };
          }
          if (detail.action === 'delete_comment' && detail.commentId) {
            return {
              ...board,
              comments: (board.comments || []).filter(c => c.id !== detail.commentId),
            };
          }
          return board;
        });

        try {
          localStorage.setItem(
            localStorageKey,
            JSON.stringify({
              boards: next,
              activeBoardId: activeBoardIdRef.current,
              version: boardVersionRef.current,
              updatedAt: new Date().toISOString(),
              updatedBy: detail.actorName,
            })
          );
        } catch {}
        return next;
      });
    };

    const handleStateRequest = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || !currentUser || detail.requesterId === currentUser.id) return;
      if (detail.scopeKey && detail.scopeKey !== scopeKey) return;

      // Respond with our authoritative board state so the late joiner immediately sees all changes
      collabService.broadcastWhiteboardFullSync({
        scopeKey,
        boards: boardsRef.current,
        activeBoardId: activeBoardIdRef.current,
        version: boardVersionRef.current,
        updatedAt: new Date().toISOString(),
        actorId: currentUser.id,
        actorName: currentUser.full_name || currentUser.email?.split('@')[0] || 'Teammate',
      });
    };

    const handleFullSync = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail.actorId === currentUser?.id) return;
      if (detail.scopeKey && detail.scopeKey !== scopeKey) return;

      const incomingVer = Number(detail.version || 1);
      if (incomingVer >= boardVersionRef.current && Array.isArray(detail.boards) && detail.boards.length > 0) {
        boardVersionRef.current = incomingVer;
        setBoardVersion(incomingVer);
        setBoards(detail.boards);
        if (detail.actorName) setLastUpdatedBy(detail.actorName);
        setSyncStatus('synced');
        try {
          localStorage.setItem(
            localStorageKey,
            JSON.stringify({
              boards: detail.boards,
              activeBoardId: detail.activeBoardId || activeBoardIdRef.current,
              version: incomingVer,
              updatedAt: detail.updatedAt || new Date().toISOString(),
              updatedBy: detail.actorName,
            })
          );
        } catch {}
      }
    };

    const handleRemoteCursor = (e: Event) => {
      const cursor = (e as CustomEvent).detail as WhiteboardCursor;
      if (!cursor || cursor.userId === currentUser?.id) return;
      setRemoteCursors(prev => ({
        ...prev,
        [cursor.userId]: { ...cursor, updatedAt: Date.now() },
      }));

      // If we are in Spotlight / Follow mode for this teammate, sync their pan/zoom!
      if (
        followingUserId &&
        cursor.userId === followingUserId &&
        typeof cursor.panX === 'number' &&
        typeof cursor.panY === 'number'
      ) {
        setPan({ x: cursor.panX, y: cursor.panY });
        if (typeof cursor.zoom === 'number') setZoom(cursor.zoom);
      }
    };

    window.addEventListener('omni_remote_whiteboard_delta', handleRemoteDelta);
    window.addEventListener('omni_remote_whiteboard_request_state', handleStateRequest);
    window.addEventListener('omni_remote_whiteboard_full_sync', handleFullSync);
    window.addEventListener('omni_remote_whiteboard_cursor', handleRemoteCursor);

    const cleanInterval = setInterval(() => {
      const now = Date.now();
      setRemoteCursors(prev => {
        const next: Record<string, WhiteboardCursor> = {};
        Object.values(prev).forEach(c => {
          if (now - c.updatedAt < 18000) next[c.userId] = c;
        });
        return next;
      });
    }, 5000);

    return () => {
      window.removeEventListener('omni_remote_whiteboard_delta', handleRemoteDelta);
      window.removeEventListener('omni_remote_whiteboard_request_state', handleStateRequest);
      window.removeEventListener('omni_remote_whiteboard_full_sync', handleFullSync);
      window.removeEventListener('omni_remote_whiteboard_cursor', handleRemoteCursor);
      clearInterval(cleanInterval);
    };
  }, [currentUser, scopeKey, localStorageKey, followingUserId]);

  // Keyboard Shortcuts: `/ ` for Cursor Chat, `V` Select, `H` Pan, `S` Sticky, `C` Comment, `E` Stamp, `Delete`/`Backspace`
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (e.key === '/' && !isInput) {
        e.preventDefault();
        setIsCursorChatOpen(true);
        return;
      }
      if (e.key === 'Escape') {
        setIsCursorChatOpen(false);
        setCursorChatText('');
        setActiveCommentId(null);
        setShowShapeMenu(false);
        setShowStampMenu(false);
        setShowEmoteMenu(false);
        setDraggingEdgeConnector(null);
        return;
      }
      if (isInput) return;

      const k = e.key.toLowerCase();
      if (k === 'v') setActiveTool('select');
      else if (k === 'h') setActiveTool('pan');
      else if (k === 's') setActiveTool('sticky');
      else if (k === 'f') setActiveTool('frame');
      else if (k === 't') setActiveTool('text');
      else if (k === 'p') setActiveTool('pen');
      else if (k === 'l') setActiveTool('connector');
      else if (k === 'e') {
        setActiveTool('stamp');
        setShowStampMenu(prev => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const updateActiveBoard = useCallback(
    (updater: (board: WhiteboardBoard) => WhiteboardBoard, broadcastFull = false) => {
      setBoards(prev => {
        const next = prev.map(b => (b.id === activeBoard.id ? updater(b) : b));
        return persistAuthoritativeState(next, activeBoard.id, true, broadcastFull);
      });
    },
    [activeBoard?.id, persistAuthoritativeState]
  );

  const selectedNode = useMemo(
    () => activeBoard?.nodes.find(n => n.id === selectedNodeId) || null,
    [activeBoard, selectedNodeId]
  );

  const screenToCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: Math.round((clientX - rect.left - pan.x) / zoom),
        y: Math.round((clientY - rect.top - pan.y) / zoom),
      };
    },
    [pan, zoom]
  );

  // Get anchor coordinates on a node's edge
  const getNodeEdgePoint = (
    node: WhiteboardNode,
    side?: 'top' | 'right' | 'bottom' | 'left'
  ) => {
    if (side === 'top') return { x: node.x + node.width / 2, y: node.y };
    if (side === 'right') return { x: node.x + node.width, y: node.y + node.height / 2 };
    if (side === 'bottom') return { x: node.x + node.width / 2, y: node.y + node.height };
    if (side === 'left') return { x: node.x, y: node.y + node.height / 2 };
    return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
  };

  // Mouse Down on Canvas
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget && activeTool === 'select') {
      return;
    }

    const pt = screenToCanvas(e.clientX, e.clientY);

    if (activeTool === 'pan' || e.button === 1 || e.spaceKey) {
      setIsPanning(true);
      setPanOrigin({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    if (activeTool === 'pen') {
      setActiveStroke([pt]);
      return;
    }

    if (activeTool === 'comment') {
      soundService.play('click_soft');
      const authorName =
        currentUser?.full_name || currentUser?.email?.split('@')[0] || 'Teammate';
      const newThread: WhiteboardCommentThread = {
        id: `comment-${Date.now()}`,
        x: pt.x,
        y: pt.y,
        authorId: currentUser?.id || 'local',
        authorName,
        authorAvatar: currentUser?.avatar_url,
        color: selectedColor,
        resolved: false,
        createdAt: new Date().toISOString(),
        replies: [],
      };
      updateActiveBoard(b => ({
        ...b,
        comments: [...(b.comments || []), newThread],
      }));
      if (currentUser) {
        collabService.broadcastWhiteboardDelta({
          boardId: activeBoard.id,
          scopeKey,
          version: boardVersionRef.current,
          action: 'upsert_comment',
          comment: newThread,
          actorId: currentUser.id,
          actorName,
        });
      }
      setActiveCommentId(newThread.id);
      setActiveTool('select');
      return;
    }

    if (
      activeTool === 'frame' ||
      activeTool === 'sticky' ||
      activeTool === 'rectangle' ||
      activeTool === 'diamond' ||
      activeTool === 'circle' ||
      activeTool === 'text' ||
      activeTool === 'doc_card'
    ) {
      soundService.play('click_soft');
      const defaultDims: Record<WhiteboardNodeType, { w: number; h: number; title: string; content: string }> = {
        frame: {
          w: 440,
          h: 320,
          title: 'Section Frame',
          content: 'Group related stickies, specs & architecture nodes',
        },
        sticky: {
          w: 220,
          h: 175,
          title: 'Brainstorm Note',
          content: 'Double-click or use the floating toolbar to edit...',
        },
        rectangle: {
          w: 210,
          h: 115,
          title: 'Service / Module',
          content: 'Component details & owner',
        },
        diamond: {
          w: 200,
          h: 130,
          title: 'Decision Gate',
          content: 'Condition / branch check',
        },
        circle: {
          w: 165,
          h: 120,
          title: 'Start / Trigger',
          content: 'Entry point',
        },
        text: {
          w: 240,
          h: 76,
          title: 'Heading Label',
          content: 'Clean typography annotation on canvas',
        },
        doc_card: {
          w: 310,
          h: 230,
          title: 'Technical Spec Card',
          content: '• Objective & context\n• Architecture invariants\n• Acceptance criteria',
        },
      };

      const spec = defaultDims[activeTool];
      const authorName =
        currentUser?.full_name || currentUser?.email?.split('@')[0] || 'Teammate';
      const newNode: WhiteboardNode = {
        id: `wb-node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: activeTool,
        x: Math.max(20, pt.x - Math.round(spec.w / 2)),
        y: Math.max(20, pt.y - Math.round(spec.h / 2)),
        width: spec.w,
        height: spec.h,
        title: spec.title,
        content: spec.content,
        color: selectedColor,
        authorId: currentUser?.id,
        authorName,
        authorAvatar: currentUser?.avatar_url,
        mentionTag: `@${authorName.split(' ')[0]}`,
        reactions: {},
        updatedAt: Date.now(),
      };

      updateActiveBoard(b => ({
        ...b,
        nodes: [...b.nodes, newNode],
      }));

      if (currentUser) {
        collabService.broadcastWhiteboardDelta({
          boardId: activeBoard.id,
          scopeKey,
          version: boardVersionRef.current,
          action: 'upsert_node',
          node: newNode,
          actorId: currentUser.id,
          actorName,
        });
      }

      setSelectedNodeId(newNode.id);
      setActiveTool('select');
      return;
    }

    setSelectedNodeId(null);
    setConnectorStartNodeId(null);
    setActiveCommentId(null);
  };

  // Mouse Move on Canvas
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const pt = screenToCanvas(e.clientX, e.clientY);
    setLocalCursorPos(pt);

    // Broadcast live cursor position, cursor chat, and pan/zoom (throttled to 65ms)
    const now = Date.now();
    if (currentUser && now - lastCursorBroadcastRef.current > 65) {
      lastCursorBroadcastRef.current = now;
      collabService.broadcastWhiteboardCursor({
        userId: currentUser.id,
        userName: currentUser.full_name || currentUser.email.split('@')[0],
        userAvatar: currentUser.avatar_url,
        color: selectedColor,
        x: pt.x,
        y: pt.y,
        activeTool,
        selectedNodeId,
        cursorChat: cursorChatText || undefined,
        zoom,
        panX: pan.x,
        panY: pan.y,
        boardId: activeBoard.id,
        updatedAt: now,
      });
    }

    if (isPanning) {
      setFollowingUserId(null);
      setPan({
        x: e.clientX - panOrigin.x,
        y: e.clientY - panOrigin.y,
      });
      return;
    }

    if (draggingEdgeConnector) {
      setDraggingEdgeConnector(prev =>
        prev ? { ...prev, currentX: pt.x, currentY: pt.y } : null
      );
      return;
    }

    if (activeTool === 'pen' && activeStroke) {
      setActiveStroke(prev => (prev ? [...prev, pt] : [pt]));
      return;
    }

    if (draggingNodeId) {
      const nextX = Math.max(0, pt.x - dragOffset.x);
      const nextY = Math.max(0, pt.y - dragOffset.y);
      setBoards(prev =>
        prev.map(b => {
          if (b.id !== activeBoard.id) return b;
          return {
            ...b,
            nodes: b.nodes.map(n =>
              n.id === draggingNodeId ? { ...n, x: nextX, y: nextY, updatedAt: now } : n
            ),
          };
        })
      );
      return;
    }

    if (resizingNodeId) {
      setBoards(prev =>
        prev.map(b => {
          if (b.id !== activeBoard.id) return b;
          return {
            ...b,
            nodes: b.nodes.map(n => {
              if (n.id !== resizingNodeId) return n;
              return {
                ...n,
                width: Math.max(150, pt.x - n.x),
                height: Math.max(95, pt.y - n.y),
                updatedAt: now,
              };
            }),
          };
        })
      );
    }
  };

  // Mouse Up on Canvas
  const handleCanvasMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
    }

    if (draggingEdgeConnector) {
      // Check if mouse released over a target node
      const targetNode = activeBoard.nodes.find(
        n =>
          n.id !== draggingEdgeConnector.fromNodeId &&
          draggingEdgeConnector.currentX >= n.x - 16 &&
          draggingEdgeConnector.currentX <= n.x + n.width + 16 &&
          draggingEdgeConnector.currentY >= n.y - 16 &&
          draggingEdgeConnector.currentY <= n.y + n.height + 16
      );
      if (targetNode) {
        const newConn: WhiteboardConnector = {
          id: `conn-${Date.now()}`,
          fromNodeId: draggingEdgeConnector.fromNodeId,
          toNodeId: targetNode.id,
          fromSide: draggingEdgeConnector.fromSide,
          toSide: 'left',
          label: 'Flow',
          color: selectedColor,
          style: 'solid',
        };
        updateActiveBoard(b => ({
          ...b,
          connectors: [...b.connectors, newConn],
        }));
        if (currentUser) {
          collabService.broadcastWhiteboardDelta({
            boardId: activeBoard.id,
            scopeKey,
            version: boardVersionRef.current,
            action: 'upsert_connector',
            connector: newConn,
            actorId: currentUser.id,
            actorName: currentUser.full_name || currentUser.email,
          });
        }
        soundService.play('click_soft');
      }
      setDraggingEdgeConnector(null);
    }

    if (activeTool === 'pen' && activeStroke && activeStroke.length > 1) {
      const newStroke: WhiteboardStroke = {
        id: `stroke-${Date.now()}`,
        points: activeStroke,
        color: selectedColor,
        strokeWidth: 3.5,
        authorName: currentUser?.full_name || 'Teammate',
      };
      updateActiveBoard(b => ({
        ...b,
        strokes: [...b.strokes, newStroke],
      }));
      if (currentUser) {
        collabService.broadcastWhiteboardDelta({
          boardId: activeBoard.id,
          scopeKey,
          version: boardVersionRef.current,
          action: 'add_stroke',
          stroke: newStroke,
          actorId: currentUser.id,
          actorName: currentUser.full_name || currentUser.email,
        });
      }
      setActiveStroke(null);
    } else if (activeStroke) {
      setActiveStroke(null);
    }

    if (draggingNodeId) {
      const movedNode = activeBoard.nodes.find(n => n.id === draggingNodeId);
      if (movedNode) {
        persistAuthoritativeState(boardsRef.current, activeBoard.id, true, false);
        if (currentUser) {
          collabService.broadcastWhiteboardDelta({
            boardId: activeBoard.id,
            scopeKey,
            version: boardVersionRef.current,
            action: 'upsert_node',
            node: movedNode,
            actorId: currentUser.id,
            actorName: currentUser.full_name || currentUser.email,
          });
        }
      }
      setDraggingNodeId(null);
    }

    if (resizingNodeId) {
      const resizedNode = activeBoard.nodes.find(n => n.id === resizingNodeId);
      if (resizedNode) {
        persistAuthoritativeState(boardsRef.current, activeBoard.id, true, false);
        if (currentUser) {
          collabService.broadcastWhiteboardDelta({
            boardId: activeBoard.id,
            scopeKey,
            version: boardVersionRef.current,
            action: 'upsert_node',
            node: resizedNode,
            actorId: currentUser.id,
            actorName: currentUser.full_name || currentUser.email,
          });
        }
      }
      setResizingNodeId(null);
    }
  };

  const handleNodeMouseDown = (e: React.MouseEvent, node: WhiteboardNode) => {
    e.stopPropagation();

    if (activeTool === 'stamp') {
      handleReactToNode(node, selectedStamp);
      return;
    }

    if (activeTool === 'connector') {
      if (!connectorStartNodeId) {
        setConnectorStartNodeId(node.id);
        addToast('Connector Started', `Click another node to connect from "${node.title || 'Node'}".`, 'info');
      } else if (connectorStartNodeId !== node.id) {
        const newConn: WhiteboardConnector = {
          id: `conn-${Date.now()}`,
          fromNodeId: connectorStartNodeId,
          toNodeId: node.id,
          label: 'Flow',
          color: selectedColor,
          style: 'solid',
        };
        updateActiveBoard(b => ({
          ...b,
          connectors: [...b.connectors, newConn],
        }));
        if (currentUser) {
          collabService.broadcastWhiteboardDelta({
            boardId: activeBoard.id,
            scopeKey,
            version: boardVersionRef.current,
            action: 'upsert_connector',
            connector: newConn,
            actorId: currentUser.id,
            actorName: currentUser.full_name || currentUser.email,
          });
        }
        setConnectorStartNodeId(null);
        setActiveTool('select');
      }
      return;
    }

    setSelectedNodeId(node.id);
    const pt = screenToCanvas(e.clientX, e.clientY);
    setDraggingNodeId(node.id);
    setDragOffset({ x: pt.x - node.x, y: pt.y - node.y });
  };

  const handleUpdateSelectedNode = (updates: Partial<WhiteboardNode>) => {
    if (!selectedNode) return;
    const updatedNode: WhiteboardNode = {
      ...selectedNode,
      ...updates,
      updatedAt: Date.now(),
    };
    updateActiveBoard(b => ({
      ...b,
      nodes: b.nodes.map(n => (n.id === updatedNode.id ? updatedNode : n)),
    }));
    if (currentUser) {
      collabService.broadcastWhiteboardDelta({
        boardId: activeBoard.id,
        scopeKey,
        version: boardVersionRef.current,
        action: 'upsert_node',
        node: updatedNode,
        actorId: currentUser.id,
        actorName: currentUser.full_name || currentUser.email,
      });
    }
  };

  const handleDuplicateSelectedNode = () => {
    if (!selectedNode) return;
    soundService.play('click_soft');
    const copy: WhiteboardNode = {
      ...selectedNode,
      id: `wb-node-${Date.now()}`,
      x: selectedNode.x + 28,
      y: selectedNode.y + 28,
      updatedAt: Date.now(),
    };
    updateActiveBoard(b => ({
      ...b,
      nodes: [...b.nodes, copy],
    }));
    if (currentUser) {
      collabService.broadcastWhiteboardDelta({
        boardId: activeBoard.id,
        scopeKey,
        version: boardVersionRef.current,
        action: 'upsert_node',
        node: copy,
        actorId: currentUser.id,
        actorName: currentUser.full_name || currentUser.email,
      });
    }
    setSelectedNodeId(copy.id);
  };

  const handleDeleteSelectedNode = () => {
    if (!selectedNode) return;
    soundService.play('click_soft');
    const targetId = selectedNode.id;
    updateActiveBoard(b => ({
      ...b,
      nodes: b.nodes.filter(n => n.id !== targetId),
      connectors: b.connectors.filter(
        c => c.fromNodeId !== targetId && c.toNodeId !== targetId
      ),
    }));
    if (currentUser) {
      collabService.broadcastWhiteboardDelta({
        boardId: activeBoard.id,
        scopeKey,
        version: boardVersionRef.current,
        action: 'delete_node',
        nodeId: targetId,
        actorId: currentUser.id,
        actorName: currentUser.full_name || currentUser.email,
      });
    }
    setSelectedNodeId(null);
  };

  const handleReactToNode = (node: WhiteboardNode, emoji: string) => {
    soundService.play('click_soft');
    const currentReactions = node.reactions || {};
    const updatedNode: WhiteboardNode = {
      ...node,
      reactions: {
        ...currentReactions,
        [emoji]: (currentReactions[emoji] || 0) + 1,
      },
      updatedAt: Date.now(),
    };
    updateActiveBoard(b => ({
      ...b,
      nodes: b.nodes.map(n => (n.id === updatedNode.id ? updatedNode : n)),
    }));
    if (currentUser) {
      collabService.broadcastWhiteboardDelta({
        boardId: activeBoard.id,
        scopeKey,
        version: boardVersionRef.current,
        action: 'upsert_node',
        node: updatedNode,
        actorId: currentUser.id,
        actorName: currentUser.full_name || currentUser.email,
      });
    }
  };

  // 1-Click Convert Sticky/Node to Kanban Task
  const handleConvertNodeToTask = async (node: WhiteboardNode) => {
    const targetProjectId =
      selectedProjectId !== 'default'
        ? selectedProjectId
        : activeProject?.id || projects[0]?.id;

    if (!targetProjectId) {
      addToast('Select a Project', 'Please create or select a project to convert this card into a Kanban task.', 'warning');
      return;
    }

    try {
      soundService.play('task_complete');
      const created = await createTask({
        title: node.title
          ? `${node.title}: ${node.content.slice(0, 60)}`
          : node.content.slice(0, 80),
        description: `Converted from Collaborative Whiteboard ("${activeBoard.name}" v${boardVersion})\n\n${node.content}`,
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        projectId: targetProjectId,
        assignee_id: currentUser?.id,
        tags: ['whiteboard', node.type],
      });

      if (created?.id) {
        const updatedNode: WhiteboardNode = {
          ...node,
          linkedTaskId: created.id,
          updatedAt: Date.now(),
        };
        updateActiveBoard(b => ({
          ...b,
          nodes: b.nodes.map(n => (n.id === node.id ? updatedNode : n)),
        }));
        if (currentUser) {
          collabService.broadcastWhiteboardDelta({
            boardId: activeBoard.id,
            scopeKey,
            version: boardVersionRef.current,
            action: 'upsert_node',
            node: updatedNode,
            actorId: currentUser.id,
            actorName: currentUser.full_name || currentUser.email,
          });
        }
        addToast(
          'Converted to Kanban Task',
          `"${created.title}" is now live on your Kanban board.`,
          'success'
        );
      }
    } catch {
      addToast('Task Conversion Error', 'Could not convert node to task.', 'error');
    }
  };

  // Add Reply to Pinned Comment Thread
  const handleAddCommentReply = (thread: WhiteboardCommentThread) => {
    if (!commentReplyDraft.trim()) return;
    soundService.play('click_soft');
    const authorName =
      currentUser?.full_name || currentUser?.email?.split('@')[0] || 'Teammate';
    const updatedThread: WhiteboardCommentThread = {
      ...thread,
      replies: [
        ...thread.replies,
        {
          id: `rep-${Date.now()}`,
          authorId: currentUser?.id || 'local',
          authorName,
          authorAvatar: currentUser?.avatar_url,
          text: commentReplyDraft.trim(),
          createdAt: new Date().toISOString(),
        },
      ],
    };
    setCommentReplyDraft('');
    updateActiveBoard(b => ({
      ...b,
      comments: (b.comments || []).map(c => (c.id === thread.id ? updatedThread : c)),
    }));
    if (currentUser) {
      collabService.broadcastWhiteboardDelta({
        boardId: activeBoard.id,
        scopeKey,
        version: boardVersionRef.current,
        action: 'upsert_comment',
        comment: updatedThread,
        actorId: currentUser.id,
        actorName,
      });
    }
  };

  // Save Named Version Snapshot
  const handleCreateVersionSnapshot = () => {
    soundService.play('click_soft');
    const label =
      snapshotLabelInput.trim() ||
      `Snapshot v${boardVersion} · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const snap: WhiteboardVersionSnapshot = {
      id: `snap-${Date.now()}`,
      version: boardVersion,
      label,
      createdAt: new Date().toISOString(),
      authorName: currentUser?.full_name || currentUser?.email?.split('@')[0] || 'Teammate',
      nodes: activeBoard.nodes,
      connectors: activeBoard.connectors,
      strokes: activeBoard.strokes,
      comments: activeBoard.comments || [],
    };
    setSnapshotLabelInput('');
    updateActiveBoard(
      b => ({
        ...b,
        history: [snap, ...(b.history || [])].slice(0, 25),
      }),
      true
    );
    addToast('Version Snapshot Saved', `Saved "${label}" to board history.`, 'success');
  };

  const handleRestoreSnapshot = (snap: WhiteboardVersionSnapshot) => {
    soundService.play('click_soft');
    updateActiveBoard(
      b => ({
        ...b,
        nodes: snap.nodes,
        connectors: snap.connectors,
        strokes: snap.strokes,
        comments: snap.comments || [],
      }),
      true
    );
    addToast('Version Restored', `Reverted board to "${snap.label}".`, 'info');
    setShowHistoryDrawer(false);
  };

  // Share Interactive Board Card to Team Chat
  const handleShareBoardToChat = async () => {
    if (!currentUser) return;
    soundService.play('task_complete');
    const cardSummary = `🎨 **Shared Live Whiteboard: ${activeBoard.name}** (v${boardVersion})\n• **${activeBoard.nodes.length}** canvas nodes · **${activeBoard.connectors.length}** connectors · **${(activeBoard.comments || []).length}** comment threads\n${shareNote.trim() ? `• Note: "${shareNote.trim()}"\n` : ''}👉 Open **Whiteboard Studio** in the sidebar to view and co-edit in real time!`;

    chatService.sendMessage(
      shareChannelId,
      cardSummary,
      currentUser,
      undefined,
      false
    );
    setShowShareModal(false);
    setShareNote('');
    addToast(
      'Shared to Team Chat',
      `Posted "${activeBoard.name}" (v${boardVersion}) to #${shareChannelId}.`,
      'success'
    );
  };

  // Load Starter Template
  const handleApplyTemplate = (kind: 'arch' | 'retro' | 'flow') => {
    soundService.play('click_soft');
    const built =
      kind === 'arch'
        ? buildArchitectureTemplate(selectedProjectId)
        : kind === 'retro'
          ? buildRetroTemplate(selectedProjectId)
          : buildUserFlowTemplate(selectedProjectId);

    const existing = boards.find(b => b.id === built.id);
    if (existing) {
      setActiveBoardId(existing.id);
      const nextBoards = boards.map(b => (b.id === built.id ? built : b));
      setBoards(persistAuthoritativeState(nextBoards, built.id, true, true));
    } else {
      const nextBoards = [...boards, built];
      setActiveBoardId(built.id);
      setBoards(persistAuthoritativeState(nextBoards, built.id, true, true));
    }
    setSelectedNodeId(null);
    addToast('Template Loaded', `Switched to "${built.name}" and synced with teammates.`, 'info');
  };

  // Add a New Blank Board / Page
  const handleCreateNewBoardPage = () => {
    soundService.play('click_soft');
    const pageNum = boards.length + 1;
    const newBoard: WhiteboardBoard = {
      id: `wb-page-${Date.now()}`,
      name: `Page ${pageNum} · Brainstorm Canvas`,
      projectId: selectedProjectId,
      version: boardVersion + 1,
      updatedBy: currentUser?.full_name || 'Teammate',
      updatedAt: new Date().toISOString(),
      nodes: [
        {
          id: `node-welcome-${Date.now()}`,
          type: 'sticky',
          x: 260,
          y: 180,
          width: 240,
          height: 175,
          title: `Page ${pageNum} Kickoff`,
          content: 'Drop stickies, draw freehand, or press / for live cursor chat!',
          color: '#0ea5e9',
          authorName: currentUser?.full_name || 'Teammate',
          mentionTag: '@Team',
          reactions: { '🚀': 1 },
          updatedAt: Date.now(),
        },
      ],
      connectors: [],
      strokes: [],
      comments: [],
    };
    const nextBoards = [...boards, newBoard];
    setActiveBoardId(newBoard.id);
    setBoards(persistAuthoritativeState(nextBoards, newBoard.id, true, true));
    setShowPagesDrawer(false);
    addToast('New Page Created', `Created "${newBoard.name}".`, 'success');
  };

  // Export Board as SVG or JSON
  const handleExportBoard = (formatType: 'svg' | 'json') => {
    soundService.play('click_soft');
    const safeName = activeBoard.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    if (formatType === 'json') {
      const blob = new Blob([JSON.stringify(activeBoard, null, 2)], {
        type: 'application/json;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeName}-v${boardVersion}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast('Exported Whiteboard JSON', `Saved ${safeName}-v${boardVersion}.json`, 'success');
      return;
    }

    const svgParts: string[] = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">`,
      `<rect width="100%" height="100%" fill="${darkMode ? '#0f172a' : '#f8fafc'}" />`,
    ];

    activeBoard.connectors.forEach(c => {
      const from = activeBoard.nodes.find(n => n.id === c.fromNodeId);
      const to = activeBoard.nodes.find(n => n.id === c.toNodeId);
      if (!from || !to) return;
      const x1 = from.x + from.width / 2;
      const y1 = from.y + from.height / 2;
      const x2 = to.x + to.width / 2;
      const y2 = to.y + to.height / 2;
      svgParts.push(
        `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c.color}" stroke-width="2.5" />`
      );
    });

    activeBoard.nodes.forEach(n => {
      svgParts.push(
        `<rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" rx="18" fill="${
          darkMode ? '#1e293b' : '#ffffff'
        }" stroke="${n.color}" stroke-width="2" />`,
        `<text x="${n.x + 16}" y="${n.y + 28}" fill="${
          darkMode ? '#f8fafc' : '#0f172a'
        }" font-family="sans-serif" font-size="14" font-weight="bold">${(n.title || n.type).replace(
          /[<>&]/g,
          ''
        )}</text>`,
        `<text x="${n.x + 16}" y="${n.y + 52}" fill="${
          darkMode ? '#94a3b8' : '#475569'
        }" font-family="sans-serif" font-size="12">${n.content
          .slice(0, 75)
          .replace(/[<>&]/g, '')}</text>`
      );
    });

    svgParts.push(`</svg>`);
    const blob = new Blob([svgParts.join('\n')], { type: 'image/svg+xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}-v${boardVersion}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast('Exported Whiteboard SVG', `Saved ${safeName}-v${boardVersion}.svg`, 'success');
  };

  const remoteCursorList = Object.values(remoteCursors).filter(
    c => c.boardId === activeBoard?.id
  );

  // Compute Floating Context Bar screen position above the selected node
  const selectedNodeContextPos = useMemo(() => {
    if (!selectedNode) return null;
    return {
      left: Math.max(16, selectedNode.x * zoom + pan.x + (selectedNode.width * zoom) / 2),
      top: Math.max(68, selectedNode.y * zoom + pan.y - 54),
    };
  }, [selectedNode, zoom, pan]);

  return (
    <div
      className={`flex-1 flex flex-col h-full min-h-0 overflow-hidden select-none relative ${
        darkMode ? 'bg-[#0B0F19] text-slate-100' : 'bg-[#F4F4F6] text-slate-900'
      }`}
    >
      {/* 1. FIGMA / NOTION / FRAME FLOATING TOP BAR (Clean 3-Zone Contract) */}
      <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between gap-3 pointer-events-none">
        {/* Zone 1 (Left): Board Switcher Pill, Project Selector & Version Sync Badge */}
        <div
          className={`pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-2xl border shadow-lg backdrop-blur-xl ${
            darkMode
              ? 'bg-slate-900/90 border-white/10 text-slate-100'
              : 'bg-white/95 border-slate-200/90 text-slate-900'
          }`}
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-rose-500 flex items-center justify-center text-white shadow-sm shrink-0">
            <ICON_MAP.SparklesIcon className="w-4 h-4" />
          </div>

          {/* Board / Template Switcher */}
          <select
            value={activeBoard?.id || ''}
            onChange={e => {
              const val = e.target.value;
              if (val === '__tpl_arch') handleApplyTemplate('arch');
              else if (val === '__tpl_retro') handleApplyTemplate('retro');
              else if (val === '__tpl_flow') handleApplyTemplate('flow');
              else if (val === '__new_page') handleCreateNewBoardPage();
              else setActiveBoardId(val);
            }}
            className={`text-xs font-bold bg-transparent outline-none cursor-pointer pr-1 max-w-[200px] sm:max-w-[240px] truncate ${
              darkMode ? 'text-white' : 'text-slate-900'
            }`}
          >
            <optgroup label="Workspace Boards">
              {boards.map(b => (
                <option key={b.id} value={b.id} className={darkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>
                  {b.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Starter Templates">
              <option value="__tpl_arch" className={darkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>
                + Reset Community Portal & Spec
              </option>
              <option value="__tpl_retro" className={darkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>
                + Load Sprint Retrospective
              </option>
              <option value="__tpl_flow" className={darkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>
                + Load Customer Journey Flow
              </option>
              <option value="__new_page" className={darkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>
                + New Blank Page...
              </option>
            </optgroup>
          </select>

          {!compactMode && (
            <>
              <span className="text-slate-400">·</span>
              <select
                value={selectedProjectId}
                onChange={e => setSelectedProjectId(e.target.value)}
                className={`text-[11px] font-medium bg-transparent outline-none cursor-pointer max-w-[140px] truncate ${
                  darkMode ? 'text-slate-300' : 'text-slate-600'
                }`}
              >
                <option value="default" className={darkMode ? 'bg-slate-900' : 'bg-white'}>
                  All Projects
                </option>
                {projects.map(p => (
                  <option key={p.id} value={p.id} className={darkMode ? 'bg-slate-900' : 'bg-white'}>
                    {p.name}
                  </option>
                ))}
              </select>
            </>
          )}

          <span className="text-slate-400">·</span>

          {/* Authoritative Version & Cloud Sync Button */}
          <button
            type="button"
            onClick={() => setShowHistoryDrawer(prev => !prev)}
            title="View Version History & Restore Previous Snapshots"
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-mono tabular-nums transition-colors cursor-pointer whitespace-nowrap ${
              darkMode
                ? 'hover:bg-slate-800 text-emerald-400'
                : 'hover:bg-slate-100 text-emerald-700'
            }`}
          >
            <span>v{boardVersion}</span>
            <span className="text-slate-400">·</span>
            <span className="font-sans font-medium">
              {syncStatus === 'syncing'
                ? 'Saving...'
                : syncStatus === 'loading'
                  ? 'Syncing...'
                  : 'Synced'}
            </span>
          </button>
        </div>

        {/* Zone 2 (Right): Collaborator Avatars (Click to Follow), Cursor Chat / Stamp Menu, Zoom & Share CTA */}
        <div
          className={`pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-2xl border shadow-lg backdrop-blur-xl ${
            darkMode
              ? 'bg-slate-900/90 border-white/10 text-slate-100'
              : 'bg-white/95 border-slate-200/90 text-slate-900'
          }`}
        >
          {/* Active Collaborators Stack with 1-Click Follow Mode */}
          <div className="flex items-center -space-x-1.5 mr-1">
            <div
              className="w-7 h-7 rounded-full ring-2 ring-indigo-500 bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center"
              title={`You (${currentUser?.full_name || 'Active'})`}
            >
              {(currentUser?.full_name || currentUser?.email || 'U').charAt(0).toUpperCase()}
            </div>
            {remoteCursorList.map(rc => {
              const isFollowing = followingUserId === rc.userId;
              return (
                <button
                  key={rc.userId}
                  type="button"
                  onClick={() => {
                    const nextFollow = isFollowing ? null : rc.userId;
                    setFollowingUserId(nextFollow);
                    if (nextFollow) {
                      addToast('Following Teammate', `Spotlight locked onto ${rc.userName}'s viewport.`, 'info');
                    }
                  }}
                  style={{ backgroundColor: rc.color }}
                  className={`w-7 h-7 rounded-full ring-2 text-white text-[11px] font-bold flex items-center justify-center transition-transform hover:scale-110 cursor-pointer ${
                    isFollowing ? 'ring-amber-400 scale-110' : 'ring-white dark:ring-slate-900'
                  }`}
                  title={
                    isFollowing
                      ? `Following ${rc.userName} (Click to unfollow)`
                      : `Click to Follow ${rc.userName}'s Viewport`
                  }
                >
                  {rc.userName.charAt(0).toUpperCase()}
                </button>
              );
            })}
          </div>

          {/* FigJam Emote / Stamp / Cursor Chat Popover Menu (`C` in Reference 1) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmoteMenu(prev => !prev)}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
                showEmoteMenu || isCursorChatOpen
                  ? 'bg-indigo-600 text-white'
                  : darkMode
                    ? 'hover:bg-slate-800 text-slate-300'
                    : 'hover:bg-slate-100 text-slate-700'
              }`}
              title="Cursor Chat (/), Stamps & Emotes (E)"
            >
              <ICON_MAP.SparklesIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Interact</span>
              <span className="text-[10px] opacity-70">▾</span>
            </button>

            {showEmoteMenu && (
              <div
                className={`absolute right-0 mt-2 w-52 rounded-2xl border p-1.5 shadow-2xl z-50 ${
                  darkMode
                    ? 'bg-slate-900 border-white/10 text-slate-100'
                    : 'bg-white border-slate-200 text-slate-800'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setIsCursorChatOpen(true);
                    setShowEmoteMenu(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    darkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>💬</span>
                    <span>Cursor chat</span>
                  </span>
                  <kbd className="text-[10px] font-mono opacity-60">/</kbd>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTool('stamp');
                    setShowStampMenu(true);
                    setShowEmoteMenu(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    darkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>⭐</span>
                    <span>Stamp sticker</span>
                  </span>
                  <kbd className="text-[10px] font-mono opacity-60">E</kbd>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTool('comment');
                    setShowEmoteMenu(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    darkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>📌</span>
                    <span>Pin comment thread</span>
                  </span>
                  <kbd className="text-[10px] font-mono opacity-60">C</kbd>
                </button>
              </div>
            )}
          </div>

          {/* Zoom Controls (`- 100% +`) */}
          <div
            className={`hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-xl border ${
              darkMode ? 'border-white/10 bg-slate-800/70' : 'border-slate-200 bg-slate-100/80'
            }`}
          >
            <button
              type="button"
              onClick={() => setZoom(z => Math.max(0.4, Math.round((z - 0.15) * 100) / 100))}
              className="px-1.5 text-xs font-bold hover:text-indigo-500 cursor-pointer"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setPan({ x: 30, y: 20 });
              }}
              className="text-[11px] font-mono font-bold tabular-nums px-1 cursor-pointer"
              title="Reset Zoom to 100%"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setZoom(z => Math.min(2, Math.round((z + 0.15) * 100) / 100))}
              className="px-1.5 text-xs font-bold hover:text-indigo-500 cursor-pointer"
            >
              +
            </button>
          </div>

          {/* Primary Share / Export Action Button */}
          <button
            type="button"
            onClick={() => setShowShareModal(true)}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Share
          </button>

          {compactMode && onCloseCompact && (
            <button
              type="button"
              onClick={onCloseCompact}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                darkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
              }`}
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* FOLLOWING SPOTLIGHT BANNER */}
      {followingUserId && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-1.5 rounded-full bg-amber-500 text-slate-950 text-xs font-bold shadow-lg">
          <span>
            Following {remoteCursors[followingUserId]?.userName || 'Teammate'}'s live viewport
          </span>
          <button
            type="button"
            onClick={() => setFollowingUserId(null)}
            className="px-2 py-0.5 rounded-full bg-black/15 hover:bg-black/25 text-[11px] cursor-pointer"
          >
            Stop
          </button>
        </div>
      )}

      {/* 2. FLOATING CONTEXTUAL NODE POPOVER BAR (Directly Above Selected Node, Like Image 2) */}
      {selectedNode && selectedNodeContextPos && (
        <div
          style={{
            left: selectedNodeContextPos.left,
            top: selectedNodeContextPos.top,
            transform: 'translateX(-50%)',
          }}
          className={`absolute z-30 flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl border shadow-2xl backdrop-blur-xl ${
            darkMode
              ? 'bg-slate-900/95 border-white/15 text-slate-100'
              : 'bg-white/95 border-slate-200 text-slate-800'
          }`}
          onMouseDown={e => e.stopPropagation()}
        >
          {/* Color Swatch Picker */}
          <div className="flex items-center gap-1 pr-1.5 border-r border-slate-300/30">
            {NODE_COLORS.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setSelectedColor(c.hex);
                  handleUpdateSelectedNode({ color: c.hex });
                }}
                style={{ backgroundColor: c.hex }}
                className={`w-4 h-4 rounded-full transition-transform cursor-pointer ${
                  selectedNode.color === c.hex ? 'scale-125 ring-2 ring-offset-1 ring-indigo-500' : ' opacity-80 hover:opacity-100'
                }`}
                title={c.label}
              />
            ))}
          </div>

          {/* @Mention / Tag Label Input */}
          <input
            type="text"
            value={selectedNode.mentionTag || ''}
            onChange={e => handleUpdateSelectedNode({ mentionTag: e.target.value })}
            placeholder="@Tag / Owner"
            className={`w-24 px-2 py-1 rounded-lg text-[11px] font-semibold outline-none border ${
              darkMode
                ? 'bg-slate-800 border-white/10 text-slate-100'
                : 'bg-slate-100 border-slate-200 text-slate-800'
            }`}
          />

          {/* Quick Stamp Reaction Buttons */}
          <div className="flex items-center gap-0.5 px-1 border-r border-slate-300/30">
            {STAMP_EMOJIS.slice(0, 4).map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleReactToNode(selectedNode, emoji)}
                className={`w-6 h-6 rounded-lg text-xs flex items-center justify-center transition-transform hover:scale-110 cursor-pointer ${
                  darkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                }`}
                title={`Stamp ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* 1-Click Convert to Kanban Task */}
          {selectedNode.linkedTaskId ? (
            <button
              type="button"
              onClick={() => {
                const found = tasks.find(t => t.id === selectedNode.linkedTaskId);
                if (found) openViewTaskModal(found);
                else setActiveView('kanban');
              }}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 cursor-pointer whitespace-nowrap"
            >
              Open Task ↗
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleConvertNodeToTask(selectedNode)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-600 text-white hover:bg-indigo-500 cursor-pointer whitespace-nowrap"
              title="Convert this note into a tracked Kanban task"
            >
              + To Task
            </button>
          )}

          {/* Duplicate Node */}
          <button
            type="button"
            onClick={handleDuplicateSelectedNode}
            className={`p-1.5 rounded-lg text-xs cursor-pointer ${
              darkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
            }`}
            title="Duplicate Node"
          >
            ⧉
          </button>

          {/* Delete Node */}
          <button
            type="button"
            onClick={handleDeleteSelectedNode}
            className="p-1.5 rounded-lg text-xs text-rose-500 hover:bg-rose-500/10 cursor-pointer"
            title="Delete Node"
          >
            <ICON_MAP.TrashIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 3. INFINITE PAN/ZOOM INTERACTIVE CANVAS */}
      <div
        ref={canvasRef}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        style={{
          backgroundImage:
            gridStyle === 'dots'
              ? `radial-gradient(${darkMode ? '#334155' : '#cbd5e1'} 1.35px, transparent 1.35px)`
              : `linear-gradient(to right, ${
                  darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.05)'
                } 1px, transparent 1px), linear-gradient(to bottom, ${
                  darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.05)'
                } 1px, transparent 1px)`,
          backgroundSize: `${22 * zoom}px ${22 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
        className={`flex-1 relative overflow-hidden ${
          activeTool === 'pan' || isPanning
            ? 'cursor-grab active:cursor-grabbing'
            : activeTool === 'pen' || activeTool === 'comment' || activeTool === 'stamp'
              ? 'cursor-crosshair'
              : 'cursor-default'
        }`}
      >
        {/* Transformed World Container */}
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
          className="absolute inset-0 pointer-events-none"
        >
          {/* SVG Layer for Curved Connectors, Active Edge-Drag Line & Freehand Pen Strokes */}
          <svg
            width="4000"
            height="3000"
            className="absolute top-0 left-0 overflow-visible pointer-events-none z-10"
          >
            <defs>
              <marker
                id="wb-arrow"
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748b" />
              </marker>
            </defs>

            {/* Saved Directed Connectors */}
            {activeBoard?.connectors.map(conn => {
              const fromNode = activeBoard.nodes.find(n => n.id === conn.fromNodeId);
              const toNode = activeBoard.nodes.find(n => n.id === conn.toNodeId);
              if (!fromNode || !toNode) return null;

              const start = getNodeEdgePoint(fromNode, conn.fromSide || 'right');
              const end = getNodeEdgePoint(toNode, conn.toSide || 'left');
              const midX = (start.x + end.x) / 2;
              const midY = (start.y + end.y) / 2;
              const dPath = `M ${start.x} ${start.y} C ${midX} ${start.y}, ${midX} ${end.y}, ${end.x} ${end.y}`;

              return (
                <g key={conn.id}>
                  <path
                    d={dPath}
                    fill="none"
                    stroke={conn.color || '#64748b'}
                    strokeWidth={2.5}
                    strokeDasharray={conn.style === 'dashed' ? '6 6' : undefined}
                    markerEnd="url(#wb-arrow)"
                  />
                  {conn.label && (
                    <g transform={`translate(${midX}, ${midY})`}>
                      <rect
                        x={-38}
                        y={-11}
                        width={76}
                        height={22}
                        rx={7}
                        fill={darkMode ? '#0f172a' : '#ffffff'}
                        stroke={conn.color || '#64748b'}
                        strokeWidth={1.2}
                      />
                      <text
                        x={0}
                        y={4}
                        textAnchor="middle"
                        fill={darkMode ? '#e2e8f0' : '#1e293b'}
                        fontSize={10}
                        fontWeight="bold"
                      >
                        {conn.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Live Edge-Drag Connector Preview */}
            {draggingEdgeConnector && (
              <path
                d={`M ${draggingEdgeConnector.startX} ${draggingEdgeConnector.startY} C ${
                  (draggingEdgeConnector.startX + draggingEdgeConnector.currentX) / 2
                } ${draggingEdgeConnector.startY}, ${
                  (draggingEdgeConnector.startX + draggingEdgeConnector.currentX) / 2
                } ${draggingEdgeConnector.currentY}, ${draggingEdgeConnector.currentX} ${
                  draggingEdgeConnector.currentY
                }`}
                fill="none"
                stroke={selectedColor}
                strokeWidth={2.5}
                strokeDasharray="5 5"
                markerEnd="url(#wb-arrow)"
              />
            )}

            {/* Freehand Pen Strokes */}
            {activeBoard?.strokes.map(stroke => {
              if (stroke.points.length < 2) return null;
              const d = stroke.points
                .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
                .join(' ');
              return (
                <path
                  key={stroke.id}
                  d={d}
                  fill="none"
                  stroke={stroke.color}
                  strokeWidth={stroke.strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            })}

            {/* Current Active Pen Stroke */}
            {activeStroke && activeStroke.length > 1 && (
              <path
                d={activeStroke
                  .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
                  .join(' ')}
                fill="none"
                stroke={selectedColor}
                strokeWidth={3.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>

          {/* Render Canvas Nodes (Frames first, then Stickies, Shapes & Doc Cards) */}
          {[...(activeBoard?.nodes || [])]
            .sort((a, b) => (a.type === 'frame' ? -1 : b.type === 'frame' ? 1 : 0))
            .map(node => {
              const isSelected = selectedNodeId === node.id;
              const isConnectSource = connectorStartNodeId === node.id;
              const remoteSelector = remoteCursorList.find(c => c.selectedNodeId === node.id);
              const colorSpec =
                NODE_COLORS.find(c => c.hex.toLowerCase() === node.color?.toLowerCase()) ||
                NODE_COLORS[0];

              const reactionEntries = Object.entries(node.reactions || {}).filter(
                ([, count]) => count > 0
              );

              return (
                <div
                  key={node.id}
                  onMouseDown={e => handleNodeMouseDown(e, node)}
                  style={{
                    left: node.x,
                    top: node.y,
                    width: node.width,
                    height: node.height,
                    backgroundColor:
                      node.type === 'sticky'
                        ? darkMode
                          ? colorSpec.darkBg
                          : colorSpec.pastelBg
                        : node.type === 'frame'
                          ? darkMode
                            ? 'rgba(15, 23, 42, 0.38)'
                            : 'rgba(255, 255, 255, 0.55)'
                          : darkMode
                            ? '#111827'
                            : '#ffffff',
                    borderColor: isSelected
                      ? '#4f46e5'
                      : remoteSelector
                        ? remoteSelector.color
                        : node.type === 'sticky' && !darkMode
                          ? colorSpec.pastelBorder
                          : node.color,
                  }}
                  className={`group absolute pointer-events-auto transition-shadow flex flex-col justify-between p-4 ${
                    node.type === 'circle'
                      ? 'rounded-full text-center items-center justify-center'
                      : node.type === 'frame'
                        ? 'rounded-3xl border-2 border-dashed'
                        : 'rounded-[22px] border-2'
                  } ${
                    isSelected
                      ? 'ring-4 ring-indigo-500/25 shadow-2xl z-20'
                      : isConnectSource
                        ? 'ring-4 ring-amber-500/40 z-20'
                        : 'shadow-md hover:shadow-xl z-10'
                  }`}
                >
                  {/* Notion / FigJam Style Author Pill + Tag Chip on Top Border (Like Image 2) */}
                  {node.authorName && node.type !== 'circle' && (
                    <div
                      className={`-mt-7 self-start flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold shadow-sm border ${
                        darkMode
                          ? 'bg-slate-900 border-white/15 text-slate-100'
                          : 'bg-white border-slate-200 text-slate-800'
                      }`}
                    >
                      <span
                        style={{ backgroundColor: node.color }}
                        className="w-4 h-4 rounded-full text-white text-[9px] font-extrabold flex items-center justify-center"
                      >
                        {node.authorName.charAt(0).toUpperCase()}
                      </span>
                      <span>{node.authorName.split(' ')[0]}</span>
                    </div>
                  )}

                  {/* Interactive 4-Edge Connection Drag Handles (Image 2 O-Handles) */}
                  {(['top', 'right', 'bottom', 'left'] as const).map(side => {
                    const posClass =
                      side === 'top'
                        ? '-top-2 left-1/2 -translate-x-1/2'
                        : side === 'right'
                          ? 'top-1/2 -right-2 -translate-y-1/2'
                          : side === 'bottom'
                            ? '-bottom-2 left-1/2 -translate-x-1/2'
                            : 'top-1/2 -left-2 -translate-y-1/2';
                    return (
                      <div
                        key={side}
                        onMouseDown={e => {
                          e.stopPropagation();
                          const anchor = getNodeEdgePoint(node, side);
                          setDraggingEdgeConnector({
                            fromNodeId: node.id,
                            fromSide: side,
                            startX: anchor.x,
                            startY: anchor.y,
                            currentX: anchor.x,
                            currentY: anchor.y,
                          });
                        }}
                        title="Drag to connect to another node"
                        className={`absolute ${posClass} w-3.5 h-3.5 rounded-full bg-white dark:bg-slate-900 border-2 border-indigo-500 opacity-0 group-hover:opacity-100 ${
                          isSelected ? 'opacity-100' : ''
                        } hover:scale-125 transition-all cursor-crosshair z-30`}
                      />
                    );
                  })}

                  {/* Doc Card Visual Header Banner (Like Image 3 "Welcome back" gradient card) */}
                  {node.type === 'doc_card' && (
                    <div
                      className="w-full h-14 rounded-xl mb-2.5 flex items-end p-2.5 text-white font-bold text-xs shadow-inner shrink-0"
                      style={{
                        background: `linear-gradient(135deg, #4f46e5 0%, ${node.color || '#f97316'} 100%)`,
                      }}
                    >
                      <span className="truncate">{node.title || 'Specification Card'}</span>
                    </div>
                  )}

                  {/* Editable Title & Content Directly on Canvas */}
                  <div className="flex-1 flex flex-col justify-center min-h-0 w-full">
                    {node.type !== 'doc_card' && (
                      <input
                        type="text"
                        value={node.title || ''}
                        onChange={e => {
                          const val = e.target.value;
                          const updated = { ...node, title: val, updatedAt: Date.now() };
                          updateActiveBoard(b => ({
                            ...b,
                            nodes: b.nodes.map(n => (n.id === node.id ? updated : n)),
                          }));
                        }}
                        placeholder="Title..."
                        className={`w-full bg-transparent font-bold text-xs outline-none mb-1 ${
                          node.type === 'circle' ? 'text-center' : ''
                        } ${darkMode ? 'text-white' : 'text-slate-900'}`}
                      />
                    )}
                    <textarea
                      value={node.content}
                      onChange={e => {
                        const val = e.target.value;
                        const updated = { ...node, content: val, updatedAt: Date.now() };
                        updateActiveBoard(b => ({
                          ...b,
                          nodes: b.nodes.map(n => (n.id === node.id ? updated : n)),
                        }));
                        if (currentUser) {
                          collabService.broadcastWhiteboardDelta({
                            boardId: activeBoard.id,
                            scopeKey,
                            version: boardVersionRef.current,
                            action: 'upsert_node',
                            node: updated,
                            actorId: currentUser.id,
                            actorName: currentUser.full_name || currentUser.email,
                          });
                        }
                      }}
                      className={`w-full flex-1 bg-transparent resize-none outline-none leading-relaxed ${
                        node.type === 'sticky'
                          ? 'text-sm font-medium'
                          : 'text-xs'
                      } ${
                        darkMode ? 'text-slate-200' : 'text-slate-800'
                      }`}
                    />
                  </div>

                  {/* Tilted Tag Label at Bottom-Left (Like "Data" tag in Image 2) */}
                  {node.mentionTag && node.type !== 'circle' && (
                    <div
                      className={`-mb-6 self-start -rotate-3 px-2.5 py-0.5 rounded-lg text-[10px] font-bold shadow-sm border ${
                        darkMode
                          ? 'bg-slate-900 border-white/15 text-indigo-300'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      {node.mentionTag}
                    </div>
                  )}

                  {/* Overlapping Corner Stamp Sticker Badges (Like 👍, ⭐, ☹️ in Image 2) */}
                  {reactionEntries.length > 0 && (
                    <div className="absolute -bottom-3 right-3 flex items-center gap-1 z-20">
                      {reactionEntries.map(([emoji, count]) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            handleReactToNode(node, emoji);
                          }}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold shadow-md border transition-transform hover:scale-110 cursor-pointer ${
                            darkMode
                              ? 'bg-slate-900 border-emerald-500/50 text-white'
                              : 'bg-white border-emerald-500/60 text-slate-900'
                          }`}
                        >
                          <span>{emoji}</span>
                          {count > 1 && (
                            <span className="text-[10px] font-mono tabular-nums">{count}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Resize Corner Handle */}
                  {isSelected && (
                    <div
                      onMouseDown={e => {
                        e.stopPropagation();
                        setResizingNodeId(node.id);
                      }}
                      className="absolute bottom-1.5 right-1.5 w-3.5 h-3.5 rounded-sm bg-indigo-500 cursor-se-resize"
                      title="Drag to resize"
                    />
                  )}
                </div>
              );
            })}

          {/* Pinned Canvas Comment Threads (Like "Marta K." Pin + Popover in Image 3) */}
          {(activeBoard?.comments || []).map(thread => {
            const isOpen = activeCommentId === thread.id;
            return (
              <div
                key={thread.id}
                style={{ left: thread.x, top: thread.y }}
                className="absolute z-30 pointer-events-auto"
                onMouseDown={e => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => setActiveCommentId(isOpen ? null : thread.id)}
                  style={{ backgroundColor: thread.color || '#8b5cf6' }}
                  className="w-8 h-8 rounded-full rounded-bl-none text-white text-xs font-extrabold shadow-lg ring-2 ring-white dark:ring-slate-900 flex items-center justify-center transition-transform hover:scale-110 cursor-pointer"
                  title={`Comment by ${thread.authorName}`}
                >
                  {thread.authorName.charAt(0).toUpperCase()}
                </button>

                {isOpen && (
                  <div
                    className={`mt-2 w-72 rounded-2xl border p-3.5 shadow-2xl ${
                      darkMode
                        ? 'bg-slate-900 border-white/15 text-slate-100'
                        : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div>
                        <div className="text-xs font-bold">{thread.authorName}</div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(thread.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          updateActiveBoard(b => ({
                            ...b,
                            comments: (b.comments || []).filter(c => c.id !== thread.id),
                          }));
                          if (currentUser) {
                            collabService.broadcastWhiteboardDelta({
                              boardId: activeBoard.id,
                              scopeKey,
                              version: boardVersionRef.current,
                              action: 'delete_comment',
                              commentId: thread.id,
                              actorId: currentUser.id,
                              actorName: currentUser.full_name || currentUser.email,
                            });
                          }
                          setActiveCommentId(null);
                        }}
                        className="text-[10px] font-semibold text-emerald-500 hover:underline cursor-pointer"
                      >
                        ✓ Resolve
                      </button>
                    </div>

                    <div className="space-y-2 max-h-40 overflow-y-auto mb-2.5 pr-1">
                      {thread.replies.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">
                          Start a discussion on this canvas pin...
                        </p>
                      ) : (
                        thread.replies.map(r => (
                          <div key={r.id} className="text-xs leading-relaxed">
                            <span className="font-semibold mr-1.5">{r.authorName}:</span>
                            <span className={darkMode ? 'text-slate-300' : 'text-slate-700'}>
                              {r.text}
                            </span>
                          </div>
                        ))
                      )}
                    </div>

                    <div
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border ${
                        darkMode
                          ? 'bg-slate-800/90 border-white/10'
                          : 'bg-slate-100 border-slate-200'
                      }`}
                    >
                      <input
                        type="text"
                        value={commentReplyDraft}
                        onChange={e => setCommentReplyDraft(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleAddCommentReply(thread);
                        }}
                        placeholder="Write a reply..."
                        className="flex-1 bg-transparent text-xs outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddCommentReply(thread)}
                        className="w-6 h-6 rounded-full bg-slate-900 dark:bg-indigo-600 text-white flex items-center justify-center text-[10px] cursor-pointer"
                      >
                        ➤
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Local Live Cursor Chat Input Bubble (`/` hotkey) */}
          {isCursorChatOpen && (
            <div
              style={{ left: localCursorPos.x + 14, top: localCursorPos.y + 14 }}
              className="absolute z-40 pointer-events-auto"
              onMouseDown={e => e.stopPropagation()}
            >
              <div
                style={{ backgroundColor: selectedColor }}
                className="px-3 py-1.5 rounded-2xl rounded-tl-none text-white shadow-xl flex items-center gap-2 min-w-[200px]"
              >
                <input
                  type="text"
                  autoFocus
                  value={cursorChatText}
                  onChange={e => setCursorChatText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === 'Escape') {
                      setIsCursorChatOpen(false);
                      setTimeout(() => setCursorChatText(''), 4000);
                    }
                  }}
                  placeholder="Say something live... (Esc to close)"
                  className="bg-transparent text-xs font-semibold text-white placeholder-white/75 outline-none w-full"
                />
              </div>
            </div>
          )}

          {/* Live Multiplayer Remote Cursors + Speech Bubbles */}
          {remoteCursorList.map(cursor => (
            <div
              key={cursor.userId}
              style={{
                transform: `translate(${cursor.x}px, ${cursor.y}px)`,
              }}
              className="absolute top-0 left-0 pointer-events-none z-50 transition-transform duration-75"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 3L20 11L12 13L9 21L4 3Z"
                  fill={cursor.color || '#6366f1'}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
              </svg>
              <div
                style={{ backgroundColor: cursor.color || '#6366f1' }}
                className="ml-3 -mt-1 px-2.5 py-0.5 rounded-full rounded-tl-none text-[10px] font-bold text-white shadow-md whitespace-nowrap"
              >
                {cursor.userName}
              </div>
              {cursor.cursorChat && (
                <div
                  style={{ backgroundColor: cursor.color || '#6366f1' }}
                  className="ml-3 mt-1 px-3 py-1 rounded-2xl rounded-tl-none text-xs font-semibold text-white shadow-xl max-w-[220px]"
                >
                  {cursor.cursorChat}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 4. BOTTOM-LEFT PAGES & LAYERS PILL (Like "• Page 1  8 layers" in Image 3) */}
      <div className="absolute bottom-4 left-4 z-30">
        <button
          type="button"
          onClick={() => setShowPagesDrawer(prev => !prev)}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl border shadow-lg backdrop-blur-xl text-xs font-semibold transition-all cursor-pointer ${
            darkMode
              ? 'bg-slate-900/90 border-white/10 text-slate-100 hover:bg-slate-800'
              : 'bg-white/95 border-slate-200 text-slate-900 hover:bg-slate-50'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-indigo-500" />
          <span className="font-bold truncate max-w-[140px]">
            {activeBoard?.name?.split('·')[0] || 'Page 1'}
          </span>
          <span className="text-slate-400 font-mono tabular-nums">
            {(activeBoard?.nodes.length || 0) + (activeBoard?.connectors.length || 0)} layers
          </span>
        </button>

        {showPagesDrawer && (
          <div
            className={`mt-2 w-72 rounded-2xl border p-3 shadow-2xl backdrop-blur-xl ${
              darkMode
                ? 'bg-slate-900/95 border-white/15 text-slate-100'
                : 'bg-white/95 border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Boards & Pages ({boards.length})
              </span>
              <button
                type="button"
                onClick={handleCreateNewBoardPage}
                className="text-[11px] font-bold text-indigo-500 hover:underline cursor-pointer"
              >
                + New Page
              </button>
            </div>
            <div className="space-y-1 max-h-36 overflow-y-auto mb-3 pr-1">
              {boards.map(b => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setActiveBoardId(b.id);
                    setShowPagesDrawer(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium text-left cursor-pointer ${
                    b.id === activeBoard?.id
                      ? 'bg-indigo-600 text-white font-bold'
                      : darkMode
                        ? 'hover:bg-slate-800 text-slate-300'
                        : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <span className="truncate">{b.name}</span>
                  <span className="text-[10px] font-mono opacity-75">{b.nodes.length}</span>
                </button>
              ))}
            </div>

            <div className="border-t border-slate-300/20 pt-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Canvas Layers ({activeBoard?.nodes.length || 0})
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                {(activeBoard?.nodes || []).map(n => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      setSelectedNodeId(n.id);
                      setPan({
                        x: Math.round(350 - n.x * zoom),
                        y: Math.round(220 - n.y * zoom),
                      });
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1 rounded-lg text-xs text-left cursor-pointer ${
                      selectedNodeId === n.id
                        ? 'bg-indigo-500/20 text-indigo-400 font-bold'
                        : darkMode
                          ? 'hover:bg-slate-800 text-slate-300'
                          : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span className="truncate">{n.title || n.content.slice(0, 24)}</span>
                    <span className="text-[10px] opacity-60">{n.type}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. CENTERED TACTILE BOTTOM DOCK (Inspired by FigJam Image 1 & Frame Image 3) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 py-2 rounded-[24px] border shadow-2xl backdrop-blur-xl bg-white/95 dark:bg-slate-900/95 border-slate-200/90 dark:border-white/15">
        {/* Select / Hand Pan Pair */}
        <div className="flex items-center gap-1 pr-2 border-r border-slate-300/30">
          <button
            type="button"
            onClick={() => setActiveTool('select')}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              activeTool === 'select'
                ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Select & Move (V)"
          >
            ↖
          </button>
          <button
            type="button"
            onClick={() => setActiveTool('pan')}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              activeTool === 'pan'
                ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Pan Canvas (H)"
          >
            ✋
          </button>
        </div>

        {/* Tactile Marker / Pen Nib (`P`) */}
        <button
          type="button"
          onClick={() => setActiveTool('pen')}
          className={`px-3 h-9 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
            activeTool === 'pen'
              ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-md'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Freehand Marker / Pen (P)"
        >
          <span>✒️</span>
          <span className="hidden md:inline">Draw</span>
        </button>

        {/* Tactile Sticky Note Pad (`S`) */}
        <button
          type="button"
          onClick={() => setActiveTool('sticky')}
          className={`px-3 h-9 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
            activeTool === 'sticky'
              ? 'bg-amber-400 text-slate-950 shadow-md scale-105'
              : 'bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 hover:bg-amber-200'
          }`}
          title="Add Sticky Note (S)"
        >
          <span>🗒️</span>
          <span className="hidden sm:inline">Sticky</span>
        </button>

        {/* Shapes & Frame Selector (`R` / `F`) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowShapeMenu(prev => !prev)}
            className={`px-3 h-9 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
              ['rectangle', 'diamond', 'circle', 'frame'].includes(activeTool)
                ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-md'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Shapes & Frames"
          >
            <span
              style={{ backgroundColor: selectedColor }}
              className="w-3.5 h-3.5 rounded-full inline-block"
            />
            <span className="hidden sm:inline">Shapes</span>
          </button>

          {showShapeMenu && (
            <div
              className={`absolute bottom-12 left-1/2 -translate-x-1/2 w-48 rounded-2xl border p-1.5 shadow-2xl z-50 ${
                darkMode
                  ? 'bg-slate-900 border-white/15 text-slate-100'
                  : 'bg-white border-slate-200 text-slate-800'
              }`}
            >
              {[
                { id: 'frame' as const, label: 'Section Frame (F)', icon: '⊞' },
                { id: 'rectangle' as const, label: 'Rectangle Card', icon: '▭' },
                { id: 'diamond' as const, label: 'Decision Diamond', icon: '◇' },
                { id: 'circle' as const, label: 'Circle Node', icon: '◯' },
                { id: 'doc_card' as const, label: 'Rich Spec Card', icon: '📄' },
              ].map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setActiveTool(s.id);
                    setShowShapeMenu(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-left cursor-pointer ${
                    activeTool === s.id
                      ? 'bg-indigo-600 text-white'
                      : darkMode
                        ? 'hover:bg-slate-800'
                        : 'hover:bg-slate-100'
                  }`}
                >
                  <span>{s.icon}</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Text Tool (`T`) */}
        <button
          type="button"
          onClick={() => setActiveTool('text')}
          className={`w-9 h-9 rounded-xl font-serif font-extrabold text-sm flex items-center justify-center transition-all cursor-pointer ${
            activeTool === 'text'
              ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-md'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Text Label (T)"
        >
          T
        </button>

        {/* Connector Arrow (`L`) */}
        <button
          type="button"
          onClick={() => setActiveTool('connector')}
          className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm transition-all cursor-pointer ${
            activeTool === 'connector'
              ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-md'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Connect Nodes (L or drag node edge handles)"
        >
          ↗
        </button>

        {/* Stamp Sticker Tool (`E`) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setActiveTool('stamp');
              setShowStampMenu(prev => !prev);
            }}
            className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm transition-all cursor-pointer ${
              activeTool === 'stamp'
                ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-md'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Stamp Sticker on Card (E)"
          >
            {selectedStamp}
          </button>

          {showStampMenu && (
            <div
              className={`absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-1 p-1.5 rounded-2xl border shadow-2xl z-50 ${
                darkMode ? 'bg-slate-900 border-white/15' : 'bg-white border-slate-200'
              }`}
            >
              {STAMP_EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    setSelectedStamp(emoji);
                    setActiveTool('stamp');
                    setShowStampMenu(false);
                  }}
                  className={`w-8 h-8 rounded-xl text-base flex items-center justify-center transition-transform hover:scale-125 cursor-pointer ${
                    selectedStamp === emoji ? 'bg-indigo-500/20' : ''
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pinned Comment Thread Tool (`C`) */}
        <button
          type="button"
          onClick={() => setActiveTool('comment')}
          className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm transition-all cursor-pointer ${
            activeTool === 'comment'
              ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-md'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Pin Comment Thread on Canvas (C)"
        >
          💬
        </button>
      </div>

      {/* 6. VERSION HISTORY & SNAPSHOT DRAWER */}
      {showHistoryDrawer && (
        <div
          className={`absolute top-16 right-4 z-40 w-80 rounded-2xl border p-4 shadow-2xl backdrop-blur-xl ${
            darkMode
              ? 'bg-slate-900/95 border-white/15 text-slate-100'
              : 'bg-white/95 border-slate-200 text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-xs font-extrabold">Version History & Cloud Sync</h4>
              <p className="text-[11px] text-slate-400">
                Current v{boardVersion} · Last edited by {lastUpdatedBy}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowHistoryDrawer(false)}
              className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="flex items-center gap-1.5 mb-3">
            <input
              type="text"
              value={snapshotLabelInput}
              onChange={e => setSnapshotLabelInput(e.target.value)}
              placeholder="Snapshot name (e.g., Q4 Architecture)..."
              className={`flex-1 px-2.5 py-1.5 rounded-xl text-xs border outline-none ${
                darkMode
                  ? 'bg-slate-800 border-white/10 text-white'
                  : 'bg-slate-100 border-slate-200 text-slate-900'
              }`}
            />
            <button
              type="button"
              onClick={handleCreateVersionSnapshot}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer whitespace-nowrap"
            >
              Save
            </button>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {(activeBoard?.history || []).length === 0 ? (
              <div className="text-xs text-slate-400 py-4 text-center">
                All live edits auto-sync across teammates (v{boardVersion}). Save a named checkpoint above to revert anytime.
              </div>
            ) : (
              (activeBoard.history || []).map(snap => (
                <div
                  key={snap.id}
                  className={`flex items-center justify-between p-2.5 rounded-xl border ${
                    darkMode
                      ? 'bg-slate-800/70 border-white/10'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">{snap.label}</div>
                    <div className="text-[10px] text-slate-400">
                      by {snap.authorName} · {snap.nodes.length} nodes
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRestoreSnapshot(snap)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 cursor-pointer shrink-0"
                  >
                    Restore
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 7. SHARE TO TEAM CHAT & EXPORT MODAL */}
      {showShareModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowShareModal(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className={`w-full max-w-md rounded-3xl border p-6 shadow-2xl ${
              darkMode
                ? 'bg-slate-900 border-white/15 text-slate-100'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-extrabold">Share & Export Whiteboard</h3>
                <p className="text-xs text-slate-400">
                  {activeBoard?.name} · Version v{boardVersion} (Auto-synced to cloud)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="text-sm text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-bold mb-1">
                  Post Interactive Board Card to Team Chat Channel
                </label>
                <select
                  value={shareChannelId}
                  onChange={e => setShareChannelId(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border outline-none ${
                    darkMode
                      ? 'bg-slate-800 border-white/10 text-white'
                      : 'bg-slate-100 border-slate-200 text-slate-900'
                  }`}
                >
                  <option value="general">#general</option>
                  <option value="engineering">#engineering</option>
                  <option value="design-ux">#design-ux</option>
                  <option value="sprint-planning">#sprint-planning</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Optional Message</label>
                <input
                  type="text"
                  value={shareNote}
                  onChange={e => setShareNote(e.target.value)}
                  placeholder="e.g., Please review the Q4 architecture flow before standup..."
                  className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                    darkMode
                      ? 'bg-slate-800 border-white/10 text-white'
                      : 'bg-slate-100 border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              <button
                type="button"
                onClick={handleShareBoardToChat}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md cursor-pointer"
              >
                Share Live Whiteboard to #{shareChannelId}
              </button>
            </div>

            <div className="border-t border-slate-300/20 pt-4 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-400">Download Snapshot:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExportBoard('svg')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                    darkMode
                      ? 'border-white/15 hover:bg-slate-800 text-slate-200'
                      : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  Export SVG
                </button>
                <button
                  type="button"
                  onClick={() => handleExportBoard('json')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                    darkMode
                      ? 'border-white/15 hover:bg-slate-800 text-slate-200'
                      : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  Export JSON
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhiteboardStudioPage;
