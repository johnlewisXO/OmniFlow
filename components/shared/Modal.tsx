
import React, { useEffect } from 'react';
import { ICON_MAP } from '../../constants';
// Fix: Corrected typo in useAppStore import path.
import { useAppStore } from '../../hooks/useAppStore'; 

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  const { darkMode } = useAppStore(); 

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };
  
  // Use CSS variables for panel background and border for consistency
  const modalContentBg = 'var(--panel-background)'; 
  const modalTextColor = darkMode ? 'text-slate-100' : 'text-slate-800'; // Or use --page-foreground
  const modalBorderColor = 'var(--panel-border)';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-lg p-4 animate-fadeIn" // Increased overlay blur
      onClick={onClose}
    >
      <div
        className={`shadow-glass-lg w-full ${sizeClasses[size]} p-6 transform transition-all duration-300 ease-out 
                   ${modalTextColor} rounded-squircle-lg border 
                   opacity-0 scale-95 animate-modal-appear`}
        style={{ backgroundColor: modalContentBg, borderColor: modalBorderColor }}
        onClick={(e) => e.stopPropagation()} 
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-xl font-semibold text-gradient-accent`}>{title}</h2>
          <button
            onClick={onClose}
            className={`${darkMode ? 'text-slate-400 hover:text-slate-100' : 'text-slate-500 hover:text-slate-900'} 
                       transition-colors p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10`}
            aria-label="Close modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto scrollbar-thin pr-1.5">
          {children}
        </div>
      </div>
      <style>{`
        @keyframes modal-appear {
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-modal-appear {
          animation: modal-appear 0.3s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
        }
      `}</style>
    </div>
  );
};