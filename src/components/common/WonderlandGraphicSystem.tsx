/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — WONDERLAND OF ART (THẾ GIỚI MĨ THUẬT DIỆU KỲ)
 * Custom 2D Illustration, Paint-Stroke Banners, Memphis Shapes & Grade 1–9 Color Identity System
 */

import React from 'react';

export interface GradeWonderlandTheme {
  classId: string;
  gradeNumber: number;
  label: string;
  shortTitle: string;
  creativeTheme: string;
  description: string;
  primaryHex: string;
  secondaryHex: string;
  pastelBgHex: string;
  borderHex: string;
  badgeGradient: string;
  textAccentClass: string;
  artFrameBorder: string;
  artFrameShadow: string;
  badgeBg: string;
  tileBg: string;
  tileBottomShadow: string;
  cardBg: string;
  cardBorder: string;
  worldTitle: string;
  worldSubtitle: string;
}

/**
 * 9 Distinct Color & Illustration Identities for Grades 1 to 9
 * Directly aligned with the "Khám phá theo lớp" 1–9 palette in the reference design:
 * 1: Coral Red (#FF6B6B)
 * 2: Tangerine Orange (#FF8E3C)
 * 3: Sunshine Yellow (#F59E0B / #FFD93D)
 * 4: Fresh Green (#45B97C)
 * 5: Mint Teal (#14B8A6)
 * 6: Cobalt Blue (#3B82F6)
 * 7: Creative Indigo/Purple (#6366F1)
 * 8: Bubblegum Pink (#EC4899)
 * 9: Royal Violet (#8B5CF6)
 */
