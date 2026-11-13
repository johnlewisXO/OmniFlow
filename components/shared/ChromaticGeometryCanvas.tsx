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
          darkMode ? 'bg-[#131511]' : 'bg-[#F4F4EF]'
        }`}
      />

      {/* 1. Top-Left Soft Sage Glow */}
      <div
        className={`absolute -top-16 -left-16 w-80 h-80 sm:w-96 sm:h-96 md:w-[460px] md:h-[460px] rounded-full transition-opacity duration-500 ${
          darkMode
            ? 'bg-gradient-to-br from-[#3B4B24] via-[#273119] to-[#1A2013] opacity-55'
            : 'bg-gradient-to-br from-[#D9E7BA] via-[#C3D895] to-[#E9EDE2] opacity-75'
        }`}
        style={{ filter: 'blur(36px)' }}
      />

      {/* 2. Top-Right Lime & Moss Prism */}
      <div
        className={`absolute -top-24 right-[10%] sm:right-[18%] md:right-[22%] w-[420px] sm:w-[560px] md:w-[680px] h-72 sm:h-88 md:h-96 rounded-[52px] rotate-[-16deg] transition-opacity duration-500 ${
          darkMode
            ? 'bg-gradient-to-r from-[#2E3A1C] via-[#465A27] to-[#242C18] opacity-40'
            : 'bg-gradient-to-r from-[#E4F39C] via-[#D6E7B0] to-[#E9EDE2] opacity-60'
        }`}
        style={{ filter: 'blur(32px)' }}
      />

      {/* 3. Bottom-Left Warm Stone & Lime Sphere */}
      <div
        className={`absolute -bottom-20 -left-12 w-72 h-72 sm:w-88 sm:h-88 md:w-[400px] md:h-[400px] rounded-full transition-opacity duration-500 ${
          darkMode
            ? 'bg-gradient-to-tr from-[#3E4C23] via-[#2B341C] to-[#1D2118] opacity-50'
            : 'bg-gradient-to-tr from-[#DCE6B8] via-[#E5F29E] to-[#F0F2E8] opacity-70'
        }`}
        style={{ filter: 'blur(30px)' }}
      />

      {/* 4. Center-Bottom Soft Moss Glow */}
      <div
        className={`absolute bottom-4 left-[28%] sm:left-[35%] w-[380px] sm:w-[500px] h-64 sm:h-80 rounded-full transition-opacity duration-500 ${
          darkMode
            ? 'bg-gradient-to-r from-[#2D381C] via-[#3F4E24] to-[#1D2118] opacity-30'
            : 'bg-gradient-to-r from-[#E3EEB0] via-[#D8E5C0] to-[#EDEFE5] opacity-45'
        }`}
        style={{ filter: 'blur(64px)' }}
      />

      {/* 5. Upper-Right Subtle Stone Highlight Orb */}
      <div
        className={`absolute top-10 sm:top-14 right-10 sm:right-24 w-28 h-28 sm:w-36 sm:h-36 rounded-full transition-opacity duration-500 ${
          darkMode
            ? 'bg-gradient-to-br from-[#CCF048]/25 to-[#3B4234]/20 opacity-30'
            : 'bg-gradient-to-br from-white to-[#DFE8C3] opacity-65'
        }`}
        style={{ filter: 'blur(18px)' }}
      />
    </div>
  );
};
