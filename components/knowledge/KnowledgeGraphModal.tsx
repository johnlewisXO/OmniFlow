import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ActiveView } from '../../types';

interface GraphNode {
  id: string;
  label: string;
  kind: 'project' | 'task' | 'doc' | 'whiteboard' | 'okr' | 'clip';
  color: string;
  x: number;
  y: number;
  targetView: ActiveView;
  taskId?: string;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
}

export const KnowledgeGraphModal: React.FC = () => {
  const { projects, tasks, activeProject, setActiveView, openViewTaskModal } = useAppStore();

  const [isOpen, setIsOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [filterKind, setFilterKind] = useState<string>('all');

  useEffect(() => {
    const onToggle = () => setIsOpen(v => !v);
    window.addEventListener('omni_toggle_knowledge_graph', onToggle);
    return () => window.removeEventListener('omni_toggle_knowledge_graph', onToggle);
  }, []);

  // Build deterministic spatial graph from live workspace entities
  const { initialNodes, edges } = useMemo(() => {
    const centerProj = activeProject || projects[0];
    const projNodeId = `proj-${centerProj?.id || 'main'}`;

    const nodesList: GraphNode[] = [
      {
        id: projNodeId,
        label: centerProj?.name || 'Core Workspace Hub',
        kind: 'project',
        color: '#6366f1',
        x: 380,
        y: 220,
        targetView: 'overview',
      },
      {
        id: 'wb-arch',
        label: 'System Architecture Whiteboard',
        kind: 'whiteboard',
        color: '#ec4899',
        x: 160,
        y: 100,
        targetView: 'whiteboard_view',
      },
      {
        id: 'doc-spec',
        label: 'PRD: Real-Time Sync & WebRTC Spec',
        kind: 'doc',
        color: '#10b981',
        x: 610,
        y: 95,
        targetView: 'docs_wiki_view',
      },
      {
        id: 'okr-q4',
        label: 'OKR: 99.98% Realtime SLA & Zero-Lag UX',
        kind: 'okr',
        color: '#f59e0b',
        x: 150,
        y: 340,
        targetView: 'okrs_goals_view',
      },
      {
        id: 'clip-walkthrough',
        label: 'Async Clip: Sprint 14 Walkthrough',
        kind: 'clip',
        color: '#f43f5e',
        x: 620,
        y: 345,
        targetView: 'async_clips_view',
      },
    ];

    const edgesList: GraphEdge[] = [
      { id: 'e-wb', source: projNodeId, target: 'wb-arch', relation: 'embeds canvas' },
      { id: 'e-doc', source: projNodeId, target: 'doc-spec', relation: 'specifies' },
      { id: 'e-okr', source: 'okr-q4', target: projNodeId, relation: 'measures' },
      { id: 'e-clip', source: 'clip-walkthrough', target: 'doc-spec', relation: 'explains' },
      { id: 'e-wb-doc', source: 'wb-arch', target: 'doc-spec', relation: 'backlinks' },
    ];

    // Add up to 5 real tasks around the ring
    const sampleTasks = tasks.slice(0, 5);
    sampleTasks.forEach((t, idx) => {
      const angle = (idx / Math.max(1, sampleTasks.length)) * Math.PI * 2 - Math.PI / 2;
      const radius = 155;
      const nid = `task-${t.id}`;
      nodesList.push({
        id: nid,
        label: t.title,
        kind: 'task',
        color: '#38bdf8',
        x: Math.round(380 + Math.cos(angle) * radius),
        y: Math.round(220 + Math.sin(angle) * radius),
        targetView: 'kanban',
        taskId: t.id,
      });
      edgesList.push({
        id: `e-t-${t.id}`,
        source: projNodeId,
        target: nid,
        relation: 'tracks task',
      });
      if (idx % 2 === 0) {
        edgesList.push({
          id: `e-tdoc-${t.id}`,
          source: 'doc-spec',
          target: nid,
          relation: 'converts to',
        });
      } else {
        edgesList.push({
          id: `e-twb-${t.id}`,
          source: 'wb-arch',
          target: nid,
          relation: 'linked node',
        });
      }
    });

    return { initialNodes: nodesList, edges: edgesList };
  }, [projects, tasks, activeProject]);

  const [nodes, setNodes] = useState<GraphNode[]>(initialNodes);
  useEffect(() => {
    setNodes(initialNodes);
    if (!selectedNodeId && initialNodes[0]) {
      setSelectedNodeId(initialNodes[0].id);
    }
  }, [initialNodes]);

  const [draggingId, setDraggingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const visibleNodes = nodes.filter(n => (filterKind === 'all' ? true : n.kind === filterKind));
  const selectedNode = nodes.find(n => n.id === selectedNodeId) || nodes[0];

  const connectedBacklinks = edges
    .filter(e => e.source === selectedNode?.id || e.target === selectedNode?.id)
    .map(e => {
      const otherId = e.source === selectedNode?.id ? e.target : e.source;
      const otherNode = nodes.find(n => n.id === otherId);
      const direction = e.source === selectedNode?.id ? 'Outgoing →' : '← Incoming';
      return { edge: e, otherNode, direction };
    })
    .filter(item => Boolean(item.otherNode));

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-5xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 text-white flex items-center justify-center text-xs font-bold">
              🕸️
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Bi-Directional Backlinks & Workspace Knowledge Graph
              </h2>
              <p className="text-[11px] text-slate-500">
                Interactive entity graph across Tasks, Spec Docs, Whiteboards, OKRs & Async Video Clips
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {['all', 'task', 'doc', 'whiteboard', 'okr', 'clip'].map(k => (
              <button
                key={k}
                onClick={() => setFilterKind(k)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase transition ${
                  filterKind === k
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}
              >
                {k}
              </button>
            ))}
            <button
              onClick={() => setIsOpen(false)}
              className="ml-2 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Graph Canvas + Right Backlink Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 h-[480px]">
          <div
            onMouseMove={e => {
              if (!draggingId) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const x = Math.max(40, Math.min(rect.width - 40, e.clientX - rect.left));
              const y = Math.max(40, Math.min(rect.height - 40, e.clientY - rect.top));
              setNodes(prev => prev.map(n => (n.id === draggingId ? { ...n, x, y } : n)));
            }}
            onMouseUp={() => setDraggingId(null)}
            className="lg:col-span-8 relative bg-slate-950 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:18px_18px] overflow-hidden"
          >
            <svg className="w-full h-full">
              {edges.map(edge => {
                const s = visibleNodes.find(n => n.id === edge.source);
                const t = visibleNodes.find(n => n.id === edge.target);
                if (!s || !t) return null;
                const isHighlighted =
                  selectedNode?.id === s.id || selectedNode?.id === t.id;
                return (
                  <g key={edge.id}>
                    <line
                      x1={s.x}
                      y1={s.y}
                      x2={t.x}
                      y2={t.y}
                      stroke={isHighlighted ? '#818cf8' : '#334155'}
                      strokeWidth={isHighlighted ? 2.2 : 1.2}
                      strokeDasharray={isHighlighted ? undefined : '4 3'}
                    />
                  </g>
                );
              })}

              {visibleNodes.map(node => {
                const isSelected = selectedNode?.id === node.id;
                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    onMouseDown={e => {
                      e.stopPropagation();
                      setSelectedNodeId(node.id);
                      setDraggingId(node.id);
                    }}
                    className="cursor-grab active:cursor-grabbing"
                  >
                    {isSelected && (
                      <circle r={24} fill={node.color} opacity={0.22} />
                    )}
                    <circle
                      r={node.kind === 'project' ? 16 : 12}
                      fill={node.color}
                      stroke="#0f172a"
                      strokeWidth={2.5}
                    />
                    <text
                      y={26}
                      textAnchor="middle"
                      fill="#e2e8f0"
                      fontSize="10"
                      fontWeight="bold"
                    >
                      {node.label.length > 26 ? `${node.label.slice(0, 26)}…` : node.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Right Bi-Directional Backlink Inspector */}
          <div className="lg:col-span-4 border-l border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between overflow-y-auto bg-white dark:bg-slate-900">
            {selectedNode && (
              <div className="space-y-4">
                <div>
                  <span
                    style={{ backgroundColor: `${selectedNode.color}20`, color: selectedNode.color }}
                    className="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                  >
                    {selectedNode.kind} node
                  </span>
                  <h3 className="mt-1.5 text-sm font-bold text-slate-900 dark:text-white">
                    {selectedNode.label}
                  </h3>
                </div>

                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Bi-Directional Backlinks ({connectedBacklinks.length})
                  </div>
                  <div className="space-y-2">
                    {connectedBacklinks.map(({ edge, otherNode, direction }) => (
                      <button
                        key={edge.id}
                        onClick={() => otherNode && setSelectedNodeId(otherNode.id)}
                        className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 text-left hover:border-indigo-500/40 transition"
                      >
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span className="font-mono font-bold text-indigo-500">{direction}</span>
                          <span className="uppercase">{edge.relation}</span>
                        </div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                          {otherNode?.label}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {selectedNode && (
              <button
                onClick={() => {
                  if (selectedNode.taskId) {
                    const found = tasks.find(t => t.id === selectedNode.taskId);
                    if (found) {
                      openViewTaskModal(found);
                      setIsOpen(false);
                      return;
                    }
                  }
                  setActiveView(selectedNode.targetView);
                  setIsOpen(false);
                }}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition"
              >
                Open in Workspace →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeGraphModal;
