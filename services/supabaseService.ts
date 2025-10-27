


import { createClient, Session, User as SupabaseAuthUser, PostgrestError, SupabaseClient, AuthError } from '@supabase/supabase-js';
import { User as AppUserType, Project, Task, TaskStatus, UserRole, Organization as AppOrganizationType, TaskPriority } from '../types'; 

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://sqzjlxayhghoxjloaddo.supabase.co';
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxempseGF5aGdob3hqbG9hZGRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA0NDQ4MDksImV4cCI6MjA2NjAyMDgwOX0.80rrMJ7AC-XrcUNozIlMa1kh8SFnKagakG_4XOwVbTY';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Supabase URL or Anon Key is missing. Please check your environment variables.');
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

const mapDbTaskToAppTask = (dbTask: any): Task => {
  if (!dbTask) return dbTask;
  const { project_id, priority: dbPriority, due_date, assignee_id, creator_id, parent_task_id, created_at, updated_at, ...rest } = dbTask; 
  const appTask: Task = {
    ...rest, 
    projectId: project_id,
    priority: mapDbPriorityToAppPriority(dbPriority), 
    dueDate: due_date,
    assignee_id: assignee_id,
    creator_id: creator_id,
    parent_task_id: parent_task_id,
    created_at: created_at,
    updated_at: updated_at,
  };
  return appTask;
};

const transformTaskToDbFormat = (taskData: Partial<Task>): any => {
  const dbData: { [key: string]: any } = {};
  for (const key in taskData) {
    if (Object.prototype.hasOwnProperty.call(taskData, key)) {
      const dbKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      if (key === 'dueDate') {
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
      return newOrg as OrganizationDb;
    } catch (error: any) {
        throw new Error(`Operation failed in findOrCreateOrganization: ${error.message}`);
    }
  },

  checkOrganizationExists: async (orgName: string): Promise<{ exists: boolean, id?: string, name?: string, slug?: string, error?: string }> => {
    const trimmedOrgName = orgName.trim();
    if (!trimmedOrgName) return { exists: false };
    const slug = supabaseService.generateSlug(trimmedOrgName);
    
    try {
      const { data, error } = await supabase
          .from('organizations')
          .select('id, name, slug') 
          .or(`slug.eq.${slug},name.ilike.${trimmedOrgName.replace(/['%_]/g, '\\$&')}`)
          .maybeSingle();

      if (error && error.code !== 'PGRST116') {
          return { exists: false, error: `Supabase query error: ${error.message}` };
      }
      return { exists: !!data, id: data?.id, name: data?.name, slug: data?.slug };
    } catch (error: any) {
        return { exists: false, error: `Network/client error: ${error.message}` };
    }
  },

  signUpUser: async (email: string, password: string, fullName: string, organizationNameFromForm?: string, roleFromForm?: UserRole): Promise<{ user: SupabaseAuthUser; session: Session; profile: AppUserType } | null> => {
    const trimmedFullName = fullName.trim();
    const initialTrimmedOrgName = organizationNameFromForm?.trim();
    
    console.log(`[SupabaseService signUpUser START] Email: ${email}, FullName: ${trimmedFullName}, OrgNameFromForm: ${initialTrimmedOrgName || 'N/A'}, RoleFromForm: ${roleFromForm || 'N/A'}`);

    const { data: signUpData, error: signUpAuthError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: trimmedFullName } }
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
      .insert(profilePayload)
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
    const { data, error } = await supabase.from('user_profiles').select('*').eq('id', userId).single();
    if (error) {
      if (error.code === 'PGRST116') return null; // Not found, valid case
      throw error;
    }
    const { id, supabase_auth_id, ...profileData } = data;
    return { id, supabase_auth_id: userId, ...profileData };
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

  getUsersByOrganizationId: async (organizationId: string): Promise<AppUserType[]> => {
    const { data, error } = await supabase.from('user_profiles').select('*').eq('organization_id', organizationId);
    if (error) throw error;
    return data;
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

    const { error } = await supabase.from('tasks').insert(dbTaskData);
    if (error) throw error;
  },

  updateTask: async (taskId: string, updates: Partial<Omit<Task, 'id'>>) => {
    const dbUpdates = transformTaskToDbFormat(updates);
    const { error } = await supabase.from('tasks').update(dbUpdates).eq('id', taskId);
    if (error) throw error;
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
  
  updateUserRole: async (userId: string, newRole: UserRole, orgId: string) => {
    const { error } = await supabase.from('user_profiles').update({ role: newRole }).eq('id', userId).eq('organization_id', orgId);
    if (error) throw error;
  },

  removeUserFromOrganization: async (userId: string, orgId: string) => {
    // This is a "soft" removal, keeping the profile but detaching from org.
    const { error } = await supabase.from('user_profiles').update({ organization_id: null, role: null }).eq('id', userId).eq('organization_id', orgId);
    if (error) throw error;
  },
  
  updateUserPassword: async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }
};

export default supabaseService;
