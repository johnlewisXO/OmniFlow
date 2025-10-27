
import React from 'react';

interface AnimatedShapeProps {
  type: 'cube' | 'sphere' | 'wireframe' | 'pyramid';
  shapeForm?: 'cube' | 'sphere' | 'pyramid'; 
  className?: string; // Will include 'opacity-0 animate-heroItemBounceIn' for entrance
  style?: React.CSSProperties; // Will include animationDelay for entrance
  animationStyle?: string; // For continuous animations like float, rotate
  glowColor?: string; 
}

export const AnimatedShape: React.FC<AnimatedShapeProps> = ({
  type,
  shapeForm = 'cube',
  className = '', // This receives 'opacity-0 animate-heroItemBounceIn' from HeroSection
  style = {},     // This receives animationDelay for heroItemBounceIn from HeroSection
  animationStyle = 'animate-subtleRotate animate-float', // Default continuous animations
  glowColor,
}) => {
  let shapeSpecificClass = '';
  const dynamicStyle: React.CSSProperties = { ...style }; 

  // Set CSS variable for glow color, used by pulseGlow animation and shape borders/bg
  let effectiveGlowRgb = '220, 180, 255'; // Default glow (light purple/blue)
  if (glowColor) {
    const match = glowColor.match(/hsla?\((\d+),\s*([\d.]+)%,\s*([\d.]+)%/);
    if (match) {
      effectiveGlowRgb = `${match[1]}, ${match[2]}%, ${match[3]}%`;
    }
  }
  dynamicStyle['--shape-glow-rgb' as any] = effectiveGlowRgb;


  if (type === 'cube') {
    shapeSpecificClass = 'shape-cube';
  } else if (type === 'sphere') {
    shapeSpecificClass = 'shape-sphere';
  } else if (type === 'pyramid') {
    shapeSpecificClass = 'shape-pyramid';
  } else if (type === 'wireframe') {
    shapeSpecificClass = 'shape-wireframe';
    if (shapeForm === 'sphere') {
      shapeSpecificClass += ' rounded-full'; // Make wireframe sphere round
    }
    // Wireframes use direct border color from CSS variable for consistency
  }
  
  // The `className` from props includes entrance animation classes (e.g., 'opacity-0 animate-heroItemBounceIn').
  // `animationStyle` from props is for the *continuous* animations like float/rotate.
  // These are applied together. Tailwind's animation utility ensures 'forwards' for heroItemBounceIn.
  // The continuous animations will loop indefinitely after the entrance animation has played.

  return (
    <div
      className={`animated-shape ${shapeSpecificClass} ${animationStyle} ${className}`}
      style={dynamicStyle}
    >
      {/* Shapes are styled via CSS using the --shape-glow-rgb variable */}
    </div>
  );
};
