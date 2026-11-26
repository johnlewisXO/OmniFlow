import { WorkspaceAccentId } from '../types';

export type AmbientIntensity = 'subtle' | 'balanced' | 'vivid';

export interface OklchColor {
  l: number; // 0..1
  c: number; // 0..0.37
  h: number; // 0..360
}

export interface PaletteEnvironmentDefinition {
  id: WorkspaceAccentId;
  experienceName: string;
  tagline: string;
  /** Primary atmospheric hue & normalized chroma */
  primaryHue: number;
  primaryChroma: number;
  /** Secondary complementary/analogous hue */
  secondaryHue: number;
  secondaryChroma: number;
  /** Tertiary soft highlight hue */
  tertiaryHue: number;
  tertiaryChroma: number;
  /** Neutral canvas subtle tint */
  neutralHue: number;
  neutralChroma: number;
  /** Crisp high-intent interactive accent */
  accentLight: OklchColor;
  accentDark: OklchColor;
  /** Framed architectural bezel */
  bezelLight: OklchColor;
  bezelDark: OklchColor;
  /** Is this a nearly-achromatic monochrome environment */
  isMonochrome?: boolean;
}

export const PALETTE_ENVIRONMENTS: Record<WorkspaceAccentId, PaletteEnvironmentDefinition> = {
  lime: {
    id: 'lime',
    experienceName: 'Aurora',
    tagline: 'Soft sage mist, botanical light & volt lime',
    primaryHue: 122,
    primaryChroma: 0.085,
    secondaryHue: 158,
    secondaryChroma: 0.072,
    tertiaryHue: 96,
    tertiaryChroma: 0.095,
    neutralHue: 112,
    neutralChroma: 0.011,
    accentLight: { l: 0.45, c: 0.115, h: 124 },
    accentDark: { l: 0.87, c: 0.165, h: 118 },
    bezelLight: { l: 0.31, c: 0.018, h: 112 },
    bezelDark: { l: 0.15, c: 0.012, h: 115 },
  },
  cobalt: {
    id: 'cobalt',
    experienceName: 'Ocean',
    tagline: 'Glacier mist, deep marine slate & crisp azure',
    primaryHue: 232,
    primaryChroma: 0.105,
    secondaryHue: 196,
    secondaryChroma: 0.092,
    tertiaryHue: 254,
    tertiaryChroma: 0.08,
    neutralHue: 232,
    neutralChroma: 0.012,
    accentLight: { l: 0.5, c: 0.165, h: 254 },
    accentDark: { l: 0.72, c: 0.145, h: 248 },
    bezelLight: { l: 0.27, c: 0.032, h: 250 },
    bezelDark: { l: 0.14, c: 0.022, h: 252 },
  },
  terracotta: {
    id: 'terracotta',
    experienceName: 'Ember',
    tagline: 'Warm sandstone, desert dusk & burnt amber',
    primaryHue: 42,
    primaryChroma: 0.105,
    secondaryHue: 18,
    secondaryChroma: 0.088,
    tertiaryHue: 66,
    tertiaryChroma: 0.086,
    neutralHue: 52,
    neutralChroma: 0.012,
    accentLight: { l: 0.52, c: 0.155, h: 42 },
    accentDark: { l: 0.75, c: 0.145, h: 48 },
    bezelLight: { l: 0.28, c: 0.028, h: 38 },
    bezelDark: { l: 0.15, c: 0.018, h: 36 },
  },
  emerald: {
    id: 'emerald',
    experienceName: 'Forest',
    tagline: 'Mineral pine canopy, dew mist & jade',
    primaryHue: 162,
    primaryChroma: 0.092,
    secondaryHue: 142,
    secondaryChroma: 0.078,
    tertiaryHue: 184,
    tertiaryChroma: 0.074,
    neutralHue: 158,
    neutralChroma: 0.011,
    accentLight: { l: 0.46, c: 0.125, h: 162 },
    accentDark: { l: 0.76, c: 0.135, h: 160 },
    bezelLight: { l: 0.27, c: 0.03, h: 162 },
    bezelDark: { l: 0.14, c: 0.02, h: 162 },
  },
  plum: {
    id: 'plum',
    experienceName: 'Violet',
    tagline: 'Twilight iris, deep plum haze & soft amethyst',
    primaryHue: 288,
    primaryChroma: 0.105,
    secondaryHue: 256,
    secondaryChroma: 0.095,
    tertiaryHue: 318,
    tertiaryChroma: 0.082,
    neutralHue: 282,
    neutralChroma: 0.012,
    accentLight: { l: 0.49, c: 0.175, h: 284 },
    accentDark: { l: 0.73, c: 0.148, h: 284 },
    bezelLight: { l: 0.26, c: 0.036, h: 285 },
    bezelDark: { l: 0.14, c: 0.024, h: 286 },
  },
  rose: {
    id: 'rose',
    experienceName: 'Sakura',
    tagline: 'Blossom mist, rose quartz & vibrant coral',
    primaryHue: 348,
    primaryChroma: 0.108,
    secondaryHue: 18,
    secondaryChroma: 0.082,
    tertiaryHue: 324,
    tertiaryChroma: 0.088,
    neutralHue: 346,
    neutralChroma: 0.011,
    accentLight: { l: 0.49, c: 0.175, h: 350 },
    accentDark: { l: 0.74, c: 0.155, h: 355 },
    bezelLight: { l: 0.25, c: 0.038, h: 346 },
    bezelDark: { l: 0.14, c: 0.024, h: 346 },
  },
  cyan: {
    id: 'cyan',
    experienceName: 'Glacier',
    tagline: 'Arctic ozone, crystal ice & electric cyan',
    primaryHue: 202,
    primaryChroma: 0.102,
    secondaryHue: 178,
    secondaryChroma: 0.092,
    tertiaryHue: 222,
    tertiaryChroma: 0.078,
    neutralHue: 204,
    neutralChroma: 0.011,
    accentLight: { l: 0.50, c: 0.132, h: 204 },
    accentDark: { l: 0.79, c: 0.132, h: 198 },
    bezelLight: { l: 0.24, c: 0.032, h: 204 },
    bezelDark: { l: 0.13, c: 0.022, h: 206 },
  },
  amber: {
    id: 'amber',
    experienceName: 'Mono',
    tagline: 'Architectural stone, warm graphite & pure glass',
    primaryHue: 78,
    primaryChroma: 0.014,
    secondaryHue: 230,
    secondaryChroma: 0.012,
    tertiaryHue: 95,
    tertiaryChroma: 0.01,
    neutralHue: 82,
    neutralChroma: 0.004,
    accentLight: { l: 0.34, c: 0.016, h: 78 },
    accentDark: { l: 0.86, c: 0.018, h: 82 },
    bezelLight: { l: 0.27, c: 0.008, h: 80 },
    bezelDark: { l: 0.14, c: 0.006, h: 80 },
    isMonochrome: true,
  },
};

