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
      <div className="editorial-surface p-6 text-center text-[var(--text-primary)]">
        <ICON_MAP.ShieldCheckIcon className="w-10 h-10 mx-auto mb-2 text-rose-500" />
        <h3 className="text-sm font-bold">Restricted Telemetry Access</h3>
        <p className="text-xs text-[var(--text-muted)] mt-1">
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
        return 'bg-[var(--accent-lime)]/15 text-[#CCF048] border-[#CCF048]/30';
      case 'SECURITY':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      default:
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Role Verification Strip */}
      <div className="editorial-surface p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-[var(--bg-sage)] border border-[var(--border-hairline)] text-[var(--text-primary)] flex items-center justify-center flex-shrink-0">
            <ICON_MAP.CodeBracketIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                Platform Exception & Console Log Telemetry
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--bg-sage)] text-[var(--text-secondary)] border border-[var(--border-hairline)]">
                RBAC: {normalizedRole.replace(/_/g, ' ')} ACCESS
              </span>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                <span className={`w-1.5 h-1.5 rounded-full ${isPaused ? 'bg-amber-500' : 'bg-emerald-500 animate-ping'}`} />
                {isPaused ? 'STREAM PAUSED' : 'LIVE INTERCEPTOR'}
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Real-time runtime exception stack traces, unhandled promise rejections, WebSocket frames, and console diagnostics.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleSimulateDiagnostic('exception')}
            className="px-3 py-1.5 rounded-full bg-rose-500/12 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-[11px] font-semibold transition-colors cursor-pointer"
          >
            + Test Exception
          </button>
          <button
            type="button"
            onClick={() => handleSimulateDiagnostic('realtime')}
            className="px-3 py-1.5 rounded-full bg-[var(--bg-sage)] hover:bg-[var(--bg-sage-hover)] text-[var(--text-primary)] border border-[var(--border-hairline)] text-[11px] font-semibold transition-colors cursor-pointer"
          >
            + Ping WebSocket
          </button>
          <button
            type="button"
            onClick={handleTogglePause}
            className={`px-3 py-1.5 rounded-full border text-[11px] font-semibold transition-colors cursor-pointer ${
              isPaused
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-[var(--bg-surface-subtle)] hover:bg-[var(--bg-sage)] text-[var(--text-primary)] border-[var(--border-hairline)]'
            }`}
          >
            {isPaused ? 'Resume Stream' : 'Pause Stream'}
          </button>
          <button
            type="button"
            onClick={handleExportLogs}
            className="px-3.5 py-1.5 rounded-full bg-[var(--accent-lime)] hover:bg-[var(--accent-lime-hover)] text-[var(--accent-ink)] text-[11px] font-bold transition-colors cursor-pointer"
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={() => logMonitorService.clearLogs()}
            className="px-3 py-1.5 rounded-full bg-[var(--bg-surface-subtle)] hover:bg-[var(--bg-sage)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] text-[11px] font-semibold transition-colors cursor-pointer"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Telemetry KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {[
          { id: 'ALL', label: 'Total Captured', count: stats.total, color: 'text-[var(--text-primary)]' },
          { id: 'EXCEPTION', label: 'Exceptions & Errors', count: stats.exceptions, color: 'text-rose-600 dark:text-rose-400' },
          { id: 'WARN', label: 'Warnings', count: stats.warnings, color: 'text-amber-600 dark:text-amber-400' },
          { id: 'REALTIME', label: 'Realtime / WS', count: stats.realtime, color: 'text-[#5C7022] dark:text-[#CCF048]' },
          { id: 'SECURITY', label: 'Security & RBAC', count: stats.security, color: 'text-emerald-700 dark:text-emerald-400' },
        ].map(card => (
          <button
            key={card.id}
            type="button"
            onClick={() => setLevelFilter(card.id as any)}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
              levelFilter === card.id
                ? 'bg-[var(--bg-sage)] border-[var(--text-primary)] ring-1 ring-[var(--text-primary)]/20 shadow-xs'
                : 'bg-[var(--bg-surface)] border-[var(--border-hairline)] hover:border-[var(--border-strong)]'
            }`}
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{card.label}</div>
            <div className={`text-lg font-mono tabular-nums font-bold mt-0.5 ${card.color}`}>
              {card.count}
            </div>
          </button>
        ))}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="relative flex-1 flex items-center">
          <ICON_MAP.SearchIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none z-10" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Filter stack traces, error codes, sources, or console output..."
            className="w-full search-input !pl-10 !pr-4 !py-2 text-xs rounded-full border font-mono"
          />
        </div>

        <div className="flex items-center gap-1 p-1 rounded-full bg-[var(--bg-sage)] border border-[var(--border-hairline)] overflow-x-auto">
          {(['ALL', 'EXCEPTION', 'WARN', 'REALTIME', 'SECURITY', 'INFO'] as const).map(lvl => (
            <button
              key={lvl}
              type="button"
              onClick={() => setLevelFilter(lvl)}
              className={`px-3 py-1 rounded-full text-[10px] font-mono font-semibold transition-colors cursor-pointer ${
                levelFilter === lvl
                  ? 'bg-[#191B17] text-[#D4F542] dark:bg-[#CCF048] dark:text-[#131511] shadow-2xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Terminal Output Stream */}
      <div className="rounded-2xl border border-[#2B3026] bg-[#131511] text-[#E6E9DF] font-mono text-xs overflow-hidden shadow-inner">
        <div className="px-4 py-2 bg-[#1A1D17] border-b border-[#2B3026] flex items-center justify-between text-[11px] text-[#A6AC9C]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#CCF048]/85" />
            <span className="ml-2 text-[#F2F3EE] font-semibold">omni-flow://telemetry/console-stream</span>
          </div>
          <span>Showing {filteredLogs.length} of {logs.length} events</span>
        </div>

        <div className={`${compact ? 'max-h-80' : 'max-h-[440px]'} overflow-y-auto divide-y divide-[#20241C] scrollbar-thin`}>
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-[#7C8273]">
              No console or exception events match the current filter.
            </div>
          ) : (
            filteredLogs.map(entry => {
              const isExpanded = expandedId === entry.id;
              const hasExtra = Boolean(entry.stack || entry.details);
              return (
                <div
                  key={entry.id}
                  className={`px-4 py-2.5 hover:bg-[#1D2119] transition-colors ${
                    entry.level === 'EXCEPTION' || entry.level === 'ERROR' ? 'bg-rose-950/20' : ''
                  }`}
                >
                  <div
                    onClick={() => hasExtra && setExpandedId(isExpanded ? null : entry.id)}
                    className={`flex items-start justify-between gap-3 ${hasExtra ? 'cursor-pointer' : ''}`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <span className="text-[10px] text-[#7C8273] tabular-nums whitespace-nowrap mt-0.5">
                        {new Date(entry.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border whitespace-nowrap ${getBadgeStyle(entry.level)}`}>
                        {entry.level}
                      </span>
                      <span className="text-[10px] text-[#CCF048] whitespace-nowrap mt-0.5">
                        [{entry.source}]
                      </span>
                      <span className="text-xs text-[#F2F3EE] break-all leading-relaxed">
                        {entry.message}
                      </span>
                    </div>

                    {hasExtra && (
                      <button
                        type="button"
                        className="text-[10px] text-[#CCF048] hover:underline whitespace-nowrap flex-shrink-0 cursor-pointer"
                      >
                        {isExpanded ? 'Hide Trace' : 'Inspect Trace'}
                      </button>
                    )}
                  </div>

                  {isExpanded && hasExtra && (
                    <div className="mt-2.5 pl-6 space-y-2">
                      {entry.stack && (
                        <div className="p-3 rounded-xl bg-black/55 border border-rose-500/30 text-rose-300 text-[11px] overflow-x-auto whitespace-pre">
                          {entry.stack}
                        </div>
                      )}
                      {entry.details && (
                        <div className="p-3 rounded-xl bg-black/50 border border-[#2B3026] text-emerald-300 text-[11px] overflow-x-auto whitespace-pre">
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

interface SystemLogMonitorModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const SystemLogMonitorModal: React.FC<SystemLogMonitorModalProps> = ({
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
}) => {
  const { currentUser } = useAppStore();
  const [internalOpen, setInternalOpen] = useState(false);

  const isOpen = Boolean(controlledIsOpen || internalOpen);
  const handleClose = () => {
    setInternalOpen(false);
    controlledOnClose?.();
  };

  useEffect(() => {
    const handleOpen = () => {
      if (logMonitorService.canUserAccessLogs(currentUser?.role)) {
        setInternalOpen(true);
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
      onClose={handleClose}
      title="Platform Exception & Console Log Monitor (Owner / PM)"
      size="4xl"
    >
      <SystemLogMonitorPanel />
    </Modal>
  );
};
