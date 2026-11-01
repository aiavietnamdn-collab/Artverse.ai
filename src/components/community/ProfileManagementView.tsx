/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — Trang Cá nhân & Quản lý (iPhone Safari & PWA Hub)
 */

import React, { useState, useEffect } from 'react';
import { ScreenTab } from '../../types/artverse';
import { UserRole } from '../../types/communityArt';
import { useAuth } from '../../context/AuthContext';
import { APP_VERSION, APP_BUILD_ID, forceRefreshAppVersion } from '../../lib/platform';
import {
  User,
  LogIn,
  LogOut,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  BookOpen,
  Smartphone,
  Share,
  PlusSquare,
  CheckCircle2,
  Eye,
  Palette,
  GraduationCap,
  Shield,
  Lock,
  ArrowRight,
  RefreshCw
} from 'lucide-react';

interface ProfileManagementViewProps {
  currentRole: UserRole;
  onSelectRole: (role: UserRole) => void;
  onNavigateTab: (tab: ScreenTab) => void;
  onOpenArtbookExportModal: () => void;
  pendingModerationCount: number;
  artworksCount: number;
  classesCount: number;
  lessonsCount: number;
  authorKey: string;
  nickname: string;
  onShowToast: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

export const ProfileManagementView: React.FC<ProfileManagementViewProps> = ({
  currentRole,
  onSelectRole,
  onNavigateTab,
  onOpenArtbookExportModal,
  pendingModerationCount,
  artworksCount,
  lessonsCount,
  nickname,
  onShowToast
}) => {
  const { user, profile, loading, isTeacher, isAdmin, verifiedRole, loginWithGoogle, logout } = useAuth();

  // Check if running in standalone mode (added to iPhone Home Screen)
  const [isStandalonePWA, setIsStandalonePWA] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    const checkStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((window.navigator as any).standalone);
    setIsStandalonePWA(checkStandalone);
  }, []);

  const roles: Array<{
    key: UserRole;
    label: string;
    desc: string;
    icon: React.ReactNode;
    requiresAuth: boolean;
    requiredVerifiedRole?: 'teacher' | 'admin';
  }> = [
    {
      key: 'viewer',
      label: 'Khách tham quan',
      desc: 'Xem triển lãm và gửi 5 cảm xúc động viên tích cực',
      icon: <Eye className="w-4 h-4" />,
      requiresAuth: false
    },
    {
      key: 'contributor',
      label: 'Tác giả đóng góp',
      desc: 'Đăng tác phẩm với biệt danh nghệ thuật ẩn danh',
      icon: <Palette className="w-4 h-4" />,
      requiresAuth: false
    },
    {
      key: 'teacher',
      label: 'Giáo viên Mĩ thuật',
      desc: 'Xuất bản tức thì & quản lý học liệu Khối 6, 7, 8, 9',
      icon: <GraduationCap className="w-4 h-4" />,
      requiresAuth: true,
      requiredVerifiedRole: 'teacher'
    },
    {
      key: 'moderator',
      label: 'Kiểm duyệt viên',
      desc: 'Xử lý hàng chờ kiểm duyệt và báo cáo an toàn',
      icon: <ShieldAlert className="w-4 h-4" />,
      requiresAuth: true,
      requiredVerifiedRole: 'teacher'
    },
    {
      key: 'admin',
      label: 'Quản trị viên',
      desc: 'Toàn quyền cấu hình hệ thống & phân quyền Firestore',
      icon: <Shield className="w-4 h-4" />,
      requiresAuth: true,
      requiredVerifiedRole: 'admin'
    }
  ];

  const handleRoleSwitch = (r: (typeof roles)[number]) => {
    if (r.requiresAuth && !user) {
      loginWithGoogle();
      return;
    }
    if (r.requiredVerifiedRole === 'admin' && !isAdmin) {
      onShowToast('info', 'Yêu cầu quyền Quản trị', 'Tài khoản của bạn chưa có quyền Quản trị viên trên máy chủ.');
      return;
    }
    if (r.requiredVerifiedRole === 'teacher' && !isTeacher) {
      onShowToast('info', 'Yêu cầu quyền Giáo viên', 'Tài khoản của bạn chưa có quyền Giáo viên trên cơ sở dữ liệu.');
      return;
    }
    onSelectRole(r.key);
    onShowToast('success', 'Đã chuyển vai trò', `Đang hoạt động với vai trò: ${r.label}`);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="border-b border-stone-300/80 pb-4">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1D4ED8]">
          TÀI KHOẢN &amp; TRUNG TÂM ĐIỀU HÀNH
        </span>
        <h1 className="font-editorial text-3xl sm:text-4xl font-bold text-[#121316] mt-1">
          Cá nhân &amp; Quản lý
        </h1>
      </div>

      {/* 1. Account Card (Firebase Authentication) */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'Tài khoản'}
                className="w-14 h-14 rounded-2xl object-cover border border-stone-200"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-[#121316] text-[#FAF8F5] flex items-center justify-center font-editorial text-xl font-bold">
                {user ? (user.displayName || user.email || 'GV').charAt(0).toUpperCase() : <User className="w-6 h-6" />}
              </div>
            )}

            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#121316]">
                {user ? profile?.displayName || user.displayName || user.email : `Khách sáng tạo (${nickname})`}
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                {user
                  ? `Đã xác thực Firebase · Vai trò máy chủ: ${verifiedRole.toUpperCase()}`
                  : 'Chế độ ẩn danh Zero-Roster · Chưa đăng nhập tài khoản Giáo viên'}
              </p>
            </div>
          </div>

          {user ? (
            <button
              type="button"
              onClick={() => logout()}
              className="min-h-[48px] px-5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs inline-flex items-center justify-center gap-2 border border-rose-200 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Đăng xuất</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={() => loginWithGoogle()}
              className="min-h-[48px] px-5 py-2.5 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold text-xs inline-flex items-center justify-center gap-2 shadow-md cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>{loading ? 'Đang kết nối...' : 'Đăng nhập Google (Giáo viên)'}</span>
            </button>
          )}
        </div>

        {/* Summary Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-stone-100 text-center">
          <div className="p-3 rounded-xl bg-stone-50">
            <div className="text-xl font-extrabold text-[#121316]">{artworksCount}</div>
            <div className="text-[11px] text-stone-500 font-medium">Tác phẩm Triển lãm</div>
          </div>
          <div className="p-3 rounded-xl bg-stone-50">
            <div className="text-xl font-extrabold text-[#1D4ED8]">{lessonsCount}</div>
            <div className="text-[11px] text-stone-500 font-medium">Bài học Khối 6–9</div>
          </div>
          <div className="col-span-2 sm:col-span-1 p-3 rounded-xl bg-stone-50">
            <div className="text-xl font-extrabold text-[#EA580C]">{pendingModerationCount}</div>
            <div className="text-[11px] text-stone-500 font-medium">Mục chờ kiểm duyệt</div>
          </div>
        </div>
      </div>

      {/* 2. Quick Workspace Tools (AI Chat, Moderation, Audit, Artbook) */}
      <div className="space-y-3">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-stone-500">
          Công cụ Chuyên môn &amp; Quản trị
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Gemini AI Chatbox */}
          <button
            type="button"
            onClick={() => onNavigateTab('ai-chatbox')}
            className="min-h-[68px] p-4 rounded-2xl bg-white border border-stone-200/90 text-left flex items-center justify-between gap-3 cursor-pointer hover:border-[#1D4ED8]"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1D4ED8]/10 text-[#1D4ED8] flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-[#121316]">Trợ lý AI Mĩ thuật · Gemini</div>
                <div className="text-[11px] text-stone-500">Hỏi đáp bố cục, phối màu &amp; góp ý tranh</div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-stone-400 shrink-0" />
          </button>

          {/* Moderation Queue */}
          <button
            type="button"
            onClick={() => onNavigateTab('moderation')}
            className="min-h-[68px] p-4 rounded-2xl bg-white border border-stone-200/90 text-left flex items-center justify-between gap-3 cursor-pointer hover:border-[#1D4ED8]"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-[#121316]">Hàng chờ Kiểm duyệt</div>
                <div className="text-[11px] text-stone-500">
                  Duyệt tranh &amp; xử lý báo cáo ({pendingModerationCount})
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-stone-400 shrink-0" />
          </button>

          {/* Safety & Zero-Roster Audit */}
          <button
            type="button"
            onClick={() => onNavigateTab('safety-audit')}
            className="min-h-[68px] p-4 rounded-2xl bg-white border border-stone-200/90 text-left flex items-center justify-between gap-3 cursor-pointer hover:border-[#1D4ED8]"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-[#121316]">Bảo mật &amp; Kiểm toán</div>
                <div className="text-[11px] text-stone-500">Nhật ký an toàn &amp; Zero-Roster</div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-stone-400 shrink-0" />
          </button>

          {/* Export Class Artbook */}
          <button
            type="button"
            onClick={onOpenArtbookExportModal}
            className="min-h-[68px] p-4 rounded-2xl bg-white border border-stone-200/90 text-left flex items-center justify-between gap-3 cursor-pointer hover:border-[#1D4ED8]"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-800 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-[#121316]">Xuất Kỷ yếu &amp; Poster Lớp</div>
                <div className="text-[11px] text-stone-500">Tạo Poster ghép tranh hoặc in ấn Kỷ yếu</div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-stone-400 shrink-0" />
          </button>
        </div>
      </div>

      {/* 3. Role Switcher (Zero-Trust RBAC) */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-5 space-y-3">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-stone-500">
          Chế độ Vai trò (Phân quyền Máy chủ Zero-Trust)
        </h3>
        <div className="grid grid-cols-1 gap-2">
          {roles.map((r) => {
            const isActive = currentRole === r.key;
            const isLocked = r.requiresAuth && (!user || (r.requiredVerifiedRole === 'admin' && !isAdmin));

            return (
              <button
                key={r.key}
                type="button"
                onClick={() => handleRoleSwitch(r)}
                className={`min-h-[52px] p-3.5 rounded-xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#1D4ED8]/8 border-[#1D4ED8] text-[#1D4ED8]'
                    : isLocked
                    ? 'bg-stone-50/70 border-stone-200 text-stone-400'
                    : 'bg-white border-stone-200 text-stone-800 hover:bg-stone-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span>{isLocked ? <Lock className="w-4 h-4" /> : r.icon}</span>
                  <div>
                    <div className="text-xs font-bold">{r.label}</div>
                    <div className="text-[11px] opacity-80">{r.desc}</div>
                  </div>
                </div>
                {isActive && <CheckCircle2 className="w-4 h-4 text-[#1D4ED8] shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. iPhone PWA & Home Screen Experience */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#121316] text-white flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-[#FBBF24]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#121316]">
                Ứng dụng Màn hình chính iPhone (PWA)
              </h3>
              <p className="text-[11px] text-stone-500">
                {isStandalonePWA
                  ? 'Đang mở ở chế độ Ứng dụng toàn màn hình (Standalone)'
                  : 'Tối ưu cho Safari iOS · Hỗ trợ Dynamic Island & Safe Area'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowIOSGuide(!showIOSGuide)}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs cursor-pointer"
          >
            {showIOSGuide ? 'Thu gọn' : 'Hướng dẫn cài'}
          </button>
        </div>

        {showIOSGuide && (
          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2.5 text-xs text-stone-700">
            <p className="font-bold text-stone-900">
              Cách thêm ARTVERSE AI vào Màn hình chính iPhone (Safari):
            </p>
            <div className="flex items-center gap-2">
              <Share className="w-4 h-4 text-[#1D4ED8] shrink-0" />
              <span>1. Nhấn vào biểu tượng <strong>Chia sẻ (Share)</strong> ở thanh công cụ dưới cùng của trình duyệt Safari.</span>
            </div>
            <div className="flex items-center gap-2">
              <PlusSquare className="w-4 h-4 text-[#1D4ED8] shrink-0" />
              <span>2. Cuộn xuống và chọn <strong>"Thêm vào Màn hình chính" (Add to Home Screen)</strong>.</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>3. Nhấn <strong>Thêm (Add)</strong> ở góc trên bên phải để mở ARTVERSE AI như một ứng dụng độc lập.</span>
            </div>
          </div>
        )}
      </div>

      {/* 5. Version Verification & Cache Refresh */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
            Thông tin Phiên bản &amp; Đồng bộ
          </div>
          <div className="text-sm font-extrabold text-[#121316] mt-0.5">
            ARTVERSE AI v{APP_VERSION} · Build {APP_BUILD_ID}
          </div>
          <div className="text-xs text-stone-500 mt-0.5">
            App ID: vn.artverseai.app · Tối ưu Website, PWA &amp; iOS Safari
          </div>
        </div>

        <button
          type="button"
          onClick={() => forceRefreshAppVersion()}
          className="min-h-[44px] px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs inline-flex items-center justify-center gap-2 border border-stone-200 cursor-pointer shrink-0"
        >
          <RefreshCw className="w-4 h-4 text-[#1D4ED8]" />
          <span>Làm mới phiên bản &amp; Xóa bộ nhớ đệm</span>
        </button>
      </div>
    </div>
  );
};
