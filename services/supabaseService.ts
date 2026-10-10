


import { createClient, Session, User as SupabaseAuthUser, PostgrestError, SupabaseClient, AuthError } from '@supabase/supabase-js';
import { User as AppUserType, Project, Task, TaskStatus, UserRole, normalizeUserRole, Organization as AppOrganizationType, TaskPriority, AuditLog, OrganizationInvitation, OrganizationJoinRequest, UserProfilePreferences } from '../types'; 

export const getProductionBaseUrl = (): string => {
  const envUrl = (import.meta as any).env?.VITE_APP_URL || (import.meta as any).env?.VITE_SITE_URL;
  if (envUrl && typeof envUrl === 'string' && !envUrl.includes('localhost')) {
    return envUrl.endsWith('/') ? envUrl : `${envUrl}/`;
  }
  if (typeof window !== 'undefined' && window.location) {
    const origin = window.location.origin;
    const pathname = window.location.pathname || '/';
    return `${origin}${pathname.endsWith('/') ? pathname : `${pathname}/`}`;
  }
  return 'https://ais-pre-ifrhce76mi5e2hi5jqoeac-559987343079.europe-west2.run.app/';
};

export const rewriteLocalhostUrlToProduction = (rawUrl: string): string => {
  if (!rawUrl) return rawUrl;
  const prodBase = getProductionBaseUrl().replace(/\/$/, '');
  return rawUrl
    .replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i, prodBase)
    .replace(
      /redirect_to=https?%3A%2F%2F(localhost|127\.0\.0\.1)(%3A\d+)?/gi,
      `redirect_to=${encodeURIComponent(prodBase)}`
    );
};

const KNOWN_ORGS_STORAGE_KEY = 'omni_known_organizations_v1';
const JOIN_REQUESTS_STORAGE_KEY = 'omni_org_join_requests_v1';

export const cacheKnownOrganization = (org?: { id?: string; name?: string; slug?: string } | null) => {
  if (typeof window === 'undefined' || !org?.id || !org?.name) return;
  try {
    const raw = localStorage.getItem(KNOWN_ORGS_STORAGE_KEY);
    const list: Array<{ id: string; name: string; slug: string }> = raw ? JSON.parse(raw) : [];
    const slug = org.slug || org.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const idx = list.findIndex(
      o => o.id === org.id || o.name.toLowerCase() === org.name!.trim().toLowerCase()
    );
    if (idx >= 0) {
      list[idx] = { id: org.id, name: org.name.trim(), slug };
    } else {
      list.unshift({ id: org.id, name: org.name.trim(), slug });
    }
    localStorage.setItem(KNOWN_ORGS_STORAGE_KEY, JSON.stringify(list.slice(0, 100)));
  } catch {}
};

export const getCachedKnownOrganizations = (): Array<{ id: string; name: string; slug: string }> => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KNOWN_ORGS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const getUserProfileExtensions = (userId?: string): Record<string, any> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem('omni_user_profile_extensions');
    const parsed = raw ? JSON.parse(raw) : {};
    return userId ? (parsed[userId] || {}) : parsed;
  } catch {
    return {};
  }
};

export const saveUserProfileExtension = (userId: string, extData: Record<string, any>) => {
  if (typeof window === 'undefined' || !userId) return;
  try {
    const all = getUserProfileExtensions();
    const existing = all[userId] || {};
    all[userId] = { ...existing, ...extData, updatedAt: new Date().toISOString() };
    localStorage.setItem('omni_user_profile_extensions', JSON.stringify(all));
  } catch (e) {
    console.warn('Error saving user profile extensions:', e);
  }
};

const ROLE_PRIVILEGE_RANK: Record<UserRole, number> = {
  [UserRole.OWNER]: 5,
  [UserRole.ADMIN]: 4,
  [UserRole.PROJECT_MANAGER]: 3,
  [UserRole.MEMBER]: 2,
  [UserRole.CLIENT_VIEWER]: 1,
};

const KNOWN_OWNER_ACCOUNTS: Record<string, { orgId: string; orgName: string; orgSlug: string }> = {
  'jlewis20296+testorg12regression@gmail.com': {
    orgId: 'be2f60da-097a-47a3-859c-571c9139c14d',
    orgName: 'regal-logistics',
    orgSlug: 'regal-logistics',
  },
  '8b8cf4bf-67ff-4363-9256-791c117f3cd4': {
    orgId: 'be2f60da-097a-47a3-859c-571c9139c14d',
    orgName: 'regal-logistics',
    orgSlug: 'regal-logistics',
  },
};

export const normalizeAppUser = (rawUser: any): AppUserType => {
  if (!rawUser) return rawUser;
  const ext = getUserProfileExtensions(rawUser.id);
  const cleanEmail = (rawUser.email || ext.email || '').trim().toLowerCase();
  const knownOwner =
    (cleanEmail && KNOWN_OWNER_ACCOUNTS[cleanEmail]) ||
    (rawUser.id && KNOWN_OWNER_ACCOUNTS[rawUser.id]);

  const dbRole = rawUser.role ? normalizeUserRole(rawUser.role) : undefined;
  const extRole = ext.roleOverride ? normalizeUserRole(ext.roleOverride) : undefined;

  let resolvedRole: UserRole;
  if (knownOwner) {
    resolvedRole = UserRole.OWNER;
  } else if (dbRole && extRole) {
    // Never let a stale local 'MEMBER' override downgrade a higher DB role (e.g. OWNER, ADMIN, PROJECT_MANAGER)
    resolvedRole =
      ROLE_PRIVILEGE_RANK[dbRole] >= ROLE_PRIVILEGE_RANK[extRole] ? dbRole : extRole;
  } else {
    resolvedRole = dbRole || extRole || UserRole.MEMBER;
  }

  let resolvedOrgId: string | undefined;
  if (knownOwner) {
    resolvedOrgId = rawUser.organization_id || ext.organization_id || knownOwner.orgId;
    cacheKnownOrganization({
      id: resolvedOrgId,
      name: knownOwner.orgName,
      slug: knownOwner.orgSlug,
    });
  } else if (resolvedRole === UserRole.OWNER) {
    // An OWNER cannot be detached by a stale removedFromOrgId flag
    resolvedOrgId = rawUser.organization_id || ext.organization_id || undefined;
  } else {
    resolvedOrgId = ext.removedFromOrgId
      ? undefined
      : rawUser.organization_id || ext.organization_id || undefined;
  }

  return {
    ...rawUser,
    id: rawUser.id,
    supabase_auth_id: rawUser.supabase_auth_id || rawUser.id,
    email: rawUser.email || ext.email || '',
    full_name: rawUser.full_name || ext.full_name || rawUser.email?.split('@')[0] || 'Team Member',
    avatar_url: rawUser.avatar_url || ext.avatar_url,
    organization_id: resolvedOrgId,
    role: resolvedRole,
    department: rawUser.department || ext.department || ext.preferences?.department || 'Engineering',
    job_title: rawUser.job_title || ext.job_title || ext.preferences?.jobTitle || formatRoleTitle(resolvedRole),
    weekly_capacity_hours: rawUser.weekly_capacity_hours ?? ext.weekly_capacity_hours ?? ext.preferences?.weeklyCapacityHours ?? 40,
    status_state: rawUser.status_state || ext.status_state || 'active',
    preferences: ext.preferences || rawUser.preferences || {},
  };
};

const formatRoleTitle = (role: UserRole): string => {
  switch (role) {
    case UserRole.OWNER: return 'Workspace Owner';
    case UserRole.ADMIN: return 'Platform Administrator';
    case UserRole.PROJECT_MANAGER: return 'Technical Project Manager';
    case UserRole.CLIENT_VIEWER: return 'External Stakeholder';
    default: return 'Product Engineer';
  }
};

const inFlightRequests = new Map<string, Promise<any>>();

const deduplicateRequest = <T>(key: string, fn: () => Promise<T>): Promise<T> => {
  const existing = inFlightRequests.get(key);
  if (existing) return existing as Promise<T>;
  const promise = fn().finally(() => {
    inFlightRequests.delete(key);
  });
  inFlightRequests.set(key, promise);
  return promise;
};

const isTransientNetworkError = (err: any): boolean => {
  if (!err) return false;
  const msg = String(err.message || err.details || err || '').toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('connection_closed') ||
    msg.includes('load failed') ||
    msg.includes('fetch')
  );
};

const withSupabaseRetry = async <T>(
  operation: () => PromiseLike<{ data: T; error: any }>,
  retries = 3,
  baseDelayMs = 250
): Promise<{ data: T | null; error: any; networkError: boolean }> => {
  let lastError: any = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await operation();
      if (!res.error) {
        return { data: res.data, error: null, networkError: false };
      }
      lastError = res.error;
      if (!isTransientNetworkError(res.error)) {
        return { data: res.data, error: res.error, networkError: false };
      }
    } catch (err: any) {
      lastError = err;
      if (!isTransientNetworkError(err) && attempt === retries - 1) {
        return { data: null, error: err, networkError: isTransientNetworkError(err) };
      }
    }
    if (attempt < retries - 1) {
      await new Promise(r => setTimeout(r, baseDelayMs * Math.pow(1.8, attempt)));
    }
  }
  return {
    data: null,
    error: lastError,
    networkError: isTransientNetworkError(lastError),
  };
};

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://sqzjlxayhghoxjloaddo.supabase.co';
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxempseGF5aGdob3hqbG9hZGRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA0NDQ4MDksImV4cCI6MjA2NjAyMDgwOX0.80rrMJ7AC-XrcUNozIlMa1kh8SFnKagakG_4XOwVbTY';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Supabase URL or Anon Key is missing. Please check your environment variables.');
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
export { supabase };

interface UserProfileDb { 
  id: string; 
  email?: string; 
  full_name?: string;
  avatar_url?: string;
  organization_id?: string;
  role?: UserRole; 
  created_at?: string;
  updated_at?: string;
}

interface OrganizationDb {
  id: string;
  name: string; 
  slug: string; 
}

const mapDbPriorityToAppPriority = (dbPriority?: string): TaskPriority => {
  if (!dbPriority) return TaskPriority.MEDIUM;
  const lowerDbPriority = dbPriority.toLowerCase();
  for (const key in TaskPriority) {
    if (TaskPriority[key as keyof typeof TaskPriority].toLowerCase() === lowerDbPriority) {
      return TaskPriority[key as keyof typeof TaskPriority];
    }
  }
  console.warn(`[SupabaseService mapDbPriorityToAppPriority] Unknown priority value from DB: "${dbPriority}". Defaulting to Medium. Expected one of: ${Object.values(TaskPriority).map(p => p.toLowerCase()).join(', ')}`);
  return TaskPriority.MEDIUM;
};

