import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../hooks/useAppStore';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full';
  backdropBlur?: boolean;
  variant?: 'center' | 'drawer';
  headerActions?: React.ReactNode;
}

export function useAnimatedMount(isOpen: boolean, durationMs: number = 180) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
    } else if (shouldRender) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
      }, durationMs);
      return () => clearTimeout(timer);
    }
  }, [isOpen, shouldRender, durationMs]);

  return { shouldRender, isClosing };
}

export const AnimatedPopover: React.FC<{
  isOpen: boolean;
  direction?: 'down' | 'up';
  className?: string;
  children: React.ReactNode;
}> = ({ isOpen, direction = 'down', className = '', children }) => {
  const { shouldRender, isClosing } = useAnimatedMount(isOpen, 165);
  if (!shouldRender) return null;

  const animClass =
    direction === 'up'
      ? isClosing
        ? 'animate-popup-up-out'
        : 'animate-popup-up-in'
      : isClosing
      ? 'animate-popup-out'
      : 'animate-popup-in';

  return <div className={`${animClass} ${className}`}>{children}</div>;
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  backdropBlur = true,
  variant = 'center',
  headerActions,
}) => {
  const { darkMode } = useAppStore();
  const { shouldRender, isClosing } = useAnimatedMount(isOpen, 200);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose, isOpen]);

  if (!shouldRender) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    full: 'max-w-[96vw] h-[92vh] flex flex-col',
  };

  const modalContentBg = 'hsl(var(--panel-background))';
  const modalTextColor = darkMode ? 'text-slate-100' : 'text-slate-800';
  const modalBorderColor = 'hsl(var(--panel-border))';
  const isDrawer = variant === 'drawer';

  return (
    <div
      className={`fixed inset-0 z-50 flex ${
        isDrawer ? 'items-stretch justify-end p-0 sm:p-2.5' : 'items-center justify-center p-2 sm:p-4 overflow-y-auto'
      } ${
        backdropBlur ? 'bg-black/35 backdrop-blur-sm' : 'bg-slate-950/20 backdrop-blur-none'
      } transition-opacity duration-200 ${
        isClosing ? 'opacity-0' : 'opacity-100 animate-fadeIn'
      }`}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`shadow-2xl w-full ${
          isDrawer
            ? 'max-w-full sm:max-w-[540px] lg:max-w-[620px] h-full rounded-none sm:rounded-[32px] p-5 sm:p-6 flex flex-col'
            : `${sizeClasses[size]} p-4 sm:p-6 my-auto rounded-[32px] max-h-[95vh] flex flex-col`
        } transform ${modalTextColor} border ${
          isDrawer
            ? isClosing
              ? 'animate-drawer-disappear'
              : 'animate-drawer-appear'
            : isClosing
            ? 'animate-modal-disappear'
            : 'animate-modal-appear'
        }`}
        style={{ backgroundColor: modalContentBg, borderColor: modalBorderColor }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4 flex-shrink-0 pb-3 border-b border-slate-200/70 dark:border-slate-800/80">
          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-lg font-bold text-gradient-accent truncate">{title}</h2>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {headerActions}
            <button
              onClick={onClose}
              className={`${
                darkMode ? 'text-slate-400 hover:text-slate-100' : 'text-slate-500 hover:text-slate-900'
              } transition-colors p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer`}
              aria-label="Close modal"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div
          data-bubble-scroll="true"
          className={`${
            size === 'full' || isDrawer
              ? 'flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y'
              : 'max-h-[75vh] overflow-y-auto overscroll-contain touch-pan-y'
          } scrollbar-thin pr-1 sm:pr-1.5`}
        >
          {children}
        </div>
      </div>
      <style>{`
        @keyframes modal-appear {
          0% {
            opacity: 0;
            transform: scale(0.95) translateY(8px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        @keyframes modal-disappear {
          0% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
          100% {
            opacity: 0;
            transform: scale(0.95) translateY(8px);
          }
        }
        @keyframes drawer-appear {
          0% {
            opacity: 0;
            transform: translateX(36px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes drawer-disappear {
          0% {
            opacity: 1;
            transform: translateX(0);
          }
          100% {
            opacity: 0;
            transform: translateX(36px);
          }
        }
        .animate-modal-appear {
          animation: modal-appear 0.24s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .animate-modal-disappear {
          animation: modal-disappear 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .animate-drawer-appear {
          animation: drawer-appear 0.26s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-drawer-disappear {
          animation: drawer-disappear 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
      `}</style>
    </div>
  );
};
