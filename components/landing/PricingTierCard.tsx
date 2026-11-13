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
      className={`relative bg-[#171A14]/90 p-6 md:p-8 rounded-2xl flex flex-col
                  border ${isPopular ? 'border-[#CCF048]/60 shadow-[0_16px_40px_-16px_rgba(204,240,72,0.25)]' : 'border-[#2B3026]'} 
                  transition-all duration-300 transform hover:-translate-y-1.5 ${className}`}
    >
      {isPopular && (
        <div className="absolute top-0 -translate-y-1/2 left-1/2 -translate-x-1/2 bg-[#CCF048] text-[#131511] text-xs font-bold px-4 py-1.5 rounded-full tracking-wide uppercase shadow-lg">
          Most Popular
        </div>
      )}
      <h3 className={`font-display text-2xl font-semibold mb-2 mt-4 ${isPopular ? 'text-[#CCF048]' : 'text-[#F2F3EE]'}`}>
        {planName}
      </h3>
      <p className="font-display text-4xl font-bold text-[#F2F3EE] mb-1 tabular-nums">{price}</p>
      <p className="text-sm text-[#A6AC9C] mb-6 h-4">{pricePeriod}</p>
      
      <div className="w-full h-px bg-[#2B3026] my-6"></div>

      <ul className="space-y-3 text-sm flex-grow">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start">
            <CheckIconMini className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0 text-[#CCF048]" />
            <span className="text-[#D6DACF]">{feature}</span>
          </li>
        ))}
      </ul>
      
      <a 
        href={correctedCtaLink} 
        onClick={isAppRouteLink ? navigateToAppRoute : undefined}
        className={`block mt-8 py-3 px-6 rounded-full text-base font-semibold text-center transition-all duration-300
                    ${isPopular ? 'bg-[#CCF048] hover:bg-[#D9F66A] text-[#131511]' : 'bg-[#24291F] hover:bg-[#2E3427] text-[#F2F3EE] border border-[#3B4234]'}`}
      >
        {ctaText}
      </a>
    </div>
  );
};