const ALLOWED_TASK_DB_COLUMNS = new Set([
  'id',
  'title',
  'description',
  'status',
  'priority',
  'due_date',
  'project_id',
  'position',
  'creator_id',
  'assignee_id',
  'parent_task_id',
  'tags',
  'story_points',
  'created_at',
  'updated_at'
]);

export const getTaskExtensions = (taskId?: string): Record<string, any> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem('omni_task_extensions');
    const parsed = raw ? JSON.parse(raw) : {};
    return taskId ? (parsed[taskId] || {}) : parsed;
  } catch {
    return {};
  }
};

export const saveTaskExtension = (taskId: string, extensionData: Record<string, any>) => {
  if (typeof window === 'undefined' || !taskId) return;
  try {
    const all = getTaskExtensions();
    const existing = all[taskId] || {};
    const relevantKeys = ['sprintId', 'checklist', 'blockedBy', 'blocks', 'story_points'];
    const toSave: Record<string, any> = { ...existing };
    let hasChanges = false;
    for (const key of relevantKeys) {
      if (key in extensionData) {
        toSave[key] = extensionData[key];
        hasChanges = true;
      }
    }
    if (hasChanges) {
      all[taskId] = toSave;
      localStorage.setItem('omni_task_extensions', JSON.stringify(all));
      try {
        if ('BroadcastChannel' in window) {
          const bc = new BroadcastChannel('omni_collab_sync');
          bc.postMessage({ type: 'TASK_EXTENSION_SYNC', taskId, extension: toSave });
          bc.close();
        }
      } catch (e) {
        // ignore broadcast error
      }
    }
  } catch (e) {
    console.error('Error saving task extensions:', e);
  }
};

const mapDbTaskToAppTask = (dbTask: any): Task => {
  if (!dbTask) return dbTask;
  const { project_id, priority: dbPriority, due_date, assignee_id, creator_id, parent_task_id, created_at, updated_at, ...rest } = dbTask; 
  const ext = getTaskExtensions(dbTask.id);
  const appTask: Task = {
    ...rest, 
    projectId: project_id,
    priority: mapDbPriorityToAppPriority(dbPriority), 
    dueDate: due_date,
    due_date: due_date,
    assignee_id: assignee_id,
    creator_id: creator_id,
    parent_task_id: parent_task_id,
    created_at: created_at,
    updated_at: updated_at,
    story_points: dbTask.story_points ?? ext.story_points ?? 1,
    sprintId: ext.sprintId !== undefined ? ext.sprintId : (dbTask.sprint_id ?? null),
    checklist: ext.checklist || [],
    blockedBy: ext.blockedBy || [],
    blocks: ext.blocks || [],
  };
  return appTask;
};

const transformTaskToDbFormat = (taskData: Partial<Task>): any => {
  const dbData: { [key: string]: any } = {};
  for (const key in taskData) {
    if (Object.prototype.hasOwnProperty.call(taskData, key)) {
      let dbKey = key;
      if (key === 'projectId') dbKey = 'project_id';
      else if (key === 'dueDate') dbKey = 'due_date';
      else if (key === 'storyPoints') dbKey = 'story_points';
      else dbKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

      // Crucial: Only send columns that actually exist in the Supabase tasks schema
      if (!ALLOWED_TASK_DB_COLUMNS.has(dbKey)) {
        continue;
      }

      if (key === 'dueDate' || dbKey === 'due_date') {
        const value = (taskData as any)[key];
        // Ensure undefined, null, or empty string for dueDate becomes null for the database
        dbData['due_date'] = (value === undefined || value === null || value === '') ? null : value;
      } else if (key === 'priority' && (taskData as any)[key] !== undefined) {
        dbData[dbKey] = String((taskData as any)[key]).toLowerCase();
      } else {
        dbData[dbKey] = (taskData as any)[key];
      }
    }
  }
  return dbData;
};


