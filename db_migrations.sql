-- Run this script in your Supabase SQL Editor to create the necessary tables for the advanced Task View.

-- 1. Task Comments Table
CREATE TABLE IF NOT EXISTS public.task_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for task_comments
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- Policies for task_comments
CREATE POLICY "Users can view comments on tasks they can access" ON public.task_comments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.tasks t
            JOIN public.projects p ON t.project_id = p.id
            WHERE t.id = task_comments.task_id
            AND (p.organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()) OR p.owner_id = auth.uid())
        )
    );

CREATE POLICY "Users can insert comments on tasks they can access" ON public.task_comments
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.tasks t
            JOIN public.projects p ON t.project_id = p.id
            WHERE t.id = task_comments.task_id
            AND (p.organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()) OR p.owner_id = auth.uid())
        )
    );

CREATE POLICY "Users can update their own comments" ON public.task_comments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON public.task_comments
    FOR DELETE USING (auth.uid() = user_id);


-- 2. Task Attachments Table
CREATE TABLE IF NOT EXISTS public.task_attachments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for task_attachments
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

-- Policies for task_attachments
CREATE POLICY "Users can view attachments on tasks they can access" ON public.task_attachments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.tasks t
            JOIN public.projects p ON t.project_id = p.id
            WHERE t.id = task_attachments.task_id
            AND (p.organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()) OR p.owner_id = auth.uid())
        )
    );

CREATE POLICY "Users can insert attachments on tasks they can access" ON public.task_attachments
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.tasks t
            JOIN public.projects p ON t.project_id = p.id
            WHERE t.id = task_attachments.task_id
            AND (p.organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()) OR p.owner_id = auth.uid())
        )
    );

CREATE POLICY "Users can delete their own attachments" ON public.task_attachments
    FOR DELETE USING (auth.uid() = user_id);


-- 3. Task Collaborators Table (for multiple assignees/editors)
CREATE TABLE IF NOT EXISTS public.task_collaborators (
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
    role TEXT DEFAULT 'editor' CHECK (role IN ('editor', 'viewer')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (task_id, user_id)
);

-- Enable RLS for task_collaborators
ALTER TABLE public.task_collaborators ENABLE ROW LEVEL SECURITY;

-- Policies for task_collaborators
CREATE POLICY "Users can view collaborators on tasks they can access" ON public.task_collaborators
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.tasks t
            JOIN public.projects p ON t.project_id = p.id
            WHERE t.id = task_collaborators.task_id
            AND (p.organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()) OR p.owner_id = auth.uid())
        )
    );

CREATE POLICY "Users can manage collaborators on tasks they can access" ON public.task_collaborators
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.tasks t
            JOIN public.projects p ON t.project_id = p.id
            WHERE t.id = task_collaborators.task_id
            AND (p.organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()) OR p.owner_id = auth.uid())
        )
    );


-- 4. Task Activity Logs Table
CREATE TABLE IF NOT EXISTS public.task_activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
    action TEXT NOT NULL, -- e.g., 'created', 'status_changed', 'comment_added'
    details JSONB, -- e.g., {"old_status": "todo", "new_status": "in_progress"}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for task_activity_logs
ALTER TABLE public.task_activity_logs ENABLE ROW LEVEL SECURITY;

-- Policies for task_activity_logs
CREATE POLICY "Users can view activity logs on tasks they can access" ON public.task_activity_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.tasks t
            JOIN public.projects p ON t.project_id = p.id
            WHERE t.id = task_activity_logs.task_id
            AND (p.organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()) OR p.owner_id = auth.uid())
        )
    );

CREATE POLICY "System can insert activity logs" ON public.task_activity_logs
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.tasks t
            JOIN public.projects p ON t.project_id = p.id
            WHERE t.id = task_activity_logs.task_id
            AND (p.organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()) OR p.owner_id = auth.uid())
        )
    );

-- 5. Create Storage Bucket for Attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('task-attachments', 'task-attachments', true) ON CONFLICT (id) DO NOTHING;

-- Storage Policies
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'task-attachments');
CREATE POLICY "Authenticated users can upload attachments" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'task-attachments' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update their own attachments" ON storage.objects FOR UPDATE USING (bucket_id = 'task-attachments' AND auth.uid() = owner);
CREATE POLICY "Users can delete their own attachments" ON storage.objects FOR DELETE USING (bucket_id = 'task-attachments' AND auth.uid() = owner);
