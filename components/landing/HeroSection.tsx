import React from 'react';
import { navigateToAppRoute } from '../../utils/navigation';

// --- NEW INLINE COMPONENT: TechGlobe ---
const TechGlobe: React.FC = () => (
  <div className="tech-globe-container">
    <div className="globe-shadow"></div>
    <div className="globe-core-wrapper">
      <div className="globe-core">
        <div className="grid-line"></div>
        <div className="grid-line"></div>
        <div className="grid-line"></div>
        <div className="grid-line"></div>
        <div className="grid-line"></div>
        <div className="grid-line"></div>
        <div className="grid-line-horizontal"></div>
        <div className="grid-line-horizontal"></div>
        <div className="grid-line-horizontal"></div>
        <div className="grid-line-horizontal"></div>
      </div>
    </div>
    <div className="orbit-path orbit-path-1"><div className="orbit-satellite"></div></div>
    <div className="orbit-path orbit-path-2"><div className="orbit-satellite"></div></div>
    <div className="orbit-path orbit-path-3"><div className="orbit-satellite"></div></div>
  </div>
);

// --- REWRITTEN HeroSection ---
export const HeroSection: React.FC = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden py-24 md:py-20 font-display">
      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="grid md:grid-cols-2 items-center gap-12 md:gap-16">
          <div className="flex items-center justify-center animate-floatUp" style={{ animationDelay: '300ms' }}>
            <TechGlobe />
          </div>
          <div className="text-center md:text-left">
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-extrabold mb-4 md:mb-5 leading-tight text-shadow-md text-slate-50 animate-floatUp" style={{ animationDelay: '100ms' }}>
              Orchestrate Brilliance.
              <br />
              <span className="text-gradient-neon">AI-Powered Velocity.</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-300 mb-8 md:mb-10 leading-relaxed max-w-xl mx-auto md:mx-0 animate-floatUp" style={{ animationDelay: '200ms' }}>
              Omni Flow is the intelligent project management hub that streamlines workflows, fosters collaboration, and accelerates your team towards their goals with predictive precision.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4 animate-floatUp" style={{ animationDelay: '300ms' }}>
              <a href="#/app" onClick={navigateToAppRoute} className="hero-cta-primary w-full sm:w-auto">
                Get Started Free
              </a>
              <a href="#features" className="hero-cta-secondary w-full sm:w-auto">
                Explore Features
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
