/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — Contemporary Art Editorial Header (iOS Safe-Area & Desktop Responsive)
 */

import React from 'react';
import { ScreenTab } from '../../types/artverse';
import { Camera, Sparkles, LogIn, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ArtverseLogo } from './ArtverseLogo';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  currentTab: ScreenTab;
  onOpenMobileMenu?: () => void;
  onQuickAction: () => void;
  onSelectTab?: (tab: ScreenTab) => void;
  quickActionLabel?: string;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onQuickAction,
  onSelectTab
}) => {
  const { user, profile, loading, loginWithGoogle, logout } = useAuth();

  const getTabLabel = (tab: ScreenTab) => {
    switch (tab) {
      case 'discover':
        return 'Khám phá Nghệ thuật';
      case 'community-library':
      case 'library':
        return 'Digital Gallery · Triển lãm';
      case 'class-lessons':
        return 'Lớp học & Học liệu (Khối 6, 7, 8, 9)';
      case 'ai-chatbox':
        return 'Trợ lý Mĩ thuật · Gemini AI';
      case 'moderation':
        return 'Hàng chờ Kiểm duyệt';
      case 'safety-audit':
        return 'Bảo mật & Kiểm toán';
      case 'profile-manage':
        return 'Cá nhân & Quản lý';
      default:
        return 'ARTVERSE AI';
    }
  };

  return (
    <header className="sticky top-0 z-30 pt-safe bg-[#FAF8F5]/92 backdrop-blur-xl border-b border-stone-200/90 no-print">
      <div className="flex items-center justify-between gap-3 px-4 lg:px-8 h-14 max-w-7xl mx-auto">
        {/* Left: Editorial Wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab?.('discover')}
          className="flex items-center gap-2.5 text-left cursor-pointer shrink-0"
        >
          <ArtverseLogo size="sm" showText={false} />
          <div>
            <span className="font-editorial text-lg sm:text-xl font-bold tracking-tight text-[#121316] block leading-none">
              ARTVERSE AI
            </span>
            <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#1D4ED8] block mt-0.5 lg:hidden">
              {getTabLabel(currentTab)}
            </span>
          </div>
        </button>

        {/* Center: Contextual Section Indicator on Desktop */}
        <div className="hidden md:flex items-center gap-2.5 text-xs">
          <span className="px-3 py-1 rounded-lg bg-white border border-stone-200 font-bold text-[#121316]">
            {getTabLabel(currentTab)}
          </span>
        </div>

        {/* Right: Quick Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* In-App PWA Install Button (iOS Safari Guide & Chromium Prompt; hidden when installed) */}
          <PWAInstallButton />

          {/* Quick AI Assistant Trigger on Mobile */}
          {onSelectTab && currentTab !== 'ai-chatbox' && (
            <button
              type="button"
              onClick={() => onSelectTab('ai-chatbox')}
              className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-white hover:bg-stone-100 border border-stone-200 text-xs font-bold text-[#121316] inline-flex items-center gap-1.5 cursor-pointer"
              title="Trợ lý AI Gemini"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#D97706]" />
              <span className="hidden sm:inline">Gemini AI</span>
            </button>
          )}

          {/* Account Status (Desktop & Mobile) */}
          {user ? (
            <div className="flex items-center gap-1.5 bg-white pl-2 pr-1 py-1 rounded-xl border border-stone-200">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'GV'}
                  onClick={() => onSelectTab?.('profile-manage')}
                  className="w-6 h-6 rounded-full object-cover cursor-pointer"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => onSelectTab?.('profile-manage')}
                  className="w-6 h-6 rounded-full bg-[#1D4ED8] text-white text-[11px] font-bold flex items-center justify-center cursor-pointer"
                >
                  {(user.displayName || user.email || 'GV').charAt(0).toUpperCase()}
                </button>
              )}
              <div className="hidden xl:flex flex-col text-left pr-1">
                <span className="text-[11px] font-bold text-[#121316] max-w-[110px] truncate leading-tight">
                  {user.displayName || 'Giáo viên'}
                </span>
                <span className="text-[9px] text-[#1D4ED8] font-bold flex items-center gap-0.5 leading-none">
                  <ShieldCheck className="w-2.5 h-2.5" />
                  {profile?.role === 'admin' ? 'Quản trị' : 'Giáo viên'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => logout()}
                title="Đăng xuất"
                className="min-h-[32px] min-w-[32px] flex items-center justify-center text-stone-400 hover:text-rose-600 rounded-lg cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => loginWithGoogle()}
              disabled={loading}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#121316] bg-white hover:bg-stone-100 border border-stone-200 rounded-xl cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5 text-[#1D4ED8]" />
              <span>{loading ? '...' : 'Đăng nhập'}</span>
            </button>
          )}

          {/* Desktop Upload Button (On iPhone, Upload is prominent in the center of Bottom Nav) */}
          <button
            type="button"
            onClick={onQuickAction}
            className="hidden lg:inline-flex min-h-[40px] items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5 text-[#FBBF24]" />
            <span>Đăng tác phẩm</span>
          </button>
        </div>
      </div>
    </header>
  );
};
