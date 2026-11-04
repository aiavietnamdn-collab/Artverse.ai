/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ART VERSE AI — Phân hệ 6: ĐĂNG TẢI (UploadHubView)
 * Quy chuẩn 2.0 (Section III.6):
 * Khu vực đăng tải nội dung theo quyền hạn tài khoản:
 * 1. Tác phẩm (TRIỂN LÃM TÁC PHẨM)
 * 2. Video ngắn thuộc ARTVERSE SHORTS
 * 3. Câu chuyện sau nét vẽ
 * 4. Slide bài giảng và video bài giảng thuộc MĨ THUẬT GDPT
 * Khi người dùng chọn loại nội dung, hệ thống chuyển đến đúng quy trình đăng tải tương ứng.
 * Không tự động đăng tải công khai nếu nội dung cần kiểm duyệt.
 */

import React from 'react';
import { UserRole } from '../../types/communityArt';
import { useAuth } from '../../context/AuthContext';
import {
  Image as ImageIcon,
  Film,
  BookOpen,
  Layers,
  ArrowRight,
  ShieldCheck,
  Lock,
  KeyRound,
  LogIn,
} from 'lucide-react';

interface UploadHubViewProps {
  currentRole: UserRole;
  onSelectUploadArtwork: () => void;
  onSelectUploadShort: () => void;
  onSelectUploadStory: () => void;
  onSelectUploadGdpt: (schoolLevel: 'primary' | 'secondary', resourceType: 'slides' | 'videos') => void;
}