export const GRADE_WONDERLAND_THEMES: GradeWonderlandTheme[] = [
  {
    classId: 'cls-1',
    gradeNumber: 1,
    label: 'Lớp 1',
    shortTitle: 'Vương Quốc Sắc Màu',
    creativeTheme: 'Chấm, Nét & Bầu Trời Diệu Kỳ',
    description: 'Làm quen với chấm tròn, nét cong, cầu vồng và những gam màu cơ bản rực rỡ đầu tiên.',
    primaryHex: '#FF6B6B',
    secondaryHex: '#FF8E8E',
    pastelBgHex: '#FFF0F0',
    borderHex: '#FFB4B4',
    badgeGradient: 'linear-gradient(180deg, #FF7B7B 0%, #FF5252 100%)',
    textAccentClass: 'text-[#E11D48]',
    artFrameBorder: 'border-[#FF6B6B]',
    artFrameShadow: '0 10px 0 #FFD1D1, 0 16px 32px rgba(255, 107, 107, 0.20)',
    badgeBg: '#FF6B6B',
    tileBg: '#FF7B7B',
    tileBottomShadow: '#EF4444',
    cardBg: '#FFF0F0',
    cardBorder: '#FFB4B4',
    worldTitle: 'Vương Quốc Sắc Màu',
    worldSubtitle: 'Chấm, Nét & Bầu Trời Diệu Kỳ',
  },
  {
    classId: 'cls-2',
    gradeNumber: 2,
    label: 'Lớp 2',
    shortTitle: 'Khu Rừng Nhiệt Đới',
    creativeTheme: 'Thiên Nhiên & Muôn Loài Đáng Yêu',
    description: 'Khám phá cây cỏ, mặt trời ấm áp và những người bạn động vật ngộ nghĩnh qua nét vẽ hồn nhiên.',
    primaryHex: '#FF8E3C',
    secondaryHex: '#FFA94D',
    pastelBgHex: '#FFF4E6',
    borderHex: '#FFCCA0',
    badgeGradient: 'linear-gradient(180deg, #FF9E44 0%, #F97316 100%)',
    textAccentClass: 'text-[#EA580C]',
    artFrameBorder: 'border-[#FF8E3C]',
    artFrameShadow: '0 10px 0 #FFE0BF, 0 16px 32px rgba(255, 142, 60, 0.20)',
    badgeBg: '#FF8E3C',
    tileBg: '#FF9E44',
    tileBottomShadow: '#F97316',
    cardBg: '#FFF4E6',
    cardBorder: '#FFCCA0',
    worldTitle: 'Khu Rừng Nhiệt Đới',
    worldSubtitle: 'Thiên Nhiên & Muôn Loài Đáng Yêu',
  },
  {
    classId: 'cls-3',
    gradeNumber: 3,
    label: 'Lớp 3',
    shortTitle: 'Xưởng Thủ Công Nắng Ấm',
    creativeTheme: 'Tạo Hình & Vật Liệu Sáng Tạo',
    description: 'Biến giấy màu, đất nặn và vật liệu thân thuộc thành những mô hình nghệ thuật sinh động.',
    primaryHex: '#F59E0B',
    secondaryHex: '#FFD93D',
    pastelBgHex: '#FFFBEB',
    borderHex: '#FDE68A',
    badgeGradient: 'linear-gradient(180deg, #FFD93D 0%, #F59E0B 100%)',
    textAccentClass: 'text-[#D97706]',
    artFrameBorder: 'border-[#FFD93D]',
    artFrameShadow: '0 10px 0 #FEF08A, 0 16px 32px rgba(245, 158, 11, 0.20)',
    badgeBg: '#F59E0B',
    tileBg: '#FBBF24',
    tileBottomShadow: '#F59E0B',
    cardBg: '#FFFBEB',
    cardBorder: '#FDE68A',
    worldTitle: 'Xưởng Thủ Công Nắng Ấm',
    worldSubtitle: 'Tạo Hình & Vật Liệu Sáng Tạo',
  },
  {
    classId: 'cls-4',
    gradeNumber: 4,
    label: 'Lớp 4',
    shortTitle: 'Thảo Nguyên Xanh Mát',
    creativeTheme: 'Phong Cảnh & Hòa Sắc Thiên Nhiên',
    description: 'Phối hợp gam màu nóng – lạnh để vẽ nên cánh đồng, dòng sông và quê hương tươi đẹp.',
    primaryHex: '#45B97C',
    secondaryHex: '#6EE7B7',
    pastelBgHex: '#ECFDF5',
    borderHex: '#A7F3D0',
    badgeGradient: 'linear-gradient(180deg, #52C98A 0%, #10B981 100%)',
    textAccentClass: 'text-[#059669]',
    artFrameBorder: 'border-[#45B97C]',
    artFrameShadow: '0 10px 0 #BBF7D0, 0 16px 32px rgba(69, 185, 124, 0.20)',
    badgeBg: '#45B97C',
    tileBg: '#52C98A',
    tileBottomShadow: '#10B981',
    cardBg: '#ECFDF5',
    cardBorder: '#A7F3D0',
    worldTitle: 'Thảo Nguyên Xanh Mát',
    worldSubtitle: 'Phong Cảnh & Hòa Sắc Thiên Nhiên',
  },
  {
    classId: 'cls-5',
    gradeNumber: 5,
    label: 'Lớp 5',
    shortTitle: 'Đảo Ngọc Lễ Hội',
    creativeTheme: 'Lễ Hội, Con Người & Bố Cục',
    description: 'Sáng tác tranh chủ đề lễ hội truyền thống, nhịp điệu chuyển động và bố cục có chiều sâu.',
    primaryHex: '#14B8A6',
    secondaryHex: '#A8E6CF',
    pastelBgHex: '#F0FDFA',
    borderHex: '#99F6E4',
    badgeGradient: 'linear-gradient(180deg, #2DD4BF 0%, #0D9488 100%)',
    textAccentClass: 'text-[#0D9488]',
    artFrameBorder: 'border-[#14B8A6]',
    artFrameShadow: '0 10px 0 #99F6E4, 0 16px 32px rgba(20, 184, 166, 0.20)',
    badgeBg: '#14B8A6',
    tileBg: '#2DD4BF',
    tileBottomShadow: '#0D9488',
    cardBg: '#F0FDFA',
    cardBorder: '#99F6E4',
    worldTitle: 'Đảo Ngọc Lễ Hội',
    worldSubtitle: 'Lễ Hội, Con Người & Bố Cục',
  },
  {
    classId: 'cls-6',
    gradeNumber: 6,
    label: 'Lớp 6',
    shortTitle: 'Đại Dương Lam Ngọc',
    creativeTheme: 'Tạo Hình Cổ Điển & Dân Gian',
    description: 'Tìm hiểu họa tiết dân gian Việt Nam, nghệ thuật tiền sử và nguyên lý tạo hình cân đối.',
    primaryHex: '#3B82F6',
    secondaryHex: '#60A5FA',
    pastelBgHex: '#EFF6FF',
    borderHex: '#BFDBFE',
    badgeGradient: 'linear-gradient(180deg, #60A5FA 0%, #2563EB 100%)',
    textAccentClass: 'text-[#2563EB]',
    artFrameBorder: 'border-[#3B82F6]',
    artFrameShadow: '0 10px 0 #BFDBFE, 0 16px 32px rgba(59, 130, 246, 0.20)',
    badgeBg: '#3B82F6',
    tileBg: '#60A5FA',
    tileBottomShadow: '#2563EB',
    cardBg: '#EFF6FF',
    cardBorder: '#BFDBFE',
    worldTitle: 'Đại Dương Lam Ngọc',
    worldSubtitle: 'Tạo Hình Cổ Điển & Dân Gian',
  },
  {
    classId: 'cls-7',
    gradeNumber: 7,
    label: 'Lớp 7',
    shortTitle: 'Thiên Hà Ký Họa',
    creativeTheme: 'Hội Họa, Ký Họa & Phối Cảnh',
    description: 'Khám phá luật xa gần, tương phản sáng tối, ký họa dáng người và phong cảnh nghệ thuật.',
    primaryHex: '#6366F1',
    secondaryHex: '#818CF8',
    pastelBgHex: '#EEF2FF',
    borderHex: '#C7D2FE',
    badgeGradient: 'linear-gradient(180deg, #818CF8 0%, #4F46E5 100%)',
    textAccentClass: 'text-[#4F46E5]',
    artFrameBorder: 'border-[#6366F1]',
    artFrameShadow: '0 10px 0 #C7D2FE, 0 16px 32px rgba(99, 102, 241, 0.20)',
    badgeBg: '#6366F1',
    tileBg: '#818CF8',
    tileBottomShadow: '#4F46E5',
    cardBg: '#EEF2FF',
    cardBorder: '#C7D2FE',
    worldTitle: 'Thiên Hà Ký Họa',
    worldSubtitle: 'Hội Họa, Ký Họa & Phối Cảnh',
  },
  {
    classId: 'cls-8',
    gradeNumber: 8,
    label: 'Lớp 8',
    shortTitle: 'Trạm Thiết Kế Pop Art',
    creativeTheme: 'Đồ Họa, Thiết Kế & Trào Lưu Hiện Đại',
    description: 'Ứng dụng ngôn ngữ Pop Art, thiết kế áp phích, bìa sách, chữ nghệ thuật và đồ họa thị giác.',
    primaryHex: '#EC4899',
    secondaryHex: '#F472B6',
    pastelBgHex: '#FDF2F8',
    borderHex: '#FBCFE8',
    badgeGradient: 'linear-gradient(180deg, #F472B6 0%, #DB2777 100%)',
    textAccentClass: 'text-[#DB2777]',
    artFrameBorder: 'border-[#EC4899]',
    artFrameShadow: '0 10px 0 #FBCFE8, 0 16px 32px rgba(236, 72, 153, 0.20)',
    badgeBg: '#EC4899',
    tileBg: '#F472B6',
    tileBottomShadow: '#DB2777',
    cardBg: '#FDF2F8',
    cardBorder: '#FBCFE8',
    worldTitle: 'Trạm Thiết Kế Pop Art',
    worldSubtitle: 'Đồ Họa, Thiết Kế & Trào Lưu Hiện Đại',
  },
  {
    classId: 'cls-9',
    gradeNumber: 9,
    label: 'Lớp 9',
    shortTitle: 'Tinh Vân Đương Đại',
    creativeTheme: 'Nghệ Thuật Đương Đại & Tổng Hợp',
    description: 'Sáng tác đa chất liệu, sắp đặt ý niệm và hoàn thiện hồ sơ năng lực nghệ thuật cá nhân.',
    primaryHex: '#8B5CF6',
    secondaryHex: '#A78BFA',
    pastelBgHex: '#F5F3FF',
    borderHex: '#DDD6FE',
    badgeGradient: 'linear-gradient(180deg, #A78BFA 0%, #7C3AED 100%)',
    textAccentClass: 'text-[#7C3AED]',
    artFrameBorder: 'border-[#8B5CF6]',
    artFrameShadow: '0 10px 0 #DDD6FE, 0 16px 32px rgba(139, 92, 246, 0.20)',
    badgeBg: '#8B5CF6',
    tileBg: '#A78BFA',
    tileBottomShadow: '#7C3AED',
    cardBg: '#F5F3FF',
    cardBorder: '#DDD6FE',
    worldTitle: 'Tinh Vân Đương Đại',
    worldSubtitle: 'Nghệ Thuật Đương Đại & Tổng Hợp',
  },
];

