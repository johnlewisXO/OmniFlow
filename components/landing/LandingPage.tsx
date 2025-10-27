import React from 'react';
import { LandingHeader } from './LandingHeader';
import { HeroSection } from './HeroSection';
import { ICON_MAP } from '../../constants'; 
import { PricingTierCard } from './PricingTierCard';
import { LandingFooter } from './LandingFooter';

// --- INLINE COMPONENTS FOR MODERN LANDING PAGE ---

const Section: React.FC<{ 
  id: string; 
  title: React.ReactNode; 
  subtitle?: string;
  children: React.ReactNode; 
  className?: string; 
  contentClassName?: string;
}> = ({ id, title, subtitle, children, className = '', contentClassName = '' }) => (
  <section id={id} className={`py-20 md:py-28 relative overflow-hidden ${className}`}>
    <div className="container mx-auto px-4 md:px-6 relative z-10">
      <div className="text-center mb-12 md:mb-16 animate-floatUp" style={{ animationDelay: '150ms' }}>
        <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-50 text-shadow-md">
          {title}
        </h2>
        {subtitle && <p className="mt-3 md:mt-4 text-lg md:text-xl text-slate-300 max-w-3xl mx-auto">{subtitle}</p>}
      </div>
      <div className={contentClassName}>
        {children}
      </div>
    </div>
  </section>
);

interface FeatureCardProps {
    iconName: keyof typeof ICON_MAP;
    title: string;
    description: string;
}
const FeatureCard: React.FC<FeatureCardProps> = ({ iconName, title, description }) => {
    const Icon = ICON_MAP[iconName];
    return (
        <div className="feature-card animate-floatUp">
            <div className="feature-icon-wrapper">
                <Icon className="w-7 h-7 text-neon-accent" />
            </div>
            <h3 className="text-lg font-bold text-slate-50 mt-4 mb-2">{title}</h3>
            <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
        </div>
    );
};

const TestimonialCard: React.FC<{ quote: string; author: string; role: string; avatarPlaceholder?: string }> = ({ quote, author, role, avatarPlaceholder }) => (
  <div className="h-full bg-slate-900/40 p-6 md:p-8 rounded-xl border border-landing-border flex flex-col justify-center items-center text-center animate-floatUp">
    <p className="text-lg italic text-slate-200 mb-6">"{quote}"</p>
    <div className="flex items-center">
      <div className="w-11 h-11 rounded-full bg-slate-700 flex items-center justify-center text-neon-accent font-bold text-base mr-3 border-2 border-slate-600">
        {avatarPlaceholder || author.charAt(0)}
      </div>
      <div>
        <p className="font-semibold text-slate-100">{author}</p>
        <p className="text-xs text-slate-400">{role}</p>
      </div>
    </div>
  </div>
);

const FAQItem: React.FC<{ question: string; answer: string }> = ({ question, answer }) => {
  const ChevronDownIcon = ICON_MAP.ChevronDownIcon;
  return (
    <details className="group border-b border-landing-border last:border-b-0 py-4 animate-floatUp">
      <summary className="font-semibold text-base md:text-lg text-slate-100 cursor-pointer list-none flex justify-between items-center group-hover:text-neon-accent transition-colors">
        <span>{question}</span>
        <ChevronDownIcon className="w-5 h-5 text-neon-accent transition-transform duration-300 transform group-open:rotate-180" />
      </summary>
      <div className="pt-3 pb-1 text-slate-300 text-sm md:text-base animate-faqOpen">
        <p>{answer}</p>
      </div>
    </details>
  );
};

// --- DATA FOR NEW COMPONENTS ---

const features: { iconName: keyof typeof ICON_MAP; title: string; description: string; }[] = [
    {
        iconName: "SparklesIcon",
        title: "Intelligent Task Generation",
        description: "Describe your goals in plain language and let our AI create detailed, actionable tasks for your team."
    },
    {
        iconName: "ChartBarIcon",
        title: "Predictive Timelines",
        description: "Leverage machine learning to forecast project completion dates and identify potential bottlenecks before they happen."
    },
    {
        iconName: "CogIcon",
        title: "Automated Workflows",
        description: "Eliminate repetitive work. Create custom rules to automate task assignments, status updates, and notifications."
    },
    {
        iconName: "UserGroupIcon",
        title: "Unified Workspace",
        description: "A central hub for real-time collaboration with integrated chat, file sharing, and clear role assignments."
    },
    {
        iconName: "HomeIcon",
        title: "Dynamic Dashboards",
        description: "Get a clear, real-time overview of project health and team performance with customizable widgets."
    },
    {
        iconName: "CodeBracketIcon",
        title: "Seamless Integrations",
        description: "Connect Omni Flow with your favorite tools like Slack, GitHub, and Figma to create a cohesive ecosystem."
    }
];


