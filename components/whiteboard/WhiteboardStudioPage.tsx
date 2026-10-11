import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import {
  WhiteboardNode,
  WhiteboardNodeType,
  WhiteboardConnector,
  WhiteboardStroke,
  WhiteboardBoard,
  WhiteboardCursor,
  TaskPriority,
  TaskStatus,
} from '../../types';
import { ICON_MAP } from '../../constants';
import { collabService } from '../../services/collabService';
import soundService from '../../services/soundService';

type WhiteboardTool =
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
  | 'pen';

const NODE_COLORS = [
  { id: 'violet', label: 'Electric Violet', hex: '#6366f1', bgLight: '#eef2ff', bgDark: '#1e1b4b' },
  { id: 'emerald', label: 'Emerald Pulse', hex: '#10b981', bgLight: '#ecfdf5', bgDark: '#064e3b' },
  { id: 'amber', label: 'Solar Amber', hex: '#f59e0b', bgLight: '#fffbeb', bgDark: '#451a03' },
  { id: 'rose', label: 'Sunset Coral', hex: '#f43f5e', bgLight: '#fff1f2', bgDark: '#4c0519' },
  { id: 'cyan', label: 'Oceanic Cyan', hex: '#06b6d4', bgLight: '#ecfeff', bgDark: '#083344' },
  { id: 'slate', label: 'Graphite Slate', hex: '#64748b', bgLight: '#f8fafc', bgDark: '#1e293b' },
];

const buildArchitectureTemplate = (projectId?: string): WhiteboardBoard => ({
  id: `wb-arch-${projectId || 'default'}`,
  name: 'System Architecture & Sprint Spec Canvas',
  projectId,
  updatedAt: new Date().toISOString(),
  nodes: [
    {
      id: 'node-frame-1',
      type: 'frame',
      x: 80,
      y: 70,
      width: 540,
      height: 360,
      title: '1. Client & Edge Gateway Layer',
      content: ' Edge routing, OAuth session validation & real-time WebSocket multiplexers',
      color: '#6366f1',
      authorName: 'Architecture Lead',
      updatedAt: Date.now() - 60000,
    },
    {
      id: 'node-rect-1',
      type: 'rectangle',
      x: 120,
      y: 140,
      width: 210,
      height: 110,
      title: 'SPA & Mobile PWA Client',
      content: 'React + Vite • Optimistic UI & Offline Queue',
      color: '#06b6d4',
      authorName: 'Frontend Team',
      updatedAt: Date.now() - 50000,
    },
    {
      id: 'node-diamond-1',
      type: 'diamond',
      x: 375,
      y: 135,
      width: 205,
      height: 120,
      title: 'API & Auth Gateway',
      content: 'Rate Limiter • JWT + RBAC Policy Guard',
      color: '#f59e0b',
      authorName: 'Platform Sec',
      updatedAt: Date.now() - 45000,
    },
    {
      id: 'node-sticky-1',
      type: 'sticky',
      x: 125,
      y: 275,
      width: 215,
      height: 130,
      title: 'Action Item',
      content: 'Add Redis token bucket rate-limiting for public intake endpoints before Q4 launch.',
      color: '#f43f5e',
      authorName: 'Sarah Chen',
      reactions: { '🔥': 3, '👍': 2 },
      updatedAt: Date.now() - 35000,
    },
    {
      id: 'node-doc-1',
      type: 'doc_card',
      x: 670,
      y: 80,
      width: 340,
      height: 250,
      title: 'RFC-042: Real-Time Sync Protocol',
      content:
        '• Server-authoritative state with optimistic client mutations\n• Idempotent event upserts by UUID + timestamp\n• 60ms throttled cursor broadcasts over Supabase Realtime\n• Automatic 1-click Kanban task conversion',
      color: '#10b981',
      authorName: 'Staff Eng',
      reactions: { '🚀': 4 },
      updatedAt: Date.now() - 25000,
    },
    {
      id: 'node-sticky-2',
      type: 'sticky',
      x: 675,
      y: 355,
      width: 330,
      height: 120,
      title: 'QA & Load Testing',
      content: 'Benchmark 500 concurrent WebSocket cursors and verify sub-40ms p95 frame latency.',
      color: '#f59e0b',
      authorName: 'Alex Rivera',
      reactions: { '✅': 2 },
      updatedAt: Date.now() - 15000,
    },
  ],
  connectors: [
    {
      id: 'conn-1',
      fromNodeId: 'node-rect-1',
      toNodeId: 'node-diamond-1',
      label: 'HTTPS / WSS',
      color: '#6366f1',
      style: 'solid',
    },
    {
      id: 'conn-2',
      fromNodeId: 'node-diamond-1',
      toNodeId: 'node-doc-1',
      label: 'Delta Sync',
      color: '#10b981',
      style: 'dashed',
    },
  ],
  strokes: [],
});

