import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ICON_MAP } from '../../constants';
import { Button } from '../shared/Button';
import { GLASS_SPRING } from '../shared/LiquidGlass';

export type PaymentMethodType = 'card' | 'stripe_hosted' | 'invoice' | 'starter_free';

export interface BillingInvoiceRecord {
  id: string;
  stripeSessionId?: string;
  date: string;
  planName: string;
  billingCycle: 'monthly' | 'annual';
  extraSeats?: number;
  amountCents: number;
  discountPct?: number;
  couponCode?: string;
  currency: string;
  status: 'paid' | 'open' | 'failed';
  paymentMethodLabel: string;
  paymentMethodType: PaymentMethodType;
  companyLegalName?: string;
}

export interface OrganizationBillingRecord {
  organizationId: string;
  planId: 'starter' | 'growth_pro' | 'enterprise_ai';
  billingCycle: 'monthly' | 'annual';
  extraSeats: number;
  subscriptionStatus: 'active' | 'past_due' | 'canceled';
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string;
  paymentMethodType: PaymentMethodType;
  paymentBrand: string;
  paymentLast4: string;
  billingEmail: string;
  companyLegalName?: string;
  taxId?: string;
  couponCode?: string;
  discountPct?: number;
  invoices: BillingInvoiceRecord[];
  updatedAt: string;
}

export interface PlanCatalogItem {
  id: 'starter' | 'growth_pro' | 'enterprise_ai';
  name: string;
  priceMonthly: number;
  priceAnnualMonthly: number;
  maxSeats: number;
  aiTokens: string;
  tagline: string;
  features: string[];
}

export const WORKSPACE_PLANS: PlanCatalogItem[] = [
  {
    id: 'starter',
    name: 'Starter',
    priceMonthly: 0,
    priceAnnualMonthly: 0,
    maxSeats: 15,
    aiTokens: '50k AI credits / mo',
    tagline: 'Core boards, team chat, and video calls for small squads.',
    features: [
      'Up to 15 team seats & 3 active projects',
      'Kanban, List, and Backlog views',
      'Team Chat, Voice Notes & Video Calls',
      'Mobile app navigation & dark/light themes',
    ],
  },
  {
    id: 'growth_pro',
    name: 'Pro Studio',
    priceMonthly: 29,
    priceAnnualMonthly: 22,
    maxSeats: 50,
    aiTokens: '500k AI credits / mo',
    tagline: 'AI planning assistant, HD screen sharing, and automations.',
    features: [
      'Up to 50 team seats & unlimited projects',
      'AI Workspace Assistant & Meeting Action Extractor',
      'HD Video Studio, Whiteboard & Video Clips',
      'Automated Rules, SLAs & Team Approvals',
    ],
  },
  {
    id: 'enterprise_ai',
    name: 'Enterprise',
    priceMonthly: 199,
    priceAnnualMonthly: 149,
    maxSeats: 250,
    aiTokens: 'Unlimited AI credits',
    tagline: 'Full workspace controls, SSO readiness, and priority support.',
    features: [
      'Up to 250 team seats & unlimited projects',
      'Unlimited AI planning, Risk Radar & Voice Transcription',
      'Full Activity Log exports & Security Controls',
      'Priority onboarding & custom workspace defaults',
    ],
  },
];

interface PlanCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  organizationName: string;
  defaultEmail?: string;
  initialPlanId?: 'starter' | 'growth_pro' | 'enterprise_ai';
  initialBillingCycle?: 'monthly' | 'annual';
  currentBilling?: OrganizationBillingRecord;
  onBillingUpdated: (nextBilling: OrganizationBillingRecord) => void;
  onToast: (title: string, msg: string, tone: 'success' | 'info' | 'warning' | 'error') => void;
}

const formatCardDisplay = (raw: string) => {
  const digits = raw.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(.{4})/g, '$1 ').trim();
};

const formatExpiryDisplay = (raw: string) => {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
};