// --- MAIN LANDING PAGE COMPONENT ---

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col antialiased">
      <LandingHeader />
      <main className="flex-grow">
        <HeroSection />

        <Section 
          id="features" 
          title={<>An Entirely New Caliber of <span className="text-gradient-neon">Workflow</span></>}
          subtitle="Omni Flow isn't just another tool—it's your team's intelligent command center."
          className="bg-landing-bg-darker"
        >
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {features.map((feature, i) => (
                  <div key={feature.title} style={{ animationDelay: `${100 * (i + 1)}ms`}}>
                      <FeatureCard {...feature} />
                  </div>
              ))}
          </div>
        </Section>

        <Section 
          id="pricing" 
          title="Simple, Transparent Pricing"
          subtitle="Choose the plan that fits your team's ambition. Start free, scale anytime. No hidden fees."
        >
          <div className="grid md:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto">
            <div className="animate-floatUp" style={{ animationDelay: '100ms' }}><PricingTierCard planName="Starter" price="$0" pricePeriod="Forever Free" features={["Up to 3 Projects", "5 Users", "Core Task Management", "AI Title Suggestions", "Basic Reporting", "Community Support"]} ctaText="Get Started Free" ctaLink="#/app" /></div>
            <div className="animate-floatUp" style={{ animationDelay: '200ms' }}><PricingTierCard planName="Pro" price="$12" pricePeriod="per user / month" features={["Unlimited Projects", "Unlimited Users", "Advanced Workflows & Automation", "Full AI Assistant & Insights", "Gantt Charts & Timelines", "Priority Support", "Key Integrations"]} ctaText="Start Pro Trial" ctaLink="#/app" isPopular /></div>
            <div className="animate-floatUp" style={{ animationDelay: '300ms' }}><PricingTierCard planName="Enterprise" price="Let's Talk" pricePeriod="Custom Solutions" features={["Everything in Pro, plus:", "Dedicated Account Manager", "Advanced Security & SSO", "Custom Integrations & API Access", "Personalized Onboarding & SLAs", "Volume Discounts & Custom Terms"]} ctaText="Contact Sales" ctaLink="#contact" /></div>
          </div>
        </Section>
        
        <Section 
            id="testimonials" 
            title="Loved by High-Performance Teams"
            subtitle="See how Omni Flow is helping businesses streamline their project management and boost productivity."
            className="bg-landing-bg-darker"
        >
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                <TestimonialCard quote="Omni Flow revolutionized how we manage complex projects. The AI suggestions are a game-changer and the UI is just beautiful!" author="Sarah Chen, CEO" role="Innovatech Solutions" avatarPlaceholder="SC" />
                <TestimonialCard quote="Finally, a project management tool that's both powerful and intuitive. Our team's productivity has soared since adopting Omni Flow." author="Mike Rodriguez, Product Lead" role="Creative Spark Studios" avatarPlaceholder="MR" />
                <TestimonialCard quote="The collaboration features are top-notch, and the visual dashboards make tracking progress incredibly easy. Highly recommend!" author="Jessica Williams, Marketing Director" role="Momentum Growth Agency" avatarPlaceholder="JW" />
            </div>
        </Section>

        <Section 
            id="faq" 
            title="Frequently Asked Questions"
            subtitle="Find quick answers to common questions about Omni Flow and its features."
            contentClassName="max-w-3xl mx-auto"
        >
            <div className="space-y-2">
                <FAQItem question="What makes Omni Flow different?" answer="Omni Flow uniquely combines a beautifully intuitive interface with powerful AI-driven automation and insights. We focus on streamlining your workflow so you can focus on impactful work, not just managing tasks." />
                <FAQItem question="Is there a free trial for the Pro plan?" answer="Yes! We offer a 14-day free trial for our Pro plan, no credit card required. You can experience all the advanced features and see if Omni Flow is the right fit for your team before committing." />
                <FAQItem question="Can I import my existing projects?" answer="Absolutely. We provide easy-to-use import tools for popular formats like CSV. Direct integrations with other platforms are on our near-term roadmap to make your transition seamless." />
                <FAQItem question="How does the AI work and is my data secure?" answer="Our AI helps with task generation, scheduling, and identifying bottlenecks. We take data security very seriously; all AI processing is done in compliance with strict privacy standards, and your project data remains confidential." />
            </div>
        </Section>
      </main>
      <LandingFooter />
    </div>
  );
};

export default LandingPage;
