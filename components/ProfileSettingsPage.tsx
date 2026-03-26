import React, { useState, useEffect } from 'react';
import { useAppStore } from '../hooks/useAppStore';
import supabaseService from '../services/supabaseService';
import { ICON_MAP } from '../constants';

export const ProfileSettingsPage: React.FC = () => {
  const { currentUser, darkMode, setCurrentUser } = useAppStore();
  
  const [fullName, setFullName] = useState(currentUser?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatar_url || '');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.full_name || '');
      setAvatarUrl(currentUser.avatar_url || '');
    }
  }, [currentUser]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    setIsSaving(true);
    setMessage(null);
    
    try {
      const updates = {
        full_name: fullName,
        avatar_url: avatarUrl,
      };
      
      const { data, error } = await supabaseService.client
        .from('user_profiles')
        .update(updates)
        .eq('id', currentUser.id)
        .select()
        .single();
        
      if (error) throw error;

      // Also update auth user metadata
      const { error: authError } = await supabaseService.client.auth.updateUser({
        data: { full_name: fullName, avatar_url: avatarUrl }
      });

      if (authError) {
        console.warn('Failed to update auth user metadata:', authError);
      }
      
      setCurrentUser({ ...currentUser, ...updates });
      setMessage({ type: 'success', text: 'Profile updated successfully.' });
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to update profile.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (!currentUser) return null;

  return (
    <div className="p-6 max-w-2xl mx-auto w-full animate-fadeIn">
      <div className="flex items-center gap-3 mb-6">
        <ICON_MAP.UserCircleIcon className="w-6 h-6 text-accent" />
        <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Profile Settings</h1>
      </div>
      
      <div className={`p-6 rounded-squircle-lg border shadow-glass-sm ${darkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-white/50 border-slate-200/50'}`}>
        {message && (
          <div className={`p-3 mb-4 rounded-md text-sm ${message.type === 'success' ? (darkMode ? 'bg-green-900/30 text-green-400 border border-green-800/50' : 'bg-green-50 text-green-700 border border-green-200') : (darkMode ? 'bg-red-900/30 text-red-400 border border-red-800/50' : 'bg-red-50 text-red-700 border border-red-200')}`}>
            {message.text}
          </div>
        )}
        
        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1.5 opacity-80">Email (Read Only)</label>
            <input 
              type="text" 
              value={currentUser.email} 
              disabled 
              className={`w-full px-3 py-2 rounded-md border ${darkMode ? 'bg-slate-900/50 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-300 text-slate-500'} cursor-not-allowed`}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1.5 opacity-80">Full Name</label>
            <input 
              type="text" 
              value={fullName} 
              onChange={(e) => setFullName(e.target.value)}
              required
              className={`w-full px-3 py-2 rounded-md border focus:ring-2 focus:ring-accent/50 outline-none transition-all ${darkMode ? 'bg-slate-900/50 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1.5 opacity-80">Avatar URL</label>
            <input 
              type="url" 
              value={avatarUrl} 
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.png"
              className={`w-full px-3 py-2 rounded-md border focus:ring-2 focus:ring-accent/50 outline-none transition-all ${darkMode ? 'bg-slate-900/50 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1.5 opacity-80">Role</label>
            <div className={`px-3 py-2 rounded-md border inline-block ${darkMode ? 'bg-slate-900/50 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-700'}`}>
              {currentUser.role}
            </div>
          </div>
          
          <div className="pt-4 flex justify-end">
            <button 
              type="submit" 
              disabled={isSaving}
              className="btn-primary flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <ICON_MAP.SpinnerIcon className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
