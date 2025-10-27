import React from 'react';
import { ICON_MAP } from '../../constants'; 
import { navigateToAppRoute } from '../../utils/navigation';

interface PricingTierCardProps {
  planName: string;
  price: string;
  pricePeriod: string;
  features: string[];
  ctaText: string;
  ctaLink: string;
  isPopular?: boolean;
  className?: string;
}

const CheckIconMini: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className || "w-5 h-5"}>
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.06 0l4-5.5z" clipRule="evenodd" />
    </svg>
);

export const PricingTierCard: React.FC<PricingTierCardProps> = ({
  planName,
  price,
  pricePeriod,
  features,
  ctaText,
  ctaLink, 
  isPopular = false,
  className = '',
}) => {
  const correctedCtaLink = ctaLink.startsWith('/#') ? ctaLink.substring(1) : ctaLink;
  const isAppRouteLink = correctedCtaLink === '#/app';

  return (
    <div 
      className={`relative bg-slate-900/40 p-6 md:p-8 rounded-2xl flex flex-col
                  border ${isPopular ? 'border-neon-accent shadow-neon-glow/20' : 'border-landing-border'} 
                  transition-all duration-300 transform hover:-translate-y-1.5 hover:shadow-card-hover-landing ${className}`}
    >
      {isPopular && (
        <div className="absolute top-0 -translate-y-1/2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-neon-accent to-neon-accent-secondary text-white text-xs font-bold px-4 py-1.5 rounded-full tracking-wide uppercase shadow-lg">
          Most Popular
        </div>
      )}
      <h3 className={`font-display text-2xl font-semibold mb-2 mt-4 ${isPopular ? 'text-neon-accent' : 'text-slate-100'}`}>
        {planName}
      </h3>
      <p className="font-display text-4xl font-bold text-slate-50 mb-1">{price}</p>
      <p className="text-sm text-slate-400 mb-6 h-4">{pricePeriod}</p>
      
      <div className="w-full h-px bg-landing-border my-6"></div>

      <ul className="space-y-3 text-sm flex-grow">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start">
            <CheckIconMini className={`w-5 h-5 mr-2 mt-0.5 flex-shrink-0 text-neon-accent`} />
            <span className="text-slate-300">{feature}</span>
          </li>
        ))}
      </ul>
      
      <a 
        href={correctedCtaLink} 
        onClick={isAppRouteLink ? navigateToAppRoute : undefined}
        className={`block mt-8 py-3 px-6 rounded-lg text-base font-semibold text-center transition-all duration-300 transform hover:scale-105
                    ${isPopular ? 'hero-cta-primary' : 'hero-cta-secondary'}`}
      >
        {ctaText}
      </a>
    </div>
  );
};
