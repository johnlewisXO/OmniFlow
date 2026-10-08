import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { UserRole, normalizeUserRole } from '../../types';
import logMonitorService, { SystemLogEntry, SystemLogLevel } from '../../services/logMonitorService';
import { ICON_MAP } from '../../constants';
import { Modal } from './Modal';

interface SystemLogMonitorPanelProps {
  compact?: boolean;
}

export const SystemLogMonitorPanel: React.FC<SystemLogMonitorPanelProps> = ({ compact = false }) => {
  const { currentUser, darkMode, addToast } = useAppStore();
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [levelFilter, setLevelFilter] = useState<'ALL' | SystemLogLevel>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPaused, setIsPaused] = useState(logMonitorService.getPaused());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const normalizedRole = normalizeUserRole(currentUser?.role);
  const hasAccess = normalizedRole === UserRole.OWNER || normalizedRole === UserRole.PROJECT_MANAGER;

  useEffect(() => {
    if (!hasAccess) return;
    const unsubscribe = logMonitorService.subscribe(updated => {
      setLogs(updated);
    });
    return () => unsubscribe();
  }, [hasAccess]);

  const stats = useMemo(() => {
    return {
      total: logs.length,
      exceptions: logs.filter(l => l.level === 'EXCEPTION' || l.level === 'ERROR').length,
      warnings: logs.filter(l => l.level === 'WARN').length,
      realtime: logs.filter(l => l.level === 'REALTIME').length,
      security: logs.filter(l => l.level === 'SECURITY').length,
    };
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter(entry => {
      if (levelFilter !== 'ALL') {
        if (levelFilter === 'EXCEPTION' && entry.level !== 'EXCEPTION' && entry.level !== 'ERROR') {
          return false;
        } else if (levelFilter !== 'EXCEPTION' && entry.level !== levelFilter) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          entry.message.toLowerCase().includes(q) ||
          entry.source.toLowerCase().includes(q) ||
          (entry.details && entry.details.toLowerCase().includes(q)) ||
          (entry.stack && entry.stack.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [logs, levelFilter, searchQuery]);

  if (!hasAccess) {
    return (
      <div className={`p-6 rounded-2xl border text-center ${darkMode ? 'bg-slate-900/80 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}>
        <ICON_MAP.ShieldCheckIcon className="w-10 h-10 mx-auto mb-2 text-rose-500" />
        <h3 className="text-sm font-bold">Restricted Telemetry Access</h3>
        <p className="text-xs text-slate-400 mt-1">
          Exception & Console Log Monitoring is strictly restricted to <strong>OWNER</strong> and <strong>PROJECT MANAGER</strong> roles.
        </p>
      </div>
    );
  }

  const handleTogglePause = () => {
    const next = !isPaused;
    logMonitorService.setPaused(next);
    setIsPaused(next);
    addToast(
      next ? 'Telemetry Stream Paused' : 'Telemetry Stream Resumed',
      next ? 'Live console and exception capture is paused.' : 'Live console and exception capture is active.',
      'info'
    );
  };

  const handleSimulateDiagnostic = (type: 'exception' | 'warn' | 'realtime') => {
    if (type === 'exception') {
      logMonitorService.addEntry({
        level: 'EXCEPTION',
        source: 'DiagnosticProbe',
        message: 'Simulated Runtime Exception: Deadlock detected in async task transition pipeline [ERR_PROBE_503]',
        stack: `Error: Deadlock detected in async task transition pipeline [ERR_PROBE_503]\n    at TaskMutationQueue.flush (services/supabaseService.ts:412:19)\n    at async Object.updateTask (hooks/useAppStore.ts:1104:9)`,
        details: JSON.stringify(
          {
            probe: true,
            triggeredBy: currentUser?.email,
            role: normalizedRole,
            timestamp: new Date().toISOString(),
          },
          null,
          2
        ),
      });
    } else if (type === 'warn') {
      console.warn('[RateLimitGuard] Presence update coalesced into 15s window to prevent Supabase client_rate_limit_exceeded.');
    } else {
      logMonitorService.addEntry({
        level: 'REALTIME',
        source: 'CollabService',
        message: 'WebSocket heartbeat ACK received from omni_flow_live_v3 (latency: 18ms)',
        details: JSON.stringify({ channel: 'omni_flow_live_v3', status: 'SUBSCRIBED', latencyMs: 18 }, null, 2),
      });
    }
  };

  const handleExportLogs = () => {
    const blob = new Blob([JSON.stringify(filteredLogs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `omni-flow-telemetry-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('Diagnostic Report Exported', `Exported ${filteredLogs.length} log entries as JSON.`, 'success');
  };

  const getBadgeStyle = (level: SystemLogLevel) => {
    switch (level) {
      case 'EXCEPTION':
      case 'ERROR':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      case 'WARN':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'REALTIME':
        return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
      case 'SECURITY':
        return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
      default:
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Role Verification Strip */}
      <div className={`p-4 rounded-2xl border flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
        darkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-900 text-white border-slate-800'
      }`}>
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30 flex-shrink-0">
            <ICON_MAP.CodeBracketIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-white">
                Platform Exception & Console Log Telemetry
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                RBAC: {normalizedRole.replace(/_/g, ' ')} ACCESS
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                <span className={`w-1.5 h-1.5 rounded-full ${isPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-ping'}`} />
                {isPaused ? 'STREAM PAUSED' : 'LIVE INTERCEPTOR'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Real-time runtime exception stack traces, unhandled promise rejections, WebSocket frames, and console diagnostics.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleSimulateDiagnostic('exception')}
            className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[11px] font-semibold transition-colors cursor-pointer"
          >
            + Test Exception
          </button>
          <button
            type="button"
            onClick={() => handleSimulateDiagnostic('realtime')}
            className="px-2.5 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 text-[11px] font-semibold transition-colors cursor-pointer"
          >
            + Ping WebSocket
          </button>
          <button
            type="button"
            onClick={handleTogglePause}
            className={`px-3 py-1.5 rounded-xl border text-[11px] font-semibold transition-colors cursor-pointer ${
              isPaused
                ? 'bg-emerald-600 text-white border-emerald-500'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            {isPaused ? 'Resume Stream' : 'Pause Stream'}
          </button>
          <button
            type="button"
            onClick={handleExportLogs}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold transition-colors cursor-pointer"
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={() => logMonitorService.clearLogs()}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Telemetry KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {[
          { id: 'ALL', label: 'Total Captured', count: stats.total, color: 'text-slate-200' },
          { id: 'EXCEPTION', label: 'Exceptions & Errors', count: stats.exceptions, color: 'text-rose-400' },
          { id: 'WARN', label: 'Warnings', count: stats.warnings, color: 'text-amber-400' },
          { id: 'REALTIME', label: 'Realtime / WS', count: stats.realtime, color: 'text-sky-400' },
          { id: 'SECURITY', label: 'Security & RBAC', count: stats.security, color: 'text-purple-400' },
        ].map(card => (
          <button
            key={card.id}
            type="button"
            onClick={() => setLevelFilter(card.id as any)}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              levelFilter === card.id
                ? 'bg-indigo-600/15 border-indigo-500 shadow-xs'
                : darkMode
                ? 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{card.label}</div>
            <div className={`text-lg font-mono tabular-nums font-bold mt-0.5 ${
              darkMode ? card.color : 'text-slate-900'
            }`}>
              {card.count}
            </div>
          </button>
        ))}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Filter stack traces, error codes, sources, or console output..."
            className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border font-mono ${
              darkMode ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
            }`}
          />
          <ICON_MAP.SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800 overflow-x-auto">
          {(['ALL', 'EXCEPTION', 'WARN', 'REALTIME', 'SECURITY', 'INFO'] as const).map(lvl => (
            <button
              key={lvl}
              type="button"
              onClick={() => setLevelFilter(lvl)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold transition-colors cursor-pointer ${
                levelFilter === lvl
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Terminal Output Stream */}
      <div
        className={`rounded-2xl border bg-slate-950 border-slate-800 text-slate-200 font-mono text-xs overflow-hidden shadow-inner`}
      >
        <div className="px-4 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
            <span className="ml-2 text-slate-300 font-semibold">omni-flow://telemetry/console-stream</span>
          </div>
          <span>Showing {filteredLogs.length} of {logs.length} events</span>
        </div>

        <div className={`${compact ? 'max-h-80' : 'max-h-[440px]'} overflow-y-auto divide-y divide-slate-900 scrollbar-thin`}>
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              No console or exception events match the current filter.
            </div>
          ) : (
            filteredLogs.map(entry => {
              const isExpanded = expandedId === entry.id;
              const hasExtra = Boolean(entry.stack || entry.details);
              return (
                <div
                  key={entry.id}
                  className={`px-4 py-2.5 hover:bg-slate-900/60 transition-colors ${
                    entry.level === 'EXCEPTION' || entry.level === 'ERROR' ? 'bg-rose-950/20' : ''
                  }`}
                >
                  <div
                    onClick={() => hasExtra && setExpandedId(isExpanded ? null : entry.id)}
                    className={`flex items-start justify-between gap-3 ${hasExtra ? 'cursor-pointer' : ''}`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <span className="text-[10px] text-slate-500 tabular-nums whitespace-nowrap mt-0.5">
                        {new Date(entry.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border whitespace-nowrap ${getBadgeStyle(entry.level)}`}>
                        {entry.level}
                      </span>
                      <span className="text-[10px] text-indigo-400 whitespace-nowrap mt-0.5">
                        [{entry.source}]
                      </span>
                      <span className="text-xs text-slate-200 break-all leading-relaxed">
                        {entry.message}
                      </span>
                    </div>

                    {hasExtra && (
                      <button
                        type="button"
                        className="text-[10px] text-indigo-400 hover:underline whitespace-nowrap flex-shrink-0"
                      >
                        {isExpanded ? 'Hide Trace' : 'Inspect Trace'}
                      </button>
                    )}
                  </div>

                  {isExpanded && hasExtra && (
                    <div className="mt-2.5 pl-6 space-y-2">
                      {entry.stack && (
                        <div className="p-3 rounded-xl bg-black/70 border border-rose-500/30 text-rose-300 text-[11px] overflow-x-auto whitespace-pre">
                          {entry.stack}
                        </div>
                      )}
                      {entry.details && (
                        <div className="p-3 rounded-xl bg-black/60 border border-slate-800 text-emerald-300 text-[11px] overflow-x-auto whitespace-pre">
                          {entry.details}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export const SystemLogMonitorModal: React.FC = () => {
  const { currentUser } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleOpen = () => {
      if (logMonitorService.canUserAccessLogs(currentUser?.role)) {
        setIsOpen(true);
      }
    };
    window.addEventListener('omni_open_log_monitor', handleOpen);
    return () => window.removeEventListener('omni_open_log_monitor', handleOpen);
  }, [currentUser?.role]);

  if (!isOpen || !logMonitorService.canUserAccessLogs(currentUser?.role)) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title="Platform Exception & Console Log Monitor (Owner / PM)"
      size="4xl"
    >
      <SystemLogMonitorPanel />
    </Modal>
  );
};
