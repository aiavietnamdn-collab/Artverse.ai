/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — Desktop Editorial Sidebar (Strictly hidden on iPhone screens; iPhone uses fixed Bottom Navigation)
 */

import React from 'react';
import { ScreenTab } from '../../types/artverse';
import { UserRole } from '../../types/communityArt';
import {
  Compass,
  LayoutGrid,
  BookOpenCheck,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  HeartHandshake
} from 'lucide-react';

import { ArtverseLogo } from './ArtverseLogo';

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
  subtitle: string;
  icon: React.ReactNode;
  badge?: number | string;
  rolesAllowed?: UserRole[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  currentRole = 'viewer',
  pendingModerationCount = 0
}) => {
  const navItems: NavItem[] = [
    {
      id: 'discover',
      label: 'Khám phá',
      subtitle: 'Tiêu điểm & Chủ đề hoạt động',
      icon: <Compass className="w-5 h-5 shrink-0" />
    },
    {
      id: 'community-library',
      label: 'Triển lãm (Digital Gallery)',
      subtitle: 'Trưng bày sáng tạo học sinh',
      icon: <LayoutGrid className="w-5 h-5 shrink-0" />
    },
    {
      id: 'class-lessons',
      label: 'Lớp học & Học liệu',
      subtitle: 'Khối 6, 7, 8, 9 · Video & Slide',
      icon: <BookOpenCheck className="w-5 h-5 shrink-0" />
    },
    {
      id: 'ai-chatbox',
      label: 'Chatbox AI · Gemini',
      subtitle: 'Hỏi đáp Mĩ thuật & Góp ý tranh',
      icon: <Sparkles className="w-5 h-5 shrink-0" />,
      badge: 'AI'
    },
    {
      id: 'moderation',
      label: 'Hàng chờ Kiểm duyệt',
      subtitle: 'Duyệt tranh & xử lý báo cáo',
      icon: <ShieldAlert className="w-5 h-5 shrink-0" />,
      badge: pendingModerationCount > 0 ? pendingModerationCount : undefined,
      rolesAllowed: ['teacher', 'moderator', 'admin']
    },
    {
      id: 'safety-audit',
      label: 'Bảo mật & Ẩn danh',
      subtitle: 'Kiểm toán quyền & Zero-Roster',
      icon: <ShieldCheck className="w-5 h-5 shrink-0" />
    },
    {
      id: 'profile-manage',
      label: 'Cá nhân / Quản lý',
      subtitle: 'Tài khoản, Vai trò & Cài PWA',
      icon: <UserCheck className="w-5 h-5 shrink-0" />
    }
  ];

  // Strictly desktop-only (hidden lg:block) so desktop sidebar never appears on mobile screens
  return (
    <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0 z-20 no-print">
      <div className="flex flex-col h-full bg-[#FAF8F5] border-r border-stone-200/90 text-stone-700">
        {/* Brand Header */}
        <div className="p-5 pb-4 border-b border-stone-200/80 flex items-center justify-between">
          <ArtverseLogo size="md" showText={true} />
        </div>

        {/* Zero-score Community Mission Note */}
        <div className="mx-3 my-3 p-3 bg-white rounded-xl border border-stone-200/90 text-xs text-stone-800 leading-relaxed shadow-2xs">
          <div className="flex items-center gap-1.5 font-bold text-[#1D4ED8] mb-1">
            <HeartHandshake className="w-3.5 h-3.5 shrink-0" />
            <span>Nguyên tắc Nghệ thuật</span>
          </div>
          <p className="text-[11px] text-stone-600">
            Tôn trọng sáng tạo tự nhiên. <strong>Không chấm điểm</strong>, chỉ khích lệ qua 5 phản hồi tích cực.
          </p>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 px-3 py-1 space-y-1 overflow-y-auto">
          <p className="px-3 pt-1 pb-1 text-[10px] font-bold tracking-wider text-stone-400 uppercase">
            Không gian ARTVERSE AI
          </p>

          {navItems.map((item) => {
            const isRestricted = item.rolesAllowed && !item.rolesAllowed.includes(currentRole);
            const isActive =
              currentTab === item.id ||
              (item.id === 'community-library' && currentTab === 'library');

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#121316] text-white font-semibold shadow-xs'
                    : 'hover:bg-stone-200/60 text-stone-700 hover:text-[#121316]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={isActive ? 'text-[#FBBF24]' : 'text-stone-500'}>
                    {item.icon}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate leading-tight flex items-center gap-1.5">
                      <span>{item.label}</span>
                      {isRestricted && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-stone-200 text-stone-600 font-normal">
                          GV
                        </span>
                      )}
                    </div>
                    <div
                      className={`text-[10px] truncate leading-tight mt-0.5 ${
                        isActive ? 'text-stone-300' : 'text-stone-400'
                      }`}
                    >
                      {item.subtitle}
                    </div>
                  </div>
                </div>

                {item.badge !== undefined && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-[#1D4ED8] text-white' : 'bg-[#EA580C] text-white'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-stone-200/80 bg-white/60 text-xs">
          <div className="p-2.5 rounded-xl bg-stone-100/90 border border-stone-200 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Bảo mật</span>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                Zero-Roster &amp; EXIF Clean
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
