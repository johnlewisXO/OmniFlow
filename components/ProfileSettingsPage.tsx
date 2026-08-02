import React, { useState, useEffect } from 'react';
import { useAppStore } from '../hooks/useAppStore';
import supabaseService from '../services/supabaseService';
import { ICON_MAP } from '../constants';

export const ProfileSettingsPage: React.FC = () => {
  const { currentUser, darkMode, setCurrentUser } = useAppStore();
  
  const [fullName, setFullName] = useState(currentUser?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatar_url || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.full_name || '');
      setAvatarUrl(currentUser.avatar_url || '');
    }
  }, [currentUser]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please upload a valid image file (PNG, JPG, WebP, SVG).' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image file size must be less than 5MB.' });
      return;
    }

    setIsUploading(true);
    setMessage(null);

    try {
      const uploadedUrl = await supabaseService.uploadAvatar(currentUser.id, file);
      setAvatarUrl(uploadedUrl);
      setMessage({ type: 'success', text: 'Avatar uploaded! Click "Save Changes" to apply.' });
    } catch (err: any) {
      console.error('Failed uploading avatar:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to upload image.' });
    } finally {
      setIsUploading(false);
    }
  };

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
            <label className="block text-sm font-medium mb-1.5 opacity-80">Profile Avatar</label>
            <div className="flex items-center gap-4 mb-3">
              <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-accent/40 bg-accent/10 flex items-center justify-center text-xl font-bold text-accent shadow-sm flex-shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile Avatar" className="w-full h-full object-cover" />
                ) : (
                  (fullName || currentUser.email || 'U')[0].toUpperCase()
                )}
                {isUploading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <ICON_MAP.SpinnerIcon className="w-5 h-5 text-white animate-spin" />
                  </div>
                )}
              </div>
              
              <div className="flex-1 space-y-2">
                <label className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-md border cursor-pointer transition-colors ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'}`}>
                  <ICON_MAP.PaperClipIcon className="w-4 h-4 text-accent" />
                  {isUploading ? 'Uploading to Bucket...' : 'Upload Image File'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    className="hidden"
                  />
                </label>
                <p className="text-xs opacity-60">Uploads to Supabase Avatar Bucket (PNG, JPG, SVG up to 5MB).</p>
              </div>
            </div>

            <div className="mt-2">
              <label className="block text-xs font-medium mb-1 opacity-70">Or enter image URL</label>
              <input 
                type="url" 
                value={avatarUrl} 
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/avatar.png"
                className={`w-full px-3 py-2 text-sm rounded-md border focus:ring-2 focus:ring-accent/50 outline-none transition-all ${darkMode ? 'bg-slate-900/50 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
              />
            </div>
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