export function getGradeWonderlandTheme(gradeOrClassId?: string): GradeWonderlandTheme {
  if (!gradeOrClassId) return GRADE_WONDERLAND_THEMES[0];
  const match = gradeOrClassId.match(/([1-9])/);
  if (match) {
    const num = parseInt(match[1], 10);
    const found = GRADE_WONDERLAND_THEMES.find((g) => g.gradeNumber === num);
    if (found) return found;
  }
  return GRADE_WONDERLAND_THEMES[0];
}

/**
 * Brush-Stroke Section Header Ribbon (Inspired by "Triển lãm nổi bật" & "Khám phá theo lớp" in Reference)
 */
export const PaintBrushBanner: React.FC<{
  title?: string;
  text?: string;
  color?: 'purple' | 'yellow' | 'coral' | 'green' | 'blue' | 'pink' | string;
  textColor?: string;
  className?: string;
}> = ({ title, text, color = 'purple', textColor, className = '' }) => {
  const presets: Record<string, { fill: string; stroke: string; text: string }> = {
    purple: { fill: '#7C3AED', stroke: '#A78BFA', text: '#FFFFFF' },
    '#7c3aed': { fill: '#7C3AED', stroke: '#A78BFA', text: '#FFFFFF' },
    yellow: { fill: '#FFD93D', stroke: '#F59E0B', text: '#1E1B4B' },
    '#ffd93d': { fill: '#FFD93D', stroke: '#F59E0B', text: '#1E1B4B' },
    coral: { fill: '#FF6B6B', stroke: '#FCA5A5', text: '#FFFFFF' },
    '#ff6b6b': { fill: '#FF6B6B', stroke: '#FCA5A5', text: '#FFFFFF' },
    green: { fill: '#10B981', stroke: '#6EE7B7', text: '#FFFFFF' },
    '#10b981': { fill: '#10B981', stroke: '#6EE7B7', text: '#FFFFFF' },
    '#45b97c': { fill: '#45B97C', stroke: '#A8E6CF', text: '#FFFFFF' },
    blue: { fill: '#3B82F6', stroke: '#93C5FD', text: '#FFFFFF' },
    '#3b82f6': { fill: '#3B82F6', stroke: '#93C5FD', text: '#FFFFFF' },
    pink: { fill: '#EC4899', stroke: '#F9A8D4', text: '#FFFFFF' },
    '#ec4899': { fill: '#EC4899', stroke: '#F9A8D4', text: '#FFFFFF' },
  };

  const normalizedKey = (color || 'purple').toLowerCase();
  const palette = presets[normalizedKey] || {
    fill: color.startsWith('#') ? color : '#7C3AED',
    stroke: '#FFFFFF',
    text: textColor || '#FFFFFF',
  };

  const displayTitle = title || text || '';
  const finalTextColor = textColor || palette.text;

  return (
    <div className={`relative inline-flex items-center px-6 py-2 select-none ${className}`}>
      <svg
        viewBox="0 0 340 62"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full pointer-events-none drop-shadow-[0_4px_10px_rgba(30,27,75,0.12)]"
      >
        <path
          d="M14,14 C55,5 280,4 322,12 C336,15 339,28 330,41 C318,54 260,57 18,54 C5,53 2,39 6,27 C9,19 8,16 14,14 Z"
          fill={palette.fill}
        />
        <path
          d="M24,9 C90,3 255,4 316,9"
          stroke={palette.stroke}
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
        />
        <circle cx="332" cy="18" r="3.5" fill={palette.fill} />
        <circle cx="8" cy="46" r="2.8" fill={palette.fill} />
      </svg>
      <span
        className="relative z-10 font-display text-lg sm:text-2xl font-extrabold tracking-tight"
        style={{ color: finalTextColor }}
      >
        {displayTitle}
      </span>
    </div>
  );
};