const buildSprintRetroTemplate = (projectId?: string): WhiteboardBoard => ({
  id: `wb-retro-${Date.now()}`,
  name: 'Sprint Retrospective & Action Board',
  projectId,
  updatedAt: new Date().toISOString(),
  nodes: [
    {
      id: 'retro-frame-1',
      type: 'frame',
      x: 70,
      y: 70,
      width: 300,
      height: 380,
      title: '🌟 What Went Well',
      content: 'Wins, velocity highlights & team shoutouts',
      color: '#10b981',
      updatedAt: Date.now(),
    },
    {
      id: 'retro-sticky-1',
      type: 'sticky',
      x: 95,
      y: 135,
      width: 250,
      height: 120,
      title: 'Zero Downtime Release',
      content: 'Shipped the new automation rules and accent themes ahead of schedule!',
      color: '#10b981',
      authorName: 'Team',
      reactions: { '🚀': 5 },
      updatedAt: Date.now(),
    },
    {
      id: 'retro-frame-2',
      type: 'frame',
      x: 400,
      y: 70,
      width: 300,
      height: 380,
      title: '🧩 What Can Be Improved',
      content: 'Friction points, blockers & process bottlenecks',
      color: '#f59e0b',
      updatedAt: Date.now(),
    },
    {
      id: 'retro-sticky-2',
      type: 'sticky',
      x: 425,
      y: 135,
      width: 250,
      height: 120,
      title: 'PR Review Turnaround',
      content: 'Large PRs waited >24h in review column. Break specs into smaller tasks.',
      color: '#f59e0b',
      authorName: 'Eng Team',
      reactions: { '👍': 3 },
      updatedAt: Date.now(),
    },
    {
      id: 'retro-frame-3',
      type: 'frame',
      x: 730,
      y: 70,
      width: 300,
      height: 380,
      title: '🎯 Next Sprint Action Items',
      content: 'Convert these stickies directly into Kanban tasks!',
      color: '#6366f1',
      updatedAt: Date.now(),
    },
    {
      id: 'retro-sticky-3',
      type: 'sticky',
      x: 755,
      y: 135,
      width: 250,
      height: 125,
      title: 'Automate QA Checklist',
      content: 'Enable automatic QA review checklist rule on all production projects.',
      color: '#6366f1',
      authorName: 'PM Lead',
      reactions: { '🔥': 4 },
      updatedAt: Date.now(),
    },
  ],
  connectors: [
    {
      id: 'retro-conn-1',
      fromNodeId: 'retro-sticky-2',
      toNodeId: 'retro-sticky-3',
      label: 'Resolves',
      color: '#6366f1',
      style: 'solid',
    },
  ],
  strokes: [],
});

