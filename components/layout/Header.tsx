
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
    signOut,
    notifications,
    setActiveView,
    toggleSidebar
  } = useAppStore();

  const [isProfileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);

  const SunIcon = ICON_MAP.SunIcon;
  const MoonIcon = ICON_MAP.MoonIcon;
  const PlusIcon = ICON_MAP.PlusIcon;
  const LogoutIcon = ICON_MAP.LogoutIcon;
  const BellIcon = ICON_MAP.BellIcon;
  const MenuIcon = ICON_MAP.MenuIcon;

  const headerTextColor = darkMode ? 'text-slate-100' : 'text-slate-800'; // Or use --page-foreground
  const subTextColor = darkMode ? 'text-slate-400' : 'text-slate-500';

  const unreadCount = notifications.filter(n => !n.read).length;

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
    <header className="glass-panel rounded-squircle-lg px-3 md:px-6 py-3 md:py-4 relative z-10 flex items-center justify-between">
      <div className="flex items-center gap-2 md:gap-3">
        <button 
          className="md:hidden p-1.5 md:p-2 -ml-1 md:-ml-2 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          onClick={toggleSidebar}
        >
          <MenuIcon className="w-5 h-5 md:w-6 md:h-6" />
        </button>
        <div>
          <h1 className={`text-lg md:text-2xl font-semibold text-gradient-accent text-shadow-subtle truncate max-w-[120px] sm:max-w-xs md:max-w-md`}>
            {activeProject ? activeProject.name : 'Dashboard'}
          </h1>
          {activeProject && <p className={`text-xs md:text-sm ${subTextColor} hidden sm:block`}>Manage tasks and progress for {activeProject.name}.</p>}
        </div>
      </div>
      <div className="flex items-center space-x-1 md:space-x-4">
        <button
          onClick={() => setActiveView('inbox_view')}
          className={`relative p-1.5 md:p-2 rounded-full transition-colors ${darkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-700'}`}
          aria-label="Notifications"
        >
          <BellIcon className="w-4 h-4 md:w-5 md:h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
          )}
        </button>
        <Button
          variant="secondary" 
          size="icon"
          onClick={toggleDarkMode}
          aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          className="text-lg hidden sm:flex" 
        >
          {darkMode ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
        </Button>
        <Button 
          variant="primary" 
          size="md" 
          onClick={() => openModal()}
          disabled={!activeProject || !currentUser}
          title={!activeProject ? "Select a project to add tasks" : (!currentUser ? "Login to add tasks" : "Add new task")}
          className="hidden sm:flex"
        >
          <PlusIcon className="w-5 h-5 mr-1.5" /> 
          Add Task
        </Button>
        <Button 
          variant="primary" 
          size="icon" 
          onClick={() => openModal()}
          disabled={!activeProject || !currentUser}
          title={!activeProject ? "Select a project to add tasks" : (!currentUser ? "Login to add tasks" : "Add new task")}
          className="sm:hidden"
        >
          <PlusIcon className="w-5 h-5" /> 
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
    </header>
  );
};