export const UploadHubView: React.FC<UploadHubViewProps> = ({
  currentRole,
  onSelectUploadArtwork,
  onSelectUploadShort,
  onSelectUploadStory,
  onSelectUploadGdpt,
}) => {
  const {
    user,
    profile,
    isTeacher,
    isAdmin,
    isStudent,
    verifiedRole,
    setIsStudentLoginModalOpen,
    loginWithGoogle,
  } = useAuth();

  const isStaff =
    isTeacher ||
    isAdmin ||
    currentRole === 'teacher' ||
    currentRole === 'moderator' ||
    currentRole === 'admin';
  const isLoggedIn = Boolean(profile?.uid || user?.uid || verifiedRole !== 'viewer');

  return (
    <div className="space-y-8 pb-12 text-[#20243A] museum-fade-in">
      {/* Header */}
      <section className="rounded-xl bg-white border border-[#20243A]/15 p-6 sm:p-8 space-y-3">
        <div className="flex items-center gap-2 text-[11px] font-mono-code font-bold uppercase tracking-widest text-[#3457D5]">
          <span className="w-2.5 h-2.5 bg-[#3457D5] inline-block" />
          <span>ART VERSE AI · TRUNG TÂM ĐĂNG TẢI</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight uppercase text-[#20243A]">
          ĐĂNG TẢI
        </h1>
        <p className="text-xs sm:text-sm text-[#20243A]/75 max-w-2xl leading-relaxed">
          Chọn đúng loại nội dung bạn muốn đóng góp vào hệ sinh thái ART VERSE AI. Hệ thống sẽ điều hướng trực tiếp đến quy trình đăng tải tương ứng theo quyền hạn tài khoản.
        </p>

        {!isLoggedIn && (
          <div className="pt-3 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsStudentLoginModalOpen(true)}
              className="px-4 py-2 rounded-lg bg-[#3457D5] hover:bg-[#20243A] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Đăng nhập Học sinh (Mã PIN)</span>
            </button>
            <button
              type="button"
              onClick={() => loginWithGoogle()}
              className="px-4 py-2 rounded-lg bg-white hover:bg-[#20243A]/5 text-[#20243A] border border-[#20243A]/20 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Đăng nhập Giáo viên / Quản trị viên</span>
            </button>
          </div>
        )}
      </section>

      {/* 4 Official Upload Pathways */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Tác phẩm -> TRIỂN LÃM TÁC PHẨM */}
        <article className="bg-white rounded-xl border border-[#20243A]/15 hover:border-[#20243A]/45 p-6 flex flex-col justify-between space-y-5 transition-colors">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-[#3457D5] text-white flex items-center justify-center">
                <ImageIcon className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-mono-code font-bold uppercase tracking-wider text-[#3457D5]">
                01 / TRIỂN LÃM TÁC PHẨM
              </span>
            </div>
            <h2 className="font-display text-xl font-bold text-[#20243A]">
              Tác phẩm
            </h2>
            <p className="text-xs text-[#20243A]/75 leading-relaxed">
              Đăng tải tác phẩm mỹ thuật (tranh vẽ, đồ họa, ký họa, đa chất liệu) của học sinh và giáo viên vào không gian TRIỂN LÃM TÁC PHẨM. Tự động khử dữ liệu định vị EXIF GPS để bảo vệ quyền riêng tư.
            </p>
            <div className="text-[11px] text-[#20243A]/60 pt-1">
              Quyền đăng tải: Học sinh (chờ giáo viên kiểm duyệt) · Giáo viên &amp; Quản trị viên (công bố trực tiếp).
            </div>
          </div>

          <button
            type="button"
            onClick={onSelectUploadArtwork}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-lg bg-[#20243A] hover:bg-[#3457D5] text-[#F7F3EA] text-xs font-bold uppercase tracking-wide inline-flex items-center justify-between cursor-pointer transition-colors"
          >
            <span>Mở quy trình Đăng tải Tác phẩm</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </article>

        {/* 2. Video ngắn thuộc ARTVERSE SHORTS */}
        <article className="bg-white rounded-xl border border-[#20243A]/15 hover:border-[#20243A]/45 p-6 flex flex-col justify-between space-y-5 transition-colors">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-[#F15B3D] text-white flex items-center justify-center">
                <Film className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-mono-code font-bold uppercase tracking-wider text-[#F15B3D]">
                02 / ARTVERSE SHORTS
              </span>
            </div>
            <h2 className="font-display text-xl font-bold text-[#20243A]">
              Video ngắn thuộc ARTVERSE SHORTS
            </h2>
            <p className="text-xs text-[#20243A]/75 leading-relaxed">
              Tải video ngắn (.mp4, .mov, .webm · tối đa 100MB, &le;180 giây) lên phân hệ độc lập ARTVERSE SHORTS. Không trộn lẫn với tác phẩm hội họa hay video bài giảng.
            </p>
            <div className="text-[11px] text-[#20243A]/60 pt-1">
              Quyền đăng tải: Học sinh (qua kiểm duyệt) · Giáo viên &amp; Quản trị viên.
            </div>
          </div>

          <button
            type="button"
            onClick={onSelectUploadShort}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-lg bg-[#F15B3D] hover:bg-[#20243A] text-white text-xs font-bold uppercase tracking-wide inline-flex items-center justify-between cursor-pointer transition-colors"
          >
            <span>Mở quy trình Tải video ARTVERSE SHORTS</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </article>

        {/* 3. Câu chuyện sau nét vẽ */}
        <article className="bg-white rounded-xl border border-[#20243A]/15 hover:border-[#20243A]/45 p-6 flex flex-col justify-between space-y-5 transition-colors">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-[#269C91] text-white flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-mono-code font-bold uppercase tracking-wider text-[#269C91]">
                03 / CÂU CHUYỆN SAU NÉT VẼ
              </span>
            </div>
            <h2 className="font-display text-xl font-bold text-[#20243A]">
              Câu chuyện sau nét vẽ
            </h2>
            <p className="text-xs text-[#20243A]/75 leading-relaxed">
              Chia sẻ câu chuyện, cảm xúc và góc nhìn đằng sau tác phẩm. Hỗ trợ Lưu bản nháp (DRAFT), Gửi duyệt (PENDING) và Trợ lý AI gợi mở câu hỏi khi học sinh yêu cầu.
            </p>
            <div className="text-[11px] text-[#20243A]/60 pt-1">
              Quyền đăng tải: Học sinh là tác giả câu chuyện (Giáo viên duyệt trước khi công bố PUBLISHED).
            </div>
          </div>

          <button
            type="button"
            onClick={onSelectUploadStory}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-lg bg-[#269C91] hover:bg-[#20243A] text-white text-xs font-bold uppercase tracking-wide inline-flex items-center justify-between cursor-pointer transition-colors"
          >
            <span>Viết Câu chuyện sau nét vẽ</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </article>

        {/* 4. Slide bài giảng và video bài giảng thuộc MĨ THUẬT GDPT */}
        <article className="bg-white rounded-xl border border-[#20243A]/15 hover:border-[#20243A]/45 p-6 flex flex-col justify-between space-y-5 transition-colors">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-[#6945B5] text-white flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-mono-code font-bold uppercase tracking-wider text-[#6945B5]">
                04 / MĨ THUẬT GDPT
              </span>
            </div>
            <h2 className="font-display text-xl font-bold text-[#20243A]">
              Slide bài giảng &amp; Video bài giảng thuộc MĨ THUẬT GDPT
            </h2>
            <p className="text-xs text-[#20243A]/75 leading-relaxed">
              Đăng tải tài nguyên giảng dạy mỹ thuật theo hai cấp học duy nhất: <strong>TIỂU HỌC</strong> và <strong>THCS</strong>, gồm hai danh mục: <strong>SLIDE BÀI GIẢNG</strong> và <strong>VIDEO BÀI GIẢNG</strong>.
            </p>
            <div className="text-[11px] text-[#20243A]/60 pt-1">
              Quyền đăng tải: Dành cho Giáo viên Mĩ thuật và Quản trị viên.
            </div>
          </div>

          {isStaff ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onSelectUploadGdpt('primary', 'slides')}
                className="min-h-[40px] px-3 py-2 rounded-lg bg-[#20243A] hover:bg-[#3457D5] text-[#F7F3EA] text-xs font-bold inline-flex items-center justify-between cursor-pointer transition-colors"
              >
                <span>Tiểu học (Slide/Video)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onSelectUploadGdpt('secondary', 'slides')}
                className="min-h-[40px] px-3 py-2 rounded-lg bg-[#6945B5] hover:bg-[#20243A] text-white text-xs font-bold inline-flex items-center justify-between cursor-pointer transition-colors"
              >
                <span>THCS (Slide/Video)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-[#F7F3EA] border border-[#20243A]/15 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-[#20243A]/75">
                <Lock className="w-4 h-4 text-[#6945B5] shrink-0" />
                <span>Chỉ Giáo viên và Quản trị viên mới được đăng tải học liệu MĨ THUẬT GDPT.</span>
              </div>
              <button
                type="button"
                onClick={() => onSelectUploadGdpt('secondary', 'slides')}
                className="px-3 py-1.5 rounded bg-white border border-[#20243A]/20 text-xs font-bold text-[#20243A] shrink-0 cursor-pointer"
              >
                Xem kho học liệu
              </button>
            </div>
          )}
        </article>
      </section>

      {/* Moderation & Safety Policy Footer */}
      <section className="rounded-xl bg-white border border-[#20243A]/15 p-5 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-[#269C91] shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs text-[#20243A]/75">
          <p className="font-bold text-[#20243A]">
            Nguyên tắc Kiểm duyệt &amp; Bảo vệ Học sinh trên ART VERSE AI
          </p>
          <p>
            Mọi nội dung do học sinh đăng tải (Tác phẩm, Video ngắn ARTVERSE SHORTS, Câu chuyện sau nét vẽ) đều đi qua quy trình kiểm duyệt trước khi hiển thị công khai và chỉ sử dụng Bí danh hiển thị, tuyệt đối không công khai họ tên thật hay thông tin cá nhân.
          </p>
        </div>
      </section>
    </div>
  );
};
