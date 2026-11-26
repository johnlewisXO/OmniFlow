import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { ICON_MAP } from '../../constants';
import { AmbientIntensity, WORKSPACE_ACCENT_PRESETS, WorkspaceAccentId } from '../../types';
import { computeLiquidGlassTheme } from '../../utils/liquidGlassTheme';
import { GLASS_SPRING } from './LiquidGlass';

interface PaletteEnvironmentSelectorProps {
  compact?: boolean;
  darkMode: boolean;
  accentColor: WorkspaceAccentId;
  onSelectAccent: (id: WorkspaceAccentId) => void;
  ambientIntensity: AmbientIntensity;
  onSelectIntensity: (intensity: AmbientIntensity) => void;
}

const INTENSITY_OPTIONS: Array<{
  id: AmbientIntensity;
  label: string;
  hint: string;
}> = [
  { id: 'subtle', label: 'Subtle', hint: 'Quiet mist' },
  { id: 'balanced', label: 'Balanced', hint: 'Refined depth' },
  { id: 'vivid', label: 'Vivid', hint: 'Rich refraction' },
];

export const PaletteEnvironmentSelector: React.FC<PaletteEnvironmentSelectorProps> = ({
  compact = false,
  darkMode,
  accentColor,
  onSelectAccent,
  ambientIntensity,
  onSelectIntensity,
}) => {
  const previews = useMemo(
    () =>
      WORKSPACE_ACCENT_PRESETS.map(preset => ({
        preset,
        theme: computeLiquidGlassTheme(preset.id, darkMode, ambientIntensity).preview,
      })),
    [darkMode, ambientIntensity]
  );

  const activePreset =
    WORKSPACE_ACCENT_PRESETS.find(p => p.id === accentColor) || WORKSPACE_ACCENT_PRESETS[0];

  return (
    <div className={compact ? 'space-y-2.5' : 'space-y-4'}>
      {/* Section Header */}
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
          <ICON_MAP.SparklesIcon className="w-3 h-3 text-[var(--text-secondary)]" />
          <span>Atmosphere &amp; Glass</span>
        </span>
        <span className="text-[11px] font-semibold text-[var(--text-primary)] truncate">
          {activePreset.name}
        </span>
      </div>

      {/* Live Miniature Environment Previews */}
      <div className={compact ? 'grid grid-cols-4 gap-1.5' : 'grid grid-cols-2 sm:grid-cols-4 gap-3'}>
        {previews.map(({ preset, theme }) => {
          const isSelected = accentColor === preset.id;

          return (
            <motion.button
              key={preset.id}
              type="button"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.96 }}
              transition={GLASS_SPRING.micro}
              onClick={() => onSelectAccent(preset.id)}
              title={`${preset.name} — ${preset.tagline}`}
              aria-label={`Select ${preset.name} visual environment`}
              aria-pressed={isSelected}
              className={`group relative text-left rounded-2xl overflow-hidden transition-[border-color,box-shadow,background-color] duration-200 cursor-pointer border ${
                isSelected
                  ? 'border-[var(--accent)] ring-2 ring-[var(--accent-subtle)] shadow-sm'
                  : 'border-[var(--glass-border)] hover:border-[var(--glass-border-strong)]'
              } ${compact ? 'p-1.5' : 'p-2.5'}`}
              style={{
                backgroundColor: theme.baseHex,
                backgroundImage: `
                  radial-gradient(90% 80% at 6% 8%, ${theme.ambientPrimary} 0%, transparent 72%),
                  radial-gradient(85% 75% at 96% 92%, ${theme.ambientSecondary} 0%, transparent 72%),
                  radial-gradient(65% 60% at 88% 12%, ${theme.ambientTertiary} 0%, transparent 70%)
                `,
              }}
            >
              {/* Miniature Architectural Bezel Corner Hint */}
              <span
                className="absolute top-0 left-0 w-3.5 h-3.5 rounded-br-lg opacity-85 pointer-events-none"
                style={{ backgroundColor: theme.bezelHex }}
                aria-hidden="true"
              />

              {/* Miniature Translucent Glass 2 Card Inside Environment */}
              <div
                className={`relative rounded-xl border transition-transform duration-200 ${
                  compact ? 'p-1.5' : 'p-2.5'
                }`}
                style={{
                  backgroundColor: theme.glassCardBg,
                  borderColor: theme.glassBorder,
                  boxShadow: darkMode
                    ? 'inset 0 1px 1px rgba(255,255,255,0.28), 0 4px 12px -4px rgba(0,0,0,0.45)'
                    : 'inset 0 1.5px 1px rgba(255,255,255,0.94), 0 4px 12px -4px rgba(18,24,34,0.12)',
                }}
              >
                {/* Miniature UI Lines + Accent CTA Indicator */}
                <div className="flex items-center justify-between gap-1.5">
                  <div className="space-y-1 min-w-0 flex-1">
                    <span
                      className="block h-1.5 w-8/12 rounded-full opacity-85"
                      style={{ backgroundColor: theme.textHex }}
                    />
                    {!compact && (
                      <span
                        className="block h-1 w-5/12 rounded-full opacity-35"
                        style={{ backgroundColor: theme.textHex }}
                      />
                    )}
                  </div>
                  <span
                    className={`rounded-full shrink-0 ${compact ? 'w-3 h-1.5' : 'w-4 h-2'}`}
                    style={{ backgroundColor: theme.accentHex }}
                  />
                </div>

                {/* Environment Name & Check */}
                <div className={`flex items-center justify-between gap-1 ${compact ? 'mt-1.5' : 'mt-2.5'}`}>
                  <span
                    className={`font-semibold truncate ${compact ? 'text-[10px]' : 'text-xs'}`}
                    style={{ color: theme.textHex }}
                  >
                    {preset.name}
                  </span>

                  {isSelected && (
                    <span
                      className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: theme.accentHex,
                        color: darkMode ? '#14171A' : '#F8FAFC',
                      }}
                    >
                      <ICON_MAP.CheckIcon className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  )}
                </div>

                {!compact && (
                  <p
                    className="text-[10px] leading-snug mt-0.5 line-clamp-1 opacity-70"
                    style={{ color: theme.textHex }}
                  >
                    {preset.tagline}
                  </p>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Curated 3-Step Ambient Intensity Preference (Subtle | Balanced | Vivid) */}
      <div className={compact ? 'space-y-1' : 'flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1'}>
        <div className="min-w-0">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Ambient Light Intensity
          </span>
          {!compact && (
            <p className="text-[11px] text-[var(--text-secondary)]">
              Balances atmospheric glow behind frosted planes while preserving WCAG readability.
            </p>
          )}
        </div>

        <div
          role="radiogroup"
          aria-label="Ambient light intensity"
          className="relative inline-flex items-center p-0.5 rounded-full bg-[var(--surface-nested-subtle)] border border-[var(--glass-border)] shrink-0"
        >
          {INTENSITY_OPTIONS.map(opt => {
            const active = ambientIntensity === opt.id;
            return (
              <motion.button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={active}
                whileTap={{ scale: 0.96 }}
                transition={GLASS_SPRING.micro}
                onClick={() => onSelectIntensity(opt.id)}
                title={opt.hint}
                className={`relative rounded-full font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  compact ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1 text-[11px]'
                } ${
                  active
                    ? 'text-[var(--text-primary)] font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId={`ambient-intensity-pill-${compact ? 'mini' : 'full'}`}
                    transition={GLASS_SPRING.morph}
                    className="absolute inset-0 rounded-full bg-[var(--accent-subtle)] border border-[var(--accent-border)] shadow-[inset_0_1px_0_var(--glass-highlight)]"
                    aria-hidden="true"
                  />
                )}
                <span className="relative z-10">{opt.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
