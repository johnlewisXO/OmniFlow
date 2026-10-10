import React, { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { OrganizationJoinRequest, UserRole, normalizeUserRole } from '../../types';
import supabaseService from '../../services/supabaseService';
import { Avatar } from '../shared/Avatar';
import { Button } from '../shared/Button';

const formatRoleForDisplay = (role?: string | UserRole) =>
  normalizeUserRole(role)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());

export const PendingJoinRequestsBanner: React.FC = () => {
  const {
    currentUser,
    currentOrganization,
    darkMode,
    addToast,
    fetchUsersForAssignmentList,
    setActiveView,
  } = useAppStore();

  const [joinRequests, setJoinRequests] = useState<OrganizationJoinRequest[]>([]);
  const [approvalRoles, setApprovalRoles] = useState<Record<string, UserRole>>({});
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  const actorRole = normalizeUserRole(currentUser?.role);
  const canManage =
    actorRole === UserRole.OWNER ||
    actorRole === UserRole.ADMIN ||
    actorRole === UserRole.PROJECT_MANAGER;

  const loadJoinRequests = useCallback(async () => {
    if (!currentUser?.organization_id || !canManage) return;
    try {
      const list = await supabaseService.getJoinRequestsForOrganization(
        currentUser.organization_id,
        currentOrganization?.name
      );
      setJoinRequests(list.filter(r => r.status === 'pending'));
    } catch {}
  }, [currentUser?.organization_id, currentOrganization?.name, canManage]);

  useEffect(() => {
    loadJoinRequests();
    const handler = () => loadJoinRequests();
    window.addEventListener('omni_org_join_request_updated', handler);

    let bc: BroadcastChannel | null = null;
    if ('BroadcastChannel' in window) {
      bc = new BroadcastChannel('omni_collab_sync');
      bc.onmessage = ev => {
        if (ev.data?.type === 'ORG_JOIN_REQUEST_UPSERT') {
          loadJoinRequests();
        }
      };
    }

    const interval = setInterval(loadJoinRequests, 8000);
    return () => {
      window.removeEventListener('omni_org_join_request_updated', handler);
      if (bc) bc.close();
      clearInterval(interval);
    };
  }, [loadJoinRequests]);

  if (!canManage || joinRequests.length === 0 || !currentUser) {
    return null;
  }

  const handleApprove = async (req: OrganizationJoinRequest) => {
    const grantRole = approvalRoles[req.id] || req.requested_role || UserRole.MEMBER;
    setProcessingRequestId(req.id);
    try {
      await supabaseService.approveJoinRequest({
        requestId: req.id,
        approvedRole: grantRole,
        reviewer: currentUser,
      });
      addToast(
        'Access Approved!',
        `${req.requester_name} (${req.requester_email}) has been added to ${
          req.organization_name || 'your organization'
        } as ${formatRoleForDisplay(grantRole)}.`,
        'success'
      );
      await loadJoinRequests();
      fetchUsersForAssignmentList();
    } catch (err: any) {
      addToast('Approval Error', err?.message || 'Failed to approve join request.', 'error');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleDecline = async (req: OrganizationJoinRequest) => {
    setProcessingRequestId(req.id);
    try {
      await supabaseService.declineJoinRequest({
        requestId: req.id,
        reviewer: currentUser,
      });
      addToast(
        'Request Declined',
        `Declined organization join request from ${req.requester_name}.`,
        'warning'
      );
      await loadJoinRequests();
    } catch (err: any) {
      addToast('Action Failed', err?.message || 'Failed to decline join request.', 'error');
    } finally {
      setProcessingRequestId(null);
    }
  };

  return (
    <div
      className={`p-4 sm:p-5 rounded-2xl border shadow-lg transition-all ${
        darkMode
          ? 'bg-indigo-950/45 border-indigo-500/45 text-slate-100'
          : 'bg-indigo-50/90 border-indigo-200 text-slate-800'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3.5">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
          <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-indigo-500 dark:text-indigo-400">
            Pending Organization Join Requests ({joinRequests.length})
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setActiveView('team_management')}
          className="text-xs font-semibold text-indigo-500 hover:text-indigo-400 underline cursor-pointer self-start sm:self-auto"
        >
          Open Team Directory & Access Control →
        </button>
      </div>

      <div className="space-y-2.5">
        {joinRequests.map(req => {
          const selectedGrantRole = approvalRoles[req.id] || req.requested_role || UserRole.MEMBER;
          const isProcessing = processingRequestId === req.id;

          return (
            <div
              key={req.id}
              className={`p-3.5 rounded-xl border flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 ${
                darkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <Avatar
                  user={{
                    id: req.requester_id,
                    full_name: req.requester_name,
                    email: req.requester_email,
                    avatar_url: req.requester_avatar,
                  }}
                  size="md"
                />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm">{req.requester_name}</span>
                    <span className="text-xs text-slate-400">({req.requester_email})</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                      Requested: {formatRoleForDisplay(req.requested_role)}
                    </span>
                  </div>
                  {req.message && <p className="text-xs text-slate-400 mt-1">{req.message}</p>}
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Requested {new Date(req.created_at).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Role:</label>
                  <select
                    value={selectedGrantRole}
                    onChange={e =>
                      setApprovalRoles(prev => ({
                        ...prev,
                        [req.id]: e.target.value as UserRole,
                      }))
                    }
                    disabled={isProcessing}
                    className={`text-xs font-bold rounded-xl border px-2.5 py-1.5 ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value={UserRole.MEMBER}>Member (MEMBER)</option>
                    <option value={UserRole.PROJECT_MANAGER}>
                      Project Manager (PROJECT_MANAGER)
                    </option>
                  </select>
                </div>

                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={isProcessing}
                  onClick={() => handleApprove(req)}
                  className="text-xs font-bold px-3.5 py-1.5"
                >
                  {isProcessing ? 'Approving...' : 'Approve & Grant Access'}
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isProcessing}
                  onClick={() => handleDecline(req)}
                  className="text-xs font-semibold px-3 py-1.5 text-rose-400 hover:text-rose-300"
                >
                  Decline
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
