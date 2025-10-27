
import React from 'react';

/**
 * Programmatically navigates to the '#/app' route.
 * Prevents default anchor behavior if an event is passed.
 * @param e Optional React MouseEvent from an anchor tag.
 */
export const navigateToAppRoute = (e?: React.MouseEvent<HTMLAnchorElement>) => {
  if (e) {
    e.preventDefault();
  }
  
  const targetHash = '#/app';

  if (window.location.hash !== targetHash) {
    console.log(`[navigateToAppRoute] Current hash is "${window.location.hash}". Setting hash to "${targetHash}".`);
    window.location.hash = targetHash;
  } else {
    console.log(`[navigateToAppRoute] Already on hash "${targetHash}". No change made or hash change already in progress.`);
    // If already on the target hash, and the page isn't reflecting the correct view (e.g. AuthPage not showing),
    // it's likely an issue within App.tsx's rendering logic or state management concerning `currentUser`.
    // Forcing a hashchange event *could* make App.tsx re-evaluate, but it's generally not a clean solution.
    // window.dispatchEvent(new HashChangeEvent('hashchange', { newURL: window.location.href, oldURL: window.location.href }));
  }
};
