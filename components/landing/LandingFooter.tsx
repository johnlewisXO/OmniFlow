import React from 'react';
import { ICON_MAP } from '../../constants';

const SocialIconPlaceholder: React.FC<{ platform: string; className?: string }> = ({ platform, className="w-5 h-5" }) => {
    if (platform === 'Twitter') return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></svg>;
    if (platform === 'LinkedIn') return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"></path></svg>;
    if (platform === 'Facebook') return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"></path></svg>;
    return <div className={`w-5 h-5 rounded bg-slate-600 flex items-center justify-center text-xs`}>{platform.charAt(0)}</div>;
};

export const LandingFooter: React.FC = () => {
  const SparklesIcon = ICON_MAP.SparklesIcon;

  const footerLinkGroups = [
    { title: 'Product', links: [ { label: 'Features', href: '#features' }, { label: 'Pricing', href: '#pricing' }, { label: 'Integrations', href: '#' }, ] },
    { title: 'Company', links: [ { label: 'About Us', href: '#about' }, { label: 'Careers', href: '#' }, { label: 'Contact Us', href: '#contact' }, ] },
    { title: 'Resources', links: [ { label: 'Blog', href: '#' }, { label: 'Help Center', href: '#' }, { label: 'API Docs', href: '#' }, ] },
    { title: 'Legal', links: [ { label: 'Privacy Policy', href: '#' }, { label: 'Terms of Service', href: '#' }, ] },
  ];

  const socialLinks = [ { platform: 'Twitter', href: '#' }, { platform: 'LinkedIn', href: '#' }, { platform: 'Facebook', href: '#' } ];

  return (
    <footer className="bg-landing-bg-darker border-t border-landing-border">
      <div className="container mx-auto px-4 md:px-6 py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8 mb-8">
          <div className="col-span-2 mb-6 md:mb-0">
            <a href="#" className="flex items-center space-x-2 mb-3" aria-label="Omniflow Home">
              <SparklesIcon className="w-7 h-7 text-neon-accent" />
              <span className="text-xl font-bold font-display text-slate-100">Omni Flow</span>
            </a>
            <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
              The intelligent project management hub.
            </p>
          </div>

          {footerLinkGroups.map((group) => (
            <div key={group.title}>
              <h5 className="font-semibold text-slate-200 mb-3 text-sm tracking-wider uppercase">{group.title}</h5>
              <ul className="space-y-2">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="text-sm text-slate-400 hover:text-neon-accent transition-colors">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-landing-border pt-6 flex flex-col sm:flex-row justify-between items-center">
          <p className="text-xs text-slate-500 mb-4 sm:mb-0">
            &copy; {new Date().getFullYear()} Omni Flow Technologies Inc. All rights reserved.
          </p>
          <div className="flex space-x-5">
            {socialLinks.map((social) => (
              <a 
                key={social.platform} 
                href={social.href} 
                className="text-slate-400 hover:text-neon-accent transition-colors"
                aria-label={`Omniflow on ${social.platform}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <SocialIconPlaceholder platform={social.platform} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};