export const normalizeAmbientIntensity = (raw?: string | null): AmbientIntensity => {
  if (raw === 'subtle' || raw === 'balanced' || raw === 'vivid') return raw;
  return 'balanced';
};

// --- OKLCH -> Linear sRGB -> sRGB + WCAG Luminance Utilities ---

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

const linearToSrgbChannel = (c: number): number => {
  const clamped = clamp01(c);
  return clamped <= 0.0031308
    ? 12.92 * clamped
    : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
};

const srgbToLinearChannel = (c: number): number => {
  const clamped = clamp01(c);
  return clamped <= 0.04045 ? clamped / 12.92 : Math.pow((clamped + 0.055) / 1.055, 2.4);
};

export interface RgbColor {
  r: number; // 0..255
  g: number; // 0..255
  b: number; // 0..255
}

/**
 * Converts OKLCH to gamut-clamped sRGB (with gentle chroma roll-off if out of sRGB gamut).
 */
export const oklchToRgb = (color: OklchColor): RgbColor => {
  const hRad = (color.h * Math.PI) / 180;
  let chroma = Math.max(0, color.c);
  const L = clamp01(color.l);

  const convert = (cTry: number) => {
    const a = cTry * Math.cos(hRad);
    const b = cTry * Math.sin(hRad);

    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.291485548 * b;

    const l3 = l_ * l_ * l_;
    const m3 = m_ * m_ * m_;
    const s3 = s_ * s_ * s_;

    const rLin = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
    const gLin = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
    const bLin = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;
    return { rLin, gLin, bLin };
  };

  let res = convert(chroma);
  // Gamut preservation via proportional chroma damping (up to 6 steps)
  let step = 0;
  while (
    step < 6 &&
    (res.rLin < -0.002 ||
      res.rLin > 1.002 ||
      res.gLin < -0.002 ||
      res.gLin > 1.002 ||
      res.bLin < -0.002 ||
      res.bLin > 1.002)
  ) {
    chroma *= 0.82;
    res = convert(chroma);
    step++;
  }

  return {
    r: Math.round(linearToSrgbChannel(res.rLin) * 255),
    g: Math.round(linearToSrgbChannel(res.gLin) * 255),
    b: Math.round(linearToSrgbChannel(res.bLin) * 255),
  };
};

