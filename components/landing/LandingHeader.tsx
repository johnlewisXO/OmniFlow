import React, { useState, useEffect } from 'react';
import { ICON_MAP } from '../../constants';
import { useAppStore } from '../../hooks/useAppStore';

export const LandingHeader: React.FC = () => {
  const { currentUser } = useAppStore();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 16);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navItems = [
    { label: 'Product Studio', href: '#product-studio' },
    { label: 'Capabilities', href: '#capabilities' },
    { label: 'Edge Architecture', href: '#edge-architecture' },
    { label: 'Pricing', href: '#pricing' },
  ];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith('#') && !href.startsWith('#/')) {
      e.preventDefault();
      setMobileMenuOpen(false);
      const target = document.getElementById(href.slice(1));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-[#070A12]/85 backdrop-blur-xl border-b border-white/[0.08] shadow-2xl shadow-black/50'
          : 'bg-transparent border-b border-white/[0.04]'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Brand Identity */}
        <a
          href="#"
          className="flex items-center gap-2.5 whitespace-nowrap shrink-0 group focus:outline-none"
        >
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center shadow-inner">
            <ICON_MAP.SparklesIcon className="w-4 h-4 text-indigo-400 group-hover:text-indigo-300 transition-colors" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-white">
            Omni Flow
          </span>
        </a>

        {/* Zone 2: Primary Navigation (4 single-line links) */}
        <nav className="hidden md:flex items-center gap-8" aria-label="Landing Navigation">
          {navItems.map(item => (
            <a
              key={item.label}
              href={item.href}
              onClick={e => handleNavClick(e, item.href)}
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap py-1"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Zone 3: Primary Action */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          {!currentUser && (
            <a
              href="#/login"
              onClick={() => sessionStorage.setItem('omni_explicit_auth_intent', 'true')}
              className="text-sm font-semibold text-slate-300 hover:text-white transition-colors px-4 py-2 rounded-full hover:bg-white/[0.06] whitespace-nowrap"
            >
              Sign In
            </a>
          )}
          <a
            href={currentUser ? '#/app/overview' : '#/signup'}
            onClick={() => sessionStorage.setItem('omni_explicit_auth_intent', 'true')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-indigo-600/25 border border-indigo-400/30 transition-all whitespace-nowrap"
          >
            <span>{currentUser ? 'Open Workspace' : 'Start Free Workspace'}</span>
            <span aria-hidden="true">→</span>
          </a>
        </div>

        {/* Mobile Menu Trigger (44x44px hitbox) */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(prev => !prev)}
          className="md:hidden w-11 h-11 rounded-full border border-white/10 bg-white/[0.03] flex items-center justify-center text-slate-200 hover:text-white"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? (
            <ICON_MAP.XMarkIcon className="w-5 h-5" />
          ) : (
            <ICON_MAP.MenuIcon className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Mobile Slide-Down Sheet */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#090D18]/95 backdrop-blur-2xl border-b border-white/10 px-4 pt-3 pb-5 space-y-2">
          {navItems.map(item => (
            <a
              key={item.label}
              href={item.href}
              onClick={e => handleNavClick(e, item.href)}
              className="block px-3 py-2.5 rounded-2xl text-sm font-medium text-slate-200 hover:bg-white/5 hover:text-white"
            >
              {item.label}
            </a>
          ))}
          <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
            {!currentUser && (
              <a
                href="#/login"
                onClick={() => sessionStorage.setItem('omni_explicit_auth_intent', 'true')}
                className="w-full py-2.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-center text-sm font-semibold text-white"
              >
                Sign In
              </a>
            )}
            <a
              href={currentUser ? '#/app/overview' : '#/signup'}
              onClick={() => sessionStorage.setItem('omni_explicit_auth_intent', 'true')}
              className="w-full py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-center text-sm font-semibold text-white shadow-lg shadow-indigo-600/25"
            >
              {currentUser ? 'Open Workspace →' : 'Start Free Workspace →'}
            </a>
          </div>
        </div>
      )}
    </header>
  );
};
