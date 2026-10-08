import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { ActiveView } from '../../types';
import { useAnimatedMount } from '../shared/Modal';

export type AIBotMood = 'idle' | 'thinking' | 'speaking' | 'happy' | 'guiding';

interface AIBotFaceProps {
  mood?: AIBotMood;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  interactive?: boolean;
}

const isSameRect = (a: DOMRect | null, b: DOMRect | null): boolean => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    Math.abs(a.top - b.top) < 1 &&
    Math.abs(a.left - b.left) < 1 &&
    Math.abs(a.width - b.width) < 1 &&
    Math.abs(a.height - b.height) < 1
  );
};

export const AIBotFace: React.FC<AIBotFaceProps> = ({
  mood = 'idle',
  size = 'md',
  className = '',
  interactive = true,
}) => {
  const [isBlinking, setIsBlinking] = useState(false);
  const [glanceOffset, setGlanceOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 150);
    }, 3800);

    const glanceInterval = setInterval(() => {
      if (mood === 'thinking') {
        setGlanceOffset({ x: 0, y: -1.5 });
      } else {
        const offsets = [
          { x: 0, y: 0 },
          { x: 1.5, y: -0.5 },
          { x: -1.5, y: 0 },
          { x: 0, y: 1 },
          { x: 0, y: 0 },
        ];
        setGlanceOffset(offsets[Math.floor(Math.random() * offsets.length)]);
      }
    }, 2600);

    return () => {
      clearInterval(blinkInterval);
      clearInterval(glanceInterval);
    };
  }, [mood]);

  const sizeMap = {
    xs: 'w-5 h-5',
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-2xl select-none transition-transform duration-300 ${
        interactive ? 'group-hover:scale-105' : ''
      } ${sizeMap[size]} ${className}`}
    >
      {/* Subtle ambient aura */}
      <span
        className={`absolute inset-0 rounded-2xl transition-opacity duration-500 ${
          mood === 'thinking'
            ? 'bg-indigo-500/40 animate-ping opacity-75'
            : mood === 'speaking' || mood === 'guiding'
            ? 'bg-indigo-400/30 animate-pulse opacity-90'
            : 'bg-indigo-500/15 opacity-60'
        }`}
      />

      {/* Minimalist Liquid-Glass Bot Head SVG */}
      <svg
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`relative z-10 w-full h-full drop-shadow-xs ${
          mood === 'thinking' ? 'animate-pulse' : 'ai-bot-breathe'
        }`}
      >
        <defs>
          <linearGradient id="omniBotShell" x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6366F1" />
            <stop offset="55%" stopColor="#4F46E5" />
            <stop offset="100%" stopColor="#312E81" />
          </linearGradient>
          <linearGradient id="omniBotVisor" x1="8" y1="11" x2="32" y2="29" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0F172A" />
            <stop offset="100%" stopColor="#1E1B4B" />
          </linearGradient>
          <linearGradient id="omniBotEyeGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#A5F3FC" />
            <stop offset="100%" stopColor="#818CF8" />
          </linearGradient>
        </defs>

        {/* Top Antenna Node */}
        <line x1="20" y1="2.5" x2="20" y2="6.5" stroke="#818CF8" strokeWidth="1.8" strokeLinecap="round" />
        <circle
          cx="20"
          cy="2.5"
          r="2"
          fill={mood === 'thinking' ? '#FBBF24' : '#38BDF8'}
        />

        {/* Outer Squircle Head */}
        <rect
          x="5"
          y="6.5"
          width="30"
          height="27"
          rx="10"
          fill="url(#omniBotShell)"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="1.2"
        />

        {/* Side Acoustic Ear Pads */}
        <rect x="2.5" y="15" width="2.5" height="9" rx="1.25" fill="#818CF8" />
        <rect x="35" y="15" width="2.5" height="9" rx="1.25" fill="#818CF8" />

        {/* Inner Glass Visor */}
        <rect
          x="8.5"
          y="10.5"
          width="23"
          height="19"
          rx="6.5"
          fill="url(#omniBotVisor)"
          stroke="rgba(165, 243, 252, 0.25)"
          strokeWidth="0.9"
        />

        {/* Visor Top Reflection */}
        <path
          d="M11 12.5H29"
          stroke="rgba(255,255,255,0.16)"
          strokeWidth="1"
          strokeLinecap="round"
        />

        {/* Expressive Eyes */}
        <g
          style={{
            transform: `translate(${glanceOffset.x}px, ${glanceOffset.y}px)`,
            transition: 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          {isBlinking ? (
            <>
              <path d="M12.5 18.5H17.5" stroke="#67E8F9" strokeWidth="2" strokeLinecap="round" />
              <path d="M22.5 18.5H27.5" stroke="#67E8F9" strokeWidth="2" strokeLinecap="round" />
            </>
          ) : mood === 'happy' ? (
            <>
              <path
                d="M12.5 19.5C13.3 17.5 16.7 17.5 17.5 19.5"
                stroke="#67E8F9"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M22.5 19.5C23.3 17.5 26.7 17.5 27.5 19.5"
                stroke="#67E8F9"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </>
          ) : (
            <>
              <rect x="13" y="15.5" width="4.2" height="5.5" rx="2.1" fill="url(#omniBotEyeGlow)" />
              <rect x="22.8" y="15.5" width="4.2" height="5.5" rx="2.1" fill="url(#omniBotEyeGlow)" />
              <circle cx="14.4" cy="17.1" r="0.8" fill="#FFFFFF" />
              <circle cx="24.2" cy="17.1" r="0.8" fill="#FFFFFF" />
            </>
          )}

          {/* Expressive Mouth / Voice Bar */}
          {mood === 'thinking' ? (
            <g>
              <circle cx="17" cy="24.5" r="1" fill="#FBBF24" />
              <circle cx="20" cy="24.5" r="1" fill="#67E8F9" />
              <circle cx="23" cy="24.5" r="1" fill="#818CF8" />
            </g>
          ) : mood === 'speaking' || mood === 'guiding' ? (
            <rect x="16" y="23.5" width="8" height="2.4" rx="1.2" fill="#67E8F9" />
          ) : (
            <path
              d="M16.5 24C17.8 25.4 22.2 25.4 23.5 24"
              stroke="#67E8F9"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          )}
        </g>
      </svg>
    </div>
  );
};

interface AuthGuideStep {
  targetSelector: string;
  inputId?: string;
  title: string;
  tip: string;
}

interface AIGuidedAuthAssistantProps {
  mode: 'login' | 'signup' | 'reset';
  onSwitchMode: (mode: 'login' | 'signup' | 'reset') => void;
  emailValue?: string;
}

export const AIGuidedAuthAssistant: React.FC<AIGuidedAuthAssistantProps> = ({
  mode,
  onSwitchMode,
  emailValue = '',
}) => {
  const [stepIdx, setStepIdx] = useState(0);
  const [isSpatialGuideActive, setIsSpatialGuideActive] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const guideSteps: AuthGuideStep[] = useMemo(() => {
    if (mode === 'signup') {
      return [
        {
          targetSelector: '[data-auth-tour-id="auth-fullname"]',
          inputId: 'full-name',
          title: 'Step 1 · Your Full Name',
          tip: 'Enter your display name so teammates and live presence cursors can identify you across boards.',
        },
        {
          targetSelector: '[data-auth-tour-id="auth-email"]',
          inputId: 'email',
          title: 'Step 2 · Work Email & E2EE Identity',
          tip: 'Use your work email. Omni Flow automatically binds your AES-256-GCM direct messaging keypair.',
        },
        {
          targetSelector: '[data-auth-tour-id="auth-password"]',
          inputId: 'password',
          title: 'Step 3 · Security Password',
          tip: 'Create a strong password (minimum 6 characters) to protect your workspace credentials.',
        },
        {
          targetSelector: '[data-auth-tour-id="auth-submit"]',
          title: 'Step 4 · Launch Workspace',
          tip: 'Click Create Account (or Continue with Google) to provision your organization.',
        },
      ];
    }
    if (mode === 'reset') {
      return [
        {
          targetSelector: '[data-auth-tour-id="auth-email"]',
          inputId: 'email',
          title: 'Account Recovery Email',
          tip: 'Enter your registered email address and click Send Password Reset Link to receive a recovery token.',
        },
      ];
    }
    return [
      {
        targetSelector: '[data-auth-tour-id="auth-email"]',
        inputId: 'email',
        title: 'Step 1 · Work Email or Google SSO',
        tip: emailValue
          ? `Signing in as ${emailValue}. Continue to your password below.`
          : 'Enter your registered email address or use 1-click Google SSO below.',
      },
      {
        targetSelector: '[data-auth-tour-id="auth-password"]',
        inputId: 'password',
        title: 'Step 2 · Account Password',
        tip: 'Enter your password to unlock your live projects, sprints, and E2EE channels.',
      },
      {
        targetSelector: '[data-auth-tour-id="auth-submit"]',
        title: 'Step 3 · Resume Workspace',
        tip: 'Click Sign In to enter your role-adaptive dashboard immediately.',
      },
      {
        targetSelector: '[data-auth-tour-id="auth-switch"]',
        title: 'New to Omni Flow?',
        tip: 'Click Sign Up below if you need to create a new account or organization.',
      },
    ];
  }, [mode, emailValue]);

  useEffect(() => {
    setStepIdx(0);
  }, [mode]);

  const currentTip = guideSteps[stepIdx % guideSteps.length] || guideSteps[0];
  const activeSelector = currentTip?.targetSelector || '';

  const updateAuthTargetRect = useCallback(() => {
    if (!isSpatialGuideActive || !activeSelector) {
      setTargetRect(prev => (prev === null ? prev : null));
      return;
    }
    const el = document.querySelector(activeSelector);
    if (el) {
      const nextRect = el.getBoundingClientRect();
      setTargetRect(prev => (isSameRect(prev, nextRect) ? prev : nextRect));
    } else {
      setTargetRect(prev => (prev === null ? prev : null));
    }
  }, [isSpatialGuideActive, activeSelector]);

  useEffect(() => {
    updateAuthTargetRect();
    if (!isSpatialGuideActive) return;
    window.addEventListener('resize', updateAuthTargetRect);
    window.addEventListener('scroll', updateAuthTargetRect, true);
    return () => {
      window.removeEventListener('resize', updateAuthTargetRect);
      window.removeEventListener('scroll', updateAuthTargetRect, true);
    };
  }, [isSpatialGuideActive, updateAuthTargetRect]);

  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || !target.id) return;
      const idx = guideSteps.findIndex(s => s.inputId && target.id === s.inputId);
      if (idx !== -1) {
        setStepIdx(prev => (prev === idx ? prev : idx));
      }
    };
    window.addEventListener('focusin', handleFocusIn);
    return () => window.removeEventListener('focusin', handleFocusIn);
  }, [guideSteps]);

  const focusStepField = (step: AuthGuideStep) => {
    if (step.inputId) {
      const inputEl = document.getElementById(step.inputId) as HTMLInputElement | null;
      inputEl?.focus();
    }
  };

  const getFloatingBotStyle = (): React.CSSProperties => {
    if (!targetRect || typeof window === 'undefined') {
      return { top: 24, right: 24 };
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cardWidth = 290;
    let left = targetRect.right + 18;
    let top = targetRect.top - 8;

    if (left + cardWidth > vw - 16) {
      left = Math.max(16, Math.min(vw - cardWidth - 16, targetRect.left));
      top = Math.max(16, targetRect.top - 125);
    }
    top = Math.max(16, Math.min(vh - 150, top));

    return {
      position: 'fixed',
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
      width: `${cardWidth}px`,
      transition: 'top 0.48s cubic-bezier(0.22, 1, 0.36, 1), left 0.48s cubic-bezier(0.22, 1, 0.36, 1)',
    };
  };

  return (
    <>
      <div className="mb-4 p-3 rounded-2xl bg-indigo-500/8 border border-indigo-500/20 transition-all duration-300">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <AIBotFace mood="guiding" size="sm" className="flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-300 truncate">
                {currentTip.title}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                {currentTip.tip}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = !isSpatialGuideActive;
              setIsSpatialGuideActive(next);
              if (next) {
                focusStepField(currentTip);
              }
            }}
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
              isSpatialGuideActive
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-600 dark:text-indigo-300'
            }`}
          >
            {isSpatialGuideActive ? 'Stop Guide' : 'Guide Me Live'}
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-indigo-500/15 text-[11px]">
          <div className="flex items-center gap-1.5">
            {guideSteps.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setStepIdx(idx);
                  focusStepField(guideSteps[idx]);
                }}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  idx === stepIdx % guideSteps.length
                    ? 'w-5 bg-indigo-500'
                    : 'w-2 bg-slate-300 dark:bg-slate-700'
                }`}
                aria-label={`Step ${idx + 1}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const nextIdx = (stepIdx + 1) % guideSteps.length;
                setStepIdx(nextIdx);
                setIsSpatialGuideActive(true);
                focusStepField(guideSteps[nextIdx]);
              }}
              className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              Next Step ({(stepIdx % guideSteps.length) + 1}/{guideSteps.length}) →
            </button>
            <span className="text-slate-400">·</span>
            {mode === 'login' ? (
              <button
                type="button"
                onClick={() => onSwitchMode('signup')}
                className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                Create Account
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onSwitchMode('login')}
                className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>

      {isSpatialGuideActive && targetRect && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <div
            className="fixed rounded-2xl tour-spotlight-ring pointer-events-none"
            style={{
              top: `${targetRect.top - 4}px`,
              left: `${targetRect.left - 4}px`,
              width: `${targetRect.width + 8}px`,
              height: `${targetRect.height + 8}px`,
              transition: 'all 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          />

          <div
            style={getFloatingBotStyle()}
            className="pointer-events-auto p-3.5 rounded-2xl bg-slate-900/95 text-white border border-indigo-500/40 shadow-2xl animate-popup-in"
          >
            <div className="flex items-start gap-2.5">
              <AIBotFace mood="guiding" size="sm" className="flex-shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-bold text-indigo-300">{currentTip.title}</span>
                  <button
                    type="button"
                    onClick={() => setIsSpatialGuideActive(false)}
                    className="text-[10px] text-slate-400 hover:text-white cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-[11px] text-slate-200 mt-1 leading-relaxed">{currentTip.tip}</p>
                <div className="flex items-center justify-between mt-2.5 pt-1.5 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      const prevIdx = (stepIdx - 1 + guideSteps.length) % guideSteps.length;
                      setStepIdx(prevIdx);
                      focusStepField(guideSteps[prevIdx]);
                    }}
                    className="text-[10px] text-slate-400 hover:text-white cursor-pointer"
                  >
                    ← Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const nextIdx = (stepIdx + 1) % guideSteps.length;
                      setStepIdx(nextIdx);
                      focusStepField(guideSteps[nextIdx]);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-semibold cursor-pointer"
                  >
                    Next Field →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

interface TourWaypoint {
  selector: string;
  label: string;
  caption: string;
  preferredPlacement?: 'right' | 'bottom' | 'left' | 'top-right';
}

interface PlatformTourStep {
  id: string;
  title: string;
  shortTitle: string;
  view: ActiveView;
  summary: string;
  highlights: string[];
  waypoints: TourWaypoint[];
}

const PLATFORM_TOUR_STEPS: PlatformTourStep[] = [
  {
    id: 'overview',
    title: '1. Role-Adaptive Command Overview',
    shortTitle: '1. Overview',
    view: 'overview',
    summary: 'Your home dashboard adapts to your RBAC role with live KPIs, AI health scores, and executive governance.',
    highlights: [
      'Real-time project velocity, overdue deliverables, and sprint health in one view.',
      'Owners & Admins can manage billing, security policies, API keys, and audit logs.',
    ],
    waypoints: [
      {
        selector: '[data-tour-id="tour-nav-overview"]',
        label: 'Sidebar · Overview Navigation',
        caption: 'Click Overview anytime to return to your role-adaptive command center.',
        preferredPlacement: 'right',
      },
      {
        selector: '[data-tour-id="tour-header-command"]',
        label: 'Header · AI Command Palette (⌘K)',
        caption: 'Launch natural-language AI commands or global search from anywhere.',
        preferredPlacement: 'bottom',
      },
      {
        selector: '[data-main-scroll-view="true"]',
        label: 'Workspace · Live Executive & Role Dashboard',
        caption: 'Inspect live KPIs, AI risk alerts, billing, and security controls right here.',
        preferredPlacement: 'top-right',
      },
    ],
  },
  {
    id: 'ai_copilot_view',
    title: '2. AI Project Manager & Blueprint Studio',
    shortTitle: '2. AI Studio',
    view: 'ai_copilot_view',
    summary: 'Transform a single goal (e.g. "Launch mobile app by December") into a complete multi-sprint execution plan.',
    highlights: [
      'Auto-generate milestones, sprints, and Fibonacci-estimated tasks in one click.',
      'Rebalance overloaded teammates and extract tasks from meeting notes.',
    ],
    waypoints: [
      {
        selector: '[data-tour-id="tour-nav-ai_copilot_view"]',
        label: 'Sidebar · AI Co-Pilot & Virtual PM',
        caption: 'Open the dedicated AI Project Manager Studio from the sidebar.',
        preferredPlacement: 'right',
      },
      {
        selector: '[data-main-scroll-view="true"]',
        label: 'Workspace · AI Blueprint & Capacity Engine',
        caption: 'Generate complete project roadmaps, rebalance workloads, or convert meeting notes.',
        preferredPlacement: 'top-right',
      },
    ],
  },
  {
    id: 'projects_overview',
    title: '3. Collaborative Projects, Kanban & Gantt',
    shortTitle: '3. Projects',
    view: 'projects_overview',
    summary: 'Manage all active initiatives with live presence avatars, Kanban boards, List tables, and Gantt timelines.',
    highlights: [
      'See who is viewing or editing tasks in real time via Supabase Broadcast.',
      'Open any task for Context-Aware AI subtask breakdown and blocker detection.',
    ],
    waypoints: [
      {
        selector: '[data-tour-id="tour-nav-projects_overview"]',
        label: 'Sidebar · Projects Portfolio',
        caption: 'Browse all organization projects or create a new initiative.',
        preferredPlacement: 'right',
      },
      {
        selector: '[data-main-scroll-view="true"]',
        label: 'Workspace · Live Project Portfolio',
        caption: 'Click any project card to open its collaborative Kanban, List, or Gantt board.',
        preferredPlacement: 'top-right',
      },
    ],
  },
  {
    id: 'sprints_view',
    title: '4. Agile Sprint Planning & Velocity',
    shortTitle: '4. Sprints',
    view: 'sprints_view',
    summary: 'Organize product backlog items into time-boxed sprints and track story point burnup.',
    highlights: [
      'Assign tasks to sprints and monitor team story point capacity in real time.',
    ],
    waypoints: [
      {
        selector: '[data-tour-id="tour-nav-sprints_view"]',
        label: 'Sidebar · Sprint Planning',
        caption: 'Switch to Agile Sprint Planning to manage active and upcoming iterations.',
        preferredPlacement: 'right',
      },
      {
        selector: '[data-main-scroll-view="true"]',
        label: 'Workspace · Sprint Backlog & Burnup',
        caption: 'Balance story points across sprints and track completion progress.',
        preferredPlacement: 'top-right',
      },
    ],
  },
  {
    id: 'team_chat_view',
    title: '5. E2EE Direct Messages & Team Channels',
    shortTitle: '5. Teams Chat',
    view: 'team_chat_view',
    summary: 'Collaborate across channels or 1:1 End-to-End Encrypted (AES-256-GCM) Direct Messages.',
    highlights: [
      'Start a Direct Message with any org teammate or generate an invite link for external users.',
      'Verify cryptographic key fingerprints and react with live emojis.',
    ],
    waypoints: [
      {
        selector: '[data-tour-id="tour-nav-team_chat_view"]',
        label: 'Sidebar · E2EE Teams Chat',
        caption: 'Jump into real-time channels and encrypted 1:1 direct messages.',
        preferredPlacement: 'right',
      },
      {
        selector: '[data-main-scroll-view="true"]',
        label: 'Workspace · Channels & Direct Messages',
        caption: 'Use the + buttons to start a DM with any org member or invite external people.',
        preferredPlacement: 'top-right',
      },
    ],
  },
  {
    id: 'team_management',
    title: '6. RBAC Directory & Immutable Audit Trail',
    shortTitle: '6. Team & RBAC',
    view: 'team_management',
    summary: 'Manage organization roles, weekly capacity hours, invitation links, and security audit logs.',
    highlights: [
      'Project Managers can update roles for any member (except Owners) with live DB sync.',
      'Inspect every role change, task transition, and security event in the audit trail.',
    ],
    waypoints: [
      {
        selector: '[data-tour-id="tour-nav-team_management"]',
        label: 'Sidebar · Team Management & RBAC',
        caption: 'Manage team roles, departments, capacity, and security audit logs.',
        preferredPlacement: 'right',
      },
      {
        selector: '[data-main-scroll-view="true"]',
        label: 'Workspace · RBAC Matrix & Audit Trail',
        caption: 'Update member roles in real time or switch to the Security & Audit Logs tab.',
        preferredPlacement: 'top-right',
      },
    ],
  },
  {
    id: 'profile_settings',
    title: '7. Profile, Live Status & Telemetry Menu',
    shortTitle: '7. Profile & Menu',
    view: 'profile_settings',
    summary: 'Customize your availability status, working hours, AI preferences, and launch diagnostic telemetry.',
    highlights: [
      'Use the top-right status icon or profile menu to broadcast Online, Away, or Busy.',
      'Owners & Project Managers can open the Exception & Console Log Monitor anytime.',
    ],
    waypoints: [
      {
        selector: '[data-tour-id="tour-header-status"]',
        label: 'Header · Dynamic Live Status Icon',
        caption: 'Click this icon anytime to broadcast Available, Away, or Busy/DND to your team.',
        preferredPlacement: 'bottom',
      },
      {
        selector: '[data-tour-id="tour-header-profile"]',
        label: 'Header · Profile & Telemetry Mini Menu',
        caption: 'Access theme mode, AI Co-Pilot, Exception Log Monitor, and Profile Settings.',
        preferredPlacement: 'bottom',
      },
    ],
  },
];

export const AIPlatformGuideModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const { activeView, setActiveView, darkMode } = useAppStore();
  const { shouldRender, isClosing } = useAnimatedMount(isOpen, 200);

  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [waypointIndex, setWaypointIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const currentStep = PLATFORM_TOUR_STEPS[activeStepIndex] || PLATFORM_TOUR_STEPS[0];
  const currentWaypoint =
    currentStep.waypoints[waypointIndex % currentStep.waypoints.length] || currentStep.waypoints[0];
  const currentSelector = currentWaypoint?.selector || '';

  const measureTarget = useCallback(() => {
    if (!isOpen || !currentSelector) {
      setTargetRect(prev => (prev === null ? prev : null));
      return;
    }
    const el = document.querySelector(currentSelector);
    if (el) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setTargetRect(prev => (isSameRect(prev, rect) ? prev : rect));
        return;
      }
    }
    setTargetRect(prev => (prev === null ? prev : null));
  }, [isOpen, currentSelector]);

  useEffect(() => {
    if (!isOpen) {
      setIsAutoPlaying(false);
      return;
    }
    measureTarget();
    const t1 = setTimeout(measureTarget, 80);
    const t2 = setTimeout(measureTarget, 280);
    window.addEventListener('resize', measureTarget);
    window.addEventListener('scroll', measureTarget, true);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', measureTarget);
      window.removeEventListener('scroll', measureTarget, true);
    };
  }, [isOpen, activeStepIndex, waypointIndex, activeView, measureTarget]);

  useEffect(() => {
    if (!isOpen || !isAutoPlaying) return;
    const timer = setInterval(() => {
      const step = PLATFORM_TOUR_STEPS[activeStepIndex] || PLATFORM_TOUR_STEPS[0];
      if (waypointIndex < step.waypoints.length - 1) {
        setWaypointIndex(w => w + 1);
      } else if (activeStepIndex < PLATFORM_TOUR_STEPS.length - 1) {
        const nextStepIdx = activeStepIndex + 1;
        setActiveStepIndex(nextStepIdx);
        setWaypointIndex(0);
        setActiveView(PLATFORM_TOUR_STEPS[nextStepIdx].view);
      } else {
        setIsAutoPlaying(false);
      }
    }, 3800);
    return () => clearInterval(timer);
  }, [isOpen, isAutoPlaying, activeStepIndex, waypointIndex, setActiveView]);

  const handleSelectStep = useCallback(
    (index: number) => {
      const step = PLATFORM_TOUR_STEPS[index];
      if (!step) return;
      setActiveStepIndex(index);
      setWaypointIndex(0);
      if (activeView !== step.view) {
        setActiveView(step.view);
      }
    },
    [activeView, setActiveView]
  );

  const handleNextPoint = useCallback(() => {
    if (waypointIndex < currentStep.waypoints.length - 1) {
      setWaypointIndex(w => w + 1);
    } else if (activeStepIndex < PLATFORM_TOUR_STEPS.length - 1) {
      handleSelectStep(activeStepIndex + 1);
    } else {
      onClose();
    }
  }, [waypointIndex, currentStep.waypoints.length, activeStepIndex, handleSelectStep, onClose]);

  const handlePrevPoint = useCallback(() => {
    if (waypointIndex > 0) {
      setWaypointIndex(w => w - 1);
    } else if (activeStepIndex > 0) {
      const prevStepIdx = activeStepIndex - 1;
      const prevStep = PLATFORM_TOUR_STEPS[prevStepIdx];
      setActiveStepIndex(prevStepIdx);
      setWaypointIndex(Math.max(0, prevStep.waypoints.length - 1));
      if (activeView !== prevStep.view) {
        setActiveView(prevStep.view);
      }
    }
  }, [waypointIndex, activeStepIndex, activeView, setActiveView]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        handleNextPoint();
      } else if (e.key === 'ArrowLeft') {
        handlePrevPoint();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handleNextPoint, handlePrevPoint]);

  if (!shouldRender) return null;

  // Compute collision-free position for the unified AI Guide Card
  // All 7 section pills are embedded inside this single card so there is NEVER a top bar blocking the Header!
  const computeBotCardPosition = (): React.CSSProperties => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const cardW = Math.min(395, vw - 24);
    const cardH = 335;

    if (!targetRect) {
      return {
        top: `${Math.max(16, vh - cardH - 24)}px`,
        left: `${Math.max(12, vw - cardW - 24)}px`,
        width: `${cardW}px`,
      };
    }

    const placement = currentWaypoint?.preferredPlacement || 'right';
    let top = 24;
    let left = 24;

    if (placement === 'bottom' || targetRect.top < 110) {
      // Explaining a Header element: always place the card cleanly BELOW the header (never covering top bar!)
      top = Math.min(vh - cardH - 16, Math.max(targetRect.bottom + 36, 92));
      left = Math.max(12, Math.min(vw - cardW - 16, targetRect.right - cardW / 2));
    } else if (placement === 'right') {
      // Next to sidebar navigation item
      left = targetRect.right + 20;
      top = Math.max(84, Math.min(vh - cardH - 16, targetRect.top - 10));
      if (left + cardW > vw - 16) {
        left = Math.max(12, vw - cardW - 16);
        top = Math.min(vh - cardH - 16, Math.max(84, targetRect.bottom + 18));
      }
    } else if (placement === 'top-right') {
      // Main workspace container: dock cleanly in bottom-right so header & main content remain unobstructed
      left = Math.max(12, vw - cardW - 24);
      top = Math.max(92, vh - cardH - 24);
    } else {
      left = Math.max(12, targetRect.left - cardW - 18);
      top = Math.max(84, Math.min(vh - cardH - 16, targetRect.top));
    }

    return {
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
      width: `${cardW}px`,
    };
  };

  const isLargeContainer = Boolean(targetRect && targetRect.width > 500 && targetRect.height > 350);
  // Flip spotlight badge below the ring when highlighting top-of-screen Header options so it never clips or covers the button
  const isNearTopEdge = Boolean(targetRect && targetRect.top < 54);

  return (
    <div
      className={`fixed inset-0 z-50 pointer-events-none transition-opacity duration-200 ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Animated Spotlight Ring on Target UI Feature (Zero Blur & Non-Obstructing) */}
      {targetRect && (
        <div
          className="fixed rounded-2xl tour-spotlight-ring pointer-events-none"
          style={{
            top: `${Math.round(targetRect.top - (isLargeContainer ? -4 : 5))}px`,
            left: `${Math.round(targetRect.left - (isLargeContainer ? -4 : 5))}px`,
            width: `${Math.round(targetRect.width + (isLargeContainer ? -8 : 10))}px`,
            height: `${Math.round(targetRect.height + (isLargeContainer ? -8 : 10))}px`,
            transition: 'all 0.52s cubic-bezier(0.22, 1, 0.36, 1)',
            border: '2px solid rgba(56, 189, 248, 0.95)',
          }}
        >
          {/* Floating Target Label Tag — automatically positions BELOW header items when near top edge */}
          <div
            className={`absolute ${
              isNearTopEdge ? '-bottom-7 right-0' : '-top-7 left-2'
            } px-2.5 py-0.5 rounded-lg bg-indigo-600 text-white text-[10px] font-bold tracking-wide shadow-md whitespace-nowrap flex items-center gap-1.5`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 animate-ping" />
            <span>{currentWaypoint?.label || currentStep.shortTitle}</span>
          </div>
        </div>
      )}

      {/* Unified Spatial Moving AI Bot & Guide Card (Includes Integrated Module Step Strip — Never Blocks Header!) */}
      <div
        style={{
          ...computeBotCardPosition(),
          transition:
            'top 0.55s cubic-bezier(0.22, 1, 0.36, 1), left 0.55s cubic-bezier(0.22, 1, 0.36, 1), width 0.3s ease',
        }}
        className={`fixed z-50 pointer-events-auto rounded-2xl border shadow-2xl p-4 backdrop-blur-xl ${
          isClosing ? 'animate-modal-disappear' : 'animate-modal-appear'
        } ${
          darkMode
            ? 'bg-slate-900/95 border-indigo-500/45 text-slate-100 shadow-black/60'
            : 'bg-white/95 border-indigo-200/90 text-slate-900 shadow-indigo-950/15'
        }`}
      >
        {/* Integrated Horizontal Section Switcher Strip inside the Card */}
        <div className="flex items-center justify-between gap-1.5 pb-2.5 mb-3 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5 flex-1 min-w-0">
            {PLATFORM_TOUR_STEPS.map((step, idx) => {
              const active = idx === activeStepIndex;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => handleSelectStep(idx)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap flex-shrink-0 ${
                    active
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : darkMode
                      ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {step.shortTitle}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => setIsAutoPlaying(p => !p)}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                isAutoPlaying
                  ? 'bg-emerald-600 text-white'
                  : darkMode
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              title="Automatically glide the AI Bot across every feature"
            >
              {isAutoPlaying ? '⏸' : '▶ Auto'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
              title="Exit Interactive Tour (Esc)"
            >
              <ICON_MAP.XMarkIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Bot Avatar + Active Feature Header */}
        <div className="flex items-start gap-3">
          <div className="relative flex-shrink-0">
            <AIBotFace mood={isAutoPlaying ? 'speaking' : 'guiding'} size="md" />
            <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-full bg-indigo-600 text-[9px] font-mono font-bold text-white shadow-xs">
              {activeStepIndex + 1}/{PLATFORM_TOUR_STEPS.length}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-500 dark:text-indigo-400 truncate">
                {currentWaypoint?.label || `Step ${activeStepIndex + 1}`}
              </span>
              <span className="text-[10px] font-mono text-slate-400 flex-shrink-0">
                Point {(waypointIndex % currentStep.waypoints.length) + 1}/{currentStep.waypoints.length}
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 truncate">
              {currentStep.title}
            </h3>
          </div>
        </div>

        {/* Live Pointer Explanation */}
        <div
          className={`mt-2.5 p-2.5 rounded-xl border text-xs leading-relaxed ${
            darkMode
              ? 'bg-indigo-950/35 border-indigo-500/25 text-indigo-200'
              : 'bg-indigo-50/80 border-indigo-100 text-indigo-950'
          }`}
        >
          <span className="font-semibold">📍 Highlighted: </span>
          {currentWaypoint?.caption || currentStep.summary}
        </div>

        {/* Key Highlights for this Workspace Module */}
        <ul className="mt-2 space-y-1">
          {currentStep.highlights.map((h, i) => (
            <li key={i} className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-300">
              <ICON_MAP.CheckIcon className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <span>{h}</span>
            </li>
          ))}
        </ul>

        {/* Waypoint Dots & Navigation Controls */}
        <div className="mt-3 pt-2.5 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            {currentStep.waypoints.map((wp, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setWaypointIndex(idx)}
                title={wp.label}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  idx === waypointIndex % currentStep.waypoints.length
                    ? 'w-5 bg-indigo-500'
                    : 'w-2 bg-slate-300 dark:bg-slate-700 hover:bg-indigo-400'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrevPoint}
              disabled={activeStepIndex === 0 && waypointIndex === 0}
              className={`px-2.5 py-1 rounded-xl border text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-35 ${
                darkMode
                  ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              ← Prev
            </button>
            <button
              type="button"
              onClick={handleNextPoint}
              className="px-3 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold shadow-xs transition-colors cursor-pointer"
            >
              {waypointIndex < currentStep.waypoints.length - 1
                ? 'Next Feature Here →'
                : activeStepIndex < PLATFORM_TOUR_STEPS.length - 1
                ? 'Next Screen →'
                : 'Finish Tour'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
