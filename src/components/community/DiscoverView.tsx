/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ART VERSE AI — 1. TRANG CHỦ (MASTER NAMING & INFORMATION ARCHITECTURE 2.0)
 * Ngôn ngữ thiết kế: CONTEMPORARY CREATIVE GALLERY
 *
 * Hiển thị nội dung xem trước (Preview) và điều hướng chính xác đến từng phân hệ:
 * 1. Tác phẩm mới (-> TRIỂN LÃM TÁC PHẨM)
 * 2. Tác phẩm nổi bật (-> TRIỂN LÃM TÁC PHẨM)
 * 3. Video nổi bật từ ARTVERSE SHORTS (-> ARTVERSE SHORTS)
 * 4. Câu chuyện sau nét vẽ (-> CÂU CHUYỆN SAU NÉT VẼ)
 * 5. Truy cập nhanh Mĩ thuật GDPT (A. TIỂU HỌC & B. THCS -> MĨ THUẬT GDPT)
 */

import React, { useState, useMemo } from 'react';
import { ScreenTab } from '../../types/artverse';
import {
  ClassGroup,
  ArtLesson,
  ArtworkStory,
  CommunityArtwork,
  PositiveReactionKey,
  UserRole,
} from '../../types/communityArt';
import {
  getArtworkNormalizedGrade,
  doesArtworkMatchGradeFilter,
  normalizeGrade,
} from '../../utils/gradeUtils';
import { useAuth } from '../../context/AuthContext';
import { ArtCanvasVisual } from '../common/ArtCanvasVisual';
import {
  ArrowRight,
  ArrowUpRight,
  Plus,
  Heart,
  Play,
  Presentation,
  HardDrive,
  SlidersHorizontal,
  Film,
  GraduationCap,
  FileText,
} from 'lucide-react';

interface DiscoverViewProps {
  artworks: CommunityArtwork[];
  stories?: ArtworkStory[];
  classes: ClassGroup[];
  lessons: ArtLesson[];
  currentRole: UserRole;
  currentAuthorKey: string;
  onSelectArtwork: (artwork: CommunityArtwork) => void;
  onOpenUploadModal: () => void;
  onOpenProjectorModal: (startIndex: number) => void;
  onNavigateTab: (tab: ScreenTab) => void;
  onSelectClassInGallery: (classId: string) => void;
  onReaction: (artworkId: string, reactionKey: PositiveReactionKey) => void;
}

const MIXED_MEDIA_COLLAGE_TEXTURE =
  '/assets/aistudio/BGrAWYqcv-2nrZjh22JV_FKa7bZC_BO57WlR6Jk4T2rZohPPxvOHZSWccTkkVXke68XCYpz5jalHBm3P6BY-e5aNQ9U_7SRWgtBjykMUy7s1a0CkiKpfQCP8NEvnSyzAHHOc4GzIbvcpoGKwAPJb7JMjkcQUqp3zfp-FkdVZm2OKOtRxu3WEe0bbnOG9Er8w_7dadbbf2.jpg';

const GRADE_FILTERS: Array<{ id: string; label: string }> = [
  { id: 'all', label: 'Tất cả' },
  { id: 'cls-1', label: 'Lớp 1' },
  { id: 'cls-2', label: 'Lớp 2' },
  { id: 'cls-3', label: 'Lớp 3' },
  { id: 'cls-4', label: 'Lớp 4' },
  { id: 'cls-5', label: 'Lớp 5' },
  { id: 'cls-6', label: 'Lớp 6' },
  { id: 'cls-7', label: 'Lớp 7' },
  { id: 'cls-8', label: 'Lớp 8' },
  { id: 'cls-9', label: 'Lớp 9' },
];

function isValidArtworkMediaUrl(url?: string): boolean {
  if (!url) return false;
  return (
    url.startsWith('data:image') ||
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('/api/media/files/') ||
    url.startsWith('/assets/')
  );
}

function formatYearOrDate(dateStr?: string): string {
  if (!dateStr) return '2026';
  const parsed = Date.parse(dateStr);
  if (!Number.isNaN(parsed)) {
    return String(new Date(parsed).getFullYear());
  }
  return dateStr;
}

