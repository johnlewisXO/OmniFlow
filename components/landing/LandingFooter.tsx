import React from 'react';
import { ICON_MAP } from '../../constants';

export const LandingFooter: React.FC = () => {
  return (
    <footer className="bg-[#05080F] border-t border-white/[0.07] py-12 text-slate-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center">
            <ICON_MAP.SparklesIcon className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <span className="font-display text-sm font-bold text-white">Omni Flow</span>
          <span aria-hidden="true">·</span>
          <span>Precision Enterprise Project Intelligence</span>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <a href="#product-studio" className="hover:text-white transition-colors">
            Interactive Studio
          </a>
          <a href="#capabilities" className="hover:text-white transition-colors">
            Capabilities
          </a>
          <a href="#edge-architecture" className="hover:text-white transition-colors">
            Edge Functions
          </a>
          <a href="#pricing" className="hover:text-white transition-colors">
            Pricing
          </a>
          <a
            href="#/signup"
            onClick={() => sessionStorage.setItem('omni_explicit_auth_intent', 'true')}
            className="text-indigo-400 hover:text-indigo-300 font-semibold"
          >
            Launch Workspace →
          </a>
        </div>
      </div>
    </footer>
  );
};
