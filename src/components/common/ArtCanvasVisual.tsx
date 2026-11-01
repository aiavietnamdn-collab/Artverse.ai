import React from 'react';

interface ArtCanvasVisualProps {
  type?: 'dongho' | 'watercolor' | 'lacquer' | 'clay' | 'collage' | 'pastel';
  visualType?: 'dongho' | 'watercolor' | 'lacquer' | 'clay' | 'collage' | 'pastel';
  title: string;
  className?: string;
  badgeText?: string;
}

export const ArtCanvasVisual: React.FC<ArtCanvasVisualProps> = ({
  type,
  visualType,
  title,
  className = 'h-48 w-full',
  badgeText
}) => {
  const actualType = visualType || type || 'watercolor';
  switch (actualType) {
    case 'dongho':
      return (
        <div className={`relative overflow-hidden rounded-xl bg-[#F6EDD9] border border-amber-900/15 flex items-center justify-center p-4 ${className}`}>
          {/* Poonah Do paper texture effect */}
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#854d0e_1px,transparent_1px)] [background-size:12px_12px]" />
          
          <svg className="w-full h-full max-h-40" viewBox="0 0 240 160" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Dong Ho Folk Art Rooster & Peony motif */}
            <circle cx="120" cy="80" r="65" fill="#FEF3C7" opacity="0.6" stroke="#92400E" strokeWidth="1.5" strokeDasharray="3 3"/>
            {/* Peony petal curves */}
            <path d="M40 130 C 50 90, 80 85, 95 105 C 105 125, 70 145, 40 130 Z" fill="#DC2626" opacity="0.85" stroke="#7F1D1D" strokeWidth="2.5" />
            <path d="M70 140 C 90 110, 120 115, 125 135 C 120 150, 85 155, 70 140 Z" fill="#D97706" opacity="0.9" stroke="#7F1D1D" strokeWidth="2" />
            {/* Auspicious Dong Ho Rooster stylized form */}
            <path d="M120 135 C 115 110, 130 90, 150 80 C 165 72, 180 85, 185 105 C 190 125, 160 140, 120 135 Z" fill="#2563EB" opacity="0.9" stroke="#1E3A8A" strokeWidth="3" />
            {/* Comb and head */}
            <path d="M170 80 C 170 65, 185 60, 190 70 C 195 62, 205 65, 200 78 C 210 75, 212 85, 202 92 L 180 92 Z" fill="#DC2626" stroke="#7F1D1D" strokeWidth="2.5" />
            {/* Eye */}
            <circle cx="188" cy="78" r="3" fill="#18181B" />
            <circle cx="189" cy="77" r="1" fill="#FFFFFF" />
            {/* Beak */}
            <path d="M202 82 L 215 85 L 202 90 Z" fill="#F59E0B" stroke="#92400E" strokeWidth="2" />
            {/* Tail feathers */}
            <path d="M130 90 C 100 60, 75 80, 60 70 C 85 50, 115 65, 135 85 Z" fill="#059669" stroke="#064E3B" strokeWidth="2.5" />
            <path d="M135 85 C 110 45, 80 55, 75 40 C 100 35, 125 50, 140 80 Z" fill="#D97706" stroke="#78350F" strokeWidth="2.5" />
            <path d="M140 80 C 125 30, 105 35, 105 20 C 125 22, 145 42, 145 75 Z" fill="#DC2626" stroke="#7F1D1D" strokeWidth="2.5" />
            {/* Strong woodcut traditional border */}
            <rect x="8" y="8" width="224" height="144" rx="4" stroke="#78350F" strokeWidth="2.5" fill="none" />
            <rect x="12" y="12" width="216" height="136" rx="2" stroke="#92400E" strokeWidth="1" strokeDasharray="4 4" fill="none" />
          </svg>
          
          <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[11px] font-medium text-amber-950 bg-amber-100/90 backdrop-blur-xs px-2.5 py-1 rounded border border-amber-300">
            <span className="truncate">{title}</span>
            <span className="text-[10px] font-semibold text-amber-800 ml-2 shrink-0">{badgeText || 'Tranh Dân Gian'}</span>
          </div>
        </div>
      );

    case 'watercolor':
      return (
        <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-50 via-indigo-50/60 to-amber-50/40 border border-blue-200/60 flex items-center justify-center p-4 ${className}`}>
          {/* Watercolor wash blooms */}
          <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full bg-blue-300/30 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-indigo-300/25 blur-2xl pointer-events-none" />
          <div className="absolute top-1/2 left-1/3 w-32 h-32 rounded-full bg-amber-200/30 blur-xl pointer-events-none" />
          
          <svg className="w-full h-full max-h-40" viewBox="0 0 240 160" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Horizon and atmospheric mountain washes */}
            <path d="M0 90 Q 60 70, 120 85 T 240 80 L 240 160 L 0 160 Z" fill="#93C5FD" opacity="0.35" />
            <path d="M0 100 Q 80 88, 150 102 T 240 95 L 240 160 L 0 160 Z" fill="#60A5FA" opacity="0.4" />
            {/* Water reflections and river waves */}
            <path d="M0 120 C 70 115, 140 125, 240 118 L 240 160 L 0 160 Z" fill="#3B82F6" opacity="0.35" />
            <path d="M20 135 C 80 130, 160 140, 220 134" stroke="#1D4ED8" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
            <path d="M40 145 C 90 142, 150 148, 200 144" stroke="#1E40AF" strokeWidth="1" strokeLinecap="round" opacity="0.4" />
            {/* Traditional Vietnamese wooden boat silhouette */}
            <path d="M125 118 Q 155 125, 185 116 L 180 126 Q 155 130, 130 125 Z" fill="#1E293B" opacity="0.85" />
            <line x1="150" y1="102" x2="162" y2="124" stroke="#334155" strokeWidth="1.8" />
            {/* Distant palm / coconut silhouettes */}
            <path d="M40 88 C 45 75, 48 65, 52 55 M 52 55 Q 35 50, 25 58 M 52 55 Q 45 42, 40 38 M 52 55 Q 60 40, 68 45 M 52 55 Q 68 52, 75 60" stroke="#047857" strokeWidth="2" strokeLinecap="round" opacity="0.75" />
            <circle cx="190" cy="45" r="18" fill="#F59E0B" opacity="0.25" />
          </svg>

          <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[11px] font-medium text-slate-800 bg-white/85 backdrop-blur-xs px-2.5 py-1 rounded border border-blue-200">
            <span className="truncate">{title}</span>
            <span className="text-[10px] font-semibold text-blue-700 ml-2 shrink-0">{badgeText || 'Màu Nước'}</span>
          </div>
        </div>
      );

    case 'lacquer':
      return (
        <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br from-[#2D0A08] via-[#4A0E0B] to-[#1A0504] border border-amber-600/30 flex items-center justify-center p-4 ${className}`}>
          {/* Gold leaf shimmer effect */}
          <div className="absolute inset-0 bg-[radial-gradient(#F59E0B_1px,transparent_1px)] [background-size:16px_16px] opacity-25" />
          
          <svg className="w-full h-full max-h-40" viewBox="0 0 240 160" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Traditional lacquer deep lotus flower with eggshell and gold leaf accents */}
            <circle cx="120" cy="80" r="50" fill="#78350F" opacity="0.4" />
            {/* Lotus large petals */}
            <path d="M120 30 C 105 55, 95 80, 120 110 C 145 80, 135 55, 120 30 Z" fill="#FDE047" opacity="0.9" stroke="#B45309" strokeWidth="1.5" />
            <path d="M120 110 C 90 95, 75 70, 95 50 C 110 70, 115 95, 120 110 Z" fill="#F59E0B" opacity="0.85" stroke="#78350F" strokeWidth="1.5" />
            <path d="M120 110 C 150 95, 165 70, 145 50 C 130 70, 125 95, 120 110 Z" fill="#F59E0B" opacity="0.85" stroke="#78350F" strokeWidth="1.5" />
            <path d="M120 110 C 70 100, 60 75, 75 60 C 90 80, 105 100, 120 110 Z" fill="#DC2626" opacity="0.75" stroke="#991B1B" strokeWidth="1.2" />
            <path d="M120 110 C 170 100, 180 75, 165 60 C 150 80, 135 100, 120 110 Z" fill="#DC2626" opacity="0.75" stroke="#991B1B" strokeWidth="1.2" />
            {/* Lotus leaf rim */}
            <ellipse cx="60" cy="120" rx="45" ry="18" fill="#14532D" opacity="0.8" stroke="#15803D" strokeWidth="1.5" />
            <ellipse cx="180" cy="125" rx="40" ry="16" fill="#14532D" opacity="0.8" stroke="#15803D" strokeWidth="1.5" />
            {/* Eggshell mosaic inlay effect */}
            <circle cx="120" cy="75" r="7" fill="#FEF3C7" stroke="#92400E" strokeWidth="1" />
            <circle cx="116" cy="71" r="2" fill="#FFFFFF" />
            <circle cx="124" cy="78" r="1.5" fill="#FFFFFF" />
          </svg>

          <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[11px] font-medium text-amber-100 bg-black/75 backdrop-blur-xs px-2.5 py-1 rounded border border-amber-600/40">
            <span className="truncate">{title}</span>
            <span className="text-[10px] font-semibold text-amber-300 ml-2 shrink-0">{badgeText || 'Sơn Mài'}</span>
          </div>
        </div>
      );

    case 'clay':
      return (
        <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br from-[#E2D4C3] via-[#D8C4B0] to-[#C9B19A] border border-amber-700/20 flex items-center justify-center p-4 ${className}`}>
          <svg className="w-full h-full max-h-40" viewBox="0 0 240 160" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Sculptural clay pedestal */}
            <ellipse cx="120" cy="135" rx="70" ry="14" fill="#A88B74" opacity="0.7" />
            <ellipse cx="120" cy="132" rx="65" ry="12" fill="#BA9C85" />
            {/* Clay figurine / pottery vase body */}
            <path d="M90 128 C 80 95, 75 75, 100 55 C 105 50, 135 50, 140 55 C 165 75, 160 95, 150 128 Z" fill="#C25E3E" stroke="#87351D" strokeWidth="2" />
            {/* Ceramic neck and rim */}
            <path d="M102 55 L 102 38 Q 120 34, 138 38 L 138 55 Z" fill="#9C4428" stroke="#712B16" strokeWidth="2" />
            <ellipse cx="120" cy="38" rx="18" ry="5" fill="#E48566" stroke="#712B16" strokeWidth="1.5" />
            {/* Hand-shaped relief motifs & folk animal eyes */}
            <circle cx="120" cy="85" r="16" fill="#F59E0B" stroke="#B45309" strokeWidth="1.5" />
            <circle cx="120" cy="85" r="8" fill="#10B981" />
            <path d="M95 105 Q 120 115, 145 105" stroke="#712B16" strokeWidth="2.5" strokeLinecap="round" />
            {/* Clay texture stamps */}
            <circle cx="100" cy="72" r="3" fill="#712B16" opacity="0.6" />
            <circle cx="140" cy="72" r="3" fill="#712B16" opacity="0.6" />
          </svg>

          <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[11px] font-medium text-amber-950 bg-amber-50/90 backdrop-blur-xs px-2.5 py-1 rounded border border-amber-300">
            <span className="truncate">{title}</span>
            <span className="text-[10px] font-semibold text-amber-800 ml-2 shrink-0">{badgeText || 'Điêu Khắc Đất'}</span>
          </div>
        </div>
      );

    case 'collage':
      return (
        <div className={`relative overflow-hidden rounded-xl bg-[#F0EBE1] border border-stone-300 flex items-center justify-center p-4 ${className}`}>
          {/* Collage layered torn paper fragments */}
          <div className="absolute top-4 left-6 w-28 h-20 bg-emerald-700/80 -rotate-6 rounded-sm shadow-sm" />
          <div className="absolute top-8 right-8 w-24 h-24 bg-amber-500/85 rotate-12 rounded-sm shadow-sm" />
          <div className="absolute bottom-5 left-14 w-32 h-16 bg-rose-600/80 rotate-3 rounded-sm shadow-sm" />
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-36 h-28" viewBox="0 0 160 120" fill="none">
              <path d="M30 90 L 80 20 L 130 90 Z" fill="#0284C7" opacity="0.8" stroke="#0369A1" strokeWidth="2" strokeDasharray="4 2" />
              <circle cx="80" cy="65" r="22" fill="#FBBF24" opacity="0.9" />
              <rect x="55" y="55" width="50" height="40" fill="#15803D" opacity="0.75" transform="rotate(-10 80 75)" />
            </svg>
          </div>

          <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[11px] font-medium text-stone-900 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded border border-stone-300">
            <span className="truncate">{title}</span>
            <span className="text-[10px] font-semibold text-rose-700 ml-2 shrink-0">{badgeText || 'Xé Dán'}</span>
          </div>
        </div>
      );

    case 'pastel':
    default:
      return (
        <div className={`relative overflow-hidden rounded-xl bg-slate-100 border border-slate-300 flex items-center justify-center p-4 ${className}`}>
          <svg className="w-full h-full max-h-40" viewBox="0 0 240 160" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="120" cy="130" rx="80" ry="12" fill="#CBD5E1" />
            {/* Charcoal / Pastel Still Life */}
            <path d="M100 125 C 90 90, 85 70, 105 45 L 135 45 C 155 70, 150 90, 140 125 Z" fill="#64748B" opacity="0.7" stroke="#334155" strokeWidth="2" />
            <circle cx="165" cy="120" r="16" fill="#EF4444" opacity="0.8" stroke="#991B1B" strokeWidth="1.5" />
            <path d="M165 104 C 165 98, 172 95, 176 96" stroke="#15803D" strokeWidth="2" strokeLinecap="round" />
            {/* Hatching shading lines */}
            <line x1="98" y1="90" x2="115" y2="95" stroke="#1E293B" strokeWidth="1" opacity="0.5" />
            <line x1="96" y1="100" x2="118" y2="105" stroke="#1E293B" strokeWidth="1" opacity="0.5" />
            <line x1="95" y1="110" x2="120" y2="115" stroke="#1E293B" strokeWidth="1" opacity="0.5" />
          </svg>

          <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[11px] font-medium text-slate-800 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded border border-slate-300">
            <span className="truncate">{title}</span>
            <span className="text-[10px] font-semibold text-slate-700 ml-2 shrink-0">{badgeText || 'Phấn Tiên / Chì'}</span>
          </div>
        </div>
      );
  }
};