export const DiscoverView: React.FC<DiscoverViewProps> = ({
  artworks,
  stories = [],
  lessons = [],
  currentRole,
  onSelectArtwork,
  onOpenProjectorModal,
  onNavigateTab,
  onSelectClassInGallery,
  onReaction,
}) => {
  const { profile, isStudent } = useAuth();
  const [activeGradeFilter, setActiveGradeFilter] = useState<string>('all');

  const isStaff =
    currentRole === 'admin' || currentRole === 'teacher' || currentRole === 'moderator';

  // Approved & shared items from Firebase
  const approvedAll = useMemo(
    () => artworks.filter((item) => item.status === 'approved' && item.shareStatus === 'shared'),
    [artworks]
  );

  // Visual Artworks Only (for TRIỂN LÃM TÁC PHẨM preview)
  const approvedVisualArtworks = useMemo(
    () =>
      approvedAll.filter(
        (item) =>
          item.mediaType !== 'video' &&
          !item.videoUrl &&
          !(item.mimeType && item.mimeType.startsWith('video/'))
      ),
    [approvedAll]
  );

  // Short Videos Only (for ARTVERSE SHORTS preview)
  const approvedShorts = useMemo(
    () =>
      approvedAll.filter(
        (item) =>
          item.mediaType === 'video' ||
          Boolean(item.videoUrl) ||
          Boolean(item.mimeType && item.mimeType.startsWith('video/'))
      ),
    [approvedAll]
  );

  // Filtered visual artworks for "Tác phẩm mới"
  const filteredVisualArtworks = useMemo(() => {
    if (activeGradeFilter === 'all') return approvedVisualArtworks;
    return approvedVisualArtworks.filter((art) =>
      doesArtworkMatchGradeFilter(art, activeGradeFilter)
    );
  }, [approvedVisualArtworks, activeGradeFilter]);

  // Featured Artworks sorted by emotion engagement
  const featuredArtworks = useMemo(() => {
    return [...approvedVisualArtworks]
      .sort((a, b) => {
        const scoreA =
          (Object.values(a.emotionCounts || {}) as number[]).reduce((s, v) => s + v, 0) +
          (Object.values(a.reactions || {}) as number[]).reduce((s, v) => s + v, 0);
        const scoreB =
          (Object.values(b.emotionCounts || {}) as number[]).reduce((s, v) => s + v, 0) +
          (Object.values(b.reactions || {}) as number[]).reduce((s, v) => s + v, 0);
        return scoreB - scoreA;
      })
      .slice(0, 3);
  }, [approvedVisualArtworks]);

  // Hero Collage Featured Student Artworks
  const heroPrimaryArtwork = approvedVisualArtworks[0] || null;
  const heroSecondaryArtwork = approvedVisualArtworks[1] || approvedVisualArtworks[0] || null;
  const featuredExhibitionArtwork = featuredArtworks[0] || approvedVisualArtworks[0] || null;

  // Curatorial Stories preview (CÂU CHUYỆN SAU NÉT VẼ)
  const curatorialStories = useMemo(() => {
    const approved = stories.filter((s) => s.status === 'approved');
    if (approved.length > 0) return approved.slice(0, 3);
    return approvedVisualArtworks
      .filter((a) => Boolean(a.description && a.description.trim().length > 15))
      .slice(0, 3)
      .map((a) => ({
        id: `story-fallback-${a.id}`,
        artworkId: a.id,
        artworkTitle: a.title,
        artworkImageUrl: a.thumbnailUrl || a.imageUrl || a.downloadURL,
        artworkVisualType: a.visualType,
        authorNickname: a.authorNickname || a.authorAlias || a.creatorAnonymousPseudonym,
        gradeLabel: getArtworkNormalizedGrade(a),
        storyTitle: a.title,
        storyContent: a.description,
      }));
  }, [stories, approvedVisualArtworks]);

  // MĨ THUẬT GDPT counts (TIỂU HỌC vs THCS)
  const gdptCounts = useMemo(() => {
    const activeLessons = lessons.filter((l) => l.status !== 'deleted' && !l.isHidden);
    const tieuHoc = activeLessons.filter((l) => {
      if (l.educationLevel === 'TIEU_HOC') return true;
      const g = normalizeGrade(l.className || l.classGroupId);
      return ['Lớp 1', 'Lớp 2', 'Lớp 3', 'Lớp 4', 'Lớp 5'].includes(g);
    });
    const thcs = activeLessons.filter((l) => {
      if (l.educationLevel === 'THCS') return true;
      const g = normalizeGrade(l.className || l.classGroupId);
      return ['Lớp 6', 'Lớp 7', 'Lớp 8', 'Lớp 9'].includes(g);
    });
    return {
      tieuHocCount: tieuHoc.length,
      thcsCount: thcs.length,
    };
  }, [lessons]);

  return (
    <div className="space-y-10 sm:space-y-14 pb-10 text-[#20243A] museum-fade-in">
      {/* Staff Operational Bar */}
      {isStaff && (
        <section className="rounded-lg bg-[#20243A] text-[#F7F3EA] px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-[#20243A]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-[#3457D5] text-white flex items-center justify-center shrink-0">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold tracking-tight">
                ART VERSE AI · Bàn Điều hành Quản lý &amp; Quản trị Hệ thống
              </p>
              <p className="text-[11px] text-[#F7F3EA]/70 tabular-nums">
                {approvedVisualArtworks.length} tác phẩm triển lãm · {approvedShorts.length} video ARTVERSE SHORTS · {lessons.filter((l) => l.status !== 'deleted').length} học liệu Mĩ thuật GDPT
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNavigateTab('management-tools')}
              className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-[#F7F3EA] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
            >
              Công cụ Quản lý
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('system-admin')}
              className="px-3 py-1.5 rounded-md bg-[#F2D64B] hover:bg-[#E5C83B] text-[#20243A] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
            >
              Quản trị Hệ thống
            </button>
            <button
              type="button"
              onClick={() => onOpenProjectorModal(0)}
              className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-[#F7F3EA] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Presentation className="w-3.5 h-3.5" />
              <span>Trình chiếu</span>
            </button>
          </div>
        </section>
      )}

      {/* Signed-in Student Studio Ribbon */}
      {isStudent && profile && (
        <section className="rounded-lg bg-white border border-[#20243A]/15 px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] text-[#20243A]/60 font-medium">
              <span className="text-[#3457D5] font-bold uppercase tracking-wider">
                ART VERSE AI · Hồ sơ Nghệ sĩ
              </span>
              <span>·</span>
              <span>{normalizeGrade(profile.className || profile.classGroupId)}</span>
            </div>
            <p className="text-sm font-bold text-[#20243A] truncate">
              {profile.nickname || profile.displayName}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('upload-hub')}
            className="px-3.5 py-2 rounded-lg bg-[#20243A] hover:bg-[#3457D5] text-[#F7F3EA] text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>ĐĂNG TẢI</span>
          </button>
        </section>
      )}

      {/* =====================================================================
          01 · HERO SECTION — ART VERSE AI (CONTEMPORARY CREATIVE GALLERY)
         ===================================================================== */}
      <section className="relative bg-white border border-[#20243A]/15 rounded-xl overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          {/* Left Column: Swiss Editorial Typography & Primary Actions */}
          <div className="lg:col-span-6 p-5 sm:p-8 lg:p-10 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[#20243A]/12 bg-[#F7F3EA]/50">
            <div className="space-y-4 sm:space-y-5">
              {/* Brand Index Line */}
              <div className="flex items-center gap-2.5 text-[11px] font-bold tracking-widest uppercase text-[#20243A]/75">
                <span className="w-2.5 h-2.5 bg-[#3457D5] inline-block shrink-0" />
                <span>ART VERSE AI · CONTEMPORARY CREATIVE GALLERY</span>
              </div>

              {/* Main Headline */}
              <div className="space-y-3">
                <h1
                  className="font-display font-black text-[#20243A] tracking-tight uppercase leading-[0.98]"
                  style={{ fontSize: 'clamp(2.15rem, 4.8vw, 3.85rem)', textWrap: 'balance' }}
                >
                  THẾ GIỚI MĨ THUẬT
                </h1>

                <div className="flex items-center gap-1.5 pt-0.5">
                  <span className="h-1 w-14 bg-[#3457D5]" />
                  <span className="h-1 w-5 bg-[#F15B3D]" />
                </div>
              </div>

              {/* Tagline */}
              <p className="text-base sm:text-lg font-medium text-[#20243A]/85 leading-relaxed max-w-md">
                Nơi những ý tưởng trở thành tác phẩm trên <strong>ART VERSE AI</strong>.
              </p>
            </div>

            {/* Two Primary Buttons */}
            <div className="pt-6 sm:pt-8 space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={() => onSelectClassInGallery('all')}
                  className="min-h-[46px] px-5 py-2.5 rounded-lg bg-[#3457D5] hover:bg-[#20243A] text-white text-xs sm:text-sm font-bold tracking-wide uppercase inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span>TRIỂN LÃM TÁC PHẨM</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => onNavigateTab('upload-hub')}
                  className="min-h-[46px] px-5 py-2.5 rounded-lg bg-transparent hover:bg-[#20243A] text-[#20243A] hover:text-[#F7F3EA] border border-[#20243A] text-xs sm:text-sm font-bold tracking-wide uppercase inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>ĐĂNG TẢI</span>
                </button>
              </div>

              {/* Archival Metadata Bar */}
              <div className="pt-3 border-t border-[#20243A]/10 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#20243A]/60">
                <span>TRIỂN LÃM TÁC PHẨM</span>
                <span>·</span>
                <span>ARTVERSE SHORTS</span>
                <span>·</span>
                <span>CÂU CHUYỆN SAU NÉT VẼ</span>
                <span>·</span>
                <span>MĨ THUẬT GDPT</span>
              </div>
            </div>
          </div>

          {/* Right Column: Asymmetric Contemporary Art & Student Work Collage */}
          <div className="lg:col-span-6 gallery-swiss-grid p-4 sm:p-6 lg:p-7 flex items-center justify-center relative overflow-hidden min-h-[290px] sm:min-h-[360px]">
            <div
              aria-hidden="true"
              className="absolute top-0 right-0 w-36 sm:w-48 h-36 sm:h-48 bg-[#3457D5]"
            />
            <div
              aria-hidden="true"
              className="absolute bottom-4 left-4 w-24 sm:w-32 h-20 sm:h-24 bg-[#F2D64B] border border-[#20243A]"
            />

            <div className="relative z-10 w-full max-w-[480px] grid grid-cols-12 gap-3 items-end">
              {/* Frame 01 (7 cols) */}
              <div
                onClick={() => heroPrimaryArtwork && onSelectArtwork(heroPrimaryArtwork)}
                className="col-span-7 bg-white border border-[#20243A] p-2 sm:p-2.5 shadow-[6px_6px_0_#20243A] cursor-pointer group transition-transform hover:-translate-y-0.5"
              >
                <div className="aspect-[4/5] bg-[#20243A] overflow-hidden relative">
                  {heroPrimaryArtwork &&
                  isValidArtworkMediaUrl(
                    heroPrimaryArtwork.thumbnailUrl ||
                      heroPrimaryArtwork.imageUrl ||
                      heroPrimaryArtwork.downloadURL
                  ) ? (
                    <img
                      src={
                        heroPrimaryArtwork.thumbnailUrl ||
                        heroPrimaryArtwork.imageUrl ||
                        heroPrimaryArtwork.downloadURL
                      }
                      alt={heroPrimaryArtwork.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover museum-img-zoom"
                    />
                  ) : (
                    <img
                      src={MIXED_MEDIA_COLLAGE_TEXTURE}
                      alt="Tác phẩm nghệ thuật đương đại"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover museum-img-zoom"
                    />
                  )}
                </div>
                <div className="pt-2 flex items-baseline justify-between gap-2 text-[11px]">
                  <div className="min-w-0">
                    <p className="font-bold text-[#20243A] truncate">
                      {heroPrimaryArtwork ? heroPrimaryArtwork.title : 'Bố cục Đa chất liệu'}
                    </p>
                    <p className="text-[10px] text-[#20243A]/60 truncate">
                      {heroPrimaryArtwork
                        ? `${heroPrimaryArtwork.authorNickname || heroPrimaryArtwork.authorAlias || heroPrimaryArtwork.creatorAnonymousPseudonym} · ${getArtworkNormalizedGrade(heroPrimaryArtwork)}`
                        : 'ART VERSE AI'}
                    </p>
                  </div>
                  <span className="font-mono-code text-[10px] font-bold text-[#3457D5] shrink-0">
                    01
                  </span>
                </div>
              </div>

              {/* Right Stack (5 cols) */}
              <div className="col-span-5 space-y-3">
                <div className="bg-white border border-[#20243A] p-1.5">
                  <div className="aspect-square overflow-hidden bg-[#F15B3D] relative">
                    <img
                      src={MIXED_MEDIA_COLLAGE_TEXTURE}
                      alt="Mixed media collage texture"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="pt-1 flex items-center justify-between text-[9px] font-mono-code uppercase tracking-wider text-[#20243A]/70">
                    <span>ART VERSE AI</span>
                    <span className="w-2 h-2 bg-[#F15B3D] inline-block" />
                  </div>
                </div>

                {heroSecondaryArtwork && (
                  <div
                    onClick={() => onSelectArtwork(heroSecondaryArtwork)}
                    className="bg-white border border-[#20243A] p-2 cursor-pointer group transition-transform hover:-translate-y-0.5"
                  >
                    <div className="aspect-[4/3] bg-[#20243A] overflow-hidden relative">
                      {isValidArtworkMediaUrl(
                        heroSecondaryArtwork.thumbnailUrl ||
                          heroSecondaryArtwork.imageUrl ||
                          heroSecondaryArtwork.downloadURL
                      ) ? (
                        <img
                          src={
                            heroSecondaryArtwork.thumbnailUrl ||
                            heroSecondaryArtwork.imageUrl ||
                            heroSecondaryArtwork.downloadURL
                          }
                          alt={heroSecondaryArtwork.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover museum-img-zoom"
                        />
                      ) : (
                        <ArtCanvasVisual
                          type={heroSecondaryArtwork.visualType || 'watercolor'}
                          title={heroSecondaryArtwork.title}
                          badgeText={getArtworkNormalizedGrade(heroSecondaryArtwork)}
                          className="w-full h-full"
                        />
                      )}
                    </div>
                    <div className="pt-1.5 flex items-baseline justify-between gap-1 text-[10px]">
                      <span className="font-bold text-[#20243A] truncate">
                        {heroSecondaryArtwork.title}
                      </span>
                      <span className="font-mono-code text-[9px] font-bold text-[#F15B3D] shrink-0">
                        02
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          02 · TÁC PHẨM MỚI & TÁC PHẨM NỔI BẬT (XEM TRƯỚC -> TRIỂN LÃM TÁC PHẨM)
         ===================================================================== */}
      <section id="gallery-works-section" className="space-y-5">
        <div className="space-y-4 border-b border-[#20243A]/12 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#3457D5]">
                PHÂN HỆ 02 · TRIỂN LÃM TÁC PHẨM
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#20243A] tracking-tight mt-0.5">
                Tác phẩm mới &amp; Tác phẩm nổi bật
              </h2>
              <p className="text-xs sm:text-sm text-[#20243A]/65 mt-0.5 tabular-nums">
                {filteredVisualArtworks.length} tác phẩm mỹ thuật đang trưng bày (Chỉ trưng bày tranh &amp; tác phẩm tạo hình)
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  onSelectClassInGallery(activeGradeFilter === 'all' ? 'all' : activeGradeFilter)
                }
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#3457D5] hover:text-[#20243A] transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>Chuyển đến TRIỂN LÃM TÁC PHẨM</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#20243A]/55 pr-2 shrink-0">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Khối lớp:</span>
            </span>
            {GRADE_FILTERS.map((gf) => {
              const isSelected = activeGradeFilter === gf.id;
              return (
                <button
                  key={gf.id}
                  type="button"
                  onClick={() => setActiveGradeFilter(gf.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-[#20243A] text-[#F7F3EA] font-bold'
                      : 'bg-white hover:bg-[#20243A]/6 text-[#20243A]/75 border border-[#20243A]/12'
                  }`}
                >
                  {gf.label}
                </button>
              );
            })}
          </div>
        </div>

        {filteredVisualArtworks.length === 0 ? (
          <div className="rounded-xl bg-white border border-[#20243A]/12 p-10 text-center space-y-3">
            <p className="text-base font-bold text-[#20243A]">
              Chưa có tác phẩm nào trong danh mục này.
            </p>
            <div className="pt-1">
              <button
                type="button"
                onClick={() => onNavigateTab('upload-hub')}
                className="px-4 py-2 rounded-lg bg-[#20243A] hover:bg-[#3457D5] text-[#F7F3EA] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>ĐĂNG TẢI TÁC PHẨM</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7 items-start">
            {filteredVisualArtworks.slice(0, 6).map((art, index) => {
              const gradeLabel = getArtworkNormalizedGrade(art);
              const displayThumb = art.thumbnailUrl || art.imageUrl || art.downloadURL || '';
              const hasValidThumb = isValidArtworkMediaUrl(displayThumb);
              const authorName =
                art.authorNickname || art.authorAlias || art.creatorAnonymousPseudonym;
              const yearOrDate = formatYearOrDate(art.createdAt);

              const totalEmotions =
                (Object.values(art.emotionCounts || {}) as number[]).reduce(
                  (acc, v) => acc + v,
                  0
                ) +
                (Object.values(art.reactions || {}) as number[]).reduce(
                  (acc, v) => acc + v,
                  0
                );

              const aspectClass =
                index % 3 === 0
                  ? 'aspect-[4/5]'
                  : index % 3 === 1
                    ? 'aspect-[4/3]'
                    : 'aspect-square';

              return (
                <article
                  key={art.id}
                  onClick={() => onSelectArtwork(art)}
                  className="group cursor-pointer bg-white border border-[#20243A]/12 hover:border-[#20243A]/40 rounded-lg overflow-hidden transition-colors flex flex-col"
                >
                  <div
                    className={`relative w-full ${aspectClass} bg-[#EFECE4] overflow-hidden flex items-center justify-center`}
                  >
                    {hasValidThumb ? (
                      <img
                        src={displayThumb}
                        alt={art.title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover museum-img-zoom"
                      />
                    ) : (
                      <ArtCanvasVisual
                        type={art.visualType || 'watercolor'}
                        title={art.title}
                        badgeText={gradeLabel}
                        className="w-full h-full"
                      />
                    )}
                  </div>

                  <div className="p-3.5 sm:p-4 flex items-start justify-between gap-3 bg-white">
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-xs font-bold text-[#20243A] truncate">{authorName}</p>
                      <h3 className="text-sm font-semibold text-[#20243A]/90 group-hover:text-[#3457D5] transition-colors truncate">
                        {art.title}, {yearOrDate}
                      </h3>
                      <div className="flex items-center gap-1.5 text-[11px] text-[#20243A]/55 pt-0.5">
                        <span>{gradeLabel}</span>
                        <span>·</span>
                        <span className="truncate">
                          {art.materialsUsed || art.lessonTitle || 'Mĩ thuật Đương đại'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onReaction(art.id, 'inspiring');
                      }}
                      aria-label={`Yêu thích tác phẩm ${art.title}`}
                      className="shrink-0 inline-flex items-center gap-1 pt-0.5 text-xs font-semibold text-[#3457D5] hover:text-[#F15B3D] transition-colors cursor-pointer tabular-nums"
                    >
                      <Heart className="w-4 h-4 fill-[#3457D5] hover:fill-[#F15B3D] transition-colors" />
                      {totalEmotions > 0 && <span>{totalEmotions}</span>}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* =====================================================================
          03 · VIDEO NỔI BẬT TỪ ARTVERSE SHORTS (XEM TRƯỚC -> ARTVERSE SHORTS)
         ===================================================================== */}
      <section className="rounded-xl bg-[#20243A] text-[#F7F3EA] p-6 sm:p-8 space-y-5 border border-[#20243A]">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-white/15 pb-4">
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#F2D64B]">
              <span className="w-2.5 h-2.5 bg-[#F15B3D] inline-block" />
              <span>PHÂN HỆ 03 · ARTVERSE SHORTS</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight mt-0.5">
              Video nổi bật từ ARTVERSE SHORTS
            </h2>
            <p className="text-xs sm:text-sm text-[#F7F3EA]/70 mt-0.5">
              Khám phá các thước phim ngắn ghi lại quá trình sáng tạo, ký họa và giới thiệu tác phẩm.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('artverse-shorts')}
            className="px-4 py-2.5 rounded-lg bg-[#F15B3D] hover:bg-[#d94a2d] text-white text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 cursor-pointer shrink-0 transition-colors"
          >
            <Film className="w-4 h-4" />
            <span>Mở ARTVERSE SHORTS</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>

        {approvedShorts.length === 0 ? (
          <div className="rounded-lg bg-white/5 border border-white/15 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-display text-base font-bold text-white">
                Không gian video ngắn ARTVERSE SHORTS đã sẵn sàng
              </h3>
              <p className="text-xs text-[#F7F3EA]/70">
                Đăng tải video quá trình sáng tạo (&le;100MB, &le;180s) để xuất hiện tại chuyên mục ARTVERSE SHORTS.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('artverse-shorts')}
              className="px-4 py-2.5 rounded-lg bg-[#F2D64B] text-[#20243A] text-xs font-bold uppercase tracking-wider cursor-pointer shrink-0"
            >
              Khám phá &amp; Đăng video →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {approvedShorts.slice(0, 3).map((vid) => {
              const thumb = vid.thumbnailUrl || vid.imageUrl || '';
              return (
                <article
                  key={vid.id}
                  onClick={() => onNavigateTab('artverse-shorts')}
                  className="group cursor-pointer rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 overflow-hidden transition-colors"
                >
                  <div className="aspect-[16/10] bg-black/60 relative flex items-center justify-center overflow-hidden">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={vid.title}
                        className="w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <Film className="w-8 h-8 text-[#F2D64B]" />
                    )}
                    <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                      <div className="w-11 h-11 rounded-full bg-[#F2D64B] text-[#20243A] flex items-center justify-center shadow-lg">
                        <Play className="w-4 h-4 fill-[#20243A] ml-0.5" />
                      </div>
                    </div>
                    <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-sm bg-[#F15B3D] text-white text-[10px] font-bold uppercase">
                      ARTVERSE SHORTS
                    </span>
                  </div>
                  <div className="p-3.5 space-y-1">
                    <h3 className="text-sm font-bold text-white truncate">{vid.title}</h3>
                    <p className="text-xs text-[#F7F3EA]/65 truncate">
                      {vid.authorNickname || vid.authorAlias || vid.creatorAnonymousPseudonym} ·{' '}
                      {getArtworkNormalizedGrade(vid)}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* =====================================================================
          04 · CÂU CHUYỆN SAU NÉT VẼ (XEM TRƯỚC -> CÂU CHUYỆN SAU NÉT VẼ)
         ===================================================================== */}
      <section className="space-y-4 pt-2">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#20243A]/12 pb-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#269C91]">
              PHÂN HỆ 04 · CÂU CHUYỆN SAU NÉT VẼ
            </p>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#20243A] tracking-tight mt-0.5">
              Câu chuyện sau nét vẽ
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigateTab('art-stories')}
              className="text-xs font-bold text-[#20243A]/75 hover:text-[#3457D5] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <span>Chuyển đến CÂU CHUYỆN SAU NÉT VẼ</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {curatorialStories.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {curatorialStories.map((st, idx) => (
              <article
                key={st.id}
                onClick={() => onNavigateTab('art-stories')}
                className="group cursor-pointer bg-white border border-[#20243A]/12 hover:border-[#20243A]/40 rounded-lg p-5 flex flex-col justify-between space-y-4 transition-colors"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-[11px] text-[#20243A]/55 font-mono-code">
                    <span>0{idx + 1} / CÂU CHUYỆN SAU NÉT VẼ</span>
                    <span>{st.gradeLabel}</span>
                  </div>

                  <h3 className="font-editorial text-lg font-bold text-[#20243A] group-hover:text-[#3457D5] transition-colors leading-snug">
                    “{st.storyTitle}”
                  </h3>

                  <p className="text-xs text-[#20243A]/75 leading-relaxed line-clamp-3">
                    {st.storyContent}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#20243A]/10 flex items-center justify-between text-xs">
                  <span className="font-bold text-[#20243A]">{st.authorNickname}</span>
                  <span className="text-[#3457D5] font-semibold inline-flex items-center gap-1">
                    <span>Đọc câu chuyện</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-[#20243A]/12 rounded-lg p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-editorial text-lg font-bold text-[#20243A]">
                Chia sẻ câu chuyện sáng tạo phía sau nét vẽ của em
              </h3>
              <p className="text-xs text-[#20243A]/70">
                Mỗi bức tranh hoặc video đều mang một kỷ niệm và thông điệp riêng. Hãy kể lại câu chuyện của em tại CÂU CHUYỆN SAU NÉT VẼ.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('art-stories')}
              className="px-4 py-2.5 rounded-lg bg-[#20243A] hover:bg-[#3457D5] text-[#F7F3EA] text-xs font-bold shrink-0 cursor-pointer transition-colors"
            >
              Mở CÂU CHUYỆN SAU NÉT VẼ →
            </button>
          </div>
        )}
      </section>

      {/* =====================================================================
          05 · TRUY CẬP NHANH MĨ THUẬT GDPT (A. TIỂU HỌC & B. THCS -> MĨ THUẬT GDPT)
         ===================================================================== */}
      <section className="rounded-xl overflow-hidden bg-[#3457D5] text-white border border-[#20243A]/15">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-7 p-6 sm:p-8 lg:p-10 flex flex-col justify-between relative overflow-hidden">
            <div
              aria-hidden="true"
              className="absolute -right-8 -bottom-8 w-40 h-40 bg-[#F15B3D] rotate-12 opacity-90 pointer-events-none"
            />
            <div
              aria-hidden="true"
              className="absolute right-24 top-6 w-6 h-6 bg-[#F2D64B] pointer-events-none"
            />

            <div className="relative z-10 space-y-3">
              <div className="flex items-center gap-2 text-[11px] font-mono-code uppercase tracking-widest text-[#F2D64B]">
                <span>PHÂN HỆ 05 · MĨ THUẬT GDPT</span>
                <span>·</span>
                <span>CHƯƠNG TRÌNH GDPT</span>
              </div>

              <h2 className="font-display text-2xl sm:text-4xl font-black tracking-tight leading-[1.06] text-white max-w-lg uppercase">
                HỌC LIỆU MĨ THUẬT GDPT (TIỂU HỌC &amp; THCS)
              </h2>

              <p className="text-xs sm:text-sm text-white/85 leading-relaxed max-w-xl">
                Truy cập nhanh kho học liệu chính thức gồm hai cấp học <strong>A. TIỂU HỌC</strong> và <strong>B. THCS</strong>, mỗi cấp gồm <strong>SLIDE BÀI GIẢNG</strong> và <strong>VIDEO BÀI GIẢNG</strong>.
              </p>

              {/* Quick Preview Cards for A. TIỂU HỌC & B. THCS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 max-w-xl">
                <div
                  onClick={() => onNavigateTab('class-lessons')}
                  className="p-3.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-[#F2D64B]">
                    <span className="inline-flex items-center gap-1.5">
                      <GraduationCap className="w-4 h-4" />
                      <span>A. TIỂU HỌC</span>
                    </span>
                    <span>{gdptCounts.tieuHocCount} tài liệu</span>
                  </div>
                  <p className="text-[11px] text-white/80 mt-1">
                    SLIDE BÀI GIẢNG &amp; VIDEO BÀI GIẢNG (Lớp 1 – Lớp 5)
                  </p>
                </div>

                <div
                  onClick={() => onNavigateTab('class-lessons')}
                  className="p-3.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-[#F2D64B]">
                    <span className="inline-flex items-center gap-1.5">
                      <FileText className="w-4 h-4" />
                      <span>B. THCS</span>
                    </span>
                    <span>{gdptCounts.thcsCount} tài liệu</span>
                  </div>
                  <p className="text-[11px] text-white/80 mt-1">
                    SLIDE BÀI GIẢNG &amp; VIDEO BÀI GIẢNG (Lớp 6 – Lớp 9)
                  </p>
                </div>
              </div>
            </div>

            <div className="relative z-10 pt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigateTab('class-lessons')}
                className="px-4 py-2.5 rounded-lg bg-[#F2D64B] hover:bg-white text-[#20243A] text-xs font-bold uppercase tracking-wide inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                <span>Mở phân hệ MĨ THUẬT GDPT</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div
            onClick={() =>
              featuredExhibitionArtwork
                ? onSelectArtwork(featuredExhibitionArtwork)
                : onNavigateTab('class-lessons')
            }
            className="lg:col-span-5 bg-[#20243A] p-5 sm:p-7 flex flex-col justify-between cursor-pointer group"
          >
            <div className="aspect-[16/10] w-full bg-[#161929] overflow-hidden border border-white/15">
              {featuredExhibitionArtwork &&
              isValidArtworkMediaUrl(
                featuredExhibitionArtwork.thumbnailUrl ||
                  featuredExhibitionArtwork.imageUrl ||
                  featuredExhibitionArtwork.downloadURL
              ) ? (
                <img
                  src={
                    featuredExhibitionArtwork.thumbnailUrl ||
                    featuredExhibitionArtwork.imageUrl ||
                    featuredExhibitionArtwork.downloadURL
                  }
                  alt={featuredExhibitionArtwork.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover museum-img-zoom"
                />
              ) : (
                <img
                  src={MIXED_MEDIA_COLLAGE_TEXTURE}
                  alt="Tác phẩm tiêu biểu"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover museum-img-zoom"
                />
              )}
            </div>

            <div className="pt-3 flex items-center justify-between gap-2 text-xs text-[#F7F3EA]">
              <div className="min-w-0">
                <p className="font-bold truncate">
                  {featuredExhibitionArtwork
                    ? featuredExhibitionArtwork.title
                    : 'Không gian Nghệ thuật Đương đại ART VERSE AI'}
                </p>
                <p className="text-[11px] text-[#F7F3EA]/65 truncate">
                  {featuredExhibitionArtwork
                    ? `${featuredExhibitionArtwork.authorNickname || featuredExhibitionArtwork.authorAlias || featuredExhibitionArtwork.creatorAnonymousPseudonym} · ${getArtworkNormalizedGrade(featuredExhibitionArtwork)}`
                    : 'Tác phẩm nổi bật'}
                </p>
              </div>
              <span className="text-[11px] font-semibold text-[#F2D64B] inline-flex items-center gap-1 shrink-0">
                <span>Chi tiết</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          CHÂN TRANG NHẬN DIỆN THƯƠNG HIỆU — ART VERSE AI
         ===================================================================== */}
      <footer className="pt-6 border-t border-[#20243A]/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-[#20243A]/65">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 bg-[#3457D5] inline-block" />
          <strong className="font-display text-sm text-[#20243A] tracking-tight">
            ART VERSE AI
          </strong>
          <span>·</span>
          <span>Contemporary Creative Gallery &amp; Mĩ thuật GDPT</span>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-[11px] font-bold uppercase tracking-wider">
          <button
            type="button"
            onClick={() => onNavigateTab('community-library')}
            className="hover:text-[#3457D5] cursor-pointer"
          >
            TRIỂN LÃM TÁC PHẨM
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('artverse-shorts')}
            className="hover:text-[#3457D5] cursor-pointer"
          >
            ARTVERSE SHORTS
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('art-stories')}
            className="hover:text-[#3457D5] cursor-pointer"
          >
            CÂU CHUYỆN SAU NÉT VẼ
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('class-lessons')}
            className="hover:text-[#3457D5] cursor-pointer"
          >
            MĨ THUẬT GDPT
          </button>
        </div>
      </footer>
    </div>
  );
};
