import React, { useState, useMemo, useEffect } from 'react';
import { ICON_MAP } from '../../constants';
import { Button } from '../shared/Button';

export type SandboxPaymentMethodType = 'card' | 'ach' | 'wallet' | 'invoice_po' | 'oss_grant';

export interface SandboxInvoiceRecord {
  id: string;
  date: string;
  planName: string;
  billingCycle: 'monthly' | 'annual';
  extraSeats?: number;
  amountCents: number;
  discountPct?: number;
  couponCode?: string;
  currency: string;
  status: 'paid' | 'open_net30' | 'failed';
  paymentMethodLabel: string;
  paymentMethodType: SandboxPaymentMethodType;
  failureReason?: string;
  poNumber?: string;
  ossProjectUrl?: string;
}

export interface SandboxWebhookEvent {
  id: string;
  type: string;
  createdAt: string;
  signature: string;
  payload: Record<string, any>;
}

export interface SandboxBillingRecord {
  organizationId: string;
  environment: 'sandbox';
  planId: 'starter' | 'growth_pro' | 'enterprise_ai';
  billingCycle: 'monthly' | 'annual';
  extraSeats: number;
  subscriptionStatus: 'active' | 'past_due' | 'trialing';
  paymentMethodType: SandboxPaymentMethodType;
  paymentBrand: string;
  paymentLast4: string;
  billingEmail: string;
  taxId: string;
  autoTopUpSeats: boolean;
  couponCode?: string;
  discountPct?: number;
  ossProjectUrl?: string;
  ossLicense?: string;
  invoices: SandboxInvoiceRecord[];
  webhookLogs: SandboxWebhookEvent[];
  updatedAt?: string;
}

interface PlanCatalogItem {
  id: 'starter' | 'growth_pro' | 'enterprise_ai';
  name: string;
  priceMonthly: number;
  maxSeats: number;
  aiTokens: string;
}

const PLAN_CATALOG: Record<'starter' | 'growth_pro' | 'enterprise_ai', PlanCatalogItem> = {
  starter: { id: 'starter', name: 'Starter Core', priceMonthly: 0, maxSeats: 15, aiTokens: '50k / mo' },
  growth_pro: { id: 'growth_pro', name: 'Growth Pro', priceMonthly: 79, maxSeats: 50, aiTokens: '500k / mo' },
  enterprise_ai: { id: 'enterprise_ai', name: 'Enterprise AI-Native', priceMonthly: 199, maxSeats: 250, aiTokens: 'Unlimited' },
};

interface BillingSandboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  organizationName: string;
  initialPlanId?: 'starter' | 'growth_pro' | 'enterprise_ai';
  currentBilling: SandboxBillingRecord;
  onBillingUpdated: (next: SandboxBillingRecord) => void;
  onToast: (title: string, msg: string, type: 'success' | 'info' | 'warning' | 'error') => void;
}

