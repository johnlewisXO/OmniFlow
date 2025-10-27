import React from 'react';
import { ICON_MAP } from '../../constants';
import { navigateToAppRoute } from '../../utils/navigation';
import { useAppStore } from '../../hooks/useAppStore';

export const LandingHeader: React.FC = () => {
  const SparklesIcon = ICON_MAP.SparklesIcon;
  const SunIcon = ICON_MAP.SunIcon;
  const MoonIcon = ICON_MAP.MoonIcon;

  // Use the global store for a single source of truth
  const { darkMode, toggleDarkMode } = useAppStore();

  const navLinkClasses = "text-slate-300 hover:text-white transition-colors text-sm font-medium px-2 py-1 rounded-md hover:bg-white/5";

  return (
    <header className="fixed top-0 left-0 right-0 z-[60] py-0 bg-transparent">
      <div className="landing-header-container"> 
        <div className="flex justify-between items-center">
          <a href="#" className="flex items-center space-x-2 text-white" aria-label="Omni Flow Home">
            <SparklesIcon className="w-7 h-7 md:w-8 md:h-8 text-neon-accent" />
            <span className="text-xl md:text-2xl font-bold font-display">Omni Flow</span>
          </a>
          <nav className="hidden md:flex items-center space-x-1 sm:space-x-2 md:space-x-3">
            <a href="#features" className={navLinkClasses}>Features</a>
            <a href="#pricing" className={navLinkClasses}>Pricing</a>
            <a href="#faq" className={navLinkClasses}>FAQ</a>
          </nav>
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleDarkMode}
              aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              className={`${navLinkClasses} p-2`} 
              type="button"
            >
              {darkMode ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
            </button>
            <a 
              href="#/app" 
              onClick={navigateToAppRoute}
              className="hero-cta-primary !py-2 !px-5 !text-sm" // Using primary button style from new hero
            >
              Login
            </a>
          </div>
        </div>
      </div>
    </header>
  );
};
