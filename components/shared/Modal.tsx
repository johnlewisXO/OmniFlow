import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../../hooks/useAppStore';
import { GLASS_SPRING, GlassPopoverContainer } from './LiquidGlass';
import { IconButton } from './Button';

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
  direction?: 'down' | 'up' | 'right';
  className?: string;
  children: React.ReactNode;
}> = ({ isOpen, direction = 'down', className = '', children }) => {
  return (
    <GlassPopoverContainer isOpen={isOpen} direction={direction} className={className}>
      {children}
    </GlassPopoverContainer>
  );
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
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const focusTimer = setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelector<HTMLElement>(
        'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      focusable?.focus();
    }, 30);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key === 'Tab' && panelRef.current) {
        const focusables = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [onClose, isOpen]);

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

  const modalTextColor = darkMode ? 'text-[#F2F3EE]' : 'text-[#191B17]';
  const isDrawer = variant === 'drawer';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="liquid-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={GLASS_SPRING.scrim}
          className={`fixed inset-0 z-50 flex ${
            isDrawer
              ? 'items-stretch justify-end p-0 sm:p-3'
              : 'items-center justify-center p-2 sm:p-4 overflow-y-auto'
          } ${backdropBlur ? 'bg-black/40 backdrop-blur-[6px]' : 'bg-black/25'}`}
          onClick={onClose}
        >
          <motion.div
            ref={panelRef}
            key="liquid-modal-panel"
            role="dialog"
            aria-modal="true"
            initial={
              isDrawer
                ? { opacity: 0, x: 40, scale: 0.99 }
                : { opacity: 0, scale: 0.95, y: 12 }
            }
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            exit={
              isDrawer
                ? { opacity: 0, x: 32, scale: 0.99 }
                : { opacity: 0, scale: 0.96, y: 8 }
            }
            transition={GLASS_SPRING.spatial}
            className={`liquid-glass-overlay w-full ${
              isDrawer
                ? 'max-w-full sm:max-w-[540px] lg:max-w-[620px] h-full rounded-none sm:rounded-[24px] p-5 sm:p-6 flex flex-col'
                : `${sizeClasses[size]} p-4 sm:p-6 my-auto rounded-[24px] max-h-[95vh] flex flex-col`
            } ${modalTextColor}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4 flex-shrink-0 pb-3 border-b border-[var(--border-hairline)]/80">
              <div className="min-w-0 flex-1">
                <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] truncate">
                  {title}
                </h2>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {headerActions}
                <IconButton
                  variant="glass"
                  size="sm"
                  onClick={onClose}
                  aria-label="Close modal"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="w-4 h-4"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </IconButton>
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