export const WhiteboardStudioPage: React.FC = () => {
  const {
    darkMode,
    currentUser,
    currentOrganization,
    projects,
    activeProject,
    tasks,
    createTask,
    openViewTaskModal,
    presences,
    addToast,
  } = useAppStore();

  const storageKey = `omni_whiteboards_v1_${currentOrganization?.id || currentUser?.id || 'default'}`;

  const [boards, setBoards] = useState<WhiteboardBoard[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [buildArchitectureTemplate(activeProject?.id || projects[0]?.id)];
  });

  const [activeBoardId, setActiveBoardId] = useState<string>(() => boards[0]?.id || 'default');
  const activeBoard = useMemo(
    () => boards.find(b => b.id === activeBoardId) || boards[0],
    [boards, activeBoardId]
  );

  const [activeTool, setActiveTool] = useState<WhiteboardTool>('select');
  const [activeColor, setActiveColor] = useState<string>('#6366f1');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [connectorStartNodeId, setConnectorStartNodeId] = useState<string | null>(null);

  // Infinite Canvas Viewport State (Pan & Zoom)
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 20, y: 20 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ startX: number; startY: number; origPanX: number; origPanY: number } | null>(null);

  // Dragging & Resizing Node State
  const draggingNodeRef = useRef<{
    nodeId: string;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const resizingNodeRef = useRef<{
    nodeId: string;
    startClientX: number;
    startClientY: number;
    origW: number;
    origH: number;
  } | null>(null);

  // Freehand Pen Drawing State
  const [currentStrokePoints, setCurrentStrokePoints] = useState<{ x: number; y: number }[] | null>(null);

  // Live Multiplayer Cursors State
  const [remoteCursors, setRemoteCursors] = useState<Record<string, WhiteboardCursor>>({});
  const lastCursorBroadcastRef = useRef<number>(0);
  const isRemoteSyncRef = useRef<boolean>(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const saveBoardsToStorage = useCallback(
    (nextBoards: WhiteboardBoard[]) => {
      setBoards(nextBoards);
      try {
        localStorage.setItem(storageKey, JSON.stringify(nextBoards));
      } catch {}
    },
    [storageKey]
  );

  // Subscribe to Real-Time Whiteboard Deltas & Cursors via collabService
  useEffect(() => {
    const onRemoteDelta = (e: CustomEvent) => {
      const payload = e.detail;
      if (!payload || payload.actorId === currentUser?.id) return;
      if (payload.boardId && payload.boardId !== activeBoard?.id) return;

      isRemoteSyncRef.current = true;
      setBoards(prev => {
        const next = prev.map(board => {
          if (board.id !== payload.boardId) return board;

          if (payload.action === 'upsert_node' && payload.node) {
            // Skip overwriting if user is actively dragging this exact node locally
            if (draggingNodeRef.current?.nodeId === payload.node.id) return board;
            const exists = board.nodes.some(n => n.id === payload.node.id);
            const updatedNodes = exists
              ? board.nodes.map(n => (n.id === payload.node.id ? payload.node : n))
              : [...board.nodes, payload.node];
            return { ...board, nodes: updatedNodes, updatedAt: new Date().toISOString() };
          }

          if (payload.action === 'delete_node' && payload.nodeId) {
            return {
              ...board,
              nodes: board.nodes.filter(n => n.id !== payload.nodeId),
              connectors: board.connectors.filter(
                c => c.fromNodeId !== payload.nodeId && c.toNodeId !== payload.nodeId
              ),
              updatedAt: new Date().toISOString(),
            };
          }

          if (payload.action === 'upsert_connector' && payload.connector) {
            const exists = board.connectors.some(c => c.id === payload.connector.id);
            const updatedConns = exists
              ? board.connectors.map(c => (c.id === payload.connector.id ? payload.connector : c))
              : [...board.connectors, payload.connector];
            return { ...board, connectors: updatedConns, updatedAt: new Date().toISOString() };
          }

          if (payload.action === 'add_stroke' && payload.stroke) {
            if (board.strokes.some(s => s.id === payload.stroke.id)) return board;
            return {
              ...board,
              strokes: [...board.strokes, payload.stroke],
              updatedAt: new Date().toISOString(),
            };
          }

          if (payload.action === 'replace_board' && payload.board) {
            return payload.board;
          }

          return board;
        });

        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {}
        return next;
      });

      setTimeout(() => {
        isRemoteSyncRef.current = false;
      }, 20);
    };

    const onRemoteCursor = (e: CustomEvent) => {
      const cursor = e.detail as WhiteboardCursor;
      if (!cursor || !cursor.userId || cursor.userId === currentUser?.id) return;
      setRemoteCursors(prev => ({
        ...prev,
        [cursor.userId]: { ...cursor, updatedAt: Date.now() },
      }));
    };

    window.addEventListener('omni_remote_whiteboard_delta', onRemoteDelta as EventListener);
    window.addEventListener('omni_remote_whiteboard_cursor', onRemoteCursor as EventListener);

    // Expire stale remote cursors after 15 seconds
    const cleanupTimer = setInterval(() => {
      const now = Date.now();
      setRemoteCursors(prev => {
        let changed = false;
        const copy = { ...prev };
        Object.keys(copy).forEach(uid => {
          if (now - copy[uid].updatedAt > 15000) {
            delete copy[uid];
            changed = true;
          }
        });
        return changed ? copy : prev;
      });
    }, 5000);

    return () => {
      window.removeEventListener('omni_remote_whiteboard_delta', onRemoteDelta as EventListener);
      window.removeEventListener('omni_remote_whiteboard_cursor', onRemoteCursor as EventListener);
      clearInterval(cleanupTimer);
    };
  }, [activeBoard?.id, currentUser?.id, storageKey]);

  // Keyboard shortcuts for Whiteboard tools (V, H, F, S, R, G, O, T, D, C, P, Delete/Backspace)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId && !editingNodeId) {
        e.preventDefault();
        handleDeleteNode(selectedNodeId);
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      const toolMap: Record<string, WhiteboardTool> = {
        v: 'select',
        h: 'pan',
        f: 'frame',
        s: 'sticky',
        r: 'rectangle',
        g: 'diamond',
        o: 'circle',
        t: 'text',
        d: 'doc_card',
        c: 'connector',
        p: 'pen',
      };
      if (toolMap[key]) {
        e.preventDefault();
        soundService.play('click_soft');
        setActiveTool(toolMap[key]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedNodeId, editingNodeId]);

  const screenToCanvasCoords = useCallback(
    (clientX: number, clientY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 200, y: 200 };
      return {
        x: Math.round((clientX - rect.left - pan.x) / zoom),
        y: Math.round((clientY - rect.top - pan.y) / zoom),
      };
    },
    [pan, zoom]
  );

  const upsertNode = useCallback(
    (node: WhiteboardNode, broadcast = true) => {
      if (!activeBoard) return;
      const nextBoards = boards.map(b => {
        if (b.id !== activeBoard.id) return b;
        const exists = b.nodes.some(n => n.id === node.id);
        const nextNodes = exists
          ? b.nodes.map(n => (n.id === node.id ? node : n))
          : [...b.nodes, node];
        return { ...b, nodes: nextNodes, updatedAt: new Date().toISOString() };
      });
      saveBoardsToStorage(nextBoards);

      if (broadcast && !isRemoteSyncRef.current && currentUser) {
        collabService.broadcastWhiteboardDelta({
          boardId: activeBoard.id,
          action: 'upsert_node',
          node,
          actorId: currentUser.id,
          actorName: currentUser.full_name || currentUser.email,
        });
      }
    },
    [activeBoard, boards, saveBoardsToStorage, currentUser]
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      if (!activeBoard) return;
      soundService.play('click_soft');
      const nextBoards = boards.map(b => {
        if (b.id !== activeBoard.id) return b;
        return {
          ...b,
          nodes: b.nodes.filter(n => n.id !== nodeId),
          connectors: b.connectors.filter(c => c.fromNodeId !== nodeId && c.toNodeId !== nodeId),
          updatedAt: new Date().toISOString(),
        };
      });
      saveBoardsToStorage(nextBoards);
      if (selectedNodeId === nodeId) setSelectedNodeId(null);

      if (currentUser) {
        collabService.broadcastWhiteboardDelta({
          boardId: activeBoard.id,
          action: 'delete_node',
          nodeId,
          actorId: currentUser.id,
          actorName: currentUser.full_name || currentUser.email,
        });
      }
    },
    [activeBoard, boards, saveBoardsToStorage, selectedNodeId, currentUser]
  );

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== canvasRef.current && !(e.target as HTMLElement).dataset?.canvasBg) {
      return;
    }

    setSelectedNodeId(null);
    setEditingNodeId(null);
    setConnectorStartNodeId(null);

    if (activeTool === 'pan' || e.button === 1 || e.shiftKey) {
      setIsPanning(true);
      panStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origPanX: pan.x,
        origPanY: pan.y,
      };
      return;
    }

    const pt = screenToCanvasCoords(e.clientX, e.clientY);

    if (activeTool === 'pen') {
      setCurrentStrokePoints([pt]);
      return;
    }

    if (
      ['frame', 'sticky', 'rectangle', 'diamond', 'circle', 'text', 'doc_card'].includes(
        activeTool
      )
    ) {
      soundService.play('task_created');
      const type = activeTool as WhiteboardNodeType;
      const defaultDims: Record<
        WhiteboardNodeType,
        { w: number; h: number; title: string; content: string }
      > = {
        frame: {
          w: 420,
          h: 280,
          title: 'New Architecture Frame',
          content: 'Group related components, flows, or sprint deliverables',
        },
        sticky: {
          w: 220,
          h: 135,
          title: 'Sticky Note',
          content: 'Double-click to write ideas, edge cases, or action items...',
        },
        rectangle: {
          w: 200,
          h: 105,
          title: 'Service / Component',
          content: 'System module or microservice step',
        },
        diamond: {
          w: 195,
          h: 115,
          title: 'Decision / Gateway',
          content: 'Condition or routing rule',
        },
        circle: {
          w: 150,
          h: 150,
          title: 'State / Event',
          content: 'Trigger or terminal state',
        },
        text: {
          w: 240,
          h: 75,
          title: 'Section Heading',
          content: 'Annotation label or callout text',
        },
        doc_card: {
          w: 310,
          h: 210,
          title: 'Embedded Spec / PRD Card',
          content: '• Requirement 1: Define API schema\n• Requirement 2: Add unit tests\n• Convert directly to a Kanban task',
        },
      };

      const spec = defaultDims[type];
      const newNode: WhiteboardNode = {
        id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type,
        x: Math.max(20, pt.x - Math.round(spec.w / 2)),
        y: Math.max(20, pt.y - Math.round(spec.h / 2)),
        width: spec.w,
        height: spec.h,
        title: spec.title,
        content: spec.content,
        color: activeColor,
        authorId: currentUser?.id,
        authorName: currentUser?.full_name || currentUser?.email?.split('@')[0] || 'Teammate',
        reactions: {},
        updatedAt: Date.now(),
      };

      upsertNode(newNode, true);
      setSelectedNodeId(newNode.id);
      setActiveTool('select');
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const pt = screenToCanvasCoords(e.clientX, e.clientY);

    // Broadcast live cursor position throttled to every 65ms
    const now = Date.now();
    if (currentUser && activeBoard && now - lastCursorBroadcastRef.current > 65) {
      lastCursorBroadcastRef.current = now;
      collabService.broadcastWhiteboardCursor({
        userId: currentUser.id,
        userName: currentUser.full_name || currentUser.email.split('@')[0],
        color: activeColor,
        x: pt.x,
        y: pt.y,
        activeTool,
        selectedNodeId,
        boardId: activeBoard.id,
        updatedAt: now,
      });
    }

    if (isPanning && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.startX;
      const dy = e.clientY - panStartRef.current.startY;
      setPan({
        x: panStartRef.current.origPanX + dx,
        y: panStartRef.current.origPanY + dy,
      });
      return;
    }

    if (draggingNodeRef.current && activeBoard) {
      const { nodeId, startClientX, startClientY, origX, origY } = draggingNodeRef.current;
      const dx = (e.clientX - startClientX) / zoom;
      const dy = (e.clientY - startClientY) / zoom;
      const targetNode = activeBoard.nodes.find(n => n.id === nodeId);
      if (targetNode) {
        upsertNode(
          {
            ...targetNode,
            x: Math.round(origX + dx),
            y: Math.round(origY + dy),
            updatedAt: now,
          },
          now % 2 === 0
        );
      }
      return;
    }

    if (resizingNodeRef.current && activeBoard) {
      const { nodeId, startClientX, startClientY, origW, origH } = resizingNodeRef.current;
      const dw = (e.clientX - startClientX) / zoom;
      const dh = (e.clientY - startClientY) / zoom;
      const targetNode = activeBoard.nodes.find(n => n.id === nodeId);
      if (targetNode) {
        upsertNode(
          {
            ...targetNode,
            width: Math.max(130, Math.round(origW + dw)),
            height: Math.max(70, Math.round(origH + dh)),
            updatedAt: now,
          },
          false
        );
      }
      return;
    }

    if (activeTool === 'pen' && currentStrokePoints) {
      setCurrentStrokePoints(prev => (prev ? [...prev, pt] : [pt]));
    }
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
    panStartRef.current = null;

    if (draggingNodeRef.current && activeBoard) {
      const movedNode = activeBoard.nodes.find(n => n.id === draggingNodeRef.current?.nodeId);
      draggingNodeRef.current = null;
      if (movedNode) upsertNode(movedNode, true);
    }

    if (resizingNodeRef.current && activeBoard) {
      const resizedNode = activeBoard.nodes.find(n => n.id === resizingNodeRef.current?.nodeId);
      resizingNodeRef.current = null;
      if (resizedNode) upsertNode(resizedNode, true);
    }

    if (activeTool === 'pen' && currentStrokePoints && currentStrokePoints.length > 1 && activeBoard) {
      const newStroke: WhiteboardStroke = {
        id: `stroke-${Date.now()}`,
        points: currentStrokePoints,
        color: activeColor,
        strokeWidth: 3,
        authorName: currentUser?.full_name || 'Teammate',
      };
      const nextBoards = boards.map(b =>
        b.id === activeBoard.id
          ? { ...b, strokes: [...b.strokes, newStroke], updatedAt: new Date().toISOString() }
          : b
      );
      saveBoardsToStorage(nextBoards);
      if (currentUser) {
        collabService.broadcastWhiteboardDelta({
          boardId: activeBoard.id,
          action: 'add_stroke',
          stroke: newStroke,
          actorId: currentUser.id,
          actorName: currentUser.full_name || currentUser.email,
        });
      }
      setCurrentStrokePoints(null);
    } else {
      setCurrentStrokePoints(null);
    }
  };

  const handleNodeClick = (e: React.MouseEvent, node: WhiteboardNode) => {
    e.stopPropagation();
    soundService.play('click_soft');

    if (activeTool === 'connector') {
      if (!connectorStartNodeId) {
        setConnectorStartNodeId(node.id);
        addToast('Connector Started', `Now click a target node to link from "${node.title || 'Node'}".`, 'info');
      } else if (connectorStartNodeId !== node.id && activeBoard) {
        const newConn: WhiteboardConnector = {
          id: `conn-${Date.now()}`,
          fromNodeId: connectorStartNodeId,
          toNodeId: node.id,
          label: 'Flows to',
          color: activeColor,
          style: 'solid',
        };
        const nextBoards = boards.map(b =>
          b.id === activeBoard.id
            ? { ...b, connectors: [...b.connectors, newConn], updatedAt: new Date().toISOString() }
            : b
        );
        saveBoardsToStorage(nextBoards);
        if (currentUser) {
          collabService.broadcastWhiteboardDelta({
            boardId: activeBoard.id,
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
  };

  const handleToggleReaction = (e: React.MouseEvent, node: WhiteboardNode, emoji: string) => {
    e.stopPropagation();
    soundService.play('click_soft');
    const currentCount = node.reactions?.[emoji] || 0;
    const updated: WhiteboardNode = {
      ...node,
      reactions: {
        ...(node.reactions || {}),
        [emoji]: currentCount + 1,
      },
      updatedAt: Date.now(),
    };
    upsertNode(updated, true);
  };

  // 1-Click Convert Sticky/Frame/Doc Node to Real Kanban Task
  const handleConvertNodeToTask = async (node: WhiteboardNode) => {
    const targetProjectId = activeBoard?.projectId || activeProject?.id || projects[0]?.id;
    if (!targetProjectId) {
      addToast('No Project Selected', 'Create or select a project first to convert canvas nodes into tasks.', 'warning');
      return;
    }

    soundService.play('task_created');
    const created = await createTask({
      title: node.title && node.title !== 'Sticky Note' ? node.title : node.content.slice(0, 60),
      description: `${node.content}\n\n---\n*Converted from Whiteboard Studio (${activeBoard?.name || 'Board'})*`,
      status: TaskStatus.TODO,
      priority: TaskPriority.HIGH,
      projectId: targetProjectId,
      story_points: 3,
    });

    if (created) {
      upsertNode({ ...node, linkedTaskId: created.id, updatedAt: Date.now() }, true);
      addToast(
        'Converted to Kanban Task!',
        `"${created.title}" is now live on your project Kanban board.`,
        'success'
      );
    }
  };

  const handleLoadTemplate = (templateType: 'arch' | 'retro') => {
    soundService.play('state_updated');
    const newBoard =
      templateType === 'arch'
        ? buildArchitectureTemplate(activeProject?.id || projects[0]?.id)
        : buildSprintRetroTemplate(activeProject?.id || projects[0]?.id);
    newBoard.id = `wb-${templateType}-${Date.now()}`;
    const next = [newBoard, ...boards];
    saveBoardsToStorage(next);
    setActiveBoardId(newBoard.id);
    if (currentUser) {
      collabService.broadcastWhiteboardDelta({
        boardId: newBoard.id,
        action: 'replace_board',
        board: newBoard,
        actorId: currentUser.id,
        actorName: currentUser.full_name || currentUser.email,
      });
    }
    addToast('Template Loaded', `Loaded "${newBoard.name}" onto the canvas.`, 'success');
  };

  // Export Whiteboard to SVG, PNG, or JSON
  const handleExportBoard = (formatType: 'svg' | 'png' | 'json') => {
    if (!activeBoard) return;
    soundService.play('task_complete');

    if (formatType === 'json') {
      const blob = new Blob([JSON.stringify(activeBoard, null, 2)], {
        type: 'application/json;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeBoard.name.toLowerCase().replace(/\s+/g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('Whiteboard JSON Exported', 'Portable board JSON file downloaded.', 'success');
      return;
    }

    // Build clean standalone SVG representation of the board
    const width = 1280;
    const height = 760;
    const bgFill = darkMode ? '#0b0f19' : '#f8fafc';
    const textFill = darkMode ? '#f8fafc' : '#0f172a';

    const connElements = activeBoard.connectors
      .map(c => {
        const from = activeBoard.nodes.find(n => n.id === c.fromNodeId);
        const to = activeBoard.nodes.find(n => n.id === c.toNodeId);
        if (!from || !to) return '';
        const x1 = from.x + from.width / 2;
        const y1 = from.y + from.height / 2;
        const x2 = to.x + to.width / 2;
        const y2 = to.y + to.height / 2;
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c.color}" stroke-width="2.5" ${
          c.style === 'dashed' ? 'stroke-dasharray="6,6"' : ''
        } />`;
      })
      .join('\n');

    const nodeElements = activeBoard.nodes
      .map(n => {
        const safeTitle = (n.title || '').replace(/[<>&"]/g, '');
        const safeContent = (n.content || '').slice(0, 75).replace(/[<>&"]/g, '');
        return `<g transform="translate(${n.x}, ${n.y})">
          <rect width="${n.width}" height="${n.height}" rx="16" fill="${
          darkMode ? '#1e293b' : '#ffffff'
        }" stroke="${n.color}" stroke-width="2.5" />
          <text x="16" y="28" fill="${n.color}" font-family="sans-serif" font-size="13" font-weight="bold">${safeTitle}</text>
          <text x="16" y="52" fill="${textFill}" font-family="sans-serif" font-size="11">${safeContent}</text>
        </g>`;
      })
      .join('\n');

    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" fill="${bgFill}" />
      ${connElements}
      ${nodeElements}
    </svg>`;

    if (formatType === 'svg') {
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeBoard.name.toLowerCase().replace(/\s+/g, '_')}.svg`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('Vector SVG Exported', 'Downloaded scalable vector diagram (.svg).', 'success');
      return;
    }

    if (formatType === 'png') {
      const img = new Image();
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      img.onload = () => {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = width;
        offCanvas.height = height;
        const ctx = offCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          offCanvas.toBlob(pngBlob => {
            if (pngBlob) {
              const pngUrl = URL.createObjectURL(pngBlob);
              const a = document.createElement('a');
              a.href = pngUrl;
              a.download = `${activeBoard.name.toLowerCase().replace(/\s+/g, '_')}.png`;
              a.click();
              URL.revokeObjectURL(pngUrl);
              addToast('PNG Snapshot Exported', 'High-resolution PNG board snapshot downloaded.', 'success');
            }
          }, 'image/png');
        }
        URL.revokeObjectURL(url);
      };
      img.src = url;
    }
  };

  const selectedNode = useMemo(
    () => activeBoard?.nodes.find(n => n.id === selectedNodeId) || null,
    [activeBoard, selectedNodeId]
  );

  const onlineCollaborators = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string }>();
    presences.forEach(p => {
      if (p.userId && p.userId !== currentUser?.id) {
        map.set(p.userId, {
          id: p.userId,
          name: p.userName || 'Teammate',
          color: p.color || '#10b981',
        });
      }
    });
    return Array.from(map.values());
  }, [presences, currentUser?.id]);

  return (
    <div className="flex-1 flex flex-col h-full min-h-[calc(100vh-7rem)] relative overflow-hidden select-none">
      {/* 1. Top Whiteboard Studio Bar */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b z-20 ${
          darkMode
            ? 'bg-slate-900/90 border-slate-800 text-slate-100'
            : 'bg-white/95 border-slate-200/80 text-slate-900'
        }`}
      >
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="w-9 h-9 rounded-2xl bg-accent/15 border border-accent/30 text-accent flex items-center justify-center">
            <ICON_MAP.Squares2X2Icon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <select
                value={activeBoard?.id || ''}
                onChange={e => setActiveBoardId(e.target.value)}
                className={`text-sm font-bold rounded-xl px-2.5 py-1 border outline-none cursor-pointer ${
                  darkMode
                    ? 'bg-slate-800 border-slate-700 text-white'
                    : 'bg-slate-100 border-slate-200 text-slate-900'
                }`}
              >
                {boards.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Realtime Sync
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Figma / FigJam Collaborative Canvas • Double-click any node to edit • Click &quot;Convert to Task&quot; to push to Kanban
            </p>
          </div>
        </div>

        {/* Right Controls: Templates, Zoom HUD, Collaborators & Export */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Templates Quick Buttons */}
          <button
            type="button"
            onClick={() => handleLoadTemplate('arch')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
              darkMode
                ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
            }`}
          >
            + Architecture Template
          </button>
          <button
            type="button"
            onClick={() => handleLoadTemplate('retro')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
              darkMode
                ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
            }`}
          >
            + Sprint Retro Template
          </button>

          {/* Zoom Controls (tabular-nums) */}
          <div
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-xl border font-mono tabular-nums text-xs ${
              darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'
            }`}
          >
            <button
              type="button"
              onClick={() => setZoom(z => Math.max(0.4, Math.round((z - 0.15) * 100) / 100))}
              className="px-1.5 hover:text-accent cursor-pointer font-bold"
              title="Zoom Out"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setPan({ x: 20, y: 20 });
              }}
              className="px-1.5 font-bold hover:text-accent cursor-pointer"
              title="Reset Zoom to 100%"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setZoom(z => Math.min(2.2, Math.round((z + 0.15) * 100) / 100))}
              className="px-1.5 hover:text-accent cursor-pointer font-bold"
              title="Zoom In"
            >
              +
            </button>
          </div>

          {/* Export Buttons */}
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleExportBoard('png')}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-accent text-white hover:opacity-95 transition-opacity cursor-pointer"
              title="Export High-Res PNG Snapshot"
            >
              Export PNG
            </button>
            <button
              type="button"
              onClick={() => handleExportBoard('svg')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                darkMode
                  ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                  : 'bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200'
              }`}
              title="Export Vector SVG"
            >
              SVG
            </button>
            <button
              type="button"
              onClick={() => handleExportBoard('json')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                darkMode
                  ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                  : 'bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200'
              }`}
              title="Export Board JSON"
            >
              JSON
            </button>
          </div>
        </div>
      </div>

      {/* 2. Infinite Vector & Node Canvas Surface */}
      <div
        ref={canvasRef}
        data-canvas-bg="true"
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onWheel={e => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 0.1 : -0.1;
            setZoom(z => Math.min(2.2, Math.max(0.4, Math.round((z + delta) * 100) / 100)));
          }
        }}
        className={`flex-1 relative overflow-hidden ${
          activeTool === 'pan' || isPanning
            ? 'cursor-grab active:cursor-grabbing'
            : activeTool === 'pen' || activeTool === 'connector'
            ? 'cursor-crosshair'
            : 'cursor-default'
        } ${darkMode ? 'bg-[#090d16]' : 'bg-[#f8fafc]'}`}
        style={{
          backgroundImage: darkMode
            ? 'radial-gradient(rgba(148, 163, 184, 0.18) 1px, transparent 1px)'
            : 'radial-gradient(rgba(100, 116, 139, 0.22) 1px, transparent 1px)',
          backgroundSize: `${Math.max(12, Math.round(22 * zoom))}px ${Math.max(12, Math.round(22 * zoom))}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      >
        {/* Transformed Infinite Canvas Layer */}
        <div
          data-canvas-bg="true"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
          className="absolute inset-0 pointer-events-none"
        >
          {/* SVG Layer for Smart Connectors & Freehand Vector Strokes */}
          <svg
            className="overflow-visible absolute top-0 left-0 w-[3000px] h-[2000px] pointer-events-none"
            xmlns="http://www.w3.org/2000/svg"
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
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#6366f1" />
              </marker>
            </defs>

            {/* Connectors between nodes */}
            {activeBoard?.connectors.map(conn => {
              const fromNode = activeBoard.nodes.find(n => n.id === conn.fromNodeId);
              const toNode = activeBoard.nodes.find(n => n.id === conn.toNodeId);
              if (!fromNode || !toNode) return null;

              const x1 = fromNode.x + fromNode.width / 2;
              const y1 = fromNode.y + fromNode.height / 2;
              const x2 = toNode.x + toNode.width / 2;
              const y2 = toNode.y + toNode.height / 2;
              const midX = (x1 + x2) / 2;
              const midY = (y1 + y2) / 2;
              const pathD = `M ${x1} ${y1} Q ${midX} ${y1}, ${midX} ${midY} T ${x2} ${y2}`;

              return (
                <g key={conn.id}>
                  <path
                    d={pathD}
                    fill="none"
                    stroke={conn.color || '#6366f1'}
                    strokeWidth={2.5}
                    strokeDasharray={conn.style === 'dashed' ? '6 6' : undefined}
                    markerEnd="url(#wb-arrow)"
                  />
                  {conn.label && (
                    <g transform={`translate(${midX - 36}, ${midY - 11})`}>
                      <rect
                        width="72"
                        height="22"
                        rx="6"
                        fill={darkMode ? '#0f172a' : '#ffffff'}
                        stroke={conn.color || '#6366f1'}
                        strokeWidth="1"
                      />
                      <text
                        x="36"
                        y="14"
                        textAnchor="middle"
                        fill={darkMode ? '#e2e8f0' : '#1e293b'}
                        fontSize="10"
                        fontWeight="bold"
                      >
                        {conn.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Saved Freehand Vector Strokes */}
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

            {/* Active Pen Stroke in Flight */}
            {currentStrokePoints && currentStrokePoints.length > 1 && (
              <path
                d={currentStrokePoints
                  .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
                  .join(' ')}
                fill="none"
                stroke={activeColor}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>

          {/* Canvas Nodes (Frames first, then other nodes on top) */}
          {activeBoard?.nodes
            .slice()
            .sort((a, b) => (a.type === 'frame' ? -1 : b.type === 'frame' ? 1 : 0))
            .map(node => {
              const isSelected = selectedNodeId === node.id;
              const isEditing = editingNodeId === node.id;
              const isConnSource = connectorStartNodeId === node.id;
              const linkedTask = node.linkedTaskId
                ? tasks.find(t => t.id === node.linkedTaskId)
                : undefined;

              const isFrame = node.type === 'frame';
              const isSticky = node.type === 'sticky';
              const isDoc = node.type === 'doc_card';
              const isCircle = node.type === 'circle';
              const isDiamond = node.type === 'diamond';

              return (
                <div
                  key={node.id}
                  style={{
                    left: node.x,
                    top: node.y,
                    width: node.width,
                    height: node.height,
                    borderColor: isSelected || isConnSource ? node.color : `${node.color}66`,
                    backgroundColor: isFrame
                      ? darkMode
                        ? 'rgba(15, 23, 42, 0.45)'
                        : 'rgba(255, 255, 255, 0.55)'
                      : isSticky
                      ? darkMode
                        ? `${node.color}24`
                        : `${node.color}18`
                      : darkMode
                      ? 'rgba(15, 23, 42, 0.95)'
                      : 'rgba(255, 255, 255, 0.98)',
                  }}
                  onMouseDown={e => {
                    e.stopPropagation();
                    if (activeTool === 'connector') {
                      handleNodeClick(e, node);
                      return;
                    }
                    setSelectedNodeId(node.id);
                    if (!isEditing) {
                      draggingNodeRef.current = {
                        nodeId: node.id,
                        startClientX: e.clientX,
                        startClientY: e.clientY,
                        origX: node.x,
                        origY: node.y,
                      };
                    }
                  }}
                  onDoubleClick={e => {
                    e.stopPropagation();
                    setSelectedNodeId(node.id);
                    setEditingNodeId(node.id);
                  }}
                  className={`absolute pointer-events-auto transition-shadow flex flex-col justify-between p-3.5 ${
                    isCircle ? 'rounded-full text-center items-center justify-center' : 'rounded-2xl'
                  } ${
                    isFrame ? 'border-2 border-dashed backdrop-blur-xs' : 'border-2 shadow-lg'
                  } ${
                    isSelected
                      ? 'ring-4 ring-accent/30 shadow-2xl z-20'
                      : isFrame
                      ? 'z-0'
                      : 'z-10 hover:shadow-xl'
                  }`}
                >
                  {/* Top Header / Badge Row */}
                  <div className="w-full">
                    <div className="flex items-center justify-between gap-1.5 mb-1.5">
                      <span
                        style={{ color: node.color }}
                        className="text-[10px] font-extrabold uppercase tracking-wider truncate"
                      >
                        {node.type.replace('_', ' ')}
                        {isDiamond ? ' ◆' : ''}
                      </span>

                      <div className="flex items-center gap-1">
                        {linkedTask ? (
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              openViewTaskModal(linkedTask.id);
                            }}
                            className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/30 cursor-pointer"
                            title="Open Linked Kanban Task"
                          >
                            ✓ {linkedTask.status.replace(/_/g, ' ')}
                          </button>
                        ) : (
                          !isFrame && (
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                handleConvertNodeToTask(node);
                              }}
                              className="opacity-0 group-hover:opacity-100 hover:opacity-100 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-accent/15 text-accent hover:bg-accent hover:text-white transition-colors cursor-pointer"
                              style={{ opacity: isSelected ? 1 : undefined }}
                              title="1-Click Convert Node to Kanban Task"
                            >
                              + Task
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {/* Editable Title & Content */}
                    {isEditing ? (
                      <div className="space-y-1.5" onClick={e => e.stopPropagation()}>
                        <input
                          type="text"
                          value={node.title || ''}
                          onChange={e =>
                            upsertNode({ ...node, title: e.target.value, updatedAt: Date.now() }, true)
                          }
                          className={`w-full px-2 py-1 rounded-lg text-xs font-bold border outline-none ${
                            darkMode
                              ? 'bg-slate-800 border-slate-700 text-white'
                              : 'bg-white border-slate-300 text-slate-900'
                          }`}
                          placeholder="Title..."
                          autoFocus
                        />
                        <textarea
                          rows={isDoc ? 4 : 2}
                          value={node.content}
                          onChange={e =>
                            upsertNode({ ...node, content: e.target.value, updatedAt: Date.now() }, true)
                          }
                          onBlur={() => setEditingNodeId(null)}
                          className={`w-full px-2 py-1 rounded-lg text-xs border outline-none resize-none ${
                            darkMode
                              ? 'bg-slate-800 border-slate-700 text-slate-200'
                              : 'bg-white border-slate-300 text-slate-800'
                          }`}
                          placeholder="Write specification or notes..."
                        />
                      </div>
                    ) : (
                      <>
                        {node.title && (
                          <h4
                            className={`text-xs sm:text-sm font-bold leading-snug mb-1 ${
                              darkMode ? 'text-white' : 'text-slate-900'
                            }`}
                          >
                            {node.title}
                          </h4>
                        )}
                        <p
                          className={`text-xs whitespace-pre-line leading-relaxed line-clamp-5 ${
                            darkMode ? 'text-slate-300' : 'text-slate-600'
                          }`}
                        >
                          {node.content}
                        </p>
                      </>
                    )}
                  </div>

                  {/* Bottom Footer: Author, Emoji Reactions & Resize Handle */}
                  {!isFrame && !isCircle && (
                    <div className="flex items-center justify-between gap-1 pt-2 mt-1 border-t border-slate-200/40 dark:border-slate-800/60">
                      <div className="flex items-center gap-1 flex-wrap">
                        {['👍', '🔥', '🚀'].map(emoji => {
                          const count = node.reactions?.[emoji] || 0;
                          return (
                            <button
                              key={emoji}
                              type="button"
                              onClick={e => handleToggleReaction(e, node, emoji)}
                              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono transition-all cursor-pointer ${
                                count > 0
                                  ? 'bg-accent/15 text-accent font-bold border border-accent/30'
                                  : 'opacity-50 hover:opacity-100'
                              }`}
                            >
                              {emoji} {count > 0 ? count : ''}
                            </button>
                          );
                        })}
                      </div>

                      {node.authorName && (
                        <span className="text-[10px] text-slate-400 truncate max-w-[90px]">
                          {node.authorName}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Bottom-Right Resize Handle */}
                  {isSelected && (
                    <div
                      onMouseDown={e => {
                        e.stopPropagation();
                        resizingNodeRef.current = {
                          nodeId: node.id,
                          startClientX: e.clientX,
                          startClientY: e.clientY,
                          origW: node.width,
                          origH: node.height,
                        };
                      }}
                      className="w-3.5 h-3.5 rounded-full bg-accent border-2 border-white dark:border-slate-900 absolute -bottom-1.5 -right-1.5 cursor-nwse-resize shadow-md"
                      title="Drag to resize node"
                    />
                  )}
                </div>
              );
            })}

          {/* Live Multiplayer Teammate Cursors */}
          {(Object.values(remoteCursors) as WhiteboardCursor[]).map(cursor => (
            <div
              key={cursor.userId}
              style={{
                transform: `translate(${cursor.x}px, ${cursor.y}px)`,
              }}
              className="absolute top-0 left-0 pointer-events-none z-50 transition-transform duration-75"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill={cursor.color || '#10b981'}
                className="drop-shadow-md"
              >
                <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
              </svg>
              <span
                style={{ backgroundColor: cursor.color || '#10b981' }}
                className="ml-3 -mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-md whitespace-nowrap"
              >
                {cursor.userName}
              </span>
            </div>
          ))}
        </div>

        {/* Selected Node Quick Inspector Pill (Top-Right of Canvas) */}
        {selectedNode && (
          <div
            className={`absolute top-4 right-4 z-30 p-3.5 rounded-2xl border shadow-2xl backdrop-blur-xl flex flex-col gap-2.5 w-64 animate-fadeIn ${
              darkMode
                ? 'bg-slate-900/95 border-slate-700 text-slate-100'
                : 'bg-white/95 border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-accent">
                Inspector • {selectedNode.type.replace('_', ' ')}
              </span>
              <button
                type="button"
                onClick={() => handleDeleteNode(selectedNode.id)}
                className="text-xs font-bold text-rose-500 hover:underline cursor-pointer"
              >
                Delete
              </button>
            </div>

            {/* Node Color Picker */}
            <div className="flex items-center gap-1.5">
              {NODE_COLORS.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    upsertNode({ ...selectedNode, color: c.hex, updatedAt: Date.now() }, true)
                  }
                  style={{ backgroundColor: c.hex }}
                  className={`w-5 h-5 rounded-full transition-transform cursor-pointer ${
                    selectedNode.color === c.hex ? 'scale-125 ring-2 ring-white' : 'opacity-75 hover:opacity-100'
                  }`}
                  title={c.label}
                />
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditingNodeId(selectedNode.id)}
                className="flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Edit Text
              </button>
              <button
                type="button"
                onClick={() => handleConvertNodeToTask(selectedNode)}
                className="flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold bg-accent text-white hover:opacity-95 transition-opacity cursor-pointer"
              >
                Convert to Task
              </button>
            </div>
          </div>
        )}

        {/* 3. Floating Bottom FigJam / Figma Tool Dock */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 max-w-[95vw]">
          <div
            className={`flex items-center gap-1 sm:gap-1.5 px-3 py-2 rounded-2xl border shadow-2xl backdrop-blur-xl overflow-x-auto scrollbar-none ${
              darkMode
                ? 'bg-slate-900/95 border-slate-700/80 text-slate-100'
                : 'bg-white/95 border-slate-200/90 text-slate-900'
            }`}
          >
            {[
              { id: 'select' as const, label: 'Select (V)', short: 'V', icon: '↖' },
              { id: 'pan' as const, label: 'Pan Hand (H)', short: 'H', icon: '✋' },
              { id: 'frame' as const, label: 'Frame (F)', short: 'F', icon: '⊞' },
              { id: 'sticky' as const, label: 'Sticky Note (S)', short: 'S', icon: '🗒' },
              { id: 'rectangle' as const, label: 'Rectangle (R)', short: 'R', icon: '▭' },
              { id: 'diamond' as const, label: 'Decision (G)', short: 'G', icon: '◇' },
              { id: 'circle' as const, label: 'Circle Node (O)', short: 'O', icon: '◯' },
              { id: 'doc_card' as const, label: 'Doc / Spec Card (D)', short: 'D', icon: '📄' },
              { id: 'connector' as const, label: 'Connector Arrow (C)', short: 'C', icon: '↗' },
              { id: 'pen' as const, label: 'Freehand Pen (P)', short: 'P', icon: '✎' },
            ].map(tool => {
              const isAct = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => {
                    soundService.play('click_soft');
                    setActiveTool(tool.id);
                    if (tool.id !== 'connector') setConnectorStartNodeId(null);
                  }}
                  title={tool.label}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    isAct
                      ? 'bg-accent text-white shadow-md scale-105'
                      : darkMode
                      ? 'text-slate-300 hover:bg-slate-800'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-sm leading-none">{tool.icon}</span>
                  <span className="hidden md:inline">{tool.label.split(' (')[0]}</span>
                  <kbd className="text-[9px] font-mono opacity-65">{tool.short}</kbd>
                </button>
              );
            })}

            {/* Active Tool Color Swatch */}
            <div className="flex items-center gap-1 pl-2 ml-1 border-l border-slate-200 dark:border-slate-800">
              {NODE_COLORS.slice(0, 5).map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveColor(c.hex)}
                  style={{ backgroundColor: c.hex }}
                  className={`w-4 h-4 rounded-full transition-transform cursor-pointer ${
                    activeColor === c.hex ? 'scale-125 ring-2 ring-white dark:ring-slate-200' : 'opacity-70'
                  }`}
                  title={`Active color: ${c.label}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default WhiteboardStudioPage;
