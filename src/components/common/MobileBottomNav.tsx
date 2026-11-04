/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ART VERSE AI — Master Naming & Information Architecture v2.0 Mobile Bottom Navigation
 * Section VI: Strictly 5 items:
 * 1. TRANG CHỦ
 * 2. TRIỂN LÃM
 * 3. ARTVERSE SHORTS
 * 4. ĐĂNG TẢI
 * 5. HỒ SƠ
 * (MĨ THUẬT GDPT & CÂU CHUYỆN SAU NÉT VẼ accessed from TRANG CHỦ or expanded navigation drawer)
 */

import React from 'react';
import { ScreenTab } from '../../types/artverse';
import { Home, Grid, Film, Upload, User } from 'lucide-react';

interface MobileBottomNavProps {
  currentTab: ScreenTab;
  onSelectTab: (tab: ScreenTab) => void;
  onOpenUploadModal?: () => void;
  pendingModerationCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTab,
  onSelectTab,
  pendingModerationCount = 0,
}) => {
  const isDiscoverActive = currentTab === 'discover';
  const isGalleryActive = currentTab === 'community-library' || currentTab === 'library';
  const isShortsActive = currentTab === 'artverse-shorts';
  const isUploadActive = currentTab === 'upload-hub';
  const isProfileActive =
    currentTab === 'profile-manage' ||
    currentTab === 'management-tools' ||
    currentTab === 'system-admin' ||
    currentTab === 'moderation' ||
    currentTab === 'safety-audit' ||
    currentTab === 'storage-center';

  return (
    <nav
      aria-label="Điều hướng chính trên điện thoại ART VERSE AI"
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-[#F7F3EA]/96 backdrop-blur-md border-t border-[#20243A]/12 pb-safe no-print"
    >
      <div className="max-w-lg mx-auto px-1.5">
        <div className="grid grid-cols-5 items-center h-14">
          {/* 1. TRANG CHỦ */}
          <button
            type="button"
            onClick={() => onSelectTab('discover')}
            className={`relative h-full flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
              isDiscoverActive
                ? 'text-[#20243A] font-bold'
                : 'text-[#20243A]/60 hover:text-[#20243A] font-medium'
            }`}
          >
            <Home className="w-[18px] h-[18px]" strokeWidth={isDiscoverActive ? 2.2 : 1.75} />
            <span className="text-[10px] leading-none tracking-tight whitespace-nowrap">
              TRANG CHỦ
            </span>
            {isDiscoverActive && (
              <span className="absolute top-0 left-4 right-4 h-[2px] bg-[#3457D5]" />
            )}
          </button>

          {/* 2. TRIỂN LÃM */}
          <button
            type="button"
            onClick={() => onSelectTab('community-library')}
            className={`relative h-full flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
              isGalleryActive
                ? 'text-[#20243A] font-bold'
                : 'text-[#20243A]/60 hover:text-[#20243A] font-medium'
            }`}
          >
            <Grid className="w-[18px] h-[18px]" strokeWidth={isGalleryActive ? 2.2 : 1.75} />
            <span className="text-[10px] leading-none tracking-tight whitespace-nowrap">
              TRIỂN LÃM
            </span>
            {isGalleryActive && (
              <span className="absolute top-0 left-4 right-4 h-[2px] bg-[#3457D5]" />
            )}
          </button>

          {/* 3. ARTVERSE SHORTS */}
          <button
            type="button"
            onClick={() => onSelectTab('artverse-shorts')}
            className={`relative h-full flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
              isShortsActive
                ? 'text-[#20243A] font-bold'
                : 'text-[#20243A]/60 hover:text-[#20243A] font-medium'
            }`}
          >
            <Film className="w-[18px] h-[18px]" strokeWidth={isShortsActive ? 2.2 : 1.75} />
            <span className="text-[9.5px] leading-none tracking-tight whitespace-nowrap">
              ARTVERSE SHORTS
            </span>
            {isShortsActive && (
              <span className="absolute top-0 left-4 right-4 h-[2px] bg-[#F15B3D]" />
            )}
          </button>

          {/* 4. ĐĂNG TẢI */}
          <button
            type="button"
            onClick={() => onSelectTab('upload-hub')}
            className={`relative h-full flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
              isUploadActive
                ? 'text-[#3457D5] font-bold'
                : 'text-[#20243A]/60 hover:text-[#20243A] font-medium'
            }`}
          >
            <Upload className="w-[18px] h-[18px]" strokeWidth={isUploadActive ? 2.2 : 1.75} />
            <span className="text-[10px] leading-none tracking-tight whitespace-nowrap">
              ĐĂNG TẢI
            </span>
            {isUploadActive && (
              <span className="absolute top-0 left-4 right-4 h-[2px] bg-[#3457D5]" />
            )}
          </button>

          {/* 5. HỒ SƠ */}
          <button
            type="button"
            onClick={() => onSelectTab('profile-manage')}
            className={`relative h-full flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
              isProfileActive
                ? 'text-[#20243A] font-bold'
                : 'text-[#20243A]/60 hover:text-[#20243A] font-medium'
            }`}
          >
            <div className="relative">
              <User className="w-[18px] h-[18px]" strokeWidth={isProfileActive ? 2.2 : 1.75} />
              {pendingModerationCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 min-w-[14px] h-[14px] px-1 rounded-sm bg-[#F15B3D] text-white text-[9px] font-bold flex items-center justify-center tabular-nums">
                  {pendingModerationCount > 9 ? '9+' : pendingModerationCount}
                </span>
              )}
            </div>
            <span className="text-[10px] leading-none tracking-tight whitespace-nowrap">
              HỒ SƠ
            </span>
            {isProfileActive && (
              <span className="absolute top-0 left-4 right-4 h-[2px] bg-[#3457D5]" />
            )}
          </button>
        </div>
      </div>
    </nav>
  );
};