/**
 * 2D Vector Art Illustrations for the 5 Arched Portal Cards on Home Page
 */
export const PortalCardIllustration: React.FC<{
  type: 'new-art' | 'new' | 'featured' | 'classes' | 'grades' | 'stories' | 'studio' | 'creative';
  className?: string;
}> = ({ type, className = 'w-16 h-16' }) => {
  switch (type) {
    case 'new':
    case 'new-art':
      // Easel with colorful canvas & brush
      return (
        <svg viewBox="0 0 80 80" className={className} xmlns="http://www.w3.org/2000/svg">
          {/* Easel legs */}
          <path d="M24 68L34 46M56 68L46 46M40 48V70" stroke="#92400E" strokeWidth="4" strokeLinecap="round" />
          <rect x="33" y="10" width="14" height="8" rx="2" fill="#B45309" />
          {/* Canvas */}
          <rect x="16" y="15" width="48" height="36" rx="6" fill="#FFFFFF" stroke="#1E1B4B" strokeWidth="2.8" />
          {/* Paint splashes inside canvas */}
          <circle cx="30" cy="28" r="6" fill="#FF6B6B" />
          <circle cx="44" cy="26" r="5" fill="#FFD93D" />
          <circle cx="38" cy="37" r="6" fill="#3B82F6" />
          <circle cx="50" cy="36" r="4.5" fill="#45B97C" />
          {/* Bottom tray */}
          <rect x="12" y="48" width="56" height="6" rx="3" fill="#F59E0B" stroke="#1E1B4B" strokeWidth="2.5" />
        </svg>
      );

    case 'featured':
      // Golden Star Trophy Cup
      return (
        <svg viewBox="0 0 80 80" className={className} xmlns="http://www.w3.org/2000/svg">
          {/* Handles */}
          <path
            d="M22 24H14C11 24 10 34 16 38C20 40 24 40 25 38M58 24H66C69 24 70 34 64 38C60 40 56 40 55 38"
            stroke="#1E1B4B"
            strokeWidth="2.8"
            strokeLinecap="round"
            fill="#FFD93D"
          />
          {/* Cup body */}
          <path
            d="M22 16H58V34C58 45 50 52 40 52C30 52 22 45 22 34V16Z"
            fill="#FFD93D"
            stroke="#1E1B4B"
            strokeWidth="2.8"
          />
          {/* Stem & Base */}
          <rect x="35" y="52" width="10" height="10" fill="#F59E0B" stroke="#1E1B4B" strokeWidth="2.5" />
          <rect x="24" y="62" width="32" height="8" rx="4" fill="#FF8E3C" stroke="#1E1B4B" strokeWidth="2.5" />
          {/* Star in middle */}
          <polygon
            points="40,22 43,29 50,29 44.5,33.5 46.5,40.5 40,36 33.5,40.5 35.5,33.5 30,29 37,29"
            fill="#FFFFFF"
            stroke="#1E1B4B"
            strokeWidth="2"
          />
        </svg>
      );

    case 'grades':
    case 'classes':
      // Creative Purple Graduation Cap with Golden Tassel
      return (
        <svg viewBox="0 0 80 80" className={className} xmlns="http://www.w3.org/2000/svg">
          <path
            d="M24 38V54C24 60 31 64 40 64C49 64 56 60 56 54V38"
            fill="#7C3AED"
            stroke="#1E1B4B"
            strokeWidth="2.8"
          />
          <polygon
            points="40,16 70,30 40,44 10,30"
            fill="#8B5CF6"
            stroke="#1E1B4B"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          <path d="M40 30L62 40V54" stroke="#FFD93D" strokeWidth="3.2" strokeLinecap="round" />
          <circle cx="62" cy="56" r="4" fill="#FFD93D" stroke="#1E1B4B" strokeWidth="2" />
        </svg>
      );

    case 'stories':
      // Open Storybook with Sprouting Green Leaves
      return (
        <svg viewBox="0 0 80 80" className={className} xmlns="http://www.w3.org/2000/svg">
          {/* Sprout stem & leaves */}
          <path d="M40 44V18" stroke="#15803D" strokeWidth="3.2" strokeLinecap="round" />
          <path
            d="M40 28C40 18 24 14 22 24C20 32 34 34 40 28Z"
            fill="#45B97C"
            stroke="#1E1B4B"
            strokeWidth="2.5"
          />
          <path
            d="M40 24C40 14 56 10 58 20C60 28 46 30 40 24Z"
            fill="#A8E6CF"
            stroke="#1E1B4B"
            strokeWidth="2.5"
          />
          {/* Open book */}
          <path
            d="M12 46C22 44 32 46 40 50C48 46 58 44 68 46V64C58 62 48 64 40 68C32 64 22 62 12 64V46Z"
            fill="#FFFFFF"
            stroke="#1E1B4B"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          <path d="M40 50V68" stroke="#1E1B4B" strokeWidth="2.5" />
        </svg>
      );

    case 'creative':
    case 'studio':
    default:
      // Art Cup with Paintbrushes & Crayons
      return (
        <svg viewBox="0 0 80 80" className={className} xmlns="http://www.w3.org/2000/svg">
          {/* Brushes */}
          <path d="M28 40L22 18" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />
          <circle cx="21" cy="15" r="5" fill="#3B82F6" stroke="#1E1B4B" strokeWidth="2" />
          <path d="M40 38V14" stroke="#FB7185" strokeWidth="4.5" strokeLinecap="round" />
          <circle cx="40" cy="12" r="5.5" fill="#FFD93D" stroke="#1E1B4B" strokeWidth="2" />
          <path d="M52 40L58 18" stroke="#34D399" strokeWidth="4" strokeLinecap="round" />
          <circle cx="59" cy="15" r="5" fill="#FF6B6B" stroke="#1E1B4B" strokeWidth="2" />
          {/* Cup */}
          <path
            d="M22 38H58L54 66C53.5 68 51.5 70 49 70H31C28.5 70 26.5 68 26 66L22 38Z"
            fill="#A78BFA"
            stroke="#1E1B4B"
            strokeWidth="2.8"
          />
          <rect x="20" y="34" width="40" height="7" rx="3.5" fill="#EC4899" stroke="#1E1B4B" strokeWidth="2.5" />
          <circle cx="40" cy="54" r="5" fill="#FFD93D" />
        </svg>
      );
  }
};

