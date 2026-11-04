/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ART VERSE AI — Master Naming & Information Architecture v2.0 Top Header Bar
 * Contemporary Creative Gallery design on Warm Ivory (#F7F3EA) with Ink Navy (#20243A) & Electric Cobalt (#3457D5)
 * Includes Global Search Bar ("Tìm kiếm tác phẩm, tác giả, video, câu chuyện...")
 */

import React from 'react';
import { ScreenTab } from '../../types/artverse';
import {
  Upload,
  LogIn,
  LogOut,
  KeyRound,
  Menu,
  Search,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { normalizeGrade } from '../../utils/gradeUtils';
import { ArtverseLogo } from './ArtverseLogo';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  currentTab: ScreenTab;
  onOpenMobileMenu?: () => void;
  onQuickAction: () => void;
  onSelectTab?: (tab: ScreenTab) => void;
  onOpenGlobalSearch?: (initialQuery?: string) => void;
  quickActionLabel?: string;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onOpenMobileMenu,
  onSelectTab,
  onOpenGlobalSearch,
}) => {
  const {
    user,
    profile,
    loading,
    isStudent,
    setIsStudentLoginModalOpen,
    loginWithGoogle,
    logout,
  } = useAuth();

  const navLinks: Array<{ id: ScreenTab; label: string; activeMatch?: ScreenTab[] }> = [
    { id: 'discover', label: 'TRANG CHỦ' },
    {
      id: 'community-library',
      label: 'TRIỂN LÃM TÁC PHẨM',
      activeMatch: ['community-library', 'library'],
    },
    { id: 'artverse-shorts', label: 'ARTVERSE SHORTS' },
    { id: 'art-stories', label: 'CÂU CHUYỆN SAU NÉT VẼ' },
    { id: 'class-lessons', label: 'MĨ THUẬT GDPT' },
  ];

  return (
    <header className="sticky top-0 z-30 pt-safe bg-[#F7F3EA]/95 backdrop-blur-md border-b border-[#20243A]/12 no-print">
      <div className="flex items-center justify-between gap-3 sm:gap-5 px-4 sm:px-6 lg:px-8 h-14 sm:h-16 max-w-7xl mx-auto">
        {/* Zone 1: Menu Trigger (Mobile) + Official Brand Wordmark (ART VERSE AI) */}
        <div className="flex items-center gap-2.5 shrink-0">
          {onOpenMobileMenu && (
            <button
              type="button"
              onClick={onOpenMobileMenu}
              aria-label="Mở danh mục điều hướng ART VERSE AI"
              className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center text-[#20243A] hover:bg-[#20243A]/5 transition-colors cursor-pointer shrink-0"
            >
              <Menu className="w-5 h-5 stroke-[2]" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onSelectTab?.('discover')}
            className="flex items-center text-left cursor-pointer shrink-0 focus:outline-none"
          >
            <ArtverseLogo size="sm" showText={true} />
          </button>
        </div>

        {/* Zone 2: Global Search Bar ("Tìm kiếm tác phẩm, tác giả, video, câu chuyện...") */}
        {onOpenGlobalSearch && (
          <div className="hidden md:flex flex-1 max-w-md">
            <button
              type="button"
              onClick={() => onOpenGlobalSearch('')}
              className="w-full min-h-[36px] px-3.5 py-1.5 rounded-lg bg-white hover:bg-[#20243A]/5 border border-[#20243A]/20 text-left flex items-center justify-between gap-2 text-xs text-[#20243A]/60 hover:text-[#20243A] transition-colors cursor-pointer"
            >
              <span className="inline-flex items-center gap-2 truncate">
                <Search className="w-3.5 h-3.5 text-[#3457D5] shrink-0" />
                <span className="truncate">
                  Tìm kiếm tác phẩm, tác giả, video, câu chuyện...
                </span>
              </span>
              <span className="px-1.5 py-0.5 rounded-sm bg-[#F7F3EA] border border-[#20243A]/15 text-[10px] font-mono-code text-[#20243A]/60 shrink-0">
                Tìm kiếm
              </span>
            </button>
          </div>
        )}

        {/* Zone 2B: Clean Single-Line Typographic Navigation Links (2xl screens) */}
        <nav aria-label="Điều hướng chính ART VERSE AI" className="hidden 2xl:flex items-center gap-4">
          {navLinks.map((link) => {
            const isActive = link.activeMatch
              ? link.activeMatch.includes(currentTab)
              : currentTab === link.id;
            return (
              <button
                key={link.id}
                type="button"
                onClick={() => onSelectTab?.(link.id)}
                className={`relative py-1 text-xs font-bold tracking-wide transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'text-[#20243A]'
                    : 'text-[#20243A]/65 hover:text-[#20243A]'
                }`}
              >
                {link.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#3457D5]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Mobile Search Trigger + Account Controls + Primary Action (ĐĂNG TẢI) */}
        <div className="flex items-center gap-2 shrink-0">
          {onOpenGlobalSearch && (
            <button
              type="button"
              onClick={() => onOpenGlobalSearch('')}
              aria-label="Tìm kiếm tác phẩm, tác giả, video, câu chuyện..."
              className="md:hidden w-9 h-9 rounded-lg bg-white border border-[#20243A]/20 flex items-center justify-center text-[#3457D5] hover:bg-[#20243A] hover:text-white transition-colors cursor-pointer shrink-0"
            >
              <Search className="w-4 h-4" />
            </button>
          )}

          <PWAInstallButton />

          {isStudent && profile ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onSelectTab?.('profile-manage')}
                className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-[#20243A]/15 text-xs font-semibold text-[#20243A] hover:border-[#20243A]/40 transition-colors cursor-pointer whitespace-nowrap"
              >
                <span className="max-w-[96px] truncate">
                  {profile.nickname || profile.displayName}
                </span>
                <span className="text-[#20243A]/40">·</span>
                <span className="text-[#3457D5] font-bold">
                  {normalizeGrade(profile.className || profile.classGroupId)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => logout()}
                title="Đăng xuất tài khoản học sinh"
                className="w-8 h-8 flex items-center justify-center text-[#20243A]/70 hover:text-[#F15B3D] rounded-lg cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : user ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onSelectTab?.('profile-manage')}
                className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-[#20243A]/15 text-xs font-semibold text-[#20243A] hover:border-[#20243A]/40 transition-colors cursor-pointer whitespace-nowrap"
              >
                <span className="w-5 h-5 rounded-sm bg-[#20243A] text-[#F7F3EA] text-[10px] font-bold flex items-center justify-center">
                  {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                </span>
                <span className="hidden sm:inline max-w-[110px] truncate">
                  {user.displayName || user.email}
                </span>
              </button>
              <button
                type="button"
                onClick={() => logout()}
                title="Đăng xuất"
                className="w-8 h-8 flex items-center justify-center text-[#20243A]/70 hover:text-[#F15B3D] rounded-lg cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsStudentLoginModalOpen(true)}
                className="min-h-[34px] inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#20243A] bg-white hover:bg-[#20243A]/5 border border-[#20243A]/20 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
                title="Đăng nhập Học sinh bằng mã PIN"
              >
                <KeyRound className="w-3.5 h-3.5 text-[#3457D5]" />
                <span>Học sinh</span>
              </button>

              <button
                type="button"
                onClick={() => loginWithGoogle()}
                disabled={loading}
                title="Đăng nhập Giáo viên & Quản trị viên"
                className="min-h-[34px] inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#20243A] bg-white hover:bg-[#20243A]/5 border border-[#20243A]/20 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
              >
                <LogIn className="w-3.5 h-3.5 text-[#20243A]" />
                <span className="hidden sm:inline">Giáo viên</span>
              </button>
            </div>
          )}

          {/* Primary Action: ĐĂNG TẢI */}
          <button
            type="button"
            onClick={() => onSelectTab?.('upload-hub')}
            className="hidden lg:inline-flex min-h-[36px] items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-[#20243A] hover:bg-[#3457D5] text-[#F7F3EA] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>ĐĂNG TẢI</span>
          </button>
        </div>
      </div>
    </header>
  );
};