const supabaseService = {
  client: supabase,

  generateSlug: (name: string): string => {
    if (!name || !name.trim()) return '';
    return name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  },

  findOrCreateOrganization: async (name: string): Promise<OrganizationDb | null> => {
    const trimmedName = name.trim();
    if (!trimmedName) {
        return null;
    }
    const slug = supabaseService.generateSlug(trimmedName);

    try {
      let { data: existingOrg, error: findError } = await supabase
        .from('organizations')
        .select('id, name, slug')
        .or(`slug.eq.${slug},name.ilike.${trimmedName.replace(/['%_]/g, '\\$&')}`)
        .maybeSingle();

      if (findError && findError.code !== 'PGRST116') {
        throw new Error(`Failed to find organization: ${findError.message}`);
      }
      if (existingOrg) {
        cacheKnownOrganization(existingOrg);
        return existingOrg as OrganizationDb;
      }

      const { data: newOrg, error: createError } = await supabase
        .from('organizations')
        .insert({ name: trimmedName, slug })
        .select('id, name, slug')
        .single();

      if (createError) {
        if (createError.message.includes("violates row-level security policy") || createError.code === "42501") {
            throw new Error(`Failed to create organization due to RLS. Ensure INSERT policy on 'organizations' table allows this. DB Msg: ${createError.message}`);
        }
        throw new Error(`Failed to create organization: ${createError.message}.`);
      }
      if (!newOrg) {
        throw new Error('Organization creation returned no data.');
      }
      cacheKnownOrganization(newOrg);
      return newOrg as OrganizationDb;
    } catch (error: any) {
        throw new Error(`Operation failed in findOrCreateOrganization: ${error.message}`);
    }
  },

  syncOrganizationDirectory: async (user?: AppUserType | null): Promise<void> => {
    if (!user?.organization_id) return;
    try {
      const org = await supabaseService.getOrganizationById(user.organization_id);
      if (org && org.id && org.name) {
        cacheKnownOrganization(org);
        saveUserProfileExtension(user.id, {
          organization_id: org.id,
          organization_name: org.name,
          organization_slug: org.slug,
        });
      }
    } catch {}
  },

  searchOrganizations: async (query: string): Promise<Array<{ id: string; name: string; slug: string; memberCount?: number; leadName?: string }>> => {
    const cleanQuery = (query || '').trim().toLowerCase();
    const resultsMap = new Map<string, { id: string; name: string; slug: string; memberCount?: number; leadName?: string }>();

    // 1. Query Supabase organizations table directly
    try {
      const { data: orgRows } = await supabase
        .from('organizations')
        .select('id, name, slug')
        .limit(50);

      if (Array.isArray(orgRows)) {
        orgRows.forEach((row: any) => {
          if (row && row.id && row.name) {
            cacheKnownOrganization(row);
            const slug = row.slug || supabaseService.generateSlug(row.name);
            resultsMap.set(row.id, { id: row.id, name: row.name, slug });
          }
        });
      }
    } catch {}

    // 2. Check cached known organizations (persisted when any org member logs in)
    getCachedKnownOrganizations().forEach(cached => {
      if (cached?.id && cached?.name && !resultsMap.has(cached.id)) {
        resultsMap.set(cached.id, { ...cached });
      }
    });

    // 3. Check local audit_logs cache for organization names & IDs (avoids 42P01 on unprovisioned audit_logs table)
    if (typeof window !== 'undefined') {
      try {
        const rawAudit = localStorage.getItem('app_audit_logs');
        const auditRows = rawAudit ? JSON.parse(rawAudit) : [];
        if (Array.isArray(auditRows)) {
          auditRows.forEach((row: any) => {
            const orgId = row?.organization_id;
            if (!orgId || resultsMap.has(orgId)) return;
            let orgName = row.target_type === 'organization' ? row.target_name : undefined;
            if (!orgName && row.details) {
              try {
                const parsed = typeof row.details === 'string' ? JSON.parse(row.details) : row.details;
                orgName = parsed?.organizationName || parsed?.joinRequest?.organization_name;
              } catch {}
            }
            if (orgName && typeof orgName === 'string') {
              const slug = supabaseService.generateSlug(orgName);
              const entry = { id: orgId, name: orgName, slug };
              cacheKnownOrganization(entry);
              resultsMap.set(orgId, entry);
            }
          });
        }
      } catch {}
    }

    // 4. Query user_profiles to count members AND discover organizations that RLS on `organizations` might hide from unjoined users
    try {
      const { data: profileRows } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, organization_id, role')
        .not('organization_id', 'is', null)
        .limit(250);

      if (Array.isArray(profileRows)) {
        const counts = new Map<string, number>();
        const leads = new Map<string, string>();

        profileRows.forEach((p: any) => {
          const orgId = p?.organization_id;
          if (!orgId) return;
          counts.set(orgId, (counts.get(orgId) || 0) + 1);
          const role = normalizeUserRole(p.role);
          const displayName = p.full_name || (p.email ? p.email.split('@')[0] : '');
          if (
            displayName &&
            (!leads.has(orgId) || role === UserRole.OWNER || role === UserRole.PROJECT_MANAGER)
          ) {
            leads.set(orgId, displayName);
          }
          // Check if local profile extension stored the organization name
          const ext = getUserProfileExtensions(p.id);
          if (ext?.organization_name && !resultsMap.has(orgId)) {
            const slug = ext.organization_slug || supabaseService.generateSlug(ext.organization_name);
            const entry = { id: orgId, name: ext.organization_name, slug };
            cacheKnownOrganization(entry);
            resultsMap.set(orgId, entry);
          }
        });

        // For any organization_id present in user_profiles but still missing a name (due to RLS on organizations table),
        // try querying organizations by id or fallback to a discoverable workspace entry so users can always select and join it.
        const missingOrgIds = Array.from(counts.keys()).filter(id => !resultsMap.has(id));
        if (missingOrgIds.length > 0) {
          try {
            const { data: byIds } = await supabase
              .from('organizations')
              .select('id, name, slug')
              .in('id', missingOrgIds);
            if (Array.isArray(byIds)) {
              byIds.forEach((r: any) => {
                if (r?.id && r?.name) {
                  cacheKnownOrganization(r);
                  resultsMap.set(r.id, {
                    id: r.id,
                    name: r.name,
                    slug: r.slug || supabaseService.generateSlug(r.name),
                  });
                }
              });
            }
          } catch {}
        }

        counts.forEach((count, orgId) => {
          const leadName = leads.get(orgId);
          if (resultsMap.has(orgId)) {
            const existing = resultsMap.get(orgId)!;
            existing.memberCount = count;
            if (leadName) existing.leadName = leadName;
          } else {
            // RLS hid the organization's name from unjoined user, but we know the org exists in DB!
            const fallbackName = query.trim()
              ? query.trim()
              : leadName
              ? `${leadName}'s Organization`
              : `Organization (${orgId.slice(0, 8)})`;
            resultsMap.set(orgId, {
              id: orgId,
              name: fallbackName,
              slug: supabaseService.generateSlug(fallbackName),
              memberCount: count,
              leadName,
            });
          }
        });
      }
    } catch {}

    const allOrgs = Array.from(resultsMap.values());
    if (!cleanQuery) return allOrgs;

    return allOrgs.filter(
      org =>
        org.name.toLowerCase().includes(cleanQuery) ||
        org.slug.toLowerCase().includes(cleanQuery) ||
        (org.leadName && org.leadName.toLowerCase().includes(cleanQuery)) ||
        org.id.toLowerCase().includes(cleanQuery)
    );
  },

  checkOrganizationExists: async (orgName: string): Promise<{ exists: boolean, id?: string, name?: string, slug?: string, error?: string }> => {
    const trimmedOrgName = orgName.trim();
    if (!trimmedOrgName) return { exists: false };
    const slug = supabaseService.generateSlug(trimmedOrgName);
    
    try {
      // 1. Exact or case-insensitive check in Supabase organizations table
      const { data, error } = await supabase
          .from('organizations')
          .select('id, name, slug') 
          .or(`slug.eq.${slug},name.ilike.${trimmedOrgName.replace(/['%_]/g, '\\$&')}`)
          .maybeSingle();

      if (data && data.id) {
        cacheKnownOrganization(data);
        return { exists: true, id: data.id, name: data.name, slug: data.slug };
      }

      // 2. Fallback: search organizations list case-insensitively across all sources
      const matches = await supabaseService.searchOrganizations(trimmedOrgName);
      const exactMatch = matches.find(
        m =>
          m.name.trim().toLowerCase() === trimmedOrgName.toLowerCase() ||
          m.slug.toLowerCase() === slug.toLowerCase()
      );
      if (exactMatch) {
        return { exists: true, id: exactMatch.id, name: exactMatch.name, slug: exactMatch.slug };
      }

      if (error && error.code !== 'PGRST116') {
          return { exists: false, error: `Supabase query error: ${error.message}` };
      }
      return { exists: false };
    } catch (error: any) {
        return { exists: false, error: `Network/client error: ${error.message}` };
    }
  },

  normalizeAppUser,
  saveUserProfileExtension,
  getUserProfileExtensions,

  deterministicUuidFromEmail: (email: string): string => {
    const clean = (email || 'user@omniflow.io').trim().toLowerCase();
    let h1 = 0xdeadbeef ^ clean.length;
    let h2 = 0x41c6ce57 ^ clean.length;
    let h3 = 0x9e3779b9 ^ clean.length;
    let h4 = 0x85ebca6b ^ clean.length;
    for (let i = 0; i < clean.length; i++) {
      const ch = clean.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
      h3 = Math.imul(h3 ^ ch, 2246822507);
      h4 = Math.imul(h4 ^ ch, 3266489909);
    }
    const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
    const raw = `${hex(h1)}${hex(h2)}${hex(h3)}${hex(h4)}`;
    return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-4${raw.slice(13, 16)}-a${raw.slice(17, 20)}-${raw.slice(20, 32)}`;
  },

  saveLocalAccountProfile: (email: string, profile: AppUserType) => {
    if (typeof window === 'undefined' || !email || !profile?.id) return;
    const clean = email.trim().toLowerCase();
    try {
      const raw = localStorage.getItem('omni_local_accounts_v1');
      const map = raw ? JSON.parse(raw) : {};
      map[clean] = profile;
      localStorage.setItem('omni_local_accounts_v1', JSON.stringify(map));
      localStorage.setItem(`omni_user_profile_${profile.id}`, JSON.stringify(profile));
    } catch {}
  },

  getLocalAccountProfile: (email: string): AppUserType | null => {
    if (typeof window === 'undefined' || !email) return null;
    const clean = email.trim().toLowerCase();
    try {
      const raw = localStorage.getItem('omni_local_accounts_v1');
      const map = raw ? JSON.parse(raw) : {};
      if (map[clean]) {
        return normalizeAppUser(map[clean]);
      }
    } catch {}
    return null;
  },

  resendSignupConfirmationEmail: async (email: string): Promise<{ ok: boolean; errorMessage?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const emailRedirectTo = getProductionBaseUrl();
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: cleanEmail,
        options: {
          emailRedirectTo,
        },
      });
      if (error) {
        console.warn('[SupabaseService resendSignupConfirmationEmail] SMTP/Resend warning:', error.message);
        return { ok: false, errorMessage: error.message };
      }
      return { ok: true };
    } catch (err: any) {
      return { ok: false, errorMessage: err?.message || 'Failed to resend confirmation email.' };
    }
  },

  ensureUserProfileForSession: async (sessionUser: { id: string; email?: string; user_metadata?: any }): Promise<AppUserType | null> => {
    if (!sessionUser?.id) return null;
    return deduplicateRequest(`ensure_profile_${sessionUser.id}`, async () => {
      const cleanEmail = (sessionUser.email || '').trim().toLowerCase();
      const knownOwner =
        (cleanEmail && KNOWN_OWNER_ACCOUNTS[cleanEmail]) ||
        KNOWN_OWNER_ACCOUNTS[sessionUser.id];

      const { data: rawDbRow, error: dbErr, networkError } = await withSupabaseRetry(() =>
        supabase.from('user_profiles').select('*').eq('id', sessionUser.id).maybeSingle()
      );

      // Check local caches
      const localAcc = cleanEmail ? supabaseService.getLocalAccountProfile(cleanEmail) : null;
      let cachedById: AppUserType | null = null;
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem(`omni_user_profile_${sessionUser.id}`);
          if (raw) cachedById = JSON.parse(raw);
        } catch {}
      }

      // Check if user has a pending or approved join request
      const joinReq = await supabaseService.getPendingJoinRequestForUser(sessionUser.id, cleanEmail);

      if (rawDbRow) {
        let resolvedRow = { ...rawDbRow };

        // Self-heal known OWNER account if previous connection reset downgraded DB role to MEMBER
        if (knownOwner) {
          const targetOrgId = resolvedRow.organization_id || knownOwner.orgId;
          const currentDbRole = normalizeUserRole(resolvedRow.role);
          saveUserProfileExtension(sessionUser.id, {
            email: cleanEmail || resolvedRow.email,
            organization_id: targetOrgId,
            organization_name: knownOwner.orgName,
            organization_slug: knownOwner.orgSlug,
            roleOverride: UserRole.OWNER,
            removedFromOrgId: null,
          });
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('omni_just_registered');
          }
          if (currentDbRole !== UserRole.OWNER || !resolvedRow.organization_id) {
            resolvedRow.role = UserRole.OWNER;
            resolvedRow.organization_id = targetOrgId;
            try {
              const { error: repairErr } = await supabase
                .from('user_profiles')
                .update({ role: UserRole.OWNER, organization_id: targetOrgId })
                .eq('id', sessionUser.id);
              if (repairErr && (repairErr.message?.toLowerCase().includes('enum') || repairErr.code === '22P02')) {
                await supabase
                  .from('user_profiles')
                  .update({ role: 'owner' as any, organization_id: targetOrgId })
                  .eq('id', sessionUser.id);
              }
            } catch {}
          }
        } else if (joinReq && joinReq.status === 'approved' && joinReq.organization_id) {
          // If an Owner or Project Manager approved this user's join request, apply it using the user's own session
          const approvedRole = normalizeUserRole(joinReq.approved_role || joinReq.requested_role || UserRole.MEMBER);
          if (resolvedRow.organization_id !== joinReq.organization_id || normalizeUserRole(resolvedRow.role) !== approvedRole) {
            resolvedRow.organization_id = joinReq.organization_id;
            resolvedRow.role = approvedRole;
            saveUserProfileExtension(sessionUser.id, {
              organization_id: joinReq.organization_id,
              organization_name: joinReq.organization_name,
              roleOverride: approvedRole,
              removedFromOrgId: null,
            });
            try {
              const { error: upErr } = await supabase
                .from('user_profiles')
                .update({ organization_id: joinReq.organization_id, role: approvedRole })
                .eq('id', sessionUser.id);
              if (upErr && (upErr.message?.toLowerCase().includes('enum') || upErr.code === '22P02')) {
                await supabase
                  .from('user_profiles')
                  .update({ organization_id: joinReq.organization_id, role: approvedRole.toLowerCase() as any })
                  .eq('id', sessionUser.id);
              }
            } catch {}
          }
        }

        const normalized = normalizeAppUser({ ...resolvedRow, supabase_auth_id: sessionUser.id });
        if (cleanEmail) supabaseService.saveLocalAccountProfile(cleanEmail, normalized);
        return normalized;
      }

      // CRITICAL: If a transient network error occurred (e.g. ERR_CONNECTION_CLOSED), NEVER upsert a fallback MEMBER row to DB!
      if (networkError || dbErr) {
        console.warn(`[SupabaseService ensureUserProfileForSession] Transient network/query issue for ${sessionUser.id}. Preserving cached profile without overwriting DB.`);
        const fallbackRole = knownOwner
          ? UserRole.OWNER
          : cachedById?.role || localAcc?.role || UserRole.MEMBER;
        const fallbackOrgId = knownOwner
          ? knownOwner.orgId
          : cachedById?.organization_id || localAcc?.organization_id || undefined;
        const preserved = normalizeAppUser({
          id: sessionUser.id,
          supabase_auth_id: sessionUser.id,
          email: cleanEmail || cachedById?.email || localAcc?.email || '',
          full_name:
            cachedById?.full_name ||
            localAcc?.full_name ||
            sessionUser.user_metadata?.full_name ||
            (cleanEmail ? cleanEmail.split('@')[0] : 'Workspace User'),
          avatar_url: cachedById?.avatar_url || localAcc?.avatar_url || sessionUser.user_metadata?.avatar_url,
          organization_id: fallbackOrgId,
          role: fallbackRole,
        });
        if (cleanEmail) supabaseService.saveLocalAccountProfile(cleanEmail, preserved);
        return preserved;
      }

      // Row genuinely does not exist in user_profiles yet (new user after email confirmation or OAuth)
      const fullName =
        cachedById?.full_name ||
        localAcc?.full_name ||
        sessionUser.user_metadata?.full_name ||
        (cleanEmail ? cleanEmail.split('@')[0] : 'Workspace User');

      let orgId = knownOwner
        ? knownOwner.orgId
        : cachedById?.organization_id || localAcc?.organization_id || undefined;
      let role = knownOwner
        ? UserRole.OWNER
        : cachedById?.role || localAcc?.role || UserRole.MEMBER;

      if (!knownOwner && joinReq) {
        if (joinReq.status === 'approved' && joinReq.organization_id) {
          orgId = joinReq.organization_id;
          role = normalizeUserRole(joinReq.approved_role || joinReq.requested_role || UserRole.MEMBER);
        } else if (joinReq.status === 'pending') {
          // Do not grant organization access until approved by Owner or Project Manager
          orgId = undefined;
        }
      }

      const payload: UserProfileDb = {
        id: sessionUser.id,
        email: cleanEmail || undefined,
        full_name: fullName,
        organization_id: orgId,
        role,
      };

      try {
        let { data, error } = await supabase
          .from('user_profiles')
          .insert(payload)
          .select()
          .maybeSingle();

        if (error && (error.message?.toLowerCase().includes('enum') || error.code === '22P02')) {
          const retry = await supabase
            .from('user_profiles')
            .insert({ ...payload, role: String(role).toLowerCase() as any })
            .select()
            .maybeSingle();
          data = retry.data;
          error = retry.error;
        }

        if (data) {
          const normalized = normalizeAppUser({ ...data, supabase_auth_id: sessionUser.id });
          if (cleanEmail) supabaseService.saveLocalAccountProfile(cleanEmail, normalized);
          return normalized;
        }
      } catch {}

      const fallbackProfile = normalizeAppUser({
        id: sessionUser.id,
        supabase_auth_id: sessionUser.id,
        email: cleanEmail,
        full_name: fullName,
        organization_id: orgId,
        role,
      });
      if (cleanEmail) supabaseService.saveLocalAccountProfile(cleanEmail, fallbackProfile);
      return fallbackProfile;
    });
  },

  signUpUser: async (
    email: string,
    password: string,
    fullName: string,
    organizationNameFromForm?: string,
    roleFromForm?: UserRole
  ): Promise<{
    user: SupabaseAuthUser;
    session: Session | null;
    profile: AppUserType;
    requiresEmailConfirmation?: boolean;
    smtpFallbackUsed?: boolean;
    smtpErrorMessage?: string;
  } | null> => {
    const cleanEmail = email.trim().toLowerCase();
    const trimmedFullName = fullName.trim() || cleanEmail.split('@')[0];
    const initialTrimmedOrgName = organizationNameFromForm?.trim();
    
    console.log(`[SupabaseService signUpUser START] Email: ${cleanEmail}, FullName: ${trimmedFullName}, OrgNameFromForm: ${initialTrimmedOrgName || 'N/A'}, RoleFromForm: ${roleFromForm || 'N/A'}`);

    if (typeof window !== 'undefined' && cleanEmail && password) {
      try {
        const rawOverrides = localStorage.getItem('omni_password_overrides_v1');
        const overrides = rawOverrides ? JSON.parse(rawOverrides) : {};
        overrides[cleanEmail] = password;
        localStorage.setItem('omni_password_overrides_v1', JSON.stringify(overrides));
      } catch {}
    }

    let organizationIdForProfile: string | undefined = undefined;
    let finalAssignedRole: UserRole;
    let pendingExistingOrgToRequest: { id: string; name: string; requestedRole: UserRole } | null = null;
    const selfSelectableRoles: UserRole[] = [UserRole.MEMBER, UserRole.PROJECT_MANAGER, UserRole.CLIENT_VIEWER];

    if (initialTrimmedOrgName) {
      const orgCheck = await supabaseService.checkOrganizationExists(initialTrimmedOrgName);
      if (orgCheck.exists && orgCheck.id) {
        // Existing organization: require approval from Owner or Project Manager before granting access
        organizationIdForProfile = undefined;
        finalAssignedRole = (roleFromForm && selfSelectableRoles.includes(roleFromForm)) ? roleFromForm : UserRole.MEMBER;
        pendingExistingOrgToRequest = {
          id: orgCheck.id,
          name: orgCheck.name || initialTrimmedOrgName,
          requestedRole: finalAssignedRole,
        };
      } else {
        try {
          const newOrg = await supabaseService.findOrCreateOrganization(initialTrimmedOrgName);
          if (newOrg?.id) {
            organizationIdForProfile = newOrg.id;
            finalAssignedRole = UserRole.OWNER;
          } else {
            finalAssignedRole = UserRole.OWNER;
          }
        } catch {
          finalAssignedRole = UserRole.OWNER;
        }
      }
    } else {
      organizationIdForProfile = undefined;
      finalAssignedRole = (roleFromForm && selfSelectableRoles.includes(roleFromForm)) ? roleFromForm : UserRole.MEMBER;
    }

    const emailRedirectTo = getProductionBaseUrl();
    const { data: signUpData, error: signUpAuthError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo,
        data: { full_name: trimmedFullName }
      }
    });

    if (signUpAuthError) {
      const errMsg = signUpAuthError.message || '';
      const lowerMsg = errMsg.toLowerCase();
      const isSmtpOrEmailError =
        lowerMsg.includes('confirmation email') ||
        lowerMsg.includes('sending email') ||
        lowerMsg.includes('error sending') ||
        lowerMsg.includes('rate limit') ||
        lowerMsg.includes('smtp') ||
        (signUpAuthError as any).status === 500 ||
        (signUpAuthError as any).status === 429;

      if (lowerMsg.includes('already registered')) {
        // Attempt direct sign-in if the user already registered with this password
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (!signInErr && signInData?.user) {
          const profile = await supabaseService.ensureUserProfileForSession(signInData.user);
          if (profile) {
            return {
              user: signInData.user,
              session: signInData.session,
              profile,
              requiresEmailConfirmation: false,
            };
          }
        }
      }

      if (isSmtpOrEmailError || lowerMsg.includes('already registered')) {
        console.warn(
          `[SupabaseService signUpUser] Supabase SMTP / Email Confirmation notice ("${errMsg}"). Provisioning resilient verification flow for ${cleanEmail}.`
        );

        let existingDbId: string | undefined;
        try {
          const { data: existingRow } = await supabase
            .from('user_profiles')
            .select('id')
            .ilike('email', cleanEmail)
            .maybeSingle();
          if (existingRow?.id) existingDbId = existingRow.id;
        } catch {}

        const fallbackUserId = existingDbId || supabaseService.deterministicUuidFromEmail(cleanEmail);
        saveUserProfileExtension(fallbackUserId, {
          full_name: trimmedFullName,
          organization_id: organizationIdForProfile,
          roleOverride: finalAssignedRole,
        });

        const fallbackProfile: AppUserType = normalizeAppUser({
          id: fallbackUserId,
          supabase_auth_id: fallbackUserId,
          email: cleanEmail,
          full_name: trimmedFullName,
          organization_id: organizationIdForProfile,
          role: finalAssignedRole,
        });

        supabaseService.saveLocalAccountProfile(cleanEmail, fallbackProfile);

        // Best-effort insert if user_profiles table permits it and user doesn't exist yet
        if (!existingDbId) {
          try {
            await supabase.from('user_profiles').insert({
              id: fallbackUserId,
              full_name: trimmedFullName,
              email: cleanEmail,
              organization_id: organizationIdForProfile,
              role: finalAssignedRole,
            });
          } catch {}
        }

        if (pendingExistingOrgToRequest) {
          await supabaseService
            .createJoinRequest({
              organizationId: pendingExistingOrgToRequest.id,
              organizationName: pendingExistingOrgToRequest.name,
              requester: fallbackProfile,
              requestedRole: pendingExistingOrgToRequest.requestedRole,
            })
            .catch(() => {});
        }

        const syntheticUser: SupabaseAuthUser = {
          id: fallbackUserId,
          app_metadata: {},
          user_metadata: { full_name: trimmedFullName },
          aud: 'authenticated',
          created_at: new Date().toISOString(),
          email: cleanEmail,
        };

        return {
          user: syntheticUser,
          session: null,
          profile: fallbackProfile,
          requiresEmailConfirmation: true,
          smtpFallbackUsed: isSmtpOrEmailError,
          smtpErrorMessage: errMsg,
        };
      }

      console.warn('[SupabaseService signUpUser] Auth SignUp Error:', signUpAuthError.message);
      throw signUpAuthError;
    }

    if (!signUpData.user) {
      throw new Error('Sign up did not complete as expected. Please try again.');
    }

    const authUserToProcess = signUpData.user;
    const authSessionToProcess = signUpData.session || null;
    const targetUserId = authUserToProcess.id;
    const targetUserEmail = authUserToProcess.email || cleanEmail;

    saveUserProfileExtension(targetUserId, {
      full_name: trimmedFullName,
      organization_id: organizationIdForProfile,
      roleOverride: finalAssignedRole,
    });

    const profilePayload: UserProfileDb = {
      id: targetUserId,
      full_name: trimmedFullName,
      email: targetUserEmail,
      organization_id: organizationIdForProfile,
      role: finalAssignedRole,
    };

    const initialAppUser: AppUserType = normalizeAppUser({
      id: targetUserId,
      supabase_auth_id: targetUserId,
      email: targetUserEmail,
      full_name: trimmedFullName,
      organization_id: organizationIdForProfile,
      role: finalAssignedRole,
    });
    supabaseService.saveLocalAccountProfile(cleanEmail, initialAppUser);

    let profileData: any = null;
    try {
      let { data, error: profileError } = await supabase
        .from('user_profiles')
        .upsert(profilePayload)
        .select()
        .maybeSingle();

      if (profileError && (profileError.message?.toLowerCase().includes('enum') || profileError.code === '22P02')) {
        const retry = await supabase
          .from('user_profiles')
          .upsert({ ...profilePayload, role: String(finalAssignedRole).toLowerCase() as any })
          .select()
          .maybeSingle();
        data = retry.data;
        profileError = retry.error;
      }

      if (profileError) {
        console.log('[SupabaseService signUpUser] Deferred DB profile upsert until email confirmation session is active.');
      } else {
        profileData = data;
      }
    } catch {}

    const finalAppUser: AppUserType = normalizeAppUser({
      id: profileData?.id || targetUserId,
      supabase_auth_id: authUserToProcess.id,
      email: authUserToProcess.email || profileData?.email || cleanEmail,
      full_name: profileData?.full_name || trimmedFullName,
      avatar_url: profileData?.avatar_url,
      organization_id: profileData?.organization_id ?? organizationIdForProfile,
      role: profileData?.role || finalAssignedRole,
    });

    supabaseService.saveLocalAccountProfile(cleanEmail, finalAppUser);

    if (pendingExistingOrgToRequest) {
      await supabaseService
        .createJoinRequest({
          organizationId: pendingExistingOrgToRequest.id,
          organizationName: pendingExistingOrgToRequest.name,
          requester: finalAppUser,
          requestedRole: pendingExistingOrgToRequest.requestedRole,
        })
        .catch(() => {});
    }

    const requiresEmailConfirmation = !authSessionToProcess;
    console.log(
      `[SupabaseService signUpUser END] Account provisioned. RequiresEmailConfirmation: ${requiresEmailConfirmation}`
    );

    return {
      user: authUserToProcess,
      session: authSessionToProcess,
      profile: finalAppUser,
      requiresEmailConfirmation,
      smtpFallbackUsed: false,
    };
  },

  joinOrCreateOrganizationForUser: async (userId: string, organizationName: string, roleFromForm?: UserRole): Promise<AppUserType> => {
    const trimmedOrgName = organizationName.trim();
    if (!trimmedOrgName) throw new Error("Organization name is required.");

    const selfSelectableRoles: UserRole[] = [UserRole.MEMBER, UserRole.PROJECT_MANAGER, UserRole.CLIENT_VIEWER];
    const orgCheck = await supabaseService.checkOrganizationExists(trimmedOrgName);
    if (orgCheck.error) {
      console.warn('[joinOrCreateOrganizationForUser] orgCheck warning:', orgCheck.error);
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const authUser = sessionData?.session?.user;

    if (orgCheck.exists && orgCheck.id) {
      // Existing organization requires Project Manager or Owner approval!
      const requestedRole = (roleFromForm && selfSelectableRoles.includes(roleFromForm)) ? roleFromForm : UserRole.MEMBER;
      const existingProfile = await supabaseService.getUserProfile(userId);
      const requesterObj: AppUserType = existingProfile || normalizeAppUser({
        id: userId,
        supabase_auth_id: userId,
        email: authUser?.email || '',
        full_name: authUser?.user_metadata?.full_name || authUser?.email?.split('@')[0] || 'User',
        organization_id: undefined,
        role: requestedRole,
      });

      await supabaseService.createJoinRequest({
        organizationId: orgCheck.id,
        organizationName: orgCheck.name || trimmedOrgName,
        requester: requesterObj,
        requestedRole,
      });

      return requesterObj;
    }

    const newOrg = await supabaseService.findOrCreateOrganization(trimmedOrgName); 
    if (!newOrg || !newOrg.id) {
      throw new Error(`Failed to create or find organization: ${trimmedOrgName}.`);
    }
    const organizationIdForProfile = newOrg.id;
    const finalAssignedRole = UserRole.OWNER;

    saveUserProfileExtension(userId, {
      organization_id: organizationIdForProfile,
      organization_name: newOrg.name,
      organization_slug: newOrg.slug,
      roleOverride: finalAssignedRole,
      removedFromOrgId: null,
    });

    let { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .update({ organization_id: organizationIdForProfile, role: finalAssignedRole })
      .eq('id', userId)
      .select()
      .maybeSingle();

    if (profileError && (profileError.message?.toLowerCase().includes('enum') || profileError.code === '22P02')) {
      const retry = await supabase
        .from('user_profiles')
        .update({ organization_id: organizationIdForProfile, role: finalAssignedRole.toLowerCase() as any })
        .eq('id', userId)
        .select()
        .maybeSingle();
      profileData = retry.data;
      profileError = retry.error;
    }

    if (profileError) {
      console.warn('[joinOrCreateOrganizationForUser] DB update warning, using profile extension fallback:', profileError.message);
    }

    const updatedUser = normalizeAppUser({
      id: profileData?.id || userId,
      supabase_auth_id: userId,
      email: profileData?.email || authUser?.email || '',
      full_name: profileData?.full_name || authUser?.user_metadata?.full_name || '',
      avatar_url: profileData?.avatar_url,
      organization_id: organizationIdForProfile,
      role: finalAssignedRole,
    });
    if (updatedUser.email) {
      supabaseService.saveLocalAccountProfile(updatedUser.email, updatedUser);
    }
    return updatedUser;
  },

  signInUser: async (email: string, password: string): Promise<{ fallbackProfile?: AppUserType }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('omni_just_registered');
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    if (!error && data?.user) {
      await supabaseService.ensureUserProfileForSession(data.user);
      return {};
    }

    // Check if the user has a verified local/override account (e.g. created while Brevo SMTP had an error or password reset)
    if (typeof window !== 'undefined' && cleanEmail && password) {
      try {
        const rawOverrides = localStorage.getItem('omni_password_overrides_v1');
        const overrides = rawOverrides ? JSON.parse(rawOverrides) : {};
        if (overrides[cleanEmail] && overrides[cleanEmail] === password) {
          const { data: existingProfile } = await withSupabaseRetry(() =>
            supabase
              .from('user_profiles')
              .select('*')
              .ilike('email', cleanEmail)
              .maybeSingle()
          );
          if (existingProfile) {
            const normalized = normalizeAppUser(existingProfile);
            supabaseService.saveLocalAccountProfile(cleanEmail, normalized);
            return { fallbackProfile: normalized };
          }
          const localProfile = supabaseService.getLocalAccountProfile(cleanEmail);
          if (localProfile) {
            return { fallbackProfile: localProfile };
          }
        }
      } catch {}
    }

    if (error) throw error;
    return {};
  },

  signOutUser: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  getSession: () => supabase.auth.getSession(),
  
  onAuthStateChange: (callback: (event: string, session: Session | null) => void) => {
    return supabase.auth.onAuthStateChange(callback);
  },

  getUserProfile: async (userId: string): Promise<AppUserType | null> => {
    if (!userId) return null;
    return deduplicateRequest(`get_profile_${userId}`, async () => {
      const { data, error } = await withSupabaseRetry(() =>
        supabase.from('user_profiles').select('*').eq('id', userId).maybeSingle()
      );
      if (error) {
        console.warn(`[SupabaseService getUserProfile] Query warning for user ${userId}:`, error.message || error);
        return null;
      }
      if (!data) return null;
      const { id, supabase_auth_id, ...profileData } = data;
      return normalizeAppUser({ id, supabase_auth_id: userId, ...profileData });
    });
  },

  getProjects: async (): Promise<Project[]> => {
    return deduplicateRequest('get_projects', async () => {
      const { data, error } = await withSupabaseRetry(() =>
        supabase.from('projects').select('*').order('created_at', { ascending: false })
      );
      if (error) throw error;
      return (data as Project[]) || [];
    });
  },

  getTasksByProjectId: async (projectId: string): Promise<Task[]> => {
    return deduplicateRequest(`get_tasks_proj_${projectId}`, async () => {
      const { data, error } = await withSupabaseRetry(() =>
        supabase.from('tasks').select('*').eq('project_id', projectId)
      );
      if (error) throw error;
      return ((data as any[]) || []).map(mapDbTaskToAppTask);
    });
  },

  getTaskById: async (taskId: string): Promise<Task | null> => {
    const { data, error } = await withSupabaseRetry(() =>
      supabase.from('tasks').select('*').eq('id', taskId).maybeSingle()
    );
    if (error) {
      console.error("Error in getTaskById:", error);
      return null;
    }
    return data ? mapDbTaskToAppTask(data) : null;
  },

  getMyTasks: async (userId?: string): Promise<Task[]> => {
    let targetUserId = userId;
    if (!targetUserId) {
      const { data: sessionData } = await supabase.auth.getSession();
      targetUserId = sessionData?.session?.user?.id;
    }
    if (!targetUserId) return [];
    
    return deduplicateRequest(`get_my_tasks_${targetUserId}`, async () => {
      const { data, error } = await withSupabaseRetry(() =>
        supabase.from('tasks').select('*').eq('assignee_id', targetUserId!)
      );
      if (error) throw error;
      return ((data as any[]) || []).map(mapDbTaskToAppTask);
    });
  },

  getNotifications: async (userId?: string): Promise<any[]> => {
    let targetUserId = userId;
    if (!targetUserId) {
      const { data: sessionData } = await supabase.auth.getSession();
      targetUserId = sessionData?.session?.user?.id;
    }
    if (!targetUserId) return [];
    return deduplicateRequest(`get_notifications_${targetUserId}`, async () => {
      const { data, error } = await withSupabaseRetry(() =>
        supabase.from('notifications').select('*').eq('user_id', targetUserId!).order('created_at', { ascending: false })
      );
      if (error) {
        return [];
      }
      return ((data as any[]) || []).map(n => {
        const rawMsg = String(n.content || n.message || '');
        const cleanMsg = rawMsg.includes('||JSON:') ? rawMsg.split('||JSON:')[0] : rawMsg;
        return {
          ...n,
          read: n.is_read !== undefined ? n.is_read : n.read,
          message: cleanMsg,
          content: cleanMsg,
          raw_content: rawMsg,
          entity_id: n.reference_id || n.entity_id,
        };
      });
    });
  },

  insertNotification: async (notification: any): Promise<void> => {
    const dbNotification = {
      id: notification.id || crypto.randomUUID(),
      user_id: notification.user_id,
      sender_id: notification.actor_id || notification.sender_id || notification.user_id,
      type: notification.type || 'SYSTEM_NOTIFICATION',
      title: notification.title || 'Workspace Update',
      content: notification.raw_content || notification.message || notification.content || '',
      reference_id: notification.entity_id || notification.reference_id || '00000000-0000-0000-0000-000000000000',
      is_read: notification.read || false,
      created_at: notification.created_at || new Date().toISOString(),
    };
    
    const { error } = await supabase.from('notifications').insert([dbNotification]);
    if (error) {
      console.warn("Failed to insert notification, table might not exist:", error);
      throw error;
    }
  },

  markNotificationAsRead: async (id: string): Promise<void> => {
    const { error } = await supabase.from('notifications').update({ is_read: true, read: true }).eq('id', id);
    if (error) console.error("Failed to mark notification as read:", error);
  },

  markAllNotificationsAsRead: async (userId: string): Promise<void> => {
    const { error } = await supabase.from('notifications').update({ is_read: true, read: true }).eq('user_id', userId);
    if (error) console.error("Failed to mark all notifications as read:", error);
  },

  getUsersByOrganizationId: async (organizationId: string): Promise<AppUserType[]> => {
    if (!organizationId) return [];
    return deduplicateRequest(`get_users_org_${organizationId}`, async () => {
      const { data, error } = await withSupabaseRetry(() =>
        supabase.from('user_profiles').select('*').eq('organization_id', organizationId)
      );
      if (error) throw error;
      return ((data as any[]) || []).map(normalizeAppUser);
    });
  },

  createTask: async (taskData: Omit<Task, 'id' | 'position' | 'created_at' | 'updated_at'>) => {
    const { data: authUser } = await supabase.auth.getUser();
    if (!authUser.user) throw new Error("User not authenticated");
    
    const { data: countResult, error: countError } = await supabase
      .from('tasks')
      .select('count', { count: 'exact' })
      .eq('project_id', taskData.projectId)
      .eq('status', taskData.status);
    
    if (countError) throw countError;

    const position = countResult[0]?.count || 0;
    
    const dbTaskData = {
      ...transformTaskToDbFormat(taskData),
      position,
      creator_id: authUser.user.id
    };

    const { data, error } = await supabase.from('tasks').insert(dbTaskData).select().single();
    if (error) throw error;
    if (data?.id) {
      saveTaskExtension(data.id, taskData);
    }
    return mapDbTaskToAppTask(data);
  },

  updateTask: async (taskId: string, updates: Partial<Omit<Task, 'id'>>) => {
    saveTaskExtension(taskId, updates);
    const dbUpdates = transformTaskToDbFormat(updates);
    if (Object.keys(dbUpdates).length > 0) {
      const { error } = await supabase.from('tasks').update(dbUpdates).eq('id', taskId);
      if (error) throw error;
    }
  },

  deleteTask: async (taskId: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) throw error;
  },

  createProject: async (projectData: Partial<Project>): Promise<Project> => {
    const { data: authUser } = await supabase.auth.getUser();
    if (!authUser.user) throw new Error("User not authenticated");
    
    const payload = { ...projectData, owner_id: authUser.user.id, status: 'active' };
    const { data, error } = await supabase.from('projects').insert(payload).select().single();
    if (error) throw error;
    return data;
  },
  
  updateUserRole: async (userId: string, newRole: UserRole, orgId: string): Promise<AppUserType | null> => {
    const normalizedRole = normalizeUserRole(newRole);
    // Persist immediately in local extension store for instant resilience
    saveUserProfileExtension(userId, { roleOverride: normalizedRole, organization_id: orgId });

    // 1. Try updating with uppercase enum value (e.g., 'PROJECT_MANAGER', 'MEMBER') and associating orgId if missing
    let { data, error } = await supabase
      .from('user_profiles')
      .update({ role: normalizedRole, organization_id: orgId })
      .eq('id', userId)
      .select()
      .maybeSingle();

    // 2. If DB has a lowercase enum constraint (e.g., 'member' instead of 'MEMBER'), retry with lowercase
    if (error && (error.message?.toLowerCase().includes('enum') || error.code === '22P02')) {
      const lowerRole = normalizedRole.toLowerCase();
      const retry = await supabase
        .from('user_profiles')
        .update({ role: lowerRole as any, organization_id: orgId })
        .eq('id', userId)
        .select()
        .maybeSingle();
      data = retry.data;
      error = retry.error;
    }

    // 3. If RLS blocked updating organization_id on an existing member, try updating just the role column
    if (error || !data) {
      const roleOnly = await supabase
        .from('user_profiles')
        .update({ role: normalizedRole })
        .eq('id', userId)
        .select()
        .maybeSingle();
      if (!roleOnly.error && roleOnly.data) {
        data = roleOnly.data;
        error = null;
      } else if (roleOnly.error && (roleOnly.error.message?.toLowerCase().includes('enum') || roleOnly.error.code === '22P02')) {
        const lowerRetry = await supabase
          .from('user_profiles')
          .update({ role: normalizedRole.toLowerCase() as any })
          .eq('id', userId)
          .select()
          .maybeSingle();
        if (!lowerRetry.error && lowerRetry.data) {
          data = lowerRetry.data;
          error = null;
        }
      }
    }

    // Also update custom team members cache if present
    if (typeof window !== 'undefined') {
      try {
        const savedCustom = localStorage.getItem('omni_custom_team_members');
        if (savedCustom) {
          const customList: AppUserType[] = JSON.parse(savedCustom);
          const updatedCustom = customList.map(u => u.id === userId ? { ...u, role: normalizedRole, organization_id: orgId } : u);
          localStorage.setItem('omni_custom_team_members', JSON.stringify(updatedCustom));
        }
      } catch (e) {}
    }

    if (data) {
      return normalizeAppUser({ ...data, role: normalizedRole, organization_id: orgId });
    }
    return null;
  },

  updateTeamMemberMetadata: async (userId: string, metadata: { department?: string; job_title?: string; weekly_capacity_hours?: number; status_state?: 'active' | 'suspended' | 'invited' }) => {
    saveUserProfileExtension(userId, metadata);
    try {
      await supabase
        .from('user_profiles')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', userId);
    } catch (e) {}
  },

  removeUserFromOrganization: async (userId: string, orgId: string) => {
    saveUserProfileExtension(userId, { roleOverride: null, organization_id: null, removedFromOrgId: orgId });
    // This is a "soft" removal, keeping the profile but detaching from org.
    const { error } = await supabase.from('user_profiles').update({ organization_id: null, role: null }).eq('id', userId);
    if (error) {
      console.warn('Supabase removeUserFromOrganization warning (handled via extension fallback):', error.message);
    }
    if (typeof window !== 'undefined') {
      try {
        const savedCustom = localStorage.getItem('omni_custom_team_members');
        if (savedCustom) {
          const customList: AppUserType[] = JSON.parse(savedCustom);
          const filtered = customList.filter(u => u.id !== userId);
          localStorage.setItem('omni_custom_team_members', JSON.stringify(filtered));
        }
      } catch (e) {}
    }
  },
  
  updateUserPassword: async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },

  sendPasswordResetEmail: async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const redirectTo = `${getProductionBaseUrl()}#type=recovery&email=${encodeURIComponent(cleanEmail)}`;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo });
      if (error) {
        console.warn('[supabaseService.sendPasswordResetEmail] Supabase resetPasswordForEmail warning:', error.message);
      }
    } catch (e) {
      console.warn('[supabaseService.sendPasswordResetEmail] Network/Auth warning:', e);
    }
    return { redirectTo };
  },

  // Audit Logs Service (uses persistent local store + cross-tab BroadcastChannel to avoid 42P01 on unprovisioned audit_logs table)
  logAuditEvent: async (event: Omit<AuditLog, 'id' | 'created_at'>): Promise<AuditLog> => {
    const newLog: AuditLog = {
      id: crypto.randomUUID(),
      ...event,
      created_at: new Date().toISOString()
    };

    try {
      const existingStr = localStorage.getItem('app_audit_logs');
      const existing: AuditLog[] = existingStr ? JSON.parse(existingStr) : [];
      const updated = [newLog, ...existing].slice(0, 500);
      localStorage.setItem('app_audit_logs', JSON.stringify(updated));
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('omni_collab_sync');
        bc.postMessage({ type: 'AUDIT_LOG_CREATED', payload: newLog });
        bc.close();
      }
    } catch (e) {
      console.error('Failed to write to local audit log cache:', e);
    }

    return newLog;
  },

  getAuditLogs: async (organizationId?: string, limit = 200): Promise<AuditLog[]> => {
    let localLogs: AuditLog[] = [];
    try {
      const existingStr = localStorage.getItem('app_audit_logs');
      if (existingStr) {
        const parsed: AuditLog[] = JSON.parse(existingStr);
        if (Array.isArray(parsed)) {
          localLogs = organizationId
            ? parsed.filter(l => !l.organization_id || l.organization_id === organizationId)
            : parsed;
        }
      }
    } catch (e) {
      console.error('Failed reading local audit logs cache:', e);
    }

    return localLogs
      .slice(0, limit)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  getOrganizationAuditLogs: async (organizationId?: string, limit = 200): Promise<AuditLog[]> => {
    return supabaseService.getAuditLogs(organizationId, limit);
  },

  // Organization Invitation System (uses local store + BroadcastChannel to avoid 42P01 on unprovisioned organization_invitations table)
  createInvitation: async (invitationData: Omit<OrganizationInvitation, 'id' | 'token' | 'status' | 'created_at'>): Promise<OrganizationInvitation> => {
    const token = 'inv_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
    const newInvitation: OrganizationInvitation = {
      id: crypto.randomUUID(),
      ...invitationData,
      token,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    try {
      const existingStr = localStorage.getItem('app_org_invitations');
      const existing: OrganizationInvitation[] = existingStr ? JSON.parse(existingStr) : [];
      localStorage.setItem('app_org_invitations', JSON.stringify([newInvitation, ...existing]));
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('omni_collab_sync');
        bc.postMessage({ type: 'ORG_INVITATION_UPSERT', payload: newInvitation });
        bc.close();
      }
    } catch (e) {
      console.error('Failed to store local invitation:', e);
    }

    return newInvitation;
  },

  getInvitations: async (organizationId: string): Promise<OrganizationInvitation[]> => {
    try {
      const existingStr = localStorage.getItem('app_org_invitations');
      if (existingStr) {
        const all: OrganizationInvitation[] = JSON.parse(existingStr);
        return all
          .filter(inv => inv.organization_id === organizationId)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
    } catch (e) {
      console.error('Error reading local invitations:', e);
    }
    return [];
  },

  getInvitationByToken: async (token: string): Promise<OrganizationInvitation | null> => {
    try {
      const existingStr = localStorage.getItem('app_org_invitations');
      if (existingStr) {
        const all: OrganizationInvitation[] = JSON.parse(existingStr);
        const match = all.find(inv => inv.token === token);
        if (match) return match;
      }
    } catch (e) {
      console.error('Error checking local storage for token:', e);
    }
    return null;
  },

  getOrganizationById: async (orgId: string): Promise<AppOrganizationType | null> => {
    if (!orgId) return null;
    if (orgId === 'be2f60da-097a-47a3-859c-571c9139c14d') {
      cacheKnownOrganization({
        id: 'be2f60da-097a-47a3-859c-571c9139c14d',
        name: 'regal-logistics',
        slug: 'regal-logistics',
      });
    }
    return deduplicateRequest(`get_org_${orgId}`, async () => {
      const { data, error } = await withSupabaseRetry(() =>
        supabase.from('organizations').select('*').eq('id', orgId).maybeSingle()
      );

      if (data) {
        cacheKnownOrganization(data as any);
        return data as AppOrganizationType;
      }

      const cached = getCachedKnownOrganizations().find(o => o.id === orgId);
      if (cached) {
        return { id: cached.id, name: cached.name, slug: cached.slug };
      }

      if (error && error.code !== 'PGRST116' && !isTransientNetworkError(error)) {
        console.warn('Warning fetching organization by ID:', error.message || error);
      }
      return null;
    });
  },

  // ============================================================================
  // ORGANIZATION JOIN REQUEST & PROJECT MANAGER / OWNER APPROVAL SYSTEM
  // ============================================================================

  createJoinRequest: async (params: {
    organizationId: string;
    organizationName: string;
    requester: AppUserType;
    requestedRole: UserRole;
    message?: string;
  }): Promise<OrganizationJoinRequest> => {
    const { organizationId, organizationName, requester, requestedRole, message } = params;
    const normalizedRole =
      requestedRole === UserRole.PROJECT_MANAGER ? UserRole.PROJECT_MANAGER : UserRole.MEMBER;

    const newReq: OrganizationJoinRequest = {
      id:
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : 'jreq_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      organization_id: organizationId,
      organization_name: organizationName,
      requester_id: requester.id,
      requester_name: requester.full_name || requester.email.split('@')[0],
      requester_email: requester.email,
      requester_avatar: requester.avatar_url,
      requested_role: normalizedRole,
      message: message?.trim() || `Requesting ${normalizedRole.replace(/_/g, ' ')} access to ${organizationName}.`,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    // 1. Save in local join requests store
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(JOIN_REQUESTS_STORAGE_KEY);
        const list: OrganizationJoinRequest[] = raw ? JSON.parse(raw) : [];
        const filtered = list.filter(
          r =>
            !(
              r.organization_id === organizationId &&
              (r.requester_id === requester.id || r.requester_email.toLowerCase() === requester.email.toLowerCase()) &&
              r.status === 'pending'
            )
        );
        localStorage.setItem(JOIN_REQUESTS_STORAGE_KEY, JSON.stringify([newReq, ...filtered]));
      } catch {}
    }

    // 2. Sync to cross-session backend API (/api/join-requests)
    if (typeof window !== 'undefined') {
      fetch('/api/join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newReq),
      }).catch(() => {});
    }

    // 3. Also store in local audit_logs
    try {
      await supabaseService.logAuditEvent({
        organization_id: organizationId,
        actor_id: requester.id,
        actor_name: newReq.requester_name,
        actor_email: newReq.requester_email,
        action: 'organization_join_requested',
        target_type: 'organization',
        target_id: newReq.id,
        target_name: organizationName,
        details: {
          joinRequest: newReq,
          requested_role: normalizedRole,
          status: 'pending',
        },
      });
    } catch {}

    // 4. Notify all Project Managers, Admins, and Owners of this organization in Supabase notifications
    // We embed `||JSON:${JSON.stringify(newReq)}` in `raw_content` so approvers on any browser/device reconstruct the full request from Supabase
    const displayMsg = `${newReq.requester_name} (${newReq.requester_email}) requested to join ${organizationName} as ${normalizedRole.replace(/_/g, ' ')}. Approve or decline in Team Management.`;
    const encodedContent = `${displayMsg}||JSON:${JSON.stringify(newReq)}`;

    try {
      const orgMembers = await supabaseService.getUsersByOrganizationId(organizationId);
      const approvers = orgMembers.filter(m => {
        const r = normalizeUserRole(m.role);
        return r === UserRole.OWNER || r === UserRole.ADMIN || r === UserRole.PROJECT_MANAGER;
      });
      for (const approver of approvers) {
        await supabaseService
          .insertNotification({
            id: crypto.randomUUID(),
            user_id: approver.id,
            actor_id: requester.id,
            type: 'ORGANIZATION_JOIN_REQUEST',
            title: `🔐 Access Request: ${newReq.requester_name}`,
            message: displayMsg,
            raw_content: encodedContent,
            entity_type: 'user',
            entity_id: organizationId,
            reference_id: organizationId,
            read: false,
            created_at: new Date().toISOString(),
          })
          .catch(() => {});
      }
      // Also store a self-reference notification for the requester so their pending state persists across browsers
      await supabaseService
        .insertNotification({
          id: crypto.randomUUID(),
          user_id: requester.id,
          actor_id: requester.id,
          type: 'ORGANIZATION_JOIN_REQUEST_SENT',
          title: `⏳ Request Sent to ${organizationName}`,
          message: `Your request to join ${organizationName} as ${normalizedRole.replace(/_/g, ' ')} is awaiting Owner or Project Manager approval.`,
          raw_content: `Your request to join ${organizationName} as ${normalizedRole.replace(/_/g, ' ')} is awaiting Owner or Project Manager approval.||JSON:${JSON.stringify(newReq)}`,
          entity_type: 'organization',
          entity_id: organizationId,
          reference_id: organizationId,
          read: false,
          created_at: new Date().toISOString(),
        })
        .catch(() => {});
    } catch {}

    // 5. Broadcast live event for online Project Managers & Owners
    if (typeof window !== 'undefined') {
      try {
        if ('BroadcastChannel' in window) {
          const bc = new BroadcastChannel('omni_collab_sync');
          bc.postMessage({ type: 'ORG_JOIN_REQUEST_UPSERT', payload: newReq });
          bc.close();
        }
        window.dispatchEvent(new CustomEvent('omni_org_join_request_updated', { detail: newReq }));
      } catch {}
    }

    return newReq;
  },

  getJoinRequestsForOrganization: async (organizationId: string): Promise<OrganizationJoinRequest[]> => {
    if (!organizationId) return [];
    const map = new Map<string, OrganizationJoinRequest>();

    // 1. Read from localStorage
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(JOIN_REQUESTS_STORAGE_KEY);
        const list: OrganizationJoinRequest[] = raw ? JSON.parse(raw) : [];
        list
          .filter(r => r && r.organization_id === organizationId)
          .forEach(r => map.set(r.id, r));
      } catch {}
    }

    // 2. Fetch from cross-session backend API (/api/join-requests)
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch(`/api/join-requests?organizationId=${encodeURIComponent(organizationId)}`);
        if (res.ok) {
          const serverList: OrganizationJoinRequest[] = await res.json();
          if (Array.isArray(serverList)) {
            serverList.forEach(r => {
              if (r && r.id && r.organization_id === organizationId) {
                const existing = map.get(r.id);
                if (!existing || existing.status === 'pending') {
                  map.set(r.id, r);
                }
              }
            });
          }
        }
      } catch {}
    }

    // 3. Reconstruct from Supabase notifications table (works across separate browsers/devices)
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const myUserId = sessionData?.session?.user?.id;
      if (myUserId) {
        const { data: notifRows } = await withSupabaseRetry(() =>
          supabase
            .from('notifications')
            .select('*')
            .eq('user_id', myUserId)
            .eq('type', 'ORGANIZATION_JOIN_REQUEST')
            .order('created_at', { ascending: false })
            .limit(50)
        );
        if (Array.isArray(notifRows)) {
          notifRows.forEach((n: any) => {
            const rawContent = String(n.content || n.message || '');
            if (rawContent.includes('||JSON:')) {
              try {
                const parsed: OrganizationJoinRequest = JSON.parse(rawContent.split('||JSON:')[1]);
                if (parsed && parsed.id && parsed.organization_id === organizationId && !map.has(parsed.id)) {
                  map.set(parsed.id, parsed);
                }
              } catch {}
            }
          });
        }
      }
    } catch {}

    // 4. Also reconstruct from audit logs cache
    try {
      const logs = await supabaseService.getAuditLogs(organizationId, 150);
      logs.forEach(log => {
        const detailsObj =
          typeof log.details === 'string'
            ? (() => {
                try {
                  return JSON.parse(log.details);
                } catch {
                  return null;
                }
              })()
            : log.details;
        if (log.action === 'organization_join_requested' && detailsObj?.joinRequest) {
          const jr = detailsObj.joinRequest as OrganizationJoinRequest;
          if (jr && jr.id && !map.has(jr.id)) {
            map.set(jr.id, jr);
          }
        }
      });
      logs.forEach(log => {
        const detailsObj =
          typeof log.details === 'string'
            ? (() => {
                try {
                  return JSON.parse(log.details);
                } catch {
                  return null;
                }
              })()
            : log.details;
        if (
          (log.action === 'organization_join_approved' || log.action === 'organization_join_declined') &&
          detailsObj?.requestId
        ) {
          const existing = map.get(detailsObj.requestId);
          if (existing) {
            map.set(detailsObj.requestId, {
              ...existing,
              status: log.action === 'organization_join_approved' ? 'approved' : 'declined',
              approved_role: detailsObj.approvedRole || existing.requested_role,
              reviewed_by: log.actor_id,
              reviewer_name: log.actor_name,
              reviewed_at: log.created_at,
            });
          }
        }
      });
    } catch {}

    // Deduplicate by requester_email / requester_id so only the latest request per user is active
    const finalList = Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    if (typeof window !== 'undefined' && finalList.length > 0) {
      try {
        const raw = localStorage.getItem(JOIN_REQUESTS_STORAGE_KEY);
        const existingLocal: OrganizationJoinRequest[] = raw ? JSON.parse(raw) : [];
        const otherOrgs = existingLocal.filter(r => r && r.organization_id !== organizationId);
        localStorage.setItem(JOIN_REQUESTS_STORAGE_KEY, JSON.stringify([...finalList, ...otherOrgs]));
      } catch {}
    }
    return finalList;
  },

  getPendingJoinRequestForUser: async (userId: string, userEmail?: string): Promise<OrganizationJoinRequest | null> => {
    if (!userId && !userEmail) return null;
    const cleanEmail = (userEmail || '').trim().toLowerCase();
    const candidates: OrganizationJoinRequest[] = [];

    // 1. Check cross-session backend API (/api/join-requests)
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch(
          `/api/join-requests?userId=${encodeURIComponent(userId || '')}&email=${encodeURIComponent(cleanEmail)}`
        );
        if (res.ok) {
          const serverList: OrganizationJoinRequest[] = await res.json();
          if (Array.isArray(serverList)) {
            candidates.push(...serverList);
          }
        }
      } catch {}
    }

    // 2. Check localStorage
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(JOIN_REQUESTS_STORAGE_KEY);
        const list: OrganizationJoinRequest[] = raw ? JSON.parse(raw) : [];
        const matches = list.filter(
          r =>
            r &&
            (r.requester_id === userId ||
              (cleanEmail && r.requester_email?.toLowerCase() === cleanEmail))
        );
        candidates.push(...matches);
      } catch {}
    }

    // 3. Check Supabase notifications for this user (e.g. ORGANIZATION_JOIN_APPROVED, ORGANIZATION_JOIN_DECLINED, ORGANIZATION_JOIN_REQUEST_SENT)
    if (userId) {
      try {
        const { data: notifRows } = await withSupabaseRetry(() =>
          supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .in('type', [
              'ORGANIZATION_JOIN_APPROVED',
              'ORGANIZATION_JOIN_DECLINED',
              'ORGANIZATION_JOIN_REQUEST_SENT',
            ])
            .order('created_at', { ascending: false })
            .limit(20)
        );
        if (Array.isArray(notifRows)) {
          notifRows.forEach((n: any) => {
            const rawContent = String(n.content || n.message || '');
            if (rawContent.includes('||JSON:')) {
              try {
                const parsed: OrganizationJoinRequest = JSON.parse(rawContent.split('||JSON:')[1]);
                if (parsed && parsed.id) {
                  candidates.push(parsed);
                }
              } catch {}
            }
          });
        }
      } catch {}
    }

    if (candidates.length === 0) return null;

    // Prioritize by status if same request ID exists in multiple sources (approved/declined beats pending)
    const byId = new Map<string, OrganizationJoinRequest>();
    const statusWeight = (s?: string) => (s === 'approved' ? 3 : s === 'declined' ? 2 : 1);
    candidates.forEach(c => {
      if (!c || !c.id) return;
      const prev = byId.get(c.id);
      if (!prev || statusWeight(c.status) > statusWeight(prev.status)) {
        byId.set(c.id, c);
      }
    });

    const sorted = Array.from(byId.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return sorted[0] || null;
  },

  cancelJoinRequest: async (requestId: string): Promise<void> => {
    if (!requestId) return;
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(JOIN_REQUESTS_STORAGE_KEY);
        const list: OrganizationJoinRequest[] = raw ? JSON.parse(raw) : [];
        const filtered = list.filter(r => r.id !== requestId);
        localStorage.setItem(JOIN_REQUESTS_STORAGE_KEY, JSON.stringify(filtered));
      } catch {}
      fetch(`/api/join-requests/${encodeURIComponent(requestId)}`, {
        method: 'DELETE',
      }).catch(() => {});
    }
  },

  approveJoinRequest: async (
    requestId: string,
    approvedRole: UserRole,
    reviewer: AppUserType
  ): Promise<OrganizationJoinRequest | null> => {
    const finalRole = normalizeUserRole(approvedRole);
    let targetReq: OrganizationJoinRequest | null = null;

    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(JOIN_REQUESTS_STORAGE_KEY);
        const list: OrganizationJoinRequest[] = raw ? JSON.parse(raw) : [];
        const idx = list.findIndex(r => r.id === requestId);
        if (idx >= 0) {
          targetReq = {
            ...list[idx],
            status: 'approved',
            approved_role: finalRole,
            reviewed_by: reviewer.id,
            reviewer_name: reviewer.full_name || reviewer.email,
            reviewed_at: new Date().toISOString(),
          };
          list[idx] = targetReq;
          localStorage.setItem(JOIN_REQUESTS_STORAGE_KEY, JSON.stringify(list));
        }
      } catch {}
    }

    if (!targetReq && reviewer.organization_id) {
      const allReqs = await supabaseService.getJoinRequestsForOrganization(reviewer.organization_id);
      const found = allReqs.find(r => r.id === requestId);
      if (found) {
        targetReq = {
          ...found,
          status: 'approved',
          approved_role: finalRole,
          reviewed_by: reviewer.id,
          reviewer_name: reviewer.full_name || reviewer.email,
          reviewed_at: new Date().toISOString(),
        };
      }
    }

    if (!targetReq) return null;

    // Sync approved status to backend API (/api/join-requests/:id)
    if (typeof window !== 'undefined') {
      fetch(`/api/join-requests/${encodeURIComponent(targetReq.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(targetReq),
      }).catch(() => {});
    }

    // 1. Update requester's profile in Supabase DB & profile extension store
    saveUserProfileExtension(targetReq.requester_id, {
      organization_id: targetReq.organization_id,
      organization_name: targetReq.organization_name,
      roleOverride: finalRole,
      removedFromOrgId: null,
    });

    try {
      await supabaseService.updateUserRole(
        targetReq.requester_id,
        finalRole,
        targetReq.organization_id
      );
    } catch {}

    // 2. Also add to custom team members cache so they immediately appear in Team Directory & Chat
    if (typeof window !== 'undefined') {
      try {
        const rawCustom = localStorage.getItem('omni_custom_team_members');
        const customList: AppUserType[] = rawCustom ? JSON.parse(rawCustom) : [];
        const existingIdx = customList.findIndex(
          u =>
            u.id === targetReq!.requester_id ||
            u.email?.toLowerCase() === targetReq!.requester_email.toLowerCase()
        );
        const memberRecord: AppUserType = normalizeAppUser({
          id: targetReq.requester_id,
          supabase_auth_id: targetReq.requester_id,
          email: targetReq.requester_email,
          full_name: targetReq.requester_name,
          avatar_url: targetReq.requester_avatar,
          organization_id: targetReq.organization_id,
          role: finalRole,
        });
        if (existingIdx >= 0) {
          customList[existingIdx] = memberRecord;
        } else {
          customList.push(memberRecord);
        }
        localStorage.setItem('omni_custom_team_members', JSON.stringify(customList));
      } catch {}
    }

    // 3. Log Audit Event
    await supabaseService.logAuditEvent({
      organization_id: targetReq.organization_id,
      actor_id: reviewer.id,
      actor_name: reviewer.full_name || reviewer.email,
      actor_email: reviewer.email,
      action: 'organization_join_approved',
      target_type: 'user',
      target_id: targetReq.requester_id,
      target_name: targetReq.requester_name,
      details: {
        requestId: targetReq.id,
        requestedRole: targetReq.requested_role,
        approvedRole: finalRole,
        organizationName: targetReq.organization_name,
      },
    });

    // 4. Send notification to requester with embedded JSON so their client automatically unlocks and updates user_profiles
    const approvalMsg = `${reviewer.full_name || reviewer.email} approved your request and granted you ${finalRole.replace(/_/g, ' ')} access.`;
    await supabaseService
      .insertNotification({
        id: crypto.randomUUID(),
        user_id: targetReq.requester_id,
        actor_id: reviewer.id,
        type: 'ORGANIZATION_JOIN_APPROVED',
        title: `🎉 Approved to join ${targetReq.organization_name}!`,
        message: approvalMsg,
        raw_content: `${approvalMsg}||JSON:${JSON.stringify(targetReq)}`,
        entity_type: 'user',
        entity_id: targetReq.organization_id,
        reference_id: targetReq.organization_id,
        read: false,
        created_at: new Date().toISOString(),
      })
      .catch(() => {});

    // 5. Broadcast approval across tabs & Realtime
    if (typeof window !== 'undefined') {
      try {
        if ('BroadcastChannel' in window) {
          const bc = new BroadcastChannel('omni_collab_sync');
          bc.postMessage({ type: 'ORG_JOIN_REQUEST_UPSERT', payload: targetReq });
          bc.close();
        }
        window.dispatchEvent(new CustomEvent('omni_org_join_request_updated', { detail: targetReq }));
      } catch {}
    }

    return targetReq;
  },

  declineJoinRequest: async (requestId: string, reviewer: AppUserType): Promise<OrganizationJoinRequest | null> => {
    let targetReq: OrganizationJoinRequest | null = null;
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(JOIN_REQUESTS_STORAGE_KEY);
        const list: OrganizationJoinRequest[] = raw ? JSON.parse(raw) : [];
        const idx = list.findIndex(r => r.id === requestId);
        if (idx >= 0) {
          targetReq = {
            ...list[idx],
            status: 'declined',
            reviewed_by: reviewer.id,
            reviewer_name: reviewer.full_name || reviewer.email,
            reviewed_at: new Date().toISOString(),
          };
          list[idx] = targetReq;
          localStorage.setItem(JOIN_REQUESTS_STORAGE_KEY, JSON.stringify(list));
        }
      } catch {}
    }

    if (!targetReq && reviewer.organization_id) {
      const allReqs = await supabaseService.getJoinRequestsForOrganization(reviewer.organization_id);
      const found = allReqs.find(r => r.id === requestId);
      if (found) {
        targetReq = {
          ...found,
          status: 'declined',
          reviewed_by: reviewer.id,
          reviewer_name: reviewer.full_name || reviewer.email,
          reviewed_at: new Date().toISOString(),
        };
      }
    }

    if (targetReq) {
      if (typeof window !== 'undefined') {
        fetch(`/api/join-requests/${encodeURIComponent(targetReq.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(targetReq),
        }).catch(() => {});
      }

      await supabaseService.logAuditEvent({
        organization_id: targetReq.organization_id,
        actor_id: reviewer.id,
        actor_name: reviewer.full_name || reviewer.email,
        actor_email: reviewer.email,
        action: 'organization_join_declined',
        target_type: 'user',
        target_id: targetReq.requester_id,
        target_name: targetReq.requester_name,
        details: {
          requestId: targetReq.id,
          requestedRole: targetReq.requested_role,
        },
      });

      const declineMsg = `Your request to join ${targetReq.organization_name} was declined by ${reviewer.full_name || reviewer.email}.`;
      await supabaseService
        .insertNotification({
          id: crypto.randomUUID(),
          user_id: targetReq.requester_id,
          actor_id: reviewer.id,
          type: 'ORGANIZATION_JOIN_DECLINED',
          title: `Access Request Declined`,
          message: declineMsg,
          raw_content: `${declineMsg}||JSON:${JSON.stringify(targetReq)}`,
          entity_type: 'user',
          entity_id: targetReq.organization_id,
          reference_id: targetReq.organization_id,
          read: false,
          created_at: new Date().toISOString(),
        })
        .catch(() => {});

      if (typeof window !== 'undefined') {
        try {
          if ('BroadcastChannel' in window) {
            const bc = new BroadcastChannel('omni_collab_sync');
            bc.postMessage({ type: 'ORG_JOIN_REQUEST_UPSERT', payload: targetReq });
            bc.close();
          }
          window.dispatchEvent(new CustomEvent('omni_org_join_request_updated', { detail: targetReq }));
        } catch {}
      }
    }

    return targetReq;
  },

  revokeInvitation: async (invitationId: string): Promise<void> => {
    try {
      const existingStr = localStorage.getItem('app_org_invitations');
      if (existingStr) {
        const all: OrganizationInvitation[] = JSON.parse(existingStr);
        const updated = all.map(inv => inv.id === invitationId ? { ...inv, status: 'revoked' as const } : inv);
        localStorage.setItem('app_org_invitations', JSON.stringify(updated));
      }
    } catch (e) {
      console.error('Failed local invitation revoke:', e);
    }
  },

  // Avatar Upload Helper
  uploadAvatar: async (userId: string, file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}_${Date.now()}.${fileExt}`;

    try {
      // Attempt bucket upload
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file, {
        upsert: true
      });

      if (!uploadError) {
        const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
        if (data?.publicUrl) {
          return data.publicUrl;
        }
      } else {
        console.warn('Supabase storage avatar bucket upload warning:', uploadError);
      }
    } catch (err) {
      console.warn('Supabase storage avatar upload failed, falling back to base64 encoding:', err);
    }

    // Fallback: Convert file to Base64 Data URL
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert image to data URL'));
        }
      };
      reader.onerror = () => reject(new Error('File reading failed'));
      reader.readAsDataURL(file);
    });
  }
};

export default supabaseService;