export const rgbToHex = ({ r, g, b }: RgbColor): string =>
  `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;

export const rgbToRgba = ({ r, g, b }: RgbColor, alpha: number): string =>
  `rgba(${r}, ${g}, ${b}, ${Number(clamp01(alpha).toFixed(3))})`;

export const relativeLuminance = ({ r, g, b }: RgbColor): number => {
  const rl = srgbToLinearChannel(r / 255);
  const gl = srgbToLinearChannel(g / 255);
  const bl = srgbToLinearChannel(b / 255);
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
};

export const contrastRatio = (fg: RgbColor, bg: RgbColor): number => {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
};

const blendRgb = (fg: RgbColor, bg: RgbColor, alpha: number): RgbColor => {
  const a = clamp01(alpha);
  return {
    r: Math.round(fg.r * a + bg.r * (1 - a)),
    g: Math.round(fg.g * a + bg.g * (1 - a)),
    b: Math.round(fg.b * a + bg.b * (1 - a)),
  };
};

/**
 * Generates adaptive Liquid Glass design tokens via OKLCH palette intelligence
 * and WCAG AA contrast evaluation against the underlying ambient light fields.
 */
export interface ComputedLiquidGlassTheme {
  cssVars: Record<string, string>;
  preview: {
    baseHex: string;
    ambientPrimary: string;
    ambientSecondary: string;
    ambientTertiary: string;
    glassCardBg: string;
    glassBorder: string;
    accentHex: string;
    textHex: string;
    bezelHex: string;
  };
}

export const computeLiquidGlassTheme = (
  paletteId: WorkspaceAccentId,
  darkMode: boolean,
  intensity: AmbientIntensity = 'balanced'
): ComputedLiquidGlassTheme => {
  const env = PALETTE_ENVIRONMENTS[paletteId] || PALETTE_ENVIRONMENTS.lime;

  const intensityMultiplier =
    intensity === 'subtle' ? 0.62 : intensity === 'vivid' ? 1.38 : 1.0;

  // Normalize chroma so vivid mode enriches edge atmosphere without neon bleed
  const chromaScale = env.isMonochrome ? 1 : intensityMultiplier;
  const alphaScale =
    intensity === 'subtle' ? 0.7 : intensity === 'vivid' ? 1.24 : 1.0;

  // Neutral Base Canvas (60-75% visual dominance; restrained chroma < 0.015)
  const surfaceBaseOklch: OklchColor = darkMode
    ? { l: 0.145, c: Math.min(0.012, env.neutralChroma), h: env.neutralHue }
    : { l: 0.968, c: Math.min(0.01, env.neutralChroma), h: env.neutralHue };
  const surfaceBaseRgb = oklchToRgb(surfaceBaseOklch);

  // Subtle ambient mesh base slightly warmer/cooler than neutral content plane
  const meshBaseRgb = oklchToRgb(
    darkMode
      ? { l: 0.135, c: Math.min(0.018, env.neutralChroma * 1.35), h: env.neutralHue }
      : { l: 0.955, c: Math.min(0.014, env.neutralChroma * 1.3), h: env.neutralHue }
  );

  // Harmonious OKLCH Atmospheric Light Fields (15-28% primary/secondary, 10-20% tertiary)
  const ambPrimaryRgb = oklchToRgb({
    l: darkMode ? 0.49 : 0.81,
    c: Math.min(0.15, env.primaryChroma * chromaScale),
    h: env.primaryHue,
  });
  const ambSecondaryRgb = oklchToRgb({
    l: darkMode ? 0.46 : 0.84,
    c: Math.min(0.135, env.secondaryChroma * chromaScale),
    h: env.secondaryHue,
  });
  const ambTertiaryRgb = oklchToRgb({
    l: darkMode ? 0.50 : 0.87,
    c: Math.min(0.12, env.tertiaryChroma * chromaScale),
    h: env.tertiaryHue,
  });

  const primaryAlpha = clamp01((darkMode ? 0.27 : 0.3) * alphaScale);
  const secondaryAlpha = clamp01((darkMode ? 0.25 : 0.24) * alphaScale);
  const tertiaryAlpha = clamp01((darkMode ? 0.18 : 0.21) * alphaScale);

  // Estimate worst-case bright/saturated edge backdrop beneath glass for contrast controller
  const worstCaseBackdrop = blendRgb(ambPrimaryRgb, meshBaseRgb, primaryAlpha);
  const backdropLum = relativeLuminance(worstCaseBackdrop);

  // Crisp neutral foreground ink hierarchy (never #000 or #FFF, never derived from ambient hue)
  const textPrimaryRgb: RgbColor = darkMode ? { r: 239, g: 242, b: 247 } : { r: 22, g: 25, b: 29 };
  const textSecondaryRgb: RgbColor = darkMode ? { r: 167, g: 175, b: 188 } : { r: 82, g: 90, b: 100 };
  const textMutedRgb: RgbColor = darkMode ? { r: 121, g: 130, b: 145 } : { r: 112, g: 120, b: 132 };
  const textDisabledRgb: RgbColor = darkMode ? { r: 78, g: 85, b: 96 } : { r: 170, g: 176, b: 184 };

  // Adaptive Glass Controller:
  // Light theme glass stays within rgba(255,255,255, 0.42–0.68)
  // Dark theme glass stays within rgba(12,16,24, 0.42–0.70)
  const glassTintBase: RgbColor = darkMode ? { r: 12, g: 16, b: 24 } : { r: 255, g: 255, b: 255 };

  // Solve minimum opacity required on Glass 2 cards to keep body text >= 4.5:1 over worst-case ambient field
  let adaptiveBaseAlpha = darkMode ? 0.52 : 0.54;
  if (!darkMode && backdropLum < 0.72) {
    // Darker or richer light-mode edge mesh -> slightly raise glass opacity toward 0.62
    adaptiveBaseAlpha += 0.06;
  }
  if (darkMode && backdropLum > 0.11) {
    // Brighter dark-mode ambient glow -> raise obsidian glass opacity to preserve crisp text
    adaptiveBaseAlpha += 0.08;
  }
  if (intensity === 'vivid') {
    adaptiveBaseAlpha += 0.05;
  } else if (intensity === 'subtle') {
    adaptiveBaseAlpha -= 0.04;
  }

  // Enforce strict WCAG AA (4.5:1) loop on the Glass 2 card plane
  let glass2Alpha = Math.max(0.46, Math.min(darkMode ? 0.66 : 0.64, adaptiveBaseAlpha));
  for (let i = 0; i < 6; i++) {
    const composite = blendRgb(glassTintBase, worstCaseBackdrop, glass2Alpha);
    if (contrastRatio(textPrimaryRgb, composite) >= 4.7 && contrastRatio(textSecondaryRgb, composite) >= 4.5) {
      break;
    }
    glass2Alpha = Math.min(darkMode ? 0.7 : 0.68, glass2Alpha + 0.03);
  }

  const glass1Alpha = Math.max(0.42, Math.min(darkMode ? 0.58 : 0.54, glass2Alpha - 0.08));
  const glass3Alpha = Math.min(darkMode ? 0.68 : 0.66, glass2Alpha + 0.06);
  const glass4Alpha = Math.min(darkMode ? 0.74 : 0.72, glass2Alpha + 0.12);

  // Subtle 3D liquid bubble rim & highlight brightness tuned to backdrop luminance + palette
  const borderMix = blendRgb(
    darkMode ? { r: 255, g: 255, b: 255 } : { r: 24, g: 28, b: 36 },
    ambPrimaryRgb,
    0.84
  );
  const glassBorderAlpha = darkMode ? 0.055 : 0.065;
  const glassHighlightAlpha = darkMode ? 0.075 : 0.62;

  // Accent system
  const accentRgb = oklchToRgb(darkMode ? env.accentDark : env.accentLight);
  const accentHoverRgb = oklchToRgb(
    darkMode
      ? { l: Math.min(0.92, env.accentDark.l + 0.05), c: env.accentDark.c, h: env.accentDark.h }
      : { l: Math.max(0.28, env.accentLight.l - 0.06), c: env.accentLight.c, h: env.accentLight.h }
  );
  // Subtle translucent accent wash for selected navigation & focus halos
  const accentSubtleAlpha = darkMode ? 0.16 : 0.11;
  const accentBorderAlpha = darkMode ? 0.28 : 0.22;
  const accentInkRgb: RgbColor =
    relativeLuminance(accentRgb) > 0.36 ? { r: 20, g: 23, b: 26 } : { r: 248, g: 250, b: 252 };

  // Accessible accent text on neutral glass
  let accentTextOklch: OklchColor = darkMode
    ? { l: Math.max(0.76, env.accentDark.l), c: env.isMonochrome ? 0.02 : Math.min(0.15, env.accentDark.c), h: env.accentDark.h }
    : { l: Math.min(0.43, env.accentLight.l), c: env.isMonochrome ? 0.02 : Math.min(0.15, env.accentLight.c), h: env.accentLight.h };
  const accentTextRgb = oklchToRgb(accentTextOklch);

  // Bezel & CTA alignment
  const bezelRgb = oklchToRgb(darkMode ? env.bezelDark : env.bezelLight);
  const bezelInnerRgb = oklchToRgb(
    darkMode
      ? { l: env.bezelDark.l + 0.08, c: env.bezelDark.c, h: env.bezelDark.h }
      : { l: env.bezelLight.l + 0.09, c: env.bezelLight.c, h: env.bezelLight.h }
  );

  // Vibrant highlight token for small telemetry/CTA lime dots
  const limeHighlightRgb = oklchToRgb(
    env.isMonochrome
      ? darkMode
        ? { l: 0.88, c: 0.015, h: 82 }
        : { l: 0.82, c: 0.04, h: 82 }
      : darkMode
      ? { l: 0.84, c: Math.min(0.16, env.primaryChroma * 1.4), h: env.accentDark.h }
      : { l: 0.83, c: Math.min(0.16, env.primaryChroma * 1.5), h: env.accentLight.h }
  );
  const limeInkRgb: RgbColor =
    relativeLuminance(limeHighlightRgb) > 0.38 ? { r: 20, g: 23, b: 26 } : { r: 248, g: 250, b: 252 };

  // Heatmap scale (4 restrained perceptual steps)
  const heat1 = rgbToHex(
    oklchToRgb(
      darkMode
        ? { l: 0.26, c: env.isMonochrome ? 0.008 : 0.035, h: env.primaryHue }
        : { l: 0.9, c: env.isMonochrome ? 0.008 : 0.032, h: env.primaryHue }
    )
  );
  const heat2 = rgbToHex(
    oklchToRgb(
      darkMode
        ? { l: 0.44, c: env.isMonochrome ? 0.012 : 0.075, h: env.primaryHue }
        : { l: 0.76, c: env.isMonochrome ? 0.012 : 0.072, h: env.primaryHue }
    )
  );
  const heat3 = rgbToHex(
    oklchToRgb(
      darkMode
        ? { l: 0.68, c: env.isMonochrome ? 0.016 : 0.125, h: env.primaryHue }
        : { l: 0.62, c: env.isMonochrome ? 0.016 : 0.115, h: env.primaryHue }
    )
  );
  const heat4 = rgbToHex(
    oklchToRgb(
      darkMode
        ? { l: 0.86, c: env.isMonochrome ? 0.012 : 0.135, h: env.primaryHue }
        : { l: 0.34, c: env.isMonochrome ? 0.012 : 0.095, h: env.primaryHue }
    )
  );

  // Subtle hairline neutrals derived from surface base
  const subtleSurfaceRgb = oklchToRgb(
    darkMode
      ? { l: 0.195, c: Math.min(0.012, env.neutralChroma), h: env.neutralHue }
      : { l: 0.985, c: Math.min(0.006, env.neutralChroma), h: env.neutralHue }
  );
  const sageSurfaceRgb = oklchToRgb(
    darkMode
      ? { l: 0.225, c: Math.min(0.018, env.neutralChroma * 1.4), h: env.neutralHue }
      : { l: 0.935, c: Math.min(0.014, env.neutralChroma * 1.3), h: env.neutralHue }
  );

  const surfaceBaseHex = rgbToHex(surfaceBaseRgb);
  const accentHex = rgbToHex(accentRgb);

  const cssVars: Record<string, string> = {
    // 1. Ambient Atmosphere Tokens
    '--ambient-primary': rgbToRgba(ambPrimaryRgb, primaryAlpha),
    '--ambient-secondary': rgbToRgba(ambSecondaryRgb, secondaryAlpha),
    '--ambient-tertiary': rgbToRgba(ambTertiaryRgb, tertiaryAlpha),
    '--ambient-glow-soft': rgbToRgba(ambPrimaryRgb, primaryAlpha * 0.45),

    // 2. Semantic Glass Depth Planes
    '--surface-base': surfaceBaseHex,
    '--surface-stage': darkMode ? 'rgba(12, 16, 24, 0.22)' : 'rgba(255, 255, 255, 0.26)',
    '--surface-glass-1': rgbToRgba(glassTintBase, glass1Alpha),
    '--surface-glass-2': rgbToRgba(glassTintBase, glass2Alpha),
    '--surface-glass-3': rgbToRgba(glassTintBase, glass3Alpha),
    '--surface-glass-4': rgbToRgba(glassTintBase, glass4Alpha),
    '--surface-popover': darkMode ? 'rgba(14, 18, 28, 0.82)' : 'rgba(255, 255, 255, 0.80)',
    '--surface-input': darkMode ? 'rgba(18, 23, 33, 0.72)' : 'rgba(255, 255, 255, 0.76)',
    '--surface-nested-subtle': darkMode ? 'rgba(255, 255, 255, 0.035)' : 'rgba(255, 255, 255, 0.36)',
    '--bezel-edge': darkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(18, 24, 34, 0.08)',

    // 3. Global Top-Left 3D Liquid Water-Bubble Lighting Model (Glossy Specular Rim, Fresnel Glow & Caustic Bounce)
    '--glass-border': rgbToRgba(borderMix, darkMode ? 0.14 : 0.11),
    '--glass-border-strong': rgbToRgba(borderMix, darkMode ? 0.22 : 0.18),
    '--glass-highlight': darkMode ? 'rgba(255, 255, 255, 0.26)' : 'rgba(255, 255, 255, 0.92)',
    '--glass-bubble-outer': darkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.56)',
    '--glass-bubble-glow': darkMode ? 'rgba(255, 255, 255, 0.20)' : 'rgba(255, 255, 255, 0.88)',
    '--glass-bubble-depth': darkMode ? 'rgba(0, 0, 0, 0.34)' : 'rgba(18, 24, 34, 0.06)',
    '--glass-shadow': darkMode
      ? '4px 16px 38px -12px rgba(0, 0, 0, 0.58)'
      : '4px 12px 30px -12px rgba(18, 24, 34, 0.11)',
    '--glass-shadow-elevated': darkMode
      ? '8px 28px 64px -14px rgba(0, 0, 0, 0.78)'
      : '8px 24px 56px -14px rgba(18, 24, 34, 0.22)',

    // 4. Crisp 4-Level Neutral Typography Hierarchy
    '--text-primary': rgbToHex(textPrimaryRgb),
    '--text-secondary': rgbToHex(textSecondaryRgb),
    '--text-muted': rgbToHex(textMutedRgb),
    '--text-disabled': rgbToHex(textDisabledRgb),

    // 5. Palette Accent System (Actions & Selected States Only)
    '--accent': accentHex,
    '--accent-hover': rgbToHex(accentHoverRgb),
    '--accent-subtle': rgbToRgba(accentRgb, accentSubtleAlpha),
    '--accent-border': rgbToRgba(accentRgb, accentBorderAlpha),
    '--accent-ink': rgbToHex(limeInkRgb),

    // 6. Semantic Status Tokens
    '--success': darkMode ? '#34D399' : '#15803D',
    '--warning': darkMode ? '#FBBF24' : '#B45309',
    '--danger': darkMode ? '#FB7185' : '#BE123C',
    '--info': darkMode ? '#38BDF8' : '#0369A1',

    // 7. Compatibility Aliases across all 30+ existing views & Recharts
    '--bg-bezel': rgbToHex(bezelRgb),
    '--bg-bezel-inner': rgbToHex(bezelInnerRgb),
    '--bg-canvas': surfaceBaseHex,
    '--bg-surface': rgbToHex(
      darkMode ? { r: 22, g: 27, b: 37 } : { r: 253, g: 254, b: 255 }
    ),
    '--bg-surface-subtle': rgbToHex(subtleSurfaceRgb),
    '--bg-sage': rgbToHex(sageSurfaceRgb),
    '--bg-sage-hover': rgbToHex(
      blendRgb(sageSurfaceRgb, accentRgb, 0.08)
    ),
    '--border-hairline': darkMode ? 'rgba(255, 255, 255, 0.055)' : 'rgba(18, 24, 34, 0.06)',
    '--border-strong': darkMode ? 'rgba(255, 255, 255, 0.11)' : 'rgba(18, 24, 34, 0.11)',

    '--accent-lime': rgbToHex(limeHighlightRgb),
    '--accent-lime-hover': rgbToHex(
      blendRgb(limeHighlightRgb, { r: 255, g: 255, b: 255 }, darkMode ? 0.12 : 0.08)
    ),
    '--accent-cta': accentHex,
    '--accent-cta-hover': rgbToHex(accentHoverRgb),
    '--accent-cta-ink': rgbToHex(accentInkRgb),
    '--accent-text': rgbToHex(accentTextRgb),

    '--mesh-base': rgbToHex(meshBaseRgb),
    '--mesh-1': rgbToRgba(ambPrimaryRgb, primaryAlpha),
    '--mesh-2': rgbToRgba(ambSecondaryRgb, secondaryAlpha),
    '--mesh-3': rgbToRgba(ambTertiaryRgb, tertiaryAlpha),
    '--mesh-4': rgbToRgba(ambSecondaryRgb, secondaryAlpha * 0.72),
    '--mesh-center': darkMode
      ? 'rgba(15, 19, 27, 0.56)'
      : 'rgba(255, 255, 255, 0.62)',

    '--heat-1': heat1,
    '--heat-2': heat2,
    '--heat-3': heat3,
    '--heat-4': heat4,
    '--chart-sage': rgbToHex(accentTextRgb),

    '--primary-rgb': `${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}`,
    '--accent-hex': accentHex,
    '--accent-gradient-start': rgbToHex(ambPrimaryRgb),
    '--accent-gradient-end': accentHex,
  };

  return {
    cssVars,
    preview: {
      baseHex: rgbToHex(meshBaseRgb),
      ambientPrimary: rgbToRgba(ambPrimaryRgb, clamp01(primaryAlpha * 1.45)),
      ambientSecondary: rgbToRgba(ambSecondaryRgb, clamp01(secondaryAlpha * 1.45)),
      ambientTertiary: rgbToRgba(ambTertiaryRgb, clamp01(tertiaryAlpha * 1.3)),
      glassCardBg: rgbToRgba(glassTintBase, glass2Alpha),
      glassBorder: rgbToRgba(borderMix, darkMode ? 0.2 : 0.16),
      accentHex,
      textHex: rgbToHex(textPrimaryRgb),
      bezelHex: rgbToHex(bezelRgb),
    },
  };
};

export const applyLiquidGlassThemeTokens = (
  paletteId: WorkspaceAccentId,
  darkMode: boolean,
  intensity: AmbientIntensity = 'balanced'
): ComputedLiquidGlassTheme => {
  const computed = computeLiquidGlassTheme(paletteId, darkMode, intensity);
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.dataset.accent = paletteId;
    root.dataset.ambientIntensity = intensity;
    Object.entries(computed.cssVars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }
  return computed;
};
