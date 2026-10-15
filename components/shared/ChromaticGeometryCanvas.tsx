import React from 'react';
import { useAppStore } from '../../hooks/useAppStore';

export const ChromaticGeometryCanvas: React.FC = () => {
  const { darkMode } = useAppStore();

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none"
    >
      {/* Base Canvas */}
      <div
        className={`absolute inset-0 transition-colors duration-500 ${
          darkMode ? 'bg-[#060913]' : 'bg-[#EBF1FA]'
        }`}
      />

      {/* 1. Top-Left Electric Cyan Circle (Positioned behind the upper sidebar & workspace title) */}
      <div
        className={`absolute -top-16 -left-16 w-80 h-80 sm:w-96 sm:h-96 md:w-[460px] md:h-[460px] rounded-full transition-opacity duration-500 ${
          darkMode
            ? 'bg-gradient-to-br from-[#00D2FF] via-[#0085FF] to-[#0051FF] opacity-55'
            : 'bg-gradient-to-br from-[#38BDF8] via-[#0284C7] to-[#0369A1] opacity-70'
        }`}
        style={{ filter: 'blur(30px)' }}
      />

      {/* 2. Top-Right Angled Royal Indigo / Violet Prism (Slab passing behind top bar & upper cards) */}
      <div
        className={`absolute -top-24 right-[10%] sm:right-[18%] md:right-[22%] w-[420px] sm:w-[560px] md:w-[680px] h-72 sm:h-88 md:h-96 rounded-[52px] rotate-[-16deg] transition-opacity duration-500 ${
          darkMode
            ? 'bg-gradient-to-r from-[#2563EB] via-[#4F46E5] to-[#7C3AED] opacity-45'
            : 'bg-gradient-to-r from-[#60A5FA] via-[#818CF8] to-[#A78BFA] opacity-65'
        }`}
        style={{ filter: 'blur(28px)' }}
      />

      {/* 3. Bottom-Left Sunset Coral Sphere (Positioned behind bottom sidebar area & user card) */}
      <div
        className={`absolute -bottom-20 -left-12 w-72 h-72 sm:w-88 sm:h-88 md:w-[400px] md:h-[400px] rounded-full transition-opacity duration-500 ${
          darkMode
            ? 'bg-gradient-to-tr from-[#FF3366] via-[#FF5E62] to-[#FFA07A] opacity-60'
            : 'bg-gradient-to-tr from-[#F43F5E] via-[#FB7185] to-[#FDBA74] opacity-75'
        }`}
        style={{ filter: 'blur(26px)' }}
      />

      {/* 4. Center-Bottom Warm Amber / Peach Glow (Diffusing warm light through card interstices) */}
      <div
        className={`absolute bottom-4 left-[28%] sm:left-[35%] w-[380px] sm:w-[500px] h-64 sm:h-80 rounded-full transition-opacity duration-500 ${
          darkMode
            ? 'bg-gradient-to-r from-[#F59E0B] via-[#EA580C] to-[#E11D48] opacity-25'
            : 'bg-gradient-to-r from-[#FBBF24] via-[#F97316] to-[#FB7185] opacity-35'
        }`}
        style={{ filter: 'blur(64px)' }}
      />

      {/* 5. Upper-Right Soft Silver / Moon Orb (Matches the circular orb in the top right of the reference) */}
      <div
        className={`absolute top-10 sm:top-14 right-10 sm:right-24 w-28 h-28 sm:w-36 sm:h-36 rounded-full transition-opacity duration-500 ${
          darkMode
            ? 'bg-gradient-to-br from-slate-200 to-indigo-200 opacity-25'
            : 'bg-gradient-to-br from-white to-blue-200 opacity-60'
        }`}
        style={{ filter: 'blur(16px)' }}
      />
    </div>
  );
};
