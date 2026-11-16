import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { GLASS_SPRING } from './LiquidGlass';
import { Button } from './Button';

export const ConfirmDialogModal: React.FC = () => {
  const { confirmDialog, resolveConfirm } = useAppStore();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!confirmDialog) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const timer = setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const focusTarget = panel.querySelector<HTMLElement>(
        '[data-confirm-cancel="true"], button:not([disabled])'
      );
      focusTarget?.focus();
    }, 20);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        resolveConfirm(false);
        return;
      }
      if (e.key === 'Tab' && panelRef.current) {
        const focusables = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [confirmDialog, resolveConfirm]);

  const tone = confirmDialog?.tone || 'danger';

  const toneBadgeStyles =
    tone === 'danger'
      ? 'bg-rose-500/14 text-rose-600 dark:text-rose-300 border-rose-500/30'
      : tone === 'warning'
      ? 'bg-amber-500/14 text-amber-700 dark:text-amber-300 border-amber-500/30'
      : 'bg-[var(--accent-subtle)] text-[var(--accent)] border-[var(--accent-border)]';

  return (
    <AnimatePresence>
      {confirmDialog && (
        <motion.div
          key={`confirm-backdrop-${confirmDialog.id}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={GLASS_SPRING.scrim}
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/45 backdrop-blur-[8px]"
          onClick={() => resolveConfirm(false)}
        >
          <motion.div
            ref={panelRef}
            key={`confirm-panel-${confirmDialog.id}`}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-description"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={GLASS_SPRING.spatial}
            onClick={e => e.stopPropagation()}
            className="liquid-glass-overlay w-full max-w-md rounded-[24px] p-5 sm:p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-start gap-3.5">
              <div
                className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${toneBadgeStyles}`}
                aria-hidden="true"
              >
                {tone === 'danger' ? (
                  <ICON_MAP.TrashIcon className="w-5 h-5" />
                ) : tone === 'warning' ? (
                  <ICON_MAP.ExclamationIcon className="w-5 h-5" />
                ) : (
                  <ICON_MAP.CheckBadgeIcon className="w-5 h-5" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h2
                  id="confirm-dialog-title"
                  className="text-base font-bold text-[var(--text-primary)] leading-snug"
                >
                  {confirmDialog.title}
                </h2>
                <p
                  id="confirm-dialog-description"
                  className="text-xs sm:text-[13px] text-[var(--text-secondary)] mt-1.5 leading-relaxed"
                >
                  {confirmDialog.message}
                </p>
                {confirmDialog.itemPreview && (
                  <div className="mt-3 px-3 py-2 rounded-xl bg-[var(--surface-nested-subtle)] border border-[var(--border-hairline)] text-xs font-semibold text-[var(--text-primary)] truncate">
                    {confirmDialog.itemPreview}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--border-hairline)]/80">
              <Button
                type="button"
                variant="outline"
                size="md"
                data-confirm-cancel="true"
                onClick={() => resolveConfirm(false)}
              >
                {confirmDialog.cancelLabel || 'Cancel'}
              </Button>
              <Button
                type="button"
                variant={tone === 'danger' ? 'danger' : 'primary'}
                size="md"
                onClick={() => resolveConfirm(true)}
              >
                {confirmDialog.confirmLabel || 'Confirm'}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
