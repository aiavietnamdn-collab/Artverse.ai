/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — Contemporary Creative Gallery Identity Mark
 * Modern Swiss architectural monogram with Ink Navy (#20243A), Electric Cobalt (#3457D5), and Vermilion (#F15B3D)
 */

import React from 'react';

interface ArtverseLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showText?: boolean;
}

export const ArtverseLogo: React.FC<ArtverseLogoProps> = ({
  size = 'md',
  className = '',
  showText = false,
}) => {
  const sizeMap = {
    sm: 'w-8 h-8',
    md: 'w-9 h-9',
    lg: 'w-11 h-11',
    xl: 'w-13 h-13',
  };

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Swiss Architectural Gallery Monogram */}
      <div className={`${sizeMap[size]} relative shrink-0 flex items-center justify-center`}>
        <svg
          viewBox="0 0 40 40"
          className="w-full h-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Ink Navy Outer Structural Square */}
          <rect width="40" height="40" rx="6" fill="#20243A" />
          {/* Electric Cobalt Vertical Pillar */}
          <rect x="6" y="6" width="12" height="28" fill="#3457D5" />
          {/* Warm Ivory Diagonal Gallery Plane */}
          <path d="M18 6H34L22 34H14L18 6Z" fill="#F7F3EA" />
          {/* Vermilion Accent Square */}
          <rect x="25" y="23" width="9" height="11" fill="#F15B3D" />
        </svg>
      </div>

      {showText && (
        <div className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span className="font-display text-base sm:text-lg font-extrabold tracking-tight text-[#20243A]">
            ART VERSE
          </span>
          <span className="text-xs sm:text-sm font-black tracking-widest uppercase text-[#3457D5]">
            AI
          </span>
        </div>
      )}
    </div>
  );
};
