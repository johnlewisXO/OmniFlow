


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

export const normalizeAppUser = (rawUser: any): AppUserType => {
  if (!rawUser) return rawUser;
  const ext = getUserProfileExtensions(rawUser.id);
  const resolvedRole = normalizeUserRole(ext.roleOverride || rawUser.role);
  const resolvedOrgId = ext.removedFromOrgId
    ? undefined
    : rawUser.organization_id || ext.organization_id || undefined;
  return {
    ...rawUser,
    id: rawUser.id,
    supabase_auth_id: rawUser.supabase_auth_id || rawUser.id,
    email: rawUser.email || '',
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

    // 3. Check audit_logs for organization names & IDs
    try {
      const { data: auditRows } = await supabase
        .from('audit_logs')
        .select('organization_id, target_type, target_name, details')
        .not('organization_id', 'is', null)
        .limit(100);
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

  signUpUser: async (email: string, password: string, fullName: string, organizationNameFromForm?: string, roleFromForm?: UserRole): Promise<{ user: SupabaseAuthUser; session: Session; profile: AppUserType } | null> => {
    const trimmedFullName = fullName.trim();
    const initialTrimmedOrgName = organizationNameFromForm?.trim();
    
    console.log(`[SupabaseService signUpUser START] Email: ${email}, FullName: ${trimmedFullName}, OrgNameFromForm: ${initialTrimmedOrgName || 'N/A'}, RoleFromForm: ${roleFromForm || 'N/A'}`);

    const emailRedirectTo = `${getProductionBaseUrl()}#/app`;
    const { data: signUpData, error: signUpAuthError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: { full_name: trimmedFullName }
      }
    });

    if (signUpAuthError) {
        console.error("[SupabaseService signUpUser] Auth SignUp Error:", signUpAuthError);
        throw signUpAuthError;
    }
    if (!signUpData.user || !signUpData.session) {
      if (signUpData.user && !signUpData.session) {
        console.warn("[SupabaseService signUpUser] Account requires email confirmation.");
        throw new Error('Sign up successful, but account requires email confirmation. Please check your inbox.');
      }
      console.error("[SupabaseService signUpUser] Auth SignUp did not complete as expected (no user or session).");
      throw new Error('Sign up did not complete as expected. Please try again.');
    }
    
    const authUserToProcess = signUpData.user;
    const authSessionToProcess = signUpData.session;
    const targetUserId = authUserToProcess.id;
    const targetUserEmail = authUserToProcess.email;

    let organizationIdForProfile: string | undefined = undefined;
    let finalAssignedRole: UserRole;
    const selfSelectableRoles: UserRole[] = [UserRole.MEMBER, UserRole.PROJECT_MANAGER, UserRole.CLIENT_VIEWER];
    
    console.log(`[SupabaseService signUpUser] Auth successful. User ID: ${targetUserId}`);

    if (initialTrimmedOrgName) { 
        console.log(`[SupabaseService signUpUser] Organization name provided: "${initialTrimmedOrgName}". Checking existence.`);
        const orgCheck = await supabaseService.checkOrganizationExists(initialTrimmedOrgName);
        if (orgCheck.error) {
            console.error("[SupabaseService signUpUser] Error checking organization:", orgCheck.error);
            throw new Error(`Failed to check organization status: ${orgCheck.error}.`);
        }

        if (orgCheck.exists && orgCheck.id) { 
            organizationIdForProfile = orgCheck.id; 
            finalAssignedRole = (roleFromForm && selfSelectableRoles.includes(roleFromForm)) ? roleFromForm : UserRole.MEMBER;
            console.log(`[SupabaseService signUpUser] DECISION: Joining EXISTING organization. OrgID: ${organizationIdForProfile}, Role: ${finalAssignedRole}`);
        } else { 
            console.log(`[SupabaseService signUpUser] Organization "${initialTrimmedOrgName}" does not exist or check failed to find it. Proceeding to find/create.`);
            const newOrg = await supabaseService.findOrCreateOrganization(initialTrimmedOrgName); 
            if (!newOrg || !newOrg.id) {
                console.error(`[SupabaseService signUpUser] Failed to create or find organization: "${initialTrimmedOrgName}".`);
                throw new Error(`Failed to create or find organization: ${initialTrimmedOrgName}. Organization creation process returned null or no ID.`);
            }
            organizationIdForProfile = newOrg.id;
            finalAssignedRole = UserRole.OWNER; 
            console.log(`[SupabaseService signUpUser] DECISION: Creating NEW organization. OrgID: ${organizationIdForProfile}, Role: ${finalAssignedRole}`);
        }
    } else { 
        organizationIdForProfile = undefined;
        finalAssignedRole = (roleFromForm && selfSelectableRoles.includes(roleFromForm)) ? roleFromForm : UserRole.MEMBER; 
        console.log(`[SupabaseService signUpUser] DECISION: No organization specified. Role: ${finalAssignedRole}`);
    }
    
    const profilePayload: UserProfileDb = {
      id: targetUserId,
      full_name: trimmedFullName,
      email: targetUserEmail,
      organization_id: organizationIdForProfile,
      role: finalAssignedRole,
    };
    
    console.log('[SupabaseService signUpUser] Profile payload to be inserted:', JSON.stringify(profilePayload));

    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .upsert(profilePayload)
      .select()
      .single();

    if (profileError) {
      console.error("[SupabaseService signUpUser] Error creating user profile:", profileError);
      // Best-effort cleanup of auth user if profile creation fails.
      // This requires admin privileges and might fail if not configured.
      console.log(`[SupabaseService signUpUser] Attempting to clean up auth user ${targetUserId} due to profile creation failure.`);
      // The following line requires service_role key and should be handled in a trusted environment (e.g., Supabase Function)
      // For client-side, this will likely fail without proper setup. We will proceed and let the user re-try.
      // await supabase.auth.admin.deleteUser(targetUserId); 
      throw profileError;
    }
    
    if (!profileData) {
        throw new Error('User profile could not be created or retrieved after sign up.');
    }

    console.log('[SupabaseService signUpUser] Profile created successfully:', JSON.stringify(profileData));

    const finalAppUser: AppUserType = {
      id: profileData.id,
      supabase_auth_id: authUserToProcess.id,
      email: authUserToProcess.email || profileData.email || '',
      full_name: profileData.full_name,
      avatar_url: profileData.avatar_url,
      organization_id: profileData.organization_id,
      role: profileData.role,
    };

    console.log('[SupabaseService signUpUser END] Successfully signed up and created profile.');

    return { user: authUserToProcess, session: authSessionToProcess, profile: finalAppUser };
  },

  joinOrCreateOrganizationForUser: async (userId: string, organizationName: string, roleFromForm?: UserRole): Promise<AppUserType> => {
    const trimmedOrgName = organizationName.trim();
    if (!trimmedOrgName) throw new Error("Organization name is required.");

    let organizationIdForProfile: string;
    let finalAssignedRole: UserRole;
    const selfSelectableRoles: UserRole[] = [UserRole.MEMBER, UserRole.PROJECT_MANAGER, UserRole.CLIENT_VIEWER];

    const orgCheck = await supabaseService.checkOrganizationExists(trimmedOrgName);
    if (orgCheck.error) {
      console.warn('[joinOrCreateOrganizationForUser] orgCheck warning:', orgCheck.error);
    }

    if (orgCheck.exists && orgCheck.id) { 
      organizationIdForProfile = orgCheck.id; 
      finalAssignedRole = (roleFromForm && selfSelectableRoles.includes(roleFromForm)) ? roleFromForm : UserRole.MEMBER;
    } else { 
      const newOrg = await supabaseService.findOrCreateOrganization(trimmedOrgName); 
      if (!newOrg || !newOrg.id) {
        throw new Error(`Failed to create or find organization: ${trimmedOrgName}.`);
      }
      organizationIdForProfile = newOrg.id;
      finalAssignedRole = UserRole.OWNER; 
    }

    saveUserProfileExtension(userId, {
      organization_id: organizationIdForProfile,
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

    const { data: sessionData } = await supabase.auth.getSession();
    const authUser = sessionData?.session?.user;

    return normalizeAppUser({
      id: profileData?.id || userId,
      supabase_auth_id: userId,
      email: profileData?.email || authUser?.email || '',
      full_name: profileData?.full_name || authUser?.user_metadata?.full_name || '',
      avatar_url: profileData?.avatar_url,
      organization_id: organizationIdForProfile,
      role: finalAssignedRole,
    });
  },

  signInUser: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
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
    try {
      const { data, error } = await supabase.from('user_profiles').select('*').eq('id', userId).maybeSingle();
      if (error) {
        console.warn(`[SupabaseService getUserProfile] Query warning for user ${userId}:`, error.message || error);
        return null;
      }
      if (!data) return null;
      const { id, supabase_auth_id, ...profileData } = data;
      return normalizeAppUser({ id, supabase_auth_id: userId, ...profileData });
    } catch (err: any) {
      console.warn(`[SupabaseService getUserProfile] Exception for user ${userId}:`, err?.message || err);
      return null;
    }
  },

  getProjects: async (): Promise<Project[]> => {
    const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  getTasksByProjectId: async (projectId: string): Promise<Task[]> => {
    const { data, error } = await supabase.from('tasks').select('*').eq('project_id', projectId);
    if (error) throw error;
    return data.map(mapDbTaskToAppTask);
  },

  getTaskById: async (taskId: string): Promise<Task | null> => {
    const { data, error } = await supabase.from('tasks').select('*').eq('id', taskId).maybeSingle();
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
    
    // Fetch tasks where assigned_to (assignee_id) is the current user
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('assignee_id', targetUserId);
      
    if (error) throw error;
    return (data || []).map(mapDbTaskToAppTask);
  },

  getNotifications: async (userId?: string): Promise<any[]> => {
    let targetUserId = userId;
    if (!targetUserId) {
      const { data: sessionData } = await supabase.auth.getSession();
      targetUserId = sessionData?.session?.user?.id;
    }
    if (!targetUserId) return [];
    const { data, error } = await supabase.from('notifications').select('*').eq('user_id', targetUserId).order('created_at', { ascending: false });
    if (error) {
      return [];
    }
    
    // Map database fields to frontend expected fields
    return (data || []).map(n => ({
      ...n,
      read: n.is_read !== undefined ? n.is_read : n.read,
      message: n.content || n.message,
      entity_id: n.reference_id || n.entity_id
    }));
  },

  insertNotification: async (notification: any): Promise<void> => {
    // Map frontend fields to database required fields
    const dbNotification = {
      ...notification,
      is_read: notification.read || false,
      content: notification.message || notification.content || '',
      reference_id: notification.entity_id || notification.reference_id || '00000000-0000-0000-0000-000000000000',
      sender_id: notification.actor_id || notification.sender_id || notification.user_id // Fallback
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
    const { data, error } = await supabase.from('user_profiles').select('*').eq('organization_id', organizationId);
    if (error) throw error;
    return (data || []).map(normalizeAppUser);
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

  // Audit Logs Service
  logAuditEvent: async (event: Omit<AuditLog, 'id' | 'created_at'>): Promise<AuditLog> => {
    const newLog: AuditLog = {
      id: crypto.randomUUID(),
      ...event,
      created_at: new Date().toISOString()
    };

    try {
      // Try pushing to Supabase DB audit_logs table
      const { data, error } = await supabase.from('audit_logs').insert({
        id: newLog.id,
        organization_id: newLog.organization_id,
        actor_id: newLog.actor_id,
        actor_name: newLog.actor_name,
        actor_email: newLog.actor_email,
        action: newLog.action,
        target_type: newLog.target_type,
        target_id: newLog.target_id,
        target_name: newLog.target_name,
        details: typeof newLog.details === 'object' ? JSON.stringify(newLog.details) : newLog.details,
        created_at: newLog.created_at
      }).select().single();

      if (!error && data) {
        return {
          ...data,
          details: data.details ? (typeof data.details === 'string' ? JSON.parse(data.details) : data.details) : undefined
        };
      }
    } catch (err) {
      console.warn('Supabase audit_logs table query failed, saving to local store fallback:', err);
    }

    // Local Storage Fallback
    try {
      const existingStr = localStorage.getItem('app_audit_logs');
      const existing: AuditLog[] = existingStr ? JSON.parse(existingStr) : [];
      const updated = [newLog, ...existing].slice(0, 500);
      localStorage.setItem('app_audit_logs', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to write to local audit log cache:', e);
    }

    return newLog;
  },

  getAuditLogs: async (organizationId?: string, limit = 200): Promise<AuditLog[]> => {
    let dbLogs: AuditLog[] = [];
    try {
      let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(limit);
      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        dbLogs = data.map(item => ({
          ...item,
          details: item.details && typeof item.details === 'string' ? JSON.parse(item.details) : item.details
        }));
      }
    } catch (err) {
      console.warn('Audit logs DB fetch fallback to local storage:', err);
    }

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

    const mergedMap = new Map<string, AuditLog>();
    [...localLogs, ...dbLogs].forEach(item => {
      if (item && item.id) mergedMap.set(item.id, item);
    });
    return Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  getOrganizationAuditLogs: async (organizationId?: string, limit = 200): Promise<AuditLog[]> => {
    return supabaseService.getAuditLogs(organizationId, limit);
  },

  // Organization Invitation System
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
      const { data, error } = await supabase.from('organization_invitations').insert(newInvitation).select().single();
      if (!error && data) {
        return data as OrganizationInvitation;
      }
    } catch (err) {
      console.warn('organization_invitations DB insert failed, using local storage fallback:', err);
    }

    // Local storage fallback
    try {
      const existingStr = localStorage.getItem('app_org_invitations');
      const existing: OrganizationInvitation[] = existingStr ? JSON.parse(existingStr) : [];
      localStorage.setItem('app_org_invitations', JSON.stringify([newInvitation, ...existing]));
    } catch (e) {
      console.error('Failed to store local invitation:', e);
    }

    return newInvitation;
  },

  getInvitations: async (organizationId: string): Promise<OrganizationInvitation[]> => {
    try {
      const { data, error } = await supabase.from('organization_invitations')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });
      if (!error && data) {
        return data as OrganizationInvitation[];
      }
    } catch (err) {
      console.warn('organization_invitations DB fetch fallback:', err);
    }

    // Local storage fallback
    try {
      const existingStr = localStorage.getItem('app_org_invitations');
      if (existingStr) {
        const all: OrganizationInvitation[] = JSON.parse(existingStr);
        return all.filter(inv => inv.organization_id === organizationId);
      }
    } catch (e) {
      console.error('Error reading local invitations:', e);
    }
    return [];
  },

  getInvitationByToken: async (token: string): Promise<OrganizationInvitation | null> => {
    try {
      const { data, error } = await supabase.from('organization_invitations')
        .select('*')
        .eq('token', token)
        .single();
      if (!error && data) {
        return data as OrganizationInvitation;
      }
    } catch (err) {
      console.warn('Error fetching token from DB, checking local storage:', err);
    }

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
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.warn('Error fetching organization by ID:', error);
      }
      if (data) {
        cacheKnownOrganization(data);
        return data as AppOrganizationType;
      }
    } catch (err) {
      console.warn('Network error fetching organization by ID:', err);
    }

    const cached = getCachedKnownOrganizations().find(o => o.id === orgId);
    if (cached) {
      return { id: cached.id, name: cached.name, slug: cached.slug };
    }
    return null;
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

    // 1. Save in local join requests store & broadcast across tabs
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

    // 2. Also store in Supabase audit_logs so every Project Manager / Owner across any browser device sees it
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

    // 3. Notify all Project Managers, Admins, and Owners of this organization in Supabase notifications
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
            message: `${newReq.requester_name} (${newReq.requester_email}) requested to join ${organizationName} as ${normalizedRole.replace(/_/g, ' ')}. Approve or decline in Team Management.`,
            entity_type: 'user',
            entity_id: requester.id,
            read: false,
            created_at: new Date().toISOString(),
          })
          .catch(() => {});
      }
    } catch {}

    // 4. Broadcast live event for online Project Managers & Owners
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

    // 2. Also reconstruct from Supabase audit_logs so requests made on other devices are always visible
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

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  getPendingJoinRequestForUser: async (userId: string, userEmail?: string): Promise<OrganizationJoinRequest | null> => {
    if (!userId && !userEmail) return null;
    const cleanEmail = (userEmail || '').trim().toLowerCase();

    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(JOIN_REQUESTS_STORAGE_KEY);
        const list: OrganizationJoinRequest[] = raw ? JSON.parse(raw) : [];
        const match = list.find(
          r =>
            r.requester_id === userId ||
            (cleanEmail && r.requester_email.toLowerCase() === cleanEmail)
        );
        if (match) return match;
      } catch {}
    }

    try {
      const { data: logs } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('actor_id', userId)
        .eq('action', 'organization_join_requested')
        .order('created_at', { ascending: false })
        .limit(1);

      if (logs && logs[0]) {
        const detailsObj =
          typeof logs[0].details === 'string' ? JSON.parse(logs[0].details) : logs[0].details;
        if (detailsObj?.joinRequest) {
          return detailsObj.joinRequest as OrganizationJoinRequest;
        }
      }
    } catch {}

    return null;
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

    // 1. Update requester's profile in Supabase DB & profile extension store
    saveUserProfileExtension(targetReq.requester_id, {
      organization_id: targetReq.organization_id,
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

    // 4. Send notification to requester
    await supabaseService
      .insertNotification({
        id: crypto.randomUUID(),
        user_id: targetReq.requester_id,
        actor_id: reviewer.id,
        type: 'ORGANIZATION_JOIN_APPROVED',
        title: `🎉 Approved to join ${targetReq.organization_name}!`,
        message: `${reviewer.full_name || reviewer.email} approved your request and granted you ${finalRole.replace(/_/g, ' ')} access.`,
        entity_type: 'user',
        entity_id: targetReq.requester_id,
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

    if (targetReq) {
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
      await supabase.from('organization_invitations').update({ status: 'revoked' }).eq('id', invitationId);
    } catch (err) {
      console.warn('Failed DB revoke, updating local storage:', err);
    }

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
