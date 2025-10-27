
import React, { useState, useEffect, useRef } from 'react';
// Fix: Corrected typo in useAppStore import path.
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { Button } from '../shared/Button';
import { Avatar } from '../shared/Avatar';

export const Header: React.FC = () => {
  const { 
    darkMode, 
    toggleDarkMode, 
    activeProject, 
    openModal, 
    currentUser, 
    signOut 
  } = useAppStore();

  const [isProfileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);


  const SunIcon = ICON_MAP.SunIcon;
  const MoonIcon = ICON_MAP.MoonIcon;
  const PlusIcon = ICON_MAP.PlusIcon;
  const LogoutIcon = ICON_MAP.LogoutIcon;

  const headerTextColor = darkMode ? 'text-slate-100' : 'text-slate-800'; // Or use --page-foreground
  const subTextColor = darkMode ? 'text-slate-400' : 'text-slate-500';

  const handleLogout = async () => {
    try {
      await signOut();
      setProfileMenuOpen(false);
    } catch (error) {
      console.error("Failed to sign out from header:", error);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileMenuRef.current && 
        !profileMenuRef.current.contains(event.target as Node) &&
        avatarButtonRef.current && 
        !avatarButtonRef.current.contains(event.target as Node)
      ) {
        setProfileMenuOpen(false);
      }
    };
    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileMenuOpen]);

  return (
    <header className="glass-panel rounded-squircle-lg px-6 py-4 relative z-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-semibold text-gradient-accent text-shadow-subtle`}>
            {activeProject ? activeProject.name : 'Dashboard'}
          </h1>
          {activeProject && <p className={`text-sm ${subTextColor}`}>Manage tasks and progress for {activeProject.name}.</p>}
        </div>
        <div className="flex items-center space-x-3 md:space-x-4">
          <Button
            variant="secondary" 
            size="icon"
            onClick={toggleDarkMode}
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            className="text-lg" // Ensure icon size is good
          >
            {darkMode ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
          </Button>
          <Button 
            variant="primary" 
            size="md" 
            onClick={openModal}
            disabled={!activeProject || !currentUser}
            title={!activeProject ? "Select a project to add tasks" : (!currentUser ? "Login to add tasks" : "Add new task")}
          >
            <PlusIcon className="w-5 h-5 mr-1.5" /> 
            Add Task
          </Button>
          
          <div className="relative" ref={profileMenuRef}>
            {currentUser ? (
              <button 
                ref={avatarButtonRef}
                onClick={() => setProfileMenuOpen(prev => !prev)}
                aria-expanded={isProfileMenuOpen}
                aria-haspopup="true"
                className="rounded-full focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 ring-offset-background"
              >
                <Avatar user={currentUser} size="lg" />
              </button>
            ) : (
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${darkMode ? 'bg-slate-700/70 text-slate-400' : 'bg-slate-300/70 text-slate-500'} border ${darkMode ? 'border-slate-600' : 'border-slate-400'}`} title="Not logged in">
                <ICON_MAP.UserCircleIcon className="w-6 h-6" />
              </div>
            )}
            {isProfileMenuOpen && currentUser && (
              <div 
                className={`absolute right-0 mt-2 w-52 rounded-squircle-md shadow-glass-lg py-1 z-30
                           border ${darkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-white/90 border-slate-300'} backdrop-blur-md`}
              >
                <div className={`px-4 py-3 border-b ${darkMode ? 'border-slate-700' : 'border-slate-300'}`}>
                    <p className={`text-sm font-medium truncate ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>{currentUser.full_name || currentUser.email}</p>
                    <p className={`text-xs truncate ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{currentUser.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className={`w-full flex items-center space-x-2 px-4 py-2.5 text-sm 
                             ${darkMode ? 'text-status-error hover:bg-status-error/20' : 'text-status-error hover:bg-status-error/10'} 
                             transition-colors`}
                >
                  <LogoutIcon className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};