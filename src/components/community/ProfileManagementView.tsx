/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ART VERSE AI — Phân hệ 7: HỒ SƠ CÁ NHÂN (MASTER NAMING & IA 2.0 - Section III.7)
 * Hiển thị đầy đủ 7 mục:
 * 1. Thông tin tài khoản hoặc bí danh.
 * 2. Tác phẩm đã đăng.
 * 3. Video ngắn đã đăng (ARTVERSE SHORTS).
 * 4. Câu chuyện của tôi (Bản nháp, Chờ duyệt, Yêu cầu chỉnh sửa, Đã công bố).
 * 5. Tài nguyên đã tải lên (nếu là giáo viên).
 * 6. Cài đặt tài khoản.
 * 7. Đăng xuất.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { ScreenTab } from '../../types/artverse';
import {
  UserRole,
  CommunityArtwork,
  ArtworkStory,
  ArtLesson,
  CREATIVE_NICKNAME_SUGGESTIONS,
  NicknameValidationResult,
} from '../../types/communityArt';
import { useAuth } from '../../context/AuthContext';
import { normalizeGrade, getArtworkNormalizedGrade } from '../../utils/gradeUtils';
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
  RefreshCw,
  KeyRound,
  Edit3,
  AlertCircle,
  BookOpenText,
  Image as ImageIcon,
  Film,
  Presentation,
  Settings,
  Upload,
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
  artworks?: CommunityArtwork[];
  stories?: ArtworkStory[];
  lessons?: ArtLesson[];
  onSelectArtwork?: (artwork: CommunityArtwork) => void;
  onOpenWriteStoryModal?: (artwork?: CommunityArtwork | null, storyToEdit?: ArtworkStory | null) => void;
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
  artworks = [],
  stories = [],
  lessons = [],
  onSelectArtwork,
  onOpenWriteStoryModal,
  onShowToast,
}) => {
  const {
    user,
    profile,
    loading,
    isTeacher,
    isAdmin,
    isStudent,
    setIsStudentLoginModalOpen,
    setIsNicknameOnboardingModalOpen,
    updateStudentNickname,
    loginWithGoogle,
    logout,
  } = useAuth();

  const verifiedRole = isAdmin ? 'admin' : isTeacher ? 'teacher' : isStudent ? 'student' : 'viewer';
  const activeUid = profile?.uid || user?.uid || '';
  const activeAlias =
    (isStudent && profile
      ? profile.nickname || profile.alias || profile.displayName
      : user
        ? profile?.displayName || user.displayName || user.email
        : nickname) || nickname;

  const [isStandalonePWA, setIsStandalonePWA] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Student Nickname Editing State in Profile
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState(profile?.nickname || '');
  const [validationResult, setValidationResult] = useState<NicknameValidationResult | null>(null);
  const [isSavingNickname, setIsSavingNickname] = useState(false);
  const [nicknameError, setNicknameError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.nickname) {
      setNicknameDraft(profile.nickname);
    }
  }, [profile?.nickname]);

  useEffect(() => {
    const checkStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((window.navigator as any).standalone);
    setIsStandalonePWA(checkStandalone);
  }, []);

  useEffect(() => {
    if (!isEditingNickname || !isStudent) return;
    const trimmed = nicknameDraft.trim();
    if (!trimmed) {
      setValidationResult(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/student/nickname/check?nickname=${encodeURIComponent(trimmed)}`,
          {
            credentials: 'include',
          }
        );
        if (res.ok) {
          const data = (await res.json()) as NicknameValidationResult;
          setValidationResult(data);
        }
      } catch {
        // Ignore check error
      }
    }, 240);

    return () => clearTimeout(timer);
  }, [nicknameDraft, isEditingNickname, isStudent]);

  const handleSaveProfileNickname = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = nicknameDraft.trim().replace(/\s+/g, ' ');
    if (cleaned.length < 2 || cleaned.length > 24) {
      setNicknameError('Biệt danh cần có độ dài từ 2 đến 24 ký tự.');
      return;
    }
    setIsSavingNickname(true);
    setNicknameError(null);

    const res = await updateStudentNickname(cleaned);
    setIsSavingNickname(false);

    if (!res.success) {
      setNicknameError(res.error || 'Không thể cập nhật biệt danh lúc này.');
      if (res.suggestions && res.suggestions.length > 0) {
        setValidationResult({
          valid: false,
          available: false,
          normalized: cleaned,
          reason: res.error,
          suggestions: res.suggestions,
        });
      }
      onShowToast('error', 'Chưa thể đổi biệt danh', res.error || 'Vui lòng kiểm lại biệt danh.');
      return;
    }

    setIsEditingNickname(false);
    onShowToast(
      'success',
      'Đã cập nhật Biệt danh Nghệ sĩ!',
      `Biệt danh mới của em trong ART VERSE AI là "${res.profile?.nickname || cleaned}".`
    );
  };

  // 2. Tác phẩm đã đăng (Visual Artworks)
  const myVisualArtworks = useMemo(() => {
    return artworks.filter((a) => {
      const isVideo =
        a.mediaType === 'video' ||
        Boolean(a.videoUrl) ||
        Boolean(a.mimeType && a.mimeType.startsWith('video/'));
      if (isVideo) return false;
      if (activeUid && (a.authorAccountId === activeUid || a.userId === activeUid)) return true;
      const artAlias = (
        a.authorNickname ||
        a.authorAlias ||
        a.creatorAnonymousPseudonym ||
        ''
      )
        .trim()
        .toLowerCase();
      return Boolean(activeAlias && artAlias === activeAlias.trim().toLowerCase());
    });
  }, [artworks, activeUid, activeAlias]);

  // 3. Video ngắn đã đăng (ARTVERSE SHORTS)
  const myShortVideos = useMemo(() => {
    return artworks.filter((a) => {
      const isVideo =
        a.mediaType === 'video' ||
        Boolean(a.videoUrl) ||
        Boolean(a.mimeType && a.mimeType.startsWith('video/'));
      if (!isVideo) return false;
      if (activeUid && (a.authorAccountId === activeUid || a.userId === activeUid)) return true;
      const artAlias = (
        a.authorNickname ||
        a.authorAlias ||
        a.creatorAnonymousPseudonym ||
        ''
      )
        .trim()
        .toLowerCase();
      return Boolean(activeAlias && artAlias === activeAlias.trim().toLowerCase());
    });
  }, [artworks, activeUid, activeAlias]);

  // 4. Câu chuyện của tôi (Bản nháp, Chờ duyệt, Yêu cầu chỉnh sửa, Đã công bố)
  const myStories = useMemo(() => {
    return stories.filter((s) => {
      if (activeUid && s.authorAccountId === activeUid) return true;
      return Boolean(
        activeAlias &&
          s.authorNickname &&
          s.authorNickname.trim().toLowerCase() === activeAlias.trim().toLowerCase()
      );
    });
  }, [stories, activeUid, activeAlias]);

  // 5. Tài nguyên đã tải lên (dành cho Giáo viên / Quản trị)
  const uploadedGdptResources = useMemo(() => {
    return lessons.filter(
      (l) =>
        l.status !== 'deleted' &&
        !l.isHidden &&
        (Boolean(l.slideUrl) ||
          Boolean(l.videoUrl) ||
          (Array.isArray(l.slides) && l.slides.length > 0))
    );
  }, [lessons]);

  const roles: Array<{
    key: UserRole;
    label: string;
    desc: string;
    icon: React.ReactNode;
    requiresAuth: boolean;
    requiredVerifiedRole?: 'student' | 'teacher' | 'admin';
  }> = [
    {
      key: 'viewer',
      label: 'Khách tham quan',
      desc: 'Xem triển lãm và gửi 5 cảm xúc động viên tích cực',
      icon: <Eye className="w-4 h-4" />,
      requiresAuth: false,
    },
    {
      key: 'student',
      label: 'Học sinh (Thẻ PIN)',
      desc: 'Đăng nhập bằng Mã lớp + Mã HS + PIN, tạo Bí danh & viết Câu chuyện sau nét vẽ',
      icon: <KeyRound className="w-4 h-4" />,
      requiresAuth: true,
      requiredVerifiedRole: 'student',
    },
    {
      key: 'teacher',
      label: 'Giáo viên Mĩ thuật',
      desc: 'Tạo tài khoản học sinh, duyệt Câu chuyện sau nét vẽ & đăng tải học liệu Mĩ thuật GDPT',
      icon: <GraduationCap className="w-4 h-4" />,
      requiresAuth: true,
      requiredVerifiedRole: 'teacher',
    },
    {
      key: 'moderator',
      label: 'Kiểm duyệt viên',
      desc: 'Xử lý hàng chờ kiểm duyệt và báo cáo an toàn',
      icon: <ShieldAlert className="w-4 h-4" />,
      requiresAuth: true,
      requiredVerifiedRole: 'teacher',
    },
    {
      key: 'admin',
      label: 'Quản trị viên',
      desc: 'Phân quyền giáo viên, quản lý lưu trữ & quản trị hệ thống ART VERSE AI',
      icon: <Shield className="w-4 h-4" />,
      requiresAuth: true,
      requiredVerifiedRole: 'admin',
    },
  ];

  const handleRoleSwitch = (r: (typeof roles)[number]) => {
    if (isStudent && r.key !== 'student') {
      onShowToast(
        'error',
        'Không được phép thay đổi vai trò',
        'Tài khoản Học sinh được cố định quyền học tập theo lớp, không được chuyển sang Giáo viên hoặc Quản trị viên.'
      );
      return;
    }

    if (r.requiredVerifiedRole === 'student') {
      if (!isStudent) {
        setIsStudentLoginModalOpen(true);
        return;
      }
      onSelectRole('student');
      return;
    }

    if (r.requiresAuth && !user) {
      loginWithGoogle();
      return;
    }
    if (r.requiredVerifiedRole === 'admin' && !isAdmin) {
      onShowToast(
        'info',
        'Yêu cầu quyền Quản trị',
        'Tài khoản của bạn chưa có quyền Quản trị viên trên máy chủ.'
      );
      return;
    }
    if (r.requiredVerifiedRole === 'teacher' && !isTeacher) {
      onShowToast(
        'info',
        'Yêu cầu quyền Giáo viên',
        'Chỉ Quản trị viên mới được cấp quyền Giáo viên trên hệ thống.'
      );
      return;
    }
    onSelectRole(r.key);
    onShowToast('success', 'Đã chuyển vai trò', `Đang hoạt động với vai trò: ${r.label}`);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10 text-[#20243A] museum-fade-in">
      {/* Masthead */}
      <section className="rounded-xl bg-white border border-[#20243A]/15 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#3457D5]">
            <span className="w-2.5 h-2.5 bg-[#F15B3D] inline-block" />
            <span>PHÂN HỆ 07 · ART VERSE AI</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-black text-[#20243A] tracking-tight uppercase">
            HỒ SƠ CÁ NHÂN
          </h1>
          <p className="text-xs sm:text-sm text-[#20243A]/70">
            Quản lý bí danh nghệ thuật, tác phẩm đã đăng, video ngắn ARTVERSE SHORTS, câu chuyện của tôi và cài đặt tài khoản.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigateTab('upload-hub')}
          className="min-h-[42px] px-5 py-2.5 rounded-lg bg-[#20243A] hover:bg-[#3457D5] text-[#F7F3EA] text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 cursor-pointer transition-colors"
        >
          <Upload className="w-4 h-4 text-[#F2D64B]" />
          <span>Đến Trung tâm Đăng tải</span>
        </button>
      </section>

      {/* MỤC 1 & MỤC 7: THÔNG TIN TÀI KHOẢN / BÍ DANH & ĐĂNG XUẤT */}
      <section className="bg-white rounded-xl border border-[#20243A]/15 p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'Tài khoản'}
                className="w-14 h-14 rounded-xl object-cover border border-[#20243A]/20"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-[#20243A] text-[#F7F3EA] flex items-center justify-center font-display text-xl font-bold">
                {activeAlias.charAt(0).toUpperCase()}
              </div>
            )}

            <div>
              <span className="text-[10px] font-mono-code font-bold uppercase tracking-wider text-[#3457D5]">
                1. THÔNG TIN TÀI KHOẢN HOẶC BÍ DANH
              </span>
              <h2 className="text-base sm:text-lg font-extrabold text-[#20243A] flex items-center gap-2 flex-wrap mt-0.5">
                <span>{activeAlias}</span>
                <span className="px-2.5 py-0.5 rounded-sm bg-[#F2D64B] text-[#20243A] text-[10px] font-extrabold uppercase tracking-wider">
                  {verifiedRole === 'admin'
                    ? 'QUẢN TRỊ VIÊN'
                    : verifiedRole === 'teacher'
                      ? 'GIÁO VIÊN MĨ THUẬT'
                      : verifiedRole === 'student'
                        ? 'NGHỆ SĨ HỌC SINH'
                        : 'BÍ DANH SÁNG TẠO'}
                </span>
              </h2>
              <p className="text-xs text-[#20243A]/65 mt-0.5">
                {isStudent && profile
                  ? `Học sinh · ${normalizeGrade(profile.className || profile.classGroupId)} · Triển lãm chỉ hiển thị Bí danh công khai`
                  : user
                    ? `Tài khoản xác thực ART VERSE AI · Vai trò: ${verifiedRole.toUpperCase()}`
                    : 'Đăng nhập bằng Thẻ PIN (Học sinh) hoặc tài khoản Google (Giáo viên / Quản trị viên)'}
              </p>
            </div>
          </div>

          {/* 7. ĐĂNG XUẤT / ĐĂNG NHẬP */}
          <div className="flex flex-wrap items-center gap-2">
            {isStudent && (
              <button
                type="button"
                onClick={() => {
                  setIsEditingNickname(!isEditingNickname);
                  setNicknameDraft(profile?.nickname || '');
                  setNicknameError(null);
                }}
                className="min-h-[42px] px-3.5 py-2 rounded-lg bg-[#F7F3EA] hover:bg-[#20243A]/10 text-[#20243A] font-bold text-xs inline-flex items-center gap-1.5 border border-[#20243A]/15 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-[#3457D5]" />
                <span>{isEditingNickname ? 'Đóng đổi bí danh' : 'Đổi bí danh'}</span>
              </button>
            )}

            {isStudent || user ? (
              <button
                type="button"
                onClick={() => logout()}
                className="min-h-[42px] px-4 py-2 rounded-lg bg-[#F15B3D]/12 hover:bg-[#F15B3D] text-[#F15B3D] hover:text-white font-bold text-xs inline-flex items-center justify-center gap-2 border border-[#F15B3D]/30 cursor-pointer transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>7. Đăng xuất</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setIsStudentLoginModalOpen(true)}
                  className="min-h-[42px] px-4 py-2 rounded-lg bg-[#3457D5] hover:bg-[#20243A] text-white font-bold text-xs inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <KeyRound className="w-4 h-4 text-[#F2D64B]" />
                  <span>Học sinh Đăng nhập (PIN)</span>
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => loginWithGoogle()}
                  className="min-h-[42px] px-4 py-2 rounded-lg bg-[#20243A] hover:bg-[#3457D5] text-white font-bold text-xs inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{loading ? '...' : 'GV / Quản trị (Google)'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Form đổi bí danh cho học sinh */}
        {isEditingNickname && isStudent && (
          <form
            onSubmit={handleSaveProfileNickname}
            className="p-4 rounded-xl bg-[#F7F3EA] border border-[#20243A]/15 space-y-3"
          >
            <div>
              <label className="block text-xs font-extrabold text-[#20243A] mb-1">
                Nhập bí danh nghệ sĩ mới (2–24 ký tự):
              </label>
              <input
                type="text"
                maxLength={24}
                value={nicknameDraft}
                onChange={(e) => {
                  setNicknameDraft(e.target.value);
                  setNicknameError(null);
                }}
                placeholder="Ví dụ: Mây Màu, Cọ Nhỏ, Mặt Trời Xanh..."
                className="w-full px-3.5 py-2 rounded-lg bg-white border border-[#20243A]/20 text-sm font-bold text-[#20243A]"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {CREATIVE_NICKNAME_SUGGESTIONS.slice(0, 6).map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => {
                    setNicknameDraft(sug);
                    setNicknameError(null);
                  }}
                  className="px-2.5 py-1 rounded-md bg-white border border-[#20243A]/15 text-xs font-bold text-[#20243A] cursor-pointer"
                >
                  {sug}
                </button>
              ))}
            </div>

            {(nicknameError || (validationResult && !validationResult.valid)) && (
              <div className="p-2.5 rounded-lg bg-[#F15B3D]/10 border border-[#F15B3D]/30 text-xs text-[#F15B3D] font-bold">
                {nicknameError || validationResult?.reason}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditingNickname(false)}
                className="px-3.5 py-1.5 rounded-lg bg-white border border-[#20243A]/20 text-xs font-bold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSavingNickname || nicknameDraft.trim().length < 2}
                className="px-4 py-1.5 rounded-lg bg-[#3457D5] text-white text-xs font-bold cursor-pointer"
              >
                Lưu bí danh mới
              </button>
            </div>
          </form>
        )}
      </section>

      {/* MỤC 2: TÁC PHẨM ĐÃ ĐĂNG */}
      <section className="bg-white rounded-xl border border-[#20243A]/15 p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#20243A]/10 pb-3">
          <div className="flex items-center gap-2.5">
            <ImageIcon className="w-4 h-4 text-[#3457D5]" />
            <h3 className="font-display text-base font-bold text-[#20243A] uppercase">
              2. TÁC PHẨM ĐÃ ĐĂNG ({myVisualArtworks.length})
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('community-library')}
            className="text-xs font-bold text-[#3457D5] hover:underline cursor-pointer"
          >
            Xem Triển lãm Tác phẩm →
          </button>
        </div>

        {myVisualArtworks.length === 0 ? (
          <p className="text-xs text-[#20243A]/65">
            Chưa có tác phẩm hội họa nào được đăng dưới bí danh <strong>{activeAlias}</strong>.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {myVisualArtworks.slice(0, 8).map((art) => (
              <div
                key={art.id}
                onClick={() => onSelectArtwork?.(art)}
                className="group cursor-pointer rounded-lg border border-[#20243A]/15 overflow-hidden bg-[#F7F3EA]/50"
              >
                <div className="aspect-[4/3] bg-[#20243A] overflow-hidden">
                  <img
                    src={art.thumbnailUrl || art.imageUrl || art.downloadURL}
                    alt={art.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-bold text-[#20243A] truncate">{art.title}</p>
                  <p className="text-[10px] text-[#20243A]/60 mt-0.5">
                    {getArtworkNormalizedGrade(art)} · {art.status === 'approved' ? 'Đã duyệt' : 'Chờ duyệt'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* MỤC 3: VIDEO NGẮN ĐÃ ĐĂNG (ARTVERSE SHORTS) */}
      <section className="bg-white rounded-xl border border-[#20243A]/15 p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#20243A]/10 pb-3">
          <div className="flex items-center gap-2.5">
            <Film className="w-4 h-4 text-[#F15B3D]" />
            <h3 className="font-display text-base font-bold text-[#20243A] uppercase">
              3. VIDEO NGẮN ĐÃ ĐĂNG — ARTVERSE SHORTS ({myShortVideos.length})
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('artverse-shorts')}
            className="text-xs font-bold text-[#F15B3D] hover:underline cursor-pointer"
          >
            Mở ARTVERSE SHORTS →
          </button>
        </div>

        {myShortVideos.length === 0 ? (
          <p className="text-xs text-[#20243A]/65">
            Chưa có video ngắn nào được đăng trên ARTVERSE SHORTS dưới bí danh{' '}
            <strong>{activeAlias}</strong>.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {myShortVideos.slice(0, 8).map((vid) => (
              <div
                key={vid.id}
                onClick={() => onSelectArtwork?.(vid)}
                className="group cursor-pointer rounded-lg border border-[#20243A]/15 overflow-hidden bg-[#F7F3EA]/50"
              >
                <div className="aspect-[4/5] bg-[#161929] relative flex items-center justify-center overflow-hidden">
                  {vid.thumbnailUrl || vid.imageUrl ? (
                    <img
                      src={vid.thumbnailUrl || vid.imageUrl}
                      alt={vid.title}
                      className="w-full h-full object-cover opacity-85"
                    />
                  ) : (
                    <Film className="w-6 h-6 text-[#F2D64B]" />
                  )}
                  <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-sm bg-[#F15B3D] text-white text-[9px] font-bold">
                    SHORTS
                  </span>
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-bold text-[#20243A] truncate">{vid.title}</p>
                  <p className="text-[10px] text-[#20243A]/60 mt-0.5">
                    {getArtworkNormalizedGrade(vid)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* MỤC 4: CÂU CHUYỆN CỦA TÔI (Bản nháp, Chờ duyệt, Yêu cầu chỉnh sửa, Đã công bố) */}
      <section className="bg-white rounded-xl border border-[#20243A]/15 p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#20243A]/10 pb-3">
          <div className="flex items-center gap-2.5">
            <BookOpenText className="w-4 h-4 text-[#269C91]" />
            <h3 className="font-display text-base font-bold text-[#20243A] uppercase">
              4. CÂU CHUYỆN CỦA TÔI ({myStories.length})
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {onOpenWriteStoryModal && (
              <button
                type="button"
                onClick={() => onOpenWriteStoryModal(myVisualArtworks[0] || null, null)}
                className="px-3 py-1.5 rounded-lg bg-[#20243A] hover:bg-[#3457D5] text-white text-xs font-bold cursor-pointer transition-colors"
              >
                + Viết câu chuyện mới
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigateTab('art-stories')}
              className="text-xs font-bold text-[#269C91] hover:underline cursor-pointer"
            >
              Tất cả câu chuyện →
            </button>
          </div>
        </div>

        {/* Thống kê 4 trạng thái câu chuyện của tôi */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
          <div className="p-2.5 rounded-lg bg-[#F7F3EA] border border-[#20243A]/10">
            <div className="text-base font-black text-[#20243A]">
              {myStories.filter((s) => s.status === 'draft').length}
            </div>
            <div className="text-[11px] font-bold text-[#20243A]/65">Bản nháp (DRAFT)</div>
          </div>
          <div className="p-2.5 rounded-lg bg-[#3457D5]/8 border border-[#3457D5]/20">
            <div className="text-base font-black text-[#3457D5]">
              {myStories.filter((s) => s.status === 'pending').length}
            </div>
            <div className="text-[11px] font-bold text-[#3457D5]">Chờ duyệt (PENDING)</div>
          </div>
          <div className="p-2.5 rounded-lg bg-[#F2D64B]/25 border border-[#20243A]/20">
            <div className="text-base font-black text-[#20243A]">
              {myStories.filter((s) => s.status === 'revision_required').length}
            </div>
            <div className="text-[11px] font-bold text-[#20243A]">Yêu cầu chỉnh sửa</div>
          </div>
          <div className="p-2.5 rounded-lg bg-[#269C91]/12 border border-[#269C91]/25">
            <div className="text-base font-black text-[#269C91]">
              {myStories.filter((s) => s.status === 'approved').length}
            </div>
            <div className="text-[11px] font-bold text-[#269C91]">Đã công bố (PUBLISHED)</div>
          </div>
        </div>

        {myStories.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {myStories.map((st) => {
              const linkedArt = artworks.find((a) => a.id === st.artworkId);
              return (
                <div
                  key={st.id}
                  className="p-3.5 rounded-lg bg-[#F7F3EA]/70 border border-[#20243A]/15 flex flex-col justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase text-[#3457D5] truncate">
                        {st.artworkTitle}
                      </span>
                      <span className="px-2 py-0.5 rounded-sm bg-[#20243A] text-[#F7F3EA] text-[10px] font-bold uppercase">
                        {st.status === 'approved' ? 'PUBLISHED' : st.status}
                      </span>
                    </div>
                    <div className="font-editorial text-sm font-bold text-[#20243A] mt-1">
                      “{st.storyTitle}”
                    </div>
                    <p className="text-xs text-[#20243A]/75 line-clamp-2 mt-1">
                      {st.storyContent}
                    </p>
                  </div>
                  {onOpenWriteStoryModal && (
                    <button
                      type="button"
                      onClick={() => onOpenWriteStoryModal(linkedArt || null, st)}
                      className="self-start text-[11px] font-bold text-[#3457D5] hover:underline cursor-pointer"
                    >
                      Chỉnh sửa câu chuyện →
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* MỤC 5: TÀI NGUYÊN ĐÃ TẢI LÊN (NẾU LÀ GIÁO VIÊN / ADMIN) */}
      {(isTeacher || isAdmin || currentRole === 'teacher' || currentRole === 'admin') && (
        <section className="bg-white rounded-xl border border-[#20243A]/15 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#20243A]/10 pb-3">
            <div className="flex items-center gap-2.5">
              <Presentation className="w-4 h-4 text-[#3457D5]" />
              <h3 className="font-display text-base font-bold text-[#20243A] uppercase">
                5. TÀI NGUYÊN MĨ THUẬT GDPT ĐÃ TẢI LÊN ({uploadedGdptResources.length})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('class-lessons')}
              className="text-xs font-bold text-[#3457D5] hover:underline cursor-pointer"
            >
              Quản lý Mĩ thuật GDPT →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {uploadedGdptResources.slice(0, 6).map((les) => (
              <div
                key={les.id}
                onClick={() => onNavigateTab('class-lessons')}
                className="p-3.5 rounded-lg bg-[#F7F3EA]/70 border border-[#20243A]/15 cursor-pointer hover:border-[#3457D5] transition-colors space-y-1"
              >
                <span className="text-[10px] font-mono-code font-bold uppercase text-[#269C91]">
                  {les.grade || 'Mĩ thuật GDPT'} ·{' '}
                  {les.videoUrl ? 'VIDEO BÀI GIẢNG' : 'SLIDE BÀI GIẢNG'}
                </span>
                <p className="text-xs font-bold text-[#20243A] line-clamp-1">{les.title}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* MỤC 6: CÀI ĐẶT TÀI KHOẢN & CHẾ ĐỘ VAI TRÒ */}
      <section className="bg-white rounded-xl border border-[#20243A]/15 p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2.5 border-b border-[#20243A]/10 pb-3">
          <Settings className="w-4 h-4 text-[#20243A]" />
          <h3 className="font-display text-base font-bold text-[#20243A] uppercase">
            6. CÀI ĐẶT TÀI KHOẢN, PHÂN QUYỀN &amp; ỨNG DỤNG PWA
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {roles.map((r) => {
            const isActive = currentRole === r.key;
            const isLocked =
              r.requiresAuth &&
              ((r.requiredVerifiedRole === 'student' && !isStudent) ||
                (r.requiredVerifiedRole === 'teacher' && !isTeacher) ||
                (r.requiredVerifiedRole === 'admin' && !isAdmin));

            return (
              <button
                key={r.key}
                type="button"
                onClick={() => handleRoleSwitch(r)}
                className={`p-3.5 rounded-lg border text-left flex items-center justify-between gap-3 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#3457D5]/10 border-[#3457D5] text-[#20243A]'
                    : isLocked
                      ? 'bg-[#F7F3EA]/50 border-[#20243A]/10 text-[#20243A]/45'
                      : 'bg-white border-[#20243A]/15 text-[#20243A] hover:bg-[#F7F3EA]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span>{isLocked ? <Lock className="w-4 h-4" /> : r.icon}</span>
                  <div>
                    <div className="text-xs font-bold">{r.label}</div>
                    <div className="text-[11px] opacity-75">{r.desc}</div>
                  </div>
                </div>
                {isActive && <CheckCircle2 className="w-4 h-4 text-[#3457D5] shrink-0" />}
              </button>
            );
          })}
        </div>

        <div className="pt-3 border-t border-[#20243A]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-[#20243A]">
              ART VERSE AI v{APP_VERSION} · Build {APP_BUILD_ID}
            </div>
            <div className="text-[11px] text-[#20243A]/60">
              {isStandalonePWA
                ? 'Đang chạy ở chế độ Ứng dụng toàn màn hình (PWA)'
                : 'Tối ưu cho máy tính, máy tính bảng và điện thoại'}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenArtbookExportModal}
              className="px-3.5 py-2 rounded-lg bg-[#F7F3EA] hover:bg-[#20243A]/10 border border-[#20243A]/15 text-xs font-bold text-[#20243A] cursor-pointer"
            >
              Xuất Kỷ yếu &amp; Poster Lớp
            </button>
            <button
              type="button"
              onClick={() => forceRefreshAppVersion()}
              className="px-3.5 py-2 rounded-lg bg-[#20243A] hover:bg-[#3457D5] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Làm mới bộ nhớ đệm</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
