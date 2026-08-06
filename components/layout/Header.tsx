
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
    currentOrganization,
    signOut,
    notifications,
    setActiveView,
    addToast,
    toggleMobileSidebar
  } = useAppStore();

  const handleAddTaskClick = () => {
    if (!activeProject) {
      addToast('Select a Project Required', 'Please select or create a project from the sidebar to start adding tasks.', 'warning');
      return;
    }
    openModal();
  };

  const [isProfileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);

  const SunIcon = ICON_MAP.SunIcon;
  const MoonIcon = ICON_MAP.MoonIcon;
  const PlusIcon = ICON_MAP.PlusIcon;
  const LogoutIcon = ICON_MAP.LogoutIcon;
  const BellIcon = ICON_MAP.BellIcon;
  const Bars3Icon = ICON_MAP.Bars3Icon;

  const headerTextColor = darkMode ? 'text-slate-100' : 'text-slate-800'; 
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
    <header className="glass-panel rounded-2xl px-3.5 sm:px-5 py-3 relative z-20">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* Mobile Hamburger Button */}
          <button
            onClick={toggleMobileSidebar}
            className={`md:hidden p-2 rounded-xl transition-all ${
              darkMode ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            aria-label="Open sidebar navigation"
          >
            <Bars3Icon className="w-5 h-5" />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="text-base sm:text-lg md:text-xl font-bold text-gradient-accent tracking-tight truncate">
              {activeProject ? activeProject.name : 'Dashboard'}
            </h1>
            {activeProject && (
              <p className={`text-xs ${subTextColor} truncate hidden sm:block`}>
                Manage tasks and progress for {activeProject.name}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-1.5 sm:space-x-3 flex-shrink-0">
          <button
            onClick={() => setActiveView('inbox_view')}
            className={`relative p-2 rounded-full transition-colors ${darkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-700'}`}
            aria-label="Notifications"
          >
            <BellIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
            )}
          </button>

          <Button
            variant="secondary" 
            size="icon"
            onClick={toggleDarkMode}
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            className="w-8 h-8 sm:w-9 sm:h-9"
          >
            {darkMode ? <SunIcon className="w-4 h-4 sm:w-5 sm:h-5" /> : <MoonIcon className="w-4 h-4 sm:w-5 sm:h-5" />}
          </Button>

          <Button 
            variant="primary" 
            size="sm" 
            onClick={handleAddTaskClick}
            disabled={!currentUser}
            title={!activeProject ? "Select a project to add tasks" : (!currentUser ? "Login to add tasks" : "Add new task")}
            className="px-2.5 sm:px-3.5 py-1.5 text-xs sm:text-sm font-medium"
          >
            <PlusIcon className="w-4 h-4 sm:mr-1" /> 
            <span className="hidden sm:inline">Add Task</span>
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
                <Avatar user={currentUser} size="md" />
              </button>
            ) : (
              <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center ${darkMode ? 'bg-slate-700/70 text-slate-400' : 'bg-slate-300/70 text-slate-500'} border ${darkMode ? 'border-slate-600' : 'border-slate-400'}`} title="Not logged in">
                <ICON_MAP.UserCircleIcon className="w-5 h-5" />
              </div>
            )}
            {isProfileMenuOpen && currentUser && (
              <div 
                className={`absolute right-0 mt-2 w-52 rounded-xl shadow-glass-lg py-1 z-30
                           border ${darkMode ? 'bg-slate-800/95 border-slate-700' : 'bg-white/95 border-slate-300'} backdrop-blur-md`}
              >
                <div className={`px-4 py-2.5 border-b ${darkMode ? 'border-slate-700' : 'border-slate-300'}`}>
                    <p className={`text-xs font-semibold truncate ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>{currentUser.full_name || currentUser.email}</p>
                    <p className={`text-[11px] truncate ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{currentUser.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className={`w-full flex items-center space-x-2 px-4 py-2 text-xs font-medium 
                             ${darkMode ? 'text-status-error hover:bg-status-error/20' : 'text-status-error hover:bg-status-error/10'} 
                             transition-colors`}
                >
                  <LogoutIcon className="w-3.5 h-3.5" />
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