export const BillingSandboxModal: React.FC<BillingSandboxModalProps> = ({
  isOpen,
  onClose,
  organizationId,
  organizationName,
  initialPlanId,
  currentBilling,
  onBillingUpdated,
  onToast,
}) => {
  const [selectedPlanId, setSelectedPlanId] = useState<'starter' | 'growth_pro' | 'enterprise_ai'>(
    initialPlanId || currentBilling.planId
  );
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>(currentBilling.billingCycle || 'annual');
  const [extraSeats, setExtraSeats] = useState<number>(currentBilling.extraSeats || 0);
  const [paymentMethodType, setPaymentMethodType] = useState<SandboxPaymentMethodType>(
    currentBilling.paymentMethodType || 'card'
  );

  // Card rail state
  const [cardNumber, setCardNumber] = useState('4242 4242 4242 4242');
  const [cardExp, setCardExp] = useState('12/29');
  const [cardCvc, setCardCvc] = useState('424');
  const [simulateOutcome, setSimulateOutcome] = useState<'auto' | 'succeed' | '3ds_required' | 'decline'>('auto');

  // ACH rail state
  const [achRouting, setAchRouting] = useState('110000000');
  const [achAccount, setAchAccount] = useState('000123456789');
  const [achMicroCode, setAchMicroCode] = useState('00-00');

  // Wallet rail state
  const [walletProvider, setWalletProvider] = useState<'apple_pay' | 'google_pay' | 'open_link'>('apple_pay');

  // Corporate PO rail state
  const [poNumber, setPoNumber] = useState('PO-2026-4402');
  const [companyLegalName, setCompanyLegalName] = useState(organizationName || 'Workspace Inc.');
  const [taxId, setTaxId] = useState(currentBilling.taxId || 'US-EIN-94-3829104');
  const [billingEmail, setBillingEmail] = useState(currentBilling.billingEmail || 'billing@organization.io');

  // Open-Source Grant rail state
  const [ossProjectUrl, setOssProjectUrl] = useState(currentBilling.ossProjectUrl || 'https://github.com/org/open-project');
  const [ossLicense, setOssLicense] = useState(currentBilling.ossLicense || 'MIT');

  // Promo / Grant Coupon
  const [couponCode, setCouponCode] = useState(currentBilling.couponCode || '');

  // Processing & Challenge flow
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [challengeState, setChallengeState] = useState<{
    type: '3ds2' | 'ach_micro_deposit';
    challengeId: string;
    message: string;
  } | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (initialPlanId) setSelectedPlanId(initialPlanId);
    setBillingCycle(currentBilling.billingCycle || 'annual');
    setExtraSeats(currentBilling.extraSeats || 0);
    setChallengeState(null);
    setErrorBanner(null);
  }, [isOpen, initialPlanId, currentBilling.billingCycle, currentBilling.extraSeats]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const pricing = useMemo(() => {
    const plan = PLAN_CATALOG[selectedPlanId];
    const seatAddOnMonthly = Math.ceil(extraSeats / 10) * 12;
    const monthlyBase = plan.priceMonthly + seatAddOnMonthly;
    const multiplier = billingCycle === 'annual' ? 12 * 0.75 : 1;
    const subtotalCents = Math.round(monthlyBase * multiplier * 100);

    const upper = couponCode.trim().toUpperCase();
    let discountPct = 0;
    if (paymentMethodType === 'oss_grant' || upper === 'OSS-GRANT-100' || upper === 'DEV-SANDBOX') {
      discountPct = 100;
    } else if (upper === 'DEV50') {
      discountPct = 50;
    } else if (upper === 'OPEN25') {
      discountPct = 25;
    }

    const totalCents = Math.max(0, Math.round(subtotalCents * (1 - discountPct / 100)));
    return { plan, seatAddOnMonthly, subtotalCents, discountPct, totalCents };
  }, [selectedPlanId, billingCycle, extraSeats, couponCode, paymentMethodType]);

  if (!isOpen) return null;

  const formatMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const executeCheckout = async (opts?: { threeDsApproved?: boolean; achMicroVerified?: boolean }) => {
    setIsSubmitting(true);
    setErrorBanner(null);

    try {
      const res = await fetch(`/api/billing/${encodeURIComponent(organizationId)}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: selectedPlanId,
          billingCycle,
          extraSeats,
          paymentMethodType,
          cardNumber,
          exp: cardExp,
          cvc: cardCvc,
          simulateOutcome: opts?.threeDsApproved ? 'succeed' : simulateOutcome,
          threeDsApproved: Boolean(opts?.threeDsApproved),
          achRouting,
          achAccount,
          achMicroCode,
          achMicroVerified: Boolean(opts?.achMicroVerified),
          walletProvider,
          poNumber,
          companyLegalName,
          billingEmail,
          taxId,
          couponCode,
          ossProjectUrl,
          ossLicense,
        }),
      });
      const data = await res.json();

      if (data.billing) {
        onBillingUpdated(data.billing);
      }

      if (data.requiresAction) {
        setChallengeState({
          type: data.challengeType,
          challengeId: data.challengeId,
          message: data.message,
        });
        setIsSubmitting(false);
        return;
      }

      if (!data.ok) {
        setErrorBanner(data.message || 'Payment declined in sandbox simulation.');
        onToast('Sandbox Payment Declined', data.message || 'Simulated payment decline.', 'warning');
        setIsSubmitting(false);
        return;
      }

      setChallengeState(null);
      onToast(
        'Sandbox Checkout Complete',
        `${pricing.plan.name} activated (${formatMoney(pricing.totalCents)} · ${paymentMethodType.toUpperCase()}).`,
        'success'
      );
      onClose();
    } catch (err: any) {
      setErrorBanner(err?.message || 'Could not reach sandbox billing endpoint.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const methodTabs: Array<{ id: SandboxPaymentMethodType; label: string; sub: string }> = [
    { id: 'card', label: 'Test Card', sub: '3DS2 & Decline' },
    { id: 'ach', label: 'Bank ACH / SEPA', sub: 'Micro-deposit' },
    { id: 'wallet', label: 'Express Wallet', sub: 'Apple / Google / Link' },
    { id: 'invoice_po', label: 'Invoice / PO', sub: 'Net-30 Terms' },
    { id: 'oss_grant', label: 'Open Source', sub: '$0 OSS Grant' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 animate-fadeIn">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-[3px]" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-4xl max-h-[92vh] bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-[22px] shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Top Bar */}
        <div className="px-5 py-4 border-b border-[var(--border-hairline)] flex items-center justify-between gap-3 shrink-0 bg-[var(--bg-surface-subtle)]">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-[var(--accent-lime)] text-[var(--accent-ink)]">
                SANDBOX GATEWAY
              </span>
              <span className="text-[11px] font-mono text-[var(--text-muted)] truncate">
                {organizationName}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] mt-0.5">
              Zero-Cost Multi-Rail Billing &amp; Payment Tester
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-sage)] transition-colors cursor-pointer"
            aria-label="Close sandbox checkout"
          >
            <ICON_MAP.XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Two-Column Checkout Grid */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Plan + Seats + Order Summary */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  1. Plan &amp; Capacity
                </span>
                <div className="inline-flex rounded-full p-0.5 bg-[var(--bg-sage)] border border-[var(--border-hairline)] text-[11px]">
                  <button
                    type="button"
                    onClick={() => setBillingCycle('monthly')}
                    className={`px-2.5 py-1 rounded-full font-medium cursor-pointer transition-colors ${
                      billingCycle === 'monthly'
                        ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-2xs font-semibold'
                        : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle('annual')}
                    className={`px-2.5 py-1 rounded-full font-medium cursor-pointer transition-colors ${
                      billingCycle === 'annual'
                        ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-2xs font-semibold'
                        : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    Annual -25%
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {(['starter', 'growth_pro', 'enterprise_ai'] as const).map(pid => {
                  const p = PLAN_CATALOG[pid];
                  const active = selectedPlanId === pid;
                  return (
                    <button
                      key={pid}
                      type="button"
                      onClick={() => setSelectedPlanId(pid)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        active
                          ? 'bg-[var(--bg-surface)] border-[var(--text-primary)] ring-1 ring-[var(--text-primary)]/15'
                          : 'bg-transparent border-[var(--border-hairline)] hover:border-[var(--border-strong)]'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-bold text-[var(--text-primary)]">{p.name}</p>
                        <p className="text-[10px] text-[var(--text-muted)]">
                          Up to {p.maxSeats} seats · {p.aiTokens} AI
                        </p>
                      </div>
                      <span className="font-mono text-xs font-bold tabular-nums text-[var(--text-primary)]">
                        ${p.priceMonthly}/mo
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-[var(--border-hairline)] flex items-center justify-between gap-2 text-xs">
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">Extra Seat Add-ons</p>
                  <p className="text-[10px] text-[var(--text-muted)]">+$12/mo per 10 seats</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setExtraSeats(s => Math.max(0, s - 10))}
                    className="w-7 h-7 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] font-bold cursor-pointer hover:bg-[var(--bg-sage)]"
                  >
                    -
                  </button>
                  <span className="w-10 text-center font-mono font-bold tabular-nums text-[var(--text-primary)]">
                    +{extraSeats}
                  </span>
                  <button
                    type="button"
                    onClick={() => setExtraSeats(s => Math.min(500, s + 10))}
                    className="w-7 h-7 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] font-bold cursor-pointer hover:bg-[var(--bg-sage)]"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Coupon & Totals */}
            <div className="p-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] space-y-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Sandbox / Open-Source Promo Code
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={e => setCouponCode(e.target.value)}
                    placeholder="OSS-GRANT-100, DEV50, OPEN25"
                    className="flex-1 px-3 py-1.5 rounded-xl border text-xs font-mono uppercase"
                  />
                  {couponCode && (
                    <button
                      type="button"
                      onClick={() => setCouponCode('')}
                      className="px-2.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {(['OSS-GRANT-100', 'DEV50', 'OPEN25'] as const).map(code => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setCouponCode(code)}
                      className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[var(--bg-sage)] hover:bg-[var(--bg-sage-hover)] text-[var(--accent-text)] border border-[var(--border-hairline)] cursor-pointer"
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--border-hairline)] space-y-1.5 text-xs">
                <div className="flex justify-between text-[var(--text-secondary)]">
                  <span>
                    {pricing.plan.name} ({billingCycle})
                  </span>
                  <span className="font-mono tabular-nums">{formatMoney(pricing.subtotalCents)}</span>
                </div>
                {pricing.discountPct > 0 && (
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-medium">
                    <span>Discount ({pricing.discountPct}%)</span>
                    <span className="font-mono tabular-nums">
                      -{formatMoney(pricing.subtotalCents - pricing.totalCents)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-baseline pt-2 border-t border-[var(--border-hairline)]">
                  <span className="font-bold text-[var(--text-primary)]">Sandbox Total Due</span>
                  <span className="text-lg font-bold font-mono tabular-nums text-[var(--text-primary)]">
                    {formatMoney(pricing.totalCents)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Payment Rail Tabs + Inputs */}
          <div className="lg:col-span-7 space-y-4">
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                2. Select Payment Rail
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                {methodTabs.map(tab => {
                  const active = paymentMethodType === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setPaymentMethodType(tab.id);
                        setChallengeState(null);
                        setErrorBanner(null);
                      }}
                      className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                        active
                          ? 'bg-[var(--accent-cta)] text-[var(--accent-cta-ink)] border-transparent shadow-xs'
                          : 'bg-[var(--bg-surface-subtle)] border-[var(--border-hairline)] text-[var(--text-primary)] hover:border-[var(--border-strong)]'
                      }`}
                    >
                      <div className="text-[11px] font-bold truncate">{tab.label}</div>
                      <div className={`text-[9px] truncate ${active ? 'opacity-80' : 'text-[var(--text-muted)]'}`}>
                        {tab.sub}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {errorBanner && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
                <ICON_MAP.ExclamationIcon className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">Simulated Gateway Decline</p>
                  <p className="text-[11px] opacity-90">{errorBanner}</p>
                </div>
              </div>
            )}

            {/* 3D Secure or ACH Micro-Deposit Interactive Challenge */}
            {challengeState ? (
              <div className="p-5 rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-sage)] space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[var(--accent-lime)] text-[var(--accent-ink)]">
                      {challengeState.type === '3ds2' ? '3DS2 SCA CHALLENGE' : 'BANK MICRO-DEPOSIT VERIFY'}
                    </span>
                    <h3 className="text-sm font-bold text-[var(--text-primary)] mt-2">
                      {challengeState.type === '3ds2'
                        ? 'Verify Cardholder Identity'
                        : 'Confirm Two-Cent Micro-Deposit Code'}
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{challengeState.message}</p>
                  </div>
                </div>

                {challengeState.type === 'ach_micro_deposit' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                      Micro-Deposit Code (use 00-00)
                    </label>
                    <input
                      type="text"
                      value={achMicroCode}
                      onChange={e => setAchMicroCode(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border text-xs font-mono"
                    />
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setChallengeState(null);
                      setErrorBanner('Authentication cancelled by cardholder.');
                    }}
                  >
                    Fail Authentication
                  </Button>
                  <Button
                    type="button"
                    variant="lime"
                    size="sm"
                    disabled={isSubmitting}
                    onClick={() =>
                      challengeState.type === '3ds2'
                        ? executeCheckout({ threeDsApproved: true })
                        : executeCheckout({ achMicroVerified: true })
                    }
                  >
                    {isSubmitting ? 'Verifying...' : 'Approve & Complete Payment'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] space-y-4">
                {paymentMethodType === 'card' && (
                  <>
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        Quick-Fill Sandbox Test Cards
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                        {[
                          { label: '•••• 4242 · Always Succeeds', num: '4242 4242 4242 4242', out: 'auto' as const },
                          { label: '•••• 3155 · 3DS Challenge', num: '4000 0025 0000 3155', out: 'auto' as const },
                          { label: '•••• 0002 · Declined Funds', num: '4000 0000 0000 0002', out: 'auto' as const },
                        ].map(preset => (
                          <button
                            key={preset.num}
                            type="button"
                            onClick={() => {
                              setCardNumber(preset.num);
                              setSimulateOutcome(preset.out);
                              setErrorBanner(null);
                            }}
                            className="px-2.5 py-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] text-[11px] font-mono text-left text-[var(--text-primary)] cursor-pointer transition-colors"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
                      <div className="sm:col-span-7">
                        <label className="block font-semibold text-[var(--text-secondary)] mb-1">Card Number</label>
                        <input
                          type="text"
                          value={cardNumber}
                          onChange={e => setCardNumber(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border font-mono text-xs"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="block font-semibold text-[var(--text-secondary)] mb-1">Expiry</label>
                        <input
                          type="text"
                          value={cardExp}
                          onChange={e => setCardExp(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border font-mono text-xs"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block font-semibold text-[var(--text-secondary)] mb-1">CVC</label>
                        <input
                          type="text"
                          value={cardCvc}
                          onChange={e => setCardCvc(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border font-mono text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Gateway Outcome Override
                      </label>
                      <select
                        value={simulateOutcome}
                        onChange={e => setSimulateOutcome(e.target.value as any)}
                        className="w-full px-3 py-2 rounded-xl border text-xs"
                      >
                        <option value="auto">Auto-detect from Test Card Number</option>
                        <option value="succeed">Force Immediate Success</option>
                        <option value="3ds_required">Force 3D Secure 2.0 Challenge</option>
                        <option value="decline">Force Insufficient Funds Decline</option>
                      </select>
                    </div>
                  </>
                )}

                {paymentMethodType === 'ach' && (
                  <div className="space-y-3 text-xs">
                    <p className="text-[var(--text-secondary)]">
                      Test US ACH or EU SEPA bank mandate clearance. Use sandbox micro-deposit code{' '}
                      <code className="font-mono font-bold text-[var(--accent-text)]">00-00</code> to verify.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                          Routing / BIC Number
                        </label>
                        <input
                          type="text"
                          value={achRouting}
                          onChange={e => setAchRouting(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border font-mono"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                          Account / IBAN Mask
                        </label>
                        <input
                          type="text"
                          value={achAccount}
                          onChange={e => setAchAccount(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {paymentMethodType === 'wallet' && (
                  <div className="space-y-3 text-xs">
                    <p className="text-[var(--text-secondary)]">
                      Simulate tokenized express digital wallet authorization via passkey / biometric token.
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'apple_pay', label: 'Apple Pay', desc: 'Touch ID Token' },
                        { id: 'google_pay', label: 'Google Pay', desc: 'Device PAN Token' },
                        { id: 'open_link', label: 'OpenLink', desc: '1-Click Passkey' },
                      ].map(w => (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => setWalletProvider(w.id as any)}
                          className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                            walletProvider === w.id
                              ? 'bg-[var(--bg-surface)] border-[var(--text-primary)] ring-1 ring-[var(--text-primary)]/15'
                              : 'border-[var(--border-hairline)] hover:border-[var(--border-strong)]'
                          }`}
                        >
                          <div className="font-bold text-[var(--text-primary)]">{w.label}</div>
                          <div className="text-[10px] text-[var(--text-muted)]">{w.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {paymentMethodType === 'invoice_po' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                        Purchase Order (PO) #
                      </label>
                      <input
                        type="text"
                        value={poNumber}
                        onChange={e => setPoNumber(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                        Legal Entity Name
                      </label>
                      <input
                        type="text"
                        value={companyLegalName}
                        onChange={e => setCompanyLegalName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                        AP Billing Email
                      </label>
                      <input
                        type="email"
                        value={billingEmail}
                        onChange={e => setBillingEmail(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                        Tax ID / VAT
                      </label>
                      <input
                        type="text"
                        value={taxId}
                        onChange={e => setTaxId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border font-mono"
                      />
                    </div>
                  </div>
                )}

                {paymentMethodType === 'oss_grant' && (
                  <div className="space-y-3 text-xs">
                    <div className="p-3 rounded-xl bg-[var(--bg-sage)] border border-[var(--border-strong)] flex items-center justify-between">
                      <div>
                        <p className="font-bold text-[var(--text-primary)]">
                          Open Source &amp; Free Standards Subsidy
                        </p>
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          100% waived sandbox &amp; OSS community grant — zero card details required.
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-[var(--accent-lime)] text-[var(--accent-ink)] font-mono font-bold text-[11px]">
                        $0.00
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                          Public Repository URL
                        </label>
                        <input
                          type="url"
                          value={ossProjectUrl}
                          onChange={e => setOssProjectUrl(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border font-mono"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                          SPDX License
                        </label>
                        <select
                          value={ossLicense}
                          onChange={e => setOssLicense(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border font-mono"
                        >
                          <option value="MIT">MIT</option>
                          <option value="Apache-2.0">Apache-2.0</option>
                          <option value="GPL-3.0">GPL-3.0</option>
                          <option value="MPL-2.0">MPL-2.0</option>
                          <option value="BSD-3-Clause">BSD-3-Clause</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                  Billing Contact Email
                </label>
                <input
                  type="email"
                  value={billingEmail}
                  onChange={e => setBillingEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border"
                />
              </div>
              <div>
                <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                  Tax ID / Reference
                </label>
                <input
                  type="text"
                  value={taxId}
                  onChange={e => setTaxId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <p className="text-[11px] text-[var(--text-muted)]">
            No real charges occur. Transactions &amp; webhook payloads are stored locally in sandbox mode.
          </p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            {!challengeState && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={isSubmitting}
                onClick={() => executeCheckout()}
              >
                {isSubmitting
                  ? 'Processing Sandbox...'
                  : paymentMethodType === 'invoice_po'
                  ? `Issue Net-30 Invoice (${formatMoney(pricing.totalCents)})`
                  : paymentMethodType === 'oss_grant'
                  ? 'Activate Free OSS Grant ($0.00)'
                  : `Pay ${formatMoney(pricing.totalCents)} in Sandbox`}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
