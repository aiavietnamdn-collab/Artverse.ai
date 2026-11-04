/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ART VERSE AI — Master Naming & Information Architecture v2.0 Left Navigation Rail & Mobile Drawer
 * - 7 Primary Subsystems:
 *   1. TRANG CHỦ
 *   2. TRIỂN LÃM TÁC PHẨM
 *   3. ARTVERSE SHORTS
 *   4. CÂU CHUYỆN SAU NÉT VẼ
 *   5. MĨ THUẬT GDPT
 *   6. ĐĂNG TẢI
 *   7. HỒ SƠ CÁ NHÂN
 * - Authorized Management Group (Teacher / Admin only):
 *   CÔNG CỤ QUẢN LÝ
 * - Authorized System Admin Group (Admin / Teacher only):
 *   QUẢN TRỊ HỆ THỐNG
 */

import React from 'react';
import { ScreenTab } from '../../types/artverse';
import { UserRole } from '../../types/communityArt';
import { ArtverseLogo } from './ArtverseLogo';
import {
  Home,
  Grid,
  Film,
  BookOpen,
  Layers,
  Upload,
  UserCircle2,
  Users,
  ShieldCheck,
  X,
} from 'lucide-react';

interface SidebarProps {
  currentTab: ScreenTab;
  onSelectTab: (tab: ScreenTab) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  currentRole?: UserRole;
  pendingModerationCount?: number;
}