export const PlanCheckoutModal: React.FC<PlanCheckoutModalProps> = ({
  isOpen,
  onClose,
  organizationId,
  organizationName,
  defaultEmail,
  initialPlanId,
  initialBillingCycle,
  currentBilling,
  onBillingUpdated,
  onToast,
}) => {
  const [planId, setPlanId] = useState<'starter' | 'growth_pro' | 'enterprise_ai'>(
    initialPlanId || currentBilling?.planId || 'growth_pro'
  );
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>(
    initialBillingCycle || currentBilling?.billingCycle || 'annual'
  );
  const [extraSeats, setExtraSeats] = useState<number>(currentBilling?.extraSeats || 0);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'invoice'>('card');

  // Card inputs
  const [cardholderName, setCardholderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');

  // Company / Billing contact
  const [billingEmail, setBillingEmail] = useState(
    currentBilling?.billingEmail || defaultEmail || ''
  );
  const [companyLegalName, setCompanyLegalName] = useState(
    currentBilling?.companyLegalName || organizationName || ''
  );
  const [taxId, setTaxId] = useState(currentBilling?.taxId || '');
  const [couponInput, setCouponInput] = useState('');

  // Stripe session state (when STRIPE_SECRET_KEY is active on backend)
  const [stripeConfigured, setStripeConfigured] = useState(false);
  const [stripeCheckoutUrl, setStripeCheckoutUrl] = useState<string | null>(null);
  const [stripeSessionId, setStripeSessionId] = useState<string | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isVerifyingStripe, setIsVerifyingStripe] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setPlanId(initialPlanId || currentBilling?.planId || 'growth_pro');
    setBillingCycle(initialBillingCycle || currentBilling?.billingCycle || 'annual');
    setExtraSeats(currentBilling?.extraSeats || 0);
    setBillingEmail(currentBilling?.billingEmail || defaultEmail || '');
    setCompanyLegalName(currentBilling?.companyLegalName || organizationName || '');
    setTaxId(currentBilling?.taxId || '');
    setStripeCheckoutUrl(null);
    setStripeSessionId(null);
    setErrorBanner(null);

    fetch('/api/billing/plans')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data && typeof data.stripeConfigured === 'boolean') {
          setStripeConfigured(data.stripeConfigured);
        }
      })
      .catch(() => {});

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, initialPlanId, initialBillingCycle, currentBilling, defaultEmail, organizationName, onClose]);

  if (!isOpen) return null;

  const selectedPlan = WORKSPACE_PLANS.find(p => p.id === planId) || WORKSPACE_PLANS[1];
  const monthlyRate = billingCycle === 'annual' ? selectedPlan.priceAnnualMonthly : selectedPlan.priceMonthly;
  const seatMonthlyCost = extraSeats * 4;
  const combinedMonthly = monthlyRate + seatMonthlyCost;
  const rawTotalDollars = billingCycle === 'annual' ? combinedMonthly * 12 : combinedMonthly;

  const upperCoupon = couponInput.trim().toUpperCase();
  const discountPct =
    upperCoupon === 'WELCOME25' || upperCoupon === 'OPEN25'
      ? 25
      : upperCoupon === 'FOUNDER50'
      ? 50
      : 0;
  const finalTotalDollars = Math.max(0, Math.round(rawTotalDollars * (1 - discountPct / 100)));

  const handleSubmitCheckout = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorBanner(null);

    if (billingEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billingEmail.trim())) {
      setErrorBanner('Please enter a valid billing email address.');
      return;
    }

    setIsProcessing(true);
    try {
      // Check Stripe Checkout session creation first when Stripe is configured & paying by card
      if (stripeConfigured && finalTotalDollars > 0 && paymentMethod === 'card') {
        const stripeInit = await fetch(
          `/api/billing/${encodeURIComponent(organizationId)}/create-checkout-session`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              planId,
              billingCycle,
              extraSeats,
              couponCode: couponInput.trim(),
              billingEmail: billingEmail.trim(),
              origin: window.location.origin,
            }),
          }
        );
        const stripeData = await stripeInit.json();
        if (stripeData?.ok && stripeData.mode === 'stripe' && stripeData.checkoutUrl) {
          setStripeCheckoutUrl(stripeData.checkoutUrl);
          setStripeSessionId(stripeData.sessionId || null);
          setIsProcessing(false);
          return;
        }
        if (stripeData?.ok && stripeData.mode === 'activated_free' && stripeData.billing) {
          onBillingUpdated(stripeData.billing);
          onToast('Plan Updated', `Switched ${organizationName} to ${selectedPlan.name}.`, 'success');
          onClose();
          return;
        }
      }

      // Integrated in-app checkout (free Starter, Invoice, or integrated card checkout)
      const res = await fetch(`/api/billing/${encodeURIComponent(organizationId)}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          billingCycle,
          extraSeats,
          paymentMethodType: finalTotalDollars === 0 ? 'starter_free' : paymentMethod,
          cardNumber: cardNumber.replace(/\s+/g, ''),
          cardExpiry,
          cardCvc,
          cardholderName: cardholderName.trim(),
          billingEmail: billingEmail.trim(),
          companyLegalName: companyLegalName.trim(),
          taxId: taxId.trim(),
          couponCode: couponInput.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setErrorBanner(data?.message || 'Could not complete checkout. Please check your details.');
        setIsProcessing(false);
        return;
      }

      onBillingUpdated(data.billing);
      onToast(
        'Subscription Updated',
        `${selectedPlan.name} (${billingCycle}) is now active for ${organizationName}.`,
        'success'
      );
      onClose();
    } catch (err: any) {
      setErrorBanner(err?.message || 'Unable to reach billing service.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVerifyStripeSession = async () => {
    if (!stripeSessionId) return;
    setIsVerifyingStripe(true);
    setErrorBanner(null);
    try {
      const res = await fetch(
        `/api/billing/checkout-session/${encodeURIComponent(stripeSessionId)}?org_id=${encodeURIComponent(organizationId)}`
      );
      const data = await res.json();
      if (data?.ok && data.paid && data.billing) {
        onBillingUpdated(data.billing);
        onToast('Payment Confirmed', `${selectedPlan.name} subscription is now active.`, 'success');
        onClose();
      } else {
        setErrorBanner('Payment is not completed yet. Complete checkout in the Stripe tab, then click Verify Payment.');
      }
    } catch {
      setErrorBanner('Could not verify Stripe payment session yet.');
    } finally {
      setIsVerifyingStripe(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={GLASS_SPRING.scrim}
        onClick={onClose}
        className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-black/45 backdrop-blur-[8px]"
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Choose Workspace Plan & Checkout"
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={GLASS_SPRING.spatial}
          onClick={e => e.stopPropagation()}
          className="liquid-glass-overlay w-full max-w-4xl rounded-[24px] overflow-hidden shadow-2xl"
        >
      <div className="p-5 sm:p-6 border-b border-[var(--glass-border)] flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-[var(--accent-cta)] text-[var(--accent-cta-ink)] flex items-center justify-center shrink-0">
            <ICON_MAP.CreditCardIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)] truncate">
              Choose Workspace Plan &amp; Checkout
            </h3>
            <p className="text-xs text-[var(--text-secondary)] truncate">
              {organizationName} · {selectedPlan.name} ({billingCycle === 'annual' ? 'Annual · Save 25%' : 'Monthly'})
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-glass-3)] transition-colors cursor-pointer"
          aria-label="Close checkout"
        >
          <ICON_MAP.XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmitCheckout} className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-h-[82vh] overflow-y-auto scrollbar-thin">
        {/* Left column: Plan & Billing Cycle + Seat Add-ons */}
        <div className="lg:col-span-7 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              1. Select Plan
            </span>
            <div className="inline-flex items-center p-1 rounded-full bg-[var(--surface-glass-3)] border border-[var(--glass-border)]">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold cursor-pointer transition-all ${
                  billingCycle === 'monthly'
                    ? 'bg-[var(--accent-cta)] text-[var(--accent-cta-ink)]'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annual')}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold cursor-pointer transition-all ${
                  billingCycle === 'annual'
                    ? 'bg-[var(--accent-cta)] text-[var(--accent-cta-ink)]'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                Annual (Save 25%)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {WORKSPACE_PLANS.map(p => {
              const active = planId === p.id;
              const displayPrice = billingCycle === 'annual' ? p.priceAnnualMonthly : p.priceMonthly;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPlanId(p.id);
                    setStripeCheckoutUrl(null);
                  }}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    active
                      ? 'bg-[var(--surface-glass-3)] border-[var(--text-primary)]'
                      : 'bg-[var(--bg-surface-subtle)] border-[var(--border-hairline)] hover:border-[var(--glass-border-strong)]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-[var(--text-primary)]">{p.name}</span>
                      {active && (
                        <ICON_MAP.CheckCircleIcon className="w-4 h-4 text-[var(--accent-text)] shrink-0" />
                      )}
                    </div>
                    <div className="text-lg font-bold font-mono tabular-nums text-[var(--text-primary)] mt-1">
                      ${displayPrice}
                      <span className="text-[10px] font-sans font-normal text-[var(--text-muted)]">
                        {p.priceMonthly === 0 ? ' forever' : '/mo'}
                      </span>
                    </div>
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)] mt-2 pt-2 border-t border-[var(--border-hairline)]">
                    Up to {p.maxSeats} seats
                  </div>
                </button>
              );
            })}
          </div>

          {/* Extra Seats */}
          {selectedPlan.priceMonthly > 0 && (
            <div className="p-3.5 rounded-2xl bg-[var(--bg-surface-subtle)] border border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-[var(--text-primary)]">Additional Team Seats</div>
                <div className="text-[11px] text-[var(--text-secondary)]">
                  Includes {selectedPlan.maxSeats} seats · Add extra seats at $4/seat/mo
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setExtraSeats(s => Math.max(0, s - 5))}
                  className="w-7 h-7 rounded-full border border-[var(--glass-border)] bg-[var(--surface-glass-3)] text-xs font-bold cursor-pointer"
                >
                  −
                </button>
                <span className="w-16 text-center text-xs font-mono font-bold tabular-nums">
                  +{extraSeats}
                </span>
                <button
                  type="button"
                  onClick={() => setExtraSeats(s => Math.min(250, s + 5))}
                  className="w-7 h-7 rounded-full border border-[var(--glass-border)] bg-[var(--surface-glass-3)] text-xs font-bold cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {/* Payment Details */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                2. Billing &amp; Payment
              </span>
              {finalTotalDollars > 0 && (
                <div className="inline-flex items-center gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`px-2.5 py-1 rounded-full cursor-pointer font-semibold ${
                      paymentMethod === 'card'
                        ? 'bg-[var(--accent-cta)] text-[var(--accent-cta-ink)]'
                        : 'text-[var(--text-secondary)] bg-[var(--bg-surface-subtle)]'
                    }`}
                  >
                    Credit / Debit Card
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('invoice');
                      setStripeCheckoutUrl(null);
                    }}
                    className={`px-2.5 py-1 rounded-full cursor-pointer font-semibold ${
                      paymentMethod === 'invoice'
                        ? 'bg-[var(--accent-cta)] text-[var(--accent-cta-ink)]'
                        : 'text-[var(--text-secondary)] bg-[var(--bg-surface-subtle)]'
                    }`}
                  >
                    Company Invoice
                  </button>
                </div>
              )}
            </div>

            {stripeCheckoutUrl ? (
              <div className="p-4 rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-sage)] space-y-3">
                <div className="text-xs font-bold text-[var(--accent-text)]">
                  Stripe Checkout Session Ready
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Complete your subscription payment securely on Stripe, then click Verify Payment below to unlock your upgraded workspace plan.
                </p>
                <div className="flex flex-wrap items-center gap-2.5">
                  <a
                    href={stripeCheckoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--accent-cta)] text-[var(--accent-cta-ink)] text-xs font-bold shadow-sm hover:opacity-90"
                  >
                    <span>Open Stripe Checkout</span>
                    <span aria-hidden="true">↗</span>
                  </a>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isVerifyingStripe}
                    onClick={handleVerifyStripeSession}
                  >
                    {isVerifyingStripe ? 'Checking Status...' : 'Verify Payment'}
                  </Button>
                </div>
              </div>
            ) : finalTotalDollars === 0 ? (
              <div className="p-3.5 rounded-2xl bg-[var(--bg-sage)] border border-[var(--border-hairline)] text-xs text-[var(--text-secondary)]">
                Starter is free for teams up to 15 members — no payment card required.
              </div>
            ) : paymentMethod === 'card' ? (
              <div className="space-y-3">
                {stripeConfigured && (
                  <div className="p-3 rounded-xl bg-[var(--bg-sage)] border border-[var(--border-hairline)] text-[11px] text-[var(--text-secondary)] flex items-center gap-2">
                    <ICON_MAP.ShieldCheckIcon className="w-4 h-4 text-[var(--accent-text)] shrink-0" />
                    <span>Stripe Checkout is enabled — clicking Subscribe opens a secure Stripe checkout link.</span>
                  </div>
                )}

                {!stripeConfigured && (
                  <>
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                        Name on Card
                      </label>
                      <input
                        type="text"
                        required
                        value={cardholderName}
                        onChange={e => setCardholderName(e.target.value)}
                        placeholder="Alex Morgan"
                        className="w-full px-3.5 py-2 rounded-xl border text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                        Card Number
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        required
                        value={cardNumber}
                        onChange={e => setCardNumber(formatCardDisplay(e.target.value))}
                        placeholder="4000 1234 5678 9010"
                        className="w-full px-3.5 py-2 rounded-xl border text-xs font-mono"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                          Expiration (MM/YY)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          required
                          value={cardExpiry}
                          onChange={e => setCardExpiry(formatExpiryDisplay(e.target.value))}
                          placeholder="08/29"
                          className="w-full px-3.5 py-2 rounded-xl border text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                          Security Code (CVC)
                        </label>
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={4}
                          required
                          value={cardCvc}
                          onChange={e => setCardCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          placeholder="123"
                          className="w-full px-3.5 py-2 rounded-xl border text-xs font-mono"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Company Legal Name
                  </label>
                  <input
                    type="text"
                    required
                    value={companyLegalName}
                    onChange={e => setCompanyLegalName(e.target.value)}
                    placeholder="Acme Corp"
                    className="w-full px-3.5 py-2 rounded-xl border text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Tax ID / VAT (Optional)
                  </label>
                  <input
                    type="text"
                    value={taxId}
                    onChange={e => setTaxId(e.target.value)}
                    placeholder="Optional tax number"
                    className="w-full px-3.5 py-2 rounded-xl border text-xs font-mono"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Billing Receipt Email
                </label>
                <input
                  type="email"
                  required
                  value={billingEmail}
                  onChange={e => setBillingEmail(e.target.value)}
                  placeholder="billing@company.com"
                  className="w-full px-3.5 py-2 rounded-xl border text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Promo Code (Optional)
                </label>
                <input
                  type="text"
                  value={couponInput}
                  onChange={e => setCouponInput(e.target.value)}
                  placeholder="e.g. WELCOME25"
                  className="w-full px-3.5 py-2 rounded-xl border text-xs uppercase font-mono"
                />
              </div>
            </div>
          </div>

          {errorBanner && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-500 font-medium">
              {errorBanner}
            </div>
          )}
        </div>

        {/* Right column: Order Summary */}
        <div className="lg:col-span-5 flex flex-col justify-between p-4 sm:p-5 rounded-2xl bg-[var(--bg-surface-subtle)] border border-[var(--border-hairline)] space-y-5">
          <div className="space-y-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Order Summary
              </div>
              <h4 className="text-base font-bold text-[var(--text-primary)] mt-1">
                {selectedPlan.name} Plan
              </h4>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">{selectedPlan.tagline}</p>
            </div>

            <ul className="space-y-1.5 text-xs text-[var(--text-secondary)] pt-2 border-t border-[var(--border-hairline)]">
              {selectedPlan.features.map((feat, i) => (
                <li key={i} className="flex items-start gap-2">
                  <ICON_MAP.CheckIcon className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>

            <div className="space-y-1.5 pt-3 border-t border-[var(--border-hairline)] text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">
                  {selectedPlan.name} ({billingCycle})
                </span>
                <span className="font-mono tabular-nums font-semibold">
                  ${billingCycle === 'annual' ? monthlyRate * 12 : monthlyRate}
                </span>
              </div>
              {extraSeats > 0 && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">
                    +{extraSeats} extra seats
                  </span>
                  <span className="font-mono tabular-nums font-semibold">
                    ${billingCycle === 'annual' ? seatMonthlyCost * 12 : seatMonthlyCost}
                  </span>
                </div>
              )}
              {discountPct > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Promo discount ({discountPct}% off)</span>
                  <span className="font-mono tabular-nums">
                    -${rawTotalDollars - finalTotalDollars}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-2 border-t border-[var(--border-hairline)]">
                <span className="font-bold text-[var(--text-primary)]">
                  Total due {billingCycle === 'annual' ? 'today (annual)' : 'this month'}
                </span>
                <span className="text-xl font-bold font-mono tabular-nums text-[var(--text-primary)]">
                  ${finalTotalDollars}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            {!stripeCheckoutUrl && (
              <Button
                type="submit"
                variant="lime"
                size="md"
                disabled={isProcessing}
                className="w-full"
              >
                {isProcessing
                  ? 'Processing...'
                  : finalTotalDollars === 0
                  ? 'Activate Starter Plan'
                  : stripeConfigured && paymentMethod === 'card'
                  ? `Continue to Stripe ($${finalTotalDollars}) →`
                  : paymentMethod === 'invoice'
                  ? `Issue Invoice & Activate ($${finalTotalDollars})`
                  : `Subscribe & Activate ($${finalTotalDollars})`}
              </Button>
            )}
            <p className="text-[11px] text-center text-[var(--text-muted)] leading-snug">
              Switch plans or cancel renewal anytime from Owner Billing.
            </p>
          </div>
        </div>
      </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