/**
 * Custom 2D SVG Illustration for each Grade 1–9 Space
 */
export const Grade2DIllustration: React.FC<{
  gradeNumber: number;
  className?: string;
}> = ({ gradeNumber, className = 'w-14 h-14' }) => {
  const theme = GRADE_WONDERLAND_THEMES[(gradeNumber - 1) % 9] || GRADE_WONDERLAND_THEMES[0];

  return (
    <svg viewBox="0 0 72 72" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect
        x="6"
        y="6"
        width="60"
        height="60"
        rx="18"
        fill={theme.pastelBgHex}
        stroke={theme.primaryHex}
        strokeWidth="2.5"
      />
      {gradeNumber === 1 && (
        <>
          <path d="M18 48C18 34 54 34 54 48" stroke="#FF6B6B" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M24 48C24 39 48 39 48 48" stroke="#FFD93D" strokeWidth="4" fill="none" strokeLinecap="round" />
          <circle cx="24" cy="24" r="5" fill="#FFD93D" />
          <circle cx="48" cy="22" r="4" fill="#3B82F6" />
        </>
      )}
      {gradeNumber === 2 && (
        <>
          <circle cx="36" cy="30" r="10" fill="#FFD93D" stroke="#FF8E3C" strokeWidth="2.5" />
          <path d="M20 50C26 42 46 42 52 50" fill="#45B97C" />
          <circle cx="26" cy="22" r="3" fill="#FF8E3C" />
        </>
      )}
      {gradeNumber === 3 && (
        <>
          <polygon points="36,16 54,48 18,48" fill="#FFD93D" stroke="#D97706" strokeWidth="2.5" strokeLinejoin="round" />
          <circle cx="36" cy="38" r="5" fill="#FF6B6B" />
        </>
      )}
      {gradeNumber === 4 && (
        <>
          <path d="M14 50L28 30L40 44L48 34L58 50Z" fill="#45B97C" stroke="#059669" strokeWidth="2" />
          <circle cx="48" cy="22" r="5" fill="#FFD93D" />
        </>
      )}
      {gradeNumber === 5 && (
        <>
          <circle cx="36" cy="36" r="14" fill="#14B8A6" stroke="#0F766E" strokeWidth="2.5" />
          <polygon points="36,25 39,33 47,33 41,38 43,46 36,41 29,46 31,38 25,33 33,33" fill="#FFD93D" />
        </>
      )}
      {gradeNumber === 6 && (
        <>
          <path d="M26 20H46L50 34C50 46 44 52 36 52C28 52 22 46 22 34L26 20Z" fill="#3B82F6" stroke="#1D4ED8" strokeWidth="2.5" />
          <circle cx="36" cy="36" r="5" fill="#FFD93D" />
        </>
      )}
      {gradeNumber === 7 && (
        <>
          <rect x="20" y="18" width="32" height="36" rx="4" fill="#FFFFFF" stroke="#6366F1" strokeWidth="2.5" />
          <path d="M26 42L34 30L46 42" stroke="#EC4899" strokeWidth="3" strokeLinecap="round" fill="none" />
          <circle cx="42" cy="26" r="3.5" fill="#FFD93D" />
        </>
      )}
      {gradeNumber === 8 && (
        <>
          <circle cx="28" cy="30" r="9" fill="#EC4899" />
          <rect x="34" y="30" width="18" height="18" rx="4" fill="#FFD93D" stroke="#1E1B4B" strokeWidth="2" />
          <polygon points="24,48 34,34 42,48" fill="#3B82F6" />
        </>
      )}
      {gradeNumber === 9 && (
        <>
          <circle cx="36" cy="36" r="15" fill="#8B5CF6" stroke="#1E1B4B" strokeWidth="2" />
          <ellipse cx="36" cy="36" rx="22" ry="7" transform="rotate(-22 36 36)" stroke="#FFD93D" strokeWidth="3" fill="none" />
          <circle cx="36" cy="36" r="4" fill="#FFFFFF" />
        </>
      )}
    </svg>
  );
};
