/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — Digital Art Museum Identity Logo Component
 * Biểu tượng vuông nhận diện khung tranh cách điệu và hình khối nghệ thuật sắc màu
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
  showText = false
}) => {
  const sizeMap = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Museum Framed Art Icon */}
      <div className={`${sizeMap[size]} shrink-0 rounded-xl overflow-hidden shadow-sm hover:scale-105 transition-transform duration-200`}>
        <svg viewBox="0 0 512 512" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="compBg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0F172A" />
              <stop offset="50%" stopColor="#1E1B4B" />
              <stop offset="100%" stopColor="#1E293B" />
            </linearGradient>
            <linearGradient id="compGold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FCD34D" />
              <stop offset="40%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>
            <linearGradient id="compSun" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FDE047" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
            <linearGradient id="compBlue" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#2563EB" />
            </linearGradient>
            <linearGradient id="compCoral" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FB7185" />
              <stop offset="100%" stopColor="#E11D48" />
            </linearGradient>
            <linearGradient id="compEmerald" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#34D399" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="compViolet" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#C084FC" />
              <stop offset="100%" stopColor="#7C3AED" />
            </linearGradient>
          </defs>

          {/* Icon Base */}
          <rect width="512" height="512" rx="100" fill="url(#compBg)" />

          {/* Stylized Picture Frame */}
          <rect x="76" y="76" width="360" height="360" rx="36" fill="none" stroke="url(#compGold)" strokeWidth="22" strokeLinejoin="round" />
          <rect x="98" y="98" width="316" height="316" rx="22" fill="#0B0F19" />

          {/* Abstract Art Shapes */}
          <path d="M124 380 L124 280 C124 235 160 200 205 200 C250 200 286 235 286 280 L286 380 Z" fill="url(#compEmerald)" fillOpacity="0.9" />
          <path d="M210 380 L388 380 L388 230 C388 230 320 280 210 380 Z" fill="url(#compBlue)" />
          <path d="M140 380 L370 150 L340 130 L120 340 Z" fill="url(#compViolet)" fillOpacity="0.85" />
          <circle cx="316" cy="196" r="62" fill="url(#compSun)" />
          <polygon points="170,290 270,160 300,310" fill="url(#compCoral)" />

          {/* Digital Spark */}
          <path d="M256 220 Q256 256 220 256 Q256 256 256 292 Q256 256 292 256 Q256 256 256 220 Z" fill="#FFFFFF" />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col">
          <span className="text-base font-extrabold tracking-tight text-slate-900 leading-none">
            ARTVERSE <span className="text-purple-600">AI</span>
          </span>
          <span className="text-[10px] text-slate-500 font-semibold tracking-wide uppercase mt-0.5">
            Bảo tàng Nghệ thuật Số
          </span>
        </div>
      )}
    </div>
  );
};
