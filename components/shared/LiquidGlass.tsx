import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence, MotionConfig, type Transition } from 'motion/react';

/**
 * Calibrated Spring Physics Tokens
 * - micro: 160–220ms settle for buttons, chips, pills, hover states
 * - snappy: 200–270ms settle for popovers, accordions, context menus, view swaps
 * - spatial: 280–360ms settle for modals, side drawers, command palette, bottom sheets
 * - morph: shared layoutId glides between connected tabs & controls
 */
export const GLASS_SPRING = {
  micro: { type: 'spring', stiffness: 540, damping: 36, mass: 0.65 } as Transition,
  snappy: { type: 'spring', stiffness: 430, damping: 34, mass: 0.8 } as Transition,
  spatial: { type: 'spring', stiffness: 340, damping: 32, mass: 0.9 } as Transition,
  morph: { type: 'spring', stiffness: 470, damping: 36, mass: 0.72 } as Transition,
  collapse: { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const } as Transition,
  viewSwap: { duration: 0.19, ease: [0.22, 1, 0.36, 1] as const } as Transition,
  scrim: { duration: 0.18, ease: [0.22, 1, 0.36, 1] as const } as Transition,
};

/**
 * Root Liquid Glass Environment Wrapper
 * - Configures user reduced-motion preferences globally via MotionConfig.
 * - Updates subtle pointer parallax & specular glint CSS vars (--px, --py, --glint-x, --glint-y)
 *   on the workspace shell in requestAnimationFrame with zero React re-renders.
 */
export const LiquidGlassShell: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  const shellRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const targetRef = useRef({ px: 0, py: 0, gx: 28, gy: 18 });

  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const commit = () => {
      rafRef.current = null;
      const { px, py, gx, gy } = targetRef.current;
      el.style.setProperty('--px', px.toFixed(3));
      el.style.setProperty('--py', py.toFixed(3));
      el.style.setProperty('--glint-x', `${gx.toFixed(1)}%`);
      el.style.setProperty('--glint-y', `${gy.toFixed(1)}%`);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      targetRef.current = {
        px: Math.max(-1, Math.min(1, nx)),
        py: Math.max(-1, Math.min(1, ny)),
        gx: 24 + nx * 18,
        gy: 14 + ny * 12,
      };
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(commit);
      }
    };

    const onPointerLeave = () => {
      targetRef.current = { px: 0, py: 0, gx: 28, gy: 18 };
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(commit);
      }
    };

    el.addEventListener('pointermove', onPointerMove, { passive: true });
    el.addEventListener('pointerleave', onPointerLeave, { passive: true });
    return () => {
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerleave', onPointerLeave);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div ref={shellRef} className={className}>
        {children}
      </div>
    </MotionConfig>
  );
};

export type GlassLayer = 'none' | 'stage' | 'rail' | 'card' | 'subtle' | 'overlay';

const LAYER_CLASS_MAP: Record<GlassLayer, string> = {
  none: '',
  stage: 'frosted-shell-panel',
  rail: 'frosted-rail-panel',
  card: 'liquid-glass-card',
  subtle: 'editorial-surface-subtle',
  overlay: 'liquid-glass-overlay',
};

/**
 * Layered Liquid Glass Container Primitive
 */
export const GlassSurface: React.FC<{
  layer?: GlassLayer;
  interactive?: boolean;
  className?: string;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}> = ({ layer = 'card', interactive = false, className = '', children, onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`${LAYER_CLASS_MAP[layer]} ${interactive ? 'glass-interactive-card' : ''} ${className}`}
    >
      {children}
    </div>
  );
};

/**
 * Tactile Floating Glass Bubble Control
 * Gentle press compression (~0.955), soft specular rim, crisp fast response (<=200ms).
 */
export const GlassBubble: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    active?: boolean;
    pill?: boolean;
    children: React.ReactNode;
  }
> = ({ active = false, pill = true, className = '', children, ...props }) => {
  return (
    <motion.button
      whileTap={props.disabled ? undefined : { scale: 0.955 }}
      transition={GLASS_SPRING.micro}
      className={`glass-bubble-control ${pill ? 'rounded-full' : 'rounded-xl'} ${
        active
          ? '!bg-[var(--accent-subtle)] !text-[var(--text-primary)] !border-[var(--accent-border)] shadow-[inset_0_1px_0_var(--glass-highlight)]'
          : ''
      } ${className}`}
      {...(props as any)}
    >
      {children}
    </motion.button>
  );
};

/**
 * Fluid Spring Expand / Collapse Container
 * Smoothly reveals nested menus, swimlanes, and progressive-disclosure panels.
 */
export const FluidCollapse: React.FC<{
  isOpen: boolean;
  className?: string;
  children: React.ReactNode;
}> = ({ isOpen, className = '', children }) => {
  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0, y: -4 }}
          animate={{ height: 'auto', opacity: 1, y: 0 }}
          exit={{ height: 0, opacity: 0, y: -4 }}
          transition={GLASS_SPRING.collapse}
          className={`overflow-hidden ${className}`}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/**
 * Spring Origin-Aware Popover Container (Dropdowns, Context Menus, Profile Mini Menu)
 */
export const GlassPopoverContainer: React.FC<{
  isOpen: boolean;
  direction?: 'down' | 'up' | 'right';
  className?: string;
  children: React.ReactNode;
}> = ({ isOpen, direction = 'down', className = '', children }) => {
  const initialOffset =
    direction === 'up'
      ? { opacity: 0, scale: 0.95, y: 8 }
      : direction === 'right'
      ? { opacity: 0, scale: 0.95, x: -8 }
      : { opacity: 0, scale: 0.95, y: -8 };

  const originStyle =
    direction === 'up'
      ? 'bottom left'
      : direction === 'right'
      ? 'top left'
      : 'top right';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={initialOffset}
          animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
          exit={initialOffset}
          transition={GLASS_SPRING.snappy}
          style={{ transformOrigin: originStyle }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/**
 * Animated Stage Transition for View / Mode Switches
 * Lightweight compositor fade + micro vertical settle (~190ms) with zero workflow blocking.
 */
export const AnimatedViewStage: React.FC<{
  viewKey: string;
  className?: string;
  children: React.ReactNode;
}> = ({ viewKey, className = '', children }) => {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={viewKey}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -3 }}
        transition={GLASS_SPRING.viewSwap}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

/**
 * Floating Dock Container (Multi-Select Bulk Bar, Contextual Toolbars)
 */
export const FloatingGlassDock: React.FC<{
  isVisible: boolean;
  className?: string;
  children: React.ReactNode;
}> = ({ isVisible, className = '', children }) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 14, scale: 0.96 }}
          transition={GLASS_SPRING.snappy}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
