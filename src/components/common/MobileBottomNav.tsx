/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — Hệ thống Điều hướng Cố định Cuối màn hình cho iPhone (Safari iOS & PWA)
 */

import React from 'react';
import { ScreenTab } from '../../types/artverse';
import { Compass, LayoutGrid, Camera, BookOpen, UserCheck } from 'lucide-react';

interface MobileBottomNavProps {
  currentTab: ScreenTab;
  onSelectTab: (tab: ScreenTab) => void;
  onOpenUploadModal: () => void;
  pendingModerationCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTab,
  onSelectTab,
  onOpenUploadModal,
  pendingModerationCount = 0
}) => {
  const isDiscoverActive = currentTab === 'discover';
  const isGalleryActive = currentTab === 'community-library' || currentTab === 'library';
  const isClassesActive = currentTab === 'class-lessons';
  const isProfileActive =
    currentTab === 'profile-manage' ||
    currentTab === 'moderation' ||
    currentTab === 'safety-audit' ||
    currentTab === 'ai-chatbox';

  return (
    <nav
      aria-label="Điều hướng chính trên điện thoại"
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-[#FAF8F5]/95 backdrop-blur-xl border-t border-stone-200/90 pl-safe pr-safe pb-safe no-print shadow-[0_-4px_20px_rgba(18,19,22,0.06)]"
    >
      <div className="grid grid-cols-5 items-center h-16 max-w-lg mx-auto px-1">
        {/* 1. Khám phá */}
        <button
          type="button"
          onClick={() => onSelectTab('discover')}
          className={`min-h-[48px] min-w-[48px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors cursor-pointer ${
            isDiscoverActive
              ? 'text-[#1D4ED8] font-bold'
              : 'text-stone-500 active:text-stone-900'
          }`}
        >
          <Compass className={`w-5 h-5 ${isDiscoverActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
          <span className="text-[10px] tracking-tight leading-none mt-0.5">Khám phá</span>
          {isDiscoverActive && (
            <span className="w-1 h-1 rounded-full bg-[#1D4ED8] mt-0.5" />
          )}
        </button>

        {/* 2. Triển lãm */}
        <button
          type="button"
          onClick={() => onSelectTab('community-library')}
          className={`min-h-[48px] min-w-[48px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors cursor-pointer ${
            isGalleryActive
              ? 'text-[#1D4ED8] font-bold'
              : 'text-stone-500 active:text-stone-900'
          }`}
        >
          <LayoutGrid className={`w-5 h-5 ${isGalleryActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
          <span className="text-[10px] tracking-tight leading-none mt-0.5">Triển lãm</span>
          {isGalleryActive && (
            <span className="w-1 h-1 rounded-full bg-[#1D4ED8] mt-0.5" />
          )}
        </button>

        {/* 3. Upload (Điểm nhấn thị giác nổi bật cho ngón tay cái) */}
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={onOpenUploadModal}
            aria-label="Đăng tải tác phẩm mới"
            className="relative -top-2.5 min-h-[52px] min-w-[56px] px-3.5 rounded-2xl bg-[#1D4ED8] active:bg-[#1E40AF] text-white shadow-lg shadow-[#1D4ED8]/30 border-2 border-[#FAF8F5] flex flex-col items-center justify-center gap-0.5 transition-transform active:scale-95 cursor-pointer"
          >
            <Camera className="w-5 h-5 text-[#FBBF24] stroke-[2.3]" />
            <span className="text-[10px] font-extrabold tracking-tight leading-none">Upload</span>
          </button>
        </div>

        {/* 4. Lớp học */}
        <button
          type="button"
          onClick={() => onSelectTab('class-lessons')}
          className={`min-h-[48px] min-w-[48px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors cursor-pointer ${
            isClassesActive
              ? 'text-[#1D4ED8] font-bold'
              : 'text-stone-500 active:text-stone-900'
          }`}
        >
          <BookOpen className={`w-5 h-5 ${isClassesActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
          <span className="text-[10px] tracking-tight leading-none mt-0.5">Lớp học</span>
          {isClassesActive && (
            <span className="w-1 h-1 rounded-full bg-[#1D4ED8] mt-0.5" />
          )}
        </button>

        {/* 5. Cá nhân / Quản lý */}
        <button
          type="button"
          onClick={() => onSelectTab('profile-manage')}
          className={`relative min-h-[48px] min-w-[48px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors cursor-pointer ${
            isProfileActive
              ? 'text-[#1D4ED8] font-bold'
              : 'text-stone-500 active:text-stone-900'
          }`}
        >
          <div className="relative">
            <UserCheck className={`w-5 h-5 ${isProfileActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
            {pendingModerationCount > 0 && (
              <span className="absolute -top-1 -right-2 min-w-[15px] h-[15px] px-1 rounded-full bg-[#EA580C] text-white text-[9px] font-bold flex items-center justify-center">
                {pendingModerationCount > 9 ? '9+' : pendingModerationCount}
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight leading-none mt-0.5">Cá nhân</span>
          {isProfileActive && (
            <span className="w-1 h-1 rounded-full bg-[#1D4ED8] mt-0.5" />
          )}
        </button>
      </div>
    </nav>
  );
};
