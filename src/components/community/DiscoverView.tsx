/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — Trang Khám Phá (Contemporary Art Editorial Mobile-First View)
 * Hiển thị dữ liệu thật từ Firebase Firestore:
 * - Hero Artwork lớn
 * - Tiêu đề ARTVERSE AI
 * - Khu vực triển lãm nổi bật
 * - Tác phẩm mới đăng
 * - Các lớp học và chủ đề đang hoạt động
 */

import React, { useMemo } from 'react';
import {
  CommunityArtwork,
  ClassGroup,
  ArtLesson,
  UserRole,
  PositiveReactionKey,
  POSITIVE_REACTIONS_META
} from '../../types/communityArt';
import { ScreenTab } from '../../types/artverse';
import { ArtCanvasVisual } from '../common/ArtCanvasVisual';
import {
  Camera,
  ArrowUpRight,
  PlaySquare,
  Sparkles,
  BookOpen,
  Layers,
  Eye
} from 'lucide-react';

interface DiscoverViewProps {
  artworks: CommunityArtwork[];
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

const ACTIVE_GRADES_META = [
  {
    id: 'cls-6',
    name: 'Khối 6',
    subtitle: 'Tạo hình & Nghệ thuật Dân gian',
    accent: '#1D4ED8',
    bgClass: 'bg-[#1D4ED8]/8 border-[#1D4ED8]/20 text-[#1D4ED8]'
  },
  {
    id: 'cls-7',
    name: 'Khối 7',
    subtitle: 'Hội họa, Phối cảnh & Ký họa',
    accent: '#D97706',
    bgClass: 'bg-[#D97706]/10 border-[#D97706]/25 text-[#B45309]'
  },
  {
    id: 'cls-8',
    name: 'Khối 8',
    subtitle: 'Đồ họa, Thời trang & Hiện đại',
    accent: '#EA580C',
    bgClass: 'bg-[#EA580C]/10 border-[#EA580C]/25 text-[#C2410C]'
  },
  {
    id: 'cls-9',
    name: 'Khối 9',
    subtitle: 'Mĩ thuật Đương đại & Tổng hợp',
    accent: '#121316',
    bgClass: 'bg-stone-900/8 border-stone-900/20 text-stone-900'
  }
];

export const DiscoverView: React.FC<DiscoverViewProps> = ({
  artworks,
  lessons,
  currentRole,
  currentAuthorKey,
  onSelectArtwork,
  onOpenUploadModal,
  onOpenProjectorModal,
  onNavigateTab,
  onSelectClassInGallery,
  onReaction
}) => {
  // Visible public/authorized artworks from real Firebase state
  const visibleArtworks = useMemo(() => {
    return artworks.filter((item) => {
      if (currentRole === 'viewer') {
        return item.status === 'approved' && item.shareStatus === 'shared';
      }
      if (currentRole === 'contributor') {
        return item.ownerKey === currentAuthorKey || (item.status === 'approved' && item.shareStatus === 'shared');
      }
      return true;
    });
  }, [artworks, currentRole, currentAuthorKey]);

  // Calculate total positive reactions for ranking featured artworks
  const getReactionSum = (art: CommunityArtwork) => {
    const r = art.reactions;
    return (
      (r.unique_idea || 0) +
      (r.striking_color || 0) +
      (r.interesting_composition || 0) +
      (r.noteworthy_detail || 0) +
      (r.inspiring || 0)
    );
  };

  // Hero Artwork: Prefer artwork with real uploaded photo (data:image or http) or top reaction artwork
  const heroArtwork = useMemo(() => {
    if (visibleArtworks.length === 0) return null;
    const withRealPhoto = visibleArtworks.filter(
      (a) => a.imageUrl && (a.imageUrl.startsWith('data:image') || a.imageUrl.startsWith('http'))
    );
    if (withRealPhoto.length > 0) {
      return withRealPhoto[0];
    }
    return visibleArtworks[0];
  }, [visibleArtworks]);

  // Featured Exhibition Artworks (Top 4 by reactions or real photos)
  const featuredArtworks = useMemo(() => {
    const sorted = [...visibleArtworks].sort((a, b) => getReactionSum(b) - getReactionSum(a));
    return sorted.slice(0, 4);
  }, [visibleArtworks]);

  // Newly Uploaded Artworks (Latest 6)
  const recentArtworks = useMemo(() => {
    return visibleArtworks.slice(0, 6);
  }, [visibleArtworks]);

  const hasRealImage = (art: CommunityArtwork) =>
    Boolean(art.imageUrl && (art.imageUrl.startsWith('data:image') || art.imageUrl.startsWith('http')));

  return (
    <div className="space-y-10 sm:space-y-14 pb-6">
      {/* =================================================================
          1. CONTEMPORARY ART EDITORIAL HEADER & LARGE HERO ARTWORK
         ================================================================= */}
      <section className="space-y-5">
        {/* Editorial Masthead */}
        <div className="border-b border-stone-300/80 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#1D4ED8]">
              BẢO TÀNG NGHỆ THUẬT SỐ HỌC ĐƯỜNG · GDPT 2018
            </p>
            <h1 className="font-editorial text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#121316] mt-1 leading-[1.05]">
              ARTVERSE AI
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-stone-600 max-w-md leading-relaxed">
            Không gian trưng bày sáng tạo trực quan của học sinh và Kho học liệu Mĩ thuật hiện đại.
          </p>
        </div>

        {/* Hero Artwork Card */}
        {heroArtwork ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 rounded-2xl overflow-hidden bg-[#121316] text-[#FAF8F5] border border-stone-800 shadow-xl">
            {/* Hero Image Area */}
            <div
              onClick={() => onSelectArtwork(heroArtwork)}
              className="lg:col-span-7 relative min-h-[320px] sm:min-h-[420px] bg-stone-900 flex items-center justify-center overflow-hidden cursor-pointer group"
            >
              {hasRealImage(heroArtwork) ? (
                <img
                  src={heroArtwork.imageUrl}
                  alt={heroArtwork.title}
                  className="w-full h-full max-h-[520px] object-cover group-hover:scale-[1.02] transition-transform duration-500"
                />
              ) : (
                <ArtCanvasVisual
                  type={heroArtwork.visualType}
                  title={heroArtwork.title}
                  className="w-full h-full min-h-[340px]"
                  badgeText={heroArtwork.className}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#121316] via-transparent to-transparent opacity-70 lg:opacity-30 pointer-events-none" />
              <div className="absolute top-3.5 left-3.5 flex items-center gap-2">
                <span className="px-3 py-1 rounded-md bg-[#121316]/85 backdrop-blur-md text-[#FBBF24] text-[11px] font-bold uppercase tracking-widest border border-white/15">
                  Tác phẩm tiêu điểm
                </span>
              </div>
            </div>

            {/* Hero Editorial Caption & Controls (Only Title, Author, Class) */}
            <div className="lg:col-span-5 p-5 sm:p-8 flex flex-col justify-between space-y-6 bg-[#121316]">
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-stone-400 border-b border-stone-800 pb-3">
                  <span className="uppercase tracking-widest font-semibold text-[#FBBF24]">
                    TRIỂN LÃM TRỰC TUYẾN
                  </span>
                  <span className="font-bold text-white bg-white/10 px-2.5 py-1 rounded">
                    {heroArtwork.className}
                  </span>
                </div>

                <h2
                  onClick={() => onSelectArtwork(heroArtwork)}
                  className="font-editorial text-2xl sm:text-3xl font-bold text-white leading-snug cursor-pointer hover:text-[#60A5FA] transition-colors"
                >
                  {heroArtwork.title}
                </h2>

                <dl className="grid grid-cols-2 gap-4 pt-2 border-t border-stone-800/90 text-xs">
                  <div>
                    <dt className="text-stone-400 uppercase tracking-wider text-[10px]">Tác giả</dt>
                    <dd className="font-semibold text-stone-100 mt-1 text-sm">
                      {heroArtwork.creatorAnonymousPseudonym}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-stone-400 uppercase tracking-wider text-[10px]">Lớp</dt>
                    <dd className="font-semibold text-[#60A5FA] mt-1 text-sm">
                      {heroArtwork.className}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => onSelectArtwork(heroArtwork)}
                    className="min-h-[48px] px-4 py-3 rounded-xl bg-[#FAF8F5] hover:bg-white text-[#121316] font-bold text-xs flex items-center justify-center gap-2 transition-transform active:scale-98 cursor-pointer"
                  >
                    <Eye className="w-4 h-4 text-[#1D4ED8]" />
                    <span>Xem chi tiết tranh</span>
                  </button>

                  <button
                    type="button"
                    onClick={onOpenUploadModal}
                    className="min-h-[48px] px-4 py-3 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#1D4ED8]/25 transition-transform active:scale-98 cursor-pointer"
                  >
                    <Camera className="w-4 h-4 text-[#FBBF24]" />
                    <span>Đăng tác phẩm</span>
                  </button>
                </div>

                {visibleArtworks.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onOpenProjectorModal(0)}
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-stone-800/90 hover:bg-stone-800 text-stone-200 font-semibold text-xs flex items-center justify-center gap-2 border border-stone-700 cursor-pointer"
                  >
                    <PlaySquare className="w-4 h-4 text-[#FBBF24]" />
                    <span>Trình chiếu toàn màn hình ({visibleArtworks.length} tác phẩm)</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-[#121316] text-white p-8 text-center space-y-4">
            <h2 className="font-editorial text-2xl font-bold">Chưa có tác phẩm nào trong triển lãm</h2>
            <p className="text-xs text-stone-300 max-w-md mx-auto">
              Hãy chụp hoặc tải bức tranh đầu tiên lên không gian triển lãm số ARTVERSE AI.
            </p>
            <button
              type="button"
              onClick={onOpenUploadModal}
              className="min-h-[48px] inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1D4ED8] text-white font-bold text-xs cursor-pointer"
            >
              <Camera className="w-4 h-4 text-[#FBBF24]" />
              <span>Đăng tác phẩm đầu tiên</span>
            </button>
          </div>
        )}
      </section>

      {/* =================================================================
          2. KHU VỰC TRIỂN LÃM NỔI BẬT (FEATURED EXHIBITION)
         ================================================================= */}
      {featuredArtworks.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-end justify-between border-b border-stone-300/80 pb-2.5">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#EA580C]">
                CURATED SELECTION
              </span>
              <h2 className="font-editorial text-2xl sm:text-3xl font-bold text-[#121316]">
                Khu vực triển lãm nổi bật
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('community-library')}
              className="min-h-[44px] inline-flex items-center gap-1 text-xs font-bold text-[#1D4ED8] hover:underline cursor-pointer px-2"
            >
              <span>Xem toàn bộ</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>

          {/* Horizontal Snap Carousel on iPhone, 4-column Editorial Grid on Desktop */}
          <div className="flex lg:grid lg:grid-cols-4 gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-2 -mx-4 px-4 lg:mx-0 lg:px-0">
            {featuredArtworks.map((art) => (
              <article
                key={art.id}
                onClick={() => onSelectArtwork(art)}
                className="snap-start shrink-0 w-[78vw] sm:w-[300px] lg:w-auto bg-white rounded-2xl border border-stone-200/90 overflow-hidden flex flex-col justify-between shadow-2xs hover:border-stone-400 transition-all cursor-pointer group"
              >
                <div className="relative aspect-[4/3] w-full bg-stone-100 overflow-hidden">
                  {hasRealImage(art) ? (
                    <img
                      src={art.imageUrl}
                      alt={art.title}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <ArtCanvasVisual
                      type={art.visualType}
                      title={art.title}
                      className="w-full h-full"
                      badgeText={art.className}
                    />
                  )}
                  <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded bg-[#121316]/85 text-white text-[11px] font-bold backdrop-blur-xs">
                    {art.className}
                  </span>
                </div>

                {/* Strict 3-field display: Tác phẩm, Tác giả, Lớp */}
                <div className="p-4 space-y-2.5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-editorial text-lg font-bold text-[#121316] line-clamp-1 group-hover:text-[#1D4ED8] transition-colors">
                      {art.title}
                    </h3>
                    <p className="text-xs text-stone-600 mt-1 truncate">
                      Tác giả: <strong className="text-stone-900">{art.creatorAnonymousPseudonym}</strong>
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-stone-100 flex items-center justify-between text-xs">
                    <span className="font-bold text-[#1D4ED8]">{art.className}</span>
                    <div className="flex items-center gap-1">
                      {(['unique_idea', 'striking_color', 'inspiring'] as PositiveReactionKey[]).map((rk) => (
                        <button
                          key={rk}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onReaction(art.id, rk);
                          }}
                          className="min-h-[32px] px-1.5 py-0.5 rounded bg-stone-100 hover:bg-stone-200 text-[11px] font-semibold text-stone-800 flex items-center gap-0.5"
                        >
                          <span>{POSITIVE_REACTIONS_META[rk].icon}</span>
                          <span>{art.reactions[rk] || 0}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* =================================================================
          3. TÁC PHẨM MỚI ĐĂNG (NEWLY UPLOADED ARTWORKS - 2-COL MASONRY)
         ================================================================= */}
      <section className="space-y-4">
        <div className="flex items-end justify-between border-b border-stone-300/80 pb-2.5">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1D4ED8]">
              RECENT ACQUISITIONS
            </span>
            <h2 className="font-editorial text-2xl sm:text-3xl font-bold text-[#121316]">
              Tác phẩm mới đăng
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('community-library')}
            className="min-h-[44px] inline-flex items-center gap-1 text-xs font-bold text-[#1D4ED8] hover:underline cursor-pointer px-2"
          >
            <span>Mở Digital Gallery</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>

        <div className="columns-2 md:columns-3 gap-3.5 sm:gap-5 space-y-3.5 sm:space-y-5">
          {recentArtworks.map((art) => (
            <div
              key={art.id}
              onClick={() => onSelectArtwork(art)}
              className="break-inside-avoid bg-white rounded-2xl border border-stone-200/90 overflow-hidden shadow-2xs hover:border-stone-400 transition-all cursor-pointer group"
            >
              <div className="relative w-full bg-stone-100 overflow-hidden">
                {hasRealImage(art) ? (
                  <img
                    src={art.imageUrl}
                    alt={art.title}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-auto block object-cover group-hover:scale-[1.02] transition-transform duration-300"
                  />
                ) : (
                  <ArtCanvasVisual
                    type={art.visualType}
                    title={art.title}
                    className="w-full h-44 sm:h-52"
                    badgeText={art.className}
                  />
                )}
              </div>

              {/* Chỉ hiển thị Tác phẩm, Tác giả, Lớp */}
              <div className="p-3 sm:p-4 space-y-1.5">
                <h3 className="text-sm sm:text-base font-bold text-[#121316] leading-snug line-clamp-2 group-hover:text-[#1D4ED8] transition-colors">
                  {art.title}
                </h3>
                <p className="text-[11px] sm:text-xs text-stone-600 truncate">
                  Tác giả: <strong className="text-stone-800">{art.creatorAnonymousPseudonym}</strong>
                </p>
                <div className="pt-1 flex items-center justify-between">
                  <span className="inline-block text-[10px] sm:text-[11px] font-bold text-[#1D4ED8] bg-[#1D4ED8]/8 px-2 py-0.5 rounded border border-[#1D4ED8]/15">
                    {art.className}
                  </span>
                  <span className="text-[11px] text-stone-500 font-medium">
                    ✨ {getReactionSum(art)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* =================================================================
          4. CÁC LỚP HỌC VÀ CHỦ ĐỀ ĐANG HOẠT ĐỘNG & AI LESSON STUDIO
         ================================================================= */}
      <section className="space-y-5">
        <div className="flex items-end justify-between border-b border-stone-300/80 pb-2.5">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#D97706]">
              ACTIVE STUDIO &amp; CLASSES
            </span>
            <h2 className="font-editorial text-2xl sm:text-3xl font-bold text-[#121316]">
              Các lớp học &amp; chủ đề đang hoạt động
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('class-lessons')}
            className="min-h-[44px] inline-flex items-center gap-1 text-xs font-bold text-[#1D4ED8] hover:underline cursor-pointer px-2"
          >
            <span>Tất cả bài học</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>

        {/* 4 Active Grades List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {ACTIVE_GRADES_META.map((grade) => {
            const gradeLessons = lessons.filter((l) => l.classGroupId === grade.id && !l.isHidden);
            const gradeArtworksCount = visibleArtworks.filter((a) => a.classGroupId === grade.id).length;

            return (
              <div
                key={grade.id}
                className="bg-white rounded-2xl border border-stone-200/90 p-5 flex flex-col justify-between space-y-4 shadow-2xs"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-extrabold px-2.5 py-1 rounded-md border ${grade.bgClass}`}>
                      {grade.name}
                    </span>
                    <span className="text-xs font-semibold text-stone-500">
                      {gradeArtworksCount} tác phẩm
                    </span>
                  </div>
                  <h3 className="font-editorial text-lg font-bold text-[#121316]">
                    {grade.subtitle}
                  </h3>
                  <div className="space-y-1 pt-1">
                    {gradeLessons.slice(0, 2).map((les) => (
                      <div
                        key={les.id}
                        className="text-xs text-stone-600 flex items-center gap-1.5 truncate"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-stone-400 shrink-0" />
                        <span className="truncate">{les.title}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-stone-100 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectClassInGallery(grade.id)}
                    className="min-h-[44px] px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5 text-[#1D4ED8]" />
                    <span>Xem tranh</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('class-lessons')}
                    className="min-h-[44px] px-3 py-2 rounded-xl bg-[#1D4ED8]/10 hover:bg-[#1D4ED8]/20 text-[#1D4ED8] font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Bài học ({gradeLessons.length})</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Gemini Assistant Editorial Callout */}
        <div className="pt-2">
          <div className="rounded-2xl bg-white border border-stone-200/90 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5 max-w-2xl">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1D4ED8]">
                GEMINI ART ASSISTANT
              </span>
              <h3 className="font-editorial text-2xl font-bold text-[#121316]">
                Trợ lý Cố vấn Mĩ thuật Gemini AI
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Tư vấn ý tưởng bố cục, hòa sắc, kịch bản Video &amp; Slide bài giảng hoặc gửi ảnh tranh để nhận lời khích lệ sáng tạo (không chấm điểm).
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('ai-chatbox')}
              className="min-h-[48px] shrink-0 self-start sm:self-center inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold text-xs cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-[#FBBF24]" />
              <span>Trò chuyện cùng Gemini AI</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