interface NavItem {
  id: ScreenTab;
  label: string;
  subLabel: string;
  icon: React.ReactNode;
  badge?: number | string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isOpenMobile = false,
  onCloseMobile,
  currentRole = 'viewer',
  pendingModerationCount = 0,
}) => {
  const isAuthorizedStaff =
    currentRole === 'teacher' || currentRole === 'moderator' || currentRole === 'admin';

  // Section II: Strictly 7 Official Primary Subsystems
  const primaryNavItems: NavItem[] = [
    {
      id: 'discover',
      label: 'TRANG CHỦ',
      subLabel: 'Tổng quan ART VERSE AI',
      icon: <Home className="w-4 h-4" />,
    },
    {
      id: 'community-library',
      label: 'TRIỂN LÃM TÁC PHẨM',
      subLabel: 'Bộ sưu tập tác phẩm mỹ thuật',
      icon: <Grid className="w-4 h-4" />,
    },
    {
      id: 'artverse-shorts',
      label: 'ARTVERSE SHORTS',
      subLabel: 'Phân hệ video ngắn độc lập',
      icon: <Film className="w-4 h-4" />,
    },
    {
      id: 'art-stories',
      label: 'CÂU CHUYỆN SAU NÉT VẼ',
      subLabel: 'Chia sẻ cảm xúc & góc nhìn',
      icon: <BookOpen className="w-4 h-4" />,
    },
    {
      id: 'class-lessons',
      label: 'MĨ THUẬT GDPT',
      subLabel: 'Tiểu học & THCS · Slide & Video',
      icon: <Layers className="w-4 h-4" />,
    },
    {
      id: 'upload-hub',
      label: 'ĐĂNG TẢI',
      subLabel: 'Đăng tác phẩm, video & học liệu',
      icon: <Upload className="w-4 h-4" />,
    },
    {
      id: 'profile-manage',
      label: 'HỒ SƠ CÁ NHÂN',
      subLabel: 'Thông tin & hoạt động cá nhân',
      icon: <UserCircle2 className="w-4 h-4" />,
    },
  ];

  // Section IV & V: Management & System Administration Groups (Authorized Staff only)
  const adminNavItems: NavItem[] = [
    {
      id: 'management-tools',
      label: 'CÔNG CỤ QUẢN LÝ',
      subLabel: 'Học sinh · Giáo viên · Lớp học · Phân quyền',
      icon: <Users className="w-4 h-4" />,
    },
    {
      id: 'system-admin',
      label: 'QUẢN TRỊ HỆ THỐNG',
      subLabel: 'Kiểm duyệt · Lưu trữ · Trình chiếu',
      icon: <ShieldCheck className="w-4 h-4" />,
      badge: pendingModerationCount > 0 ? pendingModerationCount : undefined,
    },
  ];

  const handleSelect = (tab: ScreenTab) => {
    onSelectTab(tab);
    onCloseMobile?.();
  };

  const renderNavButton = (item: NavItem) => {
    const isActive =
      currentTab === item.id ||
      (item.id === 'community-library' && currentTab === 'library') ||
      (item.id === 'system-admin' &&
        (currentTab === 'moderation' ||
          currentTab === 'storage-center' ||
          currentTab === 'safety-audit'));

    return (
      <li key={item.id}>
        <button
          type="button"
          onClick={() => handleSelect(item.id)}
          className={`group w-full flex items-center justify-between text-left px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${
            isActive
              ? 'bg-[#20243A] text-[#F7F3EA]'
              : 'hover:bg-[#20243A]/6 text-[#20243A]'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                isActive
                  ? 'bg-[#3457D5] text-white'
                  : 'bg-[#20243A]/6 text-[#20243A] group-hover:bg-[#20243A]/12'
              }`}
            >
              {item.icon}
            </span>
            <div className="min-w-0">
              <div
                className={`text-xs font-bold tracking-wide truncate ${
                  isActive ? 'text-[#F7F3EA]' : 'text-[#20243A]'
                }`}
              >
                {item.label}
              </div>
              <div
                className={`text-[10px] truncate mt-0.5 ${
                  isActive ? 'text-[#F7F3EA]/70' : 'text-[#20243A]/55'
                }`}
              >
                {item.subLabel}
              </div>
            </div>
          </div>

          {item.badge !== undefined && (
            <span className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-sm bg-[#F15B3D] text-white shrink-0">
              {item.badge}
            </span>
          )}
        </button>
      </li>
    );
  };

  const renderNavSections = () => (
    <div className="space-y-5">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-[#20243A]/50 font-bold px-3 pb-1.5">
          PHÂN HỆ CHÍNH
        </div>
        <ul className="space-y-1">{primaryNavItems.map(renderNavButton)}</ul>
      </div>

      {isAuthorizedStaff && (
        <div className="pt-3 border-t border-[#20243A]/12">
          <div className="text-[10px] uppercase tracking-widest text-[#3457D5] font-bold px-3 pb-1.5">
            QUẢN LÝ &amp; QUẢN TRỊ
          </div>
          <ul className="space-y-1">{adminNavItems.map(renderNavButton)}</ul>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Left Navigation Rail */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col justify-between bg-[#F7F3EA] border-r border-[#20243A]/12 px-4 py-6 select-none z-20 no-print">
        <div>
          <button
            type="button"
            onClick={() => onSelectTab('discover')}
            className="group text-left cursor-pointer block focus:outline-none px-1"
          >
            <ArtverseLogo size="md" showText={true} />
          </button>
        </div>

        <nav aria-label="Danh mục Không gian Nghệ thuật ART VERSE AI" className="my-auto py-6">
          {renderNavSections()}
        </nav>

        <div className="p-3.5 rounded-lg bg-white border border-[#20243A]/12 space-y-1">
          <div className="text-[10px] uppercase tracking-widest text-[#3457D5] font-bold">
            ART VERSE AI
          </div>
          <p className="text-[11px] text-[#20243A]/80 leading-relaxed">
            Không gian triển lãm tác phẩm, ARTVERSE SHORTS, Câu chuyện sau nét vẽ &amp; Mĩ thuật GDPT.
          </p>
        </div>
      </aside>

      {/* Mobile Slide-Over Navigation Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#20243A]/45 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <div className="relative w-76 max-w-[86vw] bg-[#F7F3EA] h-full shadow-xl border-r border-[#20243A]/15 p-5 flex flex-col justify-between z-10 overflow-y-auto">
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <ArtverseLogo size="sm" showText={true} />
                <button
                  type="button"
                  onClick={onCloseMobile}
                  aria-label="Đóng menu"
                  className="w-8 h-8 rounded-lg bg-white border border-[#20243A]/15 flex items-center justify-center text-[#20243A] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="pt-3 border-t border-[#20243A]/12">
                {renderNavSections()}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-white border border-[#20243A]/12 mt-6">
              <div className="text-[10px] uppercase tracking-widest text-[#F15B3D] font-bold">
                ART VERSE AI · CONTEMPORARY GALLERY
              </div>
              <p className="text-[11px] text-[#20243A]/75 mt-0.5">
                Nơi những ý tưởng trở thành tác phẩm.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
