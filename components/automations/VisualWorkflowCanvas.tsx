import React, { useState, useRef, useEffect } from 'react';
import {
  AutomationRule,
  AutomationTriggerType,
  AutomationActionType,
  TaskStatus,
  TaskPriority,
} from '../../types';
import { addAutomationLog } from '../../services/automationEngine';

interface FlowCanvasNode {
  id: string;
  kind: 'trigger' | 'condition' | 'action';
  title: string;
  subtitle: string;
  badge: string;
  color: string;
  x: number;
  y: number;
  configValue: string;
  latencyMs?: number;
  runState?: 'idle' | 'running' | 'passed';
}

interface FlowCanvasEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
}

interface VisualWorkflowCanvasProps {
  onSaveCompiledRule: (rule: AutomationRule) => void;
  onLogCreated: () => void;
}

export const VisualWorkflowCanvas: React.FC<VisualWorkflowCanvasProps> = ({
  onSaveCompiledRule,
  onLogCreated,
}) => {
  const [workflowName, setWorkflowName] = useState(
    'Critical Review Escalation & Slack/Webhook Pipeline'
  );
  const [nodes, setNodes] = useState<FlowCanvasNode[]>([
    {
      id: 'node-trigger-1',
      kind: 'trigger',
      title: 'When Task Status Changes',
      subtitle: 'Event: task.status_changed',
      badge: 'TRIGGER',
      color: 'bg-[var(--accent-lime)] text-[var(--accent-ink)]',
      x: 50,
      y: 150,
      configValue: 'status_change',
    },
    {
      id: 'node-cond-1',
      kind: 'condition',
      title: 'Filter: Status == In Review & Priority >= High',
      subtitle: 'Guard Condition Evaluates True',
      badge: 'CONDITION',
      color: 'bg-amber-400/20 text-amber-300 border border-amber-400/30',
      x: 370,
      y: 150,
      configValue: TaskStatus.REVIEW,
    },
    {
      id: 'node-act-1',
      kind: 'action',
      title: 'Escalate Priority & Assign Lead Reviewer',
      subtitle: 'Action: escalate_priority + assign_user',
      badge: 'ACTION #1',
      color: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
      x: 710,
      y: 70,
      configValue: 'escalate_priority',
    },
    {
      id: 'node-act-2',
      kind: 'action',
      title: 'Dispatch Outbound Webhook & Team Chat Alert',
      subtitle: 'POST https://api.enterprise.internal/hooks/sprint',
      badge: 'ACTION #2',
      color: 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
      x: 710,
      y: 235,
      configValue: 'send_notification',
    },
  ]);

  const [edges, setEdges] = useState<FlowCanvasEdge[]>([
    { id: 'e-1', from: 'node-trigger-1', to: 'node-cond-1', label: 'Event Payload' },
    { id: 'e-2', from: 'node-cond-1', to: 'node-act-1', label: 'If True' },
    { id: 'e-3', from: 'node-cond-1', to: 'node-act-2', label: 'Parallel' },
  ]);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('node-cond-1');
  const [draggingNode, setDraggingNode] = useState<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const [isDryRunning, setIsDryRunning] = useState(false);

  const canvasRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!draggingNode) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - draggingNode.startX;
      const dy = e.clientY - draggingNode.startY;
      setNodes(prev =>
        prev.map(n =>
          n.id === draggingNode.id
            ? {
                ...n,
                x: Math.max(16, Math.min(920, draggingNode.origX + dx)),
                y: Math.max(16, Math.min(380, draggingNode.origY + dy)),
              }
            : n
        )
      );
    };
    const onUp = () => setDraggingNode(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [draggingNode]);

  const handleRunDryRunSimulation = () => {
    if (isDryRunning) return;
    setIsDryRunning(true);
    setNodes(prev => prev.map(n => ({ ...n, runState: 'idle', latencyMs: undefined })));

    // Step 1: Trigger fires
    setTimeout(() => {
      setNodes(prev =>
        prev.map(n =>
          n.kind === 'trigger' ? { ...n, runState: 'passed', latencyMs: 4 } : n
        )
      );
    }, 250);

    // Step 2: Condition evaluates
    setTimeout(() => {
      setNodes(prev =>
        prev.map(n =>
          n.kind === 'condition' ? { ...n, runState: 'passed', latencyMs: 9 } : n
        )
      );
    }, 650);

    // Step 3: Actions execute in parallel
    setTimeout(() => {
      setNodes(prev =>
        prev.map(n =>
          n.kind === 'action'
            ? { ...n, runState: 'passed', latencyMs: Math.floor(14 + Math.random() * 18) }
            : n
        )
      );
      addAutomationLog({
        ruleId: 'visual-flow-sim',
        ruleName: workflowName,
        taskId: 'dry-run-task',
        taskTitle: 'Visual Canvas Dry-Run Verification',
        triggerEvent: 'Visual Flow Trigger Evaluated (4ms)',
        actionTaken: 'Executed 2 parallel downstream action nodes (21ms total)',
        details: 'Dry-run simulation completed successfully',
        status: 'success',
      });
      onLogCreated();
      setIsDryRunning(false);
    }, 1150);
  };

  const handleAddActionNode = () => {
    const newId = `node-act-${Date.now()}`;
    const newNode: FlowCanvasNode = {
      id: newId,
      kind: 'action',
      title: 'Add Checklist & Notify Assignee',
      subtitle: 'Action: add_checklist + notify',
      badge: `ACTION #${nodes.filter(n => n.kind === 'action').length + 1}`,
      color: 'bg-[#CCF048]/20 text-[#CCF048] border border-[#CCF048]/30',
      x: 710,
      y: 340,
      configValue: 'add_checklist',
    };
    const condNode = nodes.find(n => n.kind === 'condition') || nodes[0];
    setNodes(prev => [...prev, newNode]);
    if (condNode) {
      setEdges(prev => [
        ...prev,
        { id: `e-${Date.now()}`, from: condNode.id, to: newId, label: 'Branch' },
      ]);
    }
    setSelectedNodeId(newId);
  };

  const handleCompileAndSave = () => {
    const triggerNode = nodes.find(n => n.kind === 'trigger');
    const condNode = nodes.find(n => n.kind === 'condition');
    const actNode = nodes.find(n => n.kind === 'action');

    const newRule: AutomationRule = {
      id: `rule-visual-${Date.now()}`,
      name: workflowName.trim() || 'Visual Canvas Workflow Rule',
      description: `Compiled from Visual Node Studio (${nodes.length} nodes, ${edges.length} edges)`,
      enabled: true,
      triggerEvent: (triggerNode?.configValue as AutomationTriggerType) || 'status_change',
      triggerConditionValue: condNode?.configValue || TaskStatus.REVIEW,
      actionType: (actNode?.configValue as AutomationActionType) || 'set_priority',
      actionTargetValue: TaskPriority.CRITICAL,
      executionCount: 1,
      createdAt: new Date().toISOString(),
    };
    onSaveCompiledRule(newRule);
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || null;
  const NODE_W = 240;
  const NODE_H = 92;

  return (
    <div className="editorial-surface overflow-hidden">
      {/* Top Studio Bar */}
      <div className="px-4 py-3 border-b border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-3 bg-[var(--bg-surface-subtle)]">
        <div className="flex items-center gap-2.5 flex-1 min-w-[240px]">
          <span className="px-2.5 py-0.5 rounded-full bg-[var(--bg-sage)] text-[var(--text-primary)] text-[10px] font-bold uppercase tracking-wider border border-[var(--border-hairline)]">
            Node-Graph Studio
          </span>
          <input
            type="text"
            value={workflowName}
            onChange={e => setWorkflowName(e.target.value)}
            className="flex-1 max-w-md px-3 py-1 text-xs font-bold rounded-full"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAddActionNode}
            className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[var(--bg-sage)] hover:bg-[var(--bg-sage-hover)] text-[var(--text-primary)] border border-[var(--border-hairline)] transition cursor-pointer"
          >
            + Add Action Node
          </button>
          <button
            type="button"
            onClick={handleRunDryRunSimulation}
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 transition flex items-center gap-1.5 cursor-pointer"
          >
            <span>▶</span> {isDryRunning ? 'Simulating Pipeline...' : 'Dry-Run Pipeline'}
          </button>
          <button
            type="button"
            onClick={handleCompileAndSave}
            className="px-4 py-1.5 rounded-full text-xs font-bold bg-[var(--accent-lime)] hover:bg-[var(--accent-lime-hover)] text-[var(--accent-ink)] shadow-xs transition cursor-pointer"
          >
            ✓ Compile & Activate Rule
          </button>
        </div>
      </div>

      {/* Interactive Node Graph Canvas */}
      <div
        ref={canvasRef}
        className="relative h-[470px] w-full overflow-x-auto bg-[#131511] bg-[radial-gradient(#2E3427_1px,transparent_1px)] [background-size:20px_20px] select-none"
      >
        {/* SVG Edges Layer */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ minWidth: 1020 }}>
          <defs>
            <marker
              id="flow-arrow"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="4"
              orient="auto"
            >
              <path d="M0,1 L7,4 L0,7 Z" fill="#CCF048" />
            </marker>
          </defs>
          {edges.map(edge => {
            const fromNode = nodes.find(n => n.id === edge.from);
            const toNode = nodes.find(n => n.id === edge.to);
            if (!fromNode || !toNode) return null;

            const x1 = fromNode.x + NODE_W;
            const y1 = fromNode.y + NODE_H / 2;
            const x2 = toNode.x;
            const y2 = toNode.y + NODE_H / 2;
            const ctrl = Math.max(40, Math.abs(x2 - x1) * 0.45);
            const d = `M ${x1} ${y1} C ${x1 + ctrl} ${y1}, ${x2 - ctrl} ${y2}, ${x2} ${y2}`;
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;

            return (
              <g key={edge.id}>
                <path
                  d={d}
                  fill="none"
                  stroke={isDryRunning ? '#34d399' : '#97B832'}
                  strokeWidth={2.2}
                  strokeDasharray={isDryRunning ? '6 4' : undefined}
                  markerEnd="url(#flow-arrow)"
                />
                {edge.label && (
                  <g transform={`translate(${midX - 34}, ${midY - 10})`}>
                    <rect
                      width="68"
                      height="18"
                      rx="6"
                      fill="#1A1D17"
                      stroke="#3B4234"
                      strokeWidth="1"
                    />
                    <text
                      x="34"
                      y="12"
                      textAnchor="middle"
                      fill="#A6AC9C"
                      fontSize="9"
                      fontWeight="bold"
                    >
                      {edge.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Draggable Nodes Layer */}
        {nodes.map(node => {
          const isSelected = node.id === selectedNodeId;
          return (
            <div
              key={node.id}
              style={{ left: node.x, top: node.y, width: NODE_W, height: NODE_H }}
              onMouseDown={e => {
                e.stopPropagation();
                setSelectedNodeId(node.id);
                setDraggingNode({
                  id: node.id,
                  startX: e.clientX,
                  startY: e.clientY,
                  origX: node.x,
                  origY: node.y,
                });
              }}
              className={`absolute rounded-2xl bg-[#1A1D17]/95 border p-3 cursor-grab active:cursor-grabbing transition-shadow flex flex-col justify-between ${
                isSelected
                  ? 'border-[#CCF048] ring-2 ring-[#CCF048]/25 shadow-xl'
                  : 'border-[#3B4234] hover:border-[#687358] shadow-md'
              }`}
            >
              {/* Input & Output Port Handles */}
              {node.kind !== 'trigger' && (
                <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-[#CCF048] border-2 border-[#131511]" />
              )}
              <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#131511]" />

              <div className="flex items-center justify-between gap-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${node.color}`}
                >
                  {node.badge}
                </span>
                {node.runState === 'passed' && (
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold tabular-nums border border-emerald-500/30">
                    ✓ {node.latencyMs}ms PASS
                  </span>
                )}
              </div>

              <div>
                <div className="text-xs font-bold text-[#F2F3EE] truncate">{node.title}</div>
                <div className="text-[10px] text-[#A6AC9C] font-mono truncate mt-0.5">
                  {node.subtitle}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Node Inspector Footer */}
      {selectedNode && (
        <div className="px-4 py-3 border-t border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase">Selected Node:</span>
            <input
              type="text"
              value={selectedNode.title}
              onChange={e => {
                const val = e.target.value;
                setNodes(prev =>
                  prev.map(n => (n.id === selectedNode.id ? { ...n, title: val } : n))
                );
              }}
              className="px-3 py-1 text-xs font-semibold rounded-full w-72"
            />
          </div>
          <div className="text-[11px] text-[var(--text-muted)] font-mono">
            Drag nodes anywhere on the grid · Click "Dry-Run Pipeline" to verify latency
          </div>
        </div>
      )}
    </div>
  );
};

export default VisualWorkflowCanvas;
